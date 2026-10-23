// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CRAFT-WRITS (2026-10-22, the Discord's #feature-feedback, TheBard, "Crafting seems unrewarding": "crafting writs
// instead of only gathering writs. Something like; potions of restore power needed by the mages guild. The reward can
// be crafting xp, silver, and rep"; the owner: "Why dont you actually build this instead of handing me a small fix?"):
// THE GUILDS' ASKS OF A CRAFTER. Every writ the board posted asked a gathered MATERIAL from the Stores (PROF0 11); a
// crafting writ asks what a crafter MAKES - potions, dishes, Repair Kits - and pays for the making. The record is
// bible/06-Systems/Professions-Arc.md section 49.
//
// THE SHAPE. An ACCOUNT is asked three a UTC day (`k:<day>:<the character that read first>:<slot>`), drawn by the service
// from the account's own dice the first time any of its realm characters reads a board that day, within its best
// crafter's ranks - a potion and a dish of Provisioning's, and a Repair Kit of Smithing's where one of its characters has
// smithed at all (else a second potion). AUDIT CRAFT-WRITS E1: a character's own three let an account of six pick its
// best three of eighteen - the draw is the account's, and any of its characters fills a writ with its own goods.
// The guild that would want it asks it (CRAFT_GUILDS): the Mages Guild most potions, the Temple of Stendarr the remedies,
// the Fighters Guild strength and stamina, a soldier's dishes and the kits, the Temple of Mara the tart and the feast.
// Filled whole at any board, before the day ends; an account fills CRAFT_WRITS_PER_DAY of them a day.
//
// WHAT FILLS ONE - MADE, AND HANDED OVER. A writ's Marks are minted only for an act the service witnessed (law 8):
//  - POTIONS: the filling character's own BREWS (the service's prof_brews - every potion a station bottled for it), less
//    what the crafting writs it filled of that potion already took, cover the count; and the bottles themselves leave
//    its realm record - any bottles of that recipe, a Potent one too (a potion is a potion: the brews are the witness,
//    the record the goods).
//    A looted or bought bottle fills nothing a brew of its own does not stand behind.
//  - DISHES AND KITS: the pieces themselves, by provenance - each the filling character's make (products.char_id), the
//    account's still (a sold one is its buyer's), never walled to gold (products.bought_with - AUDIT CRAFT-WRITS T2: a
//    piece of goods bought for silver is its maker's all the same), on no listing, road or home, and in the record's pack
//    loose; their rows go with them.
//  - Never a potion wholly of the Apothecaries' goods (Water Breathing, Levitation - alchemyLaw brewFirstPays): silver
//    bought at the counter and brewed would come back as more silver with no hand's work between.
//
// THE PAY (silver - Marks, `writ`'s kin: a mint, `craft-writ`). A writ is worth what its goods cost to make: a make's
// gathered inputs at their Marks values times CRAFT_PAY_PCT, and the goods only a counter sells (professionLaw
// COUNTER_ONLY - the Apothecaries' reagents, sold at their value) at their cost alone (AUDIT CRAFT-WRITS E2: half again on
// a reagent bought was silver in, more silver out), over the units one make gives a Novice (a brew 2 - CRAFT-PAYS - a dish
// 1, a kit 1); never less than CRAFT_PAY_FLOOR a tier (a rank's skill is paid for, not only its herbs - the floor is what
// most writs pay), never more than CRAFT_WRIT_PAY_MAX (the count is lowered first). Its XP twice its pay to the craft's track (the Court writ's own law, writXp), under the
// crafter's limit; its Renown twice its pay at the rate (renownRate - the Court writ's ratio); and HALL_WRIT_REP standing
// with its guild on the character's Roll, where the Roll keeps the guild (a hall writ's law, CHAP2a).
//
// Pure: no clock, no DOM, no network. Not a DFU member: Daggerfall has no writs. Ledger A (CRAFT-WRITS).
// ═══════════════════════════════════════════════════════════════════

