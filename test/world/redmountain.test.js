// RED-MOUNTAIN (2026-10-27, bible/03-World/Red-Mountain.md; the owner: "An absolute massive volcano true to lore that
// towers in the distance") - the volcano at Vvardenfell's heart stood on the land past the Bay (world/tamriel/redMountain.js),
// through the kernel's own shaper (world/landforms.js). The law (its flank, its crater, its gullies and foyada, the land's
// own shapes faded up it, its bound), the kernel (a pixel on the cone built whole: its seams one number from both pixels,
// its crater floor the one floor, its top under groundTopOf), and where ARENA2_PATH names the data, the freeware's own
// trace: the summit over 6.5 km, the zone about it Red Mountain's, no place on its cone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as acorn from 'acorn';
import {
  RED_MOUNTAIN_DIALS, RED_MOUNTAIN_REACH, RED_MOUNTAIN_TOP, CRATER_FLOOR_LIFT, coneProfile, redMountainFrame, redMountainLand,
  redMountainReaches, redMountainTopNear, redMountainGround, coneGrade, dirOf,
} from '../../src/world/tamriel/redMountain.js';
import { createLandforms, redMountainGroundOf, byteBase, groundTopOf, reliefByteHeight, byteBeyond, landformSitesBeyond } from '../../src/world/landforms.js';
import { groundWoods, tamrielHeightByte, dropGroundCache } from '../../src/world/tamriel/tamrielGround.js';
import { tamrielBiomeAt, heartsAnchor } from '../../src/world/tamriel/tamrielBiomes.js';
import { MOUNTAIN_RANGES } from '../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay, setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import { sampleKernel, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, SCALED_OCEAN_ELEVATION } from '../../src/world/terrain/terrainSampler.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../../src/formats/woodsFile.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const D = RED_MOUNTAIN_DIALS;
const UNIT = STREAMING_TERRAIN_SCALE;
const deg = (rise) => (Math.atan(rise) * 180) / Math.PI;

/** WoodsFile's reads over a flat buffer (the Bay at byte 20), its clamps to the letter, on a prototype as the real
 *  reader's are - the composition is a prototype child (test/world/tamriel2.test.js's own). */
class StubWoods {
  constructor() { this.buf = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(20); }
  getHeightMapValue(x, y) {
    if (x < 0) x = 0; if (x >= MAP_WIDTH - 1) x = MAP_WIDTH - 1; if (y < 0) y = 0; if (y >= MAP_HEIGHT - 1) y = MAP_HEIGHT - 1;
    return this.buf[y * MAP_WIDTH + x];
  }
  getHeightMapValuesRange1Dim(x0, y0, dim) {
    const d = new Uint8Array(dim * dim);
    for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) d[x + y * dim] = this.getHeightMapValue(x0 + x, y0 + y);
    return d;
  }
  getLargeMapData() { const d = []; for (let i = 0; i < 5; i++) d.push(new Uint8Array(5).fill(3)); return d; }
  getLargeHeightMapValuesRange(x0, y0, dim) {
    const side = dim * 3, dst = new Uint8Array(side * side);
    for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) {
      const src = this.getLargeMapData(x0 + x, y0 - y);
      for (let iy = 1; iy < 4; iy++) for (let ix = 1; ix < 4; ix++) dst[(y * 3 + iy - 1) * side + (x * 3 + ix - 1)] = src[ix][4 - iy];
    }
    return dst;
  }
}

test('RED-MOUNTAIN the flank: the lift at the rim, half of it within 5 km, a quarter at 14 km, a tenth at 35 km, none past the reach; never rising outward; about 29 degrees under the rim and gentle on the shield (mutants: a tier\'s power, the shares, the reach)', () => {
  assert.equal(coneProfile(0), D.lift);
  const f = (d) => coneProfile(d) / D.lift;
  assert.ok(Math.abs(f(5000) - 0.5) < 0.03, `half within 5 km (${f(5000).toFixed(3)})`);
  assert.ok(Math.abs(f(14000) - 0.25) < 0.02, `a quarter at 14 km (${f(14000).toFixed(3)})`);
  assert.ok(Math.abs(f(35000) - 0.1) < 0.01, `a tenth at 35 km (${f(35000).toFixed(3)})`);
  assert.equal(coneProfile(RED_MOUNTAIN_REACH - D.rim), 0);
  assert.equal(coneProfile(RED_MOUNTAIN_REACH), 0);
  for (let d = 0; d < RED_MOUNTAIN_REACH; d += 250) assert.ok(coneProfile(d + 250) <= coneProfile(d), `rising outward at ${d} m`);
  const grade = (d) => (coneProfile(d) - coneProfile(d + 10)) / 10;
  assert.ok(deg(grade(0)) > 27 && deg(grade(0)) < 31, `the rim's flank ${deg(grade(0)).toFixed(1)} degrees`);
  assert.ok(deg(grade(30000)) < 2, `the shield's ${deg(grade(30000)).toFixed(2)} degrees`);
  assert.ok(Math.abs(D.tiers.reduce((a, t) => a + t.share, 0) - 1) < 1e-12, 'the tiers share the whole lift');
  for (let d = 0; d < RED_MOUNTAIN_REACH; d += 997) assert.ok(Math.abs(coneGrade(d) - (coneProfile(d) - coneProfile(d + 0.01)) / 0.01) < 1e-5, `the grade the profile's own slope at ${d} m`);
  assert.deepEqual(dirOf(0).map((v) => +v.toFixed(12)), [1, 0]);
  assert.deepEqual(dirOf(0.25).map((v) => +v.toFixed(12)), [0, 1]);
  assert.deepEqual(dirOf(0.625).map((v) => +v.toFixed(12)), [+(-Math.SQRT1_2).toFixed(12), +(-Math.SQRT1_2).toFixed(12)]);
});

