// WW7-6 (2026-10-25, the owner: "we need the same city nodes populating the entire map of tamriel"; bible/03-World/
// World-Wide.md WW7-6): the seats past the Bay on the map - each city the continent's layer inks carries its seat's key,
// ringed under its glyph as the Bay rings its own, and its card under the pointer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arenaInkCities, bayCapitals, buildTamrielInk, paintTamrielInk } from '../../src/ui/tamrielInk.js';
import { markReach, toPaper } from '../../src/ui/ink/inkMap.js';
import { capitalPlaceId } from '../../src/world/tamrielCapitals.js';
import { arenaPlaceId } from '../../src/world/arenaLocations.js';
import { bayToPicture } from '../../src/world/tamriel/tamrielFrame.js';
import { seatMapMark, SEAT_RING_UNHELD } from '../../src/net/townSeatLaw.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
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

test('WW7-6 a city past the Bay carries its seat\'s key: a province capital its centre\'s, any other place its own, the Bay\'s capitals their map ids (mutants: the capital keyed as a city; the Bay\'s capitals keyless)', () => {
  const [px, py] = bayToPicture(-400, -300), [qx, qy] = bayToPicture(-420, -300);
  const cities = arenaInkCities({ places: [
    { name: 'Solitude', province: 'Skyrim', provinceIndex: 2, id: 0, kind: 'city-state', px, py },
    { name: 'Dragon Bridge', province: 'Skyrim', provinceIndex: 2, id: 5, kind: 'town', px: qx, py: qy },
  ] });
  assert.deepEqual(cities.map((c) => [c.name, c.capital, c.mapId]), [['Solitude', true, capitalPlaceId(1, 0)], ['Dragon Bridge', false, arenaPlaceId({ provinceIndex: 2, id: 5 })]]);
  assert.deepEqual(bayCapitals({ marks: [{ kind: 'city', name: 'Daggerfall', x: 5, y: 5, summary: { mapID: 1291010263 } }, { kind: 'city', name: 'Gothway Garden', x: 9, y: 9 }] }).map((c) => c.mapId), [1291010263]);
});

test('WW7-6 a seat past the Bay ringed under its glyph as the Bay\'s, an unseated place none; the map hands the seats in and the pointer reads a seat\'s card (mutants: no ring; the ring over the glyph; the seats unasked)', () => {
  const base = buildTamrielInk();
  const ink = { ...base, cities: [{ name: 'Solitude', province: 'Skyrim', capital: true, kind: 'city-state', x: -400, y: -300, mapId: capitalPlaceId(1, 0) },
    { name: 'Dragon Bridge', province: 'Skyrim', capital: false, kind: 'town', x: -380, y: -300, mapId: 77 }] };
  const seat = { key: capitalPlaceId(1, 0), name: 'Solitude', tier: 'crown', region: 64, pixel: [10, 10] };
  const view = { ox: -460, oy: -340, scale: 2 }, ctx = recordingCtx(), asked = [];
  assert.equal(paintTamrielInk(ctx, view, ink, { paperW: 900, paperH: 560, seatAt: (c) => { asked.push(c.mapId); return c.mapId === seat.key ? seat : null; } }), true);
  assert.deepEqual(asked, [capitalPlaceId(1, 0), 77]);
  const [x, y] = toPaper(view, -400, -300), r = markReach({ kind: 'city', seat });
  const ring = ctx.calls.findIndex((c) => c.fn === 'arc' && Math.abs(c.args[0] - x) < 1e-6 && Math.abs(c.args[1] - y) < 1e-6 && Math.abs(c.args[2] - r) < 1e-6);
  assert.ok(ring >= 0, 'Solitude ringed');
  assert.ok(ctx.calls.some((c, i) => i > ring && c.fn === 'stroke' && c.strokeStyle === seatMapMark(seat).ring), 'in the seat\'s ink');
  assert.equal(seatMapMark(seat).ring, SEAT_RING_UNHELD);
  const [x2, y2] = toPaper(view, -380, -300), r2 = markReach({ kind: 'hamlet', seat: true });
  assert.ok(!ctx.calls.some((c) => c.fn === 'arc' && Math.abs(c.args[0] - x2) < 1e-6 && Math.abs(c.args[1] - y2) < 1e-6 && Math.abs(c.args[2] - r2) < 1e-6), 'no seat, no ring');
  const src = rd('src/ui/tamrielInk.js');
  assert.ok(src.indexOf('if (m.seat) paintSeatRing(ctx, m.x, m.y, markReach(m), seatMapMark(m.seat));') < src.indexOf('for (const m of marks) paintGlyph(ctx, m.kind, m.x, m.y, true);'), 'under the glyph');
  const held = rd('src/ui/heldMap.js');
  assert.match(held, /seatAt: \(c\) => this\.deps\.seatAt\?\.\(\{ mapId: c\.mapId \}\) \?\? null,/);
  assert.match(held, /const seat = past\.city\?\.mapId != null \? this\.deps\.seatAt\?\.\(\{ mapId: past\.city\.mapId \}\) \?\? null : null;\n\s+const tip = seat \? readTip\(seatTipOf\(seat\), \{ textMax: SEAT_TIP_TEXT_MAX, linesMax: TOWN_TIP_LINES_MAX \}\) : ore;/);   // PIN MOVED (TESA x AUDIT TESA II): off M14's hover, the ore card where no seat stands
});
