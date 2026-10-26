// INTRO4 (2026-10-26, the owner: "Overhaul the main intro sequence to be more in line with the elder scrolls game
// oblivion and still zoom out into the entire map of tamriel. Utilize the imperial city we have built for this. I want
// this to be as detailed as possible"; bible/10-UI/UI-Arc.md INTRO4): the film's cut on the recording's bars, its
// narrator, its flight clear of the city it flies over, its last frame holding the whole continent, its morning; the city
// it draws being TESA's own (the landmarks' meshes, the plan's cells, the tile and tree laws); the continent's field; the
// map's words; the build off the page's thread. Mutants: tools/mutants/intro4.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CLOUD_REVEAL_TIME, CREST_TIME, DISTRICTS_TIME, ASCENT_TIME, MAP_TIME, TITLE_IMPACT_TIME, TITLE_ENTER_TIME, LANDSCAPE_HOLD_TIME,
  INTRO_CREDITS, INTRO_NARRATION, INTRO_KEYS, introCameraAt, introFrameAt, introSunAt, introAtmosphereAt, introNarrationOpacity,
} from '../../src/ui/intro/introCue.js';
import {
  buildIntroLandmarks, buildIntroDistricts, buildIntroTrees, buildIntroGround, buildIntroPlan, introCityTransfers, buildIntroCity,
  INTRO_LANDMARKS, BUILDING_FLOATS, TREE_FLOATS, GROUND_SPAN, GROUND_TEXELS, WOODS_REACH,
} from '../../src/ui/intro/introCity.js';
import {
  buildTamrielField, fillRing, pictureToFilm, INTRO_MAP_LABELS, IMPERIAL_CITY_AT, RIVER_SEGMENTS, BAY_RECT, UNIT_M,
} from '../../src/ui/intro/introTamriel.js';
import { startIntroBuild } from '../../src/ui/intro/introBuild.js';
import { IMPERIAL, IMPERIAL_CELLS, IMPERIAL_CITY_PLAN, imperialTile, imperialTree } from '../../src/world/imperialCity.js';
import { BLOCK_M } from '../../src/world/spawnedDungeons.js';
import { PROVINCES, RIVERS, SEAS, provinceRings } from '../../src/world/tamriel/tamrielGeography.js';
import { BALFIERA } from '../../src/ui/intro/introMap.js';
import { lookAt, perspective, multiply } from '../../src/world/mat4.js';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const BAR = 1.888;

test('INTRO4: the film is cut on the recording’s own downbeats - bars 4, 8, 14 and 16 after the 19 s beat, each a decoded sample', () => {
  assert.equal(DISTRICTS_TIME, 320512 / 12000);
  assert.equal(ASCENT_TIME, 410880 / 12000);
  assert.equal(MAP_TIME, 546816 / 12000);
  assert.equal(TITLE_IMPACT_TIME, 592128 / 12000);
  for (const [at, bars] of [[DISTRICTS_TIME, 4], [ASCENT_TIME, 8], [MAP_TIME, 14], [TITLE_IMPACT_TIME, 16]]) {
    assert.ok(Math.abs((at - CREST_TIME) / bars - BAR) < 0.012, `${at} is ${bars} bars of ${BAR} s after the 19 s beat`);
  }
  // the keyed shots change on those landmarks, and the camera is at rest before the mark moves (INTRO2b's law)
  const keyTimes = INTRO_KEYS.map((k) => k[0]);
  for (const at of [CLOUD_REVEAL_TIME, CREST_TIME, DISTRICTS_TIME, ASCENT_TIME]) assert.ok(keyTimes.includes(at), `a key on ${at}`);
  assert.ok(LANDSCAPE_HOLD_TIME < TITLE_ENTER_TIME - 0.5);
  assert.deepEqual(introCameraAt(TITLE_IMPACT_TIME + 5), introCameraAt(LANDSCAPE_HOLD_TIME));
});

