import { formatKm, t } from './i18n';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResult {
  coords: LatLng[];
  distanceM: number;
  durationS: number;
}

/**
 * Walking route via the FOSSGIS OSRM instance (the router behind
 * openstreetmap.org directions). Free for fair use; if the app outgrows
 * it, self-hosted OSRM or Stadia/ORS slots in behind this same function.
 */
export async function fetchWalkingRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  const url =
    `https://routing.openstreetmap.de/routed-foot/route/v1/foot/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const json = await res.json();
  const route = json.code === 'Ok' ? json.routes?.[0] : null;
  if (!route) throw new Error('No route found');
  return {
    coords: (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ lat, lng })),
    distanceM: route.distance,
    durationS: route.duration,
  };
}

/**
 * Walking time, in hours once "1161 min" stops being a number anyone can
 * picture. Shared so a distance shown on the map reads the same as the same
 * distance shown on a list row.
 */
export function formatWalkTime(minutes: number): string {
  const mins = Math.max(1, Math.round(minutes));
  return mins >= 90
    ? t('hoursMinutes', { h: Math.floor(mins / 60), m: mins % 60 })
    : t('minutes', { m: mins });
}

export function formatRoute(distanceM: number, durationS: number): string {
  return t('routeFormat', {
    dist: formatKm(distanceM / 1000),
    time: formatWalkTime(durationS / 60),
  });
}
