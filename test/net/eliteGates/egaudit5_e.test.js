// AUDIT EG V (2026-10-15, the Elite Gates arc's fifth audit; bible/11-Multiplayer/Elite-Gates.md sections 11.9, 15, 25 and
// 29) - FIX GROUP E, "render": the spans' collider, the passes' GL objects and their owner, pinned through the real
// producers (the dungeon host's own collider wrapper, a recording GL under the real passes and the breach client):
//   L6-10  a Spirebridge's plank leaves the collider at its end through the dungeon host's own wrapper (egSpanCollider);
//   L6-7   egSpan's clear names the Beat's pictures' owner (egBeatTellDown, the breach's end);
//   L6-5   the fight's telegraph and crystal passes freed on every way out of the Spire (egFight.js leave), and every GL
//          object the breach client makes back to its baseline after ten halls and every exit kind;
//   GLSH   (lane 6's UNVERIFIED shader objects) glProgram.js buildProgram deletes its two shaders once the link is read,
//          and a failed build frees its program and both shaders;
//   L6-3   THE EDGE LINE sized in the world image's pixels (Retro Picture Mode), as the spans' ghosts are.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf, egCircleOfHall, EG_SEALED_MS, EG_GATHER_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBridgeOf, egBridgeY } from '../../../src/net/eliteGates/egSpanLaw.js';
import { createEgSpan, egSpanCollider } from '../../../src/scenes/eliteGates/egSpan.js';
import { registerSpireObjs } from '../../../src/systems/eliteGates/spireKit.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { Collider } from '../../../src/player/collider.js';
import { egBreachNew, egEnter, egStep, egStateOf, egEnd, egForsake } from '../../../src/net/eliteGates/egBrain.js';
import { validEgOut } from '../../../src/net/wire.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { lookAt, perspective } from '../../../src/world/mat4.js';
import { buildProgram } from '../../../src/render/glProgram.js';
import { GateTelegraphRenderer } from '../../../src/render/gate/gateTelegraph.js';
import { CourtCrystalRenderer } from '../../../src/render/courtCrystals.js';
import { EG_LINE_VS } from '../../../src/render/eliteGates/egLinePass.js';
import { egEdgeLinePx } from '../../../src/world/eliteGates/egLook.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const between = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, `${a} .. ${b}`); return src.slice(i, j); };

/** A recording WebGL2: every object it makes live until deleted (a stray or second delete counted), each uniform set kept
 *  with its program and name (`getUniformLocation` answers both), each program's vertex source known. */
function recordingGl(w = 1920, h = 1080) {
  const live = new Map(), uni = [], vsOf = new Map(), srcOf = new Map();
  let ids = 0, stray = 0;
  const gl = new Proxy({ drawingBufferWidth: w, drawingBufferHeight: h, VERTEX_SHADER: 'VS', FRAGMENT_SHADER: 'FS' }, { get(t, k) {
    if (k in t) return t[k];
    if (typeof k !== 'string') return undefined;
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (p, n) => ({ p, n });
    if (k === 'createShader') return (type) => { const o = { kind: 'Shader', id: ++ids, type }; live.set(o, 'Shader'); return o; };
    if (k === 'shaderSource') return (sh, src) => { srcOf.set(sh, src); };
    if (k === 'attachShader') return (p, sh) => { if (sh.type === 'VS') vsOf.set(p, srcOf.get(sh)); };
    if (/^uniform/.test(k)) return (loc, ...v) => { if (loc && loc.p) uni.push({ p: loc.p, n: loc.n, v }); };
    if (/^create(Buffer|VertexArray|Texture|Program|Framebuffer|Renderbuffer)$/.test(k)) return () => { const o = { kind: k.slice(6), id: ++ids }; live.set(o, o.kind); return o; };
    if (/^delete(Buffer|VertexArray|Texture|Program|Shader|Framebuffer|Renderbuffer)$/.test(k)) return (o) => { if (o && !live.delete(o)) stray++; };
    if (k.toUpperCase() === k) return 1;
    return () => {};
  } });
  const count = () => { const c = {}; for (const k of live.values()) c[k] = (c[k] ?? 0) + 1; return c; };
  return { gl, count, uni, vsOf, stray: () => stray };
}

