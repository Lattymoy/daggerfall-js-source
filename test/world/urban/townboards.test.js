// TOWN-BOARDS (the owner's field report, 2026-10-27, item 3: "Random wooden board placement in smaller towns on the ground";
// bible/03-World/Urban-Fabric.md section 9) - THE BOARDS ON THE GROUND, and the two rules of URBANIZER's fabric that laid
// them:
//   - THE PAVEMENT ROUND THE CARRIAGEWAY. A main street's pavement had been its cells between FABRIC.carriage and 3.5 of
//     the walk in straight lines - a band a cell wide that met its next cell at a corner alone at every step of the walk
//     (four ways: a staircase wherever the street turns or runs aslant). Over every hamlet past the Bay 31,419 of the
//     40,052 pavement pieces under four cells were such steps (over every city 27,845 of 36,045): single flags apart in the
//     stone styles, single boards on the forest floor in the planks' (Valenwood, Black Marsh - no carriageway between
//     them). Now it is the carriageway's ring by the eight ways, FABRIC.kerb deep: its cells side by side round every step.
//   - THE FABRIC ON THE TOWN'S GROUND. The plan took every cell of a town's blocks for the town's, but TS2 flattens only
//     its outline (world/terrain/terrainTiles.js townGroundMask) and eases the rest back to the land; the fabric stands at
//     the flattened level, so a yard planned past the outline was fenced down the land's slope - its fence buried to its
//     top rail (a board on the ground) or hung - at a village's and a hamlet's edges (a city past the Bay stands on its
//     wall's round, its whole inside its ground). Now a cell past the town's ground is off the town (world/townShape.js
//     onTownTile - the walkers' own law): its yard fenced where the ground ends.
//   - THE PAVEMENT IS A WALK (TOWN-BOARDS 2, the owner: "No band aids or half assed work"). The ring left pavements a few
//     cells long - before a short house front, between two of Daggerfall's props, two pavements meeting at a corner where
//     a street squeezes between two houses - each a lone flag, or a lone board on the forest floor in the planks' styles.
//     Now two pavements meeting at a corner across the street's ground are joined there, and a pavement shorter than
//     FABRIC.paveLeast (6.4 m) is not laid: its cells the street's own surface (paveWalks). The carriageway is the cells
//     the walk reaches (never a pocket past a wall's corner), and a piece of it no walk runs down and as short - a cell
//     of setts the houses' pavements close round - is the pavement's.
//   - THE PAINTED ROADS ARE THE TOWN'S (TOWN-BOARDS 2). The fabric read Daggerfall's own roads alone; a road the terrain
//     painted through the town (TS10's paths, the walkers' and the merchant yards' roads) could be a yard's grass, fenced
//     across. Now a painted cell is a road of the town's (fabricGrid `onRoad`): no yard, fence or woodpile on it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fabricGrid, fabricPlan, labelPieces, paveWalks, FABRIC, FABRIC_KIND as K, FABRIC_CELLS } from '../../../src/world/urban/townFabric.js';
import { townFabricFor, townFabricOf, fabricGroundKey, _resetTownFabrics } from '../../../src/world/urban/townFabricStand.js';
import { onTownTile, shutOffGround } from '../../../src/world/townShape.js';
import { getLocationTerrainTileOrigin } from '../../../src/world/terrain/terrainTiles.js';
import { hasCustomModel } from '../../../src/world/customModels.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const C = FABRIC_CELLS;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A block of our own (urban3_fabric.test.js's): its town map's rects (rows from the north), its ground a function of the
 *  town map's (row, column). */
function block({ ground = () => 1, rects = [] } = {}) {
  const automap = new Uint8Array(C * C);
  for (const [r0, r1, c0, c1, b] of rects) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) automap[r * C + c] = b;
  return { automap, ground: (tx, ty) => ground(ty * 4, tx * 4), records: [] };
}

/** The pavements' pieces (four ways) and the steps between them: two pieces meeting at a corner alone across the town's
 *  open ground (neither cell that would join them built or off the town). */
