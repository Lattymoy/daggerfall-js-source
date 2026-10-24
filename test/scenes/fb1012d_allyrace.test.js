// FB1012d ALLY-RACE (bible/01-Overview/bugs/Field-Bugs-2026-10-12d.md; the owner, 2026-10-12: "companions when morrowind
// attached switches character race"). A companion's Morrowind body drew its race, face, head, hair and clothes off the
// STAND - characters/foeBodies.js foeSeed's species and where it stood (its number and feet, a dungeon's marker) - and the
// companion layer (scenes/crewAshore.js) stands a fresh body at every door, dungeon, fast travel, load and sweep: the same
// Breton hand walked out of the next door a Nord, a Wood Elf through the one after. A revenant drew its own afresh at
// each return too, so the one that knelt and swore rose from its portal another race.
//
// Pinned through the real producers: the crew's party (systems/naval/crewCompanions.js) and the sworn's
// (systems/revenant/revenantCompanions.js) stood by the real layer in real foe pools (scenes/exteriorFoes.js - the street's and a
// building's, one factory), a door a new pool, a load a new party and layer off the save; a revenant born off a real
// pool's body (systems/revenant/revenant.js revenantDeed), its returns stood as the hosts stand them (revenantSpawnOptions), its
// oath and its sworn stands; the wire between two pools. The look read is the lane's own (foeActor's).