// ── L6-10 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L6-10 A SPIREBRIDGE\'S PLANK LEAVES THE COLLIDER AT ITS END, through the dungeon host\'s own wrapper (sections 15 and 21: "known to the fair trail" - the relay holds the plank as ground until its end, so every screen must too): the spans stood through egSpanCollider - the wrapper scenes/dungeonContext.js egSpanRide hands them - take a plank\'s bucket out at its end, nothing under the gap after, and its key leaves the host\'s list (egRecircle takes the rest at THE SWAP); the host hands no wrapper of its own (mutants: the wrapper\'s removeBucket dropped; the key kept on the list; the host\'s literal wrapper back)', () => {
  const SEED = 1, HALL = 7, spec = egHallOf(SEED, HALL, 0), b0 = egBridgeOf(spec, 0);
  // the host's own line: the spans stand through egSpanCollider, and no hand-built `{ addMesh }` wrapper is left
  const DC = rd('src/scenes/dungeonContext.js');
  const ride = DC.slice(DC.indexOf('function egSpanRide('), DC.indexOf('function egRecircle('));
  assert.match(ride, /egSpan\.stand\(\{ dynamicDraws, collider: egSpanCollider\(collider, keys\) \}\)/, 'the dungeon host stands the spans through egSpanCollider');
  assert.doesNotMatch(ride, /collider: \{ addMesh/, 'no wrapper of the host\'s own');
  assert.match(DC.slice(DC.indexOf('function egRecircle('), DC.indexOf('function egRecircle(') + 900), /for \(const k of keys\) collider\.removeBucket\(k\);/, 'THE SWAP takes what the list still holds');
  const R = { createMesh: (m) => ({ subMeshes: m.subMeshes }), destroyMesh: () => {} };
  const span = createEgSpan({ renderer: R, seed: SEED, c: spec.c }), dynamicDraws = [], collider = new Collider(), keys = [];
  span.stand({ dynamicDraws, collider: egSpanCollider(collider, keys) });
  const nSteps = keys.length;
  assert.ok(nSteps > 20 && keys.every((k) => collider._buckets.has(k)), 'every step\'s bucket stood, and its key kept');
  const objs = { h: HALL, objs: [], br: [{ g: 0, from: 10_000, until: 16_000 }] };
  registerSpireObjs(() => objs);
  try {
    const mid = (b0.z0 + b0.z1) / 2, top = realmToDungeon(spec.x0 + b0.x, egBridgeY(b0, mid), mid);
    const under = () => collider.raycast([top[0], top[1] + 2, top[2]], [0, -1, 0], 2.5);
    span.ride(10.5, 0.016, null, false);
    assert.ok(Math.abs(under() - 2) < 0.02, 'standing: its top under the gap');
    assert.ok(collider._buckets.has('eg:bridge:7:0:10000') && keys.includes('eg:bridge:7:0:10000'), 'its bucket in, its key kept');
    span.ride(16.0, 0.016, null, false);
    assert.equal(span.planks.length, 0, 'gone at its end');
    assert.equal(collider._buckets.has('eg:bridge:7:0:10000'), false, 'its bucket out of the collider');
    assert.ok(!Number.isFinite(under()), 'nothing under the gap');
    assert.equal(keys.includes('eg:bridge:7:0:10000'), false, 'its key off the host\'s list');
    assert.equal(keys.length, nSteps, 'the steps\' keys kept for THE SWAP');
    span.ride(40, 0.016, null, false);
    assert.ok(!Number.isFinite(under()), 'and never again');
  } finally { registerSpireObjs(null); }
});

// ── L6-7 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L6-7 egSpan\'s clear names the Beat\'s pictures\' owner as egBeatTellUp\'s doc does - the breach\'s end (egBeatTellDown), never "the session\'s"', () => {
  const S = rd('src/scenes/eliteGates/egSpan.js'), clear = S.slice(S.indexOf('    clear() {'));
  assert.match(clear, /the Beat's pictures are the breach's, freed at its end - egBeatTellDown/);
  assert.doesNotMatch(S, /the Beat's pictures are the session's/);
});

// ── GLSH (lane 6's UNVERIFIED shader objects) ────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V GLSH (lane 6\'s shader objects; section 29, EVERY ALLOCATION HAS AN OWNER): render/glProgram.js buildProgram deletes both stages once the link is read - a program built and deleted leaves no shader behind, so a pass rebuilt every breach (the look\'s four) and every circle (the spans\' ghosts) leaves nothing; a build that throws frees its program and both stages, and still throws the driver\'s log (mutants: the shaders kept; the failed program kept)', () => {
  const R = recordingGl();
  const p = buildProgram(R.gl, 'vs', 'fs', 'probe');
  assert.deepEqual(R.count(), { Program: 1 }, 'the program alone stands: both stages flagged for deletion, gone with it');
  R.gl.deleteProgram(p);
  assert.deepEqual(R.count(), {}, 'and nothing once it is deleted');
  const F = recordingGl();
  const bad = new Proxy(F.gl, { get: (t, k) => (k === 'getProgramParameter' || k === 'getShaderParameter' ? () => false : k === 'getShaderInfoLog' ? () => 'ERROR: 0:1: boom' : t[k]) });
  assert.throws(() => buildProgram(bad, 'v', 'f', 'probe'), { message: 'probe shader: ERROR: 0:1: boom' });
  assert.deepEqual(F.count(), {}, 'a build that throws leaves no program and no stage');
  assert.equal(R.stray() + F.stray(), 0, 'nothing freed twice');
});

