// EXACT-PIECES (2026-10-26, the owner: "No band aids"; bible/06-Systems/Travel-View.md EXACT-PIECES) - THE LAND'S PIECES AT
// THE PIXEL. FAST-REFUSAL's pieces are the trace's; a strait narrower than two of its centres is one piece there, and
// Mournhold to Ebonheart still spent the planner's whole count before "no way". The roads' regions label their cores' dry
// pixels by the planner's own water law as they are laid (world/tamrielLandPieces.js labelLand, world/tamrielRoads.js
// regionLand), the page joins them across the regions' edges as they land (systems/travel/landPieces.js), and once the
// build has landed whole a plan whose ends share no piece is refused before a cell is expanded.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { labelLand, landLabelOf } from '../../../src/world/tamrielLandPieces.js';
import { resetExactPieces, addExactPieces, apartExact, clearExactPieces } from '../../../src/systems/travel/landPieces.js';
import { planRoute, routeGround } from '../../../src/systems/travel/travelRoute.js';
import { MAP_W, MAP_H } from '../../../src/world/road/roadNetwork.js';

afterEach(() => { clearExactPieces(); });
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** A picture of land: rows of '#' (dry) and '.' (water). */
const pic = (rows) => (u, v) => rows[v]?.[u] === '#';   // the ring past the picture: water

test('EXACT-PIECES the labels: dry pixels four-connected (a diagonal touch between two waters is the planner\'s refused step - two pieces), numbered in reading order, the rows as runs (mutants: the joins, the runs)', () => {
  const rows = ['##..#', '##.#.', '....#', '#...#'];
  const L = labelLand(pic(rows), 5, 4);
  assert.equal(L.count, 5, 'the block, the corner pixel, the diagonal one, the east column, the south-west pixel');
  const at = (u, v) => landLabelOf(L, u, v);
  assert.deepEqual([at(0, 0), at(1, 1), at(4, 0), at(3, 1), at(4, 2), at(4, 3), at(0, 3)], [1, 1, 2, 3, 4, 4, 5]);
  assert.equal(at(2, 0), 0, 'water');
  assert.equal(at(9, 9), 0, 'off the core');
  assert.deepEqual([...L.rowStart], [0, 3, 7, 9, 12]);
  // a long run is cut at 65,535
  const wide = labelLand(() => true, 70000, 1);
  assert.deepEqual([...wide.runLen], [65535, 4465]);
  assert.equal(landLabelOf(wide, 69999, 0), 1);
});

