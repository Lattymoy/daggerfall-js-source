// @ts-check
// SD8c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10): THE BRASS REMNANT ON THE
// PAGE - the dungeon host's set for the Last Moment's arena in the Shattered Hour, as scenes/sdHall.js is for its Orrery.
// The realm runs the fight (SD8b - net/sdRemnant.js its law); this shows what the realm says of it and carries my blows.
//
//   STOOD once (stand): the Remnant's body, the GOLD and SILVER Echoes' and the Reset's Hearts' (world/sdRemnantModel.js),
//     each a draw of its own among the dungeon's, hidden until the fight stands it. SD17: each body as its parts - its
//     pelvis (the body's own draw, stood where it stands) and the six its rig turns (scenes/sdRemnantRig.js), after the
//     Hearts - and the Volley's gears in flight.
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
import { SD_ARENA, SD_REALM_ORIGIN, realmToDungeon } from '../net/sdBrain.js';
import { SD_REM, SD_ECHO, SD_HEART, SD_REM_START, SD_BREAK_MS, SD_BLOWS, SD_HEARTS_CLOSE_MS, SD_HEARTS, SD_STUN_MS, SD_PULSE_EVERY_MS, inArena } from '../net/sdRemnant.js';
import { HIT_KINDS, wrapYaw } from '../net/gateBrain.js';
import { sdBodyAt, sdHeartsOf, sdHourOver, SD_FIGHT_EMPTY } from '../net/sdFightLink.js';
import { SD_REALM_ARCHIVE } from '../world/sdRealm.js';
import { remnantArt } from '../world/sdRemnantArt.js';
import { ensureSdHallArt } from './sdHall.js';
import { buildRemnantParts, buildHeartModel, buildGearModel, remnantMatrix, remnantScale, SD_REMNANT_BODY } from '../world/sdRemnantModel.js';
import { SD_ENDINGS } from '../net/sdMarks.js';
import { remnantRig, rigMatrices, restRig, sdGearsAt, gearMatrix, sdKeptList, SD_RIG_PARTS } from './sdRemnantRig.js';
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
/** AUDIT SD III (V6): how long it takes to kneel and to rise from it (ms) - it dropped its 1.6 m in a frame, and stood
 *  again in one; and how fast a body turns as it is drawn (radians a second): it faced each new aim in a frame, up to
 *  120 degrees at once. A half-turn in 0.9 s - inside the quickest wind-up of a blow that needs its facing (the Hour-
 *  Hand's under the Quickened Gears, 1.09 s), so the law's facing is the drawn one by the time any blow lands. */
export const SD_KNEEL_EASE_MS = 400;
export const SD_TURN_RATE = 3.5;
/** A body's drawn facing `was` turned toward `to` by at most `rate` x `dt` (seconds) - the shortest way round. Pure. */
export const sdTurnToward = (was, to, dt, rate = SD_TURN_RATE) => {
  if (was == null || !Number.isFinite(was)) return to;
  const d = wrapYaw(to - was), step = rate * Math.max(0, dt || 0);
  return Math.abs(d) <= step ? to : wrapYaw(was + Math.sign(d) * step);
};
/** SD-LOOK (Super-Dungeons-Look.md section 10): THE HEART'S LIGHT - its reach (m, at the Remnant's height; an Echo's
 *  its scale's), its light at rest and at the top of a beat, the Pulse's and the Reset's flare over it, and THE
 *  METRONOME: a beat a second at `hz[0]` just after a Mantella Pulse, quickening to `hz[1]` as the next comes (never over
 *  3 Hz - the flash law), every Pulse SD_PULSE_EVERY_MS apart. The Echoes' hearts in their own metal's light. */
export const SD_HEART_LIGHT = Object.freeze({ range: 9, rest: 0.7, beat: 0.45, flare: 2.5, hz: Object.freeze([0.6, 2.5]), echo: Object.freeze([Object.freeze([1.0, 0.8, 0.42]), Object.freeze([0.8, 0.86, 1.0])]) });
const MANTELLA_LIGHT = Object.freeze([0.45, 1.0, 0.6]);
/** The heart's beat at `t` (ms) of the fight `s`: its light's swell, 0..1 - the metronome's phase run since the last Pulse
 *  `pulseAt` (ms; else since the fight began), the beat a quick rise and a slow fall. Pure. */
