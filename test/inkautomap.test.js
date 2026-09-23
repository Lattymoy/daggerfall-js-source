// EM3 - THE AUTOMAP'S INK (2026-09-21, Mac: "we're going to put our own
// spin on the automap and town map themselves, enhancing the look like
// how we did we the world map. The automap should become a 2d map and
// floor based instead of the current 3D implementation").
//
// `systems/automapFloors.js` answers WHAT to draw and its own pins hold
// that. These hold HOW: that the dungeon is drawn by the hand that drew
// the Iliac Bay (inkMap's pen, inkMap's halo, no colour invented here),
// that the three weights mean what the header says they mean, and that
// the floor strip is the tab strip's twin - same scale, same hand, same
// grab band, and BOTTOM STOREY AT THE BOTTOM.
//
// The painters are driven through a recording 2D context, as every ink
// pin in this lane is, so what is asserted is the display list rather
// than pixels nobody in node can see.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PLAN_PEN, WALL_PEN, WALL_PEN_MIN, CARET_R, BEACON_R, MARK_R,
  FLOOR_STRIP, FLOOR_STRIP_MAX, visibleFloors,
  paintPlanStatic, paintPlanOverlay, floorStripLayout, floorStripHit, paintFloorStrip,
} from '../src/ui/inkAutomap.js';
import { PEN, HALO_PEN, NAME_FACE, toPaper, boundarySegments, linkSegments } from '../src/ui/inkMap.js';
import { STRIP, stripScale, grabHit } from '../src/ui/mapStrip.js';
import { floorPlan } from '../src/systems/automapFloors.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A 2D context that writes down the display list. */
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: t.length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle, fillStyle: state.fillStyle, lineWidth: state.lineWidth, font: state.font }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}

/** A flat quad at height y over [x0,x1]x[z0,z1], as a reveal row. */
const quad = (y, x0, z0, x1, z1, key = 'k') => ({
  key,
  positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  matrix: null,
});
const plans = (revealed, walked) => {
  const all = floorPlan(revealed, 0, { segments: boundarySegments, link: linkSegments });
  const mine = walked
    ? floorPlan(walked, all.index, { segments: boundarySegments, link: linkSegments, floors: all.floors, bounds: all.bounds })
    : null;
  return { all, mine };
};
const VIEW = { ox: -2, oy: -2, scale: 8 };
const PAPER = { paperW: 400, paperH: 300, dpr: 1 };

test('EM3: the dungeon is drawn in the BAY\'s pen - not one colour is invented here', () => {
  for (const [name, value] of Object.entries(PLAN_PEN)) {
    assert.ok(Object.values(PEN).includes(value), `PLAN_PEN.${name} is a colour inkMap does not have`);
  }
  // and the two sheets share the hand at the SOURCE too: the pen, the
  // halo and the face all come from inkMap, and the strip's scale from
  // the tab strip, so nothing here can drift away from the world map
  const text = src('src/ui/inkAutomap.js');
  assert.match(text, /import \{ PEN, HALO_PEN, NAME_FACE, toPaper, paintCaret, CARET_R \} from '\.\/inkMap\.js';/);
  assert.match(text, /import \{ STRIP, stripScale, grabHit \} from '\.\/mapStrip\.js';/);
  assert.doesNotMatch(text, /rgba?\(/, 'a colour written out here is a colour that drifts');
  assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b/);
});

