// AUDIT UPDATE (2026-10-25, bible/01-Overview/audits/Audit-Update-2026-10-25.md) P3: LOOT-GATE AS THE GAME RUNS IT - the
// registry lootPowers.js keeps (the live player's level once a host publishes the door, Mentor Mode's when on), every door
// that reads it (rollRarity, rollLootRarity's own `level`, the drought, an elite's share, a revenant's), and the Imbue's
// purse, its refusals and its marks - the laws lootgate1.test.js named and nothing ran. Its own file: importing
// lootPowers.js registers the live level for every test beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/systems/loot/lootPowers.js';   // the shipping registration (registerRollerLevel)
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { rollerLevel, withRollerLevel, DROUGHT_FROM } from '../../src/systems/loot/lootLevelGate.js';
import { rarityChances, rollRarity, rollLootRarity, pileSource, applyRarity, rarityEligible, LOOT_RARITY_KEY } from '../../src/systems/loot/lootRarity.js';
import { noteTaken, droughtOf, _setDroughtForTests } from '../../src/systems/loot/lootDrought.js';
import { eliteLoot } from '../../src/systems/eliteFoes.js';
import { revenantLoot } from '../../src/systems/revenant/revenant.js';
import { imbuePiece, imbueRefusal, imbueTarget, IMBUE_PRICE, shardsHeld } from '../../src/systems/reforge.js';
import { welkyndShards } from '../../src/systems/gate/gateSpoils.js';
import { createRandomWeapon } from '../../src/systems/loot/loot.js';
import '../../src/systems/item/itemLaw.js';   // the law the Imbue's guard reads
import { setPref } from '../../src/systems/uiPrefs.js';

setPref(LOOT_RARITY_KEY, true);
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const door = (me) => setPlayerDoor(me ? { player: () => me } : null);

test('AUDIT UPDATE P3: the live gate - lootPowers.js registers the live player\'s level once a host publishes the door, Mentor Mode\'s while it is on; none before (mutants: the registry never set; the mentor\'s level unread)', () => {
  door(null);
  assert.equal(rollerLevel(), null, 'no door yet: no gate');
  const me = { level: 4 };
  door(me);
  try {
    assert.equal(rollerLevel(), 4);
    me._mentor = { level: 2 };
    assert.equal(rollerLevel(), 2, 'Mentor Mode\'s level, the one the world is built at');
  } finally { door(null); }
});

test('AUDIT UPDATE P3: every door reads it - rollRarity at the live player\'s level unless the source names its own, rollLootRarity at the level it is handed (mutants: the registry unread; the source\'s level unread; the handed level dropped)', () => {
  const src = pileSource(9);
  const open = rarityChances(src), gated = rarityChances({ ...src, rollerLevel: 1 });
  const r = (Math.max(gated.rare, open.legendary) + open.rare) / 2 / 1000;   // a Rare ungated, a Magic at level 1
  assert.equal(rollRarity(src, () => r), 'rare');
  door({ level: 1 });
  try {
    assert.equal(rollRarity(src, () => r), 'magic', 'the live player\'s level holds it back');
    assert.equal(rollRarity({ ...src, rollerLevel: 20 }, () => r), 'rare', 'a source naming its own level is read at it');
  } finally { door(null); }
  const weapon = () => { for (let i = 0; i < 50; i++) { const w = createRandomWeapon(8, lcg(40 + i)); if (w && rarityEligible(w)) return w; } throw new Error('no weapon'); };
  const a = [weapon()], b = [weapon()];
  rollLootRarity(a, src, { rolls: () => r });
  rollLootRarity(b, src, { rolls: () => r, level: 1 });
  assert.deepEqual([a[0].rarity, b[0].rarity], ['rare', 'magic'], 'the level handed in decides it');
});

test('AUDIT UPDATE P3: the drought - held under DROUGHT_FROM, counted from it (mutants: the hold\'s level moved)', () => {
  const rare = () => ({ rarity: 'rare', untaken: true, templateIndex: 0, group: 'Weapons' });
  try {
    _setDroughtForTests(0);
    door({ level: DROUGHT_FROM - 1 });
    assert.equal(noteTaken(rare()), false);
    assert.equal(droughtOf(), 0, 'one under: nothing counted');
    door({ level: DROUGHT_FROM });
    assert.equal(noteTaken(rare()), true);
    assert.equal(droughtOf(), 1, 'at it: counted');
  } finally { door(null); _setDroughtForTests(0); }
});

