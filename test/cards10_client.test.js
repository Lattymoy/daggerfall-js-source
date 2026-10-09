// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 33): ILIAC HAND ONLINE, THE CLIENT'S HALF. Driven:
// the relay's table as this client sees it (systems/iliacRemoteTable.js) - my own view while I play, the spectator's
// while I watch, the last board kept after the end until the next deal, the relay's clock through its skew; the ranked
// results' carrier (net/iliacClaims.js) - kept, offered, let go on an answer that settles it, kept on one that does not,
// only mine; and the host's half online (scenes/iliacTableGame.js) on two fake pages over the relay's own pure table: a
// look on opening, a sit with the chosen deck, the wait, the deal, a turn staged and committed through the panel, a
// third watching, a stand conceding at the relay, ranked with the realm's order asked first, and the regulars instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newIliacTable, iliacSit, iliacStand, iliacCommit, iliacTick, iliacLook, validIliacIn, ILIAC_FIRST_MS, ILIAC_TURN_MS } from '../src/net/iliacTable.js';
import { mintIliacReceipt } from '../src/net/iliacReceipt.js';
import { RemoteIliacTable } from '../src/systems/iliacRemoteTable.js';
import { createIliacClaims, iliacClaimVerdict, ILIAC_CLAIMS_KEY, ILIAC_CLAIM_RETRY_MS } from '../src/net/iliacClaims.js';
import { openIliacTableGame, iliacOnlineLine, lastLineOf, ILIAC_ONLINE_REFUSALS } from '../src/scenes/iliacTableGame.js';
import { iliacHudModel, boardLines } from '../src/ui/iliacTableHud.js';
import { giveBinderAtChargen } from '../src/systems/iliacItems.js';
import { STARTER_DECK, cardById } from '../src/net/iliacCards.js';
import { ILIAC_TURNS } from '../src/net/iliacHand.js';
import { fakeDoc, text } from './decorFakes.mjs';

const { subtle } = globalThis.crypto;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const seeded = (seed = 99) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };
const DECK = [...STARTER_DECK];

/** The relay's own pure table, its frames stamped as the relay stamps them and handed to each client by id. */
function fakeRelay() {
  const t = newIliacTable({ chairs: 4 });
  const clients = new Map();
  let clock = 1e12;
  const rand = seeded(5);
  const deliver = (msgs) => { for (const { to, frame } of msgs) for (const [id, c] of clients) if (to == null || to === id) c({ t: 'iliac', table: 0, now: clock, ...frame }); };
  const refuse = (id, error) => clients.get(id)?.({ t: 'iliac', table: 0, now: clock, error });
  const word = (id, w, sub = null) => {
    const v = validIliacIn(w);
    if (!v) return false;
    let r;
    if (v.op === 'look') r = iliacLook(t, id);
    else if (v.op === 'sit') r = iliacSit(t, { id, name: id.toUpperCase(), chair: v.chair, deck: v.deck, now: clock, sub: v.order ? sub : null });
    else if (v.op === 'commit') r = iliacCommit(t, { id, plays: v.plays, now: clock });
    else r = iliacStand(t, { id, now: clock });
    if (typeof r === 'string') refuse(id, r); else deliver(r);
    return true;
  };
  return { t, clients, word, tick: (ms) => { clock += ms; deliver(iliacTick(t, clock, rand)); }, now: () => clock };
}

