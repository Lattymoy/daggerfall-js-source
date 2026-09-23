// THE DEATH SCREEN (UI arc, D1). This module was ui/inventory.js and
// held three windows; two of them retired onto their classic art and
// the third is what is left, so the file finally carries its name.
//
//   (The keyed INVENTORY window that lived here is DELETED at U26.
//   It was the dungeon host's until that slice swapped in the classic
//   ui/nativeInventory.js window, after which nothing imported it.
//   Its one law - EquipItem excludes exactly Weapons/Arrow and hands
//   everything else to the equip table - was never the window's: it
//   lives in systems/equip.js, where every host now reaches it.)
//
//   (The keyed SPELLBOOK window that lived here is DELETED at U42,
//   which puts DaggerfallSpellBookWindow on the real SPBK00I0.IMG in
//   ui/spellbookWindow.js - list, icons, effect panels, delete,
//   rename, sort and the guilds' buy mode. Its `knownSpells` helper
//   went with it: the interim "an empty book lists the file's ranged
//   damage spells" fallback had been dead for players since S3c gave
//   chargen real starting spells, and the two flight probes that
//   still wanted that list read spellcast.rangedDamageSpells now.)
//
// Death (D1): health 0 opens this through the ONE hurtPlayer door and
// it drives PlayerDeath's whole sequence - the camera sinks a
// quarter-capsule below the feet, the HUD fades black over two
// seconds, the classic death sound plays, and three seconds in the
// host runs ANIM0012.VID and returns to the title menu (DFU's
// TitleMenuFromDeath). ENTER skips to that end; the F11 hint is the
// real quickload binding (InputManager.SetupDefaults: F9/F11).

import { drawText, measureText } from './text.js';
import { PlayerDeathSequence, DEATH_TIME_BEFORE_RESET } from '../systems/playerDeath.js';   // D1
import { playerEntity } from '../characters/playerEntity.js';   // D1: the death clip's race/gender
import { audio } from '../systems/audio.js';
import { isEnhanced } from '../systems/uiSkin.js';   // DEATH2: the enhanced skin paints its own
import { drawEnhancedDeath } from './enhancedDeath.js';
import { EYE_HEIGHT } from '../player/motor.js';
import { isOnlinePage } from '../systems/onlineLane.js';   // DEATH4: the online screen counts down, the offline one waits

/** DEATH4 (Discord, 2026-09-23: "don't let it fade away automatically in
 *  offline mode, only in online mode - and give it 10 seconds"). On the
 *  enhanced skin the screen no longer ends itself three seconds in
 *  (DFU's TimeBeforeReset, which the classic skin keeps): OFFLINE it
 *  waits for the player - Enter ends the run, F11 loads - and ONLINE it
 *  respawns on its own after this many seconds, or at once on Enter. */
// DEATH6 (Discord, 2026-09-23: "a 60 second cooldown or skip it with Enter - the same time it takes till his
// corpse disappears"): the wait is the body's own life on the others' screens (net/remotePlayers.js CORPSE_MS), so a
// player who waits it out rises as their body fades, and Enter still rises at once.
export const ONLINE_RESPAWN_SECONDS = 60;   // DEATH3: the standing eye the fall starts from

const DIM = [0.5, 0.5, 0.45, 1];

/** DEATH3 (Discord, 2026-09-23: "the character when he dies should not
 *  sink into the ground - make it fall backwards, looking up in the
 *  air"). THE ENHANCED SKIN'S FALL, in place of DFU's sink.
 *
 *  DFU drops the eye to a quarter of the capsule BELOW the feet
 *  (deathCameraTarget) - the view goes through the floor. The classic
 *  skin keeps that law byte for byte. On the enhanced skin the body
 *  falls backwards instead: the eye accelerates down to lie just off
 *  the ground, lands with a small jolt, and the view tips up to the sky
 *  - the last thing a fallen fighter sees. Pure over the sequence's own
 *  clock, so every host that already reads `drop` gets the fall. */
export const FALL_REST_EYE = 0.25;     // metres: the eye of a body lying on its back
export const FALL_TIME = 0.75;         // seconds from standing to the ground
export const FALL_LOOK_UP = 1.3;       // radians of pitch at rest - the sky, short of straight up
export const FALL_LOOK_TIME = 1.25;    // the head tips back a beat slower than the body drops
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export function fallCurve(elapsed) {
  const e = Math.max(0, Number(elapsed) || 0);
  const p = clamp01(e / FALL_TIME);
  let drop = p * p;   // a fall accelerates
  // THE LANDING: one small bounce off the ground, then still.
  const after = e - FALL_TIME;
  if (after > 0 && after < 0.28) drop -= 0.07 * Math.sin((after / 0.28) * Math.PI);
  const q = clamp01(e / FALL_LOOK_TIME);
  let look = 1 - (1 - q) ** 3;   // the head goes back fast and settles
  // ...and the jolt of the impact snaps it a touch further, then back.
  if (after > 0 && after < 0.35) look += 0.06 * Math.sin((after / 0.35) * Math.PI);
  return { drop, look };
}
/** D1: the death screen DRIVES PlayerDeath's sequence - the camera
 *  sinks, the HUD fades to black over two seconds, the classic death
 *  sound plays once, and three seconds in the host's onReset runs
 *  (the death video, then the title menu: DFU's
 *  StartMethods.TitleMenuFromDeath). ENTER skips straight to that
 *  reset rather than reloading the same scene, which is where DFU's
 *  death lands you; F11 still quickloads, the port's own affordance
 *  and the reason the hint is drawn. `drop` is read by each host's
 *  frame to sink its camera - one player, one death, one law. */
