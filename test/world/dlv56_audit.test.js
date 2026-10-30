// AUDIT DLV5-6 (bible/01-Overview/audits/Audit-Delve-II.md section H): each finding of the cold audit of the curated
// blocks, pinned where it began - the quests read the blocks as laid (H1); the in-game path of the anchors, through the
// laws' own defaults (H2); a curated room its own room, the draw stable as records join (M3); no Hollow or zone hall
// spliced (M7); an anchor judged by its own ward's law, the way in and the fires (M9); and every mutant the audit found
// surviving. Held to fail under tools/mutants/dlv56.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curatedSlot, curatedLocation, curatedTakes, CURATED_CHANCE } from '../../src/world/dungeon/curatedSplice.js';
import { curatedBlockOf, curatedBlockName, curatedRecordError, curatedAnchors } from '../../src/world/dungeon/curatedBlocks.js';
import { CURATED_RECORDS } from '../../src/world/dungeon/curatedRecords.js';
import { dungeonLocationFor, dungeonRoomSize, relaidOnline } from '../../src/world/smallerDungeons.js';
import { delveSitePlan, DSITE, DSITE_SMALL } from '../../src/world/dungeon/delveSites.js';
import { dungeonFirePlan, DFIRE } from '../../src/world/dungeon/dungeonFires.js';
import { dungeonItemMarkerCount } from '../../src/systems/quest/place.js';
import { roomKeyFor } from '../../src/net/online.js';
import { isWorldRoom, dungeonRoomTag, spawnedHallMapId } from '../../src/net/wire.js';
import { notePlace } from '../../src/net/staffTeleport.js';
import { RDB_RESOURCE_TYPES } from '../../src/formats/blocksFile.js';
import { GLOBAL_SCALE } from '../../src/world/meshReader.js';
import { DUNGEON_TYPES } from '../../src/formats/mapsFile.js';
import { dungeonOf, seedFor } from '../scenes/delve/delveRig.mjs';
import { inWard, DELVE_WARD_PAD_M } from '../../src/net/delve/delveLaw.js';

const SIZES = { setting: false, medium: false, world: false };
const REC = Object.freeze({ id: 'test-hall', n: 7, base: 'N0000023.RDB', types: [DUNGEON_TYPES.Crypt], drop: [], add: [], anchors: [] });
/** A game-made crypt: a start, interior blocks and borders, its id `mapId`. */
const spawnOf = (mapId, o = {}) => ({
  name: 'spawn', spawned: true, hasDungeon: true, climate: { worldClimate: 231 }, mapTableData: { mapId, dungeonType: DUNGEON_TYPES.Crypt },
  dungeon: { recordElement: { header: { locationId: mapId } }, blocks: [
    { x: 0, z: 0, blockName: 'N0000001.RDB', isStartingBlock: true }, { x: 1, z: 0, blockName: 'N0000002.RDB', isStartingBlock: false },
    { x: -1, z: 0, blockName: 'N0000003.RDB', isStartingBlock: false }, { x: 0, z: 1, blockName: 'B0000001.RDB', isStartingBlock: false },
  ] },
  ...o,
});
const taking = (recs = CURATED_RECORDS) => [...Array(400).keys()].map((k) => k + 1).find((k) => curatedSlot(spawnOf(k), recs));
/** A laid block: `markers` its editor markers (the block's frame), at grid x. */
const laid = (name, x, { start = false, markers = [] } = {}) => ({ name, originX: x * 51.2, originZ: 0, isStartingBlock: start, layout: { waterLevel: 10000, markers: [...(start ? [{ record: 10, x: 5, y: 0, z: 5 }] : []), ...markers], startMarkers: start ? [{ x: 5, y: 0, z: 5 }] : [], flats: [] } });
const flatProbe = { floor: (p) => ({ y: p[1], ny: 1 }), room: () => ({ walls: [9, 9, 9, 9, 9, 9, 9, 9] }) };

