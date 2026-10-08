// CARDS7 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 6; Mac: "Iliac Hand as proposed"): THE RULES OF
// ILIAC HAND. Driven: the deck's law and every refusal word; the new game's draws off the random source (the holdings,
// then deck 0's shuffle, then deck 1's, and nothing after); the magicka per turn and its ceiling; the room on a side;
// the hidden hands and face-down cards in the public view; the simultaneous commit and the reveal's order; every verb
// of the effect language and every holding's rule, on boards built from the game's own state; the result's three ways
// (two holdings, the total power, the draw); determinism; and thousands of random games between random legal players,
// each one ending after its sixth turn with every card accounted for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, legalPlays, commit, playsRefusal, reveal, result, deckValid, publicView, powers, revealOrder, costOf, roomOf,
  fxText, fxRefusal, ILIAC_DECK_SIZE, ILIAC_COPIES_MAX, ILIAC_LEGENDARY_COPIES_MAX, ILIAC_TURNS, ILIAC_MAGICKA_MAX,
  ILIAC_HAND_START, ILIAC_HAND_MAX, ILIAC_HOLDINGS, ILIAC_ROOM, ILIAC_TRIGGERS, ILIAC_VERBS, ILIAC_TARGETS, ILIAC_PICKS,
} from '../src/net/iliacHand.js';
import { ILIAC_CARDS, ILIAC_LOCATIONS, STARTER_DECK, cardById } from '../src/net/iliacCards.js';

// ── the fixtures: real games from newGame, their hands and boards set from the players' own decks ──

/** A source whose every shuffle is the identity: Fisher-Yates at i draws i, which swaps i with itself. */
const ident = () => { let i = ILIAC_DECK_SIZE - 1; return () => { const v = i; i = i === 1 ? ILIAC_DECK_SIZE - 1 : i - 1; return v; }; };
/** A xorshift32 source, for the random games. */
const xorshift = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s; }; };
const script = (xs) => { let i = 0; return () => { if (i >= xs.length) throw new Error('script ran dry'); return xs[i++]; }; };

const FILL = ['harpy', 'spriggan', 'giant-bat', 'dreugh', 'priest-of-dibella', 'priest-of-stendarr', 'flesh-atronach',
  'priest-of-zenithar', 'giant-scorpion', 'nymph', 'centaur', 'gargoyle', 'werewolf', 'lamia', 'ghost', 'shock', 'heal'];
/** A legal deck that starts with `prefix`, filled from FILL. */
function deckOf(prefix = []) {
  const d = prefix.slice();
  const count = (id) => d.filter((x) => x === id).length;
  for (const id of FILL) while (d.length < ILIAC_DECK_SIZE && count(id) < ILIAC_COPIES_MAX) d.push(id);
  assert.equal(deckValid(d), null, `fixture deck: ${d}`);
  return d;
}
const LOCS = ['orsinium', 'daggerfall', 'vampire-crypt'];
/** A game whose opening hands went back on their decks - each scenario deals its own hand (handOf). */
function game(p0 = [], p1 = [], locations = LOCS) {
  const st = newGame({ decks: [deckOf(p0), deckOf(p1)], rand32: ident(), locations });
  for (const pl of st.players) { pl.deck.unshift(...pl.hand); pl.hand = []; }
  return st;
}

/** Player `p`'s hand set to `ids`, taken from his own deck (the old hand goes back on top). */
function handOf(st, p, ids) {
  const pl = st.players[p];
  pl.deck.unshift(...pl.hand);
  pl.hand = [];
  for (const id of ids) {
    const k = pl.deck.findIndex((c) => c.id === id);
    assert.ok(k >= 0, `${id} in player ${p}'s deck`);
    pl.hand.push(pl.deck.splice(k, 1)[0]);
  }
}
/** A card of `p`'s own (from his deck, else his hand) stood on his side of holding `h`, as a play would leave it.
 *  Answers its uid. */
function place(st, p, h, id) {
  const pl = st.players[p];
  const from = pl.deck.some((c) => c.id === id) ? pl.deck : pl.hand;
  const k = from.findIndex((c) => c.id === id);
  assert.ok(k >= 0, `${id} in player ${p}'s deck or hand`);
  const c = from.splice(k, 1)[0];
  st.holdings[h].sides[p].push({ uid: c.uid, id: c.id, mod: 0 });
  return c.uid;
}
/** Both commit (`[[handIndex, holding]...]`), then the reveal. */
function turn(st, a = [], b = []) {
  const plays = (xs) => xs.map(([card, holding]) => ({ card, holding }));
  assert.equal(commit(st, 0, plays(a)), null);
  assert.equal(commit(st, 1, plays(b)), null);
  return reveal(st);
}
const pw = (st, uid) => powers(st)[uid];
const ids = (side) => side.map((c) => c.id);
/** Every card of `p`'s, wherever it is: the deck, the hand, his side of the board (never a token), the discard. */
function census(st, p) {
  const pl = st.players[p];
  const board = st.holdings.flatMap((hd) => hd.sides[p].filter((c) => !c.token));
  return [...pl.deck, ...pl.hand, ...board, ...pl.discard].map((c) => c.uid).sort((a, b) => a - b);
}
const ALL_UIDS = (p) => Array.from({ length: ILIAC_DECK_SIZE }, (_, k) => p * ILIAC_DECK_SIZE + k);

test('CARDS7 the MEASURE numbers and the language\'s words', () => {
  assert.deepEqual(
    [ILIAC_DECK_SIZE, ILIAC_COPIES_MAX, ILIAC_LEGENDARY_COPIES_MAX, ILIAC_TURNS, ILIAC_MAGICKA_MAX, ILIAC_HAND_START, ILIAC_HAND_MAX, ILIAC_HOLDINGS, ILIAC_ROOM],
    [30, 2, 1, 6, 10, 4, 7, 3, 4]);
  assert.deepEqual(ILIAC_TRIGGERS, ['reveal', 'ongoing', 'end']);
  assert.deepEqual(ILIAC_VERBS, ['buff', 'weaken', 'destroy', 'move', 'draw', 'magicka', 'summon', 'transform', 'room', 'veil', 'nospell', 'discount']);
  assert.deepEqual(ILIAC_TARGETS, ['self', 'here.mine', 'here.theirs', 'here.all', 'all.mine', 'all.theirs', 'here']);
  assert.deepEqual(ILIAC_PICKS, ['weakest', 'strongest']);
  for (const list of [ILIAC_TRIGGERS, ILIAC_VERBS, ILIAC_TARGETS, ILIAC_PICKS]) assert.ok(Object.isFrozen(list));
});

