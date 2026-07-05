/* Organic day-night cycle for Atlantic Basque weather: overcast greys,
   brief warm dawns and duskes, long wet nights. t ∈ [0,1), 0 = midnight. */

import * as THREE from 'three';

export interface DayLight {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  fog: THREE.Color;
  fogDensity: number;
  sunI: number;
  sunColor: THREE.Color;
  ambI: number;
  hemiI: number;
  exposure: number;
  darkness: number;      // 0 = full day, 1 = full night; drives lamps & glows
}

interface Key {
  t: number;
  skyTop: string; skyHorizon: string; fog: string;
  fogDensity: number; sunI: number; sunColor: string;
  ambI: number; hemiI: number; exposure: number; darkness: number;
}

const KEYS: Key[] = [
  { t: 0.00, skyTop: '#04060c', skyHorizon: '#0b111b', fog: '#06090f', fogDensity: 0.0130, sunI: 0.75, sunColor: '#7688a8', ambI: 0.10, hemiI: 0.35, exposure: 1.06, darkness: 1.00 },
  { t: 0.22, skyTop: '#10141d', skyHorizon: '#3a3f4a', fog: '#14181f', fogDensity: 0.0140, sunI: 0.40, sunColor: '#7d8aa4', ambI: 0.08, hemiI: 0.30, exposure: 1.03, darkness: 0.95 },
  { t: 0.28, skyTop: '#3e4a58', skyHorizon: '#c98d5a', fog: '#6a6a68', fogDensity: 0.0100, sunI: 1.00, sunColor: '#ffb877', ambI: 0.14, hemiI: 0.50, exposure: 1.00, darkness: 0.55 },
  { t: 0.38, skyTop: '#6f7d8a', skyHorizon: '#b9bdb2', fog: '#939ba1', fogDensity: 0.0062, sunI: 1.90, sunColor: '#fff2dd', ambI: 0.20, hemiI: 0.70, exposure: 1.00, darkness: 0.08 },
  { t: 0.52, skyTop: '#7f8f9d', skyHorizon: '#cfd2c6', fog: '#a7aeb2', fogDensity: 0.0050, sunI: 2.30, sunColor: '#ffffff', ambI: 0.24, hemiI: 0.80, exposure: 1.00, darkness: 0.00 },
  { t: 0.68, skyTop: '#5d6673', skyHorizon: '#c9a06a', fog: '#8d8e8a', fogDensity: 0.0070, sunI: 1.40, sunColor: '#ffd9a0', ambI: 0.18, hemiI: 0.60, exposure: 1.00, darkness: 0.15 },
  { t: 0.78, skyTop: '#232c3e', skyHorizon: '#a06452', fog: '#3a3d44', fogDensity: 0.0100, sunI: 0.60, sunColor: '#ff9d5c', ambI: 0.12, hemiI: 0.40, exposure: 1.02, darkness: 0.70 },
  { t: 0.86, skyTop: '#04060c', skyHorizon: '#0b111b', fog: '#06090f', fogDensity: 0.0130, sunI: 0.75, sunColor: '#7688a8', ambI: 0.10, hemiI: 0.35, exposure: 1.06, darkness: 1.00 },
];

const keyColors = KEYS.map(k => ({
  skyTop: new THREE.Color(k.skyTop),
  skyHorizon: new THREE.Color(k.skyHorizon),
  fog: new THREE.Color(k.fog),
  sunColor: new THREE.Color(k.sunColor),
}));

const out: DayLight = {
  skyTop: new THREE.Color(), skyHorizon: new THREE.Color(), fog: new THREE.Color(),
  fogDensity: 0.01, sunI: 1, sunColor: new THREE.Color(),
  ambI: 0.1, hemiI: 0.5, exposure: 1, darkness: 1,
};

export function sampleDay(t: number): DayLight {
  t = ((t % 1) + 1) % 1;
  let i = KEYS.length - 1;
  for (let j = 0; j < KEYS.length; j++) {
    if (KEYS[j].t <= t) i = j;
  }
  const a = KEYS[i];
  const b = KEYS[(i + 1) % KEYS.length];
  const span = (b.t - a.t + 1) % 1 || 1;
  const f0 = ((t - a.t + 1) % 1) / span;
  const f = f0 * f0 * (3 - 2 * f0);              // smoothstep between keys
  const ca = keyColors[i], cb = keyColors[(i + 1) % KEYS.length];

  out.skyTop.copy(ca.skyTop).lerp(cb.skyTop, f);
  out.skyHorizon.copy(ca.skyHorizon).lerp(cb.skyHorizon, f);
  out.fog.copy(ca.fog).lerp(cb.fog, f);
  out.sunColor.copy(ca.sunColor).lerp(cb.sunColor, f);
  out.fogDensity = a.fogDensity + (b.fogDensity - a.fogDensity) * f;
  out.sunI = a.sunI + (b.sunI - a.sunI) * f;
  out.ambI = a.ambI + (b.ambI - a.ambI) * f;
  out.hemiI = a.hemiI + (b.hemiI - a.hemiI) * f;
  out.exposure = a.exposure + (b.exposure - a.exposure) * f;
  out.darkness = a.darkness + (b.darkness - a.darkness) * f;
  return out;
}

/* sun elevation 0..1 while the sun is up (0.25 → 0.80), else 0 */
export function sunElevation(t: number): number {
  t = ((t % 1) + 1) % 1;
  if (t < 0.25 || t > 0.80) return 0;
  return Math.sin(Math.PI * (t - 0.25) / 0.55);
}
