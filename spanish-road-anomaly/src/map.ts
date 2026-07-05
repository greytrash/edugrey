/* Fold-out paper map of the Iparralde–Baztan sheet. Real relative geography:
   the coast at the top, Larrun and Artzamendi standing over the valleys, the
   dashed muga, and the one road you are on. P pauses the car and holds the
   map up to the windscreen; a red X appears only after you have actually
   listened to Radio Sokoa long enough to understand where to go. */

import {
  VILLAGES, MAP_PATH, MAP_TAIL, MAP_DEST, MAP_PEAKS, MAP_TOWNS, CYCLE_LEN,
} from './route';

const W = 300, H = 340;

function reverse(str: string) { return str.split('').reverse().join(''); }

export class MiniMap {
  el: HTMLCanvasElement;
  visible = false;
  big = false;
  private ctx: CanvasRenderingContext2D;
  private paper: HTMLCanvasElement;
  private trail: { x: number; y: number }[] = [];
  private corruptNames = false;
  private missionS: number | null = null;
  private missionLabel = '';

  constructor() {
    this.el = document.createElement('canvas');
    this.el.id = 'map';
    this.el.width = W * 2; this.el.height = H * 2;
    this.el.style.width = W + 'px'; this.el.style.height = H + 'px';
    this.ctx = this.el.getContext('2d')!;
    this.ctx.setTransform(2, 0, 0, 2, 0, 0);
    document.body.appendChild(this.el);
    this.paper = document.createElement('canvas');
    this.paper.width = W * 2; this.paper.height = H * 2;
    this.renderPaper(false);
  }

  toggle() {
    this.visible = !this.visible;
    this.sync();
  }
  setBig(b: boolean) {
    this.big = b;
    this.sync();
  }
  private sync() {
    this.el.classList.toggle('open', this.visible || this.big);
    this.el.classList.toggle('big', this.big);
  }

  setMission(s: number, label: string) { this.missionS = s; this.missionLabel = label; }
  clearMission() { this.missionS = null; this.missionLabel = ''; }

  private renderPaper(corrupt: boolean) {
    const x = this.paper.getContext('2d')!;
    x.setTransform(2, 0, 0, 2, 0, 0);
    x.clearRect(0, 0, W, H);

    x.fillStyle = '#e7dfc9';
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      x.fillStyle = `rgba(150,130,90,${0.02 + Math.random() * 0.03})`;
      x.beginPath();
      x.arc(Math.random() * W, Math.random() * H, 8 + Math.random() * 30, 0, 7);
      x.fill();
    }
    x.strokeStyle = 'rgba(110,95,70,0.25)';
    x.lineWidth = 1;
    for (const fx of [W * 0.33, W * 0.66]) {
      x.beginPath(); x.moveTo(fx, 0); x.lineTo(fx, H); x.stroke();
    }

    /* the sea, along the top */
    x.fillStyle = '#b9c4bc';
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(W, 0);
    x.lineTo(W, H * 0.035);
    x.quadraticCurveTo(W * 0.7, H * 0.075, W * 0.42, H * 0.055);
    x.quadraticCurveTo(W * 0.22, H * 0.035, W * 0.10, H * 0.075);
    x.quadraticCurveTo(W * 0.04, H * 0.095, 0, H * 0.085);
    x.closePath();
    x.fill();
    x.fillStyle = 'rgba(60,80,90,0.65)';
    x.font = 'italic 9px Georgia, serif';
    x.fillText('GOLFO DE BIZKAIA', W * 0.40, H * 0.028);

    /* relief: hill hatching, heavier around the peaks */
    x.strokeStyle = 'rgba(120,105,75,0.30)';
    for (let i = 0; i < 46; i++) {
      const near = MAP_PEAKS[(Math.random() * MAP_PEAKS.length) | 0];
      const hx = (near.x + (Math.random() - 0.5) * 0.24) * W;
      const hy = (near.y + (Math.random() - 0.5) * 0.24) * H;
      x.beginPath();
      x.moveTo(hx - 5, hy + 3);
      x.quadraticCurveTo(hx, hy - 4, hx + 5, hy + 3);
      x.stroke();
    }
    /* named peaks */
    x.fillStyle = 'rgba(70,58,40,0.9)';
    x.font = 'bold 8px Georgia, serif';
    for (const p of MAP_PEAKS) {
      x.beginPath();
      x.moveTo(p.x * W, p.y * H - 4);
      x.lineTo(p.x * W - 4, p.y * H + 3);
      x.lineTo(p.x * W + 4, p.y * H + 3);
      x.closePath();
      x.fill();
      x.font = 'italic 7px Georgia, serif';
      x.fillText(`${p.name} ${p.h}`, p.x * W + 6, p.y * H + 2);
      x.font = 'bold 8px Georgia, serif';
    }

