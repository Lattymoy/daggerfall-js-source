// AUDIT EG V (2026-10-15; bible/11-Multiplayer/Elite-Gates.md sections 10.3, 11.9, 25.2 and 25.4) - FIX GROUP E, "render":
// the look's laws, pinned on the shapes the breach client's fight mints (scenes/eliteGates/egFight.js under createEgClient, fed the
// director's own words) and on the code the GPU runs (test/glsl.mjs over the Spire's stage):
//   L6-2   AOE-PERF's tight quads reach the Spire's thin shapes: a pull-apart tether's and a stay-close chain's floor draws
//          are their own strips (render/gate/gateTelegraph.js telegraphStrip; world/eliteGates/egTelegraph.js egClipTris), a Vestige aura's
//          ring its own small square (TELEGRAPH_RING_REACH) - each holding every fragment its pool writes.
//   L5-3   the place's timed hazards - a Rampart's and a span's vents, every fragment hazard - told and landing in the
//          place's white, so the danger palettes recolour every one (scenes/eliteGates/egFight.js PEND_COLOR, egLookShapes).
//   L5-16  THE LAMPS' BUDGET - at most 12 lamps within 40 m of any lamp of a circle (world/eliteGates/egHall.js egCircleLights,
//          EG_LAMP_BUDGET), the meaningful kept, each ring thinned spread.
import test from 'node:test';
import assert from 'node:assert/strict';
import { glslFunctions, GlslDiscard } from '../../glsl.mjs';
import { egHallOf, egCircleSpecs, egSpecForget, egLawSeam, EG_SPEC, EG_SEALED_MS, EG_GATHER_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egGive8 } from '../../egGive8.mjs';   // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9): law 8's circles given
import { egBreachNew, egEnter, egStep, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egTethersOut } from '../../../src/net/eliteGates/egBodies.js';
import { EG_VESTIGES } from '../../../src/net/eliteGates/egVestige.js';
import { validEgOut } from '../../../src/net/wire.js';
import { shDisc, shLane } from '../../../src/net/eliteGates/egShape.js';
import { EG_ACCESS_PREFS, egPaletteOf } from '../../../src/ui/eliteGates/egAccess.js';
import { getPref, setPref } from '../../../src/systems/uiPrefs.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { egHallCentre, egCircleLights, egToDungeon, EG_LAMP, EG_DROP_LAMP, EG_LAMP_BUDGET } from '../../../src/world/eliteGates/egHall.js';
import { egRuinColumns } from '../../../src/world/eliteGates/egRuin.js';   // PIN MOVED (EG-LOOK): the lamps on the ruin's columns
import { egFightFloors, egFloorPlan, EG_AURA_RING } from '../../../src/world/eliteGates/egTelegraph.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { lookAt, perspective } from '../../../src/world/mat4.js';
import {
  GateTelegraphRenderer, TELEGRAPH_FS_SPIRE, TELEGRAPH_KIND, TELEGRAPH_POOL_SPIRE, TELEGRAPH_POINTS_MAX, TELEGRAPH_REACH, TELEGRAPH_RING_REACH, TELEGRAPH_TICK_REACH, TELEGRAPH_TIGHT_PAD,
  telegraphBounds, telegraphStrip, telegraphQuadOver,
} from '../../../src/render/gate/gateTelegraph.js';

const ME = 'acct-0', PEER = 'acct-1';

/** The first Court of seeds 1.. with a fight floor disc of 12 m or more (the lane's probe's), its disc. */
function courtWithDisc() {
  for (let seed = 1; seed <= 60; seed++) for (let c = 1; c <= 12; c++) for (const s of egCircleSpecs(seed, c, 0)) if (s.kind === 'court' && (s.fl ?? []).some((f) => f.t === 'd' && f.r >= 12)) return { seed, spec: s, F: s.fl.find((f) => f.t === 'd' && f.r >= 12) };
  throw new Error('no court');
}

/** A breach of two woken in hall `h` of `seed` - me at `mine` and my companion at `theirs` (the hall's frame, on `y`), my
 *  run holding Vestiges `vs` - over a recording GL; the director stepped and its words told the breach client as the relay
 *  says them to me. Answers `{ B, spec, client, fight(), calls, step(ms), draw(), tell }`. */
