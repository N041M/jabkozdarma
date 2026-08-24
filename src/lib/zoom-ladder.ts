/**
 * The camera ladder: four stops where zoom stops being a scale slider and
 * becomes a change of what the map *is*.
 *
 *   50 m   you are a body standing next to a tree
 *   250 m  trees are browsable sprites with walking times
 *   2 km   sprites fold into counted clusters
 *   20 km  no trees at all — density per km² and a season read
 *
 * Stops snap: a pinch, a wheel step or a tap on the scale badge lands on the
 * nearest stop and the camera eases there. Interpolating every frame is
 * smoother but costs a phone GPU and makes the mode change hard to read.
 */

export type ZoomStop = 0 | 1 | 2 | 3;

export const ZOOM_STOPS: ZoomStop[] = [0, 1, 2, 3];

export interface StopSpec {
  /** How much world the screen shows, edge to edge. */
  visibleWidthM: number;
  pitch: number;
  /** Tree sprite height in px; null once trees stop being drawn individually. */
  spriteH: number | null;
  /** Player avatar height in px; null once the avatar is gone. */
  avatarH: number | null;
  /** Grid used to fold trees into clusters, in metres. null = no clustering. */
  clusterM: number | null;
  /** Side of a density cell in metres. null = no density layer. */
  densityM: number | null;
}

export const STOPS: Record<ZoomStop, StopSpec> = {
  0: { visibleWidthM: 50, pitch: 58, spriteH: 130, avatarH: 76, clusterM: null, densityM: null },
  1: { visibleWidthM: 250, pitch: 25, spriteH: 38, avatarH: 38, clusterM: null, densityM: null },
  2: { visibleWidthM: 2_000, pitch: 0, spriteH: null, avatarH: 14, clusterM: 400, densityM: null },
  3: { visibleWidthM: 20_000, pitch: 0, spriteH: null, avatarH: null, clusterM: null, densityM: 2_000 },
};

/** Metres per pixel at the equator, zoom 0 — the Web Mercator constant. */
const EQUATOR_MPP = 156_543.033_92;

/**
 * MapLibre zoom that fits `visibleWidthM` across a viewport `widthPx` wide.
 * Computed rather than hard-coded so the ladder means the same thing on a
 * phone and on a desktop window.
 */
export function zoomForStop(stop: ZoomStop, widthPx: number, lat: number): number {
  const width = Math.max(widthPx, 1);
  const mppNeeded = STOPS[stop].visibleWidthM / width;
  const mppAtZ0 = EQUATOR_MPP * Math.cos((lat * Math.PI) / 180);
  return Math.log2(mppAtZ0 / mppNeeded);
}

/** The stop whose visible width is closest to what the camera is showing. */
export function stopForZoom(zoom: number, widthPx: number, lat: number): ZoomStop {
  let best: ZoomStop = 0;
  let bestGap = Infinity;
  for (const stop of ZOOM_STOPS) {
    const gap = Math.abs(zoomForStop(stop, widthPx, lat) - zoom);
    if (gap < bestGap) {
      bestGap = gap;
      best = stop;
    }
  }
  return best;
}

export function clampStop(n: number): ZoomStop {
  return Math.min(3, Math.max(0, Math.round(n))) as ZoomStop;
}

/** `50 m · 58°` — the monospace badge in the top-left corner. */
export function scaleLabel(stop: ZoomStop): string {
  const { visibleWidthM, pitch } = STOPS[stop];
  const dist = visibleWidthM >= 1000 ? `${visibleWidthM / 1000} km` : `${visibleWidthM} m`;
  return `${dist} · ${pitch}°`;
}

/** You have to be this close for the rail to offer "Trhám" instead of "Přidat". */
export const PICK_RADIUS_M = 30;
