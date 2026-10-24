// SHIP-CLUTTER (2026-10-02, Discord: "The sea screen shows an overabundance of ship text on the high seas") - off a
// harbour every ship's tag stood on its own spar with nothing between them, and every one within TAG_DETAIL_M read its
// second line: five names and five "Wayrest Navy Cutter - patrolling off Joyous Light of Akatosh" through each other.
// Now (ui/naval/navalHud.js layoutNavalTags): one second line - the card's ship's, else the tag nearest the crosshair within
// TAG_FOCUS_PX (with no crosshair, the nearest ship's) - and no tag over another: laid the line's ship first, then the
// hostile, then the nearest, a tag that would touch one already laid is not drawn; one left out needs TAG_HOLD more
// room to come back. Each pin is red on the record's code (42e50765).
import { byClass } from '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawNavalTags, destroyNavalHud, layoutNavalTags, navalTagBox, tagLine, TAG_FOCUS_PX, TAG_CLEAR, TAG_HOLD, TAG_DETAIL_M } from '../../../src/ui/naval/navalHud.js';

const pt = (o = {}) => ({ id: 'a:1', name: 'Dibella\'s Wisdom', faction: 'merchant', hostile: false, friendly: true, line: 'Merchant Galleon', bound: 'moored at Joyous Light of Akatosh', hull: 1, state: 'afloat', boarded: false, target: false, distance: 120, x: 500, y: 300, ...o });
const touch = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
/** The harbour of the report: five ships moored together, their spars a few pixels apart on the screen. */
const harbour = () => [
  pt({ id: 'a:1', name: 'Dibella\'s Wisdom', x: 470, y: 250, distance: 90 }),
  pt({ id: 'b:2', name: 'Wayrest Navy Cutter', faction: 'navy', line: 'Wayrest Navy Cutter', bound: 'patrolling off Joyous Light of Akatosh', x: 430, y: 262, distance: 110 }),
  pt({ id: 'c:3', name: 'The Wayrest Dreadful', faction: 'navy', line: 'Wayrest War Galley', bound: 'moored at Joyous Light of Akatosh', x: 520, y: 275, distance: 130 }),
  pt({ id: 'd:4', name: 'The Pearl of Menevia', line: 'Merchant Galleon', x: 650, y: 240, distance: 160 }),
  pt({ id: 'e:5', name: 'Coastline Trader', line: 'Merchant Coaster', bound: 'leaving Joyous Light of Akatosh', x: 560, y: 285, distance: 140 }),
];

test('SHIP-CLUTTER NO TAG OVER ANOTHER: off a harbour the drawn tags stand clear of each other (TAG_CLEAR apart) and only one reads her second line - the record drew all five, five lines through each other (mutants: the overlap unread, every line read)', () => {
  const pts = harbour();
  assert.ok(pts.some((p, i) => pts.some((q, j) => j > i && touch(navalTagBox(p), navalTagBox(q)))), 'the fixture\'s tags do run into each other');
  const out = layoutNavalTags(pts, { scale: 1 });
  assert.ok(out.length >= 2 && out.length < pts.length, `some drawn, not all: ${out.map((t) => t.id)}`);
  const boxes = out.map((t) => navalTagBox(t, t.detail, 1));
  const pad = (b) => ({ left: b.left - TAG_CLEAR, right: b.right + TAG_CLEAR, top: b.top - TAG_CLEAR, bottom: b.bottom + TAG_CLEAR });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!touch(pad(boxes[i]), boxes[j]), `${out[i].id} over ${out[j].id}`);
  assert.deepEqual(out.filter((t) => t.detail).map((t) => t.id), ['a:1'], 'one line: with no crosshair, the nearest ship\'s');
  assert.deepEqual(out.map((t) => t.id), pts.map((t) => t.id).filter((id) => out.some((t) => t.id === id)), 'in the order handed in');
  // at a larger HUD scale the boxes grow: fewer stand
  assert.ok(layoutNavalTags(pts, { scale: 2 }).length <= out.length);
  // apart, all of them stand, and still one line
  const spread = pts.map((t, i) => ({ ...t, x: 200 + i * 500 }));
  const all = layoutNavalTags(spread, { scale: 1 });
  assert.equal(all.length, 5);
  assert.equal(all.filter((t) => t.detail).length, 1);
});

