// FIELD BUGS 2026-10-20f - FAIR-STILL and DOOR-WORD (bible/01-Overview/bugs/Field-Bugs-2026-10-20f.md; ilovemybonk in #general, of
// the Elite Breach's spans: "There were a few instances with the 'cross.' Objectives where it seemed the game doesnt register i
// made it to the end"). THE FAIR TRAIL (net/eliteGates/egFair.js, section 21) read a member's silence as blindness: a client says a
// pose only when something about it changes (net/online.js sendPose - else every HEARTBEAT_MS, 20 s), so a member who waited out a
// span's timed pieces without moving the mouse was "unseen" there, and a crossing more than 30% unseen opens no door - at the door,
// with nothing said. Pinned here:
//   THE LAW - a gap from held ground to held ground within EG_FAIR_SNAP_M is a member standing still (egStillGap), never blind;
//     a gap that went further, or began or ended in the air, stays blind;
//   THE CROSSING - the director's own breach (egBreachNew, egEnter, egStep, egPoseIn), a member walking every span of the build's
//     law along its main way at ten poses a second and standing still, posing nothing, two seconds before each timed piece: every
//     door opens (on the code before: 42 of 44 never did, the member at the door);
//   THE DOOR'S WORD - a member at the door on a trail the door refuses is told why, once a hall, to it alone (`efair` - a break's
//     own reason, else `blind`), in the trial and when its `down` is refused in the closing; a fair member is told nothing; the
//     wire carries the words and no other; the client says them, and never "You wait at the door" while the door refuses it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egFirstHallOf, egCirclePlan, egAtDoor, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egPoseIn, egDown, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egFairNew, egFairPose, egStillGap, egSupportAt, EG_HOLD, EG_BLIND_MS, EG_FAIR_SNAP_M, EG_FAIR_WORDS } from '../../../src/net/eliteGates/egFair.js';
import { egRouteLegs } from '../../../src/net/eliteGates/egRouteProof.js';
import { egRouteSolved } from '../../../src/net/eliteGates/egSpanLaw.js';
import { validEgOut, EG_FAIR_WIRE_WORDS, EG_RUN_KINDS } from '../../../src/net/wire.js';
import { createEgClient, EG_FAIR_TEXT } from '../../../src/scenes/eliteGates/egClient.js';
import { egToDungeon } from '../../../src/world/eliteGates/egHall.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };

/** A company of `n` woken in span hall `h` of `seed`, on its arrival plate: its breach, its spec, its beat, a member's pose. */
function woken(seed, h, n = 1) {
  const rng = seeded(seed), co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  B.pr = ''; B.dc = [];
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 3_600_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, y: spec.arrive.y ?? 0, z: spec.arrive.z }]));
  const step = () => egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng);
  for (let k = 0; k < 200 && B.sg !== 'trial'; k++) { now += 250; step(); }
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  return { B, spec, pos, step, tick: (ms) => (now += ms), now: () => now, pose: (sub, p) => { pos[sub] = p; return egPoseIn(B, sub, p, now); } };
}
/** Every span of the build's law in `seeds`' circles 1-4: `{ seed, h }`. */
function spans(seeds) {
  const out = [];
  for (const seed of seeds) for (let c = 1; c <= 4; c++) egCirclePlan(seed, c).forEach((p, k) => { if (p.kind === 'span') out.push({ seed, h: egFirstHallOf(c) + k }); });
  return out;
}
/**
 * A member walks span `h`'s main way (its route's legs, node to node) at 6 m/s posing ten times a second, the director beating
 * every 250 ms - and before each leg the timed solver crosses on timed pieces (egRouteSolved's pairs), it stands still on the
 * ground it reached, posing nothing, `waitMs` a pair, as a player waits out a Beat's return or a Drift's swing. Then it stands at
 * the door posing four seconds. Answers whether the door opened and the trail's blind share.
 */
