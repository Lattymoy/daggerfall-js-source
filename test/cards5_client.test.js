// CARDS5 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 17): THE RELAY'S TABLE ON THE CLIENT. Driven: the
// relay's frames folded into the evening's own shapes (systems/cardRemoteTable.js) - chairs as seats, mine and the
// others' and the empty, my hole cards in my seat alone, my turn only while it is mine, the relay's clock on mine, a
// hand already under way told as the events it took; and the interior host's card block RUN (sliced from
// worldModes.js, as auditcards2_host does) for three players in one tavern over an in-process copy of the relay's table
// (net/holdemTable.js) - two seated, each shown only their own cards, an action through the panel, a stand folding out
// of turn and naming its table, no purse touched; the third watching the cloth, let go when the table empties; and alone
// at the table, the regulars instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeDoc } from './decorFakes.mjs';
import * as court from '../src/systems/court.js';
import * as sess from '../src/systems/cardTableSession.js';
import * as hudm from '../src/ui/cardTableHud.js';
import { holdCursor } from '../src/player/pointerLock.js';
import { nearestFreeSeat, takenSeats } from '../src/world/cardTables.js';
import { regularsToStand, regularBark, BARK_MS } from '../src/world/cardRegulars.js';
import { RemoteCardTable, CATCH_UP_MS } from '../src/systems/cardRemoteTable.js';
import { newTable, sit, stand, actAt, tick, tableLook, validHoldemIn, HOLDEM_FIRST_MS, HOLDEM_CLOCK_MS } from '../src/net/holdemTable.js';

const seeded = (seed = 99) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };

