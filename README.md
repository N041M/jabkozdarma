# JabkoZdarma 🍎

A community map of freely pickable fruit trees. Anyone can browse the map. Contributors
pin trees, add photos, and report what's ripe right now.

JabkoZdarma ships first as a phone-optimized, installable web app. Try the
[live app on GitHub Pages](https://n041m.github.io/jabkozdarma/), which GitHub Actions
deploys from `main`. The codebase is Expo, using React Native and TypeScript, so native
iOS and Android builds are a configuration change rather than a rewrite.

## Run the app

```bash
npm install
npm start              # web dev server at http://localhost:8081
npm run start:native   # v2: Expo Go and native development
```

Restart the dev server after you change any environment variable. Expo bakes
environment variables in at bundle time, so a running server doesn't pick them up.

## How the map works

On the web, the map is MapLibre GL with a custom Pokémon GO-style vector map called
Orchard GO: a tilted 3D camera, extruded buildings, and a saturated-green world drawn
from OpenFreeMap vector tiles, which need no API key. Each tree is a sprite whose look
reflects its latest ripeness report.

### The camera ladder

Zoom isn't a scale slider. It changes what the map *is*, across four stops that the
camera snaps to:

| Stop | What you see | Rail action |
| --- | --- | --- |
| 50 m | You stand next to a tree: 58° pitch, full-size avatar | Trhám (pick) or Přidat (add) |
| 250 m | Browsable sprites with ripeness rings and walking times | Trasa (route) |
| 2 km | Trees fold into counted clusters | Čtvrť (district) |
| 20 km | No trees at all, only density per km² | Oblast (area) |

A pinch runs free while your fingers are down. When it settles, the map snaps to
whichever stop it landed nearest. For the stop definitions and the zoom math, see
[`src/lib/zoom-ladder.ts`](src/lib/zoom-ladder.ts).

### The rail

Navigation is a vertical rail on the right, not a bar along the bottom. Most people meet
this app as a link in Safari, whose toolbar owns 74 px of the bottom edge. The rail sits
inside the thumb arc instead, and its bottom slot is the primary action, which the
current zoom stop decides. To move the rail to the left edge, go to **Profil > Strana
lišty**. For the measurements this depends on, see
[`src/lib/chrome.ts`](src/lib/chrome.ts).

### Platforms, languages, and privacy

- **iOS and Android**, deferred to v2, use `react-native-maps` through the
  platform-split `tree-map` component. The native path keeps compiling, but it isn't
  the focus.
- **Languages**: Czech and English, detected from the device. To override the
  detection, add `?lang=cs` or `?lang=en` to the URL.
- **Location and privacy**: the browser's Geolocation API supplies the position, with
  the user's permission, and the app reads it on-device. The static host never sees it.
  Coordinates leave the device only as the two endpoints that the app sends to the OSRM
  router when it requests a route. A pin you place stores how far you stood from it, not
  where you stood: one number answers what the map needs, and keeping the point would be
  keeping your movements.

## What's built (Phase 1 MVP, local mode)

- Browse the map through the four camera-ladder stops. A context card reports what the
  camera is looking at, and the scale badge cycles the stops.
- **Sklizeň**: the map's ranked twin. It lists the same trees ordered by walking
  distance, filtered by "ripe now" and "under 2 km".
- **Add a tree** from the rail, by aiming rather than by standing. Tapping **Přidat**
  drops the camera to the 50 m rung, flattens it, and puts a crosshair in the middle of
  the map; you drag the map until the crosshair sits on the trunk. A readout on the
  bottom edge says how far the pin is from you, how good your fix is, and whether a pin
  already exists within 25 m of that spot. **Umístit** then opens the rear camera and
  the form, with the photo already attached. Every other field has a working default, so
  one more tap puts the tree on the map; variety, notes, access, and season are there
  when you want them.

  Your own position is evidence rather than the coordinate: the pin records how far you
  stood from it, and a pin has to land within 150 m of you. Having no location at all
  isn't a refusal — you aim by hand, the pin says so, and it earns the map's trust from
  confirmations like every other pin.
- **Verification**, so nobody can pin trees where there aren't any. A new pin starts
  unverified: the map draws it faded and Sklizeň leaves it out of the walking list. Two
  other pickers standing within 60 m of it make it real, and you can't confirm your own.
  Retiring a pin takes the same corroboration, unless you're the one who added it. The
  rules and the thresholds live in
  [`src/lib/verification.ts`](src/lib/verification.ts).
- **Tree detail**: photos, an access badge, the season, a report timeline, one-tap
  ripeness reporting, confirmation, favorites, and problem flags.
- **In-app walking routes**: "Trasa pěšky" draws the route on the map using the FOSSGIS
  OSRM foot profile, with no handoff to an external map app.
- **Jablkodex**: the retention layer. It tracks XP (15 for a report, 25 for a check-in,
  40 for a new tree, and 150 for the weekly quest), levels, day streaks, a weekly quest,
  and a 24-variety collection grid that fills from the varieties you've contributed or
  reported on.
- Local profiles, which need only a username, gate contributions. Browsing needs no
  account.
- Everything persists on-device through AsyncStorage. Seed pins around Prague keep the
  map from starting empty.

**Caution:** Gamification state is local-only, so anyone can edit it on their own
device. It needs a server-side home once the backend is live.

## Connect the backend

The integration is complete. It covers magic-link sign-in, shared trees, reports,
confirmations, favorites and flags, and photo uploads to Supabase Storage. The app runs
in local mode until it finds credentials, and then switches over on its own.

The write limits and the confirmation rules run in Postgres, because the anon key ships
in the bundle and anything the client checks is advice a script can skip. For what the
database enforces, see [Verification](supabase/SETUP.md#verification).

For the dashboard steps, see [Supabase setup](supabase/SETUP.md). To start the map with
the Prague pins instead of an empty database, run
[`supabase/seed.sql`](supabase/seed.sql).

## Project layout

```
src/
  app/            expo-router screens, as a flat stack. The map is the hub that
                  every other screen returns to through its own 44 px header.
    index         the map: camera ladder, rail, and context card
    harvest       Sklizeň, the ranked list
    dex           Jablkodex: XP, streak, quest, and variety grid
    profile       account, GDPR controls, rail side, and language
    tree/[id]     tree detail
    add-tree      add and edit modal
  components/     tree-map for native and web, rail, context card, map chrome,
                  the placement crosshair, toast, and shared UI
  lib/            types, the zustand and AsyncStorage store, zoom-ladder, chrome
                  insets, clustering, Jablkodex progress, verification rules,
                  seed data, and the Supabase client
  constants/      theme palette
supabase/
  schema.sql      tables, row-level security, and the viewport RPC
  migration-003   the verification rules: write limits, confirmations, and
                  the triggers that own tree status. Every project runs it.
  migration-004   placement: the distance a pin carries from its author, and
                  the leash that keeps it near them. Every project runs it.
```
