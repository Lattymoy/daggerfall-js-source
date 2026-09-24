// DUEL1 (2026-09-24, Mac: "When inspecting a player, they should be able to send an invite to duel which then traps both
// players in a surrounding transparent holographic wall that keeps them from going outside of the duel space."; asked:
// weapons, bows and spells; "Loser drops to 1HP and both are fully healed on duel end"; outdoors only): THE DUEL'S LAW,
// DRIVEN. Two managers (net/duelSession.js) over a fake wire that projects every frame through the relay's own law
// (net/wire.js validDuelData) and stamps the sender's id and account as the relay does - the three-step handshake, every
// refusal, the count, the blows (theirs alone, each once, in budget), every end and who it names, the heal's hold, the
// ring's own geometry.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createDuelManager, clampToRing, ringCentre, groundDistance, validRingRecord, duelWhyText, worldGroundMetres,
  DUEL_RADIUS_M, DUEL_RANGE_M, DUEL_ASK_TTL_MS, DUEL_START_WAIT_MS, DUEL_COUNTDOWN_MS, DUEL_MAX_MS, DUEL_GONE_MS,
  DUEL_OUT_SLACK_M, DUEL_OUT_MS, DUEL_HEAL_HOLD_MS, DUEL_BLOWS_PER_S, NATIVES_PER_M, DUEL_REASK_MS,
} from '../src/net/duelSession.js';
import { validDuelData, DUEL_WHY } from '../src/net/wire.js';

const ATT = { lv: 10, r: 2, st: [60, 40, 40, 55, 50, 40, 50, 50], sk: [45, 30, 20, 10], cf: [0, 0, 0], h: [80, 80] };
const P0 = [100000, 10, 200000];   // a world-frame point: natives on x and z, metres on y

/** Two players, A and B, and the wire between them - frames delivered in order on `pump()`, each through the relay's
 *  law and stamped with its sender's id and account, as the relay's duel arm does. */
function rig({ nearAB = true } = {}) {
  let t = 1_000_000;
  const now = () => t;
  const inbox = { a: [], b: [] };
  const log = { a: [], b: [] };
  const P = {
    a: { id: 'peer-aaaa', sub: 'acct-aaaa', pos: [...P0], can: null, near: nearAB, reaches: true, blows: [], results: [], ends: [], heals: 0, prompts: 0, starts: 0, dmg: 0, fell: false, sock: true },
    b: { id: 'peer-bbbb', sub: 'acct-bbbb', pos: [P0[0] + 4 * NATIVES_PER_M, P0[1], P0[2]], can: null, near: nearAB, reaches: true, blows: [], results: [], ends: [], heals: 0, prompts: 0, starts: 0, dmg: 0, fell: false, sock: true },
  };
  const other = (k) => (k === 'a' ? 'b' : 'a');
  const mk = (k) => {
    const me = P[k], them = P[other(k)];
    return createDuelManager({
      send: (d) => {
        if (!me.sock) return false;
        const v = validDuelData(d);
        if (!v) throw new Error(`the manager sent a frame the relay refuses: ${JSON.stringify(d)}`);
        if (d.to !== them.id) return true;   // a frame at nobody we model - it left
        inbox[other(k)].push({ from: me.id, sub: me.sub, d: v });
        log[k].push(v);
        return true;
      },
      now, say: () => {}, peerName: (id) => (id === them.id ? them.id.toUpperCase() : null), selfId: () => me.id,
      near: (id) => id === them.id && me.near, can: () => me.can,
      ringFor: (id) => (id === them.id ? ringCentre(me.pos, them.pos) : null),
      reaches: (id) => id === them.id && me.reaches,
      myPos: () => me.pos, peerPos: (id) => (id === them.id ? (me.seen ?? them.pos) : null),   // `seen`: where MY machine places them, when that is not where they place themselves
      onPrompt: () => { me.prompts++; },
      onStart: () => { me.starts++; },
      onBlow: (d) => { me.blows.push(d); const r = { hit: true, dmg: 7 }; me.dmg += 7; if (me.fell) m[k].fell(); return r; },
      onResult: (d) => { me.results.push(d); },
      onEnd: (duel, end) => { me.ends.push(end); },
      onHeal: () => { me.heals++; },
      vitals: () => [me.fell ? 1 : 80, 80],
      rand: () => 0.123456789,
    });
  };
  const m = { a: mk('a'), b: mk('b') };
  const pump = () => {
    let n = 0;
    while (inbox.a.length || inbox.b.length) {
      for (const k of ['a', 'b']) {
        const q = inbox[k].splice(0);
        for (const f of q) { m[k].onFrame(f.from, f.d, f.sub); n++; }
      }
      if (n > 500) throw new Error('the wire never settled');
    }
  };
  return { m, P, pump, log, tick: (ms) => { t += ms; m.a.tick(); m.b.tick(); pump(); }, now };
}
/** A through the whole handshake and past the count. */
function duelling(opts) {
  const r = rig(opts);
  assert.deepEqual(r.m.a.request('peer-bbbb'), { ok: true });
  r.pump();
  assert.deepEqual(r.m.b.accept('peer-aaaa'), { ok: true });
  r.pump();
  r.tick(DUEL_COUNTDOWN_MS + 1);
  return r;
}

