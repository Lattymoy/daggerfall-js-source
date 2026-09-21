// C13: the host arrow flight (exterior/interior hosts - visible
// arrows without the dungeon missile system).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrowFlight, arrowMatrix, ARROW_MODEL_ID } from '../src/combat/arrowFlight.js';
import { MISSILE_SPEED, MISSILE_LIFESPAN_S, MISSILE_COLLIDER_RADIUS } from '../src/systems/spellcast.js';
import { Collider } from '../src/player/collider.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';   // FIELD-GUN20: the pool's 48 px sprite, in units
import { readFileSync } from 'node:fs';   // FIELD-GUN14: the four hosts, by source

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);

test('arrowflight: S5 constants ride the single source + the matrix law', () => {
  // The flight is the dungeon missile's shape: same speed, lifespan,
  // sweep radius (spellcast.js), same 99800 model, same oriented trs.
  assert.equal(ARROW_MODEL_ID, 99800);
  assert.equal(MISSILE_SPEED, 25.0);
  assert.equal(MISSILE_LIFESPAN_S, 8);
  assert.equal(MISSILE_COLLIDER_RADIUS, 0.45);
  // Level flight along +z: no pitch, identity-ish yaw
  const m = arrowMatrix([1, 2, 3], [0, 0, 1]);
  assert.equal(m[12], 1); assert.equal(m[13], 2); assert.equal(m[14], 3);
  // Straight down: pitch +90 (asin(-(-1))) - r12 = -sin(rx) = -1 in
  // the column-major trs (m[9]); the dungeon path shares this law.
  const down = arrowMatrix([0, 0, 0], [0, -1, 0]);
  assert.ok(Math.abs(down[9] + 1) < 1e-5, 'nose-down transform');
});

test('arrowflight: flies at missile speed, dies on geometry (a miss is LOST)', () => {
  const c = new Collider(() => -100);
  // A wall at z=5 facing the archer
  c.addMesh('wall', new Float32Array([-5, -5, 5, 5, -5, 5, 5, 5, 5, -5, 5, 5]), quadIdx, I);
  const a = new ArrowFlight({ getGpuMesh: () => null, collider: c });
  a.fire([0, 0, 0], [0, 0, 1]);
  a.update(0.1);   // 2.5 units: still flying
  assert.equal(a.arrows[0].dead, false);
  assert.ok(Math.abs(a.arrows[0].pos[2] - 2.5) < 1e-6);
  a.update(0.1);   // the sweep reaches the wall inside this step
  assert.equal(a.arrows[0].dead, true);
  // Open air: retires on the 8s lifespan instead
  const open = new ArrowFlight({ getGpuMesh: () => null, collider: new Collider(() => -100) });
  open.fire([0, 50, 0], [0, 0, 1]);
  for (let i = 0; i < 79; i++) open.update(0.1);
  assert.equal(open.arrows[0].dead, false);
  open.update(0.2);
  assert.equal(open.arrows[0].dead, true);
});

test('arrowflight X2: an ENEMY arrow hunts the player mid-capsule; a player arrow never does', () => {
  const open = () => new ArrowFlight({ getGpuMesh: () => null, collider: new Collider(() => -100) });
  // an enemy arrow flying +z reaches the player at z=5 and fires the
  // impact (the dungeon missile's contact law: 0.45 + the 0.45 body)
  const a = open();
  const hits = [];
  a.fire([0, 0.9, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 7 }, weapon: { templateIndex: 119 } });
  for (let i = 0; i < 4; i++) a.update(0.05, { playerFeet: [0, 0, 5], onPlayerHit: (m) => hits.push(m) });
  assert.equal(hits.length, 1, 'the impact fired once');
  assert.equal(hits[0].shooterFoe.id, 7, 'the record carries its shooter');
  assert.equal(a.arrows[0].dead, true, 'the landed arrow retires');
  // the SAME flight without the enemy meta sails through the player
  const p = open();
  p.fire([0, 0.9, 0], [0, 0, 1]);
  const pHits = [];
  for (let i = 0; i < 4; i++) p.update(0.05, { playerFeet: [0, 0, 5], onPlayerHit: (m) => pHits.push(m) });
  assert.equal(pHits.length, 0, 'player arrows resolve at the fire host, not here');
  assert.equal(p.arrows[0].dead, false);
  // and the bare update(dt) form still flies (the C13 hosts)
  const bare = open();
  bare.fire([0, 50, 0], [0, 0, 1]);
  bare.update(0.1);
  assert.equal(bare.arrows[0].dead, false);
});