test('RED-MOUNTAIN the frame: centred on Red Mountain\'s summit as the zones stand it (heartsAnchor) - on the authored shape its spine\'s middle, on Morrowind\'s land in its own zone; the foyada leave the rim outward on their bearings; it moves with the fit (mutants: the centre\'s row, the foyada\'s start)', () => {
  const f = redMountainFrame();
  assert.ok(f, 'a frame on the authored shape');
  const at = heartsAnchor('Morrowind', 'Red Mountain');
  const spine = MOUNTAIN_RANGES.find((r) => r.name === 'Red Mountain').pts;
  assert.deepEqual(at, [(spine[0][0] + spine[1][0]) / 2, (spine[0][1] + spine[1][1]) / 2], 'no relief: the authored spine\'s middle');
  const [bx, by] = pictureToBay(at[0], at[1]);
  assert.deepEqual([f.bx, f.by], [bx, by]);
  assert.deepEqual([f.cx, f.cy], [bx * 128, (MAP_HEIGHT + 1 - by) * 128], 'world samples: x east, y north from the map\'s south edge');
  assert.ok(tamrielHeightByte(Math.floor(bx), Math.floor(by)) > 0 && tamrielBiomeAt(Math.floor(bx), Math.floor(by))?.key === 'morrowindRedMountain');
  assert.equal(f.reach, RED_MOUNTAIN_REACH / 6.4);
  for (let i = 0; i < D.foyada.length; i++) {
    const line = f.foyada[i], [ux, uy] = dirOf(D.foyada[i].az), n = line.s.length;
    const x0 = (line.pts[0] - f.cx) * 6.4, y0 = (line.pts[1] - f.cy) * 6.4;
    assert.ok(Math.abs(Math.hypot(x0, y0) - D.rim) < 1e-6 && Math.abs(x0 / D.rim - ux) < 1e-9 && Math.abs(y0 / D.rim - uy) < 1e-9, `${line.name} leaves the rim on its bearing`);
    assert.equal(line.s[n - 1], (n - 1) * D.trough.step);
    const xe = (line.pts[2 * n - 2] - f.cx) * 6.4, ye = (line.pts[2 * n - 1] - f.cy) * 6.4;
    assert.ok(xe * ux + ye * uy > D.rim + 0.9 * line.s[n - 1] - D.foyada[i].wander, `${line.name} runs outward`);
  }
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const g = redMountainFrame();
    assert.notEqual(g, f, 'a new frame for the fit');
    assert.deepEqual([g.bx, g.by], pictureToBay(at[0], at[1]));
  } finally { setTamrielFit(null); }
  assert.deepEqual([redMountainFrame().bx, redMountainFrame().by], [bx, by], 'and back');
});

