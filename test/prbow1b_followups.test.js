// PR-BOW1b (2026-09-24): PR-BOW1's three follow-ups, from the review that
// shipped it ("Equipping a bow enlarges your character").
//
// (1) THE SECOND WALK. PR-BOW1 folded a box per drawn range by walking
// every posed vertex of the third-person body AGAIN (foldRangeBoxes), on
// every posed frame, for every body - the local player's and each peer's
// - right after poseAssembly had walked every one of them for the
// assembly's bounds. AUDIT MWBODY A4 removed exactly that kind of repeated
// walk. The per-piece boxes are now folded INSIDE poseAssembly's own walk
// (mwFirstPerson.js foldPieceBounds) and a range copies its piece's six
// numbers.
//
// (2) THE PORTRAIT. fpArm.figure() (the enhanced inventory's model figure)
// framed a box over EVERY piece, then hid the unlit torch, the arrow off
// the string and the empty holster twin - so gear it does not show still
// moved the frame - at that box's azimuth-safe width, so a held longsword
// or bow widened the picture past its 110:184 cell and object-fit shrank
// the body in it. The body now sets the scale and what is drawn only
// reaches (portraitWindow): the held item is drawn and never clipped.
//
// The stand-in: bodyRig.mjs's fixture rig with its upper-arm BODY part
// swapped for a man-sized slab written here (tools/nifWrite.mjs, the
// port's own NIF writer) - the fixture's own body is a forearm lying flat,
// 0.1 units tall, which no portrait can frame - holding Weapon Sheathing's
// vendored retail longsword and long bow (PR-BOW1's pair) at their true
// size against it: a 128-unit figure, a 60-unit blade, an 84-unit stave.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as fpArmModule from '../src/combat/fpArm.js';
import * as mwFirstPerson from '../src/formats/mwFirstPerson.js';
import { multiply, perspective, lookAt } from '../src/world/mat4.js';
import { meshToNif } from '../tools/nifWrite.mjs';
import { bodyRec, fixtureFile as f } from './fixtures/mw/bodyRig.mjs';

// Read off the namespaces, so the file LOADS on the unfixed tree (which has no foldPieceBounds and no
// portraitWindow) and every pin there fails on its own assertion, not on a missing export (A PIN MUST FAIL).
const { createFpArm, fpSkeletonPath, FP_CLIP_PATH, foldRangeBoxes, packFpArm, portraitWindow, CARRIED_SLOTS } = fpArmModule;
const { MW_WEAPON_TYPE, meshBounds, foldPieceBounds, bindPartsInto } = mwFirstPerson;

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const vendored = (n) => new Uint8Array(readFileSync(new URL(`../vendor/weapon-sheathing/Data Files/Meshes/w/${n}`, import.meta.url)));

/** a closed box, as a mesh nifWrite takes */
function boxMesh([x0, y0, z0], [x1, y1, z1]) {
  const positions = [];
  for (let k = 0; k < 8; k++) positions.push(k & 1 ? x1 : x0, k & 2 ? y1 : y0, k & 4 ? z1 : z0);
  const indices = [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3];
  return { name: 'standin', positions, indices };
}
// The upper-arm bone stands at (0.4, 0.45, 3.2) on the fixture skeleton and turns only about z: this slab, placed
// there (and mirrored onto the left one, rule 13), is a 41 x 17 x 128-unit figure, the hands about its middle.
const STANDIN_BODY = new Uint8Array(meshToNif(boxMesh([-0.4, -8, -63.2], [19.6, 8, 64.8])));
// An unlit torch, far off the body: the portrait hides it (MW-D51), so it must not move the portrait's frame.
const FAR_TORCH = new Uint8Array(meshToNif(boxMesh([150, -40, 90], [170, 40, 260])));

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
const LONGSWORD = { templateIndex: 120 };   // -> LongBladeOneHand, "Weapon Bone"
const LONG_BOW = { templateIndex: 130 };    // -> MarksmanBow, "Weapon Bone Left" (rule 8)

/** prbow1_bow.test.js's deps, the upper arm the man-sized stand-in */
function deps() {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')], [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')], ['meshes/fixture/armfparm.nif', STANDIN_BODY],
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

