// EM3 - THE AUTOMAP SHEET (2026-09-21), the first sheet written to the
// held map's contract FROM THE OUTSIDE: no back-reference to the
// window, no DOM, no renderer. It is handed the reveal record and the
// reveal index and it answers a coordinate space, some ink and a
// pointer.
//
// The laws these pins hold, and why each one exists:
//
//   THE FRAME AND THE STOREY LIST ARE THE LEVEL'S; ONLY THE INK IS WHAT
//   YOU HAVE SEEN. Derive them from what has been revealed so far and
//   the map renumbers itself as the player explores - walk down a stair
//   you had not found and "Floor 1" becomes "Floor 2", and the frame
//   slides under the caret every time a room is seen.
//
//   THE SPACE IS PLAN UNITS. The held window's clamp wants a map that
//   starts at (0,0); a dungeon sits wherever its blocks were laid. One
//   conversion, at one seam, and the chains, the caret, the beacon and
//   the notes all land in it.
//
//   THE CARET, THE BEACON AND EVERY MARK BELONG TO A STOREY. A caret
//   drawn on a floor the player is not standing on is a lie the 3D map
//   could not tell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAutomapSheet, FIT_MARGIN, READABLE_SCALE } from '../src/ui/automapSheet.js';
import { isSheet, SHEET_MEMBERS } from '../src/ui/mapStrip.js';
import { deriveFloors, floorTriangles } from '../src/systems/automapFloors.js';
import { scaleMinOf, toPaper } from '../src/ui/inkMap.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: t.length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle, fillStyle: state.fillStyle, lineWidth: state.lineWidth }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}

/** A reveal-index row: a flat quad at height y over [x0,x1]x[z0,z1]. */
const row = (key, y, x0, z0, x1, z1) => ({
  key, aabb: { min: [x0, y, z0], max: [x1, y, z1] },
  positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  matrix: null,
});

/** A two-storey level: two rooms below at y 0, one room above at y 9. */
const LEVEL = [
  row('a', 0, 100, 200, 110, 210),
  row('b', 0, 110, 200, 120, 210),
  row('c', 9, 100, 200, 110, 210),
];
const model = (rows = LEVEL) => ({ rows });
const rec = (revealed = [], walked = [], extra = {}) => ({
  revealed: new Set(revealed),
  visitedThisRun: new Set(walked),
  entranceDiscovered: false,
  notes: new Map(),
  teleporters: new Map(),
  ...extra,
});
const sheet = (over = {}) => createAutomapSheet({
  record: () => rec(['a', 'b', 'c']),
  model: () => model(),
  player: () => ({ feet: [105, 0, 205], yaw: 0 }),
  startMarker: { x: 101, y: 0, z: 201 },
  title: 'Privateers Hold',
  ...over,
});
const PAPER = { paperW: 400, paperH: 300, dpr: 1 };
const env = (s, view) => ({ model: s.ensure(), view, ...PAPER, pulse: 0 });

test('EM3: the automap answers the whole sheet contract, from OUTSIDE the window', () => {
  const s = sheet();
  assert.equal(s.id, 'automap');
  assert.ok(isSheet(s), 'a member of the contract is missing');
  for (const m of SHEET_MEMBERS) assert.ok(m in s, `${m} is not even a key`);
  // and it is genuinely free of the window: no DOM, no renderer, no
  // import of heldMap. This is the whole reason EM1 built a contract.
  const text = src('src/ui/automapSheet.js')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.doesNotMatch(text, /\bdocument\b|\bglobalThis\b|heldMap|renderer/);
});

test('EM3: the FRAME and the STOREY LIST are the LEVEL\'s - exploring does not renumber the map', () => {
  const blind = sheet({ record: () => rec([]) });          // nothing revealed
  const seen = sheet({ record: () => rec(['a', 'b', 'c']) }); // everything
  // the same two storeys, whatever has been seen
  assert.equal(blind.floors().length, 2);
  assert.deepEqual(blind.floors().map((f) => f.label), ['Floor 1', 'Floor 2']);
  assert.deepEqual(seen.floors().map((f) => f.label), blind.floors().map((f) => f.label));
  assert.deepEqual(blind.floors().map((f) => f.y), seen.floors().map((f) => f.y));
  // and the same frame, so the plan does not slide under the caret
  assert.deepEqual(blind.size(), seen.size());
  // the frame is the LEVEL's own extent: two rooms wide, one deep, with
  // the rim planBounds grows for the coastline to close against
  assert.equal(seen.size().width, 22);   // 100..120 plus a cell each side
  assert.equal(seen.size().height, 12);  // 200..210 plus a cell each side
  // ...and it is derived, not declared: a bigger level is a bigger frame
  const wide = sheet({ model: () => model([...LEVEL, row('d', 0, 120, 200, 200, 210)]) });
  assert.ok(wide.size().width > seen.size().width);
});

