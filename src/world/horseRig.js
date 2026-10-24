// @ts-check
// COATS3D (bible/06-Systems/Horse-Coats.md, "The 3D horse"): THE 3D HORSE, ITS GL HALF - one per renderer
// (`horseRigFor`), shared by every horse the Morrowind lane draws: the player's own under them (player/mwView.js),
// every other rider's (net/peer/peerBodies.js), and Horse Cart and Cargo's standing, following and pulling horses and the
// road's teams (scenes/horseCartPool.js).
//
//  - ONE STREAM. The bake (world/horseModel.js horseSkinStream) is uploaded once; every horse is a view of it with its
//    OWN palette (renderer.createSkinPalette - a picture queued in a sprite batch is drawn at the flush, so each horse
//    keeps the pose it was queued in) and its own gait.
//  - ONE PICTURE A LOOK. The body's picture is dyed per look (systems/horse/horseCoats.js dyeHorseTexelRows, the sprites'
//    law on the horse's own surface - world/horseModel.js startTexelMap, built once a slice a frame), DYE_ROWS a frame
//    so no frame pays a look's whole 50-120 ms, and uploaded with its mips once done; a horse whose look is not up yet wears the bay's. Past
//    HORSE3D_LOOKS_KEPT looks, the one longest undrawn is let go - never one drawn this frame or the last, so a crowd of
//    more looks than that keeps them all rather than thrash; a look asked for and then not again for LOOK_ASK_STALE
//    frames (its horse gone, the lane left) leaves the queue undyed. The mane and tail's picture is the art's on every look.
//  - THE DRAWS. A horse alone is a Morrowind mesh in the world, so it draws as the Morrowind body does - a picture
//    through the sprite pass at the viewer's Morrowind dial (render/characterSprite.js drawBodyPicture, mwModelPixel); a horse under
//    a rider is in the RIDER's picture (`also`, fpArm.js drawThird); in first person the rider's eye is on its back, so
//    the horse is taken with the world's own camera into a screen-sized picture and laid over the world where Daggerfall
//    drew its riding sprite (drawFirstPerson).
//
// Not a DFU member: Daggerfall's horse is a sprite. Ledger A (COATS3D).
import { HORSE_MODEL_URL, HORSE_PICTURE_URLS, horseSkinStream, horsePaletteShape, horsePoseScratch, horseGait, stepHorseGait, writeHorsePalette, startTexelMap, rgbaMips, horseHide } from './horseModel.js';
import { dyeHorseTexelRows, horseLookCode, horseLookOfCode } from '../systems/horse/horseCoats.js';
import { drawBodyPicture, mwModelPixel } from '../render/characterSprite.js';
import { CHAR_SPRITE_RT_SIZE } from '../render/renderer.js';
import { decodePng } from '../systems/textureReplacement.js';
import { multiply, trs, transformPoint } from './mat4.js';

/** Dyed looks kept on the GPU (the bay's is always kept). */
export const HORSE3D_LOOKS_KEPT = 12;
/** Rows of the body's picture a frame's dye takes: 32 of 256, some 6-15 ms - a look up in eight frames. */
export const DYE_ROWS = 32;
/** AUDIT COATS3D A2: frames a look waits in the queue un-asked before it is dropped undyed - every horse on screen asks
 *  each frame it steps, so only a look nobody draws any more goes stale. */
export const LOOK_ASK_STALE = 30;
/** The horse's Z-up frame into the pass's Y-up one - fpArm.js NIF_TO_PASS, the Morrowind body's own basis change. */
const Z_UP_TO_PASS = trs(0, 0, 0, -90, 0, 0);
/** Whether a ball (`c` its centre, `r` its reach) stands wholly out of a camera's view: behind its eye, or past a side
 *  of a perspective lens (`proj` column-major, its x and y scales [0] and [5]; an ortho lens has no sides here). */
export function outOfView(c, r, view, proj) {
  if (!view || view.length !== 16) return false;
  const vx = view[0] * c[0] + view[4] * c[1] + view[8] * c[2] + view[12];
  const vy = view[1] * c[0] + view[5] * c[1] + view[9] * c[2] + view[13];
  const vz = view[2] * c[0] + view[6] * c[1] + view[10] * c[2] + view[14];
  if (vz > r) return true;   // behind the eye (the view looks down -z)
  if (!proj || proj.length !== 16 || proj[11] === 0) return false;
  const sx = proj[0], sy = proj[5];
  return Math.abs(vx) * sx + vz > r * Math.hypot(1, sx) || Math.abs(vy) * sy + vz > r * Math.hypot(1, sy);
}
/** The SEAT on the owner's rig (its own frame, metres): the back's lowest between the withers and the croup - its top
 *  stands 1.52 m over the ground from 0 to 0.4 m forward of the rig's origin (measured off the mesh) - and a seated
 *  rider's hips 0.16 m over it (seatPose.js: a chair's 0.45 m top under hips at 0.61). Carried by the Spine bone, so a
 *  rider rises and falls with the back's own stride. */
