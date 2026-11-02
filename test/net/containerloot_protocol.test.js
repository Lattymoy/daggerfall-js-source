// OUTDOOR-LOOT, SLICE 2 (2026-10-17) - RED PINS, A BUILDING'S CUPBOARDS UNDER ONE SEAT'S CLAIMS (AC8). test-harness/outdoor-loot/
// DESIGN.md section 4 is the plan; DESIGN-REVIEW.md is binding over it (R-1, R-3, R-5, D-1, D-1a). test/net/containerloot.test.js
// is phase 1 (what a cupboard must be for everyone in the building, read as where the pieces ARE); this file pins what the fix
// must SAY and DO on the way, black-box, before it exists:
//   1. THE FIRST OPEN (T22 rest, R-3): two first-opens in one breath converge on the EARLIER mint by the SHARED clock - never
//      the machine's own - and a piece the loser took from its own roll is the winner's or it is not kept; equal instants too.
//   2. FIRST COME (T23): one seat judges each claim in the order it hears them, the loser is told ROOM_TAKEN_TEXT; the seat's
//      own take and a claim race by who came first; a Take all of more than 32 pieces lands every piece in consecutive claim
//      words; a word the act budget or the relay drops is said again, none lost.
//   3. THE SEAT (R-1, T24): the seat judges and says its verdict ON RECEIPT - its frame never runs and the claim still lands;
//      when the seat leaves, the new seat judges what the last left unanswered in roomClaimOrder, none twice, none lost.
//   4. THE CLAIMER'S LEAVE (D-1): a claim in flight and not lapsed when its claimer leaves goes with the claimer and the seat's
//      grant stands - one copy; a lapsed claim is not kept; the limit main's own dungeon has is recorded; R-5: a take the seat
//      refused still enters the theft basket.
//   5. THE PROTECTIONS (T25) and THE PEEK (T26), the OLDER BUILDS (T27), and the SHELF that keeps WORLD6a's whole-list word.
//
// MOUNTED, NOT MATCHED, and never a module that does not exist yet: the players are the interior host's own doors, sliced out of
// worldModes.js (./containerLootHarness.mjs says how, and follows a door that moves into a module the host imports), over the
// real pure half and the real producers, on a controllable clock, joined by a relay stand-in that carries the act frames and
// logs every word it accepts (`net.log`, `net.words`). Where the design FIXES a word's shape (DESIGN 4.2: PARTY-LOOT's room word -
// `g lv n tm h x c s si q a y t` - plus `b`, the carried base, and `d`, the day) a pin reads it; everywhere else a pin reads where
// every piece IS for every player and the room's memory, once every timeout has passed.
//
// Run against the tree at f103d56fad every red pin fails by its assertion, with a message naming the missing behaviour; the
// guards (named so) pass and must stay green through the fix.
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_TAKEN_TEXT, ROOM_CLAIM_TIMEOUT_MS, ROOM_CLAIMS_MAX, ROOM_PUT_RESAY_MS, ROOM_ANSWERS_KEPT, roomClaimOrder, baseSignature } from '../../src/systems/roomLoot.js';
import { LOOT_NEWER_TEXT } from '../../src/systems/loot/loot.js';
import { resetQuickLoot, foldQuickLoot, quickLootArm, quickLootTake, quickLootRow, quickLootSelection } from '../../src/systems/quickLoot.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { isStolen } from '../../src/systems/stolenGoods.js';
import { ledgerKeyOf } from '../../src/systems/item/itemIds.js';
import { templateByIndex } from '../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { applyRarity } from '../../src/systems/loot/lootRarity.js';
import { seeded } from '../honestItems.mjs';
import {
  REAL_RANDOM, TODAY, KEY, ROOM, LOOT_LIST_MAX, clock, items, names, mk, peekNames, packHas, have, windowOf, realWindowOf, bulk, frame, elapse, quiesce,
  rolled, firstOpen, pressYes, pressNo, joiner, older, lightPieces, wallNow, WALL0, clone, plaque, LEAVE_SITES, relay, player, cupboard, building,
  recordsOf, SHOP, openShelfOf, shelfOf, olderApplyInteriorLoot,
} from './containerLootHarness.mjs';

afterEach(() => { Math.random = REAL_RANDOM; resetQuickLoot(); setSharedClock(null); });

// ── what a cupboard is ───────────────────────────────────────────────────────────────────────────────────────────────
/** The room's stock when a pin does not care what is in it: four distinct pieces, none stacking with another. */
const STOCK = () => [mk('Dagger'), mk('Mace'), mk('Katana'), mk('Staff')];
/** A building whose cupboard A (the seat) first-opened on `stock`, closed, and everyone has heard: the room's one list. */
function born(n = 3, stock = STOCK(), opts = {}) {
  const s = rolled(n, [stock], opts);
  const wa = firstOpen(s.A);
  assert.deepEqual(names(items(s.A)), names(stock), 'A\'s first open shows the roll it made (guard)');
  wa.close(); frame(s.A); s.net.flush();
  for (const p of s.ps) assert.deepEqual(names(items(p)), names(stock), `${p.id} holds the room's one list once A has opened and closed it (guard)`);
  s.stock = stock;
  return s;
}
/** The pieces named in every present player's pack, and the lists that still show it - for a message. */
const whereIs = (s, name) => JSON.stringify({ packs: Object.fromEntries(s.ps.map((p) => [p.id, packHas(p, name)]).filter(([, n]) => n)), lists: s.ps.filter((p) => have(items(p), name)).map((p) => p.id) });
/** How many of a piece the players hold between them. */
const copies = (s, name) => s.ps.reduce((n, p) => n + packHas(p, name), 0);
const told = (p) => p.said.includes(ROOM_TAKEN_TEXT);
/** A new-shape birth word (DESIGN 4.2): PARTY-LOOT's room word - the terms, the base's signature - plus `b`, the carried base,
 *  and `d`, the day (equal to `g`, kept for older builds). The wire's own spelling of a first open. */
const birthWord = (base, { g = TODAY, lv = 1, n = 1, tm = wallNow(), d = g, extra = {} } = {}) => ({ k: KEY, g, lv, n, tm, h: baseSignature(base), b: clone(base), s: [], si: [], d, ...extra });
/** The act frame a peer says about the cupboard. */
const actOf = (word) => ({ k: ROOM, l: [word] });
/** Every client's list, as names. */
const lists = (s) => Object.fromEntries(s.ps.filter((p) => p.kind === 'client').map((p) => [p.id, names(items(p))]));

// ═══ T22 (rest) - THE LOSER OF A FIRST-OPEN KEEPS NOTHING OF A ROLL THAT NEVER WAS THE ROOM'S (AC8) ═════════════════════
// Two first-opens in one breath give two births of one day. The earlier mint by the SHARED clock is the room's everywhere;
// the loser's window shows its own birth until it closes (AUDIT WORLD4 C1) and its takes are claims on a base that is gone:
// refused, lifted back, and said (DESIGN 4.3). Phase 1's AC8 (c) pins that the lists agree; this pins what the loser TOOK.
for (const loser of ['the seat', 'a claimer']) {
  test(`T22 AC8 (rest) [the loser is ${loser}]: the earlier mint wins; a piece taken from the LOSING roll is not kept - the loser's pack holds none of it, it is told, and every list ends on the winner's`, () => {
    const winRoll = [mk('Dagger'), mk('Mace')], loseRoll = [mk('Katana'), mk('Staff')];
    const seat = loser === 'the seat';
    const s = rolled(3, seat ? [loseRoll, winRoll] : [winRoll, loseRoll]);
    const [W, L] = seat ? [s.B, s.A] : [s.A, s.B];
    const ww = firstOpen(W);
    clock.t += 5;
    const wl = firstOpen(L);   // five milliseconds later by the shared clock: the later mint
    s.net.flush();   // the births cross; each window still stands on its own roll
    wl.takeNamed('Katana');   // the loser takes a piece of its OWN roll
    ww.close(); wl.close();
    quiesce(s);
    assert.equal(packHas(L, 'Katana'), 0, `T22/AC8: ${L.id}, whose first open LOST the tie-break, holds the Katana it took from its own roll (${whereIs(s, 'Katana')}) - a piece of a roll that never was the room's: there is no mint, no claim, no authority - the take is simply kept (the last close wins, and the closes crossed)`);
    assert.ok(told(L), `T22/AC8: ${L.id}'s take of a piece of a base that is gone is refused and SAID (ROOM_TAKEN_TEXT) - it was told: ${JSON.stringify(L.said)}`);
    assert.deepEqual(L.entity.items.map((it) => it.name).filter((n) => !['Dagger', 'Mace'].includes(n)), [], `T22/AC8: nothing in ${L.id}'s pack but pieces of the winning roll`);
    for (const p of s.ps) assert.deepEqual(names(items(p)), ['Dagger', 'Mace'], `T22/AC8: ${p.id} ends on the EARLIER mint's list (${JSON.stringify(lists(s))})`);
    const D = joiner(s, 'dddd-0004');
    assert.deepEqual(names(items(D)), ['Dagger', 'Mace'], 'T22/AC8: and the memory a later player walks in on is that list too');
  });
}

// ═══ R-3 - THE FIRST-OPEN TIE-BREAK READS THE SHARED CLOCK, NEVER THE MACHINE'S (DESIGN-REVIEW R-3) ═════════════════════
// roomTermsBeat keeps the earlier mint by `tm`. The design writes `tm: wallNow`; Date.now() and performance.now() are this
// machine's own clock, which may be minutes off, and a client whose clock runs slow would win every first-open. Here the
// player who opens FIRST by the shared clock has the machine clock that reads LATER (ten minutes fast), so a stamp read
// from the machine's clock picks the wrong winner on every client.
for (const first of ['A', 'B']) {
  test(`R-3 AC8 [${first} opens first by the shared clock, on a machine ten minutes FAST]: the earlier mint by the SHARED clock wins on every client, whatever their own clocks read`, () => {
    const rollA = [mk('Dagger'), mk('Mace')], rollB = [mk('Katana'), mk('Staff')];
    const skews = first === 'A' ? [600_000, 0] : [0, 600_000];
    const s = rolled(3, [rollA, rollB], { each: [{ skew: skews[0] }, { skew: skews[1] }] });
    const [E, L] = first === 'A' ? [s.A, s.B] : [s.B, s.A];
    const [win, lose] = first === 'A' ? [rollA, rollB] : [rollB, rollA];
    const we = firstOpen(E);
    clock.t += 5;   // the other opens five milliseconds later by the shared clock, minutes EARLIER by its own
    const wl = firstOpen(L);
    s.net.flush();
    we.close(); wl.close();
    quiesce(s);
    const want = names(win);
    for (const p of s.ps) assert.deepEqual(names(items(p)), want, `R-3/AC8: ${p.id} ends on ${JSON.stringify(names(items(p)))}, not on the earlier mint's ${JSON.stringify(want)} (${E.id} opened first by the shared clock; its machine clock reads ten minutes LATER than ${L.id}'s, so a first-open stamped from Date.now() or performance.now() lets the wrong one win everywhere) - lists ${JSON.stringify(lists(s))}`);
    const D = joiner(s, 'dddd-0004', { skew: -300_000 });
    assert.deepEqual(names(items(D)), want, 'R-3/AC8: and the memory a later player (whose own clock is five minutes slow) walks in on');
    for (const p of [E, L]) assert.equal(p.entity.items.some((it) => names(lose).includes(it.name)), false, `no piece of the losing roll in ${p.id}'s pack`);
  });
}

