// EG-E1 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 19, REWARDS AND THE
// ECONOMY): WHAT A REDOUBT PAYS, AS THE ACCOUNT SERVICE PAYS IT (server-account/src/egEconomy.js, through eg.js claimEg)
// - the week's pay (once an account a Redoubt an arena week; taken again, nothing but its gold), a Rehearsal's nothing,
// a receipt carried again answered the same pay; its Marks under the day's combat cap with the gates'; a guild's deed for
// three members on one Redoubt of one breach; its embers in the purse the insignia spend; a Valkynaz's Weir Key at most
// once a week; the Panoply's pity forcing the eleventh pass; the end's Reliquaries by the week's pay; and the Broker's
// Panoply sink, once a week for 20 embers. The real Worker over node:sqlite with every migration (test/accountDb.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { standService, sessionStorageOf } from '../../accountDb.mjs';
import { mintEgReceipt } from '../../../src/net/eliteGates/egReceipt.js';
import { ARENA_SEASON_EPOCH_S, ARENA_WEEK_S, arenaWeekOf } from '../../../src/net/arena/arenaLaw.js';
import { egPanoplyHit, egSpoilsSeed, egEmbersOf, EG_PANOPLY_PITY, EG_SINK_EMBERS, EG_PANOPLY_IDS, EG_PAY_MARKS } from '../../../src/net/eliteGates/egPay.js';
import { MARKS_FAUCETS, MARKS_COMBAT, MARKS_KINDS } from '../../../src/net/marksLaw.js';
import { INSIGNIA } from '../../../src/net/insignia.js';
import { accountEg, SESSION_KEY, accountRefusalText } from '../../../src/net/accountClient.js';
import { egStrikeRid } from '../../../server-account/src/marks.js';
import { egSeasonWeek0 } from '../../../server-account/src/egEconomy.js';

const { subtle } = globalThis.crypto;
const E = ARENA_SEASON_EPOCH_S, WK = ARENA_WEEK_S, DAY = 86_400;
/** Season 2's second week, a Tuesday - a week with a week of its season on either side. */
const NOW0 = E + 9 * WK + DAY;
const Z = 'zzzzzzzzzzzzzzzz';
/** A service standing with Marks open, the clock at NOW0; `claim` mints a Redoubt's `w` receipt as the relay signs one and
 *  carries it for `who` (seed `c` 1 misses the Panoply at every Redoubt these tests take - its pity counts). */
async function stood(t) {
  let clock = NOW0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const S = await standService({ MARKS_OPEN: 'on' });
  const raw = S.env.DB._raw;
  const now = () => Math.floor(clock / 1000);
  let n = 0;
  const breach = () => (++n).toString(16).padStart(16, '0');
  const receipt = (who, { b, w, c = 1, rh = false }) => mintEgReceipt({ q: 'w', b, s: who.id, z: Z, c, w, h: w * 5, t: 900, n: 1, ew: 0, l: 12, ...(rh ? { rh: 1 } : {}) }, S.gatePriv, { subtle, nowS: now() });
  const claim = async (who, what) => S.call('/v1/eg/claim', { receipt: await receipt(who, what), ...(what.character ? { character: what.character } : {}) }, who.secret);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const lines = (kind) => raw.prepare('SELECT * FROM marks_ledger WHERE kind = ? ORDER BY seq').all(kind);
  const player = (who) => ({ ...raw.prepare('SELECT eg_keys, eg_pity, eg_valk_wk, insignia_spent FROM players WHERE id = ?').get(who.id) });
  return { S, raw, now, at: (s) => { clock = s * 1000; }, breach, receipt, claim, balance, lines, player };
}
/** This service's die for a key: every 4-byte draw `byte` (0x00 always under the odds, 0xff never). */
function die(t, byte) {
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  t.mock.method(globalThis.crypto, 'getRandomValues', (b) => (b.length === 4 ? b.fill(byte) : real(b)));
}