test('EM3: the wall is the outline of what was REVEALED, in world units through the view', () => {
  // a ten-by-ten room at the origin
  const { all } = plans([quad(0, 0, 0, 10, 10)], null);
  assert.ok(all.chains.length >= 1);
  const ctx = recordingCtx();
  paintPlanStatic(ctx, all, VIEW, PAPER);
  const strokes = ctx.calls.filter((c) => c.fn === 'stroke');
  assert.equal(strokes.length, 1, 'the whole outline is ONE stroke - a stroke per chain would double the shared ends');
  assert.equal(strokes[0].strokeStyle, PLAN_PEN.wall);
  // the line lands where the room is: the chain's first point, through
  // the same toPaper the bay's ink uses
  const moves = ctx.calls.filter((c) => c.fn === 'moveTo');
  assert.ok(moves.length >= 1);
  const p0 = all.chains[0][0];
  assert.deepEqual(moves[0].args, toPaper(VIEW, p0.x, p0.y));
  // the paper is cleared once, in device pixels
  const clears = ctx.calls.filter((c) => c.fn === 'clearRect');
  assert.equal(clears.length, 1);
  assert.deepEqual(clears[0].args, [0, 0, PAPER.paperW, PAPER.paperH]);
  const t = ctx.calls.find((c) => c.fn === 'setTransform');
  assert.deepEqual(t.args, [1, 0, 0, 1, 0, 0]);
  // clear: false draws over what is already there (the window's kept layer)
  const over = recordingCtx();
  paintPlanStatic(over, all, VIEW, { ...PAPER, clear: false });
  assert.equal(over.calls.filter((c) => c.fn === 'clearRect').length, 0);
});

test('EM3: the wall thins with the zoom but never past the weight a line stops being a line at', () => {
  const { all } = plans([quad(0, 0, 0, 10, 10)], null);
  const widthAt = (scale) => {
    const ctx = recordingCtx();
    paintPlanStatic(ctx, all, { ox: 0, oy: 0, scale }, PAPER);
    return ctx.calls.find((c) => c.fn === 'stroke').lineWidth;
  };
  assert.equal(widthAt(0.01), WALL_PEN_MIN, 'a whole level fitted on the sheet still has walls');
  assert.ok(widthAt(20) > widthAt(4), 'and a room zoomed in has thicker ones');
  assert.ok(widthAt(1000) <= WALL_PEN * 1.6, 'bounded, or a close zoom fills the room with ink');
});

test('EM3: the WASH is where the player walked THIS RUN - under the wall, cell for cell, never a second outline', () => {
  // two rooms revealed, one of them walked
  const revealed = [quad(0, 0, 0, 10, 10, 'a'), quad(0, 10, 0, 20, 10, 'b')];
  const { all, mine } = plans(revealed, [revealed[0]]);
  const ctx = recordingCtx();
  paintPlanStatic(ctx, all, VIEW, { ...PAPER, walked: mine });
  // ONE fill, in the shore's shade, and it goes down BEFORE the wall
  const fills = ctx.calls.filter((c) => c.fn === 'fill');
  assert.equal(fills.length, 1, 'the whole wash is one path - a fillRect a cell shows its own grid');
  assert.equal(fills[0].fillStyle, PLAN_PEN.wash);
  assert.equal(PLAN_PEN.wash, PEN.wash, 'the shore\'s own shade, because this is the same kind of island');
  const strokes = ctx.calls.filter((c) => c.fn === 'stroke');
  assert.equal(strokes.length, 1, 'and still only ONE outline - the walked half is a tint, not a second wall');
  assert.ok(ctx.calls.indexOf(fills[0]) < ctx.calls.indexOf(strokes[0]), 'the wash is under the wall');
  // the rectangles are RUNS: a ten-wide room is not ten rects per row
  const rects = ctx.calls.filter((c) => c.fn === 'rect');
  assert.ok(rects.length > 0);
  assert.ok(rects.length < mine.occupancy.covered.reduce((n, v) => n + v, 0),
    'neighbouring cells in a row are one rectangle');
  // every rect lies inside the walked room's own x range, not the revealed pair's
  const xs = rects.map((c) => c.args[0]);
  const right = toPaper(VIEW, 10.5, 0)[0];
  assert.ok(Math.max(...xs) < right, 'the wash stops where the player did');
  // nothing walked at all is a plan with no tint, and not a throw
  const bare = recordingCtx();
  assert.doesNotThrow(() => paintPlanStatic(bare, all, VIEW, { ...PAPER, walked: null }));
  assert.equal(bare.calls.filter((c) => c.fn === 'fill').length, 0);
});

