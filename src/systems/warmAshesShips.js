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
/** THE MERGE of NAV-D and OWS3: the raids a running quest makes, AS THE QUEST MACHINE NAMES THEM - each file's own
 *  `Quest:` header (quest/parser.js): the ambush's, and a pirate flagship's, which the sea fight's boarders start from
 *  its file WAQ_SHIP_ATTACK_PIRATE.txt (scenes/naval/navalHost.js; systems/naval/navalBoarding.js WA_ATTACK_PIRATE) and whose
 *  header names it WAQ_SHIP_PIRATEATTACK. AUDIT NAV1 (B5): listed by its file's name, a flagship's raid was never read
 *  as running, and "one raid at a time" let an Overworld raider start a second on top of it. */
export const WA_RAID_QUESTS = Object.freeze([WA_RAID_QUEST, 'WAQ_SHIP_PIRATEATTACK']);
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
 *   leaveShipGate(quest)   NAV-D: the sea fight's word on a "Leave Ship" - 'naval' | 'wait' | 'proceed' (scenes/naval/navalHost.js)
 *   raidAshore(quest)      RAID-ASHORE: a raid thrown back where the player stands - its living foes withdrawn (scenes/raidAshore.js)
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
  // RAID-ASHORE (the port's own - bible/03-World/Naval-Refit.md): ONE RAID AT A TIME holds the fast travel too. The IL
  // arms its ambush whatever runs, and a voyage made while a raid's quest still ran started a second over the first
  // (raidAtSea and the sea fight's boarders already ask raidRefusal); its blocks are left as the running raid set them
  if (travelShip) return raidRefusal() === 'busy' ? 'busy' : armRaid();
  for (const block of WA_SHIP_BLOCKS) variant(block, WA_VARIANT_BASE);   // "Player is not traveling by ship."
  return 'base';
}

/** OnPreFastTravel's sailing arm [IL_044e-IL_04a3]: the ambush armed, a player without a ship LENT the large one, both
 *  ship blocks `_smallraid` (the pirate vessels standing off) - its one home, the Overworld's raid's too (raidAtSea). */
function armRaid() {
  const h = host();
  const owns = !!h.ownsShip?.();
  hasTraveledbyShip = true;
  if (!owns) {
    tempShip = true;
    h.assignShip?.(SHIP_TYPES.Large);   // "Temporary ship assigned."
  }
  for (const block of WA_SHIP_BLOCKS) variant(block, WA_VARIANT_RAID);
  return owns ? 'raid' : 'raid-lent';
}

/**
 * OWS3 (the port's own - bible/06-Systems/Travel-View.md "OWS - the sea"; the player's ask: "The pirate quest system
 * should work like how we're changing enemies and nearby dungeons. Like mount and blade"): THE RAID, SEEN COMING. A
 * raider that comes alongside a traveller at sea on the Overworld (systems/seaRaiders.js) makes the mod's own ambush:
 * the sailing arm of OnPreFastTravel arms it (armRaid) and CheckforEncounters starts its coroutine, so
 * TransportToShipWithDelay starts WAQ_SHIP_SMALLRAID and boards the ship, as the fast travel's ambush does - the roll
 * for peace is the sails' own (they were seen, and not outsailed). Refused (and said why) while an ambush is armed or
 * boarding or a raid quest runs (raidUnderWay: the sea fight's boarders' among them), and while a lent ship is out (the
 * fast travel's own `tempShip` refusal).
 */
export function raidAtSea() {
  const refused = raidRefusal();
  if (refused) return refused;
  const armed = armRaid();
  onPostFastTravel();
  return armed;
}

/** A raid quest running, whoever started it - the host's word off the quest machine's live table (WA_RAID_QUESTS). */
const raidRunning = () => !!host().raidRunning?.();
/** OWS3: why the mod refuses a raid NOW - an ambush armed or boarding, or a raid quest running whoever started it
 *  ('busy' - THE MERGE of NAV-D and OWS3, below), a lent ship out ('lent') - or null. The refusals' one home: raidAtSea
 *  answers with it, and AUDIT OW5b S1's host asks it before it lets go of the helm (a raid refused leaves the traveller
 *  sailing, the raider sheering off unheeded). */
export function raidRefusal() {
  if (hasTraveledbyShip || _boardIn !== null || raidRunning()) return 'busy';
  if (tempShip) return 'lent';
  return null;
}
/**
 * THE MERGE of NAV-D and OWS3 (2026-09-28): ONE RAID AT A TIME, WHOEVER STARTS IT. Beside the mod's own fast travel,
 * two starters make Warm Ashes' raid - a raider alongside on the Overworld (raidAtSea) and the sea fight's boarders on a
 * crewed Come Sail Away deck (scenes/naval/navalHost.js beginFight) - and neither saw the other's: a raid on the deck with
 * the mod's ship boarded under it, or a flagship's raid over an armed ambush. So each asks this one answer: an ambush
 * armed or boarding, a lent ship out, or a raid quest running - raidRefusal's, as a yes or no.
 */
export function raidUnderWay() {
  return raidRefusal() !== null;
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
  /** Update [IL_0540]. NAV-D (DECLARED, bible/03-World/Naval-Combat.md): the host's `leaveShipGate` is asked first -
   *  'naval', a raid the sea fight started on the player's own boat: done, nothing sailed (the IL would lend a ship and
   *  set the player on it); 'wait', a voyage's raid whose raiders' hold is open: not yet; 'proceed' (or no gate): the
   *  IL's own body. */
  update(_caller) {
    const h = host();
    const gate = h.leaveShipGate?.(this.parentQuest) ?? 'proceed';
    if (gate === 'wait') return;
    if (gate === 'naval') { this.setComplete(); return; }
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
      // RAID-ASHORE (DECLARED, bible/03-World/Naval-Refit.md; scenes/raidAshore.js): fought where the player stands - a
      // linked cabin's ship at her quay, the land - no ship sails them off it, so the raid ends HERE: its crew and its
      // last raiders withdrawn (the host's `raidAshore`), the ship blocks back to their base, and the quest ended as its
      // own `end quest` ends one - or its crew stood on, passive, called back five at a time for the rest of its hour
      resetShipVariants();
      h.raidAshore?.(this.parentQuest);
      this.parentQuest.questBreak = true;
      this.parentQuest.endQuest();
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
