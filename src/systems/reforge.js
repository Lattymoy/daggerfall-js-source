// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LOOT9 (2026-10-01) — SALVAGE, AND THE REFORGE.
//
// The Loot arc (bible/06-Systems/Loot-Arc.md section 11; Mac: "Do you
// wanna turn this into an arc and do all of the above?" - "Salvage and
// reroll: break unwanted Magic+ items into a crafting material ... spend
// it at the Mages Guild to reroll one affix"). Three things, each a law
// here and a face elsewhere:
//
//   - THE WELKYND SHARD (systems/gateSpoils.js, template 571 beside the
//     Sigil Stone): a sliver of Ayleid magicka-crystal, stacking and BOUND
//     (itemBound.js: never sold, traded, dropped or listed), the
//     Reforge's only coin.
//   - SALVAGE: a laddered piece broken into shards - a Magic 1, a Rare 3,
//     a Legendary 8, an Exalted 15. Never an Aetheric piece (the Broker's
//     dismantle is its), an artifact, a quest's item, a bound, worn or
//     locked one - and never a piece the ladder did not grade (DFU's own
//     magic items, a made one), so shards come from what was FOUND.
//   - THE REFORGE: one line of a known Magic or Rare piece - or an
//     Exalted Legendary's own extra line - rolled again
//     (lootRarity.js reforgeAffix), for shards and gold; once a piece is
//     reforged, only that line again.
//   - LOOT17 (the Loot arc II, bible/06-Systems/Loot-II-Arc.md section 9):
//     THE HONE - a line taken up its own band, never lower (lootRarity.js
//     honeAffix), the price doubling with every hone on the piece.
//   - LOOT20 (section 12): THE SOCKETS - a gem from the pack set in a
//     piece's empty socket (lootRarity.js setGem), and unset, the gem
//     shattering. GEM1 (bible/06-Systems/Gem-Sockets.md section 3): free,
//     in any of a piece's sockets, worn or not - and the Reforge's own
//     press, the EXTRACTION: the gem out whole, for gold by its grade.
//
// The window (ui/reforgeWindow.js) and the pack card's Salvage button
// (ui/enhancedInventory.js) draw and ask; everything they do is here.
// OFF IS DFU EXACTLY: with the loot-rarity row off nothing salvages and
// nothing is reforged.
// ═══════════════════════════════════════════════════════════════════

import { lootRarityOn, reforgeableLines, reforgeAffix, honeableLines, honeAffix, affixBand } from './lootRarity.js';   // LOOT17: and the hone
import { ALL_GEM_IDS, SOCKET_EMPTY, gemKindOf, gemGrade, hasSocket, socketsOf, socketGem, socketGems, setGem, unsetGem } from './lootRarity.js';   // LOOT20: the sockets; GEM1: a list of them, every grade of gem
import { mintGem } from './gems.js';   // GEM1: an extracted gem, whole again
import { welkyndShards, isWelkyndShard, WELKYND_SHARD } from './gateSpoils.js';
import { isBound } from './itemBound.js';
import { isLocked } from './itemLock.js';
import { isEquipped, notifyEquipChange } from './equip.js';   // GEM1: a worn piece's wearer folded again
import { addItem, isEnchanted } from './inventory.js';   // AUDIT GEM: an enchanted gem is no loose stone
import { totalGoldAmount, deductGold } from './court.js';
import { itemIsIdentified } from './tradeModes.js';

/** What a piece salvages into, by its tier (an Exalted Legendary its own). */
export const SALVAGE_SHARDS = Object.freeze({ magic: 1, rare: 3, legendary: 8, exalted: 15 });
/** The shards a piece salvages into - 0 for one the ladder never graded (Common, DFU's own magic), a made piece (AUDIT
 *  LOOT F2: a Superior or a Masterwork carries the ladder's `rarity` too - its quality's roll, smithItems.js mintPiece -
 *  and broke for shards, a bench turning ore into the Reforge's coin; its `provenance` says it was made), an Aetheric
 *  piece and an artifact. */
export function salvageShards(item) {
  if (typeof item?.provenance === 'string') return 0;
  const t = item?.rarity;
  if (t === 'legendary') return item.exalted === true ? SALVAGE_SHARDS.exalted : SALVAGE_SHARDS.legendary;
  return t === 'magic' || t === 'rare' ? SALVAGE_SHARDS[t] : 0;
}
/** Why a piece may not be salvaged, or null: 'off', 'aetheric', 'gilded', 'artifact', 'quest', 'not' (nothing to salvage),
 *  'bound', 'worn', 'locked'. */
