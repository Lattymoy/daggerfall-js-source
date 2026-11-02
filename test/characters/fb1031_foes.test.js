// AUDIT FB1031 - the FOES lane (TRUNK-FOES, BAND-NEAR). TRUNK-FOES' goal, which every fix keeps: no one-way hiding. A
// foe (or the player) cannot stand inside a tree, rock or flat and be shielded while it sees and shoots out; a body
// pressed BEHIND cover is still shielded by its solid part; a shot meets a body before the cover that body stands in
// front of. F1 a proxy holding a ray's end is met at its MIDDLE (ai/cover.js COVER_MIDDLE_GRACE); F2/F3 each flight
// lists only what that missile may strike; F4 a foe walking at a trunk's middle goes round it; F6 the clamp's and the
// hold's spans; B1 a band met with the view down stands outside the view. bible/03-World/Player-Arc.md TRUNK-FOES,
// bible/06-Systems/Travel-View.md BAND-NEAR. New exports are read off their modules, so each pin fails on its own.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { keepFoesOffBodies } from '../../src/characters/foeSpacing.js';
import { canSeeTarget } from '../../src/characters/enemy/enemyMotor.js';
import { Collider } from '../../src/player/collider.js';
import { CAPSULE_RADIUS } from '../../src/player/motor.js';
import * as coverLaw from '../../src/ai/cover.js';
import { flatBody, jungleBody } from '../../src/world/propBodies.js';
import { jungleCover } from '../../src/world/jungle/jungleModels.js';
import { ArrowFlight } from '../../src/combat/arrowFlight.js';
import { createPlayerMagic, liveCollider } from '../../src/scenes/hostMagic.js';
import * as spellcast from '../../src/systems/spellcast.js';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import * as bands from '../../src/systems/travel/travelBands.js';
import { campAnchorSpot, PACK_SPACING, PACK_ALERT_RADIUS } from '../../src/systems/campEncounters.js';
import { hostText } from '../hostText.mjs';

const { createCoverIndex, coverProxy, coverProxies, coverDistance, rayCylinder, isCoverFlat, COVER_HEIGHT_FRAC } = coverLaw;
const { struckPoints } = spellcast;

/** open ground with a cover index holding `items` */
function field(items) {
  const c = new Collider(() => 0);
  c.cover = createCoverIndex({ enabled: () => true });
  c.cover.add('pixel', items);
  return c;
}
const foe = (x, z, over = {}) => ({ ai: { feet: [x, 0, z], height: 1.8 }, dead: false, ...over });
const unit = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
/** 504.19, the temperate rock (ARENA2: drawn 3.68 x 4.13 m, its measured foot 0.68 m) - its body and its one cover proxy */
const rockAt = (c) => [{ c, r: 0.68, h: 4.13 * COVER_HEIGHT_FRAC, lift: 0, body: true, nature: true, _mark: 0 }, coverProxy(c, { w: 3.68, h: 4.13 })];
/** a young banyan (Bantha-Jungle's understorey, x0.36): a 0.52 m trunk to 1.08 m, its crown 2.2 m out from there */
const youngAt = (c) => [jungleBody(c, 0, 0.36), ...jungleCover(c, 0, 0.36)];