test('EG-E1 THE LAW AS THE SERVICE READS IT: a Redoubt strikes 20 silver (MARKS_FAUCETS.eg, the pay law\'s EG_PAY_MARKS), a mint, under the one combat cap of 150 with the gates, the raids and the serpents; its line `eg:<week>:<Redoubt>`; a season\'s first week (mutants: the faucet\'s amount; the kind outside the cap; the line id a day\'s)', () => {
  assert.deepEqual(MARKS_FAUCETS.eg, { amount: EG_PAY_MARKS });
  assert.equal(EG_PAY_MARKS, 20);
  assert.equal(MARKS_KINDS.eg, 'mint');
  assert.deepEqual(MARKS_COMBAT, { kinds: ['gate', 'raid', 'serpent', 'eg', 'star'], perDay: 150 });   // PIN MOVED (STAR7): a fallen star held after it
  assert.equal(egStrikeRid(25, 3), 'eg:25:3');
  assert.deepEqual([E, E + WK, NOW0, E + 15 * WK + 6 * DAY, E + 16 * WK].map(egSeasonWeek0), [0, 0, 8, 8, 16]);
});

test('EG-E1 THE WEEK\'S PAY: a Redoubt\'s number pays once an account an arena week - its Marks and its first-this-season ember - and taken again that week in another breach pays nothing but its gold (paid false, no Marks, no embers); the next week pays its Marks again and no second first ember; a new season\'s first pays it again; another Redoubt the same week pays (mutants: the week never asked; paid on every row; the first ember on every paid row; the line id one for ever)', async (t) => {
  const { S, claim, breach, at, balance, lines } = await stood(t);
  const me = await S.registered('Spirewalker');
  const b1 = breach(), b2 = breach(), b3 = breach(), b4 = breach();
  const first = (await claim(me, { b: b1, w: 3 })).body;
  assert.deepEqual([first.recorded, first.paid, first.again, first.embers, first.purse, first.marks.struck, first.weir, first.pity, first.deed], [true, true, undefined, 1, 1, 20, null, [], null]);
  assert.deepEqual(first.marks.combat, { earned: 20, max: 150 });
  const again = (await claim(me, { b: b2, w: 3 })).body;
  assert.deepEqual([again.recorded, again.paid, again.marks, again.embers, again.purse, again.weir, again.pity], [true, false, null, 0, 1, null, []], 'the same Redoubt, the same week: its gold alone');
  assert.equal(balance(me), 20);
  const other = (await claim(me, { b: b2, w: 4 })).body;
  assert.deepEqual([other.paid, other.marks.struck, other.embers], [true, 20, 1], 'another Redoubt is its own week\'s pay');
  at(NOW0 + WK);
  const next = (await claim(me, { b: b3, w: 3 })).body;
  assert.deepEqual([next.paid, next.marks.struck, next.embers], [true, 20, 0], 'the next week pays again - the season\'s first ember was paid');
  assert.deepEqual(lines('eg').map((l) => [l.amount, l.rid]), [[20, egStrikeRid(arenaWeekOf(NOW0), 3)], [20, egStrikeRid(arenaWeekOf(NOW0), 4)], [20, egStrikeRid(arenaWeekOf(NOW0 + WK), 3)]]);
  at(E + 16 * WK + DAY);
  const season = (await claim(me, { b: b4, w: 3 })).body;
  assert.deepEqual([season.paid, season.embers, season.purse], [true, 1, 3], 'a new season\'s first is a first again - three firsts in the purse');
});

test('EG-E1 ASKED AGAIN, THE SAME PAY: the same receipt carried a second time (its answer lost) is `claimed` and `again`, with the pay its row keeps - paid, embers, the forced passes, the week\'s line - and nothing paid twice; an unpaid receipt asked again says unpaid (mutants: the row\'s pay unread; the re-claim striking again)', async (t) => {
  const { S, receipt, breach, balance, lines, raw, player } = await stood(t);
  const me = await S.registered('Again');
  raw.prepare('UPDATE players SET eg_pity = ? WHERE id = ?').run(EG_PANOPLY_PITY, me.id);
  const r = await receipt(me, { b: breach(), w: 2 });
  const once = (await S.call('/v1/eg/claim', { receipt: r }, me.secret)).body;
  assert.deepEqual([once.recorded, once.paid, once.embers, once.pity, once.marks.struck], [true, true, 1, [0], 20]);
  const twice = (await S.call('/v1/eg/claim', { receipt: r }, me.secret)).body;
  assert.deepEqual([twice.recorded, twice.why, twice.again, twice.paid, twice.embers, twice.pity, twice.marks.struck, twice.purse, twice.b, twice.w],
    [false, 'claimed', true, true, 1, [0], 20, 1, once.b, 2], 'the same pay said again');
  assert.equal(balance(me), 20, 'struck once');
  assert.equal(lines('eg').length, 1);
  assert.equal(player(me).eg_pity, 0, 'the pity moved once');
  // an unpaid one
  const r2 = await receipt(me, { b: breach(), w: 2 });
  await S.call('/v1/eg/claim', { receipt: r2 }, me.secret);
  const unpaid = (await S.call('/v1/eg/claim', { receipt: r2 }, me.secret)).body;
  assert.deepEqual([unpaid.again, unpaid.paid, unpaid.marks, unpaid.embers, unpaid.pity], [true, false, null, 0, []]);
  assert.equal(player(me).eg_pity, 0, 'an unpaid receipt moves no pity');
});