import { POTIONS, potionById, brewFirstPays, ingredientKeys } from './alchemyLaw.js';
import { DISHES, recipeById, RECIPES } from './recipeLaw.js';
import { material } from './nodeLaw.js';
import { TIER_RANKS, topTierOf, professionName, COUNTER_ONLY } from './professionLaw.js';
import { renownRate } from './renown.js';
import { gateHash } from './gate/gateLaw.js';
import { GUILD_FACTION_IDS, DIVINES } from '../systems/guild/guildFactions.js';
import { takeTradeGoods, tradeableRecord, recordCount } from './realm/realmTradeLaw.js';
import { PROVENANCE_RE } from './recipeLaw.js';
import { MARKS_FAUCETS } from './marksLaw.js';
import { hallPosterName } from './npcChapterLaw.js';
import { UNYIELDED } from './marketLaw.js';
import { GROUP_TEMPLATE_INDICES } from '../systems/item/itemTemplatesData.js';
import { isLocked } from '../systems/item/itemLock.js';
import { t } from '../systems/textManager.js';

/** Crafting writs an account fills a UTC day - their own allowance, beside the Court's three: the faucet's cap. */
export const CRAFT_WRITS_PER_DAY = MARKS_FAUCETS.craftWrit.perDay;
/** The writs a character is asked a UTC day: a potion, a dish, and a kit (or a second potion). */
export const CRAFT_WRIT_SLOTS = 3;
/** A writ is worth its goods' cost this share, in hundredths - half again. */
export const CRAFT_PAY_PCT = 150;
/** The least a writ pays, a tier of its goods. */
export const CRAFT_PAY_FLOOR = 20;
/** The most one writ pays - its count lowered to fit before the pay is cut. */
export const CRAFT_WRIT_PAY_MAX = 200;
/** The units one make gives a Novice: a brew two (alchemyLaw brewCount below Journeyman), a dish one, a kit one. */
export const NOVICE_YIELD = Object.freeze({ potion: 2, dish: 1, kit: 1 });
/** A crafting writ's own dice salt - never the Court's, a hall's or a member's. */
export const CRAFT_WRIT_SALT = 0x6c3a;
/** The kinds a crafting writ asks, and the track each is made on (CRAFT3: Alchemy and Cooking are Provisioning's). */
export const CRAFT_KINDS = Object.freeze({ potion: 'provisioning', dish: 'provisioning', kit: 'smithing' });

/** THE GUILD THAT ASKS EACH (the port's own choice - DFU's guilds post no writs): the Mages Guild most potions; the Temple
 *  of Stendarr, the god of mercy, the remedies; the Fighters Guild the potions of strength and wind, a soldier's dishes
 *  and the Repair Kits; the Temple of Mara the tart and the feast, a table's. */
export const CRAFT_GUILDS = Object.freeze({
  potion: Object.freeze({
    healing: DIVINES.Stendarr, healTrue: DIVINES.Stendarr, cureDisease: DIVINES.Stendarr, curePoison: DIVINES.Stendarr, purification: DIVINES.Stendarr,
    orcStrength: GUILD_FACTION_IDS.FightersGuild, stamina: GUILD_FACTION_IDS.FightersGuild,
  }),
  dish: Object.freeze({ stew: GUILD_FACTION_IDS.FightersGuild, supper: GUILD_FACTION_IDS.FightersGuild, tart: DIVINES.Mara, feast: DIVINES.Mara }),
  kit: GUILD_FACTION_IDS.FightersGuild,
  potionDefault: GUILD_FACTION_IDS.MagesGuild,
});

/** The potions a writ may ask: DFU's twenty less the two made wholly of the Apothecaries' goods. */
export const WRIT_POTIONS = Object.freeze(POTIONS.filter((p) => brewFirstPays(p)));
/** The Repair Kits a writ may ask - every metal's (recipeLaw `kit:<metal>`) that can be made: AUDIT CRAFT-WRITS E4 - never
 *  one of a metal nothing yields (marketLaw UNYIELDED, the Daedric ingot), a writ no smith could fill. */
export const WRIT_KITS = Object.freeze(RECIPES.filter((r) => r.product === 'kit' && !r.inputs.some((i) => UNYIELDED.includes(i.key))));

