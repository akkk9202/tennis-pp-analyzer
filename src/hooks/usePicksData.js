/**
 * usePicksData
 * =============
 * Custom React hook that:
 *  1. Fetches live tennis odds from The Odds API
 *  2. Fetches today's PrizePicks tennis props
 *  3. Joins + ranks the two datasets
 *  4. Caches results for 5 minutes to conserve API quota
 *  5. Recomputes instantly when ace overrides change (no extra API call)
 */

import { useState, useCallback, useRef } from 'react';
import { getAllTennisOdds, OddsApiError } from '../api/oddsApi.js';
import { fetchTennisProps } from '../api/prizePicksApi.js';
import { parsePrizePicksData, parseOddsData, buildPicks, deduplicatePicks } from '../utils/matching.js';

/** How long to reuse cached data before requiring a refresh (ms) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * @typedef {Object} PicksState
 * @property {Array}        picks              Ranked, enriched picks
 * @property {Array}        matches            All matched sportsbook events
 * @property {boolean}      loading
 * @property {string|null}  error              Human-readable error message
 * @property {string|null}  ppWarning          Non-fatal PP warning
 * @property {Date|null}    lastUpdated
 * @property {number|null}  requestsRemaining  Odds API quota remaining
 */

export function usePicksData() {
  const [state, setState] = useState({
    picks: [],
    matches: [],
    loading: false,
    error: null,
    ppWarning: null,
    lastUpdated: null,
    requestsRemaining: null,
  });
  const [aceOverrides, setAceOverridesState] = useState({});
  const cache = useRef({ rawMatches: null, rawProps: null, ts: 0 });
  const aceRef = useRef({});

  /** Recompute picks from cache + current ace overrides (no API call) */
  const recomputePicks = useCallback((rawMatches, rawProps, overrides) => {
    const raw = buildPicks(rawProps, rawMatches, overrides);
    return deduplicatePicks(raw);
  }, []);

  /**
   * Refresh all data from APIs.
   * @param {string}  apiKey        The Odds API key from settings
   * @param {boolean} forceRefresh  Skip cache check
   */
  const refresh = useCallback(async (apiKey, forceRefresh = false) => {
    if (!apiKey?.trim()) {
      setState(s => ({ ...s, error: 'Enter your Odds API key in Settings to load picks.' }));
      return;
    }

    // Return cached data if fresh enough
    const now = Date.now();
    if (
      !forceRefresh &&
      cache.current.rawMatches !== null &&
      (now - cache.current.ts) < CACHE_TTL_MS
    ) {
      const picks = recomputePicks(cache.current.rawMatches, cache.current.rawProps, aceRef.current);
      setState(s => ({ ...s, picks, loading: false }));
      return;
    }

    setState(s => ({ ...s, loading: true, error: null, ppWarning: null }));

    let oddsResult = { events: [], requestsRemaining: null };
    let ppRaw = null;
    let ppWarning = null;

    // Fetch both APIs concurrently
    const [oddsSettled, ppSettled] = await Promise.allSettled([
      getAllTennisOdds(apiKey),
      fetchTennisProps(),
    ]);

    if (oddsSettled.status === 'rejected') {
      const err = oddsSettled.reason;
      setState(s => ({
        ...s,
        loading: false,
        error: err instanceof OddsApiError && err.status === 401
          ? 'Invalid Odds API key — double-check in Settings.'
          : err instanceof OddsApiError && err.status === 429
          ? 'Odds API monthly quota reached. Come back next month.'
          : `Odds API error: ${err.message}`,
      }));
      return;
    }
    oddsResult = oddsSettled.value;

    if (ppSettled.status === 'rejected') {
      ppWarning = `PrizePicks data unavailable: ${ppSettled.reason?.message ?? 'unknown error'}. Showing odds data only.`;
    } else {
      ppRaw = ppSettled.value;
    }

    const rawMatches = parseOddsData(oddsResult.events, null);
    const rawProps = ppRaw ? parsePrizePicksData(ppRaw) : [];

    // Update cache
    cache.current = { rawMatches, rawProps, ts: now };

    const picks = recomputePicks(rawMatches, rawProps, aceRef.current);

    setState({
      picks,
      matches: rawMatches,
      loading: false,
      error: null,
      ppWarning,
      lastUpdated: new Date(),
      requestsRemaining: oddsResult.requestsRemaining,
    });
  }, [recomputePicks]);

  /**
   * Set expected ace count for a player and immediately recompute recommendations.
   * Does NOT trigger an API call.
   * @param {string} playerName
   * @param {number} aces
   */
  const setAces = useCallback((playerName, aces) => {
    const newOverrides = { ...aceRef.current, [playerName]: Number(aces) };
    aceRef.current = newOverrides;
    setAceOverridesState(newOverrides);

    if (cache.current.rawMatches !== null) {
      const picks = recomputePicks(cache.current.rawMatches, cache.current.rawProps, newOverrides);
      setState(s => ({ ...s, picks }));
    }
  }, [recomputePicks]);

  return {
    ...state,
    aceOverrides,
    refresh,
    setAces,
  };
}
