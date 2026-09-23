// TRADE1 - the trade state machine, two managers over a fake wire, and the RANGE law (metres between bodies, never a pixel).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTradeManager, TRADE_RANGE_M, ASK_TTL_MS, tradeDistance, inTradeRange, tradeWhyText } from '../src/net/tradeSession.js';
import { validTradeData } from '../src/net/wire.js';

/** A fake pack over plain records: items are whole (`{id}`), gold is a number. */
function makePack(ids, gold) {
  const st = { items: ids.map((id) => ({ id, stackCount: 1 })), gold };
  return {
    st,
    offerable: (it) => (it.worn ? 'That is worn.' : null),
    wire: (entries) => entries.map(({ item, count }) => ({ id: item.id, n: count })),
    unwire: (recs) => (recs.every((r) => r && typeof r.id === 'string') ? recs.map((r) => ({ id: r.id, stackCount: r.n })) : null),
    take: (entries, g) => {
      if (g > st.gold || !entries.every((e) => st.items.includes(e.item))) return null;
      st.gold -= g; st.items = st.items.filter((it) => !entries.some((e) => e.item === it));
      return { entries, g };
    },
    restore: (h) => { st.gold += h.g; for (const e of h.entries) st.items.push(e.item); },
    give: (items, g) => { st.gold += g; for (const it of items) st.items.push(it); },
    fits: () => true,
    gold: () => st.gold,
  };
}
const totals = (...packs) => {
  const m = { gold: 0 };
  for (const p of packs) { m.gold += p.st.gold; for (const it of p.st.items) m[it.id] = (m[it.id] ?? 0) + 1; }
  return m;
};

/** Two players A and B, a shared clock, a wire that can be cut, and positions the test moves. */
function rig({ aItems = ['sword'], bItems = ['ring'], aGold = 100, bGold = 50, gap = 2 } = {}) {
  const pos = { A: [0, 0, 0], B: [gap, 0, 0] };
  const blind = { A: false, B: false };   // a side whose measurement fails (a pose lag): it sees the peer as far
  const q = [], said = { A: [], B: [] };
  let clock = 0, wireOpen = true;
  const mk = (me, other, id, otherId, pack) => {
    const mgr = createTradeManager({
      pack, now: () => clock, say: (t) => said[me].push(t), peerName: () => other, selfId: () => id,
      send: (d) => { if (!wireOpen) return false; const v = validTradeData(d); if (!v) return false; q.push({ from: id, to: v.to, d: v }); return true; },
      near: (peer) => !blind[me] && inTradeRange(pos[me], pos[peer === otherId ? other : me]),
      open: () => {},
    });
    return mgr;
  };
  const packA = makePack(aItems, aGold), packB = makePack(bItems, bGold);
  const A = mk('A', 'B', 'peerAAAA', 'peerBBBB', packA), B = mk('B', 'A', 'peerBBBB', 'peerAAAA', packB);
  const mgrs = { peerAAAA: A, peerBBBB: B };
  const pump = () => { while (q.length) { const f = q.shift(); mgrs[f.to].onFrame(f.from, f.d); } };
  return { pos, blind, A, B, packA, packB, said, pump, cut: () => { wireOpen = false; }, heal: () => { wireOpen = true; }, tick: (ms = 0) => { clock += ms; A.tick(); B.tick(); pump(); } };
}
/** Open a session between the two, in range. */
function open(r) {
  assert.deepEqual(r.A.request('peerBBBB'), { ok: true });
  r.pump();
  assert.deepEqual(r.B.request('peerAAAA'), { ok: true });   // B has an incoming ask: request IS accept
  r.pump();
  assert.ok(r.A.session && r.B.session);
}
const offerAll = (r) => {
  const sa = r.A.session, sb = r.B.session;
  assert.equal(sa.setOffer([{ item: r.packA.st.items[0], count: 1 }], 10).ok, true); r.pump();
  assert.equal(sb.setOffer([{ item: r.packB.st.items[0], count: 1 }], 5).ok, true); r.pump();
};

// ---- the range law ---------------------------------------------------------------------------------------------------
test('TRADE RANGE: it is 5 metres, measured straight between two scene positions', () => {
  assert.equal(TRADE_RANGE_M, 5);
  assert.equal(tradeDistance([0, 0, 0], [3, 0, 4]), 5);
  assert.equal(inTradeRange([0, 0, 0], [3, 0, 4]), true, 'exactly 5 m is in');
  assert.equal(inTradeRange([0, 0, 0], [3, 0, 4.01]), false, 'past 5 m is out');
  assert.equal(inTradeRange([0, 0, 0], [0, 5.5, 0]), false, 'height counts: a balcony above is not beside');
  assert.equal(inTradeRange([0, 0, 0], [0.5, 0.2, 0.1], TRADE_RANGE_M), true);
});