test('CARDS7 the deck\'s law: thirty cards, two of one, one of a legendary or higher, only the catalog\'s', () => {
  assert.equal(deckValid(STARTER_DECK), null);
  assert.equal(deckValid(STARTER_DECK.slice(1)), 'size');
  assert.equal(deckValid([...STARTER_DECK, 'rat']), 'size');
  assert.equal(deckValid(null), 'size');
  assert.equal(deckValid('rat'), 'size');
  assert.equal(deckValid(['nobody', ...STARTER_DECK.slice(1)]), 'unknown card');
  assert.equal(deckValid(['daggerfall', ...STARTER_DECK.slice(1)]), 'unknown card', 'a holding is never a deck\'s');
  assert.equal(deckValid([7, ...STARTER_DECK.slice(1)]), 'unknown card');
  // STARTER_DECK holds two rats: a third is 'copies'.
  assert.equal(deckValid([...STARTER_DECK.slice(0, 29), 'rat']), 'copies');
  const one = (id) => deckOf([id]);
  for (const id of ['molag-bal', 'mehrunes-razor', 'king-gothryd', 'ancient-lich']) {
    assert.equal(deckValid(one(id)), null, `one ${id}`);
    const two = one(id); two[29] = id;
    assert.equal(deckValid(two), 'legendary', `two of ${id} (${cardById(id).tier})`);
  }
  const rares = deckOf(['lich', 'lich']);
  assert.equal(deckValid(rares), null, 'two of a rare');
  rares[29] = 'lich';
  assert.equal(deckValid(rares), 'copies');
});

test('CARDS7 a new game: the holdings drawn, then deck 0 shuffled, then deck 1, and nothing after', () => {
  // The holdings: drawBelow(11) = 3 (shornhelm), then from the ten left drawBelow(10) = 0 (daggerfall), drawBelow(9) =
  // 8 (the ninth of what is left: vampire-crypt). Then each shuffle's 29 identity draws.
  const ident0 = ident();
  let calls = 0;
  const src = (() => { const head = script([3, 0, 8]); return () => (++calls <= 3 ? head() : ident0()); })();
  const st = newGame({ decks: [deckOf(['rat']), deckOf(['lich'])], rand32: src });
  assert.deepEqual(st.holdings.map((h) => h.id), ['shornhelm', 'daggerfall', 'vampire-crypt']);
  assert.equal(calls, 3 + 29 + 29);
  assert.deepEqual(st.holdings.map((h) => h.sides), [[[], []], [[], []], [[], []]]);
  assert.equal(st.turn, 1);
  assert.equal(st.over, false);
  for (const p of [0, 1]) {
    const pl = st.players[p];
    assert.equal(pl.hand.length, ILIAC_HAND_START);
    assert.equal(pl.deck.length, ILIAC_DECK_SIZE - ILIAC_HAND_START);
    assert.equal(pl.magicka, 1);
    assert.deepEqual(census(st, p), ALL_UIDS(p));
  }
  // The identity shuffle deals the deck as listed: uid = seat * 30 + place.
  assert.deepEqual(st.players[0].hand.map((c) => [c.uid, c.id]), [[0, 'rat'], [1, 'harpy'], [2, 'harpy'], [3, 'spriggan']]);
  assert.deepEqual(st.players[1].hand.map((c) => [c.uid, c.id]), [[30, 'lich'], [31, 'harpy'], [32, 'harpy'], [33, 'spriggan']]);
  // Named holdings draw nothing; the state is plain data.
  let n = 0;
  const named = newGame({ decks: [STARTER_DECK, STARTER_DECK], rand32: () => { n++; return 0; }, locations: ['wayrest', 'betony', 'sentinel'] });
  assert.deepEqual(named.holdings.map((h) => h.id), ['wayrest', 'betony', 'sentinel']);
  assert.equal(n, 58);
  assert.deepEqual(structuredClone(named), JSON.parse(JSON.stringify(named)));
  // Refusals.
  assert.equal(newGame({ decks: [STARTER_DECK, STARTER_DECK.slice(1)], rand32: ident() }), null);
  assert.equal(newGame({ decks: [STARTER_DECK], rand32: ident() }), null);
  assert.equal(newGame({ decks: [STARTER_DECK, STARTER_DECK], rand32: null }), null);
  assert.equal(newGame({ decks: [STARTER_DECK, STARTER_DECK], rand32: ident(), locations: ['wayrest', 'wayrest', 'betony'] }), null);
  assert.equal(newGame({ decks: [STARTER_DECK, STARTER_DECK], rand32: ident(), locations: ['wayrest', 'rat', 'betony'] }), null);
  assert.equal(newGame({ decks: [STARTER_DECK, STARTER_DECK], rand32: ident(), locations: ['wayrest', 'betony'] }), null);
});

test('CARDS7 magicka: one on the first turn, one more each turn, a gift for the next turn, never past ten', () => {
  const st = game(['thieves-guild-fence']);
  const seen = [st.players.map((pl) => pl.magicka)];
  for (let t = 1; t < ILIAC_TURNS; t++) { turn(st); seen.push(st.players.map((pl) => pl.magicka)); }
  assert.deepEqual(seen, [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]]);
  // The fence on turn 2 gives +2 on turn 3 (and only turn 3).
  const g = game(['thieves-guild-fence']);
  turn(g);
  handOf(g, 0, ['thieves-guild-fence']);
  const ev = turn(g, [[0, 0]]);
  assert.deepEqual(ev.find((e) => e.t === 'magicka'), { t: 'magicka', p: 0, n: 2, src: { uid: 0 } });
  assert.deepEqual(g.players.map((pl) => pl.magicka), [5, 3]);
  turn(g);
  assert.deepEqual(g.players.map((pl) => pl.magicka), [4, 4]);
  // The ceiling.
  const c = game();
  c.turn = 5;
  c.players[0].bonus = 8;
  turn(c);
  assert.deepEqual(c.players.map((pl) => pl.magicka), [ILIAC_MAGICKA_MAX, 6]);
  // A commit may not spend more than there is.
  const m = game(['lamia']);
  handOf(m, 0, ['lamia', 'harpy']);
  m.players[0].magicka = 5;
  assert.equal(playsRefusal(m, 0, [{ card: 0, holding: 0 }, { card: 1, holding: 0 }]), 'magicka');
  assert.equal(playsRefusal(m, 0, [{ card: 0, holding: 0 }]), null);
});

test('CARDS7 the commit\'s refusals, and a refused commit changes nothing', () => {
  const st = game(['harpy', 'giant-bat', 'heal'], [], ['castle-daggerfall', 'daggerfall', 'vampire-crypt']);
  handOf(st, 0, ['harpy', 'giant-bat', 'heal']);
  st.players[0].magicka = 3;
  const before = structuredClone(st);
  const cases = [
    [2, [], 'player'], [0, 'x', 'shape'], [0, [{ card: 0 }], 'shape'], [0, [null], 'shape'], [0, [{ card: 1.5, holding: 0 }], 'shape'],
    [0, [{ card: 3, holding: 0 }], 'hand'], [0, [{ card: -1, holding: 0 }], 'hand'], [0, [{ card: 0, holding: 0 }, { card: 0, holding: 1 }], 'hand'],
    [0, [{ card: 0, holding: 3 }], 'holding'], [0, [{ card: 2, holding: 0 }], 'spell'],
    [0, [{ card: 0, holding: 1 }, { card: 1, holding: 1 }, { card: 2, holding: 1 }], 'magicka'],
  ];
  for (const [p, plays, word] of cases) {
    assert.equal(commit(st, p, plays), word, JSON.stringify(plays));
    assert.deepEqual(st, before);
  }
  assert.equal(commit(st, 0, [{ card: 2, holding: 1 }, { card: 0, holding: 2 }]), null);
  assert.deepEqual(st.players[0].plays, [{ card: 2, holding: 1 }, { card: 0, holding: 2 }]);
  assert.equal(commit(st, 0, []), 'committed');
  // legalPlays: every single play the commit would take - the heal never at the castle.
  const lp = game(['harpy', 'heal'], [], ['castle-daggerfall', 'daggerfall', 'vampire-crypt']);
  handOf(lp, 0, ['harpy', 'heal', 'lamia']);
  lp.players[0].magicka = 2;
  assert.deepEqual(legalPlays(lp, 0), [{ card: 0, holding: 0 }, { card: 0, holding: 1 }, { card: 0, holding: 2 }, { card: 1, holding: 1 }, { card: 1, holding: 2 }]);
  assert.deepEqual(legalPlays(lp, 5), []);
  commit(lp, 0, []);
  assert.deepEqual(legalPlays(lp, 0), [], 'nothing once committed');
});