test('EM3: the sheet\'s space is PLAN units - the chains start at the origin, not at the blocks', () => {
  const s = sheet();
  const cutd = s.ensure();
  assert.ok(cutd?.plan?.chains?.length, 'the revealed storey has a coastline');
  const xs = cutd.plan.chains.flat().map((p) => p.x);
  const ys = cutd.plan.chains.flat().map((p) => p.y);
  // the level sits at world x 100..120, z 200..210; the sheet's space
  // starts at zero, so the clamp the window already has still works
  assert.ok(Math.min(...xs) >= 0 && Math.min(...ys) >= 0, 'nothing is left of the origin');
  assert.ok(Math.max(...xs) <= s.size().width, 'nor right of the frame');
  assert.ok(Math.max(...ys) <= s.size().height);
  // and the shift is the frame's own corner, exactly once
  assert.ok(Math.min(...xs) <= 2, 'the plan is against its own left edge, not 100 units out');
});

test('EM3: only what was REVEALED is outlined, and only what was WALKED is washed', () => {
  // room a revealed and walked, room b revealed only, room c is upstairs
  const s = sheet({ record: () => rec(['a', 'b'], ['a']) });
  const c = s.ensure();
  assert.ok(c.plan.chains.length >= 1, 'both revealed rooms are outlined');
  assert.ok(c.walked?.occupancy, 'and the walked half has its own grid');
  const count = (o) => o.covered.reduce((n, v) => n + v, 0);
  assert.ok(count(c.walked.occupancy) < count(c.plan.occupancy), 'one room of two is tinted');
  // the two passes SHARE the grid, so the wash cannot leak past the wall
  assert.equal(c.walked.occupancy.w, c.plan.occupancy.w);
  assert.equal(c.walked.occupancy.x0, c.plan.occupancy.x0);
  for (let y = 0; y < c.walked.occupancy.h; y++) {
    for (let x = 0; x < c.walked.occupancy.w; x++) {
      if (c.walked.occupancy.at(x, y)) assert.ok(c.plan.occupancy.at(x, y), `the wash leaks at ${x},${y}`);
    }
  }
  // nothing revealed is a plan with no wall
  const blind = sheet({ record: () => rec([]) });
  assert.equal(blind.ensure().plan.chains.length, 0);
  // nothing walked is a plan with no tint, and not a throw
  const dry = sheet({ record: () => rec(['a', 'b']) });
  assert.equal(dry.ensure().walked, null);
});

test('EM3: INSIDE A BUILDING every revealed row is a visited row - DFU\'s always-colour law', () => {
  // AutomapModel.cs:46-72, the case the shipped 3D window keeps at
  // automapWindow.js:1222: a building has no prior-run tier at all.
  const r = () => rec(['a', 'b'], []);    // revealed, NOTHING walked this run
  const dungeon = createAutomapSheet({ record: r, model: () => model(), insideBuilding: false });
  const shop = createAutomapSheet({ record: r, model: () => model(), insideBuilding: true });
  assert.equal(dungeon.ensure().walked, null, 'underground, revealed is not walked');
  assert.ok(shop.ensure().walked?.occupancy, 'inside, it is');
  const count = (o) => o.covered.reduce((n, v) => n + v, 0);
  assert.equal(count(shop.ensure().walked.occupancy), count(shop.ensure().plan.occupancy),
    'every revealed cell is washed');
  // and the two are told apart in the static key, so one window opening
  // after the other cannot show the first one's ink
  assert.notEqual(dungeon.staticKey(), shop.staticKey());
});

