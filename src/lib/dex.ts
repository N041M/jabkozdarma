import type { Species } from './types';

/**
 * Jablkodex — the collection layer. Twenty-four varieties that actually grow
 * on Czech roadsides and in orchard remnants; a tile lights up once you have
 * added a tree of that variety or reported on one.
 *
 * Variety names are proper nouns, so they are not translated. Anything a
 * contributor types that is not on this list still earns a tile — the
 * catalogue is the floor, not the ceiling.
 */

export interface DexEntry {
  name: string;
  species: Species;
}

export const DEX_CATALOGUE: DexEntry[] = [
  { name: 'Panenské české', species: 'apple' },
  { name: 'James Grieve', species: 'apple' },
  { name: 'Šampion', species: 'apple' },
  { name: 'Jonathan', species: 'apple' },
  { name: 'Golden Delicious', species: 'apple' },
  { name: 'Matčino', species: 'apple' },
  { name: 'Strýmka', species: 'apple' },
  { name: 'Croncelské', species: 'apple' },
  { name: 'Boskoopské', species: 'apple' },
  { name: 'Idared', species: 'apple' },
  { name: 'Rubín', species: 'apple' },
  { name: 'Průsvitné letní', species: 'apple' },
  { name: 'Konference', species: 'pear' },
  { name: 'Williamsova', species: 'pear' },
  { name: 'Lucasova', species: 'pear' },
  { name: 'Boscova lahvice', species: 'pear' },
  { name: 'Domácí švestka', species: 'plum' },
  { name: 'Stanley', species: 'plum' },
  { name: 'Čačanská lepotica', species: 'plum' },
  { name: 'Mirabelka', species: 'plum' },
  { name: 'Kordia', species: 'cherry' },
  { name: 'Burlat', species: 'cherry' },
  { name: 'Napoleonova', species: 'cherry' },
  { name: 'Jupiter', species: 'walnut' },
];

/** Fruit colours from `tree-sprite.ts`, reused for the collection tiles. */
export const SPECIES_FRUIT: Record<Species, string> = {
  apple: '#E5372B',
  pear: '#D8C24A',
  plum: '#6B4BA8',
  cherry: '#C42348',
  walnut: '#8A6A38',
  other: '#E0913A',
};

function normalize(name: string): string {
  return name.trim().toLocaleLowerCase('cs');
}

/**
 * The catalogue with each entry marked found, plus a tile for every variety
 * the picker met that the catalogue never heard of.
 */
export function buildDex(discovered: string[]): (DexEntry & { found: boolean })[] {
  const seen = new Set(discovered.map(normalize));
  const tiles = DEX_CATALOGUE.map((entry) => ({ ...entry, found: seen.has(normalize(entry.name)) }));
  const known = new Set(DEX_CATALOGUE.map((e) => normalize(e.name)));
  for (const name of discovered) {
    if (!known.has(normalize(name))) tiles.push({ name: name.trim(), species: 'other', found: true });
  }
  return tiles;
}

export const DEX_TARGET = DEX_CATALOGUE.length;

/** XP awarded per contribution. Level is one per thousand. */
export const XP = { report: 15, checkIn: 25, newTree: 40, quest: 150 } as const;
export const XP_PER_LEVEL = 1000;
/** Ripeness reports needed to clear the weekly quest. */
export const QUEST_TARGET = 3;

export function levelFor(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

/** Local calendar day as `YYYY-MM-DD` — the key a streak is counted in. */
export function dayKey(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Monday-based week key, so the weekly quest resets when the design says it
 * does. Not ISO-8601 week numbering — just the date of that week's Monday,
 * which is unambiguous and needs no year-boundary special case.
 */
export function weekKey(d: Date = new Date()): string {
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  // getDay() is Sunday-first; shift so Monday is 0
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dayKey(monday);
}

function shiftDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  return dayKey(date);
}

/**
 * Days in a row ending today. A day that has not happened yet does not break
 * the run — you still have until midnight — so the count also accepts a
 * streak that ends yesterday.
 */
export function streakFrom(activeDays: string[]): number {
  const days = new Set(activeDays);
  const today = dayKey();
  let cursor = days.has(today) ? today : shiftDays(today, -1);
  if (!days.has(cursor)) return 0;
  let n = 0;
  while (days.has(cursor)) {
    n += 1;
    cursor = shiftDays(cursor, -1);
  }
  return n;
}

export interface StreakCell {
  key: string;
  label: string;
  state: 'done' | 'today' | 'future';
}

/** The seven cells under the streak row: this week, Monday to Sunday. */
export function weekCells(activeDays: string[], dayLabel: (i: number) => string): StreakCell[] {
  const days = new Set(activeDays);
  const monday = weekKey();
  const today = dayKey();
  return Array.from({ length: 7 }, (_, i) => {
    const key = shiftDays(monday, i);
    // A missed day and a day still to come read the same: an empty cell.
    // Only the run of filled ones carries meaning.
    const state: StreakCell['state'] = days.has(key) ? 'done' : key === today ? 'today' : 'future';
    return { key, label: dayLabel(i), state };
  });
}

/**
 * Every variety this picker has actually met: the ones they pinned, the ones
 * they reported on, and anything the store recorded directly.
 *
 * Derived rather than stored so the collection is already correct for people
 * who contributed before the Jablkodex existed — an empty grid under a
 * hundred pins would just read as broken.
 */
export function discoveredVarieties(opts: {
  seen: string[];
  trees: { id: string; variety: string | null; createdBy: string }[];
  reports: { treeId: string; userId: string }[];
  profileId?: string;
}): string[] {
  const names = new Map<string, string>(); // normalized -> as first written
  const add = (name: string | null | undefined) => {
    const trimmed = name?.trim();
    if (!trimmed) return;
    const key = normalize(trimmed);
    if (!names.has(key)) names.set(key, trimmed);
  };

  opts.seen.forEach(add);

  if (opts.profileId) {
    const mine = new Set(
      opts.reports.filter((r) => r.userId === opts.profileId).map((r) => r.treeId)
    );
    for (const tree of opts.trees) {
      if (tree.createdBy === opts.profileId || mine.has(tree.id)) add(tree.variety);
    }
  }

  return [...names.values()];
}
