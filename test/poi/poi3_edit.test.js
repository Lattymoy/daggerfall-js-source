// POI-3 (2026-10-14; bible/06-Systems/POI-Editor-Arc.md) - THE EDITOR'S CORE, PURE: WHAT A BUILDER CHANGES AND HOW.
// Mac: "POI Tool (General Map Editor) - Realtime editor ... a tool my developers can use without having to access the
// codebase ... No short cuts or band aids".
//   - the editing model (src/poi/poiEdit.js): Unity's Euler angles; a place renormalised across its pixel's edges; a
//     part moved, turned and sized in its POI's frame; keys and new things the law takes; every change one step, a drag
//     one step, undo and redo with the selection, the saved state compared;
//   - the gizmo (src/poi/poiGizmo.js): its size on screen, the handle a ray is over, and what a drag on each means;
//   - the words (src/poi/poiText.js): every code the law, the glTF reader, the mesh and the picture header can say has
//     its sentence;
//   - the door (src/poi/poiService.js): the draft and the asset PUT with the bearer, the reads through the client's own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createPoiEdit, eulerOfQuat, quatOfEuler, tidyQuat, mapMetresOf, placeAtMapMetres, movePlace, rotatePlace, scalePlace,
  movePart, rotatePart, scalePart, partWorldOffset, partWorldQuat, uniqueKey, lawName, newPart, newPoiDoc, newLight,
  POI_UNDO_DEPTH,
} from '../../src/poi/poiEdit.js';
import {
  gizmoSize, pickHandle, beginGizmoDrag, dragResult, gizmoShape, raySegment, POI_SNAP_DEFAULT,
} from '../../src/poi/poiGizmo.js';
import { problemText, gltfErrorText, gltfWarningText, meshErrorText, imageErrorText, problemWhere } from '../../src/poi/poiText.js';
import { poiSaveDraft, poiPutAsset, poiMe, poiSubmit, poiSha256 } from '../../src/poi/poiService.js';
import { poiDocProblems, POI_PIXEL_M } from '../../src/poi/poiLaw.js';
import { quatRotate, quatAngleAxis, quatMultiply } from '../../src/world/quat.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-6, what = '') => {
  if (Array.isArray(a)) a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= eps, `${what}[${i}] ${v} vs ${b[i]}`));
  else assert.ok(Math.abs(a - b) <= eps, `${what} ${a} vs ${b}`);
};
const SHA = 'a'.repeat(64);
/** A counter for the random bytes a new id is made of - ids every test can predict. */
const counting = () => { let n = 0; return (b) => { for (let i = 0; i < b.length; i++) b[i] = (n + i) & 255; n++; return b; }; };

test('POI-3 ANGLES: Unity\'s Euler order - Z, then X, then Y - both ways; a yaw of 90 turns forward to the right, a pitch of 90 looks down; the inspector\'s numbers come back as they went in, in [0, 360) (mutants: the order X-Y-Z; the pitch\'s sign)', () => {
  near(quatRotate(quatOfEuler([0, 90, 0]), [0, 0, 1]), [1, 0, 0], 1e-6, 'yaw 90: forward is +x');
  near(quatRotate(quatOfEuler([90, 0, 0]), [0, 0, 1]), [0, -1, 0], 1e-6, 'pitch 90: forward is down');
  near(quatRotate(quatOfEuler([0, 0, 90]), [1, 0, 0]), [0, 1, 0], 1e-6, 'roll 90: right is up');
  // the composite is Y * X * Z - the engine's order, not any other
  const e = [30, 40, 50];
  const want = quatMultiply(quatAngleAxis(40, [0, 1, 0]), quatMultiply(quatAngleAxis(30, [1, 0, 0]), quatAngleAxis(50, [0, 0, 1])));
  near(quatOfEuler(e), tidyQuat(want), 2e-6, 'Y * X * Z');
  for (const ang of [[30, 40, 50], [350, 10, 200], [0, 270, 0], [80, 120, 330], [300, 5, 5]]) {
    near(eulerOfQuat(quatOfEuler(ang)), ang, 2e-3, `round trip ${ang}`);
  }
  // straight down: the yaw and the roll are one turn, all given to the yaw - the same rotation either way
  const down = quatOfEuler([90, 30, 20]);
  near(quatRotate(quatOfEuler(eulerOfQuat(down)), [0.3, 0.5, 0.8]), quatRotate(down, [0.3, 0.5, 0.8]), 1e-4, 'gimbal lock');
  // one spelling a turn: w kept >= 0
  assert.ok(tidyQuat([0, 0, 0, -1])[3] === 1);
});

