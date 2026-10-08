// AUDIT CARDS-2 (2026-10-08, bible/01-Overview/Audit-Cards-2.md): THE TABLE ON THE SEAT - the interior host's card block
// RUN, not read (lane B's way: sliced from worldModes.js, `let cardSeat = null;` to the hurt listener, and run over the
// real session, the real gold, the real cursor hold, the real book and the real panel on a fake page), and the panel's
// own model and log. Driven: a load's road never pays the old game's chips into the loaded character (H1, with the save
// refused while chips are on the table); a purse that shrank since the seat is asked again before it is paid from (M2);
// the regulars' purses from the book and back into it (H2); the regulars only in chairs nobody else sits in (L7); their
// names the town's (L9); the dead stood up (the collapse past every hurt listener); the friendly game's chips; the
// buy-in clamped, never dealt twice; the evening's end; fifty sittings leaving nothing behind - and the panel: the
// showdown kept (M7), the contested pots' winners only (M8), the player in the second person, a bet, an all-in (L10),
// the slider's keys alone swallowed (L8), the phone's width (M3), the in-play buttons and seats (E7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeDoc, all, text } from './decorFakes.mjs';
import * as court from '../src/systems/court.js';
import * as sess from '../src/systems/cardTableSession.js';
import * as hudm from '../src/ui/cardTableHud.js';
import { holdCursor, cursorHeld } from '../src/player/pointerLock.js';
import { nearestFreeSeat, takenSeats } from '../src/world/cardTables.js';
import { HAND_NAMES } from '../src/net/cardLaw.js';
import { regularsToStand, regularBark, BARK_MS } from '../src/world/cardRegulars.js';
import { RemoteCardTable } from '../src/systems/cardRemoteTable.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WM = read('src/scenes/worldModes.js');
const BLOCK = WM.slice(WM.indexOf('  let cardSeat = null;'), WM.indexOf('\n', WM.indexOf("registerPlayerHurtListener('cards-seat'")));
const body = (src, name) => {
  let a = src.indexOf(`function ${name}(`);
  if (a < 0) a = src.indexOf(`    ${name}({`);   // a method of the host's api
  assert.ok(a >= 0, name);
  return src.slice(a, src.indexOf('\n  }\n', a) > a ? src.indexOf('\n  }\n', a) : a + 8000);
};

