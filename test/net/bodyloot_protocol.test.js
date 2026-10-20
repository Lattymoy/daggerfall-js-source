// OUTDOOR-LOOT, SLICE 1 (2026-10-17) - RED PINS, THE BODY PROTOCOL: another player's foe's body, street and building
// (AC1-AC7), pinned BLACK-BOX before the fix exists. test-harness/outdoor-loot/DESIGN.md sections 3 and 8 are the plan;
// DESIGN-REVIEW.md is binding over it (D-1, R-1, R-2). test/net/bodyloot.test.js is phase 1 (what the press must do, read as
// where the pieces ARE); this file pins what the fix must SAY and DO on the way - the frames it puts on the wire, the doors
// it keeps, the older builds it must live beside:
//   1. THE PLAQUE (T1, T2): a body whose list the reader has not heard is no target and names nothing; an older owner's body
//      names itself alone; once the peek is answered the plaque lists the owner's list, by name and stack, in order.
//   2. THE DOORS (T4, T5): Take all and the quick door (a row, and take-the-lot) are claims, named by PLACE, the whole batch in
//      ONE frame; no door leaves a piece in the pack ahead of its verdict.
//   3. THE VERDICT IS FINAL (T10(a), T11, T13, R-1, R-2): the owner judges on receipt and says it in applyHit itself; a claim
//      in flight and not lapsed when its claimer leaves goes with the claimer (PARTY-LOOT's own rule - D-1); nothing is
//      voided onto the body; a verdict lost or late is recovered by the claimer's re-ask, answered from the owner's ledger.
//   4. THE LAWS THAT STAND (T13, T14, T16): a duplicate, forged or unasked verdict lands nothing; a claim in another's name is
//      refused; the owner's answer budget is in frames; AUTO-HOLD, M2; a lifted piece's stale pack row moves nothing; the new
//      frames speak only keys an older build's applyHit refuses.
//   5. MIXED BUILDS (T2, T8, T17): an older owner (no `bw`) is the legacy take: 1, landing at any lateness; an older taker
//      (a hand-built take: 1 from a roster peer with no pool) gets today's grant shape and races a new taker's claim to ONE copy.
//   6. THE OWNER (T18) and OFFLINE (T19).
//   7. THE SLICE 1 CODE REVIEW (DESIGN-REVIEW.md "SLICE 1 CODE REVIEW", written last in this file): S1-1 - a re-ask of a JUDGED
//      claim is answered wherever its claimer stands (the owner's pose list is not the roster); S1-2 - a body's identity
//      (owner, seq, g) survives the OWNER's reload: the generation is seeded per pool, a claim frame names it (a top-level `g`),
//      and a NEW claim is judged only against the body it was made on.
//
// MOUNTED, NOT MATCHED, and never a module that does not exist yet: the pools are the real createExteriorFoes (the street's,
// and the building's as worldModes.js wires it), behind the real hit queue, on the controllable clock of
// ./bodyLootHarness.mjs; the protocol is observed through the frames the relay stand-in captures (`net.log`, `net.foesLog`)
// and the pools' existing doors (hoverName/hoverContents, lootTargets, takeLoot, applyHit, foesFrame/applyFoes, update,
// destroy, clearPuppets). Frame shapes are DESIGN.md section 3.4's:
//   foes frame   bw: [[i, g, l, x, c?], ...]            the owner's takes digest, per dead-body record
//   peek         {to, k, i, bp: [p, ...]}               the reader asks for the records of places it lacks
//   peek answer  {to, k, i, bw: {g, l, x, c}, br: [[p, record], ...]}
//   claim        {to, k, i, g, bq: [{id, p, n}, ...]}   id = <claimer>:<stamp>:<n>, p = the PLACE, never a row; g = the body's generation (S1-2)
//   verdict      {to, k, i, bw: {...}, bv: [[id, g], ...]}   g the count granted, nought refused; final (D-1 withdraws the void)
// A building's frames also carry `own: 1` (OWN1's lane).
//
// Run against the tree at 760784f04d: every red pin fails by its assertion, with a message naming the missing behaviour;
// the guards (named so) pass and must stay green through the fix. The slice 1 review's pins (section 7) were run against
// 91b9c78280 (the block as DESIGN-REVIEW read it, f103d56fad): each red one fails by its assertion, the guards pass.
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { ROOM_TAKEN_TEXT, ROOM_CLAIM_TIMEOUT_MS } from '../../src/systems/roomLoot.js';
import { LOOT_NEWER_TAKE_TEXT } from '../../src/systems/loot/loot.js';
import { REALM_LETTER_TEMPLATE } from '../../src/net/realm/realmGoldLaw.js';
import { hoverLines } from '../../src/systems/worldHover.js';
import { foldQuickLoot, quickLootWheel, quickLootArm, resetQuickLoot } from '../../src/systems/quickLoot.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { setCarriedFilter } from '../../src/systems/peerWord.js';
import { planStore, planTake, applyTransfer } from '../../src/systems/item/itemTransfer.js';
import {
  FOES_FULL_MS, PILE, PILE2, pieceOf, nameOf, GREAVES, SHORTSWORD, GOLD, BROADSWORD, PINE, clock, clone, playerEntity, restoreRandom, scene, lootWindow, choosing, census, misplaced,
  plaque, saysEmpty, SETTLED_MS, run, runLive, leave, cross, offlineOwner, reloadOwner, settle, FOES_STALE_MS,
} from './bodyLootHarness.mjs';

afterEach(restoreRandom);

const WHERES = ['street', 'building'];
const BOB = 'bob-0002', MAC = 'mac-0001', EVE = 'eve-0003', OLD = 'old-0009';
const dir = (from, to) => `${from}>${to}`;
/** DESIGN.md 3.8: how long a taker keeps a claim waiting for its verdict - any verdict inside it lands. */
const CLAIM_KEEP_MS = 300_000;
/** exteriorFoes.js GRANT_BACK_MS (2 x TAKE_WINDOW_MS): how long an owner keeps a legacy grant's pieces for the taker's `back`. */
const GRANT_BACK_MS = 6000;

/** What today's code does instead of the protocol, for the message of every pin that fails at the press. */
const LEGACY = 'the press sent the legacy take: 1 (exteriorFoes.js takeLoot\'s puppet arm: no window, no claim frame (bq) on the wire) and the owner\'s grantCorpse hands over the whole pile';

// ── what the relay carried ──────────────────────────────────────────────────────────────────────────────────────────
const wire = (s, from, to) => s.net.log.filter((e) => e.from === from && e.to === to).map((e) => e.data);
const claimsBy = (s, taker) => wire(s, taker.id, s.bob.id).filter((d) => Array.isArray(d.bq));
const peeksBy = (s, taker) => wire(s, taker.id, s.bob.id).filter((d) => Array.isArray(d.bp));
const verdictsTo = (s, taker) => wire(s, s.bob.id, taker.id).filter((d) => Array.isArray(d.bv));
const answersTo = (s, taker) => wire(s, s.bob.id, taker.id).filter((d) => Array.isArray(d.br));
const verdictOf = (s, taker, id) => verdictsTo(s, taker).flatMap((d) => d.bv).find((v) => v[0] === id) ?? null;
const claimIds = (frames) => frames.flatMap((d) => d.bq.map((c) => c.id));

// ── where the pieces are ────────────────────────────────────────────────────────────────────────────────────────────
/** What `p` holds of a piece of the body: its count in the pack, or its coin in the purse. */
const heldBy = (p, piece) => (piece === GOLD ? (p.entity.goldPieces | 0) : p.entity.items.filter((it) => pieceOf(it) === piece).reduce((n, it) => n + (it.stackCount ?? 1), 0));
/** The pieces the owner's body holds. */
const onBody = (s) => s.rat.entity.items.map(pieceOf).sort();
const ALL = [GOLD, SHORTSWORD, GREAVES];
const rowsOf = (list) => hoverLines(list ?? [], Infinity).shown.map((r) => [r.name, r.stack]);
const placeOf = (s, piece) => s.body.findIndex((it) => pieceOf(it) === piece);

/** Mac presses; the press must open a window on the owner's list (the taker's choice, not the owner's grab). */
function pressOpens(s, p, w, what) {
  p.press(s.keyOf(p), w);
  assert.equal(w.opened.length, 1, `${what}: ${p.id}'s press opened NO window on ${s.bob.id}'s body - ${LEGACY}`);
}

// ═══ T1 - THE PLAQUE NEVER SAYS "EMPTY" OVER A LIST IT HAS NOT HEARD (AC1) ═════════════════════════════════════════════
for (const where of WHERES) {
  test(`T1 AC1 [${where}]: the owner's foes stream carries the takes digest for the body he fell with - bw: [[i, g, l, x]], three places, none gone`, async () => {
    const s = await scene(where);
    const frames = s.net.foesLog.filter((e) => e.from === s.bob.id && Array.isArray(e.frame.bw));
    assert.ok(frames.length > 0, `T1/AC1: none of ${s.bob.id}'s ${s.net.foesLog.length} foes frames carried a \`bw\` digest - the body's takes ride no stream, so a party member can only guess the body is full (record o is all it hears)`);
    const d = frames.at(-1).frame.bw.find((e) => e[0] === s.rat.seq);
    assert.ok(d, 'T1/AC1: the digest names the body (its number i)');
    assert.equal(d[2], 3, 'T1/AC1: l - the body has three places (the coin, the blade, the greaves)');
    assert.match(String(d[3]), /^0*$/, 'T1/AC1: x - the bitset of places gone is empty: nothing is taken yet');
  });

  test(`T1(a) AC1 [${where}]: before any peek is answered, the body is not in the party member's lootTargets and its plaque is never "Empty" (UNBORN: it names nothing)`, async () => {
    const s = await scene(where, [MAC], { hold: [dir(BOB, MAC)] });
    const key = s.keyOf(s.mac);
    const pup = s.mac.pool().foes.find((x) => x.puppet === s.bob.id && x.corpse);
    assert.equal(pup._pup.o, 3, 'the owner\'s word says the body holds three (guard)');
    assert.equal(s.mac.pool().lootTargets().some((t) => t.key === key), false, 'T1(a)/AC1: the body IS a target for Mac before the owner has said what is in it (exteriorFoes.js corpseLens.isCorpse: record o > 0) - the plaque stands over a list it has not heard');
    const f = plaque(s.mac, key);
    assert.equal(saysEmpty(f), false, 'T1(a)/AC1: Mac\'s plaque says "Empty" over a body its owner says holds three - the puppet\'s contents door answers null (exteriorFoes.js hoverContents) and the plaque reads null as empty (worldHover.js resolveHover)');
    assert.equal(f, null, 'T1(a)/AC1: an UNBORN body names nothing (the dungeon\'s UNBORN law) - no plaque at all');
  });

  test(`T1 AC1 [${where}]: the prefetch - ONE peek (bp) names the three places Mac lacks, and the owner's answer carries a record for each, in asked order (br), with the digest as an object (bw)`, async () => {
    const s = await scene(where);
    const peeks = peeksBy(s, s.mac);
    assert.equal(peeks.length, 1, `T1/AC1: ${peeks.length} peek frames (bp) crossed the relay - Mac never asked the owner for the records of a body it stands over (one in flight per body)`);
    assert.deepEqual([...peeks[0].bp].sort(), [0, 1, 2], 'T1/AC1: the peek names exactly the places Mac lacks (all three, none gone)');
    const answers = answersTo(s, s.mac);
    assert.ok(answers.length >= 1, 'T1/AC1: the owner answered no peek (no br frame)');
    assert.deepEqual(answers.flatMap((a) => a.br.map(([p]) => p)), peeks[0].bp, 'T1/AC1: the records come back in asked order');
    assert.ok(answers.every((a) => a.br.every(([, rec]) => rec && typeof rec === 'object')), 'T1/AC1: each is a record');
    assert.ok(answers.every((a) => a.bw && typeof a.bw === 'object' && !Array.isArray(a.bw) && a.bw.l === 3), 'T1/AC1: the answer carries the digest as an object (bw: {g, l, x, c})');
  });

  test(`T1(b) AC1 [${where}]: after the peek is answered, the plaque's rows equal the owner's list - by name and stack, in order`, async () => {
    const s = await scene(where, [MAC], { hold: [dir(BOB, MAC)] });
    const key = s.keyOf(s.mac);
    s.net.release(dir(BOB, MAC));
    run(s.net, 1000);
    const want = rowsOf(s.rat.entity.items);
    const got = rowsOf(s.mac.holds(key));
    assert.deepEqual(got, want, `T1(b)/AC1: Mac's plaque lists ${JSON.stringify(got)} where the owner's body holds ${JSON.stringify(want)} - the puppet's contents door answers null (exteriorFoes.js hoverContents) and the plaque reads null as "Empty"`);
  });

  test(`T1(c) AC1 [${where}]: a third player's granted take drops exactly that row from Mac's plaque after the stream`, async () => {
    const s = await scene(where, [MAC, EVE]);
    const key = s.keyOf(s.mac);
    const we = lootWindow(s.eve);
    pressOpens(s, s.eve, we, 'T1(c)/AC1');
    we.take(choosing(GREAVES));
    we.close();
    run(s.net, FOES_FULL_MS + 400);
    assert.equal(heldBy(s.eve, GREAVES), 1, 'Eve\'s take was granted (guard)');
    const want = rowsOf(s.body.filter((it) => pieceOf(it) !== GREAVES));
    const got = rowsOf(s.mac.holds(key));
    assert.deepEqual(got, want, `T1(c)/AC1: after Eve's granted take Mac's plaque lists ${JSON.stringify(got)}, not the owner's list less the Greaves ${JSON.stringify(want)}`);
  });
}