test('CARDS5 the relay\'s table as I see it: chairs as seats, my cards alone, my turn only while mine, the relay\'s clock on mine', () => {
  const t = newTable({ chairs: 4, bb: 10 });
  const frames = [];
  const relayNow = 5_000_000;
  const at = 100;   // my clock when each frame arrives
  const out = (msgs, now) => { for (const m of msgs) frames.push({ to: m.to, f: { t: 'holdem', table: 0, now, ...m.frame, at } }); };
  out(sit(t, { id: 'a', name: 'Ann', chair: 1, now: relayNow }), relayNow);
  out(sit(t, { id: 'b', name: 'Bob', chair: 3, now: relayNow }), relayNow);
  out(tick(t, relayNow + HOLDEM_FIRST_MS, seeded(4)), relayNow + HOLDEM_FIRST_MS);
  const mine = new RemoteCardTable({ myId: 'a', chair: 1 });
  for (const x of frames) if (x.to === null || x.to === 'a') mine.ingest(x.f);
  const v = mine.view();
  assert.deepEqual(v.seats.map((s) => s.kind), ['empty', 'player', 'empty', 'peer']);
  assert.equal(mine.playerSeat, 1);
  const k = v.handSeats.indexOf(1);
  assert.deepEqual(v.hand.seats[k].hole, t.hand.seats[k].hole, 'my own two');
  assert.equal(v.hand.seats[1 - k].hole, null, 'never his');
  assert.equal(mine.holeOf(1, 0), t.hand.seats[k].hole[0]);
  assert.equal(mine.holeOf(3, 0), -1);
  const aToAct = t.handSeats[t.hand.toAct] === 1;
  assert.equal(!!mine.legal(), aToAct, 'my turn only when it is mine');
  // the relay's clock on mine: an event dealt at the relay's now arrives at my `at`
  const evs = mine.drain();
  assert.deepEqual(evs.map((e) => e.t), ['sit', 'sit', 'hand']);
  assert.equal(evs.at(-1).at, at, 'the deal, made at the frame\'s own moment, lands at my clock\'s moment of arrival');
  if (aToAct) assert.equal(mine.clockLeft(at), HOLDEM_CLOCK_MS, 'the clock the relay set, on mine');
  // an event the relay dated earlier than its frame lands that much earlier on mine
  const early = new RemoteCardTable({ myId: 'q' });
  early.ingest({ t: 'holdem', table: 0, now: 1000, events: [{ t: 'sit', seat: 0, name: 'Q', at: 400 }], state: frames[0].f.state, at: 9000 });
  assert.equal(early.drain()[0].at, 8400);
  assert.deepEqual(mine.drain(), [], 'drained once');
  // my turn word kept, the turn passed on in the same hand: no longer mine
  if (aToAct) {
    const passed = actAt(t, { id: 'a', action: { type: 'call' }, now: relayNow + 3000 });
    for (const m of passed) if (m.to === null) mine.ingest({ t: 'holdem', table: 0, now: relayNow + 3000, ...m.frame, at });
    assert.equal(mine.legal(), null, 'the turn moved on: the old word is not a turn');
  }
  // a watcher who came in mid-hand: told the hand as the events it took, long enough ago to lie at rest
  const late = new RemoteCardTable({ myId: 'z' });
  late.ingest({ t: 'holdem', table: 0, now: relayNow + 9000, ...tableLook(t, 'z', relayNow + 9000)[0].frame, at: 50_000 });
  const caught = late.drain();
  assert.equal(caught[0].t, 'hand');
  assert.equal(caught[0].at, 50_000 - CATCH_UP_MS);
  assert.equal(caught[0].seed, t.seed, 'the cloth\'s seed caught too');
  assert.equal(late.legal(), null, 'a watcher has no turn');
  assert.ok(late.view().seats.every((s) => s.kind !== 'player'));
  // stood up by the relay (out of chips, gone): no chair of mine any more - once a state had shown me in it
  const gone = new RemoteCardTable({ myId: 'a', chair: 1 });
  const t2 = newTable({ chairs: 4, bb: 10 });
  const before = stand(t2, { id: 'nobody', now: 0 });   // nothing: a frame the relay made before it read my sit
  assert.deepEqual(before, []);
  gone.ingest({ t: 'holdem', table: 0, now: 0, events: [], state: tableLook(t2, 'a', 0)[0].frame.state, at: 1 });
  assert.equal(gone.playerSeat, 1, 'AUDIT CARDS-3 B2: my chair empty in a frame made before my sit is no news - still pending');
  assert.equal(gone.confirmed, false);
  const sat = sit(t2, { id: 'a', name: 'Ann', chair: 1, now: 0 });
  gone.ingest({ t: 'holdem', table: 0, now: 0, ...sat[0].frame, at: 1 });
  assert.equal(gone.confirmed, true, 'my id in my chair: confirmed');
  const up = stand(t2, { id: 'a', now: 1 });
  gone.ingest({ t: 'holdem', table: 0, now: 1, ...up[0].frame, at: 1 });
  assert.equal(gone.playerSeat, -1);
  assert.deepEqual(gone.lost, { chair: 1, why: 'stood' });
  gone.ingest({ t: 'holdem', table: 0, now: 1, error: 'not your turn', at: 1 });
  assert.equal(gone.error, 'not your turn');
  // AUDIT CARDS-3 B2: the chair asked for went to another - lost, never "mine" with his cards in it
  const t3 = newTable({ chairs: 4, bb: 10 });
  const raced = new RemoteCardTable({ myId: 'b', chair: 2 });
  const cat = sit(t3, { id: 'c', name: 'Cat', chair: 2, now: 0 });
  raced.ingest({ t: 'holdem', table: 0, now: 0, ...cat[0].frame, at: 1 });
  assert.deepEqual([raced.playerSeat, raced.lost], [-1, { chair: 2, why: 'refused' }]);
  assert.ok(raced.view().seats.every((x) => x.kind !== 'player'), 'Cat is never drawn as me');
  const refused = new RemoteCardTable({ myId: 'b', chair: 2 });
  const said = refused.said;
  refused.ingest({ t: 'holdem', table: 0, now: 0, error: 'taken', at: 1 });
  assert.deepEqual([refused.playerSeat, refused.lost?.why, refused.said], [-1, 'refused', said + 1], 'a refused sit: lost, and the panel told');
  // AUDIT CARDS-3 E-N1: the chair found by my id wherever the relay put me
  const moved = new RemoteCardTable({ myId: 'a', chair: 0 });
  const t4 = newTable({ chairs: 4, bb: 10 });
  moved.ingest({ t: 'holdem', table: 0, now: 0, ...sit(t4, { id: 'a', name: 'Ann', chair: 3, now: 0 })[0].frame, at: 1 });
  assert.equal(moved.playerSeat, 3);
});

// ── the host, three players in one tavern, over an in-process relay table ──
const WM = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
const BLOCK = WM.slice(WM.indexOf('  let cardSeat = null;'), WM.indexOf('\n', WM.indexOf("registerPlayerHurtListener('cards-seat'")));

