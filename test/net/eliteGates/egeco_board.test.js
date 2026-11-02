// EG-E2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 20, THE BOARDS and THE
// BOARD WINDOW): THE ELITE BREACH'S THREE BOARDS AND THE WINDOW THEY ARE READ IN - `/v1/eg/board` (egHonours.js
// egBoardOf): the Descent in three brackets by the company's size, unwagered breaches begun at Hall 1 alone, ranked by
// the deepest hall then the fewest seconds, a company one row with the Unfallen's flame; the Depths, every account's
// deepest hall this season from any start; the Deepest Redoubts, all time; the caller pinned under each top ten, the
// season's bounds, the week's Proclamation and the caller's best. And the window's lines (ui/eliteGates/egBoardWindow.js), its two
// skins' halves. The real Worker over node:sqlite with every migration (test/accountDb.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../../accountDb.mjs';
import { mintEgReceipt } from '../../../src/net/eliteGates/egReceipt.js';
import { arenaSeasonOf, arenaSeasonEndsS, arenaWeekOf } from '../../../src/net/arena/arenaLaw.js';
import { egProclamationOf, EG_DECREE_BY_KEY } from '../../../src/net/eliteGates/egLaw.js';
import { egDescentCompanies, egDescentBrackets, egBracketOf, EG_BRACKETS, _resetEgHonoursCache } from '../../../server-account/src/egHonours.js';
import { topWithMe } from '../../../server-account/src/arena.js';
import { EG_BOARD_TABS, EG_BOARD_TAB_TEXT, egBoardLines, egBoardClock, openEgBoard } from '../../../src/ui/eliteGates/egBoardWindow.js';
import { fakeDoc, all, text, settle } from '../../decorFakes.mjs';

const { subtle } = globalThis.crypto;
let bseq = 0;
const breach = () => (0x2000000000000 + ++bseq).toString(16).padStart(16, '0');
async function stood(t, t0 = T0) {
  let clock = t0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  _resetEgHonoursCache();
  const S = await standService();
  return { S, at: (s) => { clock = s * 1000; }, now: () => Math.floor(clock / 1000), tick: () => { clock += 1000; } };
}
/** One member's end of breach `b`, claimed (`x` by default) - and the clock a second on, so the order they ended in is
 *  the order they were claimed in. */
async function end(S, T, who, b, o = {}) {
  const r = await mintEgReceipt({ q: 'x', b, s: who.id, z: 'z'.repeat(16), c: 5, h: 5, t: 900, n: 1, ew: 0, l: 10, why: 'home', ...o }, S.gatePriv, { subtle, nowS: T.now() });
  const c = await S.call('/v1/eg/claim', { receipt: r }, who.secret);
  assert.equal(c.body.recorded, true, JSON.stringify(c.body));
  T.tick();
}
const boardOf = async (S, who) => (await S.call('/v1/eg/board', {}, who.secret)).body;

