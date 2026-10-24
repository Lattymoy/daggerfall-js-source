// @ts-check
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md sections 5-8): THE SHIP'S FIGHTS ON THIS SCREEN - the constructs and
// the Tonal Warden as the room says them (net/ketch/ketchLink.js's fold), every blow on the floor it lands on, every blow
// judged on MY OWN FEET (co-op's law - the gate's court and the Spire's halls alike: net/eliteGates/egShape.js
// egBlowVerdict), and my blows out to the room (`hit` - the relay's caps decide what lands):
//
//   THE BODIES - each construct Daggerfall's own sprite or Daggerfall Enemy Expansion's, at its size (KT_LOOKS): the
//     Dwarven Sphere and the Sentry the Expansion's Centurion Sphere (the Sentry larger, verdigris-washed), the Spider
//     Daggerfall's giant spider washed in brass, the Hammer Warden the Expansion's Iron Golem in brass, the Watch-Captain
//     its Steam Centurion; THE TONAL WARDEN Daggerfall's Iron Atronach grown to KT_WARDEN_LOOK's presence and dyed
//     Dwarven the Daggerfall way (KETCH-LOOK KL2: ktWardenDye - until its own sheets) - each rising (a sphere dropping from the rigging), walking, winding up (its glint - TELL2), striking,
//     flinching, falling; heard by its own clips (world/gate/gateBoss.js hostCue); offered its Morrowind body where its
//     mobile has one (MWNPC10 - the Centurions'). Bodies my blows meet through the dungeon host's gate seams (routed here
//     on a ship - scenes/ketch/ketchDeckHost.js): the constructs as the gate's host, the Warden as its boss, the forks as
//     its crystals, each on a stand-in (world/gate/gateBoss.js).
//   THE BLOWS - each FULL shape stamp drawn by the telegraph pass (render/gate/gateTelegraph.js) on its own floor (the
//     waist, the gun deck, the hold, the bridge - KT_TELEGRAPH_FLOORS), in its element's colour, its fill the wind-up; the
//     gun deck's hammers and steam and the hold's arc-coils drawn the same off the shared clock (net/ketch/ketchDeck.js
//     hazardsBetween - the relay judges the same). Each judged once on my feet at its landing on its storey: an element's
//     through my saving throw, a jumped one (the Tonal Wave) only while I stand on the ground; the whole bridge's (the
//     Discord, the Keel-Song while its forks stand, the turn west) however late (the link's owed list).
//
// Not a DFU member. Ledger A (KETCH).
import { HIT_KINDS } from '../../net/gate/gateBrain.js';
import { strikeDamage, savedShare } from '../../net/gate/gateStrike.js';
import { bossStandIn, crystalStandIn, hostStandIn, bossFrame, hostCue, gateHitFlash, BOSS_CUES } from '../../world/gate/gateBoss.js';
import { wordShare } from '../../combat/healthShare.js';
import { setBatchHitFlash, setBatchGlint } from '../../systems/hitFlash.js';
import { GateTelegraphRenderer, telegraphPrograms, TELEGRAPH_STYLE, TELEGRAPH_EDGE_DAGON, TELEGRAPH_EDGE, TELEGRAPH_POOL } from '../../render/gate/gateTelegraph.js';
import { compiledPass } from '../../render/glProgram.js';
import { SdHaloRenderer, SD_HALO_PROGRAMS, SD_HALO_GAIN } from '../../render/superDungeon/sdHalo.js';   // KETCH-LOOK KL3: the classic set's bloom
import { fillStamp } from '../eliteGates/egFight.js';
import { egBlowVerdict } from '../../net/eliteGates/egShape.js';
import { ENEMY_BASICS } from '../../characters/enemy/enemyBasics.js';
import { stateAnims, PRIMARY_ATTACK_ANIM_SPEED, HURT_ANIM_SPEED } from '../../characters/mobile/mobileUnit.js';
import { mobileBillboardSize } from '../../world/rmbFlats.js';
import { creatureLook } from '../../characters/creatureBodies.js';
import { rosterActor } from '../../characters/rosterBodies.js';
import { KT_KIND_BY_K } from '../../net/ketch/ketchConstructs.js';
import { KW_ID, KW_FORK_ID0, KW_BODY, KW_FORK, KW_BLOWS, KW_FORKS_CLOSE_MS } from '../../net/ketch/ketchWarden.js';
import { KT_BRIDGE, KT_GALLERY, KT_HOLD, deckToDungeon, dungeonToDeck, hazardsBetween, deckZoneAt, onBridge } from '../../net/ketch/ketchDeck.js';
import { ktBodyAt, ktBlowDone } from '../../net/ketch/ketchLink.js';
import { ketchKindName } from '../../systems/ketch/ketchWords.js';
import { changeDyeBitmap, DYE_COLORS, DYE_TARGETS } from '../../characters/dyes.js';

