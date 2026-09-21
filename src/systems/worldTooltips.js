// WORLD TOOLTIPS 1.1 (jefetienne, MIT) - THE NAMING LADDER.
//
// Ported 1:1 from the mod's OWN source, which the bundle ships as a
// Unity TextAsset: `vendor/world-tooltips/Scripts/
// Modded_HUDTooltipWindow.cs`. Every arm below cites the line it comes
// from. Nothing here is a decompile and nothing here is invented.
//
// WHAT THIS MODULE IS, AND WHAT IT IS NOT. It is the WORDS - which
// thing gets called what. It is not the ray, not the pick, not the
// reach and not the drawing: `systems/worldHover.js` owns the frame
// law and `ui/worldPlaque.js` the face. That split is why the mod's
// ladder could be carried whole without carrying its engine.
//
// ── THE ONE STRUCTURAL DIFFERENCE, STATED ONCE ──────────────────
//
// THE MOD ASKS "WHAT COMPONENT IS ON THIS TRANSFORM"; THE PORT ASKS
// "WHAT KEY WON THE PICK". The mod walks reach BANDS in order (Mobile
// NPC 6.4, Static NPC 6.4, Default 3.2, loot, Door 3.2, static doors
// last) and inside each band asks `CheckComponent<T>` until something
// answers. The port has no components and no band walk: its activation
// targets already carry their own `reach`, `pickActivatableHit` races
// them, and `resolveHover` applies the winner's reach. So the bands are
// enforced BEFORE this module is asked, per family, by the very pick
// the press uses - which is the whole point of the merge, and a
// stronger guarantee than the mod's own, because the mod's bands and
// PlayerActivate's handlers are two copies of one set of constants.
//
// Three consequences worth writing down rather than rediscovering:
//
//  - THE MOD'S 6.4 RAY CLAMP is structurally already here.
//    `rayDistance = PlayerActivate.StaticNPCActivationDistance`
//    (the mod's widest band), so the mod never labels anything past
//    6.4. The port's widest reach IS 6.4 (the two NPC constants), and
//    every other family's is smaller, so the reach gate answers the
//    same everywhere without a second clamp to keep in step.
//
//  - THE MOD'S "Default" BAND IS NOT GUARDED by `IsNullOrEmpty(ret)`
//    the way the bands around it are (.cs:398) - a quirk, and one that
//    lets the Default band overwrite a Static NPC name at close range.
//    It is unreachable here: one key wins, one namer answers, there is
//    no second band to overwrite the first.
//
//  - `CustomDoor.HasHit`, the `DoorData`/`doorDataDict` apparatus, the
//    terrain stop, `MeshFilter` name scraping and `CheckComponent<T>`
//    are all engine plumbing with no port counterpart. The model id a
//    mesh name is scraped FOR is carried on the record instead
//    (WORLD-HOVER's groundwork slice put it there).
//
// ── THE CACHING LAW ─────────────────────────────────────────────
//
// The mod caches on the hit TRANSFORM (`prevHit`) and returns
// `prevText` unchanged while the ray keeps meeting it (.cs:266-275).
// The port caches on what would be PAINTED (`worldHover.frameSignature`)
// which is strictly stronger: it also sees a container's contents
// change under a constant key, which the mod cannot.
import { modSetting } from './modSettings.js';
import { itemLongName } from './itemInfo.js';   // RF6: ResolveItemLongName, the port's one resolver
import { buildingClosedText, buildingLockValue } from './buildingLocks.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';
import { TRIGGER_FLAGS } from '../world/rdbLayout.js';   // DFBlock.RdbTriggerFlags has ONE home; this arm compares against it rather than a second copy by name

/** The mod's switch, and its one knob. Online forces every mod on
 *  (OL1), which `modSetting` already applies - right for this one: a
 *  label over a door is a look, and OL1 has ruled on looks. */
export const worldTooltipsOn = () => modSetting('world-tooltips', 'Enabled');
/** `HideDefaultInteractTooltip` (.cs:42, :465). The author's own
 *  reason, in his own words: "Enable to not give a default indication
 *  on interactable objects that may have been intended to be secret,
 *  particularly regarding puzzles in the main quest." */
export const hideInteractTooltip = () => modSetting('world-tooltips', 'HideDefaultInteractTooltip');

