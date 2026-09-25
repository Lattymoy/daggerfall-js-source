// @ts-check
// UXB1-E (2026-09-25, the UX backlog: "Add a 'sync from server' option so players can ensure their offline play
// matches the host they prefer to play on if they want."): THE ROOM'S RULES, COPIED HOME.
//
// Online, a switch the room owns reads the room's value and the player's own store is never written (onlineLane.js,
// the four read paths). Offline the player's values stand again - so a player who wanted to play offline by the
// rules they meet online had to find and set every one of them by hand: two dozen switches across three stores, and
// the list of which ones lives in a source file.
//
// THERE IS NO HOST TO ASK, and that is not a gap: a relay serves the wire and /health (server/src/index.js) and
// publishes no rules, because the rules are the LANE's - compiled into every client of this build, the same in every
// room on every relay. So the sync is a copy of the lane into the offline stores:
//   - every pref the lane forces (ONLINE_FORCED_PREFS, the registry's `online: true` rows among them),
//   - every DFU setting it forces (ONLINE_FORCED_SETTINGS),
//   - every mod key the room owns (ONLINE_ROOM_MOD_KEYS),
//   - and the one layout rule that is not in a table: online a dungeon is always the whole dungeon
//     (world/smallerDungeons.js useSmallerDungeon, AUDIT WORLD34 B2), so Smaller Dungeons is set off.
// WHAT IT DOES NOT COPY: `mwArms` - forced on online, but it is the Morrowind arms BUILD's switch (enhancedMenu.js's
// Build writes it once the archives are measured, and a refused build leaves it off), and a switch without its build
// stands nothing; the rules that are not switches at all (the real-time clock, the rest and the journey that spend
// none of it); and everything the lane leaves to the player.
//
// Undoable: the values it replaced are kept in the storage seam, and Undo writes them back.
import { ONLINE_FORCED_PREFS, ONLINE_FORCED_SETTINGS, ONLINE_ROOM_MOD_KEYS, isOnlinePage } from './onlineLane.js';
import { featureForControl } from './features.js';   // the registry declares its online prefs at load (declareOnlinePrefs), and names them
import { getPref, setPref } from './uiPrefs.js';
import { getString, setValue, saveSettings } from './settings.js';
import { modSetting, setModSetting, MOD_SETTINGS } from './modSettings.js';
import { appStorage } from './appStorage.js';
import { labelOf } from '../ui/settingsCopy.js';

export const ONLINE_SYNC_STORE_KEY = 'dagger.onlineSync.v1';

/** The prefs the lane forces that the sync leaves alone, and why. */
export const ONLINE_SYNC_SKIPPED_PREFS = Object.freeze({
  mwArms: 'the Morrowind arms build’s own switch - its Build writes it once the archives are measured',
});

/** The layout rule the lane keeps in code rather than a table: online every dungeon is full size. DFU's strings. */
export const ONLINE_LAYOUT_SETTINGS = Object.freeze({
  Experimental: Object.freeze({ SmallerDungeons: 'False' }),
});

/** A mod key in words: the mod's title, and for any key but Enabled, the key de-camelled after its section. */
function modKeyLabel(vendor, key) {
  const title = MOD_SETTINGS[vendor]?.title ?? vendor;
  if (key === 'Enabled') return title;
  const words = key.slice(key.lastIndexOf('.') + 1).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return `${title} - ${words}`;
}
/** DFU's strings compare as bool.Parse reads them: case and whitespace aside. */
const sameSetting = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/**
 * @typedef {{ id: string, store: 'prefs'|'settings'|'mods', key: string, section?: string, vendor?: string,
 *   label: string, online: unknown, offline: unknown, same: boolean }} SyncRow
 */

/**
 * Every rule the room plays by, beside what the offline game says for it now. `null` on an online page: there every
 * read path answers with the room's value, so the player's own could not be seen (and the menu that offers this is a
 * front door, which is never online - main.js deletes `online` on every door but Play Online).
 * @returns {SyncRow[] | null}
 */
