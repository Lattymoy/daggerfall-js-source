// ═══════════════════════════════════════════════════════════════════
// THE ONLINE FRAME PROBE (2026-09-19). Mac: "Online mode needs further
// performance improvements."
//
// MEASURED, NOT GUESSED - PERF-ON's own rule, and the reason this file
// exists at all. PERF-ON (2026-09-15) measured the online name pass at
// 153 GL calls a name a frame and took it to 14. NAME1 landed
// twenty-six hours later and moved the face a player actually sees off
// that pass entirely: online forces the enhanced lane (OL1), the
// enhanced lane has a `document`, and `nameFrame` returns through
// ui/nameLayer.js before `drawNamePoints` is ever reached.
// remotePlayers.js says so in its own words - the bitmap pass "is what
// a host with no `document` draws, which is every Node probe and every
// suite in test/".
//
// So the last online performance work is measured on a path players do
// not take, and nobody re-measured after the face moved. This probe is
// the missing measurement: a synthetic room, the REAL RemotePlayers,
// the REAL name layer over a counting document, and the REAL
// OnlineSession over test/fakeSocket.mjs, driven frame by frame.
//
//   node tools/onlinePerfProbe.mjs            the default sweep
//   node --expose-gc tools/onlinePerfProbe.mjs   ...with the heap arm
//
// It prints per-peer-per-frame costs, which is the only shape in which
// "the more people that are online, the worse fps becomes" is a number.
// ═══════════════════════════════════════════════════════════════════
import { RemotePlayers, NAME_RANGE, PEER_HEIGHT } from '../src/net/remotePlayers.js';
import { createNameLayer } from '../src/ui/nameLayer.js';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from '../test/fakeSocket.mjs';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';

// ── the counting document: every inline style write, by property ────
function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, id: '', attrs: {},
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } doc.structure++; },
    setAttribute(k, v) { n.attrs[k] = v; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  let text = '', cls = '';
  Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); doc.count('textContent'); } });
  Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); doc.count('className'); } });
  n.style = new Proxy({}, { set(t, k, v) { if (t[k] !== v) doc.count(`style.${String(k)}`); t[k] = v; return true; } });
  return n;
}
function countingDocument() {
  const doc = { structure: 0, built: 0, writes: new Map() };
  doc.count = (k) => doc.writes.set(k, (doc.writes.get(k) ?? 0) + 1);
  doc.createElement = (tag) => { doc.built++; return fakeNode(tag, doc); };
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  doc.zero = () => { doc.structure = 0; doc.built = 0; doc.writes = new Map(); };
  return doc;
}

const W = 1600, H = 900;
const PROJ = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.2, 6000));
const recorder = () => ({ drawScreenQuad: () => {}, drawScreenQuadRun: () => {}, createBillboardBatch: () => ({ origin: [0, 0, 0] }), destroyBillboardBatch: () => {} });

/** A ring of peers around the origin, inside NAME_RANGE so every one of
 *  them is a name the layer has to place - the crowded-square case the
 *  report is about, not a sparse wilderness. */
const ring = (n) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2, r = 6 + (i % 7) * 2.5;
  return { id: `peer-${String(i).padStart(4, '0')}`, name: `Player${i}`, at: [Math.cos(a) * r, 0, -Math.abs(Math.sin(a) * r) - 4] };
});

/** THE NAME ARM: the real namePoints, the real layer, a camera that
 *  walks - because a name only costs what it costs when it MOVES. */
function nameArm(n, frames) {
  const doc = countingDocument();
  const layer = createNameLayer({ doc, now: () => 0 });
  const rp = new RemotePlayers({ renderer: recorder(), deps: null, compose: async () => null });
  const rows = ring(n);
  const heights = new Map(rows.map((r) => [r.id, PEER_HEIGHT]));
  let placed = 0;
  doc.zero();
  for (let f = 0; f < frames; f++) {
    // THE EYE WALKS AND TURNS. The first draft of this fixture strafed a
    // metre and a half on the spot, and it measured 0.94 `left` writes a
    // name against 0.04 `top` and 0.005 `fontSize` - which says nothing
    // about the layer and everything about a camera that never changed
    // anyone's DEPTH. A player walks forward and looks around; that moves
    // every name in x, in y AND in scale, which is the case the layer is
    // actually paid for. Measuring the easy case would have understated
    // the cost by a factor of three and pointed the fix at the wrong
    // property.
    const t = f * 0.06;
    const eye = [Math.sin(t * 0.7) * 3, 1.7, 9 - f * 0.05];
    const yaw = Math.sin(t * 0.45) * 0.6;
    const view = lookAt(eye, [eye[0] + Math.sin(yaw) * 10, 1.7 + Math.sin(t * 0.3) * 0.8, eye[2] - Math.cos(yaw) * 10], [0, 1, 0]);
    rp.sync(rows.map((r) => ({ id: r.id, name: r.name, shown: { x: r.at[0], y: r.at[1], z: r.at[2], yaw: 0 }, look: null })),
      (p) => [p.x, p.y, p.z], { bodyHeight: (id) => heights.get(id) ?? 0 });
    const points = rp.namePoints(PROJ, view, W, H, eye, (p) => [p.x, p.y, p.z], null, null);
    placed += points.length;
    layer.render({ points, hudScale: 1, viewport: 1 });
  }
  const per = (k) => (doc.writes.get(k) ?? 0) / Math.max(1, placed);
  return { placed, perName: placed / frames, doc, per, total: [...doc.writes.values()].reduce((a, b) => a + b, 0) / Math.max(1, placed) };
}

