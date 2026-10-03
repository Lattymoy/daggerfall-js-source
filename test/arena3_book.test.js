// ARENA3 (2026-10-02; bible/11-Multiplayer/Arena.md "1. The gate" - "the bookmaker - wagers on the bout on the floor
// (gold, house edge, odds from the fighters' records)"): THE BOOKMAKER (systems/arenaBook.js, scenes/arenaGate.js).
// Pinned here: each exhibition fighter's record and strength from the bout's own seed; the chances from the strengths;
// the price shaded by the house's tenth and rounded DOWN the bookmaker's ladder; the payout in whole gold; the wager's
// refusals (no bout, closed, placed, the stake's bounds, the purse); its settlement by the verdict seen, or by the
// house's record once the hour is out (never while its bout stands here), a draw's stake back; the winnings collected
// at the stall; the stall's choice and the stake's; the gate's flow over a real purse; the driver telling the verdict;
// the book through the save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as BK from '../src/systems/arenaBook.js';
import * as LG from '../src/systems/arenaLeague.js';
import { exhibitionFor, newArenaLadder } from '../src/systems/arenaLadder.js';
import { fighterIdentity } from '../src/systems/arenaFighters.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { createArenaGate } from '../src/scenes/arenaGate.js';
import { createArenaBouts } from '../src/scenes/arenaBouts.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { LETTER_OF_CREDIT_TEMPLATE } from '../src/systems/inventory.js';

const START = 523530;
/** Noon of day `d` from the new game's day, and its hour's exhibition. */
const noon = (d = 1) => START - (START % MINUTES_PER_DAY) + d * MINUTES_PER_DAY + 12 * 60;
const exAt = (gm) => exhibitionFor(gm);

test('ARENA3 book: the fighters\' records and strengths from the bout\'s seed; the chances from the strengths', () => {
  const ex = exAt(noon());
  assert.ok(ex && ex.open);
  const a = BK.exhibitionRecord(ex, 0), b = BK.exhibitionRecord(ex, 1);
  assert.deepEqual(BK.exhibitionRecord(ex, 0), a, 'the same bout, the same record');
  for (const r of [a, b]) {
    assert.ok(r.wins >= 0 && r.losses >= 0 && r.wins + r.losses >= 6 && r.wins + r.losses < 36);
    assert.ok(Math.abs(r.form) <= 2);
  }
  const [pa, pb] = BK.exhibitionOdds(ex);
  assert.ok(Math.abs(pa + pb - 1) < 1e-12);
  assert.equal(pa > 0.5, a.strength > b.strength, 'the stronger is the favourite');
  // over many hours the house's record follows its own chances
  let fav = 0, n = 0, draws = 0;
  for (let h = 0; h < 3000; h++) {
    const e = exhibitionFor(START + h * 60);
    if (!e) continue;
    n++;
    const o = BK.houseOutcome(e);
    assert.equal(BK.houseOutcome(e), o, 'the same on every screen');
    if (o === null) { draws++; continue; }
    const p = BK.exhibitionOdds(e);
    if ((p[0] >= p[1] ? 0 : 1) === o) fav++;
  }
  assert.ok(draws / n > 0.01 && draws / n < 0.08, `draws ${draws}/${n}`);
  assert.ok(fav / (n - draws) > 0.55 && fav / (n - draws) < 0.85, `the favourite wins ${fav}/${n - draws}`);
});