// ═══ T2 - AN OLDER OWNER'S BODY NAMES ITSELF ALONE (AC1/AC6) ═════════════════════════════════════════════════════════════
for (const where of WHERES) {
  test(`T2 AC1/AC6 [${where}]: with the owner's frames stripped of bw (an older owner), his body is a target whose plaque is the name alone - never "Empty"`, async () => {
    const s = await scene(where, [MAC], { stripBw: true });
    const key = s.keyOf(s.mac);
    assert.equal(s.mac.pool().lootTargets().some((t) => t.key === key), true, 'T2/AC6: an older owner\'s body (o > 0, no bw) is a target - the legacy take: 1 stays pressable (guard)');
    const f = plaque(s.mac, key);
    assert.ok(f?.title, 'the plaque names the body (guard)');
    assert.equal(f.kind, 'name', `T2/AC1/AC6: an older owner's body must name itself alone - Mac's plaque is kind "${f.kind}"${saysEmpty(f) ? ' and says "Empty" over a body holding three (worldHover.js resolveHover reads the puppet contents door\'s null as empty)' : ''}`);
    assert.match(f.title, /dead/i, 'the name is the body\'s: "<who> (dead)"');
  });
}

// ═══ T4 - TAKE ALL IS ONE CLAIM FRAME; A FILTER NAMES PIECES BY PLACE (AC4) ══════════════════════════════════════════════
for (const where of WHERES) {
  test(`T4 AC4 [${where}]: Take all through the window claims every piece in ONE claim frame (bq, by place), one verdict frame answers it and all three land - the owner's answer budget is spent once`, async () => {
    const s = await scene(where);
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T4/AC4');
    assert.equal(w.takeAll().moved, 3, 'Take all moved all three rows (guard)');
    run(s.net, 400);
    const claims = claimsBy(s, s.mac);
    assert.equal(claims.length, 1, `T4/AC4: ${claims.length} claim frames (bq) crossed the relay - the whole Take all must ride ONE (a frame a piece spends the owner's BODY_ASKS_PER_S budget, DESIGN.md 3.6)`);
    assert.deepEqual(claims[0].bq.map((c) => c.p).sort(), [0, 1, 2], 'T4/AC4: the claim frame names the three places of the body');
    assert.ok(claims[0].bq.every((c) => typeof c.id === 'string' && c.id.startsWith(`${MAC}:`) && Number.isInteger(c.n) && c.n >= 1), 'T4/AC4: each claim\'s id names its claimer (claimOf) and counts at least one');
    const verdicts = verdictsTo(s, s.mac);
    assert.equal(verdicts.length, 1, `T4/AC4: the owner answered with ${verdicts.length} verdict frames - one frame answers the one claim frame (his budget is spent once)`);
    assert.deepEqual(verdicts[0].bv.map((v) => v[0]).sort(), claimIds(claims).sort(), 'T4/AC4: the verdicts answer exactly the claims asked');
    assert.ok(verdicts[0].bv.every((v) => v[1] > 0), 'T4/AC4: all granted');
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
    assert.deepEqual(onBody(s), [], 'T4/AC4: the owner\'s body is empty of shared pieces');
    for (const k of ALL) assert.ok(heldBy(s.mac, k) >= 1, `Mac holds ${k}`);
  });

  test(`T4 AC4 [${where}]: Take all with a filter (filterStore) claims only the filtered pieces - named by PLACE, never by row`, async () => {
    const s = await scene(where);
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T4/AC4');
    assert.equal(w.takeAll({ cat: 'armor' }).moved, 1, 'the armour filter shows one row, and Take all moved it (guard)');
    run(s.net, 400);
    const claims = claimsBy(s, s.mac);
    assert.equal(claims.length, 1, `T4/AC4: ${claims.length} claim frames crossed the relay for the filtered Take all - no claim frame (bq) was sent: ${LEGACY}`);
    assert.deepEqual(claims[0].bq.map((c) => c.p), [placeOf(s, GREAVES)], `T4/AC4: only the filtered piece is claimed, by its PLACE (${placeOf(s, GREAVES)}) - the Greaves is row 0 of the filtered list, and a row index would claim the coin`);
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
    assert.equal(heldBy(s.mac, GREAVES), 1, 'Mac holds the Greaves');
    assert.deepEqual(onBody(s), [GOLD, SHORTSWORD].sort(), 'T4/AC4: the coin and the blade stay on the body');
  });
}

for (const where of WHERES) {
  test(`T4 AC4 [${where}]: the verdict carries the digest AFTER the judgment (bw) - with the owner's stream cut, Mac's plaque drops the taken row on the verdict alone: no flicker`, async () => {
    const s = await scene(where);
    const key = s.keyOf(s.mac);
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T4/AC4');
    assert.ok(w.take(choosing(GREAVES)), 'Mac took the Greaves from the window (guard)');
    w.close();
    s.net.foesFilter = () => null;   // the owner's stream is cut: only the verdict can tell Mac the place is gone
    run(s.net, 400);
    const verdicts = verdictsTo(s, s.mac);
    assert.equal(verdicts.length, 1, 'T4/AC4: the owner sent no verdict frame (bv)');
    assert.ok(verdicts[0].bw && typeof verdicts[0].bw === 'object' && !Array.isArray(verdicts[0].bw) && verdicts[0].bw.l === 3, 'T4/AC4: the verdict carries the digest as an object (bw: {g, l, x, c}) - the claimer recomposes atomically, with no flicker (DESIGN.md 3.4)');
    assert.equal(heldBy(s.mac, GREAVES), 1, 'the verdict landed (guard)');
    assert.deepEqual(rowsOf(s.mac.holds(key)), rowsOf(s.body.filter((it) => pieceOf(it) !== GREAVES)), 'T4/AC4: Mac\'s plaque lists the taken place again until the stream tells it - the verdict said nothing of the body it was judged against');
  });

  test(`T4 AC4 [${where}]: a partial take of a stack is a claim of the count taken - 30 of the 100 coin: the body keeps 70, for everyone (the digest's drawn-down counts, c)`, async () => {
    const s = await scene(where, [MAC, EVE]);
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T4/AC4');
    const list = w.list();
    const coin = list.find((it) => pieceOf(it) === GOLD);
    const plan = planTake(coin, { bag: s.mac.entity.items, entity: s.mac.entity, mode: 'remove' });
    applyTransfer(coin, { ...plan, amount: 30 }, list, s.mac.entity.items, { entity: s.mac.entity, toPlayer: true });   // the split popup's answer: thirty
    w.close();
    run(s.net, FOES_FULL_MS + 400);
    const claims = claimsBy(s, s.mac);
    assert.equal(claims.length, 1, `T4/AC4: ${claims.length} claim frames (bq) crossed the relay for a partial take`);
    assert.deepEqual(claims[0].bq.map((c) => [c.p, c.n]), [[placeOf(s, GOLD), 30]], 'T4/AC4: the claim names the coin\'s place and the count taken');
    assert.equal(heldBy(s.mac, GOLD), 30, 'Mac holds thirty');
    assert.equal(s.rat.entity.items.find((it) => pieceOf(it) === GOLD)?.stackCount, 70, 'T4/AC4: the owner\'s body keeps seventy');
    assert.deepEqual(rowsOf(s.eve.holds(s.keyOf(s.eve))), rowsOf(s.rat.entity.items), 'T4/AC4: Eve\'s plaque lists seventy coin - the drawn-down count rides the digest (c)');
  });
}

// ═══ T5 - THE QUICK DOOR IS A CLAIM, AND NO DOOR LEAVES A PIECE IN THE PACK AHEAD OF ITS VERDICT (AC4) ═══════════════════
/** Mac's plaque over the body, folded for the quick door with the row of `piece` lit (the wheel steps the light down). */
function litRow(s, piece) {
  const key = s.keyOf(s.mac);
  const f = plaque(s.mac, key);
  const row = f?.rows?.findIndex((r) => pieceOf(r.item) === piece) ?? -1;
  assert.ok(row >= 0, `T5/AC4: Mac's plaque lists no ${nameOf(s.body, piece)} row (${f ? `${f.kind}${f.empty ? ', "Empty"' : ''}` : 'no plaque'}) - the quick door finds nothing to light on a peer's body`);
  resetQuickLoot();
  foldQuickLoot(f);
  for (let i = 0; i < row; i++) { quickLootWheel(1); foldQuickLoot(f); }
  return { key, f };
}
for (const where of WHERES) {
  test(`T5 AC4 [${where}]: the quick door's lit row on a peer's body - the piece is lifted out of the pack AT ONCE, claimed, and in the pack only after the verdict`, async () => {
    setPref('quickLoot', true);
    try {
      const s = await scene(where);
      const { key } = litRow(s, GREAVES);
      s.net.hold(dir(BOB, MAC));   // the verdict is slow
      const w = lootWindow(s.mac);
      s.mac.press(key, w);
      assert.equal(w.opened.length, 0, 'the quick door took the row with no window (guard)');
      assert.equal(heldBy(s.mac, GREAVES), 0, 'T5/AC4: the piece is in the pack ahead of its verdict - the quick door moved it there and nothing lifted it out');
      const claims = claimsBy(s, s.mac);
      assert.equal(claims.length, 1, `T5/AC4: ${claims.length} claim frames (bq) crossed the relay at the press - the quick take's claim goes AT ONCE, at the end of takeLoot (DESIGN.md 3.6)`);
      assert.deepEqual(claims[0].bq.map((c) => c.p), [placeOf(s, GREAVES)], 'T5/AC4: it claims the lit row\'s place alone');
      run(s.net, 1000);
      assert.equal(heldBy(s.mac, GREAVES), 0, 'T5/AC4: still not in the pack while the verdict is on its way');
      s.net.release(dir(BOB, MAC));
      run(s.net, 400);
      assert.equal(heldBy(s.mac, GREAVES), 1, 'T5/AC4: in the pack once the verdict lands');
      assert.deepEqual(onBody(s), [GOLD, SHORTSWORD].sort(), 'T5/AC4: the owner\'s body lost only that piece');
      assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
    } finally { setPref('quickLoot', false); resetQuickLoot(); }
  });

  test(`T5 AC4 [${where}]: the quick door's take-the-lot (P) claims every row in ONE frame, and nothing is in the pack ahead of its verdict`, async () => {
    setPref('quickLoot', true);
    try {
      const s = await scene(where);
      const { key } = litRow(s, GOLD);
      assert.equal(quickLootArm('QuickLootAll'), true, 'P arms take-the-lot over the lit row (guard)');
      s.net.hold(dir(BOB, MAC));
      const w = lootWindow(s.mac);
      s.mac.press(key, w);
      assert.equal(w.opened.length, 0, 'the quick door took the lot with no window (guard)');
      for (const k of ALL) assert.equal(heldBy(s.mac, k), 0, `T5/AC4: ${k} is in the pack ahead of its verdict - take-the-lot moved the rows there and nothing lifted them out`);
      const claims = claimsBy(s, s.mac);
      assert.equal(claims.length, 1, `T5/AC4: ${claims.length} claim frames crossed the relay for take-the-lot - one frame carries every row`);
      assert.deepEqual(claims[0].bq.map((c) => c.p).sort(), [0, 1, 2], 'T5/AC4: all three places');
      run(s.net, 1000);
      for (const k of ALL) assert.equal(heldBy(s.mac, k), 0, `T5/AC4: ${k} still not in the pack while the verdict is on its way`);
      s.net.release(dir(BOB, MAC));
      run(s.net, 400);
      for (const k of ALL) assert.ok(heldBy(s.mac, k) >= 1, `T5/AC4: ${k} in the pack once the verdict lands`);
      assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
      assert.deepEqual(onBody(s), [], 'T5/AC4: the owner\'s body is empty of shared pieces');
    } finally { setPref('quickLoot', false); resetQuickLoot(); }
  });
}

// ═══ T6 - TWO TAKERS, ONE PIECE, ONE BREATH (AC3/AC4) ════════════════════════════════════════════════════════════════════
for (const where of WHERES) {
  test(`T6 AC3/AC4 [${where}]: two takers, one piece, one breath - exactly one copy, and the loser hears ROOM_TAKEN_TEXT and holds nothing of it`, async () => {
    const s = await scene(where, [MAC, EVE]);
    const wm = lootWindow(s.mac), we = lootWindow(s.eve);
    pressOpens(s, s.mac, wm, 'T6/AC4');
    pressOpens(s, s.eve, we, 'T6/AC4');
    assert.ok(wm.take(choosing(GREAVES)) && we.take(choosing(GREAVES)), 'both took the Greaves from their own windows before either heard the other (guard)');
    run(s.net, 600);
    const holders = [s.mac, s.eve].filter((p) => heldBy(p, GREAVES) > 0);
    assert.equal(holders.length, 1, `T6/AC3: ${holders.length} players hold the Greaves - exactly one copy`);
    const loser = [s.mac, s.eve].find((p) => !holders.includes(p));
    assert.ok(loser.said.includes(ROOM_TAKEN_TEXT), `T6/AC4: ${loser.id} lost the race and was not told (ROOM_TAKEN_TEXT)`);
    assert.equal(holders[0].said.includes(ROOM_TAKEN_TEXT), false, 'and the winner was not');
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  });
}

