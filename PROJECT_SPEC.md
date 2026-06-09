# Japan 2026 — Trip Planning SPA Handoff Document

> **Last updated**: 2026-06-09  
> **Author**: Hermes Agent  
> **Project**: Mulenex Family Japan Trip (July 4–11, 2026)  
> **Repo**: `github.com/Jaesin/japan-2026`  
> **Live**: `https://japan-2026.mulenex.org/`

---

## 1. Project Overview

A **single-page application** (SPA) for the Mulenex family's 7–10 day trip to Japan. The SPA has a **dual-view architecture**: anyone visiting the URL sees a public "retro movie poster" trip overview, while family members with a share link get access to a full trip management portal for planning, research, itinerary building, budget tracking, and live check-ins during the trip.

### Core Goals
- **Public view**: A cinematic trip poster that family and friends can visit without any login — shows dates, locations, a live "where are they now?" map, and check-in feed
- **Private portal**: Full management UI for Jaesin (via Hermes + UI) and his wife (via UI only) to plan and run the trip
- **Hermes integration**: Hermes agents populate and manage all data (research tasks, itineraries, budget) by writing directly to Firebase Firestore
- **No wife friction**: She has no GitHub account, no desire for CLI tools — everything she does is through the SPA web UI, accessed via a shared `?key=` link

### Trip Details
| Detail | Value |
|---|---|
| Dates | July 4–11, 2026 (10 days including travel) |
| Travelers | Jaesin, Wife, 2 kids (family of 4) |
| Home base | Bangkok, Thailand |
| Route | Tokyo → Hakone → Kyoto → Nara → Osaka |
| Duration | 7–10 days (flexible) |

---

## 2. Tech Stack (Decided)

| Layer | Choice | Rationale |
|---|---|---|
| **Framework** | React 18 | Component ecosystem maturity, Claude Design integration, mature Firebase/Leaflet bindings |
| **Build tool** | Vite 5 | Fast builds, static output for GH Pages, HMR |
| **Routing** | HashRouter (react-router-dom 7) | Works on static GH Pages without 404.html redirect hack — URLs like `/#/portal/tasks` |
| **Hosting** | GitHub Pages | Free, zero-config with GH Actions |
| **Authentication** | Firebase Anonymous Auth + client-side `?key=` gate | No login UI. Session created via anonymous auth behind the scenes. `?key=` param or localStorage enables write UI. |
| **Database** | Firebase Firestore | Real-time sync, free tier, no backend needed |
| **Maps** | Leaflet + OpenStreetMap | Free, no API key, tiny library, works offline |
| **Styling** | CSS (no framework) | Bespoke vintage poster aesthetic — Tailwind/framework would fight the retro look |
| **Fonts** | Google Fonts (Anton + Archivo) | Anton for headlines, Archivo for body — sourced from Claude Design |
| **Icons** | Hand-drawn emoji / inline SVGs | Fits the retro aesthetic |
| **Deploy** | GitHub Actions → `peaceiris/actions-gh-pages` | Push to `main` auto-deploys |

### Environment
| Detail | Value |
|---|---|
| **Node.js** | v22.22.3 (via nvm, set as default). `.nvmrc` contains `22` |
| **Package manager** | npm |
| **Vite base path** | Currently `/` — needs to be `/japan-2026/` for proper GH Pages subpath routing |

> **⚠️ Note on `base` path**: `vite.config.js` currently has `base: '/'`. It was changed from `/japan-2026/` to fix a GH Pages deploy error. This needs to be confirmed as working or adjusted — the GH Pages deploy URL is `https://jaesin.github.io/japan-2026/`, which implies `base: '/japan-2026/'` is correct. The last GH Actions run error suggests there may be an asset path issue.

---

## 3. Project Structure (Current)

