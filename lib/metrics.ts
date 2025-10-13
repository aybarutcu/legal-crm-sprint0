type MetricStore = Record<string, number>;

const globalMetrics = globalThis as unknown as {
  __legalCrmMetrics?: MetricStore;
};

function ensureStore(): MetricStore {
  if (!globalMetrics.__legalCrmMetrics) {
    globalMetrics.__legalCrmMetrics = {};
  }
  return globalMetrics.__legalCrmMetrics;
}

export function incrementMetric(name: string, value = 1) {
  if (!name) return;
  const store = ensureStore();
  store[name] = (store[name] ?? 0) + value;
}

export function getMetric(name: string): number {
  const store = ensureStore();
  return store[name] ?? 0;
}

export function getAllMetrics(): MetricStore {
  return { ...ensureStore() };
}

export function resetMetrics() {
  globalMetrics.__legalCrmMetrics = {};
}