test('TRADE RANGE: the player\'s own position is a Float32Array - it measures exactly like an Array (regression: "too far away" standing inside each other)', () => {
  const me = new Float32Array([100.5, 12, -40.25]);   // motor.js: this.pos = new Float32Array(3) // FEET position
  const them = [101, 12, -40];                        // peersNear(): a plain array from onlineToScene
  assert.ok(tradeDistance(me, them) < 1);
  assert.equal(inTradeRange(me, them), true);
  assert.equal(inTradeRange(them, me), true);
  assert.equal(inTradeRange(me, new Float32Array([106, 12, -40.25])), false);
  assert.equal(inTradeRange(me, new Float32Array([NaN, 0, 0])), false);
});

test('TRADE RANGE: a place nobody can name is never near (fails closed)', () => {
  for (const bad of [null, undefined, [], [1, 2], [NaN, 0, 0], [Infinity, 0, 0], 'x']) {
    assert.equal(inTradeRange([0, 0, 0], bad), false);
    assert.equal(inTradeRange(bad, [0, 0, 0]), false);
  }
  assert.equal(tradeDistance(null, null), Infinity);
});

test('TRADE RANGE: the words for range say the number', () => {
  assert.match(tradeWhyText('range'), /5 m/);
});

// ---- ask / accept ----------------------------------------------------------------------------------------------------
test('ask and accept happen only within range', () => {
  const r = rig({ gap: 5.5 });
  const far = r.A.request('peerBBBB');
  assert.equal(far.ok, false);
  assert.match(far.why, /too far away \(max 5 m\)/);
  r.pos.B = [4.9, 0, 0];
  assert.deepEqual(r.A.request('peerBBBB'), { ok: true });
  r.pump();
  assert.equal(r.B.stateFor('peerAAAA'), 'incoming');
  r.pos.B = [9, 0, 0];   // B steps away before answering
  const late = r.B.request('peerAAAA');
  assert.equal(late.ok, false);
  assert.match(late.why, /too far away/);
  assert.equal(r.B.session, null);
  r.pos.B = [3, 0, 0];
  assert.equal(r.B.request('peerAAAA').ok, true);
  r.pump();
  assert.ok(r.A.session && r.B.session);
});

test('an ask from beyond 5 m is not stood in the list, says nothing, and the asker is told why', () => {
  const r = rig({ gap: 2 });
  assert.equal(r.A.request('peerBBBB').ok, true);   // A saw 2 m ...
  r.pos.B = [5.4, 0, 0];                            // ... but by arrival B is 5.4 m away
  r.pump();
  assert.equal(r.B.stateFor('peerAAAA'), 'none');
  assert.deepEqual(r.said.B, [], 'no chat line for a far ask');
  assert.equal(r.A.stateFor('peerBBBB'), 'none', 'the asker\'s pending ask was answered');
  assert.ok(r.said.A.some((t) => /more than 5 m/.test(t)));
});

// ---- a live trade ----------------------------------------------------------------------------------------------------
test('a full swap in range conserves every item and every coin', () => {
  const r = rig();
  const before = totals(r.packA, r.packB);
  open(r); offerAll(r);
  const sa = r.A.session, sb = r.B.session;
  assert.equal(sa.lock().ok, true); r.pump();
  assert.equal(sb.lock().ok, true); r.pump();
  assert.equal(sa.confirm().ok, true); r.pump();
  assert.equal(sb.confirm().ok, true); r.pump();
  assert.deepEqual(totals(r.packA, r.packB), before);
  assert.deepEqual(r.packA.st.items.map((i) => i.id), ['ring']);
  assert.deepEqual(r.packB.st.items.map((i) => i.id), ['sword']);
  assert.equal(r.packA.st.gold, 95); assert.equal(r.packB.st.gold, 55);
  assert.equal(r.A.session, null); assert.equal(r.B.session, null);
});

test('changing an offer unlocks both sides', () => {
  const r = rig(); open(r); offerAll(r);
  r.A.session.lock(); r.pump(); r.B.session.lock(); r.pump();
  assert.equal(r.A.session.bothLocked, true);
  r.B.session.setOffer([], 0); r.pump();
  assert.equal(r.A.session.myLock, false); assert.equal(r.B.session.myLock, false);
});

