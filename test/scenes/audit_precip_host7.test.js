// AUDIT PRECIP HOST-7 (the owner: "Audit this and ensure perfection. No band aids"): ON THE SNOW LANE A SEASON'S TURN
// RE-SKINS WHAT STANDS, IN PLACE. The snow turns a pixel at the weather's rate (scenes/snowCoverHost.js sweep), and each
// turn was the classic flip's whole teardown - the terrain, the collider, the doors, the street's people and the grass
// rebuilt, and the motor held on the player's own pixel through the build - though nothing it took depended on the snow.
// DFU re-skins in place (DaggerfallLocation.ApplyClimateSettings): scenes/pixelBuild.js reskinPixelNow re-makes the
// season's parts alone - the climate table (world/texRemap.js reskinRemap) and the merge through it, the homes' looks, the
// mills' bodies, the flats' groups with their forest, cover and far pictures - aside, and trades them in one step. Run
// here on a standing pixel through the build's own code; the record is bible/01-Overview/audits/Audit-Precip.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPixelBuild, groupFlats } from '../../src/scenes/pixelBuild.js';
import { createSeasonReskin } from '../../src/world/seasonReskin.js';
import { createCoverIndex, FELLED } from '../../src/ai/cover.js';
import { markRemapLaw, remapLawOf, remapSubMeshes, reskinRemap } from '../../src/world/texRemap.js';
import { applyClimate, SEASON } from '../../src/world/climateSwaps.js';
import { hostText } from '../hostText.mjs';

const TEMPERATE = 300, WOODS = 504;   // the temperate climate, and its woods' nature set (505 its winter)
const SWAPS = 2;   // a model texture the temperate climate swaps, summer to winter
const fakeTex = (archive) => ({ archive, recordCount: 40, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 });

/** A standing pixel and the host about it: a block of two climate models merged, a mill, a home drawn on its own, three
 *  wild trees and a lamp the season never turns, an NPC's batch, a gathering patch and a jungle cover kept. */
