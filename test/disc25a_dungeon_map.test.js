// DISC25-A (2026-09-25, tannim and kurkku on Discord, through Mac: "the plane you are on + stairs going down and had
// the ability to press down to advance the plane displayed down a step (or up to go up)", "If no plane one step up,
// just show the ramp going up or down", "clicking stairs to move up or down a level is good though"; Mac: "making
// comprehensive improvements to it").
//
// WHAT A REAL DUNGEON SHOWED (tools/ run over the freeware data, not committed): Privateer's Hold derived THIRTEEN
// storeys, because Daggerfall lays its rooms on a 3.2 m grid and every step of it is a headroom apart. Each sheet was
// a scatter of corridor ends, every corridor end a WALL - the stair that carried it on belonged to the next storey -
// and the strip of thirteen ran down the paper's edge under the right gauntlet. So:
//   A1 a cell is on the storey its OWN surface is nearest (a ramp splits where it crosses the line, not on a diagonal);
//   A2 the stairs between storeys are FOUND - wherever two storeys' surfaces meet within a stair's rise;
//   A3 storeys that never lie over one another share a SHEET, so a floor of the map is a run of them;
//   A4 an edge onto a stair's far side, on another sheet, is not walled off;
//   A5 the sheet draws its stairs - inside a floor pointing up it, onto another floor named for it - and a press on
//      one of the latter turns the page;
//   A6 the strip stops above the right hand, with a chevron where floors are hidden, and marks the floor you stand
//      on, the floor the way out is on, and (faint) the floors nothing has been revealed on;
//   A7 the window's foot says the dungeon's keys while it is up;
//   A8 the hands the sheets keep their words out of are the THUMBS the key found, not the generous zones;
//   A9 a note written on a floor of several heights is pinned at the storey under the pointer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  floorTriangles, deriveFloors, floorAt, floorPlan, storeyOccupancy, planBounds, surfaceY,
  levelField, storeyLinks, groupSheets, sheetOfStorey, fieldOccupancy,
  STAIR_RISE, SHEET_OVERLAP, LINK_JOIN, FLOOR_MIN_GAP,
} from '../src/systems/automapFloors.js';
import { STEP_OFFSET } from '../src/player/motor.js';
import { createAutomapSheet, AUTOMAP_HINT, STAIR_MERGE } from '../src/ui/automapSheet.js';
import {
  floorStripLayout, floorStripHit, paintFloorStrip, paintStairs, PLAN_PEN, FLOOR_STRIP, FLOOR_STRIP_MAX,
  FLOOR_STRIP_MIN, FLOOR_UNSEEN_ALPHA, STAIR_GLYPH,
} from '../src/ui/inkAutomap.js';
import { boundarySegments, linkSegments, toPaper, PEN } from '../src/ui/inkMap.js';
import { MAP_HINT, thumbBox, HeldMapWindow, THUMB_ZONES, PAPER as SPRITE_PAPER } from '../src/ui/heldMap.js';
import { NOTE_SPAWN_NORMAL_OFFSET } from '../src/systems/automap.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A quad at height y over [x0,x1]x[z0,z1] whose FILE normal looks `ny` (+1 a floor, -1 a ceiling). */
const quad = (key, y, x0, z0, x1, z1, ny = 1) => ({
  key,
  aabb: { min: [x0, y, z0], max: [x1, y, z1] },
  positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  normals: new Float32Array([0, ny, 0, 0, ny, 0, 0, ny, 0, 0, ny, 0]),
  matrix: null,
});
/** A closed room: its floor at y looking up, its ceiling at y + h looking down. */
const room = (key, y, x0, z0, x1, z1, h = 4) => [quad(`${key}f`, y, x0, z0, x1, z1, 1), quad(`${key}c`, y + h, x0, z0, x1, z1, -1)];
/** A ramp from (x0, yLow) up to (x1, yHigh), across z0..z1 - one quad, cut on its diagonal as the files cut them. */
const ramp = (key, x0, x1, yLow, yHigh, z0, z1) => ({
  key,
  aabb: { min: [x0, yLow, z0], max: [x1, yHigh, z1] },
  positions: new Float32Array([x0, yLow, z0, x1, yHigh, z0, x1, yHigh, z1, x0, yLow, z1]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  matrix: null,
});

/** A SPLIT LEVEL: a room at 0, a ramp up 8 m to the east, a room at 8 beyond it - nothing over anything. */
const SPLIT = [...room('lo', 0, 0, 0, 10, 10), ramp('ramp', 10, 20, 0, 8, 3, 7), ...room('hi', 8, 20, 0, 30, 10)];
/** The same, with a second room at 8 standing directly OVER the low room - two floors of the map, a stair between. */
const STACK = [...SPLIT, ...room('over', 8, 0, 0, 10, 10)];
const ALL = (rows) => rows.map((r) => r.key);
const rec = (revealed, extra = {}) => ({
  revealed: new Set(revealed), visitedThisRun: new Set(), entranceDiscovered: false, notes: new Map(), teleporters: new Map(), ...extra,
});
const PAPER = { paperW: 400, paperH: 300, dpr: 1 };
const VIEW = { ox: 0, oy: 0, scale: 8 };

/** A 2D context that writes down the display list, with the pen and the alpha each call was made under. */
function recordingCtx() {
  const calls = [];
  const state = { globalAlpha: 1 };
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: String(t).length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle, fillStyle: state.fillStyle, globalAlpha: state.globalAlpha }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}

