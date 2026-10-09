// INT1 (the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): THE HONEST PRODUCERS, SWEPT. Not a .test.js on
// purpose (the manifest counts suites, and this is a fixture): every item home this tree has, called the way the game
// calls it, on seeded rolls - so the item law (src/systems/itemLaw.js itemFindings) can be pinned against what an
// honest client really mints, never against hand-written literals.
//
//   honestItems({ seeds }) -> [{ source, item }]   each item a deep copy taken the moment its producer handed it over
//   honestItemsSkipped     -> [{ source, error }]  every producer (or import) that could not run headless, and why
//
// THE ROLLS ARE SEEDED. A producer that takes a `rolls` stream gets a seeded one; one that rolls on Math.random inside
// (the loot table, the shop shelf, the foe's kit) runs with Math.random swapped for a seeded stream for the length of
// its call, and put back after - so the same `seeds` answer the same items on every run.
//
// THE SHIPPED GAME'S SWITCHES. The sweep runs with every vendored mod on (MO1: the shipped default - a test that imported
// test/modsOff.js gets them back on for the sweep's length), Loot Rarity on, and passes beside that with the mods off,
// online (a page with `?online`), and the sigils online.
//
// THE STATE IS PUT BACK. The switches a sweep turns (the Loot Rarity pref, the sigil's online flag, the ladder's test
// rates, the mods' Enabled, the page's location, Unleveled Loot's world reader, the quest UID counter, DFRandom's seed)
// are read before and restored after. What the game's own boot registers (scenes/shared.js and systems/worldTick.js:
// Roleplay & Realism: Items' templates and patches, the Foraging, Smithing, Healing Supply, Rest, Cooking, Unleveled
// Loot and corpse-food hooks) is installed ONCE, on the first call, as the boot installs it, and left installed - the
// game never uninstalls them either; a suite that pins DFU's own numbers should not share a process with this sweep.
//
// EACH PRODUCER IS FENCED: one that throws headless is recorded in honestItemsSkipped and the sweep goes on.

/** Module loads that failed, kept apart so each honestItems() call reports them again. */
const IMPORT_FAILS = [];
const errText = (e) => String(e?.stack ?? e).split('\n').slice(0, 3).map((s) => s.trim()).join(' | ').slice(0, 400);
async function load(path) {
  try { return await import(new URL(path, import.meta.url)); } catch (e) { IMPORT_FAILS.push({ source: `import ${path}`, error: errText(e) }); return null; }
}

const LOOT = await load('../src/systems/loot.js');
const LR = await load('../src/systems/lootRarity.js');
const PREFS = await load('../src/systems/uiPrefs.js');
const SIGIL = await load('../src/systems/sigil.js');
const MODS = await load('../src/systems/modSettings.js');
const INV = await load('../src/systems/inventory.js');
const EQUIP = await load('../src/systems/equip.js');
const TPL = await load('../src/systems/itemTemplates.js');
const ENEMY_EQ = await load('../src/combat/enemyEquipment.js');
const BASICS = await load('../src/characters/enemyBasics.js');
const ENEMY = await load('../src/characters/enemyEntity.js');
const HOST_COMBAT = await load('../src/scenes/hostCombat.js');
const CORPSE = await load('../src/scenes/corpseMarker.js');
const CHAMP = await load('../src/systems/champions.js');
const ELITE = await load('../src/systems/eliteFoes.js');
const GATE = await load('../src/systems/gateSpoils.js');
const SPOILS_POOL = await load('../src/scenes/spoilsPool.js');
const RAID = await load('../src/systems/raidSpoils.js');
const SERPENT = await load('../src/systems/serpentSpoils.js');
const SD = await load('../src/systems/sdSpoils.js');
const BROKER = await load('../src/systems/sigilBroker.js');
const AETH = await load('../src/systems/aetheric.js');
const GILD = await load('../src/systems/gilded.js');
const REFORGE = await load('../src/systems/reforge.js');
const CODEX = await load('../src/systems/lootCodex.js');
const MAGIC_DEF = await load('../src/formats/magicDef.js');
const { DFU_MAGIC_ITEMS } = await load('./dfuMagicItems.mjs');
const SHOP = await load('../src/systems/shopStock.js');
const CONTAINER = await load('../src/systems/containerLoot.js');
const SCENE_CACHE = await load('../src/systems/sceneCache.js');
const START = await load('../src/systems/startingGear.js');
const RRI_KITS = await load('../src/systems/rriKits.js');
const RRI_INSTALL = await load('../src/systems/rriInstall.js');
const ILIAC = await load('../src/systems/iliacItems.js');
const CARDS = await load('../src/net/iliacCards.js');
const RECIPES = await load('../src/net/recipeLaw.js');
const SMITH = await load('../src/systems/smithItems.js');
const COOK = await load('../src/systems/cookItems.js');
const BAG = await load('../src/systems/materialsBag.js');
const ALCH = await load('../src/systems/alchemyItems.js');
const ALCH_LAW = await load('../src/net/alchemyLaw.js');
const TEMPER = await load('../src/net/temperLaw.js');
const PRODUCT = await load('../src/net/productRecord.js');
const IDTOKEN = await load('../src/net/identityToken.js');
const ENCH = await load('../src/systems/enchanting.js');
const CAT = await load('../src/systems/enchantmentCatalogue.js');
const CREATE = await load('../src/systems/createItem.js');
const CREATE_ROWS = await load('../src/systems/createItemRows.js');
const REST = await load('../src/systems/restItems.js');
const REST_ROWS = await load('../src/systems/restItemRows.js');
const SURV_ITEMS = await load('../src/systems/survival/items.js');
const SURV_LOOT = await load('../src/systems/survival/loot.js');
const SURV_SWITCH = await load('../src/systems/survival/switch.js');
const FORAGE = await load('../src/systems/foragingInstall.js');
const FORAGE_LAW = await load('../src/systems/foragingLaw.js');
const THUNDER = await load('../src/systems/thunderlock.js');
const AYLEID = await load('../src/systems/ayleidStones.js');
const WALLET = await load('../src/systems/walletItem.js');
const KEEPSAKE = await load('../src/systems/livingWorld/keepsake.js');
const HEIRLOOM = await load('../src/systems/legacy/heirloom.js');
const CSA = await load('../src/systems/comeSailAwayItems.js');
const NAVAL = await load('../src/systems/naval/navalStores.js');
const FISH = await load('../src/systems/deepWatersFishItems.js');
const FISH_ROWS = await load('../src/systems/deepWatersFishRows.js');
const BOOKS = await load('../src/systems/books.js');
const HEALING = await load('../src/systems/healingSupply.js');
const UNLEVELED = await load('../src/systems/unleveledLoot.js');
const SEARCH = await load('../src/systems/searchables.js');
const BOUNTY = await load('../src/systems/bountyReward.js');
const RITE = await load('../src/systems/riteChest.js');
const TROPHY = await load('../src/systems/revenantTrophy.js');
const BIOG = await load('../src/systems/biography.js');
const REPAIR = await load('../src/systems/repairService.js');
const TRADE = await load('../src/systems/tradeModes.js');
const LOCK = await load('../src/systems/itemLock.js');
const DFR = await load('../src/formats/dfRandom.js');
const LOOT_POWERS = await load('../src/systems/lootPowers.js');
const ITEM_IDS = await load('../src/systems/itemIds.js');
const TRANSFER = await load('../src/systems/itemTransfer.js');
const WILD_DEATH = await load('../src/systems/wildDeath.js');
const TALK = await load('../src/systems/talkTopics.js');
const KNIGHT = await load('../src/systems/knightlyGifts.js');
const BAG_LAW = await load('../src/net/bagLaw.js');
const OCEAN = await load('../src/world/oceanHoles.js');
const MAKER_UI = await load('../src/ui/itemMakerWindow.js');
const RACES = await load('../src/systems/races.js');

// ── the seeded streams ───────────────────────────────────────────────

