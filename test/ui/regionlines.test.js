// REGION-LINES and the zone's map past the Bay (2026-10-24, the owner: "Theres no visible region lines, and cyrodil doesnt
// have the same detauled flavor of the wrothgarian pvp zone ... the entire middle region should have the fire outline
// wrothgarian does"): the provinces' borders - the regions past the Bay - over the roads' web (ui/tamrielInk.js), the open
// zone on the map online and off, under the continent's names, and the zone map's places and hover on Cyrodiil's ground.
// The 43 biome zones' borders were drawn a day and withdrawn (2026-10-25, the owner: "Those are just random lines").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as tamrielInk from '../../src/ui/tamrielInk.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('REGION-LINES and ZONE-OFFLINE, ZONE-NAMES, by source: the provinces\' borders over the roads\' web on a halo, and no biome zone\'s border drawn; the open zone on the map online and off, painted under the continent\'s names; the zone map naming Cyrodiil\'s places and answering past the Bay (mutants: the borders unstroked; the zone online alone; the names under the fog)', () => {
  const ink = rd('src/ui/tamrielInk.js');
  const tiles = ink.indexOf('if (opts.tiles) opts.tiles.draw(');
  const borders = ink.indexOf('provinceLines(ctx, view, paperW, paperH, ink.borders);');
  assert.ok(tiles > 0 && borders > tiles, 'the provinces\' borders after the roads\' tiles');
  assert.ok(!/stroke\(ink\.borders, 1, PEN\.soft, \[4, 3\]\);/.test(ink), 'the old border under the web gone');
  assert.ok(ink.indexOf('opts.under?.();') > borders && ink.indexOf('opts.under?.();') < ink.indexOf('const named = [], marks = [];', borders), 'the window\'s under: over the borders, under the cities');
  // WITHDRAWN (the owner: "Those are just random lines"): no biome zone's border on the sheet, nor its making
  assert.equal(tamrielInk.zoneChains, undefined);
  assert.equal(tamrielInk.stepZoneInk, undefined);
  assert.ok(!/tamrielZoneChains|biomeAtPicture/.test(ink), 'no zone raster');
  const held = rd('src/ui/heldMap.js');
  assert.ok(!/stepZoneInk|biomeStamp/.test(held), 'no zone borders to step or key');
  assert.match(held, /part: 'over', under: paintZone, nameless: zoneMask \? \(c\) => wildInside\(zoneMask, c\.x, c\.y\) : null \}\);\n\s+if \(!zoneDone\) paintZone\(\);/);
  assert.match(held, /const past = \(this\._model \? tamrielInkFor\(this\._model\)\?\.cities \?\? \[\] : \[\]\)\.filter\(\(c\) => wildInside\(mask, c\.x, c\.y\) && tamrielCityBucket\(c, this\.filters\) >= 0\)/);   // PIN MOVED (AUDIT TESA II M7): under the map's filters
  assert.match(held, /return bay\.concat\(past\);/, 'the zone map\'s places Cyrodiil\'s too');
  assert.match(held, /const past = \(this\._tamriel \|\| this\._zoneMap\) \? this\._pastBayHover\(mx, my\) : null;/);   // PIN MOVED (AUDIT TESA II M14): the zone map answers past the Bay as the world map does
  assert.match(rd('src/scenes/world.js'), /wildMask: \(\) => cyrodiilMask\(\),/, 'the map\'s zone online and off');
  assert.match(rd('src/scenes/world.js'), /const wildMapMask = \(\) => \(_onlineWorldSession\(\) \? cyrodiilMask\(\) : null\);/, 'its rules online\'s');
});

// ── REGION-LINES 2 (2026-10-25, the owner, with a map of Tamriel each province cleanly parted: "This is what I mean by region
// lines. Each region distinctly separated (ignore the colors). Also, daggerfall's clustered icons need to be fixed amd
// standardized across tamriel with this change") ──────────────────────────────────────────────────────────────────────
import { paintInkMarks } from '../../src/ui/ink/inkMap.js';

function recordingCtx() {
  const calls = [], state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: t.length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle, lineWidth: state.lineWidth }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}

