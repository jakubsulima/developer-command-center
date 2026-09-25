import { AIProviderError, type AIProvider, type AIProviderRequest, type AIProviderResult } from "./provider.ts";

interface OpenAIOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}

// OpenAI's strict subset requires every property and does not need the
// validator's length, pattern, or uniqueness constraints. Those remain
// enforced after generation by the domain validators.
export function openAIStrictSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(openAIStrictSchema);
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(source)) {
    if (["uniqueItems", "minLength", "maxLength", "minItems", "maxItems", "pattern"].includes(key)) continue;
    if (key === "const") { result.enum = [nested]; continue; }
    result[key] = openAIStrictSchema(nested);
  }
  if (result.type === undefined && Array.isArray(result.enum)) {
    const types = [...new Set(result.enum.map((item: unknown) => item === null ? "null" : typeof item === "number" ? Number.isInteger(item) ? "integer" : "number" : typeof item))];
    result.type = types.length === 1 ? types[0] : types;
  }
  if (source.type === "object") {
    const properties = (result.properties ?? {}) as Record<string, unknown>;
    result.additionalProperties = false;
    result.required = Object.keys(properties);
    if (Object.hasOwn(properties, "draftAction")) {
      const draft = properties.draftAction as Record<string, unknown>;
      properties.draftAction = { ...draft, type: ["object", "null"] };
    }
  }
  return result;
}

export function createOpenAIProvider(options: OpenAIOptions): AIProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    name: "openai",
    model: options.model,
    async complete(request: AIProviderRequest): Promise<AIProviderResult> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
      try {
        const response = await fetchImpl("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            model: options.model,
            store: false,
            reasoning: { effort: "low" },
            max_output_tokens: request.maxOutputTokens,
            input: [
              { role: "system", content: request.system },
              { role: "user", content: JSON.stringify({ context: request.input }) },
            ],
            text: { format: { type: "json_schema", name: request.schemaName ?? "ai_result", strict: true, schema: openAIStrictSchema(request.jsonSchema) } },
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 429) throw new AIProviderError("PROVIDER_RATE_LIMITED", "Dostawca AI ograniczył liczbę żądań.", true, 429);
          throw new AIProviderError("PROVIDER_REJECTED", "Dostawca AI odrzucił żądanie.", response.status >= 500, response.status);
        }
        const payload = await response.json() as {
          id?: string;
          status?: string;
          output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        if (payload.status !== "completed") throw new AIProviderError("PROVIDER_REJECTED", "Model nie zakończył odpowiedzi.", false);
        const content = payload.output?.flatMap((item) => item.type === "message" ? item.content ?? [] : [])
          .filter((item) => item.type === "output_text" && typeof item.text === "string")
          .map((item) => item.text).join("");
        if (!content?.trim()) throw new AIProviderError("PROVIDER_REJECTED", "Model nie zwrócił odpowiedzi.", false);
        return { content, requestId: payload.id, usage: { inputTokens: payload.usage?.input_tokens, outputTokens: payload.usage?.output_tokens } };
      } catch (error) {
        if (error instanceof AIProviderError) throw error;
        if (error instanceof DOMException && error.name === "AbortError") throw new AIProviderError("PROVIDER_TIMEOUT", "Przekroczono czas oczekiwania na dostawcę AI.", false);
        throw new AIProviderError("PROVIDER_REJECTED", "Nie udało się połączyć z dostawcą AI.", true);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