/** Is there a wall segment in these chains running along x = `x` between z0 and z1 (world units)? */
function wallAlong(chains, x, z0, z1) {
  for (const c of chains) {
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1], b = c[i];
      if (Math.abs(a.x - x) < 0.01 && Math.abs(b.x - x) < 0.01) {
        const lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
        if (hi - lo > 0.01 && lo < z1 && hi > z0) return true;
      }
    }
  }
  return false;
}

const frame = (rows) => {
  const tris = floorTriangles(rows);
  const floors = deriveFloors(tris);
  const bounds = planBounds(tris, 1);
  const field = levelField(rows, floors, { bounds });
  return { floors, bounds, field };
};

test('DISC25-A A1: a cell is on the storey its OWN surface is nearest - a ramp splits where it crosses the line, not on its diagonal', () => {
  const { floors, bounds } = frame(SPLIT);
  assert.deepEqual(floors.map((f) => f.y), [0, 8], 'two rooms, two storeys; the ramp votes for neither (EM2)');
  // the plane read at a point, not the triangle's mean
  const [a, b] = floorTriangles([SPLIT.find((r) => r.key === 'ramp')]);
  assert.ok(Math.abs(surfaceY(a, 12.5, 3.5) - 2) < 1e-6 && Math.abs(surfaceY(b, 17.5, 6.5) - 6) < 1e-6, 'the ramp is 0.8 m up per metre east');
  assert.equal(surfaceY({ y: 3, ax: 0, az: 0, bx: 1, bz: 0, cx: 0, cz: 1 }, 0.2, 0.2), 3, 'no corners carried: the mean');
  // the ramp's quad is cut on the diagonal from (10,3) to (20,7): by CENTROID the cell at (12.5, 3.5) - two metres
  // up - sat in the upper triangle and was drawn on the upper storey, and (17.5, 6.5) - six up - on the lower
  const lower = storeyOccupancy(SPLIT, floors, 0, bounds);
  const upper = storeyOccupancy(SPLIT, floors, 1, bounds);
  const cellAt = (o, x, z) => o.at(Math.floor(x - o.x0), Math.floor(z - o.z0));
  assert.equal(cellAt(lower, 12.5, 3.5), true, 'two metres up the ramp is the lower storey\'s');
  assert.equal(cellAt(upper, 12.5, 3.5), false);
  assert.equal(cellAt(upper, 17.5, 6.5), true, 'six metres up is the upper storey\'s');
  assert.equal(cellAt(lower, 17.5, 6.5), false);
  // the line is the height half way between the two storeys, at x 15 for every row of the ramp
  for (const z of [3.5, 4.5, 5.5, 6.5]) {
    assert.equal(cellAt(lower, 14.5, z), true); assert.equal(cellAt(upper, 15.5, z), true);
    assert.equal(cellAt(lower, 15.5, z), false); assert.equal(cellAt(upper, 14.5, z), false);
  }
  // and the plan is cut by the same law as the occupancy it is checked against
  const plan = floorPlan(SPLIT, 0, { segments: boundarySegments, link: linkSegments, floors, bounds });
  assert.equal(cellAt(plan.occupancy, 12.5, 3.5), true);
  assert.equal(cellAt(plan.occupancy, 17.5, 6.5), false);
});

