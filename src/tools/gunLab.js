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

/** The contact sheet's layout. `badgeGutter` is the fraction of each
 *  cell's width that carries the frame NUMBER - a grey disc the key
 *  cannot remove (it is neutral, not white) and the trim would
 *  otherwise weld to the frame's box. Cropped before anything reads a
 *  pixel. */
export const SHEET_GRID = Object.freeze({ cols: 3, rows: 2, badgeGutter: 0.12 });

/** The fire cycle's length - the sheet's own frame count. */
export const FIRE_FRAMES = SHEET_GRID.cols * SHEET_GRID.rows;

/**
 * Cell `i` of the sheet, reading rows first (1,2,3 / 4,5,6 - the
 * numbering on the art), with the badge gutter already gone.
 * Integer rects: a half-pixel source rect resamples, and this page
 * has to be able to claim its pixels are the file's.
 */
export function cellRect(i, sheetW, sheetH, grid = SHEET_GRID) {
  const cw = Math.floor(sheetW / grid.cols);
  const ch = Math.floor(sheetH / grid.rows);
  const gut = Math.round(cw * grid.badgeGutter);
  const col = i % grid.cols;
  const row = Math.floor(i / grid.cols);
  return { x: col * cw + gut, y: row * ch, w: cw - gut, h: ch };
}

/**
 * THE BACKGROUND KEY. A flood fill from the border, not a threshold
 * sweep, and the difference is the muzzle flash: its core is very
 * bright, and a plain "every near-white pixel dies" rule punches a
 * hole straight through it. Two guards keep the art:
 *
 *   - CONNECTIVITY. Only background reachable from the frame's edge
 *     is cleared, so an enclosed highlight inside the receiver is
 *     safe whatever its value.
 *   - NEUTRALITY. The page white is grey-neutral; the flash core is
 *     warm (max-min channel spread well over `chroma`). A warm pixel
 *     is never background, even touching the edge.
 *
 * Alpha goes to 0 or stays as it was - 1-bit, per the port's quad
 * law. Mutates `img.data` and answers how many texels it cleared.
 */
export function keyBackground(img, threshold = 244, chroma = 10) {
  const { width: w, height: h, data } = img;
  const isBg = (p) => {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    if (data[p + 3] === 0) return true;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return min >= threshold && max - min <= chroma;
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, x + (h - 1) * w); }
  for (let y = 0; y < h; y++) { stack.push(y * w, w - 1 + y * w); }
  let cleared = 0;
  while (stack.length) {
    const i = stack.pop();
    if (seen[i]) continue;
    seen[i] = 1;
    const p = i * 4;
    if (!isBg(p)) continue;
    if (data[p + 3] !== 0) { data[p + 3] = 0; cleared++; }
    const x = i % w, y = (i - x) / w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  return cleared;
}