/** A seeded uniform stream in [0, 1) (an LCG, the suite's own `seeded`). */
export const seeded = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
/** A stable 32-bit hash of a string, so every producer has its own seed space. */
const hashOf = (text) => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** Run `fn` with Math.random a seeded stream - and the two homes that captured Math.random at import (Foraging's loot
 *  draw, the loot powers' chance) and DFRandom's global state seeded with it - putting each back after. */
function withSeededMath(seed, fn) {
  const real = Math.random;
  const stream = seeded(seed);
  const dfSeed = DFR?.getSeed?.();
  Math.random = stream;
  FORAGE?._setForagingRandomForTests?.(stream);
  LOOT_POWERS?._setLootPowersRandForTests?.(stream);
  DFR?.setSeed?.(seed);
  try { return fn(); } finally {
    Math.random = real;
    FORAGE?._setForagingRandomForTests?.(null);
    LOOT_POWERS?._setLootPowersRandForTests?.(null);
    if (dfSeed !== undefined) DFR.setSeed(dfSeed);
  }
}
/** A deep copy - the moment a producer hands an item over, later operations never reach back into the record. */
const copyItem = (item) => { try { return structuredClone(item); } catch { return JSON.parse(JSON.stringify(item)); } };
const range = (n) => Array.from({ length: n }, (_, i) => i);
/** At most `n` of a list, spread evenly over it (every door's pieces, not the first door's). */
const spread = (list, n) => (list.length <= n ? list : range(n).map((i) => list[Math.floor((i * list.length) / n)]));

// ── the switches, put back after ─────────────────────────────────────

function withPref(key, value, fn) {
  const was = PREFS.getPref(key);
  PREFS.setPref(key, value);
  try { return fn(); } finally { PREFS.setPref(key, was); }
}
function withSigilOnline(fn) {
  const was = SIGIL.sigilOnline();
  SIGIL.setSigilOnline(true);
  try { return fn(); } finally { SIGIL.setSigilOnline(was); }
}
/** The ladder's rare marks forced up (the curse, the socket, the Exalted and the proc line), the module's own seams. */
function withForcedMarks(fn) {
  LR._setCurseForTests(1);
  LR._setSocketForTests(1000);   // every tier the pass takes (a Rare, a Legendary), per mille
  LR._setExaltedForTests(1000);
  LR._setProcForTests({ magic: 1000, rare: 1000 });
  try { return fn(); } finally {
    LR._setCurseForTests(null);
    LR._setSocketForTests(null);
    LR._setExaltedForTests(null);
    LR._setProcForTests(null);
  }
}
/** Every vendored mod on (`true`, the shipped default) or off (`false`, DFU's own game) for `fn`, each put back. */
function withMods(on, fn) {
  const was = [];
  for (const [vendor, def] of Object.entries(MODS.MOD_SETTINGS)) {
    if (!def.keys?.Enabled) continue;
    was.push([vendor, MODS.modSetting(vendor, 'Enabled')]);
    MODS.setModSetting(vendor, 'Enabled', on);
  }
  try { return fn(); } finally { for (const [vendor, v] of was) MODS.setModSetting(vendor, 'Enabled', v); }
}

/** The page an online session plays on (systems/onlineLane.js isOnlinePage reads `?online`), for `fn`, put back. */
function withOnlinePage(fn) {
  const had = Object.hasOwn(globalThis, 'location');
  const was = globalThis.location;
  try { Object.defineProperty(globalThis, 'location', { value: { search: '?online=1', href: 'http://localhost/?online=1' }, configurable: true, writable: true }); } catch { return fn(); }
  try { return fn(); } finally {
    if (had) Object.defineProperty(globalThis, 'location', { value: was, configurable: true, writable: true });
    else delete globalThis.location;
  }
}

// ── the game's own boot registrations, once ──────────────────────────

let _booted = false;
function bootOnce(skip) {
  if (_booted) return;
  _booted = true;
  const step = (name, fn) => { try { fn(); } catch (e) { skip(`boot ${name}`, e); } };
  step('rri', () => RRI_INSTALL.installRoleplayRealismItems({ fetchBytes: async () => new Uint8Array(0) }));
  step('foraging', () => FORAGE.installForaging({ fetchBytes: async () => new Uint8Array(0) }));
  step('smithing', () => SMITH.installSmithing());
  step('healing', () => HEALING.installHealingSupply());
  step('rest', () => REST.installRestItemLoot());
  step('cooking', () => COOK.installCooking());
  step('unleveled', () => UNLEVELED.installUnleveledLoot());
  step('survival corpse food', () => SURV_LOOT.installSurvivalLoot({ enabled: SURV_SWITCH.corpseFoodOn }));   // worldTick.js's own install
}

// ── a synthetic MAGIC.DEF (the tree carries no ARENA2): its rows in the shapes readMagicDef answers ──

function craftMagicDef(records) {
  const SIZE = MAGIC_DEF.MAGIC_ITEM_RECORD_SIZE;
  const buf = new Uint8Array(4 + records.length * SIZE);
  const v = new DataView(buf.buffer);
  v.setInt32(0, records.length, true);
  let o = 4;
  for (const r of records) {
    for (let i = 0; i < r.name.length && i < 31; i++) buf[o + i] = r.name.charCodeAt(i);
    o += 32;
    buf[o++] = r.type; buf[o++] = r.group; buf[o++] = r.groupIndex ?? 0;
    for (let i = 0; i < 10; i++) { v.setInt8(o++, r.ench?.[i]?.[0] ?? -1); v.setInt8(o++, r.ench?.[i]?.[1] ?? 0); }
    v.setInt16(o, r.uses ?? 100, true); o += 2;
    v.setInt32(o, r.value ?? 0, true); o += 4;
    buf[o++] = r.material ?? 0;
  }
  return buf;
}
/** DFU's own MAGIC.DEF (test/dfuMagicItems.mjs - its MagicItemTemplates.txt, the table DFU reads): the thirty-six regular
 *  magic items, one row each, and the twenty-three artifacts, as readMagicDef answers them. PIN MOVED (INT1's audit,
 *  2026-10-09): the sweep minted its magic from sixty-four invented records of one to three rows of any kind - shapes no
 *  MAGIC.DEF holds, which the item law now proves against DFU's table. */
function fakeMagicTemplates() {
  return MAGIC_DEF.readMagicDef(craftMagicDef(DFU_MAGIC_ITEMS));
}

// ── the player a sweep plays as ──────────────────────────────────────

function newPlayer({ level = 10, gender = 'male', gold = 1_000_000 } = {}) {
  return {
    isPlayer: true, level, gender, goldPieces: gold, items: [], wagonItems: [],
    stats: { strength: 60, intelligence: 60, willpower: 60, agility: 60, endurance: 60, personality: 60, speed: 60, luck: 50 },
    skills: new Array(35).fill(40), activeEffects: [], career: { luck: 50 },
  };
}

/** A foe's career where the game reads ENEMY{nnn}.CFG / CLASS{nn}.CFG (ARENA2's, absent here): DFU's middle stats. */
const CAREER_STUB = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, hitPointsPerLevel: 8 });

// ── THE SWEEP ────────────────────────────────────────────────────────

export const honestItemsSkipped = [];

/**
 * Every honest producer's items. `seeds` scales the sweep (40: about a hundred thousand items in a few seconds; 4 for a
 * quick pass). `wire: true` hands each item over as JSON carries it (a save, a checkpoint, the wire - an undefined field
 * dropped, as the account service and validLootItem see it); the default is the live record, deep-copied as it stood.
 * @param {{ seeds?: number, wire?: boolean }} [opts]
 * @returns {{ source: string, item: any }[]}
 */
export function honestItems({ seeds = 40, wire = false } = {}) {
  /** @type {{ source: string, item: any }[]} */
  const out = [];
  const copyOut = wire ? (it) => JSON.parse(JSON.stringify(it)) : copyItem;
  honestItemsSkipped.length = 0;
  honestItemsSkipped.push(...IMPORT_FAILS);
  const skip = (source, e) => honestItemsSkipped.push({ source, error: errText(e) });
  const put = (source, item) => { if (item && typeof item === 'object' && !Array.isArray(item)) out.push({ source, item: copyOut(item) }); };
  const putAll = (source, list) => { for (const it of list ?? []) put(source, it); };
  /** A producer, fenced: its own seed space, Math.random seeded, a throw recorded. */
  const run = (source, fn) => {
    const skipOne = (what, e) => { if (!honestItemsSkipped.some((x) => x.source === `${source}: ${what}`)) skip(`${source}: ${what}`, e); };
    try { withSeededMath(hashOf(source), () => fn((it) => put(source, it), (list) => putAll(source, list), skipOne)); } catch (e) { skip(source, e); }
  };
  try { withMods(true, () => sweep({ seeds, run, skip })); } catch (e) { skip('the sweep', e); }
  return out;
}

/** The sweep proper, under the shipped game's switches (every vendored mod on - MO1's default - with the explicit
 *  "(mods off)" passes beside them). */