function world({ lpt = false } = {}) {
  const log = { destroyed: [], created: [], meshes: [], released: [], acquired: [], buckets: [], restood: [] };
  let n = 0;
  const renderer = {
    createBillboardBatch: (archive, record, size, centers, opts) => { const b = { id: ++n, archive, record, size, centers: centers.map((c) => [...c]), scales: opts?.scales ?? null }; log.created.push(b); return b; },
    destroyBatch: (b) => log.destroyed.push(b),
    moveBillboardBatch: (b, centers) => { b.centers = centers.map((c) => [...c]); return true; },
    createMesh: (m) => { const mesh = { merged: m }; log.meshes.push(mesh); return mesh; },
    destroyMesh: (m) => log.destroyed.push(m),
    uploadTexture: () => {},
  };
  const cover = createCoverIndex({ enabled: () => true });
  const collider = { cover, removeBucket: (k) => log.buckets.push(k) };
  const reskin = createSeasonReskin();
  const seasonAt = { pixel: SEASON.Summer, flat: () => SEASON.Summer };
  const snowCover = {
    on: true, settle: async () => {},
    recorder: (px, py) => {
      const flats = [];
      return {
        pixel: () => seasonAt.pixel,
        flat: (x, z, h, s) => { const w = seasonAt.flat(x, z, h, s); flats.push(x, z, h, 0, w === SEASON.Winter ? 1 : 0); return w; },
        done: (uses) => ({ px, py, pixel: uses ? { season: seasonAt.pixel } : null, flats: Float32Array.from(flats) }),
      };
    },
  };
  const door = lpt ? {
    load: async () => true, proto: (a, r) => ({ key: `lpt${a}_${r}` }),
    farPicture: async (proto) => ({ record: 900, size: { w: 6, h: 12 }, key: proto.key }),
    acquire: (h) => log.acquired.push(h), release: (h) => log.released.push(h),
  } : null;
  const state = { pixelTranslation: () => [0, 0, 0] };
  const millsDoor = { fn: async (c, winter) => ({ body: { mill: c, winter } }) };
  const host = {
    _reskin: reskin, breather: { reset() {}, breathe: async () => {} }, built: new Map(), collider, renderer, snowCover,
    getTexture: async (a) => fakeTex(a), getWindmillMeshes: (c, winter) => millsDoor.fn(c, winter),
    lowPolyTrees: door, _lptSway: new Map(), _lptWindfall: new Map(), verges: false, seasons: null, onlineHomes: null,
    state, season: SEASON.Summer, seasonsReady: false, gatherHost: { restandAt: (px, py) => log.restood.push(`${px},${py}`) },
  };
  createPixelBuild(host);
  // the standing pixel's climate table, asked under the temperate law, and the merge's models
  const sub = [{ textureArchive: SWAPS, textureRecord: 1, startIndex: 0, primitiveCount: 1 }];
  const cpu = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), normals: new Float32Array(9), uvs: new Float32Array(6), indices: new Uint32Array([0, 1, 2]), subMeshes: sub };
  const ident = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const texRemap = markRemapLaw(new Map(), `climate:${TEMPERATE}.${SEASON.Summer}`);
  const pipeline = { getTexture: async (a) => fakeTex(a), uploadRecord: () => {}, uploadRecordFrame: () => {} };
  const trees = [12, 13, 14].map((r, id) => ({ id, group: '', i: 0, x: id * 100, y: 0, z: 0, wood: 1, base: WOODS, archive: WOODS }));
  const flatLog = [
    ...trees.map((t, i) => ({ archive: -1, record: 12 + i, c: [t.x, 0, 0], wild: WOODS, tree: t })),   // -1: not yet stood
    { archive: 210, record: 3, c: [5, 0, 5] },   // a lamp: no season turns it
  ];
  const npc = { id: 'npc' }, patch = { id: 'patch' }, kept = { c: [1, 0, 1], r: 0.5, h: 2 };
  const p = {
    px: 7, py: 9, season: SEASON.Summer, townClimate: TEMPERATE, texRemap, placeHold: pipeline, flatAnims: { remove() {}, add() {} },
    staticBatch: { old: true }, batches: [npc, patch], terrain: { terrain: true }, tilemap: null, paths: null, _box: [0, 0, 0, 1, 1, 1],
    models: [{ gpu: { mill: TEMPERATE, winter: false }, _mill: true }, { gpu: { subMeshes: sub }, _home: { bk: 1, sig: '', seq: 0 }, texRemap: new Map() }],
    forest: { base: WOODS, archive: WOODS, trees: [], groups: new Map([['J0', { batch: { jungle: true }, centers: [] }]]) }, lowPolyTrees: null, _skinGen: 0,
    _skin: { log: flatLog, blocks: [], statics: [[cpu, ident, false, null], [cpu, ident, false, null]], batches: [], forest: new Set(), cover: [kept], trees, vergeNet: null, groundMid: 30, usesSeason: true, climate: { natureArchive: WOODS } },
  };
  host.built.set('7,9', p);
  return { host, p, log, reskin, seasonAt, cover, trees, sub, pipeline, texRemap, kept, millsDoor };
}