// ═══ T7 - A CLAIM WITH NO VERDICT COMES BACK TO THE VIEW, AND A LATE VERDICT STILL LANDS (AC2) ═════════════════════════════
for (const where of WHERES) {
  test(`T7 AC2 [${where}]: a claim with no verdict inside ${ROOM_CLAIM_TIMEOUT_MS / 1000} s comes back to the taker's VIEW - the plaque lists the piece again, the pack does not hold it - and the verdict that comes later still lands it, once`, async () => {
    const s = await scene(where);
    const key = s.keyOf(s.mac);
    const row = rowsOf(s.body.filter((it) => pieceOf(it) === GREAVES))[0][0];
    const lists = () => rowsOf(s.mac.holds(key)).some(([name]) => name === row);
    s.net.hold(dir(MAC, BOB));   // the claim does not reach the owner in time
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T7/AC2');
    assert.ok(w.take(choosing(GREAVES)), 'Mac took the Greaves from the window (guard)');
    w.close();
    run(s.net, ROOM_CLAIM_TIMEOUT_MS - 1000);
    assert.equal(lists(), false, 'T7/AC2: a claim in flight is read as taken in its claimer\'s own view (guard)');
    run(s.net, 2000);
    assert.equal(heldBy(s.mac, GREAVES), 0, 'T7/AC2: the lapsed claim\'s piece is in the pack - it comes back to the view, never the pack');
    assert.equal(lists(), true, `T7/AC2: ${ROOM_CLAIM_TIMEOUT_MS / 1000} s with no verdict - the piece did not come back to Mac's view`);
    s.net.release(dir(MAC, BOB));
    run(s.net, 2000);
    assert.equal(heldBy(s.mac, GREAVES), 1, 'T7/AC2: the verdict that came later landed the piece, once');
    assert.equal(lists(), false, 'and the view no longer lists it');
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  });
}

// ═══ T8 - AN OLDER OWNER: THE LEGACY GRANT LANDS AT ANY LATENESS (AC2/AC6) ═══════════════════════════════════════════════
for (const where of WHERES) {
  for (const [late, label] of [[3500, '3.5 s'], [10_000, '10 s'], [30_000, '30 s']]) {
    test(`T8 AC2/AC6 [${where}]: an OLDER owner (no bw) - the legacy take: 1 grant held ${label} lands once: Mac holds the whole pile, once, and the owner's body is empty`, async () => {
      const s = await scene(where, [MAC], { stripBw: true, late: { [dir(BOB, MAC)]: late } });
      const key = s.keyOf(s.mac);
      assert.equal(s.mac.pool().lootTargets().some((t) => t.key === key), true, 'an older owner\'s body is a target (guard)');
      s.mac.press(key, lootWindow(s.mac));
      run(s.net, late + SETTLED_MS);
      assert.deepEqual(misplaced(s), [], `T8/AC2: the legacy grant held ${label} - the taker refuses a grant past TAKE_WINDOW_MS (exteriorFoes.js applyHit \`if (!asked) return false;\`) and says nothing back, and the owner already took the pile off the body: destroyed`);
      assert.deepEqual(onBody(s), [], 'and the owner\'s body is empty');
      for (const k of ALL) assert.ok(heldBy(s.mac, k) >= 1, `Mac holds ${k}`);
    });
  }
}

// ═══ T10(a) - THE TAKER LEAVES BEFORE THE OWNER HEARS ITS CLAIM (AC2, D-1's recorded limit) ═════════════════════════════
for (const where of WHERES) {
  test(`T10(a) AC2 [${where}] (recorded limit - PARTY-LOOT's own rule, DESIGN-REVIEW D-1): the taker leaves the owner's roster before the owner hears the claim - the owner is silent and the claim, in flight and not lapsed at the leave, goes with the claimer: the Greaves is on the body AND in the taker's pack`, async () => {
    const s = await scene(where);
    s.net.late.set(dir(MAC, BOB), 1000);   // the claim is a second on the wire
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T10(a)/AC2');
    w.take(choosing(GREAVES));
    run(s.net, 100);
    assert.equal(claimsBy(s, s.mac).length, 1, 'T10(a): the claim is on the wire to the owner (no claim frame (bq) was sent)');
    assert.equal(heldBy(s.mac, GREAVES), 0, 'lifted out of the pack while the claim stands (guard)');
    leave(s.mac);
    run(s.net, SETTLED_MS);
    assert.deepEqual(verdictsTo(s, s.mac), [], 'T10(a): the owner is SILENT - a claim from a peer his hunt does not see is not heard (A1/C7)');
    assert.deepEqual(misplaced(s), [`${nameOf(s.body, GREAVES)}: 2 where the body held 1 - DUPED (the owner's body 1, ${MAC}'s pack 1)`], 'T10(a)/D-1: a claim in flight and not lapsed when its claimer leaves is KEPT by the claimer (PARTY-LOOT\'s dungeonContext teardown: `if (m.claim && !m.lapsed) roomGive(m.item, m.give)`), and the owner, who never heard it, still holds the piece - main\'s recorded dupe limit');
  });
}

// ═══ T11 - THE TAKER'S POOL IS TORN DOWN WITH A CLAIM IN FLIGHT (AC2, D-1) ═══════════════════════════════════════════════
for (const where of WHERES) {
  test(`T11 AC2 [${where}] (D-1): the taker's pool is torn down (destroy) with its claim in flight and not lapsed - the teardown gives the piece back to the taker's entity, the owner's grant stands: the Greaves is in exactly ONE place, the taker's pack`, async () => {
    const s = await scene(where);
    s.net.late.set(dir(BOB, MAC), 1500);   // the owner's verdict is 1.5 s on the wire
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T11/AC2');
    w.take(choosing(GREAVES));
    run(s.net, 300);
    assert.equal(heldBy(s.mac, GREAVES), 0, 'lifted out of the pack while the claim stands (guard)');
    assert.equal(onBody(s).includes(GREAVES), false, 'T11/AC2: the owner judged the claim on receipt - the Greaves is off his body');
    s.mac.pool().destroy();
    s.mac.here = false;
    run(s.net, SETTLED_MS);
    assert.deepEqual(misplaced(s), [], 'T11/AC2/D-1: the Greaves is in exactly one place');
    assert.equal(heldBy(s.mac, GREAVES), 1, 'T11/AC2/D-1: the taker KEPT the piece - the pool\'s teardown gives a claim in flight back to its entity; the owner\'s grant stands and is not voided back onto the body');
  });

  test(`T11 AC2 [${where}] (D-1): a claim that had LAPSED (more than ${ROOM_CLAIM_TIMEOUT_MS / 1000} s with no verdict) is NOT kept at the teardown - the piece is the owner's, in one place`, async () => {
    const s = await scene(where);
    s.net.late.set(dir(MAC, BOB), 60_000);   // the claim is a minute on the wire: no verdict in time
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T11/AC2');
    w.take(choosing(GREAVES));
    run(s.net, ROOM_CLAIM_TIMEOUT_MS + 1000);
    assert.equal(claimsBy(s, s.mac).length >= 1, true, 'T11/AC2: the claim is on the wire (no claim frame (bq) was sent)');
    assert.equal(heldBy(s.mac, GREAVES), 0, 'the lapsed claim\'s piece is back in the view, not in the pack (guard)');
    s.mac.pool().destroy();
    s.mac.here = false;
    run(s.net, SETTLED_MS);
    assert.equal(heldBy(s.mac, GREAVES), 0, 'T11/AC2/D-1: a LAPSED claim is not kept at the teardown');
    assert.deepEqual(misplaced(s), [], 'T11/AC2/D-1: the Greaves is in exactly one place - the owner\'s body (the claim reached him only after its claimer was gone)');
  });
}

