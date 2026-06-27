import { describe, it, expect } from 'vitest';
import {
  categorizeProp,
  parsePrizePicksData,
  parseOddsData,
  findMatch,
  getPlayerOdds,
  getSetSpread,
  buildPicks,
  deduplicatePicks,
} from '../src/utils/matching.js';

// ─── Mock data factories ───────────────────────────────────────────────────

function makePPRaw({ overrides = [] } = {}) {
  const defaults = [
    {
      id: 'proj_fs_1',
      type: 'projection',
      attributes: { stat_type: 'Fantasy Score', line_score: '18.5', status: 'pre_game', start_time: '2024-01-15T18:00:00Z' },
      relationships: { new_player: { data: { id: 'p_tommy', type: 'new_player' } } },
    },
    {
      id: 'proj_tg_1',
      type: 'projection',
      attributes: { stat_type: 'Total Games', line_score: '20.5', status: 'pre_game', start_time: '2024-01-15T18:00:00Z' },
      relationships: { new_player: { data: { id: 'p_djokovic', type: 'new_player' } } },
    },
    {
      id: 'proj_tgo_1',
      type: 'projection',
      attributes: { stat_type: 'Player Total Games', line_score: '5.5', status: 'pre_game', start_time: '2024-01-15T18:00:00Z' },
      relationships: { new_player: { data: { id: 'p_alcaraz', type: 'new_player' } } },
    },
    {
      id: 'proj_aces_skip',
      type: 'projection',
      attributes: { stat_type: 'Aces', line_score: '4.5', status: 'pre_game' },
      relationships: { new_player: { data: { id: 'p_tommy', type: 'new_player' } } },
    },
  ];
  return {
    data: [...defaults, ...overrides],
    included: [
      { id: 'p_tommy',    type: 'new_player', attributes: { name: 'Tommy Paul'      } },
      { id: 'p_djokovic', type: 'new_player', attributes: { name: 'Novak Djokovic'  } },
      { id: 'p_alcaraz',  type: 'new_player', attributes: { name: 'Carlos Alcaraz'  } },
    ],
  };
}