test('CARDS10 the relay\'s table as this client sees it: my view while I play, the spectator\'s while I watch, the last board kept till the next deal, the clock through the skew', () => {
  const t = newIliacTable({ chairs: 4 });
  const me = new RemoteIliacTable({ myId: 'a' }), watcher = new RemoteIliacTable({ myId: 'z' });
  const feed = (msgs, now = 1000) => { for (const { to, frame } of msgs) { if (to == null || to === 'a') me.apply({ table: 0, now, ...frame }, now - 50); if (to == null || to === 'z') watcher.apply({ table: 0, now, ...frame }, now - 50); } };
  feed(iliacSit(t, { id: 'a', name: 'Ann', chair: 0, deck: DECK, now: 0 }));
  assert.equal(me.seat(), 0); assert.equal(watcher.seat(), -1);
  assert.equal(me.waiting(), true, 'alone: waiting');
  assert.equal(me.view(), null, 'no game on the cloth');
  feed(iliacSit(t, { id: 'b', name: 'Bob', chair: 2, deck: DECK, now: 0 }));
  feed(iliacTick(t, ILIAC_FIRST_MS, seeded(3)));
  assert.equal(me.view().viewer, 0); assert.equal(me.view().players[0].hand.length, 4, 'my own hand');
  assert.equal(watcher.view().viewer, -1); assert.equal(watcher.view().players[0].hand, undefined, 'the watcher none');
  assert.deepEqual(me.view().names, ['Ann', 'Bob']);
  assert.equal(me.skew, 50);
  assert.equal(me.clockLeft(ILIAC_FIRST_MS - 50), ILIAC_TURN_MS / 1000, 'the relay\'s clock, read through the skew');
  let now = ILIAC_FIRST_MS;
  for (let turn = 1; turn <= ILIAC_TURNS; turn++) { feed(iliacCommit(t, { id: 'a', plays: [], now })); feed(iliacCommit(t, { id: 'b', plays: [], now: now + 1 })); now += 2; }
  assert.equal(me.state.game, null, 'the game is over');
  assert.equal(me.view()?.over, true, 'my last board kept');
  // PIN MOVED (AUDIT CARDS-6 C9): the watcher keeps the last board too (the relay's `last.view`, the spectator's) - it went
  // with the game, so a watcher never saw the last reveal
  assert.equal(watcher.view()?.over, true, 'the watcher\'s last board kept');
  assert.equal(watcher.view().viewer, -1, 'a spectator\'s');
  feed(iliacTick(t, now + 60000, seeded(4)));
  assert.equal(me.view().over, false, 'the next game deals a new board');
  assert.equal(me.mine.gameNo, 2);
  me.apply({ table: 0, error: 'taken' }, 0);
  assert.equal(me.error, 'taken');
  me.apply({ table: 0, receipt: 'i1.x.y' }, 0);
  assert.deepEqual(me.receipts, ['i1.x.y']);
});

test('CARDS10 the ranked results\' carrier: kept and offered at once, let go once settled, kept on an answer that does not settle, offered again on its clock, only mine (mutants: the verdict; the account)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  let nowS = 1_800_000_000, nowMs = nowS * 1000;
  const mk = (j, f = ['acct-me', 'acct-you']) => mintIliacReceipt({ j, f, r: 0, h: 'holdings' }, kp.privateKey, { subtle, nowS });
  const store = new Map();
  const asked = [];
  let answer = { ok: true, data: { recorded: true, rated: true, rating: 1016, delta: 16 } };
  const counted = [];
  const c = createIliacClaims({ claim: async (r) => { asked.push(r); return answer; }, store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, nowS: () => nowS, nowMs: () => nowMs, me: () => 'acct-me', onCounted: (d) => counted.push(d) });
  assert.equal(c.tick(), false, 'nothing kept: nothing offered (the account seen)');
  const r1 = await mk('00000000000000a1');
  assert.equal(c.add(r1), true);
  await c.flush();
  assert.equal(asked.length, 1);
  assert.equal(counted.length, 1);
  assert.deepEqual(store.get(ILIAC_CLAIMS_KEY), [], 'settled, let go');
  assert.equal(c.add(r1), false, 'a settled one is not kept again');
  // the network: kept, and offered again only on its clock
  answer = { ok: false, error: 'offline' };
  const r2 = await mk('00000000000000a2');
  c.add(r2); await c.flush();
  assert.deepEqual(store.get(ILIAC_CLAIMS_KEY), [r2], 'kept');
  assert.equal(c.tick(), false, 'not due');
  nowMs += ILIAC_CLAIM_RETRY_MS;
  answer = { ok: true, data: { recorded: false, why: 'claimed' } };
  assert.equal(c.tick(), true);
  await c.flush();
  assert.deepEqual(store.get(ILIAC_CLAIMS_KEY), [], 'counted before - let go');
  // another's: kept but never offered by this account
  const theirs = await mk('00000000000000a3', ['acct-you', 'acct-them']);
  const before = asked.length;
  c.add(theirs); await c.flush();
  assert.equal(asked.length, before, 'not mine to carry');
  // the verdicts
  assert.equal(iliacClaimVerdict({ ok: true, data: { why: 'guest' } }), 'keep', 'a guest may still register');
  assert.equal(iliacClaimVerdict({ ok: false, error: 'receipt', why: 'expired' }), 'done');
  assert.equal(iliacClaimVerdict({ ok: false, error: 'receipt', why: 'signature' }), 'keep', 'a key the service can mend');
  // an unsigned one is never kept
  assert.equal(c.add(await mintIliacReceipt({ j: '00000000000000a4', f: ['acct-me', 'acct-you'], r: 0, h: 'power' }, null, { subtle, nowS })), false);
});

