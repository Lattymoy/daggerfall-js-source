// @ts-check
// SD8c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10): THE BRASS REMNANT'S BAR -
// the gate's boss bar (ui/gateBossBar.js drawGateBossBar: one readout, one node, updated never rebuilt) in the Hour's
// brass, its model made here from the fight as the page holds it (net/sdFightLink.js). Its name over the phase it fights
// in, its health with the two turns cut in it (70% and 35% - the marks follow the model), the ward while it cannot be
// struck (asleep, outside time in the Dragon Break, between the break and its return), the blow being wound up named in
// its colour with a line filling to its landing - the Hour's own first (the Pulse, the End), the stun, the Reset with its
// Hearts still standing, an Echo's - the Echoes' health in the Dragon Break, the next Reset, and the Hour's end counting
// down - pulsing in its last minute.
//
// `remnantBarModel` is pure - the fight's state and the relay's clock in, the gate bar's model out. Not a DFU member.
// Ledger A (SUPER-DUNGEONS).
import { SD_BLOW_BY_ID, SD_BLOWS, SD_BODY, SD_PHASE_AT, SD_PHASE_NAMES, atkWindup, profileOf } from '../net/sdRemnant.js';
import { sdMarksViewOf, sdOmensLine } from './sdMarksView.js';   // SD18b
import { SD_ARENA } from '../net/sdBrain.js';
import { sdBlowDone, sdHourOver } from '../net/sdFightLink.js';
import { countdownText } from '../net/gateLaw.js';
import { FELL_HOLD_MS, FELL_FADE_MS } from './gateBossBar.js';
import { LOW_HEALTH } from '../world/gateBoss.js';

/** The blows' colours on the bar (css) - the brass's for its own, the Mantella's green for the Hour's, the stun's pale. */
export const SD_BAR_CSS = Object.freeze({
  stomp: '#ffb347', hand: '#ffd27a', volley: '#ff8a4c', pulse: '#7fffa0', reset: '#9cffc8', end: '#ff6a5a',
  stun: '#fff2a6', ward: '#f0c060', ring: '#e8c060',
});
/** The words. */
export const SD_BAR_TEXT = Object.freeze({
  name: 'The Brass Remnant',
  stirs: (secs) => `It stirs - ${secs}s`,
  outside: 'Outside time - strike the Echoes',
  returns: (secs) => `It returns - ${secs}s`,   // AUDIT SD II (L6 F10): the Last Moment's return, the Echoes gone
  rises: (e, secs) => `${e === 0 ? 'Gold' : 'Silver'} rises in ${secs}s`,   // AUDIT SD II (L6 F6): the pair's window
  stunned: (secs) => `Stunned - ${secs}s`,
  reset: (left, n, secs) => `The Reset - ${left} of ${n} ${n === 1 ? 'Heart' : 'Hearts'} - ${secs}s`,
  echo: (e, name) => `${e === 0 ? 'Gold' : 'Silver'} Echo: ${name}`,
  echoes: (g, s) => `Gold ${g} - Silver ${s}`,
  echoLeft: (h, m) => (h > 0 ? `${Math.max(1, Math.round((h / Math.max(1, m)) * 100))}%` : 'fallen'),
  resetIn: (left) => `The Reset in ${left}`,
  endsIn: (left) => `The Hour ends in ${left}`,
  ended: 'The Hour has ended',
  fighters: (n) => (n === 1 ? '1 in the arena' : `${n} in the arena`),
});
/** The bar stands over the screen while I stand this near the arena's rim (metres - the realm's frame). */
export const SD_BAR_NEAR_M = 20;
export const sdBarNear = (x, z) => Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x - SD_ARENA.x, z - SD_ARENA.z) <= SD_ARENA.r + SD_BAR_NEAR_M;
/** AUDIT SD II (L6 F6): a fallen Echo's rising pulses on the bar its last this many ms. */
export const SD_ECHO_RISE_NEAR_MS = 5000;
/** The Hour's end counts down this close to it, and pulses in its last minute. */
export const SD_ENDS_WARN_MS = 5 * 60 * 1000;
export const SD_ENDS_NEAR_MS = 60 * 1000;

