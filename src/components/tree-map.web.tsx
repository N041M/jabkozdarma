import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';

import { ripenessColors } from '@/constants/theme';
import { clusterTrees, densityAlpha, densityCells, walkMinutes } from '@/lib/clustering';
import { distanceMeters, latestReport } from '@/lib/labels';
import { MODE_PITCH, styleFor } from '@/lib/map-style';
import { playerSpriteSvg } from '@/lib/player-sprite';
import { treeSpriteSvg } from '@/lib/tree-sprite';
import type { Tree } from '@/lib/types';
import { STOPS, stopForZoom, zoomForStop, type ZoomStop } from '@/lib/zoom-ladder';
import { PRAGUE, ROUTE_COLOR, type TreeMapProps } from './tree-map.types';

// Metro can't resolve MapLibre's import.meta-relative module worker, so the
// worker + shared chunk are served from public/ (kept in sync by postinstall).
// EXPO_BASE_URL carries experiments.baseUrl for subpath deploys.
maplibregl.setWorkerUrl(`${process.env.EXPO_BASE_URL ?? ''}/maplibre-gl-worker.mjs`);

/** Natural size of the tree sprite SVG, used to scale it by the zoom stop. */
const SPRITE_W = 44;
const SPRITE_H = 54;
/** Natural size of the player avatar SVG. */
const AVATAR_W = 46;
const AVATAR_H = 62;

const USER_BLUE = '#3B6FD4';

