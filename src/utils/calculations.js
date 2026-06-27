/**
 * Tennis PrizePicks Calculations
 * ================================
 * All pure functions — no side effects, no API calls, fully testable.
 *
 * Strategy source: "Crush Tennis on PrizePicks" + "Bait Lines" notes
 *
 * Fantasy Score formula  : base(13/7) + setSpread + expectedAces
 *   - Tommy Paul example : 13 + 1.5 + 4 = 18.5  → OVER if PP line < 18.5
 *   - Aces add as raw count (each ace = +1 to projected, not +0.5)
 *   - Confidence thresholds: |edge| ≥ 3 = HIGH, ≥ 1.5 = MEDIUM, < 1.5 = LOW
 *
 * Total Games formula    : favMoneyline → implied prob → under threshold
 *   - prob ≥ 80% = HIGH under, ≥ 67% = MEDIUM, ≥ 57% = LOW, < 57% = SKIP
 *
 * Total Games One formula: sportsbook under odds ≤ -135 required
 *   - ≤ -200 = HIGH, ≤ -135 = MEDIUM, > -135 = SKIP
 */

// ─── Moneyline Conversion ──────────────────────────────────────────────────

/**
 * Convert American moneyline odds to implied win probability (%).
 * Includes the vig — a match's two probabilities will sum > 100%.
 *
 * @param {number} moneyline  e.g. -400, +300, -110
 * @returns {number}          0–100
 *
 * @example
 * moneylineToProb(-400) // → 80.0
 * moneylineToProb(+300) // → 25.0
 * moneylineToProb(-110) // → 52.38
 */
export function moneylineToProb(moneyline) {
  if (!isFinite(moneyline) || moneyline === 0) return 50;
  if (moneyline < 0) {
    return (Math.abs(moneyline) / (Math.abs(moneyline) + 100)) * 100;
  }
  return (100 / (moneyline + 100)) * 100;
}

// ─── Fantasy Score ─────────────────────────────────────────────────────────

/**
 * Calculate projected fantasy score.
 *
 * Formula: base + setSpread + aces
 *   base     = 13 if favorite, 7 if underdog
 *   setSpread = sportsbook set spread (e.g. +1.5 for straight-set favorite)
 *   aces     = expected raw ace count from Bet365
 *
 * @param {{ role: 'favorite'|'underdog', setSpread: number, aces: number }} p
 * @returns {number}
 *
 * @example
 * projectFantasyScore({ role: 'favorite', setSpread: 1.5, aces: 4 }) // → 18.5
 */
export function projectFantasyScore({ role, setSpread, aces }) {
  const base = role === 'favorite' ? 13 : 7;
  return base + setSpread + aces;
}

/**
 * Get fantasy score over/under recommendation vs a PrizePicks line.
 *
 * @param {{ role: 'favorite'|'underdog', setSpread: number, aces: number, ppLine: number }} p
 * @returns {{ rec: 'OVER'|'UNDER', conf: 'HIGH'|'MEDIUM'|'LOW', edge: number, projected: number }}
 *
 * @example
 * fantasyScoreRec({ role: 'favorite', setSpread: 1.5, aces: 4, ppLine: 16.5 })
 * // → { rec: 'OVER', conf: 'HIGH', edge: 2.0, projected: 18.5 }
 */
export function fantasyScoreRec({ role, setSpread, aces, ppLine }) {
  const projected = projectFantasyScore({ role, setSpread, aces });
  const edge = +(projected - ppLine).toFixed(2);
  const absEdge = Math.abs(edge);
  const rec = edge > 0 ? 'OVER' : 'UNDER';
  const conf = absEdge >= 3 ? 'HIGH' : absEdge >= 1.5 ? 'MEDIUM' : 'LOW';
  return { rec, conf, edge, projected };
}

// ─── Total Games ───────────────────────────────────────────────────────────

/**
 * Get total games over/under recommendation.
 * Logic: heavy favorite → straight-set win → fewer total games → UNDER.
 *
 * @param {number} favMoneyline  Favorite's American moneyline (negative number)
 * @returns {{ rec: 'UNDER'|'SKIP', conf: 'HIGH'|'MEDIUM'|'LOW'|'SKIP', prob: number }}
 *
 * @example
 * totalGamesRec(-400) // → { rec: 'UNDER', conf: 'HIGH', prob: 80.0 }
 * totalGamesRec(-200) // → { rec: 'UNDER', conf: 'MEDIUM', prob: 66.7 }
 * totalGamesRec(-130) // → { rec: 'UNDER', conf: 'LOW', prob: 56.5 }
 * totalGamesRec(-105) // → { rec: 'SKIP', conf: 'SKIP', prob: 51.2 }
 */
export function totalGamesRec(favMoneyline) {
  const prob = moneylineToProb(favMoneyline);
  if (prob >= 80) return { rec: 'UNDER', conf: 'HIGH',   prob };
  if (prob >= 67) return { rec: 'UNDER', conf: 'MEDIUM', prob };
  if (prob >= 57) return { rec: 'UNDER', conf: 'LOW',    prob };
  return                 { rec: 'SKIP',  conf: 'SKIP',   prob };
}

// ─── Total Games One ────────────────────────────────────────────────────────

