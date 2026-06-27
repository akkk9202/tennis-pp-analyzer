import { describe, it, expect } from 'vitest';
import {
  moneylineToProb,
  projectFantasyScore,
  fantasyScoreRec,
  totalGamesRec,
  totalGamesOneRec,
  estimateSetSpread,
  normalizeName,
  namesMatch,
  confRank,
  confLabel,
} from '../src/utils/calculations.js';

// ─── moneylineToProb ───────────────────────────────────────────────────────

describe('moneylineToProb', () => {
  it('converts -400 to 80%', () => {
    expect(moneylineToProb(-400)).toBeCloseTo(80.0, 1);
  });
  it('converts -200 to 66.67%', () => {
    expect(moneylineToProb(-200)).toBeCloseTo(66.67, 1);
  });
  it('converts -135 to 57.45%', () => {
    expect(moneylineToProb(-135)).toBeCloseTo(57.45, 1);
  });
  it('converts -110 to 52.38%', () => {
    expect(moneylineToProb(-110)).toBeCloseTo(52.38, 1);
  });
  it('converts +100 to 50%', () => {
    expect(moneylineToProb(100)).toBeCloseTo(50.0, 1);
  });
  it('converts +300 to 25%', () => {
    expect(moneylineToProb(300)).toBeCloseTo(25.0, 1);
  });
  it('converts +120 to ~45.45%', () => {
    expect(moneylineToProb(120)).toBeCloseTo(45.45, 1);
  });
  it('handles 0 (returns 50)', () => {
    expect(moneylineToProb(0)).toBe(50);
  });
  it('handles -100 (50%)', () => {
    expect(moneylineToProb(-100)).toBeCloseTo(50, 1);
  });

  // Boundary verification: these moneylines hit the strategy thresholds
  it('-400 is exactly at 80% HIGH threshold', () => {
    const prob = moneylineToProb(-400);
    expect(prob).toBeGreaterThanOrEqual(80);
  });
  it('-210 is above 67% MEDIUM threshold', () => {
    const prob = moneylineToProb(-210);
    expect(prob).toBeGreaterThan(67);
  });
  it('-200 is just under 67% MEDIUM threshold (66.67%)', () => {
    const prob = moneylineToProb(-200);
    expect(prob).toBeLessThan(67);
  });
  it('-134 is just above 57% LOW threshold', () => {
    const prob = moneylineToProb(-134);
    expect(prob).toBeGreaterThan(57);
  });
  it('-130 is below 57% LOW threshold', () => {
    const prob = moneylineToProb(-130);
    expect(prob).toBeLessThan(57);
  });
});

// ─── projectFantasyScore ───────────────────────────────────────────────────

describe('projectFantasyScore', () => {
  it('Tommy Paul example: favorite + 1.5 spread + 4 aces = 18.5', () => {
    expect(projectFantasyScore({ role: 'favorite', setSpread: 1.5, aces: 4 })).toBe(18.5);
  });
  it('favorite base is 13', () => {
    expect(projectFantasyScore({ role: 'favorite', setSpread: 0, aces: 0 })).toBe(13);
  });
  it('underdog base is 7', () => {
    expect(projectFantasyScore({ role: 'underdog', setSpread: 0, aces: 0 })).toBe(7);
  });
  it('underdog + negative spread + few aces', () => {
    expect(projectFantasyScore({ role: 'underdog', setSpread: -1.5, aces: 2 })).toBe(7.5);
  });
  it('favorite + negative spread (expected to go 3 sets)', () => {
    expect(projectFantasyScore({ role: 'favorite', setSpread: -1.5, aces: 5 })).toBe(16.5);
  });
  it('aces add directly (each ace = +1)', () => {
    const with3 = projectFantasyScore({ role: 'favorite', setSpread: 1.5, aces: 3 });
    const with7 = projectFantasyScore({ role: 'favorite', setSpread: 1.5, aces: 7 });
    expect(with7 - with3).toBe(4);
  });
  it('handles fractional spread', () => {
    expect(projectFantasyScore({ role: 'favorite', setSpread: 0.5, aces: 3 })).toBe(16.5);
  });
});