test('RED-MOUNTAIN the land: past its reach the land to the bit; the crater floor the floor; the rim the crowned lift; the land\'s own shapes none at the rim and whole past `keep`; a foyada a breach in the rim to the lake\'s level, its floor its level to the bit and never rising down its line; the gullies within their depth; the bound over every sample of a pixel (mutants: the floor, the keep, the breach, the crown, the bound\'s distance)', () => {
  const f = redMountainFrame(), base = 1800, hills = 40, ground = redMountainGround(() => base, {}), floor = ground.floor;
  assert.equal(floor, base + CRATER_FLOOR_LIFT);
  const at = (dm, turn) => { const [ux, uy] = dirOf(turn); return [f.cx + (ux * dm) / 6.4, f.cy + (uy * dm) / 6.4]; };
  const land = (dm, turn, h = hills) => redMountainLand(...at(dm, turn), base, h, ground);
  assert.equal(land(RED_MOUNTAIN_REACH + 10, 0.3), base + hills);
  assert.equal(redMountainLand(f.cx + f.reach + 1, f.cy, base, hills, ground), base + hills);
  assert.equal(land(0, 0), floor, 'the centre the floor');
  assert.equal(land(D.floor - 1, 0.81), floor, 'the floor flat to its radius');
  // the rim: the lift crowned by the lobes, the land's own shapes none (its hills read nothing there)
  const rim = [0.05, 0.2, 0.45, 0.7, 0.9].map((t) => land(D.rim, t) - base);
  for (const v of rim) assert.ok(v * UNIT > D.lift * (1 - D.lobes.amp) - 1 && v * UNIT < D.lift * (1 + D.lobes.amp) + 1, `the rim stands ${(v * UNIT).toFixed(0)} m over the land`);
  assert.ok(Math.max(...rim) - Math.min(...rim) > 20, 'the crown wanders round the crater');
  assert.equal(land(D.rim, 0.2, 500), land(D.rim, 0.2, -500), 'no landforms on the rim');
  const past = D.rim + D.keep + 10;
  assert.equal(land(past, 0.4, hills) - land(past, 0.4, 0), hills, 'the land\'s own shapes whole past keep');
  // a foyada: a breach in the rim at the lake's level, lower than the rim a little way round by most of the crater's depth
  const [sx, sy] = at(D.rim + 5, D.foyada[0].az), [ox, oy] = at(D.rim + 5, D.foyada[0].az + 0.03);
  assert.ok(redMountainLand(sx, sy, base, 0, ground) <= floor + 1e-6, 'the breach at the lake\'s level');
  assert.ok(redMountainLand(sx, sy, base, 0, ground) < redMountainLand(ox, oy, base, 0, ground) - D.depth * 0.8 / UNIT, 'the breach cuts the rim');
  // down each line: its floor never rising, never over the lake's; on its line and across its middle half the land its level
  for (let fi = 0; fi < f.foyada.length; fi++) {
    const line = f.foyada[fi], lv = ground.chan[fi];
    assert.ok(lv[0] <= floor);
    for (let i = 1; i < lv.length; i++) assert.ok(lv[i] <= lv[i - 1], `${line.name}: its floor falls at ${i}`);
    for (let i = 3; i < lv.length - 8; i += 7) {
      const x = line.pts[2 * i], y = line.pts[2 * i + 1], ex = line.pts[2 * i + 2] - x, ey = line.pts[2 * i + 3] - y, el = Math.hypot(ex, ey);
      const half = (D.trough.halfTop + (D.trough.halfFoot - D.trough.halfTop) * (line.s[i] / line.s[line.s.length - 1])) / 6.4;
      for (const side of [0, 0.3, -0.3]) {
        const v = redMountainLand(x - (ey / el) * side * half, y + (ex / el) * side * half, base, 0, ground);
        if (side === 0) assert.ok(Math.abs(v - lv[i]) < 1e-6, `${line.name} ${i}: ${v} against its level ${lv[i]}`);
        else assert.ok(v <= lv[i - 1] + 1e-6 && v >= lv[i + 1] - 1e-6, `${line.name} ${i} across ${side}: ${v} between its levels ${lv[i - 1]}..${lv[i + 1]}`);   // the level of its own nearest point
      }
    }
  }
  // the gullies: within their depth of the crowned flank
  for (let dm = D.rim + 500; dm < D.rim + D.gully.reach; dm += 1777) {
    for (const turn of [0.07, 0.29, 0.53, 0.88]) {
      const v = (land(dm, turn, 0) - base) * UNIT, flank = coneProfile(dm - D.rim);
      assert.ok(v <= flank * (1 + D.lobes.amp) + 1.2 * D.gully.depth + 1e-6 && v >= flank * (1 - D.lobes.amp) - D.gully.depth - D.depth - 1e-6, `${dm} m at ${turn}: ${v.toFixed(1)} m against ${flank.toFixed(1)}`);
    }
  }
  // the bound: every sample of a pixel on the flank stands within redMountainTopNear of the land under it
  for (const [qx, qy] of [[Math.floor(f.bx), Math.floor(f.by)], [Math.floor(f.bx) + 3, Math.floor(f.by) - 2], [Math.floor(f.bx) + 5, Math.floor(f.by)], [Math.floor(f.bx) - 6, Math.floor(f.by) + 3], [Math.floor(f.bx) - 20, Math.floor(f.by) + 9]]) {   // the steep flank too: a pixel there spans hundreds of metres
    const top = redMountainTopNear(qx, qy);
    assert.ok(top > 0);
    for (let x = 0; x <= 128; x += 8) for (let y = 0; y <= 128; y += 8) {
      assert.ok(redMountainLand(qx * 128 + x, (MAP_HEIGHT - qy) * 128 + y, base, 0, ground) - base <= top + 1e-9, `(${qx},${qy}) (${x},${y}) under its bound`);
    }
  }
  assert.equal(redMountainTopNear(Math.floor(f.bx) + Math.ceil(RED_MOUNTAIN_REACH / 819.2) + 2, Math.floor(f.by)), 0, 'none past the reach');
  assert.ok(RED_MOUNTAIN_TOP >= redMountainTopNear(Math.floor(f.bx), Math.floor(f.by)));
  assert.equal(CRATER_FLOOR_LIFT, (D.lift - D.depth) / UNIT);
  assert.ok(redMountainReaches(f.cx, f.cy, f.cx + 1, f.cy + 1) && !redMountainReaches(f.cx + f.reach + 1, f.cy, f.cx + f.reach + 2, f.cy + 1));
});

