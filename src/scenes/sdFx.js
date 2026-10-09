// @ts-check
// SD16 (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10 and section 16's SD16;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE BLOWS SEEN - the Hour's landings, turns and fall
// as bursts of sparks, the camera shaken and the floor lit. The Warden's court throws 12 kinds of burst, shakes the
// camera under 7 of his landings and lights his (render/gateFx.js, world/gateBoss.js LAND_SHAKE); the Hour threw none.
//
//   THE BURSTS (`SD_FX_KINDS`, 17 kinds, drawn by the gate's own spark pass - render/gateFx.js GateFxRenderer, its
//     kinds and colours the Hour's): the Stomp's landing at its feet and its ring's dust thrown up as it rolls; the
//     Hour-Hand's light out of its chest; the Volley's gears where each lands; the Pulse, the Reset and the End over the
//     arena's heart in the Mantella's green, its white and red; each Echo risen and broken, in gold or silver; each
//     Heart risen and broken; the stun; its wake's dust; its gears slipping as it falls under a fifth; its fall (a
//     burst out of its chest, then a column of brass as its body sinks) and the way home's pale light rising.
//   THE SHAKES (`SD_SHAKE`, 9, under the player's own maxShake - systems/betterAmbience.js weaponKick, the gate's door):
//     by how near a landing fell to my feet, or the whole arena for the Hour's own.
//   THE LIGHTS: a landing's flash where it fell (FX_LIGHT_MS, fading), the fall's white-gold over the arena.
//
// Read off the fight this page holds, each turn as it happens (a page that comes late takes the fight as it stands - the
// voice's law, scenes/sdRemnantVoice.js). Not a DFU member. Ledger A (SUPER-DUNGEONS).
//
// SD-LOOK S9 (2026-10-09, bible/11-Multiplayer/Super-Dungeons-Look.md sections 3 and 8): THE REWIND - where the Hour
// casts me back from the Steps' void, a gold burst plays BACKWARDS where I land: its sparks gather up off the stone (and
// up from under its rim) and converge on me, white-hot as they arrive, its light swelling to them (`SD_FX_REWIND`, a kind
// of its own beside the blows' - time runs back inside the Hour). No veil, the words as they were (scenes/world.js
// sdCastBack). Seen from my own feet: fallen to the void's floor one frame, standing on a checkpoint's landing the next
// (world/sdSteps.js castBackTo - nothing else moves a body so), so no host is asked.
import { SD_ARENA, SD_REALM_ORIGIN, realmToDungeon, dungeonToRealm } from '../net/sdBrain.js';
import { SD_CHECKPOINTS, SD_VOID_Y } from '../world/sdSteps.js';
import { SD_BLOW_BY_ID, SD_BLOWS, SD_BODY, SD_REM, SD_ECHO, SD_ARENA_SLACK, stompFrontAt, handAngleAt, inArena } from '../net/sdRemnant.js';
import { sdBodyAt } from '../net/sdFightLink.js';
import { GateFxRenderer, FX_BURST_MS, FX_BURSTS_MAX, FX_LIGHT_MS } from '../render/gateFx.js';
import { SD_REM_SINK_MS } from './sdRemnant.js';
import { SD_SLIP_FRAC } from './sdRemnantVoice.js';
import { clearOfPillars } from './sdSpoils.js';
import { sdEndingOf } from '../net/sdMarks.js';
/** SD18c: the Hearts' and the stun's light - its Hollow's Ending's (net/sdMarks.js), else the Mantella's. */
export const sdHeartColorOf = (s) => sdEndingOf(s?.mk)?.light ?? SD_FX_COLOR.heart;

const kind = (share, power, grit, light = null) => Object.freeze({ share, power, grit, ...(light ? { light: Object.freeze(light) } : {}) });
/** THE BURSTS: each kind's share of the sparks, its power, whether it is the brass's grit, and the light it throws
 *  ([intensity, reach m]) - 17 kinds. */
