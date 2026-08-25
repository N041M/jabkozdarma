import { distanceMeters } from './geo';
import type { Tree, TreeConfirmation, TreeFlag } from './types';

/**
 * What makes a pin trustworthy.
 *
 * A map anyone can write to is a map anyone can lie to, and the lie that
 * matters here is a tree that isn't there: someone pins fifty apples across
 * a district they have never walked, and every route the app draws after
 * that is a wasted trip.
 *
 * Two mechanisms answer it, and neither works alone:
 *
 *  - **Limits** cap what one account can write at all — a handful of pins a
 *    day, none of them on top of each other, none outside the service area,
 *    and none dropped further away than its author could have walked to see.
 *    This is what stops a script, and it is enforced in Postgres
 *    (`supabase/migration-003-verification.sql`), because anything the
 *    client checks is advice the client can skip.
 *  - **Corroboration** decides what the map shows. A new pin is
 *    `unverified` — drawn faded, kept out of Sklizeň — until other pickers
 *    stand next to it and confirm it. A tree that isn't there collects no
 *    confirmations, so it never graduates, and nobody walks to it.
 *
 * The rules live here, in one place, because two callers enforce them: the
 * store, so local mode behaves like the real thing, and the SQL, which is
 * the copy that counts. Change a number here and change it there too — the
 * migration names this file for that reason.
 *
 * What this deliberately does not claim: none of it proves presence. A
 * browser's Geolocation API is two clicks from a lie in any devtools, so a
 * determined person can place a pin, then confirm it from a second account.
 * Corroboration raises the cost from "one script" to "several accounts, one
 * per confirmation, each maintained over time" — which is where contributor
 * trust scoring picks up, once these tables have enough history to score.
 */

export const VERIFY = {
  /** Distinct pickers, the author excluded, who make a pin real. */
  confirmationsNeeded: 2,
  /**
   * How close you stand to confirm. Wide enough for the drift you get under
   * a canopy between buildings, tight enough that you must actually be at
   * the tree rather than on the next street.
   */
  confirmRadiusM: 60,
  /**
   * A fix vaguer than this says nothing about where its owner was standing.
   * Roughly where a phone stops using GNSS and starts guessing from cell
   * towers.
   *
   * It refuses a *confirmation* outright, because there the fix is the whole
   * evidence. It does not refuse a *pin*: a pin is aimed by hand against the
   * map, so a vague fix costs it its presence evidence and nothing else.
   */
  maxAccuracyM: 100,
  /**
   * How far from your own fix you may drop a pin.
   *
   * The pin is aimed by hand, so this is not the precision of the placement —
   * it is the leash that keeps a pin attached to a walk. Wide enough to reach
   * a tree across the park you are standing in, short enough that pinning a
   * district from the sofa is refused at the door.
   *
   * Unlike `confirmRadiusM`, no amount of server-side arithmetic makes this
   * one stronger: `confirm_tree()` measures a claimed position against a
   * location the caller does not control, whereas somebody placing a pin
   * chooses *both* points. So this catches a mis-aimed pin from an honest
   * client, and corroboration is what answers a dishonest one.
   */
  maxPlacementM: 150,
  /** Pins one account may add in a day. A good day's walk yields a few. */
  dailyPinLimit: 12,
  /** Confirmations one account may give in a day. */
  dailyConfirmLimit: 30,
  /** Two pins this close together, by the same person, are one tree twice. */
  minSelfDistanceM: 15,
  /** Distinct "it's gone" flags that retire a pin, unless its author says so. */
  goneFlagsNeeded: 2,
  /**
   * The service area, as a bounding box: the Czech Republic, generously.
   * Deliberately not Prague-only — the map should be able to grow to Brno
   * without a migration — but tight enough that a pin in the Pacific is
   * refused at the door.
   */
  area: { minLat: 48.5, maxLat: 51.1, minLng: 12.0, maxLng: 18.9 },
} as const;

