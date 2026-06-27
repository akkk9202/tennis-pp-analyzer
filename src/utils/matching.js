/**
 * Tennis PrizePicks Data Matching
 * =================================
 * Parses raw API responses and joins PrizePicks props with sportsbook odds
 * to produce ranked, enriched pick recommendations.
 *
 * Pipeline:
 *  parsePrizePicksData(raw)  →  PPProp[]
 *  parseOddsData(raw)        →  Match[]
 *  buildPicks(props, matches, aceOverrides)  →  EnrichedPick[]  (sorted best-first)
 */

import {
  namesMatch,
  normalizeName,
  estimateSetSpread,
  fantasyScoreRec,
  totalGamesRec,
  totalGamesOneRec,
  confRank,
} from './calculations.js';

// ─── PrizePicks Parser ─────────────────────────────────────────────────────

/**
 * Map PrizePicks stat_type strings to internal prop categories.
 * Keys are lowercase. Any unrecognized type → 'skip'.
 */
const PROP_CATEGORY_MAP = {
  'fantasy score':         'fantasy_score',
  'tennis fantasy score':  'fantasy_score',
  'total games':           'total_games',
  'tennis total games':    'total_games',
  'match total games':     'total_games',
  'player total games':    'total_games_one',
  'games played':          'total_games_one',
  'total games played':    'total_games_one',
  'games won':             'total_games_one',
};

const ALWAYS_SKIP = new Set([
  'aces', 'double faults', 'break points', 'break points won',
  'goblins', 'demons', 'service games won',
]);

/**
 * Categorize a PrizePicks stat_type string.
 * @param {string} statType
 * @returns {'fantasy_score'|'total_games'|'total_games_one'|'skip'}
 */
export function categorizeProp(statType) {
  const s = (statType || '').toLowerCase().trim();
  if (ALWAYS_SKIP.has(s)) return 'skip';
  return PROP_CATEGORY_MAP[s] ?? 'skip';
}

/**
 * Parse PrizePicks /projections response into flat prop objects.
 * Only returns props that are: pre-game, have a player name, have a valid line,
 * and are in a supported category.
 *
 * @param {Object} raw  Full PrizePicks API response
 * @returns {PPProp[]}
 *
 * @typedef {{ id:string, playerId:string, playerName:string, statType:string,
 *             propType:string, line:number, startTime:string, description:string }} PPProp
 */
export function parsePrizePicksData(raw) {
  if (!raw || typeof raw !== 'object') return [];

  // Build player id → name lookup from `included`
  const players = {};
  for (const item of raw.included ?? []) {
    if (item.type === 'new_player' && item.id) {
      players[item.id] = item.attributes?.name ?? item.attributes?.display_name ?? '';
    }
  }

  return (raw.data ?? [])
    .filter(p => {
      const status = p.attributes?.status;
      // Keep pre_game and items without a status (old API versions omit it)
      return !status || status === 'pre_game';
    })
    .map(p => {
      const attr = p.attributes ?? {};
      const playerId = p.relationships?.new_player?.data?.id ?? '';
      const playerName = players[playerId] ?? '';
      const statType = attr.stat_type ?? '';
      const propType = categorizeProp(statType);
      const line = parseFloat(attr.line_score);
      return {
        id: p.id,
        playerId,
        playerName,
        statType,
        propType,
        line,
        startTime: attr.start_time ?? '',
        description: attr.description ?? '',
      };
    })
    .filter(p => p.propType !== 'skip' && p.playerName.trim() !== '' && !isNaN(p.line));
}

// ─── Odds API Parser ───────────────────────────────────────────────────────

/** Preferred bookmaker order (best-quality lines first) */
const BOOKMAKER_PRIORITY = ['draftkings', 'fanduel', 'bovada', 'bet365', 'betmgm', 'williamhill_us'];

/**
 * Pick the highest-quality bookmaker from a list.
 * @param {Array} bookmakers
 * @returns {Object|null}
 */
