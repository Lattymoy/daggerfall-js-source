// @ts-check
// CARGO-ANYWHERE (2026-10-17, the owner: "Cargo should be able to be accessed at any time. Currently it cannot be";
// bible/03-World/Naval-Refit.md CARGO-ANYWHERE) - THE HOLD'S DOOR: a ship of the player's opened from wherever they are.
//
// Come Sail Away opens a hold one way: a press on the boat's cargo box (trigger 112402), within the mod's 3.2 m of it
// (comeSailAway.js OpenBoatCargo -> OpenCargo -> the host's openCargo). BOAT-MENU's "Open storage" row presses that same
// box from anywhere on her hull - and nowhere else: not at her helm (AUDIT BOAT-MENU C1 - no list there: the pad's d-pad
// steers, and every hull's cargo box stands 5.9 m to 28 m from its wheel), not below deck in her cabin (CABIN-HULL - no
// boat answers a press there), not from her quay a step too far, and never for a ship laid up, packed or lying off
// somewhere else. And on the Enhanced skins the hold opened TAKE-ONLY: its loot target never said it was the player's
// own storage (SHIP-STORE's `storage: true`, comeSailAwayItems.js cargoLootTarget), so nothing could be put in.
//
// This module is the one door every other way in goes through (the hold's key, the helm's Hold button, the Fleet page's
// Hold):
// - THE SHIP AT HAND (`atHand`): the one at whose helm the player stands, the one whose deck they stand on, the one whose
//   cabin they are in - in that order.
// - ELSE THEIR SHIP (`press`): the last one they took the helm of while it is still theirs, else the first of the Fleet's
//   book - wherever she lies.
// - ANY SHIP OF THEIRS BY HER NUMBER (`openShip`, the Fleet page's): afloat here or anywhere (her boat's own hold), laid
//   up (Come Sail Away's PackedCargoes under her number - laidUpHold, the same list her placing takes back aboard), or
//   packed in the pack (the same list - PARTS-WEIGHT, FIELD BUGS 2026-10-18e: her parts weigh her timbers alone, so
//   nothing put in or taken out here weighs on them, wherever they lie).
// A Rowboat carries no hold - the mod gives her no cargo box (HULL_HOLDS) - and is said so.
//
// The hold is the player's own, kept in their save: online it is nobody else's to see, so opening it from afar shares
// nothing and spends nothing; Come Sail Away still weighs it on her way (UpdateBoatCargoMod) whenever she next sails.
//
//   deps = {
//     csa() -> Come Sail Away's runtime | null        (AllBoats, isSailing(), state.CurrentBoat, laidUpHold(uid))
//     aboard() -> the boat of mine whose deck I stand on, or null (navalHost.js boatInPlay's, or the deck's own bucket)
//     cabin() -> the sailing cabin I am in (worldModes.js sailingCabin - `{ uid, hull }`), or null
//     ships() -> the Fleet's records ({ uid, hull }) - the ledger's own by default (fleet.js fleetShips)
//     partsOf(uid) -> her parts item in the pack, or null
//     openHold(target) -> bool    the inventory window over a loot target (world.js csaOpenCargo's door)
//     nameOf(uid) -> her name, or ''
//     say(text)
//   }

import { cargoLootTarget } from '../systems/comeSailAway/comeSailAwayItems.js';
import { CARGO_CONTAINER_IMAGE } from '../systems/comeSailAway/comeSailAwayBoat.js';
import { seaHoldShut, seaHoldShutText } from '../systems/naval/seaHoldGuard.js';   // AUDIT SEA VENTURES B3: a wrecked ship's hold shut while she may be boarded
import { t } from '../systems/textManager.js';
import { fleetShips, titleOf as titleDeedOf } from '../systems/fleet.js';

/** The hulls that carry a hold (a cargo box): every one but the Rowboat (comeSailAwayBoat.js HULL_NAMES' order). */
export const HULL_HOLDS = Object.freeze([false, true, true, true, true]);
export const holdsCargo = (hull) => !!HULL_HOLDS[hull];
/** AUDIT 2: whether a hull's hold opens - one with a box, or a Rowboat with something aboard (Come Sail Away gives every
 *  boat her Cargo, and the sea fills it - a cask's goods rowed through, a strand's salvage - with no box to open it by). */
const opens = (hull, items) => holdsCargo(hull) || (Array.isArray(items) && items.length > 0);

/**
 * @param {any} deps
 */
