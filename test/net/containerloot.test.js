// OUTDOOR-LOOT, AC8 (2026-10-17): A BUILDING'S CUPBOARD IS ONE LIST FOR EVERYONE IN THE BUILDING. RED PINS, PHASE 1.
// Since WORLD6a a building is a world room and a stranger's cupboard is the room's from its first open
// (world/interior/interiorShared.js): the room's word is the WHOLE list, and the last writer wins -
// `applyInteriorLoot` lands a list over the container (`t.items.length = 0; ... push`) except under the reader's own
// open window (AUDIT WORLD4 C1), `interiorLootRecords` says whole lists, and worldModes.js says one at the open and one
// at the close (`interiorPublishLoot`, `interiorLootOpened`, the frame's `interiorLootSettle`). So, today:
//   - two players with one cupboard open: the later close republishes a stale list - a piece the first took comes back
//     for everyone (a dupe; AUTO-HOLD's `withoutCarried` misses coin), and a piece put in is erased;
//   - two first-opens at once each roll their own stock (WORLD5 rolls at the open) and the last close wins;
//   - LOOT-BULK (#970) makes one stale close resurrect or erase a whole cupboard, and CONTAINER-PEEK (#970) paints the
//     resurrected list on every plaque.
//
// MOUNTED, NOT MATCHED (the mount lives in ./containerLootHarness.mjs, shared with containerloot_protocol.test.js). Each
// player is the interior host's own doors sliced out of src/scenes/worldModes.js - the
// container arm of the press (tryExit's `key.startsWith('container:')` arm, whatever it calls), the frame's loot settle,
// the bag's mint at the building's mount, the act and memory members the world host calls (applyPlaceActions,
// placeSharedWorld, restorePlaceSharedWorld), the plaque's peek (createInteriorPeek as the host builds it) - over the
// real pure half and the real producers (shopStock.js stockHouseContainer on each player's own dice), every name they
// read that the host imports resolved through the host's OWN import list, so a door that moves into a module the host
// imports is followed. Today's open, close and settle (`interiorPublishLoot`, `interiorLootOpened`,
// `interiorLootSettle`) are sliced where they still stand in the host; DESIGN.md section 4.9 moves them into the pure
// half, and a mount that no longer finds them reads the moved doors through the host's imports. The relay is a queue of
// act frames fanned to everyone else in the building. The window is a stand-in over the hooks the arm opens -
// `loot.items()` is the cupboard's array, a click the loot window's own transfer (itemTransfer.js planTake/planStore +
// applyTransfer, with the arm's `stolenFrom`) - and, for Take all and Stash all, THE REAL ENHANCED WINDOW
// (enhancedInventory.js mountEnhancedInventory in test/invdrag.mjs's DOM, test/ui/lootbulk.test.js's mount), pressed.
//
// Run against the tree at 02706035cf the AC8 pins fail by their assertions; the guards (named so) pass.
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { foldQuickLoot, quickLootTake, resetQuickLoot } from '../../src/systems/quickLoot.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { isStolen } from '../../src/systems/stolenGoods.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import {
  REAL_RANDOM, TODAY, KEY, cupboard, relay, player, pressYes, frame, items, sig, names, mk, plaque, peekNames, count,
  windowOf, realWindowOf, bulk, stashAll, building, stocked, joiner,
} from './containerLootHarness.mjs';

afterEach(() => { Math.random = REAL_RANDOM; resetQuickLoot(); setSharedClock(null); });

// ═══ AC8 (a) - A STALE CLOSE NEVER BRINGS BACK A TAKEN PIECE ═══════════════════════════════════════════════════════

