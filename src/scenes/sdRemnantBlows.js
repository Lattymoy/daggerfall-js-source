// @ts-check
// SD8d (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10): THE BRASS REMNANT'S BLOWS
// ON ME - the arena's half of the fight on this screen, as scenes/gateCourt.js is the court's. ONE SOURCE: the fight as
// the page holds it (net/sdFightLink.js). Nothing here is sent: a strike's verdict is this machine's own (co-op's law -
// net/sdStrike.js), and it lands through `strike` - the dungeon context's door (the hurt, the flash, the cry).
//
//   SEEN: every blow in flight - the Remnant's, each Echo's, the Hour's own - on the arena's floor as it winds up and
//     lands (sdTelegraphShapes - the gate's telegraph pass over the arena, render/gateTelegraph.js): the Stomp's disc and
//     then its ring rolling out; the Hour-Hand's half-circle as it gathers with its beam standing where it begins, then
//     the beam sweeping; the Gear Volley's marks; the Hour's own over the whole floor; the Volley's brass burning where
//     it fell.
//   HEARD: each blow's wind-up at its word and its landing (DAGGER.SND's own, pitched for a colossus of brass).
//   JUDGED HERE, on my own feet (net/sdStrike.js sdBlowVerdict): each part of each blow once, a share of my own health
//     and its base; the Stomp's ring on the ground alone; the Hand outrun or shaded by a pillar; the burning brass a bite
//     each POOL_TICK_MS I stand in it.
//   SAID: the Reset gathering, the Hour's End; and its FALL - its body's thud, the line, the fight's damage chart
//     (ui/gateDamageChart.js, the gate's own).
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { setBossStruck } from '../systems/sigilSetPowers.js';   // AUDIT SD: a body's blow, marked for Gearward
import { SD_ARENA, realmToDungeon, dungeonToRealm } from '../net/sdBrain.js';
import { SD_BLOW_BY_ID, SD_BLOWS, SD_BODY, SD_REM, SD_ECHO, atkWindup, blowShape, stompRingAt, handAngleAt, arenaOf } from '../net/sdRemnant.js';
import { POOL_TICK_MS } from '../net/gateBrain.js';
import { strikeDamage, savedShare } from '../net/gateStrike.js';
import { sdBodyAt, SD_HEARTS_KEY } from '../net/sdFightLink.js';
import { sdBlowVerdict, sdVolleyPools, sdPoolUnder } from '../net/sdStrike.js';
import { GateTelegraphRenderer, TELEGRAPH_KIND, TELEGRAPH_EDGE, TELEGRAPH_EDGE_DAGON, TELEGRAPH_STYLE, TELEGRAPH_POOL, TELEGRAPH_FLASH_MS, TELEGRAPH_POINTS_MAX } from '../render/gateTelegraph.js';
import { damageChartModel, drawGateDamageChart, DAMAGE_CHART_DELAY_MS, DAMAGE_CHART_MS } from '../ui/gateDamageChart.js';
import { BODY_FALL, BURNING, THUNDER_ROLL, SWING_LOW, CRYSTAL_CLIPS, BOSS_CUES } from '../world/gateBoss.js';

/** Each blow's colour on the floor (linear rgb) - the brass's for its own, the Mantella's green for the Hour's, red for
 *  the End. */
export const SD_BLOW_COLOR = Object.freeze({
  stomp: Object.freeze([1.0, 0.7, 0.26]), hand: Object.freeze([1.0, 0.86, 0.5]), volley: Object.freeze([1.0, 0.52, 0.26]),
  pulse: Object.freeze([0.45, 1.0, 0.6]), reset: Object.freeze([0.6, 1.0, 0.82]), end: Object.freeze([1.0, 0.32, 0.26]),
});
/** Each blow's grain (render/gateTelegraph.js TELEGRAPH_STYLE): its weight for the brass's, light's crackle for the Hand
 *  and the Pulse, Dagon's own for the Reset and the End. */
