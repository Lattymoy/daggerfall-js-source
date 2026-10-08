// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 29; Mac: "Lets build every inch of this"): ILIAC
// HAND AT THE TAVERN TABLE, OFFLINE. The regulars' decks (the starter curve, their kind, their grade's upgrades) and
// their play (each play tried on a copy of the game, judged as their own seat sees it); the evening's clock (a thought,
// the commit, the reveal's beat, six turns, for keeps); the forfeits' book (one card a regular a game day); the panel's
// model and its staging (the rules' own refusal said over the view); the cloth's lay and throw; the atlas and its
// plates; and the host's half driven on a fake page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STARTER_DECK, cardById, ILIAC_CARDS, ILIAC_LOCATIONS } from '../src/net/iliacCards.js';
import { newGame, commit, reveal, deckValid, playsRefusal, legalPlays, iliacView, ILIAC_TURNS } from '../src/net/iliacHand.js';
import {
  iliacGrade, ILIAC_GRADE_BANDS, GRADE_TIERS, GRADE_SLIP, ILIAC_TEMPERS, ILIAC_TEMPER_NAMES, TEMPERS_AGREE, GRADE_SWAPS, TEMPER_UPGRADES,
  patronDeck, patronDeckSound, patronPlays, boardScore, forfeitCard, seededUnit, ILIAC_THINK_TRIALS,
} from '../src/systems/iliacPatrons.js';
import { IliacTableSession, ILIAC_THINK_MS, ILIAC_THINK_SPREAD_MS, ILIAC_REVEAL_MS, forfeitsFor, forfeitsAfter, forfeitsBookRestore, FORFEITS_BOOK_MAX } from '../src/systems/iliacTableSession.js';
import { iliacHudModel, stagedRefusal, stagedSpend, viewCostOf, resultLine, prizeLine, createIliacTableHud, TEMPER_WORDS } from '../src/ui/iliacTableHud.js';
import { iliacPlaces, iliacPoses, iliacLanded, ILIAC_THROW_S, ILIAC_HOLD_GAP } from '../src/world/iliacCloth.js';
import { iliacAtlasCell, iliacCellUv, ILIAC_CLOTH_CARDS, ILIAC_CELL_BACK, ILIAC_ATLAS_COLS, ILIAC_ATLAS_ROWS, createIliacTableDraw, iliacCardModel } from '../src/render/iliacTableDraw.js';
import { openIliacTableGame, iliacTemperOf, iliacEventLine } from '../src/scenes/iliacTableGame.js';
import { giveBinderAtChargen, mintIliacCard, collectionOf } from '../src/systems/iliacItems.js';
import { BOSS_CARD_IDS } from '../src/systems/bossCards.js';
import { TEMPER_NAMES } from '../src/systems/cardPatrons.js';
import { fakeDoc, text } from './decorFakes.mjs';
/** Every node under `n`. */
const every = (n, out = []) => { out.push(n); for (const c of n.children ?? []) every(c, out); return out; };

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const src32 = (seed) => { const u = seededUnit(seed); return () => Math.floor(u() * 4294967296); };
const costs = (deck) => deck.map((id) => cardById(id).cost).sort((a, b) => a - b);

test('CARDS10 the grade: the Hold\'em stakes\' own bands of the tavern\'s quality - a village\'s, a town\'s, a city\'s; its tiers and its slips (mutants: the bands; the caps)', () => {
  assert.deepEqual([...ILIAC_GRADE_BANDS], [7, 13]);
  assert.deepEqual([1, 7, 8, 13, 14, 20, 0, 99].map(iliacGrade), [0, 0, 1, 1, 2, 2, 0, 2]);
  assert.deepEqual(GRADE_TIERS.map((t) => ({ ...t })), [{ common: 30, magic: 30 }, { common: 30, magic: 30, rare: 3 }, { common: 30, magic: 30, rare: 4, legendary: 2, aetheric: 1 }]);
  assert.deepEqual([...GRADE_SLIP], [0.25, 0.1, 0]);
  assert.ok(TEMPERS_AGREE, 'one regular, one temper: Hold\'em\'s three names');
  assert.deepEqual([...ILIAC_TEMPER_NAMES], [...TEMPER_NAMES]);
});

