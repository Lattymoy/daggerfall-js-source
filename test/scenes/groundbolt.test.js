// GROUND-BOLT (FIELD BUGS 2026-10-23c; the owner: "spells cast at the ground outdoors don't collide with it at all and
// sail straight through"). The world and fixed-city hosts handed the cast engine a collider proxy carrying `raycast`
// alone - the MESH ray - and outdoors the ground is not a mesh (player/collider.js surfaceHit's note), so a missile met
// the buildings and never the terrain. The hosts hand `liveCollider` now (the live collider whole: its ground with its
// ray), and the flight asks `flightStop` (the mesh ray, cover, and the terrain marched - player/groundRay.js). Driven
// here through a REAL Collider whose ground is a heightAt sampler, as the streamed world's open ground is to the engine.
// AUDIT GROUND-BOLT's pins follow the slice's: what the ground reached once the engine could see it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlayerMagic, liveCollider, flightStop, impactGround, struckSurface, burstClear, GROUND_TOUCH_M } from '../../src/scenes/hostMagic.js';
import { Collider } from '../../src/player/collider.js';
import { groundHit } from '../../src/player/groundRay.js';
import { createCoverIndex, coverProxy } from '../../src/ai/cover.js';
import { EnemyAI } from '../../src/characters/enemy/enemyMotor.js';
import { RESURRECT_TYPE, RESURRECT_SUBTYPE } from '../../src/systems/resurrect.js';
import { MISSILE_SPEED, MISSILE_COLLIDER_RADIUS } from '../../src/systems/spellcast.js';
import { SpellImpactFx } from '../../src/render/spellImpactFx.js';

const src = (p) => readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');

const damageEffect = (mag = 20) => ({
  type: 4, subType: 0,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
});
const healEffect = () => ({ ...damageEffect(20), type: 10, subType: 8 });   // Heal Health (hostmagic.test.js's)
const spellOf = (rangeType, effects = [damageEffect()]) => ({ name: 'Test Spell', index: 90, element: 0, rangeType, effects });
const mkPlayer = () => ({
  isPlayer: true, level: 10, health: 500, maxHealth: 500, maxMagicka: 500, magicka: 500,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [],
});
const mkFoe = (x, z, y = 0) => ({
  dead: false, ai: { feet: [x, y, z] },
  entity: { level: 1, health: 400, maxHealth: 400, magicka: 0, maxMagicka: 0, skills: new Array(40).fill(30), stats: { willpower: 30 }, career: {}, activeEffects: [] },
});
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** A quad into `c` under `key` - a wall, a building's face. */
const quad = (c, key, a, b, cc, d) => c.addMesh(key, new Float32Array([...a, ...b, ...cc, ...d]), new Uint32Array([0, 1, 2, 0, 2, 3]), I);

/** The engine through the hosts' own door, liveCollider, over `col` (a Collider, or a thunk answering one). `extra`
 *  rides into the engine's deps; `made` keeps every billboard batch the engine builds (the sparks are batches). */
function rig(col, foes = [], extra = {}) {
  const player = mkPlayer();
  const world = { foeHurt: new Map(), hurt: 0, said: [], made: [] };
  const sinks = { heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: (archive, record) => { const b = { origin: null, archive, record }; world.made.push(b); return b; }, destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => ({ width: 16, height: 16 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 }),
    uploadRecord: () => {}, uploadRecordFrame: () => {},
    collider: liveCollider(typeof col === 'function' ? col : () => col),
    playerEntity: player,
    playerSinks: { ...sinks, hurt: (n) => { world.hurt += n; player.health -= n; }, say() {} },
    say: (l) => world.said.push(l), surfacePlayer() {},
    foes: () => foes,
    foeSinks: (f) => ({ ...sinks, hurt: (n) => { world.foeHurt.set(f, (world.foeHurt.get(f) ?? 0) + n); f.entity.health -= n; } }),
    absorbCtx: () => ({ inside: false, day: true }),
    rolls: () => 0.99,
    ...extra,
  });
  return { magic, world, player };
}
const fly = (magic, feet, frames, dt = 0.05) => { let i = 0; for (; i < frames && magic.missileCount() > 0; i++) magic.update(dt, feet); return i; };
const FLAT = () => 0;
const ridge = (x, z) => (z > 8 && z < 12 ? 6 : 0);   // a 6 m ridge across the way, z 8 to 12
const unit = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };

