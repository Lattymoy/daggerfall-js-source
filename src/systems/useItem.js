// U25: POINT-AND-CLICK USE. 1:1 from Daggerfall Unity's
// DaggerfallInventoryWindow.UseItem (:1661-1817), the predicates it
// reads off DaggerfallUnityItem, and DaggerfallUnityItem.NextVariant
// (:718-762). MIT, Daggerfall Workshop.
//
// The inventory window has had a Use button since U8d and it did
// nothing - the mode selected and every click fell through. This is
// the branch table behind it.
//
// ── the shape ─────────────────────────────────────────────────────
// UseItem is one long else-if ladder over the item's GROUP and
// TEMPLATE INDEX, and the order is load-bearing: a book is checked
// before "is it a potion", a light source before the oil that refuels
// it, and the catch-all is NextVariant - which is why clicking an
// ordinary shirt in Use mode CYCLES ITS COLOUR rather than doing
// nothing. Every arm is here; the ones whose destination window the
// port has not built return a named kind rather than a silent no-op,
// so a host can say "not yet" instead of eating the click.
//
// ── the drug bug, preserved ───────────────────────────────────────
// DFU's drug arm is `InflictPoison(player, player, (Poisons)
// item.TemplateIndex + 66, true)` with its own comment saying "Drug
// poison IDs are 136 through 139. Template indexes are 78 through 81,
// so add to that." 78 + 66 is 144, not 136 - the constant should be
// 58. Poisons has no member 144, so GetClassicPoisonEffectKey formats
// "Poison-144", no effect is registered under that key, and
// AssignBundle instantiates nothing: USING A DRUG IN DFU DOES
// NOTHING, silently, and the item is still consumed. Ported verbatim
// and recorded in the Ledger; the port's startPoison refuses an
// unregistered type the same way rather than indexing past its
// tables.
import { templateByIndex, itemUseHandler } from './itemTemplates.js';   // RRI2: ItemHelper's registered use handlers
import { doItemEnchantmentPayloads, PAYLOAD } from './enchantments.js';   // E2: the Used payload arm
import { inflictPoison } from './poisons.js';
import { inflictDisease } from './diseases.js';   // SURV2: a bad meal's sickness, handed to the food law
import { getItem, isEnchanted as hasEnchantments } from './inventory.js';   // D9: ItemCollection.GetItem - the oil arm's lantern lookup (:1791); the card's usable predicate
import { isSurvivalItem, useSurvivalItem } from './survival/items.js';   // SURV2: food, water, camp gear
import { survivalRules } from './survival/switch.js';   // SURV-TIERS: a meal's sickness is the tier's
import { SURVIVAL_RULES } from './survival/difficulty.js';   // AUDIT SURV-TIERS: and with the arc off, Casual's - none
import { setLightSource } from './lightSource.js';   // DISC7: the light in hand's one door
import { hoodCapable, hoodUp } from './survival/temperature.js';   // HOOD-SAID: the one hood law, for toggleHood
import { sandPotionRefusal } from './arenaKit.js';   // AUDIT ARENA-LADDER: no potion on the sand

/** THE ARMS WHOSE DESTINATION WINDOW THE PORT HAS NOT BUILT, named so a use
 *  SAYS something rather than eating itself. Keyed by this module's own result
 *  `kind`, which is why it lives here: the classic window (ui/nativeInventory
 *  .js, which re-exports it), the enhanced pack and the quickslot key all read
 *  the same words for the same arm, and a second copy is how one of the three
 *  starts saying something else. */
export const USE_PENDING = Object.freeze({
  book: 'You cannot read that yet.',
  potion: 'You drink the potion.',
  map: 'You study the map.',
  questItem: 'Nothing happens.',
  enchanted: 'Nothing happens.',
  spellbook: 'You cannot open your spellbook here.',
  pitchCamp: 'There is nowhere to set that up here.',   // SURV3: a host with no ground for a camp
  placeFire: 'There is nowhere to set that up here.',
  openPortal: 'A portal can only be opened under the open sky.',   // PORTAL1: a host with no open world (systems/portalStone.js PORTAL_TEXT.notHere)
});

