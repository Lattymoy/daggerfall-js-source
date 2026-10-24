// FIELD BUGS 2026-10-21c, the record's Left ("the road's stranger teams and the standing horses, still stepped every
// frame"; bible/07-Rendering/Performance-Priority.md HORSE-VIEW II): THE ROAD'S AND THE STANDING HORSES ARE POSED AS
// THE POOL'S ARE. HORSE-VIEW posed the Horse Cart pool's 3D horses where they are seen; the road's strangers' teams
// (world/road/roadTeams.js) still posed every horse every frame, out of the view and at any range, and the standing
// horses (world/standingHorses.js) every one in the view at any range - and one out of it stood still on its clock. Now
// all three read one law (world/horseView.js poseWhereSeen): the gait's clock every frame, the pose in the view on the
// peers' bodies' cadence by how far it looks from the camera that draws it, a horse the view swings onto caught up by
// the draw before it is drawn - bit for bit the pose an every-frame horse shows. The real rig (world/horseRig.js) over
// the real bake; GL is a recording stub (fb1021_horses.test.js's).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { createHorseRig } from '../../../src/world/horseRig.js';
import { createRoadTeams } from '../../../src/world/road/roadTeams.js';
import { createStandingHorses } from '../../../src/world/standingHorses.js';
import { fieldOfView } from '../../../src/ui/viewSettings.js';
import { glassFov } from '../../../src/ui/spyglassView.js';
import { perspective } from '../../../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** The GL half's doors, recording every palette sent (its mesh, a copy of what was sent), every picture queued and
 *  every bind opened, in order. */
function recordingRenderer() {
  let n = 0;
  const r = { log: [] };
  return Object.assign(r, {
    createSkinnedCharacterMesh: (s, o) => ({ vao: {}, vbo: {}, count: s.length / o.floats, floats: o.floats, skin: r.createSkinPalette(o) }),
    createSkinPalette: (o) => ({ tex: { id: ++n }, ...o }),
    releaseCharacterSkin: (m) => { if (m?.skin) m.skin.tex = null; },
    createCharacterTexture: () => ({ id: ++n }), releaseCharacterTexture: () => {},
    updateSkinPalette: (mesh, pal) => { r.log.push({ up: mesh, pal: Float32Array.from(pal) }); },
    queueCharacterSprite: (it) => { r.log.push({ drawn: it.mesh }); },
    beginCharacterSpriteBatch: () => r.log.push({ bind: true }), flushCharacterSpriteBatch: () => {},
    characterSpriteBatchOpen: true, retroImageSpan: null,
    renderCharacterSprite: () => ({}), drawCharacterSpriteQuad: () => {}, drawScreenOverlayQuad: () => {},
    createBillboardBatch: (archive, record) => ({ archive, record, origin: [0, 0, 0] }), destroyBillboardBatch() {},
  });
}
const uploadsOf = (r, mesh) => r.log.filter((x) => x.up === mesh).length;
const meshesInOrder = (r) => [...new Set(r.log.filter((x) => x.up).map((x) => x.up))];
const kinds = (r) => r.log.filter((x) => !x.bind).map((x) => (x.up ? 'pose' : 'draw'));
async function rigOn(r) {
  const rig = createHorseRig({
    renderer: r,
    fetchJson: async () => JSON.parse(rd('src/assets/horse/courser.json')),
    fetchBytes: async (u) => new Uint8Array(readFileSync(new URL(u))),
    decode: async (b) => { const p = PNG.sync.read(Buffer.from(b)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; },
  });
  await rig.load();
  assert.ok(rig.ready(), `the rig: ${rig.failure()}`);
  return rig;
}

const canvas = { clientWidth: 1280, clientHeight: 720 };
const fy = 1 / Math.tan(fieldOfView() / 2);   // the frame's own lens (lensOf 1)
const proj = new Float32Array([fy / (1280 / 720), 0, 0, 0, 0, fy, 0, 0, 0, 0, -1.002, -1, 0, 0, -0.2002, 0]);
const LOOK_NZ = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);   // the eye at the origin, down -z
const LOOK_PZ = new Float32Array([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1]);   // turned round: down +z
const EYE = [0, 0, 0];