test('T22 AC8 (extra - equal instants, a gap in the written design: roomTermsBeat breaks a tie only on the terms, and two carried bases share them): two first-opens stamped by the very same shared reading still converge - one roll everywhere, never two lists the room cannot reconcile', () => {
  const rollA = [mk('Dagger'), mk('Mace')], rollB = [mk('Katana'), mk('Staff')];
  const s = rolled(3, [rollA, rollB]);
  const wa = firstOpen(s.A, { advance: 0 }), wb = firstOpen(s.B, { advance: 0 });   // no millisecond between them: equal `tm`, equal terms, two different bases
  s.net.flush();
  wa.close(); wb.close();
  quiesce(s);
  const a = names(items(s.A));
  assert.ok(JSON.stringify(a) === JSON.stringify(names(rollA)) || JSON.stringify(a) === JSON.stringify(names(rollB)), `T22/AC8 (tie): A ends on ${JSON.stringify(a)}, neither first open's roll`);
  for (const p of s.ps) assert.deepEqual(names(items(p)), a, `T22/AC8 (tie): ${p.id} ends on ${JSON.stringify(names(items(p)))}, not on A's ${JSON.stringify(a)} - two births of one day with the same stamp are two bases the merge cannot tell apart (sameRoomTerms reads g, lv and n alone): each client keeps its own - ${JSON.stringify(lists(s))}`);
});

// ═══ T23 - FIRST COME, ONE AUTHORITY (AC8) ══════════════════════════════════════════════════════════════════════════════
test('T23 AC8: two players who are NOT the seat take the same piece in one breath - exactly one copy, the first to reach the seat has it, and the loser is told ROOM_TAKEN_TEXT and holds nothing of it', () => {
  const s = born(3);
  const wb = windowOf(s.B), wc = windowOf(s.C);
  assert.ok(pressYes(s.B, wb) && pressYes(s.C, wc), 'B and C open the cupboard');
  wb.takeNamed('Mace'); wc.takeNamed('Mace');   // each takes it from the list it sees
  wb.close(); wc.close();
  frame(s.B); frame(s.C);   // both claims are on the wire before either verdict
  s.net.flush();
  quiesce(s);
  assert.equal(copies(s, 'Mace'), 1, `T23/AC8: B and C took the same Mace in one breath and the players hold ${copies(s, 'Mace')} copies of it (${whereIs(s, 'Mace')}) - nothing judges a take: each client's take is its own, and the later close's whole list lands over the other's`);
  assert.equal(packHas(s.B, 'Mace'), 1, 'T23/AC8: the claim that reached the seat first (B\'s) has the piece');
  assert.equal(packHas(s.C, 'Mace'), 0, 'T23/AC8: and C holds nothing of it');
  assert.ok(told(s.C), `T23/AC8: the loser is told "Someone took that first." (ROOM_TAKEN_TEXT) - C heard ${JSON.stringify(s.C.said)}`);
  assert.equal(told(s.B), false, 'the winner is told nothing');
  for (const p of s.ps) assert.equal(have(items(p), 'Mace'), 0, `T23/AC8: ${p.id}'s list shows the Mace no more`);
});

test('T23 AC8: the seat\'s OWN take against a claim - first come wins: the seat took it first (its take was read, its word said), so the claim that reaches it after is refused and told', () => {
  const s = born(3);
  const wa = windowOf(s.A), wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard, and leaves it open (its list will not change under it)');
  assert.ok(pressYes(s.A, wa), 'A opens it');
  wa.takeNamed('Katana'); wa.close(); frame(s.A); s.net.flush();   // the seat took it first
  wb.takeNamed('Katana');   // B\'s window still shows the row
  wb.close(); frame(s.B); s.net.flush();
  quiesce(s);
  assert.equal(copies(s, 'Katana'), 1, `T23/AC8: the seat took the Katana, then B took the same row from the window it had open - ${copies(s, 'Katana')} copies (${whereIs(s, 'Katana')}): a take of a piece another already has is never judged`);
  assert.equal(packHas(s.A, 'Katana'), 1, 'T23/AC8: the seat keeps what it took first');
  assert.ok(told(s.B), `T23/AC8: B is told ROOM_TAKEN_TEXT - it heard ${JSON.stringify(s.B.said)}`);
});

test('T23 AC8: a claim reaches the seat FIRST and the seat\'s own take of the same piece comes after - the seat\'s take is refused: lifted back out of its pack, and it is told', () => {
  const s = born(3);
  const wa = windowOf(s.A), wb = windowOf(s.B);
  assert.ok(pressYes(s.A, wa), 'A opens the cupboard and leaves it open (its list will not change under it)');
  assert.ok(pressYes(s.B, wb), 'B opens it');
  wb.takeNamed('Katana'); wb.close(); frame(s.B); s.net.flush();   // B\'s claim reached the seat first
  wa.takeNamed('Katana');   // A\'s window still shows the row
  wa.close(); frame(s.A); s.net.flush();
  quiesce(s);
  assert.equal(copies(s, 'Katana'), 1, `T23/AC8: B's claim reached the seat first, then the seat took the same row from its open window - ${copies(s, 'Katana')} copies (${whereIs(s, 'Katana')})`);
  assert.equal(packHas(s.B, 'Katana'), 1, 'T23/AC8: the first to come has it');
  assert.equal(packHas(s.A, 'Katana'), 0, 'T23/AC8: the seat\'s own take is lifted back out of its pack');
  assert.ok(told(s.A), `T23/AC8: and it is told - A heard ${JSON.stringify(s.A.said)}`);
});

test(`T23 AC8: a Take all of MORE than ${ROOM_CLAIMS_MAX} pieces by a player who is not the seat - every piece lands, said in consecutive claim words of at most ${ROOM_CLAIMS_MAX} claims; none is left to lapse back`, () => bulk((dom) => {
  const stock = lightPieces(ROOM_CLAIMS_MAX + 8);
  const s = born(3, stock);
  const wb = realWindowOf(s.B, dom);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  assert.equal(items(s.B).length, stock.length, 'B\'s window lists all of it (guard)');
  wb.press('Take all');
  assert.equal(s.B.entity.items.length, stock.length, 'B\'s Take all moved every row into its pack (guard)');
  wb.close(); frame(s.B); s.net.flush();
  const claimWords = s.net.words(s.B).filter((r) => Array.isArray(r.q));
  assert.ok(claimWords.length >= 2, `T23/AC8: B's Take all of ${stock.length} pieces was said in ${claimWords.length} claim words (\`q\`) - the design says a bulk take is a CLAIM per piece, ${ROOM_CLAIMS_MAX} to a word and consecutive words after that (DESIGN 4.4); today it is one whole-list word at the close (${JSON.stringify(s.net.words(s.B).map((r) => Object.keys(r).filter((k) => !k.startsWith('__'))))})`);
  assert.ok(claimWords.every((r) => r.q.length <= ROOM_CLAIMS_MAX), 'T23/AC8: no word carries more than ROOM_CLAIMS_MAX claims');
  const ids = claimWords.flatMap((r) => r.q.map((c) => c.id));
  assert.equal(new Set(ids).size, stock.length, `T23/AC8: every piece of the Take all is claimed once - ${new Set(ids).size} distinct claims for ${stock.length} pieces (PARTY-LOOT's \`q.slice(-ROOM_CLAIMS_MAX)\` would never say the oldest)`);
  const landed = stock.filter((it) => packHas(s.B, it.name) === 1).length;
  assert.equal(landed, stock.length, `T23/AC8: ${landed} of the ${stock.length} pieces had landed when the seat had answered the claims - a host word carries the verdicts for the claims it answers (\`y\`, ${ROOM_ANSWERS_KEPT} to a word and consecutive words after that), not the latest ${ROOM_ANSWERS_KEPT}: a verdict pushed out of the word reaches its claimer only when it asks again, seconds later (PARTY-LOOT's latent loss)`);
  quiesce(s);
  for (const it of stock) assert.equal(packHas(s.B, it.name), 1, `T23/AC8: B holds ${it.name} once`);
  for (const p of s.ps) assert.deepEqual(names(items(p)), [], `T23/AC8: ${p.id}'s list is empty - every piece landed, none lapsed back into a list`);
}));

// A claim word that never reaches the seat is said again, with the same ids, until it is answered (DESIGN 4.4: "Claims and
// puts are said again every ROOM_PUT_RESAY_MS until answered. Claims too"): the relay loses it silently (its room budget -
// the sender was told it went), or the home gate refuses it (ACT_HZ_MAX - world.js's pending set re-reads the module's
// CURRENT word through placeActionRecords).
test('T23 AC8: a claim word the RELAY drops (silently - the sender was told it went) is said again with the same ids, and both pieces land once; no list keeps a piece its taker holds', () => {
  const s = born(3);
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  let lost = 0;
  s.net.drop = (from) => from === s.B.id && lost++ < 1;   // the first word B says is lost on the wire
  wb.takeNamed('Dagger'); wb.takeNamed('Mace');
  wb.close(); frame(s.B); s.net.flush();
  assert.equal(lost, 1, 'B\'s first word about the cupboard went to the relay, and the relay lost it (guard)');
  quiesce(s);
  assert.equal(packHas(s.B, 'Dagger'), 1, 'B holds the Dagger once'); assert.equal(packHas(s.B, 'Mace'), 1, 'and the Mace once');
  for (const p of s.ps) for (const n of ['Dagger', 'Mace']) assert.equal(have(items(p), n), 0, `T23/AC8: ${p.id}'s list still shows the ${n} B holds (${whereIs(s, n)}) - the word that took it was lost on the wire and nothing said it again: the piece is in B's pack AND in the cupboard, a dupe`);
  const ids = s.net.words(s.B).filter((r) => Array.isArray(r.q)).flatMap((r) => r.q.map((c) => c.id));
  assert.ok(ids.length > new Set(ids).size, `T23/AC8: the claims were said again under the SAME ids (${ids.length} said, ${new Set(ids).size} distinct) - a seat answers a claim it already judged from its ledger, it never judges one twice`);
});

test('T23 AC8: the FIRST of the two words of a bulk take (the oldest 32 claims) is dropped by the relay - the word that did arrive is judged, the lost claims are said again, and all of the pieces land once', () => bulk((dom) => {
  const stock = lightPieces(ROOM_CLAIMS_MAX + 8);
  const s = born(3, stock);
  const wb = realWindowOf(s.B, dom);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  wb.press('Take all');
  let lost = 0;
  s.net.drop = (from, data) => from === s.B.id && (data.l ?? []).some((r) => Array.isArray(r.q)) && lost++ < 1;
  wb.close(); frame(s.B); s.net.flush();
  quiesce(s);
  assert.ok(lost >= 1, `T23/AC8: B said no claim word (\`q\`) to lose - a Take all of ${stock.length} pieces is said as claims, ${ROOM_CLAIMS_MAX} to a word (today: one whole-list word at the close)`);
  for (const it of stock) assert.equal(packHas(s.B, it.name), 1, `T23/AC8: B holds ${it.name} once`);
  for (const p of s.ps) assert.deepEqual(names(items(p)), [], `T23/AC8: ${p.id}'s list shows nothing B took - none was lost to the dropped word and none lapsed back`);
}));

