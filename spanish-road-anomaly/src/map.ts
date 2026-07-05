/* Fold-out paper map of the Baztan–Lapurdi corridor. The one honest witness:
   when the road folds, the red dot snaps back and the map does not apologise.
   In late cycles the ink itself stops being reliable. */

import { VILLAGES, MAP_PATH, MAP_TAIL, MAP_DEST, CYCLE_LEN } from './route';

const W = 300, H = 340;

function reverse(str: string) { return str.split('').reverse().join(''); }

export class MiniMap {
  el: HTMLCanvasElement;
  visible = false;
  private ctx: CanvasRenderingContext2D;
  private paper: HTMLCanvasElement;
  private trail: { x: number; y: number }[] = [];
  private corruptNames = false;

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
    this.el.classList.toggle('open', this.visible);
  }

  /* static layer: paper, coast, border, roads, names */
  private renderPaper(corrupt: boolean) {
    const x = this.paper.getContext('2d')!;
    x.setTransform(2, 0, 0, 2, 0, 0);
    x.clearRect(0, 0, W, H);

    // aged paper with mottling
    x.fillStyle = '#e7dfc9';
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) {
      x.fillStyle = `rgba(150,130,90,${0.02 + Math.random() * 0.03})`;
      x.beginPath();
      x.arc(Math.random() * W, Math.random() * H, 8 + Math.random() * 30, 0, 7);
      x.fill();
    }
    // fold creases
    x.strokeStyle = 'rgba(110,95,70,0.25)';
    x.lineWidth = 1;
    for (const fx of [W * 0.33, W * 0.66]) {
      x.beginPath(); x.moveTo(fx, 0); x.lineTo(fx, H); x.stroke();
    }

    // the sea
    x.fillStyle = '#b9c4bc';
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(W, 0);
    x.lineTo(W, H * 0.05);
    x.quadraticCurveTo(W * 0.75, H * 0.10, W * 0.55, H * 0.055);
    x.quadraticCurveTo(W * 0.3, H * 0.02, W * 0.12, H * 0.08);
    x.quadraticCurveTo(W * 0.04, H * 0.10, 0, H * 0.09);
    x.closePath();
    x.fill();
    x.fillStyle = 'rgba(60,80,90,0.65)';
    x.font = 'italic 9px Georgia, serif';
    x.fillText('GOLFO DE BIZKAIA', W * 0.36, H * 0.035);

    // hills hatching
    x.strokeStyle = 'rgba(120,105,75,0.30)';
    for (let i = 0; i < 26; i++) {
      const hx = Math.random() * W, hy = H * 0.35 + Math.random() * H * 0.6;
      x.beginPath();
      x.moveTo(hx - 5, hy + 3);
      x.quadraticCurveTo(hx, hy - 4, hx + 5, hy + 3);
      x.stroke();
    }

    // the muga, dashed with crosses
    x.strokeStyle = 'rgba(90,50,50,0.7)';
    x.lineWidth = 1.2;
    x.setLineDash([6, 5]);
    x.beginPath();
    x.moveTo(W * 0.06, H * 0.72);
    x.quadraticCurveTo(W * 0.35, H * 0.60, W * 0.60, H * 0.54);
    x.quadraticCurveTo(W * 0.85, H * 0.48, W * 0.98, H * 0.36);
    x.stroke();
    x.setLineDash([]);
    x.fillStyle = 'rgba(90,50,50,0.8)';
    x.font = '8px Georgia, serif';
    x.fillText('FRANTZIA', W * 0.10, H * 0.665);
    x.fillText('ESPAINIA', W * 0.10, H * 0.755);

    // faint side roads
    x.strokeStyle = 'rgba(120,110,90,0.4)';
    x.lineWidth = 0.8;
    for (const rd of [
      [[0.44, 0.82], [0.22, 0.78], [0.10, 0.86]],
      [[0.57, 0.60], [0.42, 0.52], [0.30, 0.55]],
      [[0.70, 0.36], [0.86, 0.40], [0.96, 0.35]],
      [[0.64, 0.45], [0.52, 0.38], [0.44, 0.30]],
    ]) {
      x.beginPath();
      x.moveTo(rd[0][0] * W, rd[0][1] * H);
      x.quadraticCurveTo(rd[1][0] * W, rd[1][1] * H, rd[2][0] * W, rd[2][1] * H);
      x.stroke();
    }

    // our road
    x.strokeStyle = '#8e3a28';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(MAP_PATH[0].x * W, MAP_PATH[0].y * H);
    for (const p of MAP_PATH.slice(1)) x.lineTo(p.x * W, p.y * H);
    x.stroke();
    // the part you never reach
    x.setLineDash([4, 4]);
    x.beginPath();
    x.moveTo(MAP_TAIL[0].x * W, MAP_TAIL[0].y * H);
    for (const p of MAP_TAIL.slice(1)) x.lineTo(p.x * W, p.y * H);
    x.stroke();
    x.setLineDash([]);

    // villages
    x.font = 'bold 8.5px Georgia, serif';
    for (const v of VILLAGES) {
      const p = MAP_PATH.find(m => m.s === v.s)!;
      x.fillStyle = '#2c261c';
      x.beginPath();
      x.arc(p.x * W, p.y * H, 2.4, 0, 7);
      x.fill();
      let name = v.name;
      if (corrupt && Math.random() < 0.4) name = reverse(name);
      x.fillText(name, p.x * W + 5, p.y * H + 3);
    }
    // destination
    x.fillStyle = '#2c261c';
    x.beginPath();
    x.arc(MAP_DEST.x * W, MAP_DEST.y * H, 2.8, 0, 7);
    x.fill();
    x.fillText(corrupt ? reverse(MAP_DEST.name) : MAP_DEST.name, MAP_DEST.x * W - 62, MAP_DEST.y * H - 5);

    // cartouche + compass
    x.strokeStyle = 'rgba(60,50,35,0.8)';
    x.lineWidth = 1;
    x.strokeRect(8, H - 34, 106, 26);
    x.fillStyle = 'rgba(60,50,35,0.9)';
    x.font = 'bold 9px Georgia, serif';
    x.fillText('BAZTAN · LAPURDI', 14, H - 22);
    x.font = 'italic 7px Georgia, serif';
    x.fillText('hoja 66 · 1:50 000', 14, H - 13);
    x.font = 'bold 11px Georgia, serif';
    x.fillText('N', W - 22, 22);
    x.beginPath();
    x.moveTo(W - 18, 28); x.lineTo(W - 22, 40); x.lineTo(W - 18, 36); x.lineTo(W - 14, 40);
    x.closePath();
    x.fill();
  }

  /* map-space position for a road distance */
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
    if (!this.visible) return;
    const wantCorrupt = cycle >= 3;
    if (wantCorrupt !== this.corruptNames) {
      this.corruptNames = wantCorrupt;
      this.renderPaper(wantCorrupt);
    }

    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    c.drawImage(this.paper, 0, 0, W, H);

    const p = this.pos(s % CYCLE_LEN);

    // breadcrumb trail of where you have "been"
    this.trail.push({ x: p.x, y: p.y });
    if (this.trail.length > 130) this.trail.shift();
    c.strokeStyle = 'rgba(160,40,30,0.30)';
    c.lineWidth = 1.4;
    c.beginPath();
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      i ? c.lineTo(t.x, t.y) : c.moveTo(t.x, t.y);
    }
    c.stroke();

    // interference: the dot stops being one dot
    if (inr > 0.4) {
      for (let i = 0; i < 3; i++) {
        c.fillStyle = `rgba(160,40,30,${0.25 * inr})`;
        c.beginPath();
        c.arc(p.x + (Math.random() - 0.5) * 26 * inr, p.y + (Math.random() - 0.5) * 26 * inr, 2.4, 0, 7);
        c.fill();
      }
    }

    // you are here (pulsing)
    const pulse = 3 + Math.sin(time * 4) * 1.1;
    c.fillStyle = '#a82418';
    c.beginPath(); c.arc(p.x, p.y, 3, 0, 7); c.fill();
    c.strokeStyle = 'rgba(168,36,24,0.6)';
    c.lineWidth = 1.2;
    c.beginPath(); c.arc(p.x, p.y, pulse + 3, 0, 7); c.stroke();
  }
}
