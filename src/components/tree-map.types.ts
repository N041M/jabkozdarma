import type { Tree, TreeReport } from '@/lib/types';

export const PRAGUE = { lat: 50.082, lng: 14.43 };

export interface TreeMapProps {
  trees: Tree[];
  reports: TreeReport[];
  /** When true, taps on the map report a coordinate instead of doing nothing. */
  placing: boolean;
  onPressTree: (tree: Tree) => void;
  onPressMap: (lat: number, lng: number) => void;
  /** Fly the camera here when the value changes (locate-me). */
  flyTo?: { lat: number; lng: number; key: number } | null;
}