test('arrowflight: bare terrain lands it (heightAt floor) + late collider resolve', () => {
  // heightAt = the streaming-world terrain fallback the mesh raycast
  // never sees; an arrow arcing under it has landed.
  const c = new Collider((x) => (x > 10 ? 5 : 0));
  const a = new ArrowFlight({ getGpuMesh: () => null, collider: () => c });   // function form (rebuilding hosts)
  a.fire([0, 1, 0], [Math.SQRT1_2, -0.1, Math.SQRT1_2]);   // shallow dive: -0.042/step, ~24 steps to ground
  for (let i = 0; i < 40 && !a.arrows[0].dead; i++) a.update(1 / 60);
  assert.equal(a.arrows[0].dead, true, 'landed in the ground');
  assert.ok(a.arrows[0].pos[1] <= 0.01);
  // All-dead sweep clears the list
  a.update(1 / 60);
  assert.equal(a.arrows.length, 0);
});

// ── FIELD-GUN14 (2026-09-20, Mac: "The projectile that shoots out
// should be an orb, not an arrow") ─────────────────────────────────
//
// THE THIRTEENTH TIME, AND THE SAME FAULT: a law written over DFU's
// own range, asked about this weapon, answering its default. The
// Thunderlock rides this lane because `isBowWeapon` is "scored on
// Archery" - which is exactly what let every host's ranged gate take
// it without being told it exists - and it inherited the bow's
// PICTURE along with the bow's physics. One module, one model, no
// fork, and a dwarven firearm fired arrows.
//
// The flight is not what changed. These pins hold that: same speed,
// same sweep, same contact, same lifespan, and a BOW still draws the
// shaft it always did.

/** A stand-in for a host's hitEffects pool - the one door the flight
 *  reaches a billboard through. */
function flatPool() {
  const live = [];
  return {
    live,
    showFlyingFlat(archive, pos, opts = {}) {
      const e = { archive, record: opts.record, at: [pos[0], pos[1], pos[2]], dead: false };
      live.push(e);
      return {
        move(p) { e.at = [p[0], p[1], p[2]]; },
        retire() { e.dead = true; },
      };
    },
  };
}

test('FIELD-GUN14: the gun’s shot flies as an ORB, the bow’s as a shaft - one flight, two pictures', async () => {
  const { createThunderlock } = await import('../src/systems/thunderlock.js');
  const { ORB_ARCHIVE, ORB_RECORD, orbArchiveFor } = await import('../src/characters/thunderlockIds.js');
  const { missileArchive, ELEMENTS } = await import('../src/systems/spellcast.js');

  // THE ORB IS DAGGERFALL'S OWN. 375-379 are the spell missiles, each
  // an animated glowing ball the game already loads - so this is the
  // port picking one, not the port drawing new art.
  assert.equal(ORB_ARCHIVE, missileArchive(ELEMENTS.Shock), 'the Thunder-lock fires the SHOCK missile’s flat');
  assert.equal(ORB_RECORD, 0, 'the flight record - record 1 of the same archive is the impact flash (AUDIT 26 F033)');
  // and the fork is asked of the WEAPON, once, on a leaf with no imports
  assert.equal(orbArchiveFor(createThunderlock()), ORB_ARCHIVE);
  assert.equal(orbArchiveFor({ templateIndex: 130 }), null, 'a Long Bow shoots a shaft');
  assert.equal(orbArchiveFor({ templateIndex: 120 }), null, 'and so does everything that is not this weapon');
  assert.equal(orbArchiveFor(null), null);

  for (const [what, weapon, wantsOrb] of [
    ['the Thunderlock', createThunderlock(), true],
    ['a Long Bow', { templateIndex: 130, name: 'Long Bow' }, false],
  ]) {
    const fx = flatPool();
    const drawn = [];
    const f = new ArrowFlight({ getGpuMesh: async () => ({ id: ARROW_MODEL_ID }), collider: null, effects: fx });
    f.fire([0, 1, 0], [0, 0, 1], { fromPlayer: true, weapon });
    for (let i = 0; i < 4; i++) { await Promise.resolve(); f.update(1 / 60, {}); }
    f.draw({ drawMesh: (g, mat) => drawn.push(mat[14]) });

    const shot = f.arrows[0];
    // THE FLIGHT IS UNTOUCHED either way - four steps at MISSILE_SPEED.
    assert.ok(Math.abs(shot.pos[2] - 4 * MISSILE_SPEED / 60) < 1e-9, `${what}: flies at missile speed`);

    if (wantsOrb) {
      assert.equal(fx.live.length, 1, `${what}: one flat`);
      assert.equal(fx.live[0].archive, ORB_ARCHIVE);
      assert.equal(fx.live[0].record, ORB_RECORD);
      assert.equal(drawn.length, 0, `${what}: and NO shaft mesh - the flat is the whole picture`);
      // the flat is where the shot IS, not where it was a step ago
      assert.deepEqual(fx.live[0].at, [...shot.pos], `${what}: the flat follows AFTER the advance`);
      // AND IT GOES OUT WITH THE FLIGHT - while OTHER shots are still
      // flying, which is the case the all-dead sweep does not cover.
      // `arrows` is not compacted until every record is dead, so a
      // spent orb whose flat is only released by that sweep hangs in
      // the world for as long as anything else is in the air.
      f.fire([0, 1, 0], [0, 0, 1], { fromPlayer: true, weapon });
      await Promise.resolve();
      f.update(1 / 60, {});
      assert.equal(fx.live.length, 2, `${what}: a second shot, a second flat`);
      shot.dead = true;
      f.update(1 / 60, {});
      assert.equal(fx.live[0].dead, true, `${what}: the spent shot's flat is retired at once`);
      assert.equal(fx.live[1].dead, false, `${what}: and the one still in the air is not`);
    } else {
      assert.equal(fx.live.length, 0, `${what}: no flat`);
      assert.equal(drawn.length, 1, `${what}: the 99800 shaft, drawn as it always was`);
      assert.ok(Math.abs(drawn[0] - shot.pos[2]) < 1e-5, `${what}: at the arrow’s own z`);   // float32: the matrix is a Float32Array
    }
  }
});