```
japan-2026/
├── public/
│   └── sun.svg                          # Favicon/icon — Claude Design exported SVG (19KB path data)
├── src/
│   ├── main.jsx                         # Entry point, HashRouter wrapper
│   ├── App.jsx                          # Routes definition
│   ├── App.css                          # (deleted — not present)
│   ├── index.css                        # Minimal reset styles
│   ├── PublicPage.jsx                   # Picks light/dark poster via prefers-color-scheme
│   ├── theme.js                         # Design tokens (light/dark)
│   ├── tripData.js                      # Route, dates, getTodayInfo() countdown/Day-N, check-ins
│   ├── components/
│   │   ├── PosterLight.jsx              # Direction A "Rising Sun" (cream paper)
│   │   ├── PosterDark.jsx               # Direction B "Sunset Express" (indigo night)
│   │   ├── RouteMap.jsx                 # Vanilla Leaflet, skinned tiles + custom pins
│   │   ├── map.css                      # Tile filter skins + pin styles
│   │   ├── motifs.jsx                   # Sun, SunBurst, Fuji (SVG)
│   │   └── pieces.jsx                   # Eyebrow, Credits, TodayBadge, FeedHeader, CheckinCard
│   └── assets/                          # Empty dir
├── .github/workflows/deploy.yml         # GH Actions deploy workflow
├── .nvmrc                               # Node 22
├── dist/                                # Build output
├── package.json
├── vite.config.js
└── PROJECT_SPEC.md                      # ← This file
```

### Current Build Status
- `npm run build` succeeds (40 modules, ~180KB JS bundle + 19KB sun.svg)
- Last GH Actions run failed — needs investigation (see Open Questions)
- `dist/` outputs to `index.html` + `assets/` + `sun.svg`

---

## 4. What's Been Built So Far

### 4.1 Public Page (Light + Dark Posters) ✅ Complete
Replaced the original hand-rolled `pages/Home.jsx` with the Claude Design handoff (`~/Downloads/design_handoff_public_pages/`). `PublicPage.jsx` watches `prefers-color-scheme` and swaps between two complete treatments:

- **Light — Direction A "Rising Sun"**: Cream paper (`#F4ECD8`), ink black, hinomaru red. Corner sun-ray burst (`SunBurst`, 24 rays, `#C5302B`) clipped above the byline, vertical `日本の旅`, **"JAPAN"** in Anton 150px, Fuji silhouette, ink-bar "today" band, itinerary credits, route map, dispatches.
- **Dark — Direction B "Sunset Express"**: Indigo (`#1B2A4A`) with stacked flat sunset bands (indigo / pink `#E3A79B` / orange `#D9622B`), 168px red sun behind Mt. Fuji.
- **Live "today" band**: `tripData.getTodayInfo()` returns countdown days before July 4, 2026, then `Day N · City` during the trip.
- **Route map**: Real **Leaflet** (vanilla, no react-leaflet) with skinned CARTO Voyager tiles and custom `L.divIcon` pins for Tokyo · Hakone · Kyoto · Nara · Osaka, dashed route polyline, "Last seen · Hakone" tag.
- **Fonts**: Anton, Archivo, Zen Old Mincho (light); Bebas Neue, Space Grotesk (dark) — loaded via `<link>` in `index.html`.

### 4.2 Sun Icon (Favicon) 🔄 WIP
- Current `public/sun.svg` is a 19KB SVG exported from Claude Design (path data)
- This was extracted from the Claude Design poster export and converted to SVG
- There were 5 vintage-poster-style sun variants created but the `sun-variants/` directory was cleaned up — **the user never explicitly chose the final variant**, but variant-1 (Poster Classic, 22 alternating rays) was recommended
- The current sun.svg is the Claude Design version, **not** the generated variant

### 4.3 CI/CD ✅ Complete
- `.github/workflows/deploy.yml` pushes to `main` → runs `npm ci && npm run build` → deploys `dist/` to GH Pages
- Uses `actions/configure-pages`, `upload-pages-artifact`, `deploy-pages` (official GH Pages action pattern)
- Node 20 in CI (via `actions/setup-node` with `node-version: 20`)

