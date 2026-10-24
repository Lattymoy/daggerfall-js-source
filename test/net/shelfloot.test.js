// F-1 (OUTDOOR-LOOT follow-ups, PR A phase 1b, 2026-10-19; test-harness/loot-followups/DESIGN-1b.md section 9 is the contract):
// THE SHOP SHELF JOINS THE CUPBOARD LAW. Red pins for the fix - written first, on the tree before it, each failing BY ITS
// ASSERTION (a message that names the bug or the behaviour that is missing), never by a TypeError, an import or a timeout.
//
// WHAT THE BUG IS. A shop's shelf (`shelf:`) still rides WORLD6a's whole-list word: whoever writes last wins. The shut shop's
// stealing window and the open shop's Steal take from a list another player's stale close rewrites, so a piece already
// stolen comes back for the next thief (a free copy), a piece another put there is erased (a loss), and two thieves of one
// piece in one breath each keep it. The fix makes the shelf the room's one list, as a cupboard is: a carried base minted at
// the day's stock, every move off it a claim the building's seat judges first come, the loser told "Someone took that first.",
// the piece lifted until the verdict, nothing composed under an open window (C1). Three kinds of move: a TAKE (the shut shop's
// window), a THEFT (the open counter's Steal, on a successful roll) and a SALE (the open counter's Buy - never lifted, never
// told: a double sale is paid twice, recorded, the next slice's refund).
//
// MOUNTED, NOT MATCHED, and never a module that does not exist yet. The players are the interior host's own doors sliced out of
// worldModes.js by ./containerLootHarness.mjs - openShelf's two arms, openTradeWindow, commitTrade, openMerchantSell, the frame's
// settle, the mint, the leave, world.js's act path - over the REAL trade windows (ui/native/nativeTrade.js: _pickRemote, _doSteal,
// _modeAction and its Yes; ui/enhanced/enhancedTrade.js mounted over a document: its Steal and its Yes), the real theft law
// (shopliftAttempt, shopShelfTheft, tallyCrimeGuildRequirements, tallySkill), and the real producers (stockShopShelf on a
// player's own dice, or a `shelfRoll` of `mk` pieces where a pin needs a chosen stock). The roll of a Steal is the player's own
// dice (0.999 is a success - the chance is clamped to 95 - and 0 a catch); no law is replaced. What every pin reads is WHERE EACH
// PIECE IS once every timeout has passed: every player's pack, every player's composed shelf list with no window open, the
// census, the theft mark and the guild tally.
//
// Run on the tree at 07c5299a1c every red pin fails by its assertion; the guards (named so) pass and must stay green.
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_TAKEN_TEXT, ROOM_CLAIMS_MAX, ROOM_CLAIM_TIMEOUT_MS, baseSignature } from '../../src/systems/roomLoot.js';
import { LOOT_NEWER_TEXT, LOOT_LIST_MAX } from '../../src/systems/loot/loot.js';
import { stealSuccessText } from '../../src/ui/native/nativeTrade.js';
import { isStolen } from '../../src/systems/stolenGoods.js';
import { confiscateStolen } from '../../src/systems/court.js';
import { CRIMES } from '../../src/systems/crimes.js';
import { SKILLS } from '../../src/systems/skills.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { setStowedKeys, ledgerKeyOf } from '../../src/systems/item/itemIds.js';
import { templateByIndex } from '../../src/systems/item/itemTemplates.js';
import { isBagItem, BAG_TEMPLATE } from '../../src/net/bagLaw.js';
import { PATRON_COUNTER_MARK } from '../../src/net/patronLaw.js';
import { mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';
import { actFrameFits } from '../../src/net/wire.js';
import { isShop, stockShopShelf } from '../../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { applyRarity } from '../../src/systems/loot/lootRarity.js';
import { seeded } from '../honestItems.mjs';
import {
  REAL_RANDOM, TODAY, ROOM, clock, mk, names, have, packHas, windowOf, realWindowOf, bulkAsync, frame, elapse, quiesce, building, player, relay,
  SHOP, SHOP_OPEN, openShelfOf, shelfOf, openCounter, openSell, rich, stage, stageLocal, steal, buy, closeCounter, older, lcg, lightPieces,
  wallNow, clone, bulk,
} from './containerLootHarness.mjs';

afterEach(() => { Math.random = REAL_RANDOM; setSharedClock(null); setStowedKeys(null); delete globalThis.location; });

// ── the room's stock when a pin does not care what is in it: four distinct pieces, none stacking with another ───────────────
const STOCK = () => [mk('Dagger'), mk('Mace'), mk('Katana'), mk('Staff')];
const KEY = 'shelf:0';
/** The pieces named in every present player's pack, and the lists that still show it - for a message. */
const whereIs = (s, name) => JSON.stringify({ packs: Object.fromEntries(s.ps.map((p) => [p.id, packHas(p, name)]).filter(([, n]) => n)), lists: s.ps.filter((p) => p.kind === 'client' && have(shelfOf(p), name)).map((p) => p.id) });
/** How many of a piece the players hold between them. */
const copies = (s, name) => s.ps.reduce((n, p) => n + packHas(p, name), 0);
const told = (p) => p.said.includes(ROOM_TAKEN_TEXT);
const tally = (p) => p.entity.thievesGuildRequirementTally ?? 0;
const pickpocket = (p) => p.entity.skillUses[SKILLS.Pickpocket];
/** The pieces of a name a player holds that carry the theft's mark. */
const markedIn = (p, name) => p.entity.items.filter((it) => it.name === name && isStolen(it)).reduce((n, it) => n + (it.stackCount ?? 1), 0);
/** Every client's composed list, by name (no window open). */
const lists = (s) => Object.fromEntries(s.ps.filter((p) => p.kind === 'client').map((p) => [p.id, names(shelfOf(p))]));
/** A building of `n` with a shelf apiece: `open` the players (indexes) standing in an OPEN shop, `roll` the stock each one's first stocking rolls. */
function shop(n = 3, { open = [], roll = STOCK, each = [] } = {}) {
  return building(n, { each: Array.from({ length: n }, (_, i) => ({ shelves: 1, building: { ...(open.includes(i) ? SHOP_OPEN : SHOP) }, shelfRoll: roll, ...(each[i] ?? {}) })) });
}
/** A's press stocks the shelf (the shut shop's stealing window opens and closes), A's word goes out, and every client lists it. */
function stocked(n = 3, opts = {}) {
  const s = shop(n, opts);
  const wa = windowOf(s.A);
  assert.ok(openShelfOf(s.A, wa), 'A\'s press opened the shelf (the stealing window)');
  const stock = names(shelfOf(s.A));
  assert.ok(stock.length >= 2, `A's press stocked the shelf on A's dice (${JSON.stringify(stock)})`);
  wa.close(); frame(s.A); s.net.flush();
  for (const p of s.ps) assert.deepEqual(names(shelfOf(p)), stock, `${p.id} lists the shelf A stocked (guard)`);
  s.stock = stock;
  return s;
}
/** A shut shop's stealing window on the shelf, opened by `p`. */
const shut = (p) => { const w = windowOf(p); assert.ok(openShelfOf(p, w), `${p.id}'s press opened the stealing window`); return w; };
/** One player's take of a piece through a shut window, said: the press, the click, the close, the frame, the relay. */
function steals(s, p, name) { const w = shut(p); w.takeNamed(name); w.close(); frame(p); s.net.flush(); return w; }
const hold = (s, from, to) => s.net.hold(`${from.id}>${to.id}`);
const release = (s, from, to) => s.net.release(`${from.id}>${to.id}`);
/** The words a player said about the shelf, with the claims among them. */
const claimWords = (s, p) => s.net.words(p, KEY).filter((r) => Array.isArray(r.q));

// ═══ AC-S1 - TWO THIEVES, ONE PIECE, ONE BREATH: ONE COPY, AND THE LOSER IS TOLD ════════════════════════════════════════════
test('T-S1a F-1 AC-S1: B and C take the one Katana off the shut shelf in one breath - exactly one copy, the first claim to reach the seat has it, the other is told ROOM_TAKEN_TEXT and holds none', () => {
  const s = stocked(3);
  const wb = shut(s.B), wc = shut(s.C);
  wb.takeNamed('Katana'); wc.takeNamed('Katana');   // each from the list it sees
  wb.close(); wc.close();
  frame(s.B); frame(s.C);   // both claims are on the wire before either verdict
  s.net.flush();
  quiesce(s);
  assert.equal(copies(s, 'Katana'), 1, `F-1/AC-S1: B and C took the same Katana in one breath and the players hold ${copies(s, 'Katana')} copies of it (${whereIs(s, 'Katana')}) - nothing judges a take off a shelf: each client's take is its own, and the later close's whole list lands over the other's`);
  assert.equal(packHas(s.B, 'Katana'), 1, 'F-1/AC-S1: the claim that reached the seat first (B\'s) has the piece');
  assert.equal(packHas(s.C, 'Katana'), 0, 'F-1/AC-S1: and C holds nothing of it');
  assert.ok(told(s.C), `F-1/AC-S1: the loser is told "Someone took that first." (ROOM_TAKEN_TEXT) - C heard ${JSON.stringify(s.C.said)}`);
  assert.equal(told(s.B), false, 'the winner is told nothing');
  assert.ok(claimWords(s, s.B).length > 0, `F-1/AC-S1: B said its take as a claim (\`q\`) for the seat to judge - it said ${JSON.stringify(s.net.words(s.B, KEY).map((r) => Object.keys(r).filter((k) => !k.startsWith('__'))))}`);
  for (const p of s.ps) assert.equal(have(shelfOf(p), 'Katana'), 0, `F-1/AC-S1: ${p.id}'s list shows the Katana no more`);
});

test('T-S1b F-1 AC-S1 (R-1): the seat\'s frame never runs - it judges both claims on the Katana on receipt, B lands it, C is told, nothing lapses back', () => {
  const s = stocked(3);
  const wb = shut(s.B), wc = shut(s.C);
  wb.takeNamed('Katana'); wc.takeNamed('Katana');
  wb.close(); wc.close();
  frame(s.B); frame(s.C);
  s.net.flush();
  elapse(s, 40_000, { skip: [s.A] });   // a hidden tab: the seat's socket delivers, its animation frame never runs
  assert.equal(copies(s, 'Katana'), 1, `F-1/AC-S1 (R-1): with the seat's frame never run the players hold ${copies(s, 'Katana')} copies of the Katana (${whereIs(s, 'Katana')}) - the seat must judge a claim on receipt`);
  assert.equal(packHas(s.B, 'Katana'), 1, 'B has it'); assert.equal(packHas(s.C, 'Katana'), 0, 'C holds none');
  assert.ok(told(s.C), `C is told - it heard ${JSON.stringify(s.C.said)}`);
  for (const p of s.ps) assert.equal(have(shelfOf(p), 'Katana'), 0, `${p.id}'s list shows the Katana no more - none lapsed back (${JSON.stringify(lists(s))})`);
});

test('T-S1c F-1 AC-S1 (SPLIT-LIFT): C takes four of the ten arrows off the shut shelf after B took all ten - C\'s take is refused and lifted as the MARKED four it carried off; its own honest arrows stand, and it is told', () => {
  const arrows = (n) => mk('Arrow', 'Weapons', { stackCount: n });
  const s = stocked(3, { roll: () => [mk('Dagger'), arrows(10)] });
  s.C.entity.items.push(arrows(5));   // C\'s own honest arrows
  const wc = shut(s.C);   // C\'s row is stale from here
  steals(s, s.B, 'Arrow');   // B takes all ten first
  wc.takeAmount('Arrow', 4);
  assert.equal(markedIn(s.C, 'Arrow'), 4, 'four marked arrows are in C\'s pack, beside its own five (guard)');
  wc.close(); frame(s.C); s.net.flush(); quiesce(s);
  assert.equal(markedIn(s.C, 'Arrow'), 0, `F-1/AC-S1 (SPLIT-LIFT): C keeps ${markedIn(s.C, 'Arrow')} stolen arrows of a take that lost the race`);
  assert.equal(have(s.C.entity.items, 'Arrow'), 5, `and C's own honest arrows stand: ${have(s.C.entity.items, 'Arrow')} of 5 (a lift of the shelf's unmarked record would take them)`);
  assert.equal(markedIn(s.B, 'Arrow'), 10, 'B holds all ten, marked');
  assert.ok(told(s.C), 'C is told');
  assert.equal(tally(s.C), 0, 'with no credit');
});

// ═══ AC-S2 - A STALE CLOSE NEVER RESURRECTS A STOLEN PIECE FOR THE NEXT THIEF, NOR ERASES ONE ═══════════════════════════════
test('T-S2a F-1 AC-S2: B\'s window stands; C steals the Dagger and closes; B closes untouched - no list shows the Dagger, and D, the next thief, finds none to take', () => {
  const s = stocked(4);
  const wb = shut(s.B);   // B\'s window opened before C\'s take, and is closed after it
  steals(s, s.C, 'Dagger');
  wb.close(); frame(s.B); s.net.flush();
  quiesce(s);
  for (const p of s.ps) assert.equal(have(shelfOf(p), 'Dagger'), 0, `F-1/AC-S2: ${p.id}'s list still shows the Dagger C stole (${JSON.stringify(lists(s))}) - B's untouched close republished its whole stale list, the last writer wins, and the stolen piece is back for everyone`);
  const wd = shut(s.D);
  assert.equal(have(wd.list(), 'Dagger'), 0, 'F-1/AC-S2: D, the next thief, is offered the Dagger C already stole - a free second copy');
  assert.equal(copies(s, 'Dagger'), 1, `one Dagger in all (${whereIs(s, 'Dagger')})`);
  assert.equal(packHas(s.C, 'Dagger'), 1, 'C holds it');
});

test('T-S2b F-1 AC-S2: B\'s window stands; C stashes a Longsword on the shut shelf and closes; B closes untouched - the Longsword is in every list once, and C holds it no more', () => {
  const s = stocked(3);
  const wb = shut(s.B);
  const longsword = mk('Longsword');
  s.C.entity.items.push(longsword);
  const wc = shut(s.C);
  wc.put(longsword); wc.close(); frame(s.C); s.net.flush();
  wb.close(); frame(s.B); s.net.flush();
  quiesce(s);
  for (const p of s.ps) assert.equal(have(shelfOf(p), 'Longsword'), 1, `F-1/AC-S2: ${p.id}'s list shows ${have(shelfOf(p), 'Longsword')} Longswords, not one (${JSON.stringify(lists(s))}) - B's untouched stale close erased C's put: the Longsword is in no list and no pack, a loss`);
  assert.equal(copies(s, 'Longsword'), 0, 'and C holds it no more - it is the shelf\'s');
});

// ═══ AC-S3 - TAKE ALL AT A SHELF ═════════════════════════════════════════════════════════════════════════════════════════════
test(`T-S3 F-1 AC-S3: B's Take all (the real enhanced window) of a shut shelf of 40 pieces under C's open window - every piece lands in B once, said in consecutive claim words of at most ${ROOM_CLAIMS_MAX}, every piece marked stolen, B's guild tally once; C's untouched close brings none back`, () => bulk((dom) => {
  const stock = lightPieces(40);
  const s = stocked(3, { roll: () => stock });
  const wc = shut(s.C);   // C's window opened before B's take: its close, untouched, is the stale one
  const wb = realWindowOf(s.B, dom);
  assert.ok(openShelfOf(s.B, wb), 'B opens the shelf');
  assert.equal(shelfOf(s.B).length, stock.length, 'B\'s window lists all of it (guard)');
  wb.press('Take all');
  assert.equal(s.B.entity.items.length, stock.length, 'B\'s Take all moved every row into its pack (guard)');
  wb.close(); frame(s.B); s.net.flush();
  wc.close(); frame(s.C); s.net.flush();
  quiesce(s);
  for (const p of s.ps) assert.equal(shelfOf(p).length, 0, `F-1/AC-S3: ${p.id}'s list holds ${shelfOf(p).length} of the 40 pieces B took (${JSON.stringify(names(shelfOf(p)).slice(0, 3))}...) - C's untouched close of a window opened before the take brought every one of them back`);
  for (const it of stock) assert.equal(packHas(s.B, it.name), 1, `B holds ${it.name} once`);
  assert.equal(s.B.entity.items.every(isStolen), true, 'every piece B took is marked stolen (STOLEN-GOODS)');
  assert.equal(tally(s.B), 1, 'B\'s Thieves Guild tally moved once');
  const words = claimWords(s, s.B);
  assert.ok(words.length >= 2, `F-1/AC-S3: B said its Take all of ${stock.length} pieces in ${words.length} claim words (\`q\`) - a bulk take is a claim per piece, ${ROOM_CLAIMS_MAX} to a word and consecutive words after that; today it is one whole-list word (${JSON.stringify(s.net.words(s.B, KEY).map((r) => Object.keys(r).filter((k) => !k.startsWith('__'))))})`);
  assert.ok(words.every((r) => r.q.length <= ROOM_CLAIMS_MAX), `no word carries more than ${ROOM_CLAIMS_MAX} claims`);
  assert.equal(new Set(words.flatMap((r) => r.q.map((c) => c.id))).size, stock.length, 'every piece is claimed once');
  assert.equal(s.C.entity.items.length, 0, 'C holds nothing');
}));

// ═══ AC-S4 - D-1 AT THE BUILDING'S EXIT ═════════════════════════════════════════════════════════════════════════════════════
test('T-S4a F-1 AC-S4 (D-1): B steals the Katana with the seat\'s verdict held on the wire - the Katana is out of B\'s pack while the claim stands, no list shows it, and B\'s leave (exitInteriorNow\'s statements) gives it back: one copy, B\'s, and B\'s guild credit paid at the keep', () => {
  const s = stocked(3);
  hold(s, s.A, s.B);   // the seat's verdict waits on the wire
  steals(s, s.B, 'Katana');
  assert.equal(packHas(s.B, 'Katana'), 0, `F-1/AC-S4: the Katana is in B's pack (${whereIs(s, 'Katana')}) while its claim has no verdict - a take of a shelf's piece is B's own, never a claim: it is not lifted until the seat has judged it`);
  assert.equal(tally(s.B), 0, 'F-1/AC-S4: B\'s Thieves Guild credit waits for the verdict - it is paid at the close today, for a piece B may not win');
  for (const p of s.ps) assert.equal(have(shelfOf(p), 'Katana'), 0, `${p.id}'s list shows no Katana while B's claim stands`);
  s.B.as(() => s.B.h.leave()); s.B.here = false;   // B leaves the building, inside the timeout, with the verdict unheard
  release(s, s.A, s.B); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.B, 'Katana'), 1, 'D-1: B\'s claim in flight and not lapsed goes with B - the piece is given at the leave');
  assert.equal(markedIn(s.B, 'Katana'), 1, 'and it is marked stolen');
  assert.equal(tally(s.B), 1, 'F-1/AC-S4: and B\'s guild credit is paid at the keep');
  assert.equal(copies(s, 'Katana'), 1, `one copy (${whereIs(s, 'Katana')})`);
  for (const p of [s.A, s.C]) assert.equal(have(shelfOf(p), 'Katana'), 0, `${p.id}'s list shows the Katana no more`);
});

