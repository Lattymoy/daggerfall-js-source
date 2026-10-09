// @ts-check
// SD-LOOK S7 (2026-10-09, bible/11-Multiplayer/Super-Dungeons-Look.md section 9): THE ARENA WATCHES THE REMNANT - what the
// arena shows of where the Remnant stands, pure over the page's fight state (net/sdFightLink.js) and the relay's clock,
// so every page draws the same:
//
//   THE WATCHING HANDS (`sdPillarHandsAt`) - each clock on each capital (world/sdPillarModel.js sdPillarDials) turns its
//     one hand to point at the Remnant's heart as seen on the dial's own plane: they watch it. On the escapement (world/
//     sdLook.js sdTick): each anchored second the hands take where it stood at that second, eased over the first quarter
//     and held - the machine ticks; the Remnant moves smoothly (smooth motion is danger). Outside time each pillar watches
//     the Echo standing nearest it; once it has fallen, the way home rising where it fell (scenes/sdSpoils.js
//     clearOfPillars - the world host's own place). Nothing to watch: the hands at XII.
//   THE MARK (`sdArenaMarksAt`) - the Warden's WBX4 mark the Remnant never had (render/gateTelegraph.js markShape): a ring
//     about its feet and a chevron where it faces, always while it stands; smaller under each Echo standing, each in its
//     body's metal. Laid by the Hour's telegraph pass (scenes/sdRemnantBlows.js, its `bodyMarks`).
//   THE RESET'S DIMMING (`sdLampDimInto`) - the arena's lamps and lanterns dim to SD_RESET_DIM.to through the Reset's
//     wind-up, so its Hearts are the brightest things in the world, and come back at its landing or the stun that ends
//     it (world/sdRealm.js realmLightsWith's `dim`; render/sdPillarPass.js).
//
// Kept records, Float64Array scratch: a frame makes nothing (AUDIT SD II, L2 F9). Not a DFU member. Ledger A
// (SUPER-DUNGEONS).
import { SD_ARENA, SD_REALM_ORIGIN } from '../net/sdBrain.js';
import { SD_BLOWS, SD_REM, SD_ECHO } from '../net/sdRemnant.js';
import { markShape } from '../render/gateTelegraph.js';
import { sdPillarDials, pillarCentre } from '../world/sdPillarModel.js';
import { SD_REMNANT_BODY, remnantScale } from '../world/sdRemnantModel.js';
import { sdTick } from '../world/sdLook.js';
import { remnantPose, echoPose, SD_HEART_LIGHT, SD_KNEEL_M } from './sdRemnant.js';
import { SD_BLOW_COLOR } from './sdRemnantBlows.js';
import { clearOfPillars } from './sdSpoils.js';

/** The hands' lag: each tick they turn from where it stood this long before the tick (s). */
export const SD_WATCH_LAG_S = 1;
/** The way home's height the hands point at, once it has fallen (m over the floor - its window's middle). */
export const SD_WATCH_HOME_Y = 1.6;
/** THE RESET'S DIMMING: how far down (the lamps' and lanterns' share of their light), how long it takes to dim from the
 *  Reset's call, and to come back from its landing or the stun (ms). */
export const SD_RESET_DIM = Object.freeze({ to: 0.4, inMs: 1500, outMs: 400 });
/** The marks' metals: the Remnant's brass (its blows' own), the Echoes' gold and silver (their hearts'). */
export const SD_MARK_COLOR = Object.freeze({ remnant: SD_BLOW_COLOR.stomp, echoes: SD_HEART_LIGHT.echo });

const RESET = SD_BLOWS.reset, RESET_ID = RESET.id, RESET_WINDUP = RESET.windup, TAU = Math.PI * 2;
const DIM_TO = SD_RESET_DIM.to, DIM_IN = SD_RESET_DIM.inMs, DIM_OUT = SD_RESET_DIM.outMs;
const ECHO_SCALE = remnantScale(true);
const AX = SD_REALM_ORIGIN[0] + SD_ARENA.x, AY = SD_REALM_ORIGIN[1], AZ = SD_REALM_ORIGIN[2] + SD_ARENA.z;
const _pose = { x: 0, z: 0, yw: 0, sink: 0, shown: false };
const _at = new Float64Array(3), _home = new Float64Array(3);
let _homeOf = NaN;
/** The pillars' centres, the arena's frame (made once). */
const PILLARS = [0, 1, 2, 3].map((k) => { const [x, z] = pillarCentre(k); return [x - SD_ARENA.x, z - SD_ARENA.z]; });

/** What the arena watches at a moment (watchAt's): how (0 nothing, 1 one thing for every pillar, 2 each pillar the Echo
 *  standing nearest it), the one thing (the dungeon's frame), and each Echo's heart and whether it stands. */
const _watch = { how: 0, one: new Float64Array(3), echo: new Float64Array(6), up: new Uint8Array(2) };
/** WHAT THE ARENA WATCHES at `tau` of fight `s`, into the kept record: once it has fallen the way home's place; the
 *  Remnant's heart where it stands (kneeling, rising, waiting for a fight); outside time the Echoes standing. */
