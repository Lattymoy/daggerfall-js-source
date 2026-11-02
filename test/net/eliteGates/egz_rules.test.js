// EG-ZI (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 7, 10.6, 15, 21 and 27.5): THE
// DIRECTOR'S LAST RULES - THE PULL'S TOLL (net/eliteGates/egBrain.js egTollOf, tollStep; the furthest fair point, net/eliteGates/egFair.js; the
// census's share, egCountHeals; the `toll` word, net/wire.js; paid and said by the screen, scenes/eliteGates/egClient.js), THE LATE
// WAKE (a hall woken before a member's `here` counted, the gather's wait 10 s after two in a row, a late `here` heard) and
// LIFELINE IN THE CENSUS (egHeal's window, egCensusDr's share). Every fixture is the producers' own: specs from egHallOf,
// trails from egPoseIn and egFairPose, members from egEnter, frames from egStep through the wire, the real Room.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../../fakeRoom.mjs';
import { EG_INTERNAL_OPEN, validEgOut, validEgIn, EG_TOLL_WIRE_MAX, EG_RUN_KINDS } from '../../../src/net/wire.js';
import { egRoomKey, egHallOf, EG_SEALED_MS, EG_ARRIVE_MAX_MS, EG_LATE_ARRIVE_MS, EG_LATE_HALLS, EG_TOLL_STEP, EG_TOLL_QUARTERS, EG_TOLL_WAIVE_MS, EG_TOLL_KINDS } from '../../../src/net/eliteGates/egLaw.js';
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { egBreachNew, egEnter, egStep, egDown, egPoseIn, egCount, egCountHeals, egCensusDr, egHeal, egBodyWord, egTollOf, egStateOf,
  EG_LIFELINE_UNDER, EG_LIFELINE_MS, EG_HEAL_WORD_MS, EG_LIFELINE_LOOK_MS } from '../../../src/net/eliteGates/egBrain.js';
import { egFairNew, egFairPose, egSupportAt, EG_HOLD, EG_TRAIL_MS } from '../../../src/net/eliteGates/egFair.js';
import { egFightView } from '../../../src/net/eliteGates/egWalkGraph.js';
import { egAim } from '../../../src/net/eliteGates/egBodies.js';
import { shDisc } from '../../../src/net/eliteGates/egShape.js';
import { bodyStruck } from '../../../src/net/bossBody.js';
import { EG_VESTIGES, EG_DR_MAX } from '../../../src/net/eliteGates/egVestige.js';
import { BRAIN_TICK_MS } from '../../../src/net/gate/gateBrain.js';
import { createEgClient, EG_HEAL_SEND_MS } from '../../../src/scenes/eliteGates/egClient.js';
/** PIN MOVED (AUDIT EG V, d: lane4 L4-7 - the count is mended, and Lifeline opened, only by a heal a relayed cast backs): the healer's cast seen - the room's record of a cast from the healer to the member (server/src/index.js _egCastSaw). */
const CAST_SEEN = () => true;
import { EG_PRES_TEXT } from '../../../src/ui/eliteGates/egBeats.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(12345, [1, 2, 3]);
  egGive8(77, [1]);
});

const T0 = 1_800_000_000_000;
const CB = '0123456789abcdef';
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const LINE = { depth: 1, perS: 0.05 };
const vId = (key) => EG_VESTIGES.find((V) => V.key === key).id;
const wire = (f) => { const { to: _to, ...rest } = f; return validEgOut(JSON.parse(JSON.stringify(rest))); };
const tolls = (frames) => frames.filter((f) => f.k === 'toll').map((f) => [f.to, f.q, f.h]);

/**
 * A breach of `n` (seed 12345) at hall `h`'s arrival, as its room stands one after a pull: `put(sub, x, z, y?)` stands a
 * member in the company's hall (its own frame), `step(ms)` beats the director over every living member's place (the
 * frames kept, each held to the wire), `pose(sub, x, z, y, t)` feeds the member's pose at shared ms `t` to THE FAIR TRAIL.
 */
function breach(n, h, seed = 12345) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: CB, ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + EG_ARRIVE_MAX_MS;
  const pos = {};
  const plate = (sub) => { const sp = egHallOf(seed, B.h, 0); pos[sub] = { x: sp.arrive.x + Number(sub.slice(5)) * 0.5, z: sp.arrive.z }; };
  for (const [sub] of co) plate(sub);
  const frames = [];
  let bad = 0;
  const step = (ms = 250) => {
    now += ms;
    const sp = egHallOf(seed, B.h, 0);
    const o = egStep(B, now, co.filter(([sub]) => B.mem[sub].alive).map(([sub]) => ({ sub, sx: sp.x0 + pos[sub].x, z: pos[sub].z, ...(pos[sub].y != null ? { y: pos[sub].y } : {}), dead: false, at: now })), rng);
    for (const f of o) if (!wire(f)) bad++;
    frames.push(...o);
    return o;
  };
  const put = (sub, x, z, y) => { pos[sub] = { x, z, ...(y != null ? { y } : {}) }; };
  const pose = (sub, x, z, y, t) => egPoseIn(B, sub, { sx: egHallOf(seed, B.h, 0).x0 + x, y, z }, t);
  return { B, co, pos, plate, put, step, pose, frames, rng, bad: () => bad, now: () => now, spec: () => egHallOf(seed, B.h, 0) };
}
/** The closing ended now: the director's next beat pulls the company. */
const closeNow = (S) => { S.B.sg = 'closing'; S.B.dn = S.now() - 45_000; S.B.su = S.now() + 250; };

