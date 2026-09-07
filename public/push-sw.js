self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "CouponShare", body: "새로운 알림이 있습니다.", url: "/dunnes" };
  }

  const title = typeof payload.title === "string" ? payload.title : "CouponShare";
  const body = typeof payload.body === "string" ? payload.body : "새로운 알림이 있습니다.";
  const url = typeof payload.url === "string" && payload.url.startsWith("/") ? payload.url : "/dunnes";
  const tag = typeof payload.tag === "string" ? payload.tag : "couponshare-notification";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    icon: "/couponshare-icon-192-v2.png",
    badge: "/couponshare-icon-192-v2.png",
    data: { url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/dunnes";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        if ("navigate" in client) await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