test('AUDIT UPDATE P3: an elite\'s share and a revenant\'s - their Rare and Legendary held back at the roller\'s level, nothing else of them (mutants: an elite\'s Rare ungated; its Legendary ungated; a revenant\'s Legendary ungated)', () => {
  const tally = (level, mint, n) => {
    const t = { rare: 0, legendary: 0, gold: 0 };
    withRollerLevel(level, () => {
      for (let seed = 1; seed <= n; seed++) for (const it of mint(lcg(seed))) {
        if (it.rarity === 'rare') t.rare++;
        if (it.rarity === 'legendary') t.legendary++;
        if (it.templateIndex === 0 && it.group === 'Currency') t.gold++;
      }
    });
    return t;
  };
  const eOpen = tally(null, (r) => eliteLoot(12, r), 3000), eGated = tally(1, (r) => eliteLoot(12, r), 3000);
  assert.ok(eOpen.rare >= 100 && eGated.rare * 3 < eOpen.rare, `an elite's Rares: ${eGated.rare} of ${eOpen.rare}`);
  assert.ok(eOpen.legendary >= 15 && eGated.legendary * 5 < eOpen.legendary, `an elite's Legendaries: ${eGated.legendary} of ${eOpen.legendary}`);
  const rOpen = tally(null, (r) => revenantLoot(12, 3, r), 3000), rGated = tally(1, (r) => revenantLoot(12, 3, r), 3000);
  assert.ok(rOpen.legendary >= 15 && rGated.legendary * 5 < rOpen.legendary, `a revenant's Legendaries: ${rGated.legendary} of ${rOpen.legendary}`);
  assert.ok(rGated.rare >= 3000, `a revenant's Rare is its rank's, never gated (AUDIT UPDATE L7: LEFT): ${rGated.rare}`);
});

const plain = (seed) => { for (let i = 0; i < 50; i++) { const w = createRandomWeapon(6, lcg(seed + i)); if (w && rarityEligible(w)) return w; } throw new Error('no weapon'); };
const found = (seed) => { const w = plain(seed); applyRarity(w, 'magic', lcg(seed)); w.isIdentified = true; return w; };
const purse = (gold = 100_000, shards = 50) => ({ level: 3, items: [welkyndShards(shards)], goldPieces: gold });

test('AUDIT UPDATE P3: the Imbue is paid its price to the coin and the shard, once, after the roll; its marks are the new tier\'s (mutants: a free Imbue; the old marks kept; the guild\'s identify skipped)', () => {
  for (const [w, tier] of [[plain(10), 'magic'], [found(20), 'rare']]) {
    if (tier === 'rare') { w.reforged = 0; w.honed = 2; }
    const p = purse(); p.items.push(w);
    const r = imbuePiece(w, p, lcg(3));
    assert.deepEqual(r, { ok: true, tier, price: { ...IMBUE_PRICE[tier] } });
    assert.equal(p.goldPieces, 100_000 - IMBUE_PRICE[tier].gold, `${tier}: the gold`);
    assert.equal(shardsHeld(p.items), 50 - IMBUE_PRICE[tier].shards, `${tier}: the shards`);
    assert.deepEqual([w.rarity, w.imbued, w.isIdentified, 'reforged' in w, 'honed' in w], [tier, true, true, false, false], `${tier}: its marks`);
  }
});

test('AUDIT UPDATE P3: every refusal its own word, nothing charged - off, not, unknown, locked, worn, cursed, set, shards, gold; a made piece and a worn plain one (mutants: each refusal unread; a made piece imbued; a worn piece off the page)', () => {
  const ask = (w, p = purse()) => { p.items.push(w); return imbueRefusal(w, p); };
  setPref(LOOT_RARITY_KEY, false);
  try { assert.equal(ask(found(30)), 'off'); } finally { setPref(LOOT_RARITY_KEY, true); }
  const leg = found(31); leg.rarity = 'legendary';
  assert.equal(ask(leg), 'not', 'never to Legendary');
  const drawback = { type: 30, param: 2 };
  const unknown = { ...found(32), cursed: { ...drawback }, enchantments: [{ ...drawback }], isIdentified: false };   // a found Magic piece reads identified until a row is on it (tradeModes.js itemIsIdentified)
  assert.equal(ask(unknown), 'unknown', 'unidentified - before its curse is known');
  assert.equal(ask({ ...found(33), locked: true }), 'locked');
  const worn = plain(34); worn.equipSlot = 'RightHand';
  assert.equal(imbueTarget(worn), 'magic', 'a worn plain piece stands on the page');
  assert.equal(ask(worn), 'worn', 'and says why');
  assert.equal(ask({ ...found(35), cursed: { ...drawback }, enchantments: [{ ...drawback }] }), 'cursed');
  assert.equal(ask({ ...found(36), sockets: ['ruby'] }), 'set');
  assert.equal(ask(found(37), purse(100_000, IMBUE_PRICE.rare.shards - 1)), 'shards');
  assert.equal(ask(found(38), purse(IMBUE_PRICE.rare.gold - 1)), 'gold');
  assert.equal(imbueTarget({ ...plain(39), provenance: 'smith:1' }), null, 'a made piece is its maker\'s');
  const p = purse(IMBUE_PRICE.rare.gold - 1), w = found(40); p.items.push(w);
  assert.deepEqual(imbuePiece(w, p, lcg(1)), { ok: false, reason: 'gold' });
  assert.deepEqual([p.goldPieces, shardsHeld(p.items), w.rarity], [IMBUE_PRICE.rare.gold - 1, 50, 'magic'], 'nothing charged, nothing changed');
});