export function sdHeartBeat(s, t, pulseAt) {
  const from = Number.isFinite(pulseAt) && pulseAt <= t ? pulseAt : (s?.op ?? 0), tau = Math.max(0, (t - from) / 1000);
  const [h0, h1] = SD_HEART_LIGHT.hz, T = SD_PULSE_EVERY_MS / 1000, k = Math.min(tau, T);
  const phase = h0 * k + ((h1 - h0) * k * k) / (2 * T) + h1 * (tau - k);   // the rate rising h0 to h1 over a Pulse's span
  const f = phase - Math.floor(phase);
  return f < 0.15 ? f / 0.15 : Math.exp(-(f - 0.15) * 5);
}
/** SD17: the gears in flight at once at most - a Volley's five marks from each of three bodies. */
export const SD_GEAR_DRAWS = SD_BLOWS.volley.max * 3;
const ZERO = new Float32Array(16);
const NONE = Object.freeze([]);
/** AUDIT SD II (L2 F9): a body not shown - one pose for every hidden one (eight Hearts' literals were made a frame), never
 *  written (and not frozen: one shape with the frame's own poses, filled in place, so their reads stay one kind). */
const HIDDEN = { x: 0, z: 0, yw: 0, sink: 0, shown: false };
const _remPose = { x: 0, z: 0, yw: 0, sink: 0, shown: false };
/** AUDIT SD III (V5): where a body's walk has it, found in place each frame (net/sdFightLink.js sdBodyAt's `out`). */
const _bodyAt = [0, 0];
/** AUDIT SD III (V5): the gears in flight, a list kept and filled in place (a frame of a Volley's flight made 1.7 KB). */
const _gears = sdKeptList();
const _echoPose = { x: 0, z: 0, yw: 0, sink: 0, shown: false };
const _heartPose = { x: 0, z: 0, yw: 0, sink: 0, shown: true };
/** An Echo's scale beside the Remnant's (world/sdRemnantModel.js remnantScale), once. */
const ECHO_SCALE = remnantScale(true);
/** A pose `{ x, z, yw, sink, shown }`, set in `out`. */
const posed = (out, x, z, yw, sink, shown) => { out.x = x; out.z = z; out.yw = yw; out.sink = sink; out.shown = shown; return out; };

const _uploaded = new WeakSet();
/** The Echoes' metals, uploaded once a renderer (the Remnant's own brass and the heart's light are the realm's and the
 *  hall's). */
export function ensureSdRemnantArt(renderer) {
  if (!renderer || _uploaded.has(renderer) || typeof renderer.uploadTexture !== 'function') return;
  _uploaded.add(renderer);
  for (const [rec, art] of remnantArt()) { renderer.uploadTexture(SD_REALM_ARCHIVE, rec, art.albedo); renderer.uploadEmissionTexture?.(SD_REALM_ARCHIVE, rec, art.emission, { white: true }); }   // AUDIT SD II (L2 F3): their own light, never the window's day tint
}

/** A point of the arena's frame in the dungeon's, on its floor. */
export const arenaToDungeon = (x, z) => realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z);
/** Whether a fight is one to fight: heard, not lost. */
const live = (s) => s.fi > 0 && !s.lost;

/**
 * WHERE THE REMNANT STANDS at `now` and how: `{ x, z, yw, sink, shown }` (the arena's frame; `sink` metres under the
 * floor). Waiting at its start with no fight to fight; gone outside time in the Dragon Break; risen out of the floor at
 * the centre over the break for the Last Moment; kneeling while stunned; sinking away where it fell. AUDIT SD III (V6): a
 * LOST fight's body sinks where it stood and rises again at its start - it stood there at once; and it kneels and rises
 * over SD_KNEEL_EASE_MS. Pure (AUDIT SD II, L2 F9: into `out` when one is given - the set's frame makes nothing waiting
 * for a fight).
 * @param {any} s the fight (net/sdFightLink.js SdFightState) @param {number} now the relay's clock @param {any} [out]
 */