test('AUDIT DLV5-6 H1 THE QUESTS READ THE BLOCKS AS LAID: the location as built carries the curated block, so a quest\'s markers are the made block\'s and never a replaced block\'s (2,156 of 2,232 replaced blocks held one); the dungeon whole its own (mutants: the splice in the layout alone)', () => {
  const id = taking(), loc = spawnOf(id), s = curatedSlot(loc, CURATED_RECORDS);
  const item = (n) => ({ rdbBlock: { objectRootList: [{ rdbObjects: Array.from({ length: n }, () => ({ type: RDB_RESOURCE_TYPES.Flat, resources: { flatResource: { textureArchive: 199, textureRecord: 18 } } })) }] } });
  const blocks = new Map([['N0000001.RDB', item(0)], ['N0000002.RDB', item(2)], ['N0000003.RDB', item(2)], [curatedBlockName(s.rec.n), item(5)]]);
  const getBlock = (n) => blocks.get(n) ?? null;
  assert.equal(dungeonItemMarkerCount(getBlock, dungeonLocationFor(loc, SIZES)), 2 + 5, 'the made block\'s five beside the kept block\'s two');
  assert.equal(dungeonItemMarkerCount(getBlock, dungeonLocationFor(loc, { ...SIZES, whole: true })), 4, 'whole: its own two blocks');
});

test('AUDIT DLV5-6 H2 THE ANCHORS IN THE GAME\'S OWN PATH: the site law and the fire law read a laid curated block\'s anchors by their defaults (curatedAnchors over the shipped records) - the dungeon context passes none (mutants: either default emptied)', () => {
  const rec = CURATED_RECORDS[0], a = rec.anchors[0];
  const near = { record: 19, x: a.at[0] + 3, y: a.at[1], z: a.at[2] };   // a treasure marker 3 m off the heart: a fire's candidate
  const blocks = [laid('N0000001.RDB', 0, { start: true }), laid(curatedBlockName(rec.n), 1, { markers: [near] }), laid('N0000002.RDB', 2), laid('N0000003.RDB', 3)];
  const plan = delveSitePlan({ blocks, probe: flatProbe, seed: 4 });
  assert.equal(plan.anchored, 1, 'the anchor stood by default');
  assert.deepEqual([plan.sites[0].kind, plan.sites[0].x, plan.sites[0].z], [a.kind, a.at[0] + 51.2, a.at[2]]);
  const held = dungeonFirePlan({ blocks, probe: flatProbe }), bare = dungeonFirePlan({ blocks, probe: flatProbe, anchors: [] });
  assert.equal(held.valid, bare.valid - 1, 'the fire law kept off it by default');
  assert.deepEqual(curatedAnchors(blocks, CURATED_RECORDS).map((x) => x.id), [rec.id]);
});

test('AUDIT DLV5-6 M3 A CURATED ROOM IS ITS OWN: the room\'s size word names the block (`full+1`), its tag `.c1` after the size\'s, the relay admits it and staff\'s notes read it as no whole dungeon; online the public room is relaid (a quest\'s things, laid whole, never stand there); a record joining a pool takes only the dungeons it outweighs (mutants: the tag unminted; the relay\'s room refused; the draw re-dealt)', () => {
  const id = taking(), built = dungeonLocationFor(spawnOf(id), SIZES), n = built.curated;
  assert.equal(dungeonRoomSize(built), `full+${n}`);
  assert.equal(dungeonRoomSize(spawnOf(id)), 'full', 'none taken: the size alone, the room it always had');
  assert.equal(roomKeyFor({ host: 'world', mode: 'dungeon', mapId: id, size: dungeonRoomSize(built) }), `dungeon:m${id}.c${n}`);
  assert.deepEqual(['medium+2', 'small+12', 'full+0', 'full+1000', 'toString+2', null].map(dungeonRoomTag), ['.m.c2', '.s.c12', '', '', '.c2', '']);
  assert.ok(isWorldRoom(`dungeon:m${id}.c${n}`) && isWorldRoom(`dungeon:m${id}.m.c${n}`) && !isWorldRoom(`dungeon:m${id}.c${n}.m`) && !isWorldRoom(`dungeon:m${id}.c0`));
  assert.equal(notePlace({ px: 10, py: 10, in: 1, rk: `dungeon:m${id}.c${n}` })?.whole, false, 'a staff note into a curated room builds it as the world does');
  assert.equal(notePlace({ px: 10, py: 10, in: 1, rk: `dungeon:m${id}` })?.whole, true);
  assert.equal(relaidOnline(spawnOf(id)), true);
  assert.equal(relaidOnline({ ...spawnOf(id), spawned: false }), false, 'Daggerfall\'s own, whole: the quest\'s room');
  // the draw: a record joining the pool moves only the dungeons where it outweighs the one they had
  const A = { ...REC, id: 'a-hall', n: 11 }, B = { ...REC, id: 'b-hall', n: 12 };
  let moved = 0, kept = 0;
  for (let k = 1; k <= 400; k++) {
    const one = curatedSlot(spawnOf(k), [A]), two = curatedSlot(spawnOf(k), [A, B]);
    assert.equal(!!one, !!two, `id ${k}: in or out by its own draw`);
    if (!one) continue;
    assert.equal(two.j, one.j, `id ${k}: the same slot`);
    if (two.rec.id === 'a-hall') kept++; else moved++;
  }
  assert.ok(kept > 0 && moved > 0, `some keep their block, some take the new one (${kept} / ${moved})`);
  assert.equal(curatedSlot(spawnOf(taking([A])), [B, A])?.rec.id, curatedSlot(spawnOf(taking([A])), [A, B])?.rec.id, 'the pool\'s order is no part of it');
  assert.equal(CURATED_CHANCE, 0.5);
});