test('AC8 (a): both players open one cupboard; A takes a piece and closes; B closes untouched - the piece never comes back in anyone\'s list or peek, nor in the memory a later player walks in on, and A holds it once', () => {
  const s = stocked();
  const wa = windowOf(s.A), wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  assert.ok(pressYes(s.A, wa), 'A opens the cupboard');
  const X = wa.take((it) => it.name === s.stock[0].name);
  wa.close(); frame(s.A); s.net.flush();
  wb.close(); frame(s.B); s.net.flush();
  const D = joiner(s, 'dddd-0004');
  const left = count(s.stock, X) - 1;   // what the cupboard holds of it once A's take is the room's
  const back = [s.A, s.B, s.C, D].filter((p) => count(items(p), X) > left || peekNames(p).filter((n) => n === X.name).length > left).map((p) => p.id);
  assert.deepEqual(back, [], `AC8 (a): ${X.name}, taken by A, is back in the cupboard for ${back.join(', ')} - B's untouched close republished its stale whole list (worldModes.js interiorPublishLoot -> interiorLootRecords) and applyInteriorLoot landed it over the room's (last writer wins): a dupe`);
  assert.equal(s.A.entity.items.filter((it) => sig(it) === sig(X)).length, 1, 'and A holds it, once');
});

// ═══ AC8 (b) - A STALE CLOSE NEVER ERASES A PUT ═════════════════════════════════════════════════════════════════════

test('AC8 (b): A\'s window stands open on the cupboard; B opens it, puts a piece in and closes; A closes untouched - the piece stays in every list, once, and B holds it no more', () => {
  const s = stocked();
  const wa = windowOf(s.A), wb = windowOf(s.B);
  assert.ok(pressYes(s.A, wa), 'A opens the cupboard, and leaves it open');
  const Y = mk('Mace');
  s.B.entity.items.push(Y);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  wb.put(Y);
  wb.close(); frame(s.B); s.net.flush();
  wa.close(); frame(s.A); s.net.flush();
  const D = joiner(s, 'dddd-0004');
  const want = count(s.stock, Y) + 1;
  const lost = [s.A, s.B, s.C, D].filter((p) => count(items(p), Y) !== want).map((p) => p.id);
  assert.deepEqual(lost, [], `AC8 (b): the Mace B put in is not in the cupboard, once, for ${lost.join(', ')} - A's untouched close of a window opened before the put republished A's stale whole list over the room's: the put is ERASED`);
  assert.equal(s.B.entity.items.some((it) => sig(it) === sig(Y)), false, 'and B holds it no more');
});

// ═══ AC8 (c) - TWO FIRST-OPENS CONVERGE ════════════════════════════════════════════════════════════════════════════

test('AC8 (c): A and B first-open the unrolled cupboard in one breath (each stocks it on their own dice, both say Yes); A takes a piece; both close - both end with the same list, and every piece A holds is a piece of that list\'s roll', () => {
  const s = building(3);
  const wa = windowOf(s.A), wb = windowOf(s.B);
  assert.ok(pressYes(s.A, wa), 'A opens - its own roll');
  assert.ok(pressYes(s.B, wb), 'B opens in the same breath - its own roll');
  const rollA = items(s.A).map(sig), rollB = items(s.B).map(sig);
  assert.notDeepEqual(rollA, rollB, 'two rolls, two stocks (the producer on two players\' dice - guard)');
  const P = wa.take(() => true);
  wa.close(); wb.close(); frame(s.A); frame(s.B);
  s.net.flush();
  const lists = [s.A, s.B, s.C].map((p) => (items(p) ?? []).map(sig));
  assert.deepEqual(lists[1], lists[0], `AC8 (c): A and B end with different lists - A sees ${JSON.stringify(names(items(s.A)))}, B sees ${JSON.stringify(names(items(s.B)))}: each first open rolled its own stock and each close's whole list landed over the other's (the last writer wins, and the two closes crossed)`);
  assert.deepEqual(lists[2], lists[0], 'and C sees that list too');
  // the roll everyone ended with is one of the two; A holds P only if P was a piece of it
  const held = s.A.entity.items.some((it) => sig(it) === sig(P));
  const won = [...lists[0], ...(held ? [sig(P)] : [])].sort();
  assert.ok(JSON.stringify(won) === JSON.stringify([...rollA].sort()) || JSON.stringify(won) === JSON.stringify([...rollB].sort()), `AC8 (c): the list everyone ended with${held ? ', with the piece A holds,' : ''} is neither first open's roll - A holds a piece of a roll that was never the room's`);
});

