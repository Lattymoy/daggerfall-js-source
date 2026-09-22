// ═══════════════════════════════════════════════════════════════════
// THE PEER BODIES PROBE (2026-09-22). Mac: "look for ways to improve
// online performance."
//
// PERF-ON2 measured the online frame - the session, the names, the
// billboard draw - and found each cheap (tools/onlinePerfProbe.mjs).
// It never measured the peer BODIES. A peer in a Morrowind body is a
// whole `createFpArm()` rig: every frame `PeerBodies.sync` steps it,
// and a step is `poseAssembly` (the skeleton posed, every skinned
// vertex blended in JS), `uploadThirdMesh` (the whole packed mesh
// re-uploaded) and `stepRigEffects`; then `draw` renders it into the
// sprite target. PERF-RIG1 put the skin alone at ~0.3 ms a body a
// frame at 3,000 vertices - and it is paid per body, up to BODIES_MAX.
//
// Against what? A peer's pose arrives at POSE_HZ (10 a second) and is
// eased; the drawn body is a sprite quantised to MW_ARM_PIXEL blocks.
// Re-skinning that at the frame rate is oversampling.
//
// This drives the REAL PeerBodies over the REAL rig (createFpArm on the
// test fixtures, through the same doors fparm.test.js uses) with a
// counting renderer, and reports per frame: the poses (mesh uploads),
// the sprite renders, and the milliseconds - at 1, 4 and 8 bodies, over
// 600 frames of peers walking past. The fixture rig is four small
// pieces, so the milliseconds UNDERSTATE a retail body by an order of
// magnitude; the COUNTS are exact, and the ratio before/after a change
// is what the numbers are for.
//
// PEER-CADENCE (same day): and then the fix, measured by the same
// numbers. The skin is re-posed on a distance cadence (POSE_CADENCE:
// every frame within 10 m, every second frame to 25 m, every third
// beyond) while the clips advance every frame; the peers here walk
// from 4 m out to 50 m, so the counts fall as they go. Before: 1.00
// poses+uploads a body a frame at every count. After: 0.74 / 0.52 /
// 0.43 at 1 / 4 / 8 bodies. The sprite render is still one a body a
// frame - the sprite target is one shared RT, so a body's picture
// cannot be kept across frames without a target of its own; that is
// the open item.
//
//   node tools/peerBodiesProbe.mjs
// ═══════════════════════════════════════════════════════════════════
import { PeerBodies, BODIES_MAX, POSE_CADENCE } from '../src/net/peerBodies.js';
import { createFpArm } from '../src/combat/fpArm.js';
import { fixtureBodyDeps, countingRenderer } from '../test/fixtures/mw/bodyRig.mjs';   // PEER-CADENCE: the fixture rig, shared with the pins

const flush = () => new Promise((r) => setTimeout(r, 0));
const toScene = (p) => [p.x, p.y, p.z];
const W = 1600, H = 900;
const CANVAS = { clientWidth: W, clientHeight: H, width: W, height: H };
/** a looking-down-the-road view, the eye at the origin */
const view = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const proj = new Float64Array([1.2, 0, 0, 0, 0, 2.1, 0, 0, 0, 0, -1, -1, 0, 0, -0.4, 0]);

async function run(n, frames = 600) {
  const deps = fixtureBodyDeps();
  const renderer = countingRenderer();
  let now = 1000;
  const pb = new PeerBodies({ renderer, createRig: createFpArm, buildOpts: () => ({ race: 'fprace', deps }), now: () => now });
  // n peers strung out ahead of the eye, 4..(4+6n) metres, walking
  const peers = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, told: true, look: { race: 'fprace', gender: 'male', faceIndex: 0, items: [] },
    shown: { x: (i % 2 ? 1.5 : -1.5), y: 0, z: -(4 + i * 6), yaw: 0, pitch: 0, mv: 1, wd: 0, an: 0, as: 0, am: 0, sr: 0, cn: 0, cr: 0 } }));
  // build them all (one at a time is the module's law; wait it out)
  for (let i = 0; i < 40 && !peers.every((p) => pb.has(p.id)); i++) {
    pb.sync(peers, toScene, 1 / 60, [0, 0, 0]); now += 16;
    for (let k = 0; k < 8; k++) await flush();
  }
  for (const p of peers) if (!pb.has(p.id)) throw new Error(`body ${p.id} never stood`);
  Object.assign(renderer.c, { meshes: 0, uploads: 0, sprites: 0, quads: 0 });
  const t0 = performance.now();
  for (let fr = 0; fr < frames; fr++) {
    // the wire: a pose every 6 frames (POSE_HZ 10 at 60 fps), walking on
    if (fr % 6 === 0) for (const p of peers) p.shown = { ...p.shown, z: p.shown.z - 0.2 * 6 / 10, yaw: p.shown.yaw + 0.02 };
    pb.sync(peers, toScene, 1 / 60, [0, 0, 0]);
    pb.draw(CANVAS, { proj, view, eye: [0, 0, 0] });
    now += 16;
  }
  const ms = (performance.now() - t0) / frames;
  const c = renderer.c;
  return { n, ms, posesPerBody: c.uploads / frames / n, spritesPerBody: c.sprites / frames / n };
}

console.log(`\nTHE PEER BODIES - what one body costs a frame, over 600 frames of peers walking past 4..50 m (fixture rig: four small pieces, so the ms understate a retail body; the counts are exact)\n  cadence ${POSE_CADENCE.map(([m, n]) => `${m}m:${n}`).join(' ')} (within metres: frames between poses)\n`);
console.log('bodies   ms/frame   poses+uploads/body/frame   sprite renders/body/frame');
for (const n of [1, 4, BODIES_MAX]) {
  const r = await run(n);
  console.log(`${String(r.n).padStart(6)}   ${r.ms.toFixed(3).padStart(8)}   ${r.posesPerBody.toFixed(2).padStart(24)}   ${r.spritesPerBody.toFixed(2).padStart(26)}`);
}
