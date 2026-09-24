// PR-BOW1 (2026-09-24, player report: "Equipping a bow enlarges your
// character"): THE MORROWIND BODY'S SPRITE STANDS ON THE BODY, NOT ON
// ITS GEAR. The third-person body is a true-size ortho picture on an
// upright billboard quad (render/characterSprite.js drawRigSpriteBox),
// so its size on screen is set by where the quad stands - and that was
// the centre of a box over every piece the rig carried, hidden ones
// included. Weapon Sheathing's iron longsword runs y 2.9..59.5 out from
// its grip and pushed the quad a third of a metre past the body, away
// from a camera behind it: the body drew ~10% small. Its long bow is
// gripped mid-stave (-38.5..46) and moved it a few centimetres - so the
// same body read bigger with a bow than with a sword. The picture is now
// taken along the eye's ray to the actor's own axis at the body's
// mid-height and stood so that point draws on itself (the `anchor`), and
// the box is folded over the ranges the pass draws: the box is the
// window, never the size. These pins drive
// the REAL rig (createFpArm on the fixture third body, test/fixtures/mw
// /bodyRig.mjs) holding the REAL vendored meshes, through the REAL
// drawThird and drawRigSpriteBox, and route the body through the pass's
// own ortho, RT and quad onto the main camera - the chain every pixel
// of the body takes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFpArm, fpSkeletonPath, FP_CLIP_PATH, foldRangeBoxes, visibleRangeBounds, CARRIED_SLOTS } from '../src/combat/fpArm.js';
import { drawRigSpriteBox, drawCharacterSprite, landAnchor } from '../src/render/characterSprite.js';
import { MW_WEAPON_TYPE, MW_UNITS_PER_METER, meshBounds } from '../src/formats/mwFirstPerson.js';
import { HOLSTER_SLOTS } from '../src/systems/weaponSheathing.js';
import { multiply, perspective, lookAt, transformPoint, trs } from '../src/world/mat4.js';
import { bodyRec, fixtureFile as f } from './fixtures/mw/bodyRig.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const vendored = (n) => new Uint8Array(readFileSync(new URL(`../vendor/weapon-sheathing/Data Files/Meshes/w/${n}`, import.meta.url)));
const u = 1 / MW_UNITS_PER_METER;

/** a WEAP record (mwarrow.test.js's wpdt: mType at byte 8 of WPDT) */
const wpdt = (id, model, type) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  new DataView(w.buffer).setInt16(8, type, true);
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return [...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d];
};

// The hand holds the vendored Weapon Sheathing meshes (the whole _sh file:
// the scabbard rides along, which only makes the gear more one-sided).
const LONGSWORD = { templateIndex: 120 };   // -> LongBladeOneHand, "Weapon Bone"
const LONG_BOW = { templateIndex: 130 };    // -> MarksmanBow, "Weapon Bone Left" (rule 8)

/** fparm.test.js's fpFixtureBuildWithBody (bodyRig.mjs's fixtureBodyDeps), plus a longsword and a long bow */
function deps() {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')], [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')], ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/xbase_anim.nif', f('armfp.nif')], ['meshes/xbase_anim.kf', f('armfpidle.kf')],
    ['meshes/w/w_iron_longsword_sh.nif', vendored('w_iron_longsword_sh.nif')],
    ['meshes/w/w_longbow_sh.nif', vendored('w_longbow_sh.nif')],
  ]);
  const esm = f('armfp.esm');
  const extra = [bodyRec('b_fprace_m_hand', 'fixture\\armfphand.nif', 'fprace', 5), bodyRec('b_fprace_m_upperarm', 'fixture\\armfparm.nif', 'fprace', 8)];
  const all = new Uint8Array(esm.length + extra.reduce((a, r) => a + r.length, 0));
  all.set(esm, 0); let o = esm.length; for (const r of extra) { all.set(r, o); o += r.length; }
  const weap = Uint8Array.from([
    ...wpdt('iron longsword', 'w/w_iron_longsword_sh.nif', MW_WEAPON_TYPE.LongBladeOneHand),
    ...wpdt('long bow', 'w/w_longbow_sh.nif', MW_WEAPON_TYPE.MarksmanBow),
  ]);
  return {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
    loadMorrowindFile: async (n) => (n === 'weap.esm' ? weap : all),
  };
}

