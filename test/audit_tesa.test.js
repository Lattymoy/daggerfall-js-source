// AUDIT-TESA (2026-10-13, the owner: "Lets do a comprehensive audit across everything so far"; bible/01-Overview/
// Audit-TESA.md) - the fixes the audit of the Arena arc (TESA1 to TESA10d) found, pinned: Arena's names off the wire and
// out of saves, a quest's site past the Bay found, the capitals' start markers, and the rest of its waves.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { automapKeyOf, automapDungeonKey } from '../src/systems/automap/automap.js';
import { CAPITALS, capitalCarrier, capitalPortBlocks, startMarkerAt, capitalSliceCarriers, capitalSliceMarkers, capitalCentre } from '../src/world/tamrielCapitals.js';
import { blockFromJson } from '../src/formats/worldData/worldDataReplacement.js';
import { collectBlockFlats } from '../src/world/rmbFlats.js';
import { locationStartMarkers, EDITOR_FLATS_ARCHIVE, START_MARKER_RECORD } from '../src/world/locationEntrance.js';
import { setTamrielFit } from '../src/world/tamriel/tamrielFrame.js';
import { hostText } from './hostText.mjs';   // HOST-SPLIT (at the merge of main): the world host read whole - its pixel build stands in scenes/pixelBuild.js

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = hostText('src/scenes/world.js');
afterEach(() => setTamrielFit(null));

// ── WAVE 1: ARENA'S NAMES, A QUEST'S SITE, THE CAPITALS' MARKERS ─

test('AUDIT-TESA A1-1: an Arena place\'s automap key names it by its map id - never Arena\'s name on the party\'s shared map; a capital, a lair and a Bay place keep theirs; the party pose names the place (TESA12: the port\'s own - PIN MOVED: it sent none while the names were Arena\'s)', () => {
  const arena = { regionIndex: 0, name: 'Winterhold', arena: { provinceIndex: 2, id: 3 }, mapTableData: { mapId: 0xa7_7a1f4 } };
  const key = automapKeyOf(arena);
  assert.equal(key, automapDungeonKey(0, `arena#${0xa7_7a1f4 >>> 0}`));
  assert.ok(!key.includes('Winterhold'), 'no name');
  assert.match(key, /^-?\d{1,4}\/[^\u0000-\u001f\u007f]{1,64}$/, 'the wire\'s own key law (net/wire.js AMAP_DUNGEON_RE)');
  assert.equal(automapKeyOf({ ...arena, capital: { key: 'solitude', k: 1 }, name: 'Solitude' }), automapDungeonKey(0, 'Solitude'), 'a capital is the port\'s, its name too');
  assert.equal(automapKeyOf({ regionIndex: 17, name: 'Daggerfall' }), automapDungeonKey(17, 'Daggerfall'));
  assert.equal(automapKeyOf({ regionIndex: 0, name: 'Ulrik\'s Hold', country: { dungeon: true }, mapTableData: { mapId: 5 } }), `${automapDungeonKey(0, 'Ulrik\'s Hold')}#5`);
  // PIN MOVED (TESA12): the places are the port's own, every client's the same - the wire names one like any town
  assert.match(W, /loc: ident\?\.kind === 'dungeon' \? \(ident\.name \?\? ''\) : \(loc\?\.name \?\? ''\),/);
});

test('AUDIT-TESA A1-2: entering an Arena place, and a quest revealing one, discovers it by its map id alone - its name never rides a save', () => {
  assert.match(W, /regionName: maps\.getRegionName\(dfLocation\.regionIndex\), locationName: dfLocation\.arena && !dfLocation\.capital \? '' : dfLocation\.name,/);
  assert.match(W, /return discoverLocation\(loc\.mapTableData\.mapId, \{ regionName: loc\.regionName, locationName: loc\.arena && !loc\.capital \? '' : loc\.name \}\);/);
});

test('AUDIT-TESA A2-1: a quest\'s site past the Bay is found by name - an isle\'s, an Arena town\'s, a country place\'s or a lair, a capital - in the index it stands in; MAPS.BSA\'s first; the reveal, the clock and the respawn all ask it', () => {
  const i = W.indexOf('  const placeByName = ');
  assert.ok(i > 0);
  const src = W.slice(i, W.indexOf('\n  const { questWorld } = createQuestWorld({', i));   // PIN MOVED (HOST-SPLIT, at the merge of main): questWorld is scenes/questWorld.js's, constructed where it stood
  const placeByName = new Function('maps', 'locationIndex', `${src}\nreturn placeByName;`);
  const bay = { name: 'Daggerfall', regionName: 'Daggerfall', loaded: true };
  const maps = { getLocationByName: (rn, ln) => (rn === 'Daggerfall' && ln === 'Daggerfall' ? bay : null) };
  const winterhold = { name: 'Winterhold', regionName: 'Alik\'r Desert', arena: {}, loaded: true };
  const farm = { name: 'Asgorn', regionName: 'Alik\'r Desert', country: {}, loaded: true };
  const sol = { name: 'Solitude', regionName: 'Alik\'r Desert', capital: { k: 1 }, loaded: true };
  const isle = { name: 'Mistle', regionName: 'Eltheric', ether: true };
  const index = new Map([['1,1', winterhold], ['2,2', farm], ['3,3', sol], ['4,4', isle], ['5,5', { name: 'Winterhold', regionName: 'Alik\'r Desert' }]]);
  const find = placeByName(maps, index);
  assert.equal(find('Daggerfall', 'Daggerfall'), bay);
  assert.equal(find('Alik\'r Desert', 'Winterhold'), winterhold, 'the Arena town, not a namesake the index holds of no kind of its own');
  assert.equal(find('Alik\'r Desert', 'Asgorn'), farm);
  assert.equal(find('Alik\'r Desert', 'Solitude'), sol);
  assert.equal(find('Eltheric', 'Mistle'), isle);
  assert.equal(find('Alik\'r Desert', 'Nowhere'), null);
  assert.match(W, /const loc = placeByName\(regionName, locationName\);/, 'the reveal');
  assert.match(W, /getLocationByName: \{ value: \(rn, ln\) => questSized\(placeByName\(rn, ln\)\) \}/, 'the clock and every quest reader through the adapter');   // PIN MOVED (START2): the quest layer's one sizing
  assert.match(W, /const loc = placeByName\(sd\.regionName, sd\.locationName\);/, 'the respawn');
});