// ═══ LOOT-BULK - Take all and Stash all through the REAL window, still said only at its close ═══════════════════════
test('LOOT-BULK (AC8): A\'s Take all (the real window\'s bulk walk) under B\'s open window - B\'s untouched close never brings the cupboard back: every list and peek stays empty of what A took, and A holds each piece once', () => bulk((dom) => {
  const s = stocked();
  const wa = realWindowOf(s.A, dom), wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  assert.ok(pressYes(s.A, wa), 'A opens the cupboard');
  wa.press('Take all');
  assert.deepEqual(items(s.A), [], 'A\'s Take all emptied A\'s list (guard)');
  wa.close(); frame(s.A); s.net.flush();
  wb.close(); frame(s.B); s.net.flush();
  const D = joiner(s, 'dddd-0004');
  const back = [s.A, s.B, s.C, D].map((p) => [p.id, names(items(p)), peekNames(p)]).filter(([, l, pk]) => l.length || pk.length);
  assert.deepEqual(back, [], `LOOT-BULK: A took the whole cupboard, and B's untouched close brought it ALL back - ${JSON.stringify(back)}: one stale close resurrects a whole cupboard`);
  for (const it of s.stock) assert.equal(s.A.entity.items.filter((x) => sig(x) === sig(it)).length, s.stock.filter((x) => sig(x) === sig(it)).length, `A holds ${it.name} as often as the cupboard did`);
}));

test('LOOT-BULK (AC8): B\'s Stash all (bulkMove\'s own walk over the window\'s lists) while A\'s window stands open - A\'s untouched close never erases it: B\'s pieces stay in every list, once, and B holds them no more', () => {
  const s = stocked();
  const stash = [mk('Dagger'), mk('Mace')];
  s.B.entity.items.push(...stash);
  const wa = windowOf(s.A), wb = windowOf(s.B);
  assert.ok(pressYes(s.A, wa), 'A opens the cupboard, and leaves it open');
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  assert.equal(stashAll(s.B, wb).moved, 2, 'B\'s Stash all moved both');
  assert.ok(stash.every((it) => items(s.B).includes(it)), 'B\'s Stash all put both in B\'s list (guard)');
  wb.close(); frame(s.B); s.net.flush();
  wa.close(); frame(s.A); s.net.flush();
  const D = joiner(s, 'dddd-0004');
  const lost = [s.A, s.B, s.C, D].flatMap((p) => stash.filter((it) => count(items(p), it) !== count(s.stock, it) + 1).map((it) => `${p.id}: ${it.name}`));
  assert.deepEqual(lost, [], `LOOT-BULK: B's Stash all is ERASED by A's untouched close of a window opened before it - missing ${JSON.stringify(lost)}`);
  assert.equal(s.B.entity.items.some((it) => stash.some((x) => sig(x) === sig(it))), false, 'and B holds none of it');
});

// ═══ GUARDS - what stands, and must stand through the fix ══════════════════════════════════════════════════════════

test('CONTAINER-PEEK (guard - passes today): a cupboard\'s plaque is never "Empty" over a list that was not rolled - unstocked, due to restock, in someone else\'s home and in a hall it is the name alone; stocked, it lists the room\'s pieces as a glance', () => {
  const s = building(1);
  const name = (p) => plaque(p);
  let f = name(s.A);
  assert.equal(f?.kind, 'name', 'unstocked: the name alone');
  s.A.ctx.containers[0] = { ...cupboard(), items: [mk('Dagger')], stockedDate: TODAY - 1 };
  f = name(s.A);
  assert.equal(f?.kind, 'name', 'due to restock: the name alone');
  s.A.ctx.containers[0].stockedDate = TODAY;
  f = name(s.A);
  assert.equal(f?.kind, 'items', 'stocked today: a list');
  assert.equal(f.preview, true, 'a glance');
  assert.deepEqual(f.rows.map((r) => r.name), ['Dagger']);
  s.A.state.interiorHome = { own: false, owner: 'Someone' };
  assert.equal(name(s.A)?.kind, 'name', 'in someone else\'s home: the name alone');
  s.A.state.interiorHome = null;
  s.A.state.hallMemberHere = () => true;
  assert.equal(name(s.A)?.kind, 'name', 'in a hall: the name alone (the press opens the Stores chest)');
});

