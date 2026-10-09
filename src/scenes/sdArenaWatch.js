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
//   THE RESET'S DIMMING (`sdLampDimAt`) - the arena's lamps and lanterns dim to SD_RESET_DIM.to through the Reset's
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

/** The hands' lag: they take where it stood a whole tick ago, eased in over the tick's first quarter (s). */
export const SD_WATCH_LAG_S = 1;
/** The way home's height the hands point at, once it has fallen (m over the floor - its window's middle). */
export const SD_WATCH_HOME_Y = 1.6;
/** THE RESET'S DIMMING: how far down (the lamps' and lanterns' share of their light), how long it takes to dim from the
 *  Reset's call, and to come back from its landing or the stun (ms). */
export const SD_RESET_DIM = Object.freeze({ to: 0.4, inMs: 1500, outMs: 400 });
/** The marks' metals: the Remnant's brass (its blows' own), the Echoes' gold and silver (their hearts'). */
export const SD_MARK_COLOR = Object.freeze({ remnant: SD_BLOW_COLOR.stomp, echoes: SD_HEART_LIGHT.echo });

const RESET = SD_BLOWS.reset;
const ECHO_SCALE = remnantScale(true);
const AX = SD_REALM_ORIGIN[0] + SD_ARENA.x, AY = SD_REALM_ORIGIN[1], AZ = SD_REALM_ORIGIN[2] + SD_ARENA.z;
const _pose = { x: 0, z: 0, yw: 0, sink: 0, shown: false };
const _at = new Float64Array(3), _home = new Float64Array(3);
let _homeOf = NaN;
/** smoothstep over 0..1, clamped. */
const ease = (u) => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };
/** The pillars' centres, the arena's frame (made once). */
const PILLARS = [0, 1, 2, 3].map((k) => { const [x, z] = pillarCentre(k); return [x - SD_ARENA.x, z - SD_ARENA.z]; });

/**
 * WHAT PILLAR `k` WATCHES at `tau` of fight `s`, into `out` (the dungeon's frame) - answers whether it watches anything:
 * the Remnant's heart where it stands (kneeling, rising, waiting for a fight), outside time the nearest Echo standing,
 * once it has fallen the way home's place. Pure.
 */
export function sdWatchedAt(s, tau, k, out) {
  if (s.fi > 0 && s.fell && !s.lost) {
    if (s.fell.at !== _homeOf) { _homeOf = s.fell.at; const [x, z] = clearOfPillars(s.rem.x, s.rem.z); _home[0] = AX + x; _home[1] = AY + SD_WATCH_HOME_Y; _home[2] = AZ + z; }
    out[0] = _home[0]; out[1] = _home[1]; out[2] = _home[2];
    return true;
  }
  const p = remnantPose(s, tau, _pose);
  if (p.shown) { out[0] = AX + p.x; out[1] = AY + SD_REMNANT_BODY.heartY - p.sink; out[2] = AZ + p.z; return true; }
  let best = Infinity;
  const px = PILLARS[k][0], pz = PILLARS[k][1];
  for (let e = 0; e < 2; e++) {
    const q = echoPose(s, e, tau, _pose);
    if (!q.shown) continue;
    const d = (q.x - px) * (q.x - px) + (q.z - pz) * (q.z - pz);
    if (d < best) { best = d; out[0] = AX + q.x; out[1] = AY + SD_REMNANT_BODY.heartY * ECHO_SCALE - q.sink; out[2] = AZ + q.z; }
  }
  return best < Infinity;
}
/** Dial `d`'s hand pointing at `at` (the dungeon's frame): its angle on the dial's own (u right, v up) - 0 at XII, a
 *  quarter at III - the way from its centre to `at` seen on its plane. Pure. */
export const handToward = (d, at) => Math.atan2((at[0] - d.at[0]) * d.right[0] + (at[2] - d.at[2]) * d.right[2], at[1] - d.at[1]);

/**
 * THE WATCHING HANDS at `t` (ms, the relay's clock) of fight `s`, into `out` (16 floats, dial 4k + j - world/sdPillarModel.js
 * sdPillarDials' order): each hand toward what its pillar watched at the escapement's moment - the last whole second,
 * eased in over its first quarter. Nothing to watch: XII. Pure.
 */
export function sdPillarHandsAt(s, t, out) {
  const D = sdPillarDials(), tau = (sdTick(t / 1000) - SD_WATCH_LAG_S) * 1000;
  for (let k = 0; k < 4; k++) {
    const seen = !!s && sdWatchedAt(s, tau, k, _at);
    for (let j = 0; j < 4; j++) out[4 * k + j] = seen ? handToward(D[4 * k + j], _at) : 0;
  }
  return out;
}

/**
 * THE RESET'S DIMMING at `t` of fight `s`: the arena's lamps' and lanterns' share of their light - 1 at rest; from the
 * Reset's call down to SD_RESET_DIM.to over its inMs, held through its wind-up; back over its outMs from its landing, or
 * from the stun its last Heart broken calls. Pure.
 */
export function sdLampDimAt(s, t) {
  if (!s || !(s.fi > 0) || s.lost || s.fell) return 1;
  const D = SD_RESET_DIM, low = 1 - D.to;
  if (s.su > t && s.stunAt > 0) return t - s.stunAt < D.outMs ? D.to + low * ease((t - s.stunAt) / D.outMs) : 1;
  const atk = s.rem?.atk;
  if (!atk || atk.a !== RESET.id) return 1;
  const called = atk.at - RESET.windup;
  if (t < called) return 1;
  if (t < atk.at) return 1 - low * ease((t - called) / D.inMs);
  return D.to + low * ease((t - atk.at) / D.outMs);
}

/**
 * THE PILLARS' LOOK at `t` of `s`, into `look` (`{ hands: Float32Array(16), dim, end }` - render/sdPillarPass.js's): the
 * hands, the dimming, and whether the Hour ends (`glow` - render/sdArenaGlow.js sdArenaGlowAt's word, the numerals' own
 * red). Pure.
 */
export function sdPillarLookAt(s, t, look, glow = null) {
  sdPillarHandsAt(s, t, look.hands);
  look.dim = sdLampDimAt(s, t);
  look.end = glow?.end ? 1 : 0;
  return look;
}
/** A look record for sdPillarLookAt, kept by its caller. */
export const sdPillarLook = () => ({ hands: new Float32Array(16), dim: 1, end: 0 });

const _marks = [markShape([0, 0], 0, SD_MARK_COLOR.remnant, SD_REM.r), markShape([0, 0], 0, SD_MARK_COLOR.echoes[0], SD_ECHO.r), markShape([0, 0], 0, SD_MARK_COLOR.echoes[1], SD_ECHO.r)];
const _markList = [];
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
    if (onFloor(p)) { const m = _marks[0]; m.origin[0] = p.x; m.origin[1] = p.z; m.yaw = p.yw; _markList[n++] = m; }
    for (let e = 0; e < 2; e++) {
      if (!(s.ec?.[e]?.h > 0)) continue;
      const q = echoPose(s, e, t, _pose);
      if (onFloor(q)) { const m = _marks[1 + e]; m.origin[0] = q.x; m.origin[1] = q.z; m.yaw = q.yw; _markList[n++] = m; }
    }
  }
  if (_markList.length !== n) _markList.length = n;
  return _markList;
}
