// @ts-check
// SET7 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md section 7; Mac: "Sigil stones become a currency to
// trade for daily reset sigil items at a new NPC vendor that stands outside the oblivion gate"): THE SIGIL BROKER, WHERE
// SHE STANDS - the pool on the runtime pools' shape (scenes/camps.js, scenes/gatePool.js): her body, the eye's box and
// her name, and the press on her.
//
// BROKER-CAGE (2026-10-02, Mac: "she should be present at the site in a jailed gate, and the gate opens after all the
// enemies are cleared"): SHE IS THE FAITHFUL'S PRISONER, CAGED AT THEIR CIRCLE. Her cage stands at a spot in the circle's
// own frame (net/gateRite.js riteLocalOf; world/riteModel.js: its heart, `facing` the bearing to the gate) - CAGE_R out,
// turned CAGE_TURN from the gate's bearing: outside the braziers, on the gate's side, away from the casket - so every
// player in the Bay finds her where every other does, and a floating-origin recentre carries her with the land. She
// stands there, caged or free, from the omen until the Wrath's midnight (cageStands): a Warden fallen early takes the
// breach and the circle with it, never her. Not on a pixel not built (no ground, no cage, no Broker - GATE-SEEN's law).
// The cage (world/cageModel.js) opens when every one of the faithful has fallen - the hub's word where the relay says it,
// this character's own eyes before it, and never shut where the relay keeps no rite (riteHost.js isCleared, the host's
// `freed` - AUDIT BROKER-CAGE C4, C6): its door swings out, she says she is free to a player near, and her window opens
// on a press - from every side of her cage (her eye's box is the cage's own, turned with it - C2, C3). Shut, a press says what frees her - or, the breach open and the faithful passed into it,
// that she stays caged tonight; the sale asks `stands()`, which is free and here. Midnight takes her, and a window open
// on her is shut (the host's `gone`).
//
// HER BODY is the Daedra Seducer's mortal guise (EnemyBasics 29, TEXTURE.284 - the game has no Dremora sprite), its idle
// records by the eight orientations (characters/mobileUnit.js IDLE_ANIMS, read through world/gateBoss.js bossFrame, the
// court's own reader), a billboard on the flats' axis. She faces the gate through her cage's door, and turns to a player
// come within BROKER_NOTICE_M of her - at a walk's pace, never a snap.
//
// NOTHING HERE IS SAVED OR SENT: where she stands is the breach's, and the breach is the clock's; her cage's word is the
// rite's (scenes/riteHost.js). What she sells, and what a character bought of it, are the law's (systems/sigilBroker.js);
// the window is ui/brokerWindow.js behind ui/brokerDoor.js; the sale is the host's (scenes/world.js), through the law.
//
// Not a DFU member. Ledger A (SET).
import { bossFrame } from '../world/gateBoss.js';
import { IDLE_ANIMS, IDLE_ANIM_SPEED } from '../characters/mobileUnit.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { mobileBillboardSize } from '../world/rmbFlats.js';
import { RAY_DISTANCE, STATIC_NPC_ACTIVATION_DISTANCE, presentNpcInfoText } from '../player/activate.js';
import { trs } from '../world/mat4.js';
import { CAPSULE_RADIUS, CAPSULE_HEIGHT } from '../player/motor.js';
import { riteLocalOf, riteWindow, cageStands, RITE_GRACE_MS } from '../net/gateRite.js';   // BROKER-CAGE: the faithful's circle, and her hours
import { gateSpotLocal } from '../net/gateLaw.js';
import {
  buildCageModel, buildCageDoor, cageHinge, CAGE_WALLS, CAGE_DOOR_WALL, CAGE_W, CAGE_D, CAGE_H, CAGE_CAP, CAGE_FOOT, CAGE_FOOT_UNDER, CAGE_POST,
  CAGE_SILL, CAGE_SILL_OVER, CAGE_SILL_MAX, CAGE_LEAF_W, CAGE_WALL_OUT, CAGE_DOOR_OPEN, CAGE_DOOR_MS,
} from '../world/cageModel.js';
import { gateArt, GATE_ARCHIVE } from '../world/gateArt.js';

