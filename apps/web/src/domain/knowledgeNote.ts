export interface PreparedKnowledgeNote {
  title: string;
  detail: string;
}

const AUTO_TITLE_CODE_POINTS = 100;

export function prepareKnowledgeNote(content: string, optionalTitle = ""): PreparedKnowledgeNote {
  const detail = content.trim();
  if (!detail) throw new Error("knowledge_note_content_required");

  const manualTitle = optionalTitle.trim();
  if (manualTitle) return { title: manualTitle, detail };

  const firstLine = detail.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const normalizedTitle = firstLine.trim().replace(/\s+/g, " ");
  const codePoints = Array.from(normalizedTitle);
  const title = codePoints.length > AUTO_TITLE_CODE_POINTS
    ? `${codePoints.slice(0, AUTO_TITLE_CODE_POINTS - 1).join("")}…`
    : normalizedTitle;
  if (!title) throw new Error("knowledge_note_content_required");
  return { title, detail };
}