export function createHoldDoor(deps) {
  /** The uid of the last ship whose helm I took (this session) - `press`'s first choice once she is out of reach. */
  let lastHelm = null;
  const csa = () => deps.csa?.() ?? null;
  const afloat = (uid) => (csa()?.AllBoats ?? []).find((b) => b?.uid != null && String(b.uid) === String(uid)) ?? null;
  const said = (ok, text) => { if (text) deps.say?.(text); return ok; };
  const ships = () => deps.ships?.() ?? fleetShips();

  /** The ship at hand: at her helm, on her deck, in her cabin - or null. */
  function atHand() {
    const r = csa();
    if (r?.isSailing?.() && r.state?.CurrentBoat) return r.state.CurrentBoat;
    const deck = deps.aboard?.() ?? null;
    if (deck) return deck;
    const cabin = deps.cabin?.() ?? null;
    return cabin ? afloat(cabin.uid) : null;
  }

  /** Her hold's title on the window: her name's, or her hull's. */
  const titleOf = (uid) => { const n = uid != null ? deps.nameOf?.(uid) ?? '' : ''; return n ? t('naval.hold.titleNamed', '{name}\'s hold', { name: n }) : t('naval.hold.title', 'Ship\'s hold'); };

  /** A standing boat's hold opened. */
  function openBoat(boat) {
    if (!boat?.Cargo) return said(false, t('naval.hold.none', 'There\'s no hold here.'));
    if (!opens(boat.hull, boat.Cargo.Items)) return said(false, t('naval.hold.rowboat', 'Rowboats have no hold.'));
    if (seaHoldShut(boat.uid)) return said(false, seaHoldShutText());
    return !!deps.openHold?.({ ...cargoLootTarget(boat.Cargo), title: titleOf(boat.uid) });
  }

  /** A ship of mine by her number - afloat anywhere, laid up, or packed - her hold opened. */
  function openShip(uid) {
    const boat = afloat(uid);
    if (boat) return openBoat(boat);
    const rec = ships().find((s) => String(s.uid) === String(uid)) ?? null;
    if (!rec) return said(false, t('naval.hold.notYours', 'You don\'t own that ship.'));
    const r = csa();
    if (!holdsCargo(rec.hull) && !r?.laidUpHold?.(uid)?.length) return said(false, t('naval.hold.rowboat', 'Rowboats have no hold.'));
    if (!r?.laidUpHold) return said(false, t('naval.hold.noSea', 'Come Sail Away is not running.'));
    const items = r.laidUpHold(uid);
    const parts = deps.partsOf?.(uid) ?? null;
    // packed: AUDIT 2: her parts stored in her own hold come back to the pack as the window shuts (none of her left to the
    // Fleet - no parts, no title - and her hold with no door). PARTS-WEIGHT: nothing here weighs on them - they weigh her
    // timbers alone (PackBoat), so a stow can never make them heavier than the bearer can lift
    const onClose = parts ? () => {
      const at = items.indexOf(parts);
      if (at >= 0) { items.splice(at, 1); deps.toPack?.(parts); }
    } : null;
    return !!deps.openHold?.({ ...cargoLootTarget({ Items: items, ContainerImage: CARGO_CONTAINER_IMAGE, playerOwned: true }), title: titleOf(uid), ...(onClose ? { onClose } : {}) });
  }

  return {
    atHand, openBoat, openShip,
    /** THE HOLD'S KEY: the ship at hand's hold, else my last helm's, else the first of my fleet's - or why none. */
    press() {
      const here = atHand();
      // AUDIT 2: a boat at hand whose hold will not open (a Rowboat with nothing aboard) is none to open - the last helm's is
      if (here && (!here.Cargo || opens(here.hull, here.Cargo.Items))) return openBoat(here);
      // AUDIT 2: never one with no door to her - not standing, her parts not in the pack, no title in the book (the Fleet's
      // `lost`: her parts in a chest, her hold none of mine to reach)
      const mine = ships().filter((s) => holdsCargo(s.hull) && (afloat(s.uid) || deps.partsOf?.(s.uid) || titleDeedOf(s.uid)));
      const pick = (lastHelm != null && mine.find((s) => String(s.uid) === String(lastHelm))) || mine[0] || null;
      if (!pick) return said(false, t('naval.hold.noShip', 'You have no ship with a hold.'));
      return openShip(pick.uid);
    },
    /** Each frame: the ship whose helm I hold now is the one `press` falls back to once I leave her. */
    frame() {
      const r = csa();
      const b = r?.isSailing?.() ? r.state?.CurrentBoat : null;
      if (b?.uid != null && holdsCargo(b.hull)) lastHelm = b.uid;
    },
    get lastHelm() { return lastHelm; },
  };
}