/** The mobile whose sprite she wears: the Daedra Seducer, in her mortal guise. */
export const BROKER_MOBILE = 29;
/** BROKER-CAGE: where her cage stands at the faithful's circle (metres, in the circle's frame - world/riteModel.js): this
 *  far from its heart, outside its braziers (RITE_BRAZIER_R 8.5) and inside the clearing the rock keeps off
 *  (world/gateClearance.js RITE_CLEAR_M 20), turned this far from its bearing to the gate - the gate's side, away from
 *  the casket's (+π/2); the faithful's ring (4.6), their tents and their fire (behind, 13-15) clear of it. */
export const CAGE_R = 11.5;
export const CAGE_TURN = -Math.PI / 3;
/** The press reaches her as it reaches a static NPC (PlayerActivate's StaticNPCActivationDistance, 6.4). */
export const BROKER_REACH = STATIC_NPC_ACTIVATION_DISTANCE;
/** A player this near turns her head (metres), and how fast she turns (radians a second - a walk's turn). */
export const BROKER_NOTICE_M = 12;
export const BROKER_TURN_RATE = 2.4;
/** Her words: her plaque's name and line (BROKER-CAGE: the cage's while she is in it), the Info press, the Steal press, a
 *  press on her cage while the rite holds and after it, her door opening, and midnight taking her away mid-sale. */
export const BROKER_TEXT = Object.freeze({
  name: 'Sigil Broker',
  trade: 'Trades in Deadlands Embers',   // WB12a
  caged: 'Caged by Dagon\'s Faithful',
  get info() { return presentNpcInfoText('the Sigil Broker'); },   // L10N3d: DFU's youSee row, read as it is said
  steal: 'The Broker\'s eyes never leave her embers.',
  held: 'Kill all of Dagon\'s Faithful to free her.',
  lost: 'She stays caged tonight.',
  freed: 'The Sigil Broker is free.',
  gone: 'The Sigil Broker leaves for the night.',
});
/** BROKER-CAGE: her door opening is said to a player this near her (metres) - one who saw it shut this long first (ms):
 *  a page opened on a cage the hub's word opens a moment later finds it open, and hears nothing. */
export const BROKER_FREED_SAY_M = 60;
export const BROKER_SHUT_SEEN_MS = 3000;
/** BROKER-CAGE: her cage's walls and its shut door in the collider, each under its own bucket. */
export const BROKER_CAGE_BUCKET = 'cage:broker';
export const BROKER_DOOR_BUCKET = 'cage:door';
/** BROKER-CAGE: THE EYE'S BOX is her cage's own, turned with it (DISC10's turned box, player/activate.js rayObb): just
 *  beyond its walls, so the ray meets it before any bar, caged or free and from every side - AUDIT BROKER-CAGE C2: an
 *  axis-aligned box round any turn of the cage held a player's eye inside it at the bars, where a flat's box is never
 *  pressed, and reached past the walls to steal presses at a body lying by them; C3: her own box, once free, was hidden
 *  by the walls from everywhere but her door. No body the walls hold off (a capsule's radius beyond them) stands inside
 *  it; one in her open doorway does, and the press there meets the first surface inside it (activate.js CASTLE1: her
 *  post, her walls). Half its width and depth, and its height (over the posts' caps). */
export const BROKER_BOX_HX = CAGE_W / 2 + CAGE_WALL_OUT + 0.05;
export const BROKER_BOX_HZ = CAGE_D / 2 + CAGE_WALL_OUT + 0.05;
export const BROKER_BOX_H = CAGE_H + CAGE_CAP + 0.06;
/** AUDIT BROKER-CAGE C7: the ground under her is read again every this many frames (a pixel built finer moves it), and
 *  when the land under her moves - never every frame. */
export const BROKER_GROUND_EVERY = 15;
/** The one empty answer for no Broker - the host asks for the targets and the batches every frame. */
const NONE = Object.freeze([]);
/** Her body in the collider: a post a player walks into rather than through, inside her eye's box (so the ray meets
 *  the box first and she never hides herself), under its own bucket. */
export const BROKER_BUCKET = 'set7:broker';
export const BROKER_BODY_R = 0.3;
export const BROKER_BODY_H = 1.9;
/** The post's eight corners and twelve triangles, about her feet. */
export const BROKER_POST = Object.freeze((() => {
  const r = BROKER_BODY_R, h = BROKER_BODY_H;
  const positions = new Float32Array([-r, 0, -r, r, 0, -r, r, 0, r, -r, 0, r, -r, h, -r, r, h, -r, r, h, r, -r, h, r]);
  const indices = new Uint16Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
  return { positions, indices };
})());

