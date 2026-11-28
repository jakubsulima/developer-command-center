import { AIReviewSettingsForm } from "../components/AIReviewSettingsForm";
import { IPhoneCaptureSetup } from "../components/IPhoneCaptureSetup";
import { ReturnReminderSettings } from "../components/ReturnReminderSettings";
import { ChevronDown, Smartphone, Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Panel } from "../components/ui";
import { DEFAULT_AI_REVIEW_SETTINGS } from "../domain/aiReviewSettings";

export function SettingsPage() {
  const { hash } = useLocation();
  const { state } = useStore();
  const savedSettings = state.aiReviewSettings ?? DEFAULT_AI_REVIEW_SETTINGS;
  return <AppShell addAction={{ label: "Dodaj", ariaLabel: "Dodaj" }}>
    <PageHeading title="Ustawienia" eyebrow="Preferencje przestrzeni pracy" />
    <div className="settings-sections">
    <details className="settings-section" open={hash === "#quick-capture"}><summary><Smartphone /><span><strong>Szybki zapis</strong><small>Skrót na iPhonie i dostęp do zapisu jednym dotknięciem</small></span><ChevronDown /></summary><div className="settings-section-content"><IPhoneCaptureSetup /></div></details>
    <ReturnReminderSettings />
    <details id="ai-review" className="settings-section" open={hash === "#ai-review"}><summary><Sparkles /><span><strong>Przegląd z AI</strong><small>Ostatnie {savedSettings.windowDays} dni · wynik zachowany przez {savedSettings.cacheHours / 24} dni</small></span><ChevronDown /></summary><div className="settings-section-content">
    <Panel className="ai-review-settings-panel">
      <div className="section-heading"><div><span className="section-kicker">Przegląd grup działań z AI</span><h2>Zakres i ponowne użycie wyniku</h2></div></div>
      <AIReviewSettingsForm footer={<Link to="/ai">Wróć do Przeglądu AI</Link>} />
    </Panel></div></details>
    </div>
  </AppShell>;
}