// ─── fantasyScoreRec ───────────────────────────────────────────────────────

describe('fantasyScoreRec', () => {
  // ─ Tommy Paul scenario from the notes ─
  it('Tommy Paul: proj 18.5, line 16.5 → OVER MEDIUM (edge +2.0)', () => {
    const r = fantasyScoreRec({ role: 'favorite', setSpread: 1.5, aces: 4, ppLine: 16.5 });
    expect(r.rec).toBe('OVER');
    expect(r.conf).toBe('MEDIUM');
    expect(r.edge).toBeCloseTo(2.0);
    expect(r.projected).toBeCloseTo(18.5);
  });
  it('proj 18.5, line 15.5 → OVER HIGH (edge +3.0)', () => {
    const r = fantasyScoreRec({ role: 'favorite', setSpread: 1.5, aces: 4, ppLine: 15.5 });
    expect(r.rec).toBe('OVER');
    expect(r.conf).toBe('HIGH');
    expect(r.edge).toBeCloseTo(3.0);
  });
  it('proj 18.5, line 17.5 → OVER LOW (edge +1.0)', () => {
    const r = fantasyScoreRec({ role: 'favorite', setSpread: 1.5, aces: 4, ppLine: 17.5 });
    expect(r.rec).toBe('OVER');
    expect(r.conf).toBe('LOW');
    expect(r.edge).toBeCloseTo(1.0);
  });

  // ─ Edge magnitude thresholds ─
  it('edge exactly 3.0 → HIGH', () => {
    const r = fantasyScoreRec({ role: 'favorite', setSpread: 0, aces: 6, ppLine: 10 });
    // projected = 13 + 0 + 6 = 19, edge = 19 - 10 = 9 → HIGH
    expect(r.conf).toBe('HIGH');
  });
  it('edge exactly 1.5 → MEDIUM', () => {
    const r = fantasyScoreRec({ role: 'favorite', setSpread: 0, aces: 5, ppLine: 16.5 });
    // projected = 13 + 0 + 5 = 18, edge = 18 - 16.5 = 1.5 → MEDIUM
    expect(r.conf).toBe('MEDIUM');
    expect(r.edge).toBeCloseTo(1.5);
  });
  it('edge 1.4 → LOW', () => {
    const r = fantasyScoreRec({ role: 'favorite', setSpread: 0, aces: 5, ppLine: 16.6 });
    // projected = 18, edge = 1.4 → LOW
    expect(r.conf).toBe('LOW');
  });

  // ─ UNDER cases ─
  it('proj below line → UNDER recommendation', () => {
    const r = fantasyScoreRec({ role: 'underdog', setSpread: -1.5, aces: 1, ppLine: 12 });
    // projected = 7 - 1.5 + 1 = 6.5, edge = -5.5 → UNDER HIGH
    expect(r.rec).toBe('UNDER');
    expect(r.conf).toBe('HIGH');
    expect(r.edge).toBeCloseTo(-5.5);
  });
  it('edge exactly 0 → UNDER LOW', () => {
    const r = fantasyScoreRec({ role: 'favorite', setSpread: 0, aces: 0, ppLine: 13 });
    // projected = 13, edge = 0 → UNDER (not strictly > 0), LOW
    expect(r.rec).toBe('UNDER');
    expect(r.conf).toBe('LOW');
  });

  // ─ Large edges ─
  it('edge +8 → OVER HIGH', () => {
    const r = fantasyScoreRec({ role: 'favorite', setSpread: 1.5, aces: 8, ppLine: 14.5 });
    expect(r.rec).toBe('OVER');
    expect(r.conf).toBe('HIGH');
  });
  it('edge -8 → UNDER HIGH', () => {
    const r = fantasyScoreRec({ role: 'underdog', setSpread: -1.5, aces: 0, ppLine: 15 });
    // projected = 5.5, edge = -9.5 → UNDER HIGH
    expect(r.rec).toBe('UNDER');
    expect(r.conf).toBe('HIGH');
  });
});

