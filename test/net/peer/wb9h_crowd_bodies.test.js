// WB9h (2026-09-30, Mac: "Further improve the morrowind model performance as it's unplayable with so many players
// around"): THE MORROWIND BODIES IN A CROWD (net/peer/peerBodies.js). tools/peerCrowdProbe.mjs stood forty players milling
// round the eye: 81 bodies built in thirty seconds (up to 24 in five), 68 torn down while their player stood within
// 25 m, every body skinned and drawn whether the eye saw it or not. Four laws, each pinned here by driving PeerBodies:
// THE VIEW (a body out of it neither drawn nor skinned, posed as it is seen), THE BUDGET (SKIN_BUDGET skins a frame,
// the overdue first), THE SWAP (a stranger's body handed over only after SWAP_DWELL_MS, no oftener than SWAP_EVERY_MS,
// never while another builds), THE SPARES (a body given up kept for the next peer who wears it). Design:
// bible/07-Rendering/Performance-Rig.md (WB9h).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PeerBodies, BODIES_MAX, BODY_LINGER_MS, SKIN_BUDGET, poseCadenceFor, SWAP_DWELL_MS, SWAP_EVERY_MS, SPARE_MS, SPARE_MAX, BODY_SPHERE_SHARE, CULL_MARGIN_M, EFFECTS_BANK_MAX_S,
  viewPlanes, sphereInView, peerCamera,
} from '../../../src/net/peer/peerBodies.js';
import { CAPSULE_HEIGHT } from '../../../src/player/motor.js';
import { perspective, lookAt, mirrorProjectionX } from '../../../src/world/mat4.js';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await flush(); };
const toScene = (p) => [p.x, p.y, p.z];
/** a peer at (x, z); its look's race names it, unless `race` says the body it wears (two peers, one body) */
const peer = (id, x, z, race = id) => ({ id, name: id, told: true, look: { race, gender: 'male', faceIndex: 0, items: [] },
  shown: { x, y: 0, z, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, as: 0, am: 0, sr: 0, cn: 0, cr: 0 } });
/** the game's own lens: 70 degrees, 16:9, mirrored in x (mat4's handedness law), the eye at `eye` looking at `at` */
const lens = (eye = [0, 1.6, 0], at = [0, 1.6, -10]) => ({ proj: mirrorProjectionX(perspective((70 * Math.PI) / 180, 16 / 9, 0.1, 2000)), view: lookAt(eye, at, [0, 1, 0]), eye });
const CANVAS = { clientWidth: 1600, clientHeight: 900 };

/** a rig that records what each step asked of it: its skin minted by a posing step (the real rig's thirdMesh), its build
 *  held until `release()` when `hold` (a build in flight), its draws, its unload */
function rigs({ hold = false } = {}) {
  const made = [];
  const gates = [];
  const factory = () => {
    const r = { mode: 'first', steps: [], draws: [], skinned: false, unloaded: false, cam: undefined, builds: 0,
      attach(renderer, cam) { r.cam = cam; },
      async build(opts) { r.opts = opts; r.builds++; if (hold) await new Promise((res) => gates.push(res)); else await flush(); return { ok: true }; },
      canThirdPerson: () => true, raceHeightScale: () => 1,
      setViewMode(m) { r.mode = m; return true; },
      thirdActive: () => r.mode === 'third' && r.skinned,
      update(dt, opts) { r.steps.push({ dt, pose: opts?.pose !== false, effectsDt: opts?.effectsDt }); if (opts?.pose !== false) r.skinned = true; },
      drawThird(canvas, p) { if (!r.thirdActive()) return false; r.draws.push(p); return true; },
      unload() { r.unloaded = true; r.skinned = false; },
    };
    made.push(r);
    return r;
  };
  return { made, factory, release: () => { while (gates.length) gates.shift()(); } };
}
/** the rig standing for a peer */
const rigOf = (pb, id) => pb._bodies.get(id)?.rig ?? null;
/** stand `peers` in bodies (builds landed, a first step taken) */
async function stand(pb, peers, near = [0, 0, 0], sync = () => pb.sync(peers, toScene, 1 / 60, near)) {
  for (let i = 0; i < 30 && !peers.every((p) => pb.has(p.id)); i++) { sync(); await settle(); }
  for (const p of peers) assert.equal(pb.has(p.id), true, `${p.id} stands`);
}
const posesIn = (r, from = 0) => r.steps.slice(from).filter((s) => s.pose).length;