test('SHIP-CLUTTER THE ONE LINE: the card\'s ship reads it; else the tag nearest the crosshair within TAG_FOCUS_PX; else, with the crosshair handed in and no tag near it, none; a ship too far to read (TAG_DETAIL_M) reads none even looked at (mutants: the target unread, the radius unread, the nearest-to-eye taken over the crosshair)', () => {
  const spread = harbour().map((t, i) => ({ ...t, x: 200 + i * 500, y: 300 }));
  const lines = (o) => layoutNavalTags(spread.map((t) => ({ ...t, ...(o.patch?.(t) ?? {}) })), o).filter((t) => t.detail).map((t) => t.id);
  assert.deepEqual(lines({ focus: { x: 1200 + TAG_FOCUS_PX - 1, y: 300 } }), ['c:3'], 'the crosshair\'s: c:3 stands at 1200');
  assert.deepEqual(lines({ focus: { x: 1200 + 250, y: 300 } }), [], 'none within TAG_FOCUS_PX: no line at all');
  assert.deepEqual(lines({ focus: { x: 1200, y: 300 }, patch: (t) => (t.id === 'e:5' ? { target: true } : null) }), ['e:5'], 'the card\'s ship, wherever the crosshair');
  assert.deepEqual(lines({ focus: { x: 1200, y: 300 }, patch: (t) => (t.id === 'c:3' ? { distance: TAG_DETAIL_M + 1 } : null) }), [], 'too far to read');
  assert.equal(tagLine(spread[2]), 'Wayrest War Galley - moored at Joyous Light of Akatosh');
});

test('SHIP-CLUTTER WHO STANDS: where two would touch, the line\'s ship stands, then a hostile ship over a friendly one nearer, then the nearer (mutants: by distance alone, the line\'s ship laid last)', () => {
  const a = pt({ id: 'near', distance: 80, x: 500, y: 300 });
  const b = pt({ id: 'pirate', name: 'The Red Wake', faction: 'pirate', hostile: true, friendly: false, distance: 300, x: 520, y: 305 });
  const c = pt({ id: 'far', distance: 400, x: 515, y: 295 });
  const ids = (pts, o = {}) => layoutNavalTags(pts, { scale: 1, focus: { x: 0, y: 0 }, ...o }).map((t) => t.id);
  assert.deepEqual(ids([a, c]), ['near'], 'the nearer');
  assert.deepEqual(ids([a, b, c]), ['pirate'], 'the hostile over the nearer friendly');
  assert.deepEqual(ids([a, b, c], { focus: { x: 515, y: 295 } }), ['far'], 'the crosshair\'s over both');
});

test('SHIP-CLUTTER THE HOLD: a tag left out last frame needs TAG_HOLD more room to come back, so a bobbing view never flickers it at the edge - and drawNavalTags keeps the record across frames (mutants: no hold, the hold never cleared)', () => {
  const a = pt({ id: 'a', name: 'Salt Maid', line: '', bound: '', distance: 50, x: 500, y: 300 });
  const wa = navalTagBox(a, false).right - navalTagBox(a, false).left;
  const at = (gap) => pt({ id: 'b', name: 'Salt Maid', line: '', bound: '', distance: 60, x: 500 + wa + gap, y: 300 });
  assert.equal(layoutNavalTags([a, at(TAG_CLEAR + 1)]).length, 2, 'clear: both');
  assert.equal(layoutNavalTags([a, at(TAG_CLEAR - 1)]).length, 1, 'touching: one');
  assert.equal(layoutNavalTags([a, at(TAG_CLEAR + 1)], { held: new Set(['b']) }).length, 1, 'left out last frame: not back at the bare gap');
  assert.equal(layoutNavalTags([a, at(TAG_CLEAR + TAG_HOLD + 1)], { held: new Set(['b']) }).length, 2, 'back past the hold');
  destroyNavalHud();
  const shown = () => byClass(byClass(globalThis.document.body, 'dfnaval-tags')[0], 'dfnaval-tag').filter((n) => n.style.display !== 'none').map((n) => n.className);
  drawNavalTags([a, at(TAG_CLEAR - 1)], { scale: 1 });
  assert.equal(shown().length, 1);
  drawNavalTags([a, at(TAG_CLEAR + 1)], { scale: 1 });
  assert.equal(shown().length, 1, 'the draw holds it out');
  drawNavalTags([a, at(TAG_CLEAR + TAG_HOLD + 1)], { scale: 1 });
  assert.equal(shown().length, 2, 'and lets it back');
  drawNavalTags([a, at(TAG_CLEAR + 1)], { scale: 1 });
  assert.equal(shown().length, 2, 'drawn last frame: the bare gap holds it');
  destroyNavalHud();
});

test('SHIP-CLUTTER THE DRAW: drawNavalTags lays the tags before it wears them - the harbour\'s five drawn as the layout says, one second line in the DOM, the rest emptied; the crosshair handed in moves the line (mutants: the layout skipped, every line written)', () => {
  destroyNavalHud();
  drawNavalTags(harbour(), { scale: 1, reach: 700, focus: { x: 650, y: 230 } });
  const [layer] = byClass(globalThis.document.body, 'dfnaval-tags');
  const on = byClass(layer, 'dfnaval-tag').filter((n) => n.style.display !== 'none');
  const want = layoutNavalTags(harbour(), { scale: 1, focus: { x: 650, y: 230 } });
  assert.deepEqual(on.map((n) => byClass(n, 'dfnaval-tag-name')[0].textContent), want.map((t) => t.name));
  const lines = on.map((n) => byClass(n, 'dfnaval-tag-line')[0].textContent).filter(Boolean);
  assert.deepEqual(lines, ['Merchant Galleon - moored at Joyous Light of Akatosh'], 'the Pearl\'s alone - looked at');
  destroyNavalHud();
});
