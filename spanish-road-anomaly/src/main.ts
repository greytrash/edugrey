import * as THREE from 'three';
import './style.css';
import { World, ROAD_HALF } from './world';
import { GameAudio } from './audio';
import { sampleDay } from './daycycle';
import { MiniMap } from './map';
import { Weather } from './weather';
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
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
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
/* horn button: works with touch and mouse */
const hornBtn = document.createElement('button');
hornBtn.id = 'horn';
hornBtn.textContent = '📯';
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
    ? 'ENTER · seguir conduciendo'
    : 'Press any key to start audio and drive.';
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

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'escape') {                    // ESC → menú principal
    if (state !== 'menu') toMenu();
    return;
  }
  if (state === 'menu') {
    if (k !== 'p') toDriving();
    return;
  }
  if (k === 'p') {                         // P → pausa (mapa en mano)
    state === 'paused' ? toDriving() : toPaused();
    return;
  }
  if (state === 'paused') return;
  if (k === ' ') e.preventDefault();
  if (keys[k]) return;
  keys[k] = true;
  if (k === 'c') interior = !interior;
  if (k === 'l') world.headlightsOn = !world.headlightsOn;
  if (k === 'v') wipers = !wipers;
  if (k === 'm') map.toggle();
  if (k === 'h') pitido();
  if (k === 'r') { audio.cycleRadio(); $('radio-row').textContent = radioRowText(); }
  if (k === '9') s += CYCLE_LEN - (s % CYCLE_LEN) - 150;
  if (k === '8') s += 1500;
  if (k === '0') tDay = (tDay + 0.06) % 1;
  if (k === '7') showCaption('tiempo: ' + weather.force(), 2000);
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

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

/* --------------------------------------------------------------- wipers 2D */
let wiperPhase = 0;
let wiperDir = 1;

function bladeAngle(phase: number, from: number, to: number) {
  const e = 0.5 - 0.5 * Math.cos(phase * Math.PI);
  return from + (to - from) * e;
}