test('ARENA3 book: the price - the fair price less the house\'s tenth, rounded down the ladder; the payout in whole gold', () => {
  assert.equal(BK.BOOK_EDGE, 0.1);
  assert.deepEqual(BK.priceFor(0.5), [5, 6], 'an even bout pays 5 to 6 - the house\'s tenth');
  for (let p = 0.02; p < 0.99; p += 0.01) {
    // AUDIT PRE-MERGE 1003 B4: a chance whose shaded price is under his shortest rung is laid no price (null) - this
    // loop let 1 to 5 stand above the shaded fair price there, better than fair; test/audit1003_bouts.test.js pins it
    const pr = BK.priceFor(p);
    if (!pr) { assert.ok((1 / p - 1) * 0.9 < 1 / 5, `${p}: no price only under his shortest rung`); continue; }
    const [num, den] = pr;
    const fair = 1 / p - 1;
    assert.ok(num / den <= fair * 0.9 + 1e-9, `${p}: ${num}/${den} never above the shaded fair price`);
    assert.ok(BK.ODDS_LADDER.some((x) => x[0] === num && x[1] === den), 'on his ladder');
  }
  assert.ok(BK.priceFor(0.2)[0] / BK.priceFor(0.2)[1] > BK.priceFor(0.6)[0] / BK.priceFor(0.6)[1], 'the outsider pays more');
  assert.deepEqual(BK.priceFor(0.81), [1, 5], 'the shortest price he gives');
  assert.equal(BK.priceFor(0.999), null, 'AUDIT PRE-MERGE 1003 B4: and none shorter');
  assert.deepEqual(BK.priceFor(0.001), [10, 1], 'the longest');
  assert.equal(BK.oddsText([1, 1]), 'evens');
  assert.equal(BK.oddsText([7, 4]), '7 to 4');
  assert.equal(BK.payoutFor(100, [7, 4]), 275);
  assert.equal(BK.payoutFor(10, [5, 6]), 18, 'whole gold, rounded down');
  assert.equal(BK.payoutFor(50, [1, 1]), 100);
});

test('ARENA3 book: a wager - refused with its reason; one a bout; settled by the verdict seen, or the house\'s record once the hour is out', () => {
  const gm = noon(2);
  const ex = exAt(gm);
  let book = BK.newArenaBook();
  assert.equal(BK.wagerRefusal(book, null, 50, { gold: 500 }), 'none');
  assert.equal(BK.wagerRefusal(book, { ...ex, open: false }, 50, { gold: 500 }), 'closed');
  assert.equal(BK.wagerRefusal(book, ex, 50, { gold: 500, begun: true }), 'closed', 'the book shuts at the word');
  assert.equal(BK.wagerRefusal(book, ex, 5, { gold: 500 }), 'stake');
  assert.equal(BK.wagerRefusal(book, ex, 1001, { gold: 5000 }), 'stake');
  assert.equal(BK.wagerRefusal(book, ex, 50, { gold: 40 }), 'gold');
  const r = BK.placeWager(book, ex, 1, 100, { gold: 500, gameMinutes: gm });
  assert.equal(r.ok, true);
  assert.equal(r.cost, 100);
  book = r.book;
  const w = book.wagers[0];
  assert.deepEqual([w.hour, w.side, w.stake, w.status], [ex.hour, 1, 100, 'open']);
  assert.deepEqual([w.num, w.den], BK.priceFor(BK.exhibitionOdds(ex)[1]), 'the price at the time it was taken');
  assert.equal(w.names[1], fighterIdentity(ex.seed, 1, ex.opponents[1].mobile).name);
  assert.equal(BK.placeWager(book, ex, 0, 50, { gold: 500 }).reason, 'placed', 'one a bout');
  assert.equal(book.staked, 100);
  // not settled while the hour stands, nor after it while its bout stands here
  assert.equal(BK.settleBook(book, gm + 5).settled.length, 0);
  assert.equal(BK.settleBook(book, gm + 90, { liveHour: ex.hour }).settled.length, 0, 'its bout still on the sand here');
  // the verdict seen: the backed side wins
  const won = BK.settleBook(BK.bookVerdict(book, ex.hour, 1), gm + 10);
  assert.equal(won.settled.length, 1);
  assert.deepEqual([won.book.wagers[0].status, won.book.wagers[0].paid, won.book.wagers[0].seen], ['won', BK.payoutFor(100, [w.num, w.den]), true]);
  assert.equal(won.book.owed, BK.payoutFor(100, [w.num, w.den]));
  assert.equal(won.book.won, won.book.owed - 100);
  // the other side, a draw
  const lost = BK.settleBook(BK.bookVerdict(book, ex.hour, 0), gm + 10).book;
  assert.deepEqual([lost.wagers[0].status, lost.owed, lost.lost], ['lost', 0, 100]);
  const draw = BK.settleBook(BK.bookVerdict(book, ex.hour, null), gm + 10).book;
  assert.deepEqual([draw.wagers[0].status, draw.owed], ['draw', 100], 'a draw returns the stake');
  // unseen: the house's record once the hour is out
  const house = BK.settleBook(book, (ex.hour + 1) * 60).book;
  const o = BK.houseOutcome(ex);
  assert.equal(house.wagers[0].status, o === null ? 'draw' : o === 1 ? 'won' : 'lost');
  assert.equal(house.wagers[0].seen, false);
  assert.equal(BK.settleBook(house, (ex.hour + 5) * 60).settled.length, 0, 'settled once');
  // AUDIT PRE-MERGE 1003 B3: a verdict on a bout nobody backed IS kept now - it shuts that hour's book (this pinned the
  // old drop, which let a wager be taken on a winner already seen; test/audit1003_bouts.test.js pins the new law)
  assert.equal(BK.bookVerdict(BK.newArenaBook(), ex.hour, 0).seen.length, 1, 'a verdict on a bout nobody backed is kept');
  // collected at the stall
  const c = BK.collectWinnings(won.book);
  assert.equal(c.gold, won.book.owed);
  assert.equal(c.book.owed, 0);
  assert.equal(BK.collectWinnings(c.book).gold, 0);
  // the lines
  assert.match(BK.wagerLine(won.book.wagers[0]), /^100 gold on .+ at .+ - won, \d+ gold to collect$/);
  assert.match(BK.wagerLine(book.wagers[0]), / - waiting on the bout$/);
  assert.equal(BK.bookLines({ book: draw }, gm)[0].status, 'draw');
  // the book keeps twenty
  let many = BK.newArenaBook();
  for (let h = 0; h < 40; h++) many.wagers.unshift({ ...w, hour: h });
  assert.equal(BK.bookRestore(many).wagers.length, BK.WAGERS_KEPT);
});

