// THE PISTOL LAB'S PAIR, MOVED (PISTOL-PORT, 2026-10-22; the owner: "I want the prototype itself implemented just like
// we did with thunderlock"; bible/05-Combat/Dwarven-Pistolet.md "PISTOL-PORT"). Two of the gun lab's machines - one shot,
// six frames and a reload EACH, so the second pistol fires while the first is still mid-shot - and the rule for which one
// a pull fires. It was src/tools/pistolLab.js's own while the page was the only thing that fired pistols; the Dwarven
// Pistolet fires on it now (combat/playerWeapon.js, one pistol or a pair), so it is the game's, and the lab imports it
// back from here. Not a line of it changed on the way; one door was added for the game (`fireHand`, below).

import { createGunMachine } from './gunMachine.js';
import { PISTOL_STRIP } from './pistolStrip.js';   // THUNDERLOCK-ART2's audit: the cycle the Pistolet's own strip's, never the lab sheet's by coincidence
import { HANDS_MODE, strikeHandOf, otherHand } from '../twoHands/handsLaw.js';

/** How the trigger is pulled with a pistol in each hand. */
export const PAIR_TRIGGER = Object.freeze({
  /** One pistol, DFU's one used hand - the gun lab's own case. */
  Single: 'single',
  /** The game's flurry (strikeHandOf): the lead opens, a pull inside
   *  FLURRY_WINDOW of the last shot is the other hand's. */
  Alternate: 'alternate',
  /** Both barrels on one pull. */
  Volley: 'volley',
  /** Each hand its own button: the left mouse button the right hand,
   *  the right button the left. */
  PerHand: 'perHand',
});

/**
 * THE PAIR. Two of the gun lab's machines - one shot, six frames, a
 * reload each - and the rule for which one a pull fires.
 *
 * Alternate RUNS the game's flurry law (handsLaw.strikeHandOf, the one
 * the dual wielder's swords obey): the lead opens, and a pull while the
 * last shot is still in flight or inside FLURRY_WINDOW of it ending is
 * the other hand's. ONE DEPARTURE, the gun's: a sword can always swing,
 * a pistol mid-reload cannot fire, so when the hand the law names is
 * not loaded the pull falls to the other hand if it is - the trigger
 * finds the loaded pistol rather than clicking on an empty one. Pinned,
 * so it is a decision and not an accident.
 *
 * `t` is the pair's own clock (seconds), advanced by `step`; `sinceLast`
 * is 0 while a shot's frames still play (the hand is mid-blow, which is
 * the flurry's case) and the seconds since they ended after.
 */
export function createPair({ trigger = PAIR_TRIGGER.Alternate, lead = 'R', fps, cooldownMs, hitFrame } = {}) {
  const opts = { fps, cooldownMs, hitFrame, frames: PISTOL_STRIP.frames };
  const pair = {
    trigger, lead,
    R: createGunMachine(opts), L: createGunMachine(opts),
    t: 0, last: null, lastEnd: -Infinity,
    /** The hands in the order they fired, most recent last - the
     *  draw order (Two-Hands: the striking hand is drawn over the other). */
    order: ['L', 'R'],
    lastShot: null,
  };
  const loaded = (h) => pair[h].state === 'Idle';
  const sinceLast = () => (pair.last && pair[pair.last].state === 'Firing' ? 0 : pair.t - pair.lastEnd);
  const shoot = (h, info) => {
    if (!pair[h].fire()) return false;
    pair.last = h;
    pair.order = [otherHand(h), h];
    pair.lastShot = { hand: h, ...info };
    return true;
  };
  /** The hands that would fire on a pull of `button` (0 left mouse,
   *  2 right), as the law answers - before the loaded check. */
  pair.pick = (button = 0) => {
    if (pair.trigger === PAIR_TRIGGER.Single) return [pair.lead];
    if (pair.trigger === PAIR_TRIGGER.Volley) return [pair.lead, otherHand(pair.lead)];
    if (pair.trigger === PAIR_TRIGGER.PerHand) return [button === 2 ? 'L' : 'R'];
    return [strikeHandOf({ mode: HANDS_MODE.Dual, lead: pair.lead, last: pair.last, sinceLast: sinceLast() }).hand];
  };
  /** A pull of the trigger. Answers the hands that fired. */
  pair.pull = (button = 0) => {
    const fired = [];
    if (pair.trigger === PAIR_TRIGGER.Alternate) {
      const s = strikeHandOf({ mode: HANDS_MODE.Dual, lead: pair.lead, last: pair.last, sinceLast: sinceLast() });
      // the gun's departure: the named hand is empty, the other is loaded
      const h = loaded(s.hand) ? s.hand : (loaded(otherHand(s.hand)) ? otherHand(s.hand) : null);
      if (h && shoot(h, { off: h !== pair.lead, flurry: s.flurry })) fired.push(h);
      return fired;
    }
    for (const h of pair.pick(button)) if (shoot(h, { off: h !== pair.lead, flurry: false })) fired.push(h);
    return fired;
  };
  /** PISTOL-PORT: one named hand, if it is loaded - the game's door for what the page has no button for: a technique is
   *  the lead hand's (combat/techniques.js). Answers the hands that fired. */
  pair.fireHand = (h) => (loaded(h) && shoot(h, { off: h !== pair.lead, flurry: false }) ? [h] : []);
  /** Both machines, one clock. Answers each hand's event ('hit',
   *  'ready' or null) and records when a shot's frames end. */
  pair.step = (dt) => {
    pair.t += dt;
    const out = {};
    for (const h of ['R', 'L']) {
      const wasFiring = pair[h].state === 'Firing';
      out[h] = pair[h].step(dt);
      if (wasFiring && pair[h].state !== 'Firing' && pair.last === h) pair.lastEnd = pair.t;
    }
    return out;
  };
  /** The hands drawn: one in Single, both otherwise. */
  pair.hands = () => (pair.trigger === PAIR_TRIGGER.Single ? [pair.lead] : ['R', 'L']);
  return pair;
}