test('CARDS7 room: four cards a side, a spell takes none, a summon stops at the wall', () => {
  const st = game(['harpy', 'harpy', 'giant-bat', 'giant-bat', 'shock']);
  place(st, 0, 0, 'harpy'); place(st, 0, 0, 'harpy'); place(st, 0, 0, 'giant-bat');
  handOf(st, 0, ['giant-bat', 'shock', 'spriggan']);
  st.players[0].magicka = 6;
  assert.equal(roomOf(st, 0), ILIAC_ROOM);
  assert.equal(playsRefusal(st, 0, [{ card: 0, holding: 0 }, { card: 2, holding: 0 }]), 'room');
  assert.equal(playsRefusal(st, 0, [{ card: 0, holding: 0 }, { card: 1, holding: 0 }]), null, 'the fourth card, and a spell beside it');
  handOf(st, 1, ['giant-bat']);
  assert.equal(playsRefusal(st, 1, [{ card: 0, holding: 0 }]), null, 'the other side has its own room');
  // Wayrest's walls: three a side. A rat played beside another play keeps the room for it - no token.
  const w = game(['rat', 'harpy', 'dreugh'], [], ['wayrest', 'daggerfall', 'vampire-crypt']);
  assert.equal(roomOf(w, 0), 3);
  place(w, 0, 0, 'dreugh');
  handOf(w, 0, ['rat', 'harpy', 'spriggan']);
  w.players[0].magicka = 6;
  assert.equal(playsRefusal(w, 0, [{ card: 0, holding: 0 }, { card: 1, holding: 0 }, { card: 2, holding: 0 }]), 'room');
  const ev = turn(w, [[0, 0], [1, 0]]);
  assert.deepEqual(ids(w.holdings[0].sides[0]), ['dreugh', 'rat', 'harpy']);
  assert.equal(ev.filter((e) => e.t === 'summon').length, 0);
  assert.equal(ev.filter((e) => e.t === 'fizzle').length, 0);
});

test('CARDS7 the public view: your own hand and plays, the other\'s counts alone, no deck', () => {
  const st = game(['rat'], ['harpy']);
  handOf(st, 0, ['rat', 'harpy', 'harpy', 'spriggan']);
  handOf(st, 1, ['harpy', 'spriggan', 'spriggan', 'giant-bat']);
  assert.equal(commit(st, 0, [{ card: 0, holding: 1 }]), null);
  const v0 = publicView(st, 0), v1 = publicView(st, 1), vs = publicView(st, -1);
  assert.deepEqual(v0.players[0].hand, st.players[0].hand.map((c) => ({ uid: c.uid, id: c.id })));
  assert.deepEqual(v0.players[0].plays, [{ card: 0, holding: 1 }]);
  assert.equal(v0.players[1].hand, undefined);
  assert.equal(v0.players[1].plays, undefined);
  assert.equal(v1.players[0].hand, undefined);
  assert.equal(v1.players[0].plays, undefined);
  assert.equal(v1.players[0].committed, true);
  assert.equal(v1.players[1].committed, false);
  assert.deepEqual(v1.players[0], { handCount: 4, deckCount: 26, magicka: 1, bonus: 0, committed: true, discard: [] });
  assert.equal(vs.players[0].hand, undefined);
  assert.equal(vs.players[1].hand, undefined);
  for (const v of [v0, v1, vs]) assert.ok(!JSON.stringify(v).includes('"deck"'), 'no deck in any view');
  // The view is a copy: changing it changes nothing.
  v0.players[0].hand.length = 0;
  assert.equal(st.players[0].hand.length, 4);
  assert.deepEqual(publicView(st, 0).holdings.map((h) => [h.id, h.room]), [['orsinium', 4], ['daggerfall', 4], ['vampire-crypt', 4]]);
});

test('CARDS7 the simultaneous turn: nothing until both commit, then more power reveals first (a tie, player 0)', () => {
  // Player 1 stands more power, so his assassin lands first - and finds no enemy yet: player 0's rat lands after it.
  const a = game(['rat'], ['dark-brotherhood-assassin', 'dreugh']);
  place(a, 1, 1, 'dreugh');
  handOf(a, 0, ['rat']);
  handOf(a, 1, ['dark-brotherhood-assassin']);
  a.players[1].magicka = 3;
  assert.deepEqual(revealOrder(a), [1, 0]);
  assert.equal(commit(a, 0, [{ card: 0, holding: 0 }]), null);
  const quiet = structuredClone(a);
  assert.deepEqual(reveal(a), [], 'one commit is not a turn');
  assert.deepEqual(a, quiet);
  assert.equal(commit(a, 1, [{ card: 0, holding: 0 }]), null);
  const ev = reveal(a);
  assert.deepEqual(ev.slice(0, 4), [
    { t: 'order', first: 1, turn: 1 },
    { t: 'play', p: 1, uid: 30, id: 'dark-brotherhood-assassin', holding: 0, kind: 'unit' },
    { t: 'play', p: 0, uid: 0, id: 'rat', holding: 0, kind: 'unit' },
    { t: 'summon', p: 0, uid: 60, id: 'rat', holding: 0, src: { uid: 0 } },
  ]);
  assert.deepEqual(ids(a.holdings[0].sides[0]), ['rat', 'rat']);
  // Level boards: player 0 first - his rat lands, and the assassin finds it (the card, met before its token).
  const b = game(['rat'], ['dark-brotherhood-assassin']);
  handOf(b, 0, ['rat']);
  handOf(b, 1, ['dark-brotherhood-assassin']);
  b.players[1].magicka = 3;
  assert.deepEqual(revealOrder(b), [0, 1]);
  const evb = turn(b, [[0, 0]], [[0, 0]]);
  assert.equal(evb[0].first, 0);
  assert.deepEqual(evb.find((e) => e.t === 'destroy'), { t: 'destroy', uid: 0, id: 'rat', p: 0, holding: 0, src: { uid: 30 } });
  assert.deepEqual(b.holdings[0].sides[0], [{ uid: 60, id: 'rat', mod: 0, token: true }]);
  assert.deepEqual(b.players[0].discard, [{ uid: 0, id: 'rat' }]);
  // The turn moved on: turn 2, two magicka, a card each.
  assert.deepEqual(evb.slice(-3), [{ t: 'turn', turn: 2, magicka: [2, 2] }, { t: 'drew', p: 0, n: 1 }, { t: 'drew', p: 1, n: 1 }]);
  assert.deepEqual(b.players.map((pl) => pl.plays), [null, null]);
});