test('REGION-LINES 2 the provinces\' line: solid on a halo over the roads, every province\'s border - and on the Bay none drawn, its water and the Bjoulsae parting High Rock from Hammerfell (mutants: the line dashed; the halo gone; the line unstroked)', () => {
  assert.deepEqual({ ...tamrielInk.PROVINCE_PEN }, { halo: 8, line: 2.6 });
  const ink = rd('src/ui/tamrielInk.js');
  assert.match(ink, /stroke\(chains, PROVINCE_PEN\.halo, PEN\.halo\);\n\s+stroke\(chains, PROVINCE_PEN\.line, PEN\.line\);/, 'solid: no dash');
  assert.match(ink, /provinceLines\(ctx, view, paperW, paperH, ink\.borders\);/);
  const base = tamrielInk.buildTamrielInk();
  const ctx = recordingCtx();
  assert.equal(tamrielInk.paintTamrielInk(ctx, { ox: -2000, oy: -1500, scale: 0.15 }, base, { paperW: 900, paperH: 560, continent: true, bayFit: 0.9 }), true);
  const lines = ctx.calls.filter((c) => c.fn === 'stroke' && (c.lineWidth === 8 || c.lineWidth === 2.6));
  assert.ok(lines.length >= 2 && lines[0].lineWidth === 8 && lines[1].lineWidth === 2.6, 'halo, then the line');
  const none = recordingCtx();
  tamrielInk.paintTamrielInk(none, { ox: 50, oy: 50, scale: 2 }, base, { paperW: 900, paperH: 560 });
  assert.equal(none.calls.length, 0, 'within the Bay, not a call');
});

test('REGION-LINES 2 the icons standardized: out on the continent the Bay inks none of its marks, anchors, wheels or rings - its three kingdoms\' capitals stand in the continent\'s layer as every province\'s does - nor its sixty-two borders; one glyph a kind across Tamriel, the zone map\'s too (mutants: the Bay\'s marks on the continent; the capitals unasked; the borders on the continent)', () => {
  const model = { marks: [
    { x: 5, y: 5, colorIndex: 11, kind: 'city', name: 'Daggerfall', port: true, carriage: true, hub: { capital: true }, mapId: 7 },
    { x: 9, y: 9, colorIndex: 11, kind: 'city', name: 'Gothway Garden', port: true, mapId: 8 },
    { x: 12, y: 9, colorIndex: 12, kind: 'hamlet', name: 'Wayrest' },
    { x: 15, y: 9, colorIndex: 11, kind: 'city', name: 'Sentinel' },
  ] };
  const view = { ox: 0, oy: 0, scale: 4 };
  const far = recordingCtx();
  paintInkMarks(far, model, view, { paperW: 200, paperH: 200, band: 'far', ports: true });
  assert.ok(far.calls.some((c) => c.fn === 'arc'), 'in to the Bay: its marks');
  const cont = recordingCtx();
  paintInkMarks(cont, model, view, { paperW: 200, paperH: 200, band: 'far', ports: true, continent: true });
  assert.equal(cont.calls.filter((c) => c.fn === 'arc' || c.fn === 'fill' || c.fn === 'fillText').length, 0, 'on the continent: nothing of the Bay\'s own');
  const marked = recordingCtx();
  paintInkMarks(marked, model, view, { paperW: 200, paperH: 200, band: 'far', continent: true, markColor: '#f00', markedMapId: 8 });
  assert.equal(marked.calls.filter((c) => c.fn === 'arc').length, 1, 'the player\'s own mark stays');
  assert.deepEqual(tamrielInk.bayCapitals(model).map((c) => [c.name, c.capital]), [['Daggerfall', true], ['Sentinel', true]], 'the kingdoms\' cities, a city each');
  const ink = rd('src/ui/tamrielInk.js');
  assert.match(ink, /for \(const c of continent && ink\.bayCapitals \? ink\.cities\.concat\(ink\.bayCapitals\) : ink\.cities\) \{/);
  assert.match(rd('src/ui/ink/inkMap.js'), /if \(!opts\.continent\) stroke\(model\.borders, 1, PEN\.soft, \[4, 3\]\);/);
  assert.deepEqual({ ...tamrielInk.ARENA_KIND_GLYPHS }, { 'city-state': 'city', town: 'hamlet', village: 'village' });
  const held = rd('src/ui/heldMap.js');
  assert.match(held, /const kindOf = \(c\) => \(c\.capital \? 'city' : ARENA_KIND_GLYPHS\[c\.kind\] \?\? 'hamlet'\);/, 'the zone map\'s kinds the same');   // PIN MOVED (TESA x AUDIT TESA II): a place of no kind the hamlet, as the sheet's bucket
  assert.match(held, /continent: this\._tamriel && onContinent\(env\.view\.scale, this\._bayFit\(\)\),   \/\/ REGION-LINES/, 'the marks layer told it is on the continent');
});