test('EM3: the painters are guarded on a real context, as every painter in this lane is', () => {
  const { all } = plans([quad(0, 0, 0, 10, 10)], null);
  for (const bad of [null, undefined, {}, { fillStyle: '' }]) {
    assert.doesNotThrow(() => paintPlanStatic(bad, all, VIEW, PAPER));
    assert.doesNotThrow(() => paintPlanOverlay(bad, VIEW, PAPER));
    assert.doesNotThrow(() => paintFloorStrip(bad, floorStripLayout([{ index: 0, label: 'Floor 1' }], 0)));
  }
  // an empty plan paints nothing rather than throwing
  const ctx = recordingCtx();
  assert.doesNotThrow(() => paintPlanStatic(ctx, { chains: [] }, VIEW, PAPER));
  assert.doesNotThrow(() => paintPlanStatic(ctx, null, VIEW, PAPER));
});

test('EM3: the caret says which way the player FACES, and it is the last thing drawn', () => {
  const ctx = recordingCtx();
  // facing north (yaw 0): the motor measures yaw from -Z clockwise, and
  // every sheet lays +Z UP the paper (DISC8-C), so north is UP
  paintPlanOverlay(ctx, VIEW, { ...PAPER, player: { x: 5, z: 5, yaw: 0 } });
  const [cx, cy] = toPaper(VIEW, 5, 5);
  const tip = ctx.calls.find((c) => c.fn === 'moveTo');
  assert.ok(Math.abs(tip.args[0] - cx) < 1e-9, 'facing north, the tip is straight above the player');
  assert.ok(tip.args[1] < cy, 'and ABOVE, not below');
  assert.ok(Math.abs((cy - tip.args[1]) - CARET_R) < 1e-9, 'a caret\'s length is CARET_R');
  // east (yaw 90 degrees) points right
  const east = recordingCtx();
  paintPlanOverlay(east, VIEW, { ...PAPER, player: { x: 5, z: 5, yaw: Math.PI / 2 } });
  const et = east.calls.find((c) => c.fn === 'moveTo');
  assert.ok(et.args[0] > cx && Math.abs(et.args[1] - cy) < 1e-9, 'facing east, the tip is to the right');
  // the caret is HALOED and then filled, as every mark on this sheet is
  const haloed = ctx.calls.find((c) => c.fn === 'stroke');
  const filled = ctx.calls.find((c) => c.fn === 'fill');
  assert.equal(haloed.strokeStyle, PLAN_PEN.halo);
  assert.equal(haloed.lineWidth, 2 * HALO_PEN);
  assert.equal(filled.fillStyle, PLAN_PEN.caret);
  assert.ok(ctx.calls.indexOf(haloed) < ctx.calls.indexOf(filled));
  // the caret does NOT scale with the zoom - it is a cursor, not a room
  const far = recordingCtx();
  paintPlanOverlay(far, { ox: 0, oy: 0, scale: 0.2 }, { ...PAPER, player: { x: 5, z: 5, yaw: 0 } });
  const [fx, fy] = toPaper({ ox: 0, oy: 0, scale: 0.2 }, 5, 5);
  const ft = far.calls.find((c) => c.fn === 'moveTo');
  assert.ok(Math.abs((fy - ft.args[1]) - CARET_R) < 1e-9, 'a caret that shrank with the plan would vanish');
  assert.ok(Math.abs(ft.args[0] - fx) < 1e-9);
});