// ═══ T13 - IDEMPOTENCE AND THE OLD PROTECTIONS (AC3) ═════════════════════════════════════════════════════════════════════
for (const where of WHERES) {
  test(`T13(a) AC3 [${where}]: a duplicated verdict lands once - the coin, the blade and the greaves are each in the pack once after the owner's verdict is heard three times`, async () => {
    const s = await scene(where);
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T13(a)/AC3');
    assert.equal(w.takeAll().moved, 3, 'Take all moved all three rows (guard)');
    run(s.net, 400);
    const verdicts = verdictsTo(s, s.mac);
    assert.equal(verdicts.length, 1, 'T13(a)/AC3: the owner sent no verdict frame (bv)');
    assert.equal(heldBy(s.mac, GOLD), 100, 'the verdict landed (guard)');
    s.mac.hit(s.bob.id, clone(verdicts[0]));
    s.mac.hit(s.bob.id, clone(verdicts[0]));
    run(s.net, 400);
    assert.equal(heldBy(s.mac, GOLD), 100, `T13(a)/AC3: a duplicated verdict landed the coin again - the purse holds ${heldBy(s.mac, GOLD)}, the body held 100`);
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  });

  test(`T13(b) AC3 [${where}] (guard - passes today): a verdict for a claim Mac never made lands nothing (B1/C1)`, async () => {
    const s = await scene(where);
    const said = s.mac.said.length;
    s.mac.hit(s.bob.id, s.frame(s.mac.id, { bw: { g: 0, l: 3, x: '0' }, bv: [[`${MAC}:zz:1`, 100]] }));
    for (const k of ALL) assert.equal(heldBy(s.mac, k), 0, `T13(b)/AC3: a verdict for a claim Mac never made landed ${k}`);
    assert.equal(s.mac.said.length, said, 'and said nothing');
  });

  test(`T13(c) AC3 [${where}]: a verdict naming Mac's claim but sent from a third peer is refused - the owner's own lands it`, async () => {
    const s = await scene(where, [MAC, EVE]);
    s.net.hold(dir(BOB, MAC));
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T13(c)/AC3');
    w.take(choosing(GREAVES));
    run(s.net, 200);
    const verdicts = verdictsTo(s, s.mac);
    assert.equal(verdicts.length, 1, 'T13(c)/AC3: the owner sent no verdict frame (bv)');
    s.mac.hit(s.eve.id, clone(verdicts[0]));   // the owner's verdict, word for word, from Eve
    assert.equal(heldBy(s.mac, GREAVES), 0, 'T13(c)/AC3: a verdict from a peer that is not the body\'s owner landed the piece');
    s.net.release(dir(BOB, MAC));
    run(s.net, 400);
    assert.equal(heldBy(s.mac, GREAVES), 1, 'and the owner\'s own verdict lands it, once');
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  });

  test(`T13(d) AC3 [${where}]: the owner refuses a claim whose id names another peer (claimOf) - it grants nobody, and burns no place`, async () => {
    const s = await scene(where, [MAC, EVE]);
    s.net.hold(dir(MAC, BOB));   // Mac's real claim waits on the wire
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T13(d)/AC3');
    w.take(choosing(GREAVES));
    run(s.net, 100);
    const real = claimsBy(s, s.mac);
    assert.equal(real.length, 1, 'T13(d)/AC3: Mac sent no claim frame (bq)');
    const forged = clone(real[0]);
    forged.bq = forged.bq.map((c) => ({ ...c, id: c.id.replace(`${MAC}:`, `${EVE}:`) }));
    assert.ok(forged.bq.every((c) => c.id.startsWith(`${EVE}:`)), 'the forged claim names Eve (guard)');
    s.bob.hit(s.mac.id, forged);   // Mac, in Eve's name
    run(s.net, 200);
    const granted = [...verdictsTo(s, s.mac), ...verdictsTo(s, s.eve)].flatMap((d) => d.bv).filter(([id, g]) => id.startsWith(`${EVE}:`) && g > 0);
    assert.deepEqual(granted, [], 'T13(d)/AC3: the owner granted a claim made in another peer\'s name');
    assert.equal(onBody(s).includes(GREAVES), true, 'T13(d)/AC3: the forged claim burned the place - the Greaves is off the body');
    assert.equal(heldBy(s.eve, GREAVES) + heldBy(s.mac, GREAVES), 0, 'nobody holds it yet');
    s.net.release(dir(MAC, BOB));
    run(s.net, 400);
    assert.equal(heldBy(s.mac, GREAVES), 1, 'Mac\'s own claim is judged first come and lands');
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  });

  test(`T13(f) AC3 [${where}]: over the owner's answer budget (frames a second, per peer) he is silent - and the re-ask lands the piece`, async () => {
    const s = await scene(where);
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T13(f)/AC3');
    w.take(choosing(GREAVES));
    run(s.net, 100);
    assert.equal(heldBy(s.mac, GREAVES), 1, 'the first claim was judged and landed (guard)');
    const judged = claimsBy(s, s.mac)[0];
    assert.ok(judged, 'T13(f)/AC3: Mac sent no claim frame (bq)');
    // sixteen re-asks of a judged claim in one instant: each is answered from the ledger, and each spends the budget
    const before = verdictsTo(s, s.mac).length;
    for (let i = 0; i < 16; i++) s.bob.hit(s.mac.id, clone(judged));
    const answered = verdictsTo(s, s.mac).length - before;
    assert.ok(answered >= 1, 'T13(f)/AC3: a re-ask of a judged claim is answered (guard)');
    assert.ok(answered < 16, `T13(f)/AC3: the owner answered all sixteen frames in one instant - he has no answer budget (BODY_ASKS_PER_S, DESIGN.md 3.8: frames a second per peer, then silence)`);
    // the next claim is over budget: silence
    assert.ok(w.take(choosing(SHORTSWORD)), 'Mac takes the blade (guard)');
    run(s.net, 100);
    const next = claimsBy(s, s.mac).at(-1);
    assert.notEqual(next, judged, 'the blade\'s claim was sent');
    const id = next.bq[0].id;
    assert.equal(verdictOf(s, s.mac, id), null, 'T13(f)/AC3: the owner answered a claim over his budget');
    assert.equal(heldBy(s.mac, SHORTSWORD), 0, 'and the blade is not in the pack');
    assert.equal(onBody(s).includes(SHORTSWORD), true, 'the owner never judged it: the blade is still on the body');
    run(s.net, 12_000);   // the budget refills; Mac asks again, with the same id
    assert.notEqual(verdictOf(s, s.mac, id), null, 'T13(f)/AC3: the re-ask was never answered');
    assert.equal(heldBy(s.mac, SHORTSWORD), 1, 'T13(f)/AC3: the re-ask lands the blade, once');
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  });

  test(`T13(g) AC2/AC3 [${where}]: a re-ask of a judged claim is answered even out of reach - while a NEW claim from out of reach gets silence (A1/C7)`, async () => {
    const s = await scene(where);
    const lose = (from, to, data) => (from === BOB && to === MAC && Array.isArray(data.bv) ? null : data);
    s.net.tamper = lose;   // the owner's verdict is lost in transit
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T13(g)/AC2');
    w.take(choosing(GREAVES));
    run(s.net, 300);
    assert.equal(verdictsTo(s, s.mac).length, 1, 'T13(g)/AC2: the owner judged and said his verdict (bv), and the wire lost it');
    assert.equal(heldBy(s.mac, GREAVES), 0, 'the verdict never reached Mac (guard)');
    s.mac.feet[0] += 50; s.mac.feet[2] += 50;   // Mac walks off: out of the body's reach for any NEW claim
    s.net.tamper = null;
    run(s.net, 15_000);
    assert.equal(heldBy(s.mac, GREAVES), 1, 'T13(g)/AC2/AC3: the re-ask was not answered out of reach - the judgment was already made, and Mac\'s piece is lost');
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
    // a NEW claim from out here is not heard
    assert.ok(w.take(choosing(SHORTSWORD)), 'Mac takes the blade from his still-open window (guard)');
    run(s.net, 15_000);
    assert.equal(heldBy(s.mac, SHORTSWORD), 0, 'T13(g)/A1-C7: a NEW claim from a peer out of the body\'s reach was answered');
    assert.equal(onBody(s).includes(SHORTSWORD), true, 'and the blade stayed on the body');
  });

  test(`T13(h) AC2/AC3 [${where}] (D-1): a verdict frame dropped by the owner's queue is NOT voided back onto the body - the re-ask is answered and the piece lands once`, async () => {
    const s = await scene(where);
    s.net.shut.add(s.bob.id);   // the owner's wire is held: his verdict waits in his hit queue
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T13(h)/AC3');
    w.take(choosing(GREAVES));
    run(s.net, 2300);   // past hitPend's 2 s: the verdict ages out of the queue and is dropped
    assert.equal(onBody(s).includes(GREAVES), false, 'T13(h)/D-1: the dropped verdict was voided back onto the body (LOOT-DUP\'s law) - verdicts are final, and a present claimer recovers by its re-ask');
    assert.equal(heldBy(s.mac, GREAVES), 0, 'and it has not reached Mac yet (guard)');
    s.net.shut.delete(s.bob.id);
    run(s.net, SETTLED_MS);
    assert.equal(heldBy(s.mac, GREAVES), 1, 'T13(h)/AC3: the re-ask was answered and the piece landed, once');
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  });

  test(`T13(i) AC3 [${where}] (AUTO-HOLD): a piece the taker carries (setCarriedFilter) is not offered to it - not listed, not claimed by Take all, and it stays on the body`, async () => {
    const s = await scene(where, [MAC], { hold: [dir(BOB, MAC)] });
    const key = s.keyOf(s.mac);
    setCarriedFilter((list) => list.filter((it) => pieceOf(it) !== GREAVES));   // Mac already carries the Greaves
    try {
      s.net.release(dir(BOB, MAC));
      run(s.net, 1000);
      const rows = rowsOf(s.mac.holds(key));
      assert.deepEqual(rows, rowsOf(s.body.filter((it) => pieceOf(it) !== GREAVES)), `T13(i)/AC3: Mac's plaque lists ${JSON.stringify(rows)} - the body is the coin and the blade for a reader that carries the Greaves`);
      const w = lootWindow(s.mac);
      pressOpens(s, s.mac, w, 'T13(i)/AC3');
      w.takeAll();
      run(s.net, 400);
      assert.deepEqual(claimsBy(s, s.mac).flatMap((d) => d.bq.map((c) => c.p)).sort(), [placeOf(s, GOLD), placeOf(s, SHORTSWORD)].sort(), 'T13(i)/AC3: Take all claims only the places Mac may be offered');
      assert.equal(heldBy(s.mac, GREAVES), 0, 'T13(i)/AC3: Mac was handed a piece it carries');
      assert.deepEqual(onBody(s), [GREAVES], 'and the Greaves stays on the owner\'s body');
    } finally { setCarriedFilter(null); }
  });

  test(`T13(j) AC3 [${where}] (HACKED-GOLD/SS3): a letter of credit on the owner's body is never a place - not in the digest (l: 3), not on Mac's plaque, not claimed by Take all - and it stays the owner's, shown in his own list`, async () => {
    const letter = { group: 'MiscItems', templateIndex: REALM_LETTER_TEMPLATE, name: 'Letter of credit', value: 5000, stackCount: 1 };
    const s = await scene(where, [MAC], { extra: [letter] });   // a revenant carries what it took of its killer's (RVN8)
    const digests = s.net.foesLog.filter((e) => e.from === s.bob.id && Array.isArray(e.frame.bw)).flatMap((e) => e.frame.bw).filter((d) => d[0] === s.rat.seq);
    assert.ok(digests.length > 0, 'T13(j)/AC3: the owner\'s stream carried no `bw` digest');
    assert.ok(digests.every((d) => d[2] === 3), `T13(j)/AC3: the digest counts ${digests.map((d) => d[2])} places - a letter of credit is never a place (it never rides a peer\'s word)`);
    const records = s.net.foesLog.filter((e) => e.from === s.bob.id).flatMap((e) => e.frame.f).filter((r) => r.i === s.rat.seq && r.d === 1);
    assert.ok(records.length > 0 && records.every((r) => r.o === 3), 'the record\'s o counts the three places, not the letter (guard)');
    assert.deepEqual(rowsOf(s.mac.holds(s.keyOf(s.mac))).map(([name]) => name).filter((name) => /letter/i.test(name)), [], 'T13(j)/AC3: the letter is on Mac\'s plaque');
    assert.equal(rowsOf(s.bob.holds(`foeCorpse:${s.rat.uid}`)).filter(([name]) => /letter/i.test(name)).length, 1, 'and it is on the owner\'s own list, once');
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T13(j)/AC3');
    assert.equal(w.takeAll().moved, 3, 'Take all moved the three places');
    run(s.net, 400);
    assert.equal(s.mac.entity.items.some((it) => it.templateIndex === REALM_LETTER_TEMPLATE), false, 'no letter in the taker\'s pack');
    assert.equal(s.rat.entity.items.filter((it) => it.templateIndex === REALM_LETTER_TEMPLATE).length, 1, 'the letter stays on the owner\'s body, once');
  });

  test(`T13(k) AC1/AC6 [${where}] (AUDIT SETS M2): a record the reader cannot read makes the body the name alone, and its press says LOOT_NEWER_TAKE_TEXT - no window, no claim`, async () => {
    let tampered = 0;
    const newer = (from, to, data) => {
      if (to === MAC && Array.isArray(data.br)) { tampered += 1; data.br = data.br.map(([p]) => [p, { templateIndex: 999999 }]); }   // a piece from a newer build: one this port cannot mint
      return data;
    };
    const s = await scene(where, [MAC], { tamper: newer });
    const key = s.keyOf(s.mac);
    assert.ok(tampered > 0, 'T13(k): the owner sent no peek answer (br) - there are no records to be unreadable');
    const f = plaque(s.mac, key);
    assert.equal(f?.kind, 'name', `T13(k)/AC1: a body with a record this build cannot read must be the name alone - Mac's plaque is ${f ? `kind "${f.kind}"${saysEmpty(f) ? ' and says "Empty"' : ''}` : 'absent'}`);
    assert.equal(s.mac.pool().lootTargets().some((t) => t.key === key), true, 'and it stays a target: the press says why (guard)');
    const w = lootWindow(s.mac);
    s.mac.press(key, w);
    assert.equal(s.mac.said.at(-1), LOOT_NEWER_TAKE_TEXT, 'T13(k)/AC6: the press says it is from a newer version of the game');
    assert.equal(w.opened.length, 0, 'T13(k): and opens nothing');
    run(s.net, 400);
    assert.equal(claimsBy(s, s.mac).length, 0, 'and claims nothing');
    assert.deepEqual(onBody(s), ALL.slice().sort(), 'the owner\'s body is whole');
  });
}

// ═══ T14 - A LIFTED PIECE'S STALE PACK ROW MOVES NOTHING (AC3) ═══════════════════════════════════════════════════════════
for (const where of WHERES) {
  test(`T14 AC3 [${where}]: a piece lifted under an open window - its stale pack row, clicked back into the body (a single click) and walked back by Stash all, moves nothing: there is never a second copy`, async () => {
    const s = await scene(where);
    s.net.hold(dir(BOB, MAC));   // the verdict is slow: the piece stays lifted
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T14/AC3');
    const row = w.take(choosing(GREAVES));
    assert.ok(row, 'Mac took the Greaves from the window (guard)');
    run(s.net, 200);
    assert.equal(heldBy(s.mac, GREAVES), 0, 'the piece is lifted out of the pack under the open window - the pack panel still draws its row (guard)');
    w.store(row);
    assert.equal(w.list().some((it) => pieceOf(it) === GREAVES), false, 'T14/AC3: the single click moved the stale row into the body - a second copy of the Greaves');
    w.stashAll([row]);
    assert.equal(w.list().some((it) => pieceOf(it) === GREAVES), false, 'T14/AC3: Stash all moved the stale row into the body - a second copy');
    s.net.release(dir(BOB, MAC));
    w.close();
    run(s.net, SETTLED_MS);
    assert.deepEqual(misplaced(s), [], 'T14/AC3: the Greaves is in exactly one place');
    assert.equal(heldBy(s.mac, GREAVES), 1, 'Mac holds it, once');
  });
}

// The law underneath, without a net: the single click on a stale row (itemTransfer.js applyTransfer moves a piece whether its
// source holds it or not). The same latent class holds in PARTY-LOOT's dungeon containers, whose lift is the same.
test('T14 AC3: a click on a stale PACK row (the piece was lifted out) moves nothing into the container - applyTransfer must not copy a piece its source no longer holds', () => {
  const [, sword, greaves] = PILE();
  const entity = playerEntity();
  const pack = [], container = [sword];   // the Greaves was lifted out of the pack; its row is still drawn
  const put = planStore(greaves, { remote: container });
  if (put.ok) applyTransfer(greaves, put, pack, container, { entity, fromLocal: true, toPlayer: false });
  assert.deepEqual(container.map(pieceOf), [SHORTSWORD], 'T14/AC3: the single click copied a piece that is not in the pack into the container');
});

test('T14 AC3: a click on a stale CONTAINER row (another\'s take emptied it) puts nothing in the pack - applyTransfer must not copy a piece its source no longer holds', () => {
  const [, sword, greaves] = PILE();
  const entity = playerEntity();
  const there = [sword], mine = [];   // the Greaves left the container; the window still draws its row
  const take = planTake(greaves, { bag: mine, entity, mode: 'remove' });
  if (take.ok) applyTransfer(greaves, take, there, mine, { entity, fromLocal: false, toPlayer: true });
  assert.deepEqual(mine.map(pieceOf), [], 'T14/AC3: a click on a row the container no longer holds put a copy in the pack');
});

test('T14 AC3: a click on a stale COIN row puts no coin in the purse - the purse is no list, but the same door spends a pile into it', () => {
  const [coin, sword] = PILE();
  const entity = playerEntity();
  const there = [sword], mine = [];
  const take = planTake(coin, { bag: mine, entity, mode: 'remove' });
  if (take.ok) applyTransfer(coin, take, there, mine, { entity, fromLocal: false, toPlayer: true });
  assert.equal(entity.goldPieces | 0, 0, 'T14/AC3: a click on a coin row the container no longer holds minted gold into the purse');
});

// ═══ T16 - OLDER BUILDS REFUSE THE NEW FRAMES (AC6) ══════════════════════════════════════════════════════════════════════
const NEW_KEYS = ['bw', 'bp', 'br', 'bq', 'bv'];
/** PIN EXTENDED (SLICE 1 REVIEW, S1-2): the claim frame - `bq` - and no other new frame also names the generation of the body it was
 *  made on, a top-level `g` beside the routing. OLD_KEYS (what the old arms read) does not name it and the scan below fails on an
 *  applyHit that reads it, so an older build still falls to its blow arm (no dmg) and refuses. */
const CLAIM_EXTRA_KEYS = ['g'];
/** DESIGN.md 3.4: the old hit arms' keys, and the routing every hit frame carries. */
/** PIN EXTENDED (DEX5b, bible/04-Characters/Enemy-Expansion.md section 11): `cs` - a strike spell's hit (`sp`, `lv`) on a mod's corpse
 *  prefab's body, the blow arm's own (ahead of its dead-foe refusal); an older build falls to the blow arm and refuses a dead foe. */
const OLD_KEYS = ['dmg', 'take', 'back', 'grant', 'slain', 'fb', 'ar', 'al', 'ac', 'sf', 'z', 'wc', 'sp', 'lv', 'pt', 'p', 'd', 'kind', 'nv', 'own', 'to', 'k', 'i', 'n', 'cs'];

