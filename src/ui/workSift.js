// @ts-check
// BOARD-SIFT (2026-10-21, feature-feedback: "Definitely need sorting/filtering functions for work writs considering
// there are thousands of them and you have to scroll through them all to find what you want"; "The notice board in
// general needs some TLC. The writs especially."): THE WORK TAB'S WRITS SIFTED - every card of the region's work (the
// Court's writs and the chapters', guild and seat writs, guild contracts, commissions) under one bar: what kind, a
// search of its words (the material, the guild, the crafter or the piece), "Only what I can fill", and an order (ending
// soonest, most silver, A to Z). The work still open stands before the work done, and the grid draws a page of it at a
// time, "Show 40 more" under the last (bible/06-Systems/Professions-Arc.md 10.13).
//
// The window (ui/noticeWindow.js) hands each card in as an ENTRY - its kind, whether it is open and fillable now, its
// silver, its end, its name and its words, and the card itself to draw (`card`), made only for the cards shown. What
// "fillable" means is the card's own law, said where the card is made (noticeWindow writEntry and writsFull, workTab
// guildWritMost). The filter and the order are the professions book's for the session (`state.workSift`), so the
// window a stray tap closed opens on them again.
//
// AUDIT BOARD-SIFT (2026-10-22, the owner: "Audit this"): the bar's own controls redraw the results alone (`refresh`,
// the window's) - never the bar, so the field typed in is never taken from under the keys; a word composed (an IME's, a
// phone keyboard's) is read once it is whole (`typedField`, and the window's paint waits on it); the kinds' counts are
// those the search and "Only what I can fill" leave, in the player's language's numbers.
import { t, currentLocale } from '../systems/textManager.js';
import { searchWords, wordsIn } from '../net/marketLaw.js';   // AUDIT BOARD-SIFT: one law of a search's words, the market's too

/** The kinds of work, in the bar's order. */
export const WORK_KINDS = Object.freeze(['court', 'chapter', 'guild', 'contract', 'commission']);
/** The orders the work is read in, the first the default. */
export const WORK_SORTS = Object.freeze(['ending', 'pay', 'name']);
/** The cards a grid draws at once, and how many more a press of "Show more" adds. */
export const WORK_SHOWN = 40;
/** How long the search waits after the last key before it reads the words. */
export const WORK_FIND_MS = 150;

/**
 * @typedef {{ kind: string, open: boolean, fill: boolean, pay: number, ends: number, name: string, words: string, card: () => HTMLElement }} WorkEntry
 * @typedef {{ kind: string, find: string, fill: boolean, sort: string, shown: number }} WorkSift
 */

/** The bar as a window opens for the first time: all the work, ending soonest. @returns {WorkSift} */
export const freshSift = () => ({ kind: 'all', find: '', fill: false, sort: WORK_SORTS[0], shown: WORK_SHOWN });

/** An entry's searchable words, lower-cased, from any number of names (a missing one is skipped). */
export const wordsOf = (/** @type {Array<string|null|undefined>} */ ...names) => names.filter(Boolean).join(' ').toLowerCase();

/** A number in the player's language's own way of writing it (the text core's language, never the browser's). */
const num = (/** @type {number} */ n) => { try { return Number(n).toLocaleString(currentLocale()); } catch { return String(n); } };

/**
 * Whether an entry stands under the bar's search and "Only what I can fill" - its kind aside: each word of `sift.find`
 * among its words or its kind's name ("court" finds the Court's writs). Pure.
 * @param {WorkSift} sift
 */
function othersOf(sift) {
  const words = searchWords(sift?.find ?? '');
  const named = new Map(WORK_KINDS.map((k) => [k, kindWord(k)]));
  return (/** @type {WorkEntry} */ e) => (!sift?.fill || e.fill) && wordsIn(words, `${e.words} ${named.get(e.kind) ?? ''}`);
}

/**
 * THE SIFT - the entries of `sift.kind` (all: every kind) that stand under its search and "Only what I can fill"; the
 * open before the done, then in `sift.sort`'s order (the soonest to end - one with no end last -, the most silver, A to
 * Z), ties kept in the order they came; `sift.shown` of them. Pure.
 * @param {ReadonlyArray<WorkEntry>} entries @param {WorkSift} sift
 * @returns {{ rows: WorkEntry[], matched: number }}
 */
export function siftWork(entries, sift) {
  const kind = WORK_KINDS.includes(sift?.kind) ? sift.kind : 'all';
  const stands = othersOf(sift);
  const kept = entries.filter((e) => (kind === 'all' || e.kind === kind) && stands(e));
  const ends = (/** @type {WorkEntry} */ e) => (Number.isFinite(e.ends) && e.ends > 0 ? e.ends : Infinity);
  /** @type {(a: WorkEntry, b: WorkEntry) => number} */
  const by = sift?.sort === 'pay' ? (a, b) => (Number(b.pay) || 0) - (Number(a.pay) || 0)
    : sift?.sort === 'name' ? (a, b) => a.name.localeCompare(b.name, currentLocale())
      : (a, b) => (ends(a) === ends(b) ? 0 : ends(a) < ends(b) ? -1 : 1);
  const rows = kept.map((e, i) => /** @type {const} */ ([e, i])).sort(([a, i], [b, j]) => (Number(b.open) - Number(a.open)) || by(a, b) || i - j).map(([e]) => e);
  const shown = Number.isSafeInteger(sift?.shown) && sift.shown > 0 ? sift.shown : WORK_SHOWN;
  return { rows: rows.slice(0, shown), matched: rows.length };
}

