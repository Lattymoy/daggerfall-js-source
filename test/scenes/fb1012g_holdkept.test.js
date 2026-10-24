// FIELD BUGS 2026-10-12g HOLD-KEPT - "Housing items lost in storage": "2 day ago there was alot of lagging and my
// housing decorations didnt load ... the boxes i had put all my legendaries and rares along with some potions was gone,
// i relogged and checked but it stayed empty". Two ways a home's storage went out of reach for good: a house's own chest
// was its record's INDEX in the room's list, so a placement that did not stand moved every chest after it and dropped
// the last record (written over at the next save); and what a storage piece held stayed keyed to a piece the service no
// longer has (one taken away while the room looked empty), where no piece would ever stand for it again. The chest
// records (scenes/chestRecords.js), the room's taking of what an unserved piece held (decorRoom.js takeUnserved) and the
// host's wiring. bible/01-Overview/bugs/Field-Bugs-2026-10-12g.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chestIdentity, matchChests, CHEST_MATCH_REACH } from '../../src/scenes/chestRecords.js';
import { createDecorRoom } from '../../src/scenes/decor/decorRoom.js';
import { trs } from '../../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const O = [100, 10, -50];   // the building's origin in the visit's frame
const chest = (model, x, y, z) => ({ modelIdNum: model, matrix: trs(O[0] + x, O[1] + y, O[2] + z, 0, 0, 0), items: null });

test('HOLD-KEPT a chest that does not stand moves no record onto another chest, and leaves its own unmatched for the host to set down - the index law laid each record on the next chest and lost the last (mutants: the index for a named record; the model not compared; the reach unchecked; one chest taken twice)', () => {
  const A = chest(41116, 1, 0, 2), B = chest(41116, 3, 0, 2), C = chest(41815, 5, 0, 1), D = chest(41116, 1, 0, -3);
  const written = [A, B, C, D].map((c, i) => ({ key: `container:${i}`, items: [{ name: `thing ${i}` }], ...chestIdentity(c, O) }));
  assert.deepEqual(written[1].at, [3, 0, 2], 'where it stands in the building\'s frame');
  assert.equal(written[1].model, 41116);
  // this visit B's model did not stand: the room's list is A, C, D
  const visit = [chest(41116, 1, 0, 2), chest(41815, 5, 0, 1), chest(41116, 1, 0, -3)];
  const m = matchChests(written, visit, O);
  assert.equal(m.get(written[0]), visit[0]);
  assert.equal(m.get(written[1]), undefined, 'B\'s record has no chest this visit - never C\'s');
  assert.equal(m.get(written[2]), visit[1], 'C\'s on C');
  assert.equal(m.get(written[3]), visit[2], 'D\'s on D - by index it had no chest at all');
  // a chest a hair off where it was written is still that chest; past the reach it is not
  const near = matchChests([{ key: 'container:0', model: 41116, at: [1.3, 0, 2], items: [] }], [chest(41116, 1, 0, 2)], O);
  assert.equal(near.size, 1);
  const far = matchChests([{ key: 'container:0', model: 41116, at: [1 + CHEST_MATCH_REACH + 0.05, 0, 2], items: [] }], [chest(41116, 1, 0, 2)], O);
  assert.equal(far.size, 0);
  // another model standing where a record's chest stood is not that chest
  assert.equal(matchChests([{ key: 'container:0', model: 41116, at: [5, 0, 1], items: [] }], [chest(41815, 5, 0, 1)], O).size, 0, 'not its model');
  // two records of one model never share a chest
  const two = matchChests([{ key: 'container:0', model: 41116, at: [1, 0, 2] }, { key: 'container:1', model: 41116, at: [1.1, 0, 2] }], [chest(41116, 1, 0, 2)], O);
  assert.equal(two.size, 1);
});

test('HOLD-KEPT a record written before carries its index, as ever - onto a chest no named record took (mutants: the legacy pass gone; a named chest taken again)', () => {
  const visit = [chest(41116, 1, 0, 2), chest(41116, 3, 0, 2)];
  const legacy = [{ key: 'container:0', items: [{ name: 'a' }] }, { key: 'container:1', items: [{ name: 'b' }] }];
  const m = matchChests(legacy, visit, O);
  assert.equal(m.get(legacy[0]), visit[0]); assert.equal(m.get(legacy[1]), visit[1]);
  const mixed = [{ key: 'container:0', model: 41116, at: [3, 0, 2], items: [] }, { key: 'container:1', items: [{ name: 'old' }] }];
  const mm = matchChests(mixed, visit, O);
  assert.equal(mm.get(mixed[0]), visit[1], 'the named record finds its chest');
  assert.equal(mm.get(mixed[1]), undefined, 'and the legacy record whose index it holds is left for the host to set down');
  assert.equal(matchChests([{ key: 'shelf:0' }], visit, O).size, 0, 'a shelf is not a chest');
});

test('HOLD-KEPT the room hands over whole what a piece the service no longer has held, and keeps every served piece\'s (mutants: a served piece\'s taken; an unserved one\'s kept)', () => {
  const room = createDecorRoom({
    meshes: { getGpuMesh: async () => null, cpuModels: new Map() }, renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {}, drawMesh() {} },
    getTexture: async () => null, uploadRecord() {}, uploadRecordFrame() {}, flatAnims: () => null,
    collider: () => ({ addMesh() {}, removeBucket() {} }), origin: () => O, roomLights: () => [],
  });
  room.setItems({ box1: [{ name: 'Legendary Ring' }, { name: 'Potion' }], box2: [{ name: 'Rare Sword' }], gone: [{ name: 'Elixir' }] });
  const taken = room.takeUnserved([{ id: 'box1' }, { id: 'gone' }, { id: 'box2' }, { pos: [0, 0, 0] }]);
  assert.deepEqual(taken, [], 'every piece that held something is served');
  const back = room.takeUnserved([{ id: 'box2' }]);
  assert.deepEqual(back.map((it) => it.name).sort(), ['Elixir', 'Legendary Ring', 'Potion']);
  assert.equal(room.holdsAny('box1'), false, 'taken out of the record');
  assert.equal(room.holdsAny('box2'), true, 'a served piece keeps what it holds');
  assert.deepEqual(Object.keys(room.itemsSnapshot()), ['box2'], 'and the scene no longer writes the taken');
});

test('HOLD-KEPT the host: chest records say which chest, are matched by it, and an unmatched one\'s things are set down and said; the owner\'s list sets down what an unserved piece held - never while the room stands another layout\'s record apart (mutants: the identity unwritten; the index restore back; the set-down only for the crate; the layout guard lost)', () => {
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /\.\.\.chestIdentity\(c, buildingOrigin\(\)\),/);
  assert.match(wm, /const chestOf = matchChests\(data\.lootContainers, interiorCtx\.containers, buildingOrigin\(\)\);/);
  assert.match(wm, /const target = kind === 'shelf' \? interiorCtx\.shelves\?\.\[\+i\] : chestOf\.get\(c\);/);
  assert.match(wm, /if \(!target && kind === 'container' && c\.items\?\.length\) \{\n\s+const o = buildingOrigin\(\), f = player\.pos;\n\s+data\.droppedPiles = /);
  assert.match(wm, /if \(setDown\) say\(/);
  assert.match(wm, /if \(interiorHome\?\.own && !_sceneHeldForLayout\) decorSetDownHeld\(r\.data\.pieces\);/);
  assert.match(wm, /const items = interiorDecor\.takeUnserved\(served\);\n\s+if \(!items\.length\) return 0;\n\s+interiorDropped\.dropPile\(items, interiorDropFeet\(\)\);/);
});