test('CARDS10 a regular\'s deck: the starter deck\'s curve card for card, his grade\'s upgrades (a town\'s two, a city\'s Prince and all), his kind traded in; sound for his grade; never an artifact or a boss\'s own; his seed\'s, the same every evening (mutants: the swaps; the upgrades; the Prince\'s place; the tier caps)', () => {
  assert.deepEqual([...GRADE_SWAPS], [6, 3, 2]);
  assert.deepEqual(Object.fromEntries(Object.entries(TEMPER_UPGRADES).map(([k, v]) => [k, [...v]])), {
    tight: ['azura', 'knight-of-the-flame', 'king-gothryd'], loose: ['hircine', 'werewolf', 'orc-shaman', 'dragonling'], bluffer: ['mehrunes-dagon', 'daedroth', 'daedra-seducer', 'wraith'],
  });
  for (const t of ILIAC_TEMPER_NAMES) for (const g of [0, 1, 2]) for (const seed of [1, 77, 123456789]) {
    const d = patronDeck(seed, t, g);
    assert.equal(deckValid(d), null, `${t} ${g} ${seed}: lawful`);
    assert.ok(patronDeckSound(d, g), `${t} ${g}: within its grade's tiers`);
    assert.deepEqual(patronDeck(seed, t, g), d, 'the seed\'s own deck');
    assert.ok(d.every((id) => cardById(id).tier !== 'artifact' && !BOSS_CARD_IDS.includes(id)), 'no artifact, no boss\'s own');
    const prince = TEMPER_UPGRADES[t][0];
    // the curve: the starter's ones and twos, card for card (no upgrade costs less than three); a village's, all of it
    const low = (deckIds) => costs(deckIds).filter((c) => c <= 2);
    assert.deepEqual(low(d), low(STARTER_DECK), 'the starter deck\'s cheap cards, card for card');
    if (g === 0) assert.deepEqual(costs(d), costs(STARTER_DECK), 'a village\'s: the starter deck\'s curve whole');
    if (g === 2) assert.ok(d.includes(prince), `a city's ${t} regular carries ${prince}`);
    else assert.ok(!d.includes(prince), 'no Prince below a city');
    const ups = TEMPER_UPGRADES[t].filter((id) => cardById(id).kind !== 'prince');
    if (g >= 1) for (const up of g === 1 ? ups.slice(0, 2) : ups) if (cardById(up).tier !== 'legendary' || g === 2) assert.ok(d.includes(up), `a ${g === 1 ? 'town' : 'city'}'s ${t} regular: ${up}`);
  }
  assert.notDeepEqual(patronDeck(1, 'loose', 0), patronDeck(2, 'loose', 0), 'two regulars, two decks');
});

test('CARDS10 a regular\'s play: a commit the rules take, built a play at a time from what improves his board; it reads only what his seat sees (the other hand changed, the same plays); a bluffer holds his hand to one play early; never past the trials (mutants: the judge\'s seat; the hold; the slip)', () => {
  const u = seededUnit(5);
  for (let gi = 0; gi < 12; gi++) {
    const temper = ILIAC_TEMPER_NAMES[gi % 3];
    const st = newGame({ decks: [STARTER_DECK.slice(), patronDeck(gi + 1, temper, 2)], rand32: src32(gi + 40) });
    while (!st.over) {
      const plays = patronPlays(st, 1, temper, 2, u);
      assert.equal(playsRefusal(st, 1, plays), null, `${temper}, turn ${st.turn}: a commit the rules take`);
      if (temper === 'bluffer' && st.turn <= ILIAC_TEMPERS.bluffer.hold) assert.ok(plays.length <= 1, 'the bluffer holds his hand');
      // the other hand rearranged: his plays are his own seat's reading, the same
      const other = structuredClone(st);
      other.players[0].hand.reverse();
      other.players[0].deck.reverse();
      assert.deepEqual(patronPlays(other, 1, temper, 2, seededUnit(9)), patronPlays(structuredClone(st), 1, temper, 2, seededUnit(9)), 'what he cannot see changes nothing');
      commit(st, 0, legalPlays(st, 0).slice(0, 1));
      commit(st, 1, plays);
      reveal(st);
    }
  }
  assert.equal(ILIAC_THINK_TRIALS, 400);
  assert.ok(boardScore({ over: true, turn: 7, holdings: [{ power: [5, 1] }, { power: [5, 1] }, { power: [0, 9] }] }, 0, ILIAC_TEMPERS.tight) > 4, 'two holdings held weigh most at the end');
  assert.equal(forfeitCard(['rat', 'giant'], () => 0.99), 'giant');
  assert.equal(forfeitCard([], () => 0), null);
  assert.ok(read('src/systems/iliacPatrons.js').includes('const v = iliacView(copy, p);'), 'judged through his own seat\'s view');
});