test('EG-ZI THE FURTHEST FAIR POINT (section 10.6, net/eliteGates/egFair.js): a fair trail keeps the furthest along the road a held pose stood (an island, a passage\'s floor, a piece, the end plate) with no break since the last island - never a pose in the air, never one a broken stretch reached; still ground first stood on so is new ground (`fnew` its instant) - an island, a passage\'s floor; the arrival plate it began on and ground stood on before are not; the support law unchanged (mutants: the air counted; a broken stretch counted; the arrival plate new ground; ground seen before new again; a piece new ground)', () => {
  const sp = egHallOf(12345, 2, 0);
  assert.equal(sp.kind, 'span');
  const [i1, i2] = sp.islands, cave = sp.bands[1], ledge = sp.steps.find((q) => q.kind === 'ledge');
  // the support law is groundAt's and the pieces': each class as it was
  assert.deepEqual([egSupportAt(sp, 0, 0, sp.arrive.z, 0), egSupportAt(sp, i1.x, 0, i1.z, 0), egSupportAt(sp, cave.x, 0, (cave.z0 + cave.z1) / 2, 0), egSupportAt(sp, ledge.x, 0, ledge.z, 0), egSupportAt(sp, sp.end.x, 0, sp.end.z, 0), egSupportAt(sp, 0, 5, i1.z, 0)],
    [EG_HOLD.island, EG_HOLD.island, EG_HOLD.island, EG_HOLD.piece, EG_HOLD.still, EG_HOLD.none]);
  const t0 = T0, A = egFairNew(2, t0);
  assert.deepEqual([A.far, A.fnew, A.seen, A.atEnd], [null, 0, [], 0]);
  egFairPose(A, sp, { x: 0, y: 0, z: sp.arrive.z }, t0 + 100);
  assert.deepEqual([A.far, A.fnew, A.seen], [sp.arrive.z, 0, []], 'the plate it began on: its point, no new ground');
  egFairPose(A, sp, { x: 0, y: 0, z: i1.z }, t0 + 600);   // blind (a 500 ms gap): judges nothing either way
  assert.deepEqual([A.far, A.fnew, A.seen], [i1.z, t0 + 600, ['d1']], 'an island: new ground');
  egFairPose(A, sp, { x: 0, y: 6, z: cave.z0 + 2 }, t0 + 1100);
  assert.equal(A.far, i1.z, 'in the air: no point');
  egFairPose(A, sp, { x: 0, y: 0, z: i1.z }, t0 + 1600);
  assert.equal(A.fnew, t0 + 600, 'an island stood on before is not new');
  // a broken stretch: an island to a ledge 17 m on in 200 ms (no blind gap) - the speed law broke, and the pieces after it
  // reach nothing until still ground is stood on fairly again
  egFairPose(A, sp, { x: ledge.x, y: 0, z: ledge.z }, t0 + 1800);
  assert.equal(A.brk, 1, 'the stretch broke the law');
  egFairPose(A, sp, { x: ledge.x, y: 0, z: ledge.z + 0.5 }, t0 + 2400);
  assert.deepEqual([A.far, A.fnew], [i1.z, t0 + 600], 'nothing a broken stretch reached');
  egFairPose(A, sp, { x: cave.x, y: 0, z: cave.z0 + 4 }, t0 + 3000);
  assert.deepEqual([A.brk, A.far, A.fnew, A.seen], [0, cave.z0 + 4, t0 + 3000, ['d1', 'b1']], 'a passage\'s floor: fair again, new ground');
  egFairPose(A, sp, { x: 0, y: 0, z: cave.z1 + 1 }, t0 + 3600);
  assert.equal(egSupportAt(sp, 0, 0, cave.z1 + 1, (t0 + 3600) / 1000), EG_HOLD.none);
  assert.equal(A.far, cave.z0 + 4, 'past the floor\'s end, over the gap: no point');
  egFairPose(A, sp, { x: ledge.x, y: 0, z: ledge.z }, t0 + 4200);
  assert.deepEqual([A.far, A.fnew], [cave.z0 + 4, t0 + 3000], 'back on a piece behind: the furthest kept, a piece is no new ground');
  const P = egFairNew(2, t0);
  egFairPose(P, sp, { x: 0, y: 0, z: sp.arrive.z }, t0 + 100);
  egFairPose(P, sp, { x: ledge.x, y: 0, z: ledge.z }, t0 + 700);
  assert.deepEqual([P.far, P.fnew], [ledge.z, 0], 'a held piece moves the point and is no new ground');
  const E = egFairNew(2, t0);
  egFairPose(E, sp, { x: 0, y: 0, z: sp.arrive.z }, t0 + 100);
  egFairPose(E, sp, { x: sp.end.x, y: 0, z: sp.end.z }, t0 + 700);
  assert.deepEqual([E.far, E.fnew, E.seen], [sp.end.z, 0, []], 'the end plate: the point, and no island');
});