/** The relay's table, in process: a word from a player applied to it, every message delivered as the relay sends it. */
function fakeRelay() {
  const tables = new Map();
  const players = new Map();   // id -> host
  let now = 1e12;
  const rand32 = seeded(11);
  const deliver = (index, msgs) => {
    for (const { to, frame } of msgs) for (const [id, h] of players) if (to == null || to === id) h.api.cardOnlineFrame({ t: 'holdem', table: index, now, ...frame, at: performanceNow() });
  };
  const word = (id, w) => {
    const v = validHoldemIn(w);
    if (!v) return false;
    let t = tables.get(v.table);
    const name = players.get(id).name;
    if (v.op === 'sit') {
      if (!t) { t = newTable({ chairs: v.chairs, bb: v.bb }); tables.set(v.table, t); }
      const r = sit(t, { id, name, chair: v.chair, now });
      if (typeof r === 'string') deliver(v.table, [{ to: id, frame: { error: r } }]); else deliver(v.table, r);
    } else if (v.op === 'stand' && t) deliver(v.table, stand(t, { id, now }));
    else if (v.op === 'look' && t) deliver(v.table, tableLook(t, id, now));   // AUDIT CARDS-3 D7: the asker alone
    else if (v.op === 'act' && t) { const r = actAt(t, { id, action: v.action, now }); deliver(v.table, typeof r === 'string' ? [{ to: id, frame: { error: r } }] : r); }
    return true;
  };
  return {
    tables, players, word,
    advance(ms) { now += ms; for (const [i, t] of tables) deliver(i, tick(t, now, rand32)); },
  };
}
let clockMs = 0;
const performanceNow = () => clockMs;

function host(relay, id, name, { seats = 4, pos = [0, 0, 0] } = {}) {
  const doc = fakeDoc();
  const playerEntity = { name, goldPieces: 500, items: [], health: 50 };
  const said = [];
  const draws = { made: 0, destroyed: 0 };
  const scenes = [];
  const seatList = Array.from({ length: seats }, (_, k) => ({ x: k * 2, z: 0, eye: [k * 2, 1, 0], feet: [k * 2, 0, 0], yaw: 0, pitch: 0, top: 0.8 }));
  const peers = () => [...relay.players.values()].filter((h) => h !== me && h.api.cardSeat).map((h) => h.api.cardSeat.feet);
  const scope = {
    isTavern: () => true, BUILDING_TYPES: { None: 0 },
    cardTableSeats: () => seatList, seatFloorOk: () => true, SEAT_FLOOR_PROBE: 1, nearestFreeSeat, takenSeats,
    player: { pos, eyeAt: () => [0, 1.6, 0] },
    host: { realmAct: null, relock: () => said.push('<relock>'), seatedPeers: peers, cardOnline: { ok: () => true, send: (w) => { const g = me.gate ? me.gate(w) : true; return g === 'in flight' ? true : g && relay.word(id, w); }, id: () => id, welcomes: () => me.welcomes ?? 0 } },
    say: (s) => said.push(s), cam: { yaw: 0, pitch: 0, pos: null },
    getNameBankOfRegion: () => 0, residentName: (seed, bank, g) => `R${seed}:${g}`,
    stakesFor: sess.stakesFor, buyInRange: sess.buyInRange, goldAmount: court.goldAmount, holdCursor, renderer: {},
    createCardTableDraw: () => { draws.made++; return { draw() {}, destroy() { draws.destroyed++; } }; },
    createCardTableHud: (p) => hudm.createCardTableHud({ ...p, doc }), cardHudModel: hudm.cardHudModel, eventLine: hudm.eventLine,
    deductGold: court.deductGold, addGold: court.addGold, playerEntity,
    CardTableSession: sess.CardTableSession, seatPatrons: sess.seatPatrons, regularsFor: sess.regularsFor, regularsAfter: sess.regularsAfter,
    CardScene: class { constructor(o) { this.o = o; this.places = o.places; this.playerSeat = o.playerSeat; this.events = []; scenes.push(this); } onEvent(e, holeOf) { this.events.push({ e, holes: [holeOf(this.o.playerSeat, 0)] }); } poses() { return { cards: [], chips: [] }; } settledAt() { return 0; } },
    tablePlaces: (frame, s, seatOf) => ({ seatOf, seats: seatOf.map(() => ({})) }), tableFrame: () => ({ centre: [0, 0.8, 0], axisYaw: 0, halfLong: 1, halfShort: 0.5 }), hashSeed: (...x) => x.join(':'),
    registerPlayerHurtListener: () => {}, isOnlinePage: () => true,
    mwViewFirstPerson: () => {}, homeTownOf: (b) => b?.townMapId || 0, worldMinutes: () => 0, MINUTES_PER_DAY: 1440,
    RemoteCardTable, mode: 'interior', regularsToStand, regularBark, BARK_MS, showdownWinners: hudm.showdownWinners, HOLDEM_REFUSALS: hudm.HOLDEM_REFUSALS, performance: { now: performanceNow },
  };
  const state = { interiorCtx: { tables: [{ aabb: {} }, { aabb: {} }], collider: null }, interiorBuilding: { buildingKey: 7, quality: 10, regionIndex: 17, townMapId: 1 } };
  const api = new Function('S', ...Object.keys(scope), `let interiorCtx = S.interiorCtx, interiorBuilding = S.interiorBuilding;\n${BLOCK}\n
    return { sitAtCardTable, standFromCardTable, cardGameFrame, cardOnlineFrame, cardRegularsNow, cardPress: (id, v) => cardPress(cardGame, id, v), setCtx: (c) => { interiorCtx = c; }, get cardGame() { return cardGame; }, get cardSeat() { return cardSeat; }, get watches() { return cardWatches; } };`)(state, ...Object.values(scope));
  const panel = () => doc.body.children.filter((n) => n.className === 'dfcards' && !n.removed).at(-1);
  const walk = (n, f, out = []) => { if (!n) return out; if (f(n)) out.push(n); for (const c of n.children ?? []) walk(c, f, out); return out; };
  const button = (label) => walk(panel(), (n) => n.tag === 'button' && n.textContent.startsWith(label))[0];
  const me = { id, name, api, playerEntity, said, draws, scenes, panel, button };
  relay.players.set(id, me);
  return me;
}

