import type { ReactNode, KeyboardEvent } from "react";

export function KnowledgeNoteFields({
  idPrefix,
  content,
  onContentChange,
  title,
  onTitleChange,
  context,
  children,
  disabled = false
}: {
  idPrefix: string;
  content: string;
  onContentChange: (value: string) => void;
  title: string;
  onTitleChange: (value: string) => void;
  context: string;
  children?: ReactNode;
  disabled?: boolean;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return <div className="knowledge-note-fields">
    <label className="knowledge-note-content-label" htmlFor={`${idPrefix}-content`}>
      <span className="sr-only">Treść notatki</span>
      <textarea id={`${idPrefix}-content`} autoFocus required rows={5} placeholder="Zapisz myśl…" value={content} disabled={disabled} onChange={(event) => onContentChange(event.target.value)} onKeyDown={handleKeyDown} />
    </label>
    <p className="knowledge-note-context">{context}</p>
    <details className="knowledge-note-more">
      <summary>Więcej <span className="optional-label">opcjonalnie</span></summary>
      <div className="knowledge-note-more-fields">
        <label className="field-label" htmlFor={`${idPrefix}-title`}>Tytuł <span className="optional-label">opcjonalnie</span></label>
        <input id={`${idPrefix}-title`} value={title} disabled={disabled} onChange={(event) => onTitleChange(event.target.value)} />
        {children}
      </div>
    </details>
  </div>;
}
