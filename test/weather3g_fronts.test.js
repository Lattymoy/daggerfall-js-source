// WEATHER3 slice G (2026-09-23, Mac on the first real render of the
// travel map: "this needs more clarity"): FRONTS, NOT A RASH. The bay was
// ~1,900 systems, two-thirds of them thunderstorms a few map pixels
// across, in pigments that all came out one grey-blue. Now a rain system
// is a FRONT tens of kilometres across and a thunderstorm is a CELL of a
// front, born in its frame and painting only inside its core; every type
// is regional, born on its own lattice; the map washes each weather in
// its own colour under the pen, with a legend. Pinned here: the cell law
// (rigid in its front, clipped to it, dying with it), the Cox law holding
// at a front's rim as at its heart and in a newborn front as in an old
// one, the weather's regional scale, and the sky's clip. The map's two
// tests went with the travel map's weather (DISC17-C, 2026-09-24, Mac:
// "Remove the enhanced map weather enhancements entirely").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  birthsIn, cellsOf, systemAt, wornAmong, insideClip, birthLaw, coreVolume, exposure, weatherAt, resetWeatherMap,
  radialOf, shapeBound, shapeMax, shapeFactor, SYSTEM_TYPES, CELL_OF,
} from '../src/systems/weatherMap.js';
import { cellOfField, cellOf, packCells, FIELD_UNIFORMS, VC_PROFILE } from '../src/render/volumetricClouds.js';
import { fieldFns, ZONE } from './cloudSky.mjs';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { SEASONS, seasonValue, dateFromClassicMinutes } from '../src/systems/gameDate.js';
import { seededRng } from '../src/systems/wind.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const YEAR = 405 * 360 * 1440;
const SUMMER = YEAR + 190 * 1440;
const TERRAIN = 819.2;
const subtropics = () => CLIMATES.Subtropical;

/** Live rain fronts with their cells, over a summer in the subtropics (the table's stormiest summer). */
function fronts(n, at = subtropics) {
  const out = [];
  const [, nt] = SYSTEM_TYPES.rain.node;
  for (let g = 0; out.length < n && g < 400; g++) {
    for (const f of birthsIn('rain', g % 5, (g / 5 | 0) % 3, Math.floor(SUMMER / nt) + (g / 15 | 0), at)) {
      if (cellsOf(f, at).length) out.push(f);
    }
  }
  return out;
}