### 4.4 Firebase ❌ Not started
- No Firebase project created
- No Firebase SDK installed in `package.json`
- No Firestore security rules written
- No anonymous auth configured

---

## 5. Design Direction

The aesthetic is **vintage retro travel poster** — inspired by 1930s–1950s Japanese travel advertisements and movie posters.

### Color Palette
| Color | Hex | Usage |
|---|---|---|
| Cream / Parchment | `#F4ECD8` / `#F2EBD9` | Page background |
| Dark Brown | `#1A1714` | Body text, headings |
| Muted Red | `#B63E33` / `#C82D26` | Accents, sun disk, rays, dots |
| Off-white | `#E8E4D8` | Map area, card backgrounds |
| Grey | `#888` / `#777` | Secondary text |

### Typography
| Font | Usage |
|---|---|
| **Anton** (sans-serif, condensed) | Large headlines, hero text |
| **Archivo** (serif) | Body copy, subtitles |

### Sunburst Design Language
- **Quarter-sun** in upper-right corner — center point off-canvas, only bottom-left curve visible
- **Trapezoidal rays** (not triangles) — flat at the sun edge, widening toward canvas edges
- **Alternating colors**: deep muted red + warm cream/off-white
- **Solid fills**, no gradients
- Rays extend to canvas boundaries

---

## 6. Portal Feature Concepts (Still Open — Not Designed or Implemented)

> **No decisions have been made about what to build for the admin portal.** These are brainstormed concepts from the initial planning session. Prioritization and scope are TBD.

### Concept Areas

**🗂 Task Board**
- Database of tasks with title, assignee, status, priority, due date, category (Flights, Accommodation, Transport, Activities, Documents, Packing, Budget, Visa)
- Filter by assignee/category/status
- Hermes can populate from web research

**📋 Research Board**
- Cards for places, restaurants, activities with URLs, notes, tags
- Pin/finalize items when decided
- Hermes can auto-populate from searches

**📅 Itinerary Builder**
- Day-by-day view, July 4–11
- Activities with time, title, location, notes, cost
- Drag to reorder within/between days
- Auto-map side panel

**🏨 Accommodation Manager**
- Each night's lodging: name, address, check-in/out times, booking ref, host contact
- Color-coded pins on map
- Share link to Airbnb host on that day's page

**💰 Budget Ledger**
- Spreadsheet: Category, Item, Estimated (THB/JPY), Actual, Paid By, Notes
- Running totals per category
- "Who owes who" settlement

**🧳 Packing Portal**
- Per-person lists (Jaesin / Wife / Kid 1 / Kid 2)
- Categories: Clothing, Toiletries, Electronics, Documents, Kids
- Progress bar per person
- Pre-populated common Japan checklist

**✈️ Transport Hub**
- Flight booking details, seat numbers, gates
- Shinkansen routes/times
- IC card (Suica/Pasmo) info

**📄 Document Vault**
- Quick reference: passport numbers, travel insurance, visa status, booking refs
- QR codes for tickets/boarding passes

**📍 Check-In System** (During Trip)
- Tap "I'm here" at any itinerary location
- Shows on public page's live map
- Auto-detect via browser geolocation (suggest)

**📸 Digital Postcards** (During Trip)
- Drop a photo + short message → instantly on public page
- Mini travel blog visible to family back home

**📝 Quick Journal** (During Trip)
- End-of-day: 1–5 rating, highlight, one sentence
- Viewable post-trip as recap

**🗺 Live Interactive Map** (During Trip)
- All planned locations color-coded by day
- Checked-in locations glow
- Current location (if geolocation allowed)

**🎬 Post-Trip Recap**
- Trip stats: distance, places, ramen bowls
- Check-in map of everywhere you went
- Journal in reading order
- Exportable PDF keepsake

---