test('DUEL1 the handshake is THREE steps - ask, yes, start - and nobody stands in a ring the other side never confirmed: the challenged player is prompted, their yes waits on the start, and both begin on ONE ring with ONE id (mutants: the accepter begins on its own yes; the start never sent; two rings)', () => {
  const r = rig();
  assert.deepEqual(r.m.a.request('peer-bbbb'), { ok: true });
  assert.equal(r.m.a.stateFor('peer-bbbb'), 'outgoing');
  r.pump();
  assert.equal(r.P.b.prompts, 1, 'the challenge prompts the challenged player once');
  assert.equal(r.m.b.stateFor('peer-aaaa'), 'incoming');
  assert.deepEqual(r.m.b.asks().map((x) => x.peer), ['peer-aaaa']);
  assert.deepEqual(r.m.b.accept('peer-aaaa'), { ok: true });
  assert.equal(r.m.b.live, null, 'a yes is not a duel - the accepter waits on the challenger\'s start');
  assert.equal(r.m.b.stateFor('peer-aaaa'), 'waiting');
  r.pump();
  assert.ok(r.m.a.live && r.m.b.live, 'the start began both');
  assert.equal(r.m.a.live.s, r.m.b.live.s, 'one duel id');
  assert.deepEqual(r.m.a.live.c, r.m.b.live.c, 'one ring - the challenger measured it and the start carried it');
  assert.deepEqual(r.m.a.live.c, ringCentre(r.P.a.pos, r.P.b.pos), 'the midpoint of the two bodies');
  assert.equal(r.m.a.live.sub, 'acct-bbbb', 'each side holds the other\'s account as the relay stamped it');
  assert.equal(r.m.b.live.sub, 'acct-aaaa');
  assert.equal(r.P.a.starts + r.P.b.starts, 2);
  assert.deepEqual(r.log.a.map((f) => f.k), ['ask', 'start']);
  assert.deepEqual(r.log.b.map((f) => f.k), ['yes']);
  assert.equal(r.m.a.stateFor('peer-bbbb'), 'live');
  assert.equal(r.m.a.stateFor('peer-cccc'), 'busy', 'a duellist is busy to everyone else');
});

