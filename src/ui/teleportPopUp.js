// G5 - THE TELEPORT POPUP: DaggerfallTeleportPopUp.cs (MIT, Daggerfall
// Workshop) on the real TELE00I0.IMG.
//
// This window is what the Mages Guild's TELEPORT service ends at, and
// both halves of it had been waiting on each other: the travel map
// (U41) named the guild TELEPORT mode as idling on the guild arc's
// teleport service, and guildServiceFlow's `Teleport` was a null
// pointing back at the travel map. Two finished systems across a gap
// nobody had closed - G5 closes it from BOTH ends, and neither
// sentence survives: systems/guildServiceFlow.js's service table now
// reads `Teleport: 'guildServiceTeleport'`, and
// ui/travelMapWindow.js's activateTeleportationTravel arms the map
// and raises this window on the destination pick.
//
// THE NATIVE-WINDOW RULE, element by element:
// - the panel is TELE00I0.IMG, which ships 171x57 - exactly
//   mainPanelRect's size (:21).
// - IT IS CENTRED, and mainPanelRect's own POSITION IS DEAD. DFU sets
//   `Position = mainPanelRect.position` (0, 50) and then sets
//   HorizontalAlignment.Center and VerticalAlignment.Middle
//   (:73-77); BaseScreenComponent's alignment switches
//   (:1205-1230) overwrite `rectangle.x`/`.y` outright on any arm but
//   `None`, so the 50 never reaches the screen. Anyone porting the
//   rect wholesale would put the box a third of the way up. Centred:
//   ((320-171)/2, (200-57)/2) = (74.5, 71.5), rounded the way every
//   other centred panel in this port rounds.
// - the DESTINATION strip is a panel at (5,15,161,8) with a shadowed
//   label CENTRED inside it at a (1,1) offset (:81-85).
// - YES (4,38,52,15) and NO (115,38,52,15) (:23-24).
//
// WHAT TELEPORTING IS NOT (TeleportAway, :134-150). It reuses the
// travel map's destination pick and then throws the JOURNEY away:
// no gold, no time, no speed/transport/lodging choice, no arrival
// clamp, no disease warning. What it keeps is the arrival - the world
// re-inits at the new coordinates through the same call fast travel
// makes, so the destination climate's weather slot applies exactly as
// it does there. And if the player is INSIDE when they say yes, DFU
// transitions to the exterior FIRST (:140-141) - you cannot teleport
// out of a building into the middle of nowhere.
//
// FLAGGED: the HUD smash-to-black/fade either side of the jump
// (:136, :149) - the port has no fade layer, the same row the travel
// popup already carries.

import { loadImg, nativeMetrics, drawImg, drawRect, shadowText } from './nativePanel.js';

/** TELE00I0's own size, which IS mainPanelRect's (:21). */
export const TELEPORT_PANEL_W = 171, TELEPORT_PANEL_H = 57;
/** Centre/Middle on the 320x200 native panel - see the header for why
 *  mainPanelRect's (0, 50) does not appear here. */
export const TELEPORT_PANEL_X = Math.round((320 - TELEPORT_PANEL_W) / 2);   // 75
export const TELEPORT_PANEL_Y = Math.round((200 - TELEPORT_PANEL_H) / 2);   // 72

/** destinationPanelRect, yesButtonRect, noButtonRect (:22-24), all
 *  panel-relative. */
export const TELEPORT_RECTS = Object.freeze({
  destination: [5, 15, 161, 8],
  yes: [4, 38, 52, 15],
  no: [115, 38, 52, 15],
});
/** The label sits at (1,1) inside the destination panel and is
 *  HorizontalAlignment.Center within it (:82-85). */
export const DESTINATION_LABEL_OFFSET = Object.freeze([1, 1]);

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx + TELEPORT_PANEL_X && y >= ry + TELEPORT_PANEL_Y
  && x < rx + TELEPORT_PANEL_X + rw && y < ry + TELEPORT_PANEL_Y + rh;

let _art = null;
export async function preloadTeleportPopUpArt(deps) {
  if (!_art) {
    try { _art = await loadImg(deps, 'TELE00I0.IMG'); } catch { /* the window falls back to a plain panel */ }
  }
  return _art;
}
export const teleportPopUpArtLoaded = () => !!_art;
/** Tests reach the loaded art through the same door the window does. */
export function _setTeleportPopUpArtForTests(art) { _art = art; }

export class TeleportPopUpWindow {
  /** destination: { pixel: {x, y}, name }. deps: { onTeleport(pixel,
   *  name), onExit() }. */
  constructor(destination, deps = {}) {
    this.destination = destination ?? { pixel: null, name: '' };
    this.deps = deps;
    this.done = false;
    this.isChoiceWindow = true;
  }


  /** NoButton_OnMouseClick (:112-115) - CloseWindow, and nothing
   *  else: the travel map underneath is still in teleport mode and
   *  another destination can be picked. AUDIT 26 F146: neither Yes nor
   *  No plays a sound - the file sets no ClickSound and calls no
   *  PlayOneShot, so AddButton's null click sound stays null. The port
   *  had invented a ButtonClick on both; do not re-add it. */
  _no() { this.done = true; this.deps.onExit?.(); }

  /** TeleportAway (:134-150). The window hands the destination back
   *  and closes; the HOST owns the exterior transition and the world
   *  re-init, because those are PlayerEnterExit's and StreamingWorld's
   *  and this is a 171x57 panel. */
  _yes() {
    this.done = true;
    this.deps.onTeleport?.(this.destination.pixel, this.destination.name);
  }

  input(code) {
    if (code === 'KeyY' || code === 'Enter') { this._yes(); return; }
    if (code === 'KeyN' || code === 'Escape' || code === 'KeyE') this._no();
  }

  click(vx, vy) {
    if (inRect(TELEPORT_RECTS.yes, vx, vy)) { this._yes(); return true; }
    if (inRect(TELEPORT_RECTS.no, vx, vy)) { this._no(); return true; }
    return true;   // the panel swallows everything else, as a modal does
  }

  draw(renderer, canvas, font) {
    const m = nativeMetrics(canvas);
    if (_art) drawImg(renderer, _art, m, TELEPORT_PANEL_X, TELEPORT_PANEL_Y);
    else {
      drawRect(renderer, m, TELEPORT_PANEL_X, TELEPORT_PANEL_Y,
        TELEPORT_PANEL_W, TELEPORT_PANEL_H, [0.05, 0.04, 0.03, 0.95]);
    }
    if (!font) return;
    const [dx, dy, dw] = TELEPORT_RECTS.destination;
    const name = this.destination.name ?? '';
    const x = TELEPORT_PANEL_X + dx + DESTINATION_LABEL_OFFSET[0];
    const y = TELEPORT_PANEL_Y + dy + DESTINATION_LABEL_OFFSET[1];
    shadowText(renderer, font, name, m, x, y, { align: 'center', w: dw });
    if (!_art) {
      // art-less fallback: the two answers the classic art labels
      shadowText(renderer, font, 'Yes (Y)', m,
        TELEPORT_PANEL_X + TELEPORT_RECTS.yes[0] + 4, TELEPORT_PANEL_Y + TELEPORT_RECTS.yes[1] + 4);
      shadowText(renderer, font, 'No (N)', m,
        TELEPORT_PANEL_X + TELEPORT_RECTS.no[0] + 4, TELEPORT_PANEL_Y + TELEPORT_RECTS.no[1] + 4);
    }
  }
}
