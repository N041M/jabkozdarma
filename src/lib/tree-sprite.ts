import type { RipenessState } from './types';

/**
 * Pokémon GO-style billboard sprite for a tree pin: a chunky little
 * low-poly-looking apple tree standing on the map, its accents showing
 * the latest ripeness state. Returned as an SVG string (44×54).
 */

interface SpriteColors {
  canopy: string;
  canopyDark: string;
  accent: string | null;
  glow: string | null;
}

const STATES: Record<RipenessState | 'none', SpriteColors> = {
  ripe: { canopy: '#4E9B47', canopyDark: '#3E833A', accent: '#E5372B', glow: 'rgba(255,110,70,0.55)' },
  flowering: { canopy: '#5CA653', canopyDark: '#4A8F45', accent: '#F5AECB', glow: 'rgba(245,174,203,0.5)' },
  unripe: { canopy: '#56A64E', canopyDark: '#458D42', accent: '#8ED04F', glow: null },
  past: { canopy: '#8C9C42', canopyDark: '#77842F', accent: '#B4762C', glow: null },
  bare: { canopy: '#9DAB92', canopyDark: '#87957D', accent: null, glow: null },
  none: { canopy: '#4E9B47', canopyDark: '#3E833A', accent: null, glow: null },
};

export function treeSpriteSvg(state: RipenessState | 'none', unverified: boolean): string {
  const c = STATES[state];
  const accents = c.accent
    ? `<circle cx="14" cy="21" r="2.6" fill="${c.accent}"/>
       <circle cx="28" cy="14" r="2.6" fill="${c.accent}"/>
       <circle cx="31" cy="26" r="2.4" fill="${c.accent}"/>
       <circle cx="20" cy="27" r="2.4" fill="${c.accent}"/>`
    : '';
  const glow = c.glow
    ? `<defs><radialGradient id="g"><stop offset="35%" stop-color="${c.glow}"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient></defs>
       <circle cx="22" cy="20" r="19" fill="url(#g)"/>`
    : '';
  return `<svg width="44" height="54" viewBox="0 0 44 54" xmlns="http://www.w3.org/2000/svg" style="overflow:visible${unverified ? ';opacity:.55' : ''}">
    <ellipse cx="22" cy="49.5" rx="11" ry="3.6" fill="rgba(20,60,10,0.28)"/>
    ${glow}
    <path d="M19.6 34h4.8l-.6 14a1.9 1.9 0 0 1-3.6 0Z" fill="#8A5A33"/>
    <circle cx="11.5" cy="24.5" r="9" fill="${c.canopyDark}"/>
    <circle cx="32.5" cy="24.5" r="9" fill="${c.canopyDark}"/>
    <circle cx="22" cy="17.5" r="13" fill="${c.canopy}"/>
    <circle cx="22" cy="26" r="10" fill="${c.canopy}"/>
    <circle cx="17" cy="12.5" r="5" fill="rgba(255,255,255,0.22)"/>
    ${accents}
  </svg>`;
}
