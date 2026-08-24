/**
 * Distance on the ground, with no dependencies of its own.
 *
 * It lives apart from `labels.ts` because the verification rules need it and
 * `labels.ts` needs the verification thresholds to write its messages —
 * leaving the two importing each other, which Metro warns about and which
 * can hand a module an uninitialised value.
 */

/** Rough metres between two coordinates, good enough for what the map asks. */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * 111_320;
  const dLng = (bLng - aLng) * 111_320 * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
