(function () {
  const originalFetch = window.fetch.bind(window);
  const readOnlyCallable = /\/(getMaterials|getMaterial|getCommunityImages|getDebates|getDebate|getMaterialComments|getDebateComments)$/;

  window.fetch = function fetchWithCommunityTimeout(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!readOnlyCallable.test(url) || init?.signal) return originalFetch(input, init);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    return originalFetch(input, { ...(init || {}), signal: controller.signal })
      .finally(() => window.clearTimeout(timer));
  };
})();
