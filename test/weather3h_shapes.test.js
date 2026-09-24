// WEATHER3 slice H (2026-09-23, Mac: "they look too much like blobs and
// blots" ... "make them irregular" ... "the goal is not being overbearing
// on the map. It needs to be more subtle"): SHAPES AND REGIONS. A system is
// no longer a disc: its outline is its radius times a few harmonics of the
// bearing, normalised to enclose exactly the disc's area, so the table's
// shares (Campbell over areas) hold unchanged; the sky's shader reads the
// same polynomial. The travel map no longer blots a soft wash per system:
// it reads the worn word off the law at every cell of the bay, traces each
// word's land into loops and draws them lightly - a faint tint, a sparse
// hatch where something falls, a thin outline where it helps - under the pen.
// DISC17-C (2026-09-24, Mac: "Remove the enhanced map weather enhancements
// entirely"): the map's field, its regions and its hand went with the travel
// map's weather; the shapes and every reader of them in the world stand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  birthsIn, systemAt, shapeFactor, shapeBound, shapeMax, radialOf, approachAt, SHAPE_AMPS, SYSTEM_TYPES, PRIORITY,
} from '../src/systems/weatherMap.js';
import { createDistantStorms } from '../src/systems/distantStorms.js';
import { VIOLENCE } from '../src/systems/wind.js';
import { packCells, cellOfField, FIELD_UNIFORMS } from '../src/render/volumetricClouds.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const YEAR = 405 * 360 * 1440;
const AUTUMN = YEAR + 290 * 1440 + 10 * 60;
const woods = () => CLIMATES.Woodlands;
const LATTICE = PRIORITY.filter((t) => !SYSTEM_TYPES[t].parent);

/** Real born systems of every lattice type, grown, with their shapes. */
function grown(n = 40) {
  const out = [];
  for (const type of LATTICE) {
    const [, nt] = SYSTEM_TYPES[type].node;
    for (let g = 0; out.filter((s) => s.type === type).length < n && g < 200; g++) {
      for (const b of birthsIn(type, g % 6, (g / 6 | 0) % 4, Math.floor(AUTUMN / nt) + (g / 24 | 0), woods)) {
        const s = systemAt(b, b.bornAt + b.life / 2);
        if (s) out.push(s);
      }
    }
  }
  return out;
}

test('WEATHER3h: A SHAPE ENCLOSES EXACTLY ITS DISC\'S AREA - the harmonics of the bearing, normalised; the calibration stands', () => {
  const systems = grown();
  assert.ok(systems.length > 100);
  let stretched = 0;
  for (const s of systems) {
    // the mean of m^2 round the bearing is 1: the outline's area is pi r^2, whatever the shape
    let m2 = 0, max = 0, min = Infinity;
    const N = 720;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2, m = shapeFactor(s.shape, Math.cos(a), Math.sin(a));
      m2 += m * m / N; max = Math.max(max, m); min = Math.min(min, m);
      // the multiple-angle polynomial is the harmonic series it stands for
      const [n, c2, s2, c3, s3, c4, s4] = s.shape;
      const trig = n * (1 + c2 * Math.cos(2 * a) + s2 * Math.sin(2 * a) + c3 * Math.cos(3 * a) + s3 * Math.sin(3 * a) + c4 * Math.cos(4 * a) + s4 * Math.sin(4 * a));
      assert.ok(Math.abs(m - trig) < 1e-12, 'the polynomial is the series');
    }
    assert.ok(Math.abs(m2 - 1) < 1e-9, `${s.id}: the outline encloses the disc's area (${m2})`);
    assert.ok(min > 0.2 && max <= shapeBound(s.shape) + 1e-12 && shapeBound(s.shape) <= shapeMax(s.type) + 1e-12, 'a shape, never a hole; its bound holds it; its type\'s bound holds that');
    const amps = [[s.shape[1], s.shape[2]], [s.shape[3], s.shape[4]], [s.shape[5], s.shape[6]]].map(([c, d]) => Math.hypot(c, d));
    amps.forEach((a, k) => assert.ok(a <= SHAPE_AMPS[s.type][k] + 1e-12, `${s.type}: harmonic ${k + 2} within its type's amplitude`));
    if (max / min > 1.4) stretched++;
    // every band is the one shape, scaled: a point on the core's outline at any bearing is at the core's radius
    const a = 1.1, R = s.bands[0][0] * shapeFactor(s.shape, Math.cos(a), Math.sin(a));
    assert.ok(Math.abs(radialOf(s, s.x + Math.cos(a) * R, s.z + Math.sin(a) * R) - s.bands[0][0]) < 1e-6);
  }
  assert.ok(stretched > systems.length / 3, `${stretched} of ${systems.length} systems visibly irregular - not discs`);
});

