import { describe, expect, it } from "vitest";
import { emptyDraft, migrateQuickAddDraft, type QuickAddDraft } from "./creationDraft";

describe("identyfikatory dawnych szkiców tworzenia", () => {
  const initial = { ...emptyDraft, knowledgeIdempotencyKey: "initial" };
  const legacy: QuickAddDraft = { ...emptyDraft, schemaVersion: 2, title: "Tytuł", detail: "Cała treść\ni druga linia", content: "Tytuł\nCała treść\ni druga linia", context: "goal:goal", scheduledFor: "2026-11-05", pinnedToToday: true, knowledgeIdempotencyKey: "old-shared-key" };

  it("rozdziela kolidujące klucze niewysłanych szkiców v2 bez utraty treści i opcji", () => {
    const action = migrateQuickAddDraft(legacy, initial)!;
    const note = migrateQuickAddDraft({ ...legacy, mode: "library", title: "", detail: legacy.content }, initial)!;
    expect(action).toMatchObject({ ...legacy, schemaVersion: 3, knowledgeIdempotencyKey: expect.any(String) });
    expect(action.knowledgeIdempotencyKey).not.toBe(legacy.knowledgeIdempotencyKey);
    expect(note.knowledgeIdempotencyKey).not.toBe(action.knowledgeIdempotencyKey);
    expect(note.detail).toBe(legacy.content);
    // Once migrated and persisted, reopening does not rotate the key again.
    expect(migrateQuickAddDraft(action, initial)).toEqual(action);
  });

  it.each([
    { attempted: true },
    { receipt: { id: "saved", url: "/actions/saved", message: "Zapisano" } }
  ])("zachowuje klucz operacji wysłanej lub potwierdzonej: %j", (metadata) => {
    expect(migrateQuickAddDraft({ ...legacy, ...metadata }, initial)).toMatchObject({ ...metadata, knowledgeIdempotencyKey: legacy.knowledgeIdempotencyKey, detail: legacy.detail });
  });

  it("starsza notatka bez informacji o próbie zachowuje identyfikator do odzyskania wyniku", () => {
    expect(migrateQuickAddDraft({ content: "Niepewna notatka", kind: "note", idempotencyKey: "legacy-note-key" }, { ...initial, mode: "library" }))
      .toMatchObject({ detail: "Niepewna notatka", knowledgeIdempotencyKey: "legacy-note-key" });
  });
});
