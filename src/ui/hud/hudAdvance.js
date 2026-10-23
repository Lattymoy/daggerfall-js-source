// SKILL-READY / FIRM-STARS (2026-10-20, Dudey: "add a symbol that tells you when you hover over it that you have stars
// not applied for the firmament ... on the right of the renown bar and when skills are ready to level up left of the
// renown bar (dont use this annoying message bar for this anymore) and when you click the firmament symbol it can bring
// you to firmament"; "The new skill up symbol and firmament points symbol should also be movable with alt + u"; "make sure
// those symbols have the same quality as buffs and debuffs symbols") - THE TWO TILES BESIDE THE RENOWN BAR.
//
//   left   the skills a rest or a journey would raise (levelNotice.js skillsImprovable - the count the level strip's
//          standing line said, which the strip no longer draws), their number at the tile's foot
//   right  the Firmament's stars not yet placed (the book's purses less the tree in force - firmamentLaw.js pointsLeft),
//          their number at its foot; a press opens the Growth tab's Firmament page
//
// Each is a status tile the HUD builds (ui/enhanced/enhancedHud.js advTile: the buffs' own frame and their 16px glyphs -
// ui/hud/hudStatus.js STATUS_GLYPHS skillup and firmstar) standing in the Renown row's page, and each is its own piece
// of the movable HUD (ui/hud/hudLayout.js skillsReady, starsUnspent). This module says what they count, binds their
// presses and their hover card (the pack's - ui/hud/hudTip.js), and keeps them clear of the hotbar.
//
// THE BOOK IS READ HERE ONCE. The Firmament's book (net/firmament/firmamentBook.js) is read when its window opens; a
// player who never opened it this session has a book that does not know its purses. So the tiles ask it once, and again
// when the Renown level they see rises (a rise brings stars) or a read found no sky yet (BOOK_RETRY_MS), never more than once
// in ASK_EVERY_MS.

import { skillsImprovable } from '../levelUp/levelNotice.js';
import { firmamentBook } from '../../net/firmament/firmamentBook.js';
import { pointsLeft } from '../../net/firmament/firmamentLaw.js';
import { hudRenown } from './hudRenown.js';
import { bindHudTips, hideHudTip, hudTipShowing } from './hudTip.js';
import { hudArranging } from './hudLayout.js';

/** The fewest milliseconds between two reads of the book this module asks for. */
export const ASK_EVERY_MS = 15_000;
/** How long a book that answered no sky (no session yet, offline for a moment) waits before it is asked again. */
export const BOOK_RETRY_MS = 120_000;

/** The pause page a press on the stars opens (ui/growth/growthPages.js). */
export const FIRM_PAGE = 'firmament';

/** The host's way to open a pause page by name - the world host's `modes.openPauseAt`, else its own pause (scenes/world.js
 *  hands it in). Null where no host gave one: the tile then says what it is and opens nothing. */
let _pauseAt = null;
export function setHudPauseAt(fn) { _pauseAt = typeof fn === 'function' ? fn : null; }

/** The words. */
export const ADV_WORDS = Object.freeze({
  skillTitle: 'Skills ready',
  skillLine: (n) => `${n === 1 ? 'One skill has' : `${n} skills have`} earned a rise. Rest or travel to raise ${n === 1 ? 'it' : 'them'}.`,
  starsTitle: 'Firmament stars',
  starsLine: (stars, craft) => {
    const parts = [];
    if (stars > 0) parts.push(`${stars} ${stars === 1 ? 'star' : 'stars'}`);
    if (craft > 0) parts.push(`${craft} craft ${craft === 1 ? 'point' : 'points'}`);
    return `You have ${parts.join(' and ')} not yet placed in your Firmament.`;
  },
  starsGo: 'Click to open your Firmament.',
  starsNoDoor: 'Open it from the Growth tab of the pause menu.',
});

/** What the stars' tile says: the purses less the tree in force - or null while the book does not know (unread, shut,
 *  offline). Pure over a book's `state`. */
export function unplacedStars(state) {
  if (!state || state.open !== true) return null;
  const keys = state.sending?.keys ?? state.tree?.keys ?? [];
  const left = pointsLeft(keys, Number(state.stars) || 0, Number(state.craft) || 0);
  return { stars: Math.max(0, left.stars | 0), craft: Math.max(0, left.craft | 0) };
}

let _askedAt = -Infinity;
let _askedLevel = null;
/** Ask the book once, and again when the Renown level seen rose. Answers whether a read was asked. */
export function askBookWhenDue(book, level, now) {
  if (!book || typeof book.read !== 'function' || book.state?.sending) return false;
  if (now - _askedAt < ASK_EVERY_MS) return false;
  const unread = book.state?.open == null && _askedLevel == null;
  const rose = level != null && _askedLevel != null && level > _askedLevel;
  const stale = book.state?.open !== true && now - _askedAt >= BOOK_RETRY_MS;   // a read that found no session yet (the boot's first frames)
  if (!unread && !rose && !stale) { if (_askedLevel == null && level != null) _askedLevel = level; return false; }
  _askedAt = now;
  _askedLevel = level ?? _askedLevel ?? 0;
  try { book.read()?.catch?.(() => {}); } catch { /* the book's own failure is its word */ }
  return true;
}
/** For the pins: forget what was asked. */
export function _resetAdvanceForTests() { _askedAt = -Infinity; _askedLevel = null; }

