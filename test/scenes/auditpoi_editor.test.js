// AUDIT POI (2026-10-15), LANE C - THE EDITOR'S CORE AND ITS HOST IN THE WORLD (bible/06-Systems/POI-Editor-Arc.md
// POI-3a, POI-3b). Mac: "Audit everything. Ensure perfection." Each pin below failed on the audited head (0c78d81a85):
//   - the core (src/poi/poiEdit.js): Unity's angles at a pole (E4); a saved new POI undone past its create and redone
//     (E8); an undo mid-drag (E9); a model and its new POI one step (E11); nothing edited while another is shown in its
//     place (E17);
//   - the gizmo (src/poi/poiGizmo.js): a ring seen edge on (E5); the size-all handle by the screen (E10);
//   - the host (src/scenes/poiEditorHost.js): a part placed with a light held (E6); a recentre mid-drag (E7); a pick,
//     the handles and the lines of a POI shown as another (E17); the lines in the world pass's own pixels (E18); the
//     editor's input, routed - the panel's controls (E2), what is let go (E14), the browser's own keys (E16);
//   - the world (src/scenes/world.js, by source - its boot cannot run in node): the boot's key listeners stand down
//     under the editor (E1, the bar's by behaviour: src/ui/enhanced/enhancedHotbar.js), the held keys let go (E3), on foot alone
//     (E12), 'here' on known ground (E13), leaving on a mode change, a load and a death (E14), a live POI clicked
//     opened (E15).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPoiEdit, eulerOfQuat, quatOfEuler, newPart, newLight } from '../../src/poi/poiEdit.js';
import { beginGizmoDrag, dragResult, gizmoSize, pickHandle, POI_GIZMO_PX } from '../../src/poi/poiGizmo.js';
import { createPoiEditorHost, POI_HANDLE_COLOR } from '../../src/scenes/poiEditorHost.js';
import { POI_PIXEL_M } from '../../src/poi/poiLaw.js';
import { quatRotate, quatAngleAxis } from '../../src/world/quat.js';
import { perspective, lookAt, mirrorProjectionX } from '../../src/world/mat4.js';
import { projectToScreen } from '../../src/player/tapRay.js';
import { createBindings, resetDefaults } from '../../src/systems/inputActions.js';
import { setBindings } from '../../src/ui/input.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const SHA = 'a'.repeat(64);
const counting = () => { let n = 0; return (b) => { for (let i = 0; i < b.length; i++) b[i] = (n + i) & 255; n++; return b; }; };
const near = (a, b, eps, what = '') => {
  if (Array.isArray(a)) a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= eps, `${what}[${i}] ${v} vs ${b[i]}`));
  else assert.ok(Math.abs(a - b) <= eps, `${what} ${a} vs ${b}`);
};
/** The angle between two turns (degrees), each quaternion taken at its own length. */
const turnApart = (q1, q2) => {
  const d = Math.abs(q1.reduce((s, c, i) => s + c * q2[i], 0)) / Math.hypot(...q1) / Math.hypot(...q2);
  return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI;
};
/** An event the router can stop and prevent, noting both. */
const ev = (o) => ({ ...o, stopImmediatePropagation() { this.stopped = true; }, stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } });

/** The editor in a world of one pixel (poi3_edit.test.js's): a real camera through the game's mirrored lens, a flat
 *  ground at nought; `shift` the floating origin's offset every pixel's translation carries. */