export function salvageRefusal(item) {
  if (!lootRarityOn()) return 'off';
  if (!item) return 'not';
  if (item.rarity === 'aetheric') return 'aetheric';
  if (item.rarity === 'gilded') return 'gilded';   // GILDED1: a static roll is never broken down
  if (item.artifact || item.rarity === 'artifact') return 'artifact';
  if (item.questItem) return 'quest';
  if (socketGems(item).length) return 'gems';   // AUDIT GEM: a set gem is never broken with its piece - extracted or unset first (a Magic weapon holds one since GEM1, and the bulk salvage swept it)
  if (!salvageShards(item)) return 'not';
  if (isBound(item)) return 'bound';
  if (isEquipped(item)) return 'worn';
  if (isLocked(item)) return 'locked';
  return null;
}
/** SALVAGE, MADE, on a pack (`items`, the list itself): the piece out, its shards in (joining the pack's unlocked
 *  stack) - all of it or none of it. Answers `{ ok: true, shards }` or `{ ok: false, reason }` (salvageRefusal's,
 *  or 'gone' for a piece not in the pack). */
export function salvagePiece(item, { items }) {
  if (!Array.isArray(items) || !items.includes(item)) return { ok: false, reason: 'gone' };
  const why = salvageRefusal(item);
  if (why) return { ok: false, reason: why };
  const shards = salvageShards(item);
  items.splice(items.indexOf(item), 1);
  addItem(items, welkyndShards(shards));
  return { ok: true, shards };
}

// ── the purse ───────────────────────────────────────────────────────
/** A shard the purse may draw on: unlocked (a locked stack is the player's word to keep it) and not WORN - a shard is a
 *  gem, a crystal a slot takes, and AUDIT PORTAL1 I1 found a worn one spent: the equip table kept a record the pack no
 *  longer held, a ghost on the doll (save.js's bare-splice law). */
const spendable = (it) => isWelkyndShard(it) && !isLocked(it) && !isEquipped(it);
/** The shards a pack may spend: every spendable stack's count. */
export const shardsHeld = (items) => (Array.isArray(items) ? items : []).reduce((n, it) => n + (spendable(it) ? (it.stackCount ?? 1) : 0), 0);
/** Spend `n` shards off a pack's spendable stacks, emptied stacks out of it. Answers whether it could (nothing taken when
 *  it could not). */
export function spendShards(items, n) {
  if (!(n > 0)) return true;
  if (shardsHeld(items) < n) return false;
  let owed = n;
  for (let i = items.length - 1; i >= 0 && owed > 0; i--) {
    const it = items[i];
    if (!spendable(it)) continue;
    const have = it.stackCount ?? 1;
    if (have <= owed) { items.splice(i, 1); owed -= have; } else { it.stackCount = have - owed; owed = 0; }
  }
  return true;
}
/** "1 Welkynd Shard", "3 Welkynd Shards". */
export const shardsText = (n) => `${n} ${WELKYND_SHARD.name}${n === 1 ? '' : 's'}`;

// ── the Reforge ─────────────────────────────────────────────────────
/** What a reforge costs, by the piece's tier: shards and gold. */
export const REFORGE_PRICE = Object.freeze({
  magic: Object.freeze({ shards: 2, gold: 100 }),
  rare: Object.freeze({ shards: 4, gold: 400 }),
  exalted: Object.freeze({ shards: 10, gold: 2000 }),
});
/** A piece's price, or null for one the Reforge does not take. */
export function reforgePrice(item) {
  if (item?.rarity === 'magic' || item?.rarity === 'rare') return REFORGE_PRICE[item.rarity];
  if (item?.rarity === 'legendary' && item.exalted === true) return REFORGE_PRICE.exalted;
  return null;
}
/** Why a line of a piece may not be reforged now, or null: 'off', 'not' (no tier the Reforge takes, or no line it may
 *  roll), 'unknown' (not yet identified), 'worn', 'line' (a line it may not take - a record's, or not the line the
 *  piece was reforged on), 'shards', 'gold'. `player` is the payer: `{ items, goldPieces }`. */
export function reforgeRefusal(item, index, player) {
  if (!lootRarityOn()) return 'off';
  const price = reforgePrice(item);
  const lines = reforgeableLines(item);
  if (!price || !lines.length) return 'not';
  if (!itemIsIdentified(item)) return 'unknown';
  if (isEquipped(item)) return 'worn';
  if (!lines.includes(index)) return 'line';
  if (shardsHeld(player?.items) < price.shards) return 'shards';
  if (totalGoldAmount(player) < price.gold) return 'gold';
  return null;
}
// ── LOOT17: the hone ────────────────────────────────────────────────
/** What a piece's first hone costs, by its tier - doubled for every hone it has taken (`honed`), so a Perfect Rare is a
 *  chase with a price. */