test('CARDS5 three in one tavern: two seated at the relay\'s table each shown only their own cards, one watching the cloth; an action through the panel; a stand folds and names its table; no purse touched', () => {
  clockMs = 0;
  const relay = fakeRelay();
  const ann = host(relay, 'ann', 'Ann'), bob = host(relay, 'bob', 'Bob'), cat = host(relay, 'cat', 'Cat');
  ann.api.sitAtCardTable(0);
  assert.equal(ann.api.cardGame.phase, 'playing', 'no buy-in: the friendly chips');
  assert.ok(ann.button('Play the regulars'), 'alone, the regulars are offered');
  bob.api.sitAtCardTable(0);
  assert.notEqual(bob.api.cardSeat.seat, ann.api.cardSeat.seat, 'another chair');
  assert.equal(cat.api.watches.size, 1, 'the third watches the table');
  relay.advance(HOLDEM_FIRST_MS);
  clockMs = 3000;
  for (const h of [ann, bob, cat]) h.api.cardGameFrame(clockMs);
  const t = relay.tables.get(0);
  for (const h of [ann, bob]) {
    const v = h.api.cardGame.remote.view();
    const k = v.handSeats.indexOf(h.api.cardSeat.seat);
    assert.deepEqual(v.hand.seats[k].hole, t.hand.seats[k].hole, `${h.name} sees their own`);
    assert.equal(v.hand.seats[1 - k].hole, null, `${h.name} never the other's`);
    assert.ok(h.api.cardGame.scene?.events.some(({ e }) => e.t === 'hand'), `the deal on their cloth: ${h.scenes.length} scenes, ${JSON.stringify(h.api.cardGame.scene?.events.map(({ e }) => e.t))}`);
  }
  const watched = cat.api.watches.get(0);
  assert.ok(watched.remote.view().hand.seats.every((s) => s.hole === null), 'the watcher sees no hand');
  // the seat to act acts through its panel
  const toAct = [ann, bob].find((h) => h.api.cardGame.remote.legal());
  assert.ok(toAct, 'one of them is told it is their turn');
  assert.match(toAct.panel() ? JSON.stringify(toAct.api.cardGame.log) + '' : '', /Hand 1/);
  toAct.button(toAct.api.cardGame.remote.legal().check ? 'Check' : 'Call').fire('click');
  for (const h of [ann, bob, cat]) h.api.cardGameFrame(clockMs + 1);
  assert.ok(t.hand === null || t.hand.toAct !== t.handSeats.indexOf(toAct.api.cardSeat.seat) || t.hand.street !== 'preflop', 'the relay took the action');
  assert.ok(ann.api.cardGame.log.some((l) => /call|check/i.test(l)) && bob.api.cardGame.log.some((l) => /call|check/i.test(l)));
  // Bob stands: folded out of turn if the hand holds him; the stand names the table he sat at
  bob.api.standFromCardTable();
  assert.equal(relay.tables.get(0)?.seats.filter((s) => s && !s.leaving).length, 1, 'Bob up from the relay\'s table');
  for (const h of [ann, bob]) assert.equal(h.playerEntity.goldPieces, 500, 'a friendly table: no purse touched');
  // Ann stands too: the table empties, the watcher lets its cloth go
  ann.api.standFromCardTable();
  relay.advance(10);
  cat.api.cardGameFrame(clockMs + 5);
  assert.equal(cat.api.watches.size, 0, 'the emptied table\'s cloth let go');
  assert.equal(cat.draws.made, cat.draws.destroyed, 'its draw freed');
});

