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
/** PREF1: the shelf's own revision, so a shelf written before the fix
 *  can be told from one written after it. Bumping it does NOT re-run
 *  the adoption below - that reads the stamp's ABSENCE. */
const SHELF_STAMP = '_rev';
const SHELF_REV = 1;
/** PREF1: the keys whose default the port changed after shelves had
 *  already materialised the old one, adopted once on an unstamped
 *  shelf. A key joins this list only when the old stored value cannot
 *  honestly be read as the player's answer - see loadPrefs. */
const PREF1_ADOPT_NEW_DEFAULT = Object.freeze(['lootRarity']);

import { appStorage } from './appStorage.js';   // DA1: the storage seam
import { onlineForcedPref } from './onlineLane.js';   // OL1: the online lane's forcing, read before the shelf
import { FEATURE_PREF_DEFAULTS } from './features.js';   // RF4: the port's own switches, declared once on their rows
import { SURVIVAL_OFF } from './survival/difficulty.js';   // SURV-TIERS: the old survival boolean's Off, converted at the load (an import-free leaf)

export const PREF_DEFAULTS = Object.freeze({
  // PX30c: the enhanced HUD's scale. It lives HERE and not in DFU's
  // settings, and two pins said so before I listened: the settings
  // defaults are BAKED from DFU's vendored ini and nothing hand-edits
  // them, and the tier map's own law is that every key in it "is a
  // real DFU setting". This one is not - DFU has no HUD of this shape
  // to scale - so it belongs in the port's own prefs, beside the other
  // things only this port has.
  hudScale: 1,
  // FOEBAR1 (2026-09-17, Mac, from a friend's pictures): the target bar's
  // face - 'bar' is the plain track under the compass, 'blade' the
  // twin-bladed picture whose fill recedes toward its hub. The port's own,
  // like hudScale: DFU draws no enemy health at all.
  foeBarStyle: 'bar',
  // ENHANCED IS THE DEFAULT (Mac, 2026-08-25). Read it through
  // uiSkin.js rather than here - that module resolves the ?skin
  // override on top of this and is the one place the vocabulary lives.
  skin: 'enhanced',
  // ONLINE1 (2026-09-12): the Online door's two fields - the name over the
  // player's head and the relay to join (net/online.js DEFAULT_SERVER when empty).
  onlineServer: '',
  // CHAT-R2 (2026-09-16, Mac: "a hide chat button"): the chat put
  // away, across sessions. A player who hid it wants it hidden next
  // launch too - the panel is still built and still counting unread,
  // so bringing it back finds the room where they left it.
  chatHidden: false,
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
  // 2026-09-17 (per-request): a peer without a Morrowind body is drawn as their class's animated sprite by default
  // (net/remotePlayers.js classMobileType/_syncMobilePeer) - the same billboard a hostile Warrior/Mage/etc. already
  // is, puppeted by their pose instead of AI. Off returns to the flat paperdoll every peer used to be drawn as.
  // Defaults ON, unlike mwArms above: this needs no attached data and no build step, so there is nothing to opt
  // INTO the way Morrowind assets are - only a look a player might prefer to opt OUT of.
  peerClassSprites: true,
  peerAttackSounds: true,   // PEER-FS2: other players' swing sounds - on by default
  peerFootsteps: true,   // PEER-FS1: other players' footstep sounds - on by default
  // WS1: `mwSheathing` (Weapon Sheathing on the third-person body) is
  // declared on its Features row (systems/features.js), RF4's law - it
  // arrives through FEATURE_PREF_DEFAULTS below.
  // FPS1 (2026-09-11, RookieG via Mac: "we need an ingame fps counter").
  // The overlay in ui/fpsCounter.js: frames a second and the frame's
  // milliseconds, worst frame of the second beside it. ?fps forces it
  // on for a probe; this is the player's own switch on the Enhanced
  // pane. Off by default - a number over the game is a diagnostic.
  showFps: false,
  proceduralSky: true,   // LEGACY: read only by the migration in loadPrefs
  // RF4 (2026-09-14, Mac's refactor pass, the fourth): THE PORT'S OWN
  // FEATURE SWITCHES ARE DECLARED ONCE, ON THEIR ROWS. The Features
  // registry (systems/features.js) is the one declaration of an
  // enhanced switch - its default (`initial`) and the online lane's
  // answer (`online`) ride the row beside its title and note - and
  // this shelf takes the defaults from it: enhancedEnvironments,
  // enhancedAI, enhancedCombatVisuals, enhancedWater, landViewDistance,
  // grassDensity, cloudQuality, lootRarity. The prose each carried here
  // (RA1/EE1, the AI, ECV1, WATER1, LV1, PERF1, LR1) is the row's note
  // now. Adding a switch is one row; nothing here.
  ...FEATURE_PREF_DEFAULTS,
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
        // PREF1: A SHELF WRITTEN BEFORE THE FIX carries the defaults of
        // its own day as if they were answers, and nothing in it says
        // which were which - the information was destroyed at save
        // time. It is dropped ONCE, for the keys where the port has
        // since changed its mind, and the shelf is stamped so this
        // runs exactly once per player.
        //
        // Only `lootRarity` is on that list, and the reasoning is
        // bounded rather than hopeful: the row shipped OFF on
        // 2026-09-14 and LR5 turned it ON one day later, so a stored
        // `false` in an unstamped shelf was written by the shelf and
        // not by a player. After this load the player's own answer -
        // including pressing it back off - differs from the default
        // and is persisted as the choice it is.
        if (p[SHELF_STAMP] === undefined) {
          for (const k of PREF1_ADOPT_NEW_DEFAULT) {
            if (p[k] !== undefined && p[k] !== PREF_DEFAULTS[k]) _prefs[k] = PREF_DEFAULTS[k];
          }
        }
        // EE1: a shelf written before Enhanced Environments existed
        // carries only the old sky answer. It becomes the new key's,
        // ONCE - only when the new key is absent - so a player who has
        // since chosen explicitly is never overwritten.
        if (p.enhancedEnvironments === undefined && p.proceduralSky !== undefined) {
          _prefs.enhancedEnvironments = !!p.proceduralSky;
        }
        // SURV-TIERS (2026-09-23): THE SURVIVAL SWITCH BECAME THREE TIERS
        // ON THE SAME KEY (survival/difficulty.js). A shelf written before
        // carries the old boolean - and only ever `false`, since `true`
        // was the default and PREF1's shelf writes no default - which is
        // a player who turned the arc OFF: it reads as the Off tier and
        // is written back as one at the next save. A `true` (a hand-edited
        // shelf) names no tier and falls to the default, the rule every
        // non-tier value reads by (survival/switch.js survivalTier). A
        // player who never touched the switch stored nothing, and moves
        // to Casual with the default - as Mac asked.
        if (p.survival === false) _prefs.survival = SURVIVAL_OFF;
        else if (p.survival === true) _prefs.survival = PREF_DEFAULTS.survival;
      }
    }
  } catch (e) {
    console.warn('[uiPrefs] stored screen preferences unreadable; using defaults', e);
  }
  return _prefs;
}
/** PREF1 (2026-09-15, found auditing LR5): THE SHELF CARRIES THE PLAYER'S
 *  CHOICES, NOT A SNAPSHOT OF THE DEFAULTS.
 *
 *  It used to write `_prefs` whole - and `_prefs` is
 *  `{ ...PREF_DEFAULTS, ...stored }`, so the FIRST `setPref` of any key
 *  materialised EVERY default into storage. From that moment a stored
 *  value was indistinguishable from a deliberate answer, and a default
 *  the port later changed could never reach a player who had once
 *  touched any setting at all. LR5 is where that bit: the loot ladder's
 *  default went true, and every existing player - Mac included - would
 *  have gone on reading the `lootRarity: false` their shelf had written
 *  FOR them, and reported the switch as not working.
 *
 *  So a key whose value equals the default is DROPPED rather than
 *  written. Reading is unchanged (`getPref` already answers
 *  `_prefs[k] ?? PREF_DEFAULTS[k]`, and a stored `false` still beats a
 *  `true` default - `??` falls through on null/undefined alone), so
 *  this moves no behaviour today; it stops the shelf lying about what
 *  the player asked for, which is what makes every FUTURE default
 *  change land. `open` is the player's own map and is always written. */