/** The road's teams on the Morrowind lane (the real rig), and one host frame: their sync (the frame's eye `eye`) and
 *  the body pass's 3D horses through `view` (and `p` the pass's projection, `passEye` its eye). */
async function roadStage() {
  const r = recordingRenderer();
  const rig = await rigOn(r);
  const teams = createRoadTeams({ renderer: r, presentation: () => null, horses3d: () => rig });
  const frame = (horses, view, { eye = [0, 1.7, 0], p = proj, passEye = EYE } = {}) => {
    rig.tick();
    teams.sync(horses, [], { dt: 1 / 60, eye });
    return teams.draw3d(canvas, { proj: p, view, eye: passEye });
  };
  return { r, rig, teams, frame };
}
/** A stranger's pack horse (its key names no wagon), walking along x at `z` (or standing where `at` says). */
const horseAt = (key, at, f = 0) => ({ key, feet: [at[0] + f * 0.04, at[1], at[2]], yaw: Math.PI / 2, moving: true, speed: 2.4, distM: Math.hypot(at[0], at[2]) });

test('HORSE-VIEW II the road\'s strangers: a stranger\'s 3D horse out of the last body pass\'s view is not posed nor sent, frame after frame - its gait stepped all the same; the frame the view swings onto it, the draw poses it BEFORE it is drawn, in the very pose an always-seen one shows that frame (mutants: the road\'s step posing; the pass\'s camera never kept; `fresh` not handed)', async () => {
  const seen = await roadStage(), hidden = await roadStage();
  const K = 90;
  for (let f = 0; f < K; f++) {
    const h = [horseAt('p0:h0', [-2, 0, 6], f)];   // 6 m behind the -z look
    assert.equal(seen.frame(h, LOOK_PZ), 1, `frame ${f}: the always-seen horse drawn`);
    assert.equal(hidden.frame(h, LOOK_NZ), 0, `frame ${f}: the hidden one behind the eye`);
  }
  const [meshSeen] = meshesInOrder(seen.r), [meshHidden] = meshesInOrder(hidden.r);
  assert.ok(meshSeen && meshHidden, 'each stood its 3D horse');
  assert.equal(uploadsOf(seen.r, meshSeen), K, 'within 10 m and in the view: a pose a frame');
  assert.equal(uploadsOf(hidden.r, meshHidden), 1, 'behind the eye: its first pose and nothing after');
  // the view swings round onto it
  seen.r.log.length = 0; hidden.r.log.length = 0;
  const h = [horseAt('p0:h0', [-2, 0, 6], K)];
  seen.frame(h, LOOK_PZ);
  assert.equal(hidden.frame(h, LOOK_PZ), 1, 'in this pass\'s view: drawn');
  assert.deepEqual(kinds(hidden.r), ['pose', 'draw'], 'posed, then drawn - in the draw, as the sync judged it by the last view');
  assert.deepEqual(hidden.r.log.find((x) => x.up).pal, seen.r.log.find((x) => x.up).pal, 'bit for bit the always-seen horse\'s pose this frame: its gait ran unposed');
  // and on, seen: every frame within 10 m, from the sync's own judgement
  hidden.r.log.length = 0;
  hidden.frame([horseAt('p0:h0', [-2, 0, 6], K + 1)], LOOK_PZ);
  assert.deepEqual(kinds(hidden.r), ['pose', 'draw']);
});