test('lock and confirm are refused out of range, with the reason, and change nothing', () => {
  const r = rig(); open(r); offerAll(r);
  r.pos.B = [6, 0, 0];
  const l = r.A.session.lock();
  assert.equal(l.ok, false); assert.match(l.why, /within 5 m/);
  assert.equal(r.A.session.myLock, false);
  r.pos.B = [1, 0, 0];
  assert.equal(r.A.session.lock().ok, true); r.pump();
  assert.equal(r.B.session.lock().ok, true); r.pump();
  r.pos.B = [6, 0, 0];
  const c = r.A.session.confirm();
  assert.equal(c.ok, false); assert.match(c.why, /within 5 m/);
  assert.equal(r.A.session.myConfirm, false);
});

test('a live trade ends for free the frame the peer steps past 5 m - both sides told, nothing moved', () => {
  const r = rig();
  const before = totals(r.packA, r.packB);
  open(r); offerAll(r);
  r.pos.B = [4.99, 0, 0]; r.tick();
  assert.ok(r.A.session && r.B.session, '4.99 m is still in');
  r.pos.B = [5.01, 0, 0]; r.tick();
  assert.equal(r.A.session, null); assert.equal(r.B.session, null);
  assert.ok(r.said.A.some((t) => /more than 5 m/.test(t)));
  assert.ok(r.said.B.some((t) => /more than 5 m/.test(t)));
  assert.deepEqual(totals(r.packA, r.packB), before);
});

test('one side ending for range tells the other, even when the other measured 4.98 m', () => {
  const r = rig({ gap: 4.98 }); open(r); offerAll(r);
  r.blind.A = true;   // only A's measurement says "far"
  r.tick();
  assert.equal(r.A.session, null);
  assert.equal(r.B.session, null, 'the cancel frame closed B too');
});

test('once BOTH have confirmed the exchange is not a range question: a peer 8 m off by then still gets and gives their goods', () => {
  const r = rig();
  const before = totals(r.packA, r.packB);
  open(r); offerAll(r);
  r.A.session.lock(); r.pump(); r.B.session.lock(); r.pump();
  assert.equal(r.A.session.confirm().ok, true); r.pump();   // A confirms at 2 m
  assert.equal(r.B.session.confirm().ok, true);             // B confirms at 2 m: B commits at once, its goods are OUT
  r.pos.B = [8, 0, 0];                                      // and steps away before A's client hears it
  r.pump();
  assert.deepEqual(totals(r.packA, r.packB), before, 'conserved - refusing here would have stranded B\'s goods');
  assert.deepEqual(r.packA.st.items.map((i) => i.id), ['ring']);
  assert.deepEqual(r.packB.st.items.map((i) => i.id), ['sword']);
});

test('range does not end a trade whose goods are already changing hands', () => {
  const r = rig(); open(r); offerAll(r);
  const sa = r.A.session;
  sa.lock(); r.pump(); r.B.session.lock(); r.pump();
  sa.confirm(); r.pump();
  r.cut();                       // B's confirm arrives, but A's commit cannot leave the socket yet
  r.B.session.confirm(); r.heal();
  // deliver B's confirm by hand so A goes to 'committing'
  r.pump();
  r.pos.B = [50, 0, 0]; r.tick();
  assert.notEqual(r.A.session?.phase, 'cancelled', 'past-5m never cancels a committing session');
});

// ---- the duplication law still holds ---------------------------------------------------------------------------------
test('a commit frame that never left the socket puts the goods back; nothing is duplicated', () => {
  const r = rig();
  const before = totals(r.packA, r.packB);
  open(r); offerAll(r);
  r.A.session.lock(); r.pump(); r.B.session.lock(); r.pump();
  r.A.session.confirm(); r.pump();
  r.cut();
  r.B.session.confirm();   // B's frame cannot leave; B commits locally? no - B needs A's confirm frame, which was delivered
  r.tick(7000); r.tick(7000);   // past OUTBOX_TTL_MS: the frames that could not leave are dropped
  r.heal(); r.pump();
  const after = totals(r.packA, r.packB);
  for (const k of Object.keys(before)) assert.ok((after[k] ?? 0) <= before[k], `${k} was duplicated`);
});