export const SD_BLOW_STYLE = Object.freeze({
  stomp: TELEGRAPH_STYLE.weight, hand: TELEGRAPH_STYLE.shock, volley: TELEGRAPH_STYLE.weight,
  pulse: TELEGRAPH_STYLE.shock, reset: TELEGRAPH_STYLE.dagon, end: TELEGRAPH_STYLE.dagon,
});
/** The brass burning where the Volley fell. */
export const SD_POOL_COLOR = Object.freeze([1.0, 0.45, 0.16]);
/** SD18b: AN ENDING'S ELEMENT ON THE FLOOR (net/sdMarks.js) - its colour (the brass burning, frozen, charged, venomed or
 *  soul-lit), its ground's grain (render/gateTelegraph.js TELEGRAPH_STYLE - the gate's own aspects' grains; magic the
 *  light's crackle), its ground's name, and how far its own blows' colours lean to it (they keep their own, to be told
 *  apart). */
export const SD_ELEMENT_COLOR = Object.freeze({
  fire: SD_POOL_COLOR, frost: Object.freeze([0.5, 0.82, 1.0]), shock: Object.freeze([0.7, 0.76, 1.0]), poison: Object.freeze([0.5, 0.95, 0.25]), magic: Object.freeze([0.78, 0.5, 1.0]),
});
export const SD_ELEMENT_STYLE = Object.freeze({ fire: TELEGRAPH_STYLE.fire, frost: TELEGRAPH_STYLE.frost, shock: TELEGRAPH_STYLE.shock, poison: TELEGRAPH_STYLE.poison, magic: TELEGRAPH_STYLE.shock });
export const SD_ELEMENT_GROUND = Object.freeze({ fire: 'Burning brass', frost: 'Rimed brass', shock: 'Charged brass', poison: 'Venomed brass', magic: 'Soul-lit brass' });
export const SD_TINT_LEAN = 0.35;
const _tints = new Map();
/** A blow's colour on the floor in element `el` (none: its own) - kept, one a pair. */
export function sdTint(key, el) {
  const base = SD_BLOW_COLOR[key] ?? SD_BLOW_COLOR.stomp, E = el ? SD_ELEMENT_COLOR[el] : null;
  if (!E) return base;
  const k = `${key}:${el}`;
  let c = _tints.get(k);
  if (!c) { c = Object.freeze(base.map((v, i) => v + (E[i] - v) * SD_TINT_LEAN)); _tints.set(k, c); }
  return c;
}
/** The arena as the telegraph pass's floor: one, its centre the frame's origin. */
export const SD_TELEGRAPH_FLOOR = Object.freeze({ r: SD_ARENA.r, courts: Object.freeze([Object.freeze([0, 0])]) });
export const SD_ARENA_CENTRE = Object.freeze(realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z));
/** Its words. */
export const SD_BLOWS_TEXT = Object.freeze({
  // AUDIT SD II (L6 F7, F21): the call counts its Hearts, as the gate's Reckoning counts its crystals (it was "The Reset
  // gathers - break its Hearts!")
  reset: (n) => (n > 0 ? `The Reset! Break all ${n} Hearts!` : 'The Reset! Break its Hearts!'),
  end: 'The Hour Ends.',
  fell: 'The Brass Remnant is undone.',
  boss: 'The Brass Remnant',
  hearts: 'Hearts',   // AUDIT SD II (L6 F11): the chart's column - it said "Crystals"
  burning: 'burning brass',
});
/** ITS SOUNDS (DAGGER.SND records, as the gate's - `clip` an index, `pitch` down for its size): each blow's wind-up at
 *  its word and its landing, where it lands (`at`: its body, its marks, or the arena's heart), and its fall. */
const cue = (clip, pitch, volume, reach, at = 'body') => Object.freeze({ clip, pitch, volume, reach, at });
/** AUDIT SD II (L6 F7): a Reset's Hearts rising are heard only this soon after its call, ms (the gate's RECKON_LATE_MS
 *  law - heard live, never a stale one at a hello). */