/** A blow's callout - its name in its colour, its line's reach (its wind-up's share; whole once it lands). */
function callOf(atk, phase, body, now, text = null) {
  const A = SD_BLOW_BY_ID[atk.a];
  const w = atkWindup(atk, A, phase, body);   // SD18a: its frame's own
  const t = w > 0 ? Math.max(0, Math.min(1, (now - (atk.at - w)) / w)) : 1;
  return { text: text ?? A.name, color: SD_BAR_CSS[A.key] ?? SD_BAR_CSS.ring, t, dagon: A === SD_BLOWS.reset || A === SD_BLOWS.end, move: false };
}

/**
 * The gate bar's model for the fight `s` (net/sdFightLink.js SdFightState) at `now` (the relay's clock), or null - no
 * fight heard, or one lost.
 * @param {any} s @param {number} now
 */
export function remnantBarModel(s, now) {
  if (!s || !(s.fi > 0) || s.lost) return null;
  const frac = s.fell ? 0 : s.m > 0 ? Math.max(0, Math.min(1, s.h / s.m)) : 1;
  const asleep = now < s.op, outside = s.ph === 2 || now < s.ou;
  const warded = !s.fell && (asleep || outside);
  const stunned = !s.fell && now < s.su;
  let callout = null;
  if (!s.fell) {
    const rem = s.rem?.atk && !sdBlowDone(s.rem.atk, now) ? s.rem.atk : null;
    const echo = (s.ec ?? []).map((E, e) => (E.h > 0 && E.atk && !sdBlowDone(E.atk, now) ? { e, atk: E.atk } : null)).find(Boolean) ?? null;
    // AUDIT SD II (L6 F1): THE ONE CALLOUT, BY WHAT CAN BE DONE ABOUT IT - the Reset's Hearts, then a body's blow still
    // winding up, then the Hour's own (the Pulse, the End - nothing turns them aside), the stun, a blow landed and
    // sweeping. The Pulse came first: the Reset's countdown went for its 2.8 s in 38% of Resets, and 92 of 1,373 Stomps
    // were never named
    const clk = s.clk && !sdBlowDone(s.clk, now) ? s.clk : null;
    const fallen = s.ph === 2 && s.ec ? s.ec.findIndex((E) => !(E.h > 0) && E.dn > 0) : -1;
    if (asleep) callout = { text: SD_BAR_TEXT.stirs(Math.ceil((s.op - now) / 1000)), color: SD_BAR_CSS.ward, t: null, dagon: false, move: false };
    else if (rem && rem.a === SD_BLOWS.reset.id && s.cx && now < rem.at) {
      const left = s.cx.c.filter((q) => q[2] > 0).length;
      callout = callOf(rem, s.ph, SD_BODY.remnant, now, SD_BAR_TEXT.reset(left, s.cx.c.length, Math.ceil((rem.at - now) / 1000)));
    } else if (rem && s.ph !== 2 && now < rem.at) callout = callOf(rem, s.ph, SD_BODY.remnant, now);
    else if (echo && now < echo.atk.at) callout = callOf(echo.atk, s.ph, SD_BODY.gold + echo.e, now, SD_BAR_TEXT.echo(echo.e, SD_BLOW_BY_ID[echo.atk.a].name));
    else if (clk) callout = callOf(clk, s.ph, SD_BODY.hour, now);
    else if (stunned) callout = { text: SD_BAR_TEXT.stunned(Math.ceil((s.su - now) / 1000)), color: SD_BAR_CSS.stun, t: null, dagon: false, move: false };
    else if (rem && s.ph !== 2) callout = callOf(rem, s.ph, SD_BODY.remnant, now);
    else if (echo) callout = callOf(echo.atk, s.ph, SD_BODY.gold + echo.e, now, SD_BAR_TEXT.echo(echo.e, SD_BLOW_BY_ID[echo.atk.a].name));
    else if (fallen >= 0) callout = { text: SD_BAR_TEXT.rises(fallen, Math.max(0, Math.ceil((s.ec[fallen].dn + profileOf(s).pairMs - now) / 1000))), color: SD_BAR_CSS.ward, t: null, dagon: false, move: false };
    else if (s.ph === 2) callout = { text: SD_BAR_TEXT.outside, color: SD_BAR_CSS.ward, t: null, dagon: false, move: false };
    else if (outside) callout = { text: SD_BAR_TEXT.returns(Math.max(0, Math.ceil((s.ou - now) / 1000))), color: SD_BAR_CSS.ward, t: null, dagon: false, move: false };
  }
  const toEnd = Number.isFinite(s.ends) && s.ends > 0 ? s.ends - now : Infinity;
  const since = s.fell ? Math.max(0, now - s.fell.at) : 0;
  const alpha = s.fell ? Math.max(0, Math.min(1, 1 - (since - FELL_HOLD_MS) / FELL_FADE_MS)) : 1;
  const ec = !s.fell && s.ph === 2 && s.ec ? s.ec : null;
  // AUDIT SD II (L6 F6): a fallen Echo's chip counts to its rising, pulsing at the last (it said "fallen" and no time)
  const riseIn = (E) => (E.h > 0 || !(E.dn > 0) ? null : Math.max(0, E.dn + profileOf(s).pairMs - now));   // SD18a: the Dragon's Break's ten
  const chip = (E, e) => { const r = riseIn(E); return r === null ? SD_BAR_TEXT.echoLeft(E.h, E.m) : SD_BAR_TEXT.rises(e, Math.ceil(r / 1000)).replace(/^(Gold|Silver) /, ''); };
  const resetComing = !s.fell && !s.ended && s.ph >= 3 && s.rk > now && !(s.rem?.atk?.a === SD_BLOWS.reset.id && !sdBlowDone(s.rem.atk, now));
  return {
    theme: 'brass', ringCss: SD_BAR_CSS.ring,
    // SD18b: the Hour's marks under its health - its Ending's signature in its light, then its omens (ui/sdMarksView.js); the
    // phase's name kept over the bar (the Ending is the row's)
    name: SD_BAR_TEXT.name, title: SD_PHASE_NAMES[s.ph - 1] ?? '', epithet: '', epithetColor: null, marksView: sdMarksViewOf(s.mk), trials: s.mk ? sdOmensLine(s.mk) : '',
    frac, marks: [...SD_PHASE_AT], phase: s.ph, spent: SD_PHASE_AT.map((_, i) => s.ph > i + 1),
    warded, fallen: !!s.fell, callout,
    wrath: s.fell ? null : sdHourOver(s, now) ? SD_BAR_TEXT.ended : toEnd <= SD_ENDS_WARN_MS ? SD_BAR_TEXT.endsIn(countdownText(toEnd)) : null,   // AUDIT SD II (L4 F3): ended at its moment - its wind-up still counts down, and still takes blows
    wrathNear: !s.fell && (!!s.ended || toEnd <= SD_ENDS_NEAR_MS),
    fighters: s.n | 0, fightersLine: SD_BAR_TEXT.fighters(s.n | 0),
    host: ec ? SD_BAR_TEXT.echoes(chip(ec[0], 0), chip(ec[1], 1)) : null,
    hostNear: !!ec && ec.some((E) => { const r = riseIn(E); return r !== null && r <= SD_ECHO_RISE_NEAR_MS; }),
    reckonIn: resetComing ? SD_BAR_TEXT.resetIn(countdownText(s.rk - now)) : null,
    alpha: Math.round(alpha * 20) / 20, now, low: !s.fell && frac > 0 && frac < LOW_HEALTH,
  };
}