/** The block over fakes of the room and the page - and the real everything else. */
function host({ gold = 5000, online = false, realmAct = null, seats = 4, peers = [], building = { buildingKey: 7, quality: 10, regionIndex: 17, townMapId: 1111 }, minutes = 0 } = {}) {
  const doc = fakeDoc();
  const playerEntity = { name: 'Mac', goldPieces: gold, items: [], health: 50 };
  const said = [];
  const draws = { made: 0, destroyed: 0, drawn: 0 };
  const scenes = [];
  const seatList = Array.from({ length: seats }, (_, k) => ({ x: k * 2, z: 0, eye: [k * 2, 1, 0], feet: [k * 2, 0, 0], yaw: 0, pitch: 0, top: 0.8 }));
  const clock = { minutes };
  const scope = {
    isTavern: () => true, BUILDING_TYPES: { None: 0 },
    cardTableSeats: () => seatList, seatFloorOk: () => true, SEAT_FLOOR_PROBE: 1,
    nearestFreeSeat, takenSeats,
    player: { pos: [0, 0, 0], eyeAt: () => [0, 1.6, 0] },
    host: { realmAct, relock: () => said.push('<relock>'), seatedPeers: () => peers },
    say: (s) => said.push(s), cam: { yaw: 0, pitch: 0, pos: null },
    getNameBankOfRegion: () => 0, residentName: (seed, bank, g) => `R${seed}:${g}`,
    stakesFor: sess.stakesFor, buyInRange: sess.buyInRange, goldAmount: court.goldAmount,
    holdCursor, renderer: {},
    createCardTableDraw: () => { draws.made++; return { draw() { draws.drawn++; }, destroy() { draws.destroyed++; } }; },
    createCardTableHud: (p) => hudm.createCardTableHud({ ...p, doc }), cardHudModel: hudm.cardHudModel, eventLine: hudm.eventLine,
    deductGold: court.deductGold, addGold: court.addGold, playerEntity,
    CardTableSession: sess.CardTableSession, seatPatrons: sess.seatPatrons, regularsFor: sess.regularsFor, regularsAfter: sess.regularsAfter,
    CardScene: class { constructor(o) { this.o = o; this.places = o.places; this.playerSeat = o.playerSeat; this.events = []; scenes.push(this); } onEvent(e) { this.events.push(e); } poses() { return { cards: [], chips: [] }; } settledAt() { return 0; } },
    tablePlaces: (frame, s, seatOf) => ({ seatOf, seats: seatOf.map(() => ({})) }), tableFrame: () => ({}), hashSeed: (...x) => x.join(':'),
    registerPlayerHurtListener: () => {},
    isOnlinePage: () => online,
    mwViewFirstPerson: () => said.push('<head>'), homeTownOf: (b) => b?.townMapId || 0,
    worldMinutes: () => clock.minutes, MINUTES_PER_DAY: 1440,
    RemoteCardTable, mode: 'interior', regularsToStand, regularBark, BARK_MS, showdownWinners: hudm.showdownWinners, HOLDEM_REFUSALS: hudm.HOLDEM_REFUSALS,
  };
  const state = { interiorCtx: { tables: [{ aabb: {} }], collider: null }, interiorBuilding: building };
  const api = new Function('S', ...Object.keys(scope), `let interiorCtx = S.interiorCtx, interiorBuilding = S.interiorBuilding;\n${BLOCK}\n
    return { sitAtCardTable, standFromCardTable, cardGameFrame, closeCardGame, cardRegularsNow, get cardGame() { return cardGame; }, get cardSeat() { return cardSeat; } };`)(state, ...Object.values(scope));
  const panel = () => doc.body.children.filter((n) => n.className === 'dfcards' && !n.removed).at(-1);
  const walk = (n, f, out = []) => { if (!n) return out; if (f(n)) out.push(n); for (const c of n.children ?? []) walk(c, f, out); return out; };
  const button = (label) => walk(panel(), (n) => n.tag === 'button' && n.textContent.startsWith(label))[0];
  const press = (label) => { const b = button(label); assert.ok(b, `a "${label}" button`); b.fire('click'); };
  const slider = () => walk(panel(), (n) => n.tag === 'input')[0];
  return { api, doc, playerEntity, said, draws, scenes, panel, button, press, slider, clock };
}

test('AUDIT CARDS-2 the host: a sitting from the purse and back, the buy-in clamped and dealt once, the panel and the cursor and the draw let go', () => {
  const h = host();
  h.api.sitAtCardTable(0);
  assert.ok(h.said.includes('<head>'), 'the seat takes the head (L11)');
  assert.ok(cursorHeld(), 'the panel holds the cursor');
  assert.equal(h.draws.made, 1);
  // the slider to a billion: the most the range allows
  const s = h.slider();
  s.value = '999999999'; s.fire('input');
  h.press('Deal me in');
  const g = h.api.cardGame;
  assert.equal(g.phase, 'playing');
  assert.equal(g.session.seats[0].stack, 1000, 'the buy-in is the chips the player sits with');
  assert.equal(h.playerEntity.goldPieces, 4000, 'and the purse paid it, clamped to the range\'s top');
  assert.equal(g.session.seats.length, 4, 'a regular in every other chair');
  // CARDS4b: the regulars stood in those chairs - seated - and their play voiced over their heads as it comes
  const stood = h.api.cardRegularsNow(0);
  assert.deepEqual(stood.map((r) => r.res.name), g.names);
  assert.ok(stood.every((r) => r.st > 0), 'seated');
  let voiced = false;
  for (let t = 100; t < 30000 && !voiced; t += 100) { h.api.cardGameFrame(t); voiced = h.api.cardRegularsNow(t).some((r) => r.say); }
  assert.ok(voiced, 'a regular says his play');
  // a second deal is refused: no second payment
  g.hud.render(hudm.cardHudModel({ phase: 'buyin', buyIn: g.buyIn, stakes: g.stakes }));
  h.press('Deal me in');
  assert.equal(h.playerEntity.goldPieces, 4000, 'dealt once');
  assert.equal(h.scenes.length, 1, 'one picture for the one session');
  h.api.standFromCardTable();
  assert.equal(h.api.cardGame, null);
  assert.equal(h.playerEntity.goldPieces, 5000, 'every chip back as gold');
  assert.ok(h.said.some((x) => /You leave the table with 1000 gold/.test(x)));
  assert.equal(cursorHeld(), false);
  assert.ok(h.said.includes('<relock>'), 'the look locked again');
  assert.equal(h.draws.destroyed, 1, 'the draw freed with the table');
  assert.equal(h.panel(), undefined, 'the panel gone');
  // a buy-in of nothing sits for the least
  const n = host();
  n.api.sitAtCardTable(0);
  const ns = n.slider(); ns.value = 'nonsense'; ns.fire('input');
  n.press('Deal me in');
  assert.equal(n.api.cardGame.session.seats[0].stack, sess.BUY_IN_MIN_BB * 10);
  n.api.standFromCardTable();
});

