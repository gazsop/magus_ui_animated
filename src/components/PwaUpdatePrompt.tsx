import { useEffect } from "preact/hooks";
import { useRegisterSW } from "virtual:pwa-register/preact";

let updateCheckInterval: number | undefined;

export default function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration || updateCheckInterval !== undefined) return;
      updateCheckInterval = window.setInterval(() => {
        if (document.visibilityState !== "visible" || !navigator.onLine) return;
        registration.update().catch((error) => {
          console.warn("PWA update check failed", error);
        });
      }, 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.error("PWA service worker registration failed", error);
    },
  });

  useEffect(() => {
    if (offlineReady) setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[10050] w-[min(22rem,calc(100vw-2rem))] border border-amber-700 bg-stone-950/95 text-amber-50 shadow-xl"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 p-3">
        <div>
          <p className="text-sm font-bold">Update available</p>
          <p className="mt-1 text-xs leading-5 text-amber-100">
            A new MAGUS version is ready. Reload to use it.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="border border-stone-500 px-3 py-1 text-xs text-stone-100 hover:bg-stone-800"
            type="button"
            onClick={() => setNeedRefresh(false)}
          >
            Later
          </button>
          <button
            className="border border-amber-500 bg-amber-700 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600"
            type="button"
            onClick={() => updateServiceWorker(true)}
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
