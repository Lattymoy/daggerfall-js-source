// MWNPC4 (2026-10-09, the MW-NPC arc's fourth slice - bible/04-Characters/Morrowind-NPCs.md section 9): THE NPC LANE
// AND WHAT AN NPC'S BODY DOES THAT A PEER'S NEVER DID - IT IS HIT, AND IT DIES. The rig plays OpenMW's hit recoil
// (refreshHitRecoilAnims: "hit" + chooseRandomGroup, Priority_Hit, once, a recoil playing taking no other) and its death
// (playRandomDeath/playDeath: "death" + chooseRandomGroup, Priority_Death, held at its stop, every other state reset and
// no longer refreshed, a corpse met already dead standing at its startpoint); PeerBodies plays both off two pose fields
// only an NPC's carries; the lane (characters/npcBodies.js) stands the NPCs as synthetic peers under caps of their own;
// and every body lane the hosts stand builds through ONE queue (BODY_BUILD_GATE).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFpArm } from '../src/combat/fpArm.js';
import { PeerBodies, BODY_BUILD_GATE } from '../src/net/peerBodies.js';
import { createNpcBodies, npcShown, npcPeerId, NPC_BODY_TIERS, NPC_BODIES_DEFAULT } from '../src/characters/npcBodies.js';
import { parseNif } from '../src/formats/mwNifFile.js';
import { writeNif } from '../tools/nifWrite.mjs';
import { fixtureBodyDeps, countingRenderer } from './fixtures/mw/bodyRig.mjs';
import { castClip } from './fixtures/mw/castClip.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await flush(); };
const cam = () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } });

/** The body's clip file: MW-CAST1's (armfpweapon.kf with the spellcast group - castClip.mjs), with the fists'
 *  group (so the bare-handed body swings) and Morrowind's reaction groups appended after its last key: two recoils, a
 *  gap (Hit3 missing, so Hit4 is never counted - chooseRandomGroup stops at the first absent), and two deaths. */
const REACT_KEYS = [
  [10.6, 'HandToHand: Equip Start'], [10.7, 'HandToHand: Equip Stop'], [10.8, 'HandToHand: Chop Start'],
  [10.9, 'HandToHand: Chop Min Attack'], [11.0, 'HandToHand: Chop Max Attack'], [11.1, 'HandToHand: Chop Min Hit'],
  [11.2, 'HandToHand: Chop Hit'], [11.3, 'HandToHand: Chop Large Follow Start'], [11.4, 'HandToHand: Chop Large Follow Stop'],
  [11.5, 'HandToHand: Unequip Start'], [11.6, 'HandToHand: Unequip Stop'],
  [11.7, 'Hit1: Start'], [11.9, 'Hit1: Stop'], [12.0, 'Hit2: Start'], [12.2, 'Hit2: Stop'],
  [12.3, 'Hit4: Start'], [12.4, 'Hit4: Stop'],
  [12.5, 'Death1: Start'], [13.0, 'Death1: Stop'], [13.1, 'Death2: Start'], [13.6, 'Death2: Stop'],
];
function reactClip() {
  const nif = parseNif(castClip());
  const records = nif.records.map((r) => ({ ...r }));
  const tk = records.find((r) => r.type === 'NiTextKeyExtraData');
  tk.keys = [...tk.keys, ...REACT_KEYS.map(([time, text]) => ({ time, text }))];
  return writeNif(records, nif.roots);
}
/** fixtureBodyDeps with the body's clip file swapped for `kf` (null: the plain one, no reaction groups at all) */
function depsWith(kf) {
  const d = fixtureBodyDeps();
  return { ...d, loadMorrowindArchives: async () => (await d.loadMorrowindArchives()).map((a) => ({ has: a.has, get: (p) => (kf && p === 'meshes/xbase_anim.kf' ? kf : a.get(p)) })) };
}
async function body(kf = reactClip()) {
  const r = createFpArm(); r.attach(countingRenderer(), cam);
  assert.equal((await r.build({ race: 'fprace', deps: depsWith(kf) })).ok, true);
  r.setViewMode('third');
  r.update(1 / 60, { pose: true });
  return r;
}

