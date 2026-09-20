// THE GUN LAB (Mac, 2026-09-19): a NEW WEAPON TYPE prototyped before a
// line of the game changes - the same door grass-proto and the water
// lab came through.
//
// NOTHING HERE TOUCHES THE GAME. This page is not an arm of
// combat/fpsWeapon.js, it is not reachable from `play/`, and no module
// under src/ outside this file imports it. The port is a 1:1 DFU
// translation and a gun is not in Daggerfall; the place to find out
// what one FEELS like on the classic surface is a lab, not the
// weapon rig.
//
// What it DOES borrow, deliberately and by value, is the classic
// placement law, so that what you tune here transfers if the type is
// ever built for real:
//
//   - the 320x200 DESIGN SURFACE. FPSWeapon draws every weapon image
//     over a 320x200 rect stretched to the screen, bottom-anchored,
//     aligned Left/Center/Right with a fractional Offset
//     (FPSWeapon.cs:378-388, ported at combat/fpsWeapon.js
//     drawFpsWeapon). `placeSprite` below is that arithmetic, with
//     ONE departure: a width fraction, because these frames are not
//     CIF records sized in native pixels.
//
//   - the 1-BIT CUTOUT. drawScreenQuad discards texels under 0.5
//     alpha - the port's law for every screen quad - so the
//     background key here is hard-edged on purpose. A soft mask would
//     look right in this page and wrong in the game.
//
//   - the HANDEDNESS MIRROR. FLIP_STATES (FPSWeapon.cs:378, :459)
//     mirrors only the hand-symmetric states and swaps AlignRight for
//     AlignLeft. A gun's idle and fire are both centre-ish, so the
//     lab mirrors the whole cycle behind one switch.
//
// The ART is ours (Mac's), and it arrives as two files rather than a
// CIF: `public/art/gun-idle.png` (one pose) and
// `public/art/gun-fire-sheet.webp` (a 3x2 contact sheet, the six fire
// frames, numbered). The sheet is sliced AT RUNTIME instead of being
// pre-cut into six PNGs, which is what makes the background key a
// LIVE CONTROL - the threshold that makes a muzzle flash survive and
// a white page die is the thing you want a slider on.

// THE SHEET'S LAWS ARE THE GAME'S NOW. They were written here, when
// this page was the only thing that had them; combat/gunSheet.js is
// their home since the Thunderlock became a real weapon, and the lab
// reads them from there.
export {
  SHEET_GRID, FIRE_FRAMES, cellRect, keyBackground, contentBox, unionBox, unionDrawRect,
} from '../combat/gunSheet.js';
import { SHEET_GRID, FIRE_FRAMES, cellRect, keyBackground, contentBox, unionBox, unionDrawRect } from '../combat/gunSheet.js';

// ONE HOME: the alignment enum is FPSWeapon's own, imported rather
// than restated, so an offset tuned in the lab means in the lab
// exactly what it means in the game. From the LEAF it lives in
// (combat/weaponAlign.js, which fpsWeapon.js re-exports), because
// three integers are not worth this lab's build pulling the CIF
// reader, the inventory and a mod's mesh folder in behind them. The
// arrow points ONE WAY - the lab reads the port's law and the port
// does not know the lab exists (test/gunLab.test.js fails if that
// ever stops being true).
// FIELD-GUN12: THE LAB NOW RUNS THE GAME'S MODULE.
// `createWidgetRig`, `widgetRigStep`, `labMotion` and the settings
// reader moved to combat/gunViewmodel.js with the placement, because
// the game needs the SAME frame and five rounds of "it still isn't
// 1:1" is what two copies of it cost. The lab is no longer a thing
// the game resembles - it is a thing the game runs.
export { placeSprite } from '../combat/gunPlacement.js';
export {
  createGunRig as createWidgetRig, gunRigStep as widgetRigStep,
  gunMotion as labMotion, gunWidgetSettings as labWidgetSettings,
  widgetDefaults, gunFrameRect,
} from '../combat/gunViewmodel.js';
export { ALIGN } from '../combat/weaponAlign.js';
import { ALIGN } from '../combat/weaponAlign.js';
import { placeSprite } from '../combat/gunPlacement.js';

// THE MOD'S OWN MODULES (WW1's 1:1 port of FPSWeaponClone) - run, not
// imitated. The arrow points one way, as it does for ALIGN.
import {
  WEAPON_WIDGET_VENDOR, readWidgetSettings, offsetStep, bobStep, inertiaStep, widgetTransformRect,
} from '../combat/weaponWidgetMotion.js';
import { MOD_SETTINGS } from '../systems/modSettings.js';
import { walkSpeed, runSpeed } from '../player/motor.js';   // GetBaseSpeed's walk arm, the bob's baseSpeed
export { createRecoil, createScreenShake, shakeNoise, GUN_FEEL } from '../combat/gunFeel.js';   // FIELD-GUN6: the one home
export { MUZZLE_CURVE, muzzleGlow } from '../combat/gunFeel.js';   // FIELD-GUN13: the flash's curve, the same way
import { muzzleGlow } from '../combat/gunFeel.js';
export { widgetTransformRect };

