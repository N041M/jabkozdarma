import type { Profile, Tree, TreeReport } from './types';

/**
 * Starter content so the map is never empty on first launch.
 * A handful of well-known free-picking spots around Prague; replaced by
 * live Supabase data once the backend is connected.
 */
export const seedProfile: Profile = {
  id: 'seed-community',
  username: 'komunita',
  bio: 'Seed pins from the JabkoZdarma community.',
  createdAt: '2026-08-01T08:00:00.000Z',
};

export const seedTrees: Tree[] = [
  {
    id: 'seed-1',
    lat: 50.0755,
    lng: 14.3922,
    species: 'apple',
    variety: 'Panenské české',
    description: 'Old orchard remnant on the Petřín slope, two trees side by side. Small sweet apples.',
    access: 'public',
    status: 'active',
    seasonStart: 9,
    seasonEnd: 10,
    photoUri: null,
    createdBy: 'seed-community',
    createdAt: '2026-08-02T10:00:00.000Z',
  },
  {
    id: 'seed-2',
    lat: 50.0405,
    lng: 14.4442,
    species: 'apple',
    variety: null,
    description: 'Row of apple trees along the cycle path below Vyšehrad. Free for anyone.',
    access: 'roadside',
    status: 'active',
    seasonStart: 8,
    seasonEnd: 9,
    photoUri: null,
    createdBy: 'seed-community',
    createdAt: '2026-08-03T09:30:00.000Z',
  },
  {
    id: 'seed-3',
    lat: 50.1173,
    lng: 14.3862,
    species: 'apple',
    variety: 'Strýmka',
    description: 'Big solitary tree in Stromovka park near the planetarium. Tart, great for pies.',
    access: 'public',
    status: 'active',
    seasonStart: 10,
    seasonEnd: 11,
    photoUri: null,
    createdBy: 'seed-community',
    createdAt: '2026-08-05T16:20:00.000Z',
  },
  {
    id: 'seed-4',
    lat: 50.0663,
    lng: 14.5081,
    species: 'apple',
    variety: null,
    description: 'Garden tree hanging over the fence; the owner is happy for passers-by to pick what hangs over. Ring the bell to pick more.',
    access: 'ask_owner',
    status: 'active',
    seasonStart: 9,
    seasonEnd: 10,
    photoUri: null,
    createdBy: 'seed-community',
    createdAt: '2026-08-07T11:00:00.000Z',
  },
  {
    id: 'seed-5',
    lat: 50.1029,
    lng: 14.4531,
    species: 'apple',
    variety: 'James Grieve',
    description: 'Three young trees in the community orchard behind the Holešovice market.',
    access: 'public',
    status: 'unverified',
    seasonStart: 8,
    seasonEnd: 9,
    photoUri: null,
    createdBy: 'seed-community',
    createdAt: '2026-08-10T14:45:00.000Z',
  },
];

export const seedReports: TreeReport[] = [
  {
    id: 'seed-r1',
    treeId: 'seed-2',
    userId: 'seed-community',
    state: 'ripe',
    note: 'Lower branches picked clean but plenty higher up.',
    createdAt: '2026-08-20T17:00:00.000Z',
  },
  {
    id: 'seed-r2',
    treeId: 'seed-1',
    userId: 'seed-community',
    state: 'unripe',
    note: 'Give it two more weeks.',
    createdAt: '2026-08-18T12:00:00.000Z',
  },
  {
    id: 'seed-r3',
    treeId: 'seed-5',
    userId: 'seed-community',
    state: 'ripe',
    note: null,
    createdAt: '2026-08-21T08:30:00.000Z',
  },
];