test('EG-ZI THE TOLL\'S LAW (section 10.6, net/eliteGates/egBrain.js egTollOf): 5% a quarter of the road still ahead of the furthest fair point - every quarter begun counted whole (a step short of the end pays one), at most 20% - after the halls a road is crossed in (the Span, the Deepway, a Brink, the Proving Walk), never after a fight\'s or a Court\'s; nothing for a member who stepped through or stood at the door on a fair trail, or who reached new ground in its last 15 s; a member never judged stands at the arrival plate (mutants: the quarters floored; the cap gone; the step; the waiver gone or widened; the door unread; a hall kind dropped)', () => {
  assert.deepEqual([EG_TOLL_STEP, EG_TOLL_QUARTERS, EG_TOLL_WAIVE_MS, [...EG_TOLL_KINDS]], [0.05, 4, 15_000, ['span', 'deepway', 'brink', 'proving']]);
  const sp = egHallOf(12345, 2, 0), now = T0 + 100_000, m = { downH: 0 };
  const at = (far, o = {}) => { const A = egFairNew(2, T0); A.far = far; Object.assign(A, o); return egTollOf(sp, m, A, 2, now); };
  // the road 144.14 m: island 1 (41.49) leaves 2.85 quarters, island 2 (77.73) 1.84, island 3 (117.15) 0.75
  assert.deepEqual(sp.islands.map((q) => at(q.z)), [3, 2, 1], 'by the quarters begun');
  assert.equal(at(sp.end.z / 2), 2, 'two whole quarters: two');
  assert.equal(at(sp.end.z - 0.5), 1, 'a step short of the end: one');
  assert.equal(at(sp.end.z), 0, 'none ahead: none');
  assert.equal(at(sp.arrive.z), 4, 'never left the plate: the whole road');
  assert.equal(at(sp.arrive.z - 4), 4, 'behind the plate: at most four');
  assert.equal(egTollOf(sp, m, null, 2, now), 4, 'never judged: from the arrival plate');
  assert.equal(at(sp.arrive.z, { atEnd: 1 }), 0, 'stood at the door on a fair trail');
  assert.equal(egTollOf(sp, { downH: 2 }, null, 2, now), 0, 'stepped through the door');
  assert.equal(egTollOf(sp, { downH: 1 }, null, 2, now), 4, 'a door of another hall');
  assert.equal(at(sp.islands[0].z, { fnew: now - EG_TOLL_WAIVE_MS }), 0, 'new ground 15 s before the pull: waived');
  assert.equal(at(sp.islands[0].z, { fnew: now - EG_TOLL_WAIVE_MS - 1 }), 3, 'a millisecond older: paid');
  // the halls: a road crossed pays, a fight does not
  const plate = (h) => egTollOf(egHallOf(12345, h, 0), m, null, h, now);
  assert.deepEqual([12, 26, 3, 7].map((h) => [egHallOf(12345, h, 0).kind, plate(h)]), [['deepway', 4], ['brink', 4], ['proving', 4], ['span', 4]]);
  assert.deepEqual([1, 4, 5].map((h) => [egHallOf(12345, h, 0).kind, plate(h)]), [['yard', 0], ['rampart', 0], ['court', 0]]);
});