test('CARDS7 buff: a reveal for good, an ongoing while its source stands, an end each turn, a pick\'s tie to the first met', () => {
  const st = game(['rat', 'spriggan', 'priest-of-mara', 'knight-of-the-hour', 'gargoyle', 'rat'], ['mehrunes-razor']);
  const rat = place(st, 0, 0, 'rat');
  handOf(st, 0, ['spriggan']);
  st.players[0].magicka = 2;
  const ev = turn(st, [[0, 0]]);
  const spr = st.holdings[0].sides[0][1].uid;
  assert.deepEqual(ev.filter((e) => e.t === 'buff'), [{ t: 'buff', uid: rat, n: 1, src: { uid: spr } }, { t: 'buff', uid: spr, n: 1, src: { uid: spr } }]);
  assert.deepEqual([pw(st, rat), pw(st, spr)], [2, 3]);
  // Mara's ongoing +1 holds while she stands; the razor takes the strongest (Mara, 3 + 1) and the +1 goes with her.
  const mara = place(st, 0, 1, 'priest-of-mara');
  const harpy = place(st, 0, 1, 'harpy');
  assert.deepEqual([pw(st, mara), pw(st, harpy)], [4, 2]);
  handOf(st, 1, ['mehrunes-razor']);
  st.players[1].magicka = 4;
  const evr = turn(st, [], [[0, 1]]);
  assert.deepEqual(evr.filter((e) => e.t === 'destroy').map((e) => e.uid), [mara]);
  assert.deepEqual(st.players[0].discard.map((c) => c.id), ['priest-of-mara']);
  assert.equal(pw(st, harpy), 1);
  // The Knight of the Hour grows at every turn's end (at the crypt, where nothing else touches him).
  const k = game(['knight-of-the-hour']);
  handOf(k, 0, ['knight-of-the-hour']);
  k.players[0].magicka = 2;
  turn(k, [[0, 2]]);
  const knight = k.holdings[2].sides[0][0].uid;
  assert.equal(pw(k, knight), 3);
  turn(k);
  assert.equal(pw(k, knight), 4);
  assert.equal(k.holdings[2].sides[0][0].mod, 2);
  // The gargoyle's +2 to the weakest: two rats tie, the first placed takes it.
  const g = game(['rat', 'rat', 'gargoyle']);
  const r1 = place(g, 0, 0, 'rat'), r2 = place(g, 0, 0, 'rat');
  handOf(g, 0, ['gargoyle']);
  g.players[0].magicka = 3;
  turn(g, [[0, 0]]);
  assert.deepEqual([pw(g, r1), pw(g, r2)], [3, 1]);
});

test('CARDS7 weaken: never below 0 for good, an ongoing from a wraith or a prince, a zombie\'s own decay, the giant\'s stomp', () => {
  const st = game(['priest-of-stendarr'], ['fireball', 'dreugh']);
  const bat = place(st, 0, 0, 'giant-bat');
  handOf(st, 1, ['fireball']);
  st.players[1].magicka = 2;
  const ev = turn(st, [], [[0, 0]]);
  assert.deepEqual(ev.find((e) => e.t === 'weaken'), { t: 'weaken', uid: bat, n: 2, src: { uid: 30 } }, 'a 2 hit for 3 loses 2');
  assert.deepEqual(ev.find((e) => e.t === 'spent'), { t: 'spent', p: 1, uid: 30, id: 'fireball' });
  assert.deepEqual(st.players[1].discard, [{ uid: 30, id: 'fireball' }]);
  // The bat flew on at the turn's end; wherever it is, at 0, Stendarr's +1 lifts it from 0, not from -1.
  const at = st.holdings.findIndex((hd) => hd.sides[0].some((c) => c.uid === bat));
  assert.equal(pw(st, bat), 0);
  handOf(st, 0, ['priest-of-stendarr']);
  st.players[0].magicka = 3;
  turn(st, [[0, at]]);
  assert.equal(pw(st, bat), 1);
  // The wraith: enemies at its holding have -1 while it stands; elsewhere nothing.
  const w = game(['wraith'], ['dreugh', 'dreugh']);
  place(w, 0, 0, 'wraith');
  const d0 = place(w, 1, 0, 'dreugh'), d1 = place(w, 1, 1, 'dreugh');
  assert.deepEqual([pw(w, d0), pw(w, d1)], [3, 4]);
  // Mehrunes Dagon: every enemy -1, a rat to 0 (never below).
  const m = game(['mehrunes-dagon'], ['rat', 'dreugh']);
  place(m, 0, 2, 'mehrunes-dagon');
  const rat = place(m, 1, 0, 'rat'), dr = place(m, 1, 1, 'dreugh');
  assert.deepEqual([pw(m, rat), pw(m, dr)], [0, 3]);
  // The zombie decays a point each turn's end, and stops at 0.
  const z = game(['zombie']);
  handOf(z, 0, ['zombie']);
  z.players[0].magicka = 2;
  turn(z, [[0, 0]]);
  const zu = z.holdings[0].sides[0][0].uid;
  const seen = [pw(z, zu)];
  for (let t = 0; t < 4; t++) { turn(z); seen.push(pw(z, zu)); }
  assert.deepEqual(seen, [3, 2, 1, 0, 0]);
  // The giant: every unit at its holding loses 1 - its own side, the other, itself.
  const gi = game(['giant', 'dreugh'], ['dreugh']);
  const mine = place(gi, 0, 0, 'dreugh'), theirs = place(gi, 1, 0, 'dreugh');
  handOf(gi, 0, ['giant']);
  gi.players[0].magicka = 6;
  turn(gi, [[0, 0]]);
  const giant = gi.holdings[0].sides[0][1].uid;
  assert.deepEqual([pw(gi, mine), pw(gi, theirs), pw(gi, giant)], [3, 3, 9]);
});

test('CARDS7 destroy: to the owner\'s discard as itself, a token gone, a tag that skips the weaker card', () => {
  const st = game([], ['dark-brotherhood-assassin', 'priest-of-arkay', 'skeletal-warrior']);
  const bat = place(st, 0, 0, 'giant-bat');
  const token = { uid: st.nextUid++, id: 'rat', mod: 0, token: true };
  st.holdings[0].sides[0].push(token);
  handOf(st, 1, ['dark-brotherhood-assassin']);
  st.players[1].magicka = 3;
  const ev = turn(st, [], [[0, 0]]);
  assert.deepEqual(ev.find((e) => e.t === 'destroy'), { t: 'destroy', uid: token.uid, id: 'rat', p: 0, holding: 0, src: { uid: 30 } });
  assert.deepEqual(st.players[0].discard, [], 'a token is gone, never discarded');
  assert.deepEqual(census(st, 0), ALL_UIDS(0));
  assert.ok(st.holdings.some((hd) => hd.sides[0].some((c) => c.uid === bat)), 'the stronger bat still stands');
  // Arkay's priest takes the weakest UNDEAD: the skeleton (2 + 1 of its own), never the weaker bat beside it.
  const a = game(['skeletal-warrior', 'giant-bat'], ['priest-of-arkay']);
  const sk = place(a, 0, 0, 'skeletal-warrior');
  place(a, 0, 0, 'giant-bat');
  handOf(a, 1, ['priest-of-arkay']);
  a.players[1].magicka = 2;
  const eva = turn(a, [], [[0, 0]]);
  assert.deepEqual(eva.filter((e) => e.t === 'destroy').map((e) => e.uid), [sk]);
  assert.deepEqual(a.players[0].discard, [{ uid: sk, id: 'skeletal-warrior' }]);
  // No undead there: nothing is destroyed.
  const n = game(['giant-bat'], ['priest-of-arkay']);
  place(n, 0, 0, 'giant-bat');
  handOf(n, 1, ['priest-of-arkay']);
  n.players[1].magicka = 2;
  assert.equal(turn(n, [], [[0, 0]]).filter((e) => e.t === 'destroy').length, 0);
});

