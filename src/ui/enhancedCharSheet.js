// ═══════════════════════════════════════════════════════════════════
// U52 — THE ENHANCED CHARACTER SHEET
//
// The first of the port's IN-GAME screens to grow an enhanced twin.
// ui/charSheetDoor.js chooses; this draws.
//
// ── THE DENSITY ARGUMENT, WHICH IS THIS SCREEN'S WHOLE POINT ─────
//
// src/tools/enhancedUI.js's header makes it: Daggerfall has 35 skills
// where Skyrim has 18, and the density IS the game. The classic sheet
// answers that by showing NINE of them - keys 1-4 pop a text panel over
// the art and `_drawSkillPage` slices to `ids.slice(0, 9)`, because a
// 320x200 panel has nowhere else to put them. A player who wants to
// compare a Major against a Miscellaneous presses two keys and
// remembers the first number.
//
// So this screen shows every skill the character HAS a career for, in
// DFU's own three groups, and puts the twenty-odd Miscellaneous ones
// one press away rather than absent. Disclosure, not deletion - which
// is the prototype's rule and the reason it is not simply "Skyrim's
// sheet with Daggerfall's words in it".
//
// ── THE NUMBERS ARE THE CLASSIC SHEET'S ──────────────────────────
//
// Every figure here comes from the same expression
// ui/charsheet.js draws: liveStat for the eight attributes (so a
// magical drain shows), maxFatigue with DFU's /64 display divisor,
// FormulaHelper.MaxEncumbrance over liveStat strength, and
// `carriedWeight` - which was module-private in that file and is
// EXPORTED for this one rather than re-reduced here. `sheetModel` is
// pure and separate precisely so a node test can hold it against the
// classic window's own draw() and prove the two sheets never disagree
// about a number.
//
// ── WHAT IT DOES NOT DRAW ────────────────────────────────────────
//
// THE PAPERDOLL. The classic sheet composes it at DFU's (200,8) and
// the prototype answers the same slot with a 28-node body schematic -
// but that schematic is the INVENTORY's signature, it wants
// tools/enhancedVisuals.js and the three.js tag enhanced.html loads
// from a CDN, and the port's doctrine has exactly one third-party
// request in it already (Ledger A, the web fonts). It belongs to the
// inventory slice with the equip map it explains. Recorded as a real
// loss rather than dropped quietly.
//
// THE LEVEL-UP SCREEN stays classic: it is a different window
// (LevelUpScreen), the hosts push it themselves, and it mutates stats
// through chargen's verbatim clamps. Not this door's business.
// ═══════════════════════════════════════════════════════════════════

import { STAT_KEYS_ORDER } from '../systems/chargen.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { liveStat, maxFatigue, FATIGUE_MULTIPLIER } from '../systems/statMods.js';
import { entityMaxEncumbrance } from '../combat/formulas.js';   // AUDIT 26: PlayerEntity.MaxEncumbrance, enchantment allowance and all
import { carriedWeight, NAV_BUTTONS } from './charsheet.js';
import { totalGoldAmount } from '../systems/court.js';   // PlayerEntity.GetGoldAmount, the figure the classic sheet draws
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { repaintKeepingScroll } from './domRepaint.js';
import { overlayAction } from './input.js';

/** The three career groups, in DFU's own order, plus the remainder.
 *  `_drawSkillPage`'s `names` array, which is what keys 1-4 page. */
export const SKILL_GROUPS = Object.freeze(['Primary', 'Major', 'Minor', 'Miscellaneous']);

/**
 * THE SHEET, as data. Pure: no DOM, no entity mutation, every figure
 * lifted from the expression ui/charsheet.js's draw() uses.
 *
 * Miscellaneous is "every skill in no career group", which is
 * `_drawSkillPage`'s own definition and NOT a fixed list - a career
 * with a different spread moves skills between groups and this follows
 * it.
 */