/** THE CONSTRUCTS' LOOKS by kind: a mobile (its sprite, its clips - characters/enemy/enemyBasics.js), its size, its wash. */
export const KT_LOOKS = Object.freeze({
  sphere: Object.freeze({ mobile: 289, scale: 0.85, tint: null, drop: true }),
  sentry: Object.freeze({ mobile: 289, scale: 1.15, tint: Object.freeze([0.74, 0.96, 0.86]), drop: false }),
  spider: Object.freeze({ mobile: 6, scale: 0.85, tint: Object.freeze([1.0, 0.76, 0.42]), drop: false }),
  warden: Object.freeze({ mobile: 270, scale: 1.35, tint: Object.freeze([1.0, 0.84, 0.52]), drop: false }),
  captain: Object.freeze({ mobile: 290, scale: 1.4, tint: null, drop: false }),
});
/** THE TONAL WARDEN'S LOOK: Daggerfall's Iron Atronach at its presence, its metal Dwarven (`dye` - its frames' own indices
 *  dyed at upload, in place of the multiply wash the plan retires: KETCH-LOOK KL2). */
export const KT_WARDEN_LOOK = Object.freeze({ mobile: 36, scale: 2.6, tint: null, dye: (bmp) => ktWardenDye(bmp), get name() { return ketchKindName('tonal'); } });
/** THE INTERIM WARDEN'S DARKS (KETCH-LOOK KL2, Sky-Ketch-Look.md section 10, until its baked sheets land - KL15): the Ketch's
 *  table over the Iron Atronach's near-black greys (0xD8-0xDB), each to the Dwarven ramp's darks - its shadows olive, not
 *  iron. The darkest four (0xDC-0xDF, its outline) keep their own: they are her steel's too (world/ketch/ketchLook.js
 *  KT_PAL.steel). */
export const KT_WARDEN_DARKS = Object.freeze({ 216: 158, 217: 159, 218: 159, 219: 95 });
/**
 * THE IRON ATRONACH DYED DWARVEN, the Daggerfall way: DFU's ChangeDye with the Dwarven table over its 0x70 metal band
 * (characters/dyes.js changeDyeBitmap - every Dwarven blade and cuirass in the Iliac Bay is the same band), then
 * KT_WARDEN_DARKS over its darkest greys - an indexed frame in, a fresh one out, the player's own TEXTURE.291 never kept.
 * @param {{ width: number, height: number, data: Uint8Array }} bitmap
 */
export function ktWardenDye(bitmap) {
  const dyed = changeDyeBitmap(bitmap, DYE_COLORS.Dwarven, DYE_TARGETS.WeaponsAndArmor);
  const data = dyed === bitmap ? new Uint8Array(bitmap.data) : dyed.data;
  for (let i = 0; i < data.length; i++) { const m = KT_WARDEN_DARKS[data[i]]; if (m !== undefined) data[i] = m; }
  return { ...bitmap, data };
}
/** How long a body's fall plays, how far a sphere drops from the rigging as it rises (m), how long a blow of mine flinches. */
export const KT_FALL_MS = 1100;
export const KT_DROP_M = 5;
export const KT_FLINCH_MS = 350;
/** A landing seen later than this is neither heard nor judged (the gate's STRIKE_LATE_MS) - the whole bridge's aside. */
export const KT_LATE_MS = 400;
/** A body stands on a blow's storey within this of its floor's height (the relay's KT_STOREY_BAND). */
export const KT_STOREY_M = 2.5;
/** THE FLOORS the telegraphs lie on: each its height (deck y), its court's centre (deck x, z) and reach. */
export const KT_TELEGRAPH_FLOORS = Object.freeze({
  waist: Object.freeze({ y: 0, r: 36, court: Object.freeze([0, 32]) }),
  gallery: Object.freeze({ y: KT_GALLERY.y, r: 46, court: Object.freeze([0, 90]) }),
  hold: Object.freeze({ y: KT_HOLD.y, r: 48, court: Object.freeze([0, 92]) }),
  bridge: Object.freeze({ y: KT_BRIDGE.y, r: KT_BRIDGE.r + 2, court: Object.freeze([KT_BRIDGE.x, KT_BRIDGE.z]) }),
});
/** The floor a blow at deck height `y` and along-keel `z` lies on. */
export const ktFloorOf = (y, z) => (y < KT_GALLERY.y - 3 ? 'hold' : y < -3 ? 'gallery' : z > 150 ? 'bridge' : 'waist');
/** The colours of a blow by its element (the Spire's). */
const COLOR_OF = Object.freeze({ fire: [1.0, 0.45, 0.1], frost: [0.62, 0.78, 0.82], shock: [0.6, 0.7, 1.0], poison: [0.55, 0.85, 0.3], null: [1.0, 0.3, 0.2] });
const STYLE_OF = Object.freeze({ fire: TELEGRAPH_STYLE.fire, frost: TELEGRAPH_STYLE.frost, shock: TELEGRAPH_STYLE.shock, poison: TELEGRAPH_STYLE.poison });
/** A blow's shape lingers this long after its span (ms), fading. */
const LINGER_MS = 300;
const NONE = Object.freeze([]);