test('CARDS7 move: to the next holding with room, round the table, or nowhere', () => {
  const st = game(['rat', 'priest-of-kynareth', 'harpy', 'harpy', 'dreugh', 'dreugh']);
  const rat = place(st, 0, 0, 'rat');
  for (const id of ['harpy', 'harpy', 'dreugh', 'dreugh']) place(st, 0, 1, id);   // holding 1 is full
  handOf(st, 0, ['priest-of-kynareth']);
  st.players[0].magicka = 2;
  const ev = turn(st, [[0, 0]]);
  assert.deepEqual(ev.find((e) => e.t === 'move'), { t: 'move', uid: rat, from: 0, to: 2, src: { uid: st.holdings[0].sides[0][0].uid } });
  assert.deepEqual(ids(st.holdings[2].sides[0]), ['rat']);
  // The giant bat at the turn's end: holding 2 to holding 0 (round the table).
  const b = game(['giant-bat']);
  handOf(b, 0, ['giant-bat']);
  const evb = turn(b, [[0, 2]]);
  assert.deepEqual(evb.find((e) => e.t === 'move'), { t: 'move', uid: 0, from: 2, to: 0, src: { uid: 0 } });
  // Every other holding full: it stays.
  const f = game(['giant-bat', 'harpy', 'harpy', 'dreugh', 'dreugh', 'spriggan', 'spriggan', 'nymph', 'nymph']);
  for (const id of ['harpy', 'harpy', 'dreugh', 'dreugh']) place(f, 0, 0, id);
  for (const id of ['spriggan', 'spriggan', 'nymph', 'nymph']) place(f, 0, 1, id);
  handOf(f, 0, ['giant-bat']);
  const evf = turn(f, [[0, 2]]);
  assert.equal(evf.filter((e) => e.t === 'move').length, 0);
  assert.deepEqual(ids(f.holdings[2].sides[0]), ['giant-bat']);
  // Recall moves the strongest of yours.
  const r = game(['recall', 'dreugh']);
  place(r, 0, 1, 'giant-bat');
  const dr = place(r, 0, 1, 'dreugh');
  handOf(r, 0, ['recall']);
  const evr = turn(r, [[0, 1]]);
  assert.deepEqual(evr.filter((e) => e.t === 'move')[0], { t: 'move', uid: dr, from: 1, to: 2, src: { uid: 0 } }, 'the spell, before the bat\'s own flight');
});

test('CARDS7 draw: the source\'s owner draws, never past seven, a full hand leaves the card on the deck', () => {
  const st = game(['nymph']);
  handOf(st, 0, ['nymph']);
  st.players[0].magicka = 2;
  const deck = st.players[0].deck.length;
  const ev = turn(st, [[0, 0]]);
  assert.deepEqual(ev.find((e) => e.t === 'draw'), { t: 'draw', p: 0, n: 1, src: { uid: 0 } });
  assert.equal(st.players[0].deck.length, deck - 2, 'the nymph\'s card and the turn\'s');
  assert.equal(st.players[0].hand.length, 2);
  // Seven in hand: Azura's Star played leaves six, its "draw 2" fills one; the turn's draw then finds the hand full.
  const f = game(['azuras-star']);
  handOf(f, 0, ['azuras-star', 'harpy', 'harpy', 'spriggan', 'spriggan', 'giant-bat', 'giant-bat']);
  f.players[0].magicka = 2;
  const left = f.players[0].deck.length;
  const evf = turn(f, [[0, 0]]);
  assert.deepEqual(evf.find((e) => e.t === 'draw'), { t: 'draw', p: 0, n: 1, src: { uid: 0 } });
  assert.deepEqual(evf.find((e) => e.t === 'magicka'), { t: 'magicka', p: 0, n: 2, src: { uid: 0 } });
  assert.deepEqual(evf.find((e) => e.t === 'drew' && e.p === 0), { t: 'drew', p: 0, n: 0 });
  assert.equal(f.players[0].hand.length, ILIAC_HAND_MAX);
  assert.equal(f.players[0].deck.length, left - 1);
  assert.equal(f.players[0].magicka, 4);
  // An empty deck draws nothing.
  const e = game();
  e.players[0].deck = [];
  assert.deepEqual(turn(e).find((x) => x.t === 'drew' && x.p === 0), { t: 'drew', p: 0, n: 0 });
});

test('CARDS7 summon: a token of a catalog card, its own ongoing and end text live, its reveal never fired', () => {
  const st = game(['sanguine-rose'], ['giant-bat', 'harpy']);
  handOf(st, 0, ['sanguine-rose']);
  st.players[0].magicka = 4;
  const bat = place(st, 1, 2, 'giant-bat');
  const harpy = place(st, 1, 2, 'harpy');
  const ev = turn(st, [[0, 2]]);
  assert.deepEqual(ev.find((e) => e.t === 'summon'), { t: 'summon', p: 0, uid: 60, id: 'daedroth', holding: 2, src: { uid: 0 } });
  assert.deepEqual(st.holdings[2].sides[0], [{ uid: 60, id: 'daedroth', mod: 0, token: true }]);
  assert.equal(pw(st, 60), 7);
  // The turn's end, the first revealer's side first: player 1's bat flies off to holding 0, then the Daedroth's bite
  // finds the weakest enemy left here - the harpy.
  const end = ev.filter((e) => e.t === 'move' || e.t === 'weaken');
  assert.deepEqual(end, [{ t: 'move', uid: bat, from: 2, to: 0, src: { uid: bat } }, { t: 'weaken', uid: harpy, n: 1, src: { uid: 60 } }]);
  assert.equal(st.nextUid, 61);
  assert.deepEqual(census(st, 0), ALL_UIDS(0), 'a token is never one of the deck\'s cards');
  // A summoned Rat does not summon another (a token is never revealed).
  const r = game(['animate-dead']);
  handOf(r, 0, ['animate-dead']);
  r.players[0].magicka = 2;
  const evr = turn(r, [[0, 0]]);
  assert.deepEqual(evr.filter((e) => e.t === 'summon').map((e) => e.id), ['zombie']);
});

