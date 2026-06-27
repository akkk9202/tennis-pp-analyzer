# Tennis PrizePicks Analyzer

Auto-ranked tennis PrizePicks picks backed by live sportsbook odds. Open the Dashboard, hit Refresh, and the app matches today's PrizePicks props against live odds from DraftKings, FanDuel, and Bovada — then ranks everything by confidence.

**Live site:** https://akkk9202.github.io/tennis-pp-analyzer/

---

## Features

| Tab | What it does |
|-----|-------------|
| **Dashboard** | Auto-loads today's props + live odds, runs calculations, ranks picks HIGH → MEDIUM → LOW. Ace entry for Fantasy Score props. |
| **Calculator** | Manual 3-tab calculator (Fantasy Score, Total Games, Total Games One) — useful when the auto-feed is empty or you want to check a specific number. |
| **Tracker** | Log every pick you make. Mark hit/miss after the game. Tracks win rate by confidence level and running streaks. Exports CSV. |
| **Settings** | Paste your Odds API key, read formula docs, quick links to sportsbooks. |

---

## Setup (local development)

```bash
git clone https://github.com/akkk9202/tennis-pp-analyzer.git
cd tennis-pp-analyzer
npm install
npm run dev
```

Then open http://localhost:5173/tennis-pp-analyzer/ and add your API key in Settings.

### Run tests

```bash
npm run test:run        # run once
npm test                # watch mode
npm run test:coverage   # with coverage report
```

---

## Deploy to GitHub Pages

1. **Create the repo.** Name it `tennis-pp-analyzer` on GitHub (or any name — see note below).

2. **Push code.**
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/akkk9202/tennis-pp-analyzer.git
   git push -u origin main
   ```

3. **Enable GitHub Pages.** In your repo: Settings → Pages → Source → **GitHub Actions**.

4. The workflow in `.github/workflows/deploy.yml` runs automatically on every push to `main`. It:
   - Runs all tests (fails the deploy if any test fails)
   - Builds with Vite
   - Deploys to Pages

5. **Add your Odds API key** in the Settings tab on the live site.

> **If you use a different repo name:** edit `vite.config.js` and change `/tennis-pp-analyzer/` to `/your-repo-name/`, or set `VITE_BASE_URL=/your-repo-name/` in the workflow's `Build` step.

---

## API Keys

### The Odds API (required)
- Sign up free at [the-odds-api.com](https://the-odds-api.com) — no credit card
- Free tier: **500 requests/month**
- The app caches results for 5 minutes per refresh. Typical usage: 5–15 calls/day
- Your key is stored in `localStorage` in your browser. It's sent only to `api.the-odds-api.com`.

### PrizePicks (no key needed)
- Uses PrizePicks' unofficial public API (`api.prizepicks.com`)
- No login required. Falls back to a CORS proxy if direct access fails.
- ⚠️ This is an unofficial API — it may change without notice.

---

## How the calculations work

All formulas come from the "Crush Tennis on PrizePicks" strategy notes.

### Fantasy Score

```
projected = base + set_spread + expected_aces

base       = 13  (if player is the favorite)
           = 7   (if player is the underdog)
set_spread = from sportsbook spreads market  →  e.g. +1.5 for straight-set favorite
           = estimated from h2h moneyline if spreads market unavailable
aces       = expected ace count from Bet365  →  manual entry required
```

Compare `projected` to the PrizePicks line to find the edge:

| Edge | Confidence |
|------|-----------|
| ≥ 3.0 | HIGH |
| ≥ 1.5 | MEDIUM |
| < 1.5 | LOW |

**Tommy Paul example from the notes:** favorite (-160) + spread (+1.5) + aces (4) = **18.5**. If PP line is 16.5, edge = +2.0 → **OVER, MEDIUM**.

### Total Games

Heavy favorites win in straight sets → fewer total games → bet UNDER.

| Favorite's implied win probability | Confidence |
|-----------------------------------|-----------|
| ≥ 80% (roughly -400 or better)   | HIGH |
| ≥ 67% (roughly -205 or better)   | MEDIUM |
| ≥ 57% (roughly -134 or better)   | LOW |
| < 57%                              | SKIP |

### Total Games One

Only bet if the sportsbook under odds meet the threshold.

| Sportsbook under odds | Confidence |
|----------------------|-----------|
| ≤ -200 | HIGH |
| ≤ -135 | MEDIUM |
| > -135 | SKIP |

> The app approximates "under odds" from the player's h2h moneyline. For maximum accuracy on Total Games One, verify the actual under odds at your sportsbook and use the Calculator tab manually.

### Always skip

Aces, Double Faults, Break Points — these are the "demons and goblins" of tennis props. The app filters them automatically.

---

## Architecture

```
src/
  utils/
    calculations.js   Pure math — moneylineToProb, fantasyScoreRec, etc. No side effects.
    matching.js       Parses API responses, fuzzy-matches player names, builds ranked picks.
  api/
    oddsApi.js        The Odds API client (sport discovery + h2h + spreads).
    prizePicksApi.js  PrizePicks unofficial client with CORS proxy fallback.
  hooks/
    usePicksData.js   Combines both APIs, 5-min cache, ace overrides.
  components/
    Dashboard.jsx     Auto-ranked picks UI.
    Calculator.jsx    Manual 3-tab calculator.
    Tracker.jsx       Pick log with localStorage persistence.
    Settings.jsx      API key management + formula reference.
  App.jsx             Tab shell, lifts picks data to survive tab switches.
tests/
  calculations.test.js   ~70 test cases covering every formula and edge case.
  matching.test.js       ~50 test cases for parsers, matching, full pipeline.
```

---

## Troubleshooting

**"Invalid Odds API key"** → Double-check the key in Settings. Regenerate at the-odds-api.com if needed.

**"Odds API rate limit reached"** → 500 free requests/month. Refreshing too often will hit it. Each refresh uses ~3–5 requests depending on how many tennis tournaments are active.

**"PrizePicks data unavailable"** → The unofficial API sometimes goes down. The app falls back to showing odds data only; use the Calculator tab to analyze manually. This also happens when no tennis is currently listed on PrizePicks.

**"No tennis picks found"** → Either no tennis matches are live right now, or PrizePicks hasn't listed props for today's matches yet. Try again closer to match time.

**Total Games One marked `~est`** → The app used the player's h2h moneyline as a proxy for their under odds. This is an approximation. For best accuracy, look up the actual total games under line on Bovada or DraftKings and use the Calculator tab.

**Site shows 404 after deployment** → Make sure the `base` in `vite.config.js` matches your repo name exactly, including the leading and trailing slashes.

---

## Development notes

- **Tests gate deployment.** The GitHub Actions workflow won't deploy if `npm run test:run` fails.
- **Pure functions only** in `calculations.js` and `matching.js` — easy to unit test, no mocking needed.
- **5-minute cache** in `usePicksData` conserves Odds API quota. Force refresh with the Refresh button.
- **No router** — tab switching is state-based. All tabs stay mounted to preserve state across switches.