test('POI-3 THE PLACE: map metres both ways; a move over a pixel\'s east, west, north or south edge belongs to the next pixel, in its frame; the map\'s edge holds; a turn about the world\'s axis and a size clamped to the law\'s (mutants: north the wrong way; the edge not renormalised)', () => {
  const p = { px: 100, py: 200, x: 800, z: 10, y: 2, ground: 'snap', r: [0, 0, 0, 1], s: 1 };
  near(mapMetresOf(p), [100 * POI_PIXEL_M + 800, -200 * POI_PIXEL_M + 10]);
  movePlace(p, [30, 1, 0]);   // east over the edge
  assert.deepEqual([p.px, p.py], [101, 200]); near(p.x, 10.8, 1e-9); near(p.y, 3);
  movePlace(p, [0, 0, -20]);  // south over the edge: py grows (the map's rows run south)
  assert.deepEqual([p.px, p.py], [101, 201]); near(p.z, POI_PIXEL_M - 10, 1e-9);
  movePlace(p, [0, 0, 25]);   // north again
  assert.deepEqual([p.px, p.py], [101, 200]); near(p.z, 15, 1e-9);
  movePlace(p, [-20, 0, 0]);  // west
  assert.deepEqual([p.px, p.py], [100, 200]); near(p.x, POI_PIXEL_M - 9.2, 1e-9);
  // the map's own edges hold
  const corner = { px: 0, py: 0, x: 1, z: 818, y: 0, ground: 'snap', r: [0, 0, 0, 1], s: 1 };
  movePlace(corner, [-50, 0, 50]);
  assert.deepEqual([corner.px, corner.py, corner.x], [0, 0, 0]);
  assert.ok(corner.z < POI_PIXEL_M && corner.z > 819);
  // a turn about the world's +y through the origin, and a size held to 0.01 - 100
  rotatePlace(p, [0, 1, 0], 90);
  near(quatRotate(p.r, [0, 0, 1]), [1, 0, 0], 1e-6);
  scalePlace(p, 1000); assert.equal(p.s, 100);
  scalePlace(p, 1e-9); assert.equal(p.s, 0.01);
  // every number tidy: no float noise in a review's before and after
  placeAtMapMetres(p, 5 * POI_PIXEL_M + 0.1 + 0.2, -7 * POI_PIXEL_M + 3);
  assert.equal(p.x, 0.3);
});

test('POI-3 A PART: a world move, turn and size carried into its POI\'s frame - under the place\'s turn and size the part ends where the world said; its sides clamped, a negative one kept (mutants: the place\'s turn unread; the size unread)', () => {
  const place = { px: 0, py: 0, x: 10, z: 10, y: 0, ground: 'snap', r: quatOfEuler([0, 90, 0]), s: 2 };
  const part = { key: 'a', mesh: SHA, t: [1, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1] };
  const before = partWorldOffset(place, part);
  near(before, [0, 0, -2], 1e-5, 'its local +x is the world\'s -z, doubled');
  movePart(place, part, [3, 0, 0]);
  near(partWorldOffset(place, part), [3, 0, -2], 1e-4, 'moved three east in the world');
  const wq0 = partWorldQuat(place, part);
  rotatePart(place, part, [1, 0, 0], 90);
  near(partWorldQuat(place, part), tidyQuat(quatMultiply(quatAngleAxis(90, [1, 0, 0]), wq0)), 1e-5, 'turned about the world\'s x');
  scalePart(part, [2, 1e-9, -3]);
  assert.deepEqual(part.s, [2, 0.001, -3]);
  scalePart(part, [1e6, 1, 1]); assert.equal(part.s[0], 1000);
});

test('POI-3 MAKING THINGS: a key the law takes, unique in its document; a name the law takes; a new part, light and POI the law takes - a new POI\'s one want its first part (mutants: a taken key given again; the default material short)', () => {
  const doc = { parts: [{ key: 'roof' }, { key: 'roof-2' }] };
  assert.equal(uniqueKey(doc, 'Roof'), 'roof-3');
  assert.equal(uniqueKey(doc, 'Tour Été / Nord'), 'tour-ete-nord');
  assert.equal(uniqueKey(doc, '!!!'), 'part');
  assert.equal(uniqueKey(doc, '__x'), 'x');
  assert.equal(uniqueKey(doc, 'a'.repeat(60)).length, 28);
  assert.equal(lawName('  a\tb\n  c  '), 'a b c');
  const fresh = newPoiDoc({ id: 'poi-000000000001', px: 10, py: 20, x: 819.25, z: -1, name: 'Watchtower' });
  assert.deepEqual([fresh.place.px, fresh.place.py], [11, 21], 'its spot renormalised on the way in');
  assert.deepEqual(poiDocProblems(fresh).map((p) => p.code), ['parts-none']);
  fresh.parts.push(newPart(fresh, { mesh: SHA, submeshes: 3, name: 'Main hall', materials: [{ color: [1, 0, 0, 1] }] }));
  fresh.parts.push(newPart(fresh, { mesh: SHA, submeshes: 1, name: 'Main hall' }));
  fresh.lights.push(newLight());
  assert.deepEqual(poiDocProblems(fresh), []);
  assert.deepEqual(fresh.parts.map((p) => p.key), ['main-hall', 'main-hall-2']);
  assert.equal(fresh.parts[0].materials.length, 3);
  assert.deepEqual(fresh.parts[0].materials[0].color, [1, 0, 0, 1]);
  assert.equal(fresh.parts[0].materials[1].alpha, 'opaque');
});

