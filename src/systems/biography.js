// S3e: THE BIOGRAPHY EFFECTS - BiogFile.ApplyPlayerEffect verbatim
// (BiogFile.cs:248-445, MIT Daggerfall Workshop). Each answer the
// player picks at chargen carries a list of effect strings; this is
// the whole grammar the shipping BIOG*.TXT files use, counted over
// all 18: SKILL 692, text tokens 589, IT 420, rf 136, r 111, AF 84,
// GP 55, AE 38, RP/FT/RD/MR 18 each, RR/TH 14 each, and 12 bare '&'
// lines that hit DFU's own "Invalid command" branch.
//
// The mods land on fields the port ALREADY consumes:
// biographyReactionMod is read by getReactionToPlayer (talk.js) and
// sGroupReputations by the same, so a biography answer changes how
// townspeople greet you from the first conversation.
//
// NOT A GAP, recorded (closeout): AE, AF and AO are parsed and
// LOGGED, not applied, because that is verbatim what DFU does -
// BiogFile.cs:427 heads the arms "// Unimplemented commands" and
// :428-431/:432-435/:436-439 log "CreateCharBiography: AE|AF|AO -
// command unimplemented." and nothing else. applyEffect (:163-165)
// is those three arms. Applying a guess would BE the divergence.
// `&` is a data quirk in six of the files; DFU's else at :441-444
// logs "Invalid command - " and moves on, which is :167 here.
// `rf` FACTION reputation parks its deltas on the entity, because this
// runs before FACTION.TXT is in hand. S25's attachFactionRep drains
// them at the end of finishChargen, PROPAGATING, exactly as
// BiogFile.cs:339 does.

import { addItem, addGoldPieces, goldPiecesOf } from './inventory.js';   // E4: the GP command writes the counter
import { itemBaseValue, templateByIndex, templateFor } from './itemTemplates.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { SKILL_COUNT } from './skills.js';
import { ensureReactionState } from './talk.js';
import { createRandomBook } from './books.js';   // A2: ItemBuilder.CreateRandomBook, one member
import { expandTalkMacros, MACRO_SYMBOLS } from './talkMacros.js';   // AUDIT 64 F29: MacroHelper.ExpandMacros' walk, one home
import { getMacroValue } from './quest/questMacros.js';              // AUDIT 64 F29: MacroHelper.GetValue's ladder
import { setSeed, rand } from '../formats/dfRandom.js';              // AUDIT 64 F29: DFRandom.Seed / rand() the four name macros ride
import { GENDERS, getNameBank, fullName } from '../characters/nameHelper.js';

/** ItemGroups (ItemEnums.cs:27-59) - the numbers a BIOG line carries. */
export const ITEM_GROUP_BY_ID = Object.freeze({
  0: 'Drugs', 1: 'UselessItems1', 2: 'Armor', 3: 'Weapons', 4: 'MagicItems',
  5: 'Artifacts', 6: 'MensClothing', 7: 'Books', 8: 'Furniture', 9: 'UselessItems2',
  10: 'ReligiousItems', 11: 'Maps', 12: 'WomensClothing', 13: 'Paintings', 14: 'Gems',
  15: 'PlantIngredients1', 16: 'PlantIngredients2', 17: 'CreatureIngredients1',
  18: 'CreatureIngredients2', 19: 'CreatureIngredients3', 20: 'MiscellaneousIngredients1',
  21: 'MetalIngredients', 22: 'MiscellaneousIngredients2', 23: 'Transportation',
  24: 'Deeds', 25: 'Jewellery', 26: 'QuestItems', 27: 'MiscItems', 28: 'Currency',
});

/** WeaponToArmorMaterialType (BiogFile.cs:490-517): the same NAME on
 *  the armor enum, which is the plate row - weapon index m maps to
 *  ARMOR_MATERIAL.Iron + m for Iron..Daedric, and nothing else has a
 *  weapon counterpart. */
export function weaponToArmorMaterial(weaponMaterial) {
  const m = Number(weaponMaterial);
  if (!Number.isInteger(m) || m < 0 || m > 9) return ARMOR_MATERIAL.None;
  return ARMOR_MATERIAL.Iron + m;
}

/** The text commands ('#' backstory, '!' second backstory, '?') are
 *  tagged with their question index by AddEffect (:234-244) and
 *  consumed by the backstory generator, not applied to the entity. */
