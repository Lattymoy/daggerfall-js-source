// SAVEVARS.DAT reader (SAV1). 1:1 translation of DFU API/Save/
// SaveVars.cs (MIT, Daggerfall Workshop) - the classic save's global
// state file ("must be a .175 or later save"). Every value sits at a
// named absolute offset; DFU reads exactly the fields below and so do
// we, in the same order, at the same offsets.
//
// Two whole tables ride at the tail:
//   - 62 region records of 80 bytes at 0x3DA: Values[29] u8, Flags[29]
//     bool, Flags2[14] bool, precipitationOverride, severePunishment-
//     Flags, legalRep i16, idOfPersecutedTemple u16, priceAdjustment
//     u16 (the PlayerEntity.RegionDataRecord shape; the CONDITION half
//     lives in systems/regionConditions.js);
//   - faction records of 92 bytes from 0x17D0 to end of file, COUNTED
//     from the file length, in the factionFile.js field shape plus the
//     three classic list-pointer fields FACTION.TXT has no use for.
//     The second face index byte is skipped - "always -1", verbatim.
//
// Quirks preserved: climateWeathers reads the DUPLICATE block at
// 0x17A2, because classic reads both and the duplicate wins (DFU's own
// comment); the ship-ownership sentinel values 25,600,000 / 51,200,000
// map to Small/Large and anything else is None; the boolean fields are
// only ever SET true (a second load() call on a dirty instance is not
// a thing - each load starts from a fresh field set anyway).
//
// NOT here: the climate-weathers import law (the 0x7f mask + the 5<->6
// climate-slot swap) is WeatherManager.SetClimateWeathers, the import
// side's member - it applies when a loader feeds weatherSim, not when
// the file is read.

export const SAVEVARS_FILENAME = 'SAVEVARS.DAT';

// Named offsets (SaveVars.cs consts, verbatim).
const BIOGRAPHY_MODIFIERS_OFFSET = 0x30;
const EMPEROR_SON_NAME_OFFSET = 0x7c;
const TRAVEL_FLAGS_OFFSET = 0xf5;
const MACE_OF_MOLAG_BAL_VARS_OFFSET = 0x33f;
const GLOBAL_VARS_COUNT = 64;               // at 0x34F, straight after the mace vars
const LAST_SPELL_COST_OFFSET = 0x38f;       // straight after the global vars
const IS_DAY_OFFSET = 0x391;
const CRIME_COMMITTED_OFFSET = 0x3a3;
const IN_DUNGEON_WATER_OFFSET = 0x3a6;
const BREATH_REMAINING_OFFSET = 0x3ab;
const WEAPON_DRAWN_OFFSET = 0x3bf;
const GAME_TIME_OFFSET = 0x3c9;
const USING_LEFT_HAND_WEAPON_OFFSET = 0x3d9;
const CHEAT_FLAGS_OFFSET = 0x173b;
const SHIP_OWNERSHIP_OFFSET = 0x1750;
const LAST_SKILL_CHECK_TIME_OFFSET = 0x179a;
const CLIMATE_WEATHERS_DUPLICATE_OFFSET = 0x17a2;

const REGION_DATA_OFFSET = 0x3da;
const REGION_DATA_LENGTH = 80;
const REGION_COUNT = 62;

const FACTION_DATA_OFFSET = 0x17d0;
const FACTION_DATA_LENGTH = 92;

/** SaveVars.emperorSonNames - randomly chosen per game; fills %imp. */
export const EMPEROR_SON_NAMES = Object.freeze([
  'Pelagius', 'Cephorus', 'Uriel', 'Cassynder', 'Voragiel', 'Trabbatus',
]);

/** SaveVars.TravelFlags. */
export const TRAVEL_FLAGS = Object.freeze({
  Cautiously: 0x01, Recklessly: 0x02, FootOrHorse: 0x04,
  Ship: 0x08, Inns: 0x10, CampOut: 0x20,
});

/** SaveVars.CheatFlags. */
export const CHEAT_FLAGS = Object.freeze({
  AllMapLocationsRevealedMode: 0x08, NoCollision: 0x20,
  GodMode: 0x40, EnemiesCantCastSpells: 0x80,
});

// DaggerfallBankManager.ShipType lives in systems/banking.js, its DFU
// home - SaveVars.cs itself takes it from Game.Banking (`using
// DaggerfallWorkshop.Game.Banking`), and the reader mirrors that
// dependency rather than minting a second table. Re-exported so the
// reader's API is whole.
import { SHIP_TYPES } from '../systems/banking.js';
export { SHIP_TYPES };

const latin1 = (bytes, start, end) => {
  let s = '';
  for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
};

/** FileProxy.ReadCString(reader, n): full n bytes consumed, trailing
 *  NULs trimmed, embedded NULs kept (the AUDIT 24 formats law). */
const cstringFixed = (bytes, start, length) =>
  latin1(bytes, start, start + length).replace(/\0+$/, '');

