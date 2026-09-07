import { CalendarDays, Check, Edit3, Inbox, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import type { AIInboxTriageFeedbackRating, AIInboxTriageProposal } from "../domain/aiInboxTriage";
import type { AppState } from "../domain/types";
import { Badge, Button } from "./ui";
import { knowledgeKindLabels } from "../domain/labels";

const decisionLabels = { goal: "Cel", action: "Działanie", knowledge: "Wiedza", keep_inbox: "Pozostaw w Skrzynce" } as const;
const confidenceLabels = { low: "niska pewność", medium: "średnia pewność", high: "wysoka pewność" } as const;

export function AIInboxTriagePreview({ proposal, state, onApprove, onEdit, onReject, onFeedback }: {
  proposal: AIInboxTriageProposal;
  state: AppState;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
  onFeedback: (rating: AIInboxTriageFeedbackRating) => void;
}) {
  const content = proposal.proposal;
  const linked = content.linkedType === "goal"
    ? state.goals.find((goal) => goal.id === content.linkedId)?.title
    : content.linkedType === "project" ? state.projects.find((project) => project.id === content.linkedId)?.name : undefined;
  return <div className="ai-inbox-preview">
    <div className="ai-inbox-preview-kicker"><Sparkles />Propozycja AI <Badge tone={content.confidence === "high" ? "success" : content.confidence === "medium" ? "warning" : "neutral"}>{confidenceLabels[content.confidence]}</Badge></div>
    <div className="ai-inbox-preview-result"><span><small>Proponowany rezultat</small><strong>{decisionLabels[content.decision]}</strong></span>{content.decision === "keep_inbox" ? <Inbox /> : <Check />}</div>
    <p className="ai-inbox-preview-reason">{content.reason}</p>
    {content.title ? <div className="ai-inbox-preview-field"><small>Tytuł</small><strong>{content.title}</strong></div> : null}
    {content.detail ? <div className="ai-inbox-preview-field"><small>{content.decision === "goal" ? "Oczekiwany rezultat" : "Treść / opis"}</small><p>{content.detail}</p></div> : null}
    {content.knowledgeKind ? <div className="ai-inbox-preview-field"><small>Rodzaj Wiedzy</small><strong>{knowledgeKindLabels[content.knowledgeKind]}</strong></div> : null}
    {linked ? <div className="ai-inbox-preview-field"><small>Powiązanie</small><strong>{content.linkedType === "goal" ? "Cel" : "Projekt"}: {linked}</strong></div> : null}
    {content.targetDate ? <div className="ai-inbox-preview-field"><small><CalendarDays />Termin</small><strong>{content.targetDate}</strong></div> : null}
    <p className="ai-inbox-preview-safety">Nic nie zostanie zapisane bez Twojego zatwierdzenia.</p>
    <div className="modal-actions ai-inbox-preview-actions"><Button variant="ghost" onClick={onReject}><X />Odrzuć</Button>{content.decision === "keep_inbox" ? <Button onClick={onApprove}>Pozostaw w Skrzynce</Button> : <><Button onClick={onEdit}><Edit3 />Edytuj</Button><Button variant="primary" onClick={onApprove}><Check />Zatwierdź</Button></>}</div>
    <div className="ai-feedback" role="group" aria-label="Oceń propozycję AI"><span>Pomocna?</span><button type="button" aria-label="Przydatna" onClick={() => onFeedback("helpful")}><ThumbsUp /></button><button type="button" aria-label="Nieprzydatna" onClick={() => onFeedback("not_helpful")}><ThumbsDown /></button></div>
  </div>;
}