export const isTextEffect = (effect) => effect[0] === '#' || effect[0] === '!' || effect[0] === '?';

const ARROW_TEMPLATE = 131;

/** BiogFile.cs:305-324's IT arm: Weapons go through CreateWeapon,
 *  Armor through CreateArmor with the weapon->armor material map,
 *  Books through CreateRandomBook, everything else is the bare
 *  group/index record. */
const mintItem = (group, groupIndex, material, rolls) => {
  const t = templateFor(group, groupIndex);
  if (!t) return null;
  // A2: an IT Books row IS CreateRandomBook - the id, the variant and
  // the BOOK FILE's price - so it leaves through the one member rather
  // than through the generic template mint below. This closes the loud
  // interim that used to log here on every biography book.
  if (group === 'Books') return createRandomBook(rolls);
  const item = { group, templateIndex: t.index };
  if (group === 'Weapons') {
    // ItemBuilder.CreateWeapon:353-368 - "Ignored for arrows": an
    // arrow takes NO material (nativeMaterialValue = 0), a stack of
    // Range(1, 20+1) and currentCondition 0. loot.js:85 and
    // shopStock.js:127 already carry this branch; this was the third
    // site and it minted ONE arrow at the file's material, so two IT
    // lines of different material could not even stack.
    if (t.index === ARROW_TEMPLATE) {
      item.material = 0;
      item.stackCount = 1 + Math.floor(rolls() * 20);
      item.currentCondition = 0;
    } else item.material = material;
  } else if (group === 'Armor') item.material = weaponToArmorMaterial(material);
  item.name = templateByIndex(t.index)?.name;
  item.value = itemBaseValue(item);
  return item;
};

/** ApplyPlayerEffect verbatim for ONE effect string. Returns the
 *  command it recognised (for the pins), or null when DFU would have
 *  logged an invalid command. */
export function applyBiographyEffect(entity, effect, { rolls = Math.random } = {}) {
  if (!effect) return null;
  ensureReactionState(entity);
  const tokens = effect.split(/\s+/).filter((s) => s.length);
  const n = Number.parseInt(tokens[0], 10);

  // SKILL: a leading integer is a skill id, tokens[1] the modifier
  if (Number.isInteger(n) && /^-?\d+$/.test(tokens[0])) {
    const mod = Number.parseInt(tokens[1], 10);
    if (!Number.isInteger(mod)) { console.warn(`[biog] invalid skill adjustment: ${effect}`); return null; }
    if (n < 0 || n >= SKILL_COUNT) { console.warn(`[biog] skill id out of range: ${effect}`); return null; }
    if (Array.isArray(entity.skills)) entity.skills[n] = (entity.skills[n] ?? 0) + mod;
    return 'skill';
  }
  if (effect.startsWith('GP')) {
    // "Correct GP commands with spaces between the sign and the
    // amount" (:271-275) - "+ 500" is one argument, not two
    const arg = tokens.length > 2 ? tokens[1] + tokens[2] : tokens[1];
    const v = Number.parseInt(arg, 10);
    if (!Number.isFinite(v)) { console.warn(`[biog] GP - invalid argument: ${effect}`); return null; }
    // E4: `playerEntity.GoldPieces +=/-= parseResult` (:283-289) - the
    // COUNTER, which is what BiogFile writes. The MINUS arm stays the
    // port's own (Ledger A): DFU double-negates the already-signed
    // TryParse result and so ADDS on `-`; the port subtracts, clamped
    // at zero the way DFU's own next line clamps.
    if (arg[0] === '+') addGoldPieces(entity, Math.abs(v));
    else if (arg[0] === '-') entity.goldPieces = Math.max(0, goldPiecesOf(entity) - Math.abs(v));
    return 'gold';
  }
  if (effect.startsWith('IT')) {
    const [g, gi, mat] = [tokens[1], tokens[2], tokens[3]].map((t) => Number.parseInt(t, 10));
    if (![g, gi, mat].every(Number.isFinite)) { console.warn(`[biog] IT - invalid argument(s): ${effect}`); return null; }
    const group = ITEM_GROUP_BY_ID[g];
    const item = group ? mintItem(group, gi, mat, rolls) : null;
    if (!item) { console.warn(`[biog] IT - no template for ${effect}`); return null; }
    entity.items = entity.items ?? [];
    addItem(entity.items, item);
    return 'item';
  }
  if (effect.startsWith('r')) {
    const amount = Number.parseInt(tokens[1], 10);
    if (!Number.isFinite(amount)) { console.warn(`[biog] r - invalid argument: ${effect}`); return null; }
    if (effect[1] === 'f') {
      const id = Number.parseInt(tokens[0].split('f')[1], 10);
      if (!Number.isFinite(id)) { console.warn(`[biog] rf - invalid argument: ${effect}`); return null; }
      // parked for attachFactionRep (S25) - the store does not exist
      // yet at this point in the flow
      entity.pendingFactionRep = entity.pendingFactionRep ?? [];
      entity.pendingFactionRep.push({ id, amount });
      return 'factionRep';
    }
    const id = Number.parseInt(tokens[0].split('r')[1], 10);
    if (!Number.isFinite(id) || id < 0 || id >= entity.sGroupReputations.length) {
      console.warn(`[biog] r - invalid argument: ${effect}`); return null;
    }
    entity.sGroupReputations[id] += amount;
    return 'socialRep';
  }
  // the six single-field biography modifiers - each ASSIGNS, it does
  // not accumulate (:351-423 all read `= parseResult`)
  const MODS = { RP: 'biographyResistPoisonMod', FT: 'biographyFatigueMod', RR: 'biographyReactionMod', RD: 'biographyResistDiseaseMod', MR: 'biographyResistMagicMod', TH: 'biographyAvoidHitMod' };
  for (const [cmd, field] of Object.entries(MODS)) {
    if (!effect.startsWith(cmd)) continue;
    const v = Number.parseInt(tokens[1], 10);
    if (!Number.isFinite(v)) { console.warn(`[biog] ${cmd} - invalid argument: ${effect}`); return null; }
    entity[field] = v;
    return cmd;
  }
  if (isTextEffect(effect)) return 'text';
  if (effect.startsWith('AE') || effect.startsWith('AF') || effect.startsWith('AO')) {
    console.log(`[biog] ${effect.slice(0, 2)} - command unimplemented`);   // verbatim: DFU has not implemented these either
    return 'unimplemented';
  }
  console.warn(`[biog] Invalid command - ${effect}`);   // the bare '&' lands here, as it does in DFU
  return null;
}