test('AUDIT DLV5-6 M7 NO HOLLOW, NO ZONE HALL: a Super dungeon\'s Hollow stands no encounter, and a zone hall\'s room is its lane\'s law - neither takes a curated block; a spawn and a lair do (mutants: the tier unread; the hall unread)', () => {
  const id = taking();
  assert.equal(curatedTakes(spawnOf(id)), true);
  assert.equal(curatedTakes({ ...spawnOf(id), spawned: false, country: { dungeon: true } }), true, 'a lair past the Bay');
  assert.equal(curatedTakes({ ...spawnOf(id), superTier: true }), false);
  assert.equal(curatedLocation({ ...spawnOf(id), superTier: true }).curated, undefined);
  const hall = spawnedHallMapId(1500, 300);
  assert.equal(curatedTakes(spawnOf(hall)), false, 'a zone hall');
});

test('AUDIT DLV5-6 M9 AN ANCHOR BY ITS OWN WARD\'S LAW: a fire 9 m off stands a 3 m ward (the small room\'s 8) and not a 4 m one (12); the way in 15 m off the same (12 and 20) - as the lab\'s check judges it; the fire\'s reach is in three dimensions (mutants: the large law for every anchor; the start unread; the fire\'s height unread)', () => {
  const blocks = [laid('N0000001.RDB', 0, { start: true }), laid(curatedBlockName(7), 1), laid('N0000002.RDB', 2), laid('N0000003.RDB', 3)];
  const heart = [76.8, 0, 25.6], anchor = (r) => ({ kind: 'hold', r, at: heart, vault: [heart[0] - (r - 0.6), 0, heart[2]], id: 'x' });
  const stands = (r, o) => delveSitePlan({ blocks, probe: flatProbe, seed: 4, anchors: [anchor(r)], ...o }).anchored;
  assert.deepEqual([3, 4].map((r) => stands(r, { fires: [[heart[0] + 9, 0, heart[2]]] })), [1, 0]);
  assert.deepEqual([DSITE_SMALL.fireM, DSITE.fireM, DSITE_SMALL.startM, DSITE.startM], [8, 12, 12, 20]);
  const startNear = [laid('N0000001.RDB', 1, { start: true }), laid(curatedBlockName(7), 1), laid('N0000002.RDB', 2), laid('N0000003.RDB', 3)];
  startNear[0].layout.startMarkers = [{ x: 25.6 + 15, y: 0, z: 25.6 }];
  assert.deepEqual([3, 4].map((r) => delveSitePlan({ blocks: startNear, probe: flatProbe, seed: 4, anchors: [anchor(r)] }).anchored), [1, 0], 'the way in 15 m off');
  // the campfires: in three dimensions - a candidate 9 m off and 10 m over (its ring 7 to 11 m out: 12.2 m and more) stands,
  // as the site law measures; the block's centre 29 m off
  const a = { ...anchor(4), at: [51.2 + 5, 0, 5], vault: [51.2 + 5 + 3.4, 0, 5] }, over = { record: 19, x: 14, y: 10, z: 5 };
  const withOver = [laid('N0000001.RDB', 0, { start: true }), laid(curatedBlockName(7), 1, { markers: [over] }), laid('N0000002.RDB', 2), laid('N0000003.RDB', 3)];
  assert.equal(dungeonFirePlan({ blocks: withOver, probe: flatProbe, anchors: [a] }).valid, dungeonFirePlan({ blocks: withOver, probe: flatProbe, anchors: [] }).valid, 'a storey up is past the reach');
  assert.equal(DFIRE.anchorM, DSITE.fireM);
});

