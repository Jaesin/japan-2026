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

## Not yet built

Firebase (Anonymous Auth + Firestore), the `?key=`-gated portal, and any Hermes write integrations. `PROJECT_SPEC.md` §6–§11 sketch the plan; nothing in `src/` implements it yet.
