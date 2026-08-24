import { latestReport } from './labels';
import type { Tree, TreeReport } from './types';

/**
 * Folding trees into counts. Above the street stop a sprite per tree stops
 * meaning anything — at 2 km you want to know *where the fruit is*, and at
 * 20 km only how thick it is on the ground.
 *
 * Both grids are square in metres rather than in degrees, so a cell in
 * Prague is the same size as a cell anywhere else.
 */

const M_PER_DEG_LAT = 111_320;

function mPerDegLng(lat: number): number {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export interface Cluster {
  key: string;
  lat: number;
  lng: number;
  count: number;
  /** Drives the bubble colour — red the moment anything in it is ripe. */
  hasRipe: boolean;
}

export function clusterTrees(trees: Tree[], reports: TreeReport[], cellM: number): Cluster[] {
  const buckets = new Map<string, { lat: number; lng: number; count: number; ripe: boolean }>();

  for (const tree of trees) {
    const latStep = cellM / M_PER_DEG_LAT;
    const lngStep = cellM / mPerDegLng(tree.lat);
    const key = `${Math.floor(tree.lat / latStep)}:${Math.floor(tree.lng / lngStep)}`;
    const ripe = latestReport(tree.id, reports)?.state === 'ripe';
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.lat += tree.lat;
      bucket.lng += tree.lng;
      bucket.count += 1;
      bucket.ripe = bucket.ripe || ripe;
    } else {
      buckets.set(key, { lat: tree.lat, lng: tree.lng, count: 1, ripe });
    }
  }

  // The bubble sits on the group's centre of mass, not the cell's corner.
  return [...buckets].map(([key, b]) => ({
    key,
    lat: b.lat / b.count,
    lng: b.lng / b.count,
    count: b.count,
    hasRipe: b.ripe,
  }));
}

export interface DensityCell {
  key: string;
  count: number;
  /** Closed ring, ready for a GeoJSON polygon. */
  ring: [number, number][];
}

export function densityCells(trees: Tree[], cellM: number): DensityCell[] {
  const buckets = new Map<string, { count: number; lat: number; lng: number }>();

  for (const tree of trees) {
    const latStep = cellM / M_PER_DEG_LAT;
    const lngStep = cellM / mPerDegLng(tree.lat);
    const row = Math.floor(tree.lat / latStep);
    const col = Math.floor(tree.lng / lngStep);
    const key = `${row}:${col}`;
    const existing = buckets.get(key);
    if (existing) existing.count += 1;
    else buckets.set(key, { count: 1, lat: row * latStep, lng: col * lngStep });
  }

  return [...buckets].map(([key, b]) => {
    const latStep = cellM / M_PER_DEG_LAT;
    const lngStep = cellM / mPerDegLng(b.lat || 50);
    return {
      key,
      count: b.count,
      ring: [
        [b.lng, b.lat],
        [b.lng + lngStep, b.lat],
        [b.lng + lngStep, b.lat + latStep],
        [b.lng, b.lat + latStep],
        [b.lng, b.lat],
      ] as [number, number][],
    };
  });
}

/** How dark a density cell reads. Saturates so a hotspot never goes opaque. */
export function densityAlpha(count: number): number {
  return Math.min(0.9, 0.18 + count * 0.16);
}

/** Rough walking minutes at a comfortable 80 m per minute. */
export function walkMinutes(distanceM: number): number {
  return Math.max(1, Math.round(distanceM / 80));
}
