// MARKS-PER-VIEW (2026-10-29, bible/03-World/Tamriel.md MARKS-PER-VIEW): the countryside's and the lairs' marks past the
// Bay are inked on the view by the continent's 'over' part - over the province borders, under the open zone's fog - and
// never by the road tiles, whose stand-ins drew them at another level's size after every zoom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTamrielInk, paintTamrielInk, paintPastBayMarks } from '../../src/ui/tamrielInk.js';
import { toPaper } from '../../src/ui/ink/inkMap.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';

const view = { ox: 1040, oy: 200, scale: 4 };
const place = { x: 1060, y: 230, type: LOCATION_TYPES.ReligionTemple };
const placesIn = () => [place];

/** A context that records every call in order, and every pen it was handed. */
function recorder() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, k) => (k === 'measureText' ? () => ({ width: 0 }) : (...a) => calls.push([k, a])),
    set: (_, k, v) => { calls.push([`=${String(k)}`, [v]]); return true; },
  });
  return { ctx, calls };
}
/** The index of the first call that draws at the place's paper point. */
const glyphAt = (calls) => {
  const [px, py] = toPaper(view, place.x + 0.5, place.y + 0.5);
  return calls.findIndex(([k, a]) => (k === 'moveTo' || k === 'arc' || k === 'lineTo') && Math.abs(a[0] - px) < 8 && Math.abs(a[1] - py) < 8);
};

test('MARKS-PER-VIEW the over part inks the places past the Bay: after the province borders, before the window\'s `under` (the open zone\'s fog); the roads part inks none (mutants: the call dropped; laid after the fog)', () => {
  const ink = buildTamrielInk();
  const { ctx, calls } = recorder();
  const opts = { paperW: 400, paperH: 300, band: 'near', continent: false, filters: {}, placesIn, under: () => calls.push(['under', []]) };
  paintTamrielInk(ctx, view, ink, { ...opts, part: 'over' });
  const glyph = glyphAt(calls);
  const under = calls.findIndex(([k]) => k === 'under');
  const borderPen = calls.findIndex(([k, a]) => k === '=lineWidth' && a[0] === 2.6);   // PROVINCE_PEN.line, the borders' last pass
  assert.ok(glyph >= 0, 'the temple inked');
  assert.ok(borderPen >= 0 && borderPen < glyph, 'over the province borders');
  assert.ok(glyph < under, 'under the open zone\'s fog');
  const roads = recorder();
  paintTamrielInk(roads.ctx, view, ink, { ...opts, part: 'roads' });
  assert.equal(glyphAt(roads.calls), -1, 'the road tiles\' part inks no mark');
});

test('MARKS-PER-VIEW out on the continent no countryside mark is inked, as the tiles inked none there (mutant: the continent unread)', () => {
  const { ctx, calls } = recorder();
  paintPastBayMarks(ctx, view, { paperW: 400, paperH: 300, band: 'near', continent: true, placesIn });
  assert.deepEqual(calls, []);
  paintPastBayMarks(ctx, view, { paperW: 400, paperH: 300, band: 'near', continent: false, placesIn });
  assert.ok(glyphAt(calls) >= 0);
});
