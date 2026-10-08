// @ts-check
// SD15 (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10 and section 16's SD15;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE ARENA READ - what the Hour tells a fighter about
// the ground under them and the fight's turns, where the gate tells its own (WB13a's "in it", WB13e's title card):
//
//   IN IT (`sdPerilAt`): a blow of the Remnant's or an Echo's still to land ON MY FEET - the Stomp's disc, the
//     Hour-Hand's sweep (unshaded by a pillar), a Volley's mark - the soonest of them: its name, its wind-up's share,
//     whether it is in its last moment, its colour, and the nearest way out (`sdWayOut`, over the arena's floor) as the
//     screen turns it; the Stomp's ring rolling out toward me once it has landed: "jump!" (it is jumped, not run from).
//     The Hour's own blows over the whole floor (the Pulse, the Reset, the End) are none - no step escapes them. Drawn
//     by the gate's own ground view (ui/gateGroundView.js): the rim pulsing in the blow's colour, the warning under the
//     crosshair, the arrow; and the burning brass under my feet felt the same way.
//   THE BEATS (`createSdBeats`): the fight's turns, large, on the Hour's own card (ui/sdTitleCard.js) - its wake, the
//     Dragon Break, the Last Moment, the Hour's last minute, its fall - each heard live alone (a page that comes late
//     shows none of what it missed).
//
// Pure but for the beats' memory. The arena's frame throughout (x, z from its centre). Not a DFU member. Ledger A
// (SUPER-DUNGEONS).
import { SD_ARENA } from '../net/sdBrain.js';
import { SD_BLOW_BY_ID, SD_BLOWS, SD_BODY, SD_PILLARS, atkWindup, blowShape, sdProfileOf, stompFrontAt, SD_ECHO_PAIR_MS } from '../net/sdRemnant.js';
import { SD_PILLAR_W } from '../net/sdBrain.js';
import { TELEGRAPH_NOW_MS } from '../render/gateTelegraph.js';
import { screenBearing } from './gateCourt.js';
import { SD_ELEMENT_COLOR, SD_ELEMENT_GROUND, sdTint } from './sdRemnantBlows.js';
import { sdEndingOf } from '../net/sdMarks.js';
import { TITLE_HOLD_MS, TITLE_IN_MS, TITLE_OUT_MS } from '../ui/gateTitleCard.js';
import { groundViewModel } from '../ui/gateGroundView.js';

/** The way out: this many bearings, stepped this fine, this far at most, kept this far inside the arena's rim. */
export const SD_PERIL_BEARINGS = 24;
export const SD_PERIL_STEP_M = 0.25;
export const SD_PERIL_REACH_M = 20;
export const SD_PERIL_RIM_M = 1;
/** The Stomp's ring called this far before its front reaches me (m). */
export const SD_JUMP_CALL_M = 3;
/** A turn shown this late at most (ms). */
export const SD_BEAT_LATE_MS = 1500;
/** The Hour's last minute. */
export const SD_BEAT_LAST_MS = 60 * 1000;
/** The Dragon Break's charge, by the window its pair falls in (SD18a: the Dragon's Break's ten seconds). */
export const sdBreakSub = (ms) => `Gold and silver - fell them within ${Math.round(ms / 1000)} seconds`;
/** SD18b: its wake's words by its Hollow's Ending - its signature and the Ending it keeps (the table's with none). */
export const sdWakeText = (mk) => { const E = sdEndingOf(mk); return E ? { ...SD_BEAT_TEXT.wake, sub: `${E.sig} - the Ending of ${E.stone}` } : SD_BEAT_TEXT.wake; };
/** The words on the card. */
export const SD_BEAT_TEXT = Object.freeze({
  wake: Object.freeze({ kicker: 'The Shattered Hour', main: 'The Brass Remnant', sub: 'What the Warp kept of the Numidium' }),
  break: Object.freeze({ kicker: 'II', main: 'The Dragon Break', sub: sdBreakSub(SD_ECHO_PAIR_MS) }),
  moment: Object.freeze({ kicker: 'III', main: 'The Last Moment', sub: 'Break its Hearts before the Reset lands' }),
  last: Object.freeze({ kicker: 'The Hour', main: 'Ends in one minute', sub: '' }),
  fell: Object.freeze({ kicker: 'The Brass Remnant', main: 'Undone', sub: '' }),
});
/** The words under the crosshair for the ring. */
export const SD_JUMP_TEXT = (name) => `${name} - jump!`;