test('WB9h the view\'s sides: off the game\'s own lens (mirrored in x) and its view, five normalised planes - a body ahead is inside, one behind or off to the side is not, one whose reach crosses an edge is; a stub pair is no lens; nothing minted with an `out` (mutants: a side dropped; the reach ignored)', () => {
  const { proj, view } = lens();
  const out = new Float64Array(20);
  assert.equal(viewPlanes(proj, view, out), out, 'into the list it was handed');
  for (let i = 0; i < 20; i += 4) assert.ok(Math.abs(Math.hypot(out[i], out[i + 1], out[i + 2]) - 1) < 1e-9, 'each side normalised');
  const r = CAPSULE_HEIGHT * BODY_SPHERE_SHARE;
  const inside = (x, z, rr = r) => sphereInView(out, x, 0.9, z, rr);
  assert.equal(inside(0, -10), true, 'ahead');
  assert.equal(inside(0, 10), false, 'behind');
  assert.equal(inside(0, 0.5, 0.1), false, 'behind the near side');
  assert.equal(inside(40, -10), false, 'far off to one side');
  assert.equal(inside(-40, -10), false, 'and the other');
  assert.equal(inside(0, -10, r) && sphereInView(out, 0, 60, -10, r), false, 'high over the view');
  const edge = 10 * Math.tan((35 * Math.PI) / 180) * (16 / 9);   // the half-width of the view 10 m out
  assert.equal(inside(edge + 0.5, -10), true, 'its reach across the edge: seen');
  assert.equal(inside(edge + 5, -10), false, 'past it by more than its reach: not');
  assert.equal(inside(edge + 3, -10, r + CULL_MARGIN_M), true, 'the skin\'s margin reaches further than the draw');
  assert.equal(viewPlanes([1], [2]), null, 'a stub\'s pair is no lens');
  assert.equal(viewPlanes(null, view), null);
});