test('EG-E1 A REHEARSAL PAYS NOTHING AT ALL: its Redoubt is recorded, unpaid - no Marks, no embers, no pity, no key - and takes nothing from the week, so the same Redoubt taken for real that week pays (mutants: the Rehearsal paid; its row taking the week)', async (t) => {
  const { S, claim, breach, raw, player } = await stood(t);
  die(t, 0x00);
  const me = await S.registered('Rehearser');
  raw.prepare('UPDATE players SET eg_pity = ? WHERE id = ?').run(EG_PANOPLY_PITY, me.id);
  const rh = (await claim(me, { b: breach(), w: 5, rh: true })).body;
  assert.deepEqual([rh.recorded, rh.paid, rh.marks, rh.deed, rh.embers, rh.weir, rh.pity], [true, false, null, null, 0, null, []]);
  assert.deepEqual([player(me).eg_keys, player(me).eg_pity], [0, EG_PANOPLY_PITY], 'no key, no pity moved');
  const real = (await claim(me, { b: breach(), w: 5 })).body;
  assert.deepEqual([real.paid, real.marks.struck, real.embers, real.weir.found, real.pity], [true, 20, egEmbersOf(5, true), true, [0]], 'the week still the real one\'s');
});

test('EG-E1 MARKS INSIDE THE SHARED CAP: two gates strike 100, and the Redoubts the rest of the day\'s 150 - 20, 20, then the 10 the day has left, then `cap` - the gates\' and the Spire\'s one count; the next day strikes again (mutants: the Spire outside the cap; the day\'s last strike whole)', async (t) => {
  const { S, claim, breach, at, now, balance } = await stood(t);
  const me = await S.registered('Capped');
  assert.equal((await S.claim(me, 700, now())).body.marks.struck, 50);
  assert.equal((await S.claim(me, 701, now())).body.marks.struck, 50);
  const b = breach();
  const struck = [];
  for (const w of [1, 2, 3, 4]) struck.push((await claim(me, { b, w })).body.marks);
  assert.deepEqual(struck.map((m) => [m.struck, m.why ?? null]), [[20, null], [20, null], [10, null], [0, 'cap']]);
  assert.deepEqual(struck[3].combat, { earned: 150, max: 150 });
  assert.equal(balance(me), 150);
  at(now() + DAY);
  assert.equal((await claim(me, { b: breach(), w: 6 })).body.marks.struck, 20, 'a new UTC day');
});

