// TR2 - THE RIDING SPRITE AND ITS AUDIO: TransportManager.cs's Update
// (:210-280) and OnGUI (:285-318) halves, on top of TR1's mode.
//
// The sprite: MRED00I0.CFA (horse) or MRED01I0.CFA (cart), four frames
// on a 0.125s clock, drawn bottom-centre of the screen at a horizontal
// scale of 0.8 - `ScaleFactorX` "adjusts horizontal aspect ratio to
// match classic" (:40). Standing still, airborne or paused freezes the
// animation on frame 0 (:213-220), which is also DFU's cue to fade the
// riding loop out.
//
// The audio, three separate things:
//   - the RIDING LOOP: HorseClop2 for a horse (UpdateMode :344 picks
//     it, and the Update swaps between HorseClop and HorseClop2 on the
//     half-speed EDGE, :253-266), HorseAndCart for a cart. Volume is
//     RidingVolumeScale 0.6, HALVED below half speed, and the pitch is
//     1.2 while running (which TR1 makes unreachable while mounted -
//     recorded, not fixed: DFU has the same dead branch).
//   - the STOP: a 0.2s real-time delay before the loop actually stops
//     (:203-209), so a step-pause-step does not chop the clop.
//   - the NEIGH: AnimalHorse, one-shot, at a time that re-rolls to
//     `now + Random.Range(2, 40)` seconds - and on MOUNTING to
//     `now + Random.Range(1, 5)` (:352). It fires for a CART too: the
//     neigh block (:274-278) is outside the horse-only arm.
//
// Unity's Random.Range(int, int) is max-EXCLUSIVE, so the two windows
// are 2..39 and 1..4 whole seconds; `rolls` stands in - THE ENGINE-PRNG
// RULE, Ledger A, by name.

import { CfaFile } from '../formats/cfaFile.js';
import { frameToColor32 } from '../combat/fpsWeapon.js';   // TR2: the same index-to-RGBA the weapon art uses
import { TRANSPORT_MODES, isRiding } from './transport.js';

/** :148-155. */
export const HORSE_TEXTURE = 'MRED00I0.CFA';
export const CART_TEXTURE = 'MRED01I0.CFA';
export const ANIM_FRAME_TIME = 0.125;
export const RIDING_VOLUME_SCALE = 0.6;
export const SCALE_FACTOR_X = 0.8;
export const NATIVE_SCREEN_HEIGHT = 200;
export const STOP_RIDING_DELAY = 0.2;

/** The four clips this manager plays, by SoundClips name. */
export const RIDING_SOUND = Object.freeze({
  neigh: 'AnimalHorse',
  horseSlow: 'HorseClop',
  horseFast: 'HorseClop2',
  cart: 'HorseAndCart',
});

export const ridingTextureName = (mode) => (mode === TRANSPORT_MODES.Cart ? CART_TEXTURE : HORSE_TEXTURE);

/** UpdateMode's clip pick (:343-345): a horse starts on the FAST clop,
 *  a cart on its own loop. */
export const ridingLoopClip = (mode) => (mode === TRANSPORT_MODES.Cart ? RIDING_SOUND.cart : RIDING_SOUND.horseFast);

/** Random.Range(2, 40) (:277) and Random.Range(1, 5) (:352), both
 *  max-exclusive whole seconds. */
export const nextNeighDelay = (rolls = Math.random) => 2 + Math.floor(rolls() * 38);
export const mountNeighDelay = (rolls = Math.random) => 1 + Math.floor(rolls() * 4);

/** Loads one mount's CFA and uploads its frames, the same way the
 *  first-person weapon loads its CIF (fpsWeapon.loadFpsWeaponArt). */
export async function loadRidingArt(getBytes, palette, renderer, mode) {
  const fileName = ridingTextureName(mode);
  const cfa = new CfaFile();
  cfa.load(await getBytes(fileName), fileName, palette);
  const { width, height } = cfa.getSize(0);
  const frames = [];
  for (let f = 0; f < cfa.getFrameCount(0); f++) {
    const c32 = frameToColor32(cfa.getDFBitmap(0, f), palette, null);
    frames.push(renderer.uploadTexture('img', `ride:${fileName}:${f}`, c32));
  }
  return { fileName, width, height, frames };
}

