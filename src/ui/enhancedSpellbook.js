// PX23 - THE ENHANCED SPELLBOOK.
//
// The fifth window to wear the pixel face, and the last one either
// enhanced screen pushed as a classic canvas child.
//
// IT BORROWS NO LAW IT COULD READ. Every number and every word here
// comes out of ui/spellbookWindow.js - the point cost with its
// free-cast quirk (spellPointCost), the effects filter that drops the
// empty slots (spellEffects), the effect naming through effectByKey
// with its <effect not found> fallback, and the delete refusals for
// the vampire and lycanthropy spells. This window is PAINT AND BONES;
// the book's rules stay in the book.
//
// THE BONES ARE THE JOURNAL'S (PX3/PX4), for the reason PX6 and PX16
// gave: one structure learned once is the whole window's. A rail of
// spell names on the left with the cost beside each, the chosen spell
// on the right with its name inside wing rules and its effects listed
// beneath a titled divider. What the classic book says in a grid of
// icons, this says in words - because the icons are ARENA2 art and
// this window reads none.
//
// WHAT IT DOES, and does not: READY a spell (the one thing a
// spellbook is for), and DELETE one with the classic's own refusals.
// Sorting is the classic's SortSpellsPointCost and its list is the
// same array, so the enhanced book shows it sorted the moment the
// classic sorts it - but it offers no sort button of its own, because
// a rail you can read top to bottom does not need one and a button
// that reorders a list you are looking at is a worse answer than the
// order being right.
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { overlayAction } from './input.js';
import {
  spellEffects, spellPointCost, EFFECT_NOT_FOUND,
  CANNOT_DELETE_VAMP, CANNOT_DELETE_WERE,
  VAMPIRE_SPELL_TAG, LYCANTHROPY_SPELL_TAG,
} from './spellbookWindow.js';
import { effectByKey } from '../systems/spellEffects.js';   // the classic book's own source (spellbookWindow.js:120)

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let host = null;
let deps = {};
let onExit = () => {};
let picked = 0;
let notice = null;

/** The two words the classic prints for an effect, by the same key and
 *  the same fallback (spellbookWindow.effectLabels). Pure. */
export function effectWords(effect) {
  if (!effect) return null;
  const key = `${effect.type},${effect.subType & 0xff}`;
  const template = effectByKey(key);
  if (!template) return { group: EFFECT_NOT_FOUND, subgroup: key };
  return { group: template.group, subgroup: template.subgroup ?? '' };
}

/** The rail's rows: name, cost, and whether the book may delete it.
 *  Pure - the whole model the window draws. */
export function bookModel(spells, castCost) {
  return (spells ?? []).map((sp, i) => ({
    i,
    name: sp?.name ?? '',
    cost: spellPointCost(sp, castCost),
    // The classic's own two refusals (:CANNOT_DELETE_VAMP / _WERE):
    // a special spell is not the player's to throw away.
    undeletable: sp?.tag === VAMPIRE_SPELL_TAG ? CANNOT_DELETE_VAMP
      : sp?.tag === LYCANTHROPY_SPELL_TAG ? CANNOT_DELETE_WERE : null,
    effects: spellEffects(sp).map(effectWords).filter(Boolean),
    spell: sp,
  }));
}

/** The pause window's own divider (enhancedMenu.pxDivider) - a gem, the
 *  word, a gem. Rebuilt here rather than imported because enhancedMenu
 *  does not export it and this file must not reach into its internals;
 *  the CLASSES are the shared thing, and the sheet owns their look. */
function pxDivider(word) {
  const d = el('div', 'px-divider');
  d.append(el('span', 'px-gem'), el('span', 'px-divword', word), el('span', 'px-gem'));
  return d;
}