test('EG-ZI THE PULL\'S TOLL (sections 7, 10.6 and 21): at a span\'s closing\'s end the director tells each member short of the end its toll alone (`toll`, its quarters and the hall), by its fair trail - the idle on the plate the whole road, one who stood on Island 2 and stayed two quarters, one who reached new ground in its last 15 s nothing, one who reached the end plate fairly or stepped through nothing; the frames pass the wire; the census takes it off the count as a blow, never the last of it (mutants: no toll; the toll to everyone; the fair trail unread; the census untouched; the floor gone)', () => {
  const S = breach(6, 2), { B } = S, sp = S.spec();
  for (let k = 0; k < 200 && B.sg !== 'trial'; k++) S.step();
  assert.equal(B.sg, 'trial');
  const hw = B.hw, [i1, i2, i3] = sp.islands, door = { x: sp.end.x, z: sp.end.z - 2, y: 0 };
  for (const [sub] of S.co) S.pose(sub, sp.arrive.x, sp.arrive.z, 0, hw + 100);
  // acct-0 crosses (blind hops - a trail that judges nothing either way - under the two seconds a blind share is read at) to
  // the door's reach, 2 m short of the plate's heart
  for (const [k, q] of [i1, i2, i3, door].entries()) S.pose('acct-0', q.x, q.z, q.y ?? 0, hw + 550 + 450 * k);
  assert.deepEqual([B.mem['acct-0'].fair.atEnd, B.mem['acct-0'].fair.far], [1, door.z], 'the end reached on a fair trail');
  // acct-5 leaps the whole road in 200 ms: at the door on a broken trail
  S.pose('acct-5', door.x, door.z, 0, hw + 300);
  assert.deepEqual([B.mem['acct-5'].fair.brk, B.mem['acct-5'].fair.atEnd, B.mem['acct-5'].fair.far], [1, 0, sp.arrive.z], 'at the door, never fairly');
  S.pose('acct-2', i2.x, i2.z, 0, hw + 600);
  S.pose('acct-3', i1.x, i1.z, 0, hw + 600);
  S.put('acct-0', door.x, door.z); S.put('acct-2', i2.x, i2.z); S.put('acct-3', i1.x, i1.z); S.put('acct-5', door.x, door.z + 1);
  for (let k = 0; k < 40 && B.sg === 'trial'; k++) S.step();
  assert.equal(B.sg, 'closing', 'acct-0 opened the door');
  const su = B.su;
  while (S.now() + 250 < su - 10_000) S.step();
  S.pose('acct-3', i3.x, i3.z, i3.y, S.now());   // new ground, ten seconds before the pull
  S.put('acct-4', sp.end.x, sp.end.z);
  S.step();
  assert.equal(egDown(B, 'acct-4', 2, { sx: sp.x0 + sp.end.x, z: sp.end.z }, S.now()), true, 'acct-4 steps through');
  const start = S.frames.length;
  while (B.h === 2) S.step();
  const pulled = S.frames.slice(start);
  assert.deepEqual(tolls(pulled), [['acct-1', 4, 2], ['acct-2', 2, 2], ['acct-5', 4, 2]], 'the idle the whole road; Island 2 two quarters; the leap all of it; the rest nothing');
  assert.ok(pulled.findIndex((f) => f.k === 'toll') < pulled.findIndex((f) => f.k === 'sg'), 'told with the pull, before its stage');
  assert.equal(S.bad(), 0, 'every frame the wire takes');
  assert.deepEqual(wire(pulled.find((f) => f.k === 'toll')), { k: 'toll', q: 4, h: 2 });
  // the census: the toll counted as a blow, its member's alone
  egCountHeals(B, pulled, S.now(), LINE);
  assert.deepEqual(['acct-1', 'acct-2', 'acct-0'].map((s) => Math.round((B.mem[s].bd?.v ?? 1) * 1000)), [800, 900, 1000]);
  assert.deepEqual([B.mem['acct-1'].bd.t, B.mem['acct-1'].cs[3]].map((v) => Math.round(v * 1000) / 1000), [0.2, 200], 'in the census\'s thousandths');
  // never the last of it
  B.mem['acct-2'].bd.v = 0.1;
  egCountHeals(B, [{ k: 'toll', to: 'acct-2', q: 4, h: 3 }], S.now(), LINE);
  assert.equal(Math.round(B.mem['acct-2'].bd.v * 1000), 10, 'never the last of it');
  assert.equal(B.mem['acct-2'].alive, 1);
  B.mem['acct-3'].alive = 0;
  egCountHeals(B, [{ k: 'toll', to: 'acct-3', q: 4, h: 3 }], S.now(), LINE);
  assert.equal(B.mem['acct-3'].bd?.v ?? 1, 1, 'a witness\'s count untouched');
  // a fight's pull: no toll
  const F = breach(2, 1);
  for (let k = 0; k < 200 && F.B.sg !== 'trial'; k++) F.step();
  closeNow(F);
  const s1 = F.frames.length;
  while (F.B.h === 1) F.step();
  assert.deepEqual(tolls(F.frames.slice(s1)), [], 'a Rift-Yard\'s pull costs nothing');
});