// ── L6-5 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L6-5 THE FIGHT\'S PASSES HAVE A DESTROY (sections 11.9 and 29): GateTelegraphRenderer frees its program, its three vertex arrays and their buffers - EG-ZG\'s fight floors\' growing DYNAMIC buffer among them - once; CourtCrystalRenderer its two programs, two vertex arrays and four buffers, once; a destroyed pass draws nothing (mutants: a buffer kept; the floors\' buffer kept; a program kept; the crystals\' glow kept; a second destroy freeing again)', () => {
  const R = recordingGl();
  const tel = new GateTelegraphRenderer(R.gl, { spire: true });
  const sh = { kind: 1, origin: [0, 0], end: [0, 0], points: [], r: 2, halfW: 0, halfArc: 0, body: 0, r0: 0, r1: 0, yaw: 0, t: 1, flash: 0, alpha: 1, color: [1, 0, 0], court: 0, style: 0, since: 0, span: 1, after: -1, runS: 0, pool: 0 };
  tel.drawFloors({ draws: [{ sh, f: { y: 0, over: { r: 10, courts: [[0, 0]] } }, first: 0, count: 3 }], buf: new Float32Array(64), n: 6 }, new Float32Array(16), new Float32Array(16), [0, 1, 0], 0);
  assert.deepEqual(R.count(), { Program: 1, VertexArray: 3, Buffer: 3 }, 'its program, the quad\'s, the strip\'s and the floors\'');
  tel.destroy(); tel.destroy();
  assert.deepEqual(R.count(), {}, 'every one freed');
  tel.draw(sh, new Float32Array(16), new Float32Array(16), [0, 1, 0], 0);
  assert.equal(tel.drawn, 0, 'a destroyed pass draws nothing');
  const C = recordingGl();
  const cr = new CourtCrystalRenderer(C.gl);
  assert.deepEqual(C.count(), { Program: 2, VertexArray: 2, Buffer: 4 });
  cr.destroy(); cr.destroy();
  assert.deepEqual(C.count(), {}, 'every one freed');
  cr.draw([{ at: [0, 0, 0], grow: 1, broke: -1, color: [1, 1, 1] }], new Float32Array(16), new Float32Array(16), [0, 1, 0], 0);
  assert.equal(cr.drawn, 0);
  assert.equal(R.stray() + C.stray(), 0, 'nothing freed twice');
});

/** The dungeon host's spans, its own source (scenes/dungeonContext.js - egSpanRide, egRecircle) over `renderer`, and the
 *  line its destroy() frees them by. */
function hostSpans(renderer, loc) {
  const DC = rd('src/scenes/dungeonContext.js');
  const src = between(DC, '  let egSpan = _egHall ? createEgSpan(', '  // SD8c (Super-Dungeons.md section 10): THE BRASS REMNANT');
  const destroyLine = DC.split('\n').find((l) => l.trim().startsWith('egSpan?.clear();'));
  assert.ok(destroyLine, 'the host\'s destroy frees its spans');
  return new Function('_egHall', 'createEgSpan', 'egSpanCollider', 'renderer', 'audio', 'dfLocation', 'dynamicDraws', 'collider', 'opts',
    `${src}\nreturn { egSpanRide, egRecircle, destroy() { ${destroyLine.trim().split(';')[0]}; }, get span() { return egSpan; } };`)(true, createEgSpan, egSpanCollider, renderer, null, loc, [], new Collider(), { sdClock: () => 0 });
}

/** A screen with a breach client over the recording GL `R`: its fight (scenes/eliteGates/egFight.js), its look, the spans stood by the
 *  dungeon host's own lines, every mesh and billboard batch counted. */
