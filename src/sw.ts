/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

type TPushPayload = {
  title?: string;
  body?: string;
  message?: string;
  url?: string;
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));
registerRoute(
  ({ request, url }) =>
    request.destination === "image" ||
    url.pathname.startsWith("/imgs/tiles/") ||
    url.pathname.startsWith("/data/"),
  new CacheFirst({
    cacheName: "magus-aggressive-images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10000,
        maxAgeSeconds: 60 * 60 * 24 * 365,
        purgeOnQuotaError: false,
      }),
    ],
  })
);

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let payload: TPushPayload = {};
  try {
    payload = event.data ? (event.data.json() as TPushPayload) : {};
  } catch {
    payload = { body: event.data?.text() || "" };
  }

  const title = String(payload.title || "MAGUS");
  const body = String(payload.body || payload.message || "New notification");
  const url = String(payload.url || "/");

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/pwa-192x192.png",
      badge: "/icons/pwa-192x192.png",
      data: {
        url,
        message: payload.message || "",
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    String((event.notification.data as { url?: string } | undefined)?.url || "/"),
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing && "focus" in existing) {
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