test('POI-3 STEPS: every change one step on one stack across the set; nothing changed, no step; undo and redo carry the document and the selection; a create undone is gone, a remove undone is back as it was saved; closing takes its steps; the stack keeps its depth; saved is a comparison (mutants: a no-op pushed; the selection not restored; the redo kept after a new step)', () => {
  const ed = createPoiEdit({ rand: counting(), depth: 5 });
  const a = ed.create({ px: 1, py: 1, x: 5, z: 5, name: 'A' });
  assert.deepEqual(ed.selection(), { id: a, part: null, light: null });
  assert.equal(ed.dirty(a), true, 'never saved');
  const g0 = ed.generation();
  assert.equal(ed.edit(a, 'rename', (d) => { d.name = 'A'; }), false, 'nothing changed: no step');
  assert.equal(ed.undoLabel(), 'create');
  ed.edit(a, 'add part', (d) => { d.parts.push(newPart(d, { mesh: SHA, submeshes: 1, name: 'Hut' })); }, { id: a, part: 'hut' });
  assert.ok(ed.generation() > g0);
  assert.deepEqual(ed.selection(), { id: a, part: 'hut', light: null });
  ed.edit(a, 'rename', (d) => { d.name = 'Camp'; }, { id: a, part: null });
  assert.equal(ed.docOf(a).name, 'Camp');
  assert.equal(ed.undo(), 'rename');
  assert.equal(ed.docOf(a).name, 'A');
  assert.deepEqual(ed.selection(), { id: a, part: 'hut', light: null }, 'the selection the step found');
  assert.equal(ed.undo(), 'add part');
  assert.equal(ed.docOf(a).parts.length, 0);
  assert.equal(ed.redo(), 'add part');
  assert.equal(ed.docOf(a).parts.length, 1);
  ed.edit(a, 'size', (d) => { d.place.s = 2; });
  assert.equal(ed.canRedo(), false, 'a new step drops the redo');
  // saved is a comparison: after the service took it, unchanged is clean, any change is not, undone is clean again
  ed.markSaved(a, { rev: 1, state: 'draft' });
  assert.equal(ed.dirty(a), false);
  ed.edit(a, 'size', (d) => { d.place.s = 3; });
  assert.equal(ed.dirty(a), true);
  ed.undo();
  assert.equal(ed.dirty(a), false);
  // a remove undone: back with what it was saved as
  ed.remove(a);
  assert.equal(ed.has(a), false); assert.equal(ed.selection(), null);
  ed.undo();
  assert.equal(ed.has(a), true); assert.equal(ed.entryOf(a).rev, 1); assert.equal(ed.dirty(a), false);
  // a create undone: gone
  const b = ed.create({ px: 2, py: 2, x: 1, z: 1, name: 'B' });
  ed.undo();
  assert.equal(ed.has(b), false);
  // the depth: the oldest go first
  for (let i = 0; i < 9; i++) ed.edit(a, `n${i}`, (d) => { d.name = `N${i}`; });
  let n = 0; while (ed.undo()) n++;
  assert.equal(n, 5);
  assert.equal(ed.docOf(a).name, 'N3');
  // close takes its steps with it; the overlay is the working set
  const c = ed.create({ px: 3, py: 3, x: 1, z: 1, name: 'C' });
  ed.edit(c, 'rename', (d) => { d.name = 'C2'; });
  assert.deepEqual([...ed.overlay().keys()].sort(), [a, c].sort());
  ed.close(c);
  assert.equal(ed.undoLabel() === 'rename' && ed.has(c), false);
  assert.equal(POI_UNDO_DEPTH, 200);
});

test('POI-3 A DRAG IS ONE STEP: each preview applied to the document as the drag found it (absolute: no error gathered); commit keeps one step, a drag that moved nothing none; cancel puts it back; an edit or an undo mid-drag ends it first (mutants: previews accumulated; cancel kept the drag)', () => {
  const ed = createPoiEdit({ rand: counting() });
  const a = ed.create({ px: 1, py: 1, x: 100, z: 100, name: 'A' });
  ed.begin(a, 'move');
  for (let i = 1; i <= 30; i++) ed.preview((d) => movePlace(d.place, [i * 0.1, 0, 0]));
  near(ed.docOf(a).place.x, 103, 1e-9, 'the last preview\'s, from the start');
  assert.equal(ed.commit(), true);
  assert.equal(ed.undoLabel(), 'move');
  ed.undo();
  near(ed.docOf(a).place.x, 100, 1e-9, 'one step back undoes the whole drag');
  ed.redo();
  ed.begin(a, 'move');
  ed.preview((d) => movePlace(d.place, [5, 0, 0]));
  ed.cancel();
  near(ed.docOf(a).place.x, 103, 1e-9, 'cancelled: as the drag found it');
  ed.begin(a, 'move');
  ed.preview((d) => movePlace(d.place, [0, 0, 0]));
  assert.equal(ed.commit(), false, 'nothing moved: no step');
  ed.begin(a, 'turn');
  ed.preview((d) => rotatePlace(d.place, [0, 1, 0], 45));
  ed.edit(a, 'rename', (d) => { d.name = 'B'; });
  assert.equal(ed.undo(), 'rename'); assert.equal(ed.undo(), 'turn', 'the drag committed before the edit');
  ed.begin(a, 'move');
  ed.preview((d) => movePlace(d.place, [1, 0, 0]));
  ed.undo();
  assert.equal(ed.dragging(), false);
});