test('EG-E2 THE DESCENT: three brackets by the company\'s size; only unwagered breaches begun at Hall 1 and no Rehearsal; ranked by the deepest hall then the fewest seconds (the receipt\'s Hall 1-to-door `td` where it says one); a company one row - its members in the order they ended, its deepest member\'s hall, the Unfallen\'s flame only when none fell - and its best breach alone (mutants: a wagered breach ranked; a deep start ranked; the seconds the wrong way; the company split; the flame with a fall; the same company twice)', async (t) => {
  const T = await stood(t), { S } = T;
  const r = async (h) => S.registered(h);
  const [A, B, C, D, E, R] = [await r('Avel'), await r('Brin'), await r('Cass'), await r('Dare'), await r('Edda'), await r('Rhea')];
  const [F, G, H] = [await r('Fenn'), await r('Gale'), await r('Hale')];
  const five = [await r('Iona'), await r('Jory'), await r('Kell'), await r('Lark'), await r('Mira')];
  await end(S, T, A, breach(), { h: 12, td: 900 });
  await end(S, T, B, breach(), { h: 12, t: 800 });   // no `td`: its `t`
  await end(S, T, C, breach(), { h: 15, td: 2000 });
  await end(S, T, D, breach(), { h: 40, wg: [1, 4] });   // wagered: the Depths alone - PIN MOVED (AUDIT EG IV, lane3 #7): `['chained', 'pack']`, words the mint never writes and the receipt now refuses; the Wager's decrees by number, as net/eliteGates/egBrain.js oweEnd mints them
  await end(S, T, E, breach(), { h: 40, ew: 2 });   // a deep start: the Depths alone
  await end(S, T, R, breach(), { h: 5, rh: 1, why: 'rehearsal' });   // a Rehearsal: nowhere
  const fb = breach();
  await end(S, T, F, fb, { h: 20, td: 1500, n: 3, fl: 0 });
  await end(S, T, G, fb, { h: 20, td: 1400, n: 3, fl: 0 });
  await end(S, T, H, fb, { h: 18, td: 1300, n: 3, fl: 1, why: 'fall' });
  const fb2 = breach();
  for (const who of [H, G, F]) await end(S, T, who, fb2, { h: 10, td: 600, n: 3 });   // the same company, a worse breach
  const ib = breach();
  for (const who of five) await end(S, T, who, ib, { h: 25, td: 3000, n: 5, fl: 0 });
  const b = await boardOf(S, A);
  assert.equal(b.ok, true);
  const alone = b.descent.alone;
  assert.deepEqual(alone.rows.map((x) => [x.names.join(), x.h, x.t, x.rank, x.you]), [['Cass', 15, 2000, 1, false], ['Brin', 12, 800, 2, false], ['Avel', 12, 900, 3, true]]);
  assert.equal(alone.total, 3, 'neither the wagered, the deep start nor the Rehearsal');
  assert.equal(alone.pinned, null, 'the caller among the shown');
  const few = b.descent.few;
  assert.deepEqual(few.rows.map((x) => [x.names, x.h, x.t, x.n, x.flame]), [[['Fenn', 'Gale', 'Hale'], 20, 1400, 3, false]], 'one row, its best breach, no flame (Hale fell)');
  assert.deepEqual(b.descent.company.rows.map((x) => [x.names.length, x.h, x.flame]), [[5, 25, true]], 'the Company: five, unfallen');
  assert.ok(typeof few.rows[0].pr === 'string' && few.rows[0].pr.length > 0, 'each row its breach\'s Proclamation');
  // THE DEPTHS: every account's deepest hall this season, from any start - its start Redoubt and its Wager
  assert.deepEqual(b.depths.rows.slice(0, 2).map((x) => [x.name, x.h, x.ew, x.wagered]), [['Dare', 40, 0, true], ['Edda', 40, 2, false]]);
  assert.ok(!b.depths.rows.some((x) => x.name === 'Rhea'), 'no Rehearsal on the Depths either');
  assert.equal(b.depths.total, 13);
  // the caller's best on the Descent
  assert.deepEqual(b.best, { h: 12, t: 900 });
  assert.equal((await boardOf(S, D)).best, null, 'a wagered breach is no best on the Descent');
  assert.deepEqual((await boardOf(S, G)).best, { h: 20, t: 1400 });
  assert.equal((await boardOf(S, G)).descent.few.rows[0].you, true, 'a company\'s row is every member\'s');
});