/** DigestRepChanges (:150-167): the per-social-group TOTAL a set of
 *  answers moved, for the closing reputation box. Skips `rf` (faction)
 *  and anything malformed, exactly as DFU's guard chain does. */
export function digestRepChanges(effects, groups = 5) {
  const changed = new Array(groups).fill(0);
  for (const e of effects ?? []) {
    const tokens = String(e).split(/\s+/).filter((x) => x.length);
    // the `e[1] === 'f'` arm is DEFENSIVE in DFU and redundant in
    // practice - "rf42".split('r')[1] is "f42", which never parses -
    // so it is ported but carries no pin of its own
    if (e[0] !== 'r' || e[1] === 'f' || tokens.length < 2) continue;
    const id = Number.parseInt(tokens[0].split('r')[1], 10);
    const amount = Number.parseInt(tokens[1], 10);
    if (!Number.isFinite(id) || !Number.isFinite(amount) || id < 0 || id >= groups) continue;
    changed[id] += amount;
  }
  return changed;
}

/** AUDIT 64 F29 - THE BIOGRAPHY'S MACRO DATA SOURCE (BiogFileMCP.cs).
 *  `BiogFile.GenerateBackstory` does not substitute %qN and stop: it
 *  runs the WHOLE macro table over the record with the BiogFile as
 *  the context provider - `MacroHelper.ExpandMacros(ref tokens,
 *  (IMacroContextProvider)this)` (BiogFile.cs:215), one line after it
 *  assigns `PlayerEntity.BirthRaceTemplate = characterDocument.
 *  raceTemplate` with its own comment, "Need correct race set when
 *  parsing %ra macro" (:212). Fourteen of the eighteen shipping class
 *  backstories (Internal_RSC.csv 4116-4133) name at least one of
 *  %hpn %hpw %bn %imp %fn %mn %ra, so the port's %qN-only regex left
 *  raw macro text standing in a Healer's, a Bard's, a Thief's or a
 *  Knight's history for the rest of the game.
 *
 *  The six source rows are BiogFileMCP's own; the strings are
 *  Internal_Strings.csv:456-469, which is what the localized keys in
 *  the two switches resolve to.
 *
 *  THE SEED IS A LEDGER A DEPARTURE. `DFRandom.Seed =
 *  (uint)parent.GetHashCode()` (BiogFileMCP.cs:145, :621, :629, :635)
 *  is the CLR's identity hash on the BiogFile instance - a value that
 *  differs run to run inside DFU itself and has no port. The port
 *  takes ONE injectable per-generation seed and keeps DFU's offsets
 *  verbatim over it: base for %bn and %imp, base+123 for %fn,
 *  base+9543 for %mn, each RESEEDING before its single draw, so the
 *  three names stay distinct exactly as DFU's are. */