test('T16(a) AC6 (guard - passes today): the new frames\' keys (bw, bp, br, bq, bv - and the claim frame\'s g) are disjoint from the old applyHit arms\' keys, and applyHit reads no key of `data` the design does not name', () => {
  assert.deepEqual([...NEW_KEYS, ...CLAIM_EXTRA_KEYS].filter((k) => OLD_KEYS.includes(k)), [], 'a new frame key collides with an old arm\'s: an older build would take the frame for a blow, a take or a grant');
  const src = readFileSync(new URL('../../src/scenes/exteriorFoes.js', import.meta.url), 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  let fn = null;
  (function walk(n) { if (!n || typeof n.type !== 'string' || fn) return; if (n.type === 'FunctionDeclaration' && n.id?.name === 'applyHit') { fn = n; return; } for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); } })(ast);
  assert.ok(fn, 'exteriorFoes.js has function applyHit');
  const read = new Set();
  (function walk(n) { if (!n || typeof n.type !== 'string') return; if (n.type === 'MemberExpression' && !n.computed && n.object?.type === 'Identifier' && n.object.name === 'data' && n.property?.type === 'Identifier') read.add(n.property.name); for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); } })(fn);
  assert.ok(read.has('dmg'), 'the scan reads the blow arm - the arm an older build falls to for a frame it does not know (guard)');
  const unnamed = [...read].filter((k) => !OLD_KEYS.includes(k) && !NEW_KEYS.includes(k));
  assert.deepEqual(unnamed, [], 'applyHit reads keys of the frame DESIGN.md 3.4 does not name - an arm added without being checked against the others');
});

for (const where of WHERES) {
  test(`T16(a) AC6 [${where}]: every new-protocol frame on the wire speaks the new keys and the routing only - never a blow's, a take's or a grant's - so an older build falls to its blow arm (no dmg: refused)`, async () => {
    const s = await scene(where);
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T16(a)/AC6');
    w.takeAll();
    run(s.net, 400);
    const novel = s.net.log.filter((e) => NEW_KEYS.some((k) => k in e.data));
    for (const k of ['bp', 'br', 'bq', 'bv']) assert.ok(novel.some((e) => k in e.data), `T16(a)/AC6: no \`${k}\` frame crossed the relay - ${LEGACY}`);
    const ALLOWED = new Set(['to', 'k', 'i', 'own', ...NEW_KEYS]);
    for (const e of novel) {
      const allowed = 'bq' in e.data ? new Set([...ALLOWED, ...CLAIM_EXTRA_KEYS]) : ALLOWED;   // S1-2: the claim frame alone names the body's generation
      assert.deepEqual(Object.keys(e.data).filter((k) => !allowed.has(k)), [], `T16(a)/AC6: a ${e.from}>${e.to} frame carries keys beyond routing and the new protocol's: ${JSON.stringify(e.data)}`);
    }
  });

  test(`T16(b) AC6 [${where}] (guard - passes today): each new frame fed to a pool in the wrong role answers false and changes nothing`, async () => {
    const s = await scene(where, [MAC, EVE]);
    const snapshot = () => JSON.stringify({
      body: s.rat.entity.items.map(pieceOf), bob: [s.bob.entity.items.map(pieceOf), s.bob.entity.goldPieces], mac: [s.mac.entity.items.map(pieceOf), s.mac.entity.goldPieces],
      plaque: rowsOf(s.mac.holds(s.keyOf(s.mac))), wire: s.net.log.length, said: [s.bob.said.length, s.mac.said.length],
    });
    const before = snapshot();
    const digest = { g: 0, l: 3, x: '0' };
    const rec = { templateIndex: 999999 };
    const fed = [
      ['a peek (bp) fed to a reader that owns no such body', () => s.mac.hit(s.eve.id, s.frame(s.mac.id, { bp: [0, 1, 2] }))],
      ['a claim (bq) fed to a reader that owns no such body', () => s.mac.hit(s.eve.id, s.frame(s.mac.id, { bq: [{ id: `${EVE}:zz:1`, p: 2, n: 1 }] }))],
      ['a verdict (bv) fed to the owner, who made no claim', () => s.bob.hit(s.mac.id, s.frame(s.bob.id, { bw: digest, bv: [[`${MAC}:zz:1`, 1]] }))],
      ['a peek answer (br, bw) fed to the owner, who asked nothing', () => s.bob.hit(s.mac.id, s.frame(s.bob.id, { bw: digest, br: [[0, rec]] }))],
    ];
    for (const [what, feed] of fed) {
      assert.equal(feed(), false, `T16(b)/AC6: ${what} did not answer false`);
      assert.equal(snapshot(), before, `T16(b)/AC6: ${what} changed something`);
    }
  });
}

// ═══ T17 - AN OLDER TAKER AT A NEW OWNER (AC6) ═══════════════════════════════════════════════════════════════════════════
/** The pile's pieces as an older taker's grant frames say them: name and stack, coin included. */
const grantedTo = (p) => p.got.filter((g) => g.from === BOB && Array.isArray(g.data.grant)).flatMap((g) => g.data.grant);
for (const where of WHERES) {
  test(`T17 AC6 [${where}] (guard - passes today): an OLDER taker (a hand-built take: 1, no pool) gets today's legacy grant shape - {to, k, i, grant, n}, the whole pile at its counts - and the owner's body is emptied`, async () => {
    const s = await scene(where, [MAC], { ghosts: [OLD] });
    s.old.send(s.frame(BOB, { take: 1 }));
    run(s.net, 400);
    const frames = s.old.got.filter((g) => g.from === BOB && Array.isArray(g.data.grant)).map((g) => g.data);
    assert.ok(frames.length >= 1, 'the owner answered the older taker with a grant (guard)');
    const ALLOWED = new Set(['to', 'k', 'i', 'n', 'grant', 'own']);
    for (const f of frames) assert.deepEqual(Object.keys(f).filter((k) => !ALLOWED.has(k)), [], `T17/AC6: the legacy grant speaks today's shape only, an older build reads nothing else: ${JSON.stringify(Object.keys(f))}`);
    assert.deepEqual(grantedTo(s.old).map((it) => [it.name, it.stackCount ?? 1]).sort(), s.body.map((it) => [it.name, it.stackCount ?? 1]).sort(), 'T17/AC6: the grant is the whole pile at its counts');
    assert.deepEqual(onBody(s), [], 'the owner\'s body is emptied');
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
    assert.deepEqual(rowsOf(s.mac.holds(s.keyOf(s.mac))), [], 'Mac\'s plaque no longer lists the pile');
  });

  test(`T17 AC6 [${where}]: an older taker's take: 1 reaches the owner FIRST, then a new taker's claim for the Greaves - ONE copy: the new taker is told ROOM_TAKEN_TEXT and holds nothing of it`, async () => {
    const s = await scene(where, [MAC], { ghosts: [OLD] });
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T17/AC6');
    w.take(choosing(GREAVES));   // Mac's claim leaves at his next frame...
    s.old.send(s.frame(BOB, { take: 1 }));   // ...and the older taker's frame is already on the wire
    run(s.net, 600);
    assert.deepEqual(misplaced(s), [], 'T17/AC6: every piece in exactly one place');
    assert.equal(heldBy(s.mac, GREAVES), 0, 'T17/AC6: the new taker holds a piece the older taker\'s grant took first');
    assert.ok(s.mac.said.includes(ROOM_TAKEN_TEXT), 'T17/AC6: and was not told');
    assert.deepEqual(grantedTo(s.old).map(pieceOf).sort(), ALL.slice().sort(), 'the older taker holds the pile');
  });

  test(`T17 AC6 [${where}]: a new taker's claim for the Greaves reaches the owner FIRST, then an older taker's take: 1 - ONE copy: the new taker lands it, and the older taker's grant is what is left`, async () => {
    const s = await scene(where, [MAC], { ghosts: [OLD] });
    s.net.late.set(dir(OLD, BOB), 300);
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T17/AC6');
    w.take(choosing(GREAVES));
    s.old.send(s.frame(BOB, { take: 1 }));
    run(s.net, 600);
    assert.deepEqual(misplaced(s), [], 'T17/AC6: every piece in exactly one place');
    assert.equal(heldBy(s.mac, GREAVES), 1, 'T17/AC6: the new taker\'s claim came first and lands');
    assert.deepEqual(grantedTo(s.old).map(pieceOf).sort(), [GOLD, SHORTSWORD].sort(), 'T17/AC6: the older taker\'s grant is what was left: the coin and the blade');
    assert.deepEqual(onBody(s), [], 'the owner\'s body is empty');
  });

  test(`T17 AC6 [${where}] (guard - passes today; LOOT-DUP): a legacy grant the owner's queue drops goes back on the body - nothing reached the older taker`, async () => {
    const s = await scene(where, [MAC], { ghosts: [OLD] });
    s.net.shut.add(s.bob.id);
    s.old.send(s.frame(BOB, { take: 1 }));
    run(s.net, 2600);   // the grant waits behind the shut wire, ages out of the queue (2 s) and is dropped
    s.net.shut.delete(s.bob.id);
    run(s.net, SETTLED_MS);
    assert.deepEqual(grantedTo(s.old), [], 'the older taker was sent nothing');
    assert.deepEqual(onBody(s), ALL.slice().sort(), 'the owner\'s body is whole again');
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  });

  test(`T17 AC6 [${where}]: the pieces a dropped legacy grant put back are the body's again for a NEW taker - a new place, claimable: Take all lands all three`, async () => {
    const s = await scene(where, [MAC], { ghosts: [OLD] });
    s.net.shut.add(s.bob.id);
    s.old.send(s.frame(BOB, { take: 1 }));
    run(s.net, 2600);
    s.net.shut.delete(s.bob.id);
    run(s.net, FOES_FULL_MS * 2);
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'T17/AC6');
    assert.equal(w.takeAll().moved, 3, 'T17/AC6: the window lists the restored pieces (Take all moved three rows)');
    run(s.net, 600);
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
    assert.deepEqual(onBody(s), [], 'the owner\'s body is empty');
    for (const k of ALL) assert.ok(heldBy(s.mac, k) >= 1, `Mac holds ${k}`);
  });

  test(`T17 AC6 [${where}] (guard - passes today; F4): the older taker's back inside GRANT_BACK_MS restores the pieces once; a back past it moves nothing`, async () => {
    const s = await scene(where, [MAC], { ghosts: [OLD] });
    s.old.send(s.frame(BOB, { take: 1 }));
    run(s.net, 400);
    assert.deepEqual(onBody(s), [], 'granted: the body holds none of it (guard)');
    s.old.send(s.frame(BOB, { back: 1 }));
    run(s.net, 400);
    assert.deepEqual(onBody(s), ALL.slice().sort(), 'F4: the pieces are back on the body');
    s.old.send(s.frame(BOB, { back: 1 }));
    run(s.net, 400);
    assert.deepEqual(onBody(s), ALL.slice().sort(), 'F4: a second back restores nothing more - once');
    // a second grant, and a back that comes too late
    s.old.send(s.frame(BOB, { take: 1 }));
    run(s.net, GRANT_BACK_MS + 1000);
    assert.deepEqual(onBody(s), [], 'granted again (guard)');
    s.old.send(s.frame(BOB, { back: 1 }));
    run(s.net, 400);
    assert.deepEqual(onBody(s), [], 'F4: a back past GRANT_BACK_MS moves nothing');
  });
}