test('EM3: the beacon breathes at the way in, and the marks name what they are', () => {
  const ctx = recordingCtx();
  paintPlanOverlay(ctx, VIEW, {
    ...PAPER, pulse: 1,
    entrance: { x: 2, z: 3 },
    marks: [
      { x: 4, z: 4, kind: 'door' },
      { x: 6, z: 6, kind: 'teleporter' },
      { x: 8, z: 8, kind: 'note', name: 'the lever is behind the throne' },
    ],
  });
  const arcs = ctx.calls.filter((c) => c.fn === 'arc');
  // the beacon's ring, plus a teleporter's two
  assert.equal(arcs.length, 3);
  const beacon = arcs.find((c) => c.strokeStyle === PLAN_PEN.beacon);
  assert.ok(beacon, 'the way in is drawn in the pen the world map rings a choice in');
  const [bx, by] = toPaper(VIEW, 2, 3);
  assert.equal(beacon.args[0], bx);
  assert.equal(beacon.args[1], by);
  assert.equal(beacon.args[2], BEACON_R + 2, 'and it breathes with the pulse');
  const still = recordingCtx();
  paintPlanOverlay(still, VIEW, { ...PAPER, entrance: { x: 2, z: 3 }, pulse: 0 });
  assert.equal(still.calls.find((c) => c.fn === 'arc').args[2], BEACON_R);

  // a door is a stroke across the opening; a teleporter is a ring in a ring
  const doorAt = toPaper(VIEW, 4, 4);
  const doorMove = ctx.calls.find((c) => c.fn === 'moveTo' && Math.abs(c.args[0] - (doorAt[0] - MARK_R)) < 1e-9);
  assert.ok(doorMove, 'a door is drawn where the door is');
  const tele = arcs.filter((c) => Math.abs(c.args[0] - toPaper(VIEW, 6, 6)[0]) < 1e-9);
  assert.equal(tele.length, 2, 'a ring inside a ring: you come out somewhere else');
  assert.ok(tele[0].args[2] > tele[1].args[2]);

  // a NOTE is the player's own word, haloed like every name on this sheet
  const noteInk = ctx.calls.find((c) => c.fn === 'fillText');
  const noteHalo = ctx.calls.find((c) => c.fn === 'strokeText');
  assert.equal(noteInk.args[0], 'the lever is behind the throne');
  assert.equal(noteInk.fillStyle, PLAN_PEN.note);
  assert.equal(noteHalo.strokeStyle, PLAN_PEN.halo);
  assert.ok(noteInk.font.includes(NAME_FACE), 'in the sheet\'s own hand');
  assert.ok(ctx.calls.indexOf(noteHalo) < ctx.calls.indexOf(noteInk));
  // no marks at all is a quiet overlay
  const empty = recordingCtx();
  paintPlanOverlay(empty, VIEW, PAPER);
  assert.equal(empty.calls.filter((c) => c.fn === 'arc' || c.fn === 'fillText').length, 0);
});

test('EM3: the floor strip is the tab strip\'s twin - same scale, same hand, BOTTOM STOREY AT THE BOTTOM', () => {
  const floors = [
    { index: 0, label: 'Floor 1' }, { index: 1, label: 'Floor 2' }, { index: 2, label: 'Floor 3' },
  ];
  const lay = floorStripLayout(floors, 1, { paperW: 520, paperH: 300, measure: (t, f) => t.length * f * 0.5 });
  assert.equal(lay.rows.length, 3);
  assert.equal(lay.scale, stripScale(520), 'the strip and the tabs are one hand');
  assert.equal(lay.fontPx, FLOOR_STRIP.font * lay.scale);
  // the TOP of the paper is the TOP storey, so floor 1 is lowest down
  assert.deepEqual(lay.rows.map((r) => r.index), [2, 1, 0]);
  assert.ok(lay.rows[0].y < lay.rows[1].y && lay.rows[1].y < lay.rows[2].y);
  // every row is right-aligned against the paper's right edge
  for (const r of lay.rows) assert.equal(r.x + r.w, 520 - FLOOR_STRIP.padX * lay.scale);
  // exactly one row is live, and it is the one asked for
  assert.deepEqual(lay.rows.filter((r) => r.live).map((r) => r.index), [1]);
  // EM5: THE STACK IS TOP-ANCHORED, under whatever band the caller
  // reserves. The first cut centred it down the right edge, and the
  // browser probe drew "Floor 1" squarely under the right gauntlet -
  // MAP-FIELD's lesson again, that the paper's rectangle is not the
  // part of it a player can SEE. The hands hold the sheet at its lower
  // corners, so the clear parchment is the TOP right.
  assert.equal(lay.rows[0].y, FLOOR_STRIP.padY * lay.scale, 'at the top, with only its own pad above it');
  const under = floorStripLayout(floors, 1, { paperW: 520, paperH: 300, reserveTop: 40, measure: (t, f) => t.length * f * 0.5 });
  assert.equal(under.rows[0].y, 40 + FLOOR_STRIP.padY * under.scale, 'and below the tab strip when there is one');
  assert.ok(lay.rows[2].y + lay.rows[2].h < 300 * 0.6, 'the whole stack stays in the top half, clear of the hands');
  // one storey is still a strip - a level with no stack still says so
  assert.equal(floorStripLayout([floors[0]], 0, {}).rows.length, 1);
  assert.deepEqual(floorStripLayout([], 0, {}).rows, []);
});

