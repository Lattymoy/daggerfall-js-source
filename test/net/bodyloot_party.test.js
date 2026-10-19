// OUTDOOR-LOOT follow-ups, PHASE 0 (2026-10-19, Travis: "write failing tests first ... make them exercise REAL LIVE CODE
// PATHS"): BACK-AND-FORTH PARTY LOOTING on a street body and a building's. These are REGRESSION pins - green on main - for the
// one scenario a party actually plays, three players over one body, every door used the way a player uses it:
//
//   A (the owner, whose foe fell) - the body holds a purse of Gold, a Buckler and a Potion of Healing, minted by the game's own
//   producers (loot.js generateItems' purse, enemyEquipment.js armorOfMaterial, healingSupply.js mintHealingPotion);
//   B takes the Buckler through the window; C takes the Gold through Quick Loot (foldQuickLoot -> quickLootTake); A takes the
//   Potion through its own window. Then B tries the Gold and C tries the Buckler: each is REFUSED, holds nothing extra, and is
//   told ROOM_TAKEN_TEXT ("Someone took that first.").
//
// THE TRIES NEED A STALE VIEW, and a player's own is the game's own: B and C each have the body's WINDOW open from the start,
// and nothing is recomposed under an open window (AUDIT WORLD4 C1), so each keeps the list it opened, less what it took itself,
// while the others move (a plaque cannot serve - the owner's verdict to a claim carries the digest, so a taker is never stale
// about the body a verdict has just answered). Deliveries are IMMEDIATE, or - the second run - the owner's link to B HELD
// 3.5 s (net.hold), so B's verdicts (its Buckler's grant, its Gold's refusal) land past the old 3 s mark. Every step asserts
// what EVERY player's plaque and view list - the real resolveHover over the pool's own namer and contents doors, and for a
// player with a window open that window's list - and the end asserts the census (each piece in exactly one place) and that the
// body is empty for everyone - and (Phase 1b of loot-followups, EMPTY-BODY AC-B4) that NO PLAQUE STANDS over it for A, B or C: an emptied
// body is no target for its owner either (read through the pick, onRay - never a hit the test made itself).
//
// Mounted, not matched: the pools are the real createExteriorFoes (the street's, and the building's as worldModes.js wires it),
// behind the real hit queue (net/hitPend.js), on the controllable clock of ./bodyLootHarness.mjs; the window is the harness's
// stand-in over itemTransfer.js's own law, and the quick door is quickLoot.js's own.
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_TAKEN_TEXT } from '../../src/systems/roomLoot.js';
import { armorOfMaterial } from '../../src/combat/enemyEquipment.js';
import { mintHealingPotion } from '../../src/systems/healingSupply.js';
import { foldQuickLoot, quickLootWheel, resetQuickLoot } from '../../src/systems/quickLoot.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import {
  FOES_FULL_MS, PILE, pieceOf, GOLD, clock, restoreRandom, scene, lootWindow, choosing, census, misplaced, plaque, run, onRay,
} from './bodyLootHarness.mjs';

afterEach(restoreRandom);

const BOB = 'bob-0002', MAC = 'mac-0001', EVE = 'eve-0003';
const BUCKLER = 'Armor:109', POTION = 'UselessItems1:83';
const SLOW_MS = 3500;   // one direction held past the old 3 s window (exteriorFoes.js TAKE_WINDOW_MS)
const dir = (from, to) => `${from}>${to}`;

/** The body's three pieces, by the game's own producers: the loot table's purse (lcg(2)'s roll), a Buckler as an orc's kit mints
 *  one (CreateArmor, leather), a Potion of Healing as ItemBuilder.CreatePotion mints it. Places 0, 1, 2. */
const BODY = () => [PILE().find((it) => pieceOf(it) === GOLD), armorOfMaterial(109, 0), mintHealingPotion()];
const GOLD_COUNT = BODY()[0].stackCount ?? 1;

const keyFor = (s, p) => (p === s.bob ? `foeCorpse:${s.rat.uid}` : s.keyOf(p));
const sorted = (a) => [...a].sort();
/** The pieces `p`'s view holds (the pool's contents door - what its plaque is composed from). */
const viewOf = (s, p) => sorted((p.holds(keyFor(s, p)) ?? []).map(pieceOf));
/** The pieces `p`'s plaque draws over the body (the real resolveHover), null when it draws none. */
const plaqueOf = (s, p) => { const f = plaque(p, keyFor(s, p)); return f?.rows ? sorted(f.rows.map((r) => pieceOf(r.item))) : null; };

/** After a step: every player's view lists exactly `want[id]`, and (where something is listed) so does its plaque. A player with
 *  a window OPEN (`open[id]`) sees the list it opened less what it took itself: nothing is recomposed under an open window. */