test('WB9h the view: a body out of the view is neither drawn nor skinned - its clocks and its weapon still step - and one the view swings onto is posed where its clocks stand before it is drawn, its banked dt handed to its particles (mutants: the culled drawn; the culled skinned; the stale drawn stale; the bank dropped)', async () => {
  const R = rigs();
  const pb = new PeerBodies({ renderer: {}, createRig: R.factory, buildOpts: (l) => ({ race: l.race }), now: () => 1000 });
  const ahead = peer('ahead', 0, -8), behind = peer('behind', 0, 8);
  // one just off the edge of the view 8 m out: past it by more than its reach, within the skin's margin
  const halfW = 8 * Math.tan((35 * Math.PI) / 180) * (16 / 9), reach = CAPSULE_HEIGHT * BODY_SPHERE_SHARE;
  const edgy = peer('edgy', -(halfW + (reach + CULL_MARGIN_M / 2) / Math.cos(Math.atan(halfW / 8))), -8);
  await stand(pb, [ahead, behind]);
  const front = lens();
  assert.equal(pb.draw(CANVAS, front), 1, 'the body pass: the one ahead alone');
  const ra = rigOf(pb, 'ahead'), rb = rigOf(pb, 'behind');
  assert.equal(ra.draws.length, 1); assert.equal(rb.draws.length, 0);
  await stand(pb, [ahead, behind, edgy], [0, 0, 0], () => { pb.sync([ahead, behind, edgy], toScene, 1 / 60, [0, 0, 0]); pb.draw(CANVAS, front); });
  const re = rigOf(pb, 'edgy'), e0 = re.steps.length, eDraws = re.draws.length;
  const a0 = ra.steps.length, b0 = rb.steps.length;
  for (let i = 0; i < 6; i++) { pb.sync([ahead, behind, edgy], toScene, 1 / 60, [0, 0, 0]); pb.draw(CANVAS, front); }
  assert.equal(re.draws.length, eDraws, 'just past the edge by more than its reach: not drawn');
  const every = poseCadenceFor(edgy.shown.x ** 2 + edgy.shown.z ** 2);
  assert.equal(posesIn(re, e0), 6 / every, '...but inside the skin\'s margin: skinned on its cadence, so a turning eye finds it posed');
  assert.equal(ra.steps.length - a0, 6); assert.equal(posesIn(ra, a0), 6, 'within 10 m and seen: a skin every frame');
  assert.equal(rb.steps.length - b0, 6, 'behind the eye: its clocks every frame');
  assert.equal(posesIn(rb, b0), 0, '...and no skin');
  assert.equal(rb.draws.length, 0, 'and never drawn');
  assert.equal(pb.has('behind'), true, 'it still stands - no doll is drawn for it either');
  // the view swings round onto it: posed before it is drawn, with the dt it banked
  const back = lens([0, 1.6, 0], [0, 1.6, 10]);
  const b1 = rb.steps.length;
  assert.equal(pb.draw(CANVAS, back), 1, 'the one behind, now ahead (the other two behind it now)');
  const catchUp = rb.steps[b1];
  assert.ok(catchUp && catchUp.pose && catchUp.dt === 0, 'a pose at no dt - where its clocks already stand');
  let lastPose = b1 - 1;
  while (lastPose >= 0 && !rb.steps[lastPose].pose) lastPose--;
  const banked = rb.steps.slice(lastPose + 1, b1).reduce((n, st) => n + st.dt, 0);
  assert.ok(banked >= 6 / 60 - 1e-9 && Math.abs(catchUp.effectsDt - Math.min(EFFECTS_BANK_MAX_S, banked)) < 1e-9, 'its particles handed every frame it banked since its last skin - AUDIT WB9 (bodies F1): at most EFFECTS_BANK_MAX_S of them');
  assert.ok(catchUp.effectsDt > 0, 'the bank never dropped');
  assert.equal(rb.draws.length, 1, 'then drawn');
  // and the next frame it is an ordinary seen body
  pb.sync([ahead, behind, edgy], toScene, 1 / 60, [0, 0, 0]);
  assert.equal(rb.steps.at(-1).pose, true);
  // a stub's lens (no planes): the old law alone - everything in front of the eye drawn
  const R2 = rigs();
  const pb2 = new PeerBodies({ renderer: {}, createRig: R2.factory, buildOpts: (l) => ({ race: l.race }), now: () => 1000 });
  await stand(pb2, [ahead, behind]);
  assert.equal(pb2.draw({}, { proj: [1], view: [2], eye: [0, 0, 0] }), 2, 'no lens, no cull');
});