test('HORSE-VIEW II (AUDIT) the road\'s strangers: a horse out of the last body pass\'s view that MOVES into it - a jump, judged in by the very camera that judged it out, so the draw\'s `fresh` never catches it - is posed as it comes in, on every frame of its cadence (40 m: every third), in the very pose an always-seen horse shows that frame; before, on two frames of three it was drawn in the pose it had when last seen (mutants: the law\'s last answer unread; the road\'s not handed)', async () => {
  const K = 60;
  for (let late = 0; late < 3; late++) {
    const seen = await roadStage(), jump = await roadStage();
    for (let f = 0; f <= K + late; f++) {
      if (f === K + late) { seen.r.log.length = 0; jump.r.log.length = 0; }
      assert.equal(seen.frame([horseAt('p0:h0', [-2, 0, 6])], LOOK_PZ), 1);
      const at = f < K + late ? 40 : -40;   // 40 m behind the -z look, then 40 m ahead of it
      assert.equal(jump.frame([horseAt('p0:h0', [0, 0, at])], LOOK_NZ), at < 0 ? 1 : 0, `frame ${f}: ${at < 0 ? 'come into the view, drawn' : 'behind the eye'}`);
    }
    assert.deepEqual(kinds(jump.r), ['pose', 'draw'], `come in ${late} frame(s) later: posed, then drawn - its cadence skips it`);
    assert.deepEqual(jump.r.log.find((x) => x.up).pal, seen.r.log.find((x) => x.up).pal, 'in the pose the clock stands at - an every-frame horse\'s');
  }
});

test('HORSE-VIEW II the road\'s cadence: in the view a stranger\'s horse is posed on the peers\' bodies\' cadence by how far it looks from the camera that draws it - every frame within 10 m, every second to 25 (along the ground), every third past it, two at one distance on different frames; from the pass\'s eye - the boom 8 m behind the head - not the frame\'s; through the spyglass at x8 one 76 m off every frame; before any body pass, from the frame\'s own eye (mutants: the phase dropped; the frames uncounted; the pass\'s eye never kept; the pass\'s lens never kept; the frame\'s eye unread)', async () => {
  const s = await roadStage();
  const at = { 'a:h0': [0, 0, -5], 'b:h0': [0, 10, -24], 'c:h0': [-3, 0, -60], 'd:h0': [3, 0, -60] };
  const keys = Object.keys(at);
  const list = () => keys.map((k) => ({ key: k, feet: at[k], yaw: 0, moving: false, speed: 0, distM: 9 }));
  s.frame(list(), LOOK_NZ);
  const meshes = new Map(meshesInOrder(s.r).map((m, i) => [keys[i], m]));
  assert.equal(meshes.size, 4, 'a 3D horse each, posed the frame it stood');
  for (let f = 0; f < 2; f++) s.frame(list(), LOOK_NZ);
  const posedOn = (n, view, o, inView = 4) => {
    s.r.log.length = 0;
    const got = new Map(keys.map((k) => [k, []]));
    for (let f = 0; f < n; f++) {
      const before = s.r.log.length;
      assert.equal(s.frame(list(), view, o), inView, `${inView} in view`);
      for (const k of keys) if (s.r.log.slice(before).some((x) => x.up === meshes.get(k))) got.get(k).push(f);
    }
    return got;
  };
  const frames = posedOn(12, LOOK_NZ);
  assert.deepEqual(keys.map((k) => frames.get(k).length), [12, 6, 4, 4], '5 m every frame; 24 m along the ground (26 through the air) every second; 60 m every third');
  assert.notDeepEqual(frames.get('c:h0'), frames.get('d:h0'), 'two at one distance on different frames (each horse its phase)');
  // the pass's eye, not the frame's: the boom drawn out 8 m behind the head (player/mwCamera.js, to 11.4) - the near one 5 m from
  // the head and 13 from the lens, every second frame; the rest past 25 m from either
  const BOOM = [0, 1.7, 8], LOOK_BOOM = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1.7, -8, 1]);
  s.frame(list(), LOOK_BOOM, { passEye: BOOM });   // the pass's eye kept, for the next frame's poses
  const boomed = posedOn(12, LOOK_BOOM, { passEye: BOOM });
  assert.deepEqual(keys.map((k) => boomed.get(k).length), [6, 4, 4, 4], 'from the boom: 13 m every second, 32 m and 68 m every third - not the head\'s 5 m');
  // the spyglass at x8 (world.js glassFov over the frame's own lens): 76 m drawn as 9.5 m - every frame
  const glass = perspective(glassFov(fieldOfView(), 8), 1280 / 720, 0.1, 1000);
  at['c:h0'] = [0, 0, -76]; at['d:h0'] = [1, 0, -76];
  s.frame(list(), LOOK_NZ, { p: glass });   // the pass's lens kept, for the next frame's poses
  const glassed = posedOn(12, LOOK_NZ, { p: glass }, 3);   // the glass's narrow view: the near one ahead and the far two
  assert.deepEqual([glassed.get('c:h0').length, glassed.get('d:h0').length], [12, 12], 'through the glass at x8, 76 m off: posed as at 9.5 m');
  // before any body pass: every horse held seen, on its cadence from the frame's own eye (the sync's)
  const pre = await roadStage();
  const preList = () => [{ key: 'n:h0', feet: [0, 0, -5], yaw: 0, moving: false, speed: 0, distM: 5 }, { key: 'f:h0', feet: [0, 0, -60], yaw: 0, moving: false, speed: 0, distM: 60 }];
  for (let f = 0; f < 3; f++) { pre.rig.tick(); pre.teams.sync(preList(), [], { dt: 1 / 60, eye: [0, 1.7, 0] }); }
  const pm = meshesInOrder(pre.r);
  pre.r.log.length = 0;
  for (let f = 0; f < 12; f++) { pre.rig.tick(); pre.teams.sync(preList(), [], { dt: 1 / 60, eye: [0, 1.7, 0] }); }
  assert.deepEqual(pm.map((m) => uploadsOf(pre.r, m)), [12, 4], 'no pass yet: held seen, on the cadence from the frame\'s eye');
});

