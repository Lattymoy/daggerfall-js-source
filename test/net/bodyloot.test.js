// OUTDOOR-LOOT (2026-10-17, the field: "I can still click on an "Empty" body and wipe out loot for a party member" -
// outdoors, a monster that appeared later). RED PINS, PHASE 1: what a party member's press on ANOTHER player's foe's body
// must do, pinned through the doors the code has today and nothing the fix has yet to name. A foe outdoors is its
// spawner's (WORLD6b); everyone else stands a PUPPET of it, and its body is the owner's roll taken under the owner's word
// (WORLD6b-iii(c), bible/06-Systems/Online-Arc.md). Reproduced on the real pools (test-harness/outdoor-loot, and two real
// browsers over the real relay), today:
//   1. THE PLAQUE - the puppet's contents door answers null (exteriorFoes.js `const hoverContents = (key) =>`), and the
//      plaque draws "Empty" over a full body (worldHover.js resolveHover).
//   2. THE PRESS - the puppet arm of `function takeLoot(key, say2 = () => {}, openWindow = null)` opens no window and asks
//      for the body; the owner's `function grantCorpse(f, to, k)` hands over as much of the WHOLE pile as one frame
//      carries. The clicker chooses nothing, and the owner's body is emptied.
//   3. THE LATE GRANT - `function applyHit(from, data)` refuses a grant more than TAKE_WINDOW_MS (3000) after the ask
//      (`if (!asked) return false;`) and says nothing back; the owner has already taken the pieces off the body, and puts
//      them back only on the frame's `dropped` fate or a `back` frame. The loot is destroyed.
//   4. A BUILDING runs the same pool (worldModes.js `function makeInteriorFoes(ctx)`, its own lane's net), so all three
//      hold indoors.
//
// MOUNTED, NOT MATCHED. Each player here is a real pool (createExteriorFoes over a crafted MONSTER.BSA - the street's as
// test/net/world6biiic.test.js stands it; a building's as worldModes.js wires it, its functions and members sliced out of
// the host), behind the REAL hit queue (net/hitPend.js makeHitPend - LOOT-DUP's), on a controllable clock, joined by a
// relay stand-in that carries the two lanes a pool speaks today - its foes frames (foesFrame -> applyFoes) and its hits
// (onPeerHit -> applyHit, routed by `to`) - each direction with its own lateness, a player able to leave the cell or drop
// off the socket. The plaque is the real resolveHover over the pool's own namer and contents doors (world.js's ladder);
// the press is the pool's own takeLoot (a building's: worldModes.js openInteriorBodyLoot) handed a WINDOW STAND-IN: it
// records any window the press opens and takes ONE chosen piece from it as a click would - the loot window's own
// transfer (itemTransfer.js planTake + applyTransfer) out of the hooks' `items()`, the array a loot window shows and
// mutates. Nothing here reads a frame's fields: every assertion is about where the pieces ARE once every timeout has
// passed - the owner's body, the owner's pack or a taker's pack, each piece in exactly one of them.
//
// Run against the tree at 02706035cf: the AC1, AC4, AC5 and late/leave AC2 pins fail by their assertions; the guards
// (named so) pass, and must stay green through the fix.
//
// SLICE 1 (test/net/bodyloot_protocol.test.js is its pins; the harness moved to ./bodyLootHarness.mjs, nothing in it
// changed for these): DESIGN-REVIEW D-1 - "whatever the current dungeon logic is doing on main we want to replicate" - makes a
// claim still in flight and not lapsed when its claimer leaves go WITH the claimer, and withdraws the void. Three guards of
// this file said the opposite and were re-aimed (each fails today by its assertion, and lost "guard - passes today"):
// the taker leaving before the owner's answer can leave him, street and building - the pieces are no longer back on the
// owner's body, the Greaves is in the taker's pack - and the R1 teardown, from "no piece lands twice" to "exactly one
// place: the taker's pack".
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { REALM_LETTER_TEMPLATE } from '../../src/net/realm/realmGoldLaw.js';
import { quickLootTake, foldQuickLoot, quickLootWheel, resetQuickLoot } from '../../src/systems/quickLoot.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { isGoldPieces } from '../../src/systems/inventory.js';
import {
  FOES_FULL_MS, PILE, pieceOf, nameOf, GREAVES, SHORTSWORD, GOLD, restoreRandom, scene, windowFor, choosing, census, misplaced, plaque, saysEmpty,
  SETTLED_MS, run, lateCase, midClaim, leave, cross, drop,
} from './bodyLootHarness.mjs';