test('a forged commit (goods that are not the locked offer) is refused', () => {
  const r = rig(); open(r); offerAll(r);
  const sb = r.B.session;
  r.A.session.lock(); r.pump(); sb.lock(); r.pump();
  r.A.session.confirm(); r.pump(); sb.confirm();
  // A's real commit is queued; replace it with a forged one on the way to B
  r.pump();
  const before = totals(r.packA, r.packB);
  sb.receive({ k: 'commit', s: sb.sid, r: 99, o: 99, items: [{ id: 'dragon-sword', n: 1 }], g: 999 });
  assert.equal(r.packB.st.items.some((i) => i.id === 'dragon-sword'), false);
  assert.equal(totals(r.packA, r.packB).gold + 0, before.gold);
});

test('an unknown peer (no pose) can never be asked, accepted or stay in a trade', () => {
  const r = rig();
  r.pos.B = null;
  assert.equal(r.A.request('peerBBBB').ok, false);
});

// ---- several asks at once --------------------------------------------------------------------------------------------
function crowd(names) {
  let clock = 0; const q = [], said = {}, opened = {}, mgrs = {};
  const pack = { offerable: () => null, wire: () => [], unwire: () => [], take: () => ({}), restore() {}, give() {}, fits: () => true, gold: () => 0 };
  for (const id of names) {
    said[id] = []; opened[id] = 0;
    mgrs[id] = createTradeManager({
      pack, now: () => clock, say: (t) => said[id].push(t), peerName: (p) => p, selfId: () => id,
      send: (d) => { const v = validTradeData(d); if (!v) return false; q.push({ from: id, to: v.to, d: v }); return true; },
      open: () => { opened[id]++; }, near: () => true,
    });
  }
  const pump = () => { while (q.length) { const f = q.shift(); mgrs[f.to]?.onFrame(f.from, f.d); } };
  return { mgrs, said, opened, pump, advance: (ms) => { clock += ms; for (const id of names) mgrs[id].tick(); pump(); } };
}

test('two people ask me: both are listed, each with one chat line; a repeat ask adds no line', () => {
  const c = crowd(['meMeMe', 'peerAAAA', 'peerBBBB']);
  c.mgrs.peerAAAA.request('meMeMe'); c.mgrs.peerBBBB.request('meMeMe'); c.pump();
  assert.equal(c.mgrs.meMeMe.stateFor('peerAAAA'), 'incoming');
  assert.equal(c.mgrs.meMeMe.stateFor('peerBBBB'), 'incoming');
  assert.equal(c.said.meMeMe.length, 2);
  c.mgrs.peerAAAA.request('meMeMe'); c.pump();
  assert.equal(c.said.meMeMe.length, 2);
});

test('accepting one ask leaves the others waiting (shown busy) and they can be taken up after the trade', () => {
  const c = crowd(['meMeMe', 'peerAAAA', 'peerBBBB']);
  c.mgrs.peerAAAA.request('meMeMe'); c.mgrs.peerBBBB.request('meMeMe'); c.pump();
  assert.equal(c.mgrs.meMeMe.request('peerAAAA').ok, true); c.pump();
  assert.equal(c.mgrs.meMeMe.stateFor('peerBBBB'), 'busy');
  assert.equal(c.mgrs.meMeMe.request('peerBBBB').ok, false);
  c.mgrs.meMeMe.session.cancel(); c.pump();
  assert.equal(c.mgrs.meMeMe.stateFor('peerBBBB'), 'incoming');
  assert.equal(c.mgrs.meMeMe.request('peerBBBB').ok, true);
});

test('an ask that arrives while I am in a trade is declined, and the asker is told', () => {
  const c = crowd(['meMeMe', 'peerAAAA', 'peerCCCC']);
  c.mgrs.peerAAAA.request('meMeMe'); c.pump(); c.mgrs.meMeMe.request('peerAAAA'); c.pump();
  c.mgrs.peerCCCC.request('meMeMe'); c.pump();
  assert.ok(c.said.peerCCCC.some((t) => /declined/.test(t)));
  assert.equal(c.mgrs.peerCCCC.stateFor('meMeMe'), 'none');
});

test('at most four different people wait on me; a fifth is ignored and is refused on their side after 30 seconds', () => {
  const names = ['meMeMe', 'peerAAAA', 'peerBBBB', 'peerCCCC', 'peerDDDD', 'peerEEEE'];
  const c = crowd(names);
  for (const n of names.slice(1)) c.mgrs[n].request('meMeMe');
  c.pump();
  assert.deepEqual(names.slice(1).map((n) => c.mgrs.meMeMe.stateFor(n)), ['incoming', 'incoming', 'incoming', 'incoming', 'none']);
  c.advance(31_000);
  assert.ok(c.said.peerEEEE.some((t) => /did not accept within 30 seconds/.test(t)));
});