test('MWNPC4a the recoil: "hit" + one of the groups the body carries, by the roll, counted to the first one missing; played once at Priority_Hit over the idle and let go; a recoil playing takes no other', async () => {
  const r = await body();
  const idle = r.status().posedGroup;
  assert.ok(idle && !/^hit|^death/.test(idle), `standing in its idle (${idle})`);
  assert.equal(r.hurt(0), true);
  assert.equal(r.status().hit.group, 'hit1', 'roll 0: the first');
  r.update(1 / 60, { pose: true });
  assert.equal(r.status().posedGroup, 'hit1', 'the recoil wins the idle');
  assert.equal(r.hurt(1), false, 'a recoil playing takes no other');
  assert.equal(r.status().hit.group, 'hit1');
  for (let i = 0; i < 20; i++) r.update(1 / 60, { pose: true });
  assert.equal(r.status().hit, null, 'played start to stop, once, and let go');
  assert.equal(r.status().posedGroup, idle, 'the idle again');
  const pick = async (roll) => { const b = await body(); b.hurt(roll); return b.status().hit?.group ?? null; };
  assert.equal(await pick(1), 'hit2');
  assert.equal(await pick(3), 'hit2', 'two groups counted - Hit3 is missing, so Hit4 is not one of them (3 % 2 = 1)');
  assert.equal(await pick(2), 'hit1');
  assert.equal(await pick(-1), 'hit2', 'a negative roll wraps, never names hit0');
  const plain = await body(null);
  assert.equal(plain.hurt(0), false, 'a body that carries no recoil plays none');
  assert.equal(plain.status().hit, null);
});

test('MWNPC4b the death: one of the deaths by the roll, over everything, held at its stop; every other state reset and no longer refreshed - no swing, no cast, no recoil; a corpse met dead stands at its stop at once; revived, the idle again', async () => {
  const r = await body();
  r.setSheathed(false);
  r.readySpell(true);
  for (let i = 0; i < 60; i++) r.update(1 / 60, { pose: true });
  r.readySpell(false);
  for (let i = 0; i < 60; i++) r.update(1 / 60, { pose: true });
  assert.equal(r.status().upperName, 'WeaponEquipped', 'fists up: a body that can swing and cast');
  r.hurt(0);
  assert.equal(r.die(1), true);
  let s = r.status();
  assert.equal(s.dead, true);
  assert.equal(s.death.group, 'death2', 'roll 1: the second');
  assert.equal(s.hit, null, 'the recoil reset');
  assert.equal(s.idleGroup, null, 'the idle reset');
  r.update(1 / 60, { pose: true });
  assert.equal(r.status().posedGroup, 'death2', 'the death wins');
  for (let i = 0; i < 60; i++) r.update(1 / 60, { pose: true });
  s = r.status();
  assert.ok(Math.abs(s.death.time - s.death.stop) < 1e-6, `played to its stop (${s.death.time} of ${s.death.stop})`);
  assert.equal(s.posedGroup, 'death2', 'and HELD there - playDeath\'s autodisable is false');
  assert.equal(s.idleGroup, null, 'the idle never comes back to a dead body');
  assert.equal(r.hurt(0), false, 'the dead recoil from nothing');
  assert.equal(r.attack('StrikeDown'), null, 'nor swing');
  assert.equal(r.castSpell(0), false, 'nor cast');
  // the ladder: an action under the death (the unequip a sheathe plays - OpenMW's playDeath note: "these animations
  // wouldn't actually be visible (due to the Death animation's priority being higher)") never shows
  r.setSheathed(true);
  r.update(1 / 60, { pose: true });
  assert.equal(r.status().upperName, 'Unequipping', 'an unequip under it');
  assert.equal(r.status().posedGroup, 'death2', 'and the death still wins every bone');
  const src = rd('src/combat/fpArm.js');
  assert.ok(src.includes('const state = deathState || actionState || hitState || movementState || jumpState || idleState;'), 'the ladder: death, the weapon, the recoil, then the rest');
  assert.ok(src.includes('poseSource = deathState ? deathSource : actionState ? actionSource : hitState ? hitSource : (movementState'), 'and the winner\'s own tracks');
  r.revive();
  s = r.status();
  assert.equal(s.dead, false);
  assert.equal(s.death, null);
  assert.ok(s.idleGroup, 'revived: the idle again');
  for (let i = 0; i < 60; i++) r.update(1 / 60, { pose: true });   // the sheathe it took dead plays out
  assert.equal(r.status().posedGroup, r.status().idleGroup, 'and it stands in it');
  const corpse = await body();
  corpse.die(0, { startPoint: 1 });
  const c = corpse.status().death;
  assert.equal(c.group, 'death1');
  assert.ok(Math.abs(c.time - c.stop) < 1e-6, 'met dead: at the stop, no death played');
  const plain = await body(null);
  assert.equal(plain.die(0), false, 'a body that carries no death plays none');
  assert.equal(plain.status().dead, true, 'and is dead all the same - it stops where it stood');
  assert.equal(plain.hurt(0), false);
});