/** THE SESSION ARM: a real OnlineSession with N peers in the room,
 *  ticked. `tick` eases every peer's pose toward its last, every frame. */
function sessionArm(n, frames) {
  const { FakeWS, sockets } = fakeSocketClass();
  let clock = 0;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => clock });
  const pose = (i, k) => ({ x: Math.cos(i) * 20 + k, y: 0, z: Math.sin(i) * 20, yaw: 0, pitch: 0, mv: 1 });
  s.join('world:25,15', pose(0, 0));
  sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: ring(n).map((r, i) => ({ id: r.id, name: r.name, look: {}, pose: pose(i, 0) })) });
  const t0 = process.hrtime.bigint();
  let heap0 = 0, heap1 = 0;
  if (globalThis.gc) { globalThis.gc(); heap0 = process.memoryUsage().heapUsed; }
  for (let f = 0; f < frames; f++) { clock += 16; s.tick(); s.drawable(); }
  if (globalThis.gc) { heap1 = process.memoryUsage().heapUsed; }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { peers: s.peers.size, msPerFrame: ms / frames, heapPerFrame: globalThis.gc ? (heap1 - heap0) / frames : null };
}

const FRAMES = 300;
const COUNTS = [1, 10, 25, 50, 100];
console.log(`\nTHE NAME LAYER - what one name costs per frame, over ${FRAMES} frames of a walking eye\n`);
console.log('peers  names/frame  style.left  style.top  style.fontSize  textContent  className  ALL writes/name');
for (const n of COUNTS) {
  const a = nameArm(n, FRAMES);
  const f = (k) => a.per(k).toFixed(3).padStart(10);
  console.log(`${String(n).padStart(5)}  ${a.perName.toFixed(1).padStart(11)}  ${f('style.left')}  ${f('style.top')}  ${f('style.fontSize')}  ${f('textContent')}  ${f('className')}  ${a.total.toFixed(3).padStart(15)}`);
}
console.log(`\nTHE SESSION - tick() + drawable(), over ${FRAMES} frames\n`);
console.log('peers   ms/frame   bytes/frame' + (globalThis.gc ? '' : '   (run with --expose-gc for the heap arm)'));
for (const n of COUNTS) {
  const b = sessionArm(n, FRAMES);
  console.log(`${String(b.peers).padStart(5)}  ${b.msPerFrame.toFixed(4).padStart(9)}  ${b.heapPerFrame == null ? '        -' : Math.round(b.heapPerFrame).toLocaleString().padStart(11)}`);
}
console.log('');

// ── THE DRAW ARM: what one peer's BODY costs the GL, per frame ──────
// PERF-ON's own instrument (test/audit39_render.test.js's recording
// Proxy), pointed at drawBillboards instead of drawText. PERF-ON
// dismissed this cost in one line - "a peer's doll is one billboard
// batch created once, with only its `origin` written afterwards" -
// which is true about the batch's CREATION and says nothing about its
// per-frame DRAW.
const { Renderer } = await import('../src/render/renderer.js');
function countingRenderer() {
  const log = { calls: 0, draws: 0, binds: 0, uniforms: 0 };
  const gl = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (typeof k === 'string' && k.startsWith('create')) return () => ({});
      if (k === 'drawingBufferWidth' || k === 'drawingBufferHeight') return 1600;
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;   // GL enums
      if (typeof k !== 'string') return () => {};
      return (...a) => {
        log.calls++;
        if (k === 'drawArrays' || k === 'drawElements' || k === 'drawArraysInstanced' || k === 'drawElementsInstanced') log.draws++;
        else if (k === 'bindTexture') log.binds++;
        else if (k.startsWith('uniform')) log.uniforms++;
        return undefined;
      };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 1600, clientHeight: 900, width: 1600, height: 900 };
  return { r: new Renderer(canvas), log };
}

/** N peer dolls, each its own composed look - which is the crowd case:
 *  a distinct texture key a peer, so the PERF3 key-sort saves nothing. */
function drawArm(n, frames) {
  const { r, log } = countingRenderer();
  const batches = [];
  for (let i = 0; i < n; i++) {
    const key = `1024_peer${i}`;
    r.textures.set(key, {});                      // the composed doll, already uploaded
    batches.push({ archive: 1024, record: `peer${i}`, frame: null, size: { w: 1, h: 2 }, origin: [i * 3, 0, -10], vao: {}, count: 6 });
  }
  const zero = () => { log.calls = 0; log.draws = 0; log.binds = 0; log.uniforms = 0; };
  zero();
  for (let f = 0; f < frames; f++) r.drawBillboards(batches, [1, 0, 0], [0, 1, 0]);
  const per = (v) => v / frames / Math.max(1, n);
  return { perPeer: per(log.calls), draws: per(log.draws), binds: per(log.binds), uniforms: per(log.uniforms) };
}

console.log(`THE PEER BODIES - what one peer's billboard costs the GL, per frame (${FRAMES} frames)\n`);
console.log('peers   GL calls/peer   draws/peer   texture binds/peer   uniforms/peer');
for (const n of COUNTS) {
  const d = drawArm(n, FRAMES);
  console.log(`${String(n).padStart(5)}  ${d.perPeer.toFixed(2).padStart(13)}  ${d.draws.toFixed(2).padStart(11)}  ${d.binds.toFixed(2).padStart(19)}  ${d.uniforms.toFixed(2).padStart(14)}`);
}
console.log('');
