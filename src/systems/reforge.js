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
//   - LOOT20 (section 12): THE SOCKETS - one of DFU's eight gems from the
//     pack set in a piece's empty socket for gold (lootRarity.js setGem),
//     and unset, the gem shattering.
//
// The window (ui/reforgeWindow.js) and the pack card's Salvage button
// (ui/enhancedInventory.js) draw and ask; everything they do is here.
// OFF IS DFU EXACTLY: with the loot-rarity row off nothing salvages and
// nothing is reforged.
// ═══════════════════════════════════════════════════════════════════

import { lootRarityOn, reforgeableLines, reforgeAffix, honeableLines, honeAffix, affixBand } from './lootRarity.js';   // LOOT17: and the hone
import { GEM_IDS, gemKindOf, hasSocket, socketGem, setGem, unsetGem } from './lootRarity.js';   // LOOT20: the sockets
import { welkyndShards, isWelkyndShard, WELKYND_SHARD } from './gateSpoils.js';
import { isBound } from './itemBound.js';
import { isLocked } from './itemLock.js';
import { isEquipped } from './equip.js';
import { addItem } from './inventory.js';
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
/** Why a piece may not be salvaged, or null: 'off', 'aetheric', 'artifact', 'quest', 'not' (nothing to salvage),
 *  'bound', 'worn', 'locked'. */
export function salvageRefusal(item) {
  if (!lootRarityOn()) return 'off';
  if (!item) return 'not';
  if (item.rarity === 'aetheric') return 'aetheric';
  if (item.artifact || item.rarity === 'artifact') return 'artifact';
  if (item.questItem) return 'quest';
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
/** What setting a gem costs, the gem besides. */
export const SET_GEM_PRICE = 100;
/** A gem item the setting may take: of its kind, unlocked and not worn - the shards' own law (a gem is a jewel a slot
 *  takes too) - and never a quest's (AUDIT LOOT II B1: a quest's ruby is the one its giver waits for, `toting _item_`;
 *  set in a socket it was gone and the quest could never close, where the Salvage page refuses a quest's piece). */
const looseGem = (it, gem) => gemKindOf(it) === gem && !it.questItem && !isLocked(it) && !isEquipped(it);
/** The pack's loose gems, by kind: `{ ruby: 2, ... }`. */
export const gemsHeld = (items) => Object.fromEntries(GEM_IDS.map((g) => [g, (Array.isArray(items) ? items : []).reduce((n, it) => n + (looseGem(it, g) ? (it.stackCount ?? 1) : 0), 0)]));
/** Take one loose gem of a kind out of a pack (a stack shrinks, a last one goes). Answers whether it could. */
export function takeGem(items, gem) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (!looseGem(it, gem)) continue;
    if ((it.stackCount ?? 1) > 1) it.stackCount -= 1; else items.splice(i, 1);
    return true;
  }
  return false;
}
/** What either socket press asks of a piece first, or null: 'off', 'not' (no socket), 'unknown', 'worn'. */
function socketWork(item) {
  if (!lootRarityOn()) return 'off';
  if (!hasSocket(item)) return 'not';
  return !itemIsIdentified(item) ? 'unknown' : isEquipped(item) ? 'worn' : null;
}
/** Why a gem may not be set in a piece now, or null: socketWork's, 'set' (a gem is in it - unset it first), 'nogem'
 *  (none of that kind loose in the pack), 'gold'. */
export function setGemRefusal(item, gem, player) {
  const work = socketWork(item);
  if (work) return work;
  if (socketGem(item)) return 'set';
  if (!GEM_IDS.includes(gem) || !(gemsHeld(player?.items)[gem] > 0)) return 'nogem';
  if (totalGoldAmount(player) < SET_GEM_PRICE) return 'gold';
  return null;
}
/** THE SETTING, MADE: the gem out of the pack, the gold paid, its line on the piece. Answers `{ ok: true, line }` or
 *  `{ ok: false, reason }` with nothing taken. */
export function setGemPiece(item, gem, player) {
  if (!player || !Array.isArray(player.items) || !player.items.includes(item)) return { ok: false, reason: 'gone' };
  const why = setGemRefusal(item, gem, player);
  if (why) return { ok: false, reason: why };
  takeGem(player.items, gem);
  deductGold(player, SET_GEM_PRICE);
  return { ok: true, line: setGem(item, gem) };
}
/** Why a piece's gem may not be unset now, or null: socketWork's, 'empty' (no gem in it). Unsetting is free - and the
 *  gem shatters. */
export function unsetGemRefusal(item) {
  return socketWork(item) ?? (socketGem(item) ? null : 'empty');
}
/** THE UNSETTING, MADE: the gem's line gone, the socket empty, the gem shattered. Answers `{ ok: true, gem }` or
 *  `{ ok: false, reason }`. */
export function unsetGemPiece(item, player) {
  if (!player || !Array.isArray(player.items) || !player.items.includes(item)) return { ok: false, reason: 'gone' };
  const why = unsetGemRefusal(item);
  if (why) return { ok: false, reason: why };
  return { ok: true, gem: unsetGem(item) };
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