test('ARENA3 the stall: his choice - the bout\'s prices, collect, back either, the stake; and the window\'s card', () => {
  const gm = noon(3);
  const ex = exAt(gm);
  const L = LG.newArenaLeague();
  const ch = BK.bookmakerChoice({ league: L, gameMinutes: gm, gold: 300 });
  assert.deepEqual(ch.options.map((o) => o.act), ['back0', 'back1', 'window', 'leave', 'leave']);
  assert.ok(ch.lines.includes(ARENA_TEXT.book.edge), 'the house\'s tenth, said');
  assert.ok(ch.lines.some((l) => l.startsWith('The hour\'s bout: ')));
  for (const o of ch.options.filter((x) => x.label)) assert.match(o.label, /^[A-Z] - [A-Z]/);
  for (const l of ch.lines) assert.ok(l.length <= 90, l);
  assert.deepEqual(BK.bookmakerChoice({ league: L, gameMinutes: gm, gold: 5 }).options.map((o) => o.act), ['window', 'leave', 'leave'], 'no purse, no backing');
  assert.ok(BK.bookmakerChoice({ league: L, gameMinutes: gm, gold: 5 }).lines.includes(ARENA_TEXT.book.whyGold));
  assert.ok(BK.bookmakerChoice({ league: L, gameMinutes: gm, gold: 300, begun: true }).lines.includes(ARENA_TEXT.book.whyClosed));
  const night = gm - 12 * 60 + 23 * 60;
  assert.ok(BK.bookmakerChoice({ league: L, gameMinutes: night, gold: 300 }).lines.includes(ARENA_TEXT.book.shut));
  const owing = { ...L, book: { ...BK.newArenaBook(), owed: 175 } };
  const och = BK.bookmakerChoice({ league: owing, gameMinutes: night, gold: 0, window: false });
  assert.deepEqual(och.options.map((o) => o.act), ['collect', 'leave', 'leave']);
  assert.equal(och.options[0].label, 'C - Collect your 175 gold');
  const st = BK.stakeChoice({ name: 'Aldo', price: '7 to 4', gold: 120 });
  assert.deepEqual(st.options.filter((o) => o.act === 'stake').map((o) => [o.code, o.stake]), [['Digit1', 10], ['Digit2', 25], ['Digit3', 50], ['Digit4', 100]]);
  assert.equal(st.options[0].label, '1 - 10 gold');
  // the window's card
  const card = BK.exhibitionCard(L, ex, gm, { gold: 300 });
  assert.equal(card.why, null);
  assert.deepEqual(card.stakes, [10, 25, 50, 100, 250]);
  assert.equal(card.odds.length, 2);
  assert.match(card.records[0], /^\d+-\d+$/);
  assert.equal(BK.exhibitionCard(L, ex, gm, { gold: 300, atGate: false }).why, ARENA_TEXT.window.whyGate);
  assert.equal(BK.exhibitionCard(L, ex, gm, { gold: 300, begun: true }).why, ARENA_TEXT.book.whyClosed);
});

