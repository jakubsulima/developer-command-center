import { describe, expect, it } from "vitest";
import { prepareKnowledgeNote } from "./knowledgeNote";

describe("prepareKnowledgeNote", () => {
  it("uses the first non-empty line as its title and preserves the full note", () => {
    expect(prepareKnowledgeNote("  \n  Myśl pierwsza\nDruga linia  ")).toEqual({
      title: "Myśl pierwsza",
      detail: "Myśl pierwsza\nDruga linia"
    });
  });

  it("keeps a manual title and counts Unicode code points when shortening", () => {
    expect(prepareKnowledgeNote("🙂".repeat(120), "  Mój tytuł  ")).toEqual({ title: "Mój tytuł", detail: "🙂".repeat(120) });
    const prepared = prepareKnowledgeNote(`  ${"🙂".repeat(120)}  `);
    expect(Array.from(prepared.title)).toHaveLength(100);
    expect(prepared.title.endsWith("…")).toBe(true);
    expect(prepared.detail).toBe("🙂".repeat(120));
  });

  it("rejects blank content after trimming", () => {
    expect(() => prepareKnowledgeNote(" \n\t ")).toThrow("knowledge_note_content_required");
  });
});