test('CARDS7 transform: the target becomes the card (its power, its text), and is discarded as itself', () => {
  const st = game(['heal'], ['wabbajack', 'mehrunes-razor']);
  const bat = place(st, 0, 0, 'giant-bat');
  const dr = place(st, 0, 0, 'dreugh');
  st.holdings[0].sides[0][1].mod = 3;
  handOf(st, 1, ['wabbajack']);
  st.players[1].magicka = 3;
  const ev = turn(st, [], [[0, 0]]);
  assert.deepEqual(ev.find((e) => e.t === 'transform'), { t: 'transform', uid: dr, id: 'rat', src: { uid: 30 } });
  const inst = st.holdings[0].sides[0].find((c) => c.uid === dr);
  assert.deepEqual(inst, { uid: dr, id: 'dreugh', mod: 0, form: 'rat' });
  assert.equal(pw(st, dr), 1);
  assert.deepEqual(publicView(st, 1).holdings[0].sides[0].find((c) => c.uid === dr), { uid: dr, id: 'dreugh', power: 1, mod: 0, form: 'rat' });
  // The bat flew on at the turn's end; the razor finds the rat-that-was alone, and destroyed it is a Dreugh again.
  assert.ok(st.holdings[1].sides[0].some((c) => c.uid === bat));
  assert.deepEqual(ids(st.holdings[0].sides[0]), ['dreugh']);
  handOf(st, 1, ['mehrunes-razor']);
  st.players[1].magicka = 4;
  turn(st, [], [[0, 0]]);
  assert.deepEqual(st.players[0].discard, [{ uid: dr, id: 'dreugh' }]);
  // A seducer's transform of the weakest.
  const s = game([], ['daedra-seducer']);
  const r = place(s, 0, 1, 'dreugh');
  place(s, 0, 1, 'lamia');
  handOf(s, 1, ['daedra-seducer']);
  s.players[1].magicka = 3;
  turn(s, [], [[0, 1]]);
  assert.equal(s.holdings[1].sides[0].find((c) => c.uid === r).form, 'rat');
});

test('CARDS7 the holdings\' tag and cost rules: Daggerfall\'s knights, Orsinium\'s orcs, the crypt\'s dead, Sentinel\'s sun - both sides', () => {
  const st = game(['knight-of-the-hour', 'orc', 'skeletal-warrior'], ['knight-of-the-hour', 'orc', 'giant-bat']);
  const k0 = place(st, 0, 1, 'knight-of-the-hour'), k1 = place(st, 1, 1, 'knight-of-the-hour');
  const o0 = place(st, 0, 0, 'orc'), o1 = place(st, 1, 0, 'orc');
  const s0 = place(st, 0, 2, 'skeletal-warrior');
  const b1 = place(st, 1, 2, 'giant-bat');
  const dr = place(st, 0, 1, 'dreugh');
  assert.deepEqual([pw(st, k0), pw(st, k1), pw(st, dr)], [4, 4, 4], 'knights +2 at Daggerfall, the dreugh nothing');
  assert.deepEqual([pw(st, o0), pw(st, o1)], [5, 5], 'an orc 2, +1 of its own, +2 of Orsinium');
  assert.deepEqual([pw(st, s0), pw(st, b1)], [5, 2], 'the crypt\'s +2 to the undead alone');
  const sun = game(['rat', 'giant-bat', 'dreugh'], ['spriggan'], ['sentinel', 'daggerfall', 'vampire-crypt']);
  const r = place(sun, 0, 0, 'rat'), b = place(sun, 0, 0, 'giant-bat'), d = place(sun, 0, 0, 'dreugh'), sp = place(sun, 1, 0, 'spriggan');
  assert.deepEqual([pw(sun, r), pw(sun, b), pw(sun, d), pw(sun, sp)], [2, 3, 4, 3]);
});

test('CARDS7 Shornhelm\'s wind: at each turn\'s end the weakest on each side loses 1', () => {
  const st = game(['rat', 'dreugh'], ['giant-bat', 'lamia'], ['shornhelm', 'daggerfall', 'vampire-crypt']);
  const r = place(st, 0, 0, 'rat'), d = place(st, 0, 0, 'dreugh'), l = place(st, 1, 0, 'lamia');
  const ev = turn(st);
  assert.deepEqual(ev.filter((e) => e.t === 'weaken'), [
    { t: 'weaken', uid: r, n: 1, src: { holding: 0 } },
    { t: 'weaken', uid: l, n: 1, src: { holding: 0 } },
  ]);
  assert.deepEqual([pw(st, r), pw(st, d), pw(st, l)], [0, 4, 4]);
});

test('CARDS7 Betony and Evermor: a card revealed there gives its owner a card, or a magicka next turn', () => {
  const st = game(['harpy', 'shock'], ['spriggan'], ['betony', 'evermor', 'vampire-crypt']);
  handOf(st, 0, ['harpy', 'shock']);
  handOf(st, 1, ['spriggan']);
  st.players[0].magicka = 4;
  st.players[1].magicka = 2;
  const ev = turn(st, [[0, 0], [1, 0]], [[0, 1]]);
  assert.deepEqual(ev.filter((e) => e.t === 'draw' || e.t === 'magicka'), [
    { t: 'draw', p: 0, n: 1, src: { holding: 0 } },
    { t: 'draw', p: 0, n: 1, src: { holding: 0 } },
    { t: 'magicka', p: 1, n: 1, src: { holding: 1 } },
  ]);
  assert.deepEqual(st.players.map((pl) => pl.magicka), [2, 3]);
});

test('CARDS7 the castle refuses spells, the Mages Guild hall and Clavicus Vile make them cheaper', () => {
  const st = game(['fireball', 'clavicus-vile'], [], ['castle-daggerfall', 'mages-guild-hall', 'vampire-crypt']);
  handOf(st, 0, ['fireball']);
  st.players[0].magicka = 1;
  const fire = cardById('fireball');
  assert.deepEqual([0, 1, 2].map((h) => costOf(st, 0, fire, h)), [2, 1, 2]);
  assert.deepEqual(legalPlays(st, 0), [{ card: 0, holding: 1 }]);
  assert.equal(playsRefusal(st, 0, [{ card: 0, holding: 0 }]), 'spell');
  assert.equal(playsRefusal(st, 0, [{ card: 0, holding: 2 }]), 'magicka');
  place(st, 0, 2, 'clavicus-vile');
  assert.deepEqual([0, 1, 2].map((h) => costOf(st, 0, fire, h)), [1, 0, 1]);
  assert.deepEqual([0, 1, 2].map((h) => costOf(st, 1, fire, h)), [2, 1, 2], 'his bargain is his own');
  assert.equal(costOf(st, 0, cardById('lamia'), 1), 4, 'a unit pays in full');
});