function sweep({ seeds, run, skip }) {
  bootOnce(skip);
  _csaUid = 0;
  CHAMP?._resetStreetChampionsForTests?.();
  const S = Math.max(1, seeds | 0);
  const seedsOf = (n = S) => range(n).map((i) => hashOf(`seed${i}`) ^ (i * 2654435761));
  const levels = [1, 5, 10, 18, 30];
  const genders = ['male', 'female'];
  /** Rarity-laddered pieces kept for the Reforge and the item maker below. */
  const minted = [];
  const keep = (list) => { for (const it of list ?? []) if (it && typeof it === 'object') minted.push(it); };

  withPref('lootRarity', true, () => {
    // ── 1. DFU's loot tables, every key, then the ladder at its sources ──
    const keys = Object.keys(LOOT.LOOT_MATRICES ?? {});
    const sources = () => [
      ...LR.DUNGEON_RARITY_TIER.map((t, d) => ({ ...LR.pileSource(t), family: LR.dungeonFamily(d) })),
      LR.pileSource(LR.INTERIOR_RARITY_TIER),
      LR.pileSource(0), LR.pileSource(21, true),
      LR.corpseSource({ level: 1 }, 1, 0), LR.corpseSource({ level: 12 }, 12, 7), LR.corpseSource({ level: LR.BOSS_LEVEL }, LR.BOSS_LEVEL, 31),
      LR.corpseSource({ level: 21, affinity: 'Daedra' }, 21, 26),
    ];
    for (const mods of [true, false]) {
      run(`loot.generateItems${mods ? '' : ' (mods off)'}`, (one, all) => withMods(mods, () => {
        let n = 0;
        for (const key of keys) {
          for (const level of levels) {
            for (const s of seedsOf(Math.max(1, Math.ceil(S / 8)))) {
              const gender = genders[n++ % 2];
              const rolls = seeded(s ^ hashOf(key) ^ level);
              const items = LOOT.generateItems(key, { level, gender }, rolls);
              LOOT.addPileLootExtras(items, key, rolls, { locationIndex: n % 19, luck: 50, level, online: n % 3 === 0, where: n % 2 ? 'dungeon' : null });
              all(items);
            }
          }
        }
      }));
    }
    const ladder = (label, forced) => run(`lootRarity.rollLootRarity${label}`, (one, all) => {
      const go = () => {
        let n = 0;
        for (const key of keys) {
          for (const level of levels) {
            for (const src of sources()) {
              if (n++ % Math.max(1, Math.round(40 / S)) !== 0) continue;
              const rolls = seeded(hashOf(`${key}${level}${n}`));
              const items = LOOT.generateItems(key, { level, gender: genders[n % 2] }, rolls);
              LOOT.addPileLootExtras(items, key, rolls, { locationIndex: n % 19, luck: 50, level });
              LR.rollLootRarity(items, { ...src, qualityMult: [1, 1.2, 1.5][n % 3] }, { rolls, luck: [10, 50, 90][n % 3] });
              withSigilOnline(() => LR.stampWonWeapons(items, 1 + (n % 8), { rolls }));
              all(items); keep(items);
            }
          }
        }
      };
      if (forced) withForcedMarks(go); else go();
    });
    ladder('', false);
    ladder(' (forced curse/socket/exalted/proc)', true);
    // the same door over hand-made weapon and armour lists, so every base the ladder takes is rolled at every tier
    run('lootRarity.applyRarity over every weapon and armour base', (one, all) => withForcedMarks(() => {
      const weapons = Object.values(ENEMY_EQ.WEAPONS_ENUM);
      const armors = Object.values(ENEMY_EQ.ARMOR_ENUM);
      for (const s of seedsOf(Math.max(2, Math.ceil(S / 4)))) {
        const rolls = seeded(s);
        const list = [
          ...weapons.map((t, i) => ENEMY_EQ.createWeapon(t, i % 10, rolls)),
          ...armors.map((t, i) => TPL.mintCondition(TPL.setItemFields({ group: 'Armor', templateIndex: t, material: [0, 0x100, 0x200, 0x205, 0x209][i % 5] }))),
          ...range(8).map(() => TPL.mintCondition(TPL.setItemFields(LOOT.createRandomJewellery(rolls)))),
          ...range(8).map(() => TPL.mintCondition(TPL.setItemFields(LOOT.createRandomClothing(genders[s & 1], rolls)))),
        ];
        LR.rollLootRarity(list, LR.pileSource(18, true), { rolls, luck: 100 });
        all(list); keep(list);
      }
    }));
    // the corpse door, through the spawn seam (hostCombat.spawnEnemyLoot) and the death's handlers
    run('hostCombat.spawnEnemyLoot + raiseEnemyDeath', (one, all) => {
      const types = Object.keys(BASICS.ENEMY_BASICS).map(Number);
      let n = 0;
      for (const mobileType of types) {
        for (const s of seedsOf(Math.max(1, Math.ceil(S / (mobileType >= 128 ? 4 : 10))))) {
          const basics = BASICS.ENEMY_BASICS[mobileType];
          const level = levels[n++ % levels.length];
          const player = { level, gender: genders[n % 2], stats: { luck: 50 }, activeEffects: [] };
          const e = ENEMY.makeEnemyEntity(mobileType, basics, CAREER_STUB, level, seeded(s));
          if (n % 5 === 0) CHAMP.applyChampion(e, n % CHAMP.CHAMPION_TRAITS.length);
          if (n % 7 === 0) e.eliteFoe = true;
          HOST_COMBAT.spawnEnemyLoot(e, mobileType, basics, player, { rolls: seeded(s ^ 7) });
          CORPSE.raiseEnemyDeath(e, { rolls: seeded(s ^ 11), luck: 50 });
          withSigilOnline(() => LR.stampWonWeapons(e.items, 1 + (n % 4), { rolls: seeded(s ^ 13) }));
          all(e.items); keep(e.items);
        }
      }
    });
    run('hostCombat.equipEnemy (a foe\'s kit and its poisoned blade)', (one, all) => {
      for (const mobileType of Object.keys(BASICS.ENEMY_BASICS).map(Number)) {
        for (const s of seedsOf(mobileType >= 128 ? S : 2)) {
          const e = ENEMY.makeEnemyEntity(mobileType, BASICS.ENEMY_BASICS[mobileType], CAREER_STUB, 10, seeded(s));
          e.items = [];
          const eq = HOST_COMBAT.equipEnemy(e, mobileType, 1 + (s % 30), seeded(s ^ 3), { player: newPlayer() });
          if (!eq) continue;
          one(e.weapon); all(e.items);
        }
      }
    });
    run('lootRarity.rollCorpseLoot (forced marks)', (one, all) => withForcedMarks(() => {
      for (const s of seedsOf()) {
        const rolls = seeded(s);
        const body = { items: LOOT.generateItems('Q', { level: 20, gender: 'male' }, rolls), level: 21, mobileType: 26, champion: s & 1 ? 'mighty' : undefined };
        LR.rollCorpseLoot(body, { level: 21, affinity: 'Daedra' }, { rolls, luck: 90 });
        all(body.items); keep(body.items);
      }
    }));
    run('eliteFoes.eliteLoot / grantEliteLoot', (one, all) => {
      for (const s of seedsOf()) for (const level of levels) { const items = ELITE.eliteLoot(level, seeded(s ^ level)); all(items); keep(items); }
    });

    // ── 2. the sigils: every won list at every party size ──
    run('lootRarity.stampWonWeapons (sigil online, parties 1..8)', (one, all) => withSigilOnline(() => withForcedMarks(() => {
      for (let party = 1; party <= 8; party++) {
        for (const s of seedsOf(Math.max(1, Math.ceil(S / 4)))) {
          const rolls = seeded(s ^ party);
          const items = LOOT.generateItems('H', { level: 20, gender: 'male' }, rolls);
          // GenerateRandomLoot's own mint around each draw (loot.js: mintCondition(named(it)))
          items.push(...range(6).map(() => TPL.mintCondition(TPL.setItemFields(LOOT.createRandomArmor(20, rolls)))), ...range(6).map(() => TPL.mintCondition(TPL.setItemFields(LOOT.createRandomWeapon(20, rolls)))));
          LR.rollLootRarity(items, LR.pileSource(18, true), { rolls, luck: 80 });
          LR.stampWonWeapons(items, party, { rolls });
          for (const it of items) if (it.sigil) SIGIL.drinkSigil?.(it, Math.floor(rolls() * 5000));
          all(items); keep(items);
        }
      }
    })));

    // ── 3. the spoils: the gate's, a town's thanks, the serpent's hoard, the Hour's ──
    run('gateSpoils.rollSpoils / spoilsPool.spoilsList', (one, all) => {
      for (const s of seedsOf(S * 2)) for (const level of levels) {
        const list = SPOILS_POOL ? SPOILS_POOL.spoilsList(s, level, s % 5 === 0 ? { x: 'rite' } : s % 3 === 0 ? { r: 1 } : null) : GATE.rollSpoils(s, level).pieces.map((p) => ({ kind: 'item', item: p.item }));
        for (const p of list) if (p.kind === 'item') { one(p.item); keep([p.item]); }
      }
    });
    run('raidSpoils.raidSpoilsList', (one) => {
      for (const s of seedsOf(S * 2)) for (const level of levels) for (const party of [0, 1, 2, 3]) {
        for (const p of RAID.raidSpoilsList(s, level, party)) if (p.kind === 'item') { one(p.item); keep([p.item]); }
      }
    });
    run('serpentSpoils.serpentSpoilsList', (one) => {
      for (const s of seedsOf(S * 2)) for (const level of levels) for (const earned of ['dealt', 'stood']) {
        for (const p of SERPENT.serpentSpoilsList(s, level, earned)) if (p.kind === 'item') { one(p.item); keep([p.item]); }
      }
    });
    run('sdSpoils.sdSpoilsList', (one) => {
      for (const s of seedsOf(S * 2)) for (const level of levels) {
        for (const p of SD.sdSpoilsList(s, level)) if (p.kind === 'item') { one(p.item); keep([p.item]); }
      }
    });

    // ── 4. the Sigil Broker's days, and a sale made off one ──
    run('sigilBroker.brokerStock (days 0..400)', (one) => {
      for (let day = 0; day <= 400; day++) for (const offer of BROKER.brokerStock(day)) { one(offer.item); keep([offer.item]); }
    });
    run('sigilBroker.makeBrokerSale', (one) => {
      for (let day = 0; day < Math.max(4, S); day += 1) {
        for (const offer of BROKER.brokerStock(day)) {
          BROKER._resetBrokerForTests();
          const embers = Object.assign(GATE.sigilStone(), { stackCount: 20 });
          const items = [embers];
          const r = BROKER.makeBrokerSale(offer, { items, day });
          if (r.ok) one(r.item);
          for (const it of items) one(it);   // the embers the price left
        }
      }
      BROKER._resetBrokerForTests();
    });

    // ── 5. every Aetheric and Gilded record ──
    run('aetheric.mintAetheric (every record, parties 1..8)', (one) => {
      for (const r of AETH.AETHERIC_RECORDS) for (let party = 1; party <= 8; party++) one(AETH.mintAetheric(r, { party }));
      for (const s of seedsOf()) {
        const rolls = seeded(s);
        for (const it of [AETH.rollRegalia(rolls), AETH.rollRaidSetPiece(s % 3, rolls), AETH.rollSerpentSetPiece(rolls), AETH.rollNumidiumPiece(rolls)]) one(it);
      }
    });
    run('gilded.mintGilded / mintHourlock', (one) => {
      for (const r of GILD.GILDED_RECORDS) one(GILD.mintGilded(r));
      one(GILD.mintHourlock());
      for (const s of seedsOf(S * 4)) one(GILD.rollHourlock(seeded(s)));   // one draw in fifty
    });

    // ── 6. the Reforge, on the pieces the doors above minted ──
    runReforge(run, minted, seedsOf);
    // ── 7-12: the shelves, the chargen kit, the crafts, the item maker, every other home, the pack's own acts ──
    runShops(run, seedsOf, S);
    runChargen(run, seedsOf);
    const crafted = runCrafts(run, seedsOf, S, minted);
    runItemMaker(run, seedsOf, S, crafted, minted);
    runHomes(run, seedsOf, S, minted);
    runQuestItems(run, seedsOf);
    runPackActs(run, seedsOf, minted);
  });
}

/** The Loot arc's services on pieces an honest door minted: the Reforge's reforge and hone (until no line is left to
 *  hone), the socket's setting and unsetting, the codex's imprint, an Exalted's and a curse's own passes, a salvage's
 *  shards - each through the player-facing door (reforge.js), paid from a purse that holds the price. */
function runReforge(run, minted, seedsOf) {
  const tiered = (n) => spread(minted.filter((it) => it?.rarity === 'magic' || it?.rarity === 'rare' || it?.rarity === 'legendary'), n);
  const purse = (item) => {
    const p = newPlayer();
    p.items.push(item, Object.assign(GATE.welkyndShards(1)[0] ?? GATE.welkyndShards(1), { stackCount: 5000 }));
    for (const g of LR.GEM_IDS) p.items.push(TPL.mintCondition(TPL.setItemFields({ group: 'Gems', templateIndex: LR.GEM_IDS.indexOf(g), stackCount: 1 })));
    return p;
  };
  run('reforge.reforgePiece', (one) => {
    let n = 0;
    for (const base of tiered(400)) {
      n++;
      const item = copyItem(base);
      item.isIdentified = true;
      const p = purse(item);
      const lines = LR.reforgeableLines(item);
      if (!lines.length) continue;
      const r = REFORGE.reforgePiece(item, lines[n % lines.length], p, seeded(n));
      if (r.ok) one(item);
    }
  });
  run('reforge.honePiece (until no line is left)', (one) => {
    let n = 0;
    for (const base of tiered(300)) {
      n++;
      const item = copyItem(base);
      item.isIdentified = true;
      const p = purse(item);
      for (let guard = 0; guard < 64; guard++) {
        const lines = LR.honeableLines(item);
        if (!lines.length) break;
        const r = REFORGE.honePiece(item, lines[guard % lines.length], p, seeded(n * 97 + guard));
        if (!r.ok) break;
        one(item);
      }
    }
  });
  run('reforge.setGemPiece / unsetGemPiece', (one) => {
    let n = 0;
    for (const base of spread(minted.filter((it) => LR.hasSocket(it)), 300)) {
      n++;
      const item = copyItem(base);
      item.isIdentified = true;
      const p = purse(item);
      if (LR.socketGem(item)) { const u = REFORGE.unsetGemPiece(item, p); if (u.ok) one(item); }
      const gem = LR.GEM_IDS[n % LR.GEM_IDS.length];
      const r = REFORGE.setGemPiece(item, gem, p);
      if (r.ok) one(item);
      if (n % 2 === 0) { const u = REFORGE.unsetGemPiece(item, p); if (u.ok) one(item); }
    }
  });
  run('lootRarity.exaltLegendary / cursePiece', (one) => {
    let n = 0;
    for (const base of tiered(600)) {
      n++;
      const item = copyItem(base);
      if (item.rarity === 'legendary' && !item.exalted) { LR.exaltLegendary(item, seeded(n)); one(item); }
      if ((item.rarity === 'rare' || item.rarity === 'legendary') && !LR.isCursed(item)) { const c = copyItem(base); if (LR.cursePiece(c, seeded(n ^ 5))) one(c); }
    }
  });
  run('lootCodex.imprintPiece', (one) => {
    CODEX._resetCodexForTests();
    for (const it of minted) if (it?.rarity === 'legendary') CODEX.noteFind(copyItem(it), { quiet: true });
    let n = 0;
    for (const base of spread(minted.filter((it) => it?.rarity === 'rare'), 300)) {
      n++;
      const item = copyItem(base);
      item.isIdentified = true;
      const p = purse(item);
      const choices = CODEX.imprintChoices(item) ?? [];
      if (!choices.length) continue;
      const id = choices[n % choices.length]?.id ?? choices[n % choices.length];
      const r = CODEX.imprintPiece(item, id, p);
      if (r?.ok) one(item);
    }
    CODEX._resetCodexForTests();
  });
  run('reforge.salvagePiece (the shards it pays)', (one) => {
    let n = 0;
    for (const base of tiered(60)) {
      n++;
      const item = copyItem(base);
      item.isIdentified = true;
      const items = [item];
      const r = REFORGE.salvagePiece(item, { items });
      if (r?.ok) for (const it of items) one(it);
    }
  });
}

