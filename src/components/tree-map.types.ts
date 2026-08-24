import type { MapMode } from '@/lib/map-style';
import type { LatLng } from '@/lib/routing';
import type { Tree, TreeReport } from '@/lib/types';
import type { ZoomStop } from '@/lib/zoom-ladder';

export const PRAGUE = { lat: 50.082, lng: 14.43 };

export const ROUTE_COLOR = '#3B6FD4';

export interface TreeMapProps {
  trees: Tree[];
  reports: TreeReport[];
  onPressTree: (tree: Tree) => void;
  /** Fly the camera here when the value changes (locate-me). */
  flyTo?: { lat: number; lng: number; key: number } | null;
  /** Walking route to draw on the map; camera fits to it when set. */
  route?: { coords: LatLng[] } | null;
  /** The player's own position — drawn as the avatar. */
  userLocation?: LatLng | null;
  /** 'go' = tilted 3D world, 'flat' = plain top-down map. */
  mode?: MapMode;
  /** Which rung of the camera ladder the map is on. Drives zoom and pitch. */
  stop: ZoomStop;
  /** A pinch that settles nearer another stop reports it back so it snaps. */
  onStopChange?: (stop: ZoomStop) => void;
  /** Fly here and drop to the given stop — how a cluster tap works. */
  onPressCluster?: (center: LatLng) => void;
  /**
   * Ask the basemap what the neighbourhood around this point is called. The
   * district stop needs a name for its context card and the vector tiles
   * already carry one, so no geocoding service is involved.
   */
  placeQuery?: LatLng | null;
  onPlaceName?: (name: string | null) => void;
  /**
   * Where the camera is now. The context card reports on what is *in view*,
   * which is only the same as what is near the picker until they pan.
   */
  onCenterChange?: (center: LatLng) => void;
  /**
   * The camera's real tilt. The ladder sets a tilt per rung, but the map can
   * still be tilted by hand, so the scale badge reads this rather than the
   * rung's nominal value.
   */
  onPitchChange?: (pitch: number) => void;
}