test('DISC25-A A2: the stairs are found - where two storeys\' surfaces meet within a stair\'s rise - from both sides', () => {
  assert.equal(STAIR_RISE, 2 * STEP_OFFSET + 0.2, 'two of the motor\'s strides, and a little slack');
  assert.match(src('src/systems/automapFloors.js'), /export const STAIR_RISE = 2 \* STEP_OFFSET \+ 0\.2;/, 'derived from the motor, not retyped');
  assert.ok(STAIR_RISE < FLOOR_MIN_GAP, 'a stair\'s rise is well short of a storey\'s headroom');
  const { field } = frame(SPLIT);
  const links = storeyLinks(field);
  assert.deepEqual(links.map((l) => [l.from, l.to]), [[0, 1], [1, 0]], 'one flight, seen from each end');
  const [up, down] = links;
  assert.deepEqual([up.x, up.z], [14.5, 5], 'where the ramp leaves the lower storey: the last row of cells below the line');
  assert.deepEqual([down.x, down.z], [15.5, 5], 'and where it leaves the upper');
  assert.deepEqual([up.dx, up.dz], [1, 0], 'pointing onto the cells it climbs to');
  assert.deepEqual([down.dx, down.dz], [-1, 0]);
  assert.equal(up.cells.length, 4, 'the ramp is four cells wide');
  assert.equal(up.far.length, 4);
  // a rise one hair under the ramp's own step between cells finds nothing: 0.8 m a cell here
  assert.deepEqual(storeyLinks(field, { rise: 0.79 }), []);
  assert.equal(storeyLinks(null).length, 0);
  // the cells of one flight a gap apart are one stair (LINK_JOIN), further apart two
  assert.equal(LINK_JOIN, 2);
  const wide = [...room('lo', 0, 0, 0, 10, 20), ramp('r1', 10, 20, 0, 8, 2, 4), ramp('r2', 10, 20, 0, 8, 5, 7), ...room('hi', 8, 20, 0, 30, 20)];
  assert.equal(storeyLinks(frame(wide).field).filter((l) => l.from === 0).length, 1, 'a flight split by a one-cell rail is one stair');
  const apart = [...room('lo', 0, 0, 0, 10, 20), ramp('r1', 10, 20, 0, 8, 2, 4), ramp('r2', 10, 20, 0, 8, 12, 14), ...room('hi', 8, 20, 0, 30, 20)];
  assert.equal(storeyLinks(frame(apart).field).filter((l) => l.from === 0).length, 2, 'two flights eight metres apart are two');
});