test('EG-ZI THE TOLL ON THE WIRE AND ON THE SCREEN (sections 10.6, 23 and 27.5): `toll` is the room\'s word to its member - its quarters 1 to 4 and its hall - and nothing else passes; the screen pays it as it pays the void\'s cost, through the hurt door and never the last of it, once a hall, and says it: its share on the screen and its line in the chat (mutants: the bound widened; the toll unpaid; paid twice; the last of it taken; the words unsaid)', () => {
  assert.equal(EG_TOLL_WIRE_MAX, EG_TOLL_QUARTERS, 'the wire\'s bound is the law\'s');
  assert.ok(EG_RUN_KINDS.includes('toll'));
  assert.deepEqual([1, 4].map((q) => validEgOut({ k: 'toll', q, h: 7 })), [{ k: 'toll', q: 1, h: 7 }, { k: 'toll', q: 4, h: 7 }]);
  for (const bad of [{ q: 0, h: 7 }, { q: 5, h: 7 }, { q: 1.5, h: 7 }, { q: 2, h: 0 }, { q: 2 }, { q: '2', h: 7 }]) assert.equal(validEgOut({ k: 'toll', ...bad }), null, JSON.stringify(bad));
  assert.equal(validEgIn({ k: 'toll', q: 1, h: 7 }), null, 'never a member\'s word');
  // AUDIT EG III (PIN MOVED): the words take what the toll took of the health bar, not its quarters
  assert.deepEqual([0.05, 0.1, 0.15, 0.2].map((q) => EG_PRES_TEXT.toll(q)), ['-5%', '-10%', '-15%', '-20%']);
  assert.equal(EG_PRES_TEXT.tollLine(0.15), 'The Spire takes its toll: 15% of your health.');
  // the screen (test/net/eliteGates/egz_recap.test.js's harness: a client inside a breach of two)
  let clock = T0 + EG_SEALED_MS + 60_000, inside = true;
  const co = [['acct-0', 'Mac', 1], ['acct-1', 'Ann', 2]];
  const Br = egBreachNew({ b: CB, ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed: 77, op: T0, co, site: SITE, wg: [] });
  for (const [sub] of co) egEnter(Br, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  Br.h = 2; Br.sg = 'trial'; Br.wk = clock - 1000; Br.cnt = { left: 1_500_000, at: clock - 1000 };
  const said = [], mids = [], hurts = [];
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } };
  const modes = { mode: 'dungeon', egHallBreach: () => (inside ? Br.b : null), egHallCircle: () => 1, egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, sendEg: () => true };
  const mem = new Map(), store = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); } };
  const account = { me: () => 'acct-0', guest: () => false, keys: async () => ({ ok: false, error: 'offline' }), claim: async () => ({ ok: false }), first: async () => ({ ok: false }) };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
    say: (t) => said.push(t), mid: (t) => mids.push(t), site: () => ({}), wire: () => null, landAt: () => true, hurt: (n) => { hurts.push(n); entity.health -= n; }, peers: () => [], store,
    audio: { playOneShot: () => {} }, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) } });
  const tell = (w) => { const v = wire(w); assert.ok(v, `the wire refuses ${w.k}`); client.word(v); };
  tell(egStateOf(Br, clock));
  const sp = egHallOf(77, 2, 0);
  player.pos = realmToDungeon(sp.x0 + sp.arrive.x, 0, sp.arrive.z);
  client.frame();
  tell({ k: 'toll', to: 'acct-0', q: 3, h: 2 });
  assert.deepEqual([entity.health, hurts], [65, [15]], 'three quarters: 15% through the hurt door');
  assert.equal(mids.at(-1), '-15%', 'its share on the screen');
  assert.ok(said.includes('The Spire takes its toll: 15% of your health.'), 'its line in the chat');
  tell({ k: 'toll', to: 'acct-0', q: 3, h: 2 });
  assert.equal(entity.health, 65, 'once a hall');
  entity.health = 9;
  tell({ k: 'toll', to: 'acct-0', q: 4, h: 3 });
  assert.equal(entity.health, 1, 'never the last of it');
  entity.health = 1;
  tell({ k: 'toll', to: 'acct-0', q: 4, h: 4 });
  assert.deepEqual([entity.health, hurts.length], [1, 2], 'nothing left to take: no hurt');
  inside = false; entity.health = 50;
  tell({ k: 'toll', to: 'acct-0', q: 2, h: 5 });
  assert.equal(entity.health, 50, 'outside the Spire: nothing');
});

