import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { errorResponse, jsonResponse, corsHeaders } from "../_shared/http.ts";
import { decodeGoalReviewContext, hashGoalReviewContext, limitGoalReviewContext, type GoalReviewContext } from "../_shared/ai/goal-review-context.ts";
import { buildGoalReviewSystemPrompt, GOAL_REVIEW_PROMPT_VERSION } from "../_shared/ai/goal-review-prompt.ts";
import { goalPortfolioReviewJsonSchema, normalizeOpenAIGoalReview, parseProviderJson, validateAndFinalizeGoalReview } from "../_shared/ai/goal-review-schema.ts";
import { configureAIProvider, describeAIProvider } from "../_shared/ai/config.ts";
import { AIBudgetError, AIUsageMeter, budgetNanoUsd, finishAIRun, maxReservationNanoUsd, reserveAIRun } from "../_shared/ai/budget.ts";
import { AIProviderError } from "../_shared/ai/provider.ts";
import { goalReviewFreshness, isGoalReviewCacheReusable } from "../_shared/ai/goal-review-cache.ts";

const SCHEMA_VERSION = 1;
const CAPABILITY = "goal_portfolio_review";

function env(name: string, fallback?: string) {
  return Deno.env.get(name) ?? fallback;
}
function numberEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(env(name));
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}
function publicKey() {
  const direct = env("SUPABASE_PUBLISHABLE_KEY") ?? env("SUPABASE_ANON_KEY");
  if (direct) return direct;
  try {
    const keys = JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS", "{}")!) as Record<string, string>;
    return keys.default;
  } catch { return undefined; }
}
function serverKey() {
  const direct = env("SUPABASE_SECRET_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  try {
    const keys = JSON.parse(env("SUPABASE_SECRET_KEYS", "{}")!) as Record<string, string>;
    return keys.default;
  } catch { return undefined; }
}
function parseRequest(value: unknown): { operation: "latest"; workspaceId: string } | { operation: "generate"; workspaceId: string; forceRefresh: boolean } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_request");
  const root = value as Record<string, unknown>;
  if (typeof root.workspaceId !== "string") throw new Error("invalid_request");
  if (root.operation === "latest") {
    if (Object.keys(root).some((key) => !["workspaceId", "operation"].includes(key))) throw new Error("invalid_request");
    return { operation: "latest", workspaceId: root.workspaceId };
  }
  if (root.operation !== undefined || Object.keys(root).some((key) => !["workspaceId", "forceRefresh"].includes(key)) || (root.forceRefresh !== undefined && typeof root.forceRefresh !== "boolean")) throw new Error("invalid_request");
  return { operation: "generate", workspaceId: root.workspaceId, forceRefresh: root.forceRefresh === true };
}
function responsePayload(row: Record<string, unknown>, cached: boolean) {
  return { reviewId: row.id, status: "ready", cached, generatedAt: row.created_at, periodStart: row.period_start, periodEnd: row.period_end, windowDays: row.window_days ?? 28, provider: row.provider, model: row.model, analyzedGoalIds: row.analyzed_goal_ids, omittedGoalIds: row.omitted_goal_ids, review: row.review_json };
}
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return errorResponse("PROVIDER_REJECTED", "Dozwolona jest tylko metoda POST.", 405);
  const started = Date.now();
  const supabaseUrl = env("SUPABASE_URL"); const browserKey = publicKey(); const secretKey = serverKey();
  if (!supabaseUrl || !browserKey || !secretKey) return errorResponse("AI_NOT_CONFIGURED", "Przegląd AI nie jest skonfigurowany.", 503);
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return errorResponse("WORKSPACE_NOT_AVAILABLE", "Workspace nie jest dostępny.", 401);
  const userClient = createClient(supabaseUrl, browserKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let runId: string | undefined;
  let meter: AIUsageMeter | undefined;
  try {
    const body = parseRequest(await request.json());
    const token = authorization.slice("Bearer ".length);
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return errorResponse("WORKSPACE_NOT_AVAILABLE", "Workspace nie jest dostępny.", 401);
    const membership = await userClient.rpc("get_workspace_core", { target_user_id: authData.user.id });
    const membershipWorkspaceId = membership.data && typeof membership.data === "object" && !Array.isArray(membership.data)
      ? (membership.data as Record<string, unknown>).workspaceId
      : undefined;
    if (membership.error || membershipWorkspaceId !== body.workspaceId) return errorResponse("WORKSPACE_NOT_AVAILABLE", "Workspace nie jest dostępny.", 404);
    const settingsResult = await userClient.from("workspaces").select("ai_review_window_days,ai_review_cache_hours").eq("id", body.workspaceId).maybeSingle();
    let windowDays: 7 | 14 | 28 = 28;
    let cacheHours: 24 | 72 | 168 = 72;
    if (settingsResult.error) {
      if (settingsResult.error.code !== "42703") return errorResponse("WORKSPACE_NOT_AVAILABLE", "Nie udało się odczytać ustawień Workspace.", 503);
    } else {
      const row = settingsResult.data as Record<string, unknown> | null;
      if (!row) return errorResponse("WORKSPACE_NOT_AVAILABLE", "Workspace nie jest dostępny.", 404);
      if (![7, 14, 28].includes(row.ai_review_window_days as number) || ![24, 72, 168].includes(row.ai_review_cache_hours as number)) {
        return errorResponse("WORKSPACE_NOT_AVAILABLE", "Ustawienia Przeglądu AI są nieprawidłowe.", 500);
      }
      windowDays = row.ai_review_window_days as 7 | 14 | 28;
      cacheHours = row.ai_review_cache_hours as 24 | 72 | 168;
    }
    let latestRow: Record<string, unknown> | null = null;
    if (body.operation === "latest") {
      const { data, error } = await admin.from("ai_goal_reviews").select("*")
        .eq("workspace_id", body.workspaceId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) return errorResponse("WORKSPACE_NOT_AVAILABLE", "Nie udało się sprawdzić aktualności Przeglądu AI.", 503);
      if (!data) return jsonResponse({ review: null, freshness: "none", checkedAt: new Date().toISOString() });
      latestRow = data;
    }
    const { data: contextData, error: contextError } = await userClient.rpc("get_ai_goal_review_context", { target_workspace_id: body.workspaceId, window_days: windowDays });
    if (contextError || !contextData) {
      if (latestRow) return jsonResponse({ review: responsePayload(latestRow, true), freshness: "unknown", checkedAt: new Date().toISOString() });
      return errorResponse("WORKSPACE_NOT_AVAILABLE", "Workspace nie jest dostępny.", 404);
    }
    const decodedContext = decodeGoalReviewContext(contextData, windowDays);
    if (decodedContext.workspaceId !== body.workspaceId) return errorResponse("WORKSPACE_NOT_AVAILABLE", "Workspace nie jest dostępny.", 404);
    const maxInputChars = numberEnv("AI_MAX_INPUT_CHARS", 40_000, 5_000, 40_000);
    let context: GoalReviewContext;
    let serialized: string;
    try {
      ({ context, serialized } = limitGoalReviewContext(decodedContext, maxInputChars));
    } catch (error) {
      if (error instanceof Error && error.message === "CONTEXT_TOO_LARGE") {
        if (latestRow) return jsonResponse({ review: responsePayload(latestRow, true), freshness: "unknown", checkedAt: new Date().toISOString() });
        return errorResponse("CONTEXT_TOO_LARGE", "Nawet po ograniczeniu zakresu dane przekraczają bezpieczny limit analizy.", 413);
      }
      throw error;
    }
    const { hash } = await hashGoalReviewContext(context);
    const promptVersion = numberEnv("AI_PROMPT_VERSION", GOAL_REVIEW_PROMPT_VERSION, 1, 1000);
    const now = new Date();
    const identity = describeAIProvider(CAPABILITY, (name) => env(name));

    if (body.operation === "latest") {
      const freshness = goalReviewFreshness({
        row: latestRow as unknown as Parameters<typeof goalReviewFreshness>[0]["row"],
        windowDays,
        contextHash: hash,
        provider: identity?.provider,
        model: identity?.model,
        promptVersion,
        schemaVersion: SCHEMA_VERSION,
        cacheHours,
        now
      });
      return jsonResponse({ review: responsePayload(latestRow!, true), freshness, checkedAt: new Date().toISOString() });
    }

    if (env("AI_GOAL_REVIEW_ENABLED", "true") !== "true") return errorResponse("AI_NOT_CONFIGURED", "Przegląd AI jest wyłączony.", 503);
    if (!context.goals.length) return errorResponse("NO_ACTIVE_GOALS", "Nie ma aktywnych Celów do analizy.", 422);
    const config = configureAIProvider(CAPABILITY, (name) => env(name));
    const provider = config.provider;
    // Lekki, idempotentny cleanup respektuje osobną retencję treści i metadanych.
    const reviewRetentionDays = numberEnv("AI_REVIEW_RETENTION_DAYS", 90, 7, 730);
    const runRetentionDays = numberEnv("AI_RUN_RETENTION_DAYS", 30, 7, 365);
    await admin.from("ai_goal_reviews").delete().eq("workspace_id", body.workspaceId).lt("created_at", new Date(now.getTime() - reviewRetentionDays * 86_400_000).toISOString());
    await admin.from("ai_runs").delete().eq("workspace_id", body.workspaceId).lt("created_at", new Date(now.getTime() - runRetentionDays * 86_400_000).toISOString());
    const lookupReusableReview = async () => {
      const { data: cached, error: cacheError } = await admin.from("ai_goal_reviews").select("*")
        .eq("workspace_id", body.workspaceId).eq("window_days", windowDays).eq("context_hash", hash)
        .eq("prompt_version", promptVersion).eq("schema_version", SCHEMA_VERSION).eq("provider", identity!.provider).eq("model", identity!.model)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (cacheError) throw new Error("goal_review_cache_read_failed");
      return cached && isGoalReviewCacheReusable(cached, now, cacheHours) ? cached : undefined;
    };
    if (!body.forceRefresh) {
      const cached = await lookupReusableReview();
      if (cached) return jsonResponse(responsePayload(cached, true));
    }
    const ownerToken = crypto.randomUUID();
    const claimArgs = {
      target_workspace_id: body.workspaceId,
      target_window_days: windowDays,
      target_context_hash: hash,
      target_provider: identity!.provider,
      target_model: identity!.model,
      target_prompt_version: promptVersion,
      target_schema_version: SCHEMA_VERSION,
      target_owner_token: ownerToken
    };
    const { data: claimed, error: claimError } = await admin.rpc("try_claim_ai_goal_review", claimArgs);
    if (claimError) return errorResponse("AI_CLAIM_UNAVAILABLE", "Nie udało się zabezpieczyć pojedynczego uruchomienia. Nie uruchomiono modelu.", 503);
    if (claimed !== true) return errorResponse("AI_GENERATION_IN_PROGRESS", "Analiza jest już przygotowywana. Nie uruchomiono kolejnego modelu.", 409);
    try {
      if (!body.forceRefresh) {
        const cached = await lookupReusableReview();
        if (cached) return jsonResponse(responsePayload(cached, true));
      }
    const providerRequest = { system: buildGoalReviewSystemPrompt(config.structuredMode), input: context, jsonSchema: goalPortfolioReviewJsonSchema, schemaName: "goal_portfolio_review", maxOutputTokens: numberEnv("AI_MAX_OUTPUT_TOKENS", provider.name === "openai" ? 6000 : 2200, 500, 8000), timeoutMs: numberEnv("AI_TIMEOUT_MS", 60_000, 3_000, 60_000) };
    const reservedNanoUsd = maxReservationNanoUsd(config, providerRequest);
    runId = await reserveAIRun(admin, {
      workspaceId: body.workspaceId, userId: authData.user.id, capability: CAPABILITY, config,
      promptVersion, schemaVersion: SCHEMA_VERSION, inputChars: serialized.length, reservedNanoUsd,
      dailyLimit: numberEnv("AI_REVIEW_DAILY_LIMIT", 10, 1, 100), forceRefresh: body.forceRefresh,
      dailyBudgetNanoUsd: budgetNanoUsd(env("AI_WORKSPACE_DAILY_BUDGET_USD"), 0.5),
      monthlyBudgetNanoUsd: budgetNanoUsd(env("AI_PROJECT_MONTHLY_BUDGET_USD"), 5),
    });
    meter = new AIUsageMeter(config, reservedNanoUsd);
    let providerResult;
    try { providerResult = await meter.complete(providerRequest); }
    catch (error) {
      if (!(error instanceof AIProviderError) || !error.retryable || error.code === "PROVIDER_RATE_LIMITED") throw error;
      providerResult = await meter.complete(providerRequest);
    }
    let review;
    try { review = validateAndFinalizeGoalReview(normalizeOpenAIGoalReview(parseProviderJson(providerResult.content)), context); }
    catch {
      if (meter.attempts >= 2) throw new Error("invalid_model_output");
      const repaired = await meter.complete({ ...providerRequest, system: `${providerRequest.system}\nPoprzednia odpowiedź nie przeszła walidacji. Zwróć poprawny JSON bez komentarza.` });
      providerResult = repaired;
      review = validateAndFinalizeGoalReview(normalizeOpenAIGoalReview(parseProviderJson(repaired.content)), context);
    }
    const analyzedGoalIds = context.goals.map((goal) => goal.id);
    const createdAt = new Date().toISOString();
    const { data: saved, error: saveError } = await admin.from("ai_goal_reviews").insert({ workspace_id: body.workspaceId, created_by: authData.user.id, run_id: runId, period_start: context.periodStart, period_end: context.periodEnd, window_days: windowDays, source_snapshot_at: context.sourceSnapshotAt, context_hash: hash, prompt_version: promptVersion, schema_version: SCHEMA_VERSION, provider: provider.name, model: provider.model, review_json: review, analyzed_goal_ids: analyzedGoalIds, omitted_goal_ids: context.omittedGoalIds, created_at: createdAt, cache_expires_at: new Date(Date.now() + cacheHours * 3_600_000).toISOString() }).select("*").single();
    if (saveError || !saved) throw new Error("review_write_failed");
    await finishAIRun(admin, { runId, status: "succeeded", meter, latencyMs: Date.now() - started });
    runId = undefined;
    return jsonResponse(responsePayload(saved, false), 201);
    } finally {
      try {
        const released = await admin.rpc("release_ai_goal_review_claim", claimArgs);
        if (released.error) {
          const retried = await admin.rpc("release_ai_goal_review_claim", claimArgs);
          if (retried.error) console.error("AI_CLAIM_RELEASE_FAILED");
        }
      } catch { console.error("AI_CLAIM_RELEASE_FAILED"); }
    }
  } catch (error) {
    const code = error instanceof AIBudgetError ? error.code : error instanceof AIProviderError ? error.code : error instanceof Error && error.message === "AI_NOT_CONFIGURED" ? "AI_NOT_CONFIGURED" : error instanceof Error && error.message === "goal_review_cache_read_failed" ? "AI_CACHE_UNAVAILABLE" : error instanceof Error && error.message === "invalid_request" ? "INVALID_REQUEST" : "INVALID_MODEL_OUTPUT";
    if (runId && meter) await finishAIRun(admin, { runId, status: "failed", errorCode: code, meter, latencyMs: Date.now() - started }).catch(() => undefined);
    const status = code === "AI_NOT_CONFIGURED" || code === "AI_CACHE_UNAVAILABLE" ? 503 : code === "INVALID_REQUEST" ? 400 : code === "AI_BUDGET_EXCEEDED" || code === "AI_RATE_LIMITED" || code === "PROVIDER_RATE_LIMITED" ? 429 : code === "PROVIDER_TIMEOUT" ? 504 : code === "PROVIDER_REJECTED" ? 502 : 422;
    const message = code === "INVALID_MODEL_OUTPUT" ? "Model zwrócił odpowiedź, której nie można bezpiecznie wyświetlić." : code === "AI_CACHE_UNAVAILABLE" ? "Nie udało się sprawdzić zapisanego wyniku. Spróbuj ponownie." : code === "INVALID_REQUEST" ? "Nieprawidłowe żądanie Przeglądu AI." : error instanceof Error ? error.message : "Nie udało się wygenerować Przeglądu AI.";
    return errorResponse(code, message, status);
  }
});