test('AUDIT-TESA A6-1: every capital carries start markers - editor flats on its carrier block at their anchor metres, each on its own open ground (never water, never closed) - so a portal\'s arrival lands inside the city', () => {
  const blocks = capitalPortBlocks();
  assert.deepEqual(startMarkerAt(51.2, 25.6), { Position: 0, XPos: 2048, YPos: 0, ZPos: 1024 - 4096, TextureArchive: EDITOR_FLATS_ARCHIVE, TextureRecord: START_MARKER_RECORD, FactionID: 0, Flags: 0 });
  for (const cap of CAPITALS) {
    assert.ok(cap.markers?.length >= 3, cap.key);
    assert.equal(capitalSliceCarriers(cap).get(capitalCentre(cap)), capitalCarrier(cap), `${cap.key}: its own slice's carrier the anchor's`);
    if (cap.family) continue;   // PIN MOVED (IC-GRAND): the Imperial City's blocks a family on the world-data door - its slices' markers pinned on its carriers there (test/world/icgrand_lod.test.js)
    // PIN MOVED (AUDIT TESA II C7): every slice's carrier its slice's markers - the capital's own on its own slice's
    const carriers = new Set();
    for (const [s, code] of capitalSliceCarriers(cap)) {
      const markers = capitalSliceMarkers(cap, s), blk = blocks.find((b) => b.name === cap.blocks[code].name);
      carriers.add(blk.name);
      assert.ok(markers.length >= 2, `${cap.key} slice ${s}: its markers`);
      const at = (() => { for (let r = 0; r < cap.plan.length; r++) for (let x = 0; x < cap.plan[r].length; x++) if (cap.plan[r][x] === code) return [(cap.anchor[0] - x) * 102.4, (r + 1 - cap.anchor[1]) * 102.4]; return null; })();
      const flats = collectBlockFlats(blockFromJson(blk.json, blk.index), 0);
      const got = locationStartMarkers([{ originX: 0, originZ: 0, flats }]);
      assert.equal(got.length, markers.length, `${cap.key} slice ${s}`);
      markers.forEach(([dx, dz], i) => {
        assert.ok(Math.abs(got[i][0] - (at[0] + dx)) < 0.03 && Math.abs(got[i][2] - (at[1] - dz)) < 0.03, `${cap.key} slice ${s} marker ${i}`);
        const own = Object.values(cap.blocks)[0];
        assert.notEqual(own.tile(dx, dz), 0, `${cap.key} slice ${s} marker ${i} not in the water`);
        assert.equal(own.closed(dx, dz), false, `${cap.key} slice ${s} marker ${i} on open ground`);
      });
    }
    for (const b of blocks.filter((x) => Object.values(cap.blocks).some((o) => o.name === x.name) && !carriers.has(x.name))) assert.equal(b.json.RmbBlock.MiscFlatObjectRecords.length, 0, `${b.name}: the carriers alone`);
  }
});

// ── WAVE 2 ──────────────────────────────────────────────────────

test('AUDIT-TESA A3-1: a town on the shore whose own pixel reads as the sea is routed all the same - its pixel its land (TESA14: the region\'s own law, world/tamrielRoads.js)', async () => {
  const { buildTamrielRegion, regionLattice, regionOf } = await import('../src/world/tamrielRoads.js');
  const { beyondKey } = await import('../src/world/arenaRoads.js');
  // PIN MOVED (TESA14): TESA4's window cell retired - a town is its own pixel now. Two cities past the Bay (y < 0) on the
  // shore, their pixels' bytes the sea's, the strip of land just south of them the one way between
  const region = regionOf(regionLattice({ x0: 2000, y0: -1000, w: 800, h: 300 }), 0, 0);
  const heightAt = (x, y) => (y === -899 && x >= 2090 && x <= 2150 ? 40 : 0);
  const nodes = [{ x: 2100, y: -900, type: 0 }, { x: 2140, y: -900, type: 0 }];
  const out = buildTamrielRegion({ region, places: [], nodes, obstacles: [], gates: [], heightAt });
  assert.ok(out.roads.get(beyondKey(2100, -900)), 'the first town\'s pixel carries its road');
  assert.ok(out.roads.get(beyondKey(2140, -900)), 'and the second\'s');
  assert.equal(out.stats.unrouted, 0);
});