test('GROUND-BOLT: a Fireball cast at the open ground bursts ON it - the blast reaches a foe beside the crater', () => {
  // From the eye at 1.6 m, 0.6 down for 0.8 along: the ground is met 2.67 m out, at z = 2.13. The foe stands 3.4 m
  // past it, inside the 4 m blast and nowhere near the line (under the ground there, at y = -2.5).
  const foe = mkFoe(0, 5.5);
  const { magic, world } = rig(new Collider(FLAT), [foe]);
  magic.setReadied(spellOf(4));
  assert.equal(magic.castInput([0, 1.6, 0], [0, -0.6, 0.8]), true, 'the cast left');
  assert.equal(magic.missileCount(), 1);
  fly(magic, [0, 0, -20], 6);
  assert.equal(magic.missileCount(), 0, 'it met the ground within its first frames - not its lifespan');
  assert.ok(world.foeHurt.get(foe) > 0, 'the burst was where it struck the ground, and reached the foe');
});

test('GROUND-BOLT: a bolt flown LEVEL into a rising hillside stops on it - the march meets a rise, not only a fall', () => {
  // collider.surfaceHit meets the ground only on the way DOWN; a level shot into a slope is the march's.
  const hill = (x, z) => (z > 3 ? z - 3 : 0);   // a 45-degree rise from z = 3: met at z = 4.6
  const { magic } = rig(new Collider(hill));
  magic.setReadied(spellOf(2));
  assert.equal(magic.castInput([0, 1.6, 0], [0, 0, 1]), true);
  const frames = Math.ceil(4.6 / (MISSILE_SPEED * 0.05)) + 2;   // the step that touches it, and the stop
  fly(magic, [0, 0, -20], frames);
  assert.equal(magic.missileCount(), 0, `it stopped on the hillside within ${frames} frames`);
});

test('GROUND-BOLT: a bolt with nothing before it still flies - the ground is met where it is, not everywhere', () => {
  const { magic } = rig(new Collider(FLAT));
  magic.setReadied(spellOf(2));
  assert.equal(magic.castInput([0, 1.6, 0], [0, 0.6, 0.8]), true, 'up and away');
  fly(magic, [0, 0, -20], 6);
  assert.equal(magic.missileCount(), 1, 'still in the air');
});

test('GROUND-BOLT: a FOE\'s Fireball at my feet bursts on the ground beside me - the enemy arm flies the same ray', () => {
  // Thrown from 8 m off, down at the ground 2 m short of me: before, it passed under me and on.
  const caster = mkFoe(0, 8);
  const { magic, world } = rig(new Collider(FLAT));
  const from = [0, 1.6, 8];
  magic.fireEnemyMissile(from, unit([0, -1.6, -6]), spellOf(4), 1, caster);
  fly(magic, [0, 0, 0], 10);
  assert.equal(magic.missileCount(), 0, 'it met the ground');
  assert.ok(world.hurt > 0, 'its blast caught me beside the crater');
});

