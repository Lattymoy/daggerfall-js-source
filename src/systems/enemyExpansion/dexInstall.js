// DEX1 (2026-10-19, Mac: "I want to implement this as our next mod 1:1") - DAGGERFALL ENEMY EXPANSION 1.3.4 (Kamer &
// Kab), THE INSTALL: what BestiaryMod.Start does at the game's load (BestiaryMod.cs:172-197), once, after Roleplay &
// Realism's own install - DFU runs every mod's Init (RR's Awake writes its enemy appearance) before this MonoBehaviour's
// Start, so the rows this edits are the rows those left.
//
// LOADED FOR THE GAME, AS DFU LOADS A MOD (modSettings.js latchModLoaded): the switch is read here, once, and the
// mod's doors read the latch - a switch flipped mid-game waits for the next load, as the tile says.
//   ALWAYS (whatever the switch): the fifty enemies join the table, their careers the custom career registry, their
//     names the text provider (and the player's language's - AUDIT DEX A6, dexNames.js), their pictures the texture door (DEX2, dexSprites.js) and their Morrowind bodies the
//     body doors (DEX7, dexBodies.js). In DFU a disabled mod registers nothing - and a game saved with a Goblin in it
//     and loaded with the mod off finds no row for it; here the row is still there and nothing that is the mod's
//     reaches it (no table rolls it, no quest names it, no hook of the mod's runs), so the save loads and the world is
//     DFU's.
//   WHILE LOADED: the sixteen classic rows and the two classic classes edited (written into the table, and again at a
//     foe's mint over Meaner Monsters' and the overhaul's - DFU's order: their Init, then this Start), and the quest
//     foes added, its encounter tables picked (DEX3), its spells and spellbooks (DEX4a), its combat hooks and forced
//     gender (DEX4b), the troll's corpse prefab and its save record (DEX5), its equipment delegate (DEX6).

import { DEX_TABLE_TEXT } from './dexTableText.js';
import { MUDEX_TABLE_TEXT } from './mudexTableText.js';   // MUDEX1: Meaner Monsters' form beside this mod, read after it
import { DEX_VENDOR, MUDEX_VENDOR, dexLoaded, mudexLoaded } from './dexSwitches.js';
import { meanerMonstersEnabled } from '../../characters/meanerMonsters.js';
import { classicCareers, readCareerTable, readEnemyTables, careerFromSpec, writeEnemyLine, readEncounterTables, addDefaultEncounterTables } from './dexTables.js';
import { createDexEncounterSelector } from './dexEncounters.js';   // DEX3: the tables as the mod picks them
import { ENCOUNTER_TABLES } from '../../characters/encounterTables.js';   // DEX3: DFU's own, the defaults' source
import { registerEncounterTableSelector } from '../../characters/encounterTableDoor.js';
import { onPlayerGpsEvents } from '../../world/playerGps.js';
import { ENEMY_BASICS, registerEnemyRows, isClassicEnemyId, enemyDisplayName } from '../../characters/enemy/enemyBasics.js';
import { registerCustomCareerTemplate, registerCustomEnemyName } from '../../characters/enemy/customEnemies.js';
import { loadMonsterCareer, loadClassCareer, registerMintRowEditor } from '../../characters/enemy/enemyEntity.js';
import { addIntoQuestTables } from '../quest/tables.js';
import { modSetting, latchModLoaded } from '../modSettings.js';
import { installDexSprites } from './dexSprites.js';   // DEX2: the fifty's pictures, whatever the switch
import { dexEnemyNameText } from './dexNames.js';   // AUDIT DEX A6: the fifty's names in the player's language
import { registerCustomEnemyNameText } from '../textManager.js';
import { installDexBodies } from './dexBodies.js';   // DEX7: the fifty's Morrowind bodies, whatever the switch
import { registerFoeGhost } from '../../characters/enemy/foeLook.js';   // DEX2: the Transparent property's ghost shader
import { registerSpellRecordsAsset } from '../spell/standardSpells.js';   // DEX4a: its SpellRecords.json, merged into the standard list
import { registerEnemySpellbook } from '../enemySpells.js';
import { createDexSpellbooks } from './dexSpells.js';   // DEX4a: its spellbook tables
import { createDexCombatDoors } from './dexCombat.js';   // DEX4b: its FormulaHelper overrides and forced gender
import { registerFormulaOverride, registerSkeletalTarget, registerEnemyGroup, registerEnemyLanguage } from '../../combat/formulas.js';
import { registerForcedGender } from '../../characters/mobile/mobileUnit.js';
import { installDexTroll } from './dexTroll.js';   // DEX5: the troll's corpse prefab and its save record
import { createDexEquipmentAssigner } from './dexEquipment.js';   // DEX6: its copy of RRI's class arm
import { setEnemyEquipmentAssigner, enemyEquipmentAssigner } from '../../combat/enemyEquipment.js';

