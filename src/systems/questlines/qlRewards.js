// @ts-check
// QL3 (2026-10-19, the owner: "Overhauling quest rewards to be more meaningful with gear, currencies, etc"): WHAT AN
// OUTCOME PAYS - the client's half (bible/06-Systems/Questlines-Arc.md section 5.2). The service's half - silver, embers,
// Weir Keys, titles - is paid only against what the service witnessed (section 5.3, server-account/src/questlines.js);
// nothing here mints an account currency (decision 8).
//
// THE GOLD stays DFU's formula (quest/item.js _createGold), times the outcome's factor - never below OUTCOME_GOLD_MIN
// nor above OUTCOME_GOLD_MAX of what the script minted, and never touching a reward that is not gold.
//
// A PIECE OF GEAR, CHOSEN. An outcome that pays gear offers REWARD_CHOICES pieces - a weapon, a piece of armour and a
// jewel where the player can wear each - at the quest's tier's floor (TIER_FLOORS), and the player keeps one. They are
// made by the game's own makers and laddered by the game's own ladder, as a Dagon's Breach's spoils are (systems/gate/
// gateSpoils.js spoilsBase, systems/loot/lootRarity.js applyRarity - TEST THE SHAPE THE PRODUCER MINTS), so the item law
// and the copy ledger read a quest's piece as any piece. FITTED: never a piece the player's class may not equip
// (equip.js isForbiddenEquip, DFU's own restriction), and a weapon of one of the player's two best weapon skills.
// SEEDED by the quest (rewardSeed), and the three are the layer's own the moment they are rolled (qlLayer.js `offers`, kept
// in the layer's save beside the machine's) - a reload shows the same three, and a quest rolls its choice once (its
// state's `moved`, the ending's guard). AUDIT QUESTLINES REWARD-15: the words said the quest's state held the three and
// that `paid` paid the choice once; `paid` says the script paid (GivePc's moment: the gold scaled once, and the ending's
// word that gear is owed), never that a choice was taken.
//
// A NAMED PIECE (a questline's ending - section 5.2): `named: { name, kind, base }` - the card of `kind` is made FROM
// `base` (an item template's name the roll can make for that kind, namedBaseOf), through the same fit, and takes the name;
// a holder who cannot wear that base gets the card unnamed (AUDIT QUESTLINES REWARD-5: the name landed on whatever base
// the roll drew - "Oathkeeper's Dragon Helm" a pair of Gauntlets, a weapon's name on a Left Pauldron).
//
// Not a DFU member: DFU's quests pay what their scripts say and nothing more. Port-Ledger A (QL3).
import { seededRng } from '../wind/wind.js';
import { spoilsBase } from '../gate/gateSpoils.js';
import { applyRarity } from '../loot/lootRarity.js';
import { isForbiddenEquip, wearableItem } from '../equip.js';
import { ITEM_GROUPS } from '../loot/loot.js';   // REWARD-5: the jewels the roll makes (gateSpoils.js makeBase's own list)
import { createWeapon, randomMaterial, randomArmorMaterial, WEAPONS_ENUM, ARMOR_ENUM } from '../../combat/enemyEquipment.js';   // REWARD-5: a named base, made as ItemBuilder makes its kind
import { setItemFields, mintCondition, templateByIndex } from '../item/itemTemplates.js';
import { weaponSkillUsed } from '../../characters/weapons.js';
import { SKILLS, skillValue } from '../skills.js';
import { factionsTable } from '../quest/tables.js';
import { PAY_NAMES } from './qlSheets.js';