/**
 * WHAT A CONSTRUCT IS DOING at `now`, as its mobile's animation (characters/mobile/mobileUnit.js stateAnims): falling, rising
 * (a sphere dropping from the rigging, the rest climbing out of the deck), asleep, winding up, striking, flinching, walking,
 * idle. `lift` how far over (or, negative, under) its floor it stands. Pure.
 */
export function ktBodyAct(B, now, mobile, blow, look = null) {
  const tab = (state) => stateAnims(state, mobile, !!ENEMY_BASICS[mobile]?.hasIdle, false, false, true, false, false);
  if (!(B.h > 0)) {
    const since = now - (B.down || now);
    return since >= KT_FALL_MS ? { act: 'gone', anims: tab('hurt'), frame: 0, loop: false, lift: 0 } : { act: 'fall', anims: tab('hurt'), frame: Math.floor((since / KT_FALL_MS) * 4), loop: false, lift: since > KT_FALL_MS * 0.6 ? -((since - KT_FALL_MS * 0.6) / 1000) * 2 : 0 };
  }
  if (now < B.up) { const k = Math.min(1, (B.up - now) / 1200); return { act: 'rise', anims: tab('idle'), frame: 0, loop: true, lift: look?.drop ? KT_DROP_M * k * k : -2 * k }; }
  if (!B.wake) return { act: 'asleep', anims: tab('idle'), frame: 0, loop: false, lift: 0 };
  if (blow && now < blow.at) { const t = (now - (blow.at - blow.wu)) / Math.max(1, blow.wu); return { act: 'windup', anims: tab('attack'), frame: t >= 0.5 ? 1 : 0, loop: false, lift: 0, k: t }; }
  if (blow && now - blow.at < 600) return { act: 'strike', anims: tab('attack'), frame: 2 + Math.floor(((now - blow.at) / 1000) * PRIMARY_ATTACK_ANIM_SPEED), loop: false, lift: 0 };
  if (now - (B.hurtAt ?? -Infinity) < KT_FLINCH_MS) return { act: 'flinch', anims: tab('hurt'), frame: Math.floor(((now - B.hurtAt) / 1000) * HURT_ANIM_SPEED), loop: false, lift: 0 };
  const m = B.mv;
  if (m && m.v > 0) { const p = ktBodyAt(B, now); if (Math.hypot(m.tx - p[0], m.tz - p[1]) > 0.05) { const T = tab('move'); return { act: 'walk', anims: T, frame: Math.floor((now / 1000) * (T[0]?.fps ?? 6)), loop: true, lift: 0 }; } }
  const T = tab('idle');
  return { act: 'idle', anims: T, frame: Math.floor((now / 1000) * (T[0]?.fps ?? 4)), loop: true, lift: 0 };
}

/**
 * @param {{
 *   renderer?: any, gl?: any, getTexture?: ((archive: number) => Promise<any>)|null, uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null,
 *   audio?: any, link: any, now: () => number, cam?: () => number[]|null, feet?: () => number[]|null, grounded?: () => boolean,
 *   player?: () => any, save?: (e: any, el: string) => number, strike?: (dmg: number, how: any) => void, say?: (text: string) => void,
 *   sendHit?: (hit: { o: number, d: number, r: number, q: number }) => boolean, onStruck?: () => void,
 * }} deps
 *   `link` the ship's (net/ketch/ketchLink.js); `now` the relay's clock; `feet` my feet (the dungeon's frame, null off the ship);
 *   `strike` the dungeon context's door a blow on me lands through; `save` my saving throw against an element; `sendHit` a
 *   blow of mine out to the room; `onStruck` any blow or hazard met me (the client lets my cell go).
 */