function editorWorld(over = {}) {
  const ed = createPoiEdit({ rand: counting() });
  const feed = { setOverlay() {} };
  const host = over.host ?? { pick: () => null, partOf: () => null };
  const W = 800, H = 600, fovY = Math.PI / 3, S = POI_PIXEL_M;
  const cam = { pos: [0, 10, -20], yaw: 0, pitch: Math.atan2(-10, 20) };
  const shift = [0, 0, 0];
  const frame = () => {
    const f = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    return { proj: mirrorProjectionX(perspective(fovY, W / H, 0.2, 6000)), view: lookAt(cam.pos, [cam.pos[0] + f[0], cam.pos[1] + f[1], cam.pos[2] + f[2]], [0, 1, 0]), eye: cam.pos, fovY, w: W, h: H, rect: null, canvasRect: { left: 0, top: 0 } };
  };
  const editor = createPoiEditorHost({
    edit: ed, feed, host, view: frame,
    translation: (px, py, out = [0, 0, 0]) => { out[0] = (px - 10) * S + shift[0]; out[1] = shift[1]; out[2] = -(py - 20) * S + shift[2]; return out; },
    sceneToPixel: (p) => { const px = 10 + Math.floor((p[0] - shift[0]) / S), py = 20 - Math.floor((p[2] - shift[2]) / S); return { px, py, x: p[0] - shift[0] - (px - 10) * S, z: p[2] - shift[2] + (py - 20) * S }; },
    groundHit: (o, d) => { if (!(d[1] < 0)) return { point: null, dist: Infinity }; const t = (shift[1] - o[1]) / d[1]; return { point: [o[0] + d[0] * t, shift[1], o[2] + d[2] * t], dist: t }; },
    surfaceAt: () => shift[1], actionOf: over.actionOf ?? (() => null), ...(over.deps ?? {}),
  });
  const screen = (p) => { const v = frame(); const s = projectToScreen(p, W, H, v.proj, v.view); return { clientX: s.x, clientY: s.y }; };
  return { ed, editor, cam, screen, frame, shift };
}
/** The gizmo's arm at the selection, as the host sizes it. */
function armAt(Wd) {
  const v = Wd.frame(), c = Wd.editor.pivot();
  const d = [c[0] - v.eye[0], c[1] - v.eye[1], c[2] - v.eye[2]], l = Math.hypot(...d);
  return gizmoSize(v.eye, d.map((x) => x / l), c, v.fovY, v.h);
}
/** A move drag begun on the x arrow's shaft of the selected POI. */
function grabX(Wd) {
  const c = Wd.editor.pivot(), grab = [c[0] + 0.6 * armAt(Wd), c[1], c[2]];
  Wd.editor.pointerMove(Wd.screen(grab), Wd.cam);
  assert.equal(Wd.editor.hovered(), 'x');
  Wd.editor.pointerDown({ ...Wd.screen(grab), button: 0 });
  assert.equal(Wd.editor.dragging(), true);
  return grab;
}

test('AUDIT POI E4: Unity\'s angles at a pole - a pitch of 90 typed reads back as typed whatever the yaw, and a roll typed over what is shown is the roll meant; every yaw at both poles reads back as the turn it is (mutant: the pole asked of the tidied sine; the pitch\'s sign)', () => {
  assert.deepEqual(eulerOfQuat(quatOfEuler([90, 45, 0])), [90, 45, 0], 'it read [89.9071, 0, 0]');
  for (const e of [[90, 60, 0], [90, 135, 0], [270, 90, 0], [90, 7, 0]]) {
    const shown = eulerOfQuat(quatOfEuler(e));
    assert.deepEqual(shown, e, `${e} shown as typed`);
    // the inspector commits quatOfEuler of what it SHOWS with the field typed over
    assert.ok(turnApart(quatOfEuler([shown[0], shown[1], shown[2] + 10]), quatOfEuler([e[0], e[1], e[2] + 10])) < 0.01, `a roll typed over ${e}`);
  }
  // at the pole the yaw and the roll are one turn: all of it the yaw's, the same rotation
  const q = quatOfEuler([90, 30, 20]);
  assert.equal(eulerOfQuat(q)[2], 0);
  assert.ok(turnApart(quatOfEuler(eulerOfQuat(q)), q) < 0.001);
  let worst = 0;
  for (const x of [90, 270, 89.999, 89.99, 89.9, 45, 0]) for (let y = 0; y < 360; y += 1) for (const z of [0, 15, 45]) {
    const qq = quatOfEuler([x, y, z]);
    worst = Math.max(worst, turnApart(quatOfEuler(eulerOfQuat(qq)), qq));
  }
  assert.ok(worst < 0.001, `every turn read back as itself (worst ${worst} degrees; 168 of 1,080 yaws at a pole read more than half a degree off)`);
  assert.deepEqual(eulerOfQuat(quatOfEuler([30, 40, 50])), [30, 40, 50], 'and away from the poles, as ever');
});

