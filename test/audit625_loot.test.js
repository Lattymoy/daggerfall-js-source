// AUDIT 625 (2026-10-05, Mac: "Lets do a comprehensive audit on this"), the LOOT lens: PR #625's LOOT-EASE and
// RENOWN-LOOT, audited. bible/01-Overview/Audit-625.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rollCorpseKit, plainFoeRarityWeights } from '../src/systems/foeLootCap.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { rarityOf, rarityChances, corpseSource } from '../src/systems/lootRarity.js';
import { goldStack } from '../src/systems/inventory.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { setPref, _resetForTests as _resetPrefsForTests } from '../src/systems/uiPrefs.js';

const at = (v) => () => v;
/** A foe's body as the spawn leaves it: its kit on its table and the droppable cut in its list, the same objects. */
const body = (mark = {}, { mobileType = 144, level = 8 } = {}) => {
  const sword = createWeapon(120, 1);   // a Steel Longsword in its hand
  return { e: { mobileType, level, lootCap: 3, items: [goldStack(4), sword], equip: { slots: [sword] }, ...mark }, sword };
};

// ─── KIT-ROLL ────────────────────────────────────────────────────────

test('AUDIT 625 L1: a foe restored from a save still rolls its kit at death - every restore lays the save\'s COPIES over its list and leaves its table alone, so the kit is known by what the spawn\'s roll left unmarked, never by the table\'s objects (mutants: the kit found by the table again)', () => {
  _resetPrefsForTests(); setPref('lootRarity', true);
  try {
    // the dungeon's in-place patch (dungeonContext.js patchFoe) and the street's and the watch's re-spawn and overlay
    // (exteriorFoes.js restoreWorld, cityGuards.js): `sf.items.map((it) => ({ ...it }))`
    const { e, sword } = body();
    e.items = e.items.map((it) => ({ ...it }));
    const piece = e.items[1];
    assert.notEqual(piece, sword, 'a copy, as every restore lays it');
    assert.equal(rollCorpseKit(e, { rolls: at(0) }).length, 1, 'the kit is rolled');
    assert.notEqual(rarityOf(e.items[1]), 'common');
    // a piece the spawn's roll rolled carries LOOT8's mark - never the kit's, never rolled again
    const carried = body();
    carried.e.items[1] = { ...carried.e.items[1], untaken: true };
    assert.deepEqual(rollCorpseKit(carried.e, { rolls: at(0) }), [], 'a carried piece is its spawn roll\'s');
  } finally { _resetPrefsForTests(); }
});

test('AUDIT 625 L2: the kit is laddered as a COPY in the body - the piece on the foe\'s own table stays Common, so a foe brought back to life in place (the save\'s rewind, the stream\'s un-death) fights with what it was minted with (LR4\'s rule) (mutants: the live object laddered)', () => {
  _resetPrefsForTests(); setPref('lootRarity', true);
  try {
    const { e, sword } = body();
    const [won] = rollCorpseKit(e, { rolls: at(0) });
    assert.ok(won && won !== sword, 'the body holds a laddered copy');
    assert.equal(e.items[1], won);
    assert.equal(rarityOf(sword), 'common', 'the table\'s sword - the hand a revived foe swings - is what it was');
    assert.equal(sword.untaken, undefined, 'and unmarked');
    assert.equal(e.equip.slots[0], sword);
    assert.deepEqual(rollCorpseKit(e, { rolls: at(0) }), [], 'once: the copy is marked');
  } finally { _resetPrefsForTests(); }
});