function watchAt(s, tau) {
  const W = _watch;
  if (s.fi > 0 && s.fell && !s.lost) {
    if (s.fell.at !== _homeOf) { _homeOf = s.fell.at; const [x, z] = clearOfPillars(s.rem.x, s.rem.z); _home[0] = AX + x; _home[1] = AY + SD_WATCH_HOME_Y; _home[2] = AZ + z; }
    W.one[0] = _home[0]; W.one[1] = _home[1]; W.one[2] = _home[2]; W.how = 1;
    return W;
  }
  const p = remnantPose(s, tau, _pose);
  if (p.shown) { W.one[0] = AX + p.x; W.one[1] = AY + SD_REMNANT_BODY.heartY - p.sink; W.one[2] = AZ + p.z; W.how = 1; return W; }
  W.how = 0;
  for (let e = 0; e < 2; e++) {
    const q = echoPose(s, e, tau, _pose);
    W.up[e] = q.shown ? 1 : 0;
    if (!q.shown) continue;
    W.echo[3 * e] = AX + q.x; W.echo[3 * e + 1] = AY + SD_REMNANT_BODY.heartY * ECHO_SCALE - q.sink; W.echo[3 * e + 2] = AZ + q.z; W.how = 2;
  }
  return W;
}
/** Pillar `k`'s pick of what the arena watches (`W`), into `out` - whether it has one. */
function watchedBy(W, k, out) {
  if (W.how === 1) { out[0] = W.one[0]; out[1] = W.one[1]; out[2] = W.one[2]; return true; }
  if (W.how === 0) return false;
  const px = AX + PILLARS[k][0], pz = AZ + PILLARS[k][1];
  let best = Infinity, e0 = -1;
  for (let e = 0; e < 2; e++) {
    if (!W.up[e]) continue;
    const dx = W.echo[3 * e] - px, dz = W.echo[3 * e + 2] - pz, d = dx * dx + dz * dz;
    if (d < best) { best = d; e0 = e; }
  }
  out[0] = W.echo[3 * e0]; out[1] = W.echo[3 * e0 + 1]; out[2] = W.echo[3 * e0 + 2];
  return true;
}
/**
 * WHAT PILLAR `k` WATCHES at `tau` of fight `s`, into `out` (the dungeon's frame) - answers whether it watches anything:
 * the Remnant's heart where it stands (kneeling, rising, waiting for a fight), outside time the nearest Echo standing,
 * once it has fallen the way home's place. Pure.
 */
export const sdWatchedAt = (s, tau, k, out) => watchedBy(watchAt(s, tau), k, out);
/** Dial `d`'s hand pointing at `at` (the dungeon's frame): its angle on the dial's own (u right, v up) - 0 at XII, a
 *  quarter at III - the way from its centre to `at` seen on its plane. Pure. */
export const handToward = (d, at) => Math.atan2((at[0] - d.at[0]) * d.right[0] + (at[2] - d.at[2]) * d.right[2], at[1] - d.at[1]);

const _a0 = new Float64Array(16), _a1 = new Float64Array(16), _seen0 = new Uint8Array(4), _seen1 = new Uint8Array(4);
let _handsOf = null, _handsSec = NaN;
/** Every dial's hand toward what its pillar watches at `at` (ms) of `s`, into `a`; each pillar's whether into `seen`. */
function handsAt(s, at, a, seen) {
  const D = sdPillarDials(), W = watchAt(s, at);
  for (let k = 0; k < 4; k++) {
    seen[k] = watchedBy(W, k, _at) ? 1 : 0;
    for (let j = 0; j < 4; j++) a[4 * k + j] = seen[k] ? handToward(D[4 * k + j], _at) : 0;
  }
}
/**
 * THE WATCHING HANDS at `t` (ms, the relay's clock) of fight `s`, into `out` (16 floats, dial 4k + j - world/sdPillarModel.js
 * sdPillarDials' order): on the escapement - at each anchored second each hand turns from what its pillar watched the
 * second before to what it watches at this one, eased over the tick's first quarter (sdTick) and held. Nothing to watch:
 * XII. Pure over `s` and `t`; the two seconds' hands kept until either moves (once a second - the frame passes no time it
 * made to a call, so it makes nothing).
 */
export function sdPillarHandsAt(s, t, out) {
  if (!s) { out.fill(0); return out; }
  const sec = Math.floor(t / 1000);
  if (s !== _handsOf || sec !== _handsSec) {
    if (s === _handsOf && SD_WATCH_LAG_S === 1 && sec === _handsSec + 1) { _a0.set(_a1); _seen0.set(_seen1); }   // a tick on: the second before is the one that was
    else handsAt(s, (sec - SD_WATCH_LAG_S) * 1000, _a0, _seen0);
    _handsOf = s; _handsSec = sec;
    handsAt(s, sec * 1000, _a1, _seen1);
  }
  const e = sdTick(t / 1000) - sec;
  for (let i = 0; i < 16; i++) {
    const k = i >> 2, d = _a1[i] - _a0[i], turn = d - TAU * Math.round(d / TAU);   // the shorter way round
    out[i] = !_seen1[k] ? 0 : !_seen0[k] ? _a1[i] : _a0[i] + turn * e;
  }
  return out;
}

