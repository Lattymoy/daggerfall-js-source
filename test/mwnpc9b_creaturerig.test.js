// MWNPC9b (2026-10-09, the MW-NPC arc's ninth slice - bible/04-Characters/Morrowind-NPCs.md section 14b): A CREATURE'S
// BODY ON THE RIG. combat/fpArm.js builds a creature from its CREA record (buildCreatureBody: the last master's record,
// rule 18's x-model, assembleCreature, its sources) and stands it in third person at once - a creature has no first.
// A non-biped animates as OpenMW's CharacterController animates one: its bare idle and walk whatever it has drawn (no
// weapon short group, no turning), its idle let go while it acts, moves or recoils; its blow one of its attack groups by
// the roll, "start" to "stop" in one section, paced so the playhead reaches its "hit" at the machine's hit; its cast one
// of the same; its recoil and death the body's. PeerBodies keys and builds it by its record, and rolls its blow by the
// swing count. Pinned on the creature fixture (fixtures/mw/creatureRig.mjs) on a real rig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFpArm } from '../src/combat/fpArm.js';
import { peerBodyKey, peerBuildOpts } from '../src/net/peerBodies.js';
import { countingRenderer } from './fixtures/mw/bodyRig.mjs';
import { creatureDeps, creaRec, creatureClip, CREATURE_KF, CREATURE_MODEL } from './fixtures/mw/creatureRig.mjs';

const move = { forward: 0, strafe: 0, running: false, speed: 0, grounded: true };
const camOf = () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { ...move } });
async function beast(deps = creatureDeps(), id = 'fixture_beast') {
  const cam = camOf();
  const r = createFpArm(); r.attach(countingRenderer(), () => cam);
  const res = await r.build({ creature: id, deps });
  return { r, res, cam };
}
const step = (r, n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) r.update(dt, { pose: true }); };

test('MWNPC9b-1 the build: the CREA record by id, its x-model and its own .kf, its scale; standing in third person from the first frame - a creature has no first person', async () => {
  const { r, res } = await beast();
  assert.equal(res.ok, true, res.error);
  const { height, ...record } = res.creature;
  assert.deepEqual(record, { id: 'fixture_beast', name: 'fixture_beast', flags: 0x48, bipedal: false, scale: 1.5 });
  assert.ok(height > 0);
  assert.equal(res.skeletonPath, CREATURE_MODEL, 'rule 18: the x-model, its .kf being there');
  assert.deepEqual(res.sourcePaths, [CREATURE_KF], 'a non-biped: its own .kf alone');
  assert.deepEqual(res.raceScale, { weight: 1.5, height: 1.5 }, 'XSCL, uniform (Creature::adjustScale)');
  // its height: the idle's first frame tops out at z 17 (the head piece) over its feet, times 1.5, in metres - not the capsule
  assert.ok(Math.abs(r.bodyHeight() - (17.0 * 1.5) / 69.99125109) < 0.02, `measured, scaled (${r.bodyHeight()})`);
  assert.equal(r.viewMode(), 'third');
  assert.equal(r.setViewMode('first'), false, 'and no first person to go to');
  step(r);
  assert.equal(r.thirdActive(), true);
  assert.equal(r.status().posedGroup, 'idle');
  // the last record that carries the id wins (the store's own overwrite)
  const two = await beast(creatureDeps({ records: [creaRec('fixture_beast', 'r\\creature.nif', { scale: 2 }), creaRec('fixture_beast', 'r\\creature.nif', { scale: 0.5 })] }));
  assert.equal(two.res.creature.scale, 0.5);
});

test('MWNPC9b-2 refusals, each at its stage: no record, no model, no .kf', async () => {
  assert.equal((await beast(creatureDeps(), 'no_such_beast')).res.stage, 'record');
  assert.equal((await beast(creatureDeps({ files: { [CREATURE_MODEL]: null } }))).res.stage, 'model', 'the x-model gone (its .kf there)');
  const noKf = await beast(creatureDeps({ files: { [CREATURE_KF]: null, 'meshes/r/creature.nif': new Uint8Array(0) } }));
  assert.equal(noKf.res.ok, false, 'no .kf: rule 18 keeps the plain path, and nothing animates it');
});

test('MWNPC9b-3 a non-biped\'s stances are bare: its idle drawn or not, its walk for a run it has none of, no turning; the idle let go while it walks and taken up again', async () => {
  const { r, cam } = await beast();
  step(r);
  assert.equal(r.setSheathed(false), true);
  assert.equal(r.status().upperName, 'WeaponEquipped', 'no equip section to play: the claws are out at once');
  step(r);
  assert.equal(r.status().idleGroup, 'idle', 'no weapon short group for its claws - never "idlehh"');
  assert.equal(r.status().loopsLeft, null, 'and so no loop dice: its idle loops on (rule 10 - a stance with no short group)');
  cam.move.forward = 1; cam.move.speed = 2;
  step(r, 3);
  assert.equal(r.status().posedGroup, 'walkforward');
  assert.equal(r.status().idleGroup, null, 'refreshIdleAnims\' non-biped arm: no idle under the walk');
  cam.move.running = true;
  step(r, 3);
  assert.equal(r.status().movementGroup, 'walkforward', 'a run it has no clip for is its walk');
  cam.move.forward = 0; cam.move.speed = 0; cam.move.running = false;
  for (let i = 0; i < 20; i++) { cam.yaw += 0.1; step(r); }
  assert.equal(r.status().movementGroup, null, 'turning on the spot is no animation for a non-biped (character.cpp:2178) - though its .kf has the turns');
  assert.equal(r.status().idleGroup, 'idle', 'and the idle is back');
});

