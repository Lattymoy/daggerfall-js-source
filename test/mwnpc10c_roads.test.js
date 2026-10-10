// MWNPC10c (2026-10-10, the MW-NPC arc's tenth slice - bible/04-Characters/Morrowind-NPCs.md section 15c): THE LIVING
// WORLD'S PEOPLE IN THEIR MORROWIND BODIES - the roads' parties and their foes, and the residents the day has inside a
// building. Both draw through world/travellerSprites.js, so its lane stands them all: each dressed as its sprite shows it
// (characters/rosterBodies.js residentLook - a class's sprite its class's look and blade in their own race, a still
// picture its kind's garments, the rest their own outfit), walking as it walks, each strike begun a blow, the fallen
// dead, on the ground only. And a roster's class one now carries its class's blade by DFU's own roll
// (foeBodies.js rosterLook). Pinned on the real sprites over a recording lane, and the draw points by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rosterLook } from '../src/characters/foeBodies.js';
import { residentLook, rosterActor } from '../src/characters/rosterBodies.js';
import { FOLK_OUTFITS } from '../src/characters/folkBodies.js';
import { PEOPLE_WARDROBE } from '../src/characters/peopleBodies.js';
import { GUARD_TEXTURE } from '../src/characters/mobilePerson.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { WEAPONS_ENUM as W } from '../src/combat/enemyEquipment.js';
import { createTravellerSprites } from '../src/world/travellerSprites.js';
import { familyRoomSprites } from '../src/world/familyBodies.js';
import { corpseLook } from '../src/scenes/livingRoads.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 0));
const ordered = (s, parts, msg) => {
  let at = -1;
  for (const p of parts) { const i = s.indexOf(p, at + 1); assert.ok(i > at, `${msg}: ${p}`); at = i; }
};

test('MWNPC10c-1 a roster\'s class one carries its class\'s blade by DFU\'s roll - a broadsword to a longsword or a two-hander, iron or steel, in the right hand, off its seed; its race its own where it is given one', () => {
  const blades = new Set(), mats = new Set();
  for (let s = 0; s < 80; s++) {
    const l = rosterLook({}, { mobileType: M.Thief, seed: s });
    const w = l.items.filter((it) => it.group === 'Weapons');
    assert.equal(w.length, 1, 'one blade');
    assert.equal(w[0].equipSlot, EQUIP_SLOTS.RightHand);
    blades.add(w[0].templateIndex); mats.add(w[0].material);
  }
  const one = [W.Broadsword, W.Saber, W.Longsword], two = [W.Claymore, W['Dai-Katana'], W.Mace, W.Flail, W.Warhammer, W['Battle Axe']];
  assert.ok([...blades].every((t) => one.includes(t) || two.includes(t)), `DFU's two ranges only (${[...blades]})`);
  assert.ok(one.some((t) => blades.has(t)) && two.some((t) => blades.has(t)), 'both variants');
  assert.ok(blades.has(W.Longsword) && blades.has(W['Battle Axe']), 'each range to its last');
  assert.deepEqual([...mats].sort(), [0, 1], 'iron and steel');
  assert.equal(rosterLook({}, { mobileType: M.Thief, seed: 3, race: 'Nord' }).race, 'Nord', 'its own race');
  const rec = {};
  const l = rosterLook(rec, { mobileType: M.Thief, seed: 3, race: 'Nord' });
  assert.notEqual(rosterLook(rec, { mobileType: M.Thief, seed: 3, race: 'Redguard' }), l, 'another race another look');
  const a = rosterActor({}, { id: 'x', look: l, feet: [0, 0, 0], yaw: 0, drawn: false });
  assert.equal(a.drawn, false, 'one in their clothes carries nothing drawn');
  assert.equal(rosterActor({}, { id: 'y', look: l, feet: [0, 0, 0], yaw: 0 }).drawn, true);
});