/** The mod's own default label for a thing it knows is interactive and
 *  has no word for (.cs:465-466). */
export const INTERACT_TEXT = '<Interact>';

// ── THE SIXTEEN DAEDRA (.cs:334-384) ────────────────────────────
//
// Indexed by the summoning billboard's RECORD in archive 175, which is
// NOT the port's `systems/daedraSummoning.js` order - that table is by
// factionId and its index 8 (Sheogorath) is load-bearing for the
// summoning itself. Two different orderings of one pantheon, each
// right for its own question, so this is a second table on purpose and
// the other must not be re-sorted to serve it.
//
// SPELLING: the mod writes "Vaermina"; the port's summoning table
// writes "Vaernima", which is Daggerfall's own spelling and what the
// player sees on the summoning day. This table is the MOD's, verbatim,
// so it keeps the mod's spelling - and the difference is named here
// rather than silently reconciled, because reconciling it would mean
// one of the two stops being a faithful copy of its source.
export const DAEDRA_BY_RECORD = Object.freeze([
  'Azura', 'Boethiah', 'Clavicus Vile', 'Hircine',
  'Hermaeus Mora', 'Malacath', 'Mehrunes Dagon', 'Mephala',
  'Meridia', 'Molag Bal', 'Namira', 'Nocturnal',
  'Peryite', 'Sanguine', 'Sheogorath', 'Vaermina',
]);
export const DAEDRA_ARCHIVE = 175;

/**
 * A static NPC's name on the plaque (.cs:325-393): the Daedra table
 * when the billboard is a summoning one, else the NPC's own display
 * name - which the CALLER resolves, through the port's existing
 * `characters/staticNpc.js staticNpcName` (StaticNPC.DisplayName).
 *
 * Deliberately NOT called `staticNpcName`: that name is already taken
 * by that other DFU member, and two different members wearing one
 * port name is the collision the bible names first. This one is the
 * mod's OVERRIDE of it, and reads as one.
 */
export function npcHoverName(displayName, { archive = -1, record = -1 } = {}) {
  if (archive === DAEDRA_ARCHIVE) {
    const d = DAEDRA_BY_RECORD[record];
    if (d) return d;
  }
  return displayName || null;
}

// ── ACTION OBJECTS (.cs:400-471) ────────────────────────────────
//
// Only Direct, Direct6 and MultiTrigger action objects are named at
// all (.cs:403-405) - the rest are chain links and traps the player is
// not meant to see as interactive.
export const ACTION_TRIGGERS_NAMED = Object.freeze([
  TRIGGER_FLAGS.Direct, TRIGGER_FLAGS.Direct6, TRIGGER_FLAGS.MultiTrigger,
]);

/** The three models the mod names outright (.cs:420-431). */
export const ACTION_MODEL_NAMES = Object.freeze({
  74037: 'Wheel',
  61027: 'Lever',
  61028: 'Lever',
  74143: 'The Mantella',
});

/**
 * ...AND WHICH OF THEM ALSO RAISE `multiTriggerOkay` (AUDIT-WH M2).
 *
 * The switch is not symmetric, and the asymmetry is load-bearing:
 *
 *   case 74037: ret = "Wheel";         multiTriggerOkay = true; break;
 *   case 61027: case 61028:
 *               ret = "Lever";         multiTriggerOkay = true; break;
 *   case 74143: ret = "The Mantella";                           break;
 *
 * The Mantella names itself and does NOT raise the flag, so a
 * MultiTrigger Mantella falls into `.cs:459-461` and is silenced
 * OUTRIGHT - `ret = null` - name and all. A Direct or Direct6 one is
 * still "The Mantella".
 *
 * The port derived the flag as "has a name OR is on the OK list",
 * which is true of three of the four and promotes the fourth. It is a
 * TABLE now, because the mod's is.
 */
const MT_OK_BY_NAME = new Set([74037, 61027, 61028]);

/**
 * MultiTrigger models the mod allows through WITHOUT a name
 * (.cs:432-437: 62323, and the three secret teleports 72019/74215/
 * 74225). They fall to `<Interact>` rather than being silenced.
 *
 * The rule around them (.cs:459-461) is the interesting half: a
 * MultiTrigger object that is NOT on this list, and has no name of its
 * own, is silenced OUTRIGHT (`ret = null`) - not defaulted. MultiTrigger
 * is the flag on collision plates and trap volumes, so labelling every
 * one of them would draw a box round every pressure pad in the dungeon.
 */