test('EXACT-PIECES the joins: two regions\' pieces joined where dry pixels stand side by side across their edge; an edge on a core the build lays nothing in (or past the lattice) UNKNOWN - never told apart; nothing refused until every region has landed; an end on the water stands on its dry neighbours\' pieces (mutants: the edge, the UNKNOWN, the whole build, the water end)', () => {
  const lattice = { x0: 1000, y0: 0, cols: 3, rows: 1 };
  const region = (i) => ({ i, j: 0, core: { x0: 1000 + 4 * i, y0: 0, x1: 1004 + 4 * i, y1: 4 } });
  // region 0: an isle at its west edge, the land going on past the lattice's edge (its ring dry there: UNKNOWN), and a
  // strip at its east edge; region 1: the strip goes on, and an isle in its middle; region 2 is laid nothing (the sea)
  const west = (u, v) => (u === -1 && v === 0) || pic(['#..#', '#..#', '....', '....'])(u, v);
  const r0 = labelLand(west, 4, 4), r1 = labelLand(pic(['#...', '#.#.', '....', '....']), 4, 4);
  resetExactPieces(lattice, [region(0), region(1)]);
  addExactPieces(region(0), r0);
  assert.equal(apartExact({ x: 1003, y: 0 }, { x: 1006, y: 1 }), false, 'region 1 not yet landed: nothing said');
  addExactPieces(region(1), r1);
  assert.equal(apartExact({ x: 1003, y: 0 }, { x: 1004, y: 1 }), false, 'the strip across the edge: one piece');
  assert.equal(apartExact({ x: 1003, y: 0 }, { x: 1006, y: 1 }), true, 'the strip and the isle in region 1: apart');
  assert.equal(apartExact({ x: 1000, y: 0 }, { x: 1006, y: 1 }), false, 'the west isle touches the lattice\'s edge: UNKNOWN');
  assert.equal(apartExact({ x: 1006, y: 2 }, { x: 1003, y: 0 }), true, 'an end on the water below the isle (its dry neighbour (1006, 1))');
  assert.equal(apartExact({ x: 1005, y: 1 }, { x: 1003, y: 0 }), false, 'one between the strip and the isle stands on both');
  assert.equal(apartExact({ x: 1009, y: 1 }, { x: 1003, y: 0 }), false, 'an end in the region laid nothing: unknown');
  // a region laid nothing beside the strip's end: its edge UNKNOWN where the ring is dry, the sea where it is not
  resetExactPieces({ x0: 1000, y0: 0, cols: 3, rows: 1 }, [region(0), region(2)]);
  addExactPieces(region(0), labelLand((u, v) => (u === 4 && v === 0) || pic(['#..#', '#..#', '....', '....'])(u, v), 4, 4));
  addExactPieces(region(2), labelLand(pic(['....', '.#..', '....', '....']), 4, 4));
  assert.equal(apartExact({ x: 1003, y: 0 }, { x: 1009, y: 1 }), false, 'the strip runs on into region 1, laid nothing: UNKNOWN');
  resetExactPieces({ x0: 1000, y0: 0, cols: 3, rows: 1 }, [region(0), region(2)]);
  addExactPieces(region(0), r0);
  addExactPieces(region(2), labelLand(pic(['....', '.#..', '....', '....']), 4, 4));
  assert.equal(apartExact({ x: 1003, y: 0 }, { x: 1009, y: 1 }), true, 'the sea beyond it (its ring water): apart');
  // two regions landed and the one between them not yet: their pieces at its edges are never told apart (it may join them)
  resetExactPieces({ x0: 1000, y0: 0, cols: 3, rows: 1 }, [region(0), region(1), region(2)]);
  addExactPieces(region(0), labelLand(pic(['....', '...#', '....', '....']), 4, 4));
  addExactPieces(region(2), labelLand(pic(['....', '#...', '....', '....']), 4, 4));
  assert.equal(apartExact({ x: 1003, y: 1 }, { x: 1008, y: 1 }), false, 'the region between still to land');
  addExactPieces(region(1), labelLand(pic(['....', '####', '....', '....']), 4, 4));
  assert.equal(apartExact({ x: 1003, y: 1 }, { x: 1008, y: 1 }), false, 'and it joins them');
  // a land carried none: never whole
  resetExactPieces(lattice, [region(0), region(1)]);
  addExactPieces(region(0), r0); addExactPieces(region(1), null);
  assert.equal(apartExact({ x: 1003, y: 0 }, { x: 1006, y: 1 }), false);
});