export const SD_HEART_LATE_MS = 2000;
export const SD_BLOW_CUES = Object.freeze({
  windup: Object.freeze({
    stomp: cue(BODY_FALL, 0.5, 1.3, 60), hand: cue(CRYSTAL_CLIPS.hit, 0.42, 1.4, 80), volley: cue(CRYSTAL_CLIPS.hit, 0.7, 1.3, 60),
    pulse: cue(THUNDER_ROLL, 0.4, 1.4, 120, 'heart'), reset: cue(THUNDER_ROLL, 0.3, 2.0, 160, 'heart'), end: cue(THUNDER_ROLL, 0.236, 2.2, 200, 'heart'),   // AUDIT SD II (L6 F23): four semitones under the Reset's (WB13d's law - 0.25 was 3.2 apart)
  }),
  land: Object.freeze({
    stomp: cue(BODY_FALL, 0.28, 2.0, 80), hand: cue(SWING_LOW, 0.4, 1.6, 80), volley: cue(BODY_FALL, 0.8, 1.4, 50, 'marks'),
    pulse: cue(CRYSTAL_CLIPS.shatter, 0.5, 1.6, 120, 'heart'), reset: cue(BURNING, 0.4, 2.2, 160, 'heart'), end: cue(BURNING, 0.3, 2.2, 200, 'heart'),
  }),
  fall: cue(BODY_FALL, 0.22, 2.4, 160),
  pool: cue(BURNING, 1.3, 0.9, 14, 'feet'),
});

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const NONE = Object.freeze([]);
/** AUDIT SD: A BODY'S OWN BLOW - the Stomp, the Hand, the Volley, the Remnant's or an Echo's: a foe's blow for the one
 *  power that answers a world boss (systems/sigilSetPowers.js setBossStruck, Gearward); never the Hour's unresisted magic
 *  over the whole floor (the Pulse, the Reset, the End), nor the burning brass. */
export const bodysBlow = (A) => !!A && A.shape !== 'all';
/** A shape in the gate pass's own form, its fields the kind does not read set to nothing. */
const shapeOf = (kind, o) => ({
  kind, origin: [0, 0], yaw: 0, r: 0, halfArc: 0, body: SD_REM.r, end: [0, 0], halfW: 0, r0: 0, r1: 0, points: [], n: 0,
  t: 1, flash: 0, alpha: 1, color: SD_BLOW_COLOR.stomp, edge: TELEGRAPH_EDGE, court: 0, style: TELEGRAPH_STYLE.weight,
  since: 0, span: 1, after: -1, runS: 0, pool: TELEGRAPH_POOL.blow, ...o,
});

/**
 * WHAT THE FLOOR SHOWS of blow `atk` of body `b` in `phase` at `now` (the arena's frame), pushed onto `out`: as it winds up
 * (its fill rising to its landing) and as it lands (its flash, then gone) - the Stomp's disc and then its ring rolling
 * out; the Hand's half-circle and its beam at its first edge, then its beam where it stands in its sweep; the Volley's
 * marks; the Hour's own over the whole floor. Pure.
 * @param {any} atk @param {number} b @param {number} phase @param {number} now @param {any[]} [out]
 */
