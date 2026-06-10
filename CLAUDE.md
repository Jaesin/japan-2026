# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Single-page app for the Mulenex family's Japan trip (July 4–11, 2026). Public landing poster is built; the planned private portal (Firestore-backed) is not. See `PROJECT_SPEC.md` for the full handoff — treat it as the source of truth for direction, but verify against the code before acting on specifics (it can drift).

## Commands

```bash
nvm use          # Node 22 (per .nvmrc)
npm run dev      # Vite dev server with HMR
npm run build    # Production build → dist/
npm run preview  # Serve the built dist/
npm run lint     # ESLint over the repo
```

No test suite exists yet.

## Architecture

- **Stack**: React 18 + Vite 5, HashRouter (`react-router-dom` v7), vanilla Leaflet for the map, plain CSS (no framework — the bespoke retro-poster aesthetic would fight Tailwind).
- **Entry flow**: `src/main.jsx` → `HashRouter` → `App.jsx` (single `/` route) → `src/PublicPage.jsx`. `PublicPage` watches `prefers-color-scheme` via `matchMedia` and renders **either** `PosterLight` (Direction A "Rising Sun", cream paper) **or** `PosterDark` (Direction B "Sunset Express", indigo night). These are two complete designs, not a recolor — never try to "merge" them.
- **Shared data**: `src/tripData.js` holds the route, dates, sample check-ins, and `getTodayInfo()` which drives the live "today" band (countdown days before July 4 2026, then `Day N · City` during the trip). Both posters consume this.
- **Theme tokens**: `src/theme.js` exports `light{}` and `dark{}` token objects. Posters reach for these rather than hard-coding colors.
- **Map**: `src/components/RouteMap.jsx` is vanilla Leaflet (no `react-leaflet`) via `useEffect`. Custom pins are `L.divIcon` HTML — port directly if swapping to `react-leaflet` later. Tile filter "skins" (`bureau` / `paper` / `ink`) live in `components/map.css`.
- **Fonts**: Loaded via `<link>` in `index.html` — Anton + Archivo + Zen Old Mincho (light) and Bebas Neue + Space Grotesk (dark). All five are needed; don't trim.
- **Routing note**: HashRouter is intentional so the static build works on GitHub Pages without `404.html` redirect hacks. URLs look like `/#/portal/tasks` when the portal lands.

## Deploy

`.github/workflows/deploy.yml` builds and deploys `dist/` to GitHub Pages on push to `main`. Live at `https://japan-2026.mulenex.org/`. `vite.config.js` has `base: '/'` for the custom domain — do not change to `/japan-2026/` without also reverting the custom-domain setup (see commit `7098944`).

## Design source

The current public page was ported from a Claude Design handoff at `~/Downloads/design_handoff_public_pages/`. The files under `src/components/`, `src/PublicPage.jsx`, `src/theme.js`, and `src/tripData.js` came from that handoff and should stay close to it — adapt wiring (data, routing) rather than restyling. Pixel-level changes are fine; structural rewrites should be rare.

## Firebase (set up 2026-06-10)

Project `japan-2026-6363d`: Firestore in `asia-southeast1`, Anonymous Auth enabled. `src/firebaseConfig.js` holds the (non-secret) web config + `TRIP_ID`; `src/firebase.js` initializes the SDK with persistent offline cache and exports `ensureSignedIn()`. Security model is capability-link → member registration, enforced in `firestore.rules` (see `specs/01-access-and-security.md` — it supersedes PROJECT_SPEC §7). Deploy rules with `firebase deploy --only firestore:rules`. Scripts: `scripts/seed.mjs` (idempotent seed; needs `firestore.bootstrap.rules` deployed via `firebase deploy --config firebase.bootstrap.json --only firestore:rules` only for first-ever secret creation), `scripts/verify.mjs` (end-to-end rules check), `scripts/prune-members.mjs` (revoke all device registrations). The family access token lives at `~/.config/japan-2026/access-token` — never commit or print it.

## Firestore access from scripts / CLI

**Never use anonymous sign-in in scripts** — it creates stale member docs that pollute the members list. Use the Firebase CLI credentials instead:

- **Reads**: Firestore has no CLI read command. Use the REST API with the cached CLI token:
  ```js
  const cfg = JSON.parse(fs.readFileSync(os.homedir() + '/.config/configstore/firebase-tools.json', 'utf8'));
  const token = cfg.tokens?.access_token;
  // then: fetch(`https://firestore.googleapis.com/v1/projects/japan-2026-6363d/databases/(default)/documents/trips/japan-2026/...`, { headers: { Authorization: 'Bearer ' + token } })
  ```
- **Deletes**: `firebase firestore:delete --project japan-2026-6363d --yes 'trips/japan-2026/collection/docId'`
- **Writes/updates** that require member auth (e.g. `config/features`): use the REST API with the CLI token — the Firestore REST API respects the same security rules, and the CLI token is an owner-level credential that bypasses them.

## Not yet built

Hermes write integrations. `specs/` holds the triage-ready feature specs (`specs/README.md` is the index); specs 00–04 and 10 are built.