test('AUDIT POI E5: a ring seen edge on turns by the cursor\'s travel along its near side, the near side moving with the cursor, with the sense the same ring has a little off edge - not nought, and no half turn across the centre (mutant: the tangent unread)', () => {
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const at = (pitchDeg) => {
    const p = pitchDeg * Math.PI / 180, eye = [0, 20 * Math.sin(p), -20 * Math.cos(p)], c = [0, 0, 0];
    const vd = [-eye[0] / 20, -eye[1] / 20, -eye[2] / 20];
    const L = gizmoSize(eye, vd, c, Math.PI / 3, 600);
    const dir = (pt) => { const d = [pt[0] - eye[0], pt[1] - eye[1], pt[2] - eye[2]], n = Math.hypot(...d); return d.map((x) => x / n); };
    return { g: { mode: 'turn', c, axes, L, viewDir: vd, pxWorld: L / POI_GIZMO_PX }, eye, dir, L };
  };
  // level with the POI (the yaw ring a line on screen): grabbed at its near side, the cursor taken right and left
  const lv = at(0);
  const s = beginGizmoDrag(lv.g, 'y', lv.eye, lv.dir([0, 0, -lv.L]));
  const right = dragResult(s, lv.eye, lv.dir([lv.L * 0.4, 0, 0])).turn, left = dragResult(s, lv.eye, lv.dir([-lv.L * 0.4, 0, 0])).turn;
  near(right.deg, -0.4 * 180 / Math.PI, 0.5, 'the arc over the radius');
  near(left.deg, -right.deg, 1e-9, 'and back the other way, no flip');
  near(quatRotate(quatAngleAxis(right.deg, right.axis), [0, 0, -1])[0], Math.sin(0.4), 0.02, 'the near side carried right, with the cursor');
  // a little off edge (the ring's own plane read): the same rightward travel by the near side turns the same way
  const off = at(8);
  const s2 = beginGizmoDrag(off.g, 'y', off.eye, off.dir([0, 0, -off.L]));
  assert.ok(Math.sign(dragResult(s2, off.eye, off.dir([off.L * 0.4, 0, -off.L * 0.9])).turn.deg) === Math.sign(right.deg), 'one sense either side of the switch');
  assert.ok(Math.abs(dragResult(s, lv.eye, lv.dir([lv.L * 0.2, 0, 0]), { turn: 15 }).turn.deg) === 15, 'snapped');
});

test('AUDIT POI E6: a library part placed while one of the POI\'s lights is held stands where the click is, measured from the POI\'s own origin (mutant: measured from the held thing\'s pivot)', () => {
  for (const which of ['poi', 'light']) {
    const Wd = editorWorld();
    Wd.editor.enter();
    const id = Wd.ed.create({ px: 10, py: 20, x: 4, z: 6, name: 'Lamp' });
    Wd.ed.edit(id, 'light', (d) => { d.lights.push(newLight([5, 3, 2])); }, which === 'light' ? { id, part: null, light: 0 } : { id, part: null, light: null });
    Wd.editor.placeAsset({ name: 'Crate', parts: [{ mesh: SHA, submeshes: 1, name: 'crate' }] }, 'x');
    const at = [6, 0, 7];
    Wd.editor.pointerMove(Wd.screen(at), Wd.cam);
    Wd.editor.pointerDown({ ...Wd.screen(at), button: 0 });
    near(Wd.ed.docOf(id).parts.at(-1).t, [2, 0, 1], 0.02, `${which} held`);
  }
});

test('AUDIT POI E7: a floating-origin recentre in the middle of a drag moves nothing - the drag is read in the frame it began in (mutant: the ray read in the new frame)', () => {
  const Wd = editorWorld();
  Wd.editor.enter();
  const id = Wd.ed.create({ px: 10, py: 20, x: 4, z: 6, name: 'A' });
  const grab = grabX(Wd);
  const to = Wd.screen([grab[0] + 1, grab[1], grab[2]]);
  Wd.editor.pointerMove(to, Wd.cam);
  near(Wd.ed.docOf(id).place.x, 5, 0.02, 'a metre east');
  // the recentre: the eye and every pixel shifted by -819.2 m east, the cursor where it was on the screen
  for (const o of [[-POI_PIXEL_M, 0, 0], [0, -500, 0]]) {
    for (let a = 0; a < 3; a++) { Wd.shift[a] += o[a]; Wd.cam.pos[a] += o[a]; }
    Wd.editor.pointerMove({ ...to, clientX: to.clientX + 0.001 }, Wd.cam);
    const p = Wd.ed.docOf(id).place;
    assert.equal(p.px, 10, `still its pixel after a shift of ${o}`);
    near(p.x, 5, 0.02, 'still a metre east (it went ~819 m)');
  }
  Wd.editor.pointerUp({ ...to, button: 0 });
  near(Wd.ed.docOf(id).place.x, 5, 0.02, 'and committed there');
});

test('AUDIT POI E8: a saved new POI undone past its create and redone is still the saved one - its revision, state and saved document; a remove redone after a save keeps what was saved for its undo (mutants: the create\'s entry kept from its making; the remove\'s from its first time)', () => {
  const ed = createPoiEdit({ rand: counting() });
  const id = ed.create({ px: 10, py: 20, x: 4, z: 6, name: 'A' });
  ed.edit(id, 'add part', (d) => { d.parts.push(newPart(d, { mesh: SHA, submeshes: 1, name: 'Hut' })); });
  ed.markSaved(id, { rev: 7, state: 'draft' });
  ed.undo(); ed.undo();
  assert.equal(ed.has(id), false);
  ed.redo(); ed.redo();
  const e = ed.entryOf(id);
  assert.deepEqual([e.state, e.rev, ed.dirty(id)], ['draft', 7, false], 'it came back new, never saved - thrown away, the store\'s draft orphaned');
  // a remove undone, saved again, redone and undone: back as last saved
  const b = ed.create({ px: 11, py: 20, x: 1, z: 1, name: 'B' });
  ed.markSaved(b, { rev: 2, state: 'draft' });
  ed.remove(b);
  ed.undo();
  ed.markSaved(b, { rev: 3, state: 'submitted' });
  ed.redo(); ed.undo();
  assert.deepEqual([ed.entryOf(b).rev, ed.entryOf(b).state], [3, 'submitted']);
});