    /* the muga */
    x.strokeStyle = 'rgba(90,50,50,0.7)';
    x.lineWidth = 1.2;
    x.setLineDash([6, 5]);
    x.beginPath();
    x.moveTo(W * 0.04, H * 0.60);
    x.quadraticCurveTo(W * 0.30, H * 0.545, W * 0.52, H * 0.505);
    x.quadraticCurveTo(W * 0.78, H * 0.46, W * 0.98, H * 0.34);
    x.stroke();
    x.setLineDash([]);
    x.fillStyle = 'rgba(90,50,50,0.8)';
    x.font = '8px Georgia, serif';
    x.fillText('FRANTZIA', W * 0.08, H * 0.575);
    x.fillText('ESPAINIA', W * 0.08, H * 0.640);

    /* faint side roads to the off-route towns */
    x.strokeStyle = 'rgba(120,110,90,0.4)';
    x.lineWidth = 0.8;
    for (const rd of [
      [[0.46, 0.895], [0.30, 0.86], [0.16, 0.90]],
      [[0.53, 0.560], [0.66, 0.52], [0.63, 0.470]],
      [[0.42, 0.245], [0.55, 0.20], [0.60, 0.155]],
      [[0.42, 0.245], [0.56, 0.245], [0.68, 0.245]],
      [[0.33, 0.170], [0.24, 0.12], [0.19, 0.075]],
      [[0.38, 0.355], [0.31, 0.31], [0.27, 0.275]],
    ]) {
      x.beginPath();
      x.moveTo(rd[0][0] * W, rd[0][1] * H);
      x.quadraticCurveTo(rd[1][0] * W, rd[1][1] * H, rd[2][0] * W, rd[2][1] * H);
      x.stroke();
    }

    /* our road */
    x.strokeStyle = '#8e3a28';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(MAP_PATH[0].x * W, MAP_PATH[0].y * H);
    for (const p of MAP_PATH.slice(1)) x.lineTo(p.x * W, p.y * H);
    x.stroke();
    x.setLineDash([4, 4]);
    x.beginPath();
    x.moveTo(MAP_TAIL[0].x * W, MAP_TAIL[0].y * H);
    for (const p of MAP_TAIL.slice(1)) x.lineTo(p.x * W, p.y * H);
    x.stroke();
    x.setLineDash([]);

    /* villages on the route */
    x.font = 'bold 8.5px Georgia, serif';
    for (const v of VILLAGES) {
      const p = this.pos(v.s);
      x.fillStyle = '#2c261c';
      x.beginPath();
      x.arc(p.x, p.y, 2.2, 0, 7);
      x.fill();
      let name = v.name;
      if (corrupt && Math.random() < 0.4) name = reverse(name);
      x.fillText(name, p.x + 5, p.y + 3);
    }
    /* other towns, smaller */
    x.font = 'italic 7.5px Georgia, serif';
    x.fillStyle = 'rgba(44,38,28,0.8)';
    for (const t of MAP_TOWNS) {
      x.beginPath();
      x.arc(t.x * W, t.y * H, 1.6, 0, 7);
      x.fill();
      x.fillText(t.name, t.x * W + 4, t.y * H + 2);
    }
    /* destination */
    x.fillStyle = '#2c261c';
    x.font = 'bold 8.5px Georgia, serif';
    x.beginPath();
    x.arc(MAP_DEST.x * W, MAP_DEST.y * H, 2.8, 0, 7);
    x.fill();
    x.fillText(corrupt ? reverse(MAP_DEST.name) : MAP_DEST.name, MAP_DEST.x * W + 6, MAP_DEST.y * H + 3);