test('T23 AC8: a word the HOME gate refuses (ACT_HZ_MAX) is not lost - world.js\'s pending set re-reads the cupboard\'s CURRENT word through placeActionRecords, and the word it says is the module\'s: the claims B has in flight (`q`), which the seat judges', () => {
  const s = born(3);
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  wb.takeNamed('Dagger'); wb.takeNamed('Mace');
  s.net.exhaust(s.B);   // five words in the second: the sixth is refused at home
  wb.close(); frame(s.B); s.net.flush();
  assert.equal(s.net.words(s.B).length, 0, 'the word was refused at home: the relay heard none (guard)');
  assert.ok(s.B.act.pend.size > 0, 'and the host holds the key for the heal (guard)');
  quiesce(s);
  const healed = s.net.words(s.B);
  assert.ok(healed.length > 0, 'the heal said a word once a token returned (guard)');
  assert.ok(Array.isArray(healed[0].q) && healed[0].q.length === 2, `T23/AC8: the FIRST word said after the refusal - the pending set's, a token having returned, before any claim is asked again - is today's whole list (${JSON.stringify(healed.slice(0, 2).map((r) => Object.keys(r).filter((k) => !k.startsWith('__'))))}), not the module's current word: B\'s two claims (\`q\`) for the seat to judge (placeActionRecords asks the module)`);
  assert.equal(packHas(s.B, 'Dagger'), 1, 'B holds the Dagger once'); assert.equal(packHas(s.B, 'Mace'), 1, 'and the Mace once');
  for (const p of s.ps) for (const n of ['Dagger', 'Mace']) assert.equal(have(items(p), n), 0, `${p.id}'s list shows the ${n} no more: the refused word healed (${whereIs(s, n)})`);
});

test('T22 AC8: a BIRTH word the relay drops is said again until the seat\'s word is heard for it - B (not the seat) first-opens and keeps its window open; the others have the cupboard\'s list within seconds', () => {
  const s = rolled(3, [null, [mk('Dagger'), mk('Mace')]]);
  let lost = 0;
  s.net.drop = (from) => from === s.B.id && lost++ < 1;
  const wb = firstOpen(s.B); s.net.flush();
  assert.equal(lost, 1, 'B\'s first word, its open, was lost on the wire (guard)');
  elapse(s, 6000);   // B\'s window stays open the while
  assert.ok(wb.cur, 'B\'s window is still open (guard)');
  for (const p of [s.A, s.C]) assert.deepEqual(names(items(p)), ['Dagger', 'Mace'], `T22/AC8: ${p.id} has ${JSON.stringify(items(p))} six seconds after B first-opened the cupboard - the birth was lost on the wire and nothing said it again (the birth is said until the seat\'s word is heard for it)`);
});

test('T23 AC8: a claim with no verdict inside ROOM_CLAIM_TIMEOUT_MS comes back to the claimer\'s LIST - not its pack - and the verdict that comes later still lands it, once', () => {
  const s = born(3);
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  s.net.hold(`${s.A.id}>${s.B.id}`);   // the seat\'s words to B wait on the wire
  wb.takeNamed('Mace'); wb.close(); frame(s.B); s.net.flush();
  elapse(s, ROOM_CLAIM_TIMEOUT_MS + 1000);
  assert.equal(packHas(s.B, 'Mace'), 0, `T23/AC8: ${(ROOM_CLAIM_TIMEOUT_MS + 1000) / 1000} s with no verdict and the Mace is in B's pack (${whereIs(s, 'Mace')}) - a take is B's own, never a claim that comes back`);
  assert.equal(have(items(s.B), 'Mace'), 1, 'T23/AC8: the piece is back in B\'s list once the claim has lapsed');
  s.net.release(`${s.A.id}>${s.B.id}`); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.B, 'Mace'), 1, 'T23/AC8: the verdict that comes late still lands it');
  for (const p of s.ps) assert.equal(have(items(p), 'Mace'), 0, `${p.id}'s list shows the Mace no more`);
  assert.equal(copies(s, 'Mace'), 1, 'and it lands once');
});

test('T23 AC8: a VERDICT the relay drops is recovered by the claimer\'s re-ask - the seat answers a claim it already judged from its ledger (never judging it twice), and the piece lands once', () => {
  const s = born(3);
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  let lost = 0;
  s.net.drop = (from) => from === s.A.id && lost++ < 1;   // the first word the seat says - its verdict - is lost on the wire
  wb.takeNamed('Mace'); wb.close(); frame(s.B); s.net.flush();
  assert.equal(lost, 1, 'T23/AC8: the seat said no word to lose - a take of a shared piece is a claim the seat judges and answers (today nothing judges it)');
  assert.equal(packHas(s.B, 'Mace'), 0, 'and until a verdict lands the piece is out of B\'s pack');
  quiesce(s);
  assert.equal(packHas(s.B, 'Mace'), 1, `T23/AC8: B's re-ask was never answered - the Mace lands once (${whereIs(s, 'Mace')})`);
  for (const p of s.ps) assert.equal(have(items(p), 'Mace'), 0, `${p.id}'s list shows the Mace no more`);
  const id = s.net.words(s.B).filter((r) => Array.isArray(r.q)).flatMap((r) => r.q)[0]?.id;
  const answers = s.net.words(s.A).filter((r) => (r.y ?? []).some(([i]) => i === id));
  assert.ok(answers.length >= 2, `T23/AC8: the seat answered the claim ${answers.length} time(s) - once lost, once more to the re-ask, from its ledger`);
});

test('T25 AC8: only the SEAT\'s word is the room\'s state - a peer\'s `x`, `s` and `y` change nothing, and a claim whose id names another peer is no claim: nothing is taken, nothing is planted, nobody is flagged, and the Dagger is still B\'s to take', () => {
  const s = born(3);
  const base = { k: KEY, g: TODAY, lv: 1, tm: wallNow(), h: baseSignature(s.stock), d: TODAY };
  s.net.say('hostile-0099', actOf({ ...base, x: [0, 1, 2, 3], s: [mk('Flail')], si: ['hostile-0099:plant:1'], y: [['hostile-0099:z:9', 1]] }));   // a state word from a peer that is not the seat
  s.net.say('hostile-0099', actOf({ ...base, q: [{ id: `${s.B.id}:forged:1`, p: 0, n: 1, tm: wallNow() }] }));   // a claim in B\'s name
  s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.deepEqual(names(items(p)), names(s.stock), `T25/AC8: ${p.id}'s list is ${JSON.stringify(names(items(p)))} after a peer who is not the seat said the places gone and a piece stored, and forged a claim in B's name - the state is the seat's word alone (roomHostSaid), a claim is its claimer's own (claimOf)`);
  assert.equal(s.net.words(s.A).flatMap((r) => r.y ?? []).some(([id]) => id.startsWith(`${s.B.id}:forged`)), false, 'the seat answered no forged claim');
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  assert.equal(s.B.said.includes(LOOT_NEWER_TEXT), false, `T25/AC8: B's press says "${LOOT_NEWER_TEXT}" - a well-formed word from a peer marked the cupboard unreadable`);
  wb.takeNamed('Dagger'); wb.close(); frame(s.B); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.B, 'Dagger'), 1, 'and B takes the Dagger the forged claim named: it was never granted');
});

test('T23 AC8 (guard - passes today; DESIGN 6.2): a PARTIAL take of a stored stack by the seat leaves the rest in the room - the stack B stashed is the seat\'s state, and the window that splits it must not split the state\'s own record', () => {
  const s = born(3);
  const wb = windowOf(s.B);
  const arrows = mk('Arrow', 'Weapons', { stackCount: 10 });
  s.B.entity.items.push(arrows);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  wb.put(arrows); wb.close(); frame(s.B); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.equal(have(items(p), 'Arrow'), 10, `${p.id}'s list shows the ten arrows B stashed (guard)`);
  const wa = windowOf(s.A);
  assert.ok(pressYes(s.A, wa), 'the seat opens it');
  wa.takeAmount('Arrow', 4); wa.close(); frame(s.A); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.A, 'Arrow'), 4, 'the seat holds the four it took');
  for (const p of s.ps) assert.equal(have(items(p), 'Arrow'), 6, `T23/AC8 (6.2): ${p.id}'s list shows ${have(items(p), 'Arrow')} arrows - the six that were left: composeRoomView hands the state's own record to a window when the stack is undrawn, the split mutates it, and the judge reads the mutated count (the remainder is destroyed)`);
});

test('T23 AC8: a PUT word the relay drops is said again until the seat answers it - the piece B stashed ends in every list once, and B holds it no more', () => {
  const s = born(3);
  const wb = windowOf(s.B);
  const Y = mk('Flail');
  s.B.entity.items.push(Y);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  let lost = 0;
  s.net.drop = (from) => from === s.B.id && lost++ < 1;   // the first word B says is lost on the wire
  wb.put(Y); wb.close(); frame(s.B); s.net.flush();
  assert.equal(lost, 1, 'B\'s first word about the cupboard was lost (guard)');
  quiesce(s);
  assert.equal(packHas(s.B, 'Flail'), 0, 'B holds the Flail no more');
  for (const p of s.ps) assert.equal(have(items(p), 'Flail'), 1, `T23/AC8: ${p.id}'s list shows the Flail B stashed ${have(items(p), 'Flail')} times - the word that put it in was lost on the wire and nothing said it again: a stash only B's own list holds (${JSON.stringify(lists(s))})`);
  const puts = s.net.words(s.B).filter((r) => Array.isArray(r.a));
  assert.ok(puts.length >= 2 && new Set(puts.flatMap((r) => r.a.map((x) => x.id))).size === 1, `T23/AC8: the put was said again under the SAME id (${puts.length} words, ${new Set(puts.flatMap((r) => r.a.map((x) => x.id))).size} ids): a put is said again every ${ROOM_PUT_RESAY_MS} ms until the seat answers it`);
});

test('STOLEN-GOODS AC8 (guard - passes today): a take off a stranger\'s cupboard by a player who is not the seat is a theft, and the mark survives the claim - lifted out with the piece and given back with it: the piece in the thief\'s pack after the grant is stolen', () => {
  const s = born(3);
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens a stranger\'s cupboard');
  wb.takeNamed('Mace'); wb.takeNamed('Staff'); wb.close(); frame(s.B); s.net.flush(); quiesce(s);
  for (const n of ['Mace', 'Staff']) {
    const held = s.B.entity.items.filter((it) => it.name === n);
    assert.equal(held.length, 1, `B holds the ${n} once`);
    assert.ok(held.every(isStolen), `STOLEN-GOODS/AC8: the ${n} B took off a stranger\'s cupboard is stolen once the seat's grant has landed it - the mark rode the lifted piece and came back with it`);
  }
});

