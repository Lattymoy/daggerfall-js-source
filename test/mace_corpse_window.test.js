// ---------------------------------------------------------------------------
// MAC-E - A BODY IS OPENED, NOT EMPTIED (2026-09-17, Mac: "seems like when
// i click on a dead enemy now, i loot all their items automatically? dunno
// if that's from a mod or something, but it lets me exceed my carry weight
// with no penalty").
//
// It is not a mod. It is a RESIDUE this port wrote down and left, in
// `scenes/corpseMarker.js`'s own header: "DFU's general arm opens the
// inventory window with the corpse as the remote LootTarget (:957). The
// port transfers the lot and reports the count - the pre-existing G3
// shape, kept so this wave does not smuggle a UI change into a parity
// fix." A recorded residue is a bug with a note on it, and this one had
// a note for three waves.
//
// The dungeon host has done it correctly since U26 ("the old takeLoot
// vacuumed everything in one keypress"). The two EXTERIOR pools -
// `exteriorFoes` and `cityGuards`, which is every body in a street, a
// road or a wilderness encounter - never got that change, so a click
// emptied the body into the pack past every weight the window shows,
// and said "You take 2 items.", a line Daggerfall does not have.
//
// THE CARRY WEIGHT IS NOT A SECOND BUG. Neither `PlayerSpeedChanger.cs`
// nor `PlayerEntity.cs` mentions encumbrance at all - DFU draws the
// figure on the target icon and never charges for exceeding it. What the
// window restores is the CHOICE, which is the half that was missing.
//
// What stays a bulk take is the ONLINE grant landing, and for a reason
// that is not laziness: a peer's body is its owner's to empty, the owner
// has already chosen what leaves it, and the items are in flight by the
// time this client sees them. There is nothing for a window to offer.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openCorpseLoot, takeCorpseLoot, corpseLootHooks, ARROW_TEMPLATE_INDEX,
} from '../src/scenes/corpseMarker.js';
import { GOLD_TEMPLATE } from '../src/systems/inventory.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

const body = (items, marker = { archive: 400, record: 1, pos: [3, 0, 4] }) => ({
  corpse: true, corpseMarker: marker, entity: { items },
});
const gold = (n) => ({ name: 'Gold', group: 'Currency', templateIndex: GOLD_TEMPLATE, stackCount: n });
const sword = () => ({ name: 'Longsword', group: 'Weapons', templateIndex: 121 });
const arrows = (n = 20) => ({ name: 'Arrow', group: 'Weapons', templateIndex: ARROW_TEMPLATE_INDEX, stackCount: n });

test('MAC-E: a body with things in it OPENS - nothing moves, and nothing is said', () => {
  const player = { items: [], goldPieces: 0 };
  const said = [];
  const opened = [];
  const b = body([gold(7), sword()]);
  const n = openCorpseLoot(b, { playerEntity: player, say: (l) => said.push(l), openWindow: (h) => opened.push(h) });
  assert.equal(n, 2, 'the count is what the body HOLDS');
  assert.equal(opened.length, 1, 'the window opened, once');
  assert.deepEqual(player.items, [], 'NOT ONE ITEM MOVED - this is the whole report');
  assert.equal(player.goldPieces, 0, 'and the purse is still on the body');
  assert.deepEqual(said, [], 'DFU says nothing when it opens a body; "You take 2 items." was the port’s own line');
  assert.deepEqual(b.entity.items.length, 2, 'the body still holds them');
  assert.equal(b.corpseDisabled, undefined, 'and an opened body is not a disabled one');
});

test('MAC-E: the hooks are CreateLootableCorpseMarker’s identity', () => {
  const b = body([sword()], { archive: 380, record: 2, pos: [1, 2, 3] });
  const h = corpseLootHooks(b);
  assert.deepEqual(h.items(), b.entity.items, 'the window is given the BODY’s list, live');
  assert.equal(h.playerOwned, false, 'GameObjectHelper.cs:833 - so the icon cannot be cycled');
  assert.equal(h.textureArchive, 380);
  assert.equal(h.textureRecord, 2, 'ReverseCorpseTexture’s pair, off the marker the mint already resolved');
  assert.deepEqual(h.pos, [1, 2, 3]);
  assert.notEqual(h.pos, b.corpseMarker.pos, 'a copy - a window must not move the body');
  assert.equal('containerImage' in h, false,
    'no container picture: UpdateRemoteTargetIcon reads it only behind the world flat (:885-889) and a marker always has one');
});