/** a rig that records its reactions and the weapon doors _arm opens */
const reacting = (rigs) => () => {
  const r = { mode: 'first', calls: [], skinned: false,
    attach() {}, async build() { await flush(); return { ok: true }; },
    canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; },
    thirdActive: () => r.mode === 'third' && r.skinned,
    update(dt, opts) { if (opts?.pose !== false) r.skinned = true; },
    drawThird() { return r.thirdActive(); }, unload() { r.unloaded = true; },
    hurt(roll) { r.calls.push(['hurt', roll]); return true; },
    die(roll, opts) { r.calls.push(['die', roll, opts?.startPoint ?? 0]); return true; },
    revive() { r.calls.push(['revive']); },
    setSheathed(v) { r.calls.push(['sheathe', v]); },
    attack(strike) { r.calls.push(['attack', strike]); return true; },
    castSpell() { r.calls.push(['cast']); return true; },
  };
  rigs.push(r);
  return r;
};
const toScene = (p) => [p.x, p.y, p.z];
const actor = (id, shown = {}) => ({ id, name: '', told: true, look: { race: 'Breton', gender: 'male', faceIndex: 0, items: [] }, shown: { x: 0, y: 0, z: -3, yaw: 0, pitch: 0, mv: 0, wd: 1, an: 0, as: 0, cn: 0, ...shown } });