/** BROKER-CAGE: her cage's spot in the gate pixel's frame ([east, north] metres from its south-west corner - the
 *  circle's, net/gateRite.js riteLocalOf) and the circle's bearing to its gate (scenes/riteHost.js enter's) - the day's
 *  alone. Pure. */
export function cageSpotLocal(day) {
  const [e, n] = riteLocalOf(day), [gx, gz] = gateSpotLocal(day);
  const facing = Math.atan2(gx - e, gz - n), a = facing + CAGE_TURN;
  return { x: e + Math.sin(a) * CAGE_R, z: n + Math.cos(a) * CAGE_R, facing };
}

/**
 * Where she stands for the breach at `site` (`{day, px, py}` - the omen's, systems/gateOmen.js cageSite) at `nowMs`: her
 * cage's spot carried into the scene by the pixel's translation, on the ground there, facing the gate - or null with no
 * site, outside the omen to midnight (cageStands), or where the ground answers nothing (her pixel not built). Pure.
 * @param {{day: number, px: number, py: number}|null} site
 * @param {number} nowMs
 * @param {(px: number, py: number) => number[]} pixelTranslation
 * @param {(x: number, z: number) => number} heightAt
 */
export function brokerPlace(site, nowMs, pixelTranslation, heightAt) {
  if (!site || !Number.isSafeInteger(site.day) || !cageStands(site.day, nowMs)) return null;
  const sp = cageSpotLocal(site.day), t = pixelTranslation(site.px, site.py);
  const x = t[0] + sp.x, z = t[2] + sp.z, h = heightAt(x, z);
  return Number.isFinite(h) ? { day: site.day, px: site.px, py: site.py, feet: [x, h, z], rest: sp.facing } : null;
}

/** BROKER-CAGE: would her cage, stood at feet `at` turned to `rest`, rise around a body whose feet are at `f` - the body's
 *  capsule inside its walls' reach, the heights overlapping (AUDIT SET W1's law, her post's)? Pure. */
export function cageTraps(at, rest, f) {
  if (!at || !f) return false;
  const c = Math.cos(rest), s = Math.sin(rest), dx = f[0] - at[0], dz = f[2] - at[2];
  const lx = c * dx - s * dz, lz = s * dx + c * dz, reach = CAGE_WALL_OUT + CAPSULE_RADIUS;
  return Math.abs(lx) < CAGE_W / 2 + reach && Math.abs(lz) < CAGE_D / 2 + reach && f[1] < at[1] + CAGE_H && f[1] + CAPSULE_HEIGHT > at[1] - CAGE_FOOT;
}

/** AUDIT SET W1 (2026-09-27): would her post, stood at feet `at`, rise around a body whose feet are at `f` (the motor's
 *  capsule, CAPSULE_RADIUS x CAPSULE_HEIGHT)? The post wider than a hand but narrower than the capsule, four walls
 *  pushing a body centred in it cancel out - a player standing on her spot as the gate stood whole was SEALED IN (the
 *  WBX W1 seal the horns' roots had). The post's square, the capsule's radius about it, the heights overlapping. Pure. */
export function postTraps(at, f) {
  if (!at || !f) return false;
  const reach = BROKER_BODY_R + CAPSULE_RADIUS;
  return Math.abs(f[0] - at[0]) < reach && Math.abs(f[2] - at[2]) < reach && f[1] < at[1] + BROKER_BODY_H && f[1] + CAPSULE_HEIGHT > at[1];
}

/** The yaw she turns toward this frame: to feet within BROKER_NOTICE_M, else her rest (out of the gate). Pure. */
export function brokerFacing(at, rest, feet) {
  if (!feet) return rest;
  const dx = feet[0] - at[0], dz = feet[2] - at[2];
  const d = Math.hypot(dx, dz);
  return d > 1e-6 && d <= BROKER_NOTICE_M ? Math.atan2(dx, dz) : rest;
}

