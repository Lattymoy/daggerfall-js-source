// U25: THE ITEM INFO PANEL'S TEXT. 1:1 from ItemHelper.GetItemInfo
// (:748-817) and the %-macros DaggerfallUnityItemMCP binds for it
// (:117-165). MIT, Daggerfall Workshop.
//
// U8e's inventory shipped an INTERIM info panel that made up its own
// three lines (name / weight / value). This is the real thing: DFU
// picks one of thirteen TEXT.RSC records by the item's GROUP and
// TEMPLATE, and each record is a macro string the item fills in. The
// panel therefore reads differently for a sword, a shield, an arrow,
// a soul trap and a letter of credit - which is most of what the
// panel is FOR.
//
// ── the record switch (:764-816) ──────────────────────────────────
// Armor and weapons each have a WITH- and WITHOUT-material record,
// and which one draws is not cosmetic: an ARTIFACT never shows its
// material, and arrows have a record of their own with no condition
// line at all. MiscItems is four special templates before its
// default. The final `default:` arm catches potions (a filled glass
// bottle) before falling back to the misc record.
import { unitWeightInKg } from './inventory.js';   // AUDIT 23 (items-8)
import { enemyDisplayName } from '../characters/enemyBasics.js';   // X5: %hs, the trapped soul's name
import { itemIsIdentified } from './tradeModes.js';   // X7: the DERIVED identified state
import { templateByIndex, itemBaseValue } from './itemTemplates.js';
import { isPotion, isPotionRecipe, isParchment, TEMPLATES } from './useItem.js';
import { expandLetterSignoff } from './quest/questMacros.js';   // ResolveItemLongName's quest-letter arm (ItemHelper.cs:335-348)
import { materialArmorValue, isShieldTemplate } from './armorMaterials.js';
import { weaponMaterialModifier, weaponMinDamage, weaponMaxDamage, WEAPON_MATERIALS } from '../characters/weapons.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { srand, rand, randomRangeInclusive } from '../formats/dfRandom.js';   // the painting identity's whole PRNG
import { fullName } from '../characters/nameHelper.js';   // %an: NameHelper.FullName(race, gender)
import { soulTrapNameSuffix } from './mysticism.js';   // F077: ResolveItemLongName's soul arm

/** The thirteen ids GetItemInfo names as constants (:750-762). */
export const INFO_TEXT = Object.freeze({
  painting: 250,
  armor: 1000,
  weapon: 1001,
  misc: 1003,
  soulTrap: 1004,
  letterOfCredit: 1007,
  potion: 1008,
  book: 1009,
  arrow: 1011,
  weaponNoMaterial: 1012,
  armorNoMaterial: 1014,
  oghmaInfinium: 1015,
  houseDeed: 1073,
});

/** ArmorShouldShowMaterial (:822-848). The HelmAndShieldMaterialDisplay
 *  setting has four values and DFU's DEFAULT is 0 - "classic
 *  behavior", where a helm or a shield never shows its material. The
 *  port has no settings layer, so it ships classic's answer; an
 *  artifact never shows one either way. */
export const HELM_AND_SHIELD_MATERIAL_DISPLAY = 0;
export function armorShouldShowMaterial(item) {
  // `artifact`/`oghmaInfinium`/`azurasStar` are minted by loot.js's
  // createArtifact since Q2b-ii (the quest Item mint's artifact arm) -
  // AUDIT 22 F11's producerless-flags pin retired that day, replaced
  // by producer-shape pins in test/iteminfo.test.js.
  if (item?.artifact) return false;
  const isHelmOrShield = isShieldTemplate(item?.templateIndex) || item?.templateIndex === TEMPLATES.Helm;
  if (isHelmOrShield) {
    // every arm of the setting switch is false at 0
    return HELM_AND_SHIELD_MATERIAL_DISPLAY === 3;
  }
  return true;
}