test('FIELD-GUN14: a host with no effects pool still flies the shot (and draws nothing for it)', async () => {
  const { createThunderlock } = await import('../src/systems/thunderlock.js');
  const drawn = [];
  const f = new ArrowFlight({ getGpuMesh: async () => ({ id: ARROW_MODEL_ID }), collider: null });   // no `effects`
  f.fire([0, 1, 0], [0, 0, 1], { fromPlayer: true, weapon: createThunderlock() });
  for (let i = 0; i < 3; i++) { await Promise.resolve(); f.update(1 / 60, {}); }
  f.draw({ drawMesh: (g, mat) => drawn.push(mat) });
  assert.equal(drawn.length, 0, 'no pool, no picture - and no shaft standing in for one');
  assert.ok(f.arrows[0].pos[2] > 0, 'the shot still flies, which is what the damage rides');
  // `clear` takes every flat down - worldModes keeps ONE pool across
  // every building, so a shot in flight when the door closes must not
  // be drawn in the next one. And that host DROPS its stale flights
  // through this door rather than by emptying the array, which is the
  // difference between a released flat and an orb hanging in the next
  // room.
  assert.doesNotThrow(() => f.clear());
  assert.equal(f.arrows.length, 0);
  assert.match(readFileSync('src/scenes/worldModes.js', 'utf8'),
    /if \(_arrowsCtx !== interiorCtx\) \{ interiorArrows\.clear\(\); _arrowsCtx = interiorCtx; \}/,
    'the building change goes through the flight\u2019s own door');

  {
    const fx2 = flatPool();
    const g = new ArrowFlight({ getGpuMesh: async () => null, collider: null, effects: fx2 });
    g.fire([0, 1, 0], [0, 0, 1], { fromPlayer: true, weapon: createThunderlock() });
    g.update(1 / 60, {});
    assert.equal(fx2.live.length, 1);
    g.clear();
    assert.equal(fx2.live[0].dead, true, 'the flat goes down with the flight');
  }
});