export { DEX_VENDOR, dexLoaded };   // MUDEX1: their home is dexSwitches.js, the leaves' own

/** The files of one kind, in GetDBAssets' order: the enabled mods' in their load order - this mod's (its manifest's,
 *  which DEX_TABLE_TEXT keeps), then MUDEX's when it is loaded (it depends on this mod, so it loads after it). */
const dbAssets = (extension, mudex) => [...Object.entries(DEX_TABLE_TEXT), ...(mudex ? Object.entries(MUDEX_TABLE_TEXT) : [])]
  .filter(([n]) => n.endsWith(extension)).map(([n, text]) => [n.replace(/\.csv$/, ''), text]);

/** `[DEX]` lines to the console, Debug.LogError / LogWarning's way. */
const consoleLog = (level, message) => (level === 'error' ? console.error(message) : console.warn(message));

let _read = null;
/** MUDEX1: one read for each set of loaded mods - false, this mod's files alone; true, MUDEX's after them. */
const _reads = new Map();
const _classicOriginals = new Map();
/** DEX6: the assigner the mod's took the delegate from (undefined: it took none) - the test seam's to put back. */
let _replacedAssigner;

/** The mod's read, made once for each set of loaded mods: the careers (classic and its own), its enemies, the classic
 *  edits, the raw spellbooks and the quest foe lines. `liveRow` is read now - after the installs before this one.
 *  `mudex`: MUDEX's tables read after the mod's own (MUDEX1); left out, the game's - MUDEX as loaded - and that read
 *  becomes the one the mod's doors answer from. */
export function dexRead({ log = consoleLog, mudex } = {}) {
  const game = mudex === undefined;
  const key = game ? mudexLoaded() : mudex === true;
  let read = _reads.get(key);
  if (!read) { read = readMod(key, log); _reads.set(key, read); }
  if (game) _read = read;
  return read;
}

function readMod(mudex, log) {
  const careers = classicCareers();
  for (const [name, text] of dbAssets('.cdb.csv', mudex)) readCareerTable(text, careers, name, log);
  const enemies = readEnemyTables(dbAssets('.mdb.csv', mudex), careers, {
    liveRow: (id) => ENEMY_BASICS[id],
    isClassic: isClassicEnemyId,
    classicName: (id) => enemyDisplayName(id),
    log,
  });
  // DEX3: the encounter tables (ParseEncounterTables, Start) and the first Update's defaults from DFU's own tables
  const encounters = addDefaultEncounterTables(readEncounterTables(dbAssets('.tdb.csv', mudex), log), (i) => ENCOUNTER_TABLES[i], log);
  return { careers, ...enemies, encounters };
}

/** BestiaryMod.GetCustomProperties (:68-78): a classic id's properties (only while the mod is loaded - its edits are
 *  the mod's), a mod's id's; null where the mod has none. */
export function dexProperties(mobileId) {
  const read = _read;
  if (!read) return null;
  if (isClassicEnemyId(mobileId)) return dexLoaded() ? read.classic.get(mobileId)?.props ?? null : null;
  return read.enemies.get(mobileId)?.props ?? null;
}

/** BestiaryMod.CustomEnemies' ids (the fifty), ascending. */
export const dexEnemyIds = () => (_read ? [..._read.enemies.keys()].sort((a, b) => a - b) : []);

