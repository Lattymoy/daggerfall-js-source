// @ts-check
// SD8c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10): THE BRASS REMNANT ON THE
// PAGE - the dungeon host's set for the Last Moment's arena in the Shattered Hour, as scenes/sdHall.js is for its Orrery.
// The realm runs the fight (SD8b - net/sdRemnant.js its law); this shows what the realm says of it and carries my blows.
//
//   STOOD once (stand): the Remnant's body, the GOLD and SILVER Echoes' and the Reset's Hearts' (world/sdRemnantModel.js),
//     each a draw of its own among the dungeon's, hidden until the fight stands it.
//   EACH FRAME (frame): the fight as the page holds it (net/sdFightLink.js) read at the relay's clock - each body where its
//     walk has taken it, facing its walk or its aim (remnantPose, echoPose - pure); the Remnant kneeling while stunned,
//     gone outside time in the Dragon Break and risen at the centre for the Last Moment, sinking where it fell; an Echo
//     rising at its spot and sinking where it fell; a Heart standing while the Reset winds up, turning. With no fight to
//     fight (none yet, or one lost) it stands waiting where a fight begins it. And MY `in`: standing alive in the arena,
//     said when the link holds it due - the realm counts me in by its answer alone.
//   MY BLOWS (the gate's three seams, which the dungeon context asks in the Hour - scenes/dungeonContext.js): the Remnant
//     as a body my blows meet (`target` - warded while it cannot be struck: asleep, or before its return), the Echoes as
//     the host's bodies (`echoTargets`), the Hearts as the crystals' (`heartTargets`) - each with a stand-in for the
//     formulas (world/gateBoss.js) - and the number each blow computes on this machine out to the realm (`hit`, `echoHit`,
//     `heartHit`: whole points, ONE SEQUENCE A BLOW - the gate's AUDIT WB11 W3 - the relay's hand and purse deciding what
//     lands). Only into a fight that counted me in.
//
// Its blows on ME are SD8d's (the telegraphs and each one judged on my own machine): here they are named on the bar alone.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_ARENA, realmToDungeon, dungeonToRealm } from '../net/sdBrain.js';
import { SD_REM, SD_ECHO, SD_HEART, SD_REM_START, SD_BREAK_MS, SD_BLOWS, SD_HEARTS_CLOSE_MS, SD_HEARTS, arenaOf, inArena } from '../net/sdRemnant.js';
import { HIT_KINDS } from '../net/gateBrain.js';
import { sdBodyAt, sdHeartsOf, SD_FIGHT_EMPTY } from '../net/sdFightLink.js';
import { SD_REALM_ARCHIVE } from '../world/sdRealm.js';
import { remnantArt } from '../world/sdRemnantArt.js';
import { ensureSdHallArt } from './sdHall.js';
import { buildRemnantModel, buildHeartModel, remnantMatrix, remnantScale } from '../world/sdRemnantModel.js';
import { bossStandIn, crystalStandIn, hostStandIn } from '../world/gateBoss.js';

/** The look the stand-ins wear for the formulas (characters/enemyBasics.js): an Iron Atronach's - a thing of metal. */
export const SD_REMNANT_MOBILE = 36;
/** The bodies' names (the lines a blow says). */
export const SD_REMNANT_NAMES = Object.freeze({ remnant: 'The Brass Remnant', echoes: Object.freeze(['The Gold Echo', 'The Silver Echo']), heart: 'Heart of the Hour' });
/** How far it kneels while stunned (metres into its own height), how long its fallen body takes to sink away, how long
 *  a fallen Echo's, and how fast a Heart turns (radians a second). */
export const SD_KNEEL_M = 1.6;
export const SD_REM_SINK_MS = 4000;
export const SD_ECHO_SINK_MS = 1500;
export const SD_HEART_SPIN = 0.9;
const ZERO = new Float32Array(16);
const NONE = Object.freeze([]);

const _uploaded = new WeakSet();
/** The Echoes' metals, uploaded once a renderer (the Remnant's own brass and the heart's light are the realm's and the
 *  hall's). */
export function ensureSdRemnantArt(renderer) {
  if (!renderer || _uploaded.has(renderer) || typeof renderer.uploadTexture !== 'function') return;
  _uploaded.add(renderer);
  for (const [rec, art] of remnantArt()) { renderer.uploadTexture(SD_REALM_ARCHIVE, rec, art.albedo); renderer.uploadEmissionTexture?.(SD_REALM_ARCHIVE, rec, art.emission); }
}

