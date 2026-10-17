// @ts-check
// DRUNK1 (2026-10-17, asked for: "Lets add that to the project" - a drink
// you can SEE). THE DRINK, FELT: what the tavern's counter does to the
// eye and the feet. Until now being drunk was the stat swing, the lines
// at the bar and an amber tankard on the HUD (survival/status.js); the
// world on screen stood still however much was poured. Neither DFU nor
// Climates & Calories has any of this - the port's own, and a picture
// with no gameplay in it but the stumble, so each player's own online.
//
// ONE READING, THE COUNTER'S. Nothing here keeps a drunkenness of its
// own: `drunkStateOf` reads `entity.survival.drunk` against the LIVE
// endurance in the bands the HUD's chip already uses (status.js
// survivalHudChips: past half the endurance Drunk, past the endurance
// less ten Very drunk), so the sway starts with the chip and sobers
// with the counter (needs.js: one off every ten minutes). With
// Climates & Calories off nothing is felt, as nothing is poured.
//
// THREE THINGS, ONE INTENSITY. The band's share (0 at the Drunk line, 1
// at the endurance) sets a target the felt intensity eases toward, so a
// drink comes on and wears off rather than switching:
//   - THE SWAY: a slow roll, pitch and yaw of the view and a little
//     drift of the eye, sums of unrelated sines so it never repeats
//     visibly - folded into the frame's view matrix after Better
//     Ambience's shake (world/viewFold.js foldAfterShake: the one
//     view-space fold every host already calls, on or off), so the aim,
//     the motor and the look are untouched;
//   - THE STUMBLE: now and then, walking on the ground, a lurch to one
//     side - the motor's own blow push (motor.js blowPush, which stops
//     at a wall and never carries the body over an edge) - and a roll
//     kick on the view with it;
//   - THE LENS: a warm vignette that breathes at the screen's edge,
//     drawn by the HUD's one host-agnostic call (hud.js drawHud), over
//     every host.
// The row's part (`survivalDrunkFeel`, systems/features.js) turns all
// three off - for a player the motion bothers. The words (drunkSpeech.js)
// are not on it: a slurred line moves nothing on screen.

import { getPref } from '../uiPrefs.js';
import { survivalOn } from './switch.js';
import { liveStat } from '../statMods.js';
import { shakeView, foldAfterShake } from '../../world/viewFold.js';   // the one view-space fold, a leaf (not the mod: the HUD imports this module)

/** DRUNK1: the Climates & Calories row's part (systems/features.js) - the sway, the stumble and the lens, on unless switched off. */
export const DRUNK_FEEL_PREF = 'survivalDrunkFeel';

/** The bands, as status.js survivalHudChips draws them: the chip appears past half the endurance, turns Very drunk past
 *  the endurance less this. */
export const VERY_DRUNK_MARGIN = 10;

/** The felt intensity at the Drunk line, and at the endurance: a drink that lights the chip is felt at once, not at a
 *  hundredth of the sway. */
export const FEEL_FLOOR = 0.35;
/** How fast the felt intensity follows its target (per second) - two seconds from sober to the full sway. */
export const FEEL_EASE = 0.5;

/** THE SWAY at full intensity, degrees: [amplitude, [weight, Hz, phase] x2] per axis. Slow - a fifth of a second's
 *  turn would read as a shake, not a drink. */
export const SWAY = Object.freeze({
  roll: Object.freeze({ deg: 3.5, waves: Object.freeze([[0.7, 0.13, 0], [0.3, 0.31, 1.3]]) }),
  pitch: Object.freeze({ deg: 1.2, waves: Object.freeze([[0.6, 0.17, 0.7], [0.4, 0.41, 2.1]]) }),
  yaw: Object.freeze({ deg: 1.8, waves: Object.freeze([[0.65, 0.11, 2.4], [0.35, 0.27, 0.4]]) }),
});
/** The eye's drift at full intensity, metres: side to side with the roll, and a little up and down. */
export const EYE_DRIFT = Object.freeze({ side: 0.04, up: 0.02 });

/** THE STUMBLE: lurches a second at full intensity (a Poisson rate, so they never come on a beat), never two closer
 *  than the gap; the push's speed (m/s, the motor decays it at BLOW_PUSH_DECAY) and the view's roll kick. */