test('INTRO4: the narrator - five lines in the player’s language, one at a time, readable, between the cuts and clear of the credits and the mark', () => {
  assert.equal(INTRO_NARRATION.length, 5);
  const cue = read('src/ui/intro/introCue.js');
  INTRO_NARRATION.forEach((line, i) => {
    assert.equal(line.key, `narration${i + 1}`);
    assert.match(cue, new RegExp(`t\\('menu\\.intro\\.${line.key}', '`), 'routed through the text core');
    assert.ok(line.start < line.up && line.up < line.out && line.out < line.end);
    assert.ok(line.out - line.up >= 4.3, `${line.key} is up long enough to read`);
    assert.ok(line.text.length / (line.out - line.up) <= 21, `${line.key} reads at ${(line.text.length / (line.out - line.up)).toFixed(1)} characters a second`);
    if (i > 0) assert.ok(INTRO_NARRATION[i - 1].end <= line.start, 'no two lines at once');
    for (const cut of [CLOUD_REVEAL_TIME, CREST_TIME, DISTRICTS_TIME, ASCENT_TIME]) assert.ok(!(line.start < cut && cut < line.end), `${line.key} does not run across the cut at ${cut}`);
    for (const credit of INTRO_CREDITS) assert.ok(line.start >= credit.end, 'never over a credit');
    assert.ok(line.end <= TITLE_ENTER_TIME, 'gone before the mark moves');
    const st = introFrameAt((line.up + line.out) / 2);
    assert.deepEqual(st.narration.filter((n) => n.opacity > 0).map((n) => n.key), [line.key]);
    assert.equal(introNarrationOpacity(line, (line.up + line.out) / 2), 1);
  });
  for (const t of [0, TITLE_IMPACT_TIME, 600]) assert.ok(introFrameAt(t).narration.every((n) => n.opacity === 0));
});

/** The Tower's girth at a height (world/capitalImperial.js buildImperialTower's measures). */
function towerRadius(y, T = IMPERIAL.tower) {
  if (y < T.finTop) return T.finR;
  if (y < T.galleryTop) return T.galleryR;
  if (y < T.crownTop) return T.crownR0;
  return y < T.spireTop ? T.crownR1 : 0;
}

test('INTRO4: every frame of the flight keeps clear of the city it flies over - the water, the Tower, the walls and their towers, the Colosseum', () => {
  const I = IMPERIAL, C = I.colosseum, cc = [C.r * Math.sin((C.b * Math.PI) / 180), -C.r * Math.cos((C.b * Math.PI) / 180)];
  for (let i = 0; i <= Math.ceil(ASCENT_TIME * 60); i++) {
    const t = Math.min(ASCENT_TIME, i / 60), [x, y, z] = introCameraAt(t).eye, r = Math.hypot(x, z);
    assert.ok(y > 10, `above the water and the ground at ${t.toFixed(2)} s (${y.toFixed(1)} m)`);
    assert.ok(y > I.tower.spireTop + 40 || r > towerRadius(y) + 120, `clear of the Tower at ${t.toFixed(2)} s (${r.toFixed(0)} m out at ${y.toFixed(0)} m)`);
    if (Math.abs(r - I.cityWall.r) < I.cityWall.towerR + 30) assert.ok(y > I.cityWall.watchH + 20, `over the city wall and its towers at ${t.toFixed(2)} s (${y.toFixed(0)} m)`);
    if (Math.abs(r - I.palaceWall.r) < 30) assert.ok(y > I.palaceWall.towerH + 20, `over the palace wall at ${t.toFixed(2)} s`);
    if (((x - cc[0]) / (C.rx + 30)) ** 2 + ((z - cc[1]) / (C.rz + 30)) ** 2 < 1) assert.ok(y > C.h + 40, `over the Colosseum at ${t.toFixed(2)} s`);
  }
});

test('INTRO4: the last frame holds the whole of Tamriel inside the letterbox, north up, on a wide screen and a narrow one', () => {
  for (const aspect of [16 / 9, 21 / 9, 4 / 3]) {
    const cam = introCameraAt(LANDSCAPE_HOLD_TIME, aspect);
    const vp = multiply(perspective(cam.fov, aspect, 1000, 4e7), lookAt(cam.eye, cam.aim, [0, 1, 0]));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of provinceRings()) for (const ring of p.rings) for (const q of ring) {
      const [wx, wz] = pictureToFilm(q.x, q.y);
      const cx = vp[0] * wx + vp[8] * wz + vp[12], cy = vp[1] * wx + vp[9] * wz + vp[13], cw = vp[3] * wx + vp[11] * wz + vp[15];
      x0 = Math.min(x0, cx / cw); x1 = Math.max(x1, cx / cw); y0 = Math.min(y0, cy / cw); y1 = Math.max(y1, cy / cw);
    }
    assert.ok(x0 > -1 && x1 < 1 && y0 > -0.89 && y1 < 0.89, `all of the land in frame at ${aspect.toFixed(2)}: x ${x0.toFixed(2)}..${x1.toFixed(2)}, y ${y0.toFixed(2)}..${y1.toFixed(2)}`);
    assert.ok(x1 - x0 > 1.1, 'and filling it, not a speck in the middle');
    // north up: a point north of the land's middle stands higher on the screen than one south of it
    const n = pictureToFilm(170, 40), s = pictureToFilm(170, 160);
    const sy = ([wx, wz]) => (vp[1] * wx + vp[9] * wz + vp[13]) / (vp[3] * wx + vp[11] * wz + vp[15]);
    assert.ok(sy(n) > sy(s));
  }
});