function screen(R) {
  const ME = 'acct-0', meshes = new Set(), batches = new Set();
  let mt = 0;
  const renderer = { gl: R.gl, _worldViewportPx: null, createMesh: (m) => { const g = { m, n: ++mt }; meshes.add(g); return g; }, destroyMesh: (g) => { meshes.delete(g); },
    updateMeshVertices: () => {}, createBillboardBatch: () => { const b = { origin: [0, 0, 0] }; batches.add(b); return b; }, destroyBillboardBatch: (b) => { batches.delete(b); } };
  const st = { inside: false, b: null, circle: 0, host: null, swaps: 0 };
  const hostDown = () => { const h = st.host; st.host = null; h?.destroy(); };
  const modes = { get mode() { return st.inside ? 'dungeon' : 'exterior'; }, egHallBreach: () => (st.inside ? st.b : null), egHallCircle: () => (st.inside ? st.circle : null), egPlace: () => true,
    egLeave: () => { st.inside = false; hostDown(); return true; }, egHallReturn: () => null, egSwapDrop: () => {}, egBandsDown: () => 0,
    dungeonCtx: { exitDoors: [], egSpanDraw: (p, v, f) => !!st.host?.span?.drawPass(p, v, f) } };
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } };
  const online = { welcomes: 1, terminal: false, error: null, sendEg: () => true };
  let clock = 1_800_000_000_000;
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 }, renderer,
    account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, say: () => {}, mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [], store: null,
    fight: (link) => createEgFight({ renderer, gl: R.gl, link, me: () => ME, player: () => entity, feet: () => player.pos }), win: { innerWidth: 1920, innerHeight: 1080, matchMedia: () => ({ matches: false }) } });
  const proj = perspective(new Float32Array(16), 1.2, 16 / 9, 0.1, 2000);
  let s = 7;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  function draw() {
    const eye = [player.pos[0], player.pos[1] + 5, player.pos[2] - 8], view = lookAt(new Float32Array(16), eye, player.pos, [0, 1, 0]);
    client.drawPass(proj, view, eye, clock / 1000, null); client.drawSky(proj, view, eye, 0, null);
  }
  /** A breach of two from Hall 1 through Hall `halls`, `frames` a hall (each a director's step, its word, the spans' ride, a
   *  frame and a draw); a new circle stood by the host's ride, THE SWAP's by its recircle. Answers its way out. */
  function breach(n, seed, halls = 10, frames = 25) {
    const bid = `${n}`.padStart(16, '0');
    clock += 3_600_000;
    const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
    const Br = egBreachNew({ b: bid, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed, op: clock - EG_SEALED_MS - 60_000, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
    for (const [sub] of co) egEnter(Br, sub, `ord${sub}${bid}`.padEnd(20, 'x'), 30, clock);
    online.terminal = false;
    st.inside = true; st.b = bid; st.circle = 0;
    registerSpireObjs(() => client.objs());
    const word = () => client.word(validEgOut(JSON.parse(JSON.stringify(egStateOf(Br, clock)))));
    for (let h = 1; h <= halls; h++) {
      Br.h = h; Br.sg = 'arrive'; Br.wk = clock; Br.cnt = { left: 1_500_000, at: clock }; Br.pulledAt = clock; Br.gatherAt = clock - EG_GATHER_MS; Br.su = clock;   // its gather done: woken at the first step
      const spec = egHallOf(seed, h, 0), c = egCircleOfHall(h);
      if (c !== st.circle) {
        if (!st.host) st.host = hostSpans(renderer, { egSeed: seed, egCircle: c, egGeo: 0 }); else { st.host.egRecircle({ seed, c }); st.swaps++; }
        st.circle = c;
      }
      const pos = spec.arrive ? { sx: spec.x0 + spec.arrive.x, z: spec.arrive.z } : { sx: spec.x0, z: 0 };
      player.pos = realmToDungeon(pos.sx, 0, pos.z);
      for (let k = 0; k < frames; k++) {
        clock += 100;
        const said = egStep(Br, clock, Object.entries(Br.mem).filter(([, m]) => m.alive).map(([sub]) => ({ sub, sx: pos.sx, z: pos.z, dead: false, at: clock })), rng);
        for (const w of said) if (!w.to || w.to === ME) { const v = validEgOut(JSON.parse(JSON.stringify(w))); if (v) client.word(v); }   // the room's words, as the relay says them to me
        word();
        st.host?.egSpanRide(0.1, null, false);
        client.frame(); draw();
      }
    }
    /** The way out `exit`, through the director's own doors where it has one, then the walk out's frames. */
    return function leave(exit) {
      const out = [];
      if (exit === 'home') { Br.sg = 'rest'; Br.mem[ME].home = clock; }   // the way home at a Redoubt's rest, as net/eliteGates/egBrain.js egHome marks it
      else if (exit === 'forsake') { Br.mem[ME].alive = 0; Br.mem[ME].wit = 1; assert.ok(egForsake(Br, ME, clock, out), 'forsaken'); }
      else if (exit === 'socket') online.terminal = true;
      else if (exit === 'away') { client.away(); st.inside = false; hostDown(); }   // a load or a reload: the online frame gone, the context with it
      else egEnd(Br, exit, clock, out);
      if (exit !== 'away') word();
      for (let k = 0; k < 300; k++) { clock += 16; client.frame(); }
      registerSpireObjs(null);
      return { inside: st.inside };
    };
  }
  return { breach, renderer, meshes, batches, st, draw };
}

test('AUDIT EG V L6-5 EVERY GL OBJECT BACK TO ITS BASELINE AFTER TEN HALLS AND EVERY EXIT KIND (section 11.9: "Pinned: after ten halls and every exit kind, the live mesh and texture counts return to baseline"; section 29): a screen\'s breach client - its fight, its look, the spans the dungeon host stands - over a recording GL, ten halls a breach (THE SWAP\'s recircle at Hall 6), then each way out: the way home, forsaking, the tear, a fall (the company\'s, `wipe`), the last hall, a void, the socket lost and a load (away) - every program, vertex array, buffer, texture and shader, every mesh and every billboard batch let go each time, nothing freed twice (mutants: the telegraph pass kept; the crystal pass kept; the passes never freed at leave; the shaders kept)', () => {
  const R = recordingGl(), S = screen(R);
  assert.deepEqual(R.count(), {}, 'nothing before the first breach');
  let n = 0, peak = null;
  for (const exit of ['home', 'forsake', 'tear', 'wipe', 'last', 'void', 'socket', 'away']) {
    const leave = S.breach(++n, 70 + n);
    peak ??= R.count();
    const at = leave(exit);
    assert.equal(at.inside, false, `${exit}: walked out`);
    assert.deepEqual(R.count(), {}, `${exit}: every GL object let go`);
    assert.equal(S.meshes.size, 0, `${exit}: every mesh freed`);
    assert.equal(S.batches.size, 0, `${exit}: every billboard batch freed`);
  }
  assert.ok(peak.Program >= 5 && peak.VertexArray >= 8 && peak.Buffer >= 10, `the passes stood in a hall - the telegraphs' with its floors' buffer, the crystals', the look's, the ghosts' (${JSON.stringify(peak)})`);
  assert.equal(S.st.swaps, 8, 'THE SWAP\'s recircle in every breach');
  assert.equal(R.stray(), 0, 'nothing freed twice');
});

// ── L6-3 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L6-3 THE EDGE LINE IN THE WORLD IMAGE\'S PIXELS (section 25.3; bible/07-Rendering/Retro-Mode.md - a pass sizes its pixels in `worldViewportPx`): the breach client\'s line pass, under Retro Picture Mode (a 320x200 world image on a 1920x1080 canvas), lays its line in the image\'s pixels - its viewport the image\'s, its width egEdgeLinePx of the image\'s height - as the spans\' ghosts drawn in the same pass are; the canvas\'s with no world image set (mutants: the viewport unpassed; the width off the canvas)', () => {
  const R = recordingGl(1920, 1080), S = screen(R);
  const last = (name, pick) => R.uni.filter((u) => u.n === name && pick(R.vsOf.get(u.p) ?? '')).at(-1)?.v;
  const line = (vs) => vs === EG_LINE_VS;
  const leave = S.breach(1, 71, 7, 6);
  assert.deepEqual(last('uViewport', line), [1920, 1080], 'no world image: the canvas\'s');
  assert.deepEqual(last('uWidth', line), [egEdgeLinePx(1080)]);
  S.renderer._worldViewportPx = [0, 0, 320, 200];
  S.draw();
  assert.deepEqual(last('uViewport', line), [320, 200], 'the world image\'s pixels');
  assert.deepEqual(last('uWidth', line), [egEdgeLinePx(200)], 'its width off the image\'s height');
  assert.notDeepEqual(egEdgeLinePx(200), egEdgeLinePx(1080));
  // the ghosts in the same pass read the same rect (scenes/eliteGates/egSpan.js drawPass - the sibling the line now agrees with)
  assert.match(rd('src/scenes/eliteGates/egSpan.js'), /const vp = renderer\._worldViewportPx;[^\n]*\n[^\n]*vp\?\.\[2\] \?\? 0, vp\?\.\[3\] \?\? 0/);
  S.renderer._worldViewportPx = null;
  leave('void');
});
