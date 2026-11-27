import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { useStore } from "../app/useStore";
import { DEFAULT_AI_REVIEW_SETTINGS, type AIReviewCacheHours, type AIReviewWindowDays } from "../domain/aiReviewSettings";
import { Button } from "./ui";

export function AIReviewSettingsForm({ footer }: { footer?: ReactNode }) {
  const { state, mode, saveAIReviewSettings } = useStore();
  const windowId = useId();
  const cacheId = useId();
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

  return (
    <form className="ai-review-settings-form" onSubmit={(event) => void submit(event)}>
      <div className="ai-review-settings-fields">
        <label className="ai-review-setting-field" htmlFor={windowId}>
          <span><strong>Zakres danych analizowanych przez AI</strong><small>Dłuższy zakres może zwiększyć wielkość żądania.</small></span>
          <select id={windowId} aria-label="Zakres danych analizowanych przez AI" value={windowDays} onChange={(event) => { setWindowDays(Number(event.target.value) as AIReviewWindowDays); setSuccess(false); }} disabled={saving}>
            <option value={7}>Ostatnie 7 dni</option><option value={14}>Ostatnie 14 dni</option><option value={28}>Ostatnie 28 dni</option>
          </select>
        </label>
        <label className="ai-review-setting-field" htmlFor={cacheId}>
          <span><strong>Maksymalny czas ponownego użycia wyniku</strong><small>Krótszy czas może zwiększyć liczbę płatnych generowań.</small></span>
          <select id={cacheId} aria-label="Maksymalny czas ponownego użycia wyniku" value={cacheHours} onChange={(event) => { setCacheHours(Number(event.target.value) as AIReviewCacheHours); setSuccess(false); }} disabled={saving}>
            <option value={24}>1 dzień</option><option value={72}>3 dni</option><option value={168}>7 dni</option>
          </select>
        </label>
      </div>
      <p className="ai-review-settings-note">Zmiana zakresu oznacza poprzedni wynik jako nieaktualny, ale nie uruchamia analizy. Krótszy czas przechowywania działa również na zapisany wynik. Wydłużenie nie przedłuża jego pierwotnego terminu ważności.</p>
      <p className="ai-review-settings-note">{mode === "demo" ? "W trybie demo ustawienia są zapisywane lokalnie w tej przeglądarce." : "Ustawienia są wspólne dla urządzeń w tym Workspace."}</p>
      {error ? <p className="inline-mutation-error" role="alert">{error}</p> : null}
      {success ? <p className="ai-review-settings-success" role="status">Ustawienia zostały zapisane.</p> : null}
      <div className="ai-review-settings-actions"><Button type="submit" disabled={saving || !dirty} loading={saving}>Zapisz ustawienia</Button>{footer}</div>
    </form>
  );
}