// ── 7. the shelves ───────────────────────────────────────────────────

/** Unleveled Loot's world reader for `fn` (its shop and dungeon rolls read the player and the place through it), put back. */
function withUnleveledWorld(world, fn) {
  const was = UNLEVELED?._worldReader?.() ?? null;
  UNLEVELED?.setUnleveledLootWorld?.(world);
  try { return fn(); } finally { UNLEVELED?.setUnleveledLootWorld?.(was); }
}
/** Come Sail Away's shelf subscriber, as the world host registers it (scenes/world.js csaShelfStocked): the UID DFU's
 *  construction gives (Date.now()*1000 + a count there; a fixed clock here), then AssignVariantsToShopItems. */
let _csaUid = 0;
const csaShelfStocked = (items) => CSA.assignVariantsToShopItems(CSA.mintShelfBoatUids(items, () => 1_760_000_000_000_000 + (_csaUid++ % 1000)), (min, max) => min + Math.floor(Math.random() * (max - min)));

function runShops(run, seedsOf, S) {
  const shopTypes = Object.keys(SHOP.SHOP_ITEM_GROUPS ?? {}).map(Number);
  const few = () => seedsOf(Math.max(1, Math.ceil(S / 10)));
  run('shopStock.stockShopShelf + OnLootSpawned (RRI, Foraging, Come Sail Away)', (one, all) => {
    for (const buildingType of shopTypes) for (const quality of [1, 5, 10, 15, 20]) for (const s of few()) for (const shelfIndex of [0, 1]) {
      const player = newPlayer({ level: 1 + (s % 30) });
      const rolls = seeded(s ^ (buildingType * 977) ^ quality);
      const items = withUnleveledWorld({ playerEntity: () => player, insideOpenShop: () => true, buildingQuality: () => quality },
        () => SHOP.stockShopShelf({ buildingType, quality }, player, { rolls, shelfIndex, torchesFromItems: (s & 1) === 1 }));
      CONTAINER.raiseContainerLootSpawned({ containerType: SCENE_CACHE.LOOT_CONTAINER_TYPES.ShopShelves, items, buildingType, quality, luck: 50, rolls });
      csaShelfStocked(items);
      all(items);
    }
  });
  run('shopStock.stockShopShelf (online page)', (one, all) => withOnlinePage(() => {
    for (const buildingType of shopTypes) for (const quality of [1, 10, 20]) for (const s of few()) for (const shelfIndex of [0, 1]) {
      const player = newPlayer({ level: 1 + (s % 30) });
      const rolls = seeded(s ^ (buildingType * 131) ^ quality);
      const items = SHOP.stockShopShelf({ buildingType, quality }, player, { rolls, shelfIndex, torchesFromItems: false });
      CONTAINER.raiseContainerLootSpawned({ containerType: SCENE_CACHE.LOOT_CONTAINER_TYPES.ShopShelves, items, buildingType, quality, luck: 50, rolls });
      csaShelfStocked(items);
      all(items);
    }
  }));
  run('shopStock.stockShopShelf (mods off)', (one, all) => withMods(false, () => {
    for (const buildingType of shopTypes) for (const quality of [1, 10, 20]) for (const s of few()) {
      all(SHOP.stockShopShelf({ buildingType, quality }, newPlayer(), { rolls: seeded(s ^ buildingType ^ quality), torchesFromItems: false }));
    }
  }));
  run('shopStock.stockHouseContainer + OnLootSpawned', (one, all) => {
    for (let buildingType = 0; buildingType <= 23; buildingType++) for (const record of [0, 2, 5, 12, 16]) for (const s of few()) {
      const rolls = seeded(s ^ (buildingType * 31) ^ record);
      const items = SHOP.stockHouseContainer({ buildingType, record }, newPlayer({ level: 1 + (s % 20) }), { rolls, contRand: () => Math.floor(rolls() * 0x8000) });
      CONTAINER.raiseContainerLootSpawned({ containerType: SCENE_CACHE.LOOT_CONTAINER_TYPES.HouseContainers, items, buildingType, quality: 10, luck: 50, rolls });
      all(items);
    }
  });
  run('shopStock guild shelves (magic items from a synthetic MAGIC.DEF, soul gems, potions)', (one, all) => {
    const magic = fakeMagicTemplates();
    for (const quality of [0, 4, 8, 12, 16, 20]) for (let day = 0; day < S; day++) {
      const gameMinutes = day * 1440 + 600;
      all(SHOP.stockGuildMagicItems({ quality, gameMinutes, sellsSoulGems: day % 2 === 0 }, { magicItemTemplates: magic, playerLevel: 1 + (day % 30), gender: day % 2 ? 'female' : 'male', soulPointsOf: (soul) => soul * 100 }));
      all(SHOP.stockSoulGems({ quality, gameMinutes }, { soulPointsOf: (soul) => soul * 50 }));
      all(SHOP.stockGuildPotions({ quality, gameMinutes }));
    }
  });
  run('shopStock.createRandomlyFilledSoulTrap / createEmptySoulTrap', (one) => {
    for (const s of seedsOf(S * 2)) one(SHOP.createRandomlyFilledSoulTrap(seeded(s), (soul) => soul * 30));
    one(SHOP.createEmptySoulTrap());
  });
  run('restItems.restItemsStock / survival provisionsStock, campfireStock, ensureEndlessProvisions', (one, all) => {
    for (const s of seedsOf()) for (const quality of [1, 10, 20]) {
      for (const kind of Object.keys(REST.REST_SHELVES)) all(REST.restItemsStock(kind, quality, seeded(s ^ quality), { online: (s & 1) === 1 }));
      all(SURV_ITEMS.provisionsStock(quality, seeded(s ^ 3), { campfires: (s & 2) === 0 }));
      all(SURV_ITEMS.campfireStock(seeded(s ^ 5)));
      all(SURV_ITEMS.ensureEndlessProvisions?.([]) ?? []);
    }
  });
  run('loot magic items (synthetic MAGIC.DEF): createRegularMagicItem, generateItems MI, createArtifact', (one, all) => {
    const magic = fakeMagicTemplates();
    const was = LOOT.getMagicItemTemplates();
    LOOT.setMagicItemTemplates(magic);
    try {
      for (const s of seedsOf(S * 2)) {
        const rolls = seeded(s);
        one(LOOT.createRegularMagicItem(magic, 1 + (s % 30), s & 1 ? 'female' : 'male', rolls));
        all(LOOT.generateItems(['A', 'C', 'E', 'J', 'K', 'O', 'T'][s % 7], { level: 1 + (s % 30), gender: 'male' }, rolls));
      }
      const artifacts = magic.filter((t) => t.type === 1 || t.type === 2).length;
      for (let i = 0; i < artifacts; i++) for (const gender of ['male', 'female']) one(LOOT.createArtifact(magic, i, { gender }));
    } finally { LOOT.setMagicItemTemplates(was); }
  });
}

// ── 8. character creation ────────────────────────────────────────────

function runChargen(run, seedsOf) {
  const races = Object.keys(RACES?.RACES ?? { Breton: 1 });
  run('startingGear.assignStartingGear (every class and custom, both genders, every race across them)', (one, all) => {
    for (let classIndex = 0; classIndex < 18; classIndex++) for (const isCustom of [false, true]) for (const gender of ['male', 'female']) for (const race of (isCustom ? races.slice(0, 1) : races).filter((_, r) => isCustom || (r + classIndex) % 3 === 0 || r === 0)) {
      const e = { ...newPlayer({ level: 1, gender, gold: 0 }), race };
      START.assignStartingGear(e, { classIndex, isCustom, rolls: seeded(hashOf(`${classIndex}${gender}${race}${isCustom}`)), torchesFromItems: classIndex % 2 === 0 });
      ILIAC?.giveBinderAtChargen?.(e);
      all(e.items);
    }
  });
  run('rriKits.assignSkillEquipment (every skill as primary and major)', (one, all) => {
    const skills = range(35);
    for (let i = 0; i < skills.length; i += 3) for (const gender of ['male', 'female']) for (const luck of [30, 50, 80]) for (const bits of [0, 0b001000000, 0b011000000]) {
      const career = { luck, primarySkills: skills.slice(i, i + 3), majorSkills: skills.slice((i + 9) % 35, ((i + 9) % 35) + 3), weaponArmorShieldsBitfield: bits, forbiddenMaterials: 0 };
      const e = { ...newPlayer({ level: 1, gender, gold: 0 }), career };
      RRI_KITS.assignSkillEquipment(e, { rolls: seeded(hashOf(`${i}${gender}${luck}${bits}`)), torchesFromItems: luck === 80 });
      all(e.items);
    }
  });
  run('biography.applyBiographyEffect IT (the chargen questions\' items)', (one, all) => {
    const lines = [];
    for (let gi = 0; gi < 18; gi++) for (const mat of [0, 1, 2, 5, 9]) lines.push(`IT 3 ${gi} ${mat}`);
    for (let gi = 0; gi < 11; gi++) for (const mat of [0, 3, 6, 9]) lines.push(`IT 2 ${gi} ${mat}`);
    for (const g of [7, 10, 14, 25, 15, 17, 27]) for (let gi = 0; gi < 4; gi++) lines.push(`IT ${g} ${gi} 0`);
    for (const [i, line] of lines.entries()) {
      const e = { ...newPlayer({ level: 1, gold: 0 }), sGroupReputations: [0, 0, 0, 0, 0] };
      BIOG.applyBiographyEffect(e, line, { rolls: seeded(i + 1) });
      all(e.items);
    }
  });
}

