// DECOR-OUTDOOR (FIELD BUGS 2026-10-05b, the owner: "There seems to be a lot of missing decor items with house
// decoration"; asked which, the outdoor pieces for a yard among them). A yard's decorator offered the rooms' furniture
// alone: none of what Daggerfall stands in its streets - a fence, a well, a fountain, a cart, a lamp - and none of its
// trees and plants. Now each town block's street joins the catalogue, and the climates' nature sets whole; both stand in
// a yard alone, a yard's nature its own climate's, drawn as the town's own is - in the town's climate, its season,
// Seasons of the Iliac Bay's picture where it stands, the street's animals moving - and stood again when its pixel is
// built again. Pinned through the real collector, catalogue, scan, decorator and yard host.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  collectDecor, decorCatalogue, decorRoomEntries, addDecorNature, isStreetPiece, DECOR_NATURE_BASES, DECOR_NATURE_RECORDS,
  DECOR_KINDS,
} from '../src/systems/decorCatalogue.js';
import { createDecorScan, decorScanDeps } from '../src/systems/decorScan.js';
import { yardNatureFlat, isNaturePiece } from '../src/scenes/yardNature.js';
import { TREE_RECORDS } from '../src/world/terrainNature.js';
import { applyClimate, SEASON } from '../src/world/climateSwaps.js';
import { floraSwayOf } from '../src/systems/windDrive.js';
import { BLOCK_TYPES } from '../src/formats/blocksFile.js';
import { LADDER_MODEL_ID } from '../src/player/enterExit.js';
import { YARD_TOWN_TTL_MS } from '../src/scenes/homeYards.js';
import { rmb, fakeBlocks, settle, rows, all, one, toolRig, yardWorld, yardPiece, live, sized, SWAPPED, DESERT } from './decorFakes.mjs';

/** A parsed RMB block with a STREET: its own models (`misc`, ids), its own flats (`miscFlats`, [a, r, factionID?]) and
 *  one building whose outside stands `outside` flats - beside one room (rmb's own). */
function street({ misc = [], miscFlats = [], outside = [], room = rmb() } = {}) {
  const b = room.rmbBlock;
  return {
    rmbBlock: {
      ...b,
      misc3dObjectRecords: misc.map((id) => ({ modelIdNum: id })),
      miscFlatObjectRecords: miscFlats.map(([a, r, factionID = 0]) => ({ textureArchive: a, textureRecord: r, factionID })),
      subRecords: [{ ...b.subRecords[0], exterior: { blockFlatObjectRecords: outside.map(([a, r]) => ({ textureArchive: a, textureRecord: r })) } }],
    },
  };
}
const STREET = street({
  misc: [41208, 41220, 62324, 41600, 446, 447, 41739, LADDER_MODEL_ID, 41120],
  miscFlats: [[210, 16], [201, 3], [182, 21, 3], [199, 10], [504, 12], [212, 1]],
  outside: [[210, 16], [501, 4], [212, 1]],
  room: rmb([41120], [[210, 3]]),
});

test('DECOR-OUTDOOR the street: a town block\'s own models (never the mill, the gates, the town\'s board or the ladder) and its flats and its buildings\' outside flats (never a marker or nature) - a street\'s person a person; a piece a room stands too is the room\'s (mutants: DECOROUTDOOR-street-unread, DECOROUTDOOR-street-flats-unread, DECOROUTDOOR-outside-flats-unread, DECOROUTDOOR-exclusions-lost, DECOROUTDOOR-street-nature-taken)', () => {
  assert.deepEqual([41208, 41220, 62324, 41120].map(isStreetPiece), [true, true, true, true]);
  assert.deepEqual([41600, 446, 447, 41739, LADDER_MODEL_ID, 0, null].map(isStreetPiece), Array(7).fill(false), 'the mill, the gates, the board (the hall\'s), the ladder');
  const c = collectDecor([STREET]);
  assert.deepEqual([...c.keys()].sort(), ['f182.21', 'f201.3', 'f210.16', 'f210.3', 'f212.1', 'm41120', 'm41208', 'm41220', 'm62324']);
  assert.deepEqual(['m41208', 'm41220', 'm62324', 'f210.16', 'f201.3', 'f212.1'].map((k) => c.get(k).from), Array(6).fill('street'));
  assert.deepEqual([c.get('f210.16').count, c.get('f212.1').count], [2, 2], 'the block\'s own and a building\'s outside, both counted');
  assert.equal(c.get('f182.21').person, true);
  assert.deepEqual([c.get('m41120').from, c.get('m41120').count, c.get('f210.3').from], ['room', 2, 'room'], 'the room\'s chair is the room\'s, its street copy counted');
});