test('MWNPC4c PeerBodies plays the reactions off the pose: a new hit count a recoil, a death its death, a corpse met dead at its stop, the living revived; the dead take no weapon, no swing, no cast; out of sight re-latched; a wire peer\'s pose plays none', async () => {
  const rigs = [];
  const pb = new PeerBodies({ renderer: {}, createRig: reacting(rigs), buildOpts: () => ({}), now: () => 1000 });
  const step = async (list) => { pb.sync(list, toScene, 1 / 60, [0, 0, 0]); await settle(); };
  for (let i = 0; i < 4; i++) await step([actor('a', { ht: 5 })]);
  const r = rigs[0];
  assert.deepEqual(r.calls.filter((c) => c[0] !== 'sheathe'), [['revive']], 'met living: brought back (nothing on a living rig) - the count it was born with is not a recoil');
  r.calls.length = 0;
  await step([actor('a', { ht: 6 })]);
  assert.deepEqual(r.calls.filter((c) => c[0] === 'hurt'), [['hurt', 6]], 'a new count: a recoil, its roll the count');
  r.calls.length = 0;
  await step([actor('a', { ht: 6, dd: 3, an: 1 })]);
  assert.deepEqual(r.calls, [['die', 2, 0]], 'the death, played from its start - and no weapon door, no swing');
  r.calls.length = 0;
  await step([actor('a', { ht: 9, dd: 3, an: 2, cn: 1 })]);
  assert.deepEqual(r.calls, [], 'dead: no recoil, no weapon, no swing, no cast');
  await step([actor('a', { ht: 9, dd: 0, an: 2, cn: 1 })]);
  assert.deepEqual(r.calls.slice(0, 1), [['revive']], 'standing again: revived');
  assert.equal(r.calls.some((c) => c[0] === 'attack' || c[0] === 'cast' || c[0] === 'hurt'), false, 'and what it missed dead is not replayed');
  r.calls.length = 0;
  // out of sight: a death there is a corpse on the way back, not a death replayed
  await step([]);
  await step([actor('a', { ht: 12, dd: 1, an: 2, cn: 1 })]);
  assert.deepEqual(r.calls.filter((c) => c[0] === 'die' || c[0] === 'hurt'), [['die', 0, 1]], 'back from its linger dead: at the stop, and no recoil for what happened out of sight');
  // met dead
  const rigs2 = [];
  const pb2 = new PeerBodies({ renderer: {}, createRig: reacting(rigs2), buildOpts: () => ({}), now: () => 1000 });
  for (let i = 0; i < 4; i++) { pb2.sync([actor('b', { dd: 2 })], toScene, 1 / 60, [0, 0, 0]); await settle(); }
  assert.deepEqual(rigs2[0].calls.filter((c) => c[0] === 'die'), [['die', 1, 1]], 'met dead: the corpse, at its stop');
  // a wire peer's pose carries neither field
  const rigs3 = [];
  const pb3 = new PeerBodies({ renderer: {}, createRig: reacting(rigs3), buildOpts: () => ({}), now: () => 1000 });
  for (let i = 0; i < 4; i++) { pb3.sync([actor('c')], toScene, 1 / 60, [0, 0, 0]); await settle(); }
  pb3.sync([actor('c', { an: 1 })], toScene, 1 / 60, [0, 0, 0]);
  assert.equal(rigs3[0].calls.some((c) => c[0] === 'die' || c[0] === 'hurt'), false, 'a peer is never hit nor killed by its pose');
  assert.ok(rigs3[0].calls.some((c) => c[0] === 'attack'), 'and swings as before');
});

test('MWNPC4d the lane: the NPCs as synthetic peers under the tier\'s caps - Off stands none, an unknown tier the default, a tier change a new lane; their ids never a peer\'s; the pose off the actor; an actor with no look or feet not offered', async () => {
  assert.equal(NPC_BODY_TIERS.off, null);
  assert.equal(NPC_BODIES_DEFAULT, 'near');
  assert.ok(NPC_BODY_TIERS.all.max > NPC_BODY_TIERS.near.max && NPC_BODY_TIERS.all.range > NPC_BODY_TIERS.near.range);
  assert.equal(npcPeerId('foe', 7), 'npc:foe:7');
  assert.deepEqual(npcShown({ feet: [1, 2, 3], yaw: 0.5, moving: true, running: true, drawn: true, swings: 4, strike: 2, casts: 1, castRate: 3, hits: 2, dead: 1 }),
    { x: 1, y: 2, z: 3, yaw: 0.5, pitch: 0, mv: 2, wd: 1, an: 4, as: 2, cn: 1, cr: 3, ht: 2, dd: 1 });
  assert.deepEqual(npcShown({ feet: [NaN, 0, 0] }), { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, as: 0, cn: 0, cr: 0, ht: 0, dd: 0 }, 'nothing known: standing, unhurt');
  let tier = 'near';
  const rigs = [];
  const lane = createNpcBodies({ renderer: {}, tier: () => tier, createRig: reacting(rigs), now: () => 1000 });
  const frame = async (actors) => { lane.begin(); for (const a of actors) lane.stand('folk', a); lane.end(1 / 60, [0, 0, 0]); await settle(); };
  const folk = Array.from({ length: 20 }, (_, i) => ({ id: i, look: { race: 'Breton', gender: 'male', faceIndex: 0, items: [] }, feet: [0, 0, -2 - i] }));
  for (let i = 0; i < 30; i++) await frame([...folk, { id: 'nolook', feet: [0, 0, -1] }, { id: 'nofeet', look: folk[0].look }]);
  assert.equal(lane.offered, 20, 'an actor with no look or no feet is not offered');
  assert.equal(lane.tier, 'near');
  assert.equal(rigs.length, NPC_BODY_TIERS.near.max, 'the tier\'s cap, not the peers\' eight');
  assert.equal(lane.has('folk', 0), true, 'the nearest stands');
  assert.equal(lane.has('folk', 19), false, 'past the cap: its host draws its own billboard');
  assert.equal(lane.has('foe', 0), false, 'another lane\'s actor of the same id is another actor');
  tier = 'off';
  await frame(folk);
  assert.equal(lane.tier, 'off');
  assert.equal(lane.has('folk', 0), false, 'off: none stands');
  assert.equal(rigs.every((r) => r.unloaded), true, 'every body the lane stood let go');
  tier = 'nonsense';
  await frame(folk);
  assert.equal(lane.tier, NPC_BODIES_DEFAULT, 'an unknown tier stands under the default');
  lane.destroy();
  assert.equal(lane.has('folk', 0), false);
  assert.equal(lane.tier, null);
});

