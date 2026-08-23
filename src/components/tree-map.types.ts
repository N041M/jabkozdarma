import type { LatLng } from '@/lib/routing';
import type { Tree, TreeReport } from '@/lib/types';

export const PRAGUE = { lat: 50.082, lng: 14.43 };

export const ROUTE_COLOR = '#3B6FD4';

export interface TreeMapProps {
  trees: Tree[];
  reports: TreeReport[];
  /** When true, taps on the map report a coordinate instead of doing nothing. */
  placing: boolean;
  onPressTree: (tree: Tree) => void;
  onPressMap: (lat: number, lng: number) => void;
  /** Fly the camera here when the value changes (locate-me). */
  flyTo?: { lat: number; lng: number; key: number } | null;
  /** Walking route to draw on the map; camera fits to it when set. */
  route?: { coords: LatLng[] } | null;
  /** The player's own position — drawn as the avatar. */
  userLocation?: LatLng | null;
  /** While placing, shade the radius the user is allowed to pin inside. */
  placeRadiusM?: number | null;
}

/** Ring of coordinates approximating a circle, for the placement radius. */
export function circleCoords(
  center: LatLng,
  radiusM: number,
  steps = 64
): [number, number][] {
  const latOffset = radiusM / 111_320;
  const lngOffset = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push([center.lng + lngOffset * Math.cos(angle), center.lat + latOffset * Math.sin(angle)]);
  }
  return ring;
}
