import * as THREE from 'three';
import './style.css';
import { World, ROAD_HALF } from './world';
import { GameAudio } from './audio';
import { sampleDay } from './daycycle';
import { MiniMap } from './map';
import { Weather } from './weather';
import { Handler } from './handler';
import { CYCLE_LEN, VILLAGES, DEST, MISSIONS } from './route';

/* ---------------------------------------------------------------- anomaly */
const CAPTIONS = [
  '',
  '¿no habíamos pasado ya por aquí?',
  'donibane no se acerca.',
  'gaua ez da bukatzen.',
  'no mires el retrovisor.',
];

function hash(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
function reverse(str: string) { return str.split('').reverse().join(''); }

let cycle = 0;

function distanceSign(s: number): { l1: string; l2: string } {
  const c = Math.floor(s / CYCLE_LEN);
  const cs = s % CYCLE_LEN;
  const next = VILLAGES.find(v => v.s > cs + 60) ?? VILLAGES[0];
  let km1 = Math.max(1, Math.round((next.s - cs) / 1000));
  let name = next.name;
  let dest = `${DEST} ${45 + c}`;
  const r = hash(Math.floor(s));
  if (c >= 1 && r < 0.18) km1 += 1;
  if (c >= 2 && r > 0.86) return { l1: name + ' ' + km1, l2: 'EZ DA EXISTITZEN' };
  if (c >= 3) {
    if (r < 0.22) name = reverse(name);
    if (r > 0.90) dest = `${DEST} ∞`;
    else if (r > 0.76) dest = `${DEST} ${-(45 + c)}`;
  }
  return { l1: `${name} ${km1}`, l2: dest };
}

function kmMarker(s: number): { road: string; km: string } {
  const c = Math.floor(s / CYCLE_LEN);
  const cs = s % CYCLE_LEN;
  const fr = cs > 23000;
  if (c >= 2) return { road: fr ? 'D 4' : 'N-121-B', km: '13' };
  const km = fr ? 1 + Math.floor((cs - 23000) / 1000) : 8 + Math.floor(cs / 1000);
  return { road: fr ? 'D 4' : 'N-121-B', km: `${km}` };
}

function villageEntry(routeIdx: number): { name: string; alt: string } {
  const v = VILLAGES[routeIdx % VILLAGES.length];
  const c = Math.floor(routeIdx / VILLAGES.length);
  const r = hash(routeIdx * 17 + 3);
  let name = v.name, alt = v.alt;
  if (c >= 2 && r > 0.75) { name = reverse(name); alt = ''; }
  if (c >= 3 && r < 0.2) { name = 'EZ DA'; alt = 'existitzen'; }
  return { name, alt };
}

/* ------------------------------------------------------------------ setup */
const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({
  antialias: true, powerPreference: 'high-performance',
  preserveDrawingBuffer: true,     // lens droplets sample the rendered frame
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const world = new World({ distanceSign, kmMarker, villageEntry });
world.bindRenderer(renderer);
const audio = new GameAudio();
const map = new MiniMap();
const weather = new Weather();

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.08, 900);
world.scene.add(camera);
camera.add(world.rainObject);
world.attachSky(camera);

/* overlay canvas */
const overlay = document.createElement('canvas');
overlay.id = 'overlay';
document.body.appendChild(overlay);
const octx = overlay.getContext('2d')!;
let wet = document.createElement('canvas');
let wctx = wet.getContext('2d')!;

/* HUD */
const hud = document.createElement('div');
hud.id = 'hud';
hud.innerHTML =
  '<div class="row"><span id="spd">0</span> km/h</div>' +
  '<div class="row dim">odómetro <span id="odo"></span></div>' +
  '<div class="row" id="radio-row">radio off</div>' +
  '<div class="row" id="mission-row"></div>' +
  '<div class="row dim" id="state-row"></div>';
document.body.appendChild(hud);
const caption = document.createElement('div');
caption.id = 'caption';
document.body.appendChild(caption);
for (const id of ['grain', 'vignette']) {
  const d = document.createElement('div');
  d.id = id;
  document.body.appendChild(d);
}
/* dashboard phone: subtitle bar + reply buttons, shared by voice and keys */
const phone = document.createElement('div');
phone.id = 'phone';
phone.innerHTML = '<div id="phone-line"></div><div id="phone-replies"></div>';
document.body.appendChild(phone);

/* the Handler speaks low, slow and tired; without TTS the line is read time */
const handler = new Handler(
  (text, onend) => {
    // reading-time fallback races the TTS so a stuck utterance never hangs the call
    let done = false;
    const finish = () => { if (!done) { done = true; onend(); } };
    if (audio.ttsReady) {
      audio.speak(text, 'es-ES', 0.86, 0.55, finish);
      setTimeout(finish, 3200 + text.length * 95);
    } else {
      setTimeout(finish, 1600 + text.length * 45);
    }
  },
  (on) => audio.ring(on),
);

/* horn button: works with touch and mouse */
const hornBtn = document.createElement('button');
hornBtn.id = 'horn';
hornBtn.textContent = 'CLAXON';
hornBtn.setAttribute('aria-label', 'bocina');
document.body.appendChild(hornBtn);

const $ = (id: string) => document.getElementById(id)!;

function sizeAll() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  world.sizeSky(camera);
  const dpr = Math.min(devicePixelRatio, 2);
  overlay.width = innerWidth * dpr;
  overlay.height = innerHeight * dpr;
  overlay.style.width = innerWidth + 'px';
  overlay.style.height = innerHeight + 'px';
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wet.width = Math.floor(innerWidth / 2);
  wet.height = Math.floor(innerHeight / 2);
  wctx = wet.getContext('2d')!;
}
sizeAll();
addEventListener('resize', sizeAll);

/* ---------------------------------------------------------------- states */
type GameState = 'menu' | 'driving' | 'paused';
let state: GameState = 'menu';
let everStarted = false;

const intro = document.getElementById('intro')!;
const introSmall = intro.querySelector('.small') as HTMLElement;

function toMenu() {
  state = 'menu';
  intro.classList.remove('hidden');
  introSmall.textContent = everStarted
    ? (isTouch ? 'toca para seguir conduciendo' : 'ENTER · seguir conduciendo')
    : (isTouch ? 'toca la pantalla para conducir' : 'Press any key to start audio and drive.');
  audio.suspend();
  map.setBig(false);
}
function toDriving() {
  state = 'driving';
  intro.classList.add('hidden');
  if (!everStarted) {
    everStarted = true;
    audio.start();
  }
  audio.resume();
  map.setBig(false);
  caption.classList.remove('show');
}
function toPaused() {
  state = 'paused';
  audio.suspend();
  map.setBig(true);
  showCaption('pausa — el mapa sobre el volante', 2400);
}

/* ------------------------------------------------------- touch controls */
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

function holdButton(el: HTMLElement, key: string) {
  const down = (e: PointerEvent) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.classList.add('held');
    keys[key] = true;
  };
  const up = () => { el.classList.remove('held'); keys[key] = false; };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
}

/* thin vector chevron for the steering pads — no emoji, just a stroke */
function chevron(dir: -1 | 1): string {
  const d = dir < 0 ? 'M16 6 L8 16 L16 26' : 'M8 6 L16 16 L8 26';
  return `<svg viewBox="0 0 24 32" aria-hidden="true"><path d="${d}"/></svg>`;
}

function buildTouchControls() {
  document.body.classList.add('touch');
  const wrap = document.createElement('div');
  wrap.id = 'touch';
  wrap.innerHTML =
    '<div class="tc-chips">' +
    '<button data-act="escape">MENÚ</button>' +
    '<button data-act="p">PAUSA</button>' +
    '<button data-act="m">MAPA</button>' +
    '<button data-act="r">RADIO</button>' +
    '<button data-act="c">CÁMARA</button>' +
    '<button data-act="l">LUCES</button>' +
    '<button data-act="v">LIMPIA</button>' +
    '</div>' +
    '<div class="tc-steer">' +
    `<button id="tc-left" aria-label="izquierda">${chevron(-1)}</button>` +
    `<button id="tc-right" aria-label="derecha">${chevron(1)}</button>` +
    '</div>' +
    '<div class="tc-pedals">' +
    '<button id="tc-hand" aria-label="freno de mano"><span>P</span></button>' +
    '<button id="tc-brake" aria-label="freno y marcha atrás">FRENO</button>' +
    '<button id="tc-gas" aria-label="acelerar">ACEL</button>' +
    '</div>';
  document.body.appendChild(wrap);
  holdButton(wrap.querySelector('#tc-left')!, 'a');
  holdButton(wrap.querySelector('#tc-right')!, 'd');
  holdButton(wrap.querySelector('#tc-gas')!, 'w');
  holdButton(wrap.querySelector('#tc-brake')!, 's');
  holdButton(wrap.querySelector('#tc-hand')!, ' ');
  for (const b of wrap.querySelectorAll<HTMLElement>('.tc-chips button')) {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      doAction(b.dataset.act!);
    });
  }
}

/* el pitido — exposed globally, wired to keyboard H and the touch button */
function pitido(long = false) {
  audio.horn(long);
}
(window as unknown as { pitido: typeof pitido }).pitido = pitido;
// debug handle for scene inspection
(window as unknown as { __dbg: unknown }).__dbg = {
  scene: world.scene, getS: () => s, world,
  setS: (v: number) => { s = v; },
  setT: (v: number) => { tDay = v; },
  setDamage: (v: number) => { damage = v; },
  getDamage: () => damage,
  setLane: (v: number) => { laneX = v; },
};
hornBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (state === 'driving') pitido(); });

/* ------------------------------------------------------------------ input */
const keys: Record<string, boolean> = {};
let interior = false;
let wipers = true;

