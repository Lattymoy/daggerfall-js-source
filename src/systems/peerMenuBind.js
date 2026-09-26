// PEERMENU1 (2026-09-26): THE PLAYER MENU OPENS ON A BIND, NOT ON A LOOK - online only.
//
// The player: "change how the social interaction (trading, invite to party, inspect etc) menu pops up, quicklooting
// can stay the same. Give it a new bind in the options ... and also allow hold buttons (keyboard and controller). When
// aiming at a player it normally pops up - make it pop up when pressing a button in the same range on a player; default
// it to hold E for now."
//
// Until now ACT-MENU listed a player's verbs on the world plaque the moment the crosshair found them. Now the plaque
// names them (and says which button opens their menu), and the verbs come up only when this bind is pressed on them,
// at the same reach the plaque already uses (scenes/world.js peerInSight, SOCIAL_REACH). Quick loot is untouched.
//
// TWO BINDS, EACH A PRESS OR A HOLD: one keyboard key and one controller button, each with its own "hold" switch.
// They live on the port's own prefs shelf (systems/uiPrefs.js), NOT in the DFU-shaped key registry: a hold is not a
// thing that registry has, and the default shares E with Interact - a tap of E interacts as it always did, holding it
// opens the menu. Defaults: hold E, hold A (the pad's own activate button - the same gesture on the other hand).
import { getPref, setPref } from './uiPrefs.js';

/** How long a hold is, in seconds - the same length as the Plus d-pad's holds (ui/gamepadInput.js DPAD_HOLD_S). */
export const PEER_MENU_HOLD_S = 0.45;

export const PEER_MENU_DEFAULTS = Object.freeze({
  key: Object.freeze({ code: 'KeyE', hold: true }),
  pad: Object.freeze({ code: 'JoystickButton0', hold: true }),
});
const PREF = { key: 'peerMenuKey', pad: 'peerMenuPad' };

const validCode = (kind, code) => typeof code === 'string' && code.length > 0 && code.length < 40
  && (kind === 'pad' ? code.startsWith('Joystick') : !code.startsWith('Joystick') && !code.startsWith('Mouse'));

/** The bind of one kind ('key' | 'pad'): { code, hold }. code null = unbound. Anything unreadable is the default. */
export function peerMenuBind(kind) {
  const def = PEER_MENU_DEFAULTS[kind];
  if (!def) return { code: null, hold: false };
  let v = null;
  try { v = getPref(PREF[kind]); } catch { v = null; }
  if (!v || typeof v !== 'object') return { ...def };
  const code = v.code === null ? null : validCode(kind, v.code) ? v.code : def.code;
  return { code, hold: typeof v.hold === 'boolean' ? v.hold : def.hold };
}
export function setPeerMenuBind(kind, patch) {
  if (!PREF[kind]) return false;
  const now = peerMenuBind(kind);
  const next = { ...now, ...patch };
  if (next.code !== null && !validCode(kind, next.code)) return false;
  return setPref(PREF[kind], { code: next.code, hold: !!next.hold });
}
export const resetPeerMenuBinds = () => { setPref(PREF.key, null); setPref(PREF.pad, null); };

/**
 * The press/hold reader. The host hands it every keydown / keyup it hears (the pad's buttons arrive as keydowns of
 * their own `Joystick*` codes) and calls `frame(nowS)` once a frame; `onFire()` is called ONCE per gesture:
 *  - a PRESS bind fires on the keydown (never on a key's auto-repeat);
 *  - a HOLD bind fires when the key has been down PEER_MENU_HOLD_S - letting go earlier is nothing (the key's other
 *    meaning, E's Interact, already had its press).
 * `enabled()` false (offline, a window up) drops any hold in progress.
 */
export function createPeerMenuReader({ onFire, enabled = () => true, now = () => performance.now() / 1000, bindOf = peerMenuBind } = {}) {
  const downAt = new Map();   // code -> the time its hold began (fired holds are removed)
  const matching = (code) => ['key', 'pad'].map((k) => ({ kind: k, ...bindOf(k) })).find((b) => b.code && b.code === code) ?? null;
  return {
    down(code, repeat = false) {
      if (repeat || !enabled()) return false;
      const b = matching(code);
      if (!b) return false;
      if (!b.hold) { onFire?.(b.kind); return true; }
      downAt.set(code, now());
      return false;
    },
    up(code) { downAt.delete(code); },
    frame() {
      if (!downAt.size) return;
      if (!enabled()) { downAt.clear(); return; }
      const t = now();
      for (const [code, at] of [...downAt]) {
        const b = matching(code);
        if (!b || !b.hold) { downAt.delete(code); continue; }
        if (t - at >= PEER_MENU_HOLD_S) { downAt.delete(code); onFire?.(b.kind); }
      }
    },
    reset() { downAt.clear(); },
  };
}