test('DECOR-OUTDOOR the nature: every climate\'s set (its summer archive) and every record Daggerfall stands of it, 1 to 31, joined whole - a tree of its set named "Tree", any other a "Plant", each numbered among its own set; a key a room holds stays the room\'s (mutants: DECOROUTDOOR-nature-unnumbered-by-set, DECOROUTDOOR-tree-unnamed)', () => {
  assert.deepEqual(DECOR_NATURE_BASES, [500, 501, 502, 503, 504, 506, 508, 510], 'the climates\' own sets, never a winter twin');
  assert.equal(DECOR_NATURE_RECORDS, 31);
  assert.deepEqual(DECOR_KINDS.nature, 'Trees and plants');
  const c = addDecorNature(collectDecor([rmb([], [[504, 3]])]));
  assert.equal(c.get('f504.3').from, 'room', 'a room\'s own piece of a nature archive stays the room\'s');
  const cat = decorCatalogue(c);
  const nature = cat.filter((e) => e.kind === 'nature');
  assert.equal(nature.length, DECOR_NATURE_BASES.length * DECOR_NATURE_RECORDS - 1);
  assert.ok(nature.every((e) => e.outside && DECOR_NATURE_BASES.includes(e.nature) && e.flat[0] === e.nature && e.flat[1] >= 1 && e.flat[1] <= 31));
  for (const base of DECOR_NATURE_BASES) {
    const own = nature.filter((e) => e.nature === base);
    const trees = own.filter((e) => e.name.startsWith('Tree')).map((e) => e.flat[1]).sort((a, b) => a - b);
    assert.deepEqual(trees, [...TREE_RECORDS[base]].sort((a, b) => a - b), `${base}: its set's own trees`);
    const names = own.filter((e) => e.name.startsWith('Tree')).sort((a, b) => a.flat[1] - b.flat[1]).map((e) => e.name);
    assert.deepEqual(names, trees.map((_, i) => `Tree ${i + 1}`), `${base}: numbered among its own set`);
  }
});

test('DECOR-OUTDOOR the offer: no room indoors offers the street or the nature; a yard offers the street, and the nature of its own climate alone - none where it knows no climate (mutants: DECOROUTDOOR-outside-indoors, DECOROUTDOOR-any-climate)', () => {
  const cat = decorCatalogue(addDecorNature(collectDecor([STREET])));
  const keys = (r) => decorRoomEntries(cat, r, true).map((e) => e.key);
  for (const r of [{ kind: 'house' }, { kind: 'ship' }, { kind: 'home' }, { kind: 'home', hall: true }]) {
    const k = keys(r);
    assert.ok(!k.includes('m41208') && !k.includes('f504.12') && k.includes('m41120'), JSON.stringify(r));
  }
  const yard = keys({ kind: 'home', yard: true, natureBase: 506 });
  assert.ok(['m41208', 'm41220', 'm62324', 'f210.16', 'f201.3', 'm41120'].every((k) => yard.includes(k)), 'the street, and the rooms\' as ever');
  assert.ok(yard.includes('f506.12') && !yard.includes('f504.12') && !yard.includes('f510.12'), 'its own climate\'s trees');
  assert.equal(yard.filter((k) => /^f5\d\d\./.test(k)).length, DECOR_NATURE_RECORDS);
  assert.ok(!keys({ kind: 'home', yard: true }).some((k) => /^f5\d\d\./.test(k)), 'no climate known, no nature');
});

