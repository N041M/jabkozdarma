# JabkoZdarma 🍎

A community map of freely pickable apple trees. Anyone can browse; contributors pin
trees, add photos, and report what's ripe right now.

One Expo (React Native + TypeScript) codebase targeting **iOS, Android, and web**.

## Run it

```bash
npm install
npm run web        # web app at http://localhost:8081
npm start          # then press i / a, or scan the QR with Expo Go
```

- **Web** uses MapLibre GL with OpenStreetMap tiles.
- **iOS / Android** use `react-native-maps` (Apple/Google Maps), which works in Expo Go
  out of the box. Swapping native to MapLibre is planned once we move to dev builds.

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

## Connecting the backend (Phase 2)

1. Create a Supabase project, run [supabase/schema.sql](supabase/schema.sql) in the SQL editor
   (PostGIS, tables, RLS policies, and the `trees_in_bbox` viewport RPC).
2. Create a public storage bucket `tree-photos` (policies at the bottom of the schema).
3. `cp .env.example .env` and fill in the project URL + anon key.

`src/lib/supabase.ts` picks up the env vars; the app shows its backend status on the
Profile tab. Wiring auth + sync to replace the local store is the next milestone —
see the product plan for the full roadmap.

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