/** Why a pin was refused. The UI maps these to strings; the SQL raises them. */
export type PinRejection =
  | 'no_profile'
  | 'bad_coords'
  /**
   * No longer raised here: a hand-aimed pin does not get worse because the
   * phone's own fix is vague. It stays in the union because the check lived
   * in `check_new_tree()` until migration 004, and a backend the operator
   * hasn't migrated yet still raises it — better a sentence that explains it
   * than a silent failure.
   */
  | 'bad_fix'
  | 'out_of_area'
  | 'placed_too_far'
  | 'too_close'
  | 'daily_limit';

/** Why a confirmation was refused. */
export type ConfirmRejection =
  | 'no_profile'
  | 'no_such_tree'
  | 'own_tree'
  | 'already_confirmed'
  | 'no_fix'
  | 'bad_fix'
  | 'too_far'
  | 'daily_limit'
  /** The write never reached the database. Not a verdict — worth retrying. */
  | 'sync_failed';

export function isInServiceArea(lat: number, lng: number): boolean {
  const a = VERIFY.area;
  return lat >= a.minLat && lat <= a.maxLat && lng >= a.minLng && lng <= a.maxLng;
}

/**
 * The date in Prague, as YYYY-MM-DD. The daily limits are enforced by SQL
 * that rolls over at `Europe/Prague` midnight, so counting in the device's
 * own timezone would let a picker abroad — or anyone near midnight — believe
 * a write is legal that the database then refuses.
 */
function pragueDayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(d);
}

function sameDayCount(timestamps: string[], now: Date): number {
  const today = pragueDayKey(now);
  return timestamps.filter((iso) => pragueDayKey(new Date(iso)) === today).length;
}

/**
 * The presence evidence a placement carries: how far the picker stood from
 * the pin they aimed.
 *
 * Null when there is nothing honest to record — no fix at all, or a fix too
 * vague to place its owner anywhere in particular. A pin with a null distance
 * is still a pin; it simply arrives with no claim that anybody was there, and
 * has to earn the map's trust from the confirmations alone, like every other.
 *
 * The distance and not the position, because the distance is the only part of
 * where the author was standing that the map has any use for. Keeping the
 * point itself would mean storing a picker's movements to answer a question
 * that a single number already answers.
 */
export function placementDistance(
  pin: { lat: number; lng: number },
  here: { lat: number; lng: number } | null,
  accuracyM: number | null
): number | null {
  if (!here) return null;
  if (accuracyM !== null && accuracyM > VERIFY.maxAccuracyM) return null;
  return distanceMeters(here.lat, here.lng, pin.lat, pin.lng);
}

/**
 * Whether a new pin may be written, and if not, why. Mirrors the checks the
 * `trees` insert trigger makes; both must agree or local mode lies about
 * what the backend will accept.
 */
export function checkNewPin(input: {
  lat: number;
  lng: number;
  accuracyM: number | null;
  /**
   * How far the picker stood from the pin they aimed, or null when there is
   * nothing worth recording. Null is not a refusal — see `placementDistance`.
   */
  placedDistanceM: number | null;
  profileId: string | null;
  /** Every pin this profile has already placed. */
  ownTrees: Tree[];
  now?: Date;
}): PinRejection | null {
  const now = input.now ?? new Date();
  if (!input.profileId) return 'no_profile';
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) return 'bad_coords';
  if (!isInServiceArea(input.lat, input.lng)) return 'out_of_area';
  if (input.placedDistanceM !== null && input.placedDistanceM > VERIFY.maxPlacementM) {
    return 'placed_too_far';
  }

  const mine = input.ownTrees.filter((t) => t.createdBy === input.profileId);
  if (sameDayCount(mine.map((t) => t.createdAt), now) >= VERIFY.dailyPinLimit) {
    return 'daily_limit';
  }
  const stacked = mine.some(
    (t) =>
      t.status !== 'gone' &&
      distanceMeters(input.lat, input.lng, t.lat, t.lng) < VERIFY.minSelfDistanceM
  );
  return stacked ? 'too_close' : null;
}

