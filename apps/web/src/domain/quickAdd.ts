export type QuickAddMode = "action" | "goal" | "project" | "routine" | "inbox" | "library" | "knowledge";

/** `knowledge` is retained only for old persisted drafts and old callers. */
export const quickAddModes = ["action", "goal", "project", "routine", "inbox", "library"] as const satisfies readonly QuickAddMode[];

const commands: Record<string, QuickAddMode> = {
  zadanie: "action",
  dzialanie: "action",
  działanie: "action",
  task: "action",
  cel: "goal",
  goal: "goal",
  projekt: "project",
  project: "project",
  rutyna: "routine",
  routine: "routine",
  biblioteka: "library",
  library: "library",
  wiedza: "library",
  notatka: "library",
  materiał: "library",
  material: "library",
  decyzja: "library",
  decision: "library",
  knowledge: "inbox",
  inbox: "inbox",
  skrzynka: "inbox"
};

export function normalizeQuickAddMode(mode: QuickAddMode): Exclude<QuickAddMode, "knowledge"> {
  return mode === "knowledge" ? "inbox" : mode;
}

export function parseQuickAddCommand(value: string): { mode: QuickAddMode; content: string } | undefined {
  const match = value.match(/^\/(\S+)\s+/u);
  if (!match) return undefined;
  const mode = commands[match[1]!.toLocaleLowerCase("pl")];
  if (!mode) return undefined;
  return { mode: normalizeQuickAddMode(mode), content: value.slice(match[0].length) };
}

export function splitQuickAddContent(content: string) {
  const [firstLine = "", ...rest] = content.split("\n");
  return { title: firstLine.trim(), detail: rest.join("\n").trim() };
}