function cross(seed, h, waitMs) {
  const W = woken(seed, h), { B, spec } = W, legs = egRouteLegs(spec, 0), timed = egRouteSolved(spec, 0);
  const pts = [legs[0].from, ...legs.map((g) => g.to)];
  let beat = W.now();
  const told = [], step = () => told.push(...W.step().filter((f) => f.k === 'efair'));
  const at = (q) => ({ sx: spec.x0 + q[0], y: q[1], z: q[2] });
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], dur = (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 6) * 1000, wait = (timed[i]?.pairs.length ?? 0) * waitMs;
    for (let s = 0; s < wait; s += 250) { W.tick(250); step(); beat = W.now(); }   // standing still: no pose, the room beats on
    for (let t = 0; t <= dur; t += 100) {
      const k = dur > 0 ? t / dur : 1;
      W.tick(100); W.pose('acct-0', at([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]));
      if (W.now() - beat >= 250) { beat = W.now(); step(); }
    }
  }
  for (let q = 0; q < 40 && B.sg === 'trial'; q++) { W.tick(100); W.pose('acct-0', at(pts.at(-1))); if (q % 3 === 0) step(); }
  const A = B.mem['acct-0'].fair;
  return { opened: B.sg !== 'trial', atDoor: egAtDoor(spec, pts.at(-1)[0], pts.at(-1)[2], pts.at(-1)[1]), blind: A.blind / A.span, told };
}

test('FAIR-STILL (FIELD BUGS 2026-10-20f) THE LAW: a gap from held ground to held ground within EG_FAIR_SNAP_M is a member standing still - seen, judged as a stretch, never blind; one that went further, or began or ended in the air, stays blind (mutants: no still gap; the snap unread; the gap\'s start unread)', () => {
  const [{ seed, h }] = spans([1]), spec = egHallOf(seed, h, 0), a = spec.arrive, y = a.y ?? 0;
  assert.equal(egSupportAt(spec, a.x, y, a.z, 0), EG_HOLD.island, 'the arrival plate holds');
  // standing still three seconds, then the first step a client says as it moves off
  const S = egFairNew(h);
  egFairPose(S, spec, { x: a.x, y, z: a.z }, T0);
  egFairPose(S, spec, { x: a.x, y, z: a.z + 0.4 }, T0 + 3000);
  assert.deepEqual([S.blind, S.span, S.brk], [0, 3000, 0], 'standing still is seen, and breaks nothing');
  // the same gap ending past the snap: blind, as before
  const M = egFairNew(h);
  egFairPose(M, spec, { x: a.x, y, z: a.z }, T0);
  egFairPose(M, spec, { x: a.x, y, z: a.z + EG_FAIR_SNAP_M + 0.3 }, T0 + 3000);
  assert.equal(M.blind, 3000, 'a gap that went past the snap is unseen');
  // a gap that began in the air: blind
  const Air = egFairNew(h);
  egFairPose(Air, spec, { x: a.x, y: y + 4, z: a.z }, T0);
  egFairPose(Air, spec, { x: a.x, y, z: a.z }, T0 + EG_BLIND_MS + 600);
  assert.equal(Air.blind, EG_BLIND_MS + 600, 'a body in the air is never standing still');
  // a gap begun at a jump's top: blind, though the body stood on the plate the pose before
  const Up = egFairNew(h);
  egFairPose(Up, spec, { x: a.x, y, z: a.z }, T0);
  egFairPose(Up, spec, { x: a.x, y: y + 1.5, z: a.z + 0.3 }, T0 + 100);
  assert.equal(egSupportAt(spec, a.x, y + 1.5, a.z + 0.3, 0), EG_HOLD.none, 'a jump\'s top holds nothing');
  egFairPose(Up, spec, { x: a.x, y, z: a.z + 0.6 }, T0 + 100 + EG_BLIND_MS + 600);
  assert.equal(Up.blind, EG_BLIND_MS + 600, 'a gap begins where its last pose stood, never where the body stood before it');
  // the pure law
  const A = egFairNew(h);
  egFairPose(A, spec, { x: a.x, y, z: a.z }, T0);
  assert.equal(egStillGap(A, A.last, { x: a.x + EG_FAIR_SNAP_M - 0.01, y, z: a.z }, EG_HOLD.island), true);
  assert.equal(egStillGap(A, A.last, { x: a.x + EG_FAIR_SNAP_M + 0.01, y, z: a.z }, EG_HOLD.island), false);
  assert.equal(egStillGap(A, A.last, { x: a.x, y, z: a.z }, EG_HOLD.none), false, 'ending in the air');
});