// The harness (the cell, the relay stand-in, the pools, the window stand-ins, the census) moved into ./bodyLootHarness.mjs
// when slice 1's protocol pins (test/net/bodyloot_protocol.test.js) came to share it. Nothing in it changed for these pins.
afterEach(restoreRandom);

// ═══ AC1 - THE PLAQUE ═════════════════════════════════════════════════════════════════════════════════════════════════

test('AC1: a party member\'s plaque over another player\'s foe\'s body never says "Empty" while the owner\'s word says it holds something (record o > 0) - right after the body falls, and after the owner took part of it', async () => {
  const s = await scene('street');
  const key = s.keyOf(s.mac);
  const pup = s.mac.pool().foes.find((x) => x.puppet === s.bob.id && x.corpse);
  assert.equal(pup._pup.o, 3, 'the owner\'s word: the body holds three');
  assert.ok(s.mac.pool().lootTargets().some((t) => t.key === key), 'the body is a loot target, so the plaque stands over it (guard)');
  const f = plaque(s.mac, key);
  assert.ok(f?.title, 'the plaque names the body');
  assert.equal(saysEmpty(f), false, 'AC1: Mac\'s plaque says "Empty" over Bob\'s body while Bob\'s word says it holds 3 - the puppet\'s contents door answers null (exteriorFoes.js hoverContents) and the plaque reads null as empty (worldHover.js resolveHover)');
  // the owner takes the Greaves through his own window; his word falls to two, and Mac's plaque still says it holds something
  const w = windowFor(s.bob, choosing(GREAVES));
  s.bob.press(`foeCorpse:${s.rat.uid}`, w);
  run(s.net, FOES_FULL_MS + 400, [w]);
  assert.equal(pup._pup.o, 2, 'the owner\'s word: two left (guard)');
  assert.equal(saysEmpty(plaque(s.mac, key)), false, 'AC1: after the owner\'s own take his word says 2 and Mac\'s plaque says "Empty"');
});

// ═══ AC4 - NO BLIND GRAB ══════════════════════════════════════════════════════════════════════════════════════════════

test('AC4: no blind grab - a party member\'s press on another player\'s foe\'s body opens a window on it, and the ONE piece taken from that window (the Greaves) is the only piece that leaves the owner\'s body; the coin and the blade stay on it', async () => {
  const s = await scene('street');
  const w = windowFor(s.mac, choosing(GREAVES));
  s.mac.press(s.keyOf(s.mac), w);
  run(s.net, 10_000, [w]);
  assert.deepEqual(misplaced(s), [], 'AC2 holds under it: every piece in exactly one place');
  const onBody = s.rat.entity.items.map(pieceOf).sort();
  const took = census(s);
  assert.ok(w.opened.length >= 1, `AC4: the press opened NO window - exteriorFoes.js takeLoot's puppet arm asks the owner for the body (take: 1) and grantCorpse hands over the whole pile; the owner's body went from ${s.body.length} pieces to ${onBody.length}, and ${s.mac.id} holds ${[...took].filter(([, at]) => at.some(([where]) => where.startsWith(s.mac.id))).map(([k]) => nameOf(s.body, k)).join(', ') || 'nothing'}`);
  assert.deepEqual(onBody, [GOLD, SHORTSWORD].sort(), `AC4: only the chosen piece may leave the owner's body - it holds ${JSON.stringify(s.rat.entity.items.map((it) => it.name))}`);
  assert.deepEqual(took.get(GREAVES), [[`${s.mac.id}'s pack`, 1]], 'and the chosen piece is in the taker\'s pack, once');
});