test('T-S4b F-1 AC-S4 (D-1): B leaves with the stealing window still OPEN after taking the Katana - the per-frame settle claimed it, the teardown keeps it, and the seat and C list it no more', () => {
  const s = stocked(3);
  hold(s, s.A, s.B);
  const wb = shut(s.B);
  wb.takeNamed('Katana');
  frame(s.B); s.net.flush();   // the frame's settle reads the take under the open window: claimed as it is made
  s.B.as(() => s.B.h.leave()); s.B.here = false;
  s.net.flush(); quiesce(s);
  for (const p of [s.A, s.C]) assert.equal(have(shelfOf(p), 'Katana'), 0, `F-1/AC-S4: ${p.id}'s list still shows the Katana B took (${whereIs(s, 'Katana')}) - B left with its window open and the take was never said (no close, and the leave settles cupboards alone): the next thief gets a second`);
  assert.equal(packHas(s.B, 'Katana'), 1, 'B holds it once - the teardown keeps what is in flight');
  assert.equal(copies(s, 'Katana'), 1, `one copy (${whereIs(s, 'Katana')})`);
});

test('T-S4b2 F-1 AC-S4 (D-1): B leaves with the window still open and NO frame between the take and the leave - the leave\'s own settle claims it first, and the seat and C list it no more', () => {
  const s = stocked(3);
  hold(s, s.A, s.B);
  const wb = shut(s.B);
  wb.takeNamed('Katana');
  s.B.as(() => s.B.h.leave()); s.B.here = false;   // a take made this frame is claimed and said first (D-1a)
  s.net.flush(); quiesce(s);
  for (const p of [s.A, s.C]) assert.equal(have(shelfOf(p), 'Katana'), 0, `F-1/AC-S4: ${p.id}'s list still shows the Katana B took (${whereIs(s, 'Katana')}) - the leave said nothing of it`);
  assert.equal(copies(s, 'Katana'), 1, `one copy (${whereIs(s, 'Katana')})`);
});