test('CARDS10 online on two fake pages over the relay\'s table: a look on opening, the deck sat, the wait, the deal, a turn through the panel, a third watching, a stand conceding at the relay (mutants: the look; the sit\'s deck; the commit; the stand)', () => {
  const R = fakeRelay();
  const said = [];
  const page = (id, { ranked = null, vouch = null, regulars = [] } = {}) => {
    const entity = { name: id, items: [], goldPieces: 100 };
    giveBinderAtChargen(entity);
    const doc = fakeDoc();
    // the network: a frame the relay answers while the page is still opening reaches it once it has opened
    let game = null;
    const early = [];
    R.clients.set(id, (f) => (game ? game.relay(f) : early.push(f)));
    game = openIliacTableGame({
      doc, renderer: null, entity, say: (t) => said.push(t), holdCursor: () => () => false, rand32: seeded(9), now: () => 0,
      day: 1, key: 'tav', grade: 0, friendly: true, regulars,
      frame: { centre: [0, 0.8, 0], halfShort: 0.45 }, mySeatFeet: [0, 0, -1], chairFeet: (k) => [k, 0, 1], onHoldem: () => {}, onStand: () => game.close(),
      online: {
        send: (w) => R.word(id, w, `acct-${id}`), myId: () => id, now: () => R.now(), table: 0, chairs: 4, chair: { a: 0, b: 2, z: 3 }[id] ?? 1,
        rankedWhy: () => ranked, vouch: vouch ?? (async () => ({ ok: false })),
      },
    });
    for (const f of early.splice(0)) game.relay(f);
    return { game, doc };
  };
  const A = page('a'), B = page('b');
  // opened before anyone sat: the setup, its deck chosen, the regulars greyed (none), ranked closed with its reason
  assert.equal(A.game.g.phase, 'setup');
  const m0 = iliacHudModel({ phase: 'setup', setup: { decks: [{ name: 'Starter Deck' }], foes: [], deck: 0 }, online: { rankedOk: false, rankedWhy: 'Ranked games are a realm character\'s.', regularsOk: false } });
  assert.deepEqual(m0.actions.map((x) => [x.id, x.enabled]), [['deal', true], ['regulars', false], ['board', true], ['holdem', true], ['stand', true]]);
  assert.deepEqual(m0.ranked, { on: false, enabled: false, why: 'Ranked games are a realm character\'s.' });
  A.game.press('deal');
  assert.equal(A.game.g.phase, 'playing');
  assert.match(text(A.game.g.hud.root), /Waiting for another player to sit down\./);
  assert.deepEqual(R.t.seats[0].deck, DECK, 'the binder\'s deck sat');
  B.game.press('deal');
  R.tick(ILIAC_FIRST_MS);
  assert.equal(A.game.g.remote.view().players[0].hand.length, 4);
  assert.equal(B.game.g.remote.view().viewer, 1);
  assert.ok(A.game.g.log.some((l) => /^The holdings: /.test(l)));
  // a third opens the panel at the table: the look shows the game, watched
  const Z = page('z');
  assert.equal(Z.game.g.phase, 'playing', 'a game under way is watched');
  assert.match(text(Z.game.g.hud.root), /You watch A and B play\./);
  // a turn through the panel: a card picked, a holding taken, committed
  const unitAt = (view) => view.players[0].hand.findIndex((c, i) => cardById(c.id).kind === 'unit' && [0, 1, 2].some((h) => iliacHudModel({ phase: 'playing', view, staged: [], pick: i }).holdings[h].target));
  let v = A.game.g.remote.view();
  for (let k = 0; k < 4 && unitAt(v) < 0; k++) { A.game.press('commit'); B.game.press('commit'); v = A.game.g.remote.view(); }   // both pass till his magicka pays for a unit
  const playable = unitAt(v);
  assert.ok(playable >= 0, 'a unit he can play');
  const turn = R.t.game.turn;
  A.game.press('pick', playable);
  const h = iliacHudModel({ phase: 'playing', view: v, staged: [], pick: playable }).holdings.findIndex((x) => x.target);
  A.game.press('hold', h);
  assert.equal(A.game.g.staged.length, 1);
  A.game.press('commit');
  assert.equal(R.t.game.players[0].plays.length, 1, 'the relay holds his play');
  assert.equal(A.game.g.staged.length, 0, 'his staging spent once the relay says he committed');
  assert.ok(B.game.g.log.includes('A commits.'), 'the other hears that he did');
  B.game.press('commit');   // a pass
  assert.equal(R.t.game.turn, turn + 1);
  assert.ok(A.game.g.landed.size >= 1, 'his card thrown onto the cloth');
  // B stands up: the game conceded at the relay, A told the game is his
  B.game.close();
  assert.equal(R.t.seats[1], null);
  assert.equal(A.game.g.phase, 'over');
  assert.match(text(A.game.g.hud.root), /Your opponent stands up and concedes - the game is yours\./);
  // PIN MOVED (AUDIT CARDS-6 E10): alone, the next game deals for nobody - the winner is told he waits; and the watcher, a
  // chair free, is back at the setup with the end said (he stood in 'over', nothing to press but Leave)
  assert.match(text(A.game.g.hud.root), /Waiting for another player to sit down\./);
  assert.doesNotMatch(text(A.game.g.hud.root), /The next game deals in a moment\./);
  assert.equal(Z.game.g.phase, 'setup');
  assert.match(text(Z.game.g.hud.root), /B concedes - A wins\./);
  A.game.close(); Z.game.close();
  assert.equal(R.t.seats.every((s) => !s), true, 'every road off the seat stands at the relay');
  // the words, said
  assert.equal(iliacOnlineLine({ t: 'commit', seat: 1, timeout: true }, ['Ann', 'Bob'], 0), 'Bob runs out of time and passes.');
  assert.equal(iliacOnlineLine({ t: 'commit', seat: 0, timeout: true }, ['Ann', 'Bob'], 0), 'Your time runs out - you pass.');
  assert.equal(lastLineOf({ winner: null }), 'The game is drawn.');
  assert.equal(lastLineOf({ winner: 1, how: 'power', names: ['Ann', 'Bob'] }), 'Bob beats Ann on power.');
  assert.equal(ILIAC_ONLINE_REFUSALS['other game'], 'Hold\'em is being played at this table.');
});