/** GetItemInfo (:748-817), as the TEXT.RSC id it resolves to. */
export function itemInfoTextId(item) {
  if (!item) return INFO_TEXT.misc;
  switch (item.group) {
    case 'Armor':
      return armorShouldShowMaterial(item) ? INFO_TEXT.armor : INFO_TEXT.armorNoMaterial;
    case 'Weapons':
      if (item.templateIndex === TEMPLATES.Arrow) return INFO_TEXT.arrow;
      if (item.artifact) return INFO_TEXT.weaponNoMaterial;
      return INFO_TEXT.weapon;
    case 'Books':
      return item.oghmaInfinium ? INFO_TEXT.oghmaInfinium : INFO_TEXT.book;
    case 'Paintings':
      return INFO_TEXT.painting;
    case 'MiscItems':
      if (isPotionRecipe(item)) return INFO_TEXT.misc;   // DFU builds recipe tokens by hand - FLAGGED
      if (item.templateIndex === TEMPLATES.House_Deed) return INFO_TEXT.houseDeed;
      if (item.templateIndex === TEMPLATES.Soul_trap) return INFO_TEXT.soulTrap;
      if (item.templateIndex === TEMPLATES.Letter_of_credit) return INFO_TEXT.letterOfCredit;
      return INFO_TEXT.misc;
    default:
      if (isPotion(item)) return INFO_TEXT.potion;
      if (item.azurasStar) return INFO_TEXT.soulTrap;
      return INFO_TEXT.misc;
  }
}

// ── the macros the panel fills (DaggerfallUnityItemMCP :117-165) ──

/** Condition() (:130-142). Eight words over seven thresholds, and the
 *  walk is `while (percentage > threshold[i]) i++` - so the bands are
 *  keyed on the FIRST threshold the percentage does not exceed. An
 *  item whose condition is ABOVE its maximum falls out of the ladder
 *  entirely and prints the raw number. */
export const CONDITION_WORDS = Object.freeze(['Broken', 'Useless', 'Battered', 'Worn',
  'Used', 'Slightly Used', 'Almost New', 'New']);
export const CONDITION_THRESHOLDS = Object.freeze([1, 5, 15, 40, 60, 75, 91, 101]);

/** ConditionPercentage (:460-463): `100 * current / max`, C# integer
 *  division, and 100 when the item has no maximum at all. */
export const conditionPercentage = (item) => ((item?.maxCondition ?? 0) > 0
  ? Math.trunc(100 * (item.currentCondition ?? 0) / item.maxCondition)
  : 100);

export function conditionWord(item) {
  const max = item?.maxCondition ?? 0;
  if (!(max > 0 && (item.currentCondition ?? 0) <= max)) return String(item?.currentCondition ?? 0);
  const pct = conditionPercentage(item);
  let i = 0;
  while (i < CONDITION_THRESHOLDS.length - 1 && pct > CONDITION_THRESHOLDS[i]) i++;
  return CONDITION_WORDS[i];
}

/** Weight() (:144-148): the STACK's weight, printed with no decimals
 *  when it is whole and two when it is not. */
export function weightString(item) {
  // AUDIT 23 (items-8): weightInKg is MATERIAL-ADJUSTED (a daedric
  // dagger is not an iron one) - the old read took the raw template
  // weight off a field nothing ever wrote.
  const weight = unitWeightInKg(item) * (item?.stackCount ?? 1);
  return weight % 1 === 0 ? String(weight) : weight.toFixed(2);
}

/** WeaponDamage() (:150-154): "min - max", both shifted by the
 *  material modifier. */
export function weaponDamageString(item) {
  const mod = weaponMaterialModifier(item?.material ?? WEAPON_MATERIALS.Iron);
  return `${weaponMinDamage(item.templateIndex) + mod} - ${weaponMaxDamage(item.templateIndex) + mod}`;
}

/** ArmourMod() (:157-160): GetMaterialArmorValue with a C# "+0;-0;0"
 *  format - a PLUS SIGN on a positive value, and a bare 0 on zero.
 *  DFU's own comment: "Armour mod is double what classic displays,
 *  but this is correct according to Allofich." */
export function armourModString(item) {
  const v = materialArmorValue(item?.material ?? ARMOR_MATERIAL.Leather);
  return v > 0 ? `+${v}` : v < 0 ? `-${Math.abs(v)}` : '0';
}

/** The material NAMES the %mat macro resolves (TextProvider's
 *  GetArmorMaterialName / GetWeaponMaterialName). Armor's enum is
 *  bit-packed (0x0200 | tier) where the weapon's is a plain 0..9, so
 *  the two tables are keyed differently and share their words. */
export const MATERIAL_NAMES = Object.freeze(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven',
  'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']);
export function materialName(item) {
  const m = item?.material;
  if (item?.group === 'Armor') {
    if (m === ARMOR_MATERIAL.Leather) return 'Leather';
    if (m === ARMOR_MATERIAL.Chain || m === ARMOR_MATERIAL.Chain2) return 'Chain';
    return MATERIAL_NAMES[(m ?? 0) & 0xff] ?? '';
  }
  return MATERIAL_NAMES[m ?? 0] ?? '';
}

