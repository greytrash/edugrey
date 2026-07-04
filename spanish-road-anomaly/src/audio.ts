/* All-procedural WebAudio: engine, rain, tires, wipers, and a car radio
   whose stations dissolve into interference as the anomaly approaches. */

export type RadioMode = 'off' | 'static' | 'music' | 'voices';
const RADIO_ORDER: RadioMode[] = ['off', 'static', 'music', 'voices'];

export const RADIO_LABEL: Record<RadioMode, string> = {
  off: 'radio off',
  static: '87.6 MHz · estática',
  music: '98.2 MHz · Cadena Sur',
  voices: '103.1 MHz · voces',
};

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

  private rainGain!: GainNode;
  private hissGain!: GainNode;   // wet tires
  private rumbleGain!: GainNode; // off-road
  private skidGain!: GainNode;   // handbrake

  private radioBus!: GainNode;
  private staticGain!: GainNode;
  private staticFilter!: BiquadFilterNode;
  private musicGain!: GainNode;
  private voiceGain!: GainNode;

  radioMode: RadioMode = 'off';
  interference = 0;

  private nextNote = 0;
  private noteIdx = 0;
  private nextSyllable = 0;

  start() {
    if (this.started) return;
    this.started = true;
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);
    this.noise = makeNoiseBuffer(ctx);

    /* engine: saw + sub-octave sine through a dull lowpass */
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

    /* looped noise feeding rain / tire hiss / rumble / skid shapers */
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

    /* radio bus: everything squeezed through an AM-ish bandpass */
    const am = ctx.createBiquadFilter();
    am.type = 'bandpass';
    am.frequency.value = 1100;
    am.Q.value = 0.55;
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

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(am);

    this.voiceGain = ctx.createGain();
    this.voiceGain.gain.value = 0;
    this.voiceGain.connect(am);
  }

  cycleRadio(): RadioMode {
    this.radioMode = RADIO_ORDER[(RADIO_ORDER.indexOf(this.radioMode) + 1) % RADIO_ORDER.length];
    if (this.started) {
      // small tuning chirp on every twist of the dial
      const t = this.ctx.currentTime;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.connect(g).connect(this.master);
      src.start(t, Math.random(), 0.15);
    }
    return this.radioMode;
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

  /* the moment the road folds back on itself */
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

    // shimmer cluster fading in above it, slightly wrong
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
    const k = p.speed / p.maxSpeed;

    this.engOsc.frequency.setTargetAtTime(52 + k * 96, t, 0.08);
    this.engSub.frequency.setTargetAtTime(26 + k * 48, t, 0.08);
    this.engGain.gain.setTargetAtTime(0.035 + k * 0.05 + (p.throttle ? 0.035 : 0), t, 0.1);

    this.rainGain.gain.setTargetAtTime(0.035 + p.rain * 0.045, t, 0.3);
    this.hissGain.gain.setTargetAtTime(k * 0.05, t, 0.2);
    this.rumbleGain.gain.setTargetAtTime(p.offroad ? 0.10 + k * 0.12 : 0, t, 0.05);
    this.skidGain.gain.setTargetAtTime(p.handbrake && k > 0.15 ? 0.06 : 0, t, 0.05);

    /* radio: interference pulls every station down into the static */
    const inr = this.interference;
    const on = this.radioMode !== 'off' ? 1 : 0;
    this.radioBus.gain.setTargetAtTime(on * 0.9, t, 0.2);
    const wantStatic = this.radioMode === 'static' ? 0.10 : 0.02 + inr * 0.12;
    this.staticGain.gain.setTargetAtTime(on * wantStatic, t, 0.15);
    this.staticFilter.frequency.setTargetAtTime(600 + Math.random() * 900 + inr * 600, t, 0.4);
    this.musicGain.gain.setTargetAtTime(this.radioMode === 'music' ? 0.75 * (1 - inr * 0.85) : 0, t, 0.2);
    this.voiceGain.gain.setTargetAtTime(this.radioMode === 'voices' ? 0.9 * (1 - inr * 0.6) : 0, t, 0.2);

    if (this.radioMode === 'music') this.scheduleMusic();
    if (this.radioMode === 'voices') this.scheduleVoices();
  }

  /* sparse Phrygian plucks — a sad coplilla heard through one bad speaker */
  private scheduleMusic() {
    const ctx = this.ctx;
    const scale = [220.0, 233.1, 261.6, 293.7, 329.6, 349.2, 392.0]; // A Phrygian
    const line = [0, 2, 1, 0, 4, 3, 2, 1, 0, 2, 4, 5, 4, 2, 1, 0];
    if (this.nextNote < ctx.currentTime) this.nextNote = ctx.currentTime + 0.05;
    while (this.nextNote < ctx.currentTime + 0.25) {
      const step = this.noteIdx % line.length;
      const beat = this.noteIdx % 4 === 0;
      // interference eats notes
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
        o.connect(g).connect(this.musicGain);
        o.start(this.nextNote);
        o.stop(this.nextNote + 0.7);
      }
      this.nextNote += 0.33;
      this.noteIdx++;
    }
  }

  /* half-heard talk: syllable-shaped noise bursts wandering through formants */
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
        src.connect(formant).connect(muffle).connect(g).connect(this.voiceGain);
        src.start(t0, Math.random(), dur + 0.05);
      }
      this.nextSyllable += pause ? 0.5 + Math.random() * 0.9 : 0.09 + Math.random() * 0.16;
    }
  }
}