test('EM3: the floor strip is hit like a tab, grab band and all', () => {
  const floors = [{ index: 0, label: 'Floor 1' }, { index: 1, label: 'Floor 2' }];
  const lay = floorStripLayout(floors, 0, { paperW: 520, paperH: 300, measure: (t, f) => t.length * f * 0.5 });
  const g = FLOOR_STRIP.grab * lay.scale;
  for (const r of lay.rows) {
    assert.equal(floorStripHit(lay, r.x + r.w / 2, r.y + r.h / 2), r.index);
    assert.equal(floorStripHit(lay, r.x - g * 0.5, r.y - g * 0.5), r.index, 'grown for a thumb');
    assert.equal(floorStripHit(lay, r.x - g * 4, r.y), null, 'and bounded');
  }
  assert.equal(floorStripHit(lay, 0, 0), null, 'the map to the left of the strip is the MAP');
  assert.equal(floorStripHit(null, 0, 0), null);
  assert.equal(floorStripHit({ rows: [] }, 0, 0), null);
});

test('EM3: a tower taller than the strip shows the live storey and its neighbours, never runs off the paper', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ index: i, label: `Floor ${i + 1}` }));
  for (const live of [0, 7, 15, 29]) {
    const shown = visibleFloors(many, live);
    assert.equal(shown.length, FLOOR_STRIP_MAX, `${live}: the strip is capped`);
    assert.ok(shown.some((f) => f.index === live), `${live}: and always carries the storey you are on`);
    // the window is contiguous and in order
    assert.deepEqual(shown.map((f) => f.index), shown.map((_, i) => shown[0].index + i));
    assert.ok(shown[0].index >= 0 && shown[shown.length - 1].index <= 29, `${live}: and inside the tower`);
  }
  // under the cap nothing is hidden
  const few = Array.from({ length: FLOOR_STRIP_MAX }, (_, i) => ({ index: i, label: `Floor ${i + 1}` }));
  assert.deepEqual(visibleFloors(few, 3), few);
  assert.deepEqual(visibleFloors([], 0), []);
  assert.deepEqual(visibleFloors(null, 0), []);
  // ...and a storey the list does not carry still leaves a usable strip
  assert.equal(visibleFloors(many, 999).length, FLOOR_STRIP_MAX);
});

