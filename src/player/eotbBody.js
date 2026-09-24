// EOTB5: THE LIVE BODY - what actually appears behind the camera.
//
// EOTB-IL (2026-09-17): THIS FILE IS `PlayerBillboard`, METHOD FOR
// METHOD. Mac: "it needs to be 1:1 with the uploaded file. No
// exceptions." The assembly is read now (`eotbBillboard.js`'s head
// says how), and the MonoBehaviour's three Unity phases run here in
// Unity's own order every frame the billboard is active:
//
//   Update        - the orientation clock, the mirror revert
//   coroutines    - the delayed repaints, the one-shot in flight
//   LateUpdate    - the facing, the material, the attack doors, the
//                   walk loop, the landing footstep
//
// Every law is the IL's and cites its offset. The two reports Mac
// filed were both in the old file: a five-frame clock over records
// that are not five frames (the chop), and the camera's angle measured
// the wrong way round (the turn). Both live in `eotbBillboard.js` now
// as the laws they were, and this file is the machine that runs them.
//
// ═══ THE FOUR HOSTS, AND WHY NONE OF THEM IS TOUCHED ══════════════
//
// The FOUR HOSTS rule in `bible/Home.md` says a slice wiring a
// seam into a host must name all four. Named: `scenes/exterior.js`, `scenes/world.js`,
// `scenes/worldModes.js` and `scenes/dungeonContext.js`. NONE carries
// a call for this body, and that is the wiring rather than a gap.
//
// All four build a weapon rig (`combat/weaponRig.js`, the one place
// `fpArm.attach` is called), so the body attaches THERE, once, beside
// the arm it stands in for. Four call sites would be four chances to
// forget one - which is the failure MW-D15 recorded for the camera dep
// before it had one home - and the pins check the population rather
// than the four names, so a fifth host gets the body without an edit.
//
// ═══ WHAT THE PORT DOES THAT THE MOD DOES NOT, AND WHY ═════════════
//
// The mod loads every texture of its 21 tables before the first frame
// (`InitializeTextures`, IL_5a70). A browser cannot block on 3035
// fetches, so `preload` starts them all the moment the body attaches
// and `draw` keeps the LAST painted sprite on screen while a new one
// is still on its way - the sprite lands a few frames late in the
// first second, and never vanishes. The mod's delayed repaint
// (UpdateBillboardDelayed, three frames) is kept exactly.

import { eotbCamera } from './eotbCamera.js';
import { setEotbBodyReady, setEotbDrawBody, setEotbPlayerState } from './mwView.js';
import { modSettingIfDeclared, modSettingsOf, modSettingsGeneration } from '../systems/modSettings.js';
import {
  chooseTable, deathTable, ORIENTATIONS, orientationFor, facingFor, frameTime, speedMod, frameCount, isFootstepFrame,
  stateFor, STATE_TABLES, STRING, meleeAnimTickTime, RANGED_TICK, SPELL_TICK, LYCAN_TICK, DEATH_TICK,
  usesPingPong, pingPongFrames, forwardFrames, holdDrawFrames, pingPongTickFrames, mirrorFlips, mirrorRevertTime,
  DELAYED_FRAMES, ORIENTATION_TIME, signedAngleY, tableMoveSpeed,
} from './eotbBillboard.js';
import { spriteFor, eotbSpriteUrl, spriteCount, spriteSize, spriteOffset, flipRows, worldOrderColors } from './eotbSprite.js';
import { decodePng } from '../systems/textureReplacement.js';   // EOTB-FLIP: the one PNG decoder the world's other PNG billboards take
import { getMeleeWeaponAnimTime } from '../characters/weaponStates.js';   // [IL] GetMeleeAnimTickTime reads FormulaHelper's own
import { setPlayerTorchOffsetOverride, setPlayerWaistLightOverride } from '../systems/playerTorch.js';   // [IL] TorchOffset writes PlayerTorch's position; HT-WAIST: and the lantern at the waist lights from where it hangs
import {
  isRearView, createLanternArt, loadLanternArt, createSpriteLantern, restSpriteLantern, stepSpriteLantern, spriteStride,
  hangSpriteLantern, mintSpriteLantern, dropSpriteLantern,
} from './eotbLantern.js';   // HT-WAIST-BACK: the lantern on every EOTB sprite, one home - this body's and the peers'

/** PlayerHeightChanger's controllerStandingHeight, the capsule the
 *  billboard's parent sits at the centre of - the fallback when a
 *  frame carries no live height (the pins' bare states). */
const STANDING_HEIGHT = 1.8;
/** [IL] The first-person billboard's depth (IL_4cd7): a quarter metre
 *  behind the parent, so looking down shows your own body. */
const FP_DEPTH = -0.25;
/** [IL] The head the first-person camera point sits at (IL_3e13): 0.9
 *  up from the parent, the standing capsule's half height. */
const FP_HEAD = 0.9;
/** [IL] `UpdateMaterial`'s three tints (IL_4f1e, IL_4f5f, IL_4f9f):
 *  invisible white at 0.4, a shade BLACK at 0.6, blending white at 0.8.
 *  The renderer's billboard shader draws them through `uConceal`:
 *  mode 3 is a plain opacity, mode 4 (EOTB-IL) the black. */
export const MATERIAL = Object.freeze({
  invisible: Object.freeze({ mode: 3, alpha: 0.4 }),
  shade: Object.freeze({ mode: 4, alpha: 0.6 }),
  blending: Object.freeze({ mode: 3, alpha: 0.8 }),
});
/** [IL] `PlayFootstep`'s volume factor (IL_58cd-IL_58e1): the third-person
 *  billboard plays its step at TWICE `FootstepVolumeScale`, the
 *  first-person one at once. */
export const FOOTSTEP_VOLUME_SCALE = Object.freeze({ thirdPerson: 2, firstPerson: 1 });

