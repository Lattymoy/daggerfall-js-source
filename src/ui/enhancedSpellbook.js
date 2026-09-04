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
// spellbook is for), and DELETE one behind the classic's own YesNo
// with the classic's own refusals.
// Sorting is the classic's SortSpellsPointCost and its list is the
// same array, so the enhanced book shows it sorted the moment the
// classic sorts it - but it offers no sort button of its own, because
// a rail you can read top to bottom does not need one and a button
// that reorders a list you are looking at is a worse answer than the
// order being right.
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { overlayAction } from './input.js';
import {
  spellEffects, spellPointCost, EFFECT_NOT_FOUND, ENTER_SPELL_NAME,
  CANNOT_DELETE_VAMP, CANNOT_DELETE_WERE, DELETE_SPELL_PROMPT,
  VAMPIRE_SPELL_TAG, LYCANTHROPY_SPELL_TAG,
} from './spellbookWindow.js';
import { effectByKey } from '../systems/spellEffects.js';   // the classic book's own source (spellbookWindow.js:120)
import { TARGET_DESCRIPTIONS, ELEMENT_DESCRIPTIONS } from './spellIcons.js';   // PX23b: the classic's OWN words for the two icons

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
let renaming = null;   // PX23b: the name being edited, kept across renders
let deleting = null;   // AUDIT 39: DeleteButton's deleteSpellIndex - the row the YesNo is asking about

/**
 * PX23b: AN EFFECT CARRIES NUMBERS, and the first draft read none.
 *
 * `spellEffects` hands back the effect RECORDS, not just their type -
 * every one carries `magnitudeBaseLow/High` with their per-level
 * step, `durationBase/Mod/PerLevel`, and `chanceBase/Mod/PerLevel`
 * (systems/effects.js:446-454 reads exactly these). The first draft
 * printed the two NAMES and threw the rest away, which is the same
 * fault the chronicle's flattened date was: the data was already
 * there.
 *
 * The words are DFU's own spell-maker phrasing, and each part appears
 * only when that effect HAS it - a Free Action has no magnitude, and
 * printing "0 to 0" would be worse than printing nothing.
 */
export function effectWords(effect) {
  if (!effect) return null;
  const key = `${effect.type},${effect.subType & 0xff}`;
  const template = effectByKey(key);
  const base = template
    ? { group: template.group, subgroup: template.subgroup ?? '' }
    : { group: EFFECT_NOT_FOUND, subgroup: key };
  const lo = effect.magnitudeBaseLow ?? 0;
  const hi = effect.magnitudeBaseHigh ?? 0;
  const perLevel = effect.magnitudeLevelBase ?? 0;
  const parts = [];
  if (lo || hi) {
    const span = lo === hi ? `${lo}` : `${lo}-${hi}`;
    parts.push(perLevel ? `${span} +${perLevel}/level` : span);
  }
  const dur = effect.durationBase ?? 0;
  if (dur) {
    const per = effect.durationMod ?? 0;
    parts.push(per ? `${dur} +${per}/level rounds` : `${dur} rounds`);
  }
  const ch = effect.chanceBase ?? 0;
  if (ch) {
    const per = effect.chanceMod ?? 0;
    parts.push(per ? `${ch}% +${per}/level` : `${ch}%`);
  }
  return { ...base, parts };
}

/** The two words the classic shows as TOOLTIPS on the target and
 *  element icons (spellbookWindow.js:384/388). This window draws no
 *  icons - it reads no ARENA2 - so it prints what those icons mean,
 *  which is strictly more than the classic tells you at a glance. */
