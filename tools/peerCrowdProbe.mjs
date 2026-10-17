// ═══════════════════════════════════════════════════════════════════
// THE PEER CROWD PROBE (WB9h, 2026-09-30). Mac: "Further improve the
// morrowind model performance as it's unplayable with so many players
// around."
//
// tools/peerBodiesProbe.mjs measured a body walking past on its own.
// A CROWD is the other case: forty players milling round you at a gate
// or in a square, you turning to look at them. It drives the REAL
// PeerBodies over the REAL rig (createFpArm on the test fixtures, as
// the cadence pins do) with a counting renderer, and reports what the
// Morrowind bodies cost across the run:
//
//   skins/frame     poses + mesh uploads (the CPU skin, PERF-RIG1's
//                   ~0.3 ms a body at 3,000 vertices - far more for a
//                   clothed retail body)
//   worst frame     the most skins any one frame took (a hitch)
//   sprites/frame   the per-body sprite renders (an offscreen pass each)
//   builds          rigs built - each a multi-second mesh parse on a
//                   retail body - and the most started in any 5 s
//   lost near       a body taken from a player still standing within 25 m -
//                   seen as a Morrowind body turning back into a doll
//
// The fixture rig is four small pieces, so the milliseconds mean
// nothing and are not reported; the COUNTS are exact.
//
//   node tools/peerCrowdProbe.mjs
// ═══════════════════════════════════════════════════════════════════
import { PeerBodies, BODIES_MAX } from '../src/net/peer/peerBodies.js';
import { createFpArm } from '../src/combat/fpArm.js';
import { fixtureBodyDeps, countingRenderer } from '../test/fixtures/mw/bodyRig.mjs';

const flush = () => new Promise((r) => setTimeout(r, 0));
const toScene = (p) => [p.x, p.y, p.z];
const W = 1600, H = 900;
const CANVAS = { clientWidth: W, clientHeight: H, width: W, height: H };
/** a 70-degree lens, 16:9, near 0.2 */
const proj = new Float64Array([1.428 / (W / H), 0, 0, 0, 0, 1.428, 0, 0, 0, 0, -1.0004, -1, 0, 0, -0.40008, 0]);
/** the eye at the origin turned `yaw` about up (the view looks down -z at yaw 0) */
const viewAt = (yaw) => { const c = Math.cos(yaw), s = Math.sin(yaw); return new Float64Array([c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]); };
/** a seeded roll, so every run sees the same crowd */
const roller = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

async function run({ peers: n = 40, frames = 1800, turn = true, looks = 6 } = {}) {
  const deps = fixtureBodyDeps();
  const renderer = countingRenderer();
  let now = 1000;
  const made = { rigs: 0, builds: 0, unloads: 0 };
  const createRig = () => {
    const rig = createFpArm();
    made.rigs++;
    const build = rig.build.bind(rig), unload = rig.unload.bind(rig);
    rig.build = (o) => { made.builds++; buildTimes.push(now); return build(o); };
    rig.unload = () => { made.unloads++; return unload(); };
    return rig;
  };
  const buildTimes = [];
  const pb = new PeerBodies({ renderer, createRig, buildOpts: () => ({ race: 'fprace', deps }), now: () => now });
  const roll = roller(9);
  // forty players milling in a ring 3..40 m about the eye, a few looks shared among them (a crowd's starting gear)
  const peers = Array.from({ length: n }, (_, i) => {
    const a = roll() * Math.PI * 2, r = 3 + roll() * 37;
    return { id: `p${i}`, told: true, look: { race: 'fprace', gender: 'male', faceIndex: i % looks, items: [] }, heading: roll() * Math.PI * 2,
      shown: { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, yaw: 0, pitch: 0, mv: 1, wd: 0, an: 0, as: 0, am: 0, sr: 0, cn: 0, cr: 0 } };
  });
  const step = () => {
    for (const p of peers) {
      p.heading += (roll() - 0.5) * 0.9;
      let x = p.shown.x + Math.cos(p.heading) * 0.14 * 6, z = p.shown.z + Math.sin(p.heading) * 0.14 * 6;   // a walk, one wire pose in six frames
      const d = Math.hypot(x, z);
      if (d > 40 || d < 3) { p.heading += Math.PI; x = p.shown.x; z = p.shown.z; }
      p.shown = { ...p.shown, x, z, yaw: p.heading };
    }
  };
  let worst = 0, worstSprites = 0, skins = 0, sprites = 0, torn = 0;
  const seenIn = new Set();
  for (let fr = 0; fr < frames; fr++) {
    if (fr % 6 === 0) step();
    const up0 = renderer.c.uploads, sp0 = renderer.c.sprites;
    const standing = new Set(peers.filter((p) => pb.has(p.id)).map((p) => p.id));
    pb.sync(peers, toScene, 1 / 60, [0, 0, 0]);
    const yaw = turn ? (fr / 600) * Math.PI * 2 : 0;
    pb.draw(CANVAS, { proj, view: viewAt(yaw), eye: [0, 0, 0] });
    now += 16;
    for (let k = 0; k < 3; k++) await flush();
    const s = renderer.c.uploads - up0, q = renderer.c.sprites - sp0;
    if (fr >= 120) { skins += s; sprites += q; worst = Math.max(worst, s); worstSprites = Math.max(worstSprites, q); }
    // a body taken from a player still standing within 25 m - churn seen as a body turning back into a doll
    for (const id of standing) if (!pb.has(id)) { const p = peers.find((x) => x.id === id); if (Math.hypot(p.shown.x, p.shown.z) < 25) torn++; }
    for (const p of peers) if (pb.has(p.id)) seenIn.add(p.id);
  }
  let burst = 0;
  for (let i = 0; i < buildTimes.length; i++) { let k = i; while (k + 1 < buildTimes.length && buildTimes[k + 1] - buildTimes[i] < 5000) k++; burst = Math.max(burst, k - i + 1); }
  const live = frames - 120;
  return { skins: skins / live, worst, sprites: sprites / live, worstSprites, builds: made.builds, rigs: made.rigs, burst, torn, bodied: seenIn.size };
}

console.log(`\nTHE PEER CROWD - forty players milling 3..40 m about you for 30 s (1800 frames), BODIES_MAX ${BODIES_MAX}; fixture rig, so the counts are the measure\n`);
console.log('case                     skins/frame  worst  sprites/frame  worst  builds  most in 5 s  lost near');
for (const [name, opts] of [['you turning (a full turn in 10 s)', { turn: true }], ['you looking one way', { turn: false }]]) {
  const r = await run(opts);
  console.log(`${name.padEnd(34).slice(0, 34)} ${r.skins.toFixed(2).padStart(6)} ${String(r.worst).padStart(6)} ${r.sprites.toFixed(2).padStart(10)} ${String(r.worstSprites).padStart(8)} ${String(r.builds).padStart(7)} ${String(r.burst).padStart(10)} ${String(r.torn).padStart(12)}`);
}
