// GOLD-WIRE (FIELD BUGS 2026-10-25b, bible/01-Overview/bugs/Field-Bugs-2026-10-25b.md): A GOLD PILE PAST THE WIRE'S STACK
// BOUND NEVER LANDS IN A CONTAINER THE ROOM SHARES.
//
// Online, a purse dropped into a dungeon's room container or a building's cupboard became one gold stack, and a stack past
// LOOT_STACK_MAX (65,535) is no item on the wire (loot.js wireLootItem). The room's word about that container then failed
// validRoomWord whole at everyone who read it - "Something in here is from a newer version of the game", which no reload
// mends. The owner's call (2026-10-25): keep the bound, and clamp the drop into a container the room shares at the room
// left on the gold stack it lands on; a home's cupboards, the ground and the wagon are not clamped.
//
// Each test runs the real chain: the room module composes the container's list (and marks it), the drop is planned by
// itemTransfer.js planDropGold and laid in by inventory.js addItem as both windows do, the module's frame reads the put
// and says the room's word, and validRoomWord reads that word as another player's client does.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../../src/systems/item/itemLaw.js';   // the item law registers itself on the wire, as every host's import does
import { planDropGold, sharedGoldRoom, sharedGoldText, sharedGoldFullText } from '../../../src/systems/item/itemTransfer.js';
import { addItem, goldStack, isGoldPieces } from '../../../src/systems/inventory.js';
import { LOOT_STACK_MAX } from '../../../src/systems/loot/loot.js';
import { validRoomWord } from '../../../src/systems/roomLoot.js';
import { isRoomCarried, markRoomCarried } from '../../../src/systems/loot/roomCarriedList.js';
import { createRoomLoot } from '../../../src/scenes/roomLootHost.js';
import { mintInteriorShared } from '../../../src/world/interior/interiorShared.js';

const PURSE = 300_000;

/** The drop both windows make: planDropGold, then the purse less the amount and one gold stack laid in the remote list. */
function dropGold(entity, remote, asked) {
  const plan = planDropGold(String(asked), { carried: entity.goldPieces, remote });
  if (plan.ok) {
    entity.goldPieces -= plan.amount;
    addItem(remote, goldStack(plan.amount));
  }
  return plan;
}

const goldIn = (list) => list.filter(isGoldPieces).reduce((n, it) => n + (it.stackCount ?? 1), 0);

// ── the dungeon: a layout pile, this client the room's host ───────────────────────────────────────────────────────────

/** One room's host in a dungeon with one empty layout pile, born and composed by the room module itself. */
function dungeonHost() {
  const said = [];
  let now = Date.UTC(2027, 3, 1, 12, 0, 0);
  const pile = { items: [], batch: {} };
  const host = {
    _deepCleared: new Set(), _deepFoeCleared: new Set(), _sharedFoe: () => false, _wildDungeon: false, _wildRing: null,
    eliteLootOpts: () => ({}), fightN: () => 1, foes: [], searchables: [], dfLocation: null,
    lootKeyOf: (k) => k, lootableBody: () => false, roomLootKey: (k) => k, respawnDue: () => false,
    rollPileItems: () => [], searchHeard: () => {}, settleLootFlat: () => {},
    opts: { selfId: () => 'a0a0-0001', onActions: (frame) => { said.push(...frame.l); return true; }, onLootClaimed: () => {}, partyLevels: () => [] },
    _authority: true, _foesFrom: null, _layoutFoes: 0, _locationKey: 'dungeon:m777', _lootAt: new Map(), _lootOpenKey: null,
    _lootSeen: new Set(), _lootTooBig: new Set(), _lootUnreadable: new Set(), _roomClaimN: 0, _roomMintHold: 0, _roomNowMs: 0,
    _sharedById: new Map(), _sharedStamp: 'st1', _wallNow: () => now, lootKey: 'N', lootPiles: [pile], onlineRoom: () => true,
    searchRoom: { ours: () => true, fields: () => ({}) },
  };
  const room = createRoomLoot(host);
  room.mintUnbornRoom(0);
  room.mintUnbornRoom(60_000);   // past the host's wait for the room's memory: the host mints the pile's terms itself
  assert.ok(room._roomState.has('loot:0'), 'the pile is born the room\'s (guard)');
  const frame = () => { now += 100; room.roomClaimTick(now); };
  return { pile, said, frame };
}

test('GOLD-WIRE the dungeon: the room module marks the list it composes, and a purse dropped into it lands at most LOOT_STACK_MAX, said in a word another player reads (mutants: the mark at roomLootHost.js compose, the clamp in planDropGold)', () => {
  const d = dungeonHost();
  assert.ok(isRoomCarried(d.pile.items), 'the composed pile is marked as one the room\'s word carries');
  const me = { goldPieces: PURSE };
  const plan = dropGold(me, d.pile.items, PURSE);
  assert.equal(plan.ok, true);
  assert.equal(plan.amount, LOOT_STACK_MAX, 'the drop stops at the wire\'s stack bound');
  assert.equal(plan.notice, sharedGoldText(LOOT_STACK_MAX), 'and the box names the room left');
  assert.equal(me.goldPieces, PURSE - LOOT_STACK_MAX, 'the rest stays in the purse');
  d.said.length = 0;
  d.frame();
  const word = d.said.at(-1);
  assert.ok(word, 'the host says the pile\'s word after the put (guard)');
  const read = validRoomWord(JSON.parse(JSON.stringify(word)));
  assert.ok(read, 'another player\'s client reads the host\'s word - it is not "from a newer version of the game"');
  assert.equal(goldIn(read.s), LOOT_STACK_MAX, 'and reads the whole pile in it');
});