test('RED-MOUNTAIN in the kernel: a pixel on the cone built through the landforms (the Bay a stub, the continent authored) is the law\'s - the crater floor the one floor at the centre\'s byte, the summit pixel\'s edges one number from both pixels, under groundTopOf, the land past its reach the land without it; a site on its flank stands on it (mutants: the shaper\'s volcano, the site\'s, the bound unread)', () => {
  dropGroundCache();
  const g = groundWoods(new StubWoods()), lf = createLandforms({ woods: g });
  const f = redMountainFrame(), px = Math.floor(f.bx), py = Math.floor(f.by);
  const floor = redMountainGroundOf(g).floor;
  assert.equal(floor, byteBase((x, y) => g.getHeightMapValue(x, y))(f.cx, f.cy) + CRATER_FLOOR_LIFT);
  assert.equal(redMountainGroundOf(g), redMountainGroundOf(g), 'made once a world');
  const b = byteBase((x, y) => g.getHeightMapValue(x, y));
  assert.equal(b((px + 1) * 128, (MAP_HEIGHT - py) * 128), reliefByteHeight(g.getHeightMapValue(px, py), 1, byteBeyond(px, py)), 'a byte node where the kernel stands it');
  const k = (x, y) => sampleKernel(g, x, y, 129, true, lf);
  const c = k(px, py), e = k(px + 1, py), n = k(px, py - 1);
  const at = (fn, x, y) => fn(x, y) * MAX_TERRAIN_HEIGHT;
  // the centre's crater floor is the one floor (where the floor's own radius covers the sample)
  const sx = Math.round((f.cx - px * 128)), sy = Math.round(f.cy - (MAP_HEIGHT - py) * 128);
  assert.ok(Math.abs(at(c, sx, sy) - floor) < 1e-6, `the crater floor ${at(c, sx, sy)} against ${floor}`);
  assert.ok(floor * UNIT > 5000, `the floor over 5 km (${(floor * UNIT).toFixed(0)} m)`);
  for (let s = 0; s <= 128; s += 8) {
    assert.equal(c(128, s), e(0, s), `the east edge at ${s}`);
    assert.ok(c(s, 128) === n(s, 0) || c(s, 0) === n(s, 128), `the north edge at ${s}`);
  }
  const top = groundTopOf(g, px, py, true);
  for (let x = 0; x <= 128; x += 16) for (let y = 0; y <= 128; y += 16) assert.ok(at(c, x, y) <= top + 1e-6, 'under groundTopOf');
  // the rim pixel stands over the floor; a pixel past the reach is the ground without the volcano (its byte's land)
  const rimPx = px + Math.round(D.rim / 819.2 + 1);
  assert.ok(at(k(rimPx, py), 64, 64) > floor, 'the flank over the crater floor');
  const out = Math.ceil(RED_MOUNTAIN_REACH / 819.2) + 3;
  const plain = createLandforms({ woods: g, hills: true });
  assert.equal(sampleKernel(g, px + out, py, 129, true, plain)(64, 64), k(px + out, py)(64, 64));
  assert.ok(at(k(px + out, py), 64, 64) * UNIT < 3000, 'the land past the reach its own');
  // a site on the flank: the kernel's land there pulls to a level of the land WITH the volcano (siteLevel)
  const sitePx = [px - 12, py];
  const loc = { exterior: { exteriorData: {} }, mapTableData: {} };
  const beyond = landformSitesBeyond([{ px: sitePx[0], py: sitePx[1], loc: { ...loc, exterior: { exteriorData: { width: 2, height: 2 } } } }]);
  const withSite = createLandforms({ woods: g, beyond });
  const lvl = sampleKernel(g, sitePx[0], sitePx[1], 129, true, withSite)(64, 64) * MAX_TERRAIN_HEIGHT;
  const bare = at(k(sitePx[0], sitePx[1]), 64, 64);
  assert.ok(Math.abs(lvl - bare) * UNIT < 120, `the town on the flank stands on the flank (${(lvl * UNIT).toFixed(0)} m against the land's ${(bare * UNIT).toFixed(0)})`);
  assert.ok(lvl * UNIT > 2500, 'over the land without the volcano');
});

test('RED-MOUNTAIN by source: the shaper and a site\'s level stand the volcano past the Bay alone, groundTopOf adds its bound, the module is the worker\'s kind (world/ alone) and one float in every engine (no Math.cos, Math.exp, Math.atan2, `**`)', () => {
  const lf = read('src/world/landforms.js'), rm = read('src/world/tamriel/redMountain.js');
  assert.match(lf, /const crater = continent && redMountainReaches\(ox - span, oy - span, ox \+ 2 \* span, oy \+ 2 \* span\) \? redMountainGroundOf\(woods\) : null;/);
  assert.match(lf, /crater !== null \? redMountainLand\(gx, gy, base, hh, crater\) : base \+ hh;/);
  assert.match(lf, /const crater = tl && redMountainReaches\(ox, oy, ox \+ span, oy \+ span\) \? redMountainGroundOf\(woods\) : null;/);
  assert.match(lf, /Math\.max\(hill, TAMRIEL_TOP\) \+ redMountainTopNear\(px, py\)/);
  const imports = [...rm.matchAll(/^import .* from '([^']+)';/gm)].map((m) => m[1]);
  assert.ok(imports.length && imports.every((p) => p.startsWith('./') || p === '../perlin.js' || p === '../terrain/terrainSampler.js'), `world/ alone: ${imports}`);
  const own = new Set(['sin', 'cos', 'tan', 'atan', 'atan2', 'exp', 'log', 'pow', 'hypot', 'cbrt']), hits = [];
  const walk = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'MemberExpression' && node.object.name === 'Math' && own.has(node.property.name)) hits.push(node.property.name);
    if ((node.type === 'BinaryExpression' || node.type === 'AssignmentExpression') && /\*\*/.test(node.operator)) hits.push(node.operator);
    for (const k of Object.keys(node)) { const v = node[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  };
  walk(acorn.parse(rm, { ecmaVersion: 'latest', sourceType: 'module' }));
  assert.deepEqual(hits, []);
});