/** One step of a turn from `yaw` toward `want`, the short way round, at most `rate * dt`. Pure. */
export function turnToward(yaw, want, dt, rate = BROKER_TURN_RATE) {
  let d = (want - yaw) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  const step = rate * Math.max(0, dt);
  return Math.abs(d) <= step ? want : yaw + Math.sign(d) * step;
}

/**
 * @param {{
 *   renderer?: any, getTexture?: ((archive: number) => Promise<any>)|null,
 *   uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null,
 *   site: () => ({day: number, px: number, py: number}|null), pixelTranslation: (px: number, py: number, out?: number[]) => number[],
 *   heightAt: (x: number, z: number) => number, now?: () => number, freed?: (day: number, px: number, py: number) => boolean,
 *   freedAt?: (day: number, px: number, py: number) => number,
 *   feet?: () => (number[]|null), cam?: () => (number[]|null),
 *   say?: (text: string) => void, open?: () => void, gone?: () => boolean, collider?: () => any,
 * }} deps  `site` the omen's breach (systems/gateOmen.js cageSite); `freed` whether every one of its faithful fell
 *   (scenes/riteHost.js isCleared) and `freedAt` when the hub said it (riteHost.js clearedAt; NaN unknown); `gone` is
 *   the host's: shut a window open on her, and say whether one was
 */