function makeOddsRaw() {
  return [
    {
      id: 'event_1',
      sport_key: 'tennis_atp',
      sport_title: 'ATP Tour',
      commence_time: '2024-01-15T18:00:00Z',
      home_team: 'Tommy Paul',
      away_team: 'Rafael Nadal',
      bookmakers: [
        {
          key: 'draftkings',
          title: 'DraftKings',
          markets: [
            {
              key: 'h2h',
              outcomes: [
                { name: 'Tommy Paul',   price: -160 },
                { name: 'Rafael Nadal', price:  130 },
              ],
            },
            {
              key: 'spreads',
              outcomes: [
                { name: 'Tommy Paul',   price: -110, point: -1.5 },
                { name: 'Rafael Nadal', price: -110, point:  1.5 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'event_2',
      sport_key: 'tennis_atp',
      sport_title: 'ATP Tour',
      commence_time: '2024-01-15T20:00:00Z',
      home_team: 'Novak Djokovic',
      away_team: 'Carlos Alcaraz',
      bookmakers: [
        {
          key: 'bovada',
          title: 'Bovada',
          markets: [
            {
              key: 'h2h',
              outcomes: [
                { name: 'Novak Djokovic', price: -280 },
                { name: 'Carlos Alcaraz', price:  220 },
              ],
            },
          ],
        },
      ],
    },
  ];
}

// ─── categorizeProp ────────────────────────────────────────────────────────

describe('categorizeProp', () => {
  it('"Fantasy Score" → fantasy_score', () => {
    expect(categorizeProp('Fantasy Score')).toBe('fantasy_score');
  });
  it('"fantasy score" (lowercase) → fantasy_score', () => {
    expect(categorizeProp('fantasy score')).toBe('fantasy_score');
  });
  it('"Tennis Fantasy Score" → fantasy_score', () => {
    expect(categorizeProp('Tennis Fantasy Score')).toBe('fantasy_score');
  });
  it('"Total Games" → total_games', () => {
    expect(categorizeProp('Total Games')).toBe('total_games');
  });
  it('"Tennis Total Games" → total_games', () => {
    expect(categorizeProp('Tennis Total Games')).toBe('total_games');
  });
  it('"Player Total Games" → total_games_one', () => {
    expect(categorizeProp('Player Total Games')).toBe('total_games_one');
  });
  it('"Games Played" → total_games_one', () => {
    expect(categorizeProp('Games Played')).toBe('total_games_one');
  });
  it('"Aces" → skip', () => {
    expect(categorizeProp('Aces')).toBe('skip');
  });
  it('"Double Faults" → skip', () => {
    expect(categorizeProp('Double Faults')).toBe('skip');
  });
  it('"Break Points" → skip', () => {
    expect(categorizeProp('Break Points')).toBe('skip');
  });
  it('"Goblins" → skip (demo fantasy name)', () => {
    expect(categorizeProp('Goblins')).toBe('skip');
  });
  it('unknown stat type → skip', () => {
    expect(categorizeProp('XYZ Unknown')).toBe('skip');
  });
  it('empty string → skip', () => {
    expect(categorizeProp('')).toBe('skip');
  });
});

// ─── parsePrizePicksData ───────────────────────────────────────────────────

describe('parsePrizePicksData', () => {
  it('returns an array', () => {
    expect(Array.isArray(parsePrizePicksData(makePPRaw()))).toBe(true);
  });
  it('parses player names from included', () => {
    const props = parsePrizePicksData(makePPRaw());
    expect(props.map(p => p.playerName)).toContain('Tommy Paul');
  });
  it('correctly parses line as a number', () => {
    const props = parsePrizePicksData(makePPRaw());
    const fs = props.find(p => p.statType === 'Fantasy Score');
    expect(typeof fs.line).toBe('number');
    expect(fs.line).toBe(18.5);
  });
  it('filters out Aces (always skip)', () => {
    const props = parsePrizePicksData(makePPRaw());
    expect(props.find(p => p.statType === 'Aces')).toBeUndefined();
  });
  it('filters out non-pre_game status', () => {
    const raw = makePPRaw({
      overrides: [{
        id: 'proj_live',
        type: 'projection',
        attributes: { stat_type: 'Fantasy Score', line_score: '14.5', status: 'in_progress' },
        relationships: { new_player: { data: { id: 'p_djokovic', type: 'new_player' } } },
      }],
    });
    const props = parsePrizePicksData(raw);
    expect(props.find(p => p.id === 'proj_live')).toBeUndefined();
  });
  it('keeps pre_game props', () => {
    const props = parsePrizePicksData(makePPRaw());
    expect(props.find(p => p.id === 'proj_fs_1')).toBeDefined();
  });
  it('includes props without a status field (old API format)', () => {
    const raw = makePPRaw({
      overrides: [{
        id: 'proj_no_status',
        type: 'projection',
        attributes: { stat_type: 'Total Games', line_score: '21.5' },  // no status
        relationships: { new_player: { data: { id: 'p_tommy', type: 'new_player' } } },
      }],
    });
    const props = parsePrizePicksData(raw);
    expect(props.find(p => p.id === 'proj_no_status')).toBeDefined();
  });
  it('filters out props with no player in included', () => {
    const raw = makePPRaw({
      overrides: [{
        id: 'proj_orphan',
        type: 'projection',
        attributes: { stat_type: 'Fantasy Score', line_score: '16.5', status: 'pre_game' },
        relationships: { new_player: { data: { id: 'p_UNKNOWN', type: 'new_player' } } },
      }],
    });
    const props = parsePrizePicksData(raw);
    expect(props.find(p => p.id === 'proj_orphan')).toBeUndefined();
  });
  it('handles empty/null input', () => {
    expect(parsePrizePicksData(null)).toEqual([]);
    expect(parsePrizePicksData({})).toEqual([]);
    expect(parsePrizePicksData({ data: [], included: [] })).toEqual([]);
  });
  it('assigns correct propType to each stat', () => {
    const props = parsePrizePicksData(makePPRaw());
    expect(props.find(p => p.id === 'proj_fs_1')?.propType).toBe('fantasy_score');
    expect(props.find(p => p.id === 'proj_tg_1')?.propType).toBe('total_games');
    expect(props.find(p => p.id === 'proj_tgo_1')?.propType).toBe('total_games_one');
  });
});

// ─── parseOddsData ─────────────────────────────────────────────────────────

describe('parseOddsData', () => {
  it('returns an array', () => {
    expect(Array.isArray(parseOddsData(makeOddsRaw()))).toBe(true);
  });
  it('parses both events', () => {
    expect(parseOddsData(makeOddsRaw()).length).toBe(2);
  });
  it('identifies the favorite correctly (-160 vs +130)', () => {
    const matches = parseOddsData(makeOddsRaw());
    const event1 = matches.find(m => m.id === 'event_1');
    expect(event1.favName).toBe('Tommy Paul');
    expect(event1.favOdds).toBe(-160);
    expect(event1.dogName).toBe('Rafael Nadal');
  });
  it('identifies favorite for heavy odds (-280 vs +220)', () => {
    const matches = parseOddsData(makeOddsRaw());
    const event2 = matches.find(m => m.id === 'event_2');
    expect(event2.favName).toBe('Novak Djokovic');
    expect(event2.favOdds).toBe(-280);
  });
  it('includes both player names', () => {
    const matches = parseOddsData(makeOddsRaw());
    expect(matches[0].player1).toBeTruthy();
    expect(matches[0].player2).toBeTruthy();
  });
  it('prefers DraftKings over Bovada when both present', () => {
    const oddsWithBoth = [
      {
        id: 'event_multi',
        sport_key: 'tennis_atp',
        sport_title: 'ATP',
        commence_time: '2024-01-15T18:00:00Z',
        home_team: 'A',
        away_team: 'B',
        bookmakers: [
          { key: 'bovada',     title: 'Bovada',     markets: [{ key: 'h2h', outcomes: [{ name: 'A', price: -110 }, { name: 'B', price: -110 }] }] },
          { key: 'draftkings', title: 'DraftKings', markets: [{ key: 'h2h', outcomes: [{ name: 'A', price: -120 }, { name: 'B', price: 100  }] }] },
        ],
      },
    ];
    const matches = parseOddsData(oddsWithBoth);
    expect(matches[0].bookmaker).toBe('DraftKings');
  });
  it('extracts set spread from spreads market (flips sign for formula)', () => {
    const matches = parseOddsData(makeOddsRaw());
    const event1  = matches.find(m => m.id === 'event_1');
    // Tommy Paul has spreads point: -1.5, stored as-is in the spreads object
    // getSetSpread then flips it to +1.5
    expect(event1.spreads).toBeDefined();
    const normKey = 'tommy paul';
    expect(event1.spreads[normKey]).toBe(-1.5);
  });
  it('handles missing bookmakers gracefully', () => {
    const raw = [{ id: 'e', sport_key: 'x', sport_title: 'X', commence_time: '', home_team: 'A', away_team: 'B', bookmakers: [] }];
    expect(parseOddsData(raw)).toEqual([]);
  });
  it('handles null/non-array input', () => {
    expect(parseOddsData(null)).toEqual([]);
    expect(parseOddsData(undefined)).toEqual([]);
  });
});

// ─── findMatch ─────────────────────────────────────────────────────────────

describe('findMatch', () => {
  it('finds a match by exact player name', () => {
    const matches = parseOddsData(makeOddsRaw());
    const m = findMatch('Tommy Paul', matches);
    expect(m).not.toBeNull();
    expect(m.id).toBe('event_1');
  });
  it('finds a match by last name', () => {
    const matches = parseOddsData(makeOddsRaw());
    const m = findMatch('Djokovic', matches);
    expect(m).not.toBeNull();
    expect(m.id).toBe('event_2');
  });
  it('finds a match with abbreviated name', () => {
    const matches = parseOddsData(makeOddsRaw());
    const m = findMatch('T. Paul', matches);
    expect(m).not.toBeNull();
  });
  it('returns null when no match found', () => {
    const matches = parseOddsData(makeOddsRaw());
    expect(findMatch('Pete Sampras', matches)).toBeNull();
  });
  it('returns null on empty matches array', () => {
    expect(findMatch('Tommy Paul', [])).toBeNull();
  });
});

// ─── getPlayerOdds ─────────────────────────────────────────────────────────

describe('getPlayerOdds', () => {
  it('returns correct odds for player 1', () => {
    const matches = parseOddsData(makeOddsRaw());
    const match   = matches.find(m => m.id === 'event_1');
    const result  = getPlayerOdds('Tommy Paul', match);
    expect(result.odds).toBe(-160);
    expect(result.role).toBe('favorite');
    expect(result.opponentOdds).toBe(130);
  });
  it('returns correct odds for player 2', () => {
    const matches = parseOddsData(makeOddsRaw());
    const match   = matches.find(m => m.id === 'event_1');
    const result  = getPlayerOdds('Rafael Nadal', match);
    expect(result.odds).toBe(130);
    expect(result.role).toBe('underdog');
    expect(result.opponentOdds).toBe(-160);
  });
  it('identifies underdog correctly (positive odds)', () => {
    const matches = parseOddsData(makeOddsRaw());
    const match   = matches.find(m => m.id === 'event_2');
    const result  = getPlayerOdds('Carlos Alcaraz', match);
    expect(result.role).toBe('underdog');
  });
  it('identifies favorite correctly (negative odds)', () => {
    const matches = parseOddsData(makeOddsRaw());
    const match   = matches.find(m => m.id === 'event_2');
    const result  = getPlayerOdds('Novak Djokovic', match);
    expect(result.role).toBe('favorite');
  });
});

// ─── getSetSpread ──────────────────────────────────────────────────────────

describe('getSetSpread', () => {
  it('uses actual spreads market when available (flips sign)', () => {
    const matches = parseOddsData(makeOddsRaw());
    const match   = matches.find(m => m.id === 'event_1');
    // Tommy Paul has spreads point -1.5 → formula gets +1.5
    const spread = getSetSpread('Tommy Paul', match, -160);
    expect(spread).toBe(1.5);
  });
  it('opponent gets flipped +1.5 → -1.5', () => {
    const matches = parseOddsData(makeOddsRaw());
    const match   = matches.find(m => m.id === 'event_1');
    // Rafael Nadal has spreads point +1.5 → formula gets -1.5
    const spread = getSetSpread('Rafael Nadal', match, 130);
    expect(spread).toBe(-1.5);
  });
  it('falls back to estimation when no spreads market', () => {
    const matches = parseOddsData(makeOddsRaw());
    const match   = matches.find(m => m.id === 'event_2');  // event_2 has no spreads
    // Should use estimateSetSpread(-280) = +1.5
    const spread = getSetSpread('Novak Djokovic', match, -280);
    expect(typeof spread).toBe('number');
    expect(spread).toBe(1.5);
  });
});

// ─── buildPicks ────────────────────────────────────────────────────────────

describe('buildPicks', () => {
  it('returns an array', () => {
    const props   = parsePrizePicksData(makePPRaw());
    const matches = parseOddsData(makeOddsRaw());
    expect(Array.isArray(buildPicks(props, matches))).toBe(true);
  });

  it('fantasy score prop without ace override → rec=NEEDS_ACES', () => {
    const props   = parsePrizePicksData(makePPRaw());
    const matches = parseOddsData(makeOddsRaw());
    const picks   = buildPicks(props, matches);
    const fs      = picks.find(p => p.propType === 'fantasy_score');
    expect(fs).toBeDefined();
    expect(fs.rec).toBe('NEEDS_ACES');
    expect(fs.needsAces).toBe(true);
  });

  it('fantasy score with ace override calculates correctly', () => {
    const props   = parsePrizePicksData(makePPRaw());
    const matches = parseOddsData(makeOddsRaw());
    // Tommy Paul: favorite (-160), spread from market → +1.5, aces = 4
    // Projected: 13 + 1.5 + 4 = 18.5 vs line 18.5 → edge 0 → UNDER LOW
    const picks = buildPicks(props, matches, { 'Tommy Paul': 4 });
    const fs    = picks.find(p => p.propType === 'fantasy_score');
    expect(fs).toBeDefined();
    expect(fs.rec).not.toBe('NEEDS_ACES');
    expect(fs.projected).toBeCloseTo(18.5, 1);
    expect(typeof fs.edge).toBe('number');
  });

  it('total games prop calculates without ace override', () => {
    const props   = parsePrizePicksData(makePPRaw());
    const matches = parseOddsData(makeOddsRaw());
    const picks   = buildPicks(props, matches);
    const tg      = picks.find(p => p.propType === 'total_games');
    expect(tg).toBeDefined();
    expect(['UNDER', 'SKIP']).toContain(tg.rec);
    expect(tg.needsAces).toBe(false);
  });

  it('total games one prop gets an approximate flag', () => {
    const props   = parsePrizePicksData(makePPRaw());
    const matches = parseOddsData(makeOddsRaw());
    const picks   = buildPicks(props, matches);
    const tgo     = picks.find(p => p.propType === 'total_games_one');
    expect(tgo?.approximate).toBe(true);
  });

  it('excludes props with no matching sportsbook event', () => {
    const props   = parsePrizePicksData(makePPRaw());
    const picks   = buildPicks(props, []);  // empty matches
    expect(picks.length).toBe(0);
  });

  it('sorts HIGH confidence picks before LOW', () => {
    const props   = parsePrizePicksData(makePPRaw());
    const matches = parseOddsData(makeOddsRaw());
    // Give Tommy Paul aces to create a HIGH confidence pick
    const picks   = buildPicks(props, matches, { 'Tommy Paul': 10 });
    const actionable = picks.filter(p => p.rec !== 'SKIP' && p.rec !== 'NEEDS_ACES');
    for (let i = 1; i < actionable.length; i++) {
      const prev = actionable[i - 1];
      const curr = actionable[i];
      const confOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      expect((confOrder[prev.conf] ?? 0)).toBeGreaterThanOrEqual(confOrder[curr.conf] ?? 0);
    }
  });

  it('NEEDS_ACES picks appear after actionable picks', () => {
    const props   = parsePrizePicksData(makePPRaw());
    const matches = parseOddsData(makeOddsRaw());
    const picks   = buildPicks(props, matches);
    const firstNeedsAcesIdx = picks.findIndex(p => p.rec === 'NEEDS_ACES');
    const lastActionableIdx = picks.reduce((max, p, i) => p.rec !== 'SKIP' && p.rec !== 'NEEDS_ACES' ? i : max, -1);
    if (firstNeedsAcesIdx !== -1 && lastActionableIdx !== -1) {
      expect(firstNeedsAcesIdx).toBeGreaterThan(lastActionableIdx);
    }
  });

  it('ace override uses fuzzy name matching (abbreviated key)', () => {
    const props   = parsePrizePicksData(makePPRaw());
    const matches = parseOddsData(makeOddsRaw());
    // Key "T. Paul" should match prop for "Tommy Paul"
    const picks = buildPicks(props, matches, { 'T. Paul': 4 });
    const fs    = picks.find(p => p.propType === 'fantasy_score');
    expect(fs?.rec).not.toBe('NEEDS_ACES');
  });

  it('handles empty ppProps', () => {
    const matches = parseOddsData(makeOddsRaw());
    expect(buildPicks([], matches)).toEqual([]);
  });
});

// ─── deduplicatePicks ──────────────────────────────────────────────────────

describe('deduplicatePicks', () => {
  it('removes duplicate player+statType entries', () => {
    const base = {
      id: 'proj_dup',
      playerId: 'p_tommy',
      playerName: 'Tommy Paul',
      statType: 'Fantasy Score',
      propType: 'fantasy_score',
      line: 18.5,
      startTime: '',
      description: '',
    };
    const picks = [
      { ...base, id: 'a', conf: 'HIGH',   rec: 'OVER',  edge: 3.5, projected: 22, needsAces: false, match: {}, playerOdds: -160, opponentOdds: 130, role: 'favorite', setSpread: 1.5 },
      { ...base, id: 'b', conf: 'MEDIUM', rec: 'UNDER', edge: -2,  projected: 16, needsAces: false, match: {}, playerOdds: -160, opponentOdds: 130, role: 'favorite', setSpread: 1.5 },
    ];
    const deduped = deduplicatePicks(picks);
    expect(deduped.length).toBe(1);
    expect(deduped[0].conf).toBe('HIGH');  // kept the higher confidence one
  });
  it('keeps distinct player+statType combos', () => {
    const a = { id: 'a', playerName: 'Tommy Paul',     statType: 'Fantasy Score', conf: 'HIGH', edge: 3, match: {} };
    const b = { id: 'b', playerName: 'Tommy Paul',     statType: 'Total Games',   conf: 'HIGH', edge: 3, match: {} };
    const c = { id: 'c', playerName: 'Novak Djokovic', statType: 'Fantasy Score', conf: 'HIGH', edge: 3, match: {} };
    const deduped = deduplicatePicks([a, b, c]);
    expect(deduped.length).toBe(3);
  });
  it('returns same array length when no duplicates', () => {
    const picks = [
      { id: 'a', playerName: 'A', statType: 'Fantasy Score', conf: 'HIGH', match: {} },
      { id: 'b', playerName: 'B', statType: 'Total Games',   conf: 'MEDIUM', match: {} },
    ];
    expect(deduplicatePicks(picks).length).toBe(2);
  });
  it('handles empty array', () => {
    expect(deduplicatePicks([])).toEqual([]);
  });
});
