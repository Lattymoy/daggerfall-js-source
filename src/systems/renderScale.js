// @ts-check
// PERF-SCALE (2026-09-25) - THE RENDER SCALE: THE SETTING AND ITS DOOR.
// Two players, relayed by Mac the same day: "One user is reporting fps
// issues in the exterior but fine in the interior ... GPU is NVIDIA
// GeForce RTX 4060 Ti", and "me too my friend.. don't know why. I got a
// RX6600". Mac: "It has nothing to do with our updates" - FPS1
// (2026-09-11) had already heard "the outside still has optimization
// issues". A 4060 Ti is no weak card. What the reports share is the
// SIZE of the frame: the renderer sized the world at the window's full
// CSS size (Renderer.beginFrame, clientWidth x clientHeight) with no cap
// and no dial, so a 1440p, 4K or ultrawide window - or DSR/VSR, or a
// browser zoomed below 100% - paid two to four times the per-pixel work
// of a 1080p one, and the exterior (the sky's march, the air's passes,
// the lit ground under the whole screen) is where per-pixel work lives.
//
// This module is the half that reads the player's answer; the renderer
// takes `renderScaleSetting` as its source (main.js wires the two, as it
// wires systems/retroMode.js's retroFrameConfig) and draws the world
// into an image of the world rect x the scale, presented LINEAR to the
// full rect - render/retroPass.js's image and present, under the one law
// for "the world drawn smaller and shown", whose home is
// Renderer._retroBegin. RETRO WINS: with Retro Picture
// Mode on, its own 320x200 or 640x400 image is the world's and this
// scale is not read (Renderer._retroBegin). The HUD, the menus and the
// first-person overlay are the 2D pass's, drawn after the present at the
// canvas's own size - never scaled.
//
// THE OPTIONS are the row's (systems/features.js 'render-scale': RF4,
// one declaration), 100% the default - at 100% the renderer takes no
// image, no pass and no present: the frame is today's, call for call.
// A value that names no tier (a hand-edited shelf, a door typo) is 100%,
// and a tier is matched by its STRING, as the Features tile matches it
// (enhancedMenu.js tileStates): "0.750" or ".5" is no tier, so the game
// never runs at a scale the tile shows as 100% (the review).
// A dial, the player's own online: it is this screen's pixels, nothing
// the room agrees on. Read once per WORLD frame, so the Features tile's
// press lands on the next frame.
import { getPref } from './uiPrefs.js';
import { featureForControl } from './features.js';

/** The row's tiers' values, largest first - [1, 0.85, 0.75, 0.67, 0.5]. */
export const RENDER_SCALES = Object.freeze(
  (/** @type {any} */ (featureForControl('prefs', 'renderScale'))?.control?.tiers ?? [[1, '100%']]).map(([v]) => Number(v)));

/** A stored or door value as a render scale, or null when it names no tier - matched by its string, the tile's rule. */
export function renderScaleOf(v) {
  if (v === null || v === undefined || v === '') return null;
  return RENDER_SCALES.find((t) => String(t) === String(v)) ?? null;
}

/** `?renderscale=0.5` - a probe's door, read once a page (the URL does not change under a running game). */
let _door;
function door() {
  if (_door === undefined) _door = renderScaleOf(new URLSearchParams(globalThis.location?.search ?? '').get('renderscale'));
  return _door;
}

/** The renderer's source: the door, else the player's tier, else 100%. */
export function renderScaleSetting() {
  return door() ?? renderScaleOf(getPref('renderScale')) ?? 1;
}

/** Tests only: forget the door read. */
export function _resetRenderScaleDoor() { _door = undefined; }
