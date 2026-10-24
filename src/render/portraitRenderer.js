// @ts-check
// PORTRAIT3D (2026-10-15): THE RENDERER A FACE IS DRAWN WITH, held for the doors that have none.
//
// A Morrowind head portrait is a picture the GL renderer takes (combat/fpArm.js headPortrait, its readback). The
// classic windows and the HUD hand their renderer in; the enhanced menu's DOM wells - the save tiles, the profile, the
// account card, the chargen grid - have none, and stand before any world host attaches one. So the entry hands its
// one Renderer here at boot (main.js), and a face asks for it. A leaf: nothing here imports, so the entry's static
// graph is unchanged (BOOT2's ceiling).

/** @type {any} */
let renderer = null;

/** main.js, once: the game's renderer. */
export function setPortraitRenderer(r) { renderer = r ?? null; }

/** The renderer a face portrait is taken with, or null before boot hands one (a test's process). */
export const portraitRenderer = () => renderer;