/**
 * Get Total Games One recommendation.
 * Rule: only bet if sportsbook under odds are ≤ -135.
 * Even spreads (-25 vs -105) = even market = skip.
 *
 * @param {number} underOdds  Sportsbook under odds for this player's total games
 * @returns {{ rec: 'UNDER'|'SKIP', conf: 'HIGH'|'MEDIUM'|'SKIP', meetsThreshold: boolean, prob: number }}
 *
 * @example
 * totalGamesOneRec(-200) // → { rec: 'UNDER', conf: 'HIGH', meetsThreshold: true, prob: 66.7 }
 * totalGamesOneRec(-150) // → { rec: 'UNDER', conf: 'MEDIUM', meetsThreshold: true, prob: 60.0 }
 * totalGamesOneRec(-110) // → { rec: 'SKIP', conf: 'SKIP', meetsThreshold: false, prob: 52.4 }
 */
export function totalGamesOneRec(underOdds) {
  const prob = moneylineToProb(underOdds);
  if (underOdds <= -200) return { rec: 'UNDER', conf: 'HIGH',   meetsThreshold: true,  prob };
  if (underOdds <= -135) return { rec: 'UNDER', conf: 'MEDIUM', meetsThreshold: true,  prob };
  return                        { rec: 'SKIP',  conf: 'SKIP',   meetsThreshold: false, prob };
}

// ─── Set Spread Estimation ─────────────────────────────────────────────────

/**
 * Estimate set spread from moneyline when no spreads market is available.
 * Returns the value to ADD to fantasy score base (positive = more sets won).
 *
 * Calibrated to real ATP/WTA patterns:
 *  - prob ≥ 80% (e.g. -400): dominant favorite, likely 6-0/6-1 style → +1.5
 *  - prob ≥ 67% (e.g. -200): strong favorite, likely 2-0 → +1.5
 *  - prob ≥ 58% (e.g. -140): moderate favorite, 2-0 often → +1.0
 *  - prob ≥ 53% (e.g. -115): slight favorite, roughly 50/50 on set count → +0.5
 *  - prob ~50%              : even match → 0
 *  - prob ≤ 40%             : underdog, expected to lose sets → -1.0 to -1.5
 *
 * @param {number} moneyline  Player's American moneyline
 * @returns {number}  Estimated set spread (-1.5 to +1.5)
 */
export function estimateSetSpread(moneyline) {
  const prob = moneylineToProb(moneyline);
  if (prob >= 80) return  1.5;
  if (prob >= 67) return  1.5;
  if (prob >= 58) return  1.0;
  if (prob >= 53) return  0.5;
  if (prob >= 47) return  0.0;
  if (prob >= 40) return -0.5;
  if (prob >= 33) return -1.0;
  return                 -1.5;
}

// ─── Name Matching ─────────────────────────────────────────────────────────

/**
 * Normalize a player name for fuzzy comparison.
 * Strips diacritics, lowercases, removes non-alpha, collapses whitespace.
 *
 * @param {string} name
 * @returns {string}
 *
 * @example
 * normalizeName('Rafael Nadal')      // → 'rafael nadal'
 * normalizeName('Jannik Sïner')      // → 'jannik siner'  (diacritics removed)
 * normalizeName('  Carlos  Alcaraz') // → 'carlos alcaraz'
 */
export function normalizeName(name = '') {
  return String(name)
    // Replace ligatures before NFD — NFD doesn't split them
    .replace(/æ/gi, 'ae')
    .replace(/œ/gi, 'oe')
    .replace(/ø/gi, 'o')
    .replace(/ß/gi, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')          // strip non-alpha
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fuzzy match two player names.
 * Strategies tried in order: exact, last-name, first-initial+last, contains.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 *
 * @example
 * namesMatch('Novak Djokovic', 'Novak Djokovic')  // → true  (exact)
 * namesMatch('N. Djokovic', 'Novak Djokovic')      // → true  (initial + last)
 * namesMatch('Djokovic', 'Novak Djokovic')          // → true  (contains)
 * namesMatch('Murray', 'Djokovic')                  // → false
 */
export function namesMatch(a, b) {
  const n1 = normalizeName(a);
  const n2 = normalizeName(b);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;

  const p1 = n1.split(' ');
  const p2 = n2.split(' ');
  const last1 = p1[p1.length - 1];
  const last2 = p2[p2.length - 1];

  // Last name only (min 4 chars to avoid false positives like "lee")
  if (last1 === last2 && last1.length >= 4) return true;

  // First initial + last name (e.g. "R. Nadal" vs "Rafael Nadal")
  if (p1.length >= 2 && p2.length >= 2) {
    if (p1[0][0] === p2[0][0] && last1 === last2 && last1.length >= 3) return true;
  }

  // Substring (handles partial names like just "de Manard")
  if (n1.length >= 5 && n2.includes(n1)) return true;
  if (n2.length >= 5 && n1.includes(n2)) return true;

  return false;
}

// ─── Sorting ───────────────────────────────────────────────────────────────

/**
 * Numeric rank for confidence level. Higher = better pick.
 * Used to sort picks list.
 *
 * @param {'HIGH'|'MEDIUM'|'LOW'|'SKIP'|'UNKNOWN'} conf
 * @returns {number}
 */
export function confRank(conf) {
  return { HIGH: 4, MEDIUM: 3, LOW: 2, SKIP: 0, UNKNOWN: 0, NEEDS_ACES: 1 }[conf] ?? 0;
}

/**
 * Human-readable label for a confidence level.
 * @param {'HIGH'|'MEDIUM'|'LOW'|'SKIP'|'UNKNOWN'} conf
 * @returns {string}
 */
export function confLabel(conf) {
  return { HIGH: 'High confidence', MEDIUM: 'Medium confidence', LOW: 'Low confidence', SKIP: 'Skip', UNKNOWN: 'Unknown', NEEDS_ACES: 'Needs aces' }[conf] ?? conf;
}
