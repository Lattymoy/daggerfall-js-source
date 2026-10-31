// WALL-SHAFT (FIELD BUGS 2026-10-30g): a player's shaft at a foe by a wall meets the foe. DaggerfallMissile.cs:337's
// Raycast meets whichever collider is nearer, body or wall; the port tested the wall over the step's whole reach before
// the bodies, so a step that reached both was spent on the wall.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { coverStep } from '../../src/ai/cover.js';
import { ArrowFlight } from '../../src/combat/arrowFlight.js';
import { _resetBowBloomForTests } from '../../src/combat/bowBloom.js';   // BOW-GENERAL: each shot from rest flies true
import { flightStop } from '../../src/scenes/hostMagic.js';
import { missileReach, missileHitsFoe, sweepFrom, ARROW_FLIGHT_SPEED, MISSILE_COLLIDER_RADIUS } from '../../src/systems/spellcast.js';
import { CAPSULE_RADIUS } from '../../src/player/motor.js';

const W = 20;   // the wall: the plane z = W
const wallCollider = { raycast: (o, d, m) => { if (d[2] <= 0) return Infinity; const t = (W - o[2]) / d[2]; return t >= 0 && t <= m ? t : Infinity; }, cover: null, heightAt: null, surfaceAt: null };

// The dungeon's flight (dungeonContext.js updateMissiles) for one player shaft down +z at a foe whose axis stands `gap`
// off the wall: `touch` the wall met by touch (WALL-SHAFT), else at the step's whole reach (the old player law).
const shoot = (fps, gap, startZ, touch, collider = wallCollider, feet = [0, 0, W - gap]) => {
  const foe = { ai: { feet, height: 1.8, radius: 0.45 } };
  const m = { pos: [0, 1.2, startZ], dir: [0, 0, 1] };
  for (let i = 0; i < 400; i++) {
    const step = ARROW_FLIGHT_SPEED / fps;
    const { unit, reach } = missileReach(m.dir, step);
    const cs = flightStop(collider, m.pos, unit, reach, step, touch);
    if (Number.isFinite(cs.stop) && cs.stop <= reach) return { hit: false, at: m.pos[2] + cs.stop };
    const from = sweepFrom(m.pos, collider);
    m.pos[2] += step * cs.advance;
    if (missileHitsFoe(m.pos, foe, from)) return { hit: true };
  }
  return { hit: false, at: null };
};
/** A slab from the plane n.p = W to n.p = W + T, n tilted `ang` off +z about y - a door. */
const slab = (T, ang) => {
  const n = [Math.sin(ang), 0, Math.cos(ang)];
  return { n, raycast: (o, d, m) => {
    const dn = d[0] * n[0] + d[2] * n[2];
    if (dn <= 0) return Infinity;
    let best = Infinity;
    for (const p of [W, W + T]) { const t = (p - (o[0] * n[0] + o[2] * n[2])) / dn; if (t > 1e-4 && t <= m && t < best) best = t; }
    return best;
  }, cover: null, heightAt: null, surfaceAt: null };
};
/** A foe pressed to the slab's far face, CAPSULE_RADIUS off it, across from where a shaft from (0, 1.2, z) touches it. */
const behind = (door, T) => {
  const tHit = W / door.n[2], g = 0.45 * door.n[2] + T + CAPSULE_RADIUS;
  return [door.n[0] * g, 0, tHit - 0.45 + door.n[2] * g];
};

test('WALL-SHAFT: a swept shaft meets a foe pressed to a wall from every start, at 15, 20 and 30 frames a second (mutants: the wall at the step\'s whole reach)', () => {
  for (const fps of [15, 20, 30]) for (const gap of [0.45, 0.8, 1.2]) {
    let missed = 0;
    for (let k = 0; k < 60; k++) if (!shoot(fps, gap, (k * 0.0379) % 2.2, true).hit) missed++;
    assert.equal(missed, 0, `${fps} fps, the foe ${gap} m off the wall`);
  }
  let missedBefore = 0;   // the old player law - bodies swept, the wall at the step's whole reach - misses here, as reported
  for (let k = 0; k < 60; k++) if (!shoot(20, 0.45, (k * 0.0379) % 2.2, false).hit) missedBefore++;
  assert.ok(missedBefore > 10, `the step's whole reach misses ${missedBefore} of 60`);
});

test('WALL-SHAFT: a swept shaft with no foe still stops on the wall at the same point, a step later at most (mutants: never stops; stops short)', () => {
  for (const fps of [15, 30]) {
    const r = shoot(fps, -50, 3.1, true);
    assert.equal(r.hit, false);
    assert.ok(Math.abs(r.at - W) < 1e-9, `${fps} fps: it struck at z ${r.at}`);
  }
});

