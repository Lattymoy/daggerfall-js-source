// @ts-check
// BATCH-JUNK: mark a whole category junk in one press (a player's ask: a Batch junk button beside Batch salvage). The panel
// opens over the pack: its pages (ui/packPages.js) and the ladder's rarities as ticks, and a live count of the pieces they
// would mark. Mark junk marks them and Clear junk lifts the mark. Nothing is sold: Sell junk (enhancedTrade.js) does that.
// A piece the game will not let go is never marked (junkRules.js canJunkInBatch), and a locked piece keeps its padlock.
// The line says how many were passed over and why. `batchJunkPlan` is the law (pure); `buildJunkBatchPanel` is the DOM.
import { PACK_PAGES, pageOf } from '../packPages.js';
import { canJunkInBatch } from '../../systems/item/junkRules.js';
import { isJunk, setJunk } from '../../systems/item/itemJunk.js';
import { isEquipped } from '../../systems/equip.js';
import { isBound } from '../../systems/item/itemBound.js';
import { isLocked } from '../../systems/item/itemLock.js';
import { RARITY_ORDER, RARITIES, rarityOf } from '../../systems/loot/lootRarity.js';
import { t } from '../../systems/textManager.js';

/** The panel's words in the player's language (L10N4: each through the text core, read when the panel is drawn). */
export const batchJunkText = () => ({
  title: t('inventory.junkBatch.label', 'Batch junk'),
  hint: t('inventory.junkBatch.hint', 'Choose what to mark as junk. A shop\'s Sell junk then puts it on the counter.'),
  pages: t('inventory.junkBatch.pages', 'Categories'),
  rarities: t('inventory.junkBatch.rarities', 'Rarities'),
  all: t('inventory.junkBatch.all', 'All'), none: t('inventory.junkBatch.none', 'None'),
  mark: t('inventory.junkBatch.mark', 'Mark as junk'), clear: t('inventory.junkBatch.clear', 'Clear junk'), close: t('inventory.junkBatch.close', 'Close'),
  nothing: t('inventory.junkBatch.nothing', 'Choose a category.'),
  count: (/** @type {number} */ n, /** @type {number} */ already, /** @type {number} */ skipped) => [t('inventory.junkBatch.toMark', '{n} to mark', { n }),
    already ? t('inventory.junkBatch.already', '{n} already junk', { n: already }) : '', skipped ? t('inventory.junkBatch.passed', '{n} passed over', { n: skipped }) : ''].filter(Boolean).join(', '),
  why: (/** @type {string} */ why, /** @type {number} */ n) => ({
    worn: t('inventory.junkBatch.why.worn', '{n} worn', { n }), quest: t('inventory.junkBatch.why.quest', '{n} from a quest', { n }),
    bound: t('inventory.junkBatch.why.bound', '{n} bound', { n }), locked: t('inventory.junkBatch.why.locked', '{n} locked', { n }),
  }[why] ?? t('inventory.junkBatch.why.other', '{n} not for sale', { n })),
  careful: t('inventory.junkBatch.careful', 'Legendary and better pieces are in the choice.'),
  done: (/** @type {number} */ n) => t('inventory.junkBatch.done', 'Marked {n, plural, one {# piece} other {# pieces}} as junk.', { n }),
  cleared: (/** @type {number} */ n) => t('inventory.junkBatch.cleared', 'Cleared the junk mark from {n, plural, one {# piece} other {# pieces}}.', { n }),
});

/** Why a piece in the choice is passed over (a word of batchJunkText().why). */
export function passedOverWhy(/** @type {any} */ item) {
  if (isEquipped(item)) return 'worn';
  if (item?.questItem) return 'quest';
  if (isBound(item)) return 'bound';
  if (isLocked(item)) return 'locked';
  return 'other';
}

/**
 * What a choice would mark, clear or pass over. Pure over the pack and the choice.
 * @param {any[]} items the pack @param {{ pages: Set<string>, rarities: Set<string> }} sel the ticks
 * @param {boolean} [rarityOn] whether the ladder is on (off: every piece is one tier, and the tier ticks decide nothing)
 */
export function batchJunkPlan(items, sel, rarityOn = true) {
  /** @type {any[]} */ const mark = [];
  /** @type {any[]} */ const marked = [];   // in the choice and already junk: what Clear lifts
  /** @type {Record<string, number>} */ const skipped = {};
  for (const it of items ?? []) {
    if (!it || !sel.pages.has(pageOf(it))) continue;
    if (rarityOn && !sel.rarities.has(rarityOf(it))) continue;
    if (isJunk(it)) {
      if (isLocked(it)) skipped.locked = (skipped.locked ?? 0) + 1;   // a locked piece is never touched by a sweep: not marked, and its mark not lifted
      else marked.push(it);
      continue;
    }
    if (canJunkInBatch(it)) mark.push(it);
    else { const why = passedOverWhy(it); skipped[why] = (skipped[why] ?? 0) + 1; }
  }
  return { mark, marked, skipped, skippedCount: Object.values(skipped).reduce((a, b) => a + b, 0) };
}