/**
 * THE NEAREST WAY OUT of a shape (`inside(x, z)`, the arena's frame) from my feet at (fx, fz), over the arena's floor:
 * `{ dir: [dx, dz], m }`, or null when none is in reach. Pure.
 */
export function sdWayOut(inside, fx, fz) {
  const R = SD_ARENA.r - SD_PERIL_RIM_M;
  let best = null;
  for (let b = 0; b < SD_PERIL_BEARINGS; b++) {
    const a = (b / SD_PERIL_BEARINGS) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
    for (let m = SD_PERIL_STEP_M; m <= SD_PERIL_REACH_M && (!best || m < best.m); m += SD_PERIL_STEP_M) {
      const x = fx + dx * m, z = fz + dz * m;
      if (Math.hypot(x, z) > R) break;
      if (!inside(x, z)) { best = { dx, dz, m }; break; }
    }
  }
  return best ? { dir: [best.dx, best.dz], m: best.m } : null;
}

/** AUDIT SD III (V5): THE HOUR-HAND'S GROUND, made once a frame - net/sdRemnant.js handSwept's own sums over its sweep
 *  from `t` on, and the pillars' shade (behindPillar's two slabs), in plain numbers: the way out asks it a thousand times
 *  a frame, and every call into the law boxed its four numbers (8 KB a frame in a Hand's path). Pinned equal to the law
 *  over a grid of places and moments. */
const _sweep = { ax: 0, az: 0, yw: 0, sw: 1, len: 0, w2: 0, arc: 0, a0: 0, a1: 0, over: false };
export function handSweepOf(atk, S, t, over = false, out = _sweep) {
  const t0 = Math.max(t, atk.at), t1 = atk.at + S.active;
  out.ax = atk.x; out.az = atk.z; out.yw = atk.yw; out.sw = atk.sw ?? 1; out.len = S.len; out.w2 = S.width / 2; out.arc = S.arc;
  out.a0 = S.arc * Math.max(0, (t0 - atk.at) / S.active); out.a1 = S.arc * Math.min(1, (t1 - atk.at) / S.active); out.over = !!over;
  return out;
}
/** Whether (x, z) is in a sweep handSweepOf made - handSwept's test, then the shade unless it stands `over` the pillars. */
export function handSweepHas(H, x, z) {
  const dx = x - H.ax, dz = z - H.az, d = Math.sqrt(dx * dx + dz * dz);
  if (d > H.len || !(H.a1 >= H.a0)) return false;
  const half = d > H.w2 ? Math.asin(H.w2 / d) : Math.PI;
  let r = (Math.atan2(dx, dz) - H.yw + Math.PI) % (2 * Math.PI);   // net/gateBrain.js wrapYaw's
  if (r < 0) r += 2 * Math.PI;
  const u = H.sw * (r - Math.PI) + H.arc / 2;
  if (!(u + half >= H.a0 && u - half <= H.a1)) return false;
  if (H.over) return true;
  const w = SD_PILLAR_W / 2;
  for (let i = 0; i < SD_PILLARS.length; i++) {   // behindPillar(ax, az, x, z): the segment meets a pillar's square short of its far end
    const px = SD_PILLARS[i][0], pz = SD_PILLARS[i][1];
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-9) { if (H.ax < px - w || H.ax > px + w) continue; } else {
      const a = (px - w - H.ax) / dx, b = (px + w - H.ax) / dx;
      t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
      if (t0 > t1) continue;
    }
    if (Math.abs(dz) < 1e-9) { if (H.az < pz - w || H.az > pz + w) continue; } else {
      const a = (pz - w - H.az) / dz, b = (pz + w - H.az) / dz;
      t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
      if (t0 > t1) continue;
    }
    if (t0 < 1) return false;
  }
  return true;
}
/** The blows whose ground is a place (the Stomp's disc, the Hand's sweep, a Volley's marks) - the rest strike the whole
 *  arena, and no step answers them. */
const isPlace = (A) => A === SD_BLOWS.stomp || A === SD_BLOWS.hand || A === SD_BLOWS.volley;
/** Whether (x, z) is in blow `atk`'s ground still to strike at `t` - the Stomp's disc, the Hand's sweep from `t` on
 *  (shade a pillar's - none `over` a pillar's top, AUDIT SD III F8), a Volley's mark (`S` its shape). AUDIT SD III (V5):
 *  one plain function, never a shape's closure - the way out asks it a thousand times a frame, and through a closure
 *  every point's two numbers were boxed: 7-32 KB a frame while a blow stood over my feet. */