const res = (o) => ({ id: 'L7.t3', cls: null, sex: 'male', gender: 0, race: 'Redguard', archive: 381, face: 5, name: 'Ann', job: 'farmer', ...o });

test('MWNPC10c-2 residentLook: a class\'s sprite its class\'s look in their own race and sex; a foe its creature, none unmatched; a still courtier a noble\'s garments; the rest their own outfit - the watch\'s plate on duty, his own clothes off it', () => {
  const armed = residentLook({}, res({ cls: M.Warrior, sex: 'female', gender: 1, race: 'Nord' }));
  assert.deepEqual([armed.race, armed.gender], ['Nord', 'female']);
  for (let i = 0; i < 8; i++) for (const race of ['Breton', 'Redguard']) assert.equal(residentLook({}, res({ id: `L1.t${i}`, cls: M.Thief, race })).race, race, 'their own race, never the Bay\'s draw');
  assert.ok(armed.items.some((it) => it.group === 'Weapons') && armed.items.some((it) => it.group === 'Armor'), 'the warrior\'s blade and steel');
  assert.deepEqual(residentLook({}, { id: 'e:0', cls: M.Rat, sex: 'male', name: '' }), { creature: ['rat'] });
  assert.equal(residentLook({}, { id: 'e:1', cls: M.GiantBat, sex: 'male', name: '' }), null);
  const court = residentLook({}, res({ job: 'courtier', sex: 'female', gender: 1 }), { still: true });
  assert.deepEqual(court.items.map((it) => it.templateIndex), PEOPLE_WARDROBE.noble.female, 'a noblewoman\'s blouse, skirt and boots');
  assert.ok(court.items.every((it) => PEOPLE_WARDROBE.noble.dyes.includes(it.dye)), 'in the nobles\' dyes');
  const courtDyes = new Set(Array.from({ length: 12 }, (_, i) => residentLook({}, res({ id: `L2.t${i}`, job: 'courtier' }), { still: true }).items[0].dye));
  assert.ok(courtDyes.size > 1, `a court not one colour (${[...courtDyes]})`);
  assert.equal(court.race, 'Redguard');
  const priest = residentLook({}, res({ job: 'priest' }), { still: true });
  assert.equal(priest.items[0].templateIndex, PEOPLE_WARDROBE.priest.male[0], 'a priest at the door in his robes');
  const beggar = residentLook({}, res({ job: 'beggar' }), { still: true });
  assert.deepEqual(beggar.items.map((it) => it.templateIndex), FOLK_OUTFITS.male[0], 'a beggar the street\'s outfit');
  const own = residentLook({}, res({ archive: 383 }));
  assert.deepEqual(own.items.map((it) => it.templateIndex), FOLK_OUTFITS.male[2], 'their own outfit, as their sprite (the third variant)');
  assert.deepEqual([own.race, own.gender], ['Redguard', 'male']);
  assert.deepEqual(residentLook({}, res({ archive: 383 })), own, 'one person wherever drawn - their id\'s seed, never a spawn\'s roll');
  const dyes = new Set(Array.from({ length: 12 }, (_, i) => residentLook({}, res({ id: `L7.t${i}` })).items[0].dye));
  assert.ok(dyes.size > 2, `a street not one colour (${[...dyes]})`);
  assert.notDeepEqual(residentLook({}, res({ job: 'courtier' })), residentLook({}, res({ job: 'courtier' }), { still: true }), 'a courtier walking is in their outfit');
  const duty = residentLook({}, res({ archive: GUARD_TEXTURE, guard: true, job: 'guard' }));
  assert.ok(duty.items.some((it) => it.group === 'Armor'), 'on duty: the watch\'s plate');
  const off = residentLook({}, res({ archive: GUARD_TEXTURE, civvies: 381, guard: true, job: 'guard' }));
  assert.ok(!off.items.some((it) => it.group === 'Armor'), 'off duty: his own clothes');
});