test('CARDS10 the evening: the regular thinks, then commits; the turn turns over a beat after both have; six turns, then the result; for keeps the loser pays a card of his deck, a draw nobody, standing up concedes (mutants: the think; the beat; the prize\'s payer; the concession)', () => {
  const deck = patronDeck(3, 'tight', 1);
  const s = new IliacTableSession({ player: { id: 'you', name: 'Ves', deck: STARTER_DECK.slice() }, patron: { id: 'regular:2', name: 'Ana', temper: 'tight', grade: 1, deck }, rand32: src32(11), now: 0, forKeeps: true });
  assert.equal(s.over, null);
  assert.deepEqual(s.drain().map((e) => e.t), ['game']);
  assert.ok(s.thinkAt >= ILIAC_THINK_MS && s.thinkAt < ILIAC_THINK_MS + ILIAC_THINK_SPREAD_MS);
  s.tick(s.thinkAt - 1);
  assert.equal(s.state.players[1].plays, null, 'never before his thought is done');
  s.tick(s.thinkAt);
  assert.ok(s.state.players[1].plays, 'committed');
  assert.equal(s.view().thinking, false);
  assert.equal(s.playerCommit([{ card: 99, holding: 0 }], s.thinkAt), 'hand', 'a refused commit changes nothing');
  let now = s.thinkAt + 10;
  assert.equal(s.playerCommit([], now), null);
  assert.equal(s.revealAt, now + ILIAC_REVEAL_MS);
  s.tick(now + ILIAC_REVEAL_MS - 1);
  assert.equal(s.state.turn, 1, 'the beat first');
  s.tick(now + ILIAC_REVEAL_MS);
  assert.equal(s.state.turn, 2);
  assert.ok(s.drain().some((e) => e.t === 'turn' && e.turn === 2));
  for (let t = 2; t <= ILIAC_TURNS; t++) { now = s.thinkAt; s.tick(now); s.playerCommit([], now); s.tick(now + ILIAC_REVEAL_MS); }
  assert.ok(['won', 'lost', 'draw'].includes(s.over), s.over);
  // a player who passed every turn loses to a regular who played - and for keeps pays a card of his own deck
  assert.equal(s.over, 'lost');
  assert.equal(s.prize.from, 'player');
  assert.ok(STARTER_DECK.includes(s.prize.card));
  const ended = s.drain().find((e) => e.t === 'end');
  assert.deepEqual(ended.prize, s.prize);
  // standing up mid-game concedes - for keeps, his card; for fun, nothing
  const k = new IliacTableSession({ player: { id: 'you', name: 'Ves', deck: STARTER_DECK.slice() }, patron: { id: 'regular:1', name: 'Bors', temper: 'loose', grade: 0, deck: patronDeck(4, 'loose', 0) }, rand32: src32(12), now: 0, forKeeps: true });
  const pz = k.leave(5);
  assert.deepEqual([k.over, pz.from], ['left', 'player']);
  const f = new IliacTableSession({ player: { id: 'you', name: 'Ves', deck: STARTER_DECK.slice() }, patron: { id: 'regular:1', name: 'Bors', temper: 'loose', grade: 0, deck: patronDeck(4, 'loose', 0) }, rand32: src32(12), now: 0 });
  assert.equal(f.leave(5), null);
  const bad = new IliacTableSession({ player: { id: 'you', name: 'Ves', deck: ['rat'] }, patron: { id: 'regular:1', name: 'Bors', temper: 'loose', grade: 0, deck }, rand32: src32(1), now: 0 });
  assert.equal(bad.over, 'refused', 'a deck the rules refuse plays no game');
});