test('AUDIT POI E9: Ctrl+Z mid-drag lets the drag go and nothing more - the step before it stands, and the host is no longer dragging (mutants: the step before undone too; the host\'s drag left standing)', () => {
  const ed = createPoiEdit({ rand: counting() });
  const id = ed.create({ px: 10, py: 20, x: 4, z: 6, name: 'A' });
  ed.edit(id, 'rename', (d) => { d.name = 'Shrine'; });
  ed.begin(id, 'move');
  ed.preview((d) => { d.place.x = 9; });
  assert.equal(ed.undo(), 'move', 'the drag is what was taken back');
  assert.deepEqual([ed.docOf(id).name, ed.docOf(id).place.x, ed.dragging()], ['Shrine', 4, false]);
  assert.equal(ed.undoLabel(), 'rename');
  // the host's own: Ctrl+Z on the keyboard mid-drag
  const Wd = editorWorld();
  Wd.editor.enter();
  const a = Wd.ed.create({ px: 10, py: 20, x: 4, z: 6, name: 'A' });
  Wd.ed.edit(a, 'rename', (d) => { d.name = 'B'; });
  const grab = grabX(Wd);
  Wd.editor.pointerMove(Wd.screen([grab[0] + 2, grab[1], grab[2]]), Wd.cam);
  assert.equal(Wd.editor.keyDown({ code: 'KeyZ', ctrlKey: true }, Wd.cam), true);
  assert.equal(Wd.editor.dragging(), false, 'the host let it go too');
  assert.deepEqual([Wd.ed.docOf(a).name, Wd.ed.docOf(a).place.x], ['B', 4]);
  Wd.editor.pointerMove(Wd.screen([grab[0] + 3, grab[1], grab[2]]), Wd.cam);
  assert.equal(Wd.ed.docOf(a).place.x, 4, 'and the cursor moves nothing after');
});

test('AUDIT POI E10: the size-all handle sizes by the cursor\'s travel across the screen - an arm\'s length doubling it, the same wherever in the centre it was grabbed, right growing it and left shrinking it (mutant: the grab\'s distance over at the grab)', () => {
  const eye = [0, 0, -20], c = [0, 0, 0], viewDir = [0, 0, 1];
  const L = gizmoSize(eye, viewDir, c, Math.PI / 3, 600), px = L / POI_GIZMO_PX;
  const g = { mode: 'size', c, axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], L, viewDir, pxWorld: px };
  const dir = (pt) => { const d = [pt[0] - eye[0], pt[1] - eye[1], pt[2] - eye[2]], n = Math.hypot(...d); return d.map((x) => x / n); };
  for (const grabPx of [2, 5, 8]) {
    const grab = [grabPx * px, grabPx * px * 0.3, 0];
    assert.equal(pickHandle(g, eye, dir(grab)), 'all');
    const s = beginGizmoDrag(g, 'all', eye, dir(grab));
    near(dragResult(s, eye, dir([grab[0] + 10 * px, grab[1], 0])).size[0], 1 + 10 / POI_GIZMO_PX, 1e-6, `grabbed ${grabPx} px out, 10 px right`);
    near(dragResult(s, eye, dir([grab[0] - 10 * px, grab[1], 0])).size[0], 1 - 10 / POI_GIZMO_PX, 1e-6, '10 px left');
    near(dragResult(s, eye, dir([grab[0], grab[1] + 10 * px, 0])).size[0], 1 + 10 / POI_GIZMO_PX, 1e-6, '10 px up');
    near(dragResult(s, eye, dir([grab[0] + L, grab[1], 0])).size, [2, 2, 2], 1e-6, 'an arm right: twice the size');
  }
});

