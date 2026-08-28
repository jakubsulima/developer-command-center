import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { errorResponse, jsonResponse, corsHeaders } from "../_shared/http.ts";
import { decodeInboxTriageContext, hashInboxTriageContext } from "../_shared/ai/inbox-triage-context.ts";
import { buildInboxTriageSystemPrompt, INBOX_TRIAGE_PROMPT_VERSION } from "../_shared/ai/inbox-triage-prompt.ts";
import { inboxTriageJsonSchema, parseProviderJson, validateAndFinalizeInboxTriage } from "../_shared/ai/inbox-triage-schema.ts";
import { createNvidiaProvider } from "../_shared/ai/nvidia.ts";
import { AIProviderError, type AIProvider } from "../_shared/ai/provider.ts";

const SCHEMA_VERSION = 1;
const CAPABILITY = "inbox_triage";

function env(name: string, fallback?: string) { return Deno.env.get(name) ?? fallback; }
function numberEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(env(name));
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}
function keys(name: string, directName: string) {
  const direct = env(directName);
  if (direct) return direct;
  try { return (JSON.parse(env(name, "{}")!) as Record<string, string>).default; } catch { return undefined; }
}
function providerFromEnvironment(): AIProvider {
  if (env("AI_PROVIDER", "nvidia") !== "nvidia") throw new Error("AI_NOT_CONFIGURED");
  const apiKey = env("NVIDIA_API_KEY"); const model = env("NVIDIA_MODEL");
  if (!apiKey || !model) throw new Error("AI_NOT_CONFIGURED");
  return createNvidiaProvider({ baseUrl: env("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")!, apiKey, model, authMode: env("NVIDIA_AUTH_MODE", "bearer") === "api-key" ? "api-key" : "bearer", structuredMode: env("NVIDIA_STRUCTURED_MODE", "guided_json") === "prompt" ? "prompt" : "guided_json" });
}
function parseRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_request");
  const root = value as Record<string, unknown>;
  if (Object.keys(root).some((key) => !["workspaceId", "inboxItemId", "forceRefresh"].includes(key)) || typeof root.workspaceId !== "string" || typeof root.inboxItemId !== "string" || (root.forceRefresh !== undefined && typeof root.forceRefresh !== "boolean")) throw new Error("invalid_request");
  return { workspaceId: root.workspaceId, inboxItemId: root.inboxItemId, forceRefresh: root.forceRefresh === true };
}
function responsePayload(row: Record<string, unknown>, cached: boolean) {
  return { proposalId: row.id, inboxItemId: row.inbox_item_id, status: "ready", cached, generatedAt: row.created_at, provider: row.provider, model: row.model, proposal: row.proposal_json };
}
async function failRun(admin: ReturnType<typeof createClient>, runId: string | undefined, code: string, latencyMs: number) {
  if (runId) await admin.from("ai_runs").update({ status: "failed", error_code: code, latency_ms: latencyMs, finished_at: new Date().toISOString() }).eq("id", runId);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return errorResponse("PROVIDER_REJECTED", "Dozwolona jest tylko metoda POST.", 405);
  const started = Date.now();
  const supabaseUrl = env("SUPABASE_URL"); const browserKey = keys("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_PUBLISHABLE_KEY") ?? keys("SUPABASE_ANON_KEYS", "SUPABASE_ANON_KEY"); const secretKey = keys("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY") ?? keys("SUPABASE_SERVICE_ROLE_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !browserKey || !secretKey || env("AI_INBOX_TRIAGE_ENABLED", "true") !== "true") return errorResponse("AI_NOT_CONFIGURED", "Asystent Skrzynki nie jest skonfigurowany.", 503);
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
    const { data: contextData, error: contextError } = await userClient.rpc("get_ai_inbox_triage_context", { target_workspace_id: body.workspaceId, target_inbox_item_id: body.inboxItemId });
    if (contextError || !contextData) return errorResponse("WORKSPACE_NOT_AVAILABLE", "Workspace nie jest dostępny.", 404);
    const context = decodeInboxTriageContext(contextData);
    if (context.inbox.id !== body.inboxItemId || context.inbox.status !== "unprocessed") return errorResponse("INBOX_ITEM_NOT_AVAILABLE", "Element Skrzynki nie jest już dostępny do analizy.", 409);
    const { serialized, hash } = await hashInboxTriageContext(context);
    if (serialized.length > numberEnv("AI_MAX_INPUT_CHARS", 40_000, 5_000, 200_000)) return errorResponse("CONTEXT_TOO_LARGE", "Zakres danych jest zbyt duży do bezpiecznej analizy.", 413);
    const provider = providerFromEnvironment(); const promptVersion = numberEnv("AI_INBOX_TRIAGE_PROMPT_VERSION", INBOX_TRIAGE_PROMPT_VERSION, 1, 1000); const now = new Date();
    const retentionDays = numberEnv("AI_INBOX_TRIAGE_RETENTION_DAYS", 90, 7, 730);
    await Promise.all([
      admin.from("ai_inbox_triage_proposals").delete().eq("workspace_id", body.workspaceId).lt("created_at", new Date(now.getTime() - retentionDays * 86_400_000).toISOString()),
      admin.from("ai_runs").delete().eq("workspace_id", body.workspaceId).eq("user_id", authData.user.id).eq("capability", CAPABILITY).lt("created_at", new Date(now.getTime() - numberEnv("AI_RUN_RETENTION_DAYS", 30, 7, 365) * 86_400_000).toISOString())
    ]).catch(() => undefined);
    if (!body.forceRefresh) {
      const { data: cached } = await admin.from("ai_inbox_triage_proposals").select("*").eq("workspace_id", body.workspaceId).eq("inbox_item_id", body.inboxItemId).eq("context_hash", hash).eq("prompt_version", promptVersion).eq("schema_version", SCHEMA_VERSION).eq("model", provider.model).gt("cache_expires_at", now.toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (cached) return jsonResponse(responsePayload(cached, true));
    }
    const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
    const dailyLimit = numberEnv("AI_INBOX_TRIAGE_DAILY_LIMIT", 30, 1, 200);
    const { count } = await admin.from("ai_runs").select("id", { count: "exact", head: true }).eq("workspace_id", body.workspaceId).eq("user_id", authData.user.id).eq("capability", CAPABILITY).in("status", ["running", "succeeded"]).gte("created_at", dayStart.toISOString());
    if ((count ?? 0) >= dailyLimit) return errorResponse("AI_RATE_LIMITED", "Wykorzystano dzienny limit propozycji.", 429, 3600);
    if (body.forceRefresh) {
      const cooldown = new Date(now.getTime() - 5 * 60_000).toISOString();
      const { count: recent } = await admin.from("ai_runs").select("id", { count: "exact", head: true }).eq("workspace_id", body.workspaceId).eq("user_id", authData.user.id).eq("capability", CAPABILITY).in("status", ["running", "succeeded"]).gte("created_at", cooldown);
      if ((recent ?? 0) > 0) return errorResponse("AI_RATE_LIMITED", "Odczekaj 5 minut przed wymuszonym odświeżeniem.", 429, 300);
    }
    const { data: run, error: runError } = await admin.from("ai_runs").insert({ workspace_id: body.workspaceId, user_id: authData.user.id, capability: CAPABILITY, provider: provider.name, model: provider.model, prompt_version: promptVersion, schema_version: SCHEMA_VERSION, status: "running", input_chars: serialized.length }).select("id").single();
    if (runError || !run) throw new Error("run_write_failed");
    runId = run.id;
    const providerRequest = { system: buildInboxTriageSystemPrompt(), input: context, jsonSchema: inboxTriageJsonSchema, maxOutputTokens: numberEnv("AI_INBOX_TRIAGE_MAX_OUTPUT_TOKENS", 700, 300, 3000), timeoutMs: numberEnv("AI_INBOX_TRIAGE_TIMEOUT_MS", 25_000, 3_000, 60_000) };
    let providerResult;
    try { providerResult = await provider.complete(providerRequest); } catch (error) {
      if (!(error instanceof AIProviderError) || (!error.retryable && error.code !== "PROVIDER_TIMEOUT")) throw error;
      providerResult = await provider.complete(providerRequest);
    }
    let proposal;
    try { proposal = validateAndFinalizeInboxTriage(parseProviderJson(providerResult.content), context); } catch {
      const repaired = await provider.complete({ ...providerRequest, system: `${providerRequest.system} Poprzedni wynik był niepoprawny. Zwróć poprawny JSON bez komentarza.` });
      providerResult = repaired; proposal = validateAndFinalizeInboxTriage(parseProviderJson(repaired.content), context);
    }
    const cacheHours = numberEnv("AI_INBOX_TRIAGE_CACHE_HOURS", 24, 1, 168);
    const { data: saved, error: saveError } = await admin.from("ai_inbox_triage_proposals").insert({ workspace_id: body.workspaceId, created_by: authData.user.id, run_id: runId, inbox_item_id: body.inboxItemId, source_snapshot_at: context.sourceSnapshotAt, context_hash: hash, prompt_version: promptVersion, schema_version: SCHEMA_VERSION, provider: provider.name, model: provider.model, proposal_json: proposal, created_at: new Date().toISOString(), cache_expires_at: new Date(Date.now() + cacheHours * 3_600_000).toISOString() }).select("*").single();
    if (saveError || !saved) throw new Error("proposal_write_failed");
    await admin.from("ai_runs").update({ status: "succeeded", input_tokens: providerResult.usage.inputTokens, output_tokens: providerResult.usage.outputTokens, latency_ms: Date.now() - started, provider_request_id: providerResult.requestId, finished_at: new Date().toISOString() }).eq("id", runId);
    return jsonResponse(responsePayload(saved, false), 201);
  } catch (error) {
    const code = error instanceof AIProviderError ? error.code : error instanceof Error && error.message === "AI_NOT_CONFIGURED" ? "AI_NOT_CONFIGURED" : error instanceof Error && error.message === "invalid_request" ? "INVALID_REQUEST" : "INVALID_MODEL_OUTPUT";
    await failRun(admin, runId, code, Date.now() - started);
    const status = code === "AI_NOT_CONFIGURED" ? 503 : code === "PROVIDER_TIMEOUT" ? 504 : code === "PROVIDER_RATE_LIMITED" ? 429 : code === "PROVIDER_REJECTED" ? 502 : code === "INVALID_REQUEST" ? 400 : 422;
    const message = code === "INVALID_MODEL_OUTPUT" ? "Model zwrócił propozycję, której nie można bezpiecznie wyświetlić." : error instanceof Error ? error.message : "Nie udało się przygotować propozycji AI.";
    return errorResponse(code, message, status);
  }
});
