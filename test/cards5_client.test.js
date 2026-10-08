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
  // stood up by the relay (out of chips, gone): no chair of mine any more
  const gone = new RemoteCardTable({ myId: 'a', chair: 1 });
  const t2 = newTable({ chairs: 4, bb: 10 });
  sit(t2, { id: 'a', name: 'Ann', chair: 1, now: 0 });
  const up = stand(t2, { id: 'a', now: 1 });
  gone.ingest({ t: 'holdem', table: 0, now: 1, ...up[0].frame, at: 1 });
  assert.equal(gone.playerSeat, -1);
  gone.ingest({ t: 'holdem', table: 0, now: 1, error: 'taken', at: 1 });
  assert.equal(gone.error, 'taken');
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

function host(relay, id, name, { seats = 4 } = {}) {
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
    player: { pos: [0, 0, 0], eyeAt: () => [0, 1.6, 0] },
    host: { realmAct: null, relock: () => said.push('<relock>'), seatedPeers: peers, cardOnline: { ok: () => true, send: (w) => relay.word(id, w), id: () => id } },
    say: (s) => said.push(s), cam: { yaw: 0, pitch: 0, pos: null },
    getNameBankOfRegion: () => 0, residentName: (seed, bank, g) => `R${seed}:${g}`,
    stakesFor: sess.stakesFor, buyInRange: sess.buyInRange, goldAmount: court.goldAmount, holdCursor, renderer: {},
    createCardTableDraw: () => { draws.made++; return { draw() {}, destroy() { draws.destroyed++; } }; },
    createCardTableHud: (p) => hudm.createCardTableHud({ ...p, doc }), cardHudModel: hudm.cardHudModel, eventLine: hudm.eventLine,
    deductGold: court.deductGold, addGold: court.addGold, playerEntity,
    CardTableSession: sess.CardTableSession, seatPatrons: sess.seatPatrons, regularsFor: sess.regularsFor, regularsAfter: sess.regularsAfter,
    CardScene: class { constructor(o) { this.o = o; this.events = []; scenes.push(this); } onEvent(e, holeOf) { this.events.push({ e, holes: [holeOf(this.o.playerSeat, 0)] }); } poses() { return { cards: [], chips: [] }; } },
    tablePlaces: (frame, s, seatOf) => ({ seatOf }), tableFrame: () => ({}), hashSeed: (...x) => x.join(':'),
    registerPlayerHurtListener: () => {}, isOnlinePage: () => true,
    mwViewFirstPerson: () => {}, homeTownOf: (b) => b?.townMapId || 0, worldMinutes: () => 0, MINUTES_PER_DAY: 1440,
    RemoteCardTable, mode: 'interior', regularsToStand, regularBark, BARK_MS, showdownWinners: hudm.showdownWinners, performance: { now: performanceNow },
  };
  const state = { interiorCtx: { tables: [{ aabb: {} }, { aabb: {} }], collider: null }, interiorBuilding: { buildingKey: 7, quality: 10, regionIndex: 17, townMapId: 1 } };
  const api = new Function('S', ...Object.keys(scope), `let interiorCtx = S.interiorCtx, interiorBuilding = S.interiorBuilding;\n${BLOCK}\n
    return { sitAtCardTable, standFromCardTable, cardGameFrame, cardOnlineFrame, get cardGame() { return cardGame; }, get cardSeat() { return cardSeat; }, get watches() { return cardWatches; } };`)(state, ...Object.values(scope));
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