function breachAt({ seed, h, mine, theirs, y = 0, vs = [] }) {
  const spec = egHallOf(seed, h, 0), calls = [];
  const gl = new Proxy({ drawingBufferWidth: 1920, drawingBufferHeight: 1080 }, { get(t, k) {
    if (k in t) return t[k];
    if (typeof k !== 'string') return undefined;
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, n) => n;
    if (k.toUpperCase() === k) return 1;
    return (...a) => { calls.push([k, ...a.map((x) => (ArrayBuffer.isView(x) ? Array.from(x) : x))]); return {}; };
  } });
  const renderer = { gl, _worldViewportPx: null, createBillboardBatch: () => ({ origin: [0, 0, 0] }), destroyBillboardBatch: () => {} };
  const centre = egHallCentre(spec), at = (x, z) => [centre[0] + x, centre[1] + y, centre[2] + z];
  const player = { pos: at(...mine), height: 1.8, grounded: true, collider: { move: () => {} } };
  const peerEye = at(...theirs); peerEye[1] += 1.6;
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  let clock = 1_800_000_000_000;
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed, op: clock - EG_SEALED_MS - 60_000, co: [[ME, 'Mac', 1], [PEER, 'Ann', 2]], site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const sub of [ME, PEER]) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  B.mem[ME].vs = vs;
  B.h = spec.h; B.sg = 'arrive'; B.wk = clock; B.cnt = { left: 1_500_000, at: clock }; B.pulledAt = clock; B.gatherAt = clock - EG_GATHER_MS; B.su = clock;
  const modes = { mode: 'dungeon', egHallBreach: () => B.b, egHallCircle: () => spec.c, egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, error: null, sendEg: () => true };
  let fight = null;
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 }, renderer,
    account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, say: () => {}, mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [{ sub: PEER, pos: peerEye }], store: null,
    fight: (link) => (fight = createEgFight({ renderer, gl, link, me: () => ME, player: () => entity, feet: () => player.pos, peerAt: (sub) => (sub === PEER ? peerEye : null) })), win: { innerWidth: 1920, innerHeight: 1080, matchMedia: () => ({ matches: false }) } });
  const tell = (w) => { if (w.to && w.to !== ME) return; const v = validEgOut(JSON.parse(JSON.stringify(w))); if (v) client.word(v); };
  tell(egStateOf(B, clock));
  let s = 3;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const poses = () => [[ME, mine], [PEER, theirs]].map(([sub, p]) => ({ sub, sx: spec.x0 + p[0], z: p[1], dead: false, at: clock }));
  const step = (ms = 100) => { clock += ms; for (const w of egStep(B, clock, poses(), rng)) tell(w); tell(egStateOf(B, clock)); };
  const proj = perspective(new Float32Array(16), 1.2, 16 / 9, 0.1, 2000);
  const draw = () => { const eye = [player.pos[0], player.pos[1] + 5, player.pos[2] - 8]; calls.length = 0; client.drawPass(proj, lookAt(new Float32Array(16), eye, player.pos, [0, 1, 0]), eye, clock / 1000, null); };
  for (let k = 0; k < 3; k++) step();
  assert.equal(B.sg, 'trial', 'the hall woke');
  return { B, spec, client, fight: () => fight, calls, step, draw, tell };
}

/** A breach of two woken in a Court with a broad fight floor, me and my companion on it 9 m apart along a diagonal, my run
 *  holding a Vestige aura, the fight told a Blood Tether and Morvayn's chain between us (net/eliteGates/egBodies.js egTethersOut - the
 *  director's own word); one frame drawn. Answers its shapes and the GL's calls. */
function fightOnFloor() {
  const { seed, spec, F } = courtWithDisc();
  const aura = EG_VESTIGES.find((v) => /** @type {any} */ (v).aura > 0);
  const R = breachAt({ seed, h: spec.h, mine: [F.x - 4.5, F.z - 4.5], theirs: [F.x + 4.5, F.z + 4.5], y: F.y ?? 0, vs: [[aura.id, 1]] });
  R.B.F.tethers.push([ME, PEER, 1, 1400], [ME, PEER, 2, 800]);   // a Blood Tether breaking at 14 m, Morvayn's chain (net/eliteGates/egLords.js's own tuples)
  const out = [];
  egTethersOut(R.B.F, out);
  for (const w of out) R.tell(w);
  R.client.frame();
  R.draw();
  return { spec, F, fight: R.fight(), calls: R.calls, floors: egFightFloors(spec) };
}