test('EG-E2 THE BOARDS\' EDGES: the caller past the top ten pinned under it; ties to the first there; the season\'s bounds - last season\'s ends on no board this season, the Deepest Redoubts all time; the week\'s Proclamation in words; a guest\'s read answers the boards with no row of its own (mutants: no pin; the season unread; the Deepest by season; the Proclamation another week\'s)', async (t) => {
  const T = await stood(t), { S, at, now } = T;
  const season = arenaSeasonOf(now());
  const old = await S.registered('Elder');
  await end(S, T, old, breach(), { h: 60, td: 100 });
  for (const w of [3, 9]) {
    const ow = await mintEgReceipt({ q: 'w', b: breach(), s: old.id, z: 'z'.repeat(16), c: 2, w, h: w * 5, t: 4000, n: 1, ew: 0, l: 20 }, S.gatePriv, { subtle, nowS: now() });
    await S.call('/v1/eg/claim', { receipt: ow }, old.secret);
  }
  at(arenaSeasonEndsS(season) + 100);   // the next season
  const solos = [];
  for (let i = 0; i < 12; i++) solos.push(await S.registered(`Walker${String.fromCharCode(97 + i)}`));
  for (const [i, who] of solos.entries()) await end(S, T, who, breach(), { h: 30 - i, td: 1000 });
  const late = await S.registered('Latecomer');
  await end(S, T, late, breach(), { h: 30, td: 1000 });   // a tie with the first: the first there ranks above
  const w = await mintEgReceipt({ q: 'w', b: breach(), s: late.id, z: 'z'.repeat(16), c: 2, w: 4, h: 20, t: 2000, n: 1, ew: 0, l: 20 }, S.gatePriv, { subtle, nowS: now() });
  await S.call('/v1/eg/claim', { receipt: w }, late.secret);
  const b = await boardOf(S, solos[11]);
  assert.deepEqual(b.season, { n: season + 1, day: 1, ends: arenaSeasonEndsS(season + 1) });
  const alone = b.descent.alone;
  assert.equal(alone.rows.length, 10);
  assert.deepEqual([alone.rows[0].names, alone.rows[1].names], [['Walkera'], ['Latecomer']], 'a tie to the first there');
  assert.ok(!alone.rows.some((x) => x.names.includes('Elder')) && alone.total === 13, 'last season\'s on no board this season');
  assert.ok(!b.depths.rows.some((x) => x.name === 'Elder') && b.depths.total === 13, 'nor on the Depths');
  assert.deepEqual([alone.pinned.names, alone.pinned.rank, alone.pinned.you], [['Walkerl'], 13, true], 'the caller past the top ten, pinned under it');
  assert.deepEqual(b.deepest.rows.map((x) => [x.name, x.w]), [['Elder', 9], ['Latecomer', 4]], 'the Deepest Redoubts all time, each account its deepest');
  assert.ok(b.deepest.rows[0].at > 0);
  const key = egProclamationOf(arenaWeekOf(now()));
  assert.deepEqual(b.proclamation, { week: arenaWeekOf(now()), key, name: EG_DECREE_BY_KEY[key].name, line: EG_DECREE_BY_KEY[key].line });
  const g = (await S.call('/v1/eg/board', {}, (await S.guest()).secret)).body;
  assert.equal(g.ok, true);
  assert.equal(g.descent.alone.pinned, null);
  assert.equal(g.best, null);
});

test('EG-E2 THE DESCENT\'S LAW, PURE: the brackets\' bounds (Alone 1, the Few 2-4, the Company 5-8); a company keyed by its members whatever order they ended in; ties by the seconds, then the first there; its size the receipts\' or its members\', the more; topWithMe takes a row\'s test where a board ranks companies (mutants: a bracket\'s bound off by one; the key ordered; the size the receipts\' alone; the test ignored)', () => {
  assert.deepEqual([0, 1, 2, 4, 5, 8].map(egBracketOf), ['alone', 'alone', 'few', 'few', 'company', 'company']);
  assert.deepEqual([...EG_BRACKETS], ['alone', 'few', 'company']);
  const rows = [
    { b: 'b1', account: 'p1', h: 10, secs: 500, n: 2, fl: 0, at: 5 }, { b: 'b1', account: 'p2', h: 10, secs: 450, n: 2, fl: 0, at: 6 },
    { b: 'b2', account: 'p2', h: 10, secs: 400, n: 2, fl: 0, at: 9 }, { b: 'b2', account: 'p1', h: 9, secs: 300, n: 2, fl: 1, at: 8 },
    { b: 'b3', account: 'p3', h: 10, secs: 400, n: 0, fl: 0, at: 7 }, { b: 'b3', account: 'p4', h: 7, secs: 100, n: 0, fl: 0, at: 7 },
  ];
  const c = egDescentCompanies(rows);
  assert.deepEqual(c.map((x) => [x.players, x.h, x.t, x.n, x.flame]), [[['p3', 'p4'], 10, 400, 2, true], [['p2', 'p1'], 10, 400, 2, false]], 'p1 and p2 one company, their best breach b2 (the fewer seconds; p1 fell in it - no flame), its members as they ended; p3 and p4 tie it and came first; their size their two, where the receipts said none');
  const br = egDescentBrackets([...c, { key: 'x', players: ['q'], h: 1, t: 1, n: 1, flame: true, at: 1 }, { key: 'y', players: ['a', 'b', 'c', 'd', 'e'], h: 1, t: 1, n: 5, flame: true, at: 1 }]);
  assert.deepEqual(EG_BRACKETS.map((k) => br[k].length), [1, 2, 1]);
  const ranked = topWithMe([{ players: ['a'] }, { players: ['b', 'me'] }, { players: ['me'] }], (x) => x.players.includes('me'), 1);
  assert.deepEqual([ranked.rows.length, ranked.pinned.rank, ranked.total], [1, 2, 3], 'the first row naming the caller pinned');
  assert.deepEqual(topWithMe([{ player: 'a' }, { player: 'me' }], 'me', 1).pinned.rank, 2, 'every other board\'s id, as before');
});