test('INTRO4: the morning - night under the credits, the sun up as the mist breaks and climbing through the film; the windows go dark, the mist lifts, the map is inked last', () => {
  assert.ok(introSunAt(0).elevation < 0 && introSunAt(CLOUD_REVEAL_TIME - 1).elevation < 0.02);
  assert.ok(introSunAt(CLOUD_REVEAL_TIME + 0.5).elevation > 0);
  let last = -Infinity;
  for (let t = 0; t <= LANDSCAPE_HOLD_TIME; t += 0.25) { const e = introSunAt(t).elevation; assert.ok(e >= last - 1e-12, `the sun never sinks (${t})`); last = e; }
  const a0 = introAtmosphereAt(0), a1 = introAtmosphereAt(30), aEnd = introAtmosphereAt(LANDSCAPE_HOLD_TIME);
  assert.equal(a0.night, 1); assert.equal(a1.night, 0);
  assert.ok(a0.mist > 0.95 && a1.mist < 0.15);
  assert.ok(Math.abs(Math.hypot(...a1.sun) - 1) < 1e-9);
  assert.ok(a0.sunCol.every((v) => v < 0.05), 'no sunlight before the sun is up');
  assert.equal(introAtmosphereAt(MAP_TIME - 0.7).borders, 0); assert.equal(aEnd.borders, 1); assert.equal(aEnd.marker, 1);
  assert.ok(introAtmosphereAt(CREST_TIME).flare > 0.99 && introAtmosphereAt(CREST_TIME + 2).flare < 0.01, 'the flare is the 19 s beat’s');
  assert.ok(aEnd.clouds < a1.clouds, 'the clouds thin for the map');
});

test('INTRO4: the city in the film is the city TESA built - every landmark’s own mesh, each vertex its own picture’s material', () => {
  const L = buildIntroLandmarks();
  const meshes = INTRO_LANDMARKS.map((b) => b());
  assert.equal(INTRO_LANDMARKS.length, 13, 'the Tower, the palace wall, the tombs, the city wall, the district walls, the Colosseum, the Temple, Talos, the Divines, the Prison, the University, the Waterfront, the bridge');
  assert.equal(L.positions.length, meshes.reduce((n, m) => n + m.positions.length, 0));
  assert.equal(L.indices.length, meshes.reduce((n, m) => n + m.indices.length, 0));
  let v = 0, i = 0;
  for (const m of meshes) {
    assert.deepEqual(L.positions.subarray(v * 3, v * 3 + m.positions.length), m.positions);
    for (const s of m.subMeshes) {
      for (let k = 0; k < s.primitiveCount * 3; k++) {
        const vi = m.indices[s.startIndex + k];
        assert.equal(L.indices[i + s.startIndex + k], vi + v);
        assert.equal(L.material[v + vi], s.textureRecord);
      }
    }
    v += m.positions.length / 3; i += m.indices.length;
  }
});

test('INTRO4: the houses stand only on the cells where the plan lays one of Daggerfall’s blocks - every such cell built on, the lake, the far shore, gardens and the city’s own ground not', () => {
  const { buildings, count, gardens } = buildIntroDistricts();
  assert.equal(buildings.length, count * BUILDING_FLOATS);
  assert.ok(count > 3000);
  const built = new Set();
  const cellAt = (x, z) => [Math.floor(z / BLOCK_M + IMPERIAL_CELLS / 2), Math.floor(x / BLOCK_M + IMPERIAL_CELLS / 2)];
  for (let k = 0; k < count; k++) {
    const [r, c] = cellAt(buildings[k * BUILDING_FLOATS], buildings[k * BUILDING_FLOATS + 1]);
    const cell = IMPERIAL_CITY_PLAN[r][c];
    assert.ok(!/^(L|O|G|I.*)$/.test(cell), `a house on ${cell} at row ${r}, column ${c}`);
    built.add(`${r},${c}`);
  }
  for (let r = 0; r < IMPERIAL_CELLS; r++) for (let c = 0; c < IMPERIAL_CELLS; c++) {
    const cell = IMPERIAL_CITY_PLAN[r][c];
    if (!/^(L|O|G|I.*)$/.test(cell)) assert.ok(built.has(`${r},${c}`), `${cell} at ${r},${c} stands empty`);
  }
  assert.equal(gardens.length, IMPERIAL_CITY_PLAN.flat().filter((c) => c === 'G').length);
});