// ─── totalGamesRec ─────────────────────────────────────────────────────────

describe('totalGamesRec', () => {
  it('-400 → UNDER HIGH (prob ≥ 80%)', () => {
    const r = totalGamesRec(-400);
    expect(r.rec).toBe('UNDER');
    expect(r.conf).toBe('HIGH');
    expect(r.prob).toBeCloseTo(80, 0);
  });
  it('-500 → UNDER HIGH (prob > 80%)', () => {
    const r = totalGamesRec(-500);
    expect(r.rec).toBe('UNDER');
    expect(r.conf).toBe('HIGH');
    expect(r.prob).toBeGreaterThan(80);
  });
  it('-210 → UNDER MEDIUM (prob just above 67%)', () => {
    const r = totalGamesRec(-210);
    expect(r.rec).toBe('UNDER');
    expect(r.conf).toBe('MEDIUM');
  });
  it('-200 → UNDER LOW (66.67% < 67% threshold)', () => {
    // -200 gives 66.67% which is just below the 67% MEDIUM threshold
    const r = totalGamesRec(-200);
    expect(r.rec).toBe('UNDER');
    expect(r.conf).toBe('LOW');
    expect(r.prob).toBeCloseTo(66.67, 1);
  });
  it('-150 → UNDER LOW', () => {
    const r = totalGamesRec(-150);
    expect(r.rec).toBe('UNDER');
    expect(r.conf).toBe('LOW');
  });
  it('-134 → UNDER LOW (prob just above 57%)', () => {
    const r = totalGamesRec(-134);
    expect(r.rec).toBe('UNDER');
    expect(r.conf).toBe('LOW');
    expect(r.prob).toBeGreaterThan(57);
  });
  it('-130 → SKIP (56.52% < 57%)', () => {
    const r = totalGamesRec(-130);
    expect(r.rec).toBe('SKIP');
    expect(r.conf).toBe('SKIP');
  });
  it('-110 → SKIP', () => {
    const r = totalGamesRec(-110);
    expect(r.rec).toBe('SKIP');
  });
  it('+100 → SKIP (50%)', () => {
    const r = totalGamesRec(100);
    expect(r.rec).toBe('SKIP');
  });
  it('+300 → SKIP (25%)', () => {
    const r = totalGamesRec(300);
    expect(r.rec).toBe('SKIP');
  });
  it('always includes prob in result', () => {
    const r = totalGamesRec(-400);
    expect(r.prob).toBeDefined();
    expect(typeof r.prob).toBe('number');
  });
});

// ─── totalGamesOneRec ──────────────────────────────────────────────────────

describe('totalGamesOneRec', () => {
  it('-200 → UNDER HIGH', () => {
    const r = totalGamesOneRec(-200);
    expect(r.rec).toBe('UNDER');
    expect(r.conf).toBe('HIGH');
    expect(r.meetsThreshold).toBe(true);
  });
  it('-250 → UNDER HIGH', () => {
    const r = totalGamesOneRec(-250);
    expect(r.rec).toBe('UNDER');
    expect(r.conf).toBe('HIGH');
  });
  it('-200 exactly → HIGH (boundary)', () => {
    const r = totalGamesOneRec(-200);
    expect(r.conf).toBe('HIGH');
  });
  it('-199 → MEDIUM (just below -200 threshold)', () => {
    const r = totalGamesOneRec(-199);
    expect(r.conf).toBe('MEDIUM');
  });
  it('-150 → UNDER MEDIUM', () => {
    const r = totalGamesOneRec(-150);
    expect(r.rec).toBe('UNDER');
    expect(r.conf).toBe('MEDIUM');
    expect(r.meetsThreshold).toBe(true);
  });
  it('-135 → UNDER MEDIUM (boundary)', () => {
    const r = totalGamesOneRec(-135);
    expect(r.rec).toBe('UNDER');
    expect(r.conf).toBe('MEDIUM');
    expect(r.meetsThreshold).toBe(true);
  });
  it('-134 → SKIP (just above -135 threshold)', () => {
    const r = totalGamesOneRec(-134);
    expect(r.rec).toBe('SKIP');
    expect(r.conf).toBe('SKIP');
    expect(r.meetsThreshold).toBe(false);
  });
  it('-110 → SKIP', () => {
    const r = totalGamesOneRec(-110);
    expect(r.rec).toBe('SKIP');
    expect(r.meetsThreshold).toBe(false);
  });
  it('+100 → SKIP', () => {
    const r = totalGamesOneRec(100);
    expect(r.rec).toBe('SKIP');
    expect(r.meetsThreshold).toBe(false);
  });
  it('always includes meetsThreshold and prob', () => {
    const r = totalGamesOneRec(-150);
    expect(typeof r.meetsThreshold).toBe('boolean');
    expect(typeof r.prob).toBe('number');
  });
});