test('WALL-SHAFT: coverStep\'s swept law - the nearer of wall and cover by touch; unswept, a wall at the whole reach (mutants: swept ignored; the farther taken)', () => {
  const R = MISSILE_COLLIDER_RADIUS, step = 1.1, reach = step + R;
  assert.deepEqual(coverStep(Infinity, 1.2, reach, R, step), { stop: 1.2, advance: 1 }, 'unswept: the wall at the whole reach');
  assert.deepEqual(coverStep(Infinity, 1.2, reach, R, step, true), { stop: Infinity, advance: (1.2 - R) / step }, 'swept: flown to the touch');
  assert.deepEqual(coverStep(Infinity, 0.3, reach, R, step, true), { stop: 0.3, advance: 1 }, 'swept: stopped once touched');
  assert.deepEqual(coverStep(1.0, 1.4, reach, R, step, true), { stop: Infinity, advance: (1.0 - R) / step }, 'swept: the cover before the wall');
  assert.deepEqual(coverStep(1.4, 1.0, reach, R, step, true), { stop: Infinity, advance: (1.0 - R) / step }, 'swept: the wall before the cover');
  assert.deepEqual(coverStep(Infinity, Infinity, reach, R, step, true), { stop: Infinity, advance: 1 }, 'swept: nothing met');
});

test('WALL-SHAFT: the street\'s and a building\'s flight (ArrowFlight) lands every shaft at a foe pressed to a wall (mutants: the flight unwired)', () => {
  for (const fps of [15, 20, 30]) {
    let missed = 0;
    for (let k = 0; k < 40; k++) {
      const a = new ArrowFlight({ getGpuMesh: () => null, collider: { raycast: wallCollider.raycast, heightAt: () => -100 } });
      _resetBowBloomForTests();
      _resetBowBloomForTests();
    a.fire([0, 1.2, (k * 0.0379) % 2.2], [0, 0, 1], { fromPlayer: true, weapon: {} });
      const foe = { feet: [0, 0, W - 0.45], ref: { ai: { height: 1.8 } } };
      let hit = false;
      for (let i = 0; i < 200 && a.arrows.some((m) => !m.dead); i++) a.update(1 / fps, { foeTargets: [foe], onPlayerArrowHitFoe: () => { hit = true; } });
      if (!hit) missed++;
    }
    assert.equal(missed, 0, `${fps} fps`);
  }
});

test('WALL-SHAFT: the dungeon\'s flight passes `swept` for a player\'s shaft, and sweeps from a start that carries its collider (mutants: the host unwired)', () => {
  const src = readFileSync(fileURLToPath(new URL('../../src/scenes/dungeonContext.js', import.meta.url)), 'utf8');
  assert.match(src, /const _cs = flightStop\(collider, m\.pos, _unit, reach, step \* _len, !!m\.fromPlayer, dungeonMissileBodies\(m, foes, playerFeet, playerHeight\)\);/);   // PIN MOVED (TRUNK-FOES): and the bodies it strikes - AUDIT FB1031 F2: this missile's own
  assert.match(src, /const _from = m\.fromPlayer \? sweepFrom\(m\.pos, collider\) : null;/);
});

test('AUDIT WALL-SHAFT W1: a shaft parked by a door never meets a foe pressed behind it - straight on or at a slant, in the dungeon\'s flight and in ArrowFlight (mutants: the sight check dropped; to the hit surface)', () => {
  for (const [T, deg] of [[0.05, 0], [0.15, 0], [0.15, 40], [0.2, 50], [0.4, 75]]) {
    const door = slab(T, (deg * Math.PI) / 180), feet = behind(door, T);
    let struck = 0, bare = 0;
    for (let k = 0; k < 40; k++) {
      const z = (k * 0.0379) % 2.2;
      if (shoot(30, 0, z, true, door, feet).hit) struck++;
      const foe = { ai: { feet, height: 1.8, radius: 0.45 } }, m = { pos: [0, 1.2, z], dir: [0, 0, 1] };   // the control: no collider on the sweep
      for (let i = 0; i < 400; i++) {
        const { unit, reach } = missileReach(m.dir, ARROW_FLIGHT_SPEED / 30), cs = flightStop(door, m.pos, unit, reach, ARROW_FLIGHT_SPEED / 30, true);
        if (Number.isFinite(cs.stop) && cs.stop <= reach) break;
        const from = [...m.pos];
        m.pos[2] += (ARROW_FLIGHT_SPEED / 30) * cs.advance;
        if (missileHitsFoe(m.pos, foe, from)) { bare++; break; }
      }
    }
    assert.equal(struck, 0, `${T} m door, ${deg} degrees: no shaft through it`);
    if (deg >= 40 || T === 0.05) assert.ok(bare > 0, `${T} m, ${deg} degrees: without the sight check the sweep reaches through`);
  }
  let streetStruck = 0;
  for (let k = 0; k < 40; k++) {
    const door = slab(0.05, 0);
    const a = new ArrowFlight({ getGpuMesh: () => null, collider: { raycast: door.raycast, heightAt: () => -100 } });
    _resetBowBloomForTests();
    a.fire([0, 1.2, (k * 0.0379) % 2.2], [0, 0, 1], { fromPlayer: true, weapon: {} });
    const foe = { feet: [0, 0, W + 0.05 + CAPSULE_RADIUS], ref: { ai: { height: 1.8 } } };
    for (let i = 0; i < 200 && a.arrows.some((m) => !m.dead); i++) a.update(1 / 30, { foeTargets: [foe], onPlayerArrowHitFoe: () => { streetStruck++; } });
  }
  assert.equal(streetStruck, 0, 'ArrowFlight: none through a 5 cm door');
});