test('EM3: the caret, the beacon and every mark belong to a STOREY', () => {
  const notes = new Map([[0, { position: [105, 0.7, 205], note: 'the lever' }],
    [1, { position: [105, 9.7, 205], note: 'upstairs' }]]);
  const teleporters = new Map([['t', { entrance: { pos: [108, 0, 208] }, exit: { pos: [108, 9, 208] } }]]);
  const s = sheet({
    record: () => rec(['a', 'b', 'c'], [], { entranceDiscovered: true, notes, teleporters }),
  });
  const ctx = recordingCtx();
  // ── the ground floor ──
  assert.equal(s.floor, 0);
  s.paintStatic(ctx, env(s, { ox: 0, oy: 0, scale: 8 }));
  const ground = recordingCtx();
  s.paintOverlay(ground, env(s, { ox: 0, oy: 0, scale: 8 }));
  const texts = ground.calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]);
  // DISC22-G: and the teleporter end down here names the storey its partner is on
  assert.deepEqual(texts, ['the lever', 'to Floor 2'], 'the ground note only, and where the teleporter goes');
  const arcs = ground.calls.filter((c) => c.fn === 'arc');
  assert.ok(arcs.length >= 1, 'the beacon and the teleporter end down here');
  // the player is standing on this storey, so the caret is drawn
  assert.ok(ground.calls.some((c) => c.fn === 'fill'), 'the caret is filled');

  // ── upstairs ──
  assert.equal(s.step(1), true);
  assert.equal(s.floor, 1);
  s.paintStatic(recordingCtx(), env(s, { ox: 0, oy: 0, scale: 8 }));
  const upper = recordingCtx();
  s.paintOverlay(upper, env(s, { ox: 0, oy: 0, scale: 8 }));
  assert.deepEqual(upper.calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]), ['upstairs', 'to Floor 1']);
  assert.equal(upper.calls.some((c) => c.fn === 'fill'), false,
    'the player is downstairs, so no caret is drawn up here');
  // the entrance is on the ground floor and stays there
  assert.ok(ground.calls.filter((c) => c.fn === 'arc').length > upper.calls.filter((c) => c.fn === 'arc').length);
});

test('EM3: the way in is drawn only once it has been FOUND', () => {
  const hidden = sheet({ record: () => rec(['a'], [], { entranceDiscovered: false }) });
  const found = sheet({ record: () => rec(['a'], [], { entranceDiscovered: true }) });
  const draw = (s) => { const c = recordingCtx(); s.paintOverlay(c, env(s, { ox: 0, oy: 0, scale: 8 })); return c; };
  assert.equal(draw(hidden).calls.filter((c) => c.fn === 'arc').length, 0);
  assert.ok(draw(found).calls.filter((c) => c.fn === 'arc').length >= 1);
  // ...and never at all where the host has no marker to give
  const none = sheet({ startMarker: null, record: () => rec(['a'], [], { entranceDiscovered: true }) });
  assert.equal(draw(none).calls.filter((c) => c.fn === 'arc').length, 0);
});

test('EM3: the floor strip presses through the sheet\'s own pointer, and names the storey it is over', () => {
  const s = sheet();
  const ctx = recordingCtx();
  s.paintStatic(ctx, env(s, { ox: 0, oy: 0, scale: 8 }));
  assert.ok(s.strip?.rows?.length, 'the strip is laid out on the paint');
  assert.equal(s.strip.rows.length, 2);
  const upstairs = s.strip.rows.find((r) => r.index === 1);
  const here = [upstairs.x + upstairs.w / 2, upstairs.y + upstairs.h / 2];
  // hover names it and shows a hand
  assert.deepEqual(s.hoverLabel(...here), { label: 'Floor 2', cursor: 'pointer' });
  // a click on it moves the storey
  assert.equal(s.floor, 0);
  s.pickAt(...here);
  assert.equal(s.floor, 1, 'the strip was pressed');
  // a click on the MAP does not
  s.pickAt(10, PAPER.paperH - 10);
  assert.equal(s.floor, 1);
  // and the plan is rebuilt for the new storey
  const before = s.staticKey();
  s.setFloor(0);
  assert.notEqual(s.staticKey(), before);
});

test('EM3: the storey cannot be stepped off the top or the bottom of its own level', () => {
  const s = sheet();
  assert.equal(s.floors().length, 2);
  assert.equal(s.step(-1), false, 'there is no basement');
  assert.equal(s.floor, 0);
  assert.equal(s.step(1), true);
  assert.equal(s.step(1), false, 'nor a third storey');
  assert.equal(s.floor, 1);
  assert.equal(s.setFloor(99), false);
  assert.equal(s.floor, 1);
  assert.equal(s.setFloor(-5), true);
  assert.equal(s.floor, 0);
  assert.equal(s.setFloor(0), false, 'the storey you are on is not a move');
});