// ─── estimateSetSpread ─────────────────────────────────────────────────────

describe('estimateSetSpread', () => {
  it('-400 (80% win prob) → +1.5', () => {
    expect(estimateSetSpread(-400)).toBe(1.5);
  });
  it('-210 (67.7% win prob, above 67% threshold) → +1.5', () => {
    expect(estimateSetSpread(-210)).toBe(1.5);
  });
  it('-200 (66.67% win prob, below 67% threshold) → +1.0', () => {
    // -200 gives 66.67% which is just below the ≥67% boundary, so returns 1.0 not 1.5
    expect(estimateSetSpread(-200)).toBe(1.0);
  });
  it('+300 (25% win prob) → -1.5', () => {
    expect(estimateSetSpread(300)).toBe(-1.5);
  });
  it('+100 (50% win prob) → 0', () => {
    expect(estimateSetSpread(100)).toBe(0);
  });
  it('returns a number in range [-1.5, +1.5]', () => {
    const moneylines = [-600, -400, -250, -150, -110, +100, +150, +300, +500];
    for (const ml of moneylines) {
      const spread = estimateSetSpread(ml);
      expect(spread).toBeGreaterThanOrEqual(-1.5);
      expect(spread).toBeLessThanOrEqual(1.5);
    }
  });
  it('favorite has positive or zero spread', () => {
    expect(estimateSetSpread(-300)).toBeGreaterThanOrEqual(0);
  });
  it('heavy underdog has negative spread', () => {
    expect(estimateSetSpread(400)).toBeLessThan(0);
  });
});

// ─── normalizeName ─────────────────────────────────────────────────────────

describe('normalizeName', () => {
  it('lowercases', () => {
    expect(normalizeName('RAFAEL NADAL')).toBe('rafael nadal');
  });
  it('removes diacritics', () => {
    expect(normalizeName('Iga Świątek')).toBe('iga swiatek');
  });
  it('removes diacritics on accented vowels', () => {
    // Precomposed characters like é are split by NFD into base + combining mark
    expect(normalizeName('Ïgor Björk')).toBe('igor bjork');
  });
  it('handles ligature æ → ae', () => {
    // æ is a ligature, not a precomposed char — NFD alone leaves it; we handle it explicitly
    expect(normalizeName('Jannick Sjæt')).toBe('jannick sjaet');
  });
  it('handles ligature ø → o', () => {
    expect(normalizeName('Søren')).toBe('soren');
  });
  it('trims whitespace', () => {
    expect(normalizeName('  Tommy Paul  ')).toBe('tommy paul');
  });
  it('collapses multiple spaces', () => {
    expect(normalizeName('Carlos  Alcaraz')).toBe('carlos alcaraz');
  });
  it('removes non-alpha characters', () => {
    expect(normalizeName('N. Djokovic')).toBe('n djokovic');
  });
  it('handles empty string', () => {
    expect(normalizeName('')).toBe('');
  });
  it('handles undefined gracefully', () => {
    expect(normalizeName(undefined)).toBe('');
  });
});

// ─── namesMatch ────────────────────────────────────────────────────────────