// ═══ T18 - THE OWNER'S OWN DOORS AGAINST A PEER'S CLAIM (AC7) ════════════════════════════════════════════════════════════
for (const where of WHERES) {
  test(`T18(b) AC7 [${where}]: the owner's window is open when a peer's claim is granted - his list still shows the piece (C1), and his take of it is lifted back out of his pack and told ROOM_TAKEN_TEXT`, async () => {
    const s = await scene(where);
    const bobKey = `foeCorpse:${s.rat.uid}`;
    const wb = lootWindow(s.bob);
    s.bob.press(bobKey, wb);
    assert.equal(wb.opened.length, 1, 'the owner\'s window opened on his body (guard)');
    const wm = lootWindow(s.mac);
    pressOpens(s, s.mac, wm, 'T18(b)/AC7');
    wm.take(choosing(GREAVES));
    run(s.net, 400);
    assert.equal(heldBy(s.mac, GREAVES), 1, 'Mac\'s claim was granted and landed');
    assert.equal(wb.list().some((it) => pieceOf(it) === GREAVES), true, 'T18(b)/C1: the owner\'s open window lost the row a peer\'s claim took - nothing is recomposed under an open window');
    assert.ok(wb.take(choosing(GREAVES)), 'the owner clicks the row he still sees');
    run(s.net, 400);
    assert.equal(heldBy(s.bob, GREAVES), 0, 'T18(b)/AC7: the owner\'s take of a piece already granted stayed in his pack - a copy');
    assert.ok(s.bob.said.includes(ROOM_TAKEN_TEXT), 'T18(b)/AC7: and the owner was not told');
    assert.deepEqual(misplaced(s), [], 'T18(b)/AC7: the Greaves is in exactly one place - Mac\'s pack');
  });

  test(`T18(c) AC7 [${where}]: the owner takes first - the peer's open window still lists the row (C1), and the peer's click on it is refused: he is told (ROOM_TAKEN_TEXT) and holds nothing of it`, async () => {
    const s = await scene(where);
    const wm = lootWindow(s.mac);
    pressOpens(s, s.mac, wm, 'T18(c)/AC7');   // Mac's window is open on the list as it was
    const wb = lootWindow(s.bob);
    s.bob.press(`foeCorpse:${s.rat.uid}`, wb);
    assert.ok(wb.take(choosing(GREAVES)), 'the owner takes the Greaves first');
    wb.close();
    run(s.net, FOES_FULL_MS + 400);   // the stream tells Mac: the place is gone
    assert.equal(heldBy(s.bob, GREAVES), 1, 'in the owner\'s pack, judged where it stands');
    assert.equal(wm.list().some((it) => pieceOf(it) === GREAVES), true, 'T18(c)/C1: the peer\'s open window lost the row the owner took - nothing is recomposed under an open window');
    assert.ok(wm.take(choosing(GREAVES)), 'Mac clicks the row his open window still shows');
    run(s.net, 400);
    assert.equal(heldBy(s.mac, GREAVES), 0, 'T18(c)/AC7: the peer holds a piece the owner took first');
    assert.ok(s.mac.said.includes(ROOM_TAKEN_TEXT), 'T18(c)/AC7: and was not told');
    assert.deepEqual(misplaced(s), [], 'T18(c)/AC7: the Greaves is in exactly one place - the owner\'s pack');
  });

  test(`T18(d) AC7 [${where}]: first come - a take the owner's window already made (no frame has read it yet) wins over a peer's claim that reaches him next: the peer is refused and told, the owner keeps his piece`, async () => {
    const s = await scene(where);
    const caught = [];
    s.net.tamper = (from, to, data) => { if (from === MAC && Array.isArray(data.bq)) { caught.push(clone(data)); return null; } return data; };   // Mac's claim is held back: it reaches the owner by hand
    const wm = lootWindow(s.mac);
    pressOpens(s, s.mac, wm, 'T18(d)/AC7');
    wm.take(choosing(GREAVES));
    run(s.net, 100);
    s.net.tamper = null;
    assert.equal(caught.length, 1, 'T18(d): Mac sent no claim frame (bq)');
    const wb = lootWindow(s.bob);
    s.bob.press(`foeCorpse:${s.rat.uid}`, wb);
    assert.ok(wb.take(choosing(GREAVES)), 'the owner clicks the Greaves in his window - no frame has read it yet');
    s.bob.hit(s.mac.id, clone(caught[0]));   // and Mac's claim, which left first in wall time at HIS end, reaches him now
    run(s.net, 400);
    assert.equal(heldBy(s.bob, GREAVES), 1, 'T18(d)/AC7: the owner\'s own take was not settled before the peer\'s claim was judged - he lost the piece he had already taken (DESIGN.md 3.6: the owner settles his own view first)');
    assert.equal(heldBy(s.mac, GREAVES), 0, 'and the peer holds nothing of it');
    assert.ok(s.mac.said.includes(ROOM_TAKEN_TEXT), 'T18(d)/AC7: the peer was told');
    assert.deepEqual(misplaced(s), [], 'T18(d)/AC7: the Greaves is in exactly one place - the owner\'s pack');
  });
}

// ═══ T19 - GUARDS: OFFLINE UNCHANGED; PHYSICAL ITEMS LAYS NOTHING ROUND A PEER'S BODY ═══════════════════════════════════════
test('T19 AC7 (guard - passes today): OFFLINE (no net) the owner\'s window behaves as today - the piece he takes is in his pack at once and STAYS there frame after frame: nothing is claimed, lifted or put back', async () => {
  const o = await offlineOwner();
  const w = lootWindow({ entity: o.entity });
  o.press(w);
  assert.equal(w.opened.length, 1, 'his window opened');
  assert.deepEqual(w.list().map(pieceOf), ALL, 'on his list: the coin, the blade, the greaves');
  assert.ok(w.take(choosing(GREAVES)), 'he takes the Greaves');
  assert.deepEqual(o.entity.items.map(pieceOf), [GREAVES], 'in his pack at once');
  for (let i = 0; i < 100; i++) { clock.t += 50; o.tick(); }
  assert.deepEqual(o.entity.items.map(pieceOf), [GREAVES], 'and there after a hundred frames (no net: no claim lifts it)');
  w.close();
  for (let i = 0; i < 100; i++) { clock.t += 50; o.tick(); }
  assert.deepEqual(o.entity.items.map(pieceOf), [GREAVES], 'and after the window shut');
  assert.deepEqual(o.rat.entity.items.map(pieceOf), [GOLD, SHORTSWORD], 'the coin and the blade stay on the body');
  assert.equal(o.entity.goldPieces | 0, 0, 'no coin moved');
});

test('T19 AC7 (guard - passes today): OFFLINE the owner\'s quick take - his plaque lists his body, the lit row is taken at once with no window, and it stays in his pack', async () => {
  setPref('quickLoot', true);
  try {
    const o = await offlineOwner();
    const f = plaque(o, o.key);
    assert.equal(f?.kind, 'items', 'his plaque lists his body');
    const row = f.rows.findIndex((r) => pieceOf(r.item) === GREAVES);
    assert.equal(row, 2, 'the Greaves is the third row');
    resetQuickLoot();
    foldQuickLoot(f);
    for (let i = 0; i < row; i++) { quickLootWheel(1); foldQuickLoot(f); }
    const w = lootWindow({ entity: o.entity });
    o.press(w);
    assert.equal(w.opened.length, 0, 'no window');
    assert.deepEqual(o.entity.items.map(pieceOf), [GREAVES], 'in his pack at once');
    for (let i = 0; i < 100; i++) { clock.t += 50; o.tick(); }
    assert.deepEqual(o.entity.items.map(pieceOf), [GREAVES], 'and there after a hundred frames');
    assert.deepEqual(o.rat.entity.items.map(pieceOf), [GOLD, SHORTSWORD], 'the coin and the blade stay on the body');
  } finally { setPref('quickLoot', false); resetQuickLoot(); }
});

for (const where of WHERES) {
  test(`T19 AC4 [${where}] (guard - passes today): physicalCorpses excludes a peer's puppet - Physical Items lays no piece round a peer's body (the owner's own body is a source)`, async () => {
    const s = await scene(where);
    for (let i = 0; i < 5; i++) await settle();   // the puppet's body marker lands (async art): without it the pool leaves the body out for want of a marker, not for being a peer's
    const pup = s.mac.pool().foes.find((x) => x.puppet === s.bob.id && x.corpse);
    assert.ok(pup.corpseMarker, 'the peer\'s body has landed in Mac\'s world (guard)');
    assert.deepEqual(s.mac.pool().physicalCorpses().map((c) => c.key), [], 'T19: a peer\'s puppet body is no Physical Items source for the reader');
    assert.deepEqual(s.bob.pool().physicalCorpses().map((c) => c.key), [`foeCorpse:${s.rat.uid}`], 'the owner\'s own body is one');
  });
}

// ═══ R-1 - THE OWNER ANSWERS ON RECEIPT, NEVER ON A TICK (DESIGN-REVIEW R-1) ═════════════════════════════════════════════
for (const where of WHERES) {
  test(`R-1 AC2/AC4 [${where}]: the owner judges a claim and hands its verdict to the hit queue inside applyHit itself - with NO update tick - and answers a re-ask the same way`, async () => {
    const s = await scene(where);
    const caught = [];
    s.net.tamper = (from, to, data) => { if (from === MAC && Array.isArray(data.bq)) { caught.push(clone(data)); return null; } return data; };   // Mac's claim never reaches the owner by the relay: it is fed by hand
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'R-1/AC2');
    w.take(choosing(GREAVES));
    run(s.net, 100);
    s.net.tamper = null;
    assert.equal(caught.length, 1, 'R-1: Mac sent no claim frame (bq)');
    assert.equal(onBody(s).includes(GREAVES), true, 'the owner has not heard it: the Greaves is on the body (guard)');
    const said = verdictsTo(s, s.mac).length;
    s.bob.hit(s.mac.id, clone(caught[0]));   // the claim reaches applyHit - and nothing ticks
    assert.equal(verdictsTo(s, s.mac).length, said + 1, 'R-1: the owner did not hand his verdict to the hit queue inside applyHit - a seat that answers on its frame tick answers nothing while its tab sleeps');
    assert.equal(onBody(s).includes(GREAVES), false, 'and judged it there: the place is gone');
    s.bob.hit(s.mac.id, clone(caught[0]));   // a re-ask of the judged claim, with no tick either
    assert.equal(verdictsTo(s, s.mac).length, said + 2, 'R-1: a re-ask of a judged claim was not answered inside applyHit');
    const [first, again] = verdictsTo(s, s.mac).slice(-2);
    assert.deepEqual(again.bv, first.bv, 'and says what the first said');
  });
}

// ═══ R-2 - A DEAD LINK IS RECOVERED BY THE RE-ASK (DESIGN-REVIEW R-2) ════════════════════════════════════════════════════
/** Mac claims the Greaves; the owner's verdict is 0.5 s on the wire; Mac's socket goes half-open 100 ms after the press -
 *  still in the owner's roster, so the verdict is SENT and lost - for `outageMs`; then it comes back with the same id. */
async function deadLink(where, outageMs) {
  const s = await scene(where);
  s.net.late.set(dir(BOB, MAC), 500);
  const w = lootWindow(s.mac);
  pressOpens(s, s.mac, w, 'R-2/AC2');
  w.take(choosing(GREAVES));
  run(s.net, 100);
  assert.equal(claimsBy(s, s.mac).length, 1, 'R-2: Mac sent no claim frame (bq)');
  s.net.dead.add(s.mac.id);
  s.net.at(clock.t + outageMs, () => s.net.dead.delete(s.mac.id));
  await runLive(s.net, outageMs + SETTLED_MS);
  return s;
}
for (const where of WHERES) {
  test(`R-2 AC2 [${where}]: the verdict is sent and lost on a dead link, the taker's socket is down for 20 s and comes back with the same id - the re-ask is answered and the piece lands exactly once`, async () => {
    const s = await deadLink(where, 20_000);
    assert.ok(verdictsTo(s, s.mac).length >= 2, `R-2/AC2: the owner said his verdict once (into the dead link) and never again - ${verdictsTo(s, s.mac).length} verdict frames: the re-ask was not answered`);
    assert.equal(heldBy(s.mac, GREAVES), 1, 'R-2/AC2: the piece landed exactly once');
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  });

  test(`R-2 AC2 [${where}]: past CLAIM_KEEP_MS (5 min) of silence the claim is given up - nothing lands and nothing dupes`, async () => {
    const s = await deadLink(where, CLAIM_KEEP_MS + 60_000);
    assert.equal(claimsBy(s, s.mac).length >= 1, true, 'the claim was sent (guard)');
    assert.equal(heldBy(s.mac, GREAVES), 0, 'R-2/AC2: a verdict past CLAIM_KEEP_MS landed');
    assert.deepEqual(census(s).get(GREAVES), [], 'R-2/AC2: nothing dupes - the Greaves is on no body and in no pack: the grant the dead link swallowed is the recorded loss, never a second copy');
  });
}

// ═══ SLICE 1 CODE REVIEW (DESIGN-REVIEW.md "SLICE 1 CODE REVIEW", on f103d56fad) ═════════════════════════════════════════════
// Two holes the review found in the block, each pinned red first. Both are about the same recovery: a claim the owner JUDGED
// whose verdict never arrived is recovered by the claimer's re-ask, answered from the owner's ledger (R-2) - and these are the
// two ways that re-ask goes unanswered (S1-1) or a stale one is judged against the wrong body (S1-2).
/** The owner's verdict frames are lost in transit (judged, said, never heard): the claimer is left to re-ask. */
const loseVerdicts = (from, to, data) => (from === BOB && to === MAC && Array.isArray(data.bv) ? null : data);
/** The generation (`g`) the owner's stream says of `s`'s body: its digest entry [i, g, l, x], the newest from the relay's foes log index `from` on. */
const digestG = (s, from = 0) => s.net.foesLog.slice(from).filter((e) => e.from === s.bob.id && Array.isArray(e.frame.bw)).flatMap((e) => e.frame.bw).filter((d) => d[0] === s.rat.seq).at(-1)?.[1] ?? null;
/** Mac takes the Greaves from his window; the owner judges it ON RECEIPT and his verdict is lost on the wire - the claim a re-ask exists for. */
function takeAndLose(s, what) {
  s.net.tamper = loseVerdicts;
  const w = lootWindow(s.mac);
  pressOpens(s, s.mac, w, what);
  assert.ok(w.take(choosing(GREAVES)), 'Mac took the Greaves from the window (guard)');
  run(s.net, 300);
  assert.equal(verdictsTo(s, s.mac).length, 1, `${what}: the owner judged and said his verdict (bv), and the wire lost it`);
  assert.equal(heldBy(s.mac, GREAVES), 0, 'the verdict never reached Mac (guard)');
  assert.equal(onBody(s).includes(GREAVES), false, 'the owner judged it on receipt: the Greaves is off his body (guard)');
  return w;
}