// ═══ AC2 - NOTHING IS DESTROYED ═══════════════════════════════════════════════════════════════════════════════════════
test('AC2 (guard - passes today): the owner\'s answer on time - once every timeout has passed, each piece of the body is in exactly one place (the owner\'s body, the owner\'s pack or the taker\'s pack)', async () => {
  const s = await lateCase('street');
  assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  assert.deepEqual(census(s).get(GREAVES), [[`${s.mac.id}'s pack`, 1]], 'AUDIT OUTDOOR-LOOT L1: and the taker has it - nothing misplaced is no proof anything was taken');
});

test('AC2: nothing is destroyed when the owner\'s answer is 3.5 s late (the e2e\'s arm: a grant held 3.5 s destroyed a Wakazashi)', async () => {
  const s = await lateCase('street', { answerLate: 3500 });
  assert.deepEqual(misplaced(s), [], 'AC2: an answer 3.5 s late - the taker refuses a grant past TAKE_WINDOW_MS and says nothing back (exteriorFoes.js applyHit `if (!asked) return false;`), and the owner already took the pieces off the body: destroyed');
  assert.deepEqual(census(s).get(GREAVES), [[`${s.mac.id}'s pack`, 1]], 'AUDIT OUTDOOR-LOOT L1: and the taker has it - nothing misplaced is no proof anything was taken');
});

test('AC2: nothing is destroyed when the owner\'s answer is 10 s late', async () => {
  const s = await lateCase('street', { answerLate: 10_000 });
  assert.deepEqual(misplaced(s), [], 'AC2: an answer 10 s late - refused past TAKE_WINDOW_MS, never returned (GRANT_BACK_MS passed with no `back`): destroyed');
  assert.deepEqual(census(s).get(GREAVES), [[`${s.mac.id}'s pack`, 1]], 'AUDIT OUTDOOR-LOOT L1: and the taker has it - nothing misplaced is no proof anything was taken');
});

test('AC2: nothing is destroyed when the owner\'s answer is 30 s late', async () => {
  const s = await lateCase('street', { answerLate: 30_000 });
  assert.deepEqual(misplaced(s), [], 'AC2: an answer 30 s late - refused past TAKE_WINDOW_MS, never returned: destroyed');
  assert.deepEqual(census(s).get(GREAVES), [[`${s.mac.id}'s pack`, 1]], 'AUDIT OUTDOOR-LOOT L1: and the taker has it - nothing misplaced is no proof anything was taken');
});

test('AC2: nothing is destroyed when the taker\'s ask reaches the owner 10 s late (the owner answers an ask the taker has stopped waiting for)', async () => {
  const s = await lateCase('street', { askLate: 10_000 });
  assert.deepEqual(misplaced(s), [], 'AC2: an ask 10 s late - the owner grants on arrival, the taker\'s ask latch (TAKE_WINDOW_MS from the send) has lapsed and refuses the grant: destroyed');
  assert.deepEqual(census(s).get(GREAVES), [[`${s.mac.id}'s pack`, 1]], 'AUDIT OUTDOOR-LOOT L1: and the taker has it - nothing misplaced is no proof anything was taken');
});

test('AC2: nothing is destroyed when the TAKER crosses into the next cell mid-claim (the owner\'s answer in flight, his cell still held as a halo, the taker\'s puppets of it swept) - the answer lands, and each piece is in exactly one place', async () => {
  const s = await midClaim('street', (x) => cross(x.mac));
  assert.deepEqual(misplaced(s), [], 'AC2: the taker crossed a seam with the owner\'s grant in flight - the grant arrives through the halo, but the grant arm needs the puppet (`_pupIndex.get(pupKey(from, data.i | 0))`), which the crossing swept: refused, and the owner already took the pieces off the body: destroyed');
  assert.deepEqual(census(s).get(GREAVES), [[`${s.mac.id}'s pack`, 1]], 'AUDIT OUTDOOR-LOOT L1: and the taker has it - nothing misplaced is no proof anything was taken');
});

