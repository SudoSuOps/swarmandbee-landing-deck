/**
 * Shared API client for Swarm & Bee landing deck.
 * Fetches live data from hive-ledger and hive-warehouse.
 */

const SB = {
  LEDGER_URL: 'https://ledger.swarmandbee.ai',
  WAREHOUSE_URL: 'https://warehouse.swarmandbee.ai',
  CACHE_TTL: 300000, // 5 minutes

  async fetchJSON(url, opts = {}) {
    const cacheKey = 'sb_' + url;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < SB.CACHE_TTL) return data;
      } catch { /* stale cache */ }
    }

    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();

    // Only cache unauthenticated GETs
    if (!opts.headers || (!opts.headers['Authorization'] && !opts.headers['X-API-Key'])) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
      } catch { /* quota exceeded */ }
    }
    return data;
  },

  async ledger(path) {
    return SB.fetchJSON(SB.LEDGER_URL + path);
  },

  async warehouse(path, opts) {
    return SB.fetchJSON(SB.WAREHOUSE_URL + path, opts);
  },

  // Format large numbers: 1234567 → "1,234,567"
  fmtNum(n) {
    if (n == null) return '—';
    return Number(n).toLocaleString('en-US');
  },

  // Format percentages: 0.9812 → "98.1%"
  fmtPct(n) {
    if (n == null) return '—';
    return (Number(n) * 100).toFixed(1) + '%';
  }
};