/** the player's shaft along `dir` from `from`; whether it struck `target` (among `others`) and where it ended */
function myShaft(col, target, { from = [0, 1.4, 0], dir = [0, 0, 1], others = [], me = null } = {}) {
  const f = new ArrowFlight({ getGpuMesh: () => null, collider: col });
  const roll = Math.random;
  Math.random = () => 0;   // BOW-BLOOM's spread at its centre
  try { f.fire(from, dir, { fromPlayer: true }); } finally { Math.random = roll; }
  const struck = [];
  const foeTargets = [target, ...others].filter(Boolean).map((t) => ({ feet: t.ai.feet, ref: t }));
  for (let i = 0; i < 120 && !f.arrows[0].dead; i++) f.update(1 / 60, { playerFeet: me, playerHeight: 1.8, foeTargets, onPlayerArrowHitFoe: (m, t) => { struck.push(t); } });
  return { struck: target ? struck.includes(target) : struck.length > 0, z: f.arrows[0].pos[2] };
}
/** a foe archer's shaft along `dir` from `from` at me standing at `me`; whether it hit me */
function foeShaft(col, me, { from = [0, 1.1, 0.5], dir = [0, 0, 1], archer = foe(0, 0) } = {}) {
  const a = new ArrowFlight({ getGpuMesh: () => null, collider: col });
  a.fire(from, dir, { enemy: true, shooterFoe: archer, aimFoe: null });
  let hit = false;
  for (let i = 0; i < 120 && !a.arrows[0].dead; i++) a.update(1 / 60, { playerFeet: me, playerHeight: 1.8, onPlayerHit: () => { hit = true; }, foeTargets: [{ feet: archer.ai.feet, ref: archer }], onFoeHit: () => {} });
  return hit;
}

// the cast engine (test/scenes/groundbolt.test.js's rig)
const damageEffect = (mag = 20) => ({ type: 4, subType: 0, magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 });
const healEffect = () => ({ ...damageEffect(20), type: 10, subType: 8 });
const spellOf = (rangeType, effects = [damageEffect()]) => ({ name: 'Test Spell', index: 90, element: 0, rangeType, effects });
const mkFoe = (x, z, over = {}) => ({ dead: false, ai: { feet: [x, 0, z] }, entity: { level: 1, health: 400, maxHealth: 400, magicka: 0, maxMagicka: 0, skills: new Array(40).fill(30), stats: { willpower: 30 }, career: {}, activeEffects: [] }, ...over });
function rig(col, foes, extra = {}) {
  const player = { isPlayer: true, level: 10, health: 500, maxHealth: 500, maxMagicka: 500, magicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  const world = { foeHurt: new Map(), hurt: 0, given: [] };
  const sinks = { heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => ({ width: 16, height: 16 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 }),
    uploadRecord: () => {}, uploadRecordFrame: () => {}, collider: liveCollider(() => col), playerEntity: player,
    playerSinks: { ...sinks, hurt: (n) => { world.hurt += n; player.health -= n; }, say() {} }, say: () => {}, surfacePlayer() {},
    foes: () => foes, foeSinks: (f) => ({ ...sinks, hurt: (n) => { world.foeHurt.set(f, (world.foeHurt.get(f) ?? 0) + n); f.entity.health -= n; } }),
    absorbCtx: () => ({ inside: false, day: true }), rolls: () => 0.99, ...extra(world),
  });
  return { magic, world };
}
const fly = (magic, feet) => { for (let i = 0; i < 120 && magic.missileCount() > 0; i++) magic.update(1 / 60, feet); };

// ─── F1: THE MIDDLE ─────────────────────────────────────────────────────