export function remnantPose(s, now, out = { x: 0, z: 0, yw: 0, sink: 0, shown: false }) {
  if (s.fi > 0 && s.lost > 0 && !s.fell) {
    const since = Math.max(0, now - s.lost);
    if (since < SD_REM_SINK_MS) {
      const [x, z] = s.rem ? sdBodyAt(s.rem, s.lost) : SD_REM_START;
      return posed(out, x, z, s.rem?.yw ?? Math.PI, (since / SD_REM_SINK_MS) * SD_REM.h, s.ph !== 2);   // outside time, it is gone already
    }
    const up = since - SD_REM_SINK_MS;
    return posed(out, SD_REM_START[0], SD_REM_START[1], Math.PI, up < SD_BREAK_MS ? (1 - up / SD_BREAK_MS) * SD_REM.h : 0, true);
  }
  if (!live(s)) return posed(out, SD_REM_START[0], SD_REM_START[1], Math.PI, 0, true);
  const B = s.rem;
  if (s.fell) {
    const sink = (Math.max(0, now - s.fell.at) / SD_REM_SINK_MS) * SD_REM.h;
    return posed(out, B.x, B.z, B.yw, Math.min(SD_REM.h, sink), sink < SD_REM.h);
  }
  if (s.ph === 2) return posed(out, B.x, B.z, B.yw, 0, false);   // outside time
  const at = sdBodyAt(B, now, _bodyAt), x = at[0], z = at[1];
  const rising = now < s.ou ? Math.min(1, (s.ou - now) / SD_BREAK_MS) * SD_REM.h : 0;
  const kneel = now < s.su ? SD_KNEEL_M * Math.max(0, Math.min(1, (now - (s.su - SD_STUN_MS)) / SD_KNEEL_EASE_MS, (s.su - now) / SD_KNEEL_EASE_MS)) : 0;
  return posed(out, x, z, B.yw, Math.max(rising, kneel), true);
}
/**
 * WHERE ECHO `e` STANDS at `now`: `{ x, z, yw, sink, shown }` - rising out of the floor at its spot until it stands,
 * sinking away where it fell; none outside the Dragon Break. AUDIT SD III (V6): one standing as its fight is lost sinks
 * where it stood. Pure (into `out` when one is given - AUDIT SD II, L2 F9).
 * @param {any} s @param {number} e @param {number} now @param {any} [out]
 */
export function echoPose(s, e, now, out = { x: 0, z: 0, yw: 0, sink: 0, shown: false }) {
  const L = s.fi > 0 && s.lost > 0 && !s.fell && s.ph === 2 ? s.ec?.[e] ?? null : null;
  if (L && L.h > 0) {
    const sink = (Math.max(0, now - s.lost) / SD_ECHO_SINK_MS) * SD_ECHO.h, [x, z] = sdBodyAt(L, s.lost);
    return posed(out, x, z, L.yw, Math.min(SD_ECHO.h, sink), sink < SD_ECHO.h);
  }
  const E = live(s) && !s.fell && s.ph === 2 ? s.ec?.[e] ?? null : null;
  if (!E) return posed(out, 0, 0, 0, SD_ECHO.h, false);
  if (!(E.h > 0)) {
    const sink = E.dn > 0 ? (Math.max(0, now - E.dn) / SD_ECHO_SINK_MS) * SD_ECHO.h : SD_ECHO.h;
    return posed(out, E.x, E.z, E.yw, Math.min(SD_ECHO.h, sink), sink < SD_ECHO.h);
  }
  const at = sdBodyAt(E, now, _bodyAt);
  return posed(out, at[0], at[1], E.yw, now < E.up ? Math.min(1, (E.up - now) / SD_BREAK_MS) * SD_ECHO.h : 0, true);
}
/** Whether the Reset's Hearts take blows at `now`: while it winds up, not in its last SD_HEARTS_CLOSE_MS (the law's
 *  heartsOpen, read off the page's fight). Pure. */