export class DeathScreen {
  constructor({ eyeHeight, capsuleHeight, onReset = null, entity = playerEntity, hint = 'ENTER end   F11 load' } = {}) {
    this.done = false;
    this.hint = hint;   // FIX-E: a host with no quickload (the fixed city) draws no F11 - a hint that is a lie is worse than none
    // MERGE AUDIT: the death clip is the character's OWN race/gender
    // Pain3 whenever CombatVoices is on (it ships on), so the sequence
    // needs an identity. It reads the shared player entity here - ONE
    // seam, the way onReset is one seam - rather than making all four
    // hosts remember to pass a race they all already import.
    // DEATH3: the fall is the enhanced skin's; the classic keeps DFU's sink.
    this.fall = isEnhanced();
    this.online = isOnlinePage();
    this.clock = 0;   // DEATH4: the enhanced screen's own clock (the sequence's stops short of its reset)
    this.eyeHeight = Number.isFinite(eyeHeight) ? eyeHeight : EYE_HEIGHT;
    this._view = null;   // { cam, pitch } - the pitch to hand back if the run goes on (an online respawn)
    this.sequence = new PlayerDeathSequence({
      eyeHeight, capsuleHeight,
      onReset: () => {
        // DEATH3: a respawn comes back to the world looking where the
        // player was looking, not at the sky the body fell into.
        if (this._view) { this._view.cam.pitch = this._view.pitch; this._view = null; }
        onReset?.();
      },
      race: entity?.raceId ?? null, gender: entity?.gender ?? null,
      playSound: (clip) => audio.playOneShot(clip, 1),
    });
  }
  get drop() {
    if (!this.fall) return this.sequence.drop;
    return fallCurve(this.sequence.elapsed).drop * Math.max(0, this.eyeHeight - FALL_REST_EYE);
  }
  /** DEATH3: the fall's pitch, written onto the host's camera after its
   *  `drop` line. The pitch the player had is kept on the first call and
   *  eased toward the sky from there. No-op on the classic skin. */
  tiltView(cam) {
    if (!this.fall || !cam || this.sequence.reset) return;
    if (!this._view) this._view = { cam, pitch: Number(cam.pitch) || 0 };
    const { look } = fallCurve(this.sequence.elapsed);
    const from = this._view.pitch;
    cam.pitch = from + (FALL_LOOK_UP - from) * look;
  }
  tick(dt) {
    if (!this.fall) { this.sequence.tick(dt); return; }   // classic: DFU's three seconds, untouched
    // DEATH4: the sequence runs its fall, fade and sound as ever but is
    // HELD a hair short of its own reset - the reset is this screen's to
    // call: the online countdown, or the player's Enter (input below).
    this.clock += Math.max(0, Number(dt) || 0);
    if (this.online && this.clock >= ONLINE_RESPAWN_SECONDS) { this.sequence.tick(DEATH_TIME_BEFORE_RESET + 1); return; }
    const room = DEATH_TIME_BEFORE_RESET - 1e-3 - this.sequence.elapsed;
    this.sequence.tick(Math.max(0, Math.min(Number(dt) || 0, room)));
  }
  /** RESURRECT1: the view handed back without a reset - a resurrection closes the screen in place. */
  restoreView() { if (this._view) { this._view.cam.pitch = this._view.pitch; this._view = null; } }
  /** DEATH4: whole seconds left before an online respawn, or null offline. */
  get respawnIn() {
    if (!this.fall || !this.online) return null;
    return Math.max(0, Math.ceil(ONLINE_RESPAWN_SECONDS - this.clock));
  }
  input(action) {
    // ENTER ends the run now; the sequence's own reset is the timer.
    if (action === 'confirm') this.sequence.tick(DEATH_TIME_BEFORE_RESET + 1);
  }
  draw(renderer, canvas, font, s) {
    // FadeHUDToBlack over the death: the world dims to black behind
    // the text rather than sitting under a fixed red wash.
    const fade = this.sequence.fade;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [0.05, 0.01, 0.01, 0.35 + 0.6 * fade]);
    // DEATH2 (Discord, 2026-09-23: "make it enhanced style with You died
    // and make it look deathly - enhanced/online only"): the enhanced
    // skin draws the words as a DOM layer over the same fade; the classic
    // skin keeps the canvas text below, untouched.
    if (isEnhanced() && typeof document !== 'undefined') { drawEnhancedDeath(this, fade); return; }
    const t = 'YOU HAVE DIED';
    drawText(renderer, font, t, (canvas.width - measureText(font.fnt, t) * s) / 2, canvas.height / 2 - 10 * s, s, [0.9, 0.2, 0.15, 1]);
    drawText(renderer, font, this.hint, (canvas.width - measureText(font.fnt, this.hint) * s) / 2, canvas.height / 2 + 6 * s, s, DIM);
  }
}