/** A point of the arena's frame in the dungeon's, on its floor. */
export const arenaToDungeon = (x, z) => realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z);
/** Whether a fight is one to fight: heard, not lost. */
const live = (s) => s.fi > 0 && !s.lost;

/**
 * WHERE THE REMNANT STANDS at `now` and how: `{ x, z, yw, sink, shown }` (the arena's frame; `sink` metres under the
 * floor). Waiting at its start with no fight to fight; gone outside time in the Dragon Break; risen out of the floor at
 * the centre over the break for the Last Moment; kneeling while stunned; sinking away where it fell. Pure.
 * @param {any} s the fight (net/sdFightLink.js SdFightState) @param {number} now the relay's clock
 */
export function remnantPose(s, now) {
  if (!live(s)) return { x: SD_REM_START[0], z: SD_REM_START[1], yw: Math.PI, sink: 0, shown: true };
  const B = s.rem;
  if (s.fell) {
    const sink = (Math.max(0, now - s.fell.at) / SD_REM_SINK_MS) * SD_REM.h;
    return { x: B.x, z: B.z, yw: B.yw, sink: Math.min(SD_REM.h, sink), shown: sink < SD_REM.h };
  }
  if (s.ph === 2) return { x: B.x, z: B.z, yw: B.yw, sink: 0, shown: false };   // outside time
  const [x, z] = sdBodyAt(B, now);
  const rising = now < s.ou ? Math.min(1, (s.ou - now) / SD_BREAK_MS) * SD_REM.h : 0;
  const kneel = now < s.su ? SD_KNEEL_M : 0;
  return { x, z, yw: B.yw, sink: Math.max(rising, kneel), shown: true };
}
/**
 * WHERE ECHO `e` STANDS at `now`: `{ x, z, yw, sink, shown }` - rising out of the floor at its spot until it stands,
 * sinking away where it fell; none outside the Dragon Break. Pure.
 * @param {any} s @param {number} e @param {number} now
 */
export function echoPose(s, e, now) {
  const E = live(s) && !s.fell && s.ph === 2 ? s.ec?.[e] ?? null : null;
  if (!E) return { x: 0, z: 0, yw: 0, sink: SD_ECHO.h, shown: false };
  if (!(E.h > 0)) {
    const sink = E.dn > 0 ? (Math.max(0, now - E.dn) / SD_ECHO_SINK_MS) * SD_ECHO.h : SD_ECHO.h;
    return { x: E.x, z: E.z, yw: E.yw, sink: Math.min(SD_ECHO.h, sink), shown: sink < SD_ECHO.h };
  }
  const [x, z] = sdBodyAt(E, now);
  return { x, z, yw: E.yw, sink: now < E.up ? Math.min(1, (E.up - now) / SD_BREAK_MS) * SD_ECHO.h : 0, shown: true };
}
/** Whether the Reset's Hearts take blows at `now`: while it winds up, not in its last SD_HEARTS_CLOSE_MS (the law's
 *  heartsOpen, read off the page's fight). Pure. */
export function heartsOpenAt(s, now) {
  return live(s) && !s.fell && !!sdHeartsOf(s, now) && now < s.rem.atk.at - SD_HEARTS_CLOSE_MS;
}
/** Whether the Remnant takes a blow at `now`: awake, inside time, returned, the fight not over (the law's remnantOpen,
 *  read off the page's fight). Pure. */
export function remnantOpenAt(s, now) {
  return live(s) && !s.fell && !s.ended && now >= s.op && s.ph !== 2 && now >= s.ou;
}

/**
 * The arena's set. `link()` the fight's link (net/sdFightLink.js createSdFightLink - null offline), `sendIn()` my `in`
 * down my socket (true when it left), `sendBlow(k, fields)` a blow (the wire's `hit`, `ehit`, `xhit`), `alive()` whether
 * I live.
 * @param {{ renderer?: any, link?: () => any, sendIn?: () => boolean, sendBlow?: (k: string, fields: any) => boolean, alive?: () => boolean }} deps
 */
