/* Imported by the generated PWA worker. Notification data cannot navigate off site. */
self.addEventListener("push", (event) => {
  let destination = "/capture";
  try { if (event.data?.json()?.destination === "/") destination = "/"; } catch { /* Generic message. */ }
  event.waitUntil(self.registration.showNotification("Command", {
    body: destination === "/capture" ? "Masz coś do zapisania? Zajmie chwilę." : "Wybierz jeden krok na dziś.",
    tag: "command-return", renotify: false, data: { destination }
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = event.notification.data?.destination === "/" ? "/" : "/capture";
  const url = new URL(destination, self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) { const client = await existing.navigate(url); if (client) return client.focus(); }
    return self.clients.openWindow(url);
  })());
});