test('DUEL1 refusals, said: a decline tells the challenger; a challenge lapses in DUEL_ASK_TTL_MS on both sides; a player who cannot duel (indoors, fallen) or stands past DUEL_RANGE_M is answered with the reason and never prompted; a yes to an ask that lapsed is told so (mutants: the decline silent; the lapse one-sided; an indoor player prompted)', () => {
  let r = rig();
  r.m.a.request('peer-bbbb'); r.pump();
  assert.deepEqual(r.m.b.decline('peer-aaaa'), { ok: true });
  r.pump();
  assert.equal(r.m.a.stateFor('peer-bbbb'), 'none', 'the decline ended the challenge');
  assert.equal(r.m.b.stateFor('peer-aaaa'), 'none');
  // a declined challenger asking again at once is answered no - no line, no prompt over my game - until DUEL_REASK_MS
  r.m.a.request('peer-bbbb'); r.pump();
  assert.equal(r.P.b.prompts, 1, 'no second prompt');
  assert.equal(r.m.a.stateFor('peer-bbbb'), 'none', 'the challenger is told no');
  r.tick(DUEL_REASK_MS + 1);
  r.m.a.request('peer-bbbb'); r.pump();
  assert.equal(r.P.b.prompts, 2, 'after the quiet, heard again');
  r.m.b.decline('peer-aaaa'); r.pump();
  r = rig();
  r.m.a.request('peer-bbbb'); r.pump();
  r.tick(DUEL_ASK_TTL_MS + 1);
  assert.equal(r.m.a.stateFor('peer-bbbb'), 'none', 'the challenger lets go');
  assert.equal(r.m.b.stateFor('peer-aaaa'), 'none', 'and the prompt goes with it');
  r = rig();
  r.P.b.can = 'outdoors';
  r.m.a.request('peer-bbbb'); r.pump();
  assert.equal(r.P.b.prompts, 0, 'a player indoors is never prompted');
  assert.equal(r.m.a.stateFor('peer-bbbb'), 'none');
  assert.deepEqual(r.log.b.at(-1), { to: 'peer-aaaa', k: 'cancel', s: r.log.a[0].s, why: 'outdoors' });
  r = rig({ nearAB: false });
  assert.equal(r.m.a.request('peer-bbbb').ok, false, 'no challenge from past DUEL_RANGE_M');
  r.P.a.near = true;
  r.m.a.request('peer-bbbb'); r.pump();
  assert.equal(r.log.b.at(-1).why, 'range', 'the challenged side measures too');
  r = rig();
  r.P.a.can = 'dead';
  assert.match(r.m.a.request('peer-bbbb').why, /fallen/);
  // a yes to an ask that lapsed on the challenger's side
  r = rig();
  r.m.a.request('peer-bbbb'); r.pump();
  r.P.b.sock = false;   // the answer cannot leave yet
  r.tick(DUEL_ASK_TTL_MS + 1);
  r.P.b.sock = true;
  r.m.b.onFrame('peer-aaaa', { k: 'ask', s: 'fresh12345', to: 'peer-bbbb' }, 'acct-aaaa');
  r.m.b.accept('peer-aaaa'); r.pump();
  assert.equal(r.m.a.live, null, 'the challenger never began on a yes to nothing');
  assert.equal(r.log.a.at(-1).k, 'cancel');
  assert.equal(r.m.b.stateFor('peer-aaaa'), 'none', 'and the accepter was told - no waiting on a start that never comes');
  for (const why of DUEL_WHY) assert.equal(typeof duelWhyText(why, 'Bran'), 'string');
});

test('DUEL1 a yes that never gets its start lapses in DUEL_START_WAIT_MS - the accepter is never left in limbo; crossed challenges become ONE duel (mutants: the wait unbounded; two duels)', () => {
  const r = rig();
  r.m.a.request('peer-bbbb'); r.pump();
  r.P.a.sock = false;   // the challenger's socket is away: its start cannot go
  r.m.b.accept('peer-aaaa'); r.pump();
  assert.equal(r.m.b.stateFor('peer-aaaa'), 'waiting');
  r.tick(DUEL_START_WAIT_MS + 1);
  assert.equal(r.m.b.stateFor('peer-aaaa'), 'none', 'the wait ran out');
  assert.equal(r.m.b.live, null);
  // crossed: both challenge at once
  const x = rig();
  x.m.a.request('peer-bbbb'); x.m.b.request('peer-aaaa');
  x.pump();
  assert.ok(x.m.a.live && x.m.b.live, 'one of the two asks was taken up');
  assert.equal(x.m.a.live.s, x.m.b.live.s, 'one duel');
});

test('DUEL1 THE COUNT, THEN THE BLOWS: nothing leaves or lands for DUEL_COUNTDOWN_MS; after it a blow leaves numbered, the defender resolves it and answers with a result for that number; only the live opponent\'s, this duel\'s, each number once, DUEL_BLOWS_PER_S a second (mutants: a blow in the count; a replay landing twice; a third player\'s blow landing; the budget gone)', () => {
  const r = rig();
  r.m.a.request('peer-bbbb'); r.pump(); r.m.b.accept('peer-aaaa'); r.pump();
  assert.equal(r.m.a.fighting, false, 'the count');
  assert.equal(r.m.a.blow('strike', { by: 'melee', p: r.P.a.pos, a: ATT }), 0, 'nothing leaves during the count');
  const s = r.m.b.live.s;
  r.m.b.onFrame('peer-aaaa', { k: 'strike', to: 'peer-bbbb', s, n: 1, by: 'melee', p: r.P.a.pos, a: ATT }, 'acct-aaaa');
  assert.equal(r.P.b.blows.length, 0, 'nor lands');
  r.tick(DUEL_COUNTDOWN_MS + 1);
  assert.equal(r.m.a.fighting, true);
  const n = r.m.a.blow('strike', { by: 'melee', p: r.P.a.pos, a: ATT });
  assert.equal(n, 1, 'the first blow is number one');
  r.pump();
  assert.equal(r.P.b.blows.length, 1, 'the defender resolved it');
  assert.deepEqual(r.P.a.results.map((x) => [x.n, x.hit, x.dmg]), [[1, 1, 7]], 'and answered for that number');
  // a replay of number one lands nothing
  r.m.b.onFrame('peer-aaaa', { k: 'strike', to: 'peer-bbbb', s, n: 1, by: 'melee', p: r.P.a.pos, a: ATT }, 'acct-aaaa');
  assert.equal(r.P.b.blows.length, 1, 'each number once');
  // a third player's blow, and another duel's
  r.m.b.onFrame('peer-cccc', { k: 'strike', to: 'peer-bbbb', s, n: 9, by: 'melee', p: r.P.a.pos, a: ATT }, 'acct-cccc');
  r.m.b.onFrame('peer-aaaa', { k: 'strike', to: 'peer-bbbb', s: 'another123', n: 9, by: 'melee', p: r.P.a.pos, a: ATT }, 'acct-aaaa');
  assert.equal(r.P.b.blows.length, 1, 'only the live opponent\'s, only this duel\'s');
  // the budget
  for (let k = 0; k < DUEL_BLOWS_PER_S + 3; k++) r.m.b.onFrame('peer-aaaa', { k: 'strike', to: 'peer-bbbb', s, n: 10 + k, by: 'melee', p: r.P.a.pos, a: ATT }, 'acct-aaaa');
  assert.equal(r.P.b.blows.length, 1 + DUEL_BLOWS_PER_S - 1, 'DUEL_BLOWS_PER_S a second (the first blow spent one)');
  // a result for a number never sent is nothing
  r.m.a.onFrame('peer-bbbb', { k: 'result', to: 'peer-aaaa', s, n: 99, hit: 1, dmg: 5, h: [70, 80] }, 'acct-bbbb');
  assert.equal(r.P.a.results.length, 1);
});