export const MULTI_TRIGGER_NAMED_OK = Object.freeze([62323, 72019, 74215, 74225]);
const MT_OK = new Set(MULTI_TRIGGER_NAMED_OK);

/**
 * An action object's word, or null for silence. `triggerFlag` is the
 * object's RdbTriggerFlags name; `modelIdNum` is the model it was
 * built from - what the mod scrapes off the MeshFilter's name
 * (.cs:408-418) and the port carries on the record.
 */
export function actionName(triggerFlag, modelIdNum, { hideInteract = false } = {}) {
  if (!ACTION_TRIGGERS_NAMED.includes(triggerFlag)) return null;
  const named = ACTION_MODEL_NAMES[modelIdNum] ?? null;
  // AUDIT-WH M2: the NAMED models that also raise the flag, not every
  // named model - The Mantella names itself and does not raise it.
  const multiOk = MT_OK_BY_NAME.has(modelIdNum) || MT_OK.has(modelIdNum);
  // .cs:459-461 - an unlisted, unnamed MultiTrigger says NOTHING.
  if (triggerFlag === TRIGGER_FLAGS.MultiTrigger && !multiOk) return null;
  if (named) return named;
  return hideInteract ? null : INTERACT_TEXT;
}

// ── HOUSE CONTAINERS, BY MODEL ID (.cs:552-629) ─────────────────
//
// Keyed by the FULL model id, because `% 100` cannot tell 41003
// (Wardrobe) from 41803 (Dresser) - which is why WORLD-HOVER's
// groundwork slice made the container record carry its model id
// instead of only the derived texture record.
const CONTAINER_NAME_GROUPS = Object.freeze([
  ['Wardrobe', [41003, 41004, 41800, 41801]],
  ['Cabinets', [41007, 41008, 41033, 41038, 41805, 41810, 41802]],
  ['Shelf', [41027]],
  ['Dresser', [41034, 41050, 41803, 41806]],
  ['Cupboard', [41032, 41035, 41037, 41051, 41807, 41804, 41808, 41809, 41814]],
  ['Crate', [41815, 41816, 41817, 41818, 41819, 41820, 41821, 41822, 41823,
    41824, 41825, 41826, 41827, 41828, 41829, 41830, 41831, 41832, 41833, 41834]],
  ['Chest', [41811, 41812, 41813]],
]);
export const HOUSE_CONTAINER_NAMES = Object.freeze(Object.fromEntries(
  CONTAINER_NAME_GROUPS.flatMap(([name, ids]) => ids.map((id) => [id, name])),
));

/**
 * A house container's word - the mod's `default: "<Interact>"`
 * (.cs:627-628) for a furniture model its table does not list.
 *
 * AUDIT-WH M3: AND IT IS UNCONDITIONAL. `HideDefaultInteractTooltip`
 * guards exactly ONE `<Interact>` in the whole mod - the ACTION arm's
 * (`if (!HideInteractTooltip && string.IsNullOrEmpty(ret))`, .cs:465-466)
 * - and the container switch's `default` has no such guard. The port
 * took the knob to both, which is a quieter game than the mod's and
 * was PINNED as though it were the mod's behaviour: a pin that
 * certifies a departure is worse than no pin, because it reads as
 * evidence.
 *
 * The knob is the mod's own and stays exactly where the mod put it.
 */
export function houseContainerName(modelIdNum) {
  return HOUSE_CONTAINER_NAMES[modelIdNum] ?? INTERACT_TEXT;
}

export const SHOP_SHELF_TEXT = 'Shop Shelf';
export const LOOT_PILE_TEXT = 'Loot Pile';
export const LADDER_TEXT = 'Ladder';
export const BOOKSHELF_TEXT = 'Bookshelf';
export const BULLETIN_BOARD_TEXT = 'Bulletin Board';

/**
 * A dropped pile's or a random treasure's word (.cs:534-548). A pile
 * holding exactly ONE item is named by that item, with its stack count
 * in parentheses; anything else is "Loot Pile".
 *
 * THE PORT DOES NOT STOP THERE, and that is its own recorded departure
 * (Ledger A): where the mod says "Loot Pile" the plaque LISTS what is
 * in the pile, which is PX21c's answer and predates the mod's arrival.
 * This function is the mod's word for the TITLE over those rows, so a
 * pile of one still reads as the mod wrote it.
 */