/** The template indices the predicates name (ItemEnums.cs). */
export const TEMPLATES = Object.freeze({
  Spellbook: 132,          // MiscItems
  Soul_trap: 274,
  Letter_of_credit: 275,
  Potion_recipe: 278,
  House_Deed: 285,
  Ship_Deed: 286,
  Map: 287,                // MiscItems.Map AND Maps.Map (287 both ways)
  Glass_Bottle: 83,        // UselessItems1 - a POTION is a filled bottle
  Torch: 247,              // UselessItems2
  Lantern: 248,
  Bandage: 249,
  Oil: 252,
  Candle: 253,
  Parchment: 279,
  Holy_candle: 269,        // ReligiousItems
  Arrow: 131,              // Weapons (ItemEnums.cs:230 - AUDIT 23: was 130, the Long_Bow)
  Helm: 107,               // Armor (ItemEnums.cs:202 - AUDIT 23: was 103, the Gauntlets)
});

/** The first drug template, and DFU's own (wrong) offset. */
export const FIRST_DRUG_TEMPLATE = 78;
export const DRUG_POISON_OFFSET = 66;   // verbatim; see the header

// ── the predicates (DaggerfallUnityItem.cs :316-371) ──────────────

/** IsLightSource (:316-323): Torch, Lantern, Candle - and the Holy
 *  candle, which is in a DIFFERENT group and is easy to miss. */
export const isLightSource = (it) =>
  (it?.group === 'UselessItems2' && (it.templateIndex === TEMPLATES.Torch
    || it.templateIndex === TEMPLATES.Lantern || it.templateIndex === TEMPLATES.Candle))
  || (it?.group === 'ReligiousItems' && it.templateIndex === TEMPLATES.Holy_candle);

/** IsPotion (:352-355). A potion IS a glass bottle - classic decides
 *  by whether the record has a PotionMix sublist, and DFU's comment
 *  says so where it uses this. */
export const isPotion = (it) => it?.group === 'UselessItems1' && it.templateIndex === TEMPLATES.Glass_Bottle;
/** IsPotionRecipe (:344-347). */
export const isPotionRecipe = (it) => it?.group === 'MiscItems' && it.templateIndex === TEMPLATES.Potion_recipe;
/** IsParchment (:360-363). */
export const isParchment = (it) => it?.group === 'UselessItems2' && it.templateIndex === TEMPLATES.Parchment;
/** IsClothing (:368-371). */
export const isClothing = (it) => it?.group === 'MensClothing' || it?.group === 'WomensClothing';
/** DaggerfallInventoryWindow's book arm (:1712) is
 *  `ItemGroup == Books && !item.IsArtifact` - AUDIT 26 F125: an
 *  ARTIFACT book (the Oghma Infinium) skips the reader entirely and
 *  falls through to the enchanted Used payload. The port tested the
 *  group alone, so it would have opened the plain reader first. The
 *  artifact marker is createArtifact's (loot.js), SetArtifact's
 *  artifactMask (:617). */
export const isBook = (it) => it?.group === 'Books' && !it.artifact;
export const isDrug = (it) => it?.group === 'Drugs';
export const isSpellbook = (it) => it?.templateIndex === TEMPLATES.Spellbook;
/** UseItem's map arm tests BOTH groups (:1741-1742) - the same
 *  template index 287 lives in MiscItems and in Maps. */
export const isMap = (it) => (it?.group === 'MiscItems' || it?.group === 'Maps')
  && it?.templateIndex === TEMPLATES.Map;

// ── NextVariant (:718-762) ────────────────────────────────────────

/** ONLY CERTAIN ITEMS support a user-initiated variant: twelve men's
 *  and twelve women's garments, listed by name in DFU's switch. Every
 *  other item's Use falls into this arm and does nothing at all,
 *  which is the correct behaviour rather than an omission. */
export const VARIANT_CHANGEABLE = Object.freeze(new Set([
  // MensClothing
  154, 155, 161, 163, 165, 166, 167, 168, 169, 170, 171, 172,
  // WomensClothing
  191, 192, 198, 200, 202, 203, 204, 205, 206, 207, 208, 209,
]));

