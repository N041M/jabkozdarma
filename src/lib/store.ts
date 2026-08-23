import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import * as db from './db';
import type { LatLng } from './routing';
import { seedProfile, seedReports, seedTrees } from './seed';
import { isBackendConfigured, supabase } from './supabase';
import type { FlagReason, Profile, RipenessState, Tree, TreeFlag, TreeReport } from './types';

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

export interface NewTreeInput {
  lat: number;
  lng: number;
  variety: string | null;
  description: string | null;
  access: Tree['access'];
  seasonStart: number | null;
  seasonEnd: number | null;
  photoUri: string | null;
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

  initBackend: () => void;
  signIn: (username: string) => void; // local mode only
  sendCode: (email: string, username: string) => Promise<void>;
  signOut: () => void;
  addTree: (input: NewTreeInput) => Tree | null;
  updateTree: (id: string, patch: Partial<NewTreeInput>) => void;
  addReport: (treeId: string, state: RipenessState, note: string | null) => void;
  flagTree: (treeId: string, reason: FlagReason) => void;
  toggleFavorite: (treeId: string) => void;
  setRoute: (route: ActiveRoute) => void;
  clearRoute: () => void;
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

      initBackend: () => {
        if (!supabase || backendInitialized) return;
        backendInitialized = true;

        db.fetchSnapshot()
          .then(({ trees, reports, profiles }) =>
            set({ trees, reports, profiles, hydrated: true })
          )
          .catch(logSyncError('hydrate'));

        supabase.auth.onAuthStateChange((_event, session) => {
          if (!session) {
            set({ profile: null, favorites: [] });
            return;
          }
          const desired = (session.user.user_metadata?.username as string | undefined) ?? '';
          db.ensureProfile(session.user.id, desired)
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
        });
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

      signOut: () => {
        set({ profile: null, favorites: [] });
        if (isBackendConfigured) db.signOutBackend().catch(logSyncError('signOut'));
      },

      addTree: (input) => {
        const profile = get().profile;
        if (!profile) return null;
        const tree: Tree = {
          id: makeId(),
          species: 'apple',
          status: 'active',
          createdBy: profile.id,
          createdAt: new Date().toISOString(),
          ...input,
        };
        set((s) => ({ trees: [...s.trees, tree] }));

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

      addReport: (treeId, state, note) => {
        const profile = get().profile;
        if (!profile) return;
        const report: TreeReport = {
          id: makeId(),
          treeId,
          userId: profile.id,
          state,
          note: note?.trim() || null,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ reports: [...s.reports, report] }));
        if (isBackendConfigured) db.insertReport(report).catch(logSyncError('addReport'));
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
    }),
    {
      name: 'jabkozdarma-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        profile: s.profile,
        profiles: s.profiles,
        trees: s.trees,
        reports: s.reports,
        flags: s.flags,
        favorites: s.favorites,
      }),
    }
  )
);