export const HONE_PRICE = Object.freeze({
  magic: Object.freeze({ shards: 1, gold: 50 }),
  rare: Object.freeze({ shards: 2, gold: 150 }),
  exalted: Object.freeze({ shards: 4, gold: 500 }),
});
/** A piece's next hone's price, or null for one the hone does not take. */
export function honePrice(item) {
  const base = item?.rarity === 'magic' || item?.rarity === 'rare' ? HONE_PRICE[item.rarity]
    : item?.rarity === 'legendary' && item.exalted === true ? HONE_PRICE.exalted : null;
  if (!base) return null;
  const twice = 2 ** Math.max(0, item.honed | 0);
  return { shards: base.shards * twice, gold: base.gold * twice };
}
/** Why a line of a piece may not be honed now, or null: 'off', 'not' (no tier the hone takes), 'unknown', 'worn', 'top'
 *  (the line stands at its band's top), 'line' (no roll made it - a record's), 'shards', 'gold'. */
export function honeRefusal(item, index, player) {
  if (!lootRarityOn()) return 'off';
  const price = honePrice(item);
  if (!price) return 'not';
  const known = itemIsIdentified(item);
  if (!known) return 'unknown';
  if (isEquipped(item)) return 'worn';
  if (!honeableLines(item).includes(index)) return affixBand(item, index) ? 'top' : 'line';
  const purse = { shards: shardsHeld(player?.items), gold: totalGoldAmount(player) };
  if (purse.shards < price.shards) return 'shards';
  if (purse.gold < price.gold) return 'gold';
  return null;
}
/** THE HONE, MADE: paid at the price before it (the shards, then the gold), the line taken up its band. Answers
 *  `{ ok: true, line, price }` or `{ ok: false, reason }` with nothing taken. */
export function honePiece(item, index, player, rolls = Math.random) {
  if (!player || !Array.isArray(player.items) || !player.items.includes(item)) return { ok: false, reason: 'gone' };
  const why = honeRefusal(item, index, player);
  if (why) return { ok: false, reason: why };
  const price = /** @type {{ shards: number, gold: number }} */ (honePrice(item));
  const line = honeAffix(item, index, rolls);
  if (!line) return { ok: false, reason: 'not' };
  const { shards, gold } = price;
  spendShards(player.items, shards);
  deductGold(player, gold);
  return { ok: true, line, price };
}
// ── LOOT20: the sockets ──────────────────────────────────────────────
/** GEM1 (bible/06-Systems/Gem-Sockets.md section 3): SETTING IS FREE - the gem is the price, in the pack or at the
 *  Reforge alike (LOOT20 charged the guild's 100 gold, when the guild was the only door). What the Reforge alone does is
 *  EXTRACT: a set gem out whole, for gold by its grade. */
export const EXTRACT_PRICE = Object.freeze({ chipped: 50, flawed: 100, plain: 200, flawless: 400, perfect: 800 });
/** A gem item the setting may take: of its kind, unlocked and not worn - the shards' own law (a gem is a jewel a slot
 *  takes too) - and never a quest's (AUDIT LOOT II B1: a quest's ruby is the one its giver waits for, `toting _item_`;
 *  set in a socket it was gone and the quest could never close, where the Salvage page refuses a quest's piece). */
const looseGem = (it, gem) => gemKindOf(it) === gem && !it.questItem && !isLocked(it) && !isEquipped(it) && !isEnchanted(it);   // AUDIT GEM: never one the item maker enchanted (its powers would go into the socket and be lost)
/** The pack's loose gems, by id: `{ ruby: 2, 'flawless-ruby': 1, ... }` - every gem, DFU's and the graded (GEM2). */
export const gemsHeld = (items) => Object.fromEntries(ALL_GEM_IDS.map((g) => [g, (Array.isArray(items) ? items : []).reduce((n, it) => n + (looseGem(it, g) ? (it.stackCount ?? 1) : 0), 0)]));
/** Take one loose gem of a kind out of a pack (a stack shrinks, a last one goes). Answers whether it could. AUDIT GEM:
 *  `prefer` - the record the player pressed (a gem card's "Set in..."), taken first when it is a loose one of the kind. */
export function takeGem(items, gem, prefer = null) {
  const at = prefer && looseGem(prefer, gem) ? items.indexOf(prefer) : -1;
  if (at >= 0) { if ((prefer.stackCount ?? 1) > 1) prefer.stackCount -= 1; else items.splice(at, 1); return true; }
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (!looseGem(it, gem)) continue;
    if ((it.stackCount ?? 1) > 1) it.stackCount -= 1; else items.splice(i, 1);
    return true;
  }
  return false;
}
/** What every socket press asks of a piece first, or null: 'off', 'not' (no socket), 'unknown'. GEM1: a WORN piece is
 *  filled where it is worn - the press runs the wearer's fold again (refold) - where LOOT20 asked it taken off. */
