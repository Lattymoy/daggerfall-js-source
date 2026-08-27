// Classic save-game set (SAV1). 1:1 translation of DFU API/Save/
// SaveGames.cs (MIT, Daggerfall Workshop) - enumerates the SAVE0-SAVE5
// directories beside ARENA2 and opens one save's whole file set:
// SAVETREE.DAT, SAVEVARS.DAT, IMAGE.RAW, SAVENAME.TXT, MAPSAVE.SAV
// (a name-record BSA), RUMOR.DAT and BIO.DAT.
//
// Departures (structure only, documented):
//   - File-path plumbing dropped like every reader here: the host hands
//     each save's files as a map of UPPERCASE filename -> bytes, and
//     the save set as index -> file map. Directory walking is the
//     host's job (there is no Directory.GetDirectories in a browser).
//   - The ART_PAL.COL bytes for the save image ride in as a parameter
//     where DFU walks up to the sibling arena2 directory.
//   - OpenSave's GameManager side effects (PlayerGPS.DiscoverLocation,
//     TalkManager.ImportClassicRumor) belong to the IMPORT slice, not
//     the reader: the MAPSAVE discovery walk is ported pure as
//     readMapSaveDiscovery below (the caller supplies per-region
//     location counts from MAPS.BSA and applies the result), and the
//     parsed rumor list sits on this.rumorFile for the mill to import.
//     SAV3 wired both: world.js's classicLoadBoot resolves the
//     discovery through MAPS and feeds each rumor to the mill's own
//     ImportClassicRumor.
//
// Quirks preserved: EnumerateSaves admits a save with SAVETREE.DAT +
// IMAGE.RAW and does NOT require SAVEVARS.DAT - DFU's own check is
// commented out ("TODO: Restore this once savevars supported");
// a missing RUMOR.DAT or BIO.DAT only logs while a missing tree/vars/
// image/name throws; the discovery walk returns false for the WHOLE
// open if any region record is absent from MAPSAVE.SAV.

import { BsaFile } from './bsaFile.js';
import { RumorFile } from './rumorFile.js';
import { BioFile } from './bioFile.js';
import { SaveTree, SAVETREE_FILENAME, readCStringScan } from './saveTreeFile.js';
import { SaveVars, SAVEVARS_FILENAME } from './saveVarsFile.js';
import { SaveImage, SAVE_IMAGE_FILENAME } from './saveImageFile.js';
import { DFPalette } from './dfPalette.js';

export const SAVENAME_TXT = 'SAVENAME.TXT';
export const MAPSAVE_FILENAME = 'MAPSAVE.SAV';
export const RUMOR_FILENAME = 'RUMOR.DAT';
export const BIO_FILENAME = 'BIO.DAT';

/** Classic tracks six save slots, SAVE0-SAVE5. */
export const CLASSIC_SAVE_COUNT = 6;

/** MAPSAVE.### location flag: bit 0x40 marks a discovered location
 *  (SaveGames.OpenSave's walk). */
export const MAPSAVE_DISCOVERED_FLAG = 0x40;

const fileOf = (files, name) => (files instanceof Map ? files.get(name) : files?.[name]);

/**
 * The MAPSAVE discovery walk from SaveGames.OpenSave, pure: for each of
 * the 62 regions read record "MAPSAVE.###" and collect the location
 * indexes whose 0x40 bit is set, clamped to min(record length,
 * region's location count). Returns null where DFU's OpenSave returns
 * false - a region record missing from the BSA.
 * @param {BsaFile} mapSave - MAPSAVE.SAV
 * @param {number[]} regionLocationCounts - DFRegion.LocationCount for
 *   regions 0..61 (from MAPS.BSA, the caller's side of the seam).
 * @returns {number[][]|null} per-region discovered location indexes.
 */
export function readMapSaveDiscovery(mapSave, regionLocationCounts) {
  const discovered = [];
  for (let regionIndex = 0; regionIndex < 62; regionIndex++) {
    const name = `MAPSAVE.${String(regionIndex).padStart(3, '0')}`;
    const index = mapSave.getRecordIndex(name);
    if (index === -1) return null;
    const data = mapSave.getRecordBytes(index);
    const locationCount = Math.min(data.length, regionLocationCounts[regionIndex] | 0);
    const regionHits = [];
    for (let i = 0; i < locationCount; i++) {
      if ((data[i] & MAPSAVE_DISCOVERED_FLAG) !== 0) regionHits.push(i);
    }
    discovered.push(regionHits);
  }
  return discovered;
}

/** Enumerates and extracts data from Daggerfall save games (SaveGames.cs). */
export class SaveGames {
  constructor() {
    this.isPathOpen = false;
    /** @type {Map<number, Map<string, Uint8Array>|object>} */
    this.saveGameDict = new Map();
    this.saveName = '';
    this.saveTree = null;
    this.saveVars = null;
    this.mapSave = null;
    this.rumorFile = null;
    this.bioFile = null;
    this.saveImage = null;
  }

