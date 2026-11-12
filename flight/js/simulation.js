import { CRAFT, LEVELS, SECTORS, PULSE_TIME, clamp }
from './config.js';

const GROUPS = [2, 3, 2];
const BODY_RADIUS = .12;
const PELLET_SPEED = 1.82;

export class Mission {
  constructor(craftId, levelId, random = Math.random) {
    this.craft = CRAFT.find(c => c.id === craftId) || CRAFT[0];
    this.level = LEVELS.find(d => d.id === levelId) || LEVELS[1];
    this.random = random;
    this.player = { x: 0, y: 0, vx: 0, vy: 0, bank: 0, hp: this.craft.shield, invulnerable: 1.2 };
    this.elapsed = 0;
    this.score = 0;
    this.kills = 0;
    this.sector = 0;
    this.sectorAge = 0;
    this.groups = 0;
    this.nextGroup = 1;
    this.bossLaunched = false;
    this.outcome = null;
    this.enemies = [];
    this.shots = [];
    this.threats = [];
    this.salvage = [];
    this.particles = [];
    this.fireClock = .35;
    this.pulseClock = 0;
    this.ripple = 0;
    this.shake = 0;
    this.flash = 0;
    this.events = [{ type: 'sector', index: 0 }];
  }

  get boss() { return this.enemies.find(e => e.boss); }