/**
 * A writ's product, by its key: `potion:<id>` (alchemyLaw POTIONS), `dish:<id>` (recipeLaw DISHES - either herb's
 * recipe of it), or a kit's own recipe id (`kit:steel`). `{ kind, key, id, name, tier, rank, cost, bought, faction }`, or
 * null. `cost` is one make's inputs at their Marks values; `bought` the part of it only a counter sells (COUNTER_ONLY).
 * @param {unknown} key
 */
export function craftProductOf(key) {
  if (typeof key !== 'string') return null;
  const [kind, id] = key.split(':');
  if (kind === 'potion') {
    const p = WRIT_POTIONS.find((x) => x.id === id);
    if (!p) return null;
    const cost = p.ingredients.reduce((s, t) => s + (cheapestValueOf(t) ?? Infinity), 0);
    const bought = p.ingredients.filter((t) => ingredientKeys(t).every((k) => COUNTER_ONLY.includes(k))).reduce((s, t) => s + (cheapestValueOf(t) ?? 0), 0);
    return Number.isFinite(cost) ? Object.freeze({ kind, key, id, name: p.name, tier: p.tier, rank: p.rank, cost, bought, faction: CRAFT_GUILDS.potion[/** @type {keyof typeof CRAFT_GUILDS.potion} */ (id)] ?? CRAFT_GUILDS.potionDefault }) : null;
  }
  if (kind === 'dish') {
    const d = DISHES.find((x) => x.id === id);
    if (!d) return null;
    const goods = [...d.inputs.map(([k, n]) => ({ key: String(k), n: Number(n) })), ...(d.herb != null ? [{ key: `p1:${d.herb}`, n: 1 }] : [])];
    return Object.freeze({ kind, key, id, name: d.name, tier: d.tier, rank: TIER_RANKS[d.tier - 1], ...costOf(goods), faction: CRAFT_GUILDS.dish[/** @type {keyof typeof CRAFT_GUILDS.dish} */ (id)] });
  }
  if (kind === 'kit') {
    const r = WRIT_KITS.find((x) => x.id === key);
    if (!r) return null;
    return Object.freeze({ kind, key, id, name: r.name, tier: r.tier, rank: r.rank, ...costOf(r.inputs), faction: CRAFT_GUILDS.kit });
  }
  return null;
}
/** A make's `{ cost, bought }` of its inputs (`{ key, n }`): every one at its Marks value, and the counter's own apart. */
function costOf(/** @type {ReadonlyArray<{ key: string, n: number }>} */ inputs) {
  const at = (/** @type {{ key: string, n: number }} */ i) => (material(i.key)?.value ?? 0) * i.n;
  return { cost: inputs.reduce((s, i) => s + at(i), 0), bought: inputs.filter((i) => COUNTER_ONLY.includes(i.key)).reduce((s, i) => s + at(i), 0) };
}
/** A DFU ingredient template's Marks value - its cheapest Stores key's (an herb is held under either plant group). */
function cheapestValueOf(/** @type {number} */ templateIndex) {
  const vals = ingredientKeys(templateIndex).map((k) => material(k)?.value).filter((v) => Number.isFinite(v));
  return vals.length ? Math.min(.../** @type {number[]} */ (vals)) : null;
}

/** The units a writ asks of a product before its pay is fitted: potions 4 at tiers 1-2, 3 at 3-4, 2 past; dishes 3, a
 *  feast (tier 6) 1; kits 3 at tiers 1-3, 2 at 4-5, 1 past. */
export function craftWritBaseQty(/** @type {{ kind: string, tier: number }} */ p) {
  if (p.kind === 'potion') return p.tier <= 2 ? 4 : p.tier <= 4 ? 3 : 2;
  if (p.kind === 'dish') return p.tier >= 6 ? 1 : 3;
  return p.tier <= 3 ? 3 : p.tier <= 5 ? 2 : 1;
}
/** What `qty` of a product is worth: its unit cost (one make's, over a Novice's yield) - the gathered part times
 *  CRAFT_PAY_PCT, the counter's at cost (E2) - rounded up, never under the tier's floor. Uncapped: craftWritOf fits the
 *  count first. */