export const STUMBLE_RATE = 0.3;
export const STUMBLE_GAP_S = 1.5;
export const STUMBLE_SPEED = Object.freeze({ base: 1.5, perIntensity: 2 });
export const STUMBLE_KICK_DEG = 4;
export const STUMBLE_KICK_S = 0.6;

/** THE LENS: the vignette's colour, its alpha at full intensity and how much it breathes. */
export const LENS_RGB = Object.freeze([0.16, 0.09, 0.03]);
export const LENS_ALPHA = 0.45;
export const LENS_BREATH = 0.1;
export const LENS_HZ = 0.2;
/** The vignette texture: its side in texels, and where its ramp starts and ends as a share of the half-diagonal... */
export const LENS_SIZE = 64;
export const LENS_RAMP = Object.freeze({ from: 0.55, to: 1.25, power: 1.6 });

const TAU = Math.PI * 2;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** How far past the Drunk line a counter stands: 0 at half the endurance (or under), 1 at the endurance. */
export function drunkShare(drunk, endurance) {
  const e = Number.isFinite(endurance) && endurance > 0 ? endurance : 50;
  if (!(drunk > e / 2)) return 0;
  return clamp01((drunk - e / 2) / (e / 2));
}

/** 'sober', 'drunk' or 'veryDrunk' - the HUD chip's bands (status.js survivalHudChips). */
export function drunkBand(drunk, endurance) {
  const e = Number.isFinite(endurance) && endurance > 0 ? endurance : 50;
  if (!(drunk > e / 2)) return 'sober';
  return drunk > e - VERY_DRUNK_MARGIN ? 'veryDrunk' : 'drunk';
}

/** The player's drink as it is felt: the band and the share, off the record and the live endurance. Sober while
 *  Climates & Calories is off (`on`), whatever an old counter holds. */
export function drunkStateOf(entity, { on = survivalOn } = {}) {
  const drunk = entity?.survival?.drunk;
  if (!entity || !on() || !(drunk > 0)) return { band: 'sober', share: 0 };
  const endurance = liveStat(entity, 'endurance');
  return { band: drunkBand(drunk, endurance), share: drunkShare(drunk, endurance) };
}

/** The intensity a state is felt at: nothing sober, FEEL_FLOOR at the Drunk line, one at the endurance. */
export const feelTarget = ({ band, share }) => (band === 'sober' ? 0 : FEEL_FLOOR + (1 - FEEL_FLOOR) * clamp01(share));

/** One axis of the sway at clock `t` (seconds), in degrees at intensity 1. */
const wave = (axis, t) => axis.deg * axis.waves.reduce((sum, [w, hz, ph]) => sum + w * Math.sin(TAU * hz * t + ph), 0);

/** THE SWAY at clock `t` and `intensity`: { rot: [pitch, yaw, roll] degrees, pos: [side, up, 0] metres } - shakeView's
 *  own shape (a local euler and offset on the camera's frame). */
export function swayAt(t, intensity) {
  const k = clamp01(intensity);
  return {
    rot: [k * wave(SWAY.pitch, t), k * wave(SWAY.yaw, t), k * wave(SWAY.roll, t)],
    pos: [k * EYE_DRIFT.side * Math.sin(TAU * SWAY.roll.waves[0][1] * t + 0.5), k * EYE_DRIFT.up * Math.sin(TAU * 0.26 * t), 0],
  };
}

/** The chance of a stumble in a frame of `dt` seconds at `intensity` (a Poisson rate). */
export const stumbleChance = (dt, intensity) => (dt > 0 && intensity > 0 ? 1 - Math.exp(-STUMBLE_RATE * clamp01(intensity) * dt) : 0);

/** The lens's alpha at clock `t` and `intensity`. */
export const lensAlphaAt = (t, intensity) => (intensity > 0 ? clamp01(intensity) * (LENS_ALPHA + LENS_BREATH * Math.sin(TAU * LENS_HZ * t)) : 0);

/** The vignette, white with the ramp in its alpha (the quad's colour tints it): { width, height, colors } as
 *  renderer.uploadTexture takes it. */