function recordingLane() {
  const L = { offered: [], destroyed: 0, offsets: [], standing: new Set() };
  Object.assign(L, {
    begin() { L.offered.length = 0; },
    stand(lane, a) { L.offered.push({ lane, id: a.id, look: a.look, dead: a.dead, drawn: a.drawn, moving: a.moving, swings: a.swings, yaw: a.yaw, feet: a.feet }); },
    end() {}, has(lane, id) { return L.standing.has(id); }, draw() {}, drawVeiled() {}, destroy() { L.destroyed++; }, offsetAll(o) { L.offsets.push(o); },
  });
  return L;
}

test('MWNPC10c-3 the sprites: each body on the ground offered as its sprite shows it - the walker in their outfit undrawn, the armed in their class drawn, a foe its creature, the fallen dead, the courtier at home a noble; its feet its billboard\'s; each strike begun a blow; none unmatched, none under the Overworld; a new person a new id; cleared, the lane let go', async () => {
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }) };
  const renderer = { textures: new Map(), createBillboardBatch: () => ({ origin: [0, 0, 0] }), destroyBillboardBatch() {} };
  let lane = null;
  const sp = createTravellerSprites({ renderer, getTexture: async () => tex, uploadRecordFrame() {}, laneName: 'roads', wantBodies: () => true, makeBodies: () => (lane = recordingLane()) });
  const walker = { key: 'w', res: res({ id: 'w' }), feet: [0, 0, 0], yaw: 0.5, moving: true, distM: 5 };
  const armed = { key: 'a', res: res({ id: 'a', cls: M.Warrior }), feet: [1, 0, 0], yaw: 1, moving: false, distM: 5, striking: false };
  const foe = { key: 'f', res: { id: 'f', cls: M.Rat, sex: 'male', name: '' }, feet: [2, 0, 0], yaw: 0, moving: false, distM: 5, striking: false, talk: false };
  const bat = { key: 'b', res: { id: 'b', cls: M.GiantBat, sex: 'male', name: '' }, feet: [3, 0, 0], yaw: 0, moving: false, distM: 5, talk: false };
  const fallen = { key: 'd', res: res({ id: 'd' }), feet: [4, 0, 0], yaw: 0, moving: false, distM: 5, talk: false, flat: corpseLook() };
  const court = { key: 'c', res: res({ id: 'c', job: 'courtier' }), feet: [5, 0, 0], yaw: 0, moving: false, distM: 5, flat: { archive: 182, record: 1 } };
  const list = [walker, armed, foe, bat, fallen, court];
  sp.sync(list); await settle(); sp.sync(list);
  sp.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  const by = (k) => lane.offered.find((o) => o.id === sp.bodyOf(k).id);
  assert.equal(lane.offered.length, 5, 'all but the bat');
  assert.ok(!by('b'), 'a foe with no match keeps its sprite');
  assert.equal(by('w').drawn, false, 'the walker carries nothing drawn');
  assert.equal(by('w').moving, true);
  assert.equal(by('w').yaw, 0.5);
  assert.deepEqual(by('w').look, residentLook({}, walker.res), 'in their own outfit');
  assert.equal(by('a').drawn, true, 'the armed in their class\'s sprite, the blade out');
  assert.deepEqual(by('f').look, { creature: ['rat'] });
  assert.ok(by('d').dead > 0, 'the fallen dead');
  assert.equal(by('a').dead, 0);
  assert.deepEqual(by('c').look.items.map((it) => it.templateIndex), PEOPLE_WARDROBE.noble.male, 'the courtier at home a noble');
  assert.equal(by('c').dead, 0, 'a still picture someone talks to is alive');
  assert.equal(by('a').feet, sp.bodyOf('a').batch.origin, 'its feet its billboard\'s');
  assert.ok(lane.offered.every((o) => o.lane === 'roads'));
  // the strike edge: held a blow, again after a rest another
  for (const s of [true, true, false, true]) { armed.striking = s; sp.sync(list); sp.drawBodies({}, null, null, [0, 0, 0], 1 / 60); }   // a frame each
  assert.equal(by('a').swings, 2, 'each strike begun one blow');
  // its billboard casts alone where its body stands
  lane.standing.add(sp.bodyOf('a').id);
  sp.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  assert.equal(sp.bodyOf('a').batch.castOnly, true);
  assert.equal(sp.bodyOf('w').batch.castOnly, false);
  // under the Overworld: the bands' sprites, no bodies
  sp.sync(list, { ground: false, fade: 1, dt: 1 });
  sp.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  assert.equal(lane.offered.length, 0, 'none under the Overworld');
  assert.equal(sp.bodyOf('a').batch.castOnly, false, 'AUDIT MW-NPC C3: and every sprite drawn - the one whose body stood on the ground no longer cast-only');
  // another person at the same key: a new body, a new id
  sp.sync(list);
  const was = sp.bodyOf('w').id;
  const next = [{ ...walker, res: res({ id: 'w2' }) }];
  sp.sync(next); await settle(); sp.sync(next);
  assert.notEqual(sp.bodyOf('w').id, was, 'a new person a new id');
  sp.offsetBodies([3, 0, 3]);
  assert.deepEqual(lane.offsets, [[3, 0, 3]], 'the origin moves them');
  sp.clear();
  assert.equal(lane.destroyed, 1, 'cleared: the lane let go');
});