export const SD_FX_KINDS = Object.freeze({
  stomp: kind(0.8, 1.15, true, [1.2, 9]), ring: kind(0.18, 0.4, true), hand: kind(0.45, 0.8, false, [1.0, 8]), volley: kind(0.4, 0.75, true, [0.8, 5]),
  pulse: kind(0.7, 1.3, false, [2.0, 30]), reset: kind(1, 1.6, false, [3.0, 40]), end: kind(1, 2, false, [4.0, 45]),
  echoRise: kind(0.6, 0.9, false, [1.0, 8]), echoFall: kind(0.9, 1.3, true, [1.5, 10]), heartRise: kind(0.3, 0.45, false), heartBreak: kind(0.5, 0.8, false, [1.0, 6]),
  stun: kind(0.6, 0.9, false, [1.2, 12]), wake: kind(0.7, 0.9, true), slip: kind(0.45, 0.7, true), fall: kind(1, 2, false), column: kind(0.7, 1.2, true), home: kind(0.5, 0.7, false, [1.0, 8]),
});
/** SD-LOOK S9: THE REWIND's kind - its sparks' share, their power, gold (never the grit), its light swelling to the end; and
 *  how near the void's floor my feet were the frame before (m above it), how near a checkpoint's landing they stand now
 *  (m), and how high over my feet its sparks gather (m). */
export const SD_FX_REWIND = kind(0.75, 0.55, false, [1.4, 7]);
export const SD_REWIND_SEEN = Object.freeze({ fell: 1.5, landed: 0.6, chest: 1.0, gap: 500 });
/** Each checkpoint's island as a burst's floor's edge ([x, z, radius], the dungeon's frame): where the rewind's sparks
 *  rest, and past which they rise from under its rim. */
const SD_REWIND_EDGES = Object.freeze(SD_CHECKPOINTS.map((C) => { const at = realmToDungeon(C.x, C.y, C.z); return Object.freeze([at[0], at[2], C.r]); }));
/** SD-LOOK S9: whether my feet, realm y `wasY` the frame before and realm (x, y, z) now, were cast back - fallen to the void's
 *  floor and standing on a checkpoint's landing: its index, else -1. Pure. */
export function sdCastBackSeen(wasY, x, y, z) {
  if (!(wasY < SD_VOID_Y + SD_REWIND_SEEN.fell)) return -1;
  for (let k = 0; k < SD_CHECKPOINTS.length; k++) { const c = SD_CHECKPOINTS[k]; if (Math.abs(x - c.x) < SD_REWIND_SEEN.landed && Math.abs(z - c.z) < SD_REWIND_SEEN.landed && Math.abs(y - c.y) < SD_REWIND_SEEN.landed) return k; }
  return -1;
}
/** Their colours (linear rgb): the brass, its gold and silver Echoes, the Mantella's green, the Reset's white-green, the
 *  End's red, the Hearts' light, the way home's pale. */
export const SD_FX_COLOR = Object.freeze({
  brass: Object.freeze([1.0, 0.68, 0.28]), gold: Object.freeze([1.0, 0.82, 0.35]), silver: Object.freeze([0.82, 0.88, 1.0]), mantella: Object.freeze([0.45, 1.0, 0.6]),
  reset: Object.freeze([0.7, 1.0, 0.85]), end: Object.freeze([1.0, 0.32, 0.26]), heart: Object.freeze([0.6, 1.0, 0.8]), pale: Object.freeze([0.85, 0.9, 1.0]),
});
/** THE SHAKES: [at nought metres, the reach it fades to nothing over - none: the whole arena] - 9. */
export const SD_SHAKE = Object.freeze({
  stomp: Object.freeze([2.5, 14]), volley: Object.freeze([1.2, 6]), pulse: Object.freeze([1.5, 0]), reset: Object.freeze([3, 0]), end: Object.freeze([5, 0]),
  fall: Object.freeze([4, 0]), echoFall: Object.freeze([1.5, 10]), wake: Object.freeze([2, 0]), stun: Object.freeze([1.5, 20]),
});
/** The shake of `kind` at feet `d` metres from it. Pure. */
export const sdShake = (k, d) => { const w = SD_SHAKE[k]; return !w ? 0 : !(w[1] > 0) ? w[0] : w[0] * Math.max(0, 1 - d / w[1]); };
/** A turn shown this late at most (ms), a landing this late; the fall's column: this many bursts, this far apart, from its
 *  thud; its flash. */