/** a renderer that keeps the portrait's render and the sprite pass's last quad */
function capturingRenderer() {
  const cap = { image: null, quad: null };
  return { cap, gl: null,
    createCharacterMesh: () => ({ vao: {}, buffers: [] }),
    updateCharacterMesh: () => {},
    createCharacterTexture: (mips) => ({ mips }),
    renderCharacterSprite: () => ({}),
    drawCharacterSpriteQuad: (tex, center, halfW, halfH) => { cap.quad = { center: [...center], halfW, halfH }; },
    renderCharacterSpriteImage: (mesh, model, oproj, oview, pw, ph) => { cap.image = { mesh, model, oproj, oview, pw, ph }; return { width: pw, height: ph, data: new Uint8ClampedArray(pw * ph * 4) }; },
    drawScreenOverlayQuad: () => {},
    createParticleEffect: () => ({}),
  };
}

/** the REAL rig on the stand-in, built with `weapon` */
async function buildRig({ weapon = null } = {}) {
  const renderer = capturingRenderer();
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } }));
  const res = await arm.build({ race: 'fprace', weapon, deps: deps() });
  assert.equal(res.ok, true, `${res.stage}: ${res.error}`);
  assert.ok(res.third && res.third.ok, 'the third-person body built');
  if (weapon) assert.ok(res.third.weapon, 'and the body holds the weapon');
  return { arm, cap: renderer.cap, third: () => arm.built().third };
}

const ndc = (m, p) => { const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]; return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w]; };
const CELL = 110 / 184;   // the enhanced inventory's doll cell (enhancedStyle.js .wornmap-doll.hasart), object-fit: contain
/** figure() once, read back through the portrait's OWN ortho, view and model: the body's height as a fraction of the
 *  110:184 cell it is shown in, and every drawn vertex of the held item in the picture's NDC */
function portrait({ arm, cap, third }, yaw = 0) {
  cap.image = null;
  const px = arm.figure({ yaw, height: 384 });
  assert.ok(px && px.width > 0 && px.height > 0, 'the portrait renders');
  const { model, oproj, oview, pw, ph } = cap.image;
  const m = multiply(multiply(oproj, oview), model);
  const pieces = third().arm.pieces;
  const body = meshBounds(pieces.filter((p) => !CARRIED_SLOTS.includes(p.slot) && p.indices));   // the body, measured here on its own
  const imgFrac = (ndc(m, [0, 0, body.maxZ])[1] - ndc(m, [0, 0, body.minZ])[1]) / 2;
  const axis = ndc(m, [0, 0, (body.minZ + body.maxZ) / 2]);   // the actor's own axis at the body's mid-height
  const shown = Math.min(1, CELL / (pw / ph));   // contain: the share of the cell's height the picture takes
  let worst = 0, n = 0;
  for (const p of pieces.filter((q) => q.slot === 'weapon')) {
    for (let i = 0; i < p.positions.length; i += 3) {
      const [x, y] = ndc(m, [p.positions[i], p.positions[i + 1], p.positions[i + 2]]);
      worst = Math.max(worst, Math.abs(x), Math.abs(y)); n++;
    }
  }
  return { cell: imgFrac * shown, imgFrac, axis, pw, ph, oproj, heldWorst: worst, heldVerts: n, ranges: cap.image.mesh.ranges };
}

/** Every posed position array of `pieces` behind a Proxy that counts element READS - by the function that reads
 *  (the trap's caller, off the stack) - while writes pass straight through. */
function countVertexReads(pieces) {
  const by = new Map();
  for (const p of pieces) {
    const target = p.positions;
    p.positions = new Proxy(target, {
      get(t, k) {
        if (typeof k === 'string' && k.charCodeAt(0) >= 48 && k.charCodeAt(0) <= 57) {
          const limit = Error.stackTraceLimit;
          Error.stackTraceLimit = 3;
          const frame = new Error().stack.split('\n')[2] ?? '';
          Error.stackTraceLimit = limit;
          const reader = /at (?:Object\.)?([\w$]+)/.exec(frame)?.[1] ?? '?';
          by.set(reader, (by.get(reader) ?? 0) + 1);
        }
        const v = t[k];
        return typeof v === 'function' ? v.bind(t) : v;
      },
      set(t, k, v) { t[k] = v; return true; },
    });
  }
  return by;
}

