// EOTB5: THE LIVE BODY - what actually appears behind the camera.
//
// EOTB3 answers which sprite; eotbSprite.js answers where its pixels
// are and how big it stands; this file holds the one instance, keeps
// its clock, and hands `mwView` the two doors EOTB4 left open.
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
// ═══ AUDIT-EOTB2 (2026-09-16): THE BODY WAS A STATUE ═══════════════
//
// Mac: "Do an audit on eye of the beholder. Ensure its integrated 1:1."
// A player report the same day: "scrolling the mouse wheel down during
// regular gameplay makes some wacky stuff happen."
//
// What the wheel showed was a sprite that never moved. The rig's
// registered state was `{ weaponReady, sailing }` and the hosts handed
// the seam `riding` alone, while `chooseTable` reads `stopped`,
// `sheathed`, `spellcasting`, `usingBow`, `died`, `transformed` and
// `galloping` - none of which anything wrote. So `stopped` defaulted
// to true and the body stood in the Idle table for ever: it glided
// along the ground without a step, held no weapon it had drawn, never
// fell when the player died, and was sized as a man in the saddle.
// Over it the first-person weapon kept drawing, because the widget's
// third-person gate asked the MORROWIND arm and nobody else.
//
// The state now has ONE HOME: `combat/weaponRig.js` registers it whole
// - the weapon's own facts and the motion bag the hosts already hand
// the rig through their camera thunk - and this file derives the table,
// the facing, the clips and the size from that one record. No host
// grew a line for it.
//
// What runs here beyond the loop, each marked with its evidence
// (`eotbBillboard.js`'s banner explains the three marks): the five
// Play*Animation one-shots and their three coroutines [SETTINGS]; the
// death clip, played once and held [IL: the table exists;
// SETTINGS: PlayDeathAnimation is its only reader]; TurnToView
// [SETTINGS]; SyncFootsteps, the footfall the clock always reported and
// nobody played [SETTINGS]; and ToggleBillboard's two hides
// [SETTINGS: the two Compatibility keys say exactly what is hidden].

import { eotbCamera } from './eotbCamera.js';
import { setEotbBodyReady, setEotbDrawBody, setEotbPlayerState } from './mwView.js';
import { modSettingIfDeclared, modSettingsOf } from '../systems/modSettings.js';
import {
  chooseTable, attackTable, deathTable, ORIENTATIONS, orientationFor, frameTime,
  attackString, clipFrames, turnsToView,
} from './eotbBillboard.js';
import { spriteFor, eotbSpriteUrl, spriteCount, spriteSize, advanceFrame, flipRows } from './eotbSprite.js';

/** The clip length every table in the bundle ships - five records a
 *  state (the sprite sweep in eotb_billboard.test.js asks for each). */
export const CLIP_FRAMES = 5;

/** The mod's own settings, resolved - read once per attach, as
 *  `LoadSettings` does. */
function look() {
  let s = {};
  try { s = modSettingsOf('eye-of-the-beholder'); } catch { s = {}; }
  return {
    onFoot: s['Graphics.OnFoot'] ?? 0,
    onHorse: s['Graphics.OnHorse'] ?? 0,
    readyStance: s['Graphics.ReadyStance'] ?? 2,
    // AUDIT-EOTB2: the six the loop never read
    graphic: s['Graphics.Enable'] !== false,                   // "Toggle the player graphic"
    turnToView: s['Graphics.TurnToView'] ?? 2,
    attackStrings: s['Graphics.AttackStrings'] ?? 3,
    mirrorTime: s['Graphics.MirrorTime'] ?? 3,
    pingPongOffset: s['Graphics.PingPongOffset'] ?? 1,
    syncFootsteps: s['Animation.SyncFootsteps'] !== false,
    dontHideWeapon: s['Compatibility.Don\'tHideWeapon'] === true,
    dontHideHorse: s['Compatibility.Don\'tHideHorse'] === true,
    scale: (s['Animation.BillboardScale'] ?? 1) + (s['Animation.FineBillboardScale'] ?? 0),
    scaleOffsetMod: (s['Animation.GlobalOffsetScale'] ?? 1) + (s['Animation.FineGlobalOffsetScale'] ?? 0),
    walkAnimSpeedMod: s['Animation.WalkCycleSpeed'] ?? 1,
    enabled: s.Enabled !== false,
  };
}

/**
 * AUDIT-EOTB2: THE FRAME'S STATE, in the shape chooseTable reads, from
 * the record the rig registers plus whatever a host adds. `motion` is
 * the hosts' one motion bag (`player/motor.js motionBagOf`), which the
 * rig already receives through its camera thunk - so `stopped` is the
 * motor's own `standing` (grounded and no move axis, DFU's
 * IsStandingStill), and a gallop is the saddle at a run.
 */
