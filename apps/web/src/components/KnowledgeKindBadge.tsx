import { CircleCheck, FileText, GitBranch, Library, Search } from "lucide-react";
import type { KnowledgeKind } from "../domain/types";
import { knowledgeKindLabels } from "../domain/labels";

const icons = { note: FileText, resource: Library, decision: GitBranch, artifact: CircleCheck, investigation: Search } as const;

export function KnowledgeKindBadge({ kind, compact = false }: { kind: KnowledgeKind; compact?: boolean }) {
  const Icon = icons[kind];
  return <span className={`knowledge-kind-badge knowledge-kind-${kind}${compact ? " knowledge-kind-compact" : ""}`} aria-label={`Typ Wiedzy: ${knowledgeKindLabels[kind]}`}><Icon aria-hidden="true" /><span>{knowledgeKindLabels[kind]}</span></span>;
}