/** The standing horses on the Morrowind lane (the real rig), and one host frame: begin from `eye`, the horses offered,
 *  the cut made through the frame's camera (`view`, `p`), the horses drawn through it. */
async function standStage() {
  const r = recordingRenderer();
  const rig = await rigOn(r);
  const sh = createStandingHorses({ renderer: r });
  const batches = new Map();
  const frame = (list, view, { eye = EYE, p = proj } = {}) => {
    rig.tick();
    sh.begin(rig, eye);
    for (const [key, feet] of list) sh.offer(key, feet, 0.4, 0, batches.get(key) ?? batches.set(key, { castOnly: false }).get(key), 7);
    if (!sh.end(1 / 60, { proj: p, view })) return 0;
    return sh.draw(canvas, { eye, proj: p, view });
  };
  return { r, rig, sh, frame };
}

test('HORSE-VIEW II the standing horses: every horse that stands steps its idle\'s clock every frame; out of the frame\'s view it is neither posed nor drawn, and no bind is opened for none; the frame the view swings onto it, the draw poses it before it is drawn, in the very pose an always-seen one shows that frame - before, it took up its idle where it had left it (mutants: the standing step posing; the end\'s view unread; `fresh` not handed; `fresh` never set; drawn out of the view)', async () => {
  const seen = await standStage(), hidden = await standStage();
  const K = 70;
  const list = [['h', [0, 0, 6]]];   // 6 m behind the -z look
  for (let f = 0; f < K; f++) {
    assert.equal(seen.frame(list, LOOK_PZ), 1, `frame ${f}: the always-seen one drawn`);
    assert.equal(hidden.frame(list, LOOK_NZ), 0, `frame ${f}: the hidden one behind the eye`);
  }
  const [meshSeen] = meshesInOrder(seen.r), [meshHidden] = meshesInOrder(hidden.r);
  assert.equal(uploadsOf(seen.r, meshSeen), K, 'within 10 m and in the view: a pose a frame');
  assert.equal(uploadsOf(hidden.r, meshHidden), 1, 'behind the eye: its first pose and nothing after');
  assert.equal(hidden.r.log.filter((x) => x.bind).length, 0, 'and no bind opened for a horse the view does not hold');
  seen.r.log.length = 0; hidden.r.log.length = 0;
  seen.frame(list, LOOK_PZ);
  assert.equal(hidden.frame(list, LOOK_PZ), 1, 'swung onto: drawn');
  assert.deepEqual(kinds(hidden.r), ['pose', 'draw'], 'posed, then drawn');
  assert.deepEqual(hidden.r.log.find((x) => x.up).pal, seen.r.log.find((x) => x.up).pal, 'bit for bit the always-seen horse\'s pose: its idle\'s clock ran out of the view');
  // and one past 10 m, swung onto on any frame of its cadence (every third): the draw catches it up when the cadence
  // would not have posed it - never a pose from when it was last seen
  for (let late = 0; late < 3; late++) {
    const near = await standStage(), far = await standStage();
    for (let f = 0; f < K + late; f++) { near.frame(list, LOOK_PZ); far.frame([['h', [0, 0, 30]]], LOOK_NZ); }
    near.r.log.length = 0; far.r.log.length = 0;
    near.frame(list, LOOK_PZ);
    assert.equal(far.frame([['h', [0, 0, 30]]], LOOK_PZ), 1);
    assert.deepEqual(kinds(far.r), ['pose', 'draw'], `30 m, swung onto ${late} frame(s) later: posed, then drawn`);
    assert.deepEqual(far.r.log.find((x) => x.up).pal, near.r.log.find((x) => x.up).pal, 'in the pose the clock stands at - an every-frame horse\'s');
  }
});