export const SD_FX_LATE_MS = 1500;
export const SD_FX_LAND_LATE_MS = 500;
export const SD_FX_COLUMN = Object.freeze({ n: 3, at: 1500, step: 250 });
export const SD_FX_FLASH_MS = 400;
/** The Stomp's ring throws its dust at this many points, this long into its roll. */
export const SD_RING_DUST = Object.freeze({ n: 6, after: 400 });
/** AUDIT SD III (V1): THE ARENA'S FLOOR, the dungeon's frame - where every burst's sparks come to rest (render/gateFx.js
 *  `floor`). None was ever said, and the gate's pass rests a burst's sparks at its own height when none is: eleven of the
 *  seventeen kinds - the Pulse's, the Hearts', an Echo's, the stun's, the fall's - piled their spent sparks on an unseen
 *  pane 1.2-4.4 m in the air. */
export const SD_FX_FLOOR_Y = realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z)[1];
/** AUDIT SD IV (R3): AND WHERE IT ENDS - its centre (the dungeon's x, z) and its rim (SD_ARENA.r, where the blows' floor
 *  marking is clipped, render/gateTelegraph.js): the gate's pass rested a spark that ran past it on air over the void. */
export const SD_FX_EDGE = Object.freeze([realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z)[0], realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z)[2], SD_ARENA.r]);
/** The fall's white-gold flash: six metres over the arena's heart (the dungeon's frame). */
const FLASH_AT = Object.freeze(realmToDungeon(SD_ARENA.x, 6, SD_ARENA.z));
/** A body with no place: the arena's heart. */
const NO_PLACE = Object.freeze([0, 0]);
/** AUDIT SD III (V3): the Hour-Hand's flash stands this far before its body's chest, on the beam's first bearing - at
 *  the chest a metre up, it stood inside the Remnant's heart crystal, lighting its inside. */
export const SD_HAND_FLASH_OUT = 1.2;

/**
 * The Hour's blows seen on this screen. `link` the fight's (net/sdFightLink.js), `feet()` mine in the dungeon's frame
 * (null out of the Hour), `shake(k)` the camera's door.
 * @param {{ link: any, feet?: () => (number[] | null), shake?: (k: number) => void }} deps
 */