// ── 9. the crafts ────────────────────────────────────────────────────

/** The service's provenance id (server-account/src/professions.js provenanceId): 16 hex. */
const provenanceOf = (n) => (hashOf(`prov${n}`).toString(16).padStart(8, '0') + hashOf(`ance${n}`).toString(16).padStart(8, '0')).slice(0, 16);
/** An UNSIGNED product record (net/productRecord.js: "unsigned is a real answer") - what a temper's answer re-mints from. */
function unsignedRecord(claims) {
  if (!PRODUCT.productRecordValid(claims)) return null;
  return `${PRODUCT.PRODUCT_RECORD_V}.${IDTOKEN._b64url.encode(new TextEncoder().encode(JSON.stringify(claims)))}.`;
}

function runCrafts(run, seedsOf, S, minted) {
  const crafted = [];
  const R = RECIPES;
  run('smithItems.mintPiece (every recipe, every quality, hands, dyes, marks)', (one) => {
    let n = 0;
    for (const r of R.RECIPES) {
      for (let q = 0; q <= 4; q++) {
        if (!R.rollsQuality(r) && q > 0) break;
        const quality = R.rollsQuality(r) ? q : -1;
        const hands = r.kind === 'jewel' ? [null, R.jewelHand(r, R.GOLDSMITH), R.jewelHand(r, R.GEMCUTTER)] : r.kind === 'dish' ? [null, R.dishHand(r, R.CHEF), R.dishHand(r, R.PROVISIONER)] : [null];
        for (const hand of [...new Set(hands)]) {
          const seed = hashOf(`${r.id}${q}${hand}`) >>> 0;
          const maker = n % 4 === 0 ? null : R.makerMark?.('Ysolde') ?? 'Ysolde';
          const marked = maker !== null && R.carriesMark(r, quality, n % 3 === 0 ? 'master-joiner' : null);
          const dye = r.kind === 'garment' && r.dyes === true ? R.GARMENT_DYES[n % R.GARMENT_DYES.length] : null;
          const prov = provenanceOf(n++);
          const item = SMITH.mintPiece({ recipe: r.id, quality, seed, maker, marked, dye, hand }, prov);
          if (!item) continue;
          one(item);
          crafted.push({ item, claims: { p: prov, s: 'acct_honest', h: 'char_honest', r: r.id, q: quality, m: maker, c: seed, i: 1_760_000_000, ...(marked ? { a: 1 } : {}), ...(dye == null ? {} : { u: dye }), ...(hand == null ? {} : { f: hand }) } });
        }
      }
    }
  });
  run('smithItems.mintFieldRepairKit / maybeAddFieldKit', (one, all) => {
    one(SMITH.mintFieldRepairKit());
    for (const s of seedsOf()) { const items = []; SMITH.maybeAddFieldKit(items, 100, seeded(s)); all(items); }
  });
  run('cookItems.mintDish (every dish, every hand)', (one) => {
    let n = 0;
    for (const r of R.RECIPES.filter((x) => x.kind === 'dish')) for (const hand of [null, R.HAND_CHEF, R.HAND_PROVISIONER]) {
      one(COOK.mintDish({ recipe: r.id, maker: n % 2 ? 'Ysolde' : null, hand }, provenanceOf(10_000 + n++)));
    }
  });
  run('materialsBag.mintCarried (every material key, the bag and the pack)', (one, all) => {
    const keys = BAG.materialKeys();
    for (const [i, key] of keys.entries()) {
      for (const cc of [true, false]) {
        const e = newPlayer();
        if (i % 2) e.items.push(TPL.mintCondition(TPL.setItemFields({ group: 'UselessItems2', templateIndex: BAG_LAW.BAG_TEMPLATE })));   // half with a Materials Bag
        BAG.mintCarried(e, key, 1 + (i % 7), { cc, slowRot: i % 3 === 0, noRot: i % 5 === 0 });
        all(e.items); all(e.bagItems);
      }
    }
  });
  run('alchemyItems.brewItems (every potion, potent and not)', (one, all) => {
    for (const p of ALCH_LAW.POTIONS) for (const potent of [0, 25, 40]) for (const count of [1, 2, 3]) all(ALCH.brewItems({ potion: p.id, count, potent }));
  });
  run('smithItems.temperItem (crafted pieces, through their re-signed record)', (one) => {
    for (const { item: base, claims } of crafted) {
      const r = R.recipeById(claims.r);
      if (!TEMPER.temperableRecipe(r)) continue;
      const item = copyItem(base);
      let q = TEMPER.pieceQuality(item);
      for (let guard = 0; guard < 4 && !TEMPER.temperRefusal(item); guard++) {
        const record = unsignedRecord({ ...claims, q: q + 1 });
        if (!SMITH.temperItem(item, { quality: q + 1, record })) break;
        one(item);
        q = TEMPER.pieceQuality(item);
      }
    }
  });
  run('smithItems.temperItem (found pieces, Standard to Superior)', (one) => {
    for (const base of spread(minted.filter((it) => !TEMPER.temperRefusal(it)), 1500)) {
      const item = copyItem(base);
      for (let guard = 0; guard < 3 && !TEMPER.temperRefusal(item); guard++) {
        if (!SMITH.temperItem(item, { quality: TEMPER.pieceQuality(item) + 1 })) break;
        one(item);
      }
    }
  });
  run('smithItems.reforgeItem (Essence, on crafted and found Magic/Rare)', (one) => {
    let n = 0;
    const tiered = (list) => list.filter((it) => it?.rarity === 'magic' || it?.rarity === 'rare');
    for (const base of [...spread(tiered(crafted.map((c) => c.item)), 300), ...spread(tiered(minted), 300)]) {
      const item = copyItem(base);
      item.isIdentified = true;
      const lines = LR.reforgeableLines(item);
      if (!lines.length) continue;
      if (SMITH.reforgeItem(item, lines[n % lines.length], hashOf(`ess${n++}`))) one(item);
    }
  });
  run('smithItems.useRepairKit (crafted kits on worn pieces)', (one, all) => {
    const kits = [...crafted.map((c) => c.item).filter((it) => it.templateIndex === R.REPAIR_KIT_TEMPLATE), SMITH.mintFieldRepairKit()];
    const worn = spread(minted.filter((it) => (it.group === 'Weapons' || it.group === 'Armor') && it.maxCondition > 0 && !TPL.isAmmunition(it) && EQUIP.wearableItem(it)), kits.length * 6);
    let n = 0;
    for (const kit of kits) {
      // a player whose kit meets its pieces worn down the way play wears them (equip.js lowerCondition), some still on
      const e = newPlayer();
      const k = copyItem(kit);
      e.items.push(k);
      for (const base of worn.slice(n * 6, n * 6 + 6)) {
        const it = copyItem(base);
        e.items.push(it);
        EQUIP.equipItem(e, it);
        EQUIP.lowerCondition(it, Math.max(1, Math.floor(it.maxCondition * 0.7)), e);
        if (n % 2) EQUIP.unequipItem(e, it);
      }
      n++;
      SMITH.useRepairKit(k, e.items, { pack: e.items });
      all(e.items);
    }
  });
  return crafted;
}

// ── 10. the item maker ───────────────────────────────────────────────

/** ui/itemMakerWindow.js itemMakerFilter's predicate, any tab: what the window lists at all. */
function makerTakes(item) {
  if (MAKER_UI?.itemMakerFilter) return ['WeaponsAndArmor', 'Ingredients', 'ClothingAndMisc'].some((tab) => MAKER_UI.itemMakerFilter(item, tab, null));
  if (!ENCH.keptEnchantments(item) || item.group === 'UselessItems2' || ENCH.itemMakerRefuses(item)) return false;
  return ['Weapons', 'Armor', 'Gems', 'MensClothing', 'WomensClothing', 'Jewellery'].includes(item.group) && !(item.group === 'Weapons' && item.name === 'Arrow');
}

/**
 * ONE HONEST SESSION AT THE ITEM MAKER over `item`, as ui/itemMakerWindow.js drives it: the picker's guard
 * (openPickerDecision), its primary list (primaryPickerList, the pack's souls among it), the secondary (primaryPick) and
 * the room check (pickEnchantment - a bound soul's forced set beside it), a row the budget cannot hold taken back off
 * (removeEnchantment, the list's own remove), and the Enchant button only when enchantDecision says 'enchant' -
 * applyEnchantments with the player as owner, and sometimes a name typed in. Answers whether the item was enchanted.
 */
function makerSession(item, rolls, { souls, owner, picks = 6 }) {
  const kept = ENCH.keptEnchantments(item) ?? [];
  const keptPowers = kept.filter((e) => !CAT.isSideEffect(e.type)), keptSides = kept.filter((e) => CAT.isSideEffect(e.type));
  let powers = [], sideEffects = [];
  const lists = () => ({ powers: [...keptPowers, ...powers], sideEffects: [...keptSides, ...sideEffects] });
  const pick = (list) => list[Math.floor(rolls() * list.length)];
  for (let step = 0; step < picks; step++) {
    const selectingPowers = rolls() < 0.65;
    const all = lists();
    if (ENCH.openPickerDecision(selectingPowers, { item, ...all }).kind === 'refuse') break;
    const types = CAT.primaryPickerList(selectingPowers, { item, ...all, souls });
    if (!types.length) continue;
    const type = rolls() < 0.25 && types.includes('SoulBound') ? 'SoulBound' : pick(types);
    const pk = CAT.primaryPick(type, { ...all, selectingPowers, souls });
    if (!pk) continue;
    let key = null;
    if (pk.kind === 'add') {
      if (!pk.settings) continue;
      (selectingPowers ? powers : sideEffects).push(pk.settings);
      key = pk.settings.key;
    } else {
      if (!pk.options.length) continue;
      const o = pick(pk.options);
      const res = CAT.pickEnchantment(type, o.param, all);
      if (!res || res.kind === 'noRoom') continue;
      (selectingPowers ? powers : sideEffects).push(res.settings);
      powers.push(...res.powers);
      sideEffects.push(...res.sideEffects);
      key = res.settings.key;
    }
    // the player reads the cost label and takes back a row the item cannot hold
    if (ENCH.enchantDecision(item, powers, sideEffects, { gold: 1e12 }).kind === 'overLimit') {
      powers = CAT.removeEnchantment(powers, key);
      sideEffects = CAT.removeEnchantment(sideEffects, key);
    }
  }
  const d = ENCH.enchantDecision(item, powers, sideEffects, { gold: 1e12 });
  if (d.kind !== 'enchant') return null;
  // "Only enchant one item from stack" (:751-754): SplitStack(selectedItem, 1) - the rows land on a split-off single
  let target = item;
  if ((item.stackCount ?? 1) > 1) {
    const pack = owner.items ?? (owner.items = []);
    if (!pack.includes(item)) pack.push(item);
    target = INV.splitStack(pack, item, 1) ?? item;
  }
  ENCH.applyEnchantments(target, [...powers, ...sideEffects], { owner });
  if (rolls() < 0.3) target.name = `Honest ${target.name ?? 'Piece'}`.slice(0, 32);
  return target;
}

