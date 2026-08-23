import type { StyleSpecification } from 'maplibre-gl';

export type MapMode = 'go' | 'flat';

/** Camera tilt each mode opens at. */
export const MODE_PITCH: Record<MapMode, number> = { go: 55, flat: 0 };

/**
 * "Orchard GO" — a Pokémon GO-flavored map style: saturated grass-green
 * ground, soft blue water, clean white roads, pale 3D building blocks,
 * almost no labels. OpenMapTiles schema served by OpenFreeMap (free, no key).
 */
export const GO_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    omt: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: '© OpenStreetMap contributors, © OpenMapTiles',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#A6D96E' } },
    {
      id: 'landuse-residential',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      filter: ['in', 'class', 'residential', 'suburb', 'neighbourhood'],
      paint: { 'fill-color': '#B4E080' },
    },
    {
      id: 'landcover-grass',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      filter: ['in', 'class', 'grass', 'farmland'],
      paint: { 'fill-color': '#97D25B' },
    },
    {
      id: 'landcover-wood',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      filter: ['==', 'class', 'wood'],
      paint: { 'fill-color': '#7FC24C' },
    },
    {
      id: 'park',
      type: 'fill',
      source: 'omt',
      'source-layer': 'park',
      paint: { 'fill-color': '#8ECC53' },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'omt',
      'source-layer': 'water',
      paint: { 'fill-color': '#6FC8EE' },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      paint: {
        'line-color': '#6FC8EE',
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 8, 0.5, 16, 5],
      },
    },
    {
      id: 'aeroway',
      type: 'line',
      source: 'omt',
      'source-layer': 'aeroway',
      minzoom: 11,
      paint: { 'line-color': '#DDE9DC', 'line-width': 3 },
    },
    // rail — faint, GO barely shows it
    {
      id: 'rail',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['==', 'class', 'rail'],
      minzoom: 13,
      paint: { 'line-color': '#9CC77E', 'line-width': 1.4, 'line-dasharray': [3, 3] },
    },
    // minor roads
    {
      id: 'road-minor',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: [
        'in',
        'class',
        'minor',
        'service',
        'track',
        'path',
        'tertiary',
      ],
      minzoom: 12,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 0.8, 18, 14],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 14, 1],
      },
    },
    // main roads
    {
      id: 'road-main',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'primary', 'secondary', 'trunk'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 8, 1, 18, 26],
      },
    },
    {
      id: 'road-motorway',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['==', 'class', 'motorway'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#FFEFB8',
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 8, 1.5, 18, 30],
      },
    },
    // GO's pale 3D building blocks. Kept cheap for mobile GPUs: appear later,
    // fully opaque (transparent extrusions force expensive sorting), heights
    // clamped so bad data can't create skyscraper geometry.
    {
      id: 'building-3d',
      type: 'fill-extrusion',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 15,
      paint: {
        'fill-extrusion-color': '#DFE9EA',
        'fill-extrusion-height': ['min', 80, ['coalesce', ['get', 'render_height'], 8]],
        'fill-extrusion-base': ['min', 80, ['coalesce', ['get', 'render_min_height'], 0]],
        'fill-extrusion-opacity': 1,
      },
    },
    // flat footprints bridge the gap before extrusions switch on
    {
      id: 'building-flat',
      type: 'fill',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 13,
      maxzoom: 15,
      paint: { 'fill-color': '#DFE9EA', 'fill-opacity': 0.85 },
    },
    // sparse labels: cities and towns only
    {
      id: 'place-labels',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      filter: ['in', 'class', 'city', 'town'],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 14, 16],
      },
      paint: {
        'text-color': '#2C5E1F',
        'text-halo-color': 'rgba(255,255,255,0.85)',
        'text-halo-width': 1.6,
      },
    },
  ],
};

/**
 * "Plain" — a calm top-down map for when you just want to read the streets:
 * paper background, road casings, flat buildings, more labels, no tilt.
 * Same OpenMapTiles source, so switching costs no extra tile downloads.
 */
export const FLAT_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    omt: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: '© OpenStreetMap contributors, © OpenMapTiles',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#F3F2ED' } },
    {
      id: 'landcover-green',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      filter: ['in', 'class', 'grass', 'wood', 'farmland'],
      paint: { 'fill-color': '#DFE9D2' },
    },
    {
      id: 'park',
      type: 'fill',
      source: 'omt',
      'source-layer': 'park',
      paint: { 'fill-color': '#D8E8C8' },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'omt',
      'source-layer': 'water',
      paint: { 'fill-color': '#A9CFE8' },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      paint: {
        'line-color': '#A9CFE8',
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 8, 0.5, 16, 4],
      },
    },
    {
      id: 'building',
      type: 'fill',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 13,
      paint: { 'fill-color': '#E4E1D9', 'fill-outline-color': '#D3CFC4' },
    },
    // casing under the road fills gives the classic printed-map look
    {
      id: 'road-casing',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#D8D4C8',
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 8, 2, 18, 30],
      },
    },
    {
      id: 'road-minor',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'minor', 'service', 'tertiary'],
      minzoom: 12,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 0.6, 18, 12],
      },
    },
    {
      id: 'road-main',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'primary', 'secondary', 'trunk'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 8, 1, 18, 22],
      },
    },
    {
      id: 'road-motorway',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['==', 'class', 'motorway'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#FBE7A6',
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 8, 1.5, 18, 26],
      },
    },
    {
      id: 'path',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'path', 'track'],
      minzoom: 14,
      paint: { 'line-color': '#C3B79B', 'line-width': 1.2, 'line-dasharray': [2, 2] },
    },
    // more labels than the GO style — this mode exists to be read
    {
      id: 'place-labels',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      filter: ['in', 'class', 'city', 'town', 'village', 'suburb', 'neighbourhood'],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 14, 15],
      },
      paint: {
        'text-color': '#4A4A44',
        'text-halo-color': 'rgba(255,255,255,0.9)',
        'text-halo-width': 1.6,
      },
    },
    {
      id: 'road-labels',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 14,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'symbol-placement': 'line',
      },
      paint: {
        'text-color': '#6E6A60',
        'text-halo-color': 'rgba(255,255,255,0.9)',
        'text-halo-width': 1.4,
      },
    },
  ],
};

export function styleFor(mode: MapMode): StyleSpecification {
  return mode === 'flat' ? FLAT_STYLE : GO_STYLE;
}