export const craftWorth = (/** @type {{ kind: 'potion'|'dish'|'kit', tier: number, cost: number, bought?: number }} */ p, /** @type {number} */ qty) =>
  Math.max(CRAFT_PAY_FLOOR * p.tier, Math.ceil((qty * ((p.cost - (p.bought ?? 0)) * CRAFT_PAY_PCT + (p.bought ?? 0) * 100)) / (100 * NOVICE_YIELD[p.kind])));
/** The most a writ asks of one product - the table's own CHECK (migration 0145, `qty` 1 to 20). */
export const CRAFT_WRIT_QTY_MAX = 20;
/** A crafting writ's XP: twice its pay, to the craft's track (the Court writ's law, professionLaw writXp). */
export const craftWritXp = (/** @type {number} */ pay) => 2 * pay;
/** A crafting writ's Renown XP: twice its pay at the rate (the Court writ's ratio - renown.js renownRate). */
export const craftWritRenown = (/** @type {number} */ pay) => renownRate(2 * pay);

/**
 * A WRIT FOR `qty` OF A PRODUCT: its count fitted under CRAFT_WRIT_PAY_MAX (lowered while it pays more, never below 1,
 * never above CRAFT_WRIT_QTY_MAX - AUDIT CRAFT-WRITS E6: a row past the table's CHECK was dropped by its INSERT OR IGNORE),
 * then `{ product, kind, tier, faction, qty, pay, xp, renown, track }` - the pay capped where one unit alone is worth more.
 * @param {string} key @param {number} [qty]
 */
export function craftWritOf(key, qty) {
  const p = craftProductOf(key);
  if (!p) return null;
  let n = Number.isSafeInteger(qty) && /** @type {number} */ (qty) >= 1 ? Math.min(CRAFT_WRIT_QTY_MAX, /** @type {number} */ (qty)) : craftWritBaseQty(p);
  while (n > 1 && craftWorth(/** @type {any} */ (p), n) > CRAFT_WRIT_PAY_MAX) n--;
  const pay = Math.min(CRAFT_WRIT_PAY_MAX, craftWorth(/** @type {any} */ (p), n));
  return Object.freeze({ product: p.key, kind: p.kind, tier: p.tier, faction: p.faction, qty: n, pay, xp: craftWritXp(pay), renown: craftWritRenown(pay), track: CRAFT_KINDS[/** @type {keyof typeof CRAFT_KINDS} */ (p.kind)] });
}

/** A crafting writ's id: `k:<day>:<realm id>:<slot>` - three an account a day, under the realm id of its character that
 *  read a board first that day (E1: the id's stem, never whose the writ is - it is the account's). */
export const craftWritId = (/** @type {number} */ day, /** @type {string} */ character, /** @type {number} */ slot) => `k:${day}:${character}:${slot}`;
export const CRAFT_WRIT_ID_RE = /^k:\d{1,7}:r[0-9a-f]{20}:[0-2]$/;

/** The products of a kind within reach of `rank`, nearest its top: every one at a tier its rank opens, no more than two
 *  tiers below the highest it opens (a Master is asked a Master's work, as XP quarters below that). */
export function craftWritChoices(/** @type {'potion'|'dish'|'kit'} */ kind, /** @type {number} */ rank) {
  const top = topTierOf(Math.max(0, Math.trunc(Number(rank) || 0)));
  const all = kind === 'potion' ? WRIT_POTIONS.map((p) => `potion:${p.id}`) : kind === 'dish' ? DISHES.map((d) => `dish:${d.id}`) : WRIT_KITS.map((r) => r.id);
  const open = all.map(craftProductOf).filter((p) => !!p && p.tier <= top);
  const best = Math.max(0, ...open.map((p) => /** @type {any} */ (p).tier));
  return open.filter((p) => /** @type {any} */ (p).tier >= best - 2).map((p) => /** @type {any} */ (p).key);
}