test('WEATHER3g: A CELL IS ITS FRONT\'S - born in the front\'s frame, riding it rigidly, painting only inside its core now, dying with it', () => {
  assert.deepEqual(CELL_OF, { rain: 'thunder' });
  assert.equal(SYSTEM_TYPES.thunder.parent, 'rain');
  assert.deepEqual(birthsIn('thunder', 0, 0, Math.floor(SUMMER / 1440), subtropics), [], 'a cell type is never born on a lattice');
  const [f] = fronts(1);
  const cells = cellsOf(f, subtropics);
  assert.equal(cellsOf(f, subtropics), cells, 'drawn once, the same list after');
  let checked = 0;
  for (const c of cells) {
    assert.ok(c.id.startsWith(`${f.id}/`) && c.front === f && c.type === 'thunder');
    assert.ok(Math.hypot(c.ox, c.oz) < f.core * shapeBound(f.shape) + SYSTEM_TYPES.thunder.core[1] * shapeMax('thunder'), 'born within the front\'s grown core at its furthest (WEATHER3h), widened by a cell');
    assert.ok(c.bornAt >= f.bornAt - SYSTEM_TYPES.thunder.life[1] && c.bornAt < f.bornAt + f.life);
    for (const m of [c.bornAt + 1, c.bornAt + c.life / 2]) {
      const s = systemAt(c, m), fs = systemAt(f, m);
      if (!fs) { assert.equal(s, null, 'no front, no cell'); continue; }
      if (!s) continue;
      assert.ok(Math.abs(s.x - fs.x - c.ox) < 1e-6 && Math.abs(s.z - fs.z - c.oz) < 1e-6, 'it stands where it was born in the front\'s frame');
      assert.deepEqual(s.clip, [fs.x, fs.z, fs.bands[0][0], f.shape], 'it paints within the front\'s core as the core is now, in the front\'s own shape');
      checked++;
    }
    assert.equal(systemAt(c, f.bornAt + f.life + 1), null, 'it dies with its front');
  }
  assert.ok(checked > 10, `${checked} cell positions checked`);
  // WEATHER3h: the draw covers the front's STRETCHED core, not its round one - cells are born out in the stretch
  let beyondRound = 0;
  for (const fr of fronts(60)) {
    if (shapeBound(fr.shape) < 1.25) continue;
    beyondRound += cellsOf(fr, subtropics).filter((c) => Math.hypot(c.ox, c.oz) > fr.core + SYSTEM_TYPES.thunder.core[1] * shapeMax('thunder')).length;
  }
  assert.ok(beyondRound > 20, `${beyondRound} cells born in the fronts' stretch, past the round core`);
  // and past the stretched core itself, by up to a cell's own reach: a cell whose heart is outside the front but
  // whose disc reaches in is drawn, or the front's outline would be short of storms where it stretches furthest
  let pastCore = 0;
  for (const fr of fronts(60)) {
    const edge = fr.core * shapeBound(fr.shape), cellMax = SYSTEM_TYPES.thunder.core[1] * shapeMax('thunder');
    for (const c of cellsOf(fr, subtropics)) {
      const at = Math.hypot(c.ox, c.oz);
      if (at > edge) pastCore++;
      assert.ok(at <= edge + cellMax + 1e-6, 'never past where its disc could reach the front');
    }
  }
  assert.ok(pastCore > 5, `${pastCore} cells born past the stretched core, reaching into it`);
  // the clip is the law's: inside the cell's disc but outside its front's core is not the cell's weather
  const cell = { type: 'thunder', x: 0, z: 0, r: 10000, env: 1, bands: [[10000, 'thunder']], clip: [20000, 0, 15000] };
  assert.equal(wornAmong([cell], -5000, 0).word, 'sunny', 'outside the front, nothing');
  assert.equal(wornAmong([cell], 8000, 0).word, 'thunder');
  assert.ok(!insideClip(cell, -5000, 0) && insideClip(cell, 8000, 0) && insideClip({ clip: null }, 1e9, 1e9));
  // pure: the same cells after the caches are dropped
  resetWeatherMap();
  const again = cellsOf(birthsIn('rain', ...f.id.split(':').slice(1, 4).map(Number), subtropics).find((b) => b.id === f.id), subtropics);
  assert.deepEqual(again.map((c) => [c.id, c.ox, c.oz, c.bornAt, c.life, c.core]), cells.map((c) => [c.id, c.ox, c.oz, c.bornAt, c.life, c.core]));
});

test('WEATHER3g: THE COX LAW HOLDS EVERYWHERE IN A FRONT - its rim as its heart, a newborn front as an old one', () => {
  // the cells over a point in a front's core are Poisson(c x the hour's exposure), whatever the point's place in the
  // front and the front's age: cells are drawn over the grown core widened by a cell and from a cell's life before
  // the front's birth, and clipped to the core now. A front whose cells began at its birth, or were drawn inside
  // its core alone, is short of storms young and at the rim.
  const law = birthLaw(CLIMATES.Subtropical, SEASONS.Summer);
  const c = law.weight.thunder * coreVolume('thunder');
  const r = seededRng(0x3C0);
  const tally = {};   // 'heart young' ... 'rim grown' -> [hits, samples, expected]
  for (const f of fronts(200)) {
    const cells = cellsOf(f, subtropics);
    for (let k = 0; k < 40; k++) {
      const young = k % 2 === 0;
      const m = young ? f.bornAt + 20 + r() * (SYSTEM_TYPES.thunder.life[1] - 40) : f.bornAt + f.life * (SYSTEM_TYPES.rain.grow + 0.02 + r() * 0.3);   // grown: full size
      const fs = systemAt(f, m);
      if (!fs) continue;
      const u = k % 4 < 2 ? r() * 0.5 : 0.8 + r() * 0.2, a = r() * Math.PI * 2;
      const R = fs.bands[0][0] * shapeFactor(f.shape, Math.cos(a), Math.sin(a));   // the core's outline that way (WEATHER3h)
      const x = fs.x + Math.cos(a) * u * R, z = fs.z + Math.sin(a) * u * R;
      const hit = cells.some((cell) => { const s = systemAt(cell, m); return s && insideClip(s, x, z) && radialOf(s, x, z) < s.bands[0][0]; });
      const hour = (((m % 1440) + 1440) % 1440) / 60;
      const expect = 1 - Math.exp(-c * exposure('thunder', seasonValue(dateFromClassicMinutes(m)))[Math.floor(hour * 2) % 48]);
      const key = `${u < 0.5 ? 'heart' : 'rim'} ${young ? 'young' : 'grown'}`;
      const t = (tally[key] ??= [0, 0, 0]);
      t[0] += hit ? 1 : 0; t[1]++; t[2] += expect;
    }
  }
  for (const [key, [hits, n, expect]] of Object.entries(tally)) {
    assert.ok(n > 1000, `${key}: ${n} samples`);
    const got = hits / n, want = expect / n;
    assert.ok(Math.abs(got - want) < 0.04, `${key}: ${(got * 100).toFixed(1)}% of the core under a cell, the law says ${(want * 100).toFixed(1)}%`);
  }
  assert.equal(Object.keys(tally).length, 4);
});

