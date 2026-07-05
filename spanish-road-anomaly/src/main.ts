import * as THREE from 'three';
import './style.css';
import { World, ROAD_HALF } from './world';
import { GameAudio } from './audio';
import { sampleDay } from './daycycle';
import { MiniMap } from './map';
import { CYCLE_LEN, VILLAGES, DEST } from './route';

/* ---------------------------------------------------------------- anomaly */
const CAPTIONS = [
  '',
  '¿no habíamos pasado ya por aquí?',
  'donibane no se acerca.',
  'gaua ez da bukatzen.',            // the night is not ending
  'no mires el retrovisor.',
];

function hash(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
function reverse(str: string) { return str.split('').reverse().join(''); }

let cycle = 0;

/* roadside distance signs: next village over DONIBANE, both receding */
function distanceSign(s: number): { l1: string; l2: string } {
  const c = Math.floor(s / CYCLE_LEN);
  const cs = s % CYCLE_LEN;
  const next = VILLAGES.find(v => v.s > cs + 60) ?? VILLAGES[0];
  let km1 = Math.max(1, Math.round((next.s - cs) / 400));
  let name = next.name;
  let dest = `${DEST} ${23 + c}`;
  const r = hash(Math.floor(s));
  if (c >= 1 && r < 0.18) km1 += 1;
  if (c >= 2 && r > 0.86) return { l1: name + ' ' + km1, l2: 'EZ DA EXISTITZEN' };
  if (c >= 3) {
    if (r < 0.22) name = reverse(name);
    if (r > 0.90) dest = `${DEST} ∞`;
    else if (r > 0.76) dest = `${DEST} ${-(23 + c)}`;
  }
  return { l1: `${name} ${km1}`, l2: dest };
}

/* kilometre stones: N-121-B up to the muga, D 4 beyond it */
function kmMarker(s: number): { road: string; km: string } {
  const c = Math.floor(s / CYCLE_LEN);
  const cs = s % CYCLE_LEN;
  const fr = cs > 3700;
  if (c >= 2) return { road: fr ? 'D 4' : 'N-121-B', km: '13' };
  const km = fr ? 1 + Math.floor((cs - 3700) / 500) : 8 + Math.floor(cs / 500);
  return { road: fr ? 'D 4' : 'N-121-B', km: `${km}` };
}

/* village entry signs — eventually the towns are named wrong */
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
const audio = new GameAudio();
const map = new MiniMap();

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.08, 900);
world.scene.add(camera);
camera.add(world.rainObject);
world.attachSky(camera);

/* overlay canvas: windshield droplets, wipers, dashboard */
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

/* ------------------------------------------------------------------ input */
const keys: Record<string, boolean> = {};
let interior = false;
let wipers = true;
let started = false;

function radioRowText(): string {
  const st = audio.currentStation;
  return st ? `radio · ${st.freq} MHz · ${st.name}` : 'radio off';
}

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (!started) {
    started = true;
    document.getElementById('intro')!.classList.add('hidden');
    audio.start();
    return;
  }
  if (k === ' ') e.preventDefault();
  if (keys[k]) return;
  keys[k] = true;
  if (k === 'c') interior = !interior;
  if (k === 'l') world.headlightsOn = !world.headlightsOn;
  if (k === 'v') wipers = !wipers;
  if (k === 'm') map.toggle();
  if (k === 'r') { audio.cycleRadio(); $('radio-row').textContent = radioRowText(); }
  if (k === '9') s += CYCLE_LEN - (s % CYCLE_LEN) - 120; // debug: jump near the fold
  if (k === '8') s += 400;                                // debug: skip ahead
  if (k === '0') tDay = (tDay + 0.06) % 1;               // debug: advance the day
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

/* -------------------------------------------------------------- car state */
const MAX_SPEED = 33;              // ~119 km/h; it is an old car
const MAX_REVERSE = 8;             // ~29 km/h in reverse
const DAY_LEN = 540;               // seconds per full day
let s = 0;
let speed = 0;
let laneX = 1.7;
let laneV = 0;
let steer = 0;
let shake = 0;
let tDay = 0.76;                   // the drive starts at dusk
let now = 0;

