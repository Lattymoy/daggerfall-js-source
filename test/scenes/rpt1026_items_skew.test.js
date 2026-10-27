// RPT1026-ITEMS LOOT-SKEW - two private reports: piles that told a current client, restarted again and again, to update;
// and a take that went back to the pile a few seconds later and never reached the pack.
//
// A dungeon pile's base is every client's own computation (systems/roomLoot.js PARTY-LOOT), and the room's word carries
// its signature. A client whose own chain differs - another BUILD, older as often as newer - reads the word as AUDIT SETS
// M2's unreadable one, and M2's line told the reader its own game was the old one whichever side was; and the host, for
// whom a joiner's word is another build's, never judges that joiner's claims, so a take went back to the pile after
// ROOM_CLAIM_TIMEOUT_MS in silence. Driven through the real room module (scenes/roomLootHost.js createRoomLoot) for three
// clients over one pile: the host on one build's chain, a joiner on the same, a joiner on another's.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoomLoot } from '../../src/scenes/roomLootHost.js';
import { LOOT_SKEW_TEXT, ROOM_LAPSED_TEXT, ROOM_CLAIM_TIMEOUT_MS, baseSignature } from '../../src/systems/roomLoot.js';
import { LOOT_NEWER_TEXT } from '../../src/systems/loot/loot.js';
import { midScreenText } from '../../src/ui/midScreenText.js';

const ROOM = 'dungeon:4242';
const HOST = 'a0a0-0001';
/** One build's pile chain and another's: the same draws, one stack a coin apart - what a loot change between two builds is. */
const chainOf = (coins) => () => [{ name: 'Gold Pieces', templateIndex: 276, group: 'Currency', value: 1, stackCount: coins }, { name: 'Torc', templateIndex: 138, group: 'Jewellery', value: 120 }];

/** A client in the room: the room module over a dungeon of one layout pile, as the dungeon host constructs it. */
function client(id, { authority = false, chain = chainOf(40) } = {}) {
  const frames = [];
  const host = {
    _deepCleared: new Set(), _deepFoeCleared: new Set(), _sharedFoe: () => false, _wildDungeon: false, _wildRing: null, eliteLootOpts: () => ({}), fightN: () => 1,
    foes: [], lootKeyOf: (k) => k, lootableBody: () => false, respawnDue: () => false, rollPileItems: chain, roomLootKey: (k) => k, searchHeard: () => {},
    searchables: [], settleLootFlat: () => {}, dfLocation: { mapTableData: { dungeonType: 0 } },
    opts: { selfId: () => id, onActions: (data) => frames.push(JSON.parse(JSON.stringify(data))), onLootClaimed: () => {}, partyLevels: () => [], roomHost: () => HOST },
    lootPiles: [{ items: [], pos: [0, 0, 0] }], _lootUnreadable: new Set(), _lootSeen: new Set(), _lootAt: new Map(), _lootOpenKey: null, _lootTooBig: new Set(),
    _authority: authority, _foesFrom: authority ? null : HOST, _locationKey: ROOM, _layoutFoes: 0, _sharedById: new Map(), _sharedStamp: `st${id}`,
    _roomClaimN: 0, _roomMintHold: 0, _roomNowMs: 0, _retyping: new Set(), lootKey: 'N', onlineRoom: () => true, _wallNow: () => 1_000_000,
    searchRoom: { ours: () => true, fields: () => ({}), whose: () => null },
  };
  return { id, host, frames, m: createRoomLoot(host) };
}
/** The host's word about the pile, as the room carries it. */
function hostWord() {
  const a = client(HOST, { authority: true });
  a.m.mintUnbornRoom(0);
  a.m.mintUnbornRoom(10_000);
  const rec = a.frames.flatMap((f) => f.l ?? []).find((r) => r.k === 'loot:0');
  assert.ok(rec?.h, 'the host minted the pile and said its word, its base signed');
  assert.equal(rec.h, baseSignature(chainOf(40)()), 'signed by its own chain');
  return rec;
}