function drawInterior(dt: number, inr: number, rainI: number, darkness: number, inTunnel: boolean) {
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

  /* dashboard */
  const dashTop = h * 0.74;
  const g = octx.createLinearGradient(0, dashTop, 0, h);
  g.addColorStop(0, '#12100d');
  g.addColorStop(0.25, '#0d0b09');
  g.addColorStop(1, '#050403');
  octx.fillStyle = g;
  octx.beginPath();
  octx.moveTo(0, h);
  octx.lineTo(0, dashTop + 46);
  octx.quadraticCurveTo(w * 0.25, dashTop - 8, w * 0.5, dashTop + 6);
  octx.quadraticCurveTo(w * 0.75, dashTop + 18, w, dashTop + 2);
  octx.lineTo(w, h);
  octx.closePath();
  octx.fill();
  octx.strokeStyle = `rgba(180,170,150,${0.10 + 0.1 * (1 - darkness)})`;
  octx.lineWidth = 2;
  octx.beginPath();
  octx.moveTo(0, dashTop + 46);
  octx.quadraticCurveTo(w * 0.25, dashTop - 8, w * 0.5, dashTop + 6);
  octx.quadraticCurveTo(w * 0.75, dashTop + 18, w, dashTop + 2);
  octx.stroke();

  /* steering wheel + hands that follow it */
  const wcx = w * 0.34, wcy = h * 1.10, wr = h * 0.30;
  octx.save();
  octx.translate(wcx, wcy);
  octx.rotate(steer * 1.4);
  octx.strokeStyle = '#191512';
  octx.lineWidth = h * 0.030;
  octx.beginPath();
  octx.arc(0, 0, wr, 0, Math.PI * 2);
  octx.stroke();
  octx.strokeStyle = '#23201b';
  octx.lineWidth = h * 0.008;
  octx.beginPath();
  octx.arc(0, 0, wr * 0.82, 0, Math.PI * 2);
  octx.stroke();
  octx.strokeStyle = '#171310';
  octx.lineWidth = h * 0.017;
  for (const sa of [-0.5, Math.PI + 0.5, Math.PI * 0.5]) {
    octx.beginPath();
    octx.moveTo(0, 0);
    octx.lineTo(Math.cos(sa) * wr * 0.95, Math.sin(sa) * wr * 0.95);
    octx.stroke();
  }
  octx.fillStyle = '#12100d';
  octx.beginPath();
  octx.arc(0, 0, h * 0.045, 0, Math.PI * 2);
  octx.fill();
  /* hands at ten-to-two, gripping the rim */
  for (const ha of [-2.35, -0.75]) {
    const hx = Math.cos(ha) * wr, hy = Math.sin(ha) * wr;
    // sleeve
    octx.fillStyle = '#22201c';
    octx.beginPath();
    octx.ellipse(hx * 1.22, hy * 1.22, h * 0.035, h * 0.026, ha, 0, 7);
    octx.fill();
    // hand
    octx.fillStyle = '#a67c5a';
    octx.beginPath();
    octx.ellipse(hx, hy, h * 0.030, h * 0.022, ha, 0, 7);
    octx.fill();
    // knuckle shading
    octx.fillStyle = 'rgba(60,38,24,0.35)';
    octx.beginPath();
    octx.ellipse(hx + Math.cos(ha) * h * 0.012, hy + Math.sin(ha) * h * 0.012, h * 0.016, h * 0.010, ha, 0, 7);
    octx.fill();
  }
  octx.restore();

  /* gauges */
  const backlight = 0.35 + 0.55 * darkness;
  const gauge = (sx: number, sy: number, sr: number, frac: number) => {
    octx.fillStyle = 'rgba(18,13,6,0.97)';
    octx.beginPath(); octx.arc(sx, sy, sr, 0, 7); octx.fill();
    octx.strokeStyle = `rgba(217,160,40,${0.45 * backlight})`;
    octx.lineWidth = 2;
    octx.beginPath(); octx.arc(sx, sy, sr, 0, 7); octx.stroke();
    octx.strokeStyle = `rgba(217,160,40,${0.6 * backlight})`;
    for (let i = 0; i <= 8; i++) {
      const ta = Math.PI * 0.8 + (i / 8) * Math.PI * 1.4;
      octx.lineWidth = 1.4;
      octx.beginPath();
      octx.moveTo(sx + Math.cos(ta) * sr * 0.8, sy + Math.sin(ta) * sr * 0.8);
      octx.lineTo(sx + Math.cos(ta) * sr * 0.92, sy + Math.sin(ta) * sr * 0.92);
      octx.stroke();
    }
    const na = Math.PI * 0.8 + Math.min(1, frac) * Math.PI * 1.4;
    octx.strokeStyle = `rgba(228,178,60,${0.55 + 0.45 * backlight})`;
    octx.lineWidth = 2.4;
    octx.beginPath();
    octx.moveTo(sx, sy);
    octx.lineTo(sx + Math.cos(na) * sr * 0.78, sy + Math.sin(na) * sr * 0.78);
    octx.stroke();
  };
  gauge(w * 0.60, h * 0.905, h * 0.075, Math.abs(speed) * 3.6 / 160);
  gauge(w * 0.695, h * 0.925, h * 0.045, 0.62 + Math.sin(now * 0.05) * 0.05);

  /* radio face */
  const st = audio.currentStation;
  if (st) {
    const rx = w * 0.76, ry = h * 0.875, rw = w * 0.13, rh = h * 0.052;
    octx.fillStyle = 'rgba(6,12,8,0.97)';
    octx.fillRect(rx, ry, rw, rh);
    octx.strokeStyle = 'rgba(120,130,120,0.3)';
    octx.strokeRect(rx, ry, rw, rh);
    octx.strokeStyle = `rgba(140,220,120,${0.35 * backlight + 0.2})`;
    octx.lineWidth = 1;
    octx.beginPath();
    octx.moveTo(rx + 8, ry + rh * 0.68);
    octx.lineTo(rx + rw - 8, ry + rh * 0.68);
    octx.stroke();
    const fr = parseFloat(st.freq);
    const fx = rx + 8 + (rw - 16) * Math.min(1, Math.max(0, (fr - 87) / 21));
    octx.strokeStyle = st.type === 'sokoa' ? '#c85040' : '#8cdc78';
    octx.lineWidth = 2;
    octx.beginPath();
    octx.moveTo(fx, ry + rh * 0.5);
    octx.lineTo(fx, ry + rh * 0.86);
    octx.stroke();
    let label = `${st.freq}  ${st.name}`;
    if (inr > 0.45 && st.type !== 'sokoa' && Math.random() < inr * 0.5) {
      label = label.replace(/\d/g, () => '' + ((Math.random() * 10) | 0));
    }
    octx.fillStyle = st.type === 'sokoa'
      ? 'rgba(230,110,90,0.95)'
      : inr > 0.6 ? 'rgba(230,120,90,0.9)' : `rgba(140,220,120,${0.6 + 0.35 * backlight})`;
    octx.font = `${Math.round(h * 0.017)}px "Courier New", monospace`;
    octx.textAlign = 'center';
    octx.fillText(label, rx + rw / 2, ry + h * 0.021);
  }

  /* rear-view mirror */
  const mw = w * 0.19, mh = h * 0.05, mx = w * 0.5 - mw / 2, my = h * 0.045;
  octx.fillStyle = '#020303';
  octx.fillRect(mx, my, mw, mh);
  octx.strokeStyle = '#15130f';
  octx.lineWidth = 4;
  octx.strokeRect(mx, my, mw, mh);
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

  const offroad = Math.abs(laneX) > ROAD_HALF + 0.15 && Math.abs(speed) > 1;
  if (offroad) {
    speed -= speed * 0.55 * dt;
    shake = Math.max(shake, 0.35);
  }
  if (Math.abs(laneX) > 8) { laneX = Math.sign(laneX) * 8; laneV *= -0.25; }

  s += speed * dt;
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

  /* --- overlay + map --- */
  octx.clearRect(0, 0, innerWidth, innerHeight);
  if (interior && driving) drawInterior(dt, inr, rainI, day.darkness, inTun);
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
    `${interior ? 'cabina' : 'exterior'} · P pausa · ESC menú`;

  audio.update(dt, {
    speed, maxSpeed: MAX_SPEED, throttle: !!up,
    offroad, handbrake, rain: inTun ? 0.05 : rainI,
  });

  renderer.render(world.scene, camera);
}
toMenu();
frame();