/** a renderer that keeps the sprite pass's last render and quad */
function capturingRenderer() {
  const cap = { sprite: null, quad: null };
  return { cap, gl: null,
    createCharacterMesh: () => ({ vao: {}, buffers: [] }),
    updateCharacterMesh: () => {},
    createCharacterTexture: (mips) => ({ mips }),
    renderCharacterSprite: (mesh, model, oproj, oview, pw, ph) => { cap.sprite = { model, oproj, oview, pw, ph }; return {}; },
    drawCharacterSpriteQuad: (tex, center, halfW, halfH, right) => { cap.quad = { center: [...center], halfW, halfH, right }; },
    drawScreenOverlayQuad: () => {},
    createParticleEffect: () => ({}),
  };
}

/** the REAL rig, built with `weapon`, in third person, drawn or sheathed, posed */
async function standBody({ weapon = null, drawn = false } = {}) {
  const renderer = capturingRenderer();
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } }));
  const res = await arm.build({ race: 'fprace', weapon, deps: deps() });
  assert.equal(res.ok, true, `${res.stage}: ${res.error}`);
  assert.ok(res.third && res.third.ok, 'the third-person body built');
  if (weapon) assert.ok(res.third.weapon, 'and the body holds the weapon');
  assert.equal(arm.setViewMode('third'), true);
  if (drawn) arm.setSheathed(false);
  for (let i = 0; i < 3; i++) arm.update(1 / 60);
  assert.equal(arm.status().weaponShown, !!(weapon && drawn), 'the stance asked for');
  return { arm, cap: renderer.cap, third: res.third };
}

const canvas = { clientWidth: 1600, clientHeight: 1000 };
const FEET = [0, 0, 0];
/** mwCamera's third-person eye: `back` units behind the focal point, looking at it `pitchDeg` down */
function cameraAt(back, pitchDeg) {
  const focal = [0, 0.05, 0];
  const d = back * u, p = pitchDeg * Math.PI / 180;
  const eye = [0, focal[1] + d * Math.sin(p), -d * Math.cos(p)];
  return { eye, view: lookAt(eye, focal, [0, 1, 0]), proj: perspective(Math.PI / 3, canvas.clientWidth / canvas.clientHeight, 0.01, 500) };
}
const ndc = (m, p) => { const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]; return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w]; };
/** drawThird once, then the body's on-screen height: a segment of the actor's own axis (MW feet to shoulder, z 0..3.2
 *  on the fixture) through the sprite's ortho -> the RT's NDC -> the quad -> the main camera */
function drawnBody({ arm, cap }, cam) {
  cap.sprite = null; cap.quad = null;
  assert.equal(arm.drawThird(canvas, { proj: cam.proj, view: cam.view, eye: cam.eye, feet: FEET, yaw: 0 }), true, 'the body draws');
  const pv = multiply(cam.proj, cam.view);
  const mini = multiply(multiply(cap.sprite.oproj, cap.sprite.oview), cap.sprite.model);
  const { center: c, halfW, halfH, right } = cap.quad;
  /** where a Morrowind-space point of the body is DRAWN in the world: its RT NDC, laid on the quad */
  const place = (mw) => { const [nx, ny] = ndc(mini, mw); return [c[0] + right[0] * halfW * nx, c[1] + halfH * ny, c[2] + right[2] * halfW * nx]; };
  const onScreen = (mw) => ndc(pv, place(mw))[1];
  return { px: (onScreen([0, 0, 3.2]) - onScreen([0, 0, 0])) * canvas.clientHeight / 2, quad: cap.quad, sprite: cap.sprite, place };
}
const near3 = (a, b, eps) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < eps;
const crossLen = (a, b) => Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) / (Math.hypot(...a) * Math.hypot(...b));