## 7. Data Architecture (Conceptual — Not Implemented)

### Auth Flow
```
Visitor → opens URL
  ├─ Has `?key=` match (or localStorage key) → Portal UI unlocked 🔓
  └─ No key → Public poster page only 🔒
```

- **No Firebase call for auth gate** — the key hash is hardcoded in the JS bundle
- **Anonymous Firebase Auth** runs behind the scenes to give `request.auth.uid` for Firestore rules
- **Firestore rules**: `allow read: if true; allow write: if request.auth != null;`

### Firestore Collections (Proposed)
```
/trip/{tripId}/
  config/              → title, startDate, endDate, posterShareKeyHash
  tasks/{id}           → title, description, assignee, status, priority, dueDate, category
  research/{id}        → title, url, notes, tags, category, isPinned
  accommodations/{id}  → name, address, lat, lng, checkIn, checkOut, bookingRef, hostContact
  itinerary/{dateKey}/ → dayNumber, label, activities[]
  budget/{id}          → category, item, estimatedTHB, actualTHB, estimatedJPY, actualJPY, paidBy
  packing/{id}         → person, item, category, isPacked
  checkins/{id}        → locationName, lat, lng, timestamp, note, isPublic
  postcards/{id}       → imageUrl, message, timestamp
  journal/{id}         → date, rating, highlight, note
```

---

## 8. Key Decisions Made

1. **No Apple ecosystem** for trip planning — Apple Notes, Freeform, Maps have fundamental automation limitations. SPA + Firebase chosen instead.
2. **SPA over Notion/SaaS** — Complete control over UI/UX and data model at zero marginal cost. No subscription, no limits.
3. **Auth architecture**: Anonymous Firebase Auth (machine session) + client-side `?key=` gate. No login UI, no password, no Google sign-in. Wife sees zero auth friction.
4. **HashRouter over BrowserRouter** — `/#/portal/tasks` works on static GH Pages without 404.html redirect hacks or any server config.
5. **React over Preact/Solid/vanilla** — Mature ecosystem for Firebase, Leaflet, and Claude Design component integration.
6. **CSS (no framework)** — The bespoke vintage poster aesthetic would fight against any utility framework.
7. **Leaflet + OpenStreetMap over Google Maps** — Free, no API key, no billing setup.
8. **Vintage poster aesthetic** — Retro travel poster with quarter-sun sunburst, muted red + cream palette, Anton + Archivo typography.
9. **Iterative build approach** — Start with static public page, then add Firebase foundation, then build portal features incrementally.
10. **Wife workflow**: Only needs the SPA URL + share link. No GitHub, no CLI, no accounts.

---

## 9. Open Questions / Decisions Pending

### 🔴 High Priority — Need Answers Before Building Portal

1. **Firebase project**: Has one been created? If not, need `firebase-tools` init, billing setup (Spark plan — free), or is this using a different project setup?
2. **`base` path**: `vite.config.js` has `base: '/'` but GH Pages deploys to `https://jaesin.github.io/japan-2026/`. The last GH Actions run failed — need to verify the correct base path and fix the deploy.
3. **Sun icon final selection**: The current `public/sun.svg` is a raw 19KB Claude Design path-data export. Do we want to use variant-1 (Poster Classic, 22 alternating rays) as a cleaned-up replacement, or keep the Claude Design version?
4. **Repo remote**: Is there a `git remote origin` pointing to `github.com/Jaesin/japan-2026`? Checked out to `main` branch? (Yes — confirmed working tree clean, up to date with origin/main.)

### 🟡 Medium Priority — Portal Scope Decisions

5. **Which portal features to build first?** Task Board seems highest value for pre-trip planning. Research Board second. What's the priority order?
6. **Minimal viable portal**: What's the smallest set of features needed to launch? (Suggested: Task Board + Itinerary Builder + Check-In system)
7. **Mobile responsiveness**: The public page is designed at `max-width: 414px` (mobile-first). Should portal pages also be mobile-optimized, or primarily desktop?
8. **Wife input**: Has she seen/weighed in on any of this? Any features she specifically wants?