test('INTRO4: the trees are the city’s own (imperialTree, tile by tile), a garden’s, and the woods past Lake Rumare out to their reach', () => {
  const trees = buildIntroTrees([]), TILE = 6.4;
  assert.equal(trees.length % TREE_FLOATS, 0);
  let city = 0, woods = 0;
  for (let k = 0; k < trees.length; k += TREE_FLOATS) {
    const x = trees[k], z = trees[k + 1], r = Math.hypot(x, z);
    if (r <= IMPERIAL.isle + 40) {
      // back to its tile's centre (each is set off its centre by up to 1.5 m)
      const tx = Math.floor((x + IMPERIAL.isle + 20) / TILE) * TILE - IMPERIAL.isle - 20 + TILE / 2, tz = Math.floor((z + IMPERIAL.isle + 20) / TILE) * TILE - IMPERIAL.isle - 20 + TILE / 2;
      assert.ok(imperialTree(tx, tz) >= 0, `a tree off the city's own law at ${x.toFixed(1)}, ${z.toFixed(1)}`);
      city++;
    } else {
      assert.ok(r > IMPERIAL.lake + 40 - 18 && r < WOODS_REACH + 18, `a wood's tree at ${r.toFixed(0)} m`);
      woods++;
    }
  }
  assert.ok(city > 10000 && woods > 3000, `${city} in the city, ${woods} in the woods`);
});

test('INTRO4: the ground is the city’s own tile law, and the plan’s picture its cells', () => {
  const g = buildIntroGround(), m = GROUND_SPAN / GROUND_TEXELS;
  for (let k = 0; k < 400; k++) {
    const x = (k * 37) % GROUND_TEXELS, y = (k * 101) % GROUND_TEXELS;
    const t = imperialTile((x + 0.5) * m - GROUND_SPAN / 2, (y + 0.5) * m - GROUND_SPAN / 2);
    assert.equal(g[y * GROUND_TEXELS + x], t > 3 ? 4 : t);
  }
  const plan = buildIntroPlan();
  for (let r = 0; r < IMPERIAL_CELLS; r += 5) for (let c = 0; c < IMPERIAL_CELLS; c += 3) {
    const cell = IMPERIAL_CITY_PLAN[r][c];
    assert.equal(plan[r * IMPERIAL_CELLS + c], cell === 'L' ? 0 : cell === 'O' ? 1 : /^I/.test(cell) ? 2 : cell === 'G' ? 4 : 3);
  }
  const city = buildIntroCity();
  assert.equal(new Set(introCityTransfers(city)).size, 9, 'every array its own buffer, all of them handed over');
  assert.deepEqual(city.layout.cells, IMPERIAL_CELLS);
});

test('INTRO4: the continent - the geography’s provinces on their own ground, the Imperial City on land, the seas sea, INTRO2’s bay with Balfiera inside the Bay’s hole, borders, rivers, snow on the high ranges', () => {
  const f = buildTamrielField({ w: 640, h: 400 }), px = f.w / 320;
  const at = (ux, uy) => { const x = Math.floor(ux * px), y = Math.floor(uy * px), i = y * f.w + x; return { h: f.rgba[i * 4 + 3], p: f.province[i], rgb: [f.rgba[i * 4], f.rgba[i * 4 + 1], f.rgba[i * 4 + 2]] }; };
  PROVINCES.forEach((p, k) => assert.equal(at(...p.label).p, k + 1, `${p.name}'s own ground under its name`));
  assert.ok(at(...IMPERIAL_CITY_AT).h > 0, 'the Imperial City stands on land');
  for (const sea of SEAS) assert.equal(at(...sea.at).h, 0, `${sea.name} is sea`);
  const B = BAY_RECT;
  assert.ok(at(B.x0 + BALFIERA.x * (B.x1 - B.x0), B.y0 + BALFIERA.y * (B.y1 - B.y0)).h > 0, 'Balfiera, in the Bay');
  assert.equal(at(B.x0 + 0.3 * (B.x1 - B.x0), B.y0 + 0.49 * (B.y1 - B.y0)).h, 0, 'the Bay’s own water, west of Balfiera');
  assert.ok(f.border.some((v) => v === 255), 'the provinces’ borders are inked');
  const throat = at(164, 42);
  assert.ok(throat.h > 120 && throat.rgb.every((c) => c > 180), `the Throat of the World stands high and white (${throat.h}, ${throat.rgb})`);
  assert.equal(RIVER_SEGMENTS.length, RIVERS.reduce((n, r) => n + r.pts.length - 1, 0));
  const again = buildTamrielField({ w: 320, h: 200 }), once = buildTamrielField({ w: 320, h: 200 });
  assert.deepEqual(again.rgba, once.rgba, 'the same continent every boot');
  // the scanline fill: a square ring fills exactly its texels
  const out = new Uint8Array(16);
  fillRing(out, 4, 4, [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }], 7, 1);
  assert.deepEqual(Array.from(out), [0, 0, 0, 0, 0, 7, 7, 0, 0, 7, 7, 0, 0, 0, 0, 0]);
});

