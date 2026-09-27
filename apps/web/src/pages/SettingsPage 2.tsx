import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Button, Panel } from "../components/ui";
import { DEFAULT_AI_REVIEW_SETTINGS, type AIReviewCacheHours, type AIReviewWindowDays } from "../domain/aiReviewSettings";

export function SettingsPage() {
  const { state, mode, saveAIReviewSettings } = useStore();
  const savedSettings = state.aiReviewSettings ?? DEFAULT_AI_REVIEW_SETTINGS;
  const [windowDays, setWindowDays] = useState<AIReviewWindowDays>(savedSettings.windowDays);
  const [cacheHours, setCacheHours] = useState<AIReviewCacheHours>(savedSettings.cacheHours);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setWindowDays(savedSettings.windowDays);
    setCacheHours(savedSettings.cacheHours);
  }, [savedSettings.windowDays, savedSettings.cacheHours]);

  const dirty = windowDays !== savedSettings.windowDays || cacheHours !== savedSettings.cacheHours;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !dirty) return;
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await saveAIReviewSettings({ windowDays, cacheHours });
      setSuccess(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać ustawień.");
    } finally {
      setSaving(false);
    }
  };

  return <AppShell>
    <PageHeading title="Ustawienia" eyebrow="Preferencje Workspace" />
    <p className="page-lead">Zdecyduj, jaki okres danych obejmuje Przegląd Celów z AI i jak długo można ponownie użyć zapisanego wyniku.</p>
    <Panel className="ai-review-settings-panel">
      <div className="section-heading"><div><span className="section-kicker">Przegląd Celów z AI</span><h2>Zakres i ponowne użycie wyniku</h2></div></div>
      <form onSubmit={(event) => void submit(event)}>
        <div className="ai-review-settings-fields">
          <label className="ai-review-setting-field" htmlFor="ai-review-window-days">
            <span><strong>Zakres danych analizowanych przez AI</strong><small>Dłuższy zakres może zwiększyć wielkość żądania.</small></span>
            <select id="ai-review-window-days" aria-label="Zakres danych analizowanych przez AI" value={windowDays} onChange={(event) => { setWindowDays(Number(event.target.value) as AIReviewWindowDays); setSuccess(false); }} disabled={saving}>
              <option value={7}>Ostatnie 7 dni</option><option value={14}>Ostatnie 14 dni</option><option value={28}>Ostatnie 28 dni</option>
            </select>
          </label>
          <label className="ai-review-setting-field" htmlFor="ai-review-cache-hours">
            <span><strong>Maksymalny czas ponownego użycia wyniku</strong><small>Krótszy czas może zwiększyć liczbę płatnych generowań.</small></span>
            <select id="ai-review-cache-hours" aria-label="Maksymalny czas ponownego użycia wyniku" value={cacheHours} onChange={(event) => { setCacheHours(Number(event.target.value) as AIReviewCacheHours); setSuccess(false); }} disabled={saving}>
              <option value={24}>1 dzień</option><option value={72}>3 dni</option><option value={168}>7 dni</option>
            </select>
          </label>
        </div>
        <p className="ai-review-settings-note">Zmiana zakresu oznacza poprzedni wynik jako nieaktualny, ale nie uruchamia analizy. Skrócenie czasu cache działa również na zapisany wynik. Wydłużenie nie przedłuża jego pierwotnego terminu ważności.</p>
        <p className="ai-review-settings-note">{mode === "demo" ? "W trybie demo ustawienia są zapisywane lokalnie w tej przeglądarce." : "Ustawienia są wspólne dla urządzeń w tym Workspace."}</p>
        {error ? <p className="inline-mutation-error" role="alert">{error}</p> : null}
        {success ? <p className="ai-review-settings-success" role="status">Ustawienia zostały zapisane.</p> : null}
        <div className="ai-review-settings-actions"><Button type="submit" disabled={saving || !dirty} loading={saving}>Zapisz ustawienia</Button><Link to="/review?tab=ai">Wróć do Przeglądu AI</Link></div>
      </form>
    </Panel>
  </AppShell>;
}