export function bodyState(s = {}) {
  const m = s.motion ?? {};
  const riding = s.riding ?? !!m.riding;
  const stopped = s.stopped ?? (m.standing != null ? !!m.standing : !((m.forward || 0) || (m.strafe || 0)));
  return {
    died: !!s.died,
    transformed: !!s.transformed,
    lycanthropyType: s.lycanthropyType ?? 0,
    riding,
    stopped,
    galloping: s.galloping ?? (riding && !!m.running),
    sheathed: s.sheathed ?? !s.weaponReady,
    spellcasting: !!s.spellcasting,
    usingBow: !!s.usingBow,
    forward: m.forward || 0,
    strafe: m.strafe || 0,
  };
}

/**
 * THE BROWSER DECODE, lifted out so it can be replaced.
 *
 * AUDIT-EOTB, the one mutant the arc's pins did not kill: dropping
 * `firstUp` from `ready()` changed nothing any test could see, because
 * under node `spriteCount()` is 0 and the lane is shut whatever the
 * second clause says. The clause the file's own docstring calls "the
 * one that matters" was unpinned - the F-SING lesson again, in the
 * environment rather than in the code.
 *
 * So the three things that need a browser are one injectable dep each,
 * and the pins drive a body with art present and a decode they hold
 * open. This is also the only place an `Image` and an
 * `OffscreenCanvas` are named, which is worth having by itself.
 */
export async function decodeSprite(url) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = () => rej(new Error(url));
    i.src = url;
  });
  const c = new OffscreenCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height);
  return { width: img.width, height: img.height, colors: new Uint32Array(d.data.buffer.slice(0)) };
}

