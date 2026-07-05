/* The road and everything beside it. Distance-space world: every prop lives
   at an absolute road-distance `s` and is projected into view through the
   road's lateral curve, so the car stays near the origin and the world flows
   past. Recycled props are re-dressed through hooks — which is how the
   anomaly rewrites the signs, the villages and the map's assumptions. */

import * as THREE from 'three';
import { CYCLE_LEN, BORDER_S, GAS_S, VILLAGES } from './route';
import type { DayLight } from './daycycle';
import { sunElevation } from './daycycle';

export const ROAD_HALF = 3.6;
export const VIEW = 420;

export interface WorldHooks {
  distanceSign(s: number): { l1: string; l2: string };
  kmMarker(s: number): { road: string; km: string };
  villageEntry(routeIdx: number): { name: string; alt: string };
}

interface WorldState {
  s: number; speed: number; laneX: number;
  visualYaw: number; roll: number;
  interior: boolean; braking: boolean;
  time: number; tDay: number; day: DayLight; rainI: number;
}

/* road lateral path and derivatives — three incommensurate bends */
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
  x.fillStyle = '#191b1e';
  x.fillRect(0, 0, 256, 256);
  const img = x.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
  x.fillStyle = 'rgba(214,214,206,0.72)';
  x.fillRect(10, 0, 5, 256);
  x.fillRect(241, 0, 5, 256);
  x.fillRect(125, 0, 6, 128);                    // 3 m dash / 3 m gap
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

/* Basque farmhouse facade: whitewash + oxblood timbers. Returns matching
   colour map and window-only emissive map so windows can light at night. */