test('MWNPC9b-4 its blow: one of its attacks by the roll, start to stop in one section, the idle let go and back at its end; paced so "hit" lands at the machine\'s hit; its cast an attack too', async () => {
  const { r } = await beast();
  step(r);
  assert.equal(r.attack('StrikeDown', { roll: 0 }), null, 'sheathed: no blow');
  r.setSheathed(false); step(r);
  assert.equal(r.attack('StrikeDown', { roll: 1 }), 'attack2', 'roll 1 of two: the second');
  step(r);
  let s = r.status();
  assert.equal(s.posedGroup, 'attack2');
  assert.equal(s.upperName, 'AttackEnd', 'one section, standing as the follow-through');
  assert.equal(s.idleGroup, null);
  step(r, 40);
  s = r.status();
  assert.equal(s.upperName, 'WeaponEquipped', 'free at its stop');
  assert.equal(s.idleGroup, 'idle');
  assert.equal(r.attack('StrikeDown', { roll: 2 }), 'attack1', 'roll 2 of two: back to the first');
  // a new blow cuts the last's follow-through, as a person's does
  assert.equal(r.attack('StrikeDown', { roll: 1 }), 'attack2');
  step(r, 40);
  // MW-PACE1: attack1's hit is 0.3 file seconds in; the machine's lands at 0.6 - half speed, so at 0.6 s the playhead is on "hit"
  r.attack('StrikeDown', { roll: 0, blow: { hitAt: 0.6, seconds: 1 } });
  assert.ok(Math.abs(r.status().blow.rate - 0.5) < 1e-6, `fitted to the hit (${r.status().blow.rate})`);
  for (let i = 0; i < 36; i++) r.update(1 / 60, { pose: true });
  assert.ok(Math.abs(r.status().time - 2.5) < 0.02, `on "attack1: hit" at the machine's hit (${r.status().time})`);
  step(r, 60);
  // the cast: one of its attacks, start to stop (no release key - it casts at once)
  assert.equal(r.castSpell(2), true);
  step(r);
  assert.match(r.status().posedGroup ?? '', /^attack[12]$/);
  assert.equal(r.status().upperName, 'AttackEnd');
});

test('MWNPC9b-5 its recoil and its death are the body\'s: the idle let go under the recoil; the dying body stands', async () => {
  const { r } = await beast();
  step(r);
  assert.equal(r.hurt(0), true);
  step(r);
  assert.equal(r.status().posedGroup, 'hit1');
  assert.equal(r.status().idleGroup, null);
  step(r, 30);
  assert.equal(r.status().idleGroup, 'idle', 'the recoil played out');
  assert.equal(r.die(0), true);
  step(r);
  assert.equal(r.status().posedGroup, 'death1');
  assert.equal(r.thirdActive(), true, 'the dying creature stands');
});

test('MWNPC9b-6 a Bipedal creature animates as a person: xbase_anim first, then its own .kf', async () => {
  const deps = creatureDeps({ records: [creaRec('fixture_biped', 'r\\creature.nif', { flags: 0x49 })], base: creatureClip() });
  const { res } = await beast(deps, 'fixture_biped');
  assert.equal(res.ok, true, res.error);
  assert.equal(res.creature.bipedal, true);
  assert.deepEqual(res.sourcePaths, ['meshes/xbase_anim.kf', CREATURE_KF]);
});

test('MWNPC9b-7 PeerBodies: a creature\'s body is keyed and built by its record - every one of a kind one body, never a person\'s', () => {
  assert.equal(peerBodyKey({ creature: 'rat' }), 'crea|rat');
  assert.notEqual(peerBodyKey({ creature: 'rat' }), peerBodyKey({ race: 'Breton', gender: 'male', items: [] }));
  assert.deepEqual(peerBuildOpts({ creature: 'rat' }), { creature: 'rat', reachSweep: false });
});