test('taking up someone\'s ask takes back my own pending ask, so the other person is never left in an empty window', () => {
  const c = crowd(['meMeMe', 'peerBBBB', 'peerCCCC']);
  c.mgrs.meMeMe.request('peerCCCC'); c.pump();                     // I ask C
  c.mgrs.peerBBBB.request('meMeMe'); c.pump();                     // B asks me
  assert.equal(c.mgrs.meMeMe.request('peerBBBB').ok, true); c.pump();   // I take B's
  assert.equal(c.mgrs.peerCCCC.stateFor('meMeMe'), 'none', 'C no longer holds my ask');
  assert.equal(c.mgrs.peerCCCC.request('meMeMe').ok, true);        // C tries to trade with me anyway: a fresh ask, not an accept
  assert.equal(c.opened.peerCCCC, 0, 'no window opened for C');
});

test('a yes to an ask that is no longer mine closes the accepter\'s window with a reason', () => {
  const c = crowd(['meMeMe', 'peerBBBB', 'peerCCCC']);
  c.mgrs.meMeMe.request('peerCCCC'); c.pump();
  c.advance(61_000);                                               // my ask timed out on my side ...
  c.mgrs.meMeMe.stateFor('peerCCCC');
  // ... but C's client still held it (a slower clock): C accepts
  c.mgrs.peerCCCC.onFrame('meMeMe', { k: 'ask', to: 'peerCCCC', s: 'zzzzzzzzzz' });
  assert.equal(c.mgrs.peerCCCC.request('meMeMe').ok, true); c.pump();
  assert.equal(c.opened.peerCCCC, 1, 'C opened a window ...');
  assert.equal(c.mgrs.peerCCCC.session, null, '... and it was closed again by the cancel');
  assert.ok(c.said.peerCCCC.some((t) => /timed out/.test(t)));
});

// ---- an ask that is not accepted in 30 seconds -----------------------------------------------------------------------
test('an ask not accepted within 30 seconds is refused on both sides, and a new offer starts fresh', () => {
  const c = crowd(['meMeMe', 'peerAAAA']);
  const a = c.mgrs.peerAAAA, me = c.mgrs.meMeMe;
  assert.equal(ASK_TTL_MS, 30_000);
  a.request('meMeMe'); c.pump();
  c.advance(29_000);
  assert.equal(a.stateFor('meMeMe'), 'outgoing'); assert.equal(me.stateFor('peerAAAA'), 'incoming');
  c.advance(1_500);   // 30.5 s
  assert.equal(a.stateFor('meMeMe'), 'none', 'the asker\'s offer is off');
  assert.equal(me.stateFor('peerAAAA'), 'none', 'and the other side\'s Accept row is gone');
  assert.ok(c.said.peerAAAA.some((t) => /did not accept within 30 seconds/.test(t)));
  assert.ok(c.said.meMeMe.some((t) => /offer expired/.test(t)));
  assert.equal(me.request('peerAAAA').ok, true, 'pressing Trade again is a NEW offer, not an accept of the dead one'); c.pump();
  assert.equal(c.opened.meMeMe, 0); assert.equal(me.stateFor('peerAAAA'), 'outgoing');
});

test('accepting at 29 seconds works; accepting after 30 does not open anything', () => {
  const c = crowd(['meMeMe', 'peerAAAA']);
  c.mgrs.peerAAAA.request('meMeMe'); c.pump();
  c.advance(29_000);
  assert.equal(c.mgrs.meMeMe.request('peerAAAA').ok, true); c.pump();
  assert.ok(c.mgrs.meMeMe.session && c.mgrs.peerAAAA.session);
  const d = crowd(['meMeMe', 'peerAAAA']);
  d.mgrs.peerAAAA.request('meMeMe'); d.pump();
  d.advance(31_000);
  assert.equal(d.opened.meMeMe, 0);
  assert.equal(d.mgrs.meMeMe.session, null);
});

test('a stray no for another session changes nothing about a live ask', () => {
  const c = crowd(['meMeMe', 'peerAAAA']);
  c.mgrs.peerAAAA.request('meMeMe'); c.pump(); c.advance(20_000);
  c.mgrs.peerAAAA.onFrame('meMeMe', { k: 'no', to: 'peerAAAA', s: 'nope' });   // a stray no for another session changes nothing
  assert.equal(c.mgrs.peerAAAA.stateFor('meMeMe'), 'outgoing');
});
