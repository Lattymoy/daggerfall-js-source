// RETRO-UI (FIELD BUGS 2026-10-03, Skibbster on Discord: "Retro mode aspect ratio doesn't include weapon sprite, UI etc
// etc" - "a lot of elements dont account for the black bars"): THE 2D LAYER IN DFU'S CustomScreenRect.
//
// With retro mode's aspect correction on, DFU pillarboxes the WHOLE picture: SetRetroAspectViewport hands the
// pillarboxed rect to DaggerfallUI as CustomScreenRect (ViewportChanger.cs :138-140), and every root panel lays out in
// it (BaseScreenComponent.cs :1135-1137) - the HUD, the large HUD - as do the weapon (FPSWeapon.cs :128-129), the
// casting hands (FPSSpellCasting.cs :88-89) and the horse (TransportManager.cs :290-291). The port pillarboxed the world
// alone (RETRO1's recorded departure) and laid the rest out over the whole canvas: the vitals and the compass in the
// black bars, the weapon flush with the screen's edge past the picture's.
//
// THE SEAM: `uiCanvas` is the canvas the 2D layer lays out on - under the pillarbox a canvas of the pillarbox's size
// (retroScreenRect, the world rect's own pillar), else the canvas itself - and `onUiScreen` draws through the
// renderer's screen offset (the overlay letterbox seam, setScreenOffset) at its place. The weapon rig, the mount rig and
// drawHud take it themselves, so the four hosts change nothing. A click on the 2D layer comes back through `toUiPoint`.
// The client size stays the screen's (a swing's gesture reads the screen, not the picture).

import { retroScreenRect } from '../systems/retroMode.js';

let _rect = null; // the frame's UI rect, canvas pixels (null: the whole canvas) - the last `uiCanvas` asked of a canvas

/** The canvas the 2D layer lays out on: `{ width, height, clientWidth, clientHeight, uiRect, canvas }` of the
 *  pillarbox under retro mode's aspect correction, else the canvas itself. A UI canvas answers itself. */
export function uiCanvas(canvas) {
  if (!canvas || canvas.uiRect) return canvas;
  const r = retroScreenRect(canvas.width, canvas.height);
  _rect = r;
  if (!r) return canvas;
  return {
    width: r.w,
    height: r.h,
    clientWidth: canvas.clientWidth,
    clientHeight: canvas.clientHeight,
    uiRect: r,
    canvas,
  };
}

/** Draw `body` on the UI canvas's place: the renderer's screen offset moved by its rect for the call, and put back
 *  however the body leaves (setScreenOffset's own law: set, draw, reset). A whole-canvas `ui` draws as it was. */
export function onUiScreen(renderer, ui, body) {
  const r = ui?.uiRect;
  if (!r || typeof renderer?.setScreenOffset !== 'function') return body();
  const [ox, oy] = renderer.screenOffset ?? [0, 0];
  renderer.setScreenOffset(ox + r.x, oy + r.y);
  try {
    return body();
  } finally {
    renderer.setScreenOffset(ox, oy);
  }
}

/** A canvas pixel into the 2D layer's own space - a click or a hover on the HUD the last frame drew. */
export function toUiPoint(px, py) {
  return _rect ? [px - _rect.x, py - _rect.y] : [px, py];
}

/** A point of the 2D layer's own space back onto the canvas (the gun's muzzle, measured where it is drawn). */
export function fromUiPoint(ui, px, py) {
  const r = ui?.uiRect;
  return r ? [px + r.x, py + r.y] : [px, py];
}

/** Tests: forget the frame's rect. */
export function _resetUiScreenForTests() {
  _rect = null;
}