  /**
   * SaveGames.OpenSavesPath + EnumerateSaves. A slot qualifies with
   * SAVETREE.DAT and IMAGE.RAW present; SAVEVARS.DAT is NOT required
   * (DFU's own check is commented out). Verbatim.
   * @param {Map<number, object>|object} saves - save index -> file map
   *   (UPPERCASE filename -> bytes).
   * @returns {boolean} true if at least one save qualified.
   */
  openSavesPath(saves) {
    this.isPathOpen = false;
    this.saveGameDict.clear();
    const entries = saves instanceof Map ? saves.entries() : Object.entries(saves ?? {});
    for (const [key, files] of entries) {
      if (!fileOf(files, SAVETREE_FILENAME) || !fileOf(files, SAVE_IMAGE_FILENAME)) continue;
      this.saveGameDict.set(Number(key), files);
    }
    if (this.saveGameDict.size === 0) return false;
    this.isPathOpen = true;
    return true;
  }

  /** SaveGames.HasSave. */
  hasSave(save) {
    return this.isPathOpen && this.saveGameDict.has(save);
  }

  /**
   * SaveGames.LazyOpenSave - just SaveImage and SaveName for display.
   * Throws on a failed image/name load, as DFU does.
   * @param {number} save
   * @param {Uint8Array} [artPalBytes] - ART_PAL.COL for the image.
   */
  lazyOpenSave(save, artPalBytes = null) {
    if (!this.hasSave(save)) return false;
    if (!this._loadSaveImage(save, artPalBytes))
      throw new Error('Could not lazy open SavImage for index ' + save);
    if (!this._loadSaveName(save))
      throw new Error('Could not lazy open SaveName for index ' + save);
    return true;
  }

  /**
   * SaveGames.OpenSave - the full file set. Tree/vars/image/name
   * failures throw; RUMOR.DAT and BIO.DAT failures do not (DFU only
   * logs them).
   * @param {number} save
   * @param {Uint8Array} [artPalBytes] - ART_PAL.COL for the image.
   * @returns {boolean} true if successful.
   */
  openSave(save, artPalBytes = null) {
    if (!this.hasSave(save)) return false;
    const files = this.saveGameDict.get(save);

    if (!this._loadSaveImage(save, artPalBytes))
      throw new Error('Could not open SaveImage for index ' + save);
    if (!this._loadSaveName(save))
      throw new Error('Could not open SaveName for index ' + save);

    const treeBytes = fileOf(files, SAVETREE_FILENAME);
    this.saveTree = new SaveTree();
    this.saveTree.load(treeBytes);   // throws on a bad version

    const varsBytes = fileOf(files, SAVEVARS_FILENAME);
    if (!varsBytes) throw new Error('Could not open SaveVars for index ' + save);
    this.saveVars = new SaveVars();
    this.saveVars.load(varsBytes);

    const mapSaveBytes = fileOf(files, MAPSAVE_FILENAME);
    if (!mapSaveBytes) throw new Error('Could not open MapSave for index ' + save);
    this.mapSave = new BsaFile(mapSaveBytes);

    // RUMOR.DAT / BIO.DAT: optional, DFU logs and carries on.
    this.rumorFile = null;
    const rumorBytes = fileOf(files, RUMOR_FILENAME);
    if (rumorBytes) {
      this.rumorFile = new RumorFile();
      this.rumorFile.load(rumorBytes);
    }

    this.bioFile = null;
    const bioBytes = fileOf(files, BIO_FILENAME);
    if (bioBytes) {
      this.bioFile = new BioFile();
      this.bioFile.load(bioBytes);
    }

    return true;
  }

  /** SaveGames.TryOpenSave - OpenSave without the throws. */
  tryOpenSave(save, artPalBytes = null) {
    try {
      return this.openSave(save, artPalBytes);
    } catch {
      return false;
    }
  }

  // SaveGames.LoadSaveImage.
  _loadSaveImage(save, artPalBytes) {
    const files = this.saveGameDict.get(save);
    if (!files) return false;
    const bytes = fileOf(files, SAVE_IMAGE_FILENAME);
    if (!bytes) return false;
    this.saveImage = new SaveImage();
    let palette = null;
    if (artPalBytes) {
      palette = new DFPalette();
      palette.load(artPalBytes, 'ART_PAL.COL');
    }
    return this.saveImage.load(bytes, SAVE_IMAGE_FILENAME, palette);
  }

  // SaveGames.LoadSaveName - ReadCString(0, 0): scan to the first NUL.
  _loadSaveName(save) {
    const files = this.saveGameDict.get(save);
    if (!files) return false;
    const bytes = fileOf(files, SAVENAME_TXT);
    if (!bytes) return false;
    this.saveName = readCStringScan(bytes, 0);
    return true;
  }
}
