import * as THREE from 'three';
import './style.css';
import { World, ROAD_HALF } from './world';
import { GameAudio, RADIO_LABEL } from './audio';

/* ---------------------------------------------------------------- anomaly */
const CYCLE_LEN = 3600;            // metres before the road folds
const VILLAGE = 'VALDECIERVOS';
const CAPTIONS = [
  '',                              // cycle 0 → 1 transition uses index 1, etc.
  '¿no habíamos pasado ya por aquí?',
  'el pueblo se aleja.',
  'la carretera no termina.',
  'no mires el retrovisor.',
];

function hash(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function villageSign(s: number): { name: string; km: string } {
  const cycle = Math.floor(s / CYCLE_LEN);
  const cs = s % CYCLE_LEN;
  let km = 12 + cycle - Math.floor(cs / 300);
  if (km < 1) km = 1;
  let name = VILLAGE;
  const r = hash(Math.floor(s));
  if (cycle >= 1 && r < 0.18) km += 1;                    // the count stutters
  if (cycle >= 2 && r > 0.85) return { name: 'NO EXISTE', km: '' };
  if (cycle >= 3) {
    if (r < 0.25) name = 'SOVREICEDLAV';
    if (r > 0.92) return { name, km: '∞' };
    if (r > 0.78) km = -km;
  }
  return { name, km: `${km}` };
}

function kmMarker(s: number): { road: string; km: string } {
  const cycle = Math.floor(s / CYCLE_LEN);
  const km = cycle >= 2 ? 183 : 183 + Math.floor((s % CYCLE_LEN) / 250);
  return { road: 'N-666', km: `${km}` };
}

/* ------------------------------------------------------------------ setup */
const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
app.appendChild(renderer.domElement);

const world = new World({ villageSign, kmMarker });
const audio = new GameAudio();

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.08, 900);
world.scene.add(camera);
camera.add(world.rainObject);

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
  if (k === 'r') $('radio-row').textContent = 'radio · ' + RADIO_LABEL[audio.cycleRadio()];
  if (k === '9') s += CYCLE_LEN - (s % CYCLE_LEN) - 120; // debug: jump near the fold
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

/* -------------------------------------------------------------- car state */
const MAX_SPEED = 33;              // ~119 km/h; it is an old car
const MAX_REVERSE = 8;             // ~29 km/h in reverse
let s = 0;                         // distance along the road
let speed = 0;
let laneX = 1.7;                   // right lane
let laneV = 0;
let steer = 0;
let shake = 0;

/* anomaly bookkeeping */
let cycle = 0;
let gasCaptionCycle = -1;
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
let wiperPhase = 0;                // 0..1..0 ping-pong
let wiperDir = 1;
let prevBladeA = 0;

function bladeAngle(phase: number, from: number, to: number) {
  const e = 0.5 - 0.5 * Math.cos(phase * Math.PI); // eased
  return from + (to - from) * e;
}