/** The panel's macro pass. Everything the port can compute is filled;
 *  the ones it cannot are named rather than left raw: %po the potion's
 *  recipe name, %bt/%ba the book's title and author (BOOKS.BSA has no
 *  reader yet). Each falls back to the item's own name or a dash,
 *  which is what an unfilled macro would otherwise print raw on
 *  screen. FLAGGED as a group - they land with their own arcs.
 *
 *  X5: %hs LEFT THAT GROUP. It is the trapped soul's name, and it had
 *  no producer because nothing could fill a soul trap; now the trap
 *  fires, so the default resolves the item's own trappedSoulType
 *  through the bestiary rather than printing "Nothing" over a full
 *  gem. An explicit `soul` still wins, and an EMPTY trap still reads
 *  "Nothing" - which is the right word for it. */
/**
 * ResolveItemLongName's QUEST-LETTER arm (ItemHelper.cs:335-348).
 *
 * A quest Parchment does not read as "Parchment": DFU takes the item's
 * USED message, runs QuestMacroHelper.ExpandLetterSignoff over its
 * unexpanded tokens and shows `Letter: <signoff>` instead - which is
 * the only thing that tells two letters from two quests apart in a
 * pack. `getQuest(uid)` is QuestMachine.GetQuest; a host with no quest
 * machine answers null here and the plain template name stands.
 *
 * C#'s own guards, kept: the QUEST is null-checked (:339) and the Item
 * resource is not (:341 indexes it straight), and the message id test
 * is `>= 0`, not `!= 0` - so id 0 IS resolved and the ctor's -1 is what
 * skips the arm. The port answers null where C# would NRE on a missing
 * resource; same answer for every quest that owns its own item.
 *
 * @returns {string|null} the long name, or null when this is not a
 *   quest letter (the caller keeps whatever name it already had)
 */
export function questLetterName(item, getQuest, rolls = Math.random) {
  if (!isParchment(item) || !item.questItem) return null;
  const quest = getQuest?.(item.questUID);
  if (!quest) return null;
  const questItem = quest.getItem?.(item.questSymbol);
  if (!questItem || questItem.usedMessageID < 0) return null;
  const message = quest.getMessage?.(questItem.usedMessageID);
  if (!message) return null;
  // GetTextTokens(expandMacros:false) - the signoff walk does its own
  // expansion, so the tokens must arrive raw.
  return expandLetterSignoff(quest, message.getTextTokens(-1, rolls, false));
}

// ── PAINTINGS (DaggerfallUnityItemMCP.cs :37-74 and :185-218) ─────
//
// A painting has no stored description: it has a MESSAGE, one u16 the
// item is born with, and everything else is REGENERATED from it. The
// message seeds DFRandom, the first draw picks one of 180 painting
// records, and that record names four TEXT.RSC slots - subject,
// adjective and two prefixes - which the %sub/%adj/%pp1/%pp2 macros
// read. %an mints the artist's name off the same stream. The port
// stocked paintings (a pawn shop's group 13) and routed Info to
// TEXT.RSC 250 while none of this existed, so the panel printed the
// five macros raw.

/** InitPaintingInfo's four bases (:59-62): a record slot holds a small
 *  offset, and the TEXT.RSC id is that offset plus the slot's base. */
export const PAINTING_TEXT_BASE = Object.freeze({ sub: 6100, adj: 6200, pp1: 6300, pp2: 6400 });

/** The painting record count the first draw is taken modulo (:43). */
export const PAINTING_RECORD_COUNT = 180;

/** GetPaintingRecordPart (:68-74), verbatim. Walk the slot to its 0xFF
 *  terminator (or its last byte); a slot holding exactly ONE choice is
 *  taken without a draw, and any wider slot draws over the whole run
 *  with random_range_inclusive. The one-choice test is `i - start == 1`
 *  - the WALKED length, not the slot's - so it is the terminator's
 *  position that decides, and the draw is only spent when there is
 *  something to choose. */
export function paintingRecordPart(record, start, end) {
  let i = start;
  while (i <= end && record[i] !== 0xff) i++;
  return (i - start === 1) ? record[i - 1] : record[randomRangeInclusive(start, i - 1)];
}