test('AUDIT 625 L3 (Mac: "The plain ladder"): EVERY foe\'s worn kit rolls the plain ladder at its death - a champion\'s, an Elite Dungeon\'s, a titled one\'s and a boss\'s (every humanoid from level 18) as a plain foe\'s, never the boss\'s multiplied ladder; a revenant never (its list holds a player\'s own pieces) (mutants: the bosses left out again; the boss\'s ladder; a revenant\'s list laddered)', () => {
  _resetPrefsForTests(); setPref('lootRarity', true);
  try {
    // level 18: a class foe is a boss (lootRarity.js BOSS_LEVEL) - its kit rolls the plain ladder at tier 18, 140 per mille
    const plainAt18 = rarityChances({ ...corpseSource(ENEMY_BASICS[144], 18, 144), boss: false, weights: plainFoeRarityWeights() }).magic;
    const bossAt18 = rarityChances({ ...corpseSource(ENEMY_BASICS[144], 18, 144), weights: plainFoeRarityWeights() }).magic;
    assert.equal(plainAt18, 140);
    assert.ok(bossAt18 > plainAt18, 'a boss\'s source multiplies the ladder - the kit takes none of it');
    const roll = (plainAt18 + 5) / 1000;   // over the plain threshold, under the boss's
    for (const mark of [{}, { champion: 'mighty' }, { elite: true }, { properName: 'Lord Plessington' }, { lootCap: undefined }]) {
      const blue = body(mark, { level: 18 });
      rollCorpseKit(blue.e, { rolls: at(0.13) });
      assert.equal(rarityOf(blue.e.items[1]), 'magic', `${JSON.stringify(mark)}: the kit rolls`);
      const white = body(mark, { level: 18 });
      rollCorpseKit(white.e, { rolls: at(roll) });
      assert.equal(rarityOf(white.e.items[1]), 'common', `${JSON.stringify(mark)}: on the plain ladder, never a boss's`);
    }
    const rev = body({ revenant: { id: 'r1' } });
    assert.deepEqual(rollCorpseKit(rev.e, { rolls: at(0) }), [], 'a revenant: its list is a player\'s');
    assert.equal(rarityOf(rev.e.items[1]), 'common');
  } finally { _resetPrefsForTests(); }
});

// ─── THE CAP ─────────────────────────────────────────────────────────

test('AUDIT 625 L5: a joiner\'s copy of a body and an arrival\'s are capped as the host\'s death caps its own - after their kit, their food and their sigils - so no copy the room may adopt (WORLD4: the first opener\'s list is the room\'s) carries past its cap (mutants: either copy uncapped)', async () => {
  const { readFileSync } = await import('node:fs');
  const dc = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  // PIN MOVED (AUDIT CARDS-6 A3): each copy draws for its own card before its cap, as the host's death does
  assert.match(dc, /if \(r\.d === 1 && !f\.dead\) \{ rollCorpseKit\(f\.entity, [^;]*\); addCorpseFood\(f\.entity, [^;]*\); stampWonWeapons\(f\.entity\.items, f\._fightN \?\? 1\); dropFoeCard\(f\.entity\); capFoeLoot\(f\.entity\); \}/, 'the stream\'s death of a joiner\'s copy');
  assert.match(dc, /if \(wire && sf\.dead && !f\.dead && sf\.items == null\) \{ rollCorpseKit\(f\.entity, [^;]*\); addCorpseFood\(f\.entity, [^;]*\); stampWonWeapons\(f\.entity\.items, 1\); dropFoeCard\(f\.entity\); capFoeLoot\(f\.entity\); \}/, 'an arrival\'s copy the room hands without its list');
  // and the cap itself, on a copy the food overfilled: gold kept, the best by tier, then the supplies, then the dearest
  const { capFoeLoot } = await import('../src/systems/foeLootCap.js');
  const e = { lootCap: 3, items: [goldStack(4), { name: 'a', group: 'Weapons', value: 10 }, { name: 'b', group: 'Armor', value: 20 }, { name: 'meat', group: 'UselessItems2', value: 1 }, { name: 'c', group: 'Armor', value: 5 }] };
  capFoeLoot(e);
  assert.equal(e.items.length, 3);
});

// ─── THE KIT'S ROLL, WHOLE ───────────────────────────────────────────