// ---------------------------------------------------------------------------------------------------------------
// (1) THE SECOND WALK
// ---------------------------------------------------------------------------------------------------------------

test('PR-BOW1b (1): poseAssembly\'s ONE walk folds each piece\'s own box - one object the piece keeps, pose after pose - and the assembly\'s bounds exactly as meshBounds folds them; a range copies its piece\'s box into its own (unfixed: no piece carried a box, and the upload walked every posed vertex again)', async () => {
  const rig = await buildRig({ weapon: LONGSWORD });
  const arm = rig.arm;
  assert.equal(arm.setViewMode('third'), true);
  arm.setSheathed(false);
  arm.update(1 / 60);
  const t = rig.third();
  const kept = new Map(t.arm.pieces.map((p) => [p, p.box]));
  for (let i = 0; i < 3; i++) {
    arm.update(1 / 60);
    for (const p of t.arm.pieces) {
      assert.ok(p.box && typeof p.box === 'object', `${p.slot} @ ${p.bone}: poseAssembly left the piece its box`);
      assert.equal(p.box, kept.get(p), `${p.slot} @ ${p.bone}: the SAME box, rewritten - a posed frame mints nothing`);
      assert.deepEqual({ ...p.box }, meshBounds([p]), `${p.slot} @ ${p.bone}: the box is the piece's posed positions`);
    }
    assert.deepEqual(t.arm.bounds, meshBounds(t.arm.pieces), 'the assembly\'s bounds: meshBounds\' own answer');
  }
  // the ranges the pass draws: each its OWN box (the range owns it), equal to its piece's
  const { ranges } = portrait(rig);
  for (const r of ranges) {
    assert.notEqual(r.box, r.piece.box, 'the range keeps its own box');
    assert.deepEqual({ ...r.box }, { ...r.piece.box }, `${r.slot}: the range's box is its piece's`);
  }
  // foldPieceBounds on its own: an empty piece and a NaN vertex fold as meshBounds folds them, and nothing is null
  const shapes = [{ positions: Float32Array.from([1, 2, 3, -4, 5, NaN]) }, { positions: new Float32Array(0) }, { positions: Float32Array.from([0, -9, 7]) }];
  assert.deepEqual(foldPieceBounds(shapes), meshBounds(shapes));
  assert.deepEqual({ ...shapes[2].box }, { minX: 0, minY: -9, minZ: 7, maxX: 0, maxY: -9, maxZ: 7 });
  assert.equal(foldPieceBounds([{ positions: new Float32Array(0) }]), null, 'nothing finite: null, as meshBounds');
});

test('PR-BOW1b (1): THE DRAWTHIRD PATH WALKS THE POSED VERTICES ONCE A FRAME - every element read of every body piece counted, by the function reading it, through a posed frame and its draw: the pack and poseAssembly\'s own fold read them, the fold each coordinate ONCE, and nothing else reads one; a PEER-CADENCE frame that does not pose reads none (unfixed: the upload\'s foldRangeBoxes walked them all again after meshBounds had)', async () => {
  for (const weapon of [null, LONGSWORD, LONG_BOW]) {
    const rig = await buildRig({ weapon });
    const arm = rig.arm;
    assert.equal(arm.setViewMode('third'), true);
    if (weapon) arm.setSheathed(false);
    for (let i = 0; i < 3; i++) arm.update(1 / 60);
    const pieces = rig.third().arm.pieces;
    const reads = countVertexReads(pieces);
    const vertices = pieces.reduce((n, p) => n + p.positions.length / 3, 0);
    // what the pack itself reads, per frame, off the same pieces
    packFpArm(pieces);
    const pack = reads.get('packFpArm');
    assert.ok(pack > 0 && vertices > 0);
    const cam = { proj: perspective(Math.PI / 3, 1.6, 0.01, 500), view: lookAt([0, 1.2, -3], [0, 0.05, 0], [0, 1, 0]), eye: [0, 1.2, -3] };
    const canvas = { clientWidth: 1600, clientHeight: 1000 };
    reads.clear();
    arm.update(1 / 60);
    assert.equal(arm.drawThird(canvas, { ...cam, feet: [0, 0, 0], yaw: 0 }), true, 'the body draws');
    const what = weapon === LONG_BOW ? 'long bow' : weapon ? 'longsword' : 'bare';
    const seen = Object.fromEntries(reads);
    assert.deepEqual(Object.keys(seen).sort(), ['foldPieceBounds', 'packFpArm'], `${what}: only the pack and poseAssembly's fold read a posed vertex (read by ${JSON.stringify(seen)})`);
    assert.equal(seen.packFpArm, pack, `${what}: the pack reads what a pack reads`);
    assert.equal(seen.foldPieceBounds, 3 * vertices, `${what}: and the fold is ONE walk of ${vertices} vertices, each coordinate read once`);
    reads.clear();
    arm.update(1 / 60, { pose: false });
    assert.equal(arm.drawThird(canvas, { ...cam, feet: [0, 0, 0], yaw: 0 }), true);
    assert.equal(reads.size, 0, `${what}: a frame that does not pose reads no vertex at all`);
  }
});

