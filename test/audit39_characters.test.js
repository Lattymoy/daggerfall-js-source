// AUDIT 39 - THE CHARACTERS BATCH. Four motor/spawn laws the audit
// read on both sides of the port and confirmed diverged:
//
//   #69  stopDistance is per-TARGET (2.25 player / 1.5 other AI),
//        set by TakeAction ahead of GetDestination
//   #70  a dungeon marker's Passive action byte reaches IsHostile
//   #71  LiveSpeed is re-read every pass, not captured at spawn
//   #72  CanAct carries no hostility term - a pacified foe with a
//        FOE target still pursues
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  EnemyAI, MELEE_DISTANCE, CLASSIC_MELEE_DISTANCE_VS_AI, enemyMoveSpeed,
} from '../src/characters/enemyMotor.js';
import { EnemyAttack, ATTACK_SPEED_FLOOR } from '../src/characters/enemyAttack.js';
import { collectDungeonEnemies } from '../src/characters/dungeonEnemies.js';
import { liveStat } from '../src/systems/statMods.js';

const ROOT = new URL('..', import.meta.url).pathname;
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const clearCollider = () => ({
  raycast: () => Infinity,
  capsuleCast: () => ({ dist: Infinity, key: null }),
  move: () => ({ grounded: true }),
});

