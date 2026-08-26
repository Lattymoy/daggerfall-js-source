// AUDIT 26 F033: the missile IMPACT FLASH (DaggerfallMissile.cs
// DoCollision :357-370 + Update :290-320). A spell missile that
// COLLIDES throws its flying flat away and plays the element archive's
// RECORD 1 one-shot at ImpactBillboardFramesPerSecond (15), then sits
// at the collision point for PostImpactLifespanInSeconds (0.6) before
// it is destroyed. The port had the whole animation law
// (render/flatAnimation.js) and no host that ever spawned the flash, so
// every fireball simply vanished the instant it landed.
//
// The three legs pinned here are the three the C# distinguishes:
// a COLLISION flashes and holds; the LIFESPAN EXPIRY (:294-295) does
// neither; and the :363 gate (elementType != None && targetType !=
// ByTouch) keeps arrows and touch casts flashless.
//
// F033b is the fourth: the flash and the hold END SEPARATELY. The flash
// billboard is a CHILD of the missile (:601) armed ONE SHOT, so
// DaggerfallBillboard.cs:127-131 destroys THAT object at the animation's
// wrap while the missile object goes on to 0.6s. The port stopped the
// clock at the wrap but kept the batch drawn, freezing the last frame
// for the third of a second DFU shows nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPlayerMagic, POST_IMPACT_LIFESPAN_S, missileFlashesOnImpact,
} from '../src/scenes/hostMagic.js';
import { MISSILE_FPS, IMPACT_FPS } from '../src/render/flatAnimation.js';
import { MISSILE_LIFESPAN_S } from '../src/systems/spellcast.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, 'src/scenes', f), 'utf8');

// A microtask/macrotask flush: the billboard batches are published from
// an async getTexture, exactly as the hosts publish them.
const flush = () => new Promise((r) => setTimeout(r, 0));

const FIRE_ARCHIVE = 375;         // GetMissileTextureArchive, ElementTypes.Fire (:56)
const FLIGHT_FRAMES = 5;
const IMPACT_FRAMES = 4;

const damageEffect = (mag = 20) => ({
  type: 4, subType: 0,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
});
const spellOf = (rangeType, over = {}) => ({
  name: 'Test Spell', index: 90, element: 0, rangeType, effects: [damageEffect()], ...over,
});
const mkPlayer = () => ({
  isPlayer: true, level: 1, health: 50, maxHealth: 50,
  maxMagicka: 500, magicka: 500,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { intelligence: 50, willpower: 50, endurance: 50 },
  career: {}, activeEffects: [],
});
const mkFoe = (x, z) => ({
  dead: false,
  ai: { feet: [x, 0, z] },
  entity: {
    level: 1, health: 40, maxHealth: 40, magicka: 0, maxMagicka: 0,
    skills: new Array(40).fill(30), stats: { willpower: 30 },
    career: {}, activeEffects: [],
  },
});

/** The engine over stubs that can actually SEE the billboard records:
 *  every batch made, every record/frame uploaded, every batch freed. */