test('AUDIT DLV5-6 THE ANCHOR AS DESIGNED: its own ward and vault, and it stands where the count wants none (a dungeon of two blocks) (mutants: the vault the heart; the ward the large one; the count\'s early answer)', () => {
  const blocks = [laid('N0000001.RDB', 0, { start: true }), laid(curatedBlockName(7), 1)];
  const anchor = { kind: 'litany', r: 3, at: [76.8, 0, 25.6], vault: [79.2, 0, 25.6], id: 'x' };
  const plan = delveSitePlan({ blocks, probe: flatProbe, seed: 2, anchors: [anchor] });
  assert.equal(plan.sites.length, 1, 'stood though the count is spent');
  assert.deepEqual([plan.sites[0].r, plan.sites[0].vault], [3, [79.2, 0, 25.6]]);
});

/** A base: chains through `previous` and a flat's `next`, two flats of one archive. */
function chained() {
  const U = (m) => Math.round(m / GLOBAL_SCALE);
  const model = (position, x, act) => ({ position, xPos: U(x), yPos: 0, zPos: U(20), type: RDB_RESOURCE_TYPES.Model, resources: { modelResource: { xRotation: 0, yRotation: 0, zRotation: 0, modelIndex: 0, actionResource: act }, flatResource: null, lightResource: null } });
  const flat = (position, archive, record, x, extra = {}) => ({ position, xPos: U(x), yPos: 0, zPos: U(20), type: RDB_RESOURCE_TYPES.Flat, resources: { flatResource: { textureArchive: archive, textureRecord: record, nextObjectOffset: 0, action: 0, ...extra }, modelResource: null, lightResource: null } });
  return { name: 'N0000023.RDB', position: 0, rdbBlock: { modelReferenceList: [{ modelIdNum: 41300, description: '' }], objectRootList: [{ rdbObjects: [
    model(100, 20, { nextObjectOffset: 0, previousObjectOffset: 300, flags: 0 }), model(150, 20.4, { nextObjectOffset: 0, previousObjectOffset: 0, flags: 0 }),
    flat(300, 210, 0, 20.2), flat(400, 210, 1, 20.3), flat(500, 210, 0, 20.6, { action: 3 }), flat(600, 210, 0, 20.7, { nextObjectOffset: 150 }),
  ] }] } };
}

test('AUDIT DLV5-6 THE DROP GUARD WHOLE: what a model\'s `previous` names is kept, a flat that acts is kept, what a flat\'s `next` names is kept, and a flat drop takes its record alone (mutants: `previous` unread; a flat\'s next unread; the record unread)', () => {
  const kept = (drop) => curatedBlockOf(chained(), { ...REC, drop }).rdbBlock.objectRootList[0].rdbObjects.map((o) => o.position);
  assert.deepEqual(kept([{ flat: [210, 0], at: [20.4, 0, 20], r: 2 }]), [100, 150, 300, 400, 500, 600], 'every 210.0 near is held: one a model\'s `previous` names, one that acts, one at the head of a chain - and the 210.1 is no 210.0');
  assert.deepEqual(kept([{ flat: [210, -1], at: [20.4, 0, 20], r: 2 }]), [100, 150, 300, 500, 600], 'any record: the 210.1, which nothing holds, goes');
  assert.deepEqual(kept([{ model: 41300, at: [20.4, 0, 20], r: 2 }]), [100, 150, 300, 400, 500, 600], 'the model a flat\'s `next` names, and the one whose `previous` names a flat, both held');
});