function radioRowText(): string {
  const st = audio.currentStation;
  return st ? `radio · ${st.freq} MHz · ${st.name}` : 'radio off';
}

/* one action switch shared by keyboard and touch chips */
function doAction(k: string) {
  if (k === 'escape') {
    if (state !== 'menu') toMenu();
    return;
  }
  if (state === 'menu') {
    if (k !== 'p') toDriving();
    return;
  }
  if (k === 'p') {
    state === 'paused' ? toDriving() : toPaused();
    return;
  }
  if (state === 'paused') return;
  if (k === 'c') interior = !interior;
  if (k === 'l') world.headlightsOn = !world.headlightsOn;
  if (k === 'v') wipers = !wipers;
  if (k === 'm') map.toggle();
  if (k === 'h') pitido();
  if (k === 'r') { audio.cycleRadio(); $('radio-row').textContent = radioRowText(); }
  if (k === 't') handler.answer();
  if (k === '1' || k === '2' || k === '3') handler.choose(parseInt(k) - 1);
}

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['escape', 'p'].includes(k) || state === 'menu') { doAction(k); return; }
  if (state === 'paused') return;
  if (k === ' ') e.preventDefault();
  if (keys[k]) return;
  keys[k] = true;
  doAction(k);
  if (k === '9') s += CYCLE_LEN - (s % CYCLE_LEN) - 150;
  if (k === '8') s += 1500;
  if (k === '0') tDay = (tDay + 0.06) % 1;
  if (k === '7') showCaption('tiempo: ' + weather.force(), 2000);
  if (k === '6') handler.debugRingNow();
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

/* tapping the menu card starts the drive (mouse and touch alike) */
intro.addEventListener('pointerdown', () => { if (state === 'menu') toDriving(); });

/* tapping the phone bar answers a ringing call */
phone.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (handler.phase === 'ringing') handler.answer();
});

/* keep the phone overlay in sync with the Handler's state */
let phoneSig = '';
function syncPhoneUI() {
  const lineEl = $('phone-line');
  const repEl = $('phone-replies');
  const sig = handler.phase + '|' + handler.line + '|' + handler.replies.map(r => r.text).join(';') + '|' + (handler.micActive ? 'm' : '');
  if (sig === phoneSig) return;
  phoneSig = sig;
  phone.className = handler.phase === 'idle' || handler.phase === 'ended' ? '' : 'on ' + handler.phase;
  if (handler.phase === 'ringing') {
    lineEl.textContent = isTouch ? 'el teléfono del salpicadero suena — toca para contestar' : 'el teléfono del salpicadero suena — T para contestar';
    repEl.innerHTML = '';
  } else if (handler.phase === 'speaking') {
    lineEl.textContent = '»  ' + handler.line;
    repEl.innerHTML = '';
  } else if (handler.phase === 'awaiting') {
    lineEl.textContent = '»  ' + handler.line + (handler.micActive ? '   [mic]' : '');
    repEl.innerHTML = '';
    handler.replies.forEach((r, i) => {
      const b = document.createElement('button');
      b.textContent = `${i + 1}. ${r.text}`;
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); handler.choose(i); });
      repEl.appendChild(b);
    });
  } else {
    lineEl.textContent = '';
    repEl.innerHTML = '';
  }
}

/* -------------------------------------------------------------- car state */
const MAX_SPEED = 33;
const MAX_REVERSE = 8;
const DAY_LEN = 3600;                      // 24 game-hours = 1 real hour
let s = 0;
let speed = 0;
let prevSpeed = 0;
let laneX = 1.7;
let laneV = 0;
let steer = 0;
let shake = 0;
let tDay = 0.76;
let now = 0;

/* suspension + body dynamics */
let bodyY = 0;
let bodyVy = 0;
let pitch = 0;
let roll = 0;
let wheelSpin = 0;

/* chassis damage: accumulates on impacts, pulls the steering, cracks glass */
let damage = 0;
let pullDir = 0;
let crackX = 0.5, crackY = 0.4;
let scraping = false;
let repairing = false;

/* per-frame accelerations, shared with the cockpit props (package, keys) */
let gLat = 0, gLong = 0;

/* free look with the mouse (desktop): cursor position maps to a gaze offset */
let lookX = 0, lookY = 0, lookTX = 0, lookTY = 0;
addEventListener('mousemove', (e) => {
  if (!matchMedia('(pointer: fine)').matches) return;
  lookTX = (e.clientX / innerWidth) * 2 - 1;
  lookTY = (e.clientY / innerHeight) * 2 - 1;
});

/* the package is loose on the seat: it slides, tips and thumps */
let pkgX = 0, pkgVx = 0, pkgRot = -0.06, pkgThumpT = 0;

/* anomaly + mission bookkeeping */
let gasCaptionCycle = -1;
let borderCaptionShown = false;
let dawnBlockedShown = false;
let missionIdx = 0;
let missionState: 'idle' | 'broadcast' | 'revealed' = 'idle';
let missionArmTimer = 40;
let listenT = 0;
let entregas = 0;
let captionTimer: ReturnType<typeof setTimeout> | undefined;

function showCaption(text: string, ms = 3800) {
  caption.textContent = text;
  caption.classList.add('show');
  if (captionTimer) clearTimeout(captionTimer);
  captionTimer = setTimeout(() => caption.classList.remove('show'), ms);
}

function runGlitch() {
  const b = document.body;
  const steps: Array<[number, string, boolean]> = [
    [0, 'glitch', true], [90, 'glitch', false],
    [170, 'glitch2', true], [260, 'glitch2', false],
    [400, 'glitch', true], [470, 'glitch', false],
  ];
  for (const [t, cls, on] of steps) {
    setTimeout(() => b.classList.toggle(cls, on), t);
  }
  shake = Math.max(shake, 1);
  world.flickerHeadlights(1.1);
  audio.anomalySting();
}

/* --------------------------------------------------------------- missions */
function updateMissions(dt: number) {
  const m = MISSIONS[missionIdx % MISSIONS.length];
  if (missionState === 'idle') {
    missionArmTimer -= dt;
    if (missionArmTimer <= 0) {
      missionState = 'broadcast';
      listenT = 0;
      audio.setMission(m);
    }
    return;
  }
  if (missionState === 'broadcast') {
    if (audio.currentStation?.type === 'sokoa') {
      listenT += dt;
      if (listenT > 11) {                 // you have heard enough to know
        missionState = 'revealed';
        map.setMission(m.targetS, m.label);
        showCaption('sokoa: mensaje recibido. mira el mapa.', 4200);
      }
    }
  }
  {
    const cs = s % CYCLE_LEN;
    if (Math.abs(cs - m.targetS) < 70 && Math.abs(speed) < 12) {
      missionState = 'idle';
      missionArmTimer = 90 + Math.random() * 40;
      missionIdx++;
      entregas++;
      map.clearMission();
      audio.clearMission(m.ack);
      showCaption('entrega realizada.', 4200);
    }
  }
}

/* ------------------------------------------------------- lens droplets ---
   GoPro-style: drops sit on the lens, refract the rendered frame (sampled
   from the WebGL canvas), catch a highlight, then slide and dry off. */
interface LensDrop { x: number; y: number; r: number; life: number; vy: number }
const lensDrops: LensDrop[] = [];