// ═══ R-1 - THE SEAT ANSWERS ON RECEIPT, NEVER ON ITS FRAME TICK ALONE (DESIGN-REVIEW R-1) ═══════════════════════════════
// The seat is the relay's host - "the socket longest in the room" - and the relay knows nothing of tab visibility: a player
// AFK in a house with the tab hidden keeps the seat, and a hidden tab runs no animation frame while its WebSocket still
// delivers messages. PARTY-LOOT's dungeon gets away with a frame-tick verdict because WORLD2's dungeonAuthority moves the seat
// when the host's foes stream goes stale; a building's seat has no such fallback. So the seat judges and SAYS on receipt, in
// the act handler's path; the frame may re-say, never be the only sayer. These pins never call the seat's frame.
test('R-1 AC8: the seat\'s frame is NEVER called after the claims arrive - it judges both claims on one piece on receipt and says its verdicts, B lands the piece, C is told, and nothing lapses back', () => {
  const s = born(3);
  const wb = windowOf(s.B), wc = windowOf(s.C);
  assert.ok(pressYes(s.B, wb) && pressYes(s.C, wc), 'B and C open the cupboard');
  wb.takeNamed('Mace'); wc.takeNamed('Mace');
  wb.close(); wc.close();
  frame(s.B); frame(s.C);
  s.net.flush();   // the claims reach the seat. Its frame is not called again, here or below.
  const claim = (p) => s.net.words(p).filter((r) => Array.isArray(r.q)).flatMap((r) => r.q)[0] ?? null;
  const cb = claim(s.B), cc = claim(s.C);
  assert.ok(cb && cc, `R-1/AC8: B and C each said a claim (\`q\`) for the Mace - the take of a shared piece is a claim the seat judges (today: B's close says the whole list: ${JSON.stringify(s.net.words(s.B).map((r) => Object.keys(r).filter((k) => !k.startsWith('__'))))})`);
  const verdicts = new Map(s.net.words(s.A).filter((r) => Array.isArray(r.y)).flatMap((r) => r.y));
  assert.ok(verdicts.has(cb.id) && verdicts.has(cc.id), `R-1/AC8: the seat's verdict word (\`y\`) for both claims left ON RECEIPT of the claims - none had left when the claims had reached it and its frame had not run (verdicts said: ${JSON.stringify([...verdicts])})`);
  assert.ok(verdicts.get(cb.id) > 0 && verdicts.get(cc.id) === 0, `R-1/AC8: first come - the earlier claim granted, the later refused (${JSON.stringify([...verdicts])})`);
  elapse(s, 20_000, { skip: [s.A] });   // B and C tick through every timeout; the seat's frame never runs
  assert.equal(copies(s, 'Mace'), 1, `R-1/AC8: ${copies(s, 'Mace')} copies of the Mace (${whereIs(s, 'Mace')}) after every timeout - a claim the seat only judges on its frame tick lapses back into the lists of players whose seat is AFK`);
  assert.equal(packHas(s.B, 'Mace'), 1, 'B lands it'); assert.ok(told(s.C), 'C is told');
  for (const p of s.ps) assert.equal(have(items(p), 'Mace'), 0, `${p.id}'s list shows the Mace no more: nothing lapsed back`);
});

test('R-1 AC8 (guard - passes today): ONE claimer and a seat whose frame never runs - the claimer lands its piece, and after every timeout nothing has lapsed back into a list', () => {
  const s = born(3);
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  wb.takeNamed('Mace'); wb.close(); frame(s.B); s.net.flush();
  elapse(s, 20_000, { skip: [s.A] });
  assert.equal(packHas(s.B, 'Mace'), 1, 'B holds the Mace, once, after every timeout (a seat that answers on its frame alone lapses the claim back)');
  for (const p of s.ps) assert.equal(have(items(p), 'Mace'), 0, `${p.id}'s list shows the Mace no more`);
});

test('R-1 AC8: the same for a PUT - a stash B lays in the cupboard is landed by the seat ON RECEIPT, in a word of its own (`s`, `si`), and everyone has it with the seat\'s frame never run', () => {
  const s = born(3);
  const wb = windowOf(s.B);
  const Y = mk('Flail');
  s.B.entity.items.push(Y);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  wb.put(Y); wb.close(); frame(s.B);
  s.net.flush();   // the put reaches the seat. Its frame is not called again, here or below.
  const landed = s.net.words(s.A).filter((r) => (r.s ?? []).some((it) => it.name === 'Flail'));
  assert.ok(landed.length > 0, `R-1/AC8: the seat said no word that stores the Flail (\`s\`) when B's put reached it - it said ${JSON.stringify(s.net.words(s.A).map((r) => Object.keys(r).filter((k) => !k.startsWith('__'))))}; a seat that lands puts on its frame alone leaves the others without the stash while its tab is hidden (today: B's close says the whole list)`);
  assert.equal(have(items(s.C), 'Flail'), 1, 'R-1/AC8: and C already has it');
  elapse(s, 10_000, { skip: [s.A] });
  for (const p of s.ps) assert.equal(have(items(p), 'Flail'), 1, `${p.id}'s list shows the stash once`);
  assert.equal(packHas(s.B, 'Flail'), 0, 'B holds it no more');
});

test('T23 AC8 (guard - passes today): a PARTIAL take of a base stack by a player who is not the seat - the claim names the count, the seat draws the stack down, and the rest stays for everyone', () => {
  const s = born(3, [mk('Dagger'), mk('Arrow', 'Weapons', { stackCount: 10 }), mk('Mace')]);
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  wb.takeAmount('Arrow', 4); wb.close(); frame(s.B); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.B, 'Arrow'), 4, 'B holds the four it took');
  for (const p of s.ps) assert.equal(have(items(p), 'Arrow'), 6, `T23/AC8: ${p.id}'s list shows ${have(items(p), 'Arrow')} arrows, the six that were left`);
});

// ═══ T24 - THE SEAT LEAVES WITH CLAIMS UNANSWERED (AC8) ═════════════════════════════════════════════════════════════════
// Everyone keeps the claims it hears until their verdict, so the seat that comes after judges what the last left unanswered, in
// roomClaimOrder - the claim's own clock (the relay's), then its id: one order whichever client takes the seat. A claim the
// last seat DID answer is not judged again. C's machine clock reads seven minutes ahead and its claim is the earlier by the
// shared one, so an order read from the machines' clocks picks the other.
test('T24 AC8: the seat dies with two claims on one piece unanswered - the new seat\'s FIRST frame judges them in roomClaimOrder whatever order it heard them in: the earlier claim by the SHARED clock has the piece, the other is told; the claim the old seat had answered is not granted twice', () => {
  const s = born(4, STOCK(), { each: [{}, {}, { skew: 420_000 }, {}] });
  const wb = windowOf(s.B), wc = windowOf(s.C), wd = windowOf(s.D);
  assert.ok(pressYes(s.B, wb) && pressYes(s.C, wc) && pressYes(s.D, wd), 'B, C and D open the cupboard');
  wb.takeNamed('Katana'); wb.close(); frame(s.B); s.net.flush();   // the old seat answers this one
  assert.equal(packHas(s.B, 'Katana'), 1, 'B holds the Katana once the seat has answered (guard)');
  s.net.dead.add(s.A.id);   // the seat's socket is gone: nothing reaches it, it says nothing, and the relay has not said so yet
  s.net.hold(`${s.C.id}>${s.B.id}`);   // C's word reaches the others but waits on its way to B: B will hear D's claim FIRST
  wc.takeNamed('Mace'); wc.close(); frame(s.C);   // C claims first by the shared clock...
  clock.t += 40;
  wd.takeNamed('Mace'); wd.close(); frame(s.D);   // ...D forty milliseconds after
  s.net.flush();
  s.net.release(`${s.C.id}>${s.B.id}`); s.net.flush();   // now B has heard both, the later claim first
  s.net.handOver();   // the relay\'s host frame: B is the longest socket left
  assert.equal(s.net.seat(), s.B.id, 'B is the seat now (guard)');
  const before = s.net.log.length;
  frame(s.B); s.net.flush();   // the new seat\'s first frame: it notices, and judges what the last left unanswered
  const idOf = (p) => s.net.words(p).filter((r) => Array.isArray(r.q)).flatMap((r) => r.q.filter((c) => c.p !== undefined || c.sp !== undefined)).find((c) => c.n >= 1 && c.id.startsWith(p.id))?.id;
  const verdicts = new Map(s.net.log.slice(before).filter((e) => e.from === s.B.id).flatMap(recordsOf).flatMap((r) => r.y ?? []));
  const [cc, cd] = [idOf(s.C), idOf(s.D)];
  assert.ok(cc && cd, `T24/AC8: C and D each said a claim (\`q\`) for the Mace (today: their closes say the whole list)`);
  assert.ok(verdicts.has(cc) && verdicts.has(cd), `T24/AC8: the new seat\'s first frame said no verdict for the two claims the old seat left unanswered (${JSON.stringify([...verdicts])}) - the module notices the seat\'s change on its frame tick and judges what the last left`);
  assert.ok(verdicts.get(cc) > 0 && verdicts.get(cd) === 0, `T24/AC8: judged in roomClaimOrder - the claim\'s own clock (the relay\'s), then its id - whichever order they were heard in: C's earlier claim is granted, D's refused (${JSON.stringify([...verdicts])})`);
  quiesce(s);
  assert.equal(copies(s, 'Mace'), 1, `T24/AC8: C and D claimed the same Mace and the seat died before it answered - ${copies(s, 'Mace')} copies after the new seat took over (${whereIs(s, 'Mace')}): nothing judges a take, so each client\'s take is its own`);
  assert.equal(packHas(s.C, 'Mace'), 1, 'T24/AC8: the earlier claim BY THE SHARED CLOCK has it - C\'s machine clock reads seven minutes ahead of D\'s');
  assert.equal(packHas(s.D, 'Mace'), 0, 'T24/AC8: D holds nothing of it');
  assert.ok(told(s.D) && !told(s.C), `T24/AC8: D is told and C is not - D heard ${JSON.stringify(s.D.said)}, C ${JSON.stringify(s.C.said)}`);
  assert.equal(copies(s, 'Katana'), 1, `T24/AC8: the Katana the old seat answered is B's once - not granted again by the new seat (${whereIs(s, 'Katana')})`);
  for (const p of [s.B, s.C, s.D]) for (const n of ['Mace', 'Katana']) assert.equal(have(items(p), n), 0, `T24/AC8: ${p.id}'s list shows the ${n} no more`);
});

test(`T24 AC8: the seat dies during a Take all of MORE than ${ROOM_CLAIMS_MAX} pieces - the new seat judges every claim it holds at once, and says every verdict (${ROOM_ANSWERS_KEPT} to a word, consecutive words after that): all of them land on its first answers`, () => bulk((dom) => {
  const stock = lightPieces(ROOM_CLAIMS_MAX + 8);
  const s = born(3, stock);
  const wc = realWindowOf(s.C, dom);
  assert.ok(pressYes(s.C, wc), 'C opens the cupboard');
  s.net.dead.add(s.A.id);   // the seat\'s socket is gone: nothing reaches it, it says nothing
  wc.press('Take all'); wc.close(); frame(s.C); s.net.flush();   // C\'s claims reach B, which is not the seat yet
  assert.equal(stock.filter((it) => packHas(s.C, it.name) === 1).length, 0, `T24/AC8: no piece of the Take all had landed while the seat was gone (they are out of C's pack, claims in flight)`);
  s.net.handOver();
  assert.equal(s.net.seat(), s.B.id, 'B is the seat now (guard)');
  frame(s.B); s.net.flush();   // the new seat\'s first frame: ${stock.length} claims judged together
  const landed = stock.filter((it) => packHas(s.C, it.name) === 1).length;
  assert.equal(landed, stock.length, `T24/AC8: ${landed} of the ${stock.length} pieces had landed when the new seat had answered the claims it held - a host word carries the verdicts for the claims it answers, not the latest ${ROOM_ANSWERS_KEPT} (PARTY-LOOT's \`recentAnswers\`): the rest wait for the claimer to ask again`);
  quiesce(s);
  for (const it of stock) assert.equal(packHas(s.C, it.name), 1, `C holds ${it.name} once`);
  for (const p of [s.B, s.C]) assert.deepEqual(names(items(p)), [], `${p.id}'s list is empty`);
}));

