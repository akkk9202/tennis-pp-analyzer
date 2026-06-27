/**
 * The Odds API Client
 * ====================
 * Fetches live tennis match odds (h2h + spreads).
 * Free tier: 500 requests/month — tracked via response headers.
 *
 * Docs: https://the-odds-api.com/liveapi/guides/v4/
 *
 * Get a free API key at: https://the-odds-api.com
 */

const BASE_URL = 'https://api.the-odds-api.com/v4';

/**
 * Custom error class for Odds API failures.
 */
export class OddsApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'OddsApiError';
    this.status = status;
  }
}

/**
 * Check response status and throw typed errors.
 * @param {Response} res
 * @param {string} context  Description of what was being fetched
 */
async function checkResponse(res, context) {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  if (res.status === 401) throw new OddsApiError(401, 'Invalid Odds API key. Check Settings.');
  if (res.status === 422) throw new OddsApiError(422, `Invalid sport key: ${context}`);
  if (res.status === 429) throw new OddsApiError(429, 'Odds API monthly quota reached. Try again next month.');
  throw new OddsApiError(res.status, `Odds API error ${res.status}: ${body.slice(0, 200)}`);
}

/**
 * Fetch all active tennis sports/tournaments from The Odds API.
 * Uses 1 request.
 *
 * @param {string} apiKey
 * @returns {Promise<Array<{ key:string, title:string, description:string, active:boolean }>>}
 */
export async function getActiveTennisSports(apiKey) {
  const url = `${BASE_URL}/sports?apiKey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  await checkResponse(res, 'sports list');
  const all = await res.json();
  return all.filter(s => s.group === 'Tennis' && s.active);
}

/**
 * Fetch h2h + spreads odds for one tennis tournament.
 * Returns [] (not an error) if no events currently exist for that sport.
 * Uses 1 request per call.
 *
 * @param {string} sportKey  e.g. 'tennis_atp_wimbledon'
 * @param {string} apiKey
 * @returns {Promise<{ events: Array, requestsUsed: number, requestsRemaining: number }>}
 */
export async function getOddsForSport(sportKey, apiKey) {
  const params = new URLSearchParams({
    apiKey,
    regions: 'us',
    markets: 'h2h,spreads',
    oddsFormat: 'american',
    dateFormat: 'iso',
  });
  const url = `${BASE_URL}/sports/${encodeURIComponent(sportKey)}/odds?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });

  if (res.status === 404) return { events: [], requestsUsed: 0, requestsRemaining: null };
  await checkResponse(res, sportKey);

  const events = await res.json();
  return {
    events,
    requestsUsed: parseInt(res.headers.get('x-requests-used') ?? '0', 10),
    requestsRemaining: parseInt(res.headers.get('x-requests-remaining') ?? '0', 10),
  };
}

/**
 * Fetch all tennis odds across every active tournament.
 * Makes 1 request for sport discovery + 1 per active tournament.
 * Tournaments with no current events are silently skipped.
 *
 * @param {string} apiKey
 * @returns {Promise<{ events: Array, requestsUsed: number, requestsRemaining: number|null }>}
 */
export async function getAllTennisOdds(apiKey) {
  if (!apiKey?.trim()) throw new OddsApiError(0, 'No Odds API key provided.');

  const sports = await getActiveTennisSports(apiKey);

  if (sports.length === 0) {
    return { events: [], requestsUsed: 1, requestsRemaining: null };
  }

  let totalRequestsUsed = 1;
  let requestsRemaining = null;
  const allEvents = [];

  // Fetch all sports concurrently to minimize wall-clock time
  const results = await Promise.allSettled(
    sports.map(s => getOddsForSport(s.key, apiKey))
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const sport = sports[i];

    if (result.status === 'fulfilled') {
      const { events, requestsUsed, requestsRemaining: rem } = result.value;
      totalRequestsUsed += requestsUsed;
      if (rem !== null) requestsRemaining = rem;
      // Tag each event with its sport metadata
      for (const event of events) {
        allEvents.push({ ...event, _sportKey: sport.key, _sportTitle: sport.title });
      }
    } else {
      // Log but don't fail — one bad tournament shouldn't kill the whole run
      console.warn(`Odds fetch failed for ${sport.key}:`, result.reason?.message);
    }
  }

  return { events: allEvents, requestsUsed: totalRequestsUsed, requestsRemaining };
}
