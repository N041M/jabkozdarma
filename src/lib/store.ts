import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import * as db from './db';
import { QUEST_TARGET, XP, dayKey, weekKey } from './dex';
import { distanceMeters } from './geo';
import type { MapMode } from './map-style';
import type { LatLng } from './routing';
import { seedProfile, seedReports, seedTrees } from './seed';
import { isBackendConfigured, supabase } from './supabase';
import type {
  FlagReason,
  Profile,
  RipenessState,
  Tree,
  TreeConfirmation,
  TreeFlag,
  TreeReport,
} from './types';
import {
  checkConfirmation,
  checkNewPin,
  confirmationCount,
  statusFor,
  type ConfirmRejection,
  type PinRejection,
} from './verification';
import type { ZoomStop } from './zoom-ladder';

/**
 * Single source of truth for the UI, in two modes:
 *
 *  - Local mode (no Supabase env): seed data + on-device persistence only.
 *  - Backend mode: hydrated from Postgres on startup; mutations apply
 *    optimistically and write through to Supabase. Auth is email-OTP.
 *
 * Write failures in backend mode are logged, not blocking — MVP tradeoff,
 * a retry queue is the offline-mode milestone.
 */

function makeId(): string {
  if (isBackendConfigured) return db.newId(); // DB columns are uuid
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function logSyncError(op: string) {
  return (err: unknown) => console.error(`[sync] ${op} failed:`, err);
}

/**
 * The verification triggers raise their rejection code as the exception
 * message, so a refusal reads the same whether `verification.ts` caught it
 * before the write or Postgres caught it after. Anything else — a network
 * blip, a policy error — isn't a rejection and must not be reported as one.
 */
const PIN_REJECTIONS: PinRejection[] = [
  'bad_coords',
  'bad_fix',
  'out_of_area',
  'too_close',
  'daily_limit',
];
const CONFIRM_REJECTIONS: ConfirmRejection[] = [
  'no_such_tree',
  'own_tree',
  'already_confirmed',
  'no_fix',
  'bad_fix',
  'too_far',
  'daily_limit',
];

function rejectionFrom<T extends string>(err: unknown, codes: T[]): T | null {
  const message = (err as { message?: string } | null)?.message ?? '';
  return codes.find((code) => message.includes(code)) ?? null;
}

/**
 * Best display name for a signed-in user: what they typed when signing up,
 * else what the OAuth provider told us, else the email's local part.
 */
function preferredUsername(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}): string {
  const meta = user.user_metadata ?? {};
  const candidate =
    (meta.username as string) ||
    (meta.full_name as string) ||
    (meta.name as string) ||
    user.email?.split('@')[0] ||
    '';
  return candidate.trim().replace(/\s+/g, ' ').slice(0, 30);
}

/**
 * Everything a contribution moves at once: experience, the day's streak mark,
 * the weekly quest, and the Jablkodex. Kept in one place so a report awarded
 * from the map and one awarded from the detail screen can never drift apart.
 */
function applyProgress(
  s: {
    xp: number;
    activeDays: string[];
    questWeek: string;
    questTrees: string[];
    questRewarded: boolean;
    seenVarieties: string[];
  },
  opts: { xp: number; variety?: string | null; questTreeId?: string }
): { patch: Partial<AppState>; result: RewardResult } {
  const today = dayKey();
  const week = weekKey();

  // A new week wipes the progress before this contribution is counted.
  const fresh = s.questWeek !== week;
  const baseTrees = fresh ? [] : s.questTrees;
  const baseRewarded = fresh ? false : s.questRewarded;

  // Only a tree this week has not seen yet moves the quest along.
  const questTrees =
    opts.questTreeId && !baseTrees.includes(opts.questTreeId)
      ? [...baseTrees, opts.questTreeId]
      : baseTrees;
  const questCompleted = !baseRewarded && questTrees.length >= QUEST_TARGET;

  const variety = opts.variety?.trim() || null;
  const isNewVariety =
    !!variety &&
    !s.seenVarieties.some((v) => v.toLocaleLowerCase('cs') === variety.toLocaleLowerCase('cs'));

  const gained = opts.xp + (questCompleted ? XP.quest : 0);

  return {
    patch: {
      xp: s.xp + gained,
      activeDays: s.activeDays.includes(today) ? s.activeDays : [...s.activeDays, today],
      questWeek: week,
      questTrees,
      questRewarded: baseRewarded || questCompleted,
      seenVarieties: isNewVariety ? [...s.seenVarieties, variety] : s.seenVarieties,
    },
    result: { xp: gained, questCompleted, newVariety: isNewVariety ? variety : null },
  };
}

