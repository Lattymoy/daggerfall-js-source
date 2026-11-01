# Meaner Monsters

Ralzar's DFU mod Meaner Monsters 1.5.2 (MIT), ported 1:1: it buffs many monsters and weakens rats, bats and zombies,
and rescales some monster sprites. The player meets it as tougher foes; it is on by default in the Mods pane. Our
code is the record: `test/characters/enemy/meanerMonsters.test.js` holds the forty-six scales as a literal table, and
the release's provenance is in `01-Overview/Own-Work.md`.

## How it works

- **The rows.** `MEANER_MONSTERS_ROWS` (`src/characters/meanerMonsters.js`) is the mod's enemy data in the DLL's order;
  `foldMeanerMonsters` folds it as the mod's `InitMod` loop writes it, giving `MEANER_MONSTERS_EDIT` (21 monsters).
  Every field that is not -1 replaces the base row's.
- **At mint.** `applyMeanerMonsters` overlays a monster's row when the foe is made (`makeEnemyEntity` in
  `src/characters/enemy/enemyEntity.js`), where DFU rewrites its global table once. A change of the switch takes effect
  on monsters spawned after it.
- **Sprite scale.** The mod's 46 xml files are one table, `MEANER_MONSTERS_BILLBOARD_XML`, registered on
  `src/world/billboardXml.js` (`registerBillboardXml`) while the mod is on. Every billboard goes through one of two
  doors: mobile units and street people through the mobile door, which scales every record; static billboards
  (corpses, loot, flats) through the static door, which scales only a record with an imported texture, as DFU does.
- **With other mods.** With the Physical Combat overhaul (PCAAO) on, its edit is applied over Meaner Monsters' row, so
  its values win wherever both write. With Daggerfall Enemy Expansion loaded, our own meaner monsters for it stand in
  for this mod and its own rows and scales stand aside (`meanerMonstersAlone`, `Enemy-Expansion.md`).

## Rules

- Integrated 1:1, and there are no compatibility switches between mods: a mod reads another mod's own switch
  (`modSettingIfDeclared`) (Mac).
- Every mod is enabled by default (Mac).
- Kept bug for bug: four rows carry id 35, so the last (the Ice row) is what the Fire Atronach ends with and 36-38 are
  never touched; the "Large Dragonling" name is never applied; the Grizzly Bear and Sabertooth Tiger keep their base
  levels; the dead `pco` array (`MEANER_MONSTERS_PCO_ROWS`) stays unreachable.
- The corpse xml (`096_0-0.xml`) is inert without a texture replacement for that record, as in DFU.
- Both scale doors sit behind the Enhancements AssetInjection setting, as DFU's sit behind its asset injection.

## Daggerfall Unity

The mod is `MeanerMonsters.cs`; DFU applies xml scales in `TextureReplacement.SetBillboardScale` and
`GetStaticBillboardMaterial`. Departures: the row is overlaid at mint rather than written once into
`EnemyBasics.Enemies`; xml scales are a registry, not loose files. The mod's Unleveled Mobs arm is not carried
(Unleveled Mobs is not in the port).

## Code and tests

- `src/characters/meanerMonsters.js` - rows, fold, mint overlay, xml table, install
- `src/world/billboardXml.js` - the xml scale registry
- `test/characters/enemy/meanerMonsters.test.js` - the rows and fold, the mint under the switch, the overhaul's edit,
  the xml table, both doors, the boot order, the Mods pane