test('PR-BOW1b (1): foldRangeBoxes reads NO vertex of a posed piece - it copies the box poseAssembly left on it; a piece no pose has touched (a part bound since, a hand-built range) is folded off its positions (unfixed: every range walked its piece\'s positions)', () => {
  let touched = 0;
  const posed = { box: { minX: -1, minY: -2, minZ: 0, maxX: 1, maxY: 2, maxZ: 9 } };
  const arr = Float32Array.from([5, 5, 5, 6, 6, 6]);
  Object.defineProperty(posed, 'positions', { get() { touched++; return new Proxy(arr, { get(t, k) { if (/^\d/.test(String(k))) throw new Error('a posed piece\'s vertex was read'); const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } }); } });
  const fresh = { positions: Float32Array.from([0, 0, 0, 3, -4, 5]) };
  const ranges = [{ slot: 'chest', piece: posed, hidden: false }, { slot: 'weapon', piece: fresh, hidden: false }];
  foldRangeBoxes(ranges);
  assert.ok(touched <= 1, 'at most the length is asked');
  assert.deepEqual({ ...ranges[0].box }, { ...posed.box }, 'the posed piece\'s box, copied');
  assert.notEqual(ranges[0].box, posed.box, 'into the range\'s own');
  assert.deepEqual({ ...ranges[1].box }, { minX: 0, minY: -4, minZ: 0, maxX: 3, maxY: 0, maxZ: 5 }, 'the unposed piece: folded off its positions');
  // the next pose rewrites the piece's box; the range's own box follows it
  const kept = ranges[0].box;
  posed.box.maxZ = 12;
  foldRangeBoxes(ranges);
  assert.equal(ranges[0].box, kept, 'one box a range keeps');
  assert.equal(kept.maxZ, 12, 'refolded from the pose it was handed');
});

// ---------------------------------------------------------------------------------------------------------------
// (2) THE PORTRAIT
// ---------------------------------------------------------------------------------------------------------------

test('PR-BOW1b (2): THE PORTRAIT - bare-handed, holding a longsword and holding a long bow, the body is the SAME size in its 110:184 cell (within 0.5%), and every vertex of the held item is inside the picture: drawn, never clipped - the REAL figure() on the man-sized stand-in, read back through its own ortho (unfixed: bare 0.943 of the cell, longsword 0.891, long bow 0.774)', async () => {
  const bare = portrait(await buildRig());
  const sword = portrait(await buildRig({ weapon: LONGSWORD }));
  const bow = portrait(await buildRig({ weapon: LONG_BOW }));
  assert.ok(Math.abs(bare.cell - 1 / 1.06) < 1e-3, `bare hands: the body fills the cell less the pad (${bare.cell.toFixed(4)})`);
  for (const [what, got] of [['longsword', sword], ['long bow', bow]]) {
    assert.ok(Math.abs(got.cell / bare.cell - 1) < 0.005, `${what}: the body keeps its size in the cell (x${(got.cell / bare.cell).toFixed(4)} of bare hands: ${got.cell.toFixed(3)} vs ${bare.cell.toFixed(3)})`);
    assert.ok(got.heldVerts > 0, `${what}: the held item is on the body`);
    assert.ok(got.heldWorst <= 1 + 1e-9, `${what}: every vertex of it is inside the picture (worst |ndc| ${got.heldWorst.toFixed(4)})`);
    assert.equal(got.ranges.filter((r) => r.slot === 'weapon').every((r) => !r.hidden), true, `${what}: and the portrait DRAWS it (PX26)`);
  }
  assert.ok(Math.abs(bow.cell / sword.cell - 1) < 0.005, `THE REPORT, in the portrait: a bow does not draw the body bigger or smaller than a sword (x${(bow.cell / sword.cell).toFixed(4)})`);
});