/** A career spec resolved: its base career read from the player's files (a copy - careerFromSpec), the mod's edits on
 *  it; one career per spec, as DFU registers one DFCareer object for every enemy that names it. */
const _careers = new Map();
function careerLoader(spec) {
  return (fetchBytes) => {
    if (!_careers.has(spec)) {
      const base = !spec.base ? Promise.resolve(null)
        : spec.base.kind === 'monster' ? loadMonsterCareer(spec.base.index, fetchBytes) : loadClassCareer(spec.base.index, fetchBytes);
      _careers.set(spec, base.then((b) => careerFromSpec(spec, b)));
    }
    return _careers.get(spec);
  };
}

/** A classic row as the mod's line leaves it, over `row` as it stands (a fresh copy; the line's cells re-read, so the
 *  writes that read the row - CastsMagic, RangedAttackAnimFrames - read THIS one). */
function editedClassicRow(id, row, read) {
  const c = read.classic.get(id);
  if (!c?.row) return row;
  let out = row;
  for (const line of c.lines) {   // each of the id's lines, in the order they were read
    const copy = { ...structuredClone(out), id };
    const r = writeEnemyLine(copy, structuredClone(c.props), line.tokens, line.col, { mobileID: id, enemyReplacement: true, classicReplacement: true, careers: read.careers, lineNumber: line.lineNumber });
    if (!r.ok) continue;
    delete copy.id;
    out = copy;
  }
  return out;
}

/** A classic row as the mod's lines leave it, whatever the switch - the read alone (the relay's bounds are held to it:
 *  `net/foeBounds.js` FOE_BOUND_ROWS, the most a row stands at with the mod loaded too). `row` unchanged where the mod
 *  names no line for `id`. `mudex`: MUDEX's lines after the mod's (MUDEX1), else the mod's alone. */
export const dexClassicRow = (id, row, { mudex = false } = {}) => editedClassicRow(id, row, dexRead({ mudex }));

let _installed = false;
let _dropNameText = null;
/** BestiaryMod.Start, once per page. `on` is the switch as this load reads it, `meaner` Meaner Monsters' (the test
 *  seams): both on, MUDEX loads beside the mod (MUDEX1). Answers what loaded. */