test('CARDS5 alone at the relay\'s table, the regulars instead: up from the relay, the friendly game with them', () => {
  clockMs = 0;
  const relay = fakeRelay();
  const ann = host(relay, 'ann', 'Ann');
  ann.api.sitAtCardTable(0);
  ann.button('Play the regulars').fire('click');
  assert.equal(relay.tables.get(0).seats.filter(Boolean).length, 0, 'stood up from the relay\'s table');
  const g = ann.api.cardGame;
  assert.equal(g.remote, null);
  assert.equal(g.phase, 'buyin');
  assert.ok(g.friendly, 'online, the regulars play for chips');
  ann.button('Deal me in').fire('click');
  assert.ok(g.session && g.session.seats.some((s) => s.kind === 'patron'), 'the regulars dealt in');
  ann.api.standFromCardTable();
  assert.equal(ann.playerEntity.goldPieces, 500);
});

test('AUDIT CARDS-3 B1/B3/B7: a new socket sits again (the relay stood the old one up); a refusal is painted; out of chips is said to me', () => {
  clockMs = 0;
  const relay = fakeRelay();
  const ann = host(relay, 'ann', 'Ann'), bob = host(relay, 'bob', 'Bob');
  ann.api.sitAtCardTable(0); bob.api.sitAtCardTable(0);
  relay.advance(HOLDEM_FIRST_MS); clockMs = 3000;
  for (const h of [ann, bob]) h.api.cardGameFrame(clockMs);
  const t = relay.tables.get(0);
  assert.equal(ann.api.cardGame.remote.confirmed, true);
  // Ann's socket drops: the relay folds her out of turn and marks her leaving (frames to the dead socket, not her)
  const words = [];
  ann.gate = (w) => { words.push(w.op); return true; };
  for (const m of stand(t, { id: 'ann', now: 0 })) for (const [pid, h] of relay.players) if (pid !== 'ann' && (m.to == null || m.to === pid)) h.api.cardOnlineFrame({ t: 'holdem', table: 0, now: 0, ...m.frame, at: clockMs });
  ann.welcomes = 1;   // a new socket welcomed
  ann.api.cardGameFrame(clockMs + 10);
  assert.deepEqual(words, ['sit'], 'the sit said again on the new socket');
  assert.equal(t.seats[ann.api.cardSeat.seat]?.leaving, undefined, 'her own chair kept, no longer leaving');
  assert.equal(ann.api.cardGame.remote.confirmed, true, 'confirmed by the relay\'s answer');
  assert.equal(ann.api.cardGame.remote.turn, null, 'the old socket\'s turn forgotten');
  // a refusal is painted when it comes (B3)
  ann.api.cardOnlineFrame({ t: 'holdem', table: 0, now: 0, error: 'not your turn', at: clockMs });
  ann.api.cardGameFrame(clockMs + 20);
  assert.match(walkText(ann.panel()), /It is not your turn/);
  // out of chips: the relay stands her - the panel and the log say so to her (B7)
  const chair = ann.api.cardSeat.seat;
  const view = { ...ann.api.cardGame.remote.state, seats: ann.api.cardGame.remote.state.seats.map((x, i) => (i === chair ? null : x)), hand: null };
  ann.api.cardOnlineFrame({ t: 'holdem', table: 0, now: 0, events: [{ t: 'leave', seat: chair, name: 'Ann', broke: true, at: 0 }], state: view, at: clockMs });
  ann.api.cardGameFrame(clockMs + 30);
  assert.equal(ann.api.cardGame.phase, 'over');
  assert.equal(ann.api.cardGame.why, 'broke');
  assert.match(walkText(ann.panel()), /You are out of chips/);
  assert.ok(ann.api.cardGame.log.includes('You are out of chips and stand up.'), `said to her: ${JSON.stringify(ann.api.cardGame.log.slice(-2))}`);
});