test('CARDS10 the forfeits\' book: a regular pays one card a game day at his tavern; the book keeps FORFEITS_BOOK_MAX taverns, the newest; a save\'s junk restores to nothing (mutants: the day; the bound)', () => {
  let b = forfeitsAfter(null, 't1', 5, 'Ana');
  assert.deepEqual(forfeitsFor(b, 't1', 5), ['Ana']);
  assert.deepEqual(forfeitsFor(b, 't1', 6), [], 'tomorrow he plays for keeps again');
  b = forfeitsAfter(b, 't1', 5, 'Bors');
  b = forfeitsAfter(b, 't1', 5, 'Ana');
  assert.deepEqual(forfeitsFor(b, 't1', 5), ['Ana', 'Bors']);
  for (let i = 0; i < FORFEITS_BOOK_MAX + 3; i++) b = forfeitsAfter(b, `k${i}`, 100 + i, 'X');
  assert.equal(Object.keys(b).length, FORFEITS_BOOK_MAX);
  assert.ok(!('t1' in b), 'the oldest day went first');
  assert.deepEqual(forfeitsBookRestore({ a: { day: 3, paid: ['Ana', 7] }, b: { day: 'x' }, c: null }), { a: { day: 3, paid: ['Ana'] } });
  assert.deepEqual(forfeitsBookRestore([1]), {});
  const save = read('src/systems/save.js');
  assert.match(save, /snap\.iliacForfeits = forfeitsBookRestore\(entity\.iliacForfeits\);/);
  assert.match(save, /entity\.iliacForfeits = forfeitsBookRestore\(snap\.iliacForfeits\);/);
});

test('CARDS10 the staging: stagedRefusal is the rules\' playsRefusal said over the view - every list of plays a hundred seeded positions offer, the same word; the spend is costOf\'s (mutants: the room; the spell\'s holding; the discount)', () => {
  const u = seededUnit(21);
  let checked = 0;
  for (let gi = 0; gi < 25; gi++) {
    const st = newGame({ decks: [patronDeck(gi, 'bluffer', 2), patronDeck(gi + 1, 'tight', 2)], rand32: src32(gi + 7) });
    for (let turn = 0; turn < 4 && !st.over; turn++) {
      const v = iliacView(st, 0);
      const hand = st.players[0].hand.length;
      for (let k = 0; k < 6; k++) {
        const n = Math.floor(u() * 4);
        const plays = Array.from({ length: n }, () => ({ card: Math.floor(u() * (hand + 1)), holding: Math.floor(u() * 3) }));
        assert.equal(stagedRefusal(v, plays), playsRefusal(st, 0, plays), JSON.stringify(plays));
        checked++;
      }
      commit(st, 0, patronPlays(st, 0, 'tight', 2, u)); commit(st, 1, patronPlays(st, 1, 'tight', 2, u)); reveal(st);
    }
  }
  assert.ok(checked > 400);
  // the Mages Guild Hall's discount, read off the view
  const st = newGame({ decks: [STARTER_DECK.slice(), STARTER_DECK.slice()], rand32: src32(3), locations: ['mages-guild-hall', 'castle-daggerfall', 'wayrest'] });
  const v = iliacView(st, 0);
  assert.equal(viewCostOf(v, cardById('fireball'), 0), cardById('fireball').cost - 1);
  assert.equal(viewCostOf(v, cardById('fireball'), 2), cardById('fireball').cost);
  const spell = v.players[0].hand.findIndex((c) => cardById(c.id).kind === 'spell');
  if (spell >= 0) assert.equal(stagedRefusal(v, [{ card: spell, holding: 1 }]), 'spell', 'Castle Daggerfall takes no spell');
  assert.equal(stagedSpend(v, []), 0);
});