test('AUDIT POI E11: a model placed with no POI held stands in a new POI as ONE step - undone, the POI and its model go together; redone, back together (mutant: the create and the parts two steps)', () => {
  const Wd = editorWorld();
  Wd.editor.enter();
  Wd.editor.placeAsset({ name: 'Crate', parts: [{ mesh: SHA, submeshes: 1, name: 'crate' }, { mesh: SHA, submeshes: 1, name: 'lid', t: [0, 1, 0] }], lights: [{ t: [0, 2, 0], color: [1, 1, 1], radius: 4, intensity: 1, flicker: false }] }, 'New place');
  const at = [6, 0, 7];
  Wd.editor.pointerMove(Wd.screen(at), Wd.cam);
  Wd.editor.pointerDown({ ...Wd.screen(at), button: 0 });
  const id = Wd.ed.ids()[0];
  assert.deepEqual([Wd.ed.docOf(id).name, Wd.ed.docOf(id).parts.length, Wd.ed.docOf(id).lights.length], ['Crate', 2, 1]);
  assert.deepEqual(Wd.ed.selection(), { id, part: null, light: null }, 'two parts: the POI held');
  assert.equal(Wd.ed.undoLabel(), 'create');
  Wd.ed.undo();
  assert.deepEqual([Wd.ed.ids().length, Wd.ed.canUndo()], [0, false], 'one undo: nothing left to undo');
  Wd.ed.redo();
  assert.equal(Wd.ed.docOf(id).parts.length, 2);
  // one part: that part held
  const W2 = editorWorld();
  W2.editor.enter();
  W2.editor.placeAsset({ name: 'Crate', mesh: SHA, submeshes: 1 }, 'x');
  W2.editor.pointerMove(W2.screen(at), W2.cam);
  W2.editor.pointerDown({ ...W2.screen(at), button: 0 });
  const j = W2.ed.ids()[0];
  assert.deepEqual(W2.ed.selection(), { id: j, part: W2.ed.docOf(j).parts[0].key, light: null });
});

test('AUDIT POI E17: while another document is shown in a POI\'s place (the approver\'s "Show the live one"), nothing acts on its unseen working copy - no pick, no handle, no edit, no drag; shown as itself again, all of it back (mutants: the pick unasked; the gizmo offered; the edit taken)', () => {
  let picked = null;
  const Wd = editorWorld({ host: { pick: () => picked, partOf: () => null } });
  Wd.editor.enter();
  const id = Wd.ed.create({ px: 10, py: 20, x: 4, z: 6, name: 'Hall' });
  Wd.ed.edit(id, 'add part', (d) => { d.parts.push(newPart(d, { mesh: SHA, submeshes: 1, name: 'Hut' })); });
  const live = structuredClone(Wd.ed.docOf(id));
  live.name = 'Hall (live)';
  Wd.ed.select(null);
  Wd.ed.showAs(id, live);
  picked = { id, key: 'hut', dist: 5 };
  Wd.editor.pointerDown({ clientX: 400, clientY: 300, button: 0 }); Wd.editor.pointerUp({ clientX: 400, clientY: 300, button: 0 });
  assert.equal(Wd.ed.selection(), null, 'the click met the shown one: nothing taken');
  Wd.ed.select({ id, part: null });
  const handles = () => Wd.editor.lineSets().onTop.filter((l) => l.color === POI_HANDLE_COLOR.x || l.color === POI_HANDLE_COLOR.hover).length;
  assert.equal(handles(), 0, 'no handle offered');
  assert.equal(Wd.ed.edit(id, 'rename', (d) => { d.name = 'Changed unseen'; }), false);
  assert.equal(Wd.ed.begin(id, 'move'), false);
  assert.equal(Wd.ed.docOf(id).name, 'Hall', 'the working copy as it was - the verdict still closes it');
  Wd.ed.showAs(id, undefined);
  assert.ok(handles() > 0, 'shown as itself: the handles back');
  assert.equal(Wd.ed.edit(id, 'rename', (d) => { d.name = 'Hall 2'; }), true);
});

test('AUDIT POI E18: the editor\'s lines are sized in the pixels of the rect the world pass draws into, never the whole drawing buffer (mutant: the viewport unread)', () => {
  const draws = [];
  let vp = [0, 120, 800, 480];
  const pass = { draw: (_p, _v, lines, opts) => { draws.push(opts); return lines.length > 0; } };
  const Wd = editorWorld({ deps: { pass, viewport: () => vp } });
  Wd.editor.enter();
  Wd.ed.create({ px: 10, py: 20, x: 4, z: 6, name: 'A' });
  const v = Wd.frame();
  assert.equal(Wd.editor.drawLines(v.proj, v.view), true);
  assert.deepEqual(draws.map((o) => [o.onTop, o.vw, o.vh]), [[false, 800, 480], [true, 800, 480]]);
  vp = null;
  draws.length = 0;
  Wd.editor.drawLines(v.proj, v.view);
  assert.deepEqual(draws.map((o) => [o.vw, o.vh]), [[0, 0], [0, 0]], 'no rect: the pass\'s own drawing buffer');
  assert.match(src('src/scenes/world.js'), /viewport: \(\) => renderer\.worldViewportPx,   \/\/ AUDIT POI E18/, 'the world hands it the world pass\'s rect');
});

