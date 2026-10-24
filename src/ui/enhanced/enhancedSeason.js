// @ts-check
// SEASON-BOOK (2026-10-22, the owner: "I think we need a new pause menu icon, like we did for the timers and mail. A
// condensed place to see season related content and descriptions"; bible/10-UI/UI-Arc.md SEASON-BOOK).
//
// THE LAUREL. A wreath beside the envelope over the paused game (ui/enhanced/enhancedPost.js's mark, placed as it is -
// online only, as the hourglass: every clock it shows is the relay's) opens a window in the pause window's own frame: the
// season's three clocks, each its own section - the season and the boards it starts fresh (the player's own standing on
// each), the seats' Season, and the festival - with what each one holds, in a line apiece, and the time left on each
// counting down. The model is systems/seasonBook.js; this file draws it and keeps it live.
//
// AUDIT SEASON-BOOK (bible/01-Overview/audits/Audit-Season-Book.md): S2/U2 - every line is rewritten IN PLACE each
// second (a board's answer, the day turning), and the list is rebuilt only when its rows or their doors change - a door
// with the focus keeps it across that rebuild; U3 - the focus goes into the window when it OPENS, never when the face
// around it repaints; R1 - only the window's first read may ask the service; W1 - the moment and the countdown in the
// player's own language.
import { seasonBookModel } from '../../systems/seasonBook.js';
import { localWhenText } from '../../systems/eventTimers.js';
import { placeBeside } from './enhancedTimers.js';
import { t, intlLocale } from '../../systems/textManager.js';

/** How often the open window rewrites its countdowns and looks at its source, ms. */
export const SEASON_TICK_MS = 1000;

/** A row's door (systems/seasonBook.js `door`) -> its button's words. */
const SEASON_DOOR_TEXT = Object.freeze({
  arena: () => t('season.book.door.arena', 'Arena'),
  spire: () => t('season.book.door.spire', 'Boards'),
});

/**
 * WHAT THE WINDOW READS, off the pause face's hooks: the hourglass's source (hooks.timers - the relay's clock, the seats'
 * word, the Spire's boards' door) under the laurel's own reads (hooks.season - the boards), and the Arena's door once a
 * banner is worn. Null where there is no clock: offline, or before the relay's has been heard. `opening` - the window's
 * first read, the one that may ask the service (AUDIT SEASON-BOOK R1).
 * @param {any} hooks
 */
export function seasonSource(hooks, { opening = false } = {}) {
  const clock = hooks?.timers?.({ ask: opening }) ?? null;
  if (!clock) return null;
  const reads = hooks.season?.({ opening, now: clock.now }) ?? null;
  const arena = hooks.arenaJoined?.() && typeof hooks.openArena === 'function' ? () => hooks.openArena() : null;
  return { ...reads, now: clock.now, seatsOpen: clock.seatsOpen, zero: clock.zero, doors: { arena, spire: clock.doors?.board ?? null } };
}

/** THE TIME LEFT, as the hourglass counts it (eventTimers.js timerText) with its days' letters in the player's language
 *  (AUDIT SEASON-BOOK W1): "31d 04h", "4:07:09", "4:07". */
export function seasonLeftText(/** @type {number} */ ms) {
  const s = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const two = (/** @type {number} */ n) => String(n).padStart(2, '0');
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return t('season.book.leftDays', '{d}d {h}h', { d, h: two(h) });
  if (h > 0) return `${h}:${two(m)}:${two(sec)}`;
  return `${m}:${two(sec)}`;
}
/** @type {{ loc: string, fmt: Intl.DateTimeFormat|null }|null} */
let _when = null;
/** THE MOMENT, in the player's own clock and language (AUDIT SEASON-BOOK W1: the hourglass's localWhenText says it in
 *  English) - a weekday, the day, the month and the 24-hour time; localWhenText where the browser has no Intl. */
