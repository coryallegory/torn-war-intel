# Torn Ranked War Assistant

Small browser-run web app focused on monitoring a single Torn Faction during ranked-war events. The app runs entirely client-side, uses the official Torn API for live faction/player data, and uses local `ffscouter_defaults.json` values for battlestat estimates.

What this app does now:
- Manage a single configured Faction (`faction:{id}`) and display its members in the main players table.
- Poll the Torn `/faction/{id}` endpoint on a configurable interval to refresh the player list and per-player state (location, last action, hospital status and exit time).
- Load battlestat estimates from `ffscouter_defaults.json` (no FFScouter API key required).
- Persist configuration and caches in `localStorage` only: `factionId`, `refreshPeriodSeconds`, `factionCache`, `teamPlayers`, and timestamps.

Quick start (open locally):
1. Open `index.html` in a modern browser.
2. Enter your Torn API key (Public) and click Apply.
3. Set `Refresh (s)` and click Apply. Faction ID and battlestat estimates are sourced from `ffscouter_defaults.json`.

APIs used (what, when, why): see `CONTEXT.md` for the full list and links to documentation.

Files of interest:
- `index.html` — main web UI.
- `style.css` — page styling.
- `js/api.js` — Torn request helpers (`getUser`, `getFaction`).
- `js/state.js` — application state and `localStorage` persistence.
- `js/app.js` — UI wiring, rendering, filters, polling, and battlestat hydration from `ffscouter_defaults.json`.

Notes and next steps:
- To refresh default battlestat values, update `ffscouter_defaults.json` (or regenerate it with `scripts/fetch_ffscouter_defaults.py`).
- If you prefer not to store API keys in the browser, consider a small server-side proxy to keep keys private.
- I can initialize a Git repo and commit these changes, add CI linters, or add a small test harness.
