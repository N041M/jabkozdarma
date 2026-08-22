import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { seedProfile, seedReports, seedTrees } from './seed';
import type { FlagReason, Profile, RipenessState, Tree, TreeFlag, TreeReport } from './types';

/**
 * Local-first store. This is the single source of truth for the UI;
 * when Supabase is connected (see lib/supabase.ts) the same shape is
 * hydrated from Postgres instead of the seed data, and mutations are
 * queued for sync. Until then everything persists on-device.
 */

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

interface AppState {
  profile: Profile | null;
  profiles: Profile[];
  trees: Tree[];
  reports: TreeReport[];
  flags: TreeFlag[];
  favorites: string[]; // tree ids

  signIn: (username: string) => void;
  signOut: () => void;
  addTree: (input: NewTreeInput) => Tree | null;
  updateTree: (id: string, patch: Partial<NewTreeInput>) => void;
  addReport: (treeId: string, state: RipenessState, note: string | null) => void;
  flagTree: (treeId: string, reason: FlagReason) => void;
  toggleFavorite: (treeId: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile: null,
      profiles: [seedProfile],
      trees: seedTrees,
      reports: seedReports,
      flags: [],
      favorites: [],

      signIn: (username) => {
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

      signOut: () => set({ profile: null }),

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
        return tree;
      },

      updateTree: (id, patch) => {
        set((s) => ({
          trees: s.trees.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
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
      },

      toggleFavorite: (treeId) => {
        set((s) => ({
          favorites: s.favorites.includes(treeId)
            ? s.favorites.filter((id) => id !== treeId)
            : [...s.favorites, treeId],
        }));
      },
    }),
    {
      name: 'jabkozdarma-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
