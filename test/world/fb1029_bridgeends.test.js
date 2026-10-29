// FB1029 BRIDGE-ENDS (bible/01-Overview/bugs/Field-Bugs-2026-10-29.md; "Alinor bridge bug - missing part of the bridge on
// both sides"): RUMARE-WATER lets a shore capital's water vertices down a metre (world/terrain/capitalSea.js), so the
// river's bank tile slopes from the street to the waterline under each end of Alinor's bridges. Each end stands on an
// abutment over that tile, its top a ramp from the street to the deck (AUDIT FB1029 A1: a ledge stalls the motor), and
// the town's walkers keep off it (A2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ALINOR } from '../../src/world/capitalPlans.js';
import { buildAlinorBridges, alinorAbutments } from '../../src/world/capitalAlinor.js';
import { northward } from '../../src/world/capitalModels.js';
import { carveCapitalWalks } from '../../src/world/capitalWalks.js';
import { CAPITALS, capitalDims, capitalCentre } from '../../src/world/tamrielCapitals.js';
import { CityNavigation, NAV_CELL } from '../../src/world/city/cityNavigation.js';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor, FIXED_DT } from '../../src/player/motor.js';
import { BLOCK_M } from '../../src/world/blockHash.js';
import { STEP_OFFSET } from '../../src/player/motor.js';
import { CAPITAL_LAND, CAPITAL_SEA } from '../../src/world/terrain/capitalSea.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, HEIGHTMAP_DIMENSION } from '../../src/world/terrain/terrainSampler.js';

const TILE = BLOCK_M / 16, R = ALINOR.river, M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
/** Every height at which the vertical line through (x, z) meets the model's faces. */
function heightsAt(m, x, z) {
  const p = m.positions, ix = m.indices, out = [];
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3];
    const d = (p[b] - p[a]) * (p[c + 2] - p[a + 2]) - (p[c] - p[a]) * (p[b + 2] - p[a + 2]);
    if (Math.abs(d) < 1e-9) continue;   // a wall: no top
    const u = ((x - p[a]) * (p[c + 2] - p[a + 2]) - (p[c] - p[a]) * (z - p[a + 2])) / d;
    const v = ((p[b] - p[a]) * (z - p[a + 2]) - (x - p[a]) * (p[b + 2] - p[a + 2])) / d;
    if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue;
    out.push(p[a + 1] + u * (p[b + 1] - p[a + 1]) + v * (p[c + 1] - p[a + 1]));
  }
  return out;
}
/** The heights of the model's faces lying in the plane z (a vertical face there) at x - or, `axis` 0, in the plane x at z. */
function facesAt(m, x, z, axis = 2) {
  const p = m.positions, ix = m.indices, out = [], along = axis === 2 ? 0 : 2, [at, on] = axis === 2 ? [z, x] : [x, z];
  for (let t = 0; t < ix.length; t += 3) {
    const v = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3];
    if (!v.every((i) => Math.abs(p[i + axis] - at) < 1e-3)) continue;   // float32 positions
    const xs = v.map((i) => p[i + along]);
    if (on < Math.min(...xs) - 1e-6 || on > Math.max(...xs) + 1e-6) continue;
    out.push(...v.map((i) => p[i + 1]));
  }
  return out;
}
/** The highest face under `y` at (x, z), or -Infinity. */
const topUnder = (m, x, z, y) => Math.max(-Infinity, ...heightsAt(m, x, z).filter((h) => h <= y + 1e-6));
/** The walk over a bank's last tile and on to the deck, both ends: [z, how far in from the bank's edge]. */
const bankWalk = () => [0.2, 1.6, 3.2, 4.8, 6.2].flatMap((d) => [[R.z0 - TILE + d, d], [R.z1 + TILE - d, d]]);