function pavements(plan) {
  const { W, H } = plan, pave = Uint8Array.from(plan.kind, (k) => (k === K.pave ? 1 : 0)), { id, sizes } = labelPieces(W, H, pave);
  let steps = 0;
  for (let i = 0; i < id.length; i++) {
    if (id[i] < 0) continue;
    const x = i % W;
    for (const [dx, dz] of [[1, 1], [-1, 1]]) {
      const j = i + dz * W + dx;
      const open = (c) => plan.kind[c] !== K.off && plan.kind[c] !== K.built;
      if (x + dx >= 0 && x + dx < W && j < id.length && id[j] >= 0 && id[j] !== id[i] && open(i + dx) && open(i + dz * W)) steps++;
    }
  }
  return { sizes, steps };
}

test('TOWN-BOARDS the pavement round the carriageway: a main street that turns a corner (Daggerfall\'s road east and then north) is paved unbroken round it - its outer pavement and its inner one, two pieces and no step where one meets the next at a corner alone; every pavement cell beside or across a corner of the carriageway, every open cell beside or across a corner of the carriageway its pavement (the ring whole), every carriageway cell within FABRIC.carriage of the walk and every cell within it the carriageway (mutants: the old band in straight lines; the ring by four ways; no ring; the kerb two deep)', () => {
  // the road a tile wide along tile row 8 from the west edge to column 8, and up column 8 to the north edge
  const road = (r, c) => ((r >> 2) === 8 && (c >> 2) <= 8) || ((c >> 2) === 8 && (r >> 2) <= 8);
  const g = fabricGrid(1, 1, () => block({ ground: (r, c) => (road(r, c) ? 46 : 1) }));
  const plan = fabricPlan(g, { ends: [[0, 30], [34, C]], centre: [34, 30], seed: 1 });
  assert.equal(plan.paths.length, 2);
  const { sizes, steps } = pavements(plan);
  assert.equal(steps, 0, 'no pavement meets the next at a corner alone');
  assert.equal(sizes.length, 2, `the outer pavement and the inner one (${sizes.join(' ')})`);
  assert.ok(Math.min(...sizes) > 40, `each a street long (${sizes.join(' ')})`);
  const walk = plan.paths.flat(), dist = (i) => Math.min(...walk.map((p) => Math.hypot((p % C) - (i % C), Math.floor(p / C) - Math.floor(i / C))));
  for (let i = 0; i < plan.kind.length; i++) {
    if (plan.kind[i] === K.main) assert.ok(dist(i) <= FABRIC.carriage + 1e-9, 'the carriageway within FABRIC.carriage');
    // the carriageway whole: no house near, every open cell within FABRIC.carriage of the walk is the carriageway - the ring
    // round it joins nothing through it (the band in straight lines left steps the joins would have closed through it)
    if (g.town[i] && !g.built[i] && dist(i) <= FABRIC.carriage + 1e-9) assert.equal(plan.kind[i], K.main, `the carriageway at ${i % C},${Math.floor(i / C)}`);
    if (plan.kind[i] !== K.pave) continue;
    const x = i % C, z = Math.floor(i / C);
    let beside = false;
    for (let dz = -FABRIC.kerb; dz <= FABRIC.kerb; dz++) for (let dx = -FABRIC.kerb; dx <= FABRIC.kerb; dx++) {
      const j = (z + dz) * C + x + dx;
      if (x + dx >= 0 && x + dx < C && j >= 0 && j < plan.kind.length && plan.kind[j] === K.main) beside = true;
    }
    assert.ok(beside, 'a pavement round the carriageway');
  }
  // the ring whole: every open cell beside the carriageway or across its corner is its pavement (or the carriageway)
  for (let i = 0; i < plan.kind.length; i++) {
    if (plan.kind[i] !== K.main) continue;
    const x = i % C, z = Math.floor(i / C);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const j = (z + dz) * C + x + dx;
      if (x + dx < 0 || x + dx >= C || j < 0 || j >= plan.kind.length || !g.town[j] || g.built[j]) continue;
      assert.ok(plan.kind[j] === K.main || plan.kind[j] === K.pave, `the ring at ${x + dx},${z + dz}`);
    }
  }
  assert.equal(FABRIC.kerb, 1);
});

/** A street of our own, its kinds drawn as rows of letters (the first row the grid's north): M the carriageway, P a
 *  pavement, B built, . the open ground. */
function street(rows) {
  const H = rows.length, W = rows[0].length, kind = new Uint8Array(W * H);
  const of = { M: K.main, P: K.pave, B: K.built, '.': K.open };
  rows.forEach((row, r) => { for (let x = 0; x < W; x++) kind[(H - 1 - r) * W + x] = of[row[x]]; });
  const draw = () => rows.map((_, r) => [...Array(W)].map((__, x) => Object.keys(of).find((k) => of[k] === kind[(H - 1 - r) * W + x])).join(''));
  return { g: { W, H }, kind, draw };
}