test('EG-E1 A GUILD\'S DEED: three of one guild\'s accounts, each seven days in it, taking the same Redoubt of the same breach strike its treasury 25, said in the third claim\'s answer; a member whose claim the week does not pay (that Redoubt taken already this week) marks nothing; another breach\'s Redoubt is another event (mutants: the deed unpaid; the guard without the week\'s pay; the event one a Redoubt for every breach)', async (t) => {
  const { S, claim, breach, raw, lines } = await stood(t);
  const gm = await S.registered('Aldric', { renown: 10 });
  const g = (await S.found(gm, { name: 'The Spire Guild', tag: 'SPR' })).body.guild;
  const join = async (handle) => {
    const w = await S.registered(handle);
    await S.call('/v1/guilds/invite', { character: gm.character, handle }, gm.secret);
    await S.call('/v1/guilds/answer', { character: w.character, guild: g.id, accept: true }, w.secret);
    return w;
  };
  const [bran, cass, dain] = [await join('Bran'), await join('Cass'), await join('Dain')];
  raw.prepare('UPDATE guild_members SET joined_at = joined_at - ? WHERE guild_id = ?').run(8 * DAY, g.id);
  const b = breach(), elsewhere = breach();
  // Dain took Redoubt 4 already this week: the breach's claim is not paid, and marks nothing
  assert.equal((await claim(dain, { b: elsewhere, w: 4 })).body.paid, true);
  assert.equal((await claim(bran, { b, w: 4, character: bran.character })).body.deed, null);
  assert.equal((await claim(cass, { b, w: 4, character: cass.character })).body.deed, null, 'two is no deed');
  const d = (await claim(dain, { b, w: 4, character: dain.character })).body;
  assert.deepEqual([d.paid, d.deed], [false, null], 'an unpaid claim marks nothing');
  assert.equal(lines('guild-deed').length, 0);
  // Redoubt 5 of the same breach: all three paid, the third strikes it
  assert.equal((await claim(bran, { b, w: 5, character: bran.character })).body.deed, null);
  assert.equal((await claim(cass, { b, w: 5, character: cass.character })).body.deed, null);
  const third = (await claim(dain, { b, w: 5, character: dain.character })).body;
  assert.deepEqual(third.deed, { struck: MARKS_FAUCETS.deed.amount, guild: { name: 'The Spire Guild', tag: 'SPR' } });
  assert.deepEqual(lines('guild-deed').map((l) => [l.dst_kind, l.dst_id, l.amount, l.rid]), [['guild', g.id, 25, `deed:eg:${b}:5`]]);
  // another breach's Redoubt 5 is another event - and none of the three is paid for it this week
  const b2 = breach();
  for (const who of [bran, cass, dain]) assert.equal((await claim(who, { b: b2, w: 5, character: who.character })).body.deed, null);
  assert.equal(lines('guild-deed').length, 1);
});

test('EG-E1 EMBERS IN THE PURSE: a Valkynaz\'s Redoubt pays 1 + floor(R/10) and a first this season 1 more, into the purse the insignia spend beside a gate\'s - thirty-odd embers buy the Gatebreaker title; an unpaid row pays none (mutants: the Spire\'s embers outside the purse; the stones written on an unpaid row)', async (t) => {
  const { S, claim, breach, now } = await stood(t);
  const me = await S.registered('Emberkeeper');
  await S.claim(me, 700, now());
  const b = breach();
  const paid = [];
  for (const w of [10, 20, 30, 40, 50, 60]) paid.push((await claim(me, { b, w })).body.embers);
  assert.deepEqual(paid, [10, 20, 30, 40, 50, 60].map((w) => egEmbersOf(w, true)));
  assert.deepEqual(paid, [3, 4, 5, 6, 7, 8]);
  const unpaid = (await claim(me, { b: breach(), w: 60 })).body;
  assert.deepEqual([unpaid.paid, unpaid.embers, unpaid.purse], [false, 0, 34]);
  const title = INSIGNIA.find((o) => o.kind === 'title');
  const bought = await S.call('/v1/account/insignia', { item: title.id }, me.secret);
  assert.equal(bought.status, 200, JSON.stringify(bought.body));
  assert.equal(bought.body.purse, 34 - title.price, 'the Spire\'s embers spent beside the gate\'s');
});

