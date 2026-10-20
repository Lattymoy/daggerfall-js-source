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
import { repaintKeepingScroll } from '../domRepaint.js';   // FB1018f SPELL-SCROLL: a pick keeps the list where it was
import { closeOnOutsideTap } from './enhancedOverlays.js';   // OT1
import { overlayAction, eventMeans } from '../input.js';   // KB1: and the registry's answer for the book's own key
import {
  spellEffects, spellPointCost, effectNotFoundText, enterSpellNameLabel,
  cannotDeleteVampText, cannotDeleteWereText, deleteSpellPrompt,
  VAMPIRE_SPELL_TAG, LYCANTHROPY_SPELL_TAG, editBookSpell,
} from '../spellbookWindow.js';
import { effectByKey, classicEffectSettings } from '../../systems/spell/spellEffects.js';   // the classic book's own source (spellbookWindow.js:"computed from the"); SB-FX: and the settings its effect popup reads
import { t } from '../../systems/textManager.js';   // SB-FX: an effect's numbers in the player's language
import { shownSpellName } from '../../systems/loot/loot.js';   // L10N3e: a stock spell's name in the player's language
import { spellQuickslot, setSpellQuickslot, clearSpellQuickslot } from '../../systems/quickslots.js';   // HOTSLOT: the book is where a spell is slotted
import { TARGET_DESCRIPTIONS, ELEMENT_DESCRIPTIONS, SPELL_ICON_COUNT } from '../spell/spellIcons.js';
import { spellIconPicture, spellIconUrl } from './enhancedArt.js';   // UI2: the spell's own icon, carried onto the hotbar
/** UI2: the hotbar ghost's picture box - its 46px tile inside the 2px frame, less two a side. */
const SPELL_DRAG_BOX = 38;
// HB1: the hotbar. With it chosen over the diamond, the book is where a
// spell goes onto it - dragged off the rail, or by the button that stood
// for the diamond's spell slot.
import { setHotbarDropMode, hotbarAcceptsDrops, beginHotbarDrag, takeHotbarDragClick, hotbarMode, toggleHotbarSpell,
  spellSigil, spellInitials,   // PX23b: the classic's OWN words for the two icons
  hotbarShownSlotOf, setHotbarPick } from './enhancedHotbar.js';   // DIAMOND-HB: shown-slot lookup; hover + key to slot

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
let choosingIcon = false;   // SB-ICON: the icon grid is open under the chosen spell
let deleting = null;   // AUDIT 39: DeleteButton's deleteSpellIndex - the row the YesNo is asking about

/**
 * PX23b: AN EFFECT CARRIES NUMBERS, and the first draft read none.
 *
 * `spellEffects` hands back the effect RECORDS, not just their type -
 * every one carries the eleven classic settings fields, which the cast
 * engine resolves (systems/effects.js:"X11b: CREATE ITEM (Mysticism 2,255)", systems/spellcast.js
 * rollMagnitude). The first draft printed the two NAMES and threw the
 * rest away, which is the same fault the chronicle's flattened date
 * was: the data was already there.
 *
 * SB-FX (2026-10-14, a player on Discord: "shows placeholder values
 * instead of what the spell actually does"): AND IT READ THEM WRONG.
 * It decided a component was there when its field was not zero, and
 * no producer writes a zero there: the Spell Maker inscribes a greyed
 * spinner at its floor of 1 (systems/spell/spellMaker.js blankEffectSettings,
 * DefaultEffectSettings' "1 + 1 per level"), and every stock SPELLS.STD
 * effect holds the same 1s - so a Damage Health read "1 +1/level
 * rounds" and "1% +1/level", a duration and a chance it does not have.
 * And it read `magnitudeLevelBase` - MagnitudePlusMin - as a per-level
 * step, the Plus fields of duration and chance the same way, and never
 * read Plus max or the three per-level divisors at all.
 *
 * So the book reads the effect the way DFU instantiates it: the
 * settings are ClassicEffectRecordToEffectSettings' (the one port,
 * systems/spell/spellEffects.js classicEffectSettings), a component is shown
 * only when the effect class SUPPORTS it (SupportDuration,
 * SupportChance, SupportMagnitude - the template's three flags, the
 * gates DaggerfallEffectSettingsEditorWindow.InitControlState greys the
 * spinners by), and each part is that component's header row of DFU's
 * own spellbook description (ShowEffectPopup's SpellBookDescription,
 * TEXT.RSC 1202-1305 - 1212 for Damage Health: "Duration: %bdr + %adr
 * per %cld level(s)", "Chance: %bch + %ach per %clc level(s)",
 * "Magnitude: %1bm - %2bm + %1am - %2am per %clm level(s)"), in its
 * order. The record prints a component the effect lacks as the
 * defaults (or as "N/A", 1290 Shield's chance); this window prints
 * nothing there, the spell maker's own reading (1512: "Duration:
 * Instantaneous. Chance: N/A"). An effect with none - Teleport - reads
 * its name alone.
 */