test('T-S4c F-1 AC-S4 (D-1, recorded limit - guard): a claim that LAPSED before the leave is not kept - the Katana is back in B\'s list, not B\'s pack, and no guild credit is paid', () => {
  const s = stocked(3);
  hold(s, s.A, s.B);
  steals(s, s.B, 'Katana');
  elapse(s, ROOM_CLAIM_TIMEOUT_MS + 1000);   // the verdict never comes: the claim lapses, its piece reads as back in the shelf for its taker
  assert.equal(packHas(s.B, 'Katana'), 0, `F-1/AC-S4: B's pack holds the Katana (${whereIs(s, 'Katana')}) after its claim lapsed - a take is never lifted, so B keeps the piece whatever the seat heard`);
  assert.equal(have(shelfOf(s.B), 'Katana'), 1, 'the Katana reads as back in B\'s own list');
  s.B.as(() => s.B.h.leave()); s.B.here = false;
  assert.equal(packHas(s.B, 'Katana'), 0, 'a lapsed claim is not kept at the leave: the Katana is not B\'s pack');
  assert.equal(tally(s.B), 0, 'and no guild credit is paid');
});

// ═══ AC-S5 - THE THEFT MARK AND THE GUILD CREDIT ONLY FOR THE PIECE ACTUALLY WON ══════════════════════════════════════════════
test('T-S5a F-1 AC-S5: of B and C racing for the Katana, only the winner holds a marked piece and only the winner\'s Thieves Guild tally moves; the loser\'s pack holds nothing marked and its tally is 0', () => {
  const s = stocked(3);
  const wb = shut(s.B), wc = shut(s.C);
  wb.takeNamed('Katana'); wc.takeNamed('Katana');
  wb.close(); wc.close();
  frame(s.B); frame(s.C); s.net.flush(); quiesce(s);
  assert.equal(markedIn(s.B, 'Katana'), 1, 'the winner holds a marked Katana');
  assert.equal(tally(s.B), 1, 'and its Thieves Guild tally moved once');
  assert.equal(s.C.entity.items.filter(isStolen).length, 0, `F-1/AC-S5: C, who lost the race, holds ${s.C.entity.items.filter(isStolen).length} marked piece(s) - a refused take is lifted out of the pack with its mark, so a marked piece is only ever a held one`);
  assert.equal(tally(s.C), 0, `F-1/AC-S5: C's Thieves Guild tally moved to ${tally(s.C)} for a piece it never won`);
});

test('T-S5b F-1 AC-S5: the shut shelf\'s credit waits for the verdict - with A>B held, B\'s tally is 0 after its close; the grant lands it, once', () => {
  const s = stocked(3);
  hold(s, s.A, s.B);
  steals(s, s.B, 'Katana');
  assert.equal(tally(s.B), 0, `F-1/AC-S5: B's tally is ${tally(s.B)} at the close - the credit is paid before the seat has judged the take, and a take it refuses is no theft`);
  release(s, s.A, s.B); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.B, 'Katana'), 1, 'the grant lands the Katana');
  assert.equal(tally(s.B), 1, 'and the credit once');
});

test('T-S5c F-1 AC-S5 (D7, guard): a refused WHOLE take that lapsed and was shown back is never marked on the shelf - at no time does a piece in any client\'s composed list carry the mark', () => {
  const s = stocked(3);
  const wb = shut(s.B);   // B\'s row is stale: it never hears the seat's word about C
  hold(s, s.A, s.B);
  steals(s, s.C, 'Katana');   // C wins the Katana
  wb.takeNamed('Katana');     // B takes it off its stale row, the record marked as the window marks it
  wb.close(); frame(s.B); s.net.flush();
  elapse(s, ROOM_CLAIM_TIMEOUT_MS + 1000);   // B's claim lapses unanswered: its piece reads as back in B's own list
  const marked = (p) => (shelfOf(p) ?? []).filter(isStolen).map((it) => it.name);
  for (const p of s.ps) assert.deepEqual(marked(p), [], `F-1/AC-S5 (D7): a piece in ${p.id}'s composed list carries the theft mark (${JSON.stringify(marked(p))}) - a shelf's piece is its owner's, and buying it later would mark a purchase stolen`);
  release(s, s.A, s.B); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.deepEqual(marked(p), [], `${p.id}'s list carries no mark after quiesce`);
});

test('T-S5d F-1 AC-S5 (the seat): the seat\'s OWN take of a piece B reached it with first is refused - lifted back out of its pack, told, and given no credit; B holds the piece marked, with the credit', () => {
  const s = stocked(3);
  const wa = shut(s.A);   // A's window opened before B's take: its row is stale
  steals(s, s.B, 'Katana');   // B's claim reaches the seat first
  wa.takeNamed('Katana');
  wa.close(); frame(s.A); s.net.flush(); quiesce(s);
  assert.equal(copies(s, 'Katana'), 1, `F-1/AC-S5: B took the Katana and the seat then took the same row from the window it had open: ${copies(s, 'Katana')} copies (${whereIs(s, 'Katana')})`);
  assert.equal(packHas(s.A, 'Katana'), 0, 'the seat\'s own take is lifted back out of its pack');
  assert.ok(told(s.A), `and it is told - A heard ${JSON.stringify(s.A.said)}`);
  assert.equal(tally(s.A), 0, `F-1/AC-S5: the seat's guild tally is ${tally(s.A)} - no credit for a take it refused itself`);
  assert.equal(markedIn(s.B, 'Katana'), 1, 'B holds it marked'); assert.equal(tally(s.B), 1, 'with the credit');
  for (const p of s.ps) assert.equal(have(shelfOf(p), 'Katana'), 0, `${p.id}'s list shows the Katana no more`);
});

// ═══ AC-S6 - THE OPEN SHOP'S STEAL IS A CLAIM, WITH THE ROLL'S OUTCOME INTACT ═══════════════════════════════════════════════
test('T-S6a F-1 AC-S6: C (the shut window) reaches the seat first with the Katana; B, whose counter opened before, stages it and Steals (a success) - B is told ROOM_TAKEN_TEXT after "You are successful.", holds no Katana, its Pickpocket tally moved once and its guild tally did not, no crime; C holds it marked, with the credit', () => {
  const s = stocked(3, { open: [1] });
  const win = openCounter(s.B);
  assert.ok(win, 'B\'s counter opens (the open shop\'s Buy window)');
  steals(s, s.C, 'Katana');   // C's claim reaches the seat first
  stage(s.B, win, 'Katana');   // from B\'s own (stale) row
  steal(s.B, win);
  frame(s.B); s.net.flush(); quiesce(s);
  assert.equal(copies(s, 'Katana'), 1, `F-1/AC-S6: C took the Katana through the shut window and B Stole the same piece from the counter it opened before: ${copies(s, 'Katana')} copies (${whereIs(s, 'Katana')}) - a Steal is not a claim, so no one judges it`);
  assert.equal(packHas(s.B, 'Katana'), 0, 'B holds no Katana');
  assert.ok(told(s.B), `B is told "Someone took that first." - it heard ${JSON.stringify(s.B.said)}`);
  assert.ok(s.B.said.indexOf(stealSuccessText()) >= 0 && s.B.said.indexOf(stealSuccessText()) < s.B.said.indexOf(ROOM_TAKEN_TEXT), `B hears the roll's line first, then the room's (${JSON.stringify(s.B.said)})`);
  assert.equal(pickpocket(s.B), 1, 'B\'s Pickpocket tally moved once, as the roll\'s own');
  assert.equal(tally(s.B), 0, `F-1/AC-S6: B's Thieves Guild tally is ${tally(s.B)} - the guild credit is for a piece actually won`);
  assert.ok(!s.B.entity.crimeCommitted, 'no crime: the roll succeeded');
  assert.equal(markedIn(s.C, 'Katana'), 1, 'C holds the Katana marked');
  assert.equal(tally(s.C), 1, 'and has the credit');
});

test('T-S6b F-1 AC-S6: B\'s Steal reaches the seat first - C\'s shut-window take of the same Katana is refused, lifted and told, with no credit; B holds it marked and B\'s guild tally moves once, on the grant', () => {
  const s = stocked(3, { open: [1] });
  const win = openCounter(s.B);
  const wc = shut(s.C);
  wc.takeNamed('Katana');   // C\'s take is not said until its close
  stage(s.B, win, 'Katana');
  steal(s.B, win);
  frame(s.B); s.net.flush();   // B\'s claim reaches the seat first
  wc.close(); frame(s.C); s.net.flush(); quiesce(s);
  assert.equal(copies(s, 'Katana'), 1, `F-1/AC-S6: B Stole the Katana and C took it through the shut window it had open: ${copies(s, 'Katana')} copies (${whereIs(s, 'Katana')})`);
  assert.equal(markedIn(s.B, 'Katana'), 1, 'B holds it marked');
  assert.equal(tally(s.B), 1, 'B\'s guild tally moved once, on the grant');
  assert.equal(packHas(s.C, 'Katana'), 0, 'C\'s take is refused and lifted');
  assert.ok(told(s.C), `C is told - it heard ${JSON.stringify(s.C.said)}`);
  assert.equal(tally(s.C), 0, `F-1/AC-S6: C's guild tally is ${tally(s.C)} - no credit for a refused take`);
  assert.equal(pickpocket(s.B), 1, 'B\'s Pickpocket tally moved once');
});