test('AUDIT-TESA A2-5: past the Bay a town\'s walkers, a building\'s people and a tavern\'s regulars are named by the province\'s people (TESA3\'s bank), the region\'s only on the Bay', () => {
  const wm = read('src/scenes/worldModes.js');
  // PIN MOVED (HOST-SPLIT, at the merge of main): the pixel's build is src/scenes/pixelBuild.js's
  assert.match(read('src/scenes/pixelBuild.js'), /nameBank: provinceNameBank\(provinceAt\(px, py\)\?\.key\) \?\? getNameBankOfRegion\(dfLocation\.regionIndex\),/, 'the streets');
  assert.match(W, /var modes = createWorldModes\(\{\n\s+climbFeel[,:][^\n]*\n\s+outsideView,[^\n]*\n\s+instanceDoor,[^\n]*\n\s+provinceBank: \(\) => provinceBankHere\(\),/, 'the interior host told');   // PIN MOVED (at the merge of main): after INSTANCES' door and RW1's view, which main's own pins read first
  assert.match(wm, /const currentNameBank = \(\) => host\.provinceBank\?\.\(\) \?\? getNameBankOfRegion\(/, 'a building\'s people');
  assert.match(wm, /bank = host\.provinceBank\?\.\(\) \?\? getNameBankOfRegion\(b\?\.regionIndex \?\? 0\);/, 'the regulars');
});

test('AUDIT-TESA A6-2: a capital\'s gardens are its own blocks - each cell\'s, named apart; the port blocks\' indices past the Shadow Realm\'s; every block built when first read, its capital\'s footprint with it, once', async () => {
  const { capitalGardenName, capitalBlockNames, CAPITAL_BLOCK_INDEX, CAPITAL_BLOCKS } = await import('../src/world/tamrielCapitals.js');
  const { SD_REALM_BLOCK_INDEX } = await import('../src/world/superDungeon/sdRealm.js');
  const { ARENA_BLOCK_INDEX } = await import('../src/world/arena/arenaCity.js');
  const { ARENA_FLOOR_BLOCK_INDEX } = await import('../src/world/arena/arenaFloor.js');
  const { GATE_ARENA_BLOCK_INDEX } = await import('../src/world/gate/gateArena.js');
  const all = capitalPortBlocks();
  const idx = all.map((b) => b.index);
  assert.deepEqual(idx, all.map((_, i) => CAPITAL_BLOCK_INDEX + i));
  for (const other of [SD_REALM_BLOCK_INDEX, ARENA_BLOCK_INDEX, ARENA_FLOOR_BLOCK_INDEX, GATE_ARENA_BLOCK_INDEX]) assert.ok(!idx.includes(other), `${other} apart`);
  assert.equal(new Set(all.map((b) => b.name)).size, all.length, 'names apart');
  CAPITALS.forEach((cap, k) => {
    assert.match(cap.tag, /^[A-Z]{2}$/);
    if (cap.family) return;   // PIN MOVED (IC-GRAND): the Imperial City lays no garden (its park and courts the fabric's own ground)
    const names = capitalBlockNames(cap.plan, k, new Map([...new Set(cap.plan.flat())].map((c) => [c, [`${c}AA00.RMB`]])));
    cap.plan.forEach((row, r) => row.forEach((cell, x) => {
      if (cell !== 'G') return;
      const name = capitalGardenName(cap, x, r);
      assert.match(name, cap.plan.length > 36 ? /^TESG[A-Z]{2}[0-9a-z]{4}\.RMB$/ : /^TESG[A-Z]{2}[0-9a-n]{2}\.RMB$/, 'TESA11: base 36 (PIN MOVED, TOWN-SHAPES TS5: two characters each past 36 cells)');
      assert.equal(names[(cap.plan.length - 1 - r) * row.length + x], name, `${cap.key} ${x},${r}`);
      assert.ok(all.some((b) => b.name === name), `${name} registered`);
    }));
  });
  const { imperialSlicePlan } = await import('../src/world/imperialCity.js');   // PIN MOVED (IC-GRAND): the plan by its law, its centre's slice
  assert.ok(!capitalBlockNames(imperialSlicePlan(312), 0, new Map([...new Set(imperialSlicePlan(312).flat())].map((c) => [c, [`${c}AA00.RMB`]])), undefined, [96, 96]).includes(CAPITAL_BLOCKS.garden), 'the shared garden none of theirs');
  // built when read: a footprint asked of no capital until one of its blocks is, and of each once
  const asked = [];
  const lazy = capitalPortBlocks({ footprint: (cap) => { asked.push(cap.key); return (x, z) => Math.abs(x) < 3 && Math.abs(z) < 3; } });
  assert.deepEqual(asked, []);
  const sol = lazy.filter((b) => b.name.startsWith('TESGSO') || b.name.startsWith('TESASO'));
  for (const b of sol) assert.ok(b.json.RmbBlock);
  assert.deepEqual(asked, ['solitude'], 'once for its every block');
  const first = lazy.find((b) => b.name.startsWith('TESASO'));
  assert.equal(first.json, first.json, 'built once, kept');
  // PIN MOVED (WW7-4): a block made of another (registerPortBlockOf, world/capitalCastles.js) made by its own maker
  // PIN MOVED (ROAD-FOLLOW): the same law in four lines - and a provisional block (a wall still waiting) not kept
  assert.match(read('src/formats/worldData/worldDataReplacement.js'), /if \(b\.block\) return b\.block;\n {2}if \(b\.make\) return \(b\.block = b\.make\(_blocksFile\)\);\n {2}const json = typeof b\.json === 'function' \? b\.json\(\) : b\.json;\n {2}const block = blockFromJson\(json, b\.index\);/);
  // PIN MOVED (AUDIT TESA II C8): the door handed `make`, which keeps nothing - no JSON beside the block it reads into
  // PIN MOVED (CAPITAL-CARRIAGES): and the carriages at its gates handed beside it (world/capitalCarriages.js)
  assert.match(read('src/world/capitalModels.js'), /for \(const b of capitalPortBlocks\(\{ footprint: \(cap\) => capitalFootprint\(cap\), gateThings: capitalCarriagesOf \}\)\) registerPortBlock\(b\.name, b\.make \?\? \(\(\) => b\.json\), b\.index\);/);
  assert.notEqual(first.make(), first.make(), 'AUDIT TESA II C8: `make` builds anew, keeps none');
});

test('AUDIT-TESA A6-2: where a capital\'s models stand - a wall over a garden or an own block closes its ground and keeps its trees off it, a walkable slope and a deck\'s top do not, the gates stay open, no diagonal slips, no start marker under it', async () => {
  const { capitalFootprint, installCapitals } = await import('../src/world/capitalModels.js');
  const { IMPERIAL, polar } = await import('../src/world/imperialCity.js');
  const { capitalGardenName, anchorMetres, autoCentre, tileCentre, BLOCK_M, CAPITAL_CLOSED_BYTE, inCapitalRim, CAPITAL_NO_GROUND, capitalDims } = await import('../src/world/tamrielCapitals.js');
  const { onCapitalApproach, APPROACH_TILE } = await import('../src/world/capitalApproaches.js');   // ROAD-FOLLOW: a garden's approach
  const { MOURNHOLD, ALINOR, HELSTROM } = await import('../src/world/capitalPlans.js');
  // the law on a made model: a wall's face, a ramp, a deck at a body's height
  const mesh = (tris) => ({ positions: new Float32Array(tris.flat(2)), indices: new Uint32Array(tris.flatMap((_, i) => [i * 3, i * 3 + 1, i * 3 + 2])) });
  const made = { key: 'made', models: [1, 2, 3, 4] };
  const meshes = {
    1: mesh([[[0, -1, -0.5], [10, -1, -0.5], [10, 5, -0.5]], [[0, -1, -0.5], [10, 5, -0.5], [0, 5, -0.5]]]),   // a wall's face along x at z 0.5 (the anchor's z south)
    2: mesh([[[0, 0, -20], [10, 0, -20], [10, 3, -26]]]),   // a ramp: rises 3 over 6 - walkable
    3: mesh([[[20, 1, 0], [30, 1, 0], [30, 1, -10]]]),   // a deck's top at 1 m
    4: mesh([[[40, -0.2, -0.5], [50, -0.2, -0.5], [50, 1.2, -0.5]], [[40, -0.2, -0.5], [50, 1.2, -0.5], [40, 1.2, -0.5]]]),   // a parapet to a waist
  };
  const f = capitalFootprint(made, (id) => meshes[id]);
  for (let x = 0.1; x < 10; x += 0.5) assert.ok(f(x, 0.5), `the wall at ${x}`);
  assert.ok(!f(5, 3) && !f(5, -2), 'only its line');
  assert.ok(!f(5, 22) && !f(28, 5), 'the ramp and the deck walkable');
  assert.ok(f(45, 0.5), 'a parapet to the waist is in the way');
  // a face on the diagonal: no two closed cells meet at a corner alone
  const diag = capitalFootprint({ key: 'd', models: [1] }, () => mesh([[[0, -1, 0], [16, -1, -16], [16, 5, -16]], [[0, -1, 0], [16, 5, -16], [0, 5, 0]]]));
  for (let i = -2; i < 12; i++) for (let j = -2; j < 12; j++) {
    const c = (a, b) => diag((a + 0.5) * 1.6, (b + 0.5) * 1.6);
    for (const dj of [1, -1]) if (c(i, j) && c(i + 1, j + dj)) assert.ok(c(i + 1, j) || c(i, j + dj), `a slip at ${i},${j}`);
  }
  // the capitals', on the model door
  installCapitals({ addTextures: () => 0 });
  const open = (fp, a, b) => { for (let k = 0; k <= 60; k++) if (fp(a[0] + ((b[0] - a[0]) * k) / 60, a[1] + ((b[1] - a[1]) * k) / 60)) return false; return true; };
  const fp = Object.fromEntries(CAPITALS.map((c) => [c.key, capitalFootprint(c)]));
  // PIN MOVED (TESA11): the Imperial City's city wall's four gates and its palace wall's six, walled between; PIN MOVED
  // (IC-GRAND): its nine gates at twenty-five pixels
  const R = IMPERIAL.cityWall.r, rp = IMPERIAL.palaceWall.r;
  for (const b of IMPERIAL.cityWall.gates) assert.ok(open(fp['imperial-city'], polar(b, R - 8), polar(b, R + 8)), `the Imperial City's gate at ${b}`);
  assert.ok(!open(fp['imperial-city'], polar(50, R - 8), polar(50, R + 8)), 'its wall between');
  for (const b of [30, 90, 150, 210, 270, 330]) assert.ok(open(fp['imperial-city'], polar(b, rp - 6), polar(b, rp + 6)), `the palace gate at ${b}`);
  assert.ok(!open(fp['imperial-city'], polar(60, rp - 6), polar(60, rp + 6)), 'the palace wall between');
  const MW = MOURNHOLD.wall;
  for (const [x, z] of [[MW.half, 0], [-MW.half, 0], [0, MW.half], [0, -MW.half]]) {
    const ax = x ? 1 : 0, az = z ? 1 : 0;
    assert.ok(open(fp.mournhold, [x - ax * 6, z - az * 6], [x + ax * 6, z + az * 6]), `Mournhold's gate ${x},${z}`);
    assert.ok(!open(fp.mournhold, [x - ax * 6 + az * 60, z - az * 6 + ax * 60], [x + ax * 6 + az * 60, z + az * 6 + ax * 60]), 'walled beside it');
  }
  const AW = ALINOR.wall, mid = (AW.south + AW.north) / 2;
  assert.ok(open(fp.alinor, [AW.northGate, AW.north - 6], [AW.northGate, AW.north + 6]) && open(fp.alinor, [AW.west - 6, mid], [AW.west + 6, mid]) && open(fp.alinor, [AW.east - 6, mid], [AW.east + 6, mid]), 'Alinor\'s gates');
  assert.ok(!open(fp.alinor, [0, AW.north - 6], [0, AW.north + 6]), 'PIN MOVED (AUDIT TESA II C10): its north gate on its lane, the palace\'s back walled');
  const HP = HELSTROM.palisade;
  assert.ok(open(fp.helstrom, [0, HP.north - 6], [0, HP.north + 6]) && open(fp.helstrom, [0, HP.south - 6], [0, HP.south + 6]), 'Helstrom\'s');
  assert.ok(!open(fp.helstrom, [40, HP.north - 6], [40, HP.north + 6]), 'its palisade');
  for (const cap of CAPITALS) for (const [dx, dz] of cap.markers) assert.ok(!fp[cap.key](dx, dz), `${cap.key}'s marker at ${dx},${dz}`);
  // the blocks: a crossed garden closed where the models stand, no tree on a tile they stand on; an own block's closed its law's or theirs
  const blocks = capitalPortBlocks({ footprint: (cap) => fp[cap.key] });
  let crossed = 0;
  for (const cap of CAPITALS) {
    if (cap.family) continue;   // PIN MOVED (IC-GRAND): the Imperial City's blocks closed by their slice's footprint on the door (test/world/icgrand_lod.test.js)
    cap.plan.forEach((row, r) => row.forEach((cell, cx) => {
      const own = Object.hasOwn(cap.blocks, cell) ? cap.blocks[cell] : null;
      if (cell !== 'G' && !own) return;
      const blk = blocks.find((b) => b.name === (own ? own.name : capitalGardenName(cap, cx, r)));
      const G = own ? null : cap.ground?.garden ?? null;   // PIN MOVED (SOLITUDE-RELIEF): a garden on a capital's own ground its ground's - closed and bare where it is not grass
      const A = blk.json.RmbBlock.FldHeader.AutoMapData, trees = blk.json.RmbBlock.FldHeader.GroundData.GroundScenery;
      let shut = 0;
      for (let ay = 0; ay < 64; ay++) for (let ax = 0; ax < 64; ax++) {
        const [x, z] = autoCentre(ax, ay), [dx, dz] = anchorMetres(cap, cx, r, x, z), under = fp[cap.key](dx, dz);
        const rim = inCapitalRim(cap, cx * BLOCK_M + x, (r + 1) * BLOCK_M - z);   // PIN MOVED (AUDIT TESA II C1): the rim closed, no ground of its own
        assert.equal(A[ay * 64 + ax], (own?.closed(dx, dz) || G?.closed(dx, dz) || under || rim) ? CAPITAL_CLOSED_BYTE : 0, `${blk.name} ${ax},${ay}`);
        if (under && !own && !rim) { shut++; const tx = Math.floor(x / 6.4), ty = 15 - Math.floor(z / 6.4); assert.equal(trees[ty * 16 + tx].TextureRecord, -1, `${blk.name}: a tree in the wall at ${tx},${ty}`); }
      }
      if (shut) crossed++;
      // PIN MOVED (ROAD-FOLLOW, 03-World/Town-Shapes.md ROAD-FOLLOW): its approach's road, rim or none
      const way = onCapitalApproach(cap, capitalDims(cap)), roadAt = (i) => way(...anchorMetres(cap, cx, r, ...tileCentre(i % 16, Math.floor(i / 16))));
      const grass = (x, z) => (G ? G.tile(...anchorMetres(cap, cx, r, x, z)) : 2);   // PIN MOVED (SOLITUDE-RELIEF): a garden on a capital's own ground its ground's
      if (!own) assert.ok(blk.json.RmbBlock.FldHeader.GroundData.GroundTiles.every((t, i) => t.TileBitfield === (roadAt(i) ? APPROACH_TILE : inCapitalRim(cap, cx * BLOCK_M + tileCentre(i % 16, Math.floor(i / 16))[0], (r + 1) * BLOCK_M - tileCentre(i % 16, Math.floor(i / 16))[1]) ? CAPITAL_NO_GROUND : grass(...tileCentre(i % 16, Math.floor(i / 16))))), 'a garden\'s grass (its ground\'s, on a capital\'s own), its rim none, its approach the road');
    }));
  }
  assert.ok(crossed >= 60, `the walls over the gardens: ${crossed}`);
  void tileCentre; void BLOCK_M;
});

test('AUDIT-TESA A7-1/A5-F1/A2-6: a load waits for the trace whenever a place past the Bay stands - a capital or the countryside, Arena or none; the land moving rolls the countryside\'s and the lairs\' pixels again; their ground\'s reads kept a fit and a land', () => {
  // PIN MOVED (TESA12): one wait - the town past the Bay's beside the capitals' and the countryside's
  const i = W.indexOf('if ((_arenaTemplates || _countryTemplates || _capitalBase) && params.has(\'load\')) await Promise.race([arenaTraced, new Promise((r) => setTimeout(r, ARENA_LOAD_WAIT_MS))]);');
  assert.ok(i > 0, 'the wait');
  assert.match(W, /const rolled = moved && !!\(host\._countryTemplates \|\| host\._lairTemplates\) && !cap && !had\?\.capital && !had\?\.arena;\n\s+if \(rolled \|\| cap !== !!had\?\.capital\) again\.push/, 'the sweep');
  assert.match(read('src/world/tamrielCountry.js'), /if \(fit !== tamrielFit\(\) \|\| land !== tamrielLandVersion\(\)\) \{ dry\.clear\(\); fit = tamrielFit\(\); land = tamrielLandVersion\(\); \}/, 'the ground');
});

test('AUDIT-TESA A2-4/A7-3/A5-F2: a death past the Bay rises at the nearest town the world stands past the Bay (a capital, an Arena town, the countryside\'s) - never the Alik\'r\'s; a dungeon\'s wake there at its own door. PIN MOVED (AUDIT TESA II P3): the one law of the nearest town of the world (systems/deathRespawn.js nearestSafePlace over the registry\'s places and the countryside\'s stood towns, scenes/tamrielPlacesHost.js nearestTownOf), at any distance - the index\'s towns within 48 pixels left a death at sea past the Bay in the water', async () => {
  const { nearestSafePlace } = await import('../src/systems/deathRespawn.js');
  const { LOCATION_TYPES: T, DUNGEON_TYPES } = await import('../src/formats/mapsFile.js');
  const registry = [
    { type: T.TownCity, px: 1000, py: -200 },   // a capital's slice
    { type: T.DungeonLabyrinth, px: 1010, py: -200 },   // a dungeon: never a rise
    { type: T.TownVillage, px: 1300, py: -200 },   // far: a rise all the same
  ];
  const country = [{ type: T.TownHamlet, px: 1030, py: -200 }, { type: T.Graveyard, dungeonType: DUNGEON_TYPES.Cemetery, px: 1040, py: -200 }];
  const at = (x, y, accept) => nearestSafePlace([registry, country], { x, y }, accept)?.mapPixel ?? null;
  assert.deepEqual(at(1012, -200), { x: 1000, y: -200 });
  assert.deepEqual(at(1026, -200), { x: 1030, y: -200 }, 'a country town the index stood');
  assert.deepEqual(at(1600, -200), { x: 1300, y: -200 }, 'past the old reach of 48: still a town, never where they fell');
  assert.equal(nearestSafePlace([registry, country], { x: 1041, y: -200 }).kind, 'graveyard', 'the three safe kinds, as the Bay\'s rise');
  assert.deepEqual(at(1026, -200, (hit) => hit.kind === 'city' && hit.mapPixel.x < 1030), { x: 1000, y: -200 }, 'the caller\'s accept');
  assert.match(W, /\} else if \(!onTheBay\(px\.x, px\.y\)\) \{\n(?:[^\n]*\n){4}\s+const town = nearestTownOf\(px\);\n\s+if \(town\) land = town\.mapPixel;\n\s+kind = town\?\.kind \?\? 'city';/, 'the rise');
  assert.match(W, /const nearestTownOf = \([^\n]*\) => nearestSafePlace\(\[worldPlaces\?\.all\(\) \?\? \[\], countryTowns\(\)\], px, accept\);/, 'the law over the registry and the stood towns');
  assert.match(W, /const wake = inEther\(from\.x, from\.y\) \|\| !onTheBay\(from\.x, from\.y\) \? \{ kind: 'dungeon', mapPixel: \{ x: from\.x, y: from\.y \} \} : undergroundWakeSpot\(/, 'the wake');
});

test('AUDIT-TESA A4-F2/A4-F3: a capital\'s pixel is the capital\'s - never cloned over by its Arena place; its slot kept with its port; a harbour town past the Bay booked by its own map id', () => {
  assert.match(W, /if \(had\?\.capital\) return capitalLocationAt\(px, py\);/);
  // A2-2: a portal's end past the Bay named by the place standing there, else its province
  assert.match(W, /const here = locationIndex\.get\(`\$\{x\},\$\{y\}`\) \?\? capitalLocationAt\(x, y\) \?\? \(_arenaTemplates \? arenaLocationAt\(x, y\) : null\);\n\s+const province = provinceByKey\(provinceKeyBeyondBay\(x, y\)\);\n\s+return here\?\.name \? \{ pixel: \{ x, y \}, name: here\.name \} : province \? \{ pixel: \{ x, y \}, name: province\.name \} : null;/);
  // PIN MOVED (BAY-LEFT-SEA): and its harbour's port word - a kept slice whose word moved (its canal opened) cloned again
  assert.match(W, /\(had\.arena\?\.provinceIndex \?\? null\) === \(slot\?\.provinceIndex \?\? null\)\n\s+&& !!had\.arena\?\.port === !!slot\?\.port   \/\/ AUDIT-TESA A4-F2: its place made a port, its slot too\n\s+&& \(had\.exterior\?\.exteriorData\?\.portTownAndUnknown !== 0\) === capitalSlicePort\(at\.k, at\.s, capitalPinPort\(at\.k\)\)\) return had;/);
  assert.match(W, /const aloc = aq \? capitalLocationAt\(aq\.bx, aq\.by\) \|\| arenaLocationAt\(aq\.bx, aq\.by\) : null;/);
  // PIN MOVED (WORLD-WIDE folded into TESA, #1184): the port's id is WORLD-WIDE's own (world/worldWide/worldPorts.js portIdOfLocation)
  // PIN MOVED (the fourth merge of main into #1184): the towns are one list, kept by id (RPT1026-WORLD FAR-QUAY's ring beside it)
  assert.match(W, /if \(aloc\?\.exterior\?\.exteriorData\)\n\s*add\(\{ id: portIdOfLocation\(aloc\), loc: aloc,/);
});

test('AUDIT-TESA A2-3: a pixel id past the Bay aliases a Bay row (y * 1000 + x) - every read by it asks the Bay\'s pixels alone; past the Bay the place the world stands there answers, once discovered', () => {
  // PIN MOVED (HOST-SPLIT, at the merge of main): the pixel's build is src/scenes/pixelBuild.js's
  // PIN MOVED (WORLD-WIDE folded into TESA, #1184): the living towns are WORLD-WIDE's world-keyed index (WW1,
  // scenes/livingWorld/livingIndex.js townAt - the registry's place on that pixel), so no Bay row is aliased; past the Bay
  // it answers only where a provider stands
  assert.match(read('src/scenes/pixelBuild.js'), /const livingTown = livingTownAt\(px, py\) \?\? \{/);
  for (const re of [
    /if \(!csaIsPortTown\(p\.x \+ dx, p\.y \+ dy\)\) continue;\n\s+\/\/ AUDIT-TESA A2-3: the Bay's rows by the Bay's ids alone/,
    // PIN MOVED (BAY-LEFT-MAPS, test/scenes/bayleft_places.test.js): the junction map's dot reads the Bay's row on the Bay
    // alone and past it the place found there (scenes/mapPlacesHost.js junctionPlaceAt)
    /if \(onTheBay\(x, y\)\) \{\n\s+const summary = travelLocationSummaryAt\(mapDict, x, y\);/,
    /const summary = onTheBay\(pixel\.x, pixel\.y\) \? travelLocationSummaryAt\(mapDict, pixel\.x, pixel\.y\) : null;/,
    /locationSummary: \(\) => \(onTheBay\(to\.x, to\.y\) \? travelLocationSummaryAt\(mapDict, to\.x, to\.y\) : null\),/,
    // PIN MOVED (BAY-LEFT-MAPS): past the Bay a place found - or one a quest names (`named`, OW-QUEST's press)
    // PIN MOVED (OW-BEYOND-KNOWN, test/systems/travel/owbeyondknown.test.js): or one known by its kind, as MAPS.BSA bakes the Bay's
    /return loc\.name && id && \(named \|\| knownByKind\(id, loc\.mapTableData\?\.locationType\) \|\| hasDiscoveredLocationId\(id\)\) \? \{ pixel: \{ x: px, y: py \}, name: loc\.name, mapId: id,/,
  ]) assert.match(W, re);
  // PIN MOVED (WORLD-WIDE folded into TESA, #1184): the harbour's loop no longer bounds itself - WW3's directory answers no
  // row off the Bay's map (systems/map/mapDirectory.js locationSummaryAt), so a pixel past the Bay aliases none
  assert.match(read('src/systems/map/mapDirectory.js'), /return onMap\(mapPixelX, mapPixelY\) \? \(mapDict\?\.get\(getMapPixelID\(mapPixelX, mapPixelY\)\) \?\? null\) : null;/);
});

// ── WAVE 3 ──────────────────────────────────────────────────────

test('AUDIT-TESA A1-3: the player\'s Arena files never enter the repo - the root ARENA folder, its city data, its executables ignored; a tracked file of the port\'s own (vendor\'s Arena of Daggerfall, the CITYDATA reader) untouched', () => {
  const ig = read('.gitignore').split('\n').map((l) => l.trim());
  for (const p of ['/ARENA/', 'CITYDATA.*', 'A.EXE', 'ACD.EXE']) assert.ok(ig.includes(p), p);
  assert.ok(!ig.includes('ARENA/') && !ig.includes('Arena/'), 'anchored at the root - vendor/daggerfall-arena/Arena/ is the port\'s own');
});

test('AUDIT-TESA A7-8: the capitals\' and the countryside\'s kill doors shut offline alone - online the land is the room\'s', async () => {
  const { capitalsOn, countrysideOn } = await import('../src/scenes/shared.js');
  assert.deepEqual([capitalsOn('?capitals=off'), capitalsOn(''), capitalsOn('?online&capitals=off')], [false, true, true]);
  assert.deepEqual([countrysideOn('?country=off'), countrysideOn(''), countrysideOn('?online&country=off')], [false, true, true]);
});

test('AUDIT-TESA A4-F4/A5-F3: past the Bay a ship is asked by its Arena place\'s port whatever Travel Options lists; and no deed is read in a place the port made', () => {
  // PIN MOVED (BAY-LEFT-SEA): by its own port byte - an Arena place's TESA6 word, a capital's harbour's (its Waterfront's too)
  assert.match(W, /portTown: \(loc\.ether \? loc\.etherKind === 'port' : loc\.arena \|\| loc\.capital \? \(loc\.exterior\?\.exteriorData\?\.portTownAndUnknown \?\? 0\) !== 0 : modSetting\('travel-options', 'Enabled'\) === true/);
  // PIN MOVED (BAY-LEFT-B, bible/03-World/Arena-Provinces.md): a deed is read in a place the port made - held to its own
  // town (banking.js deedHeldIn by the town's map id), so the town asking is named
  assert.match(W, /ownsHouse: \(buildingKey\) => \{ const id = _questLoc\(\)\?\.mapTableData\?\.mapId \?\? 0; return !isEtherPlaceId\(id\) && isHouseOwned\(playerEntity\.houses \?\? \[\], _questRegionIndex\(\), buildingKey, id\); \},/);
});

test('AUDIT-TESA A4-F5/A7-5: a capital\'s pixel walks each ring\'s own cells - the answer the whole square\'s walk gave, at a ring\'s cost', async () => {
  const { capitalPixel, capitalDims, spanSideBytes } = await import('../src/world/tamrielCapitals.js');
  const { pictureToBay, inBay } = await import('../src/world/tamriel/tamrielFrame.js');
  const { provinceKeyBeyondBay } = await import('../src/world/tamriel/tamrielLand.js');
  const square = (cap) => {   // the old walk, verbatim in its law
    const [x, y] = pictureToBay(cap.at[0] + 0.5, cap.at[1] + 0.5);
    const own = (bx, by) => !inBay(bx, by) && provinceKeyBeyondBay(bx, by) === cap.province;
    const sea = (bx, by) => !inBay(bx, by) && provinceKeyBeyondBay(bx, by) === null;
    // PIN MOVED (AUDIT TESA II C2/C9): the law's own - every land slice its province's, every sea slice the sea, and every
    // side its plan's water faces the sea along its whole edge (a shore capital of no plan's side: any side)
    const D = capitalDims(cap);
    const ok = (bx, by) => {
      for (let sy = 0; sy < D.h; sy++) for (let sx = 0; sx < D.w; sx++) if ((D.sea ?? []).includes(sy * D.w + sx) ? !sea(bx + sx - D.mx, by + sy - D.my) : !own(bx + sx - D.mx, by + sy - D.my)) return false;
      const wet = (side) => spanSideBytes(bx - D.mx, by - D.my, D.w, D.h, side).every(([px, py]) => sea(px, py));
      return cap.sea ? cap.sea.every(wet) : !cap.shore || ['N', 'S', 'W', 'E'].some(wet);
    };
    const fx = Math.floor(x), fy = Math.floor(y);
    if (ok(fx, fy)) return { px: fx, py: fy };
    for (let r = 1; r <= 320; r++) {
      let at = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const d = Math.hypot(fx + dx + 0.5 - x, fy + dy + 0.5 - y);
        if (d < bd && ok(fx + dx, fy + dy)) { bd = d; at = { px: fx + dx, py: fy + dy }; }
      }
      if (at) return at;
    }
    return null;
  };
  for (const fit of [null, { ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 }]) {
    setTamrielFit(fit);
    for (const cap of CAPITALS) assert.deepEqual(capitalPixel(cap), square(cap), `${cap.key} on ${fit ? 'the trace\'s fit' : 'no fit'}`);
  }
  // a capital moved off its land walks the rings: the same answer
  for (const cap of CAPITALS) { const far = { ...cap, at: [cap.at[0] + 9, cap.at[1] - 7] }; assert.deepEqual(capitalPixel(far), square(far), `${cap.key} moved`); }
  // PIN MOVED (AUDIT TESA II C9): answers on a ring's east and west sides - the side law stands these there on the shape
  setTamrielFit(null);
  for (const [key, ox, oy] of [['alinor', -6, 0], ['helstrom', -24, -18], ['torval', -12, 6], ['solitude', -6, -6]]) {
    const cap = CAPITALS.find((c) => c.key === key), far = { ...cap, at: [cap.at[0] + ox, cap.at[1] + oy] };
    assert.deepEqual(capitalPixel(far), square(far), `${key} moved ${ox},${oy}`);
  }
});

test('AUDIT-TESA A6-3: no landmark stands in one of Daggerfall\'s blocks a capital lays - its walls and their towers, its walks, all clear of them below a roof\'s height (the oak\'s canopy over them, 170 m up, is the city\'s)', async () => {
  const { installCapitals } = await import('../src/world/capitalModels.js');
  const { customModelFor } = await import('../src/world/customModels.js');
  const { BLOCK_M, CAPITAL_MODELS } = await import('../src/world/tamrielCapitals.js');
  const { SOLITUDE_TERRACES } = await import('../src/world/solitudeRelief.js');
  const { alinorAbutments } = await import('../src/world/capitalAlinor.js');
  installCapitals({ addTextures: () => 0 });
  for (const cap of CAPITALS) {
    const [AX, AR] = cap.anchor;
    for (const id of cap.models) {
      // PIN MOVED (SOLITUDE-RELIEF): Solitude's terraces' works stand in its Daggerfall blocks' edge strips by design - the
      // retaining wall's body under the upper blocks' lifted edge, its stairs in the lower blocks' streets - never deeper
      // than the terrain's cell, and only where those blocks' own automaps hold no house (the ARENA2 pin,
      // test/world/solitude_relief.test.js)
      const strip = id === CAPITAL_MODELS.solitudeTerraces ? SOLITUDE_TERRACES.line.depth + 0.51 : 0.51;
      // PIN MOVED (FB1029 BRIDGE-ENDS; AUDIT FB1029 A-minor): Alinor's bridges' abutments, and nothing else of the model,
      // stand in the bank's blocks - their rects alone, on cells the automaps hold nothing on (test/world/fb1029_bridgeends.test.js)
      const abut = id === CAPITAL_MODELS.alinorBridges ? alinorAbutments() : [];
      const p = customModelFor(id).positions;
      for (let i = 0; i < p.length; i += 3) {
        const x = p[i], y = p[i + 1], z = -p[i + 2];
        if (y < 0.5 || y > 30 || abut.some(([x0, z0, x1, z1]) => x >= x0 - 1e-3 && x <= x1 + 1e-3 && z >= z0 - 1e-3 && z <= z1 + 1e-3)) continue;
        const cx = Math.floor(x / BLOCK_M + AX), r = Math.floor(z / BLOCK_M + AR), cell = cap.cellAt ? cap.cellAt(r, cx) : cap.plan[r]?.[cx];   // PIN MOVED (IC-GRAND): the Imperial City's plan by its law
        if (!cell || cell === 'L' || cell === 'G' || cell === 'O' || (cap.family ? /^I[0-9a-z]{4}$/.test(cell) : Object.hasOwn(cap.blocks, cell))) continue;
        const lx = x - (cx - AX) * BLOCK_M, lz = z - (r - AR) * BLOCK_M, depth = Math.min(lx, BLOCK_M - lx, lz, BLOCK_M - lz);
        assert.ok(depth <= strip, `${cap.key} model ${id} ${depth.toFixed(2)} m into ${cell} at ${cx},${r}`);
      }
    }
  }
});

test('AUDIT-TESA A6-4: an inland capital lays no wet CUST block - each kind that carries canals kept to its dry blocks, the list whole where none is dry; a shore capital\'s as ever', async () => {
  const { dryKinds, synthesizeCapitalLocation } = await import('../src/world/tamrielCapitals.js');
  const ground = (water) => ({ rmbBlock: { fldHeader: { groundData: { groundTiles: Array.from({ length: 16 }, (_, x) => Array.from({ length: 16 }, (_, y) => ({ textureRecord: x * 16 + y < water ? 0 : 2 }))) } } } });
  const blocks = { 'CUSTAA00.RMB': ground(40), 'CUSTAA01.RMB': ground(7), 'CUSTAA02.RMB': ground(8), 'RESIAA00.RMB': ground(200) };
  const names = new Map([['CUST', ['CUSTAA00.RMB', 'CUSTAA01.RMB', 'CUSTAA02.RMB']], ['RESI', ['RESIAA00.RMB']]]);
  const dry = dryKinds(names, (n) => blocks[n]);
  assert.deepEqual(dry.get('CUST'), ['CUSTAA01.RMB'], 'seven water tiles a puddle, eight a canal');
  assert.deepEqual(dry.get('RESI'), ['RESIAA00.RMB'], 'a kind of no canals untouched');
  assert.deepEqual(names.get('CUST').length, 3, 'the list handed untouched');
  assert.deepEqual(dryKinds(new Map([['CUST', ['CUSTAA00.RMB']]]), (n) => blocks[n]).get('CUST'), ['CUSTAA00.RMB'], 'all wet: the list whole');
  assert.equal(dryKinds(null, () => null), null);
  assert.match(read('src/world/tamrielCapitals.js'), /const blockNames = capitalBlockNames\(plan, k, cap\.shore \? ctx\.names : dryKinds\(ctx\.names, ctx\.blockOf\), \(cell\) => ownBlockOf\(cap, cell\), many \? \[sx \* 8, sy \* 8\] : \[0, 0\]\);/, 'PIN MOVED (TESA11): a slice\'s; PIN MOVED (IC-GRAND): the own blocks by their law (the Imperial City\'s a family\'s)');
  void synthesizeCapitalLocation;
});

test('AUDIT-TESA A6-5: a closed cell\'s byte is no building\'s - in no quarter of the town map, no show-all byte, the walkers\' navgrid shut', async () => {
  const { CAPITAL_CLOSED_BYTE, capitalPortBlocks: blocks } = await import('../src/world/tamrielCapitals.js');
  const { quarterOf, isShowAllByte } = await import('../src/ui/town/townQuarters.js');
  assert.equal(quarterOf(CAPITAL_CLOSED_BYTE), null);
  assert.equal(isShowAllByte(CAPITAL_CLOSED_BYTE), false);
  assert.ok(CAPITAL_CLOSED_BYTE > 0 && CAPITAL_CLOSED_BYTE < 256);
  const seen = new Set();
  for (const b of blocks()) for (const v of b.json.RmbBlock.FldHeader.AutoMapData) seen.add(v);
  assert.deepEqual([...seen].sort((a, b) => a - b), [0, CAPITAL_CLOSED_BYTE]);
});

test('AUDIT-TESA A7-4: a place on a capital\'s pixel is inked on that pixel - its pin\'s, or the capital\'s where Arena\'s places do not stand - never its own point a pixel away', () => {
  const ink = read('src/ui/tamrielInk.js');
  // PIN MOVED (BAY-LEFT-MAPS C11, test/ui/bayleft_find.test.js): and its port as it stands (a lore port only on its shore, TESA6)
  assert.match(ink, /stood\.set\(`\$\{p\.provinceIndex\}\|\$\{p\.id\}`, \{ x: p\.bx, y: p\.by, pinned: !!p\.pinned, port: !!p\.port \}\);/);
  assert.match(ink, /const on = pixel && \(st\?\.pinned \|\| !st\) \? \[pixel\.x \+ 0\.5, pixel\.y \+ 0\.5\] : \[x, y\];/);
  // PIN MOVED (BAY-LEFT-MAPS C11): and its port, the anchor's and the Ports filter's word
  assert.match(ink, /kind: p\.kind, x: on\[0\], y: on\[1\], pixel, mapId: k >= 0 \? capitalPlaceId\(k, 0\) : arenaPlaceId\(p\), port \}\);/);   // PIN MOVED (WW7-6): with its map id - the seat ring's key (ww7_seatrings)
});