export function effectWords(effect) {
  if (!effect) return null;
  const key = `${effect.type},${effect.subType & 0xff}`;
  const template = effectByKey(key);
  if (!template) return { group: effectNotFoundText(), subgroup: key, parts: [] };
  const s = classicEffectSettings(effect);
  const parts = [];
  if (template.duration) {
    parts.push(t('spellbook.effect.duration', 'Duration: {base} + {plus} per {per} level(s)',
      { base: s.durationBase, plus: s.durationPlus, per: s.durationPerLevel }));
  }
  if (template.chance) {
    parts.push(t('spellbook.effect.chance', 'Chance: {base} + {plus} per {per} level(s)',
      { base: s.chanceBase, plus: s.chancePlus, per: s.chancePerLevel }));
  }
  if (template.magnitude) {
    parts.push(t('spellbook.effect.magnitude', 'Magnitude: {baseMin} - {baseMax} + {plusMin} - {plusMax} per {per} level(s)',
      { baseMin: s.magnitudeBaseMin, baseMax: s.magnitudeBaseMax, plusMin: s.magnitudePlusMin, plusMax: s.magnitudePlusMax, per: s.magnitudePerLevel }));
  }
  return { group: template.group, subgroup: template.subgroup ?? '', parts };
}

/** The two words the classic shows as TOOLTIPS on the target and
 *  element icons (spellbookWindow.js:"this.tip.show(TARGET_DESCRIPTIONS[spell.rangeType] ?? null, vx, vy)"/spellbookWindow.js:"this.tip.show(ELEMENT_DESCRIPTIONS[spell.element] ?? null, vx, vy)"). This window draws no
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
    name: shownSpellName(sp) ?? '',   // L10N3e: the Name the classic book shows (EntityEffectBroker.cs:877)
    cost: spellPointCost(sp, castCost),
    // The classic's own two refusals (:CANNOT_DELETE_VAMP / _WERE):
    // a special spell is not the player's to throw away.
    undeletable: sp?.tag === VAMPIRE_SPELL_TAG ? cannotDeleteVampText()
      : sp?.tag === LYCANTHROPY_SPELL_TAG ? cannotDeleteWereText() : null,
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

/** FB1018f SPELL-SCROLL (FIELD BUGS 2026-10-18f; cmagoun on the Discord: "Clicking a spell returns you to the top of a
 *  spell list ... Save the scroll position when you click a spell"): every press draws the book again from nothing, and a
 *  list drawn from nothing stands at its top - a pick put the list back at its first spell, and lit whichever row then
 *  stood under the pointer.
 *  DFU's book never moves on a pick: ListBox.MouseClick (ListBox.cs:465-504) sets the selection and raises OnSelectItem,
 *  and SpellsListBox_OnSelectItem -> UpdateSelection (DaggerfallSpellBookWindow.cs:507-512, :765-768) sets the scroll
 *  bar FROM the list's own ScrollIndex - the classic book here keeps that law (spellbookWindow.js:"this.selectedIndex = index;          // MouseClick").
 *  So the book is drawn through the house's one repaint (ui/domRepaint.js, A REPAINT MUST NOT MOVE THE PAGE UNDER THE
 *  PLAYER): every scrolled pane is read, the book drawn, and each given back. */
function render() {
  if (host) repaintKeepingScroll(host, paint);
}