test('AUDIT DLV5-6 THE LAW\'S OTHER RULES: a vault in the block, a rotation of three numbers, a model id under a million, a drop\'s reach within the block, the start never the slot wherever it lies (mutants: each rule unread; the start by its index)', () => {
  const bad = (o) => curatedRecordError({ ...REC, ...o });
  const a = { kind: 'hold', at: [20, 0, 20], r: 4, vault: [16.6, 0, 20] };
  assert.match(bad({ anchors: [{ ...a, vault: [60, 0, 20] }] }), /a heart and a vault in the block/);
  assert.match(bad({ add: [{ model: 41300, at: [1, 1, 1], rot: [0, 90] }] }), /rot in degrees/);
  assert.match(bad({ add: [{ model: 1_000_000, at: [1, 1, 1] }] }), /^add: a model id/);
  assert.match(bad({ drop: [{ marker: 'foe', at: [1, 1, 1], r: 52 }] }), /^drop: a point in the block and a radius/);
  const startLast = (id) => ({ ...spawnOf(id), dungeon: { ...spawnOf(id).dungeon, blocks: [{ blockName: 'N0000002.RDB' }, { blockName: 'N0000003.RDB' }, { blockName: 'N0000001.RDB', isStartingBlock: true }] } });
  for (let id = 1; id <= 200; id++) { const s = curatedSlot(startLast(id), CURATED_RECORDS); if (s) assert.notEqual(s.j, 2, `id ${id}: never the start, at the list's end`); }
});