test('EM3: a note under the pointer answers its own words', () => {
  const notes = new Map([[0, { position: [105, 0.7, 205], note: 'the lever is behind the throne' }]]);
  const s = sheet({ record: () => rec(['a', 'b'], [], { notes }) });
  const view = { ox: 0, oy: 0, scale: 8 };
  // before a paint there is no view to measure through, and the sheet
  // answers its own title rather than throwing
  assert.equal(s.hoverLabel(10, 10).label, 'Privateers Hold');
  s.paintStatic(recordingCtx(), env(s, view));
  s.paintOverlay(recordingCtx(), env(s, view));
  // the note sits at world (105, 205) -> plan (105 - x0, 205 - z0)
  const planX = 105 - (100 - 1), planZ = 205 - (200 - 1);
  const [nx, ny] = toPaper(view, planX, planZ);
  assert.deepEqual(s.hoverLabel(nx, ny), { label: 'the lever is behind the throne', cursor: 'pointer' });
  // a pointer well clear of it is back to the level's own name
  assert.deepEqual(s.hoverLabel(nx + 80, ny + 80), { label: 'Privateers Hold', cursor: '' });
});

test('EM3: at rest the storey is on the sheet, centred on the player where they are on it', () => {
  const s = sheet({ player: () => ({ feet: [105, 0, 207], yaw: 0 }) });   // DISC8-C: off the level's z-centre, so a mirrored plan cannot pass
  const limits = { mapW: s.size().width, mapH: s.size().height, paperW: 400, paperH: 300 };
  const home = s.homeView(limits);
  assert.ok(home.scale > scaleMinOf(limits), 'a little in from the fit, so the wall is off the torn edge');
  // DISC22-G: the fit is the REVEALED floor's (20 x 10 m here), never under READABLE_SCALE - not the level's
  const fit = FIT_MARGIN * Math.min(400 / 20, 300 / 10);
  assert.equal(home.scale, Math.max(scaleMinOf(limits), READABLE_SCALE, fit));
  // the player is at world (105, 207) on floor 0, so the view centres
  // there - the plan's y measured SOUTH from the north edge (z1 = 211)
  const planX = 105 - (100 - 1), planZ = (210 + 1) - 207;
  assert.ok(Math.abs((home.ox + limits.paperW / (2 * home.scale)) - planX) < 1e-6);
  assert.ok(Math.abs((home.oy + limits.paperH / (2 * home.scale)) - planZ) < 1e-6);
  // ...and on what has been SEEN where they are NOT on it (upstairs: room c, plan 1..11 both ways)
  s.setFloor(1);
  const away = s.homeView(limits);
  assert.ok(Math.abs((away.ox + limits.paperW / (2 * away.scale)) - 6) < 1e-6);
  assert.ok(Math.abs((away.oy + limits.paperH / (2 * away.scale)) - 6) < 1e-6);
  // ...and on the whole storey where nothing is seen and nobody stands
  const blank = sheet({ record: () => rec(['a', 'b']), player: () => ({ feet: [105, 0, 207], yaw: 0 }) });
  blank.setFloor(1);
  assert.deepEqual(blank.homeView(limits), { ox: 0, oy: 0, scale: scaleMinOf(limits) }, 'the fit, and the window clamps it to centre');
});

test('EM3: a level with no geometry is a quiet nothing, not a throw', () => {
  const empty = createAutomapSheet({ record: () => rec([]), model: () => model([]) });
  assert.deepEqual(empty.size(), { width: 1, height: 1 }, 'the clamp still has a space to work in');
  assert.equal(empty.ensure(), null);
  assert.deepEqual(empty.floors(), []);
  assert.equal(empty.step(1), false);
  assert.doesNotThrow(() => empty.paintStatic(recordingCtx(), { model: null, view: { ox: 0, oy: 0, scale: 1 }, ...PAPER }));
  assert.doesNotThrow(() => empty.paintOverlay(recordingCtx(), { view: { ox: 0, oy: 0, scale: 1 }, ...PAPER }));
  assert.doesNotThrow(() => empty.pickAt(0, 0));
  assert.ok(empty.hoverLabel(0, 0));
  assert.doesNotThrow(() => empty.mount());
  assert.doesNotThrow(() => empty.unmount());
  assert.doesNotThrow(() => empty.tick(0.1));
  // and a sheet with NO deps at all still answers every member
  const bare = createAutomapSheet();
  assert.ok(isSheet(bare));
  assert.equal(bare.ensure(), null);
  assert.doesNotThrow(() => bare.homeView({ mapW: 1, mapH: 1, paperW: 10, paperH: 10 }));
});