/** The box of everything still opaque, or null for an empty frame. */
export function contentBox(img) {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * THE ONE BOX ALL SIX FRAMES SHARE, and the reason the lab looks like
 * a gun rather than a gun having a seizure.
 *
 * Every frame trimmed to its OWN content and then bottom-anchored is
 * the obvious build and it is wrong: the flash and smoke grow up and
 * to the left across the cycle, so each frame's box is a different
 * size and the WEAPON slides a dozen pixels a frame under it. The
 * cells are registered to each other by construction - the gun is
 * painted in the same place in all six - so one union box, applied to
 * all six, keeps that registration and gives the flash its room.
 */
export function unionBox(boxes) {
  const live = boxes.filter(Boolean);
  if (!live.length) return null;
  const x0 = Math.min(...live.map((b) => b.x));
  const y0 = Math.min(...live.map((b) => b.y));
  const x1 = Math.max(...live.map((b) => b.x + b.w));
  const y1 = Math.max(...live.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ONE HOME: the alignment enum is FPSWeapon's own, imported rather
// than restated, so an offset tuned in the lab means in the lab
// exactly what it means in the game. From the LEAF it lives in
// (combat/weaponAlign.js, which fpsWeapon.js re-exports), because
// three integers are not worth this lab's build pulling the CIF
// reader, the inventory and a mod's mesh folder in behind them. The
// arrow points ONE WAY - the lab reads the port's law and the port
// does not know the lab exists (test/gunLab.test.js fails if that
// ever stops being true).
export { ALIGN } from '../combat/weaponAlign.js';
import { ALIGN } from '../combat/weaponAlign.js';

// THE MOD'S OWN MODULES (WW1's 1:1 port of FPSWeaponClone) - run, not
// imitated. The arrow points one way, as it does for ALIGN.
import {
  WEAPON_WIDGET_VENDOR, readWidgetSettings, offsetStep, bobStep, inertiaStep, widgetTransformRect,
} from '../combat/weaponWidgetMotion.js';
import { MOD_SETTINGS } from '../systems/modSettings.js';
import { walkSpeed, runSpeed } from '../player/motor.js';   // GetBaseSpeed's walk arm, the bob's baseSpeed
export { widgetTransformRect };

/**
 * FPSWeapon's OnGUI rect (:378-388), with the width taken as a
 * fraction of the screen instead of from a CIF record's native size -
 * the declared departure. Everything else is the classic law: bottom
 * anchored, aligned by the table's Alignment/Offset, and AlignRight
 * becoming AlignLeft under the handedness mirror (:459-464).
 *
 * `kick` is the lab's own: the recoil offset in NATIVE (320x200)
 * units, scaled with the surface so it reads the same at any window
 * size.
 */
export function placeSprite({
  canvasW, canvasH, frameW, frameH,
  widthPct = 0.62, align = ALIGN.Center, offset = 0,
  flip = false, kick = { x: 0, y: 0 }, offsetHeight = 0,
}) {
  const w = canvasW * widthPct;
  const h = w * (frameH / frameW);
  const a = (flip && align === ALIGN.Right) ? ALIGN.Left : align;
  let x;
  if (a === ALIGN.Left) x = canvasW * offset;
  else if (a === ALIGN.Center) x = canvasW / 2 - w / 2;
  else x = canvasW * (1 - offset) - w;
  const y = canvasH - h - offsetHeight;
  const sx = canvasW / 320, sy = canvasH / 200;
  return { x: x + kick.x * sx * (flip ? -1 : 1), y: y + kick.y * sy, w, h };
}

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
 */
export function muzzleLight(state, frame) {
  if (state !== 'Firing') return 0;
  const curve = [0, 1, 0.82, 0.3, 0.12, 0.04];
  return curve[frame] ?? 0;
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
 * is the same kick in a big one. `kick` is the impulse's rise, `stiff`
 * how hard the spring pulls home, `damp` how much it fights the
 * overshoot (around 2*sqrt(stiff) is critical - under it the barrel
 * bounces, over it it wallows).
 */
export function createRecoil({ kick = 16, stiff = 120, damp = 14, back = 0.42 } = {}) {
  const r = { x: 0, y: 0, vx: 0, vy: 0, kick, stiff, damp, back };
  /** The shot, as a DISPLACEMENT rather than an impulse: the barrel is
   *  already up by `kick` on the frame the trigger breaks, and the
   *  spring's job is the ride down. An impulse (`vy += kick`) reads as
   *  a soft push - the peak lands two frames late and a third of the
   *  size, which is the first thing the probe caught. A second shot
   *  fired into the recovery stacks on what is left, which is the
   *  reason this is a spring at all. */
  r.punch = (amount = r.kick) => { r.y += amount; r.x -= amount * r.back; };
  r.step = (dt) => {
    // sub-stepped: a spring this stiff integrated on a 30ms frame
    // explodes, and a lab that only feels right at 120fps is no lab
    const n = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      r.vx += (-r.stiff * r.x - r.damp * r.vx) * h;
      r.vy += (-r.stiff * r.y - r.damp * r.vy) * h;
      r.x += r.vx * h; r.y += r.vy * h;
    }
    return { x: r.x, y: -r.y };   // +y is up in the impulse, down on screen
  };
  return r;
}

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
 * The lists are the LAB's, in the order the audition put them - the
 * dropdowns open on the first, which is the pick.
 */
export const SFX = Object.freeze({
  fire: Object.freeze([
    ['fire-shotgun', 'shotgun (clean crack)'],
    ['fire-20gauge', '20 gauge (the real one)'],
    ['fire-musket', 'musket (black powder)'],
    ['fire-blast', 'blast (short tail)'],
    ['fire-dry', 'dry (no room)'],
    ['gun-fire-synth', 'synth (ours)'],
  ]),
  'reload-open': Object.freeze([
    ['open-winchester', 'winchester cock'],
    ['open-rack', 'shotgun rack'],
    ['open-gunrack', 'gun rack (dark)'],
    ['open-shell', 'shell'],
    ['gun-reload-open-synth', 'synth (ours)'],
  ]),
  'reload-close': Object.freeze([
    ['close-ready', 'ready (snaps shut)'],
    ['close-rack2', 'rack 2'],
    ['close-rack3', 'rack 3'],
    ['close-shell', 'shell home'],
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
const shakeNoise = (p, seed) => (
  Math.sin(p * seed * 1.7) * 0.6
  + Math.sin(p * seed * 3.1 + 1.3) * 0.3
  + Math.sin(p * seed * 7.3 + 2.7) * 0.1
);

export function createScreenShake({ amount = 7, decay = 3.2, freq = 26, rot = 0.7 } = {}) {
  const s = { trauma: 0, t: 0, amount, decay, freq, rot };
  s.punch = (a = 1) => { s.trauma = Math.min(1, s.trauma + a); };
  s.step = (dt) => {
    s.t += dt;
    s.trauma = Math.max(0, s.trauma - s.decay * dt);
    const k = s.trauma * s.trauma;
    if (k === 0) return { x: 0, y: 0, rot: 0 };
    const p = s.t * s.freq;
    return {
      x: s.amount * k * shakeNoise(p, 1),
      y: s.amount * k * shakeNoise(p, 1.7),
      rot: s.rot * k * shakeNoise(p, 2.3) * Math.PI / 180,
    };
  };
  return s;
}

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

/** The mod's declared defaults, as the store would answer them. */
export function widgetDefaults() {
  const keys = MOD_SETTINGS[WEAPON_WIDGET_VENDOR].keys;
  const out = {};
  for (const k of Object.keys(keys)) out[k] = keys[k].default;
  return out;
}

/** The mod's settings with the lab's overrides on top, derived through
 *  readWidgetSettings so every multiplier is the mod's own. */
export function labWidgetSettings(overrides = {}) {
  return readWidgetSettings(() => ({ ...widgetDefaults(), 'Modules.Inertia': true, ...overrides }));
}

/** FPSWeaponClone's .ctor fields, the ones the three modules carry
 *  between frames. */
export function createWidgetRig() {
  return {
    time: 0,
    position: [0, 0], scale: [1, 1], offset: [0, 0],
    offsetCurrent: [0, 0], offsetTarget: [0, 0],
    moveSmooth: 0, bobSmooth: [0, 0],
    inertiaCurrent: [0, 0], inertiaTarget: [0, 0], inertiaSpeedMod: 1,
    inertiaForwardCurrent: [0, 0], inertiaForwardTarget: [0, 0],
  };
}

/**
 * One frame of the three modules, in the component's own order -
 * Offset, then Bob, then Inertia - writing the same three channels the
 * clone publishes. `idle` is the machine's Idle, which is what the mod
 * gates Bob and Inertia on; `shown` false is the reload lower.
 */
export function widgetRigStep(rig, s, dt, {
  screenRect, motion, look = [0, 0], flip = false, idle = true,
  shown = true, hiddenTarget = [0, 0.55], liveSpeed = 50, cursorActive = false, swingHeld = false,
}) {
  rig.time += dt;
  rig.position = [0, 0]; rig.scale = [1, 1]; rig.offset = [0, 0];
  if (s.offset) {
    const o = offsetStep({
      offsetCurrent: rig.offsetCurrent, offsetTarget: rig.offsetTarget,
      animating: false, shown, equipCountdown: 0, hiddenTarget,
    }, dt, liveSpeed / 100 * s.offsetSpeed);   // get_offsetSpeedLive
    rig.offsetCurrent = o.offsetCurrent; rig.offsetTarget = o.offsetTarget;
    rig.offset = [rig.offset[0] + o.delta[0], rig.offset[1] + o.delta[1]];
  }
  if (s.bob && idle) {
    const b = bobStep({ moveSmooth: rig.moveSmooth, bobSmooth: rig.bobSmooth, time: rig.time, screenRect }, s, motion, dt);
    rig.moveSmooth = b.moveSmooth; rig.bobSmooth = b.bobSmooth;
    rig.position = [rig.position[0] + b.delta[0], rig.position[1] + b.delta[1]];
  }
  if (s.inertia && idle) {
    const i = inertiaStep({
      inertiaCurrent: rig.inertiaCurrent, inertiaTarget: rig.inertiaTarget,
      inertiaForwardCurrent: rig.inertiaForwardCurrent, inertiaForwardTarget: rig.inertiaForwardTarget,
      screenRect, flip, look, cursorActive, swingHeld,
    }, s, motion, dt);
    rig.inertiaCurrent = i.inertiaCurrent; rig.inertiaTarget = i.inertiaTarget; rig.inertiaSpeedMod = i.inertiaSpeedMod;
    rig.inertiaForwardCurrent = i.inertiaForwardCurrent; rig.inertiaForwardTarget = i.inertiaForwardTarget;
    rig.scale = [rig.scale[0] + i.scale[0], rig.scale[1] + i.scale[1]];
    rig.position = [rig.position[0] + i.delta[0], rig.position[1] + i.delta[1]];
  }
  return rig;
}

/**
 * THE MOTOR'S FRAME, as the rig assembles it for the clone
 * (weaponRig.js:895-902) - baseSpeed from GetBaseSpeed's walk arm,
 * speedRatio the live speed over it, and localVel the eye's motion
 * turned into the body's frame (right, up, forward). The lab has no
 * motor, so `walking`/`running` stand in for one and the vector is
 * built the same way round.
 */
export function labMotion({ walking = false, running = false, crouching = false, liveSpeed = 50, strafe = 0 } = {}) {
  const base = walkSpeed(liveSpeed);
  const speed = walking ? (running ? runSpeed(liveSpeed, 50, crouching) : base) : 0;
  return {
    grounded: true, crouching, riding: false, standing: !walking,
    speedRatio: base > 0 ? speed / base : 1,
    baseSpeed: base,
    localVel: [strafe * speed, 0, walking ? speed : 0],
  };
}

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
export function unionDrawRect(anchorRect, anchor, union) {
  const scale = anchorRect.w / anchor.w;
  return {
    x: anchorRect.x - (anchor.x - union.x) * scale,
    y: anchorRect.y - (anchor.y - union.y) * scale,
    w: union.w * scale,
    h: union.h * scale,
  };
}
