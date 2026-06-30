/**
 * Underdog Fantasy Unofficial API Client
 * =========================================
 * Uses community-documented public endpoints.
 * No authentication required.
 * Falls back to CORS proxy if direct fetch fails.
 */

const BASE = 'https://api.underdogfantasy.com/v1';
const CORS_PROXY = 'https://corsproxy.io/?';

async function fetchWithFallback(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (res.ok) return res;
    throw new Error(`${res.status}`);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Underdog request timed out');
    try {
      const res = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Proxy failed: ${res.status}`);
      return res;
    } catch (proxyErr) {
      throw new Error(`Underdog unavailable: ${err.message}`);
    }
  }
}

/**
 * Fetch all tennis over/under lines from Underdog Fantasy.
 * @returns {Promise<Object>} Raw API response
 */
export async function fetchUnderdogTennisProps() {
  const res = await fetchWithFallback(`${BASE}/over_under_lines?sport_id=TENNIS`);
  return res.json();
}