const CAMERAS = [[192, 0], [192, 20], [90, 0], [90, 20]];   // mwCamera's default reach and a close zoom, level and looking down

test('PR-BOW1: the body is the SAME size on screen bare-handed, with a longsword drawn and with a long bow drawn - the REAL drawThird holding the vendored meshes, at 192 and 90 units, level and pitched (unfixed, 192 units level: the longsword drew the body x0.88 of bare hands and the bow x1.11 of the longsword)', async () => {
  const bare = await standBody();
  const sword = await standBody({ weapon: LONGSWORD, drawn: true });
  const bow = await standBody({ weapon: LONG_BOW, drawn: true });
  assert.equal(sword.third.weapon.bone, 'Weapon Bone');
  assert.equal(bow.third.weapon.bone, 'Weapon Bone Left', 'rule 8: the bow is the one that changes hands');
  for (const [back, pitch] of CAMERAS) {
    const cam = cameraAt(back, pitch);
    const b = drawnBody(bare, cam).px, s = drawnBody(sword, cam).px, w = drawnBody(bow, cam).px;
    assert.ok(b > 1, `the body is on screen (${b} px)`);
    const at = `${back} units back, ${pitch} deg down`;
    assert.ok(Math.abs(s / b - 1) < 0.005, `${at}: the longsword leaves the body its size (x${(s / b).toFixed(4)} of bare hands)`);
    assert.ok(Math.abs(w / b - 1) < 0.005, `${at}: the long bow leaves the body its size (x${(w / b).toFixed(4)} of bare hands)`);
    assert.ok(Math.abs(w / s - 1) < 0.005, `${at}: THE REPORT - a bow does not draw the body bigger than a sword (x${(w / s).toFixed(4)})`);
  }
});

test('PR-BOW1: the picture is OF the body - taken along the eye\'s ray to the actor\'s own axis at the body\'s mid-height (the drawn ranges less CARRIED_SLOTS), that point drawn exactly on itself, and every point of the body drawn where it is drawn bare-handed, whatever the hand holds (unfixed: the gear-inclusive box centre placed the picture)', async () => {
  const SAMPLES = [[0, 0, 0], [0, 0, 3.2], [1.5, 0.5, 2], [-0.4, 1.8, 3.2]];   // feet, shoulder, off-axis points of the fixture body
  const bare = await standBody();
  for (const [weapon, drawn] of [[null, false], [LONGSWORD, true], [LONG_BOW, true], [LONGSWORD, false], [LONG_BOW, false]]) {
    const body = weapon ? await standBody({ weapon, drawn }) : bare;
    // the body's own height, off the REAL posed pieces: everything but what the actor carries
    const pieces = body.arm.built().third.arm.pieces.filter((p) => !CARRIED_SLOTS.includes(p.slot) && p.indices);
    const { minZ, maxZ } = meshBounds(pieces);
    const midZ = (minZ + maxZ) / 2;
    const axis = [FEET[0], FEET[1] + midZ * u, FEET[2]];   // race scale 1: MW z is world y, x = y = 0 is the feet
    const what = `${weapon ? (weapon === LONG_BOW ? 'bow' : 'longsword') : 'bare'} ${drawn ? 'drawn' : 'sheathed'}`;
    for (const [back, pitch] of CAMERAS) {
      const cam = cameraAt(back, pitch);
      const got = drawnBody(body, cam);
      const at = `${what}, ${back}/${pitch}`;
      // lookAt's third row is -forward
      const fwd = [-got.sprite.oview[2], -got.sprite.oview[6], -got.sprite.oview[10]];
      assert.ok(crossLen(fwd, [axis[0] - cam.eye[0], axis[1] - cam.eye[1], axis[2] - cam.eye[2]]) < 1e-5, `${at}: the picture is taken along the eye's ray to the body`);
      const landed = got.place([0, 0, midZ]);
      assert.ok(near3(landed, axis, 1e-5), `${at}: the body's axis point draws on itself (off by ${(Math.hypot(landed[0] - axis[0], landed[1] - axis[1], landed[2] - axis[2]) * 100).toFixed(2)} cm)`);
      const ref = drawnBody(bare, cam);
      for (const s of SAMPLES) {
        const a = got.place(s), b = ref.place(s);
        assert.ok(near3(a, b, 1e-4), `${at}: MW ${s} draws where bare hands draw it (off by ${(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100).toFixed(2)} cm)`);
      }
    }
  }
});