test('DECOR-OUTDOOR the scan, through the hosts\' one constructor: the streets read and the nature joined, each priced by its own picture (mutant: DECOROUTDOOR-scan-natureless)', async () => {
  const blocks = fakeBlocks([{ type: BLOCK_TYPES.Rmb, block: STREET }]);
  const arch = { getRecordIndex: (id) => id, getMesh: () => ({ radius: 40 }) };
  const getTexture = async () => ({ recordCount: 32, getSize: () => ({ width: 32, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  const scan = createDecorScan(decorScanDeps({ blocks, arch, getTexture }));
  for (let i = 0; i < 40 && scan.phase() !== 'done'; i++) { scan.step(); await settle(); }
  const e = scan.entries();
  for (const k of ['m41208', 'f201.3', 'f504.12', 'f510.31']) {
    const x = e.find((y) => y.key === k);
    assert.ok(x && scan.radiusOf(x) > 0, `${k}: in, and priced`);
  }
});


test('DECOR-OUTDOOR the yard\'s tree: drawn as its town draws its nature - the season\'s archive of its set (winter\'s twin in winter), at its own scale on its own base, leaning with the wind, mirrored when turned half round - and stood again in the new season when its pixel is built again (mutants: DECOROUTDOOR-tree-seasonless, DECOROUTDOOR-tree-unscaled, DECOROUTDOOR-tree-still, DECOROUTDOOR-rebuild-unheard)', async () => {
  assert.equal(isNaturePiece(yardPiece()), true);
  assert.equal(isNaturePiece(yardPiece({ flat: [210, 3] })), false);
  assert.deepEqual([yardNatureFlat([504, 12], SEASON.Summer), yardNatureFlat([504, 12], SEASON.Winter), yardNatureFlat([503, 4], SEASON.Winter)], [[504, 12], [505, 12], [503, 4]]);
  const w = yardWorld({ pieces: [yardPiece(), yardPiece({ id: 'p2', pos: [-8, 0, 2], rot: [180, 0, 0], scale: 1 })] });
  await w.run();
  let [a, b] = live(w.made);
  assert.deepEqual([a.a, a.r, a.size, a.centers], [504, 12, sized(40, 120, 2), [[18, 0, 12]]], 'summer: its set\'s own archive, twice its size, on its base');
  assert.equal(a.sway, floraSwayOf(504, 504, sized(40, 120).h), 'it leans as the town\'s flora leans');
  // ...by its RECORD's height: a bush scaled past a tree's height is a bush still
  const bush = yardWorld({ pieces: [yardPiece({ flat: [504, 20], scale: 4 })], sizes: { '504.20': [16, 32] } });
  await bush.run();
  const [shrub] = live(bush.made);
  assert.deepEqual([shrub.size.h > sized(40, 120).h, shrub.sway], [true, floraSwayOf(504, 504, sized(16, 32).h)]);
  assert.ok(b.size.w < 0 && b.size.h > 0, 'turned half round: mirrored');
  // the season turns: the town's pixel is built again, and the yard stands again in it
  w.built.set('0,0', w.pixel(SEASON.Winter));
  await w.run(1);
  [a, b] = live(w.made);
  assert.deepEqual([a.a, a.r, a.size], [505, 12, sized(44, 130, 2)], 'winter: the woodland\'s snowy twin');
  assert.equal(w.made.filter((x) => x.gone).length, 2, 'the summer pictures let go');
});

test('DECOR-OUTDOOR the yard\'s tree under Seasons of the Iliac Bay: the mod\'s picture of the season\'s record, uploaded under the install\'s own key without mips, at the picture\'s size and the piece\'s scale (mutant: DECOROUTDOOR-tree-classic-under-sib)', async () => {
  const image = { width: 8, height: 8 };
  const seasonal = { installedSeason: 2, lookup: (a, r) => (a === 504 && r === 12 ? { texture: { image }, size: { w: 3, h: 9 } } : null) };
  const w = yardWorld({ pieces: [yardPiece()], seasonal });
  await w.run();
  const [a] = live(w.made);
  assert.deepEqual([a.a, a.r, a.size], [504, '12#season2', { w: 6, h: 18 }]);
  assert.deepEqual(w.uploads, ['504_12#season2']);
});

test('DECOR-OUTDOOR the yard\'s street pieces: a model stands in its TOWN\'S climate - its swaps written into the pixel\'s own table before it stands; a street\'s animal moves with the town\'s animator (mutants: DECOROUTDOOR-model-climateless, DECOROUTDOOR-street-still)', async () => {
  assert.ok(Number.isInteger(SWAPPED), 'an archive the climates swap');
  const w = yardWorld({ pieces: [yardPiece({ model: 41208, flat: null }), yardPiece({ id: 'p2', flat: [201, 3], scale: 1 })], climate: DESERT });
  await w.run();
  const p = w.built.get('0,0');
  assert.equal(p.texRemap.get(`${SWAPPED}_0`), `${applyClimate(SWAPPED, 0, DESERT, SEASON.Summer)}_0`, 'the fence in the desert\'s own wood');
  const animal = live(w.made).find((x) => x.a === 201);
  assert.ok(w.animated.some(([batch, arch, n]) => batch === animal && arch === 201 && n === 4), 'the cow moves');
});

test('DECOR-OUTDOOR the decorator in a yard: its own climate\'s trees offered, their pictures in the list and the ghost the season\'s - a winter woodland tree its snowy twin, as it will stand (mutant: DECOROUTDOOR-tool-flatas-unread)', async () => {
  const asked = [];
  const w = yardWorld({ pieces: [], season: SEASON.Winter, own: true, iconUrl: async (a, r) => { asked.push(`${a}.${r}`); return `url:${a}.${r}`; } });
  await w.run(2);
  const tool = w.yards.tool();
  assert.equal(tool.openPanel(), true);
  await w.run(12, true);
  const panel = w.doc.body.children.find((c) => c.className === 'dfdecor');
  const row = rows(panel).find((r) => r.dataset.key === 'f504.12');
  assert.ok(row, 'its climate\'s tree, offered');
  assert.equal(rows(panel).some((r) => r.dataset.key === 'f510.12'), false, 'never another climate\'s');
  assert.ok(asked.includes('505.12') && !asked.includes('504.12'), 'its picture in the list is the season\'s');
  row.fire('click');
  all(panel, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  for (let i = 0; i < 6 && !tool.ghost(); i++) await w.run(1);
  const [ghost] = tool.batches();
  assert.deepEqual([ghost?.a, ghost?.r], [505, 12], 'the ghost: the tree as it will stand, in winter');
});

test('DECOR-OUTDOOR AUDIT 05b A2: a tree placed in a yard is the catalogue\'s own in "In this yard" - its row its picture (the season\'s) and its name, never its kind\'s letters - a tree is the catalogue\'s own though no room stands one (its count none) (mutant: DECOROUTDOOR-placed-uncatalogued)', async () => {
  const asked = [];
  const w = yardWorld({ pieces: [yardPiece()], season: SEASON.Winter, own: true, iconUrl: async (a, r) => { asked.push(`${a}.${r}`); return `url:${a}.${r}`; } });
  await w.run(2);
  const tool = w.yards.tool();
  assert.equal(tool.openPanel(), true);
  await w.run(12, true);
  const panel = w.doc.body.children.find((c) => c.className === 'dfdecor');
  all(panel, 'dfdecor-chip').find((c) => c.textContent.startsWith('In this yard')).fire('click');
  asked.length = 0;
  await w.run(2, true);
  const row = rows(panel).find((r) => r.dataset.key === 'p1');
  const thumb = all(row, 'dfdecor-thumb')[0];
  assert.deepEqual([thumb.children.map((c) => c.tag), thumb.textContent], [['img'], ''], 'its picture, never the letters of its kind');
  assert.equal(all(row, 'dfdecor-row-name')[0].textContent, 'Tree 1');
  assert.ok(thumb.children[0].getAttribute('src') === 'url:505.12' || asked.includes('505.12'), 'the season\'s picture');
});

test('DECOR-OUTDOOR AUDIT 05b A4: a yard built again under its owner\'s open decorator stands again as it stands - the town\'s newer answer (another keeper\'s write the panel holds back) waits until the decorator is put away, as it waits for every change of the town\'s (mutant: DECOROUTDOOR-rebuild-unheld)', async () => {
  const w = yardWorld({ pieces: [yardPiece(), yardPiece({ id: 'p2', pos: [-8, 0, 2] })], own: true });
  await w.run(2);
  const tool = w.yards.tool();
  assert.equal(tool.openPanel(), true);
  const ids = () => w.yards.yards()[0].pool.list().map((p) => p.id);
  // another writer takes p2 up; the town is asked again and answers so - held back while the owner writes
  w.town.pieces = [yardPiece()];
  w.clock.t += YARD_TOWN_TTL_MS + 1;
  await w.run(2, true);
  assert.deepEqual(ids(), ['p1', 'p2'], 'held back while the decorator is up');
  // its pixel built again (a season's turn) under the open decorator
  w.built.set('0,0', w.pixel(SEASON.Winter));
  await w.run(2, true);
  assert.deepEqual(ids(), ['p1', 'p2'], 'stood again as it stands');
  assert.deepEqual(live(w.made).map((b) => b.a), [505, 505], 'in the new pixel\'s season');
  tool.close();
  await w.run(2);
  assert.deepEqual(ids(), ['p1'], 'the decorator put away: the town\'s answer stands');
});

test('DECOR-OUTDOOR AUDIT 05b A5: a model chosen in a yard flies in its town\'s climate - its swaps written into the yard\'s table before its ghost is drawn with it, as the piece will stand; never the base climate\'s a moment and the town\'s once placed. The panel\'s preview is handed the yard\'s table too (mutants: DECOROUTDOOR-ghost-climateless, DECOROUTDOOR-ghost-unprepared)', async () => {
  const w = yardWorld({ pieces: [], own: true, climate: DESERT });
  await w.run(2);
  const tool = w.yards.tool();
  assert.equal(tool.openPanel(), true);
  await w.run(12, true);
  const panel = w.doc.body.children.find((c) => c.className === 'dfdecor');
  rows(panel).find((r) => r.dataset.key === 'm41000').fire('click');
  all(panel, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  for (let i = 0; i < 6 && !tool.ghost(); i++) await w.run(1);
  assert.ok(tool.ghost(), 'placing');
  const table = w.built.get('0,0').texRemap;
  const swap = `${applyClimate(SWAPPED, 0, DESERT, SEASON.Summer)}_0`;
  for (let i = 0; i < 4; i++) { w.yards.draw(); await settle(); }
  const ghost = w.meshDraws.filter((d) => d.gpu.id === 41000);
  assert.ok(ghost.length > 0, 'the ghost drawn');
  assert.ok(ghost.every((d) => d.remap?.get(`${SWAPPED}_0`) === swap), 'every draw of it in the desert\'s own wood - the swap written first');
  assert.equal(table.get(`${SWAPPED}_0`), swap);
  assert.match(readFileSync(new URL('../src/scenes/homeYards.js', import.meta.url), 'utf8'), /drawPreview: \(\) => tool\.drawPreview\(cur \? remapOf\(cur\.yard\) : null\),/, 'the preview drawn with the yard\'s table, in the same law');
});

test('DECOR-OUTDOOR AUDIT 05b A5 the decorator\'s own law: a model it draws with the host\'s table - the panel\'s preview as the ghost - waits for the host\'s law over it (`prepareModel`), asked once a table: a table built anew is asked again (mutant: DECOROUTDOOR-preview-unprepared)', async () => {
  const asked = [];
  const p = toolRig({ prepareModel: async (gpu) => { asked.push(gpu); await settle(); } });
  p.frame();
  p.tool.openPanel();
  for (let i = 0; i < 6; i++) { p.frame({ overlayUp: true }); await settle(); }
  const root = p.doc.body.children.find((c) => c.className === 'dfdecor');
  const preview = one(root, 'dfdecor-preview');
  preview.getBoundingClientRect = () => ({ left: 400, top: 100, width: 200, height: 150 });
  rows(root).find((r) => r.dataset.key === 'm41000').fire('click');
  p.frame({ overlayUp: true });
  await settle();
  one(root, 'dfdecor-preview').children.find((c) => c.tag === 'canvas').getContext = () => ({ drawImage() {} });
  const table = new Map();
  assert.equal(p.tool.drawPreview(table), false, 'not drawn before the law answered');
  await settle(); await settle();
  assert.equal(p.tool.drawPreview(table), true, 'drawn once it did');
  assert.equal(p.draws.at(-1).remap, table);
  assert.equal(p.tool.drawPreview(table), true);
  assert.equal(asked.length, 1, 'asked once for the table');
  assert.equal(p.tool.drawPreview(new Map()), false, 'a table built anew (a season\'s turn) is asked again');
  await settle();
  assert.equal(asked.length, 2);
});