export function seasonWhenText(/** @type {number} */ wallMs) {
  const loc = intlLocale();
  if (_when?.loc !== loc) {
    let fmt = null;
    try { fmt = new Intl.DateTimeFormat(loc, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch { fmt = null; }
    _when = { loc, fmt };
  }
  return _when.fmt ? _when.fmt.format(wallMs) : localWhenText(wallMs);
}

/**
 * The laurel, the button beside the envelope. AUDIT SEASON-BOOK W11/U9: its name is the window's - "Season" - never a
 * list of sections the window may not hold.
 * @param {Document} doc
 * @param {{ onOpen: () => void, open?: boolean }} o
 */
export function seasonMark(doc, { onOpen, open = false }) {
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = 'px-seasonmark';
  b.setAttribute('aria-label', t('season.book.title', 'Season'));
  b.setAttribute('aria-haspopup', 'dialog');
  b.setAttribute('aria-expanded', open ? 'true' : 'false');
  b.title = t('season.book.title', 'Season');
  const wreath = doc.createElement('span');
  wreath.className = 'px-laurel';
  wreath.setAttribute('aria-hidden', 'true');
  b.append(wreath);
  b.addEventListener('click', () => onOpen());
  return b;
}

/** Stand the laurel at the end of the row of marks: each of `chain` (the hourglass, the envelope - either may be
 *  missing) placed beside the one before it, from the profile mark, and the laurel beside the last. Placed again on
 *  every resize of any of them, as the envelope is (enhancedPost.js anchorPost); the answer is the disconnect. */
export function anchorSeason(/** @type {any} */ mark, /** @type {any[]} */ chain, /** @type {any} */ profile, /** @type {any} */ host, gap = 10) {
  const marks = [...chain.filter(Boolean), mark];
  const place = () => { let at = profile; for (const m of marks) { placeBeside(m, at, host, gap); at = m; } };
  globalThis.requestAnimationFrame?.(place);
  const RO = globalThis.ResizeObserver;
  const ro = RO ? new RO(place) : null;
  for (const n of [profile, ...marks, host]) if (n) ro?.observe?.(n);
  globalThis.addEventListener?.('resize', place);
  globalThis.document?.fonts?.ready?.then?.(place).catch?.(() => {});
  return () => { ro?.disconnect?.(); globalThis.removeEventListener?.('resize', place); };
}

/** The list's shape - its sections, their lead and foot, their rows and each row's door: a change to it rebuilds the
 *  list; every word is written in place. */
const shapeOf = (/** @type {any} */ model) => JSON.stringify(model?.sections?.map((s) => [s.id, !!s.lead, !!s.foot, s.rows.map((r) => [r.id, r.door ?? null])]) ?? null);

/**
 * THE WINDOW. `read(opening)` answers seasonSource's shape, or null when there is no clock - `opening` true on the
 * window's first read alone. A row with a door carries its button, which hands the source's own door (`doors[door]`,
 * read at the press) to `door(fn)` - the pause face's handoff, as the hourglass's rows do. `focus` - the window was just
 * opened: the focus goes into it (a repaint of the face around an open window keeps the focus where it was). `when` the
 * moment's words (seasonWhenText). Answers { root, stop, draw, close }: the caller stops the tick when the window goes.
 * @param {Document} doc
 * @param {{ read: (opening: boolean) => any, onClose: () => void, every?: number, door?: (fn: () => any) => any, focus?: boolean, when?: (ms: number) => string }} o
 */
export function seasonWindow(doc, { read, onClose, every = SEASON_TICK_MS, door = (fn) => fn(), focus = true, when = seasonWhenText }) {
  const el = (/** @type {string} */ tag, /** @type {string|null} */ cls, /** @type {string|null} */ text = null) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const set = (/** @type {any} */ n, /** @type {string} */ text) => { if (n && n.textContent !== text) n.textContent = text; };
  const win = el('div', 'px-win px-seasonwin');
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'true');
  win.setAttribute('aria-labelledby', 'sb-title');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', 'px-gem px-corner px-' + c));
  const body = el('div', 'px-body');
  const head = el('div', 'sb-head');
  const title = el('h3', 'sb-title', t('season.book.title', 'Season'));
  title.id = 'sb-title';
  const close = el('button', 'act sb-close', t('season.book.close', 'Close'));
  /** @type {any} */ (close).type = 'button';
  close.addEventListener('click', () => onClose());
  head.append(title, close);
  const list = el('div', 'sb-list');
  body.append(head, list);
  win.append(body);

  /** @type {Map<string, any>} the drawn sections by id: their nodes, and their rows' */
  let drawn = new Map();
  let shape = null;   // never a model's shape, so the first draw always builds
  let first = true;
  const build = (/** @type {any} */ model) => {
    // the door with the focus, by its row - found again in the new list (AUDIT SEASON-BOOK S2/U2)
    const had = doc.activeElement;
    let kept = null;
    for (const [sid, s] of drawn) for (const [rid, r] of s.rows) if (r.door && r.door === had) kept = `${sid}:${rid}`;
    drawn = new Map();
    list.textContent = '';
    if (!model) list.append(el('p', 'sb-empty', t('season.book.noClock', 'The world\'s clock can\'t be read right now.')));
    for (const s of model?.sections ?? []) {
      const sec = el('section', 'sb-section sb-' + s.id);
      const shead = el('div', 'sb-shead');
      const stext = el('div', 'sb-stext');
      const stitle = el('h4', 'sb-stitle'), ssub = el('span', 'sb-ssub');
      stext.append(stitle, ssub);
      const clock = el('div', 'sb-clock');
      const count = el('span', 'sb-count'), whenAt = el('span', 'sb-when');
      clock.append(count, whenAt);
      shead.append(stext, clock);
      sec.append(shead);
      const lead = s.lead ? el('p', 'sb-lead') : null;
      if (lead) sec.append(lead);
      const rows = new Map();
      for (const r of s.rows) {
        const row = el('div', 'sb-row sb-' + r.id);
        const text = el('div', 'sb-text');
        const line = el('div', 'sb-line');
        const name = el('span', 'sb-name'), standing = el('span', 'sb-standing'), about = el('p', 'sb-about');
        line.append(name, standing);
        text.append(line, about);
        row.append(text);
        // the row's door - a button as Close is, so a press, a tap and the pad's walk reach it alike; the source's
        // door is read at the press, never kept from the draw
        const words = r.door ? SEASON_DOOR_TEXT[r.door] : null;
        let go = null;
        if (words) {
          go = el('button', 'act sb-door', words());
          /** @type {any} */ (go).type = 'button';
          const which = r.door;
          go.addEventListener('click', () => { const fn = read(false)?.doors?.[which]; if (typeof fn === 'function') door(fn); });
          row.append(go);
        }
        sec.append(row);
        rows.set(r.id, { name, standing, about, door: go });
      }
      const foot = s.foot ? el('p', 'sb-foot') : null;
      if (foot) sec.append(foot);
      list.append(sec);
      drawn.set(s.id, { title: stitle, sub: ssub, lead, foot, count, when: whenAt, rows });
    }
    if (kept) {
      const [sid, rid] = kept.split(':');
      drawn.get(sid)?.rows.get(rid)?.door?.focus?.({ preventScroll: true });
    }
  };
  const draw = () => {
    const src = read(first);
    first = false;
    const model = src ? seasonBookModel(src) : null;
    const now = Number(src?.now) || Date.now();
    const offset = now - Date.now();   // the relay's clock against this machine's - the local time is the machine's
    const nextShape = shapeOf(model);
    if (nextShape !== shape) { shape = nextShape; build(model); }
    for (const s of model?.sections ?? []) {
      const d = drawn.get(s.id);
      if (!d) continue;
      set(d.title, s.title);
      set(d.sub, s.sub);
      if (d.lead) set(d.lead, s.lead);
      if (d.foot) set(d.foot, s.foot);
      for (const r of s.rows) {
        const n = d.rows.get(r.id);
        if (!n) continue;
        set(n.name, r.name);
        set(n.about, r.about);
        set(n.standing, r.standing ?? '');
        if (n.standing.hidden !== !r.standing) n.standing.hidden = !r.standing;
      }
      set(d.count, seasonLeftText(s.at - now));
      const at = when(s.at - offset);
      set(d.when, s.atLabel === 'opens' ? t('season.book.opens', 'opens {when}', { when: at }) : t('season.book.ends', 'ends {when}', { when: at }));
    }
  };
  let tick = null;
  // a window taken out of the page without its stop stops itself on the next tick (AUDIT TIMERS1 UI-10's law)
  const step = () => { if (win.isConnected === false && tick) { clearInterval(tick); tick = null; return; } draw(); };
  draw();
  tick = setInterval(step, every);
  // AUDIT SEASON-BOOK U3: the focus goes into the window when it opens - never pulled out of it by a repaint of the face,
  // and never scrolling the list
  if (focus) globalThis.requestAnimationFrame?.(() => close.focus?.({ preventScroll: true }));
  return { root: win, stop: () => { if (tick) clearInterval(tick); tick = null; }, draw, close };
}