test('AUDIT DLV5-6 THE LAB\'S CHECK IS THE HOST\'S LAW: `landing` stands a ward where the site law would and names the rule it breaks; `firstFloor` the floor nearest the first ward, a step past every ward and on its storey (its heart would wake it at the boot); the bench\'s `?elite` an Elite clone (mutants: the small law unread; the rule unnamed; the ward unread; the nearest unsorted; the storey unread; elite unread)', async () => {
  const D = dungeonOf(seedFor('hold'));
  try {
    const c = 25.6;
    assert.deepEqual(D.host.landing([c, 0, c], 4), { ok: true, y: 0 });
    assert.deepEqual(D.host.landing([c, 0, c - 16.5], 3), { ok: true, y: 0 }, '3.5 m off the wall: a small ward stands');
    assert.equal(D.host.landing([c, 0, c - 16.5], 4).ok, false, '...a large one does not');
    assert.match(D.host.landing([c, 0, c - 16.5], 4).rule, /^(room|level)$/);
    const [s0] = D.host.sites, R = s0.r + DELVE_WARD_PAD_M + 1, off = (p) => [Math.abs(p[0] - s0.x), Math.abs(p[2] - s0.z)];
    const f = D.host.firstFloor();
    assert.ok(Array.isArray(f) && Math.abs(f[1] - 0.05) < 1e-9, `on the rig's floor (${f})`);
    assert.ok(Math.hypot(...off(f)) > R && Math.hypot(...off(f)) <= R + DSITE_SMALL.gridM * Math.SQRT2 + 1e-9, `a step past the ward, the nearest such (${f})`);
    assert.equal(D.host.sites.some((s) => inWard(s, f[0], f[1], f[2])), false);
    // a ledge 1.2 m up round the ward (the grid's floors near it now a storey of their own): the nearest on its storey
    const v = [], H = R + 4, L = 1.2, q = [[-H, -H], [-H, H], [H, H], [H, -H]];
    for (const [dx, dz] of q) v.push(s0.x + dx, L, s0.z + dz);
    D.collider.addMesh('dungeon', v, [0, 1, 2, 0, 2, 3], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const g = D.host.firstFloor();
    assert.ok(Math.abs(g[1] - 0.05) < 1e-9 && Math.max(...off(g)) >= H - 1e-9, `the ledge passed by (${g})`);
  } finally { D.host.destroy(); }
  const { benchLocation } = await import('../../src/scenes/delve/delveBench.js');
  const tpl = { name: 'Bedard Laboratory', hasDungeon: true, climate: { worldClimate: 231 }, mapTableData: { mapId: 99, dungeonType: 0 }, exterior: { exteriorData: {} }, dungeon: { recordElement: { header: { locationId: 5 } }, blocks: [{ blockName: 'N0000001.RDB', isStartingBlock: true }, { blockName: 'B0000002.RDB' }] } };
  const maps = { getLocationByName: (r, n) => (n === tpl.name ? tpl : null) };
  assert.equal(benchLocation(new URLSearchParams('dungeon=Bedard Laboratory&spawn=10,20&elite'), maps, null).location.elite, true);
  assert.equal(benchLocation(new URLSearchParams('dungeon=Bedard Laboratory&spawn=10,20'), maps, null).location.elite, false);
  // built as the world builds it: a pixel whose clone takes a curated block stands it in the bench too
  const crypt = { ...tpl, dungeon: { ...tpl.dungeon, blocks: [{ blockName: 'N0000001.RDB', isStartingBlock: true }, { blockName: 'N0000002.RDB' }, { blockName: 'N0000003.RDB' }, { blockName: 'B0000002.RDB' }] } };
  const cm = { getLocationByName: () => crypt };
  const px = [...Array(300).keys()].find((x) => benchLocation(new URLSearchParams(`dungeon=x&spawn=${x},20`), cm, null).location.curated);
  assert.ok(px !== undefined, 'some pixel\'s clone takes one');
  assert.ok(benchLocation(new URLSearchParams(`dungeon=x&spawn=${px},20`), cm, null).location.dungeon.blocks.some((b) => /^NDLV/.test(b.blockName)));
});

test('AUDIT DLV5-6 M5 THE LAB KEEPS WHAT IT OPENED: a shipped record\'s every type and its number (its export\'s default), the types read as a list, a record numbered 0 never exported (mutants: the first type alone; the number lost; the list unread; a 0 shipped)', async () => {
  const { labDraftOf, labTypes, labExport } = await import('../../src/world/dungeon/curatedLab.js');
  const { mountDelveLab } = await import('../../src/scenes/delve/delveLab.js');
  const throne = CURATED_RECORDS.find((r) => r.id === 'throne-hall');
  const d = labDraftOf(throne);
  assert.deepEqual([d.n, d.from, d.types], [0, 4, [1, 2, 11, 13, 15]]);
  assert.deepEqual([labTypes('1, 2,2 11'), labTypes('x'), labTypes(''), labTypes('3.5')], [[1, 2, 11], null, null, null]);
  assert.match(labExport(d, 0).why, /^n: 0/);
  assert.equal(JSON.parse(labExport(d, 4).text).n, 4);
  const node = (tag) => ({ tag, kids: [], value: '', textContent: '', append(...k) { this.kids.push(...k); }, replaceChildren(...k) { this.kids = k; }, addEventListener() {}, remove() {} });
  const doc = { createElement: node, head: node('head'), body: node('body') };
  const all = (n, f, out = []) => { if (f(n)) out.push(n); for (const k of n?.kids ?? []) all(k, f, out); return out; };
  let rebuilt = null;
  const lab = mountDelveLab({ draft: d, feet: () => [40, 25.6, 9], landing: () => ({ ok: true }), foot: async () => 0, rebuild: (x) => { rebuilt = x; return null; }, doc: /** @type {any} */ (doc) });
  try {
    assert.equal(all(doc.body, (n) => n.tag === 'input' && n.value === '4').length, 1, 'the export\'s number its own');
    const types = all(doc.body, (n) => n.tag === 'input' && n.value === '1, 2, 11, 13, 15');
    assert.equal(types.length, 1, 'every type in the field');
    all(doc.body, (n) => n.tag === 'button' && n.textContent === 'Rebuild')[0].onclick();
    assert.deepEqual(rebuilt.types, [1, 2, 11, 13, 15], 'rebuilt with them all');
    types[0].value = '2, 1';
    all(doc.body, (n) => n.tag === 'button' && n.textContent === 'Rebuild')[0].onclick();
    assert.deepEqual(rebuilt.types, [2, 1]);
    types[0].value = 'none'; rebuilt = null;
    all(doc.body, (n) => n.tag === 'button' && n.textContent === 'Rebuild')[0].onclick();
    assert.equal(rebuilt, null, 'a field that names no type rebuilds nothing');
  } finally { lab.destroy(); }
});
