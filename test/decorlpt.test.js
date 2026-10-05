// DECOR-LPT (FIELD BUGS 2026-10-05b, the owner: "elements should recieve the low poly overhaul style like trees got";
// asked which, "Placed trees & plants"). A yard's placed tree stood as its classic picture wherever Low Poly Trees stood
// the town's own as 3D trees. Now a placed tree or plant the mod has a tree for stands as the world's do: its 3D tree near
// the eye - turned by the piece's turn, sized by its scale - and the same tree's far picture beyond, giving way to it; the
// far picture's handle held while it stands; the decorator's ghost the same picture. Pinned through the real yard host,
// decorator and the near set's own gather, over a Low Poly Trees door that answers as the mod's does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { yardTreeSet, yardTreeYaw } from '../src/scenes/yardNature.js';
import { LPT_SCALE_MAX, LPT_SET_FLOATS, gatherNear } from '../src/world/lowPolyTrees.js';
import { floraSwayOf } from '../src/systems/windDrive.js';
import { SEASON } from '../src/world/climateSwaps.js';
import { yardWorld, yardPiece, live, sized, rows, all, toolRig, placeFrom } from './decorFakes.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Low Poly Trees as its door answers (systems/lowPolyTreesAssets.js): a prototype of each (archive, record) it has a tree
 *  for, a far picture a prototype - uploaded under `<record>#lpt`, sized for the tallest tree (LPT_SCALE_MAX) at its
 *  trimmed share - and its handle's holds counted. `sway` is the world's record of a prototype's lean. AUDIT 05b A1:
 *  `gate` a promise its data waits on (the mod's data still loading). */
function fakeTrees({ protos = ['504_12', '505_12'], loads = true, gate = null } = {}) {
  const made = new Map();
  const leans = new Map();
  const door = {
    load: async () => { await gate; return loads ? {} : null; },
    proto: (a, r) => (protos.includes(`${a}_${r}`) ? { key: `${a}_${r}`, archive: a, record: r, size: { w: 5, h: 10 } } : null),
    farPicture: async (proto) => {
      if (!made.has(proto.key)) made.set(proto.key, { proto, archive: proto.archive, record: `${proto.record}#lpt`, size: { w: 4 * LPT_SCALE_MAX, h: 9 * LPT_SCALE_MAX }, refs: 0 });
      return made.get(proto.key);
    },
    acquire: (h) => { h.refs++; },
    release: (h) => { h.refs--; },
  };
  return { door, sway: (p, s) => leans.set(p.key, Math.max(leans.get(p.key) ?? 0, s)), made, leans };
}

test('DECOR-LPT the yard\'s tree: a record Low Poly Trees has a tree for stands as its far picture - sized for the tallest tree with the piece\'s own scale on its corner, never mirrored (the tree turns in earnest), giving way to its 3D tree near the eye, leaning as the town\'s flora - its handle held, its lean recorded for its 3D trees (mutants: DECORLPT-tree-classic, DECORLPT-scale-lost, DECORLPT-not-cut, DECORLPT-unheld, DECORLPT-lean-unrecorded)', async () => {
  const trees = fakeTrees();
  const w = yardWorld({ pieces: [yardPiece({ rot: [180, 0, 0] })], trees });
  await w.run();
  const [far] = live(w.made);
  const handle = trees.made.get('504_12');
  assert.deepEqual([far.a, far.r, far.size, far.centers, far.scales], [504, '12#lpt', handle.size, [[18, 0, 12]], [2 / LPT_SCALE_MAX]], 'the far picture, the piece\'s scale on its corner');
  assert.ok(far.size.w > 0, 'turned half round, the picture of a tree never mirrors');
  assert.equal(far.lptProto, handle, 'it gives way to its 3D tree near the eye');
  assert.equal(far.farH, undefined, 'AUDIT 05b A9: no far rings\' height - a yard\'s flats stand outside MAC1\'s rings, so none would read one');
  assert.equal(far.sway, floraSwayOf(504, 504, sized(40, 120).h));
  assert.equal(handle.refs, 1, 'its handle held while it stands');
  assert.equal(trees.leans.get('504_12'), far.sway, 'its 3D trees lean as its far picture does');
});

test('DECOR-LPT the yard\'s near set: each standing tree, in the yard\'s own frame, at the yard\'s place now - the near set\'s own gather finds it where its piece stands, at its scale, turned by its turn; a recentre moves it with its yard (mutants: DECORLPT-tree-unplanted, DECORLPT-yaw-lost, DECORLPT-set-unplaced)', async () => {
  assert.equal(yardTreeYaw({ rot: [90, 0, 0] }), Math.PI / 2, 'a piece\'s turn, degrees, as a tree\'s, radians - the way a model turns');
  const trees = fakeTrees();
  const w = yardWorld({ pieces: [yardPiece({ rot: [90, 0, 0] }), yardPiece({ id: 'p2', flat: [504, 20], pos: [-8, 0, 2], scale: 1 })], trees });
  await w.run();
  const sets = w.yards.treeSets();
  assert.equal(sets.length, 1);
  const [set] = sets;
  const handle = trees.made.get('504_12');
  assert.deepEqual([set.ox, set.oy, set.oz, set.handles, [...set.trees], set.centers], [10, 0, 10, [handle], [0, 8, 0, 2, 2, Math.fround(Math.PI / 2)], [[8, 0, 2]]], 'the tree alone - a plant the mod has none for stands as its picture');
  const near = gatherNear(sets, 18, 12, 140, 20);
  assert.deepEqual([near.count, near.runs[0].handle, [...near.data.slice(0, 5)]], [1, handle, [18, 0, 12, Math.fround(Math.PI / 2), 2]], 'the world\'s gather: where it stands, turned, at its scale');
  assert.equal(w.yards.treeSets()[0], set, 'unchanged, the same set - the world gathers again only when a tree changed');
  // the world recentres: the yard stands again where its pixel stands now, its tree with it
  w.shift[0] = -100;
  w.yards.rebase();
  const [moved] = w.yards.treeSets();
  assert.deepEqual([moved.ox, moved.oz], [-90, 10]);
  assert.deepEqual(live(w.made).find((b) => b.r === '12#lpt').origin, [-100, 0, 0], 'the far picture moved with it');
});

test('DECOR-LPT AUDIT 05b A1: a tree whose picture lands after a recentre stands where its yard stands now - moved by the recentre it missed, as a picture already standing is - never a whole recentre off its yard and its own 3D tree until the yard is set again (mutant: DECORLPT-late-unshifted)', async () => {
  let open;
  const trees = fakeTrees({ gate: new Promise((r) => { open = r; }) });
  const w = yardWorld({ pieces: [yardPiece()], trees });
  await w.run(2);
  assert.deepEqual([w.yards.yards().length, live(w.made).length], [1, 0], 'the yard stands; its tree\'s data still loading');
  w.shift[0] = -100;
  w.yards.rebase();
  open();
  await w.run(1);
  const [far] = live(w.made);
  const [set] = w.yards.treeSets();
  const at = far.centers[0].map((v, i) => v + (far.origin ?? [0, 0, 0])[i]);
  assert.deepEqual(at, [set.ox + set.centers[0][0], set.oy + set.centers[0][1], set.oz + set.centers[0][2]], 'the far picture where its 3D tree stands');
  assert.deepEqual(at, [-82, 0, 12], 'where the yard stands now - its piece 8 m along from the yard\'s frame, the pixel 100 m back');
  await w.run(2);
  assert.deepEqual([live(w.made).length, live(w.made)[0]], [1, far], 'the yard\'s own sync sees nothing to set again - it stays where it stands');
});

test('DECOR-LPT the tree leaves with its piece: a piece taken up takes its tree from the near set and lets its handle go; a season\'s turn stands the winter twin\'s tree and lets the summer one go; a yard taken down with its pixel lets every handle go and leaves no tree in the near set (mutant: DECORLPT-release-lost)', async () => {
  const trees = fakeTrees();
  const w = yardWorld({ pieces: [yardPiece(), yardPiece({ id: 'p2', pos: [-8, 0, 2] })], trees });
  await w.run();
  const summer = trees.made.get('504_12');
  assert.deepEqual([summer.refs, w.yards.treeSets()[0].centers], [2, [[8, 0, 2], [-8, 0, 2]]]);
  w.yards.yards()[0].pool.remove('p2');
  assert.deepEqual([summer.refs, w.yards.treeSets()[0].centers], [1, [[8, 0, 2]]], 'taken up: its tree gone from the near set, its hold let go');
  w.built.set('0,0', w.pixel(SEASON.Winter));
  await w.run(1);
  const winter = trees.made.get('505_12');
  assert.deepEqual([summer.refs, winter.refs], [0, 2], 'the summer trees let go, the winter twin\'s held - one a piece (the town\'s answer, which the pool\'s own remove never wrote, stands both again)');
  assert.deepEqual(w.yards.treeSets()[0].handles, [winter]);
  assert.deepEqual(live(w.made).map((b) => [b.a, b.r]), [[505, '12#lpt'], [505, '12#lpt']]);
  w.built.delete('0,0');
  await w.run(1);
  assert.deepEqual([winter.refs, w.yards.treeSets().length, live(w.made).length], [0, 0, 0], 'its pixel streamed out: nothing held, nothing standing');
});

test('DECOR-LPT where the mod stands no tree - a record it has none for, its data that will not load - the piece stands as its picture, as it did (mirrored when turned half round), and holds nothing', async () => {
  for (const trees of [fakeTrees({ protos: [] }), fakeTrees({ loads: false })]) {
    const w = yardWorld({ pieces: [yardPiece({ rot: [180, 0, 0] })], trees });
    await w.run();
    const [pic] = live(w.made);
    assert.deepEqual([pic.a, pic.r, pic.size, pic.lptProto, pic.scales], [504, 12, { w: -sized(40, 120, 2).w, h: sized(40, 120, 2).h }, undefined, null]);
    assert.equal(w.yards.treeSets().length, 0);
  }
});

test('DECOR-LPT the decorator\'s ghost: a tree chosen in a yard shows the picture it will stand as - Low Poly Trees\' far picture, in the yard\'s season, never mirrored - its handle held while it is placed and let go when the placing ends (mutants: DECORLPT-ghost-classic, DECORLPT-ghost-mirrored, DECORLPT-ghost-held)', async () => {
  const trees = fakeTrees();
  const w = yardWorld({ pieces: [], season: SEASON.Winter, own: true, trees });
  await w.run(2);
  const tool = w.yards.tool();
  assert.equal(tool.openPanel(), true);
  await w.run(12, true);
  const panel = w.doc.body.children.find((c) => c.className === 'dfdecor');
  rows(panel).find((r) => r.dataset.key === 'f504.12').fire('click');
  all(panel, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  for (let i = 0; i < 6 && !tool.ghost(); i++) await w.run(1);
  const [ghost] = tool.batches();
  const handle = trees.made.get('505_12');
  const sc = tool.ghost().scale;
  assert.deepEqual([ghost?.a, ghost?.r], [505, '12#lpt'], 'the winter twin\'s tree, as it will stand');
  assert.deepEqual(ghost.size, { w: (handle.size.w / LPT_SCALE_MAX) * sc, h: (handle.size.h / LPT_SCALE_MAX) * sc });
  assert.equal(handle.refs, 1, 'held while it is placed');
  for (let i = 0; i < 8; i++) w.win.fire('keydown', { code: 'ArrowRight' });   // eight steps of fifteen: 120 degrees
  await w.run(1);
  assert.ok(Math.abs(tool.ghost().rot[0]) > 90 && ghost.size.w > 0, 'turned half round, the tree\'s picture never mirrors - as it will stand');
  tool.back();
  assert.equal(handle.refs, 0, 'let go when the placing ends');
});

test('DECOR-LPT AUDIT 05b A6: a ghost whose own texture will not load still flies as the host\'s picture, and lets it go when the placing ends - a failed ask never throws a held picture away with it (mutant: DECORLPT-ghost-leaks)', async () => {
  let held = 0;
  const rig = toolRig({
    getTexture: async (a) => { if (a === 209) throw new Error('the archive would not load'); return { recordCount: 64, getSize: () => ({ width: 16, height: 32 }), getScale: () => ({ width: 0, height: 0 }) }; },
    flatPicture: async () => { held++; return { archive: 504, key: '12#lpt', size: { w: 2, h: 4 }, mirrors: false, release: () => { held--; } }; },
  });
  await placeFrom(rig, 'f209.0');
  for (let i = 0; i < 4 && !rig.tool.ghost(); i++) { rig.frame(); await new Promise((r) => setTimeout(r, 0)); }
  const [ghost] = rig.tool.batches();
  assert.deepEqual([ghost?.archive, ghost?.record, held], [504, '12#lpt', 1], 'the host\'s picture, held while it is placed');
  rig.tool.back();
  assert.equal(held, 0, 'let go when the placing ends');
});

test('DECOR-LPT the same door without the mod: under Seasons of the Iliac Bay a tree\'s ghost is the mod\'s picture of the season, as the piece will stand - never the classic record it does not stand as (mutant: DECORLPT-ghost-classic)', async () => {
  const seasonal = { installedSeason: 2, lookup: (a, r) => (a === 504 && r === 12 ? { texture: { image: { width: 8, height: 8 } }, size: { w: 3, h: 9 } } : null) };
  const w = yardWorld({ pieces: [], own: true, seasonal });
  await w.run(2);
  const tool = w.yards.tool();
  assert.equal(tool.openPanel(), true);
  await w.run(12, true);
  const panel = w.doc.body.children.find((c) => c.className === 'dfdecor');
  rows(panel).find((r) => r.dataset.key === 'f504.12').fire('click');
  all(panel, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  for (let i = 0; i < 6 && !tool.ghost(); i++) await w.run(1);
  const [ghost] = tool.batches();
  const sc = tool.ghost().scale;
  assert.deepEqual([ghost?.a, ghost?.r, ghost?.size], [504, '12#season2', { w: 3 * sc, h: 9 * sc }]);
});

test('DECOR-LPT a yard\'s near set, as the world reads one (yardTreeSet): a handle each, LPT_SET_FLOATS a tree, each tree\'s centre its own place', () => {
  const a = { a: 1 }, b = { b: 1 };
  const set = yardTreeSet([{ handle: a, pos: [1, 2, 3], scale: 1.5, yaw: 0.5 }, { handle: b, pos: [4, 5, 6], scale: 1, yaw: 0 }, { handle: a, pos: [7, 8, 9], scale: 2, yaw: 1 }]);
  assert.deepEqual(set.handles, [a, b]);
  assert.equal(set.trees.length, 3 * LPT_SET_FLOATS);
  assert.deepEqual([...set.trees], [0, 1, 2, 3, 1.5, 0.5, 1, 4, 5, 6, 1, 0, 0, 7, 8, 9, 2, 1]);
  assert.deepEqual(set.centers, [[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
});

test('DECOR-LPT the hosts: the world hands its Low Poly Trees to the yards and gathers their near sets with its pixels\'; the yards hand it to their nature - THE FOUR HOSTS: the yards stand in world.js alone (mutant: DECORLPT-world-unwired)', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /trees: lowPolyTrees \? \{ door: lowPolyTrees, sway: \(proto, share\) => _lptSway\.set\(proto, Math\.max\(_lptSway\.get\(proto\) \?\? 0, share\)\) \} : null,/);
  assert.match(world, /for \(const set of yards\?\.treeSets\(\) \?\? \[\]\) _lptSets\.push\(set\);/);
  assert.match(src('src/scenes/homeYards.js'), /createYardNature\(\{[^}]*trees: deps\.trees \?\? null \}\)/);
  for (const host of ['src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(src(host), /createHomeYards\(/, `${host} stands no yard`);
});