test('EM3: the plan is rebuilt when the reveal moves, and kept when it does not', () => {
  let revealed = ['a'];
  const s = sheet({ record: () => rec(revealed) });
  const first = s.ensure();
  assert.equal(s.ensure(), first, 'nothing moved, so the cut is kept');
  revealed = ['a', 'b'];
  const second = s.ensure();
  assert.notEqual(second, first, 'a room was revealed, so the plan is cut again');
  assert.notEqual(s.staticKey(), '');
  // the storey moving rebuilds it too
  const key = s.staticKey();
  s.setFloor(1);
  s.ensure();
  assert.notEqual(s.staticKey(), key);
  // and so does the LEVEL changing under it - a new dungeon is a new frame
  const before = s.size();
  const other = sheet({ model: () => model([row('z', 0, 0, 0, 5, 5)]) });
  assert.notDeepEqual(other.size(), before);
});

test('EM3: the storeys the sheet names are the floor model\'s own, over the whole index', () => {
  // derived, not enumerated: the sheet must not keep its own copy of
  // the floor law, or the map and the plan would disagree about which
  // storey a room is on
  const s = sheet();
  assert.deepEqual(s.floors(), deriveFloors(floorTriangles(LEVEL)));
  const text = src('src/ui/automapSheet.js');
  assert.match(text, /deriveFloors\(tris\)/, 'the storeys come from the model');
  assert.match(text, /floorAt\(f\.floors, /, 'and so does every "which storey is this on"');
  assert.doesNotMatch(text, /SLOPE_LIMIT_DEG|CAPSULE_HEIGHT|Math\.cos\(/, 'no threshold is re-typed here');
});

// ── THE TWO THINGS THE FIRST PINS FOUND ─────────────────────────────

test('EM3: the level is derived once per LEVEL, not once per frame', () => {
  // `deps.model()` is a FUNCTION and a host is free to hand back a fresh
  // wrapper each call. Keying the frame on that wrapper's identity
  // re-derived every triangle in the dungeon on every frame - the most
  // expensive thing this module can do, and invisible until something
  // counted it. The ROWS array is the reveal index's own and is built
  // once per level, so it is what actually says "a different dungeon".
  let asked = 0;
  const s = sheet({
    model: () => { asked++; return { rows: LEVEL }; },   // a NEW bag every call
    record: () => rec(['a', 'b']),
  });
  const first = s.ensure();
  const floors = s.floors();
  for (let i = 0; i < 20; i++) { s.ensure(); s.floors(); s.size(); }
  assert.ok(asked > 20, 'the host was asked every time, as it is in a real frame');
  assert.equal(s.ensure(), first, 'and the cut survived all of it');
  assert.deepEqual(s.floors(), floors);
  // a genuinely different level DOES rebuild - the law is identity of
  // the rows, not "never rebuild"
  let rows = LEVEL;
  const t = sheet({ model: () => ({ rows }), record: () => rec(['a']) });
  const before = t.size();
  rows = [row('z', 0, 0, 0, 500, 500)];
  assert.notDeepEqual(t.size(), before, 'a new index is a new frame');
});

test('EM3: the static key is the LIVE record\'s, never the cache\'s', () => {
  // The window keys its kept ink layer on this. Read off the cache, a
  // storey change (which drops the cache) made the key answer "none"
  // until the next ensure - and a key that forgets what it describes
  // shows the old storey's ink under the new storey's rule.
  const s = sheet();
  const ground = s.staticKey();
  assert.doesNotMatch(ground, /none/, 'the key says something before anything is cut');
  s.ensure();
  assert.equal(s.staticKey(), ground, 'and cutting does not change it');
  s.setFloor(1);
  const upper = s.staticKey();
  assert.notEqual(upper, ground, 'the storey moved, so the layer is stale');
  assert.doesNotMatch(upper, /none/, 'even though nothing has been cut for it yet');
  s.ensure();
  assert.equal(s.staticKey(), upper, 'and cutting still does not change it');

  // every input the plan is drawn from moves the key
  const moves = [
    ['a room revealed', () => rec(['a', 'b'])],
    ['a room walked', () => rec(['a'], ['a'])],
    ['the way in found', () => rec(['a'], [], { entranceDiscovered: true })],
    ['a note written', () => rec(['a'], [], { notes: new Map([[0, { position: [0, 0, 0], note: 'x' }]]) })],
    ['a teleporter stepped through', () => rec(['a'], [], { teleporters: new Map([['t', { entrance: { pos: [0, 0, 0] } }]]) })],
  ];
  const base = sheet({ record: () => rec(['a']) }).staticKey();
  for (const [what, r] of moves) {
    assert.notEqual(sheet({ record: r }).staticKey(), base, `${what} must restale the layer`);
  }
});
