/* The road and everything beside it. Distance-space world: every prop lives
   at an absolute road-distance `s`; the renderer projects it into view using
   the road's lateral curve, so the car stays at the origin and the world
   flows past. Recycled props get re-dressed through the hooks, which is how
   the anomaly rewrites the signs. */

import * as THREE from 'three';

export const ROAD_HALF = 3.6;      // narrow two-lane N-road
export const VIEW = 420;           // meters of world kept alive ahead

export interface WorldHooks {
  villageSign(s: number): { name: string; km: string };
  kmMarker(s: number): { road: string; km: string };
}

interface WorldState {
  s: number; speed: number; laneX: number;
  visualYaw: number; roll: number;
  headlights: boolean; interior: boolean; braking: boolean;
  time: number;
}

/* road lateral path and derivatives */
function F(s: number)  { return 42 * Math.sin(s * 0.0031) + 22 * Math.sin(s * 0.0073 + 2.1); }
function F1(s: number) { return 42 * 0.0031 * Math.cos(s * 0.0031) + 22 * 0.0073 * Math.cos(s * 0.0073 + 2.1); }
function F2(s: number) { return -42 * 0.0031 ** 2 * Math.sin(s * 0.0031) - 22 * 0.0073 ** 2 * Math.sin(s * 0.0073 + 2.1); }

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, x: c.getContext('2d')! };
}