/** An account's id as the dice read it (server-account/src/accounts.js mintId - 24 of base64url). */
export const CRAFT_WRIT_SEED_RE = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * AN ACCOUNT'S CRAFTING WRITS FOR A UTC DAY: three, drawn from its own dice (keyed by the account's id, the day and the
 * slot - E1: never a character's, whose three each let an account choose among its characters' draws), within its best
 * crafter's ranks - slot 0 a potion of Provisioning's, slot 1 a dish of Provisioning's, slot 2 a Repair Kit of Smithing's
 * where one of its characters has smithed (`smithed`), else a second potion, another than slot 0's where Provisioning
 * opens another. Each `{ slot, ...craftWritOf }`; none for a seed that is no account id.
 * @param {number} day @param {unknown} account @param {{ provisioning?: number, smithing?: number, smithed?: boolean }|null} [ranks]
 */
export function craftWritsFor(day, account, ranks = {}) {
  if (!Number.isSafeInteger(day) || typeof account !== 'string' || !CRAFT_WRIT_SEED_RE.test(account)) return [];
  const { provisioning = 0, smithing = 0, smithed = false } = ranks ?? {};   // E6: a null read as none
  const id = [...account].map((ch) => ch.charCodeAt(0));
  const roll = (/** @type {number} */ slot) => gateHash(CRAFT_WRIT_SALT, day, ...id, slot) / 4294967296;
  const pick = (/** @type {string[]} */ from, /** @type {number} */ slot) => from[Math.min(from.length - 1, Math.floor(roll(slot) * from.length))];
  const potions = craftWritChoices('potion', provisioning);
  const first = pick(potions, 0);
  const third = smithed ? pick(craftWritChoices('kit', smithing), 2) : pick(potions.length > 1 ? potions.filter((k) => k !== first) : potions, 2);
  return [first, pick(craftWritChoices('dish', provisioning), 1), third]
    .map((key, slot) => ({ slot, w: craftWritOf(key) }))
    .filter((x) => !!x.w)
    .map(({ slot, w }) => ({ slot, .../** @type {any} */ (w) }));
}

/** Whether a crafted piece's recipe answers a dish or kit writ's product: a dish either herb's recipe of it, a kit its
 *  own recipe. Potions are no pieces. */
export function pieceAnswers(/** @type {string} */ product, /** @type {unknown} */ recipe) {
  const p = craftProductOf(product);
  if (!p || p.kind === 'potion' || typeof recipe !== 'string') return false;
  return p.kind === 'dish' ? recipeById(recipe)?.kind === 'dish' && recipe.startsWith(`${p.id}:`) : recipe === p.key;
}
/** A potion writ's DFU recipe key (the bottles' `potionRecipeKey`), or null. */
export const writPotionKey = (/** @type {string} */ product) => {
  const p = craftProductOf(product);
  return p?.kind === 'potion' ? potionById(p.id)?.key ?? null : null;
};

// ─── THE GOODS (a save's pack, the service's record and the client's alike) ───

/** DFU's potion bottle (loot.js POTION_TEMPLATE_INDEX - read here from the templates, the Worker bundling no loot). */
const POTION_BOTTLE = GROUP_TEMPLATE_INDICES.UselessItems1[1];
/** A record that may go to a writ: a trade's own law (realmTradeLaw tradeableRecord - never worn, a quest's, summoned or
 *  bound), and never LOCKED (AUDIT CRAFT-WRITS C3: itemLock.js - a lock keeps a piece in the pack, as a disenchant's
 *  PROF5 list keeps it). */
const mayGo = (/** @type {any} */ rec) => tradeableRecord(rec) && !isLocked(rec);
/** A potion record of `key` that may leave: a BOTTLE of its recipe (AUDIT CRAFT-WRITS E3: a recipe sheet names the potion's
 *  key too - never the potion itself) that may go. */
const bottleOf = (/** @type {any} */ rec, /** @type {number} */ key) => rec?.group === 'UselessItems1' && rec.templateIndex === POTION_BOTTLE
  && Number.isSafeInteger(rec.potionRecipeKey) && rec.potionRecipeKey === key && mayGo(rec);