test('AUDIT 625 L6: the kit rolls what its record says - the player\'s luck (LOOT13: 1% of each threshold a point), the finders on its Legendary threshold, the door\'s last pass (a Magic piece\'s chance at a line that does something) and the foe\'s family steering its Legendary\'s pick (mutants: luck dropped; the finders dropped; the last pass dropped; the family dropped)', async () => {
  const { registerLegendaryFind, isProcAffix, foundAmong } = await import('../src/systems/lootRarity.js');
  _resetPrefsForTests(); setPref('lootRarity', true);
  try {
    // luck: tier 8's plain Magic is 90 per mille at luck 50, 135 at luck 100 (LOOT13: half again) - a roll of 0.12 between them
    const lucky = body(); rollCorpseKit(lucky.e, { rolls: at(0.12), luck: 100 });
    assert.equal(rarityOf(lucky.e.items[1]), 'magic', 'luck 100: blue');
    const plain = body(); rollCorpseKit(plain.e, { rolls: at(0.12), luck: 50 });
    assert.equal(rarityOf(plain.e.items[1]), 'common', 'luck 50: white');
    // the finders: a roll of 0.01 is under tier 8's Rare (15.6) and over its Legendary (0.75); a finder of a thousand
    // lifts the Legendary threshold to the Rare's
    const bare = body(); rollCorpseKit(bare.e, { rolls: at(0.01) });
    assert.equal(rarityOf(bare.e.items[1]), 'rare');
    registerLegendaryFind('audit625', () => 1000);
    try {
      const found = body(); rollCorpseKit(found.e, { rolls: at(0.01) });
      assert.equal(rarityOf(found.e.items[1]), 'legendary', 'the finders read');
    } finally { registerLegendaryFind('audit625', null); }
    // the last pass: a Magic piece rolled at 0.0899 draws its line at 89.9 per mille, under LOOT4's 200
    const blue = body(); const [won] = rollCorpseKit(blue.e, { rolls: at(0.0899) });
    assert.equal(won.rarity, 'magic');
    assert.ok(won.affixes.some(isProcAffix), 'the door\'s last pass gave it a line that does something');
    // the family: a Legendary rolled from a Warrior's kit picks the warriors' own records five to one; from a Mage's,
    // the casters' - the same seeds, so only the family moves the pick
    const seeded = (seed) => { let a = seed, first = true; return () => { if (first) { first = false; return 0; } a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const warriors = (mobileType) => {
      let n = 0;
      for (let s = 1; s <= 200; s++) { const b = body({}, { mobileType }); const [p] = rollCorpseKit(b.e, { rolls: seeded(s) }); if (p?.legendary && foundAmong(p.legendary) === 'warrior') n++; }
      return n;
    };
    assert.ok(warriors(144) > warriors(128), `a Warrior's kit finds the warriors' records more often than a Mage's (${warriors(144)} against ${warriors(128)})`);
  } finally { _resetPrefsForTests(); }
});

// ─── REST-LOOT ONLINE ────────────────────────────────────────────────

test('AUDIT 625 L4: an Ember Jar\'s fire crosses the wire as a jar - REST-LOOT opened the jar\'s use online, and a peer\'s copy of it was a plain campfire ("You see a campfire.") with the jar\'s own words unreachable; `j` is 1 or the record is refused whole, and a fire of wood carries none (mutants: the jar dropped at either end)', async () => {
  const { campWire, validCampRecord, campFromWire, CAMP_KIND } = await import('../src/systems/survival/camp.js');
  const jar = { id: 'c1', kind: CAMP_KIND.Fire, pos: [1, 2, 3], yaw: 0, litUntil: 500, wear: 0, jar: true };
  const wood = { ...jar, id: 'c2', jar: undefined };
  const r = validCampRecord(campWire(jar));
  assert.ok(r, 'the jar\'s record is a record');
  assert.equal(campFromWire(r, 'peer-1').jar, true, 'the peer\'s copy is a jar');
  assert.equal(campFromWire(validCampRecord(campWire(wood)), 'peer-1').jar, undefined, 'a fire of wood is none');
  assert.equal(campWire(wood).j, undefined);
  assert.equal(validCampRecord({ ...campWire(jar), j: 2 }), null, 'outside its law: refused whole');
  assert.equal(validCampRecord({ ...campWire(jar), j: true }), null);
});
