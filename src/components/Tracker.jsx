import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'tppa_tracker_v1';

const PROP_TYPES   = ['Fantasy Score', 'Total Games', 'Total Games One'];
const CONF_LEVELS  = ['HIGH', 'MEDIUM', 'LOW'];
const RESULT_OPTS  = ['pending', 'hit', 'miss'];

const RESULT_STYLE = {
  pending: { color: 'var(--text-muted)', label: 'Pending' },
  hit:     { color: 'var(--green)',      label: '✓ Hit'    },
  miss:    { color: 'var(--red)',        label: '✗ Miss'   },
};
const CONF_COLOR = { HIGH: 'var(--green)', MEDIUM: 'var(--yellow)', LOW: 'var(--red)' };

// ─── localStorage helpers ──────────────────────────────────────────────────

function loadPicks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function savePicks(picks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

// ─── Stats helpers ─────────────────────────────────────────────────────────

function computeStats(picks) {
  const settled = picks.filter(p => p.result !== 'pending');
  const hits    = settled.filter(p => p.result === 'hit').length;
  const misses  = settled.filter(p => p.result === 'miss').length;
  const pct     = settled.length > 0 ? Math.round((hits / settled.length) * 100) : null;

  // By confidence
  const byConf = {};
  for (const conf of CONF_LEVELS) {
    const group   = settled.filter(p => p.conf === conf);
    const groupH  = group.filter(p => p.result === 'hit').length;
    byConf[conf]  = { total: group.length, hits: groupH, pct: group.length > 0 ? Math.round(groupH / group.length * 100) : null };
  }

  // Current streak
  const sorted = [...picks].sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0, streakType = null;
  for (const p of sorted) {
    if (p.result === 'pending') continue;
    if (!streakType) { streakType = p.result; streak = 1; continue; }
    if (p.result === streakType) { streak++; }
    else break;
  }

  return { total: picks.length, settled: settled.length, hits, misses, pct, byConf, streak, streakType };
}

// ─── CSV export ────────────────────────────────────────────────────────────

function exportCSV(picks) {
  const headers = ['Date', 'Player', 'Prop', 'Line', 'Pick', 'Confidence', 'Result', 'Notes'];
  const rows = picks.map(p => [
    new Date(p.date).toLocaleDateString(),
    p.player, p.propType, p.line, p.rec, p.conf, p.result, p.notes ?? '',
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `tennis-picks-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ─────────────────────────────────────────────────────────────

const EMPTY_FORM = { player:'', propType:'Fantasy Score', line:'', rec:'OVER', conf:'HIGH', notes:'' };

export default function Tracker() {
  const [picks, setPicks]       = useState(loadPicks);
  const [filter, setFilter]     = useState('all');  // all | pending | hit | miss
  const [form, setForm]         = useState(EMPTY_FORM);
  const [formErr, setFormErr]   = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // Persist whenever picks change
  useEffect(() => { savePicks(picks); }, [picks]);

  const stats    = computeStats(picks);
  const visible  = filter === 'all' ? picks : picks.filter(p => p.result === filter);
  const sorted   = [...visible].sort((a, b) => new Date(b.date) - new Date(a.date));

  // ── Form ──
  function handleAdd() {
    if (!form.player.trim())      { setFormErr('Player name required.'); return; }
    if (!form.line || isNaN(parseFloat(form.line))) { setFormErr('Valid line required (e.g. 18.5).'); return; }
    setFormErr('');
    const pick = {
      id: uid(),
      date: new Date().toISOString(),
      player: form.player.trim(),
      propType: form.propType,
      line: parseFloat(form.line),
      rec: form.rec,
      conf: form.conf,
      result: 'pending',
      notes: form.notes.trim(),
    };
    setPicks(prev => [pick, ...prev]);
    setForm(EMPTY_FORM);
  }

  const setResult = useCallback((id, result) => {
    setPicks(prev => prev.map(p => p.id === id ? { ...p, result } : p));
  }, []);

  const deletePick = useCallback((id) => {
    setPicks(prev => prev.filter(p => p.id !== id));
  }, []);

  return (
    <div className="page">
      <div className="flex-between mb-16">
        <h2>Pick tracker</h2>
        <div className="flex gap-8">
          {picks.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(picks)}>
              ↓ CSV
            </button>
          )}
          {picks.length > 0 && !confirmClear && (
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmClear(true)}>
              Clear all
            </button>
          )}
          {confirmClear && (
            <>
              <button className="btn btn-danger btn-sm" onClick={() => { setPicks([]); setConfirmClear(false); }}>
                Confirm clear
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmClear(false)}>Cancel</button>
            </>
          )}
        </div>
      </div>

      {/* ── Stats bar ── */}
      {stats.settled > 0 && (
        <div className="card mb-16">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(90px, 1fr))', gap:12, textAlign:'center' }}>
            <Stat label="Win rate" value={`${stats.pct}%`} color={stats.pct >= 55 ? 'var(--green)' : stats.pct >= 45 ? 'var(--yellow)' : 'var(--red)'} />
            <Stat label="Record" value={`${stats.hits}–${stats.misses}`} />
            <Stat label="Pending" value={stats.total - stats.settled} />
            {stats.streak > 1 && (
              <Stat
                label={stats.streakType === 'hit' ? 'Win streak' : 'Loss streak'}
                value={stats.streak}
                color={stats.streakType === 'hit' ? 'var(--green)' : 'var(--red)'}
              />
            )}
          </div>

          {/* By-confidence breakdown */}
          {CONF_LEVELS.some(c => stats.byConf[c].total > 0) && (
            <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--border)' }}>
              <p className="section-label" style={{ marginBottom:8 }}>By confidence</p>
              <div className="flex gap-12" style={{ flexWrap:'wrap' }}>
                {CONF_LEVELS.filter(c => stats.byConf[c].total > 0).map(c => (
                  <div key={c}>
                    <span style={{ fontSize:11, color: CONF_COLOR[c], fontWeight:600 }}>{c}</span>
                    <span className="text-xs text-dim"> {stats.byConf[c].hits}/{stats.byConf[c].total}</span>
                    {stats.byConf[c].pct !== null && (
                      <span className="text-xs text-muted"> ({stats.byConf[c].pct}%)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add pick form ── */}
      <div className="card mb-16">
        <p className="section-label mb-16">Log a pick</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 12px' }}>
          <div className="field" style={{ gridColumn:'1 / -1', marginBottom:0 }}>
            <label>Player name</label>
            <input
              placeholder="e.g. Tommy Paul"
              value={form.player}
              onChange={e => setForm(f => ({ ...f, player: e.target.value }))}
            />
          </div>
          <div className="field" style={{ marginBottom:0 }}>
            <label>Prop type</label>
            <select value={form.propType} onChange={e => setForm(f => ({ ...f, propType: e.target.value }))}>
              {PROP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom:0 }}>
            <label>PrizePicks line</label>
            <input
              type="number" step="0.5" placeholder="18.5"
              value={form.line}
              onChange={e => setForm(f => ({ ...f, line: e.target.value }))}
            />
          </div>
          <div className="field" style={{ marginBottom:0 }}>
            <label>Pick</label>
            <select value={form.rec} onChange={e => setForm(f => ({ ...f, rec: e.target.value }))}>
              <option value="OVER">OVER</option>
              <option value="UNDER">UNDER</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom:0 }}>
            <label>Confidence</label>
            <select value={form.conf} onChange={e => setForm(f => ({ ...f, conf: e.target.value }))}>
              {CONF_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn:'1 / -1', marginBottom:0 }}>
            <label>Notes (optional)</label>
            <input
              placeholder="e.g. -280 fav, 3.0 edge, checked H2H"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
        </div>
        {formErr && <p className="text-xs" style={{ color:'var(--red)', marginTop:8 }}>{formErr}</p>}
        <button className="btn btn-primary btn-full mt-16" onClick={handleAdd}>
          Add pick
        </button>
      </div>

      {/* ── Filter tabs ── */}
      {picks.length > 0 && (
        <div className="flex gap-8 mb-16">
          {['all','pending','hit','miss'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}>
              {f === 'all' ? `All (${picks.length})` :
               f === 'pending' ? `Pending (${picks.filter(p=>p.result==='pending').length})` :
               f === 'hit' ? `Hits (${stats.hits})` :
               `Misses (${stats.misses})`}
            </button>
          ))}
        </div>
      )}

      {/* ── Picks table ── */}
      {sorted.length === 0 && (
        <div className="empty-state">
          <p>{picks.length === 0 ? 'No picks logged yet.' : `No ${filter} picks.`}</p>
          {picks.length === 0 && <p>Use the form above to log your first pick.</p>}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Player</th>
                <th>Prop</th>
                <th>Line</th>
                <th>Pick</th>
                <th>Conf</th>
                <th>Result</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => {
                const rs = RESULT_STYLE[p.result];
                return (
                  <tr key={p.id}>
                    <td className="text-xs text-dim">
                      {new Date(p.date).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                    </td>
                    <td>
                      <span className="bold" style={{ fontSize:14 }}>{p.player}</span>
                      {p.notes && (
                        <span className="text-xs text-dim" style={{ display:'block', marginTop:2 }}>
                          {p.notes}
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-muted">{p.propType}</td>
                    <td className="mono text-sm">{p.line}</td>
                    <td>
                      <span style={{ fontWeight:700, fontSize:13,
                        color: p.rec === 'OVER' ? 'var(--green)' : 'var(--red)' }}>
                        {p.rec === 'OVER' ? '↑ OVER' : '↓ UNDER'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs bold" style={{ color: CONF_COLOR[p.conf] }}>
                        {p.conf}
                      </span>
                    </td>
                    <td>
                      {p.result === 'pending' ? (
                        <div className="flex gap-8">
                          <button className="btn btn-sm" onClick={() => setResult(p.id, 'hit')}
                            style={{ background:'var(--green-bg)', color:'var(--green)', border:'1px solid var(--green-dim)', padding:'3px 8px' }}>
                            Hit
                          </button>
                          <button className="btn btn-sm" onClick={() => setResult(p.id, 'miss')}
                            style={{ background:'var(--red-bg)', color:'var(--red)', border:'1px solid #7f1d1d', padding:'3px 8px' }}>
                            Miss
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setResult(p.id, 'pending')}
                          style={{ background:'none', border:'none', color:rs.color, fontWeight:600, fontSize:13, cursor:'pointer', padding:0 }}
                          title="Click to reset to pending">
                          {rs.label}
                        </button>
                      )}
                    </td>
                    <td>
                      <button onClick={() => deletePick(p.id)} title="Delete pick"
                        style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:16 }}>
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize:22, fontWeight:700, color: color ?? 'var(--text)' }}>{value}</div>
      <div className="text-xs text-dim">{label}</div>
    </div>
  );
}