test('POI-3 GIZMO: the same size on screen at any distance; the handle a ray is over - an arrow, a plane\'s face, the centre, a ring - and none far off; a move along an axis (snapped), across a plane, an arrow pointing at the eye still dragged; a turn that carries the grab point to the cursor (snapped); a size by the grab\'s distance (mutants: the plane seen edge on; the sweep\'s sign; the factor inverted)', () => {
  const fov = Math.PI / 3, H = 1000;
  const view = [0, 0, -1];
  const L1 = gizmoSize([0, 0, 10], view, [0, 0, 0], fov, H), L2 = gizmoSize([0, 0, 20], view, [0, 0, 0], fov, H);
  near(L2 / L1, 2, 1e-9, 'twice as far, twice as large');
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const eye = [3, 4, 10];
  const dirTo = (p) => { const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]]; const l = Math.hypot(...d); return d.map((c) => c / l); };
  const vd = dirTo([0, 0, 0]);
  const L = 1, pxWorld = 0.01;
  const g = { mode: 'move', c: [0, 0, 0], axes, L, viewDir: vd, pxWorld };
  assert.equal(pickHandle(g, eye, dirTo([0.9, 0, 0])), 'x');
  assert.equal(pickHandle(g, eye, dirTo([0, 0.7, 0])), 'y');
  assert.equal(pickHandle(g, eye, dirTo([0.35, 0, 0.35])), 'xz', 'inside the plane\'s square');
  assert.equal(pickHandle(g, eye, dirTo([0, 0, 0])), 'view');
  assert.equal(pickHandle(g, eye, dirTo([5, 5, 5])), null);
  // a move along x: the cursor's ray to a point two along x and a little off it
  let s = beginGizmoDrag(g, 'x', eye, dirTo([0.9, 0, 0]));
  near(dragResult(s, eye, dirTo([2.9, 0.05, 0])).move, [2, 0, 0], 0.06);
  near(dragResult(s, eye, dirTo([2.0, 0, 0]), { move: 0.25 }).move, [1, 0, 0], 1e-9, 'snapped to the step');
  // an arrow pointing straight at the eye is not offered (nothing to read its drag on), nor a square seen edge on
  const g2 = { mode: 'move', c: [0, 0, 0], axes, L, viewDir: [0, 0, -1], pxWorld };
  const shown = gizmoShape('move', [0, 0, 0], axes, L, [0, 0, -1]).filter((h) => !h.hidden).map((h) => h.handle);
  assert.deepEqual(shown, ['x', 'y', 'xy', 'view'], 'z, yz and xz hidden end and edge on');
  assert.notEqual(pickHandle(g2, [0, 0, 10], dirToFrom([0, 0, 10], [0, 0, 0.5])), 'z');
  // ...and a steep one is: read on the plane through it that faces the eye best, the move along the axis alone
  const steep = [0, 3, 10], g3 = { mode: 'move', c: [0, 0, 0], axes, L, viewDir: dirToFrom(steep, [0, 0, 0]), pxWorld };
  s = beginGizmoDrag(g3, 'z', steep, dirToFrom(steep, [0, 0, 0.8]));
  const r = dragResult(s, steep, dirToFrom(steep, [0.02, 0, 2.8]));
  assert.ok(r && Math.abs(r.move[0]) < 1e-12 && Math.abs(r.move[1]) < 1e-12, 'along z alone');
  near(r.move[2], 2, 0.05);
  // across the xz plane
  s = beginGizmoDrag(g, 'xz', eye, dirTo([0.35, 0, 0.35]));
  near(dragResult(s, eye, dirTo([1.35, 0, -0.65])).move, [1, 0, -1], 1e-6);
  // a turn about y, grabbed on its ring and swept a radian on: the grab point carried onto the cursor
  const gt = { mode: 'turn', c: [0, 0, 0], axes, L, viewDir: dirToFrom([0, 10, 0.01], [0, 0, 0]), pxWorld };
  const top = [0, 10, 0.01], on = (a) => [Math.cos(a), 0, Math.sin(a)];
  assert.equal(pickHandle(gt, top, dirToFrom(top, on(0.6))), 'y');
  s = beginGizmoDrag(gt, 'y', top, dirToFrom(top, on(0.6)));
  const turn = dragResult(s, top, dirToFrom(top, on(1.6))).turn;
  near(quatRotate(quatAngleAxis(turn.deg, turn.axis), on(0.6)), on(1.6), 1e-3, 'the grab point follows the cursor');
  assert.equal(Math.abs(dragResult(s, top, dirToFrom(top, on(0.9)), { turn: 15 }).turn.deg), 15, 'snapped to fifteen');
  // a size along x: grabbed at the tip, dragged to twice as far
  const gs = { mode: 'size', c: [0, 0, 0], axes, L, viewDir: vd, pxWorld };
  assert.equal(pickHandle(gs, eye, dirTo([1, 0, 0])), 'x');
  s = beginGizmoDrag(gs, 'x', eye, dirTo([1, 0, 0]));
  near(dragResult(s, eye, dirTo([2, 0, 0])).size, [2, 1, 1], 1e-6);
  near(dragResult(s, eye, dirTo([1.52, 0, 0]), { size: 0.25 }).size, [1.5, 1, 1], 1e-9);
  assert.equal(pickHandle(gs, eye, dirTo([0, 0, 0])), 'all');
  // the shapes: a ring of 64 chords, an arrow's shaft and fins; the segment distance is the true nearest
  assert.equal(gizmoShape('turn', [0, 0, 0], axes, 1, vd)[0].segs.length, 64);
  near(raySegment([0, 5, 0], [0, -1, 0], [-1, 1, 0], [1, 1, 0]).dist, 0);
  near(raySegment([3, 5, 0], [0, -1, 0], [-1, 1, 0], [1, 1, 0]).dist, 2, 1e-9, 'past the segment\'s end');
  assert.deepEqual(POI_SNAP_DEFAULT, { move: 0.25, turn: 15, size: 0.1 });
});
function dirToFrom(from, p) { const d = [p[0] - from[0], p[1] - from[1], p[2] - from[2]]; const l = Math.hypot(...d); return d.map((c) => c / l); }