export const HORSE_SEAT = Object.freeze([0, 0.1, 1.68]);
export const HORSE_SEAT_BONE = 'Spine';

const rigs = new WeakMap();
/** The renderer's one 3D horse rig (made on first ask). */
export function horseRigFor(renderer, opts = {}) {
  let r = rigs.get(renderer);
  if (!r) { r = createHorseRig({ renderer, ...opts }); rigs.set(renderer, r); }
  return r;
}

/**
 * @param {{ renderer: any, fetchJson?: (url: string) => Promise<any>, fetchBytes?: (url: string) => Promise<Uint8Array>, decode?: (bytes: Uint8Array) => Promise<{ width: number, height: number, data: Uint8Array }> }} deps
 */
export function createHorseRig({ renderer, fetchJson = (u) => fetch(u).then((r) => r.json()), fetchBytes = (u) => fetch(u).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b)), decode = decodePng }) {
  /** @type {any} */ let bake = null;
  let base = null, shape = null, stream = null, hide = null, seatBone = -1, seatLocal = null;
  /** @type {{ width: number, height: number, data: Uint8Array } | null} */ let body = null;
  let hairTex = null, map = null, mapJob = null, failed = null;
  /** @type {Promise<void> | null} */ let loading = null;
  const looks = new Map();   // code -> { tex, last }
  const asked = new Map();   // code -> the frame it was last asked for: the codes waiting for their dye, oldest first
  let job = null;   // { code, out, row }
  let frame = 0;

  function load() {
    if (loading || !renderer) return loading;
    loading = (async () => {
      const [b, bodyBytes, hairBytes] = await Promise.all([fetchJson(HORSE_MODEL_URL), fetchBytes(HORSE_PICTURE_URLS.body), fetchBytes(HORSE_PICTURE_URLS.hair)]);
      const [bodyImg, hairImg] = await Promise.all([decode(bodyBytes), decode(hairBytes)]);
      bake = b;
      body = bodyImg;
      shape = horsePaletteShape(bake);
      stream = horseSkinStream(bake);
      hide = horseHide(bake);
      seatBone = bake.bones.findIndex((x) => x.name === HORSE_SEAT_BONE);
      if (seatBone >= 0) {
        const inv = bake.bones[seatBone].inverseBind;   // column-major: the seat in the bone's own frame
        seatLocal = [0, 1, 2].map((r) => inv[r] * HORSE_SEAT[0] + inv[4 + r] * HORSE_SEAT[1] + inv[8 + r] * HORSE_SEAT[2] + inv[12 + r]);
      }
      base = renderer.createSkinnedCharacterMesh(stream.stream, { floats: stream.floats, pairs: stream.pairs, width: shape.width, height: shape.height });
      renderer.releaseCharacterSkin(base);   // the shared mesh poses no horse - each horse brings its own palette
      looks.set(0, { tex: renderer.createCharacterTexture(rgbaMips(body.width, body.height, body.data)), last: Infinity });
      hairTex = renderer.createCharacterTexture(rgbaMips(hairImg.width, hairImg.height, hairImg.data));
    })().catch((e) => { failed = String(e?.message ?? e); });
    return loading;
  }

  /** The texture of look `code` - asked for when it is not up, the bay's meanwhile. */
  function lookTex(code) {
    const c = Number.isInteger(code) && code > 0 ? code : 0;
    const have = looks.get(c);
    if (have) { have.last = frame; return have.tex; }
    if (job?.code !== c) asked.set(c, frame);   // a look waiting keeps its place, asked again
    return looks.get(0)?.tex ?? null;
  }

  /** One frame's dye: DYE_ROWS of the oldest look asked for, uploaded when its last row is in; then the kept looks
   *  trimmed to HORSE3D_LOOKS_KEPT, the longest undrawn let go. */
  function tick() {
    frame++;
    if (!base || !body) return;
    for (const [c, at] of asked) if (frame - at > LOOK_ASK_STALE) asked.delete(c);   // AUDIT COATS3D A2: nobody draws it now
    if (!job && asked.size) {
      // the texel map first, a slice a frame (world/horseModel.js startTexelMap - built once, some 40-85 ms whole)
      if (!map) { mapJob ??= startTexelMap(bake, body.width, body.height); if (!mapJob.step()) return; map = mapJob.map; mapJob = null; return; }
      const code = /** @type {number} */ (asked.keys().next().value);
      asked.delete(code);
      job = { code, look: horseLookOfCode(code), out: new Uint8Array(body.data), row: 0 };
    }
    if (job) {
      const r1 = Math.min(body.height, job.row + DYE_ROWS);
      dyeHorseTexelRows(body.data, job.out, body.width, job.look, map, job.row, r1);
      job.row = r1;
      if (r1 >= body.height) {
        looks.set(job.code, { tex: renderer.createCharacterTexture(rgbaMips(body.width, body.height, job.out)), last: frame });
        job = null;
      }
    }
    while (looks.size > HORSE3D_LOOKS_KEPT + 1) {
      let worst = null, at = Infinity;
      // AUDIT COATS3D A4: never a look drawn this frame or the last (a horse steps before this tick - its texture is
      // already on its mesh): past the cap with all of them on screen, the cap waits
      for (const [c, l] of looks) if (c && l.last < frame - 2 && l.last < at) { at = l.last; worst = c; }
      if (worst == null) break;
      renderer.releaseCharacterTexture(looks.get(worst).tex);
      looks.delete(worst);
    }
  }

  /** A horse: its gait, its palette, its view of the one stream. Null until the rig is up. */
  function horse(seed = 0) {
    if (!base) return null;
    const pal = new Float32Array(shape.width * shape.height * 4);
    const mesh = { vao: base.vao, count: base.count, buffers: [], vbo: base.vbo, floats: base.floats, bounds: null,
      skin: renderer.createSkinPalette({ pairs: stream.pairs, width: shape.width, height: shape.height }),
      ranges: stream.ranges.map((r) => ({ first: r.first, count: r.count, tex: r.texture === 'hair' ? hairTex : null, alphaCut: r.alpha ? 0.5 : 0, hidden: false, part: r.part })) };
    return { seed, gait: horseGait(), scratch: horsePoseScratch(bake), pal, mesh, model: null, feet: [0, 0, 0], yaw: 0, scale: 1, look: 0,
      posed: false, stale: false };   // HORSE-VIEW: a pose sent yet; the pose sent behind the gait's clock (a step taken with `pose` false)
  }

  /** A horse let go: its palette (the stream is the rig's). */
  function release(h) {
    if (h?.mesh?.skin?.tex) renderer.releaseCharacterSkin(h.mesh);
  }

  /** One frame of a horse: its gait stepped at `speed` (m/s, its ground speed), its pose written and uploaded, and
   *  where it stands - its feet (the rig's origin on the ground) and its heading (the way it faces, the motor's yaw:
   *  0 down +Z, as every body's). `gallops` false: its rider holds it to a slow ride (HORSE-WALK - horseModel.js
   *  gaitFor); a horse no one rides gallops as its speed says.
   *  HORSE-VIEW (bible/07-Rendering/Performance-Priority.md): `pose` false steps the gait's clock and places the horse,
   *  and neither writes its pose nor sends it - it stands in the last pose sent (`stale`) until `pose` catches it up.
   *  The palette is the clock's alone (horseModel.js writeHorsePalette reads the gait and nothing else), so a pose
   *  after skipped frames is the one an every-frame horse shows on that frame. A horse never posed is posed whatever
   *  `pose` says - none stands in the palette it was made with. */
  function step(h, { feet, yaw, speed = 0, dt = 0, look = 0, gallops = true, pose = true }) {
    stepHorseGait(h.gait, bake, speed, dt, h.seed, gallops);
    if (pose || !h.posed) poseNow(h);
    else h.stale = true;
    h.look = horseLookCode(horseLookOfCode(look | 0));
    h.mesh.ranges[0].tex = lookTex(h.look);
    return place(h, feet, yaw);
  }

  /** HORSE-VIEW: a horse's pose written and sent where its gait's clock stands - the palette, its upload. */
  function poseNow(h) {
    writeHorsePalette(bake, h.gait, h.pal, h.scratch);
    renderer.updateSkinPalette(h.mesh, h.pal);
    h.posed = true; h.stale = false;
  }
  /** HORSE-VIEW: a horse whose pose is behind its clock (stepped with `pose` false) posed where the clock stands; one
   *  already there sends nothing. Answers whether it posed. */
  function pose(h) {
    if (!h || (h.posed && !h.stale)) return false;
    poseNow(h);
    return true;
  }

  /** Where a horse stands: its feet and heading, `scale` times its size about its feet (the travel view's grown
   *  traveller, fpArm.js drawThird's OW-BIG - 1 everywhere else). The pose is the step's. */
  function place(h, feet, yaw, scale = 1) {
    h.feet[0] = feet[0]; h.feet[1] = feet[1]; h.feet[2] = feet[2];
    h.yaw = yaw; h.scale = scale;
    // the Morrowind body's own placement (fpArm.js drawThird): its heading turned half round, x mirrored, Z up to Y up
    h.model = multiply(trs(feet[0], feet[1], feet[2], 0, (yaw * 180) / Math.PI + 180, 0, -scale, scale, scale), Z_UP_TO_PASS);
    return h;
  }

  /** A stepped horse placed for a rider's picture (fpArm.js drawThird's `horse`): `{ mesh, model, box }`. */
  function picture(h, feet, yaw, scale = 1) {
    if (!h?.model) return null;
    place(h, feet, yaw, scale);
    return { mesh: h.mesh, model: h.model, box: box(h) };
  }

  /** Where a stepped horse's seat is in the world - the rider's hips - and the way it faces (its Spine bone's own
   *  forward, so a rider leans with the back's stride). */
  function seat(h) {
    if (!h?.model || seatBone < 0) return null;
    const W = h.scratch.world, o = seatBone * 12, s = seatLocal;
    const local = [0, 1, 2].map((r) => W[o + r * 4] * s[0] + W[o + r * 4 + 1] * s[1] + W[o + r * 4 + 2] * s[2] + W[o + r * 4 + 3]);
    return transformPoint(h.model, local[0], local[1], local[2]);
  }

  /** A stepped horse's box in the world - the sprite law's window (characterSprite.js) - and its anchor (its axis at
   *  its middle's height): `{ center, halfW, halfH, anchor }`. */
  function box(h) {
    const b = bake.frame.bounds, k = h.scale ?? 1;
    const center = transformPoint(h.model, (b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2 + 0.05);
    const halfH = ((b.max[2] - b.min[2]) / 2 + 0.1) * k;   // a gallop's lift and its stretched legs: a hand's margin
    const halfW = (Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1]) / 2 + 0.1) * k;
    const anchor = transformPoint(h.model, 0, 0, (b.min[2] + b.max[2]) / 2);
    return { center, halfW, halfH, anchor };
  }

  /** HORSE-VIEW: does a placed horse reach into a camera's view - the draw's own test (its box's ball, outOfView)? One
   *  not placed yet is not known to be out of it. */
  function seen(h, view, proj, bx = h?.model ? box(h) : null) {
    return !bx || !outOfView(bx.center, Math.hypot(bx.halfW, bx.halfH), view, proj);
  }

  /** A horse alone, through the sprite pass at the Morrowind body's dial - none out of the view (AUDIT COATS3D A12: a
   *  horse behind the eye was skinned and drawn all the same, and one at the eye's plane a whole-screen tile).
   *  HORSE-VIEW: `fresh` - its caller skipped its pose out of the view - and a pose behind its clock is caught up before
   *  it is drawn, so a horse the view swings onto is never drawn in a pose from when it was last seen. */
  function draw(h, canvas, { proj, view, eye, up = null, conceal = null, hitFlash = 0, fresh = false }) {
    if (!h?.model || !canvas) return false;
    const bx = box(h);
    if (!seen(h, view, proj, bx)) return false;
    if (fresh) pose(h);
    drawBodyPicture(renderer, canvas, h.mesh, h.model, { ...bx, up, conceal, hitFlash }, proj, view, eye);
    return true;
  }

  /** The rider's horse in first person: the world's own camera, a screen-sized picture at the arm's dial, laid over
   *  the world where Daggerfall drew its riding sprite (the hosts draw the hands after it). */
  function drawFirstPerson(h, canvas, { proj, view }) {
    if (!h?.model || !canvas) return false;
    const pixel = mwModelPixel();   // MW-DETAIL: the viewer's dial, and the target's room for the screen's frame at it
    const wantW = canvas.clientWidth / pixel, wantH = canvas.clientHeight / pixel;
    const edge = renderer.charSpriteRoom?.(Math.ceil(Math.max(wantW, wantH))) ?? CHAR_SPRITE_RT_SIZE;
    const s = Math.min(1, edge / wantW, edge / wantH);
    const pw = Math.max(2, Math.round(wantW * s)), ph = Math.max(2, Math.round(wantH * s));
    const tex = renderer.renderCharacterSprite(h.mesh, h.model, proj, view, pw, ph);
    renderer.drawScreenOverlayQuad(tex, pw / edge, ph / edge);
    return true;
  }

  return {
    load, tick, horse, release, step, pose, place, picture, seat, box, seen, draw, drawFirstPerson, lookTex,
    /** The rig is up: the stream and the bay's pictures. */
    ready: () => !!base,
    /** Why the rig is not up, when it failed. */
    failure: () => failed,
    /** The bake (the pins' read). */
    bake: () => bake,
    /** The hide's measure (world/horseModel.js horseHide). */
    hide: () => hide,
    /** Looks kept, and the one in the dye (the pins' read). */
    kept: () => [...looks.keys()],
    dyeing: () => job?.code ?? null,
  };
}