test('AUDIT FB1031 F1 the law: a ray with an end in a proxy meets it at its middle - one pressed behind it is hidden and sees nothing, one in front seen and seeing, one at it (a body\'s radius) in front for both; a missile likewise; never a one-way pair (mutants: the middle unread for an end, for a hold, for a start; the grace one-sided)', () => {
  const rock = { c: [0, 0, 10], r: 1.29, h: 3.7, lift: 0 };
  const hidden = (a, b) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d);
    return rayCylinder(a, d.map((v) => v / l), rock, l, l) < l - 1e-3;
  };
  const me = [0, 1.6, 0], behind = [0, 1.6, 10 + 0.68 + CAPSULE_RADIUS], before = [0, 1.6, 10 - 0.68 - CAPSULE_RADIUS], beside = [0.68 + CAPSULE_RADIUS, 1.6, 10];
  assert.equal(hidden(me, behind), true, 'pressed behind its middle (the clamp\'s edge): hidden');
  assert.equal(hidden(behind, me), true, '...and it sees nothing out of it');
  assert.equal(hidden(me, before), false, 'pressed in front: seen');
  assert.equal(hidden(before, me), false, '...and it sees');
  assert.equal(hidden(me, beside), false, 'beside its middle: at it, seen');
  assert.equal(hidden(beside, me), false, '...and it sees');
  assert.ok(Math.abs(rayCylinder([0, 1.4, 11.03], [0, 0, -1], rock, 20) - 1.03) < 1e-9, 'a shot from in it out through its middle meets the middle');
  assert.equal(rayCylinder([0, 1.4, 11.03], [0, 0, 1], rock, 20), Infinity, '...out the way it faces, free');
  assert.equal(rayCylinder([0, 1.4, 10.3], [0, 0, -1], rock, 20), Infinity, '...from within a body\'s radius of the middle, free');
  assert.equal(rayCylinder([0, 1.4, 11.03], [0, 0, -1], rock, 0.5), Infinity, '...a middle past the reach, none');
  const crown = { c: [0, 0, 10], r: 2, h: 4, lift: 2 };
  assert.equal(rayCylinder([0, 2.5, 11], unit([0, -1, -0.5]), crown, 20), Infinity, '...out of a crown\'s floor short of its middle, free');
  assert.equal(coverLaw.COVER_MIDDLE_GRACE, CAPSULE_RADIUS, 'the grace is a body\'s own radius');
  // a missile's hold (a struck body's point): behind the middle the rock is a wall at its side; in front, none
  const col = field([coverProxy([0, 0, 10], { w: 3.68, h: 4.13 })]);
  assert.ok(Math.abs(coverDistance(col, [0, 1.4, 0], [0, 0, 1], 20, false, [0, 1.4, 11.03]) - (10 - 0.35 * 3.68)) < 1e-9, 'a body struck behind the middle opens nothing');
  assert.equal(coverDistance(col, [0, 1.4, 0], [0, 0, 1], 20, false, [0, 1.4, 8.97]), Infinity, 'one in front opens it');
  // no pair is one-way: for any two points in and round it, hidden one way exactly when the other - AUDIT FB1031 II K2:
  // over the rock and the same lifted 1.4 m (a crown), ends sampled under its floor and over its top as well as in it
  // (the rock's every sampled end lay in its span, so a cap never mattered: the lifted crown's 22 one-way pairs passed)
  let seed = 7, pairs = 0, both = 0;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (const [cyl, lo, hi] of [[rock, 0.5, 3.5], [{ ...rock, lift: 1.4 }, 0.3, 5.8]]) {
    const hid = (a, b) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d); return rayCylinder(a, d.map((v) => v / l), cyl, l, l) < l - 1e-3; };
    const at = () => [(rnd() - 0.5) * 5, lo + rnd() * (hi - lo), 10 + (rnd() - 0.5) * 5];
    for (let i = 0; i < 4000; i++) {
      const a = at(), b = rnd() < 0.5 ? at() : [(rnd() - 0.5) * 30, lo + rnd() * (hi - lo), rnd() * 30];
      if (Math.hypot(a[0] - b[0], a[2] - b[2]) < 0.05) continue;
      const ab = hid(a, b);
      assert.equal(hid(b, a), ab, `one-way between ${a.map((v) => v.toFixed(2))} and ${b.map((v) => v.toFixed(2))} (lift ${cyl.lift})`);
      pairs++; if (ab) both++;
    }
  }
  assert.ok(pairs > 7000 && both > 600, `the pairs reach both answers (${both} hidden of ${pairs})`);
});

