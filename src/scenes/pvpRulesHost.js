// @ts-check
// PVP-RULES (systems/wild/pvpRules.js): THE FLAG'S LIMITS, ON THIS PAGE - the module the world host wires (src/scenes/
// fishHost.js is the shape; it hands the flag host on, so the wiring is the flag's own line). It tells the law when I am
// held (my flag up in the open zone), hangs the caps on the motor and the refusal on the rest window, and polls: the flag
// going up ends my PvE buffs; while it is up a Levitate, a buff of my own or a worn item's goes, a rider is set on foot,
// and a landing spends the spared fall. The flag down, the worn set's buffs are recast.
import { wildHere } from '../systems/wild/wildZone.js';
import { registerMoveCap } from '../player/motor.js';
import { registerPreventRestCondition } from '../systems/rest/restSession.js';
import { setRideBar, rideFoot } from '../player/mountRig.js';
import { isRiding } from '../systems/transport.js';
import { restartHeldEnchantments } from '../systems/enchantments.js';
import { pvpRestLockText, pvpLockSecs } from '../ui/pvpHud.js'; // PVP-HUD
import {
  PVP_LIMITS,
  setPvpLimitedSource,
  pvpLimited,
  notePvpGround,
  stripPvpBuffs,
  takePvpHeldTaken,
  pvpRestText,
  pvpDispelText,
  pvpRideText,
} from '../systems/wild/pvpRules.js';

/** How often the poll runs, ms: a buff cast in the gap lives this long at most. */
export const PVP_RULES_POLL_MS = 250;

/**
 * The host's own (positional, so the wiring is one line of it): the flag host (handed back as `flag`), the motor, the
 * player entity, the mid-screen line.
 * @param {{ on: () => boolean, fightLeft?: () => number }} flag @param {any} motor @param {any} entity @param {(line: string) => void} midScreen
 * @param {{ zone?: () => boolean, every?: ((fn: () => void, ms: number) => any) | null }} [o]
 */
export function createPvpRulesHost(
  flag,
  motor,
  entity,
  midScreen,
  { zone = wildHere, every = typeof setInterval === 'undefined' ? null : setInterval } = {},
) {
  setPvpLimitedSource(() => !!flag?.on() && !!zone());
  registerMoveCap('pvpRules', () => (pvpLimited() ? PVP_LIMITS : null));
  // PVP-HUD (the mockup: "You cannot rest in combat. {s} s left."): in the lock the refusal counts down - asked first
  const lockS = () => pvpLockSecs(flag?.fightLeft?.() ?? 0);
  const restLock = () => pvpLimited() && lockS() > 0;
  registerPreventRestCondition(restLock, pvpRestLockText(lockS()));
  const rest = () => pvpLimited();
  registerPreventRestCondition(rest, pvpRestText());
  setRideBar(() => (pvpLimited() ? pvpRideText() : null), midScreen);
  let was = false;
  const tick = () => {
    const on = pvpLimited();
    notePvpGround(!!motor?.grounded && !motor?.levitating, on);
    if (on) {
      const n = stripPvpBuffs(entity, !was);
      if (lockS()) registerPreventRestCondition(restLock, pvpRestLockText(lockS())); // PVP-HUD: the seconds now
      if (!was) registerPreventRestCondition(rest, pvpRestText()); // the line in the language now
      if (!was && n) midScreen(pvpDispelText());
      if (isRiding(motor?.transportMode)) {
        rideFoot();
        midScreen(pvpRideText());
      } // the owner: "No horse u demoibt"
    } else if (takePvpHeldTaken()) restartHeldEnchantments(entity); // the flag down: the worn set's buffs come back, recast (no durability billed)
    was = on;
  };
  every?.(tick, PVP_RULES_POLL_MS);
  return { flag, tick, limited: pvpLimited };
}
