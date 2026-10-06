// LEGACY7 part four (2026-10-06, bible/06-Systems/Legacy-Arc.md section 10b): THE LINE IN ITS OWN BODY - the departure
// LEGACY-HOME recorded and named LEGACY7's ("their own race and kit, the way an online peer is drawn"). The look the
// record keeps (systems/legacy/family.js memberLook, written by scenes/legacyHost.js at every write, dropped at a death),
// the resident that carries it (household.js residentOf), the layers that draw it (world/familyBodies.js over the REAL
// net/remotePlayers.js on a fake renderer), the room's split of its talk seats, and the world host's wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { memberLook, foundFamily, readFamily, personOf, familyRng, MODELS, LEGACY_MOD, addChild, recordDeath } from '../src/systems/legacy/family.js';
import { residentOf } from '../src/systems/legacy/household.js';
import { createLegacyHost } from '../src/scenes/legacyHost.js';
import { createFamilyBodies, familyRoomSprites, familyShown, familyPeerId } from '../src/world/familyBodies.js';
import { RemotePlayers } from '../src/net/remotePlayers.js';
import { _resetModSaveData, modSaveRecords } from '../src/systems/modSaveData.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const settle = async (n = 10) => { for (let i = 0; i < n; i++) await new Promise((r) => { setImmediate(r); }); };
const LOOK = { race: 'DarkElf', gender: 'female', faceIndex: 3, class: 'Nightblade', eo: 4, items: [{ templateIndex: 116, group: 'Armor', equipSlot: 5, material: 3 }, { templateIndex: 1, group: 'Spells', equipSlot: 2 }], junk: 1 };

test('LEGACY7 part four the look the record keeps: the hello\'s own law - race, sex, face, class, the worn kit - and never an Eye Of The Beholder set; nothing that is no look', () => {
  assert.deepEqual(memberLook(LOOK), { race: 'DarkElf', gender: 'female', faceIndex: 3, class: 'Nightblade', items: [{ templateIndex: 116, group: 'Armor', equipSlot: 5, material: 3 }] }, 'an item of no doll group is dropped, as the hello drops it');
  assert.equal('eo' in memberLook(LOOK), false, 'how a player chose to be seen is not how the house remembers its own');
  assert.equal(memberLook(null), null);
  assert.equal(memberLook('a coat'), null);
  // read back: kept to the law; a look of no shape is none
  const fam = foundFamily({ name: 'Ysolde Hlaalu', gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, level: 3, characterId: 'c1', chargenDone: true, items: [] }, { id: 'fam-k1-abc123', model: MODELS.bloodline });
  personOf(fam, 1).look = memberLook(LOOK);
  const sib = addChild(fam, null, { rng: familyRng(2) }).person;
  sib.look = 'not a look';
  const back = readFamily(JSON.parse(JSON.stringify(fam)));
  assert.deepEqual(personOf(back, 1).look, memberLook(LOOK));
  assert.equal(personOf(back, sib.id).look, undefined, 'a look of no shape is dropped');
  // a death drops it: the dead stand nowhere
  recordDeath(back, 1, { at: 5, cause: 'fell' });
  assert.equal(personOf(back, 1).look, undefined);
});

const mem = () => { const m = new Map(); return { map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const ent = (cid) => ({
  name: 'Ysolde Hlaalu', gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
  level: 9, characterId: cid, chargenDone: true, health: 40, maxHealth: 40, items: [], wagonItems: [],
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)),
});

test('LEGACY7 part four the host writes what the one played wears at every write - the save\'s, the death\'s - and the resident wears it, rebuilt when it changes', () => {
  _resetModSaveData();
  _resetModSettings();
  let look = LOOK;
  const storage = mem();
  const host = createLegacyHost({
    entity: ent('c1'), storage: () => storage, tab: () => mem(), on: () => true, online: () => false, now: () => 100, own: () => 0,
    here: () => null, town: () => null, nearestTown: () => null, gold: () => 0, say: () => {}, boot: () => {}, search: () => '',
    loadCharacter: () => false, saveNow: () => true, hasSave: () => true, inFight: () => false, rng: familyRng(5),
    look: () => look, livingWorld: () => true,
  });
  setModSetting(LEGACY_MOD, 'Family.Siblings Probability', 0);
  host.found(MODELS.enduring);
  _resetModSettings();
  modSaveRecords();   // a save: the host writes the one played
  const me = host.current();
  assert.deepEqual(me.look, memberLook(LOOK));
  look = { ...LOOK, items: [] };
  modSaveRecords();
  assert.deepEqual(me.look.items, [], 'the newest save\'s');
  look = null;
  modSaveRecords();
  assert.deepEqual(me.look, memberLook({ ...LOOK, items: [] }), 'no look to hand (a build that composes none) keeps the last one');
  // the resident of the town carries it; one never played wears the town's outfit
  const res = residentOf(host.family, me, { mapId: 7, buildingKey: 9 });
  assert.deepEqual(res.look, me.look);
  const sib = addChild(host.family, null, { rng: familyRng(2) }).person;
  assert.equal(residentOf(host.family, sib, { mapId: 7, buildingKey: 9 }).look, null);
  // a member played before, parked in a house of the line, stands in the town in what they wore - and a new look is a
  // new resident, never the one kept for the old
  const f = host.family;
  f.houses = [{ regionIndex: 1, mapId: 7, buildingKey: 9, location: 'Gothway Garden', by: sib.id }];
  sib.characterId = 'c2';
  sib.parked = { mapId: 7, buildingKey: 9 };
  sib.look = memberLook(LOOK);
  const first = host.residentsOf(7).find((r) => r.legacy?.personId === sib.id);
  assert.deepEqual(first?.look, memberLook(LOOK));
  assert.equal(host.residentsOf(7).find((r) => r.legacy?.personId === sib.id), first, 'the same resident while nothing they are made of changed');
  sib.look = memberLook({ ...LOOK, class: 'Knight' });
  const second = host.residentsOf(7).find((r) => r.legacy?.personId === sib.id);
  assert.notEqual(second, first);
  assert.equal(second.look.class, 'Knight', 'dressed again in the newer look');
});