test('TOWN-BOARDS 2 the pavement is a walk: two pavements meeting at a corner alone across the street\'s ground joined there (the carriageway\'s cell first), never across a building\'s corner; a pavement shorter than FABRIC.paveLeast (6.4 m) along its longer side not laid - the carriageway\'s where it meets it, no street\'s where it does not; one as long kept (mutants: the join unmade; the join through a building; the least unread; a short piece left; the carriageway\'s surface not taken)', () => {
  assert.equal(FABRIC.paveLeast, 4);   // cells: 6.4 m, one of Daggerfall's ground tiles
  // a neck between two houses' corners: the two pavements meet at a corner across the carriageway - joined
  const neck = street([
    'BBBBPPPPPP',
    'BBBBPMMMMM',
    'PPPPPMMMMM',
    'MMMMMPPPPP',
    'MMMMMPBBBB',
  ]);
  paveWalks(neck.g, neck.kind);
  assert.deepEqual(neck.draw(), [
    'BBBBPPPPPP',
    'BBBBPMMMMM',
    'PPPPPMMMMM',
    'MMMMPPPPPP',
    'MMMMMPBBBB',
  ], 'joined through the carriageway\'s cell between them (the lower, the grid\'s first)');
  // two buildings' corners between them: no ground to join on - both kept as they are, each a walk
  const corner = street([
    'PPPPB....',
    'MMMBPPPPP',
  ]);
  paveWalks(corner.g, corner.kind);
  assert.deepEqual(corner.draw(), ['PPPPB....', 'MMMBPPPPP']);
  // a short pavement meeting the carriageway its surface, one meeting none no street's; one FABRIC.paveLeast long kept
  const s = street([
    '..........',
    '.PPP....P.',
    '.MMMMMMM..',
    '.MMMMMMMPP',
    'PPPPB.....',
    '....BPPPP.',
  ]);
  paveWalks(s.g, s.kind);
  assert.deepEqual(s.draw(), [
    '..........',
    '.MMM......',
    '.MMMMMMM..',
    '.MMMMMMMMM',
    'PPPPB.....',
    '....BPPPP.',
  ]);
});

test('TOWN-BOARDS 2 no setts island: a piece of the carriageway no walk runs down and shorter than FABRIC.paveLeast is the pavement\'s where it meets it, no street\'s where it does not; one a walk runs down, or as long, kept; none without the walks handed (mutants: the islands unread; an island walked taken; a long island taken; an island\'s surface not taken)', () => {
  const s = street([
    '.PPPPP......',
    '.PMPPP.MM...',
    '.PPPPP......',
    '............',
    'MMMMMM....MM',
  ]);
  const walk = new Uint8Array(s.kind.length);
  walk[10] = walk[11] = 1;   // the last row's two cells at its east end: a walk runs down them
  const before = s.draw();
  paveWalks(s.g, s.kind);
  assert.deepEqual(s.draw(), before, 'no walks handed: no island read');
  paveWalks(s.g, s.kind, walk);
  assert.deepEqual(s.draw(), [
    '.PPPPP......',
    '.PPPPP......',
    '.PPPPP......',
    '............',
    'MMMMMM....MM',
  ]);
});

/** A street between two thin walls (Daggerfall's town map bytes past its houses': built, no house), the land beyond them
 *  built too, Daggerfall's road under it (town map rows 32-35); `rects` more of the town map. The walk runs from the west
 *  end (the centre kept clear there) to both ends. */
function corridor(rects) {
  const all = [[0, 28, 0, 63, 30], [37, 63, 0, 63, 30], ...rects];
  const g = fabricGrid(1, 1, () => block({ ground: (r) => (r >= 32 && r <= 35 ? 46 : 1), rects: all }));
  const plan = fabricPlan(g, { ends: [[0, C - 33], [C, C - 33]], centre: [2, C - 33], seed: 1 });
  const walk = plan.paths.flat(), dist = (i) => Math.min(...walk.map((p) => Math.hypot((p % C) - (i % C), Math.floor(p / C) - Math.floor(i / C))));
  return { g, plan, walk: new Set(walk), dist, at: (r, c) => (C - 1 - r) * C + c };
}