function socketWork(item) {
  if (!lootRarityOn()) return 'off';
  if (!hasSocket(item)) return 'not';
  return !itemIsIdentified(item) ? 'unknown' : null;
}
/** A worn piece's lines moved: the wearer's folds run again at once (equip.js's listeners - the save's own seam). */
const refold = (item, player) => { if (isEquipped(item)) notifyEquipChange(player); };
/** Why a gem may not be set in a piece's socket `at` (the first empty one when omitted) now, or null: socketWork's,
 *  'set' (no empty socket there - unset it first), 'nogem' (none of that gem loose in the pack). */
export function setGemRefusal(item, gem, player, at = null) {
  const work = socketWork(item);
  if (work) return work;
  const list = socketsOf(item);
  if (list[at == null ? list.indexOf(SOCKET_EMPTY) : at] !== SOCKET_EMPTY) return 'set';
  if (!ALL_GEM_IDS.includes(gem) || !(gemsHeld(player?.items)[gem] > 0)) return 'nogem';
  return null;
}
/** THE SETTING, MADE: the gem out of the pack, its line on the piece (a worn one's wearer folded again). Answers
 *  `{ ok: true, line }` or `{ ok: false, reason }` with nothing taken. */
export function setGemPiece(item, gem, player, at = null, { from = null } = {}) {
  if (!player || !Array.isArray(player.items) || !player.items.includes(item)) return { ok: false, reason: 'gone' };
  const why = setGemRefusal(item, gem, player, at);
  if (why) return { ok: false, reason: why };
  takeGem(player.items, gem, from);   // AUDIT GEM: the pressed stone first
  const line = setGem(item, gem, at);
  refold(item, player);
  return { ok: true, line };
}
/** Why a piece's gem in socket `at` (the first set one when omitted) may not be unset now, or null: socketWork's,
 *  'empty' (no gem there). Unsetting is free - and the gem shatters. */
export function unsetGemRefusal(item, at = null) {
  return socketWork(item) ?? (socketGem(item, at) ? null : 'empty');
}
/** THE UNSETTING, MADE: the gem's line gone, the socket empty, the gem shattered. Answers `{ ok: true, gem }` or
 *  `{ ok: false, reason }`. */
export function unsetGemPiece(item, player, at = null) {
  if (!player || !Array.isArray(player.items) || !player.items.includes(item)) return { ok: false, reason: 'gone' };
  const why = unsetGemRefusal(item, at);
  if (why) return { ok: false, reason: why };
  const gem = unsetGem(item, at);
  refold(item, player);
  return { ok: true, gem };
}
/** What extracting a set gem costs - its grade's EXTRACT_PRICE - or null for an empty socket. */
export const extractPrice = (item, at = null) => { const g = socketGem(item, at); return g ? EXTRACT_PRICE[gemGrade(g) ?? 'plain'] : null; };
/** Why a piece's gem may not be EXTRACTED whole now, or null: unsetGemRefusal's, 'gold'. */
export function extractGemRefusal(item, player, at = null) {
  return unsetGemRefusal(item, at) ?? (totalGoldAmount(player) < (extractPrice(item, at) ?? 0) ? 'gold' : null);
}
/** THE EXTRACTION, MADE (the Reforge's): the gold paid, the gem out WHOLE into the pack, the socket empty. Answers
 *  `{ ok: true, gem, price }` or `{ ok: false, reason }` with nothing taken. */
export function extractGemPiece(item, player, at = null) {
  if (!player || !Array.isArray(player.items) || !player.items.includes(item)) return { ok: false, reason: 'gone' };
  const why = extractGemRefusal(item, player, at);
  if (why) return { ok: false, reason: why };
  const price = /** @type {number} */ (extractPrice(item, at));
  const gem = /** @type {string} */ (unsetGem(item, at));
  deductGold(player, price);
  addItem(player.items, /** @type {any} */ (mintGem(gem)));
  refold(item, player);
  return { ok: true, gem, price };
}
/** THE REFORGE, MADE: paid (the shards, then the gold - DFU's purse-then-letters law), the line rolled again. Answers
 *  `{ ok: true, line, price }` or `{ ok: false, reason }` with nothing taken. */
export function reforgePiece(item, index, player, rolls = Math.random) {
  if (!player || !Array.isArray(player.items) || !player.items.includes(item)) return { ok: false, reason: 'gone' };
  const why = reforgeRefusal(item, index, player);
  if (why) return { ok: false, reason: why };
  const price = /** @type {{ shards: number, gold: number }} */ (reforgePrice(item));
  const before = { affixes: item.affixes, name: item.name, value: item.value, reforged: item.reforged };
  const line = reforgeAffix(item, index, rolls);
  if (!line) { Object.assign(item, before); if (before.reforged === undefined) delete item.reforged; return { ok: false, reason: 'not' }; }
  spendShards(player.items, price.shards);
  deductGold(player, price.gold);
  return { ok: true, line, price };
}