function views(s, what, want, open = {}) {
  for (const p of [s.bob, s.mac, s.eve]) {
    const w = sorted(want[p.id]);
    const got = open[p.id] ? sorted(open[p.id].list().map(pieceOf)) : viewOf(s, p);
    assert.deepEqual(got, w, `${what}: ${p.id}'s ${open[p.id] ? 'open window' : 'view'} lists ${JSON.stringify(got)}, not what is left for it ${JSON.stringify(w)}`);
    if (w.length && !open[p.id]) assert.deepEqual(plaqueOf(s, p), w, `${what}: ${p.id}'s plaque draws ${JSON.stringify(plaqueOf(s, p))}, not what is left for it ${JSON.stringify(w)}`);
  }
}
const all = (pieces) => ({ [BOB]: pieces, [MAC]: pieces, [EVE]: pieces });

/** A press that opens a window, a take of `piece` in it, the window shut (as a player does). Answers what the click moved. */
function windowTake(s, p, piece, what) {
  const w = lootWindow(p);
  p.press(keyFor(s, p), w);
  assert.equal(w.opened.length, 1, `${what}: ${p.id}'s press opened a window`);
  const got = w.take(choosing(piece));
  w.close();
  return got;
}
/** Quick Loot: the plaque is folded, the wheel steps the light to `piece`'s row, the press takes it with NO window. */
function quickTake(s, p, piece, what) {
  const key = keyFor(s, p);
  const f = plaque(p, key);
  const row = f?.rows?.findIndex((r) => pieceOf(r.item) === piece) ?? -1;
  assert.ok(row >= 0, `${what}: ${p.id}'s plaque lists the ${piece} row to light (${f ? JSON.stringify(f.rows.map((r) => pieceOf(r.item))) : 'no plaque'})`);
  setPref('quickLoot', true);
  try {
    resetQuickLoot();
    foldQuickLoot(f);
    for (let i = 0; i < row; i++) { quickLootWheel(1); foldQuickLoot(f); }
    const w = lootWindow(p);
    p.press(key, w);
    assert.equal(w.opened.length, 0, `${what}: the quick door took the row with no window (guard)`);
  } finally { setPref('quickLoot', false); resetQuickLoot(); }
}
const told = (p) => p.said.filter((l) => l === ROOM_TAKEN_TEXT).length;
const goldOf = (p) => p.entity.goldPieces | 0;
const countOf = (p, piece) => p.entity.items.filter((it) => pieceOf(it) === piece).length;