function rig({ foes = [], raycast = () => Infinity } = {}) {
  const player = mkPlayer();
  const world = {
    player, foes, said: [], made: [], freed: [], records: [], frames: [], foeHurt: new Map(), hurtPlayer: 0,
  };
  const magic = createPlayerMagic({
    renderer: {
      createBillboardBatch: (archive, record) => {
        const b = { archive, record, origin: null, frame: null };
        world.made.push(b);
        return b;
      },
      destroyBillboardBatch: (b) => { world.freed.push(b); },
    },
    audio: { playOneShot: () => {}, play3d: () => {} },
    getTexture: async () => ({
      getSize: () => [16, 16],
      getScale: () => [0, 0],
      getFrameCount: (record) => (record === 1 ? IMPACT_FRAMES : FLIGHT_FRAMES),
    }),
    uploadRecord: (archive, record) => world.records.push([archive, record]),
    uploadRecordFrame: (archive, record, frame) => world.frames.push([archive, record, frame]),
    collider: { raycast },
    playerEntity: player,
    playerSinks: {
      hurt: (n) => { world.hurtPlayer += n; player.health -= n; },
      heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => world.said.push(l),
    },
    say: (l) => world.said.push(l),
    surfacePlayer: () => {},
    foes: () => world.foes,
    foeSinks: (f) => ({
      hurt: (n) => { world.foeHurt.set(f, (world.foeHurt.get(f) ?? 0) + n); f.entity.health -= n; },
      heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {},
    }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99,
  });
  return { magic, world };
}

test('F033 constants: PostImpactLifespanInSeconds and the impact billboard speed, verbatim', () => {
  assert.equal(POST_IMPACT_LIFESPAN_S, 0.6);   // DaggerfallMissile.cs:47
  assert.equal(IMPACT_FPS, 15);                // ImpactBillboardFramesPerSecond (:45)
  assert.equal(MISSILE_FPS, 5);                // BillboardFramesPerSecond (:44)
});

test('F033 gate: DoCollision :363 - elementType != None && targetType != ByTouch', () => {
  // A SPELL missile at range flashes...
  assert.equal(missileFlashesOnImpact({ spell: spellOf(2) }), true);
  assert.equal(missileFlashesOnImpact({ spell: spellOf(4, { element: 4 }) }), true);
  // ...a ByTouch payload never does (TargetTypes.ByTouch = the classic rangeType 1)...
  assert.equal(missileFlashesOnImpact({ spell: spellOf(1) }), false);
  // ...and an ARROW carries no element at all: ElementTypes.None.
  assert.equal(missileFlashesOnImpact({ arrow: true, weapon: {} }), false);
  assert.equal(missileFlashesOnImpact({ spell: { rangeType: 2 } }), false);
});

test('F033: a COLLISION swaps the flying flat for the record-1 ONE SHOT at IMPACT_FPS, and holds the missile 0.6s', async () => {
  const { magic, world } = rig({ foes: [mkFoe(0, 2)] });
  magic.setReadied(spellOf(2));
  assert.equal(magic.castInput([0, 0.9, 0], [0, 0, 1]), true);

  // one frame to publish the flight batch (record 0, DFU's :601-605)
  magic.update(0.01, [0, 0, -5]);
  await flush();
  assert.deepEqual(world.made.map((b) => [b.archive, b.record]), [[FIRE_ARCHIVE, 0]]);

  // fly into the foe
  for (let i = 0; i < 20 && !world.foeHurt.get(world.foes[0]); i++) magic.update(0.02, [0, 0, -5]);
  assert.ok(world.foeHurt.get(world.foes[0]) > 0, 'the missile landed');
  await flush();

  // UseSpellBillboardAnims(1, true): the flight batch is destroyed and
  // RECORD 1 of the same archive takes its place on the same missile.
  assert.deepEqual(world.made.map((b) => [b.archive, b.record]), [[FIRE_ARCHIVE, 0], [FIRE_ARCHIVE, 1]]);
  assert.deepEqual(world.freed.map((b) => [b.archive, b.record]), [[FIRE_ARCHIVE, 0]]);
  assert.deepEqual(world.records, [[FIRE_ARCHIVE, 0], [FIRE_ARCHIVE, 1]]);
  assert.deepEqual(world.frames.filter((f) => f[1] === 1),
    [[FIRE_ARCHIVE, 1, 0], [FIRE_ARCHIVE, 1, 1], [FIRE_ARCHIVE, 1, 2], [FIRE_ARCHIVE, 1, 3]]);
  assert.equal(magic.missileCount(), 1, 'the struck missile is HELD, not destroyed');

  // The flash runs at 15 FPS and STOPS at the wrap (OneShot). At the
  // flight speed of 5 these four ticks would show frame 1; looping, the
  // fourth would wrap to 0.
  const flash = world.made[1];
  const seen = [];
  for (let i = 0; i < 4; i++) { magic.update(1 / IMPACT_FPS, [0, 0, -5]); seen.push(flash.frame); }
  assert.deepEqual(seen, [1, 2, 3, 3]);
  assert.equal(magic.missileCount(), 1, 'still held: 4/15s is inside the 0.6s lifespan');

  // ...and PostImpactLifespanInSeconds after the impact, it is destroyed.
  magic.update(POST_IMPACT_LIFESPAN_S, [0, 0, -5]);
  assert.equal(magic.missileCount(), 0);
  assert.deepEqual(world.freed.map((b) => [b.archive, b.record]), [[FIRE_ARCHIVE, 0], [FIRE_ARCHIVE, 1]]);
});

test('F033: a wall COLLISION flashes too - at the raycast impact point, not the missile centre', async () => {
  const { magic, world } = rig({ raycast: () => 0.4 });
  magic.setReadied(spellOf(2));
  magic.castInput([0, 0.9, 0], [0, 0, 1]);
  magic.update(0.05, [0, 0, 0]);
  await flush();
  assert.deepEqual(world.made.map((b) => b.record), [1], 'the wall was hit before the flight batch published');
  assert.equal(magic.missileCount(), 1, 'held for the flash');
  magic.update(POST_IMPACT_LIFESPAN_S + 0.01, [0, 0, 0]);
  assert.equal(magic.missileCount(), 0);
});

test('F033: the LIFESPAN EXPIRY (:294-295) destroys on the spot - no flash, no hold', async () => {
  const { magic, world } = rig();
  magic.setReadied(spellOf(2));
  magic.castInput([0, 0.9, 0], [0, 1, 0]);   // straight up, hits nothing
  magic.update(0.01, [0, 0, 0]);
  await flush();
  assert.deepEqual(world.made.map((b) => b.record), [0]);

  const steps = Math.ceil(MISSILE_LIFESPAN_S / 0.25) + 2;
  for (let i = 0; i < steps; i++) magic.update(0.25, [0, 0, 0]);
  await flush();
  assert.equal(magic.missileCount(), 0, 'gone the frame the lifespan ran out');
  assert.deepEqual(world.made.map((b) => b.record), [0], 'and NO record-1 flash was ever made');
  assert.deepEqual(world.freed.map((b) => b.record), [0]);
});

test('F033: a ByTouch payload lands on the player and flashes NOTHING', async () => {
  const { magic, world } = rig();
  // fireEnemyMissile is the engine's enemy/trap door; the gate is on
  // the payload's targetType, so a ByTouch bundle in flight still
  // applies and still dies - flashless.
  magic.fireEnemyMissile([0, 0.9, 3], [0, 0, -1], spellOf(1), 1, null);
  magic.update(0.01, [0, 0, 0]);
  await flush();
  assert.deepEqual(world.made.map((b) => b.record), [0]);
  for (let i = 0; i < 20 && world.hurtPlayer === 0; i++) magic.update(0.02, [0, 0, 0]);
  await flush();
  assert.ok(world.hurtPlayer > 0, 'the touch payload landed on the player');
  assert.equal(magic.missileCount(), 0, 'destroyed on the spot - no post-impact hold');
  assert.deepEqual(world.made.map((b) => b.record), [0], 'no record-1 flash');
});

test('F033b ONE SHOT ends the FLASH at its WRAP, not at the 0.6s hold (DaggerfallBillboard.cs:127-131)', async () => {
  // The flash billboard is a CHILD of the missile (DaggerfallMissile.cs
  // :601) and is armed OneShot, so AnimateBillboard destroys THAT object
  // the tick its animation wraps:
  //     if (CurrentFrame >= frameCount) { CurrentFrame = 0;
  //         if (OneShot) GameObject.Destroy(gameObject); }
  // The MISSILE object is not touched by that line - it lives out
  // PostImpactLifespanInSeconds (:313-320). Two ends, two moments. The
  // port used to keep the flash batch drawn on its frozen last frame
  // until the 0.6s timer fired.
  const { magic, world } = rig({ raycast: () => 0.4 });
  magic.setReadied(spellOf(2));
  magic.castInput([0, 0.9, 0], [0, 0, 1]);
  magic.update(0.05, [0, 0, 0]);   // into the wall on the first frame
  await flush();
  const flash = world.made[0];
  assert.deepEqual([flash.archive, flash.record], [FIRE_ARCHIVE, 1]);
  assert.deepEqual(world.freed, [], 'nothing torn down yet');

  // The coroutine's first pass runs before its first wait, so frame 0 is
  // already showing; IMPACT_FRAMES ticks of 1/IMPACT_FPS reach the wrap.
  const drawn = [];
  for (let i = 0; i < IMPACT_FRAMES; i++) {
    magic.update(1 / IMPACT_FPS, [0, 0, 0]);
    drawn.push(world.freed.includes(flash) ? null : flash.frame);
  }
  assert.deepEqual(drawn, [1, 2, 3, null], 'frames 1..3, then GONE at the wrap - no frozen last frame');
  assert.deepEqual(world.freed.map((b) => [b.archive, b.record]), [[FIRE_ARCHIVE, 1]]);

  // ...and the HOLD is not shortened by that: Destroy(gameObject) at
  // :131 is the billboard's own, and the missile keeps its 0.6s.
  const wrapAt = IMPACT_FRAMES / IMPACT_FPS;   // 4/15s - the flash's whole run
  assert.ok(wrapAt < POST_IMPACT_LIFESPAN_S, 'the flash ends INSIDE the hold, which is the whole point');
  assert.equal(magic.missileCount(), 1, 'the missile object survives its own flash');
  magic.update(POST_IMPACT_LIFESPAN_S - wrapAt - 0.01, [0, 0, 0]);
  assert.equal(magic.missileCount(), 1, 'still held a hundredth of a second short of 0.6');
  magic.update(0.02, [0, 0, 0]);
  assert.equal(magic.missileCount(), 0, 'destroyed at PostImpactLifespanInSeconds, unchanged');
  assert.deepEqual(world.freed.map((b) => [b.archive, b.record]), [[FIRE_ARCHIVE, 1]],
    'and the flash batch was freed exactly ONCE');
});

test('F033 THE FOUR HOSTS: the dungeon\'s own enemy/trap missile pool runs the SAME law, from the one export', () => {
  // exterior.js / world.js / worldModes.js hold no missile pool of
  // their own - they fly every spell missile through the engine, so
  // hostMagic.js is their whole wiring. dungeonContext.js is the one
  // host with a SECOND pool (enemy spells, trap casts, arrows) and it
  // must import the law rather than restate it.
  const dc = src('dungeonContext.js');
  assert.ok(/import \{ createPlayerMagic, POST_IMPACT_LIFESPAN_S, missileFlashesOnImpact, armImpactFlash, dropImpactFlashAtWrap \} from '\.\/hostMagic\.js';/.test(dc),
    'ONE DFU MEMBER ONE EXPORT: the dungeon imports the impact law - arming AND the one-shot self-destroy');
  assert.ok(!/0\.6.*[Pp]ostImpact|PostImpactLifespanInSeconds\s*=/.test(dc),
    'and holds no second 0.6 literal of its own');
  assert.ok(dc.includes('if (impactAt && missileFlashesOnImpact(m)) {'), 'the dungeon retire runs the :363 gate');
  assert.ok(dc.includes('armImpactFlash(m, { renderer, getTexture, uploadRecord, uploadRecordFrame, flatAnims, batches: billboardBatches });'),
    'and arms the record-1 one-shot on its own batch list');
  assert.ok(/if \(m\.impact > POST_IMPACT_LIFESPAN_S\) retireMissile\(m\);/.test(dc), 'the 0.6s hold, then destroy');
  assert.ok(dc.includes('dropImpactFlashAtWrap(m, { renderer, flatAnims, batches: billboardBatches });'),
    'and the ONE SHOT self-destroy (DaggerfallBillboard.cs:127-131) on its own batch list');
  assert.ok(dc.includes('retireMissile(m, impact);'), 'the wall COLLISION passes the impact point');
  assert.ok(dc.includes('retireMissile(m, m.pos);'), 'and so does the enemy missile reaching the player');
  assert.ok(/if \(m\.age > MISSILE_LIFESPAN_S\) \{ retireMissile\(m\); continue; \}/.test(dc),
    'while the lifespan expiry stays flashless');

  for (const f of ['exterior.js', 'world.js', 'worldModes.js']) {
    assert.ok(!src(f).includes('retireMissile'), `${f}: no second missile pool - N/A, it flies through the engine`);
  }
});