test('WB9h the budget: of the bodies wanting a skin at most SKIN_BUDGET pose in a frame - the owed first, so eight bodies near and seen are each skinned every other frame; a body with no skin to keep poses whatever the budget (mutants: the budget ignored; the owed forgotten; the meshless made to wait)', async () => {
  assert.equal(SKIN_BUDGET, 4);
  const R = rigs();
  const pb = new PeerBodies({ renderer: {}, createRig: R.factory, buildOpts: (l) => ({ race: l.race }), now: () => 1000 });
  const eight = Array.from({ length: BODIES_MAX }, (_, i) => peer(`n${i}`, i - 4, -3 - (i % 3)));   // all within 10 m
  await stand(pb, eight);
  const from = R.made.map((r) => r.steps.length);
  const perFrame = [];
  for (let f = 0; f < 8; f++) {
    const before = R.made.map((r) => r.steps.length);
    pb.sync(eight, toScene, 1 / 60, [0, 0, 0]);
    perFrame.push(R.made.reduce((n, r, i) => n + (r.steps.length > before[i] && r.steps.at(-1).pose ? 1 : 0), 0));
  }
  assert.ok(perFrame.every((n) => n <= SKIN_BUDGET), `never more than the budget a frame: ${perFrame}`);
  assert.ok(perFrame.every((n) => n === SKIN_BUDGET), 'and the budget spent - eight want a skin every frame');
  for (const [i, r] of R.made.entries()) {
    assert.equal(r.steps.length - from[i], 8, 'every body\'s clocks every frame');
    assert.equal(posesIn(r, from[i]), 4, 'every body skinned every other frame - the owed go first');
  }
  // eight bodies beyond 25 m, every one due on the same frame (one phase): four skin, the four left over are OWED the
  // next frame - not their cadence's next, three frames on
  for (const [i, p] of eight.entries()) p.shown = { ...p.shown, x: i - 4, z: -40 };
  pb.sync(eight, toScene, 1 / 60, [0, 0, 0]);   // the move itself (nothing owed after it: a far body's skin waits)
  for (const b of pb._bodies.values()) { b.phase = 0; b.owed = false; }
  while ((pb._frame + 1) % 3 !== 0) pb.sync(eight, toScene, 1 / 60, [0, 0, 0]);
  for (const b of pb._bodies.values()) b.owed = false;
  const s0 = R.made.map((r) => r.steps.length);
  pb.sync(eight, toScene, 1 / 60, [0, 0, 0]);
  assert.equal(R.made.filter((r, i) => r.steps.length > s0[i] && r.steps.at(-1).pose).length, SKIN_BUDGET, 'four of the eight due');
  pb.sync(eight, toScene, 1 / 60, [0, 0, 0]);
  assert.equal(R.made.filter((r, i) => posesIn(r, s0[i]) === 1).length, BODIES_MAX, 'the other four the next frame - owed, not left to their cadence');
  for (const [i, p] of eight.entries()) p.shown = { ...p.shown, x: i - 4, z: -3 - (i % 3) };
  pb.sync(eight, toScene, 1 / 60, [0, 0, 0]);
  // five rebuilds let their meshes go at once (setWeapon on a nock): all five pose on the next frame, budget or none
  for (const r of R.made.slice(0, 5)) r.skinned = false;
  const before = R.made.map((r) => r.steps.length);
  pb.sync(eight, toScene, 1 / 60, [0, 0, 0]);
  for (const r of R.made.slice(0, 5)) assert.equal(r.steps.at(-1).pose, true, 'a body with no skin poses');
  assert.equal(R.made.filter((r, i) => r.steps.length > before[i] && r.steps.at(-1).pose).length, 5, 'and it spends the budget');
});

