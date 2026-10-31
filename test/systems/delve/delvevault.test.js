// DELVE-VAULT (bible/03-World/Delve-II.md section 6; the owner, 2026-10-31: "the rewards for these are really really bad"):
// a won vault holds a known piece Magic or better at the dungeon's own pile source, the pile's own roll, and gold by the
// level - never empty. The piece's ladder is held back by the opener's level (LOOT-GATE). Pins held to fail under the
// mutations in tools/mutants/delvevault.json.
import '../../modsOff.js';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { rollVault, vaultSource, vaultPiece, DELVE_VAULT_GOLD_PER_LEVEL } from '../../../src/systems/delve/delveVault.js';
import { seededRng } from '../../../src/systems/wind/wind.js';
import { wearableItem } from '../../../src/systems/equip.js';
import { pileSource, dungeonRarityTier, dungeonFamily } from '../../../src/systems/loot/lootRarity.js';
import { ELITE_LOOT_QUALITY_MULT } from '../../../src/world/spawnedDungeons.js';
import { DUNGEON_TYPES } from '../../../src/formats/mapsFile.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { noteTaken, droughtOf, _setDroughtForTests } from '../../../src/systems/loot/lootDrought.js';
import { setSigilOnline } from '../../../src/systems/sigil/sigil.js';

const LADDER = ['magic', 'rare', 'legendary'];

test('DELVE-VAULT THE SOURCE: the dungeon\'s own pile - its type\'s tier, an Elite\'s quality, its family - at the opener\'s level (mutants: the Elite\'s quality dropped; the level unread)', () => {
  const t = DUNGEON_TYPES.VampireHaunt;
  assert.deepEqual(vaultSource(t, false, 12), { ...pileSource(dungeonRarityTier(t)), qualityMult: 1, family: dungeonFamily(t), rollerLevel: 12 });
  assert.equal(vaultSource(t, true, 12).qualityMult, ELITE_LOOT_QUALITY_MULT);
  assert.equal(vaultSource(t, false, 0).rollerLevel, 1, 'at least level 1');
  assert.equal(vaultSource(t, false, 7.9).rollerLevel, 7);
});

test('DELVE-VAULT THE ROLL: a known wearable piece Magic or better first, the pile\'s own roll, then gold by the level (0.8 to 1.2 of 40 a level) - never empty (mutants: no piece; the piece unknown; the piece left Common; no gold; the gold\'s rate)', () => {
  setPref('lootRarity', true);
  const src = vaultSource(DUNGEON_TYPES.Crypt, false, 10);
  const pile = [{ name: 'Silver Mace', group: 'Weapons', templateIndex: 121 }];
  assert.equal(DELVE_VAULT_GOLD_PER_LEVEL, 40);
  let lo = Infinity, hi = 0;
  for (let s = 1; s <= 200; s++) {
    const v = rollVault(() => pile.map((it) => ({ ...it })), 10, src, seededRng(s));
    assert.equal(v.length, 3);
    assert.ok(wearableItem(v[0]), `seed ${s}: a piece a slot takes`);
    assert.equal(v[0].isIdentified, true, `seed ${s}: known`);
    assert.ok(LADDER.includes(v[0].rarity), `seed ${s}: Magic or better, not ${v[0].rarity}`);
    assert.deepEqual(v[1], pile[0], 'the pile\'s own roll, untouched');
    assert.equal(v[2].group, 'Currency');
    lo = Math.min(lo, v[2].stackCount); hi = Math.max(hi, v[2].stackCount);
  }
  assert.ok(lo >= 320 && hi <= 480 && hi - lo > 100, `the gold ${lo} to ${hi} at level 10`);
  for (const empty of [() => [], () => null]) {
    const v = rollVault(empty, 3, src, seededRng(9));
    assert.deepEqual([v.length, v[1].group], [2, 'Currency'], 'an empty pile: the piece and the gold');
  }
  assert.deepEqual(rollVault(() => [], 1, src, () => 0)[1].stackCount, 32, 'level 1 at the roll\'s floor: 0.8 of 40');
});

test('DELVE-VAULT LOOT-GATE: the piece\'s Rare and Legendary held back for a young opener as at any dungeon chest - fewer at level 1 than at 30 (mutants: the level unread)', () => {
  setPref('lootRarity', true);
  const top = (level) => {
    let n = 0;
    for (let s = 1; s <= 600; s++) if (vaultPiece(level, vaultSource(DUNGEON_TYPES.DragonsDen, false, level), seededRng(s)).rarity !== 'magic') n++;
    return n;
  };
  const young = top(1), grown = top(30);
  assert.ok(young * 3 < grown, `Rare or better: ${young} at level 1, ${grown} at level 30`);
});

test('DELVE-VAULT THE LADDER OFF: the piece still comes, known and plain (mutants: the switch unread)', () => {
  setPref('lootRarity', false);
  try {
    const p = vaultPiece(10, vaultSource(DUNGEON_TYPES.Crypt, false, 10), seededRng(4));
    assert.equal(p.isIdentified, true);
    assert.equal(p.rarity, undefined);
  } finally { setPref('lootRarity', true); }
});

test('DELVE-VAULT THE HOST\'S DOOR: the host rolls my vault - offline at the win, online as my share - at its dungeon\'s own type and tier and my level (mutants: the host\'s plain source)', () => {
  const host = readFileSync(new URL('../../../src/scenes/delve/delveHost.js', import.meta.url), 'utf8');
  assert.match(host, /const myVault = \(\) => rollVault\(rollPile, lv\(\), vaultSource\(location\?\.mapTableData\?\.dungeonType, tier === 'elite', lv\(\)\)\);/);
  assert.equal(host.match(/myVault\(\)/g).length, 2, 'the win\'s roll and the share\'s');
});

test('AUDIT DELVE-VAULT: the piece is a pile\'s piece to the drought - taken, a Legendary empties it - and online a weapon\'s sigil is rolled at the mint, as the pile\'s are (mutants: the piece never marked; online unstamped)', () => {
  setPref('lootRarity', true);
  const pieces = Array.from({ length: 300 }, (_, s) => vaultPiece(30, vaultSource(DUNGEON_TYPES.Crypt, false, 30), seededRng(s + 1)));
  assert.ok(pieces.every((p) => p.untaken === true), 'marked, as a source door marks its pieces');
  const leg = pieces.find((p) => p.rarity === 'legendary');
  _setDroughtForTests(60);
  assert.equal(noteTaken(leg), true);
  assert.equal(droughtOf(), 0, 'a Legendary from a vault empties the drought');
  assert.equal(pieces.filter((p) => p.sigil).length, 0, 'offline: no sigil');
  setSigilOnline(true);
  try {
    const online = Array.from({ length: 300 }, (_, s) => vaultPiece(30, vaultSource(DUNGEON_TYPES.Crypt, false, 30), seededRng(s + 1)));
    assert.ok(online.some((p) => p.group === 'Weapons' && p.sigil), 'online: a weapon\'s sigil');
    assert.ok(online.every((p) => !p.sigil || p.group === 'Weapons' || p.sigil.set), 'only what the pile\'s law stamps');
  } finally { setSigilOnline(false); _setDroughtForTests(0); }
});