function asphaltTexture(): THREE.CanvasTexture {
  const { c, x } = canvas(256, 256); // one repeat = full road width x 6 m
  x.fillStyle = '#181a1d';
  x.fillRect(0, 0, 256, 256);
  const img = x.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
  // solid white edge lines
  x.fillStyle = 'rgba(214,214,206,0.75)';
  x.fillRect(10, 0, 5, 256);
  x.fillRect(241, 0, 5, 256);
  // dashed white centre line: 3 m paint, 3 m gap
  x.fillRect(125, 0, 6, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function villageSignTexture(name: string, km: string, tex?: THREE.CanvasTexture): THREE.CanvasTexture {
  const w = 512, h = 256;
  const c = tex ? (tex.image as HTMLCanvasElement) : canvas(w, h).c;
  const x = c.getContext('2d')!;
  x.fillStyle = '#e8e6dd';
  x.fillRect(0, 0, w, h);
  x.strokeStyle = '#17181a';
  x.lineWidth = 14;
  x.strokeRect(12, 12, w - 24, h - 24);
  x.fillStyle = '#17181a';
  x.textAlign = 'center';
  x.font = 'bold 74px "Arial Narrow", Arial, sans-serif';
  x.fillText(name, w / 2, 118, w - 70);
  x.font = 'bold 88px "Arial Narrow", Arial, sans-serif';
  x.fillText(km, w / 2, 216, w - 70);
  if (tex) { tex.needsUpdate = true; return tex; }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
  x.font = 'bold 24px Arial, sans-serif';
  x.fillText(road, w / 2, 26);
  x.fillStyle = '#17181a';
  x.font = 'bold 52px Arial, sans-serif';
  x.fillText(km, w / 2, 108);
  if (tex) { tex.needsUpdate = true; return tex; }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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

interface Prop {
  obj: THREE.Object3D;
  s: number;
  lane: number;
  span: number;               // recycle distance
  refresh?: (p: Prop) => void;
}

export class World {
  scene = new THREE.Scene();
  car = new THREE.Group();
  private hooks: WorldHooks;
  private props: Prop[] = [];
  private roadGeo!: THREE.BufferGeometry;
  private roadTex!: THREE.CanvasTexture;
  private rows = 84;
  private headLeft!: THREE.SpotLight;
  private headRight!: THREE.SpotLight;
  private headGlows: THREE.Sprite[] = [];
  private tailMats: THREE.MeshStandardMaterial[] = [];
  private rain!: THREE.LineSegments;
  private drops: { p: THREE.Vector3 }[] = [];
  private glowTex = glowTexture();

  private carBodyMats: THREE.MeshStandardMaterial[] = [];
  private carMeshes: THREE.Mesh[] = [];

  private gas!: THREE.Group;
  private gasLight!: THREE.PointLight;
  private gasS = 1500;

  private oncoming!: THREE.Group;
  private oncomingBody!: THREE.MeshStandardMaterial;
  private oncomingS = 700;
  mirrorOncoming = false;      // later cycles: the other car is your car

  headlightsOn = true;
  private flickerT = 0;

  constructor(hooks: WorldHooks) {
    this.hooks = hooks;
    const sc = this.scene;
    sc.background = new THREE.Color('#05070c');
    sc.fog = new THREE.FogExp2('#05070c', 0.0105);

    const moonDir = new THREE.DirectionalLight('#76889f', 0.55);
    moonDir.position.set(35, 60, -80);
    sc.add(moonDir);
    sc.add(new THREE.HemisphereLight('#1b2534', '#0a0c08', 0.32));
    sc.add(new THREE.AmbientLight('#404860', 0.10));

    // gibbous moon behind gauze
    const moonMat = new THREE.SpriteMaterial({
      map: this.glowTex, color: '#c9d4e4', transparent: true, opacity: 0.5, fog: false,
    });
    const moon = new THREE.Sprite(moonMat);
    moon.position.set(90, 130, -380);
    moon.scale.setScalar(140);
    sc.add(moon);

    this.buildGround();
    this.buildRoad();
    this.buildCar();
    this.buildRain();
    this.buildGasStation();
    this.buildOncoming();
    this.populate();
  }

  curvature(s: number) { return F2(s); }

  /* lateral view-space offset of road distance `s2` seen from `s` */
  private off(s: number, s2: number) {
    return F(s2) - F(s) - F1(s) * (s2 - s);
  }

  private buildGround() {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshStandardMaterial({ color: '#0b0d09', roughness: 1 })
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
    const road = new THREE.Mesh(
      this.roadGeo,
      new THREE.MeshStandardMaterial({
        map: this.roadTex, roughness: 0.22, metalness: 0.35, // rain-slick
      })
    );
    road.position.y = 0.01;
    this.scene.add(road);
  }

  private buildCarModel(bodyColor: string): { g: THREE.Group; bodyMats: THREE.MeshStandardMaterial[]; meshes: THREE.Mesh[] } {
    const g = new THREE.Group();
    const meshes: THREE.Mesh[] = [];
    const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, metalness: 0.3 });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      g.add(m); meshes.push(m);
      return m;
    };
    add(new THREE.BoxGeometry(1.62, 0.5, 4.05), paint, 0, 0.52, 0);
    const roof = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6, metalness: 0.2 });
    add(new THREE.BoxGeometry(1.5, 0.46, 1.9), roof, 0, 0.98, 0.12);
    const glass = new THREE.MeshStandardMaterial({ color: '#0c0e10', roughness: 0.15, metalness: 0.6 });
    add(new THREE.BoxGeometry(1.42, 0.36, 2.0), glass, 0, 0.99, 0.12);
    const chrome = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.25, metalness: 0.9 });
    add(new THREE.BoxGeometry(1.7, 0.12, 0.16), chrome, 0, 0.34, -2.02);
    add(new THREE.BoxGeometry(1.7, 0.12, 0.16), chrome, 0, 0.34, 2.02);
    const rubber = new THREE.MeshStandardMaterial({ color: '#101010', roughness: 0.9 });
    for (const [wx, wz] of [[-0.82, 1.32], [0.82, 1.32], [-0.82, -1.32], [0.82, -1.32]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14), rubber);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.34, wz);
      g.add(w); meshes.push(w);
    }
    return { g, bodyMats: [paint, roof], meshes };
  }

  private buildCar() {
    const { g, bodyMats, meshes } = this.buildCarModel('#b3a179'); // faded 70s beige
    this.car = g;
    this.carBodyMats = bodyMats;
    this.carMeshes = meshes;

    const lampMat = new THREE.MeshStandardMaterial({
      color: '#fff3cf', emissive: '#ffedb8', emissiveIntensity: 1.6, roughness: 0.3,
    });
    for (const lx of [-0.58, 0.58]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), lampMat);
      lamp.position.set(lx, 0.58, -2.0);
      g.add(lamp); this.carMeshes.push(lamp);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: '#ffedb8', transparent: true,
        opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.position.set(lx, 0.58, -2.1);
      glow.scale.setScalar(1.3);
      g.add(glow); this.headGlows.push(glow);

      const tail = new THREE.MeshStandardMaterial({
        color: '#3a0d08', emissive: '#c03020', emissiveIntensity: 0.5, roughness: 0.4,
      });
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.05), tail);
      t.position.set(lx, 0.6, 2.06);
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
    }

    g.position.set(1.7, 0, -8);
    this.scene.add(g);
  }

  private buildRain() {
    const COUNT = 340;
    const pos = new Float32Array(COUNT * 2 * 3);
    for (let i = 0; i < COUNT; i++) {
      this.drops.push({
        p: new THREE.Vector3((Math.random() - 0.5) * 34, Math.random() * 14 - 3, -Math.random() * 46 - 2),
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: '#8fa0b4', transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    this.rain.frustumCulled = false;
  }
  get rainObject() { return this.rain; }

  private buildGasStation() {
    const g = new THREE.Group();
    const wall = new THREE.MeshStandardMaterial({ color: '#2a2c28', roughness: 0.9 });
    const shop = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 4.6), wall);
    shop.position.set(6, 1.6, -2);
    g.add(shop);
    const canopyMat = new THREE.MeshStandardMaterial({ color: '#31332e', roughness: 0.8 });
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(9, 0.35, 7), canopyMat);
    canopy.position.set(0, 4.2, 0);
    g.add(canopy);
    const poleMat = new THREE.MeshStandardMaterial({ color: '#3c3e3a', roughness: 0.7 });
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
    // pylon sign, sickly green
    const { c, x } = canvas(256, 96);
    x.fillStyle = '#0d1f14';
    x.fillRect(0, 0, 256, 96);
    x.strokeStyle = '#7fae6a'; x.lineWidth = 4;
    x.strokeRect(6, 6, 244, 84);
    x.fillStyle = '#9fd88a';
    x.textAlign = 'center';
    x.font = 'bold 40px "Arial Narrow", Arial, sans-serif';
    x.fillText('GASOLINERA', 128, 62);
    const signTex = new THREE.CanvasTexture(c);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.9,
      roughness: 0.6,
    });
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 6.4, 8), poleMat);
    pylon.position.set(-5.5, 3.2, 2.4);
    g.add(pylon);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.3), signMat);
    sign.position.set(-5.5, 5.6, 2.4);
    g.add(sign);

    this.gasLight = new THREE.PointLight('#cfe8b8', 26, 26, 1.6);
    this.gasLight.position.set(0, 3.7, 0);
    g.add(this.gasLight);

    this.gas = g;
    this.scene.add(g);
  }
  setGasStationS(s: number) { this.gasS = s; }
  get gasStationS() { return this.gasS; }

  private buildOncoming() {
    const { g, bodyMats } = this.buildCarModel('#22262b');
    this.oncomingBody = bodyMats[0];
    g.rotation.y = Math.PI; // facing us
    for (const lx of [-0.58, 0.58]) {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: '#f4f0dc', transparent: true,
        opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.position.set(lx, 0.58, -2.05);
      glow.scale.setScalar(2.6);
      g.add(glow);
    }
    const spill = new THREE.PointLight('#e8e2c8', 18, 30, 1.6);
    spill.position.set(0, 0.7, -2.4);
    g.add(spill);
    this.oncoming = g;
    this.scene.add(g);
  }

  private populate() {
    const sc = this.scene;
    const push = (obj: THREE.Object3D, s: number, lane: number, span: number, refresh?: (p: Prop) => void) => {
      sc.add(obj);
      this.props.push({ obj, s, lane, span, refresh });
    };

    // trees: cypress cones + holm-oak blobs, silhouette dark
    const treeMat = new THREE.MeshStandardMaterial({ color: '#0e120c', roughness: 1 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#151109', roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.6, 6), trunkMat);
      trunk.position.y = 0.8;
      g.add(trunk);
      if (Math.random() < 0.45) {
        const h = 4.5 + Math.random() * 3.5;
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.85, h, 7), treeMat);
        c.position.y = 1.2 + h / 2;
        g.add(c);
      } else {
        const r = 1.6 + Math.random() * 1.4;
        const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), treeMat);
        b.scale.y = 0.8;
        b.position.y = 1.6 + r * 0.6;
        g.add(b);
      }
      const side = Math.random() < 0.5 ? -1 : 1;
      push(g, i * (VIEW / 26) + Math.random() * 10, side * (7 + Math.random() * 22), VIEW);
    }

    // telephone poles, alternating sides
    const poleMat = new THREE.MeshStandardMaterial({ color: '#181410', roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 6), poleMat);
      p.position.y = 3.5;
      g.add(p);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.09, 0.09), poleMat);
      arm.position.y = 6.4;
      g.add(arm);
      push(g, i * 63, (i % 2 ? 1 : -1) * 6.4, 7 * 63);
    }

    // white delineator posts with reflector band
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

    // kilometre stones (right side), text via hooks
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
      push(g, i * 220 + 90, ROAD_HALF + 1.1, 2 * 220, (p) => {
        const inf = this.hooks.kmMarker(p.s);
        kmStoneTexture(inf.road, inf.km, p.obj.userData.tex);
      });
    }

    // village distance signs (right side) — the anomaly's main voice
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      const info = this.hooks.villageSign(i * 300);
      const tex = villageSignTexture(info.name, info.km);
      const mat = new THREE.MeshStandardMaterial({
        map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.16, roughness: 0.5,
      });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), mat);
      board.position.y = 2.2;
      board.rotation.y = -0.12;
      g.add(board);
      const legMat = new THREE.MeshStandardMaterial({ color: '#3d4044', roughness: 0.6, metalness: 0.5 });
      for (const lx of [-0.9, 0.9]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), legMat);
        leg.position.set(lx, 1.1, 0);
        g.add(leg);
      }
      g.userData.tex = tex;
      push(g, i * 300 + 160, ROAD_HALF + 1.8, 2 * 300, (p) => {
        const inf = this.hooks.villageSign(p.s);
        villageSignTexture(inf.name, inf.km, p.obj.userData.tex);
      });
    }

    // dark farmhouses far off, one window inexplicably lit
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const houseMat = new THREE.MeshStandardMaterial({ color: '#141310', roughness: 1 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 4), houseMat);
      body.position.y = 1.3;
      g.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.6, 4), houseMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 3.4;
      roof.scale.set(1, 1, 0.8);
      g.add(roof);
      const winMat = new THREE.MeshStandardMaterial({
        color: '#100b04', emissive: '#d9a028', emissiveIntensity: 1.4, roughness: 0.5,
      });
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), winMat);
      win.position.set(1.2, 1.4, 2.02);
      g.add(win);
      g.userData.win = winMat;
      push(g, i * (VIEW / 3) + 60, (i % 2 ? 1 : -1) * (26 + Math.random() * 18), VIEW);
    }
  }

  flickerHeadlights(seconds = 0.5) { this.flickerT = seconds; }

  update(dt: number, st: WorldState) {
    const { s } = st;

    /* road ribbon follows the curve as seen from s */
    const pos = this.roadGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i <= this.rows; i++) {
      const d = (i / this.rows) * VIEW;
      const o = this.off(s, s + d);
      pos.setX(i * 2, -ROAD_HALF + o);
      pos.setX(i * 2 + 1, ROAD_HALF + o);
    }
    pos.needsUpdate = true;
    this.roadTex.offset.y = (s % 6) / 6;

    /* props */
    for (const p of this.props) {
      if (p.s < s - 22) {
        p.s += p.span;
        p.refresh?.(p);
        const win = p.obj.userData.win as THREE.MeshStandardMaterial | undefined;
        if (win) win.emissiveIntensity = 1.4;
      }
      const d = p.s - s;
      p.obj.position.z = -d;
      p.obj.position.x = this.off(s, p.s) + p.lane;
      p.obj.visible = d < VIEW + 30;
      const win = p.obj.userData.win as THREE.MeshStandardMaterial | undefined;
      if (win && d < 70) win.emissiveIntensity = Math.max(0, win.emissiveIntensity - dt * 3);
    }

    /* recurring gas station */
    {
      const d = this.gasS - s;
      this.gas.visible = d > -40 && d < VIEW + 60;
      if (this.gas.visible) {
        this.gas.position.z = -d;
        this.gas.position.x = this.off(s, this.gasS) + ROAD_HALF + 8.5;
        const flick = Math.random() < 0.06 ? 0.15 : 1;
        this.gasLight.intensity = 26 * flick;
      }
    }

    /* oncoming car */
    {
      this.oncomingS -= 21 * dt;
      if (this.oncomingS < s - 30) {
        this.oncomingS = s + VIEW + 300 + Math.random() * 900;
        this.oncomingBody.color.set(this.mirrorOncoming ? '#b3a179' : '#22262b');
      }
      const d = this.oncomingS - s;
      this.oncoming.visible = d > -30 && d < VIEW + 40;
      if (this.oncoming.visible) {
        this.oncoming.position.z = -d;
        this.oncoming.position.x = this.off(s, this.oncomingS) - 1.75;
      }
    }

    /* player car pose */
    this.car.position.x = st.laneX;
    this.car.rotation.y = st.visualYaw;
    this.car.rotation.z = st.roll;
    for (const m of this.carMeshes) m.visible = !st.interior;
    for (const gl of this.headGlows) gl.visible = !st.interior && this.headlightsOn && this.flickerT <= 0;

    /* headlights + anomaly flicker */
    if (this.flickerT > 0) this.flickerT -= dt;
    const lit = this.headlightsOn && (this.flickerT <= 0 || Math.random() < 0.3);
    this.headLeft.visible = lit;
    this.headRight.visible = lit;

    for (const t of this.tailMats) t.emissiveIntensity = st.braking ? 2.2 : 0.5;

    /* rain, in camera-local space */
    const rp = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
    const wind = 2.2;
    const fall = 21;
    const dirY = -fall * 0.028;
    const dirX = wind * 0.028;
    const dirZ = st.speed * 0.02;
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i].p;
      d.y -= fall * dt;
      d.x += wind * dt;
      d.z += st.speed * dt * 0.7;
      if (d.y < -3) { d.y += 17; d.x = (Math.random() - 0.5) * 34; }
      if (d.x > 17) d.x -= 34;
      if (d.z > -2) d.z -= 44;
      rp.setXYZ(i * 2, d.x, d.y, d.z);
      rp.setXYZ(i * 2 + 1, d.x + dirX, d.y + dirY, d.z + dirZ);
    }
    rp.needsUpdate = true;
  }
}
