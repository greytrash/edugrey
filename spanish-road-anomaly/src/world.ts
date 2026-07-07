/* The road and everything beside it. Distance-space world: every prop lives
   at an absolute road-distance `s` and is projected into view through the
   road's lateral curve AND elevation profile, so the car stays at the origin
   while the Baztan climbs, the Otsondo tunnel swallows the sky, and the sea
   finally appears below the cliffs it will never let you reach. */

import * as THREE from 'three';
import { CYCLE_LEN, BORDER_S, GAS_S, VILLAGES, E, E1 } from './route';
import type { DayLight } from './daycycle';
import { sunElevation } from './daycycle';

export const ROAD_HALF = 3.6;
export const VIEW = 420;

const TUNNELS = [
  { s: 14150, len: 240 },   // under the Otsondo ridge
  { s: 42300, len: 180 },   // the coastal cut before Donibane
];
const BRIDGES = [10400, 33400];

export interface WorldHooks {
  distanceSign(s: number): { l1: string; l2: string };
  kmMarker(s: number): { road: string; km: string };
  villageEntry(routeIdx: number): { name: string; alt: string };
}

interface WorldState {
  s: number; speed: number; laneX: number;
  visualYaw: number; roll: number; pitch: number; bodyY: number;
  steer: number; wheelSpin: number;
  interior: boolean; braking: boolean;
  time: number; tDay: number; day: DayLight;
  rainI: number; cloud: number; lightning: boolean;
  damage: number;
}

