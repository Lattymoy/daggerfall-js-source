// The UI's OWN preferences - which settings category was open, which
// groups are unfolded, the player's Text Size choice, and WHICH SKIN
// the game wears (systems/uiSkin.js owns that decision; this owns the
// bytes).
//
// These are deliberately NOT in the settings store. That store is
// DFU's SettingsManager and it holds exactly 171 keys; a 172nd would
// break the parity pin (settings.test.js asserts ALL_KEYS.length ===
// 171) and would put a port-invented preference into a file whose
// whole point is that it is DFU's. Separate shelf, separate key.
const STORAGE_KEY = 'dagger.ui.v1';

export const PREF_DEFAULTS = Object.freeze({
  // PX30c: the enhanced HUD's scale. It lives HERE and not in DFU's
  // settings, and two pins said so before I listened: the settings
  // defaults are BAKED from DFU's vendored ini and nothing hand-edits
  // them, and the tier map's own law is that every key in it "is a
  // real DFU setting". This one is not - DFU has no HUD of this shape
  // to scale - so it belongs in the port's own prefs, beside the other
  // things only this port has.
  hudScale: 1,
  // ENHANCED IS THE DEFAULT (Mac, 2026-08-25). Read it through
  // uiSkin.js rather than here - that module resolves the ?skin
  // override on top of this and is the one place the vocabulary lives.
  skin: 'enhanced',
  // RA1 (Mac, 2026-08-28): THE ENHANCED SKY GETS ITS SWITCH. ES1 has
  // been the enhanced skin's default sky since it landed, but the
  // Enhanced pane still listed it "not built" with no control - a
  // shipped enhancement wearing a hole's label, the exact thing the
  // rail-hole law forbids. On = the procedural dome (sun, both moons
  // on their real phases, stars, weather clouds); off = Daggerfall's
  // own painted SKY*.DAT panorama under the same enhanced skin.
  // ?sky=classic stays the URL door and forces the panorama either
  // way (probe pins ride it).
  proceduralSky: true,
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
