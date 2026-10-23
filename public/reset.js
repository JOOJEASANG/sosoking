// Clear cached offline pages left by older versions of the site.
(async () => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.filter(name =>
        name.startsWith('sosoking-app-') || name.startsWith('sosoking-casefiles-')
      ).map(name => caches.delete(name)));
    }
  } catch (error) {
    console.warn('Old application cache cleanup skipped', error);
  }
})();
