// @ts-check
// CARDS9 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 28; Mac: "Lets build every inch of this. Dont forget
// about a card needing to come from the abyss dungeon also"): WHERE CARDS COME FROM. Section 6.3's list, built:
//
//   FOES      "A slain creature can drop its own card (a rare draw). A rat drops a rat." - FOE_CARDS names the card each
//             of Daggerfall's creatures (and the callings that wear a guild's colours) is; at its death one draw at its
//             card's tier's chance (FOE_CARD_PER_MILLE, MEASURE), twice it for a titled foe. A death handler
//             (scenes/corpseMarker.js raiseEnemyDeath), so every host's body door finds it; the cap keeps it as a Magic
//             piece (systems/foeLootCap.js capRank - a card found is never thrown away for a common blade).
//   PACKS     "Tavern keepers sell packs (five cards, one rare or better)" - CARD_PACK_SIZE cards, the last of them rare
//             or better, from every card a pack may hold (PACK_POOL: never a holding, never a boss's own). The pack is an
//             item (systems/iliacItems.js CARD_PACK_TEMPLATE); its Use opens it into the pack. Sold at the tavern's
//             counter and at its card table, at the counter's price (shopStock.js calculateTradePrice - the tavern's
//             quality, the buyer's Mercantile and Personality). "No paid packs": its price is gold earned in the game.
//   QUESTS    "A guild's quest can pay a card of that guild" - a guild quest done pays one of its guild's cards one time in
//             GUILD_CARD_PER_MILLE, rising with the player's rank in it (GUILD_CARDS).
//   BOSSES    "the Oblivion Gate's boss and the Sea Serpent can drop their own, at the aetheric tier" - and the Abyss
//             Dungeon's Brass Remnant (Mac, the same ask). Each boss's hoard draws once for its card, LAST, after every
//             draw the hoard took before (the seed's earlier rolls are what they were): BOSS_CARD_PER_MILLE.
//   WINNING   "A tavern regular who loses to you can pay in a card from his deck" - systems/iliacPatrons.js forfeitCard,
//             the table's (scenes/worldModes.js).
//   TRADING   the trade and the market already take a card as any unbound item (AUDIT CARDS-5 C2); CARDS9 gave it its
//             worth (net/cardWorthLaw.js) and its customs (systems/realmCustoms.js, the service's first save).
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { ILIAC_CARDS, cardById } from '../net/iliacCards.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';
import { DIVINES, ORDERS } from './guildVariants.js';
import { mintIliacCard, mintCardPack, isCardPack, CARD_PACK_TEMPLATE, iliacCardName } from './iliacItems.js';
import { registerItemUseHandler } from './itemTemplates.js';
import { addItem } from './inventory.js';
import { registerEnemyDeathHandler } from '../scenes/corpseMarker.js';
import { calculateTradePrice } from './shopStock.js';
import { totalGoldAmount, deductGold } from './court.js';

// ── THE BOSSES' OWN ───────────────────────────────────────────────────────────────────────────────────────────────

// The bosses' own cards live in systems/bossCards.js (the hoards import it; this module would close a cycle round them).
export { BOSS_CARDS, BOSS_CARD_IDS, BOSS_CARD_PER_MILLE, bossCardRoll } from './bossCards.js';
import { BOSS_CARD_IDS } from './bossCards.js';

// ── THE FOES ──────────────────────────────────────────────────────────────────────────────────────────────────────

const M = MOBILE_TYPES;
/** Each foe's own card, by its mobile type: a creature its own, a calling the guild card it wears. A foe the first set
 *  has no card for (a bear, a spider, a mummy, the Frost and Fire Daedra, the watch) drops none. */