test('AUDIT FB1031 F1 executed: a foe the clamp pressed behind 504.19 or a young banyan\'s trunk is shielded from my shaft and sees nothing; me pressed behind the rock, a foe\'s shaft and bolt are stopped and mine out is lost on it; one pressed in front of either, or beside the trunk, is struck', () => {
  const rock = rockAt([0, 0, 20]);
  const pressed = (items, x, z) => { const f = foe(x, z); keepFoesOffBodies([f], field(items)); return f; };
  const behind = pressed(rock, 0, 20.1);
  assert.ok(Math.abs(behind.ai.feet[2] - (20 + 0.68 + CAPSULE_RADIUS)) < 1e-6, 'the clamp\'s edge - inside the 1.29 m cover');
  assert.equal(myShaft(field(rock), behind).struck, false, 'behind the rock: shielded');
  assert.equal(canSeeTarget(field(rock), behind.ai.feet, Math.PI, 1.8, [0, 0, 0]), false, '...and it does not see me');
  const before = pressed(rock, 0, 19.9);
  assert.equal(myShaft(field(rock), before).struck, true, 'pressed in front: struck');
  assert.equal(canSeeTarget(field(rock), before.ai.feet, Math.PI, 1.8, [0, 0, 0]), true);
  const me = [0, 0, 20 + 0.68 + CAPSULE_RADIUS];   // my own clamp's edge (player/bodyClamp.js)
  assert.equal(foeShaft(field(rock), me), false, 'a foe\'s shaft at me behind it: stopped');
  assert.equal(myShaft(field(rock), foe(0, 0), { from: [0, 1.6, me[2]], dir: [0, 0, -1], me }).struck, false, 'and mine out through it: lost on it - my own body opens nothing');
  const caster = mkFoe(0, 0), { magic, world } = rig(field(rock), [caster], () => ({}));
  magic.fireEnemyMissile([0, 1.2, 0.6], [0, 0, 1], spellOf(2), 1, caster);
  fly(magic, me);
  assert.equal(world.hurt, 0, 'a foe\'s bolt at me behind it: stopped');
  const young = youngAt([0, 0, 20]), trunk = young[0];
  const back = pressed(young, 0, 20.1);
  assert.equal(myShaft(field(young), back).struck, false, 'behind the young banyan\'s trunk, under its crown: shielded');
  assert.equal(myShaft(field(young), pressed(young, 0, 19.9)).struck, true, 'in front of it: struck');
  const aside = pressed(young, 0.1, 20);
  assert.ok(Math.abs(aside.ai.feet[0] - (trunk.r + CAPSULE_RADIUS)) < 1e-6, 'beside the trunk, at the clamp\'s edge');
  assert.equal(myShaft(field(young), aside, { dir: unit(aside.ai.feet.map((v, i) => (i === 1 ? 0 : v))) }).struck, true, 'beside it, in the crown at its middle: struck');
});

const A = process.env.ARENA2_PATH;
const HAVE = !!A && existsSync(`${A}/TEXTURE.504`);
test('AUDIT FB1031 F1 with ARENA2: every nature record of the twelve climate archives whose cover holds a foe the clamp pressed to its body - shielded behind it, struck in front', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { TextureFile } = await import('../../src/formats/textureFile.js');
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { billboardSize } = await import('../../src/world/rmbFlats.js');
  const { isTreeRecord } = await import('../../src/world/terrain/terrainNature.js');
  const pal = new DFPalette();
  pal.load(new Uint8Array(readFileSync(`${A}/ART_PAL.COL`)), 'ART_PAL.COL');
  let n = 0;
  for (let archive = 500; archive <= 511; archive++) {
    const name = `TEXTURE.${archive}`, t = new TextureFile();
    t.load(new Uint8Array(readFileSync(`${A}/${name}`)), name, pal);
    for (let record = 0; record < t.recordCount; record++) {
      const size = billboardSize(t, record), tree = isTreeRecord(archive % 2 === 1 && archive >= 505 ? archive - 1 : archive, record);
      const body = flatBody([0, 0, 0], t, archive, record, size, { tree });
      if (!body?.nature || !isCoverFlat(archive, record, size)) continue;
      if (!coverProxies([0, 0, 0], size, { tree }).some((p) => body.r + CAPSULE_RADIUS < p.r && 1.3 >= (p.lift ?? 0) && 1.3 <= (p.lift ?? 0) + p.h)) continue;
      const items = [flatBody([0, 0, 20], t, archive, record, size, { tree }), ...coverProxies([0, 0, 20], size, { tree })];
      const at = (z) => { const f = foe(0, z); keepFoesOffBodies([f], field(items)); return f; };
      assert.equal(myShaft(field(items), at(20.1), { from: [0, 1.41, 0] }).struck, false, `${archive}.${record}: behind it, shielded`);
      assert.equal(myShaft(field(items), at(19.9), { from: [0, 1.41, 0] }).struck, true, `${archive}.${record}: in front, struck`);
      n++;
    }
  }
  assert.ok(n >= 30, `the records the clamp leaves inside their cover (${n})`);
});