test('T-S6c F-1 AC-S6 (guard): a CAUGHT Steal moves nothing - crime and guards, the Pickpocket tally, no guild tally, the basket back on B\'s shelf, nothing claimed, and the Katana still the room\'s for C', () => {
  const s = stocked(3, { open: [1] });
  const win = openCounter(s.B);
  stage(s.B, win, 'Katana');
  steal(s.B, win, { caught: true });
  assert.equal(s.B.entity.crimeCommitted, CRIMES.Theft, 'the crime is recorded');
  assert.deepEqual(s.B.guards, [true], 'and the guards are called');
  assert.equal(pickpocket(s.B), 1, 'the Pickpocket tally moved, as DFU\'s :914');
  assert.equal(tally(s.B), 0, 'no guild tally');
  assert.equal(packHas(s.B, 'Katana'), 0, 'B holds nothing');
  assert.equal(win.basket.length, 0, 'the basket went back to the shelf with the window\'s close');
  frame(s.B); s.net.flush(); quiesce(s);
  assert.equal(s.net.words(s.B, KEY).filter((r) => r.q || r.a).length, 0, 'nothing was claimed or put');
  for (const p of s.ps) assert.equal(have(shelfOf(p), 'Katana'), 1, `${p.id}'s list still shows the Katana`);
  steals(s, s.C, 'Katana'); quiesce(s);
  assert.equal(packHas(s.C, 'Katana'), 1, 'the Katana is C\'s to take - it was never lost');
});

test('T-S6d F-1 AC-S6 (both skins): the enhanced counter\'s Steal (its Yes) under the same race as the first - one copy, the loser told, the winner\'s credit alone', async () => bulkAsync(async (dom) => {
  const s = stocked(3, { open: [1] });
  const win = openCounter(s.B);
  assert.ok(win, 'B\'s counter opens');
  for (let i = 0; i < 60 && !dom.body.querySelector('.packremote'); i++) await new Promise((r) => setTimeout(r, 0));
  assert.ok(dom.body.querySelector('.packremote'), 'the enhanced counter mounted over the document (guard)');
  try {
    steals(s, s.C, 'Katana');   // C reaches the seat first
    const rows = dom.body.querySelector('.packremote').querySelectorAll('.itemrow');
    const nameOf = (r) => r.children.find((c) => c.className === 'itemname')?.children[0]?.textContent ?? '';
    const row = rows.find((r) => nameOf(r).startsWith('Katana'));
    assert.ok(row, `B's enhanced counter shows the Katana (${JSON.stringify(rows.map(nameOf))})`);
    const press = (n) => s.B.as(() => n.onclick({ timeStamp: 1e9 * Math.random() }));
    press(row);   // a single click selects, the footer's primary button stages it
    press(dom.body.querySelectorAll('.act.primary')[0]);
    s.B.rand = () => 0.999;
    press(dom.body.querySelector('.trade-steal'));
    press(dom.body.querySelector('.sb-acts').children.find((b) => b.textContent === 'Yes'));
    s.B.rand = lcg(11);
    frame(s.B); s.net.flush(); quiesce(s);
    assert.equal(copies(s, 'Katana'), 1, `F-1/AC-S6 (enhanced): ${copies(s, 'Katana')} copies of the Katana (${whereIs(s, 'Katana')}) - the enhanced counter's Steal is no claim either`);
    assert.equal(packHas(s.B, 'Katana'), 0, 'B holds none');
    assert.ok(told(s.B), `B is told - it heard ${JSON.stringify(s.B.said)}`);
    assert.equal(tally(s.B), 0, `B's guild tally is ${tally(s.B)}`);
    assert.equal(tally(s.C), 1, 'C has the credit');
    assert.equal(markedIn(s.C, 'Katana'), 1, 'C holds it marked');
  } finally { win.dispose(); }
}));

test('T-S6e F-1 AC-S6: a Steal that SPLIT a stack (four of ten arrows staged) and lost is lifted as its marked four - the taker\'s own honest arrows stand', () => {
  const arrows = (n) => mk('Arrow', 'Weapons', { stackCount: n });
  const s = stocked(3, { open: [1], roll: () => [mk('Dagger'), arrows(10)] });
  s.B.entity.items.push(arrows(5));   // B\'s own honest arrows
  const win = openCounter(s.B);
  stage(s.B, win, 'Arrow', 4);
  assert.equal(win.basket[0]?.stackCount, 4, 'four of ten staged (guard)');
  steals(s, s.C, 'Arrow');   // C takes all ten first
  steal(s.B, win);
  frame(s.B); s.net.flush(); quiesce(s);
  assert.equal(markedIn(s.B, 'Arrow'), 0, `F-1/AC-S6 (SPLIT-LIFT): B keeps ${markedIn(s.B, 'Arrow')} stolen arrows of a Steal that lost the race - the lift reaches the marked four it carried off`);
  assert.equal(have(s.B.entity.items, 'Arrow'), 5, `and B's own honest arrows stand: ${have(s.B.entity.items, 'Arrow')} of 5 (a lift of the shelf's unmarked record would take them)`);
  assert.equal(markedIn(s.C, 'Arrow'), 10, 'C holds all ten, marked');
  assert.ok(told(s.B), 'B is told');
});

// ═══ AC-S7 - BUY STAYS A TRADE, AND COEXISTS WITH THE CLAIM LAW ═══════════════════════════════════════════════════════════════
const goldOf = (p) => p.entity.goldPieces | 0;
const PURSE = 3000;   // gold weighs: a purse of a hundred thousand would leave the buyer unable to carry the piece
const fund = (p) => rich(p, PURSE);
test('T-S7a F-1 AC-S7 (D5): B buys the Katana at the open counter (its own staging and Yes, the host\'s commitTrade) - B pays the price, holds it unmarked and counter-bought, it is never lifted (A>B held, then released) and B is told nothing; D\'s window, opened before the sale, closes untouched and the Katana is back for nobody - C, the next thief, finds none', () => {
  globalThis.location = { search: '?online' };   // a counter's piece is marked counter-bought online (markCounterBought)
  const s = stocked(4, { open: [1] });
  const wd = shut(s.D);   // D's window opened before the sale
  hold(s, s.A, s.B);
  const win = openCounter(s.B);
  fund(s.B);
  const gold0 = goldOf(s.B);
  stage(s.B, win, 'Katana');
  const price = buy(s.B, win);
  assert.ok(price > 0, 'the counter quoted a price (guard)');
  assert.equal(gold0 - goldOf(s.B), price, 'B paid the price (guard)');
  closeCounter(s.B, win);
  frame(s.B); s.net.flush();   // the sale is said to the seat; its verdict waits on the wire
  const katana = () => s.B.entity.items.find((it) => it.name === 'Katana');
  assert.ok(katana(), 'B holds the Katana it paid for - a sale is never lifted, whatever the seat has heard (guard)');
  assert.equal(isStolen(katana()), false, 'unmarked (guard)');
  assert.equal(katana()[PATRON_COUNTER_MARK], true, 'and counter-bought (guard)');
  release(s, s.A, s.B); s.net.flush();
  wd.close(); frame(s.D); s.net.flush();   // D's untouched close, stale: it still lists the Katana
  quiesce(s);
  assert.equal(packHas(s.B, 'Katana'), 1, 'B still holds it once, after the seat\'s verdict (guard)');
  assert.equal(told(s.B), false, 'and B is told nothing (guard)');
  for (const p of s.ps) assert.equal(have(shelfOf(p), 'Katana'), 0, `F-1/AC-S7: ${p.id}'s list shows the Katana B bought (${JSON.stringify(lists(s))}) - D's untouched close republished its whole stale list, the last writer wins, and a sold piece is back on the shelf for everyone`);
  const wc = shut(s.C);
  assert.equal(have(wc.list(), 'Katana'), 0, 'F-1/AC-S7: C, the next thief, is offered the Katana B paid for - a free copy');
});

test('T-S7b F-1 AC-S7 (recorded - the next slice\'s refunds; guard): B and C buy the one Katana in one breath - both pay, both hold it, neither is lifted or told, and no list shows it after', () => {
  const s = stocked(3, { open: [1, 2] });
  const wb = openCounter(s.B), wc = openCounter(s.C);
  fund(s.B); fund(s.C);
  stage(s.B, wb, 'Katana'); stage(s.C, wc, 'Katana');
  const paid = [buy(s.B, wb), buy(s.C, wc)];
  assert.ok(paid.every((x) => x > 0), 'both paid');
  closeCounter(s.B, wb); closeCounter(s.C, wc);
  frame(s.B); frame(s.C); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.B, 'Katana'), 1, 'B holds the Katana it paid for');
  assert.equal(packHas(s.C, 'Katana'), 1, 'and so does C (the paid double sale, recorded: the refund is the next slice\'s)');
  assert.equal(told(s.B) || told(s.C), false, 'neither is told');
  assert.equal(PURSE - goldOf(s.B), paid[0], 'B paid'); assert.equal(PURSE - goldOf(s.C), paid[1], 'C paid');
  for (const p of s.ps) assert.equal(have(shelfOf(p), 'Katana'), 0, `${p.id}'s list shows the Katana no more`);
});

