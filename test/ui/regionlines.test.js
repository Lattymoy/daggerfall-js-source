// REGION-LINES and the zone's map past the Bay (2026-10-24, the owner: "Theres no visible region lines, and cyrodil doesnt
// have the same detauled flavor of the wrothgarian pvp zone ... the entire middle region should have the fire outline
// wrothgarian does"): the 43 zones' borders on the held map (ui/tamrielInk.js zoneChains, made a slice a frame), the
// provinces' over the roads' web, the open zone on the map online and off, under the continent's names, and the zone
// map's places and hover on Cyrodiil's ground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { zoneChains, tamrielZoneChains, stepZoneInk, ZONE_SAMPLES, ZONE_MIN_CHAIN, ZONE_SLICE_MS } from '../../src/ui/tamrielInk.js';
import { BAY_W, BAY_H } from '../../src/world/tamriel/tamrielFrame.js';

const BAY_RECT = { x0: 0, y0: 0, x1: BAY_W, y1: BAY_H };
import { setTamrielTrace, provinceKeyAt } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, bayToPicture } from '../../src/world/tamriel/tamrielFrame.js';
import { biomeAtPicture } from '../../src/world/tamriel/tamrielBiomes.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('REGION-LINES the zones\' borders: where two land samples of one province stand in different zones - never along a coast or a province\'s border - clipped to outside the Bay, specks dropped (mutants: the province unasked; the zones unasked; the clip gone)', () => {
  assert.deepEqual([ZONE_SAMPLES, ZONE_MIN_CHAIN, ZONE_SLICE_MS], [2, 2, 6]);
  setTamrielTrace(null);
  try {
    setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
    const chains = zoneChains();
    assert.ok(chains.length > 30, `the zones' borders (${chains.length})`);
    let checked = 0, same = 0, apart = 0;
    for (const c of chains) {
      for (const p of c) assert.ok(!(p.x > BAY_RECT.x0 && p.x < BAY_RECT.x1 && p.y > BAY_RECT.y0 && p.y < BAY_RECT.y1), 'never inside the Bay');
      if (c.length < 3) continue;
      // a border's middle: the two sides across it one province, two zones
      const i = Math.floor(c.length / 2), a = c[i - 1], b = c[i + 1], m = c[i];
      const [mx, my] = bayToPicture(m.x, m.y), [ax, ay] = bayToPicture(a.x, a.y), [bx, by] = bayToPicture(b.x, b.y);
      const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 0.7, ny = dx / l * 0.7;
      const k1 = provinceKeyAt(mx + nx, my + ny), k2 = provinceKeyAt(mx - nx, my - ny);
      if (!k1 || !k2) continue;
      checked++;
      if (k1 === k2) same++;
      if (k1 === k2 && biomeAtPicture(k1, mx + nx, my + ny) !== biomeAtPicture(k2, mx - nx, my - ny)) apart++;
    }
    assert.ok(checked > 20 && same / checked > 0.9, `one province either side (${same} of ${checked})`);
    assert.ok(apart / checked > 0.7, `two zones either side (${apart} of ${checked})`);
  } finally { setTamrielFit(null); }
});

test('REGION-LINES made a slice a frame: a new zones\' stamp stands none until its raster is made, ZONE_SLICE_MS of rows a step; the borders that land are the whole build\'s (mutants: the build never begun; the slice the whole)', () => {
  setTamrielTrace(null);
  try {
    setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
    const whole = zoneChains();
    setTamrielFit({ ox: 38 * 15.5 + 1, oy: 57 * 15.5, ppu: 15.5 });   // a new fit: a new stamp
    setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
    assert.deepEqual(tamrielZoneChains(), [], 'none until made');
    let t = 0, steps = 0;
    const clock = () => t;
    // each step's clock moves a row's worth, so a slice is ZONE_SLICE_MS rows of the raster
    const tick = () => { t += 1; return t; };
    while (!stepZoneInk(ZONE_SLICE_MS, () => tick() && clock())) { steps++; assert.ok(steps < 1000, 'it finishes'); }
    assert.ok(steps > 10, `in slices (${steps})`);
    assert.deepEqual(tamrielZoneChains(), whole, 'the whole build\'s');
    assert.equal(stepZoneInk(), false, 'nothing owed');
  } finally { setTamrielFit(null); }
});

test('REGION-LINES and ZONE-OFFLINE, ZONE-NAMES, by source: the zones and the provinces\' borders over the roads\' web on a halo, the zones made in the window\'s tick and keyed by the zones\' stamp; the open zone on the map online and off, painted under the continent\'s names; the zone map naming Cyrodiil\'s places and answering past the Bay (mutants: the borders under the web; the tick unstepped; the zone online alone; the names under the fog)', () => {
  const ink = rd('src/ui/tamrielInk.js');
  const tiles = ink.indexOf('if (opts.tiles) opts.tiles.draw(');
  const zones = ink.indexOf('const zones = tamrielZoneChains(ink.coast);');   // PIN MOVED (AUDIT TESA II M13): handed the sheet's coast, its ends' shore
  assert.ok(tiles > 0 && zones > tiles, 'the zones after the roads\' tiles');
  assert.match(ink, /stroke\(zones, 2\.5, PEN\.halo\);\n\s+stroke\(zones, 1, PEN\.region, \[1, 3\]\);\n\s+stroke\(ink\.borders, 3\.5, PEN\.halo\);\n\s+stroke\(ink\.borders, 1\.4, PEN\.region, \[4, 3\]\);/);
  assert.ok(!/stroke\(ink\.borders, 1, PEN\.soft, \[4, 3\]\);/.test(ink), 'the old border under the web gone');
  assert.ok(ink.indexOf('opts.under?.();') > zones && ink.indexOf('opts.under?.();') < ink.indexOf('for (const c of ink.cities) {', zones), 'the window\'s under: over the borders, under the cities');
  const held = rd('src/ui/heldMap.js');
  assert.match(held, /if \(stepZoneInk\(\)\) this\._inkAgain\(\);/);   // PIN MOVED (AUDIT TESA II M2): the kept parts inked again too - the behaviour's pin is test/ui/audittesa2m_window.test.js
  assert.match(held, /tamrielLandVersion\(\),[^\n]*\n\s+biomeStamp\(\),/);
  assert.match(held, /part: 'over', under: paintZone, nameless: zoneMask \? \(c\) => wildInside\(zoneMask, c\.x, c\.y\) : null \}\);\n\s+if \(!zoneDone\) paintZone\(\);/);
  assert.match(held, /const past = \(this\._model \? tamrielInkFor\(this\._model\)\?\.cities \?\? \[\] : \[\]\)\.filter\(\(c\) => wildInside\(mask, c\.x, c\.y\) && tamrielCityBucket\(c, this\.filters\) >= 0\)/);   // PIN MOVED (AUDIT TESA II M7): under the map's filters
  assert.match(held, /return bay\.concat\(past\);/, 'the zone map\'s places Cyrodiil\'s too');
  assert.match(held, /const past = \(this\._tamriel \|\| this\._zoneMap\) \? this\._pastBayHover\(mx, my\) : null;/);   // PIN MOVED (AUDIT TESA II M14): the zone map answers past the Bay as the world map does
  assert.match(rd('src/scenes/world.js'), /wildMask: \(\) => cyrodiilMask\(\),/, 'the map\'s zone online and off');
  assert.match(rd('src/scenes/world.js'), /const wildMapMask = \(\) => \(_onlineWorldSession\(\) \? cyrodiilMask\(\) : null\);/, 'its rules online\'s');
});