export function createSdRemnant({ renderer = null, link = () => null, sendIn = () => false, sendBlow = () => false, alive = () => true }) {
  /** @type {any[]|null} the dungeon's draws, as stood into */
  let draws = null;
  let remMesh = null, goldMesh = null, silverMesh = null, heartMesh = null;
  let remDraw = null;
  const echoDraws = [], heartDraws = [];
  /** the stand-ins (made once), my blows' sequence and the bodies one blow of mine has met this frame */
  const standIn = bossStandIn({ mobile: SD_REMNANT_MOBILE }, SD_REMNANT_NAMES.remnant);
  const echoIns = [0, 1].map((e) => hostStandIn({ mobile: SD_REMNANT_MOBILE, name: SD_REMNANT_NAMES.echoes[e] }, e));
  const heartIns = Array.from({ length: SD_HEARTS[1] }, (_, c) => { const h = crystalStandIn({ mobile: SD_REMNANT_MOBILE }, c); h.name = SD_REMNANT_NAMES.heart; return h; });
  let blowSeq = 0;
  const blowMet = new Set();
  /** AUDIT WB11 W3's law: every body one swing, shaft or blast of mine meets between two frames carries one number; a
   *  second meeting of a body already met is a blow of its own. */
  function blowQ(who) {
    if (!blowMet.size || blowMet.has(who)) { blowSeq = (blowSeq + 1) & 0x7fffffff; blowMet.clear(); }
    blowMet.add(who);
    return blowSeq;
  }
  const make = (model) => { if (!model || !renderer?.createMesh) return null; try { return renderer.createMesh(model); } catch (e) { console.warn('[sd] the Remnant would not build', e?.message ?? e); return null; } };
  const drop = (mesh) => { if (mesh) { try { renderer?.destroyMesh?.(mesh); } catch { /* gone */ } } };
  const hide = (d) => { if (d) d.object.matrix.set(ZERO); };
  const place = (d, p, scale) => {
    if (!d) return;
    if (!p.shown) { hide(d); return; }
    const [x, y, z] = arenaToDungeon(p.x, p.z);
    remnantMatrix(x, y - p.sink, z, p.yw, scale, d.object.matrix);
  };
  /** The fight now: the link's state at the relay's clock (none offline). */
  const read = () => { const L = link(); return L ? { L, s: L.state(), t: L.now() } : { L: null, s: SD_FIGHT_EMPTY, t: 0 }; };

  return {
    /** Stand the bodies into the dungeon's draws - once. */
    stand({ dynamicDraws }) {
      if (draws) return false;
      draws = dynamicDraws;
      ensureSdHallArt(renderer);
      ensureSdRemnantArt(renderer);
      const add = (mesh) => { if (!mesh) return null; const d = { gpu: mesh, object: { matrix: new Float32Array(ZERO) } }; draws.push(d); return d; };
      remMesh = make(buildRemnantModel('brass'));
      goldMesh = make(buildRemnantModel('gold'));
      silverMesh = make(buildRemnantModel('silver'));
      heartMesh = make(buildHeartModel());
      remDraw = add(remMesh);
      echoDraws.push(add(goldMesh), add(silverMesh));
      for (let c = 0; c < SD_HEARTS[1]; c++) heartDraws.push(add(heartMesh));
      return true;
    },
    /** One frame: `feet` where I stand (the dungeon's frame) - my `in` when it is due, every body placed. */
    frame(dt, feet) {
      blowMet.clear();   // a frame ends my blow
      const { L, s, t } = read();
      if (L && feet && alive()) {
        const [rx, , rz] = dungeonToRealm(feet[0], feet[1], feet[2]);
        const [ax, az] = arenaOf(rx, rz);
        if (inArena(ax, az) && L.inDue(t) && sendIn()) L.sentIn(t);
      }
      if (!draws) return;
      place(remDraw, remnantPose(s, t), 1);
      for (let e = 0; e < echoDraws.length; e++) place(echoDraws[e], echoPose(s, e, t), remnantScale(true));
      const cx = live(s) && !s.fell ? sdHeartsOf(s, t) : null;   // standing while the Reset winds up - gone as it lands
      for (let c = 0; c < heartDraws.length; c++) {
        const q = cx?.c[c];
        place(heartDraws[c], q && q[2] > 0 ? { x: q[0], z: q[1], yw: (t / 1000) * SD_HEART_SPIN + c, sink: 0, shown: true } : { x: 0, z: 0, yw: 0, sink: 0, shown: false }, 1);
      }
    },
    /**
     * THE REMNANT AS A BODY MY BLOWS MEET, or null (no fight that counted me in, fallen, past its Hour, outside time):
     * its feet in the dungeon's frame, its facing, its height and radius (net/sdRemnant.js SD_REM - the relay measures a
     * melee blow from the same body), whether it is warded (asleep, or rising at its return), its stand-in and its look.
     */
    target() {
      const { L, s, t } = read();
      if (!L?.joined() || s.fell || s.ended || s.ph === 2) return null;
      const p = remnantPose(s, t);
      return { feet: arenaToDungeon(p.x, p.z), yaw: p.yw, height: SD_REM.h, radius: SD_REM.r, warded: !remnantOpenAt(s, t), entity: standIn, mobile: SD_REMNANT_MOBILE };
    },
    /** A BLOW OF MINE MET THE REMNANT - `d` the formula's number on this machine, `r` its kind (net/gateBrain.js
     *  HIT_KINDS): out as the wire's `hit` (whole points, my blow's number) while it can be struck. Answers whether it went. */
    hit({ d, r } = /** @type {any} */ ({})) {
      const { L, s, t } = read();
      if (!L?.joined() || !remnantOpenAt(s, t) || !Object.values(HIT_KINDS).includes(r)) return false;
      const dmg = Math.round(d);
      if (!(dmg >= 1)) return false;
      return !!sendBlow('hit', { q: blowQ('b'), d: dmg, r });
    },
    /** THE ECHOES AS BODIES MY BLOWS MEET (the host's seam) - each standing one: its number (the wire's `e`), its whole,
     *  its feet, its body (SD_ECHO), its stand-in; none outside the Dragon Break or a fight that counted me in. */
    echoTargets() {
      const { L, s, t } = read();
      if (!L?.joined() || s.ph !== 2 || !s.ec) return NONE;
      const out = [];
      for (let e = 0; e < s.ec.length; e++) {
        const E = s.ec[e];
        if (!(E.h > 0) || t < E.up) continue;
        const [x, z] = sdBodyAt(E, t);
        out.push({ i: e, m: E.m, feet: arenaToDungeon(x, z), height: SD_ECHO.h, radius: SD_ECHO.r, entity: echoIns[e], mobile: SD_REMNANT_MOBILE });
      }
      return out;
    },
    /** A BLOW OF MINE MET ECHO `i`: out as the wire's `ehit`. Answers whether it went. */
    echoHit({ i, d, r } = /** @type {any} */ ({})) {
      const { L, s, t } = read();
      const E = Number.isInteger(i) ? s.ec?.[i] : null;
      if (!L?.joined() || s.ph !== 2 || !E || !(E.h > 0) || t < E.up || !Object.values(HIT_KINDS).includes(r)) return false;
      const dmg = Math.round(d);
      if (!(dmg >= 1)) return false;
      return !!sendBlow('ehit', { e: i, q: blowQ(`e${i}`), d: dmg, r });
    },
    /** THE RESET'S HEARTS AS BODIES MY BLOWS MEET (the crystals' seam) - each standing one: its number (the wire's `c`),
     *  its foot, its body (SD_HEART), its stand-in; none but while they take blows. */
    heartTargets() {
      const { L, s, t } = read();
      if (!L?.joined() || !heartsOpenAt(s, t)) return NONE;
      const out = [];
      s.cx.c.forEach((q, c) => { if (q[2] > 0 && heartIns[c]) out.push({ c, feet: arenaToDungeon(q[0], q[1]), height: SD_HEART.h, radius: SD_HEART.r, entity: heartIns[c] }); });
      return out;
    },
    /** A BLOW OF MINE MET HEART `c`: out as the wire's `xhit`. Answers whether it went. */
    heartHit({ c, d, r } = /** @type {any} */ ({})) {
      const { L, s, t } = read();
      const q = Number.isInteger(c) ? s.cx?.c[c] : null;
      if (!L?.joined() || !heartsOpenAt(s, t) || !q || !(q[2] > 0) || !Object.values(HIT_KINDS).includes(r)) return false;
      const dmg = Math.round(d);
      if (!(dmg >= 1)) return false;
      return !!sendBlow('xhit', { c, q: blowQ(`x${c}`), d: dmg, r });
    },
    /** Gone with the dungeon: every mesh freed. */
    clear() {
      for (const m of [remMesh, goldMesh, silverMesh, heartMesh]) drop(m);
      remMesh = goldMesh = silverMesh = heartMesh = null;
      remDraw = null; echoDraws.length = 0; heartDraws.length = 0; draws = null;
    },
  };
}