test('PR-BOW1b (2): TURNED, the body is never drawn smaller than the old frame drew it - at every yaw the portrait frames the tight box of what it shows, so a held longsword keeps the body at or above 0.891 of the cell and a held long bow at or above 0.773 (the azimuth-safe frame\'s constant shares), and the held item never leaves the picture (review: the symmetric window about the axis shrank a turned longsword\'s body to 0.590)', async () => {
  const bareRig = await buildRig();
  const swordRig = await buildRig({ weapon: LONGSWORD });
  const bowRig = await buildRig({ weapon: LONG_BOW });
  const FLOOR = { longsword: 0.891, 'long bow': 0.773 };
  for (const yaw of [0, 0.5, 0.8, 1.0, 1.5, 1.6, 2.4, 3.1, -0.8, -1.2, -1.5]) {
    const bare = portrait(bareRig, yaw);
    assert.ok(bare.cell > 0.9, `bare hands at yaw ${yaw}: the body fills the cell (${bare.cell.toFixed(3)})`);
    for (const [what, rig] of [['longsword', swordRig], ['long bow', bowRig]]) {
      const got = portrait(rig, yaw);
      assert.ok(got.cell >= FLOOR[what] - 1e-3, `${what} at yaw ${yaw}: the body is ${got.cell.toFixed(3)} of the cell, the old frame held ${FLOOR[what]}`);
      assert.ok(got.heldWorst <= 1 + 1e-9, `${what} at yaw ${yaw}: the held item is inside the picture (worst |ndc| ${got.heldWorst.toFixed(4)})`);
    }
  }
});

test('PR-BOW1b (2): gear the portrait does NOT show moves nothing - an unlit torch bound far off the body (the real binder) is hidden (MW-D51) and the picture is exactly the bare body\'s: same size, same ortho, same view (unfixed: the frame took the hidden torch in and the body shrank to a sliver of it)', async () => {
  const bare = await buildRig();
  const lit = await buildRig();
  // bound through the formats' own door, before the first upload - as a build or a torch swap binds it
  bindPartsInto(lit.third().arm, [{ slot: 'torch', bytes: FAR_TORCH, bones: ['left hand'] }]);
  assert.ok(lit.third().arm.pieces.some((p) => p.slot === 'torch'), 'the torch is on the body');
  const a = portrait(bare), b = portrait(lit);
  assert.equal(b.ranges.find((r) => r.slot === 'torch').hidden, true, 'and the portrait hides it: it is not lit');
  assert.deepEqual([b.pw, b.ph], [a.pw, a.ph], 'the same picture size');
  assert.deepEqual([...lit.cap.image.oproj], [...bare.cap.image.oproj], 'the same ortho window');
  assert.deepEqual([...lit.cap.image.oview], [...bare.cap.image.oview], 'looking at the same point');
  assert.ok(Math.abs(b.cell - a.cell) < 1e-12, 'so the body is exactly the size it was');
});