test('AUDIT CARDS-2 H1: a load\'s road pays nothing - the chips belonged to the game the load threw away', () => {
  const h = host();
  h.api.sitAtCardTable(0);
  h.press('Deal me in');
  assert.equal(h.playerEntity.goldPieces, 4600);
  h.playerEntity.goldPieces = 5000;   // restorePlayer: the save's purse, the character's again
  const before = structuredClone(h.playerEntity.cardRegulars ?? null);
  h.api.standFromCardTable({ cashOut: false });   // forceExitToExterior({ load: true })'s stand
  assert.equal(h.playerEntity.goldPieces, 5000, 'not a coin more than the save had');
  assert.deepEqual(h.playerEntity.cardRegulars ?? null, before, 'nor the book written for a game that is gone');
  assert.equal(h.api.cardGame, null);
  assert.equal(h.draws.destroyed, 1);
  // the roads: the forced exit says whether it is a load, and the save refuses while chips are on the table
  assert.match(body(WM, 'forceExitToExterior'), /standFromCardTable\(\{ cashOut: !load \}\);/);
  assert.match(WM, /cardTableLive: \(\) => !!cardGame\?\.session && !cardGame\.friendly,/);
  const W = read('src/scenes/world.js');
  assert.match(body(W, 'worldQuickSave'), /if \(modes\?\.cardTableLive\?\.\(\)\) \{ if \(!quiet\) townTalk\.say\('You cannot save with chips on the table\.'\); return false; \}/);
  assert.match(W, /savingPrevented: \(\) => !!naval\?\.saveRefused\?\.\(\) \|\| !!modes\?\.cardTableLive\?\.\(\),/);
});

test('AUDIT CARDS-2 M2: a purse that shrank since the seat is asked again - never emptied by a press it cannot pay', () => {
  const h = host({ gold: 1000 });
  h.api.sitAtCardTable(0);
  h.playerEntity.goldPieces = 150;   // dropped from the inventory while seated
  h.press('Deal me in');
  assert.equal(h.playerEntity.goldPieces, 150, 'the purse untouched');
  assert.equal(h.api.cardGame.session, null);
  assert.equal(h.api.cardGame.buyIn, null, 'the range read again: no longer affordable');
  assert.match(text(h.panel()), /You need 200 gold to sit in/);
  h.api.standFromCardTable();
  assert.equal(h.playerEntity.goldPieces, 150, 'and nothing paid out for a game never dealt');
  // a purse that shrank but still affords the least: the range shrinks with it
  const k = host({ gold: 1000 });
  k.api.sitAtCardTable(0);
  k.playerEntity.goldPieces = 300;
  const s = k.slider(); s.value = '1000'; s.fire('input');
  k.press('Deal me in');
  assert.equal(k.api.cardGame.session.seats[0].stack, 300);
  assert.equal(k.playerEntity.goldPieces, 0);
  k.api.standFromCardTable();
});