export function heartsOpenAt(s, now) {
  return live(s) && !s.fell && !!sdHeartsOf(s, now) && now < s.rem.atk.at - SD_HEARTS_CLOSE_MS;
}
/** Whether the Remnant takes a blow at `now`: awake, inside time, returned, the fight not over (the law's remnantOpen,
 *  read off the page's fight). Pure. */
export function remnantOpenAt(s, now) {
  return live(s) && !s.fell && !sdHourOver(s, now) && now >= s.op && s.ph !== 2 && now >= s.ou;   // AUDIT SD II (L4 F3): its End by the clock
}

/**
 * The arena's set. `link()` the fight's link (net/sdFightLink.js createSdFightLink - null offline), `sendIn()` my `in`
 * down my socket (true when it left), `sendBlow(k, fields)` a blow (the wire's `hit`, `ehit`, `xhit`), `alive()` whether
 * I live.
 * @param {{ renderer?: any, link?: () => any, sendIn?: () => boolean, sendBlow?: (k: string, fields: any) => boolean, alive?: () => boolean, ending?: string|null }} deps - SD18c: `ending` its Hollow's (net/sdMarks.js) - the light its heart, eyes and Hearts burn with
 */
export function createSdRemnant({ renderer = null, link = () => null, sendIn = () => false, sendBlow = () => false, alive = () => true, ending = null }) {
  /** @type {any[]|null} the dungeon's draws, as stood into */
  let draws = null;
  /** every mesh made, to free (SD17: each body's parts, the Hearts', the gears') */
  const meshes = [];
  let remDraw = null;
  const echoDraws = [], heartDraws = [];
  // SD-LOOK: the hearts' lights, kept (the frame's - nothing made), the light their Ending gives, the last Pulse heard
  const heartLights = Array.from({ length: 3 }, () => ({ x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0] })), litList = [];
  const heartColor = SD_ENDINGS.find((E) => E.id === ending)?.light ?? MANTELLA_LIGHT;
  let pulseAt = -Infinity;
  /** SD17: each body's turned parts (the Remnant's, gold's, silver's), the gears' draws, the rig's pose and matrices */
  const partDraws = [[], [], []], gearDraws = [];
  const _rig = restRig(), _parts = SD_RIG_PARTS.map(() => new Float32Array(16));
  /** the stand-ins (made once), my blows' sequence and the bodies one blow of mine has met this frame */
  const standIn = bossStandIn({ mobile: SD_REMNANT_MOBILE }, SD_REMNANT_NAMES.remnant);
  const echoIns = [0, 1].map((e) => hostStandIn({ mobile: SD_REMNANT_MOBILE, name: SD_REMNANT_NAMES.echoes[e] }, e));
  const heartIns = Array.from({ length: SD_HEARTS[1] }, (_, c) => { const h = crystalStandIn({ mobile: SD_REMNANT_MOBILE }, c); h.name = SD_REMNANT_NAMES.heart; return h; });
  let blowSeq = 0;
  const blowMet = new Set();
  /** AUDIT SD III (V6): each body's drawn facing - the Remnant's, then the Echoes' (NaN: not shown last frame; a typed
   *  list, so a frame boxes no number) - each turned to the pose's at SD_TURN_RATE, never in a frame; shown afresh, a body
   *  stands as it faces. */
  const facing = new Float64Array(3).fill(NaN);
  const turn = (p, k, dt) => {
    if (!p.shown) facing[k] = NaN;
    else if (facing[k] !== p.yw) facing[k] = p.yw = sdTurnToward(facing[k], p.yw, dt);   // a body at rest calls nothing (AUDIT SD II, L2 F9)
    return p;
  };
  /** AUDIT WB11 W3's law: every body one swing, shaft or blast of mine meets between two frames carries one number; a
   *  second meeting of a body already met is a blow of its own. */
  function blowQ(who) {
    if (!blowMet.size || blowMet.has(who)) { blowSeq = (blowSeq + 1) & 0x7fffffff; blowMet.clear(); }
    blowMet.add(who);
    return blowSeq;
  }
  const make = (model) => { if (!model || !renderer?.createMesh) return null; try { const m = renderer.createMesh(model); if (m) meshes.push(m); return m; } catch (e) { console.warn('[sd] the Remnant would not build', e?.message ?? e); return null; } };
  const drop = (mesh) => { if (mesh) { try { renderer?.destroyMesh?.(mesh); } catch { /* gone */ } } };
  const hide = (d) => { if (d && !d.hidden) { d.object.matrix.set(ZERO); d.hidden = true; } };   // AUDIT SD II (L2 F11): a hidden body is no draw
  const place = (d, p, scale) => {
    if (!d) return;
    if (!p.shown) { hide(d); return; }
    // AUDIT SD II (L2 F9): a body standing as it stood keeps its matrix - one waiting for its fight made its matrix's
    // numbers every frame; and arenaToDungeon's own sums, in place
    const was = d.posed;
    if (!d.hidden && was[0] === p.x && was[1] === p.z && was[2] === p.yw && was[3] === p.sink && was[4] === scale) return;
    was[0] = p.x; was[1] = p.z; was[2] = p.yw; was[3] = p.sink; was[4] = scale;
    remnantMatrix(SD_REALM_ORIGIN[0] + SD_ARENA.x + p.x, SD_REALM_ORIGIN[1] - p.sink, SD_REALM_ORIGIN[2] + SD_ARENA.z + p.z, p.yw, scale, d.object.matrix);
    d.hidden = false;
  };
  /** SD17: a body's turned parts, stood on its pelvis's matrix (the body's own) as its rig turns them - hidden with it. */
  const limbs = (list, body, who, s, t) => {
    if (!body || body.hidden) { for (const d of list) hide(d); return; }
    rigMatrices(body.object.matrix, remnantRig(s, who, t, _rig), _parts);
    for (let i = 0; i < list.length; i++) { const d = list[i]; if (!d) continue; d.object.matrix.set(_parts[i]); d.hidden = false; }
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
      const add = (mesh) => { if (!mesh) return null; const d = { gpu: mesh, object: { matrix: new Float32Array(ZERO) }, hidden: true, posed: new Float64Array(5) }; draws.push(d); return d; };
      // SD17: each body its parts - the pelvis first (the body's own draw, where the bodies always stood), the rest after
      const bodies = ['brass', 'gold', 'silver'].map((metal) => buildRemnantParts(metal, ending).map(make));
      const heartMesh = make(buildHeartModel(ending));
      remDraw = add(bodies[0][0]);
      echoDraws.push(add(bodies[1][0]), add(bodies[2][0]));
      for (let c = 0; c < SD_HEARTS[1]; c++) heartDraws.push(add(heartMesh));
      bodies.forEach((parts, b) => { for (const m of parts.slice(1)) partDraws[b].push(add(m)); });
      const gearMesh = make(buildGearModel());
      for (let g = 0; g < SD_GEAR_DRAWS; g++) gearDraws.push(add(gearMesh));
      return true;
    },
    /** One frame: `feet` where I stand (the dungeon's frame) - my `in` when it is due, every body placed. */
    frame(dt, feet) {
      if (blowMet.size) blowMet.clear();   // a frame ends my blow (AUDIT SD II, L2 F9: an empty Set's clear makes it a new table)
      const L = link(), s = L ? L.state() : SD_FIGHT_EMPTY, t = L ? L.now() : 0;   // read()'s own, with no object made (AUDIT SD II, L2 F9)
      if (L && feet && alive()) {
        // the arena's frame: net/sdBrain.js dungeonToRealm's and net/sdRemnant.js arenaOf's sums, in place
        const ax = feet[0] - SD_REALM_ORIGIN[0] - SD_ARENA.x, az = feet[2] - SD_REALM_ORIGIN[2] - SD_ARENA.z;
        if (inArena(ax, az) && L.inDue(t) && sendIn()) L.sentIn(t);
      }
      if (!draws) return;
      place(remDraw, turn(remnantPose(s, t, _remPose), 0, dt), 1);   // AUDIT SD III (V6): turned, never snapped
      limbs(partDraws[0], remDraw, -1, s, t);   // SD17: its body moved
      for (let e = 0; e < echoDraws.length; e++) { place(echoDraws[e], turn(echoPose(s, e, t, _echoPose), 1 + e, dt), ECHO_SCALE); limbs(partDraws[1 + e], echoDraws[e], e, s, t); }
      // SD17: the Volley's gears in flight
      const gears = live(s) ? sdGearsAt(s, t, _gears) : NONE;
      for (let g = 0; g < gearDraws.length; g++) {
        const d = gearDraws[g], q = gears[g];
        if (!d) continue;
        if (!q) { hide(d); continue; }
        gearMatrix(q.x, q.y, q.z, q.spin, d.object.matrix, q.yaw); d.hidden = false;   // AUDIT SD III (V12): on edge along its flight
      }
      const cx = live(s) && !s.fell ? sdHeartsOf(s, t) : null;   // standing while the Reset winds up - gone as it lands
      for (let c = 0; c < heartDraws.length; c++) {
        const q = cx?.c[c];
        place(heartDraws[c], q && q[2] > 0 ? posed(_heartPose, q[0], q[1], (t / 1000) * SD_HEART_SPIN + c, 0, true) : HIDDEN, 1);
      }
    },
    /**
     * THE REMNANT AS A BODY MY BLOWS MEET, or null (no fight that counted me in, fallen, past its Hour, outside time):
     * its feet in the dungeon's frame, its facing, its height and radius (net/sdRemnant.js SD_REM - the relay measures a
     * melee blow from the same body), whether it is warded (asleep, or rising at its return), its stand-in and its look.
     */
    target() {
      const { L, s, t } = read();
      if (!L?.joined() || s.fell || sdHourOver(s, t) || s.ph === 2) return null;
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
    /**
     * SD-LOOK: THE HEARTS' LIGHT - each standing body's heart (its torso's turn carries it) a point light in its Ending's
     * light (the Echoes' in their metal's), beating as the metronome says, flaring on the Pulse and through the Reset's
     * wind-up. The renderer's light list's shape, kept records; none with no body standing.
     */
    lights() {
      litList.length = 0;
      if (!draws) return litList;
      const L = link(), s = L ? L.state() : SD_FIGHT_EMPTY, t = L ? L.now() : 0, H = SD_HEART_LIGHT;
      const clk = s.clk;
      if (clk && clk.a === SD_BLOWS.pulse.id && clk.at <= t && clk.at > pulseAt) pulseAt = clk.at;
      const flare = (clk && clk.a === SD_BLOWS.pulse.id && t >= clk.at - SD_BLOWS.pulse.windup && t < clk.at + 600)
        || (s.rem?.atk?.a === SD_BLOWS.reset.id && t < s.rem.atk.at && !(s.su > t)) ? H.flare : 1;
      const k = (H.rest + H.beat * sdHeartBeat(s, t, pulseAt)) * flare;
      for (let b = 0; b < heartLights.length; b++) {
        const d = b === 0 ? remDraw : echoDraws[b - 1], torso = partDraws[b]?.[2];
        if (!d || d.hidden || !torso || torso.hidden) continue;
        const m = torso.object.matrix, y = SD_REMNANT_BODY.heartY, o = heartLights[b], c = b === 0 ? heartColor : H.echo[b - 1];
        o.x = m[4] * y + m[12]; o.y = m[5] * y + m[13]; o.z = m[6] * y + m[14];
        o.range = H.range * (b === 0 ? 1 : ECHO_SCALE);
        o.color[0] = c[0] * k; o.color[1] = c[1] * k; o.color[2] = c[2] * k;
        litList.push(o);
      }
      return litList;
    },
    /** Gone with the dungeon: every mesh freed. */
    clear() {
      for (const m of meshes) drop(m);
      meshes.length = 0;
      remDraw = null; echoDraws.length = 0; heartDraws.length = 0; draws = null;
      for (const l of partDraws) l.length = 0;
      gearDraws.length = 0;
    },
  };
}
