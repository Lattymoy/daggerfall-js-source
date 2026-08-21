// MENU: the screen's OWN preferences - which category was open, which
// groups are unfolded, and the player's Text Size choice.
//
// These are deliberately NOT in the settings store. That store is
// DFU's SettingsManager and it holds exactly 171 keys; a 172nd would
// break the parity pin (settings.test.js asserts ALL_KEYS.length ===
// 171) and would put a port-invented preference into a file whose
// whole point is that it is DFU's. Separate shelf, separate key.
const STORAGE_KEY = 'dagger.ui.v1';

export const PREF_DEFAULTS = Object.freeze({
  textScale: 0,        // 0 = normal, 1 = large (buys a whole scale step)
  category: 'game',
  open: {},            // "video:stored" -> true
});

let _prefs = null;
const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function loadPrefs() {
  _prefs = { ...PREF_DEFAULTS, open: {} };
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') _prefs = { ...PREF_DEFAULTS, ...p, open: { ...(p.open ?? {}) } };
    }
  } catch (e) {
    console.warn('[uiPrefs] stored screen preferences unreadable; using defaults', e);
  }
  return _prefs;
}
export function savePrefs() {
  try { storage()?.setItem(STORAGE_KEY, JSON.stringify(_prefs ?? PREF_DEFAULTS)); return true; }
  catch (e) { console.warn('[uiPrefs] screen preferences could not be saved', e); return false; }
}
export function getPref(k) { if (_prefs === null) loadPrefs(); return _prefs[k] ?? PREF_DEFAULTS[k]; }
export function setPref(k, v) { if (_prefs === null) loadPrefs(); _prefs[k] = v; savePrefs(); }
export function isOpen(catId, group) { return !!getPref('open')[`${catId}:${group}`]; }
export function setOpen(catId, group, open) {
  if (_prefs === null) loadPrefs();
  _prefs.open = { ..._prefs.open, [`${catId}:${group}`]: !!open };
  savePrefs();
}
export function resetPrefs() { _prefs = { ...PREF_DEFAULTS, open: {} }; savePrefs(); }
export function _resetForTests() { _prefs = null; }