/** The entries of each kind that the bar's search and "Only what I can fill" leave (AUDIT BOARD-SIFT: what choosing the
 *  kind would show), and `all` of them. Pure. @param {ReadonlyArray<WorkEntry>} entries @param {WorkSift|null} [sift] */
export function kindCounts(entries, sift = null) {
  const stands = othersOf(sift ?? freshSift());
  const n = new Map([['all', 0], ...WORK_KINDS.map((k) => /** @type {[string, number]} */ ([k, 0]))]);
  for (const e of entries) {
    if (!n.has(e.kind) || !stands(e)) continue;
    n.set(e.kind, /** @type {number} */ (n.get(e.kind)) + 1);
    n.set('all', /** @type {number} */ (n.get('all')) + 1);
  }
  return n;
}

/** A kind's name on the bar. */
export const kindWord = (/** @type {string} */ k) => (k === 'court' ? t('notice.sift.court', 'Court writs') : k === 'chapter' ? t('notice.sift.chapter', 'Chapter writs')
  : k === 'guild' ? t('notice.sift.guild', 'Guild writs') : k === 'contract' ? t('notice.sift.contract', 'Guild contracts')
    : k === 'commission' ? t('notice.sift.commission', 'Commissions') : t('notice.sift.all', 'All work'));
/** An order's name on the bar. */
export const sortWord = (/** @type {string} */ k) => (k === 'pay' ? t('notice.sift.pay', 'Most silver') : k === 'name' ? t('notice.sift.name', 'A to Z')
  : t('notice.sift.ending', 'Ending soonest'));

/**
 * AUDIT BOARD-SIFT (lane B M4: "mithril" composed on a phone's keyboard with one pause came back "mitmithril"): A FIELD
 * TYPED BY WORDS - `settled` is called once the typing has rested `ms`, and never while a word is being composed (an
 * IME's, a phone keyboard's): then it waits for the word to be whole. While one is composed the field says so
 * (`data-composing`), and the board's window paints around it (ui/noticeWindow.js render) - a paint that empties the
 * window took the field mid-word, and the composition landed twice. Answers what the field's `oninput` calls once it has
 * kept the field's value.
 * @param {HTMLInputElement} input @param {number} ms @param {() => void} settled
 */
export function typedField(input, ms, settled) {
  /** @type {any} */
  let typing = null;
  let composing = false;
  const rest = () => { clearTimeout(typing); typing = setTimeout(settled, ms); };
  const whole = () => { if (!composing) return; composing = false; input.removeAttribute('data-composing'); };
  input.addEventListener('compositionstart', () => { composing = true; clearTimeout(typing); input.setAttribute('data-composing', '1'); });
  input.addEventListener('compositionend', () => { whole(); rest(); });
  input.addEventListener('blur', whole);
  return () => { if (!composing) rest(); };
}

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const select = (/** @type {Array<[string, string]>} */ options, /** @type {string} */ value, /** @type {(v: string) => void} */ onChange, /** @type {string} */ label, /** @type {string} */ focus) => {
  const s = /** @type {HTMLSelectElement} */ (el('select', 'notice-select work-select'));
  s.setAttribute('aria-label', label);
  s.setAttribute('data-focus', focus);
  fillOptions(s, options, value);
  s.onchange = () => onChange(s.value);
  return s;
};
const fillOptions = (/** @type {HTMLSelectElement} */ s, /** @type {Array<[string, string]>} */ options, /** @type {string} */ value) => {
  s.replaceChildren();
  for (const [v, text] of options) { const o = /** @type {HTMLOptionElement} */ (el('option', null, text)); o.value = v; if (v === value) o.selected = true; s.append(o); }
};
/** The kind's choices, each with what it would show; a kind with none not offered, unless it is the one chosen. */
const kindOptions = (/** @type {WorkSift} */ sift, /** @type {ReadonlyArray<WorkEntry>} */ entries) => {
  const counts = kindCounts(entries, sift);
  const offered = WORK_KINDS.filter((k) => /** @type {number} */ (counts.get(k)) > 0 || sift.kind === k);
  return /** @type {Array<[string, string]>} */ ([['all', `${kindWord('all')} (${num(/** @type {number} */ (counts.get('all')))})`],
    ...offered.map((k) => [k, `${kindWord(k)} (${num(/** @type {number} */ (counts.get(k)))})`])]);
};