test('FAIR-STILL (FIELD BUGS 2026-10-20f) THE CROSSING: a member walking each span of the build\'s law along its main way, standing still two seconds before each timed piece with no pose said, opens its door - on the code before, the trail read every wait as unseen and nearly every door stayed shut with the member at it (mutant: no still gap)', () => {
  const all = spans([1, 2, 3]);
  assert.ok(all.length >= 8, `spans enough (${all.length})`);
  const shut = [];
  for (const { seed, h } of all) {
    const r = cross(seed, h, 2000);
    assert.ok(r.atDoor, `seed ${seed} hall ${h}: the walk ends at the door`);
    if (!r.opened || r.told.length) shut.push(`seed ${seed} hall ${h} (blind ${r.blind.toFixed(2)}, told ${JSON.stringify(r.told)})`);
  }
  assert.deepEqual(shut, [], 'every door opens for a member who waited still');
});

test('DOOR-WORD (FIELD BUGS 2026-10-20f): a member at the door on a trail the door refuses is told why - a break\'s own reason, else `blind` - once a hall, to it alone, in the trial and when its `down` is refused in the closing; a fair member is told nothing; the wire carries the four words and no other, the law\'s own; the client says each, and never "You wait at the door" while the door refuses it (mutants: the word never said; said every beat; said to everyone; a break called blind; the client\'s door line unread)', () => {
  assert.deepEqual([...EG_FAIR_WIRE_WORDS], [...EG_FAIR_WORDS], 'the wire\'s words are the law\'s');
  assert.ok(EG_RUN_KINDS.includes('efair'));
  for (const w of EG_FAIR_WORDS) assert.deepEqual(validEgOut({ t: 'eg', k: 'efair', w }), { k: 'efair', w });
  assert.equal(validEgOut({ t: 'eg', k: 'efair', w: 'start' }), null, 'no other word');
  const [{ seed, h }] = spans([1]);
  // a teleport onto the door: refused, told `speed` once, to it alone
  const W = woken(seed, h, 2), { B, spec } = W, at = (x, z, y) => ({ sx: spec.x0 + x, y, z });
  W.pose('acct-0', at(spec.arrive.x, spec.arrive.z, spec.arrive.y ?? 0)); W.pose('acct-1', at(spec.arrive.x + 0.5, spec.arrive.z, spec.arrive.y ?? 0));
  W.tick(100);
  W.pose('acct-0', at(spec.end.x, spec.end.z, spec.end.y ?? 0));
  const words = [];
  for (let k = 0; k < 12; k++) { W.tick(250); W.pose('acct-0', at(spec.end.x, spec.end.z + (k % 2) * 0.1, spec.end.y ?? 0)); words.push(...W.step().filter((f) => f.k === 'efair')); }
  assert.equal(B.sg, 'trial', 'the door refuses a teleport');
  assert.deepEqual(words, [{ k: 'efair', w: 'speed', to: 'acct-0' }], 'told why, once a hall, to it alone');
  // a member unseen too long: told `blind`
  const U = woken(seed, h), su = U.spec;
  U.pose('acct-0', at(su.arrive.x, su.arrive.z, su.arrive.y ?? 0));
  U.B.mem['acct-0'].fair.blind = 9e5; U.B.mem['acct-0'].fair.span = 1e6;   // nine tenths of a long crossing unseen
  U.tick(100); U.pose('acct-0', { sx: su.x0 + su.end.x, y: su.end.y ?? 0, z: su.end.z });
  U.B.mem['acct-0'].fair.brk = 0;   // its step there no break: the share alone refuses it
  U.tick(250);
  assert.deepEqual(U.step().filter((f) => f.k === 'efair'), [{ k: 'efair', w: 'blind', to: 'acct-0' }], 'a crossing seen too little');
  // the closing: the walker opens the door; the teleported member's `down` refused - told once (here already, in the trial)
  const C = woken(seed, h, 2), sc = C.spec;
  C.B.sg = 'closing'; C.B.dn = C.now(); C.B.su = C.now() + 60_000;
  for (const sub of ['acct-0', 'acct-1']) C.pose(sub, { sx: sc.x0 + sc.arrive.x, y: sc.arrive.y ?? 0, z: sc.arrive.z });
  for (const sub of ['acct-0', 'acct-1']) C.B.mem[sub].hereH = h;
  C.tick(100); C.pose('acct-0', { sx: sc.x0 + sc.end.x, y: sc.end.y ?? 0, z: sc.end.z });
  assert.equal(egDown(C.B, 'acct-0', h, C.B.mem['acct-0'].pose ?? { sx: sc.x0 + sc.end.x, y: sc.end.y ?? 0, z: sc.end.z }, C.now()), false, '`down` asks a fair trail');
  C.tick(250);
  assert.deepEqual(C.step().filter((f) => f.k === 'efair'), [{ k: 'efair', w: 'speed', to: 'acct-0' }], 'the refused step told why');
  C.tick(250);
  assert.deepEqual(C.step().filter((f) => f.k === 'efair'), [], 'once a hall');
  // a fair walker: never told
  const r = cross(seed, h, 0);
  assert.ok(r.opened && r.told.length === 0, 'a fair crossing opens the door and hears no word');
  // THE CLIENT: it says the word; standing at the door in the closing, its line is the word while the door refuses it
  const said = [], mids = [], sent = [];
  const modes = { mode: 'dungeon', egHallBreach: () => C.B.b, egHallCircle: () => 1, egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, sendEg: (k, f = {}) => { sent.push({ k, ...f }); return true; } };
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const player = { pos: egToDungeon(sc, sc.end.x, sc.end.y ?? 0, sc.end.z), height: 1.8, grounded: true, collider: { move: () => {} } };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => 'acct-0', guest: () => false, keys: async () => ({ ok: false }) }, now: () => C.now(), entity, player, cam: { pos: [0, 0, 0] },
    say: (t) => said.push(t), mid: (t) => mids.push(t), site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [] });
  const { k: _k, ...st } = egStateOf(C.B, C.now());
  client.word(validEgOut(JSON.parse(JSON.stringify({ t: 'eg', k: 'st', ...st }))));
  client.frame();
  assert.ok(sent.some((f) => f.k === 'down') && mids.at(-1) === 'You wait at the door for your company.', `a step through the door asked (${JSON.stringify(sent)}, ${JSON.stringify(mids)})`);
  client.word(validEgOut({ t: 'eg', k: 'efair', w: 'air' }));
  assert.ok(said.includes(EG_FAIR_TEXT.air()) && mids.at(-1) === EG_FAIR_TEXT.air(), 'the client says why');
  C.tick(2000);
  client.frame();
  assert.equal(sent.filter((f) => f.k === 'down').length, 2, 'the step asked again');
  assert.equal(mids.at(-1), EG_FAIR_TEXT.air(), 'and the door\'s line is the reason, never "You wait at the door"');
  for (const w of EG_FAIR_WORDS) assert.ok(typeof EG_FAIR_TEXT[w]() === 'string' && EG_FAIR_TEXT[w]().length > 20, `a line for ${w}`);
});