/** Represents a SAVEVARS.DAT file (SaveVars.cs). */
export class SaveVars {
  constructor() {
    this.biographyResistDiseaseMod = 0;
    this.biographyResistMagicMod = 0;
    this.biographyAvoidHitMod = 0;
    this.biographyResistPoisonMod = 0;
    this.biographyFatigueMod = 0;
    this.emperorSonName = '';
    this.cautiousTravel = false;
    this.innsTravel = false;
    this.footOrHorseTravel = false;
    this.maceOfMolagBalSpellPointBonus = 0;
    this.maceOfMolagBalStrengthBonus = 0;
    this.maceOfMolagBalSpellPointBonusTimeLimit = 0;
    this.maceOfMolagBalStrengthBonusTimeLimit = 0;
    this.globalVars = new Uint8Array(GLOBAL_VARS_COUNT);
    this.lastSpellCost = 0;     // returned to the pool if the readied spell is aborted
    this.isDay = false;
    this.crimeCommitted = 0;
    this.inDungeonWater = false;
    this.breathRemaining = 0;
    this.climateWeathers = null;
    this.weaponDrawn = false;
    this.gameTime = 0;
    this.usingLeftHandWeapon = false;
    this.playerOwnedShip = SHIP_TYPES.None;
    this.allMapLocationsRevealedMode = false;
    this.godMode = false;
    this.lastSkillCheckTime = 0;
    /** @type {Array<object>} PlayerEntity.RegionDataRecord[] */
    this.regionData = [];
    /** @type {Array<object>} FactionFile.FactionData[] */
    this.factions = [];
  }

  /**
   * SaveVars.Open.
   * @param {Uint8Array|ArrayBuffer} buffer - full SAVEVARS.DAT contents.
   * @returns {boolean} true.
   */
  load(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // ReadBiographyModifiers.
    this.biographyResistDiseaseMod = v.getInt32(BIOGRAPHY_MODIFIERS_OFFSET, true);
    this.biographyResistMagicMod = v.getInt32(BIOGRAPHY_MODIFIERS_OFFSET + 4, true);
    this.biographyAvoidHitMod = v.getInt32(BIOGRAPHY_MODIFIERS_OFFSET + 8, true);
    this.biographyResistPoisonMod = v.getInt32(BIOGRAPHY_MODIFIERS_OFFSET + 12, true);
    this.biographyFatigueMod = v.getInt32(BIOGRAPHY_MODIFIERS_OFFSET + 16, true);

    // ReadEmperorSonName - the byte indexes the fixed table.
    this.emperorSonName = EMPEROR_SON_NAMES[bytes[EMPEROR_SON_NAME_OFFSET]];

    // ReadTravelFlags - an i16, tested against three of the six flags.
    const travelFlags = v.getInt16(TRAVEL_FLAGS_OFFSET, true);
    if ((travelFlags & TRAVEL_FLAGS.Cautiously) !== 0) this.cautiousTravel = true;
    if ((travelFlags & TRAVEL_FLAGS.FootOrHorse) !== 0) this.footOrHorseTravel = true;
    if ((travelFlags & TRAVEL_FLAGS.Inns) !== 0) this.innsTravel = true;

    // ReadMaceOfMolagBalVars.
    this.maceOfMolagBalSpellPointBonus = v.getInt32(MACE_OF_MOLAG_BAL_VARS_OFFSET, true);
    this.maceOfMolagBalStrengthBonus = v.getInt32(MACE_OF_MOLAG_BAL_VARS_OFFSET + 4, true);
    this.maceOfMolagBalSpellPointBonusTimeLimit = v.getUint32(MACE_OF_MOLAG_BAL_VARS_OFFSET + 8, true);
    this.maceOfMolagBalStrengthBonusTimeLimit = v.getUint32(MACE_OF_MOLAG_BAL_VARS_OFFSET + 12, true);

    // ReadGlobalVars (0x34F) + ReadLastSpellCost (0x38F) - sequential
    // after the mace vars in DFU; the offsets are its own comments.
    this.globalVars = bytes.slice(MACE_OF_MOLAG_BAL_VARS_OFFSET + 16,
      MACE_OF_MOLAG_BAL_VARS_OFFSET + 16 + GLOBAL_VARS_COUNT);
    this.lastSpellCost = v.getInt16(LAST_SPELL_COST_OFFSET, true);

    // The one-byte state flags.
    if (bytes[IS_DAY_OFFSET] === 1) this.isDay = true;
    this.crimeCommitted = bytes[CRIME_COMMITTED_OFFSET];
    if (bytes[IN_DUNGEON_WATER_OFFSET] === 1) this.inDungeonWater = true;
    this.breathRemaining = v.getInt32(BREATH_REMAINING_OFFSET, true);

    // ReadClimateWeathers - "classic reads from both the first and then
    // overwrites with the duplicate, so effectively the duplicate is
    // what is used". Six weather-climate zones.
    this.climateWeathers = bytes.slice(CLIMATE_WEATHERS_DUPLICATE_OFFSET,
      CLIMATE_WEATHERS_DUPLICATE_OFFSET + 6);

    // ReadWeaponDrawn - of the UI-layering flag byte only 0x40 matters.
    if ((bytes[WEAPON_DRAWN_OFFSET] & 0x40) !== 0) this.weaponDrawn = true;

    this.gameTime = v.getUint32(GAME_TIME_OFFSET, true);
    if (bytes[USING_LEFT_HAND_WEAPON_OFFSET] === 1) this.usingLeftHandWeapon = true;

    // ReadPlayerOwnedShip - the exact sentinels, anything else = None.
    const shipOwned = v.getInt32(SHIP_OWNERSHIP_OFFSET, true);
    if (shipOwned === 25600000) this.playerOwnedShip = SHIP_TYPES.Small;
    if (shipOwned === 51200000) this.playerOwnedShip = SHIP_TYPES.Large;

    // ReadCheatFlags - only two of the four are surfaced.
    const cheatFlags = bytes[CHEAT_FLAGS_OFFSET];
    if ((cheatFlags & CHEAT_FLAGS.AllMapLocationsRevealedMode) !== 0) this.allMapLocationsRevealedMode = true;
    if ((cheatFlags & CHEAT_FLAGS.GodMode) !== 0) this.godMode = true;

    this.lastSkillCheckTime = v.getUint32(LAST_SKILL_CHECK_TIME_OFFSET, true);

    this._readRegionData(bytes, v);
    this._readFactionData(bytes, v);

    return true;
  }

