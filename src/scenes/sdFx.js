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
import { SD_ARENA, realmToDungeon, dungeonToRealm } from '../net/sdBrain.js';
import { SD_BLOW_BY_ID, SD_BLOWS, SD_BODY, SD_REM, SD_ECHO, stompFrontAt } from '../net/sdRemnant.js';
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

/**
 * The Hour's blows seen on this screen. `link` the fight's (net/sdFightLink.js), `feet()` mine in the dungeon's frame
 * (null out of the Hour), `shake(k)` the camera's door.
 * @param {{ link: any, feet?: () => (number[] | null), shake?: (k: number) => void }} deps
 */
export function createSdFx({ link, feet = () => null, shake = () => {} }) {
  /** @type {Array<{ at: number[], at0: number, t: number, kind: any, color: ReadonlyArray<number>, floor: number }>} */
  const bursts = [];
  let k = null, pass = null, passTried = false, flashAt = -Infinity;
  const live = [];
  const where = (x, y, z) => realmToDungeon(SD_ARENA.x + x, y, SD_ARENA.z + z);
  const add = (p, at0, kd, color, floor = NaN) => {
    let b = bursts.length < FX_BURSTS_MAX ? null : bursts.reduce((o, q) => (q.at0 < o.at0 ? q : o));
    if (!b) { b = { at: [0, 0, 0], at0: 0, t: 0, kind: kd, color, floor: NaN }; bursts.push(b); }
    b.at[0] = p[0]; b.at[1] = p[1]; b.at[2] = p[2]; b.at0 = at0; b.kind = kd; b.color = color; b.floor = floor;
  };
  /** My feet in the arena's frame, or null. */
  const mine = () => { const f = feet(); if (!f) return null; const r = dungeonToRealm(f[0], f[1], f[2]); return [r[0] - SD_ARENA.x, r[2] - SD_ARENA.z]; };
  const felt = (kd, x, z) => { const m = mine(); if (!m) return; const s = sdShake(kd, Math.hypot(m[0] - x, m[1] - z)); if (s >= 0.05) shake(s); };
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
      for (let i = 0; i < SD_RING_DUST.n; i++) { const g = (i / SD_RING_DUST.n) * Math.PI * 2; add(where(a.x + Math.sin(g) * r, 0.1, a.z + Math.cos(g) * r), a.at + SD_RING_DUST.after, SD_FX_KINDS.ring, color); }
      felt('stomp', a.x, a.z);
    } else if (A === SD_BLOWS.hand) add(where(bx, (b === SD_BODY.remnant ? SD_REM.h : SD_ECHO.h) * 0.55, bz), a.at, SD_FX_KINDS.hand, b === SD_BODY.remnant ? SD_FX_COLOR.gold : color);
    else if (A === SD_BLOWS.volley) {
      for (const q of a.tg ?? []) add(where(q[0], 0.1, q[1]), a.at, SD_FX_KINDS.volley, color);
      const m = mine();
      if (m && (a.tg ?? []).length) felt('volley', ...(a.tg.reduce((o, q) => (Math.hypot(q[0] - m[0], q[1] - m[1]) < Math.hypot(o[0] - m[0], o[1] - m[1]) ? q : o))));
    } else if (A === SD_BLOWS.pulse) { add(where(0, 2, 0), a.at, SD_FX_KINDS.pulse, SD_FX_COLOR.mantella); felt('pulse', 0, 0); }
    else if (A === SD_BLOWS.reset) { if (!(s.su > a.at)) { add(where(0, 3, 0), a.at, SD_FX_KINDS.reset, SD_FX_COLOR.reset); felt('reset', 0, 0); } }
    else if (A === SD_BLOWS.end) { add(where(0, 3, 0), a.at, SD_FX_KINDS.end, SD_FX_COLOR.end); felt('end', 0, 0); }
  }

  return {
    /** One frame: every landing and turn since the last, seen. */
    frame() {
      const s = link?.state?.(), t = link?.now?.();
      for (let i = bursts.length - 1; i >= 0; i--) if (Number.isFinite(t) && t - bursts[i].at0 > FX_BURST_MS + 200) bursts.splice(i, 1);
      if (!s || !(s.fi > 0) || !Number.isFinite(t)) { k = null; return; }
      if (!k || k.fi !== s.fi) { k = seen(s, t); return; }
      const rem = (y) => { const [x, z] = s.rem ? sdBodyAt(s.rem, t) : [0, 0]; return { p: where(x, y, z), x, z }; };
      // its fall: the burst out of its chest and the flash, then the column as it sinks, then the way home's light
      if (s.fell && !k.fell) {
        k.fell = true;
        if (t - s.fell.at < SD_FX_LATE_MS) { const r = rem(SD_REM.h * 0.5); add(r.p, s.fell.at, SD_FX_KINDS.fall, SD_FX_COLOR.gold); flashAt = s.fell.at; felt('fall', r.x, r.z); k.column = 0; k.home = false; }
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
      if (awake && !k.awake && t - s.op < SD_FX_LATE_MS) { const r = rem(0.1); add(r.p, s.op, SD_FX_KINDS.wake, SD_FX_COLOR.brass); felt('wake', r.x, r.z); }
      k.awake = awake;
      const stun = t < s.su;
      if (stun && !k.stun) { const r = rem(SD_REM.h * 0.6); add(r.p, t, SD_FX_KINDS.stun, sdHeartColorOf(s)); felt('stun', r.x, r.z); }
      k.stun = stun;
      if (!k.slipped && s.m > 0 && s.h / s.m < SD_SLIP_FRAC) { k.slipped = true; add(rem(SD_REM.h * 0.5).p, t, SD_FX_KINDS.slip, SD_FX_COLOR.brass); }
      // its Echoes risen and broken
      (s.ec ?? []).forEach((E, i) => {
        const up = E.h > 0, was = k.ec[i] ?? false;
        if (up !== was) {
          const [x, z] = sdBodyAt(E, t), color = i === 0 ? SD_FX_COLOR.gold : SD_FX_COLOR.silver;
          if (up) add(where(x, SD_ECHO.h * 0.5, z), t, SD_FX_KINDS.echoRise, color);
          else { add(where(x, SD_ECHO.h * 0.5, z), t, SD_FX_KINDS.echoFall, color); felt('echoFall', x, z); }
        }
        k.ec[i] = up;
      });
      if (!s.ec) k.ec = [];
      // the Hearts risen and broken - the last one's break and the Hearts' going in one word (the stun's) seen as one
      const X = s.cx, heart = (q, kd) => add(where(q[0], 1.2, q[1]), t, kd, sdHeartColorOf(s));
      if (X && X.i !== k.cx) {
        k.cx = X.i; k.hearts = X.c.map((q) => q[2]); k.cxc = X.c;
        for (const q of X.c) heart(q, SD_FX_KINDS.heartRise);
      } else if (X) {
        X.c.forEach((q, j) => { if ((k.hearts[j] ?? 0) > 0 && !(q[2] > 0)) heart(q, SD_FX_KINDS.heartBreak); k.hearts[j] = q[2]; });
        k.cxc = X.c;
      } else {
        if (k.cx !== null && stun) k.cxc.forEach((q, j) => { if ((k.hearts[j] ?? 0) > 0) heart(q, SD_FX_KINDS.heartBreak); });
        k.cx = null; k.hearts = []; k.cxc = [];
      }
      // the landings
      for (const [b, a] of blowsOf(s)) {
        if (k.blows.has(a.i) || t < a.at) continue;
        k.blows.add(a.i);
        if (k.blows.size > 48) k.blows.delete(k.blows.values().next().value);
        if (t - a.at < SD_FX_LAND_LATE_MS) landed(s, b, a, t);
      }
    },
    /** The bursts standing at `t` (the fight's clock), as the spark pass takes them. */
    bursts(t) {
      live.length = 0;
      for (const b of bursts) { b.t = (t - b.at0) / 1000; if (b.t >= 0 && b.t < FX_BURST_MS / 1000) live.push(b); }
      return live;
    },
    /** The light the landings throw at `t`: each lit burst's flash where it fell, fading over FX_LIGHT_MS, and the fall's
     *  white-gold over the arena - in the Hour's light channel. */
    lights(t) {
      const out = [];
      for (const b of bursts) {
        const L = b.kind?.light, dt = t - b.at0;
        if (!L || !(dt >= 0 && dt < FX_LIGHT_MS)) continue;
        const f = L[0] * (1 - dt / FX_LIGHT_MS);
        out.push({ x: b.at[0], y: b.at[1] + 1, z: b.at[2], range: L[1], color: b.color.map((v) => v * f) });
      }
      if (t >= flashAt && t - flashAt < SD_FX_FLASH_MS) { const f = 4 * (1 - (t - flashAt) / SD_FX_FLASH_MS), p = where(0, 6, 0); out.push({ x: p[0], y: p[1], z: p[2], range: 40, color: [f, f * 0.9, f * 0.7] }); }
      return out;
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
  };
}
