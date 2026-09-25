import type { AIProviderRequest, AIProviderResult } from "./provider.ts";
import type { ConfiguredAIProvider } from "./config.ts";

interface AIAdminClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export class AIBudgetError extends Error {
  constructor(public readonly code: "AI_RATE_LIMITED" | "AI_BUDGET_EXCEEDED" | "AI_NOT_CONFIGURED", message: string) { super(message); }
}

export function budgetNanoUsd(value: string | undefined, fallbackUsd: number): number {
  const dollars = value === undefined || value === "" ? fallbackUsd : Number(value);
  if (!Number.isFinite(dollars) || dollars <= 0 || dollars > 10000) throw new AIBudgetError("AI_NOT_CONFIGURED", "Limit kosztu AI jest nieprawidłowy.");
  return Math.floor(dollars * 1_000_000_000);
}

export function maxReservationNanoUsd(config: ConfiguredAIProvider, request: AIProviderRequest, maxAttempts = 2): number {
  const inputBytes = new TextEncoder().encode(JSON.stringify({ system: request.system, context: request.input, schema: request.jsonSchema })).length;
  const conservativeInputTokens = inputBytes + 1000;
  const perAttempt = conservativeInputTokens * config.inputPriceNanoPerToken + request.maxOutputTokens * config.outputPriceNanoPerToken;
  const amount = perAttempt * maxAttempts;
  if (!Number.isSafeInteger(amount) || amount < 0) throw new AIBudgetError("AI_NOT_CONFIGURED", "Nie można wyliczyć limitu kosztu AI.");
  return amount;
}

export async function reserveAIRun(admin: AIAdminClient, args: {
  workspaceId: string; userId: string; capability: string; config: ConfiguredAIProvider;
  promptVersion: number; schemaVersion: number; inputChars: number; reservedNanoUsd: number;
  dailyLimit: number; forceRefresh: boolean; dailyBudgetNanoUsd: number; monthlyBudgetNanoUsd: number;
}): Promise<string> {
  const { data, error } = await admin.rpc("reserve_ai_run", {
    target_workspace_id: args.workspaceId,
    target_user_id: args.userId,
    target_capability: args.capability,
    target_provider: args.config.provider.name,
    target_model: args.config.provider.model,
    target_prompt_version: args.promptVersion,
    target_schema_version: args.schemaVersion,
    target_input_chars: args.inputChars,
    target_reserved_nano_usd: args.reservedNanoUsd,
    target_input_price_nano_per_token: args.config.inputPriceNanoPerToken,
    target_output_price_nano_per_token: args.config.outputPriceNanoPerToken,
    target_daily_limit: args.dailyLimit,
    target_force_refresh: args.forceRefresh,
    target_daily_budget_nano_usd: args.dailyBudgetNanoUsd,
    target_monthly_budget_nano_usd: args.monthlyBudgetNanoUsd,
  });
  if (error) {
    if (error.message.includes("ai_budget_exceeded")) throw new AIBudgetError("AI_BUDGET_EXCEEDED", "Wyczerpano budżet AI.");
    if (error.message.includes("ai_refresh_cooldown")) throw new AIBudgetError("AI_RATE_LIMITED", "Odczekaj 5 minut przed wymuszonym odświeżeniem.");
    if (error.message.includes("ai_daily_limit")) throw new AIBudgetError("AI_RATE_LIMITED", "Wykorzystano dzienny limit analiz AI.");
    throw new Error("ai_reservation_failed");
  }
  if (typeof data !== "string") throw new Error("ai_reservation_failed");
  return data;
}

export class AIUsageMeter {
  attempts = 0;
  inputTokens = 0;
  outputTokens = 0;
  requestId?: string;
  uncertain = false;

  constructor(private readonly config: ConfiguredAIProvider, private readonly reservedNanoUsd: number) {}

  async complete(request: AIProviderRequest): Promise<AIProviderResult> {
    if (this.attempts >= 2) throw new Error("ai_attempt_limit");
    this.attempts++;
    try {
      const result = await this.config.provider.complete(request);
      this.requestId = result.requestId;
      if (!Number.isSafeInteger(result.usage.inputTokens) || !Number.isSafeInteger(result.usage.outputTokens)
          || result.usage.inputTokens! < 0 || result.usage.outputTokens! < 0) this.uncertain = true;
      else {
        this.inputTokens += result.usage.inputTokens!;
        this.outputTokens += result.usage.outputTokens!;
      }
      return result;
    } catch (error) {
      this.uncertain = true;
      throw error;
    }
  }

  settlement() {
    const measured = this.inputTokens * this.config.inputPriceNanoPerToken + this.outputTokens * this.config.outputPriceNanoPerToken;
    const estimate = this.uncertain || measured > this.reservedNanoUsd;
    return { accountedNanoUsd: estimate ? this.reservedNanoUsd : measured, costIsEstimate: estimate };
  }
}

export async function finishAIRun(admin: AIAdminClient, args: {
  runId: string; status: "succeeded" | "failed"; errorCode?: string; meter: AIUsageMeter; latencyMs: number;
}) {
  const cost = args.meter.settlement();
  const { error } = await admin.rpc("finish_ai_run", {
    target_run_id: args.runId,
    target_status: args.status,
    target_error_code: args.errorCode ?? null,
    target_input_tokens: args.meter.inputTokens,
    target_output_tokens: args.meter.outputTokens,
    target_accounted_nano_usd: cost.accountedNanoUsd,
    target_cost_is_estimate: cost.costIsEstimate,
    target_attempts: args.meter.attempts,
    target_provider_request_id: args.meter.requestId ?? null,
    target_latency_ms: args.latencyMs,
  });
  if (error) throw new Error("ai_settlement_failed");
}
