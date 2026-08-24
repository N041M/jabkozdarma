import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import type { LatLng } from './routing';

/**
 * A single position read, and only if permission was already granted. The
 * map screen is where the app asks for location; a pushed screen that merely
 * wants to sort a list by distance must never raise a permission prompt of
 * its own.
 */
export function useKnownLocation(): LatLng | null {
  const [location, setLocation] = useState<LatLng | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = pos.coords;
        if (cancelled || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        setLocation({ lat: latitude, lng: longitude });
      } catch {
        // no fix available; callers fall back to an unsorted list
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return location;
}
