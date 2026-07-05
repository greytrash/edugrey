/* Atlantic weather that actually changes: fronts roll through every few
   game-hours, blending between clear spells, drizzle, hard rain, mountain
   fog and the occasional storm cell with lightning. */

export interface WeatherState {
  rainI: number;        // 0..1, drives rain lines, droplets, audio, grip
  fogMul: number;       // multiplier over the day-cycle fog density
  cloud: number;        // 0..1 extra cloud cover on the sky canvas
  storm: boolean;
}

interface Pattern {
  name: string;
  rain: number; fog: number; cloud: number; storm: boolean; weight: number;
}

const PATTERNS: Pattern[] = [
  { name: 'claro',    rain: 0.03, fog: 0.75, cloud: 0.15, storm: false, weight: 3 },
  { name: 'nubes',    rain: 0.08, fog: 0.95, cloud: 0.55, storm: false, weight: 3 },
  { name: 'sirimiri', rain: 0.35, fog: 1.25, cloud: 0.70, storm: false, weight: 4 },
  { name: 'lluvia',   rain: 0.75, fog: 1.45, cloud: 0.85, storm: false, weight: 3 },
  { name: 'niebla',   rain: 0.15, fog: 2.60, cloud: 0.80, storm: false, weight: 2 },
  { name: 'tormenta', rain: 1.00, fog: 1.60, cloud: 1.00, storm: true,  weight: 1 },
];

function pick(exclude: string): Pattern {
  const pool = PATTERNS.filter(p => p.name !== exclude);
  const total = pool.reduce((a, p) => a + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return pool[0];
}

export class Weather {
  current: WeatherState = { rainI: 0.4, fogMul: 1.2, cloud: 0.6, storm: false };
  name = 'sirimiri';
  private target: Pattern = PATTERNS[2];
  private nextChange = 0;            // in game-hours elapsed
  private hoursElapsed = 0;
  /** set true for one frame when lightning strikes */
  lightning = false;
  private nextBolt = 0;

  /* dtHours: elapsed game-time in hours */
  update(dtHours: number, dtReal: number) {
    this.hoursElapsed += dtHours;
    if (this.hoursElapsed >= this.nextChange) {
      this.target = pick(this.name);
      this.name = this.target.name;
      this.nextChange = this.hoursElapsed + 2 + Math.random() * 4;
    }
    const k = 1 - Math.exp(-dtReal * 0.05);   // fronts arrive slowly
    this.current.rainI += (this.target.rain - this.current.rainI) * k;
    this.current.fogMul += (this.target.fog - this.current.fogMul) * k;
    this.current.cloud += (this.target.cloud - this.current.cloud) * k;
    this.current.storm = this.target.storm;

    this.lightning = false;
    if (this.current.storm) {
      this.nextBolt -= dtReal;
      if (this.nextBolt <= 0) {
        this.lightning = true;
        this.nextBolt = 4 + Math.random() * 14;
      }
    }
  }
}
