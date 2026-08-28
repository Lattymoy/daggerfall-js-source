// AUDIT 26 - the quest/item cluster (F068/F069, F070, F077, F079,
// F125, F126; F133 found STALE).
//
// F068: AddQuestItem NEVER rays - its dungeon shift is the constant
//       -randomTreasureMarkerDim/2 * GlobalScale, and only
//       AddQuestNPC aligns to the ground.
// F069: AlignBillboardToGround rays from the CENTRE + 0.2.
// F070: the trade window's Repair arm applies the queue law.
// F077: ResolveItemLongName appends the trapped soul's name.
// F079: CreateItem.lastSelectedIndex is ONE static.
// F125: the book arm is `Books && !IsArtifact`.
// F126: Cast-When-Held wear is the PLAYER's alone.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { isBook } from '../src/systems/useItem.js';
import { lastCreateItemIndex, setLastCreateItemIndex } from '../src/systems/createItem.js';
import { soulTrapNameSuffix, SOUL_TRAP_TEMPLATE } from '../src/systems/mysticism.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// ── F068 / F069 ───────────────────────────────────────────────────

test('F068: an item is PLACED and an NPC is ALIGNED - two laws, one function', () => {
  const wm = src('scenes/worldModes.js');
  // AddQuestItem (GameObjectHelper.cs:1128-1141): the dungeon shift is
  // a CONSTANT, and nothing rays.
  assert.ok(wm.includes('const QUEST_ITEM_MARKER_SHIFT = 0.5;'),
    '-(randomTreasureMarkerDim / 2) * GlobalScale = -(40 / 2) * 0.025');
  assert.ok(wm.includes('by = inDungeon ? y - QUEST_ITEM_MARKER_SHIFT : y;'), 'the item arm');
  assert.ok(wm.includes('by = inDungeon ? y - size.h / 2 : y;'), 'the NPC arm keeps the half-height anchor');
  // the ray lives ONLY in the else branch
  const arm = wm.slice(wm.indexOf('if (isItem) {'));
  const ray = arm.indexOf('collider?.raycast?.');
  const elseAt = arm.indexOf('} else {');
  assert.ok(elseAt > 0 && ray > elseAt, 'an item never reaches the raycast');
  // and both item call sites say so
  assert.equal((wm.match(/standQuestFlat\(t\.worldTextureArchive[^\n]*, true\)/g) ?? []).length, 1);
  assert.equal((wm.match(/standDungeonQuestFlat\(t\.worldTextureArchive[^\n]*, true\)/g) ?? []).length, 1);
  // the old comment claimed BOTH members align - that was the defect
  assert.equal(wm.includes('AddQuestNPC/AddQuestItem\n      // both call'), false);
});

test('F069: the NPC ray starts at the CENTRE, not the base', () => {
  // AlignBillboardToGround (:339) rays from go.transform.position +
  // 0.2 - a billboard's origin is its CENTRE - where the port rayed
  // from the base + 0.2, half a sprite lower, so a tall dungeon NPC
  // could start below a surface DFU clears and miss the snap.
  const wm = src('scenes/worldModes.js');
  assert.ok(wm.includes('const origin = by + size.h / 2 + 0.2;'), 'the centre, plus 0.2');
  assert.ok(wm.includes("raycast?.([x, origin, z], [0, -1, 0], 4)"), 'distance 4, as AddQuestNPC passes it');
  // the landing is unchanged: base = hit + 2% (DFU's centre = hit + 0.52)
  assert.ok(wm.includes('by = (origin - drop) + size.h * 0.02;'));
  assert.equal(wm.includes('raycast?.([x, by + 0.2, z]'), false, 'the base-origin ray is gone');
});

// ── F070 ──────────────────────────────────────────────────────────

test('F070: the trade window\'s Repair arm applies the SAME queue law as the live path', () => {
  // ConfirmTrade's Repair arm runs UpdateRepairTimes(true) over
  // remoteItemsFiltered - every job at this shop plus the new one
  // (:1060-1072 -> :514-568) - which is what makes the longest-job
  // stretch and the never-decrease clamp real laws rather than dead
  // arms of a one-item list.
  const wm = src('scenes/worldModes.js');
  const calls = wm.match(/updateRepairTimes\(\[\.\.\.repairJobsAt\(playerEntity, bk, now\), it\], \{ commit: true, nowMinutes: now, buildingKey: bk \}\);/g) ?? [];
  assert.equal(calls.length, 2, 'the keyed choice flow AND the trade arm, identically');
  // the instant-repair branch mends in place and does NOT book a job
  assert.ok(wm.includes("if (getBool('Controls', 'InstantRepairs')) { it.currentCondition = it.maxCondition; continue; }"),
    'an instant repair skips the queue entirely');
});