test('CARDS10 the panel\'s model: the setup (decks with the binder\'s words, the regulars and their tempers, for keeps shut where it cannot be), the turn (holdings, the hand, staging and its targets, the commit\'s word), the end (the result and the prize said) (mutants: each word)', () => {
  const setup = iliacHudModel({ phase: 'setup', setup: { decks: [{ name: 'Starter Deck' }, { name: 'Broken', word: 'A deck holds exactly 30 cards.' }], foes: [{ name: 'Ana', temper: 'tight' }, { name: 'Bors', temper: 'loose', paid: true }], deck: 0, foe: 1, forKeeps: true, keepsOk: false, keepsWhy: 'Bors has paid a card tonight.' }, packPrice: 30 });
  assert.deepEqual(setup.decks.map((d) => [d.name, d.word, d.chosen]), [['Starter Deck', null, true], ['Broken', 'A deck holds exactly 30 cards.', false]]);
  assert.deepEqual(setup.foes.map((f) => [f.name, f.temper, f.paid, f.chosen]), [['Ana', 'careful', false, false], ['Bors', 'reckless', true, true]]);
  assert.deepEqual(setup.keeps, { on: false, enabled: false, why: 'Bors has paid a card tonight.' });
  assert.deepEqual(setup.actions.map((a) => [a.id, a.enabled]), [['deal', true], ['holdem', true], ['pack', true], ['stand', true]]);
  assert.equal(setup.actions[2].label, 'Buy a card pack (30 gold)');
  assert.equal(iliacHudModel({ phase: 'setup', setup: { decks: [], foes: [] } }).message, 'Your binder holds no deck - build one under Holdings, Collections.');
  assert.deepEqual(TEMPER_WORDS, { tight: 'careful', loose: 'reckless', bluffer: 'sly' });
  // the turn
  const s = new IliacTableSession({ player: { id: 'you', name: 'Ves', deck: STARTER_DECK.slice() }, patron: { id: 'regular:2', name: 'Ana', temper: 'tight', grade: 1, deck: patronDeck(3, 'tight', 1) }, rand32: src32(31), now: 0 });
  const v = s.view();
  const one = legalPlays(s.state, 0)[0];
  const m = iliacHudModel({ phase: 'playing', view: v, staged: [], pick: one.card });
  assert.equal(m.holdings.length, 3);
  assert.ok(m.holdings[one.holding].target, 'a holding the picked card can go to is a target');
  assert.equal(m.hand.length, v.players[0].hand.length);
  assert.ok(m.hand[one.card].picked);
  assert.equal(m.actions[0].label, 'Pass this turn');
  const staged = iliacHudModel({ phase: 'playing', view: v, staged: [one], pick: null });
  assert.equal(staged.actions[0].label, 'Commit 1 play');
  assert.equal(staged.holdings[one.holding].staged.length, 1);
  assert.ok(staged.hand[one.card].staged);
  assert.match(staged.message, /^Turn 1 of 6 - your magicka \d+ of 1\.$/);
  assert.equal(m.them.name, 'Ana');
  // the end
  assert.equal(resultLine({ viewer: 0, result: { winner: 0, held: [0, 0, 1], total: [9, 4], by: 'holdings' } }, 'won'), 'You win - 2 of three holdings held.');
  assert.equal(resultLine({ viewer: 0, result: { winner: 1, held: [0, null, 1], total: [7, 8], by: 'power' } }, 'lost'), 'You lose on power, 7 to 8.');
  assert.equal(resultLine({ viewer: 0, result: { winner: null, held: [0, 1, null], total: [5, 5], by: 'draw' } }, 'draw'), 'A draw - 1 holdings each way and 5 power to 5.');
  assert.equal(resultLine(null, 'left'), 'You concede the game.');
  assert.equal(prizeLine({ from: 'patron', card: 'lich' }, 'Ana'), 'Ana pays you a card: Lich.');
  assert.equal(prizeLine({ from: 'player', card: 'rat' }, 'Ana'), 'Ana takes a card from your deck: Rat.');
  assert.equal(prizeLine(null), '');
});

