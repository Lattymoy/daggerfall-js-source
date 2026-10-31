// CHAT-POST (2026-10-27): A POSTED ITEM IN CHAT - coloured [Name] that opens the pack's own hover card.
// One home for the panel (ui/chatPanel.js): the wire carries the record(s); the card is showItemHover's.
import { showItemHover, hideItemHover, itemChatLabel } from './enhanced/enhancedInventory.js';
import { rarityColour } from '../systems/loot/lootRarity.js';
import { validLootItem } from '../systems/loot/loot.js';
import { isEquipped } from '../systems/equip.js';
import { CHAT_ITEMS_MAX } from '../net/wire.js';

/** The piece as a card may draw it, or null when the wire's shape is not an item this port could have minted. */
export const chatItemOf = (rec) => (rec && typeof rec === 'object' && !Array.isArray(rec) ? validLootItem(rec) : null);

/** Linked pieces on a line - `items` or a legacy single `item`, each through chatItemOf. */
export function chatItemsOf(line) {
  const raw = Array.isArray(line?.items) && line.items.length ? line.items : line?.item ? [line.item] : [];
  return raw.map(chatItemOf).filter(Boolean);
}

/**
 * A coloured `[Name]` / `[Name xN]` span for a chat line. Hover opens the pack's tip card (showItemHover); leave closes it.
 * @param {any} item a record already through chatItemOf
 * @param {(tag: string, cls: string, text?: string|null) => any} el the panel's element builder
 */
export function chatItemLink(item, el) {
  const link = el('span', 'dfchat-item', `[${itemChatLabel(item)}]`);
  const colour = rarityColour(item);
  if (colour) link.style.color = colour;
  link.addEventListener('mouseenter', () => showItemHover(item, {}, link, 'shop'));
  link.addEventListener('mouseleave', () => hideItemHover());
  return link;
}

/**
 * CHAT-POST: the line's words with each matching `[Label]` turned into a link, left to right, consuming linked items
 * by label. `plain(t)` / `mention(t)` build text nodes for the stretches between links.
 */
export function chatTextParts(text, items, el, { plain, mention } = {}) {
  const makePlain = plain ?? ((t) => el('span', 'dfchat-plain', t));
  const pool = (items ?? []).map((item) => ({ label: itemChatLabel(item), item }));
  const out = [];
  let i = 0;
  const words = String(text ?? '');
  while (i < words.length) {
    let bestAt = -1,
      best = -1,
      bestLen = 0;
    for (let p = 0; p < pool.length; p++) {
      const slot = pool[p];
      if (!slot) continue;
      const needle = `[${slot.label}]`;
      const at = words.indexOf(needle, i);
      if (at >= 0 && (bestAt < 0 || at < bestAt)) {
        bestAt = at;
        best = p;
        bestLen = needle.length;
      }
    }
    if (best < 0) {
      const rest = words.slice(i);
      if (rest) out.push(...(mention ? mention(rest) : [makePlain(rest)]));
      break;
    }
    if (bestAt > i) {
      const chunk = words.slice(i, bestAt);
      out.push(...(mention ? mention(chunk) : [makePlain(chunk)]));
    }
    out.push(chatItemLink(pool[best].item, el));
    pool[best] = null;
    i = bestAt + bestLen;
  }
  return out.length ? out : [makePlain(words)];
}

export { hideItemHover as hideChatItemTip };

/**
 * CHAT-POST: an unfinished `[query` before the caret - typing `[` opens the pack picker in the field.
 * Null when the caret is not inside an open bracket (a closed `[Label]` does not match).
 */
export function openLinkQuery(text, caret) {
  const before = String(text ?? '').slice(0, Math.max(0, Number(caret) || 0));
  const m = before.match(/\[([^\]\[]*)$/);
  return m ? { start: before.length - m[0].length, query: m[1] } : null;
}

/**
 * CHAT-POST: every bag piece whose chat label matches `query` (case-blind; empty query = the whole pack).
 * Worn first, then starts-with before contains, then label. `limit` caps the list when set.
 */
export function matchBagItems(items, query, { limit = Infinity } = {}) {
  const q = String(query ?? '').toLowerCase();
  const scored = [];
  for (const item of items ?? []) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const label = itemChatLabel(item);
    if (!label || label === '?') continue;
    const hay = label.toLowerCase();
    if (q && !hay.includes(q)) continue;
    scored.push({
      item,
      label,
      equipped: isEquipped(item),
      score: !q || hay.startsWith(q) ? 0 : 1,
    });
  }
  scored.sort(
    (a, b) => (b.equipped ? 1 : 0) - (a.equipped ? 1 : 0) || a.score - b.score || a.label.localeCompare(b.label),
  );
  return Number.isFinite(limit) && limit >= 0 ? scored.slice(0, limit) : scored;
}

/**
 * CHAT-POST: pending `{ label, item }` rows still matched by a `[Label]` in `text`, at most one keep per text
 * occurrence. Caps at `max` (CHAT_ITEMS_MAX). Use after the player edits the field so a deleted bracket frees a slot.
 */
export function prunePendingLinks(pending, text, { max = CHAT_ITEMS_MAX } = {}) {
  const words = String(text ?? '');
  const used = new Map();
  const kept = [];
  for (const row of pending ?? []) {
    if (kept.length >= max) break;
    const label = row?.label;
    const item = row?.item;
    if (!label || !item) continue;
    const needle = `[${label}]`;
    let count = 0;
    for (let i = 0; (i = words.indexOf(needle, i)) >= 0; i += needle.length) count++;
    const taken = used.get(label) ?? 0;
    if (taken >= count) continue;
    kept.push(row);
    used.set(label, taken + 1);
  }
  return kept;
}

/** CHAT-POST: the item records from prunePendingLinks, for the wire. */
export function takePendingLinks(pending, text, opts) {
  return prunePendingLinks(pending, text, opts).map((row) => row.item);
}