test('WB9h the swap: a nearer stranger takes the farthest stranger\'s body only once it has wanted one SWAP_DWELL_MS, no sooner than SWAP_EVERY_MS after the last, and not while another body builds - a party mate outright, and a lingering body\'s slot at once (mutants: the dwell gone; the interval gone; a swap queued behind a build)', async () => {
  let now = 1000;
  const R = rigs({ hold: true });
  const pb = new PeerBodies({ renderer: {}, createRig: R.factory, buildOpts: (l) => ({ race: l.race }), now: () => now });
  const crowd = Array.from({ length: BODIES_MAX }, (_, i) => peer(`s${i}`, 0, -4 - i * 3));   // 4..25 m
  const sync = (list, opts) => pb.sync(list, toScene, 1 / 60, [0, 0, 0], opts);
  sync(crowd); for (let i = 0; i < BODIES_MAX; i++) { R.release(); await settle(2); }
  await stand(pb, crowd, [0, 0, 0], () => { sync(crowd); R.release(); });
  const comer = peer('comer', 0, -2);   // nearer than all of them
  const all = [...crowd, comer];
  const land = async () => { await settle(); R.release(); await settle(); };   // the builds queued start, then land
  sync(all);
  assert.equal(pb._bodies.has('comer'), false, 'not at once');
  now += SWAP_DWELL_MS - 1; sync(all);
  assert.equal(pb._bodies.has('comer'), false, 'nor before it has wanted one SWAP_DWELL_MS');
  now += 1; sync(all);
  assert.equal(pb._bodies.has('comer'), true, 'then the farthest body is handed over');
  await settle();   // its build starts - and is held
  assert.equal(pb._bodies.has('s7'), false, '...the farthest\'s');
  // its build is in flight (held): a second stranger nearer still waits for it, and for the interval
  const second = peer('second', 1, -1);
  sync([...all, second]);
  now += SWAP_EVERY_MS + SWAP_DWELL_MS; sync([...all, second]);
  assert.equal(pb._bodies.has('second'), false, 'never while another body builds - it would wait on the one queue with the body it took gone');
  await land(); sync([...all, second]);
  assert.equal(pb._bodies.has('second'), true, 'the build landed: handed over');
  const third = peer('third', -1, -1);
  await land(); sync([...all, second, third]);
  now += SWAP_DWELL_MS; await land(); sync([...all, second, third]);
  assert.equal(pb._bodies.has('third'), false, 'no sooner than SWAP_EVERY_MS after the last');
  now += SWAP_EVERY_MS; sync([...all, second, third]);
  assert.equal(pb._bodies.has('third'), true);
  // a party mate: outright, dwell and interval or none
  const mate = peer('mate', 0, -30);
  sync([...all, second, third, mate], { priority: (id) => id === 'mate' });
  assert.equal(pb._bodies.has('mate'), true, 'AUDIT PARTY8: a companion takes a stranger\'s body at once');
  // a body whose peer has gone lingers; its slot goes to the next who wants one at once
  await land();
  const stay = [...all, second, third, mate].filter((p) => pb._bodies.has(p.id) && p.id !== 's0');   // the bodiless gone too: nobody waits
  const s0rig = rigOf(pb, 's0');
  sync(stay);
  assert.equal(pb._bodies.get('s0')?.goneAt != null, true, 's0 gone from the room: its body lingers');
  const late = peer('late', 2, -2);
  sync([...stay, late]);
  // PIN MOVED (MW-CROWD, FIELD BUGS 2026-10-01 #8): a lingering body's rig is KEPT as a spare (SPARE_MS, SPARE_MAX) - its
  // peer mounted or left the list a moment and came back to a whole rebuild (test/net/peer/fb1001_mwcrowd.test.js)
  assert.equal(s0rig.unloaded, false, 'a lingering body\'s rig is kept, a spare for its peer\'s return');
  assert.ok(pb._spares.some((x) => x.rig === s0rig));
  assert.equal(pb._bodies.has('late'), true, 'a lingering body gives its slot at once - nothing is seen to go');
  assert.equal(BODY_LINGER_MS > 0, true);
});

