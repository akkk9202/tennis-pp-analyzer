import { useState, useEffect } from 'react';
import { moneylineToProb } from '../utils/calculations.js';

const CONF_CLASS   = { HIGH:'high', MEDIUM:'medium', LOW:'low', SKIP:'skip', UNKNOWN:'skip', NEEDS_ACES:'needs-aces' };
const CONF_BADGE   = { HIGH:'badge-high', MEDIUM:'badge-medium', LOW:'badge-low', SKIP:'badge-skip', NEEDS_ACES:'badge-blue' };

const QUICK_LINKS = [
  { label:'PrizePicks', url:'https://app.prizepicks.com',                        color:'#7c3aed' },
  { label:'Bovada',     url:'https://www.bovada.lv/sports/tennis',               color:'#dc2626' },
  { label:'Bet365',     url:'https://www.bet365.com/#/AS/B13/',                  color:'#1a5c38' },
  { label:'DraftKings', url:'https://sportsbook.draftkings.com/leagues/tennis',  color:'#2563eb' },
];

export default function Dashboard({ picksData, apiKey }) {
  const { picks, matches, loading, error, ppWarning, udWarning, lastUpdated, requestsRemaining, refresh, setAces } = picksData;
  const [aceInputs, setAceInputs] = useState({});
  const [aceOpen, setAceOpen]     = useState(null);
  const [showSkipped, setShowSkipped] = useState(false);

  useEffect(() => {
    if (apiKey) refresh(apiKey);
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const actionable = picks.filter(p => p.rec !== 'SKIP' && p.rec !== 'NEEDS_ACES');
  const needsAces  = picks.filter(p => p.rec === 'NEEDS_ACES');
  const skipped    = picks.filter(p => p.rec === 'SKIP');

  function submitAce(playerName) {
    const val = parseFloat(aceInputs[playerName] ?? '');
    if (isNaN(val) || val < 0) return;
    setAces(playerName, val);
    setAceOpen(null);
  }

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="flex-between mb-16">
        <div>
          <h2>Today's picks</h2>
          {lastUpdated && (
            <p className="text-xs text-dim mt-4">
              Updated {lastUpdated.toLocaleTimeString()}
              {requestsRemaining !== null && ` · ${requestsRemaining} API calls remaining`}
            </p>
          )}
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => refresh(apiKey, true)}
          disabled={loading || !apiKey}
        >
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {/* ── Quick links ── */}
      <div className="flex gap-8 mb-16" style={{ flexWrap: 'wrap' }}>
        {QUICK_LINKS.map(l => (
          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
            style={{ padding:'5px 12px', background:`${l.color}22`, color:l.color,
              border:`1px solid ${l.color}44`, borderRadius:20, fontSize:12, fontWeight:600, textDecoration:'none' }}>
            ↗ {l.label}
          </a>
        ))}
      </div>

      {/* ── No key ── */}
      {!apiKey && (
        <div className="alert alert-info">
          <strong>No Odds API key configured.</strong> Go to Settings and enter your free key from{' '}
          <a href="https://the-odds-api.com" target="_blank" rel="noreferrer" style={{ color:'var(--blue)' }}>
            the-odds-api.com
          </a>{' '}
          to auto-load picks.
        </div>
      )}

      {/* ── Errors / warnings ── */}
      {error    && <div className="alert alert-error">{error}</div>}
      {ppWarning && <div className="alert alert-warning">{ppWarning}</div>}
      {udWarning && <div className="alert alert-warning">{udWarning}</div>}

      {/* ── Loading skeletons ── */}
      {loading && [80, 72, 64].map((h, i) => (
        <div key={i} className="skeleton" style={{ height:h, marginBottom:8 }} />
      ))}

      {/* ── Actionable picks ── */}
      {!loading && actionable.length > 0 && (
        <section className="mb-16">
          <p className="section-label">Actionable — {actionable.length}</p>
          {actionable.map(p => <PickCard key={p.id} pick={p} />)}
        </section>
      )}

      {/* ── Fantasy Score waiting for aces ── */}
      {!loading && needsAces.length > 0 && (
        <section className="mb-16">
          <p className="section-label">
            Fantasy score — enter expected ace count from Bet365 ({needsAces.length})
          </p>
          {needsAces.map(p => (
            <div key={p.id} className={`pick-card ${CONF_CLASS[p.conf] ?? 'skip'}`}>
              <div>
                <div className="flex gap-8">
                  <span style={{ fontSize:15, fontWeight:600 }}>{p.playerName}</span>
                  <span className="badge badge-blue">Needs aces</span>
                </div>
                <div className="text-xs text-muted mt-4">
                  Fantasy Score · Line: {p.line} · {p.role} · Spread: {p.setSpread >= 0 ? '+' : ''}{p.setSpread.toFixed(1)}
                  {p.match && ` · ${p.match.tournament}`}
                </div>
                <div className="text-xs text-dim mt-4">
                  Formula: {p.role === 'favorite' ? 13 : 7} (base) + {p.setSpread >= 0 ? '+' : ''}{p.setSpread.toFixed(1)} (spread) + aces → compare to {p.line}
                </div>
              </div>
              <div>
                {aceOpen === p.id ? (
                  <div className="flex gap-8">
                    <input
                      type="number" min="0" max="30" step="1" placeholder="aces"
                      value={aceInputs[p.playerName] ?? ''}
                      onChange={e => setAceInputs(prev => ({ ...prev, [p.playerName]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && submitAce(p.playerName)}
                      autoFocus
                      style={{ width:64, padding:'6px 8px', background:'var(--bg)',
                        border:'1px solid var(--border)', borderRadius:'var(--radius)',
                        color:'var(--text)', fontSize:14 }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => submitAce(p.playerName)}>Go</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setAceOpen(null)}>✕</button>
                  </div>
                ) : (
                  <button className="btn btn-secondary btn-sm" onClick={() => setAceOpen(p.id)}>
                    Enter aces →
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Empty state ── */}
      {!loading && apiKey && !error && picks.length === 0 && (
        <div className="empty-state">
          <p>No tennis picks found for today.</p>
          <p>
            Matches may not be live yet, or PrizePicks hasn't listed props.
            Try refreshing later or use the Calculator tab to analyze manually.
          </p>
        </div>
      )}

      {/* ── Skipped picks (collapsed) ── */}
      {!loading && skipped.length > 0 && (
        <section className="mb-16">
          <button className="btn btn-secondary btn-sm" style={{ marginBottom:8 }}
            onClick={() => setShowSkipped(s => !s)}>
            {showSkipped ? '▾' : '▸'} Skipped — {skipped.length}
          </button>
          {showSkipped && skipped.map(p => <PickCard key={p.id} pick={p} />)}
        </section>
      )}

      {/* ── Matched sportsbook events ── */}
      {!loading && matches.length > 0 && (
        <section>
          <p className="section-label">Sportsbook events pulled ({matches.length})</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>ML odds</th>
                  <th>Fav prob</th>
                  <th>Book</th>
                  <th>Tournament</th>
                </tr>
              </thead>
              <tbody>
                {matches.map(m => {
                  const favProb = moneylineToProb(m.favOdds);
                  return (
                    <tr key={m.id}>
                      <td><span className="bold">{m.favName}</span> vs {m.dogName}</td>
                      <td className="mono">
                        {m.favOdds > 0 ? '+' : ''}{m.favOdds} / {m.dogOdds > 0 ? '+' : ''}{m.dogOdds}
                      </td>
                      <td className="text-sm text-muted">{favProb.toFixed(0)}%</td>
                      <td className="text-xs text-dim">{m.bookmaker}</td>
                      <td className="text-xs text-dim" style={{ maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {m.tournament}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function PickCard({ pick }) {
  const confClass = CONF_CLASS[pick.conf] ?? 'skip';
  const badgeClass = CONF_BADGE[pick.conf] ?? 'badge-skip';
  const isOver  = pick.rec === 'OVER';
  const isUnder = pick.rec === 'UNDER';

  return (
    <div className={`pick-card ${confClass}`}>
      <div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <span style={{ fontSize:15, fontWeight:600 }}>{pick.playerName}</span>
          <span className={`badge ${badgeClass}`}>{pick.conf}</span>
          {pick.source === 'underdog' && (
            <span className="badge" style={{ background:'#1a0a2e', color:'#a78bfa', border:'1px solid #4c1d95', fontSize:10 }}>Underdog</span>
          )}
          {pick.source === 'prizepicks' && (
            <span className="badge" style={{ background:'#0f0a2e', color:'#818cf8', border:'1px solid #3730a3', fontSize:10 }}>PrizePicks</span>
          )}
          {pick.approximate && (
            <span className="badge badge-skip" title="Under odds estimated from h2h moneyline — verify on sportsbook for highest accuracy">
              ~est
            </span>
          )}
        </div>
        <div className="text-xs text-muted mt-4">
          {pick.statType} · Line: {pick.line} · {pick.role}
          {pick.match && ` · ${pick.match.tournament}`}
        </div>
        {pick.propType === 'fantasy_score' && pick.projected !== null && (
          <div className="text-xs text-dim mt-4">
            Projected: {pick.projected.toFixed(1)} · Edge: {pick.edge >= 0 ? '+' : ''}{pick.edge.toFixed(1)}
          </div>
        )}
        {pick.propType === 'total_games' && pick.prob !== undefined && (
          <div className="text-xs text-dim mt-4">
            Fav win probability: {pick.prob.toFixed(0)}%
          </div>
        )}
        {pick.propType === 'total_games_one' && (
          <div className="text-xs text-dim mt-4">
            Implied prob: {pick.prob?.toFixed(0)}% · Threshold met: {pick.meetsThreshold ? 'Yes' : 'No'}
            {pick.approximate && ' · Verify actual under odds on sportsbook'}
          </div>
        )}
      </div>
      <div className="center" style={{ minWidth:64 }}>
        <div style={{ fontSize:20, fontWeight:700,
          color: isOver ? 'var(--green)' : isUnder ? 'var(--red)' : 'var(--text-muted)' }}>
          {isOver ? '↑' : isUnder ? '↓' : '—'}
        </div>
        <div style={{ fontSize:13, fontWeight:700,
          color: isOver ? 'var(--green)' : isUnder ? 'var(--red)' : 'var(--text-muted)' }}>
          {pick.rec === 'SKIP' ? 'SKIP' : pick.rec}
        </div>
        <div className="text-xs text-dim">{pick.role}</div>
      </div>
    </div>
  );
}