function runItemMaker(run, seedsOf, S, crafted, minted) {
  const souls = [...Object.keys(CAT.SOUL_FORCED_ENCHANTMENTS).map(Number), 0, 3, 7, 13];
  const bases = (rolls) => {
    const out = [];
    for (const t of Object.values(ENEMY_EQ.WEAPONS_ENUM)) out.push(ENEMY_EQ.createWeapon(t, Math.floor(rolls() * 10), rolls));
    for (const t of Object.values(ENEMY_EQ.ARMOR_ENUM)) out.push(ENEMY_EQ.armorOfMaterial(t, [0, 0x100, 0x200, 0x203, 0x206, 0x209][Math.floor(rolls() * 6)]));
    for (const t of TPL.GROUP_TEMPLATE_INDICES.Jewellery) out.push(TPL.mintCondition(TPL.setItemFields({ group: 'Jewellery', templateIndex: t })));
    for (const t of TPL.GROUP_TEMPLATE_INDICES.Gems) out.push(TPL.mintCondition(TPL.setItemFields({ group: 'Gems', templateIndex: t })));
    for (const g of ['male', 'female']) for (let i = 0; i < 4; i++) out.push(TPL.mintCondition(TPL.setItemFields(LOOT.createRandomClothing(g, rolls))));
    return out;
  };
  run('enchanting.applyEnchantments (the item maker, legal picks, over every base)', (one) => {
    for (const s of seedsOf(Math.max(2, Math.ceil(S / 2)))) {
      const rolls = seeded(s);
      for (const item of bases(rolls)) {
        if (!makerTakes(item)) continue;
        one(makerSession(item, rolls, { souls, owner: newPlayer(), picks: 3 + Math.floor(rolls() * 8) }));
      }
    }
  });
  run('enchanting.applyEnchantments (SoulBound with its forced set)', (one) => {
    let n = 0;
    for (const soul of Object.keys(CAT.SOUL_FORCED_ENCHANTMENTS).map(Number)) {
      for (const s of seedsOf(Math.max(2, Math.ceil(S / 4)))) {
        const rolls = seeded(s ^ soul);
        for (const item of bases(rolls)) {
          if (!makerTakes(item) || n++ % 3) continue;
          const pk = CAT.pickEnchantment('SoulBound', soul, { powers: [], sideEffects: [] });
          if (!pk || pk.kind !== 'add') continue;
          const powers = [pk.settings, ...pk.powers], sideEffects = [...pk.sideEffects];
          if (ENCH.enchantDecision(item, powers, sideEffects, { gold: 1e12 }).kind !== 'enchant') continue;
          const owner = newPlayer();
          const target = (item.stackCount ?? 1) > 1 ? (owner.items.push(item), INV.splitStack(owner.items, item, 1) ?? item) : item;
          ENCH.applyEnchantments(target, [...powers, ...sideEffects], { owner });
          one(target);
        }
      }
    }
  });
  run('enchanting.applyEnchantments (crafted jewellery, its Rare roll kept)', (one) => {
    let n = 0;
    for (const { item: base } of crafted) {
      if (base.group !== 'Jewellery') continue;
      const item = copyItem(base);
      if (!makerTakes(item)) continue;
      one(makerSession(item, seeded(hashOf(`jewel${n++}`)), { souls, owner: newPlayer(), picks: 6 }));
    }
  });
  run('enchanting.applyEnchantments (found Magic and common pieces the window lists)', (one) => {
    let n = 0;
    for (const base of spread(minted.filter(makerTakes), 800)) {
      const item = copyItem(base);
      const owner = newPlayer();
      const made = makerSession(item, seeded(hashOf(`found${n++}`)), { souls, owner, picks: 4 });
      if (made) { one(made); if (made !== item) one(item); }   // a stack's single, and the plain rest of it
    }
  });
}

// ── 11. every other home ─────────────────────────────────────────────

const FOOD = await load('../src/systems/survival/food.js');
const BOAT = await load('../src/systems/comeSailAwayBoat.js');
const BOOKS_DATA = await load('../src/systems/booksData.js');
const REVENANT = await load('../src/systems/revenant.js');
const RR_QUEST = await load('../src/systems/rrQuestLine.js');
const RRI_ITEMS = await load('../src/systems/rriItems.js');