test('AC2 (D-1): the TAKER leaves the cell before the owner\'s answer can leave him (the owner\'s wire held) - its claim was in flight and not lapsed at the leave, so it KEEPS the piece (PARTY-LOOT\'s own rule, DESIGN-REVIEW D-1); the owner\'s verdict ages out in his queue, un-voided: the Greaves is in exactly one place, the taker\'s pack', async () => {
  const s = await scene('street');
  s.net.shut.add(s.bob.id);
  const w = windowFor(s.mac, choosing(GREAVES));
  s.mac.press(s.keyOf(s.mac), w);
  run(s.net, 200, [w]);
  leave(s.mac);
  s.net.shut.delete(s.bob.id);
  run(s.net, SETTLED_MS, [w]);
  assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  assert.deepEqual(census(s).get(GREAVES), [[`${s.mac.id}'s pack`, 1]], 'D-1: the taker left with its claim in flight and not lapsed - it keeps the piece (the pool\'s room-change teardown gives it back to the taker\'s entity), and the owner\'s grant stands: the Greaves is in the taker\'s pack, not back on the owner\'s body (a verdict is final; the void is withdrawn)');
  assert.deepEqual(s.rat.entity.items.map(pieceOf).sort(), [GOLD, SHORTSWORD].sort(), 'and the owner\'s body is without it');
});

test('AC2/AC3 (R1, D-1): the TAKER vanishes from the relay the moment the owner\'s answer is on the wire - its teardown keeps the claim in flight (PARTY-LOOT\'s own rule): the Greaves is in exactly one place, the taker\'s pack - never two, never none', async () => {
  const s = await midClaim('street', (x) => leave(x.mac));
  assert.deepEqual(misplaced(s), [], 'every piece in exactly one place - the claim in flight went with its claimer; the grant it was answered with was lost on the wire, and the owner voids nothing');
  assert.deepEqual(census(s).get(GREAVES), [[`${s.mac.id}'s pack`, 1]], 'D-1: and that one place is the taker\'s pack');
});

test('AC2: nothing is destroyed when the TAKER\'s socket drops mid-claim and comes back - once every timeout has passed, each piece is in exactly one place', async () => {
  const s = await midClaim('street', (x) => drop(x.net, x.mac, 8000));
  assert.deepEqual(misplaced(s), [], 'AC2: the taker dropped off the socket mid-claim - the grant is lost on the wire and the owner never puts the pieces back: destroyed');
  assert.deepEqual(census(s).get(GREAVES), [[`${s.mac.id}'s pack`, 1]], 'AUDIT OUTDOOR-LOOT L1: and the taker has it - nothing misplaced is no proof anything was taken');
});

test('AC2: nothing is destroyed when the OWNER leaves the cell mid-claim (his answer in flight) - once every timeout has passed, each piece is in exactly one place', async () => {
  const s = await midClaim('street', (x) => leave(x.bob));
  assert.deepEqual(misplaced(s), [], 'AC2: the owner left with his grant in flight - the taker prunes the owner\'s puppets, refuses the grant for a body it no longer stands, and the pieces are on no body and in no pack: destroyed');
  assert.deepEqual(census(s).get(GREAVES), [[`${s.mac.id}'s pack`, 1]], 'AUDIT OUTDOOR-LOOT L1: and the taker has it - nothing misplaced is no proof anything was taken');
});

test('AC2 (guard - passes today): the OWNER leaves the cell before the ask reaches him - his body keeps every piece, and the taker holds none', async () => {
  const s = await scene('street');
  s.net.late.set(`${s.mac.id}>${s.bob.id}`, 1000);
  const w = windowFor(s.mac, choosing(GREAVES));
  s.mac.press(s.keyOf(s.mac), w);
  run(s.net, 100, [w]);
  leave(s.bob);
  run(s.net, SETTLED_MS, [w]);
  assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  assert.deepEqual(s.rat.entity.items.map(pieceOf).sort(), s.body.map(pieceOf).sort(), 'the owner\'s body whole');
});

// ═══ AC3 - NO DUPES, AND THE PROTECTIONS STAND ════════════════════════════════════════════════════════════════════════