  findLock() {
    let best = null, distance = .32;
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.z < .06 || e.z > 1.13) continue;
      const d = Math.hypot((e.x - this.player.x) * .95, e.y - this.player.y) - (e.boss ? .12 : 0);
      if (d < distance) {
        best = e;
        distance = d;
      }
    }
    return best;
  }

  fire() {
    const p = this.player, target = this.findLock();
    const lead = target ? clamp(target.z / PELLET_SPEED, .12, .55) : 1;
    const vx = target ? clamp((target.x - p.x) / lead, -.85, .85) : 0;
    const vy = target ? clamp((target.y - p.y) / lead, -.85, .85) : 0;
    const bolt = (offset, spread) => this.shots.push({
        x: p.x + offset, y: p.y, z: .042, vx: vx + spread, vy, damage: this.craft.damage
    });
    switch (this.craft.id) {
      case 'falcon':
      bolt(-.035, 0);
      bolt(.035, 0);
      break;
      case 'wraith':
      bolt(0, 0);
      break;
      case 'bastion':
      bolt(0, 0);
      bolt(-.04, -.24);
      bolt(.04, .24);
      break;
    }
    this.events.push({ type: 'shoot' });
  }

  pulse() {
    if (this.outcome || this.pulseClock > 0) return false;
    this.pulseClock = PULSE_TIME;
    this.ripple = .66;
    this.shake = Math.max(this.shake, .16);
    this.threats.length = 0;
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.z > 1.2) continue;
      this.hitEnemy(e, e.boss ? 10 : 4.5);
    }
    this.events.push({ type: 'pulse' });
    return true;
  }

  spawnGroup() {
    const count = this.level.count + (this.sector === 1 && this.groups === 1 ? 1 : 0);
    const phase = this.groups + this.sector, flip = phase % 2 ? -1 : 1;
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1), slot = u * 2 - 1;
      const x = slot * .77;
      const y = phase % 3 === 0 ? -.03 - .26 * Math.abs(slot) : phase % 3 === 1 ? -.19 + slot * .34 * flip : -.20 + Math.cos(u * Math.PI * 2) * .20;
      const heavy = this.sector > 0 && (i + phase) % 3 === 0;
      const hp = (heavy ? 5.1 : 3.05) * this.level.hp;
      this.enemies.push({
          x, y, z: 1.06 + Math.abs(slot) * .22 + i * .018, x0: x, y0: y,
          age: 0, phase: i * .8 + phase, i, heavy, boss: false, hp, maxHp: hp,
          hit: 0, fire: (1.9 + i * .47 + this.random() * .35) / this.level.tempo,
          bank: 0, diveAt: 5.1 + i * .44 + (heavy ? .8 : 0)
      });
    }
    this.groups++;
  }

  spawnBoss() {
    const hp = Math.round(61 * this.level.hp);
    this.bossLaunched = true;
    this.enemies.push({ boss: true, heavy: true, hp, maxHp: hp, x: 0, y: -.17, z: 1.18, age: 0, phase: 0, bank: 0, fire: 2.5, salvos: 0, hit: 0 });
    this.events.push({ type: 'boss' });
  }

  emitBurst(x, y, z, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2, speed = .09 + this.random() * .42;
      const life = .22 + this.random() * .45;
      this.particles.push({ x, y, z, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          vz: (this.random() - .5) * .65, color, life, maxLife: life, size: 1 + this.random() * 3 });
    }
  }

  hitEnemy(e, damage) {
    if (e.hp <= 0) return;
    e.hp -= damage;
    e.hit = .12;
    if (e.hp > 0) return;
    this.kills++;
    this.score += Math.round((e.boss ? 2500 : e.heavy ? 260 : 160) * this.level.score);
    this.emitBurst(e.x, e.y, e.z, e.boss ? '#ffb625' : '#ff925e', e.boss ? 65 : 18);
    this.events.push({ type: e.boss ? 'bossKill' : 'kill' });
    if (e.boss) {
      this.outcome = 'win';
      this.score += Math.round(Math.max(0, this.player.hp) * 3 * this.level.score);
    } else if (this.kills % 4 === 0) {
      this.salvage.push({ x: e.x, y: e.y, z: Math.max(.38, e.z), life: 0 });
    }
  }

  hitPlayer() {
    const p = this.player;
    if (p.invulnerable > 0 || this.outcome) return;
    p.hp = Math.max(0, p.hp - this.level.damage);
    p.invulnerable = 1.0;
    this.flash = .32;
    this.shake = .34;
    this.emitBurst(p.x, p.y, .02, '#86ddff', 15);
    this.events.push({ type: 'hit' });
    if (!p.hp) this.outcome = 'loss';
  }

  hostileFire(e) {
    const speed = (e.boss ? .46 : .41) * this.level.tempo;
    const flight = Math.max(.4, e.z / speed);
    const dx = clamp((this.player.x - e.x) / flight, -1.7, 1.7);
    const dy = clamp((this.player.y - e.y) / flight, -1.5, 1.5);
    const spawn = (spread, lift = 0) => this.threats.push({ x: e.x, y: e.y, z: e.z - .015, vx: dx + spread, vy: dy + lift, vz: -speed, boss: e.boss });
    spawn(0);
    if (e.boss || (e.heavy && this.level.id === 'hard')) {
      spawn(-.27);
      spawn(.27);
    }
    if (e.boss && ++e.salvos % 2 === 0) {
      spawn(-.14, -.23);
      spawn(.14, .23);
    }
  }

  advanceEnemies(dt) {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.age += dt;
      e.hit = Math.max(0, e.hit - dt);
      if (e.boss) {
        e.z = Math.max(.47, e.z - dt * .23);
        e.x = Math.sin(e.age * .63) * .58;
        e.y = -.18 + Math.sin(e.age * .97) * .21;
        e.bank = Math.cos(e.age * .63) * .14;
      } else {
        const dive = e.age > e.diveAt;
        e.z -= dt * (dive ? .25 : e.z > .60 ? .18 : .024) * this.level.tempo;
        e.x = e.x0 + Math.sin(e.age * (dive ? 1.7 : .9) + e.phase) * (e.heavy ? .10 : .16);
        e.y = e.y0 + Math.sin(e.age * 1.04 + e.phase) * .12;
        e.bank = Math.cos(e.age * 1.05 + e.phase) * (e.heavy ? .16 : .3);
      }
      e.fire -= dt;
      if (e.fire < 0 && e.z > .16 && e.z < .93) {
        this.hostileFire(e);
        e.fire = (e.boss ? e.hp < e.maxHp / 2 ? .94 : 1.27 : 2.8 + this.random() * .8) / this.level.tempo;
      }
      if (!e.boss && e.z <= .07 && e.z > -.045 && Math.hypot(this.player.x - e.x, this.player.y - e.y) < BODY_RADIUS * 1.2) {
        this.hitPlayer();
        e.escaped = true;
      }
    }
  }

  advanceShots(dt) {
    for (const s of this.shots) {
      const oldZ = s.z;
      s.z += PELLET_SPEED * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      for (const e of this.enemies) {
        if (e.hp <= 0 || e.escaped) continue;
        const depth = e.boss ? .12 : .065;
        if (e.z < oldZ - depth || e.z > s.z + depth) continue;
        const rx = e.boss ? .34 : e.heavy ? .145 : .115, ry = e.boss ? .21 : .13;
        if (((s.x - e.x) / rx) ** 2 + ((s.y - e.y) / ry) ** 2 > 1) continue;
        this.hitEnemy(e, s.damage);
        s.used = true;
        this.emitBurst(s.x, s.y, e.z, this.craft.color, 2);
        break;
      }
    }
    this.shots = this.shots.filter(s => !s.used && s.z < 1.42);
    for (const b of this.threats) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      if (b.z < .075 && b.z > -.04 && Math.hypot(b.x - this.player.x, b.y - this.player.y) < .09) {
        this.hitPlayer();
        b.used = true;
      }
    }
    this.threats = this.threats.filter(b => !b.used && b.z > -.13 && Math.abs(b.x) < 2.7 && Math.abs(b.y) < 2.4);
  }

  step(dt, input = {}) {
    if (this.outcome) return;
    const p = this.player;
    this.elapsed += dt;
    this.sectorAge += dt;
    this.pulseClock = Math.max(0, this.pulseClock - dt);
    this.ripple = Math.max(0, this.ripple - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    let dx = input.dx || 0, dy = input.dy || 0;
    if (input.target) {
      dx = clamp((input.target.x - p.x) * 8, -1, 1);
      dy = clamp((input.target.y - p.y) * 8, -1, 1);
    }
    const length = Math.max(1, Math.hypot(dx, dy));
    const response = 1 - Math.exp(-dt * 12);
    p.vx += (dx / length * this.craft.speed - p.vx) * response;
    p.vy += (dy / length * this.craft.speed - p.vy) * response;
    p.x = clamp(p.x + p.vx * dt, -1.02, 1.02);
    p.y = clamp(p.y + p.vy * dt, -1.2, .64);
    p.bank += (-p.vx / this.craft.speed * .62 - p.bank) * response;
    if (this.groups < GROUPS[this.sector] && this.sectorAge >= this.nextGroup) {
      this.spawnGroup();
      this.nextGroup = this.sectorAge + 5.3 / this.level.tempo;
    }
    this.fireClock -= dt;
    if (this.fireClock <= 0) {
      this.fire();
      this.fireClock += this.craft.fireInterval;
    }
    this.advanceEnemies(dt);
    if (!this.outcome) this.advanceShots(dt);
    this.enemies = this.enemies.filter(e => e.hp > 0 && !e.escaped && e.z > -.12);

    for (const item of this.salvage) {
      item.z -= dt * .34;
      item.life += dt;
      if (item.z < .12 && item.z > -.06 && Math.hypot(item.x - p.x, item.y - p.y) < .24 && p.hp > 0) {
        p.hp = Math.min(this.craft.shield, p.hp + 23);
        item.used = true;
        this.score += Math.round(80 * this.level.score);
        this.events.push({ type: 'repair' });
      }
    }
    this.salvage = this.salvage.filter(item => !item.used && item.z > -.12);
    for (const fx of this.particles) {
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.z += fx.vz * dt;
      fx.life -= dt;
    }
    this.particles = this.particles.filter(fx => fx.life > 0);

    if (!this.outcome && this.groups === GROUPS[this.sector] && !this.enemies.length) {
      if (this.sector < SECTORS.length - 1) {
        this.sector++;
        this.groups = 0;
        this.sectorAge = 0;
        this.nextGroup = 1.5;
        p.hp = Math.min(this.craft.shield, p.hp + 14);
        this.threats.length = 0;
        this.score += Math.round(300 * this.level.score);
        this.events.push({ type: 'sector', index: this.sector });
      } else if (!this.bossLaunched) this.spawnBoss();
    }
  }
}