test('ARENA3 the gate\'s stall: back a fighter over a real purse, the verdict seen settles it, the winnings collected in person', () => {
  const gm = noon(4);
  const ex = exAt(gm);
  const P = { goldPieces: 400, items: [], arenaLeague: null };
  const shown = [], said = [];
  let live = null, begun = false;
  const gate = createArenaGate({ playerEntity: P, gameMinutes: () => gm, showOverlay: (w) => shown.push(w), say: (l) => said.push(l), liveHour: () => live, begun: () => begun, openWindow: null });
  assert.equal(gate.bookmaker(), true);
  assert.ok(!shown.at(-1).options.some((o) => o.code === 'KeyW'), 'no window from a host without one');
  shown.at(-1).input('KeyB');
  shown.at(-1).input('Digit4');   // 100 gold
  assert.equal(P.goldPieces, 300, 'paid from the purse');
  const w = P.arenaLeague.book.wagers[0];
  assert.deepEqual([w.side, w.stake], [1, 100]);
  assert.equal(said.at(-1), ARENA_TEXT.book.taken(100, w.names[1], BK.oddsText([w.num, w.den])));
  assert.deepEqual(gate.wager(ex.hour, 0, 50), { ok: false, text: ARENA_TEXT.book.whyRefused.placed });
  assert.deepEqual(gate.wager(ex.hour + 1, 0, 50), { ok: false, text: ARENA_TEXT.book.whyRefused.closed }, 'only the hour\'s bout');
  live = ex.hour;
  gate.verdictSeen(ex.hour, 1);
  assert.equal(P.arenaLeague.book.wagers[0].status, 'won');
  const owed = P.arenaLeague.book.owed;
  assert.equal(owed, BK.payoutFor(100, [w.num, w.den]));
  assert.equal(P.goldPieces, 300, 'not paid until collected');
  gate.bookmaker();
  shown.at(-1).input('KeyC');
  assert.equal(P.goldPieces, 300 + owed, 'in person');
  assert.equal(P.arenaLeague.book.owed, 0);
  assert.equal(said.at(-1), ARENA_TEXT.book.paid(owed));
  // a letter of credit pays when the coins cannot (DFU's payment law)
  const Q = { goldPieces: 5, items: [{ templateIndex: LETTER_OF_CREDIT_TEMPLATE, value: 500 }], arenaLeague: null };
  const g2 = createArenaGate({ playerEntity: Q, gameMinutes: () => gm, showOverlay: () => {}, begun: () => false });
  const r = g2.wager(ex.hour, 0, 100);
  assert.equal(r.ok, true, r.text);
  assert.equal(Q.items[0].value + Q.goldPieces, 405);
  // the book shut at the word
  begun = true;
  const P3 = { goldPieces: 400, items: [], arenaLeague: null };
  const g3 = createArenaGate({ playerEntity: P3, gameMinutes: () => gm, showOverlay: () => {}, begun: () => begun });
  assert.deepEqual(g3.wager(ex.hour, 0, 50), { ok: false, text: ARENA_TEXT.book.whyRefused.closed });
  assert.equal(P3.goldPieces, 400, 'nothing taken');
});