### 🟢 Nice-to-Have — Post-Trip / Polish

9. **Post-trip recap / PDF export** — nice to have, not urgent
10. **Digital postcards with photo upload** — requires image hosting (Cloudinary? Firebase Storage?)
11. **Family voting on dinner spots** — real-time UI, cute but complex
12. **Auto-detect check-in via geolocation** — needs permission UX consideration

### ⚠️ Known Issues

13. **GH Actions deploy error**: Last run at `github.com/Jaesin/japan-2026/actions/runs/27211735582` failed. Needs investigation. Likely `base` path mismatch or asset reference issue.
14. **`vite.config.js` base changed from `/japan-2026/` to `/`** — this was changed between the scaffold and current state. Need to confirm the correct value for GH Pages deployment.

---

## 10. Hermes Integration Strategy

Hermes agents will be the **primary data management layer** for the portal:

### What Hermes Does
- **Populate research** — web search → save structured cards to Firestore
- **Build itineraries** — "Plan Day 3 in Osaka" → write activities with times, locations
- **Manage tasks** — create, update, complete tasks in the Firestore task board
- **Track budget** — write rows to the budget ledger
- **Handle changes** — "Move Hiroshima to Day 6" → update Firestore docs

### How
- Hermes uses `delegate_task` subagents to run Firestore Admin SDK or REST API calls from the terminal
- Each subagent has the Firebase project config passed as context
- Wife interacts through the web UI (writes directly to Firestore via the SDK in the browser)

### Not Yet Configured
- No Firebase service account or API key in the project yet
- No Firestore write scripts created
- No Hermes agent workflows for trip data management designed

---

## 11. Development Checklist

### Phase 1 — Foundation ✅ (Mostly Done)
- [x] Scaffold React + Vite project
- [x] Configure HashRouter
- [x] Set up nvm + Node v22
- [x] Create GH Actions deploy workflow
- [x] Design and build public poster page (PublicPage + PosterLight/PosterDark from Claude Design handoff)
- [x] Add favicon/icon
- [x] Push to GitHub with deploy

### Phase 2 — Firebase — Not Started
- [ ] Create Firebase project (or confirm existing)
- [ ] Enable Anonymous Auth
- [ ] Create Firestore database
- [ ] Install Firebase SDK in project
- [ ] Write Firestore security rules
- [ ] Add Firebase config to SPA
- [ ] Build auth/key gate component

### Phase 3 — Portal Features — Not Started
- [ ] Portal frame with sidebar navigation
- [ ] Task board
- [ ] Research board
- [ ] Itinerary builder
- [ ] Budget ledger
- [ ] Map integration

### Phase 4 — During-Trip Features — Not Started
- [ ] Check-in system
- [ ] Live public map
- [ ] Journal

### Phase 5 — Hermes Automation — Not Started
- [ ] Firestore write scripts for Hermes
- [ ] Research population workflow
- [ ] Task management workflow
- [ ] Itinerary management workflow

---

## 12. Current Working State

```
📍 Working directory: /Users/jaesin/workspace/projects/japan-2026
🌿 Git branch: main (up to date with origin/main, clean working tree)
🟢 Build: npm run build succeeds
🔴 GH Pages: Last deploy failed
🔥 Firebase: Not set up
👤 Family: Jaesin (Hermes + UI) + Wife (UI-only via share link)
⚡ Node: v22.22.3 (nvm default, .nvmrc)
```

### To Run Locally
```bash
cd /Users/jaesin/workspace/projects/japan-2026
nvm use
npm run dev      # Dev server with HMR
npm run build    # Production build
npm run preview  # Preview production build
```

---

*This document serves as a project handoff and specification reference. Update it as decisions are made and features are built.*
