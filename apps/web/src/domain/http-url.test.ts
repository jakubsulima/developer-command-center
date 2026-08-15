import { describe, expect, it } from "vitest";
import { normalizeHttpUrl, safeHttpUrl } from "./http-url";

describe("HTTP URL boundary", () => {
  it("preserves valid HTTP(S) links", () => {
    expect(normalizeHttpUrl(" https://example.com/docs ")).toBe("https://example.com/docs");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com");
  });

  it.each(["javascript:alert(1)", "data:text/html,unsafe", "file:///tmp/private", "vscode://settings"])("rejects the unsafe scheme %s", (value) => {
    expect(() => normalizeHttpUrl(value)).toThrow("invalid_knowledge_source_url");
    expect(safeHttpUrl(value)).toBeUndefined();
  });
});
