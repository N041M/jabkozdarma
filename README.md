# JabkoZdarma 🍎

A community map of freely pickable apple trees. Anyone can browse; contributors pin
trees, add photos, and report what's ripe right now.

**Web-first:** v1 ships as a phone-optimized, installable web app (live at
https://n041m.github.io/jabkozdarma/, deployed from `main` by GitHub Actions).
The codebase is Expo (React Native + TypeScript), so native iOS/Android builds
are a v2 flip-of-a-switch, not a rewrite.

## Run it

```bash
npm install
npm start          # web dev server at http://localhost:8081
npm run start:native   # v2: Expo Go / native development
```

- **Web** uses MapLibre GL with a custom Pokémon GO-style vector map ("Orchard GO"):
  tilted 3D camera, extruded buildings, saturated-green world (OpenFreeMap vector
  tiles, no API key), and sprite apple trees whose look reflects the latest
  ripeness report.
- **iOS / Android (deferred to v2)** use `react-native-maps` via the platform-split
  `tree-map` component; the native path stays compiling but isn't the focus.
- **Languages:** Czech + English, auto-detected from the device; override with
  `?lang=cs` / `?lang=en` in the URL.
- **Location & privacy:** position comes from the browser's Geolocation API with the
  user's permission, read on-device. The static host never sees it; coordinates leave
  the device only as the two endpoints sent to the OSRM router when requesting a route.

## Current state (Phase 1 MVP, local mode)

- Browse the map with clustered-free pins colored by the latest ripeness report
- Add a tree: tap **+**, tap the map, fill in variety / notes / access / season / photo
  (duplicate warning if a pin already exists within 25 m)
- Tree detail: photos, access badge, season, report timeline, one-tap ripeness report,
  favorites, "report a problem" flags
- In-app walking routes: "Walk there" draws the route on the map (FOSSGIS OSRM,
  foot profile) with a distance/duration banner — no handoff to external map apps
- Local profiles (username only) gate contributions; browsing needs no account
- Everything persists on-device (AsyncStorage). Seed pins around Prague so the map
  is never empty.
- Retention roadmap ("game-ify the harvest"): Duolingo-style season streaks, XP and
  weekly quests, plus Pokémon GO-style variety collection (Jablkodex) and GPS
  check-in picks — see the product plan for mechanics and guardrails.

## Connecting the backend

The integration is fully implemented — email-code (OTP) sign-in, shared
trees/reports/favorites/flags, and photo uploads to Supabase Storage. The app runs
in local mode until it finds credentials, then switches automatically.

**Follow [supabase/SETUP.md](supabase/SETUP.md)** — exact dashboard steps, including
the one gotcha (the Magic Link email template must contain `{{ .Token }}` or the
sign-in email carries no code), plus [supabase/seed.sql](supabase/seed.sql) to start
the map with the Prague pins instead of empty.

## Layout

```
src/
  app/            expo-router screens
    (tabs)/       map (index) + profile
    tree/[id]     tree detail
    add-tree      add/edit modal
  components/     tree-map (native + web implementations), shared UI
  lib/            types, store (zustand + AsyncStorage), seed data, supabase client
  constants/      theme palette
supabase/
  schema.sql      full Postgres schema with RLS
```
