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

/** Register a mod's three members; a second registration for the vendor replaces the first. CSA-J: `newGame`, where
 *  a mod has one, is what a new game does with it in place of its NewSaveData restored. */
export function registerModSaveData(vendor, { newSaveData, getSaveData, restoreSaveData, newGame = null }) {
  _mods.set(vendor, { newSaveData, getSaveData, restoreSaveData, newGame });
}

/** Every registered mod's record, by vendor - what a save writes (GetSaveData, whatever the mod's switch says). */
export function modSaveRecords() {
  const out = {};
  for (const [vendor, m] of _mods) out[vendor] = m.getSaveData();
  return out;
}

/**
 * A load: each registered mod gets its own record back, or its NewSaveData when the save carries none (:1529-1534).
 * CSA-D: each inside SaveLoadManager's own try (:1524-1540) - a mod whose RestoreSaveData throws is told on the HUD
 * ("Failed to load mod data for `<title>`. Check log for errors.", 3 s) and logged, and the load goes on to the next.
 * `onError(vendor, error)` is the host's HUD; with none, the log alone.
 */
export function restoreModSaveRecords(modData, onError = null) {
  for (const [vendor, m] of _mods) {
    const rec = modData?.[vendor];
    try {
      m.restoreSaveData(rec != null ? rec : m.newSaveData());
    } catch (e) {
      console.error(`Failed to load mod data for \`${vendor}\`. Exception: ${e?.message ?? e}`);
      onError?.(vendor, e);
    }
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
  for (const m of _mods.values()) {
    if (m.newGame) m.newGame();
    else m.restoreSaveData(m.newSaveData());
  }
}

export const registeredModSaveVendors = () => [..._mods.keys()];
/** Test seam. */
export function _resetModSaveData() { _mods.clear(); }