function drawInterior(dt: number, inr: number) {
  const w = innerWidth, h = innerHeight;

  /* -- droplets accumulate on the half-res wet buffer ----------------- */
  const ww = wet.width, wh = wet.height;
  wctx.globalCompositeOperation = 'destination-out';
  wctx.fillStyle = 'rgba(0,0,0,0.012)';
  wctx.fillRect(0, 0, ww, wh);
  wctx.globalCompositeOperation = 'source-over';
  const spawn = 3 + speed * 0.12;
  for (let i = 0; i < spawn; i++) {
    if (Math.random() < 0.8) {
      const r = 0.6 + Math.random() * 1.8;
      wctx.fillStyle = `rgba(190,205,220,${0.25 + Math.random() * 0.3})`;
      wctx.beginPath();
      wctx.arc(Math.random() * ww, Math.random() * wh, r, 0, 7);
      wctx.fill();
    } else { // a runner streaking down
      const x0 = Math.random() * ww, y0 = Math.random() * wh * 0.6;
      wctx.strokeStyle = 'rgba(190,205,220,0.28)';
      wctx.lineWidth = 1.2;
      wctx.beginPath();
      wctx.moveTo(x0, y0);
      wctx.lineTo(x0 + (Math.random() - 0.5) * 4, y0 + 8 + Math.random() * 22);
      wctx.stroke();
    }
  }

  /* -- wiper sweep, erasing the wet buffer ---------------------------- */
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

  /* -- composite droplets over the scene ------------------------------ */
  octx.save();
  octx.globalAlpha = 0.55;
  octx.drawImage(wet, 0, 0, w, h);
  octx.restore();

  /* -- wiper blades ---------------------------------------------------- */
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
    prevBladeA = a;
  }

  /* -- dashboard -------------------------------------------------------- */
  const dashTop = h * 0.74;
  const g = octx.createLinearGradient(0, dashTop, 0, h);
  g.addColorStop(0, '#0e0c09');
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

  /* steering wheel */
  octx.save();
  octx.translate(w * 0.34, h * 1.10);
  octx.rotate(steer * 1.4);
  octx.strokeStyle = '#181512';
  octx.lineWidth = h * 0.028;
  octx.beginPath();
  octx.arc(0, 0, h * 0.30, 0, Math.PI * 2);
  octx.stroke();
  octx.lineWidth = h * 0.016;
  for (const sa of [-0.5, Math.PI + 0.5, Math.PI * 0.5]) {
    octx.beginPath();
    octx.moveTo(0, 0);
    octx.lineTo(Math.cos(sa) * h * 0.29, Math.sin(sa) * h * 0.29);
    octx.stroke();
  }
  octx.restore();

  /* speedometer, amber backlight */
  const sx = w * 0.62, sy = h * 0.905, sr = h * 0.075;
  octx.fillStyle = 'rgba(20,15,6,0.96)';
  octx.beginPath(); octx.arc(sx, sy, sr, 0, 7); octx.fill();
  octx.strokeStyle = 'rgba(217,160,40,0.5)';
  octx.lineWidth = 2;
  octx.beginPath(); octx.arc(sx, sy, sr, 0, 7); octx.stroke();
  octx.strokeStyle = 'rgba(217,160,40,0.65)';
  for (let i = 0; i <= 8; i++) {
    const ta = Math.PI * 0.8 + (i / 8) * Math.PI * 1.4;
    octx.lineWidth = 1.4;
    octx.beginPath();
    octx.moveTo(sx + Math.cos(ta) * sr * 0.8, sy + Math.sin(ta) * sr * 0.8);
    octx.lineTo(sx + Math.cos(ta) * sr * 0.92, sy + Math.sin(ta) * sr * 0.92);
    octx.stroke();
  }
  const na = Math.PI * 0.8 + Math.min(1, Math.abs(speed) * 3.6 / 160) * Math.PI * 1.4;
  octx.strokeStyle = '#e4b23c';
  octx.lineWidth = 2.4;
  octx.beginPath();
  octx.moveTo(sx, sy);
  octx.lineTo(sx + Math.cos(na) * sr * 0.78, sy + Math.sin(na) * sr * 0.78);
  octx.stroke();

  /* radio face */
  if (audio.radioMode !== 'off') {
    const rx = w * 0.76, ry = h * 0.88;
    octx.fillStyle = 'rgba(8,18,10,0.95)';
    octx.fillRect(rx, ry, w * 0.11, h * 0.034);
    let label = RADIO_LABEL[audio.radioMode].split(' · ')[0];
    if (inr > 0.45 && Math.random() < inr * 0.5) {
      label = label.replace(/\d/g, () => '' + ((Math.random() * 10) | 0));
    }
    octx.fillStyle = inr > 0.6 ? 'rgba(230,120,90,0.9)' : 'rgba(140,220,120,0.85)';
    octx.font = `${Math.round(h * 0.02)}px "Courier New", monospace`;
    octx.textAlign = 'center';
    octx.fillText(label, rx + w * 0.055, ry + h * 0.024);
  }

  /* rear-view mirror — and, late in the night, what follows you */
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
  if (!started) { renderer.render(world.scene, camera); return; }

  /* --- driving model --- */
  const up = keys['w'] || keys['arrowup'];
  const down = keys['s'] || keys['arrowdown'];
  const left = keys['a'] || keys['arrowleft'];
  const right = keys['d'] || keys['arrowright'];
  const handbrake = !!keys[' '];

  if (up) speed += 8.5 * dt;
  if (down) {
    if (speed > 0.4) speed -= 16 * dt;        // still rolling forward → brake hard
    else speed -= 7 * dt;                      // stopped/reversing → back up
  }
  if (handbrake) speed -= Math.sign(speed) * 14 * dt;
  // rolling resistance always opposes the current direction of travel
  speed -= Math.sign(speed) * (0.0009 * speed * speed + 0.11) * dt * 9;
  speed = THREE.MathUtils.clamp(speed, -MAX_REVERSE, MAX_SPEED);

  const grip = handbrake ? 0.3 : 1.0;
  const sIn = (left ? -1 : 0) + (right ? 1 : 0);
  steer = THREE.MathUtils.lerp(steer, sIn, 1 - Math.exp(-8 * dt));
  laneV += steer * (5 + 15 * (speed / MAX_SPEED)) * dt;
  laneV -= laneV * Math.min(1, 6.5 * grip * dt);
  laneV -= world.curvature(s) * speed * speed * dt;      // curves push you out
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

  const newCycle = Math.floor(s / CYCLE_LEN);
  if (newCycle > cycle) {                                  // the fold only advances
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

  shake = Math.max(0, shake - dt * 1.6);

  /* --- world + camera --- */
  world.update(dt, {
    s, speed, laneX,
    visualYaw: -(steer * 0.2 + laneV * 0.018),
    roll: -(steer * 0.05 + laneV * 0.012),
    headlights: world.headlightsOn,
    interior,
    braking: down || handbrake,
    time: performance.now() / 1000,
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

  /* --- overlay --- */
  octx.clearRect(0, 0, innerWidth, innerHeight);
  if (interior) drawInterior(dt, inr);

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
  rr.className = 'row ' + (audio.radioMode === 'off' ? 'dim' : inr > 0.5 ? 'radio-bad' : 'radio-on');
  if (audio.radioMode !== 'off' && inr > 0.5) {
    rr.textContent = 'radio · interferencia';
  } else if (audio.radioMode !== 'off') {
    rr.textContent = 'radio · ' + RADIO_LABEL[audio.radioMode];
  } else {
    rr.textContent = 'radio off';
  }
  $('state-row').textContent =
    `${world.headlightsOn ? 'luces' : 'luces off'} · ${wipers ? 'limpia' : 'limpia off'} · ${interior ? 'cabina' : 'exterior'}`;

  audio.update(dt, {
    speed, maxSpeed: MAX_SPEED, throttle: !!up,
    offroad, handbrake, rain: 0.8,
  });

  renderer.render(world.scene, camera);
}
frame();
