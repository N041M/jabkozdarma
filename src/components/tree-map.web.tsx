import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';

import { latestReport } from '@/lib/labels';
import { GO_STYLE } from '@/lib/map-style';
import { playerSpriteSvg } from '@/lib/player-sprite';
import { treeSpriteSvg } from '@/lib/tree-sprite';
import type { Tree } from '@/lib/types';
import { PRAGUE, ROUTE_COLOR, circleCoords, type TreeMapProps } from './tree-map.types';

// Metro can't resolve MapLibre's import.meta-relative module worker, so the
// worker + shared chunk are served from public/ (kept in sync by postinstall).
// EXPO_BASE_URL carries experiments.baseUrl for subpath deploys.
maplibregl.setWorkerUrl(`${process.env.EXPO_BASE_URL ?? ''}/maplibre-gl-worker.mjs`);

export default function TreeMap({
  trees,
  reports,
  placing,
  onPressTree,
  onPressMap,
  flyTo,
  route,
  userLocation,
  placeRadiusM,
}: TreeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const playerRef = useRef<maplibregl.Marker | null>(null);
  // Bumped to rebuild the map after it dies (lost WebGL context, or a style
  // that never loaded because the page was hidden). Camera is preserved.
  const [mapEpoch, setMapEpoch] = useState(0);
  const cameraRef = useRef<{
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  } | null>(null);

  // The click handler is bound once, so live values go through refs.
  const placingRef = useRef(placing);
  placingRef.current = placing;
  const onPressMapRef = useRef(onPressMap);
  onPressMapRef.current = onPressMap;
  const onPressTreeRef = useRef(onPressTree);
  onPressTreeRef.current = onPressTree;

  useEffect(() => {
    if (!containerRef.current) return;
    const cam = cameraRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: GO_STYLE,
      center: cam?.center ?? [PRAGUE.lng, PRAGUE.lat],
      zoom: cam?.zoom ?? 11.5,
      pitch: cam?.pitch ?? 55,
      bearing: cam?.bearing ?? 0,
      maxPitch: 70,
      attributionControl: { compact: true },
    });
    map.on('moveend', () => {
      const c = map.getCenter();
      cameraRef.current = {
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      };
    });
    // Zoom buttons only for mouse users — touch devices pinch, and the
    // buttons would collide with the route banner on small screens.
    if (window.matchMedia('(pointer: fine)').matches) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    }
    map.on('error', (e) => console.error('[map error]', e.error));
    map.getCanvas().addEventListener('webglcontextlost', (ev) => {
      ev.preventDefault();
      console.warn('[map] WebGL context lost — rebuilding map');
      setTimeout(() => setMapEpoch((n) => n + 1), 250);
    });
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __map?: unknown }).__map = map;
    map.on('click', (e: maplibregl.MapMouseEvent) => {
      if (placingRef.current) onPressMapRef.current(e.lngLat.lat, e.lngLat.lng);
    });
    mapRef.current = map;
    // Some embedded webviews mount the page at 0x0 and size it later;
    // re-measure whenever the container changes so the map never sticks
    // at MapLibre's 400x300 fallback.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    // Browsers stall requestAnimationFrame while a page is hidden, and
    // MapLibre defers its style load to a frame callback — so a map created
    // while hidden (e.g. the page was backgrounded by the location
    // permission prompt) can come back with no style at all: a blank
    // background-coloured canvas that never recovers. Rebuild if that
    // happened, and re-measure in case the container was sized meanwhile.
    const recoverIfDead = () => {
      const m = mapRef.current;
      if (!m || document.visibilityState !== 'visible') return;
      m.resize();
      if (!m.isStyleLoaded()) {
        setTimeout(() => {
          const live = mapRef.current;
          if (live && document.visibilityState === 'visible' && !live.isStyleLoaded()) {
            console.warn('[map] style never loaded — rebuilding');
            setMapEpoch((n) => n + 1);
          }
        }, 2500);
      }
    };
    document.addEventListener('visibilitychange', recoverIfDead);
    const bootCheck = setTimeout(recoverIfDead, 4000);

    return () => {
      clearTimeout(bootCheck);
      document.removeEventListener('visibilitychange', recoverIfDead);
      ro.disconnect();
      markersRef.current.forEach((m) => m.remove());
      playerRef.current = null; // map.remove() drops its marker; clear the stale ref
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapEpoch]);

  // Re-render markers whenever trees or reports change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = trees.map((tree: Tree) => {
      // GO-style tree sprite standing on its coordinate; the whole 48px
      // element is the (finger-sized) hit area.
      const el = document.createElement('div');
      el.style.cssText =
        'width:48px;height:56px;display:flex;align-items:flex-end;justify-content:center;cursor:pointer';
      el.innerHTML = treeSpriteSvg(
        latestReport(tree.id, reports)?.state ?? 'none',
        tree.status === 'unverified'
      );
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!placingRef.current) onPressTreeRef.current(tree);
      });
      return new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([tree.lng, tree.lat])
        .addTo(map);
    });
  }, [trees, reports, mapEpoch]);

  useEffect(() => {
    if (flyTo) mapRef.current?.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: 14, duration: 800 });
  }, [flyTo]);

  // The player avatar — one marker, moved as the position updates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userLocation) {
      playerRef.current?.remove();
      playerRef.current = null;
      return;
    }
    if (!playerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = 'width:46px;height:62px;pointer-events:none';
      el.innerHTML = playerSpriteSvg();
      playerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    } else {
      playerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation, mapEpoch]);

  // Shaded circle showing how far from yourself you may drop a pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const show = !!(userLocation && placeRadiusM);
      const source = map.getSource('place-radius') as maplibregl.GeoJSONSource | undefined;
      if (show) {
        const data: GeoJSON.Feature = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [circleCoords(userLocation!, placeRadiusM!)],
          },
        };
        if (source) source.setData(data);
        else {
          map.addSource('place-radius', { type: 'geojson', data });
          map.addLayer({
            id: 'place-radius-fill',
            type: 'fill',
            source: 'place-radius',
            paint: { 'fill-color': '#3B6FD4', 'fill-opacity': 0.12 },
          });
          map.addLayer({
            id: 'place-radius-line',
            type: 'line',
            source: 'place-radius',
            paint: { 'line-color': '#3B6FD4', 'line-width': 2, 'line-dasharray': [2, 2] },
          });
        }
      } else {
        if (map.getLayer('place-radius-line')) map.removeLayer('place-radius-line');
        if (map.getLayer('place-radius-fill')) map.removeLayer('place-radius-fill');
        if (map.getSource('place-radius')) map.removeSource('place-radius');
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
    return () => {
      map.off('load', apply);
    };
  }, [userLocation, placeRadiusM, mapEpoch]);

  // Draw / clear the walking route as a GeoJSON line layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const source = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
      if (route && route.coords.length > 1) {
        const data: GeoJSON.Feature = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route.coords.map((c) => [c.lng, c.lat]),
          },
        };
        if (source) {
          source.setData(data);
        } else {
          map.addSource('route', { type: 'geojson', data });
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': ROUTE_COLOR, 'line-width': 4, 'line-opacity': 0.85 },
          });
        }
        const bounds = new maplibregl.LngLatBounds();
        route.coords.forEach((c) => bounds.extend([c.lng, c.lat]));
        map.fitBounds(bounds, { padding: 70, duration: 800, pitch: 45 });
      } else {
        if (map.getLayer('route-line')) map.removeLayer('route-line');
        if (map.getSource('route')) map.removeSource('route');
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
    return () => {
      map.off('load', apply);
    };
  }, [route, mapEpoch]);

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = placing ? 'crosshair' : '';
  }, [placing, mapEpoch]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