test('HOST-7: a pixel the snow turns is re-skinned where it stands - its table, its merge, its mill and its homes in the season of the snow at its middle, its flats each in its own foot\'s, the rest of it standing: no terrain, no collider bucket, no batch but the season\'s made again (mutants: the teardown kept; the merge left; the mill left)', async () => {
  const w = world();
  await remapSubMeshes(w.sub, w.texRemap, (a, r) => applyClimate(a, r, TEMPERATE, SEASON.Summer), w.pipeline, TEMPERATE);
  const { p, log, reskin, seasonAt } = w;
  // stood first in summer (the build's own law: the flats' groups stood, nothing else turns)
  reskin.skin('7,9');
  assert.equal(await reskin.runSkin(w.host.built, { x: 7, y: 9 }), true);
  assert.equal(p.texRemap, w.texRemap, 'summer to summer: the same table');
  assert.deepEqual(p.staticBatch, { old: true }, 'and the same merge');
  const summer = p.batches.filter((b) => b.archive === WOODS);
  assert.equal(summer.length, 3, 'the three trees, a group a record');
  // the snow comes: the middle's ground and the near tree's foot in winter, the far trees' still summer
  seasonAt.pixel = SEASON.Winter;
  seasonAt.flat = (x) => (x < 50 ? SEASON.Winter : SEASON.Summer);
  const terrain = p.terrain, before = log.destroyed.length, stood = p._skin.batches.slice();
  const yard = [{ textureArchive: 7, textureRecord: 2 }];
  const mills = async (c, winter) => { await remapSubMeshes(yard, p.texRemap, (a, r) => applyClimate(a, r, TEMPERATE, p.season), w.pipeline, TEMPERATE); return { body: { mill: c, winter } }; };
  w.millsDoor.fn = mills;   // a yard's model asked of the standing table while the re-skin is made
  reskin.skin('7,9');
  assert.equal(await reskin.runSkin(w.host.built, { x: 7, y: 9 }), true);
  assert.equal(p.season, SEASON.Winter);
  assert.equal(remapLawOf(p.texRemap), `climate:${TEMPERATE}.${SEASON.Winter}`, 'the table re-made in the winter law');
  assert.notEqual(p.texRemap, w.texRemap, 'a new table, never the old written over');
  const winterArch = applyClimate(SWAPS, 1, TEMPERATE, SEASON.Winter);
  assert.equal(p.texRemap.get(`${SWAPS}_1`), `${winterArch}_1`);
  assert.equal(p.texRemap.get('7_2'), `${applyClimate(7, 2, TEMPERATE, SEASON.Winter)}_2`, 'what the standing table was asked meanwhile, brought in before the trade');
  assert.equal(p.staticBatch.merged.subMeshes[0].textureArchive, winterArch, 'the merge through the winter table');
  assert.ok(log.destroyed.some((d) => d.old), 'the summer merge let go');
  assert.deepEqual(p.models[0].gpu, { mill: TEMPERATE, winter: true }, 'the mill\'s body dressed for winter');
  assert.equal(p.models[1].texRemap, null, 'a home with no look draws by the pixel\'s table');
  assert.equal(p.models[1]._home.seq, 1, 'and a look asked under the old season is spent');
  assert.equal(p.terrain, terrain, 'the terrain stands');
  assert.deepEqual(log.buckets, [], 'no collider bucket torn down');
  const gone = log.destroyed.slice(before).filter((d) => d.archive != null);
  assert.deepEqual(gone, stood, 'the batches its groups stood let go - and nothing else');
  assert.equal(stood.length, 4, 'the three trees and the lamp: every group the groups stood, made again by the one law');
  assert.ok(p.batches.includes(w.p.batches.find((b) => b.id === 'npc')) && p.batches.some((b) => b.id === 'patch'), 'the NPC\'s and the patch\'s batches stand');
  const near = p.batches.find((b) => b.archive === WOODS + 1);
  assert.ok(near && near.record === 12, 'the near tree in its winter set');
  assert.equal(p.batches.filter((b) => b.archive === WOODS).length, 2, 'the far two still in summer');
  assert.equal(p._skinGen, 1, 'its buildings\' season turned once (summer to summer turns nothing a yard wears)');
  assert.equal(p._snow.pixel.season, SEASON.Winter, 'the snow it now wears, kept for the sweep');
  assert.deepEqual(log.restood, ['7,9', '7,9'], 'the gathering host stands its nodes again (a stump in its season)');
});

test('HOST-7: the forest follows its flats - each tree its new group and place, the jungle\'s groups standing, a felled tree lying felled in its new picture, and the cover traded whole with the kept proxies in it (mutants: the felled tree stood again; the jungle\'s groups dropped; the cover added, never traded)', async () => {
  const w = world();
  const { p, reskin, seasonAt, trees, cover } = w;
  reskin.skin('7,9');
  await reskin.runSkin(w.host.built, { x: 7, y: 9 });
  assert.ok(p.forest.groups.has('J0'), 'the jungle\'s group stands');
  assert.deepEqual(trees.map((t) => t.group), [`${WOODS}_12`, `${WOODS}_13`, `${WOODS}_14`]);
  FELLED.add(trees[0] && w.p._skin.log[0].c);   // the near tree was felled (its centre is its identity)
  seasonAt.flat = (x) => (x < 50 ? SEASON.Winter : SEASON.Summer);
  reskin.skin('7,9');
  await reskin.runSkin(w.host.built, { x: 7, y: 9 });
  assert.equal(trees[0].group, `${WOODS + 1}_12`, 'the felled tree\'s new group');
  assert.equal(trees[0].archive, WOODS + 1);
  const g = p.forest.groups.get(`${WOODS + 1}_12`);
  assert.ok(g.batch.centers[0][1] < -1, 'lying felled in its winter picture');
  assert.ok(p.forest.groups.has('J0'), 'the jungle\'s group still stands');
  assert.deepEqual(p.forest.trees.map((t) => t.id), [0, 1, 2], 'every tree its forest\'s, by its own id');
  assert.ok(cover.has('7,9'), 'the pixel\'s cover placed');
  FELLED.delete(w.p._skin.log[0].c);
});