test('ARENA3 the driver tells the exhibition\'s verdict; the hosts wire the stall, the verdict and the shut book', async () => {
  const gm = noon(5);
  const ex = exAt(gm);
  let t = 1000;
  const told = [];
  const foes = [];
  const P = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), arenaLeague: null };
  const A = createArenaBouts({ now: () => t, rng: () => 0.99, playerEntity: P, gameMinutes: () => gm, exhibitionVerdict: (h, s) => told.push([h, s]) });
  A.setStage({ kind: 'floor', centre: () => [0, 0, 0], spawn: async (mobile, feet, o) => { const f = { mobile, entity: { health: 30, maxHealth: 30, bout: o.bout, items: [] }, ai: { feet: [...feet] } }; foes.push(f); return f; }, remove: () => {}, heightAt: () => null });
  A.ask({ where: 'floor', kind: 'exhibition', ex });
  await new Promise((r) => setTimeout(r, 0));
  const step = (ms) => { t += ms; A.frame(ms / 1000, { playerFeet: [0, 0, 0] }); };
  for (let i = 0; i < 200 && A.bout()?.phase !== 'fight'; i++) step(100);
  const f1 = foes[1];
  f1.entity.health = 1; f1.entity.bout.out = true; f1.entity.bout.hooks.floor(f1);
  for (let i = 0; i < 100 && A.bout()?.phase !== 'heal' && A.bout()?.phase !== 'done'; i++) step(100);
  assert.deepEqual(told, [[ex.hour, 0]], 'the Red\'s fighter stood');
  const { readFileSync } = await import('node:fs');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const W = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.match(W, /exhibitionVerdict: \(hour, side\) => arenaGate\.verdictSeen\(hour, side\)/, f);
    assert.match(W, /liveHour: \(\) => arenaBouts\.hour\(\), begun: \(\) => arenaBoutBegun\(\)/, f);
    assert.match(W, /arenaBookmaker: \(\) => arenaGate\.bookmaker\(\)/, f);
    // ARENA4b: the book shuts at the word of the exhibition standing here by its HOUR - this screen's own bout's or the
    // relay's mirrored one (scenes/arenaBouts.js startExhibitionRelay: kind 'relay', its `ex` carried)
    assert.match(W, /const arenaBoutBegun = \(\) => \{ const b = arenaBouts\.bout\(\); return arenaBouts\.hour\(\) != null && !!b && !\['call', 'walk', 'count'\]\.includes\(b\.phase\); \};/, f);
  }
  assert.match(readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8'), /if \(gateRole === 'bookmaker' && host\.arenaBookmaker\?\.\(\)\) return;/);
});

test('ARENA3 book save: the book rides the league through save.js - every wager back; a broken one dropped', () => {
  const gm = noon(6);
  const ex = exAt(gm);
  const book = BK.placeWager(BK.newArenaBook(), ex, 0, 250, { gold: 1000, gameMinutes: gm }).book;
  book.owed = 90;
  const L = { ...LG.newArenaLeague(), book };
  const snap = snapshotPlayer({ name: 'Hero', items: [], arenaLeague: L }, {});
  const back = {};
  restorePlayer(back, JSON.parse(JSON.stringify(snap)));
  assert.deepEqual(back.arenaLeague.book, BK.bookRestore(book));
  assert.deepEqual([back.arenaLeague.book.owed, back.arenaLeague.book.wagers[0].stake, back.arenaLeague.book.wagers[0].status], [90, 250, 'open']);
  const odd = BK.bookRestore({ owed: -5, wagers: [null, { hour: 'x' }, { hour: 3, side: 7, status: 'odd', num: 0 }], seen: [{ hour: 3, side: 4 }] });
  assert.deepEqual([odd.owed, odd.wagers.length, odd.wagers[0].side, odd.wagers[0].status, odd.wagers[0].num, odd.seen[0].side], [0, 1, 0, 'open', 1, null]);
  assert.deepEqual(BK.bookRestore(null), BK.newArenaBook());
});