/** The Spire's fragment stage for shape `sh` (top-down, its floor's court), every derivative `fw`: (x, z) => rgba, or null
 *  where it discards. */
function spireFragOf(sh, fw, court) {
  const fns = glslFunctions(TELEGRAPH_FS_SPIRE, {
    uKind: sh.kind, uOrigin: [...sh.origin], uYaw: sh.yaw ?? 0, uR: sh.r, uHalfArc: sh.halfArc ?? 0, uBody: sh.body ?? 0, uEnd: [...sh.end], uHalfW: sh.halfW, uR0: sh.r0 ?? 0, uR1: sh.r1 ?? 0,
    uPts: Array.from({ length: TELEGRAPH_POINTS_MAX }, (_, i) => sh.points?.[i] ?? [0, 0]), uCount: sh.points?.length ?? 0,
    uT: sh.t, uFlash: sh.flash, uAlpha: Math.min(1, sh.alpha), uColor: [...sh.color], uEdgeCol: [...sh.edge], uCourt: [...court.courts[0]], uFloorR: court.r,
    uStyle: sh.style ?? 0, uSince: sh.since ?? 0, uSpan: sh.span ?? 1, uAfter: sh.after ?? -1, uPool: sh.pool | 0, uRunS: sh.runS ?? 0, uLineW: 1.6,
    uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uOnWalk: 0, uWalkC0: [0, 0], uWalkC1: [0, 0], uFogFloor: [0, 0, 1], uFillK: 1, uLook: 0,
    vCourt: [0, 0], vWorld: [0, 0.05, 0], o: [0, 0, 0, 0], fwidth: (x) => (Array.isArray(x) ? x.map(() => fw) : fw),
  });
  const G = fns.globals;
  return (x, z) => { G.vCourt = [x, z]; G.vWorld = [x, 0.05, z]; try { fns.main(); return [...G.o]; } catch (e) { if (e instanceof GlslDiscard) return null; throw e; } };
}
const writes = (o) => !!o && (o[0] !== 0 || o[1] !== 0 || o[2] !== 0 || o[3] !== 0);
function* grid(q, step) { for (let x = q[0]; x <= q[2] + 1e-9; x += step) for (let z = q[1]; z <= q[3] + 1e-9; z += step) yield [x, z]; }
const inBox = (q, [x, z], e = 0) => x >= q[0] - e && x <= q[2] + e && z >= q[1] - e && z <= q[3] + e;
/** Is (x, z) inside strip `st` (render/gate/gateTelegraph.js telegraphStrip - the vertex stage's own frame), `e` m slack? */
const inStrip = (st, [x, z], e = 0) => { const s = st.u[0] * (x - st.a[0]) + st.u[1] * (z - st.a[1]), q = st.u[1] * (x - st.a[0]) - st.u[0] * (z - st.a[1]); return s >= -e && s <= st.len + e && Math.abs(q) <= st.w + e; };
const triArea = (b, i) => Math.abs((b[i + 2] - b[i]) * (b[i + 5] - b[i + 1]) - (b[i + 4] - b[i]) * (b[i + 3] - b[i + 1])) / 2;
/** The pixel sizes the stage is read at: near, a far rim's at a grazing look, and past it. */
const PIXELS = [0.002, 0.08, 4];