function render() {
  if (!host) return;
  host.innerHTML = '';
  const shell = el('div', 'px-home px-over sb-shell');
  const win = el('div', 'px-win');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));

  // The bar: the title dead centre with the magicka under it, and Close
  // at the right - the pack window's own three-zone head (PX19/PX21d),
  // which is the shape every framed window in this UI already wears.
  const head = el('header', 'sb-top');
  const who = el('div', 'sb-who');
  who.append(el('h2', null, 'Spellbook'));
  const magicka = deps.entity?.magicka;
  if (Number.isFinite(magicka)) who.append(el('p', 'sb-magicka', `${magicka} magicka`));
  head.append(el('span', 'sb-spacer'), who);
  const close = el('button', 'act', 'Close');
  close.onclick = () => onExit();
  head.append(close);
  win.append(head);

  const body = el('div', 'px-body');
  const rows = bookModel(deps.spells?.() ?? [], deps.castCost);
  if (!rows.length) {
    body.append(el('p', 'px-note', 'No spells yet.'));
    win.append(body);
    shell.append(win);
    host.append(shell);
    return;
  }
  if (picked >= rows.length) picked = rows.length - 1;
  const wrap = el('div', 'px-journal');
  const rail = el('div', 'px-qrail');
  for (const r of rows) {
    const b = el('button', `px-qrow sb-row${r.i === picked ? ' on' : ''}`);
    b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(r.name));
    b.append(el('span', 'sb-cost', String(r.cost)));
    b.onclick = () => { picked = r.i; notice = null; render(); };
    rail.append(b);
  }
  wrap.append(rail);

  const sel = rows[picked];
  const detail = el('div', 'px-qdetail');
  const name = el('div', 'px-qname');
  name.append(el('span', 'px-qwing'), el('h3', null, sel.name), el('span', 'px-qwing px-flip'));
  detail.append(name);
  const meta = el('div', 'px-qmeta');
  meta.append(el('span', 'px-qtimer', `${sel.cost} spell points`));
  detail.append(meta);
  detail.append(pxDivider('Effects'));
  if (!sel.effects.length) {
    detail.append(el('p', 'px-note', 'No effects.'));
  } else {
    const list = el('div', 'sb-effects');
    for (const e of sel.effects) {
      const row = el('div', 'sb-effect');
      row.append(el('span', 'px-c', '\u25c6'), el('span', 'sb-group', e.group));
      if (e.subgroup) row.append(el('span', 'sb-sub', e.subgroup));
      list.append(row);
    }
    detail.append(list);
  }
  const acts = el('div', 'sb-acts');
  const ready = el('button', 'act primary', 'Ready');
  ready.onclick = () => {
    // The classic's own arm: ready, then leave - a spellbook is a
    // choice, and the choice made ends the window.
    deps.onReady?.(sel.spell, { noSpellPointCost: sel.spell?.tag === LYCANTHROPY_SPELL_TAG });
    onExit();
  };
  acts.append(ready);
  const del = el('button', 'act', 'Delete');
  del.onclick = () => {
    if (sel.undeletable) { notice = sel.undeletable; render(); return; }
    const list = deps.spells?.() ?? [];
    list.splice(sel.i, 1);
    picked = Math.max(0, Math.min(picked, list.length - 1));
    notice = null;
    render();
  };
  acts.append(del);
  detail.append(acts);
  if (notice) detail.append(el('p', 'sheet-notice', notice));
  wrap.append(detail);
  body.append(wrap);
  win.append(body);
  shell.append(win);
  host.append(shell);
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  const rows = deps.spells?.() ?? [];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!rows.length) return;
    e.preventDefault(); e.stopPropagation();
    picked = (picked + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length;
    notice = null;
    render();
    return;
  }
  // ESCAPE and the host's own book key close it, the law U52's sheet
  // applies to F5 and the pack applies to F6.
  if (overlayAction(e) !== 'back') return;
  e.preventDefault();
  e.stopPropagation();
  onExit();
}

export function mountEnhancedSpellbook(hostEl, d = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  host = hostEl;
  deps = d;
  onExit = d.onExit ?? (() => {});
  picked = 0;
  notice = null;
  render();
  window.addEventListener('keydown', onKey, true);
  return {
    render,
    destroy() {
      window.removeEventListener('keydown', onKey, true);
      host = null; deps = {}; picked = 0; notice = null;
    },
  };
}