export interface NewTreeInput {
  lat: number;
  lng: number;
  /** Radius of the fix the pin was placed from, in metres. */
  accuracyM: number | null;
  species: Tree['species'];
  variety: string | null;
  description: string | null;
  access: Tree['access'];
  seasonStart: number | null;
  seasonEnd: number | null;
  photoUri: string | null;
}

/** Which side of the screen the navigation rail sits on. */
export type RailSide = 'right' | 'left';

/**
 * A refused write, so the screen can say which rule stopped it. Both halves
 * of the verification system produce these: `verification.ts` before the
 * write, and the Postgres triggers after it.
 */
export type AddTreeResult = { ok: true; tree: Tree } | { ok: false; reason: PinRejection };

export type ConfirmResult =
  | { ok: true; status: Tree['status']; reward: RewardResult }
  | { ok: false; reason: ConfirmRejection };

/** What a contribution earned, so the caller can raise the right toast. */
export interface RewardResult {
  xp: number;
  questCompleted: boolean;
  newVariety: string | null;
}

export interface ActiveRoute {
  treeId: string;
  treeLabel: string;
  coords: LatLng[];
  distanceM: number;
  durationS: number;
}

interface AppState {
  profile: Profile | null;
  profiles: Profile[];
  trees: Tree[];
  reports: TreeReport[];
  confirmations: TreeConfirmation[];
  flags: TreeFlag[];
  favorites: string[]; // tree ids
  /**
   * The last write the verification rules refused, for the map screen to
   * explain. Transient: a refusal is news once, not state.
   */
  lastRejection: PinRejection | null;
  activeRoute: ActiveRoute | null; // transient, not persisted
  hydrated: boolean; // backend snapshot loaded
  mapMode: MapMode;

  // Camera ladder & chrome placement. Both are preferences, both persist.
  zoomStop: ZoomStop;
  railSide: RailSide;

  /**
   * Gamification. Local-only for now, which means it is trivially editable
   * on-device — it needs a server-side home once the backend is live.
   */
  xp: number;
  activeDays: string[]; // 'YYYY-MM-DD' of days this picker contributed on
  questWeek: string; // the Monday the quest progress belongs to
  /**
   * Distinct trees reported on this week. The quest is "report ripeness at
   * three trees", so three reports on the same tree must not clear it.
   */
  questTrees: string[];
  questRewarded: boolean;
  seenVarieties: string[]; // varieties contributed to or reported on

