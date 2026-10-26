import { strict as assert } from "node:assert";
import { createECDH, randomBytes } from "node:crypto";
import webpush from "npm:web-push@3.6.7";
import { handleReminderRequest } from "./index.ts";

Deno.test("scheduler rejects unauthenticated callers and respects the kill switch", async () => {
  const secret = "test-only-scheduler-secret-0123456789";
  Deno.env.set("RETURN_REMINDERS_CRON_SECRET", secret);
  Deno.env.set("RETURN_REMINDERS_ENABLED", "false");
  assert.equal((await handleReminderRequest(new Request("https://local.test", { method: "POST" }))).status, 401);
  assert.equal((await handleReminderRequest(new Request("https://local.test"))).status, 405);
  const off = await handleReminderRequest(new Request("https://local.test", { method: "POST", headers: { authorization: `Bearer ${secret}` } }));
  assert.deepEqual(await off.json(), { enabled: false });
  Deno.env.set("RETURN_REMINDERS_ENABLED", "true");
  Deno.env.delete("WEB_PUSH_PRIVATE_KEY");
  assert.equal((await handleReminderRequest(new Request("https://local.test", { method: "POST", headers: { authorization: `Bearer ${secret}` } }))).status, 503);
});

Deno.test("Web Push encryption produces a request in the Edge runtime without transmitting it", () => {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const vapid = webpush.generateVAPIDKeys();
  const request = webpush.generateRequestDetails({ endpoint: "https://web.push.apple.com/test-only", keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } }, JSON.stringify({ destination: "/capture" }), { TTL: 60, topic: "command-return", vapidDetails: { subject: "mailto:test@example.com", ...vapid } });
  assert.equal(request.method, "POST");
  assert.equal(request.headers.TTL, 60);
  assert.ok(request.body && request.body.length > 0);
});