test('PR-BOW1b (2): portraitWindow - the tight box of the SHOWN ranges at this yaw (each side reaches only as far as something drawn on that side), the depth the body\'s own axis, hidden ranges nowhere; null when nothing shown has a box', () => {
  const box = (minX, minY, minZ, maxX, maxY, maxZ) => ({ minX, minY, minZ, maxX, maxY, maxZ });
  // the model as figure() builds it, less the yaw and the scale: MW z up. A body 2 wide and 10 tall on z 0..10.
  const zUp = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];   // column-major: MW (x, y, z) -> world (x, z, -y)
  const ranges = [
    { slot: 'chest', hidden: false, box: box(-1, -0.5, 0, 1, 0.5, 10) },
    { slot: 'weapon', hidden: false, box: box(0.5, -0.2, 3, 1.5, 0.2, 4) },
    { slot: 'torch', hidden: true, box: box(40, 40, -30, 50, 50, 60) },
  ];
  const w = portraitWindow(ranges, zUp, {});
  assert.deepEqual(w.center, [0.25, 5, 0], 'x from -1 (the body) to 1.5 (the weapon): the middle of what is drawn');
  assert.equal(w.halfH, 5, 'the body\'s half-span');
  assert.equal(w.halfW, 1.25, 'the weapon widens its own side only');
  ranges[1].box = box(-3, -0.2, -2, 0, 0.2, 14);   // a staff taller than the body, held low on the left
  const t = portraitWindow(ranges, zUp, {});
  assert.deepEqual([t.center[0], t.center[1], t.halfW, t.halfH], [-1, 6, 2, 8], 'x -3..1, y -2..14: never clipped, never wider than drawn');
  ranges[1].hidden = true;
  assert.deepEqual(portraitWindow(ranges, zUp, {}), { center: [0, 5, 0], halfW: 1, halfH: 5 }, 'hidden: the bare body\'s window');
  ranges[0].hidden = true;
  assert.equal(portraitWindow(ranges, zUp, {}), null, 'nothing shown: null');
  ranges[1].hidden = false;   // only gear shown: the gear's own box
  assert.deepEqual(portraitWindow(ranges, zUp, {}).center, [-1.5, 6, 0]);
});

// ---------------------------------------------------------------------------------------------------------------
// (3) THE WIRING AND THE RECORD
// ---------------------------------------------------------------------------------------------------------------

test('PR-BOW1b: the wiring, by source - poseAssembly folds through foldPieceBounds, the portrait frames through portraitWindow after its flags and never over every piece, and the record names every door to drawThird: world.js, exterior.js, worldModes.js and dungeon.js through mwView.mwViewDrawBody, the peers through peerBodies', () => {
  const mw = rd('src/formats/mwFirstPerson.js');
  const pose = mw.slice(mw.indexOf('export function poseAssembly('), mw.indexOf('export function hangAffine('));
  assert.match(pose, /assembly\.bounds = pieces\.length \? foldPieceBounds\(pieces\) : null;/, 'the one walk');
  const arm = rd('src/combat/fpArm.js');
  const fig = arm.slice(arm.indexOf('    figure({ yaw = 0, height = 384 } = {}) {'), arm.indexOf('    status() {'));
  const flags = fig.indexOf("if (r.slot === 'weapon') r.hidden = false;");
  const frame = fig.indexOf('const win = portraitWindow(thirdMesh.ranges, model, figureBodyBox);');
  assert.ok(flags > 0 && frame > flags, 'the portrait is framed AFTER it decides what it shows');
  assert.ok(!/meshBounds\(t\.arm\.pieces\)/.test(fig), 'and never over every piece');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeon.js']) {
    assert.match(rd(host), /mwViewDrawBody\(canvas, \{ proj, view, eye(: mwv\.eye)?, feet: player\.bodyFeetAt\(\), yaw: cam\.yaw \}\)/, `${host} draws the body through mwView`);
  }
  assert.match(rd('src/player/mwView.js'), /return fpArm\.drawThird\(canvas, \{ proj, view, eye, feet, yaw \}\);/);
  assert.match(rd('src/net/peerBodies.js'), /b\.rig\.drawThird\(canvas, \{ proj, view, eye, feet: b\.feet, yaw: b\.yaw, hitFlash: flashOf \? flashOf\(b\.id\) : 0 \}\)/);
  const page = rd('bible/01-Overview/Field-Bugs-2026-09-24.md');
  const section = page.slice(page.indexOf('## PR-BOW1:'));
  assert.ok(page.indexOf('## PR-BOW1:') > page.indexOf('## PR-WW1:'), 'the record is appended after PR-WW1\'s');
  for (const name of ['world.js', 'exterior.js', 'worldModes.js', 'dungeon.js', 'mwViewDrawBody', 'peerBodies', 'PR-BOW1b', 'test/prbow1_bow.test.js', 'test/prbow1b_followups.test.js']) {
    assert.ok(section.includes(name), `the PR-BOW1 record names ${name}`);
  }
});