function runHomes(run, seedsOf, S, minted) {
  run('createItem.createTempItem (every row, both genders)', (one) => {
    for (let i = 0; i < CREATE_ROWS.CREATE_ITEM_ROWS.length; i++) for (const gender of ['male', 'female']) for (const s of seedsOf(3)) {
      one(CREATE.createTempItem(i, { gender, nowMinutes: 1000 + (s % 500), rounds: 5 + (s % 60), rolls: seeded(s ^ i) }));
    }
  });
  run('restItems.createRestItem (every row)', (one) => {
    for (const row of REST_ROWS.REST_ITEM_ROWS) for (const n of [1, 3]) one(REST.createRestItem(row.index, { stackCount: n }));
    for (const s of seedsOf()) { const items = []; REST.rollRestLoot(items, REST.REST_PILE_CHANCES.map(([t]) => [t, 100]), seeded(s), { online: true }); for (const it of items) one(it); }
  });
  run('survival items (every row, every food stage, a skin full and empty)', (one) => {
    for (const t of SURV_ITEMS.SURVIVAL_TEMPLATES) {
      one(SURV_ITEMS.createSurvivalItem(t.index));
      if (FOOD.FOOD[t.index]) for (let stage = 0; stage <= 4; stage++) one(SURV_ITEMS.createSurvivalItem(t.index, { foodStage: stage }));
    }
    for (const water of [0, 1, 5]) one(SURV_ITEMS.createSurvivalItem(FOOD.TEMPLATE.Waterskin, { water }));
    for (const it of SURV_ITEMS.startingProvisions()) one(it);
    one(SURV_ITEMS.startingCampfire());
    const raw = SURV_ITEMS.createSurvivalItem(FOOD.TEMPLATE.RawMeat);
    one(SURV_ITEMS.dressFood?.(raw) ?? raw);
    const bread = SURV_ITEMS.createSurvivalItem(FOOD.TEMPLATE.Bread);
    SURV_ITEMS.spoilFood?.(bread); one(bread);
  });
  run('survival corpse food (survival/loot.js corpseFood)', (one, all) => {
    for (const mobileType of Object.keys(BASICS.ENEMY_BASICS).map(Number)) for (const s of seedsOf(2)) {
      all(SURV_LOOT.corpseFood({ mobileType, basics: BASICS.ENEMY_BASICS[mobileType], items: [] }, { luck: 50 + (s % 50), rolls: seeded(s ^ mobileType) }));
    }
  });
  run('foragingInstall.createForagingItem (every row)', (one) => {
    for (const t of FORAGE_LAW.FORAGING_TEMPLATES) one(FORAGE.createForagingItem(t.index));
    for (const s of seedsOf()) {
      const items = [];
      FORAGE.onForagingPileLoot({ items, locationIndex: s % 19, luck: 50 });
      FORAGE.onForagingContainerLoot({ items, buildingType: s % 16, quality: 1 + (s % 20), luck: 50 });
      FORAGE.onForagingEnemyDeath({ items, mobileType: s % 40, basics: BASICS.ENEMY_BASICS[s % 40] ?? {} }, { luck: 50 });
      for (const it of items) one(it);
    }
  });
  run('thunderlock.createThunderlock / createPellets', (one) => {
    for (let material = 0; material <= 9; material++) one(THUNDER.createThunderlock({ material }));
    for (const n of [1, 5, 20, 50]) one(THUNDER.createPellets(n));
  });
  run('ayleidStones / gateSpoils stones', (one) => {
    one(AYLEID.welkyndStone()); one(AYLEID.varlaStone());
    for (const n of [1, 3, 10]) { for (const it of [].concat(GATE.welkyndShards(n) ?? [])) one(it); for (const it of [].concat(GATE.portalStones(n) ?? [])) one(it); }
    one(GATE.sigilStone());
    const e = newPlayer(); GATE.givePortalGift?.(e); for (const it of e.items) one(it);
    const stones = [GATE.sigilStone(), GATE.sigilStone(), ...[].concat(GATE.welkyndShards(2)), GATE.sigilStone()];
    GATE.restackStones(stones);
    GATE.nameEmbers?.(stones);
    for (const it of stones) one(it);
  });
  run('walletItem.mintWallet / giveWallet', (one) => {
    one(WALLET.mintWallet());
    const e = newPlayer(); WALLET.giveWallet(e); for (const it of e.items) one(it);
  });
  run('iliacItems (every card, binders with decks)', (one) => {
    const ids = CARDS.ILIAC_CARDS.map((c) => c.id);
    for (const [i, id] of ids.entries()) one(ILIAC.mintIliacCard(id, 1 + (i % 4)));
    const decks = range(ILIAC.BINDER_DECKS_MAX).map((d) => ({ name: `Deck ${d}`, cards: ids.slice(d, d + 20) }));
    for (const n of [0, 1, 5, ILIAC.BINDER_DECKS_MAX]) one(ILIAC.mintBinder(decks.slice(0, n)));
    one(ILIAC.mintBinder([{ name: 'Starter', cards: [...CARDS.STARTER_DECK] }]));
    const e = newPlayer(); ILIAC.giveBinderAtChargen(e); for (const it of e.items) one(it);
  });
  run('livingWorld/keepsake.mintKeepsake', (one) => {
    for (const s of seedsOf()) one(KEEPSAKE.mintKeepsake({ id: `L${s % 900}.t${s % 7}~${s % 3}`, name: `Resident ${s % 97}`, town: s % 5000, home: s % 3 ? s % 40 : null }));
  });
  run('legacy/heirloom.markHeirloom / attuneHeirloom / mintRemainsItem', (one) => {
    for (const s of seedsOf()) {
      const e = newPlayer();
      const w = LOOT.createRandomWeapon(10, seeded(s));
      if (TPL.isAmmunition(w)) continue;
      const it = TPL.mintCondition(TPL.setItemFields(w));
      e.items.push(it); EQUIP.equipItem(e, it);
      if (!HEIRLOOM.heirloomEligible(it)) continue;
      const h = HEIRLOOM.markHeirloom(it, { line: `line${s % 9}`, house: 'Hlaalu', of: s % 50, from: 'Ysolde' });
      one(h);
      for (let g = 0; g < 3; g++) { HEIRLOOM.attuneHeirloom(h); one(h); }
      one(HEIRLOOM.mintRemainsItem({ line: `line${s % 9}`, of: s % 50, name: 'Ysolde Hlaalu' }));
    }
    // the remains' piece as legacyHost.js layDeathRemains takes it: pickHeirloom over what the fallen wore - found pieces
    const wearable = spread(minted.filter((it) => (it.group === 'Weapons' || it.group === 'Armor') && EQUIP.wearableItem(it) && !TPL.isAmmunition(it)), 300);
    for (let i = 0; i < wearable.length; i += 6) {
      const e = newPlayer();
      for (const base of wearable.slice(i, i + 6)) { const it = copyItem(base); e.items.push(it); EQUIP.equipItem(e, it); }
      const piece = HEIRLOOM.pickHeirloom(e.items);
      if (!piece) continue;
      const h = HEIRLOOM.markHeirloom(piece, { line: `line${i}`, house: 'Dres', of: i, from: 'Tarvyn Dres' });
      one(h);
      HEIRLOOM.attuneHeirloom(h); one(h);
    }
  });
  run('comeSailAwayItems (parts, deeds of every hull and variant)', (one) => {
    let uid = 1_760_000_000_000_000;
    one(CSA.mintBoatItem(CSA.BOAT_PARTS_TEMPLATE, uid++));
    for (let hull = 0; hull < BOAT.HULL_NAMES.length; hull++) for (let variant = 0; variant < BOAT.VARIANT_NAMES.length; variant++) {
      one(CSA.mintDeed(hull, variant, uid++, BOAT.HULL_PRICES?.[hull] ?? 1000));
    }
  });
  run('naval/navalStores.mintStores', (one) => { for (const n of [1, 2, 10, 50]) one(NAVAL.mintStores(n)); });
  run('deepWatersFishItems.createFishItem (every species)', (one) => {
    for (const t of FISH_ROWS.DEEP_WATERS_FISH_TEMPLATES) one(FISH.createFishItem({ templateIndex: t.index }));
  });
  run('inventory.letterOfCredit (the bank\'s letters)', (one) => {
    for (const v of [1, 100, 5000, 250000, 5_000_000]) one(INV.letterOfCredit(v));
  });
  run('gold piles: a dropped purse (itemTransfer.planDropGold), the wild\'s remains (wildDeath.takeWildGold), the legacy remains', (one) => {
    for (const carried of [1, 250, 40_000, 1_000_000]) {
      for (const asked of [1, Math.ceil(carried / 2), carried]) {
        const plan = TRANSFER.planDropGold(String(asked), { carried });
        if (plan.ok) one(INV.goldStack(plan.amount));
        const wagon = TRANSFER.planDropGold(String(asked), { carried, usingWagon: true, remote: [] });
        if (wagon.ok) one(INV.goldStack(wagon.amount));
      }
      const e = { ...newPlayer({ gold: carried }), wagonItems: [INV.goldStack(Math.min(carried, 60_000))] };
      one(WILD_DEATH.takeWildGold(e));
      for (const it of e.wagonItems) one(it);
      const g = HEIRLOOM.remainsGoldOf(carried);
      if (g > 0) one(INV.goldStack(g));
    }
  });
  run('potions: createPotion (every recipe), randomlyAddPotion / Recipe / Map, healing supply', (one, all) => {
    for (const key of LOOT.CLASSIC_RECIPE_KEYS) one(LOOT.createPotion(key));
    for (const s of seedsOf()) {
      const items = [];
      const rolls = seeded(s);
      LOOT.randomlyAddPotion(100, items, rolls); LOOT.randomlyAddPotionRecipe(100, items, rolls); LOOT.randomlyAddMap(100, items, rolls);
      all(items);
    }
    one(HEALING.mintHealingPotion()); one(HEALING.mintMagickaPotion());
  });
  run('books: createRandomBook / createShelfBook / createBook (every title)', (one) => {
    for (const s of seedsOf(S * 2)) { one(BOOKS.createRandomBook(seeded(s))); one(BOOKS.createShelfBook(seeded(s ^ 1))); }
    for (const id of BOOKS_DATA.BOOK_ID_TITLES.keys()) one(BOOKS.createBook(id));
  });
  run('enemyEquipment.createWeapon / armorOfMaterial (every template, every material)', (one) => {
    for (const t of [...Object.values(ENEMY_EQ.WEAPONS_ENUM), ENEMY_EQ.ARROW_TEMPLATE, ...TPL.customItemsForGroup('Weapons')]) for (let m = 0; m <= 9; m++) one(ENEMY_EQ.createWeapon(t, m, seeded(t * 10 + m)));
    for (const t of [...Object.values(ENEMY_EQ.ARMOR_ENUM), ...TPL.customItemsForGroup('Armor')]) for (const m of [0, 0x100, 0x103, ...range(10).map((i) => 0x200 + i)]) one(ENEMY_EQ.armorOfMaterial(t, m));
    for (const s of seedsOf(S * 2)) for (const level of [1, 10, 25]) { const rolls = seeded(s ^ level); one(TPL.mintCondition(TPL.setItemFields(LOOT.createRandomWeapon(level, rolls)))); one(TPL.mintCondition(TPL.setItemFields(LOOT.createRandomArmor(level, rolls)))); one(TPL.mintCondition(TPL.setItemFields(LOOT.createRandomClothing(s & 1 ? 'female' : 'male', rolls)))); }
  });
  run('enemyEquipment.assignEnemyStartingEquipment (DFU and RRI kits, every variant)', (one, all) => {
    for (const mods of [true, false]) withMods(mods, () => {
      for (const mobileType of Object.keys(BASICS.ENEMY_BASICS).map(Number)) for (const variant of [0, 1, 2]) for (const s of seedsOf(2)) {
        const e = ENEMY.makeEnemyEntity(mobileType, BASICS.ENEMY_BASICS[mobileType], CAREER_STUB, 12, seeded(s));
        e.items = [];
        const eq = ENEMY_EQ.assignEnemyStartingEquipment(e, variant, 1 + (s % 30), { player: newPlayer(), rolls: seeded(s ^ variant) });
        all(e.items); all(eq?.worn ?? []);
      }
    });
  });
  run('knightlyGifts.receiveArmorDecision (every rank, the host\'s minter)', (one, all) => {
    for (let rank = 0; rank <= 9; rank++) for (const s of seedsOf(3)) {
      const d = KNIGHT.receiveArmorDecision({ rank, flags: 0 }, { rolls: seeded(s ^ rank), makeArmor: (templateIndex, material) => TPL.mintCondition(TPL.setItemFields({ group: 'Armor', templateIndex, material })) });
      if (d.kind === 'offer') all(d.pieces);
    }
  });
  run('the deep\'s sunken loot (Iliac Puddle No More: world.js dwLootItem, every kind)', (one) => {
    const player = newPlayer({ level: 14 });
    for (const s of seedsOf()) for (const kind of ['religious', 'potion', 'jewellery', 'gem', 'clothing', 'weapon', 'armor']) {
      // the host's own arm, line for line (scenes/world.js dwLootItem)
      const level = Math.max(1, player.level | 0), gender = s & 1 ? 'female' : 'male', roll = seeded(s ^ hashOf(kind));
      const item = kind === 'religious' ? LOOT.createRandomReligiousItem(roll) : kind === 'potion' ? LOOT.createRandomPotion(roll)
        : kind === 'jewellery' ? LOOT.createRandomJewellery(roll) : kind === 'gem' ? LOOT.createRandomGem(roll)
          : kind === 'clothing' ? LOOT.createRandomClothing(gender, roll) : kind === 'weapon' ? LOOT.createRandomWeapon(level, roll) : LOOT.createRandomArmor(level, roll);
      one(item ? TPL.mintCondition(TPL.setItemFields(item)) : null);
    }
  });
  run('rrQuestLine.rrCustomArmorStock (every level band)', (one, all) => { for (const level of [1, 5, 10, 15, 20, 30]) all(RR_QUEST.rrCustomArmorStock(level)); });
  run('unleveledLoot (Daedric and Orcish drops, a corpse\'s gold)', (one, all) => {
    const player = newPlayer({ level: 12 });
    withUnleveledWorld({ playerEntity: () => player, insideDungeon: () => true, locationDungeonType: () => 14 }, () => {
      UNLEVELED.unleveledLootPreTransition();
      for (const s of seedsOf(S * 2)) {
        const hi = () => 0.999;
        for (const id of [31, 29, 26, 25, 27]) { const loot = []; UNLEVELED.addDaedric(loot, id, (s & 1) ? hi : seeded(s ^ id)); all(loot); }
        for (const id of [24, 21, 12, 7]) { const loot = []; UNLEVELED.addOrcish(loot, id, (s & 1) ? hi : seeded(s ^ id)); all(loot); }
        const e = { items: LOOT.generateItems('Q', { level: 12, gender: 'male' }, seeded(s)), mobileType: 26, basics: BASICS.ENEMY_BASICS[26] };
        UNLEVELED.unlevelDroppedLoot(e, { rolls: seeded(s ^ 9) });
        all(e.items);
        for (const r of [UNLEVELED.unleveledRandomMaterial(seeded(s)), UNLEVELED.unleveledRandomArmorMaterial(seeded(s ^ 1))]) void r;
      }
    });
  });
  run('oceanHoles.addBonusMagicLoot / upgradeLoot (the abyss\'s pile)', (one, all) => {
    const magic = fakeMagicTemplates();
    for (const s of seedsOf()) {
      const rolls = seeded(s);
      const key = ['K', 'N', 'M', 'Q', 'U'][s % 5];
      const items = LOOT.generateItems(key, { level: 15, gender: 'male' }, rolls);
      OCEAN.addBonusMagicLoot(Math.max(30, LOOT.lootMatrix(key).MI), items, () => TPL.mintCondition(TPL.setItemFields(LOOT.createRegularMagicItem(magic, 15, 'male', rolls))), rolls);
      OCEAN.upgradeLoot(items, {
        remintWeapon: (ti, m) => ENEMY_EQ.weaponOfMaterial(ti, m),
        remintArmor: (ti, m, v) => ENEMY_EQ.armorOfMaterial(ti, m, v),
        isCustom: (it) => !!RRI_ITEMS?.customItemClass?.(it.templateIndex),
        isEnchanted: INV.isEnchanted,
      });
      all(items);
    }
  });
  run('searchables.mintSearchFind (every kind)', (one, all) => {
    for (const kind of Object.keys(SEARCH.SEARCH_KINDS)) for (const s of seedsOf(Math.max(2, Math.ceil(S / 4)))) {
      all(SEARCH.mintSearchFind(kind, { level: 1 + (s % 30), gender: s & 1 ? 'female' : 'male', tier: s % 22, family: null, luck: 50, rolls: seeded(s) }));
    }
  });
  run('bountyReward.mintBountyItem', (one) => { for (const s of seedsOf(S * 2)) for (const level of [1, 5, 10, 20, 40]) one(BOUNTY.mintBountyItem(level, { rolls: seeded(s ^ level), rarityOn: true })); });
  run('riteChest.riteChestItems / riteBrand', (one, all) => {
    for (const s of seedsOf(S * 2)) for (const level of [1, 10, 30]) { all(RITE.riteChestItems(level, seeded(s ^ level))); one(RITE.riteBrand(level, seeded(s))); }
  });
  run('revenantTrophy.revenantTrophy / revenant.revenantLoot', (one, all) => {
    for (const s of seedsOf(S * 2)) for (const rank of [1, 2, 3, 4, 5]) {
      const r = { id: `rv${s}`, given: `Gorak ${s % 13}`, mobileType: [7, 12, 21, 24, 128, 142, 0][s % 7], rank };
      one(TROPHY.revenantTrophy(r, { level: 1 + (s % 30), rolls: seeded(s ^ rank) }));
      all(REVENANT.revenantLoot(1 + (s % 30), rank, seeded(s ^ (rank * 7)), rank % 2 ? 1 : 3));
    }
  });
}