test('AUDIT GROUND-BOLT B1: a bolt aimed at a foe\'s FEET strikes the foe, at 20 and 30 frames a second - the ground is met by touch, the bodies tested first (mutants: the ground at the whole reach)', () => {
  // The ground at the step's whole reach (step + 0.45) met the grass just behind a foe's feet a step early and burst
  // there: 14 of 40 struck at 20 frames a second. Forty foes from 3 to 12.75 m, every one aimed at the feet.
  for (const dt of [1 / 30, 0.05]) {
    let struck = 0;
    for (let i = 0; i < 40; i++) {
      const foe = mkFoe(0, 3 + i * 0.25);
      const { magic, world } = rig(new Collider(FLAT), [foe]);
      magic.setReadied(spellOf(2));
      magic.castInput([0, 1.6, 0], unit([0, -1.6, foe.ai.feet[2]]));
      fly(magic, [0, 0, -20], 40, dt);
      if (world.foeHurt.get(foe) > 0) struck++;
    }
    assert.equal(struck, 40, `at ${Math.round(1 / dt)} frames a second every foe aimed at the feet is struck (${struck} of 40)`);
  }
  // ...and the enemy arm: a flyer 6 m up, loosing at my middle from 4 to 11.6 m off. At 10 frames a second a 2.5 m step
  // passes clean through a body now and then with no ground at all - the ground must cost it nothing more
  const flyer = (ground, dt) => {
    let hit = 0;
    for (let i = 0; i < 20; i++) {
      const { magic, world } = rig(new Collider(ground));
      const from = [0, 6, 4 + i * 0.4];
      magic.fireEnemyMissile(from, unit([-from[0], 0.9 - from[1], -from[2]]), spellOf(2), 1, mkFoe(0, from[2], 5));
      fly(magic, [0, 0, 0], 40, dt);
      if (world.hurt > 0) hit++;
    }
    return hit;
  };
  assert.equal(flyer(FLAT, 0.05), 20, 'a foe\'s bolt at my middle strikes me, not the grass behind my feet');
  assert.equal(flyer(FLAT, 0.1), flyer(() => -Infinity, 0.1), 'at 10 frames a second the ground costs not one hit more than no ground at all');
});

test('AUDIT GROUND-BOLT B1: flightStop - a wall at the step\'s whole reach, the ground by touch (its stop the next step, never a step early)', () => {
  const col = liveCollider(() => new Collider(FLAT));
  const R = MISSILE_COLLIDER_RADIUS, stepLen = 1.25, reach = stepLen + R, down = [0, -1, 0];
  // the ground 1.0 below: in reach, not touching - fly to the touch, stop nowhere this step
  const far = flightStop(col, [0, 1.0, 0], down, reach, stepLen);
  assert.equal(far.stop, Infinity);
  assert.ok(Math.abs(far.advance - (1.0 - R) / stepLen) < 1e-3, `to the touch (${far.advance})`);
  // at the touch (the march's grain past it): stopped, on the ground
  const at = flightStop(col, [0, R + GROUND_TOUCH_M / 2, 0], down, reach, stepLen);
  assert.ok(Math.abs(at.stop - (R + GROUND_TOUCH_M / 2)) < 1e-3, `stopped on the ground (${at.stop})`);
  // the ground out of reach: the whole step
  assert.deepEqual(flightStop(col, [0, 5, 0], down, reach, stepLen), { stop: Infinity, advance: 1 });
  // a wall within reach and nearer than the ground: stopped there, at the whole reach (DaggerfallMissile's cast)
  const walled = new Collider(FLAT);
  quad(walled, 'wall', [-5, 0, 1], [5, 0, 1], [5, 4, 1], [-5, 4, 1]);
  assert.ok(Math.abs(flightStop(liveCollider(() => walled), [0, 1.6, 0], [0, 0, 1], reach, stepLen).stop - 1) < 1e-6, 'the wall 1 m ahead');
});

test('AUDIT GROUND-BOLT A1/B2: a burst on the terrain throws its chunks onto the ground - not 1.2 m into it (mutants: the sampler unread)', async () => {
  // The flight's march stops at the first point not above the ground, a hair under it, where surfaceHit's way down
  // never starts: it met nothing and the chunks fell 1.2 m into the hill.
  const hill = (x, z) => 0.3 * Math.sin(x * 0.7) + 0.2 * Math.cos(z * 0.5);
  for (const g of [FLAT, hill]) {
    const col = liveCollider(() => new Collider(g, g));
    const o = [0.4, 1.6, 0], d = unit([0, -0.6, 0.8]), t = groundHit(o, d, 10, col);
    const impact = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
    const under = impactGround(col, impact);
    assert.ok(Math.abs(under - (g(impact[0], impact[2]) - 0.05)) < 1e-3, `the chunks' floor is the ground's (${under.toFixed(3)} against ${g(impact[0], impact[2]).toFixed(3)})`);
  }
  // ...and through the engine's own impact: every chunk comes to rest on the ground, none under it
  const { magic, world } = rig(new Collider(FLAT, FLAT));
  magic.setReadied(spellOf(4));
  magic.castInput([0, 1.6, 0], [0, -0.6, 0.8]);
  const low = new Map();
  for (let i = 0; i < 90; i++) {
    magic.update(1 / 60, [0, 0, -20]);
    await new Promise((r) => setTimeout(r, 0));
    for (const b of world.made.slice(1)) if (b.record === 0 && b.origin) low.set(b, Math.min(low.get(b) ?? Infinity, b.origin[1]));
  }
  assert.ok(low.size >= 3, `the chunks flew (${low.size})`);
  for (const y of low.values()) assert.ok(y > -0.1, `a chunk rests on the ground, not in it (${y.toFixed(3)} below the impact)`);
});

