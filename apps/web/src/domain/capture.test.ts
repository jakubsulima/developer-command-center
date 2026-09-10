import { describe, expect, it } from "vitest";
import { normalizeCapture } from "./capture";

describe("normalizeCapture", () => {
  it("preserves raw text and automatically recognizes safe web URLs", () => {
    expect(normalizeCapture("  notatka  ")).toEqual({ content: "  notatka  ", kind: "text" });
    expect(normalizeCapture(" https://www.example.com/path ")).toEqual({ content: " https://www.example.com/path ", kind: "link", previewDomain: "example.com" });
  });
  it("rejects invalid links and asset-less capture kinds", () => {
    expect(() => normalizeCapture("javascript:alert(1)", "link")).toThrow("invalid_capture_url");
    expect(() => normalizeCapture("nagranie", "voice")).toThrow("capture_asset_required");
    expect(() => normalizeCapture("plik", "file")).toThrow("capture_asset_required");
  });
});