export function sheetModel(entity) {
  const e = entity ?? {};
  const career = [
    e.career?.primarySkills ?? [],
    e.career?.majorSkills ?? [],
    e.career?.minorSkills ?? [],
  ];
  const inCareer = new Set(career.flat());
  const misc = SKILL_NAMES.map((_, id) => id).filter((id) => !inCareer.has(id));
  const strength = liveStat(e, 'strength');
  return {
    name: e.name ?? '',
    // The classic sheet's own default when an entity carries none.
    race: e.race ?? 'Breton',
    career: e.career?.name ?? '',
    level: e.level ?? 1,
    // The classic sheet's own read: GetGoldAmount, coins plus every
    // letter of credit (DaggerfallCharacterSheetWindow.cs:401).
    gold: totalGoldAmount(e),
    health: { now: e.health ?? 0, max: e.maxHealth ?? 0 },
    magicka: { now: e.magicka ?? 0, max: e.maxMagicka ?? 0 },
    // FatigueMultiplier is the DISPLAY divisor: DFU stores fatigue in
    // points and the sheet draws points/64. The constant is
    // statMods.js's own export, not a fourth copy of the number -
    // ui/charsheet.js had two inline and this would have been the
    // third and fourth.
    fatigue: {
      now: Math.trunc((e.fatigue ?? maxFatigue(e)) / FATIGUE_MULTIPLIER),
      max: Math.trunc(maxFatigue(e) / FATIGUE_MULTIPLIER),
    },
    encumbrance: { now: Math.trunc(carriedWeight(e)), max: entityMaxEncumbrance(e) },
    attributes: STAT_KEYS_ORDER.map((key) => ({ key, value: liveStat(e, key) })),
    groups: SKILL_GROUPS.map((name, i) => ({
      name,
      ids: i < 3 ? career[i] : misc,
      // The three career groups are the character's chosen shape and
      // open; the remainder is the disclosure.
      career: i < 3,
    })),
    skill: (id) => e.skills?.[id] ?? 0,
  };
}

// ── THE VIEW ─────────────────────────────────────────────────────

let host = null;
let model = null;
let hooks = {};
let openChild = () => false;
let onExit = () => {};
let showAll = false;      // the Miscellaneous disclosure
let notice = null;        // why a nav button did nothing, when it could not
let keyHandler = null;
let lockHandler = null;

const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

/** A labelled bar. The three vitals and the eight attributes are the
 *  same shape at two scales, so they are the same function. */
function meter(label, now, max, tone) {
  const row = el('div', 'meter');
  row.append(el('span', 'meter-k', label));
  row.append(el('span', 'meter-v', max ? `${now} / ${max}` : String(now)));
  const track = el('div', 'meter-track');
  const fill = el('div', `meter-fill ${tone}`);
  // A max of 0 is a real entity state (a character with no magicka),
  // and 0/0 must read as empty rather than throw or fill.
  fill.style.width = `${max > 0 ? Math.max(0, Math.min(100, (now / max) * 100)) : 0}%`;
  track.append(fill);
  row.append(track);
  return row;
}

function identity() {
  const h = el('header', 'sheet-id');
  const who = el('div');
  who.append(el('h2', null, model.name || 'Unnamed'));
  who.append(el('p', 'meta', [model.race, model.career, `level ${model.level}`]
    .filter(Boolean).join(' · ')));
  h.append(who);
  const close = el('button', 'act', 'Close');
  close.onclick = () => onExit();
  h.append(close);
  return h;
}

function attributesCol() {
  const col = el('section', 'sheetcol');
  col.append(el('h3', 'colhead', 'Attributes'));
  // Every attribute is drawn against 100, which is chargen's own
  // ceiling (statUp clamps there) - so the bar means the same thing on
  // every row and a 100 reads as full rather than as "the biggest one".
  for (const { key, value } of model.attributes) {
    col.append(meter(key[0].toUpperCase() + key.slice(1), value, 100, 'brass'));
  }
  return col;
}

function skillsCol() {
  const col = el('section', 'sheetcol');
  col.append(el('h3', 'colhead', 'Skills'));
  for (const g of model.groups) {
    if (!g.career && !showAll) continue;
    if (!g.ids.length) continue;
    col.append(el('h4', 'skillgroup', g.name));
    for (const id of g.ids) {
      const row = el('div', `skillrow${g.career ? ' career' : ''}`);
      row.append(el('span', 'skill-k', SKILL_NAMES[id] ?? `Skill ${id}`));
      row.append(el('span', 'skill-v', `${model.skill(id)}%`));
      col.append(row);
    }
  }
  // DISCLOSURE, NOT DELETION. The classic sheet pages nine at a time
  // behind keys 1-4; this is the same information one press away.
  const misc = model.groups[3];
  if (misc.ids.length) {
    const b = el('button', 'act more', showAll
      ? 'Hide the miscellaneous skills'
      : `Show all ${SKILL_NAMES.length} skills`);
    b.onclick = () => { showAll = !showAll; render(); };
    col.append(b);
  }
  return col;
}

function conditionCol() {
  const col = el('section', 'sheetcol');
  col.append(el('h3', 'colhead', 'Condition'));
  col.append(meter('Health', model.health.now, model.health.max, 'blood'));
  col.append(meter('Magicka', model.magicka.now, model.magicka.max, 'verdigris'));
  col.append(meter('Fatigue', model.fatigue.now, model.fatigue.max, 'brass'));
  col.append(meter('Encumbrance', model.encumbrance.now, model.encumbrance.max, 'iron'));
  const c = el('div', 'card');
  c.append(el('h3', null, 'Purse'));
  const dl = el('dl', 'stats');
  dl.append(el('dt', null, 'Gold'), el('dd', null, model.gold.toLocaleString()));
  c.append(dl);
  col.append(c);
  return col;
}