/** NextVariant, verbatim: cycle to 0 at TotalVariants, which is the
 *  ITEM TEMPLATE's `variants` column. Returns true when the variant
 *  moved (the caller refreshes the doll or the list). */
/** Mac (2026-09-18): "hide Use for non-usables". TRUE when the ladder below has an arm for the item that
 *  does something - a quest item's watch, food and water and camp gear, a book, a potion, a map, the
 *  spellbook, a drug, a light source, oil, a Used enchantment, a garment with variants to cycle. The catch-all's
 *  "Nothing happens." and the recipe's "cannot use" are the two that are not a use. */
export function usableItem(item) {
  if (!item) return false;
  if (item.questItem) return true;
  // DISC13-B (icebreyker: "Cant heal with bandages" - the card offered Drop alone): the ladder's first arm is a
  // mod's registered handler (useItem's delegate arm below), and this predicate had never been told. A handler
  // that answers only under a switch says so with `usable` (the bandage: RRI's bandaging).
  const handler = itemUseHandler(item.templateIndex);
  if (handler && (handler.usable?.(item) ?? true)) return true;
  if (isSurvivalItem(item) || isBook(item) || isPotion(item) || isMap(item) || isSpellbook(item) || isDrug(item) || isLightSource(item)) return true;
  if (item.group === 'UselessItems2' && item.templateIndex === TEMPLATES.Oil) return true;
  if (hasEnchantments(item)) return true;
  return VARIANT_CHANGEABLE.has(item.templateIndex) && (templateByIndex(item.templateIndex)?.variants ?? 0) > 1;
}

export function nextVariant(item) {
  if (!VARIANT_CHANGEABLE.has(item?.templateIndex)) return false;
  const total = templateByIndex(item.templateIndex)?.variants ?? 0;
  let variant = (item.variant ?? 0) + 1;
  if (variant >= total) variant = 0;
  item.variant = variant;
  return true;
}

/** HOOD-SAID (FIELD BUGS 2026-09-30, Discord: "Vampire hood on cloaks dont show hood is up or down making them think
 *  its a bug"): THE HOOD IS RAISED OR LOWERED, NOT CYCLED. NextVariant steps a garment through every drawing, and a
 *  casual cloak's six run hood down, UP, UP, down, down, UP, so a Use that meant "hood up" could put it down. The
 *  drawings come in pairs, one drape hood down and hood up: 0/1, 2/3 and 4/5 on the casual cloak - the felt
 *  temperature's own tables say so, every pair holding one hooded drawing that is the warmer by one
 *  (survival/temperature.js HOODED_CLOAK_VARIANTS, CLOAK_WARMTH) - and 0/1 on the formal cloak and on plain robes. So the
 *  hood moves to the same drape's other drawing, `variant ^ 1`; a drawing with no partner (a stray value past the
 *  template's count) takes NextVariant's own order to the first whose hood differs, one round at most. Only the six
 *  hooded garments move (temperature.js hoodCapable); true when the hood changed. The classic window keeps DFU's
 *  NextVariant on its Use and middle click - its doll is redrawn at each step, so every drawing stays in reach. */
export function toggleHood(item) {
  if (!hoodCapable(item)) return false;
  const total = templateByIndex(item.templateIndex)?.variants ?? 0;
  const from = item.variant ?? 0;
  const up = hoodUp(item);
  if ((from ^ 1) < total) {
    item.variant = from ^ 1;
    if (hoodUp(item) !== up) return true;
    item.variant = from;
  }
  for (let i = 1; i < total; i++) {
    nextVariant(item);
    if (hoodUp(item) !== up) return true;
  }
  item.variant = from;
  return false;
}
/** HOOD-SAID: what a press of the pack's hood button says - the port's own lines, beside UseItem's "You light the %it.". */
export const HOOD_TEXT = Object.freeze({ raise: 'You raise your hood.', lower: 'You lower your hood.' });

/** CLOAK-DRAPE (FIELD BUGS 2026-10-01, SlipperyPeasant: "I can no longer change how the cloak is worn, eg; Over shoulder,
 *  behind, etc"): HOW MANY WAYS A HOODED GARMENT HANGS - its drawings in HOOD-SAID's pairs (one drape hood down and hood
 *  up), so the casual cloak's six are three drapes and the formal cloak's and plain robes' two are one. 0 for a garment
 *  with no hood, whose Use still steps its drawings. */