export function createKetchFight({ renderer = null, gl = null, getTexture = null, uploadRecordFrame = null, audio = null, link, now, cam = () => null, feet = () => null, grounded = () => true, player = () => null, save = () => 100, strike = () => {}, say = () => {}, sendHit = () => false, onStruck = () => {} }) {
  const O = deckToDungeon(0, 0, 0);
  const bodies = new Map(), textures = new Map();
  const judged = new Set(), heard = new Set();
  const _batches = [], _targets = [], _forkTargets = [], _lights = [], _shapes = [], _slots = [];
  let warden = null, wardenStandIn = null, forkStandIn = null, blowSeq = 0;
  /** AUDIT SHIP 4: ONE SWING ONE SEQUENCE (gateCourt.js blowQ) - the bodies a blow meets in a frame share it; a body met again is a new one */
  const blowMet = new Set();
  const blowQ = (who) => { if (!blowMet.size || blowMet.has(who)) { blowSeq++; blowMet.clear(); } blowMet.add(who); return blowSeq; };
  /** the hazards in view this frame (their landings near), and those landed and not yet judged */
  const hazards = new Map();
  const teleDoor = gl ? compiledPass(gl, telegraphPrograms(false), () => new GateTelegraphRenderer(gl), (e) => console.warn('[kt] the telegraph would not build', e?.message ?? e)) : null;
  let tele = null;
  // KETCH-LOOK KL3: the deck's halos on the classic set (scenes/ketch/ketchDeckHost.js ketchHalosInto - its lamps and lit
  // things, handed each frame), drawn with the telegraphs; the pass built a few frames late, once its program is done
  const haloDoor = gl ? compiledPass(gl, SD_HALO_PROGRAMS, () => new SdHaloRenderer(gl), (e) => console.warn('[kt] the halos would not build', e?.message ?? e)) : null;
  let halo = null, _halos = /** @type {ArrayLike<any>} */ (Object.freeze([]));

  function play(cue, p) {
    if (!cue || !audio || !p) return;
    try { if (cue.id != null) audio.play3dId?.(cue.id, p, cue.volume, { maxDistance: cue.reach, distanceModel: 'linear', pitch: cue.pitch }); else audio.play3d?.(cue.clip, p, cue.volume, { maxDistance: cue.reach, distanceModel: 'linear', pitch: cue.pitch }); } catch { /* a sound is never the fight */ }
  }
  function texture(mobile) {
    const archive = ENEMY_BASICS[mobile]?.maleTexture;
    if (!archive || !getTexture) return null;
    const had = textures.get(archive);
    if (had && !(had instanceof Promise)) return had.failed ? null : had;
    if (!had) {
      const p = Promise.resolve().then(() => getTexture(archive)).then(
        (tex) => { textures.set(archive, tex ? { tex, archive } : { failed: true }); },
        (e) => { textures.set(archive, { failed: true }); console.warn('[kt] a construct\'s sprite', e?.message ?? e); });
      textures.set(archive, p);
    }
    return null;
  }
  function destroyBatch(b) { if (b?.batch) { renderer?.destroyBillboardBatch?.(b.batch); b.batch = null; } }
  /** One body drawn: the frame its act shows my eye, at its feet (the dungeon's frame) and its look's size, washed. */
  function draw(b, look, act, at, yaw, t, hurtAt, roomAt, glint) {
    b.act = act.act;
    const T = texture(look.mobile);
    if (!T || !renderer?.createBillboardBatch || act.act === 'gone') { b.shown = false; return; }
    const eye = cam() ?? at;
    const fr = bossFrame(act, yaw, at, eye, (rec) => T.tex.getFrameCount?.(rec) ?? 1);
    // a dyed look's frame under a key of its own (KETCH-LOOK KL2): its indices dyed, then through the player's palette
    const rkey = look.dye ? `${fr.record}#${fr.frame}~kt` : `${fr.record}#${fr.frame}`;
    if (!renderer.textures?.has?.(`${T.archive}_${rkey}`)) {
      if (look.dye && T.tex.getDFBitmap && T.tex.getColor32) renderer.uploadTexture?.(T.archive, rkey, T.tex.getColor32(look.dye(T.tex.getDFBitmap(fr.record, fr.frame)), 0));
      else uploadRecordFrame?.(T.archive, fr.record, fr.frame);
    }
    const sz = mobileBillboardSize(T.tex, fr.record), k = look.scale ?? 1;
    const size = { w: (fr.flip ? -sz.w : sz.w) * k, h: sz.h * k };
    if (!b.batch) { b.batch = renderer.createBillboardBatch(T.archive, rkey, { w: sz.w * k, h: sz.h * k }, [[0, 0, 0]]); b.batch.origin = [0, 0, 0]; }
    b.shown = true;
    setBatchHitFlash(b.batch, gateHitFlash(hurtAt, roomAt, t));
    setBatchGlint(b.batch, glint);
    if (look.tint) b.batch.tint = look.tint;
    b.batch.record = rkey;
    b.batch.size = size;
    if (b.batch.bounds) b.batch.bounds[3] = Math.hypot(sz.w, sz.h) * 0.5 * k;
    b.batch.origin[0] = at[0]; b.batch.origin[1] = at[1]; b.batch.origin[2] = at[2];
    b.feet = at;
  }
  /** My feet in the deck's frame, or null. */
  const myDeck = () => { const f = feet(); return f ? dungeonToDeck(f[0], f[1], f[2]) : null; };
  /** A blow on me landed - its share of my health and its base, through my saving throw against its element. */
  function land(bl) {
    const e = player();
    if (!e || !(e.health > 0) || !(bl.p > 0 || bl.b > 0)) return;
    const raw = strikeDamage(bl.p, e.maxHealth ?? 1, bl.b ?? 0), dmg = bl.el ? savedShare(raw, save(e, bl.el)) : raw;
    if (dmg > 0) strike(dmg, { fire: bl.el === 'fire', el: bl.el, name: bl.nm });
    onStruck();
  }
  /** Blow `bl` judged on my feet at `t` (its storey's) - landed once; answers whether it is done with. */
  function judge(key, bl, t, me) {
    if (judged.has(key)) return true;
    if (!me || t < bl.at) return false;
    if (Number.isFinite(bl.y) && Math.abs(me[1] - bl.y) > KT_STOREY_M) { if (t >= bl.at + Math.max(1, bl.sp ?? 0)) { judged.add(key); return true; } return false; }
    const v = egBlowVerdict(bl, me[0], me[2], t, KT_LATE_MS);
    if (v === 'wait') return false;
    judged.add(key);
    if (v === 'hit' && !(bl.jp && !grounded())) land(bl);
    return true;
  }
  /** A blow's shape on its floor (the telegraph pass's slot), its wind-up its fill. */
  function shapeOf(bl, t, s, aimed) {
    const sh = (_slots[_shapes.length] ??= { kind: 0, origin: [0, 0], yaw: 0, r: 0, halfArc: 0, body: 0, end: [0, 0], halfW: 0, r0: 0, r1: 0, points: [], n: 0, t: 0, flash: 0, alpha: 0, color: COLOR_OF.null, edge: TELEGRAPH_EDGE_DAGON, court: 0, style: 0, since: 0, span: 1, after: -1, runS: 0, pool: TELEGRAPH_POOL.blow, floor: 'waist' });
    if (!fillStamp(sh, s)) return null;
    const from = bl.at - bl.wu, span = Math.max(1, bl.sp ?? 0);
    sh.t = Math.max(0, Math.min(1, (t - from) / Math.max(1, bl.wu))); sh.flash = t >= bl.at ? 1 : 0;
    sh.alpha = t > bl.at + span ? 1 - (t - bl.at - span) / LINGER_MS : aimed ? 1 : 0.85;
    sh.color = COLOR_OF[bl.el] ?? COLOR_OF.null; sh.edge = bl.hz ? TELEGRAPH_EDGE : TELEGRAPH_EDGE_DAGON; sh.pool = TELEGRAPH_POOL.blow; sh.court = 0;
    sh.style = STYLE_OF[bl.el] ?? TELEGRAPH_STYLE.weight;
    sh.since = Math.max(0, (t - from) / 1000); sh.span = Math.max(0.001, bl.wu / 1000); sh.after = t >= bl.at ? (t - bl.at) / 1000 : -1; sh.runS = (bl.sp ?? 0) / 1000;
    const zc = s[0] === 'a' ? KT_BRIDGE.z : s[2] ?? KT_BRIDGE.z;
    sh.floor = ktFloorOf(Number.isFinite(bl.y) ? bl.y : 0, zc);
    _shapes.push(sh);
    return sh;
  }
  const visible = (bl, t) => t >= bl.at - bl.wu && t <= bl.at + Math.max(1, bl.sp ?? 0) + LINGER_MS;

  return {
    /** One frame of the ship's fights: every body heard, judged and drawn; every blow drawn and judged on my feet. */
    frame() {
      blowMet.clear();   // AUDIT SHIP 4: a frame ends my blow
      const s = link.state(), t = now(), me = myDeck(), e = player(), alive = !!e && e.health > 0;
      _batches.length = 0; _targets.length = 0; _forkTargets.length = 0; _lights.length = 0; _shapes.length = 0;
      if (!s || s.n < 0) { for (const b of bodies.values()) destroyBatch(b); bodies.clear(); if (warden) { destroyBatch(warden); warden = null; } return; }
      // ── THE CONSTRUCTS ──
      const live = new Set();
      for (const B of s.bodies) {
        const K = KT_KIND_BY_K[B.k], look = K ? KT_LOOKS[K.key] : null;
        if (!look) continue;
        live.add(B.id);
        let b = bodies.get(B.id);
        if (!b) { b = { id: B.id, batch: null, shown: false, hp: B.h, hurtAt: -Infinity, roomAt: -Infinity, heardHurt: -Infinity, rose: false, fell: false, wound: NaN, landed: NaN }; bodies.set(B.id, b); }
        const [x, z] = ktBodyAt(B, t), yF = B.y;
        const blow = s.blows.find((q) => q.o === B.id && !ktBlowDone(q, t)) ?? null;
        const act = ktBodyAct({ ...B, hurtAt: b.hurtAt }, t, look.mobile, blow, look);
        const at = deckToDungeon(x, yF + act.lift, z);
        // its sounds, while they are news
        if (!b.rose && t < B.up + 600) { b.rose = true; play(hostCue('rise', look.mobile), at); }
        if (B.h < b.hp) { b.roomAt = t; if (t - b.heardHurt >= 500) { b.heardHurt = t; play(hostCue('hurt', look.mobile), at); } }
        b.hp = B.h;
        if (blow && b.wound !== blow.at) { b.wound = blow.at; if (t < blow.at) play(hostCue('windup', look.mobile), at); }
        if (blow && b.landed !== blow.at && t >= blow.at) { b.landed = blow.at; if (t - blow.at <= 2000) play(hostCue('land', look.mobile), at); }
        if (!(B.h > 0) && !b.fell) { b.fell = true; if (t - (B.down || t) <= 2000) play(hostCue('fall', look.mobile), at); }
        const glint = act.act === 'windup' ? [...(COLOR_OF[blow?.el] ?? COLOR_OF.null), Math.min(1, 0.4 + (act.k ?? 0) * 0.6)] : null;
        const yaw = blow && t < blow.at + 600 ? Math.atan2((blow.s?.[0]?.[1] ?? x) - x, (blow.s?.[0]?.[2] ?? z) - z) : B.yw;
        b.yaw = yaw;
        draw(b, look, act, at, yaw, t, b.hurtAt, b.roomAt, glint);
        if (b.shown && b.batch) _batches.push(b.batch);
        if (B.h > 0 && t >= B.up) {
          const T = (b.target ??= { i: B.id, feet: [0, 0, 0], height: K.h, radius: K.r, entity: hostStandIn({ mobile: look.mobile, name: ketchKindName(K.key) }, B.id, () => wordShare(b.hp, b.target?.m)), mobile: look.mobile, name: ketchKindName(K.key), m: B.m });
          T.m = B.m;
          const f0 = deckToDungeon(x, yF, z); T.feet[0] = f0[0]; T.feet[1] = f0[1]; T.feet[2] = f0[2];
          _targets.push(T);
        }
      }
      for (const [id, b] of bodies) if (!live.has(id)) { destroyBatch(b); bodies.delete(id); }
      // ── THE TONAL WARDEN ──
      const ws = s.ws;
      if (ws && !(ws.fell && t - ws.fell.at > KT_FALL_MS * 2.5)) {
        warden ??= { id: KW_ID, batch: null, shown: false, hp: ws.h, hurtAt: -Infinity, roomAt: -Infinity, heardHurt: -Infinity, wound: NaN };
        const W = ws.wd, [x, z] = ktBodyAt(W, t);
        const blow = (ws.bl ?? []).filter((q) => q.o === KW_ID && !ktBlowDone(q, t)).sort((a, b) => a.at - b.at)[0] ?? null;
        const pseudo = { h: ws.fell ? 0 : 1, down: ws.fell?.at ?? 0, up: 0, wake: t >= ws.op ? 1 : 0, mv: W.mv, x: W.x, z: W.z, hurtAt: warden.hurtAt };
        const act = ktBodyAct(pseudo, t, KT_WARDEN_LOOK.mobile, blow, null);
        if (ws.su > t && act.act !== 'fall' && act.act !== 'gone') { act.act = 'stunned'; act.loop = false; act.frame = 3; }
        const at = deckToDungeon(x, KT_BRIDGE.y + act.lift, z);
        if (ws.h < warden.hp) { warden.roomAt = t; if (t - warden.heardHurt >= 800) { warden.heardHurt = t; play(hostCue('hurt', KT_WARDEN_LOOK.mobile), at); } }
        warden.hp = ws.h;
        if (blow && warden.wound !== blow.at) { warden.wound = blow.at; if (t < blow.at) play(BOSS_CUES.growl, at); }
        const glint = act.act === 'windup' ? [...(COLOR_OF[blow?.el] ?? COLOR_OF.null), 0.5 + 0.5 * (act.k ?? 0)] : ws.ward ? [1, 0.86, 0.5, 0.45] : null;
        const yaw = blow && t < blow.at + 600 && blow.s?.[0]?.[0] !== 'a' ? Math.atan2((blow.s[0][1] ?? x) - x, (blow.s[0][2] ?? z) - z) : W.yw;
        draw(warden, KT_WARDEN_LOOK, act, at, yaw, t, warden.hurtAt, warden.roomAt, glint);
        if (warden.shown && warden.batch) _batches.push(warden.batch);
        // its glow: gold, pale while warded, blue while stunned
        const c = ws.su > t ? [0.6, 0.7, 1.0] : ws.ward ? [1.0, 0.9, 0.6] : [1.0, 0.75, 0.35], k = 1.4 + 0.3 * Math.sin(t / 300);
        _lights.push({ x: at[0], y: at[1] + KW_BODY.h * 0.55, z: at[2], range: 14, color: [c[0] * k, c[1] * k, c[2] * k], carried: true });
      } else if (warden) { destroyBatch(warden); warden = null; }
      // ── THE BLOWS: the constructs', the Warden's, the hazards' - drawn, and judged on my feet ──
      const zone = me ? deckZoneAt(me[0], me[1], me[2]) : null;
      const blows = [...s.blows, ...(ws?.bl ?? [])];
      for (const bl of blows) {
        const whole = bl.s?.some((q) => q[0] === 'a');
        if (visible(bl, t) && !whole) for (const st of bl.s ?? []) shapeOf(bl, t, st, false);
        if (whole) continue;   // the whole bridge's are the owed list's
        const key = `${bl.o === KW_ID ? `w${ws?.fi ?? 0}` : 'c'}:${bl.i}`;
        if (alive && !judged.has(key) && t - bl.at <= KT_LATE_MS + Math.max(1, bl.sp ?? 0)) judge(key, bl, t, me);
        else if (t - bl.at > KT_LATE_MS + Math.max(1, bl.sp ?? 0)) judged.add(key);
      }
      // the whole bridge's, owed however late - on the bridge (the relay's own floor for them), the song only while its
      // forks stood at its landing
      for (const bl of link.owed()) {
        if (t < bl.at) continue;
        link.paid(bl.i);
        if (bl.a === KW_BLOWS.song.a && link.songBroken?.(bl.i)) continue;
        if (alive && me && onBridge(me[0], me[2], 1.5) && Math.abs(me[1] - KT_BRIDGE.y) <= 4) land(bl);
      }
      // the gun deck's hammers and steam, the hold's arc-coils: the landings near, drawn from their wind-up, judged once
      const sec = t / 1000, gallery = zone === 'gallery' || zone === 'landing', hold = zone === 'hold';
      if (gallery || hold) for (const hz of hazardsBetween(sec - 2, sec + 1.6, { gallery, hold })) { const key = `${hz.k}:${hz.i}:${hz.at}`; if (!hazards.has(key)) hazards.set(key, { ...hz, hz: true }); }
      for (const [key, hz] of hazards) {
        if (t > hz.at + hz.sp + LINGER_MS + 200) { hazards.delete(key); continue; }
        if (visible(hz, t)) for (const st of hz.s) shapeOf(hz, t, st, false);
        if (alive) judge(`h:${key}`, hz, t, me);
      }
      if (judged.size > 4096) { const keep = [...judged].slice(-1024); judged.clear(); for (const k of keep) judged.add(k); }
      // ── THE FORKS as bodies my blows meet ──
      const fk = ws?.fk;
      if (fk && t < fk.at - KW_FORKS_CLOSE_MS) {
        forkStandIn ??= crystalStandIn({ mobile: KT_WARDEN_LOOK.mobile }, null, () => null);
        fk.c.forEach((q, c) => { if ((q[2] ?? 0) > 0) { const f0 = deckToDungeon(q[0], KT_BRIDGE.y, q[1]); _forkTargets.push({ c, feet: f0, height: KW_FORK.h, radius: KW_FORK.r, entity: forkStandIn }); } });
      }
      void heard;
    },
    /** The bodies for the frame's billboard pass. */
    batches: () => _batches,
    /** The fight's lights (the Warden's glow). */
    lights: () => _lights,
    /** The constructs as bodies my blows meet (the gate's host seam's shape). */
    hostTargets: () => _targets,
    /** A blow of mine met construct `i`: it flinches here, the number goes out (the relay's caps decide). */
    hostHit({ i, d, r } = /** @type {any} */ ({})) {
      const b = bodies.get(i), dmg = Math.round(d);
      if (!b || !(dmg >= 1) || !Object.values(HIT_KINDS).includes(r)) return false;
      b.hurtAt = now();
      return !!sendHit({ o: i, d: dmg, r, q: blowQ(i) });
    },
    /** THE TONAL WARDEN as a body my blows meet, or null (no fight, fallen) - the gate's boss seam's shape. */
    bossTarget() {
      const s = link.state(), ws = s?.ws, t = now();
      if (!ws || ws.fell || ws.lost || !link.joined()) return null;
      wardenStandIn ??= bossStandIn({ mobile: KT_WARDEN_LOOK.mobile }, KT_WARDEN_LOOK.name, () => { const q = link.state()?.ws; return wordShare(q?.h, q?.m); });
      const [x, z] = ktBodyAt(ws.wd, t);
      return { feet: deckToDungeon(x, KT_BRIDGE.y, z), yaw: ws.wd.yw, height: KW_BODY.h, radius: KW_BODY.r, warded: !!ws.ward || t < ws.op || t < (ws.ou ?? 0), entity: wardenStandIn, mobile: KT_WARDEN_LOOK.mobile };
    },
    /** A blow of mine met the Warden: out to the room - the ward turns it (nothing sent). */
    bossHit({ d, r } = /** @type {any} */ ({})) {
      const ws = link.state()?.ws, t = now(), dmg = Math.round(d);
      if (!ws || ws.fell || ws.lost || !link.joined() || !(dmg >= 1) || !Object.values(HIT_KINDS).includes(r)) return false;
      if (ws.ward || t < ws.op || t < (ws.ou ?? 0)) return false;
      if (warden) warden.hurtAt = t;
      return !!sendHit({ o: KW_ID, d: dmg, r, q: blowQ(KW_ID) });
    },
    /** The song's forks as bodies my blows meet (the gate's crystal seam's shape). */
    forkTargets: () => _forkTargets,
    /** A blow of mine met fork `c`: out to the room. */
    forkHit({ c, d, r } = /** @type {any} */ ({})) {
      const fk = link.state()?.ws?.fk, dmg = Math.round(d);
      if (!fk || !Number.isInteger(c) || !(fk.c[c]?.[2] > 0) || !(dmg >= 1) || !link.joined()) return false;
      return !!sendHit({ o: KW_FORK_ID0 + c, d: dmg, r, q: blowQ(KW_FORK_ID0 + c) });
    },
    /** MWNPC10: each shown construct offered its Morrowind creature on `lane`, with the billboard it is drawn by. */
    offerBodies(lane) {
      for (const b of bodies.values()) {
        if (!b.shown || !b.batch) continue;
        const B = link.state()?.bodies?.find((q) => q.id === b.id), K = B ? KT_KIND_BY_K[B.k] : null, L = K ? KT_LOOKS[K.key] : null;
        const look = L ? creatureLook({ mobileType: L.mobile }) : null;
        if (!look) continue;
        lane.offer(rosterActor(b, { id: `kt:${b.id}`, look, feet: b.batch.origin, yaw: b.yaw ?? 0, moving: b.act === 'walk', scale: L.scale, swingKey: b.wound, hitKey: Math.max(b.hurtAt ?? -Infinity, b.roomAt ?? -Infinity), dead: b.act === 'fall' ? 1 + (b.id % 3) : 0 }), b.batch, null, b.batch.hitFlash || 0);
      }
    },
    /** THE TELEGRAPHS: every shape this frame on its own floor, after the flats (the court's law). Answers whether it drew. */
    drawPass(proj, view, eye, seconds, fog) {
      let drew = false;
      if (_halos.length && (halo ??= haloDoor?.() ?? null)?.draw(proj, view, _halos, fog, SD_HALO_GAIN.classic)) drew = true;
      if (!_shapes.length) return drew;
      tele ??= teleDoor?.(true) ?? null;
      if (!tele) return drew;
      for (const sh of _shapes) {
        const F = KT_TELEGRAPH_FLOORS[sh.floor] ?? KT_TELEGRAPH_FLOORS.waist;
        tele.draw(sh, proj, view, eye, seconds, fog, [O[0], O[1] + F.y, O[2]], null, { r: F.r, courts: [F.court] });
        drew = drew || tele.drawn > 0;
      }
      return drew;
    },
    /** KETCH-LOOK KL3: the halos the frame draws (`{ at, size, color }` each - the deck's list, read at the draw, never
     *  kept past it; empty on the lane, whose bloom is its own). */
    halos(list) { _halos = list ?? Object.freeze([]); },
    /** THE WARDEN'S BAR as the HUD reads it, or null. */
    bar() {
      const ws = link.state()?.ws, t = now();
      if (!ws || ws.fell) return null;
      return { name: KT_WARDEN_LOOK.name, h: ws.h, m: ws.m, ph: ws.ph, ward: !!ws.ward, rs: ws.rs, stun: ws.su > t ? Math.ceil((ws.su - t) / 1000) : 0, ends: ws.ends, op: ws.op, fk: ws.fk ? ws.fk.c.filter((q) => q[2] > 0).length : 0, song: ws.fk ? Math.max(0, Math.ceil((ws.fk.at - t) / 1000)) : 0 };
    },
    /** Off the ship: every body put away, every verdict forgotten. */
    leave() {
      for (const b of bodies.values()) destroyBatch(b);
      bodies.clear(); hazards.clear(); judged.clear(); heard.clear();
      if (warden) destroyBatch(warden);
      warden = null;
      _batches.length = 0; _targets.length = 0; _forkTargets.length = 0; _lights.length = 0; _shapes.length = 0;
      _halos = Object.freeze([]);
    },
    /** What the set holds (tests, stats). */
    state: () => ({ bodies: [...bodies.keys()], shown: _batches.length, targets: _targets.length, shapes: _shapes.length, hazards: hazards.size }),
  };
}