test('MAC-E: the two arms that are NOT a window still are not one', () => {
  // :942-947 - the empty body, which is the click AFTER the one that
  // emptied it. It speaks, and only then stops being a target.
  const player = { items: [] };
  const said = [];
  const empty = body([]);
  assert.equal(openCorpseLoot(empty, { playerEntity: player, say: (l) => said.push(l), openWindow: () => assert.fail('no window for an empty body') }), 0);
  assert.deepEqual(said, ['The body has no treasure.']);
  assert.equal(empty.corpseDisabled, true);
  assert.equal(openCorpseLoot(empty, { playerEntity: player, say: (l) => said.push(l) }), 0, 'a disabled body answers nothing at all');
  assert.equal(said.length, 1);

  // :948-952 - one item and it is arrows: taken whole, no window.
  const quiver = body([arrows(20)]);
  const s2 = [];
  assert.equal(openCorpseLoot(quiver, { playerEntity: player, say: (l) => s2.push(l), openWindow: () => assert.fail('no window for arrows') }), 1);
  assert.deepEqual(s2, ['You collect the arrows.']);
  assert.equal(player.items.length, 1, 'and they really are in the pack');
  assert.equal(quiver.entity.items.length, 0);
});

test('MAC-E: no window, no vacuum - the body stays shut and says so in the console', () => {
  const player = { items: [], goldPieces: 0 };
  const b = body([gold(9), sword()]);
  const warn = console.warn;
  const lines = [];
  console.warn = (l) => lines.push(l);
  try {
    assert.equal(openCorpseLoot(b, { playerEntity: player }), 2, 'the count still reads');
  } finally { console.warn = warn; }
  assert.deepEqual(player.items, [], 'a missing door is NOT permission to empty the body');
  assert.equal(player.goldPieces, 0);
  assert.equal(b.entity.items.length, 2);
  assert.equal(lines.length, 1, 'and it is loud - a silent fallback is how the vacuum survived its own note');
});

test('MAC-E: takeCorpseLoot is the TAKE now, and the online grant is its one caller', () => {
  // The transfer itself is untouched - gold to the counter, the rest to
  // the list - because the grant landing still needs it.
  const player = { items: [], goldPieces: 3 };
  const said = [];
  const n = takeCorpseLoot({ entity: { items: [gold(7), sword()] } }, player, (l) => said.push(l));
  assert.equal(n, 2);
  assert.equal(player.goldPieces, 10, 'DoTransferItem’s first statement: a purse is SPENT, never listed');
  assert.deepEqual(player.items.map((i) => i.name), ['Longsword']);
  assert.deepEqual(said, ['You take 2 items.']);
  // ...and it is reached from exactly one place.
  const ex = rd('src/scenes/exteriorFoes.js');
  const calls = [...ex.matchAll(/takeCorpseLoot\(/g)];
  assert.equal(calls.length, 1, 'one caller');
  const line = ex.split('\n').find((l) => l.includes('takeCorpseLoot('));
  assert.match(line, /items: grant/, '...and it is the grant landing, where the owner has already chosen');
  assert.equal(rd('src/scenes/cityGuards.js').includes('takeCorpseLoot('), false,
    'the watch has no peers to grant it anything - it opens, always');
});

test('MAC-E: both exterior pools take the host’s inventory door, and both hosts hand it over', () => {
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) {
    const s = rd(f);
    assert.match(s, /function takeLoot\(key, say2 = \(\) => \{\}, openWindow = null\)/, `${f}: the pool takes a door`);
    assert.match(s, /openCorpseLoot\(/, `${f}: and opens the body with it`);
  }
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(f);
    const arm = s.split('\n').slice(
      s.split('\n').findIndex((l) => l.includes("lootKey.startsWith('foeCorpse:')")) - 1,
      s.split('\n').findIndex((l) => l.includes("lootKey.startsWith('foeCorpse:')")) + 3).join('\n');
    assert.match(arm, /takeLoot\(lootKey, \(l\) => townTalk\.say\(l\),/, `${f}: the say hook still rides`);
    assert.match(arm, /inventoryDoorReady\(\) \? \(loot\) => townTalk\.showOverlay\(makeInventoryWindow\(\{ loot \}\)\) : null/,
      `${f}: ...and the host's OWN inventory factory is the door, behind the same art gate every pack arm takes`);
  }
});

test('MAC-E: the residue note is gone from the header, because the residue is', () => {
  const s = rd('src/scenes/corpseMarker.js');
  assert.ok(!/The port transfers the lot and reports the count - the pre-existing G3\n\/\/ shape/.test(s),
    'a note describing behaviour the module no longer has is a lie with a citation');
  assert.match(s, /THAT RESIDUE IS PAID \(MAC-E/, 'and what replaced it says who found it');
});