/**
 * THE BAR over the grid: the kind (each with what it would show), the search, "Only what I can fill", the order, and how
 * many of the matches are shown. A change keeps the sift and asks the window to draw the results again (`refresh`, the
 * first page of them) - never the bar itself, so the field typed in keeps its keys, its caret and a phone's keyboard.
 * Its count and its kinds are filled by updateSiftBar.
 * @param {WorkSift} sift @param {ReadonlyArray<WorkEntry>} entries @param {() => void} refresh
 */
export function workSiftBar(sift, entries, refresh) {
  const bar = el('div', 'work-sift');
  const changed = () => { sift.shown = WORK_SHOWN; refresh(); };
  bar.append(select(kindOptions(sift, entries), sift.kind, (v) => { sift.kind = v; changed(); }, t('notice.sift.kindLabel', 'Kind of work'), 'worksift|kind'));
  const find = /** @type {HTMLInputElement} */ (el('input', 'notice-input work-find'));
  find.type = 'search';
  find.value = sift.find;
  find.placeholder = t('notice.sift.find', 'Search');
  find.setAttribute('aria-label', t('notice.sift.findLabel', 'Search by material, guild or name'));
  find.setAttribute('data-focus', 'worksift|find');
  const typed = typedField(find, WORK_FIND_MS, changed);
  find.oninput = () => { sift.find = find.value; typed(); };
  bar.append(find);
  const fill = /** @type {HTMLInputElement} */ (el('input'));
  fill.type = 'checkbox';
  fill.checked = !!sift.fill;
  fill.setAttribute('data-focus', 'worksift|fill');
  fill.onchange = () => { sift.fill = fill.checked; changed(); };
  const fillLabel = el('label', 'work-sift-fill');
  fillLabel.append(fill, el('span', null, t('notice.sift.fill', 'Only what I can fill')));
  bar.append(fillLabel);
  bar.append(select(WORK_SORTS.map((k) => /** @type {[string, string]} */ ([k, sortWord(k)])), sift.sort, (v) => { sift.sort = v; changed(); }, t('notice.sift.sortLabel', 'Order the work'), 'worksift|sort'));
  const count = el('span', 'work-sift-count');
  count.setAttribute('aria-live', 'polite');
  bar.append(count);
  return bar;
}

/** The bar told what the results now are: its kinds' counts, its controls as the sift stands (a "Show all work" press
 *  cleared it), and "Showing 40 of 213". @param {HTMLElement} bar @param {WorkSift} sift
 *  @param {ReadonlyArray<WorkEntry>} entries @param {number} matched @param {number} shown */
export function updateSiftBar(bar, sift, entries, matched, shown) {
  const field = (/** @type {string} */ key) => /** @type {any} */ ([...bar.querySelectorAll('select, input')].find((n) => n.getAttribute('data-focus') === key));
  const kind = field('worksift|kind');
  if (kind) { fillOptions(kind, kindOptions(sift, entries), sift.kind); kind.value = sift.kind; }
  const find = field('worksift|find');
  if (find && find.value !== sift.find) find.value = sift.find;
  const fill = field('worksift|fill');
  if (fill) fill.checked = !!sift.fill;
  const sort = field('worksift|sort');
  if (sort) sort.value = sift.sort;
  const count = bar.querySelector('.work-sift-count');
  if (count) count.textContent = t('notice.sift.count', 'Showing {shown, number} of {total, number}', { shown, total: matched });
}

/** Under the grid: "Show 40 more" while matches stand past the last drawn (the focus kept on it); or, where work stands
 *  but nothing matches what was asked, the word and "Show all work". Null for neither. @param {WorkSift} sift
 *  @param {number} matched @param {number} shown @param {number} total every entry, unsifted @param {() => void} refresh */
export function workSiftFoot(sift, matched, shown, total, refresh) {
  if (matched > shown) {
    const n = Math.min(WORK_SHOWN, matched - shown);
    const b = /** @type {HTMLButtonElement} */ (el('button', 'act work-sift-more', t('notice.sift.more', 'Show {n, number} more', { n })));
    b.setAttribute('type', 'button');
    b.setAttribute('data-focus', 'worksift|more');
    b.onclick = (e) => {
      e?.stopPropagation?.();
      const slot = b.parentNode;
      sift.shown = shown + WORK_SHOWN;
      refresh();
      // AUDIT BOARD-SIFT (lane B L5): the press's focus stays on the board - on the next "Show more", where one stands
      /** @type {any} */ (slot?.querySelector?.('.work-sift-more'))?.focus?.({ preventScroll: true });
    };
    return b;
  }
  if (!matched && total) {
    const p = el('p', 'notice-empty work-sift-none', t('notice.sift.none', 'No work matches.'));
    const b = /** @type {HTMLButtonElement} */ (el('button', 'act notice-retry', t('notice.sift.clear', 'Show all work')));
    b.setAttribute('type', 'button');
    b.onclick = (e) => { e?.stopPropagation?.(); Object.assign(sift, freshSift(), { sort: sift.sort }); refresh(); };
    p.append(b);
    return p;
  }
  return null;
}