export function createSigilBroker({
  renderer = null, getTexture = null, uploadRecordFrame = null, site, pixelTranslation, heightAt, now = () => Date.now(), freed = () => false, freedAt = () => NaN,
  feet = () => null, cam = () => null, say = () => {}, open = () => {}, gone = () => false, collider = () => null,
}) {
  /** Where she stands this frame, or null: AUDIT SET W5, a new record only when she moves (a recentre, her pixel built,
   *  a new day), never one every frame - and her cage's spot, made once a day; AUDIT BROKER-CAGE C7: the ground under
   *  her, read when the land moves under her and every BROKER_GROUND_EVERY frames, never every frame. */
  let at = null, spot = null, spotDay = null;
  const T3 = [0, 0, 0];
  let groundY = NaN, groundAt = [NaN, NaN, NaN, NaN], frameN = 0;
  /** Where her post stands in the collider (her feet when it was stood), or null. */
  let postAt = null;
  /** BROKER-CAGE: her cage - whether its door is open for her day, when it began to swing (-Infinity: open when first
   *  seen), when she was first seen shut; its walls in the collider ([x, y, z, rest] when stood) and its door's slab; the
   *  meshes, made once, and their matrices, made when she moves or the door swings. */
  let doorOpen = false, openedAt = -Infinity, shutSince = null, cageDay = null;
  let cageAt = null, cageMat = null, doorUp = false;
  let cageMesh = null, doorMesh = null, meshTried = false, artUp = false;
  /** AUDIT BROKER-CAGE G6: the ground under her cage - how deep its bars go and how high its door's sill stands - read
   *  when she moves, and the meshes made again when either moves (shapeOf). */
  let shapeAt = null, foot = CAGE_FOOT, sill = CAGE_SILL, meshFoot = NaN, meshSill = NaN;
  let drawnAt = null, drawMat = null, doorAngle = NaN, doorMat = null;
  let yaw = null;
  /** Her sprite: loading, loaded, or failed (a failed load leaves her unseen - her box and her window stay). */
  let body = null, loading = null;
  let batch = null;
  /** AUDIT WBX W6's lesson: the box made when she moves, not every frame the eye asks - compared by number (AUDIT SET
   *  W5: a key string built on every ask was the allocation the lesson was about). */
  let box = null;
  const boxAt = [NaN, NaN, NaN, NaN, NaN];
  const _batches = [];
  /** AUDIT SET W5: her idle act, one record for every frame, and each (record, frame)'s two keys made once. */
  const act = /** @type {any} */ ({ act: 'idle', anims: IDLE_ANIMS, frame: 0, loop: true });
  const frameKeys = new Map();
  const keysOf = (archive, record, frame) => {
    const k = record * 256 + frame;
    let e = frameKeys.get(k);
    if (!e) { const rkey = `${record}#${frame}`; e = { rkey, texKey: `${archive}_${rkey}` }; frameKeys.set(k, e); }
    return e;
  };

  /** A texture her frames can be read off: every idle record there, with a frame. A file that would not parse is
   *  cached all the same (the pipeline keeps what `load` left - a header and no records), and reading a frame count
   *  off it throws: she is unseen, never a throw in the frame. */
  const readable = (tex) => {
    try { return !!tex && IDLE_ANIMS.every((a) => tex.getFrameCount(a.record) > 0); } catch { return false; }
  };
  function loadBody() {
    if (body || loading || !getTexture || !uploadRecordFrame || !renderer?.createBillboardBatch) return;
    const archive = ENEMY_BASICS[BROKER_MOBILE]?.maleTexture;
    if (!archive) return;
    loading = Promise.resolve().then(() => getTexture(archive)).then((tex) => {
      body = readable(tex) ? { tex, archive } : { failed: true };
      if (body.failed) console.warn(`[broker] her sprite (archive ${archive}) would not load`);
    }, (e) => { body = { failed: true }; console.warn('[broker] her sprite', e?.message ?? e); });
  }
  /** Her frame: the idle record her yaw and the eye choose, uploaded when first seen, her billboard sized to it. */
  function drawBody() {
    if (!at || !body?.tex) return false;
    const eye = cam() ?? at.feet;
    // the court's reader of an act (world/gateBoss.js bossFrame) - typed for his acts, read here for the one field set an
    // idle act carries (its anims, its frame, its loop); `atk` and `t` are his alone and bossFrame never reads them
    act.frame = Math.floor((now() / 1000) * IDLE_ANIM_SPEED);
    const fr = bossFrame(act, yaw ?? at.rest, at.feet, eye, (rec) => body.tex.getFrameCount?.(rec) ?? 1);
    const { rkey, texKey } = keysOf(body.archive, fr.record, fr.frame);
    if (!renderer.textures?.has?.(texKey)) uploadRecordFrame(body.archive, fr.record, fr.frame);
    const sz = mobileBillboardSize(body.tex, fr.record);   // a shared, cached object: read, never written
    if (!batch) {
      batch = renderer.createBillboardBatch(body.archive, rkey, { w: sz.w, h: sz.h }, [[0, 0, 0]]);
      batch.origin = [0, 0, 0];
      batch.size = { w: sz.w, h: sz.h };   // hers alone, written in place (the renderer reads it by value, per draw)
    }
    batch.record = rkey;
    batch.size.w = fr.flip ? -sz.w : sz.w; batch.size.h = sz.h;
    if (batch.bounds) batch.bounds[3] = Math.hypot(sz.w, sz.h) * 0.5;
    batch.origin[0] = at.feet[0]; batch.origin[1] = at.feet[1]; batch.origin[2] = at.feet[2];   // a walker stands on her feet
    return true;
  }
  /** Her post where she stands, restood when she moves (a floating-origin recentre moves the land) and taken down when
   *  she goes - the gate's own law (gatePool.js standCollider). AUDIT SET W1: and HELD BACK while a body stands where it
   *  would rise (`postTraps`), asked again every frame - they walk off, and it stands. */
  function standPost() {
    const col = collider();
    if (!col?.addMesh) return;
    const f = at?.feet ?? null;
    if (postAt && f && postAt[0] === f[0] && postAt[1] === f[1] && postAt[2] === f[2]) return;   // standing where she stands
    if (postAt) { col.removeBucket?.(BROKER_BUCKET); postAt = null; }
    if (!f || postTraps(f, feet())) return;
    col.addMesh(BROKER_BUCKET, BROKER_POST.positions, BROKER_POST.indices, trs(f[0], f[1], f[2], 0, 0, 0));
    postAt = [f[0], f[1], f[2]];
  }
  /** BROKER-CAGE: her cage's walls where she stands, on her post's law - restood when she moves, taken down when she goes,
   *  held back while a body stands inside them (`cageTraps`); and its door's slab up while it is shut, down once open. */
  function standCage() {
    const col = collider();
    if (!col?.addMesh) return;
    const f = at?.feet ?? null;
    if (!(cageAt && f && cageAt[0] === f[0] && cageAt[1] === f[1] && cageAt[2] === f[2] && cageAt[3] === at.rest)) {
      if (cageAt) { col.removeBucket?.(BROKER_CAGE_BUCKET); cageAt = null; }
      if (doorUp) { col.removeBucket?.(BROKER_DOOR_BUCKET); doorUp = false; }
      if (!f || cageTraps(f, at.rest, feet())) return;
      cageMat = trs(f[0], f[1], f[2], 0, (at.rest * 180) / Math.PI, 0);
      col.addMesh(BROKER_CAGE_BUCKET, CAGE_WALLS.positions, CAGE_WALLS.indices, cageMat);
      cageAt = [f[0], f[1], f[2], at.rest];
    }
    if (!doorOpen && !doorUp) { col.addMesh(BROKER_DOOR_BUCKET, CAGE_DOOR_WALL.positions, CAGE_DOOR_WALL.indices, cageMat); doorUp = true; }
    else if (doorOpen && doorUp) { col.removeBucket?.(BROKER_DOOR_BUCKET); doorUp = false; }
  }
  /** BROKER-CAGE: her cage this frame - a new day's shut; open once every one of the faithful fell, swinging from the
   *  frame it was seen to (open already when first seen, or freed within BROKER_SHUT_SEEN_MS of first seen - a page
   *  opened before the hub's word came), and said to a player near her who saw it shut. */
  function tendCage(t) {
    if (cageDay !== at.day) { cageDay = at.day; doorOpen = false; openedAt = -Infinity; shutSince = null; }
    if (doorOpen) return;
    if (!freed(at.day, at.px, at.py)) { shutSince ??= t; return; }
    doorOpen = true;
    // AUDIT BROKER-CAGE C8: seen shut long enough - and shut when it opened: the hub's word of a cage opened before this
    // page first saw it (a hello's word late behind the omen's own fallback) neither swings nor speaks
    const when = freedAt(at.day, at.px, at.py);
    const saw = shutSince != null && t - shutSince >= BROKER_SHUT_SEEN_MS && !(when < shutSince);
    openedAt = saw ? t : -Infinity;
    const f = feet();
    if (saw && f && Math.hypot(f[0] - at.feet[0], f[2] - at.feet[2]) <= BROKER_FREED_SAY_M) say(BROKER_TEXT.freed);
  }
  /** The door's swing now, radians about its hinge: shut 0, open CAGE_DOOR_OPEN, eased between over CAGE_DOOR_MS. */
  function swing(t) {
    if (!doorOpen) return 0;
    if (t < openedAt) openedAt = -Infinity;   // AUDIT BROKER-CAGE C11: the shared clock stepped back mid-swing - open, never drawn shut
    const k = Math.min(1, (t - openedAt) / CAGE_DOOR_MS);
    return k > 0 ? CAGE_DOOR_OPEN * k * k * (3 - 2 * k) : 0;
  }
  /** Her cage's meshes, made once (the gate's own art uploaded with them, as the circle's is - riteHost.js ensureMesh). A
   *  renderer that will not take them leaves the cage unseen, never a throw in the frame. */
  function ensureCageMesh() {
    if (!renderer?.createMesh) return;
    if (meshTried && foot === meshFoot && sill === meshSill) return;
    meshTried = true; meshFoot = foot; meshSill = sill;
    try {
      if (!artUp) { for (const [rec, art] of gateArt()) { renderer.uploadTexture?.(GATE_ARCHIVE, rec, art.albedo); renderer.uploadEmissionTexture?.(GATE_ARCHIVE, rec, art.emission); } artUp = true; }
      const nextCage = renderer.createMesh(buildCageModel({ foot })), nextDoor = renderer.createMesh(buildCageDoor({ sill }));
      if (cageMesh) renderer.destroyMesh?.(cageMesh);
      if (doorMesh) renderer.destroyMesh?.(doorMesh);
      cageMesh = nextCage; doorMesh = nextDoor;
    } catch (e) { console.warn('[broker] her cage would not build', e?.message ?? e); }
  }
  /** AUDIT BROKER-CAGE G6: THE GROUND UNDER HER CAGE, read when she moves - its bars down to the lowest ground at its
   *  corners and CAGE_FOOT_UNDER beyond (never less than CAGE_FOOT), its door's sill over the highest ground its leaf
   *  sweeps across (riteModel.js boxCorners' law); rounded to a centimetre, so a ground that barely moves makes nothing
   *  again. Ground that answers nothing reads as hers. */
  function shapeOf() {
    if (shapeAt === at) return;
    shapeAt = at;
    const c = Math.cos(at.rest), s = Math.sin(at.rest), f = at.feet;
    const rise = (lx, lz) => { const h = heightAt(f[0] + c * lx + s * lz, f[2] - s * lx + c * lz); return Number.isFinite(h) ? h - f[1] : 0; };
    const hx = CAGE_W / 2 + CAGE_POST / 2, hz = CAGE_D / 2 + CAGE_POST / 2;
    const low = Math.min(rise(-hx, -hz), rise(hx, -hz), rise(hx, hz), rise(-hx, hz));
    const [jx, jz] = cageHinge();
    let high = -Infinity;
    for (let i = 0; i <= 4; i++) {
      const a = (CAGE_DOOR_OPEN * i) / 4, ca = Math.cos(a), sa = Math.sin(a);
      for (const u of [CAGE_LEAF_W / 3, (2 * CAGE_LEAF_W) / 3, CAGE_LEAF_W]) high = Math.max(high, rise(jx + ca * u, jz - sa * u));
    }
    foot = Math.round(Math.max(CAGE_FOOT, CAGE_FOOT_UNDER - low) * 100) / 100;
    sill = Math.round(Math.min(CAGE_SILL_MAX, Math.max(CAGE_SILL, high + CAGE_SILL_OVER)) * 100) / 100;
  }
  /** The cage's matrix where she stands, and the door's about its hinge - made when she moves or the door swings. */
  function cageMatrices(t) {
    if (drawnAt !== at) {
      drawnAt = at; doorAngle = NaN;
      drawMat = trs(at.feet[0], at.feet[1], at.feet[2], 0, (at.rest * 180) / Math.PI, 0);
    }
    const a = swing(t);
    if (a !== doorAngle) {
      doorAngle = a;
      const [hx, hz] = cageHinge(), c = Math.cos(at.rest), s = Math.sin(at.rest);
      doorMat = trs(at.feet[0] + c * hx + s * hz, at.feet[1], at.feet[2] - s * hx + c * hz, 0, ((at.rest + a) * 180) / Math.PI, 0);
    }
  }
  const keyOf = () => (at ? `broker:${at.day}` : null);
  const ours = (key) => typeof key === 'string' && key.startsWith('broker:') && key === keyOf();

  return {
    /** One frame: where she stands, her cage, her turn, her frame - and, midnight taking her from under an open window,
     *  the window shut. AUDIT SET W3: only then - her pixel rebuilt under her (a season's turn, a late World of
     *  Daggerfall sweep) answers no ground for a frame or two, and that is no reason to shut a sale. */
    frame(dt = 0) {
      const was = at, t = now();
      frameN++;
      const s = site?.() ?? null;
      const due = !!s && Number.isSafeInteger(s.day) && cageStands(s.day, t);
      if (!due) at = null;
      else {
        if (spotDay !== s.day) { spot = cageSpotLocal(s.day); spotDay = s.day; }
        const tr = pixelTranslation(s.px, s.py, T3), x = tr[0] + spot.x, z = tr[2] + spot.z;
        if (x !== groundAt[0] || z !== groundAt[1] || s.day !== groundAt[2] || !Number.isFinite(groundY) || frameN - groundAt[3] >= BROKER_GROUND_EVERY) {
          groundY = heightAt(x, z); groundAt[0] = x; groundAt[1] = z; groundAt[2] = s.day; groundAt[3] = frameN;
        }
        const h = groundY;
        if (!Number.isFinite(h)) at = null;
        else if (!at || at.day !== s.day || at.px !== s.px || at.py !== s.py || at.feet[0] !== x || at.feet[1] !== h || at.feet[2] !== z || at.rest !== spot.facing) {
          at = { day: s.day, px: s.px, py: s.py, feet: [x, h, z], rest: spot.facing };
        }
      }
      if (at) tendCage(t);
      standPost();
      standCage();
      // midnight took her - or (AUDIT BROKER-CAGE C12) a page asleep across it woke on the next day's cage: a window open
      // on yesterday's Broker is shut all the same
      if (was && (!due || s.day !== was.day) && gone()) say(BROKER_TEXT.gone);
      if (!at) { yaw = null; return null; }
      shapeOf();
      loadBody();
      ensureCageMesh();
      cageMatrices(t);
      yaw = turnToward(yaw ?? at.rest, brokerFacing(at.feet, at.rest, feet()), dt);
      drawBody();
      return at;
    },
    /** Her billboard, for the host's flats. */
    batches() {
      _batches.length = 0;
      if (at && batch && body?.tex) _batches.push(batch);
      return _batches;
    },
    /** BROKER-CAGE: her cage and its door, in the host's world pass. Answers how many it drew. */
    draw(r = renderer) {
      if (!at || !cageMesh || !drawMat || !r?.drawMesh) return 0;
      r.drawMesh(cageMesh, drawMat, null);
      if (doorMesh && doorMat) { r.drawMesh(doorMesh, doorMat, null); return 2; }
      return 1;
    },
    /** The eye's box - BROKER-CAGE: her cage's own, turned with it (BROKER_BOX_HX), its axis-aligned bounds beside it
     *  (the pick's own test of an eye inside); a surface of its own (her walls, her post), so a press from her open
     *  doorway meets her. */
    targets() {
      if (!at) return NONE;
      const f = at.feet;
      if (!box || boxAt[0] !== f[0] || boxAt[1] !== f[1] || boxAt[2] !== f[2] || boxAt[3] !== at.day || boxAt[4] !== at.rest) {
        boxAt[0] = f[0]; boxAt[1] = f[1]; boxAt[2] = f[2]; boxAt[3] = at.day; boxAt[4] = at.rest;
        const c = Math.abs(Math.cos(at.rest)), sn = Math.abs(Math.sin(at.rest));
        const hw = BROKER_BOX_HX * c + BROKER_BOX_HZ * sn, hd = BROKER_BOX_HX * sn + BROKER_BOX_HZ * c;
        box = [{
          key: `broker:${at.day}`, aabb: { min: [f[0] - hw, f[1], f[2] - hd], max: [f[0] + hw, f[1] + BROKER_BOX_H, f[2] + hd] },
          obb: { m: trs(f[0], f[1], f[2], 0, (at.rest * 180) / Math.PI, 0), box: [-BROKER_BOX_HX, 0, -BROKER_BOX_HZ, BROKER_BOX_HX, BROKER_BOX_H, BROKER_BOX_HZ] },
          distance: RAY_DISTANCE, reach: BROKER_REACH, noSurface: false,
        }];
      }
      return box;
    },
    /** WORLD-HOVER: her name, and what she deals in - BROKER-CAGE: or who holds her. */
    hoverName(key) { return ours(key) ? { title: BROKER_TEXT.name, subs: [doorOpen ? BROKER_TEXT.trade : BROKER_TEXT.caged] } : null; },
    /** A press on her: Info names her, Steal is watched, anything else opens her window - BROKER-CAGE: once she is free;
     *  caged, it says what frees her, or after the opening that she stays caged tonight. */
    activate(key, mode = 'grab') {
      if (!ours(key)) return false;
      if (mode === 'info') say(BROKER_TEXT.info);
      else if (mode === 'steal') say(BROKER_TEXT.steal);
      else if (!doorOpen) say(now() < riteWindow(at.day).to + RITE_GRACE_MS ? BROKER_TEXT.held : BROKER_TEXT.lost);   // AUDIT BROKER-CAGE C13: the relay hears the last fall RITE_GRACE_MS past the opening
      else open();
      return true;
    },
    /** Whether she stands free now - the sale asks, so a window left open on her as midnight took her sells nothing. */
    stands: () => !!at && doorOpen,
    /** BROKER-CAGE: whether she stands caged now. */
    caged: () => !!at && !doorOpen,
    /** For the tests and the probes. */
    state: () => ({ at, yaw, body: body ? (body.tex ? 'loaded' : 'failed') : (loading ? 'loading' : null), batch: !!batch, post: postAt !== null, caged: !!at && !doorOpen, door: doorOpen ? swing(now()) : 0, cage: cageAt !== null, doorUp, mesh: !!cageMesh, foot, sill, matrices: { cage: drawMat, door: doorMat } }),
    /** A transition takes her post and her cage down: she is stood again by the next frame that finds her. */
    destroyAll() {
      const col = collider();
      col?.removeBucket?.(BROKER_BUCKET);
      col?.removeBucket?.(BROKER_CAGE_BUCKET);
      col?.removeBucket?.(BROKER_DOOR_BUCKET);
      postAt = null; cageAt = null; doorUp = false; at = null; yaw = null;
    },
  };
}