test('WEATHER3h: THE SKY READS THE SAME SHAPE - the conversion carries it, the packing lays it out, the shader runs the one polynomial', () => {
  const shape = Object.freeze([0.95, 0.2, -0.1, 0.05, 0.02, -0.03, 0.04]), front = Object.freeze([0.97, -0.3, 0.1, 0, 0.05, 0.02, 0]);
  const cell = cellOfField({ x: 0, z: 0, r: 9000, word: 'thunder', imp: 1, rank: 0, shape, clip: [10, 20, 40000, front] }, (x, z) => [x + 1, z + 2]);
  assert.equal(cell.shape, shape);
  assert.deepEqual(cell.clip, [11, 22, 40000, front]);
  const packed = packCells([cell, cellOfField({ x: 0, z: 0, r: 9000, word: 'rain', imp: 1, rank: 1 }, (x, z) => [x, z])], 8);
  assert.deepEqual([...packed.s.slice(0, 4), ...packed.u.slice(0, 3)].map((v) => Math.fround(v)), [...shape].map((v) => Math.fround(v)));
  assert.deepEqual([...packed.ks.slice(0, 4), ...packed.ku.slice(0, 3)].map((v) => Math.fround(v)), [...front].map((v) => Math.fround(v)));
  assert.deepEqual([...packed.s.slice(4, 8), ...packed.u.slice(4, 8)], [1, 0, 0, 0, 0, 0, 0, 0], 'no shape: a circle');
  const vc = rd('src/render/volumetricClouds.js');
  assert.match(vc, /float c2 = c \* c - s \* s, s2 = 2\.0 \* c \* s, c3 = c \* \(4\.0 \* c \* c - 3\.0\), s3 = s \* \(3\.0 - 4\.0 \* s \* s\), c4 = 2\.0 \* c2 \* c2 - 1\.0, s4 = 2\.0 \* s2 \* c2;/, 'the multiple-angle identities, as shapeFactor');
  assert.match(vc, /return a\.x \* \(1\.0 \+ a\.y \* c2 \+ a\.z \* s2 \+ a\.w \* c3 \+ b\.x \* s3 \+ b\.y \* c4 \+ b\.z \* s4\);/);
  assert.match(rd('src/systems/weatherMap.js'), /const c2 = c \* c - s \* s, s2 = 2 \* c \* s, c3 = c \* \(4 \* c \* c - 3\), s3 = s \* \(3 - 4 \* s \* s\), c4 = 2 \* c2 \* c2 - 1, s4 = 2 \* s2 \* c2;/);
  for (const u of ['uCellS', 'uCellU', 'uCellKS', 'uCellKU']) { assert.ok(FIELD_UNIFORMS.includes(u)); assert.match(vc, new RegExp(`uniform vec4 ${u}\\[8\\];`)); }
});

test('WEATHER3h: THE SHAPE REACHES EVERY READER - the wind of a storm\'s approach, the thunder overhead', () => {
  // a front stretched east-west (c2 > 0): its outline twice as far east as north
  const n = 1 / Math.sqrt(1 + 0.45 * 0.45 / 2), stretch = Object.freeze([n, 0.45, 0, 0, 0, 0, 0]);
  const east = shapeFactor(stretch, 1, 0), north = shapeFactor(stretch, 0, 1);
  assert.ok(east / north > 2.5, 'stretched');
  const storm = { type: 'thunder', id: 't', x: 0, z: 0, r: 10000, reach: 10000 * shapeBound(stretch), env: 1, shape: stretch, bands: [[10000, 'thunder']], bornAt: 0, life: 1000 };
  // the wind: at its east outline the storm is AT the player; the same distance north is still the approach
  assert.equal(approachAt([storm], 10000 * east, 0), VIOLENCE.thunder, 'the east outline is the storm\'s edge');
  assert.ok(approachAt([storm], 0, 10000 * east) < VIOLENCE.thunder, 'as far north is still short of it');
  // the thunder: a player under the stretched heart beyond its round radius is under DFU's own storm - no distant strike
  const ds = createDistantStorms();
  let struck = 0;
  for (let f = 0; f < 60 * 400; f++) { const r = ds.tick({ systems: [storm], at: [10000 * east * 0.9, 0], minutes: 100 + f / 300, seconds: f / 60 }); if (r.bolt || r.sounds.length) struck++; }
  assert.equal(struck, 0, 'under its heart, by its shape');
});
