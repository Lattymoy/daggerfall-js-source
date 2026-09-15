// EOTB5: THE LIVE BODY - what actually appears behind the camera.
//
// EOTB3 answers which sprite; eotbSprite.js answers where its pixels
// are and how big it stands; this file holds the one instance, keeps
// its clock, and hands `mwView` the two doors it left open (EOTB4).
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

import { eotbCamera } from './eotbCamera.js';
import { setEotbBodyReady, setEotbDrawBody, setEotbPlayerState } from './mwView.js';
import { modSettingIfDeclared, modSettingsOf } from '../systems/modSettings.js';
import { chooseTable, ORIENTATIONS, orientationFor } from './eotbBillboard.js';
import { spriteFor, eotbSpriteUrl, spriteCount, spriteSize, advanceFrame, flipRows } from './eotbSprite.js';

/** The mod's own settings, resolved - read once per attach, as
 *  `LoadSettings` does. */
function look() {
  let s = {};
  try { s = modSettingsOf('eye-of-the-beholder'); } catch { s = {}; }
  return {
    onFoot: s['Graphics.OnFoot'] ?? 0,
    onHorse: s['Graphics.OnHorse'] ?? 0,
    readyStance: s['Graphics.ReadyStance'] ?? 2,
    scale: (s['Animation.BillboardScale'] ?? 1) + (s['Animation.FineBillboardScale'] ?? 0),
    scaleOffsetMod: (s['Animation.GlobalOffsetScale'] ?? 1) + (s['Animation.FineGlobalOffsetScale'] ?? 0),
    walkAnimSpeedMod: s['Animation.WalkCycleSpeed'] ?? 1,
    enabled: s.Enabled !== false,
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

export function createEotbBody({ count = spriteCount, urlFor = eotbSpriteUrl, decode = decodeSprite } = {}) {
  let renderer = null;
  let cfg = look();
  let clock = { frame: 0, timer: 0 };
  let table = 'Idle';
  let orientation = 0;
  const tex = new Map();      // rec -> { w, h } uploaded | Promise decoding | null failed
  let batch = null;
  let batchRec = null;
  /** The one sprite that decides whether this lane may open at all.
   *  See `ready()`. */
  let firstUp = false;

  /** Decode one sprite and upload it, flipping when the state asks.
   *  Browser-only; in node there is no URL and nothing to decode, so
   *  every sprite stays absent and `ready()` answers false. */
  function ensure(s) {
    if (!renderer || !s) return null;
    const have = tex.get(s.rec);
    if (have && !(have instanceof Promise)) return have;
    if (have) return null;                      // in flight
    const url = urlFor(s.key);
    if (!url) { tex.set(s.rec, null); return null; }
    const p = (async () => {
      const { width, height, colors } = await decode(url);
      // the MIRROR is applied here, on the way to the upload, because
      // the renderer's billboard batch has no flip - a mirrored sprite
      // is its own pixels under its own key (`s.rec`, EOTB5)
      const px = s.mirror ? flipRows(colors, width, height) : colors;
      renderer.uploadTexture(s.archive, s.rec, { width, height, colors: px });
      return { w: width, h: height };
    })();
    tex.set(s.rec, p);
    p.then((r) => { tex.set(s.rec, r); firstUp = true; },
      () => { tex.set(s.rec, null); });
    return null;
  }

  return {
    /**
     * Called by `combat/weaponRig.js` beside `fpArm.attach`.
     *
     * `playerState` is the per-frame answer only the rig can give -
     * `{ weaponReady, sailing }` - and it is handed HERE rather than
     * registered by the rig itself. That is the direction the rest of
     * this module already runs: the body owns its three `mwView` seams
     * and the rig owns the arm. MWFIX's pin (`test/mwattach.test.js`)
     * states the same law from the other side - `weaponRig.js` must not
     * mention the view layer, because the classic sprite path is the
     * only path it knows - and the first cut of AUDIT-EOTB F2 broke it
     * by calling `setEotbPlayerState` from the rig.
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

    /** The frame's state, from the host's own view of the player. */
    tick(dt, state = {}) {
      table = chooseTable({ ...state, readyStance: cfg.readyStance });
      const adv = advanceFrame(clock, dt, {
        frames: 5, riding: state.riding, walkAnimSpeedMod: cfg.walkAnimSpeedMod,
      });
      clock = { frame: adv.frame, timer: adv.timer };
      return adv;
    },

    /** Which way round the sprite is drawn, given where the camera is.
     *  Answered here so the host never computes an orientation. */
    face(facing, toCamera) {
      orientation = orientationFor(facing, toCamera);
      return orientation;
    },

    draw(canvas, { proj, view, eye, feet, yaw } = {}) {
      if (!renderer || !eotbCamera.thirdPerson()) return false;
      const facing = [Math.sin(yaw ?? 0), 0, Math.cos(yaw ?? 0)];
      const to = [(eye?.[0] ?? 0) - (feet?.[0] ?? 0), 0, (eye?.[2] ?? 0) - (feet?.[2] ?? 0)];
      if (to[0] || to[2]) this.face(facing, to);
      const s = spriteFor(table, orientation, clock.frame, cfg);
      const up = ensure(s);
      if (!up) return false;                 // still decoding: a frame with no body beats a wrong one
      const size = spriteSize(up.w, up.h, { riding: false, transformed: false, scale: cfg.scale });
      if (!batch || batchRec !== s.rec) {
        if (batch) renderer.destroyBillboardBatch?.(batch);
        batch = renderer.createBillboardBatch(s.archive, s.rec, size, [[0, 0, 0]]);
        batch.origin = [0, 0, 0];
        batchRec = s.rec;
      }
      batch.origin[0] = feet?.[0] ?? 0;
      batch.origin[1] = (feet?.[1] ?? 0) + size.h / 2;   // the billboard is centred; the feet are not
      batch.origin[2] = feet?.[2] ?? 0;
      const camRight = [Math.cos(yaw ?? 0), 0, -Math.sin(yaw ?? 0)];
      renderer.drawBillboards([batch], camRight, [0, 1, 0]);
      return true;
    },

    /** Test seams - the pins drive the body rather than the bundle. */
    state: () => ({ table, orientation, frame: clock.frame, ready: firstUp, cached: tex.size }),
    settings: () => cfg,
    reload() { cfg = look(); return cfg; },
    orientations: ORIENTATIONS,
  };
}

/** One player, one body - the module-level instance fpArm, mwCamera
 *  and eotbCamera all keep. */
export const eotbBody = createEotbBody();