test('T-S7c F-1 AC-S7: B\'s purchase reaches the seat before C\'s shut-window take of the same Katana - C is refused, lifted, told, and given no credit; B keeps what it paid for', () => {
  const s = stocked(3, { open: [1] });
  const win = openCounter(s.B);
  const wc = shut(s.C);
  wc.takeNamed('Katana');   // C's row is stale by the time its close is said
  fund(s.B);
  stage(s.B, win, 'Katana');
  buy(s.B, win);   // the counter stays open after the deal, as a buyer's does: the sale is said at its door, not at the window's close
  frame(s.B); s.net.flush();   // the sale reaches the seat first
  wc.close(); frame(s.C); s.net.flush();
  closeCounter(s.B, win); frame(s.B); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.B, 'Katana'), 1, 'B keeps what it paid for');
  assert.equal(packHas(s.C, 'Katana'), 0, `F-1/AC-S7: C holds a second, free Katana (${whereIs(s, 'Katana')}) - its take of a piece B had already bought was never judged against the sale`);
  assert.ok(told(s.C), `C is told - it heard ${JSON.stringify(s.C.said)}`);
  assert.equal(tally(s.C), 0, `F-1/AC-S7: C's guild tally is ${tally(s.C)} - no credit for a take the seat refused`);
  assert.equal(told(s.B), false, 'B is told nothing');
});

test('T-S7d F-1 AC-S7: an honest Longsword sold at the merchant\'s Sell lands on shelf 0 for everyone, once, as the room\'s - D\'s stale close does not erase it, and C buys it back; a stolen War Axe sold reaches no shelf (landSold)', () => {
  const smith = { buildingType: BUILDING_TYPES.WeaponSmith };
  const s = stocked(4, { each: [{ building: { ...SHOP, ...smith } }, { building: { ...SHOP_OPEN, ...smith } }, { building: { ...SHOP_OPEN, ...smith } }, { building: { ...SHOP, ...smith } }] });
  const wd = shut(s.D);   // D's window opened before the sale
  s.B.entity.items.push(mk('Longsword'), { ...mk('War Axe'), stolen: true });
  const win = openSell(s.B);
  assert.ok(win, 'B\'s Sell screen opens (the merchant\'s popup)');
  stageLocal(s.B, win, 'Longsword'); stageLocal(s.B, win, 'War Axe');
  const earned = goldOf(s.B);
  buy(s.B, win);
  assert.ok(goldOf(s.B) > earned, 'the deal was struck (guard)');
  closeCounter(s.B, win);
  frame(s.B); s.net.flush();
  wd.close(); frame(s.D); s.net.flush();   // D's untouched close, stale: it never saw the Longsword
  quiesce(s);
  for (const p of s.ps) assert.equal(have(shelfOf(p), 'Longsword'), 1, `F-1/AC-S7: ${p.id}'s list shows ${have(shelfOf(p), 'Longsword')} Longswords, not the one B sold (${JSON.stringify(lists(s))}) - D's stale close erased the sale`);
  for (const p of s.ps) assert.equal(have(shelfOf(p), 'War Axe'), 0, `${p.id}'s list shows no stolen War Axe (landSold: a stolen piece sold goes nowhere) (guard)`);
  assert.equal(copies(s, 'Longsword') + copies(s, 'War Axe'), 0, 'B holds neither');
  const wc = openCounter(s.C);
  fund(s.C);
  stage(s.C, wc, 'Longsword');
  buy(s.C, wc);
  closeCounter(s.C, wc); frame(s.C); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.C, 'Longsword'), 1, 'C buys the Longsword back');
  assert.equal(markedIn(s.C, 'Longsword'), 0, 'unmarked');
  for (const p of s.ps) assert.equal(have(shelfOf(p), 'Longsword'), 0, `${p.id}'s list shows the Longsword no more`);
});

test('T-S7e F-1 AC-S7 (D4, guard): B stages the Katana and walks out with the counter open (the leave, then the window\'s dispose) - nothing is claimed, B pays nothing and holds nothing, and the Katana is still the room\'s for everyone', () => {
  const s = stocked(3, { open: [1] });
  const win = openCounter(s.B);
  fund(s.B);
  stage(s.B, win, 'Katana');
  assert.equal(win.basket.length, 1, 'the Katana is staged in the basket (guard)');
  elapse(s, 2000);   // frames run with the basket staged: staging is no move of the room's
  s.B.as(() => s.B.h.leave()); s.B.here = false;   // the building's leave does not settle a trade window
  s.B.as(() => win.dispose());   // and the window's own teardown puts the basket back on the shelf
  s.net.flush(); quiesce(s);
  assert.equal(packHas(s.B, 'Katana'), 0, 'B holds nothing');
  assert.equal(goldOf(s.B), PURSE, 'and paid nothing');
  assert.equal(s.net.words(s.B, KEY).filter((r) => r.q || r.a).length, 0, 'F-1/AC-S7 (D4): B claimed or put nothing - a buyer walking out with goods staged would otherwise claim them as sold without paying');
  for (const p of [s.A, s.C]) assert.equal(have(shelfOf(p), 'Katana'), 1, `F-1/AC-S7 (D4): ${p.id}'s list still shows the Katana - it left the room for nobody`);
});

const BAG = () => mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE }));
const bagsIn = (list) => (list ?? []).filter(isBagItem).reduce((n, it) => n + (it.stackCount ?? 1), 0);
test('T-S7f F-1 AC-S7 (guard): ENDLESS-STOCK - a Materials Bag bought is back on the shelf for everyone, one bag, and B holds the one it bought', () => {
  globalThis.location = { search: '?online' };   // a shelf sells out of nothing online alone (restockEndless)
  const s = stocked(3, { open: [1], roll: () => [mk('Dagger'), BAG()] });
  assert.equal(bagsIn(shelfOf(s.C)), 1, 'the shelf stocks one bag (guard)');
  const win = openCounter(s.B);
  fund(s.B);
  stage(s.B, win, 'Materials Bag');
  buy(s.B, win);
  closeCounter(s.B, win);
  frame(s.B); s.net.flush(); quiesce(s);
  assert.equal(bagsIn(s.B.entity.items), 1, 'B holds the bag it bought');
  for (const p of s.ps) assert.equal(bagsIn(shelfOf(p)), 1, `F-1/AC-S7 (ENDLESS-STOCK): ${p.id}'s list shows ${bagsIn(shelfOf(p))} bags - a bag bought is back on the shelf for everyone, one bag (${JSON.stringify(lists(s))})`);
});

test('T-S7f2 F-1 AC-S7 (D3): a REFUSED restock put gives the buyer nothing - A buys the Materials Bag off a first-stock that lost the tie-break: it pays, holds the one bag, and the copy the restock laid on a mint that is gone is dropped, never given home', () => {
  globalThis.location = { search: '?online' };
  const loseRoll = () => [mk('Katana'), BAG()], winRoll = () => [mk('Mace'), mk('Staff')];
  const s = shop(3, { open: [0], each: [{ shelfRoll: loseRoll }, { shelfRoll: winRoll }] });
  const wb = shut(s.B);   // B first-stocks first by the shared clock: its mint is the room's
  clock.t += 5;
  const win = openCounter(s.A);   // A first-stocks five milliseconds later, on a roll that stocks a bag: the later mint
  assert.ok(win, 'A\'s counter opens on its own roll');
  fund(s.A);
  s.net.flush();   // the births cross; A's counter stands on its own roll
  stage(s.A, win, 'Materials Bag');
  buy(s.A, win);
  closeCounter(s.A, win);
  wb.close(); frame(s.A); frame(s.B); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.deepEqual(names(shelfOf(p)), ['Mace', 'Staff'], `F-1/AC-S7 (R-3): ${p.id} ends on ${JSON.stringify(names(shelfOf(p)))}, not the earlier mint's roll - A's counter close republished its whole list (${JSON.stringify(lists(s))})`);
  assert.equal(bagsIn(s.A.entity.items), 1, `F-1/AC-S7 (D3): A holds ${bagsIn(s.A.entity.items)} bags - the restock laid a copy on a mint that is gone, and a refused put of a sale is dropped, never given to the buyer who paid for the one`);
  assert.equal(told(s.A), false, `A is told nothing of its lost sale (the buyer keeps what it paid for, quietly) - it heard ${JSON.stringify(s.A.said)}`);
});

test('T-S7f3 F-1 AC-S7 (D3): the same, for a buyer who is NOT the seat and whose put is on the wire when the earlier mint reaches it - B pays for the bag, holds the one, and the copy its restock put is dropped when the put is refused, never given home', () => {
  globalThis.location = { search: '?online' };
  const winRoll = () => [mk('Mace'), mk('Staff')], loseRoll = () => [mk('Katana'), BAG()];
  const s = shop(3, { open: [1], each: [{ shelfRoll: winRoll }, { shelfRoll: loseRoll }] });
  const wa = shut(s.A);   // A (the seat) first-stocks first
  hold(s, s.A, s.B);      // B hears nothing of it
  clock.t += 5;
  const win = openCounter(s.B);   // B first-stocks five milliseconds later, on a roll that stocks a bag - the later mint
  fund(s.B);
  stage(s.B, win, 'Materials Bag');
  buy(s.B, win);
  wa.close(); frame(s.A); s.net.flush();   // the earlier mint is said to everyone but B
  closeCounter(s.B, win);
  frame(s.B); s.net.flush();   // B's sale and its restock put are said on its own mint, its close the last word
  release(s, s.A, s.B); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.deepEqual(names(shelfOf(p)), ['Mace', 'Staff'], `F-1/AC-S7 (R-3): ${p.id} ends on ${JSON.stringify(names(shelfOf(p)))}, not the earlier mint's roll (${JSON.stringify(lists(s))})`);
  assert.equal(bagsIn(s.B.entity.items), 1, `F-1/AC-S7 (D3): B holds ${bagsIn(s.B.entity.items)} bags - its restock put was refused and a sold piece's put goes nowhere, never home to the buyer who paid for the one`);
  assert.equal(told(s.B), false, `B is told nothing of its lost sale - it heard ${JSON.stringify(s.B.said)}`);
});