test('AUDIT CARDS-2 H2: the regulars from the book and back into it - the same purses at a re-sit, a broke table refused till tomorrow', () => {
  const h = host();
  h.api.sitAtCardTable(0);
  h.press('Deal me in');
  const sat = h.api.cardGame.session.seats.filter((s) => s.kind === 'patron').map((s) => [s.name, s.stack]);
  h.api.standFromCardTable();
  const key = '1111:7:0';
  assert.deepEqual(Object.keys(h.playerEntity.cardRegulars), [key], 'the table\'s key: the town, the building, the table');
  assert.equal(h.playerEntity.cardRegulars[key].day, 0);
  // sitting again today: the same purses
  h.api.sitAtCardTable(0);
  h.press('Deal me in');
  assert.deepEqual(h.api.cardGame.session.seats.filter((s) => s.kind === 'patron').map((s) => [s.name, s.stack]), sat);
  h.api.standFromCardTable();
  // every regular broke today: the deal is refused before the purse is touched
  h.playerEntity.cardRegulars[key].purses = h.playerEntity.cardRegulars[key].purses.map(() => 0);
  const purse = h.playerEntity.goldPieces;
  h.api.sitAtCardTable(0);
  h.press('Deal me in');
  assert.equal(h.api.cardGame.session, null);
  assert.equal(h.playerEntity.goldPieces, purse);
  assert.ok(h.said.some((x) => /regulars have lost their purses for tonight/.test(x)));
  h.api.standFromCardTable();
  // tomorrow they are back
  h.clock.minutes = 1440;
  h.api.sitAtCardTable(0);
  h.press('Deal me in');
  assert.equal(h.api.cardGame.session.seats.length, 4);
  h.api.standFromCardTable();
  assert.equal(h.playerEntity.cardRegulars[key].day, 1);
});

test('AUDIT CARDS-2 the friendly game: chips, never the purse or the book', () => {
  for (const opts of [{ online: true }, { realmAct: () => {} }]) {
    const h = host({ gold: 0, ...opts });
    h.api.sitAtCardTable(0);
    assert.deepEqual(h.api.cardGame.buyIn, { min: sess.BUY_IN_MIN_BB * 10, max: 100 * 10 }, 'a hundred big blinds of chips to play with');
    h.press('Deal me in');
    assert.equal(h.playerEntity.goldPieces, 0);
    h.api.standFromCardTable();
    assert.equal(h.playerEntity.goldPieces, 0, 'nothing back either');
    assert.equal(h.playerEntity.cardRegulars, undefined, 'and no book');
    assert.ok(h.said.includes('You leave the friendly game.'));
  }
});

test('AUDIT CARDS-2 L7, L9: the regulars only in chairs nobody sits in, by the town\'s own names; the cloth seeded by the table', () => {
  const h = host({ seats: 4, peers: [[2, 0, 0]] });   // a player seated in chair 1
  h.api.sitAtCardTable(0);
  assert.deepEqual(h.api.cardSeat.free, [2, 3]);
  assert.equal(h.api.cardGame.names.length, 2, 'two regulars for two free chairs');
  h.press('Deal me in');
  assert.deepEqual(h.scenes[0].o.places.seatOf, [0, 2, 3], 'the cloth\'s seats: mine, then the free chairs');
  assert.equal(h.scenes[0].o.tableSeed, '1111:7:0', 'seeded by the town, the building and the table');
  h.api.standFromCardTable();
  // every other chair taken: no game
  const full = host({ seats: 2, peers: [[2, 0, 0]] });
  full.api.sitAtCardTable(0);
  assert.equal(full.api.cardGame, null);
  assert.ok(full.said.includes('There is no chair left at this table for a regular.'));
  // two towns, one building key: different regulars
  const a = host({ building: { buildingKey: 7, quality: 10, regionIndex: 17, townMapId: 1111 } });
  const b = host({ building: { buildingKey: 7, quality: 10, regionIndex: 17, townMapId: 2222 } });
  a.api.sitAtCardTable(0); b.api.sitAtCardTable(0);
  assert.notDeepEqual(a.api.cardGame.names, b.api.cardGame.names);
  a.api.standFromCardTable(); b.api.standFromCardTable();
});