// ── F077 ──────────────────────────────────────────────────────────

test('F077: a filled soul trap says whose soul it holds', () => {
  // ResolveItemLongName's LAST arm appends " (Name)" (:352-368).
  const trap = { group: 'MiscItems', templateIndex: SOUL_TRAP_TEMPLATE, trappedSoulType: 23 };
  assert.equal(soulTrapNameSuffix(trap, () => 'Wraith'), ' (Wraith)');
  // an EMPTY trap says nothing - DFU's "(empty)" is commented out
  assert.equal(soulTrapNameSuffix({ ...trap, trappedSoulType: null }, () => 'Wraith'), '');
  // and the naming path finally calls it
  const ii = src('systems/itemInfo.js');
  assert.ok(ii.includes('soulTrapNameSuffix(item, enemyDisplayName)'), 'the long-name path appends it');
  // ...on the IDENTIFIED branch only: DFU's `!IsIdentified || IsArtifact`
  // early return (:302) sits BEFORE the soul arm. IM1 reshaped the
  // ternary (the unidentified arm leads, the Books arm follows), so
  // the pin holds the exact identified tail instead of source order.
  assert.match(ii, /const itemName = !identified \? \(t\?\.name \?\? ''\)\n\s+: item\?\.group === 'Books' \? [^\n]+\n\s+: \(name \?\? item\?\.name \?\? t\?\.name \?\? ''\) \+ soulTrapNameSuffix\(item, enemyDisplayName\);/,
    'the suffix is on the identified non-book arm, behind the unidentified early return');
});

// ── F079 ──────────────────────────────────────────────────────────

test('F079: CreateItem.lastSelectedIndex is ONE static, shared by both hosts', () => {
  // CreateItem.cs:29, :75, :121 - a single static shared by every cast
  // in a run. The port kept a module copy in EACH host, so casting in
  // a dungeon and again outdoors opened at the other host's row.
  setLastCreateItemIndex(0);
  assert.equal(lastCreateItemIndex(), 0);
  setLastCreateItemIndex(7);
  assert.equal(lastCreateItemIndex(), 7, 'the static remembers');
  for (const f of ['scenes/worldModes.js', 'scenes/dungeonContext.js']) {
    const s = src(f);
    assert.equal(s.includes('let _lastCreateItemIndex = 0;'), false, `${f} no longer keeps its own copy`);
    assert.ok(s.includes('selectedIndex: lastCreateItemIndex()'), `${f} reads the shared static`);
    assert.ok(s.includes('setLastCreateItemIndex(i)'), `${f} writes it`);
  }
});

// ── F125 ──────────────────────────────────────────────────────────

test('F125: an ARTIFACT book skips the reader', () => {
  // `ItemGroup == Books && !item.IsArtifact` (:1712) - the Oghma
  // Infinium falls through to the enchanted Used payload instead.
  assert.equal(isBook({ group: 'Books' }), true);
  assert.equal(isBook({ group: 'Books', artifact: true }), false, 'the Oghma Infinium is not a reader book');
  assert.equal(isBook({ group: 'Weapons' }), false);
});

// ── F126 ──────────────────────────────────────────────────────────

test('F126: only the PLAYER\'s Cast-When-Held item wears', () => {
  // activeMagicItemsInRound is filled solely under `if
  // (IsPlayerEntity)` (EntityEffectManager.cs:1744-1755), so an
  // enemy's item is looted at its remaining condition. The behaviour
  // is exercised in enchantments.test.js; this holds the GATE itself.
  const e = src('systems/enchantments.js');
  const arm = e.slice(e.indexOf('AUDIT 26 F126'));
  assert.ok(arm.slice(0, 900).includes('if (!entity?.isPlayer) return;'), 'the wear arm is gated');
  // the bundle-driven rounds are NOT gated - DFU runs those for any
  // entity, and re-gating them would be a fresh divergence.
  assert.ok(e.includes('RegensHealth') || e.includes('regensHealth'), 'the sibling payloads exist');
});
