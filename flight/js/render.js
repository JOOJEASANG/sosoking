import { clamp }
from './config.js';
import { drawShip }
from './models.js';

const TAU = Math.PI * 2;
const FIGHTER_SKINS = {
  falcon: { span: 3.44, nozzles: [-.138, .144], nozzleY: .935 },
  wraith: { span: 3.08, nozzles: [0], nozzleY: .934 },
  bastion: { span: 3.85, nozzles: [-.166, .165], nozzleY: .934 }
};
function randomSequence(seed) {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class SpaceView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', {alpha: false});
    this.backdrop = new Image();
    this.backdrop.src = new URL('../art/orbit.webp', import.meta.url).href;
    this.skins = Object.fromEntries(Object.keys(FIGHTER_SKINS).map(id => {
          const image = new Image();
          image.src = new URL('../art/' + id + '-flight.webp', import.meta.url).href;
          return [id, image];
    }));
    const random = randomSequence(70943);
    this.stars = Array.from({length: 150}, () => ({angle: random() * TAU, seed: random(), size: .3 + random() * 1.4, blue: random() > .7}));
    this.rocks = Array.from({length: 17}, () => ({side: random() > .5 ? 1 : -1, seed: random(), y: random() * 1.5 - .78, x: .66 + random() * .85, spin: random() * 4, size: .004 + random() * .011}));
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.65);
    if (!w || !h) return;
    if (this.w === w && this.h === h && this.dpr === dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.unit = Math.min(h * .061, w * .068, 62);
  }

  point(x, y, z) {
    const f = 1 / (1 + Math.max(-.16, z) * 2.55);
    return {x: this.w * (.5 + x * .425 * f - this.px * .065 * (1 - f)),
      y: this.h * (.35 + .35 * f + y * .345 * f - this.py * .035 * (1 - f)), f};
  }

  background(m) {
    const ctx = this.ctx, w = this.w, h = this.h, t = m.elapsed;
    const g = ctx.createLinearGradient(0, 0, w * .25, h);
    g.addColorStop(0, '#030914');
    g.addColorStop(.60, '#101f36');
    g.addColorStop(1, '#223448');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (this.backdrop.complete && this.backdrop.naturalWidth) {
      const image = this.backdrop, scale = Math.max(w / image.width, h / image.height) * 1.055;
      const iw = image.width * scale, ih = image.height * scale;
      const panX = clamp((w - iw) * .55 - this.px * w * .015, w - iw, 0);
      const panY = clamp((h - ih) * .5 - this.py * h * .012, h - ih, 0);
      ctx.drawImage(image, panX, panY, iw, ih);
      ctx.fillStyle = 'rgba(3,9,20,.2)';
      ctx.fillRect(0, 0, w, h);
    }
    if (m.sector > 0) {
      ctx.fillStyle = m.sector === 1 ? 'rgba(44,15,62,.21)' : 'rgba(85,37,25,.19)';
      ctx.fillRect(0, 0, w, h);
    }
    const cx = w * (.5 - this.px * .043), cy = h * (.35 - this.py * .026);
    const speed = this.reduced ? .038 : .085;
    for (const s of this.stars) {
      const d = (s.seed + t * speed) % 1, r = .055 + d * d * 1.27;
      const dx = Math.cos(s.angle) * w * .75, dy = Math.sin(s.angle) * h * .85;
      const x = cx + dx * r, y = cy + dy * r;
      if (x < 0 || x > w || y < 0 || y > h) continue;
      ctx.globalAlpha = .18 + d * .57;
      ctx.strokeStyle = s.blue ? '#85dcff' : '#dae9fa';
      const tail = this.reduced ? .0005 : .002 + d * d * .014;
      ctx.lineWidth = Math.max(.65, s.size * (.25 + d * .55));
      ctx.beginPath();
      ctx.moveTo(x - dx * tail, y - dy * tail);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const rockCount = [5, 17, 9][m.sector];
    for (let i = 0;i < rockCount;i++) {
      const a = this.rocks[i], z = 1.18 - ((a.seed + t * (this.reduced ? .038 : .071)) % 1) * 1.32;
      const p = this.point(a.x * a.side * (1.05 + .6 * (1 - z)), a.y, z), r = Math.min(w, h) * a.size * p.f * 2;
      if (r < 1 || p.x < -r || p.x > w + r) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(t * .14 + a.spin);
      ctx.globalAlpha = .76;
      ctx.fillStyle = '#465160';
      ctx.beginPath();
      ctx.moveTo(-r, .12 * r);
      ctx.lineTo(-.35 * r, -.73 * r);
      ctx.lineTo(.53 * r, -.56 * r);
      ctx.lineTo(r, .10 * r);
      ctx.lineTo(.24 * r, .82 * r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#26313e';
      ctx.beginPath();
      ctx.moveTo(-r, .12 * r);
      ctx.lineTo(.15 * r, -.16 * r);
      ctx.lineTo(r, .10 * r);
      ctx.lineTo(.24 * r, .82 * r);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  playerShip(m, at) {
    const p = m.player, id = m.craft.id, skin = this.skins[id], profile = FIGHTER_SKINS[id], ctx = this.ctx;
    if (!skin.complete || !skin.naturalWidth) {
      drawShip(ctx, id, at.x, at.y, this.unit, p.bank, -p.vx * .055, m.elapsed);
      return;
    }
    const width = this.unit * profile.span, height = width * skin.naturalHeight / skin.naturalWidth * .79;
    const top = -height * .53;
    ctx.save();
    // Project the textured dorsal surface as the pilot rolls and pitches.
    ctx.transform(Math.cos(p.bank), -Math.sin(p.bank) * .65, p.bank * .16, 1 + p.vy * .045, at.x, at.y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const nx of profile.nozzles) {
      const x = nx * width, y = top + height * profile.nozzleY;
      const plume = width * (.17 + .022 * Math.sin(m.elapsed * 34 + nx)), r = width * (id === 'wraith' ? .048 : .034);
      const jet = ctx.createLinearGradient(x, y, x, y + plume);
      jet.addColorStop(0, '#f1fcff');
      jet.addColorStop(.2, m.craft.color);
      jet.addColorStop(1, m.craft.color + '00');
      ctx.fillStyle = jet;
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.quadraticCurveTo(x - r * .78, y + plume * .48, x, y + plume);
      ctx.quadraticCurveTo(x + r * .7, y + plume * .53, x + r, y);
      ctx.fill();
      const halo = ctx.createRadialGradient(x, y + r * .45, 0, x, y + r * .45, r * 2.6);
      halo.addColorStop(0, m.craft.color);
      halo.addColorStop(1, m.craft.color + '00');
      ctx.fillStyle = halo;
      ctx.fillRect(x - r * 2.6, y - r * 2.2, r * 5.2, r * 5.2);
    }
    ctx.restore();
    ctx.drawImage(skin, -width * .5, top, width, height);
    ctx.restore();
  }

  render(m) {
    this.resize();
    if (!this.w || !this.ctx) return;
    const ctx = this.ctx, w = this.w, h = this.h, t = m.elapsed;
    const p = m.player;
    this.px = p.x;
    this.py = p.y;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.background(m);
    ctx.save();
    if (m.shake > 0 && !this.reduced) ctx.translate(Math.sin(t * 88) * m.shake * 7, Math.cos(t * 103) * m.shake * 6);
    const items = [];
    for (const e of m.enemies) items.push({kind: 'enemy', o: e, z: e.z});
    for (const o of m.shots) items.push({kind: 'shot', o, z: o.z});
    for (const o of m.threats) items.push({kind: 'threat', o, z: o.z});
    for (const o of m.salvage) items.push({kind: 'salvage', o, z: o.z});
    for (const o of m.particles) items.push({kind: 'spark', o, z: o.z});
    items.push({kind: 'player', o: p, z: 0});
    items.sort((a, b) => b.z - a.z);
    const lock = m.findLock();
    for (const item of items) {
      const o = item.o, at = this.point(o.x, o.y, item.z);
      if (item.kind === 'enemy') {
        const type = o.boss ? 'warden' : o.heavy ? 'guard' : 'drone';
        const unit = this.unit * at.f * (o.boss ? 2.36 : o.heavy ? 1.08 : .94);
        drawShip(ctx, type, at.x, at.y, unit, o.bank, Math.PI + Math.sin(o.age * .7 + o.phase) * .11, t, o.hit > .075);
        if (o.fire < .52 && o.z > .16) {
          const radius = unit * (o.boss ? 1.25 : 1.7);
          ctx.strokeStyle = '#ff9b6e';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(at.x, at.y, radius + .8, Math.PI * 1.18, Math.PI * 1.83);
          ctx.stroke();
        }
        if (o === lock) this.brackets(at.x, at.y, unit * (o.boss ? 2 : 1.7), '#a0f2d9');
      } else if (item.kind === 'shot') {
        const tail = this.point(o.x - o.vx * .045, o.y - o.vy * .045, Math.max(0, item.z - .105));
        this.laser(tail, at, m.craft.color, Math.max(1.15, 3.2 * at.f));
      } else if (item.kind === 'threat') {
        const tail = this.point(o.x - o.vx * .065, o.y - o.vy * .065, item.z + .047);
        const r = Math.max(2.6, Math.min(w, h) * .009 * at.f);
        this.laser(tail, at, '#ff794f', r * .9);
        const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, r * 2.7);
        g.addColorStop(0, '#fff2bf');
        g.addColorStop(.22, '#ffaf74');
        g.addColorStop(.52, '#f44e35bb');
        g.addColorStop(1, '#f9473000');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(at.x, at.y, r * 2.7, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#ffe2a9';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(at.x, at.y, r * .66, 0, TAU);
        ctx.stroke();
      } else if (item.kind === 'salvage') {
        const r = Math.max(7, this.unit * at.f * .47);
        ctx.save();
        ctx.translate(at.x, at.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#0b504c';
        ctx.strokeStyle = '#83ffe2';
        ctx.lineWidth = 2;
        ctx.fillRect(-r * .7, -r * .7, r * 1.4, r * 1.4);
        ctx.strokeRect(-r * .7, -r * .7, r * 1.4, r * 1.4);
        ctx.rotate(-Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-r * .38, 0);
        ctx.lineTo(r * .38, 0);
        ctx.moveTo(0, -r * .38);
        ctx.lineTo(0, r * .38);
        ctx.stroke();
        ctx.restore();
      } else if (item.kind === 'spark') {
        const r = o.size * at.f * (.5 + o.life / o.maxLife);
        ctx.globalAlpha = clamp(o.life / o.maxLife, 0, 1);
        ctx.fillStyle = o.color;
        ctx.fillRect(at.x - r, at.y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      } else {
        this.playerShip(m, at);
        if (p.invulnerable > 0 && m.elapsed > 1.2) {
          const r = this.unit * 1.79;
          ctx.strokeStyle = 'rgba(121,233,255,' + (.3 + .25 * Math.sin(t * 20)) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(at.x, at.y, r, r * .62, 0, 0, TAU);
          ctx.stroke();
        }
      }
    }
    const ret = this.point(p.x, p.y, .55), r = clamp(this.unit * .27, 7, 14);
    ctx.strokeStyle = lock ? '#aaf8df' : '#d3ebf7b3';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(ret.x, ret.y, r * .7, 0, TAU);
    ctx.moveTo(ret.x - r * 1.48, ret.y);
    ctx.lineTo(ret.x - r * .69, ret.y);
    ctx.moveTo(ret.x + r * .69, ret.y);
    ctx.lineTo(ret.x + r * 1.48, ret.y);
    ctx.moveTo(ret.x, ret.y - r * 1.35);
    ctx.lineTo(ret.x, ret.y - r * .72);
    ctx.stroke();
    ctx.fillRect(ret.x - 1, ret.y - 1, 2, 2);
    if (m.ripple > 0) {
      const wave = 1 - m.ripple / .66, center = this.point(p.x, p.y, .04), radius = Math.max(2, wave * Math.hypot(w, h) * .77);
      ctx.save();
      ctx.globalAlpha = (1 - wave) * .68;
      ctx.strokeStyle = m.craft.color;
      ctx.lineWidth = 3 + wave * 5;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, radius, radius * .72, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    if (m.flash > 0) {
      const v = ctx.createRadialGradient(w * .5, h * .5, h * .19, w * .5, h * .5, Math.max(w, h) * .72);
      v.addColorStop(0, '#b5392f00');
      v.addColorStop(1, 'rgba(195,59,43,' + (m.flash * 1.8) + ')');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    }
  }

  laser(a, b, color, size) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.globalAlpha = .38;
    ctx.lineWidth = size * 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = size;
    ctx.stroke();
    ctx.strokeStyle = '#f1fbff';
    ctx.lineWidth = Math.max(.65, size * .36);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  brackets(x, y, r, color) {
    const ctx = this.ctx, s = Math.max(3, r * .24);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
      ctx.moveTo(x + dx * (r - s), y + dy * r * .65);
      ctx.lineTo(x + dx * r, y + dy * r * .65);
      ctx.lineTo(x + dx * r, y + dy * (r * .65 - s));
    }
    ctx.stroke();
  }
}
