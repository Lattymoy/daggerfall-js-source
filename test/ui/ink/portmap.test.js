// PORT-MAP (2026-10-04, Mac: "Also ports don't show on my map") - the held map's harbours. MAP2 drew a port's anchor
// at the mid and near bands only, and only while Travel Options restricts ships to ports; the map opens on the whole
// bay, in the far band, and Travel Options' ship restriction is off by default - so the ports the quays stand at
// (bible/03-World/Holdings.md 7) were on no map a player opened. An anchor at EVERY band (beside the mark the band
// inks, on the place where it inks none), haloed then inked in the full pen, whenever there are ports to show; the
// Ports filter and its key stay the mod's. bible/10-UI/Held-Map-Arc.md MAP2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildInkModel, buildInkMarks, paintInk, toPaper, HARBOUR_PEN, HARBOUR_HALO, PEN, BAND_MARKS } from '../../../src/ui/ink/inkMap.js';
import { CLIMATES, LOCATION_TYPES } from '../../../src/formats/mapsFile.js';

function recordingCtx() {
  const calls = [];
  const state = {};
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
const summaryOf = (x, y, locationType) => ({ id: y * 1000 + x, mapID: y * 1000 + x, regionIndex: 17, mapIndex: 3, locationType, discovered: true });
/** A sheet of three places: a port city, a port hamlet and an inland hamlet. */
function sheet() {
  const summaries = [summaryOf(1, 1, LOCATION_TYPES.TownCity), summaryOf(3, 1, LOCATION_TYPES.TownHamlet), summaryOf(5, 2, LOCATION_TYPES.TownHamlet)];
  const model = buildInkModel({ width: 8, height: 4, heightBytes: new Uint8Array(32).fill(40), climateAt: () => CLIMATES.Woodlands, summaries });
  model.marks = buildInkMarks({ summaries, isPort: (s) => s.mapID !== 2005 });
  return model;
}
/** The anchors one paint lays: each arc in the harbour's pens, by pen, at its centre. */
function anchors(band, scale, ports = true) {
  const model = sheet(), view = { ox: 0, oy: 0, scale }, ctx = recordingCtx();
  paintInk(ctx, model, view, { paperW: 400, paperH: 200, band, ports });
  const at = (w) => ctx.calls.filter((c) => c.fn === 'arc' && c.lineWidth === w);
  return { model, view, ink: at(HARBOUR_PEN), halo: at(HARBOUR_HALO), calls: ctx.calls };
}

test('PORT-MAP every band: the far band the map opens on lays an anchor for each port - beside the port city it inks, ON the port hamlet it does not ink - and none for the inland hamlet; mid and near the same two', () => {
  const { model, view, ink } = anchors('far', 20);
  assert.ok(!BAND_MARKS.far.has(model.marks.find((m) => m.kind === 'hamlet').colorIndex), 'far inks no hamlet');
  assert.equal(ink.length, 2, 'two ports, two anchors');
  const [city, hamlet] = model.marks.filter((m) => m.port).map((m) => toPaper(view, m.x, m.y));
  const centres = ink.map((c) => c.args[0]).sort((a, b) => a - b);
  assert.deepEqual(centres, [city[0] + 8, hamlet[0]].sort((a, b) => a - b), 'beside the city, on the hamlet');
  for (const band of ['mid', 'near']) assert.equal(anchors(band, band === 'mid' ? 30 : 60).ink.length, 2, `${band}: both`);
});

test('PORT-MAP the anchor reads: a parchment halo under it (HARBOUR_HALO) and the full pen over it (HARBOUR_PEN, PEN.line) - the halo first; none at all when the sheet is asked none', () => {
  const { ink, halo, calls } = anchors('far', 20);
  assert.equal(halo.length, ink.length);
  assert.ok(HARBOUR_HALO > HARBOUR_PEN);
  for (const c of ink) assert.equal(c.strokeStyle, PEN.line);
  for (const c of halo) assert.equal(c.strokeStyle, PEN.halo);
  assert.ok(calls.indexOf(halo[0]) < calls.indexOf(ink[0]), 'the halo under the ink');
  const none = anchors('near', 60, false);
  assert.equal(none.ink.length + none.halo.length, 0);
});

test('PORT-MAP the held map always asks for its ports - whatever Travel Options says of where a ship may sail from (the Ports filter and the P key still the mod\'s, _portsShown)', () => {
  const src = readFileSync(new URL('../../../src/ui/heldMap.js', import.meta.url), 'utf8');
  const at = src.indexOf('paintInkStatic(ctx, env.model, env.view, {');
  assert.ok(at >= 0, 'the static paint found');
  const call = src.slice(at, src.indexOf('});', at));
  assert.match(call, /\n\s+ports: true,\n/);
  assert.match(src, /if \(code === 'KeyP' && this\._portsShown\(\)\) \{ this\._togglePorts\(\); return; \}/, 'the P key the mod\'s');
});