/** InitPaintingInfo (:37-66), verbatim, minus the Debug.LogFormat.
 *
 *  Runs ONCE per item - DFU guards on `dataSource.paintingInfo == null`
 *  (:40) and the port caches on the item itself, which is what survives
 *  a save. The DFRandom state it LEAVES is load-bearing: the five
 *  painting macros each draw from wherever this walk stopped, so the
 *  order of the four record parts is not decoration.
 *
 *  `paintingIndex >> 3` never exceeds 22 (179 >> 3), so the file letter
 *  runs A..W over the eight CIF records `paintingIndex & 7` picks.
 *
 *  @param item      the Paintings item, carrying its `message` seed
 *  @param readRecord  PaintFile.read - `(index) => Uint8Array(40)|null`
 *  @param readInfoRows  the TEXT.RSC 250 reader (:65), frozen with the
 *           rest of the identity so the painting keeps one description
 *  @returns {object|null} the identity, or null when there is no
 *           PAINT.DAT to read (the panel then shows its fallbacks)
 */
export function initPaintingInfo(item, readRecord, readInfoRows = null) {
  if (!item || item.group !== 'Paintings') return null;
  if (item.paintingInfo) return item.paintingInfo;
  if (!readRecord) return null;
  srand(item.message ?? 0);
  const paintingIndex = rand() % PAINTING_RECORD_COUNT;
  const record = readRecord(paintingIndex);
  if (!record) return null;
  // DFU's own comment: "Known buggy paintingRecord ... not fixed in
  // PAINT.DAT" - record 70's fourth slot is an immediate terminator,
  // and DFU writes summer/spring/afternoon/Highrock over it (:50-57).
  if (paintingIndex === 70 && record[30] === 0xff) {
    record[30] = 3;    // summer
    record[31] = 6;    // spring
    record[32] = 8;    // afternoon
    record[33] = 10;   // Highrock
  }
  const info = {
    filename: `${String.fromCharCode((paintingIndex >> 3) + 65)}PAINT.CIF`,
    fileIdx: paintingIndex & 7,
    sub: paintingRecordPart(record, 0, 9) + PAINTING_TEXT_BASE.sub,
    adj: paintingRecordPart(record, 10, 19) + PAINTING_TEXT_BASE.adj,
    pp1: paintingRecordPart(record, 20, 29) + PAINTING_TEXT_BASE.pp1,
    pp2: paintingRecordPart(record, 30, 39) + PAINTING_TEXT_BASE.pp2,
    // `paintingInfo = textProvider.GetRandomTokens(paintingTextId,
    // true)` (:65) - the description VARIANT is drawn once, here, and
    // kept, so one painting keeps one description while the macro
    // words below are redrawn on every look, exactly as DFU does it.
    rows: readInfoRows ? (readInfoRows(INFO_TEXT.painting) ?? null) : null,
  };
  item.paintingInfo = info;
  return info;
}

/** The five painting macros (:185-218), in DFU's own order and with
 *  DFU's own draws.
 *
 *  Every one of them opens with a bare `DFRandom.rand()` whose only
 *  purpose is to burn a value - the C# comment on all five is "Classic
 *  uses every other value" - and only then reads its record. %an burns
 *  one, then takes gender from `rand() & 1` and the name bank from
 *  `rand() & 7`, so the artist is a Breton..Imperial of either sex.
 *
 *  `readVariant(id)` is TextProvider.GetRandomTokens(id, dfRand: true)
 *  reduced to the first token's text, which is all four record readers
 *  take (`tokens[0].text`). DFU picks that variant with DFRandom where
 *  the port's TEXT.RSC seam picks uniformly - RECORDED: pass a
 *  DFRandom-driven reader for full stream parity, and note the pick
 *  itself consumes a draw in DFU that a uniform reader does not.
 *
 *  ExpandMacros on the %adj and %pp2 tokens (:196, :210) is DFU
 *  re-expanding a record that may itself carry macros; the caller's
 *  expandItemInfo pass covers the same ground for the port. */
export function paintingMacros(info, readVariant) {
  if (!info || !readVariant) return null;
  const part = (id) => { rand(); return readVariant(id) ?? ''; };
  const sub = part(info.sub);
  const adj = part(info.adj);
  const pp1 = part(info.pp1);
  const pp2 = part(info.pp2);
  rand();
  const gender = rand() & 1;
  const bank = rand() & 7;
  return { sub, adj, pp1, pp2, artist: fullName(bank, gender) };
}