test('EG-ZI THE LATE WAKE (section 7): a hall woken before a member\'s `here` counts it late, one in time begins the count again; after two halls in a row woken late the gather waits only 10 s after the pull for it - its end said as it moves, and only once every member still owed is such a one - and a late member\'s `here` is heard when it reaches the plate after the wake, its trail judged from there; the next circle\'s first hall waits by the same law (mutants: never counted; never begun again; 10 s for anyone owed; the end unsaid; the late `here` unheard; the next circle\'s wait the old)', () => {
  assert.deepEqual([EG_LATE_HALLS, EG_LATE_ARRIVE_MS, EG_ARRIVE_MAX_MS], [2, 10_000, 30_000]);
  const S = breach(2, 1), { B } = S;
  const off = () => S.put('acct-1', 0, 30);
  const woke = () => { for (let k = 0; k < 400 && B.sg !== 'trial'; k++) S.step(); assert.equal(B.sg, 'trial'); return B.hw - B.pulledAt; };
  const pullNow = () => { closeNow(S); const h = B.h; while (B.h === h) S.step(); S.plate('acct-0'); };
  // hall 1: acct-1 is not on the plate - the hall wakes at 30 s without it
  off();
  assert.equal(woke(), EG_ARRIVE_MAX_MS);
  assert.deepEqual([B.mem['acct-0'].late, B.mem['acct-1'].late], [0, 1], 'woke late once');
  // hall 2: again
  pullNow(); off();
  assert.equal(B.su, B.pulledAt + EG_ARRIVE_MAX_MS, 'one late hall: the whole wait');
  assert.equal(woke(), EG_ARRIVE_MAX_MS);
  assert.equal(B.mem['acct-1'].late, 2, 'twice in a row');
  // hall 3: both owed at the pull - the whole wait; acct-0 here, only acct-1 owed - 10 s, said
  pullNow(); off();
  S.put('acct-0', 0, 30);
  assert.equal(B.su, B.pulledAt + EG_ARRIVE_MAX_MS, 'a member owed who is not late: the whole wait');
  S.step(); S.step();
  assert.equal(B.su, B.pulledAt + EG_ARRIVE_MAX_MS, 'still');
  const said = S.frames.length;
  S.plate('acct-0');
  S.step();
  assert.equal(B.su, B.pulledAt + EG_LATE_ARRIVE_MS, 'only the late one owed: 10 s');
  assert.ok(S.frames.slice(said).some((f) => f.k === 'sg' && f.su === B.pulledAt + EG_LATE_ARRIVE_MS), 'its end said');
  assert.equal(woke(), EG_LATE_ARRIVE_MS, 'the hall wakes 10 s after the pull');
  assert.equal(B.mem['acct-1'].late, 3);
  // its `here`, late: heard as it reaches the plate, and its trail judged from there
  assert.notEqual(B.mem['acct-1'].hereH, B.h);
  S.step();
  S.pose('acct-1', 0, 30, 0, S.now());
  assert.equal(B.mem['acct-1'].fair ?? null, null, 'off the plate, unheard: no trail');
  S.plate('acct-1'); S.step();
  assert.equal(B.mem['acct-1'].hereH, B.h, 'its `here` heard after the wake');
  const sp = S.spec();
  S.pose('acct-1', sp.arrive.x, sp.arrive.z, 0, S.now());
  assert.equal(B.mem['acct-1'].fair?.k, `${B.h}:0`, 'its trail begun');
  // hall 4: in time - the count begins again, and the next hall waits the whole 30 s for it
  pullNow(); S.plate('acct-1');
  woke();
  assert.equal(B.mem['acct-1'].late, 0, 'here in time: begun again');
  pullNow(); off();
  assert.equal(woke(), EG_ARRIVE_MAX_MS, 'one late hall since: the whole wait');
  // a pull with every member late twice running: its own word says 10 s
  B.mem['acct-0'].late = 2; B.mem['acct-1'].late = 2;
  const p0 = S.frames.length;
  pullNow();
  assert.equal(B.su - B.pulledAt, EG_LATE_ARRIVE_MS, 'the pull\'s wait');
  assert.equal(S.frames.slice(p0).find((f) => f.k === 'sg' && f.h === B.h).su - B.pulledAt, EG_LATE_ARRIVE_MS, 'said with the pull');
  // the next circle's first hall (the rest over): both late twice running - 10 s
  B.mem['acct-0'].late = 2; B.mem['acct-1'].late = 2;
  B.h = 5; B.sg = 'rest'; B.rd = 1; B.rdSeq = { recalled: 1, window: 1 }; B.su = S.now() + 250; B.F = null;
  S.step();
  assert.deepEqual([B.h, B.sg, B.su - B.pulledAt], [6, 'arrive', EG_LATE_ARRIVE_MS]);
  B.mem['acct-0'].late = 1; B.h = 10; B.sg = 'rest'; B.su = S.now() + 250;
  S.step();
  assert.deepEqual([B.h, B.su - B.pulledAt], [11, EG_ARRIVE_MAX_MS], 'one not late twice: the whole wait');
});