    /* cartouche + compass + scale */
    x.strokeStyle = 'rgba(60,50,35,0.8)';
    x.lineWidth = 1;
    x.strokeRect(8, H - 40, 118, 32);
    x.fillStyle = 'rgba(60,50,35,0.9)';
    x.font = 'bold 9px Georgia, serif';
    x.fillText('IPARRALDE · BAZTAN', 14, H - 28);
    x.font = 'italic 7px Georgia, serif';
    x.fillText('hoja 66 · 1:50 000', 14, H - 19);
    x.beginPath();
    x.moveTo(14, H - 13); x.lineTo(54, H - 13);
    x.stroke();
    x.fillText('5 km', 58, H - 11);
    x.font = 'bold 11px Georgia, serif';
    x.fillText('N', W - 22, 22);
    x.beginPath();
    x.moveTo(W - 18, 28); x.lineTo(W - 22, 40); x.lineTo(W - 18, 36); x.lineTo(W - 14, 40);
    x.closePath();
    x.fill();
  }

  private pos(sInCycle: number): { x: number; y: number } {
    const path = MAP_PATH;
    for (let i = 0; i < path.length - 1; i++) {
      if (sInCycle >= path[i].s && sInCycle <= path[i + 1].s) {
        const f = (sInCycle - path[i].s) / (path[i + 1].s - path[i].s || 1);
        return {
          x: (path[i].x + (path[i + 1].x - path[i].x) * f) * W,
          y: (path[i].y + (path[i + 1].y - path[i].y) * f) * H,
        };
      }
    }
    return { x: path[path.length - 1].x * W, y: path[path.length - 1].y * H };
  }

  update(s: number, cycle: number, inr: number, time: number) {
    if (!this.visible && !this.big) return;
    const wantCorrupt = cycle >= 3;
    if (wantCorrupt !== this.corruptNames) {
      this.corruptNames = wantCorrupt;
      this.renderPaper(wantCorrupt);
    }

    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    c.drawImage(this.paper, 0, 0, W, H);

    const p = this.pos(s % CYCLE_LEN);

    this.trail.push({ x: p.x, y: p.y });
    if (this.trail.length > 140) this.trail.shift();
    c.strokeStyle = 'rgba(160,40,30,0.30)';
    c.lineWidth = 1.4;
    c.beginPath();
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      i ? c.lineTo(t.x, t.y) : c.moveTo(t.x, t.y);
    }
    c.stroke();

    /* the mission X, only once Sokoa has been understood */
    if (this.missionS !== null) {
      const m = this.pos(this.missionS);
      const blink = 0.55 + 0.45 * Math.sin(time * 3);
      c.strokeStyle = `rgba(140,20,14,${blink})`;
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(m.x - 5, m.y - 5); c.lineTo(m.x + 5, m.y + 5);
      c.moveTo(m.x + 5, m.y - 5); c.lineTo(m.x - 5, m.y + 5);
      c.stroke();
      c.strokeStyle = `rgba(140,20,14,${blink * 0.5})`;
      c.lineWidth = 1;
      c.beginPath();
      c.arc(m.x, m.y, 9 + Math.sin(time * 3) * 2, 0, 7);
      c.stroke();
      if (this.big) {
        c.fillStyle = 'rgba(90,20,14,0.95)';
        c.font = 'italic 9px Georgia, serif';
        c.fillText(this.missionLabel, m.x + 12, m.y + 3);
      }
    }

    if (inr > 0.4) {
      for (let i = 0; i < 3; i++) {
        c.fillStyle = `rgba(160,40,30,${0.25 * inr})`;
        c.beginPath();
        c.arc(p.x + (Math.random() - 0.5) * 26 * inr, p.y + (Math.random() - 0.5) * 26 * inr, 2.4, 0, 7);
        c.fill();
      }
    }

    const pulse = 3 + Math.sin(time * 4) * 1.1;
    c.fillStyle = '#a82418';
    c.beginPath(); c.arc(p.x, p.y, 3, 0, 7); c.fill();
    c.strokeStyle = 'rgba(168,36,24,0.6)';
    c.lineWidth = 1.2;
    c.beginPath(); c.arc(p.x, p.y, pulse + 3, 0, 7); c.stroke();
  }
}