/**
 * Distinct pickers who have confirmed this tree, never counting its author.
 *
 * Takes the higher of what the rows say and what the tree itself carries.
 * `tree.confirmations` is the database's own count, and the rows can be
 * incomplete — `fetchSnapshot` deliberately tolerates the confirmations query
 * failing — so trusting the rows alone would silently demote a well-confirmed
 * pin the moment anything recomputed its status.
 */
export function confirmationCount(tree: Tree, confirmations: TreeConfirmation[]): number {
  const voters = new Set(
    confirmations
      .filter((c) => c.treeId === tree.id && c.userId !== tree.createdBy)
      .map((c) => c.userId)
  );
  return Math.max(voters.size, tree.confirmations);
}

/**
 * Whether this picker may confirm this tree from where they are standing.
 * `here` being null means the app has no fix at all, which is its own
 * refusal — confirming from an unknown place would be worth nothing.
 */
export function checkConfirmation(input: {
  tree: Tree;
  profileId: string | null;
  here: { lat: number; lng: number } | null;
  accuracyM: number | null;
  confirmations: TreeConfirmation[];
  now?: Date;
}): ConfirmRejection | null {
  const now = input.now ?? new Date();
  if (!input.profileId) return 'no_profile';
  if (input.tree.createdBy === input.profileId) return 'own_tree';
  if (input.confirmations.some((c) => c.treeId === input.tree.id && c.userId === input.profileId)) {
    return 'already_confirmed';
  }
  if (!input.here) return 'no_fix';
  if (input.accuracyM !== null && input.accuracyM > VERIFY.maxAccuracyM) return 'bad_fix';

  const mine = input.confirmations.filter((c) => c.userId === input.profileId);
  if (sameDayCount(mine.map((c) => c.createdAt), now) >= VERIFY.dailyConfirmLimit) {
    return 'daily_limit';
  }
  const distance = distanceMeters(
    input.here.lat,
    input.here.lng,
    input.tree.lat,
    input.tree.lng
  );
  return distance > VERIFY.confirmRadiusM ? 'too_far' : null;
}

/**
 * The status a tree has earned from the evidence against it. Pure, so the
 * store can recompute it after any write and the SQL trigger can arrive at
 * the same answer.
 *
 * `gone` wins over everything: a tree somebody has cut down is not a tree,
 * however well confirmed it once was. Its author saying so is enough on its
 * own — they placed it, they can retire it — and otherwise it takes as many
 * pickers as a promotion does.
 */
export function statusFor(
  tree: Tree,
  confirmations: TreeConfirmation[],
  flags: TreeFlag[]
): Tree['status'] {
  // A retirement the database already decided stands. The `flags` policy only
  // lets a client read its own rows, so local state can never assemble the
  // second voter this threshold needs — re-deriving `gone` from it would
  // resurrect a tree the server retired. The author retiring their own pin is
  // the one case a client can settle on its own.
  if (tree.status === 'gone') return 'gone';

  const gone = flags.filter((f) => f.treeId === tree.id && f.reason === 'gone');
  const byAuthor = gone.some((f) => f.userId === tree.createdBy);
  const voters = new Set(gone.map((f) => f.userId));
  if (byAuthor || voters.size >= VERIFY.goneFlagsNeeded) return 'gone';

  // `trusted` is the operator's override and the grandfather clause for
  // pins that predate these rules. Without it, recomputing the status of a
  // long-standing pin would demote it for never having been voted on.
  const enough = confirmationCount(tree, confirmations) >= VERIFY.confirmationsNeeded;
  return tree.trusted || enough ? 'active' : 'unverified';
}

/** How many more pickers this tree needs before the map trusts it. */
export function confirmationsRemaining(tree: Tree): number {
  return Math.max(0, VERIFY.confirmationsNeeded - tree.confirmations);
}