function drawLensDrops(dt: number, rainI: number, isInterior: boolean) {
  const w = innerWidth, h = innerHeight;
  const rate = rainI * (isInterior ? 0.8 : 3.2);
  if (lensDrops.length < 16 && Math.random() < rate * dt) {
    lensDrops.push({
      x: Math.random() * w,
      y: Math.random() * h * 0.85,
      r: 5 + Math.random() * 15,
      life: 1,
      vy: 0,
    });
  }
  const src = renderer.domElement;
  const sw = src.width / w, sh = src.height / h;   // css px → backing px
  for (let i = lensDrops.length - 1; i >= 0; i--) {
    const d = lensDrops[i];
    d.life -= dt * 0.10;
    if (d.r > 10) { d.vy += 14 * dt; d.y += d.vy * dt; }        // big drops run
    else { d.y += 2 * dt; }
    if (d.life <= 0 || d.y > h + 20) { lensDrops.splice(i, 1); continue; }
    const a = Math.min(1, d.life * 2.2);
    octx.save();
    octx.beginPath();
    octx.arc(d.x, d.y, d.r, 0, 7);
    octx.clip();
    // refraction: the world inside the drop, magnified and pushed down
    try {
      const mag = 2.1, R = d.r;
      octx.globalAlpha = 0.9 * a;
      octx.drawImage(
        src,
        (d.x - R * mag) * sw, (d.y - R * mag * 0.7) * sh, R * 2 * mag * sw, R * 2 * mag * sh,
        d.x - R, d.y - R, R * 2, R * 2,
      );
    } catch { /* canvas not samplable: skip refraction, keep the glass */ }
    // glass shading: darker meniscus edge, bright top-left catchlight
    octx.globalAlpha = a;
    const rim = octx.createRadialGradient(d.x, d.y, d.r * 0.55, d.x, d.y, d.r);
    rim.addColorStop(0, 'rgba(255,255,255,0)');
    rim.addColorStop(0.85, 'rgba(30,35,42,0.25)');
    rim.addColorStop(1, 'rgba(15,18,24,0.5)');
    octx.fillStyle = rim;
    octx.fillRect(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
    octx.fillStyle = 'rgba(255,255,255,0.5)';
    octx.beginPath();
    octx.ellipse(d.x - d.r * 0.38, d.y - d.r * 0.42, d.r * 0.18, d.r * 0.10, -0.6, 0, 7);
    octx.fill();
    octx.restore();
    // wet streak trailed above a running drop
    if (d.r > 10 && d.vy > 2) {
      octx.strokeStyle = `rgba(190,200,215,${0.10 * a})`;
      octx.lineWidth = d.r * 0.5;
      octx.lineCap = 'round';
      octx.beginPath();
      octx.moveTo(d.x, d.y - d.r * 3.2);
      octx.lineTo(d.x, d.y - d.r);
      octx.stroke();
    }
  }
}

/* --------------------------------------------------------------- wipers 2D */
let wiperPhase = 0;
let wiperDir = 1;

/* little pendulums: ignition keys and the pine air freshener swing with
   the car's lateral motion and the bumps */
let keyA = 0, keyV = 0;
let freshA = 0, freshV = 0;

/* vinyl grain for the dash, generated once */
const vinylPattern = (() => {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 96;
  const x = c.getContext('2d')!;
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(${180 + Math.random() * 60},${170 + Math.random() * 60},${150 + Math.random() * 60},${0.03 + Math.random() * 0.05})`;
    x.fillRect(Math.random() * 96, Math.random() * 96, 1.4, 1);
  }
  return c;
})();

function bladeAngle(phase: number, from: number, to: number) {
  const e = 0.5 - 0.5 * Math.cos(phase * Math.PI);
  return from + (to - from) * e;
}

function drawInterior(dt: number, inr: number, rainI: number, darkness: number, inTunnel: boolean, hourStr: string, dmg: number) {
  const w = innerWidth, h = innerHeight;

  const ww = wet.width, wh = wet.height;
  wctx.globalCompositeOperation = 'destination-out';
  wctx.fillStyle = 'rgba(0,0,0,0.012)';
  wctx.fillRect(0, 0, ww, wh);
  wctx.globalCompositeOperation = 'source-over';
  const spawn = inTunnel ? 0 : (1 + Math.abs(speed) * 0.12) * (0.3 + rainI * 1.4);
  for (let i = 0; i < spawn; i++) {
    if (Math.random() > 0.82) {
      const x0 = Math.random() * ww, y0 = Math.random() * wh * 0.6;
      wctx.strokeStyle = 'rgba(200,214,228,0.30)';
      wctx.lineWidth = 1.2;
      wctx.beginPath();
      wctx.moveTo(x0, y0);
      wctx.lineTo(x0 + (Math.random() - 0.5) * 4, y0 + 8 + Math.random() * 24);
      wctx.stroke();
    } else {
      const r = 0.7 + Math.random() * 2.1;
      const dx = Math.random() * ww, dy = Math.random() * wh;
      const dg = wctx.createRadialGradient(dx - r * 0.3, dy - r * 0.3, r * 0.1, dx, dy, r);
      dg.addColorStop(0, 'rgba(225,235,245,0.55)');
      dg.addColorStop(0.6, 'rgba(180,195,212,0.25)');
      dg.addColorStop(1, 'rgba(160,175,195,0.05)');
      wctx.fillStyle = dg;
      wctx.beginPath();
      wctx.arc(dx, dy, r, 0, 7);
      wctx.fill();
    }
  }

  const pivots = [
    { x: 0.36, y: 1.06, from: -2.85, to: -1.35, len: 0.62 },
    { x: 0.74, y: 1.06, from: -2.75, to: -1.15, len: 0.56 },
  ];
  if (wipers) {
    const prev = wiperPhase;
    wiperPhase += wiperDir * dt / 0.65;
    if (wiperPhase >= 1) { wiperPhase = 1; wiperDir = -1; audio.wiperSweep(); }
    if (wiperPhase <= 0) { wiperPhase = 0; wiperDir = 1; audio.wiperSweep(); }
    for (const p of pivots) {
      const a0 = bladeAngle(prev, p.from, p.to);
      const a1 = bladeAngle(wiperPhase, p.from, p.to);
      wctx.globalCompositeOperation = 'destination-out';
      wctx.fillStyle = 'rgba(0,0,0,0.95)';
      wctx.beginPath();
      wctx.moveTo(p.x * ww, p.y * wh);
      wctx.arc(p.x * ww, p.y * wh, p.len * wh, Math.min(a0, a1) - 0.03, Math.max(a0, a1) + 0.03);
      wctx.closePath();
      wctx.fill();
      wctx.globalCompositeOperation = 'source-over';
    }
  }

  octx.save();
  octx.globalAlpha = 0.55;
  octx.drawImage(wet, 0, 0, w, h);
  octx.restore();

  for (const p of pivots) {
    const a = bladeAngle(wiperPhase, p.from, p.to);
    const px = p.x * w, py = p.y * h, L = p.len * h;
    octx.strokeStyle = '#050505';
    octx.lineWidth = 7;
    octx.lineCap = 'round';
    octx.beginPath();
    octx.moveTo(px + Math.cos(a) * L * 0.22, py + Math.sin(a) * L * 0.22);
    octx.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L);
    octx.stroke();
  }

  /* A-pillars, headliner, side mirrors */
  octx.fillStyle = 'rgba(8,7,6,0.92)';
  octx.beginPath();
  octx.moveTo(0, 0); octx.lineTo(w * 0.09, 0); octx.lineTo(w * 0.02, h * 0.8); octx.lineTo(0, h * 0.8);
  octx.closePath(); octx.fill();
  octx.beginPath();
  octx.moveTo(w, 0); octx.lineTo(w * 0.91, 0); octx.lineTo(w * 0.98, h * 0.8); octx.lineTo(w, h * 0.8);
  octx.closePath(); octx.fill();
  const hl = octx.createLinearGradient(0, 0, 0, h * 0.09);
  hl.addColorStop(0, 'rgba(8,7,6,0.95)');
  hl.addColorStop(1, 'rgba(8,7,6,0)');
  octx.fillStyle = hl;
  octx.fillRect(0, 0, w, h * 0.09);

  /* sun visors, dropped just below the headliner */
  octx.fillStyle = '#141210';
  for (const [vx0, vx1, tilt] of [[w * 0.11, w * 0.36, 0.012], [w * 0.63, w * 0.88, -0.010]] as const) {
    octx.beginPath();
    octx.moveTo(vx0, h * 0.075);
    octx.lineTo(vx1, h * 0.075 + (vx1 - vx0) * tilt);
    octx.lineTo(vx1 - 8, h * 0.135 + (vx1 - vx0) * tilt);
    octx.lineTo(vx0 + 8, h * 0.135);
    octx.closePath();
    octx.fill();
  }
  octx.strokeStyle = 'rgba(90,84,70,0.4)';
  octx.lineWidth = 1;
  octx.strokeRect(w * 0.215, h * 0.095, w * 0.03, h * 0.012);   // visor mirror clasp

  /* glass: corner grime and a diagonal sheen band */
  for (const [gx, gy] of [[w * 0.10, h * 0.66], [w * 0.90, h * 0.64]]) {
    const sm = octx.createRadialGradient(gx, gy, 4, gx, gy, w * 0.07);
    sm.addColorStop(0, 'rgba(60,58,48,0.16)');
    sm.addColorStop(1, 'rgba(60,58,48,0)');
    octx.fillStyle = sm;
    octx.fillRect(gx - w * 0.07, gy - w * 0.07, w * 0.14, w * 0.14);
  }
  {
    const sheen = octx.createLinearGradient(w * 0.2, 0, w * 0.6, h * 0.5);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.5, `rgba(255,255,255,${0.025 + 0.02 * (1 - darkness)})`);
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    octx.fillStyle = sheen;
    octx.fillRect(0, 0, w, h * 0.7);
  }

  for (const side of [0, 1]) {
    const mx2 = side ? w * 0.905 : w * 0.017, mw2 = w * 0.078, my2 = h * 0.545, mh2 = h * 0.075;
    octx.fillStyle = '#0a0908';
    octx.fillRect(mx2 - 4, my2 - 4, mw2 + 8, mh2 + 8);
    octx.fillStyle = '#101418';
    octx.fillRect(mx2, my2, mw2, mh2);
    if (cycle >= 3 && side === 0 && hash(Math.floor(s / 55) + 3) > 0.7) {
      const gg = octx.createRadialGradient(mx2 + mw2 * 0.5, my2 + mh2 * 0.5, 1, mx2 + mw2 * 0.5, my2 + mh2 * 0.5, mh2 * 0.4);
      gg.addColorStop(0, 'rgba(255,240,200,0.8)');
      gg.addColorStop(1, 'rgba(255,240,200,0)');
      octx.fillStyle = gg;
      octx.fillRect(mx2, my2, mw2, mh2);
    }
  }

  /* windshield cracks radiating from the last impact, once the glass is hurt */
  if (dmg > 0.18) {
    const cx = crackX * w, cy = crackY * h;
    octx.save();
    octx.strokeStyle = `rgba(220,225,235,${0.10 + dmg * 0.5})`;
    octx.lineWidth = 1;
    const arms = 4 + Math.floor(dmg * 8);
    for (let a = 0; a < arms; a++) {
      const ang = (a / arms) * Math.PI * 2 + crackX;
      let x = cx, y = cy;
      octx.beginPath();
      octx.moveTo(x, y);
      const segs = 3 + Math.floor(dmg * 4);
      for (let sgm = 0; sgm < segs; sgm++) {
        x += Math.cos(ang + (Math.sin(sgm * 9 + a) * 0.4)) * (10 + dmg * 30);
        y += Math.sin(ang + (Math.sin(sgm * 9 + a) * 0.4)) * (10 + dmg * 30);
        octx.lineTo(x, y);
      }
      octx.stroke();
    }
    // concentric fracture ring near the point of impact
    octx.strokeStyle = `rgba(220,225,235,${0.08 + dmg * 0.35})`;
    octx.beginPath();
    octx.arc(cx, cy, 6 + dmg * 10, 0, 7);
    octx.stroke();
    octx.restore();
  }

  /* ---- retro-futuristic cockpit (Pacific-Drive-ish): dark moulded dash,
     glowing teal light tube, CRT panels, incandescent analog gauges ---- */
  const backlight = 0.4 + 0.55 * darkness;
  const TEAL = '90,240,220';
  const glowStroke = (color: string, blur: number, fn: () => void) => {
    octx.save();
    octx.shadowColor = color;
    octx.shadowBlur = blur;
    fn();
    octx.restore();
  };

  const dashTop = h * 0.70;
  const g = octx.createLinearGradient(0, dashTop, 0, h);
  g.addColorStop(0, '#0c0f11');
  g.addColorStop(0.2, '#080a0b');
  g.addColorStop(1, '#020303');
  octx.fillStyle = g;
  octx.beginPath();
  octx.moveTo(0, h);
  octx.lineTo(0, dashTop + 56);
  octx.quadraticCurveTo(w * 0.25, dashTop + 2, w * 0.5, dashTop + 14);
  octx.quadraticCurveTo(w * 0.75, dashTop + 26, w, dashTop + 10);
  octx.lineTo(w, h);
  octx.closePath();
  octx.fill();

  /* the teal light tube along the dash lip */
  const tubeY = dashTop + 20;
  glowStroke(`rgba(${TEAL},0.9)`, 18, () => {
    octx.strokeStyle = `rgba(${TEAL},${0.5 + 0.3 * darkness})`;
    octx.lineWidth = 3;
    octx.beginPath();
    octx.moveTo(w * 0.18, tubeY + 8);
    octx.quadraticCurveTo(w * 0.5, tubeY - 6, w * 0.82, tubeY + 4);
    octx.stroke();
  });

  /* vinyl grain over the whole dash, then the stitched seam */
  {
    const pat = octx.createPattern(vinylPattern, 'repeat');
    if (pat) {
      octx.save();
      octx.globalAlpha = 0.35;
      octx.globalCompositeOperation = 'overlay';
      octx.fillStyle = pat;
      octx.beginPath();
      octx.moveTo(0, h);
      octx.lineTo(0, dashTop + 56);
      octx.quadraticCurveTo(w * 0.25, dashTop + 2, w * 0.5, dashTop + 14);
      octx.quadraticCurveTo(w * 0.75, dashTop + 26, w, dashTop + 10);
      octx.lineTo(w, h);
      octx.closePath();
      octx.fill();
      octx.restore();
    }
  }
  octx.strokeStyle = 'rgba(150,135,110,0.22)';
  octx.lineWidth = 1.2;
  octx.setLineDash([5, 6]);
  octx.beginPath();
  octx.moveTo(w * 0.05, tubeY + 26);
  octx.quadraticCurveTo(w * 0.5, tubeY + 12, w * 0.95, tubeY + 22);
  octx.stroke();
  octx.setLineDash([]);
  // a couple of sun cracks in the old vinyl
  octx.strokeStyle = 'rgba(20,16,12,0.45)';
  octx.lineWidth = 1;
  octx.beginPath();
  octx.moveTo(w * 0.30, tubeY + 30);
  octx.quadraticCurveTo(w * 0.34, tubeY + 44, w * 0.315, tubeY + 60);
  octx.moveTo(w * 0.71, tubeY + 34);
  octx.quadraticCurveTo(w * 0.74, tubeY + 42, w * 0.77, tubeY + 46);
  octx.stroke();

  /* air vents, centre of the dash */
  for (const vx of [0.475, 0.60]) {
    const ax = w * vx, ay = dashTop + 34, aw = w * 0.055, ah = h * 0.026;
    octx.fillStyle = '#060707';
    octx.fillRect(ax, ay, aw, ah);
    octx.strokeStyle = 'rgba(80,82,80,0.6)';
    octx.lineWidth = 1;
    octx.strokeRect(ax, ay, aw, ah);
    octx.strokeStyle = 'rgba(50,52,50,0.9)';
    for (let sl = 1; sl <= 3; sl++) {
      octx.beginPath();
      octx.moveTo(ax + 2, ay + (ah * sl) / 4);
      octx.lineTo(ax + aw - 2, ay + (ah * sl) / 4);
      octx.stroke();
    }
  }

  /* ignition barrel + keys swinging on their ring */
  {
    keyV += (-14 * Math.sin(keyA) - 2.2 * keyV - steer * 6 * (Math.abs(speed) / MAX_SPEED)) * dt;
    keyA += keyV * dt;
    const ix = w * 0.455, iy = h * 0.845;
    octx.fillStyle = '#1b1d1f';
    octx.beginPath(); octx.arc(ix, iy, h * 0.011, 0, 7); octx.fill();
    octx.strokeStyle = 'rgba(160,165,170,0.7)';
    octx.lineWidth = 1.4;
    octx.beginPath(); octx.arc(ix, iy, h * 0.011, 0, 7); octx.stroke();
    const ka = Math.PI / 2 + keyA;                    // hanging down, swinging
    const kx = ix + Math.cos(ka) * h * 0.035, ky = iy + Math.sin(ka) * h * 0.035;
    octx.strokeStyle = 'rgba(150,150,150,0.8)';
    octx.lineWidth = 1.2;
    octx.beginPath(); octx.moveTo(ix, iy); octx.lineTo(kx, ky); octx.stroke();
    octx.beginPath(); octx.arc(kx, ky, h * 0.007, 0, 7); octx.stroke();
    // two keys fanning from the ring
    for (const spread of [-0.35, 0.2]) {
      const k2 = ka + spread + keyA * 0.4;
      octx.strokeStyle = '#8c9094';
      octx.lineWidth = 2.4;
      octx.beginPath();
      octx.moveTo(kx, ky);
      octx.lineTo(kx + Math.cos(k2) * h * 0.026, ky + Math.sin(k2) * h * 0.026);
      octx.stroke();
    }
  }

  /* left CRT: fuel / temp cell bars */
  {
    const lx = w * 0.055, ly = h * 0.77, lw = w * 0.14, lh = h * 0.17;
    octx.fillStyle = 'rgba(4,10,10,0.96)';
    octx.fillRect(lx, ly, lw, lh);
    octx.strokeStyle = `rgba(${TEAL},0.35)`;
    octx.lineWidth = 1.5;
    octx.strokeRect(lx, ly, lw, lh);
    glowStroke(`rgba(${TEAL},0.7)`, 8, () => {
      octx.fillStyle = `rgba(${TEAL},${0.5 + 0.35 * backlight})`;
      octx.font = `${Math.round(h * 0.02)}px "Courier New", monospace`;
      octx.textAlign = 'left';
      octx.fillText('SISTEMA', lx + 8, ly + h * 0.032);
      // segmented cells
      const cells = [0.75, 0.5 + Math.sin(now * 0.3) * 0.05, 0.9];
      const labels = ['GAS', 'TMP', 'BAT'];
      cells.forEach((v, r) => {
        const yy = ly + h * 0.055 + r * h * 0.035;
        octx.fillText(labels[r], lx + 8, yy + h * 0.024);
        for (let c = 0; c < 8; c++) {
          octx.fillStyle = c / 8 < v ? `rgba(${TEAL},0.8)` : `rgba(${TEAL},0.12)`;
          octx.fillRect(lx + lw * 0.42 + c * (lw * 0.06), yy + h * 0.006, lw * 0.045, h * 0.018);
        }
        octx.fillStyle = `rgba(${TEAL},${0.5 + 0.35 * backlight})`;
      });
    });
  }

  /* analog gauge binnacle behind the wheel */
  const gauge = (sx: number, sy: number, sr: number, frac: number, rgb: string) => {
    octx.fillStyle = 'rgba(6,6,7,0.98)';
    octx.beginPath(); octx.arc(sx, sy, sr * 1.12, 0, 7); octx.fill();
    octx.strokeStyle = 'rgba(40,40,44,0.9)';
    octx.lineWidth = 3;
    octx.beginPath(); octx.arc(sx, sy, sr * 1.12, 0, 7); octx.stroke();
    // ticks
    octx.strokeStyle = `rgba(${rgb},${0.35 * backlight + 0.15})`;
    for (let i = 0; i <= 10; i++) {
      const ta = Math.PI * 0.78 + (i / 10) * Math.PI * 1.44;
      octx.lineWidth = i % 5 === 0 ? 2.2 : 1.2;
      octx.beginPath();
      octx.moveTo(sx + Math.cos(ta) * sr * 0.78, sy + Math.sin(ta) * sr * 0.78);
      octx.lineTo(sx + Math.cos(ta) * sr * 0.94, sy + Math.sin(ta) * sr * 0.94);
      octx.stroke();
    }
    // incandescent needle with glow
    const na = Math.PI * 0.78 + Math.min(1, Math.max(0, frac)) * Math.PI * 1.44;
    glowStroke(`rgba(${rgb},0.9)`, 10, () => {
      octx.strokeStyle = `rgba(${rgb},${0.7 + 0.3 * backlight})`;
      octx.lineWidth = 2.6;
      octx.beginPath();
      octx.moveTo(sx - Math.cos(na) * sr * 0.18, sy - Math.sin(na) * sr * 0.18);
      octx.lineTo(sx + Math.cos(na) * sr * 0.82, sy + Math.sin(na) * sr * 0.82);
      octx.stroke();
    });
    octx.fillStyle = `rgba(${rgb},0.9)`;
    octx.beginPath(); octx.arc(sx, sy, sr * 0.09, 0, 7); octx.fill();
    // glass sheen
    const sheen = octx.createLinearGradient(sx - sr, sy - sr, sx + sr, sy + sr);
    sheen.addColorStop(0, 'rgba(255,255,255,0.10)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    octx.fillStyle = sheen;
    octx.beginPath(); octx.arc(sx, sy, sr * 1.12, 0, 7); octx.fill();
  };
  /* instrument binnacle hood over the gauges */
  octx.fillStyle = '#0a0908';
  octx.beginPath();
  octx.moveTo(w * 0.205, h * 0.965);
  octx.quadraticCurveTo(w * 0.24, h * 0.78, w * 0.355, h * 0.775);
  octx.quadraticCurveTo(w * 0.46, h * 0.79, w * 0.49, h * 0.97);
  octx.closePath();
  octx.fill();
  octx.strokeStyle = 'rgba(120,115,100,0.18)';
  octx.lineWidth = 2;
  octx.beginPath();
  octx.moveTo(w * 0.215, h * 0.94);
  octx.quadraticCurveTo(w * 0.25, h * 0.785, w * 0.355, h * 0.782);
  octx.quadraticCurveTo(w * 0.455, h * 0.795, w * 0.482, h * 0.945);
  octx.stroke();

  /* indicator stalk poking out left of the column */
  octx.strokeStyle = '#1c1a17';
  octx.lineWidth = h * 0.014;
  octx.lineCap = 'round';
  octx.beginPath();
  octx.moveTo(w * 0.295, h * 0.955);
  octx.lineTo(w * 0.245, h * 0.905);
  octx.stroke();
  octx.fillStyle = '#26231f';
  octx.beginPath();
  octx.arc(w * 0.243, h * 0.903, h * 0.008, 0, 7);
  octx.fill();

  gauge(w * 0.29, h * 0.855, h * 0.072, Math.abs(speed) * 3.6 / 160, '235,70,55');       // speed, red
  gauge(w * 0.415, h * 0.875, h * 0.058, 0.25 + Math.abs(speed) / MAX_SPEED * 0.7, '240,170,40'); // revs, amber

  /* rolling odometer window inside the speedo */
  {
    const ox = w * 0.29, oy = h * 0.895;
    const odoStr = Math.floor(84213.7 + s / 1000).toString().padStart(6, '0');
    octx.fillStyle = '#050505';
    octx.fillRect(ox - h * 0.037, oy - h * 0.010, h * 0.074, h * 0.019);
    octx.strokeStyle = 'rgba(217,160,40,0.3)';
    octx.lineWidth = 1;
    octx.strokeRect(ox - h * 0.037, oy - h * 0.010, h * 0.074, h * 0.019);
    octx.fillStyle = `rgba(225,218,200,${0.5 + 0.3 * backlight})`;
    octx.font = `${Math.round(h * 0.0135)}px "Courier New", monospace`;
    octx.textAlign = 'center';
    for (let dgt = 0; dgt < 6; dgt++) {
      // last wheel is the red tenth-of-km barrel
      if (dgt === 5) octx.fillStyle = `rgba(230,110,80,${0.6 + 0.3 * backlight})`;
      octx.fillText(odoStr[dgt], ox - h * 0.030 + dgt * h * 0.012, oy + h * 0.005);
    }
  }

  /* radio head unit: preset buttons + volume knob, left of the CRT */
  {
    const bx = w * 0.615, by = h * 0.80;
    octx.fillStyle = '#0b0c0c';
    octx.fillRect(bx, by, w * 0.05, h * 0.14);
    octx.strokeStyle = 'rgba(110,112,110,0.3)';
    octx.strokeRect(bx, by, w * 0.05, h * 0.14);
    // volume knob with a position tick
    const kx = bx + w * 0.025, ky = by + h * 0.028;
    const kn = octx.createRadialGradient(kx - 2, ky - 2, 1, kx, ky, h * 0.014);
    kn.addColorStop(0, '#3a3c3e');
    kn.addColorStop(1, '#101112');
    octx.fillStyle = kn;
    octx.beginPath(); octx.arc(kx, ky, h * 0.014, 0, 7); octx.fill();
    octx.strokeStyle = 'rgba(230,225,210,0.6)';
    octx.lineWidth = 1.4;
    octx.beginPath();
    octx.moveTo(kx, ky);
    octx.lineTo(kx + Math.cos(-2.1) * h * 0.011, ky + Math.sin(-2.1) * h * 0.011);
    octx.stroke();
    // five worn preset buttons
    for (let bt = 0; bt < 5; bt++) {
      const bby = by + h * 0.055 + bt * h * 0.016;
      octx.fillStyle = bt === (audio.radioIndex % 5 + 5) % 5 ? '#3c3428' : '#1c1d1e';
      octx.fillRect(bx + w * 0.008, bby, w * 0.034, h * 0.011);
      octx.strokeStyle = 'rgba(90,90,88,0.35)';
      octx.lineWidth = 0.8;
      octx.strokeRect(bx + w * 0.008, bby, w * 0.034, h * 0.011);
    }
  }

  /* steering wheel + hands (drawn over the binnacle so the rim occludes) */
  const wcx = w * 0.35, wcy = h * 1.20, wr = h * 0.36;
  octx.save();
  octx.translate(wcx, wcy);
  octx.rotate(steer * 1.4);
  const rim = octx.createLinearGradient(0, -wr, 0, wr);
  rim.addColorStop(0, '#26221c');
  rim.addColorStop(0.5, '#141210');
  rim.addColorStop(1, '#0c0b09');
  octx.strokeStyle = rim;
  octx.lineWidth = h * 0.034;
  octx.beginPath();
  octx.arc(0, 0, wr, 0, Math.PI * 2);
  octx.stroke();
  // faint teal rim reflection from the light tube
  glowStroke(`rgba(${TEAL},0.5)`, 6, () => {
    octx.strokeStyle = `rgba(${TEAL},0.14)`;
    octx.lineWidth = h * 0.010;
    octx.beginPath();
    octx.arc(0, 0, wr, Math.PI * 1.15, Math.PI * 1.85);
    octx.stroke();
  });
  octx.strokeStyle = '#171310';
  octx.lineWidth = h * 0.018;
  for (const sa of [-0.5, Math.PI + 0.5, Math.PI * 0.5]) {
    octx.beginPath();
    octx.moveTo(0, 0);
    octx.lineTo(Math.cos(sa) * wr * 0.94, Math.sin(sa) * wr * 0.94);
    octx.stroke();
  }
  octx.fillStyle = '#100e0b';
  octx.beginPath();
  octx.arc(0, 0, h * 0.05, 0, Math.PI * 2);
  octx.fill();
  /* leather stitching along the rim */
  octx.strokeStyle = 'rgba(120,96,60,0.35)';
  octx.lineWidth = 1;
  octx.setLineDash([3, 5]);
  octx.beginPath();
  octx.arc(0, 0, wr + h * 0.012, 0, Math.PI * 2);
  octx.stroke();
  octx.setLineDash([]);

  /* hands seen from the driver's eye: the BACK of each hand lies along the
     rim, four fingers curl over the far side (only the first phalanx shows),
     the thumb hooks the near side. One silhouette per hand, then shading. */
  const drawHand = (ha: number, flip: number) => {
    octx.save();
    // local frame at the grip point: +x along the rim, +y toward wheel centre
    octx.translate(Math.cos(ha) * wr, Math.sin(ha) * wr);
    octx.rotate(ha + Math.PI / 2);
    octx.scale(flip, 1);
    const U = h * 0.001;                     // hand unit
    // jacket sleeve entering from below-outside
    octx.strokeStyle = '#1f1c17';
    octx.lineCap = 'round';
    octx.lineWidth = 46 * U;
    octx.beginPath();
    octx.moveTo(-52 * U, -66 * U);
    octx.lineTo(-30 * U, -26 * U);
    octx.stroke();
    // shirt cuff peeking out
    octx.strokeStyle = '#4a4438';
    octx.lineWidth = 40 * U;
    octx.beginPath();
    octx.moveTo(-34 * U, -32 * U);
    octx.lineTo(-28 * U, -22 * U);
    octx.stroke();

    // one closed silhouette: wrist → back of hand → 4 knuckle scallops →
    // fingertips over the rim → base of index → thumb → back to wrist
    const skin = octx.createLinearGradient(0, -30 * U, 0, 34 * U);
    skin.addColorStop(0, '#b1835c');
    skin.addColorStop(0.55, '#9d7350');
    skin.addColorStop(1, '#7e5a3e');
    octx.fillStyle = skin;
    octx.beginPath();
    octx.moveTo(-30 * U, -20 * U);                       // wrist, outer edge
    octx.quadraticCurveTo(-40 * U, 2 * U, -32 * U, 12 * U);   // heel of hand
    // knuckle ridge with four scallops, running along the rim
    octx.quadraticCurveTo(-26 * U, 20 * U, -18 * U, 19 * U);  // pinky knuckle
    octx.quadraticCurveTo(-12 * U, 26 * U, -4 * U, 24 * U);   // ring
    octx.quadraticCurveTo(2 * U, 30 * U, 10 * U, 27 * U);     // middle
    octx.quadraticCurveTo(16 * U, 31 * U, 24 * U, 26 * U);    // index
    octx.quadraticCurveTo(34 * U, 22 * U, 36 * U, 12 * U);    // index side
    octx.quadraticCurveTo(42 * U, 2 * U, 34 * U, -8 * U);     // toward thumb web
    // thumb: hooks the near side of the rim, pointing along it
    octx.quadraticCurveTo(46 * U, -14 * U, 52 * U, -24 * U);  // thumb tip out
    octx.quadraticCurveTo(50 * U, -32 * U, 40 * U, -30 * U);  // thumb underside
    octx.quadraticCurveTo(30 * U, -27 * U, 20 * U, -24 * U);  // web back in
    octx.quadraticCurveTo(-6 * U, -30 * U, -30 * U, -20 * U); // back to wrist
    octx.closePath();
    octx.fill();

    // first phalanxes curling over the far side of the rim (darker: they
    // fall into the rim's shadow)
    octx.fillStyle = '#775539';
    for (let k = 0; k < 4; k++) {
      const fx = (-19 + k * 14) * U;
      octx.beginPath();
      octx.moveTo(fx, (19 + (k === 1 || k === 2 ? 6 : 2)) * U);
      octx.lineTo(fx + 9 * U, (21 + (k === 1 || k === 2 ? 6 : 2)) * U);
      octx.lineTo(fx + 8 * U, 34 * U);
      octx.quadraticCurveTo(fx + 4 * U, 38 * U, fx + 1 * U, 34 * U);
      octx.closePath();
      octx.fill();
    }
    // creases between fingers, into the back of the hand
    octx.strokeStyle = 'rgba(80,52,32,0.55)';
    octx.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      const fx = (-10 + k * 14) * U;
      octx.beginPath();
      octx.moveTo(fx, 22 * U);
      octx.lineTo(fx - 3 * U, 8 * U);
      octx.stroke();
    }
    // knuckle highlights
    octx.fillStyle = 'rgba(222,178,136,0.55)';
    for (let k = 0; k < 4; k++) {
      octx.beginPath();
      octx.ellipse((-17 + k * 14) * U, 18 * U, 4.4 * U, 2.6 * U, 0.2, 0, 7);
      octx.fill();
    }
    // thumb nail + crease
    octx.fillStyle = 'rgba(222,182,142,0.5)';
    octx.beginPath();
    octx.ellipse(46 * U, -25 * U, 4 * U, 2.6 * U, -0.5, 0, 7);
    octx.fill();
    octx.strokeStyle = 'rgba(80,52,32,0.45)';
    octx.beginPath();
    octx.moveTo(26 * U, -24 * U);
    octx.quadraticCurveTo(32 * U, -20 * U, 38 * U, -22 * U);
    octx.stroke();
    // tendon hints on the back of the hand
    octx.strokeStyle = 'rgba(120,86,58,0.30)';
    octx.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      octx.beginPath();
      octx.moveTo((-14 + k * 13) * U, 16 * U);
      octx.lineTo((-20 + k * 11) * U, -12 * U);
      octx.stroke();
    }
    octx.restore();
  };
  drawHand(-2.35, -1);   // left hand mirrored
  drawHand(-0.75, 1);
  octx.restore();

  /* gear lever with rubber boot, between the seats */
  {
    const gx = w * 0.505, gy = h;
    const lean = -steer * 0.05 + Math.sin(now * 0.9) * 0.01;
    const tipX = gx + Math.sin(lean) * h * 0.16 - h * 0.02;
    const tipY = gy - Math.cos(lean) * h * 0.16;
    octx.fillStyle = '#0a0908';
    octx.beginPath();
    octx.moveTo(gx - w * 0.028, gy);
    octx.lineTo(gx - w * 0.006, gy - h * 0.05);
    octx.lineTo(gx + w * 0.010, gy - h * 0.05);
    octx.lineTo(gx + w * 0.032, gy);
    octx.closePath();
    octx.fill();
    octx.strokeStyle = 'rgba(120,110,95,0.25)';    // boot folds
    octx.lineWidth = 1;
    for (let f = 1; f <= 2; f++) {
      octx.beginPath();
      octx.moveTo(gx - w * 0.020 + f * 3, gy - f * h * 0.016);
      octx.lineTo(gx + w * 0.024 - f * 3, gy - f * h * 0.016);
      octx.stroke();
    }
    octx.strokeStyle = '#26282a';
    octx.lineWidth = h * 0.012;
    octx.lineCap = 'round';
    octx.beginPath();
    octx.moveTo(gx, gy - h * 0.045);
    octx.lineTo(tipX, tipY);
    octx.stroke();
    const kg = octx.createRadialGradient(tipX - 3, tipY - 3, 1, tipX, tipY, h * 0.016);
    kg.addColorStop(0, '#3c3e40');
    kg.addColorStop(1, '#101112');
    octx.fillStyle = kg;
    octx.beginPath(); octx.arc(tipX, tipY, h * 0.016, 0, 7); octx.fill();
  }

  /* the package on the passenger seat — loose. it slides with the car's
     accelerations, tips over on hard moves, thumps against the seat edges */
  {
    // seat-top friction sim in screen units
    pkgVx += -gLat * 26 * dt;                            // lateral throw
    pkgVx += -gLong * Math.sign(pkgX || 1) * 2 * dt;     // braking scuffs it too
    pkgVx += (Math.random() - 0.5) * Math.abs(bodyVy) * 8 * dt;   // bump jitter
    pkgVx -= pkgVx * Math.min(1, 5.5 * dt);              // paper-on-vinyl friction
    pkgX += pkgVx * dt * h * 0.4;
    const lim = w * 0.045;
    if (pkgX > lim) { pkgX = lim; if (Math.abs(pkgVx) > 0.5) { audio.crash(Math.min(0.12, Math.abs(pkgVx) * 0.06)); pkgThumpT = 0.3; } pkgVx *= -0.25; }
    if (pkgX < -lim) { pkgX = -lim; if (Math.abs(pkgVx) > 0.5) { audio.crash(Math.min(0.12, Math.abs(pkgVx) * 0.06)); pkgThumpT = 0.3; } pkgVx *= -0.25; }
    // it leans into the slide and settles back crooked
    const targetRot = -0.06 - pkgVx * 0.10 - gLat * 0.02;
    pkgRot += (targetRot - pkgRot) * Math.min(1, 7 * dt);
    pkgThumpT = Math.max(0, pkgThumpT - dt);

    const px = w * 0.64 + pkgX, py = h * 0.90 + Math.abs(bodyVy) * h * 0.01 + (pkgThumpT > 0 ? -h * 0.004 : 0);
    const pw = w * 0.13, ph = h * 0.13;
    octx.save();
    octx.translate(px, py);
    octx.rotate(pkgRot);
    // shadow thrown on the seat
    octx.fillStyle = 'rgba(0,0,0,0.45)';
    octx.beginPath();
    octx.ellipse(pw * 0.04, ph * 0.98, pw * 0.56, ph * 0.10, 0.02, 0, 7);
    octx.fill();
    const paper = octx.createLinearGradient(0, 0, 0, ph);
    paper.addColorStop(0, '#71603e');
    paper.addColorStop(0.5, '#5d4c30');
    paper.addColorStop(1, '#463823');
    octx.fillStyle = paper;
    octx.fillRect(-pw / 2, 0, pw, ph);
    // top face hint (parcel is a box, we see a sliver of its top)
    octx.fillStyle = '#7d6b48';
    octx.beginPath();
    octx.moveTo(-pw / 2, 0); octx.lineTo(-pw / 2 + pw * 0.08, -ph * 0.06);
    octx.lineTo(pw / 2 + pw * 0.06, -ph * 0.05); octx.lineTo(pw / 2, 0);
    octx.closePath();
    octx.fill();
    // creases + torn corner
    octx.strokeStyle = 'rgba(30,22,12,0.4)';
    octx.lineWidth = 1;
    octx.beginPath();
    octx.moveTo(-pw / 2, ph * 0.4); octx.lineTo(pw / 2, ph * 0.5);
    octx.moveTo(0, 0); octx.lineTo(pw * 0.1, ph);
    octx.moveTo(pw * 0.32, ph * 0.08); octx.lineTo(pw * 0.40, ph * 0.22);
    octx.stroke();
    // string cross with a small knot
    octx.strokeStyle = 'rgba(24,18,10,0.8)';
    octx.lineWidth = 2;
    octx.beginPath();
    octx.moveTo(pw * 0.02, -ph * 0.04); octx.lineTo(pw * 0.08, ph);
    octx.moveTo(-pw / 2, ph * 0.45); octx.lineTo(pw / 2, ph * 0.5);
    octx.stroke();
    octx.fillStyle = 'rgba(24,18,10,0.9)';
    octx.beginPath();
    octx.arc(pw * 0.05, ph * 0.47, 2.6, 0, 7);
    octx.fill();
    // string highlight
    octx.strokeStyle = 'rgba(200,180,140,0.25)';
    octx.lineWidth = 0.8;
    octx.beginPath();
    octx.moveTo(-pw / 2, ph * 0.44); octx.lineTo(pw / 2, ph * 0.49);
    octx.stroke();
    octx.restore();
  }

  /* right CRT: COMPONENT / ROUTE ANALYSIS vector screen */
  {
    const rx = w * 0.68, ry = h * 0.72, rw = w * 0.28, rh = h * 0.26;
    const flick = (inr > 0.4 && Math.random() < inr * 0.4) ? 0.4 : 1;
    octx.fillStyle = 'rgba(3,10,9,0.97)';
    octx.fillRect(rx, ry, rw, rh);
    octx.strokeStyle = `rgba(${TEAL},0.4)`;
    octx.lineWidth = 1.5;
    octx.strokeRect(rx, ry, rw, rh);
    // scanlines
    octx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let yy = ry; yy < ry + rh; yy += 3) octx.fillRect(rx, yy, rw, 1);

    glowStroke(`rgba(${TEAL},0.8)`, 7, () => {
      octx.fillStyle = `rgba(${TEAL},${flick * (0.55 + 0.35 * backlight)})`;
      octx.font = `${Math.round(h * 0.019)}px "Courier New", monospace`;
      octx.textAlign = 'left';
      octx.fillText('ANÁLISIS DE RUTA', rx + 10, ry + h * 0.03);
      octx.strokeStyle = `rgba(${TEAL},${flick * 0.7})`;
      octx.lineWidth = 1.4;
      octx.beginPath();
      octx.moveTo(rx + 10, ry + h * 0.042); octx.lineTo(rx + rw - 10, ry + h * 0.042);
      octx.stroke();

      // top-down wireframe of the car with panel cells
      const cx = rx + rw * 0.28, cy = ry + rh * 0.58, cw = rw * 0.22, cl = rh * 0.5;
      octx.strokeStyle = `rgba(${TEAL},${flick * 0.8})`;
      octx.lineWidth = 1.6;
      octx.strokeRect(cx - cw / 2, cy - cl / 2, cw, cl);
      octx.strokeRect(cx - cw / 2, cy - cl * 0.12, cw, cl * 0.34);   // cabin cell
      for (const wy of [-cl * 0.34, cl * 0.34]) {
        for (const wx of [-cw / 2 - 3, cw / 2 - 1]) {
          octx.strokeRect(cx + wx, cy + wy - 4, 4, 8);
        }
      }
      // route / mission readout
      octx.font = `${Math.round(h * 0.017)}px "Courier New", monospace`;
      const tx = rx + rw * 0.5;
      const line1 = missionState === 'revealed'
        ? '» ' + MISSIONS[missionIdx % MISSIONS.length].label.toUpperCase()
        : missionState === 'broadcast' ? '» SEÑAL 91.8 ···' : '» EN RUTA';
      octx.fillText(line1, tx, ry + h * 0.11, rw * 0.48);
      const stx = audio.currentStation;
      octx.fillText(stx ? `FM ${stx.freq}` : 'FM ---', tx, ry + h * 0.145);
      octx.fillText(`${Math.round(Math.abs(speed) * 3.6)} KM/H`, tx, ry + h * 0.18);
      octx.fillText(hourStr, tx, ry + h * 0.215);
    });
    // chassis damage warning, in red, blinking when severe
    if (dmg > 0.05) {
      const blink = dmg < 0.6 || Math.sin(now * 6) > 0;
      octx.fillStyle = blink ? `rgba(230,90,70,${0.6 + 0.35 * backlight})` : 'rgba(230,90,70,0.15)';
      octx.font = `${Math.round(h * 0.017)}px "Courier New", monospace`;
      octx.textAlign = 'left';
      octx.fillText(`CHASIS ${Math.round(100 - dmg * 100)}%`, rx + 10, ry + rh - h * 0.02);
    }
  }

  /* rear-view mirror */
  const mw = w * 0.19, mh = h * 0.05, mx = w * 0.5 - mw / 2, my = h * 0.045;
  octx.fillStyle = '#020303';
  octx.fillRect(mx, my, mw, mh);
  octx.strokeStyle = '#15130f';
  octx.lineWidth = 4;
  octx.strokeRect(mx, my, mw, mh);

  /* pine air freshener hanging from the mirror, swinging with the drive */
  {
    freshV += (-11 * Math.sin(freshA) - 2.0 * freshV - steer * 5 * (Math.abs(speed) / MAX_SPEED) + bodyVy * 2) * dt;
    freshA += freshV * dt;
    const px0 = mx + mw / 2, py0 = my + mh + 2;
    const fa = Math.PI / 2 + freshA;
    const fx = px0 + Math.cos(fa) * h * 0.055, fy = py0 + Math.sin(fa) * h * 0.055;
    octx.strokeStyle = 'rgba(200,200,200,0.5)';
    octx.lineWidth = 1;
    octx.beginPath(); octx.moveTo(px0, py0); octx.lineTo(fx, fy); octx.stroke();
    octx.save();
    octx.translate(fx, fy);
    octx.rotate(freshA * 0.8);
    octx.fillStyle = '#1d4a26';
    octx.beginPath();
    octx.moveTo(0, -h * 0.020);
    octx.lineTo(-h * 0.013, h * 0.016);
    octx.lineTo(h * 0.013, h * 0.016);
    octx.closePath();
    octx.fill();
    octx.fillStyle = 'rgba(255,255,255,0.12)';      // faded print
    octx.fillRect(-h * 0.006, -h * 0.004, h * 0.012, h * 0.008);
    octx.restore();
  }
  if (cycle >= 3 && hash(Math.floor(s / 40)) > 0.6) {
    const k = hash(Math.floor(s / 40) + 7);
    for (const dx of [-1, 1]) {
      const gg = octx.createRadialGradient(
        mx + mw / 2 + dx * mw * 0.09, my + mh * 0.55, 0.5,
        mx + mw / 2 + dx * mw * 0.09, my + mh * 0.55, mh * 0.32);
      gg.addColorStop(0, `rgba(255,240,200,${0.5 + k * 0.4})`);
      gg.addColorStop(1, 'rgba(255,240,200,0)');
      octx.fillStyle = gg;
      octx.fillRect(mx, my, mw, mh);
    }
  }
}

/* adaptive resolution: hold ~50+ fps by trading internal pixel ratio */
let pr = Math.min(devicePixelRatio, 1.75);
let fpsAcc = 0;
let fpsN = 0;
let fpsTimer = 0;
function adaptResolution(dt: number) {
  fpsAcc += dt; fpsN++; fpsTimer += dt;
  if (fpsTimer < 2.5) return;
  const fps = fpsN / fpsAcc;
  fpsAcc = 0; fpsN = 0; fpsTimer = 0;
  const prev = pr;
  if (fps < 42 && pr > 0.75) pr = Math.max(0.75, pr - 0.25);
  else if (fps > 56 && pr < Math.min(devicePixelRatio, 1.75)) pr = Math.min(devicePixelRatio, pr + 0.25);
  if (pr !== prev) {
    renderer.setPixelRatio(pr);
    renderer.setSize(innerWidth, innerHeight);
  }
}

/* ------------------------------------------------------------------- loop */
const clock = new THREE.Clock();
let baseFov = 58;

function gameHHMM(): { str: string; hour: number } {
  const mins = Math.floor(tDay * 24 * 60);
  const hh = Math.floor(mins / 60) % 24;
  const mm = mins % 60;
  return { str: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, hour: hh };
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  adaptResolution(dt);
  if (state === 'paused') {
    map.update(s, cycle, 0, now);
    renderer.render(world.scene, camera);
    return;
  }
  now += dt;

  /* weather + daylight advance even on the menu, so the world lives */
  weather.update(dt / DAY_LEN * 24, dt);
  const rainI = weather.current.rainI;
  tDay = (tDay + dt / DAY_LEN) % 1;
  if (cycle >= 2 && tDay > 0.215 && tDay < 0.30) {
    tDay = 0.215;
    if (!dawnBlockedShown) {
      dawnBlockedShown = true;
      showCaption(CAPTIONS[3], 5200);
    }
  }
  const day = sampleDay(tDay);
  renderer.toneMappingExposure = day.exposure;
  if (weather.lightning) {
    world.lightningFlash();
    audio.thunder(0.8 + Math.random() * 3);
  }

  const driving = state === 'driving';

  /* --- driving model --- */
  const up = driving && (keys['w'] || keys['arrowup']);
  const down = driving && (keys['s'] || keys['arrowdown']);
  const left = driving && (keys['a'] || keys['arrowleft']);
  const right = driving && (keys['d'] || keys['arrowright']);
  const handbrake = driving && !!keys[' '];

  prevSpeed = speed;
  const engineF = 9.5 * (1 - 0.55 * Math.abs(speed) / MAX_SPEED);   // torque tapers
  if (up) speed += engineF * dt;
  if (down) {
    if (speed > 0.4) speed -= 16 * dt;
    else speed -= 7 * dt;
  }
  if (handbrake) speed -= Math.sign(speed) * 14 * dt;
  speed += -9.81 * world.grade(s) * 0.8 * dt;                        // slopes matter
  speed -= Math.sign(speed) * (0.0011 * speed * speed + 0.10) * dt * 9;
  if (!up && !down && Math.abs(speed) < 0.6) speed = 0;              // parking friction
  speed = THREE.MathUtils.clamp(speed, -MAX_REVERSE, MAX_SPEED);
  const longAccel = (speed - prevSpeed) / Math.max(dt, 0.001);

  const inTun = world.inTunnel(s);
  const wetGrip = 1 - 0.32 * (inTun ? 0.2 : rainI);
  const grip = (handbrake ? 0.32 : 1.0) * wetGrip;
  const sIn = (left ? -1 : 0) + (right ? 1 : 0);
  steer = THREE.MathUtils.lerp(steer, sIn, 1 - Math.exp(-7 * dt));
  const prevLaneV = laneV;
  laneV += steer * (4.5 + 16 * (Math.abs(speed) / MAX_SPEED)) * grip * dt * Math.sign(speed || 1);
  laneV -= laneV * Math.min(1, 6.0 * grip * dt);
  laneV -= world.curvature(s) * speed * speed * dt;
  laneX += laneV * dt;
  const latAccel = (laneV - prevLaneV) / Math.max(dt, 0.001);
  gLat = latAccel;
  gLong = longAccel;

  const offroad = Math.abs(laneX) > ROAD_HALF + 0.15 && Math.abs(speed) > 1;
  if (offroad) {
    speed -= speed * 0.55 * dt;
    shake = Math.max(shake, 0.35);
  }
  if (Math.abs(laneX) > 8) { laneX = Math.sign(laneX) * 8; laneV *= -0.25; }

  s += speed * dt;

  /* --- collisions: trees, walls, poles, signs, oncoming cars --- */
  let scrapeNow = false;
  if (driving) {
    const hit = world.collide(s, laneX);
    if (hit) {
      const closingFwd = Math.abs(speed);
      if (hit.penL < hit.penS) {
        // glancing / side impact — pushed back onto the road, scrubs speed
        laneX += hit.signL * hit.penL;
        const into = laneV * -hit.signL;              // speed into the obstacle
        laneV = hit.signL * Math.abs(laneV) * 0.35;
        speed *= 0.9;
        const sev = Math.min(1, (Math.max(0, into) * 2 + closingFwd * 0.25) / 14);
        scrapeNow = closingFwd > 3;
        if (sev > 0.05) {
          shake = Math.max(shake, 0.4 + sev);
          audio.crash(sev);
          damage = Math.min(1, damage + sev * (hit.kind === 'wall' ? 0.14 : 0.1));
          if (sev > 0.22) world.dentCar(sev, hit.signL > 0 ? 'left' : 'right');
          if (sev > 0.35) { pullDir = hit.signL; crackX = 0.3 + Math.random() * 0.4; crackY = 0.3 + Math.random() * 0.2; }
        }
      } else {
        // head-on — bounce back off the obstacle
        s += hit.signS * hit.penS;
        const sev = Math.min(1, closingFwd / 12);
        speed = -Math.sign(speed || 1) * Math.min(closingFwd * 0.35, 5);
        laneV += (Math.random() - 0.5) * 4;
        shake = Math.max(shake, 0.7 + sev);
        audio.crash(Math.max(0.4, sev));
        damage = Math.min(1, damage + sev * 0.28 + 0.04);
        world.dentCar(Math.max(0.4, sev), 'front');
        pullDir = Math.random() < 0.5 ? -1 : 1;
        crackX = 0.35 + Math.random() * 0.3; crackY = 0.32 + Math.random() * 0.18;
      }
    }
  }
  // damaged steering pulls to one side; heavier damage, stronger pull
  if (damage > 0.15) laneV += pullDir * damage * 1.4 * dt * (Math.abs(speed) / MAX_SPEED);
  if (scrapeNow !== scraping) { scraping = scrapeNow; audio.scrape(scraping); }

  /* repair: pull over at the recurring gasolinera and idle to fix the chassis */
  const atGas = Math.abs(world.gasStationS - s) < 24 && laneX > 2.6 && Math.abs(speed) < 3;
  if (atGas && damage > 0.001) {
    if (!repairing) { repairing = true; showCaption('reparando el chasis en la gasolinera…', 3000); }
    damage = Math.max(0, damage - dt * 0.16);
    if (damage <= 0.02) {
      damage = 0; pullDir = 0;
      world.repairCar();
      repairing = false;
      showCaption('chasis reparado. depósito lleno.', 3200);
    }
  } else if (repairing && !atGas) {
    repairing = false;
  }

  wheelSpin += speed * dt / 0.34;

  /* suspension: bumps + weight transfer */
  const bump = (offroad ? (Math.random() - 0.5) * 0.05 : 0)
    + (Math.sin(s * 1.7) + Math.sin(s * 3.31)) * 0.006 * (Math.abs(speed) / MAX_SPEED);
  bodyVy += ((bump - bodyY) * 55 - bodyVy * 7.5) * dt;
  bodyY += bodyVy * dt;
  pitch = THREE.MathUtils.lerp(pitch, THREE.MathUtils.clamp(-longAccel * 0.0075, -0.05, 0.06), 1 - Math.exp(-6 * dt));
  roll = THREE.MathUtils.lerp(roll, THREE.MathUtils.clamp(-latAccel * 0.010 - steer * 0.02, -0.09, 0.09), 1 - Math.exp(-6 * dt));

  /* --- anomaly clock --- */
  const cs = s % CYCLE_LEN;
  const inr = Math.min(1, Math.max(0, (cs - (CYCLE_LEN - 2200)) / 2200) + Math.min(0.25, cycle * 0.07));
  audio.interference = inr;
  const hm = gameHHMM();
  audio.context = { hourStr: hm.str, hour: hm.hour, weather: weather.name, cycle };

  const newCycle = Math.floor(s / CYCLE_LEN);
  if (newCycle > cycle) {
    cycle = newCycle;
    runGlitch();
    const line = CAPTIONS[Math.min(cycle, CAPTIONS.length - 1)];
    setTimeout(() => showCaption(line), 900);
    world.mirrorOncoming = cycle >= 2;
  }
  if (world.gasStationS < s - 120) {
    world.setGasStationS(world.gasStationS + CYCLE_LEN);
  }
  if (cycle >= 1 && gasCaptionCycle !== cycle && Math.abs(world.gasStationS - s) < 30) {
    gasCaptionCycle = cycle;
    showCaption('la misma gasolinera.');
  }
  if (!borderCaptionShown && Math.abs(world.borderPostS - s) < 24) {
    borderCaptionShown = true;
    showCaption('la muga. no hay nadie.', 4200);
  }

  if (driving) updateMissions(dt);
  handler.update(dt, driving);
  syncPhoneUI();
  shake = Math.max(0, shake - dt * 1.6);

  /* --- world --- */
  world.update(dt, {
    s, speed, laneX, steer,
    visualYaw: -(steer * 0.18 + laneV * 0.016) * Math.sign(speed || 1),
    roll, pitch, bodyY, wheelSpin,
    interior,
    braking: down || handbrake,
    time: now, tDay, day, rainI,
    cloud: weather.current.cloud,
    lightning: weather.lightning,
    damage,
  });

  /* --- cinematic camera --- */
  const shx = (Math.random() - 0.5) * shake * 0.14;
  const shy = (Math.random() - 0.5) * shake * 0.1;
  const ahead = world.aheadPoint(s, 30);
  const wantFov = (interior ? 60 : 57) + (Math.abs(speed) / MAX_SPEED) * 7;
  if (Math.abs(wantFov - baseFov) > 0.1) {
    baseFov = THREE.MathUtils.lerp(baseFov, wantFov, 0.05);
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }
  if (interior) {
    camera.position.set(laneX - 0.35 + shx, 1.28 + bodyY * 0.8 + shy, -7.55);
    camera.lookAt(laneX - 0.35 + steer * 1.2 + ahead.x * 0.25, 0.9 + ahead.y * 0.55, -46);
  } else {
    const sway = Math.sin(now * 0.7) * 0.04 * (Math.abs(speed) / MAX_SPEED);
    camera.position.set(laneX * 0.62 + shx + sway, 2.55 + bodyY * 0.4 + shy, 1.6);
    camera.lookAt(laneX * 0.80 + ahead.x * 0.30, 1.3 + ahead.y * 0.45, -26);
  }
  /* free look: the gaze follows the mouse, eased, on top of the base framing */
  const lk = 1 - Math.exp(-6 * dt);
  lookX += (lookTX - lookX) * lk;
  lookY += (lookTY - lookY) * lk;
  camera.rotateY(-lookX * (interior ? 0.55 : 0.35));
  camera.rotateX(-lookY * (interior ? 0.25 : 0.15));

  /* --- overlay + map --- */
  octx.clearRect(0, 0, innerWidth, innerHeight);
  const inCabin = interior && driving;
  document.body.classList.toggle('cabin', inCabin);   // diegetic screens replace the HUD
  if (inCabin) {
    // head-turn parallax: the dash slides against the view
    octx.save();
    octx.translate(-lookX * innerWidth * 0.20, -lookY * innerHeight * 0.10 + Math.max(0, lookY) * innerHeight * 0.04);
    drawInterior(dt, inr, rainI, day.darkness, inTun, hm.str, damage);
    octx.restore();
  }
  if (driving) drawLensDrops(dt, inTun ? 0 : rainI, inCabin);
  map.update(s, cycle, inr, now);

  /* --- HUD --- */
  $('spd').textContent = speed < -0.4
    ? `R ${Math.round(-speed * 3.6)}`
    : `${Math.round(Math.max(0, speed) * 3.6)}`;
  let odo = (84213.7 + s / 1000).toFixed(1);
  if (inr > 0.6 && Math.random() < 0.12) {
    const i = (Math.random() * (odo.length - 1)) | 0;
    odo = odo.slice(0, i) + '▮' + odo.slice(i + 1);
  }
  $('odo').textContent = odo + ' km';
  const rr = $('radio-row');
  const st = audio.currentStation;
  rr.className = 'row ' + (!st ? 'dim' : (inr > 0.5 && st.type !== 'sokoa') ? 'radio-bad' : 'radio-on');
  rr.textContent = st && inr > 0.5 && st.type !== 'sokoa' ? 'radio · interferencia' : radioRowText();
  const mrow = $('mission-row');
  if (missionState === 'revealed') {
    mrow.className = 'row radio-bad';
    mrow.textContent = `sokoa · ${MISSIONS[missionIdx % MISSIONS.length].label}`;
  } else if (missionState === 'broadcast') {
    mrow.className = 'row dim';
    mrow.textContent = 'algo se mueve en 91.8…';
  } else {
    mrow.className = 'row dim';
    mrow.textContent = entregas > 0 ? `entregas: ${entregas}` : '';
  }
  $('state-row').textContent =
    `${hm.str} · ${weather.name} · ${world.headlightsOn ? 'luces' : 'luces off'} · ` +
    `${interior ? 'cabina' : 'exterior'}` +
    (damage > 0.05 ? ` · chasis ${Math.round(100 - damage * 100)}%` : '') +
    ` · P pausa · ESC menú`;

  audio.update(dt, {
    speed, maxSpeed: MAX_SPEED, throttle: !!up,
    offroad, handbrake, rain: inTun ? 0.05 : rainI,
    interior: inCabin, grade: world.grade(s),
  });

  renderer.render(world.scene, camera);
}
if (isTouch) buildTouchControls();
toMenu();
frame();