export const FOE_CARDS = Object.freeze({
  [M.Rat]: 'rat', [M.Imp]: 'imp', [M.Spriggan]: 'spriggan', [M.GiantBat]: 'giant-bat', [M.Orc]: 'orc', [M.Centaur]: 'centaur',
  [M.Werewolf]: 'werewolf', [M.Nymph]: 'nymph', [M.OrcSergeant]: 'orc-sergeant', [M.Harpy]: 'harpy', [M.Wereboar]: 'wereboar',
  [M.SkeletalWarrior]: 'skeletal-warrior', [M.Giant]: 'giant', [M.Zombie]: 'zombie', [M.Ghost]: 'ghost',
  [M.GiantScorpion]: 'giant-scorpion', [M.OrcShaman]: 'orc-shaman', [M.Gargoyle]: 'gargoyle', [M.Wraith]: 'wraith',
  [M.OrcWarlord]: 'orc-warlord', [M.Daedroth]: 'daedroth', [M.Vampire]: 'vampire', [M.DaedraSeducer]: 'daedra-seducer',
  [M.VampireAncient]: 'ancient-vampire', [M.DaedraLord]: 'daedra-lord', [M.Lich]: 'lich', [M.AncientLich]: 'ancient-lich',
  [M.Dragonling]: 'dragonling', [M.Dragonling_Alternate]: 'dragonling', [M.FireAtronach]: 'fire-atronach',
  [M.IronAtronach]: 'iron-atronach', [M.FleshAtronach]: 'flesh-atronach', [M.IceAtronach]: 'ice-atronach',
  [M.Dreugh]: 'dreugh', [M.Lamia]: 'lamia',
  // the callings - the guild card each one's work is
  [M.Mage]: 'mages-guild-apprentice', [M.Battlemage]: 'mages-guild-battlemage', [M.Sorcerer]: 'mages-guild-battlemage',
  [M.Healer]: 'priest-of-arkay', [M.Nightblade]: 'nightblade', [M.Burglar]: 'thieves-guild-filcher', [M.Thief]: 'thieves-guild-filcher',
  [M.Rogue]: 'thieves-guild-crook', [M.Assassin]: 'dark-brotherhood-assassin', [M.Warrior]: 'fighters-guild-swordsman',
  [M.Barbarian]: 'fighters-guild-swordsman', [M.Knight]: 'knight-of-the-wheel', [M.Spellsword]: 'knight-of-the-dragon',
});
/** MEASURE (CARDS9): a foe's card, per mille of its deaths, by its card's tier - about one rat in sixty, one Ancient
 *  Lich in three hundred. */
export const FOE_CARD_PER_MILLE = Object.freeze({ common: 16, magic: 11, rare: 7, legendary: 3 });
/** A titled foe (an elite, a champion, a named one) drops its card this many times as often. */
export const TITLED_FOE_CARD_MULT = 2;
/** Whether a body is a titled foe's (systems/foeLootCap.js's titles, read off the entity's own flags). */
const titled = (/** @type {any} */ e) => !!(e?.eliteFoe || e?.champion || e?.properName);
/**
 * A foe's card at its death: ONE draw, the card's id when it lands - or null (no card for its kind, a revenant's or a
 * world boss's body - their own spoils speak for them).
 * @param {any} entity @param {() => number} rolls
 */
export function foeCardRoll(entity, rolls) {
  if (!entity || entity.revenant || entity.worldBoss) return null;
  const id = FOE_CARDS[entity.mobileType];
  const card = id ? cardById(id) : null;
  if (!card) return null;
  const chance = (FOE_CARD_PER_MILLE[card.tier] ?? 0) * (titled(entity) ? TITLED_FOE_CARD_MULT : 1);
  return rolls() * 1000 < chance ? id : null;
}
/** The death handler's name (corpseMarker.js registerEnemyDeathHandler). */
export const CARD_DROP_HANDLER = 'iliac-card';
/** A foe's card onto its body at its death - the death handler (registered at this module's end). Answers the card. */
export function dropFoeCard(/** @type {any} */ entity, /** @type {any} */ opts = {}) {
  if (!Array.isArray(entity?.items)) return null;
  const id = foeCardRoll(entity, opts.rolls ?? Math.random);
  const card = id ? mintIliacCard(id) : null;
  if (card) entity.items.push(card);
  return card;
}

// ── THE GUILDS' QUESTS ────────────────────────────────────────────────────────────────────────────────────────────

