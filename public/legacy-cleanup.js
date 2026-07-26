(() => {
  "use strict";

  const reloadKey = "sosoking-court-cache-cleaned-v1";

  async function clearLegacyRuntime() {
    let hadController = Boolean(navigator.serviceWorker?.controller);

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
      hadController ||= registrations.length > 0;
    }

    if ("caches" in window) {
      const keys = await caches.keys().catch(() => []);
      await Promise.allSettled(keys.map((key) => caches.delete(key)));
      hadController ||= keys.length > 0;
    }

    if (hadController && !sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, "1");
      location.reload();
    }
  }

  clearLegacyRuntime().catch(() => {});
})();