export function lootPileName(items) {
  const list = (items ?? []).filter(Boolean);
  if (list.length !== 1) return LOOT_PILE_TEXT;
  const it = list[0];
  const n = itemLongName(it) || LOOT_PILE_TEXT;
  const stack = it.stackCount ?? 1;
  return stack > 1 ? `${n} (${stack})` : n;
}

/**
 * A corpse's word (.cs:526): the entity's name and "(dead)".
 *
 * AUDIT-WH M9: and NOTHING ELSE. The mod is `loot.entityName + " (dead)"`
 * with no fallback, and the port had invented 'Body' for a nameless
 * one - a word World Tooltips does not contain, on a branch that is
 * unreachable anyway (both pools name a body through
 * `enemyDisplayName`, which answers for every mobile in the table).
 * An invented word on an unreachable branch is still an invented word,
 * and it read as though the mod had one.
 */
export const corpseName = (entityName) => `${entityName ?? ''} (dead)`;

// ── THE MOBILE BAND (.cs:297-320) ───────────────────────────────
//
// AUDIT-WH H2. The mod names three things inside
// PlayerActivate.MobileNPCActivationDistance and nothing beyond it -
// a walking townsperson, a LIVE entity that is not hostile, and the
// bulletin board. The band was unported: the plaque raced a door
// behind a townsperson the press would have talked to, and said
// nothing about either.
//
// The distance is the MOD's, not the port's press. The press reaches
// for the RAY and speaks its own refusal inside the handler
// (AUDIT 65 MC-2), and ActivateMobileEnemy's Info arm has no distance
// gate at all (PlayerActivate.cs:816-825). So a townsperson or a foe
// out past 6.4 still takes the press and the plaque still says
// NOTHING about it - which is not a disagreement between them but the
// mod's own silence, carried as the pick's `reach`.

/** .cs:299-302 - a walking townsperson is MobilePersonNPC.NameNPC,
 *  the same field the talk session takes its partner's name from. */
export const mobilePersonName = (nameNPC) => (nameNPC || null);

/**
 * .cs:304-312 - a live entity is `Entity.Name`, and ONLY when its
 * EnemyMotor says it is not hostile.
 *
 * The condition is `!enemyMotor || !enemyMotor.IsHostile`, so a foe
 * with no motor at all IS named - which in the port is a headless stub
 * standing without an `ai`. A hostile one answers nothing and the
 * plaque draws nothing over it, exactly as an unnamed key does: the
 * mod will not label the thing that is trying to kill you.
 */
export function mobileEntityName(entityName, { hostile = false } = {}) {
  if (hostile) return null;
  return entityName || null;
}

// ── THE TOTEM (.cs:493-505) ─────────────────────────────────────
//
// A quest ITEM resource is named by ResolveItemLongName, except the
// one billboard the mod special-cases by hand.
export const TOTEM_ARCHIVE = 211;
export const TOTEM_RECORD = 54;
export const TOTEM_TEXT = 'The Totem of Tiber Septim';

/** A quest resource's word - items only; a quest PERSON or FOE stand
 *  answers nothing, exactly as the mod's `is Item` gate does. */
export function questResourceName(item, { archive = -1, record = -1 } = {}) {
  if (archive === TOTEM_ARCHIVE && record === TOTEM_RECORD) return TOTEM_TEXT;
  if (!item) return null;
  // AUDIT-WH M4: `ResolveItemLongName(item, FALSE)` (.cs:509). The
  // second argument is `differentiatePlantIngredients`, which DFU
  // defaults TRUE - it is what puts "(northern)"/"(southern)" on the
  // first eighteen of each plant group (ItemHelper.cs:305-312) - and
  // the mod passes false here and nowhere else. The port called the
  // resolver with no options and took the default, so a quest plant
  // stand read "Yellow Rose (northern)" where the mod reads "Yellow
  // Rose". The port's own resolver already carries the switch; this
  // is the one caller that turns it off.
  return itemLongName(item, { differentiatePlantIngredients: false }) || null;
}

// ── DOORS ───────────────────────────────────────────────────────