test('TOWN-BOARDS 2 the carriageway is the street\'s own: a cell within FABRIC.carriage of the walk past a wall - a pocket the street never reaches - is neither the carriageway nor its pavement; a cell of setts the houses\' pavements close round is the pavement\'s, every piece of the carriageway a walk\'s or a walk long (mutants: the carriageway unreached; the walks unhanded)', () => {
  // the street two cells wide (rows 32-33) between walls at rows 31 and 34; pockets along rows 30 and 35 closed round
  const a = corridor([[29, 29, 8, 55, 30], [31, 31, 8, 55, 30], [30, 30, 8, 8, 30], [30, 30, 55, 55, 30], [34, 34, 8, 55, 30], [36, 36, 8, 55, 30], [35, 35, 8, 8, 30], [35, 35, 55, 55, 30]]);
  assert.equal(a.plan.paths.length, 2);
  let pocket = 0;
  for (const r of [30, 35]) {
    for (let c = 9; c <= 54; c++) {
      const i = a.at(r, c);
      assert.ok(a.g.town[i] && !a.g.built[i], `the pocket open at ${r},${c}`);
      if (a.dist(i) <= FABRIC.carriage) pocket++;
      assert.ok(a.plan.kind[i] !== K.main && a.plan.kind[i] !== K.pave, `no street in the pocket at ${r},${c}`);
    }
  }
  assert.ok(pocket >= 40, `a pocket within FABRIC.carriage of the walk (${pocket} cells)`);
  // a street three cells wide between house fronts, turning north where a house closes it; a grass alley three cells wide
  // off its south side at the turn (the shape of the hamlets' islands the sweep found - Aldingleigh's, template 617): the
  // alley's mouth's middle cell within the carriageway and nearer no house than FABRIC.pave, every cell round it a
  // house's pavement or joined to it
  const b = drawnTown([
    'HHHHHHHHHHHHHHHHrrrrrrrrrr',
    'rrrrrrrrrrrrrrrrrrrrrrrrrr',
    'rrrrrrrrrrrrrrrrrHHHHHHHHH',
    'rrrrrrrrrrrrrrrrrHHHHHHHHH',
    'HHHHHHHHHHHHHHgggHHHHHHHHH',
    'HHHHHHHHHHHHHHgggHHHHHHHHH',
    'HHHHHHHHHHHHHHgggHHHHHHHHH',
  ], { ends: [[0.5, 4.5]], centre: [23.5, 6.5] });
  const island = b.at(4, 15);
  assert.ok(b.dist(island) <= FABRIC.carriage, 'the alley\'s mouth within the carriageway');
  assert.equal(b.plan.kind[island], K.pave, 'the island the pavement\'s');
  const { id, sizes } = labelPieces(b.g.W, b.g.H, Uint8Array.from(b.plan.kind, (k) => (k === K.main ? 1 : 0))), cells = sizes.map(() => []);
  for (let i = 0; i < id.length; i++) if (id[i] >= 0) cells[id[i]].push(i);
  for (const piece of cells) {
    if (piece.some((i) => b.walk.has(i))) continue;
    const xs = piece.map((i) => i % b.g.W), zs = piece.map((i) => Math.floor(i / b.g.W));
    assert.ok(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) + 1 >= FABRIC.paveLeast, `a setts island of ${piece.length} at ${xs[0]},${zs[0]}`);
  }
});

/** A town's grid of our own, its cells drawn as rows of letters (the first row the grid's north): H a house, r Daggerfall's
 *  road, g its grass, . open ground - planned with `o` (fabricPlan's ends and centre). */
function drawnTown(rows, o) {
  const H = rows.length, W = rows[0].length, n = W * H;
  const g = { w: 1, h: 1, W, H, town: new Uint8Array(n).fill(1), built: new Uint8Array(n), house: new Uint8Array(n), grass: new Uint8Array(n), road: new Uint8Array(n) };
  rows.forEach((row, r) => {
    for (let x = 0; x < W; x++) {
      const i = (H - 1 - r) * W + x, c = row[x];
      g.built[i] = g.house[i] = c === 'H' ? 1 : 0;
      g.grass[i] = c === 'g' ? 1 : 0;
      g.road[i] = c === 'r' ? 1 : 0;
    }
  });
  const plan = fabricPlan(g, { ...o, seed: 1 });
  const walk = plan.paths.flat(), dist = (i) => Math.min(...walk.map((p) => Math.hypot((p % W) - (i % W), Math.floor(p / W) - Math.floor(i / W))));
  return { g, plan, walk: new Set(walk), dist, at: (r, c) => (H - 1 - r) * W + c };
}

