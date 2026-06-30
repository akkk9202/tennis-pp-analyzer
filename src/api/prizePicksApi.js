/**
 * PrizePicks Unofficial API Client
 * ==================================
 * Uses the community-documented public PrizePicks endpoints.
 * No authentication required. Falls back to CORS proxy if direct fetch fails.
 *
 * ⚠️  This is an unofficial API — endpoints may change without notice.
 *     If data stops loading, check https://github.com/NBA-Analytics-Alliance/PrizePicks
 *     for updated endpoint documentation.
 */

const PP_BASE = 'https://api.prizepicks.com';
/**
 * Fetch with timeout. On CORS failure retries via allorigins (handles large payloads).
 */
async function fetchWithFallback(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (res.ok) return res;
    if (res.status >= 400) throw new Error(`PrizePicks returned ${res.status}`);
    return res;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('PrizePicks request timed out');
  }
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const wrapper = await res.json();
    if (!wrapper.contents) throw new Error('empty proxy response');
    return new Response(wrapper.contents, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch {
    throw new Error('PrizePicks unavailable — using Underdog data only.');
  }
}

/**
 * Fetch all PrizePicks leagues.
 * @returns {Promise<Array<{ id:string, name:string, sport:string }>>}
 */
export async function getPrizePicksLeagues() {
  const res = await fetchWithFallback(`${PP_BASE}/leagues`);
  const data = await res.json();
  return (data.data ?? []).map(l => ({
    id: l.id,
    name: l.attributes?.name ?? '',
    sport: l.attributes?.sport ?? '',
    active: l.attributes?.active ?? true,
  }));
}

/**
 * Discover the tennis league ID dynamically.
 * Checks common known IDs first to avoid an extra network round-trip.
 * @returns {Promise<string|null>}
 */
export async function discoverTennisLeagueId() {
  // These are community-documented IDs for ATP/WTA tennis on PrizePicks.
  // Try them first before falling back to full league discovery.
  const CANDIDATE_IDS = ['7', '17', '37', '47'];

  for (const id of CANDIDATE_IDS) {
    try {
      const res = await fetchWithFallback(
        `${PP_BASE}/projections?league_id=${id}&per_page=5&single_stat=true`
      );
      const data = await res.json();
      // Verify it's tennis by checking the league name in included
      const league = data.included?.find(i => i.type === 'league');
      const name = league?.attributes?.name ?? '';
      if (name.toLowerCase().includes('tennis')) return id;
      // Or if projections exist and have tennis stat types
      const hasTennis = data.data?.some(p =>
        (p.attributes?.stat_type ?? '').toLowerCase().includes('fantasy score') ||
        (p.attributes?.league ?? '').toLowerCase().includes('tennis')
      );
      if (hasTennis) return id;
    } catch {
      continue;
    }
  }

  // Full league discovery fallback
  const leagues = await getPrizePicksLeagues();
  const tennis = leagues.find(l =>
    l.name.toLowerCase().includes('tennis') ||
    l.sport?.toLowerCase().includes('tennis')
  );
  return tennis?.id ?? null;
}

/**
 * Fetch tennis projections for a specific league ID.
 * @param {string} leagueId
 * @returns {Promise<Object>}  Raw JSON:API response
 */
export async function getTennisProjections(leagueId) {
  const params = new URLSearchParams({
    league_id: leagueId,
    per_page: '250',
    single_stat: 'true',
  });
  const res = await fetchWithFallback(`${PP_BASE}/projections?${params}`);
  return res.json();
}

/**
 * Fetch today's tennis props from PrizePicks.
 * Handles league ID discovery automatically.
 *
 * @returns {Promise<Object>}  Raw projections response (JSON:API format)
 * @throws {Error} If PrizePicks is unreachable or no tennis league found
 */
export async function fetchTennisProps() {
  const leagueId = await discoverTennisLeagueId();
  if (!leagueId) {
    throw new Error(
      'Could not find tennis on PrizePicks today. ' +
      'This usually means no tennis matches are currently listed.'
    );
  }
  return getTennisProjections(leagueId);
}
