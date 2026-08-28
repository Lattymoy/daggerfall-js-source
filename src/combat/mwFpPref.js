// The 3D first-person preference - MW-IMPORT slice 5, extracted to its
// own lean home so the ENHANCED BOOT MENU can read it without pulling
// the whole Morrowind format layer into its bundle. ON BY DEFAULT
// (Mac's call, 2026-08-28): attaching Morrowind data IS the opt-in.
// Precedence: ?mwfp=1/0 (probe/dev override) > the stored preference
// (the toggle beside the attach) > true.

const PREF_KEY = 'mwfp';

/** Pure decision, pinned in test/mwfp.test.js. */
export function mwFpEnabled(search, stored) {
  try {
    const q = new URLSearchParams(search).get('mwfp');
    if (q === '0') return false;
    if (q === '1') return true;
  } catch {
    /* no location - node tests pass search explicitly */
  }
  if (stored === '0') return false;
  if (stored === '1') return true;
  return true;
}

export function mwFpPreference() {
  try {
    return mwFpEnabled(location.search, localStorage.getItem(PREF_KEY));
  } catch {
    return true;
  }
}

/** MWFIX: the same generation signal the attach carries, for the same
 *  reason - the view reads this preference ONCE at construction, so
 *  the toggle beside the attach was as dead as the attach was. Bumped
 *  on every write, whether or not the store accepted it: the session
 *  value is what the view reads back. */
let _prefGeneration = 0;
export const mwFpPrefGeneration = () => _prefGeneration;

export function setMwFpPreference(on) {
  _prefGeneration++;
  try {
    localStorage.setItem(PREF_KEY, on ? '1' : '0');
  } catch {
    /* private mode - the session default (on) stands */
  }
}