/** An action door (.cs:641-650): "Door", and its lock level when it is
 *  locked. The mod joins the two with `\r`; the port carries the second
 *  as a sub-line, because a DOM line is a node and splitting a string
 *  back apart at the draw would parse what the namer already knew. */
export function actionDoorName(locked, lockValue) {
  return locked ? { title: 'Door', subs: [`Lock Level: ${lockValue}`] } : { title: 'Door' };
}

/**
 * A STATIC door's word - the mod's `GetStaticDoorText` (.cs:684-789),
 * the one arm with real substance in it.
 *
 * `kind` is the port's word for `DoorTypes` plus which side the player
 * is on, since the mod's four cases are exactly that pairing:
 *   'building'       - a town building's door, from outside (.cs:692)
 *   'buildingExit'   - the same door from inside (.cs:764-767)
 *   'dungeonEntrance'- from outside (.cs:769-772)
 *   'dungeonExit'    - from inside (.cs:774-783)
 *
 * THREE OF THE MEMBER'S RETURNS ARE NOT TOOLTIPS, and this function
 * has none of them (AUDIT-WH M8 - a recorded departure, so that the
 * absence is a decision and not an oversight):
 *
 *   - `return "<ERR: 010>"` (.cs:706-707) when the location has no
 *     BuildingDirectory, and `return "<ERR: 011>"` (.cs:711-712) when
 *     the directory has no summary for the key. They are debug strings
 *     painted into the player's HUD. The port answers null, which is
 *     what it answers for anything it cannot name, and the console
 *     carries diagnostics.
 *   - `return prevDoorText` (.cs:762) - the mod's own one-entry cache,
 *     for a frame that struck the same door but missed the BUILDING
 *     behind it. The port has no `prevHit`/`prevDoorText` pair at all
 *     (its cache is the target list's, keyed by the host's door
 *     generation), so a frame that cannot resolve the building draws
 *     nothing rather than repainting the last answer. The mod's cache
 *     exists because `GetDoors`/`HasHit` are its own comment's
 *     "computationally expensive"; the port's pick is a ray against an
 *     AABB it is already holding.
 *
 * TWO DEPARTURES OF THE MOD'S OWN FROM PlayerActivate, ported as the
 * mod's rather than folded into the port's pinned `activateBuilding`:
 *   - the closed-message gate is `buildingType <= Palace` (.cs:740-741)
 *     where DFU's is `< Temple` (PlayerActivate.cs:473), so the mod
 *     tells you a temple or a palace is shut and DFU does not;
 *   - a Palace substitutes the word "Palace" for "Store" (.cs:747-748).
 * They are the MOD's text and belong with the mod's ladder. The
 * SENTENCE itself is `buildingLocks.buildingClosedText`, the port's one
 * home for it, which takes that substitution as its `subject`.
 */
export function staticDoorName(kind, {
  displayName = '', locationName = '', regionName = '',
  buildingType = BUILDING_TYPES.None, unlocked = true, quality = 0,
  inTown = false,
} = {}) {
  if (kind === 'buildingExit' || kind === 'dungeonEntrance') {
    return locationName ? { title: `To\n${locationName}` } : null;
  }
  if (kind === 'dungeonExit') {
    // .cs:777-782: a town's dungeon exit names the town; anything else
    // names the REGION, because you step out into open country.
    const to = inTown ? locationName : (regionName ? `${regionName} Region` : '');
    return to ? { title: `To\n${to}` } : null;
  }
  if (kind !== 'building') return null;
  // Town23 is the city-wall "building", which has no name of its own
  // (.cs:726-733).
  const to = buildingType === BUILDING_TYPES.Town23
    ? (locationName ? `${locationName} City Walls` : '')
    : displayName;
  if (!to) return null;
  const subs = [];
  if (!unlocked) subs.push(`Lock Level: ${buildingLockValue(quality)}`);   // .cs:735-738
  if (!unlocked && buildingType <= BUILDING_TYPES.Palace
    && buildingType !== BUILDING_TYPES.HouseForSale) {                     // .cs:740-741
    subs.push(buildingClosedText(buildingType,
      { subject: buildingType === BUILDING_TYPES.Palace ? 'Palace' : null }));   // .cs:747-748
  }
  return { title: `To\n${to}`, subs };
}
