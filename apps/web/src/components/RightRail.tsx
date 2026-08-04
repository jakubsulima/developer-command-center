import { useState } from "react";
import { Bot, CalendarCheck, Check, Clock3, FileText, Play, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { Button, Panel } from "./ui";
import { QuickCapture } from "./QuickCapture";

export function RightRail() {
  const { state, setAIProposal, executeAIExecution } = useStore();
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const source = state.inbox.find((item) => item.status === "unprocessed");
  const target = state.projects.find((project) => project.primary) ?? state.projects[0];
  const execution = state.aiExecutions.at(-1);

  return (
    <>
      <Panel className="rail-panel ai-panel">
        <h2 className="panel-title"><Sparkles className="text-info" />AI Assistant</h2>
        {state.aiProposal === "pending" ? (
          <>
            <p>1 propozycja do sprawdzenia</p>
            {expanded && (
              <div className="proposal-preview">
                <span className="proposal-label"><Bot />Proponowana zmiana</span>
                <strong>{target ? `Dodaj pracę do projektu ${target.name}` : "Przetwórz element Inboxu"}</strong>
                <p>{source ? `„${source.content}” wymaga Twojej decyzji.` : "Sprawdź typowaną komendę przed wykonaniem."} Źródło: Inbox. Ryzyko: niskie.</p>
              </div>
            )}
            {!expanded ? <Button variant="primary" onClick={() => setExpanded(true)}>Zobacz propozycję</Button> : (
              <div className="button-row">
                <Button variant="primary" onClick={() => setAIProposal("approved")}><Check />Zatwierdź</Button>
                <Button onClick={() => setAIProposal("rejected")}><X />Odrzuć</Button>
              </div>
            )}
            <Button variant="ghost" onClick={() => setExpanded(false)}><Clock3 />Później</Button>
          </>
        ) : state.aiProposal === "approved" ? (
          <div className="resolved-proposal"><div><Check />Propozycja zatwierdzona</div>{execution?.status === "queued" && <><p>Oczekuje na wykonanie</p><Button variant="primary" onClick={() => executeAIExecution(execution.id)}><Play />Wykonaj zatwierdzoną komendę</Button></>}{execution?.status === "succeeded" && <p>Wykonanie zakończone</p>}{execution?.status === "failed" && <p>Wykonanie nieudane: {execution.error}</p>}</div>
        ) : (
          <div className="resolved-proposal"><X />Propozycja odrzucona</div>
        )}
      </Panel>

      <Panel className="rail-panel review-callout">
        <h2 className="panel-title"><CalendarCheck />Przegląd tygodnia</h2>
        <p>{state.reviewCompletedAt ? "Przegląd został ukończony. Kolejny przygotujemy za tydzień." : "Zaplanuj przegląd i skup się na tym, co ma znaczenie."}</p>
        <Button onClick={() => navigate("/review")}><FileText />Otwórz przegląd</Button>
      </Panel>
      <QuickCapture />
    </>
  );
}