export function savePrefs() {
  try { storage()?.setItem(STORAGE_KEY, JSON.stringify(overridesOf(_prefs ?? PREF_DEFAULTS))); return true; }
  catch (e) { console.warn('[uiPrefs] screen preferences could not be saved', e); return false; }
}
/** The shelf's real overrides: every key whose value differs from the
 *  default, plus `open` and the stamp. Pure; pinned in test/pref1_shelf.test.js. */
export function overridesOf(prefs) {
  const out = {};
  for (const [k, v] of Object.entries(prefs ?? {})) {
    if (k === 'open') continue;
    if (Object.hasOwn(PREF_DEFAULTS, k) && v === PREF_DEFAULTS[k]) continue;   // the default is not a choice
    out[k] = v;
  }
  out.open = { ...(prefs?.open ?? {}) };
  out[SHELF_STAMP] = SHELF_REV;
  return out;
}
export function getPref(k) {
  const forced = onlineForcedPref(k);   // OL1: online is the enhanced lane, whole - a forced switch reads forced and the shelf is not written
  if (forced !== undefined) return forced;
  if (_prefs === null) loadPrefs();
  return _prefs[k] ?? PREF_DEFAULTS[k];
}
export function setPref(k, v) { if (_prefs === null) loadPrefs(); _prefs[k] = v; return savePrefs(); }   // SKIN-CARRY: the store's word comes back - a refused write is the caller's to carry another way
export function isOpen(catId, group) { return !!getPref('open')[`${catId}:${group}`]; }
export function setOpen(catId, group, open) {
  if (_prefs === null) loadPrefs();
  _prefs.open = { ..._prefs.open, [`${catId}:${group}`]: !!open };
  savePrefs();
}
export function resetPrefs() { _prefs = { ...PREF_DEFAULTS, open: {} }; savePrefs(); }
export function _resetForTests() { _prefs = null; }