test('AUDIT CARDS-2 the dead stand up, the evening\'s end is said, fifty sittings leave nothing behind', () => {
  const h = host();
  h.api.sitAtCardTable(0);
  h.press('Deal me in');
  h.playerEntity.health = 0;   // the exhaustion's collapse: past every hurt listener
  h.api.cardGameFrame(100);
  assert.equal(h.api.cardSeat, null, 'stood up');
  assert.equal(h.api.cardGame, null);
  assert.equal(cursorHeld(), false, 'the dead let the cursor go');
  // the evening over: the panel says so and offers the way out
  const o = host({ gold: 400 });
  o.api.sitAtCardTable(0);
  o.press('Deal me in');
  const g = o.api.cardGame;
  g.session.over = 'broke'; g.session.events.push({ t: 'over', why: 'broke', at: 1 });
  o.api.cardGameFrame(2);
  assert.equal(g.phase, 'over');
  assert.ok(o.button('Leave the table'), 'the way out');
  assert.match(text(o.panel()), /You are out of chips\./);
  assert.equal(hudm.cardHudModel({ phase: 'over', why: 'empty', stakes: g.stakes }).message, 'The table has emptied - every patron is broke.');
  assert.equal(hudm.cardHudModel({ phase: 'over', why: 'left', stakes: g.stakes }).message, 'You leave the table.');
  o.api.standFromCardTable();
  assert.equal(cursorHeld(), false, 'the over table lets it go');
  // fifty sit, deal and stand: nothing left
  const c = host();
  for (let i = 0; i < 50; i++) { c.api.sitAtCardTable(0); c.press('Deal me in'); c.api.cardGameFrame(i * 10); c.api.standFromCardTable(); }
  assert.equal(c.doc.body.children.filter((n) => n.className === 'dfcards' && !n.removed).length, 0);
  assert.equal(c.doc.head.children.filter((n) => n.id === 'dfcards-style').length, 1);
  assert.deepEqual([c.draws.made, c.draws.destroyed], [50, 50]);
  assert.equal(cursorHeld(), false);
  assert.equal(c.playerEntity.goldPieces + 0, c.playerEntity.goldPieces, 'a number');
  // the host's other lines: the seat holds the head in the frame, and the regulars' book is written after each hand
  assert.match(WM, /dt, riding: !!player\.riding \|\| !!cardSeat,/);
  assert.match(body(WM, 'cardGameFrame'), /events\.some\(\(e\) => e\.t === 'showdown'\)\) playerEntity\.cardRegulars = regularsAfter\(/);
  // the buy-in's slider pushed to the top never carries into the first raise's: the deal forgets it
  const r = host();
  r.api.sitAtCardTable(0);
  const bs = r.slider(); bs.value = '1000'; bs.fire('input');
  r.press('Deal me in');
  let t = 0;
  while (!r.api.cardGame.session.legal()?.raise && t < 120000) { t += 100; r.api.cardGameFrame(t); }
  const legal = r.api.cardGame.session.legal();
  assert.ok(legal?.raise, 'the player\'s turn with a raise');
  r.api.cardGame.hud.render(hudm.cardHudModel({ phase: 'playing', view: r.api.cardGame.session.view(), legal, stakes: r.api.cardGame.stakes }));
  assert.equal(Number(r.slider().value), legal.raise.min, 'the raise starts at its least');
  // the log says the player's own action in the second person
  r.press(legal.check ? 'Check' : 'Call');
  assert.ok(r.api.cardGame.log.some((l) => /^You (check|call)/.test(l)), r.api.cardGame.log.join(' | '));
  r.api.standFromCardTable();
});