test('CARDS10 the cloth: the holdings in a row square to the players\' line, each side toward its owner, every card read from the viewer\'s chair; a card new to the board thrown from its owner\'s edge over ILIAC_THROW_S; the landing book forgets what leaves (mutants: the row; the side; the throw)', () => {
  const frame = { centre: [0, 0.8, 0], halfShort: 0.45, halfLong: 0.7 };
  const P = iliacPlaces(frame, [0, 0, -1], [0, 0, 1], 0);
  const [h0, h1, h2] = [0, 1, 2].map(P.holding);
  assert.ok(Math.abs(h0[2]) < 1e-9 && Math.abs(h2[2]) < 1e-9, 'the row lies across the players\' line');
  assert.ok(Math.abs(Math.abs(h2[0] - h0[0]) - 2 * ILIAC_HOLD_GAP) < 1e-9);
  assert.ok(Math.hypot(h1[0], h1[1] - 0.8005, h1[2]) < 1e-12);
  assert.ok(P.side(1, 0, 0)[2] < 0 && P.side(1, 1, 0)[2] > 0, 'each side toward its owner');
  assert.ok(P.side(1, 0, 1)[1] > P.side(1, 0, 0)[1], 'each card a little over the one before');
  assert.ok(Math.abs(P.yaw - Math.atan2(0, 1)) < 1e-9, 'its top away from the viewer');
  // a second chair beside the first still lays its side opposite
  const Q = iliacPlaces(frame, [0, 0, -1], [0.3, 0, -0.9], 0);
  assert.ok(Q.side(0, 1, 0)[2] > 0);
  const view = { holdings: [{ id: 'daggerfall', sides: [[{ uid: 3, id: 'rat', power: 1 }], [{ uid: 40, down: true }]] }, { id: 'sentinel', sides: [[], []] }, { id: 'wayrest', sides: [[], []] }] };
  const landed = iliacLanded(new Map(), view, 10);
  const mid = iliacPoses(view, P, 10 + ILIAC_THROW_S / 2, landed);
  const rat = mid.find((c) => c.uid === 3), down = mid.find((c) => c.uid === 40);
  assert.equal(down.card, null, 'a face-down card is a back');
  assert.ok(rat.pos[1] > P.side(0, 0, 0)[1], 'in its throw, over the cloth');
  const rest = iliacPoses(view, P, 10 + ILIAC_THROW_S, landed).find((c) => c.uid === 3);
  assert.ok(Math.hypot(...rest.pos.map((x, i) => x - P.side(0, 0, 0)[i])) < 1e-12, 'landed where the law says');
  assert.equal(iliacPoses(view, P, 0, iliacLanded(new Map(), view, 0, true)).find((c) => c.uid === 3).pos.join(), P.side(0, 0, 0).join(), 'a settled board is not thrown');
  view.holdings[0].sides[0] = [];
  iliacLanded(landed, view, 11);
  assert.ok(!landed.has(3), 'gone from the board, gone from the book');
  assert.equal(mid.filter((c) => String(c.uid).startsWith('h')).length, 3, 'the holdings drawn');
});

test('CARDS10 the atlas: every card and holding a cell, the back and the stock below; a plate made the first time its card is drawn, every plate and the atlas freed once (EVERY ALLOCATION HAS AN OWNER) (mutants: the cells; the free)', () => {
  assert.equal(ILIAC_CLOTH_CARDS.length, ILIAC_CARDS.length + ILIAC_LOCATIONS.length);
  assert.equal(ILIAC_ATLAS_ROWS, Math.ceil(ILIAC_CLOTH_CARDS.length / ILIAC_ATLAS_COLS) + 1);
  const cells = new Set(ILIAC_CLOTH_CARDS.map((id) => iliacAtlasCell(id).join()));
  assert.equal(cells.size, ILIAC_CLOTH_CARDS.length, 'a cell each');
  assert.deepEqual(iliacAtlasCell('nothing'), [...ILIAC_CELL_BACK]);
  assert.deepEqual(iliacAtlasCell(null), [...ILIAC_CELL_BACK]);
  const [u0, v0, u1, v1] = iliacCellUv([0, 0]);
  assert.ok(u0 > 0 && u1 < 1 / ILIAC_ATLAS_COLS && v1 < 1 && v0 > 1 - 1 / ILIAC_ATLAS_ROWS, 'half a texel in, v up');
  assert.equal(iliacCardModel([0, 0]).subMeshes[0].textureArchive, 'iliac-cards');
  const made = [], freed = [], released = [];
  const own = { measureText: (t) => ({ width: String(t).length * 5 }), getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) };
  const ctx = new Proxy(own, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });   // every other call a no-op
  const doc = { createElement: () => ({ getContext: () => ctx }) };
  const renderer = { createMesh: (m) => { made.push(m); return { m }; }, drawMesh() {}, destroyMesh: (m) => freed.push(m), uploadTexture() {}, releaseTexture: (a, r) => released.push([a, r]) };
  const d = createIliacTableDraw(renderer, { doc });
  d.draw([{ card: 'rat', pos: [0, 0, 0], yaw: 0 }, { card: 'rat', pos: [0, 0, 0], yaw: 0 }, { card: null, pos: [0, 0, 0], yaw: 0 }]);
  assert.equal(d.meshCount(), 2, 'the back and the rat, once');
  d.draw([{ card: 'lich', pos: [0, 0, 0], yaw: 0 }]);
  assert.equal(d.meshCount(), 3);
  d.destroy(); d.destroy();
  assert.equal(freed.length, 3);
  assert.deepEqual(released, [['iliac-cards', 'atlas']]);
  d.draw([{ card: 'rat', pos: [0, 0, 0], yaw: 0 }]);
  assert.equal(made.length, 3, 'nothing made after the end');
});