test('AUDIT EG V L6-2 THE SPIRE\'S THIN SHAPES DRAW ON THEIR OWN GROUND (section 25.4; FIELD BUGS 2026-10-13e AOE-PERF\'s law, "a path\'s or a tether\'s quad is its own strip"): on the shapes the breach client\'s fight mints - a Blood Tether (the pull-apart grammar, pool 5), Morvayn\'s chain (the stay-close, pool 6) and a Vestige aura\'s ring (pool 7) - every fragment the Spire\'s stage writes, at every pixel\'s size, lies inside the tether\'s strip (twice its half-width and TELEGRAPH_TICK_REACH across a pull-apart\'s, its half-width a chain\'s) and inside the ring\'s square (TELEGRAPH_RING_REACH past it); the floor plan cuts each tether\'s fight floor to that strip and lays the ring\'s quad over that square - a fraction of the box TELEGRAPH_REACH about each (mutants: no strip for a tether; the tick\'s reach narrower than the shader\'s; the strip unread by the floor\'s clip; the ring\'s reach back to TELEGRAPH_REACH; the ring\'s line uncut)', () => {
  const { F, fight, calls, floors } = fightOnFloor();
  const shapes = fight.shapes();
  const pull = shapes.find((s) => s.pool === TELEGRAPH_POOL_SPIRE.pull), chain = shapes.find((s) => s.pool === TELEGRAPH_POOL_SPIRE.chain), ring = shapes.find((s) => s.pool === TELEGRAPH_POOL_SPIRE.ring);
  assert.ok(pull && chain && ring, 'the fight minted all three');
  assert.equal(pull.kind, TELEGRAPH_KIND.lane); assert.equal(chain.kind, TELEGRAPH_KIND.lane); assert.equal(ring.kind, TELEGRAPH_KIND.disc);
  assert.equal(ring.r, EG_AURA_RING.r);
  const court = { r: F.r, courts: [[F.x, F.z]] };
  // the strips and the ring's square: their widths the shader's own reach
  const sp = telegraphStrip(pull), sc = telegraphStrip(chain);
  assert.ok(Math.abs(sp.w - (2 * pull.halfW + TELEGRAPH_TICK_REACH + TELEGRAPH_TIGHT_PAD)) < 1e-12, 'a pull-apart\'s strip: its break tick\'s reach');
  assert.ok(Math.abs(sc.w - (chain.halfW + TELEGRAPH_TIGHT_PAD)) < 1e-12, 'a chain\'s: its links\'');
  for (const [sh, st] of [[pull, sp], [chain, sc]]) {   // their bounds (THE TELEGRAPH BUDGET's nearest, the floors' reach) the strip's, never the glow's
    assert.deepEqual(telegraphBounds(sh), [Math.min(sh.origin[0], sh.end[0]) - st.w, Math.min(sh.origin[1], sh.end[1]) - st.w, Math.max(sh.origin[0], sh.end[0]) + st.w, Math.max(sh.origin[1], sh.end[1]) + st.w]);
  }
  const rb = telegraphBounds(ring);
  assert.deepEqual(rb, [ring.origin[0] - ring.r - TELEGRAPH_RING_REACH, ring.origin[1] - ring.r - TELEGRAPH_RING_REACH, ring.origin[0] + ring.r + TELEGRAPH_RING_REACH, ring.origin[1] + ring.r + TELEGRAPH_RING_REACH]);
  // every fragment written lies on that ground, at every pixel's size: searched finely about it (a band 1 m past each side
  // of a strip, in its own frame) and coarsely over the whole box it was laid over, TELEGRAPH_REACH about it
  const wide = (sh) => [Math.min(sh.origin[0], sh.end[0]) - sh.halfW - TELEGRAPH_REACH, Math.min(sh.origin[1], sh.end[1]) - sh.halfW - TELEGRAPH_REACH, Math.max(sh.origin[0], sh.end[0]) + sh.halfW + TELEGRAPH_REACH, Math.max(sh.origin[1], sh.end[1]) + sh.halfW + TELEGRAPH_REACH];
  const about = function* (st) { for (let s = -1; s <= st.len + 1; s += 0.1) for (let q = -st.w - 1; q <= st.w + 1; q += 0.04) yield [st.a[0] + st.u[0] * s + st.u[1] * q, st.a[1] + st.u[1] * s - st.u[0] * q]; };
  const pts = (box, step, near) => [...grid(box, step), ...near];
  for (const [label, sh, inside, points] of [['the Blood Tether', pull, (p) => inStrip(sp, p), pts(wide(pull), 0.37, about(sp))], ['the chain', chain, (p) => inStrip(sc, p), pts(wide(chain), 0.37, about(sc))],
    ['the aura\'s ring', ring, (p) => inBox(rb, p), pts([ring.origin[0] - ring.r - TELEGRAPH_REACH, ring.origin[1] - ring.r - TELEGRAPH_REACH, ring.origin[0] + ring.r + TELEGRAPH_REACH, ring.origin[1] + ring.r + TELEGRAPH_REACH], 0.06, [])]]) {
    let drawn = 0;
    for (const fw of PIXELS) {
      const frag = spireFragOf(sh, fw, court);
      for (const p of points) {
        if (!writes(frag(p[0], p[1]))) continue;
        drawn++;
        assert.ok(inside(p), `${label} drawn at ${p.map((v) => v.toFixed(2))} (a pixel ${fw} m) - outside its own ground`);
      }
    }
    assert.ok(drawn > 20, `${label} drawn (${drawn})`);
  }
  // the floor plan: each tether's floor cut to its strip - every vertex in it, a sliver of the box about it
  const plan = fight.plan();
  for (const [label, sh, st] of [['the Blood Tether', pull, sp], ['the chain', chain, sc]]) {
    const ds = plan.draws.filter((d) => d.sh === sh && d.f);
    assert.ok(ds.length >= 1, `${label} drawn on its floor`);
    let area = 0;
    for (const d of ds) for (let i = d.first * 2; i < (d.first + d.count) * 2; i += 6) { area += triArea(plan.buf, i); for (let k = 0; k < 6; k += 2) assert.ok(inStrip(st, [plan.buf[i + k], plan.buf[i + k + 1]], 1e-3), `${label}: a vertex of its floor's draw outside its strip`); }
    const was = egFloorPlan([{ ...sh, pool: 0 }], floors, null, null);   // the same lane as a blow, which keeps its glow's box
    let wasArea = 0;
    for (const d of was.draws) for (let i = d.first * 2; i < (d.first + d.count) * 2; i += 6) wasArea += triArea(was.buf, i);
    assert.ok(area <= st.len * 2 * st.w * 1.001 && area > 0.5 * st.len * 2 * st.w, `${label}: its strip's ground (${area.toFixed(1)} m2 of ${(st.len * 2 * st.w).toFixed(1)})`);
    assert.ok(area < wasArea / 10, `${label}: a tenth of the box it was (${area.toFixed(1)} of ${wasArea.toFixed(1)} m2)`);
  }
  // the ring: its own surface's quad, laid over its square (the pass's uLo/uHi)
  const rd = plan.draws.find((d) => d.sh === ring);
  assert.ok(rd && !rd.f, 'the ring is its own quad');
  const q = telegraphQuadOver(ring, 0, rd.over.courts, rd.over.r);
  assert.deepEqual(q.map((v) => +v.toFixed(9)), rb.map((v) => +v.toFixed(9)), 'laid over its square');
  const lo = calls.filter((c) => c[0] === 'uniform2f' && c[1] === 'uLo').map((c) => c.slice(2).map((v) => +v.toFixed(6)));
  assert.ok(lo.some((v) => v[0] === +rb[0].toFixed(6) && v[1] === +rb[1].toFixed(6)), 'and the pass laid it so');
  assert.ok(GateTelegraphRenderer, 'the pass');
});