test('TOWN-BOARDS 2 the painted roads: a road the terrain painted across a yard\'s grass is a road of the town\'s - no yard\'s cell, fence edge, gate or woodpile on it, the yards fenced along its sides; the stand plans again when the roads land (mutants: the roads unread; the stand\'s roads dropped; the key blind to the roads; the host unwired)', async () => {
  // a house in the middle and Daggerfall's grass behind it to the block's east edge; a road painted north-south over x 40-47
  const b = () => block({ ground: (r, c) => (r >= 10 && r < 40 && c >= 20 ? 2 : 1), rects: [[20, 39, 10, 19, 18]] });
  const onRoad = (x) => x >= 40 && x < 48;
  const g = fabricGrid(1, 1, b, { onRoad }), bare = fabricGrid(1, 1, b);
  for (let i = 0; i < C * C; i++) if (onRoad(i % C) && bare.grass[i]) { assert.equal(g.road[i], 1); assert.equal(g.grass[i], 0); }
  const plan = fabricPlan(g, { ends: [], mains: false, seed: 3 }), was = fabricPlan(bare, { ends: [], mains: false, seed: 3 });
  const on = (i) => onRoad(i % C);
  assert.ok(was.fences.some((e) => on(e.inner)) || was.kind.some((k, i) => k === K.yard && on(i)), 'unread, a yard across the road');
  for (const e of [...plan.fences, ...plan.gates]) assert.ok(!on(e.inner), 'no fence on the road');
  for (const p of plan.props) assert.ok(!on(p.cell), 'no woodpile on the road');
  for (let i = 0; i < plan.kind.length; i++) if (on(i)) assert.notEqual(plan.kind[i], K.yard);
  assert.ok(plan.fences.some((e) => e.dir === 0 && (e.inner % C) === 39), 'the yard fenced along the road\'s west side');
  // the stand: planned on the painted roads it is handed, again when they land
  _resetTownFabrics();
  // each block's grass behind its house on its first eight tile columns alone (a yard a block)
  const yarded = (x, name) => { const b0 = laid(x, name); b0.dfBlock.rmbBlock.fldHeader.groundData.groundTiles.forEach((col, tx) => col.forEach((t, ty) => { if (ty < 3 && tx >= 8) t.textureRecord = 1; })); return b0; };
  const town = loc({ mapId: 0xa7000202 }), blocks = [yarded(0), yarded(1, 'RESIAA01.RMB')], at = { px: 100, py: 100 }, o = getLocationTerrainTileOrigin(town);
  const ground = groundOf(town, () => true), paths = new Uint8Array(128 * 128);
  for (let ty = 0; ty < 16; ty++) paths[(o.x + 3) + (o.y + ty) * 128] = 1;   // a road up the first block's tile column 3: cells x 12-15
  const roadless = await townFabricFor(town, blocks, { ...at, ground });
  const landed = await townFabricFor(town, blocks, { ...at, ground, paths });
  assert.notEqual(landed, roadless, 'the roads landed: planned again');
  assert.equal(hasCustomModel(roadless.modelId), false);
  assert.ok(roadless.plan.kind.some((k, i) => k === K.yard && (i % (2 * C)) >= 12 && (i % (2 * C)) < 16), 'roadless, its yard over the road\'s cells');
  for (let i = 0; i < landed.plan.kind.length; i++) if ((i % (2 * C)) >= 12 && (i % (2 * C)) < 16) assert.notEqual(landed.plan.kind[i], K.yard);
  assert.equal(await townFabricFor(town, blocks, { ...at, ground, paths: Uint8Array.from(paths) }), landed, 'the same roads: kept');
  assert.notEqual(fabricGroundKey(ground, paths, o, 32, 16), fabricGroundKey(ground, null, o, 32, 16));
  assert.equal(fabricGroundKey(null, null, o, 32, 16), '');
  _resetTownFabrics();
  assert.match(rd('src/scenes/pixelBuild.js'), /ground: townGround, paths \}\);/);
});