test('FB1029 BRIDGE-ENDS Alinor\'s bridges: each end an abutment over the bank\'s last tile, across the deck\'s width - its top a ramp from the street (within 5 cm of it) up to the deck\'s end, rising all the way, gentle, meeting the deck; its parapets on, its sides down into the ground, both its ends closed; its rects the abutments\' (mutants: no abutment; one end alone; the abutment half a tile; its top a ledge; its top under the street; its sides short; an end open)', () => {
  const br = buildAlinorBridges(), hw = ALINOR.bridgeW / 2;
  assert.deepEqual(alinorAbutments().map((r) => r.map((v) => +v.toFixed(3))), ALINOR.bridges.flatMap((x) => [[x - hw, R.z0 - TILE, x + hw, R.z0], [x - hw, R.z1, x + hw, R.z1 + TILE]]).map((r) => r.map((v) => +v.toFixed(3))));
  for (const x of ALINOR.bridges) {
    for (const xi of [x - hw + 1, x, x + hw - 1]) {
      for (const [street, edge] of [[R.z0 - TILE, R.z0], [R.z1 + TILE, R.z1]]) {
        const tops = Array.from({ length: 33 }, (_, k) => topUnder(br, xi, street + ((edge - street) * (k + 0.5)) / 33, 2));
        assert.ok(Math.abs(tops[0]) < 0.05, `its foot at the street at x ${xi.toFixed(1)}, z ${street.toFixed(1)}: ${tops[0]}`);
        for (let k = 1; k < tops.length; k++) {
          assert.ok(tops[k] > tops[k - 1], `rising to the deck at x ${xi.toFixed(1)}`);
          assert.ok((tops[k] - tops[k - 1]) * 33 / TILE < 0.1, 'gentle - no ledge on the way');
        }
        assert.ok(Math.abs(topUnder(br, xi, edge + Math.sign(edge - street) * 0.05, 2) - topUnder(br, xi, edge - Math.sign(edge - street) * 0.05, 2)) < 0.05, `the deck meets its abutment at z ${edge}`);
      }
    }
    for (const s of [1, -1]) {
      for (const [z] of bankWalk()) {
        const walk = topUnder(br, x, z, 2), rail = topUnder(br, x + s * (hw - 0.3), z, 3);
        assert.ok(Math.abs(rail - walk - ALINOR.parapet) < 1e-3, `a parapet on the abutment at z ${z.toFixed(1)}, the deck's own height over its walk: ${rail} over ${walk}`);
      }
    }
    // its sides from the ground to its parapets' tops, all along it
    for (const sx of [x - hw, x + hw]) {
      for (const [z] of bankWalk()) {
        const ys = facesAt(br, sx, z, 0);
        assert.ok(ys.length && Math.min(...ys) <= -2 + 1e-6 && Math.max(...ys) >= ALINOR.parapet - 0.05, `its side at x ${sx.toFixed(1)}, z ${z.toFixed(1)}: ${ys.length ? `${Math.min(...ys)} to ${Math.max(...ys)}` : 'none'}`);
      }
    }
    // closed at both its ends: its foot's face and its parapets' ends to the street, its face under the deck to the water
    for (const [street, edge] of [[R.z0 - TILE, R.z0], [R.z1 + TILE, R.z1]]) {
      for (const [xf, z, lo, hi] of [[x, street, -2, -0.05], [x - hw + 0.3, street, 0, ALINOR.parapet - 0.05], [x + hw - 0.3, street, 0, ALINOR.parapet - 0.05], [x, edge, -2, -0.95]]) {
        const ys = facesAt(br, xf, z);
        assert.ok(ys.length && Math.min(...ys) <= lo + 1e-6 && Math.max(...ys) >= hi, `a face across z ${z.toFixed(1)} at x ${xf.toFixed(1)}, ${lo} to ${hi}: ${ys.length ? `${Math.min(...ys)} to ${Math.max(...ys)}` : 'none'}`);
      }
    }
  }
});