/** A renderer the peer layers make their sprites on, and a texture for any archive. */
function fakeRenderer() {
  const made = [], gone = [];
  return { made, gone, textures: new Map(), uploadTexture() {}, createBillboardBatch: (archive, record, size) => { const b = { archive, record, size, origin: null }; made.push(b); return b; }, destroyBillboardBatch: (b) => gone.push(b) };
}
const tex = (archive) => ({ archive, getFrameCount: () => 5, getSize: () => ({ w: 60, h: 100 }), getScale: () => ({ x: 0, y: 0 }) });
const quietly = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };

test('LEGACY7 part four the street\'s layers: one of the line with a look stands in their own body - their class\'s sprite at their feet, as an online peer is drawn - where one without stays the town\'s; a Morrowind body stands where this client has one, and no sprite beside it', async () => {
  const renderer = fakeRenderer();
  const dolls = new RemotePlayers({ renderer, deps: { getTexture: async (a) => tex(a), uploadRecordFrame: () => {}, audio: null }, compose: async () => null });
  const heights = new Map();
  const bodiesSeen = [];
  const bodies = { sync: (peers, toScene) => { bodiesSeen.push(peers.map((p) => [p.id, toScene(p.shown)])); }, heightOf: (id) => heights.get(id) ?? 0, draw() {}, offsetAll() {}, destroy() {} };
  const fam = createFamilyBodies({ dolls, bodies });
  const kin = { id: 'Ffam-k1-abc123.2', look: memberLook(LOOK) };
  const town = { id: 'L123.4' };
  await quietly(async () => {
    for (let i = 0; i < 4; i++) {
      fam.begin();
      assert.equal(fam.stand(kin, [10, 1, 20], 0.5, true), true, 'drawn here - the street draws its own sprite for them no more');
      assert.equal(fam.stand(town, [11, 1, 21], 0, false), false, 'no look: the town\'s outfit, as before');
      fam.end(1 / 60, [0, 1, 0]);
      await settle();
    }
  });
  assert.equal(fam.size, 1);
  const entry = dolls._batches.get(familyPeerId(kin.id));
  assert.equal(entry?.kind, 'mobile', 'their class\'s sprite');
  assert.deepEqual(entry.batch.origin, [10, 1, 20], 'at their feet, in the scene\'s own frame');
  assert.deepEqual(fam.batches(), [entry.batch]);
  assert.deepEqual(bodiesSeen.at(-1), [[familyPeerId(kin.id), [10, 1, 20]]], 'the bodies asked first');
  // a Morrowind body stands for them: no sprite beside it
  heights.set(familyPeerId(kin.id), 1.8);
  fam.begin(); fam.stand(kin, [10, 1, 20], 0.5, true); fam.end(1 / 60, [0, 1, 0]);
  assert.equal(dolls._batches.has(familyPeerId(kin.id)), false);
  // the pose the layers read; the origin moved
  assert.deepEqual(familyShown([1, 2, 3], NaN, false), { x: 1, y: 2, z: 3, yaw: 0, mv: 0 });
  assert.deepEqual(familyShown([1, 2, 3], 0.5, true), { x: 1, y: 2, z: 3, yaw: 0.5, mv: 1 }, 'walking: the move bit the layers stride on');
  heights.clear();
  await quietly(async () => { for (let i = 0; i < 3; i++) { fam.begin(); fam.stand(kin, [10, 1, 20], 0.5, true); fam.end(1 / 60, [0, 1, 0]); await settle(); } });
  const offs = [];
  bodies.offsetAll = (o) => offs.push(o);
  fam.offsetAll([5, 0, -5]);
  assert.deepEqual(dolls._batches.get(familyPeerId(kin.id)).batch.origin, [15, 1, 15]);
  assert.deepEqual(offs, [[5, 0, -5]]);
  fam.clear();
  assert.equal(dolls._batches.size, 0, 'everything freed');
});