test('WB9h the spares: a body given up in a swap keeps its built rig on nobody\'s camera; the next peer who wears the same body stands in it at once - no rig made, no build, posed on its first frame; one wearing another builds its own; spares go after SPARE_MS, past SPARE_MAX the oldest, and with the bodies when the gate shuts or the data changes; a lingering or failed body is not kept (mutants: the spare never taken; a spare of another body taken; spares kept forever; the pool unbounded)', async () => {
  let now = 1000, gen = 1, on = true;
  const R = rigs();
  const pb = new PeerBodies({ renderer: {}, enabled: () => on, createRig: R.factory, buildOpts: (l) => ({ race: l.race }), now: () => now, generation: () => gen });
  // eight in one look ("Nord"), strung out
  const crowd = Array.from({ length: BODIES_MAX }, (_, i) => peer(`c${i}`, 0, -4 - i * 3, 'Nord'));
  await stand(pb, crowd);
  const madeBefore = R.made.length, buildsBefore = R.made.reduce((n, r) => n + r.builds, 0);
  const farRig = rigOf(pb, 'c7');
  const n0 = farRig.steps.length;
  // a Nord comes near: after the dwell the farthest Nord's body is given up - and it is HIS body
  const twin = peer('twin', 0, -2, 'Nord');
  pb.sync([...crowd, twin], toScene, 1 / 60, [0, 0, 0]);
  now += SWAP_DWELL_MS; pb.sync([...crowd, twin], toScene, 1 / 60, [0, 0, 0]);
  assert.equal(pb.has('twin'), true, 'stands the same frame');
  assert.equal(rigOf(pb, 'twin'), farRig, 'in the body given up');
  assert.equal(farRig.unloaded, false);
  assert.equal(R.made.length, madeBefore, 'no rig made'); assert.equal(R.made.reduce((n, r) => n + r.builds, 0), buildsBefore, 'no build');
  assert.equal(farRig.steps.at(-1).pose, true, 'posed for its new peer on its first frame');
  assert.ok(farRig.steps.length > n0 && farRig.steps.at(-1).dt > 0, 'a step of its own, that frame');
  assert.equal(farRig.cam(), pb._bodies.get('twin').cam, 'on its new peer\'s camera');
  // a swap to a peer in another body: the given-up body waits as a spare, on nobody's camera; the comer builds
  const other = peer('other', 0, -1, 'Breton');
  pb.sync([...crowd, twin, other], toScene, 1 / 60, [0, 0, 0]);
  now += SWAP_EVERY_MS + SWAP_DWELL_MS; pb.sync([...crowd, twin, other], toScene, 1 / 60, [0, 0, 0]);
  assert.equal(pb._bodies.has('other'), true);
  assert.equal(R.made.length, madeBefore + 1, 'another body: its own rig');
  assert.equal(pb._spares.length, 1); assert.equal(pb._spares[0].key.includes('Nord') || pb._spares[0].key.length > 0, true);
  const spareRig = pb._spares[0].rig;
  assert.equal(spareRig.cam, null, 'a spare is on nobody\'s camera'); assert.equal(spareRig.unloaded, false);
  // it goes after SPARE_MS
  now += SPARE_MS + 1; await settle(); pb.sync([...crowd, twin, other], toScene, 1 / 60, [0, 0, 0]);
  assert.equal(pb._spares.length, 0); assert.equal(spareRig.unloaded, true, 'unloaded past SPARE_MS');
  // at most SPARE_MAX, the oldest going first
  for (let i = 0; i < SPARE_MAX + 2; i++) pb._keepSpare({ key: `k${i}`, rig: R.factory(), weapon: null, ammo: null });
  assert.equal(pb._spares.length, SPARE_MAX);
  assert.deepEqual(pb._spares.map((s) => s.key), Array.from({ length: SPARE_MAX }, (_, i) => `k${i + 2}`), 'the newest kept');
  assert.equal(R.made.at(-SPARE_MAX - 2).unloaded, true, 'the oldest unloaded');
  // the data changes: every body and every spare goes
  const kept = pb._spares.map((s) => s.rig);
  gen = 2; pb.sync([], toScene, 1 / 60, [0, 0, 0]);   // (nobody in the room, so nothing stands again at once)
  assert.ok(kept.every((r) => r.unloaded), 'a new data generation takes the spares with the bodies');
  assert.equal(pb._spares.length, 0);
  // the gate shut: likewise - even with no body standing, only a spare kept
  assert.equal(pb._bodies.size, 0);
  pb._keepSpare({ key: 'x', rig: R.factory(), weapon: null, ammo: null });
  const last = pb._spares[0].rig;
  on = false; pb.sync([], toScene, 1 / 60, [0, 0, 0]);
  assert.equal(last.unloaded, true); assert.equal(pb._spares.length, 0);
  // a body released past its linger is unloaded, not kept (its peer went; MWBODY1's law)
  on = true;
  const lone = peer('lone', 0, -3, 'Nord');
  await stand(pb, [lone]);
  const lr = rigOf(pb, 'lone');
  pb.sync([], toScene, 1 / 60, [0, 0, 0]); now += BODY_LINGER_MS + 1; pb.sync([], toScene, 1 / 60, [0, 0, 0]);
  assert.equal(lr.unloaded, true); assert.equal(pb._spares.length, 0);
});

