import { useState } from 'react';
import Dashboard  from './components/Dashboard.jsx';
import Calculator from './components/Calculator.jsx';
import Tracker    from './components/Tracker.jsx';
import Settings   from './components/Settings.jsx';
import { usePicksData } from './hooks/usePicksData.js';

// ─── Settings persistence ──────────────────────────────────────────────────

const SETTINGS_KEY = 'tppa_settings';

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') ?? {}; }
  catch { return {}; }
}

// ─── Icons ────────────────────────────────────────────────────────────────

const DashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const CalcIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/>
    <line x1="8" y1="7" x2="16" y2="7"/>
    <circle cx="8"  cy="12" r="1" fill="currentColor"/>
    <circle cx="12" cy="12" r="1" fill="currentColor"/>
    <circle cx="16" cy="12" r="1" fill="currentColor"/>
    <circle cx="8"  cy="17" r="1" fill="currentColor"/>
    <circle cx="12" cy="17" r="1" fill="currentColor"/>
    <circle cx="16" cy="17" r="1" fill="currentColor"/>
  </svg>
);
const TrackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
    <line x1="8" y1="16" x2="12" y2="16"/>
  </svg>
);
const GearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const TABS = [
  { label: 'Dashboard',  Icon: DashIcon  },
  { label: 'Calculator', Icon: CalcIcon  },
  { label: 'Tracker',    Icon: TrackIcon },
  { label: 'Settings',   Icon: GearIcon  },
];

// ─── App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab]         = useState(0);
  const [settings, setSettings] = useState(loadSettings);

  // Lift picks data here so it survives tab switches
  const picksData = usePicksData();

  function handleSettingsChange(newSettings) {
    setSettings(newSettings);
  }

  return (
    <>
      {/* Top navigation */}
      <nav className="app-nav">
        {TABS.map(({ label, Icon }, i) => (
          <button
            key={label}
            className={`nav-tab ${tab === i ? 'active' : ''}`}
            onClick={() => setTab(i)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>

      {/* Page content — keep all tabs mounted so state isn't lost */}
      <div style={{ display: tab === 0 ? 'contents' : 'none' }}>
        <Dashboard picksData={picksData} apiKey={settings.oddsApiKey ?? ''} />
      </div>
      <div style={{ display: tab === 1 ? 'contents' : 'none' }}>
        <Calculator />
      </div>
      <div style={{ display: tab === 2 ? 'contents' : 'none' }}>
        <Tracker />
      </div>
      <div style={{ display: tab === 3 ? 'contents' : 'none' }}>
        <Settings settings={settings} onChange={handleSettingsChange} />
      </div>
    </>
  );
}
