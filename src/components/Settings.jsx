import { useState } from 'react';

export default function Settings({ settings, onChange }) {
  const [keyInput, setKeyInput] = useState(settings.oddsApiKey ?? '');
  const [showKey, setShowKey]   = useState(false);
  const [saved, setSaved]       = useState(false);
  const [keyErr, setKeyErr]     = useState('');

  function saveKey() {
    const k = keyInput.trim();
    if (!k) { setKeyErr('Please enter your API key.'); return; }
    if (k.length < 10) { setKeyErr('That doesn\'t look like a valid key.'); return; }
    setKeyErr('');
    const updated = { ...settings, oddsApiKey: k };
    localStorage.setItem('tppa_settings', JSON.stringify(updated));
    onChange(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function clearKey() {
    setKeyInput('');
    const updated = { ...settings, oddsApiKey: '' };
    localStorage.setItem('tppa_settings', JSON.stringify(updated));
    onChange(updated);
  }

  return (
    <div className="page">
      <h2 className="mb-16">Settings</h2>

      {/* ── Odds API key ── */}
      <div className="card mb-16">
        <p className="section-label mb-16">The Odds API key</p>

        <div className="alert alert-info">
          The Odds API provides live tennis moneylines and set spreads from Bovada, DraftKings,
          FanDuel, and others. <strong>Free tier: 500 requests/month</strong> — the app caches
          data for 5 minutes per refresh, so typical daily usage is around 5–15 requests.
        </div>

        <div className="field">
          <label>API key</label>
          <div style={{ display:'flex', gap:8 }}>
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="Paste your key here"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveKey()}
              style={{ flex:1 }}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => setShowKey(s => !s)}>
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          {keyErr && <p className="error">{keyErr}</p>}
          <p className="hint">
            Get a free key at{' '}
            <a href="https://the-odds-api.com" target="_blank" rel="noreferrer" style={{ color:'var(--blue)' }}>
              the-odds-api.com
            </a>
            {' '}— register, verify email, copy the key from your dashboard. No credit card needed.
          </p>
        </div>

        <div className="flex gap-8">
          <button className="btn btn-primary" onClick={saveKey} disabled={saved}>
            {saved ? '✓ Saved' : 'Save key'}
          </button>
          {settings.oddsApiKey && (
            <button className="btn btn-secondary" onClick={clearKey}>
              Clear key
            </button>
          )}
        </div>

        {settings.oddsApiKey && !saved && (
          <div className="alert alert-success mt-16" style={{ marginBottom:0 }}>
            Key is set. Go to the Dashboard tab and hit Refresh to load picks.
          </div>
        )}
      </div>

      {/* ── How it works ── */}
      <div className="card mb-16">
        <p className="section-label mb-16">How it works</p>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <Step n={1} title="The Odds API" text="Fetches live tennis matches + h2h moneylines + set spreads from Bovada, DraftKings, FanDuel." />
          <Step n={2} title="PrizePicks" text="Pulls today's tennis props (Fantasy Score, Total Games, Total Games One) from PrizePicks' unofficial public API. No login required." />
          <Step n={3} title="Auto-matching" text="Matches player names between both sources using fuzzy matching (handles diacritics, abbreviations, last-name-only). Unmatched props are excluded." />
          <Step n={4} title="Calculations" text="Runs each matched prop through the correct formula — Fantasy Score, Total Games, or Total Games One — and ranks by confidence." />
          <Step n={5} title="Fantasy Score aces" text="Ace lines aren't in any public API. For Fantasy Score props, enter the expected ace count from Bet365 manually. Everything else is auto-calculated." />
        </div>
      </div>

      {/* ── Calculation formulas ── */}
      <div className="card mb-16">
        <p className="section-label mb-16">Calculation formulas</p>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <FormulaBox
            title="Fantasy Score"
            formula="base(13 or 7) + set spread + expected aces = projected"
            detail="Base is 13 for favorites, 7 for underdogs. Set spread is auto-pulled from sportsbook spreads market (+1.5 = straight-set favorite). Aces entered manually from Bet365. Compare projected to PP line for edge."
            rules={['|edge| ≥ 3 → HIGH', '|edge| ≥ 1.5 → MEDIUM', '|edge| < 1.5 → LOW']}
          />
          <FormulaBox
            title="Total Games"
            formula="favorite moneyline → implied win prob → UNDER threshold"
            detail="Heavy favorites win in straight sets → fewer total games → bet UNDER the total games line."
            rules={['prob ≥ 80% → HIGH', 'prob ≥ 67% → MEDIUM', 'prob ≥ 57% → LOW', 'prob < 57% → SKIP']}
          />
          <FormulaBox
            title="Total Games One"
            formula="sportsbook under odds ≤ -135 required"
            detail="Only bet when the sportsbook under odds are -135 or stronger. Even spreads (-25 vs -105) = even market = skip."
            rules={['odds ≤ -200 → HIGH', 'odds ≤ -135 → MEDIUM', 'odds > -135 → SKIP']}
          />
          <div className="alert alert-warning" style={{ marginBottom:0 }}>
            <strong>Always skip:</strong> Aces, Double Faults, Break Points — these are the "demons and goblins" of tennis props.
          </div>
        </div>
      </div>

      {/* ── Useful links ── */}
      <div className="card mb-16">
        <p className="section-label mb-16">Useful links</p>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[
            { label:'The Odds API (get your free key)',   url:'https://the-odds-api.com' },
            { label:'PrizePicks tennis props',            url:'https://app.prizepicks.com' },
            { label:'Bet365 (ace lines for Fantasy Score)', url:'https://www.bet365.com/#/AS/B13/' },
            { label:'Bovada tennis odds',                 url:'https://www.bovada.lv/sports/tennis' },
            { label:'DraftKings Sportsbook',              url:'https://sportsbook.draftkings.com/leagues/tennis' },
          ].map(l => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
              style={{ color:'var(--blue)', fontSize:13, textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
              ↗ {l.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── Privacy note ── */}
      <div className="alert alert-info">
        <strong>Privacy:</strong> Your API key is stored only in your browser's localStorage and is sent directly to The Odds API — it never passes through any other server. PrizePicks data is fetched from their public API, no login or PII needed.
      </div>
    </div>
  );
}

function Step({ n, title, text }) {
  return (
    <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
      <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--surface-2)',
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        fontSize:12, fontWeight:700, color:'var(--text-muted)', border:'1px solid var(--border)' }}>
        {n}
      </div>
      <div>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{title}</div>
        <div className="text-xs text-muted">{text}</div>
      </div>
    </div>
  );
}

function FormulaBox({ title, formula, detail, rules }) {
  return (
    <div style={{ background:'var(--surface-2)', borderRadius:'var(--radius)', padding:'12px 14px' }}>
      <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>{title}</div>
      <div style={{ fontFamily:'monospace', fontSize:12, color:'var(--blue)', marginBottom:6, background:'var(--bg)', padding:'6px 10px', borderRadius:4 }}>
        {formula}
      </div>
      <p className="text-xs text-muted" style={{ marginBottom:8 }}>{detail}</p>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {rules.map(r => (
          <span key={r} className="badge badge-skip" style={{ fontSize:11 }}>{r}</span>
        ))}
      </div>
    </div>
  );
}