test('HORSE-VIEW II the standing horses\' cadence: in the view each is posed on the peers\' bodies\' cadence by how far it looks from the camera - begin\'s eye, over end\'s lens - every frame within 10 m, every second to 25 along the ground, every third past it, two at one distance on different frames; through the spyglass at x8 one 58 m off every frame; with no camera handed, from begin\'s eye (mutants: the phase dropped; the lens unread; the camera\'s view unread; begin\'s eye unread)', async () => {
  const s = await standStage();
  const list = [['a', [0, 0, -5]], ['b', [0, 10, -24]], ['c', [-3, 0, -55]], ['d', [3, 0, -55]]];
  s.frame(list, LOOK_NZ);
  const meshes = meshesInOrder(s.r);
  assert.equal(meshes.length, 4);
  const posedOn = (n, o, inView = 4) => {
    for (let f = 0; f < 2; f++) s.frame(list, LOOK_NZ, o);
    s.r.log.length = 0;
    for (let f = 0; f < n; f++) assert.equal(s.frame(list, LOOK_NZ, o), inView, `${inView} in view`);
    return meshes.map((m) => s.r.log.filter((x) => x.up === m).length);
  };
  assert.deepEqual(posedOn(12), [12, 6, 4, 4], '5 m every frame; 24 m along the ground every second; 55 m every third');
  s.r.log.length = 0;
  const on = (m) => { const out = []; let f = -1; for (const x of s.r.log) { if (x.bind) f++; if (x.up === m) out.push(f); } return out; };
  for (let f = 0; f < 6; f++) s.frame(list, LOOK_NZ);
  assert.notDeepEqual(on(meshes[2]), on(meshes[3]), 'two at one distance on different frames (each its phase)');
  list[2][1] = [-1, 0, -58]; list[3][1] = [1, 0, -58];   // within STANDING_HORSE_RANGE
  const glass = perspective(glassFov(fieldOfView(), 8), 1280 / 720, 0.1, 1000);
  assert.deepEqual(posedOn(12, { p: glass }, 3).slice(2), [12, 12], 'through the glass at x8, 58 m off (drawn as at 7 m): every frame');
  // a host that hands `end` no camera: every horse held seen, on its cadence from begin's eye
  const bare = await standStage(), keys = ['a', 'b', 'c', 'd'], at = { a: [0, 0, -5], b: [0, 10, -24], c: [-3, 0, -55], d: [3, 0, -55] };
  const bareFrame = () => { bare.rig.tick(); bare.sh.begin(bare.rig, EYE); for (const k of keys) bare.sh.offer(k, at[k], 0, 0, null, 7); bare.sh.end(1 / 60); };
  for (let f = 0; f < 3; f++) bareFrame();
  const bm = meshesInOrder(bare.r);
  bare.r.log.length = 0;
  for (let f = 0; f < 12; f++) bareFrame();
  assert.deepEqual(bm.map((m) => uploadsOf(bare.r, m)), [12, 6, 4, 4], 'no camera: held seen, on the cadence from begin\'s eye');
});