test('INTRO4: the map’s words are the geography’s own - the nine provinces at their labels, the seas, and the Imperial City where the film’s city stands', () => {
  const provinces = INTRO_MAP_LABELS.filter((l) => l.kind === 'province'), seas = INTRO_MAP_LABELS.filter((l) => l.kind === 'sea');
  assert.deepEqual(provinces.map((l) => [l.name, ...l.at]), PROVINCES.map((p) => [p.name, ...p.label]));
  assert.deepEqual(seas.map((l) => l.name), SEAS.map((s) => s.name));
  const capital = INTRO_MAP_LABELS.filter((l) => l.kind === 'capital');
  assert.deepEqual(capital.map((l) => l.name), ['Imperial City']);
  assert.deepEqual(pictureToFilm(...capital[0].at), [0, 0], 'the film’s city is at the map’s point');
  assert.ok(Math.abs(UNIT_M - 15360) < 1e-6, 'a picture unit is 18.75 of the Bay\u2019s 819.2 m pixels');
  const screen = read('src/ui/intro/introScreen.js');
  assert.match(screen, /const map = make\(doc, 'div', 'intro-map'\); map\.setAttribute\('aria-hidden', 'true'\);/);
  assert.match(screen, /narrationLine\.textContent = INTRO_NARRATION\.find\(\(n\) => n\.key === line\.key\)\.text;/);
});

/** A fake worker: what it posts, when asked. */
function fakeWorker(script) {
  const w = { terminated: false, posted: [], onmessage: null, onerror: null };
  w.postMessage = (m) => { w.posted.push(m); queueMicrotask(() => script(w)); };
  w.terminate = () => { w.terminated = true; };
  return w;
}

test('INTRO4: the build - the worker’s city then its continent; a worker that fails, errors or cannot start falls back to this thread; a disposed build answers nothing', async () => {
  let worker = null;
  const ok = startIntroBuild({ factory: () => (worker = fakeWorker((w) => { w.onmessage({ data: { t: 'city', city: 'C' } }); w.onmessage({ data: { t: 'field', field: 'F' } }); })), here: () => { throw new Error('not on this thread'); } });
  assert.equal(await ok.city, 'C'); assert.equal(await ok.field, 'F');
  assert.deepEqual(worker.posted, [{ t: 'build' }]); assert.equal(worker.terminated, true, 'let go once the continent is in');
  const here = async () => ({ buildIntroCity: () => 'c', buildTamrielField: () => 'f' });
  const noWorker = startIntroBuild({ factory: () => { throw new Error('no Worker'); }, here });
  assert.deepEqual([await noWorker.city, await noWorker.field], ['c', 'f']);
  const errs = startIntroBuild({ factory: () => fakeWorker((w) => w.onmessage({ data: { t: 'error', message: 'x' } })), here });
  assert.deepEqual([await errs.city, await errs.field], ['c', 'f']);
  const half = startIntroBuild({ factory: () => fakeWorker((w) => { w.onmessage({ data: { t: 'city', city: 'C' } }); w.onerror({ preventDefault() {} }); }), here });
  assert.deepEqual([await half.city, await half.field], ['C', 'f'], 'the worker’s city kept, the continent built here');
  let settled = false;
  const gone = startIntroBuild({ factory: () => fakeWorker(() => {}), here });
  gone.city.then(() => { settled = true; }); gone.dispose();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(settled, false);
});