test('DISC25-A A3: storeys that never lie over one another share a SHEET; a stack is two', () => {
  const split = frame(SPLIT);
  assert.deepEqual(groupSheets(split.field, split.floors).map((s) => s.storeys), [[0, 1]], 'the split level is one floor of the map');
  const stack = frame(STACK);
  const sheets = groupSheets(stack.field, stack.floors);
  assert.deepEqual(sheets.map((s) => s.storeys), [[0], [1]], 'a room over a room is two');
  assert.deepEqual(sheets.map((s) => s.label), ['Floor 1', 'Floor 2']);
  assert.deepEqual([...sheetOfStorey(sheets, 2)], [0, 1]);
  // THE OVERLAP ALLOWANCE, at its edge: a hall at 8 whose corner lies over SHEET_OVERLAP cells of the room below
  // shares its sheet; one cell more and it does not
  assert.equal(SHEET_OVERLAP, 4);
  const at = (z1) => { const rows = [...room('lo', 0, 0, 0, 10, 10), quad('hall', 8, 9, 0, 20, z1)]; const f = frame(rows); return groupSheets(f.field, f.floors).length; };
  assert.equal(at(4), 1, 'four cells of lip');
  assert.equal(at(5), 2, 'five');
  // A STAIR IS NOT A STACK: two storeys' surfaces in one cell within a stair's rise are the stair itself
  const field = { start: Int32Array.from([0, 2, 4]), y: Float32Array.from([3.8, 4.3, 0, 8]), storey: Int16Array.from([0, 1, 0, 1]) };
  const floors = [{ index: 0, y: 0, y0: 0, y1: 0 }, { index: 1, y: 8, y0: 8, y1: 8 }];
  assert.equal(groupSheets(field, floors, { overlap: 1 }).length, 1, 'the cell where the stair crosses the line is not counted');
  assert.equal(groupSheets(field, floors, { overlap: 0 }).length, 2, 'the cell with 8 m between them is');
  // a sheet's height is its broadest storey's, for the note it pins
  assert.equal(groupSheets(null, []).length, 0);
});

test('DISC25-A A4: a stair onto another sheet is not walled across its middle', () => {
  const { floors, bounds, field } = frame(STACK);
  const sheets = groupSheets(field, floors);
  const sheetOf = sheetOfStorey(sheets, floors.length);
  const full = fieldOccupancy(field, sheets[0].storeys);
  const pass = new Set();
  for (const l of storeyLinks(field)) if (sheetOf[l.from] === 0 && sheetOf[l.to] !== 0) for (const k of l.far) pass.add(k);
  assert.equal(pass.size, 4, 'the four cells the ramp climbs onto');
  const walled = floorPlan(STACK, sheets[0].storeys, { segments: boundarySegments, link: linkSegments, floors, bounds, full });
  const open = floorPlan(STACK, sheets[0].storeys, { segments: boundarySegments, link: linkSegments, floors, bounds, full, pass });
  assert.equal(wallAlong(walled.chains, 15, 3, 7), true, 'without it: a wall across the ramp at the line - a dead end');
  assert.equal(wallAlong(open.chains, 15, 3, 7), false, 'with it: the way goes on');
  assert.equal(wallAlong(open.openChains, 15, 3, 7), false, 'and it is not an opening either - it goes to another floor');
  assert.equal(wallAlong(open.chains, 10, 0, 3), true, 'the room\'s own walls stand');
  // inside ONE sheet there is no edge at the line at all - both halves are floor
  const split = frame(SPLIT);
  const one = groupSheets(split.field, split.floors)[0];
  const plan = floorPlan(SPLIT, one.storeys, { segments: boundarySegments, link: linkSegments, floors: split.floors, bounds: split.bounds, full: fieldOccupancy(split.field, one.storeys) });
  assert.equal(wallAlong(plan.chains, 15, 3, 7), false);
});