export default function TreeMap({
  trees,
  reports,
  onPressTree,
  flyTo,
  route,
  userLocation,
  mode = 'go',
  stop,
  onStopChange,
  onPressCluster,
  placeQuery,
  onPlaceName,
  onCenterChange,
}: TreeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Markers are recycled by tree id — rebuilding every DOM node on each
  // store update was making pan/zoom stutter once the map filled up.
  const markerStoreRef = useRef(
    new Map<
      string,
      { marker: maplibregl.Marker; el: HTMLDivElement; key: string; tree: Tree }
    >()
  );
  const clusterStoreRef = useRef(new Map<string, maplibregl.Marker>());
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

  // The handlers are bound once, so live values go through refs.
  const onPressTreeRef = useRef(onPressTree);
  onPressTreeRef.current = onPressTree;
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const onStopChangeRef = useRef(onStopChange);
  onStopChangeRef.current = onStopChange;
  const onPressClusterRef = useRef(onPressCluster);
  onPressClusterRef.current = onPressCluster;
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;
  // Set while the camera is moving because *we* moved it, so the snap
  // handler does not fight its own animation.
  const drivingRef = useRef(false);
  const driveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driveTokenRef = useRef(0);

  /**
   * Run a camera move that the snap handler must ignore. `moveend` is the
   * normal release, but a move that turns out to be a no-op may never fire
   * one — so a timer always releases the flag too. Leaving it stuck would
   * silently kill pinch-to-snap for the rest of the session.
   *
   * Each call takes a token. A `moveend` left over from a superseded move
   * would otherwise clear the flag while the newer one is still flying, and
   * the next `zoomend` would snap the camera back to the rung it just left.
   */
  function drive(map: maplibregl.Map, duration: number, move: () => void) {
    const token = ++driveTokenRef.current;
    drivingRef.current = true;
    if (driveTimerRef.current) clearTimeout(driveTimerRef.current);
    const release = () => {
      if (driveTokenRef.current !== token) return; // a later move owns the camera
      drivingRef.current = false;
      if (driveTimerRef.current) {
        clearTimeout(driveTimerRef.current);
        driveTimerRef.current = null;
      }
    };
    driveTimerRef.current = setTimeout(release, duration + 400);
    map.once('moveend', release);
    move();
  }

  useEffect(() => {
    if (!containerRef.current) return;
    const cam = cameraRef.current;
    const width = containerRef.current.clientWidth || 390;
    const center = cam?.center ?? [PRAGUE.lng, PRAGUE.lat];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleFor(mode),
      center,
      zoom: cam?.zoom ?? zoomForStop(stopRef.current, width, center[1]),
      // Tilt is the zoom stop's, not the mode's — the ladder owns the camera
      // once the map is up. `flat` still pins it to zero.
      pitch: mode === 'flat' ? 0 : STOPS[stopRef.current].pitch,
      bearing: cam?.bearing ?? 0,
      maxPitch: mode === 'flat' ? 0 : 70,
      attributionControl: { compact: true },
      // Perf: no cross-fade (it reads as "buffering"), keep a generous tile
      // cache so panning back is instant, and don't re-request tiles we have.
      fadeDuration: 0,
      maxTileCacheSize: 300,
      refreshExpiredTiles: false,
    });
    map.on('moveend', () => {
      const c = map.getCenter();
      cameraRef.current = {
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      };
      onCenterChangeRef.current?.({ lat: c.lat, lng: c.lng });
    });

    // Snapping. A pinch runs free while the fingers are down; when it
    // settles, whichever stop it landed nearest becomes the stop, and the
    // camera effect eases the rest of the way. Snapping mid-gesture would
    // fight the finger; letting it land anywhere would lose the ladder.
    map.on('zoomend', () => {
      if (drivingRef.current) return;
      const next = stopForZoom(map.getZoom(), map.getContainer().clientWidth, map.getCenter().lat);
      if (next !== stopRef.current) onStopChangeRef.current?.(next);
      else applyCamera(map, stopRef.current, mode, true);
    });

    // No NavigationControl: the app's own stepper is the zoom control now,
    // and MapLibre's would both duplicate it and sit on top of the streak
    // pill. Free zoom would also skip the ladder's stops.

    // Tearing the map down cancels tiles that are still in flight, and each
    // one reports a "no tile manager" error on the way out. That is expected
    // and says nothing about a live map, so it does not reach the console.
    let destroyed = false;
    map.on('error', (e) => {
      if (!destroyed) console.error('[map error]', e.error);
    });
    map.getCanvas().addEventListener('webglcontextlost', (ev) => {
      ev.preventDefault();
      console.warn('[map] WebGL context lost — rebuilding map');
      setTimeout(() => setMapEpoch((n) => n + 1), 250);
    });
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __map?: unknown }).__map = map;
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

    // Captured now so cleanup empties the stores this map filled, not
    // whichever ones a later map has since swapped in.
    const markerStore = markerStoreRef.current;
    const clusterStore = clusterStoreRef.current;

    return () => {
      destroyed = true;
      clearTimeout(bootCheck);
      if (driveTimerRef.current) clearTimeout(driveTimerRef.current);
      document.removeEventListener('visibilitychange', recoverIfDead);
      ro.disconnect();
      markerStore.clear(); // map.remove() drops the markers themselves
      clusterStore.clear();
      playerRef.current = null; // clear the stale ref too
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapEpoch, mode]);

  /** Ease the camera onto a rung. `settle` skips the animation for a nudge. */
  function applyCamera(map: maplibregl.Map, next: ZoomStop, mapMode: string, settle = false) {
    const width = map.getContainer().clientWidth || 390;
    const zoom = zoomForStop(next, width, map.getCenter().lat);
    const pitch = mapMode === 'flat' ? 0 : STOPS[next].pitch;
    if (settle && Math.abs(map.getZoom() - zoom) < 0.02 && Math.abs(map.getPitch() - pitch) < 0.5) {
      return;
    }
    const duration = settle ? 220 : 600;
    drive(map, duration, () => map.easeTo({ zoom, pitch, duration }));
  }

  // Drive the camera whenever the ladder moves.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyCamera(map, stop, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop, mapEpoch, mode]);

  // Individual tree sprites — the 50 m and 250 m stops only. Above those a
  // sprite per tree stops carrying information and starts costing frames.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const store = markerStoreRef.current;
    const spriteH = STOPS[stop].spriteH;

    if (spriteH === null) {
      for (const [, entry] of store) entry.marker.remove();
      store.clear();
      return;
    }

    const scale = spriteH / SPRITE_H;
    const width = SPRITE_W * scale;
    const showRing = stop === 1;

    // Walking-time pills go on the two trees nearest the picker, which is
    // the question the street stop is actually answering.
    const timed = new Set<string>();
    if (userLocation && stop === 1) {
      [...trees]
        .map((tree) => ({
          id: tree.id,
          d: distanceMeters(userLocation.lat, userLocation.lng, tree.lat, tree.lng),
        }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2)
        .forEach((entry) => timed.add(entry.id));
    }

    const live = new Set<string>();

    for (const tree of trees) {
      live.add(tree.id);
      const state = latestReport(tree.id, reports)?.state ?? 'none';
      const minutes = timed.has(tree.id)
        ? walkMinutes(distanceMeters(userLocation!.lat, userLocation!.lng, tree.lat, tree.lng))
        : null;
      // everything the sprite's appearance depends on
      const key = `${tree.species}|${state}|${tree.status}|${spriteH}|${showRing}|${minutes ?? ''}`;
      const html = spriteHtml(tree, state, scale, showRing, minutes);

      const existing = store.get(tree.id);
      if (existing) {
        existing.tree = tree;
        if (existing.key !== key) {
          existing.el.style.width = `${width}px`;
          existing.el.style.height = `${spriteH}px`;
          existing.el.innerHTML = html;
          existing.key = key;
        }
        existing.marker.setLngLat([tree.lng, tree.lat]);
        continue;
      }

      // GO-style sprite standing on its coordinate; the whole element is the
      // hit area, floored at a finger's width even when the sprite is small.
      const el = document.createElement('div');
      el.style.cssText = `width:${width}px;height:${spriteH}px;position:relative;cursor:pointer;touch-action:manipulation`;
      el.innerHTML = html;
      const entry = {
        el,
        key,
        tree,
        marker: new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([tree.lng, tree.lat])
          .addTo(map),
      };
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onPressTreeRef.current(entry.tree);
      });
      store.set(tree.id, entry);
    }

    for (const [id, entry] of store) {
      if (!live.has(id)) {
        entry.marker.remove();
        store.delete(id);
      }
    }
  }, [trees, reports, mapEpoch, mode, stop, userLocation]);

  // Counted cluster bubbles — the 2 km stop.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const store = clusterStoreRef.current;
    const cellM = STOPS[stop].clusterM;

    for (const [, marker] of store) marker.remove();
    store.clear();
    if (cellM === null) return;

    const clusters = clusterTrees(trees, reports, cellM);
    // Only the biggest group that actually holds ripe fruit earns the caption.
    const captioned = clusters
      .filter((c) => c.hasRipe)
      .sort((a, b) => b.count - a.count)[0]?.key;

    for (const cluster of clusters) {
      const size = Math.min(64, 30 + cluster.count * 7);
      // A two-line bubble needs the room for it; on a small one the caption
      // spills past the circle and collides with the count.
      const roomForCaption = size >= 52;
      const el = document.createElement('div');
      el.style.cssText = 'cursor:pointer;touch-action:manipulation';
      el.innerHTML = clusterHtml(
        cluster.count,
        cluster.hasRipe,
        size,
        roomForCaption && cluster.key === captioned
      );
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onPressClusterRef.current?.({ lat: cluster.lat, lng: cluster.lng });
      });
      store.set(
        cluster.key,
        new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([cluster.lng, cluster.lat])
          .addTo(map)
      );
    }
  }, [trees, reports, mapEpoch, mode, stop]);

  // The density fill — the 20 km stop. No trees, no clusters, no avatar:
  // just how thick the fruit is on the ground.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const cellM = STOPS[stop].densityM;

    const apply = () => {
      const clear = () => {
        if (map.getLayer('density-fill')) map.removeLayer('density-fill');
        if (map.getSource('density')) map.removeSource('density');
      };
      if (cellM === null) {
        clear();
        return;
      }
      const data: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: densityCells(trees, cellM).map((cell) => ({
          type: 'Feature',
          properties: { alpha: densityAlpha(cell.count) },
          geometry: { type: 'Polygon', coordinates: [cell.ring] },
        })),
      };
      const source = map.getSource('density') as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        return;
      }
      map.addSource('density', { type: 'geojson', data });
      map.addLayer({
        id: 'density-fill',
        type: 'fill',
        source: 'density',
        paint: { 'fill-color': '#38754A', 'fill-opacity': ['get', 'alpha'] },
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
    return () => {
      map.off('load', apply);
    };
  }, [trees, mapEpoch, mode, stop]);

  useEffect(() => {
    if (flyTo) {
      const map = mapRef.current;
      if (!map) return;
      drive(map, 800, () =>
        map.flyTo({
          center: [flyTo.lng, flyTo.lat],
          zoom: zoomForStop(stopRef.current, map.getContainer().clientWidth || 390, flyTo.lat),
          duration: 800,
        })
      );
    }
  }, [flyTo]);

  // The player avatar — one marker, moved as the position updates. It shrinks
  // up the ladder (76 → 38 → a 14 px dot) and is gone at region scale, where
  // the map screen draws a crosshair instead.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const avatarH = STOPS[stop].avatarH;
    if (!userLocation || avatarH === null) {
      playerRef.current?.remove();
      playerRef.current = null;
      return;
    }
    const el = playerRef.current?.getElement() ?? document.createElement('div');
    if (stop >= 2) {
      // Too small for a body: a dot with an accuracy halo.
      el.style.cssText = 'width:30px;height:30px;pointer-events:none';
      el.innerHTML = dotHtml();
    } else {
      const scale = avatarH / AVATAR_H;
      el.style.cssText = `width:${AVATAR_W * scale}px;height:${avatarH}px;pointer-events:none`;
      el.innerHTML = `<div style="transform:scale(${scale});transform-origin:top left">${playerSpriteSvg()}</div>`;
    }
    if (!playerRef.current) {
      playerRef.current = new maplibregl.Marker({
        element: el,
        anchor: stop >= 2 ? 'center' : 'bottom',
      })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    } else {
      playerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation, mapEpoch, mode, stop]);

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
        // The route owns the camera while it fits, so the snap handler has
        // to stay out of the way until the flight lands.
        const bounds = new maplibregl.LngLatBounds();
        route.coords.forEach((c) => bounds.extend([c.lng, c.lat]));
        drive(map, 800, () =>
          map.fitBounds(bounds, { padding: 70, duration: 800, pitch: MODE_PITCH.go })
        );
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
  }, [route, mapEpoch, mode]);

  // Name the neighbourhood under a point, straight out of the vector tiles'
  // `place` layer — the same labels the map is already drawing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !placeQuery || !onPlaceName) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const point = map.project([placeQuery.lng, placeQuery.lat]);
      // Search the whole viewport rather than a box around the point. At
      // district scale the screen is about 2 km across, so any neighbourhood
      // label on it is a fair answer for "where is this group?" — and place
      // labels are sparse enough that a tight box usually finds nothing.
      let features: maplibregl.MapGeoJSONFeature[] = [];
      try {
        features = map.queryRenderedFeatures({ layers: ['place-labels'] });
      } catch {
        // the layer is missing while a style swaps; no name is a fine answer
      }
      let best: { name: string; d: number } | null = null;
      for (const feature of features) {
        const name = feature.properties?.name;
        if (typeof name !== 'string' || !name) continue;
        const geometry = feature.geometry;
        if (geometry.type !== 'Point') continue;
        const projected = map.project(geometry.coordinates as [number, number]);
        const d = Math.hypot(projected.x - point.x, projected.y - point.y);
        if (!best || d < best.d) best = { name, d };
      }
      onPlaceName(best?.name ?? null);
    };
    // Labels only exist once the tiles have actually drawn.
    if (map.isStyleLoaded()) run();
    else map.once('idle', run);
    return () => {
      cancelled = true;
      map.off('idle', run);
    };
  }, [placeQuery, onPlaceName, mapEpoch, mode, stop]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}

