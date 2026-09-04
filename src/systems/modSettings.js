// ROADS 24: A VENDORED MOD'S OWN SWITCHES. DFU's settings model is its
// 171 keys and nothing else (settings.test.js pins the count), and a
// mod's switches are not DFU's - in DFU they live in the mod's own
// modsettings, under the Mods menu. So they live here: one small store,
// keyed by the vendor folder, with the mod's own names, defaults and
// descriptions exactly as its modsettings ships them. localStorage-
// backed through the port's ONE storage seam where there is storage,
// in-memory where there is not, so the worker and node both read
// defaults without a DOM.

import { appStorage } from './appStorage.js';   // the one storage seam - localStorage lives there alone

const STORE_KEY = 'dfjs-mod-settings';

/** Every vendored mod that has switches, by vendor key. Names, defaults
 *  and descriptions are the mod's own (Basic Roads 1.3.1 modsettings). */
export const MOD_SETTINGS = Object.freeze({
  'roads-hazelnut': Object.freeze({
    title: 'Basic Roads',
    keys: Object.freeze({
      SmoothRoads: Object.freeze({ default: true, description: 'Enables light smoothing of road surfaces, disable for minor extra performance.' }),
      RiversAndStreams: Object.freeze({ default: false, description: 'Enables rendering of rivers and streams on terrain' }),
    }),
  }),
});

let memory = null;
function load() {
  if (memory) return memory;
  memory = {};
  try {
    const raw = appStorage()?.getItem(STORE_KEY);
    if (raw) memory = JSON.parse(raw) ?? {};
  } catch { memory = {}; }
  return memory;
}
function save() {
  try { appStorage()?.setItem(STORE_KEY, JSON.stringify(memory ?? {})); } catch { /* no storage */ }
}

export function modSetting(vendor, key) {
  const def = MOD_SETTINGS[vendor]?.keys?.[key];
  if (!def) throw new Error(`modSetting: ${vendor}/${key} is not a declared switch`);
  const v = load()[vendor]?.[key];
  return v === undefined ? def.default : !!v;
}

export function setModSetting(vendor, key, value) {
  const def = MOD_SETTINGS[vendor]?.keys?.[key];
  if (!def) throw new Error(`setModSetting: ${vendor}/${key} is not a declared switch`);
  const m = load();
  (m[vendor] ??= {})[key] = !!value;
  save();
  return !!value;
}

/** For tests: forget everything. */
export function _resetModSettings() { memory = null; try { appStorage()?.removeItem(STORE_KEY); } catch { /* none */ } }
