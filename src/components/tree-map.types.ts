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
}