test('DISC25-A A5: the sheet counts in SHEETS and draws its stairs; a press on one onto another floor turns the page', () => {
  const s = createAutomapSheet({ record: () => rec(ALL(STACK)), model: () => ({ rows: STACK }), player: () => ({ feet: [5, 0, 5], yaw: 0 }) });
  assert.deepEqual(s.floors().map((f) => f.storeys), [[0], [1]]);
  assert.equal(s.floor, 0, 'the player is downstairs');
  const [st] = s.stairs();
  assert.equal(s.stairs().length, 1);
  // plan units: x from the west edge (-1), y south from the north edge (11)
  assert.deepEqual([st.x, st.z, st.dx, st.dz], [15.5, 6, 1, -0], 'where it leaves this floor, pointing east');
  assert.deepEqual([st.cross, st.up, st.to, st.name], [true, true, 1, 'up to Floor 2']);
  s.paintOverlay(recordingCtx(), { view: VIEW, ...PAPER, pulse: 0 });   // the sheet learns the view it is pointed through
  const [px, py] = toPaper(VIEW, st.x, st.z);
  assert.deepEqual(s.hoverLabel(px, py), { label: 'Stairs up to Floor 2', cursor: 'pointer' });
  s.pickAt(px, py);
  assert.equal(s.floor, 1, 'kurkku: clicking the stairs moves a level');
  const [back] = s.stairs();
  assert.deepEqual([back.cross, back.up, back.to, back.name], [true, false, 0, 'down to Floor 1']);
  assert.deepEqual([back.x, back.dx], [16.5, -1], 'from the other end, pointing back');
  // the sheet's own plan leaves the stair open (plan x = world x + 1: the line at world 15; plan y = 11 - z)
  const onFloor2 = createAutomapSheet({ record: () => rec(ALL(STACK)), model: () => ({ rows: STACK }), player: () => ({ feet: [5, 0, 5], yaw: 0 }) });
  assert.equal(wallAlong(onFloor2.ensure().plan.chains, 16, 4, 8), false, 'no wall across the ramp on the plan the player sees');
  assert.equal(wallAlong(onFloor2.ensure().plan.chains, 11, 0, 4), true, 'while the room\'s east wall stands beside it');
  // NORTH IS UP THE PAPER: a flight climbing north points up the sheet
  const north = [...room('lo', 0, 0, 0, 10, 10), { ...ramp('rz', 0, 0, 0, 0, 0, 0), key: 'rz',
    positions: new Float32Array([3, 0, 10, 7, 0, 10, 7, 8, 20, 3, 8, 20]) }, ...room('hi', 8, 0, 20, 10, 30), ...room('ov', 8, 0, 0, 10, 10)];
  const ns = createAutomapSheet({ record: () => rec(ALL(north)), model: () => ({ rows: north }), player: () => ({ feet: [5, 0, 5], yaw: 0 }) });
  assert.deepEqual([ns.stairs()[0].dx, ns.stairs()[0].dz], [0, -1], 'world +z is paper up');
  // a stair the player has not seen is not drawn: the low room alone, the ramp not yet revealed
  const blind = createAutomapSheet({ record: () => rec(['lof']), model: () => ({ rows: STACK }), player: () => ({ feet: [5, 0, 5], yaw: 0 }) });
  assert.deepEqual(blind.stairs(), []);
  // INSIDE ONE FLOOR: drawn once, from the lower end, pointing up it, and a press does nothing
  const one = createAutomapSheet({ record: () => rec(ALL(SPLIT)), model: () => ({ rows: SPLIT }), player: () => ({ feet: [25, 8, 5], yaw: 0 }) });
  assert.equal(one.floors().length, 1);
  assert.equal(one.floor, 0, 'upstairs is the same floor of the map');
  const inside = one.stairs();
  assert.equal(inside.length, 1, 'one flight, one mark - not one from each end');
  assert.deepEqual([inside[0].cross, inside[0].up, inside[0].name, inside[0].dx], [false, true, '', 1]);
  one.paintOverlay(recordingCtx(), { view: VIEW, ...PAPER, pulse: 0 });
  const [ix, iy] = toPaper(VIEW, inside[0].x, inside[0].z);
  assert.deepEqual(one.hoverLabel(ix, iy), { label: 'Stairs up', cursor: '' });
  one.pickAt(ix, iy);
  assert.equal(one.floor, 0);
  assert.ok(one.ensure().plan.chains.length > 0);
  // the marks of one flight onto one floor are one mark
  assert.equal(STAIR_MERGE, 6);
  const twin = [...room('lo', 0, 0, 0, 10, 20), ramp('r1', 10, 20, 0, 8, 2, 4), ramp('r2', 10, 20, 0, 8, 7, 9), ...room('hi', 8, 20, 0, 30, 20), ...room('ov', 8, 0, 0, 10, 20)];
  const tw = createAutomapSheet({ record: () => rec(ALL(twin)), model: () => ({ rows: twin }), player: () => ({ feet: [5, 0, 5], yaw: 0 }) });
  assert.equal(storeyLinks(frame(twin).field).filter((l) => l.from === 0).length, 2, 'two flights to the model');
  assert.equal(tw.stairs().length, 1, 'five metres apart and bound for one floor: one mark on the plan');
  // painted: treads and a head in the wall's pen, the floor's name beyond it
  const ctx = recordingCtx();
  paintStairs(ctx, VIEW, s.stairs(), {});
  assert.ok(ctx.calls.some((c) => c.fn === 'stroke' && c.strokeStyle === PLAN_PEN.stair));
  assert.ok(ctx.calls.some((c) => c.fn === 'fillText' && c.args[0] === 'down to Floor 1' && c.fillStyle === PLAN_PEN.stair));
  const soft = recordingCtx();
  paintStairs(soft, VIEW, inside, {});
  assert.ok(soft.calls.some((c) => c.fn === 'stroke' && c.strokeStyle === PLAN_PEN.mark), 'a flight inside a floor in the soft pen');
  assert.equal(soft.calls.filter((c) => c.fn === 'fillText').length, 0, 'and unnamed');
  assert.equal(PLAN_PEN.stair, PEN.line, 'the wall\'s own pen - no colour invented');
  // a name that would land under a hand is left to the hover (EM5), and two names on one spot write one
  const muted = recordingCtx();
  const [sx, sy] = toPaper(VIEW, s.stairs()[0].x, s.stairs()[0].z);
  paintStairs(muted, VIEW, s.stairs(), { hands: [{ x0: sx - 100, x1: sx + 100, y0: sy - 100, y1: sy + 100 }] });
  assert.equal(muted.calls.filter((c) => c.fn === 'fillText').length, 0);
  const dup = recordingCtx();
  paintStairs(dup, VIEW, [s.stairs()[0], s.stairs()[0]], {});
  assert.equal(dup.calls.filter((c) => c.fn === 'fillText').length, 1);
  assert.ok(STAIR_GLYPH.label > 0);
});