test('TOWN-BOARDS the fabric on the town\'s ground: a cell its ground refuses is off the town - a yard reaching past it fenced where the ground ends, never down the land past it; nothing of the fabric (a fence, a gate, a wall, a woodpile, a pavement, a carriageway) on a refused cell; no refusal, every cell of the blocks the town\'s (mutants: the ground unread)', () => {
  // a house in the middle and Daggerfall's grass behind it to the block's east edge; the ground the town's west of column 48
  const b = () => block({ ground: (r, c) => (r >= 10 && r < 40 && c >= 20 ? 2 : 1), rects: [[20, 39, 10, 19, 18]] });
  const onGround = (x) => x < 48;
  const g = fabricGrid(1, 1, b, { onGround }), whole = fabricGrid(1, 1, b);
  for (let i = 0; i < C * C; i++) assert.equal(g.town[i], (i % C) < 48 ? 1 : 0);
  assert.equal(whole.town.reduce((a, v) => a + v, 0), C * C, 'no refusal, the whole block');
  assert.equal(g.house.reduce((a, v) => a + v, 0), whole.house.reduce((a, v) => a + v, 0), 'its houses read whatever its ground');
  const plan = fabricPlan(g, { ends: [], mains: false, seed: 3 }), wide = fabricPlan(whole, { ends: [], mains: false, seed: 3 });
  assert.ok(plan.counts.yards >= 1 && wide.counts.yards >= 1);
  const off = (i) => (i % C) >= 48;
  for (const e of [...plan.fences, ...plan.gates, ...plan.walls]) assert.ok(!off(e.inner), 'every edge on the ground');
  for (const p of plan.props) assert.ok(!off(p.cell), 'every woodpile on the ground');
  for (let i = 0; i < plan.kind.length; i++) if (off(i)) assert.equal(plan.kind[i], K.off);
  // the yard fenced along the ground's edge: its east run at column 48's west side
  const edge = plan.fences.filter((e) => (e.inner % C) === 47 && e.dir === 0);
  assert.ok(edge.length >= 10, `the yard's fence along the ground's edge (${edge.length})`);
  assert.ok(wide.fences.some((e) => off(e.inner)), 'the whole block\'s yard ran past it');
});

/** A location past the Bay of our own (urban3_stand.test.js's): two blocks, an Arena place. */
const loc = (o = {}) => ({ name: 'T', arena: { province: 'Skyrim' }, mapTableData: { mapId: o.mapId ?? 0xa7000101, locationType: LOCATION_TYPES.TownHamlet }, exterior: { exteriorData: { width: 2, height: 1, blockNames: ['RESIAA00.RMB', 'RESIAA01.RMB'] } } });
const laid = (x, name = 'RESIAA00.RMB') => {
  const autoMapData = new Uint8Array(64 * 64);
  for (let r = 10; r <= 24; r++) for (let c = 8; c <= 24; c++) autoMapData[r * 64 + c] = 18;
  const groundTiles = Array.from({ length: 16 }, () => Array.from({ length: 16 }, (_, ty) => ({ textureRecord: ty === 8 ? 46 : ty < 3 ? 2 : 1 })));
  return { x, y: 0, blockName: name, dfBlock: { rmbBlock: { fldHeader: { autoMapData, groundData: { groundTiles } }, misc3dObjectRecords: [], miscFlatObjectRecords: [] } } };
};
/** A ground mask of the pixel's tiles: the town's where `keep(tx, ty)` (its grid's tile, x east, y north). */
function groundOf(town, keep) {
  const o = getLocationTerrainTileOrigin(town), m = new Uint8Array(128 * 128);
  for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 32; tx++) if (keep(tx, ty)) m[(o.x + tx) + (o.y + ty) * 128] = 1;
  return m;
}

test('TOWN-BOARDS one ground law: a cell of a town\'s grid is on its ground where its tile is the town\'s - the walkers shut off it (shutOffGround) and the fabric planned on it (onTownTile), cell for cell (mutants: the tiles turned)', () => {
  const town = loc(), o = getLocationTerrainTileOrigin(town), ground = groundOf(town, (tx, ty) => (tx * 7 + ty * 3) % 5 !== 0 && tx < 29);
  const nav = { width: 2 * C, height: C, grid: new Uint8Array(2 * C * C).fill(0x10) };
  shutOffGround(nav, ground, o);
  for (let gy = 0; gy < C; gy++) for (let gx = 0; gx < 2 * C; gx++) {
    const on = onTownTile(ground, o, gx, gy), tx = gx >> 2, ty = gy >> 2;
    assert.equal(on, (tx * 7 + ty * 3) % 5 !== 0 && tx < 29, `cell ${gx},${gy}`);
    assert.equal(nav.grid[gy * nav.width + gx] !== 0, on);
  }
  assert.equal(onTownTile(ground, { x: 126, y: 0 }, 12, 0), false, 'past the pixel none');
});