function paint() {
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
    closeOnOutsideTap(shell, '.px-win', () => onExit());   // OT1
    return;
  }
  if (picked >= rows.length) picked = rows.length - 1;
  const wrap = el('div', 'px-journal');
  const rail = el('div', 'px-qrail');
  for (const r of rows) {
    if (hotbarAcceptsDrops()) spellIconPicture(r.spell?.icon, { box: SPELL_DRAG_BOX });   // UI2: warmed, so a drag starts with it
    const b = el('button', `px-qrow sb-row${r.i === picked ? ' on' : ''}`);
    b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(r.name));
    b.append(el('span', 'sb-cost', String(r.cost)));
    b._hotbarSpell = r.spell;   // DIAMOND-HB: point at it and press a hotbar key
    // HB1: a rail row DRAGS onto the hotbar under the window. A mouse
    // crosses at 4px, a finger on a hold, so a click is still a pick.
    b.onpointerdown = (e) => {
      if (!hotbarAcceptsDrops() || deleting !== null) return;
      // UI2: and carries the spell's own icon, as its slot will show it
      beginHotbarDrag(e, { kind: 'spell', spell: r.spell }, { sigil: r.spell?.noIcon ? spellInitials(r.name) : spellSigil(r.name), element: r.spell?.element ?? null,
        icon: r.spell?.noIcon ? null : spellIconPicture(r.spell?.icon, { box: SPELL_DRAG_BOX }) });
    };
    b.onclick = () => {
      if (takeHotbarDragClick()) return;   // the release of a drag is not a pick
      picked = r.i; notice = null; deleting = null; choosingIcon = false; render();
    };
    rail.append(b);
  }
  wrap.append(rail);

  const sel = rows[picked];
  const detail = el('div', 'px-qdetail');
  // FB1018f SPELL-SCROLL: another spell's page starts at its top; the list keeps its place. AUDIT FB1018f L2-2: THE KEY
  // IS THE SPELL, NOT ITS ROW - it was `picked`, and a delete keeps `picked` (confirmDelete: the row gone, the next spell
  // takes its place), so the spell after a deleted one opened at the deleted one's offset. The spell's index is the port's
  // name for a spell, the one the quickslot and the hotbar key it by (systems/quickslots.js keyedSpell): a rename or an
  // icon keeps the page (editBookSpell writes a new record under the same index), another spell in the row misses
  detail.setAttribute('data-scroll-key', `spell ${sel.spell?.index}`);
  const name = el('div', 'px-qname');
  name.append(el('span', 'px-qwing'), el('h3', null, sel.name), el('span', 'px-qwing px-flip'));
  detail.append(name);
  const meta = el('div', 'px-qmeta');
  // AFFORDABLE OR NOT, which is the question a player opens this book
  // with. The classic answers it only by failing at the cast.
  const short = Number.isFinite(magicka) && sel.cost > magicka;
  meta.append(el('span', `px-qtimer${short ? ' urgent' : ''}`,
    short ? `${sel.cost} spell points. Not enough magicka` : `${sel.cost} spell points`));
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
  // HOTSLOT (2026-09-22, a player on Discord: "Cant change Hotslot
  // spell"): the slot had ONE writer a player could reach - a 350 ms
  // HOLD of the quick-spell key, said nowhere - so from the chair the
  // key was a toggle stuck on the book's first spell, and on a phone
  // the chip that takes the hold was hidden until the slot was filled.
  // The book is where a spell is chosen, so the book slots it: the
  // same Slot/Unslot pair the pack gives a consumable (quickslotActs).
  if (hotbarMode()) {
    // HB1: the hotbar's button in the diamond's place - on the bar comes
    // off, else it goes on the first free slot. Dragging picks the slot.
    const at = hotbarShownSlotOf(sel.spell, { spell: true });   // DIAMOND-HB
    const hb = el('button', `act sb-slot${at >= 0 ? ' on' : ''}`, at >= 0 ? `Off hotbar ${at + 1}` : 'Add to hotbar');
    hb.onclick = () => { notice = toggleHotbarSpell(sel.spell); render(); };
    acts.append(hb);
  } else {
    const inSlot = Number.isFinite(sel.spell?.index) && spellQuickslot()?.index === sel.spell.index;
    const slot = el('button', `act sb-slot${inSlot ? ' on' : ''}`, inSlot ? 'Unslot' : 'Quickslot');
    slot.onclick = () => {
      if (inSlot) clearSpellQuickslot(); else setSpellQuickslot(sel.spell);
      notice = inSlot ? 'Taken out of the quickslot.' : 'In the quickslot. Press its key to ready it, or hold the key to cycle through your spells.';
      render();
    };
    acts.append(slot);
  }
  // RENAME. The classic asks "Enter spell name : " (ENTER_SPELL_NAME,
  // :934) and the first draft dropped it - a prettier window that can
  // do less, which is the chronicle's lesson one window over.
  const rename = el('button', 'act', 'Rename');
  rename.onclick = () => { renaming = renaming === null ? sel.name : null; notice = null; render(); };
  acts.append(rename);
  // SB-ICON: change the spell's icon freely, as the spell maker's picker does - the whole classic set, any icon, any spell.
  // The write is the classic book's own (editBookSpell on a copy, kept as custom), so both skins agree on it.
  const iconBtn = el('button', `act sb-iconbtn${choosingIcon ? ' on' : ''}`, 'Icon');
  iconBtn.onclick = () => { choosingIcon = !choosingIcon; renaming = null; notice = null; render(); };
  acts.append(iconBtn);
  // NO-ICON: the spell shows the first letter of its first two words instead of a picture; the chosen icon is kept, so it can come back
  const noIcon = !!sel.spell?.noIcon;
  const noBtn = el('button', `act sb-iconbtn${noIcon ? ' on' : ''}`, noIcon ? 'Use icon' : 'No icon');
  noBtn.title = noIcon ? 'Show the spell\u2019s icon again' : `Show ${spellInitials(sel.name)} instead of an icon`;
  noBtn.onclick = () => { editBookSpell(deps.spells?.(), sel.i, { noIcon: !noIcon }); choosingIcon = false; notice = noIcon ? 'Icon restored.' : `Now shown as ${spellInitials(sel.name)}.`; render(); };
  acts.append(noBtn);
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
    choosingIcon = false;
    notice = null;
    render();
  };
  acts.append(del);
  detail.append(acts);
  if (choosingIcon) {
    const grid = el('div', 'sb-icons');
    grid.setAttribute('role', 'listbox');
    grid.setAttribute('aria-label', 'Choose an icon');
    for (let n = 0; n < SPELL_ICON_COUNT; n++) {
      const c = el('button', `sb-icon${!sel.spell?.noIcon && n === (sel.spell?.icon ?? 0) ? ' on' : ''}`);
      c.type = 'button';
      c.title = `Icon ${n + 1}`;
      c.setAttribute('aria-label', `Icon ${n + 1}`);
      const url = spellIconUrl(n);
      if (url) { const img = el('img'); img.src = url; img.alt = ''; c.append(img); }
      else c.append(el('span', 'sb-iconnum', String(n + 1)));
      c.onclick = () => {
        choosingIcon = false;
        notice = editBookSpell(deps.spells?.(), sel.i, { icon: n, noIcon: false }) ? 'Icon changed.' : null;
        render();
      };
      grid.append(c);
    }
    detail.append(grid);
    // the sheet may still be loading the first time: paint again once it lands
    if (Array.from({ length: SPELL_ICON_COUNT }, (_, n) => spellIconUrl(n)).some((u) => !u)) {
      setTimeout(() => { if (host && choosingIcon) render(); }, 400);
    }
  }
  if (renaming !== null) {
    const form = el('form', 'sb-rename');
    const input = el('input');
    input.type = 'text';
    input.value = renaming;
    input.maxLength = 30;
    input.setAttribute('aria-label', enterSpellNameLabel().trim());
    input.oninput = () => { renaming = input.value; };
    const ok = el('button', 'act primary', 'Save');
    ok.type = 'submit';
    form.onsubmit = (e) => {
      e.preventDefault();
      const typed = renaming.trim();
      // L10N3e: the field opened on the name as shown; handed back as it was, the spell keeps its canonical name
      const name = typed === sel.name ? (sel.spell?.name ?? typed) : typed;
      if (name) editBookSpell(deps.spells?.(), sel.i, { name });   // AUDIT 68 S31-enhanced-rename-mutates-shared-spell: never the shared record
      renaming = null;
      render();
    };
    form.append(el('span', 'sb-renamelabel', enterSpellNameLabel().trim()), input, ok);
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
  closeOnOutsideTap(shell, '.px-win', () => onExit());   // OT1 (Mac: a tap outside the window closes it); the YesNo stands inside the window
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
  ask.append(el('p', 'px-note', deleteSpellPrompt()));
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
    notice = null; choosingIcon = false;
    render();
    return;
  }
  // ESCAPE and the host's own book key close it, the law U52's sheet
  // applies to F5 and the pack applies to F6. KB1: the comment said so and
  // the line read Escape alone - the book opened on CastSpell and did not
  // close on it. The registry's answer, as the pack reads its own.
  if (choosingIcon && overlayAction(e) === 'back') { e.preventDefault(); e.stopPropagation(); choosingIcon = false; render(); return; }   // SB-ICON: Escape shuts the grid, not the book
  if (overlayAction(e) !== 'back' && !eventMeans(e, 'CastSpell')) return;   // UXB1-S: its key, shared or not
  e.preventDefault();
  e.stopPropagation();
  // AUDIT KB1: the PRESS closes, the auto-repeat of a held key is swallowed - it closed the book, and the next
  // repeat reached the host with the slot empty and opened it again, open-shut for as long as the key was down
  if (!e.repeat) onExit();
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
  choosingIcon = false;
  render();
  window.addEventListener('keydown', onKey, true);
  setHotbarDropMode('book', true, d.entity ?? null);   // HB1: the bar comes up under the book as a drop target
  // DIAMOND-HB: a hotbar key pressed while hovering a spell (or else the selected spell) puts it on that slot
  setHotbarPick('book', {
    selected: () => { const sp = host && deleting === null ? bookModel(deps.spells?.() ?? [], deps.castCost)[picked]?.spell : null; return sp ? { kind: 'spell', spell: sp } : null; },
    changed: () => { if (host) render(); },
  });
  return {
    render,
    destroy() {
      window.removeEventListener('keydown', onKey, true);
      setHotbarDropMode('book', false);   // HB1
      host = null; deps = {}; picked = 0; notice = null; renaming = null; deleting = null; choosingIcon = false;
    },
  };
}
