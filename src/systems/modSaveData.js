// WA1 (2026-09-25): DFU'S PER-MOD SAVE SLOT, FOR EVERY MOD THAT HAS ONE.
//
// A mod that implements IHasModSaveData gets one record per save:
// SaveLoadManager writes `GetSaveData()` beside the save (:1200-1210),
// and a load hands back what it wrote - or, for a save without one (taken
// before the mod was installed, or with it off), the mod's own
// `NewSaveData()` (:1524-1535). Horse Cart and Cargo was the first such
// mod here and rides its own seams in the hosts (AUDIT HCC H3, its
// OnStartLoad and OnNewGame are its own IL's); every mod after it
// registers here instead, and the hosts ask this module once.
//
// The record rides `snapshotPlayer`'s `modData` under the mod's vendor
// name - the same slot HCC's does.

const _mods = new Map();   // vendor -> { newSaveData, getSaveData, restoreSaveData }

/** Register a mod's three members; a second registration for the vendor replaces the first. */
export function registerModSaveData(vendor, { newSaveData, getSaveData, restoreSaveData }) {
  _mods.set(vendor, { newSaveData, getSaveData, restoreSaveData });
}

/** Every registered mod's record, by vendor - what a save writes (GetSaveData, whatever the mod's switch says). */
export function modSaveRecords() {
  const out = {};
  for (const [vendor, m] of _mods) out[vendor] = m.getSaveData();
  return out;
}

/** A load: each registered mod gets its own record back, or its NewSaveData when the save carries none (:1529-1534). */
export function restoreModSaveRecords(modData) {
  for (const [vendor, m] of _mods) {
    const rec = modData?.[vendor];
    m.restoreSaveData(rec != null ? rec : m.newSaveData());
  }
}

/**
 * A new game: every registered mod starts from its NewSaveData.
 *
 * DEPARTURE, recorded: DFU calls nothing on a mod's save interface for a
 * new game - a mod that keeps its state in statics (Warm Ashes' `tempShip`)
 * would carry the last character's into the next one, within one session.
 * The port's host is built per game and hands a new character a clean record.
 */
export function newGameModSaveRecords() {
  for (const m of _mods.values()) m.restoreSaveData(m.newSaveData());
}

export const registeredModSaveVendors = () => [..._mods.keys()];
/** Test seam. */
export function _resetModSaveData() { _mods.clear(); }
