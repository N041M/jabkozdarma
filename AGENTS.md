# Working in this repo

JabkoZdarma is a community map of freely pickable fruit trees around Prague. It's an
Expo app in TypeScript, built web-first: v1 ships as an installable PWA, and the native
iOS and Android path stays compiling for v2 without being the focus.

Read [README.md](README.md) first for what the app does and how the map behaves. This
file covers the conventions that aren't obvious from the code.

## Commands

```bash
npm start          # web dev server at http://localhost:8081
npm run lint       # ESLint, through expo lint
npx tsc --noEmit   # typecheck
```

Restart the dev server after you change any environment variable. Expo bakes them in at
bundle time, so a running server doesn't pick them up.

## Architecture

- **`src/lib/store.ts`** is the single source of truth, using zustand with AsyncStorage
  persistence. It runs in two modes: local mode with seed data when no Supabase
  credentials exist, and backend mode when they do, hydrating from Postgres and writing
  through optimistically. Add state here rather than lifting it into screens.
- **`src/components/tree-map.tsx` and `tree-map.web.tsx`** are a platform split over the
  shared props in `tree-map.types.ts`. The web file is MapLibre GL and carries the real
  detail; the native file is `react-native-maps` and stays deliberately simpler.
- **`src/lib/zoom-ladder.ts`** defines the four camera stops. Anything that changes with
  zoom (pitch, sprite size, avatar size, clustering, density) belongs in the `STOPS`
  table, not scattered through components.
- **`src/lib/chrome.ts`** owns the bottom-edge measurements that every floating control
  positions against. Don't hardcode bottom offsets in screens.

## Conventions

- **Never hardcode a color.** Use the palette from `src/constants/theme.ts` through
  `useTheme()`. Ripeness colors are theme-independent by design, because they have to
  read against the map in both schemes. When you need a new semantic color, add a token
  to both the light and dark palettes rather than inlining a hex value.
- **Never hardcode user-facing text.** Every string goes in `src/lib/i18n.ts`, in both
  Czech and English. Czech needs three plural forms, so use the `{n, plural, one {…}
  few {…} other {…}}` syntax for anything counted. Strings resolve once at module load,
  which is why changing the language reloads the app.
- **Reuse the shared components in `src/components/ui.tsx`** — `ScreenHeader`, `Chip`,
  `Button`, `AccessBadge`, `FieldLabel`. Screens shouldn't reinvent chip or header
  geometry.
- **The map is the hub.** Every other screen is a pushed route with its own 44 px
  `ScreenHeader` whose back control returns to the map. There's no tab bar; navigation
  lives in the rail on the map screen.
- **Animated values go in lazy state**, as `useState(() => new Animated.Value(0))`, not
  in a ref. The React Compiler's lint rules reject reading a ref during render, and
  building a style from an animated value is exactly that.
- Comments explain **why**, not what. Match the density and voice of the surrounding
  code.

## Guardrails

These exist because of real failures. Don't remove them without understanding them:

- **Coordinates are validated before they reach the map.** A tree with a `NaN`
  latitude crashes MapLibre, and persisted bad data would crash it on every launch. The
  store's `migrate` heals old state, and the map screen filters again.
- **Photos are downscaled on web before they're stored.** A raw phone photo as a
  multi-megabyte data URI blows the localStorage quota and freezes serialization.
- **The web map rebuilds itself if the style never loads.** Browsers stall
  `requestAnimationFrame` on hidden pages, and MapLibre defers its style load to a frame
  callback, so a map created while the page is hidden can come back blank forever.
- **The store never blocks the UI on a sync failure.** Write errors log and move on.

## Documentation

Markdown docs follow the
[Google developer documentation style guide](https://developers.google.com/style):
second person, active voice, present tense, sentence case headings, serial commas, and
`>` between bolded UI elements for navigation paths. This doesn't apply to
`src/lib/privacy-text.ts`, which is a legal notice, or to code comments.

## Backend

Supabase is live. The schema, migrations, and dashboard walkthrough are in
[`supabase/`](supabase/) — see [Supabase setup](supabase/SETUP.md). The anon key is safe
in the client because row-level security guards every table.

Gamification state (XP, streaks, quest progress, discovered varieties) is currently
local-only, so anyone can edit it on their own device. It needs a server-side home
before it means anything.

## Commits

Commit as the repository owner alone. Don't add `Co-Authored-By:` trailers or generated-with
notices. `CLAUDE.md`, `.claude/`, and `.vscode/` are gitignored on purpose; keep
tool-specific files out of the repo and put shared guidance here instead.