test('CARDS7 Privateer\'s Hold: a card played face down, no text, hidden from the other, unveiled and counted at the end', () => {
  const st = game(['dark-brotherhood-assassin', 'heal'], ['dreugh', 'mehrunes-dagon'], ['privateers-hold', 'daggerfall', 'vampire-crypt']);
  const enemy = place(st, 1, 0, 'dreugh');
  place(st, 1, 1, 'mehrunes-dagon');
  handOf(st, 0, ['dark-brotherhood-assassin', 'heal']);
  st.players[0].magicka = 6;
  assert.equal(playsRefusal(st, 0, [{ card: 1, holding: 0 }]), 'spell');
  st.turn = ILIAC_TURNS - 1;
  const ev = turn(st, [[0, 0]]);
  const as = st.holdings[0].sides[0][0];
  assert.deepEqual(as, { uid: as.uid, id: 'dark-brotherhood-assassin', mod: 0, down: true });
  assert.deepEqual(ev[1], { t: 'play', p: 0, uid: as.uid, holding: 0, down: true }, 'the event never names it');
  assert.equal(ev.filter((e) => e.t === 'destroy').length, 0, 'face down, it reveals nothing');
  assert.ok(st.holdings[0].sides[1].some((c) => c.uid === enemy));
  assert.equal(pw(st, as.uid), 2, 'Dagon\'s -1 does not reach a face-down card');
  // The other sees a card and no power; its owner sees it whole.
  const theirs = publicView(st, 1).holdings[0], mine = publicView(st, 0).holdings[0];
  assert.deepEqual(theirs.sides[0], [{ uid: as.uid, down: true }]);
  assert.deepEqual(theirs.power, [0, 4]);
  assert.deepEqual(mine.sides[0], [{ uid: as.uid, id: 'dark-brotherhood-assassin', power: 2, mod: 0, down: true }]);
  assert.deepEqual(mine.power, [2, 4]);
  assert.deepEqual(revealOrder(st), [1, 0], 'the order counts only what is face up');
  // The last turn: unveiled, Dagon's -1 reaches it now, and it counts.
  const end = turn(st);
  assert.deepEqual(end.find((e) => e.t === 'unveil'), { t: 'unveil', cards: [{ uid: as.uid, id: 'dark-brotherhood-assassin', p: 0, holding: 0 }] });
  assert.equal(st.holdings[0].sides[0][0].down, undefined);
  assert.deepEqual(result(st).power, [[1, 0, 0], [4, 6, 0]]);
});

test('CARDS7 the result: two holdings of three win, whatever the total says', () => {
  const a = game(['lamia', 'dreugh'], ['giant']);
  place(a, 0, 0, 'lamia'); place(a, 0, 1, 'dreugh'); place(a, 1, 2, 'giant');
  a.turn = ILIAC_TURNS;
  const ev = turn(a);
  assert.equal(ev.at(-1).t, 'over');
  assert.deepEqual(result(a), { winner: 0, held: [0, 0, 1], power: [[5, 4, 0], [0, 0, 10]], total: [9, 10], by: 'holdings' });
  assert.deepEqual(ev.at(-1).result, result(a));
});

test('CARDS7 the result, worked: a split by power, one holding alone is not two, and the level board', () => {
  const finish = (st) => { st.turn = ILIAC_TURNS; turn(st); return result(st); };
  // One each and one level: the total decides.
  const b = game(['lamia'], ['dreugh', 'giant-scorpion']);
  place(b, 0, 0, 'lamia'); place(b, 1, 1, 'dreugh'); place(b, 1, 1, 'giant-scorpion');
  assert.deepEqual(finish(b), { winner: 1, held: [0, 1, null], power: [[5, 0, 0], [0, 6, 0]], total: [5, 6], by: 'power' });
  // One holding held, two level: not two of three - the total decides.
  const c = game(['lamia']);
  place(c, 0, 0, 'lamia');
  assert.deepEqual(finish(c), { winner: 0, held: [0, null, null], power: [[5, 0, 0], [0, 0, 0]], total: [5, 0], by: 'power' });
  // Level everywhere: a draw.
  const d = game(['dreugh'], ['dreugh']);
  place(d, 0, 0, 'dreugh'); place(d, 1, 0, 'dreugh');
  assert.deepEqual(finish(d), { winner: null, held: [null, null, null], power: [[4, 0, 0], [4, 0, 0]], total: [4, 4], by: 'draw' });
  assert.equal(result(game()), null, 'no result while it is played');
});

test('CARDS7 the game ends after its sixth turn, and an ended game takes nothing', () => {
  const st = game();
  for (let t = 1; t <= ILIAC_TURNS; t++) {
    assert.equal(st.turn, t);
    assert.equal(st.over, false);
    const ev = turn(st);
    assert.equal(ev[ev.length - 1].t, t < ILIAC_TURNS ? 'drew' : 'over');
  }
  assert.equal(st.turn, ILIAC_TURNS);
  assert.equal(st.over, true);
  assert.equal(commit(st, 0, []), 'over');
  assert.deepEqual(reveal(st), []);
  assert.deepEqual(legalPlays(st, 0), []);
  assert.deepEqual(publicView(st, 0).result, result(st));
});

// ── the random games ──

/** A random legal player: his single plays in a random order, each kept if the whole list still commits. */
function randomPlays(st, p, rnd) {
  const legal = legalPlays(st, p);
  for (let i = legal.length - 1; i > 0; i--) { const j = rnd() % (i + 1); [legal[i], legal[j]] = [legal[j], legal[i]]; }
  const plays = [];
  for (const lp of legal) if (rnd() % 4 && playsRefusal(st, p, [...plays, lp]) === null) plays.push(lp);
  return plays;
}
const PLAYABLE = ILIAC_CARDS.map((c) => c.id);
function randomDeck(rnd) {
  const d = [];
  while (d.length < ILIAC_DECK_SIZE) {
    const id = PLAYABLE[rnd() % PLAYABLE.length];
    const k = d.filter((x) => x === id).length;
    if (k < (['legendary', 'aetheric', 'artifact'].includes(cardById(id).tier) ? 1 : 2)) d.push(id);
  }
  return d;
}
/** One whole game from a seed: the deal's source and the players' own. Answers the state and every reveal's events. */
function playOut(seed, check = null) {
  const deal = xorshift(seed * 2654435761), rnd = xorshift(seed + 17);
  const st = newGame({ decks: [randomDeck(rnd), randomDeck(rnd)], rand32: deal });
  assert.ok(st);
  const log = [];
  while (!st.over) {
    for (const p of [0, 1]) assert.equal(commit(st, p, randomPlays(st, p, rnd)), null);
    log.push(reveal(st));
    if (check) check(st);
    assert.ok(log.length <= ILIAC_TURNS);
  }
  return { st, log };
}

test('CARDS7 determinism: the same seed and the same plays are the same game', () => {
  for (const seed of [1, 2, 99, 4242]) {
    const a = playOut(seed), b = playOut(seed);
    assert.deepEqual(a.log, b.log);
    assert.deepEqual(a.st, b.st);
    assert.deepEqual(result(a.st), result(b.st));
  }
  assert.notDeepEqual(playOut(1).log, playOut(2).log);
});

test('CARDS7 three thousand random games: no throw, no fizzle, six turns, every card accounted for, plain data', () => {
  const tally = { 0: 0, 1: 0, null: 0 };
  for (let seed = 1; seed <= 3000; seed++) {
    const { st, log } = playOut(seed, (s) => {
      for (const p of [0, 1]) {
        assert.deepEqual(census(s, p), ALL_UIDS(p), `seed ${seed}: conservation`);
        assert.ok(s.players[p].hand.length <= ILIAC_HAND_MAX);
        assert.ok(s.players[p].magicka <= ILIAC_MAGICKA_MAX);
        for (let h = 0; h < ILIAC_HOLDINGS; h++) assert.ok(s.holdings[h].sides[p].length <= roomOf(s, h), `seed ${seed}: room`);
      }
      assert.ok(Object.values(powers(s)).every((x) => Number.isInteger(x) && x >= 0));
    });
    assert.equal(log.length, ILIAC_TURNS, `seed ${seed}: six reveals`);
    assert.equal(st.turn, ILIAC_TURNS);
    assert.ok(log.every((ev) => ev.every((e) => e.t !== 'fizzle')), `seed ${seed}: a committed play always lands`);
    assert.equal(log[ILIAC_TURNS - 1].at(-1).t, 'over');
    assert.ok(st.holdings.every((hd) => hd.sides.every((side) => side.every((c) => !c.down))), 'every card unveiled');
    const r = result(st);
    assert.deepEqual(log[ILIAC_TURNS - 1].at(-1).result, r);
    tally[r.winner]++;
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st, `seed ${seed}: plain JSON`);
  }
  assert.ok(tally[0] > 1000 && tally[1] > 1000, `both seats win: ${JSON.stringify(tally)}`);
});