test('AUDIT CARDS-2 the panel\'s log: the player in the second person, a bet, an all-in, the contested pots\' winners with their hands', () => {
  const names = ['Mac', 'Ana', 'Bors'];
  const sd = (pots, payouts, shown = true, hands = {}) => ({ t: 'showdown', seats: [0, 1, 2], result: { shown, pots, payouts, hands } });
  assert.deepEqual([
    { t: 'hand', hand: 3, button: 1 }, { t: 'hand', hand: 4, button: 0 },
    { t: 'act', seat: 2, type: 'raise', to: 40, paid: 30 }, { t: 'act', seat: 0, type: 'raise', to: 20, paid: 20, bet: true },
    { t: 'act', seat: 0, type: 'call', paid: 30 }, { t: 'act', seat: 1, type: 'fold' }, { t: 'act', seat: 0, type: 'check' },
    { t: 'act', seat: 1, type: 'check' }, { t: 'act', seat: 2, type: 'raise', to: 870, paid: 870, allIn: true }, { t: 'act', seat: 0, type: 'call', paid: 90, allIn: true },
    { t: 'street', street: 'turn' }, { t: 'leave', name: 'Bors' }, { t: 'over', why: 'empty' },
  ].map((e) => hudm.eventLine(e, names, 0)), [
    'Hand 3: Ana deals.', 'Hand 4: you deal.', 'Bors raises to 40.', 'You bet 20.', 'You call 30.', 'Ana folds.', 'You check.',
    'Ana checks.', 'Bors goes all in (870).', 'You go all in (90).', 'The turn.', 'Bors is broke and leaves for the night.', 'The table has emptied.',
  ]);
  // A4 / M8: an uncalled bet coming home is nobody's win - Ana shoves 1000, you call all in for 100 and win
  assert.equal(hudm.showdownLine(sd([{ amount: 200, eligible: [0, 1], winners: [0] }, { amount: 900, eligible: [1], winners: [1] }], [200, 900, 0], true, { 0: { cat: 2 } }), names, 0), 'You take the pot with two pair.');
  // a split, a side pot, an uncontested pot
  assert.equal(hudm.showdownLine(sd([{ amount: 90, eligible: [0, 2], winners: [0, 2] }], [45, 0, 45], true, { 0: { cat: 5 }, 2: { cat: 5 } }), names, 0), 'You and Bors split the pot with a flush.');
  assert.equal(hudm.showdownLine(sd([{ amount: 90, eligible: [0, 1, 2], winners: [1] }, { amount: 40, eligible: [0, 2], winners: [2] }], [0, 90, 40], true, { 1: { cat: 6 }, 2: { cat: 1 } }), names, 0), 'Ana takes the pot with a full house. Bors takes a side pot with a pair.');
  assert.equal(hudm.showdownLine(sd([{ amount: 15, eligible: [], winners: [2] }], [0, 0, 15], false), names, 0), 'Bors takes the pot.');
  assert.equal(hudm.HAND_SAID.length, HAND_NAMES.length);
  assert.deepEqual(hudm.showdownWinners(sd([{ amount: 200, eligible: [0, 1], winners: [0] }, { amount: 900, eligible: [1], winners: [1] }], [200, 900, 0], true, { 0: { cat: 2 } })), [{ pot: 0, amount: 200, seats: [0], cat: 2 }]);
});