test('MWNPC10c-4 the room\'s sprites hand their bodies on (the line\'s are the family\'s); the draw points: the road\'s with the person billboards, the room\'s before the building\'s pass; the origin moves the road\'s', () => {
  const calls = [];
  const inner = { drawBodies: (...a) => calls.push(a), sync() {}, batches: () => [], persons: () => [], clear() {} };
  familyRoomSprites(inner, { begin() {}, end() {}, stand: () => false, batches: () => [], clear() {}, size: 0 }).drawBodies('c', 'p', 'v', 'e', 0.5);
  assert.deepEqual(calls, [['c', 'p', 'v', 'e', 0.5]]);
  const w = rd('src/scenes/world.js');
  ordered(w, ['livePersonBatches.push(...livingRoads.batches());', 'livingRoads.drawBodies(canvas, proj, view, mwv.eye, townTalk.overlayActive ? 0 : dt);', 'if (livePersonBatches.length) renderer.drawBillboards(livePersonBatches, camRight, bbUp);'], 'the road\'s before the person billboards');
  assert.ok(w.includes("createTravellerSprites({ renderer, getTexture, uploadRecordFrame, living: _livingIndoorsDoor, laneName: 'room' })"), 'the room a lane of its own');
  assert.ok(w.includes('drawLivingBodies: (canvas, proj, view, eye, dt) => { livingIndoors?.drawBodies(canvas, proj, view, eye, dt); },'));
  assert.ok(w.includes('livingRoads?.offsetBodies(r.offset);'));
  ordered(rd('src/scenes/worldModes.js'), ['host.drawLivingBodies?.(canvas, proj, view, mwv.eye, dt);', 'renderer.drawBillboards([...interiorCtx.billboardBatches,', 'const livingInside = host.livingBillboards?.() ?? [];'], 'the room\'s before the building\'s pass');
  assert.ok(rd('src/scenes/livingRoads.js').includes('drawBodies(canvas, proj, view, eye, dt) { deps.sprites.drawBodies?.(canvas, proj, view, eye, dt); },'));
  assert.ok(rd('src/scenes/livingRoads.js').includes('offsetBodies(o) { deps.sprites.offsetBodies?.(o); },'));
  assert.ok(rd('src/scenes/livingIndoors.js').includes('drawBodies(canvas, proj, view, eye, dt) { deps.sprites.drawBodies?.(canvas, proj, view, eye, dt); },'));
});
