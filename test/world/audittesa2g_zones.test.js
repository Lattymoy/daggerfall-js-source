// AUDIT TESA II (lane G) - the zones past the Bay: Vvardenfell's lowland hearts about Red Mountain's own summit and the
// Grazelands (G6, L25); a zone's border bending through the trace's province border (J4). Where ARENA2_PATH names the data,
// on the player's own trace. bible/03-World/Tamriel-Biomes.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  BIOMES, BIOME_WANDER, CITY_GROUND, biomeAtPicture, heartsAnchor, standSeeds, wanderPoint,
} from '../../src/world/tamriel/tamrielBiomes.js';
import { MOUNTAIN_RANGES } from '../../src/world/tamriel/tamrielGeography.js';
import { setTamrielTrace, provinceKeyAt } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import { namedSummit, RELIEF_SCALE } from '../../src/world/tamriel/tamrielRelief.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';

const zone = (key) => BIOMES.find((b) => b.key === key);
const RED = MOUNTAIN_RANGES.find((m) => m.name === 'Red Mountain');
const spineMiddle = (r) => [r.pts.reduce((a, p) => a + p[0], 0) / r.pts.length, r.pts.reduce((a, p) => a + p[1], 0) / r.pts.length];

/** Morrowind as one box of land (picture 200..300 x 20..110), its relief a plain at 20 and Red Mountain's cone at (232, 58). */
function morrowind({ relief = true } = {}) {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 20; y < 110; y++) for (let x = 200; x < 300; x++) { land[y * w + x] = 1; province[y * w + x] = 4; }
  if (!relief) return { w, h, land, province };
  const s = RELIEF_SCALE, cells = new Uint8Array(w * s * h * s);
  for (let j = 0; j < h * s; j++) for (let i = 0; i < w * s; i++) {
    const px = (i + 0.5) / s, py = (j + 0.5) / s;
    if (land[Math.floor(py) * w + Math.floor(px)]) cells[j * w * s + i] = Math.max(20, Math.round(120 - 8 * Math.hypot(px - 232, py - 58)));
  }
  return { w, h, land, province, relief: cells };
}

test('AUDIT TESA II G6/L25: Vvardenfell\'s lowland hearts stand about Red Mountain\'s own summit - the relief\'s where it stands, the authored spine\'s middle else: the Ashlands north and west of it, the Grazelands north-east, the Bitter Coast south-west; the Grazelands a grass plain under a warm sky (mutants: the hearts unread; the anchor the spine\'s on the relief; the offsets dropped)', () => {
  const ash = zone('morrowindAshlands'), graze = zone('morrowindGrazelands'), bitter = zone('morrowindBitterCoast');
  assert.deepEqual([ash.hearts.range, ash.hearts.at], ['Red Mountain', [[0, -9], [-9, -1]]]);
  assert.deepEqual([graze.hearts.range, graze.hearts.at, graze.places.length, graze.seeds.length], ['Red Mountain', [[7, -7]], 0, 0]);
  assert.deepEqual([bitter.hearts.range, bitter.hearts.at], ['Red Mountain', [[-7, 7], [-2, 9]]]);
  assert.deepEqual(ash.places, ['Ald\'ruhn'], 'Ald\'ruhn the Ashlands\' city still');
  assert.deepEqual([graze.province, graze.climate, graze.air, !!graze.jungle, !!graze.peaks], ['Morrowind', CLIMATES.Woodlands, CLIMATES.Subtropical, false, false], 'the Grazelands: turf and few trees under a warm sky');
  const stoodOf = (key) => [...standSeeds().get('Morrowind')].filter(([b, , , city]) => b.key === key && !city).map(([, x, y]) => [x, y]);
  try {
    // the land in one box, no relief: about the authored spine's middle
    setTamrielTrace(morrowind({ relief: false }));
    const [mx, my] = spineMiddle(RED);
    assert.deepEqual(heartsAnchor('Morrowind', 'Red Mountain'), [mx, my]);
    assert.deepEqual(stoodOf('morrowindGrazelands'), [[mx + 7, my - 7]]);
    assert.deepEqual(stoodOf('morrowindAshlands'), [[mx, my - 9], [mx - 9, my - 1]]);
    // the relief standing: about its summit (the cone at 232, 58 - fifteen units south-west of the spine)
    setTamrielTrace(morrowind());
    const s = namedSummit('Morrowind', 'Red Mountain', RED.pts);
    assert.ok(Math.hypot(s[0] - 232, s[1] - 58) < 1, `the summit (${s})`);
    assert.deepEqual(heartsAnchor('Morrowind', 'Red Mountain'), s);
    assert.deepEqual(stoodOf('morrowindGrazelands'), [[s[0] + 7, s[1] - 7]]);
    assert.deepEqual(stoodOf('morrowindBitterCoast'), [[s[0] - 7, s[1] + 7], [s[0] - 2, s[1] + 9]]);
    assert.equal(biomeAtPicture('Morrowind', s[0] + 7, s[1] - 9)?.key, 'morrowindGrazelands', 'north-east of the cone, the Grazelands');
    assert.equal(biomeAtPicture('Morrowind', s[0] - 1, s[1] - 12)?.key, 'morrowindAshlands', 'north of it, the Ashlands');
    assert.equal(biomeAtPicture('Morrowind', s[0] - 12, s[1] - 1)?.key, 'morrowindAshlands', 'west of it, the Ashlands');
    assert.equal(biomeAtPicture('Morrowind', s[0] - 9, s[1] + 9)?.key, 'morrowindBitterCoast', 'south-west, the Bitter Coast');
  } finally { setTamrielTrace(null); }
});