export const drapeCount = (item) => (hoodCapable(item) ? Math.floor((templateByIndex(item.templateIndex)?.variants ?? 0) / 2) : 0);
/** CLOAK-DRAPE: THE NEXT DRAPE, THE HOOD AS IT WAS - Use stood on a worn cloak's card for this until HOOD-SAID gave its
 *  place to the hood, which keeps the drape; this keeps the hood. The next pair round (a stray value past the count is
 *  the last drape's), and of it the drawing whose hood is the one the garment wore. True when the drape moved; a
 *  garment of one drape stays as it was. */
export function nextDrape(item) {
  const drapes = drapeCount(item);
  if (drapes < 2) return false;
  const from = item.variant ?? 0;
  const up = hoodUp(item);
  const d = Math.min(drapes - 1, from >> 1);
  for (let step = 1; step < drapes; step++) {
    const pair = (d + step) % drapes;
    for (const v of [2 * pair, 2 * pair + 1]) {
      item.variant = v;
      if (hoodUp(item) === up) return true;
    }
  }
  item.variant = from;
  return false;
}
/** CLOAK-DRAPE: what a press of the pack's drape button says. */
export const DRAPE_TEXT = 'You rearrange your cloak.';

// ── the strings UseItem shows (DFU's Internal_Strings) ────────────

export const USE_TEXT = Object.freeze({
  lightDouse: 'You douse the %it.',
  lightLight: 'You light the %it.',
  lightEmpty: 'Your %it has no fuel left.',
  lightRefuel: 'You refuel your %it with a bottle of oil.',
  lightFull: 'Your %it is full.',
  cannotUseThis: 'You cannot use this.',
  bookUnavailable: 'The book is ruined and is now unreadable.',
  // RecordLocationFromMap's catch arm (:1841-1845) - "Player has
  // already descovered all valid locations in this region!", DFU's
  // own typo in its own comment. Verbatim from Internal_Strings.csv
  // :813.
  readMapFail: 'You have already discovered the location shown by this map.',
});
/** TEXT.RSC 12 - the spellbook's "you have no spells" (:1665). */
export const NO_SPELLS_TEXT_ID = 12;
/** TEXT.RSC 499 - RecordLocationFromMap's reveal message (:1820). */
export const MAP_TEXT_ID = 499;

/** MacroHelper's %it - the item's own name. */
export const expandItemMacro = (text, item, name) =>
  (text ?? '').replaceAll('%it', name ?? item?.name ?? templateByIndex(item?.templateIndex)?.name ?? 'item');

// ── UseItem (:1661-1817) ──────────────────────────────────────────

/**
 * The ladder, verbatim, as a decision. `collection` is the list the
 * item lives in (DFU passes null from the paperdoll, and several arms
 * check for that - a map or a drug used off the doll is NOT consumed).
 *
 * Returns { kind, ... }:
 *   'lit' | 'doused' | 'empty'      light sources, with `text`
 *   'refuelled' | 'full'            the oil arm, with `text`
 *   'drugged'                       a drug (consumed; see the header)
 *   'variant'                       NextVariant moved a garment
 *   'none'                          NextVariant had nothing to move
 *   'book' | 'potion' | 'map' | 'spellbook' | 'noSpells' |
 *   'potionRecipe' | 'questItem' | 'enchanted'
 *                                   named, with `pending` true where
 *                                   the destination window is unbuilt
 */