test('AUDIT CARDS-3 B2/B4/B6/B11: a chair raced is stood up from; a stand the gate kept is said again; my regulars\' table never watched over; no regulars without a chair', () => {
  clockMs = 0;
  const relay = fakeRelay();
  const ann = host(relay, 'ann', 'Ann', { seats: 2 });
  ann.api.sitAtCardTable(0);
  // B4: the stand the client's gate dropped is kept until it goes
  let shut = true;
  ann.gate = (w) => (w.op === 'stand' ? !shut : true);
  ann.api.standFromCardTable();
  assert.equal(relay.tables.get(0).seats.filter(Boolean).length, 1, 'the gate kept the stand');
  shut = false;
  ann.api.cardGameFrame(10);
  assert.equal(relay.tables.get(0)?.seats.filter(Boolean).length ?? 0, 0, 'said again the next frame: up at the relay');
  // B6: playing the regulars at table 0, the relay's table 0 frames are never laid over her game
  ann.api.sitAtCardTable(0);
  ann.button('Play the regulars').fire('click');
  const bob = host(relay, 'bob', 'Bob', { seats: 2 });
  relay.word('bob', { op: 'sit', table: 0, chair: 1, chairs: 2, bb: 10 });
  assert.equal(ann.api.watches.size, 0, 'no watch of the table she plays at');
  ann.api.standFromCardTable();
  // B11: Bob in the other chair of a two-chair table, playing his regulars - Ann alone at the relay has no chair for one
  relay.word('bob', { op: 'stand', table: 0 });
  bob.api.sitAtCardTable(0);
  bob.button('Play the regulars').fire('click');
  ann.api.sitAtCardTable(0);
  assert.equal(ann.api.cardGame.remote.seated, 1, 'alone at the relay');
  assert.equal(ann.button('Play the regulars'), undefined, 'not offered with no chair for one');
  ann.api.standFromCardTable(); bob.api.standFromCardTable();
  // B2: a chair raced - the relay gave it to another: she is stood up, never shown his cards as hers
  const cat = host(relay, 'cat', 'Cat', { seats: 3 });
  cat.gate = (w) => (w.op === 'sit' ? 'in flight' : true);   // her sit still on its way when Dan's lands
  cat.api.sitAtCardTable(1);
  const asked = cat.api.cardSeat.seat;
  const t = newTable({ chairs: 3, bb: 10 });
  const other = sit(t, { id: 'dan', name: 'Dan', chair: asked, now: 0 });
  cat.api.cardOnlineFrame({ t: 'holdem', table: 1, now: 0, ...other[0].frame, at: 0 });
  cat.api.cardGameFrame(5);
  assert.equal(cat.api.cardSeat, null, 'stood up');
  assert.ok(cat.said.some((x) => /took that chair|taken/i.test(x)), JSON.stringify(cat.said.slice(-2)));
});
const walkText = (n) => (n ? `${n.textContent ?? ''} ${(n.children ?? []).map(walkText).join(' ')}` : '');

test('AUDIT CARDS-3 D7 and the host\'s own seams: a newcomer asks for the tables; a word names its table; a frame of another table is a watch; a watch let go with its room and at the sit', () => {
  clockMs = 0;
  const relay = fakeRelay();
  const ann = host(relay, 'ann', 'Ann'), bob = host(relay, 'bob', 'Bob');
  ann.api.sitAtCardTable(1); bob.api.sitAtCardTable(1);   // the second table of the room
  relay.advance(HOLDEM_FIRST_MS); clockMs = 3000;
  for (const h of [ann, bob]) h.api.cardGameFrame(clockMs);
  // the words name table 1 (D2: never 0)
  const t1 = relay.tables.get(1);
  const toAct = [ann, bob].find((h) => h.api.cardGame.remote.legal());
  const hands = t1.handNo, actsBefore = JSON.stringify(t1.hand.seats.map((x) => x.total));
  toAct.api.cardPress('fold');
  assert.ok(t1.hand === null || JSON.stringify(t1.hand.seats.map((x) => x.total)) !== actsBefore || t1.handNo !== hands, 'the act reached table 1');
  // a newcomer: the room's tables asked for at once - the hand under way laid on its cloth
  const cat = host(relay, 'cat', 'Cat');
  cat.api.cardGameFrame(clockMs + 1);
  assert.ok(cat.api.watches.has(1), 'table 1 watched before any event of its own');
  assert.ok(cat.api.watches.get(1).remote.state, 'its state told to the asker');
  // a frame of another table while seated is a watch, never the game's (the host's table check)
  relay.word('cat', { op: 'sit', table: 0, chair: 0, chairs: 4, bb: 10 });
  assert.ok(ann.api.watches.has(0) && ann.api.cardGame.remote.state.chairs === 4, 'table 0 watched; the game\'s own state untouched');
  // a watcher who sits lets its watch of that table go (the game's cloth now)
  const watchDraws = cat.draws.made;
  cat.api.sitAtCardTable(1);
  assert.equal(cat.api.watches.has(1), false);
  assert.ok(cat.draws.destroyed >= 1 && cat.draws.made > watchDraws);
  cat.api.standFromCardTable();
  // a stand names the table it sat at (never 0)
  bob.api.standFromCardTable();
  assert.ok(!relay.tables.get(1)?.seats.some((x) => x?.id === 'bob' && !x.leaving), 'Bob up from table 1');
  // a watch of another room is let go - even where the new room has a table of the same index at hand
  ann.api.setCtx({ tables: [{ aabb: {} }], collider: null });
  ann.api.cardGameFrame(clockMs + 2);
  assert.equal(ann.api.watches.size, 0, 'another room: every watch let go');
  for (const h of [ann, bob, cat]) h.api.standFromCardTable?.();
});