test('EG-E1 THE VALKYNAZ\'S KEY: at a paid Valkynaz\'s Redoubt the service\'s own die finds a Weir Key one time in four (`weir`, as the gate\'s claim says it), at most one an account an arena week - a second Valkynaz that week finds none, the next week one again; never at another Redoubt, never on the die\'s high side; a claim asked again says the key it found (mutants: the week\'s bound unread; the odds; the key at every Redoubt)', async (t) => {
  const { S, claim, breach, receipt, at, player } = await stood(t);
  const me = await S.registered('Keyfinder');
  die(t, 0xff);
  assert.deepEqual((await claim(me, { b: breach(), w: 5 })).body.weir, { found: false, keys: 0 }, 'the die high: no key');
  die(t, 0x00);
  assert.equal((await claim(me, { b: breach(), w: 4 })).body.weir, null, 'not a Valkynaz\'s');
  const b = breach();
  const r = await receipt(me, { b, w: 10 });
  assert.deepEqual((await S.call('/v1/eg/claim', { receipt: r }, me.secret)).body.weir, { found: true, keys: 1 });
  assert.equal(player(me).eg_valk_wk, arenaWeekOf(NOW0));
  assert.deepEqual((await S.call('/v1/eg/claim', { receipt: r }, me.secret)).body.weir, { found: true, keys: 1 }, 'asked again: the key it found, once');
  assert.deepEqual((await claim(me, { b, w: 15 })).body.weir, { found: false, keys: 1 }, 'one a week');
  at(NOW0 + WK);
  assert.deepEqual((await claim(me, { b: breach(), w: 15 })).body.weir, { found: true, keys: 2 }, 'the next week, one again');
  // the odds: one in four - a draw just under a quarter finds, one at it does not
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  let byte = [0x3f, 0xff, 0xff, 0xff];
  t.mock.method(globalThis.crypto, 'getRandomValues', (a) => (a.length === 4 ? (a.set(byte), a) : real(a)));
  at(NOW0 + 2 * WK);
  assert.equal((await claim(me, { b: breach(), w: 20 })).body.weir.found, true, 'just under a quarter');
  byte = [0x40, 0x00, 0x00, 0x00];
  at(NOW0 + 3 * WK);
  assert.equal((await claim(me, { b: breach(), w: 20 })).body.weir.found, false, 'a quarter is not under it');
});

test('EG-E1 THE PANOPLY\'S PITY: ten passes in a row with no piece, and the eleventh is forced (`pity` names it) and the count starts again; a hit by its own draw resets it; a Valkynaz\'s two passes counted in order - at nine, the first misses to ten and the second is forced (mutants: the pity never forced; the count never reset; a hit not resetting; the passes counted at once)', async (t) => {
  const { S, claim, breach, player, raw } = await stood(t);
  const me = await S.registered('Pitied');
  const b = breach();
  const ws = [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13];
  // PIN MOVED (AUDIT EG V, d: lane8 L8-5 - the spoils roll on the receipt's seed mixed with the claim's own draw): the
  // service's 8-byte draws fixed, so the misses are read on the seed the claims answer (net/eliteGates/egPay.js egSpoilsSeed)
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  t.mock.method(globalThis.crypto, 'getRandomValues', (u) => (u.length === 8 ? u.fill(0) : real(u)));
  const on = (c) => egSpoilsSeed(c, '0'.repeat(16));
  // a receipt whose own `c` WOULD hit somewhere among them, so a pity read off the receipt's seed would reset
  const c1 = [...Array(65536).keys()].find((c) => ws.every((w) => !egPanoplyHit(on(c), w, 0)) && !egPanoplyHit(on(c), 15, 0) && !egPanoplyHit(on(c), 15, 1) && !egPanoplyHit(on(c), 14, 0) && ws.some((w) => egPanoplyHit(c, w, 0)));
  assert.ok(c1 != null);
  for (const w of ws) assert.equal(egPanoplyHit(on(c1), w, 0), false, `the claim's seed misses at Redoubt ${w}`);
  const forced = [];
  for (const w of ws) { const a = (await claim(me, { b, w, c: c1 })).body; assert.equal(a.seed, on(c1), 'the seed answered'); forced.push(a.pity); }
  assert.deepEqual(forced, [[], [], [], [], [], [], [], [], [], [], [0]], 'the eleventh pass forced');
  assert.equal(player(me).eg_pity, 0, 'and the count starts again');
  assert.equal((await claim(me, { b, w: 14, c: c1 })).body.pity.length, 0);
  assert.equal(player(me).eg_pity, 1);
  // a hit resets it
  const hit = [...Array(4096).keys()].find((c) => egPanoplyHit(on(c), 16, 0) && !egPanoplyHit(c, 16, 0));   // a hit on the claim's seed alone
  assert.equal((await claim(me, { b, w: 16, c: hit })).body.pity.length, 0);
  assert.equal(player(me).eg_pity, 0, 'a piece by its own draw: the count to nothing');
  // a Valkynaz's two passes, in order
  raw.prepare('UPDATE players SET eg_pity = ? WHERE id = ?').run(EG_PANOPLY_PITY - 1, me.id);
  assert.deepEqual([egPanoplyHit(on(c1), 15, 0), egPanoplyHit(on(c1), 15, 1)], [false, false]);
  assert.deepEqual((await claim(me, { b, w: 15, c: c1 })).body.pity, [1]);
  assert.equal(player(me).eg_pity, 0);
});