// FIELD-GUN12: placeSprite moved to combat/gunPlacement.js, which
// the game reads too - see that file's header.

/**
 * THE CYCLE. A gun is not a sword: WeaponManager's six directional
 * strikes and the drag-to-swing gesture have nothing to say here, so
 * the lab runs the smallest machine that can be judged -
 *
 *   Idle -> Firing (frames 0..5 at `fps`) -> Cooling (`cooldownMs`,
 *   the pump) -> Idle
 *
 * - and keeps the two things the classic machine DOES have that
 * matter: a hit frame the damage would land on (FPSWeapon.GetHitFrame,
 * 2 for melee) and a one-shot that cannot be interrupted
 * (FPSWeapon.OnAttackDirection's rule). `auto` holds the trigger.
 */
export function createGunMachine({ fps = 14, cooldownMs = 1700, hitFrame = 1 } = {}) {
  const m = {
    state: 'Idle', frame: 0, fps, cooldownMs, hitFrame,
    trigger: false, shots: 0,
    _t: 0, _cool: 0, _hitThisShot: false,
    /** How far into the pump we are, in ms - what a caller needs to
     *  land a sound or a second animation ON the reload rather than
     *  after it. Zero outside Cooling. */
    get cooledMs() { return m.state === 'Cooling' ? m._cool : 0; },
  };
  m.fire = () => {
    if (m.state !== 'Idle') return false;   // the one-shot cannot be replaced
    m.state = 'Firing'; m.frame = 0; m._t = 0; m._hitThisShot = false; m.shots++;
    return true;
  };
  /** Answers the event this step produced: 'hit' on the hit frame,
   *  'ready' when the pump finishes, null otherwise. */
  m.step = (dt) => {
    let event = null;
    if (m.state === 'Firing') {
      m._t += dt;
      const adv = Math.floor(m._t * m.fps);
      m.frame = Math.min(adv, FIRE_FRAMES - 1);
      if (!m._hitThisShot && m.frame >= m.hitFrame) { m._hitThisShot = true; event = 'hit'; }
      if (adv >= FIRE_FRAMES) { m.state = 'Cooling'; m._cool = 0; m.frame = 0; }
    } else if (m.state === 'Cooling') {
      m._cool += dt * 1000;
      if (m._cool >= m.cooldownMs) { m.state = 'Idle'; event = 'ready'; }
    } else if (m.trigger) {
      m.fire();
    }
    return event;
  };
  return m;
}

/**
 * The muzzle light. The flash is on frames 1-2 of the sheet
 * (0-indexed), so the room it lights brightens on those and falls
 * away over the smoke - a lamp, not a step. Answers 0..1.
 *
 * FIELD-GUN13: THE CURVE MOVED, this signature did not. The game
 * paints the flash and throws its light now, so the six numbers live
 * in combat/gunFeel.js with the rest of the feel and this is the
 * lab's own reading of them - `state` is this page's machine
 * ('Firing'), which the game's machine does not have. One home, two
 * spellings of the same question.
 */
export function muzzleLight(state, frame) {
  return muzzleGlow(state === 'Firing', frame);
}

/**
 * THE RECOIL, and the one thing in this file the Weapon Widget cannot
 * lend. The mod's Recoil module recoils a SWING - it replays the strike
 * animation in reverse when the blow lands - and a gun has no swing to
 * replay. So this is the lab's own, and it is a spring rather than a
 * curve keyed to the frame: the shot delivers an IMPULSE, the sprite
 * carries it, and the spring pulls it back. That is what makes a fast
 * second shot stack on a barrel still coming down, which a per-frame
 * curve cannot do.
 *
 * Native (320x200) units throughout, so a kick tuned in a small window
 * is the same kick in a big one. `kick` is the rise, `stiff` how hard
 * the spring pulls home, `damp` how much it fights the overshoot
 * (2*sqrt(stiff) is critical - under it the barrel bounces, over it it
 * wallows).
 *
 * THE DEFAULTS ARE MAC'S, off the panel (2026-09-19): a SMALL, FAST
 * kick - 5 units, stiffness at the top of its slider and damping just
 * under critical (36 against 2*sqrt(400) = 40), so the barrel jumps
 * and is home inside a tenth of a second with a single small
 * overshoot. And `back` at 0: the weapon rises straight, with no
 * drift toward the shoulder. It is worth knowing this is a CHOICE and
 * not the obvious setting - a big slow kick is what a first pass
 * reaches for, and it fights the 1.7s reload for the frame.
 */