function insideAt(A, atk, S, t, over, x, z) {
  if (A === SD_BLOWS.stomp) { const dx = x - atk.x, dz = z - atk.z; return dx * dx + dz * dz <= S.r * S.r; }
  if (A === SD_BLOWS.hand) return handSweepHas(handSweepOf(atk, S, t, over), x, z);
  const tg = atk.tg;
  if (!tg) return false;
  for (let i = 0; i < tg.length; i++) { const dx = x - tg[i][0], dz = z - tg[i][1]; if (dx * dx + dz * dz <= S.r * S.r) return true; }
  return false;
}
/** sdWayOut's walk over a blow's own ground - its numbers its own, nothing made but the answer: one walk a shape (AUDIT
 *  SD III, V5 - one walk for all three kept every place's numbers boxed for the one shape that calls out of it). */
function wayOutOf(A, atk, S, t, over, fx, fz) {
  if (A === SD_BLOWS.stomp) return discWay(atk.x, atk.z, S.r, fx, fz);
  if (A === SD_BLOWS.hand) return sweepWay(handSweepOf(atk, S, t, over), fx, fz);
  return marksWay(atk.tg ?? NO_MARKS, S.r, fx, fz);
}
const NO_MARKS = Object.freeze([]);
/** The steps each bearing's walk takes at most (sdWayOut's SD_PERIL_STEP_M up to SD_PERIL_REACH_M) - the walks count
 *  them whole and take each step's metres from the count: a number stepped by adding boxed itself every step in the
 *  marks' walk, 3 KB a frame while a Volley's mark stood under my feet (AUDIT SD III, V5). */
const PERIL_STEPS = Math.floor(SD_PERIL_REACH_M / SD_PERIL_STEP_M + 1e-9);
const wayOf = (bm, bx, bz) => (bm < Infinity ? { dir: [bx, bz], m: bm } : null);
/** The way out of the Stomp's disc. */
function discWay(ax, az, r, fx, fz) {
  const R2 = (SD_ARENA.r - SD_PERIL_RIM_M) ** 2, r2 = r * r;
  let bm = Infinity, bx = 0, bz = 0;
  for (let b = 0; b < SD_PERIL_BEARINGS; b++) {
    const a = (b / SD_PERIL_BEARINGS) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
    for (let k = 1; k <= PERIL_STEPS; k++) {
      const m = k * SD_PERIL_STEP_M;
      if (m >= bm) break;
      const x = fx + dx * m, z = fz + dz * m;
      if (x * x + z * z > R2) break;
      if ((x - ax) * (x - ax) + (z - az) * (z - az) > r2) { bm = m; bx = dx; bz = dz; break; }
    }
  }
  return wayOf(bm, bx, bz);
}
/** The way out of a Volley's marks. */
function marksWay(tg, r, fx, fz) {
  const R2 = (SD_ARENA.r - SD_PERIL_RIM_M) ** 2, r2 = r * r;
  let bm = Infinity, bx = 0, bz = 0;
  for (let b = 0; b < SD_PERIL_BEARINGS; b++) {
    const a = (b / SD_PERIL_BEARINGS) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
    for (let k = 1; k <= PERIL_STEPS; k++) {
      const m = k * SD_PERIL_STEP_M;
      if (m >= bm) break;
      const x = fx + dx * m, z = fz + dz * m;
      if (x * x + z * z > R2) break;
      let inside = false;
      for (let i = 0; i < tg.length && !inside; i++) inside = (x - tg[i][0]) * (x - tg[i][0]) + (z - tg[i][1]) * (z - tg[i][1]) <= r2;
      if (!inside) { bm = m; bx = dx; bz = dz; break; }
    }
  }
  return wayOf(bm, bx, bz);
}
/** The way out of the Hour-Hand's sweep - handSweepHas's own sums in the walk itself (a call a place boxed its two
 *  numbers: 12 KB a frame). Pinned equal to sdWayOut over handSweepHas. */