test('CARDS10 ranked online: the realm\'s order asked first and carried in the sit; a refusal said, no sit; the regulars instead when alone; the host\'s wiring (mutants: the order carried; the regulars; the frames routed)', async () => {
  const R = fakeRelay();
  let asked = 0, answer = { ok: true, order: 'v1.deck.order' };
  const entity = { name: 'a', items: [], goldPieces: 100 };
  giveBinderAtChargen(entity);
  const game = openIliacTableGame({
    doc: fakeDoc(), renderer: null, entity, say: () => {}, holdCursor: () => () => false, rand32: seeded(9), now: () => 0,
    day: 1, key: 'tav', grade: 0, friendly: true, regulars: [{ name: 'Ana', seed: 5, chair: 2 }],
    frame: { centre: [0, 0.8, 0], halfShort: 0.45 }, mySeatFeet: [0, 0, -1], chairFeet: () => [0, 0, 1], onHoldem: () => {}, onStand: () => {},
    online: { send: (w) => R.word('a', w, 'acct-a'), myId: () => 'a', now: () => R.now(), table: 0, chairs: 4, chair: 0, rankedWhy: () => null, vouch: async (deck) => { asked++; assert.equal(deck.length, 30); return answer; } },
  });
  R.clients.set('a', (f) => game.relay(f));
  game.press('ranked');
  assert.equal(game.g.rankedOn, true);
  answer = { ok: false, why: 'Your realm character does not hold every card of that deck (lich).' };
  game.press('deal');
  assert.equal(game.g.busy, true, 'asking the realm');
  await new Promise((r) => setImmediate(r));
  assert.equal(asked, 1);
  assert.equal(R.t.seats[0], null, 'refused: no sit');
  assert.match(text(game.g.hud.root), /does not hold every card of that deck \(lich\)/);
  answer = { ok: true, order: 'v1.deck.order' };
  game.press('deal');
  await new Promise((r) => setImmediate(r));
  assert.equal(R.t.seats[0].sub, 'acct-a', 'the order carried: a ranked seat');
  game.close();
  // alone in the room, the regulars instead: the offline game, friendly
  const solo = openIliacTableGame({
    doc: fakeDoc(), renderer: null, entity, say: () => {}, holdCursor: () => () => false, rand32: seeded(9), now: () => 0,
    day: 1, key: 'tav', grade: 0, friendly: true, regulars: [{ name: 'Ana', seed: 5, chair: 2 }],
    frame: { centre: [0, 0.8, 0], halfShort: 0.45 }, mySeatFeet: [0, 0, -1], chairFeet: () => [0, 0, 1], onHoldem: () => {}, onStand: () => {},
    online: { send: () => true, myId: () => 's', now: () => 0, table: 0, chairs: 4, chair: 0, rankedWhy: () => 'closed', vouch: async () => ({ ok: false }) },
  });
  solo.press('regulars');
  assert.equal(solo.g.mode, 'regulars');
  solo.press('foe', 0);
  solo.press('deal');
  assert.equal(solo.g.phase, 'playing');
  assert.equal(solo.g.session.forKeeps, false, 'online the regulars play for fun');
  solo.relay({ t: 'iliac', table: 0, now: 0, events: [], state: { chairs: 4, gameNo: 0, seats: [null, null], game: null, clockAt: 0, last: null } });
  assert.equal(solo.g.phase, 'playing', 'the relay\'s frames are not the tavern\'s game');
  solo.close();
  // the host's wiring: the frames routed, a receipt carried from any room, the online road at the seat
  const w = read('src/scenes/worldModes.js'), W = read('src/scenes/world.js');
  assert.ok(w.includes("    if (typeof f?.receipt === 'string') host.iliacClaims?.add(f.receipt);   // a result on the board, from any room"));
  assert.ok(w.includes('    iliacGame?.relay?.(f);'));
  assert.ok(w.includes('      online: host.iliacOnline?.ok?.() ? {'));
  assert.ok(W.includes('    online.onIliac = (f) => modes?.iliacOnlineFrame?.(f);'));
  assert.ok(W.includes('    iliacClaims?.tick();'));
  assert.ok(W.includes("call: (realm) => iliacDoor.deck({ character: characterIdOf(playerEntity), realm, deck })"), 'the record checkpointed first, then asked');
});

