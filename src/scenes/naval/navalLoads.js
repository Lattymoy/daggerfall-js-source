// @ts-check
// SHOT-KINDS (2026-10-17, the owner: "Different cannon shot types, for example a grape shot to thin out crew, Chain to try
// to take down their sail, etc"; bible/03-World/Naval-Refit.md SHOT-KINDS) - THE CAPTAIN'S CHOICE OF LOAD, at the helm.
// The port's own. The law of the loads is systems/naval/shotKinds.js and the deck's own (navalGunnery.js createGunDeck
// `setLoad`); this is the helm's side of it, wired by the naval host (navalHost.js createNavalHost `loads`):
//
//   WHICH GUNS. The load group the guns are laid with (the aim's side while the attack is held), else the one the look
//   bears on (navalGunnery.js sideForBearing), else her first group with guns - the broadsides, the bow chasers, the
//   stern guns. A group of barrels alone carries no load.
//   THE CHOICE. The wheel while the guns are laid (a notch on, a notch back - the camera's zoom waits while they are),
//   the ShotCycle key and a pad button chosen for it (systems/inputActions.js), and the helm panel's Shot button
//   (ui/enhanced/enhancedHelm.js helmButtons) - each steps the load on (shotKinds.js nextShot) and says it.
//   THE WORDS. A load's name (`shotName`), a group's (`groupName`) and the helm button's label (`label`), in the
//   player's language.

import { t } from '../../systems/textManager.js';
import { nextShot } from '../../systems/naval/shotKinds.js';
import { LOAD_GROUPS, loadGroupOf } from '../../systems/naval/navalGunnery.js';
import { batteryOf } from '../../systems/naval/navalShips.js';

/** The quiet the wheel keeps before it steps again (s): a trackpad's stream of small deltas steps once, not twenty times
 *  (AUDIT 2: the quiet since its last notch, not its last step). */
export const SHOT_WHEEL_S = 0.18;

const SHOT_WORDS = Object.freeze({
  round: () => t('naval.shot.round', 'Round shot'), grape: () => t('naval.shot.grape', 'Grapeshot'),
  chain: () => t('naval.shot.chain', 'Chain shot'), heated: () => t('naval.shot.heated', 'Heated shot'),
});
const GROUP_WORDS = Object.freeze({
  broadside: () => t('naval.shot.group.broadside', 'Broadsides'), bow: () => t('naval.shot.group.bow', 'Bow chasers'),
  stern: () => t('naval.shot.group.stern', 'Stern guns'),
});
/** A load's name in the player's language. */
export const shotName = (shot) => (SHOT_WORDS[shot] ?? SHOT_WORDS.round)();
/** A load group's name in the player's language. */
export const groupName = (group) => (GROUP_WORDS[group] ?? GROUP_WORDS.broadside)();

/** The sides of a load group. */
const sidesOf = (group) => (group === 'broadside' ? ['starboard', 'port'] : [group]);
/** A side of `group` with guns on `hull` (not barrels), or null. */
export function gunSideOf(hull, group) {
  return sidesOf(group).find((s) => { const b = batteryOf(hull, s); return !!b && b.gun !== 'barrel'; }) ?? null;
}

/**
 * The helm's loads.
 * @param {{ boat: () => any, deck: (boat: any) => any, side: (boat: any) => string | null, aiming: () => boolean,
 *   say?: (text: string, seconds: number) => void, now: () => number }} deps - `boat` the boat at my helm (null: none),
 *   `deck` her gun deck, `side` the side the guns are laid or the look bears (null: nowhere), `now` the clock (s)
 */
export function createNavalLoads(deps) {
  let wheelAt = -Infinity;
  /** The group the guns are laid with or the look bears on - else her first with guns; with its side. Null: no guns. */
  function groupAt(boat) {
    const look = loadGroupOf(deps.side(boat));
    const group = look && gunSideOf(boat.hull, look) ? look : LOAD_GROUPS.find((g) => gunSideOf(boat.hull, g)) ?? null;
    return group ? { group, side: gunSideOf(boat.hull, group) } : null;
  }
  /** Step the load of the group at hand on (`dir` 1) or back (-1), and say it. False: no boat, or no guns to load. */
  function cycle(dir = 1) {
    const boat = deps.boat();
    const at = boat ? groupAt(boat) : null;
    if (!at) return false;
    const deck = deps.deck(boat);
    const shot = nextShot(deck.load(at.side), dir);
    deck.setLoad(at.side, shot);
    deps.say?.(t('naval.shot.loading', '{guns}: {shot} - loading', { guns: groupName(at.group), shot: shotName(shot) }), 1.6);
    return true;
  }
  return {
    cycle,
    /** The wheel while the guns are laid: a step a turn of it - one after SHOT_WHEEL_S of quiet. True: the wheel is the
     *  guns' (even a notch inside that time - the camera's zoom never takes it while they are laid). AUDIT 2: the quiet is
     *  from the LAST notch (a debounce): timed from the last step, a trackpad's inertial stream stepped every SHOT_WHEEL_S
     *  of it, five loads in one swipe, each drawing the laid battery. */
    wheel(deltaY) {
      if (!deps.aiming() || !deltaY || !deps.boat()) return false;
      const now = deps.now(), quiet = now - wheelAt >= SHOT_WHEEL_S;
      wheelAt = now;
      if (quiet) cycle(deltaY > 0 ? 1 : -1);
      return true;
    },
    /** The helm button's label - "Broadsides: Grapeshot" - for the group at hand; null with no guns to load. */
    label(boat) {
      const at = boat ? groupAt(boat) : null;
      return at ? t('naval.shot.button', '{guns}: {shot}', { guns: groupName(at.group), shot: shotName(deps.deck(boat).load(at.side)) }) : null;
    },
  };
}