// ─── F2, F3: WHAT EACH MISSILE MAY STRIKE ─────────────────────────────

test('AUDIT FB1031 F2: a body a missile flies through holds no cover open for it - a town defender at a crown\'s middle for my shaft and my bolt, another foe there for a foe\'s bolt at me, the shooter itself for its own shot out of a crown (mutants: the lists every body; the shooter in its own)', () => {
  const young = youngAt([0, 0, 20]);
  const target = foe(0, 23.6), guard = foe(0.6, 20, { defender: true });   // behind the crown; at its middle, beside the line
  assert.equal(myShaft(field(young), target).struck, false, 'nobody in it: lost on the crown');
  assert.equal(myShaft(field(young), target, { others: [guard] }).struck, false, 'a defender my shaft flies through: still lost on it');
  const archer = foe(0, 21.5);   // in the crown, behind its middle from me
  assert.equal(foeShaft(field(young), [0, 0, 10], { from: [0, 1.1, 20.9], dir: [0, 0, -1], archer }), false, 'an archer\'s shaft out through the crown\'s middle: lost on it');
  { const caster = mkFoe(0, 0), other = mkFoe(0.6, 20), { magic, world } = rig(field(young), [caster, other], () => ({}));
    magic.fireEnemyMissile([0, 1.4, 0.6], [0, 0, 1], spellOf(2), 1, caster);
    fly(magic, [0, 0, 23.6]);
    assert.equal(world.hurt, 0, 'a foe\'s bolt at me behind the crown, another foe at its middle: stopped'); }
  { const t = mkFoe(0, 23.6), g = mkFoe(0.6, 20, { defender: true }), { magic, world } = rig(field(young), [t, g], () => ({}));
    magic.setReadied(spellOf(2)); magic.castInput([0, 1.4, 0], [0, 0, 1]); fly(magic, [0, 0, -0.5]);
    assert.equal(world.foeHurt.get(t) ?? 0, 0, 'my bolt at a foe behind the crown, a defender at its middle: stopped'); }
  { const t = mkFoe(0, 10), { magic, world } = rig(field(young), [t], () => ({}));
    magic.setReadied(spellOf(2)); magic.castInput([0, 1.4, 20.9], [0, 0, -1]); fly(magic, [0, 0, 20.9]);
    assert.equal(world.foeHurt.get(t) ?? 0, 0, 'my bolt out of the crown through its middle: lost on it - my own body opens nothing'); }
  // the dungeon's flight: each missile its own
  const dmb = spellcast.dungeonMissileBodies, a = foe(1, 1), b = foe(2, 2), mate = foe(3, 3, { companion: 0 }), me = [9, 0, 9];
  const feet = (list) => list.map((x) => x.feet);
  assert.deepEqual(feet(dmb({ fromPlayer: true, arrow: true }, [a, mate], me, 1.8)), [a.ai.feet], 'my shaft: the foes but a companion, never me');
  assert.deepEqual(feet(dmb({ arrow: true, shooterFoe: a }, [a, b], me, 1.8)), [b.ai.feet, me], 'a foe\'s shaft: me and every foe but its shooter');
  assert.deepEqual(feet(dmb({ aimFoe: b }, [a, b], me, 1.8)), [b.ai.feet], 'a foe\'s spell at a foe: that foe alone');
  assert.deepEqual(feet(dmb({}, [a, b], me, 1.8)), [me], 'a foe\'s spell at me: me alone');
  assert.deepEqual(feet(dmb({ visual: true }, [a], me, 1.8)), [a.ai.feet, me], 'a peer\'s drawn one: any body');
  assert.deepEqual(feet(dmb({ aimFoe: { isPeer: true, dead: true, ai: { feet: [5, 0, 5] } } }, [a], me, 1.8)), [], 'one loosed at a peer: never me');
  assert.match(hostText('src/scenes/dungeonContext.js'), /const _cs = flightStop\(collider, m\.pos, _unit, reach, step \* _len, !!m\.fromPlayer, dungeonMissileBodies\(m, foes, playerFeet, playerHeight, m\.fromPlayer \? \[gateBossBody\(\), arenaRivalBody\(\), \.\.\.gateCrystalBodies\(\), \.\.\.gateHostBodies\(\)\] : null\)\);/, 'the dungeon\'s flight reads it');
});

