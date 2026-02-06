This project is a browser-run Torn Ranked War Assistant focused on monitoring a single managed Faction's player list and statuses.

API reference:
- Torn API Swagger: https://www.torn.com/swagger.php
- FFScouter API base: https://ffscouter.com/api/v1

API calls made by this app (what, when, why):

- GET /user/basic?striptags=true
  - Where: `js/api.js` -> `getUser`
  - When: on Torn API key Apply and on metadata refresh
  - Purpose: validate the Torn API key and fetch the authenticated user's profile for display
  - Docs: https://www.torn.com/swagger.php

- GET /faction/{id}?selections=basic,members
  - Where: `js/api.js` -> `getFaction` (used by `js/app.js` -> `fetchAndCacheFactionMembers`)
  - When: one-shot when the user Applies a Faction ID, and again on scheduled metadata/team refreshes (per `refreshPeriodSeconds`)
  - Purpose: fetch faction basic info (name) and members list (player objects) to display and cache in `localStorage`
  - Docs: https://www.torn.com/swagger.php

- FFScouter: GET /check-key?key={key}
  - Where: `js/api.js` -> `checkFfKey`, used by `js/app.js` -> `validateFfApiKey`
  - When: on FFScouter API key Apply (and on init if a key was remembered)
  - Purpose: validate the FFScouter API key and show a status label in the UI
  - Docs: https://ffscouter.com/api/v1

- FFScouter: GET /get-stats?key={key}&targets={csv}
  - Where: `js/api.js` -> `getFfStats`, consumed by `js/app.js` -> `maybeFetchFfScouterStats`
  - When: one-shot immediately after the user Applies a faction or Applies an FFScouter key (only if a faction is selected and the FF key is valid). This app does NOT poll FFScouter on every refresh.
  - Purpose: retrieve estimated battlestats for players returned from the Torn faction call and populate `bs_estimate_human`/`bs_estimate` fields for display
  - Docs: https://ffscouter.com/api/v1

Caching and persistence:
- All runtime caching is stored in `localStorage` only (no bundled JSON snapshots). Keys include `factionCache`, `teamPlayers`, `teamPlayersTimestamp`, `metadataTimestamp`, `factionId`, and `refreshPeriodSeconds`.
- `factionCache` entries include a timestamp and the fetched faction object (name + members), and are used to avoid unnecessary Torn calls within the configured TTL.

Notes:
- The app manages exactly one configured faction (a pseudo-team `faction:{id}`) and persists only that faction's metadata.
- Recurring polling refreshes the faction member list (which includes player state like location, hospital, last action timestamps). FFScouter calls to estimate battlestats are performed only as a one-shot when a faction or FF key is Applied by the user.

If you want further adjustments (e.g., poll FFScouter on each refresh, or fetch additional Torn selections), tell me which endpoints or frequency to use.
