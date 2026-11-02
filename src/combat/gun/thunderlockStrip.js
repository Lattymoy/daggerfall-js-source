// THE DWARVEN THUNDERLOCK'S STRIP - its shape, and nothing else (THUNDERLOCK-ART2, 2026-10-24; bible/05-Combat/
// Dwarven-Thunderlock.md "THUNDERLOCK-ART2"). A leaf, so the art's loader (combat/thunderlockArt.js), the anim table
// (combat/fpsWeapon.js THUNDERLOCK_ANIMS) and the machine's frame count (characters/weaponStates.js
// THUNDERLOCK_NUM_FRAMES) read the one number - the loader reaches the weapon tables, so they cannot read it there.

/** The owner's seven 160x98 first-person frames, side by side (public/art/thunderlock-frames.png): the rest frame, the
 *  shot, two of smoke, three settling. */
export const THUNDERLOCK_STRIP = Object.freeze({ frames: 7, cellW: 160, cellH: 98, file: 'thunderlock-frames.png' });