test('WEATHER3g: THE WEATHER IS REGIONAL - places 10 km apart mostly share a sky, and the sharing falls away with distance', () => {
  const at = () => CLIMATES.Woodlands, r = seededRng(9);
  const same = (sep) => {
    let n = 0;
    for (let i = 0; i < 800; i++) {
      const x = 100000 + r() * 600000, z = 100000 + r() * 200000, m = YEAR + Math.floor(r() * 20) * 518400 + r() * 300 * 1440, a = r() * 6.283;
      if (weatherAt(x, z, m, at).word === weatherAt(x + Math.cos(a) * sep, z + Math.sin(a) * sep, m, at).word) n++;
    }
    return n / 800;
  };
  const s10 = same(10000), s30 = same(30000), s100 = same(100000);
  assert.ok(s10 > 0.65, `10 km apart share their weather ${(s10 * 100).toFixed(0)}% of the time`);
  assert.ok(s10 > s30 && s30 > s100, `and less the further apart (${(s30 * 100).toFixed(0)}% at 30 km, ${(s100 * 100).toFixed(0)}% at 100 km)`);
  // every type born on the land is tens of kilometres across; only a storm cell is smaller, and it stands in a front
  for (const [t, spec] of Object.entries(SYSTEM_TYPES)) {
    if (spec.parent) { assert.ok(spec.core[1] < SYSTEM_TYPES[spec.parent].core[0], `${t}: a cell is smaller than any front`); continue; }
    assert.ok(spec.core[0] >= 15000, `${t}: regional`);
    assert.ok(spec.node[0] >= 80000, `${t}: its own lattice, sized to it`);
  }
});

test('WEATHER3g: THE SKY\'S CLIP - a storm cell\'s cloud stands only over its front\'s core: the conversion, the packing, the shader', () => {
  const shift = (x, z) => [x - 100, z + 50];
  const c = { x: 1000, z: 2000, r: 9000, word: 'thunder', imp: 1, rank: 0, clip: [3000, 4000, 30000] };
  const cell = cellOfField(c, shift);
  assert.deepEqual([cell.x, cell.z, cell.r], [900, 2050, 9000]);
  assert.deepEqual(cell.clip, [2900, 4050, 30000, null], 'the clip moved by the host\'s own frame change (no shape: a circle)');
  assert.equal(cellOfField({ ...c, clip: null }, shift).clip, undefined, 'a front, a deck, a bank: no clip');
  const packed = packCells([cell, cellOfField({ ...c, clip: null }, shift)], 8);
  assert.deepEqual([...packed.k.slice(0, 4)], [2900, 4050, 30000, packed.c[3]], 'the clip, with the cell\'s own rim');
  assert.equal(packed.k[6], -1, 'none');
  const vc = rd('src/render/volumetricClouds.js');
  assert.match(vc, /uniform vec4 uCellK\[8\];/);
  // on the shader's own resolveAt: the storm's base where its front's core is, the zone's past it, eased over the rim
  const f = fieldFns([{ ...cellOf('thunder', 0, 0, 9000), clip: [6000, 0, 8000, null] }]);   // the clip's rim is the cell's own (3150 m)
  const baseAt = (x) => { f.resolveAt([x, 0]); return f.globals.fBase; };
  assert.equal(baseAt(3000), VC_PROFILE.thunder.base, 'inside the core and the cell: the storm\'s own');
  assert.equal(baseAt(-3000), ZONE.uBase, 'inside the cell, outside its front\'s core: the zone\'s - the cloud stands only where the word is');
  const mid = baseAt(6000 - 6400);
  assert.ok(mid > VC_PROFILE.thunder.base && mid < ZONE.uBase, 'eased over the clip\'s rim');
  assert.ok(FIELD_UNIFORMS.includes('uCellK'));
  assert.match(vc, /gl\.uniform4fv\(u\.uCellK, k\.k\);/);
});