export function installEnemyExpansion({ on = modSetting(DEX_VENDOR, 'Enabled') === true, meaner = meanerMonstersEnabled(), log = consoleLog } = {}) {
  if (_installed) return { loaded: dexLoaded(), mudex: mudexLoaded(), enemies: _read?.enemies.size ?? 0 };
  _installed = true;
  const mudex = latchModLoaded(MUDEX_VENDOR, !!on && !!meaner);   // MUDEX1: loaded for the game with the mod it depends on
  const read = dexRead({ log, mudex });
  _read = read;
  // ALWAYS: the fifty, their careers, their names (BestiaryTextProvider.GetCustomEnemyName answers the mod's own only)
  const rows = [];
  for (const [id, e] of read.enemies) {
    const row = { ...e.row };
    delete row.id;
    rows.push([id, row]);
    const spec = read.careers.get(e.careerName) ?? [...read.careers.values()].find((s) => s.name.toLowerCase() === e.careerName.toLowerCase());
    registerCustomCareerTemplate(id, { name: spec.name, load: careerLoader(spec) });
  }
  registerEnemyRows(rows);
  _dropNameText = registerCustomEnemyNameText(dexEnemyNameText);   // AUDIT DEX A6: and in the player's language (the port's own door)
  registerCustomEnemyName((id) => read.enemies.get(id)?.props.name || null);
  installDexSprites();   // DEX2: their pictures on the texture door, and the xml's scales
  installDexBodies();   // DEX7: their Morrowind bodies - a creature's, a person's, or the sprite's
  const loaded = latchModLoaded(DEX_VENDOR, on);
  if (loaded) {
    // the classic rows edited, written into the table as EnemyBasics.Enemies is written (the originals kept, the revert's)
    for (const [id, c] of read.classic) {
      if (!c.row) continue;
      const target = ENEMY_BASICS[id];
      _classicOriginals.set(id, structuredClone(target));
      for (const k of Object.keys(target)) delete target[k];
      const row = { ...c.row };
      delete row.id;
      Object.assign(target, row);
    }
    // and at a foe's mint, over Meaner Monsters' and the overhaul's rows (their Init, then this Start)
    registerMintRowEditor((mobileType, row) => (read.classic.get(mobileType)?.row ? editedClassicRow(mobileType, row, read) : row));
    // EnemyEntity.OnLootSpawned's Transparent arm (:1394-1402): the ghost shader on a non-spectral enemy the mod marks
    registerFoeGhost((id) => dexProperties(id)?.isTransparent === true);
    // DEX4a: its spells in the standard list (TextAssetReader.Merge, as RebuildClassicSpellsDict merges an enabled mod's
    // SpellRecords.json), and its spellbooks over DFU's lists (OnLootSpawned's SetEnemySpells, :1358-1361)
    registerSpellRecordsAsset(DEX_VENDOR, JSON.parse(DEX_TABLE_TEXT['SpellRecords.json']));
    registerEnemySpellbook(createDexSpellbooks(read.spellbooks, dexProperties, { ids: [...read.enemies.keys(), ...read.classic.keys()], log }).spellbook);
    // DEX4b: its FormulaHelper.RegisterOverride calls (:183-186) - OnMonsterHit, CalculateWeaponAttackDamage's skeletal
    // test, GetEnemyEntityEnemyGroup, GetEnemyEntityLanguageSkill - and OnLootSpawned's forced gender (:1364-1392)
    const combat = createDexCombatDoors(read.enemies, dexProperties);
    registerFormulaOverride('onMonsterHit', combat.monsterHit);
    registerSkeletalTarget(combat.skeletal);
    registerEnemyGroup(combat.group);
    registerEnemyLanguage(combat.language);
    registerForcedGender(combat.gender);
    // DEX6: EnemyEntity.AssignEnemyEquipment (:194) - its copy of RRI's class arm while realisticEnemyEquipment is on,
    // ItemHelper's while it is off. Start writes it after RRI's Awake wrote its own, so the mod's is the one that stands
    _replacedAssigner = enemyEquipmentAssigner();
    setEnemyEquipmentAssigner(createDexEquipmentAssigner(dexProperties));
    // DEX5: the troll's corpse prefab (1618_20 - AssetInjection reads a loaded mod's bundle alone) and the record DFU's
    // mod save slot keeps for it (Init's SaveDataInterface, BestiarySaveInterface)
    installDexTroll(DEX_VENDOR);
    // DEX3: the encounter tables, picked on the dungeon's transition and PlayerGPS's events (BestiaryMod.cs:1728-1871)
    const encounters = createDexEncounterSelector(read.encounters);
    registerEncounterTableSelector(encounters);
    onPlayerGpsEvents(encounters.gps);
    // QuestMachine.FoesTable.AddIntoTable (:1344): the new names the Foes table lacks, when it loads
    addIntoQuestTables({ foes: read.questFoes.map(([id, name]) => ({ line: `${id}, ${name}`, unlessKey: name })) });   // `if (!FoesTable.HasValue(questName))` - asked of the table as it stands when the rows land
  }
  return { loaded, mudex, enemies: read.enemies.size };
}

/** The test seam: the classic rows put back, every registration of the read let go. */
export function _resetEnemyExpansion() {
  for (const [id, saved] of _classicOriginals) {
    const target = ENEMY_BASICS[id];
    for (const k of Object.keys(target)) delete target[k];
    Object.assign(target, saved);
  }
  _classicOriginals.clear();
  if (_replacedAssigner !== undefined) setEnemyEquipmentAssigner(_replacedAssigner);
  _replacedAssigner = undefined;
  for (const id of _read ? _read.enemies.keys() : []) delete ENEMY_BASICS[String(id)];
  _careers.clear();
  _dropNameText?.();
  _dropNameText = null;
  _read = null;
  _reads.clear();
  latchModLoaded(MUDEX_VENDOR, false);
  _installed = false;
}