function sweepWay(H, fx, fz) {
  const R2 = (SD_ARENA.r - SD_PERIL_RIM_M) ** 2, w = SD_PILLAR_W / 2, ax = H.ax, az = H.az;
  if (!(H.a1 >= H.a0)) return null;
  let bm = Infinity, bx = 0, bz = 0;
  for (let b = 0; b < SD_PERIL_BEARINGS; b++) {
    const a = (b / SD_PERIL_BEARINGS) * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a);
    for (let k = 1; k <= PERIL_STEPS; k++) {
      const m = k * SD_PERIL_STEP_M;
      if (m >= bm) break;
      const x = fx + sx * m, z = fz + sz * m;
      if (x * x + z * z > R2) break;
      const dx = x - ax, dz = z - az, d = Math.sqrt(dx * dx + dz * dz);   // never Math.hypot: its builtin boxes its arguments
      let inside = d <= H.len;
      if (inside) {
        const half = d > H.w2 ? Math.asin(H.w2 / d) : Math.PI;
        let r = (Math.atan2(dx, dz) - H.yw + Math.PI) % (2 * Math.PI);
        if (r < 0) r += 2 * Math.PI;
        const u = H.sw * (r - Math.PI) + H.arc / 2;
        inside = u + half >= H.a0 && u - half <= H.a1;
      }
      if (inside && !H.over) {
        for (let i = 0; i < SD_PILLARS.length && inside; i++) {
          const px = SD_PILLARS[i][0], pz = SD_PILLARS[i][1];
          let t0 = 0, t1 = 1, cut = true;
          if (Math.abs(dx) < 1e-9) { if (ax < px - w || ax > px + w) cut = false; } else {
            const p = (px - w - ax) / dx, q = (px + w - ax) / dx;
            t0 = Math.max(t0, Math.min(p, q)); t1 = Math.min(t1, Math.max(p, q));
            if (t0 > t1) cut = false;
          }
          if (cut) {
            if (Math.abs(dz) < 1e-9) { if (az < pz - w || az > pz + w) cut = false; } else {
              const p = (pz - w - az) / dz, q = (pz + w - az) / dz;
              t0 = Math.max(t0, Math.min(p, q)); t1 = Math.min(t1, Math.max(p, q));
              if (t0 > t1) cut = false;
            }
          }
          if (cut && t0 < 1) inside = false;
        }
      }
      if (!inside) { bm = m; bx = sx; bz = sz; break; }
    }
  }
  return wayOf(bm, bx, bz);
}

/**
 * A BLOW STILL TO COME ON MY FEET, or null (fx, fz my feet in the arena's frame; `yaw` the camera's, for the arrow): the
 * soonest of the Remnant's and its Echoes' blows whose ground I stand in - `{ name, t, now, color, arrow, way }` - or,
 * none of those, the Stomp's ring rolling out toward me within SD_JUMP_CALL_M (`jump`). `over`: my feet on or over a
 * pillar's top (AUDIT SD III F8 - the verdict's own shade). Pure.
 */
export function sdPerilAt(s, t, fx, fz, yaw = null, over = false) {
  if (!s || !(s.fi > 0) || s.fell || s.lost || s.ended > 0 || !Number.isFinite(fx) || !Number.isFinite(fz)) return null;
  // AUDIT SD III (V5): the blows walked in place - no list of them, no closure a blow, no object until there is a peril
  let bestAtk = null, bestA = null, bestW = 0, jumpAtk = null;
  const ec = s.ec, n = ec ? ec.length : 0;
  for (let i = -1; i < n; i++) {
    const atk = i < 0 ? s.rem?.atk : ec[i].h > 0 ? ec[i].atk : null;
    if (!atk) continue;
    const A = SD_BLOW_BY_ID[atk.a];
    if (!A || !Number.isFinite(atk.at)) continue;
    const S = blowShape(atk) ?? A, w = atkWindup(atk, A, s.ph, i < 0 ? SD_BODY.remnant : SD_BODY.gold + i), end = atk.at + Math.max(S.active, 0);
    if (A === SD_BLOWS.stomp && t >= atk.at && t <= end) {
      const ddx = fx - atk.x, ddz = fz - atk.z, d = Math.sqrt(ddx * ddx + ddz * ddz), front = stompFrontAt(atk, t);   // never Math.hypot (V5)
      if (d > front && d - front <= SD_JUMP_CALL_M && (!jumpAtk || atk.at < jumpAtk.at)) jumpAtk = atk;
      continue;
    }
    const live = A === SD_BLOWS.hand ? t < end : t < atk.at;
    if (!live || t < atk.at - w || (bestAtk && bestAtk.at <= atk.at) || !isPlace(A) || !insideAt(A, atk, S, t, over, fx, fz)) continue;
    bestAtk = atk; bestA = A; bestW = w;
  }
  if (bestAtk && bestA) {
    const S = blowShape(bestAtk) ?? bestA, way = Number.isFinite(yaw) ? wayOutOf(bestA, bestAtk, S, t, over, fx, fz) : null;
    const tt = bestW > 0 ? Math.max(0, Math.min(1, (t - (bestAtk.at - bestW)) / bestW)) : 1;
    return { name: bestA.name, t: tt, now: bestAtk.at - t <= TELEGRAPH_NOW_MS, color: sdTint(bestA.key, S.el), arrow: way ? screenBearing(way.dir, /** @type {number} */ (yaw)) : null, way, jump: false };   // SD18b: in its floor's colour
  }
  if (jumpAtk) return { name: SD_BLOWS.stomp.name, t: 1, now: true, color: sdTint('stomp', blowShape(jumpAtk)?.el), arrow: null, way: null, jump: true };
  return null;
}