test('HOST-7: a pixel torn down while its re-skin is made lets every made thing go and trades nothing (mutants: the trade without the check)', async () => {
  const w = world({ lpt: true });
  const { p, log, reskin, host } = w;
  host.snowCover.settle = async () => { host.built.delete('7,9'); };   // gone under the settle's await
  reskin.skin('7,9');
  assert.equal(await reskin.runSkin(host.built, { x: 7, y: 9 }), false, 'gone under the settle: nothing read');
  host.snowCover.settle = async () => {};
  host.built.set('7,9', p);
  const make = host.renderer.createBillboardBatch;
  host.renderer.createBillboardBatch = (...a) => { host.built.delete('7,9'); return make(...a); };   // gone while its groups are made
  reskin.skin('7,9');
  assert.equal(await reskin.runSkin(host.built, { x: 7, y: 9 }), false);
  assert.equal(p._skinGen, 0, 'nothing traded');
  for (const b of log.created) assert.ok(log.destroyed.includes(b), `batch ${b.id} let go`);
  assert.deepEqual(log.released.sort(), log.acquired.sort(), 'every far picture it held let go');
});

test('HOST-7: far pictures (Low Poly Trees) are traded - the new held before the old let go, the near set gathered anew (mutants: the old handles kept)', async () => {
  const w = world({ lpt: true });
  const { p, log, reskin, seasonAt } = w;
  reskin.skin('7,9');
  await reskin.runSkin(w.host.built, { x: 7, y: 9 });
  const first = p.lowPolyTrees.handles.slice();
  assert.equal(first.length, 3);
  seasonAt.flat = () => SEASON.Winter;
  reskin.skin('7,9');
  await reskin.runSkin(w.host.built, { x: 7, y: 9 });
  assert.deepEqual(log.released, first, 'the summer handles let go');
  assert.ok(p.lowPolyTrees.handles.every((h) => log.acquired.includes(h)) && !p.lowPolyTrees.handles.some((h) => first.includes(h)));
  assert.equal(p.lowPolyTrees.trees, null, 'its near set made again');
});

test('HOST-7: the table\'s recipe - every mesh asked under a law that turns is asked again in the new season, and what the standing table is asked while the re-skin is made is brought in before the trade (mutants: the catch-up skipped)', async () => {
  const deps = { getTexture: async () => fakeTex(0), uploadRecord: () => {} };
  const t = markRemapLaw(new Map(), 'climate:300.0');
  const a = [{ textureArchive: SWAPS, textureRecord: 1 }], b = [{ textureArchive: 7, textureRecord: 2 }];
  await remapSubMeshes(a, t, (x, r) => applyClimate(x, r, TEMPERATE, 0), deps, TEMPERATE);
  const lawOf = (c) => (x, r) => applyClimate(x, r, c, 1);
  const next = await reskinRemap(t, 'climate:300.1', lawOf, deps);
  assert.equal(next.get(`${SWAPS}_1`), `${applyClimate(SWAPS, 1, TEMPERATE, 1)}_1`);
  await remapSubMeshes(b, t, (x, r) => applyClimate(x, r, TEMPERATE, 0), deps, TEMPERATE);   // a yard's model, meanwhile
  assert.equal(next.has('7_2'), false);
  await reskinRemap(t, 'climate:300.1', lawOf, deps, next);
  assert.equal(next.get('7_2'), `${applyClimate(7, 2, TEMPERATE, 1)}_2`, 'brought in');
});

