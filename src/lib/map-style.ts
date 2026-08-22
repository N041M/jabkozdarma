import type { StyleSpecification } from 'maplibre-gl';

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
    // GO's pale 3D building blocks
    {
      id: 'building-3d',
      type: 'fill-extrusion',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 13.5,
      paint: {
        'fill-extrusion-color': '#DFE9EA',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.92,
      },
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
