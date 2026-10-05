// R1: THE INTERACTION MODE - PlayerActivate.currentMode
// (PlayerActivate.cs:70, default Grab), hoisted to the one home.
// DFU's mode is GLOBAL: F1-F4 switch it anywhere and every activation
// ladder reads it - street NPCs, static NPCs, building doors, action
// doors, loot. The port had grown it PRIVATE to townTalk (T3), so the
// dungeon's action doors could never see Steal mode and no locked
// door could ever be picked. One module-level mode, because there is
// one player - the worldTick-clock idiom. townTalk keeps the F1-F4
// keydown and the mode-change HUD line; the door ladders read it here.

export const MODES = ['steal', 'grab', 'info', 'dialogue'];

/** AUDIT 58 (talk lane): PlayerActivate.Update reads the four modes as
 *  ACTIONS, not as keys - `if (InputManager.Instance.ActionStarted(
 *  InputManager.Actions.StealMode)) ChangeInteractionMode(...)` and its
 *  three siblings (PlayerActivate.cs:221-228) - and the F1-F4 that
 *  reach them are only InputManager's DEFAULT bindings
 *  (InputManager.cs:999-1002, ported at systems/inputActions.js:215-218).
 *  Both dispatch sites in this port keyed a literal `{ F1: 'steal', ...
 *  }[e.code]` table instead, so the four rows the controls grid offers
 *  were inert in both directions: a Steal moved to KeyP did nothing,
 *  and an F1 re-pointed at Inventory was eaten by the mode branch
 *  before `actionOf` could ever see it. The table is action-keyed now
 *  and lives with the mode it sets, so there is one copy for the hosts
 *  that read it. */
export const MODE_ACTIONS = Object.freeze({
  StealMode: 'steal', GrabMode: 'grab', InfoMode: 'info', TalkMode: 'dialogue',
});

let _mode = 'grab';   // PlayerActivate.cs:70 - PlayerActivateModes.Grab

export const getInteractionMode = () => _mode;
export function setInteractionMode(m) {
  if (!MODES.includes(m)) return false;
  _mode = m;
  return true;
}

/** SENSE1 (the delve arc): HOW MANY TIMES THE PLAYER HAS ASKED FOR EACH MODE - every press of a mode's key, the HUD's
 *  cycle and the pad's, whether or not the mode changed. ChangeInteractionMode is a no-op on the mode already in force
 *  (townTalk.js setMode), so a host that wants "the player asked for Info again" - the dungeon's look round
 *  (systems/dungeonSense.js) - cannot read it off the mode; it reads this count, which the press's own readers keep
 *  (townTalk.js setMode, dungeon.js's mode keys). A count and no listener: nothing to unsubscribe, nothing to leak.
 *  Not a DFU member. */
const _asks = { steal: 0, grab: 0, info: 0, dialogue: 0 };
export function askInteractionMode(m) {
  if (!MODES.includes(m)) return false;
  _asks[m]++;
  return true;
}
export const interactionModeAsks = (m) => _asks[m] ?? 0;

/** NextInteractionMode, verbatim: Steal > Grab > Info > Talk > wrap. */
export function nextInteractionMode(mode = _mode) {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length];
}
