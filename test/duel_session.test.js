// DUEL1 (2026-09-24, Mac: "When inspecting a player, they should be able to send an invite to duel which then traps both
// players in a surrounding transparent holographic wall that keeps them from going outside of the duel space."; asked:
// weapons, bows and spells; "Loser drops to 1HP and both are fully healed on duel end"; outdoors only): THE DUEL'S LAW,
// DRIVEN. Two managers (net/duelSession.js) over a fake wire that projects every frame through the relay's own law
// (net/wire.js validDuelData) and stamps the sender's id and account as the relay does - the three-step handshake, every
// refusal, the count, the blows, every end and who it names, the hold, the ring's own geometry.
//
// INT8 (2026-10-09, bible/06-Systems/Integrity-Arc.md lane 2): AND THE WIRE CARRIES THE REFEREE. The relay holds the
// bout now (net/duelRef.js) - it sets it on the start it routes, judges every blow (routed to nobody), and ends it - so
// the fake wire runs the referee's own law between the two managers as the relay's duel arm does, and hands its words
// (`dref`) to each through `onRef`. PIN MOVED, each where it stands: the defender resolves nothing, a fall and a draw
// are the referee's, a fighter that leaves its bout loses it, and the record is the referee's receipt.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createDuelManager, clampToRing, ringCentre, groundDistance, validRingRecord, duelWhyText, duelLostText, duelWonText, worldGroundMetres,
  DUEL_RADIUS_M, DUEL_RANGE_M, DUEL_ASK_TTL_MS, DUEL_START_WAIT_MS, DUEL_COUNTDOWN_MS, DUEL_MAX_MS, DUEL_GONE_MS,
  DUEL_OUT_SLACK_M, DUEL_OUT_MS, DUEL_HEAL_HOLD_MS, NATIVES_PER_M, DUEL_REASK_MS, DUEL_REF_TEXT,
} from '../src/net/duelSession.js';
import { validDuelData, DUEL_WHY } from '../src/net/wire.js';
import { newDuelRef, duelNote, duelOpen, duelBlow, duelBoutOf, duelForfeit, duelStep, duelEnd, duelVitals, duelPose, DUEL_REF } from '../src/net/duelRef.js';
import { ROYAL_RING, SIEGE_HIT, siegeBlowMax, siegeVitality } from '../src/net/siegeRef.js';

const P0 = [100000, 10, 200000];   // a world-frame point: natives on x and z, metres on y
const RC = 'd1.receipt.sig';   // the referee's receipt, as the relay hands it (net/duelReceipt.js - its own pins)

/** Two players, A and B, and the wire between them - frames delivered in order on `pump()`, each through the relay's
 *  law and stamped with its sender's id and account, as the relay's duel arm does; INT8: and the referee between them,
 *  the relay's own law (net/duelRef.js), its words handed to each manager's onRef. */