/**
 * A scaled tree sprite, optionally with the ripeness ring that reads under
 * the canopy at street scale and a walking-time pill above it.
 */
function spriteHtml(
  tree: Tree,
  state: string,
  scale: number,
  showRing: boolean,
  minutes: number | null
): string {
  const ringColor = ripenessColors[state] ?? ripenessColors.none;
  const ring = showRing
    ? `<div style="position:absolute;left:6%;bottom:2%;width:88%;height:26%;border:2px solid ${ringColor};border-radius:50%;box-sizing:border-box"></div>`
    : '';
  const pill =
    minutes === null
      ? ''
      : `<div style="position:absolute;left:50%;top:-22px;transform:translateX(-50%);background:rgba(255,255,255,.95);border-radius:999px;padding:4px 9px;font:700 11px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1C261D;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.16)">${minutes} min</div>`;
  return (
    `<div style="transform:scale(${scale});transform-origin:top left;position:absolute;inset:0">` +
    `${treeSpriteSvg(tree.species, state as never, tree.status === 'unverified')}</div>${ring}${pill}`
  );
}

/** A counted cluster bubble. Red the moment anything inside it is ripe. */
function clusterHtml(count: number, hasRipe: boolean, size: number, caption: boolean): string {
  const fill = hasRipe ? '#C9402F' : '#38754A';
  const fontSize = Math.min(20, Math.max(16, Math.round(size / 3)));
  const label = caption
    ? `<div style="font:700 9px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:.4px;margin-top:1px">ZRALÝCH</div>`
    : '';
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${fill};border:3.5px solid #fff;box-shadow:0 3px 9px rgba(0,0,0,.26);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;box-sizing:border-box">
    <div style="font:800 ${fontSize}px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${count}</div>${label}
  </div>`;
}

/** The picker at district scale: a dot with a ring and an accuracy halo. */
function dotHtml(): string {
  return `<div style="width:30px;height:30px;border-radius:50%;background:rgba(59,111,212,.22);display:flex;align-items:center;justify-content:center">
    <div style="width:14px;height:14px;border-radius:50%;background:${USER_BLUE};border:2.5px solid #fff;box-sizing:border-box"></div>
  </div>`;
}