test('POI-3 WORDS: every code the law, the glTF reader, the mesh and the picture header can say has its own sentence - walked from their sources; a code no table knows is still said; a problem\'s place said by its part\'s name (mutants: a code unsaid; the part by its index when it has a name)', () => {
  const unknown = (s) => /Something is wrong/.test(s);
  const law = src('src/poi/poiLaw.js');
  const lawCodes = new Set([...law.matchAll(/say\([^,]+, '([a-z0-9-]+)'/g)].map((m) => m[1]).concat([...law.matchAll(/code: '([a-z0-9-]+)'/g)].map((m) => m[1])));
  assert.ok(lawCodes.size >= 40, `the walk found the law's codes (${lawCodes.size})`);
  for (const c of lawCodes) assert.ok(!unknown(problemText({ code: c, max: 1, min: 0, have: 1, want: 2, key: 'k', bytes: 1 })), `law code ${c} unsaid`);
  const gl = src('src/poi/gltfImport.js');
  for (const c of new Set([...gl.matchAll(/fail\('([a-z0-9-]+)'/g)].map((m) => m[1]))) assert.ok(!unknown(gltfErrorText(c, { ext: 'x', uri: 'y', what: 'z' })), `glTF code ${c} unsaid`);
  for (const c of new Set([...gl.matchAll(/warn\('([a-z0-9-]+)'/g)].map((m) => m[1]))) assert.ok(!unknown(gltfWarningText(c)), `glTF warning ${c} unsaid`);
  for (const c of new Set([...src('src/poi/poiImage.js').matchAll(/error: '([a-z0-9-]+)'/g)].map((m) => m[1]))) assert.ok(!unknown(imageErrorText(c)), `picture code ${c} unsaid`);
  assert.match(meshErrorText('too-many-vertices'), /262,144/);
  // PIN MOVED (AUDIT POI L8): the two a damaged file meets have words of their own; every other mesh code is a damaged model
  assert.match(meshErrorText('index-range'), /names a vertex it does not have/);
  assert.match(meshErrorText('submesh-run'), /malformed/, 'every other mesh code a damaged model');
  assert.match(problemText({ code: 'never-heard' }), /never-heard/);
  const doc = { parts: [{ key: 'a' }, { key: 'roof', name: 'Roof' }] };
  assert.equal(problemWhere('parts[1].materials[2].alpha', doc), 'Part Roof · material 3');
  assert.equal(problemWhere('parts[0].t', doc), 'Part a');
  assert.equal(problemWhere('lights[0].radius'), 'Light 1');
  assert.equal(problemWhere('place.x'), '');
});

test('POI-3 THE DOOR: a draft PUT as JSON with the bearer to the draft route; an asset hashed and PUT under its name and kind; the store\'s word kept, a network failure `offline`; the reads and acts through the account client\'s own door (mutants: the bearer left off; the asset under another name)', async () => {
  const asked = [];
  const fetch = async (url, init = {}) => {
    asked.push({ url, ...init });
    if (url.endsWith('/v1/poi/me')) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ handle: 'Mac', builder: true, approver: true }) };
    if (url.includes('/asset/')) return { ok: false, status: 429, json: async () => ({ error: 'poi-quota' }) };
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ id: 'poi-000000000001', rev: 3, state: 'draft' }) };
  };
  const io = { fetch, base: 'https://svc', secret: 's3cret' };
  const doc = { v: 1, id: 'poi-000000000001' };
  const r = await poiSaveDraft(io, doc, 2);
  assert.deepEqual(r, { ok: true, data: { id: 'poi-000000000001', rev: 3, state: 'draft' }, status: 200 });
  assert.equal(asked[0].url, 'https://svc/v1/poi/draft');
  assert.equal(asked[0].method, 'PUT');
  assert.equal(asked[0].headers.authorization, 'Bearer s3cret');
  assert.deepEqual(JSON.parse(asked[0].body), { doc, base: 2 });
  const bytes = new Uint8Array([1, 2, 3]);
  const sha = await poiSha256(bytes);
  const up = await poiPutAsset(io, bytes, 'mesh');
  assert.equal(asked[1].url, `https://svc/v1/poi/asset/${sha}?kind=mesh`);
  assert.equal(asked[1].body, bytes);
  assert.deepEqual(up, { ok: false, error: 'poi-quota', status: 429, sha });
  assert.deepEqual(await poiSaveDraft({ ...io, fetch: async () => { throw new Error('down'); } }, doc), { ok: false, error: 'offline' });
  const me = await poiMe(io);
  assert.equal(me.ok, true); assert.equal(me.data.approver, true);
  assert.equal(asked.at(-1).headers.authorization, 'Bearer s3cret');
  await poiSubmit(io, 'poi-000000000001', 3);
  assert.equal(asked.at(-1).method, 'POST'); assert.deepEqual(JSON.parse(asked.at(-1).body), { id: 'poi-000000000001', rev: 3 });
  assert.match(src('src/poi/poiService.js'), /import \{ call \} from '\.\.\/net\/accountClient\.js';/);
});

// ── THE PASS AND THE HOST IN THE WORLD ─────────────────────────────
import { packLines, PoiGizmoPass, POI_LINES_FS } from '../../src/render/poiGizmoPass.js';
import { createPoiEditorHost, boxLines, POI_HANDLE_COLOR } from '../../src/scenes/poiEditorHost.js';
import { perspective, lookAt, mirrorProjectionX } from '../../src/world/mat4.js';
import { projectToScreen } from '../../src/player/tapRay.js';

/** A GL that records every call (constants named by themselves). */
function recordingGl() {
  const log = [];
  const gl = new Proxy({}, {
    get(_, k) {
      if (typeof k !== 'string') return undefined;
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'drawingBufferWidth') return 800;
      if (k === 'drawingBufferHeight') return 600;
      if (k.startsWith('create')) return () => ({});
      if (k.toUpperCase() === k) return k;
      return (...a) => { log.push([k, ...a]); };
    },
  });
  return { gl, log };
}