import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};
const { createExteriorFoes } = await import('../../src/scenes/exteriorFoes.js');
const { createCrewAshore, companionPerson } = await import('../../src/scenes/crewAshore.js');
const { createCompanions } = await import('../../src/systems/naval/crewCompanions.js');
const { foeActor, foeSeed, ownPerson } = await import('../../src/characters/foeBodies.js');
const N = await import('../../src/systems/revenant/revenant.js');
const RC = await import('../../src/systems/revenant/revenantCompanions.js');
const S = await import('../../src/systems/companionSlots.js');
const { setPref, _resetForTests } = await import('../../src/systems/uiPrefs.js');
const { MOBILE_TYPES } = await import('../../src/characters/mobile/mobileTypes.js');

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/^﻿/, '');
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); };
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
/** a pool as the hosts build one; every CLASS*.CFG a blank 74-byte career (audit39_worldstate's) */
const poolRig = () => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes: async () => new Uint8Array(74),
  getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: { level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5,
});
/** the place world.js's companionPlace hands the layer for a pool (its `standIn`) */
const placeOf = (pool) => ({ key: pool, spawn: (mobile, feet, o) => pool.spawnFoe(mobile, feet, { yaw: o.yaw, gender: o.gender, allied: true, loose: true, transient: true }), remove: (f) => pool.removeFoe(f), has: (f) => pool.foes.includes(f) });
const netAs = (id) => ({ selfId: () => id, room: () => 'world:3,12', onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
/** what the body chooser draws a person as - the lane's own look (foeActor) */
const who = (rec) => { const l = foeActor(rec).look; return { race: l.race, gender: l.gender, faceIndex: l.faceIndex, npc: l.npc }; };
/** the same record drawn by the stand's law alone (no person of its own) - what every stand drew before */
const standDraw = (rec) => foeActor({ ...rec, person: undefined, _mwSeed: undefined, _mwLook: undefined, _mwLookSlots: undefined, _mwLookKey: undefined, _mwLookSeed: undefined }).look.race;

/** The layer standing `party` through `doors` places (each a new pool), the leader stepping on between them. */
async function throughDoors(party, doors, { layer = null } = {}) {
  const L = { feet: [0, 0, 0], yaw: 0, grounded: true };
  let place = null;
  const ly = layer ?? createCrewAshore({ party: () => party, place: () => place, leader: () => L, now: () => 0 });
  const stands = [];
  for (let d = 0; d < doors; d++) {
    const pool = createExteriorFoes(poolRig());
    place = placeOf(pool);
    L.feet = [d * 13.7, 0, d * 5.3]; L.yaw = d * 0.7;
    ly.frame(); await settle();
    stands.push(pool.foes.filter((f) => f.companion != null && !f.dead));
  }
  return { stands, layer: ly };
}

test('FB1012d ALLY-RACE the crew\'s hand ashore is ONE PERSON: through eight doors and a load his body is his own race, sex, face, head and clothes - the stand\'s law drew him three races - two hands two people, and the room sees the man I see (mutants: the stamp gone; the person ignored by the seed; the key unread; the stamp read only off a revenant)', async () => {
  S._resetCompanionSlotsForTests();
  const party = createCompanions();
  party.take(7, { name: 'Aldric', role: 'Bosun', mobile: MOBILE_TYPES.Warrior, gender: 'female' }, 0);
  party.take(7, { name: 'Borin', role: 'Gunner', mobile: MOBILE_TYPES.Warrior, gender: 'male' }, 0);
  const [aldric, borin] = party.party;
  const { stands } = await throughDoors(party, 8);
  assert.ok(stands.every((s) => s.length === 2), 'both stood at every door');
  const first = new Map(stands[0].map((rec) => [rec.companion, who(rec)]));
  for (const [d, here] of stands.entries()) {
    for (const rec of here) {
      const c = rec.companion === '7:Aldric' ? aldric : borin;
      assert.equal(rec.person, companionPerson(c), `door ${d}: the layer stamps ${c.name}'s person`);
      assert.equal(foeSeed(rec), rec.person, `door ${d}: and his body is drawn by it`);
      assert.deepEqual(who(rec), first.get(rec.companion), `door ${d}: ${c.name} is the same person`);
    }
  }
  assert.equal(first.get('7:Aldric').gender, 'female', 'her sex her record\'s'); assert.equal(first.get('7:Borin').gender, 'male');
  // the bug, measured on the same stands: the stand's own law drew Aldric as more than one race
  const drawn = new Set(stands.map((s) => standDraw(s.find((r) => r.companion === '7:Aldric'))));
  assert.ok(drawn.size >= 2, `the stand's law alone drew her ${[...drawn].join(', ')} - every door a new person`);
  assert.notEqual(companionPerson(aldric), companionPerson(borin), 'two hands, two people');
  assert.equal(companionPerson({ boat: 7, name: 'Aldric' }), companionPerson(aldric), 'his person is his boat and his name - nothing the party re-rolls');
  // A LOAD: the party off its save, a new layer - the same man
  const loaded = createCompanions(JSON.parse(JSON.stringify(party.snapshot())));
  const again = await throughDoors(loaded, 2);
  for (const rec of again.stands.flat()) assert.deepEqual(who(rec), first.get(rec.companion), `after a load ${rec.companion} is the same person`);
  // EVERY MACHINE: my frame carries his person as the foe's seed (`ls`), and the room stands him as I do
  const A = createExteriorFoes(poolRig()), B = createExteriorFoes(poolRig());
  A.setNet(netAs('mac-0001')); B.setNet(netAs('bob-0002'));
  const L = { feet: [5, 0, 5], yaw: 0, grounded: true };
  const one = createCompanions(); one.take(7, { name: 'Aldric', role: 'Bosun', mobile: MOBILE_TYPES.Warrior, gender: 'female' }, 0);
  createCrewAshore({ party: () => one, place: () => placeOf(A), leader: () => L, now: () => 0 }).frame(); await settle();
  const mate = A.foes.find((f) => f.companion != null);
  const fa = A.foesFrame(true);
  assert.equal(fa.f.find((r) => r.i === mate.seq)?.ls, companionPerson(aldric), 'the wire carries his person');
  B.applyFoes('mac-0001', fa); await settle();
  const there = B.foes.find((f) => f.puppet === 'mac-0001');
  assert.ok(there, 'stood on bob\'s screen');
  assert.deepEqual(who(there), first.get('7:Aldric'), 'and bob sees the person I see');
});

function freshFeud() {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
}
const me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-allyrace', level: 8, health: 100, maxHealth: 100 };

test('FB1012d ALLY-RACE a revenant is the person it was born as: the body that did the deed keeps its race, every return, the oath and the sworn one through every door and load are that one person; a save keeps it, an older record its id\'s (mutants: the birth off the id; the stamp without it; the save dropping it; the record\'s person unread; the sworn member without it)', async () => {
  freshFeud(); RC.setRetinuePlayer(me);
  const pool = createExteriorFoes(poolRig());
  const foe = await pool.spawnFoe(MOBILE_TYPES.Warrior, [3, 0, 4], { gender: 'female', feetGiven: true });
  foe.entity.champion = 'mighty'; foe.entity.unquiet = true; foe.entity.level = 6;   // a champion of the floor's level, marked (UNQUIET, Revenants.md section 46): one that may become a revenant
  const born = who(foe), seed = foeSeed(foe);
  const r = N.revenantDeed(me, foe.entity, 'felled', { mobileType: foe.mobileType, gender: foe.gender, rec: foe, ally: 'Aldric', rolls: () => 0 });
  assert.ok(r, 'it felled my companion: a revenant');
  assert.equal(r.person, seed, 'its person is the body it did the deed in');
  assert.equal(foe.entity.revenant.person, seed, 'stamped on the body still standing');
  assert.deepEqual(who(foe), born, 'which does not change before my eyes');
  // ITS RETURNS - stood as every host stands one (revenantSpawnOptions over applyRevenant's stamp), anywhere, any number
  let last = null;
  for (const [i, at] of [[1, [40, 0, -12]], [2, [-7, 0, 90]], [3, [210, 0, 33]]]) {
    const p = createExteriorFoes(poolRig());
    const back = last = await p.spawnFoe(r.mobileType, at, { feetGiven: true, ...N.revenantSpawnOptions(r, me.level) });
    assert.equal(ownPerson(back), r.person, `return ${i}: its record's person`);
    assert.deepEqual(who(back), born, `return ${i}: the same person`);
  }
  // a dungeon's record (its layout marker the stand's law) - the stamp wins there too
  assert.equal(foeSeed({ mobileType: r.mobileType, marker: [12, 0, 7], entity: { revenant: foe.entity.revenant } }), r.person, 'a dungeon return: its person over the marker');
  // THE OATH: sworn, stood by the companion layer at my side through doors - the one that knelt. PIN MOVED (AUDIT FB1019
  // C1, C2 - bible/01-Overview/audits/Audit-Field-Bugs-2026-10-19.md): the body its returns replaced is LEFT for good and
  // swears nothing in its name; the one that kneels is its latest
  assert.ok(!N.revenantSpared(me, foe.entity, { state: 'with' }), 'the body a later stand replaced swears nothing');
  assert.ok(N.revenantSpared(me, last.entity, { state: 'with' }), 'sworn');
  const sworn = RC.revenantParty();
  assert.equal(sworn.party[0].person, r.person, 'the sworn member carries its person');
  const { stands, layer } = await throughDoors(sworn, 4);
  for (const [d, here] of stands.entries()) {
    assert.equal(here.length, 1, `door ${d}: it stands`);
    assert.equal(foeSeed(here[0]), r.person, `door ${d}: drawn by its own person`);
    assert.deepEqual(who(here[0]), born, `door ${d}: the person that knelt`);
  }
  layer.clear();
  // A SAVE: the record read back keeps it; an older record without one is its id's, the same every load
  const back = N.mergeRevenants([JSON.parse(JSON.stringify(r))], [])[0];
  assert.equal(back.person, r.person, 'the save keeps its person');
  const older = JSON.parse(JSON.stringify(r)); delete older.person;
  const o1 = N.mergeRevenants([older], [])[0], o2 = N.mergeRevenants([JSON.parse(JSON.stringify(older))], [])[0];
  assert.ok(Number.isInteger(o1.person) && o1.person >= 0 && o1.person <= 0xffffffff, 'an older record is given one');
  assert.equal(o1.person, o2.person, 'its id\'s - the same at every load');
  assert.equal(N.revenantPerson(older), o1.person, 'the one home answers it');
  assert.equal(N.revenantPerson({ id: older.id, person: 7 }), 7, 'and a kept one is the kept one');
});

test('FB1012d ALLY-RACE THE ONE SEAM AND THE FOUR HOSTS: every companion body is stood by the layer, which stamps its person and is the only writer of one; the street (world.js), a building (worldModes.js\'s pool, the one factory) and a dungeon (dungeonContext.js\'s loose stand) stand through it; exterior.js stands none, and its revenants\' returns take their stamp through its pool as every foe host\'s do', () => {
  const ashore = rd('src/scenes/crewAshore.js');
  assert.match(ashore, /rec\.companion = k;\n\s*rec\.person = companionPerson\(c\);/, 'the layer stamps his person as it names him');
  // the sweep: no other module writes a person onto a record
  const writers = ['src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js', 'src/scenes/exterior.js', 'src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js', 'src/scenes/naval/navalCrew.js', 'src/scenes/crewAshore.js']
    .filter((p) => /\b(?:rec|f|nf|foe)\.person\s*=/.test(rd(p)));
  assert.deepEqual(writers, ['src/scenes/crewAshore.js'], 'one stamp, the layer\'s');
  const w = rd('src/scenes/world.js');
  assert.match(w, /const standIn = \(pool\) => \(mobile, feet, o\) => pool\.spawnFoe\(mobile, feet, \{ yaw: o\.yaw, gender: o\.gender, allied: true, loose: true, transient: true \}\);/, 'world.js: the street and a building stand him through the pool');
  assert.match(w, /if \(mode === 'exterior'\) return \{ key: exteriorFoes, spawn: standIn\(exteriorFoes\)/, 'world.js: the street');
  assert.match(w, /const pool = modes\?\.interiorPool\?\.\(\);\n\s*return pool \? \{ key: pool, spawn: standIn\(pool\)/, 'worldModes.js\'s building, through world.js\'s place');
  assert.match(w, /spawn: \(mobile, feet, o\) => d\.spawnLooseFoe\(mobile, feet, \{ yawRad: o\.yaw, allied: true, gender: o\.gender \}\),/, 'dungeonContext.js\'s loose stand');
  assert.match(w, /const crewAshore = createCrewAshore\(\{\n\s*party: \(\) => \(navalOn\(\) \? naval\?\.companions \?\? null : null\),\n\s*place: companionPlace,/, 'the crew through the layer');
  assert.match(w, /const revenantAshore = createCrewAshore\(\{\n\s*party: \(\) => \(playerSpawned \? _revenantParty : null\),/, 'the sworn through the layer');
  assert.match(rd('src/scenes/worldModes.js'), /interiorPool\(\) \{ return mode === 'interior' && interiorCtx \? interiorFoes : null; \},/, 'worldModes.js hands its pool to the layer');
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /if \(seeded && \(full \|\| f\._lsSent === undefined\)\) \{ r\.ls = foeSeed\(f\); f\._lsSent = r\.ls; \}/, 'dungeonContext.js streams the seed foeSeed answers - the person');
  assert.equal(dc.split('if (e.revenant && !puppet) applyRevenant(entity, e.revenant, { turned: !!e.turned });').length, 3, 'dungeonContext.js: both builds stamp a revenant');
  assert.match(rd('src/scenes/exteriorFoes.js'), /if \(revenant && !puppet\) applyRevenant\(entity, revenant, \{ turned \}\);/, 'the street\'s and a building\'s pool stamps a revenant');
  const ext = rd('src/scenes/exterior.js');
  assert.ok(!ext.includes('createCrewAshore'), 'exterior.js (the bench) stands no companion');
  assert.match(ext, /\.\.\.\(hit\.revenant \? revenantSpawnOptions\(hit\.revenant, effectiveLevel\(playerEntity\)\) : \{\}\),/, 'exterior.js: a revenant\'s return through its pool (the stamp applyRevenant writes)');
  assert.match(rd('src/systems/revenant/revenant.js'), /const revenantStamp = \(r\) => \(\{[^\n]*person: revenantPerson\(r\)[,}][^\n]*\}\);/, 'the stamp carries its person');   // PIN MOVED (UNQUIET, Revenants.md section 46): the Dread rides the stamp after it
});