const HOME_PROVINCE = Object.freeze({   // HomeProvinceName (:87-115)
  Argonian: 'Black Marsh', Breton: 'High Rock', DarkElf: 'Morrowind',
  HighElf: 'Sumurset', Khajiit: 'Elsweyr', Nord: 'Skyrim',
  Redguard: 'Hammerfell', WoodElf: 'Valenwood',
});
const GEOGRAPHICAL_FEATURE = Object.freeze({   // GeographicalFeature (:117-141)
  Argonian: 'swamps', Breton: 'rolling hills', DarkElf: 'mountains',
  HighElf: 'shores', Khajiit: 'desertland', Nord: 'mountains',
  Redguard: 'desertland', WoodElf: 'forests',
});
/** ImperialName (:618-624) - the literal table, NOT SaveVars'
 *  emperorSonNames, despite %imp reading those elsewhere. */
const IMPERIAL_NAMES = Object.freeze(
  ['Pelagius', 'Cephorus', 'Uriel', 'Cassynder', 'Voragiel', 'Trabbatus']);

export function biogMacroSource(raceKey, seed) {
  const bank = () => getNameBank(raceKey);   // MacroHelper.GetNameBank (:344-366)
  return {
    homeProvinceName: () => HOME_PROVINCE[raceKey] ?? null,
    geographicalFeature: () => GEOGRAPHICAL_FEATURE[raceKey] ?? null,
    // Name %bn (:143-148)
    name() { setSeed(seed); return fullName(bank(), GENDERS.Male); },
    // ImperialName %imp (:618-624)
    imperialName() { setSeed(seed); return IMPERIAL_NAMES[rand() % 6]; },
    // FemaleName %fn (:626-632) / MaleName %mn (:633-638)
    femaleName() { setSeed(seed + 123); return fullName(bank(), GENDERS.Female); },
    maleName() { setSeed(seed + 9543); return fullName(bank(), GENDERS.Male); },
  };
}

/** GenerateBackstory (:169-232). The class's TEXT.RSC record
 *  (DEFAULT_BACKSTORIES_START + classIndex) is prose with %q1..%q12,
 *  %q1a..%q12a and %q1b..%q12b macros; each expands to the FIRST text
 *  line of a TEXT.RSC record the player's answers named. Both the '#'
 *  and the '!' token of a question land in the SAME per-question list
 *  in file order (tokenLists is indexed by the QUESTION, not the
 *  prefix), so %qN is that list's first entry, %qNa its second and
 *  %qNb its third (BiogFileMCP.cs:150-161, :306-317, :462-473).
 *
 *  AUDIT 64 F29: and the record's OTHER macros expand too, through
 *  the one ExpandMacros walk (talkMacros.expandTalkMacros) over the
 *  whole handler table, with `biogMacroSource` behind the six
 *  BiogFileMCP rows and `playerRaceName` behind %ra - the stand-in
 *  for BiogFile.cs:212's BirthRaceTemplate assignment, because the
 *  port builds the backstory while the CHARGEN DOCUMENT still owns
 *  the race and no player entity exists yet.
 *
 *  `ctx` is `{ raceKey, raceName, seed }` from the chargen flow.
 *
 *  Returns the backstory ROWS. `textRsc` is a loaded TextRsc. */