test('DISC25-A A6: the strip stops above the right hand, a chevron where floors hide, and marks you, the way out and what is unseen', () => {
  const nine = Array.from({ length: 9 }, (_, i) => ({ index: i, label: `Floor ${i + 1}` }));
  const measure = (t, f) => t.length * f * 0.5;
  assert.equal(floorStripLayout(nine, 4, { paperW: 520, paperH: 400, measure }).rows.length, 9, 'no hand: all nine (under the cap)');
  const hand = { x0: 470, x1: 530, y0: 150, y1: 400 };
  const lay = floorStripLayout(nine, 4, { paperW: 520, paperH: 400, measure, hands: [hand] });
  const rowGap = lay.rows[1].y - lay.rows[0].y;
  assert.ok(lay.rows.every((r) => r.y + r.h <= hand.y0), 'every row above the thumb');
  assert.ok(lay.rows.length >= FLOOR_STRIP_MIN && lay.rows.length < 9);
  assert.ok(lay.rows[lay.rows.length - 1].y + rowGap + lay.rows[0].h > hand.y0 - FLOOR_STRIP.padY * lay.scale, 'and as many as fit');
  const top = lay.rows[0], bottom = lay.rows[lay.rows.length - 1];
  assert.equal(top.more, 1, 'a chevron up at the top');
  assert.equal(bottom.more, -1, 'and down at the bottom');
  const floorsShown = lay.rows.filter((r) => !r.more).map((r) => r.index);
  assert.ok(floorsShown.includes(4), 'the live floor is always shown');
  assert.equal(top.index, Math.max(...floorsShown) + 1, 'the chevron up leads to the next floor hidden above');
  assert.equal(bottom.index, Math.min(...floorsShown) - 1);
  assert.equal(floorStripHit(lay, top.x + top.w / 2, top.y + top.h / 2), top.index, 'a chevron is pressed like a floor');
  // a hand clear of the strip's column does not shorten it; a hand at the very top still leaves the least strip
  assert.equal(floorStripLayout(nine, 4, { paperW: 520, paperH: 400, measure, hands: [{ x0: 0, x1: 60, y0: 60, y1: 400 }] }).rows.length, 9);
  assert.equal(floorStripLayout(nine, 4, { paperW: 520, paperH: 400, measure, hands: [{ x0: 470, x1: 530, y0: 20, y1: 400 }] }).rows.length, FLOOR_STRIP_MIN);
  const squeezed = floorStripLayout(nine.slice(0, 3), 1, { paperW: 520, paperH: 400, measure, hands: [{ x0: 470, x1: 530, y0: 20, y1: 400 }] });
  assert.deepEqual(squeezed.rows.map((r) => [r.index, !!r.more]), [[2, false], [1, false], [0, false]], 'a level of three floors is shown whole, however little room');
  assert.ok(FLOOR_STRIP_MAX >= FLOOR_STRIP_MIN);
  // the marks
  const three = nine.slice(0, 3);
  const marked = floorStripLayout(three, 1, { paperW: 520, paperH: 400, measure, you: 0, exit: 2, seen: new Set([0, 1]) });
  const by = (i) => marked.rows.find((r) => r.index === i);
  assert.deepEqual([by(0).you, by(0).exit, by(0).faint], [true, false, false]);
  assert.deepEqual([by(2).you, by(2).exit, by(2).faint], [false, true, true], 'nothing revealed on Floor 3');
  assert.equal(by(1).faint, false);
  const ctx = recordingCtx();
  paintFloorStrip(ctx, marked);
  const faint = ctx.calls.filter((c) => c.fn === 'fillText' && c.args[0] === 'Floor 3');
  assert.equal(faint[0].globalAlpha, FLOOR_UNSEEN_ALPHA, 'the unseen floor is written faint');
  assert.equal(ctx.calls.filter((c) => c.fn === 'fillText' && c.args[0] === 'Floor 1')[0].globalAlpha, 1);
  assert.ok(ctx.calls.some((c) => c.fn === 'fill' && c.fillStyle === PLAN_PEN.caret), 'a caret where you stand');
  assert.ok(ctx.calls.some((c) => c.fn === 'arc') && ctx.calls.some((c) => c.fn === 'stroke' && c.strokeStyle === PLAN_PEN.beacon), 'a ring where the way out is');
  const chev = recordingCtx();
  paintFloorStrip(chev, lay);
  assert.equal(chev.calls.filter((c) => c.fn === 'fillText').length, lay.rows.filter((r) => !r.more).length, 'a chevron is ink, not a word');
  // the sheet hands the strip all of it
  const s = createAutomapSheet({ record: () => rec(['lof'], { entranceDiscovered: true }), model: () => ({ rows: STACK }), player: () => ({ feet: [5, 0, 5], yaw: 0 }), startMarker: { x: 5, y: 8, z: 5 } });
  s.paintStatic(recordingCtx(), { model: s.ensure(), view: VIEW, ...PAPER });
  const rows = s.strip.rows;
  assert.deepEqual(rows.map((r) => [r.index, !!r.you, !!r.exit, !!r.faint]), [[1, false, true, true], [0, true, false, false]]);
});