/* anomaly bookkeeping */
let gasCaptionCycle = -1;
let borderCaptionShown = false;
let dawnBlockedShown = false;
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

/* --------------------------------------------------------------- wipers 2D */
let wiperPhase = 0;
let wiperDir = 1;

function bladeAngle(phase: number, from: number, to: number) {
  const e = 0.5 - 0.5 * Math.cos(phase * Math.PI);
  return from + (to - from) * e;
}

function drawInterior(dt: number, inr: number, rainI: number, darkness: number) {
  const w = innerWidth, h = innerHeight;

  /* droplets accumulate on the half-res wet buffer */
  const ww = wet.width, wh = wet.height;
  wctx.globalCompositeOperation = 'destination-out';
  wctx.fillStyle = 'rgba(0,0,0,0.012)';
  wctx.fillRect(0, 0, ww, wh);
  wctx.globalCompositeOperation = 'source-over';
  const spawn = (1 + Math.abs(speed) * 0.12) * (0.3 + rainI * 1.4);
  for (let i = 0; i < spawn; i++) {
    if (Math.random() > 0.82) {                       // a runner streaking down
      const x0 = Math.random() * ww, y0 = Math.random() * wh * 0.6;
      wctx.strokeStyle = 'rgba(200,214,228,0.30)';
      wctx.lineWidth = 1.2;
      wctx.beginPath();
      wctx.moveTo(x0, y0);
      wctx.lineTo(x0 + (Math.random() - 0.5) * 4, y0 + 8 + Math.random() * 24);
      wctx.stroke();
    } else {                                          // beaded droplet with a bright rim
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

  /* wiper sweep, erasing the wet buffer */
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

  /* wiper blades */
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

  /* A-pillars and headliner shadow */
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
  // dash top edge catches whatever light there is
  octx.strokeStyle = `rgba(180,170,150,${0.10 + 0.1 * (1 - darkness)})`;
  octx.lineWidth = 2;
  octx.beginPath();
  octx.moveTo(0, dashTop + 46);
  octx.quadraticCurveTo(w * 0.25, dashTop - 8, w * 0.5, dashTop + 6);
  octx.quadraticCurveTo(w * 0.75, dashTop + 18, w, dashTop + 2);
  octx.stroke();

  /* steering wheel: rim, hub, horn ring */
  octx.save();
  octx.translate(w * 0.34, h * 1.10);
  octx.rotate(steer * 1.4);
  octx.strokeStyle = '#191512';
  octx.lineWidth = h * 0.030;
  octx.beginPath();
  octx.arc(0, 0, h * 0.30, 0, Math.PI * 2);
  octx.stroke();
  octx.strokeStyle = '#23201b';
  octx.lineWidth = h * 0.008;
  octx.beginPath();
  octx.arc(0, 0, h * 0.245, 0, Math.PI * 2);
  octx.stroke();
  octx.strokeStyle = '#171310';
  octx.lineWidth = h * 0.017;
  for (const sa of [-0.5, Math.PI + 0.5, Math.PI * 0.5]) {
    octx.beginPath();
    octx.moveTo(0, 0);
    octx.lineTo(Math.cos(sa) * h * 0.285, Math.sin(sa) * h * 0.285);
    octx.stroke();
  }
  octx.fillStyle = '#12100d';
  octx.beginPath();
  octx.arc(0, 0, h * 0.045, 0, Math.PI * 2);
  octx.fill();
  octx.restore();

  /* gauges, amber backlight */
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
  gauge(w * 0.60, h * 0.905, h * 0.075, Math.abs(speed) * 3.6 / 160);      // speedo
  gauge(w * 0.695, h * 0.925, h * 0.045, 0.62 + Math.sin(now * 0.05) * 0.05); // fuel, roughly

  /* radio face */
  const st = audio.currentStation;
  if (st) {
    const rx = w * 0.76, ry = h * 0.875, rw = w * 0.13, rh = h * 0.052;
    octx.fillStyle = 'rgba(6,12,8,0.97)';
    octx.fillRect(rx, ry, rw, rh);
    octx.strokeStyle = 'rgba(120,130,120,0.3)';
    octx.strokeRect(rx, ry, rw, rh);
    // tuning band with needle
    octx.strokeStyle = `rgba(140,220,120,${0.35 * backlight + 0.2})`;
    octx.lineWidth = 1;
    octx.beginPath();
    octx.moveTo(rx + 8, ry + rh * 0.68);
    octx.lineTo(rx + rw - 8, ry + rh * 0.68);
    octx.stroke();
    const fr = parseFloat(st.freq);
    const fx = rx + 8 + (rw - 16) * Math.min(1, Math.max(0, (fr - 65) / 45));
    octx.strokeStyle = st.type === 'numbers' ? '#c85040' : '#8cdc78';
    octx.lineWidth = 2;
    octx.beginPath();
    octx.moveTo(fx, ry + rh * 0.5);
    octx.lineTo(fx, ry + rh * 0.86);
    octx.stroke();
    let label = `${st.freq}  ${st.name}`;
    if (inr > 0.45 && st.type !== 'numbers' && Math.random() < inr * 0.5) {
      label = label.replace(/\d/g, () => '' + ((Math.random() * 10) | 0));
    }
    octx.fillStyle = st.type === 'numbers'
      ? 'rgba(230,110,90,0.95)'
      : inr > 0.6 ? 'rgba(230,120,90,0.9)' : `rgba(140,220,120,${0.6 + 0.35 * backlight})`;
    octx.font = `${Math.round(h * 0.017)}px "Courier New", monospace`;
    octx.textAlign = 'center';
    octx.fillText(label, rx + rw / 2, ry + h * 0.021);
  }

  /* rear-view mirror — late in the night, something follows */
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

/* ------------------------------------------------------------------- loop */
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  now += dt;

  /* organic weather + daylight run even on the intro screen */
  const rainI = THREE.MathUtils.clamp(
    0.55 + 0.35 * Math.sin(now * 0.011) + 0.25 * Math.sin(now * 0.043 + 2), 0.12, 1);
  tDay = (tDay + dt / DAY_LEN) % 1;
  if (cycle >= 2 && tDay > 0.215 && tDay < 0.30) {
    tDay = 0.215;                                    // dawn stops coming
    if (!dawnBlockedShown) {
      dawnBlockedShown = true;
      showCaption(CAPTIONS[3], 5200);
    }
  }
  const day = sampleDay(tDay);
  renderer.toneMappingExposure = day.exposure;

  if (!started) {
    world.update(dt, {
      s, speed: 0, laneX, visualYaw: 0, roll: 0,
      interior: false, braking: false, time: now, tDay, day, rainI,
    });
    renderer.render(world.scene, camera);
    return;
  }

  /* --- driving model --- */
  const up = keys['w'] || keys['arrowup'];
  const down = keys['s'] || keys['arrowdown'];
  const left = keys['a'] || keys['arrowleft'];
  const right = keys['d'] || keys['arrowright'];
  const handbrake = !!keys[' '];

  if (up) speed += 8.5 * dt;
  if (down) {
    if (speed > 0.4) speed -= 16 * dt;
    else speed -= 7 * dt;
  }
  if (handbrake) speed -= Math.sign(speed) * 14 * dt;
  speed -= Math.sign(speed) * (0.0009 * speed * speed + 0.11) * dt * 9;
  speed = THREE.MathUtils.clamp(speed, -MAX_REVERSE, MAX_SPEED);

  const wetGrip = 1 - 0.25 * rainI;
  const grip = (handbrake ? 0.3 : 1.0) * wetGrip;
  const sIn = (left ? -1 : 0) + (right ? 1 : 0);
  steer = THREE.MathUtils.lerp(steer, sIn, 1 - Math.exp(-8 * dt));
  laneV += steer * (5 + 15 * (Math.abs(speed) / MAX_SPEED)) * dt * Math.sign(speed || 1);
  laneV -= laneV * Math.min(1, 6.5 * grip * dt);
  laneV -= world.curvature(s) * speed * speed * dt;
  laneX += laneV * dt;

  const offroad = Math.abs(laneX) > ROAD_HALF + 0.15 && Math.abs(speed) > 1;
  if (offroad) {
    speed -= speed * 0.55 * dt;
    shake = Math.max(shake, 0.35);
  }
  if (Math.abs(laneX) > 8) { laneX = Math.sign(laneX) * 8; laneV *= -0.25; }

  s += speed * dt;

  /* --- anomaly clock --- */
  const cs = s % CYCLE_LEN;
  const inr = Math.min(1, Math.max(0, (cs - (CYCLE_LEN - 500)) / 500) + Math.min(0.25, cycle * 0.07));
  audio.interference = inr;
  audio.numbersUnlocked = cycle >= 2;

  const newCycle = Math.floor(s / CYCLE_LEN);
  if (newCycle > cycle) {
    cycle = newCycle;
    runGlitch();
    const line = CAPTIONS[Math.min(cycle, CAPTIONS.length - 1)];
    setTimeout(() => showCaption(line), 900);
    world.mirrorOncoming = cycle >= 2;
  }
  if (world.gasStationS < s - 80) {
    world.setGasStationS(world.gasStationS + CYCLE_LEN);
  }
  if (cycle >= 1 && gasCaptionCycle !== cycle && Math.abs(world.gasStationS - s) < 28) {
    gasCaptionCycle = cycle;
    showCaption('la misma gasolinera.');
  }
  if (!borderCaptionShown && Math.abs(world.borderPostS - s) < 22) {
    borderCaptionShown = true;
    showCaption('la muga. no hay nadie.', 4200);
  }

  shake = Math.max(0, shake - dt * 1.6);

  /* --- world + camera --- */
  world.update(dt, {
    s, speed, laneX,
    visualYaw: -(steer * 0.2 + laneV * 0.018) * Math.sign(speed || 1),
    roll: -(steer * 0.05 + laneV * 0.012),
    interior,
    braking: down || handbrake,
    time: now, tDay, day, rainI,
  });

  const shx = (Math.random() - 0.5) * shake * 0.14;
  const shy = (Math.random() - 0.5) * shake * 0.1;
  if (interior) {
    camera.position.set(laneX - 0.35 + shx, 1.28 + shy, -7.55);
    camera.lookAt(laneX - 0.35 + steer * 1.2, 0.9, -46);
  } else {
    camera.position.set(laneX * 0.62 + shx, 2.55 + shy, 1.6);
    camera.lookAt(laneX * 0.82, 1.35, -25);
  }

  /* --- overlay + map --- */
  octx.clearRect(0, 0, innerWidth, innerHeight);
  if (interior) drawInterior(dt, inr, rainI, day.darkness);
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
  rr.className = 'row ' + (!st ? 'dim' : (inr > 0.5 && st.type !== 'numbers') ? 'radio-bad' : 'radio-on');
  rr.textContent = st && inr > 0.5 && st.type !== 'numbers' ? 'radio · interferencia' : radioRowText();
  $('state-row').textContent =
    `${world.headlightsOn ? 'luces' : 'luces off'} · ${wipers ? 'limpia' : 'limpia off'} · ` +
    `${interior ? 'cabina' : 'exterior'} · ${map.visible ? 'mapa' : 'M mapa'}`;

  audio.update(dt, {
    speed, maxSpeed: MAX_SPEED, throttle: !!up,
    offroad, handbrake, rain: rainI,
  });

  renderer.render(world.scene, camera);
}
frame();
