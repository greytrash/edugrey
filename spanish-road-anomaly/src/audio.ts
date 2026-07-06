/* All-procedural WebAudio. The radio is the game's spine: six stations that
   behave like real broadcasters — songs with verses and endings, a DJ who
   tells you the time, hourly pips and a news bulletin, jingles — all of it
   generated, nothing sampled. Spoken voices use the system's Spanish/French
   speech voices, squeezed under a carrier-noise bed so they sit in the mix
   like transmissions. Station 91.8, Radio Sokoa, mostly reads numbers.
   Sometimes it reads instructions instead. */

import type { Mission } from './route';

export interface Station {
  freq: string;
  name: string;
  type: 'talk' | 'sokoa' | 'waltz' | 'copla' | 'news' | 'herri';
  lang: string;
}

const STATIONS: Station[] = [
  { freq: '88.1',  name: 'Euskal Irratia', type: 'talk',  lang: 'es-ES' },
  { freq: '91.8',  name: 'Radio Sokoa',    type: 'sokoa', lang: 'es-ES' },
  { freq: '94.3',  name: 'Radio Baiona',   type: 'waltz', lang: 'fr-FR' },
  { freq: '98.2',  name: 'Cadena Sur',     type: 'copla', lang: 'es-ES' },
  { freq: '100.9', name: 'Boletín',        type: 'news',  lang: 'es-ES' },
  { freq: '103.7', name: 'Herri Musika',   type: 'herri', lang: 'es-ES' },
];

const JINGLES: Record<string, number[]> = {
  waltz: [523.25, 659.25, 783.99],
  copla: [440, 554.37, 659.25],
  news:  [880, 880, 987.77],
  talk:  [587.33, 739.99, 880],
  herri: [659.25, 783.99, 987.77],
};

function makeNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/* per-station rolling programme: what song, how long left, gap, DJ pending */
interface Programme {
  songLeft: number;
  gapLeft: number;
  djQueued: boolean;
  transpose: number;      // multiplier on frequencies
  tempo: number;          // multiplier on note spacing
  seed: number;
}

export interface RadioContext {
  hourStr: string;        // "03:40"
  hour: number;
  weather: string;        // "lluvia", "niebla"...
  cycle: number;
}

export class GameAudio {
  private ctx!: AudioContext;
  private master!: GainNode;
  private noise!: AudioBuffer;
  started = false;

  private engOsc!: OscillatorNode;
  private engSub!: OscillatorNode;
  private engGain!: GainNode;
  private whineOsc!: OscillatorNode;
  private whineGain!: GainNode;

  private rainGain!: GainNode;
  private hissGain!: GainNode;
  private rumbleGain!: GainNode;
  private skidGain!: GainNode;

  private radioBus!: GainNode;
  private amNode!: BiquadFilterNode;
  private staticGain!: GainNode;
  private staticFilter!: BiquadFilterNode;
  private programGain!: GainNode;

  radioIndex = -1;
  interference = 0;
  context: RadioContext = { hourStr: '00:00', hour: 0, weather: 'lluvia', cycle: 0 };

  /* speech */
  private speaking = false;
  private voicesReady = false;
  speechSupported = typeof speechSynthesis !== 'undefined';

  /* sokoa */
  private mission: Mission | null = null;
  private sokoaMsgTimer = 6;

  /* per-station programmes */
  private prog: Record<string, Programme> = {};
  private lastBulletinHour = -1;

  private nextNote = 0;
  private noteIdx = 0;
  private nextSyllable = 0;
  private nextBeat = 0;
  private beatIdx = 0;
  private nextFlute = 0;
  private nextNum = 0;
  private numStep = 0;

  get stations(): Station[] { return STATIONS; }
  get currentStation(): Station | null {
    return this.radioIndex < 0 ? null : STATIONS[this.radioIndex] ?? null;
  }

  start() {
    if (this.started) return;
    this.started = true;
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);
    this.noise = makeNoiseBuffer(ctx);

    for (const st of STATIONS) {
      this.prog[st.type] = {
        songLeft: 60 + Math.random() * 60, gapLeft: 0, djQueued: false,
        transpose: 1, tempo: 1, seed: Math.random() * 1000,
      };
    }