test('POI-3 THE LINES\' PASS: a segment a quad of six vertices, each its ends, side, end and colour; the buffer reused while it is large enough; a batch on top drawn untested, one in the world tested, neither writing depth, blended, and every bit of state put back; the edges feathered (mutants: the depth test left off; the depth mask left off)', () => {
  const lines = [{ a: [1, 2, 3], b: [4, 5, 6], color: [1, 0, 0, 0.5] }];
  const { data, count } = packLines(lines);
  assert.equal(count, 6);
  assert.deepEqual([...data.slice(0, 12)], [1, 2, 3, 4, 5, 6, -1, 0, 1, 0, 0, 0.5]);
  assert.deepEqual([...data.slice(12 * 2, 12 * 2 + 8)], [1, 2, 3, 4, 5, 6, 1, 1], 'the third: the far end\'s other side');
  assert.equal(packLines(lines, data).data, data, 'reused');
  const { gl, log } = recordingGl();
  const pass = new PoiGizmoPass(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  log.length = 0;
  assert.equal(pass.draw(I, I, lines, { onTop: true }), true);
  const names = log.map((c) => `${c[0]}${c[1] !== undefined && typeof c[1] === 'string' ? ` ${c[1]}` : c[1] === false || c[1] === true ? ` ${c[1]}` : ''}`);
  const at = (n) => names.indexOf(n), last = (n) => names.lastIndexOf(n);
  assert.ok(at('disable DEPTH_TEST') >= 0 && at('disable DEPTH_TEST') < at('drawArrays TRIANGLES'), 'on top: untested');
  assert.ok(at('depthMask false') < at('drawArrays TRIANGLES') && last('depthMask true') > at('drawArrays TRIANGLES'), 'no depth written, the mask put back');
  assert.ok(last('enable DEPTH_TEST') > at('drawArrays TRIANGLES'), 'the test put back');
  assert.ok(last('disable BLEND') > at('drawArrays TRIANGLES') && last('enable CULL_FACE') > at('drawArrays TRIANGLES'));
  log.length = 0;
  pass.draw(I, I, lines, { onTop: false });
  const names2 = log.map((c) => `${c[0]} ${c[1]}`);
  assert.ok(names2.indexOf('enable DEPTH_TEST') < names2.indexOf('drawArrays TRIANGLES'), 'in the world: tested');
  assert.equal(pass.draw(I, I, []), false, 'nothing to draw: nothing drawn');
  assert.match(POI_LINES_FS, /const float FEATHER/);
  assert.equal(boxLines([0, 0, 0, 1, 1, 1], [1, 1, 1, 1]).length, 12);
});

/** The registry's default actions for the keys a test presses (systems/inputActions.js DEFAULT_BINDINGS), and a rebind. */
const BOUND = (e) => ({ KeyW: 'MoveForwards', KeyS: 'MoveBackwards', KeyA: 'MoveLeft', KeyD: 'MoveRight', Space: 'Jump', ShiftLeft: 'Run', KeyI: 'MoveForwards' })[e.code] ?? null;
/** The editor in a world of one pixel: a real camera (the game's mirrored lens), a flat ground at nought. */
function editorWorld() {
  const ed = createPoiEdit({ rand: counting() });
  const overlays = [];
  const feed = { setOverlay: (m) => overlays.push(m) };
  const boxes = new Map();
  const host = { pick: () => null, partOf: (id, key) => (boxes.has(`${id}:${key}`) ? { box: boxes.get(`${id}:${key}`) } : null) };
  const W = 800, Hh = 600, fovY = Math.PI / 3;
  const cam = { pos: [0, 10, -20], yaw: 0, pitch: Math.atan2(-10, 20) };
  const frame = () => {
    const f = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    return { proj: mirrorProjectionX(perspective(fovY, W / Hh, 0.2, 6000)), view: lookAt(cam.pos, [cam.pos[0] + f[0], cam.pos[1] + f[1], cam.pos[2] + f[2]], [0, 1, 0]), eye: cam.pos, fovY, w: W, h: Hh, rect: null, canvasRect: { left: 0, top: 0 } };
  };
  const S = POI_PIXEL_M;
  const editor = createPoiEditorHost({
    edit: ed, feed, host, view: frame,
    translation: (px, py, out = [0, 0, 0]) => { out[0] = (px - 10) * S; out[1] = 0; out[2] = -(py - 20) * S; return out; },
    sceneToPixel: (p) => { const px = 10 + Math.floor(p[0] / S), py = 20 - Math.floor(p[2] / S); return { px, py, x: p[0] - (px - 10) * S, z: p[2] + (py - 20) * S }; },
    groundHit: (o, d) => { if (!(d[1] < 0)) return { point: null, dist: Infinity }; const t = -o[1] / d[1]; return { point: [o[0] + d[0] * t, 0, o[2] + d[2] * t], dist: t }; },
    surfaceAt: () => 0, actionOf: BOUND,
  });
  const screen = (p) => { const v = frame(); const s = projectToScreen(p, W, Hh, v.proj, v.view); return { clientX: s.x, clientY: s.y }; };
  return { ed, editor, cam, screen, overlays, boxes, frame };
}

test('POI-3 THE EDITOR IN THE WORLD: a new POI stood where the click meets the ground; the arrow under the cursor lit, dragged along its axis through the game\'s own lens - one step, undone whole, snapped while Ctrl is held, let go by Escape; the drafts laid over the live set once a change (mutants: the drag not one step; the snap unread; the overlay laid every frame)', () => {
  const W = editorWorld();
  W.editor.enter();
  // place a new POI at the ground under a point four metres east of the origin
  W.editor.placeNew('Shrine');
  W.editor.pointerMove(W.screen([4, 0, 6]), W.cam);
  W.editor.pointerDown({ ...W.screen([4, 0, 6]), button: 0 });
  const id = W.ed.ids()[0];
  const doc = W.ed.docOf(id);
  assert.equal(doc.name, 'Shrine');
  assert.deepEqual([doc.place.px, doc.place.py], [10, 20], 'the pixel whose south-west corner is the origin: x 4, z 6 inside it');
  near([doc.place.x, doc.place.z], [4, 6], 0.02);
  assert.deepEqual(W.ed.selection(), { id, part: null, light: null });
  // the overlay: laid once for the change, not again for a frame that changed nothing
  W.editor.frame(); W.editor.frame();
  assert.equal(W.overlays.length, 1);
  assert.ok(W.overlays[0].has(id));
  // the x arrow's shaft under the cursor: lit
  const shaft = [4 + 0.6 * pivotArm(W), 0, 6];
  W.editor.pointerMove(W.screen(shaft), W.cam);
  assert.equal(W.editor.hovered(), 'x');
  W.editor.pointerDown({ ...W.screen(shaft), button: 0 });
  assert.equal(W.editor.dragging(), true);
  for (let k = 1; k <= 10; k++) W.editor.pointerMove(W.screen([shaft[0] + 0.3 * k, 0, 6]), W.cam);
  W.editor.pointerUp({ ...W.screen([shaft[0] + 3, 0, 6]), button: 0 });
  near(W.ed.docOf(id).place.x, 7, 0.05, 'three metres east');
  near(W.ed.docOf(id).place.z, 6, 1e-6, 'and nothing else');
  assert.equal(W.ed.undoLabel(), 'move');
  W.ed.undo();
  near(W.ed.docOf(id).place.x, 4, 0.02, 'the whole drag one step');
  // snapped while Ctrl is held: a quarter metre's multiple
  W.editor.pointerMove(W.screen(shaft), W.cam);
  W.editor.pointerDown({ ...W.screen(shaft), button: 0 });
  W.editor.pointerMove({ ...W.screen([shaft[0] + 1.13, 0, 6]), ctrlKey: true }, W.cam);
  W.editor.pointerUp({ ...W.screen([shaft[0] + 1.13, 0, 6]), button: 0 });
  const moved = W.ed.docOf(id).place.x - near4(W);
  assert.ok(Math.abs(moved / 0.25 - Math.round(moved / 0.25)) < 1e-6, `snapped (${moved})`);
  // Escape mid-drag lets it go
  const before = W.ed.docOf(id).place.x;
  W.editor.pointerMove(W.screen([before + 0.6 * pivotArm(W), 0, 6]), W.cam);
  W.editor.pointerDown({ ...W.screen([before + 0.6 * pivotArm(W), 0, 6]), button: 0 });
  W.editor.pointerMove(W.screen([before + 3, 0, 6]), W.cam);
  W.editor.keyDown({ code: 'Escape' }, W.cam);
  near(W.ed.docOf(id).place.x, before, 1e-9);
  assert.equal(W.editor.dragging(), false);
});
/** The gizmo's arm at the selection, as the host sizes it. */
function pivotArm(W) {
  const v = W.frame(), c = W.editor.pivot();
  const d = [c[0] - v.eye[0], c[1] - v.eye[1], c[2] - v.eye[2]], l = Math.hypot(...d);
  return gizmoSize(v.eye, d.map((x) => x / l), c, v.fovY, v.h);
}
const near4 = (W) => { W.ed.undo(); const x = W.ed.docOf(W.ed.ids()[0]).place.x; W.ed.redo(); return x; };

test('POI-3 THE EDITOR\'S CLICKS, KEYS AND EYE: a click on a POI takes it, the next on it its part, on nothing lets go; Q W E R the tools, X the space, Ctrl+Z the undo; with the right button held the keys fly the eye along its look at its speed, the wheel its speed; the selection\'s boxes in the world and over it (mutants: the part taken first; the keys heard while flying)', () => {
  const W = editorWorld();
  W.editor.enter();
  const id = W.ed.create({ px: 10, py: 19, x: 4, z: 6, name: 'A' });
  W.ed.edit(id, 'add', (d) => { d.parts.push(newPart(d, { mesh: SHA, submeshes: 1, name: 'Hut' })); });
  W.ed.select(null);
  // a host whose pick finds the hut: a fresh editor over the same edit model
  const pickEd = createPoiEditorHost({ actionOf: BOUND, edit: W.ed, feed: { setOverlay() {} }, host: { pick: () => ({ id, key: 'hut', dist: 5 }), partOf: () => ({ box: [3, 0, 5, 5, 2, 7] }) }, view: W.frame, translation: (px, py, o = [0, 0, 0]) => { o[0] = (px - 10) * POI_PIXEL_M; o[1] = 0; o[2] = -(py - 20) * POI_PIXEL_M; return o; }, sceneToPixel: () => null, groundHit: () => ({ point: null, dist: Infinity }), surfaceAt: () => 0 });
  pickEd.enter();
  const click = (x = 400, y = 300) => { pickEd.pointerDown({ clientX: x, clientY: y, button: 0 }); pickEd.pointerUp({ clientX: x, clientY: y, button: 0 }); };
  pickEd.setMode('select');
  click();
  assert.deepEqual(W.ed.selection(), { id, part: null, light: null }, 'the POI first');
  click();
  assert.deepEqual(W.ed.selection(), { id, part: 'hut', light: null }, 'then its part');
  const { inWorld, onTop } = pickEd.lineSets();
  assert.equal(inWorld.length, 12, 'the part\'s box where it stands');
  assert.ok(onTop.length >= 12);
  const missEd = createPoiEditorHost({ edit: W.ed, feed: { setOverlay() {} }, host: { pick: () => null, partOf: () => null }, view: W.frame, translation: (px, py, o = [0, 0, 0]) => o, sceneToPixel: () => null, groundHit: () => ({ point: null, dist: Infinity }), surfaceAt: () => 0 });
  missEd.enter();
  missEd.setMode('select');
  missEd.pointerDown({ clientX: 10, clientY: 10, button: 0 }); missEd.pointerUp({ clientX: 10, clientY: 10, button: 0 });
  assert.equal(W.ed.selection(), null, 'nothing under it: let go');
  // the tools and the space by their keys
  for (const [code, m] of [['KeyQ', 'select'], ['KeyW', 'move'], ['KeyE', 'turn'], ['KeyR', 'size']]) { pickEd.keyDown({ code }, W.cam); assert.equal(pickEd.mode(), m); }
  pickEd.keyDown({ code: 'KeyX' }, W.cam); assert.equal(pickEd.space(), 'local');
  W.ed.edit(id, 'rename', (d) => { d.name = 'B'; });
  pickEd.keyDown({ code: 'KeyZ', ctrlKey: true }, W.cam);
  assert.equal(W.ed.docOf(id).name, 'A');
  // the eye: the right button held, W flies along the look at the speed
  const start = [...W.cam.pos];
  pickEd.pointerDown({ clientX: 400, clientY: 300, button: 2 });
  pickEd.keyDown({ code: 'KeyW' }, W.cam);
  assert.equal(pickEd.mode(), 'size', 'a key held for flight is no tool');
  pickEd.keyUp({ code: 'KeyW' });
  pickEd.keyDown({ code: 'KeyI' }, W.cam);   // the builder's own binding for forwards: the registry's action, never the raw key
  pickEd.cameraFrame(0.5, W.cam);
  const f = [Math.sin(W.cam.yaw) * Math.cos(W.cam.pitch), Math.sin(W.cam.pitch), Math.cos(W.cam.yaw) * Math.cos(W.cam.pitch)];
  near(W.cam.pos, start.map((c, i) => c + f[i] * pickEd.eyeSpeed() * 0.5), 1e-9);
  const sp = pickEd.eyeSpeed();
  pickEd.wheel({ deltaY: -1 }, W.cam);
  near(pickEd.eyeSpeed(), sp * 1.25, 1e-9);
  pickEd.pointerUp({ clientX: 400, clientY: 300, button: 2 });
  pickEd.cameraFrame(0.5, W.cam);
  const here = [...W.cam.pos];
  pickEd.cameraFrame(0.5, W.cam);
  assert.deepEqual(W.cam.pos, here, 'the button let go: the eye still');
  pickEd.exit();
  assert.equal(pickEd.active(), false);
  assert.equal(pickEd.keyDown({ code: 'KeyW' }, W.cam), false, 'closed: it hears nothing');
});

test('POI-3 A LIGHT HELD: its pivot where it shines from, under its POI\'s turn and size; the move handle alone (a light has no turn or size); a drag moves the light in its POI\'s frame and never the POI; every light of the POI marked, the one held lit (mutants: the drag moves the POI; a turn offered)', () => {
  const W = editorWorld();
  W.editor.enter();
  const id = W.ed.create({ px: 10, py: 20, x: 4, z: 6, name: 'Lamp' });
  W.ed.edit(id, 'light', (d) => { d.place.s = 2; d.place.r = quatOfEuler([0, 90, 0]); d.lights.push(newLight([1, 1, 0])); }, { id, part: null, light: 0 });
  near(W.editor.pivot(), [4, 2, 4], 1e-4, 'its local +x the world\'s -z, doubled; its height doubled');
  W.editor.setMode('turn');
  assert.equal(W.editor.lineSets().onTop.filter((l) => l.color === POI_HANDLE_COLOR_HOVER()).length, 3, 'the light\'s own star lit');
  assert.equal(W.editor.lineSets().onTop.length, 3, 'and nothing else: no ring offered for a light');
  W.editor.setMode('move');
  const c = W.editor.pivot();
  const arm = (() => { const v = W.frame(); const d = [c[0] - v.eye[0], c[1] - v.eye[1], c[2] - v.eye[2]], l = Math.hypot(...d); return gizmoSize(v.eye, d.map((x) => x / l), c, v.fovY, v.h); })();
  const grab = [c[0] + 0.6 * arm, c[1], c[2]];
  W.editor.pointerMove(W.screen(grab), W.cam);
  assert.equal(W.editor.hovered(), 'x');
  W.editor.pointerDown({ ...W.screen(grab), button: 0 });
  W.editor.pointerMove(W.screen([grab[0] + 2, grab[1], grab[2]]), W.cam);
  W.editor.pointerUp({ ...W.screen([grab[0] + 2, grab[1], grab[2]]), button: 0 });
  const d = W.ed.docOf(id);
  assert.deepEqual([d.place.x, d.place.z], [4, 6], 'the POI where it stood');
  near(W.editor.pivot(), [6, 2, 4], 0.05, 'the light two metres east');
  near(d.lights[0].t, [1, 1, 1], 0.03, 'in its POI\'s frame: the world\'s east its +z (a yaw of 90), halved by its size');
});
const POI_HANDLE_COLOR_HOVER = () => POI_HANDLE_COLOR.hover;