/** Bind the two tiles the HUD built (ui/enhanced/enhancedHud.js - the cells are the HUD's, their classes its own words):
 *  their presses, the stars' door and the hover cards. `parts` is `{ skill: { cell }, firm: { cell } }`; the counts the
 *  cards read are written on it by drawAdvanceTiles. */
export function bindAdvanceTiles(parts) {
  const { skill, firm } = parts;
  parts.stars = null; parts.skills = 0;
  // a press on a tile is the tile's: the hosts swing from a WINDOW mousedown (BUFF-END's law), so it goes no further
  for (const t of [skill, firm]) {
    t.cell.addEventListener?.('mousedown', (e) => { if (!hudArranging()) e.stopPropagation(); });
    t.cell.addEventListener?.('mouseup', (e) => { if (!hudArranging()) e.stopPropagation(); });
  }
  firm.cell.addEventListener?.('click', (e) => {
    if (hudArranging() || !_pauseAt) return;   // the editor's drag is no press
    e.stopPropagation();
    hideHudTip();
    try { _pauseAt(FIRM_PAGE); } catch { /* the host's door, its own failure */ }
  });
  const tipOf = (target) => {
    if (hudArranging()) return null;
    if (skill.cell.contains(target) && parts.skills > 0) {
      return { node: skill.cell, key: 'adv:skill', tip: { title: ADV_WORDS.skillTitle, meta: 'Skills', lines: [ADV_WORDS.skillLine(parts.skills)] } };
    }
    if (firm.cell.contains(target) && parts.stars) {
      return { node: firm.cell, key: 'adv:firm', tip: { title: ADV_WORDS.starsTitle, meta: 'Firmament',
        lines: [ADV_WORDS.starsLine(parts.stars.stars, parts.stars.craft)], foot: _pauseAt ? ADV_WORDS.starsGo : ADV_WORDS.starsNoDoor } };
    }
    return null;
  };
  bindHudTips(skill.cell, tipOf);
  bindHudTips(firm.cell, tipOf);
  return parts;
}

/** CLEAR-HOTBAR (2026-10-20, Dudey: "make sure the symbols are not under the hotbar ... still in the same line as the
 *  exp but not under the hotbar"): how far past each end of the Renown row a tile stands, in the row's own pixels - its
 *  10px, or past the hotbar's end where the hotbar above is wider than the row. Pure over two screen rectangles and the
 *  row's scale (its drawn width over its own). */
export const ADV_GAP = 10;
export function advanceReach(row, bar, scale = 1) {
  const k = scale > 0 ? scale : 1;
  if (!row || !bar || !(bar.width > 0)) return { left: ADV_GAP, right: ADV_GAP };
  return {
    left: Math.max(ADV_GAP, Math.ceil((row.left - bar.left) / k) + ADV_GAP),
    right: Math.max(ADV_GAP, Math.ceil((bar.right - row.right) / k) + ADV_GAP),
  };
}
const MEASURE_EVERY = 20;
let _tick = 0;
function placeTiles(parts, row) {
  if (!row || (_tick = (_tick + 1) % MEASURE_EVERY) !== 1) return;
  const r = row.getBoundingClientRect?.();
  if (!r || !(r.width > 0)) return;
  const hb = row.ownerDocument?.querySelector?.('.hud .hb');
  const b = hb?.getBoundingClientRect?.();
  const shown = b && b.width > 0 && b.height > 0 && globalThis.getComputedStyle?.(hb)?.visibility !== 'hidden';
  const reach = advanceReach(r, shown ? b : null, r.width / (row.offsetWidth || r.width));
  const l = `${reach.left}px`, rt = `${reach.right}px`;
  if (parts.reachL !== l) { parts.reachL = l; row.style.setProperty('--adv-left', l); }
  if (parts.reachR !== rt) { parts.reachR = rt; row.style.setProperty('--adv-right', rt); }
}

/**
 * One frame: which tiles stand and what their feet say, and (now and then) how far out they stand - clear of the
 * hotbar (CLEAR-HOTBAR). Answers the two counts - the skills ready and the stars not placed; the HUD stands its tiles
 * by them (and the row for them, offline where it has no bar of its own). `hidden` the HUD's own gate, `row` the
 * Renown row they stand in.
 */
export function drawAdvanceTiles(parts, { hidden = false, now = Date.now(), row = null } = {}) {
  if (!parts) return { skills: 0, stars: 0 };
  if (!hidden) placeTiles(parts, row);   // CLEAR-HOTBAR
  let skills = 0;
  let stars = null;
  if (!hidden) {
    try { skills = skillsImprovable() | 0; } catch { skills = 0; }
    const book = firmamentBook();
    if (book) {
      askBookWhenDue(book, hudRenown()?.level ?? null, now);
      stars = unplacedStars(book.state);
    }
  }
  const starsN = stars ? stars.stars + stars.craft : 0;
  parts.skills = skills;
  parts.stars = starsN > 0 ? stars : null;
  const up = hudTipShowing();
  if ((up === 'adv:skill' && !(skills > 0)) || (up === 'adv:firm' && !(starsN > 0))) hideHudTip();
  return { skills, stars: starsN };
}