export function expandItemInfo(text, item, { name = null, soul = null, potion = null, bookTitle = null, bookAuthor = null, painting = null } = {}) {
  const t = templateByIndex(item?.templateIndex);
  // X7: ResolveItemName (:265-292) and ResolveItemLongName (:296-303).
  // An UNIDENTIFIED item gives up two things at once: its own name
  // falls back to the bare TEMPLATE name - so an enchanted blade reads
  // "Broadsword" rather than whatever its shortName calls it - and the
  // long name drops the MATERIAL prefix as well, so a Daedric one does
  // not announce itself either. Both are the same `if (!IsIdentified)`
  // early return in DFU, one per function.
  //
  // An ARTIFACT shares the material half of that (`!IsIdentified ||
  // IsArtifact` at :302) - Azura's Star is not "an Ebony Amulet".
  const identified = itemIsIdentified(item);
  // AUDIT 26 F077: ResolveItemLongName's LAST arm APPENDS the trapped
  // soul - "Soul Trap (Wraith)" (ItemHelper.cs:352-368) - and it sits
  // AFTER the `!IsIdentified || IsArtifact` early return (:302), so an
  // unidentified trap says nothing. mysticism.soulTrapNameSuffix has
  // carried the law with no caller since it was ported; this is the
  // naming path it was written for. (DFU's "(empty)" alternative is
  // commented out at :365-368, so a blank empty trap is deliberate.)
  const itemName = identified
    ? (name ?? item?.name ?? t?.name ?? '') + soulTrapNameSuffix(item, enemyDisplayName)
    : (t?.name ?? '');
  const soulName = soul ?? (item?.trappedSoulType != null ? enemyDisplayName(item.trappedSoulType) : null);
  return (text ?? '')
    .replaceAll('%it', itemName)
    .replaceAll('%arm', itemName)
    .replaceAll('%wep', itemName)
    .replaceAll('%bt', bookTitle ?? itemName)
    .replaceAll('%ba', bookAuthor ?? 'Anonymous')
    .replaceAll('%po', potion ?? itemName)
    // The painting five (:185-218). Unfilled they printed raw on the
    // panel; with no PAINT.DAT they now read as the blank they are,
    // which is the same choice %bt/%ba make one line up.
    .replaceAll('%sub', painting?.sub ?? '')
    .replaceAll('%adj', painting?.adj ?? '')
    .replaceAll('%pp1', painting?.pp1 ?? '')
    .replaceAll('%pp2', painting?.pp2 ?? '')
    .replaceAll('%an', painting?.artist ?? '')
    .replaceAll('%hs', soulName ?? 'Nothing')
    .replaceAll('%mat', identified && !item?.artifact ? materialName(item) : '')
    .replaceAll('%qua', conditionWord(item))
    .replaceAll('%kg', weightString(item))
    .replaceAll('%wth', String((item?.value ?? itemBaseValue(item)) * (item?.stackCount ?? 1)))   // AUDIT 23 (items-7): Worth() = value x stackCount
    .replaceAll('%wdm', item?.group === 'Weapons' ? weaponDamageString(item) : '')
    .replaceAll('%mod', item?.group === 'Armor' ? armourModString(item) : '');
}

/** PAINT.DAT, registered once by whichever host loaded it - the same
 *  shape loot.js keeps for MAGIC.DEF (setMagicItemTemplates), and for
 *  the same reason: the info panel is reached from a window that is
 *  handed an item and a TEXT.RSC reader, with nowhere to thread a
 *  fourth file through. A context that never loaded PAINT.DAT reads
 *  null and a painting shows record 250 with the five macros blank. */
let _paintFile = null;
export function setPaintFile(paintFile) { _paintFile = paintFile ?? null; }
export function getPaintFile() { return _paintFile; }

/** The panel's rows: the record, expanded, split on its own breaks.
 *  `rows(id)` is the host's TEXT.RSC reader.
 *
 *  GetItemInfo's painting arm (ItemHelper.cs:788-789) does not return
 *  the record like every other group does - it returns
 *  `item.InitPaintingInfo(paintingTextId)`, so the identity is minted
 *  (or found cached) first and the frozen description comes back with
 *  it. `paintingVariant` is GetRandomTokens(id, dfRand: true) for the
 *  four part records, defaulting to the host's own variant reader. */
export function itemInfoRows(item, rows, macros = {}) {
  let painting = macros.painting ?? null;
  let record = null;
  if (!painting && item?.group === 'Paintings' && _paintFile) {
    const info = initPaintingInfo(item, (i) => _paintFile.read(i), rows);
    if (info) {
      record = info.rows;
      const readVariant = macros.paintingVariant ?? ((id) => (rows(id) ?? [])[0]?.text ?? '');
      painting = paintingMacros(info, readVariant);
    }
  }
  return (record ?? rows(itemInfoTextId(item)) ?? [])
    .map((r) => ({ ...r, text: expandItemInfo(r.text, item, { ...macros, painting }) }))
    .filter((r) => r.text.trim() !== '');
}
