// THE SKIN - classic screens or the enhanced ones, one decision, one
// home, ENHANCED BY DEFAULT (Mac's call, 2026-08-25).
//
// Every surface that grows an enhanced twin asks THIS module which one
// to mount. It is deliberately one exported predicate rather than a
// string comparison spelled out at each site: a port that compares
// `pref === 'enhanced'` in fourteen files is a port where the
// fourteenth spells it 'Enhanced' and silently falls to classic.
//
// ── WHY IT IS NOT A SETTINGS KEY ─────────────────────────────────
//
// systems/settings.js is DFU's SettingsManager and holds exactly 171
// keys, pinned (settings.test.js asserts ALL_KEYS.length === 171).
// DFU has no such setting because DFU has no such screens, so a 172nd
// key would break the parity pin AND put a port-invented preference
// into a store whose whole point is that it is DFU's. It rides
// uiPrefs, the shelf that already exists for exactly this - the same
// argument uiPrefs.js's own header makes about Text Size.
//
// ── THE OVERRIDE DOES NOT PERSIST ────────────────────────────────
//
// ?skin=classic / ?skin=enhanced answers for THIS page load and writes
// nothing. That is what makes it safe for the 25 probes in tools/:
// they pin classic geometry, they must keep pinning classic geometry
// whatever a developer last clicked, and a probe must never leave a
// preference behind that changes the next probe's screen.
//
// An unrecognised value falls to the STORED choice rather than
// throwing or silently meaning classic - `?skin=modern` is a typo, not
// an instruction, and the port's own settings law reads a bad value as
// the default rather than as a new one.
import { getPref, setPref } from './uiPrefs.js';
import { onlineForcedPref } from './onlineLane.js';   // OL1: online is the enhanced lane, whole

export const SKINS = Object.freeze(['enhanced', 'classic']);
export const DEFAULT_SKIN = 'enhanced';

/** The label a player reads. Never the stored token. */
export const SKIN_NAMES = Object.freeze({ enhanced: 'Enhanced', classic: 'Classic' });

const clean = (v) => (SKINS.includes(v) ? v : null);

/** The URL's answer for this page load only, or null. Injectable so a
 *  node test can ask the question without a location. */
export function skinOverride(search = globalThis.location?.search ?? '') {
  return clean(new URLSearchParams(search).get('skin'));
}

/** The skin in effect: online, enhanced (OL1 - over the URL override
 *  too: a shared world has one lane); else the URL override, else the
 *  stored choice, else enhanced. */
export function uiSkin(search) {
  return onlineForcedPref('skin', search) ?? skinOverride(search) ?? clean(getPref('skin')) ?? DEFAULT_SKIN;
}

/** The predicate every mount site should call. */
export const isEnhanced = (search) => uiSkin(search) === 'enhanced';

/** AUDIT CONTRIB H1: THE HOTBAR IS IN FORCE - the enhanced skin with the hotbar chosen (systems/features.js
 *  'quickbar-style') - and the quickslot diamond is put AWAY, not hidden: its actions (a pad's d-pad, a rebound key)
 *  and its hold machine stand down, so nothing reaches slots the player cannot see. On the classic skin the pref is
 *  inert and the diamond is the quickbar, as ever. Here, beside the skin, so the input ladder can read it without
 *  the quickslot model's import ring. */
export const hotbarInForce = () => isEnhanced() && getPref('quickbarStyle') === 'hotbar';

/** Store a choice. Ignores anything not a skin, for the same reason
 *  the override does: a bad value is a typo. Returns what is now
 *  stored, which is NOT necessarily what uiSkin will report while a
 *  URL override is up - the caller that wants to know decides. */
export function setUiSkin(skin) {
  if (!clean(skin)) return clean(getPref('skin')) ?? DEFAULT_SKIN;
  // SKIN-CARRY (2026-09-16, a report: "the classic toggle starts the
  // game in enhanced"): the choice's ONLY carrier across the reload
  // was this write, and its failure was swallowed - savePrefs warned
  // and answered false, setPref dropped the answer, this returned the
  // skin as if stored, and switchSkin reloaded with nothing carrying
  // the choice, so a browser that refuses localStorage (private
  // windows, a blocked site, a sandboxed build) booted the default.
  // The store's refusal comes back as null now; switchSkin reads it.
  return setPref('skin', skin) === false ? null : skin;
}

/** The other one. Every toggle in the game is this function. */
export const otherSkin = (skin = uiSkin()) => (skin === 'classic' ? 'enhanced' : 'classic');
