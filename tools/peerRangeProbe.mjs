// ═══════════════════════════════════════════════════════════════════
// THE PEER RANGE PROBE (PEER-RANGE, 2026-10-10). The owner: "So for
// online performance, I believe the rendering of players far out is
// contributing to poor performance."
//
// What a crowd costs the frame when most of it stands far out - the
// world cell's case: the relay hands the screen every player within
// three map pixels (net/wire.js RANGE_PIXELS, nearly 2,500 m). It drives
// the REAL net/peer/peerRange.js cut in front of the REAL RemotePlayers on its
// class-sprite path (each peer a MobileUnit, stepped and faced every
// frame) and the REAL Renderer's drawBillboards over a counting GL, once
// at "Everyone" (range 0 - the cut off, the frame as it was before
// PEER-RANGE) and once at each distance tier:
//
//   handed        peers the layers were handed a frame
//   GL calls      the billboard pass's, a frame
//   draws         its draw calls, a frame
//   sync ms       RemotePlayers.sync, a frame (this container's CPU)
//
// Every peer stands in front of the eye, within 25 degrees of straight
// ahead and inside the far plane - the case of a player looking across a
// crowded square at the town beyond, where the renderer's own frustum cull
// (PERF-CROWD2) would pass them all. That cull is NOT exercised here: the
// counting renderer is handed no camera, so it draws every batch (AUDIT
// PEER-RANGE + HALO-THIN C8). The crowd walks. The class sprite is the
// one layer measured: Eye Of The Beholder's walkers and riders, their
// lanterns, the auras and the casts are cut by the same list and are not
// in these numbers. The milliseconds are relative only; the counts are
// exact.
//
//   node tools/peerRangeProbe.mjs
// ═══════════════════════════════════════════════════════════════════
import { RemotePlayers } from '../src/net/remotePlayers.js';
import { createPeerRange, PEER_RANGE_TIERS } from '../src/net/peer/peerRange.js';
import { Renderer } from '../src/render/renderer.js';

function countingRenderer() {
  const log = { calls: 0, draws: 0 };
  const gl = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (typeof k === 'string' && k.startsWith('create')) return () => ({});
      if (k === 'drawingBufferWidth' || k === 'drawingBufferHeight') return 1600;
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;   // GL enums
      if (typeof k !== 'string') return () => {};
      return () => {
        log.calls++;
        if (k === 'drawArrays' || k === 'drawElements' || k === 'drawArraysInstanced' || k === 'drawElementsInstanced') log.draws++;
        return undefined;
      };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 1600, clientHeight: 900, width: 1600, height: 900 };
  return { r: new Renderer(canvas), log };
}

/** A class sprite's texture as the mobile path reads it: five frames a record, a 64 x 128 picture at scale 0. */
const fakeTex = { archive: 4321, getFrameCount: () => 5, getSize: () => ({ width: 64, height: 128 }), getScale: () => ({ width: 0, height: 0 }) };

/** A seeded roll, so every arm sees the same crowd. */
function roll(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

/** `n` peers in front of the eye (within 25 degrees of straight ahead), `near` of them within 120 m and the rest
 *  spread 320 m to 2,400 m - the relay's three map pixels. */
function crowd(n, near) {
  const r = roll(7);
  return Array.from({ length: n }, (_, i) => {
    const d = i < near ? 10 + r() * 110 : 320 + r() * 2080;
    const a = (r() - 0.5) * (50 * Math.PI / 180);
    return { id: `peer-${String(i).padStart(4, '0')}`, look: { class: 'Warrior', gender: 'male' }, base: [Math.sin(a) * d, 0, -Math.cos(a) * d], phase: r() * 6.283 };
  });
}

const flush = () => new Promise((res) => setTimeout(res, 0));
const toScene = (p) => [p.x, p.y, p.z];
const FRAMES = 300, DT = 1 / 60;

async function arm(rows, range) {
  const { r, log } = countingRenderer();
  const deps = { fetchBytes: null, palette: null, getTexture: async () => fakeTex, uploadRecordFrame: (archive, rec, frame) => r.textures.set(`${archive}_${rec}#${frame}`, {}), audio: null };
  const rp = new RemotePlayers({ renderer: r, deps, compose: async () => null });
  const cut = createPeerRange();
  const eye = [0, 1.7, 0];
  const peers = rows.map((p) => ({ id: p.id, look: p.look, shown: { x: p.base[0], y: 0, z: p.base[2], yaw: 0, mv: 1, an: 0 } }));
  const step = (f) => {
    for (let i = 0; i < peers.length; i++) {   // each walks a 2 m ring round its own place
      const p = rows[i], t = f * DT + p.phase;
      peers[i].shown = { x: p.base[0] + Math.cos(t) * 2, y: 0, z: p.base[2] + Math.sin(t) * 2, yaw: t, mv: 1, an: 0 };
    }
    return cut.cut(peers, { me: eye, at: (d) => toScene(d.shown), range });
  };
  for (let f = 0; f < 4; f++) { rp.sync(step(f), toScene, { dt: DT, eye }); await flush(); }   // the bundles build
  let handed = 0, syncMs = 0;
  log.calls = 0; log.draws = 0;
  for (let f = 0; f < FRAMES; f++) {
    const list = step(f);
    handed += list.length;
    const t0 = process.hrtime.bigint();
    rp.sync(list, toScene, { dt: DT, eye });
    syncMs += Number(process.hrtime.bigint() - t0) / 1e6;
    r.drawBillboards(rp.batches(), [1, 0, 0], [0, 1, 0]);
  }
  rp.destroy();
  return { handed: handed / FRAMES, calls: log.calls / FRAMES, draws: log.draws / FRAMES, syncMs: syncMs / FRAMES };
}

await arm(crowd(60, 10), 0);   // one arm thrown away: the first one measured was paying V8's warm-up
console.log(`\nTHE PEER RANGE - a walking crowd in front of the eye, most of it far out (${FRAMES} frames each)\n`);
console.log('crowd  near   range      handed   GL calls    draws   sync ms');
for (const [n, near] of [[20, 5], [60, 10], [120, 15]]) {
  const rows = crowd(n, near);
  for (const range of [0, ...PEER_RANGE_TIERS.filter((t) => t > 0)]) {
    const a = await arm(rows, range);
    const label = range ? `${range} m` : 'Everyone';
    console.log(`${String(n).padStart(5)}  ${String(near).padStart(4)}  ${label.padStart(9)}  ${a.handed.toFixed(1).padStart(8)}  ${a.calls.toFixed(1).padStart(9)}  ${a.draws.toFixed(1).padStart(7)}  ${a.syncMs.toFixed(4).padStart(8)}`);
  }
}
console.log('');