// FIELD-GUN6: createRecoil moved to combat/gunFeel.js - see above.

/**
 * THE SOUND, and the slots it fills.
 *
 * Mac asked for shooting and reloading sounds off Freesound that match
 * the Daggerfall aesthetic, and the aesthetic is not a search term:
 * every classic effect is raw unsigned 8-bit mono at 11025 Hz
 * (src/formats/sndFile.js), and that grit and that missing top octave
 * are what the ear reads as this game. So the search found good
 * RECORDINGS (tools/freesoundPick.mjs, CC0 only) and tools/sndify.mjs
 * made them Daggerfall's. The files are in public/sfx/ with their
 * provenance in public/sfx/SOURCES.md.
 *
 * THREE SLOTS, because the reload has two ends. A gun that goes
 * clack... clack across 1.7 seconds reads as a mechanism; one clip
 * fired at the start of a long reload reads as a sound effect that
 * finished early. `fire` plays on the shot, `reload-open` when the
 * weapon starts down, `reload-close` as it comes back up.
 *
 * The lists are the LAB's CANDIDATES, in the order the audition put
 * them - the dropdowns open on the first, WHICH IS THE PICK. Named
 * apart from systems/thunderlock.js's SFX, which is the three CLIP
 * KEYS the game plays: two different things, and one name for both is
 * what audit24's ratchet is for.
 *
 * FIELD-GUN15 (2026-09-20, Mac, with the panel open: "Use these
 * sounds" over a screenshot of the three dropdowns). The heads moved,
 * and THAT SENTENCE ABOVE IS NOW ENFORCED rather than merely written:
 * `SFX_FILES` in the weapon's home has to name the head of each list
 * (test/thunderlock.test.js). It was true by nobody's doing before -
 * two places holding one decision, agreeing because the same person
 * typed both - which is the drift class this weapon has paid for at
 * every round since FIELD-GUN6.
 *
 * Mac's picks, and they are not the obvious ones:
 *   - fire      `fire-dry`     a flat crack with NO room tail. The
 *                              shotgun's tail is a real room's, and
 *                              this weapon is fired in a dungeon the
 *                              engine reverberates itself.
 *   - open      `open-gunrack` the dark rack, over the winchester's
 *                              brighter cock.
 *   - close     `close-shell`  a shell seating, over the snap.
 */
export const SFX_CANDIDATES = Object.freeze({
  fire: Object.freeze([
    ['fire-dry', 'dry (no room)'],
    ['fire-shotgun', 'shotgun (clean crack)'],
    ['fire-20gauge', '20 gauge (the real one)'],
    ['fire-musket', 'musket (black powder)'],
    ['fire-blast', 'blast (short tail)'],
    ['gun-fire-synth', 'synth (ours)'],
  ]),
  'reload-open': Object.freeze([
    ['open-gunrack', 'gun rack (dark)'],
    ['open-winchester', 'winchester cock'],
    ['open-rack', 'shotgun rack'],
    ['open-shell', 'shell'],
    ['gun-reload-open-synth', 'synth (ours)'],
  ]),
  'reload-close': Object.freeze([
    ['close-shell', 'shell home'],
    ['close-ready', 'ready (snaps shut)'],
    ['close-rack2', 'rack 2'],
    ['close-rack3', 'rack 3'],
    ['gun-reload-close-synth', 'synth (ours)'],
  ]),
});

/**
 * A tiny one-shot player: decode once, keep the buffer, and start a
 * fresh source per shot so a fast second shot layers over the first
 * rather than cutting it - which is what a real one does, and what the
 * recoil spring already assumes.
 *
 * PITCH VARIANCE is the one liberty. Daggerfall plays a clip at its
 * own rate every time, but a gun fired six times in four seconds is
 * the case where the ear notices a sample repeating, and DFU's own
 * weapon code varies the swing pitch for exactly this reason
 * (playbackRate here, ±`vary`). Zero it and the clip is the file.
 */
