export interface AIProviderUsage { inputTokens?: number; outputTokens?: number }

export interface AIProviderResult {
  content: string;
  requestId?: string;
  usage: AIProviderUsage;
}

export interface AIProviderRequest {
  system: string;
  input: unknown;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  complete(request: AIProviderRequest): Promise<AIProviderResult>;
}

export class AIProviderError extends Error {
  constructor(public readonly code: "PROVIDER_TIMEOUT" | "PROVIDER_RATE_LIMITED" | "PROVIDER_REJECTED", message: string, public readonly retryable: boolean, public readonly status?: number) {
    super(message);
  }
}
