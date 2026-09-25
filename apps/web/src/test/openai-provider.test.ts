// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createOpenAIProvider, openAIStrictSchema } from "../../../../supabase/functions/_shared/ai/openai.ts";
import { configureAIProvider } from "../../../../supabase/functions/_shared/ai/config.ts";
import { AIUsageMeter, maxReservationNanoUsd } from "../../../../supabase/functions/_shared/ai/budget.ts";
import { goalPortfolioReviewJsonSchema, normalizeOpenAIGoalReview } from "../../../../supabase/functions/_shared/ai/goal-review-schema.ts";

const request = { system: "Odpowiedz po polsku.", input: { title: "Cel" }, jsonSchema: goalPortfolioReviewJsonSchema, schemaName: "goal_portfolio_review", maxOutputTokens: 500, timeoutMs: 1000 };

describe("OpenAI provider", () => {
  it("wysyła prywatny Responses request ze ścisłym schematem i rozlicza tokeny", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "resp_1", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "{\"ok\":true}" }] }],
      usage: { input_tokens: 321, output_tokens: 45 },
    }), { status: 200 }));
    const provider = createOpenAIProvider({ apiKey: "test-key", model: "gpt-6-luna", fetchImpl });
    const result = await provider.complete(request);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { store: boolean; input: Array<{ content: string }>; text: { format: { strict: boolean; schema: { properties: { schemaVersion: { type: string }; recommendations: { items: { required: string[]; properties: { draftAction: { type: string[] } } } } } } } } };
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
    expect(body.store).toBe(false);
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.schema.properties.recommendations.items.required).toContain("draftAction");
    expect(body.text.format.schema.properties.recommendations.items.properties.draftAction.type).toEqual(["object", "null"]);
    expect(body.text.format.schema.properties.schemaVersion.type).toBe("integer");
    expect(JSON.stringify(body.text.format.schema)).not.toContain("uniqueItems");
    expect(body.input[1].content).toContain('"context"');
    expect(result).toEqual({ content: '{"ok":true}', requestId: "resp_1", usage: { inputTokens: 321, outputTokens: 45 } });
  });

  it("nie przyjmuje odmowy, niepełnego wyniku ani 429 jako poprawnej odpowiedzi", async () => {
    const incomplete = createOpenAIProvider({ apiKey: "test-key", model: "gpt-6-luna", fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "incomplete", output: [] }), { status: 200 })) });
    await expect(incomplete.complete(request)).rejects.toMatchObject({ code: "PROVIDER_REJECTED" });
    const refusal = createOpenAIProvider({ apiKey: "test-key", model: "gpt-6-luna", fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] }), { status: 200 })) });
    await expect(refusal.complete(request)).rejects.toMatchObject({ code: "PROVIDER_REJECTED" });
    const rate = createOpenAIProvider({ apiKey: "test-key", model: "gpt-6-luna", fetchImpl: vi.fn().mockResolvedValue(new Response("provider detail", { status: 429 })) });
    await expect(rate.complete(request)).rejects.toMatchObject({ code: "PROVIDER_RATE_LIMITED", retryable: true });
  });

  it("wymaga cennika przy innym modelu i rezerwuje dwie próby", async () => {
    const env = (name: string) => ({ AI_PROVIDER: "openai", OPENAI_API_KEY: "test-key" })[name as "AI_PROVIDER" | "OPENAI_API_KEY"];
    const config = configureAIProvider("goal_portfolio_review", env);
    expect(config.provider.model).toBe("gpt-6-luna");
    expect(config.inputPriceNanoPerToken).toBe(100);
    const reserved = maxReservationNanoUsd(config, request);
    const meter = new AIUsageMeter({ ...config, provider: { name: "openai", model: "gpt-6-luna", complete: vi.fn().mockRejectedValue(new Error("network")) } }, reserved);
    const result = await meter.complete(request).catch(() => undefined);
    expect(result).toBeUndefined();
    expect(meter.attempts).toBe(1);
    expect(meter.settlement()).toEqual({ accountedNanoUsd: reserved, costIsEstimate: true });
    expect(() => configureAIProvider("goal_portfolio_review", (name) => name === "OPENAI_GOAL_REVIEW_MODEL" ? "unknown" : env(name))).toThrow("AI_NOT_CONFIGURED");
  });

  it("usuwa tylko puste draftAction po strict JSON", () => {
    const schema = openAIStrictSchema(goalPortfolioReviewJsonSchema) as Record<string, unknown>;
    expect(schema.additionalProperties).toBe(false);
    expect(normalizeOpenAIGoalReview({ recommendations: [{ title: "x", draftAction: null }] })).toEqual({ recommendations: [{ title: "x" }] });
  });
});