/**
 * THE RESET'S DIMMING at `t` of fight `s`, into `out[0]` (a kept Float64Array - the frame's share passes from here to the
 * light list and the pass with no number made): the arena's lamps' and lanterns' share of their light - 1 at rest; from
 * the Reset's call down to SD_RESET_DIM.to over its inMs, held through its wind-up; back over its outMs from its landing,
 * or from the stun its last Heart broken calls. Answers `out`. Pure.
 */
export function sdLampDimInto(s, t, out) {
  out[0] = 1;
  if (!s || !(s.fi > 0) || s.lost || s.fell) return out;
  // its easing reckoned here, every number a local (a call's number, or a field's read, boxes one a frame - AUDIT SD II, L2 F9)
  let u = -1, from = 1, by = 0;
  if (s.su > t && s.stunAt > 0) { if (t - s.stunAt < DIM_OUT) { u = (t - s.stunAt) / DIM_OUT; from = DIM_TO; by = 1 - DIM_TO; } }
  else {
    const atk = s.rem?.atk;
    if (!atk || atk.a !== RESET_ID) return out;
    const at = atk.at, called = at - RESET_WINDUP;
    if (t < called) return out;
    if (t < at) { if (t - called < DIM_IN) { u = (t - called) / DIM_IN; by = DIM_TO - 1; } else { out[0] = DIM_TO; return out; } }
    else if (t - at < DIM_OUT) { u = (t - at) / DIM_OUT; from = DIM_TO; by = 1 - DIM_TO; }
  }
  if (u >= 0) { const v = u > 1 ? 1 : u; out[0] = from + by * v * v * (3 - 2 * v); }
  return out;
}
const _dim = new Float64Array(1);
/** The dimming's share at `t` of `s` (sdLampDimInto's), as a number - for a reader off the frame. */
export const sdLampDimAt = (s, t) => sdLampDimInto(s, t, _dim)[0];

/**
 * THE PILLARS' LOOK at `t` of `s`, into `look` (sdPillarLook's - render/sdPillarPass.js's): the hands, the dimming
 * (`k[0]`), and whether the Hour ends (`k[1]` - `glow`, render/sdArenaGlow.js sdArenaGlowAt's word, the numerals' own
 * red). Pure.
 */
export function sdPillarLookAt(s, t, look, glow = null) {
  sdPillarHandsAt(s, t, look.hands);
  sdLampDimInto(s, t, look.k);
  look.k[1] = glow?.end ? 1 : 0;
  return look;
}
/** A look record for sdPillarLookAt, kept by its caller: the hands, and [the dimming, the End]. */
export const sdPillarLook = () => ({ hands: new Float32Array(16), k: Float64Array.of(1, 0) });

const _marks = [markShape([0, 0], 0, SD_MARK_COLOR.remnant, SD_REM.r), markShape([0, 0], 0, SD_MARK_COLOR.echoes[0], SD_ECHO.r), markShape([0, 0], 0, SD_MARK_COLOR.echoes[1], SD_ECHO.r)];
/** The marks picked this frame, and a kept list for each count (none's length ever set: AUDIT SD II, L2 F9). */
const _picked = [null, null, null], _markLists = [[], [null], [null, null], [null, null, null]];
/** A body standing on the floor - shown, and no deeper in it than its kneel (rising, its legs out). */
const onFloor = (p) => p.shown && p.sink <= SD_KNEEL_M + 1e-6;
/**
 * THE MARKS at `t` of fight `s`: one under the Remnant while it stands (waiting, fighting, kneeling - never outside time,
 * fallen, or its fight lost), one under each Echo standing - the telegraph pass's shapes, the arena's frame, kept (one
 * each, refilled: the court's law, AUDIT WB D10). Pure.
 */
export function sdArenaMarksAt(s, t) {
  let n = 0;
  if (s && !s.fell && !(s.fi > 0 && s.lost > 0)) {
    const p = remnantPose(s, t, _pose);
    if (onFloor(p)) { const m = _marks[0]; m.origin[0] = p.x; m.origin[1] = p.z; m.yaw = p.yw; _picked[n++] = m; }
    for (let e = 0; e < 2; e++) {
      if (!(s.ec?.[e]?.h > 0)) continue;
      const q = echoPose(s, e, t, _pose);
      if (onFloor(q)) { const m = _marks[1 + e]; m.origin[0] = q.x; m.origin[1] = q.z; m.yaw = q.yw; _picked[n++] = m; }
    }
  }
  const list = _markLists[n];
  for (let i = 0; i < n; i++) list[i] = _picked[i];
  return list;
}