test('DUEL1 THE ENDS AND WHOM THEY NAME: the side whose health fell says `fell` and has LOST; the other has WON; a yield loses; the clock is a draw; each ends the duel on BOTH sides, and both are healed DUEL_HEAL_HOLD_MS later - never at once (mutants: the winner recorded as the loser; the loser unrecorded; the heal at once; the heal skipped on a draw)', () => {
  // fell
  let r = duelling();
  r.P.b.fell = true;   // B's host: this blow takes B to the floor
  r.m.a.blow('strike', { by: 'melee', p: r.P.a.pos, a: ATT });
  r.pump();
  assert.deepEqual(r.P.b.ends, [{ why: 'fell', won: false, lost: true, by: 'me' }], 'B fell: B lost');
  assert.deepEqual(r.P.a.ends, [{ why: 'fell', won: true, lost: false, by: 'them' }], 'A won');
  assert.equal(r.P.a.results.at(-1).h[0], 1, 'the result says the loser stands at 1');
  assert.equal(r.m.a.live, null, 'the duel is over on both sides');
  assert.ok(r.m.a.duel && r.m.b.duel, '...held for the heal');
  assert.equal(r.P.a.heals + r.P.b.heals, 0, 'the heal waits: the loser is seen to stand at 1 first');
  r.tick(DUEL_HEAL_HOLD_MS - 10);
  assert.equal(r.P.a.heals + r.P.b.heals, 0);
  r.tick(20);
  assert.deepEqual([r.P.a.heals, r.P.b.heals], [1, 1], 'both healed, once');
  assert.equal(r.m.a.duel, null);
  // a blow in the hold lands nothing
  // yield
  r = duelling();
  assert.deepEqual(r.m.a.yieldDuel(), { ok: true });
  r.pump();
  assert.deepEqual(r.P.a.ends[0], { why: 'yield', won: false, lost: true, by: 'me' });
  assert.deepEqual(r.P.b.ends[0], { why: 'yield', won: true, lost: false, by: 'them' });
  // the clock
  r = duelling();
  r.tick(DUEL_MAX_MS);
  assert.equal(r.P.a.ends[0].why, 'draw');
  assert.equal(r.P.a.ends[0].won || r.P.a.ends[0].lost || r.P.b.ends[0].won || r.P.b.ends[0].lost, false, 'a draw names nobody');
  r.tick(DUEL_HEAL_HOLD_MS);
  assert.deepEqual([r.P.a.heals, r.P.b.heals], [1, 1], 'a draw heals too - "both are fully healed on duel end"');
});