test('AUDIT FB1031 F3: my bolt meets a duel opponent, a party mate and the court\'s boss standing in a crown as it meets a foe there - spells are no longer one-way between players (mutants: the duel\'s, the mates\', the companion\'s, the boss\'s marks unlisted)', () => {
  const young = youngAt([0, 0, 20]);
  const cast = (sp, extra) => { const { magic, world } = rig(field(young), [], extra); magic.setReadied(sp); magic.castInput([0, 1.4, 0], [0, 0, 1]); fly(magic, [0, 0, -0.5]); return world.given; };
  assert.deepEqual(cast(spellOf(2), (w) => ({ duelMark: () => ({ id: 'peer-1', feet: [0, 0, 18.6], height: 1.8 }), castAtDuel: (id) => { w.given.push(id); return true; } })), ['peer-1'], 'my duel opponent in the crown');
  assert.deepEqual(cast(spellOf(2, [healEffect()]), (w) => ({ allyMarks: () => [{ id: 'mate-1', feet: [0, 0, 18.6], height: 1.8 }], castAtAlly: (id) => { w.given.push(id); return true; } })), ['mate-1'], 'my heal at a mate in the crown');
  assert.deepEqual(cast(spellOf(2), (w) => ({ bossMark: () => ({ name: 'Boss', feet: [0, 0, 19.2], height: 3, radius: 0.8 }), castAtBoss: () => { w.given.push('boss'); return true; } })), ['boss'], 'the boss in the crown');
  const rec = { entity: { name: 'Crewman', level: 1, health: 10, maxHealth: 40, magicka: 0, maxMagicka: 0, skills: new Array(40).fill(30), stats: {}, career: {}, activeEffects: [] }, ai: { feet: [0.7, 0, 18.6], height: 1.8 } };   // off the crosshair's pick (allyCast.js PERSON_RADIUS), in the bolt's reach
  const quiet = { hurt() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} };
  assert.deepEqual(cast(spellOf(2, [healEffect()]), (w) => ({ companionBodies: () => [rec], foeSinks: () => ({ ...quiet, heal: () => w.given.push('companion') }) })), ['companion'], 'my heal at my companion in the crown');
  assert.deepEqual(cast(spellOf(2), (w) => ({ duelMark: () => ({ id: 'peer-1', feet: [0, 0, 23.6], height: 1.8 }), castAtDuel: (id) => { w.given.push(id); return true; } })), [], 'behind the crown: shielded');
});

// ─── F4: ROUND A TRUNK ────────────────────────────────────────────────

function craftCfg() { const b = new Uint8Array(74), v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 4, true); [40, 50, 50, 85, 50, 50, 90, 55].forEach((a, i) => v.setUint16(58 + i * 2, a, true)); return b; }
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18, dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length), v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}