test('AUDIT POI E16: the editor acts on its own keys alone - the browser keeps every other (find, reload, zoom, Tab, back, F5), though the world hears none of them (mutants: every chord answered taken; any key answered taken)', async () => {
  const { createPoiEditorRouter } = await import('../../src/scenes/poiEditorHost.js');
  const Wd = editorWorld();
  Wd.editor.enter();
  for (const e of [{ code: 'KeyF', ctrlKey: true }, { code: 'KeyR', ctrlKey: true }, { code: 'KeyL', metaKey: true }, { code: 'Equal', ctrlKey: true }, { code: 'Tab' }, { code: 'ArrowLeft', altKey: true }, { code: 'KeyF', altKey: true }, { code: 'F5' }, { code: 'F12' }, { code: 'KeyB' }]) {
    assert.equal(Wd.editor.keyDown(e, Wd.cam), false, `${JSON.stringify(e)} is the browser's`);
  }
  for (const e of [{ code: 'KeyQ' }, { code: 'KeyE' }, { code: 'KeyX' }, { code: 'Escape' }, { code: 'KeyZ', ctrlKey: true }, { code: 'KeyS', ctrlKey: true }]) {
    assert.equal(Wd.editor.keyDown(e, Wd.cam), true, `${JSON.stringify(e)} is the editor's`);
  }
  const canvas = { setPointerCapture() {} };
  const route = createPoiEditorRouter({ editor: Wd.editor, canvas, cam: Wd.cam, acts: () => ({}), owns: () => false, overlayUp: () => false, textEntry: () => false });
  const find = ev({ type: 'keydown', code: 'KeyF', ctrlKey: true, target: canvas });
  route.onEvent(find);
  assert.deepEqual([!!find.stopped, !!find.prevented], [true, false], 'Ctrl+F: the world hears nothing, the browser finds');
  const tool = ev({ type: 'keydown', code: 'KeyW', target: canvas });
  route.onEvent(tool);
  assert.deepEqual([!!tool.stopped, !!tool.prevented], [true, true]);
  const up = ev({ type: 'keyup', code: 'KeyW', target: canvas });
  route.onEvent(up);
  assert.deepEqual([!!up.stopped, !!up.prevented], [true, false]);
});

test('AUDIT POI E2: a key at the panel\'s own controls is the editor\'s - "New POI" then Escape stops the placing, a tool clicked then E turns; a key in a typed field is the field\'s; neither reaches the world below; a window over the world keeps its own (mutants: the panel\'s keys handed down; a field\'s key acted on)', async () => {
  const { createPoiEditorRouter } = await import('../../src/scenes/poiEditorHost.js');
  const Wd = editorWorld();
  Wd.editor.enter();
  let overlay = false;
  const button = { tagName: 'BUTTON' }, field = { tagName: 'INPUT' }, canvas = {};
  const route = createPoiEditorRouter({ editor: Wd.editor, canvas, cam: Wd.cam, acts: () => ({}), owns: (t) => t === button || t === field, overlayUp: () => overlay, textEntry: (t) => t?.tagName === 'INPUT' });
  Wd.editor.placeNew('New place');
  // the window's capture listener leaves a panel target to the panel...
  const esc0 = ev({ type: 'keydown', code: 'Escape', target: button });
  route.onEvent(esc0);
  assert.equal(!!esc0.stopped, false);
  // ...and the panel's own root takes it: the editor's Escape, stopped there
  const esc = ev({ type: 'keydown', code: 'Escape', target: button });
  route.onPanelKey(esc);
  assert.equal(Wd.editor.placing(), null, 'the placing stopped (it opened the pause, the placing still armed)');
  assert.deepEqual([!!esc.stopped, !!esc.prevented], [true, true]);
  const e = ev({ type: 'keydown', code: 'KeyE', target: button });
  route.onPanelKey(e);
  assert.equal(Wd.editor.mode(), 'turn', 'E: the turn tool, never the body\'s Interact');
  assert.equal(!!e.stopped, true);
  const typed = ev({ type: 'keydown', code: 'KeyW', target: field });
  route.onPanelKey(typed);
  assert.deepEqual([Wd.editor.mode(), !!typed.stopped, !!typed.prevented], ['turn', true, false], 'a field\'s W is typed, and walks nobody');
  overlay = true;
  const under = ev({ type: 'keydown', code: 'Escape', target: button });
  route.onPanelKey(under);
  assert.equal(!!under.stopped, false, 'the map the bar opened has its Escape');
  // the world binds it on the panel's root, for both edges
  assert.match(src('src/scenes/world.js'), /for \(const ty of \['keydown', 'keyup'\]\) panel\.root\.addEventListener\(ty, route\.onPanelKey\);/);
});

