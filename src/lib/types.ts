export type AccessType = 'public' | 'roadside' | 'ask_owner';

/** Fruit trees common on Czech roadsides and orchard remnants. */
export const SPECIES = ['apple', 'pear', 'plum', 'cherry', 'walnut', 'other'] as const;
export type Species = (typeof SPECIES)[number];

export type TreeStatus = 'active' | 'gone' | 'unverified';

export type RipenessState = 'flowering' | 'unripe' | 'ripe' | 'past' | 'bare';

export type FlagReason = 'gone' | 'duplicate' | 'private' | 'wrong_info';

export interface Tree {
  id: string;
  lat: number;
  lng: number;
  species: Species;
  variety: string | null;
  description: string | null;
  access: AccessType;
  status: TreeStatus;
  seasonStart: number | null; // month 1-12
  seasonEnd: number | null;
  photoUri: string | null;
  createdBy: string; // profile id
  createdAt: string; // ISO
}

export interface TreeReport {
  id: string;
  treeId: string;
  userId: string;
  state: RipenessState;
  note: string | null;
  createdAt: string;
}

export interface TreeFlag {
  id: string;
  treeId: string;
  userId: string;
  reason: FlagReason;
  createdAt: string;
}

export interface Profile {
  id: string;
  username: string;
  bio: string | null;
  createdAt: string;
}