test('MWNPC9b-8 THE MATCH, a census: every creature mobile named - a Morrowind creature (its CREA ids, in order) or a declared miss with its reason', async () => {
  const { CREATURE_MATCH, creatureLook } = await import('../src/characters/creatureBodies.js');
  const { MOBILE_TYPES } = await import('../src/characters/mobileTypes.js');
  const creatures = Object.values(MOBILE_TYPES).filter((t) => t < 128);
  assert.deepEqual(Object.keys(CREATURE_MATCH).map(Number).sort((a, b) => a - b), creatures.sort((a, b) => a - b), 'a new creature mobile is named here');
  for (const [t, m] of Object.entries(CREATURE_MATCH)) {
    assert.ok(!!m.creature !== !!m.miss, `${t}: a match or a miss, never both`);
    if (m.creature) assert.ok(m.creature.length && m.creature.every((id) => id === id.toLowerCase() && id.trim() === id), `${t}: ids as the reader keeps them`);
    else assert.ok(m.miss.length > 4, `${t}: the miss says why`);
  }
  // the ids read off UESP's tables - a few pinned, so an edit from memory is seen
  assert.deepEqual(CREATURE_MATCH[MOBILE_TYPES.GrizzlyBear].creature, ['bm_bear_black']);
  assert.deepEqual(CREATURE_MATCH[MOBILE_TYPES.Mummy].creature, ['draugr']);
  assert.deepEqual(CREATURE_MATCH[MOBILE_TYPES.Spriggan].creature, ['bm_spriggan']);
  assert.deepEqual(CREATURE_MATCH[MOBILE_TYPES.SkeletalWarrior].creature, ['skeleton warrior', 'skeleton']);
  assert.ok(CREATURE_MATCH[MOBILE_TYPES.Ghost].miss && CREATURE_MATCH[MOBILE_TYPES.Wraith].miss, 'the translucent dead keep their sprites');
  for (const t of [MOBILE_TYPES.Orc, MOBILE_TYPES.OrcSergeant, MOBILE_TYPES.OrcShaman, MOBILE_TYPES.OrcWarlord, MOBILE_TYPES.Vampire, MOBILE_TYPES.VampireAncient]) assert.ok(CREATURE_MATCH[t].miss, `${t}: a person, not a creature`);
  // the look: one frozen object a kind (a body key), none for a person or a miss
  const rat = { mobileType: MOBILE_TYPES.Rat, entity: { isClass: false } };
  assert.deepEqual(creatureLook(rat), { creature: ['rat'] });
  assert.equal(creatureLook(rat), creatureLook({ ...rat }), 'every rat one look');
  assert.ok(Object.isFrozen(creatureLook(rat)));
  assert.equal(creatureLook({ mobileType: MOBILE_TYPES.GiantBat, entity: {} }), null);
  assert.equal(creatureLook({ mobileType: 130, entity: { isClass: true } }), null);
  assert.equal(creatureLook(null), null);
});

test('MWNPC9b-9 the foe hosts: a matched creature is a body foe, its actor wearing its creature; offered where the class foes are - the living and the dead from the kill, in the dungeon and the pool', async () => {
  const { isBodyFoe, foeActor } = await import('../src/characters/foeBodies.js');
  const { readFileSync } = await import('node:fs');
  const rat = { mobileType: 0, entity: { isClass: false }, ai: { feet: [1, 0, 2], yaw: 0.5, moving: true, giveUpTimer: 1 }, _atkA: 6, dead: false };
  assert.equal(isBodyFoe(rat), true);
  assert.equal(isBodyFoe({ ...rat, mobileType: 3 }), false, 'a giant bat: no match');
  assert.equal(isBodyFoe({ mobileType: 130, entity: { isClass: true } }), true, 'a class foe as ever');
  const a = foeActor(rat);
  assert.deepEqual(a.look, { creature: ['rat'] });
  assert.deepEqual([a.drawn, a.swings, a.moving, a.running], [true, 3, true, true]);
  const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  for (const p of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js']) {
    const s = rd(p);
    assert.equal(s.split('isBodyFoe(f)').length - 1, 2, `${p}: the living and the dead offered by isBodyFoe`);
    assert.ok(!/isClassFoe\(f\)/.test(s), `${p}: no class-only offer left`);
  }
  assert.ok(rd('src/scenes/cityGuards.js').includes('if (npcLane && isClassFoe(g))'), 'the watch are people');
});

test('MWNPC9b-10 the build takes the match\'s candidates in order: the first the masters carry; PeerBodies keys the list', async () => {
  const { res } = await beast(creatureDeps(), ['no_such_beast', 'fixture_beast']);
  assert.equal(res.ok, true, res.error);
  assert.equal(res.creature.id, 'fixture_beast');
  const two = await beast(creatureDeps({ records: [creaRec('fixture_beast', 'r\\creature.nif'), creaRec('other_beast', 'r\\creature.nif', { scale: 3 })] }), ['other_beast', 'fixture_beast']);
  assert.equal(two.res.creature.id, 'other_beast', 'both carried: the first in the match\'s order');
  const none = await beast(creatureDeps(), ['a', 'b']);
  assert.match(none.res.error, /"a" or "b"/);
  assert.equal(peerBodyKey({ creature: ['skeleton warrior', 'skeleton'] }), 'crea|skeleton warrior,skeleton');
  // the host culls and heads a creature by its own height, a person by the capsule
  const { readFileSync } = await import('node:fs');
  const pb = readFileSync(new URL('../src/net/peerBodies.js', import.meta.url), 'utf8');
  assert.equal(pb.split('(b.rig.bodyHeight?.() ?? CAPSULE_HEIGHT * (b.rig.raceHeightScale?.() ?? 1))').length - 1, 2, 'heightOf and the cull sphere');
});