// ── 12. what an honest player does with the pack ─────────────────────

function runPackActs(run, seedsOf, minted) {
  const sample = minted.filter((it) => it && typeof it === 'object').filter((_, i) => i % 7 === 0).slice(0, 1200);
  run('inventory.addItem (stacks merge) / splitStack', (one, all) => {
    for (const s of seedsOf()) {
      const rolls = seeded(s);
      const list = [];
      for (const it of LOOT.generateItems('C', { level: 10, gender: 'male' }, rolls)) INV.addItem(list, copyItem(it));
      for (const it of LOOT.generateItems('C', { level: 10, gender: 'male' }, rolls)) INV.addItem(list, copyItem(it));
      for (const key of LOOT.CLASSIC_RECIPE_KEYS.slice(0, 4)) { INV.addItem(list, LOOT.createPotion(key)); INV.addItem(list, LOOT.createPotion(key)); }
      INV.addItem(list, Object.assign(THUNDER.createPellets(20))); INV.addItem(list, THUNDER.createPellets(7));
      for (const it of [...list]) if ((it.stackCount ?? 1) > 1) INV.splitStack(list, it, 1 + Math.floor(rolls() * ((it.stackCount ?? 2) - 1)), { rolls });
      all(list);
    }
  });
  run('equip.equipItem (every wearable piece the doors minted)', (one) => {
    for (const base of sample) {
      if (!EQUIP.wearableItem(base) || TPL.isAmmunition(base)) continue;
      const e = newPlayer();
      const it = copyItem(base);
      e.items.push(it);
      EQUIP.equipItem(e, it);
      one(it);
    }
  });
  run('equip.lowerCondition (a worn piece\'s wear) / repairService (left, finished, collected)', (one) => {
    let n = 0;
    for (const base of sample) {
      if (!(base.maxCondition > 0) || TPL.isAmmunition(base) || !['Weapons', 'Armor', 'MensClothing', 'WomensClothing', 'Jewellery'].includes(base.group) || !EQUIP.wearableItem(base)) continue;
      const e = newPlayer();
      const it = copyItem(base);
      e.items.push(it);
      EQUIP.equipItem(e, it);
      EQUIP.lowerCondition(it, Math.max(1, Math.floor(it.maxCondition * 0.4)), e);
      one(it);
      EQUIP.unequipItem(e, it);
      if (REPAIR.repairRefusal(it, { allowMagicRepairs: n++ % 2 === 0 })) continue;
      // the smith's building key as the town's directory makes it (talkTopics.js makeBuildingKey), its town's map id
      const buildingKey = TALK.makeBuildingKey(n % 64, (n >> 6) % 64, n % 12);
      const shop = { otherItems: [it] };
      REPAIR.updateRepairTimes(shop.otherItems, { commit: true, nowMinutes: 1000, buildingKey, mapId: 0 });
      one(it);
      REPAIR.repairJobsAt(shop, buildingKey, 1000 + 60 * 24 * 30);
      REPAIR.collectRepaired(it);
      one(it);
    }
  });
  run('itemIds.stampItemIds (a realm checkpoint over the pack, the wagon, the bag and the repairer\'s list)', (one, all) => {
    let n = 0;
    for (let i = 0; i < sample.length; i += 40) {
      const e = newPlayer();
      e.items = sample.slice(i, i + 20).map(copyItem);
      e.wagonItems = sample.slice(i + 20, i + 30).map(copyItem);
      e.bagItems = []; e.otherItems = sample.slice(i + 30, i + 40).map(copyItem);
      e.items.push(INV.letterOfCredit(1000 + i));
      const bytes = seeded(hashOf(`uid${n++}`));
      ITEM_IDS.stampItemIds(e, (b) => { for (let k = 0; k < b.length; k++) b[k] = Math.floor(bytes() * 256); return b; });
      all(e.items); all(e.wagonItems); all(e.otherItems);
    }
  });
  run('tradeModes.identifySpellPass / the Identify service / itemLock', (one, all) => {
    const list = sample.filter((it) => INV.isEnchanted(it)).map((it) => { const c = copyItem(it); delete c.isIdentified; return c; });
    TRADE.identifySpellPass(list, 100, seeded(1));
    all(list);
    for (const it of sample.slice(0, 200)) { const c = copyItem(it); LOCK.setLocked(c, true); one(c); }
  });
}

// ── quests: every Item declaration the vendored quests carry ─────────

const FS = await load('node:fs');
const QUEST_TABLES = await load('../src/systems/quest/tables.js');
const QUEST_MACHINE = await load('../src/systems/quest/machine.js');
const QUEST_DIR = new URL('../vendor/dfu-quests/', import.meta.url);

/** The quest machine's host, as test/questitems.test.js stands it: no world, the player at `level`. */
function questMachine(level) {
  const none = () => undefined;
  const m = new QUEST_MACHINE.QuestMachine({
    nowSeconds: () => 12 * 3600, showPopup: none, playerLevel: () => level, playerGender: () => 'male', getGuild: () => null,
    regionPriceAdjustment: () => 0, isPlayerInTown: () => false, addGold: none, addHUDText: none, giveItemToPlayer: none,
    removeItemFromPlayer: none, playerHasItem: () => false, carriesQuestItem: () => false, releaseQuestItem: none,
    makeHeldQuestItemsPermanent: none, offerReward: none, onQuestStarted: none, addQuestTopics: none,
  });
  return m;
}
let _questTablesLoaded = false;
function runQuestItems(run, seedsOf) {
  run('quest/item.js (every Item declaration in the vendored quests, linked and made permanent)', (one, all, skipOne) => {
    if (!_questTablesLoaded) {
      const sources = {};
      for (const f of FS.readdirSync(new URL('Tables/', QUEST_DIR))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = FS.readFileSync(new URL(`Tables/${f}`, QUEST_DIR), 'utf8').replace(/^\uFEFF/, '');
      QUEST_TABLES.loadQuestTables(sources);
      _questTablesLoaded = true;
    }
    const decls = new Set();
    for (const f of FS.readdirSync(new URL('Quests/', QUEST_DIR))) {
      if (!f.endsWith('.txt')) continue;
      for (const line of FS.readFileSync(new URL(`Quests/${f}`, QUEST_DIR), 'utf8').split(/\r?\n/)) {
        const m = /^\s*Item _[A-Za-z0-9_.-]+_ (.+)$/.exec(line);
        if (m) decls.add(m[1].trim());
      }
    }
    const magic = fakeMagicTemplates();
    const was = LOOT.getMagicItemTemplates();
    LOOT.setMagicItemTemplates(magic);
    const HEADER = ['Quest: __HONEST', 'QRC:', 'Message:  1011', ' x', '', 'QuestComplete:  [1004]', ' done', '', 'QBN:'];
    // DaggerfallUnity.NextUID from 1, so a sweep's quest items are the same every call; the process's counter put back after
    const uidWas = QUEST?.nextUid?.() ?? null;
    QUEST?.resetUid?.();
    try {
      let n = 0;
      for (const decl of decls) for (const [i, level] of [1, 12, 30].entries()) for (const factionId of [0, 40, 42]) {
        if ((n++ + i) % 2) continue;
        const m = questMachine(level);
        let q = null;
        try { q = m.scheduleQuest([...HEADER, 'Item _it_ ' + decl, '', 'variable _pad_'], factionId, { rolls: seeded(hashOf(decl) ^ level ^ factionId) }); } catch (e) { skipOne(`quest Item ${decl}`, e); continue; }
        const df = q?.getResource?.({ name: 'it' })?.daggerfallUnityItem;
        if (!df) continue;
        one(df);
        const kept = copyItem(df);
        QUEST_ITEM?.makeItemPermanent?.(kept);
        one(kept);
      }
    } finally {
      LOOT.setMagicItemTemplates(was);
      if (uidWas != null) { QUEST.resetUid(); QUEST.ensureUidAtLeast(uidWas); }
    }
  });
}
const QUEST_ITEM = await load('../src/systems/quest/item.js');
const QUEST = await load('../src/systems/quest/quest.js');