test('AUDIT CARDS-2 the panel in play and between hands: the buttons the law allows, the seats\' states, the showdown kept', () => {
  const stakes = { sb: 5, bb: 10 };
  const seats = [{ name: 'Mac', kind: 'player', stack: 400 }, { name: 'Ana', kind: 'patron', stack: 300 }, { name: 'Bors', kind: 'patron', stack: 0, gone: true }, { name: 'Cael', kind: 'patron', stack: 200 }];
  const hand = { currentBet: 0, toAct: 0, board: [0, 13, 26], street: 'flop', seats: [
    { stack: 380, bet: 0, total: 20, folded: false, allIn: false, hole: [12, 25] },
    { stack: 0, bet: 0, total: 300, folded: false, allIn: true, hole: null },
    { stack: 180, bet: 0, total: 20, folded: true, allIn: false, hole: null },
  ] };
  const view = { seats, handSeats: [0, 1, 3], button: 1, hand, showdown: null };
  const m = hudm.cardHudModel({ phase: 'playing', view, legal: { check: true, call: 0, raise: { min: 10, max: 380 } }, stakes });
  assert.deepEqual(m.actions.map((a) => a.label), ['Fold', 'Check', 'Bet', 'All in (380)', 'Stand up']);
  assert.deepEqual(m.seats.map((s) => s.state), ['to act', 'all in', 'gone', 'folded']);
  assert.deepEqual(m.seats.map((s) => s.cards.length), [2, 2, 0, 0], 'a folded seat shows no cards; the all-in its backs');
  assert.equal(m.street, 'flop');
  const raised = hudm.cardHudModel({ phase: 'playing', view: { ...view, hand: { ...hand, currentBet: 40 } }, legal: { check: false, call: 40, raise: { min: 80, max: 380 } }, stakes });
  assert.deepEqual(raised.actions.map((a) => a.label), ['Fold', 'Call 40', 'Raise to', 'All in (380)', 'Stand up']);
  const out = hudm.cardHudModel({ phase: 'playing', view: { ...view, handSeats: [1, 3] }, legal: null, stakes });
  assert.equal(out.seats[0].state, 'out', 'a seat not in the hand');
  // the presses: all in is a raise to the stack, the slider's raise its own value
  const doc = fakeDoc();
  const pressed = [];
  const hud = hudm.createCardTableHud({ onPress: (id, v) => pressed.push([id, v]), doc });
  hud.render(raised);
  const nodes = all(hud.root, '');
  const range = nodes.find((n) => n.tag === 'input');
  range.value = '150'; range.fire('input');
  nodes.find((n) => n.tag === 'button' && n.textContent.startsWith('Raise to')).fire('click');
  nodes.find((n) => n.tag === 'button' && n.textContent.startsWith('All in')).fire('click');
  assert.deepEqual(pressed, [['raise', 150], ['raise', 380]]);
  // the keys: a slider's arrow is the slider's; Escape, a step and the activate key are the game's
  const stopped = (key, type) => { let s = false; hud.root.fire('keydown', { key, target: { type }, stopPropagation() { s = true; } }); return s; };
  assert.equal(stopped('ArrowLeft', 'range'), true);
  assert.equal(stopped('Escape', 'range'), false);
  assert.equal(stopped('e', 'range'), false);
  assert.equal(stopped('ArrowLeft', undefined), false, 'off the slider, an arrow walks - and stands you up');
  hud.destroy();
  // between hands the showdown stays: the shown hands, the board, the winner, his line
  const shown = { hand: 7, seats: [0, 1, 3], board: [0, 13, 26, 39, 1], holes: [[12, 25], [11, 24], null], result: { shown: true, pots: [{ amount: 340, eligible: [0, 1], winners: [1] }], payouts: [0, 340, 0], hands: { 1: { cat: 3 } } } };
  const sdm = hudm.cardHudModel({ phase: 'playing', view: { ...view, hand: null, showdown: shown }, legal: null, stakes });
  assert.deepEqual(sdm.seats.map((s) => [s.state, s.cards.length]), [['', 2], ['won', 2], ['gone', 0], ['', 0]]);
  assert.equal(sdm.board.length, 5);
  assert.equal(sdm.pot, 340);
  assert.equal(sdm.street, 'showdown');
  assert.equal(sdm.message, 'Ana takes the pot with three of a kind.');
  // the phone: the panel never wider than the screen less its gutters
  const css = read('src/ui/cardTableHud.js');
  assert.match(css, /box-sizing:border-box;min-width:min\(520px,calc\(100vw - 32px\)\);max-width:min\(760px,calc\(100vw - 32px\)\)/);
  assert.match(css, /import \{ BUY_IN_MIN_BB, BUY_IN_START_BB \} from '\.\.\/systems\/cardTableSession\.js';/);
});