function rig({ nearAB = true } = {}) {
  let t = 1_000_000;
  const now = () => t;
  const inbox = { a: [], b: [] };
  const words = { a: [], b: [] };
  const log = { a: [], b: [] };
  const P = {
    a: { id: 'peer-aaaa', sub: 'acct-aaaa', pos: [...P0], can: null, near: nearAB, reaches: true, here: true, hps: [], ends: [], heals: 0, prompts: 0, starts: 0, receipts: [], sock: true },
    b: { id: 'peer-bbbb', sub: 'acct-bbbb', pos: [P0[0] + 4 * NATIVES_PER_M, P0[1], P0[2]], can: null, near: nearAB, reaches: true, here: true, hps: [], ends: [], heals: 0, prompts: 0, starts: 0, receipts: [], sock: true },
  };
  const other = (k) => (k === 'a' ? 'b' : 'a');
  const keyOf = (sub) => (sub === P.a.sub ? 'a' : 'b');
  const ref = newDuelRef();
  const pose = (x) => ({ x: x.pos[0], y: x.pos[1], z: x.pos[2] });
  const say = (bout, word) => { for (const x of [bout.a, bout.b]) words[keyOf(x.sub)].push(typeof word === 'function' ? word(x) : word); };
  const close = (end, bout) => say(bout, { k: 'end', s: end.s, w: end.w == null ? '' : end.ids[end.w], why: end.why, ...(end.w != null ? { rc: RC } : {}) });
  const mk = (k) => {
    const me = P[k], them = P[other(k)];
    return createDuelManager({
      send: (d) => {
        if (!me.sock) return false;
        const v = validDuelData(d);
        if (!v) throw new Error(`the manager sent a frame the relay refuses: ${JSON.stringify(d)}`);
        log[k].push(v);
        // the relay's duel arm (server/src/index.js): the referee's first
        if (v.k === 'strike' || v.k === 'spell') {
          const bout = duelBoutOf(ref, me.sub);
          if (!bout) return true;
          const r = v.k === 'spell' ? SIEGE_HIT.Spell : v.by === 'arrow' ? SIEGE_HIT.Shaft : SIEGE_HIT.Melee;
          const res = duelBlow(ref, me.sub, v.to, { d: v.d, r, held: v.k === 'strike' ? { w: v.w ? v.w.t : -1, m: v.w ? v.w.m : 0 } : null }, t);
          if (res.ok && res.dealt) {
            say(bout, { k: 'hp', s: bout.s, by: me.id, to: v.to, d: res.dealt, r, h: duelVitals(bout) });
            if (res.fell) close(duelEnd(ref, bout, me.sub, 'fell'), bout);
          }
          return true;
        }
        if (v.k === 'end' || v.k === 'cancel') {
          const bout = duelBoutOf(ref, me.sub);
          if (bout && bout.s === v.s) { close(duelForfeit(ref, me.sub, v.why, t), bout); return true; }
        }
        if (d.to !== them.id) return true;   // a frame at nobody we model - it left
        if (v.k === 'ask' || v.k === 'yes') duelNote(ref, v.k, me.sub, them.sub, v.s, t);
        if (v.k === 'start') {
          const r = duelOpen(ref, { a: { sub: me.sub, id: me.id, pose: pose(me), lv: 10 }, b: { sub: them.sub, id: them.id, pose: pose(them), lv: 10 }, s: v.s, c: v.c, n: '0123456789ab' }, t);
          if (r.no) { words[k].push({ k: 'no', s: v.s, why: r.no }); return true; }
          inbox[other(k)].push({ from: me.id, sub: me.sub, d: v });
          say(r.bout, (x) => ({ k: 'bout', s: v.s, op: x === r.bout.a ? r.bout.b.id : r.bout.a.id, ms: ROYAL_RING.countdownMs, h: duelVitals(r.bout) }));
          return true;
        }
        inbox[other(k)].push({ from: me.id, sub: me.sub, d: v });
        return true;
      },
      now, say: () => {}, peerName: (id) => (id === them.id ? them.id.toUpperCase() : null), selfId: () => me.id,
      near: (id) => id === them.id && me.near, can: () => me.can,
      ringFor: (id) => (id === them.id ? ringCentre(me.pos, them.pos) : null),
      reaches: (id) => id === them.id && me.reaches,
      myPos: () => me.pos, peerPos: (id) => (id === them.id ? (me.seen ?? them.pos) : null),   // `seen`: where MY machine places them, when that is not where they place themselves
      onPrompt: () => { me.prompts++; },
      onStart: () => { me.starts++; },
      onHp: (g) => { me.hps.push(g); },
      onEnd: (duel, end) => { me.ends.push(end); },
      onReceipt: (rc) => { me.receipts.push(rc); },
      onHeal: () => { me.heals++; },
      rand: () => 0.123456789,
    });
  };
  const m = { a: mk('a'), b: mk('b') };
  const pump = () => {
    let n = 0;
    while (inbox.a.length || inbox.b.length || words.a.length || words.b.length) {
      for (const k of ['a', 'b']) {
        for (const f of inbox[k].splice(0)) { m[k].onFrame(f.from, f.d, f.sub); n++; }
        for (const g of words[k].splice(0)) { m[k].onRef(g); n++; }
      }
      if (n > 500) throw new Error('the wire never settled');
    }
  };
  /** The referee's beat, as the relay's frames drive it: a bout's clock, a fighter gone from the room, out of the ring. */
  const beat = () => {
    for (const x of ['a', 'b']) duelPose(ref, P[x].sub, pose(P[x]), t);   // AUDIT INT8 (the pins' own): the referee's own pose law, never a copy of it
    const bouts = new Map(ref.bouts);
    for (const end of duelStep(ref, (sub) => P[keyOf(sub)].here, t)) close(end, bouts.get(end.s));
  };
  return { m, P, ref, pump, log, tick: (ms) => { t += ms; m.a.tick(); m.b.tick(); pump(); beat(); pump(); }, now };
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

test('DUEL1 the handshake is THREE steps - ask, yes, start - and nobody stands in a ring the other side never confirmed: the challenged player is prompted, their yes waits on the start, and both begin on ONE ring with ONE id; INT8: the referee sets the bout on that start, both whole (mutants: the accepter begins on its own yes; the start never sent; two rings; a start routed with no bout)', () => {
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
  // INT8: the referee's bout, both whole at its vitality
  const whole = siegeVitality(10);
  assert.deepEqual(r.m.a.live.h, [['peer-aaaa', whole, whole], ['peer-bbbb', whole, whole]]);
  assert.deepEqual(r.m.b.live.h, r.m.a.live.h);
  // a start the referee never saw asked and answered sets no bout, and begins nobody
  const x = rig();
  x.m.a.onFrame('peer-bbbb', { k: 'yes', to: 'peer-aaaa', s: 'unseen1234' }, 'acct-bbbb');
  assert.equal(x.m.a.live, null, 'a yes to no ask of mine starts nothing');
  const y = rig();
  y.m.a.request('peer-bbbb'); y.pump();
  y.ref.yes.clear();   // the relay never saw the yes go by (it went another way)
  y.ref.asks.clear();
  y.m.b.accept('peer-aaaa'); y.ref.yes.clear(); y.pump();
  assert.equal(y.m.b.live, null, 'the start the referee set no bout on was routed to nobody');
  assert.equal(y.m.a.live, null, 'and its challenger, told `no`, is out of the ring');
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
  // AUDIT DUEL1 D1: past the lapse's own quiet, so B takes the ask up (inside it B answers no, and no yes ever goes)
  r.tick(DUEL_REASK_MS + 1);
  r.m.b.onFrame('peer-aaaa', { k: 'ask', s: 'fresh12345', to: 'peer-bbbb' }, 'acct-aaaa');
  assert.equal(r.m.b.stateFor('peer-aaaa'), 'incoming');
  assert.equal(r.m.b.accept('peer-aaaa').ok, true);
  r.pump();
  assert.deepEqual(r.log.b.at(-1), { k: 'yes', to: 'peer-aaaa', s: 'fresh12345' }, 'the yes went');
  assert.equal(r.m.a.live, null, 'the challenger never began on a yes to nothing');
  assert.deepEqual(r.log.a.at(-1), { k: 'cancel', to: 'peer-bbbb', s: 'fresh12345', why: 'timeout' }, 'the challenger answered it: off');
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

test('DUEL1 THE COUNT, THEN THE BLOWS: nothing leaves or lands for DUEL_COUNTDOWN_MS; after it a blow leaves numbered with the number its striker rolled - INT8: and THE REFEREE judges it, clipped to its weapon\'s bucket, both fighters told what landed and what is left; routed to nobody, so the defender resolves nothing (mutants: a blow in the count; a blow routed to the defender; the clip unread)', () => {
  // PIN MOVED (INT8): the defender resolved the blow on its own sheet and answered with a `result` for its number; each
  // number once and DUEL_BLOWS_PER_S a second were the DEFENDER's law. The referee's own pins hold the rate, the reach
  // and the clip (net/siegeRef.js refereeBlow - test/pvpref_law.test.js); here, that a blow is the referee's alone.
  const r = rig();
  r.m.a.request('peer-bbbb'); r.pump(); r.m.b.accept('peer-aaaa'); r.pump();
  assert.equal(r.m.a.fighting, false, 'the count');
  assert.equal(r.m.a.blow('strike', { by: 'melee', p: r.P.a.pos, d: 50 }), 0, 'nothing leaves during the count');
  r.tick(DUEL_COUNTDOWN_MS + 1);
  assert.equal(r.m.a.fighting, true);
  const n = r.m.a.blow('strike', { by: 'melee', p: r.P.a.pos, d: 999 });
  assert.equal(n, 1, 'the first blow is number one');
  r.pump();
  const whole = siegeVitality(10), cap = siegeBlowMax(-1, 0);
  for (const k of ['a', 'b']) assert.deepEqual(r.P[k].hps.map((g) => [g.by, g.to, g.d, g.h[1][1]]), [['peer-aaaa', 'peer-bbbb', cap, whole - cap]], `${k} hears what landed, clipped`);
  assert.equal(r.log.b.filter((f) => f.k === 'result').length, 0, 'the defender answered nothing');
  assert.deepEqual(r.m.b.live.h[1], ['peer-bbbb', whole - cap, whole], 'the bout\'s vitality on both sides');
  // a spell: the referee's cast, to its most
  r.tick(1000);
  r.m.b.blow('spell', { p: r.P.b.pos, d: 999 });
  r.pump();
  assert.deepEqual(r.P.a.hps.at(-1).d, 60, 'a cast to sixty');
  assert.equal(r.P.a.hps.at(-1).r, SIEGE_HIT.Spell);
});

test('DUEL1 THE ENDS AND WHOM THEY NAME - INT8: THE REFEREE\'S. A fall at the referee\'s vitality loses; the other wins; a yield loses; the clock is a draw; each ends the duel on BOTH sides, and a bout won hands BOTH fighters the referee\'s receipt (mutants: the winner named the loser; the receipt kept from the loser; a draw minting one; my own word of a fall believed)', () => {
  // PIN MOVED (INT8): a fall was the defender's own (`end fell` at 1 health) and the loser reported it; both were healed
  // DUEL_HEAL_HOLD_MS after. A fall is the referee's vitality at none, the record its receipt, and the hold lets the
  // ended duel go with no heal - a duel never touches the save's health now.
  let r = duelling();
  for (let i = 0; i < 10 && r.m.a.live; i++) { r.m.a.blow('strike', { by: 'melee', p: r.P.a.pos, d: 999 }); r.pump(); r.tick(300); }
  assert.deepEqual(r.P.b.ends, [{ why: 'fell', won: false, lost: true, by: 'me' }], 'B fell: B lost');
  assert.deepEqual(r.P.a.ends, [{ why: 'fell', won: true, lost: false, by: 'them' }], 'A won');
  assert.deepEqual([r.P.a.receipts, r.P.b.receipts], [[RC], [RC]], 'the receipt, to both: either carries it');
  assert.equal(r.m.a.live, null, 'the duel is over on both sides');
  assert.ok(r.m.a.duel && r.m.b.duel, '...held a moment');
  r.tick(DUEL_HEAL_HOLD_MS + 10);
  assert.equal(r.m.a.duel, null, 'and let go');
  // my own word that I fell is nobody's: the referee holds the bout
  r = duelling();
  r.m.b.onFrame('peer-aaaa', { k: 'end', to: 'peer-bbbb', s: r.m.b.live.s, why: 'fell' }, 'acct-aaaa');
  assert.notEqual(r.P.b.ends[0]?.won, true, 'a peer\'s word of its own fall names no winner');
  // yield
  r = duelling();
  assert.deepEqual(r.m.a.yieldDuel(), { ok: true });
  r.pump();
  assert.deepEqual(r.P.a.ends[0], { why: 'yield', won: false, lost: true, by: 'me' });
  assert.deepEqual(r.P.b.ends[0], { why: 'yield', won: true, lost: false, by: 'them' });
  assert.deepEqual(r.P.b.receipts, [RC], 'the yield won is the winner\'s receipt too');
  // the clock: the referee's draw
  r = duelling();
  r.tick(DUEL_MAX_MS);
  assert.equal(r.P.a.ends[0].why, 'draw');
  assert.equal(r.P.a.ends[0].won || r.P.a.ends[0].lost || r.P.b.ends[0].won || r.P.b.ends[0].lost, false, 'a draw names nobody');
  assert.deepEqual([r.P.a.receipts, r.P.b.receipts], [[], []], 'and mints nothing');
  for (const why of ['fell', 'yield', 'left']) { assert.equal(typeof duelLostText(why, 'Bran'), 'string'); assert.equal(typeof duelWonText(why, 'Bran'), 'string'); }
});

test('DUEL1 THE RING HOLDS - INT8: AND LEAVING IT LOSES. My body carried past the edge, me indoors or fallen to something else: my own word to the referee, and my LOSS once the count has run (a cancel before it); the opponent past the edge DUEL_OUT_MS, or gone from the room ROYAL_RING.goneMs: the referee\'s, and my win (mutants: a fighter running from a loss unrecorded; the opponent\'s stray pose ending it at once; a disconnect free)', () => {
  // PIN MOVED (INT8): each of these ended the duel naming nobody - so a fighter about to fall walked indoors, or out of
  // the ring, or closed the tab, and lost nothing. The referee names the one that left the loser.
  const past = (DUEL_RADIUS_M + DUEL_OUT_SLACK_M + 1) * NATIVES_PER_M;
  let r = duelling();
  r.P.a.pos = [r.m.a.live.c[0] + past, r.P.a.pos[1], r.m.a.live.c[2]];
  r.tick(1);
  assert.deepEqual(r.P.a.ends[0], { why: 'left', won: false, lost: true, by: 'me' });
  assert.deepEqual(r.P.b.ends[0], { why: 'left', won: true, lost: false, by: 'them' }, 'the opponent leaving is a win');
  // the opponent's machine places them inside; the referee sees them out DUEL_OUT_MS (the room's poses are its)
  r = duelling();
  r.P.b.pos = [r.m.a.live.c[0] + past, r.P.b.pos[1], r.m.a.live.c[2]];
  r.P.b.can = null;
  r.m.b.tick = () => {};   // B's own machine says nothing of it (a crafted client)
  r.tick(1);
  r.tick(DUEL_REF.outMs - 100);
  assert.equal(r.P.a.ends.length, 0, 'a moment past the edge is a trailing pose, not a verdict');
  r.tick(200);
  assert.deepEqual(r.P.a.ends[0], { why: 'left', won: true, lost: false, by: 'them' });
  // AUDIT INT8 (the pins' own): another bout's word on my duel is nothing - a third player's blow lands on no bar of mine
  r = duelling();
  const hps = r.P.a.hps.length, h = JSON.stringify(r.m.a.live?.h ?? null);
  r.m.a.onRef({ k: 'hp', s: 'zzzzzzzzzz', by: 'peer-cccc', to: r.P.a.id, d: 50, r: 0, h: [['peer-cccc', 320, 320], [r.P.a.id, 270, 320]] });
  assert.deepEqual([r.P.a.hps.length, JSON.stringify(r.m.a.live?.h ?? null)], [hps, h], 'another bout\'s blow: nothing');
  // gone from the room: a walkover
  r = duelling();
  r.P.b.here = false;
  r.tick(1);
  r.tick(ROYAL_RING.goneMs - 100);
  assert.equal(r.P.a.ends.length, 0);
  r.tick(200);
  assert.deepEqual(r.P.a.ends[0], { why: 'left', won: true, lost: false, by: 'them' }, 'gone past ROYAL_RING.goneMs: a walkover');
  assert.deepEqual(r.P.a.receipts, [RC]);
  // indoors, fallen
  r = duelling();
  r.P.a.can = 'outdoors';
  r.tick(1);
  assert.deepEqual(r.P.a.ends[0], { why: 'left', won: false, lost: true, by: 'me' });
  assert.equal(r.P.b.ends[0].won, true);
  r = duelling();
  r.P.b.can = 'dead';
  r.tick(1);
  assert.equal(r.P.b.ends[0].lost, true, 'fallen to a wolf mid-bout: the bout lost');
  assert.equal(r.P.a.ends[0].won, true);
  // before the count has run: a cancel, naming nobody
  r = rig();
  r.m.a.request('peer-bbbb'); r.pump(); r.m.b.accept('peer-aaaa'); r.pump();
  r.P.a.can = 'outdoors';
  r.tick(1);
  assert.deepEqual([r.P.a.ends[0].lost, r.P.b.ends[0].won], [false, false], 'a cancel in the count');
  assert.equal(DUEL_GONE_MS, ROYAL_RING.goneMs, 'one window, the client\'s and the referee\'s');
  assert.equal(DUEL_OUT_MS, DUEL_REF.outMs);
  assert.equal(typeof DUEL_REF_TEXT.refused, 'string');
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