test('T-S7f4 F-1 AC-S7 (D3): the seat REFUSES the restock put by its verdict (the shelf\'s stored pieces are at their cap) - B pays for the bag and holds the one; the copy its restock put is dropped when the refusal comes, never given home', () => {
  globalThis.location = { search: '?online' };
  const s = stocked(3, { open: [1], roll: () => [mk('Dagger'), BAG()] });
  const stash = lightPieces(LOOT_LIST_MAX);
  s.C.entity.items.push(...stash);
  const wc = shut(s.C);
  for (const it of stash) wc.put(it);   // C stashes LOOT_LIST_MAX pieces: the room stores no more
  wc.close(); frame(s.C); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.equal(shelfOf(p).length, 2 + LOOT_LIST_MAX, `F-1/AC-S7 (D3): ${p.id}'s list shows ${shelfOf(p).length} pieces, not the base and the ${LOOT_LIST_MAX} C stashed - the room carries a stash beside the stock`);
  const win = openCounter(s.B);
  fund(s.B);
  stage(s.B, win, 'Materials Bag');
  buy(s.B, win);
  closeCounter(s.B, win);
  frame(s.B); s.net.flush(); quiesce(s);
  assert.equal(bagsIn(s.B.entity.items), 1, `F-1/AC-S7 (D3): B holds ${bagsIn(s.B.entity.items)} bags - the seat refused the restock put (the stored list is full) and a sold piece's put goes nowhere, never home to the buyer who paid for the one`);
  assert.equal(told(s.B), false, 'and B is told nothing');
  for (const p of s.ps) assert.equal(bagsIn(shelfOf(p)), 0, `${p.id}'s list shows no bag: the bought one is gone and the restock was refused (${JSON.stringify(names(shelfOf(p)).slice(0, 2))}...)`);
});

test('T-S7d2 F-1 AC-S7 (D3): a piece sold at the merchant\'s Sell on a first-stock that LOST the tie-break is the merchant\'s - A is paid and holds no Longsword; the sold piece goes nowhere, never home to the seller', () => {
  const smith = { buildingType: BUILDING_TYPES.WeaponSmith };
  const s = shop(3, { each: [{ building: { ...SHOP_OPEN, ...smith }, shelfRoll: () => [mk('Katana'), mk('Staff')] }, { building: { ...SHOP, ...smith }, shelfRoll: () => [mk('Mace'), mk('Flail')] }, { building: { ...SHOP, ...smith } }] });
  const wb = shut(s.B);   // B first-stocks first by the shared clock: its mint is the room's
  clock.t += 5;
  s.A.entity.items.push(mk('Longsword'));
  const win = openSell(s.A);   // A first-stocks five milliseconds later (the Sell screen stocks the building's first shelf as the press does): the later mint
  assert.ok(win, 'A\'s Sell screen opens on its own roll');
  s.net.flush();   // the births cross
  stageLocal(s.A, win, 'Longsword');
  const gold0 = goldOf(s.A);
  buy(s.A, win);
  assert.ok(goldOf(s.A) > gold0, 'A was paid (guard)');
  closeCounter(s.A, win); wb.close();
  frame(s.A); frame(s.B); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.A, 'Longsword'), 0, `F-1/AC-S7 (D3): A sold the Longsword and holds ${packHas(s.A, 'Longsword')} - a sold piece whose put is refused (the mint it was laid on is gone) is the merchant's, never given home: the seller would have the gold AND the piece`);
  for (const p of s.ps) assert.deepEqual(names(shelfOf(p)), ['Mace', 'Flail'], `F-1/AC-S7 (D3, R-3): ${p.id} ends on ${JSON.stringify(names(shelfOf(p)))}, not the earlier mint's roll (${JSON.stringify(lists(s))}) - the seller's Sell screen close republished its whole list`);
});

test('T-S7g F-1 AC-S7 (D4, guard): staging is never a claim - B stages and unstages the Katana, and splits and returns four of ten arrows, with no purchase; no claim or put is ever said for the shelf, and every list is as it was', () => {
  const arrows = () => mk('Arrow', 'Weapons', { stackCount: 10 });
  const s = stocked(3, { open: [1], roll: () => [mk('Katana'), arrows()] });
  const win = openCounter(s.B);
  stage(s.B, win, 'Katana'); frame(s.B); s.net.flush();
  stageLocal(s.B, win, 'Katana'); frame(s.B); s.net.flush();   // a click on the basket row takes it back off
  stage(s.B, win, 'Arrow', 4); elapse(s, 1000);
  assert.equal(win.basket[0]?.stackCount, 4, 'four of the ten are staged (guard)');
  s.B.as(() => win._clear()); elapse(s, 1000);   // Clear: the basket goes back, the arrows rejoin their stack
  closeCounter(s.B, win); frame(s.B); s.net.flush(); quiesce(s);
  assert.equal(s.net.words(s.B, KEY).filter((r) => r.q || r.a).length, 0, `F-1/AC-S7 (D4): B said a claim or a put for staging alone (${JSON.stringify(s.net.words(s.B, KEY).filter((r) => r.q || r.a).map((r) => Object.keys(r).filter((k) => !k.startsWith('__'))))}) - the counter is never read frame by frame`);
  for (const p of s.ps) {
    assert.deepEqual(names(shelfOf(p)).sort(), ['Arrow', 'Katana'], `${p.id}'s list is as it was (${JSON.stringify(lists(s))})`);
    assert.equal(have(shelfOf(p), 'Arrow'), 10, `${p.id} lists the ten arrows`);
  }
  assert.equal(s.B.entity.items.length, 0, 'B holds nothing');
});

// ═══ AC-S8 - MIXED BUILDS ═══════════════════════════════════════════════════════════════════════════════════════════════════
test('T-S8a F-1 AC-S8: a NEW shelf word carries d and no r - the older build marks the shelf unreadable and lands no list over its own', () => {
  const s = shop(2);
  const O = older(s.net, 'oooo-0009', { key: KEY, list: [mk('Flail')] });
  const wa = shut(s.A); wa.close(); frame(s.A); s.net.flush();
  const words = s.net.words(s.A, KEY);
  assert.ok(words.length > 0, 'A said its stock (guard)');
  for (const w of words) assert.equal(w.r, undefined, `F-1/AC-S8: A's shelf word still carries \`r\`, the shelf's WHOLE list (${JSON.stringify(Object.keys(w))}) - an older build lands it over its own list; a new word carries the day \`d\` and no \`r\``);
  assert.ok(O.bag.unreadable.has(KEY), 'F-1/AC-S8: the older build marks the shelf unreadable (M2)');
  assert.deepEqual(names(O.items()), ['Flail'], 'and lands nothing over its own list');
});

test('T-S8b F-1 AC-S8: the older build\'s whole list with no state to meet is the shelf\'s BIRTH - B and C, both new, take the one Katana of it: ONE copy', () => {
  const s = shop(3);
  const O = older(s.net, 'oooo-0009', { key: KEY, list: STOCK() });
  O.say(); s.net.flush();
  for (const p of s.ps.filter((x) => x.kind === 'client')) assert.deepEqual(names(shelfOf(p)), names(STOCK()), `${p.id} lands the older build's list as the shelf's (guard)`);
  const wb = shut(s.B), wc = shut(s.C);
  wb.takeNamed('Katana'); wc.takeNamed('Katana'); wb.close(); wc.close();
  frame(s.B); frame(s.C); s.net.flush(); quiesce(s);
  assert.equal(copies(s, 'Katana'), 1, `F-1/AC-S8: B and C took the same Katana off the older build's list in one breath and hold ${copies(s, 'Katana')} copies (${whereIs(s, 'Katana')}) - the older list was landed, not born: nothing judges a take of it`);
  assert.ok(told(s.C), 'and the loser is told');
});

test('T-S8c F-1 AC-S8: the older build\'s untouched SECOND word changes nothing - the Mace B stole stays gone for everyone', () => {
  const s = shop(3);
  const O = older(s.net, 'oooo-0009', { key: KEY, list: STOCK() });
  O.say(); s.net.flush();
  O.open();   // the older build opens the shelf: under its window no word lands on its list
  steals(s, s.B, 'Mace'); quiesce(s);
  for (const p of s.ps.filter((x) => x.kind === 'client')) assert.deepEqual(names(shelfOf(p)), ['Dagger', 'Katana', 'Staff'], `${p.id} holds the list less the Mace B stole (guard) - ${JSON.stringify(lists(s))}`);
  O.close(); O.say(); s.net.flush(); quiesce(s);   // its window stood open since before B's take: its close says the same list again, untouched
  for (const p of s.ps.filter((x) => x.kind === 'client')) assert.deepEqual(names(shelfOf(p)), ['Dagger', 'Katana', 'Staff'], `F-1/AC-S8: ${p.id}'s list is ${JSON.stringify(names(shelfOf(p)))} after the older build's untouched second word - the Mace B stole (${whereIs(s, 'Mace')}) came back: its whole list landed over the room's`);
  assert.equal(packHas(s.B, 'Mace'), 1, 'and B holds it once');
});

test('T-S8d F-1 AC-S8: the older build\'s word with the Staff GONE is a claim the seat judges first - B, stealing the Staff off a stale row after, is refused and told', () => {
  const s = shop(3);
  const O = older(s.net, 'oooo-0009', { key: KEY, list: STOCK() });
  O.say(); s.net.flush();
  const wb = shut(s.B);   // B's row is stale from here
  O.take('Staff'); O.say(); s.net.flush();
  for (const p of [s.A, s.C]) assert.deepEqual(names(shelfOf(p)), ['Dagger', 'Mace', 'Katana'], `${p.id} drops the Staff the older build took (guard) - ${JSON.stringify(lists(s))}`);
  wb.takeNamed('Staff'); wb.close(); frame(s.B); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.B, 'Staff'), 0, `F-1/AC-S8: B took the Staff off its open window AFTER the older build's word took it - B holds it (${whereIs(s, 'Staff')}): the older build's take was never judged, so the piece is in both hands`);
  assert.ok(told(s.B), `B is told - it heard ${JSON.stringify(s.B.said)}`);
  for (const p of s.ps.filter((x) => x.kind === 'client')) assert.equal(have(shelfOf(p), 'Staff'), 0, `${p.id}'s list shows the Staff no more`);
});