test('TOWN-BOARDS the stand plans on the ground it is handed: the plan\'s town its ground\'s; kept while asked on the same ground, planned again on another (its old model off the door) and none for no ground - its whole grid; a build that planned it meanwhile kept for both, its model never pulled from under a build in flight (mutants: the stand\'s ground dropped; the plan kept on another ground; the old model left on the door; the ground\'s key blind; the meanwhile planned over)', async () => {
  _resetTownFabrics();
  const town = loc(), blocks = [laid(0), laid(1, 'RESIAA01.RMB')], at = { px: 100, py: 100 };
  const half = groundOf(town, (tx) => tx < 24), all = groundOf(town, () => true);
  const a = await townFabricFor(town, blocks, { ...at, ground: half });
  for (let i = 0; i < a.plan.kind.length; i++) if ((i % (2 * C)) >= 96) assert.equal(a.plan.kind[i], K.off, 'past the ground none');
  assert.ok(a.plan.kind.some((k, i) => (i % (2 * C)) < 96 && k !== K.off));
  assert.equal(await townFabricFor(town, blocks, { ...at, ground: Uint8Array.from(half) }), a, 'the same ground: kept');
  assert.equal(townFabricOf(town), a);
  const b = await townFabricFor(town, blocks, { ...at, ground: all });
  assert.notEqual(b, a, 'another ground: planned again');
  assert.equal(hasCustomModel(a.modelId), false, 'its old model off the door');
  assert.ok(hasCustomModel(b.modelId));
  assert.ok(b.plan.kind.some((k, i) => (i % (2 * C)) >= 96 && k !== K.off), 'the whole ground its own');
  assert.notEqual(fabricGroundKey(half, null, getLocationTerrainTileOrigin(town), 32, 16), fabricGroundKey(all, null, getLocationTerrainTileOrigin(town), 32, 16));
  assert.equal(fabricGroundKey(null, null, { x: 0, y: 0 }, 32, 16), '');
  const none = await townFabricFor(town, blocks, at);
  assert.notEqual(none, b);
  assert.equal(none.plan.kind.filter((k) => k === K.off).length, 0, 'no ground: its whole grid');
  // two builds of one town in flight: the one that lands first is kept for both - its model never pulled from under the
  // build that has it in hand - and a later build on the other ground plans it again
  _resetTownFabrics();
  let release;
  const held = new Promise((r) => { release = r; });
  const slow = townFabricFor(town, blocks, { ...at, ground: half, breathe: () => held });
  const quick = await townFabricFor(town, blocks, { ...at, ground: all });
  release();
  assert.equal(await slow, quick, 'the one planned meanwhile');
  assert.ok(hasCustomModel(quick.modelId), 'its model still on the door');
  assert.equal(townFabricOf(town), quick);
  const again = await townFabricFor(town, blocks, { ...at, ground: half });
  assert.notEqual(again, quick, 'asked on its own ground after: planned again');
  assert.equal(hasCustomModel(quick.modelId), false);
  _resetTownFabrics();
});