export function createSdFx({ link, feet = () => null, shake = () => {} }) {
  /** @type {Array<{ at: number[], at0: number, t: number, kind: any, color: ReadonlyArray<number>, floor: number, edge: ReadonlyArray<number> }>} */
  const bursts = [];
  let k = null, pass = null, passTried = false, flashAt = -Infinity, wasY = NaN, wasAt = -Infinity;
  const live = [];
  /** AUDIT SD III (V5): the lights a frame reads, kept and filled in place - each a pooled `{ x, y, z, range, color }`
   *  (a caller reads them that frame, never later) */
  const lit = [], litPool = [];
  let nLit = 0;
  const putLight = (x, y, z, range, r, g, b) => {
    let o = litPool[nLit];
    if (!o) { o = { x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0] }; litPool[nLit] = o; }
    o.x = x; o.y = y; o.z = z; o.range = range; o.color[0] = r; o.color[1] = g; o.color[2] = b;
    lit[nLit++] = o;
  };
  const where = (x, y, z) => realmToDungeon(SD_ARENA.x + x, y, SD_ARENA.z + z);
  const add = (p, at0, kd, color, floor = SD_FX_FLOOR_Y) => {   // AUDIT SD III (V1): on the arena's floor
    let b = bursts.length < FX_BURSTS_MAX ? null : bursts.reduce((o, q) => (q.at0 < o.at0 ? q : o));
    if (!b) { b = { at: [0, 0, 0], at0: 0, t: 0, kind: kd, color, floor: NaN, edge: SD_FX_EDGE }; bursts.push(b); } else b.edge = SD_FX_EDGE;   // AUDIT SD IV (R3): the arena's edge (SD-LOOK S9: a slot a rewind had, given back its arena's - the rewind says its own)
    b.at[0] = p[0]; b.at[1] = p[1]; b.at[2] = p[2]; b.at0 = at0; b.kind = kd; b.color = color; b.floor = floor;
    return b;
  };
  /** SD-LOOK S9: THE REWIND where my feet (the dungeon's frame) landed on checkpoint `c` at `t` - its sparks gathering over
   *  my feet, resting on its stone and falling past its rim. */
  const rewound = (f, c, t) => { add([f[0], f[1] + SD_REWIND_SEEN.chest, f[2]], t, SD_FX_REWIND, SD_FX_COLOR.gold, f[1]).edge = SD_REWIND_EDGES[c]; };
  /** My feet in the arena's frame, or null. */
  const mine = () => { const f = feet(); if (!f) return null; const r = dungeonToRealm(f[0], f[1], f[2]); return [r[0] - SD_ARENA.x, r[2] - SD_ARENA.z]; };
  // AUDIT SD III (V4): the whole arena's shakes (a reach of nought) are felt in the arena alone - the Hall and the Steps
  // were kicked by every Pulse, Reset and End, which strike nobody there
  const felt = (kd, x, z) => { const m = mine(); if (!m) return; if (!(SD_SHAKE[kd]?.[1] > 0) && !inArena(m[0], m[1], SD_ARENA_SLACK)) return; const s = sdShake(kd, Math.hypot(m[0] - x, m[1] - z)); if (s >= 0.05) shake(s); };
  const bodyOf = (s, b) => (b === SD_BODY.remnant ? s.rem : b === SD_BODY.hour ? null : s.ec?.[b - SD_BODY.gold]);
  const colorOf = (b) => (b === SD_BODY.gold ? SD_FX_COLOR.gold : b === SD_BODY.silver ? SD_FX_COLOR.silver : SD_FX_COLOR.brass);
  const blowsOf = (s) => {
    const out = [];
    if (s.rem?.atk) out.push([SD_BODY.remnant, s.rem.atk]);
    (s.ec ?? []).forEach((E, i) => { if (E.h > 0 && E.atk) out.push([SD_BODY.gold + i, E.atk]); });
    if (s.clk) out.push([SD_BODY.hour, s.clk]);
    return out;
  };
  const seen = (s, t) => ({
    fi: s.fi, awake: t >= s.op, stun: t < s.su, fell: !!s.fell, slipped: s.m > 0 && s.h / s.m < SD_SLIP_FRAC, column: SD_FX_COLUMN.n, home: true,
    ec: (s.ec ?? []).map((E) => E.h > 0), cx: s.cx ? s.cx.i : null, hearts: s.cx ? s.cx.c.map((q) => q[2]) : [], cxc: s.cx ? s.cx.c : [],
    blows: new Set(blowsOf(s).filter(([, a]) => t >= a.at).map(([, a]) => a.i)),
  });
  /** A blow's landing, seen: its bursts, its shake and its light. */
  function landed(s, b, a, t) {
    const A = SD_BLOW_BY_ID[a.a];
    if (!A) return;
    const B = bodyOf(s, b), [bx, bz] = B ? sdBodyAt(B, a.at) : [0, 0], color = colorOf(b);
    if (A === SD_BLOWS.stomp) {
      add(where(a.x, 0.1, a.z), a.at, SD_FX_KINDS.stomp, color);
      const r = stompFrontAt(a, a.at + SD_RING_DUST.after);
      for (let i = 0; i < SD_RING_DUST.n; i++) {   // AUDIT SD IV (R3): none past the rim - the ring is not drawn there, and its dust rose out of the void
        const g = (i / SD_RING_DUST.n) * Math.PI * 2, x = a.x + Math.sin(g) * r, z = a.z + Math.cos(g) * r;
        if (Math.hypot(x, z) <= SD_ARENA.r) add(where(x, 0.1, z), a.at + SD_RING_DUST.after, SD_FX_KINDS.ring, color);
      }
      felt('stomp', a.x, a.z);
    } else if (A === SD_BLOWS.hand) {
      // AUDIT SD III (V3): out of its chest along the beam's first bearing - never inside the heart crystal
      const g = handAngleAt(a, a.at) ?? a.yw ?? 0, out = (b === SD_BODY.remnant ? SD_REM.r : SD_ECHO.r) + SD_HAND_FLASH_OUT;
      add(where(bx + Math.sin(g) * out, (b === SD_BODY.remnant ? SD_REM.h : SD_ECHO.h) * 0.55, bz + Math.cos(g) * out), a.at, SD_FX_KINDS.hand, b === SD_BODY.remnant ? SD_FX_COLOR.gold : color);
    }
    else if (A === SD_BLOWS.volley) {
      for (const q of a.tg ?? []) add(where(q[0], 0.1, q[1]), a.at, SD_FX_KINDS.volley, color);
      const m = mine();
      if (m && (a.tg ?? []).length) felt('volley', ...(a.tg.reduce((o, q) => (Math.hypot(q[0] - m[0], q[1] - m[1]) < Math.hypot(o[0] - m[0], o[1] - m[1]) ? q : o))));
    } else if (A === SD_BLOWS.pulse) { add(where(0, 2, 0), a.at, SD_FX_KINDS.pulse, SD_FX_COLOR.mantella); felt('pulse', 0, 0); }
    else if (A === SD_BLOWS.reset) { if (!(s.su > a.at)) { add(where(0, 3, 0), a.at, SD_FX_KINDS.reset, SD_FX_COLOR.reset); felt('reset', 0, 0); } }
    else if (A === SD_BLOWS.end) { add(where(0, 3, 0), a.at, SD_FX_KINDS.end, SD_FX_COLOR.end); felt('end', 0, 0); }
  }

  /** Its body's place at `t`, `y` up - `{ p, x, z }`, kept (a turn's burst copies `p`). */
  const _rem = { p: [0, 0, 0], x: 0, z: 0 }, _remAt = [0, 0];
  const remAt = (s, t, y) => { const at = s.rem ? sdBodyAt(s.rem, t, _remAt) : NO_PLACE; _rem.x = at[0]; _rem.z = at[1]; _rem.p = where(at[0], y, at[1]); return _rem; };
  /** A Heart's burst, risen or broken, in its Ending's light. */
  const heartBurst = (s, t, q, kd) => add(where(q[0], 1.2, q[1]), t, kd, sdHeartColorOf(s));
  /** A blow seen landing once (the newest 48 remembered). */
  const landing = (s, b, a, t) => {
    if (k.blows.has(a.i) || t < a.at) return;
    k.blows.add(a.i);
    if (k.blows.size > 48) k.blows.delete(k.blows.values().next().value);
    if (t - a.at < SD_FX_LAND_LATE_MS) landed(s, b, a, t);
  };

  return {
    /** One frame: every landing and turn since the last, seen. */
    frame() {
      const s = link?.state?.(), t = link?.now?.();
      for (let i = bursts.length - 1; i >= 0; i--) if (Number.isFinite(t) && t - bursts[i].at0 > FX_BURST_MS + 200) bursts.splice(i, 1);
      // SD-LOOK S9: my feet cast back from the Steps' void - the rewind where they land (the realm's frame by
      // net/sdBrain.js dungeonToRealm's own sum: a frame makes nothing)
      const f = feet();
      if (f) {
        const rx = f[0] - SD_REALM_ORIGIN[0], ry = f[1] - SD_REALM_ORIGIN[1], rz = f[2] - SD_REALM_ORIGIN[2], c = t - wasAt < SD_REWIND_SEEN.gap ? sdCastBackSeen(wasY, rx, ry, rz) : -1;   // the frame before, and only just before
        if (c >= 0) rewound(f, c, t);
        wasY = ry; wasAt = Number.isFinite(t) ? t : -Infinity;
      } else wasY = NaN;
      if (!s || !(s.fi > 0) || !Number.isFinite(t)) { k = null; return; }
      if (!k || k.fi !== s.fi) { k = seen(s, t); return; }
      // its fall: the burst out of its chest and the flash, then the column as it sinks, then the way home's light
      if (s.fell && !k.fell) {
        k.fell = true;
        if (t - s.fell.at < SD_FX_LATE_MS) { const r = remAt(s, t, SD_REM.h * 0.5); add(r.p, s.fell.at, SD_FX_KINDS.fall, SD_FX_COLOR.gold); flashAt = s.fell.at; felt('fall', r.x, r.z); k.column = 0; k.home = false; }
      }
      if (s.fell) {
        const since = t - s.fell.at, [x, z] = s.rem ? sdBodyAt(s.rem, s.fell.at) : [0, 0];
        for (; k.column < SD_FX_COLUMN.n && since >= SD_FX_COLUMN.at + k.column * SD_FX_COLUMN.step; k.column++) add(where(x, 0.1, z), s.fell.at + SD_FX_COLUMN.at + k.column * SD_FX_COLUMN.step, SD_FX_KINDS.column, SD_FX_COLOR.brass);
        if (!k.home && since >= SD_REM_SINK_MS) { k.home = true; const [hx, hz] = clearOfPillars(x, z); add(where(hx, 0.1, hz), s.fell.at + SD_REM_SINK_MS, SD_FX_KINDS.home, SD_FX_COLOR.pale); }
        return;
      }
      if (s.lost) return;
      // its wake, the stun, the slip
      const awake = t >= s.op;
      if (awake && !k.awake && t - s.op < SD_FX_LATE_MS) { const r = remAt(s, t, 0.1); add(r.p, s.op, SD_FX_KINDS.wake, SD_FX_COLOR.brass); felt('wake', r.x, r.z); }
      k.awake = awake;
      const stun = t < s.su;
      if (stun && !k.stun) { const r = remAt(s, t, SD_REM.h * 0.6); add(r.p, t, SD_FX_KINDS.stun, sdHeartColorOf(s)); felt('stun', r.x, r.z); }
      k.stun = stun;
      if (!k.slipped && s.m > 0 && s.h / s.m < SD_SLIP_FRAC) { k.slipped = true; add(remAt(s, t, SD_REM.h * 0.5).p, t, SD_FX_KINDS.slip, SD_FX_COLOR.brass); }
      // its Echoes risen and broken (AUDIT SD III, V5: walked in place - a frame of a living fight made 496 bytes)
      const ec = s.ec;
      if (ec) {
        for (let i = 0; i < ec.length; i++) {
          const E = ec[i], up = E.h > 0, was = k.ec[i] ?? false;
          if (up !== was) {
            const [x, z] = sdBodyAt(E, t), color = i === 0 ? SD_FX_COLOR.gold : SD_FX_COLOR.silver;
            if (up) add(where(x, SD_ECHO.h * 0.5, z), t, SD_FX_KINDS.echoRise, color);
            else { add(where(x, SD_ECHO.h * 0.5, z), t, SD_FX_KINDS.echoFall, color); felt('echoFall', x, z); }
          }
          k.ec[i] = up;
        }
      } else if (k.ec.length) k.ec = [];
      // the Hearts risen and broken - the last one's break and the Hearts' going in one word (the stun's) seen as one
      const X = s.cx;
      if (X && X.i !== k.cx) {
        k.cx = X.i; k.hearts = X.c.map((q) => q[2]); k.cxc = X.c;
        for (let j = 0; j < X.c.length; j++) heartBurst(s, t, X.c[j], SD_FX_KINDS.heartRise);
      } else if (X) {
        for (let j = 0; j < X.c.length; j++) { const q = X.c[j]; if ((k.hearts[j] ?? 0) > 0 && !(q[2] > 0)) heartBurst(s, t, q, SD_FX_KINDS.heartBreak); k.hearts[j] = q[2]; }
        k.cxc = X.c;
      } else if (k.cx !== null || k.hearts.length || k.cxc.length) {
        // AUDIT SD III (V10): the Hearts left standing burst as they go - broken (the stun's word) or spent by the Reset's
        // landing, which took them out of the air with nothing to show for it
        if (k.cx !== null) for (let j = 0; j < k.cxc.length; j++) { if ((k.hearts[j] ?? 0) > 0) heartBurst(s, t, k.cxc[j], SD_FX_KINDS.heartBreak); }
        k.cx = null; k.hearts = []; k.cxc = [];
      }
      // the landings
      if (s.rem?.atk) landing(s, SD_BODY.remnant, s.rem.atk, t);
      if (ec) for (let i = 0; i < ec.length; i++) if (ec[i].h > 0 && ec[i].atk) landing(s, SD_BODY.gold + i, ec[i].atk, t);
      if (s.clk) landing(s, SD_BODY.hour, s.clk, t);
    },
    /** The bursts standing at `t` (the fight's clock), as the spark pass takes them. */
    bursts(t) {
      live.length = 0;
      for (const b of bursts) {
        b.t = (t - b.at0) / 1000;
        if (b.kind === SD_FX_REWIND) b.t = b.t >= 0 ? FX_BURST_MS / 1000 - b.t : -1;   // SD-LOOK S9: the rewind runs its burst backwards
        if (b.t >= 0 && b.t < FX_BURST_MS / 1000) live.push(b);
      }
      return live;
    },
    /** The light the landings throw at `t`: each lit burst's flash where it fell, fading over FX_LIGHT_MS, and the fall's
     *  white-gold over the arena - in the Hour's light channel. */
    lights(t) {
      nLit = 0;
      for (let i = 0; i < bursts.length; i++) {
        const b = bursts[i], L = b.kind?.light, dt = t - b.at0;
        if (!L || !(dt >= 0 && dt < FX_LIGHT_MS)) continue;
        const f = L[0] * (1 - dt / FX_LIGHT_MS);
        const rw = b.kind === SD_FX_REWIND, g = rw ? L[0] - f : f;   // SD-LOOK S9: the rewind's swells to its end, where its sparks gather
        putLight(b.at[0], b.at[1] + (rw ? 0 : 1), b.at[2], L[1], b.color[0] * g, b.color[1] * g, b.color[2] * g);
      }
      if (t >= flashAt && t - flashAt < SD_FX_FLASH_MS) { const f = 4 * (1 - (t - flashAt) / SD_FX_FLASH_MS); putLight(FLASH_AT[0], FLASH_AT[1], FLASH_AT[2], 40, f, f * 0.9, f * 0.7); }
      lit.length = nLit;
      return lit;
    },
    /** AUDIT SD III (V13): the spark pass built now - as the Hour is stood in, never in the frame of its first landing. */
    warm(gl) {
      if (!passTried && gl) { passTried = true; try { pass = new GateFxRenderer(gl); } catch (e) { console.warn('[sd] the blows\' sparks would not build', e?.message ?? e); pass = null; } }
    },
    /** Draw the standing bursts with the gate's spark pass (made the first time there is one). */
    draw(gl, proj, view, eye, t, fog = null, viewH = 0) {
      const now = this.bursts(t);
      if (!now.length) return false;
      if (!passTried && gl) { passTried = true; try { pass = new GateFxRenderer(gl); } catch (e) { console.warn('[sd] the blows\' sparks would not build', e?.message ?? e); pass = null; } }
      if (!pass) return false;
      pass.draw(now, null, proj, view, eye, t / 1000, fog, viewH);
      return pass.bursts > 0;
    },
    /** Out of the Hour: forgotten. */
    leave() { k = null; bursts.length = 0; flashAt = -Infinity; },
    /** SD-LOOK S9 (the lab, src/tools/abyssLab.js): the rewind on checkpoint `c` at `t` (the fight's clock), my feet on its
     *  landing. */
    rewind(c, t) { const C = SD_CHECKPOINTS[c]; if (C) rewound(realmToDungeon(C.x, C.y, C.z), c, t); },
  };
}