test('CARDS10 the season board in the panel: asked of the service on a press, its rows and the caller pinned, its #1 or what the title needs, a second press hides it; the service not answering is said (mutants: the press; the pinned row)', async () => {
  const data = {
    ok: true, season: { n: 3, day: 12 }, total: 14,
    rows: [{ rank: 1, name: 'Eira', rating: 1104, wins: 9, losses: 2, draws: 1 }, { rank: 2, name: 'Fen', rating: 1050, wins: 5, losses: 4, draws: 0 }],
    pinned: { rank: 14, name: 'Ves', rating: 984, wins: 1, losses: 3, draws: 0, you: true },
    champion: { player: 'p1', name: 'Eira' }, titleNeeds: { games: 10, foes: 5 }, me: { rating: 984, games: 4 },
  };
  assert.deepEqual(boardLines(data), ['Season 3, day 12.', '1. Eira - 1104 (9-2-1)', '2. Fen - 1050 (5-4-0)', '...', '14. Ves - 984 (1-3-0) - you', 'Iliac Champion: Eira.', 'Your rating 984, 4 games this season.']);
  assert.match(boardLines({ ...data, rows: [], pinned: null, champion: null })[1], /No ranked game has been played this season\./);
  assert.match(boardLines({ ...data, champion: null }).join(' '), /No Iliac Champion yet - the top needs 10 games against 5 different players\./);
  const entity = { name: 'a', items: [], goldPieces: 100 };
  giveBinderAtChargen(entity);
  let answer = { ok: true, data };
  let asked = 0;
  const game = openIliacTableGame({
    doc: fakeDoc(), renderer: null, entity, say: () => {}, holdCursor: () => () => false, rand32: seeded(9), now: () => 0,
    day: 1, key: 'tav', grade: 0, friendly: true, regulars: [],
    frame: { centre: [0, 0.8, 0], halfShort: 0.45 }, mySeatFeet: [0, 0, -1], chairFeet: () => [0, 0, 1], onHoldem: () => {}, onStand: () => {},
    online: { send: () => true, myId: () => 'a', now: () => 0, table: 0, chairs: 4, chair: 0, rankedWhy: () => null, vouch: async () => ({ ok: false }), board: async () => { asked++; return answer; } },
  });
  game.press('board');
  await new Promise((r) => setImmediate(r));
  assert.equal(asked, 1);
  assert.match(text(game.g.hud.root), /Iliac Champion: Eira\./);
  assert.match(text(game.g.hud.root), /Hide the season board/);
  game.press('board');
  assert.equal(game.g.board, null, 'hidden');
  answer = { ok: false, error: 'offline' };
  game.press('board');
  await new Promise((r) => setImmediate(r));
  assert.match(text(game.g.hud.root), /The season board is not answering - try again\./);
  game.close();
});