// ── S1-1: a re-ask of a JUDGED claim is gated by the budget alone, never by the owner's pose list ─────────────────────────────
// `ownerClaims` returned before it read the verdict ledger when `!peerCandidate(from)` - the owner's pose list (`peers()`), which
// is not the roster. A claimer out of it (a cell crossed, a stale pose, a deck below) but still in the roster re-asks after
// losing the verdict frame, hears nothing, and the piece the owner already granted is lost. Only a NEW claim needs the pose list
// and the reach (A1/C7).
for (const where of WHERES) {
  test(`S1-1 AC2/AC3 [${where}]: the verdict is lost and the claimer drops out of the owner's pose list (peers()) while the relay's roster still holds it - the re-ask of the JUDGED claim is answered and the piece lands exactly once`, async () => {
    const s = await scene(where);
    takeAndLose(s, 'S1-1/AC2');
    s.net.unseen.add(MAC);   // out of the owner's pose list; in the roster, so a frame to it is accepted
    s.net.tamper = null;
    run(s.net, 20_000);
    assert.ok(verdictsTo(s, s.mac).length >= 2, `S1-1/AC2: the owner said his verdict once (into the loss) and never again - ${verdictsTo(s, s.mac).length} verdict frame(s): the re-ask of a claim he had judged was met with silence (the body block's ownerClaims returns at \`!peerCandidate(from)\` before it reads the verdict ledger - the pose list is not the roster)`);
    assert.equal(heldBy(s.mac, GREAVES), 1, 'S1-1/AC2: the piece landed exactly once');
    assert.deepEqual(misplaced(s), [], 'S1-1/AC2: every piece in exactly one place - the Greaves the owner granted is not on his body and not in a pack');
  });

  test(`S1-1 AC2 [${where}]: the owner's body is gone (off his list) and the claimer is out of his pose list - the re-ask of the judged claim is still answered (the verdict ledger outlives the body) and the piece lands exactly once`, async () => {
    const s = await scene(where);
    takeAndLose(s, 'S1-1/AC2');
    const list = s.bob.pool().foes;
    list.splice(list.indexOf(s.rat), 1);   // the body decays off the pool's list: ownBody(i) is null
    s.net.unseen.add(MAC);
    s.net.tamper = null;
    run(s.net, 20_000);
    assert.equal(heldBy(s.mac, GREAVES), 1, 'S1-1/AC2: with the body gone the re-ask of the judged claim was not answered (the pose-list gate stood before the ledger) - the Greaves is on no body and in no pack');
    assert.deepEqual(misplaced(s), [], 'S1-1/AC2: every piece in exactly one place');
  });

  test(`S1-1 AC3 [${where}]: the re-asks of a claimer out of the owner's pose list are answered under the owner's answer budget (BODY_ASKS_PER_S) and nothing else - sixteen in one instant are not all answered`, async () => {
    const s = await scene(where);
    takeAndLose(s, 'S1-1/AC3');
    const judged = claimsBy(s, s.mac)[0];
    s.net.unseen.add(MAC);
    s.net.tamper = null;
    const before = verdictsTo(s, s.mac).length;
    for (let i = 0; i < 16; i++) s.bob.hit(s.mac.id, clone(judged));
    const answered = verdictsTo(s, s.mac).length - before;
    assert.ok(answered >= 1, 'S1-1/AC3: a re-ask of a judged claim from a claimer out of the pose list was not answered at all');
    assert.ok(answered < 16, 'S1-1/AC3: the owner answered all sixteen frames in one instant - the unseen claimer\'s re-asks spend no answer budget (the gate that replaces the pose list is the budget, DESIGN.md 3.8)');
  });

  test(`S1-1 AC3 [${where}] (guard - passes today; A1/C7): a NEW claim from a claimer out of the owner's pose list is still not heard - the owner is silent and the blade stays on the body`, async () => {
    const s = await scene(where);
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'S1-1/A1-C7');
    s.net.unseen.add(MAC);   // Mac is in the roster, not in the pose list
    assert.ok(w.take(choosing(SHORTSWORD)), 'Mac takes the blade from his window (guard)');
    run(s.net, 20_000);
    assert.equal(claimsBy(s, s.mac).length >= 1, true, 'S1-1/A1-C7: Mac\'s claim reached the owner\'s door (no claim frame (bq) was sent)');
    assert.deepEqual(verdictsTo(s, s.mac), [], 'S1-1/A1-C7: a NEW claim from a peer the hunt does not see was answered');
    assert.equal(heldBy(s.mac, SHORTSWORD), 0, 'and the blade is not in the pack');
    assert.equal(onBody(s).includes(SHORTSWORD), true, 'and the blade is still on the body: nothing was judged');
  });
}

test('S1-1 AC2 [street]: the claimer CROSSES into the next cell after the verdict is lost (the owner\'s cell held as a halo, its puppets swept, the owner\'s pose list without it) - the re-ask is answered through the halo and the piece lands exactly once', async () => {
  const s = await scene('street');
  takeAndLose(s, 'S1-1/AC2');
  cross(s.mac);
  s.net.unseen.add(MAC);
  s.net.tamper = null;
  run(s.net, 20_000);
  assert.ok(verdictsTo(s, s.mac).length >= 2, `S1-1/AC2: the claimer crossed a seam and the owner answered its re-ask never - ${verdictsTo(s, s.mac).length} verdict frame(s)`);
  assert.equal(heldBy(s.mac, GREAVES), 1, 'S1-1/AC2: the piece landed exactly once, through the halo');
  assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
});

// ── S1-2: a body's identity - (owner, seq, g) - survives the OWNER's reload ─────────────────────────────────────────────────────
// The peer id outlives a page reload (net/online.js `peerId`, sessionStorage); a new pool restarts the foes' seq at one and the
// block's generation counter at one, so a body of the new page was the SAME (owner, seq, g) as a body of the old one. The reader
// then MERGED the new body's digest into the old body's state (the old records shown, claimed and given for the new body), and
// the owner judged an old body's re-ask as a NEW claim against the new body's place. Each pool now seeds its generation, a claim
// frame names it (a top-level `g`, the digest's own) and a NEW claim is judged only against the body it names.
for (const where of WHERES) {
  test(`S1-2 AC6 [${where}]: a claim frame names the generation of the body it is made on - a top-level g, the digest's own - and its entries stay {id, p, n}`, async () => {
    const s = await scene(where);
    const g = digestG(s);
    assert.ok(Number.isSafeInteger(g) && g >= 0, 'the owner\'s stream names the body\'s generation as a whole number (guard)');
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'S1-2/AC6');
    assert.equal(w.takeAll().moved, 3, 'Take all moved all three rows (guard)');
    run(s.net, 400);
    const claims = claimsBy(s, s.mac);
    assert.equal(claims.length, 1, 'S1-2/AC6: Mac sent no claim frame (bq)');
    assert.equal(claims[0].g, g, `S1-2/AC6: the claim frame names generation ${JSON.stringify(claims[0].g)} where the owner's digest says ${g} - the owner cannot tell which body of this (owner, seq) the claim was made on`);
    assert.deepEqual(claims[0].bq.map((c) => Object.keys(c).sort()), [['id', 'n', 'p'], ['id', 'n', 'p'], ['id', 'n', 'p']], 'S1-2/AC6: the claim entries keep their shape {id, p, n}');
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  });

  test(`S1-2 AC6 [${where}]: the owner's page reloads (the same peer id, a new pool, the seq from one again) - his new body does not carry the generation the old pool's first body did: (owner, seq, g) names ONE body`, async () => {
    const s = await scene(where, [MAC]);
    const oldG = digestG(s);
    assert.ok(Number.isSafeInteger(oldG), 'the old pool\'s body has a generation (guard)');
    const r = await reloadOwner(s, PILE2);
    run(r.net, 3000);
    assert.equal(r.rat.seq, s.rat.seq, 'the new pool numbers its first foe from one again - the same (owner, seq) as the old body (guard)');
    const newG = digestG(r, r.since);
    assert.ok(Number.isSafeInteger(newG), 'the reloaded owner\'s stream names his new body\'s generation (guard)');
    assert.notEqual(newG, oldG, `S1-2/AC6: the reloaded owner's first body carries generation ${newG}, the old page's first body carried ${oldG} - the block's generation counter starts over at every page load, so (owner, seq, g) names two bodies`);
  });

  test(`S1-2(a) AC1/AC6 [${where}]: the reader holds the state of the owner's old body when his page reloads - his new body (the same seq) dies and streams: the reader's plaque lists the NEW body's records and none of the old`, async () => {
    const s = await scene(where, [MAC]);
    assert.deepEqual(rowsOf(s.mac.holds(s.keyOf(s.mac))), rowsOf(s.rat.entity.items), 'Mac has read the old body (guard)');
    const r = await reloadOwner(s, PILE2);
    run(r.net, 3000);
    const want = rowsOf(r.rat.entity.items);
    assert.notDeepEqual(want, rowsOf(s.body), 'the new body holds other pieces than the old (guard)');
    const got = rowsOf(r.mac.holds(r.keyOf(r.mac)));
    assert.deepEqual(got, want, `S1-2(a)/AC1: Mac's plaque lists ${JSON.stringify(got)} where the reloaded owner's new body holds ${JSON.stringify(want)} - the new body's digest named the same (owner, seq) and the same generation, so hear() MERGED it into the old body's state and the old records are shown`);
  });

  test(`S1-2(a) AC2/AC3 [${where}]: ... and Take all through that reader's view lands the NEW body's pieces - each of them in exactly one place`, async () => {
    const s = await scene(where, [MAC]);
    const r = await reloadOwner(s, PILE2);
    run(r.net, 3000);
    const w = lootWindow(r.mac);
    pressOpens(r, r.mac, w, 'S1-2(a)/AC3');
    assert.equal(w.takeAll().moved, 3, 'Take all moved all three rows (guard)');
    run(r.net, 3000);
    assert.deepEqual(misplaced(r), [], 'S1-2(a)/AC3: the reader claimed the places of the OLD body\'s pieces and was handed those old objects - the new body\'s pieces went to nobody');
    for (const k of [GOLD, BROADSWORD, PINE]) assert.ok(heldBy(r.mac, k) >= 1, `S1-2(a)/AC3: Mac holds ${k}`);
    assert.deepEqual(onBody(r), [], 'and the new body is empty of shared pieces');
  });

  test(`S1-2(b) AC2/AC3 [${where}]: the owner's page reloads with a claim of Mac's judged and its verdict lost - Mac's re-ask, still naming the OLD body's generation, reaches the NEW body of the same seq with Mac in reach: nothing is judged, and the new body keeps every piece`, async () => {
    const s = await scene(where, [MAC]);
    takeAndLose(s, 'S1-2(b)/AC2');
    const id = claimsBy(s, s.mac)[0].bq[0].id;
    const oldG = digestG(s);
    const said = verdictsTo(s, s.mac).length;
    s.net.tamper = null;
    const r = await reloadOwner(s, PILE2);
    assert.equal(r.rat.seq, s.rat.seq, 'the new pool numbers its first foe from one again - the same (owner, seq) as the old body (guard)');
    const reloadedAt = clock.t;
    run(r.net, 30_000);
    const reasks = r.net.log.filter((e) => e.from === MAC && e.to === BOB && e.at > reloadedAt && Array.isArray(e.data.bq) && e.data.bq.some((c) => c.id === id));
    assert.ok(reasks.length >= 1, 'S1-2(b): Mac asked again, with the same id, after the reload and with the new body standing - the claim is kept for CLAIM_KEEP_MS (guard)');
    assert.equal(verdictsTo(r, r.mac).length, said, 'S1-2(b)/AC3: the reloaded owner JUDGED a re-ask made on his old body - it named no generation, or the old one, and he took it as a new claim on his new body\'s place');
    assert.deepEqual(r.rat.entity.items.map(pieceOf).sort(), r.body.map(pieceOf).sort(), 'S1-2(b)/AC3: the new body lost a piece to a claim made on the old one - it went to nobody');
    assert.equal(heldBy(r.mac, GREAVES) + heldBy(r.mac, BROADSWORD) + heldBy(r.mac, PINE), 0, 'S1-2(b)/AC3: Mac was handed a piece for a claim the old page granted (the lifted object the claim gives back)');
    assert.ok(reasks.every((e) => e.data.g === oldG), `S1-2(b)/AC6: the re-ask names the generation of the body the claim was made on (${oldG}), not the body that stands now: ${JSON.stringify(reasks.map((e) => e.data.g))}`);
  });

  test(`S1-2(b) AC2/AC3 [${where}]: an OLD claim and a NEW claim come due in one round of re-asks - they are said in frames of their own, each naming the generation of the body it was made on, so the new body judges the new claim and lets the old one be`, async () => {
    const s = await scene(where, [MAC]);
    takeAndLose(s, 'S1-2(b)/AC2');
    const oldId = claimsBy(s, s.mac)[0].bq[0].id;
    const oldAt = s.net.log.find((e) => e.from === MAC && e.to === BOB && Array.isArray(e.data.bq)).at;   // the old claim is made and said
    const oldG = digestG(s);
    let lost = 0;
    s.net.tamper = (from, to, data) => (from === MAC && Array.isArray(data.bq) && !data.bq.some((c) => c.id === oldId) && lost++ === 0 ? null : data);   // the NEW claim's first saying is lost: its owner first hears it in the round it comes due
    const reloaded = s.net.log.length;
    const r = await reloadOwner(s, PILE2);
    assert.ok(clock.t < oldAt + 4000, 'the reload took less than four seconds of the old claim\'s life (guard)');
    run(r.net, oldAt + 4500 - clock.t);   // Mac reads the new body: its stream, a peek
    const w = lootWindow(r.mac);
    pressOpens(r, r.mac, w, 'S1-2(b)/AC2');
    run(r.net, oldAt + 5950 - clock.t);
    assert.ok(w.take(choosing(BROADSWORD)), 'Mac takes the broadsword from the new body\'s window (guard)');
    run(r.net, 50);   // the new claim is made at oldAt + 6000 and said: that first saying is lost, so it is next said at oldAt + 7000 - when the old claim is said for the third time
    assert.equal(lost, 1, 'the new claim was said, and the wire lost that first saying (guard)');
    run(r.net, 3000);
    const verdicts = r.net.log.slice(reloaded).filter((e) => e.from === BOB && e.to === MAC && Array.isArray(e.data.bv)).flatMap((e) => e.data.bv.map((v) => v[0]));   // what the reloaded owner judged
    assert.equal(verdicts.includes(oldId), false, 'S1-2(b)/AC3: the reloaded owner judged the old claim (a re-ask of the old page\'s body) against his new body');
    const asks = (id) => r.net.log.filter((e) => e.from === MAC && e.to === BOB && Array.isArray(e.data.bq) && e.data.bq.some((c) => c.id === id));
    assert.deepEqual(asks(oldId).map((e) => e.at - oldAt), [0, 1000, 3000, 7000], 'the old claim is said again at 1 s, 3 s and 7 s (CLAIM_RESEND_MS, doubling) - the round this pin aims the new claim\'s second saying at (guard)');
    const newId = r.net.log.slice(reloaded).find((e) => e.from === MAC && e.to === BOB && Array.isArray(e.data.bq) && !e.data.bq.some((c) => c.id === oldId)).data.bq[0].id;
    const round = r.net.log.filter((e) => e.from === MAC && e.to === BOB && Array.isArray(e.data.bq) && e.at === oldAt + 7000);
    assert.equal(round.length, 2, `S1-2(b)/AC6: ${round.length} claim frame(s) in the round both claims come due in - a claim frame names ONE body's generation, so claims of two bodies of one (owner, seq) go in frames of their own`);
    assert.equal(round.find((e) => e.data.bq.some((c) => c.id === oldId))?.data.g, oldG, 'S1-2(b)/AC6: the old claim\'s frame names the generation of the body it was made on');
    assert.equal(round.find((e) => e.data.bq.some((c) => c.id === newId))?.data.g, digestG(r, r.since), 'S1-2(b)/AC6: and the new claim\'s frame the generation of the body that stands');
    assert.ok(verdicts.includes(newId), 'S1-2(b)/AC3: the new owner never judged the new claim');
    assert.equal(heldBy(r.mac, BROADSWORD), 1, 'the new claim landed the broadsword, once');
    assert.deepEqual(misplaced(r), [], 'every piece of the new body in exactly one place');
    assert.equal(heldBy(r.mac, GREAVES), 0, 'and the old claim landed nothing');
  });

  test(`S1-2(b) AC3 [${where}]: a NEW claim is judged only against the body it names - another generation, or none, is silence and burns no place; the generation the digest says is judged on receipt`, async () => {
    const s = await scene(where);
    const g = digestG(s);
    assert.ok(Number.isSafeInteger(g), 'the owner\'s stream names the body\'s generation (guard)');
    const caught = [];
    s.net.tamper = (from, to, data) => { if (from === MAC && Array.isArray(data.bq)) { caught.push(clone(data)); return null; } return data; };   // Mac's claim never reaches the owner by the relay: it is fed by hand
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'S1-2(b)/AC3');
    w.take(choosing(GREAVES));
    run(s.net, 100);
    s.net.tamper = null;
    assert.equal(caught.length, 1, 'S1-2(b): Mac sent no claim frame (bq)');
    const said = verdictsTo(s, s.mac).length;
    s.bob.hit(s.mac.id, { ...clone(caught[0]), g: g + 1 });   // a claim made on another body of this number
    const noG = clone(caught[0]); delete noG.g;
    s.bob.hit(s.mac.id, noG);   // and one that names no body at all
    assert.equal(verdictsTo(s, s.mac).length, said, 'S1-2(b)/AC3: the owner answered a claim that names another body\'s generation, or none');
    assert.equal(onBody(s).includes(GREAVES), true, 'S1-2(b)/AC3: the owner judged it - the place is gone, and the piece went to a claim made on another body');
    s.bob.hit(s.mac.id, { ...clone(caught[0]), g });   // the body's own generation
    assert.equal(verdictsTo(s, s.mac).length, said + 1, 'S1-2(b)/AC3: the claim that names the body\'s generation is judged on receipt');
    assert.equal(onBody(s).includes(GREAVES), false, 'and the place is gone');
  });

  test(`S1-2 AC3 [${where}] (guard - passes today): a re-ask of a claim the owner JUDGED is answered from his verdict ledger whatever generation it names - the ledger is his own word, kept for the claimer`, async () => {
    const s = await scene(where);
    const g = digestG(s);
    const w = lootWindow(s.mac);
    pressOpens(s, s.mac, w, 'S1-2/AC3');
    w.take(choosing(GREAVES));
    run(s.net, 400);
    assert.equal(heldBy(s.mac, GREAVES), 1, 'the claim was judged and landed (guard)');
    const judged = claimsBy(s, s.mac)[0];
    const first = verdictsTo(s, s.mac)[0];
    const before = verdictsTo(s, s.mac).length;
    s.bob.hit(s.mac.id, { ...clone(judged), g: g + 1 });
    assert.equal(verdictsTo(s, s.mac).length, before + 1, 'S1-2/AC3: a re-ask of a judged claim that names another generation was not answered from the ledger');
    assert.deepEqual(verdictsTo(s, s.mac).at(-1).bv, first.bv, 'and says what the first said');
    assert.equal(heldBy(s.mac, GREAVES), 1, 'and the piece is still in the pack once');
  });
}