/**
 * OnGUI's rect (:300-315): bottom-centre, the height scaled to the
 * 200-line native screen and the width by that scale times 0.8.
 * `hudOffset` is LargeHUD's height when both LargeHUD and
 * LargeHUDOffsetHorse are on (:304-309) - the port passes 0 until the
 * large HUD grows that setting.
 */
export function ridingRect(canvas, art, hudOffset = 0) {
  const scaleY = canvas.height / NATIVE_SCREEN_HEIGHT;
  const scaleX = scaleY * SCALE_FACTOR_X;
  const w = art.width * scaleX;
  const h = art.height * scaleY;
  return { x: canvas.width / 2 - w / 2, y: canvas.height - h - hudOffset, w, h };
}

/**
 * TransportManager's Update, the riding half. Pure: it takes the
 * frame's facts and answers what the sprite and the audio should be.
 */
export class RidingAnimator {
  constructor() {
    this.frameIndex = 0;
    this.lastFrameTime = 0;   // 0 is DFU's "not started" sentinel (:215)
    this.now = 0;
    this.neighTime = 0;
    this.wasMovingLessThanHalfSpeed = true;
    this.stopAt = null;       // the 0.2s StopRidingAudio coroutine
    this.playing = false;
    this.clip = null;
  }

  /** UpdateMode (:330-356)'s riding arm: the loop clip is set, the
   *  audio is stopped, and the neigh is re-armed close. */
  mount(mode, { rolls = Math.random } = {}) {
    this.frameIndex = 0;
    this.lastFrameTime = 0;
    this.playing = false;
    this.stopAt = null;
    this.clip = ridingLoopClip(mode);
    this.neighTime = this.now + mountNeighDelay(rolls);
  }

  /**
   * @returns {{frame:number, clip:string|null, playing:boolean,
   *            volume:number, pitch:number, neigh:boolean}}
   */
  update(dt, { mode = TRANSPORT_MODES.Foot, standingStill = false, grounded = true,
    paused = false, movingLessThanHalfSpeed = true, running = false,
    soundVolume = 1, rolls = Math.random } = {}) {
    this.now += dt;
    if (!isRiding(mode)) return { frame: 0, clip: this.clip, playing: false, volume: 0, pitch: 1, neigh: false };
    if (standingStill || !grounded || paused) {
      // :213-220 - the animation resets and the loop fades after 0.2s.
      this.lastFrameTime = 0;
      this.frameIndex = 0;
      if (this.stopAt == null && this.playing) this.stopAt = this.now + STOP_RIDING_DELAY;
      if (this.stopAt != null && this.now >= this.stopAt) { this.playing = false; this.stopAt = null; }
    } else {
      // :221-233 - the 0.125s frame clock, wrapping 3 -> 0.
      if (this.lastFrameTime === 0) this.lastFrameTime = this.now;
      else if (this.now > this.lastFrameTime + ANIM_FRAME_TIME) {
        this.lastFrameTime = this.now;
        this.frameIndex = this.frameIndex === 3 ? 0 : this.frameIndex + 1;
      }
      if (mode === TRANSPORT_MODES.Horse) {
        // :234-248 - the clop swaps on the half-speed EDGE, not the state.
        this.stopAt = null;
        if (!this.wasMovingLessThanHalfSpeed && movingLessThanHalfSpeed) {
          this.wasMovingLessThanHalfSpeed = true;
          this.clip = RIDING_SOUND.horseSlow;
        } else if (this.wasMovingLessThanHalfSpeed && !movingLessThanHalfSpeed) {
          this.wasMovingLessThanHalfSpeed = false;
          this.clip = RIDING_SOUND.horseFast;
        }
      }
      this.playing = true;
    }
    // :268-273 - the volume and pitch are set every moving frame.
    const volume = (movingLessThanHalfSpeed ? RIDING_VOLUME_SCALE * 0.5 : RIDING_VOLUME_SCALE) * soundVolume;
    const pitch = running ? 1.2 : 1;
    // :274-278 - the neigh, OUTSIDE the horse-only arm: a cart neighs too.
    let neigh = false;
    if (this.neighTime < this.now) {
      neigh = true;
      this.neighTime = this.now + nextNeighDelay(rolls);
    }
    return { frame: this.frameIndex, clip: this.clip, playing: this.playing, volume, pitch, neigh };
  }
}
