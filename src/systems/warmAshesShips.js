// WA1 (2026-09-25, Mac: "All mods attached are to be compatible and
// implemented 1:1") - WARM ASHES - SHIPS 1.1 (Kamer): "Encounters on Ships
// and Ocean Fast Travel". The mod's code, ported off its IL
// (vendor/warm-ashes-ships/il/Warm_Ashes_Ships.il.txt; the ILSpy reading
// agrees line for line):
//
//   OnPreFastTravel [IL_03dc]  a journey that crosses the sea: three times
//     in four nothing (Random.Range(0, 100) < 75), and nothing while a
//     borrowed ship is out; else, sailing - the ambush is armed, a player
//     without a ship is LENT the large one, and both ship blocks take the
//     `_smallraid` world-data variant (the pirate vessels standing off);
//     not sailing - both take `_base`.
//   CheckforEncounters [IL_0384], OnPostFastTravel - an armed ambush waits
//     WaitForSeconds(0.05) on the mod's MonoBehaviour, then
//   TransportToShipWithDelay [IL_05e0]  starts WAQ_SHIP_SMALLRAID and puts
//     the player on the ship (TransportMode = Ship - a board, remembered
//     from the arrival); a lent ship is taken back at once (ResetShip -
//     you stand on a deck you do not own).
//   LeaveShip [IL_0540]  the quest's "Leave Ship": in region 31 (the sea,
//     PlayerGPS's politic 64) the blocks go back to `_base` and the player
//     is put ashore where they boarded - a lent ship is lent again just
//     long enough to leave it, then gone for good; anywhere else, nothing.
//
// The state is the mod's own save record, `WarmAshesShipsSaveData`
// (TempShip, HasTraveledbyShip), riding DFU's per-mod slot
// (systems/modSaveData.js). The world host (scenes/world.js) is the only
// host with a travel map, a ship or a quest machine for them, so it is the
// one that registers the seams below.
//
// `OnCreateLocationGameObject` [IL_04e3] / `HandleLocationWithDelay` [IL_06a0] wait
// half a second and log the location's name - a Debug.Log and nothing
// else, so nothing here.

import { modSetting } from './modSettings.js';
import { ActionTemplate } from './quest/actions.js';
import { setBlockVariant, ANY_LOCATION_KEY } from './worldDataVariants.js';
import { SHIP_TYPES } from './banking.js';
import { registerQuestList } from './quest/questLists.js';
import { registerModSaveData } from './modSaveData.js';

export const WARM_ASHES_VENDOR = 'warm-ashes-ships';
export const warmAshesOn = () => modSetting(WARM_ASHES_VENDOR, 'Enabled') === true;

/** The manifest's `Contributes.QuestLists`, registered as DFU registers a loaded mod's. */
export const WA_QUEST_LIST = 'WA_Ships';
/** The one quest the code starts [IL_0630]. */
export const WA_RAID_QUEST = 'WAQ_SHIP_SMALLRAID';
/** The two blocks the variants are set on, with AnyLocationKey (-8) [IL_047f, IL_03aa]. */
export const WA_SHIP_BLOCKS = Object.freeze(['SHIPAA00.RMB', 'SHIPAA01.RMB']);
export const WA_VARIANT_RAID = '_smallraid';
export const WA_VARIANT_BASE = '_base';
/** `Random.Range(0, 100) < 75` [IL_042c-IL_0436]: this share of sea crossings pass in peace. */
export const WA_PEACEFUL_PERCENT = 75;
/** `new WaitForSeconds(0.05f)` [IL_05ff]. */
export const WA_BOARD_DELAY_S = 0.05;
/** `CurrentRegionIndex == 31` [IL_054f] - the High Rock sea coast, PlayerGPS's answer for any ocean pixel. */
export const WA_SEA_REGION = 31;

// ---- the mod's state --------------------------------------------------------
// `hasTraveledbyShip` is the MonoBehaviour's field, `tempShip` its public
// static (LeaveShip writes it) - one module, both live here.
let hasTraveledbyShip = false;
let tempShip = false;
/** TransportToShipWithDelay in flight: the seconds left of its WaitForSeconds, else null. */
let _boardIn = null;

/** NewSaveData [IL_0265]. */
export const newSaveData = () => ({ TempShip: false, HasTraveledbyShip: false });
/** GetSaveData [IL_027a]. */
export const getSaveData = () => ({ TempShip: tempShip, HasTraveledbyShip: hasTraveledbyShip });
/** RestoreSaveData [IL_02a4]: both fields, as saved. */
export function restoreSaveData(data) {
  tempShip = data?.TempShip === true;
  hasTraveledbyShip = data?.HasTraveledbyShip === true;
}
export const isTempShip = () => tempShip;
export const hasArmedAmbush = () => hasTraveledbyShip;
export const boardPending = () => _boardIn !== null;