/**
 * THE FIGHT'S BEATS as one page sees them: `frame(s, t)` answers the beat standing now ({ kind, at, until, kicker, main,
 * sub, color } on the fight's clock) or null. Each turn is shown as it happens, and only then: its wake, the Dragon
 * Break, the Last Moment, the Hour's last minute, its fall - each beat once a fight; a page that comes late takes the
 * fight as it stands.
 */
export function createSdBeats() {
  let k = null, beat = null;
  const show = (kind, at, words, color = null) => { beat = { kind, at, until: at + TITLE_IN_MS + TITLE_HOLD_MS + TITLE_OUT_MS, ...words, color }; };
  return {
    frame(s, t) {
      if (!s || !(s.fi > 0) || !Number.isFinite(t)) { k = null; beat = null; return null; }
      if (!k || k.fi !== s.fi) {
        k = { fi: s.fi, awake: t >= s.op, ph: s.ph, last: Number.isFinite(s.ends) && s.ends - t <= SD_BEAT_LAST_MS, fell: !!s.fell };
        beat = null;
        return null;
      }
      const awake = t >= s.op;
      if (awake && !k.awake && t - s.op < SD_BEAT_LATE_MS) show('wake', s.op, sdWakeText(s.mk));
      k.awake = awake;
      if (s.ph !== k.ph) {
        if (s.ph === 2) show('break', t, { ...SD_BEAT_TEXT.break, sub: sdBreakSub(sdProfileOf(s).pairMs) }, '#e8c060');
        else if (s.ph === 3) show('moment', t, SD_BEAT_TEXT.moment, '#9cffc8');
        k.ph = s.ph;
      }
      const last = Number.isFinite(s.ends) && s.ends - t <= SD_BEAT_LAST_MS && t < s.ends && !s.fell && !s.lost;
      if (last && !k.last) show('last', t, SD_BEAT_TEXT.last, '#ff6a5a');
      k.last = k.last || last;
      if (s.fell && !k.fell) { k.fell = true; if (t - s.fell.at < SD_BEAT_LATE_MS) show('fell', s.fell.at, SD_BEAT_TEXT.fell); }
      if (beat && t >= beat.until) beat = null;
      return beat;
    },
    /** Out of the Hour: forgotten. */
    leave() { k = null; beat = null; },
  };
}

/** The burning brass's name under the crosshair. */
export const SD_BURNING_GROUND = 'Burning brass';
/** The burning brass's colour (scenes/sdRemnantBlows.js SD_POOL_COLOR's). */
const POOL_RGB = Object.freeze([1.0, 0.45, 0.16]);
/**
 * WHAT THE GROUND VIEW SAYS IN THE HOUR (ui/gateGroundView.js groundViewModel - the gate's own rim, warning and arrow):
 * the burning brass under my feet (`burning`), a blow still to come on them (`peril`, sdPerilAt's) - the Stomp's ring
 * in its own words, "jump!". Pure.
 */
export function sdGroundModel({ burning = false, el = null, now, peril = null }) {
  // SD18b: the brass in its Ending's element - its name and colour (rimed, charged, venomed, soul-lit)
  const m = groundViewModel({ inside: !!burning, ground: (el && SD_ELEMENT_GROUND[el]) || SD_BURNING_GROUND, color: (el && SD_ELEMENT_COLOR[el]) || POOL_RGB, now, peril });
  return m && peril?.jump ? { ...m, warn: SD_JUMP_TEXT(peril.name) } : m;
}