test('AC3 (guard - passes today): two party members press one body in one breath, each for the same piece - no piece lands twice; each piece is in exactly one place', async () => {
  const s = await scene('street', ['mac-0001', 'eve-0003']);
  const wm = windowFor(s.mac, choosing(GREAVES)), we = windowFor(s.eve, choosing(GREAVES));
  s.mac.press(s.keyOf(s.mac), wm);
  s.eve.press(s.keyOf(s.eve), we);
  run(s.net, SETTLED_MS, [wm, we]);
  assert.deepEqual(misplaced(s), [], 'AC3: one body, two presses in one breath - every piece in exactly one place');
});

test('AC3 (guard - passes today): the same breath with the owner\'s wire shut while both asks arrive (LOOT-DUP\'s state: the answers held in the real hit queue, then sent) - no piece lands twice', async () => {
  const s = await scene('street', ['mac-0001', 'eve-0003']);
  s.net.shut.add(s.bob.id);
  const wm = windowFor(s.mac, choosing(GREAVES)), we = windowFor(s.eve, choosing(SHORTSWORD));
  s.mac.press(s.keyOf(s.mac), wm);
  s.eve.press(s.keyOf(s.eve), we);
  run(s.net, 400, [wm, we]);
  s.net.shut.delete(s.bob.id);
  run(s.net, SETTLED_MS, [wm, we]);
  assert.deepEqual(misplaced(s), [], 'AC3: the owner\'s answers queued behind a shut wire - every piece in exactly one place');
});

test('AC3 (guard - passes today): B1/C1 - a grant nobody asked for lands nothing in a party member\'s pack, and A1/C7 - a member out of the body\'s reach takes nothing of it, however she presses', async () => {
  const s = await scene('street', ['mac-0001', 'eve-0003']);
  // an unasked grant, today's own shape, for the body Mac stands
  const pup = s.mac.pool().foes.find((x) => x.puppet === s.bob.id && x.corpse);
  s.mac.hit(s.bob.id, { to: s.mac.id, k: s.mac.room, i: pup.seq, grant: [{ ...s.body[1] }], n: 99, own: 1 });
  assert.equal(s.mac.entity.items.length, 0, 'B1/C1: no piece landed off a grant Mac never asked for');
  // Eve walks fifty units off and presses
  s.eve.feet[0] += 50; s.eve.feet[2] += 50;
  const w = windowFor(s.eve, choosing(GREAVES));
  s.eve.press(s.keyOf(s.eve), w);
  run(s.net, SETTLED_MS, [w]);
  assert.deepEqual(s.rat.entity.items.map(pieceOf).sort(), s.body.map(pieceOf).sort(), 'A1/C7: the owner\'s body is whole - a taker out of reach takes nothing');
  assert.equal(s.eve.entity.items.length + (s.eve.entity.goldPieces | 0), 0, 'and Eve holds nothing');
});

test('AC3 (guard - passes today): HACKED-GOLD/SS3 - a letter of credit on the owner\'s body never reaches a party member\'s pack, whatever the window offers; it stays on the owner\'s body', async () => {
  const letter = { group: 'MiscItems', templateIndex: REALM_LETTER_TEMPLATE, name: 'Letter of credit', value: 5000, stackCount: 1 };
  const s = await scene('street', ['mac-0001'], { extra: [letter] });   // a revenant carries what it took of its killer's (RVN8)
  const w = windowFor(s.mac, (it) => it.templateIndex === REALM_LETTER_TEMPLATE);
  s.mac.press(s.keyOf(s.mac), w);
  run(s.net, SETTLED_MS, [w]);
  assert.equal(s.mac.entity.items.some((it) => it.templateIndex === REALM_LETTER_TEMPLATE), false, 'no letter in the taker\'s pack');
  assert.equal(s.rat.entity.items.filter((it) => it.templateIndex === REALM_LETTER_TEMPLATE).length, 1, 'and the letter is on the owner\'s body, once');
});

// ═══ AC7 - THE OWNER'S OWN DOORS (guards) ═════════════════════════════════════════════════════════════════════════════