// ---- the host ---------------------------------------------------------------
/**
 * The world host's seams - GameManager's and DaggerfallBankManager's
 * members the mod reaches for:
 *   random()               UnityEngine.Random's uniform draw - THE ENGINE-PRNG RULE (Port-Ledger A):
 *                          injectable, Math.random by default, pinned for distribution never for sequence
 *   ownsShip()             DaggerfallBankManager.OwnsShip
 *   assignShip(shipType)   DaggerfallBankManager.AssignShipToPlayer (the permanent scenes with it)
 *   resetShip()            DaggerfallBankManager.ResetShip
 *   getQuest(name, faction) QuestListsManager.GetQuest
 *   startQuest(quest)      QuestMachine.StartQuest(Quest) - the immediate arm
 *   setTransportModeShip() TransportManager.TransportMode = Ship (UpdateMode's ship arm: a board, or a landing)
 *   currentRegionIndex()   PlayerGPS.CurrentRegionIndex
 *   setBlockVariant        WorldDataVariants.SetBlockVariant (a seam for the tests; the registry by default)
 */
let _host = null;
export function setWarmAshesHost(host) { _host = host ?? null; }
const host = () => _host ?? {};
const variant = (name, v) => (host().setBlockVariant ?? setBlockVariant)(name, v, ANY_LOCATION_KEY);
/** UnityEngine.Random.Range(int, int): min inclusive, max exclusive. */
const rangeInt = (min, maxExclusive, random) => (maxExclusive <= min ? min : min + Math.floor(random() * (maxExclusive - min)));

/** WarmAshesShips.ResetShip [IL_03aa] - the static the quest action calls: both blocks back to `_base`. */
export function resetShipVariants() {
  for (const block of WA_SHIP_BLOCKS) variant(block, WA_VARIANT_BASE);
}

/**
 * OnPreFastTravel [IL_03dc], raised where DaggerfallTravelPopUp raises it -
 * after the fare is taken, before the teleport. `oceanPixels` is the
 * journey's TravelTimeCalculator.OceanPixels, `travelShip` the popup's
 * TravelShip toggle. Answers what it did, for the pins.
 */
export function onPreFastTravel({ oceanPixels = 0, travelShip = false } = {}) {
  if (!(oceanPixels > 0)) return 'no-water';   // "WA High Seas: No Water Detected on Travel"
  const h = host();
  if (rangeInt(0, 100, h.random ?? Math.random) < WA_PEACEFUL_PERCENT || tempShip) return 'peace';
  if (travelShip) {
    const owns = !!h.ownsShip?.();
    hasTraveledbyShip = true;
    if (!owns) {
      tempShip = true;
      h.assignShip?.(SHIP_TYPES.Large);   // "Temporary ship assigned."
    }
    for (const block of WA_SHIP_BLOCKS) variant(block, WA_VARIANT_RAID);
    return owns ? 'raid' : 'raid-lent';
  }
  for (const block of WA_SHIP_BLOCKS) variant(block, WA_VARIANT_BASE);   // "Player is not traveling by ship."
  return 'base';
}

/** CheckforEncounters [IL_0384], OnPostFastTravel's subscriber: an armed ambush starts the coroutine. */
export function onPostFastTravel() {
  if (hasTraveledbyShip) _boardIn = WA_BOARD_DELAY_S;
}

/**
 * The coroutine's clock - the mod's Time.deltaTime, held by a pause and
 * scaled with the world, as every MonoBehaviour's is. `dt` is that scaled
 * delta; the host calls this once a frame in every mode.
 */
export function frame(dt) {
  if (_boardIn === null) return false;
  _boardIn -= dt;
  if (_boardIn > 0) return false;
  _boardIn = null;
  transportToShip();
  return true;
}

/** The coroutine's body after its yield [IL_0617-IL_0675]. */
function transportToShip() {
  const h = host();
  if (hasTraveledbyShip) {
    const quest = h.getQuest?.(WA_RAID_QUEST, 0) ?? null;
    if (quest != null) {
      h.startQuest?.(quest);
      h.setTransportModeShip?.();
    }
    hasTraveledbyShip = false;
    if (tempShip) h.resetShip?.();
  }
  hasTraveledbyShip = false;
}

/** "Leave Ship" - the quest action the mod registers in Awake [IL_0303]. */
export class LeaveShip extends ActionTemplate {
  static typeName = 'LeaveShip';
  /** Pattern [IL_050c]: the literal, unanchored. */
  get pattern() { return /Leave Ship/; }
  createNew(source, parentQuest) {
    if (!this.test(source)) return null;
    return new LeaveShip(parentQuest);
  }
  /** Update [IL_0540]. */
  update(_caller) {
    const h = host();
    if (h.currentRegionIndex?.() === WA_SEA_REGION) {
      resetShipVariants();
      if (!h.ownsShip?.()) {
        h.assignShip?.(SHIP_TYPES.Large);
        h.setTransportModeShip?.();
        tempShip = false;
        h.resetShip?.();
        this.setComplete();
      } else {
        h.setTransportModeShip?.();
        this.setComplete();
      }
    } else {
      this.setComplete();
    }
  }
}

let _installed = false;
/** Once, at the scene boot (before the quest bridge is built, as DFU loads a mod before the game): the
 *  quest list, and the save record's slot. The action registers on the machine the host builds. */
export function installWarmAshesShips() {
  if (_installed) return false;
  _installed = true;
  registerQuestList(WA_QUEST_LIST, warmAshesOn);
  registerModSaveData(WARM_ASHES_VENDOR, { newSaveData, getSaveData, restoreSaveData });
  return true;
}

/** Test seam. */
export function _resetWarmAshesShips() {
  hasTraveledbyShip = false; tempShip = false; _boardIn = null; _host = null; _installed = false;
}