    if (this.speechSupported) {
      const load = () => { this.voicesReady = speechSynthesis.getVoices().length > 0; };
      load();
      speechSynthesis.onvoiceschanged = load;
    }

    /* engine */
    const engFilter = ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 340;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engOsc = ctx.createOscillator();
    this.engOsc.type = 'sawtooth';
    this.engOsc.frequency.value = 55;
    this.engSub = ctx.createOscillator();
    this.engSub.type = 'sine';
    this.engSub.frequency.value = 27;
    this.engOsc.connect(engFilter);
    this.engSub.connect(engFilter);
    engFilter.connect(this.engGain);
    this.engGain.connect(this.master);
    this.engOsc.start();
    this.engSub.start();
    this.whineOsc = ctx.createOscillator();
    this.whineOsc.type = 'sine';
    this.whineOsc.frequency.value = 360;
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    this.whineOsc.connect(this.whineGain).connect(this.master);
    this.whineOsc.start();

    /* shared looped noise */
    const loop = ctx.createBufferSource();
    loop.buffer = this.noise;
    loop.loop = true;
    loop.start();

    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1400;
    rainFilter.Q.value = 0.4;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0.05;
    loop.connect(rainFilter).connect(this.rainGain).connect(this.master);

    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'highpass';
    hissFilter.frequency.value = 3200;
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    loop.connect(hissFilter).connect(this.hissGain).connect(this.master);

    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 220;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    loop.connect(rumbleFilter).connect(this.rumbleGain).connect(this.master);

    const skidFilter = ctx.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.value = 2100;
    skidFilter.Q.value = 2.5;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    loop.connect(skidFilter).connect(this.skidGain).connect(this.master);

    /* radio bus */
    const am = ctx.createBiquadFilter();
    am.type = 'bandpass';
    am.frequency.value = 1100;
    am.Q.value = 0.55;
    this.amNode = am;
    this.radioBus = ctx.createGain();
    this.radioBus.gain.value = 0;
    am.connect(this.radioBus).connect(this.master);

    this.staticFilter = ctx.createBiquadFilter();
    this.staticFilter.type = 'bandpass';
    this.staticFilter.frequency.value = 900;
    this.staticFilter.Q.value = 0.6;
    this.staticGain = ctx.createGain();
    this.staticGain.gain.value = 0;
    loop.connect(this.staticFilter).connect(this.staticGain).connect(am);

