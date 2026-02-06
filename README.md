# Torn Ranked War Assistant

Small browser-run web app focused on monitoring a single Torn Faction during ranked-war events. The app runs entirely client-side and uses only the official Torn API and optionally FFScouter for battlestat estimates.

What this app does now:
- Manage a single configured Faction (`faction:{id}`) and display its members in the main players table.
- Poll the Torn `/faction/{id}` endpoint on a configurable interval to refresh the player list and per-player state (location, last action, hospital status and exit time).
- Optionally perform a single FFScouter request to retrieve battlestat estimates when the user Applies a Faction or Applies an FFScouter API key.
- Persist configuration and caches in `localStorage` only: `factionId`, `refreshPeriodSeconds`, `factionCache`, `teamPlayers`, and timestamps.

Quick start (open locally):
1. Open `index.html` in a modern browser.
2. Enter your Torn API key (Public) and click Apply.
3. Optionally set a `Faction ID` and `Refresh (s)` and click Apply. If you have an FFScouter API key, enter it and click Apply to fetch battlestat estimates once.

APIs used (what, when, why): see `CONTEXT.md` for the full list and links to documentation.

Files of interest:
- `index.html` — main web UI.
- `style.css` — page styling.
- `js/api.js` — Torn and FFScouter request helpers (only `getUser` and `getFaction` are used for Torn; `checkFfKey` and `getFfStats` for FFScouter).
- `js/state.js` — application state and `localStorage` persistence.
- `js/app.js` — UI wiring, rendering, filters, polling, and one-shot FFScouter behavior.

Notes and next steps:
- If you want FFScouter queries to run on every poll, I can enable that (it will increase external requests).
- If you prefer not to store API keys in the browser, consider a small server-side proxy to keep keys private.
- I can initialize a Git repo and commit these changes, add CI linters, or add a small test harness.
