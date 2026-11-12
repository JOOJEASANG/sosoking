import test from 'node:test';
import assert from 'node:assert/strict';
import { CRAFT, LEVELS, PULSE_TIME }
from '../flight/js/config.js';
import { Mission }
from '../flight/js/simulation.js';

test('every craft fires its own pattern and damage, armour and movement are distinct', () => {
    const counts = [2, 1, 3];
    for (const [index, craft] of CRAFT.entries()) {
      const m = new Mission(craft.id, 'normal');
      m.fire();
      assert.equal(m.shots.length, counts[index]);
      assert.equal(m.player.hp, craft.shield);
      assert.ok(m.shots.every(s => s.damage === craft.damage));
    }
    assert.equal(new Set(CRAFT.map(c => c.speed)).size, 3);
});

test('difficulty changes the formations, incoming damage, and score', () => {
    const results = LEVELS.map(level => {
        const m = new Mission('falcon', level.id, () => .5);
        m.spawnGroup();
        const e = m.enemies[0];
        m.hitEnemy(e, 99);
        m.player.invulnerable = 0;
        m.hitPlayer();
        return [m.enemies.length, 100 - m.player.hp, m.score];
    });
    for (let i = 0;i < 3;i++) assert.ok(results[0][i] < results[1][i] && results[1][i] < results[2][i]);
});

test('shockwave clears hostile fire and obeys its cooldown', () => {
    const m = new Mission('falcon', 'normal', () => .5);
    m.spawnGroup();
    m.hostileFire(m.enemies[0]);
    assert.ok(m.threats.length);
    assert.ok(m.pulse());
    assert.equal(m.threats.length, 0);
    assert.equal(m.pulse(), false);
    for (let i = 0;i < Math.ceil(PULSE_TIME * 60) + 2;i++) m.step(1 / 60);
    assert.ok(m.pulse());
});

test('hostile shots can end a run and a fresh mission resets it', () => {
    const m = new Mission('wraith', 'hard');
    while (!m.outcome) {
      m.player.invulnerable = 0;
      m.threats.push({x: m.player.x, y: m.player.y, z: .04, vx: 0, vy: 0, vz: -.4});
      m.advanceShots(1 / 60);
    }
    assert.equal(m.outcome, 'loss');
    assert.equal(m.player.hp, 0);
    const fresh = new Mission(m.craft.id, m.level.id);
    assert.equal(fresh.kills, 0);
    assert.equal(fresh.outcome, null);
    assert.ok(fresh.player.hp > 0);
});

test('a repair pickup restores a surviving pilot once without exceeding shield capacity', () => {
    const m = new Mission('wraith', 'normal');
    m.player.hp -= 5;
    m.salvage.push({x: 0, y: 0, z: .03, life: 0});
    m.step(1 / 60);
    assert.equal(m.player.hp, m.craft.shield);
    assert.equal(m.salvage.length, 0);
    assert.ok(m.events.some(e => e.type === 'repair'));
});

test('all craft and difficulty combinations can reach and destroy the Warden through normal inputs', () => {
    for (const craft of CRAFT) for (const level of LEVELS) {
      const m = new Mission(craft.id, level.id, () => .48);
      const reached = new Set();
      for (let i = 0;i < 60 * 150 && !m.outcome;i++) {
        reached.add(m.sector);
        const threats = m.threats.filter(b => b.z < .26 && b.z > 0);
        if (m.pulseClock <= 0 && (m.boss || m.enemies.filter(e => e.z < 1.05).length >= 2 || threats.length)) m.pulse();
        const targets = m.enemies.filter(e => e.hp > 0).sort((a, b) => a.z - b.z);
        const e = targets[0];
        m.step(1 / 60, e ? {target: {x: e.x, y: e.y}} : {});
        m.events.length = 0;
      }
      assert.equal(reached.size, 3, craft.id + ' ' + level.id);
      assert.equal(m.outcome, 'win', craft.id + ' ' + level.id);
      assert.ok(m.bossLaunched);
      assert.ok(m.score > 2000);
    }
});
