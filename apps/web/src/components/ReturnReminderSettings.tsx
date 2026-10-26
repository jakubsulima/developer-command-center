import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "../app/useStore";
import { useAuth } from "../auth/useAuth";
import { Button, Panel } from "./ui";
import { disableReturnReminder, loadReturnReminder, pushApplicationKey, reminderDeviceId, saveReturnReminder } from "../data/returnReminders";

export function ReturnReminderSettings() {
  const { state, mode } = useStore();
  const { user } = useAuth();
  const client = useQueryClient();
  const key = ["return-reminder", user?.id, state.workspaceId];
  const query = useQuery({ queryKey: key, enabled: mode === "supabase" && Boolean(state.workspaceId), queryFn: () => loadReturnReminder(state.workspaceId!) });
  const [time, setTime] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [zone, setZone] = useState(state.workspaceTimezone);
  const [destination, setDestination] = useState<"/" | "/capture">("/capture");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined;
  const supported = typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const [permission, setPermission] = useState<NotificationPermission>(supported ? Notification.permission : "default");
  useEffect(() => {
    if (!query.data || dirty) return;
    setTime(query.data.local_time.slice(0, 5)); setDays(query.data.weekdays); setZone(query.data.timezone); setDestination(query.data.destination);
  }, [dirty, query.data]);
  useEffect(() => {
    if (!supported) return;
    const update = () => setPermission(Notification.permission);
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, [supported]);
  const enabled = Boolean(query.data?.enabled);
  const save = async () => {
    if (busy || !time || !days.length || !state.workspaceId || !user || !publicKey || !supported) return;
    try { new Intl.DateTimeFormat("pl", { timeZone: zone }); } catch { setFailed(true); setMessage("Wpisz poprawną strefę czasową, np. Europe/Warsaw."); return; }
    setBusy(true); setMessage(""); setFailed(false);
    let created: PushSubscription | undefined;
    try {
      // Must run directly from the user's click, before other asynchronous work.
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") throw new Error("Powiadomienia są wyłączone. Możesz zmienić zgodę w ustawieniach iPhone’a.");
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active) throw new Error("Dodaj Command do ekranu początkowego i otwórz go ponownie.");
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) { subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushApplicationKey(publicKey) }); created = subscription; }
      await saveReturnReminder({ workspace_id: state.workspaceId, user_id: user.id, device_id: reminderDeviceId(), enabled: true, weekdays: days, local_time: time, timezone: zone, destination, subscription: subscription.toJSON() });
      created = undefined;
      setDirty(false); setMessage("Przypomnienie zapisano dla tego urządzenia.");
      await client.invalidateQueries({ queryKey: key });
    } catch (error) { await created?.unsubscribe().catch(() => undefined); setFailed(true); setMessage(error instanceof Error ? error.message : "Nie udało się zapisać przypomnienia."); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    if (busy || !state.workspaceId) return;
    setBusy(true); setMessage("");
    try { await disableReturnReminder(state.workspaceId); await client.invalidateQueries({ queryKey: key }); setFailed(false); setMessage("Przypomnienie wyłączono."); }
    catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Nie udało się wyłączyć przypomnienia."); }
    finally { setBusy(false); }
  };
  return <Panel className="return-reminder-settings"><h2>Przypomnienie o Command</h2><p>Jedna krótka zachęta o wybranej porze. Bez nadrabiania pominiętych dni.</p>
    <p>{query.isPending && mode !== "demo" ? "Sprawdzanie ustawień…" : supported && permission === "denied" ? "Wyłączone na tym urządzeniu" : enabled ? "Harmonogram włączony" : "Wyłączone"}{supported && permission === "denied" ? " · Powiadomienia na tym urządzeniu są zablokowane" : ""}</p>
    {mode === "demo" ? <p>Przypomnienia są dostępne po zalogowaniu do konta.</p> : query.isError ? <p role="alert">{query.error.message} <button onClick={() => void query.refetch()}>Spróbuj ponownie</button></p> : null}
    {!publicKey && mode !== "demo" ? <p>Powiadomienia nie są jeszcze dostępne w tym wdrożeniu.</p> : null}
    {!supported ? <p>Na iPhonie dodaj Command do ekranu początkowego i otwórz jako aplikację.</p> : null}
    <fieldset disabled={busy || mode === "demo" || !publicKey || query.isPending || query.isError}>
      <legend>Twój rytm</legend>
      <div className="reminder-days">{[[1,"Pn"],[2,"Wt"],[3,"Śr"],[4,"Cz"],[5,"Pt"],[6,"So"],[0,"Nd"]].map(([day,label]) => <label key={day}><input type="checkbox" checked={days.includes(Number(day))} onChange={(event) => { setDirty(true); setDays((current) => event.target.checked ? [...current, Number(day)] : current.filter((value) => value !== day)); }} />{label}</label>)}</div>
      <label>Godzina<input type="time" value={time} onChange={(event) => { setDirty(true); setTime(event.target.value); }} /></label>
      <label>Strefa czasowa<input value={zone} onChange={(event) => { setDirty(true); setZone(event.target.value); }} /></label>
      <label>Po otwarciu<select value={destination} onChange={(event) => { setDirty(true); setDestination(event.target.value as "/" | "/capture"); }}><option value="/capture">Szybki zapis</option><option value="/">Wybierz działanie na dziś</option></select></label>
      {dirty ? <small>Niezapisane zmiany</small> : null}
      <Button disabled={!supported || !time || !days.length || permission === "denied"} loading={busy} onClick={() => void save()}>{enabled ? "Zapisz na tym urządzeniu" : "Włącz na tym urządzeniu"}</Button>
    </fieldset>
    {enabled ? <Button variant="ghost" loading={busy} onClick={() => void disable()}>Wyłącz przypomnienie</Button> : null}
    {message ? <p role={failed ? "alert" : "status"}>{message}</p> : null}
  </Panel>;
}
