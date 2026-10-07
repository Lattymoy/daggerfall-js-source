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
import { SD_BLOW_BY_ID, SD_BLOWS, SD_BODY, atkWindup, blowShape, profileOf, stompFrontAt, handSwept, behindPillar, SD_ECHO_PAIR_MS } from '../net/sdRemnant.js';
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

/** Whether (x, z) is in blow `atk`'s ground still to strike at `t` - the Stomp's disc, the Hand's sweep from `t` on
 *  (shade a pillar's), a Volley's mark; null for a shape that is not a place. */
function insideOf(A, atk, t) {
  const S = blowShape(atk) ?? A;   // SD18a: the blow its frame says
  if (A === SD_BLOWS.stomp) return (x, z) => Math.hypot(x - atk.x, z - atk.z) <= S.r;
  if (A === SD_BLOWS.hand) return (x, z) => handSwept(atk, x, z, Math.max(t, atk.at), atk.at + S.active) && !behindPillar(atk.x, atk.z, x, z);
  if (A === SD_BLOWS.volley) return (x, z) => (atk.tg ?? []).some((q) => Math.hypot(x - q[0], z - q[1]) <= S.r);
  return null;
}

/**
 * A BLOW STILL TO COME ON MY FEET, or null (fx, fz my feet in the arena's frame; `yaw` the camera's, for the arrow): the
 * soonest of the Remnant's and its Echoes' blows whose ground I stand in - `{ name, t, now, color, arrow, way }` - or,
 * none of those, the Stomp's ring rolling out toward me within SD_JUMP_CALL_M (`jump`). Pure.
 */
export function sdPerilAt(s, t, fx, fz, yaw = null) {
  if (!s || !(s.fi > 0) || s.fell || s.lost || s.ended > 0 || !Number.isFinite(fx) || !Number.isFinite(fz)) return null;
  const blows = [];
  if (s.rem?.atk) blows.push([SD_BODY.remnant, s.rem.atk]);
  (s.ec ?? []).forEach((E, i) => { if (E.h > 0 && E.atk) blows.push([SD_BODY.gold + i, E.atk]); });
  let best = null, jump = null;
  for (const [b, atk] of blows) {
    const A = SD_BLOW_BY_ID[atk.a];
    if (!A || !Number.isFinite(atk.at)) continue;
    const w = atkWindup(atk, A, s.ph, b), end = atk.at + Math.max((blowShape(atk) ?? A).active, 0);
    if (A === SD_BLOWS.stomp && t >= atk.at && t <= end) {
      const d = Math.hypot(fx - atk.x, fz - atk.z), front = stompFrontAt(atk, t);
      if (d > front && d - front <= SD_JUMP_CALL_M && (!jump || atk.at < jump.at)) jump = { at: atk.at, name: A.name, el: blowShape(atk)?.el ?? null };
      continue;
    }
    const live = A === SD_BLOWS.hand ? t < end : t < atk.at;
    if (!live || t < atk.at - w || (best && best.at <= atk.at)) continue;
    const inside = insideOf(A, atk, t);
    if (!inside || !inside(fx, fz)) continue;
    best = { at: atk.at, name: A.name, t: w > 0 ? Math.max(0, Math.min(1, (t - (atk.at - w)) / w)) : 1, color: sdTint(A.key, blowShape(atk)?.el), inside };   // SD18b: in its floor's colour
  }
  if (best) {
    const way = Number.isFinite(yaw) ? sdWayOut(best.inside, fx, fz) : null;
    return { name: best.name, t: best.t, now: best.at - t <= TELEGRAPH_NOW_MS, color: best.color, arrow: way ? screenBearing(way.dir, /** @type {number} */ (yaw)) : null, way, jump: false };
  }
  if (jump) return { name: jump.name, t: 1, now: true, color: sdTint('stomp', jump.el), arrow: null, way: null, jump: true };
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
        if (s.ph === 2) show('break', t, { ...SD_BEAT_TEXT.break, sub: sdBreakSub(profileOf(s).pairMs) }, '#e8c060');
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
