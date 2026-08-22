import type { Profile, Tree, TreeReport } from './types';

/**
 * Starter content so the map is never empty on first launch.
 * A handful of well-known free-picking spots around Prague; replaced by
 * live Supabase data once the backend is connected.
 */
export const seedProfile: Profile = {
  id: 'seed-community',
  username: 'komunita',
  bio: 'Startovní špendlíky komunity JabkoZdarma.',
  createdAt: '2026-08-01T08:00:00.000Z',
};

export const seedTrees: Tree[] = [
  {
    id: 'seed-1',
    lat: 50.0755,
    lng: 14.3922,
    species: 'apple',
    variety: 'Panenské české',
    description: 'Zbytek starého sadu na svahu Petřína, dva stromy vedle sebe. Malá sladká jablka.',
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
    description: 'Řada jabloní podél cyklostezky pod Vyšehradem. Volně k trhání.',
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
    description: 'Velký solitér ve Stromovce u planetária. Kyselejší, skvělá do koláčů.',
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
    description: 'Strom ze zahrady přesahuje přes plot; majitel rád nechá kolemjdoucí otrhat, co přečnívá. Na víc zazvoňte.',
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
    description: 'Tři mladé stromy v komunitním sadu za holešovickou tržnicí.',
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
    note: 'Spodní větve otrhané, ale výš je toho spousta.',
    createdAt: '2026-08-20T17:00:00.000Z',
  },
  {
    id: 'seed-r2',
    treeId: 'seed-1',
    userId: 'seed-community',
    state: 'unripe',
    note: 'Ještě tak dva týdny.',
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