test('GOLD-WIRE the dungeon: a second drop fills the gold stack it merges into no further than LOOT_STACK_MAX, and a full stack refuses with a box (mutants: the room on the stack read as LOOT_STACK_MAX whole)', () => {
  const d = dungeonHost();
  const me = { goldPieces: PURSE };
  assert.equal(dropGold(me, d.pile.items, 60_000).amount, 60_000, 'under the bound, the amount asked');
  assert.equal(sharedGoldRoom(d.pile.items), LOOT_STACK_MAX - 60_000);
  assert.equal(dropGold(me, d.pile.items, 10_000).amount, LOOT_STACK_MAX - 60_000, 'the second drop stops at the room left on the stack it merges into');
  assert.equal(goldIn(d.pile.items), LOOT_STACK_MAX);
  const full = dropGold(me, d.pile.items, 1);
  assert.equal(full.ok, false, 'a full stack takes nothing');
  assert.equal(full.refusal.reason, 'sharedGoldFull');
  assert.equal(full.notice, sharedGoldFullText(), 'and says so');
  assert.equal(me.goldPieces, PURSE - LOOT_STACK_MAX, 'nothing more left the purse');
  d.frame();
  assert.ok(validRoomWord(JSON.parse(JSON.stringify(d.said.at(-1)))), 'the room\'s word still reads');
});

// ── a building's cupboard: this client the building's seat ─────────────────────────────────────────────────────────────

/** A stranger's building with one cupboard, opened first by this client - the seat - through the real bag and room module. */
function building({ home = false } = {}) {
  const said = [];
  let now = 1_000;
  const me = { goldPieces: PURSE, items: [] };
  const net = {
    entity: () => me, say: () => {}, selfId: () => 'a0a0-0001', seat: () => 'a0a0-0001', wallNow: () => now, now: () => now,
    send: (frame) => { said.push(...frame.l); return true; }, claimed: () => {},
  };
  const bag = mintInteriorShared('int:1:2', { home, net });
  const ctx = { containers: [{ items: [] }] };
  if (bag.room) {
    bag.room.roll(ctx, 'container:0', [{ group: 'Jewellery', templateIndex: 138, name: 'Torc', value: 120 }], 7);
    bag.room.birth(ctx, 'container:0');
  }
  const frame = () => { now += 100; bag.room?.frame(ctx, now, () => false); };
  return { me, said, cupboard: ctx.containers[0], frame, bag };
}

test('GOLD-WIRE a building\'s cupboard: the room module marks the list it composes, and a purse dropped into it lands at most LOOT_STACK_MAX, said in a word another player reads (mutants: the mark at interiorRoomLoot.js compose)', () => {
  const b = building();
  assert.ok(isRoomCarried(b.cupboard.items), 'the composed cupboard is marked as one the room\'s word carries');
  const plan = dropGold(b.me, b.cupboard.items, PURSE);
  assert.equal(plan.amount, LOOT_STACK_MAX, 'the drop stops at the wire\'s stack bound');
  b.said.length = 0;
  b.frame();
  const word = b.said.at(-1);
  assert.ok(word, 'the seat says the cupboard\'s word after the put (guard)');
  const read = validRoomWord(JSON.parse(JSON.stringify(word)));
  assert.ok(read, 'another player\'s client reads the seat\'s word');
  assert.equal(goldIn(read.s), LOOT_STACK_MAX, 'and reads the whole pile in it');
});

test('GOLD-WIRE the owner\'s condition: a home\'s cupboard, the ground and any list the room does not carry take the whole purse - only a container the room shares is clamped (mutants: the clamp asked of every list)', () => {
  const home = building({ home: true });
  assert.equal(home.bag.room ?? null, null, 'a home keeps no room (HOME1, guard)');
  assert.equal(isRoomCarried(home.cupboard.items), false, 'so its cupboard is never marked');
  assert.equal(dropGold(home.me, home.cupboard.items, PURSE).amount, PURSE, 'a home\'s cupboard takes the whole purse');
  const ground = [];
  assert.equal(dropGold({ goldPieces: PURSE }, ground, PURSE).amount, PURSE, 'the ground takes the whole purse');
  const marked = markRoomCarried([]);
  assert.equal(planDropGold(String(PURSE), { carried: PURSE, remote: marked, shared: false }).amount, PURSE, 'the caller may say a list is not shared');
  assert.equal(planDropGold(String(PURSE), { carried: PURSE, remote: [], shared: true }).amount, LOOT_STACK_MAX, '...or that it is');
});