test('DISC25-A A7: the window\'s foot says the dungeon\'s keys while it is up', () => {
  assert.match(AUTOMAP_HINT, /PgUp\/PgDn floors/);
  assert.match(AUTOMAP_HINT, /click a stair to take it/);
  const s = createAutomapSheet({ record: () => rec([]), model: () => ({ rows: STACK }) });
  assert.equal(s.hint(), AUTOMAP_HINT);
  assert.equal(MAP_HINT, 'drag to pan · scroll to zoom · Esc to close', 'the bay\'s line is the line it always was');
  const hm = src('src/ui/heldMap.js');
  assert.match(hm, /if \(hint\) hint\.textContent = this\._sheet\?\.hint\?\.\(\) \?\? MAP_HINT;/);
  assert.match(hm, /this\._sheets\.get\(id\)\?\.mount\?\.\(\);\n    this\._writeHint\(\);/, 'a tab change writes it');
  assert.match(hm, /this\._sheet\?\.mount\?\.\(\);\n    this\._writeHint\(\);/, 'and so does the sheet the window opens on');
  // the window, driven: its foot is written from whatever sheet is live
  const fake = { _chrome: { hint: { textContent: '' } }, _sheet: s };
  HeldMapWindow.prototype._writeHint.call(fake);
  assert.equal(fake._chrome.hint.textContent, AUTOMAP_HINT);
  fake._sheet = { id: 'world' };
  HeldMapWindow.prototype._writeHint.call(fake);
  assert.equal(fake._chrome.hint.textContent, MAP_HINT);
});