test('EG-E1 THE RELIQUARIES THE END OPENS: of the circles an end names (one entry a Reliquary), those whose Redoubt this breach recorded paid, and those it never recorded that no breach of the account was paid for this week; a circle whose Redoubt the week already paid elsewhere opens none; asked again the same; a Rehearsal\'s none (mutants: every Reliquary opened; the week\'s pay elsewhere unread)', async (t) => {
  const { S, claim, breach, now } = await stood(t);
  const me = await S.registered('Homeward');
  const before = breach(), b = breach();
  await claim(me, { b: before, w: 3 });
  await claim(me, { b: before, w: 6 });
  for (const w of [1, 2, 3]) await claim(me, { b, w });
  // 1 (twice - a Vault's and the Redoubt's own), 2: paid here; 3: paid in the breach before, so this breach's row is not;
  // 4: never recorded here, and paid nowhere this week; 6: never recorded here, paid in the breach before
  const x = await mintEgReceipt({ q: 'x', b, s: me.id, z: Z, c: 9, h: 15, t: 2000, n: 1, ew: 0, l: 12, why: 'home', rl: [1, 1, 2, 3, 4, 6] }, S.gatePriv, { subtle, nowS: now() });
  const end = (await S.call('/v1/eg/claim', { receipt: x }, me.secret)).body;
  assert.deepEqual([end.recorded, end.rl], [true, [1, 1, 2, 4]], 'the circles the week already paid open none');
  assert.deepEqual((await S.call('/v1/eg/claim', { receipt: x }, me.secret)).body.rl, [1, 1, 2, 4], 'asked again');
  const none = await mintEgReceipt({ q: 'x', b: breach(), s: me.id, z: Z, c: 9, h: 3, t: 200, n: 1, ew: 0, l: 12, why: 'fall' }, S.gatePriv, { subtle, nowS: now() });
  assert.equal((await S.call('/v1/eg/claim', { receipt: none }, me.secret)).body.rl, undefined, 'an end that opens none says none');
  const rh = await mintEgReceipt({ q: 'x', b: breach(), s: me.id, z: Z, c: 9, h: 5, t: 300, n: 1, ew: 0, l: 12, why: 'rehearsal', rh: 1, rl: [9] }, S.gatePriv, { subtle, nowS: now() });
  assert.deepEqual((await S.call('/v1/eg/claim', { receipt: rh }, me.secret)).body.rl, [], 'a Rehearsal opens none');
});