test('RED-MOUNTAIN its fire and its horizon: the cap line rides the cone (a zone\'s line over the land under it, CAP_NONE kept), the air leans warm by the ground\'s own heat, the snow\'s levels stand over its rim; the far ring stands the smooth cone at a pixel\'s centre, a far field cell its highest, and the air\'s mean ground the same cone (mutants: the line unraised, the heat unread, the ring\'s term, the cell\'s box)', async () => {
  const { capLineOfPixel, SNOWCAP, CAP_NONE } = await import('../../src/world/peaks/snowcap.js');
  const { SNOWPACK, levelAltitude } = await import('../../src/systems/weather/snowpack.js');
  const { airParamsAt, setAirGround } = await import('../../src/systems/weather/airTemperature.js');
  const { ringHeight, ringHeightAt } = await import('../../src/render/farRing.js');
  const { meanGroundField } = await import('../../src/world/landforms.js');
  const { redMountainLiftAt, redMountainSmooth } = await import('../../src/world/tamriel/redMountain.js');
  const { CLIMATES } = await import('../../src/formats/mapsTables.js');
  const f = redMountainFrame(), cx = Math.floor(f.bx), cy = Math.floor(f.by);
  // the cap line: a zone with a line, on the cone, stands it over the cone's own lift
  let lined = 0;
  for (let dy = -40; dy <= 40; dy += 4) for (let dx = -40; dx <= 40; dx += 4) {
    const z = tamrielBiomeAt(cx + dx, cy + dy), line = z ? SNOWCAP.zones[z.key] : undefined;
    if (line === undefined) continue;
    const want = line >= CAP_NONE ? CAP_NONE : line + redMountainLiftAt(cx + dx, cy + dy) * UNIT;
    assert.equal(capLineOfPixel(cx + dx, cy + dy, () => CLIMATES.Mountain), want, `${z.key} at ${dx},${dy}`);
    if (line < CAP_NONE && redMountainLiftAt(cx + dx, cy + dy) > 0) lined++;
  }
  assert.ok(lined > 0, 'a zone with a line on the cone');
  assert.equal(capLineOfPixel(cx, cy, () => CLIMATES.Mountain), CAP_NONE, 'Red Mountain\'s own: none');
  // the air: the ground's own heat on its mean
  const ground = { climateAt: () => CLIMATES.Mountain, groundAt: () => 100 };
  try {
    setAirGround(ground);
    const cold = airParamsAt(1000, 1000).mean;
    setAirGround({ ...ground, heatAt: () => 7.5 });
    assert.equal(airParamsAt(1000, 1000).mean, cold + 7.5);
  } finally { setAirGround(null); }
  const airGround = read('src/systems/weather/airGround.js');
  assert.match(airGround, /heatAt: \(x, z\) => \(landforms \? LAPSE_C_PER_M \* redMountainSmooth\(\(x \/ TERRAIN_SIZE\) \* span, \(z \/ TERRAIN_SIZE \+ 1\) \* span\) \* STREAMING_TERRAIN_SCALE : 0\),/);
  // the snow's levels: over the highest the cone and the relief's top byte can stand
  const highest = reliefByteHeight(180, 1, 1) * UNIT + RED_MOUNTAIN_TOP * UNIT;
  assert.ok(levelAltitude(SNOWPACK.levels.count - 1) > highest, `the levels to ${levelAltitude(SNOWPACK.levels.count - 1)} m, over ${highest.toFixed(0)}`);
  // the horizon: the ring's term at a pixel's centre, the field's cell its highest
  for (const [x, y] of [[cx, cy], [cx + 2, cy - 1], [cx - 9, cy + 5], [cx + 60, cy], [cx + 200, cy]]) {
    assert.equal(ringHeightAt(x, y, 90, true), ringHeight(90, true, 1, byteBeyond(x, y)) + redMountainLiftAt(x, y) * UNIT);
    assert.equal(ringHeightAt(x, y, 90, false), ringHeight(90), 'none on the classic law');
    assert.equal(redMountainLiftAt(x, y), redMountainSmooth((x + 0.5) * 128, (MAP_HEIGHT - y) * 128 + 64));
    let most = 0;
    for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) most = Math.max(most, redMountainLiftAt(x + i, y + j));
    assert.ok(redMountainLiftAt(x, y, 4) >= most - 1e-9, `the cell about ${x},${y} its highest`);
  }
  assert.equal(redMountainLiftAt(cx, cy), (D.lift - D.depth) / UNIT, 'the crater\'s floor at the centre\'s pixel, on the horizon');
  assert.ok(redMountainLiftAt(cx + 3, cy) * UNIT > 3000, 'and its flank');
  assert.match(read('src/render/farRing.js'), /heightOf: \(byte, x, y\) => ringHeightAt\(x, y, byte, !!inputs\.relief, 1, FAR_CELL \/ 2\),/, 'the far field asks the cell\'s highest');
  // the air's mean ground: the smooth cone over the land
  const g = groundWoods(new StubWoods());
  const withCone = meanGroundField(g, cx + 3, cy, true), without = meanGroundField(g, cx + 60, cy, true);
  assert.ok(withCone(64, 64) - meanGroundField(g, cx + 3, cy, false)(64, 64) > 2000, 'the mean ground stands the cone');
  assert.ok(Math.abs(without(64, 64) - meanGroundField(g, cx + 60, cy, true)(64, 64)) < 1e-9);
});