test('AUDIT POI E14: a release is never gated - a button let go over a window, the pointer\'s capture lost, the window\'s blur end the drag where it stands and the look; the world gone from under the editor (a mode, a load) leaves it at the next frame or event (mutants: the pointer-up over a window lost; the blur unheard; the world\'s change unasked)', async () => {
  const { createPoiEditorRouter } = await import('../../src/scenes/poiEditorHost.js');
  let overlay = false, gone = false, left = 0;
  const Wd = editorWorld({ deps: { gone: () => gone, onGone: () => { left++; Wd.editor.exit(); } } });
  Wd.editor.enter();
  const win = {}, canvas = { setPointerCapture() {} }, other = {};
  const route = createPoiEditorRouter({ editor: Wd.editor, canvas, cam: Wd.cam, acts: () => ({}), owns: () => false, overlayUp: () => overlay, textEntry: () => false, win });
  const id = Wd.ed.create({ px: 10, py: 20, x: 4, z: 6, name: 'A' });
  for (const [why, release] of [
    ['a pointer-up under a window', () => { overlay = true; route.onEvent(ev({ type: 'pointerup', button: 0, target: other })); overlay = false; }],
    ['the capture lost', () => route.onEvent(ev({ type: 'lostpointercapture', target: canvas }))],
    ['the window blurred', () => route.onEvent(ev({ type: 'blur', target: win }))],
  ]) {
    const x0 = Wd.ed.docOf(id).place.x;
    const grab = grabX(Wd);
    Wd.editor.pointerMove(Wd.screen([grab[0] + 1, grab[1], grab[2]]), Wd.cam);
    release();
    assert.equal(Wd.editor.dragging(), false, `${why}: the drag ended`);
    near(Wd.ed.docOf(id).place.x, x0 + 1, 0.02, `${why}: kept where it stood`);
    assert.equal(Wd.ed.undoLabel(), 'move', `${why}: one step`);
  }
  // the look: flying, the window blurs - the eye stops
  Wd.editor.pointerDown({ clientX: 400, clientY: 300, button: 2 });
  route.onEvent(ev({ type: 'blur', target: other }));
  assert.equal(Wd.editor.letGo(), true, 'an element\'s blur lets nothing go (only the window\'s)');
  assert.equal(Wd.editor.letGo(), false, 'and nothing is held after');
  // the world gone from under it: the frame leaves it, and so does the next event (that event the world's)
  gone = true;
  Wd.editor.frame();
  assert.deepEqual([left, Wd.editor.active()], [1, false]);
  Wd.editor.enter();
  const key = ev({ type: 'keydown', code: 'KeyQ', target: canvas });
  route.onEvent(key);
  assert.deepEqual([left, !!key.stopped, Wd.editor.mode()], [2, false, 'move'], 'the key went to the world of the building, unread');
});

test('AUDIT POI E1: the bar\'s keys stand down while a hold stands - a digit under the editor uses nothing from the body, and reaches the UV dialog; released, the slot is pressed again (mutant: the hold unread)', async () => {
  const store = createBindings(); resetDefaults(store); setBindings(store);
  const wl = [];
  const prevDoc = globalThis.document, prevWin = globalThis.window;
  const mkEl = (tag = 'div') => ({
    tag, tagName: tag.toUpperCase(), className: '', textContent: '', id: '', children: [], dataset: {}, alt: '', draggable: true,
    get innerHTML() { return ''; }, set innerHTML(v) { this.children = []; },
    style: { setProperty() {}, removeProperty() {} },
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, toggle(c, on) { return !!on; }, contains(c) { return this._s.has(c); } },
    attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; }, removeAttribute() {}, remove() {},
    append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; }, replaceChildren(...c) { this.children = c; },
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, focus() {}, contains() { return false; },
  });
  globalThis.document = { createElement: mkEl, createTextNode: (t) => ({ text: t }), getElementById: () => null, head: mkEl('head'), body: mkEl('body'), fonts: { add() {} }, addEventListener() {}, removeEventListener() {}, pointerLockElement: null };
  globalThis.window = { addEventListener: (t, f) => wl.push({ t, f }), removeEventListener() {} };
  const { setPref, _resetForTests } = await import('../../src/systems/uiPrefs.js');
  try {
    _resetForTests();
    setPref('quickbarStyle', 'hotbar');
    const hb = await import('../../src/ui/enhanced/enhancedHotbar.js');
    hb.mountHotbarDock(mkEl('div'));
    hb.drawEnhancedHotbar(null, { paused: false });
    const send = () => { const e = ev({ type: 'keydown', code: 'Digit1', key: '1', repeat: false, target: { tagName: 'CANVAS' } }); for (const l of wl) if (l.t === 'keydown') l.f(e); return e; };
    const back = hb.holdHotbarKeys();
    assert.equal(!!send().stopped, false, 'held: the digit is not the bar\'s');
    back();
    assert.equal(!!send().stopped, true, 'released: slot 1 pressed, and no listener after it hears the digit');
  } finally {
    _resetForTests(); setBindings(null);
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    if (prevWin === undefined) delete globalThis.window; else globalThis.window = prevWin;
  }
});