export function createEotbBody({ count = spriteCount, urlFor = eotbSpriteUrl, decode = decodeSprite, rolls = Math.random } = {}) {
  let renderer = null;
  let cfg = look();
  let clock = { frame: 0, timer: 0 };
  let table = 'Idle';
  let orientation = 0;
  let last = bodyState();       // the frame's state, as bodyState shapes it
  const tex = new Map();      // rec -> { w, h } uploaded | Promise decoding | null failed
  let batch = null;
  let batchRec = null;
  /** The one sprite that decides whether this lane may open at all.
   *  See `ready()`. */
  let firstUp = false;
  /** AUDIT-EOTB2: the one-shot in flight - PlayAnimationCoroutine and
   *  its two variants are this record: the table, the frame ORDER, the
   *  index into it, its clock, whether the last frame HOLDS (the bow's
   *  drawn string), and whether the whole clip is flipped (Mirror). */
  let clip = null;
  /** Mirror's alternation and its revert clock (Graphics.MirrorTime). */
  let attackMirror = false;
  let mirrorTimer = 0;
  /** TurnToView: the way the sprite last faced when it was not facing
   *  the view, so a player who stops keeps their heading. */
  let facing = null;
  /** SyncFootsteps: what the last tick said about the stride. */
  let step = { owns: false, fell: false };

  /** Decode one sprite and upload it, flipping when the state asks.
   *  Browser-only; in node there is no URL and nothing to decode, so
   *  every sprite stays absent and `ready()` answers false. */
  /** AUDIT-EOTB2 F-CACHE: the cache is keyed by ARCHIVE and record, not
   *  by record alone. `rec` is the renderer's per-archive record name,
   *  and the horse and lycan tables reuse the on-foot numbering over
   *  their own archives - so IdleHorse's `0-0` and Idle's `0-0` shared
   *  one slot, and a rider was drawn with the on-foot sprite's pixels
   *  and the on-foot sprite's size. */
  const cacheKey = (s) => `${s.archive}:${s.rec}`;
  function ensure(s) {
    if (!renderer || !s) return null;
    const have = tex.get(cacheKey(s));
    if (have && !(have instanceof Promise)) return have;
    if (have) return null;                      // in flight
    const url = urlFor(s.key);
    if (!url) { tex.set(cacheKey(s), null); return null; }
    const p = (async () => {
      const { width, height, colors } = await decode(url);
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

  /** [SETTINGS] Start a one-shot over `tbl`. `hold` keeps the last
   *  frame until `release()` (PlayAnimationHoldCoroutine - the drawn
   *  bow); a Mirror string flips the whole clip and alternates the
   *  flip swing by swing; PingPong reorders the frames. The clip's
   *  clock is the walk clock's own (get_frameTime) - the tick time
   *  GetMeleeAnimTickTime derives is the one number this file cannot
   *  read without the assembly, and says so. */
  function play(tbl, { hold = false, string = 'None' } = {}) {
    const pingPong = string === 'PingPong';
    if (string === 'Mirror') { attackMirror = !attackMirror; mirrorTimer = 0; }
    clip = {
      table: tbl, hold,
      frames: clipFrames(CLIP_FRAMES, { pingPong, pingPongOffset: cfg.pingPongOffset }),
      i: 0, timer: 0, mirror: attackMirror && string === 'Mirror', done: false,
    };
    return clip;
  }

  function advanceClip(dt) {
    if (!clip) return;
    if (clip.done) return;                     // a held or finished clip stays where it is
    const stepS = frameTime(last.riding, cfg.walkAnimSpeedMod);
    clip.timer += dt;
    let guard = clip.frames.length + 1;
    while (clip.timer >= stepS && guard-- > 0) {
      clip.timer -= stepS;
      if (clip.i < clip.frames.length - 1) clip.i++;
      else { clip.done = true; break; }
    }
    if (clip.done && !clip.hold && !clip.death) clip = null;   // a plain clip ends; a held or death clip stays on its last frame
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
     * classic sprite path is the only path it knows - and the first cut
     * of AUDIT-EOTB F2 broke it by calling `setEotbPlayerState` from the
     * rig.
     */
    attach(r, playerState) {
      renderer = r || null;
      cfg = look();
      if (renderer) {
        // warm ONE sprite - the idle facing the camera - so the lane has
        // something to show the instant it opens
        ensure(spriteFor('Idle', 0, 0, cfg));
        setEotbBodyReady(() => this.ready());
        setEotbDrawBody((canvas, f) => this.draw(canvas, f));
        setEotbPlayerState(playerState);
      }
      return this;
    },

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
      if (!renderer || !cfg.enabled) return false;
      if (modSettingIfDeclared('eye-of-the-beholder', 'Enabled') === false) return false;
      return count() > 0 && firstUp;
    },

    /**
     * The frame's state, from the record the rig registers (plus the
     * host's own fields). AUDIT-EOTB2: this used to receive `riding`
     * and nothing else, and the body stood still for ever.
     */
    tick(dt, state = {}) {
      last = bodyState(state);
      // [SETTINGS] PlayDeathAnimation: dead, the death table plays ONCE
      // and holds its last frame for as long as the death lasts; alive
      // again (a load), the clip goes.
      if (last.died) {
        if (!clip?.death) { play(deathTable(last)); clip.death = true; clip.hold = true; }
      } else if (clip?.death) clip = null;
      advanceClip(dt);
      // Mirror's revert (Graphics.MirrorTime, "Set to 0 to disable")
      if (attackMirror && cfg.mirrorTime > 0) {
        mirrorTimer += dt;
        if (mirrorTimer >= cfg.mirrorTime) { attackMirror = false; mirrorTimer = 0; }
      }
      // the loop runs beneath a one-shot so the walk resumes in phase
      const loop = chooseTable({ ...last, readyStance: cfg.readyStance });
      const adv = advanceFrame(clock, dt, {
        frames: CLIP_FRAMES, riding: last.riding, walkAnimSpeedMod: cfg.walkAnimSpeedMod,
      });
      clock = { frame: adv.frame, timer: adv.timer };
      table = clip ? clip.table : loop;
      // [SETTINGS] SyncFootsteps: the stride is the PICTURE's while the
      // sprite is on screen - a footfall on frames 2 and 4 of a MOVE
      // table, on foot; the saddle keeps DFU's own hoofbeats.
      const walking = !clip && /^Move/.test(loop) && !last.riding;
      step = {
        owns: cfg.syncFootsteps && this.ready() && eotbCamera.thirdPerson() && !last.riding,
        fell: walking && adv.footfall,
      };
      return { ...adv, table, clip: clip ? { table: clip.table, frame: clip.frames[clip.i], done: clip.done } : null };
    },

    /** [SETTINGS] The five Play*AttackAnimation doors, as the rig's own
     *  strike reaches them: melee, ranged (held while the string is
     *  drawn), spell, lycan. `strike` is the machine's state name -
     *  the port's own vocabulary, kept so a pin can say which. */
    attack(strike = 'StrikeDown', { hold = false } = {}) {
      if (last.died) return null;
      const tbl = attackTable(last);
      const string = attackString(cfg.attackStrings, rolls);
      return play(tbl, { hold, string });
    },
    /** PlaySpellAttackAnimation - the cast's own door (castSpellAnim). */
    cast() {
      if (last.died) return null;
      return play(last.transformed ? 'AttackMeleeLycan' : 'AttackSpell', { string: attackString(cfg.attackStrings, rolls) });
    },
    /** PlayAnimationHoldCoroutine's release - the string let go. */
    release() {
      if (clip?.hold && !clip.death) { clip.hold = false; if (clip.done) clip = null; }
    },

    /**
     * Which way round the sprite is drawn, given where the camera is
     * and which way the player is going. [SETTINGS] TurnToView: the
     * sprite faces the VIEW when the option says so this frame, and
     * its own heading otherwise - the direction of travel while
     * moving, the last such heading while still.
     */
    face(viewFacing, toCamera) {
      const readied = !last.sheathed || last.spellcasting;
      const toView = turnsToView(cfg.turnToView, { animating: !!clip && !clip.death, readied });
      let f = viewFacing;
      if (!toView) {
        const moving = (last.forward || last.strafe) && !last.stopped;
        if (moving) {
          // the move axes are the body's own (forward, strafe); rotate
          // them into the world by the view's yaw
          const yaw = Math.atan2(viewFacing[0], viewFacing[2]);
          const s = Math.sin(yaw), c = Math.cos(yaw);
          f = [last.strafe * c + last.forward * s, 0, -last.strafe * s + last.forward * c];
          facing = f;
        } else f = facing ?? viewFacing;
      } else facing = null;
      orientation = orientationFor(f, toCamera);
      return orientation;
    },

    draw(canvas, { proj, view, eye, feet, yaw } = {}) {
      if (!renderer || !eotbCamera.thirdPerson()) return false;
      if (!cfg.graphic) return false;            // Graphics.Enable off: the camera stands out, the body does not draw
      const viewFacing = [Math.sin(yaw ?? 0), 0, Math.cos(yaw ?? 0)];
      const to = [(eye?.[0] ?? 0) - (feet?.[0] ?? 0), 0, (eye?.[2] ?? 0) - (feet?.[2] ?? 0)];
      if (to[0] || to[2]) this.face(viewFacing, to);
      const frame = clip ? clip.frames[clip.i] : clock.frame;
      const s = spriteFor(table, orientation, frame, cfg, { flip: !!clip?.mirror });
      const up = ensure(s);
      if (!up) return false;                 // still decoding: a frame with no body beats a wrong one
      // AUDIT-EOTB2: sized for the state it is IN - the saddle and the
      // transformed forms take get_sizeMod's larger arm; this used to
      // pass `false, false` and drew a rider the size of a man
      const size = spriteSize(up.w, up.h, { riding: last.riding, transformed: last.transformed, scale: cfg.scale });
      if (!batch || batchRec !== cacheKey(s)) {
        if (batch) renderer.destroyBillboardBatch?.(batch);
        batch = renderer.createBillboardBatch(s.archive, s.rec, size, [[0, 0, 0]]);
        batch.origin = [0, 0, 0];
        batchRec = cacheKey(s);
      }
      batch.origin[0] = feet?.[0] ?? 0;
      batch.origin[1] = (feet?.[1] ?? 0) + size.h / 2;   // the billboard is centred; the feet are not
      batch.origin[2] = feet?.[2] ?? 0;
      const camRight = [Math.cos(yaw ?? 0), 0, -Math.sin(yaw ?? 0)];
      renderer.drawBillboards([batch], camRight, [0, 1, 0]);
      return true;
    },

    /** [SETTINGS] SyncFootsteps' word for the hosts' stride machine:
     *  `owns` while the sprite's picture carries the stride, `fell` on
     *  the tick a foot landed. Read through `mwView.mwViewFootstep`. */
    footstep() { return step; },

    /** [SETTINGS] ToggleBillboard's two hides, each behind its
     *  Compatibility key: the FPV weapon and the FPV horse are hidden
     *  while this body is the one on screen. */
    hides() {
      const tp = this.ready() && eotbCamera.thirdPerson();
      return { weapon: tp && !cfg.dontHideWeapon, horse: tp && !cfg.dontHideHorse };
    },

    /** Test seams - the pins drive the body rather than the bundle. */
    state: () => ({
      table, orientation, frame: clip ? clip.frames[clip.i] : clock.frame, ready: firstUp, cached: tex.size,
      clip: clip ? { table: clip.table, frames: [...clip.frames], i: clip.i, hold: clip.hold, mirror: clip.mirror, done: clip.done, death: !!clip.death } : null,
      attackMirror, last: { ...last }, facing: facing ? [...facing] : null,
    }),
    settings: () => cfg,
    reload() { cfg = look(); return cfg; },
    orientations: ORIENTATIONS,
  };
}

/** One player, one body - the module-level instance fpArm, mwCamera
 *  and eotbCamera all keep. */
export const eotbBody = createEotbBody();
