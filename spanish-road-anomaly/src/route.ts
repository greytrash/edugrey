/* The real corridor, at real road distances: up the Baztan valley from
   Elizondo, over the Otsondo pass (602 m), down to the border ventas at
   Dantxarinea, then Iparralde — Ainhoa, Sara under Larrun, Senpere,
   Azkaine — toward Donibane Lohizune on the coast. 45 km of road.
   Donibane stays 45 km away no matter how long you drive. */

export const CYCLE_LEN = 45000;     // metres of road before the fold
export const BORDER_S = 23000;      // the old customs post at Dantxarinea
export const GAS_S = 22600;         // the ventas by the muga
export const PASS_S = 13000;        // alto de Otsondo
export const DEST = 'DONIBANE';

export interface Village {
  name: string;
  alt: string;
  s: number;
  fr: boolean;
}

export const VILLAGES: Village[] = [
  { name: 'ELIZONDO', alt: '',          s: 500,   fr: false },
  { name: 'ARIZKUN',  alt: '',          s: 4000,  fr: false },
  { name: 'AMAIUR',   alt: 'Maya',      s: 8000,  fr: false },
  { name: 'URDAZUBI', alt: 'Urdax',     s: 20000, fr: false },
  { name: 'AINHOA',   alt: '',          s: 26000, fr: true },
  { name: 'SARA',     alt: 'Sare',      s: 31000, fr: true },
  { name: 'SENPERE',  alt: 'St-Pée',    s: 37000, fr: true },
  { name: 'AZKAINE',  alt: 'Ascain',    s: 41000, fr: true },
];

/* elevation profile (metres): Baztan floor ~200, Otsondo ~600, coast ~30 */
export function E(s: number): number {
  const cs = ((s % CYCLE_LEN) + CYCLE_LEN) % CYCLE_LEN;
  const pass = 420 * Math.exp(-(((cs - PASS_S) / 3600) ** 2));
  return 200 + pass - 185 * (cs / CYCLE_LEN)
    + 25 * Math.sin(cs * 0.0006 + 1) + 12 * Math.sin(cs * 0.0017);
}
export function E1(s: number): number {
  const cs = ((s % CYCLE_LEN) + CYCLE_LEN) % CYCLE_LEN;
  const g = 420 * Math.exp(-(((cs - PASS_S) / 3600) ** 2)) * (-2 * (cs - PASS_S) / 3600 ** 2);
  return g - 185 / CYCLE_LEN
    + 25 * 0.0006 * Math.cos(cs * 0.0006 + 1) + 12 * 0.0017 * Math.cos(cs * 0.0017);
}

/* map-space control points (x, y in 0..1, y down; north up) — the road as
   it actually runs on the sheet */
export const MAP_PATH: { x: number; y: number; s: number }[] = [
  { x: 0.46, y: 0.925, s: 0 },
  { x: 0.46, y: 0.895, s: 500 },     // Elizondo
  { x: 0.50, y: 0.825, s: 4000 },    // Arizkun
  { x: 0.52, y: 0.745, s: 8000 },    // Amaiur
  { x: 0.50, y: 0.655, s: 13000 },   // alto de Otsondo
  { x: 0.53, y: 0.560, s: 20000 },   // Urdazubi
  { x: 0.52, y: 0.505, s: 23000 },   // muga / Dantxarinea
  { x: 0.50, y: 0.425, s: 26000 },   // Ainhoa
  { x: 0.38, y: 0.355, s: 31000 },   // Sara
  { x: 0.42, y: 0.245, s: 37000 },   // Senpere
  { x: 0.33, y: 0.170, s: 41000 },   // Azkaine
  { x: 0.315, y: 0.125, s: 45000 },  // where the fold catches you
];
export const MAP_TAIL: { x: number; y: number }[] = [
  { x: 0.315, y: 0.125 }, { x: 0.30, y: 0.085 },
];
export const MAP_DEST = { x: 0.30, y: 0.075, name: 'DONIBANE LOHIZUNE' };

/* peaks and off-route places that make the sheet feel like the real one */
export const MAP_PEAKS = [
  { x: 0.27, y: 0.275, name: 'LARRUN', h: '905' },
  { x: 0.62, y: 0.385, name: 'ARTZAMENDI', h: '926' },
  { x: 0.60, y: 0.610, name: 'GORRAMENDI', h: '1074' },
  { x: 0.55, y: 0.330, name: 'MONDARRAIN', h: '749' },
];
export const MAP_TOWNS = [
  { x: 0.19, y: 0.075, name: 'Ziburu' },
  { x: 0.115, y: 0.060, name: 'Hendaia' },
  { x: 0.06, y: 0.095, name: 'Hondarribia' },
  { x: 0.60, y: 0.155, name: 'Uztaritze' },
  { x: 0.68, y: 0.245, name: 'Kanbo' },
  { x: 0.63, y: 0.470, name: 'Itsasu' },
];

/* --------------------------------------------------------------- missions */
export interface Mission {
  targetS: number;                   // where, along the cycle
  label: string;                     // what the X means, once you know
  message: string;                   // what the voice actually says, in clave
  ack: string;
}

export const MISSIONS: Mission[] = [
  {
    targetS: GAS_S,
    label: 'las ventas de la muga',
    message: 'Aquí Sokoa. Aquí Sokoa. El paquete espera en las ventas de la muga, junto a los surtidores. Luces apagadas. Tres golpes. Repetimos: las ventas, junto a los surtidores.',
    ack: 'Paquete recibido. Buen trabajo. Esperen instrucciones.',
  },
  {
    targetS: PASS_S,
    label: 'el alto de Otsondo',
    message: 'Sokoa llama. Suban al puerto. En el alto de Otsondo, tres piedras blancas a la derecha. Antes del alba. No apaguen el motor.',
    ack: 'Recogido en el alto. Bajen despacio. Hay niebla.',
  },
  {
    targetS: 25950,
    label: 'el frontón de Ainhoa',
    message: 'Atención. El siguiente punto es el frontón de Ainhoa. Dejen el paquete contra la pared grande. Si hay alguien jugando, sigan de largo.',
    ack: 'Confirmado en Ainhoa. La pared escucha.',
  },
  {
    targetS: BORDER_S,
    label: 'la caseta vieja de la aduana',
    message: 'Aquí Sokoa. La caseta vieja de la aduana, en Dantxarinea. La barrera lleva años levantada. Nadie pregunta. Nadie ha preguntado nunca.',
    ack: 'Recibido en la muga. No miren atrás al salir.',
  },
];