test('AUDIT CARDS-3 the panel online: the clock while it is mine, refused words in words, the regulars only with nobody dealt in, the empty chairs left out', () => {
  const view = (hand) => ({ handNo: 1, button: 0, stakes: { sb: 5, bb: 10 }, over: null, handSeats: [0, 2], hand,
    seats: [{ id: 'a', name: 'Ann', kind: 'player', stack: 990, gone: false }, { id: null, name: '', kind: 'empty', stack: 0, gone: true }, { id: 'b', name: 'Bob', kind: 'peer', stack: 980, gone: false }], showdown: null });
  const hand = { board: [], street: 'preflop', currentBet: 10, toAct: 0, seats: [{ stack: 990, bet: 5, total: 5, hole: [1, 2], folded: false, allIn: false }, { stack: 980, bet: 10, total: 10, hole: null, folded: false, allIn: false }] };
  const legal = { call: 5, raise: { min: 20, max: 995 } };
  const m = hudm.cardHudModel({ phase: 'playing', view: view(hand), legal, stakes: { sb: 5, bb: 10 }, friendly: true, online: { waiting: false, clock: 17, error: null } });
  assert.equal(m.message, 'Your turn - 17 s.');
  assert.deepEqual(m.seats.map((x) => x.name), ['Ann', 'Bob'], 'the empty chair is no seat');
  const r = hudm.cardHudModel({ phase: 'playing', view: view(hand), legal: null, stakes: { sb: 5, bb: 10 }, friendly: true, online: { waiting: false, clock: 0, error: 'not your turn' } });
  assert.match(r.message, /\(It is not your turn\.\)$/);
  // waiting mid-hand (the other stood, the hand still running): no regulars offered till it ends
  const w = hudm.cardHudModel({ phase: 'playing', view: view(hand), legal: null, stakes: { sb: 5, bb: 10 }, friendly: true, online: { waiting: false, clock: 0, error: null, regulars: true } });
  assert.ok(!w.actions.some((a) => a.id === 'regulars'));
  assert.equal(hudm.eventLine({ t: 'act', seat: 2, type: 'fold', timeout: true }, ['Ann', '', 'Bob'], 0), 'Bob is out of time and folds.');
  assert.equal(hudm.eventLine({ t: 'act', seat: 0, type: 'check', timeout: true }, ['Ann', '', 'Bob'], 0), 'You are out of time and check.');
  assert.equal(hudm.eventLine({ t: 'sit', seat: 2, name: 'Bob' }, ['Ann', '', 'Bob'], 0), 'Bob sits down.');
});

test('AUDIT CARDS-3 my clock while it is my turn: the panel\'s seconds told once a second, in place', () => {
  clockMs = 0;
  const relay = fakeRelay();
  const ann = host(relay, 'ann', 'Ann'), bob = host(relay, 'bob', 'Bob');
  ann.api.sitAtCardTable(0); bob.api.sitAtCardTable(0);
  relay.advance(HOLDEM_FIRST_MS); clockMs = 3000;
  for (const h of [ann, bob]) h.api.cardGameFrame(clockMs);
  const me = [ann, bob].find((h) => h.api.cardGame.remote.legal());
  const msg = () => walkText(me.panel()).match(/Your turn - (\d+) s\./)?.[1];
  const first = Number(msg());
  clockMs += 5200;
  me.api.cardGameFrame(clockMs);
  assert.equal(Number(msg()), first - 5, `the seconds counted down (${first} -> ${msg()})`);
});

test('AUDIT CARDS-3 E-N3: a player sat down in a regular\'s chair - the chair is his, the regular not drawn in it', () => {
  clockMs = 0;
  const relay = fakeRelay();
  const ann = host(relay, 'ann', 'Ann'), bob = host(relay, 'bob', 'Bob');
  ann.api.sitAtCardTable(0);
  ann.button('Play the regulars').fire('click');
  ann.button('Deal me in').fire('click');
  const chairsOf = () => ann.api.cardRegularsNow(0).map((x) => x.feet[0]);
  const before = chairsOf();
  bob.api.sitAtCardTable(0);
  const bobX = bob.api.cardSeat.feet[0];
  assert.ok(before.includes(bobX), 'Bob took a chair Ann\'s regulars sat in');
  assert.ok(!chairsOf().includes(bobX), 'no regular drawn in his chair');
  ann.api.standFromCardTable(); bob.api.standFromCardTable();
});