export function sdTelegraphShapes(atk, b, phase, now, out = []) {
  const A = atk ? SD_BLOW_BY_ID[atk.a] : null;
  if (!A) return out;
  const S = blowShape(atk);   // SD18a: the blow its frame says - its Hollow's marks
  const w = atkWindup(atk, A, phase, b), since = now - (atk.at - w), after = now - atk.at, span = Math.max(S.active, 1);
  if (since < 0 || after >= span + TELEGRAPH_FLASH_MS) return out;
  // SD18b: its colour leaning to its Ending's element (sdTint)
  const common = {
    t: w > 0 ? clamp01(since / w) : 1, flash: after >= 0 ? 1 : 0, alpha: after > span ? clamp01(1 - (after - span) / TELEGRAPH_FLASH_MS) : 1,
    color: sdTint(A.key, S.el), style: SD_BLOW_STYLE[A.key], edge: A === SD_BLOWS.reset || A === SD_BLOWS.end ? TELEGRAPH_EDGE_DAGON : TELEGRAPH_EDGE,
    since: Math.max(0, since) / 1000, span: Math.max(0.001, w / 1000), after: after >= 0 ? after / 1000 : -1,
    body: b === SD_BODY.remnant ? SD_REM.r : SD_ECHO.r,
  };
  const origin = [atk.x, atk.z];
  switch (A.shape) {
    case 'stomp': {
      if (after < TELEGRAPH_FLASH_MS) out.push(shapeOf(TELEGRAPH_KIND.disc, { ...common, origin, r: S.r, alpha: after > 0 ? clamp01(1 - after / TELEGRAPH_FLASH_MS) : 1 }));
      const front = stompRingAt(atk, now);
      if (front != null) out.push(shapeOf(TELEGRAPH_KIND.ring, { ...common, origin, r0: Math.max(0, front - A.width / 2), r1: front + A.width / 2, t: 1 }));
      break;
    }
    case 'sweep': {
      if (after < 0) {
        out.push(shapeOf(TELEGRAPH_KIND.cone, { ...common, origin, yaw: atk.yw, r: A.len, halfArc: S.arc / 2 }));
        // AUDIT SD II (L4 F10): and the hand standing where its sweep begins - the way it turns (`sw`), which the
        // half-circle alone never showed: the Remnant's is a coin's, and a straight run the wrong way met it
        const a0 = handAngleAt(atk, atk.at);
        out.push(shapeOf(TELEGRAPH_KIND.lane, { ...common, origin, end: [atk.x + Math.sin(a0) * A.len, atk.z + Math.cos(a0) * A.len], halfW: A.width / 2 }));
        break;
      }
      const a = handAngleAt(atk, now);
      if (a != null) out.push(shapeOf(TELEGRAPH_KIND.lane, { ...common, origin, end: [atk.x + Math.sin(a) * A.len, atk.z + Math.cos(a) * A.len], halfW: A.width / 2 }));
      break;
    }
    case 'disc': out.push(shapeOf(TELEGRAPH_KIND.discs, { ...common, r: S.r, points: (atk.tg ?? []).slice(0, TELEGRAPH_POINTS_MAX).map((q) => [q[0], q[1]]) })); break;
    case 'all': out.push(shapeOf(TELEGRAPH_KIND.all, { ...common })); break;
    default: break;
  }
  return out;
}
/** THE BURNING BRASS on the floor - the live pools, one `discs` shape a TELEGRAPH_POINTS_MAX of them, each coming up at
 *  its landing and dying down over its last second. Pure. */
export function sdPoolShapes(pools, now) {
  const live = pools.filter((p) => now >= p.from && now < p.until);
  const out = [];
  for (let k = 0; k < live.length; k += TELEGRAPH_POINTS_MAX) {
    const g = live.slice(k, k + TELEGRAPH_POINTS_MAX);   // SD18b: the brass in its Ending's element - its colour and grain
    const alpha = Math.max(...g.map((p) => clamp01(Math.min((now - p.from) / 150, (p.until - now) / 1000))));
    out.push(shapeOf(TELEGRAPH_KIND.discs, { r: g[0].r, points: g.map((p) => [p.x, p.z]), alpha, color: SD_ELEMENT_COLOR[g[0].el] ?? SD_POOL_COLOR, style: SD_ELEMENT_STYLE[g[0].el] ?? TELEGRAPH_STYLE.fire, pool: TELEGRAPH_POOL.ground, since: Math.max(0, now - Math.min(...g.map((p) => p.from))) / 1000 }));
  }
  return out;
}
/** AUDIT SD II (L2 F9): whether any blow is in flight in fight `s` - sdBlowsInFlight's own reading, with no list made. */
export function sdAnyInFlight(s) {
  if (!s || !(s.fi > 0) || s.lost || s.fell) return false;
  if (s.rem?.atk || s.clk) return true;
  const ec = s.ec;
  if (ec) for (let k = 0; k < ec.length; k++) if (ec[k].h > 0 && ec[k].atk) return true;
  return false;
}
/** Every blow in flight in fight `s`, with the body it is of: the Remnant's, each Echo's standing, the Hour's own. */
export function sdBlowsInFlight(s) {
  const out = [];
  if (!s || !(s.fi > 0) || s.lost || s.fell) return out;
  if (s.rem?.atk) out.push({ b: SD_BODY.remnant, atk: s.rem.atk });
  (s.ec ?? []).forEach((E, k) => { if (E.h > 0 && E.atk) out.push({ b: SD_BODY.gold + k, atk: E.atk }); });
  if (s.clk) out.push({ b: SD_BODY.hour, atk: s.clk });
  return out;
}