test('AUDIT FB1031 F4: a foe whose way runs through a trunk\'s middle is put round it - a step along its edge toward its destination\'s side, a fixed side dead on the line, none when its way lies back; executed, a rat dead on the line through a banyan reaches me within seconds (mutants: the step dropped; its side unread; the way unread)', async () => {
  const c = [0, 0, 10], trunk = jungleBody(c, 0, 1.2), R = trunk.r + CAPSULE_RADIUS;
  const step = (dest) => { const f = foe(0, 9, { destination: dest }); f.ai.destination = dest; keepFoesOffBodies([f], field([trunk])); return f.ai.feet; };
  const push = R - 1;
  const ahead = step([0, 0, 20]);
  assert.ok(Math.abs(ahead[0] - push) < 1e-9 && Math.abs(ahead[2] - (9 - push)) < 1e-9, `dead on the line: out and round, the fixed side (${ahead.map((v) => v.toFixed(3))})`);
  assert.ok(Math.abs(step([-5, 0, 20])[0] + push) < 1e-9, 'its destination to the left: round to the left');
  assert.ok(Math.abs(step([5, 0, 20])[0] - push) < 1e-9, '...to the right: the right');
  assert.equal(step([0, 0, 0])[0], 0, 'its way back from the trunk: straight out');
  assert.equal(step(null)[0], 0, 'no way at all: straight out');
  // the street's real pool: a rat chasing a still player, the trunk dead on the line between
  const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
  const pe = { level: 1, reflexes: 2, health: 5000, maxHealth: 5000, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) };
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: field([jungleBody([0, 0, 8], 0, 1.2)]),
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => ({ getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 }),
    uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5,
  });
  const rat = await pool.spawnFoe(0, [0, 0, 0], { feetGiven: true }), me = [0, 0, 16];
  let reached = null;
  for (let i = 0; i < 8 * 60 && reached == null; i++) {
    pool.update(1 / 60, me, [me[0], 1.6, me[2]], { candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
    if (Math.hypot(rat.ai.feet[0] - me[0], rat.ai.feet[2] - me[2]) < 2.2) reached = (i + 1) / 60;
  }
  assert.ok(reached != null && reached < 6, `at my side ${reached == null ? 'never in 8 s' : `in ${reached.toFixed(2)} s`} - held at the trunk for good before`);
});

// ─── F6: THE SPANS ────────────────────────────────────────────────────

test('AUDIT FB1031 F6: the clamp holds a foe only at a body its own height meets - a rock on a ledge over its head none; a crown holds a struck body only in its own span - a shot down through it at one standing under it is lost in it; a body behind a missile is none its line strikes (mutants: the over-the-head half; the hold\'s span; the line behind)', () => {
  const under = foe(0.1, 0.05), ledge = { c: [0, 2, 0], r: 1, h: 2, lift: 0, body: true, nature: true, _mark: 0 };
  assert.equal(keepFoesOffBodies([under], field([ledge])), 0, 'a rock over its head: not moved');
  assert.deepEqual(under.ai.feet, [0.1, 0, 0.05]);
  const low = { ...ledge, c: [0, 1.7, 0] }, f = foe(0.1, 0.05);
  assert.equal(keepFoesOffBodies([f], field([low])), 1, 'one its head reaches: moved');
  const crown = { c: [0, 0, 20], r: 3, h: 6, lift: 2, _mark: 0 };   // over the heads, from 2 m
  const o = [0, 20, 10], d = unit([0, -19, 8]);   // from a height, down through the crown's side to the foot of one beneath it
  const holds = struckPoints(o, d, [{ feet: [0, 0, 18], height: 1.8 }]);
  assert.ok(holds.length === 3 && holds[1] < 2, `struck under the crown (${holds[1]?.toFixed(2)} m)`);
  assert.ok(Number.isFinite(coverDistance(field([crown]), o, d, 30, false, holds)), 'lost in the crown, not opened by one under it');
  assert.deepEqual(struckPoints([0, 1.4, 0], [0, 0, 1], [{ feet: [0, 0, -0.95], height: 1.8 }]), [], 'the line behind the missile strikes nobody');
});

// ─── B1: A BAND STANDS OUTSIDE THE VIEW ───────────────────────────────