test('AUDIT GROUND-BOLT B2: a landing handed no floor finds its own - a heal about me is drawn, its floor the ground under it (mutants: the floor-finder renamed away)', () => {
  // landFx's own floor (a self heal, a touch, a peer's landing) asks the same finder as an impact's chunks; a landing
  // that threw there threw inside landFx's try, and nothing was drawn
  const seen = [], burst = SpellImpactFx.prototype.burst;
  SpellImpactFx.prototype.burst = function (kind, at, o = {}) { seen.push({ kind, ground: o.ground }); return burst.call(this, kind, at, o); };
  try {
    const { magic } = rig(new Collider(FLAT));
    magic.setReadied(spellOf(0, [healEffect()]));
    magic.castInput([0, 1.6, 0], [0, 0, 1]);
  } finally { SpellImpactFx.prototype.burst = burst; }
  assert.equal(seen.length, 1, 'the heal rises about me');
  assert.equal(seen[0].kind, 'heal');
  assert.ok(Math.abs(seen[0].ground - 0.05) < 1e-6, `over the ground under me (${seen[0].ground})`);
});

test('AUDIT GROUND-BOLT B3: what a bolt struck on a hillside is the hill - its slope, facing the shot, where it lies (mutants: the terrain unread)', () => {
  const hill = (x, z) => (z > 3 ? z - 3 : 0);   // 45 degrees
  const col = liveCollider(() => new Collider(hill));
  const s = struckSurface(col, [0, 1.6, 4.6], [0, 0, 1]);   // level, into the rise
  assert.ok(s, 'a plane, where surfaceHit met none (level, not down)');
  const k = Math.SQRT1_2;
  assert.ok(Math.abs(s.normal[1] - k) < 0.02 && Math.abs(s.normal[2] + k) < 0.02, `the slope's normal, facing the shot (${s.normal.map((v) => v.toFixed(3))})`);
  assert.ok(Math.abs(s.surfaceAt[2] - 4.6) < 0.01 && Math.abs(s.surfaceAt[1] - 1.6) < 0.01, 'where it lies');
  // flat ground, a shot down at it: straight up
  const flat = struckSurface(liveCollider(() => new Collider(FLAT)), [0, 0, 2], unit([0, -0.6, 0.8]));
  assert.ok(Math.abs(flat.normal[1] - 1) < 1e-6 && Math.abs(flat.surfaceAt[1]) < 1e-3, 'the floor');
  // a wall nearer than the ground: the wall's
  const walled = new Collider(FLAT);
  quad(walled, 'wall', [-5, 0, 2], [5, 0, 2], [5, 4, 2], [-5, 4, 2]);
  const w = struckSurface(liveCollider(() => walled), [0, 1, 2], [0, 0, 1]);
  assert.ok(Math.abs(Math.abs(w.normal[2]) - 1) < 1e-6 && w.normal[2] < 0, 'the wall, facing the shot');
  // ...and the engine's own impact hands its burst that plane (IMPACTFX's SpellImpactFx.burst, the shockwave's `normal`)
  const seen = [], burst = SpellImpactFx.prototype.burst;
  SpellImpactFx.prototype.burst = function (kind, at2, o = {}) { seen.push(o.normal ?? null); return burst.call(this, kind, at2, o); };
  try {
    const { magic } = rig(new Collider(hill, hill));
    magic.setReadied(spellOf(4));
    magic.castInput([0, 1.6, 0], [0, 0, 1]);
    fly(magic, [0, 0, -20], 60, 1 / 60);
  } finally { SpellImpactFx.prototype.burst = burst; }
  assert.equal(seen.length, 1, 'one burst');
  assert.ok(seen[0] && Math.abs(seen[0][1] - k) < 0.02 && Math.abs(seen[0][2] + k) < 0.02, `the burst lies on the slope (${JSON.stringify(seen[0])})`);
});