test('LOOT-SKEW: a pile whose word is another build\'s says THAT, not "from a newer version of the game" - the reader may be the newer one; a word holding a piece no build of this one reads keeps M2\'s line; the same build reads the word (mutants: the skew never marked; M2\'s line for both)', () => {
  const rec = hostWord();
  const same = client('b0b0-0002');
  assert.equal(same.m.landRoomWord('loot:0', rec, HOST), 1, 'the same build lands the host\'s word');
  assert.equal(same.host._lootUnreadable.has('loot:0'), false);
  assert.deepEqual(same.host.lootPiles[0].items.map((it) => it.stackCount ?? 1), [40, 1], 'and composes the room\'s base');
  const other = client('c0c0-0003', { chain: chainOf(41) });
  assert.equal(other.m.landRoomWord('loot:0', rec, HOST), 0, 'another build\'s chain does not land it');
  assert.equal(other.host._lootUnreadable.has('loot:0'), true, 'the pile is unreadable here - its press opens nothing');
  assert.equal(other.m.roomUnreadableText('loot:0'), LOOT_SKEW_TEXT(), 'and says the two sides differ');
  assert.doesNotMatch(LOOT_SKEW_TEXT(), /newer|older|update|Reload/i, 'never that this player\'s own game is the old one');
  // a word holding a piece this build cannot read at all (a newer game's item): M2's own line, as before
  const newer = client('d0d0-0004');
  assert.equal(newer.m.landRoomWord('loot:0', { ...rec, s: [{ templateIndex: 99_999 }], si: ['a0a0-0001:st:1'] }, HOST), 0);
  assert.equal(newer.host._lootUnreadable.has('loot:0'), true);
  assert.equal(newer.m.roomUnreadableText('loot:0'), LOOT_NEWER_TEXT, 'M2\'s line - this one IS a newer piece');
  // and a skewed pile that then hears such a word says M2's line, not the skew's
  other.m.landRoomWord('loot:0', { ...rec, s: [{ templateIndex: 99_999 }], si: ['a0a0-0001:st:1'] }, HOST);
  assert.equal(other.m.roomUnreadableText('loot:0'), LOOT_NEWER_TEXT);
  // and so does one that hears an older build's list (WORLD4's, written before PARTY-LOOT) holding such a piece
  const legacy = client('e0e0-0005', { chain: chainOf(41) });
  legacy.m.landRoomWord('loot:0', rec, HOST);
  assert.equal(legacy.m.roomUnreadableText('loot:0'), LOOT_SKEW_TEXT());
  legacy.m.landRoomWord('loot:0', { k: 'loot:0', r: [{ templateIndex: 99_999 }], t: 999_000 }, HOST);
  assert.equal(legacy.host._lootUnreadable.has('loot:0'), true, 'the list is unreadable here');
  assert.equal(legacy.m.roomUnreadableText('loot:0'), LOOT_NEWER_TEXT, 'M2\'s line - a piece no build of this one reads');
});

test('LOOT-SKEW: a take no host answers in ROOM_CLAIM_TIMEOUT_MS goes back to the pile AND SAYS SO - it had gone back in silence, a pile seeming to refill itself (mutant: the lapse unsaid)', () => {
  const rec = hostWord();
  const b = client('b0b0-0002');
  b.m.landRoomWord('loot:0', rec, HOST);
  const pile = b.host.lootPiles[0].items;
  const torc = pile.find((it) => it.name === 'Torc');
  pile.splice(pile.indexOf(torc), 1);   // the take, as the window's or the quick door's splice makes it
  b.m.roomSettle('loot:0');
  assert.equal(b.m._roomMine.size, 1, 'claimed of the host');
  midScreenText.text = '';
  b.m.roomClaimTick(ROOM_CLAIM_TIMEOUT_MS - 1);
  assert.equal(midScreenText.text, '', 'nothing said while the claim may still be answered');
  b.m.roomClaimTick(ROOM_CLAIM_TIMEOUT_MS);
  assert.ok(b.host.lootPiles[0].items.some((it) => it.name === 'Torc'), 'the piece is back in the pile');
  assert.equal(midScreenText.text, ROOM_LAPSED_TEXT(), 'and the player is told why');
});