// ── the window ─────────────────────────────────────────────────────────

const BOARD = {
  ok: true,
  season: { n: 3, day: 12, ends: 1_805_000_000 },
  descent: {
    alone: { rows: [{ players: ['a'], names: ['Avel'], h: 47, t: 6252, n: 1, flame: true, pr: "Kyn's Rally", rank: 1, you: false }], pinned: { players: ['m'], names: ['Mac'], h: 30, t: 3000, n: 1, flame: false, pr: 'Ashfall', rank: 14, you: true }, total: 14 },
    few: { rows: [{ players: ['f', 'g', 'h'], names: ['Fenn', 'Gale', 'Hale'], h: 26, t: 2000, n: 3, flame: false, pr: 'Ashfall', rank: 1, you: false }], pinned: null, total: 1 },
    company: { rows: [], pinned: null, total: 0 },
  },
  depths: { rows: [{ player: 'd', name: 'Dare', h: 80, ew: 4, wagered: true, rank: 1, you: false }], pinned: null, total: 1 },
  deepest: { rows: [{ player: 'e', name: 'Edda', w: 19, at: 1_800_000_000, rank: 1, you: true }], pinned: null, total: 1 },
  proclamation: { week: 9, key: 'rally', name: "Kyn's Rally", line: 'A slain add strengthens its wave.' },
  best: { h: 47, t: 6252 },
};

test('EG-E2 THE BOARD WINDOW\'S LINES: each tab its name and the season, its ranked rows, `...` then the member\'s own pinned row; a Descent row its company, the hall and its band, the time, the Unfallen\'s flame and its breach\'s Proclamation (the classic list\'s short form the first name and how many more); the Depths the start and the Wager; the Deepest the Redoubt and its day; every tab the week\'s Proclamation and "Your best: Hall 47 - 1:44:12" (mutants: the pin dropped; the clock\'s hours; the flame unread; the short form\'s count)', () => {
  assert.deepEqual([...EG_BOARD_TABS], ['alone', 'few', 'company', 'depths', 'deepest', 'runs']);   // PIN MOVED (AUDIT EG V, c: L7-19 - the sixth tab, this device's last runs)
  assert.deepEqual([egBoardClock(6252), egBoardClock(59), egBoardClock(3600), egBoardClock(-4)], ['1:44:12', '0:59', '1:00:00', '0:00']);
  assert.deepEqual(egBoardLines(BOARD, 'alone'), [
    'The Descent: Alone', 'Season 3, day 12.',   // PIN MOVED (VOICE2): a title's colon, no dash aside (Voice.md rule 5)
    "1. Avel - Hall 47 (The Soul Cairn) - 1:44:12 - unfallen - Kyn's Rally",
    '...', '14. Mac - Hall 30 (The Soul Cairn) - 50:00 - Ashfall - you',
    "This week's Proclamation: Kyn's Rally - A slain add strengthens its wave.", 'Your best: Hall 47 - 1:44:12',
  ]);
  assert.equal(egBoardLines(BOARD, 'few')[2], '1. Fenn, Gale, Hale - Hall 26 (The Soul Cairn) - 33:20 - Ashfall');
  assert.equal(egBoardLines(BOARD, 'few', { short: true })[2], '1. Fenn +2 - Hall 26 - 33:20');
  assert.equal(egBoardLines(BOARD, 'company')[2], 'No company has gone down this season.');
  assert.equal(egBoardLines(BOARD, 'depths')[2], '1. Dare - Hall 80 from Redoubt 4 - wagered');
  assert.equal(egBoardLines(BOARD, 'deepest')[2], '1. Edda - Redoubt 19 - 2027-01-15 - you');
  assert.equal(egBoardLines({ ...BOARD, best: null }, 'depths').at(-1), 'Your best: no descent yet this season.');
  assert.deepEqual(egBoardLines(BOARD, 'nonsense')[0], EG_BOARD_TAB_TEXT.alone, 'an unknown tab is the first');
  assert.deepEqual(egBoardLines(null, 'alone'), ['Reading the boards...']);
  assert.deepEqual(egBoardLines({ error: 'offline' }, 'alone'), ['The boards cannot be read now (offline).']);
});