/** THE FOUR NAVIGATION BUTTONS - the same four the classic sheet has
 *  since U32, opening the same four windows through the same hooks. A
 *  hook the host did not hand is a window that host cannot open, and
 *  the button is not drawn: the classic sheet answers the press with a
 *  notice because its rects are painted into the art and cannot be
 *  removed. This one can remove them, so it does. */
function nav() {
  const n = el('nav', 'sheet-nav');
  const label = { inventory: 'Inventory', spellbook: 'Spellbook', logbook: 'Logbook', history: 'History' };
  for (const which of NAV_BUTTONS) {
    if (typeof hooks[which] !== 'function') continue;
    const b = el('button', 'act', label[which]);
    b.onclick = () => {
      notice = null;
      // The child is a CANVAS window and the door hides this div while
      // it is up - see ui/charSheetDoor.js. A refusal at this point is
      // the hook returning null, which a host does when the window
      // exists but not here (art not loaded, no loot target).
      if (!openChild(which)) { notice = `${label[which]} is out of reach here.`; render(); }
    };
    n.append(b);
  }
  return n;
}

function render() {
  repaintKeepingScroll(host, () => {
    host.innerHTML = '';
    const shell = el('div', 'sheet-shell');
    shell.append(identity());
    const grid = el('div', 'sheet');
    grid.append(attributesCol(), skillsCol(), conditionCol());
    shell.append(grid);
    if (notice) shell.append(el('p', 'sheet-notice', notice));
    shell.append(nav());
    host.append(shell);
  });
}

// ── THE KEYBOARD ─────────────────────────────────────────────────
// ESCAPE AND F5, the two keys the classic sheet closes on, and nothing
// else. Keys 1-4 page the classic sheet's skill groups over its art;
// here all four groups are on the screen at once, so there is no page
// to turn and a 1-4 arm would be a key that appears to do nothing.
//
// F5 IS NOT IN overlayAction. That table is the shared overlay
// vocabulary (back/confirm/up/down) and F5 is a host BINDING, so it is
// read from the event - and claimed, because an unclaimed F5 is a
// browser reload that destroys the session (AUDIT 17e F41's finding,
// one window over).
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (overlayAction(e) !== 'back' && e.key !== 'F5') return;
  e.preventDefault();
  // A MODAL OVERLAY OWNS ITS INPUT: on capture and stopped here, so the
  // host's own keydown - which walks the player and would re-toggle
  // this very screen - never sees a key this screen used.
  e.stopPropagation();
  onExit();
}

/** The pointer lock, the wizard's law: mouselook is the port's resting
 *  state, so this always mounts over a locked pointer, and a locked
 *  pointer never reaches the DOM at any z-index. */
function releaseLock() {
  try {
    if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
  } catch { /* a browser that refuses is a browser with no lock to drop */ }
}

/**
 * Mount the sheet. `open(which)` is the door's push - it returns false
 * when the host handed no factory - and `onExit` takes the whole
 * overlay down.
 */
export function mountEnhancedCharSheet(hostEl, {
  entity, hooks: h = {}, open = () => false, onExit: exit = () => {},
} = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  host = hostEl;
  model = sheetModel(entity);
  hooks = h;
  openChild = open;
  onExit = exit;
  showAll = false;
  notice = null;
  render();
  keyHandler = onKey;
  globalThis.addEventListener('keydown', keyHandler, { capture: true });
  lockHandler = releaseLock;
  releaseLock();
  if (typeof document !== 'undefined') document.addEventListener('pointerlockchange', lockHandler);
  globalThis.__sheet = () => JSON.stringify({
    name: model.name, level: model.level, showAll,
    attributes: model.attributes.length,
    shown: [...hostEl.querySelectorAll('.skillrow')].length,
    nav: [...hostEl.querySelectorAll('.sheet-nav button')].map((b) => b.textContent),
    notice,
  });
  return {
    /** The door repaints on a child popping - the pack may have
     *  changed while the inventory was up, and this screen's
     *  encumbrance and gold are read FROM the pack. */
    repaint() { model = sheetModel(entity); render(); },
    unmount() {
      // EVERY LISTENER HAS AN OWNER. A window-level keydown outlives
      // the DOM it was mounted for, and this one claims F5 - so a sheet
      // torn down without this eats the key that opens it, and the
      // sheet can never be opened again.
      if (keyHandler) globalThis.removeEventListener('keydown', keyHandler, { capture: true });
      if (lockHandler && typeof document !== 'undefined') document.removeEventListener('pointerlockchange', lockHandler);
      keyHandler = null;
      lockHandler = null;
      hostEl.innerHTML = '';
      host = null;
      hooks = {};
      openChild = () => false;
      onExit = () => {};
      delete globalThis.__sheet;
    },
  };
}