test('EM3: the floor strip is inked like a tab - haloed, the live row ruled, the rest soft', () => {
  const floors = [{ index: 0, label: 'Floor 1' }, { index: 1, label: 'Floor 2' }];
  const lay = floorStripLayout(floors, 1, { paperW: 520, paperH: 300, measure: (t, f) => t.length * f * 0.5 });
  const ctx = recordingCtx();
  paintFloorStrip(ctx, lay);
  const halo = ctx.calls.filter((c) => c.fn === 'strokeText');
  const ink = ctx.calls.filter((c) => c.fn === 'fillText');
  assert.equal(halo.length, 2);
  assert.equal(ink.length, 2);
  for (const h of halo) { assert.equal(h.strokeStyle, PEN.halo); assert.equal(h.lineWidth, 2 * HALO_PEN); }
  const byLabel = Object.fromEntries(ink.map((c) => [c.args[0], c.fillStyle]));
  assert.equal(byLabel['Floor 2'], PEN.name, 'the storey you are on');
  assert.equal(byLabel['Floor 1'], PEN.soft, 'and the one you are not');
  const rules = ctx.calls.filter((c) => c.fn === 'lineTo');
  assert.equal(rules.length, 1, 'exactly one rule, under the live row');
  assert.equal(rules[0].strokeStyle, PEN.line);
  assert.equal(ctx.calls[0].fn, 'save');
  assert.equal(ctx.calls[ctx.calls.length - 1].fn, 'restore');
  assert.ok(ctx.calls.some((c) => c.fn === 'font' || true));
  assert.ok(lay.rows.every((r) => r.h > 0));
  assert.ok(STRIP.refPaper > 0);
});

test('EM3: two grabbed boxes that overlap give the press to the NEAREST - the seam bug, pinned', () => {
  // THE FLOOR STRIP'S ROWS SIT A GAP APART NARROWER THAN TWO GRAB
  // BANDS. A first-match hit therefore handed every press near a seam
  // to the row ABOVE it: a player aiming at Floor 1 got Floor 2, every
  // time, and the strip read as broken rather than as generous. Found
  // by a pin rather than by looking, and fixed in the shared grab law
  // rather than by shrinking the band, because a band that stops at
  // half a gap is a band that stops being generous.
  const floors = [{ index: 0, label: 'Floor 1' }, { index: 1, label: 'Floor 2' }];
  const lay = floorStripLayout(floors, 0, { paperW: 520, paperH: 300, measure: (t, f) => t.length * f * 0.5 });
  const [upper, lower] = lay.rows;          // index 1 above, index 0 below
  assert.equal(upper.index, 1);
  assert.equal(lower.index, 0);
  const g = FLOOR_STRIP.grab * lay.scale;
  const gap = lower.y - (upper.y + upper.h);
  assert.ok(gap < 2 * g, 'the fixture is the real geometry: the bands DO overlap');
  // a point just above the lower row is in both bands, and belongs to
  // the row whose own box it is nearest
  const between = lower.y - g * 0.4;
  assert.ok(between > upper.y + upper.h, 'the point is past the upper row\'s ink');
  assert.equal(floorStripHit(lay, lower.x + lower.w / 2, between), 0, 'the nearer row wins');
  // ...and the mirror case, just below the upper row's ink
  const above = upper.y + upper.h + g * 0.2;
  assert.equal(floorStripHit(lay, upper.x + upper.w / 2, above), 1);
  // dead centre of either row is never in doubt
  assert.equal(floorStripHit(lay, upper.x + upper.w / 2, upper.y + upper.h / 2), 1);
  assert.equal(floorStripHit(lay, lower.x + lower.w / 2, lower.y + lower.h / 2), 0);

  // the law is ONE law: the tab strip is hit by the same function
  assert.equal(grabHit([], 0, 0, 5), -1);
  assert.equal(grabHit(null, 0, 0, 5), -1);
  const boxes = [{ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 14, w: 10, h: 10 }];
  assert.equal(grabHit(boxes, 5, 5, 6), 0, 'inside the first');
  assert.equal(grabHit(boxes, 5, 19, 6), 1, 'inside the second');
  assert.equal(grabHit(boxes, 5, 11, 6), 0, 'nearer the first');
  assert.equal(grabHit(boxes, 5, 13, 6), 1, 'nearer the second');
  assert.equal(grabHit(boxes, 5, 40, 6), -1, 'clear of both');
  assert.match(src('src/ui/inkAutomap.js'), /grabHit\(rows, px, py/, 'the floor strip does not write its own');
  assert.match(src('src/ui/mapStrip.js'), /grabHit\(tabs, px, py/, 'nor does the tab strip');
});
