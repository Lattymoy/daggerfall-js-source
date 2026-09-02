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

import { addItem, goldStack } from './inventory.js';
import { itemBaseValue, templateByIndex, templateFor } from './itemTemplates.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { SKILL_COUNT } from './skills.js';
import { ensureReactionState } from './talk.js';
import { createRandomBook } from './books.js';   // A2: ItemBuilder.CreateRandomBook, one member

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
    entity.items = entity.items ?? [];
    let stack = entity.items.find((it) => it.group === 'Currency');
    if (!stack) entity.items.push(stack = goldStack(0));
    if (arg[0] === '+') stack.stackCount += Math.abs(v);
    else if (arg[0] === '-') stack.stackCount = Math.max(0, stack.stackCount - Math.abs(v));   // never negative
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

/** GenerateBackstory (:169-232). The class's TEXT.RSC record
 *  (DEFAULT_BACKSTORIES_START + classIndex) is prose with %q1..%q12,
 *  %q1a..%q12a and %q1b..%q12b macros; each expands to the FIRST text
 *  line of a TEXT.RSC record the player's answers named. Both the '#'
 *  and the '!' token of a question land in the SAME per-question list
 *  in file order (tokenLists is indexed by the QUESTION, not the
 *  prefix), so %qN is that list's first entry, %qNa its second and
 *  %qNb its third (BiogFileMCP.cs:150-161, :306-317, :462-473).
 *
 *  Returns the backstory ROWS. `textRsc` is a loaded TextRsc. */
export function generateBackstory(textRsc, backstoryId, effects) {
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
  // kind expands to NOTHING, which is what leaves classic's prose
  // reading cleanly (ExpandMacros appends a null value as empty).
  const macro = (digits, suffix) => {
    const list = perQuestion[Number(digits) - 1] ?? [];
    const id = list[suffix === 'b' ? 2 : suffix === 'a' ? 1 : 0];
    return id == null ? '' : firstLine(id);
  };
  return textRsc.linesById(backstoryId).map((row) => ({
    ...row,
    text: row.text.replace(/%q(\d+)([ab]?)/g, (_, digits, suffix) => macro(digits, suffix)),
  }));
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