  initBackend: () => void;
  signIn: (username: string) => void; // local mode only
  sendCode: (email: string, username: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => void;
  addTree: (input: NewTreeInput) => AddTreeResult;
  confirmTree: (
    treeId: string,
    here: LatLng | null,
    accuracyM: number | null
  ) => Promise<ConfirmResult>;
  clearRejection: () => void;
  updateTree: (id: string, patch: Partial<NewTreeInput>) => void;
  removeTree: (id: string) => void;
  addReport: (
    treeId: string,
    state: RipenessState,
    note: string | null,
    kind?: 'report' | 'checkIn'
  ) => RewardResult | null;
  flagTree: (treeId: string, reason: FlagReason) => void;
  toggleFavorite: (treeId: string) => void;
  setRoute: (route: ActiveRoute) => void;
  clearRoute: () => void;
  setMapMode: (mode: MapMode) => void;
  setZoomStop: (stop: ZoomStop) => void;
  setRailSide: (side: RailSide) => void;
  renameProfile: (username: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  exportMyData: () => string;
}

let backendInitialized = false;

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile: null,
      profiles: isBackendConfigured ? [] : [seedProfile],
      trees: isBackendConfigured ? [] : seedTrees,
      reports: isBackendConfigured ? [] : seedReports,
      confirmations: [],
      flags: [],
      favorites: [],
      lastRejection: null,
      activeRoute: null,
      hydrated: !isBackendConfigured,
      mapMode: 'go',

      zoomStop: 1,
      railSide: 'right',

      xp: 0,
      activeDays: [],
      questWeek: weekKey(),
      questTrees: [],
      questRewarded: false,
      seenVarieties: [],

      initBackend: () => {
        if (!supabase || backendInitialized) return;
        backendInitialized = true;

        db.fetchSnapshot()
          .then(({ trees, reports, profiles, confirmations }) =>
            set({ trees, reports, profiles, confirmations, hydrated: true })
          )
          .catch(logSyncError('hydrate'));

        const applySession = (
          session: {
            user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
          } | null
        ) => {
          if (!session) {
            set({ profile: null, favorites: [] });
            return;
          }
          db.ensureProfile(session.user.id, preferredUsername(session.user))
            .then((profile) => {
              set((s) => ({
                profile,
                profiles: s.profiles.some((p) => p.id === profile.id)
                  ? s.profiles
                  : [...s.profiles, profile],
              }));
              return db.fetchFavorites(profile.id);
            })
            .then((favorites) => set({ favorites }))
            .catch(logSyncError('auth/profile'));
        };

        // Restore a persisted session immediately, then track changes.
        supabase.auth
          .getSession()
          .then(({ data }) => applySession(data.session))
          .catch(logSyncError('getSession'));
        supabase.auth.onAuthStateChange((_event, session) => applySession(session));
      },

      signIn: (username) => {
        if (isBackendConfigured) return; // backend mode uses sendCode/verifyCode
        const trimmed = username.trim();
        if (!trimmed) return;
        const existing = get().profiles.find(
          (p) => p.username.toLowerCase() === trimmed.toLowerCase() && p.id !== seedProfile.id
        );
        if (existing) {
          set({ profile: existing });
          return;
        }
        const profile: Profile = {
          id: makeId(),
          username: trimmed,
          bio: null,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ profile, profiles: [...s.profiles, profile] }));
      },

      sendCode: async (email, username) => {
        await db.sendLoginCode(email.trim(), username.trim());
        // the emailed link completes sign-in; onAuthStateChange loads the profile
      },

      signInWithGoogle: async () => {
        await db.signInWithGoogle(); // navigates away; the return trip carries the session
      },

      signOut: () => {
        set({ profile: null, favorites: [] });
        if (isBackendConfigured) db.signOutBackend().catch(logSyncError('signOut'));
      },

      addTree: (input) => {
        const profile = get().profile;
        // The same rules the database enforces, run here first so local mode
        // behaves like the backend and a refusal costs no round trip.
        const refused = checkNewPin({
          lat: input.lat,
          lng: input.lng,
          accuracyM: input.accuracyM,
          profileId: profile?.id ?? null,
          ownTrees: get().trees,
        });
        if (refused || !profile) return { ok: false, reason: refused ?? 'no_profile' };

        const tree: Tree = {
          id: makeId(),
          // Every pin starts unverified. Only other pickers standing next to
          // it promote it — see `verification.ts`.
          status: 'unverified',
          confirmations: 0,
          trusted: false,
          createdBy: profile.id,
          createdAt: new Date().toISOString(),
          ...input,
        };
        // Everything the reward touches, as it stood before this pin. If the
        // database refuses the write, the pin comes back off the map and its
        // reward has to come with it — otherwise a pin that never landed
        // still pays 40 XP, and a picker can bank it on repeat.
        const before = (({ xp, activeDays, questWeek, questTrees, questRewarded, seenVarieties }) => ({
          xp,
          activeDays,
          questWeek,
          questTrees,
          questRewarded,
          seenVarieties,
        }))(get());

        const { patch } = applyProgress(get(), { xp: XP.newTree, variety: input.variety });
        set((s) => ({ trees: [...s.trees, tree], lastRejection: null, ...patch }));

        if (isBackendConfigured) {
          db.insertTree(tree.id, input, profile.id)
            .then(() => {
              if (input.photoUri && !input.photoUri.startsWith('http')) {
                return db.uploadTreePhoto(tree.id, profile.id, input.photoUri).then((url) =>
                  set((s) => ({
                    trees: s.trees.map((t) => (t.id === tree.id ? { ...t, photoUri: url } : t)),
                  }))
                );
              }
            })
            .catch((err) => {
              logSyncError('addTree')(err);
              // A pin the database refused isn't on the map. Roll the
              // optimistic copy back rather than leaving a tree only this
              // device can see, and record why so a screen can explain it.
              // Anything that isn't a rejection keeps the old behaviour of
              // logging and moving on, because a dropped connection must not
              // cost someone the pin they just walked to.
              const reason = rejectionFrom(err, PIN_REJECTIONS);
              if (reason) {
                set((s) => ({
                  trees: s.trees.filter((t) => t.id !== tree.id),
                  lastRejection: reason,
                  ...before,
                }));
              }
            });
        }
        return { ok: true, tree };
      },

      /**
       * Vouch for a tree from where you're standing. Two distinct pickers
       * make a pin real; nobody can confirm their own.
       *
       * In backend mode Postgres measures the distance against its own copy
       * of the location and owns the promotion, so the local checks here
       * only save a round trip — they are not the enforcement.
       */
      confirmTree: async (treeId, here, accuracyM) => {
        const state = get();
        const profile = state.profile;
        const tree = state.trees.find((t) => t.id === treeId);
        if (!tree) return { ok: false, reason: 'no_such_tree' };

        const refused = checkConfirmation({
          tree,
          profileId: profile?.id ?? null,
          here,
          accuracyM,
          confirmations: state.confirmations,
        });
        if (refused || !profile || !here) {
          return { ok: false, reason: refused ?? 'no_profile' };
        }

        let serverStatus: Tree['status'] | null = null;
        if (isBackendConfigured) {
          try {
            serverStatus = await db.confirmTree(treeId, here, accuracyM);
          } catch (err) {
            logSyncError('confirmTree')(err);
            // An unrecognised failure is a transport problem, not a verdict
            // about where the picker is standing — telling them their
            // location is unknown would send them home over a flaky signal.
            const reason = rejectionFrom(err, CONFIRM_REJECTIONS);
            return { ok: false, reason: reason ?? 'sync_failed' };
          }
        }

        // Everything below reads state as it is *now*: the snapshot above was
        // taken before the round trip, and the startup hydrate can land
        // during it. Writing the stale array back would drop every
        // confirmation the hydrate had just loaded. Nothing awaits between
        // here and the `set`, so this cannot go stale in turn.
        const fresh = get();
        const current = fresh.trees.find((t) => t.id === treeId) ?? tree;

        const confirmation: TreeConfirmation = {
          id: makeId(),
          treeId,
          userId: profile.id,
          distanceM: distanceMeters(here.lat, here.lng, current.lat, current.lng),
          accuracyM,
          createdAt: new Date().toISOString(),
        };
        const confirmations = fresh.confirmations.some(
          (c) => c.treeId === treeId && c.userId === profile.id
        )
          ? fresh.confirmations
          : [...fresh.confirmations, confirmation];
        // Local mode has no trigger, so the shared rule runs here instead.
        const status = serverStatus ?? statusFor(current, confirmations, fresh.flags);
        const { patch, result } = applyProgress(fresh, {
          xp: XP.confirm,
          // Standing at a tree is how you meet its variety, the same as
          // pinning it or reporting on it.
          variety: current.variety,
        });
        set((s) => ({
          confirmations,
          trees: s.trees.map((t) =>
            t.id === treeId
              ? { ...t, status, confirmations: confirmationCount(t, confirmations) }
              : t
          ),
          ...patch,
        }));
        return { ok: true, status, reward: result };
      },

      clearRejection: () => set({ lastRejection: null }),

      updateTree: (id, patch) => {
        const profile = get().profile;
        set((s) => ({
          trees: s.trees.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
        if (isBackendConfigured && profile) {
          db.updateTree(id, patch).catch(logSyncError('updateTree'));
          const uri = patch.photoUri;
          if (uri && !uri.startsWith('http')) {
            db.uploadTreePhoto(id, profile.id, uri)
              .then((url) =>
                set((s) => ({
                  trees: s.trees.map((t) => (t.id === id ? { ...t, photoUri: url } : t)),
                }))
              )
              .catch(logSyncError('uploadPhoto'));
          }
        }
      },

      removeTree: (id) => {
        const profile = get().profile;
        const tree = get().trees.find((t) => t.id === id);
        if (!profile || !tree || tree.createdBy !== profile.id) return;
        set((s) => ({
          trees: s.trees.filter((t) => t.id !== id),
          reports: s.reports.filter((r) => r.treeId !== id),
          confirmations: s.confirmations.filter((c) => c.treeId !== id),
          flags: s.flags.filter((f) => f.treeId !== id),
          favorites: s.favorites.filter((fid) => fid !== id),
        }));
        if (isBackendConfigured) db.deleteTree(id).catch(logSyncError('removeTree'));
      },

      addReport: (treeId, state, note, kind = 'report') => {
        const profile = get().profile;
        if (!profile) return null;
        const report: TreeReport = {
          id: makeId(),
          treeId,
          userId: profile.id,
          state,
          note: note?.trim() || null,
          createdAt: new Date().toISOString(),
        };
        // Reporting on a tree counts as meeting its variety, the same as
        // pinning one — that is how the Jablkodex fills for people who
        // mostly confirm other pickers' finds.
        const variety = get().trees.find((t) => t.id === treeId)?.variety ?? null;
        const { patch, result } = applyProgress(get(), {
          xp: kind === 'checkIn' ? XP.checkIn : XP.report,
          variety,
          questTreeId: treeId,
        });
        set((s) => ({ reports: [...s.reports, report], ...patch }));
        if (isBackendConfigured) db.insertReport(report).catch(logSyncError('addReport'));
        return result;
      },

      flagTree: (treeId, reason) => {
        const profile = get().profile;
        if (!profile) return;
        const flag: TreeFlag = {
          id: makeId(),
          treeId,
          userId: profile.id,
          reason,
          createdAt: new Date().toISOString(),
        };
        set((s) => {
          const flags = [...s.flags, flag];
          // A "gone" flag used to retire a tree on the spot, which meant one
          // tap could erase a real one. It takes corroboration now, on the
          // same rule the SQL trigger runs: the author is decisive, anyone
          // else needs a second picker to agree.
          return {
            flags,
            trees: s.trees.map((t) =>
              t.id === treeId ? { ...t, status: statusFor(t, s.confirmations, flags) } : t
            ),
          };
        });
        if (isBackendConfigured) {
          db.insertFlag(flag.id, treeId, profile.id, reason).catch(logSyncError('flagTree'));
        }
      },

      toggleFavorite: (treeId) => {
        const profile = get().profile;
        const on = !get().favorites.includes(treeId);
        set((s) => ({
          favorites: on ? [...s.favorites, treeId] : s.favorites.filter((id) => id !== treeId),
        }));
        if (isBackendConfigured && profile) {
          db.setFavorite(profile.id, treeId, on).catch(logSyncError('favorite'));
        }
      },

      setRoute: (route) => set({ activeRoute: route }),
      clearRoute: () => set({ activeRoute: null }),
      setMapMode: (mode) => set({ mapMode: mode }),
      setZoomStop: (stop) => set({ zoomStop: stop }),
      setRailSide: (side) => set({ railSide: side }),

      renameProfile: async (username) => {
        const profile = get().profile;
        const trimmed = username.trim();
        if (!profile || !trimmed || trimmed === profile.username) return;
        if (isBackendConfigured) {
          await db.updateUsername(profile.id, trimmed); // throws on collision
        }
        const updated = { ...profile, username: trimmed };
        set((s) => ({
          profile: updated,
          profiles: s.profiles.map((p) => (p.id === profile.id ? updated : p)),
        }));
      },

      deleteAccount: async () => {
        const profile = get().profile;
        if (!profile) return;
        if (isBackendConfigured) await db.deleteMyAccount();
        // wipe every local trace of this person too
        set((s) => {
          const confirmations = s.confirmations.filter((c) => c.userId !== profile.id);
          const flags = s.flags.filter((f) => f.userId !== profile.id);
          const trees = s.trees.filter((t) => t.createdBy !== profile.id);
          // Only the pins this person had actually voted on can change, which
          // is what `delete_my_account()` recomputes server-side too.
          // Re-deriving every tree would put the whole map at the mercy of a
          // confirmations list that may be incomplete.
          const touched = new Set([
            ...s.confirmations.filter((c) => c.userId === profile.id).map((c) => c.treeId),
            ...s.flags.filter((f) => f.userId === profile.id).map((f) => f.treeId),
          ]);
          return {
            profile: null,
            profiles: s.profiles.filter((p) => p.id !== profile.id),
            // Withdrawing this person's vouches has to demote what stood on
            // them, not leave pins resting on a deleted vote.
            trees: trees.map((t) =>
              touched.has(t.id) ? { ...t, status: statusFor(t, confirmations, flags) } : t
            ),
            reports: s.reports.filter((r) => r.userId !== profile.id),
            confirmations,
            flags,
            favorites: [],
            // progress is personal data too — it goes with the account
            xp: 0,
            activeDays: [],
            questWeek: weekKey(),
            questTrees: [],
            questRewarded: false,
            seenVarieties: [],
          };
        });
      },

      /** Everything this account holds, as portable JSON (GDPR art. 20). */
      exportMyData: () => {
        const s = get();
        const id = s.profile?.id;
        return JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            profile: s.profile,
            trees: s.trees.filter((t) => t.createdBy === id),
            reports: s.reports.filter((r) => r.userId === id),
            confirmations: s.confirmations.filter((c) => c.userId === id),
            flags: s.flags.filter((f) => f.userId === id),
            favorites: s.favorites,
            progress: {
              xp: s.xp,
              activeDays: s.activeDays,
              questWeek: s.questWeek,
              questTrees: s.questTrees,
              seenVarieties: s.seenVarieties,
            },
          },
          null,
          2
        );
      },
    }),
    {
      name: 'jabkozdarma-v1',
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        profile: s.profile,
        profiles: s.profiles,
        trees: s.trees,
        reports: s.reports,
        confirmations: s.confirmations,
        flags: s.flags,
        favorites: s.favorites,
        mapMode: s.mapMode,
        zoomStop: s.zoomStop,
        railSide: s.railSide,
        xp: s.xp,
        activeDays: s.activeDays,
        questWeek: s.questWeek,
        questTrees: s.questTrees,
        questRewarded: s.questRewarded,
        seenVarieties: s.seenVarieties,
      }),
      // Heals older persisted state that could brick the app: trees with
      // invalid coordinates crash the map, and full-size camera photos
      // stored as multi-MB data URIs freeze serialization on every change.
      migrate: (persisted, version) => {
        const s = persisted as Partial<AppState>;
        if (Array.isArray(s.trees)) {
          s.trees = s.trees
            .filter((t) => Number.isFinite(t?.lat) && Number.isFinite(t?.lng))
            .map((t) =>
              t.photoUri && t.photoUri.startsWith('data:') && t.photoUri.length > 400_000
                ? { ...t, photoUri: null }
                : t
            )
            .map((t) => ({
              ...t,
              accuracyM: t.accuracyM ?? null,
              confirmations: t.confirmations ?? 0,
              // Pins saved before verification existed were saved when
              // everything was trusted. Grandfather them in rather than
              // demoting somebody's whole map on an app update — the same
              // clause the SQL backfill applies.
              trusted: t.trusted ?? (version < 3 && t.status !== 'gone'),
            }));
        }
        if (!Array.isArray(s.confirmations)) s.confirmations = [];
        return s;
      },
    }
  )
);