test('CONTAINER-PEEK (guard - passes today): a cupboard\'s preview never arms a quick take - folding its frame lights no row, and the quick door takes nothing from it', () => {
  setPref('quickLoot', true);
  try {
    const s = building(1);
    s.A.ctx.containers[0] = { ...cupboard(), items: [mk('Dagger'), mk('Mace')], stockedDate: TODAY };
    const f = plaque(s.A);
    assert.equal(f?.kind, 'items'); assert.equal(f.preview, true);
    resetQuickLoot();
    foldQuickLoot(f);
    assert.equal(quickLootTake(KEY, { items: () => s.A.ctx.containers[0].items }, s.A.entity, () => {}), null, 'the quick door takes nothing off a glance');
    assert.equal(s.A.ctx.containers[0].items.length, 2, 'the cupboard keeps both');
    assert.equal(s.A.entity.items.length, 0);
  } finally { setPref('quickLoot', false); }
});

test('HOME1 (guard - passes today): a home\'s cupboards are its owner\'s alone - the owner\'s close says nothing to the room, and a word about one lands on nobody', () => {
  const net = relay();
  const owner = player(net, 'aaaa-0001', { seed: 3, home: { own: true, owner: 'aaaa' } });
  const guest = player(net, 'bbbb-0002', { seed: 5, home: { own: false, owner: 'aaaa' } });
  assert.equal(owner.as(() => owner.h.bag()).home, true, 'the building\'s bag knows it is a home');
  owner.ctx.containers[0] = { ...cupboard(), items: [mk('Dagger')], stockedDate: 1 };
  const w = windowOf(owner);
  owner.window = w;
  owner.as(() => owner.h.press(KEY));
  assert.ok(w.cur, 'the owner opens their own storage');
  w.take((it) => it.name === 'Dagger');
  w.close(); frame(owner);
  assert.equal(net.frames.length, 0, 'the owner\'s close says nothing to the room');
  guest.ctx.containers[0] = { ...cupboard(), items: [mk('Mace')], stockedDate: 1 };
  net.send('cccc-0003', { k: owner.as(() => owner.h.bag()).locationKey, l: [{ k: KEY, r: [mk('Katana')], d: TODAY }] });
  net.flush();
  assert.deepEqual(names(items(owner)), [], 'nothing landed on the owner\'s cupboard');
  assert.deepEqual(names(items(guest)), ['Mace'], 'nor on the guest\'s');
});

test('STOLEN-GOODS (guard - passes today): Take all off a stranger\'s cupboard, through the host\'s own arm and the real window, marks every piece it takes as a theft, as a single take does', () => bulk((dom) => {
  const s = building(1);
  const w = realWindowOf(s.A, dom);
  assert.ok(pressYes(s.A, w), 'A opens a stranger\'s cupboard (the private-property question answered Yes)');
  assert.ok(w.cur.deps.loot.stolenFrom instanceof Set && w.cur.deps.loot.stolenFrom.size > 0, 'the arm hands the owner\'s keeping');
  const n = items(s.A).length;
  w.press('Take all');
  assert.equal(s.A.entity.items.length, n, 'every piece taken');
  assert.ok(s.A.entity.items.every((it) => isStolen(it)), 'and every one marked a theft');
  w.close(); frame(s.A);
}));