export function lensImage(size = LENS_SIZE) {
  const colors = new Uint32Array(size * size);
  const u8 = new Uint8Array(colors.buffer);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot((x - c) / c, (y - c) / c);   // 1 at an edge's middle, 1.41 at a corner
      const a = Math.pow(clamp01((r - LENS_RAMP.from) / (LENS_RAMP.to - LENS_RAMP.from)), LENS_RAMP.power);
      const i = (y * size + x) * 4;
      u8[i] = 255; u8[i + 1] = 255; u8[i + 2] = 255; u8[i + 3] = Math.round(a * 255);
    }
  }
  return { width: size, height: size, colors };
}

let _lens = null;   // made once: the upload is keyed and cached, the picture need not be drawn again a frame

/** Can this body stumble now: walking on the ground, nothing else holding it. */
function canStumble(p) {
  if (!p || typeof p.blowPush !== 'function') return false;
  if (!p.grounded || p.jumping || p.swimming || p.isPlayerSwimming || p.levitating || p.riding) return false;
  if (p.climb?.isClimbing || p.isDown?.() || p.freezeMotor > 0 || p.paralyzed) return false;
  return !!(p.moveForward || p.moveStrafe) && Number.isFinite(p.moveYaw);
}

/**
 * The player's one drunk feel, driven by the four hosts:
 *   frame(dt, { entity, player, paused }) - once a frame, beside Better Ambience's (the clock holds under a window)
 *   view(view) - the sway folded into the frame's view matrix (Better Ambience's view calls it, after its shake)
 *   drawLens(renderer, canvas) - the vignette, from the HUD's draw
 *   state() - the drink as it stands now (drunkSpeech.js reads it for the words)
 */
export function createDrunkFeel({ rng = Math.random, on = survivalOn, enabled = () => getPref(DRUNK_FEEL_PREF) !== false } = {}) {
  let entity = null;
  let t = 0;
  let intensity = 0;
  let sinceStumble = Infinity;
  let kick = 0, kickLeft = 0;
  return {
    frame(dt, { entity: e = null, player = null, paused = false } = {}) {
      if (e) entity = e;
      const step = paused ? 0 : Math.max(0, Number(dt) || 0);
      if (!(step > 0)) return;
      const target = enabled() ? feelTarget(drunkStateOf(entity, { on })) : 0;
      intensity = target > intensity ? Math.min(target, intensity + FEEL_EASE * step) : Math.max(target, intensity - FEEL_EASE * step);
      t += step;
      sinceStumble += step;
      if (kickLeft > 0) kickLeft = Math.max(0, kickLeft - step);
      if (intensity > 0 && sinceStumble >= STUMBLE_GAP_S && canStumble(player) && rng() < stumbleChance(step, intensity)) {
        const side = rng() < 0.5 ? -1 : 1;
        const speed = side * (STUMBLE_SPEED.base + STUMBLE_SPEED.perIntensity * intensity);
        const yaw = /** @type {number} */ (player.moveYaw);
        player.blowPush(Math.cos(yaw) * speed, -Math.sin(yaw) * speed);   // HANDEDNESS (mat4's law): right = (cos, 0, -sin)
        kick = side * STUMBLE_KICK_DEG * intensity; kickLeft = STUMBLE_KICK_S;
        sinceStumble = 0;
      }
    },
    view(view) {
      if (!(intensity > 0)) return view;
      const s = swayAt(t, intensity);
      if (kickLeft > 0) s.rot[2] += kick * Math.sin(Math.PI * (1 - kickLeft / STUMBLE_KICK_S));   // out and back over the kick's time
      return shakeView(view, s.pos, s.rot);
    },
    drawLens(renderer, canvas) {
      const a = lensAlphaAt(t, intensity);
      if (!(a > 0) || !renderer?.uploadTexture || !canvas) return false;
      const tex = renderer.uploadTexture('drunk', 'lens', (_lens ??= lensImage()), { smooth: true });
      renderer.drawScreenQuad(tex, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [LENS_RGB[0], LENS_RGB[1], LENS_RGB[2], a], { blend: true });
      return true;
    },
    state: () => drunkStateOf(entity, { on }),
    /** A load or a new character: nothing carried over (the next frame reads the new record). */
    reset() { intensity = 0; kickLeft = 0; sinceStumble = Infinity; },
    get intensity() { return intensity; },
  };
}

/** The game's one - its sway folded into every host's view after Better Ambience's shake (foldAfterShake). */
export const drunkFeel = createDrunkFeel();
foldAfterShake((view) => drunkFeel.view(view));
