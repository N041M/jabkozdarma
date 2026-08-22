import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';

import { pinColor } from '@/lib/labels';
import type { Tree } from '@/lib/types';
import { PRAGUE, ROUTE_COLOR, type TreeMapProps } from './tree-map.types';

// Metro can't resolve MapLibre's import.meta-relative module worker, so the
// worker + shared chunk are served from public/ (kept in sync by postinstall).
// EXPO_BASE_URL carries experiments.baseUrl for subpath deploys.
maplibregl.setWorkerUrl(`${process.env.EXPO_BASE_URL ?? ''}/maplibre-gl-worker.mjs`);

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export default function TreeMap({
  trees,
  reports,
  placing,
  onPressTree,
  onPressMap,
  flyTo,
  route,
}: TreeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // The click handler is bound once, so live values go through refs.
  const placingRef = useRef(placing);
  placingRef.current = placing;
  const onPressMapRef = useRef(onPressMap);
  onPressMapRef.current = onPressMap;
  const onPressTreeRef = useRef(onPressTree);
  onPressTreeRef.current = onPressTree;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [PRAGUE.lng, PRAGUE.lat],
      zoom: 11.5,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', (e) => console.error('[map error]', e.error));
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
    return () => {
      ro.disconnect();
      markersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-render markers whenever trees or reports change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = trees.map((tree: Tree) => {
      const el = document.createElement('div');
      el.style.cssText = [
        'width:18px',
        'height:18px',
        'border-radius:50%',
        'border:2.5px solid #fff',
        'box-shadow:0 1px 3px rgba(0,0,0,.35)',
        'cursor:pointer',
        `background:${pinColor(tree, reports)}`,
        tree.status === 'unverified' ? 'opacity:.55' : '',
      ].join(';');
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!placingRef.current) onPressTreeRef.current(tree);
      });
      return new maplibregl.Marker({ element: el })
        .setLngLat([tree.lng, tree.lat])
        .addTo(map);
    });
  }, [trees, reports]);

  useEffect(() => {
    if (flyTo) mapRef.current?.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: 14, duration: 800 });
  }, [flyTo]);

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
        map.fitBounds(bounds, { padding: 70, duration: 800 });
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
  }, [route]);

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = placing ? 'crosshair' : '';
  }, [placing]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