test('EG-E1 THE SIGNED WIN\'S FILL: a paid Redoubt fills the playing character\'s budget (INT5 grantSpoils); one the week already paid does not (mutants: the fill on every recorded receipt)', async (t) => {
  const { S, claim, breach, raw, now } = await stood(t);
  const me = await S.registered('Budgeted');
  raw.prepare('INSERT INTO realm_characters (id, player, name, lease, created_at, updated_at, allowance, level_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('rc-eg1', me.id, 'Budgeted', 'lease-1', now(), now(), 1000, 1);
  const allowance = () => raw.prepare('SELECT allowance FROM realm_characters WHERE id = ?').get('rc-eg1').allowance;
  await claim(me, { b: breach(), w: 2 });
  const filled = allowance();
  assert.ok(filled > 1000, 'the paid Redoubt filled it');
  await claim(me, { b: breach(), w: 2 });
  assert.equal(allowance(), filled, 'the week\'s second fills nothing');
});

test('EG-E1 THE BROKER\'S PANOPLY SINK: one piece of the buyer\'s choosing, once an account an arena week, for 20 embers from the insignia\'s purse - `short` (409, the purse and the price) before it holds them, `bought` (409) a second time that week, the next week again; a guest 403, a piece not the Panoply\'s 400; `/v1/eg/keys` says the week\'s sale; the client\'s door posts it (mutants: the week unasked; the purse unasked; the price; the row written on a refused sale)', async (t) => {
  const { S, raw, at, player } = await stood(t);
  const me = await S.registered('Buyer');
  const piece = EG_PANOPLY_IDS[0];
  const short = await S.call('/v1/eg/sink', { piece }, me.secret);
  assert.deepEqual([short.status, short.body], [409, { error: 'short', purse: 0, price: EG_SINK_EMBERS }]);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM eg_sink').get().n, 0, 'a refused sale writes no row');
  assert.equal(accountRefusalText('short'), 'Your account has too few embers for that.');
  for (let i = 0; i < 25; i++) raw.prepare('INSERT INTO serpent_kills (day, account, boss, hull, char_id, xp, nonce, at, stones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(2001 + i, me.id, 'sethrakul', 4, me.character, 0, `n${i}`, NOW0, 1);
  const almost = await S.call('/v1/eg/sink', { piece }, me.secret);
  assert.equal(almost.status, 200, JSON.stringify(almost.body));
  assert.deepEqual(almost.body, { ok: true, piece, week: arenaWeekOf(NOW0), purse: 5 });
  assert.equal(player(me).insignia_spent, EG_SINK_EMBERS);
  assert.deepEqual((await S.call('/v1/eg/keys', {}, me.secret)).body.sink, { week: arenaWeekOf(NOW0), piece });
  // a second sale that week, with the purse to pay it: refused, nothing spent
  for (let i = 0; i < 20; i++) raw.prepare('INSERT INTO serpent_kills (day, account, boss, hull, char_id, xp, nonce, at, stones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(2501 + i, me.id, 'sethrakul', 4, me.character, 0, `p${i}`, NOW0, 1);
  const twice = await S.call('/v1/eg/sink', { piece: EG_PANOPLY_IDS[8] }, me.secret);
  assert.deepEqual([twice.status, twice.body], [409, { error: 'bought', piece }], 'one a week');
  assert.equal(player(me).insignia_spent, EG_SINK_EMBERS, 'nothing spent on the refused second');
  assert.deepEqual([(await S.call('/v1/eg/sink', { piece: 'title:gatebreaker' }, me.secret)).status, (await S.call('/v1/eg/sink', {}, me.secret)).body], [400, { error: 'piece' }]);
  const g = await S.guest();
  assert.deepEqual([(await S.call('/v1/eg/sink', { piece }, g.secret)).status, (await S.call('/v1/eg/sink', { piece }, g.secret)).body], [403, { error: 'guest' }]);
  // the next week: again, through the client's door (net/accountClient.js accountEg) - and then short of a third twenty
  at(NOW0 + WK);
  const door = accountEg({ fetch: S.fetch, storage: sessionStorageOf(SESSION_KEY, me) });
  const sold = await door.sink(EG_PANOPLY_IDS[8]);
  assert.deepEqual([sold.ok, sold.data], [true, { ok: true, piece: EG_PANOPLY_IDS[8], week: arenaWeekOf(NOW0 + WK), purse: 5 }]);
  at(NOW0 + 2 * WK);
  assert.deepEqual((await S.call('/v1/eg/sink', { piece }, me.secret)).body, { error: 'short', purse: 5, price: EG_SINK_EMBERS });
  assert.deepEqual(raw.prepare('SELECT wk, piece FROM eg_sink WHERE account = ? ORDER BY wk').all(me.id).map((r) => [r.wk, r.piece]), [[arenaWeekOf(NOW0), piece], [arenaWeekOf(NOW0 + WK), EG_PANOPLY_IDS[8]]]);
  assert.equal(accountRefusalText('bought'), 'You have bought from the Panoply this week. Come back next week.');
  let body = null;
  const spy = accountEg({ fetch: async (u, i) => { body = JSON.parse(i.body); return S.fetch(u, i); }, storage: sessionStorageOf(SESSION_KEY, me) });
  await spy.claim('e1.x.y', 'char-buyer');
  assert.deepEqual(body, { receipt: 'e1.x.y', character: 'char-buyer' });
  await spy.claim('e1.x.y');
  assert.deepEqual(body, { receipt: 'e1.x.y' }, 'no character, none sent');
});