async function play(where, { slow, order }) {
  const s = await scene(where, [MAC, EVE], { pile: BODY });
  const A = s.bob, B = s.mac, C = s.eve;
  const net = s.net;
  const from0 = { items: new Map([A, B, C].map((p) => [p.id, p.entity.items.length])), gold: new Map([A, B, C].map((p) => [p.id, goldOf(p)])) };
  views(s, 'before any move', all([GOLD, BUCKLER, POTION]));
  if (slow) net.hold(dir(BOB, MAC));   // the owner's link to B: its verdicts wait 3.5 s
  const t0 = clock.t;
  // B and C each have the body's window OPEN from the start, as a player standing at it does: nothing is recomposed under an
  // open window (AUDIT WORLD4 C1), so each one's list is the list it OPENED, less what it took itself
  const wB = lootWindow(B), wC = lootWindow(C);
  B.press(keyFor(s, B), wB);
  C.press(keyFor(s, C), wC);
  assert.equal(wB.opened.length + wC.opened.length, 2, 'B and C each opened a window on the body (guard)');
  const open = { [MAC]: wB, [EVE]: wC };

  // 1. B takes the Buckler through its window
  assert.ok(wB.take(choosing(BUCKLER)), 'step 1: B\'s click moved the Buckler out of its window');
  run(net, 200);
  views(s, 'step 1 (B took the Buckler)', { [BOB]: [GOLD, POTION], [MAC]: [GOLD, POTION], [EVE]: [GOLD, BUCKLER, POTION] }, open);

  // 2. C takes the Gold through Quick Loot (its window still open on the body)
  quickTake(s, C, GOLD, 'step 2');
  run(net, 200);
  views(s, 'step 2 (C quick-took the Gold)', { [BOB]: [POTION], [MAC]: [GOLD, POTION], [EVE]: [BUCKLER, POTION] }, open);

  const takePotion = (when) => {
    assert.ok(windowTake(s, A, POTION, when), `${when}: A's click moved the Potion out of its own window`);
    run(net, 200);
  };
  const tries = (aLeft) => {
    // B clicks the Gold row its window still shows: the owner granted it to C a moment ago
    assert.ok(wB.take(choosing(GOLD)), 'B\'s click on the Gold row its open window still shows');
    run(net, 200);
    views(s, 'B tried the Gold', { [BOB]: aLeft, [MAC]: [POTION], [EVE]: [BUCKLER, POTION] }, open);
    // C clicks the Buckler row its window still shows: the owner granted it to B
    assert.ok(wC.take(choosing(BUCKLER)), 'C\'s click on the Buckler row its open window still shows');
    run(net, 200);
    views(s, 'C tried the Buckler', { [BOB]: aLeft, [MAC]: [POTION], [EVE]: [POTION] }, open);
  };
  const settle = (what, want) => {
    wB.close(); wC.close();   // the windows shut: the lists are recomposed from the owner's word
    delete open[MAC]; delete open[EVE];
    run(net, FOES_FULL_MS + 400);
    if (slow) {
      // B's verdicts are still on the held link: nothing it claimed has landed, and it has not been told
      assert.ok(clock.t - t0 < SLOW_MS, `${what}: still inside the hold (guard: ${clock.t - t0} ms of ${SLOW_MS})`);
      assert.equal(countOf(B, BUCKLER), 0, `${what}: B's Buckler waits on the held link`);
      assert.equal(told(B), 0, `${what}: and B has not been told of its refused Gold`);
      run(net, SLOW_MS - (clock.t - t0));
      net.release(dir(BOB, MAC));
      run(net, 400);
    }
    run(net, FOES_FULL_MS + 400);
    views(s, what, want);
  };

  if (order === 'late') {
    // 3. A takes the Potion through its own window; 4. B and C try
    takePotion('step 3');
    views(s, 'step 3 (A took the Potion)', { [BOB]: [], [MAC]: [GOLD, POTION], [EVE]: [BUCKLER, POTION] }, open);
    tries([]);
    settle('the windows shut', all([]));
  } else {
    tries([POTION]);
    settle('the windows shut, the Potion left', all([POTION]));
    takePotion('step 3 (after the tries)');
    run(net, FOES_FULL_MS + 400);
    views(s, 'step 3 (A took the Potion)', all([]));
  }

  // the end: every piece in exactly one place, the body empty for everyone, nobody holding anything extra
  assert.deepEqual(misplaced(s), [], 'every piece is in exactly one place');
  const at = census(s);
  assert.deepEqual(at.get(BUCKLER), [[`${B.id}'s pack`, 1]], 'the Buckler is in B\'s pack alone');
  assert.deepEqual(at.get(GOLD), [[`${C.id}'s pack`, GOLD_COUNT]], 'the Gold is in C\'s purse alone');
  assert.deepEqual(at.get(POTION), [['the owner\'s pack', 1]], 'the Potion is in A\'s pack alone');
  assert.equal(s.rat.entity.items.length, 0, 'the owner\'s body is empty');
  for (const p of [A, B, C]) assert.deepEqual(viewOf(s, p), [], `${p.id}'s view of the body is empty`);
  // T-B7 EMPTY-BODY AC-B4: B and C see no plaque, and A sees no plaque - the emptied body is no target for its owner either
  for (const p of [A, B, C]) {
    const f = onRay(p, keyFor(s, p));
    assert.equal(f, null, `T-B7 EMPTY-BODY/AC-B4: ${p.id}'s plaque on the ray over the emptied body is ${f ? `"${f.title}"${f.empty ? ' - "Empty"' : ''}` : 'nothing'} - an emptied body is no target for anyone, its owner included`);
  }
  assert.equal(countOf(B, BUCKLER), 1, 'B holds the Buckler');
  assert.equal(goldOf(B), from0.gold.get(B.id), 'B\'s refused Gold left no coin in its purse');
  assert.equal(B.entity.items.length - from0.items.get(B.id), 1, 'B\'s pack grew by the Buckler alone');
  assert.equal(C.entity.items.length - from0.items.get(C.id), 0, 'C\'s pack holds no piece (its Gold is coin, its refused Buckler is nowhere)');
  assert.equal(goldOf(C) - from0.gold.get(C.id), GOLD_COUNT, 'C\'s purse grew by the Gold alone');
  assert.equal(A.entity.items.length - from0.items.get(A.id), 1, 'A\'s pack grew by the Potion alone');
  assert.equal(goldOf(A), from0.gold.get(A.id), 'A took no coin');
  assert.equal(told(B), 1, 'B was told "Someone took that first." once - for the Gold');
  assert.equal(told(C), 1, 'C was told "Someone took that first." once - for the Buckler');
  assert.equal(told(A), 0, 'A was not told');
}

for (const where of ['street', 'building']) {
  for (const slow of [false, true]) {
    for (const order of ['late', 'mid']) {
      test(`PARTY-LOOT back and forth [${where}, ${slow ? `the owner's link to B held ${SLOW_MS / 1000} s` : 'immediate'}, ${order === 'late' ? 'A takes before the tries' : 'the tries before A takes'}]: B takes the Buckler (window), C the Gold (Quick Loot), A the Potion (window); B's Gold and C's Buckler are refused and told; every plaque and view lists what is left after each step; each piece in one place`, async () => {
        await play(where, { slow, order });
      });
    }
  }
}
