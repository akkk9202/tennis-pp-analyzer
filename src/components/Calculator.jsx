import { useState } from 'react';
import { fantasyScoreRec, totalGamesRec, totalGamesWonRec, moneylineToProb } from '../utils/calculations.js';

const TABS = ['Fantasy Score', 'Total Games', 'Total Games Won'];

export default function Calculator() {
  const [tab, setTab] = useState(0);

  return (
    <div className="page">
      <h2 className="mb-16">Manual calculator</h2>
      <div className="tabs">
        {TABS.map((t, i) => (
          <button key={t} className={`tab-btn ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 0 && <FantasyScoreCalc />}
      {tab === 1 && <TotalGamesCalc />}
      {tab === 2 && <TotalGamesWonCalc />}
    </div>
  );
}

// ─── Fantasy Score ─────────────────────────────────────────────────────────

function FantasyScoreCalc() {
  const [role, setRole]     = useState('favorite');
  const [spread, setSpread] = useState('');
  const [aces, setAces]     = useState('');
  const [line, setLine]     = useState('');
  const [result, setResult] = useState(null);
  const [error, setError]   = useState('');

  function calculate() {
    const sp = parseFloat(spread);
    const ac = parseFloat(aces);
    const ln = parseFloat(line);
    if ([sp, ac, ln].some(isNaN)) { setError('Fill in all three fields.'); return; }
    if (ac < 0) { setError('Aces cannot be negative.'); return; }
    setError('');
    const base = role === 'favorite' ? 13 : 7;
    setResult({ ...fantasyScoreRec({ role, setSpread: sp, aces: ac, ppLine: ln }), base, sp, ac, ln });
  }

  return (
    <div>
      <div className="alert alert-info">
        <strong>Formula:</strong> base ({role === 'favorite' ? 13 : 7}) + set spread + expected aces = projected score — compare to PrizePicks line.
        Tommy Paul example: 13 + 1.5 + 4 = <strong>18.5</strong>
      </div>

      <div className="field">
        <label>Player role</label>
        <div className="flex gap-8">
          {[['favorite', 'Favorite (base 13)'], ['underdog', 'Underdog (base 7)']].map(([v, lbl]) => (
            <button
              key={v}
              onClick={() => setRole(v)}
              style={{
                flex: 1,
                padding: '9px 8px',
                background: role === v ? 'var(--surface-2)' : 'var(--surface)',
                color: role === v ? 'var(--text)' : 'var(--text-dim)',
                border: `1px solid ${role === v ? 'var(--green-dim)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                fontSize: 13,
                fontWeight: role === v ? 600 : 400,
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <NumberField
        label="Set spread (from sportsbook)"
        value={spread} onChange={setSpread}
        placeholder="1.5 or -1.5" step="0.5"
        hint="Straight-set favorite = +1.5. Enter negative if player expected to lose a set."
      />
      <NumberField
        label="Expected aces (from Bet365 ace line)"
        value={aces} onChange={setAces}
        placeholder="4" step="1"
        hint="Raw ace count — added directly to projected score."
      />
      <NumberField
        label="PrizePicks fantasy score line"
        value={line} onChange={setLine}
        placeholder="18.5" step="0.5"
        hint="The over/under line shown on PrizePicks for this player."
      />

      {error && <p className="text-xs" style={{ color: 'var(--red)', marginBottom: 12 }}>{error}</p>}
      <button className="btn btn-primary btn-full" onClick={calculate}>Calculate →</button>

      {result && (
        <ResultCard
          rec={result.rec} conf={result.conf}
          breakdown={[
            { label: `Base (${role})`,         value: result.base },
            { label: 'Set spread',             value: (result.sp >= 0 ? '+' : '') + result.sp },
            { label: 'Expected aces',          value: '+' + result.ac },
            { label: 'Projected score',        value: result.projected.toFixed(1), bold: true },
            { label: 'PrizePicks line',         value: result.ln },
            { label: 'Edge',                   value: (result.edge >= 0 ? '+' : '') + result.edge.toFixed(1), bold: true },
          ]}
          note={result.rec === 'OVER'
            ? `Projected ${result.projected.toFixed(1)} beats the PP line ${result.ln} by ${result.edge.toFixed(1)} pts. Bet OVER.`
            : `Projected ${result.projected.toFixed(1)} is below the PP line ${result.ln} by ${Math.abs(result.edge).toFixed(1)} pts. Bet UNDER.`}
        />
      )}
      {result && <Checklist />}
    </div>
  );
}

// ─── Total Games ───────────────────────────────────────────────────────────

function TotalGamesCalc() {
  const [ml, setMl]       = useState('');
  const [line, setLine]   = useState('');
  const [result, setResult] = useState(null);
  const [error, setError]   = useState('');

  function calculate() {
    const odds = parseFloat(ml);
    const ln   = parseFloat(line);
    if (isNaN(odds) || isNaN(ln)) { setError('Fill in both fields.'); return; }
    setError('');
    const r = totalGamesRec(odds);
    setResult({ ...r, odds, ln });
  }

  return (
    <div>
      <div className="alert alert-info">
        <strong>Logic:</strong> heavy favorite → straight-set win → fewer total games → UNDER. Enter the favorite's moneyline.
      </div>
      <NumberField
        label="Favorite's moneyline odds"
        value={ml} onChange={setMl}
        placeholder="-400" step="10"
        hint="Negative = favorite. From Bovada, DraftKings, etc."
      />
      <NumberField
        label="PrizePicks total games line"
        value={line} onChange={setLine}
        placeholder="20.5" step="0.5"
        hint="The over/under total games line on PrizePicks."
      />
      {error && <p className="text-xs" style={{ color: 'var(--red)', marginBottom: 12 }}>{error}</p>}
      <button className="btn btn-primary btn-full" onClick={calculate}>Analyze →</button>

      {result && (
        <ResultCard
          rec={result.rec} conf={result.conf}
          breakdown={[
            { label: 'Moneyline',              value: (result.odds > 0 ? '+' : '') + result.odds },
            { label: 'Implied win probability', value: result.prob.toFixed(1) + '%', bold: true },
            { label: 'PP total games line',     value: result.ln },
            { label: 'Recommendation',          value: result.rec, bold: true },
          ]}
          note={
            result.rec === 'UNDER'
              ? `${result.prob.toFixed(0)}% win probability. Heavy favorite expected to win in straight sets — total games likely under ${result.ln}.`
              : `Only ${result.prob.toFixed(0)}% win probability. Match too close to find a reliable edge here.`
          }
        />
      )}
      {result && result.rec !== 'SKIP' && <Checklist />}
    </div>
  );
}

// ─── Total Games Won ────────────────────────────────────────────────────────

function TotalGamesWonCalc() {
  const [odds, setOdds]   = useState('');
  const [line, setLine]   = useState('');
  const [result, setResult] = useState(null);
  const [error, setError]   = useState('');

  function calculate() {
    const o = parseFloat(odds);
    if (isNaN(o)) { setError('Enter the under odds.'); return; }
    setError('');
    const ln = parseFloat(line) || null;
    setResult({ ...totalGamesWonRec(o), o, ln });
  }

  return (
    <div>
      <div className="alert alert-info">
        <strong>Rule:</strong> only bet if sportsbook under odds are ≤ -135. Even spreads (-25 vs -105) = even market = skip.
      </div>
      <NumberField
        label="Sportsbook under odds (for this player's games)"
        value={odds} onChange={setOdds}
        placeholder="-150" step="5"
        hint="The under line for this player's total games at a sportsbook. Must be ≤ -135 to bet."
      />
      <NumberField
        label="PrizePicks line (optional)"
        value={line} onChange={setLine}
        placeholder="5.5" step="0.5"
        hint="Optional reference — the total games one line shown on PrizePicks."
      />
      {error && <p className="text-xs" style={{ color: 'var(--red)', marginBottom: 12 }}>{error}</p>}
      <button className="btn btn-primary btn-full" onClick={calculate}>Check threshold →</button>

      {result && (
        <ResultCard
          rec={result.rec} conf={result.conf}
          breakdown={[
            { label: 'Under odds (sportsbook)',    value: (result.o > 0 ? '+' : '') + result.o },
            { label: 'Implied under probability',  value: result.prob.toFixed(1) + '%', bold: true },
            { label: 'Threshold required',         value: '≤ -135' },
            { label: 'Meets threshold?',           value: result.meetsThreshold ? '✓ Yes' : '✗ No', bold: true },
            ...(result.ln !== null ? [{ label: 'PrizePicks line', value: result.ln }] : []),
            { label: 'Recommendation',             value: result.rec, bold: true },
          ]}
          note={
            result.meetsThreshold
              ? `Under odds of ${result.o > 0 ? '+' : ''}${result.o} meet the ≤ -135 threshold (${result.prob.toFixed(0)}% implied). Bet UNDER.`
              : `Odds of ${result.o > 0 ? '+' : ''}${result.o} don't meet the -135 threshold. Market too even — skip this bet.`
          }
        />
      )}
      {result && result.rec !== 'SKIP' && <Checklist />}
    </div>
  );
}

// ─── Shared Components ─────────────────────────────────────────────────────

function NumberField({ label, value, onChange, placeholder, step, hint }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        step={step ?? '0.5'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

const CONF_COLORS = {
  HIGH:   { bg: 'var(--green-bg)',  border: '#166534',  text: 'var(--green)'  },
  MEDIUM: { bg: 'var(--yellow-bg)', border: '#92400e',  text: 'var(--yellow)' },
  LOW:    { bg: 'var(--red-bg)',    border: '#7f1d1d',  text: 'var(--red)'    },
  SKIP:   { bg: 'var(--surface)',   border: 'var(--border)', text: 'var(--text-muted)' },
};

function ResultCard({ rec, conf, breakdown, note }) {
  const c = CONF_COLORS[conf] ?? CONF_COLORS.SKIP;
  const isOver  = rec === 'OVER';
  const isUnder = rec === 'UNDER';
  const isSkip  = rec === 'SKIP';

  return (
    <div style={{ border: `2px solid ${c.border}`, borderRadius: 12, overflow: 'hidden', marginTop: 18 }}>
      <div style={{ background: c.bg, padding: '16px', textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: c.text }}>
          {isSkip ? 'Skip this bet' : isOver ? '↑ OVER' : '↓ UNDER'}
        </div>
        <div style={{ marginTop: 8 }}>
          <span className="badge" style={{ background: 'var(--surface-2)', color: c.text, border: '1px solid var(--border)' }}>
            {conf === 'SKIP' ? 'No edge' : conf.toLowerCase() + ' confidence'}
          </span>
        </div>
      </div>
      <div style={{ background: 'var(--surface)', padding: 12 }}>
        {breakdown.map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < breakdown.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span className="text-xs text-dim">{row.label}</span>
            <span className="text-xs" style={{ color: row.bold ? 'var(--text)' : 'var(--text-muted)', fontWeight: row.bold ? 600 : 400 }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
      {note && (
        <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {note}
        </div>
      )}
    </div>
  );
}

function Checklist() {
  const [checked, setChecked] = useState([false, false, false, false]);
  const items = [
    "Last-five isn't all-green (bait line check)",
    "Head-to-head history supports this pick",
    "Opponent rank filter tested in Pick Finder",
    "Line movement direction is consistent with the call",
  ];
  const allDone = checked.every(Boolean);

  return (
    <div className="card mt-16">
      <p className="section-label">Research checklist</p>
      {items.map((item, i) => (
        <label key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8, cursor: 'pointer', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={checked[i]}
            onChange={() => setChecked(c => c.map((v, j) => j === i ? !v : v))}
            style={{ marginTop: 3, accentColor: 'var(--green-dim)' }}
          />
          <span style={{ color: checked[i] ? 'var(--text-dim)' : 'var(--text-muted)', textDecoration: checked[i] ? 'line-through' : 'none' }}>
            {item}
          </span>
        </label>
      ))}
      {allDone && <div className="alert alert-success" style={{ marginBottom: 0, marginTop: 8 }}>All checks done — pick is ready.</div>}
    </div>
  );
}