function facadeTextures(seed: number): { map: THREE.CanvasTexture; emiss: THREE.CanvasTexture } {
  const { c, x } = canvas(256, 256);
  const e = canvas(256, 256);
  x.fillStyle = '#ded6c6';
  x.fillRect(0, 0, 256, 256);
  const img = x.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
  x.fillStyle = '#7c2d1e';
  x.fillRect(0, 0, 256, 12);                       // eave beam
  const nBeams = 3 + (seed % 3);
  for (let i = 0; i < nBeams; i++) {
    x.fillRect(20 + (i * 216) / (nBeams - 1 || 1), 0, 9, 256);
  }
  x.fillRect(0, 118, 256, 8);
  // windows with shutters; some lit
  e.x.fillStyle = '#000';
  e.x.fillRect(0, 0, 256, 256);
  for (const [wx, wy] of [[58, 40], [160, 40], [58, 150], [160, 150]]) {
    x.fillStyle = '#241c14';
    x.fillRect(wx, wy, 38, 52);
    x.strokeStyle = '#7c2d1e';
    x.lineWidth = 5;
    x.strokeRect(wx - 3, wy - 3, 44, 58);
    x.fillRect(wx - 12, wy, 8, 52);                 // shutters
    x.fillRect(wx + 42, wy, 8, 52);
    if ((seed + wx + wy) % 3 === 0) {               // this window is lit
      e.x.fillStyle = '#ffb44a';
      e.x.fillRect(wx + 2, wy + 2, 34, 48);
    }
  }
  // door
  x.fillStyle = '#3a2417';
  x.fillRect(108, 190, 42, 66);
  return { map: srgb(new THREE.CanvasTexture(c)), emiss: srgb(new THREE.CanvasTexture(e.c)) };
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

/* ----------------------------------------------------------------- props */
interface Prop {
  obj: THREE.Object3D;
  s: number;
  lane: number;
  span: number;
  align?: boolean;                     // rotate with the road direction
  refresh?: (p: Prop) => void;
}

interface FadeSprite { sp: THREE.Sprite; base: number; night: boolean }

interface VillagePool {
  members: { obj: THREE.Object3D; ds: number; lane: number; yaw: number }[];
  signTex: THREE.CanvasTexture;
  lamps: THREE.PointLight[];
  centerS: number;
  routeIdx: number;
}

export class World {
  scene = new THREE.Scene();
  car = new THREE.Group();
  headlightsOn = true;
  mirrorOncoming = false;

  private hooks: WorldHooks;
  private props: Prop[] = [];
  private roadGeo!: THREE.BufferGeometry;
  private roadMat!: THREE.MeshStandardMaterial;
  private roadTex!: THREE.CanvasTexture;
  private rows = 84;

  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private amb!: THREE.AmbientLight;

  private skyCanvas!: HTMLCanvasElement;
  private skyTex!: THREE.CanvasTexture;
  private skyPlane!: THREE.Mesh;

  private headLeft!: THREE.SpotLight;
  private headRight!: THREE.SpotLight;
  private beamCones: THREE.Mesh[] = [];
  private fadeSprites: FadeSprite[] = [];
  private tailMats: THREE.MeshStandardMaterial[] = [];
  private carMeshes: THREE.Mesh[] = [];
  private flickerT = 0;

  private rain!: THREE.LineSegments;
  private drops: { p: THREE.Vector3 }[] = [];
  private RAIN_COUNT = 400;
  private glowTex = glowTexture();

  private houseEmissMats: THREE.MeshStandardMaterial[] = [];
  private lampMats: THREE.MeshStandardMaterial[] = [];
  private villages: VillagePool[] = [];

  private gas!: THREE.Group;
  private gasLight!: THREE.PointLight;
  private gasSignMat!: THREE.MeshStandardMaterial;
  private gasS = GAS_S;

  private border!: THREE.Group;
  private borderS = BORDER_S;

  private oncoming: { g: THREE.Group; body: THREE.MeshStandardMaterial; s: number; v: number }[] = [];
  private fogBlend = new THREE.Color();

  constructor(hooks: WorldHooks) {
    this.hooks = hooks;
    const sc = this.scene;
    sc.fog = new THREE.FogExp2('#06090f', 0.011);

    this.sun = new THREE.DirectionalLight('#fff2dd', 1.8);
    this.sun.position.set(35, 60, -80);
    sc.add(this.sun);
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
    this.buildOncoming();
    this.buildVillages();
    this.populate();
  }

  curvature(s: number) { return F2(s); }
  get gasStationS() { return this.gasS; }
  setGasStationS(s: number) { this.gasS = s; }
  get borderPostS() { return this.borderS; }
  flickerHeadlights(seconds = 0.5) { this.flickerT = seconds; }
  get rainObject() { return this.rain; }

  private off(s: number, s2: number) {
    return F(s2) - F(s) - F1(s) * (s2 - s);
  }
  private yawAt(s: number, s2: number) {
    return -(F1(s2) - F1(s));
  }

  /* ------------------------------------------------------------- sky dome */
  private buildSky() {
    this.skyCanvas = canvas(512, 512).c;
    this.skyTex = srgb(new THREE.CanvasTexture(this.skyCanvas));
    const mat = new THREE.MeshBasicMaterial({ map: this.skyTex, depthWrite: false, fog: false });
    this.skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.skyPlane.renderOrder = -10;
    this.skyPlane.frustumCulled = false;
  }
  attachSky(camera: THREE.PerspectiveCamera) {
    camera.add(this.skyPlane);
    this.sizeSky(camera);
  }
  sizeSky(camera: THREE.PerspectiveCamera) {
    const d = 460;
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d;
    this.skyPlane.position.set(0, 40, -d);
    this.skyPlane.scale.set(h * camera.aspect * 1.35, h * 1.35, 1);
  }

  private drawSky(day: DayLight, tDay: number, time: number) {
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
    if (elev > 0.01) {                         // the sun through the overcast
      const t = ((tDay % 1) + 1) % 1;
      const sx = W * (0.5 + 0.28 * Math.cos(Math.PI * (t - 0.25) / 0.55));
      const sy = HOR - HOR * 0.82 * elev;
      const sg = x.createRadialGradient(sx, sy, 4, sx, sy, 90);
      sg.addColorStop(0, `rgba(255,236,200,${0.55 + 0.3 * elev})`);
      sg.addColorStop(0.25, 'rgba(255,230,190,0.20)');
      sg.addColorStop(1, 'rgba(255,230,190,0)');
      x.fillStyle = sg;
      x.fillRect(0, 0, W, HOR + 30);
    }
    if (day.darkness > 0.5) {                  // gauzed moon
      const mx = W * 0.68, my = H * 0.16;
      const mg = x.createRadialGradient(mx, my, 3, mx, my, 60);
      mg.addColorStop(0, `rgba(205,215,232,${0.65 * day.darkness})`);
      mg.addColorStop(0.2, `rgba(195,205,225,${0.18 * day.darkness})`);
      mg.addColorStop(1, 'rgba(195,205,225,0)');
      x.fillStyle = mg;
      x.fillRect(0, 0, W, HOR);
    }
    // drifting cloud banks
    x.fillStyle = `rgba(30,34,42,${0.10 + 0.10 * (1 - day.darkness)})`;
    for (let i = 0; i < 4; i++) {
      const cx = ((time * (4 + i) + i * 170) % (W + 260)) - 130;
      const cy = H * (0.10 + i * 0.09);
      x.beginPath();
      x.ellipse(cx, cy, 120 + i * 22, 17 + i * 5, 0, 0, 7);
      x.fill();
    }
    // hill silhouettes on the horizon
    x.fillStyle = `rgba(14,18,14,${0.5 + 0.3 * day.darkness})`;
    x.beginPath();
    x.moveTo(0, HOR);
    for (let px = 0; px <= W; px += 16) {
      x.lineTo(px, HOR - 14 - Math.abs(Math.sin(px * 0.015) * 22 + Math.sin(px * 0.041) * 9));
    }
    x.lineTo(W, HOR);
    x.closePath();
    x.fill();
    this.skyTex.needsUpdate = true;
  }

  /* --------------------------------------------------------------- ground */
  private buildGround() {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshStandardMaterial({ color: '#131710', roughness: 1 })
    );
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, -0.03, -200);
    this.scene.add(g);
  }

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
      map: this.roadTex, roughness: 0.25, metalness: 0.35,
    });
    const road = new THREE.Mesh(this.roadGeo, this.roadMat);
    road.position.y = 0.01;
    this.scene.add(road);
  }

  /* ------------------------------------------------------------- vehicles */
  private buildCarModel(bodyColor: string): { g: THREE.Group; body: THREE.MeshStandardMaterial; meshes: THREE.Mesh[] } {
    const g = new THREE.Group();
    const meshes: THREE.Mesh[] = [];
    const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.38, metalness: 0.25 });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      g.add(m); meshes.push(m);
      return m;
    };
    add(new THREE.BoxGeometry(1.68, 0.40, 4.15), paint, 0, 0.48, 0);        // lower body
    add(new THREE.BoxGeometry(1.60, 0.16, 1.20), paint, 0, 0.74, -1.35);    // hood
    add(new THREE.BoxGeometry(1.60, 0.18, 0.95), paint, 0, 0.75, 1.48);     // trunk
    add(new THREE.BoxGeometry(1.46, 0.44, 1.95), paint, 0, 1.02, 0.06);     // cabin
    const glass = new THREE.MeshStandardMaterial({ color: '#0d1013', roughness: 0.12, metalness: 0.55 });
    add(new THREE.BoxGeometry(1.36, 0.34, 2.02), glass, 0, 1.05, 0.06);     // glasshouse
    const chrome = new THREE.MeshStandardMaterial({ color: '#a7adb3', roughness: 0.2, metalness: 0.95 });
    add(new THREE.BoxGeometry(1.74, 0.11, 0.14), chrome, 0, 0.33, -2.06);   // bumpers
    add(new THREE.BoxGeometry(1.74, 0.11, 0.14), chrome, 0, 0.33, 2.06);
    const grille = new THREE.MeshStandardMaterial({ color: '#22242a', roughness: 0.5, metalness: 0.6 });
    add(new THREE.BoxGeometry(1.05, 0.18, 0.05), grille, 0, 0.58, -2.09);
    const plate = new THREE.MeshStandardMaterial({ color: '#e5e2d5', roughness: 0.5 });
    add(new THREE.BoxGeometry(0.42, 0.11, 0.03), plate, 0, 0.40, 2.10);
    for (const mx of [-0.89, 0.89]) {                                        // mirrors
      add(new THREE.BoxGeometry(0.07, 0.10, 0.14), chrome, mx, 1.02, -0.78);
    }
    const rubber = new THREE.MeshStandardMaterial({ color: '#0f0f10', roughness: 0.92 });
    const hub = new THREE.MeshStandardMaterial({ color: '#8d9296', roughness: 0.3, metalness: 0.85 });
    for (const [wx, wz] of [[-0.84, 1.34], [0.84, 1.34], [-0.84, -1.34], [0.84, -1.34]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.23, 16), rubber);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.34, wz);
      g.add(w); meshes.push(w);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.245, 12), hub);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(wx, 0.34, wz);
      g.add(cap); meshes.push(cap);
    }
    return { g, body: paint, meshes };
  }

  private buildCar() {
    const { g, meshes } = this.buildCarModel('#e6e4de');   // white, a little tired
    this.car = g;
    this.carMeshes = meshes;

    const lampMat = new THREE.MeshStandardMaterial({
      color: '#fff3cf', emissive: '#ffedb8', emissiveIntensity: 1.6, roughness: 0.3,
    });
    for (const lx of [-0.58, 0.58]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), lampMat);
      lamp.position.set(lx, 0.58, -2.02);
      g.add(lamp); this.carMeshes.push(lamp);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: '#ffedb8', transparent: true,
        opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.position.set(lx, 0.58, -2.12);
      glow.scale.setScalar(1.3);
      g.add(glow);
      this.fadeSprites.push({ sp: glow, base: 0.75, night: true });

      const tail = new THREE.MeshStandardMaterial({
        color: '#3a0d08', emissive: '#c03020', emissiveIntensity: 0.5, roughness: 0.4,
      });
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.15, 0.05), tail);
      t.position.set(lx, 0.62, 2.10);
      g.add(t); this.carMeshes.push(t); this.tailMats.push(tail);
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

      // soft volumetric cone, only alive in the dark
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
    }

    g.position.set(1.7, 0, -8);
    this.scene.add(g);
  }

  private buildOncoming() {
    const colors = ['#22262b', '#6b1f18', '#3d4a3f'];
    for (let i = 0; i < 3; i++) {
      const { g, body } = this.buildCarModel(colors[i]);
      g.rotation.y = Math.PI;
      for (const lx of [-0.58, 0.58]) {
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.glowTex, color: '#f4f0dc', transparent: true,
          opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        glow.position.set(lx, 0.58, -2.08);
        glow.scale.setScalar(2.6);
        g.add(glow);
        this.fadeSprites.push({ sp: glow, base: 0.9, night: true });
      }
      const spill = new THREE.PointLight('#e8e2c8', 16, 28, 1.6);
      spill.position.set(0, 0.7, -2.4);
      g.add(spill);
      this.scene.add(g);
      this.oncoming.push({ g, body, s: 500 + i * 700, v: 18 + Math.random() * 8 });
    }
  }

  /* --------------------------------------------------------------- extras */
  private buildGasStation() {
    const g = new THREE.Group();
    const wall = new THREE.MeshStandardMaterial({ color: '#31332e', roughness: 0.9 });
    const shop = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 4.6), wall);
    shop.position.set(6, 1.6, -2);
    g.add(shop);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(9, 0.35, 7),
      new THREE.MeshStandardMaterial({ color: '#3a3c37', roughness: 0.8 }));
    canopy.position.set(0, 4.2, 0);
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
    sign.position.set(-5.5, 5.6, 2.4);
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
    g.add(booth);
    const roofB = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.2, 2.8),
      new THREE.MeshStandardMaterial({ color: '#5c2620', roughness: 0.8 }));
    roofB.position.set(5.6, 2.85, 0);
    g.add(roofB);
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.5, 2.25),
      new THREE.MeshStandardMaterial({ color: '#1a1c20', roughness: 0.3, metalness: 0.4 }));
    band.position.set(5.6, 1.7, 0);
    g.add(band);
    // barrier arm, left raised long ago
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.3, 8),
      new THREE.MeshStandardMaterial({ color: '#8e2f22', roughness: 0.6 }));
    post.position.set(4.2, 0.65, 1.6);
    g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.4, 0.12),
      new THREE.MeshStandardMaterial({ color: '#d8d4c6', roughness: 0.6 }));
    arm.position.set(4.2, 3.0, 1.6);
    arm.rotation.z = 0.28;
    g.add(arm);
    // the sign
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
    sign.position.set(-5.4, 2.6, 0);
    sign.rotation.y = 0.10;
    g.add(sign);
    const legMat = new THREE.MeshStandardMaterial({ color: '#3d4044', roughness: 0.6, metalness: 0.5 });
    for (const lx of [-6.3, -4.5]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), legMat);
      leg.position.set(lx, 1.3, 0);
      g.add(leg);
    }
    this.border = g;
    this.scene.add(g);
  }

  /* --------------------------------------------------------------- village */
  private buildHouse(seed: number): THREE.Group {
    const g = new THREE.Group();
    const { map, emiss } = facadeTextures(seed);
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
    g.add(body);
    // low-pitched gable roof
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
    g.add(roof);
    return g;
  }

  private buildChurch(): THREE.Group {
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: '#a89f8d', roughness: 0.95 });
    const nave = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 9), stone);
    nave.position.y = 2.5;
    g.add(nave);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.2, 4),
      new THREE.MeshStandardMaterial({ color: '#4a4038', roughness: 0.95 }));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 1.45);
    roof.position.y = 6.1;
    g.add(roof);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2.6, 8.5, 2.6), stone);
    tower.position.set(0, 4.25, -5.4);
    g.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2.6, 4),
      new THREE.MeshStandardMaterial({ color: '#3a332c', roughness: 0.9 }));
    spire.rotation.y = Math.PI / 4;
    spire.position.set(0, 9.8, -5.4);
    g.add(spire);
    return g;
  }

  private buildLamp(): { g: THREE.Group; light: THREE.PointLight } {
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
    const light = new THREE.PointLight('#ff9d3a', 0, 20, 1.8);
    light.position.set(0.82, 4.4, 0);
    g.add(light);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: '#ffb44a', transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.set(0.82, 4.5, 0);
    glow.scale.setScalar(2.2);
    g.add(glow);
    this.fadeSprites.push({ sp: glow, base: 0.5, night: true });
    return { g, light };
  }

  private buildVillages() {
    const parkedColors = ['#8a2f24', '#3d4a5c', '#cfccc2', '#5c5346'];
    for (let pool = 0; pool < 2; pool++) {
      const members: VillagePool['members'] = [];
      const lamps: THREE.PointLight[] = [];
      const addM = (obj: THREE.Object3D, ds: number, lane: number, yaw = 0) => {
        this.scene.add(obj);
        members.push({ obj, ds, lane, yaw });
      };
      // entry sign
      const signTex = villageSignTexture('—', '');
      const signMat = new THREE.MeshStandardMaterial({
        map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.16, roughness: 0.5,
      });
      const signG = new THREE.Group();
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.25), signMat);
      board.position.y = 2.2;
      board.rotation.y = -0.10;
      signG.add(board);
      const legMat = new THREE.MeshStandardMaterial({ color: '#3d4044', roughness: 0.6, metalness: 0.5 });
      for (const lx of [-1.0, 1.0]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), legMat);
        leg.position.set(lx, 1.1, 0);
        signG.add(leg);
      }
      addM(signG, -130, ROAD_HALF + 1.9);
      // houses hugging the road
      const seeds = [1, 2, 3, 4, 5, 6, 7];
      const layout = [
        [-85, -1, 7.5], [-55, 1, 8.5], [-25, -1, 6.8], [5, 1, 7.2],
        [35, -1, 9.5], [65, 1, 6.9], [95, -1, 8.0],
      ];
      layout.forEach(([ds, side, dist], i) => {
        const h = this.buildHouse(seeds[i] + pool * 3);
        addM(h, ds, side * dist, side > 0 ? Math.PI : 0);
      });
      // church + frontón
      addM(this.buildChurch(), 25, -17);
      const fronton = new THREE.Mesh(new THREE.BoxGeometry(9, 6.5, 0.8),
        new THREE.MeshStandardMaterial({ color: '#cfc8b6', roughness: 0.9 }));
      fronton.position.y = 3.25;
      const frontonG = new THREE.Group();
      frontonG.add(fronton);
      addM(frontonG, -50, 15, 0.4);
      // street lamps
      for (const [ds, side] of [[-70, 1], [0, -1], [70, 1]]) {
        const { g, light } = this.buildLamp();
        if (side < 0) g.rotation.y = Math.PI;
        addM(g, ds, side * (ROAD_HALF + 1.3));
        lamps.push(light);
      }
      // parked cars
      for (const [ds, side, ci] of [[-38, 1, pool], [52, -1, pool + 2]]) {
        const { g } = this.buildCarModel(parkedColors[ci % parkedColors.length]);
        addM(g, ds, side * (ROAD_HALF + 1.6), side > 0 ? 0.06 : Math.PI - 0.06);
      }

      const vp: VillagePool = { members, signTex, lamps, centerS: 0, routeIdx: pool };
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
    const push = (obj: THREE.Object3D, s: number, lane: number, span: number, align = false, refresh?: (p: Prop) => void) => {
      sc.add(obj);
      this.props.push({ obj, s, lane, span, align, refresh });
    };

    const treeMat = new THREE.MeshStandardMaterial({ color: '#16210f', roughness: 1 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#1d1710', roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.6, 6), trunkMat);
      trunk.position.y = 0.8;
      g.add(trunk);
      if (Math.random() < 0.4) {
        const h = 4.5 + Math.random() * 3.5;
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.85, h, 7), treeMat);
        c.position.y = 1.2 + h / 2;
        g.add(c);
      } else {
        const r = 1.6 + Math.random() * 1.6;
        const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), treeMat);
        b.scale.y = 0.82;
        b.position.y = 1.6 + r * 0.6;
        g.add(b);
      }
      const side = Math.random() < 0.5 ? -1 : 1;
      push(g, i * (VIEW / 26) + Math.random() * 10, side * (8 + Math.random() * 24), VIEW);
    }

    const poleMat = new THREE.MeshStandardMaterial({ color: '#1c1712', roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 6), poleMat);
      p.position.y = 3.5;
      g.add(p);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.09, 0.09), poleMat);
      arm.position.y = 6.4;
      g.add(arm);
      push(g, i * 63, (i % 2 ? 1 : -1) * 6.6, 7 * 63);
    }

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
      });
    }

    // distance signs to the next village and the coast
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      const info = this.hooks.distanceSign(i * 600);
      const tex = distSignTexture(info.l1, info.l2);
      const mat = new THREE.MeshStandardMaterial({
        map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.16, roughness: 0.5,
      });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.35), mat);
      board.position.y = 2.3;
      board.rotation.y = -0.12;
      g.add(board);
      const legMat = new THREE.MeshStandardMaterial({ color: '#3d4044', roughness: 0.6, metalness: 0.5 });
      for (const lx of [-0.9, 0.9]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), legMat);
        leg.position.set(lx, 1.15, 0);
        g.add(leg);
      }
      g.userData.tex = tex;
      push(g, i * 600 + 320, ROAD_HALF + 1.8, 2 * 600, false, (p) => {
        const inf = this.hooks.distanceSign(p.s);
        distSignTexture(inf.l1, inf.l2, p.obj.userData.tex);
      });
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
  }

  /* ------------------------------------------------------------------ tick */
  update(dt: number, st: WorldState) {
    const { s, day } = st;

    /* day-night plumbing; fog leans toward the horizon tint so the
       land meets the sky without a hard seam */
    this.fogBlend.copy(day.fog).lerp(day.skyHorizon, 0.35);
    this.drawSky(day, st.tDay, st.time);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(this.fogBlend);
    fog.density = day.fogDensity;
    this.scene.background = this.fogBlend;
    this.sun.color.copy(day.sunColor);
    this.sun.intensity = day.sunI;
    const elev = sunElevation(st.tDay);
    if (elev > 0.01) {
      const ta = Math.PI * ((((st.tDay % 1) + 1) % 1) - 0.25) / 0.55;
      this.sun.position.set(Math.cos(ta) * 70, 12 + elev * 85, -45);
    } else {
      this.sun.position.set(35, 60, -80);
    }
    this.hemi.intensity = day.hemiI;
    this.amb.intensity = day.ambI;
    const dark = day.darkness;
    for (const m of this.houseEmissMats) m.emissiveIntensity = dark * 0.9;
    for (const m of this.lampMats) m.emissiveIntensity = dark * 1.6;
    for (const f of this.fadeSprites) f.sp.material.opacity = f.base * (0.06 + 0.94 * dark);
    for (const vp of this.villages) for (const l of vp.lamps) l.intensity = 12 * dark;
    this.gasSignMat.emissiveIntensity = 0.15 + 0.8 * dark;
    this.roadMat.roughness = 0.55 - 0.35 * st.rainI;

    /* road ribbon */
    const pos = this.roadGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i <= this.rows; i++) {
      const d = (i / this.rows) * VIEW;
      const o = this.off(s, s + d);
      pos.setX(i * 2, -ROAD_HALF + o);
      pos.setX(i * 2 + 1, ROAD_HALF + o);
    }
    pos.needsUpdate = true;
    this.roadTex.offset.y = (s % 6) / 6;

    /* roadside props */
    for (const p of this.props) {
      if (p.s < s - 22) {
        p.s += p.span;
        p.refresh?.(p);
      }
      const d = p.s - s;
      p.obj.position.z = -d;
      p.obj.position.x = this.off(s, p.s) + p.lane;
      p.obj.visible = d < VIEW + 30;
      if (p.align) p.obj.rotation.y = this.yawAt(s, p.s);
    }

    /* villages */
    for (const vp of this.villages) {
      if (vp.centerS + 220 < s) this.placeVillage(vp, vp.routeIdx + 2);
      for (const m of vp.members) {
        const mS = vp.centerS + m.ds;
        const d = mS - s;
        const vis = d > -60 && d < VIEW + 60;
        m.obj.visible = vis;
        if (!vis) continue;
        m.obj.position.z = -d;
        m.obj.position.x = this.off(s, mS) + m.lane;
        m.obj.rotation.y = this.yawAt(s, mS) + m.yaw;
      }
    }

    /* recurring landmarks */
    {
      const d = this.gasS - s;
      this.gas.visible = d > -40 && d < VIEW + 60;
      if (this.gas.visible) {
        this.gas.position.z = -d;
        this.gas.position.x = this.off(s, this.gasS) + ROAD_HALF + 8.5;
        this.gas.rotation.y = this.yawAt(s, this.gasS);
        const flick = Math.random() < 0.06 ? 0.15 : 1;
        this.gasLight.intensity = 26 * flick * (0.2 + 0.8 * dark);
      }
      const bd = this.borderS - s;
      if (this.borderS + 60 < s) this.borderS += CYCLE_LEN;
      this.border.visible = bd > -50 && bd < VIEW + 60;
      if (this.border.visible) {
        this.border.position.z = -bd;
        this.border.position.x = this.off(s, this.borderS);
        this.border.rotation.y = this.yawAt(s, this.borderS);
      }
    }

    /* oncoming traffic */
    for (let i = 0; i < this.oncoming.length; i++) {
      const oc = this.oncoming[i];
      oc.s -= oc.v * dt;
      if (oc.s < s - 30) {
        oc.s = s + VIEW + 300 + Math.random() * 1200;
        oc.v = 17 + Math.random() * 9;
        oc.body.color.set(this.mirrorOncoming && i === 0 ? '#e6e4de' : ['#22262b', '#6b1f18', '#3d4a3f'][i]);
      }
      const d = oc.s - s;
      oc.g.visible = d > -30 && d < VIEW + 40;
      if (oc.g.visible) {
        oc.g.position.z = -d;
        oc.g.position.x = this.off(s, oc.s) - 1.75;
        oc.g.rotation.y = Math.PI + this.yawAt(s, oc.s);
      }
    }

    /* player car */
    this.car.position.x = st.laneX;
    this.car.rotation.y = st.visualYaw;
    this.car.rotation.z = st.roll;
    for (const m of this.carMeshes) m.visible = !st.interior;
    if (this.flickerT > 0) this.flickerT -= dt;
    const lit = this.headlightsOn && (this.flickerT <= 0 || Math.random() < 0.3);
    this.headLeft.visible = lit;
    this.headRight.visible = lit;
    for (const cone of this.beamCones) {
      (cone.material as THREE.MeshBasicMaterial).opacity = lit ? 0.05 * dark : 0;
      cone.visible = !st.interior && lit && dark > 0.05;
    }
    for (const t of this.tailMats) t.emissiveIntensity = st.braking ? 2.2 : 0.5;

    /* rain, camera-local */
    const rp = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
    const wind = 2.2;
    const fall = 20 + st.rainI * 8;
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
    const visDrops = Math.floor(this.RAIN_COUNT * (0.15 + 0.85 * st.rainI));
    this.rain.geometry.setDrawRange(0, visDrops * 2);
    (this.rain.material as THREE.LineBasicMaterial).opacity = 0.10 + 0.14 * st.rainI + 0.10 * dark * st.rainI;
  }
}
