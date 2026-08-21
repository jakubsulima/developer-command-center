export type QuickAddMode = "action" | "goal" | "knowledge";

const commands: Record<string, QuickAddMode> = {
  zadanie: "action",
  dzialanie: "action",
  działanie: "action",
  task: "action",
  cel: "goal",
  goal: "goal",
  wiedza: "knowledge",
  notatka: "knowledge",
  knowledge: "knowledge",
  inbox: "knowledge"
};

export function parseQuickAddCommand(value: string): { mode: QuickAddMode; content: string } | undefined {
  const match = value.match(/^\/(\S+)\s+/u);
  if (!match) return undefined;
  const mode = commands[match[1]!.toLocaleLowerCase("pl")];
  if (!mode) return undefined;
  return { mode, content: value.slice(match[0].length) };
}