test('FIELD-GUN14: a gun leaves no shaft to pull out', async () => {
  const { playerArrowHitFoe } = await import('../src/combat/arrowFlight.js');
  const { createThunderlock } = await import('../src/systems/thunderlock.js');

  // BowDamage (DaggerfallMissile.cs:679-687) adds the arrow back to
  // whatever it struck because an arrow SURVIVES being shot. That is a
  // fact about the ROUND, and the port had it keyed on the LANE - so
  // every foe the Thunderlock struck gained Arrows it was never shot
  // with.
  const mkFoe = () => ({ dead: false, entity: { items: [], basics: {}, level: 1, stats: {}, skills: {} }, ai: { feet: [0, 0, 0], yaw: 0, height: 1.8 } });
  const player = { level: 1, items: [], stats: {}, skills: {} };
  const arrows = (items) => items.filter((it) => it.templateIndex === 131).length;

  const bowFoe = mkFoe();
  playerArrowHitFoe({ weapon: { templateIndex: 130, name: 'Long Bow' }, pos: [0, 0, 0] }, bowFoe, { playerEntity: player });
  assert.equal(arrows(bowFoe.entity.items), 1, 'the bow’s shaft is recoverable, exactly as BowDamage has it');

  const gunFoe = mkFoe();
  playerArrowHitFoe({ weapon: createThunderlock(), pos: [0, 0, 0] }, gunFoe, { playerEntity: player });
  assert.equal(gunFoe.entity.items.length, 0, 'a Dwemer Pellet is SPENT - nothing to pull out of the body');

  // the two answers come off the same leaf, so they cannot drift
  const src = readFileSync('src/combat/arrowFlight.js', 'utf8');
  assert.match(src, /if \(foe\.entity\?\.items && !orbArchiveFor\(m\.weapon\)\) \{/);
});

test('FIELD-GUN14: all four hosts paint the orb - the flight’s fork and the dungeon’s own', () => {
  // THE FOUR HOSTS RULE. Three run combat/arrowFlight.js and one
  // (dungeonContext) has its own S5 missile system, which is the shape
  // that has bitten this weapon at every round since FIELD-GUN3.
  for (const [file, ctor] of [
    ['src/scenes/world.js', /new ArrowFlight\(\{ getGpuMesh, collider: \(\) => collider, effects: hitEffects \}\)/],
    ['src/scenes/exterior.js', /new ArrowFlight\(\{ getGpuMesh, collider: \(\) => collider, effects: hitEffects \}\)/],
    ['src/scenes/worldModes.js', /new ArrowFlight\(\{ getGpuMesh: pipeline\.getGpuMesh, collider: \(\) => interiorCtx\?\.collider, effects: interiorHitEffects \}\)/],
  ]) {
    const s = readFileSync(file, 'utf8');
    assert.match(s, ctor, `${file}: the flight is handed the pool this host already draws every frame`);
    // ...and it IS drawn: the pool's batches reach a billboard pass
    assert.match(s, /HitEffects\.batches\(\)|hitEffects\.batches\(\)/, `${file}: the pool's batches reach the frame`);
  }
  // THE FOURTH: the dungeon's missile already draws both kinds - a
  // shaft is the 99800 mesh, a spell is a billboard riding its batch's
  // origin. One field says which, and nothing else about the arrow
  // changes.
  const dg = readFileSync('src/scenes/dungeonContext.js', 'utf8');
  assert.match(dg, /missiles\.push\(\{ arrow: true, flatArchive: orbArchiveFor\(weapon\),/, 'the fork is on the WEAPON, at the one place an arrow is born');
  assert.match(dg, /if \(!m\.arrow \|\| m\.flatArchive\) ensureMissileBatch\(m\);/, 'an arrow with its own flat gets a billboard');
  assert.match(dg, /const archive = m\.flatArchive \?\? missileArchive\(m\.spell\.element\);/, 'which it NAMES - a spell still asks its element');
  assert.match(dg, /const record = m\.flatArchive \? ORB_RECORD : 0;/, 'and its record rides the same leaf rather than a second literal 0');
  assert.match(dg, /if \(\(!m\.arrow \|\| m\.flatArchive\) && m\.batch\) m\.batch\.origin =/, 'and it flies the way a spell does - the origin uniform, not a rebuilt batch');
  assert.match(dg, /if \(!m\.flatArchive\) ensureArrowModel\(m\);/, 'and is NOT also a mesh - a shaft through the middle of the orb');
});

test('FIELD-GUN14: the pool grew a flat that FLIES - it moves, it loops, and the flight ends it', async () => {
  const { createHitEffects } = await import('../src/scenes/hitEffects.js');
  const { MISSILE_FPS } = await import('../src/render/flatAnimation.js');
  const { ORB_ARCHIVE } = await import('../src/characters/thunderlockIds.js');
  const settle = () => new Promise((r) => setImmediate(r));

  const built = [], destroyed = [];
  const renderer = {
    createBillboardBatch: (archive, record, size, centres) => {
      const b = { archive, record, size, centres, frame: null, origin: null };
      built.push(b); return b;
    },
    destroyBillboardBatch: (b) => destroyed.push(b),
  };
  const fx = createHitEffects({
    renderer,
    getTexture: async () => ({ recordCount: 8, getFrameCount: () => 4, getSize: () => ({ width: 64, height: 48 }), getScale: () => ({ width: 0, height: 0 }) }),
    uploadRecordFrame: () => {},
  });

  const orb = fx.showFlyingFlat(ORB_ARCHIVE, [0, 1, 0]);
  // before the archive warms, the handle is still safe to drive - a
  // shot does not wait for its texture
  assert.doesNotThrow(() => orb.move([0, 1, 2]));
  await settle();
  assert.equal(built.length, 1);
  assert.deepEqual(built[0].centres[0], [0, 1 - (48 * GLOBAL_SCALE) / 2, 0], 'the batch is built at the FIRE position - centres are baked STATIC_DRAW - and FIELD-GUN20: at its BASE, half a height under the centre (DaggerfallMissile.cs:601-602 never AlignToBase), so the orb sits ON the barrel');
  assert.deepEqual(built[0].origin, [0, 0, 2], 'and the flight it already had rides the origin uniform');

  orb.move([0, 1, 5]);
  assert.deepEqual(built[0].origin, [0, 0, 5], 'flight is the origin, not a rebuilt batch - zero GL churn');

  // IT LOOPS. Every other entry in this pool is a one-shot that ends
  // on its own animation; a projectile in flight must not freeze on
  // its last frame or vanish mid-air. So BOTH halves are pinned: it is
  // never destroyed, AND its frame is still turning at the end.
  const seen = [];
  for (let i = 0; i < 60; i++) { fx.tick(1 / MISSILE_FPS); seen.push(built[0].frame); }
  assert.equal(destroyed.length, 0, 'fifteen animation lengths later it is still flying');
  assert.equal(fx.batches().length, 1, 'and still drawn');
  assert.deepEqual(seen.slice(0, 8), [1, 2, 3, 0, 1, 2, 3, 0], 'the four frames WRAP - display-then-advance, as DFU loops them');
  assert.equal(new Set(seen.slice(-8)).size, 4, 'and it is still turning at the end, not frozen on a last frame');

  // A ONE-FRAME record is not "one tick and gone" for a projectile
  // either - there is no animation to end, and the shot is still in
  // the air.
  {
    const still = createHitEffects({
      renderer: { createBillboardBatch: (a, r, sz, c) => ({ archive: a, record: r, size: sz, centres: c, frame: null, origin: null }), destroyBillboardBatch: () => {} },
      getTexture: async () => ({ recordCount: 8, getFrameCount: () => 1, getSize: () => ({ width: 8, height: 8 }), getScale: () => ({ width: 0, height: 0 }) }),
      uploadRecordFrame: () => {},
    });
    still.showFlyingFlat(ORB_ARCHIVE, [0, 0, 0]);
    await settle();
    still.tick(1 / 60); still.tick(1 / 60);
    assert.equal(still.batches().length, 1, 'a still orb is still an orb');
    // ...while a still SPLASH is retired on the next tick, as it always was
    still.showBloodSplash(0, [0, 0, 0]);
    await settle();
    still.tick(1 / 60);
    assert.equal(still.batches().length, 1, 'and the one-shot beside it ended');
  }

  // A RECENTRE CARRIES IT. The four hosts rule: a floating-origin
  // shift rebuilds the batch, and the flight's delta has to go back on
  // or the orb snaps to the muzzle it left.
  fx.offsetAll([100, 0, 0]);
  const rebuilt = built[built.length - 1];
  assert.equal(built.length, 2);
  assert.deepEqual(rebuilt.centres[0], [100, 1 - (48 * GLOBAL_SCALE) / 2, 0]);
  assert.deepEqual(rebuilt.origin, [0, 0, 5], 'the delta survives the rebuild');

  // AND THE FLIGHT ENDS IT, not the clock.
  orb.retire();
  assert.equal(fx.batches().length, 0);
  assert.equal(destroyed.length, 2);
  assert.doesNotThrow(() => { orb.retire(); orb.move([0, 0, 0]); }, 'both doors are safe after the flat is gone');

  // and nothing above changed the one-shots this pool was built for
  fx.showBloodSplash(0, [0, 0, 0]);
  await settle();
  const splash = built[built.length - 1];
  for (let i = 0; i < 40; i++) fx.tick(1 / 10);
  assert.ok(destroyed.includes(splash), 'a splash still ends on its own animation');
});