test('CARDS10 the host\'s half on a fake page: the binder\'s lawful deck and the first regular chosen; Deal plays the regular; a game for keeps won pays his card into the pack and books him; lost, the player\'s card goes; closing mid-game concedes; the interior host\'s wiring (mutants: the defaults; the settle; the book; the concession; the slot)', () => {
  const entity = { name: 'Ves', items: [], goldPieces: 500 };
  giveBinderAtChargen(entity);
  const said = [];
  let now = 0;
  const mk = (over = {}) => openIliacTableGame({
    doc: fakeDoc(), renderer: null, entity, say: (t) => said.push(t), holdCursor: () => () => false, rand32: src32(77), now: () => now,
    day: 9, key: 'tav', grade: 0, friendly: false, regulars: [{ name: 'Ana', seed: 5, chair: 2 }, { name: 'Bors', seed: 6, chair: 3 }],
    frame: { centre: [0, 0.8, 0], halfShort: 0.45 }, mySeatFeet: [0, 0, -1], chairFeet: () => [0, 0, 1], onHoldem: () => said.push('holdem'), onStand: () => said.push('stand'), ...over,
  });
  const game = mk();
  assert.deepEqual([game.g.setup.deck, game.g.setup.foe], [0, 0], 'the starter deck and the first regular, chosen');
  assert.match(text(game.g.hud.root), /Starter Deck/);
  assert.match(text(game.g.hud.root), /Ana \(careful|reckless|sly\)/);
  game.press('keeps');
  game.press('deal');
  assert.equal(game.g.phase, 'playing');
  assert.equal(game.g.session.forKeeps, true);
  assert.equal(game.g.session.seats[1].temper, iliacTemperOf(5));
  assert.match(said.at(-1), /^You deal Iliac Hand with Ana, for a card\.$/);
  assert.ok(game.playing());
  assert.ok(game.staked(), 'a card in play - the save waits');
  // force the end: a win for the player, for keeps
  const s = game.g.session;
  s.over = 'won'; s.prize = { from: 'patron', card: 'lich' };
  game.frame(now += 10);
  assert.equal(game.g.phase, 'over');
  assert.ok(!game.staked(), 'decided, nothing in play');
  assert.equal(collectionOf(entity.items).get('lich'), 1, 'his card into the pack');
  assert.deepEqual(forfeitsFor(entity.iliacForfeits, 'tav', 9), ['Ana'], 'booked: he has paid tonight');
  assert.match(said.at(-1), /^Ana pays you a card: Lich\.$/);
  game.frame(now += 10);
  assert.equal(collectionOf(entity.items).get('lich'), 1, 'once');
  game.press('again');
  assert.equal(game.g.phase, 'setup');
  assert.match(text(game.g.hud.root), /has paid a card tonight/);
  game.close();
  // lost for keeps: the player's card goes; closing mid-game concedes
  const before = collectionOf(entity.items).get('rat');
  const g2 = mk();
  g2.press('foe', 1); g2.press('keeps'); g2.press('deal');
  g2.g.session.prize = { from: 'player', card: 'rat' }; g2.g.session.over = 'lost';
  g2.frame(now += 10);
  assert.equal(collectionOf(entity.items).get('rat'), before - 1, 'the player\'s card goes');
  g2.close();
  // the card lost leaves the starter deck short - no lawful deck until the binder holds thirty again
  const short = mk();
  assert.equal(short.g.setup.deck, null, 'a deck missing a card it names is no deck to deal');
  short.close();
  entity.items.push(mintIliacCard('rat'));
  const g3 = mk();
  g3.press('foe', 1); g3.press('keeps'); g3.press('deal');
  const ratsNow = collectionOf(entity.items).get('rat') ?? 0, total = [...collectionOf(entity.items).values()].reduce((a, b) => a + b, 0);
  g3.close();
  assert.equal([...collectionOf(entity.items).values()].reduce((a, b) => a + b, 0), total - 1, 'standing up from a game for keeps concedes a card');
  assert.ok((collectionOf(entity.items).get('rat') ?? 0) <= ratsNow);
  entity.items.push(mintIliacCard(g3.g.session.prize.card));   // the conceded card back, so the deck deals again
  // a friendly table: the box is shut
  const g4 = mk({ friendly: true });
  g4.press('keeps'); g4.press('deal');
  assert.equal(g4.g.session.forKeeps, false, 'online, the regulars play for fun');
  g4.close({ concede: false });
  assert.equal(iliacEventLine({ t: 'commit', p: 1, n: 0 }, ['You', 'Ana']), 'Ana passes.');
  assert.equal(iliacEventLine({ t: 'game', holdings: ['daggerfall', 'sentinel', 'wayrest'], forKeeps: true }, []), 'The holdings: Daggerfall, Sentinel, Wayrest. For a card.');
  // the interior host
  const w = read('src/scenes/worldModes.js');
  assert.ok(w.includes("    if (id === 'iliac') { openIliacGame(); return; }   // CARDS10: the other game at this table"));
  assert.ok(w.includes('    closeIliacGame({ concede: cashOut });   // CARDS10:'), 'every road off the seat');
  assert.ok(w.includes("    if (mode === 'interior') iliacGame?.frame(performance.now());"), 'the clock under any window');
  assert.ok(w.includes('    iliacGame?.draw(performance.now());   // CARDS10:'), 'the cloth in the room\'s pass');
  assert.ok(w.includes('    iliacStaked: () => !!iliacGame?.staked?.(),'), 'the save waits on a card staked');
  const W = read('src/scenes/world.js');
  assert.ok(W.includes("    if (modes?.iliacStaked?.()) { if (!quiet) townTalk.say('You cannot save with a card staked on the table.'); return false; }"));
  assert.ok(W.includes('|| !!modes?.iliacStaked?.(),'), 'the pause\'s Save too');
  assert.match(w, /function closeIliacGame\(\{ concede = true \} = \{\}\) \{\s*const ig = iliacGame;\s*if \(!ig\) return;\s*iliacGame = null;\s*ig\.close\(\{ concede \}\);/, 'THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD');
  assert.ok(w.includes("friendly: !!host.realmAct || isOnlinePage(),"), 'a realm character or an online page: for fun');
});

test('CARDS10 the painted panel: presses handed back, never reaching the game; a hand card, a holding, a staged card; gone once', () => {
  const doc = fakeDoc();
  const pressed = [];
  const hud = createIliacTableHud({ onPress: (id, v) => pressed.push([id, v]), doc });
  assert.equal(doc.head.children.filter((c) => c.id === 'dfiliac-style').length, 1);
  const s = new IliacTableSession({ player: { id: 'you', name: 'Ves', deck: STARTER_DECK.slice() }, patron: { id: 'regular:2', name: 'Ana', temper: 'tight', grade: 1, deck: patronDeck(3, 'tight', 1) }, rand32: src32(31), now: 0 });
  const one = legalPlays(s.state, 0)[0];
  hud.render(iliacHudModel({ phase: 'playing', view: s.view(), staged: [], pick: one.card }));
  const nodes = every(hud.root);
  nodes.filter((n) => n.className?.startsWith?.('hold') && n.className.includes('target'))[0].fire('click');
  nodes.filter((n) => n.tag === 'button')[0].fire('click');
  assert.deepEqual(pressed.slice(0, 2), [['hold', one.holding], ['commit', undefined]]);
  for (const t of ['pointerdown', 'mousedown', 'click', 'wheel']) { let stopped = false; hud.root.fire(t, { stopPropagation() { stopped = true; } }); assert.ok(stopped, t); }
  hud.destroy();
  assert.equal(hud.root.removed, true);
});