// ═══ HT-WAIST: THE LANTERN AT THE WAIST, ON THE SPRITE ═════════════
//
// NOT THE MOD'S. Eye Of The Beholder draws no light of any kind on its billboard - its TorchOffset (IL_47df, in
// updateOrientation below) only MOVES PlayerTorch's light. Handheld Torches' port-own `Handling.LanternsAtWaist`
// (Ledger A; systems/playerTorch.js lanternAtWaist) hangs a lit lantern at the waist, and Mac asked for it on this
// body too: "Let it be a separate animated item on movement with eye of the Beholder sprites also". So a SECOND
// billboard, apart from the IL's machine and never touching it: Daggerfall's own lantern picture (the Lantern
// template's world texture, TEXTURE.200 record 10 - loaded from the player's ARENA2 at run time, never
// vendored; the mod's hand-and-lantern frames are the author's art of a HAND, not of a lantern on a belt) hung
// by its top from the sprite's right hip, in the sprite's own facing frame, and swung by the one swing law
// (systems/lanternSwing.js) off the sprite's walk: the speed the Move tables step at, the facing's turn, and the
// walk cycle's phase off the frame clock. The swing is drawn as a tilt of the quad in the view plane (the
// billboard shader takes its right and up per call) and a shortening as it swings toward or away from the eye.
// It hangs in third person, on foot, alive and in your own form only: the rider's sprite sits on a horse and the
// beast's is another body. It lights you from where it hangs (`setPlayerWaistLightOverride`), cleared the moment
// it stops hanging.
//
// HT-WAIST-BACK (2026-09-24, Mac: "Just have it show on the back of the sprite, not all angles. Make sure all the
// eye of the Beholder sprites get this change"): the picture is DRAWN only while the sprite is seen from behind -
// the painted orientation 3, 4 or 5 of EOTB's wheel, the three views that draw its back - and never from the front
// or the side. It still hangs there, lit, whatever the view: the swing runs on and the light stays at the hip, so
// turning round neither restarts the swing nor moves the light. Everything the peers' sprites share with this one
// - the rear-view rule, the picture, the hang, the swing's drive, the batch - is player/eotbLantern.js's; this
// body keeps what is its alone: whether it hangs, and the light.

/** The mod's own settings, resolved - read at attach and on `reload`,
 *  as `LoadSettings` hands them to `Initialize`, and again whenever the
 *  store has moved (AUDIT 68 S15-eotb-settings-snapshot). */
function look() {
  let s = {};
  try { s = modSettingsOf('eye-of-the-beholder'); } catch { s = {}; }
  return {
    onFoot: s['Graphics.OnFoot'] ?? 0,
    onHorse: s['Graphics.OnHorse'] ?? 0,
    readyStance: s['Graphics.ReadyStance'] ?? 2,
    graphic: s['Graphics.Enable'] !== false,                   // "Toggle the player graphic" - ToggleBillboard's argument
    turnToView: s['Graphics.TurnToView'] ?? 2,
    attackStrings: s['Graphics.AttackStrings'] ?? 3,
    mirrorTime: s['Graphics.MirrorTime'] ?? 3,
    pingPongOffset: s['Graphics.PingPongOffset'] ?? 1,
    visibility: s['Graphics.FirstPersonBillboard'] ?? 1,       // [IL] `visibility`: 0 none, 1 "Shadows Only", 2 visible
    torchOffset: s['Graphics.TorchOffset'] ?? 1,                // [IL] `torchOffset`: 0 vanilla, 1 billboard, 2 selfie
    syncFootsteps: s['Animation.SyncFootsteps'] !== false,
    dontHideWeapon: s['Compatibility.Don\'tHideWeapon'] === true,
    dontHideHorse: s['Compatibility.Don\'tHideHorse'] === true,
    scale: (s['Animation.BillboardScale'] ?? 1) + (s['Animation.FineBillboardScale'] ?? 0),
    walkAnimSpeedMod: s['Animation.WalkCycleSpeed'] ?? 1,
    enabled: s.Enabled !== false,
  };
}

/**
 * THE FRAME'S STATE, in the shape the machine reads, from the record
 * the rig registers plus whatever a host adds. `motion` is the hosts'
 * one motion bag (`player/motor.js motionBagOf`), which the rig
 * already receives through its camera thunk - so `stopped` is
 * `IsStandingStill || FreezeMotor > 0` (IL_4010-IL_403b), `floating`
 * is `IsLevitating || IsSwimming` (IL_4088-IL_40a6), and the gallop is
 * a speed (`chooseTable`).
 */
export function bodyState(s = {}) {
  const m = s.motion ?? {};
  const riding = s.riding ?? !!m.riding;
  const moving = !!((m.forward || 0) || (m.strafe || 0));
  const standing = m.standing != null ? !!m.standing : !moving;
  const stopped = s.stopped ?? (standing || (m.freeze || 0) > 0);
  return {
    died: !!s.died,
    transformed: !!s.transformed,
    lycanthropyType: s.lycanthropyType ?? 0,
    riding,
    stopped,
    sheathed: s.sheathed ?? !s.weaponReady,
    spellcasting: !!s.spellcasting,
    usingBow: !!s.usingBow,
    attacking: !!s.attacking,
    castPlaying: !!s.castPlaying,
    bowDrawback: !!s.bowDrawback,
    swingHeld: !!s.swingHeld,
    liveSpeed: Number.isFinite(s.liveSpeed) ? s.liveSpeed : 50,
    concealment: s.concealment ?? null,
    forward: m.forward || 0,
    strafe: m.strafe || 0,
    // |PlayerMotor.MoveDirection.xz|: the applied speed, times the
    // diagonal's .7071 (PlayerMotor's limitDiagonalSpeed), zero at rest
    moveSpeed: tableMoveSpeed(m.forward || 0, m.strafe || 0, m.speed),
    grounded: m.grounded !== false,
    running: !!m.running,
    crouching: !!m.crouching,
    sneaking: !!m.sneaking,
    levitating: !!m.levitating,
    swimming: !!m.swimming,
    floating: !!m.levitating || !!m.swimming,
    onExteriorWater: !!m.onExteriorWater,
    height: Number.isFinite(m.height) && m.height > 0 ? m.height : STANDING_HEIGHT,
    hipLantern: !!s.hipLantern,   // HT-WAIST: a lit lantern hangs at the waist (weaponRig's eotbState)
  };
}

/**
 * THE BROWSER DECODE, lifted out so it can be replaced.
 *
 * EOTB-FLIP: the decode is the DROPPED TORCH's door - `decodePng`, then
 * the one row-order converter - and not a canvas of its own. A decode
 * that fails answers a rejection, as the Image's onerror did.
 */
export async function decodeSprite(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return worldOrderColors(await decodePng(new Uint8Array(await res.arrayBuffer())));
}