test('AC7 (guard - passes today): the owner\'s own press opens his window on his body, and the one piece he takes from it is the only piece that leaves', async () => {
  const s = await scene('street');
  const key = `foeCorpse:${s.rat.uid}`;
  assert.equal(saysEmpty(plaque(s.bob, key)), false, 'the owner\'s plaque lists his body');
  const w = windowFor(s.bob, choosing(GREAVES));
  s.bob.press(key, w);
  run(s.net, 2000, [w]);
  assert.equal(w.opened.length, 1, 'his window opened');
  assert.deepEqual(s.rat.entity.items.map(pieceOf).sort(), [GOLD, SHORTSWORD].sort(), 'the coin and the blade stay on the body');
  assert.deepEqual(s.bob.entity.items.map(pieceOf), [GREAVES], 'the Greaves in his pack');
  assert.deepEqual(misplaced(s), []);
});

test('AC7 (guard - passes today): the owner\'s own quick take - his plaque lights the Greaves and the press, through the host\'s door (quick loot before the window, world.js openBodyLoot), takes the Greaves alone and opens no window', async () => {
  setPref('quickLoot', true);
  try {
    const s = await scene('street');
    const key = `foeCorpse:${s.rat.uid}`;
    const f = plaque(s.bob, key);
    const row = f.rows.findIndex((r) => pieceOf(r.item) === GREAVES);
    assert.ok(row >= 0, 'the owner\'s plaque lists the Greaves');
    resetQuickLoot();
    foldQuickLoot(f);
    for (let i = 0; i < row; i++) { quickLootWheel(1); foldQuickLoot(f); }
    const w = windowFor(s.bob, () => false);
    s.bob.pool().takeLoot(key, (l) => s.bob.said.push(l), (loot) => (quickLootTake(key, loot, s.bob.entity, (l) => s.bob.said.push(l)) ? true : w.open(loot)));
    assert.equal(w.opened.length, 0, 'no window');
    assert.deepEqual(s.rat.entity.items.map(pieceOf).sort(), [GOLD, SHORTSWORD].sort(), 'the coin and the blade stay on the body');
    assert.deepEqual(s.bob.entity.items.map(pieceOf), [GREAVES], 'the Greaves in his pack');
  } finally { setPref('quickLoot', false); resetQuickLoot(); }
});

// ═══ AC5 - A BUILDING'S FOES: the same laws through the interior pool as worldModes.js wires it ═════════════════════

test('AC5 (AC1): in a building, a party member\'s plaque over another player\'s foe\'s body never says "Empty" while the owner\'s word says it holds something', async () => {
  const s = await scene('building');
  const key = s.keyOf(s.mac);
  assert.ok(s.mac.pool().lootTargets().some((t) => t.key === key), 'the body is a loot target indoors (guard)');
  const f = plaque(s.mac, key);
  assert.ok(f?.title, 'the plaque names the body');
  assert.equal(saysEmpty(f), false, 'AC5/AC1: indoors Mac\'s plaque says "Empty" over Bob\'s full body - the building runs the street\'s pool (worldModes.js makeInteriorFoes) and its puppet\'s contents door answers null');
});

test('AC5 (AC4): in a building, no blind grab - the press (openInteriorBodyLoot) opens a window on another player\'s foe\'s body, and only the one piece taken from it leaves the owner\'s body', async () => {
  const s = await scene('building');
  const w = windowFor(s.mac, choosing(GREAVES));
  s.mac.press(s.keyOf(s.mac), w);
  run(s.net, 10_000, [w]);
  assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  assert.ok(w.opened.length >= 1, `AC5/AC4: indoors the press opened NO window - openInteriorBodyLoot -> interiorFoes.takeLoot asks for the whole body, and the owner's body went from ${s.body.length} pieces to ${s.rat.entity.items.length}`);
  assert.deepEqual(s.rat.entity.items.map(pieceOf).sort(), [GOLD, SHORTSWORD].sort(), `AC5/AC4: only the chosen piece may leave the owner's body - it holds ${JSON.stringify(s.rat.entity.items.map((it) => it.name))}`);
});