export function createSfxPlayer({ base = 'sfx/', vary = 0.06, volume = 0.7 } = {}) {
  const buffers = new Map();   // name -> AudioBuffer (or a pending promise)
  let ctx = null;
  const p = {
    vary, volume, enabled: true,
    /** A gesture is what a browser wants before it will make noise. */
    resume() {
      ctx ??= new (globalThis.AudioContext ?? globalThis.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    },
    load(name) {
      if (buffers.has(name)) return buffers.get(name);
      const c = p.resume();
      const url = new URL(`${base}${name}.wav`, globalThis.document?.baseURI ?? 'http://localhost/').href;
      const pending = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${name}`))))
        .then((b) => c.decodeAudioData(b))
        .then((buf) => { buffers.set(name, buf); return buf; })
        .catch((e) => { buffers.delete(name); throw e; });
      buffers.set(name, pending);
      return pending;
    },
    play(name, gain = 1) {
      if (!p.enabled || !name) return false;
      const buf = buffers.get(name);
      if (!buf || typeof buf.then === 'function') { p.load(name).catch(() => {}); return false; }
      const c = p.resume();
      const src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 1 + (Math.random() * 2 - 1) * p.vary;
      const g = c.createGain();
      g.gain.value = p.volume * gain;
      src.connect(g).connect(c.destination);
      src.start();
      return true;
    },
  };
  return p;
}

/**
 * THE SCREENSHAKE, which is the CAMERA and not the weapon.
 *
 * Worth being exact about, because the obvious build is wrong: a shake
 * that moves the sprite is the recoil again, louder. A gun going off
 * kicks the HEAD - so the room moves and the weapon, which is carried
 * by that head, does not move on screen at all. The lab draws the room
 * and the target through this offset and leaves the sprite and the
 * crosshair where they were, and the probe pins exactly that: the
 * world shifts, the weapon's rect does not.
 *
 * TRAUMA, not a timer (Squirrel Eiserloh's "Juicing Your Cameras With
 * Math"): a shot ADDS trauma, capped at 1, trauma decays linearly, and
 * the shake is trauma SQUARED - so two shots close together are much
 * more than twice one shot, and the tail falls off rather than
 * stopping dead.
 *
 * The displacement is smooth noise rather than a fresh random each
 * frame: per-frame randomness reads as static at 60fps and, worse,
 * shakes twice as hard on a machine drawing twice as many frames.
 * Three sines per axis are continuous, frame-rate independent, and
 * cost nothing.
 *
 * `amount` is the peak in NATIVE (320x200) units, `rot` the peak roll
 * in degrees, `decay` the trauma bled off per second, `freq` how fast
 * it rattles.
 */
// FIELD-GUN6: THE MACHINE MOVED. `createScreenShake` and its noise
// live in combat/gunFeel.js now, with `createRecoil`, because the GAME
// needs them - the lab settled these numbers and then kept them, so
// the weapon fired dead still in all four hosts while the prototype
// kicked. The lab reads the one home, so tuning here tunes there.

/**
 * THE WEAPON WIDGET'S OWN MOVEMENT, ON THE GUN.
 *
 * Mac: "all the idle, bob enhancements from our in-game weapon mods
 * need to be applied". They are - by RUNNING them, not by imitating
 * them. Offset, Bob and Inertia are imported from combat/weaponWidget.js,
 * which is the 1:1 port of FPSWeaponClone's own modules, and the
 * settings come from the mod's own declared defaults through
 * readWidgetSettings, so the multipliers the mod applies (Offset.Speed
 * x10, Bob.Length /100, SizeX/Y x2, SpeedMove x4, SpeedState x500,
 * Inertia.Scale/Speed x500, Forward x0.2) are applied here too.
 *
 * Three departures, all of them the gun's:
 *   - INERTIA IS ON by default. The mod ships it off ("requires
 *     double-scaled weapon textures"); this art IS high resolution, so
 *     the lab is the case the warning is about and the module is the
 *     point of the exercise.
 *   - THE RELOAD LOWER rides the Offset module's easing to a target of
 *     the lab's own - straight down, not the mod's diagonal [2, 2] -
 *     because there is no reload animation to play and a weapon that
 *     drops out of frame and comes back reads as one.
 *   - THE RECOIL is the spring above, applied AFTER
 *     widgetTransformRect. The mod's transform ends in a floor - the
 *     rect never rises above its resting place - and a gun's kick
 *     rises, so it cannot be a position channel.
 */
export const WIDGET_VENDOR = WEAPON_WIDGET_VENDOR;






/**
 * THE ANCHOR, and the second half of the alignment story unionBox
 * starts.
 *
 * One box for all six frames holds the gun still RELATIVE TO ITSELF,
 * but that box is dominated by the flash and smoke, which live up and
 * to the left of the barrel. Lay the screen rect out from the union
 * box and Center puts the SMOKE in the middle of the screen and the
 * weapon off to the right.
 *
 * So the layout is computed from the ANCHOR box - the frame with no
 * flash in it, which is the gun and nothing else - and this turns
 * that rect into the rect the full (union-sized) image is drawn at.
 * The gun lands where you aligned it and the flash overflows around
 * it, which is what it does in the art.
 */
// FIELD-GUN11: moved to combat/gunSheet.js, which the game reads too.