/** Mark every piece of a plan. Answers how many. */
export function applyBatchJunk(/** @type {{ mark: any[] }} */ plan) {
  let n = 0;
  for (const it of plan.mark) if (canJunkInBatch(it)) { setJunk(it, true); n++; }
  return n;
}
/** Lift the mark from every piece of a plan that holds it. Answers how many. */
export function clearBatchJunk(/** @type {{ marked: any[] }} */ plan) {
  let n = 0;
  for (const it of plan.marked) if (isJunk(it) && !isLocked(it)) { setJunk(it, false); n++; }
  return n;
}

/**
 * The panel's DOM. `onDone(message)` is told after a Mark or a Clear and after Close (no message).
 * @param {{ items: () => any[], rarityOn: boolean, onDone: (message?: string) => void }} o
 */
export function buildJunkBatchPanel({ items, rarityOn, onDone }) {
  const T = batchJunkText();
  const sel = { pages: new Set(/** @type {string[]} */ ([])), rarities: new Set(/** @type {string[]} */ (['common'])) };
  /** @returns {any} */
  const el = (/** @type {string} */ tag, /** @type {string|null} */ cls, /** @type {string} */ text = '') => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const root = el('div', 'inv-info inv-dismantle inv-junkbatch');
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', T.title); root.setAttribute('aria-modal', 'true');
  const card = el('div', 'card');
  const box = el('div', 'inv-info-box');
  box.append(el('p', 'center', T.title), el('p', 'center jb-hint', T.hint));
  card.append(box);
  const body = el('div', 'jb-body');
  card.append(body);
  const acts = el('div', 'acts');
  card.append(acts);
  root.append(card);

  const chip = (/** @type {string} */ label, /** @type {boolean} */ on, /** @type {() => void} */ press) => {
    const b = el('button', 'act jb-chip' + (on ? ' primary' : ''), label);
    b.type = 'button'; b.setAttribute('aria-pressed', String(on));
    b.onclick = (e) => { e?.stopPropagation?.(); press(); paint(); };
    return b;
  };
  const group = (/** @type {string} */ title, /** @type {Array<[string, string]>} */ rows, /** @type {Set<string>} */ set) => {
    const g = el('div', 'jb-group');
    const head = el('div', 'jb-head');
    head.append(el('span', 'jb-title', title));
    for (const [word, all] of [[T.all, true], [T.none, false]]) {
      const b = el('button', 'act jb-mini', /** @type {string} */ (word)); b.type = 'button';
      b.onclick = (e) => { e?.stopPropagation?.(); for (const [id] of rows) { if (all) set.add(id); else set.delete(id); } paint(); };
      head.append(b);
    }
    g.append(head);
    const chips = el('div', 'jb-chips');
    for (const [id, label] of rows) chips.append(chip(label, set.has(id), () => { if (set.has(id)) set.delete(id); else set.add(id); }));
    g.append(chips);
    return g;
  };
  const plan = () => batchJunkPlan(items(), sel, rarityOn);

  function paint() {
    body.replaceChildren();
    body.append(group(T.pages, PACK_PAGES.map(([id, label]) => [id, label]), sel.pages));
    if (rarityOn) body.append(group(T.rarities, RARITY_ORDER.map((id) => [id, RARITIES[id].label]), sel.rarities));
    const p = plan();
    const reasons = Object.entries(p.skipped).map(([why, n]) => T.why(why, n)).join(', ');
    const line = el('p', 'center jb-count', sel.pages.size ? T.count(p.mark.length, p.marked.length, p.skippedCount) : T.nothing);
    if (reasons && sel.pages.size) line.title = reasons;
    body.append(line);
    if (reasons && sel.pages.size) body.append(el('p', 'center jb-why', reasons));
    if (rarityOn && ['legendary', 'aetheric', 'artifact', 'gilded'].some((r) => sel.rarities.has(r))) body.append(el('p', 'center jb-careful', T.careful));
    markBtn.disabled = !p.mark.length;
    clearBtn.disabled = !p.marked.length;
    markBtn.textContent = p.mark.length ? `${T.mark} (${p.mark.length})` : T.mark;
    clearBtn.textContent = p.marked.length ? `${T.clear} (${p.marked.length})` : T.clear;
  }
  const markBtn = el('button', 'act primary', T.mark); markBtn.type = 'button';
  markBtn.onclick = (e) => { e?.stopPropagation?.(); const n = applyBatchJunk(plan()); onDone(T.done(n)); };
  const clearBtn = el('button', 'act', T.clear); clearBtn.type = 'button';
  clearBtn.onclick = (e) => { e?.stopPropagation?.(); const n = clearBatchJunk(plan()); onDone(T.cleared(n)); };
  const closeBtn = el('button', 'act', T.close); closeBtn.type = 'button';
  closeBtn.onclick = (e) => { e?.stopPropagation?.(); onDone(); };
  acts.append(markBtn, clearBtn, closeBtn);
  paint();
  return { el: root, plan, sel, focus: () => closeBtn.focus?.({ preventScroll: true }) };
}
