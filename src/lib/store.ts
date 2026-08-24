import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import * as db from './db';
import { QUEST_TARGET, XP, dayKey, weekKey } from './dex';
import type { MapMode } from './map-style';
import type { LatLng } from './routing';
import { seedProfile, seedReports, seedTrees } from './seed';
import { isBackendConfigured, supabase } from './supabase';
import type { FlagReason, Profile, RipenessState, Tree, TreeFlag, TreeReport } from './types';
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
  flags: TreeFlag[];
  favorites: string[]; // tree ids
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
  addTree: (input: NewTreeInput) => Tree | null;
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
      flags: [],
      favorites: [],
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
          .then(({ trees, reports, profiles }) =>
            set({ trees, reports, profiles, hydrated: true })
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
        if (!profile) return null;
        const tree: Tree = {
          id: makeId(),
          status: 'active',
          createdBy: profile.id,
          createdAt: new Date().toISOString(),
          ...input,
        };
        const { patch } = applyProgress(get(), { xp: XP.newTree, variety: input.variety });
        set((s) => ({ trees: [...s.trees, tree], ...patch }));

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
            .catch(logSyncError('addTree'));
        }
        return tree;
      },

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
        set((s) => ({
          flags: [...s.flags, flag],
          // "gone" flags immediately mark the tree so the map stays honest
          trees:
            reason === 'gone'
              ? s.trees.map((t) => (t.id === treeId ? { ...t, status: 'gone' as const } : t))
              : s.trees,
        }));
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
        set((s) => ({
          profile: null,
          profiles: s.profiles.filter((p) => p.id !== profile.id),
          trees: s.trees.filter((t) => t.createdBy !== profile.id),
          reports: s.reports.filter((r) => r.userId !== profile.id),
          flags: s.flags.filter((f) => f.userId !== profile.id),
          favorites: [],
          // progress is personal data too — it goes with the account
          xp: 0,
          activeDays: [],
          questWeek: weekKey(),
          questTrees: [],
          questRewarded: false,
          seenVarieties: [],
        }));
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
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        profile: s.profile,
        profiles: s.profiles,
        trees: s.trees,
        reports: s.reports,
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
      migrate: (persisted) => {
        const s = persisted as Partial<AppState>;
        if (Array.isArray(s.trees)) {
          s.trees = s.trees
            .filter((t) => Number.isFinite(t?.lat) && Number.isFinite(t?.lng))
            .map((t) =>
              t.photoUri && t.photoUri.startsWith('data:') && t.photoUri.length > 400_000
                ? { ...t, photoUri: null }
                : t
            );
        }
        return s;
      },
    }
  )
);