export function useItem(item, collection, {
  entity = null, rolls = Math.random, nowMinute = 0,
  localItems = null, spellCount = () => 0, isEnchanted = () => false,
  // U44: EntityEffectManager.DrinkPotion (:903-947) - the host's cast
  // engine owns it, because assigning a bundle needs the player's
  // effect sinks. Answers the potion's display name.
  drinkPotion = null,
  // U44: RecordLocationFromMap's PlayerGPS.DiscoverRandomLocation
  // (:1826). The host owns it, because only a host with a region
  // index can walk one - `?town` and `?dungeon` are standalone pages
  // and legitimately answer nothing. Returns the revealed name, null
  // when the region is exhausted.
  revealMap = null,
  // QuestMachine.Instance.GetQuest (:1673) - the quest half of the
  // use-click block below. A host with no quest machine leaves it
  // null and DFU's own fall-through arm stands.
  getQuest = null,
  // MEND-AIM: a use AIMED at another item (a repair kit at the piece it mends), and whether the host can ask which -
  // a handler that wants an aim answers `chooseTarget` with the choices, and the host uses the item again with the
  // one chosen. The quick keys cannot ask, and take the handler's own first choice.
  target = null, chooseTarget = false,
} = {}) {
  if (!item) return { kind: 'none' };
  const named = (t) => expandItemMacro(USE_TEXT[t], item);
  // AUDIT 22 F4: the oil arm searches the LOCAL pack (:1791
  // `localItems.GetItem(...)`), not the list the click came from - so
  // using oil off a loot pile still refuels the lantern in your bag.
  // `collection` is the list the item LIVES in, which is a different
  // question and is what every consuming arm uses.
  const bag = localItems ?? collection;

  // AUDIT 22 F1: QUEST ITEMS FALL THROUGH. DFU's quest block
  // (:1668-1700) returns in exactly ONE case - the quest system is
  // WATCHING this item (`!UseClicked && ActionWatching`) and it is
  // neither a parchment nor clothing, so the world gets first shot at
  // it. Every other quest item runs the whole ladder underneath,
  // which is why a quest letter reads and a quest torch lights. The
  // port returned for ALL of them, so a quest torch could not be lit.
  //
  // THE USE CLICK ITSELF (:1681-1683): `questItem.UseClicked = true`
  // is the ONLY producer of the flag ItemUsedDo polls every tick
  // (ItemUsedDo.cs:65) - without it `<item> used do <task>` and
  // `used saying` can never fire, and a quest that asks the player to
  // use something stalls forever. IsParchment / IsClothing
  // (DaggerfallUnityItem.cs:360-371) are the exception DFU spells out
  // in its own comment: a painting or a bell pops back to the HUD so
  // the world gets the click, but a LETTER has to stay in the window
  // to be read, so it falls through to the ladder and to the
  // used-message popup below.
  //
  // With no quest machine nothing is watching anything, so
  // ActionWatching is false and DFU's own answer is to fall through.
  const questItem = !!item.questItem;
  if (questItem) {
    // C# throws when the quest is missing (:1675); the port answers
    // the ladder instead - a host with no machine has no quest to
    // find and a stale questUID is not worth a crash. Recorded.
    const quest = getQuest?.(item.questUID);
    const resource = quest?.getItem?.(item.questSymbol) ?? null;
    if (resource) {
      if (!resource.useClicked && resource.actionWatching) {
        resource.useClicked = true;
        const dfItem = resource.daggerfallUnityItem ?? item;
        if (!isParchment(dfItem) && !isClothing(dfItem)) {
          // DaggerfallUI.PopToHUD() + return (:1687-1688) - the whole
          // ladder is skipped and so is the used-message popup. The
          // host owns the window stack, so it rides the result.
          return { kind: 'questItem', questItem: true, popToHUD: true };
        }
      }
      // :1692-1697 - and the test is `!= 0`, so the ctor's -1 reaches
      // ShowMessagePopup, where GetMessage(-1) answers null and
      // nothing shows. DFU's, kept.
      if (resource.usedMessageID !== 0) quest.showMessagePopup?.(resource.usedMessageID, true);
    }
  }

  // "Try to handle use with a registered delegate" (:1703-1709): a mod's
  // handler for the template runs ahead of the ladder, and a true answer
  // RETURNS - past the ladder and past the Used-payload tail alike.
  const handler = itemUseHandler(item.templateIndex);
  if (handler) {
    const handled = handler(item, collection, { entity, rolls, nowMinute, localItems: bag, target, chooseTarget });   // MEND-AIM: the pack, the aim, and whether it may be asked
    if (handled) return questItem ? { ...handled, questItem: true } : handled;
  }

  let out = null;
  // SURV2: the survival items (food, the waterskin, camping gear, the
  // campfire kit, the skillet) answer from their own module - their
  // templates are the port's, above DFU's 288, and their use is eating,
  // drinking and placing, none of which the ladder below knows.
  // SURV-TIERS: the live tier's rules decide whether a raw or spoiled meal may sicken. AUDIT SURV-TIERS: with
  // the arc off it was Hard's roll (the law's default for no rules), so a meal carried over from a session with
  // the arc on could give a disease in the classic game - the one tier that promises no survival cost at all.
  // Off eats as Casual does: fed, never sickened.
  if (isSurvivalItem(item)) out = useSurvivalItem(item, collection, { entity, now: nowMinute, rolls, currentDay: Math.trunc(nowMinute / 1440), inflict: inflictDisease, rules: survivalRules() ?? SURVIVAL_RULES.casual, offMeal: survivalRules() == null });   // ENDLESS PROVISIONS: Off, a meal is never refused for hunger - it gives stamina
  // B1: the book arm hands the ITEM to the window's openBook hook
  // (DaggerfallInventoryWindow pushes the reader; a failed open shows
  // the ruined-book box - failText - which the WINDOW shows on the
  // hook's failure callback, not immediately).
  else if (isBook(item)) out = { kind: 'book', item, failText: named('bookUnavailable') };

  // AUDIT ARENA-LADDER: the sand's kit law - no potion in a bout of one's own, and the bottle is kept (systems/arenaKit.js)
  else if (isPotion(item) && sandPotionRefusal()) out = { kind: 'refused', refused: true, text: sandPotionRefusal() };

  else if (isPotion(item)) {
    // DrinkPotion + RemoveOne. AUDIT 22 F5: RemoveOne takes THIS
    // record off the stack - removing the first item that merely
    // shares a template index would drink someone else's potion,
    // since every potion is the same Glass_Bottle template and only
    // its recipe differs.
    if (collection) removeOneRecord(collection, item);
    // U44: and then it actually DOES something. The arm consumed the
    // bottle and answered `pending`, which printed "You drink the
    // potion." over an entity nothing had touched - the game claiming
    // an outcome it had not produced, for the whole of the item arc.
    // DrinkPotion's own guard is `PotionRecipeKey == 0` (:906), so a
    // bottle naming no recipe is drunk and does nothing, exactly as
    // here.
    const drank = drinkPotion ? drinkPotion(item.potionRecipeKey ?? 0, Number.isInteger(item.potent) ? item.potent : 0) : null;   // PROF12: a Potent potion's share
    out = drank ? { kind: 'potion', potion: drank } : { kind: 'potion', pending: true };
  }

  else if (isPotionRecipe(item)) out = { kind: 'potionRecipe', text: named('cannotUseThis') };

  else if (isMap(item) && collection) {
    // RecordLocationFromMap (:1819-1846). DiscoverRandomLocation, then
    // record 499 on success and readMapFail when the region has
    // nothing left. The map is consumed EITHER WAY - DFU's
    // RemoveItem sits outside the try/catch (:1745) - and the
    // notebook note is the reveal seam's, as it is for the two guild
    // reveals that share it.
    //
    // A host with no reveal seam does not eat the map. The arm used
    // to consume it and answer `pending`, which printed "You study
    // the map." over a world where nothing had been discovered - the
    // game claiming an outcome it had not produced.
    if (!revealMap) { out = { kind: 'map', pending: true }; }
    else {
      const i = collection.indexOf(item);
      if (i >= 0) collection.splice(i, 1);   // RemoveItem, not RemoveOne
      const revealed = revealMap();
      // MACROS1: record 499 says "...the secret location of %map...", and DFU's box runs MacroHelper over it with
      // PlayerGPS.LocationRevealedByMapItem - the name DiscoverRandomLocation just set. The outcome carries the value
      // and every consumer of a textId expands its rows with it (questMacros.js expandRowValues).
      out = revealed
        ? { kind: 'map', textId: MAP_TEXT_ID, revealed, macros: { map: revealed } }
        : { kind: 'map', text: named('readMapFail') };
    }
  }

  else if (isSpellbook(item)) {
    out = spellCount() === 0
      ? { kind: 'noSpells', textId: NO_SPELLS_TEXT_ID }
      : { kind: 'spellbook' };
  }

  else if (isDrug(item) && collection) {
    // See the header: the +66 is DFU's, it lands outside the Poisons
    // enum, and nothing is inflicted. The item is consumed regardless.
    const poisonType = item.templateIndex + DRUG_POISON_OFFSET;
    const inflicted = entity ? inflictPoison(entity, poisonType, true, { rolls, currentMinute: nowMinute }) : null;
    const i = collection.indexOf(item);
    if (i >= 0) collection.splice(i, 1);
    out = { kind: 'drugged', poisonType, inflicted: !!inflicted };
  }

  else if (isLightSource(item)) {
    if ((item.currentCondition ?? 0) <= 0) out = { kind: 'empty', text: named('lightEmpty') };
    // PlayerEntity.LightSource is a single slot: using the one already
    // lit DOUSES it, using another one SWAPS.
    else if (entity?.lightSource === item) {
      setLightSource(entity, null);   // DISC7: the one door, which says so
      out = { kind: 'doused', text: named('lightDouse') };
    } else {
      setLightSource(entity, item);   // DISC7
      out = { kind: 'lit', text: named('lightLight') };
    }
  }

  else if (item.group === 'UselessItems2' && item.templateIndex === TEMPLATES.Oil && collection) {
    // The oil refuels a LANTERN in the LOCAL pack, and only if the
    // whole bottle fits - DFU adds the oil's condition to the
    // lantern's and refuses when it would overflow. D9: the lookup is
    // ItemCollection.GetItem verbatim now, allowQuestItem: false
    // included (:1791) - the port grew quest items (item.questItem,
    // read at :211) and inventory.getItem already ports that filter
    // (inventory.js:399), so a quest lantern is invisible to the oil
    // exactly as it is in DFU and the bottle refuses instead.
    const lantern = getItem(bag ?? [], 'UselessItems2', TEMPLATES.Lantern, { allowQuestItem: false });
    const oil = item.currentCondition ?? 0;
    if (lantern && (lantern.currentCondition ?? 0) <= (lantern.maxCondition ?? 0) - oil) {
      lantern.currentCondition = (lantern.currentCondition ?? 0) + oil;
      // A STACK splits one off; a single leaves entirely.
      if ((item.stackCount ?? 1) > 1) item.stackCount--;
      else { const i = collection.indexOf(item); if (i >= 0) collection.splice(i, 1); }
      out = { kind: 'refuelled', text: expandItemMacro(USE_TEXT.lightRefuel, lantern) };
    } else out = { kind: 'full', text: expandItemMacro(USE_TEXT.lightFull, lantern ?? item) };
  }

  else {
    // The catch-all.
    const moved = nextVariant(item);
    out = moved ? { kind: 'variant', variant: item.variant } : { kind: 'none' };
  }

  if (questItem) out = { ...out, questItem: true };
  // AUDIT 22 F9: the enchantment payload runs AFTER THE WHOLE CHAIN
  // (:1809-1816), on top of whatever the arm did - DFU's arms are one
  // if/else ladder with no returns, so an enchanted potion is drunk
  // AND fires its Used payload. Every arm here used to return early,
  // which made this reachable only from the catch-all.
  // E2: the payload is LIVE - DoItemEnchantmentPayloads(Used, item,
  // collection) with the collection so a Used result can consume the
  // item or bill durability through it; the window closes behind it
  // (:1815 CloseWindow), which is closesWindow to the caller. The
  // cast arms ride the host's mounted enchantCtx.
  if (isEnchanted(item)) {
    doItemEnchantmentPayloads(PAYLOAD.Used, item, { entity, collection, nowMinutes: nowMinute });
    return { ...out, enchanted: true, closesWindow: true };
  }
  return out;
}

/** ItemCollection.RemoveOne over the port's list: decrement THIS
 *  record's stack, or splice THIS record out. inventory.removeOne
 *  takes a template index and finds the first match, which is the
 *  wrong record whenever two items share a template (AUDIT 22 F5). */
function removeOneRecord(list, item) {
  const i = list.indexOf(item);
  if (i < 0) return false;
  if ((item.stackCount ?? 1) > 1) item.stackCount--;
  else list.splice(i, 1);
  return true;
}