// ═══ AC-S9 - THE BACK-AND-FORTH SCENARIO ON A SHELF (PLAN SECTION 0) ═════════════════════════════════════════════════════════════
const SLOW_MS = 3500;
/** Three pieces the REAL stockShopShelf rolled (a weaponsmith's, on a fixed seed): distinct, each its own row. */
const REAL3 = () => {
  const rolled = stockShopShelf({ buildingType: BUILDING_TYPES.WeaponSmith, quality: 10 }, { name: 'x', level: 5, stats: { luck: 50 } }, { shelfIndex: 0, rolls: lcg(5) });
  const three = rolled.filter((it, i) => (it.stackCount ?? 1) === 1 && rolled.findIndex((o) => o.name === it.name) === i).slice(0, 3);
  assert.equal(three.length, 3, 'the real stocker rolled three distinct single pieces');
  return three;
};
for (const slow of [false, true]) {
  for (const order of ['late', 'mid']) {
    test(`T-S9 F-1 AC-S9 (PLAN section 0 on a shut shelf) [${slow ? `B's and C's inbound links held ${SLOW_MS / 1000} s` : 'their inbound links held for the moves alone'}, ${order === 'late' ? 'A takes before the tries' : 'the tries before A takes'}]: of three pieces the real stockShopShelf rolled, B takes one (window), C a second (window), A (the seat) the third (own window); then B tries C's and C tries B's off stale rows - each is refused and told; after every step every player's list shows exactly what is left; at the end each piece is in exactly one pack, marked, no list shows any, and each thief's guild tally is 1`, () => {
      const s = stocked(3, { roll: REAL3 });
      const [A, B, C] = [s.A, s.B, s.C];
      const [p1, p2, p3] = s.stock;
      const views = (what, want) => {
        for (const p of [A, B, C]) assert.deepEqual([...names(shelfOf(p))].sort(), [...want[p.id]].sort(), `F-1/AC-S9 ${what}: ${p.id}'s list holds ${JSON.stringify(names(shelfOf(p)))}, not what is left for it ${JSON.stringify(want[p.id])}`);
      };
      const all = (...ps) => ({ [A.id]: ps, [B.id]: ps, [C.id]: ps });
      views('before any move', all(p1, p2, p3));
      const inbound = [[A, B], [C, B], [A, C], [B, C]];
      for (const [f, t] of inbound) hold(s, f, t);
      const t0 = clock.t;
      const take = (p, name, what) => { const w = shut(p); assert.ok(w.list().some((it) => it.name === name), `${what}: ${p.id}'s window lists ${name} (${JSON.stringify(names(w.list()))})`); w.takeNamed(name); w.close(); frame(p); s.net.flush(); };
      take(B, p1, 'step 1');
      views('step 1 (B took the first)', { [A.id]: [p2, p3], [B.id]: [p2, p3], [C.id]: [p1, p2, p3] });
      take(C, p2, 'step 2');
      views('step 2 (C took the second)', { [A.id]: [p3], [B.id]: [p2, p3], [C.id]: [p1, p3] });
      const tries = (aLeft) => {
        take(B, p2, 'B tries C\'s piece');   // B's list, stale, still shows it: the seat granted it to C a moment ago
        views('B tried the second', { [A.id]: aLeft, [B.id]: [p3], [C.id]: [p1, p3] });
        take(C, p1, 'C tries B\'s piece');
        views('C tried the first', { [A.id]: aLeft, [B.id]: [p3], [C.id]: [p3] });
      };
      const settle = (what, want) => {
        if (slow) {
          elapse(s, SLOW_MS - (clock.t - t0));   // the links stay held: nothing is heard, the clock passes
          assert.equal(packHas(B, p1), 0, `${what}: B's piece waits on the held link`);
          assert.equal(told(B), false, `${what}: and B has not been told of its refused try`);
        }
        for (const [f, t] of inbound) release(s, f, t);
        s.net.flush(); quiesce(s);
        views(what, want);
      };
      const takeLast = (what) => { take(A, p3, what); };
      if (order === 'late') {
        takeLast('step 3');
        views('step 3 (A took the third)', { [A.id]: [], [B.id]: [p2, p3], [C.id]: [p1, p3] });
        tries([]);
        settle('the links whole again', all());
      } else {
        tries([p3]);
        settle('the links whole again, the third left', all(p3));
        takeLast('step 3 (after the tries)');
        quiesce(s);
        views('step 3 (A took the third)', all());
      }
      // the end: every piece in exactly one pack, marked stolen; no list shows any; each thief's tally is 1; the refused were told
      for (const [piece, who] of [[p1, B], [p2, C], [p3, A]]) {
        for (const p of [A, B, C]) assert.equal(packHas(p, piece), p === who ? 1 : 0, `F-1/AC-S9: ${p.id} holds ${packHas(p, piece)} of "${piece}" - it is ${who.id}'s alone`);
        assert.equal(markedIn(who, piece), 1, `${who.id}'s ${piece} is marked stolen`);
      }
      for (const p of [A, B, C]) assert.equal(tally(p), 1, `F-1/AC-S9: ${p.id}'s Thieves Guild tally is ${tally(p)}, not 1 (the refused tries earn none)`);
      assert.equal(told(A), false, 'A was not told'); assert.ok(told(B) && told(C), 'B and C were told "Someone took that first."');
      assert.equal(B.said.filter((l) => l === ROOM_TAKEN_TEXT).length, 1, 'B was told once'); assert.equal(C.said.filter((l) => l === ROOM_TAKEN_TEXT).length, 1, 'C was told once');
    });
  }
}

// ═══ AC-S10 - R-3 AND C1 ON A SHELF ═══════════════════════════════════════════════════════════════════════════════════════════
test('T-S10a F-1 AC-S10 (R-3): A and B first-stock the shelf in one breath on their own dice (B\'s machine ten minutes slow) - B\'s mint is earlier by the SHARED clock and every client ends with B\'s roll; A\'s take from its own roll is refused, lifted back out and told', () => {
  const rollA = () => [mk('Dagger'), mk('Mace')], rollB = () => [mk('Katana'), mk('Staff')];
  const s = shop(3, { each: [{ shelfRoll: rollA }, { shelfRoll: rollB, skew: -600_000 }] });
  const wb = shut(s.B);
  clock.t += 5;   // A opens five milliseconds later by the shared clock, minutes LATER than B's own clock reads
  const wa = shut(s.A);
  s.net.flush();   // the births cross; each window still stands on its own roll
  wa.takeNamed('Dagger');   // A takes a piece of its OWN roll
  wa.close(); wb.close();
  frame(s.A); frame(s.B); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.deepEqual(names(shelfOf(p)), ['Katana', 'Staff'], `F-1/AC-S10: ${p.id} ends on ${JSON.stringify(names(shelfOf(p)))}, not the earlier mint's roll (B's) - the last close wins and the closes crossed (${JSON.stringify(lists(s))})`);
  assert.equal(packHas(s.A, 'Dagger'), 0, `F-1/AC-S10: A holds the Dagger it took from its own roll (${whereIs(s, 'Dagger')}) - a roll that never was the room's`);
  assert.ok(told(s.A), `and A is told - it heard ${JSON.stringify(s.A.said)}`);
});

test('T-S10b F-1 AC-S10 (C1, guard): nothing is composed under the stealing window or the counter - their rows are the same pieces in the same order while the room moves under them', () => {
  const s = stocked(3, { open: [2] });
  const wb = shut(s.B);
  const win = openCounter(s.C);
  const rowsB = [...wb.list()], rowsC = [...win.remoteList()];
  steals(s, s.A, 'Dagger'); steals(s, s.A, 'Mace');
  elapse(s, 10_000);
  assert.ok(wb.list().length === rowsB.length && wb.list().every((it, i) => it === rowsB[i]), 'B\'s window rows are the same pieces in the same order (C1)');
  assert.ok(win.remoteList().length === rowsC.length && win.remoteList().every((it, i) => it === rowsC[i]), 'and so are the counter\'s (C1)');
  assert.equal(packHas(s.A, 'Dagger') + packHas(s.A, 'Mace'), 2, 'A took both (the room moved under them)');
  wb.close(); closeCounter(s.C, win);
});

test('T-S12 F-1 AC-S11 (D2): a restock is a new day\'s birth - the day turns and A\'s press stocks the shelf anew: every client lists the new day\'s stock at once, and a claim B had in flight on yesterday\'s mint is let go - it never hides a place of the new day\'s stock', () => {
  const s = stocked(3);
  hold(s, s.B, s.A);   // B\'s word never reaches the seat: its claim stays in flight on yesterday\'s mint
  steals(s, s.B, 'Katana');
  assert.equal(have(shelfOf(s.B), 'Katana'), 0, 'B\'s claim hides the Katana in its own view (guard)');
  for (const p of s.ps) p.dayShift = 1;   // the day turns for the whole building
  const wa = shut(s.A);
  wa.close(); frame(s.A); s.net.flush();   // A\'s press restocked: the new day\'s stock is the room\'s
  for (const p of s.ps) assert.deepEqual(names(shelfOf(p)), names(STOCK()), `F-1/AC-S11 (D2): ${p.id} lists ${JSON.stringify(names(shelfOf(p)))} after the day turned, not the new day's stock (a claim of yesterday's mint hides a place of today's)`);
  for (const p of s.ps) assert.equal(p.ctx.shelves[0].stockedDate, TODAY + 1, `${p.id}'s shelf is dated the new day`);
  release(s, s.B, s.A); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.deepEqual(names(shelfOf(p)), names(STOCK()), `F-1/AC-S11 (D2): ${p.id} lists ${JSON.stringify(names(shelfOf(p)))} once everything is heard, not the new day's stock - a word of yesterday's mint, heard late, replaced today's list (the last writer wins)`);
});