// ═══ D-1 - A CLAIM IN FLIGHT AND NOT LAPSED IS KEPT BY ITS CLAIMER AT ITS OWN TEARDOWN (DESIGN-REVIEW D-1, D-1a) ═════════
// The user: "whatever the current dungeon logic is doing on main we want to replicate across all these other situations".
// Main's rule is one line, at the dungeon's teardown: `for (const m of _roomMine.values()) if (m.claim && !m.lapsed)
// roomGive(m.item, m.give);`. The authority's verdict is final; the claimer who leaves with a claim in flight keeps the piece,
// and a lapsed claim is not kept. "Leaves" is the claimer's own teardown - the host's door out of the building - which these
// pins run as the host does (the statements of exitInteriorNow that read the building's bag, ahead of `_intShared = null`).
test('D-1 AC8: the claimer LEAVES THE BUILDING with its claim in flight and not lapsed - the piece was out of its pack while the claim stood, the seat\'s grant stands (no list shows it), and the teardown gives the piece back to the claimer: ONE copy, in its pack', () => {
  const s = born(3);
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  s.net.hold(`${s.A.id}>${s.B.id}`);   // the seat's words to B wait on the wire: B hears no verdict
  wb.takeNamed('Mace'); wb.close(); frame(s.B); s.net.flush();   // the claim reaches the seat, which grants it
  assert.equal(packHas(s.B, 'Mace'), 0, `D-1/AC8: while its claim stands the Mace is out of B's pack (a take of a shared piece is LIFTED until the seat's verdict - roomLift) - it is in B's pack (${whereIs(s, 'Mace')}): the take is B's own, never a claim`);
  for (const p of [s.A, s.C]) assert.equal(have(items(p), 'Mace'), 0, `D-1/AC8: the seat granted the claim, so ${p.id}'s list shows the Mace no more (the verdict is final)`);
  s.B.as(() => s.B.h.leave()); s.B.here = false;   // B leaves the building, inside the timeout, with the verdict unheard
  assert.equal(packHas(s.B, 'Mace'), 1, `D-1/AC8: B left with its claim in flight and not lapsed and the Mace is nowhere (${whereIs(s, 'Mace')}) - PARTY-LOOT's own rule keeps it with its claimer; the host's teardown (exitInteriorNow, ahead of \`_intShared = null\`) tells the module nothing`);
  assert.equal(copies(s, 'Mace'), 1, 'D-1/AC8: and the seat\'s grant stands: one copy, B\'s');
  for (const p of [s.A, s.C]) assert.equal(have(items(p), 'Mace'), 0, `${p.id}'s list still shows it no more`);
});

test('D-1a AC8 (by source): every door out of a building that drops the bag (exitInteriorNow, forceExitToExterior - a teleport\'s and a load\'s) first tells the module through a statement that reads it', () => {
  for (const site of LEAVE_SITES) assert.ok(site.before.length > 0, `D-1a/AC8: ${site.name} drops the building's bag (\`_intShared = null\`) without a statement ahead of it that reads the bag - a claim in flight is kept at the claimer's own teardown, and the host's doors out are where the module hears of it (\`interiorLootLeave\`)`);
});

test('D-1 AC8: a claim that had LAPSED (no verdict inside the timeout, the seat never heard it) is NOT kept at the teardown - the piece is back in the claimer\'s list, not its pack, and the room still holds it: one copy, in the room', () => {
  const s = born(3);
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  s.net.drop = (from) => from === s.B.id;   // every word B says is lost on the wire: the seat never hears the claim
  wb.takeNamed('Mace'); wb.close(); frame(s.B); s.net.flush();
  elapse(s, ROOM_CLAIM_TIMEOUT_MS + 1000);   // the claim lapses: the piece reads as back in the container for its taker
  assert.equal(packHas(s.B, 'Mace'), 0, `D-1/AC8: the claim has lapsed (${(ROOM_CLAIM_TIMEOUT_MS + 1000) / 1000} s, no verdict) and the Mace is still in B's pack - a take is B's own, never a claim that comes back (${whereIs(s, 'Mace')})`);
  assert.equal(have(items(s.B), 'Mace'), 1, 'D-1/AC8: a lapsed claim comes back to the claimer\'s LIST');
  s.B.as(() => s.B.h.leave()); s.B.here = false;
  assert.equal(packHas(s.B, 'Mace'), 0, 'D-1/AC8: a lapsed claim is not kept: B leaves without the piece');
  for (const p of [s.A, s.C]) assert.equal(have(items(p), 'Mace'), 1, `D-1/AC8: the seat never heard the claim: ${p.id}'s list still shows the one Mace`);
});

test('D-1 AC8 (recorded limit - PARTY-LOOT\'s own rule, guard - passes today): the claimer leaves INSIDE the timeout with a claim the seat NEVER HEARD - it keeps the piece AND the room still lists it: a copy', () => {
  const s = born(3);
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  s.net.drop = (from) => from === s.B.id;   // the claim is lost on the wire: nobody hears it
  wb.takeNamed('Mace'); wb.close(); frame(s.B); s.net.flush();
  s.B.as(() => s.B.h.leave()); s.B.here = false;   // inside the timeout
  assert.equal(packHas(s.B, 'Mace'), 1, 'recorded limit: the claimer keeps the piece it took');
  for (const p of [s.A, s.C]) assert.equal(have(items(p), 'Mace'), 1, `recorded limit: and ${p.id}'s list still shows it - the same dupe main's dungeon has (a claim never heard is kept at the leave)`);
});

test('D-1 AC8 (recorded limit - PARTY-LOOT\'s own rule, guard - passes today): the claimer leaves INSIDE the timeout with a claim the seat REFUSED and whose verdict it never heard - it keeps the piece, and the winner has it too: a copy', () => {
  const s = born(3);
  const wb = windowOf(s.B), wc = windowOf(s.C);
  assert.ok(pressYes(s.B, wb) && pressYes(s.C, wc), 'B and C open the cupboard');
  s.net.hold(`${s.A.id}>${s.B.id}`);   // B hears nothing the seat says
  wc.takeNamed('Mace'); wc.close(); frame(s.C); s.net.flush();   // C is granted the Mace
  wb.takeNamed('Mace'); wb.close(); frame(s.B); s.net.flush();   // B\'s row was stale: the seat refuses it, B does not hear
  s.B.as(() => s.B.h.leave()); s.B.here = false;
  assert.equal(packHas(s.C, 'Mace'), 1, 'recorded limit: C has the piece the seat granted it');
  assert.equal(packHas(s.B, 'Mace'), 1, 'recorded limit: and B, which left inside the timeout with a refused claim it never heard, keeps a copy (main\'s dungeon does the same)');
});

// ═══ R-5 - THE THEFT BASKET READS THE ATTEMPT (DESIGN-REVIEW R-5) ═══════════════════════════════════════════════════════
test('R-5 AC8 (recorded behaviour): a take the seat REFUSED still enters the theft basket - the stranger\'s cupboard is private property and the window\'s own take is the attempt, whatever the seat\'s verdict', () => {
  const s = born(3);
  const wa = windowOf(s.A), wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb) && pressYes(s.A, wa), 'B and A open the stranger\'s cupboard');
  wa.takeNamed('Katana'); wa.close(); frame(s.A); s.net.flush();   // the seat took it first
  wb.takeNamed('Katana');   // B\'s window still shows the row
  frame(s.B); s.net.flush();   // a frame with the window open: a module that reads a window\'s takes as they happen has the claim refused before the close
  wb.close();   // the window\'s onClose asks the theft law for its decision, handed the basket
  frame(s.B); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.B, 'Katana'), 0, `R-5/AC8: B's take was refused - the seat had it first - and B holds the Katana (${whereIs(s, 'Katana')})`);
  assert.ok(told(s.B), 'and B is told');
  const basket = s.B.thefts.at(-1)?.basket.map((it) => it.name) ?? null;
  assert.ok(basket, 'B\'s close asked the theft law (private property) for its decision');
  assert.deepEqual(basket, ['Katana'], `R-5/AC8: a theft is marked for a take the seat refused - the basket the law read at B's close is the window's own take, the attempt (${JSON.stringify(basket)})`);
});

// A SPLIT OFF A STRANGER'S STACK is a new record, marked (stolenGoods.js takenFromKeeping), while the stack left in the cupboard
// is the owner's and clean - and a stolen piece stacks only with stolen kin. The claim lifted the cupboard's record, found
// nowhere in the pack, and so lifted nothing: a refused split stayed in the taker's hands (two copies of the arrows), and a
// taker carrying honest arrows of their own lost those in its place while the marked ones stayed.
test('SPLIT-LIFT AC8: a PARTIAL take off a stranger\'s cupboard the seat REFUSED is lifted back out - the marked half, not an honest stack of its kind the taker already carried; and one it GRANTS comes back marked', () => {
  const s = born(3, [mk('Dagger'), mk('Arrow', 'Weapons', { stackCount: 10 }), mk('Mace')]);
  s.B.entity.items.push(mk('Arrow', 'Weapons', { stackCount: 5 }));   // B's own five, honest
  const wa = windowOf(s.A), wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb) && pressYes(s.A, wa), 'B and A open the stranger\'s cupboard');
  wa.takeAmount('Arrow', 10); wa.close(); frame(s.A); s.net.flush();   // the seat takes the whole stack first
  wb.takeAmount('Arrow', 4);   // B's window still shows the ten: four split off them
  assert.equal(s.B.entity.items.filter((it) => it.name === 'Arrow' && isStolen(it)).reduce((n, it) => n + it.stackCount, 0), 4, 'the four landed marked (guard)');
  frame(s.B); s.net.flush(); wb.close(); frame(s.B); s.net.flush(); quiesce(s);
  assert.ok(told(s.B), 'B is told');
  const arrows = s.B.entity.items.filter((it) => it.name === 'Arrow');
  assert.deepEqual(arrows.map((it) => [it.stackCount, isStolen(it)]), [[5, false]], `SPLIT-LIFT: the refused four are out of B's pack and B's own five stand, honest (${JSON.stringify(arrows.map((it) => [it.stackCount, isStolen(it)]))})`);
  assert.equal(packHas(s.A, 'Arrow'), 10, 'the seat holds the ten it took');
  for (const p of s.ps) assert.equal(have(items(p), 'Arrow'), 0, `${p.id}'s list shows no arrows`);

  const g = born(3, [mk('Dagger'), mk('Arrow', 'Weapons', { stackCount: 10 }), mk('Mace')]);
  const wg = windowOf(g.B);
  assert.ok(pressYes(g.B, wg), 'B opens the stranger\'s cupboard');
  wg.takeAmount('Arrow', 4); frame(g.B);
  assert.equal(packHas(g.B, 'Arrow'), 0, 'SPLIT-LIFT: the four are lifted while the claim is in flight');
  wg.close(); frame(g.B); g.net.flush(); quiesce(g);
  assert.deepEqual(g.B.entity.items.filter((it) => it.name === 'Arrow').map((it) => [it.stackCount, isStolen(it)]), [[4, true]], 'SPLIT-LIFT: granted, the four come back to B - marked, as the window marked them');
  for (const p of g.ps) assert.equal(have(items(p), 'Arrow'), 6, `${p.id}'s list shows the six that were left`);
});

// ═══ T25 - THE PROTECTIONS THAT STAND (AC8) ═════════════════════════════════════════════════════════════════════════════
// Phase 1 pinned HOME1's old-shape word and STOLEN-GOODS' Take all. These are the rest of the table (DESIGN 4.6), each read
// through the new words where the design fixes them, and through the pieces' whereabouts everywhere else.
const RARE_KEY = '7a7a7a7a7a7a7a7a';
/** A piece the realm's ledger follows (a rare weapon with its id) - the same ledger key is the same piece: a second is a copy. */
const rareOf = () => ({ ...applyRarity(createWeapon(113, 1, seeded(7)), 'rare', seeded(11)), uid: RARE_KEY });
const keyed = (list) => (list ?? []).filter((it) => ledgerKeyOf(it) === RARE_KEY).length;
const LETTER = { name: 'Letter of Credit', templateIndex: 275, group: 'MiscItems', stackCount: 1, value: 5000 };
const BOUND = { ...mk('Ruby', 'Gems'), bound: true };