/**
 * The arena's blows on this screen. `link` the fight's (net/sdFightLink.js), `feet()` mine in the dungeon's frame (null
 * when I am not in the Hour), `grounded()` whether I stand on the ground, `player()` my entity, `strike(dmg, how)` the
 * dungeon context's door, `say` a line, `me()` my name on the relay (my row of the chart), `hudHidden()` the HUD's hide.
 * @param {{ gl?: any, audio?: any, link: any, feet?: () => (number[]|null), grounded?: () => boolean, player?: () => any,
 *   strike?: (dmg: number, how: any) => void, say?: (t: string, everyone?: boolean, key?: string) => void, me?: () => (string|null), hudHidden?: () => boolean,
 *   save?: (e: any, el: string) => number }} deps - SD18b: `save(entity, el)` the share (0-100) a strike in element `el` lands
 */
export function createSdRemnantBlows({ gl = null, audio = null, link, feet = () => null, grounded = () => true, player = () => null, strike = () => {}, say = () => {}, me = () => null, hudHidden = () => false, save = () => 100 }) {
  let pass = null, passTried = false;
  /** each blow by its number: what of it has been judged, whether it is done, heard and said */
  const marks = new Map();
  let prevT = null, pools = [], inFire = false, burnAt = -Infinity, outAt = -Infinity, fireEl = null;
  let fellFi = 0, chartAt = null, chartFell = null, endSaid = 0;
  /** AUDIT SD: the fight the marks are of - a blow's number begins again in every fight, so a fresh one's are its own */
  let marksFi = 0;
  /** @type {readonly any[]} */
  let shapes = NONE;

  const play = (c, at) => { if (!c || !audio || !at) return; try { audio.play3d?.(c.clip, at, c.volume, { maxDistance: c.reach, distanceModel: 'linear', pitch: c.pitch }); } catch { /* a sound is never the fight */ } };
  const bodyAt = (s, b, t) => {
    const B = b === SD_BODY.remnant ? s.rem : s.ec?.[b - SD_BODY.gold];
    const [x, z] = B ? sdBodyAt(B, t) : [0, 0];
    return realmToDungeon(SD_ARENA.x + x, 3, SD_ARENA.z + z);
  };
  const sound = (c, s, b, atk, t) => {
    if (!c) return;
    if (c.at === 'marks') for (const q of atk.tg ?? []) play(c, realmToDungeon(SD_ARENA.x + q[0], 1, SD_ARENA.z + q[1]));
    else if (c.at === 'heart' || b === SD_BODY.hour) play(c, realmToDungeon(SD_ARENA.x, 4, SD_ARENA.z));
    else play(c, bodyAt(s, b, t));
  };
  /** A strike on me (the living alone reach here - the frame's own law): its share of my own health and its base, through
   *  the door every blow lands by. AUDIT SD: `blow` a body's own (`bodysBlow`), marked as a world boss's blow for the one
   *  set power that answers it (systems/sigilSetPowers.js). */
  function land(name, pct, base, blow = false, el = null) {
    const e = player();
    if (!e) return;
    if (blow) setBossStruck();
    const dmg = strikeDamage(pct, e.maxHealth, base);
    // SD18b: its Ending's element - my resistance to it softens it (the gate's saving throw), and it lands as that element
    strike(el ? savedShare(dmg, save(e, el)) : dmg, el ? { name, el } : { name });
  }
  /** One blow's frame: heard at its word and its landing, the Reset and the End said, judged on my feet. */
  function blow(s, b, atk, t, t0, at) {
    const A = SD_BLOW_BY_ID[atk.a];
    if (!A) return;
    let m = marks.get(atk.i);
    if (!m) {
      m = { seen: {}, done: false, cued: false, landed: false };
      marks.set(atk.i, m);
      if (marks.size > 32) marks.delete(marks.keys().next().value);
    }
    if (!m.cued) { m.cued = true; if (t < atk.at) { sound(SD_BLOW_CUES.windup[A.key], s, b, atk, t); if (A === SD_BLOWS.reset) say(SD_BLOWS_TEXT.reset(s.cx?.c?.length ?? 0), false, SD_HEARTS_KEY); } }
    if (A === SD_BLOWS.end && endSaid !== s.fi && t < atk.at) { endSaid = s.fi; say(SD_BLOWS_TEXT.end); }
    if (!m.landed && t >= atk.at) {
      m.landed = true;
      if (t - atk.at < 400 + Math.max(blowShape(atk).active, 0)) {
        sound(SD_BLOW_CUES.land[A.key], s, b, atk, t);
        if (A === SD_BLOWS.volley) pools.push(...sdVolleyPools(atk));
      }
    }
    if (m.done || !at) return;
    const v = sdBlowVerdict(atk, at[0], at[1], t0, t, grounded(), m.seen);
    m.seen = v.seen;
    m.done = v.done;
    for (const h of v.hits) land(A.name, h.pct, h.base, bodysBlow(A), h.el ?? null);
  }
  /** THE BURNING BRASS - a bite each POOL_TICK_MS I stand in it, the first a tick after I stepped in (the gate's law: a
   *  step out shorter than a tick keeps the count it had). */
  function burn(t, at, alive) {
    if (pools.length) pools = pools.filter((p) => t < p.until);
    if (!pools.length || !at || !alive) { inFire = false; return; }
    const p = sdPoolUnder(pools, at[0], at[1], t);
    if (!p) { if (inFire) { inFire = false; outAt = t; } return; }
    fireEl = p.el ?? null;
    if (!inFire) {
      inFire = true;
      if (t - outAt >= POOL_TICK_MS) { const f = feet(); if (f) play(SD_BLOW_CUES.pool, f); burnAt = t; return; }
    }
    if (t - burnAt < POOL_TICK_MS) return;
    burnAt = t;
    land(p.el ? SD_ELEMENT_GROUND[p.el] : SD_BLOWS_TEXT.burning, p.pct, p.base, false, p.el ?? null);
  }
  /** AUDIT SD II (L6 F7): THE HEARTS HEARD - the gate's crystals' own cues (world/gateBoss.js BOSS_CUES), each where its
   *  Heart stands: their rise with the Reset's call (heard live alone - SD_HEART_LATE_MS), a blow on one, and one broken
   *  (its shatter, and the ring after it). They rose, took blows and broke in silence. */
  let heartsOf = null;
  const broke = (p) => { play(BOSS_CUES.crystalBreak, p); play(BOSS_CUES.crystalRing, p); };
  function hearts(s, t) {
    const X = s.cx;
    if (!X || s.fell || s.lost) {
      // the LAST Heart breaks in the stun's own word: the realm fans its `cxb` and the stun together, and the stun takes
      // the Hearts with it - the ones this screen last saw standing were broken, and are heard so (a Reset that landed
      // stuns nothing: its Hearts go unheard, as they went unbroken)
      if (heartsOf && !X && s.fi === heartsOf.fi && s.su > t && s.stunAt >= heartsOf.called) for (let k = 0; k < heartsOf.h.length; k++) if (heartsOf.h[k] > 0) broke(heartsOf.p[k]);
      heartsOf = null;
      return;
    }
    if (!heartsOf || heartsOf.fi !== s.fi || heartsOf.i !== X.i) {
      const called = s.rem?.atk?.a === SD_BLOWS.reset.id ? s.rem.atk.at - SD_BLOWS.reset.windup : -Infinity;
      heartsOf = { fi: s.fi, i: X.i, h: X.c.map((q) => q[2]), p: X.c.map((q) => realmToDungeon(SD_ARENA.x + q[0], 1.2, SD_ARENA.z + q[1])), called };
      if (t - called <= SD_HEART_LATE_MS) for (const p of heartsOf.p) play(BOSS_CUES.crystalRise, p);
      return;
    }
    for (let k = 0; k < X.c.length; k++) {
      const q = X.c[k], was = heartsOf.h[k] ?? 0;
      heartsOf.h[k] = q[2];
      if (!(q[2] < was)) continue;
      if (q[2] > 0) play(BOSS_CUES.crystalHit, heartsOf.p[k]);
      else broke(heartsOf.p[k]);
    }
  }
  /** Its fall, an event: its body's thud and the line, once a fight; then the fight's damage chart. */
  function fall(s, t) {
    if (s.fell && fellFi !== s.fi) {
      fellFi = s.fi;
      chartAt = t; chartFell = s.fell;
      if (t - s.fell.at < 5000) { play(SD_BLOW_CUES.fall, bodyAt(s, SD_BODY.remnant, s.fell.at)); say(SD_BLOWS_TEXT.fell, true); }   // AUDIT SD II (L6 F15): its fall to the whole Hour
    }
    if (chartAt !== null) {
      if (s.fell && s.fell !== chartFell) chartFell = s.fell;   // the realm's word may bring the chart after the first
      const model = damageChartModel(chartFell, { boss: SD_BLOWS_TEXT.boss, me: me(), since: chartAt, now: t, crystals: SD_BLOWS_TEXT.hearts, theme: 'brass' });   // AUDIT SD II (L6 F11): its Hearts, in brass
      drawGateDamageChart(model, { hidden: hudHidden() });
      if (!model && t - chartAt >= DAMAGE_CHART_DELAY_MS + DAMAGE_CHART_MS) chartAt = null;   // its span over: put away
    }
  }

  return {
    /** One frame of the arena on this screen: the blows heard, judged, shown; the brass burning; its fall. */
    frame() {
      const s = link.state(), t = link.now();
      if (s.fi !== marksFi) { marksFi = s.fi; marks.clear(); pools = []; inFire = false; }   // AUDIT SD: a fight lost and a fresh one begun - the last one's numbers are not this one's
      const t0 = prevT ?? t;
      prevT = t;
      hearts(s, t);   // AUDIT SD II (SD11d): before the idle return - the stun that breaks the last Heart ends every blow in flight
      // AUDIT SD II (L2 F9): no blow in flight and no brass burning - nothing to judge or show, and nothing made for it
      if (!sdAnyInFlight(s) && !pools.length) { inFire = false; shapes = NONE; fall(s, t); return; }
      const f = feet(), e = player(), alive = !!f && !!e && e.health > 0;
      let at = null;
      if (alive) { const [rx, , rz] = dungeonToRealm(f[0], f[1], f[2]); at = arenaOf(rx, rz); }
      const out = [];
      for (const { b, atk } of sdBlowsInFlight(s)) {
        blow(s, b, atk, t, t0, alive ? at : null);
        sdTelegraphShapes(atk, b, s.ph, t, out);
      }
      burn(t, at, alive && !s.fell);
      for (const p of sdPoolShapes(pools, t)) out.push(p);
      shapes = out;
      fall(s, t);
    },
    /** The floor's shapes this frame (the arena's frame). */
    shapes: () => shapes,
    /** The telegraphs over the arena's floor, in the dungeon arm's world pass. Answers whether any drew. */
    drawPass(proj, view, eye, seconds, fog = null) {
      if (!shapes.length) return false;
      if (!passTried && gl) { passTried = true; try { pass = new GateTelegraphRenderer(gl); } catch (e) { console.warn('[sd] the telegraph would not build', e?.message ?? e); pass = null; } }
      if (!pass) return false;
      let drew = false;
      for (const sh of shapes) { pass.draw(sh, proj, view, eye, seconds, fog, SD_ARENA_CENTRE, null, SD_TELEGRAPH_FLOOR); drew = drew || pass.drawn > 0; }
      return drew;
    },
    /** What it holds, for the tests. */
    state: () => ({ pools: pools.map((p) => ({ ...p })), inFire, marks: [...marks.entries()].map(([i, m]) => ({ i, ...m, seen: { ...m.seen } })), chartAt }),
    /** Out of the Hour: its marks and its brass forgotten, the chart put away. */
    /** SD15: whether I stand in the burning brass this frame (the arena read's rim). */
    burning: () => inFire,
    /** SD18b: the element of the brass I stand in (null: plain fire, or none). */
    burningEl: () => (inFire ? fireEl : null),
    leave() {
      marks.clear(); pools = []; inFire = false; prevT = null; shapes = [];
      marksFi = 0; fellFi = 0; endSaid = 0;   // AUDIT SD: the next Hollow's Hour numbers its fights from 1 again
      heartsOf = null;
      if (chartAt !== null) { chartAt = null; drawGateDamageChart(null); }
    },
  };
}