// ═══ AUDIT OUTDOOR-LOOT (2026-10-18, PR #1019's audit) - THE READER'S EDGES ═══════════════════════════════════════════════
// B1: a piece the taker lays into another player's kill is handed back at the close - but the close's arm for a body no longer
// there (its owner left, went stale past FOES_STALE_MS, reloaded) lifted the window's takes and RETURNED before the hand-back:
// what was laid in was destroyed (a Stash all, the whole pack). B2: a body that turns UNBORN or UNREADABLE under an open window
// (its owner lays a new piece on it) settled nothing from then on - a take made then was never claimed, and a second taker was
// granted the same piece. B3: re-asks to an owner who has left sat at the head of the taker's hit queue (sendHit refuses a `to`
// not in the roster) and held every frame behind them.
const heldOf = (p, piece) => p.entity.items.filter((it) => pieceOf(it) === piece).reduce((n, it) => n + (it.stackCount ?? 1), 0);
for (const where of WHERES) {
  test(`AUDIT OUTDOOR-LOOT B1 [${where}]: a piece laid into a peer's body comes home at the close when the owner has LEFT - it was destroyed`, async () => {
    const s = await scene(where);
    const mine = { ...PILE2()[1] };   // Mac's own broadsword - not a piece of Bob's body
    assert.equal(pieceOf(mine), BROADSWORD);
    s.mac.entity.items.push(mine);
    const w = lootWindow(s.mac);
    s.mac.press(s.keyOf(s.mac), w);
    assert.equal(w.opened.length, 1, 'the window opens (guard)');
    assert.ok(w.store(mine), 'the store moved (guard)');
    run(s.net, 100);
    assert.equal(heldOf(s.mac, BROADSWORD), 0, 'the broadsword is in the window (guard)');
    leave(s.bob); run(s.net, 400);
    w.close();
    run(s.net, SETTLED_MS);
    assert.equal(heldOf(s.mac, BROADSWORD), 1, `B1: Mac's own Broadsword is back in his pack (${heldOf(s.mac, BROADSWORD)})`);
  });

  test(`AUDIT OUTDOOR-LOOT B1 [${where}]: a Stash all into a peer's body comes home whole when the owner went STALE under the window`, async () => {
    const s = await scene(where);
    const mine = PILE2().slice(1).map((it) => ({ ...it }));   // Mac's own broadsword and pine branch
    s.mac.entity.items.push(...mine);
    const had = s.mac.entity.items.map(pieceOf).sort();
    const w = lootWindow(s.mac);
    s.mac.press(s.keyOf(s.mac), w);
    assert.equal(w.opened.length, 1, 'the window opens (guard)');
    w.stashAll([...s.mac.entity.items]);
    assert.equal(s.mac.entity.items.length, 0, 'Stash all moved the whole pack into the window (guard)');
    run(s.net, 100);
    s.net.dead.add(s.bob.id);   // Bob's tab hidden: no foes frames past FOES_STALE_MS
    run(s.net, FOES_STALE_MS + 1000);
    w.close();
    s.net.dead.delete(s.bob.id);
    run(s.net, SETTLED_MS);
    assert.deepEqual(s.mac.entity.items.map(pieceOf).sort(), had, 'B1: Mac\'s pack comes back whole');
  });

  test(`AUDIT OUTDOOR-LOOT B2 [${where}]: a take from a body that turned UNREADABLE under the open window is still claimed - one Greaves, one holder`, async () => {
    const newer = (from, to, data) => {
      if (to === MAC && Array.isArray(data.br)) data.br = data.br.map(([p, r]) => (p >= 3 ? [p, { templateIndex: 999999 }] : [p, r]));   // the new place, from a newer build
      return data;
    };
    const s = await scene(where, [MAC, EVE], { tamper: newer });
    const w = lootWindow(s.mac);
    s.mac.press(s.keyOf(s.mac), w);
    assert.equal(w.opened.length, 1, 'Mac\'s window stands over the born body (guard)');
    s.rat.entity.items.push({ ...PILE2()[2] });   // Bob lays a piece on his own body: place 3, which Mac cannot read
    run(s.net, 2000);
    assert.ok(w.take(choosing(GREAVES)), 'Mac takes the Greaves in his still-open window (guard)');
    run(s.net, 500);
    w.close();
    run(s.net, 1000);
    assert.ok(claimsBy(s, s.mac).length > 0, 'B2: Mac claimed the Greaves');
    const we = lootWindow(s.eve);
    s.eve.press(s.keyOf(s.eve), we);
    we.take(choosing(GREAVES));
    we.close();
    run(s.net, SETTLED_MS);
    assert.deepEqual(misplaced(s), [], 'B2: every piece in exactly one place');
  });

  test(`AUDIT OUTDOOR-LOOT B2 [${where}]: a take from a body that turned UNBORN under the window (its one peek answer lost, the taker walked off) is still claimed`, async () => {
    let lost = 0;
    const loseOne = (from, to, data) => {
      if (to === MAC && Array.isArray(data.br) && data.br.some(([p]) => p >= 3) && lost < 1) { lost++; return null; }
      return data;
    };
    const s = await scene(where, [MAC, EVE], { tamper: loseOne });
    const w = lootWindow(s.mac);
    s.mac.press(s.keyOf(s.mac), w);
    assert.equal(w.opened.length, 1, 'the window stands (guard)');
    s.rat.entity.items.push({ ...PILE2()[2] });   // Bob lays a piece on his own body: place 3
    run(s.net, 600);
    assert.equal(lost, 1, 'the one answer was lost (guard)');
    assert.ok(w.take(choosing(GREAVES)), 'Mac takes the Greaves (guard)');
    w.close();
    s.mac.feet[0] += 40;   // out of BODY_PEEK_REACH before the re-peek
    run(s.net, 3000);
    const we = lootWindow(s.eve);
    s.eve.press(s.keyOf(s.eve), we);
    we.take(choosing(GREAVES));
    we.close();
    run(s.net, SETTLED_MS);
    assert.deepEqual(misplaced(s), [], 'B2: every piece in exactly one place');
  });
}

for (const where of WHERES) {
  test(`AUDIT OUTDOOR-LOOT S1-4 [${where}]: a piece the OWNER lays on his own body becomes a place of it - a peer reads it, takes it, and it is his once`, async () => {
    const s = await scene(where);
    s.rat.entity.items.push({ ...PILE2()[2] });   // Bob lays a pine branch on his own body - a piece the body did not hold
    run(s.net, 2000);   // the digest says a new place; Mac peeks it
    const w = lootWindow(s.mac);
    s.mac.press(s.keyOf(s.mac), w);
    assert.equal(w.opened.length, 1, 'the window opens (guard)');
    assert.ok(w.take(choosing(PINE)), 'S1-4: Mac\'s window lists the pine Bob laid, and takes it');
    w.close();
    run(s.net, SETTLED_MS);
    assert.equal(heldOf(s.mac, PINE), 1, 'S1-4: the pine is Mac\'s');
    assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  });
}

test('AUDIT OUTDOOR-LOOT B3 [street]: re-asks to an owner who LEFT never hold the taker\'s hit queue - a blow to a peer who is here goes at once', async () => {
  const s = await scene('street', [MAC, EVE]);
  const w = lootWindow(s.mac);
  s.mac.press(s.keyOf(s.mac), w);
  s.net.hold(dir(s.mac.id, s.bob.id));   // Mac's claim is slow on the wire...
  assert.ok(w.take(choosing(GREAVES)), 'Mac takes the Greaves (guard)');
  w.close();
  run(s.net, 100);
  leave(s.bob);   // ...and Bob leaves before it lands
  s.net.release(dir(s.mac.id, s.bob.id));
  run(s.net, 5000);
  let sent = 0, blocked = 0;
  for (let t = 0; t < 60_000; t += 50) {
    if (t % 1000 === 0) s.mac.pend.send({ to: s.eve.id, k: 'world:3,12', i: 999, dmg: 1 }, { sent: () => { sent++; }, dropped: () => {} });
    run(s.net, 50);
    if (s.mac.pend.held > 0) blocked++;
  }
  assert.equal(sent, 60, 'B3: every blow to Eve went');
  assert.equal(blocked, 0, `B3: Mac's hit queue was held ${(blocked * 50 / 1000).toFixed(1)} s by re-asks to an owner who is not here`);
});