test('DUEL1 THE RING HOLDS, AND A DUEL IS OFF WHEN IT CANNOT: my body carried past the edge (a teleport - the clamp never lets one walk there), the opponent past it for DUEL_OUT_MS, the opponent unreachable for DUEL_GONE_MS, me indoors or fallen to something else - each ends it naming nobody (mutants: a carried-off duellist recorded as the loser; the opponent\'s stray frame ending it at once; a disconnect recorded)', () => {
  const past = (DUEL_RADIUS_M + DUEL_OUT_SLACK_M + 1) * NATIVES_PER_M;
  let r = duelling();
  r.P.a.pos = [r.m.a.live.c[0] + past, r.P.a.pos[1], r.m.a.live.c[2]];
  r.tick(1);
  assert.deepEqual(r.P.a.ends[0], { why: 'left', won: false, lost: false, by: 'me' });
  assert.equal(r.P.b.ends[0].why, 'left');
  assert.equal(r.P.b.ends[0].won, false, 'the opponent leaving is no win');
  // the opponent SEEN past the edge while their own machine says they are inside (a crafted client, a teleport the
  // other side has not noticed yet)
  r = duelling();
  r.P.a.seen = [r.m.a.live.c[0] + past, r.P.b.pos[1], r.m.a.live.c[2]];
  r.tick(1);   // first seen out
  r.tick(DUEL_OUT_MS - 100);
  assert.equal(r.P.a.ends.length, 0, 'a moment past the edge is a trailing pose, not a verdict');
  r.tick(200);
  assert.deepEqual(r.P.a.ends[0], { why: 'left', won: false, lost: false, by: 'them' });
  assert.equal(r.P.b.ends[0]?.why, 'left', 'and the opponent is told');
  // ...and a pose back inside before DUEL_OUT_MS clears the watch
  r = duelling();
  r.P.a.seen = [r.m.a.live.c[0] + past, r.P.b.pos[1], r.m.a.live.c[2]];
  r.tick(1);
  r.tick(DUEL_OUT_MS - 100);
  r.P.a.seen = null;
  r.tick(DUEL_OUT_MS);
  assert.equal(r.P.a.ends.length, 0, 'back inside: no verdict');
  // unreachable
  r = duelling();
  r.P.a.reaches = false;
  r.tick(1);   // first found unreachable
  r.tick(DUEL_GONE_MS - 100);
  assert.equal(r.P.a.ends.length, 0);
  r.tick(200);
  assert.deepEqual(r.P.a.ends[0], { why: 'left', won: false, lost: false, by: 'them' }, 'gone past DUEL_GONE_MS: off, and no record');
  // indoors, fallen
  r = duelling();
  r.P.a.can = 'outdoors';
  r.tick(1);
  assert.equal(r.P.a.ends[0].why, 'left');
  r = duelling();
  r.P.b.can = 'dead';
  r.tick(1);
  assert.equal(r.P.b.ends[0].why, 'dead');
  assert.equal(r.P.a.ends[0].why, 'dead');
  assert.equal(r.P.a.ends[0].won, false, 'falling to a wolf is no duel lost');
});

test('DUEL1 the ring\'s geometry: the centre is the midpoint of the two bodies on the ground at the lower height; the clamp keeps a body within the radius less its capsule, on the ground alone, and leaves one inside untouched; the world frame\'s natives are forty to the metre; the onlookers\' record is refused whole on any bad field (mutants: the clamp moving the height; a body inside moved; the radius not less the capsule; a record half-read)', () => {
  assert.deepEqual(ringCentre([0, 5, 0], [10, 3, 20]), [5, 3, 10]);
  assert.equal(ringCentre(null, [0, 0, 0]), null);
  assert.equal(clampToRing([1, 9, 1], [0, 0, 0], DUEL_RADIUS_M, 0.35), null, 'inside: untouched');
  const c = clampToRing([30, 9, 0], [0, 0, 0], DUEL_RADIUS_M, 0.35);
  assert.deepEqual(c.map((v) => +v.toFixed(6)), [DUEL_RADIUS_M - 0.35, 0]);
  assert.equal(groundDistance([0, 0, 0], [3, 100, 4]), 5, 'the ground distance ignores height');
  assert.equal(worldGroundMetres([0, 0, 0], [3 * NATIVES_PER_M, 0, 4 * NATIVES_PER_M]), 5);
  assert.ok(DUEL_RANGE_M / 2 < DUEL_RADIUS_M - 0.35, 'two bodies close enough to start stand well inside their ring');
  const rec = { s: 'abc12345', c: [100, 2, 300], p: 'peer-bbbb' };
  assert.deepEqual(validRingRecord(rec), rec);
  for (const bad of [null, [], { ...rec, s: 'x' }, { ...rec, p: '' }, { ...rec, c: [1, 2] }, { ...rec, c: [1, NaN, 3] }, { ...rec, c: [-1, 0, 0] }, { ...rec, c: [0, 2e5, 0] }]) {
    assert.equal(validRingRecord(bad), null, JSON.stringify(bad));
  }
});
