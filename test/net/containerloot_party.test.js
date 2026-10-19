// OUTDOOR-LOOT follow-ups, PHASE 0 (2026-10-19): BACK-AND-FORTH PARTY LOOTING at a building's CUPBOARD. Regression pins, green on main.
// The cupboard is the third container kind of the scenario test/net/bodyloot_party.test.js (street and building bodies) and
// test/systems/partyloot.test.js (a dungeon body) play: three players, one list.
//
//   A (the seat - the relay's longest socket - whose first open stocked the cupboard); the stock is a purse of Gold, a Buckler
//   and a Potion of Healing, each minted by the game's own producer (loot.js generateItems' purse, enemyEquipment.js
//   armorOfMaterial, healingSupply.js mintHealingPotion) and handed to A's first-open roll;
//   B takes the Buckler through the window; C takes the Gold; A takes the Potion through its own window. Then B tries the Gold and
//   C the Buckler: each is REFUSED, holds nothing extra, and is told ROOM_TAKEN_TEXT ("Someone took that first.").
//
// NO QUICK LOOT HERE, said plainly: a cupboard's plaque is a PREVIEW that lights no row and arms no take (containerloot_protocol.test.js
// T26), and the container arm of the press (worldModes.js `if (key.startsWith('container:'))`) asks the private-property question
// and opens the WINDOW - it never calls quickLootTake. So C's take of the Gold is a window's, like everyone's.
//
// THE TRIES NEED A STALE VIEW. B's and C's INBOUND links are held for the length of the moves (the relay stand-in's own `hold`,
// per direction), so each plaque keeps the list it last heard less what the player took itself; the claims they say reach the seat
// at once, and the seat judges them first come. The first run releases the links as soon as the moves are done (no time passes
// while they are held); the second holds them 3.5 s of the clock - past the old 3 s mark, inside ROOM_CLAIM_TIMEOUT_MS - so
// B's and C's verdicts land late. Every step asserts what EVERY player's plaque lists (the real resolveHover over the host's own
// peek); the end asserts the census (each piece in exactly one place), the empty cupboard for everyone, and who was told.
//
// Mounted, not matched: the players are the interior host's own doors sliced out of worldModes.js (./containerLootHarness.mjs),
// over the real pure half, on its controllable clock, joined by its relay stand-in. (The emptied cupboard's plaque is NOT
// asserted: it is the peek's `empty` - Phase 1b of loot-followups moves bodies, not cupboards, and this stays unpinned.)
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_TAKEN_TEXT } from '../../src/systems/roomLoot.js';
import { armorOfMaterial } from '../../src/combat/enemyEquipment.js';
import { mintHealingPotion } from '../../src/systems/healingSupply.js';
import { generateItems } from '../../src/systems/loot/loot.js';
import { isGoldPieces } from '../../src/systems/inventory.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { resetQuickLoot } from '../../src/systems/quickLoot.js';
import {
  REAL_RANDOM, KEY, lcg, clock, items, plaque, windowOf, rolled, firstOpen, pressYes, frame, elapse, quiesce,
} from './containerLootHarness.mjs';

afterEach(() => { Math.random = REAL_RANDOM; resetQuickLoot(); setSharedClock(null); });

const GOLD = 'Currency:276', BUCKLER = 'Armor:109', POTION = 'UselessItems1:83';
const SLOW_MS = 3500;
const pieceOf = (it) => `${it.group}:${it.templateIndex}`;
/** The cupboard's stock, by the game's own producers: the loot table's purse (lcg(2)'s roll), a leather Buckler, a Potion of Healing. */
const STOCK = () => [generateItems('F', { level: 10, gender: 'male' }, lcg(2)).find(isGoldPieces), armorOfMaterial(109, 0), mintHealingPotion()].map((it) => ({ ...it }));
const GOLD_COUNT = STOCK()[0].stackCount ?? 1;

const sorted = (a) => [...a].sort();
const listOf = (p) => sorted((items(p) ?? []).map(pieceOf));
/** The pieces `p`'s plaque draws over the cupboard (the real resolveHover over the host's peek), [] when it draws none. */
const plaqueOf = (p) => { const f = plaque(p); return f?.kind === 'items' ? sorted(f.rows.map((r) => pieceOf(r.item))) : []; };
const told = (p) => p.said.filter((l) => l === ROOM_TAKEN_TEXT).length;
const goldOf = (p) => p.entity.goldPieces | 0;
const countOf = (p, piece) => p.entity.items.filter((it) => pieceOf(it) === piece).length;

/** A press that opens a window, a take of `piece` in it, the window shut, the frame run (the claim said) - as a player does. */
function windowTake(s, p, piece, what) {
  const w = windowOf(p);
  assert.ok(pressYes(p, w), `${what}: ${p.id}'s press opened the cupboard`);
  const it = w.list().find((x) => pieceOf(x) === piece);
  assert.ok(it, `${what}: ${p.id}'s window lists the ${piece} row (${JSON.stringify(w.list().map(pieceOf))})`);
  w.take((x) => x === it);
  w.close();
  frame(p);
  s.net.flush();
}