/** Each guild's cards by the rank they come at (the lowest rank first): a guild quest pays the best its quester's rank
 *  reaches. Keyed by the guild's membership name (systems/guilds.js GUILDS, guildVariants.js templeOf / orderOf). */
export const GUILD_CARDS = Object.freeze({
  MagesGuild: [[0, 'mages-guild-apprentice'], [4, 'mages-guild-battlemage'], [7, 'mages-guild-archmage']],
  FightersGuild: [[0, 'fighters-guild-swordsman'], [7, 'fighters-guild-champion']],
  ThievesGuild: [[0, 'thieves-guild-filcher'], [5, 'thieves-guild-crook']],
  DarkBrotherhood: [[0, 'nightblade'], [6, 'dark-brotherhood-assassin']],
  'Temple:Akatosh': [[0, 'priest-of-akatosh']], 'Temple:Arkay': [[0, 'priest-of-arkay']], 'Temple:Dibella': [[0, 'priest-of-dibella']],
  'Temple:Julianos': [[0, 'priest-of-julianos']], 'Temple:Kynareth': [[0, 'priest-of-kynareth']], 'Temple:Mara': [[0, 'priest-of-mara']],
  'Temple:Stendarr': [[0, 'priest-of-stendarr']], 'Temple:Zenithar': [[0, 'priest-of-zenithar']],
  'Order:Dragon': [[0, 'knight-of-the-dragon']], 'Order:Wheel': [[0, 'knight-of-the-wheel']], 'Order:Horn': [[0, 'host-of-the-horn']],
  'Order:Rose': [[0, 'knight-of-the-rose']], 'Order:Flame': [[0, 'knight-of-the-flame']],
});
/** The guild a quest's faction id names (the quest machine's `factionId` - the guild's, a temple's divine, an order's). */
export function guildNameOfFaction(/** @type {number} */ factionId) {
  const fixed = { 40: 'MagesGuild', 41: 'FightersGuild', 42: 'ThievesGuild', 108: 'DarkBrotherhood' }[factionId];
  if (fixed) return fixed;
  const divine = Object.entries(DIVINES).find(([, id]) => id === factionId)?.[0];
  if (divine) return `Temple:${divine}`;
  const order = Object.entries(ORDERS).find(([, id]) => id === factionId)?.[0];
  return order ? `Order:${order}` : null;
}
/** MEASURE (CARDS9): a guild quest done pays a card one time in three. */
export const GUILD_CARD_PER_MILLE = 334;
/**
 * A guild quest's card: ONE draw for whether it pays, the best of its guild's cards the quester's `rank` reaches - an id,
 * or null (no guild, a guild with no card, the draw missed).
 * @param {number} factionId @param {number} rank @param {() => number} rolls
 */
export function guildCardRoll(factionId, rank, rolls) {
  const ladder = GUILD_CARDS[guildNameOfFaction(factionId) ?? ''];
  if (!ladder) return null;
  if (!(rolls() * 1000 < GUILD_CARD_PER_MILLE)) return null;
  const r = Number.isInteger(rank) ? rank : 0;
  let id = ladder[0][1];
  for (const [at, card] of ladder) if (r >= at) id = card;
  return id;
}

// ── THE PACKS ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A pack's cards, the last of them rare or better. */
export const CARD_PACK_SIZE = 5;
/** Every card a pack may hold, by tier: never a holding (the game deals those), never a boss's own. */
export const PACK_POOL = Object.freeze(Object.fromEntries(['common', 'magic', 'rare', 'legendary', 'aetheric', 'artifact'].map((t) => [t,
  Object.freeze(ILIAC_CARDS.filter((c) => c.tier === t && !BOSS_CARD_IDS.includes(c.id)).map((c) => c.id))])));