test('EXACT-PIECES a plan past the Bay with no way by land at the pixel is refused before a cell is expanded; the roads host hands each region\'s pieces as it lands (mutants: the refusal, the host\'s hand)', () => {
  const lattice = { x0: 1000, y0: 100, cols: 1, rows: 1 };
  const region = { i: 0, j: 0, core: { x0: 1000, y0: 100, x1: 1040, y1: 120 } };
  const dry = (x, y) => y > 101 && y < 118 && ((x > 1001 && x < 1015) || (x > 1020 && x < 1038));   // two isles, a channel of six between
  resetExactPieces(lattice, [region]);
  addExactPieces(region, labelLand((u, v) => dry(1000 + u, 100 + v), 40, 20));
  const rg = routeGround(() => 0, () => 20, 3, MAP_W, MAP_H, dry);
  const tally = { n: 0 };
  assert.equal(planRoute({ x: 1005, y: 110 }, { x: 1030, y: 110 }, { ...rg, tally }), null);
  assert.equal(tally.n, 0, 'not a cell');
  assert.ok(planRoute({ x: 1005, y: 110 }, { x: 1012, y: 115 }, { ...rg }), 'one isle: walked');
  assert.match(read('src/scenes/tamrielRoadsHost.js'), /addExactPieces\(region, land \?\? null\);/);
  assert.match(read('src/scenes/tamrielRoadsHost.js'), /resetExactPieces\(lattice, regions\);/);
  assert.match(read('src/world/tamrielRoads.js'), /const pieces = regionLand\(region, \(x, y\) => \(inBay\(x, y\) \? heightAt\(x, y\) : heights\[\(y - gy\) \* MAP_W \+ \(x - gx\)\]\)\);/);
});

// ── WITH ARENA2: the freeware's own Tamriel ─────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD'].every((f) => existsSync(join(ARENA2, f)));
test('EXACT-PIECES on the freeware\'s Tamriel, every region the build lays labelled as it labels them: Mournhold to Ebonheart apart (water narrower than the trace\'s grid between), Mournhold to Vivec and the Imperial City to Bruma not, Alinor to the Imperial City apart', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit, tamrielFrameInBay } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { groundWoods } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { regionLattice, regionsByNearness, regionWanted, regionLand } = await import('../../../src/world/tamrielRoads.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit (test/ui/tamriel4.test.js)
  try {
    const w = new WoodsFile(); w.load(bytes('WOODS.WLD'));
    const g = groundWoods(w), heightAt = (x, y) => g.getHeightMapValue(x, y);
    const lattice = regionLattice(tamrielFrameInBay());
    const regions = regionsByNearness(lattice, (r) => regionWanted(r, heightAt), { x: 500, y: 250 });   // as the roads host asks
    resetExactPieces(lattice, regions);
    for (const r of regions) addExactPieces(r, regionLand(r, heightAt));
    // world/arenaPlaces.js arenaPixels at the fit (SMOOTH-LAND's land)
    const MOURNHOLD = { x: 3293, y: 550 }, EBONHEART = { x: 3260, y: 77 }, VIVEC = { x: 3288, y: -96 }, IC = { x: 2069, y: 658 }, BRUMA = { x: 2046, y: 325 }, ALINOR = { x: 8, y: 1533 };
    assert.equal(apartExact(MOURNHOLD, EBONHEART), true, 'Mournhold to Ebonheart');
    assert.equal(apartExact(MOURNHOLD, VIVEC), false, 'Mournhold to Vivec');
    assert.equal(apartExact(IC, BRUMA), false, 'the Imperial City to Bruma');
    assert.equal(apartExact(ALINOR, IC), true, 'Alinor to the Imperial City');
    const DAGGERFALL = { x: 207, y: 213 }, KVATCH = { x: 1705, y: 790 };
    assert.equal(apartExact(DAGGERFALL, ALINOR), true, 'the Bay\'s own city to Summerset: the Bay\'s regions labelled too');
    assert.equal(apartExact(DAGGERFALL, KVATCH), false, 'the Bay to Cyrodiil');
    // and the plan: refused at once on the host's own ground
    const { WATER_BYTE } = await import('../../../src/world/roadsProducer.js');
    const rg = routeGround(() => 0, (x, y) => w.getHeightMapValue(x, y), WATER_BYTE, MAP_W, MAP_H, (x, y) => heightAt(x, y) > WATER_BYTE);
    const tally = { n: 0 };
    assert.equal(planRoute(MOURNHOLD, EBONHEART, { ...rg, tally }), null);
    assert.equal(tally.n, 0, 'Mournhold to Ebonheart: not a cell');
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