test('PR-BOW1: the sprite box is what the pass DRAWS - a sheathed (hidden) longsword or bow widens nothing, the drawn one does (unfixed: rule 57 hides by a range flag and the assembly\'s fold counted the hidden blade)', async () => {
  const cam = cameraAt(192, 20);
  const bare = drawnBody(await standBody(), cam).quad;
  for (const weapon of [LONGSWORD, LONG_BOW]) {
    const sheathed = await standBody({ weapon });
    const hidden = sheathed.arm.built().third.arm.pieces.filter((p) => p.slot === 'weapon');
    assert.ok(hidden.length > 0, 'the weapon is on the body, hidden');
    const q = drawnBody(sheathed, cam).quad;
    assert.ok(Math.abs(q.halfW - bare.halfW) < 1e-9 && Math.abs(q.halfH - bare.halfH) < 1e-9,
      `sheathed: the box is the bare body's (halfW ${q.halfW} vs ${bare.halfW}, halfH ${q.halfH} vs ${bare.halfH})`);
    const d = drawnBody(await standBody({ weapon, drawn: true }), cam).quad;
    assert.ok(d.halfW > bare.halfW * 5, `drawn: the box takes the weapon in (halfW ${d.halfW} vs ${bare.halfW})`);
  }
});

test('PR-BOW1: drawRigSpriteBox\'s anchor - the picture is taken along the eye\'s ray to the anchor, still centred on the box, and stood so the anchor draws on itself; two boxes about one anchor draw every point in ONE place; the resolution is read where the quad stands; no anchor is exactly what stood (the voxel rigs)', () => {
  const eye = [0.3, 1.9, -2.8];
  const proj = perspective(Math.PI / 3, 1.6, 0.05, 500), view = lookAt(eye, [0, 1, 0], [0, 1, 0]);
  const rec = () => { const c = {}; return { c, renderCharacterSprite: (m, model, op, ov, pw, ph) => { Object.assign(c, { op, ov, pw, ph }); return {}; }, drawCharacterSpriteQuad: (t, center, hw, hh, right) => { Object.assign(c, { center, hw, hh, right }); } }; };
  const id = trs(0, 0, 0, 0, 0, 0, 1, 1, 1);
  const place = (c, p) => { const [nx, ny] = ndc(multiply(c.op, c.ov), p); return [c.center[0] + c.right[0] * c.hw * nx, c.center[1] + c.hh * ny, c.center[2] + c.right[2] * c.hw * nx]; };
  const lookDir = (ov) => [-ov[2], -ov[6], -ov[10]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const box = { center: [0.1, 0.9, 0.4], halfW: 0.7, halfH: 0.95 };
  const anchor = [0, 0.8, 0];
  // no anchor: the quad is the box centre and the picture looks at it, as it always was
  const plain = rec();
  drawRigSpriteBox(plain, canvas, null, id, box, proj, view, eye, 3);
  assert.deepEqual(plain.c.center, box.center);
  assert.ok(crossLen(lookDir(plain.c.ov), sub(box.center, eye)) < 1e-6);
  // the voxel rig's door passes none: its quad is its box centre
  const vox = rec();
  drawCharacterSprite(vox, canvas, { scale: 1, liveBounds: { minX: -0.2, maxX: 0.6, minY: 0, maxY: 1.8, minZ: -0.1, maxZ: 0.9 }, mesh: null }, id, proj, view, eye);
  assert.deepEqual(vox.c.center, transformPoint(id, (-0.2 + 0.6) / 2, (0 + 1.8) / 2, (-0.1 + 0.9) / 2), 'drawCharacterSprite is untouched');
  // an anchor
  const a1 = rec();
  const diag = drawRigSpriteBox(a1, canvas, null, id, { ...box, anchor }, proj, view, eye, 3);
  assert.ok(crossLen(lookDir(a1.c.ov), sub(anchor, eye)) < 1e-6, 'the picture is taken along the eye\'s ray to the anchor');
  const boxInView = transformPoint(a1.c.ov, ...box.center);
  assert.ok(Math.abs(boxInView[0]) < 1e-6 && Math.abs(boxInView[1]) < 1e-6, 'and centred on the box - the gear stays in the window');
  assert.deepEqual([...a1.c.op], [...plain.c.op], 'through the same ortho');
  assert.ok(near3(place(a1.c, anchor), anchor, 1e-6), 'the anchor draws on itself');
  assert.deepEqual(diag.center, a1.c.center, 'and the diagnostics say where the quad is');
  // the box is only the window: another box about the same anchor draws every point in the same place
  const a2 = rec();
  drawRigSpriteBox(a2, canvas, null, id, { center: [-0.3, 1.2, -0.2], halfW: 1.1, halfH: 1.3, anchor }, proj, view, eye, 3);
  for (const p of [[0, 0, 0], [0, 1.8, 0], [0.3, 1.1, -0.2], [0.4, 1.2, 0.6]]) {
    assert.ok(near3(place(a1.c, p), place(a2.c, p), 1e-6), `${p} draws in one place whatever the box`);
  }
  // the resolution: read where the quad is drawn, so a texel stays `pixel` screen pixels
  const there = rec();
  drawRigSpriteBox(there, canvas, null, id, { ...box, center: a1.c.center }, proj, view, eye, 3);
  assert.equal(a1.c.ph, there.c.ph);
  assert.equal(a1.c.pw, there.c.pw);
  // an anchor AT the eye has no ray: what stood
  const atEye = rec();
  drawRigSpriteBox(atEye, canvas, null, id, { ...box, anchor: eye }, proj, view, eye, 3);
  assert.deepEqual(atEye.c.center, box.center);
});

test('PR-BOW1: landAnchor - the anchor\'s image lands on the anchor, its picture axes are lookAt\'s own, and an anchor at the box centre is the box centre', () => {
  const cases = [
    { center: [1.5, 1.2, 0.5], anchor: [1.2, 1.1, -0.4], dir: [0.1, -0.35, 0.93] },
    { center: [-2, 0.3, 4], anchor: [-2.2, 0.9, 3.1], dir: [-0.6, 0.2, -0.77] },
    { center: [0, 0.6, 0.33], anchor: [0, 0.9, 0], dir: [0, -0.5, 0.4] },   // un-normalised: drawRigSpriteBox hands over a clamped camDir
  ];
  for (const { center, anchor, dir } of cases) {
    const l = Math.hypot(...dir), n = dir.map((x) => x / l);
    const view = lookAt([center[0] - n[0] * 4, center[1] - n[1] * 4, center[2] - n[2] * 4], center, [0, 1, 0]);
    const x = [view[0], view[4], view[8]], y = [view[1], view[5], view[9]];   // lookAt's rows
    const rl = Math.hypot(n[0], n[2]);
    const right = [-n[2] / rl, 0, n[0] / rl];
    assert.ok(near3(x, right, 1e-6), 'the billboard right is the picture\'s x');
    const q = landAnchor(center, anchor, dir, right);
    const d = [anchor[0] - center[0], anchor[1] - center[1], anchor[2] - center[2]];
    const px = d[0] * x[0] + d[1] * x[1] + d[2] * x[2], py = d[0] * y[0] + d[1] * y[1] + d[2] * y[2];
    assert.ok(near3([q[0] + right[0] * px, q[1] + py, q[2] + right[2] * px], anchor, 1e-6), `the anchor lands on itself (${q})`);
    assert.deepEqual(landAnchor(center, [...center], dir, right).map((v) => +v.toFixed(12)), center.map((v) => +v.toFixed(12)), 'anchor = centre: the centre');
  }
});

test('PR-BOW1: the per-range boxes - folded over each piece\'s posed positions into ONE object a range keeps; the visible fold skips hidden ranges and the slots asked, and is null when nothing drawn has a box; CARRIED_SLOTS is the hand\'s gear and Weapon Sheathing\'s three', () => {
  const piece = (xs) => ({ positions: Float32Array.from(xs) });
  const ranges = [
    { slot: 'chest', piece: piece([-1, -2, 0, 1, 2, 10]), hidden: false },
    { slot: 'weapon', piece: piece([0, 0, 5, 0, 60, 6]), hidden: true },
    { slot: 'shield', piece: piece([-3, 0, 4, -2, 1, 5]), hidden: false },
    { slot: 'holster', piece: piece([0, -9, 7, 1, -8, 8]), hidden: false },
    { slot: 'paper', piece: null, hidden: false },
  ];
  foldRangeBoxes(ranges);
  const kept = ranges[0].box;
  assert.deepEqual({ ...kept }, { minX: -1, minY: -2, minZ: 0, maxX: 1, maxY: 2, maxZ: 10 });
  assert.equal(ranges[4].box, null, 'no positions: no box');
  ranges[0].piece.positions[5] = 12;
  foldRangeBoxes(ranges);
  assert.equal(ranges[0].box, kept, 'the range keeps its one box - a frame mints nothing');
  assert.equal(kept.maxZ, 12, 'refolded over the pose it was handed');
  const out = {};
  assert.equal(visibleRangeBounds(ranges, out), out);
  assert.deepEqual({ ...out }, { minX: -3, minY: -9, minZ: 0, maxX: 1, maxY: 2, maxZ: 12 }, 'the hidden weapon is not in it; the shown holster is');
  const body = {};
  visibleRangeBounds(ranges, body, CARRIED_SLOTS);
  assert.deepEqual({ ...body }, { minX: -3, minY: -2, minZ: 0, maxX: 1, maxY: 2, maxZ: 12 }, 'the body: the shield is worn, the holster is carried');
  for (const r of ranges) r.hidden = true;
  assert.equal(visibleRangeBounds(ranges, {}), null, 'nothing drawn: null, and drawThird stands on the assembly\'s fold');
  assert.equal(visibleRangeBounds(null, {}), null);
  assert.deepEqual([...CARRIED_SLOTS], ['weapon', 'arrow', 'torch', 'paper', ...HOLSTER_SLOTS]);
});

test('PR-BOW1: the wiring, by source - the upload folds the per-range boxes, drawThird folds only what it draws and anchors the quad, and every body reaches it: the local one in every host through mwView, the peers through PeerBodies', () => {
  const arm = rd('src/combat/fpArm.js');
  assert.match(arm, /function uploadThirdMesh\(t\) \{[\s\S]*?foldRangeBoxes\(thirdMesh\.ranges\);[\s\S]*?return thirdMesh;/, 'every upload refolds the boxes');
  const draw = arm.slice(arm.indexOf('    drawThird(canvas, { proj, view, eye, feet, yaw }) {'), arm.indexOf('    itemIcon(item,'));
  assert.match(draw, /visibleRangeBounds\(thirdMesh\.ranges, thirdDrawBox\)/, 'the box is the drawn ranges');
  assert.match(draw, /visibleRangeBounds\(thirdMesh\.ranges, thirdBodyBox, CARRIED_SLOTS\)/, 'the anchor height is the body\'s');
  assert.match(draw, /drawRigSpriteBox\(renderer, canvas, thirdMesh, model, \{ center, halfW, halfH, anchor \}/, 'and the quad is anchored');
  assert.match(rd('src/player/mwView.js'), /fpArm\.drawThird\(canvas, \{ proj, view, eye, feet, yaw \}\)/, 'the local body, every host');
  assert.match(rd('src/net/peerBodies.js'), /b\.rig\.drawThird\(canvas, \{ proj, view, eye, feet: b\.feet, yaw: b\.yaw \}\)/, 'every peer\'s body');
});
