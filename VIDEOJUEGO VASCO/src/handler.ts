/* El Handler. The dashboard phone rings; a tired voice on the other end
   gives you vague directions and weighs your answers. Whether he is CNI,
   GAL, or a cell, you never quite know — the script keeps it ambiguous
   until the last call, and which ending you drift toward depends on how
   you answer.

   Three input paths, all wired to the same choices:
     - microphone (SpeechRecognition, es-ES) when the browser allows it,
     - on-screen replies (tap / keys 1-3) always,
     - subtitles so the story lands even with no speech at all. */

export interface Reply {
  text: string;
  keywords: string[];
  lean?: number;      // <0 leans "estado/CNI", >0 leans "los otros"
}
export interface Beat {
  line: string;       // what the Handler says
  replies?: Reply[];  // if present, the call waits for your answer
}

/* each call is a short exchange. lines are deliberately oblique. */
const CALLS: Beat[][] = [
  [
    { line: 'Ya has salido. Bien. No corras. En esta carretera correr llama la atención… y aquí arriba no conviene llamar la atención.' },
    {
      line: '¿Llevas el paquete contigo? El del asiento. No lo abras. Solo dime que lo llevas.',
      replies: [
        { text: 'Lo llevo.', keywords: ['sí', 'si', 'lo llevo', 'aquí', 'claro'], lean: 0 },
        { text: '¿Qué hay dentro?', keywords: ['qué', 'que', 'dentro', 'contenido', 'abrir'], lean: 1 },
        { text: '¿Quién eres?', keywords: ['quién', 'quien', 'nombre', 'eres'], lean: -1 },
      ],
    },
    { line: 'Mejor así. Cuanto menos preguntes, más largo lo tienes. Sigue hasta la muga. Cuando pases la caseta vieja, apaga las luces un momento. Sabremos que eres tú.' },
  ],
  [
    { line: 'Otra vez yo. ¿Todo tranquilo por el retrovisor? A veces la Guardia Civil pone un control donde no tocaba. A veces no es la Guardia Civil.' },
    {
      line: 'Si te dan el alto, ¿qué haces?',
      replies: [
        { text: 'Paro y colaboro.', keywords: ['paro', 'colaboro', 'papeles', 'obedezco'], lean: -1 },
        { text: 'Sigo sin parar.', keywords: ['sigo', 'no paro', 'huyo', 'acelero'], lean: 1 },
        { text: 'Lo que tú digas.', keywords: ['tú', 'tu', 'digas', 'órdenes', 'ordenes', 'mando'], lean: 0 },
      ],
    },
    { line: 'Hm. Lo tendré en cuenta. Escucha: no todo el que lleva uniforme está de tu lado, y no todo el que no lo lleva está en el mío. Tú conduce.' },
  ],
  [
    { line: 'Última parada esta noche. Vas a dejar el paquete y te vas a olvidar de mí. ¿Entendido?' },
    {
      line: 'Antes de colgar, una pregunta, y quiero la verdad. ¿Para quién crees que trabajas?',
      replies: [
        { text: 'Para el Estado.', keywords: ['estado', 'gobierno', 'cni', 'españa', 'policía', 'policia'], lean: -2 },
        { text: 'Para vosotros.', keywords: ['vosotros', 'los tuyos', 'organización', 'organizacion', 'gal'], lean: 2 },
        { text: 'No quiero saberlo.', keywords: ['no', 'saber', 'nada', 'olvidar', 'da igual'], lean: 0 },
      ],
    },
  ],
];

/* the reveal depends on the accumulated lean */
function ending(lean: number): string {
  if (lean <= -2) return 'Entonces duerme tranquilo. Lo que has movido esta noche no existe, y nosotros tampoco. Buen trabajo. Nunca hablamos.';
  if (lean >= 2) return 'Bien. Los que mandan cambian de nombre y de bandera, pero la carretera es la misma. Ya eres de los nuestros. No hay vuelta.';
  return 'No querer saber también es una respuesta. Es la que dan casi todos, al final. Sigue conduciendo. Alguien te llamará.';
}

type Phase = 'idle' | 'ringing' | 'speaking' | 'awaiting' | 'ended';

