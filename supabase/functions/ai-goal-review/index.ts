import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { errorResponse, jsonResponse, corsHeaders } from "../_shared/http.ts";
import { decodeGoalReviewContext, hashGoalReviewContext } from "../_shared/ai/goal-review-context.ts";
import { buildGoalReviewSystemPrompt, GOAL_REVIEW_PROMPT_VERSION } from "../_shared/ai/goal-review-prompt.ts";
import { goalPortfolioReviewJsonSchema, parseProviderJson, validateAndFinalizeGoalReview } from "../_shared/ai/goal-review-schema.ts";
import { createNvidiaProvider } from "../_shared/ai/nvidia.ts";
import { AIProviderError, type AIProvider } from "../_shared/ai/provider.ts";

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
function parseRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_request");
  const root = value as Record<string, unknown>;
  if (Object.keys(root).some((key) => !["workspaceId", "forceRefresh"].includes(key)) || typeof root.workspaceId !== "string" || (root.forceRefresh !== undefined && typeof root.forceRefresh !== "boolean")) throw new Error("invalid_request");
  return { workspaceId: root.workspaceId, forceRefresh: root.forceRefresh === true };
}
function providerFromEnvironment(): AIProvider {
  if (env("AI_PROVIDER", "nvidia") !== "nvidia") throw new Error("AI_NOT_CONFIGURED");
  const apiKey = env("NVIDIA_API_KEY"); const model = env("NVIDIA_MODEL");
  if (!apiKey || !model) throw new Error("AI_NOT_CONFIGURED");
  return createNvidiaProvider({ baseUrl: env("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")!, apiKey, model, authMode: env("NVIDIA_AUTH_MODE", "bearer") === "api-key" ? "api-key" : "bearer", structuredMode: env("NVIDIA_STRUCTURED_MODE", "guided_json") === "prompt" ? "prompt" : "guided_json" });
}
function responsePayload(row: Record<string, unknown>, cached: boolean) {
  return { reviewId: row.id, status: "ready", cached, generatedAt: row.created_at, periodStart: row.period_start, periodEnd: row.period_end, provider: row.provider, model: row.model, analyzedGoalIds: row.analyzed_goal_ids, omittedGoalIds: row.omitted_goal_ids, review: row.review_json };
}
async function failRun(admin: ReturnType<typeof createClient>, runId: string | undefined, code: string, latencyMs: number) {
  if (!runId) return;
  await admin.from("ai_runs").update({ status: "failed", error_code: code, latency_ms: latencyMs, finished_at: new Date().toISOString() }).eq("id", runId);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return errorResponse("PROVIDER_REJECTED", "Dozwolona jest tylko metoda POST.", 405);
  const started = Date.now();
  const supabaseUrl = env("SUPABASE_URL"); const browserKey = publicKey(); const secretKey = serverKey();
  if (!supabaseUrl || !browserKey || !secretKey || env("AI_GOAL_REVIEW_ENABLED", "true") !== "true") return errorResponse("AI_NOT_CONFIGURED", "Przegląd AI nie jest skonfigurowany.", 503);
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return errorResponse("WORKSPACE_NOT_AVAILABLE", "Workspace nie jest dostępny.", 401);
  const userClient = createClient(supabaseUrl, browserKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let runId: string | undefined;
  try {
    const body = parseRequest(await request.json());
    const token = authorization.slice("Bearer ".length);
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return errorResponse("WORKSPACE_NOT_AVAILABLE", "Workspace nie jest dostępny.", 401);
    const { data: contextData, error: contextError } = await userClient.rpc("get_ai_goal_review_context", { target_workspace_id: body.workspaceId, window_days: 28 });
    if (contextError || !contextData) return errorResponse("WORKSPACE_NOT_AVAILABLE", "Workspace nie jest dostępny.", 404);
    const context = decodeGoalReviewContext(contextData);
    if (!context.goals.length) return errorResponse("NO_ACTIVE_GOALS", "Nie ma aktywnych Celów do analizy.", 422);
    const { serialized, hash } = await hashGoalReviewContext(context);
    const maxInputChars = numberEnv("AI_MAX_INPUT_CHARS", 40_000, 5_000, 200_000);
    if (serialized.length > maxInputChars) return errorResponse("CONTEXT_TOO_LARGE", "Zakres danych jest zbyt duży do bezpiecznej analizy.", 413);
    const provider = providerFromEnvironment();
    const promptVersion = numberEnv("AI_PROMPT_VERSION", GOAL_REVIEW_PROMPT_VERSION, 1, 1000);
    const now = new Date();
    // Lekki, idempotentny cleanup respektuje osobną retencję treści i metadanych.
    const reviewRetentionDays = numberEnv("AI_REVIEW_RETENTION_DAYS", 90, 7, 730);
    const runRetentionDays = numberEnv("AI_RUN_RETENTION_DAYS", 30, 7, 365);
    await admin.from("ai_goal_reviews").delete().eq("workspace_id", body.workspaceId).lt("created_at", new Date(now.getTime() - reviewRetentionDays * 86_400_000).toISOString());
    await admin.from("ai_runs").delete().eq("workspace_id", body.workspaceId).lt("created_at", new Date(now.getTime() - runRetentionDays * 86_400_000).toISOString());
    if (!body.forceRefresh) {
      const { data: cached } = await admin.from("ai_goal_reviews").select("*").eq("workspace_id", body.workspaceId).eq("context_hash", hash).eq("prompt_version", promptVersion).eq("schema_version", SCHEMA_VERSION).eq("model", provider.model).gt("cache_expires_at", now.toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (cached) return jsonResponse(responsePayload(cached, true));
    }
    const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
    const dailyLimit = numberEnv("AI_REVIEW_DAILY_LIMIT", 10, 1, 100);
    const { count } = await admin.from("ai_runs").select("id", { count: "exact", head: true }).eq("workspace_id", body.workspaceId).eq("user_id", authData.user.id).eq("capability", CAPABILITY).in("status", ["running", "succeeded"]).gte("created_at", dayStart.toISOString());
    if ((count ?? 0) >= dailyLimit) return errorResponse("AI_RATE_LIMITED", "Wykorzystano dzienny limit analiz.", 429, 3600);
    if (body.forceRefresh) {
      const cooldown = new Date(now.getTime() - 5 * 60_000).toISOString();
      const { count: recent } = await admin.from("ai_runs").select("id", { count: "exact", head: true }).eq("workspace_id", body.workspaceId).eq("user_id", authData.user.id).eq("capability", CAPABILITY).in("status", ["running", "succeeded"]).gte("created_at", cooldown);
      if ((recent ?? 0) > 0) return errorResponse("AI_RATE_LIMITED", "Odczekaj 5 minut przed wymuszonym odświeżeniem.", 429, 300);
    }
    const { data: run, error: runError } = await admin.from("ai_runs").insert({ workspace_id: body.workspaceId, user_id: authData.user.id, capability: CAPABILITY, provider: provider.name, model: provider.model, prompt_version: promptVersion, schema_version: SCHEMA_VERSION, status: "running", input_chars: serialized.length }).select("id").single();
    if (runError || !run) throw new Error("run_write_failed");
    runId = run.id;
    const structuredMode = env("NVIDIA_STRUCTURED_MODE", "guided_json") === "prompt" ? "prompt" : "guided_json";
    const providerRequest = { system: buildGoalReviewSystemPrompt(structuredMode), input: context, jsonSchema: goalPortfolioReviewJsonSchema, maxOutputTokens: numberEnv("AI_MAX_OUTPUT_TOKENS", 2200, 500, 8000), timeoutMs: numberEnv("AI_TIMEOUT_MS", 60_000, 3_000, 60_000) };
    let providerResult;
    try { providerResult = await provider.complete(providerRequest); }
    catch (error) {
      if (!(error instanceof AIProviderError) || !error.retryable) throw error;
      providerResult = await provider.complete(providerRequest);
    }
    let review;
    try { review = validateAndFinalizeGoalReview(parseProviderJson(providerResult.content), context); }
    catch {
      const repaired = await provider.complete({ ...providerRequest, system: `${providerRequest.system}\nPoprzednia odpowiedź nie przeszła walidacji. Zwróć poprawny JSON bez komentarza.` });
      providerResult = repaired;
      review = validateAndFinalizeGoalReview(parseProviderJson(repaired.content), context);
    }
    const analyzedGoalIds = context.goals.map((goal) => goal.id);
    const cacheHours = numberEnv("AI_REVIEW_CACHE_HOURS", 24, 1, 168);
    const createdAt = new Date().toISOString();
    const { data: saved, error: saveError } = await admin.from("ai_goal_reviews").insert({ workspace_id: body.workspaceId, created_by: authData.user.id, run_id: runId, period_start: context.periodStart, period_end: context.periodEnd, source_snapshot_at: context.sourceSnapshotAt, context_hash: hash, prompt_version: promptVersion, schema_version: SCHEMA_VERSION, provider: provider.name, model: provider.model, review_json: review, analyzed_goal_ids: analyzedGoalIds, omitted_goal_ids: context.omittedGoalIds, created_at: createdAt, cache_expires_at: new Date(Date.now() + cacheHours * 3_600_000).toISOString() }).select("*").single();
    if (saveError || !saved) throw new Error("review_write_failed");
    await admin.from("ai_runs").update({ status: "succeeded", input_tokens: providerResult.usage.inputTokens, output_tokens: providerResult.usage.outputTokens, latency_ms: Date.now() - started, provider_request_id: providerResult.requestId, finished_at: new Date().toISOString() }).eq("id", runId);
    return jsonResponse(responsePayload(saved, false), 201);
  } catch (error) {
    const code = error instanceof AIProviderError ? error.code : error instanceof Error && error.message === "AI_NOT_CONFIGURED" ? "AI_NOT_CONFIGURED" : "INVALID_MODEL_OUTPUT";
    await failRun(admin, runId, code, Date.now() - started);
    const status = code === "AI_NOT_CONFIGURED" ? 503 : code === "PROVIDER_TIMEOUT" ? 504 : code === "PROVIDER_RATE_LIMITED" ? 429 : code === "PROVIDER_REJECTED" ? 502 : 422;
    const message = code === "INVALID_MODEL_OUTPUT" ? "Model zwrócił odpowiedź, której nie można bezpiecznie wyświetlić." : error instanceof Error ? error.message : "Nie udało się wygenerować Przeglądu AI.";
    return errorResponse(code, message, status);
  }
});
