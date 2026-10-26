import { getSupabase } from "../lib/supabase";
export const REMINDER_DEVICE_KEY = "command-reminder-device-v1";
export interface ReturnReminder {
  workspace_id: string;
  user_id?: string;
  device_id: string;
  enabled: boolean;
  weekdays: number[];
  local_time: string;
  timezone: string;
  destination: "/" | "/capture";
  subscription: PushSubscriptionJSON;
}
export function reminderDeviceId() {
  const saved = localStorage.getItem(REMINDER_DEVICE_KEY);
  if (saved) return saved;
  const id = crypto.randomUUID();
  localStorage.setItem(REMINDER_DEVICE_KEY, id);
  return id;
}
export async function loadReturnReminder(workspaceId: string): Promise<ReturnReminder | null> {
  const { data, error } = await getSupabase().from("return_reminders").select("*").eq("workspace_id", workspaceId).maybeSingle();
  if (error) throw new Error("Nie udało się wczytać przypomnienia. Spróbuj ponownie.");
  return data;
}
export async function saveReturnReminder(reminder: ReturnReminder) {
  const { error } = await getSupabase().from("return_reminders").upsert(reminder, { onConflict: "workspace_id,user_id" });
  if (error) throw new Error("Nie potwierdzono zapisu przypomnienia. Odśwież ustawienia i spróbuj ponownie.");
}
export async function disableReturnReminder(workspaceId: string) {
  const { error } = await getSupabase().from("return_reminders").update({ enabled: false }).eq("workspace_id", workspaceId);
  if (error) throw new Error("Nie udało się wyłączyć przypomnienia. Spróbuj ponownie.");
}
export async function detachReminderDevice() {
  const id = localStorage.getItem(REMINDER_DEVICE_KEY);
  if (!id) return;
  const { error } = await getSupabase().rpc("detach_reminder_device", { target_device_id: id });
  // Missing migration means this deployment could not have enrolled a reminder.
  if (error && error.code !== "PGRST202") throw new Error("Nie udało się odłączyć przypomnienia. Spróbuj ponownie przed wylogowaniem.");
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    await subscription?.unsubscribe();
  } catch { /* The server has already disabled this device. */ }
}
export function pushApplicationKey(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