/** Cyrodiil (x < 214) and Morrowind (x >= 214) side by side over picture 120..300 x 20..140, one straight border. */
function border() {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 20; y < 140; y++) for (let x = 120; x < 300; x++) { land[y * w + x] = 1; province[y * w + x] = x < 214 ? 9 : 4; }
  return { w, h, land, province };
}

test('AUDIT TESA II J4: a zone\'s province is read at the wandered point - near a border the nearer country\'s heart takes the point across it, so the zones\' edge bends through a straight province border; never farther than the wander reaches, and never over a city\'s own ground (mutants: the border unread; the neighbour\'s seeds unread; the neighbour\'s peaks unread)', () => {
  const reach = BIOME_WANDER.reduce((a, o) => a + o.amp, 0) * Math.SQRT2;
  try {
    setTamrielTrace(border());
    let crossed = 0, cyrOnMw = 0;
    for (let y = 22.5; y < 138; y += 0.5) {
      for (let x = 196.25; x < 232; x += 0.5) {
        const own = provinceKeyAt(x, y), z = biomeAtPicture(own, x, y);
        if (z.province === own) continue;
        crossed++;
        if (z.province === 'Imperial') cyrOnMw++;
        assert.ok(Math.abs(x - 214) <= reach, `a cross ${Math.abs(x - 214).toFixed(2)} from the border at ${x}, ${y} - past the wander's reach`);
        const [wx, wy] = wanderPoint(x, y);
        assert.equal(provinceKeyAt(wx, wy), z.province, 'crossed only to the province its wandered point stands on');
      }
    }
    assert.ok(crossed > 20, `the border crossed (${crossed})`);
    assert.ok(cyrOnMw > 0, 'Cyrodiil\'s zones over Morrowind\'s side');
    // a city's own ground holds: within CITY_GROUND of a stood city its own zone, whatever the wander says
    for (const [p, list] of standSeeds()) {
      for (const [b, sx, sy, city] of list) {
        if (!city) continue;
        for (const [dx, dy] of [[0, 0], [CITY_GROUND * 0.7, 0], [0, -CITY_GROUND * 0.7]]) {
          if (provinceKeyAt(sx + dx, sy + dy) !== p) continue;
          assert.equal(biomeAtPicture(p, sx + dx, sy + dy), b, `${b.key}'s city ground`);
        }
      }
    }
  } finally { setTamrielTrace(null); }
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'MAP.PAL', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));
test('AUDIT TESA II with ARENA2: on the player\'s own trace Red Mountain stands ringed by the Ashlands (where it stood ringed by the Bitter Coast\'s swamp and Stonefalls, none of the Ashlands), the Grazelands north-east of it; and the jungle\'s edge runs straight along a province border for no more than 4 picture units (it ran 7 - 89 km at x 214)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const fetchBytes = async (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const pal = new DFPalette(); pal.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes, palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const s = namedSummit('Morrowind', 'Red Mountain', RED.pts);
    const red = [], ring = new Map();
    for (let y = s[1] - 14; y < s[1] + 14; y += 0.25) for (let x = s[0] - 14; x < s[0] + 14; x += 0.25) if (biomeAtPicture('Morrowind', x, y)?.key === 'morrowindRedMountain') red.push([x, y]);
    let n = 0;
    for (let y = s[1] - 18; y < s[1] + 18; y += 0.25) for (let x = s[0] - 18; x < s[0] + 18; x += 0.25) {
      if (provinceKeyAt(x, y) !== 'Morrowind') continue;
      const k = biomeAtPicture('Morrowind', x, y)?.key;
      if (k === 'morrowindRedMountain' || !red.some(([qx, qy]) => Math.hypot(qx - x, qy - y) <= 3)) continue;
      n++; ring.set(k, (ring.get(k) ?? 0) + 1);
    }
    assert.ok((ring.get('morrowindAshlands') ?? 0) / n > 0.3, `the Ashlands about Red Mountain (${[...ring].map(([k, v]) => `${k} ${(100 * v / n).toFixed(0)}%`)})`);
    assert.ok((ring.get('morrowindGrazelands') ?? 0) > 0, 'the Grazelands beside it');
    const [gx, gy] = [...standSeeds().get('Morrowind')].find(([b]) => b.key === 'morrowindGrazelands').slice(1);
    assert.ok(gx > s[0] && gy < s[1], `the Grazelands' heart north-east of the summit (${gx}, ${gy})`);
    // J4: the longest run of picture units along one straight province border with a jungle zone on one side and another
    // province's non-jungle land on the other
    const at = (x, y) => { const k = provinceKeyAt(x + 0.5, y + 0.5); return k ? { k, j: !!biomeAtPicture(k, x + 0.5, y + 0.5)?.jungle } : null; };
    let longest = 0;
    for (const vertical of [true, false]) {
      for (let a = 1; a < (vertical ? 320 : 200); a++) {
        let run = 0;
        for (let b = 0; b < (vertical ? 200 : 320); b++) {
          const p = vertical ? at(a - 1, b) : at(b, a - 1), q = vertical ? at(a, b) : at(b, a);
          run = p && q && p.k !== q.k && p.j !== q.j ? run + 1 : 0;
          longest = Math.max(longest, run);
        }
      }
    }
    assert.ok(longest <= 4, `the jungle's edge straight along a province border for ${longest} picture units`);
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});

