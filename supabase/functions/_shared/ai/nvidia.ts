import { AIProviderError, type AIProvider, type AIProviderRequest, type AIProviderResult } from "./provider.ts";

interface NvidiaOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  authMode: "bearer" | "api-key";
  structuredMode: "guided_json" | "prompt";
  fetchImpl?: typeof fetch;
}

function trimBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function createNvidiaProvider(options: NvidiaOptions): AIProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    name: "nvidia",
    model: options.model,
    async complete(request: AIProviderRequest): Promise<AIProviderResult> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
      try {
        const body: Record<string, unknown> = {
          model: options.model,
          // Reasoning traces share max_tokens with the final answer. Disable
          // them for this synchronous, schema-constrained transformation.
          reasoning_effort: "none",
          temperature: 0.95,
          top_p: 1,
          max_tokens: request.maxOutputTokens,
          stream: false,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: JSON.stringify({ context: request.input }) },
          ],
        };
        // NVIDIA NIM accepts guided generation through the `nvext` extension.
        // In prompt mode the same schema is embedded by goal-review-prompt.ts.
        if (options.structuredMode === "guided_json") body.nvext = { guided_json: request.jsonSchema };
        const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
        if (options.authMode === "api-key") headers["x-api-key"] = options.apiKey;
        else headers.authorization = `Bearer ${options.apiKey}`;
        const response = await fetchImpl(`${trimBaseUrl(options.baseUrl)}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
        if (!response.ok) {
          if (response.status === 429) throw new AIProviderError("PROVIDER_RATE_LIMITED", "Dostawca AI ograniczył liczbę żądań.", true, response.status);
          throw new AIProviderError("PROVIDER_REJECTED", "Dostawca AI odrzucił żądanie.", response.status >= 500, response.status);
        }
        const payload = await response.json() as { id?: string; choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        const content = payload.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) throw new AIProviderError("PROVIDER_REJECTED", "Dostawca AI zwrócił pustą odpowiedź.", false);
        return { content, requestId: payload.id, usage: { inputTokens: payload.usage?.prompt_tokens, outputTokens: payload.usage?.completion_tokens } };
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
