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

export function formatRoute(distanceM: number, durationS: number): string {
  const km = distanceM / 1000;
  const dist = km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
  const mins = Math.max(1, Math.round(durationS / 60));
  const time = mins >= 90 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
  return `${dist} · ${time} walk`;
}