test('HOME1 AC8 (guard - passes today): a home\'s cupboards are its owner\'s alone under the new words too - the owner\'s open and close say nothing, and a birth or a claim about one lands on nobody', () => {
  const net = relay();
  const owner = player(net, 'aaaa-0001', { seed: 3, home: { own: true, owner: 'aaaa' } });
  const guest = player(net, 'bbbb-0002', { seed: 5, home: { own: false, owner: 'aaaa' } });
  owner.ctx.containers[0] = { ...cupboard(), items: [mk('Dagger')], stockedDate: 1 };
  const w = windowOf(owner);
  owner.window = w;
  owner.as(() => owner.h.press(KEY));
  assert.ok(w.cur, 'the owner opens their own storage');
  w.takeNamed('Dagger'); w.close(); frame(owner); net.flush();
  assert.equal(net.log.length, 0, 'the owner\'s open and close say nothing to the room');
  guest.ctx.containers[0] = { ...cupboard(), items: [mk('Mace')], stockedDate: 1 };
  const claim = { k: KEY, g: TODAY, lv: 1, tm: wallNow(), h: baseSignature([mk('Katana')]), q: [{ id: 'cccc-0003:x:1', p: 0, n: 1, tm: wallNow() }] };
  net.say('cccc-0003', actOf(birthWord([mk('Katana')]))); net.say('cccc-0003', actOf(claim)); net.flush();
  assert.deepEqual(names(items(owner)), [], 'nothing landed on the owner\'s cupboard');
  assert.deepEqual(names(items(guest)), ['Mace'], 'nor on the guest\'s');
});

test('AUTO-HOLD AC8 (guard - passes today): a piece the reader CARRIES is not offered - its view of the cupboard, its window and its plaque hide the place whose piece it holds a copy of, while everyone else\'s list has it', () => {
  const s = rolled(3, [[rareOf(), mk('Dagger')]]);
  s.B.entity.items.push(rareOf());   // B carries a piece with the very ledger key the stock holds: a second would be a copy
  const wa = firstOpen(s.A); wa.close(); frame(s.A); s.net.flush();
  assert.equal(keyed(items(s.A)), 1, 'A\'s list has the rare piece'); assert.equal(keyed(items(s.C)), 1, 'and so has C\'s');
  assert.equal(keyed(items(s.B)), 0, 'AUTO-HOLD/AC8: B\'s list does not offer the piece B already carries');
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  assert.equal(keyed(wb.list()), 0, 'and neither does its window');
  assert.deepEqual(names(wb.list()), ['Dagger'], 'it lists the rest');
});

test('AUTO-HOLD AC8: a piece the claimer came to CARRY while its claim stood is never given - the grant of a copy lands nothing, and the claimer holds one piece of that ledger key, not two', () => {
  const s = rolled(3, [[rareOf(), mk('Dagger')]]);
  const wa = firstOpen(s.A); wa.close(); frame(s.A); s.net.flush();
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard; it carries nothing of that key yet, so the piece is in its window');
  s.net.hold(`${s.A.id}>${s.B.id}`);   // the seat's verdict waits on the wire
  wb.take((it) => ledgerKeyOf(it) === RARE_KEY); wb.close(); frame(s.B); s.net.flush();   // B claims the rare piece
  s.B.entity.items.push(rareOf());   // while the claim stands B comes to carry another piece with the same ledger key (a trade\'s, a stale shelf\'s)
  s.net.release(`${s.A.id}>${s.B.id}`);   // the grant reaches B
  quiesce(s);
  assert.equal(keyed(s.B.entity.items), 1, `AUTO-HOLD/AC8: B holds ${keyed(s.B.entity.items)} pieces of that ledger key - a grant of a piece its claimer carries is a COPY the ledger would lock with the original: the give must be refused (givePiece: notCarried)`);
  for (const p of s.ps) assert.equal(keyed(items(p)), 0, `${p.id}'s list shows the rare piece no more: the seat granted it`);
});

test('SS3/HACKED-GOLD AC8 (guard - passes today): a letter of credit or a bound piece in a cupboard\'s stock is never in the base - no word carries one, no list lands one, and a hostile birth that names one lands none', () => {
  const s = rolled(3, [[mk('Dagger'), LETTER, BOUND, mk('Mace')]]);
  const wa = firstOpen(s.A); wa.close(); frame(s.A); s.net.flush();
  const said = s.net.log.flatMap(recordsOf).flatMap((r) => [...(r.r ?? []), ...(r.b ?? []), ...(r.s ?? []), ...(r.a ?? []).map((x) => x.it)]);
  assert.ok(said.length > 0, 'A said its stock (guard)');
  assert.deepEqual(said.filter((it) => it?.templateIndex === LETTER.templateIndex || it?.bound === true).map((it) => it.name), [], 'SS3/HACKED-GOLD/AC8: no word names the letter or the bound piece');
  for (const p of [s.B, s.C]) {
    assert.deepEqual(items(p).filter((it) => it.templateIndex === LETTER.templateIndex || it.bound === true).map((it) => it.name), [], `SS3/HACKED-GOLD/AC8: ${p.id}'s list holds neither`);
    assert.deepEqual(names(items(p)), ['Dagger', 'Mace'], `${p.id} holds the rest of the stock`);
  }
  const t = building(2);
  t.net.say('hostile-0099', actOf(birthWord([mk('Dagger'), LETTER, BOUND])));
  t.net.flush();
  for (const p of t.ps) assert.deepEqual((items(p) ?? []).filter((it) => it.templateIndex === LETTER.templateIndex || it.bound === true).map((it) => it.name), [], `SS3/HACKED-GOLD/AC8: a hostile birth naming a letter and a bound piece lands neither on ${p.id}`);
});

test('STOLEN-GOODS S3 AC8: a piece in a birth word is its owner\'s, never stolen - a new-shape birth whose base carries the mark lands CLEAN on everyone', () => {
  const s = building(3);
  s.net.say('hostile-0099', actOf(birthWord([{ ...mk('Dagger'), stolen: true }, { ...mk('Mace'), stolen: true }])));
  s.net.flush();
  for (const p of s.ps) {
    assert.deepEqual(names(items(p)), ['Dagger', 'Mace'], `STOLEN-GOODS/AC8: ${p.id} lands the birth (a birth is anyone's; the base is the record, less the mark) - the new word is unreadable to today's landing rule, ${p.id}'s cupboard is ${JSON.stringify(items(p))}`);
    assert.equal(items(p).some(isStolen), false, `STOLEN-GOODS S3/AC8: nothing ${p.id} landed is stolen`);
  }
});

test('STOLEN-GOODS S3 AC8 (guard - passes today): an older build\'s whole list naming stolen pieces lands clean, and a thief\'s stash of a stolen piece reaches the others unmarked', () => {
  const s = building(3);
  s.net.say('oooo-0009', { k: ROOM, l: [{ k: KEY, r: [{ ...mk('Dagger'), stolen: true }, { ...mk('Mace'), stolen: true }], d: TODAY }] });
  s.net.flush();
  for (const p of s.ps) { assert.deepEqual(names(items(p)), ['Dagger', 'Mace'], `${p.id} lands the older build's list`); assert.equal(items(p).some(isStolen), false, `STOLEN-GOODS S3/AC8: ${p.id}'s landed pieces carry no mark`); }
  const wa = windowOf(s.A);
  assert.ok(pressYes(s.A, wa), 'A opens the cupboard');
  const Y = { ...mk('Katana'), stolen: true };   // stolen elsewhere
  s.A.entity.items.push(Y);
  wa.put(Y); wa.close(); frame(s.A); s.net.flush(); quiesce(s);
  for (const p of [s.B, s.C]) { assert.equal(have(items(p), 'Katana'), 1, `${p.id} sees the stash`); assert.equal(items(p).filter((it) => it.name === 'Katana').some(isStolen), false, `STOLEN-GOODS S3/AC8: ${p.id}'s landed Katana carries no mark: a stash is no peer's theft`); }
});

// A2/B2: the day is a generation. A word whose `g` is past tomorrow, or no whole number, is refused WHOLE - the record is not
// landed, the cupboard is not marked unreadable (M2's word is for a list this build cannot READ), and a frozen restock is
// never sold to a client: the next open rolls as if the word had never come.
for (const [label, days, red] of [
  ['a generation two days past today and an honest day', { g: TODAY + 2, d: TODAY }, true],
  ['a generation that is no whole number', { g: TODAY + 0.5, d: TODAY }, true],
  ['a generation from the far future (and a day to match)', { g: 1e15, d: 1e15 }, false],
  ['a generation two days past today (and a day to match)', { g: TODAY + 2, d: TODAY + 2 }, false],
]) {
  test(`A2/B2 AC8${red ? '' : ' (guard - passes today)'}: a word with ${label} is refused WHOLE - the cupboard is as it was, not marked unreadable, and the next first open proceeds and dates the cupboard today`, () => {
    const s = rolled(2, [null, [mk('Dagger'), mk('Mace')]]);
    s.net.say('hostile-0099', actOf(birthWord([mk('Katana')], days)));
    s.net.flush();
    const c = s.B.ctx.containers[0];
    assert.equal(c.items, null, 'A2/B2/AC8: nothing landed on B\'s cupboard'); assert.equal(c.stockedDate, 0, 'and it is not dated');
    const wb = firstOpen(s.B);
    assert.equal(s.B.said.includes(LOOT_NEWER_TEXT), false, `A2/B2/AC8: B's press says "${LOOT_NEWER_TEXT}" - the refused word marked the cupboard UNREADABLE (M2) instead of being refused whole: a record this build can read, with a day that cannot be, is no newer version's`);
    assert.deepEqual(names(items(s.B)), ['Dagger', 'Mace'], 'B\'s own first open shows its own roll');
    wb.close(); frame(s.B); s.net.flush();
    assert.equal(c.stockedDate, TODAY, 'A2/B2/AC8: the cupboard is dated TODAY, not by the refused word');
  });
}

// A3: the day only moves forward. A newer generation always wins (roomTermsBeat), so a word from yesterday - a stale close of
// a window opened yesterday - never un-restocks, replaces or flags today's cupboard.
for (const [shape, word] of [
  ['new-shape birth', () => birthWord([mk('Flail'), mk('Warhammer')], { g: TODAY - 1, tm: wallNow() - 86_400_000 })],
  ['older build\'s whole list', () => ({ k: KEY, r: [mk('Flail'), mk('Warhammer')], d: TODAY - 1 })],
]) {
  test(`A3 AC8: yesterday's word (${shape}) never beats today's - the room's list, its date and the next open are as they were`, () => {
    const s = born(3);
    const wc = windowOf(s.C);
    assert.ok(pressYes(s.C, wc), 'C opens the cupboard');
    wc.takeNamed('Dagger'); wc.close(); frame(s.C); s.net.flush(); quiesce(s);
    for (const p of s.ps) assert.deepEqual(names(items(p)), ['Mace', 'Katana', 'Staff'], `${p.id} holds today's list less the Dagger C took (guard)`);
    s.net.say('stale-0099', actOf(word())); s.net.flush();
    for (const p of s.ps) {
      assert.deepEqual(names(items(p)), ['Mace', 'Katana', 'Staff'], `A3/AC8: ${p.id}'s list is ${JSON.stringify(names(items(p)))} after a word from yesterday - it must never replace today's`);
      assert.equal(p.ctx.containers[0].stockedDate, TODAY, `${p.id}'s cupboard is still dated today`);
    }
    const wb = windowOf(s.B);
    assert.ok(pressYes(s.B, wb), 'B opens it');
    assert.equal(s.B.said.includes(LOOT_NEWER_TEXT), false, `A3/AC8: B's press says "${LOOT_NEWER_TEXT}" - yesterday's word marked today's cupboard unreadable`);
    assert.deepEqual(names(wb.list()), ['Mace', 'Katana', 'Staff'], 'B\'s window shows the room\'s list');
  });
}