// ═══ AC-S11 - THE PROTECTIONS ═════════════════════════════════════════════════════════════════════════════════════════════════
const RARE_KEY = '7a7a7a7a7a7a7a7a';
const rareOf = () => ({ ...applyRarity(createWeapon(113, 1, seeded(7)), 'rare', seeded(11)), uid: RARE_KEY });
const keyed = (list) => (list ?? []).filter((it) => ledgerKeyOf(it) === RARE_KEY).length;
const LETTER = { name: 'Letter of Credit', templateIndex: 275, group: 'MiscItems', stackCount: 1, value: 5000 };
const BOUND = { ...mk('Ruby', 'Gems'), bound: true };
/** The new-shape birth word of a shelf (DESIGN 4.2/5): the room word plus `b`, the carried base, and `d`, the day. */
const birthWord = (base, { g = TODAY, lv = 1, n = 1, tm = wallNow(), d = g, extra = {} } = {}) => ({ k: KEY, g, lv, n, tm, h: baseSignature(base), b: clone(base), s: [], si: [], d, ...extra });
const actOf = (word) => ({ k: ROOM, l: [word] });

test('T-S11a F-1 AC-S11 (AUTO-HOLD, guard): a piece the reader STOWED (setStowedKeys) is not offered on a shelf - its composed list and window hide it while everyone else\'s list has it', () => {
  const s = shop(3, { roll: () => [rareOf(), mk('Dagger')] });
  s.B.stowed = [RARE_KEY];   // B put that very piece in a ship's hold: a second would be a copy
  const wa = shut(s.A); wa.close(); frame(s.A); s.net.flush();
  assert.equal(keyed(shelfOf(s.A)), 1, 'A\'s list has the rare piece'); assert.equal(keyed(shelfOf(s.C)), 1, 'and so has C\'s');
  assert.equal(keyed(shelfOf(s.B)), 0, 'F-1/AC-S11 (AUTO-HOLD): B\'s list does not offer the piece it stowed');
  const wb = shut(s.B);
  assert.equal(keyed(wb.list()), 0, 'and neither does its window');
  assert.deepEqual(names(wb.list()), ['Dagger'], 'it lists the rest');
});

test('T-S11b F-1 AC-S11 (STOLEN-GOODS, guard): a Katana won off the shut shelf and sold at the counter reaches no shelf, and the court\'s confiscateStolen takes a stolen piece won at the counter', () => {
  const smith = { buildingType: BUILDING_TYPES.WeaponSmith };
  const s = stocked(3, { each: [{ building: { ...SHOP, ...smith } }, { building: { ...SHOP, ...smith } }, { building: { ...SHOP_OPEN, ...smith } }] });
  steals(s, s.B, 'Katana'); quiesce(s);
  assert.equal(markedIn(s.B, 'Katana'), 1, 'B won the Katana, marked (guard)');
  s.B.state.interiorBuilding.insideOpenShop = true;   // the shop opens: B walks to the merchant\'s Sell screen
  const win = openSell(s.B);
  stageLocal(s.B, win, 'Katana');
  const gold0 = goldOf(s.B);
  buy(s.B, win);
  assert.ok(goldOf(s.B) > gold0, 'the merchant paid for it (guard)');
  closeCounter(s.B, win); frame(s.B); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.equal(have(shelfOf(p), 'Katana'), 0, `${p.id}'s list shows the stolen Katana B sold (landSold: a merchant buys a stolen piece only to be rid of it)`);
  assert.equal(packHas(s.B, 'Katana'), 0, 'and B holds none');
  const wc = openCounter(s.C);
  stage(s.C, wc, 'Dagger'); steal(s.C, wc); frame(s.C); s.net.flush(); quiesce(s);
  assert.equal(markedIn(s.C, 'Dagger'), 1, 'C Stole the Dagger at the counter, marked (guard)');
  const taken = s.C.as(() => confiscateStolen(s.C.entity));
  assert.deepEqual(taken.map((it) => it.name), ['Dagger'], 'the court takes the stolen piece won at the counter');
  assert.equal(packHas(s.C, 'Dagger'), 0, 'and C holds none');
});

test('T-S11c F-1 AC-S11 (offline, guard): with no peer id the shelf\'s stock is written as it always was, a take is the player\'s own at once, nothing is claimed, and the guild tally is paid at the close', () => {
  const s = shop(1, { each: [{ offline: true }] });
  const w = windowOf(s.A);
  assert.ok(openShelfOf(s.A, w), 'the press opens the stealing window');
  assert.deepEqual(names(shelfOf(s.A)), names(STOCK()), 'the stock is written to the shelf as it always was');
  assert.equal(s.A.ctx.shelves[0].stockedDate, TODAY, 'dated today');
  w.takeNamed('Katana');
  assert.equal(packHas(s.A, 'Katana'), 1, 'the take is the player\'s own at once');
  w.close();
  assert.equal(tally(s.A), 1, 'and the guild tally is paid at the close');
  frame(s.A); s.net.flush(); elapse(s, 5000);
  assert.equal(s.net.log.length, 0, 'nothing was said to a room');
  assert.equal(packHas(s.A, 'Katana'), 1, 'still held');
  assert.equal(have(shelfOf(s.A), 'Katana'), 0, 'and off the shelf');
});

test('T-S11d F-1 AC-S11 (M2, D8): a shelf the room spoke of in words naming a newer game\'s piece is not opened - the press says LOOT_NEWER_TEXT and no window mounts; and a hostile birth naming a bound piece or a letter lands the rest without it', () => {
  const unknown = [65535, 60000, 59999].find((i) => !templateByIndex(i));
  const future = { name: 'Future Blade', templateIndex: unknown, group: 'Weapons', stackCount: 1 };
  const s = shop(2);
  s.net.say('newer-0099', actOf(birthWord([mk('Katana'), future])));
  s.net.flush();
  const wb = windowOf(s.B);
  const opened = openShelfOf(s.B, wb);
  assert.ok(s.B.said.includes(LOOT_NEWER_TEXT), `F-1/AC-S11 (M2): B's press says LOOT_NEWER_TEXT - it said ${JSON.stringify(s.B.said)}`);
  assert.equal(opened, null, `F-1/AC-S11 (D8): the press mounted ${wb.opened} window(s) over this client's own roll - a shelf the room spoke of in words this build cannot read is never opened`);
  assert.equal(s.net.words(s.B, KEY).length, 0, 'B claims and closes over nothing');
  const t = shop(2);
  // a hostile peer's birth: the base it carries names a letter and a bound piece, its signature is the clean rest's (what the reader lands)
  t.net.say('hostile-0099', actOf({ ...birthWord([mk('Dagger'), mk('Mace')]), b: clone([mk('Dagger'), LETTER, BOUND, mk('Mace')]) }));
  t.net.flush();
  for (const p of t.ps) assert.deepEqual(names(shelfOf(p)), ['Dagger', 'Mace'], `F-1/AC-S11 (SS3/HACKED-GOLD): a hostile birth naming a letter and a bound piece lands the rest on ${p.id} - its shelf is ${JSON.stringify(shelfOf(p))}`);
});

test('T-S11e F-1 AC-S11 (the wire): the largest stock stockShopShelf rolls (every shop type, quality 20, shelfIndex 0) mints a birth word and a full state word that fit actFrameFits', () => {
  const ent = { name: 'x', level: 5, stats: { luck: 50 } };
  const seen = [];
  for (const type of Object.values(BUILDING_TYPES).filter((t) => isShop(t))) {
    let big = [];
    for (let seed = 1; seed <= 30; seed++) {
      const l = stockShopShelf({ buildingType: type, quality: 20 }, ent, { shelfIndex: 0, rolls: lcg(seed) });
      if (JSON.stringify(l).length > JSON.stringify(big).length) big = l;
    }
    const s = shop(1, { roll: () => big, each: [{ building: { ...SHOP, buildingType: type, quality: 20 } }] });
    const w = windowOf(s.A);
    assert.ok(openShelfOf(s.A, w), `the stealing window opens on type ${type}`);
    w.close(); frame(s.A); s.net.flush();
    const birth = s.net.words(s.A, KEY).find((r) => Array.isArray(r.b));
    assert.ok(birth, `F-1/AC-S11 (wire): A said no birth word (a record with the carried base \`b\`) for its ${big.length}-piece stock on shop type ${type} - ${JSON.stringify(s.net.words(s.A, KEY).map((r) => Object.keys(r).filter((k) => !k.startsWith('__'))))}`);
    assert.equal(birth.b.length, big.length, 'the base carries the whole stock');
    assert.ok(actFrameFits(actOf(birth)), `the birth word for ${big.length} pieces of shop type ${type} fits an act frame`);
    const memory = s.A.as(() => s.A.h.members.placeSharedWorld());
    const rec = memory?.world?.loot?.find((r) => r.k === KEY);
    assert.ok(rec && Array.isArray(rec.b), `the room's memory carries the shelf's state with its base (${JSON.stringify(rec && Object.keys(rec))})`);
    assert.ok(actFrameFits(actOf(rec)), `the full state word for shop type ${type} fits an act frame`);
    seen.push([type, big.length]);
  }
  assert.ok(seen.length >= 8, `every shop type was measured (${JSON.stringify(seen)})`);
});

test('T-S11f F-1 AC-S11 (HOME1, guard): a word about shelf:0 in a home lands on nobody, and a home\'s bag holds no room', () => {
  const home = { own: false, owner: 'aaaa' };
  const s = building(2, { each: [{ shelves: 1, home: { ...home, own: true }, building: SHOP }, { shelves: 1, home, building: SHOP }] });
  s.net.say('cccc-0003', actOf(birthWord([mk('Katana')])));
  s.net.say('cccc-0003', actOf({ k: KEY, r: [mk('Mace')], d: TODAY }));
  s.net.flush();
  for (const p of s.ps) {
    assert.equal(shelfOf(p), null, `${p.id}'s shelf took no word (HOME1)`);
    assert.ok(!p.h.bag().room, `${p.id}'s bag holds no room`);
  }
});