/** A crafted piece's record answering a dish or kit writ, that may go. */
export const pieceOf = (/** @type {any} */ rec, /** @type {string} */ product) => typeof rec?.provenance === 'string' && mayGo(rec) && pieceAnswers(product, rec?.recipe);
/**
 * THE PACK'S OWN GOODS FOR A WRIT, the records a delivery takes: for a potion writ `qty` bottles of its recipe, the plain
 * ones before the Potent (a stack gives part of itself); for a dish or kit writ the records of `pieces` (provenance ids,
 * exactly `qty`, each once). `{ at, n }[]` - each record's index and how many of it - or null where the pack holds too few.
 * @param {any[]} items @param {{ product: string, qty: number }} w @param {unknown} [pieces]
 */
export function craftGoodsPick(items, w, pieces = null) {
  const list = Array.isArray(items) ? items : [];
  const key = writPotionKey(w.product);
  if (key != null) {
    const order = list.map((rec, at) => ({ rec, at })).filter((x) => bottleOf(x.rec, key))
      .sort((a, b) => (a.rec.potent ? 1 : 0) - (b.rec.potent ? 1 : 0) || a.at - b.at);
    const out = [];
    let left = w.qty;
    for (const { rec, at } of order) {
      if (left <= 0) break;
      const n = Math.min(left, recordCount(rec));
      out.push({ at, n });
      left -= n;
    }
    return left > 0 ? null : out;
  }
  if (!Array.isArray(pieces) || pieces.length !== w.qty || new Set(pieces).size !== pieces.length || !pieces.every((p) => typeof p === 'string' && PROVENANCE_RE.test(p))) return null;
  const out = [];
  for (const pv of pieces) {
    const at = list.findIndex((rec) => rec?.provenance === pv && pieceOf(rec, w.product));
    if (at < 0) return null;
    out.push({ at, n: 1 });
  }
  return out;
}
/** How many of a writ's goods the pack holds that may leave - bottles of its recipe, or pieces answering it (any make:
 *  the service's own record says which are this character's). */
export function craftGoodsHeld(/** @type {any[]} */ items, /** @type {{ product: string }} */ w) {
  const list = Array.isArray(items) ? items : [];
  const key = writPotionKey(w.product);
  if (key != null) return list.filter((rec) => bottleOf(rec, key)).reduce((s, rec) => s + recordCount(rec), 0);
  return list.filter((rec) => pieceOf(rec, w.product)).length;
}
/**
 * TAKE A WRIT'S GOODS OUT OF A SAVE, in place - the trade's own take (realmTradeLaw takeTradeGoods: the very records
 * picked, a stack giving part of itself, the lit torch's index following). Answers the records as they left, or null
 * where the save cannot give them (and then nothing is changed).
 * @param {any} save @param {{ product: string, qty: number }} w @param {unknown} [pieces]
 */
export function takeCraftGoods(save, w, pieces = null) {
  const items = Array.isArray(save?.items) ? save.items : null;
  if (!items) return null;
  const pick = craftGoodsPick(items, w, pieces);
  if (!pick) return null;
  const offered = pick.map(({ at, n }) => {
    const rec = JSON.parse(JSON.stringify(items[at]));
    if (items[at].stackCount !== undefined || n > 1) rec.stackCount = n;
    return rec;
  });
  return takeTradeGoods(save, { items: offered, gold: 0 }, pick.map((x) => x.at));
}

// ─── THE WORDS (the Work tab's card, the service's answers) ──────────
// In the player's language (systems/textManager.js t - the English is the catalog's); the guild by a hall writ's own name
// (npcChapterLaw.js hallPosterName) and the track by its profession's (professionLaw.js professionName).

/** "4 Potions of Restore Power", "a Potion of Healing", "3 servings of Hunter's Stew", "2 Steel Repair Kits", "one Ebony
 *  Repair Kit". */
