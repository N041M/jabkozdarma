export type AccessType = 'public' | 'roadside' | 'ask_owner';

/** Fruit trees common on Czech roadsides and orchard remnants. */
export const SPECIES = ['apple', 'pear', 'plum', 'cherry', 'walnut', 'other'] as const;
export type Species = (typeof SPECIES)[number];

/**
 * A pin's standing on the map. Every new pin starts `unverified` and is only
 * promoted once other pickers confirm it from the spot — see
 * `src/lib/verification.ts`.
 */
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
  /**
   * Radius of the fix the pin was placed from, in metres. Evidence, not
   * proof — a device can claim anything — but a pin dropped from a 2 km
   * cell-tower fix is worth less than one dropped from a 6 m GPS fix.
   */
  accuracyM: number | null;
  /** Distinct pickers who have confirmed this tree, the author excluded. */
  confirmations: number;
  /**
   * Trusted without corroboration: curated seed pins, pins that predate the
   * verification rules, and anything the operator vouches for by hand. It
   * only ever grants trust — a `gone` flag still retires the tree.
   */
  trusted: boolean;
}

export interface TreeReport {
  id: string;
  treeId: string;
  userId: string;
  state: RipenessState;
  note: string | null;
  createdAt: string;
}

/**
 * One picker vouching for one tree, from within `confirmRadiusM` of it.
 * Two of these turn an `unverified` pin into a real one.
 */
export interface TreeConfirmation {
  id: string;
  treeId: string;
  userId: string;
  /** How far the confirmer stood from the pin, in metres. */
  distanceM: number;
  accuracyM: number | null;
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