test('AUDIT POI E1, E3, E12, E13, E14, E15 - THE WORLD\'S WIRING, BY SOURCE: the boot\'s cursor and walk toggles stand down under the editor and the bar is held while it is open; the held keys let go on the way in and out; on foot alone; \'here\' refused over unbuilt ground and moved off a rock; a mode change, a load and a death leave it; a live POI clicked opened (mutants: each line undone)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /bindCursorToggle\(canvas, \(\) => [^\n]*\|\| !!poiEditor\?\.active\(\), \(e\) => actionsOf\(e, keys\)\);/, 'E1: Y, Ctrl+Y and Enter no longer free the cursor over the editor');
  assert.match(w, /bindWalkMode\(\(e\) => actionsOf\(e, keys\), \(\) => [^\n]*\|\| !!poiEditor\?\.active\(\)\);/, 'E1: nor flip walk mode');
  const at = w.indexOf('  function mountPoiEditor(me, io) {'), mount = w.slice(at, w.indexOf('\n  }\n', at));
  const enter = mount.slice(mount.indexOf('    function enter() {'), mount.indexOf('    function exit(how) {'));
  const exit = mount.slice(mount.indexOf('    function exit(how) {'), mount.indexOf('    function jump() {'));
  assert.match(enter, /hotbarKeysBack = holdHotbarKeys\(\);/, 'E1: the bar held on the way in');
  assert.match(exit, /hotbarKeysBack\?\.\(\); hotbarKeysBack = null;/, 'E1: and let go on the way out');
  assert.match(mount, /const worldKeysUp = \(\) => \{ keys\.clear\(\); for \(const ring of Object\.values\(latch\.edge\)\) ring\.clear\(\); \};/, 'E3: the held set and every edge ring');
  assert.match(enter, /\n\s*worldKeysUp\(\);\n/, 'E3: on the way in');
  assert.match(exit, /\n\s*worldKeysUp\(\);   \/\/ AUDIT POI E3/, 'E3: and on the way out');
  assert.match(enter, /if \(_mode\(\) !== 'exterior' \|\| travelView\?\.active \|\| !isOnFoot\(player\.transportMode\) \|\| !!csaRuntime\?\.isSailing\?\.\(\)\) \{ townTalk\.say\(/, 'E12: a bench, a saddle and a helm refused');
  assert.match(exit, /if \(!Number\.isFinite\(below\)\) \{ panel\.say\([^\n]*\); return; \}/, 'E13: unbuilt ground refused, the editor still open');
  assert.ok(exit.indexOf('return; }') < exit.indexOf('window.removeEventListener'), 'E13: refused before anything is torn down');
  assert.match(exit, /if \(heldInSolid\(collider, landing\)\) landing = openGroundNear\(collider, landing\[0\], landing\[2\], \{ dry: \(floor\) => floor >= tvSeaY\(\) \}\) \?\? landing;/, 'E13: the teleport\'s own rock check');
  assert.match(mount, /gone: \(\) => _mode\(\) !== 'exterior' \|\| restoresSoFar\(\) !== openedAt,\n\s*onGone: \(\) => exit\('away'\),/, 'E14: a mode change or a load leaves it');
  assert.match(enter, /openedAt = restoresSoFar\(\);/, 'E14: the loads counted from each opening');
  assert.match(mount, /const route = createPoiEditorRouter\(\{ editor, canvas, cam, acts: \(\) => panel\.acts, owns: \(target\) => panel\.owns\(target\), overlayUp: \(\) => townTalk\.overlayActive, textEntry: isTextEntryTarget, win: window \}\);/);
  assert.match(enter, /for \(const ty of POI_EDITOR_EVENTS\) window\.addEventListener\(ty, onEvent, \{ capture: true, passive: false \}\);/, 'E14: the capture\'s loss and the blur heard too');
  const presenter = w.slice(w.indexOf('setDeathPresenter(() => {'), w.indexOf('setDeathPresenter(() => {') + 400);
  assert.match(presenter, /^setDeathPresenter\(\(\) => \{\n\s*poiEditorLeave\?\.\('back'\);/, 'E14: a death leaves it first');
  assert.match(mount, /poiEditorLeave = exit;/);
  assert.match(mount, /editor\.wantsOpen = \(id\) => \{ panel\.open\(id\)\.catch\(/, 'E15: a live POI clicked is opened');
});