test('DISC25-A A8: the hands a sheet keeps its words out of are the THUMBS the key found, where it found them', () => {
  // a 10x10 zone in which pixels (3..6, 5..8) were kept
  const w = 10, h = 10;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 5; y <= 8; y++) for (let x = 3; x <= 6; x++) data[(y * w + x) * 4 + 3] = 255;
  assert.deepEqual(thumbBox(data, w, h, 100, 200, 1000, 1000), { x0: 0.103, x1: 0.107, y0: 0.205, y1: 0.209 });
  assert.equal(thumbBox(new Uint8ClampedArray(w * h * 4), w, h, 0, 0, 100, 100), null, 'nothing kept: the zone stands');
  // the window: a found thumb replaces its zone, a missing one leaves the zone
  const fx = (v) => (v - SPRITE_PAPER.x0) / (SPRITE_PAPER.x1 - SPRITE_PAPER.x0);
  const fy = (v) => (v - SPRITE_PAPER.y0) / (SPRITE_PAPER.y1 - SPRITE_PAPER.y0);
  const box = { x0: 0.72, x1: 0.8, y0: 0.47, y1: 0.7 };
  const rects = HeldMapWindow.prototype._handRects.call({ _thumbBoxes: [null, box] }, 1000, 500);
  const z = THUMB_ZONES[0];
  assert.ok(Math.abs(rects[0].y0 - Math.min(1, Math.max(0, fy(z.y0))) * 500) < 1e-9, 'the left zone, unfound');
  assert.ok(Math.abs(rects[1].y0 - fy(0.47) * 500) < 1e-9, 'the right thumb where it is');
  assert.ok(Math.abs(rects[1].x0 - fx(0.72) * 1000) < 1e-9);
  assert.ok(rects[1].y0 > Math.max(0, fy(THUMB_ZONES[1].y0)) * 500, 'lower than its generous zone, so the strip has the room');
  assert.match(src('src/ui/heldMap.js'), /return thumbBox\(img\.data, zw, zh, x0, y0, w, h\);/, 'measured where the key runs');
});

test('DISC25-A A9: a note on a floor of several heights is pinned at the storey under the pointer', () => {
  const r = rec(ALL(SPLIT));
  const s = createAutomapSheet({ record: () => r, model: () => ({ rows: SPLIT }), player: () => ({ feet: [5, 0, 5], yaw: 0 }),
    askText: (initial, done) => done('here') });
  s.paintOverlay(recordingCtx(), { view: VIEW, ...PAPER, pulse: 0 });
  // plan x = world x + 1, plan y = 11 - world z
  assert.equal(s.mark((25 + 1) * 8, (11 - 5) * 8), true, 'on the upper room');
  assert.equal(s.mark((5 + 1) * 8, (11 - 5) * 8), true, 'and on the lower');
  const ys = [...r.notes.values()].map((n) => n.position[1]).sort((a, b) => a - b);
  assert.deepEqual(ys, [0 + NOTE_SPAWN_NORMAL_OFFSET, 8 + NOTE_SPAWN_NORMAL_OFFSET], 'each at its own room\'s height');
  // and both are on this floor's marks
  const marks = recordingCtx();
  s.paintOverlay(marks, { view: VIEW, ...PAPER, pulse: 0 });
  assert.equal(marks.calls.filter((c) => c.fn === 'fillText' && c.args[0] === 'here').length, 2);
  assert.equal(floorAt(deriveFloors(floorTriangles(SPLIT)), 8 + NOTE_SPAWN_NORMAL_OFFSET), 1);
});
