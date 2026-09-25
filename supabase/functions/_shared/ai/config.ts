import { createNvidiaProvider } from "./nvidia.ts";
import { createOpenAIProvider } from "./openai.ts";
import type { AIProvider } from "./provider.ts";

export type AICapability = "goal_portfolio_review" | "inbox_triage";
export interface ConfiguredAIProvider {
  provider: AIProvider;
  inputPriceNanoPerToken: number;
  outputPriceNanoPerToken: number;
  structuredMode: "guided_json" | "prompt";
}

export interface AIProviderIdentity {
  provider: "openai" | "nvidia";
  model: string;
  structuredMode: "guided_json" | "prompt";
}

/** Identifies a model without requiring a provider key or creating a client. */
export function describeAIProvider(capability: AICapability, env: (name: string) => string | undefined): AIProviderIdentity | undefined {
  const name = env("AI_PROVIDER") ?? "nvidia";
  if (name === "openai") {
    const prefix = capability === "goal_portfolio_review" ? "OPENAI_GOAL_REVIEW" : "OPENAI_INBOX_TRIAGE";
    const model = env(`${prefix}_MODEL`) ?? "gpt-6-luna";
    return model ? { provider: "openai", model, structuredMode: "guided_json" } : undefined;
  }
  if (name === "nvidia") {
    const model = env("NVIDIA_MODEL");
    if (!model) return undefined;
    return { provider: "nvidia", model, structuredMode: env("NVIDIA_STRUCTURED_MODE") === "prompt" ? "prompt" : "guided_json" };
  }
  return undefined;
}

function priceFromEnv(value: string | undefined, fallback?: number): number {
  const price = value === undefined || value === "" ? fallback : Number(value);
  if (price === undefined || !Number.isFinite(price) || price < 0 || price > 1000) throw new Error("AI_NOT_CONFIGURED");
  return Math.ceil(price * 1000); // USD/1M tokens -> nano-USD/token
}

export function configureAIProvider(capability: AICapability, env: (name: string) => string | undefined): ConfiguredAIProvider {
  const identity = describeAIProvider(capability, env);
  if (!identity) throw new Error("AI_NOT_CONFIGURED");
  if (identity.provider === "openai") {
    const apiKey = env("OPENAI_API_KEY");
    const prefix = capability === "goal_portfolio_review" ? "OPENAI_GOAL_REVIEW" : "OPENAI_INBOX_TRIAGE";
    const model = identity.model;
    if (!apiKey) throw new Error("AI_NOT_CONFIGURED");
    const defaults: Record<string, [number, number]> = { "gpt-6-luna": [0.1, 0.5], "gpt-6-sol": [2, 10] };
    return {
      provider: createOpenAIProvider({ apiKey, model }),
      inputPriceNanoPerToken: priceFromEnv(env(`${prefix}_INPUT_USD_PER_MTOK`), defaults[model]?.[0]),
      outputPriceNanoPerToken: priceFromEnv(env(`${prefix}_OUTPUT_USD_PER_MTOK`), defaults[model]?.[1]),
      structuredMode: "guided_json",
    };
  }
  if (identity.provider === "nvidia") {
    const apiKey = env("NVIDIA_API_KEY"); const model = identity.model;
    if (!apiKey) throw new Error("AI_NOT_CONFIGURED");
    const structuredMode = identity.structuredMode;
    return {
      provider: createNvidiaProvider({ baseUrl: env("NVIDIA_BASE_URL") ?? "https://integrate.api.nvidia.com/v1", apiKey, model, authMode: env("NVIDIA_AUTH_MODE") === "api-key" ? "api-key" : "bearer", structuredMode }),
      inputPriceNanoPerToken: priceFromEnv(env("NVIDIA_INPUT_USD_PER_MTOK"), 0),
      outputPriceNanoPerToken: priceFromEnv(env("NVIDIA_OUTPUT_USD_PER_MTOK"), 0),
      structuredMode,
    };
  }
  throw new Error("AI_NOT_CONFIGURED");
}