  // ReadRegionData - 62 x 80-byte PlayerEntity.RegionDataRecord.
  _readRegionData(bytes, v) {
    this.regionData = [];
    for (let i = 0; i < REGION_COUNT; i++) {
      let o = REGION_DATA_OFFSET + i * REGION_DATA_LENGTH;
      const values = new Uint8Array(29);
      for (let j = 0; j < 29; j++) values[j] = bytes[o++];
      const flags = new Array(29);
      for (let j = 0; j < 29; j++) flags[j] = bytes[o++] !== 0;   // BinaryReader.ReadBoolean
      const flags2 = new Array(14);
      for (let j = 0; j < 14; j++) flags2[j] = bytes[o++] !== 0;
      const precipitationOverride = bytes[o++];
      const severePunishmentFlags = bytes[o++];
      const legalRep = v.getInt16(o, true); o += 2;
      const idOfPersecutedTemple = v.getUint16(o, true); o += 2;
      const priceAdjustment = v.getUint16(o, true); o += 2;
      this.regionData.push({
        values, flags, flags2, precipitationOverride,
        severePunishmentFlags, legalRep, idOfPersecutedTemple, priceAdjustment,
      });
    }
  }

  // ReadFactionData - 92-byte records from 0x17D0 to end of file,
  // count derived from the file length. Field names follow
  // factionFile.js (the one FactionData shape), plus the three list
  // pointers only the save carries.
  _readFactionData(bytes, v) {
    this.factions = [];
    const factionCount = Math.trunc((bytes.length - FACTION_DATA_OFFSET) / FACTION_DATA_LENGTH);
    for (let i = 0; i < factionCount; i++) {
      const o = FACTION_DATA_OFFSET + i * FACTION_DATA_LENGTH;
      this.factions.push({
        type: bytes[o],
        region: v.getInt8(o + 1),
        ruler: v.getInt8(o + 2),
        name: cstringFixed(bytes, o + 3, 26),
        rep: v.getInt16(o + 29, true),
        power: v.getInt16(o + 31, true),
        id: v.getInt16(o + 33, true),
        vam: v.getInt16(o + 35, true),
        flags: v.getInt16(o + 37, true),
        rulerNameSeed: v.getUint32(o + 39, true),
        rulerPowerBonus: v.getInt32(o + 43, true),   // Random(0, 50) + 20
        flat1: v.getInt16(o + 47, true),
        flat2: v.getInt16(o + 49, true),
        face: v.getInt8(o + 51),
        // o + 52: second face index, always -1 - skipped, verbatim.
        race: v.getInt8(o + 53),
        sgroup: v.getInt8(o + 54),
        ggroup: v.getInt8(o + 55),
        ally1: v.getInt32(o + 56, true),
        ally2: v.getInt32(o + 60, true),
        ally3: v.getInt32(o + 64, true),
        enemy1: v.getInt32(o + 68, true),
        enemy2: v.getInt32(o + 72, true),
        enemy3: v.getInt32(o + 76, true),
        ptrToNextFactionAtSameHierarchyLevel: v.getInt32(o + 80, true),
        ptrToFirstChildFaction: v.getInt32(o + 84, true),
        ptrToParentFaction: v.getInt32(o + 88, true),
      });
    }
  }
}
