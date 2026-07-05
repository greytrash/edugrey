/* All-procedural WebAudio. The radio is the game's spine: five stations on
   the dial, three languages, and one frequency that should not be there.
   As the fold approaches, every honest station drowns in static — and the
   numbers station at 66.6 comes up out of it, clearer the worse things get. */

export interface Station {
  freq: string;
  name: string;
  type: 'static' | 'voices' | 'waltz' | 'phrygian' | 'flute' | 'numbers';
}

const STATIONS: Station[] = [
  { freq: '87.6',  name: 'estática',       type: 'static' },
  { freq: '88.1',  name: 'Euskal Irratia', type: 'voices' },
  { freq: '94.3',  name: 'Radio Baiona',   type: 'waltz' },
  { freq: '98.2',  name: 'Cadena Sur',     type: 'phrygian' },
  { freq: '103.7', name: 'Herri Musika',   type: 'flute' },
  { freq: '66.6',  name: '· · ·',          type: 'numbers' },
];

function makeNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
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
  private staticGain!: GainNode;
  private staticFilter!: BiquadFilterNode;
  private programGain!: GainNode;

  radioIndex = -1;                 // -1 = off
  numbersUnlocked = false;
  interference = 0;

  private nextNote = 0;
  private noteIdx = 0;
  private nextSyllable = 0;
  private nextBeat = 0;
  private beatIdx = 0;
  private nextFlute = 0;
  private nextNum = 0;
  private numStep = 0;

  get stations(): Station[] {
    return this.numbersUnlocked ? STATIONS : STATIONS.filter(s => s.type !== 'numbers');
  }
  get currentStation(): Station | null {
    return this.radioIndex < 0 ? null : this.stations[this.radioIndex] ?? null;
  }

  start() {
    if (this.started) return;
    this.started = true;
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);
    this.noise = makeNoiseBuffer(ctx);

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
    // reverse-gear whine
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

    /* radio bus through an AM-ish bandpass */
    const am = ctx.createBiquadFilter();
    am.type = 'bandpass';
    am.frequency.value = 1100;
    am.Q.value = 0.55;
    this.radioBus = ctx.createGain();
    this.radioBus.gain.value = 0;
    am.connect(this.radioBus).connect(this.master);
    this.amNode = am;

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
  private amNode!: BiquadFilterNode;

  cycleRadio(): Station | null {
    const n = this.stations.length;
    this.radioIndex = this.radioIndex >= n - 1 ? -1 : this.radioIndex + 1;
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

    this.rainGain.gain.setTargetAtTime(0.02 + p.rain * 0.06, t, 0.4);
    this.hissGain.gain.setTargetAtTime(k * (0.02 + p.rain * 0.04), t, 0.2);
    this.rumbleGain.gain.setTargetAtTime(p.offroad ? 0.10 + k * 0.12 : 0, t, 0.05);
    this.skidGain.gain.setTargetAtTime(p.handbrake && k > 0.15 ? 0.06 : 0, t, 0.05);

    /* radio */
    const st = this.currentStation;
    const inr = this.interference;
    const on = st ? 1 : 0;
    this.radioBus.gain.setTargetAtTime(on * 0.9, t, 0.2);
    if (!st) return;

    if (st.type === 'numbers') {
      // the wrong station: interference is its carrier
      this.staticGain.gain.setTargetAtTime(0.05 + (1 - inr) * 0.07, t, 0.15);
      this.programGain.gain.setTargetAtTime(0.25 + inr * 0.75, t, 0.2);
      this.scheduleNumbers();
      return;
    }

    const wantStatic = st.type === 'static' ? 0.10 : 0.015 + inr * 0.12;
    this.staticGain.gain.setTargetAtTime(wantStatic, t, 0.15);
    this.staticFilter.frequency.setTargetAtTime(600 + Math.random() * 900 + inr * 600, t, 0.4);
    this.programGain.gain.setTargetAtTime(st.type === 'static' ? 0 : 0.85 * (1 - inr * 0.85), t, 0.2);

    if (st.type === 'phrygian') this.schedulePhrygian();
    if (st.type === 'voices') this.scheduleVoices();
    if (st.type === 'waltz') this.scheduleWaltz();
    if (st.type === 'flute') this.scheduleFlute();
  }

  /* Cadena Sur — the sad coplilla through one bad speaker */
  private schedulePhrygian() {
    const ctx = this.ctx;
    const scale = [220.0, 233.1, 261.6, 293.7, 329.6, 349.2, 392.0];
    const line = [0, 2, 1, 0, 4, 3, 2, 1, 0, 2, 4, 5, 4, 2, 1, 0];
    if (this.nextNote < ctx.currentTime) this.nextNote = ctx.currentTime + 0.05;
    while (this.nextNote < ctx.currentTime + 0.25) {
      const step = this.noteIdx % line.length;
      const beat = this.noteIdx % 4 === 0;
      if (Math.random() > this.interference * 0.8) {
        const f = scale[line[step]] * (beat ? 0.5 : 1);
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
      this.nextNote += 0.33;
      this.noteIdx++;
    }
  }

  /* Radio Baiona — a tired accordion waltz drifting over the border */
  private scheduleWaltz() {
    const ctx = this.ctx;
    const roots = [110, 146.83, 164.81, 110];        // Am Dm E Am
    const third = [1.189, 1.189, 1.26, 1.189];       // minor / minor / major / minor
    const melody = [440, 523.25, 493.88, 440, 392, 440, 329.63, 392];
    if (this.nextBeat < ctx.currentTime) this.nextBeat = ctx.currentTime + 0.05;
    while (this.nextBeat < ctx.currentTime + 0.3) {
      const t0 = this.nextBeat;
      const bar = Math.floor(this.beatIdx / 3);
      const beat = this.beatIdx % 3;
      const root = roots[bar % 4];
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
          if (bar % 2 === 1) {                       // melody phrase
            const mf = melody[(bar >> 1) % melody.length];
            for (const det of [-4, 4]) {             // accordion double reed
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
        } else {                                     // oom-pah chord stab
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
      this.nextBeat += 0.55;
      this.beatIdx++;
    }
  }

  /* Herri Musika — a lone txistu over drone, pentatonic and patient */
  private scheduleFlute() {
    const ctx = this.ctx;
    const scale = [440, 523.25, 587.33, 659.25, 783.99];
    if (this.nextFlute < ctx.currentTime) this.nextFlute = ctx.currentTime + 0.05;
    while (this.nextFlute < ctx.currentTime + 0.3) {
      const t0 = this.nextFlute;
      const dur = 0.7 + Math.random() * 0.9;
      if (Math.random() > this.interference * 0.7) {
        const f = scale[(Math.random() * scale.length) | 0];
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
        // breath
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

  /* Euskal Irratia — half-heard talk, formants wandering */
  private scheduleVoices() {
    const ctx = this.ctx;
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

  /* 66.6 — three tones, five numbers, again. It is reading them to someone. */
  private scheduleNumbers() {
    const ctx = this.ctx;
    if (this.nextNum < ctx.currentTime) this.nextNum = ctx.currentTime + 0.1;
    while (this.nextNum < ctx.currentTime + 0.3) {
      const t0 = this.nextNum;
      const step = this.numStep % 10;
      if (step < 3) {                                // three marker tones
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
        this.nextNum += 0.7;                          // breath before the digits
      } else if (step < 9) {                          // five spoken digits
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
        this.nextNum += 1.4;                          // long silence, then again
      }
      this.numStep++;
    }
  }
}