test('EG-ZI LIFELINE IN THE CENSUS (sections 15 and 21; EG-ZB\'s departure 8 closed): a believed heal of a Lifeline holder\'s on a member under 30% - its count, or seen so within the heal word\'s second and a beat (its own word\'s or the count\'s) - spares that member\'s blows 20 / 25 / 30% by the healer\'s rank, from the word\'s second back to 3 s past it, the strongest window\'s, inside the census\'s 30%; a heal not believed, a healer without it, or a member not under 30% opens none; windows a blow can no longer be judged in let go (mutants: Lifeline unapplied; the rank misread; the window\'s ends; the look back; the word unread; the count unread; the strongest summed; an unbelieved heal; the windows kept for ever)', () => {
  assert.deepEqual([EG_LIFELINE_UNDER, EG_LIFELINE_MS, EG_HEAL_WORD_MS, EG_LIFELINE_LOOK_MS], [0.3, 3000, 1000, 1000 + BRAIN_TICK_MS]);
  assert.equal(EG_HEAL_WORD_MS, EG_HEAL_SEND_MS, 'the heal word\'s second is the client\'s');
  assert.deepEqual(EG_VESTIGES.find((V) => V.key === 'lifeline').v, [0.2, 0.25, 0.3]);   // PIN MOVED (AUDIT EG III, lane2 #5): every rank under the census's 30%, III at it
  const S = breach(4, 1), { B } = S;
  for (let k = 0; k < 200 && B.sg !== 'trial'; k++) S.step();
  const spec = S.spec(), view = egFightView(spec), f = spec.fl[0], subs = Object.keys(B.mem);
  const far = (at) => subs.map((s, i) => ({ sub: s, tr: [[at - 600, f.x + i * 8 - 12, 0, f.z, B.h], [at, f.x + i * 8 - 12, 0, f.z, B.h]] }));
  const dr = (sub, at) => egCensusDr(B, B.F, view, { sub, at, o: 0 }, far(at));
  const [me, healer, other, low] = subs;
  B.mem[healer].vs = [[vId('lifeline'), 1]];
  const t = S.now();
  bodyStruck(B.mem[me], 0.75, t, LINE);
  assert.ok(egHeal(B, me, [[healer, 40]], t, LINE, undefined, CAST_SEEN) > 0, 'believed');
  assert.deepEqual(B.mem[me].ll, [[t - EG_HEAL_WORD_MS, t + EG_LIFELINE_MS, 0.2]]);
  assert.deepEqual([t - EG_HEAL_WORD_MS - 1, t - EG_HEAL_WORD_MS, t + 2000, t + EG_LIFELINE_MS, t + EG_LIFELINE_MS + 1].map((at) => dr(me, at)), [0, 0.2, 0.2, 0.2, 0], 'Lifeline I, inside its window');
  // the census applies it to the count: a plain blow of 0.4 inside the window counts 0.32
  const t3 = t + 1500, cx = f.x - 12, cz = f.z;
  egAim(B.F, spec, { o: 0, s: [shDisc(cx, cz, 2)], at: t3, wu: 1500, p: 0.4, b: 0, el: null, nm: 'Test Blow' }, [], t3 - 1500, []);
  const cs0 = B.mem[me].cs?.[3] ?? 0, tr3 = subs.map((s, i) => ({ sub: s, tr: [[t3 - 300, f.x + i * 8 - 12, 0, f.z, B.h], [t3 + 100, f.x + i * 8 - 12, 0, f.z, B.h]] }));
  egCount(B, t3 + 900, tr3, LINE);
  assert.equal(B.mem[me].cs[3] - cs0, 320, 'Lifeline I spares a fifth of it in the count');
  // the strongest healer of a word's; two windows at once - the strongest, never summed; inside the census's 30% (PIN MOVED, AUDIT
  // EG III: every heal from here a window's worth - net/eliteGates/egBrain.js EG_LIFELINE_MIN)
  B.mem[other].vs = [[vId('lifeline'), 2]];
  egHeal(B, me, [[healer, 40], [other, 40]], t + 100, LINE, undefined, CAST_SEEN);
  assert.equal(B.mem[me].ll.at(-1)[2], 0.25, 'Lifeline II of the two');
  B.mem[me].ll = [[t, t + 3000, 0.2], [t, t + 3000, 0.2]];
  assert.equal(dr(me, t + 10), 0.2, 'the strongest window, not their sum');
  B.mem[me].ll = [[t, t + 3000, 0.3]];
  assert.equal(dr(me, t + 10), EG_DR_MAX, 'Lifeline III at the 30%');
  // a healer without it, a heal not believed, a member not under 30%
  B.mem[me].ll = [];
  B.mem[other].vs = [];
  egHeal(B, me, [[other, 40]], t + 200, LINE, undefined, CAST_SEEN);
  assert.deepEqual(B.mem[me].ll, [], 'a healer without Lifeline: none');
  egHeal(B, me, [['nobody', 40]], t + 200, LINE, undefined, CAST_SEEN);
  assert.deepEqual(B.mem[me].ll, [], 'no healer of the breach: none');
  B.mem[me].vs = [[vId('lifeline'), 2]];
  assert.ok(egHeal(B, me, [[me, 40], [other, 40]], t + 200, LINE, undefined, CAST_SEEN) > 0, 'the companion\'s heal believed');
  assert.deepEqual(B.mem[me].ll, [], 'the member\'s own Lifeline, its own heal never believed: none');
  B.mem[me].vs = [];
  B.mem[me].hb = 0; B.mem[me].hbAt = t + 300;
  assert.equal(egHeal(B, me, [[healer, 40]], t + 300, LINE, undefined, CAST_SEEN), 0, 'the heal bucket empty');
  assert.deepEqual(B.mem[me].ll, [], 'a heal not believed: none');
  assert.equal(egHeal(B, other, [[healer, 40]], t + 300, LINE, undefined, CAST_SEEN) > 0, true);
  assert.equal(B.mem[other].ll, undefined, 'a member whole: none');
  // under 30% by its own word, though the count stands higher: within the word's second and a beat, and not after
  const tl = t + 5000;
  assert.equal(egBodyWord(B, low, 250, tl, LINE), false, 'a word under the count claims nothing');
  assert.equal(B.mem[low].lowAt, tl);
  egHeal(B, low, [[healer, 40]], tl + EG_LIFELINE_LOOK_MS, LINE, undefined, CAST_SEEN);
  assert.equal(B.mem[low].ll?.length, 1, 'its word said under 30% a second and a beat before');
  egBodyWord(B, other, 600, tl, LINE);
  assert.equal(B.mem[other].lowAt, undefined, 'a word over 30% notes nothing');
  egBodyWord(B, other, 299, tl, LINE);
  egHeal(B, other, [[healer, 40]], tl + EG_LIFELINE_LOOK_MS + 1, LINE, undefined, CAST_SEEN);
  assert.equal(B.mem[other].ll, undefined, 'and not a moment later');
  // the count seen low at a beat (egCount), raised since by its own word: a heal within the look finds it
  const B2 = breach(2, 1), q = B2.B;
  for (let k = 0; k < 200 && q.sg !== 'trial'; k++) B2.step();
  q.mem['acct-1'].vs = [[vId('lifeline'), 3]];
  const tc = B2.now();
  bodyStruck(q.mem['acct-0'], 0.8, tc, LINE);
  egCount(q, tc, [], LINE);
  assert.equal(q.mem['acct-0'].lowAt, undefined, 'a member the beat holds no trail of is not read');
  egCount(q, tc, [{ sub: 'acct-0', tr: [] }, { sub: 'acct-1', tr: [] }], LINE);
  assert.deepEqual([q.mem['acct-0'].lowAt, q.mem['acct-1'].lowAt], [tc, undefined], 'the count under 30% noted at its beat');
  egBodyWord(q, 'acct-0', 900, tc + 100, LINE);
  assert.ok(q.mem['acct-0'].bd.v > EG_LIFELINE_UNDER, 'its word stood it up');
  egHeal(q, 'acct-0', [['acct-1', 40]], tc + 1000, LINE, undefined, CAST_SEEN);
  assert.equal(q.mem['acct-0'].ll.at(-1)[2], 0.3, 'Lifeline III from the count seen low');
  // the windows let go once no blow in them can still be judged, and four kept at most
  const tw = tc + 1000;
  for (let k = 1; k <= 5; k++) egHeal(q, 'acct-0', [['acct-1', 40]], tw + k * 10, LINE, undefined, CAST_SEEN);
  assert.equal(q.mem['acct-0'].ll.length, 4, 'four at most');
  bodyStruck(q.mem['acct-0'], 0.9, tw, LINE);
  egHeal(q, 'acct-0', [['acct-1', 40]], tw + EG_LIFELINE_MS + EG_TRAIL_MS + 100, LINE, undefined, CAST_SEEN);
  assert.equal(q.mem['acct-0'].ll.length, 1, 'the old windows let go');
});