// M2 (AUDIT SETS): a word this build cannot read - a piece from a newer game - makes the cupboard UNREADABLE: the press says
// LOOT_NEWER_TEXT, the plaque names it and lists nothing (it is a list this client has not heard), and it is never opened,
// claimed or closed over (DESIGN 4.6).
test('M2 AC8: a birth naming a piece from a newer game makes the cupboard unreadable - the press says LOOT_NEWER_TEXT, the peek is null even over the cached roll the scene kept, and nothing is opened or said', () => {
  const unknown = [65535, 60000, 59999].find((i) => !templateByIndex(i));
  const future = { name: 'Future Blade', templateIndex: unknown, group: 'Weapons', stackCount: 1 };
  const s = building(2, { each: [{}, { cached: [mk('Dagger'), mk('Mace')] }] });
  s.net.say('newer-0099', actOf(birthWord([mk('Katana'), future])));
  s.net.flush();
  assert.equal(plaque(s.B)?.kind, 'name', `M2/AC8: B's plaque lists ${JSON.stringify(peekNames(s.B))} - the cupboard is unreadable here, and the only list B holds is the scene's cached roll, which is no one's word: the plaque names it and lists nothing`);
  const wb = windowOf(s.B);
  const opened = pressYes(s.B, wb);
  assert.ok(s.B.said.includes(LOOT_NEWER_TEXT), `M2/AC8: B's press says LOOT_NEWER_TEXT - it said ${JSON.stringify(s.B.said)}`);
  assert.equal(opened, null, 'M2/AC8 (DESIGN 4.6): the unreadable cupboard is never opened - not over the cached roll either');
  assert.equal(s.net.words(s.B).length, 0, 'M2/AC8: and B claims and closes over nothing: it said no word about the cupboard');
});

// The size cap (AUDIT WORLD4 A2/B2/D1): what cannot be said is not said - once, out loud - and the container stays this
// player's own. A take from it is therefore the player's own too: no claim goes out for a piece no one else can see, so none
// lapses back.
test(`T25 AC8 (guard - passes today; AUDIT WORLD4 A2/B2/D1): a stock of more than LOOT_LIST_MAX (${LOOT_LIST_MAX}) pieces is not said - once, out loud - and stays its opener's own: B (not the seat) takes a piece, and it stays taken`, () => {
  const warns = [];
  const was = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try {
    const big = lightPieces(LOOT_LIST_MAX + 6);   // a take of one leaves it past the cap still
    const s = rolled(3, [null, big]);
    const wb = firstOpen(s.B);
    assert.equal(items(s.B).length, big.length, 'B\'s window shows its own roll (guard)');
    const Z = wb.take(() => true);
    wb.close(); frame(s.B); s.net.flush();
    elapse(s, 10_000);
    assert.equal(s.net.words(s.B).length, 0, 'T25/AC8: B said nothing about a cupboard no one else can hold');
    assert.equal(packHas(s.B, Z.name), 1, 'T25/AC8: B holds the piece it took, after every timeout - a take from its own cupboard is not a claim that lapses back');
    for (const p of [s.A, s.C]) assert.equal(items(p), null, `T25/AC8: ${p.id} has no list`);
    assert.equal(warns.length, 1, `T25/AC8: said once, out loud - ${JSON.stringify(warns)}`);
  } finally { console.warn = was; }
});

test('C1 AC8 (guard - passes today): nothing is composed under the window a player has open - the rows B\'s window shows are the same pieces in the same order while the room moves under it (a take, a put), and everyone without a window has the moves', () => {
  const s = born(3);
  const wa = windowOf(s.A), wb = windowOf(s.B), wc = windowOf(s.C);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  const array = wb.list(), rows = [...array];
  assert.ok(pressYes(s.A, wa), 'A opens it');
  wa.takeNamed('Katana'); wa.close(); frame(s.A); s.net.flush();   // a take moves the room\'s list
  const F = mk('Flail');
  s.C.entity.items.push(F);
  assert.ok(pressYes(s.C, wc), 'C opens it');
  wc.put(F); wc.close(); frame(s.C); s.net.flush();   // so does a put
  elapse(s, 6000);
  assert.equal(wb.list(), array, 'C1/AC8: B\'s window stands on the same array');
  assert.ok(array.length === rows.length && array.every((it, i) => it === rows[i]), `C1/AC8: B's open window shows ${JSON.stringify(names(array))} - the rows it opened on, the same pieces in the same order, however the room moved (${JSON.stringify(names(rows))})`);
  assert.equal(have(items(s.A), 'Katana'), 0, 'and A, with no window open, has the take');
  assert.equal(have(items(s.A), 'Flail'), 1, 'and the put');
});

// ═══ T26 - THE PEEK (AC8) ════════════════════════════════════════════════════════════════════════════════════════════════
// CONTAINER-PEEK (#970) paints what a cupboard already holds on the plaque. PARTY-LOOT's trigger - "safe only while nobody could
// see a container before opening it" - is met by that: so the plaque shows the room's ONE list or the name alone, never a roll
// that is not the room's. The cupboard's own roll is made before the private-property question is asked (the arm rolls, then
// asks), and a player who says No claimed nothing (DFU) - that roll must not be painted for anyone.
test('T26 AC8: an online cupboard\'s peek is null while it is UNBORN - even after this client\'s own roll, before the private-property Yes, and after a No: the roll is no one\'s word', () => {
  const s = rolled(2, [[mk('Dagger'), mk('Mace')]]);
  const wa = windowOf(s.A);
  s.A.window = wa;
  s.A.as(() => s.A.h.press(KEY));   // the arm rolls the stock, then asks whether to open it
  assert.equal(typeof s.A.state.interiorOverlay?.onYes, 'function', 'the private-property question stands (guard)');
  assert.equal(plaque(s.A)?.kind, 'name', `T26/AC8: A's plaque lists ${JSON.stringify(peekNames(s.A))} before A has answered - the roll the arm just made is A's own, not the room's: an UNBORN cupboard names itself and lists nothing`);
  s.A.as(() => s.A.state.interiorOverlay.onNo());   // "No claims nothing"
  s.A.state.interiorOverlay = null;
  assert.equal(plaque(s.A)?.kind, 'name', `T26/AC8: A said No, and its plaque still lists ${JSON.stringify(peekNames(s.A))} - a roll the room never heard is painted`);
  assert.equal(plaque(s.B)?.kind, 'name', 'and B, who has heard nothing, sees the name');
  s.net.flush();
  assert.equal(s.net.log.length, 0, 'T26/AC8: A\'s No said nothing to the room (AUDIT WORLD6a A5: "No claims nothing")');
});

test('T26 AC8: the scene\'s CACHED list of a stranger\'s cupboard is not the room\'s word - the peek is null at the mount, and becomes the room\'s one list when the room speaks (AUDIT WORLD6a\'s recorded item 3)', () => {
  const s = building(3, { each: [{ roll: () => [mk('Katana'), mk('Staff')] }, { cached: [mk('Dagger'), mk('Mace')] }, {}] });
  assert.equal(plaque(s.B)?.kind, 'name', `T26/AC8: B's plaque lists ${JSON.stringify(peekNames(s.B))} at the mount - the interior's cache kept B's own earlier roll for the cupboard, and online that list is no one's word: the module keeps it aside and leaves the cupboard unlisted until the room speaks or B opens it`);
  const wa = firstOpen(s.A); wa.close(); frame(s.A); s.net.flush();
  for (const p of s.ps) assert.deepEqual(peekNames(p), ['Katana', 'Staff'], `T26/AC8: ${p.id}'s plaque lists the room's one list once A has opened it`);
});

test('T26 AC8 (guard - passes today): a BORN cupboard\'s peek lists the room\'s one list - the same for everyone, less what was taken, and the same in the memory a later player walks in on', () => {
  const s = born(3);
  for (const p of s.ps) assert.deepEqual(peekNames(p), names(s.stock), `${p.id}'s plaque lists the room's list`);
  const wc = windowOf(s.C);
  assert.ok(pressYes(s.C, wc), 'C opens the cupboard');
  wc.takeNamed('Dagger'); wc.close(); frame(s.C); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.deepEqual(peekNames(p), ['Mace', 'Katana', 'Staff'], `${p.id}'s plaque drops the Dagger C took`);
  const D = joiner(s, 'dddd-0004');
  assert.deepEqual(peekNames(D), ['Mace', 'Katana', 'Staff'], 'and a later player walks in on the same list');
});

test('T26 AC8 (guard - passes today): the shut, hall and owned laws of the peek stand as #970 built them - someone else\'s home and a hall name the cupboard alone, the player\'s own storage lists what it holds', () => {
  const s = born(2);
  assert.equal(plaque(s.A)?.kind, 'items', 'a born cupboard lists (guard)');
  s.A.state.interiorHome = { own: false, owner: 'Someone' };
  assert.equal(plaque(s.A)?.kind, 'name', 'in someone else\'s home: the name alone');
  s.A.state.interiorHome = null;
  s.A.state.hallMemberHere = () => true;
  assert.equal(plaque(s.A)?.kind, 'name', 'in a hall: the name alone (the press opens the Stores chest)');
  s.A.state.hallMemberHere = () => false;
  const net = relay();
  const mine = player(net, 'eeee-0005', { seed: 9, owned: true });
  mine.ctx.containers[0] = { ...cupboard(), items: [mk('Dagger')], stockedDate: 1 };
  const f = plaque(mine);
  assert.equal(f?.kind, 'items', 'the player\'s own storage lists what it holds, though its date is not today\'s'); assert.deepEqual(f.rows.map((r) => r.name), ['Dagger']);
  const w = windowOf(mine);
  mine.window = w;
  mine.as(() => mine.h.press(KEY));
  assert.ok(w.cur, 'and the press opens it with no question');
  w.takeNamed('Dagger'); w.close(); frame(mine); net.flush();
  assert.equal(net.log.length, 0, 'an owned house keeps no room: its storage says nothing');
});

test('T26 AC8 (guard - passes today): a BORN cupboard\'s `preview` frame lights no row and arms no take - foldQuickLoot lights nothing, P is not armed, and the quick door takes nothing from it', () => {
  setPref('quickLoot', true);
  try {
    const s = born(2);
    const f = plaque(s.B);
    assert.equal(f?.kind, 'items'); assert.equal(f.preview, true, 'a glance');
    resetQuickLoot();
    foldQuickLoot(f);
    assert.equal(quickLootSelection(), null, 'no row is lit'); assert.equal(quickLootRow(f), -1);
    assert.equal(quickLootArm('QuickLootAll'), false, 'and P arms nothing');
    assert.equal(quickLootTake(KEY, { items: () => items(s.B) }, s.B.entity, () => {}), null, 'the quick door takes nothing off a glance');
    assert.equal(items(s.B).length, s.stock.length, 'the cupboard keeps all of it'); assert.equal(s.B.entity.items.length, 0, 'B holds nothing');
  } finally { setPref('quickLoot', false); }
});

