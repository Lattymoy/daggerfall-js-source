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

import { appStorage } from './appStorage.js';   // DA1: the storage seam

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
  // EE1: ENHANCED ENVIRONMENTS. The outdoors as ONE switch - the sky,
  // the ground's sampling and surfaces, the cloud shadows, the grass,
  // the weather (and, since CLK2, its evolution within the day) and the
  // surface field - because they are one system:
  // the sky lights the ground, the ground holds the weather's water,
  // the grass stands in what the field says is there. Separate toggles
  // would let a player build a state none of them was written for.
  //
  // It REPLACES proceduralSky, whose job it now contains. The old key
  // stays ONLY so the migration below can read it: a player who turned
  // the sky off gets environments off, because that is the choice they
  // made about the only part of this that existed when they made it.
  enhancedEnvironments: true,
  // ENHANCED AI (2026-09-02, Mac): the navmesh-driven enemy motor. OFF
  // by default and it stays off by default: DFU's classic motor is the
  // 1:1 law, and this is the port's departure from it, opt-in exactly
  // as EnhancedCombatAI is DFU's own opt-in departure from classic.
  enhancedAI: false,
  // ECV1: ENHANCED COMBAT VISUALS (2026-09-07, Mac). What the enhanced
  // skin DRAWS for a state the rules already hold: a chameleoned foe
  // shimmers, a shade is a silhouette, a hit on an unseen foe flashes
  // it. On by default like the other enhanced visuals; the rules are
  // untouched either way, and off (or the classic skin) takes DFU's
  // renderer-disabled draw verbatim (systems/combatVisuals.js).
  enhancedCombatVisuals: true,
  // WATER1: ENHANCED WATER (2026-09-08, Mac: "develop proper water shader
  // for the oceans/rivers/ponds"). A second pass over the terrain grid
  // that shades every water tile as a surface - waves on the wind, the
  // sky by Fresnel, the sun's glint, rain, the shore feathered. On by
  // default like the other enhanced visuals; off (or the classic skin)
  // draws the tile as DFU does. Kill door `?water=off` (render/waterSurface.js).
  enhancedWater: true,
  // ONLINE1 (2026-09-12): the Online door's two fields - the name over the
  // player's head and the relay to join (net/online.js DEFAULT_SERVER when empty).
  onlineName: '',
  onlineServer: '',
  // TI2: THE PHONE IN HAND, TUNED (2026-09-11, Mac: "enhance the mobile
  // element... camera movement, character movement and a more phone
  // built feel"). The touch layer's own knobs - DFU has no touch input
  // (Ledger A, TI1) so none of these is a DFU setting and none may go
  // in the baked catalog. Read at the point of use by ui/touch.js; set
  // from the Enhanced pane's Touch card, which mounts only where the
  // device reports touch.
  touchLookSensitivity: 1,   // a multiplier on the mouse sensitivity the drag already rides (0.25..4)
  touchAnalogStick: true,    // the stick's throw is the speed (InputManager's joystick arm) - off is TI1's 8-way digital
  touchStickAnchor: 'float', // 'float': the stick is born under the finger; 'fixed': it lives bottom-left and the finger's offset is the throw
  touchGyroLook: false,      // fine aim from the phone's rotation, on top of the drag - opt-in (iOS asks permission)
  touchGyroSensitivity: 1,   // 1 = a degree of phone is a degree of camera
  touchHaptics: true,        // a short vibration on a button, an armed swipe and a lock
  touchFullscreen: true,     // the first touch asks for fullscreen and a landscape lock where the browser allows it
  // MWA1 (2026-09-11, RookieG via Mac: "morrowind arms did not work on
  // first launch"). Only the test room ever built the arms at boot; a
  // normal game had them only after the Enhanced pane's Build button,
  // and the rig is a module singleton that dies with the tab. This is
  // the switch that button flips: Build sets it, Unload clears it, and
  // every host that owns a weapon rig builds at boot while it is on and
  // the archives are attached (combat/weaponRig.js autoBuildArms).
  mwArms: false,
  // FPS1 (2026-09-11, RookieG via Mac: "we need an ingame fps counter").
  // The overlay in ui/fpsCounter.js: frames a second and the frame's
  // milliseconds, worst frame of the second beside it. ?fps forces it
  // on for a probe; this is the player's own switch on the Enhanced
  // pane. Off by default - a number over the game is a diagnostic.
  showFps: false,
  // PERF1 (2026-09-11, RookieG via Mac: "its like 45fps on the outside").
  // The two dials on the enhanced outdoors' heaviest layers, so a
  // player whose machine cannot hold the full field can keep the lane.
  // Both take effect when the world next loads (the grass field is
  // baked per world, the cloud march built at boot).
  grassDensity: 1,           // a fraction of the lab's 1.2 million blades over the 420 m window: 1, 0.5, 0.25, or 0 for none
  cloudQuality: 'default',   // volumetricClouds.js QUALITY: 'lo' | 'default' | 'hi'
  proceduralSky: true,   // LEGACY: read only by the migration in loadPrefs
  textScale: 0,        // 0 = normal, 1 = large (buys a whole scale step)
  category: 'game',
  open: {},            // "video:stored" -> true
});

let _prefs = null;
const storage = () => appStorage();   // DA1: localStorage in a browser, the shell's file store in the app

export function loadPrefs() {
  _prefs = { ...PREF_DEFAULTS, open: {} };
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') {
        _prefs = { ...PREF_DEFAULTS, ...p, open: { ...(p.open ?? {}) } };
        // EE1: a shelf written before Enhanced Environments existed
        // carries only the old sky answer. It becomes the new key's,
        // ONCE - only when the new key is absent - so a player who has
        // since chosen explicitly is never overwritten.
        if (p.enhancedEnvironments === undefined && p.proceduralSky !== undefined) {
          _prefs.enhancedEnvironments = !!p.proceduralSky;
        }
      }
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