// ── L5-3 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The place's timed hazards of `spec` as the fight stamps them: each its name and its stamp's kind and first point
 *  (net/eliteGates/egFragLaw.js egHazardParts's stamps - a lane's start, a disc's centre; a span Vent's disc; a Rampart vent's lane). */
function placeHazards(spec) {
  const out = [];
  const lane = (q, w) => shLane(q[0], q[1], q[2], q[3], w);
  for (const s of spec.steps ?? []) if (s.kind === 'vent') out.push({ what: 'a span Vent', st: shDisc(s.x, s.z, 1) });
  for (const v of spec.vents ?? []) out.push({ what: 'a Rampart\'s vent', st: shLane(v.x - v.halfW, v.z, v.x + v.halfW, v.z, v.d) });
  for (const hz of spec.hazards ?? []) {
    if (hz.kind === 'mist' || hz.kind === 'wisp' || hz.kind === 'eclipse') continue;
    if (hz.kind === 'cascade') for (const q of hz.lanes ?? []) out.push({ what: hz.kind, st: lane(q, hz.w) });
    else if (hz.kind === 'tide') out.push({ what: hz.kind, st: shDisc(hz.x, hz.z, hz.r), r: hz.r });   // (EG-PERFECT: its reach too - a deepway's engine marks the chamber's middle, the tide's own)
    else if (hz.spots?.length) for (const p of hz.spots) out.push({ what: hz.kind, st: shDisc(p[0], p[1], hz.r) });
    else if (hz.sh) out.push({ what: hz.kind, st: lane(hz.sh, hz.w) });
  }
  return out.map((q) => ({ what: q.what, kind: q.st[0] === 'd' ? TELEGRAPH_KIND.disc : TELEGRAPH_KIND.lane, at: [q.st[1], q.st[2]], r: q.r ?? null }));
}

test('AUDIT EG V L5-3 THE PLACE\'S HAZARDS ARE TOLD IN THE PLACE\'S WHITE (section 25.2: white is "the place\'s own timed hazard: vents ringing, Pendulums\' lanes, a Beat\'s last 0.4 s, a fragment\'s hazards"; section 10.3: a span Vent "a white ring closing over 1.0 s"; section 25.7: the danger palettes recolour it): on the shapes the breach client\'s fight mints over fifteen seconds of each hall (a minute of the tide\'s) - a Rampart\'s vents, a span\'s Vents and the fragments\' magma surges, fire falls, falling basalt, cascades, the Forge Line\'s hammers, the hammers, the slag spill and the tide - every one, told and landing, is drawn in the palette\'s hazard: white under the Standard, High contrast\'s cyan under it (mutants: a vent in fire; a span Vent in fire; a fragment hazard in its element\'s colour)', () => {
  const was = getPref(EG_ACCESS_PREFS.palette), seen = new Map();
  try {
    for (const [h, ms] of [[2, 150], [4, 150], [7, 150], [76, 150], [77, 150], [82, 600]]) {   // seed 1's halls: a cascade; a Rampart; fire falls, a surge and basalt; a span Vent and the Forge Line; the slag spill and hammers; the tide (its minute)
      const spec = egHallOf(1, h, 0), arrive = spec.arrive ? [spec.arrive.x, spec.arrive.z] : [0, 0];
      const R = breachAt({ seed: 1, h, mine: arrive, theirs: [arrive[0] + 1, arrive[1]] });
      const want = placeHazards(spec);
      assert.ok(want.length > 0, `hall ${h} stands its hazards`);
      for (let k = 0; k < 100; k++) {
        const key = k % 2 ? 'contrast' : 'standard';
        setPref(EG_ACCESS_PREFS.palette, key);
        R.step(ms); R.client.frame(); R.draw();
        for (const sh of R.fight().shapes()) {
          const q = want.find((w) => w.kind === sh.kind && w.at[0] === sh.origin[0] && w.at[1] === sh.origin[1] && (w.r === null || w.r === sh.r));
          if (!q) continue;
          seen.set(q.what, (seen.get(q.what) ?? 0) + 1);
          assert.deepEqual([...sh.color], [...egPaletteOf(key).hazard], `hall ${h}: ${q.what} in the ${key} palette's hazard (t ${((k * ms) / 1000).toFixed(1)} s, its flash ${sh.flash})`);
        }
      }
    }
  } finally { setPref(EG_ACCESS_PREFS.palette, was); }
  for (const what of ['a Rampart\'s vent', 'a span Vent', 'surge', 'fall', 'basalt', 'cascade', 'hammerline', 'hammer', 'slag', 'tide']) assert.ok(seen.get(what) > 0, `${what} drawn (${JSON.stringify([...seen])})`);
});

// ── L5-16 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L5-16 THE LAMPS\' BUDGET (section 11.9: "At most 12 lamps stand within 40 m of any lamp of a circle" - it said "lights ... of any point", and nothing held it): every circle of seeds 1 and 2 (seven of them stood 13 to 18, Grath\'s islands and their court the most) stands at most EG_LAMP_BUDGET\'s 12 lamps within 40 m of any of its lamps, the budget met where it was passed; the meaningful kept - every fragment\'s own light and every Drop\'s wall lamp - and each court\'s and island\'s ring thinned spread, never emptied (mutants: no budget; the budget counted about the new lamp alone; the meaningful let go first; a ring thinned from one side)', () => {
  assert.deepEqual(EG_LAMP_BUDGET, { n: 12, r: 40 });
  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= EG_LAMP_BUDGET.r;
  const at = (L, p) => L.find((q) => Math.hypot(q.x - p[0], q.y - p[1], q.z - p[2]) < 1e-6);
  let full = 0;
  const thinned = [];
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): the budget held over spec law 9's circles and law 8's alike; the lights'
  // places and a ring's spread order over law 8's (given - test/egGive8.mjs), as this audit counted them - a LAW 9 circle's rooms
  // carry lamps of their own (a fragment's, kept first), so a court's ring beside a room is thinned where the room's stand
  // PIN MOVED (EG-PERFECT, spec law 10 - 2026-10-18): and over law 10's (the build's), law 9's drawn through THE SEAM
  for (const law of [10, 9, 8]) for (const seed of [1, 2]) for (let c = 1; c <= 20; c++) {
    const geo = c <= 1 ? 0 : seed % 9;
    if (law === 8) egGive8(seed, [c], geo);
    egLawSeam(law === 9 ? 9 : EG_SPEC);
    const L = egCircleLights(seed, c, geo), specs = egCircleSpecs(seed, c, geo);
    assert.ok(specs.every((s) => s.v === law), `seed ${seed} circle ${c}: law ${law}'s`);
    let worst = 0;
    for (const p of L) worst = Math.max(worst, L.filter((q) => near(p, q)).length);
    assert.ok(worst <= EG_LAMP_BUDGET.n, `law ${law} seed ${seed} circle ${c}: ${worst} lamps within 40 m of one`);
    if (law !== 8) continue;
    if (worst === EG_LAMP_BUDGET.n) full++;
    for (const s of specs) {
      for (const [x, y, z] of s.lights ?? []) assert.ok(at(L, egToDungeon(s, x, y, z)), `seed ${seed} hall ${s.h}: its fragment's light stands`);
      for (const q of s.steps) if (q.kind === 'drop') assert.ok(at(L, egToDungeon(s, q.x, q.y + EG_DROP_LAMP.h, q.z + q.d / 2 - EG_DROP_LAMP.off)), `seed ${seed} hall ${s.h}: its Drop's wall lit`);
      // PIN MOVED (EG-LOOK, Elite-Gates-Look.md section 3.3): a court's and an isle's lamps stand on the ruin's columns at their
      // fixtures (world/eliteGates/egRuin.js egRuinColumns' `lamp(d, k)`), each nearest its old bearing - the old place (the rim less a
      // metre, EG_LAMP.h up) only where no column stands clear; the ring's spread order is the same law
      for (const [i, d] of s.discs.entries()) {
        if (d.role !== 'court' && d.role !== 'isle') continue;
        const plan = egRuinColumns(s);
        const ring = [0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * Math.PI * 2 + Math.PI / 4, on = plan.lamp(i, k); return !!at(L, on ? egToDungeon(s, on.at[0], on.at[1], on.at[2]) : egToDungeon(s, d.x + Math.cos(a) * (d.r - 1), d.y + EG_LAMP.h, d.z + Math.sin(a) * (d.r - 1))); });
        const n = ring.filter(Boolean).length;
        assert.ok(n >= 2, `seed ${seed} hall ${s.h}: a ${d.role}'s ring keeps ${n} of 6`);
        assert.deepEqual(ring, [0, 1, 2, 3, 4, 5].map((k) => [0, 3, 2, 4, 1, 5].indexOf(k) < n), `seed ${seed} hall ${s.h}: a ring thinned spread - two facing lamps, then those between (${ring.map(Number).join('')})`);
        if (n < 6) thinned.push(n);
      }
    }
  }
  egSpecForget();
  egLawSeam(EG_SPEC);
  assert.ok(full >= 7, `the budget met where it was passed (${full} circles at 12)`);
  assert.ok(thinned.some((n) => n <= 4), `rings thinned (${thinned.join(',')})`);

});