for (const slow of [false, true]) {
  for (const order of ['late', 'mid']) {
    test(`PARTY-LOOT back and forth [cupboard, ${slow ? `B's and C's inbound links held ${SLOW_MS / 1000} s` : 'their inbound links held for the moves alone'}, ${order === 'late' ? 'A takes before the tries' : 'the tries before A takes'}]: B takes the Buckler, C the Gold, A the Potion (windows); B's Gold and C's Buckler are refused and told; every plaque lists what is left after each step; each piece in one place`, () => {
      const stock = STOCK();
      const s = rolled(3, [stock]);
      const { A, B, C } = s;
      // A's first open stocks the cupboard (the seat's own roll, on the producers' pieces) and says it; everyone has heard
      const wa = firstOpen(A);
      assert.deepEqual(sorted(wa.list().map(pieceOf)), sorted([GOLD, BUCKLER, POTION]), 'A\'s first open shows the three pieces (guard)');
      wa.close(); frame(A); s.net.flush();
      const base = new Map([A, B, C].map((p) => [p.id, { items: p.entity.items.length, gold: goldOf(p) }]));
      const views = (what, want) => {
        for (const p of [A, B, C]) {
          const w = sorted(want[p.id]);
          assert.deepEqual(listOf(p), w, `${what}: ${p.id}'s list holds ${JSON.stringify(listOf(p))}, not what is left for it ${JSON.stringify(w)}`);
          assert.deepEqual(plaqueOf(p), w, `${what}: ${p.id}'s plaque draws ${JSON.stringify(plaqueOf(p))}, not what is left for it ${JSON.stringify(w)}`);
        }
      };
      const all = (...ps) => ({ [A.id]: ps, [B.id]: ps, [C.id]: ps });
      views('before any move', all(GOLD, BUCKLER, POTION));
      // B's and C's inbound links are held: they hear nothing of the others' moves until the end
      const inbound = [[A, B], [C, B], [A, C], [B, C]].map(([from, to]) => `${from.id}>${to.id}`);
      for (const d of inbound) s.net.hold(d);
      const t0 = clock.t;

      // 1. B takes the Buckler through the window
      windowTake(s, B, BUCKLER, 'step 1');
      views('step 1 (B took the Buckler)', { [A.id]: [GOLD, POTION], [B.id]: [GOLD, POTION], [C.id]: [GOLD, BUCKLER, POTION] });
      // 2. C takes the Gold through the window
      windowTake(s, C, GOLD, 'step 2');
      views('step 2 (C took the Gold)', { [A.id]: [POTION], [B.id]: [GOLD, POTION], [C.id]: [BUCKLER, POTION] });

      const takePotion = (when) => { windowTake(s, A, POTION, when); };
      const tries = (aLeft) => {
        windowTake(s, B, GOLD, 'B tries the Gold');   // B's plaque, stale, still lists it: the seat granted it to C a moment ago
        views('B tried the Gold', { [A.id]: aLeft, [B.id]: [POTION], [C.id]: [BUCKLER, POTION] });
        windowTake(s, C, BUCKLER, 'C tries the Buckler');   // C's plaque, stale, still lists it: the seat granted it to B
        views('C tried the Buckler', { [A.id]: aLeft, [B.id]: [POTION], [C.id]: [POTION] });
      };
      const settle = (what, want) => {
        if (slow) {
          elapse(s, SLOW_MS - (clock.t - t0));   // the links stay held: nothing is heard, the clock passes
          assert.equal(countOf(B, BUCKLER), 0, `${what}: B's Buckler waits on the held link`);
          assert.equal(told(B), 0, `${what}: and B has not been told of its refused Gold`);
          assert.ok(clock.t - t0 >= SLOW_MS, 'the links were held 3.5 s (guard)');
        }
        for (const d of inbound) s.net.release(d);
        s.net.flush();
        quiesce(s);
        views(what, want);
      };
      if (order === 'late') {
        takePotion('step 3');
        views('step 3 (A took the Potion)', { [A.id]: [], [B.id]: [GOLD, POTION], [C.id]: [BUCKLER, POTION] });
        tries([]);
        settle('the links whole again', all());
      } else {
        tries([POTION]);
        settle('the links whole again, the Potion left', all(POTION));
        takePotion('step 3 (after the tries)');
        quiesce(s);
        views('step 3 (A took the Potion)', all());
      }

      // the end: every piece in exactly one place, the cupboard empty for everyone, nobody holding anything extra, the refused told
      const heldOf = (piece) => [A, B, C].map((p) => (piece === GOLD ? goldOf(p) - base.get(p.id).gold : countOf(p, piece)));
      assert.deepEqual(heldOf(BUCKLER), [0, 1, 0], 'the Buckler is in B\'s pack alone');
      assert.deepEqual(heldOf(GOLD), [0, 0, GOLD_COUNT], 'the Gold is in C\'s purse alone');
      assert.deepEqual(heldOf(POTION), [1, 0, 0], 'the Potion is in A\'s pack alone');
      for (const p of [A, B, C]) assert.deepEqual(listOf(p), [], `${p.id}'s cupboard is empty`);
      assert.equal(B.entity.items.length - base.get(B.id).items, 1, 'B\'s pack grew by the Buckler alone');
      assert.equal(C.entity.items.length - base.get(C.id).items, 0, 'C\'s pack holds no piece (its Gold is coin, its refused Buckler is nowhere)');
      assert.equal(A.entity.items.length - base.get(A.id).items, 1, 'A\'s pack grew by the Potion alone');
      assert.equal(told(B), 1, 'B was told "Someone took that first." once - for the Gold');
      assert.equal(told(C), 1, 'C was told "Someone took that first." once - for the Buckler');
      assert.equal(told(A), 0, 'A was not told');
      assert.ok(KEY, 'the cupboard stood at its key');
    });
  }
}