test('AC5 (AC2): in a building, nothing is destroyed when the owner\'s answer is 3.5 s late', async () => {
  const s = await lateCase('building', { answerLate: 3500 });
  assert.deepEqual(misplaced(s), [], 'AC5/AC2: indoors an answer 3.5 s late - refused past TAKE_WINDOW_MS (interiorFoes.applyHit through applyOwnHit), never returned: destroyed');
});

test('AC5 (AC2, D-1): in a building, the taker walks out before the owner\'s answer can leave (the owner\'s wire held) - its claim in flight and not lapsed goes with it (PARTY-LOOT\'s own rule, DESIGN-REVIEW D-1): the Greaves is in exactly one place, the taker\'s pack', async () => {
  const s = await scene('building');
  s.net.shut.add(s.bob.id);
  const w = windowFor(s.mac, choosing(GREAVES));
  s.mac.press(s.keyOf(s.mac), w);
  run(s.net, 200, [w]);
  leave(s.mac);
  s.net.shut.delete(s.bob.id);
  run(s.net, SETTLED_MS, [w]);
  assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
  assert.deepEqual(census(s).get(GREAVES), [[`${s.mac.id}'s pack`, 1]], 'D-1: indoors too, the taker keeps the piece it left with in flight, and the owner\'s body is without it');
  assert.deepEqual(s.rat.entity.items.map(pieceOf).sort(), [GOLD, SHORTSWORD].sort(), 'the owner\'s body is without it');
});

test('AC5 (AC3, guard - passes today): in a building, two party members press one body in one breath for the same piece - no piece lands twice', async () => {
  const s = await scene('building', ['mac-0001', 'eve-0003']);
  const wm = windowFor(s.mac, choosing(GREAVES)), we = windowFor(s.eve, choosing(GREAVES));
  s.mac.press(s.keyOf(s.mac), wm);
  s.eve.press(s.keyOf(s.eve), we);
  run(s.net, SETTLED_MS, [wm, we]);
  assert.deepEqual(misplaced(s), [], 'every piece in exactly one place');
});

test('AC5 (AC7, guard - passes today): in a building, the owner\'s own press through openInteriorBodyLoot opens his window, and the one piece he takes is the only one that leaves', async () => {
  const s = await scene('building');
  const key = `foeCorpse:${s.rat.uid}`;
  assert.equal(saysEmpty(plaque(s.bob, key)), false, 'the owner\'s plaque lists his body');
  const w = windowFor(s.bob, choosing(GREAVES));
  s.bob.press(key, w);
  run(s.net, 2000, [w]);
  assert.equal(w.opened.length, 1, 'his window opened');
  assert.deepEqual(s.rat.entity.items.map(pieceOf).sort(), [GOLD, SHORTSWORD].sort(), 'the coin and the blade stay on the body');
  assert.deepEqual(s.bob.entity.items.map(pieceOf), [GREAVES], 'the Greaves in his pack');
});

// keep the coin's own law in view: the purse, not the pack, holds coin (a census reads both)
test('AC2 (guard - passes today): the census itself - the body\'s coin counted in the purse it lands in, a dupe and a loss each named (the rule every AC2/AC3 pin above reads)', () => {
  const body = PILE();
  const s = { body, rat: { entity: { items: body.slice(1).map((it) => ({ ...it })) } }, bob: { id: 'b', entity: { items: [], goldPieces: 0 } }, them: [{ id: 'm', entity: { items: [{ ...body[2] }], goldPieces: body[0].stackCount } }], before: new Map([['b', { items: [], gold: 0 }], ['m', { items: [], gold: 0 }]]) };
  assert.ok(isGoldPieces(body[0]), 'the pile\'s first piece is coin');
  assert.deepEqual(misplaced(s), [`${body[2].name}: 2 where the body held 1 - DUPED (the owner's body 1, m's pack 1)`], 'a piece on the body AND in a pack is a dupe; the coin in the purse is in one place');
  s.them[0].entity.goldPieces = 0;
  assert.match(misplaced(s)[0], /^Gold Pieces: 100 of 100 DESTROYED/, 'coin in no place is destroyed');
});