test('CARDS-TIDY a table is watched from near it: across the room nothing is laid; walked up to, it is asked for and laid; walked away, let go', () => {
  clockMs = 0;
  const relay = fakeRelay();
  const ann = host(relay, 'ann', 'Ann'), bob = host(relay, 'bob', 'Bob');
  const where = [30, 0, 0];
  const cat = host(relay, 'cat', 'Cat', { pos: where });
  cat.api.cardGameFrame(0);   // her visit's looks, from across the room
  ann.api.sitAtCardTable(0); bob.api.sitAtCardTable(0);
  relay.advance(HOLDEM_FIRST_MS);
  cat.api.cardGameFrame(1);
  assert.equal(cat.api.watches.size, 0, 'across the room: no cloth laid');
  assert.equal(cat.draws.made, 0, 'not even for a frame');
  where[0] = 2;   // she walks up
  cat.api.cardGameFrame(2);
  assert.ok(cat.api.watches.has(0) && cat.api.watches.get(0).remote.state?.hand, 'near: asked for, and the hand laid at once');
  where[0] = 30;
  cat.api.cardGameFrame(3);
  assert.equal(cat.api.watches.size, 0, 'walked away: let go');
  assert.equal(cat.draws.made, cat.draws.destroyed);
  for (const h of [ann, bob]) h.api.standFromCardTable();
});

test('CARDS-TIDY a table\'s change with no table under it is asked for whole', () => {
  clockMs = 0;
  const relay = fakeRelay();
  const cat = host(relay, 'cat', 'Cat');
  const words = [];
  cat.gate = (w) => { words.push(`${w.op}:${w.table}`); return true; };
  cat.api.cardGameFrame(0);
  words.length = 0;
  cat.api.cardOnlineFrame({ t: 'holdem', table: 1, now: 0, events: [], delta: { clockAt: 5 }, at: 0 });
  cat.api.cardGameFrame(1);
  assert.deepEqual(words, ['look:1']);
});

test('AUDIT CARDS-4 D2/D3 and lane D\'s host mutants: a watch kept within its slack and asked for once an approach; a watch that missed a frame asks again; a seated table that did, once the gate lets it go and no oftener than CARD_LOOK_AGAIN_MS; a far table\'s change asks nothing', () => {
  clockMs = 0;
  const relay = fakeRelay();
  const ann = host(relay, 'ann', 'Ann'), bob = host(relay, 'bob', 'Bob');
  const where = [2, 0, 0];
  const cat = host(relay, 'cat', 'Cat', { pos: where });
  const words = [];
  cat.gate = (w) => { words.push(`${w.op}:${w.table}`); return true; };
  ann.api.sitAtCardTable(0); bob.api.sitAtCardTable(0);
  relay.advance(HOLDEM_FIRST_MS);
  cat.api.cardGameFrame(0);
  assert.ok(cat.api.watches.has(0), 'watched from near');
  words.length = 0;
  where[0] = 6.5;   // past the watch's distance, within its slack
  cat.api.cardGameFrame(1);
  assert.ok(cat.api.watches.has(0), 'kept within its slack');
  where[0] = 5.9;
  cat.api.cardGameFrame(2);
  assert.deepEqual(words, [], 'back over the line: not asked again');
  // a frame missed: the watch asks for the whole
  cat.api.watches.get(0).remote.needLook = true;
  cat.api.cardGameFrame(3); cat.api.cardGameFrame(3.5);   // queued this frame, said the next
  assert.deepEqual(words, ['look:0']);
  // a far table's change asks nothing
  words.length = 0;
  where[0] = 40;
  cat.api.cardGameFrame(4);
  cat.api.cardOnlineFrame({ t: 'holdem', table: 1, now: 0, events: [], delta: { clockAt: 5 }, n: 3, at: 0 });
  cat.api.cardGameFrame(5);
  assert.deepEqual(words, [], 'a table across the room: no look');
  // seated, a frame missed: asked once the gate lets it go, and no oftener than CARD_LOOK_AGAIN_MS
  clockMs = 9_000; ann.api.cardGameFrame(9_000);   // her visit's own looks said first
  const said = [];
  let open = false;
  ann.gate = (w) => { if (w.op === 'look') { said.push(clockMs); return open; } return true; };
  ann.api.cardGame.remote.needLook = true;
  clockMs = 10_000; ann.api.cardGameFrame(10_000);
  open = true;
  clockMs = 10_100; ann.api.cardGameFrame(10_100);
  assert.equal(said.length, 1, 'not asked again inside CARD_LOOK_AGAIN_MS');
  clockMs = 12_100; ann.api.cardGameFrame(12_100);
  assert.equal(said.length, 2, 'the gate kept it: asked again');
  assert.equal(ann.api.cardGame.remote.needLook, false, 'and once it went, done');
  clockMs = 15_000; ann.api.cardGameFrame(15_000);
  assert.equal(said.length, 2);
  for (const h of [ann, bob]) h.api.standFromCardTable();
});