export function generateBackstory(textRsc, backstoryId, effects, ctx = {}) {
  if (!textRsc) return [];
  const perQuestion = [];
  for (const e of effects ?? []) {
    if (!isTextEffect(e)) continue;
    const [command, index] = String(e).split(' ');
    const q = Number.parseInt(index, 10);
    if (!Number.isFinite(q)) { console.warn('[biog] GenerateBackstory: Invalid question index.'); continue; }
    const id = Number.parseInt(command.slice(1), 10);
    if (!Number.isFinite(id)) continue;
    (perQuestion[q] = perQuestion[q] ?? []).push(id);
  }
  const firstLine = (id) => textRsc.linesById(id)?.[0]?.text ?? '';
  // AUDIT 18: the TERTIARY %qNb family is live in DFU - MacroHelper
  // registers %q1b..%q12b (:189-200) and ExpandMacros reads a macro
  // name up to the next MACRO_TERMINATORS char (:412, :453), which is
  // punctuation, never a letter - so "%q1b." is the whole macro.
  // BiogFileMCP.Q1b (:462-473) returns the THIRD token's first line
  // and null when the list is shorter than three. The regex only knew
  // the optional 'a', so record 4130 (Ranger) rendered its %q1b as the
  // PRIMARY token plus a literal 'b' ("...daggerb."), and 4123
  // (Burglar) the same for %q3b. A question with no token of that
  // kind expands to NOTHING here, which leaves the prose reading
  // cleanly. AUDIT 64 F29 corrects the reason this comment used to
  // give: MacroHelper.GetValue (:503-528) renders a null handler
  // answer as `symbolStr + "[nullMCP]"`, so DFU prints the sentinel
  // and the empty form is the port's own, older divergence - kept
  // here, unre-decided, and NOT routed through the ladder below.
  const macro = (digits, suffix) => {
    const list = perQuestion[Number(digits) - 1] ?? [];
    const id = list[suffix === 'b' ? 2 : suffix === 'a' ? 1 : 0];
    return id == null ? '' : firstLine(id);
  };
  // AUDIT 64 F29: ONE ExpandMacros pass over the WHOLE record
  // (MacroHelper.cs:419-494), so the per-call macro cache C# keeps
  // (:427-429, :457-462) names the SAME woman for a record that says
  // %fn twice, and a %q value that happens to carry a '%' is never
  // re-expanded - both of which a regex-then-expander pair would get
  // wrong.
  //
  // THE %q BLOCK STAYS LOCAL, and deliberately: MacroHelper.GetValue
  // renders a null source answer as `symbolStr + "[nullMCP]"`
  // (:509-512), so DFU shows "%q1b[nullMCP]" for a question with
  // fewer than three tokens where this port shows nothing. That
  // divergence is older than this fix and pinned as it stands
  // (test/biography.test.js); it is not re-decided here. Everything
  // ELSE rides the real ladder, sentinels and all.
  const mcp = { source: biogMacroSource(ctx.raceKey ?? null, ctx.seed ?? 0) };
  const hooks = { playerRaceName: () => ctx.raceName ?? null };   // %ra, MacroHelper.cs:942-945
  const handlers = {};
  for (const symbol of MACRO_SYMBOLS) handlers[symbol] = () => getMacroValue(symbol, mcp, hooks);
  for (let n = 1; n <= 12; n++) {
    for (const suffix of ['', 'a', 'b']) handlers[`%q${n}${suffix}`] = () => macro(n, suffix);
  }
  const rows = textRsc.linesById(backstoryId).map((row) => ({ ...row }));
  expandTalkMacros(rows, handlers);
  return rows;
}

/** ApplyEffects (:447-456). */
export function applyBiographyEffects(entity, effects, opts = {}) {
  const applied = [];
  for (const e of effects ?? []) applied.push(applyBiographyEffect(entity, e, opts));
  return applied;
}

/** GetSkillEffects (:458-...): the per-skill bonus array the SKILLS
 *  SCREEN displays on top of the rolled values while the player
 *  distributes (CreateCharAddBonusSkills.cs:67-72). The bonus is a
 *  DISPLAY term there - the entity only gains it when the effects are
 *  applied at game start - and it does NOT turn the value green,
 *  because that colour compares working against ROLLED
 *  (SkillsRollout.cs:295-308). */
export function biographySkillBonuses(effects) {
  const out = new Array(SKILL_COUNT).fill(0);
  for (const e of effects ?? []) {
    const t = String(e).split(/\s+/).filter((x) => x.length);
    if (!/^-?\d+$/.test(t[0] ?? '')) continue;
    const id = Number.parseInt(t[0], 10), mod = Number.parseInt(t[1], 10);
    if (Number.isInteger(id) && id >= 0 && id < SKILL_COUNT && Number.isFinite(mod)) out[id] += mod;
  }
  return out;
}

/** AddEffect (:234-244): the text commands are tagged with the
 *  question index so the backstory generator can order them. */
export const tagEffect = (effect, questionIndex) =>
  (isTextEffect(effect) ? `${effect} ${questionIndex}` : effect);