/** What each pay an outcome names gives: its gold factor, whether it offers a piece, and a step up the tier's ladder. */
export const PAY_PROFILES = Object.freeze({
  standard: Object.freeze({ gold: 1, gear: true, step: 0 }),
  lesser: Object.freeze({ gold: 0.75, gear: true, step: 0 }),     // the merciful way: less coin, more standing (the sheet's)
  greater: Object.freeze({ gold: 1.25, gear: true, step: 1 }),    // the harder way taken
  double: Object.freeze({ gold: 1, gear: true, step: 0 }),        // both sides paid by the script itself - the piece once
  betrayal: Object.freeze({ gold: 1, gear: false, step: 0 }),     // the other side's coin, never the betrayed guild's piece
  own: Object.freeze({ gold: 1, gear: false, step: 0 }),          // the script's own reward is the reward - a Prince's artifact
  none: Object.freeze({ gold: 1, gear: false, step: 0 }),         // a quest that ended unpaid: nothing added
});
/** The bounds of an outcome's gold factor (section 5.2). */
export const OUTCOME_GOLD_MIN = 0.75;
export const OUTCOME_GOLD_MAX = 1.5;
/** How many pieces an outcome that pays gear offers. */
export const REWARD_CHOICES = 3;
/** The tier's ladder (section 5.2): the floor every piece is laddered to, and the share of pieces one rung higher.
 *  AUDIT QUESTLINES REWARD-7 (the record's own measure, 5.2: "A quest pays ONE piece ... at Magic or Rare"): tier 4 is
 *  Rare with no rung up - its 15% rung made 15.6% of a tier-4 choice's cards Legendary (39.7% of its choices held one),
 *  and a social quest's tier is the level band, so a courier's errand at level 21 paid it. */
export const TIER_FLOORS = Object.freeze({
  1: Object.freeze({ floor: 'magic', up: 0 }),
  2: Object.freeze({ floor: 'magic', up: 0.25 }),
  3: Object.freeze({ floor: 'rare', up: 0 }),
  4: Object.freeze({ floor: 'rare', up: 0 }),
});
/** The ladder's rungs, Magic up. A quest's piece stops at Rare: no tier's floor is Legendary and tier 4 climbs no rung
 *  (REWARD-7) - TIER_FLOORS is the one constant to move (record 5.2), so the ladder itself is not cut here. */
const RUNGS = Object.freeze(['magic', 'rare', 'legendary']);
/** The weapon skills a fitted weapon is chosen by (DFU's Skills for the five weapon kinds). */
export const WEAPON_SKILLS = Object.freeze([SKILLS.ShortBlade, SKILLS.LongBlade, SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.Archery]);

if (PAY_NAMES.some((p) => !PAY_PROFILES[p]) || Object.keys(PAY_PROFILES).some((p) => !PAY_NAMES.includes(p))) {
  throw new Error('qlRewards: PAY_PROFILES and qlSheets.PAY_NAMES name different pays');
}

/** The pay an outcome names, read (an unknown name pays nothing extra). */
export const payProfileOf = (outcome) => PAY_PROFILES[outcome?.pay] ?? PAY_PROFILES.none;

/** The gold factor, bounded. */
export const goldFactor = (outcome) => Math.min(OUTCOME_GOLD_MAX, Math.max(OUTCOME_GOLD_MIN, payProfileOf(outcome).gold));

/** Scales a gold reward by the outcome's factor, in place, at least one coin. Answers the count before and after, or
 *  null when the item is not gold (a script's own item reward is never touched). */
export function scaleGold(dfItem, outcome, isGold) {
  if (!dfItem || !isGold) return null;
  const before = Math.max(0, Math.floor(dfItem.stackCount ?? 0));
  const after = Math.max(1, Math.round(before * goldFactor(outcome)));
  dfItem.stackCount = after;
  return { before, after };
}

/** The tier a quest's pieces are laddered at: its own, stepped by the pay, 1 to 4. */
export const rewardTier = (tier, outcome) => Math.min(4, Math.max(1, (tier | 0) + payProfileOf(outcome).step));

/** One piece's rarity at `tier`: the floor, or one rung higher `up` of the time. */
export function pieceRarity(tier, rolls) {
  const t = TIER_FLOORS[Math.min(4, Math.max(1, tier | 0))];
  const i = RUNGS.indexOf(t.floor) + (rolls() < t.up ? 1 : 0);
  return RUNGS[Math.min(RUNGS.length - 1, i)];
}