test('FB1029 BRIDGE-ENDS AUDIT A2 the walkers\' carve: a capital slice closes its navgrid under every rect its works shut - Alinor\'s abutments, in the slice\'s frame (its anchor block\'s north-west corner, the location\'s z north) - and nothing else; a capital with none, and a town, close nothing; the pixel build carves it beside the yards (mutants: no rect shut; the frame a block off; the build never carves)', () => {
  const tcK = CAPITALS.findIndex((c) => c.key === 'alinor'), cap = CAPITALS[tcK], D = capitalDims(cap), sl = capitalCentre(cap);
  const nav = new CityNavigation(8, 8);
  nav.grid.fill(15 << 4);
  const loc = { capital: { k: tcK, s: sl }, exterior: { exteriorData: { width: 8, height: 8 } } };
  const n = carveCapitalWalks(nav, loc);
  const ox = (cap.anchor[0] - (sl % D.w) * 8) * BLOCK_M, oz = (Math.floor(sl / D.w) * 8 + 8 - cap.anchor[1]) * BLOCK_M;
  let want = 0;
  for (let gy = 0; gy < nav.height; gy++) {
    for (let gx = 0; gx < nav.width; gx++) {
      const ax0 = gx * NAV_CELL - ox, ax1 = ax0 + NAV_CELL, az1 = oz - gy * NAV_CELL, az0 = az1 - NAV_CELL;
      const shut = alinorAbutments().some(([x0, z0, x1, z1]) => ax1 > x0 + 1e-9 && ax0 < x1 - 1e-9 && az1 > z0 + 1e-9 && az0 < z1 - 1e-9);
      if (shut) want++;
      assert.equal(nav.grid[gy * nav.width + gx] === 0, shut, `cell ${gx},${gy}`);
    }
  }
  assert.ok(want > 0 && n === want, `${n} closed, ${want} under the abutments`);
  const other = { ...loc, capital: { k: CAPITALS.findIndex((c) => c.key === 'torval'), s: 0 } };
  nav.grid.fill(15 << 4);
  assert.equal(carveCapitalWalks(nav, other) + carveCapitalWalks(nav, { exterior: loc.exterior }), 0, 'Torval and a town shut nothing');
  const build = readFileSync(new URL('../../src/scenes/pixelBuild.js', import.meta.url), 'utf8');
  assert.match(build, /if \(portSites\?\.length\) carveYards\(nav, portSites\);[^\n]*\n\s*carveCapitalWalks\(nav, dfLocation\);/, 'the build carves it with the yards');
});