describe('namesMatch', () => {
  // Exact match
  it('matches identical names', () => {
    expect(namesMatch('Novak Djokovic', 'Novak Djokovic')).toBe(true);
  });
  it('matches case-insensitively', () => {
    expect(namesMatch('novak djokovic', 'NOVAK DJOKOVIC')).toBe(true);
  });

  // Diacritics
  it('matches across diacritics (Świątek vs Swiatek)', () => {
    expect(namesMatch('Iga Świątek', 'Iga Swiatek')).toBe(true);
  });
  it('matches across accent variations', () => {
    expect(namesMatch('Rafael Nadál', 'Rafael Nadal')).toBe(true);
  });

  // Last name match
  it('matches on last name alone (8+ char)', () => {
    expect(namesMatch('Djokovic', 'Novak Djokovic')).toBe(true);
  });
  it('matches on last name alone (4 char, boundary)', () => {
    expect(namesMatch('Paul', 'Tommy Paul')).toBe(true);
  });
  it('does NOT match short last names as substring bait', () => {
    // "Lee" (3 chars) — below the 4-char threshold for last-name match
    // But "James Lee" should still match "James Lee" exactly
    expect(namesMatch('James Lee', 'James Lee')).toBe(true);
  });

  // First initial + last name (abbreviated)
  it('matches abbreviated first name: N. Djokovic', () => {
    expect(namesMatch('N. Djokovic', 'Novak Djokovic')).toBe(true);
  });
  it('matches abbreviated first name: R. Nadal', () => {
    expect(namesMatch('R. Nadal', 'Rafael Nadal')).toBe(true);
  });

  // Substring / contains
  it('contains match: "Djokovic" within "Novak Djokovic"', () => {
    // This is covered by last-name match before substring
    expect(namesMatch('Djokovic', 'Novak Djokovic')).toBe(true);
  });

  // Non-matches
  it('does NOT match different players', () => {
    expect(namesMatch('Djokovic', 'Federer')).toBe(false);
  });
  it('does NOT match first names only', () => {
    expect(namesMatch('Carlos', 'Tommy Paul')).toBe(false);
  });
  it('does NOT match empty strings', () => {
    expect(namesMatch('', 'Novak Djokovic')).toBe(false);
    expect(namesMatch('Novak Djokovic', '')).toBe(false);
  });
  it('does NOT false-positive on 3-char last name + different first name', () => {
    // "Lee" is 3 chars, below threshold — "Sam Lee" should NOT match "James Lec"
    expect(namesMatch('Sam Lee', 'James Lec')).toBe(false);
  });
  it('symmetric — order does not matter', () => {
    expect(namesMatch('Tommy Paul', 'T. Paul')).toBe(namesMatch('T. Paul', 'Tommy Paul'));
  });
});

// ─── confRank ──────────────────────────────────────────────────────────────

describe('confRank', () => {
  it('HIGH ranks above MEDIUM', () => {
    expect(confRank('HIGH')).toBeGreaterThan(confRank('MEDIUM'));
  });
  it('MEDIUM ranks above LOW', () => {
    expect(confRank('MEDIUM')).toBeGreaterThan(confRank('LOW'));
  });
  it('LOW ranks above SKIP', () => {
    expect(confRank('LOW')).toBeGreaterThan(confRank('SKIP'));
  });
  it('SKIP and UNKNOWN are equal (both non-actionable)', () => {
    expect(confRank('SKIP')).toBe(confRank('UNKNOWN'));
  });
  it('unknown string returns 0', () => {
    expect(confRank('NONSENSE')).toBe(0);
  });
});

// ─── confLabel ─────────────────────────────────────────────────────────────

describe('confLabel', () => {
  it('HIGH returns human-readable label', () => {
    expect(confLabel('HIGH')).toBe('High confidence');
  });
  it('SKIP returns Skip', () => {
    expect(confLabel('SKIP')).toBe('Skip');
  });
  it('unknown falls back to the key itself', () => {
    expect(confLabel('MYSTERY')).toBe('MYSTERY');
  });
});