export function onlineSyncPlan({ search } = /** @type {{ search?: string }} */ ({})) {
  if (isOnlinePage(search)) return null;
  /** @type {SyncRow[]} */
  const rows = [];
  for (const [key, online] of Object.entries(ONLINE_FORCED_PREFS)) {
    if (Object.hasOwn(ONLINE_SYNC_SKIPPED_PREFS, key)) continue;
    const offline = getPref(key);
    rows.push({ id: `prefs:${key}`, store: 'prefs', key, label: featureForControl('prefs', key)?.title ?? key, online, offline, same: offline === online });
  }
  for (const table of [ONLINE_FORCED_SETTINGS, ONLINE_LAYOUT_SETTINGS]) {
    for (const [section, keys] of Object.entries(table)) {
      for (const [key, online] of Object.entries(keys)) {
        const offline = getString(section, key);
        const full = `${section}/${key}`;
        rows.push({ id: `settings:${full}`, store: 'settings', section, key, label: labelOf(full), online, offline, same: sameSetting(offline, online) });
      }
    }
  }
  for (const [vendor, keys] of Object.entries(ONLINE_ROOM_MOD_KEYS)) {
    for (const [key, online] of Object.entries(keys)) {
      const offline = modSetting(vendor, key);
      rows.push({ id: `mods:${vendor}/${key}`, store: 'mods', vendor, key, label: modKeyLabel(vendor, key), online, offline, same: offline === online });
    }
  }
  return rows;
}

/** One value into its own store. Settings are saved by the caller, once. */
function write(row, value) {
  if (row.store === 'prefs') setPref(row.key, value);
  else if (row.store === 'settings') setValue(/** @type {string} */ (row.section), row.key, value);
  else setModSetting(/** @type {string} */ (row.vendor), row.key, value);
}

/**
 * The sync: every rule that differs is written the room's way, and what it replaced is kept for Undo. Answers the
 * undo record written - `{ at, rows: [{ store, section?, vendor?, key, was }] }` - or null when nothing differed
 * (the last record, if any, is left as it was).
 */
export function applyOnlineSync(plan = onlineSyncPlan(), { storage = appStorage(), now = Date.now() } = {}) {
  const changed = (plan ?? []).filter((r) => !r.same);
  if (!changed.length) return null;
  for (const r of changed) write(r, r.online);
  if (changed.some((r) => r.store === 'settings')) saveSettings();
  const record = { at: now, rows: changed.map(({ store, section, vendor, key, offline }) => ({ store, section, vendor, key, was: offline })) };
  try { storage?.setItem(ONLINE_SYNC_STORE_KEY, JSON.stringify(record)); } catch { /* no storage: the sync stands, without its undo */ }
  return record;
}

/** The last sync's undo record, or null. */
export function lastOnlineSync({ storage = appStorage() } = {}) {
  try {
    const rec = JSON.parse(storage?.getItem(ONLINE_SYNC_STORE_KEY) ?? 'null');
    return rec && Array.isArray(rec.rows) ? rec : null;
  } catch { return null; }
}

/** Undo: the values the last sync replaced, written back; the record is spent. A row this build no longer declares
 *  (a retired mod key) is passed over. Answers how many were restored. */
export function undoOnlineSync({ storage = appStorage() } = {}) {
  const rec = lastOnlineSync({ storage });
  if (!rec) return 0;
  let n = 0;
  for (const r of rec.rows) {
    if (!['prefs', 'settings', 'mods'].includes(r?.store) || typeof r.key !== 'string') continue;
    try { write(r, r.was); n++; } catch { /* no longer declared */ }
  }
  if (rec.rows.some((r) => r?.store === 'settings')) saveSettings();
  try { storage?.removeItem(ONLINE_SYNC_STORE_KEY); } catch { /* none */ }
  return n;
}