test('EG-ZI IN THE ROOM (server/src/index.js): a span\'s pull in the room\'s own beat tells the idle member its toll on its own socket alone - never the one who stepped through - and the room\'s census takes it off that member\'s count as it fans it (mutants: the toll fanned to all; the census unread)', async () => {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const B0 = 'feedfacecafe0cc0';
  const eg = fakeRoom(egRoomKey(B0), { now: () => clock });
  const w = console.warn; console.warn = () => {};
  try {
    const subs = ['acct-mac', 'acct-ann'];
    const co = subs.map((s, i) => [s, `M${i}`, i + 1]);
    const res = await eg.room.fetch(new Request(`https://relay.internal${EG_INTERNAL_OPEN}`, { method: 'POST', body: JSON.stringify({ b: B0, ez: 'z'.repeat(20), s: co[0][0], o: 'M0', ew: 0, rh: 0, seed: 12345, op: T0, co, site: { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 } }) }));
    assert.equal(res.status, 200);
    const beat = async (ms) => { const end = clock + ms; while (eg.alarm.at != null && eg.alarm.at <= end) { clock = Math.max(clock, eg.alarm.at); await eg.fire(); } clock = end; };
    clock += EG_SEALED_MS; await beat(1000);
    const spec = egHallOf(12345, 1, 0), socks = {};
    const poseAt = (sp, x, z, y = 0) => { const [px, py, pz] = realmToDungeon(sp.x0 + x, y, z); return { x: px, y: py, z: pz, yaw: 0, pitch: 0 }; };
    for (const [i, [sub]] of co.entries()) {
      const ws = eg.connect();
      await eg.hello(ws, `peer-${sub}`, poseAt(spec, spec.arrive.x, spec.arrive.z), { kind: 'linked', tokenSub: sub, charLevel: 20 });
      const z = await mintEgOrder({ o: 'egadmit', s: sub, eb: B0, ez: `${'c'.repeat(19)}${i}` }, (await eg.signer()).privateKey, { subtle: globalThis.crypto.subtle, nowS: Math.floor(clock / 1000) });
      await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z, lv: 20, bv: 2 }));
      socks[sub] = ws;
    }
    for (const ws of Object.values(socks)) await eg.pose(ws, poseAt(spec, spec.arrive.x, spec.arrive.z));
    await beat(10_000);
    const R = eg.room._eg;
    assert.equal(R.sg, 'trial');
    // the company in a span's closing: mac stepped through, ann idle on the plate - the closing ends
    const s2 = egHallOf(12345, 2, 0);
    R.h = 2; R.sg = 'closing'; R.dn = clock; R.su = clock + 2000; R.hw = clock - 60_000; R.F = null;
    R.mem['acct-mac'].downH = 2; R.mem['acct-ann'].hereH = 2;
    for (const ws of Object.values(socks)) await eg.pose(ws, poseAt(s2, s2.arrive.x, s2.arrive.z));
    for (const ws of Object.values(socks)) ws.sent.length = 0;
    await beat(3000);
    assert.equal(R.h, 3, 'pulled');
    const words = (sub) => socks[sub].sent.filter((m) => m.t === 'eg' && m.k === 'toll').map(({ t: _t, ...rest }) => rest);
    assert.deepEqual(words('acct-ann'), [{ k: 'toll', q: 4, h: 2 }], 'the idle member its toll, on its own socket');
    assert.deepEqual(words('acct-mac'), [], 'never the one who stepped through');
    assert.equal(Math.round(R.mem['acct-ann'].bd.v * 1000), 800, 'the room\'s census took it as it fanned it');
    assert.equal(R.mem['acct-mac'].bd?.v ?? 1, 1);
  } finally { Date.now = realNow; console.warn = w; }
});