const norm2 = (v) => { const l = Math.hypot(v[0], v[2]); return l > 0 ? [v[0] / l, 0, v[2] / l] : [0, 0, 0]; };

export function createEotbBody({ count = spriteCount, urlFor = eotbSpriteUrl, decode = decodeSprite, loadLantern = loadLanternArt } = {}) {
  let renderer = null;
  /** the per-frame state thunk of the rig that owns the body (see attach) */
  let attachedState = null;
  let cfg = look();
  let cfgGeneration = modSettingsGeneration();
  function reload() { cfg = look(); cfgGeneration = modSettingsGeneration(); return cfg; }
  /** the frame's state, as bodyState shapes it */
  let last = bodyState();
  /** the frame's camera, handed in by the view seam */
  let cam = { pos: [0, 0, 0], forward: [0, 0, 1], yaw: 0, feet: [0, 0, 0] };

  // ── PlayerBillboard's fields, by their own names ──────────────────
  let activeFlag = false;       // the GameObject's active state (ToggleBillboard)
  let FP = false;               // the first-person billboard (ToggleOffset sets it)
  let frameCurrent = 0;
  let frameTimer = 0;
  let stateCurrent = 'Idle';
  let stateLast = null;
  let lastOrientation = 0;
  let lastMoveDirection = null;
  let currentAngle = 0;
  let orientationTimer = 0;
  let isAnimating = null;       // the coroutine in flight
  let animating = false;
  let died = false;
  let mirrorCount = 0;
  let mirrorTimer = 0;
  let pingpongCount = 0;
  let footstepAlt = false;
  let hasPlayedFootstep = false;
  let wasGrounded = false;
  let vanillaDisabled = false;  // DisableVanillaFootsteps ran
  /** what UpdateBillboard last painted: { table, orientation, frame, flip } */
  let shown = null;
  /** UpdateBillboardDelayed's coroutines: each fires after DELAYED_FRAMES */
  const pending = [];
  /** the frame's footfall, for the hosts' stride machine */
  let fell = false;
  let fellVolume = 1;

  // ── the art ───────────────────────────────────────────────────────
  const tex = new Map();        // archive:rec -> { w, h } uploaded | Promise | null failed
  const decoded = new Map();    // key -> the decoded pixels, so a mirrored twin needs no second fetch
  let batch = null;
  let batchRec = null;
  let batchSize = null;
  /** The one sprite that decides whether this lane may open at all. See `ready()`. */
  let firstUp = false;

  // ── HT-WAIST: the lantern at the waist (see the head above) ───────
  const lantern = createSpriteLantern();   // HT-WAIST-BACK: its swing, its batch, its placement - player/eotbLantern.js
  const lanternArt = createLanternArt(() => renderer, loadLantern);
  let waistWritten = false;
  // the frame's scratch - drawLantern and stepLantern run every Eye Of The Beholder frame and allocate nothing
  const lanternFacing = { fx: 0, fz: 1 };
  const lanternWaist = { left: 0, up: 0, forward: 0 };
  /** Does the lantern hang this frame: lit at the waist, third person, on foot, alive, in your own form. */
  const lanternHangs = () => last.hipLantern && activeFlag && !FP && !died && !last.died && !last.riding && !last.transformed;
  /** HT-WAIST-BACK: is it DRAWN this frame - it hangs, and the sprite is painted from behind (eotbLantern.js
   *  isRearView: orientation 3, 4 or 5). */
  const lanternShown = () => lanternHangs() && isRearView(shown?.orientation);
  /** The frame the sprite faces: its walk's facing (UpdateOrientation's `lastMoveDirection`), else the yaw. */
  function facingBasis() {
    const f = lastMoveDirection && (lastMoveDirection[0] || lastMoveDirection[2]) ? lastMoveDirection : cam.forward;
    const l = Math.hypot(f[0], f[2]) || 1;
    lanternFacing.fx = f[0] / l; lanternFacing.fz = f[2] / l;
    return lanternFacing;
  }
  /** One frame of the swing, off the sprite's own walk: the speed the Move tables step at along the facing, the
   *  facing's turn, and the walk cycle's phase off the frame clock while a Move table plays. HT-WAIST-BACK: it swings
   *  while it HANGS, seen or not - turning round shows a lantern already swinging, never one snapped plumb. */
  function stepLantern(dt) {
    if (!lanternHangs()) { restSpriteLantern(lantern); dropLantern(); return; }   // at rest, in place
    const f = facingBasis();
    const tick = frameTime(last.riding, cfg.walkAnimSpeedMod) * speedMod(last);
    const stride = spriteStride(!last.stopped, last.moveSpeed, frameCurrent, frameTimer, tick, frameCount(stateCurrent));
    stepSpriteLantern(lantern, dt, f.fx, f.fz, last.moveSpeed || 0, stride);
  }
  function waistDefault() {
    if (waistWritten) { setPlayerWaistLightOverride(null); waistWritten = false; }
  }
  /** The lantern's batch goes when the lantern does (EVERY ALLOCATION HAS AN OWNER); its picture stays in the
   *  renderer's cache under its own key, as every sprite of this body does. */
  function dropLantern() {
    dropSpriteLantern(lantern, renderer);
    waistDefault();
  }
  /** Hang the lantern from the sprite's hip, tilted by the swing, light you from it, and draw it if the sprite is
   *  seen from behind. Answers whether it drew. */
  function drawLantern() {
    if (!lanternHangs()) { dropLantern(); return false; }
    const art = lanternArt.ensure();
    if (!art || !batchSize) return false;
    const base = place();
    if (!base) return false;
    const f = facingBasis();
    hangSpriteLantern(lantern, base, batchSize.h, f.fx, f.fz, cam.pos, cam.feet, cam.yaw, cfg.scale > 0 ? cfg.scale : 1, art);
    // the light, from the lantern's middle, in the offset words PlayerTorch's seam speaks (the yaw frame) - where it
    // hangs, whether or not this view draws it (HT-WAIST-BACK: the lantern is still there, lit, seen from the front)
    const mid = lantern.mid;
    const yaw = cam.yaw, sy = Math.sin(yaw), cy = Math.cos(yaw);
    const px = mid[0] - cam.feet[0], pz = mid[2] - cam.feet[2];
    const wo = lanternWaist;
    wo.left = -(px * cy - pz * sy); wo.up = mid[1] - cam.feet[1]; wo.forward = px * sy + pz * cy;
    setPlayerWaistLightOverride(wo);
    waistWritten = true;
    // HT-WAIST-BACK: the picture from behind only - the painted view, so the lantern and the sprite under it agree
    if (!isRearView(shown?.orientation)) return false;
    mintSpriteLantern(lantern, renderer).conceal = material();
    renderer.drawBillboards(lantern.list, lantern.right, lantern.up);
    return true;
  }

  const cacheKey = (s) => `${s.archive}:${s.rec}`;
  async function pixels(key) {
    let p = decoded.get(key);
    if (!p) {
      const url = urlFor(key);
      if (!url) return null;
      p = decode(url);
      decoded.set(key, p);
      p.then((img) => decoded.set(key, img), () => decoded.delete(key));
    }
    return p;
  }
  /** Decode one sprite and upload it, flipping when the state asks. */
  function ensure(s) {
    if (!renderer || !s) return null;
    const have = tex.get(cacheKey(s));
    if (have && !(have instanceof Promise)) return have;
    if (have !== undefined) return null;                // in flight, or failed
    if (!urlFor(s.key)) { tex.set(cacheKey(s), null); return null; }
    const p = (async () => {
      const img = await pixels(s.key);
      if (!img) throw new Error(`${s.key}: no art`);
      const { width, height, colors } = img;
      // the MIRROR is applied here, on the way to the upload, because
      // the renderer's billboard batch has no flip - a mirrored sprite
      // is its own pixels under its own key (`s.rec`, EOTB5)
      const px = s.mirror ? flipRows(colors, width, height) : colors;
      renderer.uploadTexture(s.archive, s.rec, { width, height, colors: px });
      return { w: width, h: height };
    })();
    tex.set(cacheKey(s), p);
    p.then((r) => { tex.set(cacheKey(s), r); firstUp = true; },
      () => { tex.set(cacheKey(s), null); });
    return null;
  }
  /** PR-WW1 (2026-09-24, player report: "Werewolf morrowind sprite not
   *  showing online"): THE FORM IS NOT A SETTING. The lycan archive is
   *  picked by the curse (lycanArchive: 112381 for the wereboar), and
   *  `cfg` is the mod's settings, which never carry it - so every
   *  spriteFor here asked for the werewolf, and a wereboar saw the wolf
   *  on themselves while the others (net/peerRiders.js, off the pose's
   *  `wb`) draw the boar. The look is the settings plus the live form. */
  const lookNow = () => ({ ...cfg, lycanthropyType: last.lycanthropyType });
  /** PR-WW1: the form the lycan tables were last fetched for */
  let preloadedForm = null;
  /** [IL] `InitializeTextures`: every frame of every table of the
   *  archives the settings pick, fetched up front - the mod's whole
   *  load, spread over the seconds a browser needs. PR-WW1: the lycan
   *  pair by the LIVE form (the mod builds it off the curse), and again,
   *  lycan tables alone, when the form changes (`onlyLycan`). */
  function preload(onlyLycan = false) {
    const lk = lookNow();
    preloadedForm = lk.lycanthropyType;
    for (const table of Object.keys(STATE_TABLES)) {
      if (onlyLycan && !table.endsWith('Lycan')) continue;
      for (let f = 0; f < frameCount(table); f++) {
        for (let o = 0; o < ORIENTATIONS; o++) ensure(spriteFor(table, o, f, lk));
      }
    }
  }

  // ── UpdateBillboard and its delayed twin ──────────────────────────
  /** [IL] `UpdateBillboard(frame, orientation, states)` (IL_4900-IL_4ce6):
   *  the wheel's mirror, the Mirror string's flip on 0 and 4, the
   *  first-person rider's flip, the frame clamped to the record, the
   *  texture and the UVs set, `frameCurrent` and `lastOrientation`
   *  written. The size and the placement are read at draw time from
   *  the same law (`place`). */
  function updateBillboard(frame, orientation, table) {
    const n = frameCount(table);
    if (frame > n - 1) frame = n - 1;
    if (frame < 0) frame = 0;
    let mirror = stateFor(table, orientation)?.mirror ?? false;
    if (mirrorFlips(cfg.attackStrings, table, orientation, mirrorCount)) mirror = !mirror;
    if (FP && (cfg.visibility === 1 || cfg.visibility === 2) && last.riding) mirror = !mirror;
    shown = { table, orientation, frame, mirror, flip: mirror !== (stateFor(table, orientation)?.mirror ?? false) };
    frameCurrent = frame;
    lastOrientation = orientation;
  }
  /** [IL] `UpdateBillboardDelayed`: three `yield return null`s, then the
   *  repaint - a coroutine each, so several can be in flight and the
   *  last to fire wins. */
  function updateBillboardDelayed(frame, orientation, table) {
    pending.push({ frame, orientation, table, left: DELAYED_FRAMES });
  }
  function runDelayed() {
    for (let i = 0; i < pending.length;) {
      const p = pending[i];
      if (--p.left > 0) { i++; continue; }
      pending.splice(i, 1);
      updateBillboard(p.frame, p.orientation, p.table);
    }
  }

  // ── the one-shots ─────────────────────────────────────────────────
  /** [IL] The three coroutines, one record: `PlayAnimationCoroutine`
   *  (frames forward, `freeze` skips the closing UpdateOrientation),
   *  `PlayAnimationPingPongCoroutine` (the order pre-computed), and
   *  `PlayAnimationHoldCoroutine` (draw down to 0, hold while the swing
   *  is held, release forward). StartCoroutine runs the body to its
   *  first yield at once, so the first frame paints in the same
   *  LateUpdate. */
  function startClip(table, frames, interval, { freeze = false, kind = 'forward' } = {}) {
    isAnimating = { table, frames, interval, freeze, kind, i: 0, timer: 0, phase: kind === 'hold' ? 'draw' : 'run' };
    if (kind === 'hold') {
      // IL_5fa5-IL_5fcb: animFrameCurrent = n - 1, then the loop
      // decrements before it paints - `frames` is that draw order
      if (frames.length) updateBillboard(frames[0], lastOrientation, table);
      else holdPhase();
    } else if (frames.length) updateBillboard(frames[0], lastOrientation, table);
    else endClip();
    return isAnimating;
  }
  /** The hold phase's per-frame check (IL_6019-IL_60b9): the swing held
   *  paints frame 0 and waits a frame; let go triggers the release. */
  function holdPhase() {
    const c = isAnimating;
    c.phase = 'hold';
    if (last.swingHeld) { updateBillboard(0, lastOrientation, c.table); return; }
    c.phase = 'release'; c.i = 0; c.frames = forwardFrames(frameCount(c.table)); c.timer = 0;
    updateBillboard(0, lastOrientation, c.table);
  }
  function endClip() {
    const c = isAnimating;
    // IL_5d77-IL_5dd9 (PlayAnimationCoroutine): under Mirror or Mixed a
    // melee clip bumps the mirror count and resets its clock, ANY other
    // clip - the loose, the cast, the death - zeroes the count; under
    // Mixed every clip bumps the ping-pong count. The ping-pong
    // coroutine (IL_5f23-IL_5f35) bumps that count alone; the hold
    // coroutine (IL_614d-IL_615c) keeps no counts at all.
    if (c.kind === 'forward') {
      if (cfg.attackStrings === STRING.Mirror || cfg.attackStrings === STRING.Mixed) {
        if (c.table === 'AttackMelee' || c.table === 'AttackMeleeLycan') { mirrorTimer = 0; mirrorCount++; } else mirrorCount = 0;
      }
      if (cfg.attackStrings === STRING.Mixed) pingpongCount++;
    } else if (c.kind === 'pingpong' && cfg.attackStrings === STRING.Mixed) pingpongCount++;
    isAnimating = null;
    if (!c.freeze) updateOrientation(true);
  }
  function advanceClip(dt) {
    const c = isAnimating;
    if (!c) return;
    if (c.phase === 'hold') { holdPhase(); return; }   // WaitForEndOfFrame: re-asked every frame
    c.timer += dt;
    if (c.timer < c.interval) return;
    c.timer = 0;
    c.i++;
    if (c.i < c.frames.length) { updateBillboard(c.frames[c.i], lastOrientation, c.table); return; }
    if (c.kind === 'hold' && c.phase === 'draw') { holdPhase(); return; }
    endClip();
  }
  /** [IL] `PlayMeleeAttackAnimation` (IL_5050-IL_514e): never in the
   *  saddle, never over a clip; PingPong by `usesPingPong`; the tick is
   *  the weapon's own. */
  function playMeleeAttack() {
    if (last.riding || isAnimating) return null;
    const n = frameCount('AttackMelee');
    const animTime = getMeleeWeaponAnimTime(last.liveSpeed);
    if (usesPingPong(cfg.attackStrings, pingpongCount)) {
      return startClip('AttackMelee', pingPongFrames(n, cfg.pingPongOffset), meleeAnimTickTime(animTime, pingPongTickFrames(n, cfg.pingPongOffset)), { kind: 'pingpong' });
    }
    return startClip('AttackMelee', forwardFrames(n), meleeAnimTickTime(animTime, n));
  }
  function playRangedAttack() {
    if (last.riding || isAnimating) return null;
    return startClip('AttackRanged', forwardFrames(frameCount('AttackRanged')), RANGED_TICK);
  }
  function playRangedAttackHold() {
    if (last.riding || isAnimating) return null;
    return startClip('AttackRanged', holdDrawFrames(frameCount('AttackRanged')), RANGED_TICK, { kind: 'hold' });
  }
  function playSpellAttack() {
    if (last.riding || isAnimating) return null;
    return startClip('AttackSpell', forwardFrames(frameCount('AttackSpell')), SPELL_TICK);
  }
  function playLycanAttack() {
    if (last.riding || isAnimating) return null;
    return startClip('AttackMeleeLycan', forwardFrames(frameCount('AttackMeleeLycan')), LYCAN_TICK);
  }
  /** [IL] `PlayDeathAnimation` (IL_5360-IL_53e7): never in the saddle;
   *  a clip in flight is stopped; the form's death table at half a
   *  second a frame, FROZEN - no UpdateOrientation when it ends. */
  function playDeath() {
    if (last.riding) return null;
    isAnimating = null;
    const table = deathTable(last);
    return startClip(table, forwardFrames(frameCount(table)), DEATH_TICK, { freeze: true });
  }

  // ── UpdateOrientation ─────────────────────────────────────────────
  /** [IL] IL_4520-IL_48bd. The tenth-of-a-second gate first (it gates the
   *  forced calls too); the player-to-camera vector; the facing; the
   *  snap; a repaint on a change or a force; the torch. */
  function updateOrientation(force) {
    if (ORIENTATION_TIME > 0) {
      if (orientationTimer > ORIENTATION_TIME) orientationTimer = 0;
      else return;
    }
    const toCamera = norm2([cam.pos[0] - cam.feet[0], 0, cam.pos[2] - cam.feet[2]]);
    // PlayerMotor.MoveDirection, flattened: the move axes are the
    // body's own (forward, strafe), rotated into the world by the yaw
    const yaw = cam.yaw;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const moveDir = (last.forward || last.strafe)
      ? [last.strafe * cy + last.forward * sy, 0, -last.strafe * sy + last.forward * cy]
      : [0, 0, 0];
    const facing = facingFor({
      turnToView: cfg.turnToView, floating: last.floating, animating: !!isAnimating,
      sheathed: last.sheathed, spellcasting: last.spellcasting, stopped: last.stopped,
    }, moveDir, lastMoveDirection, cam.forward);
    lastMoveDirection = facing;
    currentAngle = signedAngleY(toCamera, facing);
    const o = orientationFor(facing, toCamera);
    if (o !== lastOrientation || force || !shown) updateBillboardDelayed(frameCurrent, o, stateCurrent);
    // [IL] TorchOffset (IL_47df-IL_48bd), third person only: Selfie (2)
    // parks PlayerTorch half way from the head to the camera; Billboard
    // (1) puts it 0.45 up the sprite and half a metre along the facing.
    if (!FP && cfg.torchOffset === 2) {
      const head = [cam.feet[0], cam.feet[1] + FP_HEAD, cam.feet[2]];
      torchAt([head[0] + (cam.pos[0] - head[0]) * 0.5, head[1] + (cam.pos[1] - head[1]) * 0.5, head[2] + (cam.pos[2] - head[2]) * 0.5]);
    } else if (!FP && cfg.torchOffset === 1) {
      const c = place();
      const d = norm2(lastMoveDirection);
      torchAt(c ? [c[0] + d[0] * 0.5, c[1] + 0.45, c[2] + d[2] * 0.5] : null);
    }
  }
  /** The torch light's world point, handed to `systems/playerTorch.js`
   *  in the offset words its seam speaks (left, up, forward off the
   *  feet in the yaw frame). */
  let torchWritten = false;
  function torchAt(p) {
    if (!p) return;
    const yaw = cam.yaw, sy = Math.sin(yaw), cy = Math.cos(yaw);
    const dx = p[0] - cam.feet[0], dz = p[2] - cam.feet[2];
    setPlayerTorchOffsetOverride({ left: -(dx * cy - dz * sy), up: p[1] - cam.feet[1], forward: dx * sy + dz * cy });
    torchWritten = true;
  }
  function torchDefault() {
    if (torchWritten) { setPlayerTorchOffsetOverride(null); torchWritten = false; }
  }

  // ── the material ──────────────────────────────────────────────────
  /** [IL] `UpdateMaterial` (IL_4e7c-IL_5043), in its own order: invisible,
   *  then shade, then blending; else the normal material. Answers the
   *  batch's `conceal` record, or null. */
  function material() {
    const f = last.concealment;
    if (!f) return null;
    if (f.invisible) return MATERIAL.invisible;
    if (f.shade) return MATERIAL.shade;
    if (f.blending) return MATERIAL.blending;
    return null;
  }

  // ── the walk loop ─────────────────────────────────────────────────
  /** [IL] `PlayFootstep` (IL_55e8-IL_5943): the gates that answer nothing,
   *  the swimmer that answers silence, and the step at the billboard's
   *  volume. The CLIP is DFU's own choice (the hosts' stride machine
   *  makes it, `systems/footsteps.js` - the same table the mod copies
   *  out of PlayerFootsteps); this is the WHEN and the HOW LOUD. */
  function playFootstep() {
    if (last.levitating) return;
    if (last.riding && !last.onExteriorWater) return;   // IsOnFoot, or exterior water
    if (last.swimming) { hasPlayedFootstep = true; return; }
    fell = true;
    fellVolume = FP ? FOOTSTEP_VOLUME_SCALE.firstPerson : FOOTSTEP_VOLUME_SCALE.thirdPerson;
    footstepAlt = !footstepAlt;
    hasPlayedFootstep = true;
  }
  /** [IL] `LoopIdleBillboard` (IL_3ff0-IL_4510): the flags, the clock,
   *  the table, the repaint on a change. */
  function loopIdleBillboard(dt) {
    const n = frameCount(stateCurrent);
    if (n > 1) {
      const mod = speedMod(last);
      if (cfg.syncFootsteps && !last.stopped && last.grounded && !animating) {
        if (isFootstepFrame(frameCurrent, last.riding)) { if (!hasPlayedFootstep) playFootstep(); } else hasPlayedFootstep = false;
      }
      if (frameTimer > frameTime(last.riding, cfg.walkAnimSpeedMod) * mod) {
        if (frameCurrent < n - 1) frameCurrent++; else frameCurrent = 0;
        if (frameCurrent > n - 1) frameCurrent = 0;
        updateBillboardDelayed(frameCurrent, lastOrientation, stateCurrent);
        frameTimer = 0;
      } else frameTimer += dt;
    }
    stateCurrent = chooseTable({ ...last, readyStance: cfg.readyStance });
    if (stateLast !== stateCurrent || (animating && !isAnimating)) updateBillboardDelayed(frameCurrent, lastOrientation, stateCurrent);
    if (isAnimating && !animating) animating = true;
    else if (!isAnimating && animating) animating = false;
    stateLast = stateCurrent;
  }

  // ── the three phases ──────────────────────────────────────────────
  /** [IL] `Update` (IL_3c9c-IL_3d57): the orientation clock and the
   *  mirror revert. */
  function update(dt) {
    if (ORIENTATION_TIME > 0 && orientationTimer <= ORIENTATION_TIME) orientationTimer += dt;
    if (cfg.attackStrings === STRING.Mirror || cfg.attackStrings === STRING.Mixed) {
      const t = mirrorRevertTime(cfg.mirrorTime, FP);
      if (mirrorCount > 0 && !isAnimating && t > 0) {
        if (mirrorTimer > t) {
          mirrorCount = 0; mirrorTimer = 0;
          updateBillboardDelayed(frameCurrent, lastOrientation, stateCurrent);
          return;
        }
        mirrorTimer += dt;
      }
    }
  }
  /** [IL] `LateUpdate` (IL_3d64-IL_3fa4). */
  function lateUpdate(dt) {
    // DEATH-BODY1 (2026-09-22). Muriel on Discord: "if you die in the
    // tutorial dungeon and press F11 to load, you load the game but are
    // visually a corpse. You can act normally, but are a corpse."
    // kurkku saw the same; trashBattery found the workaround and named
    // the cause in one line - "zooming into first person and then back
    // out into 3rd person fixes it. looks like loading the game after a
    // death doesn't update the character model state."
    //
    // He is exactly right. `died` is a LATCH: it is raised from the
    // live `last.died` signal and then blocks every update below,
    // holding the frozen death clip. The ONLY thing that lowers it is
    // `initialize`, and the only caller of that is `toggle` going
    // active - which is what scrolling out of first person and back in
    // does, and why that clears it.
    //
    // THE MOD NEVER NEEDED MORE, and that is the whole divergence. In
    // Daggerfall Unity a death ends the run: you load a save, the
    // scene is rebuilt, and PlayerBillboard comes back as a fresh
    // object with a fresh field. This port has revivals the mod has no
    // concept of - a quickload straight back into play, the online
    // respawn, a prison release - and the body is a MODULE-LEVEL
    // instance that survives all of them. So the latch outlived the
    // death that set it.
    //
    // The fix is at the signal, not at any one caller: the body follows
    // the entity. Coming back to life lowers the latch wherever the
    // life came from, so a load, a respawn and anything added later are
    // all covered by the same line, rather than each having to remember
    // to reach in here.
    if (died) {
      if (last.died) return;
      initialize();   // alive again: the clip stops, the table returns to Idle, one forced orientation
    }
    if (last.died) { died = true; playDeath(); return; }
    updateOrientation(false);
    if (!isAnimating) {
      if (last.attacking) {
        if (last.transformed) playLycanAttack();
        else if (!last.usingBow) playMeleeAttack();
        else if (last.bowDrawback) playRangedAttackHold();
        else playRangedAttack();
      }
      if (last.castPlaying) playSpellAttack();
    }
    loopIdleBillboard(dt);
    if (cfg.syncFootsteps) {
      const grounded = last.grounded;
      if (grounded && !wasGrounded) playFootstep();
      wasGrounded = grounded;
    }
  }

  /** [IL] `Initialize` (IL_3b10-IL_3c8c), ToggleBillboard's call: the
   *  settings taken, `died` cleared, a clip in flight stopped, the
   *  Mirror and PingPong counts zeroed, the table the last one or Idle,
   *  the vanilla stride disabled or restored, one forced orientation. */
  function initialize() {
    cfg = look();
    died = false;
    isAnimating = null;
    mirrorCount = 0; mirrorTimer = 0; pingpongCount = 0;
    stateCurrent = stateLast ?? 'Idle';
    vanillaDisabled = cfg.syncFootsteps;
    updateOrientation(true);
  }

  /** [IL] The sprite's world placement for the frame, `UpdateBillboard`'s
   *  placement (IL_4a1a-IL_4b2c, IL_4ba7-IL_4bd1, IL_4ca0-IL_4ce1) off the
   *  parent's origin - the capsule's centre, half the live height above
   *  the feet - in the yaw frame: the XML X along the right (negated
   *  for a mirrored state), the depth along the forward for the
   *  first-person billboard, and the height by arm:
   *    on exterior water   Y - size/2            (the top at the swim line)
   *    crouching           Y + size/2 - height   (sunk by the crouch)
   *    else                Y + size/2 - height/2 (the feet on the ground)
   *  ...which is the quad's CENTRE; the renderer takes its BASE, so
   *  the answer is that centre less half the size (EOTB-FEET below). */
  function place() {
    if (!shown || !batchSize) return null;
    const sp = spriteFor(shown.table, shown.orientation, shown.frame, lookNow());   // PR-WW1: the live form's archive
    const xml = spriteOffset(sp.archive, sp.record);
    const size = batchSize;
    const h = last.height;
    const yaw = cam.yaw, sy = Math.sin(yaw), cy = Math.cos(yaw);
    const right = [cy, 0, -sy], fwd = [sy, 0, cy];
    const x = xml.x / xml.scale * (shown.mirror ? -1 : 1);
    const yOff = xml.y / xml.scale;
    let y;
    if (last.onExteriorWater) y = yOff - size.h * 0.5;
    else if (last.crouching) y = yOff + size.h * 0.5 - h;
    else y = yOff + size.h * 0.5 - h * 0.5;
    const z = FP && cfg.visibility > 0 ? FP_DEPTH : 0;
    const origin = [cam.feet[0], cam.feet[1] + h * 0.5, cam.feet[2]];
    // EOTB-FEET (2026-09-16, Mac: "the sprite not connected to the
    // floor. Like you walk hovering"): the three arms above are the
    // mod's, and they place the quad's CENTRE - Unity's billboard mesh
    // is centred on its transform. This renderer's billboard is
    // BOTTOM-ANCHORED (BB_VS: "centre sits half a height above the
    // placement base"), and every other caller hands it the base - the
    // world's flats, the peers' dolls at their feet (net/remotePlayers
    // .js). Handing it the centre stood the body half its own height
    // in the air, on every arm alike. The law stays the mod's; the
    // number handed over is the base the renderer asks for.
    const base = y - size.h * 0.5;
    return [origin[0] + right[0] * x + fwd[0] * z, origin[1] + base, origin[2] + right[2] * x + fwd[2] * z];
  }

  return {
    /**
     * Called by `combat/weaponRig.js` beside `fpArm.attach`.
     *
     * `playerState` is the per-frame answer only the rig can give -
     * the weapon's facts and the motion bag - and it is handed HERE
     * rather than registered by the rig itself. That is the direction
     * the rest of this module already runs: the body owns its three
     * `mwView` seams and the rig owns the arm. MWFIX's pin
     * (`test/mwattach.test.js`) states the same law from the other side
     * - `weaponRig.js` must not mention the view layer, because the
     * classic sprite path is the only path it knows.
     */
    attach(r, playerState) {
      // Re-claimed every frame by the rig that is stepping it (the
      // arm's own AUDIT 39 law, `bindArm`): the same renderer and the
      // same thunk is the same rig, and nothing is redone; a different
      // pair is another host's rig taking the body over.
      if (r && r === renderer && playerState === attachedState) return this;
      attachedState = playerState ?? null;
      renderer = r || null;
      reload();
      if (renderer) {
        preload();
        setEotbBodyReady(() => this.ready());
        setEotbDrawBody((canvas, f) => this.draw(canvas, f));
        setEotbPlayerState(playerState);
      }
      eotbCamera.setBillboard(this);
      return this;
    },

    /**
     * [IL] `ToggleBillboard(bool)` (IL_23ac-IL_241e) as the camera's
     * ToggleOffset calls it: the object's active state, and Initialize
     * when it goes active. `fp` is the `FP` field ToggleOffset writes
     * beside it (IL_22f4, IL_233e).
     */
    toggle(active, fp = false) {
      FP = !!fp;
      activeFlag = !!active;
      if (!activeFlag) { torchDefault(); pending.length = 0; dropLantern(); }   // HT-WAIST: the lantern and its light leave with the body
      if (activeFlag) initialize();
      return activeFlag;
    },
    /** The mod's own `torch.localPosition = torchPosLocalDefault` on
     *  leaving third person (IL_2307-IL_2313). */
    torchDefault,
    /** HT-WAIST: another body has the frame (mwView's Morrowind lane) - the sprite's lantern, its batch and the
     *  light point it wrote, stand down, so the Morrowind body's hip is lit from its own hook. */
    standDown() { dropLantern(); },

    /**
     * EOTB4's gate. The lane may open when the mod is on, the build
     * really carries the art, and the FIRST sprite has decoded.
     *
     * That last clause is the one that matters: a lane that opened on
     * "the art exists" would swing the camera out behind nothing for
     * as long as the first fetch took. And `ready` must not FLAP -
     * once a sprite is up it stays up, so the lane cannot drop the
     * player back into first person mid-scroll because a later sprite
     * is still decoding.
     */
    ready() {
      if (cfgGeneration !== modSettingsGeneration()) reload();   // AUDIT 68 S15-eotb-settings-snapshot: every lane frame asks here first
      if (!renderer || !cfg.enabled) return false;
      if (modSettingIfDeclared('eye-of-the-beholder', 'Enabled') === false) return false;
      return count() > 0 && firstUp;
    },

    /**
     * One frame: Update, the coroutines, LateUpdate - Unity's order.
     * `state` is the rig's record plus the host's fields; the view
     * seam adds the frame's camera (`cameraPos`, `cameraForward`,
     * `feet`, `yaw`).
     */
    tick(dt, state = {}) {
      last = bodyState(state);
      if (renderer && last.lycanthropyType !== preloadedForm) preload(true);   // PR-WW1: a curse caught (or changed) fetches its own beast
      fell = false;
      if (state.feet) cam.feet = state.feet;
      if (state.cameraPos) cam.pos = state.cameraPos;
      if (Number.isFinite(state.yaw)) { cam.yaw = state.yaw; cam.forward = [Math.sin(state.yaw), 0, Math.cos(state.yaw)]; }
      if (state.cameraForward) cam.forward = state.cameraForward;
      // the first-person billboard stands ON the camera point (IL_3e48-IL_3e6d):
      // the parent's head, so the orientation reads 0 through the zero vector
      if (FP) cam.pos = [cam.feet[0], cam.feet[1] + FP_HEAD, cam.feet[2]];
      if (!activeFlag) return { table: stateCurrent, frame: frameCurrent, clip: null };
      update(dt);
      runDelayed();
      advanceClip(dt);
      lateUpdate(dt);
      stepLantern(dt);   // HT-WAIST: not the IL's - the lantern at the waist, after the frame the mod ran
      return { table: stateCurrent, frame: frameCurrent, clip: isAnimating ? { table: isAnimating.table, i: isAnimating.i, phase: isAnimating.phase } : null };
    },

    draw(canvas, { eye, feet, yaw } = {}) {
      if (!renderer || !activeFlag || !shown) return false;
      if (!cfg.graphic) { dropLantern(); return false; }   // HT-WAIST: no body drawn, no lantern on it
      if (feet) cam.feet = feet;
      if (Number.isFinite(yaw)) cam.yaw = yaw;
      if (eye && !FP) cam.pos = eye;
      // [IL] IL_3dd4-IL_3ddf: the visible first-person billboard faces
      // AWAY from the camera - a quad seen from its back, the picture
      // mirrored
      const flipView = FP && cfg.visibility === 2;
      const s = spriteFor(shown.table, shown.orientation, shown.frame, lookNow(), { flip: shown.flip !== flipView });   // PR-WW1: the live form's archive (112381 the wereboar)
      const up = ensure(s);
      if (up) {
        const xml = spriteOffset(s.archive, s.record);
        const size = spriteSize(up.w, up.h, { riding: last.riding, transformed: last.transformed, scale: cfg.scale }, xml.scale);
        if (!batch || batchRec !== cacheKey(s)) {
          if (batch) renderer.destroyBillboardBatch?.(batch);
          batch = renderer.createBillboardBatch(s.archive, s.rec, size, [[0, 0, 0]]);
          batch.origin = [0, 0, 0];
          batchRec = cacheKey(s);
        }
        batchSize = size;
      }
      if (!batch) return false;                 // nothing up yet: the last sprite stays until one is
      const c = place();
      if (!c) return false;
      batch.origin[0] = c[0]; batch.origin[1] = c[1]; batch.origin[2] = c[2];
      batch.conceal = material();
      const camRight = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
      renderer.drawBillboards([batch], camRight, [0, 1, 0]);
      drawLantern();   // HT-WAIST: the lantern at the waist, its own billboard, after the body
      return true;
    },

    /** [IL] `PlayFootstep` / `DisableVanillaFootsteps`, as the hosts'
     *  stride machine hears them: `owns` once Initialize has silenced
     *  the vanilla stride, `fell` on the tick a step played, and the
     *  billboard's volume factor. Read through `mwView.mwViewFootstep`. */
    footstep() {
      return { owns: vanillaDisabled, fell, volumeScale: fellVolume };
    },

    /** [IL] The camera's hides while `offset` holds: `ShowWeapon = false`
     *  every LateUpdate unless Don'tHideWeapon (IL_1c98-IL_1cb0), `DrawHorse
     *  = !offset` unless Don'tHideHorse (IL_2365-IL_237a), and
     *  `spellCasting.enabled = !offset` with no key (IL_22f9, IL_2358). */
    hides() {
      const tp = eotbCamera.thirdPerson() && this.ready();   // AUDIT 68 S15-eotb-spritecount-hot: the cheap test first
      return { weapon: tp && !cfg.dontHideWeapon, horse: tp && !cfg.dontHideHorse, spellHands: tp };
    },

    /** Test seams - the pins drive the body rather than the bundle. */
    state: () => ({
      active: activeFlag, FP, table: stateCurrent, orientation: lastOrientation, frame: frameCurrent, ready: firstUp, cached: tex.size,
      shown: shown ? { ...shown } : null, pending: pending.map((p) => ({ ...p })),
      clip: isAnimating ? { table: isAnimating.table, frames: [...isAnimating.frames], i: isAnimating.i, kind: isAnimating.kind, phase: isAnimating.phase, interval: isAnimating.interval, freeze: isAnimating.freeze } : null,
      mirrorCount, mirrorTimer, pingpongCount, died, animating, currentAngle, orientationTimer,
      lastMoveDirection: lastMoveDirection ? [...lastMoveDirection] : null, last: { ...last }, hasPlayedFootstep, footstepAlt, wasGrounded,
      material: material(), placed: place(),
      lantern: { hangs: lanternHangs(), shown: lanternShown(), swing: { fore: lantern.swing.fore, side: lantern.swing.side }, batch: !!lantern.batch },   // HT-WAIST; HT-WAIST-BACK: hangs, and drawn
    }),
    settings: () => cfg,
    reload,
    orientations: ORIENTATIONS,
  };
}

/** One player, one body - the module-level instance fpArm, mwCamera
 *  and eotbCamera all keep. */
export const eotbBody = createEotbBody();