test('HOST-7: the flat log groups as addFlat grouped - a group a drawn picture in the log\'s order, each flat its place, the wild ones marked (mutants: the wild marks dropped)', () => {
  const log = [{ c: [0, 0, 0], wild: 504 }, { c: [1, 0, 0] }, { c: [2, 0, 0], wild: 504 }];
  const { groups, wild, places } = groupFlats(log, [[504, 3], [210, 1], [504, 3]]);
  assert.deepEqual([...groups.keys()], ['504_3', '210_1']);
  assert.equal(groups.get('504_3')[1], log[2].c, 'the flat\'s own centre, by reference');
  assert.deepEqual(places, [['504_3', 0], ['210_1', 0], ['504_3', 1]]);
  assert.deepEqual([...wild], ['504_3#0', '504_3#1']);
});

test('HOST-7: the queue - a snow\'s turn is a skin, never a rebuild; a key rebuilt spends its skin; the nearest standing goes first; the world hands the sweep\'s keys to it and runs one a pump\'s turn under the build flag, with no teardown and no hold (mutants: markReskin a rebuild; the skin outliving its rebuild)', async () => {
  const r = createSeasonReskin();
  const built = new Map([['1,1', { px: 1, py: 1 }], ['5,5', { px: 5, py: 5 }]]);
  r.skin('5,5'); r.skin('1,1');
  assert.equal(r.pending, true);
  assert.deepEqual(r.take(built), [], 'no rebuild');
  assert.equal(r.nextSkin(built, { x: 0, y: 0 }), '1,1', 'the nearest');
  r.mark('5,5');
  assert.deepEqual(r.take(built), ['5,5']);
  assert.equal(r.nextSkin(built, { x: 0, y: 0 }), null, 'rebuilt: its skin spent');
  const w = hostText('src/scenes/world.js');
  assert.match(w, /markReskin: \(key\) => _reskin\.skin\(key\),/);
  const tick = w.slice(w.indexOf('  function tickSeason() {'), w.indexOf('\n  }\n', w.indexOf('  function tickSeason() {')));
  assert.match(tick, /const skin = keys\.length \? null : _reskin\.runSkin\(built, state\.current\);\n\s+if \(skin\) \{ building = true; skin\.finally\(\(\) => \{ building = false; \}\); \}\n\s+if \(!keys\.length\) return;/);
  const pb = readFileSync('src/scenes/pixelBuild.js', 'utf8');
  assert.match(pb, /_reskin\.skinWith\(reskinPixelNow\);/);
});

test('HOST-7: the build logs what a re-skin reads - a wild flat\'s season asked once it is known to stand (a flat the verge refused turns no pixel), the merge\'s models, the mills, and the record on the snow lane alone; the sea\'s floor wears the lane\'s ground, never the pixel\'s season (mutants: the season asked before the verge; the seafloor by the pixel)', () => {
  const pb = readFileSync('src/scenes/pixelBuild.js', 'utf8');
  const loop = pb.slice(pb.indexOf('    for (const f of nature) {'), pb.indexOf('    // WOD4: THE CAMP AT PRIVATEER\'S HOLD'));
  assert.ok(loop.indexOf('vergeClear(vergeNet') < loop.indexOf('snowRec.flat('), 'the verge first');
  assert.match(pb, /addFlat\(archive, f\.record, f\.x, f\.y, f\.z, \{ wild: base, tree \}\);/);
  assert.match(pb, /models\.push\(\{ gpu: parts\.body, local, _box: box, _order: -1, _mill: true \}\);/);
  assert.match(pb, /_skin: snowSeen \? \{ log: flatLog, blocks: skinBlocks, statics: remapAsked\(texRemap\) \? statics : null,/);
  const w = hostText('src/scenes/world.js');
  assert.match(w, /groundIsSnowy\(settings, snowCover\.on \? SEASON\.Summer : entry\.season \?\? season\)/);
  // a yard stands its pieces again when its pixel's buildings' season turns in place, as when its pixel is built again
  const y = readFileSync('src/scenes/homeYards.js', 'utf8');
  assert.match(y, /const rebuilt = y\.entry !== p \|\| y\.skin !== \(p\._skinGen \?\? 0\);/);
  assert.match(y, /y\.entry = p;\n\s+y\.skin = p\._skinGen \?\? 0;/);
  assert.match(y, /e !== y\.entry \|\| \(e\?\._skinGen \?\? 0\) !== y\.skin\) \{ syncIn = 0; break; \}/);
});