function bestBookmaker(bookmakers) {
  for (const key of BOOKMAKER_PRIORITY) {
    const b = bookmakers.find(bk => bk.key === key);
    if (b?.markets?.length) return b;
  }
  return bookmakers.find(bk => bk.markets?.length) ?? null;
}

/**
 * Parse The Odds API response array into flat match objects.
 *
 * @param {Array} raw         Events from /sports/{key}/odds
 * @param {string} [sportKey] Override sport key (optional; event has its own)
 * @returns {Match[]}
 *
 * @typedef {{ id:string, sportKey:string, tournament:string, commenceTime:string,
 *             player1:string, player2:string, odds1:number, odds2:number,
 *             favName:string, favOdds:number, dogName:string, dogOdds:number,
 *             spreads:Object, bookmaker:string }} Match
 */
export function parseOddsData(raw, sportKey) {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap(event => {
    const book = bestBookmaker(event.bookmakers ?? []);
    if (!book) return [];

    const h2h = book.markets?.find(m => m.key === 'h2h');
    if (!h2h || h2h.outcomes.length < 2) return [];

    const [o1, o2] = h2h.outcomes;
    // Favorite has the lower (more negative) price
    const [fav, dog] = o1.price <= o2.price ? [o1, o2] : [o2, o1];

    // Extract set spreads market if available — gives more accurate set spread
    // The Odds API spreads market uses "point" field:
    //   Favorite's point = -1.5 means they must win by 1.5 sets (expected to win 2-0)
    //   We flip the sign for fantasy score formula: -1.5 → +1.5 contribution
    const spreadsMarket = book.markets?.find(m => m.key === 'spreads');
    const spreads = {};
    if (spreadsMarket) {
      for (const outcome of spreadsMarket.outcomes ?? []) {
        const key = normalizeName(outcome.name);
        spreads[key] = outcome.point;
      }
    }

    return [{
      id: event.id,
      sportKey: sportKey ?? event.sport_key ?? '',
      tournament: event.sport_title ?? event.sport_key ?? 'Tennis',
      commenceTime: event.commence_time ?? '',
      player1: o1.name,
      player2: o2.name,
      odds1: o1.price,
      odds2: o2.price,
      favName: fav.name,
      favOdds: fav.price,
      dogName: dog.name,
      dogOdds: dog.price,
      spreads,         // { normalizedName → point }
      bookmaker: book.title ?? book.key ?? 'unknown',
    }];
  });
}

// ─── Player–Match Helpers ──────────────────────────────────────────────────

/**
 * Find the match a player is participating in.
 * @param {string} playerName
 * @param {Match[]} matches
 * @returns {Match|null}
 */
export function findMatch(playerName, matches) {
  return matches.find(m =>
    namesMatch(playerName, m.player1) || namesMatch(playerName, m.player2)
  ) ?? null;
}

/**
 * Get a player's moneyline, role, and opponent's odds from a match.
 * @param {string} playerName
 * @param {Match} match
 * @returns {{ odds:number, role:'favorite'|'underdog', opponentOdds:number }}
 */
export function getPlayerOdds(playerName, match) {
  const isP1 = namesMatch(playerName, match.player1);
  const odds = isP1 ? match.odds1 : match.odds2;
  const opponentOdds = isP1 ? match.odds2 : match.odds1;
  const role = odds <= 0 ? 'favorite' : 'underdog';
  return { odds, role, opponentOdds };
}

/**
 * Get the set spread for a player from a match.
 * Uses actual spreads market when available; falls back to estimation from h2h.
 *
 * Sign convention: positive = player wins more sets (favorite perspective).
 *   Odds API spreads point of -1.5 (favorite) → formula needs +1.5
 *   So we flip: spreadForFormula = -(spreadsPoint)
 *
 * @param {string} playerName
 * @param {Match} match
 * @param {number} playerOdds  Fallback: used to estimate if no spreads market
 * @returns {number}
 */