// ═══ THE SHOP SHELF (DESIGN 4.7) - `shelf:` KEEPS WORLD6a'S WHOLE-LIST WORD, UNCHANGED ═══════════════════════════════════
// A purchase is a trade, not a take: the Buy window stages a piece in a basket that is not the pack, and lifting and resolving
// cannot read it. The shut shop's stealing window has the cupboard's race (recorded, DESIGN-REVIEW F-1 - the next slice's: the
// claim law with a refunding trade window); until then a shelf says its whole list, lands another's whole, and the last
// writer wins.
test('SHELF AC8 (guard - passes today; recorded: F-1): `shelf:` keeps WORLD6a\'s whole-list word - `{ k, r, d }` and nothing of a room word, landed whole over a shelf with no window open, never over the one a player has open, and a stale close still brings a taken piece back (F-1\'s recorded race)', () => {
  const stock = () => [mk('Dagger'), mk('Mace'), mk('Katana'), mk('Staff')];
  const s = building(3, { each: [0, 1, 2].map(() => ({ shelves: 1, building: SHOP, shelfRoll: stock })) });
  const wa = windowOf(s.A), wb = windowOf(s.B);
  assert.ok(openShelfOf(s.A, wa), 'A opens the shut shop\'s shelf (the stealing window)');
  s.net.flush();
  const words = s.net.words(s.A, 'shelf:0');
  assert.ok(words.length > 0, 'A said the shelf it rolled');
  for (const w of words) {
    assert.ok(Array.isArray(w.r) && w.d === TODAY, `SHELF/AC8: a shelf's word is its whole list and the day it was stocked: ${JSON.stringify(Object.keys(w))}`);
    for (const f of ['g', 'lv', 'n', 'tm', 'h', 'b', 'x', 'c', 's', 'si', 'q', 'a', 'y']) assert.equal(w[f], undefined, `SHELF/AC8: a shelf's word carries no room-word field \`${f}\` (a purchase is a trade, not a take)`);
  }
  for (const p of [s.B, s.C]) assert.deepEqual(names(shelfOf(p)), names(stock()), `${p.id} lands the shelf whole`);
  assert.ok(openShelfOf(s.B, wb), 'B opens the same shelf');
  const rows = [...shelfOf(s.B)];
  wa.takeNamed('Dagger'); wa.close(); frame(s.A); s.net.flush();
  assert.deepEqual(names(shelfOf(s.C)), ['Mace', 'Katana', 'Staff'], 'C, with no window open, lands A\'s whole list');
  assert.ok(shelfOf(s.B).length === rows.length && shelfOf(s.B).every((it, i) => it === rows[i]), 'and B\'s open window is untouched (C1)');
  wb.close(); frame(s.B); s.net.flush();
  assert.equal(have(shelfOf(s.C), 'Dagger'), 1, 'recorded (F-1): B\'s untouched close of a window opened before the take republished its stale whole list - the last writer wins, as WORLD6a built it');
  assert.equal(s.net.words(s.B, 'shelf:0').every((w) => !('q' in w) && !('g' in w)), true, 'and no claim was ever said for a shelf');
});

// ═══ T27 - MIXED BUILDS (AC8) ═══════════════════════════════════════════════════════════════════════════════════════════
// A new word carries `d` and no `r`: an older build's landing rule passes the day check, reads no list, and marks the
// cupboard UNREADABLE (M2). An older build's whole list `{ k, r, d }` is never landed over a list: with no state it is the
// BIRTH (terms { g: d, lv: 1, n: 1, tm: -1 } - no mint beats them - its list the carried base); with a state it is that peer's
// DIFF against its own previous word (a piece that fell is its take, judged as a claim, a piece that rose its put) and an
// untouched word changes nothing. The older build here is the whole-list law of 02706035cf, frozen verbatim in the harness.
test('T27 AC8 (a): a NEW word carries `d` and no `r` - an older build\'s landing rule cannot read it: the cupboard is UNREADABLE there (M2), and its own list is never landed over', () => {
  const s = rolled(2, [STOCK()]);
  const wa = firstOpen(s.A); wa.close(); frame(s.A); s.net.flush();
  const words = s.net.words(s.A).map(({ __from, __at, ...r }) => r);
  assert.ok(words.length > 0, 'A said its stock (guard)');
  for (const w of words) {
    assert.equal(w.r, undefined, `T27/AC8 (a): A's word still carries \`r\`, the cupboard's WHOLE list (${JSON.stringify(Object.keys(w))}) - an older build lands it over its own list; a new word carries the day \`d\` and no \`r\`, so the older build marks the cupboard unreadable (M2) and reads nothing`);
    assert.equal(w.d, TODAY, 'and the day \\`d\\`, equal to the generation, for the older build\'s day check');
  }
  const ctx = { containers: [{ ...cupboard(), items: [mk('Flail')], stockedDate: TODAY - 1 }], shelves: [] };
  const seen = new Set(), unreadable = new Set();
  olderApplyInteriorLoot(ctx, words, { seen, today: TODAY, unreadable });
  assert.ok(unreadable.has(KEY), 'T27/AC8 (a): the older build marks the cupboard unreadable (M2)');
  assert.deepEqual(names(ctx.containers[0].items), ['Flail'], 'and lands nothing over its own list'); assert.equal(ctx.containers[0].stockedDate, TODAY - 1, 'nor its day');
});

test('T27 AC8 (b): an older build\'s whole list `{ k, r, d }` with no state to meet is the BIRTH - the new clients\' takes of its pieces are claims one seat judges: two takers of one piece get ONE copy', () => {
  const s = building(3);
  const O = older(s.net, 'oooo-0009', { list: STOCK() });
  O.say(); s.net.flush();
  for (const p of s.ps) assert.deepEqual(names(items(p)), names(STOCK()), `${p.id} lands the older build's list as the cupboard's (guard)`);
  const wb = windowOf(s.B), wc = windowOf(s.C);
  assert.ok(pressYes(s.B, wb) && pressYes(s.C, wc), 'B and C open the cupboard');
  wb.takeNamed('Mace'); wc.takeNamed('Mace'); wb.close(); wc.close();
  frame(s.B); frame(s.C); s.net.flush(); quiesce(s);
  assert.equal(copies(s, 'Mace'), 1, `T27/AC8 (b): B and C took the same Mace off the older build's list in one breath and hold ${copies(s, 'Mace')} copies (${whereIs(s, 'Mace')}) - the older list was landed, not born: nothing judges a take of it`);
  assert.ok(told(s.C), 'and the loser is told');
});

test('T27 AC8 (c): the older build\'s untouched SECOND word changes nothing - a piece a new player took of its list stays taken for everyone and the taker holds it once (today: the second word replaces the list - a resurrection)', () => {
  const s = building(3);
  const O = older(s.net, 'oooo-0009', { list: STOCK() });
  O.say(); s.net.flush();
  O.open();   // the older build opens the cupboard: under its window no word lands on its list (AUDIT WORLD4 C1)
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  wb.takeNamed('Dagger'); wb.close(); frame(s.B); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.deepEqual(names(items(p)), ['Mace', 'Katana', 'Staff'], `${p.id} holds the list less the Dagger B took (guard)`);
  O.close(); O.say(); s.net.flush(); quiesce(s);   // its window stood open since before B\'s take: its close says the same list again, untouched
  for (const p of s.ps) assert.deepEqual(names(items(p)), ['Mace', 'Katana', 'Staff'], `T27/AC8 (c): ${p.id}'s list is ${JSON.stringify(names(items(p)))} after the older build's untouched second word - the Dagger B holds (${whereIs(s, 'Dagger')}) came back: its whole list landed over the room's (a resurrection - a dupe)`);
  assert.equal(packHas(s.B, 'Dagger'), 1, 'and B holds it once');
});

test('T27 AC8 (d): the older build\'s word with a piece GONE is a claim the seat judges, first come - a new player who then takes that piece off a stale row is refused and told', () => {
  const s = building(3);
  const O = older(s.net, 'oooo-0009', { list: STOCK() });
  O.say(); s.net.flush();
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard, and leaves it open (its rows will not change under it)');
  O.take('Katana'); O.say(); s.net.flush();   // the older build took the Katana in its window and closed
  for (const p of [s.A, s.C]) assert.deepEqual(names(items(p)), ['Dagger', 'Mace', 'Staff'], `${p.id} drops the Katana the older build took (guard)`);
  wb.takeNamed('Katana');   // B\'s row is stale
  wb.close(); frame(s.B); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.B, 'Katana'), 0, `T27/AC8 (d): B took the Katana off its open window AFTER the older build's word took it - B holds it (${whereIs(s, 'Katana')}): the older build's take was never judged, so the piece is in both packs`);
  assert.ok(told(s.B), `B is told - it heard ${JSON.stringify(s.B.said)}`);
  for (const p of [s.A, s.B, s.C]) assert.equal(have(items(p), 'Katana'), 0, `${p.id}'s list shows the Katana no more`);
});

test('T27 AC8 (e): the older build\'s word with a piece ADDED is a PUT the seat lands - it is in every list once, takeable as a claim, and the older build\'s untouched repeat does not bring a taken put back', () => {
  const s = building(3);
  const O = older(s.net, 'oooo-0009', { list: STOCK() });
  O.say(); s.net.flush();
  O.open(); O.put(mk('Flail')); O.say(); s.net.flush(); quiesce(s);   // the older build\'s window stands open on the cupboard: it lands nothing under it
  for (const p of s.ps) assert.equal(have(items(p), 'Flail'), 1, `T27/AC8 (e): ${p.id}'s list shows the Flail the older build put in once (${JSON.stringify(names(items(p)))})`);
  const wc = windowOf(s.C);
  assert.ok(pressYes(s.C, wc), 'C opens the cupboard');
  wc.takeNamed('Flail'); wc.close(); frame(s.C); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.C, 'Flail'), 1, 'C holds the put piece');
  for (const p of s.ps) assert.equal(have(items(p), 'Flail'), 0, `${p.id}'s list shows the Flail no more (guard)`);
  O.close(); O.say(); s.net.flush(); quiesce(s);   // its close, untouched: the older build still holds the Flail it put
  for (const p of s.ps) assert.equal(have(items(p), 'Flail'), 0, `T27/AC8 (e): ${p.id}'s list shows the Flail C took (${whereIs(s, 'Flail')}) after the older build's untouched repeat - the put came back with its whole list`);
  assert.equal(packHas(s.C, 'Flail'), 1, 'and C holds it once');
});

test('T27 AC8 (f): an older SEAT\'s memory list over a state changes nothing - the memory a client restores after it has heard the room does not bring back what the room has taken', () => {
  const s = building(3);
  const O = older(s.net, 'oooo-0009', { list: STOCK() });
  O.say(); s.net.flush();
  const memory = O.memory();   // the memory the older seat published while the Dagger was still there
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  wb.takeNamed('Dagger'); wb.close(); frame(s.B); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.deepEqual(names(items(p)), ['Mace', 'Katana', 'Staff'], `${p.id} holds the list less the Dagger B took (guard)`);
  s.C.as(() => s.C.h.members.restorePlaceSharedWorld(clone(memory)));   // C has the state; the older seat\'s memory arrives late
  assert.deepEqual(names(items(s.C)), ['Mace', 'Katana', 'Staff'], `T27/AC8 (f): C's list is ${JSON.stringify(names(items(s.C)))} after the older seat's memory landed over its state - the Dagger B holds came back (${whereIs(s, 'Dagger')})`);
  assert.equal(packHas(s.B, 'Dagger'), 1, 'and B holds it once');
});