interface SR extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export class Handler {
  phase: Phase = 'idle';
  line = '';
  replies: Reply[] = [];
  micActive = false;
  micSupported = false;

  private speak: (text: string, onend: () => void) => void;
  private ring: (on: boolean) => void;
  private callIdx = 0;
  private beatIdx = 0;
  private lean = 0;
  private nextRingT = 55;          // first call, seconds into the drive
  private recog: SR | null = null;

  constructor(speak: (text: string, onend: () => void) => void, ring: (on: boolean) => void) {
    this.speak = speak;
    this.ring = ring;
    const Ctor = (window as unknown as {
      SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR;
    }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
    if (Ctor) {
      this.micSupported = true;
      try {
        this.recog = new Ctor();
        this.recog.lang = 'es-ES';
        this.recog.continuous = false;
        this.recog.interimResults = false;
      } catch { this.recog = null; this.micSupported = false; }
    }
  }

  get hasMoreCalls() { return this.callIdx < CALLS.length; }

  /* debug: make the phone ring right now */
  debugRingNow() { this.nextRingT = 0.01; }

  update(dt: number, canRing: boolean) {
    if (this.phase === 'idle' && canRing && this.hasMoreCalls) {
      this.nextRingT -= dt;
      if (this.nextRingT <= 0) {
        this.phase = 'ringing';
        this.ring(true);
      }
    }
  }

  /* answer the ringing phone */
  answer() {
    if (this.phase !== 'ringing') return;
    this.ring(false);
    this.beatIdx = 0;
    this.playBeat();
  }

  /* dismiss a ringing phone (it will try again later) */
  ignore() {
    if (this.phase !== 'ringing') return;
    this.ring(false);
    this.phase = 'idle';
    this.nextRingT = 40 + Math.random() * 30;
  }

  private playBeat() {
    const call = CALLS[this.callIdx];
    const beat = call[this.beatIdx];
    this.phase = 'speaking';
    this.line = beat.line;
    this.replies = [];
    this.stopMic();
    this.speak(beat.line, () => {
      if (beat.replies && beat.replies.length) {
        this.replies = beat.replies;
        this.phase = 'awaiting';
        this.startMic();
      } else {
        this.beatIdx++;
        if (this.beatIdx < call.length) {
          setTimeout(() => this.playBeat(), 700);
        } else {
          this.endCall();
        }
      }
    });
  }

  /* choose reply by index (tap / keys) */
  choose(i: number) {
    if (this.phase !== 'awaiting') return;
    const r = this.replies[i];
    if (!r) return;
    this.lean += r.lean ?? 0;
    this.stopMic();
    this.replies = [];
    this.beatIdx++;
    const call = CALLS[this.callIdx];
    if (this.beatIdx < call.length) {
      this.phase = 'speaking';
      setTimeout(() => this.playBeat(), 500);
    } else {
      this.endCall();
    }
  }

  private endCall() {
    // the last call gets the reveal line appended
    if (this.callIdx === CALLS.length - 1) {
      this.phase = 'speaking';
      this.line = ending(this.lean);
      this.speak(this.line, () => { this.finish(); });
      this.callIdx++;
      return;
    }
    this.callIdx++;
    this.nextRingT = 90 + Math.random() * 60;
    this.finish();
  }

  private finish() {
    this.phase = 'idle';
    this.line = '';
    this.replies = [];
    this.stopMic();
  }

  /* match a spoken transcript against the current replies' keywords */
  private matchReply(text: string): number {
    const t = text.toLowerCase();
    let best = -1, bestScore = 0;
    this.replies.forEach((r, i) => {
      let score = 0;
      for (const k of r.keywords) if (t.includes(k)) score++;
      if (score > bestScore) { bestScore = score; best = i; }
    });
    return best;
  }

  private startMic() {
    if (!this.recog) return;
    this.recog.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      const idx = this.matchReply(transcript);
      if (idx >= 0) this.choose(idx);
    };
    this.recog.onerror = () => { this.micActive = false; };
    this.recog.onend = () => { this.micActive = false; };
    try { this.recog.start(); this.micActive = true; } catch { this.micActive = false; }
  }
  private stopMic() {
    this.micActive = false;
    if (this.recog) { try { this.recog.abort(); } catch { /* noop */ } }
  }
}
