import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import webpush from "npm:web-push@3.6.7";
import { isAllowedPushEndpoint, reminderIsDue } from "./policy.ts";

type Reminder = {
  workspace_id: string; user_id: string; device_id: string; updated_at: string;
  local_date: string; timezone: string; local_time: string; weekdays: number[];
  destination: "/" | "/capture"; subscription: { endpoint: string; keys: { auth: string; p256dh: string } };
};
const reply = (status: number, value: object) => Response.json(value, { status });
async function sameSecret(a: string, b: string) {
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  return left.reduce((difference, byte, index) => difference | (byte ^ right[index]), 0) === 0;
}

export async function handleReminderRequest(request: Request) {
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const secret = Deno.env.get("RETURN_REMINDERS_CRON_SECRET");
  if (!secret || secret.length < 32 || !await sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return reply(401, { error: "unauthorized" });
  if (Deno.env.get("RETURN_REMINDERS_ENABLED") !== "true") return reply(200, { enabled: false });
  const url = Deno.env.get("SUPABASE_URL"), adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("WEB_PUSH_PUBLIC_KEY"), privateKey = Deno.env.get("WEB_PUSH_PRIVATE_KEY"), subject = Deno.env.get("WEB_PUSH_SUBJECT");
  if (!url || !adminKey || !publicKey || !privateKey || !subject) return reply(503, { error: "not_configured" });
  const db = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("claim_return_reminders");
  if (error) return reply(503, { error: "claim_failed" });
  const counts = { sent: 0, failed: 0, expired: 0 };
  const send = async (reminder: Reminder) => {
    let status: keyof typeof counts = "expired";
    try {
      // Recheck consent and membership after claiming; settings may have changed.
      const [config, member] = await Promise.all([
        db.from("return_reminders").select("updated_at").eq("workspace_id", reminder.workspace_id).eq("user_id", reminder.user_id).eq("device_id", reminder.device_id).eq("enabled", true).eq("updated_at", reminder.updated_at).maybeSingle(),
        db.from("workspace_members").select("user_id").eq("workspace_id", reminder.workspace_id).eq("user_id", reminder.user_id).maybeSingle(),
      ]);
      if (config.error || member.error) throw new Error("recheck_failed");
      if (config.data && member.data && reminderIsDue(reminder, new Date()) && isAllowedPushEndpoint(reminder.subscription.endpoint)) {
        const details = webpush.generateRequestDetails(reminder.subscription, JSON.stringify({ destination: reminder.destination }), {
          TTL: 60, urgency: "normal", topic: "command-return", vapidDetails: { subject, publicKey, privateKey },
        });
        const result = await fetch(details.endpoint, { method: details.method, headers: details.headers, body: details.body, redirect: "error", signal: AbortSignal.timeout(5000) });
        await result.body?.cancel();
        if (result.ok) status = "sent";
        else if (result.status === 404 || result.status === 410) {
          const disabled = await db.from("return_reminders").update({ enabled: false }).eq("workspace_id", reminder.workspace_id).eq("user_id", reminder.user_id).eq("updated_at", reminder.updated_at);
          if (disabled.error) throw new Error("disable_failed");
        } else status = "failed";
      }
    } catch { status = "failed"; }
    const receipt = await db.from("return_reminder_deliveries").update({ status, updated_at: new Date().toISOString() }).eq("workspace_id", reminder.workspace_id).eq("user_id", reminder.user_id).eq("local_date", reminder.local_date).eq("status", "sending");
    if (receipt.error) throw new Error("receipt_failed");
    counts[status]++;
  };
  try {
    const reminders = (data ?? []) as Reminder[];
    // At most 100 claims, five concurrent requests, each bounded to five seconds.
    for (let index = 0; index < reminders.length; index += 5) await Promise.all(reminders.slice(index, index + 5).map(send));
    return reply(200, counts);
  } catch { return reply(503, { error: "delivery_receipt_failed" }); }
}

if (import.meta.main) Deno.serve(handleReminderRequest);