test('FB1029 BRIDGE-ENDS AUDIT A1 on the game\'s own motor: a walker of Speed 30 or 50, from 2 to 12 m before an abutment, walks up it onto the deck at every end of both bridges - the bank\'s slope under it, the model lifted as the game stands it (mutant: its top a ledge at the deck\'s end height)', () => {
  const W = northward(buildAlinorBridges()), p = Float32Array.from(W.positions);
  for (let i = 1; i < p.length; i += 3) p[i] += 0.05;   // scenes/pixelBuild.js: the models 5 cm over the flatten
  const ground = (x, z) => {   // RUMARE-WATER's bank: the street, its last tile a metre down to the river, the river deep
    const a = -z, d = Math.max(R.z0 - TILE - a, a - (R.z1 + TILE));
    return d >= 0 ? 0 : a > R.z0 && a < R.z1 ? -30 : d / TILE;
  };
  const col = new Collider(ground);
  col.addMesh('bridges', p, W.indices, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  const IDLE = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
  for (const speed of [30, 50]) {
    for (const x of ALINOR.bridges) {
      for (const [face, yaw, sgn] of [[R.z0 - TILE, Math.PI, -1], [R.z1 + TILE, 0, 1]]) {
        for (let d = 2; d <= 12; d += 1.25) {
          const mo = new PlayerMotor(col, { speed, running: 50, swimming: 30 });
          mo.spawn(x, 0.02, -(face + sgn * d));
          for (let i = 0; i < 30; i++) mo.update(FIXED_DT, IDLE, yaw);
          let top = -Infinity;
          for (let i = 0; i < 10 * 60 && top < 1; i++) { mo.update(FIXED_DT, { ...IDLE, forward: 1 }, yaw); top = Math.max(top, mo.pos[1]); }
          assert.ok(top >= 1, `Speed ${speed}, ${d.toFixed(2)} m before the ${sgn < 0 ? 'north' : 'south'} end of the bridge at ${x}: stopped at ${top.toFixed(2)}`);
        }
      }
    }
  }
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'BLOCKS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));

test('FB1029 BRIDGE-ENDS (ARENA2): on the player\'s own files Alinor\'s bank tile slopes to the river\'s waterline under each bridge end, and the abutment covers it - never more than a step from the street, never under the ground, on cells its bank blocks\' automaps hold nothing on', { skip: HAVE ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { groundMaps, groundWoods } = await import('../../src/world/tamriel/tamrielGround.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  const wd = await import('../../src/formats/worldData/worldDataReplacement.js');
  const tc = await import('../../src/world/tamrielCapitals.js');
  const { installCapitals } = await import('../../src/world/capitalModels.js');
  const { isMainStoryDungeon } = await import('../../src/world/dungeon/dungeonTextures.js');
  const { setLocationTiles } = await import('../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  groundMaps(maps);
  wd.installWorldDataReplacement(); wd.bindWorldDataBlocks(blocks);
  installCapitals({ addTextures: () => 0 });
  const k = tc.CAPITALS.findIndex((c) => c.key === 'alinor'), cap = tc.CAPITALS[k], { px, py } = tc.capitalCentrePixel(k);
  const tm = new Uint8Array(16384), loc = tc.synthesizeCapitalLocation(tc.capitalOnPixel(px, py), { base: tc.capitalBase(rows, isMainStoryDungeon), names: tc.cityBlockNames(rows), blockOf: (nm) => blocks.getBlockByName(nm), px, py });
  const rect = setLocationTiles(loc, maps, blocks, tm);
  const g = generatePixelTerrain({ woods: groundWoods(woods), px, py, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, flattenAt: loc.capital.flattenAt, bed: true });
  const H = HEIGHTMAP_DIMENSION, street = CAPITAL_LAND * M, origin = street + 0.05;   // the models stand on the flatten, 5 cm up (pixelBuild.js)
  /** The ground at the anchor's metres (x east, z south), metres over the street. */
  const groundAt = (x, z) => {
    const vx = cap.anchor[0] * 16 + x / TILE, vz = cap.anchor[1] * 16 + z / TILE, x0 = Math.floor(vx), z0 = Math.floor(vz), fx = vx - x0, fz = vz - z0;
    const h = (i, j) => g.samples[i * H + (H - 1 - j)] * M;
    return (h(x0, z0) * (1 - fx) * (1 - fz) + h(x0 + 1, z0) * fx * (1 - fz) + h(x0, z0 + 1) * (1 - fx) * fz + h(x0 + 1, z0 + 1) * fx * fz) - street;
  };
  const br = buildAlinorBridges(), drop = (CAPITAL_LAND - CAPITAL_SEA) * M;
  for (const x of ALINOR.bridges) {
    for (const z of [R.z0, R.z1]) assert.ok(Math.abs(groundAt(x, z) + drop) < 0.01, `the bank's edge at the waterline, x ${x} z ${z}: ${groundAt(x, z).toFixed(2)}`);
    for (const [z, d] of bankWalk()) {
      const ground = groundAt(x, z), top = origin - street + topUnder(br, x, z, 2);
      assert.ok(ground < -0.01 * d, `the bank tile slopes to the water at z ${z.toFixed(1)}: ${ground.toFixed(2)}`);
      assert.ok(top >= ground && top <= STEP_OFFSET, `the abutment a step over the street and over the ground at x ${x}, z ${z.toFixed(1)}: ${top.toFixed(2)} over ${ground.toFixed(2)}`);
    }
  }
  // the north abutments stand in Daggerfall's bank blocks' edge strip (AUDIT-TESA A6-3's PIN MOVED): on cells those blocks'
  // automaps hold nothing on - no house under them
  const names = loc.exterior.exteriorData.blockNames, [AX, AR] = cap.anchor;
  let read = 0;
  for (const [x0, z0, x1, z1] of alinorAbutments().filter((r) => r[3] <= R.z0 + 1e-6)) {   // the model's own rects (A6-3's leave)
    for (let ax = x0 + 0.05; ax < x1; ax += 0.4) {
      for (let az = z0 + 0.05; az < z1; az += 0.4) {
        const cx = Math.floor(ax / BLOCK_M + AX), r = Math.floor(az / BLOCK_M + AR), name = names[(7 - r) * 8 + cx];
        if (!name || name.startsWith('CUST')) continue;
        const A = blocks.getBlockByName(name).rmbBlock.fldHeader.autoMapData, lx = ax - (cx - AX) * BLOCK_M, lz = az - (r - AR) * BLOCK_M;
        read++;
        assert.equal(A[Math.floor(lz / 1.6) * 64 + Math.floor(lx / 1.6)], 0, `${name}'s automap clear under the abutment at ${ax.toFixed(1)},${az.toFixed(1)}`);
      }
    }
  }
  assert.ok(read > 0, 'a Daggerfall block read under the north abutments');
  // AUDIT A2: the walkers' grid, built as scenes/pixelBuild.js builds it, open under the north abutments on Daggerfall's
  // road - and closed under every abutment once the capital's works are carved, nothing past them
  const { layoutLocation } = await import('../../src/world/locationLayout.js');
  const lay = layoutLocation(loc, maps, blocks, {}), nav = new CityNavigation(lay.width, lay.height);
  for (const b of lay.blocks) nav.setBlockData(b.x, b.y, b.dfBlock.rmbBlock.fldHeader.autoMapData, (tx, ty) => b.dfBlock.rmbBlock.fldHeader.groundData.groundTiles[tx][ty].textureRecord);
  const D = tc.capitalDims(cap), sl = loc.capital.s ?? tc.capitalCentre(cap), H8 = loc.exterior.exteriorData.height;
  const cellOf = (ax, az) => nav.worldToNav(ax + (AX - (sl % D.w) * 8) * BLOCK_M, (Math.floor(sl / D.w) * 8 + H8 - AR) * BLOCK_M - az);
  const under = (rect) => { const out = []; for (let ax = rect[0] + 0.8; ax < rect[2]; ax += NAV_CELL) for (let az = rect[1] + 0.8; az < rect[3]; az += NAV_CELL) out.push(cellOf(ax, az)); return out; };
  const north = alinorAbutments().filter((r) => r[3] <= R.z0 + 1e-6);
  const cells = north.flatMap(under), open = cells.filter(([gx, gy]) => nav.weightAt(gx, gy) > 0).length;
  assert.equal(open, cells.length, 'the walkers\' ground under the north abutments, every cell, before the carve');
  const before = Uint8Array.from(nav.grid), closed = carveCapitalWalks(nav, loc);
  assert.ok(closed >= open, `closed ${closed}`);
  for (const r of alinorAbutments()) for (const [gx, gy] of under(r)) assert.equal(nav.weightAt(gx, gy), 0, `a walker under the abutment ${r.map((v) => v.toFixed(1))} at ${gx},${gy}`);
  let changed = 0;
  for (let i = 0; i < before.length; i++) if (before[i] !== nav.grid[i]) changed++;
  assert.equal(changed, closed, 'only the abutments\' cells');
  const [ex, ez] = cellOf(north[0][0] - 3, north[0][1] + 3);
  assert.equal(nav.grid[ez * nav.width + ex], before[ez * nav.width + ex], 'beside it, the street as it was');
});