test('MWNPC4e one build queue on the page: two lanes on the gate build one body after the other; a lane given none keeps its own; every lane the hosts stand passes it', async () => {
  const order = [];
  let open = null;
  const slow = (tag) => () => ({ attach() {}, async build() { order.push(`${tag}+`); await new Promise((r) => { if (tag === 'peer') open = r; else r(); }); order.push(`${tag}-`); return { ok: true }; },
    canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode: () => true, thirdActive: () => false, update() {}, drawThird: () => false, unload() {} });
  const peers = new PeerBodies({ renderer: {}, createRig: slow('peer'), buildOpts: () => ({}), now: () => 1000, gate: BODY_BUILD_GATE });
  const npcs = new PeerBodies({ renderer: {}, createRig: slow('npc'), buildOpts: () => ({}), now: () => 1000, gate: BODY_BUILD_GATE });
  peers.sync([actor('p')], toScene, 1 / 60, [0, 0, 0]);
  await settle();
  npcs.sync([actor('npc:folk:1')], toScene, 1 / 60, [0, 0, 0]);
  await settle();
  assert.deepEqual(order, ['peer+'], 'the NPC\'s build waits on the peer\'s');
  open();
  await settle();
  assert.deepEqual(order, ['peer+', 'peer-', 'npc+', 'npc-'], 'and runs after it');
  // without a gate, an instance's queue is its own (the tests' instances, and any lane a host forgets - pinned below)
  const order2 = [];
  const mk = (tag) => () => ({ attach() {}, async build() { order2.push(tag); await new Promise(() => {}); }, canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode: () => true, thirdActive: () => false, update() {}, drawThird: () => false, unload() {} });
  new PeerBodies({ renderer: {}, createRig: mk('x'), buildOpts: () => ({}), now: () => 1000 }).sync([actor('x')], toScene, 1 / 60, [0, 0, 0]);
  new PeerBodies({ renderer: {}, createRig: mk('y'), buildOpts: () => ({}), now: () => 1000 }).sync([actor('y')], toScene, 1 / 60, [0, 0, 0]);
  await settle();
  assert.deepEqual(order2, ['x', 'y'], 'two ungated instances build side by side');
  // every PeerBodies the source stands passes the page's gate
  const sites = [];
  for (const f of ['src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js', 'src/characters/npcBodies.js', 'src/world/familyBodies.js']) {
    for (const m of rd(f).matchAll(/new PeerBodies\(\{[^\n]*/g)) sites.push([f, m[0]]);
  }
  assert.equal(sites.length, 3, 'the family\'s (and the card table\'s), the peers\', the NPCs\'');
  for (const [f, s] of sites) assert.ok(s.includes('gate: BODY_BUILD_GATE'), `${f}: ${s.slice(0, 80)}`);
});