test('LEGACY7 part four the room\'s sprites: the line\'s to their own bodies with talk seats of their own (the room\'s shape, kept while they stand), the rest to the room\'s sprites as before', () => {
  const synced = [];
  const sprites = { sync: (list) => synced.push(list.map((m) => m.key)), batches: () => ['room-batch'], persons: () => [{ person: { living: { id: 'L1' } }, pos: [0, 0, 0] }], bodyOf: () => null, clear() { synced.push('clear'); }, size: 1 };
  const stood = [];
  let cleared = 0;
  const family = { begin() { stood.length = 0; }, stand: (res, feet, yaw, moving) => (res.look ? (stood.push([res.id, feet, yaw, moving]), true) : false), end() {}, batches: () => ['kin-batch'], clear() { cleared++; }, size: 0 };
  const door = { refuses: () => null };
  const room = familyRoomSprites(sprites, /** @type {any} */ (family), door);
  const kin = { id: 'Ffam-k1-abc123.2', name: 'Ilse Hlaalu', face: 4, archive: 385, look: memberLook(LOOK) };
  const list = [{ key: 'in:Ffam-k1-abc123.2', res: kin, feet: [1, 0, 2], yaw: 1, moving: false }, { key: 'in:L1', res: { id: 'L1' }, feet: [3, 0, 4], yaw: 0, moving: true }];
  room.sync(list, { dt: 0.1, eye: [0, 1, 0] });
  assert.deepEqual(synced, [['in:L1']], 'the rest to the room\'s sprites');
  assert.deepEqual(stood, [['Ffam-k1-abc123.2', [1, 0, 2], 1, false]]);
  assert.deepEqual(room.batches(), ['room-batch', 'kin-batch']);
  const seats = room.persons();
  assert.equal(seats.length, 2);
  const seat = seats[1];
  assert.deepEqual([seat.person.nameNPC, seat.person.personFaceRecordId, seat.person.living.id, seat.person.living.town, seat.pos], ['Ilse Hlaalu', 4, kin.id, door, [1, 0, 2]]);
  assert.ok(Number.isInteger(seat.person._talkSeed));
  seat.person.pickpocketAttempted = true;
  room.sync(list, { dt: 0.1, eye: [0, 1, 0] });
  assert.equal(room.persons()[1].person.pickpocketAttempted, true, 'the same talk target while they stand');
  room.sync([list[1]], {});
  assert.equal(room.persons().length, 1, 'gone with them');
  room.sync(list, {});
  assert.equal(room.persons()[1].person.pickpocketAttempted, false, 'back again: met anew');
  room.clear();
  assert.equal(cleared, 1);
  assert.equal(synced.at(-1), 'clear');
});

test('LEGACY7 part four the world host\'s wiring: the street stands the line in its own bodies and hides their billboards; the room\'s sprites wrapped; the bodies drawn in the place they stood; the origin followed; the host handed the look', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const kin = person\.living\?\.res;\n\s*if \(kin\?\.look && \(familyStreet \?\?= makeFamilyBodies\(\)\)\.stand\(kin, batch\.origin, person\.yaw, person\.state === 'move'\)\) continue;\n\s*livePersonBatches\.push\(batch\);/);
  assert.match(w, /familyStreet\?\.begin\(\);/);
  assert.match(w, /if \(familyStreet\) \{ familyStreet\.end\(dt, cam\.pos\); livePersonBatches\.push\(\.\.\.familyStreet\.batches\(\)\); \}/);
  assert.match(w, /sprites: familyRoomSprites\(createTravellerSprites\(\{ renderer, getTexture, uploadRecordFrame, living: _livingIndoorsDoor \}\), \(familyRoom \?\?= makeFamilyBodies\(\)\), _livingIndoorsDoor\),/);
  assert.match(w, /\(_mode\(\) === 'interior' \? familyRoom : _mode\(\) === 'exterior' \? familyStreet : null\)\?\.draw\(canvas, \{ proj, view, eye \}\);/);
  assert.match(w, /familyStreet\?\.offsetAll\(r\.offset\);/);
  assert.match(w, /look: \(\) => composeLook\(playerEntity\),/);
  assert.match(w, /dolls: new RemotePlayers\(\{ renderer, deps: \{ fetchBytes, palette, getTexture, uploadRecordFrame \} \}\),/, 'no sound: a townsperson\'s steps are the town\'s');
});