/** A quest's reward seed: its name, uid and start, hashed (FNV-1a, 32 bits) - the same quest rolls the same three. */
export function rewardSeed(quest) {
  const s = `${quest?.questName ?? ''}|${quest?.uid ?? 0}|${Math.floor(quest?.questStartTime ?? 0)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** The player's two best weapon skills (their live values; ties in DFU's order). */
export function bestWeaponSkills(entity, n = 2) {
  if (!entity) return [...WEAPON_SKILLS];
  return [...WEAPON_SKILLS].map((id, i) => ({ id, i, v: safeSkill(entity, id) }))
    .sort((a, b) => b.v - a.v || a.i - b.i).slice(0, n).map((x) => x.id);
}
const safeSkill = (entity, id) => { try { return Number(skillValue(entity, id)) || 0; } catch { return 0; } };

const KIND_GROUP = Object.freeze({ weapon: 'Weapons', armor: 'Armor', jewel: 'Jewellery' });
const TRIES = 96;

/** Whether `item` fits the player as a piece of `kind`: its group, a class that may equip it, and - a weapon - one of
 *  the player's best weapon skills. */
export function fitsPlayer(item, kind, entity, skills = bestWeaponSkills(entity)) {
  if (!item || item.group !== KIND_GROUP[kind]) return false;
  if (isForbiddenEquip(entity?.career ?? null, item)) return false;
  if (kind === 'weapon') return skills.includes(weaponSkillUsed(item.templateIndex));
  return true;
}

/** REWARD-5: the templates each kind's named base may be - the ones the roll makes for that kind (ItemBuilder's weapons
 *  but the arrow, its eleven pieces of armour, gateSpoils.js makeBase's jewels). */
const NAMED_BASES = Object.freeze({
  weapon: Object.freeze(Object.values(WEAPONS_ENUM)),
  armor: Object.freeze(Object.values(ARMOR_ENUM)),
  jewel: Object.freeze([...(ITEM_GROUPS.Jewellery ?? [])]),
});
/** A named piece's base (`named.base`, a template's name) as the template index the roll makes it from, or null - a base
 *  that is no template of its kind's, or one no slot takes. The sheet law reads it too (fixer PATCH's check). */
export function namedBaseOf(named) {
  if (!named || typeof named.base !== 'string' || !NAMED_BASES[named.kind]) return null;
  const i = NAMED_BASES[named.kind].find((t) => templateByIndex(t)?.name === named.base);
  return i != null && wearableItem({ group: KIND_GROUP[named.kind], templateIndex: i }) ? i : null;
}
/** One piece of `kind` made from template `index` at `level`, as the roll's maker makes its kind (gateSpoils.js
 *  spoilsBase: the material ItemBuilder draws for the level, the condition minted). */
function baseOf(kind, index, level, rolls) {
  if (kind === 'weapon') return mintCondition({ group: 'Weapons', ...createWeapon(index, randomMaterial(level, rolls)) });
  if (kind === 'armor') return mintCondition(setItemFields({ group: 'Armor', templateIndex: index, material: randomArmorMaterial(level, rolls) }));
  return mintCondition(setItemFields({ group: 'Jewellery', templateIndex: index }));
}

/**
 * THE CHOICE: REWARD_CHOICES pieces for one quest's outcome - `[{ item, tier, kind, named? }]`, a weapon, a piece of armour
 * and a jewel where each fits the player (a kind that cannot - a class barred from every weapon it rolls, or from every
 * armour - gives its place to another piece of armour or a jewel), each laddered at the quest's tier and known. `named`
 * (a questline's ending's `{ name, kind, base }`): the card of that kind is made from its base and takes the name -
 * `named: true` on the piece, `qlNamed` on the item (itemInfo.js keeps a metal off its name) - or, where the player cannot
 * wear that base, the card is the kind's own roll, unnamed. The same seed, level, player and name answer the same three.
 * @param {{ seed: number, level: number, tier: number, entity?: any, named?: { name: string, kind: string, base: string } | null }} args
 */
export function rollRewardChoice({ seed, level, tier, entity = null, named = null }) {
  const rolls = seededRng(seed >>> 0);
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const skills = bestWeaponSkills(entity);
  const base = namedBaseOf(named);
  const out = [];
  const draw = (kind) => {
    for (let n = 0; n < TRIES; n++) {
      const item = spoilsBase(lv, rolls);
      if (fitsPlayer(item, kind, entity, skills)) return item;
    }
    return null;
  };
  // REWARD-5: the named card from its base, through the same fit (a metal the class may not wear is drawn again)
  const drawNamed = () => {
    for (let n = 0; n < TRIES; n++) {
      const item = baseOf(named.kind, base, lv, rolls);
      if (fitsPlayer(item, named.kind, entity, skills)) return item;
    }
    return null;
  };
  for (const kind of ['weapon', 'armor', 'jewel']) {
    let item = base != null && named.kind === kind ? drawNamed() : null, k = kind;
    const isNamed = !!item;
    if (!item) item = draw(kind);
    // AUDIT QUESTLINES REWARD-10: a failed armour draw gives its place to a jewel - drawing armour again offered a class
    // barred from every armour two pieces
    if (!item) { k = kind === 'armor' || out.some((p) => p.kind === 'armor') ? 'jewel' : 'armor'; item = draw(k); }
    if (!item) continue;
    const rarity = pieceRarity(tier, rolls);
    applyRarity(item, rarity, rolls);
    item.isIdentified = true;
    if (isNamed) { item.name = named.name; item.qlNamed = true; }   // after the ladder, whose name it replaces
    out.push(isNamed ? { item, tier: item.rarity ?? rarity, kind: k, named: true } : { item, tier: item.rarity ?? rarity, kind: k });
  }
  return out.slice(0, REWARD_CHOICES);
}

/** A Quests-Factions name's faction id, or null. AUDIT QUESTLINES REWARD-12: an INDIVIDUAL row only (p2 -1, its id p3 -
 *  person.js getIndividualFactionID's read); p2 0 and up is an occupation code (`Noble` read as Azura, `Questor` as
 *  Arkay) and the other negative p2 rows are kinds and local groups (`God` read as Clavicus Vile), never a faction. */
export function factionIdOf(name) {
  try {
    const table = factionsTable();
    if (!table.hasValue(name)) return null;
    if (Number.parseInt(table.getValue('p2', name), 10) !== -1) return null;
    const id = Number.parseInt(table.getValue('p3', name), 10);
    return Number.isSafeInteger(id) && id > 0 && id !== 10000 ? id : null;
  } catch { return null; }
}

/**
 * AUDIT QUESTLINES REWARD-3: THE GOLD STILL OWED when a quest ends. GivePc's gold is scaled by the outcome the quest's
 * state holds at that moment (a quest may pay before it ends - M0B00Y16 pays at the questor's click, before the escort
 * home settles `rescued`); `paid` is what that moment recorded - `{ base, factor, shares }`, the script's count, the
 * factor applied and the party's shares it was split in - and `outcome` the one the quest settled on. Answers the coin the
 * settled outcome pays above what was paid (a share's worth in a party), or 0 - never less: gold paid is never taken back,
 * and a failure, or an ending that pays nothing (`none`), adds nothing.
 * @param {{ base: number, factor: number, shares?: number } | null | undefined} paid @param {any} outcome
 */
export function goldStillOwed(paid, outcome) {
  if (!paid || !outcome || outcome.failure || outcome.pay === 'none') return 0;
  if (!Number.isSafeInteger(paid.base) || paid.base < 0 || !Number.isFinite(paid.factor)) return 0;
  const shares = Math.max(1, Math.trunc(paid.shares ?? 1) || 1);
  const share = (factor) => Math.max(1, Math.floor(Math.max(1, Math.round(paid.base * factor)) / shares));   // scaleGold, then shareQuestGold
  return Math.max(0, share(goldFactor(outcome)) - share(paid.factor));
}

/** The standing an outcome moves: `[{ factionId, name, amount }]` for each faction it names that the table knows. */
export const standingMovesOf = (outcome) => Object.entries(outcome?.standing ?? {})
  .map(([name, amount]) => ({ factionId: factionIdOf(name), name, amount }))
  .filter((s) => s.factionId != null && Number.isSafeInteger(s.amount) && s.amount !== 0);