test('AUDIT TESA II G10: the canopy\'s field keeps its own small cap of pixels past the Bay - it reads the eye\'s 3x3 alone - where the jungle\'s keeps JUNGLE_BEYOND_MAX (the two had held up to about 90 MB between them); a drop is read again, the same (mutants: the canopy\'s cap the jungle\'s)', async () => {
  const { JUNGLE_CANOPY } = await import('../../src/world/jungle/jungleCanopy.js');
  const { JUNGLE_BEYOND_MAX, jungleField } = await import('../../src/world/jungle/jungleRegion.js');
  assert.equal(JUNGLE_CANOPY.fieldMax, 16384);
  assert.ok(JUNGLE_CANOPY.fieldMax * 64 === JUNGLE_BEYOND_MAX, 'a sixty-fourth of the jungle\'s');
  assert.match(readFileSync(new URL('../../src/scenes/jungleHost.js', import.meta.url), 'utf8'),
    /canopyField \?\?= jungleField\(\{ width: mapWidth, height: mapHeight, insideAt: \(\) => false, beyond: canopyAt, beyondMax: JUNGLE_CANOPY\.fieldMax \}\)/);
  // a capped field answers as an uncapped one
  const beyond = (x, y) => (x * 7 + y * 3) % 11 < 4;
  const small = jungleField({ width: 10, height: 10, insideAt: () => false, beyond, beyondMax: 64 }), big = jungleField({ width: 10, height: 10, insideAt: () => false, beyond });
  for (let y = 20; y < 40; y++) for (let x = 20; x < 40; x++) assert.equal(small.at(x, y), big.at(x, y));
});
