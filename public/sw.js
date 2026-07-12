/* Push notifications were removed. This self-unregistering worker replaces the
 * old one so already-installed PWAs clean themselves up on next update check. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch {
        /* ignore */
      }
      await self.registration.unregister();
      const clients = await self.clients.matchAll();
      for (const c of clients) c.navigate(c.url);
    })(),
  );
});
