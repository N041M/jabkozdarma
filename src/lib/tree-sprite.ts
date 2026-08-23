import type { RipenessState, Species } from './types';

/**
 * Pokémon GO-style billboard sprite for a tree pin: a chunky little
 * low-poly-looking fruit tree standing on the map. Canopy shape and fruit
 * colour identify the species; the fruit only appears once there's a
 * ripeness report worth showing.
 */

interface StateLook {
  /** null = don't draw fruit at all */
  fruit: string | null;
  glow: string | null;
  faded: boolean;
}

const STATE_LOOK: Record<RipenessState | 'none', StateLook> = {
  ripe: { fruit: 'species', glow: 'warm', faded: false },
  flowering: { fruit: '#F5AECB', glow: 'blossom', faded: false },
  unripe: { fruit: '#8ED04F', glow: null, faded: false },
  past: { fruit: '#B4762C', glow: null, faded: false },
  bare: { fruit: null, glow: null, faded: true },
  none: { fruit: null, glow: null, faded: false },
};

interface SpeciesLook {
  canopy: string;
  canopyDark: string;
  fruit: string;
  /** 'round' apple/plum-ish, 'tall' pear/walnut-ish */
  shape: 'round' | 'tall';
}

const SPECIES_LOOK: Record<Species, SpeciesLook> = {
  apple: { canopy: '#4E9B47', canopyDark: '#3E833A', fruit: '#E5372B', shape: 'round' },
  pear: { canopy: '#59A354', canopyDark: '#478A45', fruit: '#D8C24A', shape: 'tall' },
  plum: { canopy: '#4B8F55', canopyDark: '#3C7746', fruit: '#6B4BA8', shape: 'round' },
  cherry: { canopy: '#57A24E', canopyDark: '#458A41', fruit: '#C42348', shape: 'round' },
  walnut: { canopy: '#3F8C46', canopyDark: '#337439', fruit: '#8A6A38', shape: 'tall' },
  other: { canopy: '#54994E', canopyDark: '#437F41', fruit: '#E0913A', shape: 'round' },
};

export function treeSpriteSvg(
  species: Species,
  state: RipenessState | 'none',
  unverified: boolean
): string {
  const s = SPECIES_LOOK[species] ?? SPECIES_LOOK.other;
  const look = STATE_LOOK[state];
  const fruitColor = look.fruit === 'species' ? s.fruit : look.fruit;

  const glow =
    look.glow === 'warm'
      ? `<defs><radialGradient id="g"><stop offset="35%" stop-color="rgba(255,110,70,0.5)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient></defs>
         <circle cx="22" cy="20" r="19" fill="url(#g)"/>`
      : look.glow === 'blossom'
        ? `<defs><radialGradient id="g"><stop offset="35%" stop-color="rgba(245,174,203,0.5)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient></defs>
           <circle cx="22" cy="20" r="19" fill="url(#g)"/>`
        : '';

  const fruit = fruitColor
    ? `<circle cx="14" cy="21" r="2.6" fill="${fruitColor}"/>
       <circle cx="28" cy="14" r="2.6" fill="${fruitColor}"/>
       <circle cx="31" cy="26" r="2.4" fill="${fruitColor}"/>
       <circle cx="20" cy="27" r="2.4" fill="${fruitColor}"/>`
    : '';

  // Tall species get a narrower, higher canopy — a pear reads differently
  // from an apple even at map scale.
  const canopy =
    s.shape === 'tall'
      ? `<ellipse cx="13.5" cy="24" rx="7.5" ry="9" fill="${s.canopyDark}"/>
         <ellipse cx="30.5" cy="24" rx="7.5" ry="9" fill="${s.canopyDark}"/>
         <ellipse cx="22" cy="16" rx="11" ry="14" fill="${s.canopy}"/>
         <ellipse cx="22" cy="26" rx="9" ry="10" fill="${s.canopy}"/>`
      : `<circle cx="11.5" cy="24.5" r="9" fill="${s.canopyDark}"/>
         <circle cx="32.5" cy="24.5" r="9" fill="${s.canopyDark}"/>
         <circle cx="22" cy="17.5" r="13" fill="${s.canopy}"/>
         <circle cx="22" cy="26" r="10" fill="${s.canopy}"/>`;

  const opacity = unverified || look.faded ? ';opacity:.55' : '';

  return `<svg width="44" height="54" viewBox="0 0 44 54" xmlns="http://www.w3.org/2000/svg" style="overflow:visible${opacity}">
    <ellipse cx="22" cy="49.5" rx="11" ry="3.6" fill="rgba(20,60,10,0.28)"/>
    ${glow}
    <path d="M19.6 34h4.8l-.6 14a1.9 1.9 0 0 1-3.6 0Z" fill="#8A5A33"/>
    ${canopy}
    <circle cx="17" cy="12.5" r="5" fill="rgba(255,255,255,0.22)"/>
    ${fruit}
  </svg>`;
}