test('TOWN-BOARDS the pixel build plans the fabric on the terrain job\'s townGround - the outline TS2 flattened, the same the walkers are shut by (mutants: the host unwired)', () => {
  const pb = rd('src/scenes/pixelBuild.js');
  // PIN MOVED (FB1028 YARDS): the job answers the yards' paths first (#1184's roads, the yards' own); FB1028 YARDS Y2: and their ground
  assert.match(pb, /const \{ yardPaths, yardGround, samples, [^\n]*townGround[^\n]* \} = await terrainGen\.generate\(\{/);
  // PIN MOVED (TOWN-BOARDS 2): and its painted roads, the job's paths
  assert.match(pb, /const \{ yardPaths, yardGround, samples, [^\n]*paths,[^\n]* \} = await terrainGen\.generate\(\{/);
  assert.match(pb, /const fabric = await townFabricFor\(dfLocation, loc\.blocks, \{ px, py, breathe: \(\) => breather\.breathe\(\), ground: townGround, paths \}\);/);
  assert.match(pb, /fabricWalkShut\(townWalkShut\(dfLocation, townGround, paths\), dfLocation\)/);
});

test('TOWN-BOARDS with ARENA2: the world\'s small towns on the player\'s data - past the Bay every 61st village, hamlet and city as cloned and outlined, no pavement step, no pavement shorter than FABRIC.paveLeast (a lone board, a lone flag), no setts island and nothing of the fabric off its ground; the towns whose fences the land buried or hung, laid on their pixels as the terrain kernel flattens them with a road every way through them, none buried or hung and nothing of the fabric on a painted road; on the Bay no town dressed by the fabric and no timber lying on the ground in any village\'s or hamlet\'s block', { skip: skipReal }, async () => {
  const sweep = await import('../../../tools/townBoardsSweep.mjs');
  const log = console.log;
  console.log = (...a) => { if (!/^\[worlddata\]/.test(String(a[0]))) log(...a); };
  try {
    const sw = await sweep.openSweep(ARENA2);
    let towns = 0, pieces = 0;
    for (const kind of sweep.SWEEP_KINDS) {
      for (let j = 0; j < sw.templates[kind].length; j += 61) {
        const loc = sweep.sweepClone(sw, kind, j), outline = sweep.outlineGround(sw, loc), { plan, g } = await sweep.sweepPlan(sw, loc, outline);
        const pc = sweep.paveReads(plan, g), off = sweep.offGround(plan, loc, outline);
        assert.deepEqual([pc.steps, pc.short, pc.islands], [0, 0, 0], `${kind} #${j} ${loc.name}: steps, short pavements, setts islands`);
        assert.deepEqual(off, { fences: 0, gates: 0, walls: 0, piles: 0, pave: 0, main: 0 }, `${kind} #${j} ${loc.name}`);
        towns++; pieces += pc.pieces;
      }
    }
    assert.ok(towns >= 50 && pieces > 300, `${towns} towns, ${pieces} pavement pieces`);   // TOWN-BOARDS 2: the lone slabs joined or taken up - 366 pieces over the 58 towns on the freeware, where there were more and shorter
    // the towns the sweep found buried or hung before TOWN-BOARDS (tools/townBoardsSweep.mjs --land 10, Urban-Fabric.md section 9)
    for (const [kind, j] of LAND_TOWNS) {
      const loc = sweep.sweepClone(sw, kind, j), L = sweep.sweepLand(sw, loc), { plan } = await sweep.sweepPlan(sw, loc, L.ground, L.paths);
      const r = sweep.onLand(plan, L.groundAt);
      assert.deepEqual([r.fenceBuried, r.fenceHung, r.pileBuried, r.pileHung, r.paveBuried], [0, 0, 0, 0, 0], `${kind} #${j} ${loc.name} at ${L.px},${L.py}`);
      assert.deepEqual(sweep.onRoads(plan, loc, L.paths), { fences: 0, gates: 0, piles: 0, yard: 0 }, `${kind} #${j} ${loc.name}: on a painted road`);
      assert.ok(L.paths.some((v) => v), 'a road painted');
    }
    const bay = sweep.bayBoards(sw);
    assert.ok(bay.towns > 3000 && bay.blocks > 200, `${bay.towns} towns, ${bay.blocks} blocks`);
    assert.equal(bay.fabric, 0, 'the Bay\'s towns are Daggerfall\'s');
    assert.equal(bay.wood, 0, `timber lying on the ground: ${[...bay.flat].map(([k, v]) => `${k} ${v}`).join(', ')}`);
  } finally {
    console.log = log;
  }
});

/** Towns past the Bay whose fabric the land buried or hung before TOWN-BOARDS (tools/townBoardsSweep.mjs --land 10, on
 *  the freeware; Urban-Fabric.md section 9): [kind, template index] - the villages Blackcester (25 fence edges buried,
 *  1.9 m), Lamdale (21 hung, 1.6 m) and Atruhisa (40 hung, 1.7 m); the hamlets Holmarket (56 buried, 13.1 m into its
 *  hillside, and a woodpile), Hortower Derry (43 hung, 2.0 m, and 20 cells of pavement under the land), Tunbeth (94 cells
 *  of pavement under the land) and Aldingmoth Wood (22 hung, 2.1 m). */
const LAND_TOWNS = Object.freeze([['village', 150], ['village', 400], ['village', 730], ['town', 1110], ['town', 530], ['town', 660], ['town', 1100]]);