// ---------------------------------------------------------------
// #69 - EnemyMotor.TakeAction (:443-449):
//   if (senses.Target == PlayerEntityBehaviour) stopDistance = attack.MeleeDistance;
//   else stopDistance = attack.ClassicMeleeDistanceVsAI;
// consumed by the approach test (:487) and the search ramp (:552).
// The port held the 2.25 literal at both, so an infighting foe halted
// 0.75 outside the 1.5 reach enemyAttack.js already gates its swing on
// - a permanent stand-off.
// ---------------------------------------------------------------
/** A foe set up to run _classicTick directly against one target. */
const mkTicker = (target) => {
  const ai = new EnemyAI(clearCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
  ai.detected = true;
  ai.inSight = true;
  ai.giveUpTimer = 200;
  ai._armedTargeting = target !== null;
  ai.target = target;
  ai.lastKnownTargetPos = [0, 0, 2];
  ai.predictedTargetPos = ai.lastKnownTargetPos;
  return ai;
};

test('audit39 #69: stopDistance is the TARGET\'s, and the vs-AI value lets the swing land', () => {
  // 2.0 apart: inside the player stop (2.25), outside the vs-AI one (1.5)
  const vsPlayer = mkTicker({ isPlayer: true });
  vsPlayer._dist = 2.0;
  vsPlayer._classicTick([0, 0, 2]);
  assert.equal(vsPlayer.stopDistance, MELEE_DISTANCE, 'the player arm takes MeleeDistance');
  assert.equal(vsPlayer.moving, false, 'and 2.0 is inside it - the foe stops');

  const vsFoe = mkTicker({ isPlayer: false, ai: {} });
  vsFoe._dist = 2.0;
  vsFoe._classicTick([0, 0, 2]);
  assert.equal(vsFoe.stopDistance, CLASSIC_MELEE_DISTANCE_VS_AI, 'a foe target takes ClassicMeleeDistanceVsAI');
  assert.equal(vsFoe.moving, true, 'so it keeps closing - the old 2.25 froze it outside its own reach');

  // ...and inside 1.5 it stops there too
  vsFoe._dist = 1.4;
  vsFoe._classicTick([0, 0, 1.4]);
  assert.equal(vsFoe.moving, false, 'stopping at 1.5, where enemyAttack.js:154-155 lets the swing land');

  // UNARMED (no targeting context) is the player value, unchanged
  const legacy = mkTicker(null);
  legacy._dist = 2.0;
  legacy._classicTick([0, 0, 2]);
  assert.equal(legacy.stopDistance, MELEE_DISTANCE, 'the player-only path is untouched');
});

test('audit39 #69: GetDestination\'s search ramp reads the same stopDistance (:552)', () => {
  const ai = mkTicker({ isPlayer: false, ai: {} });
  ai.inSight = false;                 // force the SEARCH arm of GetDestination
  ai.predictedTargetPos = null;
  ai.lastKnownTargetPos = [0, 0, 1.2];
  ai.lastPositionDiff = [0, 0, 1];
  ai.stopDistance = CLASSIC_MELEE_DISTANCE_VS_AI;
  ai.searchMult = 0;
  ai._getDestination([0, 0, 1.2]);
  assert.equal(ai.searchMult, 1, 'a search position 1.2 out is inside 1.5 - the ramp climbs');
  ai.stopDistance = CLASSIC_MELEE_DISTANCE_VS_AI;
  ai.searchMult = 0;
  ai.lastKnownTargetPos = [0, 0, 2.0];
  ai._getDestination([0, 0, 2.0]);
  assert.equal(ai.searchMult, 0, '...and 2.0 out is not, where the 2.25 literal would have climbed');
  // the literal is gone from both consumers
  const mot = rd('src/characters/enemyMotor.js');
  assert.ok(mot.includes('sd <= this.stopDistance'), 'the search ramp reads stopDistance');
  assert.ok(mot.includes('distance <= this.stopDistance'), 'so does the approach test');
});

// ---------------------------------------------------------------
// #70 - RDBLayout.AddEnemy (:1519-1521) reads the flat's Action byte
// and hands MobileReactions.Passive down to EnemyMotor.Start (:122)
// `IsHostile = mobile.Enemy.Reactions == MobileReactions.Hostile`.
// collectDungeonEnemies minted the field and no spawner read it.
// ---------------------------------------------------------------
test('audit39 #70: a Passive dungeon marker spawns a non-hostile foe', () => {
  const mk = (actionByte) => ({
    record: 16, factionOrMobileId: 10, action: 0, actionByte,
    x: 0, y: 0, z: 0, rawY: 0, flags: 0, soundIndex: 0,
  });
  const blocks = [{ originX: 0, originZ: 0, waterLevel: 10000, markers: [mk(99), mk(0)] }];
  const out = collectDungeonEnemies(blocks, { locationId: 1, dungeonType: 0, playerLevel: 1, alternate: false });
  assert.equal(out.length, 2);
  assert.equal(out[0].reaction, 'passive', 'action byte 99 is EnemyReactionTypes.Passive');
  assert.equal(out[1].reaction, 'hostile');

  // the seam the finding says was dead: the motor takes it as an option
  assert.equal(new EnemyAI(clearCollider(), [0, 0, 0], 0, { isHostile: out[0].reaction !== 'passive' }).isHostile, false);
  assert.equal(new EnemyAI(clearCollider(), [0, 0, 0], 0, { isHostile: out[1].reaction !== 'passive' }).isHostile, true);
  assert.equal(new EnemyAI(clearCollider(), [0, 0, 0], 0).isHostile, true, 'no option = hostile, as every other caller expects');

  // ...and BOTH dungeon spawn branches forward it
  const dc = rd('src/scenes/dungeonContext.js');
  assert.equal((dc.match(/isHostile: e\.reaction !== 'passive'/g) ?? []).length, 2,
    'the class branch and the monster branch both pass the marker reaction');
});

// ---------------------------------------------------------------
// #71 - EnemyMotor.TakeAction (:432) re-derives moveSpeed from
// entity.Stats.LiveSpeed every FixedUpdate, and EnemyAttack.FixedUpdate
// (:69-72) re-reads it too, under the source's own note that the floor
// exists "so Drain Speed does not prevent attack ever firing". Both
// were captured once at spawn here.
// ---------------------------------------------------------------
test('audit39 #71: move speed and attack cadence read LiveSpeed through, so a Drain bites', () => {
  const entity = { stats: { speed: 70 }, activeEffects: [] };
  const ai = new EnemyAI(clearCollider(), [0, 0, 0], 0, { liveSpeed: () => liveStat(entity, 'speed') });
  const attack = new EnemyAttack({ liveSpeed: () => liveStat(entity, 'speed') });
  assert.equal(ai.speed, enemyMoveSpeed(70));
  assert.equal(attack.liveSpeed, 70);
  entity.activeEffects.push({ kind: 'drainAttribute', stat: 'speed', magnitude: 40 });
  assert.equal(liveStat(entity, 'speed'), 30);
  assert.equal(ai.speed, enemyMoveSpeed(30), 'the drained foe walks slower');
  assert.equal(attack.liveSpeed, 30, 'and swings on the drained cadence');
  // the speed FLOOR still belongs to the attack roll, not the read
  entity.activeEffects[0].magnitude = 70;
  assert.equal(attack.liveSpeed, 0);
  assert.equal(ATTACK_SPEED_FLOOR, 8, 'attackRollPasses floors it, per EnemyAttack.cs:71-73');
  // a plain number still works - every headless caller passes one
  const flat = new EnemyAI(clearCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
  assert.equal(flat.speed, enemyMoveSpeed(50));
  // and all three pools hand over the thunk
  for (const p of ['src/scenes/dungeonContext.js', 'src/scenes/cityGuards.js', 'src/scenes/exteriorFoes.js']) {
    assert.ok(rd(p).includes("liveSpeed: () => liveStat(entity, 'speed')"), `${p} passes the live read`);
    assert.ok(!rd(p).includes('liveSpeed: entity.liveSpeed'), `${p} keeps no spawn snapshot`);
  }
});

// ---------------------------------------------------------------
// #72 - `grep -n IsHostile Game/EnemyMotor.cs` finds writes at :122
// and :206 and NO read: CanAct carries no hostility term. A pacified
// foe stops because EnemySenses:321-327 drops the PLAYER as its target
// and HandleNoAction (:359) then sees `Target == null` - a FOE target
// survives that drop, which is this module's own documented exception.
// ---------------------------------------------------------------
test('audit39 #72: a pacified foe with a FOE target still acts; one without still stands down', () => {
  const senses = { gameMinutes: 0, playerStealth: 0, rolls: () => 0.5 };
  const mauler = { isPlayer: false, ai: { feet: [0, 0, 2], height: 1.8 } };

  const pacified = new EnemyAI(clearCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
  pacified._classicSenses = () => {}; pacified._senses = () => {};
  pacified.isHostile = false;
  pacified.detected = true;
  pacified.giveUpTimer = 200;
  pacified.inSight = true;
  pacified.lastKnownTargetPos = [0, 0, 2];
  pacified.predictedTargetPos = pacified.lastKnownTargetPos;
  pacified.target = mauler;
  pacified._armedTargeting = true;
  pacified.update(1 / 60, [0, 0, 20], { ...senses, targeting: () => {} });
  assert.equal(pacified.canAct, true, 'CanAct has no hostility term (EnemyMotor.cs FixedUpdate :155-176)');

  // ...and with no foe target it is DFU's `Target == null` after all
  const alone = new EnemyAI(clearCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
  alone._classicSenses = () => {}; alone._senses = () => {};
  alone.isHostile = false;
  alone.detected = true;
  alone.giveUpTimer = 200;
  alone.lastKnownTargetPos = [0, 0, 2];
  alone.predictedTargetPos = alone.lastKnownTargetPos;
  alone.update(1 / 60, [0, 0, 2], senses);
  assert.equal(alone.canAct, false, 'no target, no action - HandleNoAction :357-366');
  assert.equal(alone.moving, false);

  const mot = rd('src/characters/enemyMotor.js');
  assert.ok(!/canAct = !paralyzed && !knocked && this\.isHostile;/.test(mot),
    'the flat hostility AND is gone from CanAct');
});

// ---------------------------------------------------------------
// #73 - pieces/cuirass.js's buildCuirass, pieces/greaves.js,
// clothing.js's clothingZones and armorSet.js's armorZones had no
// caller anywhere; the only references in the tree were four unused
// imports in paperdollPayload.js, which made grep report the four
// modules as wired. They are STAGED, not shipped.
// ---------------------------------------------------------------
test('audit39 #73: the four staged item-geometry modules are not imported as if live', () => {
  const pp = rd('src/characters/paperdollPayload.js');
  for (const dead of ['buildCuirass', 'buildGreaves', 'clothingZones', 'armorZones']) {
    assert.ok(!new RegExp(`import \\{[^}]*\\b${dead}\\b`).test(pp),
      `paperdollPayload.js no longer imports ${dead} without calling it`);
  }
  assert.ok(pp.includes("import { STEEL_RAMP } from './pieces/cuirass.js';"),
    'STEEL_RAMP stays - the pauldrons and helm are built from it');
  assert.ok(pp.includes('buildPauldrons(STEEL_RAMP)') && pp.includes('buildHelm(STEEL_RAMP)'));
  assert.ok(/STAGED, not shipped/.test(pp), 'the seam is named as staged, not silently dropped');
});

// ---------------------------------------------------------------
// #74 - buildNeutralBody's AO pass compared every face against every
// other (2136^2), ~160ms a build, and buildPaperdollPayload runs ~90
// of them in one synchronous statement: the editor page froze for
// ~15s before it painted. Binned, the numbers out must not move.
// ---------------------------------------------------------------
test('audit39 #74: the AO pass is spatially binned, and the shading is unchanged by it', async () => {
  const { buildNeutralBody } = await import('../src/characters/neutralBody.js');
  const ramps = {
    skin: [[80, 60, 50], [120, 90, 75], [160, 125, 105], [200, 160, 135]],
    boot: [[30, 25, 20], [60, 50, 40], [90, 75, 60], [120, 100, 80]],
  };
  // THE LAW, restated as arithmetic: a face's occlusion is the sum over
  // every OTHER face whose centroid is inside AO_R and in front of it.
  // The reference here is the flat walk the fix replaced, so the bin
  // can never quietly drop or add a neighbour - and the sum is asserted
  // bit for bit, because the villager DELTAS diff against these values.
  const body = buildNeutralBody(ramps);
  const cen = body.map((f) => {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < 4; i++) { x += f.p[i*3]; y += f.p[i*3+1]; z += f.p[i*3+2]; }
    return [x/4, y/4, z/4];
  });
  const AO_R = 0.11, AO_K = 0.55;
  const Lx = 0.5, Ly = 0.55, Lz = 0.67, Ln = Math.hypot(Lx, Ly, Lz);
  for (const i of [0, 17, 400, 1023, body.length - 1]) {
    const c = cen[i], n = body[i].n; let occ = 0;
    for (let j = 0; j < body.length; j++) {
      if (j === i) continue;
      const dx = cen[j][0]-c[0], dy = cen[j][1]-c[1], dz = cen[j][2]-c[2];
      const d = Math.hypot(dx, dy, dz);
      if (d < 1e-4 || d > AO_R) continue;
      const facing = (dx*n[0] + dy*n[1] + dz*n[2]) / d;
      if (facing > 0.25) occ += (1 - d/AO_R) * facing;
    }
    const ao = Math.max(0.45, 1 - Math.min(1, occ * AO_K * 0.12));
    const lit = Math.max(0.08, (n[0]*Lx + n[1]*Ly + n[2]*Lz) / Ln * 0.9 + 0.15);
    const want = Math.min(1, Math.max(0.04, lit * ao));
    assert.equal(body[i]._i, want, `face ${i}: the binned AO is the flat walk's value, bit for bit`);
  }
  const src = rd('src/characters/neutralBody.js');
  assert.ok(src.includes('near.sort((a, b) => a - b);'),
    'the gathered neighbours are summed in ascending index order - float addition is not associative');
  assert.ok(!/for \(let j = 0; j < faces\.length; j\+\+\) \{\s*\n\s*if \(j === i\) continue;/.test(src),
    'the face-against-every-face walk is gone');
});

// ---------------------------------------------------------------
// #75 - all 25 designs name a hairstyle and a hair colour, pieces/hair.js
// builds exactly those, and the viewer's applyVillagerHair reads
// D.hair[race][style] / D.hairRamps / v.hair - but the PAYLOAD emitted
// none of the three, so every figure in the editor was bald.
// ---------------------------------------------------------------
test('audit39 #75: the payload ships the hair the designs ask for', async () => {
  const { buildPaperdollPayload } = await import('../src/characters/paperdollPayload.js');
  const { VILLAGER_DESIGNS } = await import('../src/characters/villagerDesigns.js');
  const { HAIR_RAMPS } = await import('../src/characters/pieces/hair.js');
  const D = buildPaperdollPayload(null, null, null);
  assert.deepEqual(Object.keys(D.hairRamps), Object.keys(HAIR_RAMPS), 'the three colours the designs name');
  assert.deepEqual(Object.keys(D.hair).sort(), ['Elf', 'Human'], 'hair.js grows hair on these races only');
  for (const R of Object.keys(D.hair)) {
    for (const [st, pack] of Object.entries(D.hair[R])) {
      assert.ok(pack.P.length > 0, `${R}/${st} is real geometry`);
      assert.equal(pack.P.length / 12, pack.C.length / 3, `${R}/${st} packs one colour per face`);
    }
  }
  // every authored style resolves - the viewer indexOf()s it by name,
  // and a miss silently leaves the previous villager's hair on
  const styles = Object.keys(D.hair.Human);
  for (const d of VILLAGER_DESIGNS) {
    assert.ok(styles.includes(d.hair.style), `${d.archive} ${d.name}: style "${d.hair.style}" has no pack`);
    assert.ok(D.hairRamps[d.hair.ramp], `${d.archive} ${d.name}: ramp "${d.hair.ramp}" is not shipped`);
  }
  assert.equal(D.villagers.length, VILLAGER_DESIGNS.length);
  for (let i = 0; i < D.villagers.length; i++) {
    assert.deepEqual(D.villagers[i].hair, VILLAGER_DESIGNS[i].hair, 'the pack carries the design\'s hair');
  }
});

// ---------------------------------------------------------------
// #77 - minMetalToHit 5 is WeaponMaterialTypes.Mithril (weapons.js gives
// Daedric 9), so mithril and every tier above it hits a daedra. The
// file's header called it "daedric weapons or nothing" - four tiers off.
// ---------------------------------------------------------------
test('audit39 #77: the daedra header reads minMetalToHit 5 as Mithril', async () => {
  const { WEAPON_MATERIALS } = await import('../src/characters/weapons.js');
  const { ENEMY_BASICS } = await import('../src/characters/enemyBasics.js');
  assert.equal(WEAPON_MATERIALS.Mithril, 5);
  assert.equal(WEAPON_MATERIALS.Daedric, 9);
  for (const id of [25, 26, 27, 29, 31]) assert.equal(ENEMY_BASICS[id].minMetalToHit, 5);
  const hdr = rd('src/characters/daedra.js');
  assert.ok(!hdr.includes('daedric weapons or nothing'), 'the four-tier misreading is gone');
  assert.ok(hdr.includes('WeaponMaterialTypes.Mithril'), 'and the threshold is named for what it is');
});
