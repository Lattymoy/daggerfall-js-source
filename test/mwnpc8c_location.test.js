// MWNPC8c (2026-10-09, the MW-NPC arc's eighth slice - bible/04-Characters/Morrowind-NPCs.md section 13c): THE
// LOCATION'S AND THE QUESTS' STANDING PEOPLE IN THEIR BODIES. exterior.js batched its street people with its scenery
// (one batch per archive/record for the whole city), so each now stands in a batch of their own and is offered before the
// flats are walked; and a quest's stood person (worldModes.js standQuestFlatIn - a batch each already) is read as the
// click reads them and offered on the room's lane, or the dungeon's through drawPeople's `also`. Pinned by source, as
// the street's and the dungeon's are (a location or a quest needs the game's own files): the batches, the offers, the
// look never before the faction table, an item's and a foe's stand no one, the rider's feet where its marker carried it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ordered = (s, needles, what) => {
  let at = -1;
  for (const n of needles) {
    const i = s.indexOf(n, at + 1);
    assert.ok(i > at, `${what}: "${n.slice(0, 70)}" ${i < 0 ? 'missing' : 'out of order'}`);
    at = i;
  }
};

test('MWNPC8c-a the location (exterior.js): a person out of the scenery groups and into a batch of their own (none for an editor flat); offered before the flats are walked, read as the buildings\' are', () => {
  const e = rd('src/scenes/exterior.js');
  ordered(e, ['if (flat.editor) continue;', 'if (!_people.has(flat)) {', "const key = drawnFlat(flat.archive, flat.record).join('_');", 'flatGroups.get(key).push([flat.x + b.originX,'], 'a person not grouped');
  assert.ok(!e.includes('_people.has(flat) ? { noCover: true } : null'), 'no person left in a group to mark');
  ordered(e, ['for (const flat of exteriorNpcFlats) {', 'const person = { ...pn, width: size.w, height: size.h, standBatch: null };', 'if (!flat.editor) {', 'uploadRecord(da, dr);',
    'const batch = renderer.createBillboardBatch(da, dr, size, centers);', 'batch._box = flatBatchAabb(centers, size);', 'armFlatAnim(batch, t, da, dr, flatAnims, uploadRecordFrame);',
    'billboardBatches.push(batch);', 'person.standBatch = batch;', 'exteriorNpcs.push(person);'], 'their own batch');
  assert.ok(e.includes('if (!dict) return null;   // never before the faction table: asked again'));
  assert.ok(e.includes('raceOfCurrentRegion: () => REGION_RACES[dfLocation.regionIndex] + 1'), 'the location\'s region race');
  ordered(e, ['const _peopleOn = standPeople.frame();', 'for (const pn of exteriorNpcs) {', 'const look = _peopleOn ? standLook(pn) : null;',
    'if (look) standPeople.offer(personActor(pn, look, pn._mwFeet ??= [pn.x, pn.y, pn.z], eye, townTalk.overlayActive ? 0 : dt), pn.standBatch);',
    'else pn.standBatch.castOnly = false;', 'standPeople.draw(canvas, proj, view, eye, townTalk.overlayActive ? 0 : dt);', '_visBatches.length = 0; _castBatches.length = 0;',
    'renderer.drawBillboards(_visBatches, camRight, UP_Y);'], 'offered, drawn, then the flats walked and drawn');
});

test('MWNPC8c-b the quests\' stands: a person read as the click reads them (an item\'s or a foe\'s stand no one, never before the table); offered where the marker carried them, on the room\'s lane and the dungeon\'s', () => {
  const m = rd('src/scenes/worldModes.js');
  ordered(m, ['const questStandLook = (s, buildingKey) => {', 'if (s._mwLook !== undefined) return s._mwLook;', 'if (!person) return null;   // asked again',
    'if (person.isPerson !== true) return (s._mwLook = null);', 'if (!dict || !questBridge) return null;   // never before the faction table',
    'const data = { ...questStandNpcData(s, person, buildingKey), billboardArchiveIndex: s.archive, billboardRecordIndex: s.record };',
    'return personLook(s, data, dict.get(person.factionId ?? 0) ?? null);'], 'the reading');
  ordered(m, ['const questStandNpcData = (s, person, buildingKey) => {', 'const questStandLook = (s, buildingKey) => {', 'const npcData = () => questStandNpcData(s, person, buildingKey);'],
    'one NPCData builder (DQ1), the body\'s reading and the click\'s');
  ordered(m, ['const offerQuestStands = (list, lane, on, buildingKey, eye, dt) => {', 'if (!s.batch) continue;', 'const look = on && s.active !== false && !s.dead ? questStandLook(s, buildingKey) : null;',
    'if (!look) { s.batch.castOnly = false; continue; }', 'f[0] = o ? s.x + o[0] : s.x; f[1] = o ? s.y + o[1] : s.y; f[2] = o ? s.z + o[2] : s.z;', 'lane.offer(personActor(s, look, f, eye, dt), s.batch);'], 'the offer');
  ordered(m, ['offerQuestStands(questFlats, peopleBodies, _peopleOn, interiorBuilding?.buildingKey ?? 0, mwv.eye, dt);', 'peopleBodies.draw(canvas, proj, view, mwv.eye, dt);', 'renderer.drawBillboards([...interiorCtx.billboardBatches,'], 'the room\'s');
  ordered(m, ['const offerDungeonQuestStands = (lane, on, eye, dt) => offerQuestStands(dungeonQuestFlats, lane, on, 0, eye, dt);', 'dungeonCtx.drawPeople?.(canvas, proj, view, mwv.eye, dt, offerDungeonQuestStands);', 'renderer.drawBillboards([...dungeonCtx.billboardBatches,'], 'the dungeon\'s');
  const d = rd('src/scenes/dungeonContext.js');
  ordered(d, ['drawPeople(canvas, proj, view, eye, dt, also = null) {', 'else pn.standBatch.castOnly = false;', 'also?.(_peopleLane, on, eye, dt);', '_peopleLane.draw(canvas, proj, view, eye, dt);'], 'the dungeon\'s lane takes them before it draws');
});