export function spellFrame(spell) {
  return {
    target: TARGET_DESCRIPTIONS[spell?.rangeType ?? -1] ?? null,
    element: ELEMENT_DESCRIPTIONS[spell?.element ?? -1] ?? null,
  };
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
    frame: spellFrame(sp),
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
    b.onclick = () => { picked = r.i; notice = null; deleting = null; render(); };
    rail.append(b);
  }
  wrap.append(rail);

  const sel = rows[picked];
  const detail = el('div', 'px-qdetail');
  const name = el('div', 'px-qname');
  name.append(el('span', 'px-qwing'), el('h3', null, sel.name), el('span', 'px-qwing px-flip'));
  detail.append(name);
  const meta = el('div', 'px-qmeta');
  // AFFORDABLE OR NOT, which is the question a player opens this book
  // with. The classic answers it only by failing at the cast.
  const short = Number.isFinite(magicka) && sel.cost > magicka;
  meta.append(el('span', `px-qtimer${short ? ' urgent' : ''}`,
    short ? `${sel.cost} spell points - not enough magicka` : `${sel.cost} spell points`));
  detail.append(meta);
  // THE TWO ICONS THE CLASSIC DRAWS, as the words they mean. This
  // window reads no ARENA2, and the classic only tells you these on
  // hover - so printing them is strictly more than it says.
  if (sel.frame.target || sel.frame.element) {
    const frame = el('div', 'sb-frame');
    if (sel.frame.target) frame.append(el('span', 'sb-chip', sel.frame.target));
    if (sel.frame.element) frame.append(el('span', 'sb-chip', sel.frame.element));
    detail.append(frame);
  }
  detail.append(pxDivider('Effects'));
  if (!sel.effects.length) {
    detail.append(el('p', 'px-note', 'No effects.'));
  } else {
    const list = el('div', 'sb-effects');
    for (const e of sel.effects) {
      const row = el('div', 'sb-effect');
      const line = el('div', 'sb-effline');
      line.append(el('span', 'px-c', '\u25c6'), el('span', 'sb-group', e.group));
      if (e.subgroup) line.append(el('span', 'sb-sub', e.subgroup));
      row.append(line);
      // The numbers the effect record already held.
      if (e.parts.length) {
        const nums = el('div', 'sb-nums');
        for (const part of e.parts) nums.append(el('span', 'sb-num', part));
        row.append(nums);
      }
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
  // RENAME. The classic asks "Enter spell name : " (ENTER_SPELL_NAME,
  // :934) and the first draft dropped it - a prettier window that can
  // do less, which is the chronicle's lesson one window over.
  const rename = el('button', 'act', 'Rename');
  rename.onclick = () => { renaming = renaming === null ? sel.name : null; notice = null; render(); };
  acts.append(rename);
  // DELETE IS TWO PRESSES, and the second one is the classic's.
  // DeleteButton_OnMouseClick (:811-838) ends by parking the row in
  // `deleteSpellIndex` and raising a YesNo box on "deleteSpell"; only
  // DeleteSpellConfirm_OnButtonClick's Yes arm (:840-852) deletes.
  // AUDIT 39: this book spliced the player's OWN spell array on the
  // single press - `deps.spells()` is `entity.spells` by reference -
  // so the two skins disagreed about a destructive, unrecoverable act
  // while the port's classic window (spellbookWindow.deleteButton /
  // confirmDelete) carried the whole law.
  const del = el('button', 'act', 'Delete');
  del.onclick = () => {
    if (sel.undeletable) { notice = sel.undeletable; render(); return; }
    deleting = sel.i;
    notice = null;
    render();
  };
  acts.append(del);
  detail.append(acts);
  if (renaming !== null) {
    const form = el('form', 'sb-rename');
    const input = el('input');
    input.type = 'text';
    input.value = renaming;
    input.maxLength = 30;
    input.setAttribute('aria-label', ENTER_SPELL_NAME.trim());
    input.oninput = () => { renaming = input.value; };
    const ok = el('button', 'act primary', 'Save');
    ok.type = 'submit';
    form.onsubmit = (e) => {
      e.preventDefault();
      const name = renaming.trim();
      if (name) sel.spell.name = name;
      renaming = null;
      render();
    };
    form.append(el('span', 'sb-renamelabel', ENTER_SPELL_NAME.trim()), input, ok);
    detail.append(form);
  }
  if (notice) detail.append(el('p', 'sheet-notice', notice));
  wrap.append(detail);
  body.append(wrap);
  win.append(body);
  // AUDIT-39r R22: AND THE PROMPT IS A PUSHED WINDOW, not a card
  // parked beside live buttons. DaggerfallMessageBox.Show() pushes
  // itself onto the UI stack (:303), so in DFU every control of the
  // spellbook beneath it is inert to pointer AND key until an answer
  // comes. The first draft guarded only `onKey`, leaving the rail,
  // Ready, Rename, Delete and Close clickable - a rail click silently
  // dropped the pending question, and Ready readied a spell and left
  // with it unanswered. Disabling the window under the scrim is what
  // makes the box modal in a DOM; the scrim's own buttons are added
  // after, so they stay live.
  if (deleting !== null) {
    for (const b of win.querySelectorAll('button, input')) b.disabled = true;
    win.append(deleteScrim());
  }
  shell.append(win);
  host.append(shell);
}

/** DeleteSpellConfirm_OnButtonClick (:840-852).
 *
 *  AUDIT-39r R21: the trailing `CloseWindow()` (:851) does NOT close
 *  the spellbook. It is UserInterfaceWindow.CloseWindow (:127-132) ->
 *  UserInterfaceManager.PopWindow -> RemoveWindow (:190-199), which
 *  pops TopWindow - and TopWindow at that instant is the message box
 *  itself, since ActivateButton (DaggerfallMessageBox.cs:479-484)
 *  only raises the event and never pops. The book stays open, which
 *  is the only reading under which the Yes arm's own
 *  `RefreshSpellsList(true); UpdateSelection();` mean anything. The
 *  same law is written out one file over, in nativeTrade's _confirm.
 *  So: either answer dismisses the CARD, and only Yes splices. */
function confirmDelete(yes) {
  if (yes && deleting !== null) {
    const list = deps.spells?.() ?? [];
    list.splice(deleting, 1);
    picked = Math.max(0, Math.min(picked, list.length - 1));   // UpdateSelection, with the row gone
  }
  deleting = null;
  render();
}

/** The YesNo box DeleteButton_OnMouseClick raises (:836-838), drawn
 *  over the window it covers rather than inside its detail column. */
function deleteScrim() {
  const scrim = el('div', 'sb-ask');
  const ask = el('div', 'card');
  ask.append(el('p', 'px-note', DELETE_SPELL_PROMPT));
  const a = el('div', 'sb-acts');
  const yes = el('button', 'act primary', 'Yes');
  yes.onclick = () => confirmDelete(true);
  const no = el('button', 'act', 'No');
  no.onclick = () => confirmDelete(false);
  a.append(yes, no);
  ask.append(a);
  scrim.append(ask);
  return scrim;
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  const rows = deps.spells?.() ?? [];
  // THE DELETE BOX IS MODAL, as DFU's DaggerfallMessageBox is: the
  // rail's arrows are dead under it, and it answers to the same two
  // keys the port's classic window answers to (spellbookWindow.js:
  // 647-651), which are DFU's own Yes/No hotkeys
  // (DaggerfallMessageBox.cs:377). Escape is the No button - DFU's
  // box sets AllowCancel = false (:383) and would ignore it, but the
  // classic window here has read Escape as No since U42 and two skins
  // disagreeing about the cancel key is the worse divergence.
  if (deleting !== null) {
    const yes = e.code === 'KeyY' || e.key === 'y' || e.key === 'Y';
    const no = e.code === 'KeyN' || e.key === 'n' || e.key === 'N' || overlayAction(e) === 'back';
    if (!yes && !no) return;
    e.preventDefault();
    e.stopPropagation();
    confirmDelete(yes);
    return;
  }
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
  renaming = null;
  deleting = null;
  render();
  window.addEventListener('keydown', onKey, true);
  return {
    render,
    destroy() {
      window.removeEventListener('keydown', onKey, true);
      host = null; deps = {}; picked = 0; notice = null; renaming = null; deleting = null;
    },
  };
}
