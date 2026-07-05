/* The route. A real corridor: up the Baztan valley, over the border at
   Dantxarinea, down through Lapurdi toward the coast. Donibane Lohizune
   is 23 km away. It stays 23 km away. */

export const CYCLE_LEN = 7200;      // metres of road before the fold
export const BORDER_S = 3700;       // the old customs post
export const GAS_S = 1400;          // the gasolinera that keeps coming back
export const DEST = 'DONIBANE';

export interface Village {
  name: string;
  alt: string;                      // the other language's name
  s: number;                        // centre, metres into the cycle
  fr: boolean;                      // French side of the muga
}

export const VILLAGES: Village[] = [
  { name: 'ELIZONDO',     alt: '',          s: 700,  fr: false },
  { name: 'URDAZUBI',     alt: 'Urdax',     s: 1900, fr: false },
  { name: 'ZUGARRAMURDI', alt: '',          s: 3100, fr: false },
  { name: 'SARA',         alt: 'Sare',      s: 4400, fr: true },
  { name: 'AINHOA',       alt: 'Ainhoa',    s: 5600, fr: true },
  { name: 'EZPELETA',     alt: 'Espelette', s: 6700, fr: true },
];

/* map-space control points (x, y in 0..1, y down) the player dot follows.
   First point = cycle start, then one per village, then the fold end. */
export const MAP_PATH: { x: number; y: number; s: number }[] = [
  { x: 0.40, y: 0.93, s: 0 },
  { x: 0.44, y: 0.82, s: 700 },     // Elizondo
  { x: 0.50, y: 0.70, s: 1900 },    // Urdazubi
  { x: 0.57, y: 0.60, s: 3100 },    // Zugarramurdi
  { x: 0.60, y: 0.54, s: 3700 },    // muga
  { x: 0.64, y: 0.45, s: 4400 },    // Sara
  { x: 0.70, y: 0.36, s: 5600 },    // Ainhoa
  { x: 0.77, y: 0.28, s: 6700 },    // Ezpeleta
  { x: 0.80, y: 0.24, s: 7200 },    // where the fold catches you
];

/* the rest of the road you will never drive */
export const MAP_TAIL: { x: number; y: number }[] = [
  { x: 0.80, y: 0.24 }, { x: 0.76, y: 0.17 }, { x: 0.68, y: 0.11 }, { x: 0.61, y: 0.075 },
];
export const MAP_DEST = { x: 0.61, y: 0.075, name: 'DONIBANE LOHIZUNE' };