export function getSetSpread(playerName, match, playerOdds) {
  const key = normalizeName(playerName);
  if (match.spreads && Object.prototype.hasOwnProperty.call(match.spreads, key)) {
    const point = match.spreads[key];
    if (isFinite(point)) return -point;  // flip: -1.5 → +1.5
  }
  return estimateSetSpread(playerOdds);
}

// ─── Full Pipeline ─────────────────────────────────────────────────────────

/**
 * Match PrizePicks props to sportsbook matches and compute recommendations.
 *
 * - Fantasy Score props with no ace override return rec='NEEDS_ACES'
 * - Props with no matching match are excluded
 * - Results are sorted: best actionable picks first, then NEEDS_ACES, then SKIP
 *
 * @param {PPProp[]} ppProps
 * @param {Match[]}  matches
 * @param {Object}   aceOverrides   { playerName: aceCount }
 * @returns {EnrichedPick[]}
 */
export function buildPicks(ppProps, matches, aceOverrides = {}) {
  const picks = ppProps
    .map(prop => {
      const match = findMatch(prop.playerName, matches);
      if (!match) return null;

      const { odds, role, opponentOdds } = getPlayerOdds(prop.playerName, match);
      const setSpread = getSetSpread(prop.playerName, match, odds);

      let recommendation;

      switch (prop.propType) {
        case 'fantasy_score': {
          // Find ace override (fuzzy name match on keys)
          const aceKey = Object.keys(aceOverrides).find(k => namesMatch(k, prop.playerName));
          const aces = aceKey !== undefined ? Number(aceOverrides[aceKey]) : null;

          if (aces === null || isNaN(aces)) {
            recommendation = {
              rec: 'NEEDS_ACES',
              conf: 'UNKNOWN',
              edge: null,
              projected: null,
              needsAces: true,
            };
          } else {
            recommendation = {
              ...fantasyScoreRec({ role, setSpread, aces, ppLine: prop.line }),
              needsAces: false,
            };
          }
          break;
        }

        case 'total_games': {
          // Use the match favorite's moneyline
          recommendation = {
            ...totalGamesRec(match.favOdds),
            needsAces: false,
          };
          break;
        }

        case 'total_games_one': {
          // Use player's own moneyline as proxy for under odds.
          // Underdogs (positive odds) → likely go UNDER their games total.
          // Note: for highest accuracy, manually verify with sportsbook under odds.
          recommendation = {
            ...totalGamesOneRec(odds),
            needsAces: false,
            approximate: true,  // flag that this used h2h odds as proxy
          };
          break;
        }

        default:
          return null;
      }

      return {
        ...prop,
        match,
        playerOdds: odds,
        opponentOdds,
        role,
        setSpread,
        ...recommendation,
      };
    })
    .filter(Boolean);

  // Sort order:
  //  1. Actionable with real conf (HIGH → MEDIUM → LOW)
  //  2. NEEDS_ACES (fantasy score waiting for ace input)
  //  3. SKIP
  return picks.sort((a, b) => {
    const rankScore = p => {
      if (p.rec === 'SKIP')      return 0;
      if (p.rec === 'NEEDS_ACES') return 1;
      return confRank(p.conf) + 2;  // 3 (LOW) → 4 (MEDIUM) → 5 (HIGH)
    };
    const diff = rankScore(b) - rankScore(a);
    if (diff !== 0) return diff;
    // Tiebreak: larger absolute edge wins
    return Math.abs(b.edge ?? 0) - Math.abs(a.edge ?? 0);
  });
}

/**
 * Deduplicate picks by player+statType, keeping the one with higher conf.
 * PrizePicks sometimes returns duplicate props (same player, same stat).
 * @param {EnrichedPick[]} picks
 * @returns {EnrichedPick[]}
 */
export function deduplicatePicks(picks) {
  const seen = new Map();
  for (const pick of picks) {
    const key = `${normalizeName(pick.playerName)}::${pick.statType}`;
    const existing = seen.get(key);
    if (!existing || confRank(pick.conf) > confRank(existing.conf)) {
      seen.set(key, pick);
    }
  }
  return [...seen.values()];
}