test('GROUND-BOLT (AUDIT D1, D2, D5): liveCollider is the live collider WHOLE - its mesh ray, its drawn ground and its cover, asked at each call through the door the player walks', () => {
  // D1: a wall - the street's buildings stop a bolt before the ground behind them, and the ray follows the door
  const street = new Collider(FLAT), room = new Collider(() => -Infinity);
  quad(street, 'house', [-5, 0, 3], [5, 0, 3], [5, 4, 3], [-5, 4, 3]);
  quad(room, 'cupboard', [-5, 0, 2], [5, 0, 2], [5, 4, 2], [-5, 4, 2]);
  let here = street;
  const c = liveCollider(() => here);
  assert.ok(Math.abs(c.raycast([0, 1.6, 0], [0, 0, 1], 10) - 3) < 1e-6, 'the street\'s house');
  assert.ok(Math.abs(c.raycastHit([0, 1.6, 0], [0, 0, 1], 10).dist - 3) < 1e-6, 'and what it struck');
  here = room;
  assert.ok(Math.abs(c.raycast([0, 1.6, 0], [0, 0, 1], 10) - 2) < 1e-6, 'indoors: the room\'s cupboard');
  assert.equal(groundHit([0, 1.6, 0], [0, -1, 0], 10, c), Infinity, 'and no ground but its meshes');
  // ...and the engine flies the street's: a bolt at the house front stops on it, the ground beyond unmet
  here = street;
  const { magic } = rig(() => here);
  magic.setReadied(spellOf(2));
  magic.castInput([0, 1.6, 0], [0, 0, 1]);
  assert.equal(fly(magic, [0, 0, -20], 10), 3, 'on the house front, the third step');
  // D2: the DRAWN ground (surfaceAt), where the host draws one - world.js's `new Collider(heightAt, surfaceAt)`
  const drawn = liveCollider(() => new Collider(() => 0, () => 0.5));
  assert.equal(drawn.surfaceAt(0, 0), 0.5);
  assert.equal(drawn.heightAt(0, 0), 0);
  assert.ok(Math.abs(groundHit([0, 1.6, 0], [0, -1, 0], 3, drawn) - 1.1) < 1e-3, 'the march meets the drawn ground');
  assert.equal(liveCollider(() => new Collider(FLAT)).surfaceAt, null, 'none drawn: the sampler answers (groundAt\'s rule)');
  // D5: TACT1's cover - "trees, crates and decor flats ... stop arrows and spells" - on the street and in a room
  const shelf = new Collider(() => -Infinity);
  shelf.cover = createCoverIndex({ enabled: () => true });
  shelf.cover.add('flats', [coverProxy([0, 0, 4], { w: 1.2, h: 2 })]);
  const covered = rig(shelf);
  covered.magic.setReadied(spellOf(2));
  covered.magic.castInput([0, 1.2, 0], [0, 0, 1]);
  assert.ok(fly(covered.magic, [0, 0, -20], 20) < 6, 'a bolt stops on the flat in its way');
  assert.equal(covered.magic.missileCount(), 0);
});

test('AUDIT GROUND-BOLT C1: a foe behind a ridge finds no clear shot - its bolt would burst on the ground between (mutants: the ground unread)', () => {
  const shot = (ground) => {
    const self = { collider: new Collider(ground), feet: [0, 0, 0], centreOffset: 0.9, _centre: EnemyAI.prototype._centre, predictNextTargetPos: () => [0, 0.9, 20] };
    return EnemyAI.prototype.hasClearPathToShootProjectile.call(self, MISSILE_SPEED, 0.5, MISSILE_COLLIDER_RADIUS);
  };
  assert.equal(shot(ridge), false, 'the ridge between');
  assert.equal(shot(FLAT), true, 'open ground: clear');
});