/** MEASURE (CARDS9): a pack's first four - a common or a magic - and its last, rare or better, per mille by tier. */
export const PACK_SLOT_TIERS = Object.freeze({ common: 720, magic: 280 });
export const PACK_TOP_TIERS = Object.freeze({ rare: 850, legendary: 130, aetheric: 15, artifact: 5 });
/** A tier drawn by its per-mille table (the table's own order; the last takes what is left). */
function tierOf(table, r) {
  let acc = 0;
  const entries = Object.entries(table);
  for (const [t, w] of entries) { acc += w; if (r * 1000 < acc) return t; }
  return entries[entries.length - 1][0];
}
/**
 * A PACK OPENED: CARD_PACK_SIZE catalog ids, two draws a card (its tier, then which), the last rare or better.
 * @param {() => number} rolls
 * @returns {string[]}
 */
export function rollPackCards(rolls) {
  const out = [];
  for (let k = 0; k < CARD_PACK_SIZE; k++) {
    const tier = tierOf(k === CARD_PACK_SIZE - 1 ? PACK_TOP_TIERS : PACK_SLOT_TIERS, rolls());
    const pool = PACK_POOL[tier];
    out.push(pool[Math.min(pool.length - 1, Math.floor(rolls() * pool.length))]);
  }
  return out;
}
/** MEASURE (CARDS9): a pack's price before the counter's haggle (the tavern's quality, the buyer's Mercantile and
 *  Personality - DFU's own CalculateTradePrice, as a room's is). */
export const CARD_PACK_BASE_PRICE = 40;
/** A pack's price at a counter of `quality` for `skills` ({mercantile, personality}). */
export const cardPackPrice = (/** @type {number} */ quality, /** @type {any} */ skills = {}, opts = undefined) => Math.max(1, calculateTradePrice(CARD_PACK_BASE_PRICE, quality, skills, false, opts));
/**
 * A PACK BOUGHT: its price taken from the purse (coins, then letters - DFU's deductGold) and the pack put in the pack.
 * Answers `{ ok: true, price }`, or `{ ok: false, price, why: 'gold' }` with nothing moved.
 * @param {any} entity @param {{quality: number, skills?: any, online?: boolean}} at
 */
export function buyCardPack(entity, { quality, skills = {}, online = undefined }) {
  const price = cardPackPrice(quality, skills, online === undefined ? undefined : { online });
  if (!entity || totalGoldAmount(entity) < price) return { ok: false, price, why: 'gold' };
  deductGold(entity, price);
  if (!Array.isArray(entity.items)) entity.items = [];
  addItem(entity.items, mintCardPack());
  return { ok: true, price };
}
/** The words a pack opened says: what came out of it. */
export const packOpenedText = (/** @type {string[]} */ ids) => `You open the pack: ${ids.map((id) => iliacCardName({ card: id }).replace(/^Card: /, '')).join(', ')}.`;
/**
 * A PACK'S USE (itemTemplates.js registerItemUseHandler): one pack off its stack, its five cards into the list it came
 * from - the words say which. The draw is the use's own source.
 */
export function openCardPack(/** @type {any} */ item, /** @type {any[]} */ collection, { rolls = Math.random } = {}) {
  if (!isCardPack(item) || !Array.isArray(collection)) return null;
  const at = collection.indexOf(item);
  if (at < 0) return null;
  if ((item.stackCount ?? 1) > 1) item.stackCount -= 1; else collection.splice(at, 1);
  const ids = rollPackCards(rolls);
  for (const id of ids) { const c = mintIliacCard(id); if (c) addItem(collection, c); }
  return { kind: 'cardpack', ids, text: packOpenedText(ids) };
}
// AT THIS MODULE'S END, ITS IMPORTS ALL EVALUATED: the pack's Use, and a foe's card at every body door. The app carries
// the import from systems/worldTick.js (the shared clock every host mounts - AUDIT-THUNDERLOCK F1's wire); a module-level
// call from worldTick would run inside an import cycle (court.js and shopStock.js reach worldTick) before this body did.
registerItemUseHandler(CARD_PACK_TEMPLATE, (item, collection, opts = {}) => openCardPack(item, collection, { rolls: opts.rolls ?? Math.random }));
registerEnemyDeathHandler(CARD_DROP_HANDLER, (entity, opts = {}) => { dropFoeCard(entity, opts); });