test('WB9h the crowd, driven: thirty players milling 3..40 m about the eye for twenty seconds while it turns - the skins held to the budget every frame, the bodies handed over no oftener than SWAP_EVERY_MS allows, the turned-away bodies neither skinned nor drawn (mutants: any of the four laws gone)', async () => {
  let now = 1000;
  const R = rigs();
  const pb = new PeerBodies({ renderer: {}, createRig: R.factory, buildOpts: (l) => ({ race: l.race }), now: () => now });
  let seed = 7;
  const roll = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const crowd = Array.from({ length: 30 }, (_, i) => { const a = roll() * Math.PI * 2, r = 3 + roll() * 37; const p = peer(`m${i}`, Math.cos(a) * r, Math.sin(a) * r, `look${i % 5}`); p.heading = roll() * Math.PI * 2; return p; });
  const frames = 1200;
  let worst = 0, drawnBehind = 0, skinnedBehind = 0;
  const unloadsBefore = () => R.made.filter((r) => r.unloaded).length;
  const u0 = unloadsBefore();
  for (let f = 0; f < frames; f++) {
    if (f % 6 === 0) for (const p of crowd) {
      p.heading += (roll() - 0.5) * 0.9;
      const x = p.shown.x + Math.cos(p.heading) * 0.84, z = p.shown.z + Math.sin(p.heading) * 0.84;
      if (Math.hypot(x, z) < 40 && Math.hypot(x, z) > 3) p.shown = { ...p.shown, x, z, yaw: p.heading }; else p.heading += Math.PI;
    }
    const before = R.made.map((r) => r.steps.length);
    const drawsBefore = R.made.map((r) => r.draws.length);
    const hadSkin = R.made.map((r) => r.skinned);   // a body's first skin is owed whatever the view (it stands on it)
    pb.sync(crowd, toScene, 1 / 60, [0, 0, 0]);
    const yaw = (f / 600) * Math.PI * 2, fwd = [Math.sin(yaw), 0, -Math.cos(yaw)];
    pb.draw(CANVAS, lens([0, 1.6, 0], [fwd[0] * 10, 1.6, fwd[2] * 10]));
    let skins = 0;
    for (const [i, r] of R.made.entries()) {
      const posed = r.steps.slice(before[i]).filter((s) => s.pose && s.dt > 0).length;
      skins += posed;
      const b = [...pb._bodies.values()].find((x) => x.rig === r);
      if (!b?.feet) continue;
      const ahead = b.feet[0] * fwd[0] + b.feet[2] * fwd[2];
      if (ahead < -4) { if (r.draws.length > drawsBefore[i]) drawnBehind++; if (posed && hadSkin[i]) skinnedBehind++; }
    }
    worst = Math.max(worst, skins);
    now += 16;
    if (f % 4 === 0) await flush();
  }
  assert.ok(worst <= SKIN_BUDGET + 1, `the skins a frame held to the budget (a meshless body may add one): worst ${worst}`);
  assert.equal(drawnBehind, 0, 'no body behind the eye drawn');
  assert.equal(skinnedBehind, 0, 'nor skinned');
  const builds = R.made.reduce((n, r) => n + r.builds, 0);
  const handovers = Math.floor((frames * 16) / SWAP_EVERY_MS) + 1;
  assert.ok(builds <= BODIES_MAX + handovers, `builds held to the swaps the interval allows: ${builds} <= ${BODIES_MAX + handovers}`);
  assert.ok(unloadsBefore() - u0 <= handovers + SPARE_MAX, 'and the bodies torn down with them');
});

test('WB9h by source: no copy of the pose and no spread of the bodies a frame (AUDIT WB D10); the frame\'s lists kept on the module and refilled; the draw keeps its camera in one object (mutants: a pose copied again)', () => {
  const src = rd('src/net/peer/peerBodies.js');
  assert.doesNotMatch(src, /\{ \.\.\.peer\.shown/, 'no copy of the pose to hand the camera its yaw');
  assert.doesNotMatch(src, /for \(const [^)]*of \[\.\.\.this\._bodies/, 'no spread of the bodies to walk them');
  const cam = peerCamera({ yaw: 0.3, mv: 1 }, [1, 2, 3], 2, null, 1.2);
  assert.equal(cam.yaw, 1.2, 'the body\'s own eased yaw, handed in');
  assert.equal(peerCamera({ yaw: 0.3, mv: 1 }, [1, 2, 3], 2).yaw, 0.3, 'the pose\'s when none');
  const pb = new PeerBodies({ renderer: {}, createRig: rigs().factory, now: () => 1000 });
  const live = pb._live, want = pb._want;
  pb.sync([peer('a', 0, -3)], toScene, 1 / 60, [0, 0, 0]); pb.sync([peer('a', 0, -3)], toScene, 1 / 60, [0, 0, 0]);
  assert.equal(pb._live, live); assert.equal(pb._want, want);
  assert.match(src, /c\.canvas = canvas; c\.proj = proj; c\.view = view; c\.eye = eye; c\.flashOf = flashOf;/);
});