test('RED-MOUNTAIN its fire: the profile the far draw hides behind the cone\'s own (the crater floor at the centre, the rim\'s lift, falling past it); the lake on the crater\'s floor and each river on its foyada\'s floor, down its lava\'s run; the shader hides the lake from an eye outside the crater under its rim and shows it from over it, hides a river on the far flank and shows one on the near; the far ring draws it last of its pass and lets it go (mutants: the profile\'s crater, the lake\'s level, a river\'s level, the hiding\'s margin, the draw unwired)', async () => {
  const { fireProfile, fireMesh, profileR, FIRE, LAVA_FS, PLUME_FS, FIRE_PROGRAMS } = await import('../../src/render/redMountainFire.js');
  const { glslFunctions } = await import('../glsl.mjs');
  const prof = fireProfile(), n = FIRE.profile;
  assert.equal(prof[0], Math.fround(D.lift - D.depth), 'the crater floor at the centre');
  for (let i = 0; i < n; i++) {
    const r = profileR(i);
    if (r >= D.rim) assert.equal(prof[i], Math.fround(coneProfile(r - D.rim)));
    if (i && profileR(i - 1) >= D.rim) assert.ok(prof[i] <= prof[i - 1], 'falling past the rim');
  }
  assert.equal(profileR(n - 1), RED_MOUNTAIN_REACH);
  assert.ok(profileR(10) - profileR(9) < 300, 'crowded at the crater');
  assert.equal(prof[n - 1], 0);
  // the mesh: the lake on the floor, the rivers on their floors
  const f = redMountainFrame(), base = 1800, ground = redMountainGround(() => base, {});
  const m = fireMesh(f, ground), UNITM = UNIT;
  assert.deepEqual([m.px, m.py], [Math.floor(f.bx), Math.floor(f.by)]);
  assert.equal(m.base, ground.floor * UNITM - (D.lift - D.depth));
  let lake = 0, river = 0;
  for (let v = 0; v < m.count; v++) {
    const o = v * 10, kind = m.lava[o + 9];
    if (kind === 0) {
      lake++;
      assert.equal(m.lava[o + 1], Math.fround(ground.floor * UNITM + FIRE.lakeOver));
      assert.ok(Math.hypot(m.lava[o] - m.centre[0], m.lava[o + 2] - m.centre[2]) <= D.floor * FIRE.lake + 1e-2, 'the lake within the floor');
    } else {
      river++;
      assert.ok(m.lava[o + 6] >= 0 && m.lava[o + 6] <= 1 + 1e-9 && Math.abs(m.lava[o + 7]) === 1);
    }
  }
  assert.equal(lake, FIRE.ringSegments * 3);
  assert.ok(river > 0 && river % 6 === 0);
  // each river's first vertex: its line's first point, on its first level
  const first = m.lava.subarray(lake * 10, lake * 10 + 10), line = f.foyada[0];
  const lx = (line.pts[0] - m.px * 128) * 6.4, lz = (line.pts[1] - (MAP_HEIGHT - m.py) * 128) * 6.4;
  assert.ok(Math.abs(Math.hypot(first[0] - lx, first[2] - lz) - first[8]) < 1e-2, 'the strip its half-width off its line');
  assert.equal(first[1], Math.fround(ground.chan[0][0] * UNITM + FIRE.riverOver));
  // the shader's hiding: the cone at (0, 0), the land at 0
  const fns = glslFunctions(LAVA_FS, { uCone: [0, 0, 0, 1], uProf: Array.from(prof), uEye: [0, 0, 0], uHaze: [0, 1, 0, 0], uFogColor: [0, 0, 0], uTime: 0, vWorld: [0, 0, 0], vInfo: [0, 0, 0, 0], vLocal: [0, 0] });
  const hide = (eye, p, margin = FIRE.margin.lava) => { fns.globals.uEye = eye; return fns.hidden(p, margin); };
  const lakeAt = [300, D.lift - D.depth + FIRE.lakeOver, 200];
  assert.equal(hide([40000, 2500, 0], lakeAt), true, 'from the plateau: under the rim');
  assert.equal(hide([6000, D.lift + 3000, 0], lakeAt), false, 'from over the rim');
  const near = [D.rim + 6000, coneProfile(6000) - 40, 0];
  assert.equal(hide([45000, 1500, 0], near), false, 'a river on the near flank');
  assert.equal(hide([45000, 1500, 0], [-near[0], near[1], 0]), true, 'a river on the far flank');
  // an eye on land under the cone's foot far off (the plateau falls away from the centre) still sees the plume over the rim,
  // and the ray asks nothing past the cone's own reach
  assert.equal(hide([60000, -500, 0], [0, D.lift + 2000, 0], FIRE.margin.plume), false, 'the plume from the low land far off');
  assert.equal(hide([60000, -500, 0], [0, D.lift - D.depth + 100, 0], FIRE.margin.plume), true, 'its foot under the rim, from there');
  // an eye on the flank whose own ground stands under the profile (the land under the cone lower than at its centre)
  const flank = 15000, eyeY = coneProfile(flank - D.rim) - 300 + 2;
  assert.equal(hide([flank, eyeY, 0], [0, D.lift + 2000, 0], FIRE.margin.plume), false, 'the plume from the flank, the eye\'s ground given back');
  // a point within the margin under the profile is not under it; past the margin it is
  fns.globals.uEye = [60000, 3000, 0];
  const at6 = Number(fns.coneAt([6000, 0]));
  assert.equal(fns.under([6000, at6 - 50, 0], FIRE.margin.lava), false);
  assert.equal(fns.under([6000, at6 - 150, 0], FIRE.margin.lava), true);
  fns.globals.uCone = [0, 0, 0, 0];
  assert.equal(fns.hidden([-near[0], near[1], 0], FIRE.margin.lava), false, 'the near draw asks nothing: the world\'s depth does');
  // the haze lies under the summits: the ring's hold eased down over the old ceiling, both lanes'
  const { RING_SEA_GLSL, SUMMIT_HAZE } = await import('../../src/render/horizonHaze.js');
  const sea = glslFunctions(RING_SEA_GLSL, { vWorld: [0, 0, 0], uOrigin: [0, -1500, 0], vSea: 0, vSeaBody: [0, 0, 0], uEye: [0, 0, 0], uSkyZenith: [0, 0, 0], uSkyHorizon: [0, 0, 0], uSeaF0: 0, uSeaLook: 0, uLightDir: [0, 1, 0], uMoonDir: [0, 1, 0], uMoonScale: 0 });
  const holdAt = (alt) => { sea.globals.vWorld = [0, alt - 1500, 0]; return sea.summitHold(0.85); };
  assert.equal(holdAt(SUMMIT_HAZE.from - 1), 0.85, 'the land under the old ceiling as it was');
  assert.ok(Math.abs(holdAt(SUMMIT_HAZE.to + 1) - 0.85 * (1 - SUMMIT_HAZE.keep)) < 1e-9, 'the summit through thinner air');
  assert.ok(SUMMIT_HAZE.from > 3644 + 42.5, 'over every other ground in the world (LANDFORM_CEILING)');
  assert.deepEqual({ ...SUMMIT_HAZE }, { from: 3700, to: 6500, keep: 0.7 }, 'the summit three-tenths of the hold (Red-Mountain.md)');
  for (const text of [read('src/render/farRing.js'), read('src/render/enhancedLighting.js')]) assert.match(text, /uRimStart, uRimEnd, summitHold\(uHazeHold\)\)/);
  // the plume: its billows world-space noise in 0..1, the same about its foot wherever the world stands it; its column's
  // radius within its lump of its swell, at its foot and its top, leaning downwind
  const { PLUME_VS } = await import('../../src/render/redMountainFire.js');
  const pv = glslFunctions(PLUME_VS, { uFoot: [100, 2000, -300], uEye: [100, 2000, 60000], uTime: 0.3, uVP: Array(16).fill(0), aUV: [0, 0] });
  for (const rel of [[0, 0, 0], [500, 1200, -700], [-3000, 6000, 2500]]) {
    const v = Number(pv.billows(rel, 0.4, 0.3));
    assert.ok(v >= 0 && v <= 1, `billows ${v}`);
    pv.globals.uFoot = [5000, 0, 5000];
    assert.equal(Number(pv.billows(rel, 0.4, 0.3)), v, 'about its foot, not the world\'s origin');
    pv.globals.uFoot = [100, 2000, -300];
  }
  for (const [h, r0] of [[0, FIRE.plume.footR], [1, FIRE.plume.topR]]) {
    const at = pv.placeAt([0.37, h]).map(Number), axis = pv.axisAt(h).map(Number);
    const r = Math.hypot(at[0] - axis[0], at[2] - axis[2]);
    assert.ok(r >= r0 * (1 - FIRE.plume.lump) - 1 && r <= r0 * (1 + FIRE.plume.lump) + 1, `the radius at ${h}: ${r.toFixed(0)} about ${r0}`);
  }
  const top = pv.axisAt(1).map(Number);
  assert.deepEqual([top[0] - 100, top[1] - 2000, top[2] + 300].map((v) => Math.round(v)), [FIRE.plume.lean[0], FIRE.plume.height, FIRE.plume.lean[1]], 'its top over the foot, downwind (east, north)');
  glslFunctions(PLUME_FS, {});   // its fragment stage reads as GLSL
  // the cone's colour on the horizon: the land's tint where it lifts nothing, its ash on its flanks, red-brown rock up its
  // summit cone - at all three of the far views' tints (the ring, the middle ring, the far field)
  const { ashTint, ASH_TINT } = await import('../../src/render/redMountainFire.js');
  const { redMountainLiftAt } = await import('../../src/world/tamriel/redMountain.js');
  const snow = [232, 236, 240];
  assert.equal(ashTint(snow, 0), snow);
  assert.deepEqual(ashTint(snow, ASH_TINT.full + 1), [...ASH_TINT.ash], 'the flank its ash');
  const crown = ashTint(snow, ASH_TINT.rockTo + 1);
  assert.deepEqual(crown, ASH_TINT.ash.map((v, c) => Math.round(v + (ASH_TINT.rock[c] - v) * ASH_TINT.rockShare)), 'the summit its rock');
  assert.ok(crown[0] > crown[2] + 30, 'red over blue at the summit');
  const ringSrc = read('src/render/farRing.js');
  assert.match(ringSrc, /const tint = ringTintAt\(overworldTint\(climate, byte\), px, py, relief\);/);
  assert.match(ringSrc, /tintAt: \(x, y, byte, v\) => ringTintAt\(overworldTint\(climAt\(x, y, v\), byte\), x, y, !!inputs\.relief\),/);
  assert.match(ringSrc, /const tintAt = \(x, y\) => ringTintAt\(overworldTint\(climateOf\(x, y\), byteAt\(x, y\)\), x, y, !!inputs\.relief\);/);
  const { ringTintAt } = await import('../../src/render/farRing.js');
  const cpx = Math.floor(redMountainFrame().bx), cpy = Math.floor(redMountainFrame().by);
  assert.deepEqual(ringTintAt(snow, cpx + 3, cpy, true), ashTint(snow, redMountainLiftAt(cpx + 3, cpy) * UNIT));
  assert.equal(ringTintAt(snow, cpx + 3, cpy, false), snow, 'none without the landforms\' lift');
  // both programs carry the one hiding law
  for (const fs of [LAVA_FS, PLUME_FS]) assert.match(fs, /bool hidden\(vec3 p, float margin\)/);
  assert.equal(FIRE_PROGRAMS.length, 2);
  // the far ring: the fire drawn last of its pass, made lazily on the landforms' lift, let go with the ring
  const ring = read('src/render/farRing.js');
  assert.match(ring, /const fire = eye && worldProj \? this\._fireNow\(\) : null;/);
  assert.match(ring, /if \(!inputs\?\.relief \|\| this\._fireOff\) return null;/);
  assert.match(ring, /const ground = redMountainGround\(byteBase\(ringReaders\(inputs\)\.byteAt\), inputs\);/);
  assert.match(ring, /if \(whole && this\._fire\) \{ this\._fire\.dispose\(\); this\._fire = null; \}/);
  assert.ok(ring.indexOf('fire.draw({') > ring.indexOf('this._drawBand(view, origin') && ring.indexOf('fire.draw({') < ring.lastIndexOf('gl.depthRange(0, 1);'), 'after the band, before the pass\'s state is put back');
  const { fireDisabled } = await import('../../src/render/farRing.js');
  assert.equal(fireDisabled('?world&redfire=off'), true);
  assert.equal(fireDisabled('?world'), false);
});