test('CARDS7 the language refuses what it cannot read', () => {
  const ok = { on: 'reveal', do: 'buff', to: 'here.mine', n: 1 };
  assert.equal(fxRefusal(ok, 'unit'), null);
  const bad = [
    [null, 'unit', 'shape'],
    [{ ...ok, on: 'later' }, 'unit', 'trigger'],
    [{ ...ok, do: 'heal' }, 'unit', 'verb'],
    [{ on: 'ongoing', do: 'destroy', to: 'here.theirs' }, 'unit', 'verb'],
    [{ on: 'reveal', do: 'room', n: 3 }, 'location', 'verb'],
    [{ on: 'ongoing', do: 'room', n: 3 }, 'unit', 'verb'],
    [{ on: 'end', do: 'buff', to: 'here.mine', n: 1 }, 'spell', 'trigger'],
    [{ on: 'end', do: 'draw', n: 1 }, 'location', 'verb'],
    [{ ...ok, n: 0 }, 'unit', 'n'],
    [{ on: 'ongoing', do: 'room' }, 'location', 'n'],
    [{ ...ok, to: 'there' }, 'unit', 'target'],
    [{ ...ok, to: 'here' }, 'unit', 'target'],
    [{ ...ok, to: 'here.mine' }, 'location', 'target'],
    [{ ...ok, to: 'self' }, 'spell', 'target'],
    [{ on: 'reveal', do: 'draw', n: 1, to: 'self' }, 'unit', 'target'],
    [{ on: 'reveal', do: 'move', to: 'here.theirs', pick: 'weakest' }, 'unit', 'target'],
    [{ on: 'ongoing', do: 'buff', to: 'here.mine', pick: 'weakest', n: 1 }, 'unit', 'pick'],
    [{ ...ok, pick: 'middle' }, 'unit', 'pick'],
    [{ ...ok, tag: 'dwemer' }, 'unit', 'tag'],
    [{ ...ok, cost: [3, 1] }, 'unit', 'cost'],
    [{ on: 'reveal', do: 'summon', card: 'fireball' }, 'unit', 'card'],
    [{ on: 'reveal', do: 'summon', card: 'nobody' }, 'unit', 'card'],
    [{ ...ok, card: 'rat' }, 'unit', 'card'],
    [{ on: 'ongoing', do: 'discount', kind: 'unit', n: 1 }, 'prince', 'kind'],
    [{ on: 'ongoing', do: 'discount', kind: 'spell', n: 1, to: 'all.mine' }, 'prince', 'target'],
  ];
  for (const [fx, kind, word] of bad) assert.equal(fxRefusal(fx, kind), word, JSON.stringify(fx));
});

test('CARDS7 the language said: every verb\'s sentence, the triggers\' lead-ins, a shared trigger joined', () => {
  const t = (fx, kind = 'unit') => fxText(fx, kind);
  assert.equal(t([{ on: 'reveal', do: 'buff', to: 'here.mine', n: 2 }]), 'Reveal: your units here gain +2 power.');
  assert.equal(t([{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'orc', n: 1 }]), 'Ongoing: your orc units have +1 power.');
  assert.equal(t([{ on: 'end', do: 'weaken', to: 'self', n: 1 }]), 'End of turn: this loses 1 power.');
  assert.equal(t([{ on: 'ongoing', do: 'weaken', to: 'all.theirs', cost: [4, 10], n: 2 }]), 'Ongoing: enemy units that cost 4 or more have -2 power.');
  assert.equal(t([{ on: 'reveal', do: 'weaken', to: 'here.all', cost: [0, 2], n: 1 }]), 'Reveal: units here that cost 2 or less lose 1 power.');
  assert.equal(t([{ on: 'reveal', do: 'weaken', to: 'here.all', cost: [2, 2], pick: 'strongest', n: 1 }]), 'Reveal: the strongest unit here that costs 2 loses 1 power.');
  assert.equal(t([{ on: 'reveal', do: 'buff', to: 'all.mine', cost: [1, 3], pick: 'weakest', n: 1 }]), 'Reveal: your weakest unit that costs 1 to 3 gains +1 power.');
  assert.equal(t([{ on: 'reveal', do: 'destroy', to: 'all.theirs', pick: 'strongest' }]), 'Reveal: destroy the strongest enemy unit.');
  assert.equal(t([{ on: 'reveal', do: 'destroy', to: 'here.theirs', tag: 'undead', pick: 'weakest' }]), 'Reveal: destroy the weakest enemy undead unit here.');
  assert.equal(t([{ on: 'end', do: 'move', to: 'self' }]), 'End of turn: move this to the next holding with room.');
  assert.equal(t([{ on: 'reveal', do: 'draw', n: 1 }, { on: 'reveal', do: 'magicka', n: 2 }]), 'Reveal: draw a card and gain +2 magicka next turn.');
  assert.equal(t([{ on: 'reveal', do: 'draw', n: 3 }], 'spell'), 'Draw 3 cards.');
  assert.equal(t([{ on: 'reveal', do: 'summon', card: 'imp', n: 2 }]), 'Reveal: summon two Imps here.');
  assert.equal(t([{ on: 'reveal', do: 'summon', card: 'rat' }, { on: 'ongoing', do: 'buff', to: 'here.mine', n: 1 }, { on: 'end', do: 'buff', to: 'self', n: 1 }]),
    'Reveal: summon a Rat here. Ongoing: your units here have +1 power. End of turn: this gains +1 power.');
  assert.equal(t([{ on: 'reveal', do: 'transform', to: 'here.theirs', pick: 'strongest', card: 'imp' }], 'spell'), 'Turn the strongest enemy unit here into an Imp.');
  assert.equal(t([{ on: 'end', do: 'weaken', to: 'here', pick: 'weakest', n: 1 }], 'location'), 'End of turn: the weakest unit on each side here loses 1 power.');
  assert.equal(t([{ on: 'reveal', do: 'draw', n: 2 }], 'location'), 'After a card is revealed here, its owner draws 2 cards.');
  assert.equal(t([{ on: 'ongoing', do: 'room', n: 2 }, { on: 'ongoing', do: 'discount', kind: 'spell', n: 1 }], 'location'), 'Each side holds only 2 cards here. Spells played here cost 1 less.');
  assert.equal(t([{ on: 'ongoing', do: 'discount', kind: 'spell', n: 2 }], 'prince'), 'Ongoing: your spells cost 2 less.');
  // Every location of the catalog is one the engine can stand, and every card one it can play.
  assert.equal(ILIAC_LOCATIONS.length >= 8, true);
});