test('AUDIT GROUND-BOLT C2: a spell given to a party mate or a companion across a hill is not given - the gift reaches as far as the missile would', () => {
  const given = [];
  const gift = (ground, distance, dir = [0, 0, 1]) => {
    given.length = 0;
    const { magic } = rig(new Collider(ground), [], {
      allyTarget: () => ({ id: 'mate', name: 'Mate', distance }),
      castAtAlly: (id) => { given.push(id); return true; },
    });
    magic.setReadied(spellOf(2, [healEffect()]));
    magic.castInput([0, 1.6, 0], dir);
    return [...given];
  };
  assert.deepEqual(gift(ridge, 20), [], 'behind the ridge');
  assert.deepEqual(gift(FLAT, 20), ['mate'], 'on open ground');
  assert.deepEqual(gift(FLAT, 6, unit([0, -1.7, 6])), ['mate'], 'aimed at her boots, a hand into the grass - her body\'s breadth of grace');
  // ...and my companion (COMPANION-KIT): the same reach, his own pick
  const healed = [];
  const toCompanion = (ground, z, dir = [0, 0, 1]) => {
    healed.length = 0;
    const rec = { entity: { name: 'Crewman', level: 1, health: 10, maxHealth: 40, magicka: 0, maxMagicka: 0, skills: new Array(40).fill(30), stats: {}, career: {}, activeEffects: [] }, ai: { feet: [0, 0, z], height: 1.8 } };
    const { magic } = rig(new Collider(ground), [], {
      companionBodies: () => [rec],
      foeSinks: () => ({ heal: () => healed.push('Crewman'), hurt() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    });
    magic.setReadied(spellOf(2, [healEffect()]));
    magic.castInput([0, 1.6, 0], dir);
    return healed.length > 0;
  };
  assert.equal(toCompanion(ridge, 20), false, 'my companion behind the ridge');
  assert.equal(toCompanion(FLAT, 20), true, 'my companion on open ground');
  assert.equal(toCompanion(FLAT, 6, unit([0, -1.7, 6])), true, 'aimed at his boots, a hand into the grass');
});

test('AUDIT GROUND-BOLT C3: a Resurrect aimed at the open ground beside a fallen mate finds the body - the aim meets the ground outdoors', () => {
  const body = { id: 'mate', name: 'Mate', feet: [2.1, 0, 3] };   // lying 2.1 m beside where the crosshair meets the grass
  const raised = [];
  const { magic, world } = rig(new Collider(FLAT), [], { fallenTarget: () => [body], raiseFallen: (f) => { raised.push(f.id); return true; } });
  magic.setReadied({ name: 'Resurrect', index: 91, element: 4, rangeType: 1, effects: [{ type: RESURRECT_TYPE, subType: RESURRECT_SUBTYPE, chanceBase: 100 }] });
  magic.castInput([0, 1.6, 0], unit([0, -1.6, 3]));
  assert.deepEqual(raised, ['mate'], `the body beside the aim is raised (${JSON.stringify(world.said)})`);
});

test('AUDIT GROUND-BOLT C4: a burst does not reach over the crest of a hill (burstClear)', () => {
  const crest = (x) => Math.max(0, 2.5 * (1 - Math.abs(x) / 3.2));
  const col = liveCollider(() => new Collider((x) => crest(x)));
  assert.equal(burstClear(col, [-2.9, crest(-2.9), 0], [2.9, crest(2.9), 0]), false, 'over the crest');
  assert.equal(burstClear(liveCollider(() => new Collider(FLAT)), [-2.9, 0, 0], [2.9, 0, 0]), true, 'on the level');
});

test('GROUND-BOLT: both exterior hosts hand the engine liveCollider, and both flights take flightStop - never a bare raycast proxy, never two laws', () => {
  for (const f of ['scenes/world.js', 'scenes/exterior.js']) {
    const s = src(f);
    assert.ok(s.includes("collider: liveCollider(() => ((modes?.mode === 'interior' && modes?.interiorCollider) ? modes?.interiorCollider : collider)),"), `${f}: the engine's collider carries the ground`);
    assert.ok(!s.includes('collider: { raycast: (o, d, m) => ((modes?.mode'), `${f}: the mesh-only proxy is gone`);
  }
  for (const f of ['scenes/hostMagic.js', 'scenes/dungeonContext.js']) {
    assert.equal((src(f).match(/const _cs = flightStop\(collider, m\.pos, _unit, reach, step \* _len\);/g) ?? []).length, 1, `${f}: the one flight law (AUDIT C6)`);
  }
});