// ── WITH ARENA2: THE FREEWARE'S OWN TRACE ────────────────────────

const A = process.env.ARENA2_PATH;
const HAVE = !!A && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((n) => existsSync(join(A, n)));

test('RED-MOUNTAIN with ARENA2: on the freeware\'s trace the volcano stands at Red Mountain\'s summit on the relief - its rim over 6.5 km, the highest ground of Tamriel by 3 km\'s margin over its plateau, the land about it Red Mountain\'s zone and the Ashlands\', no place past the Bay on its cone, its reach on Morrowind\'s land', { skip: HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(A, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { arenaPixels } = await import('../../src/world/arenaPlaces.js');
  const { landformClimates } = await import('../../src/world/landforms.js');
  const G = await import('../../src/world/tamriel/tamrielGround.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  const trace = await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const bay = new WoodsFile(); bay.load(bytes('WOODS.WLD'));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit (audittesa2c_capitals.test.js's)
  setTamrielTrace(trace);
  try {
    G.dropGroundCache();
    G.groundMaps(maps);
    const woods = G.groundWoods(bay);
    const lf = createLandforms({ woods, climates: landformClimates((x, y) => maps.getClimateIndex(x, y)) });
    const f = redMountainFrame();
    assert.deepEqual(heartsAnchor('Morrowind', 'Red Mountain'), [234.75, 53.75], 'the relief\'s summit (Tamriel-Biomes.md)');
    const H = (px, py, x = 64, y = 64) => sampleKernel(woods, px, py, 129, true, lf)(x, y) * MAX_TERRAIN_HEIGHT * UNIT - SCALED_OCEAN_ELEVATION * UNIT;
    const cx = Math.floor(f.bx), cy = Math.floor(f.by);
    let rim = -Infinity;
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) rim = Math.max(rim, H(cx + dx, cy + dy));
    assert.ok(rim > 6500, `the rim stands ${rim.toFixed(0)} m`);
    const plateau = H(cx + 60, cy);
    assert.ok(rim - plateau > 3000, `over the plateau (${plateau.toFixed(0)} m) by ${(rim - plateau).toFixed(0)} m`);
    assert.equal(tamrielBiomeAt(cx, cy)?.key, 'morrowindRedMountain');
    const reachPx = Math.ceil(RED_MOUNTAIN_REACH / 819.2);
    for (let dy = -reachPx; dy <= reachPx; dy += 6) for (let dx = -reachPx; dx <= reachPx; dx += 6) {
      if (Math.hypot(dx, dy) * 819.2 > RED_MOUNTAIN_REACH) continue;
      assert.ok(G.tamrielHeightByte(cx + dx, cy + dy) > 0, `the reach on land at ${cx + dx},${cy + dy}`);
    }
    const cone = (D.rim + D.tiers[0].reach) / 819.2;
    const near = (arenaPixels()?.stood ?? []).filter((a) => Math.hypot(a.bx + 0.5 - f.bx, a.by + 0.5 - f.by) < cone);
    assert.deepEqual(near.map((a) => a.name), [], 'no place on the summit cone');
  } finally { setTamrielTrace(null); setTamrielFit(null); G.dropGroundCache(); }
});
