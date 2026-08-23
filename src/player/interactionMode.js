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

let _mode = 'grab';   // PlayerActivate.cs:70 - PlayerActivateModes.Grab

export const getInteractionMode = () => _mode;
export function setInteractionMode(m) {
  if (!MODES.includes(m)) return false;
  _mode = m;
  return true;
}

/** NextInteractionMode, verbatim: Steal > Grab > Info > Talk > wrap. */
export function nextInteractionMode(mode = _mode) {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length];
}