export function craftCountText(/** @type {string} */ product, /** @type {number} */ qty) {
  const p = craftProductOf(product);
  if (!p) return String(qty);
  if (p.kind === 'potion') return t('prof.craftWrit.countPotion', '{n, plural, one {a Potion of {name}} other {# Potions of {name}}}', { n: qty, name: p.name });
  if (p.kind === 'dish') return t('prof.craftWrit.countDish', '{n, plural, one {a {name}} other {# servings of {name}}}', { n: qty, name: p.name });
  return t('prof.craftWrit.countKit', '{n, plural, one {one {name}} other {# {name}s}}', { n: qty, name: p.name });   // AUDIT CRAFT-WRITS C5: never "a Adamantium Repair Kit"
}
/** The guild's name, as a hall writ names it. */
export const craftGuildName = (/** @type {number} */ faction) => hallPosterName(faction) ?? 'guild';
/** The card's ask: "The Mages Guild asks you for 4 Potions of Restore Power". */
export const craftNeedText = (/** @type {{ product: string, qty: number, faction: number }} */ w) =>
  t('prof.craftWrit.need', 'The {guild} asks you for {count}', { guild: craftGuildName(w.faction), count: craftCountText(w.product, w.qty) });
/** What fills it, said on the card. */
export function craftMadeText(/** @type {string} */ product) {
  const p = craftProductOf(product);
  if (p?.kind === 'potion') return t('prof.craftWrit.madePotion', 'Of your own brewing - the bottles leave your pack.');
  if (p?.kind === 'dish') return t('prof.craftWrit.madeDish', 'Of your own cooking, never sold - the servings leave your pack.');
  return t('prof.craftWrit.madeKit', 'Of your own make, never sold - the kits leave your pack.');
}
/** The card's pay: "Pays 156 silver, 312 Provisioning experience, 234 Renown and standing with the Mages Guild". */
export const craftPayText = (/** @type {{ pay: number, xp: number, renown: number, faction: number, track: string }} */ w) =>
  t('prof.craftWrit.pay', 'Pays {pay, number} silver, {xp, number} {track} experience, {renown, number} Renown and standing with the {guild}',
    { pay: w.pay, xp: w.xp, track: professionName(w.track), renown: w.renown, guild: craftGuildName(w.faction) });
/** What a card says the character holds toward a writ (craftWritHost.js held): "3 brewed by you, 5 in your pack" for a
 *  potion writ, "2 of your own in your pack" for a dish or kit writ. */
export function craftHeldText(/** @type {{ kind: string }} */ w, /** @type {{ pack: number, made: number }} */ h) {
  return w.kind === 'potion'
    ? t('prof.craftWrit.heldPotion', '{made, number} brewed by you, {pack, number} in your pack', { made: h.made, pack: h.pack })
    : t('prof.craftWrit.heldPiece', '{made, number} of your own in your pack', { made: h.made });
}
/** Why Deliver waits, said on its title: what is short. */
export function craftShortText(/** @type {{ kind: string, qty: number }} */ w, /** @type {{ pack: number, made: number }} */ h) {
  if (w.kind === 'potion') {
    if (h.made < w.qty) return t('prof.craftWrit.shortBrew', 'Brew {n, number} more yourself - found or bought bottles do not count', { n: w.qty - h.made });
    return t('prof.craftWrit.shortCarry', 'Carry {n, number} more of these bottles in your pack', { n: w.qty - h.pack });
  }
  return t('prof.craftWrit.shortMake', 'Make {n, number} more yourself - pieces you bought or sold do not count', { n: w.qty - h.made });
}
/** A writ filled, said: "The Mages Guild thanks you: 156 silver, 312 Provisioning experience and 234 Renown." */
export function craftFilledText(/** @type {{ faction: number, track: string }} */ w, /** @type {any} */ d) {
  const guild = craftGuildName(w.faction);
  if (!d || !Number.isSafeInteger(d.pay)) return t('prof.craftWrit.delivered', 'Delivered to the {guild}.', { guild });   // a realm act that landed, its answer lost
  return t('prof.craftWrit.filled', 'The {guild} thanks you: {pay, number} silver, {xp, number} {track} experience and {renown, number} Renown.',
    { guild, pay: d.pay, xp: Number(d.xp ?? 0), track: professionName(w.track), renown: Number(d.renown?.credited ?? 0) });
}