/* lateral path: long sweepers, a mid wave, and tight rural kinks */
function F(s: number) {
  return 46 * Math.sin(s * 0.0029) + 24 * Math.sin(s * 0.0067 + 2.1) + 11 * Math.sin(s * 0.0151 + 0.8);
}
function F1(s: number) {
  return 46 * 0.0029 * Math.cos(s * 0.0029) + 24 * 0.0067 * Math.cos(s * 0.0067 + 2.1) + 11 * 0.0151 * Math.cos(s * 0.0151 + 0.8);
}
function F2(s: number) {
  return -46 * 0.0029 ** 2 * Math.sin(s * 0.0029) - 24 * 0.0067 ** 2 * Math.sin(s * 0.0067 + 2.1) - 11 * 0.0151 ** 2 * Math.sin(s * 0.0151 + 0.8);
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, x: c.getContext('2d')! };
}
function srgb(t: THREE.CanvasTexture) {
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------- textures */
function asphaltTexture(): THREE.CanvasTexture {
  const { c, x } = canvas(256, 256);
  x.fillStyle = '#1a1c1f';
  x.fillRect(0, 0, 256, 256);
  const img = x.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
  // patched tar seams
  x.strokeStyle = 'rgba(10,10,12,0.5)';
  x.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    x.beginPath();
    const px = Math.random() * 256;
    x.moveTo(px, Math.random() * 256);
    x.bezierCurveTo(px + 20, Math.random() * 256, px - 20, Math.random() * 256, px + (Math.random() - 0.5) * 60, Math.random() * 256);
    x.stroke();
  }
  x.fillStyle = 'rgba(214,214,206,0.72)';
  x.fillRect(10, 0, 5, 256);
  x.fillRect(241, 0, 5, 256);
  x.fillRect(125, 0, 6, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return srgb(t);
}

function stoneTexture(): THREE.CanvasTexture {
  const { c, x } = canvas(128, 128);
  x.fillStyle = '#7d7668';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(${40 + Math.random() * 60},${38 + Math.random() * 55},${30 + Math.random() * 50},0.5)`;
    x.beginPath();
    x.ellipse(Math.random() * 128, Math.random() * 128, 5 + Math.random() * 14, 4 + Math.random() * 8, Math.random() * 3, 0, 7);
    x.fill();
  }
  x.strokeStyle = 'rgba(30,28,22,0.45)';
  for (let i = 0; i < 26; i++) {
    x.strokeRect(Math.random() * 118, Math.random() * 118, 8 + Math.random() * 20, 5 + Math.random() * 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return srgb(t);
}

function concreteTexture(): THREE.CanvasTexture {
  const { c, x } = canvas(128, 128);
  x.fillStyle = '#5b5d58';
  x.fillRect(0, 0, 128, 128);
  const img = x.getImageData(0, 0, 128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
  x.strokeStyle = 'rgba(20,22,20,0.5)';
  for (let i = 0; i < 8; i++) {
    x.beginPath();
    x.moveTo(Math.random() * 128, 0);
    x.lineTo(Math.random() * 128, 128);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return srgb(t);
}

function villageSignTexture(name: string, alt: string, tex?: THREE.CanvasTexture): THREE.CanvasTexture {
  const w = 512, h = 224;
  const c = tex ? (tex.image as HTMLCanvasElement) : canvas(w, h).c;
  const x = c.getContext('2d')!;
  x.fillStyle = '#e9e7de';
  x.fillRect(0, 0, w, h);
  x.strokeStyle = '#8e2f22';
  x.lineWidth = 16;
  x.strokeRect(14, 14, w - 28, h - 28);
  x.fillStyle = '#17181a';
  x.textAlign = 'center';
  x.font = 'bold 78px "Arial Narrow", Arial, sans-serif';
  x.fillText(name, w / 2, alt ? 116 : 136, w - 80);
  if (alt) {
    x.font = 'italic 44px Georgia, serif';
    x.fillText(alt, w / 2, 178, w - 80);
  }
  if (tex) { tex.needsUpdate = true; return tex; }
  return srgb(new THREE.CanvasTexture(c));
}

function distSignTexture(l1: string, l2: string, tex?: THREE.CanvasTexture): THREE.CanvasTexture {
  const w = 512, h = 256;
  const c = tex ? (tex.image as HTMLCanvasElement) : canvas(w, h).c;
  const x = c.getContext('2d')!;
  x.fillStyle = '#e8e6dd';
  x.fillRect(0, 0, w, h);
  x.strokeStyle = '#17181a';
  x.lineWidth = 12;
  x.strokeRect(10, 10, w - 20, h - 20);
  x.fillStyle = '#17181a';
  x.textAlign = 'left';
  x.font = 'bold 62px "Arial Narrow", Arial, sans-serif';
  x.fillText(l1, 44, 106, w - 100);
  x.fillText(l2, 44, 200, w - 100);
  if (tex) { tex.needsUpdate = true; return tex; }
  return srgb(new THREE.CanvasTexture(c));
}

function kmStoneTexture(road: string, km: string, tex?: THREE.CanvasTexture): THREE.CanvasTexture {
  const w = 128, h = 160;
  const c = tex ? (tex.image as HTMLCanvasElement) : canvas(w, h).c;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ddd9cd';
  x.fillRect(0, 0, w, h);
  x.fillStyle = '#8e2f22';
  x.fillRect(0, 0, w, 34);
  x.fillStyle = '#f2efe6';
  x.textAlign = 'center';
  x.font = 'bold 22px Arial, sans-serif';
  x.fillText(road, w / 2, 25);
  x.fillStyle = '#17181a';
  x.font = 'bold 52px Arial, sans-serif';
  x.fillText(km, w / 2, 108);
  if (tex) { tex.needsUpdate = true; return tex; }
  return srgb(new THREE.CanvasTexture(c));
}

const SHOP_NAMES = ['OSTATUA', 'TABERNA GORRIA', 'OKINDEGIA', 'TAILERRA', 'DENDA', 'JATETXEA'];

/* Basque facade: whitewash, oxblood timbers; shops get a lit ground floor */
function facadeTextures(seed: number, shop?: string): { map: THREE.CanvasTexture; emiss: THREE.CanvasTexture } {
  const { c, x } = canvas(256, 256);
  const e = canvas(256, 256);
  x.fillStyle = '#ded6c6';
  x.fillRect(0, 0, 256, 256);
  const img = x.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
  // damp streaks under the eaves
  x.fillStyle = 'rgba(110,105,92,0.18)';
  for (let i = 0; i < 6; i++) {
    x.fillRect(20 + Math.random() * 216, 10, 3 + Math.random() * 5, 40 + Math.random() * 70);
  }
  x.fillStyle = '#7c2d1e';
  x.fillRect(0, 0, 256, 12);
  const nBeams = 3 + (seed % 3);
  for (let i = 0; i < nBeams; i++) {
    x.fillRect(20 + (i * 216) / (nBeams - 1 || 1), 0, 9, shop ? 150 : 256);
  }
  x.fillRect(0, 118, 256, 8);
  e.x.fillStyle = '#000';
  e.x.fillRect(0, 0, 256, 256);
  for (const [wx, wy] of [[58, 40], [160, 40]]) {
    x.fillStyle = '#241c14';
    x.fillRect(wx, wy, 38, 52);
    x.strokeStyle = '#7c2d1e';
    x.lineWidth = 5;
    x.strokeRect(wx - 3, wy - 3, 44, 58);
    x.fillRect(wx - 12, wy, 8, 52);
    x.fillRect(wx + 42, wy, 8, 52);
    if ((seed + wx) % 3 === 0) {
      e.x.fillStyle = '#ffb44a';
      e.x.fillRect(wx + 2, wy + 2, 34, 48);
    }
  }
  if (shop) {
    // awning + big lit shopfront + painted sign band
    x.fillStyle = '#17181a';
    x.fillRect(24, 170, 208, 70);
    x.fillStyle = '#7c2d1e';
    x.fillRect(16, 150, 224, 26);
    x.fillStyle = '#efe8d8';
    x.textAlign = 'center';
    x.font = 'bold 21px "Arial Narrow", Arial, sans-serif';
    x.fillText(shop, 128, 169, 210);
    e.x.fillStyle = '#ffcf7a';
    e.x.fillRect(30, 176, 196, 58);
  } else {
    for (const [wx, wy] of [[58, 150], [160, 150]]) {
      x.fillStyle = '#241c14';
      x.fillRect(wx, wy, 38, 52);
      x.strokeStyle = '#7c2d1e';
      x.lineWidth = 5;
      x.strokeRect(wx - 3, wy - 3, 44, 58);
      if ((seed + wy) % 4 === 0) {
        e.x.fillStyle = '#ffb44a';
        e.x.fillRect(wx + 2, wy + 2, 34, 48);
      }
    }
    x.fillStyle = '#3a2417';
    x.fillRect(108, 190, 42, 66);
  }
  return { map: srgb(new THREE.CanvasTexture(c)), emiss: srgb(new THREE.CanvasTexture(e.c)) };
}

/* organic cloud layer: fractal value-noise stamped into alpha */
function cloudTexture(seed: number): THREE.CanvasTexture {
  const W2 = 512, H2 = 256, { c, x } = canvas(W2, H2);
  const img = x.createImageData(W2, H2);
  const rnd = (n: number) => {
    const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const grid = 8;
  const vals: number[][] = [];
  for (let gy = 0; gy <= 64; gy++) {
    vals.push([]);
    for (let gx = 0; gx <= 128; gx++) vals[gy].push(rnd(gx + gy * 131));
  }
  const sample = (fx: number, fy: number, cell: number) => {
    const gx = (fx / cell), gy = (fy / cell);
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const tx = gx - x0, ty = gy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const idx = (xx: number, yy: number) => vals[yy % 64][(xx % 128 + 128) % 128];
    const a = idx(x0, y0), b = idx(x0 + 1, y0), cc = idx(x0, y0 + 1), d = idx(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy;
  };
  for (let py = 0; py < H2; py++) {
    for (let px = 0; px < W2; px++) {
      let v = 0, amp = 0.5, cell = 128;
      for (let o = 0; o < 4; o++) {
        v += sample(px, py, cell) * amp;
        amp *= 0.5; cell *= 0.5;
      }
      // flatten bottoms, billow tops
      const band = 1 - Math.abs(py / H2 - 0.45) * 1.7;
      const a = Math.max(0, (v - 0.52) * 2.6) * Math.max(0, band);
      const i = (py * W2 + px) * 4;
      const shade = 235 - v * 70;
      img.data[i] = shade; img.data[i + 1] = shade; img.data[i + 2] = shade + 6;
      img.data[i + 3] = Math.min(255, a * 300);
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return srgb(t);
}

function glowTexture(): THREE.CanvasTexture {
  const { c, x } = canvas(64, 64);
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,244,214,1)');
  g.addColorStop(0.4, 'rgba(255,236,190,0.35)');
  g.addColorStop(1, 'rgba(255,236,190,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function splashTexture(): THREE.CanvasTexture {
  const { c, x } = canvas(32, 32);
  x.strokeStyle = 'rgba(220,230,240,0.9)';
  x.lineWidth = 2;
  x.beginPath();
  x.ellipse(16, 18, 11, 5, 0, 0, 7);
  x.stroke();
  x.fillStyle = 'rgba(220,230,240,0.7)';
  for (const [px, py] of [[8, 10], [16, 6], [24, 10]]) {
    x.beginPath(); x.arc(px, py, 1.6, 0, 7); x.fill();
  }
  return new THREE.CanvasTexture(c);
}

/* ----------------------------------------------------------------- types */
interface Prop {
  obj: THREE.Object3D;
  s: number;
  lane: number;
  span: number;
  align?: boolean;
  refresh?: (p: Prop) => void;
  cr?: number;        // lateral collision radius (0/undefined = pass-through)
  crS?: number;       // half-extent along the road (for long objects)
  kind?: string;
}

export interface Collision {
  kind: string;
  penL: number;       // lateral penetration
  penS: number;       // along-road penetration
  signL: number;      // push direction laterally
  signS: number;      // push direction along road
  sev: number;        // 0..1 impact severity
}
interface FadeSprite { sp: THREE.Sprite; base: number }
interface Splash { sp: THREE.Sprite; life: number; d: number; lane: number }
interface VillageMember { obj: THREE.Object3D; ds: number; lane: number; yaw: number }
interface VillagePool {
  members: VillageMember[];
  signTex: THREE.CanvasTexture;
  arrowTex: THREE.CanvasTexture;
  lamps: THREE.PointLight[];
  centerS: number;
  routeIdx: number;
  side: number;
}

interface CarRig {
  root: THREE.Group;
  body: THREE.Group;
  wheels: THREE.Mesh[];
  frontWheels: THREE.Object3D[];
  paint: THREE.MeshStandardMaterial;
  shell: THREE.Mesh;
}

export class World {
  scene = new THREE.Scene();
  headlightsOn = true;
  mirrorOncoming = false;

  private hooks: WorldHooks;
  private props: Prop[] = [];
  private roadGeo!: THREE.BufferGeometry;
  private groundGeo!: THREE.BufferGeometry;
  private roadMat!: THREE.MeshStandardMaterial;
  private roadTex!: THREE.CanvasTexture;
  private rows = 84;
  private groundRows = 48;

  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private amb!: THREE.AmbientLight;
  private flash = 0;

  private skyCanvas!: HTMLCanvasElement;
  private skyTex!: THREE.CanvasTexture;
  private skyPlane!: THREE.Mesh;
  private cloudPlanes: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; speed: number }[] = [];
  private renderer: THREE.WebGLRenderer | null = null;
  private pmrem: THREE.PMREMGenerator | null = null;
  private envTimer = 0;
  private envRT: THREE.WebGLRenderTarget | null = null;

  private carRig!: CarRig;
  private headLeft!: THREE.SpotLight;
  private headRight!: THREE.SpotLight;
  private beamCones: THREE.Mesh[] = [];
  private fadeSprites: FadeSprite[] = [];
  private tailMats: THREE.MeshStandardMaterial[] = [];
  private reflStreaks: THREE.Mesh[] = [];

  private rain!: THREE.LineSegments;
  private drops: { p: THREE.Vector3 }[] = [];
  private RAIN_COUNT = 420;
  private splashes: Splash[] = [];
  private glowTex = glowTexture();
  private splashTex = splashTexture();
  private stoneTex = stoneTexture();
  private concreteTex = concreteTexture();

  private houseEmissMats: THREE.MeshStandardMaterial[] = [];
  private lampMats: THREE.MeshStandardMaterial[] = [];
  private villages: VillagePool[] = [];

  private gas!: THREE.Group;
  private gasLight!: THREE.PointLight;
  private gasSignMat!: THREE.MeshStandardMaterial;
  private gasS = GAS_S;
  private border!: THREE.Group;
  private borderS = BORDER_S;
  private tunnels: { g: THREE.Group; s: number; len: number }[] = [];
  private sea!: THREE.Group;
  private seaS = 43200;

  private oncoming: { g: THREE.Group; rig: CarRig; s: number; v: number; lane: number }[] = [];
  private fogBlend = new THREE.Color();

  constructor(hooks: WorldHooks) {
    this.hooks = hooks;
    const sc = this.scene;
    sc.fog = new THREE.FogExp2('#06090f', 0.011);

    this.sun = new THREE.DirectionalLight('#fff2dd', 1.8);
    this.sun.position.set(35, 60, -80);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 40;
    this.sun.shadow.camera.bottom = -40;
    this.sun.shadow.camera.far = 220;
    this.sun.shadow.bias = -0.0015;
    sc.add(this.sun);
    sc.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight('#93a2b4', '#20241c', 0.5);
    sc.add(this.hemi);
    this.amb = new THREE.AmbientLight('#404860', 0.12);
    sc.add(this.amb);

    this.buildSky();
    this.buildGround();
    this.buildRoad();
    this.buildCar();
    this.buildRain();
    this.buildGasStation();
    this.buildBorder();
    this.buildTunnels();
    this.buildSea();
    this.buildOncoming();
    this.buildVillages();
    this.populate();
  }

  curvature(s: number) { return F2(s); }
  grade(s: number) { return E1(s); }
  /* view-space offset of the road `d` metres ahead — for camera look-ahead */
  aheadPoint(s: number, d: number): { x: number; y: number } {
    return { x: this.off(s, s + d), y: this.lift(s, s + d) };
  }
  get gasStationS() { return this.gasS; }
  setGasStationS(s: number) { this.gasS = s; }
  get borderPostS() { return this.borderS; }
  get rainObject() { return this.rain; }

  inTunnel(s: number): boolean {
    const cs = ((s % CYCLE_LEN) + CYCLE_LEN) % CYCLE_LEN;
    return TUNNELS.some(t => cs > t.s - 8 && cs < t.s + t.len + 8);
  }

  private flickerT = 0;
  flickerHeadlights(seconds = 0.5) { this.flickerT = seconds; }
  lightningFlash() { this.flash = 1; }

  bindRenderer(r: THREE.WebGLRenderer) {
    this.renderer = r;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pmrem = new THREE.PMREMGenerator(r);
  }

  private off(s: number, s2: number) {
    return F(s2) - F(s) - F1(s) * (s2 - s);
  }
  private lift(s: number, s2: number) {
    return E(s2) - E(s) - E1(s) * (s2 - s);
  }
  private yawAt(s: number, s2: number) {
    return -(F1(s2) - F1(s));
  }

  /* ---------------------------------------------------------------- sky */
  private buildSky() {
    this.skyCanvas = canvas(512, 512).c;
    this.skyTex = srgb(new THREE.CanvasTexture(this.skyCanvas));
    const mat = new THREE.MeshBasicMaterial({ map: this.skyTex, depthWrite: false, fog: false });
    this.skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.skyPlane.renderOrder = -10;
    this.skyPlane.frustumCulled = false;
    // two drifting cloud decks with real noise in them
    for (const [depth, speed, seed] of [[430, 1.6, 1], [400, 3.4, 7]] as const) {
      const tex = cloudTexture(seed);
      const cm = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.5, depthWrite: false, fog: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cm);
      mesh.renderOrder = -9;
      mesh.frustumCulled = false;
      this.cloudPlanes.push({ mesh, mat: cm, speed });
      void depth;
    }
  }
  attachSky(camera: THREE.PerspectiveCamera) {
    camera.add(this.skyPlane);
    for (const c of this.cloudPlanes) camera.add(c.mesh);
    this.sizeSky(camera);
  }
  sizeSky(camera: THREE.PerspectiveCamera) {
    const d = 460;
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d;
    this.skyPlane.position.set(0, 40, -d);
    this.skyPlane.scale.set(h * camera.aspect * 1.35, h * 1.35, 1);
    this.cloudPlanes.forEach((c, i) => {
      const cd = 430 - i * 26;
      const ch = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * cd;
      c.mesh.position.set(0, 105 + i * 40, -cd);
      c.mesh.scale.set(ch * camera.aspect * 1.6, ch * 0.6, 1);
    });
  }

  private drawSky(day: DayLight, tDay: number, time: number, cloud: number) {
    const x = this.skyCanvas.getContext('2d')!;
    const W = 512, H = 512, HOR = H * 0.60;
    const g = x.createLinearGradient(0, 0, 0, HOR);
    g.addColorStop(0, '#' + day.skyTop.getHexString());
    g.addColorStop(1, '#' + day.skyHorizon.getHexString());
    x.fillStyle = g;
    x.fillRect(0, 0, W, HOR);
    x.fillStyle = '#' + this.fogBlend.getHexString();
    x.fillRect(0, HOR, W, H - HOR);

    const elev = sunElevation(tDay);
    if (elev > 0.01) {
      const t = ((tDay % 1) + 1) % 1;
      const sx = W * (0.5 + 0.28 * Math.cos(Math.PI * (t - 0.25) / 0.55));
      const sy = HOR - HOR * 0.82 * elev;
      const sg = x.createRadialGradient(sx, sy, 4, sx, sy, 90);
      const soft = 1 - cloud * 0.5;
      sg.addColorStop(0, `rgba(255,236,200,${(0.55 + 0.3 * elev) * soft})`);
      sg.addColorStop(0.25, `rgba(255,230,190,${0.20 * soft})`);
      sg.addColorStop(1, 'rgba(255,230,190,0)');
      x.fillStyle = sg;
      x.fillRect(0, 0, W, HOR + 30);
    }
    if (day.darkness > 0.5) {
      const mx = W * 0.68, my = H * 0.16;
      const mg = x.createRadialGradient(mx, my, 3, mx, my, 60);
      mg.addColorStop(0, `rgba(205,215,232,${0.65 * day.darkness * (1 - cloud * 0.55)})`);
      mg.addColorStop(0.2, `rgba(195,205,225,${0.18 * day.darkness})`);
      mg.addColorStop(1, 'rgba(195,205,225,0)');
      x.fillStyle = mg;
      x.fillRect(0, 0, W, HOR);
    }
    if (this.flash > 0) {
      x.fillStyle = `rgba(235,240,255,${this.flash * 0.75})`;
      x.fillRect(0, 0, W, H);
    }
    // far ridge silhouettes (Larrun's double hump among them)
    x.fillStyle = `rgba(14,18,14,${0.45 + 0.3 * day.darkness})`;
    x.beginPath();
    x.moveTo(0, HOR);
    for (let px = 0; px <= W; px += 8) {
      const larrun = 34 * Math.exp(-(((px - 340) / 60) ** 2)) + 26 * Math.exp(-(((px - 400) / 40) ** 2));
      x.lineTo(px, HOR - 12 - Math.abs(Math.sin(px * 0.013) * 20 + Math.sin(px * 0.037) * 8) - larrun);
    }
    x.lineTo(W, HOR);
    x.closePath();
    x.fill();
    void time;
    this.skyTex.needsUpdate = true;
  }

  /* refresh scene.environment from the sky so glass and chrome live */
  private refreshEnv(day: DayLight) {
    if (!this.pmrem) return;
    const { c, x } = canvas(64, 32);
    const g = x.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, '#' + day.skyTop.getHexString());
    g.addColorStop(0.55, '#' + day.skyHorizon.getHexString());
    g.addColorStop(0.62, '#' + this.fogBlend.getHexString());
    g.addColorStop(1, '#1a1d18');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const rt = this.pmrem.fromEquirectangular(tex);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    tex.dispose();
  }

  /* ------------------------------------------------------- road + ground */
  private buildRoad() {
    const rows = this.rows;
    const pos = new Float32Array((rows + 1) * 2 * 3);
    const uv = new Float32Array((rows + 1) * 2 * 2);
    const idx: number[] = [];
    for (let i = 0; i <= rows; i++) {
      const d = (i / rows) * VIEW;
      pos.set([-ROAD_HALF, 0, -d, ROAD_HALF, 0, -d], i * 6);
      uv.set([0, d / 6, 1, d / 6], i * 4);
      if (i < rows) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.roadGeo = new THREE.BufferGeometry();
    this.roadGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.roadGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.roadGeo.setIndex(idx);
    this.roadGeo.computeVertexNormals();
    this.roadTex = asphaltTexture();
    this.roadMat = new THREE.MeshStandardMaterial({
      map: this.roadTex, roughness: 0.25, metalness: 0.35, envMapIntensity: 1.2,
    });
    const road = new THREE.Mesh(this.roadGeo, this.roadMat);
    road.position.y = 0.01;
    road.receiveShadow = true;
    this.scene.add(road);
  }

  /* four columns per row: the outer left wing can sink toward the bay
     on the coastal stretch while the road shoulder stays level */
  private buildGround() {
    const rows = this.groundRows;
    const COLS = [-340, -10, 10, 340];
    const pos = new Float32Array((rows + 1) * COLS.length * 3);
    const idx: number[] = [];
    for (let i = 0; i <= rows; i++) {
      const d = (i / rows) * (VIEW + 80) - 40;
      for (let c = 0; c < COLS.length; c++) {
        pos.set([COLS[c], -0.06, -d], (i * COLS.length + c) * 3);
      }
      if (i < rows) {
        for (let c = 0; c < COLS.length - 1; c++) {
          const a = i * COLS.length + c;
          const b = a + COLS.length;
          idx.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    this.groundGeo = new THREE.BufferGeometry();
    this.groundGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.groundGeo.setIndex(idx);
    this.groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(
      this.groundGeo,
      new THREE.MeshStandardMaterial({ color: '#1c2415', roughness: 1 })
    );
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  /* how far the land has fallen away to the sea at absolute distance s */
  private coastDrop(sAbs: number): number {
    const cs = ((sAbs % CYCLE_LEN) + CYCLE_LEN) % CYCLE_LEN;
    const t = Math.min(1, Math.max(0, (cs - 41200) / 900));
    return 46 * t * t * (3 - 2 * t);
  }

  /* --------------------------------------------------------------- car */
  private buildCarBody(bodyColor: string, detailed: boolean): CarRig {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    // weathered paint with subtle roughness variation
    const rc = canvas(64, 64);
    rc.x.fillStyle = '#777';
    rc.x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 40; i++) {
      rc.x.fillStyle = `rgba(${120 + Math.random() * 60},${120 + Math.random() * 60},${120 + Math.random() * 60},0.35)`;
      rc.x.beginPath();
      rc.x.arc(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 8, 0, 7);
      rc.x.fill();
    }
    const roughMap = new THREE.CanvasTexture(rc.c);
    const paint = new THREE.MeshStandardMaterial({
      color: bodyColor, roughness: 0.42, metalness: 0.35,
      roughnessMap: roughMap, envMapIntensity: 0.9,
    });

    /* side profile with real wheel-arch cutouts, extruded to width */
    const sh = new THREE.Shape();
    sh.moveTo(-2.10, 0.30);
    sh.lineTo(-2.12, 0.58);
    sh.lineTo(-1.92, 0.74);      // trunk lip
    sh.lineTo(-1.00, 0.80);      // rear deck
    sh.lineTo(1.02, 0.80);       // beltline
    sh.lineTo(1.18, 0.76);       // hood start
    sh.lineTo(1.94, 0.68);       // hood slope
    sh.lineTo(2.12, 0.55);       // nose
    sh.lineTo(2.10, 0.28);
    sh.lineTo(1.74, 0.12);
    sh.lineTo(1.68, 0.12);
    sh.absarc(1.30, 0.12, 0.42, 0, Math.PI, false);   // front arch
    sh.lineTo(-0.92, 0.12);
    sh.absarc(-1.30, 0.12, 0.42, 0, Math.PI, false);  // rear arch
    sh.lineTo(-1.74, 0.12);
    sh.closePath();
    const bodyGeo = new THREE.ExtrudeGeometry(sh, { depth: 1.62, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    bodyGeo.rotateY(Math.PI / 2);
    bodyGeo.translate(-0.81 - 0.03, 0.10, 0);
    const bodyMesh = new THREE.Mesh(bodyGeo, paint);
    bodyMesh.castShadow = true;
    body.add(bodyMesh);

    /* raked glasshouse */
    const gh = new THREE.Shape();
    gh.moveTo(-0.94, 0.80);
    gh.lineTo(-0.68, 1.16);      // rear screen rake
    gh.lineTo(0.40, 1.19);       // roof
    gh.lineTo(0.86, 0.82);       // windshield rake
    gh.closePath();
    const glassGeo = new THREE.ExtrudeGeometry(gh, { depth: 1.44, bevelEnabled: false });
    glassGeo.rotateY(Math.PI / 2);
    glassGeo.translate(-0.72, 0.10, 0);
    const glass = new THREE.MeshStandardMaterial({
      color: '#0b0e11', roughness: 0.06, metalness: 0.9, envMapIntensity: 1.4,
    });
    const glassMesh = new THREE.Mesh(glassGeo, glass);
    glassMesh.castShadow = true;
    body.add(glassMesh);
    // roof cap in paint so the greenhouse isn't all glass
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.40, 0.05, 1.06), paint);
    roof.position.set(0, 1.30, 0.12);
    body.add(roof);

    const chrome = new THREE.MeshStandardMaterial({ color: '#b8bec4', roughness: 0.15, metalness: 1.0, envMapIntensity: 1.3 });
    const addB = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      body.add(m);
      return m;
    };
    addB(new THREE.BoxGeometry(1.74, 0.10, 0.16), chrome, 0, 0.34, -2.14);
    addB(new THREE.BoxGeometry(1.74, 0.10, 0.16), chrome, 0, 0.36, 2.14);
    addB(new THREE.BoxGeometry(1.00, 0.16, 0.04), new THREE.MeshStandardMaterial({ color: '#20242a', roughness: 0.5, metalness: 0.6 }), 0, 0.58, -2.13);
    addB(new THREE.BoxGeometry(0.40, 0.11, 0.02), new THREE.MeshStandardMaterial({ color: '#e5e2d5', roughness: 0.5 }), 0, 0.42, 2.15);
    if (detailed) {
      for (const mx of [-0.90, 0.90]) {
        addB(new THREE.BoxGeometry(0.06, 0.09, 0.13), chrome, mx, 0.94, -0.62);
      }
      // door seam hint
      const seam = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.015, 0.012),
        new THREE.MeshStandardMaterial({ color: '#54514a', roughness: 0.8 }));
      seam.position.set(0, 0.62, -0.10);
      body.add(seam);
    }

    /* wheels: tire + rim + hubcap, spinning, front pair steerable */
    const wheels: THREE.Mesh[] = [];
    const frontWheels: THREE.Object3D[] = [];
    const tireMat = new THREE.MeshStandardMaterial({ color: '#0d0d0e', roughness: 0.95 });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#9aa0a4', roughness: 0.25, metalness: 0.9, envMapIntensity: 1.1 });
    for (const [wx, wz, front] of [[-0.80, -1.30, 1], [0.80, -1.30, 1], [-0.80, 1.30, 0], [0.80, 1.30, 0]] as const) {
      const pivot = new THREE.Object3D();
      pivot.position.set(wx, 0.34, wz);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 20), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.23, 14), rimMat);
      rim.rotation.z = Math.PI / 2;
      tire.add(rim);
      pivot.add(tire);
      root.add(pivot);
      wheels.push(tire);
      if (front) frontWheels.push(pivot);
    }

    return { root, body, wheels, frontWheels, paint, shell: bodyMesh };
  }

  private playerShell!: THREE.Mesh;
  private shellOrig!: Float32Array;

  private buildCar() {
    this.carRig = this.buildCarBody('#e2dfd6', true);
    const g = this.carRig.root;
    this.playerShell = this.carRig.shell;
    this.shellOrig = (this.playerShell.geometry.getAttribute('position').array as Float32Array).slice();

    const lampMat = new THREE.MeshStandardMaterial({
      color: '#fff3cf', emissive: '#ffedb8', emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.4,
    });
    const bezel = new THREE.MeshStandardMaterial({ color: '#b8bec4', roughness: 0.2, metalness: 1 });
    for (const lx of [-0.58, 0.58]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.05, 14), bezel);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(lx, 0.58, -2.10);
      this.carRig.body.add(ring);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 8), lampMat);
      lamp.position.set(lx, 0.58, -2.11);
      this.carRig.body.add(lamp);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: '#ffedb8', transparent: true,
        opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.position.set(lx, 0.58, -2.2);
      glow.scale.setScalar(1.3);
      this.carRig.body.add(glow);
      this.fadeSprites.push({ sp: glow, base: 0.75 });

      const tail = new THREE.MeshStandardMaterial({
        color: '#3a0d08', emissive: '#c03020', emissiveIntensity: 0.5, roughness: 0.4,
      });
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.05), tail);
      t.position.set(lx, 0.64, 2.13);
      this.carRig.body.add(t);
      this.tailMats.push(tail);
    }

    for (const lx of [-0.55, 0.55]) {
      const sp = new THREE.SpotLight('#ffe9c2', 1100, 160, 0.34, 0.55, 1.35);
      sp.position.set(lx, 0.62, -1.9);
      const target = new THREE.Object3D();
      target.position.set(lx * 0.5, -0.4, -34);
      g.add(target);
      sp.target = target;
      g.add(sp);
      if (lx < 0) this.headLeft = sp; else this.headRight = sp;

      const coneGeo = new THREE.ConeGeometry(2.1, 21, 14, 1, true);
      const coneMat = new THREE.MeshBasicMaterial({
        color: '#ffeecb', transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.rotation.x = Math.PI / 2;
      cone.position.set(lx, 0.55, -12.3);
      g.add(cone);
      this.beamCones.push(cone);

      // wet-road reflection streak under each beam
      const streak = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 10),
        new THREE.MeshBasicMaterial({
          map: this.glowTex, color: '#ffe9c2', transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      streak.rotation.x = -Math.PI / 2;
      streak.position.set(lx, 0.03, -8);
      g.add(streak);
      this.reflStreaks.push(streak);
    }

    g.position.set(1.7, 0, -8);
    this.scene.add(g);
  }

  private buildOncoming() {
    const colors = ['#23272c', '#6b1f18', '#3d4a3f'];
    for (let i = 0; i < 3; i++) {
      const rig = this.buildCarBody(colors[i], false);
      const g = rig.root;
      g.rotation.y = Math.PI;
      for (const lx of [-0.58, 0.58]) {
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.glowTex, color: '#f4f0dc', transparent: true,
          opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        glow.position.set(lx, 0.58, -2.15);
        glow.scale.setScalar(2.6);
        g.add(glow);
        this.fadeSprites.push({ sp: glow, base: 0.9 });
      }
      const spill = new THREE.PointLight('#e8e2c8', 16, 28, 1.6);
      spill.position.set(0, 0.7, -2.4);
      g.add(spill);
      const streak = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 12),
        new THREE.MeshBasicMaterial({
          map: this.glowTex, color: '#f4f0dc', transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      streak.rotation.x = -Math.PI / 2;
      streak.position.set(0, 0.03, -8);
      g.add(streak);
      this.reflStreaks.push(streak);
      this.scene.add(g);
      this.oncoming.push({ g, rig, s: 600 + i * 900, v: 18 + Math.random() * 8, lane: -1.75 });
    }
  }

  /* crumple the player's bodywork at the point of impact. front = -z
     (headlights), left = -x, right = +x. Dents accumulate; capped by amt. */
  private _dv = new THREE.Vector3();
  private _dc = new THREE.Vector3();
  dentCar(sev: number, mode: 'front' | 'left' | 'right') {
    const geo = this.playerShell.geometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const c = this._dc;
    const dir = this._dv;
    if (mode === 'front') { c.set(0, 0.42, -2.0); dir.set(0, -0.15, 1); }
    else if (mode === 'left') { c.set(-0.85, 0.5, 0); dir.set(1, -0.1, 0); }
    else { c.set(0.85, 0.5, 0); dir.set(-1, -0.1, 0); }
    dir.normalize();
    const R = 1.5, amt = Math.min(0.42, sev * 0.5);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const d = v.distanceTo(c);
      if (d < R) {
        const f = (1 - d / R) * amt;
        v.addScaledVector(dir, f);
        v.x += (Math.random() - 0.5) * f * 0.35;
        v.y += (Math.random() - 0.5) * f * 0.22;
        pos.setXYZ(i, v.x, v.y, v.z);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /* beat the panels back out — called when the chassis is fully repaired */
  repairCar() {
    const pos = this.playerShell.geometry.getAttribute('position') as THREE.BufferAttribute;
    (pos.array as Float32Array).set(this.shellOrig);
    pos.needsUpdate = true;
    this.playerShell.geometry.computeVertexNormals();
  }

  /* road-relative collision test against tagged props and oncoming cars.
     Everything lives in (s, lane) space; the visual curve is ignored here. */
  collide(carS: number, carLane: number): Collision | null {
    const HW = 0.85, HL = 2.05;
    let best: Collision | null = null;
    const consider = (pS: number, pLane: number, rS: number, rL: number, kind: string) => {
      const penS = (HL + rS) - Math.abs(pS - carS);
      const penL = (HW + rL) - Math.abs(pLane - carLane);
      if (penS <= 0 || penL <= 0) return;
      const sep = Math.min(penS, penL);
      if (best && sep <= best.sev * 0) return;         // keep the deepest
      if (!best || sep > Math.min(best.penS, best.penL)) {
        best = {
          kind, penL, penS,
          signL: Math.sign(carLane - pLane) || 1,
          signS: Math.sign(carS - pS) || 1,
          sev: 0,
        };
      }
    };
    for (const p of this.props) {
      if (!p.cr) continue;
      const d = p.s - carS;
      if (d < -12 || d > 30) continue;                 // cheap cull
      consider(p.s, p.lane, p.crS ?? p.cr, p.cr, p.kind ?? 'obs');
    }
    for (const oc of this.oncoming) {
      if (!oc.g.visible) continue;
      const d = oc.s - carS;
      if (d < -8 || d > 12) continue;
      consider(oc.s, oc.lane, 2.0, 0.9, 'car');
    }
    return best;
  }

  /* ------------------------------------------------------------ landmarks */
  private buildGasStation() {
    const g = new THREE.Group();
    const wall = new THREE.MeshStandardMaterial({ color: '#31332e', roughness: 0.9 });
    const shop = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 4.6), wall);
    shop.position.set(6, 1.6, -2);
    shop.castShadow = true;
    g.add(shop);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(9, 0.35, 7),
      new THREE.MeshStandardMaterial({ color: '#3a3c37', roughness: 0.8 }));
    canopy.position.set(0, 4.2, 0);
    canopy.castShadow = true;
    g.add(canopy);
    const poleMat = new THREE.MeshStandardMaterial({ color: '#43453f', roughness: 0.7 });
    for (const [px, pz] of [[-3.6, -2.6], [3.6, -2.6], [-3.6, 2.6], [3.6, 2.6]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.2, 8), poleMat);
      p.position.set(px, 2.1, pz);
      g.add(p);
    }
    for (const px of [-1.4, 1.2]) {
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.5, 0.4),
        new THREE.MeshStandardMaterial({ color: '#5c2620', roughness: 0.6 }));
      pump.position.set(px, 0.75, 0.4);
      g.add(pump);
    }
    const { c, x } = canvas(256, 96);
    x.fillStyle = '#0d1f14';
    x.fillRect(0, 0, 256, 96);
    x.strokeStyle = '#7fae6a';
    x.lineWidth = 4;
    x.strokeRect(6, 6, 244, 84);
    x.fillStyle = '#9fd88a';
    x.textAlign = 'center';
    x.font = 'bold 40px "Arial Narrow", Arial, sans-serif';
    x.fillText('GASOLINERA', 128, 62);
    const signTex = srgb(new THREE.CanvasTexture(c));
    this.gasSignMat = new THREE.MeshStandardMaterial({
      map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.9, roughness: 0.6,
    });
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 6.4, 8), poleMat);
    pylon.position.set(-5.5, 3.2, 2.4);
    g.add(pylon);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.3), this.gasSignMat);
    sign.position.set(-5.5, 5.6, 2.35);
    g.add(sign);
    this.gasLight = new THREE.PointLight('#cfe8b8', 0, 26, 1.6);
    this.gasLight.position.set(0, 3.7, 0);
    g.add(this.gasLight);
    this.gas = g;
    this.scene.add(g);
  }

  private buildBorder() {
    const g = new THREE.Group();
    const boothMat = new THREE.MeshStandardMaterial({ color: '#d8d4c6', roughness: 0.7 });
    const booth = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.7, 2.2), boothMat);
    booth.position.set(5.6, 1.35, 0);
    booth.castShadow = true;
    g.add(booth);
    const roofB = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.2, 2.8),
      new THREE.MeshStandardMaterial({ color: '#5c2620', roughness: 0.8 }));
    roofB.position.set(5.6, 2.85, 0);
    g.add(roofB);
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.5, 2.25),
      new THREE.MeshStandardMaterial({ color: '#1a1c20', roughness: 0.3, metalness: 0.4 }));
    band.position.set(5.6, 1.7, 0);
    g.add(band);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.3, 8),
      new THREE.MeshStandardMaterial({ color: '#8e2f22', roughness: 0.6 }));
    post.position.set(4.2, 0.65, 1.6);
    g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.4, 0.12),
      new THREE.MeshStandardMaterial({ color: '#d8d4c6', roughness: 0.6 }));
    arm.position.set(4.2, 3.0, 1.6);
    arm.rotation.z = 0.28;
    g.add(arm);
    const { c, x } = canvas(512, 160);
    x.fillStyle = '#dcd8ca';
    x.fillRect(0, 0, 512, 160);
    x.strokeStyle = '#17181a';
    x.lineWidth = 10;
    x.strokeRect(8, 8, 496, 144);
    x.fillStyle = '#17181a';
    x.textAlign = 'center';
    x.font = 'bold 56px "Arial Narrow", Arial, sans-serif';
    x.fillText('MUGA · DOUANE', 256, 72);
    x.font = 'italic 34px Georgia, serif';
    x.fillText('France · Frantzia', 256, 126);
    const tex = srgb(new THREE.CanvasTexture(c));
    const signMat = new THREE.MeshStandardMaterial({
      map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.15, roughness: 0.5,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.1), signMat);
    sign.position.set(-5.4, 2.6, 0.06);
    sign.rotation.y = 0.10;
    g.add(sign);
    const legMat = new THREE.MeshStandardMaterial({ color: '#7c8288', roughness: 0.4, metalness: 0.7 });
    for (const lx of [-6.2, -4.6]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), legMat);
      leg.position.set(lx, 1.3, -0.03);   // posts BEHIND the board
      g.add(leg);
    }
    this.border = g;
    this.scene.add(g);
  }

  private buildTunnels() {
    for (const t of TUNNELS) {
      const g = new THREE.Group();
      const conc = new THREE.MeshStandardMaterial({ map: this.concreteTex, roughness: 0.9 });
      // portal faces with arch opening at both ends
      for (const end of [0, 1]) {
        const face = new THREE.Shape();
        face.moveTo(-16, 0); face.lineTo(16, 0); face.lineTo(16, 12); face.lineTo(-16, 12);
        face.closePath();
        const hole = new THREE.Path();
        hole.moveTo(-ROAD_HALF - 1.4, 0);
        hole.lineTo(ROAD_HALF + 1.4, 0);
        hole.lineTo(ROAD_HALF + 1.4, 4.4);
        hole.absarc(0, 4.4, ROAD_HALF + 1.4, 0, Math.PI, false);
        hole.lineTo(-ROAD_HALF - 1.4, 0);
        face.holes.push(hole);
        const geo = new THREE.ExtrudeGeometry(face, { depth: 1.2, bevelEnabled: false });
        const m = new THREE.Mesh(geo, conc);
        m.position.z = end === 0 ? 0 : -(t.len);
        g.add(m);
      }
      // tube: walls + ceiling
      const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.4, t.len), conc);
      wallL.position.set(-(ROAD_HALF + 1.8), 3.2, -t.len / 2);
      g.add(wallL);
      const wallR = wallL.clone();
      wallR.position.x = ROAD_HALF + 1.8;
      g.add(wallR);
      const ceil = new THREE.Mesh(new THREE.BoxGeometry((ROAD_HALF + 2.2) * 2, 0.8, t.len), conc);
      ceil.position.set(0, 6.6, -t.len / 2);
      g.add(ceil);
      // sodium lamps down the ceiling
      const lampMat = new THREE.MeshStandardMaterial({
        color: '#4a3a20', emissive: '#ffb44a', emissiveIntensity: 1.8, roughness: 0.4,
      });
      for (let d = 14; d < t.len; d += 24) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.24), lampMat);
        l.position.set(0, 6.1, -d);
        g.add(l);
      }
      const inner = new THREE.PointLight('#ffb44a', 20, 40, 1.5);
      inner.position.set(0, 5, -t.len / 2);
      g.add(inner);
      this.tunnels.push({ g, s: t.s, len: t.len });
      this.scene.add(g);
    }
  }

  private buildSea() {
    const g = new THREE.Group();
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 1000),
      new THREE.MeshStandardMaterial({
        color: '#2e3d46', roughness: 0.22, metalness: 0.6, envMapIntensity: 1.3,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(-300, -36, -200);
    g.add(water);
    // cliff shoulder between road and water
    const cliff = new THREE.Mesh(
      new THREE.BoxGeometry(30, 46, 700),
      new THREE.MeshStandardMaterial({ map: this.stoneTex, roughness: 0.95 })
    );
    cliff.position.set(-42, -24, -220);
    g.add(cliff);
    // Donibane's lights across the bay — the town you never reach
    for (let i = 0; i < 26; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: i % 4 ? '#ffd9a0' : '#ffeecb', transparent: true,
        opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }));
      sp.position.set(-190 - Math.random() * 160, -28 + Math.random() * 8, -320 - Math.random() * 220);
      sp.scale.setScalar(2.5 + Math.random() * 3);
      g.add(sp);
      this.fadeSprites.push({ sp, base: 0.5 });
    }
    this.sea = g;
    this.scene.add(g);
  }

  /* --------------------------------------------------------------- village */
  private buildHouse(seed: number, shop?: string): THREE.Group {
    const g = new THREE.Group();
    const { map, emiss } = facadeTextures(seed, shop);
    const w = 4.2 + (seed % 3) * 0.8;
    const h = 2.7 + (seed % 2) * 0.4;
    const l = 5.2 + ((seed * 7) % 3) * 0.9;
    const mat = new THREE.MeshStandardMaterial({
      map, roughness: 0.85,
      emissive: '#ffffff', emissiveMap: emiss, emissiveIntensity: 0,
    });
    this.houseEmissMats.push(mat);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
    body.position.y = h / 2;
    body.castShadow = true;
    g.add(body);
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 - 0.35, 0);
    shape.lineTo(w / 2 + 0.35, 0);
    shape.lineTo(0, 1.15);
    shape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: l + 0.6, bevelEnabled: false });
    roofGeo.translate(0, 0, -(l + 0.6) / 2);
    const roof = new THREE.Mesh(roofGeo,
      new THREE.MeshStandardMaterial({ color: '#6b3a2a', roughness: 0.95 }));
    roof.position.y = h;
    roof.castShadow = true;
    g.add(roof);
    if (shop) {
      const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.06, 1.1),
        new THREE.MeshStandardMaterial({ color: '#7c2d1e', roughness: 0.8 }));
      awning.position.set(0, h * 0.52, l / 2 + 0.55);
      awning.rotation.x = 0.28;
      g.add(awning);
    }
    return g;
  }

  private buildChurch(): THREE.Group {
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ map: this.stoneTex, roughness: 0.95 });
    const nave = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 9), stone);
    nave.position.y = 2.5;
    nave.castShadow = true;
    g.add(nave);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.2, 4),
      new THREE.MeshStandardMaterial({ color: '#4a4038', roughness: 0.95 }));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 1.45);
    roof.position.y = 6.1;
    g.add(roof);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2.6, 8.5, 2.6), stone);
    tower.position.set(0, 4.25, -5.4);
    tower.castShadow = true;
    g.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2.6, 4),
      new THREE.MeshStandardMaterial({ color: '#3a332c', roughness: 0.9 }));
    spire.rotation.y = Math.PI / 4;
    spire.position.set(0, 9.8, -5.4);
    g.add(spire);
    return g;
  }

  private buildLamp(withLight: boolean): { g: THREE.Group; light: THREE.PointLight | null } {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: '#22252a', roughness: 0.6, metalness: 0.5 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.6, 8), poleMat);
    pole.position.y = 2.3;
    g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.07), poleMat);
    arm.position.set(0.42, 4.55, 0);
    g.add(arm);
    const headMat = new THREE.MeshStandardMaterial({
      color: '#4a3a20', emissive: '#ffb44a', emissiveIntensity: 0, roughness: 0.4,
    });
    this.lampMats.push(headMat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), headMat);
    head.position.set(0.82, 4.5, 0);
    g.add(head);
    let light: THREE.PointLight | null = null;
    if (withLight) {
      light = new THREE.PointLight('#ff9d3a', 0, 20, 1.8);
      light.position.set(0.82, 4.4, 0);
      g.add(light);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: '#ffb44a', transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.set(0.82, 4.5, 0);
    glow.scale.setScalar(2.2);
    g.add(glow);
    this.fadeSprites.push({ sp: glow, base: 0.5 });
    return { g, light };
  }

  /* villages live OFF the road: a lane leaves the main road and the town
     gathers around it — bar, bakery, workshop, church, frontón */
  private buildVillages() {
    const parkedColors = ['#8a2f24', '#3d4a5c', '#cfccc2', '#5c5346'];
    for (let pool = 0; pool < 2; pool++) {
      const side = pool === 0 ? 1 : -1;
      const members: VillageMember[] = [];
      const lamps: THREE.PointLight[] = [];
      const addM = (obj: THREE.Object3D, ds: number, lane: number, yaw = 0) => {
        this.scene.add(obj);
        members.push({ obj, ds, lane, yaw });
      };

      /* junction: the side lane peeling off the main road */
      const lane = new THREE.Mesh(
        new THREE.PlaneGeometry(4.2, 64),
        new THREE.MeshStandardMaterial({ color: '#232528', roughness: 0.5, metalness: 0.2 })
      );
      lane.rotation.x = -Math.PI / 2;
      lane.rotation.z = side * -0.42;
      const laneG = new THREE.Group();
      lane.position.set(side * 13, 0.008, 0);
      laneG.add(lane);
      addM(laneG, -20, 0);

      /* village entry sign at the junction — board in front, posts BEHIND */
      const signTex = villageSignTexture('—', '');
      const signMat = new THREE.MeshStandardMaterial({
        map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.16, roughness: 0.5,
      });
      const signG = new THREE.Group();
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.25), signMat);
      board.position.set(0, 2.2, 0.06);
      board.rotation.y = -0.10;
      signG.add(board);
      const backMat = new THREE.MeshStandardMaterial({ color: '#8d9298', roughness: 0.5, metalness: 0.6 });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.25), backMat);
      back.position.set(0, 2.2, 0.045);
      back.rotation.y = Math.PI - 0.10;
      signG.add(back);
      const legMat = new THREE.MeshStandardMaterial({ color: '#7c8288', roughness: 0.4, metalness: 0.7 });
      for (const lx of [-1.0, 1.0]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.85, 8), legMat);
        leg.position.set(lx, 1.42, -0.02);
        signG.add(leg);
      }
      addM(signG, -120, side * (ROAD_HALF + 1.9));

      const arrowTex = signTex;   // reused handle for refresh

      /* the town itself, gathered around the side lane, off the road */
      const base = side * (17 + pool * 3);
      const layout: [number, number, number, string | undefined][] = [
        [10, base - side * 2.5, side > 0 ? Math.PI : 0, SHOP_NAMES[pool * 3]],
        [22, base + side * 4, side > 0 ? Math.PI : 0, undefined],
        [34, base - side * 3, side > 0 ? Math.PI : 0, SHOP_NAMES[pool * 3 + 1]],
        [46, base + side * 5, side > 0 ? Math.PI : 0, undefined],
        [58, base - side * 2, side > 0 ? Math.PI : 0, SHOP_NAMES[pool * 3 + 2]],
        [70, base + side * 3.5, side > 0 ? Math.PI : 0, undefined],
        [30, base + side * 13, side > 0 ? Math.PI : 0, undefined],
        [52, base + side * 12, side > 0 ? Math.PI : 0, undefined],
        [14, base + side * 11, side > 0 ? Math.PI : 0, undefined],
        [66, base + side * 12, side > 0 ? Math.PI : 0, undefined],
      ];
      layout.forEach(([ds, lx, yaw, shop], i) => {
        addM(this.buildHouse(i + 1 + pool * 5, shop), ds, lx, yaw + (Math.random() - 0.5) * 0.15);
      });
      addM(this.buildChurch(), 44, base + side * 22, side * 0.4);
      const fronton = new THREE.Mesh(new THREE.BoxGeometry(9, 6.5, 0.8),
        new THREE.MeshStandardMaterial({ map: this.stoneTex, roughness: 0.9 }));
      fronton.position.y = 3.25;
      fronton.castShadow = true;
      const frontonG = new THREE.Group();
      frontonG.add(fronton);
      addM(frontonG, 82, base + side * 6, 0.4);

      for (const [ds, off, withLight] of [[6, 6, 1], [40, 8, 1], [72, 7, 0]] as const) {
        const { g, light } = this.buildLamp(!!withLight);
        if (side < 0) g.rotation.y = Math.PI;
        addM(g, ds, base - side * (10 - off));
        if (light) lamps.push(light);
      }
      for (const [ds, off, ci] of [[16, 5, pool], [48, 6, pool + 2], [62, 4, pool + 1]] as const) {
        const rig = this.buildCarBody(parkedColors[ci % parkedColors.length], false);
        addM(rig.root, ds, base + side * (off - 8), side > 0 ? 0.5 : Math.PI - 0.5);
      }

      const vp: VillagePool = { members, signTex, arrowTex, lamps, centerS: 0, routeIdx: pool, side };
      this.placeVillage(vp, pool);
      this.villages.push(vp);
    }
  }

  private placeVillage(vp: VillagePool, routeIdx: number) {
    vp.routeIdx = routeIdx;
    const n = VILLAGES.length;
    vp.centerS = Math.floor(routeIdx / n) * CYCLE_LEN + VILLAGES[routeIdx % n].s;
    const info = this.hooks.villageEntry(routeIdx);
    villageSignTexture(info.name, info.alt, vp.signTex);
  }

  /* ------------------------------------------------------------ roadside */
  private populate() {
    const sc = this.scene;
    const push = (obj: THREE.Object3D, s: number, lane: number, span: number, align = false, refresh?: (p: Prop) => void): Prop => {
      sc.add(obj);
      const p: Prop = { obj, s, lane, span, align, refresh };
      this.props.push(p);
      return p;
    };

    /* wet forest bands */
    const treeMat = new THREE.MeshStandardMaterial({ color: '#1b2a12', roughness: 1 });
    const treeMat2 = new THREE.MeshStandardMaterial({ color: '#243618', roughness: 1 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#241c12', roughness: 1 });
    for (let i = 0; i < 54; i++) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.6, 6), trunkMat);
      trunk.position.y = 0.8;
      g.add(trunk);
      const mat = Math.random() < 0.5 ? treeMat : treeMat2;
      if (Math.random() < 0.4) {
        const h = 4.5 + Math.random() * 5;
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.9, h, 7), mat);
        c.position.y = 1.2 + h / 2;
        c.castShadow = true;
        g.add(c);
      } else {
        const r = 1.6 + Math.random() * 1.9;
        const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
        b.scale.y = 0.82;
        b.position.y = 1.6 + r * 0.6;
        b.castShadow = true;
        g.add(b);
      }
      const side = Math.random() < 0.5 ? -1 : 1;
      // forest crowds right up to the shoulder — the road is barely holding on
      push(g, i * (VIEW / 54) + Math.random() * 7, side * (5.5 + Math.random() * 28), VIEW).cr = 0.9;
    }
    // low ferns / undergrowth hugging the verge
    const fernMat = new THREE.MeshStandardMaterial({ color: '#2c3a1d', roughness: 1 });
    for (let i = 0; i < 22; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.5, 0), fernMat);
      b.scale.y = 0.5;
      b.position.y = 0.3;
      const g = new THREE.Group();
      g.add(b);
      const side = Math.random() < 0.5 ? -1 : 1;
      push(g, i * (VIEW / 22) + Math.random() * 10, side * (ROAD_HALF + 0.6 + Math.random() * 2), VIEW);
    }

    /* green hills and mountain masses off the road */
    const hillMat = new THREE.MeshStandardMaterial({ color: '#25341f', roughness: 1, envMapIntensity: 0.12 });
    const mountainMat = new THREE.MeshStandardMaterial({ color: '#1e2a1a', roughness: 1, envMapIntensity: 0.12 });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const h = 60 + Math.random() * 70;
        const m = new THREE.Mesh(new THREE.ConeGeometry(h * 0.85, h, 7), mountainMat);
        m.position.set((k - 1) * h * 0.8, h / 2 - 6, (Math.random() - 0.5) * 60);
        g.add(m);
      }
      const side = i % 2 ? 1 : -1;
      push(g, i * (VIEW * 3 / 4) + 100, side * (260 + Math.random() * 140), VIEW * 3);
    }
    for (let i = 0; i < 6; i++) {
      const h = 20 + Math.random() * 22;
      const m = new THREE.Mesh(new THREE.ConeGeometry(h * 1.1, h, 7), hillMat);
      m.position.y = h / 2 - 3;
      const g = new THREE.Group();
      g.add(m);
      const side = i % 2 ? 1 : -1;
      push(g, i * (VIEW * 1.5 / 6) + 60, side * (78 + Math.random() * 55), VIEW * 1.5);
    }

    /* dry-stone walls along random stretches */
    const wallMat = new THREE.MeshStandardMaterial({ map: this.stoneTex, roughness: 0.95 });
    for (let i = 0; i < 10; i++) {
      const len = 7 + Math.random() * 5;
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.75, len), wallMat);
      w.position.y = 0.37;
      w.castShadow = true;
      const g = new THREE.Group();
      g.add(w);
      const side = Math.random() < 0.5 ? -1 : 1;
      const wp = push(g, i * (VIEW * 1.5 / 10) + Math.random() * 12, side * (ROAD_HALF + 2.2 + Math.random() * 3), VIEW * 1.5, true);
      wp.cr = 0.5; wp.crS = len / 2; wp.kind = 'wall';
    }

    /* bridges: stone parapets over the streams */
    for (const bs of BRIDGES) {
      const g = new THREE.Group();
      for (const side of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 26), wallMat);
        p.position.set(side * (ROAD_HALF + 0.6), 0.5, 0);
        g.add(p);
      }
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(90, 10),
        new THREE.MeshStandardMaterial({ color: '#1d262b', roughness: 0.15, metalness: 0.5 })
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = -2.8;
      g.add(water);
      push(g, bs, 0, CYCLE_LEN, true);
    }

    /* telephone poles */
    const poleMat = new THREE.MeshStandardMaterial({ color: '#1c1712', roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 6), poleMat);
      p.position.y = 3.5;
      g.add(p);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.09, 0.09), poleMat);
      arm.position.y = 6.4;
      g.add(arm);
      push(g, i * 63, (i % 2 ? 1 : -1) * 6.6, 7 * 63).cr = 0.35;
    }

    /* delineator posts */
    const postMat = new THREE.MeshStandardMaterial({ color: '#c9c6ba', roughness: 0.7 });
    const reflMat = new THREE.MeshStandardMaterial({
      color: '#e8e4d0', emissive: '#fff2c8', emissiveIntensity: 0.65, roughness: 0.4,
    });
    for (let i = 0; i < 18; i++) {
      const g = new THREE.Group();
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.05, 0.06), postMat);
      p.position.y = 0.52;
      g.add(p);
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.07), reflMat);
      r.position.y = 0.9;
      g.add(r);
      push(g, i * 24.5, (i % 2 ? 1 : -1) * (ROAD_HALF + 0.7), 18 * 24.5);
    }

    /* kilometre stones */
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      const info = this.hooks.kmMarker(i * 220);
      const tex = kmStoneTexture(info.road, info.km);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.24),
        new THREE.MeshStandardMaterial({ color: '#ddd9cd', roughness: 0.55 }));
      body.position.y = 0.3;
      g.add(body);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5),
        new THREE.MeshStandardMaterial({
          map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.14, roughness: 0.55,
        }));
      face.position.set(0, 0.32, 0.13);
      g.add(face);
      g.userData.tex = tex;
      push(g, i * 220 + 90, ROAD_HALF + 1.1, 2 * 220, false, (p) => {
        const inf = this.hooks.kmMarker(p.s);
        kmStoneTexture(inf.road, inf.km, p.obj.userData.tex);
      }).cr = 0.4;
    }

    /* distance signs — board in front, galvanized posts behind */
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      const info = this.hooks.distanceSign(i * 600);
      const tex = distSignTexture(info.l1, info.l2);
      const mat = new THREE.MeshStandardMaterial({
        map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.16, roughness: 0.5,
      });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.35), mat);
      board.position.set(0, 2.3, 0.06);
      board.rotation.y = -0.12;
      g.add(board);
      const backMat = new THREE.MeshStandardMaterial({ color: '#8d9298', roughness: 0.5, metalness: 0.6 });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.35), backMat);
      back.position.set(0, 2.3, 0.045);
      back.rotation.y = Math.PI - 0.12;
      g.add(back);
      const legMat = new THREE.MeshStandardMaterial({ color: '#7c8288', roughness: 0.4, metalness: 0.7 });
      for (const lx of [-0.9, 0.9]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.95, 8), legMat);
        leg.position.set(lx, 1.47, -0.02);
        g.add(leg);
      }
      g.userData.tex = tex;
      push(g, i * 600 + 320, ROAD_HALF + 1.8, 2 * 600, false, (p) => {
        const inf = this.hooks.distanceSign(p.s);
        distSignTexture(inf.l1, inf.l2, p.obj.userData.tex);
      }).cr = 0.9;
    }
  }

  private buildRain() {
    const pos = new Float32Array(this.RAIN_COUNT * 2 * 3);
    for (let i = 0; i < this.RAIN_COUNT; i++) {
      this.drops.push({
        p: new THREE.Vector3((Math.random() - 0.5) * 34, Math.random() * 14 - 3, -Math.random() * 46 - 2),
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: '#8fa0b4', transparent: true, opacity: 0.20,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    this.rain.frustumCulled = false;

    // splash pool on the road surface
    for (let i = 0; i < 40; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.splashTex, transparent: true, opacity: 0,
        depthWrite: false,
      }));
      sp.scale.setScalar(0.25);
      this.scene.add(sp);
      this.splashes.push({ sp, life: Math.random(), d: 4 + Math.random() * 36, lane: (Math.random() - 0.5) * 9 });
    }
  }

  /* ------------------------------------------------------------------ tick */
  update(dt: number, st: WorldState) {
    const { s, day } = st;

    if (st.lightning) this.flash = 1;
    this.flash = Math.max(0, this.flash - dt * 6);

    this.fogBlend.copy(day.fog).lerp(day.skyHorizon, 0.35);
    this.drawSky(day, st.tDay, st.time, st.cloud);
    const inTun = this.inTunnel(s);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(this.fogBlend);
    const altFog = 1 + Math.max(0, E(s) - 300) / 300 * 0.9;   // mountain fog
    fog.density = day.fogDensity * altFog * (inTun ? 2.2 : 1);
    this.scene.background = this.fogBlend;

    this.sun.color.copy(day.sunColor);
    this.sun.intensity = day.sunI * (1 - st.cloud * 0.55) + this.flash * 6;
    const elev = sunElevation(st.tDay);
    if (elev > 0.01) {
      const ta = Math.PI * ((((st.tDay % 1) + 1) % 1) - 0.25) / 0.55;
      this.sun.position.set(Math.cos(ta) * 70, 12 + elev * 85, -45);
    } else {
      this.sun.position.set(35, 60, -80);
    }
    this.sun.target.position.set(0, 0, -12);
    this.hemi.intensity = day.hemiI * (1 - st.cloud * 0.3) + this.flash * 2;
    this.amb.intensity = day.ambI + this.flash * 1.5;
    const dark = day.darkness;

    /* clouds drift with the wind */
    for (let i = 0; i < this.cloudPlanes.length; i++) {
      const c = this.cloudPlanes[i];
      const tex = c.mat.map as THREE.CanvasTexture;
      tex.offset.x = (st.time * c.speed * 0.002) % 1;
      c.mat.opacity = 0.25 + st.cloud * 0.55 - i * 0.08;
      c.mat.color.copy(day.skyHorizon).lerp(new THREE.Color('#ffffff'), 0.4 - dark * 0.35);
      c.mesh.visible = !inTun;
    }

    /* environment reflections refresh */
    this.envTimer -= dt;
    if (this.envTimer <= 0) {
      this.envTimer = 4;
      this.refreshEnv(day);
    }

    for (const m of this.houseEmissMats) m.emissiveIntensity = dark * 0.9;
    for (const m of this.lampMats) m.emissiveIntensity = dark * 1.6;
    for (const f of this.fadeSprites) f.sp.material.opacity = f.base * (0.06 + 0.94 * dark);
    for (const vp of this.villages) for (const l of vp.lamps) l.intensity = 12 * dark;
    this.gasSignMat.emissiveIntensity = 0.15 + 0.8 * dark;
    this.roadMat.roughness = 0.55 - 0.38 * st.rainI;
    this.roadMat.metalness = 0.2 + 0.25 * st.rainI;
    const wetRefl = st.rainI * dark;
    for (const r of this.reflStreaks) {
      (r.material as THREE.MeshBasicMaterial).opacity = 0.10 + 0.16 * wetRefl;
    }

    /* road + ground ribbons: curve AND elevation */
    const pos = this.roadGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i <= this.rows; i++) {
      const d = (i / this.rows) * VIEW;
      const o = this.off(s, s + d);
      const y = this.lift(s, s + d);
      pos.setX(i * 2, -ROAD_HALF + o);
      pos.setY(i * 2, y);
      pos.setX(i * 2 + 1, ROAD_HALF + o);
      pos.setY(i * 2 + 1, y);
    }
    pos.needsUpdate = true;
    this.roadGeo.computeVertexNormals();
    this.roadTex.offset.y = (s % 6) / 6;

    const gpos = this.groundGeo.getAttribute('position') as THREE.BufferAttribute;
    const COLS = [-340, -10, 10, 340];
    for (let i = 0; i <= this.groundRows; i++) {
      const d = (i / this.groundRows) * (VIEW + 80) - 40;
      const y = this.lift(s, s + d) - 0.06;
      const o = this.off(s, s + d);
      const drop = this.coastDrop(s + d);
      for (let c = 0; c < COLS.length; c++) {
        const vi = i * COLS.length + c;
        gpos.setX(vi, COLS[c] + o);
        gpos.setY(vi, y - (c === 0 ? drop : 0));
      }
    }
    gpos.needsUpdate = true;
    this.groundGeo.computeVertexNormals();

    /* roadside props */
    for (const p of this.props) {
      if (p.s < s - 22) {
        p.s += p.span;
        p.refresh?.(p);
      }
      const d = p.s - s;
      p.obj.position.z = -d;
      p.obj.position.x = this.off(s, p.s) + p.lane;
      p.obj.position.y = this.lift(s, p.s);
      p.obj.visible = d < VIEW + 30;
      if (p.align) {
        p.obj.rotation.y = this.yawAt(s, p.s);
        p.obj.rotation.x = E1(p.s) - E1(s);   // long objects follow the grade
      }
    }

    /* villages */
    for (const vp of this.villages) {
      if (vp.centerS + 260 < s) this.placeVillage(vp, vp.routeIdx + 2);
      for (const m of vp.members) {
        const mS = vp.centerS + m.ds;
        const d = mS - s;
        const vis = d > -80 && d < VIEW + 80;
        m.obj.visible = vis;
        if (!vis) continue;
        m.obj.position.z = -d;
        m.obj.position.x = this.off(s, mS) + m.lane;
        m.obj.position.y = this.lift(s, mS);
        m.obj.rotation.y = this.yawAt(s, mS) + m.yaw;
      }
    }

    /* landmarks */
    {
      const d = this.gasS - s;
      this.gas.visible = d > -40 && d < VIEW + 60;
      if (this.gas.visible) {
        this.gas.position.set(this.off(s, this.gasS) + ROAD_HALF + 8.5, this.lift(s, this.gasS), -d);
        this.gas.rotation.y = this.yawAt(s, this.gasS);
        const flick = Math.random() < 0.06 ? 0.15 : 1;
        this.gasLight.intensity = 26 * flick * (0.2 + 0.8 * dark);
      }
      const bd = this.borderS - s;
      if (this.borderS + 60 < s) this.borderS += CYCLE_LEN;
      this.border.visible = bd > -50 && bd < VIEW + 60;
      if (this.border.visible) {
        this.border.position.set(this.off(s, this.borderS), this.lift(s, this.borderS), -bd);
        this.border.rotation.y = this.yawAt(s, this.borderS);
      }
      for (const t of this.tunnels) {
        let ts = t.s + Math.floor((s - t.s - t.len - 100) / CYCLE_LEN + 1) * CYCLE_LEN;
        const d2 = ts - s;
        t.g.visible = d2 > -(t.len + 60) && d2 < VIEW + 60;
        if (t.g.visible) {
          t.g.position.set(this.off(s, ts), this.lift(s, ts), -d2);
          t.g.rotation.y = this.yawAt(s, ts);
        }
      }
      if (this.seaS + 2400 < s) this.seaS += CYCLE_LEN;
      const sd = this.seaS - s;
      this.sea.visible = sd > -2000 && sd < 2400;
      if (this.sea.visible) {
        this.sea.position.set(this.off(s, this.seaS), this.lift(s, this.seaS), -sd);
      }
    }

    /* oncoming traffic */
    for (let i = 0; i < this.oncoming.length; i++) {
      const oc = this.oncoming[i];
      oc.s -= oc.v * dt;
      if (oc.s < s - 30) {
        oc.s = s + VIEW + 400 + Math.random() * 1400;
        oc.v = 17 + Math.random() * 9;
        oc.rig.paint.color.set(this.mirrorOncoming && i === 0 ? '#e2dfd6' : ['#23272c', '#6b1f18', '#3d4a3f'][i]);
      }
      const d = oc.s - s;
      oc.g.visible = d > -30 && d < VIEW + 40;
      if (oc.g.visible) {
        oc.g.position.set(this.off(s, oc.s) - 1.75, this.lift(s, oc.s), -d);
        oc.g.rotation.y = Math.PI + this.yawAt(s, oc.s);
        for (const w of oc.rig.wheels) w.rotation.x += (oc.v + st.speed) * dt / 0.34 * 0.5;
      }
    }

    /* player car: suspension, roll, pitch, spinning + steering wheels */
    const rig = this.carRig;
    rig.root.position.x = st.laneX;
    rig.root.rotation.y = st.visualYaw;
    rig.body.position.y = st.bodyY;
    // a battered chassis sits crooked and darkens with damage
    rig.body.rotation.z = st.roll + st.damage * 0.05;
    rig.body.rotation.x = st.pitch - st.damage * 0.03;
    const dent = 1 - st.damage * 0.32;
    rig.paint.color.setRGB(0.886 * dent, 0.874 * dent, 0.839 * dent);
    for (const w of rig.wheels) w.rotation.x = st.wheelSpin;
    for (const fw of rig.frontWheels) fw.rotation.y = -st.steer * 0.42;
    rig.root.visible = true;
    rig.body.visible = !st.interior;
    for (const w of rig.wheels) w.visible = !st.interior;

    if (this.flickerT > 0) this.flickerT -= dt;
    const lit = this.headlightsOn && (this.flickerT <= 0 || Math.random() < 0.3);
    this.headLeft.visible = lit;
    this.headRight.visible = lit;
    for (const cone of this.beamCones) {
      (cone.material as THREE.MeshBasicMaterial).opacity = lit ? 0.05 * Math.max(dark, inTun ? 0.4 : 0) : 0;
      cone.visible = !st.interior && lit && (dark > 0.05 || inTun);
    }
    for (const t of this.tailMats) t.emissiveIntensity = st.braking ? 2.2 : 0.5;

    /* rain: streaks in the air + splashes on the tarmac */
    const rainVisible = !inTun;
    this.rain.visible = rainVisible && st.rainI > 0.03;
    const rp = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
    const wind = 2.2 + st.cloud * 2;
    const fall = 20 + st.rainI * 9;
    const spdAbs = Math.abs(st.speed);
    const streak = 0.028 + spdAbs * 0.0011;
    const dirY = -fall * streak;
    const dirX = wind * streak;
    const dirZ = st.speed * 0.020;
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i].p;
      d.y -= fall * dt;
      d.x += wind * dt;
      d.z += st.speed * dt * 0.7;
      if (d.y < -3) { d.y += 17; d.x = (Math.random() - 0.5) * 34; }
      if (d.x > 17) d.x -= 34;
      if (d.z > -2) d.z -= 44;
      if (d.z < -46) d.z += 44;
      rp.setXYZ(i * 2, d.x, d.y, d.z);
      rp.setXYZ(i * 2 + 1, d.x + dirX, d.y + dirY, d.z + dirZ);
    }
    rp.needsUpdate = true;
    const visDrops = Math.floor(this.RAIN_COUNT * (0.1 + 0.9 * st.rainI));
    this.rain.geometry.setDrawRange(0, visDrops * 2);
    (this.rain.material as THREE.LineBasicMaterial).opacity = 0.10 + 0.14 * st.rainI + 0.10 * dark * st.rainI;

    for (const sp of this.splashes) {
      sp.life -= dt * 3.2;
      if (sp.life <= 0) {
        sp.life = 0.7 + Math.random() * 0.5;
        sp.d = 3 + Math.random() * 34;
        sp.lane = (Math.random() - 0.5) * 9;
      }
      const grow = 1 - sp.life;
      sp.sp.position.set(this.off(s, s + sp.d) + sp.lane, this.lift(s, s + sp.d) + 0.06, -sp.d);
      sp.sp.scale.setScalar(0.12 + grow * 0.42);
      (sp.sp.material as THREE.SpriteMaterial).opacity =
        rainVisible ? Math.max(0, sp.life) * 0.5 * st.rainI * (0.35 + 0.65 * dark) : 0;
    }
  }
}