test('AUDIT FB1031 B1: a band met with the view down keeps its own bearing only outside the camera\'s view - else it stands just outside the view\'s edge on its own side, CAMP-FAR\'s FOV plus 0-4 degrees; lifted bandStand on the real campAnchorSpot never stands one in view (mutants: the view unread; the edge inside it; the side unread; the Overworld unread)', async () => {
  const bsb = bands.bandStandBearing;
  assert.deepEqual(bsb(0.7 + Math.PI, 0.7, 65), { yawRad: 0.7 + Math.PI, bearingDegrees: 0 }, 'behind the camera: its own bearing');
  assert.deepEqual(bsb(0.7, 0.7, 65), { yawRad: 0.7, bearingDegrees: 67 }, 'dead ahead: the view\'s edge, a fixed side');
  assert.deepEqual(bsb(0.6, 0.7, 65), { yawRad: 0.7, bearingDegrees: -67 }, 'ahead and to the left: the left edge');
  assert.deepEqual(bsb(0.7 + 68 * Math.PI / 180, 0.7, 65), { yawRad: 0.7 + 68 * Math.PI / 180, bearingDegrees: 0 }, 'past the edge and its jitter: its own');
  const w = hostText('src/scenes/world.js');
  const m = /\n {2}function bandStand\([^)]*\) \{\n[\s\S]*?\n {2}\}\n/.exec(w);
  assert.ok(m, 'bandStand lifted');
  const FOV = 65, anchors = [];
  const run = (camYaw, bearing, up = false) => {
    const scope = {
      bandRoom: () => true, player: { feetAt: () => [0, 0, 0] }, BAND_STAND_MIN_M: bands.BAND_STAND_MIN_M, PACK_SPACING, PACK_ALERT_RADIUS,
      wildFoes: { alert() {} }, exteriorFoes: { noticedPlayer() {} }, performance: { now: () => 0 }, bandStandBearing: bsb,
      cam: { yaw: camYaw }, fieldOfView: () => FOV * Math.PI / 180, travelView: { active: up }, renderer: { _camPos: [0, 0, 0] },
      largeHudWorldAspect: (w, h) => w / h, canvas: { clientWidth: 16, clientHeight: 9 },   // AUDIT FB1031 II K6: a 16:9 frame (PIN MOVED)
      _standCampEncounter: (hit, feet) => {   // world.js _standCampEncounter's own call of the anchor law
        anchors.push(campAnchorSpot({ feet, yawRad: hit.yawRad ?? camYaw, fovDegrees: FOV, groundAt: () => 0, minDistance: hit.minDistance, maxDistance: hit.maxDistance, bearingDegrees: hit.bearingDegrees }));
        return { foes: Promise.resolve([]) };
      },
    };
    const names = Object.keys(scope);
    const stand = new Function('s', `const { ${names.join(', ')} } = s; ${m[0]} return bandStand;`)(scope);
    anchors.length = 0;
    for (let i = 0; i < 500; i++) assert.equal(stand({ mobileTypes: [1, 2] }, bearing, bands.BAND_STAND_M), true);
    return anchors.map((a) => ({ off: Math.abs((((Math.atan2(a.x, a.z) - camYaw) * 180 / Math.PI % 360) + 540) % 360 - 180), d: Math.hypot(a.x, a.z), at: Math.atan2(a.x, a.z) }));
  };
  const facing = run(0.7, 0.7);
  assert.ok(facing.every((a) => a.off >= FOV && a.off <= FOV + 4), `the camera facing its way: every anchor ${Math.min(...facing.map((a) => a.off)).toFixed(1)}-${Math.max(...facing.map((a) => a.off)).toFixed(1)} degrees off, outside the view`);
  assert.ok(facing.every((a) => a.d >= bands.BAND_STAND_M - PACK_SPACING - 1e-9 && a.d <= bands.BAND_STAND_M + PACK_SPACING + 1e-9), 'at its own distance still');
  const away = run(0.7 + Math.PI, 0.7);
  assert.ok(away.every((a) => Math.abs(a.at - 0.7) <= 2 * Math.PI / 180 + 1e-9), 'the camera turned away: on its own bearing');
  const watched = run(0.7, 0.7, true);
  assert.ok(watched.every((a) => Math.abs(a.at - 0.7) <= 2 * Math.PI / 180 + 1e-9), 'under the Overworld: where it was watched coming (AUDIT OW5b B2)');
  assert.deepEqual(bsb(0.7, 0.7, 65, true), { yawRad: 0.7, bearingDegrees: 0 });
});