    this.programGain = ctx.createGain();
    this.programGain.gain.value = 0;
    this.programGain.connect(am);
  }

  suspend() {
    if (!this.started) return;
    this.ctx.suspend();
    if (this.speechSupported) speechSynthesis.cancel();
    this.speaking = false;
  }
  resume() {
    if (this.started) this.ctx.resume();
  }

  /* ---------------------------------------------------------------- speech */
  private pickVoice(lang: string): SpeechSynthesisVoice | null {
    if (!this.speechSupported) return null;
    const voices = speechSynthesis.getVoices();
    const exact = voices.filter(v => v.lang.replace('_', '-').startsWith(lang.slice(0, 2)));
    if (!exact.length) return null;
    // prefer non-default enhanced voices when present
    return exact.find(v => /neural|natural|premium|enhanced|mónica|monica|elvira|jorge|paulina/i.test(v.name))
      ?? exact[0];
  }

  speak(text: string, lang: string, rate = 0.95, pitch = 0.9, onend?: () => void) {
    if (!this.speechSupported) { onend?.(); return; }
    const u = new SpeechSynthesisUtterance(text);
    const v = this.pickVoice(lang);
    if (v) u.voice = v;
    u.lang = lang;
    u.rate = rate;
    u.pitch = pitch;
    u.volume = 0.85;
    this.speaking = true;
    const done = () => { this.speaking = false; onend?.(); };
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
  }
  stopSpeech() {
    if (this.speechSupported) speechSynthesis.cancel();
    this.speaking = false;
  }

  /* ---------------------------------------------------------------- radio */
  cycleRadio(): Station | null {
    this.radioIndex = this.radioIndex >= STATIONS.length - 1 ? -1 : this.radioIndex + 1;
    this.stopSpeech();
    if (this.started) {
      const t = this.ctx.currentTime;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.connect(g).connect(this.master);
      src.start(t, Math.random(), 0.18);
    }
    return this.currentStation;
  }

  setMission(m: Mission) { this.mission = m; this.sokoaMsgTimer = 3; }
  clearMission(ack: string) {
    this.mission = null;
    if (this.currentStation?.type === 'sokoa') {
      this.speak(ack, 'es-ES', 0.9, 0.8);
    }
  }
  get hasMission() { return !!this.mission; }

  private jingle(type: string) {
    const notes = JINGLES[type];
    if (!notes || !this.started) return;
    const t = this.ctx.currentTime;
    notes.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.16);
      g.gain.linearRampToValueAtTime(0.4, t + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.16 + (i === notes.length - 1 ? 0.5 : 0.2));
      o.connect(g).connect(this.programGain);
      o.start(t + i * 0.16);
      o.stop(t + i * 0.16 + 0.6);
    });
  }

  private djLine(st: Station): string {
    const { hourStr, weather, cycle } = this.context;
    const pickFrom = (a: string[]) => a[(Math.random() * a.length) | 0];
    if (st.type === 'waltz') {
      return pickFrom([
        `Radio Bayonne. Il est ${hourStr.replace(':', ' heures ')}. Restez avec nous.`,
        `Vous écoutez Radio Bayonne. La côte est sous la pluie. Encore une valse.`,
        `Radio Bayonne, la nuit vous appartient.`,
      ]);
    }
    if (st.type === 'copla') {
      const creepy = cycle >= 2 ? 'Dedicada a los que siguen en la carretera. A los que siempre siguen.' : 'No se retiren.';
      return pickFrom([
        `Cadena Sur. Son las ${hourStr}. Sigue la ${weather} en el norte. ${creepy}`,
        `Están ustedes con Cadena Sur, la copla no duerme. ${creepy}`,
      ]);
    }
    if (st.type === 'talk') {
      return pickFrom([
        `Euskal Irratia. Gaueko ordua: ${hourStr}. Euria ari du.`,
        `Euskal Irratia entzuten ari zara. Kontuz errepidean.`,
      ]);
    }
    return '';
  }

  private bulletin(): string {
    const { hourStr, weather, cycle } = this.context;
    const lines = [
      `Boletín informativo. Son las ${hourStr}.`,
      `Continúa la ${weather} en el corredor del Baztan y la costa de Lapurdi.`,
      `El puerto de Otsondo permanece abierto con niebla en las cotas altas.`,
    ];
    if (cycle === 1) lines.push('La Guardia Civil informa de un vehículo blanco visto varias veces en el mismo punto de la nacional ciento veintiuno.');
    if (cycle === 2) lines.push('Se ruega a los conductores del corredor que no atiendan a las señales luminosas no reglamentarias.');
    if (cycle >= 3) lines.push('Se recuerda que Donibane Lohizune no existe. Repetimos. No existe. Buenas noches.');
    else lines.push('Buenas noches.');
    return lines.join(' ');
  }

  /* --------------------------------------------------------------- update */
  update(dt: number, p: {
    speed: number; maxSpeed: number; throttle: boolean;
    offroad: boolean; handbrake: boolean; rain: number;
  }) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const k = Math.abs(p.speed) / p.maxSpeed;

    this.engOsc.frequency.setTargetAtTime(52 + k * 96, t, 0.08);
    this.engSub.frequency.setTargetAtTime(26 + k * 48, t, 0.08);
    this.engGain.gain.setTargetAtTime(0.035 + k * 0.05 + (p.throttle ? 0.035 : 0), t, 0.1);
    const reversing = p.speed < -0.5;
    this.whineOsc.frequency.setTargetAtTime(320 + k * 260, t, 0.08);
    this.whineGain.gain.setTargetAtTime(reversing ? 0.012 + k * 0.02 : 0, t, 0.1);

    this.rainGain.gain.setTargetAtTime(0.015 + p.rain * 0.065, t, 0.4);
    this.hissGain.gain.setTargetAtTime(k * (0.015 + p.rain * 0.045), t, 0.2);
    this.rumbleGain.gain.setTargetAtTime(p.offroad ? 0.10 + k * 0.12 : 0, t, 0.05);
    this.skidGain.gain.setTargetAtTime(p.handbrake && k > 0.15 ? 0.06 : 0, t, 0.05);

    const st = this.currentStation;
    const inr = this.interference;
    const on = st ? 1 : 0;
    this.radioBus.gain.setTargetAtTime(on * 0.9, t, 0.2);
    if (!st) return;

    /* while a voice is on air, the music ducks under it */
    const duck = this.speaking ? 0.10 : 1;

    if (st.type === 'sokoa') {
      this.staticGain.gain.setTargetAtTime(0.05 + (1 - inr) * 0.07, t, 0.15);
      this.programGain.gain.setTargetAtTime((0.25 + inr * 0.75) * duck, t, 0.2);
      this.scheduleNumbers();
      if (this.mission && !this.speaking) {
        this.sokoaMsgTimer -= dt;
        if (this.sokoaMsgTimer <= 0) {
          this.sokoaMsgTimer = 42 + Math.random() * 10;
          this.speak(this.mission.message, 'es-ES', 0.88, 0.78);
        }
      }
      return;
    }

    const wantStatic = 0.015 + inr * 0.12 + (this.speaking ? 0.03 : 0);
    this.staticGain.gain.setTargetAtTime(wantStatic, t, 0.15);
    this.staticFilter.frequency.setTargetAtTime(600 + Math.random() * 900 + inr * 600, t, 0.4);
    this.programGain.gain.setTargetAtTime(0.85 * (1 - inr * 0.85) * duck, t, 0.2);

    /* news runs on the clock, not on songs */
    if (st.type === 'news') {
      if (this.context.hour !== this.lastBulletinHour && !this.speaking) {
        this.lastBulletinHour = this.context.hour;
        this.hourPips();
        const text = this.bulletin();
        setTimeout(() => {
          if (this.currentStation?.type === 'news') this.speak(text, 'es-ES', 0.98, 0.95);
        }, 1600);
      }
      this.scheduleNewsBed();
      return;
    }

    /* music stations: songs end, breathe, sometimes the DJ speaks */
    const pr = this.prog[st.type];
    if (pr.gapLeft > 0) {
      pr.gapLeft -= dt;
      if (pr.gapLeft <= 0) {
        pr.transpose = [0.84, 0.94, 1, 1.12, 1.26][(Math.random() * 5) | 0];
        pr.tempo = 0.85 + Math.random() * 0.35;
        pr.seed = Math.random() * 1000;
        pr.songLeft = 75 + Math.random() * 80;
        if (pr.djQueued) {
          pr.djQueued = false;
          this.jingle(st.type);
          const line = this.djLine(st);
          if (line) setTimeout(() => {
            if (this.currentStation?.type === st.type) this.speak(line, st.lang, 0.98, 0.92);
          }, 700);
        }
      }
    } else {
      pr.songLeft -= dt;
      if (pr.songLeft <= 0) {
        pr.gapLeft = 1.6 + Math.random() * 1.8;
        pr.djQueued = Math.random() < 0.45;
      } else {
        if (st.type === 'copla') this.schedulePhrygian(pr);
        if (st.type === 'waltz') this.scheduleWaltz(pr);
        if (st.type === 'herri') this.scheduleHerri(pr);
        if (st.type === 'talk') this.scheduleVoices();
      }
    }
  }

  private hourPips() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = i === 5 ? 1000 : 1000;
      const g = this.ctx.createGain();
      const t0 = t + i * 0.25;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.3, t0 + 0.01);
      g.gain.linearRampToValueAtTime(0.0001, t0 + (i === 5 ? 0.45 : 0.09));
      o.connect(g).connect(this.programGain);
      o.start(t0);
      o.stop(t0 + 0.5);
    }
  }

  /* a quiet studio bed for the news between bulletins */
  private scheduleNewsBed() {
    const ctx = this.ctx;
    if (this.nextNote < ctx.currentTime) this.nextNote = ctx.currentTime + 0.05;
    while (this.nextNote < ctx.currentTime + 0.25) {
      if (this.noteIdx % 8 === 0 && !this.speaking) {
        const f = [220, 246.9, 196][((this.noteIdx / 8) | 0) % 3];
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, this.nextNote);
        g.gain.linearRampToValueAtTime(0.10, this.nextNote + 0.3);
        g.gain.linearRampToValueAtTime(0.0001, this.nextNote + 2.4);
        o.connect(g).connect(this.programGain);
        o.start(this.nextNote);
        o.stop(this.nextNote + 2.5);
      }
      this.nextNote += 0.33;
      this.noteIdx++;
    }
  }

  /* Cadena Sur — coplas, each song in its own key and pace */
  private schedulePhrygian(pr: Programme) {
    const ctx = this.ctx;
    const base = [220.0, 233.1, 261.6, 293.7, 329.6, 349.2, 392.0];
    const line = [0, 2, 1, 0, 4, 3, 2, 1, 0, 2, 4, 5, 4, 2, 1, 0];
    if (this.nextNote < ctx.currentTime) this.nextNote = ctx.currentTime + 0.05;
    while (this.nextNote < ctx.currentTime + 0.25) {
      const step = (this.noteIdx + ((pr.seed | 0) % 7)) % line.length;
      const beat = this.noteIdx % 4 === 0;
      if (Math.random() > this.interference * 0.8) {
        const f = base[line[step]] * pr.transpose * (beat ? 0.5 : 1);
        const detune = 1 + (Math.random() - 0.5) * 0.004 * (1 + this.interference * 8);
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f * detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, this.nextNote);
        g.gain.linearRampToValueAtTime(beat ? 0.5 : 0.34, this.nextNote + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, this.nextNote + (beat ? 0.6 : 0.34));
        o.connect(g).connect(this.programGain);
        o.start(this.nextNote);
        o.stop(this.nextNote + 0.7);
      }
      this.nextNote += 0.33 * pr.tempo;
      this.noteIdx++;
    }
  }

  /* Radio Baiona — the tired accordion waltz, per-song key and tempo */
  private scheduleWaltz(pr: Programme) {
    const ctx = this.ctx;
    const roots = [110, 146.83, 164.81, 110];
    const third = [1.189, 1.189, 1.26, 1.189];
    const melody = [440, 523.25, 493.88, 440, 392, 440, 329.63, 392];
    if (this.nextBeat < ctx.currentTime) this.nextBeat = ctx.currentTime + 0.05;
    while (this.nextBeat < ctx.currentTime + 0.3) {
      const t0 = this.nextBeat;
      const bar = Math.floor(this.beatIdx / 3);
      const beat = this.beatIdx % 3;
      const root = roots[bar % 4] * pr.transpose;
      if (Math.random() > this.interference * 0.7) {
        if (beat === 0) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = root;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(0.5, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 500;
          o.connect(lp).connect(g).connect(this.programGain);
          o.start(t0); o.stop(t0 + 0.55);
          if (bar % 2 === 1) {
            const mf = melody[(bar >> 1) % melody.length] * pr.transpose;
            for (const det of [-4, 4]) {
              const m = ctx.createOscillator();
              m.type = 'sawtooth';
              m.frequency.value = mf;
              m.detune.value = det;
              const mg = ctx.createGain();
              mg.gain.setValueAtTime(0.0001, t0);
              mg.gain.linearRampToValueAtTime(0.14, t0 + 0.06);
              mg.gain.linearRampToValueAtTime(0.10, t0 + 1.1);
              mg.gain.linearRampToValueAtTime(0.0001, t0 + 1.5);
              const ml = ctx.createBiquadFilter();
              ml.type = 'lowpass';
              ml.frequency.value = 1600;
              m.connect(ml).connect(mg).connect(this.programGain);
              m.start(t0); m.stop(t0 + 1.6);
            }
          }
        } else {
          for (const mul of [2, 2 * third[bar % 4], 3]) {
            const o = ctx.createOscillator();
            o.type = 'triangle';
            o.frequency.value = root * mul;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.linearRampToValueAtTime(0.16, t0 + 0.015);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
            o.connect(g).connect(this.programGain);
            o.start(t0); o.stop(t0 + 0.3);
          }
        }
      }
      this.nextBeat += 0.55 * pr.tempo;
      this.beatIdx++;
    }
  }

  /* Herri Musika — txistu over a drone; per-song mode and pace */
  private scheduleHerri(pr: Programme) {
    const ctx = this.ctx;
    const scale = [440, 523.25, 587.33, 659.25, 783.99];
    if (this.nextFlute < ctx.currentTime) this.nextFlute = ctx.currentTime + 0.05;
    while (this.nextFlute < ctx.currentTime + 0.3) {
      const t0 = this.nextFlute;
      const dur = (0.7 + Math.random() * 0.9) * pr.tempo;
      if (Math.random() > this.interference * 0.7) {
        const f = scale[(Math.random() * scale.length) | 0] * pr.transpose;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const vib = ctx.createOscillator();
        vib.frequency.value = 5.2;
        const vg = ctx.createGain();
        vg.gain.value = f * 0.006;
        vib.connect(vg).connect(o.frequency);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.30, t0 + 0.10);
        g.gain.linearRampToValueAtTime(0.22, t0 + dur - 0.15);
        g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g).connect(this.programGain);
        o.start(t0); o.stop(t0 + dur + 0.05);
        vib.start(t0); vib.stop(t0 + dur + 0.05);
        const br = ctx.createBufferSource();
        br.buffer = this.noise;
        const bf = ctx.createBiquadFilter();
        bf.type = 'bandpass';
        bf.frequency.value = f * 2;
        bf.Q.value = 2;
        const bg = ctx.createGain();
        bg.gain.setValueAtTime(0.0001, t0);
        bg.gain.linearRampToValueAtTime(0.04, t0 + 0.08);
        bg.gain.linearRampToValueAtTime(0.0001, t0 + dur);
        br.connect(bf).connect(bg).connect(this.programGain);
        br.start(t0, Math.random(), dur + 0.05);
      }
      this.nextFlute += dur + 0.15 + Math.random() * 0.5;
    }
  }

  /* Euskal Irratia — half-heard talk between DJ idents */
  private scheduleVoices() {
    const ctx = this.ctx;
    if (this.speaking) return;
    if (this.nextSyllable < ctx.currentTime) this.nextSyllable = ctx.currentTime + 0.05;
    while (this.nextSyllable < ctx.currentTime + 0.25) {
      const pause = Math.random() < 0.16;
      if (!pause) {
        const t0 = this.nextSyllable;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const formant = ctx.createBiquadFilter();
        formant.type = 'bandpass';
        formant.frequency.value = 280 + Math.random() * 1900;
        formant.Q.value = 5;
        const muffle = ctx.createBiquadFilter();
        muffle.type = 'lowpass';
        muffle.frequency.value = 1200;
        const g = ctx.createGain();
        const dur = 0.07 + Math.random() * 0.12;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.3, t0 + dur * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
        src.connect(formant).connect(muffle).connect(g).connect(this.programGain);
        src.start(t0, Math.random(), dur + 0.05);
      }
      this.nextSyllable += pause ? 0.5 + Math.random() * 0.9 : 0.09 + Math.random() * 0.16;
    }
  }

  /* Sokoa's default programming: three tones, five numbers, again */
  private scheduleNumbers() {
    const ctx = this.ctx;
    if (this.speaking) return;
    if (this.nextNum < ctx.currentTime) this.nextNum = ctx.currentTime + 0.1;
    while (this.nextNum < ctx.currentTime + 0.3) {
      const t0 = this.nextNum;
      const step = this.numStep % 10;
      if (step < 3) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 880;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.25, t0 + 0.02);
        g.gain.linearRampToValueAtTime(0.0001, t0 + 0.14);
        o.connect(g).connect(this.programGain);
        o.start(t0); o.stop(t0 + 0.16);
        this.nextNum += 0.34;
      } else if (step === 3) {
        this.nextNum += 0.7;
      } else if (step < 9) {
        const digit = (Math.random() * 10) | 0;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const formant = ctx.createBiquadFilter();
        formant.type = 'bandpass';
        formant.frequency.value = 300 + digit * 55;
        formant.Q.value = 9;
        const muffle = ctx.createBiquadFilter();
        muffle.type = 'lowpass';
        muffle.frequency.value = 900;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.8, t0 + 0.05);
        g.gain.linearRampToValueAtTime(0.0001, t0 + 0.24);
        src.connect(formant).connect(muffle).connect(g).connect(this.programGain);
        src.start(t0, Math.random(), 0.3);
        this.nextNum += 0.46;
      } else {
        this.nextNum += 1.4;
      }
      this.numStep++;
    }
  }

  /* el pitido: two slightly sour reeds, like every old Spanish horn */
  horn(long = false) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const dur = long ? 0.8 : 0.32;
    for (const f of [420, 528]) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.006);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 0.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.setValueAtTime(0.22, t + dur - 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.06);
      o.connect(bp).connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  wiperSweep() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(250, t + 0.28);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.05);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.3);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random(), 0.32);
  }

  /* metal impact: low thud + a burst of noise + a couple of dissonant
     partials that ring briefly, scaled by severity 0..1 */
  crash(sev: number) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const v = Math.min(1, sev);
    // body thud
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.5 * v, t + 0.01);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(og).connect(this.master);
    o.start(t); o.stop(t + 0.3);
    // crunch of noise
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1600;
    bp.Q.value = 0.7;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.5 * v, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12 + v * 0.1);
    src.connect(bp).connect(ng).connect(this.master);
    src.start(t, Math.random(), 0.25);
    // ringing metal partials on a hard hit
    if (v > 0.4) {
      for (const f of [523, 622, 831]) {
        const m = this.ctx.createOscillator();
        m.type = 'triangle';
        m.frequency.value = f * (1 + (Math.random() - 0.5) * 0.03);
        const mg = this.ctx.createGain();
        mg.gain.setValueAtTime(0.0001, t);
        mg.gain.linearRampToValueAtTime(0.08 * v, t + 0.01);
        mg.gain.exponentialRampToValueAtTime(0.001, t + 0.5 + v * 0.4);
        m.connect(mg).connect(this.master);
        m.start(t); m.stop(t + 1);
      }
    }
  }

  /* tyre / metal scrape while grinding along an obstacle */
  private scrapeGain?: GainNode;
  scrape(on: boolean) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    if (on && !this.scrapeGain) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2600;
      bp.Q.value = 1.4;
      const g = this.ctx.createGain();
      g.gain.value = 0.0001;
      src.connect(bp).connect(g).connect(this.master);
      src.start();
      this.scrapeGain = g;
      (this.scrapeGain as GainNode & { _src?: AudioBufferSourceNode })._src = src;
    }
    if (this.scrapeGain) {
      this.scrapeGain.gain.setTargetAtTime(on ? 0.09 : 0.0001, t, 0.05);
    }
  }

  thunder(delaySec: number) {
    if (!this.started) return;
    const t = this.ctx.currentTime + delaySec;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(60, t + 2.5);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.4 / (1 + delaySec * 0.6), t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t, Math.random(), 3);
  }

  anomalySting() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(96, t);
    o.frequency.exponentialRampToValueAtTime(26, t + 1.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 1.9);
    for (const f of [1244, 1567, 1863]) {
      const s = this.ctx.createOscillator();
      s.type = 'sine';
      s.frequency.value = f * (1 + (Math.random() - 0.5) * 0.02);
      const sg = this.ctx.createGain();
      sg.gain.setValueAtTime(0.0001, t);
      sg.gain.linearRampToValueAtTime(0.03, t + 0.9);
      sg.gain.exponentialRampToValueAtTime(0.001, t + 1.7);
      s.connect(sg).connect(this.master);
      s.start(t);
      s.stop(t + 1.8);
    }
  }
}