test('EG-E2 THE BOARD WINDOW, OPENED: the enhanced skin\'s one panel - its five tabs, reading then the board, a tab pressed switching in place, the close (once) taking it away; the classic skin\'s DFU pickers - the tabs, a tab\'s lines in a picker of their own, back to the tabs on its close, each window out of the slot before the next goes in; a slot that refuses opens nothing (mutants: the old window left in the slot; the close told twice; the tabs never come back)', async () => {
  // ENHANCED
  const doc = fakeDoc();
  let closed = 0;
  const h = openEgBoard({ doc, fetchBoard: async () => ({ ok: true, data: BOARD }), onClosed: () => { closed++; } });
  const panel = doc.body.children.at(-1);
  assert.match(text(panel), /Reading the boards/);
  await settle();
  assert.match(text(panel), /Hall 47 - The Soul Cairn/);   // EG-PLUS: a row's facts its own parts (egBoardView)
  assert.equal(all(panel, 'eg-k-tab').filter((x) => /\bon\b/.test(x.className)).length, 1, 'one tab shown');
  const tabs = all(panel, 'eg-k-tabs')[0].children;
  assert.deepEqual(tabs.map((x) => x.textContent), EG_BOARD_TABS.map((k) => EG_BOARD_TAB_TEXT[k]));
  tabs[3].fire('click');
  assert.equal(h.tab(), 'depths');
  const dare = all(doc.body.children.at(-1), 'eg-k-row').find((r) => text(r).includes('Dare'));
  assert.deepEqual([all(dare, 'eg-k-who')[0].textContent, all(dare, 'eg-k-sub')[0].textContent, all(dare, 'eg-k-val')[0].textContent], ['Dare', 'From Redoubt 4 - wagered', 'Hall 80']);
  h.close(); h.close();
  assert.deepEqual([closed, doc.body.children.at(-1).removed], [1, true], 'closed once, taken away');
  // CLASSIC
  const slot = [];
  class Picker { constructor(o) { Object.assign(this, o); } }
  const mount = (w) => { if (slot.length) return false; slot.push(w); return true; };
  const unmount = (w) => { const i = slot.indexOf(w); if (i >= 0) slot.splice(i, 1); };
  let cClosed = 0;
  const c = openEgBoard({ classic: true, fetchBoard: async () => ({ ok: true, data: BOARD }), mountWindow: mount, closeWindow: unmount, ListPicker: Picker, onClosed: () => { cClosed++; } });
  await settle();
  assert.deepEqual(slot[0].items, EG_BOARD_TABS.map((k) => EG_BOARD_TAB_TEXT[k]), 'the tabs first');
  slot[0].onPick(1);
  assert.equal(slot.length, 1, 'the tabs out of the slot before the lines go in');
  assert.equal(slot[0].items[2], '1. Fenn +2 - Hall 26 - 33:20', 'the Few\'s lines, the short form');
  slot[0].onCancel();
  assert.deepEqual([slot.length, slot[0].selectedIndex], [1, 1], 'back to the tabs, the Few chosen');
  slot[0].onCancel();
  assert.deepEqual([slot.length, cClosed], [0, 1], 'the tabs\' close closes the boards');
  assert.equal(c.tab(), 'few');
  assert.equal(openEgBoard({ classic: true, fetchBoard: async () => BOARD, mountWindow: () => false, closeWindow: unmount, ListPicker: Picker }), null, 'a slot that refuses opens nothing');
  assert.equal(openEgBoard({ classic: true, fetchBoard: async () => BOARD, mountWindow: mount, listPickerReady: () => false, ListPicker: Picker }), null, 'nor before the picker\'s art');
  // a refusal reads as one
  const slot2 = [];
  const r = openEgBoard({ classic: true, fetchBoard: async () => ({ ok: false, error: 'no-session' }), mountWindow: (w) => { slot2.push(w); return true; }, closeWindow: (w) => { slot2.splice(slot2.indexOf(w), 1); }, ListPicker: Picker });
  await settle();
  slot2[0].onPick(0);
  assert.deepEqual(slot2[0].items, ['The boards cannot be read now (no-session).']);
  assert.equal(r.board().error, 'no-session');
});
