// @ts-check
// TIMERS1 (2026-10-02, Mac: "we need to create a new unique UI element for reset times like the Sunday wars, oblivion
// gates, town raids, and anything else so the player can keep track of when things are and watch countdowns. Im
// thinking maybe an enhanced plus button on the pause menu next to the profile icon").
//
// THE TIMERS WINDOW. An hourglass beside the profile mark over the paused game (online only - every row is a shared
// moment of the relay's world) opens a window in the pause window's own frame: what is running NOW, counting down to
// its end, then what is COMING, soonest first, each with the moment in the player's own clock. The rows are
// systems/eventTimers.js's - this file draws them and keeps them live: once a second the countdowns are rewritten in
// place, and the list is rebuilt only when a row starts, ends or arrives (a live window, the world running under it).
//
// TIMERS2 (2026-10-22, the owner: "organize the timer system in the pause menu"): THE WINDOW IN GROUPS. The rows stand
// under what they are - World events, the Battlespire, Town raids, Seats and battles, Resets (eventTimers.js
// TIMER_GROUPS) - each group's head saying how many of its rows are under way, and a row under way wears its own "Now"
// above its countdown. A bar of buttons over the list shows every group or one alone (All, World, Spire, Raids, Seats,
// Resets - a group with no row has no button), kept while the game runs; a group that empties hands the list back to All,
// and All is the choice then. The window stands at one height and its list scrolls under the bar (AUDIT TIMERS2 H1, M6).
import { eventTimerRows, timerText, localWhenText, timerGroups } from '../../systems/eventTimers.js';
import { t } from '../../systems/textManager.js';   // TIMERS2: the groups' words in the player's language

/** EG-ZM: a row's door (systems/eventTimers.js `door`) -> its button's words. */
export const TIMER_DOOR_TEXT = Object.freeze({ board: 'Boards' });

/** A row's kind -> its marker class (colour in the sheet). */
export const TIMER_KINDS = Object.freeze(['gate', 'serpent', 'super', 'star', 'ketch', 'elite', 'raid', 'battle', 'seat', 'reset']);   // KETCH: the Sky-Ketch's; SERPENT-TIMERS: the sea serpent's; SD2c: the Super dungeon's, once found; STAR6: a fallen star's; TIMERS2: the Elite Breach's, in its arch's gold (it drew in no colour)

/** TIMERS2: a group's head (its title) and its button in the bar (a short word), in the player's language. */
export const timerGroupTitle = (id) => ({
  world: () => t('timers.group.world', 'World events'),
  spire: () => t('timers.group.spire', 'The Battlespire'),
  raids: () => t('timers.group.raids', 'Town raids'),
  seats: () => t('timers.group.seats', 'Seats and battles'),
  resets: () => t('timers.group.resets', 'Resets'),
})[id]?.() ?? '';
export const timerGroupChip = (id) => ({
  all: () => t('timers.chip.all', 'All'),
  world: () => t('timers.chip.world', 'World'),
  spire: () => t('timers.chip.spire', 'Spire'),
  raids: () => t('timers.chip.raids', 'Raids'),
  seats: () => t('timers.chip.seats', 'Seats'),
  resets: () => t('timers.chip.resets', 'Resets'),
})[id]?.() ?? '';
/** TIMERS2: the group a player last showed, kept while the game runs - the window opens on it again. */
let shownGroup = 'all';

/**
 * The hourglass, the button beside the profile mark.
 * @param {Document} doc
 * @param {{ onOpen: () => void, open?: boolean }} o
 */
export function timersMark(doc, { onOpen, open = false }) {
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = 'px-timersmark';
  b.setAttribute('aria-label', 'Timers: gates, the sea serpent, the Abyss Dungeon, the Starfall, the Sky-Ketch, raids, battles and resets');   // SD2c: its row; STAR6: the Starfall's; KETCH: the Sky-Ketch's
  b.setAttribute('aria-haspopup', 'dialog');   // AUDIT TIMERS1 UI-6
  b.setAttribute('aria-expanded', open ? 'true' : 'false');
  b.title = 'Timers';
  const glass = doc.createElement('span');
  glass.className = 'px-hourglass';
  glass.setAttribute('aria-hidden', 'true');
  b.append(glass);   // HOURGLASS-ALONE (2026-10-04, the owner: "remove the text \"timer\" from next of the hourglass"): the glass alone - its name is the label's and the title's
  b.addEventListener('click', () => onOpen());
  return b;
}

/** Stand the hourglass just left of the profile mark - whose width is its caption's, so it is measured, not assumed.
 *  `host` the positioned box both stand in. */
export function placeBeside(mark, profile, host, gap = 10) {
  if (!mark || !profile || !host?.getBoundingClientRect) return;
  const p = profile.getBoundingClientRect(), h = host.getBoundingClientRect();
  if (!p.width) return;
  mark.style.right = `${Math.round(h.right - p.left + gap)}px`;
  mark.style.top = `${Math.round(p.top - h.top + (p.height - (mark.offsetHeight || p.height)) / 2)}px`;
}

/** AUDIT TIMERS1 UI-3: placed ONCE, the hourglass stood on the profile's caption after a phone turned (the pause face
 *  re-renders on no resize) and wherever the caption changed width - the web font landing, a sign-in. It is placed
 *  again whenever either box or the window changes size; the answer is the disconnect, for the caller's teardown. */
export function anchorBeside(mark, profile, host, gap = 10) {
  const place = () => placeBeside(mark, profile, host, gap);
  globalThis.requestAnimationFrame?.(place);
  const RO = globalThis.ResizeObserver;
  const ro = RO ? new RO(place) : null;
  ro?.observe?.(profile); ro?.observe?.(host);
  globalThis.addEventListener?.('resize', place);
  globalThis.document?.fonts?.ready?.then?.(place).catch?.(() => {});
  return () => { ro?.disconnect?.(); globalThis.removeEventListener?.('resize', place); };
}

/**
 * The window. `read()` answers the host's live source for eventTimerRows - { now, gate, seats, zero, raids } with
 * `now` the relay's clock - or null when there is none (offline). Returns { root, stop }: the caller stops the tick
 * when the window goes (a render, an unmount). EG-ZM: a row with a door (`door` - the boards' on an Elite row) carries
 * its button, which hands the source's own door (`doors[door]`, read at the press) to `door(fn)` - the caller's way of
 * opening it (the pause face hands its place on first). TIMERS2: `group` the group it opens on ('all', or a
 * TIMER_GROUPS id) - the one last shown when unsaid.
 * @param {Document} doc
 * @param {{ read: () => any, onClose: () => void, every?: number, door?: (fn: () => any) => any, group?: string, focus?: boolean }} o
 */
export function timersWindow(doc, { read, onClose, every = 1000, door = (fn) => fn(), group = shownGroup, focus = true }) {
  const el = (tag, cls, text) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  /** TIMERS2: a class list from its names, the ones not given left out. */
  const classes = (...names) => names.filter(Boolean).join(' ');
  const win = el('div', 'px-win px-timerswin');
  // AUDIT TIMERS1 UI-6: a dialog, said so - modal over the pause face, named by its title
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'true');
  win.setAttribute('aria-labelledby', 'tm-title');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));
  const body = el('div', 'px-body');
  const head = el('div', 'tm-head');
  const title = el('h3', 'tm-title', 'Timers');
  title.id = 'tm-title';
  head.append(title);
  const close = el('button', 'act tm-close', 'Close');
  /** @type {any} */ (close).type = 'button';
  close.addEventListener('click', () => onClose());
  head.append(close);
  body.append(head);
  body.append(el('p', 'tm-lead', 'Times are shown in your local time. The countdowns update live.'));
  // TIMERS2: the bar - All and a button for each group that has a row, the one shown pressed
  const bar = el('div', 'tm-groups');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', t('timers.groups', 'Which timers to show'));   // AUDIT TIMERS2 L8: "Show" said nothing
  body.append(bar);
  const list = el('div', 'tm-list');
  body.append(list);
  win.append(body);

  let showing = group;
  /** @type {Map<string, any>} */
  let cells = new Map();
  /** @type {Map<string, { b: any, count: any }>} */
  let chips = new Map();
  let shape = null;   // never a list's shape, so the first draw always builds (an empty one says so)
  let barIds = null;
  /** AUDIT TIMERS2 M3: a button's words, count, mark and state, written in place - the same buttons while the groups are
   *  the same groups (a rebuild at a live row's start lost a press caught between its down and its up, and the focus) */
  const chipSay = ({ b, count }, id, n, live) => {
    const on = id === showing;
    b.className = classes('act', 'tm-chip', `tm-chip-${id}`, on && 'on', live && 'live');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    // AUDIT TIMERS2 L8: the mark that one is under way is in the button's name too, not its colour alone
    b.setAttribute('aria-label', `${timerGroupChip(id)} ${n}${live ? `, ${t('timers.underWay', '{n} under way', { n: live })}` : ''}`);
    if (count.textContent !== String(n)) count.textContent = String(n);
  };
  const draw = () => {
    const src = read();
    const rows = src ? eventTimerRows(src) : [];
    const now = Number(src?.now) || Date.now();
    const offset = now - Date.now();   // the relay's clock against this machine's - the local time is the machine's
    const groups = timerGroups(rows);
    // a group that empties (its last raid over) hands the list back to All - never a window that shows nothing. AUDIT
    // TIMERS2 M4: and the choice is All now, kept as the player's - it was this window's alone, and the next redraw of the
    // pause face (a quest's clock, a tab) brought the emptied group back when its rows did
    if (showing !== 'all' && !groups.some((g) => g.id === showing)) { showing = 'all'; shownGroup = 'all'; }
    const counts = [{ id: 'all', n: rows.length, live: groups.reduce((a, g) => a + g.live, 0) }, ...groups.map((g) => ({ id: g.id, n: g.rows.length, live: g.live }))];
    const ids = groups.length ? counts.map((c) => c.id).join(' ') : '';
    if (ids !== barIds) {
      barIds = ids;
      const had = [...chips].find(([, c]) => c.b === doc.activeElement)?.[0] ?? null;   // the press's focus kept through the rebuild
      chips = new Map();
      bar.textContent = '';
      // no clock, no bar (the empty list says why); with one, the gate and the resets always stand - two groups at least
      if (groups.length) {
        for (const { id } of counts) {
          const b = el('button', 'act tm-chip');
          /** @type {any} */ (b).type = 'button';
          b.setAttribute('data-focus', `timers-${id}`);   // the pause face's redraw finds it again (ui/domRepaint.js)
          const count = el('span', 'tm-chip-n', '');
          b.append(el('span', 'tm-chip-name', timerGroupChip(id)), count);
          b.addEventListener('click', () => {
            if (showing !== id) list.scrollTop = 0;   // another group starts at its top
            showing = id; shownGroup = id; draw();
          });
          bar.append(b);
          chips.set(id, { b, count });
        }
      }
      if (had) /** @type {any} */ (chips.get(had) ?? chips.get('all'))?.b?.focus?.({ preventScroll: true });
    }
    for (const { id, n, live } of counts) { const c = chips.get(id); if (c) chipSay(c, id, n, live); }
    const shown = showing === 'all' ? groups : groups.filter((g) => g.id === showing);
    // A cleared raid can change only the detail count while the displayed raid stays the same.
    const nextShape = JSON.stringify([showing, shown.map((g) => [g.id, g.live, g.rows.map((r) => [r.id, r.live, r.title, r.where, r.detail, r.door ?? null])])]);
    if (nextShape !== shape) {
      shape = nextShape;
      cells = new Map();
      list.textContent = '';
      // AUDIT TIMERS1 UI-8: the rows are never empty while there is a clock (the days and the gate always stand), so an
      // empty list is the source gone - the connection, not the calendar - and says so
      if (!rows.length) list.append(el('p', 'tm-empty', 'The world\'s clock cannot be read right now.'));
      for (const g of shown) {
        // TIMERS2: the group's head - its title, and how many of its rows are under way
        const h = el('h4', classes('tm-section', `tm-g-${g.id}`));
        h.append(el('span', 'tm-section-name', timerGroupTitle(g.id)));
        if (g.live) h.append(el('span', 'tm-section-live', t('timers.underWay', '{n} under way', { n: g.live })));
        list.append(h);
        for (const r of g.rows) {
          const row = el('div', `tm-row tm-${r.kind}${r.live ? ' live' : ''}`);
          const text = el('div', 'tm-text');
          text.append(el('span', 'tm-name', r.title));
          if (r.where) text.append(el('span', 'tm-where', r.where));
          if (r.detail) text.append(el('span', 'tm-detail', r.detail));
          const clock = el('div', 'tm-clock');
          const count = el('span', 'tm-count');
          const when = el('span', 'tm-when');
          // TIMERS2: a row under way says so above its countdown (the "Now" heading it stood under is gone)
          if (r.live) clock.append(el('span', 'tm-badge', t('timers.now', 'Now')));
          clock.append(count, when);
          row.append(text, clock);
          // EG-ZM (Elite-Gates.md section 20): the row's door - a button as the window's Close is, so a press, a tap and the
          // pad's walk reach it alike; the source's door is read at the press, never kept from the draw
          if (TIMER_DOOR_TEXT[r.door]) {
            const go = el('button', 'act tm-door', TIMER_DOOR_TEXT[r.door]);
            /** @type {any} */ (go).type = 'button';
            const which = r.door;
            go.addEventListener('click', () => { const fn = read()?.doors?.[which]; if (typeof fn === 'function') door(fn); });
            row.append(go);
          }
          list.append(row);
          cells.set(r.id, { count, when });
        }
      }
    }
    for (const r of rows) {
      const c = cells.get(r.id);
      if (!c) continue;
      const left = timerText(r.at - now);
      if (c.count.textContent !== left) c.count.textContent = left;
      // AUDIT TIMERS2 L8: in the player's language, as the "Now" above it is
      const at = localWhenText(r.at - offset), when = r.live ? t('timers.ends', 'ends {when}', { when: at }) : t('timers.at', 'at {when}', { when: at });
      if (c.when.textContent !== when) c.when.textContent = when;
    }
  };
  let tick = null;
  // AUDIT TIMERS1 UI-10: a window taken out of the page without its stop stops itself on the next tick
  const step = () => { if (win.isConnected === false && tick) { clearInterval(tick); tick = null; return; } draw(); };
  draw();
  tick = setInterval(step, every);
  // AUDIT TIMERS1 UI-5: the focus goes INTO the window (it had stayed on the hourglass, under the scrim)
  // AUDIT SEASON-BOOK U3: when the window opens - never when the face repaints around it, and never scrolling the list.
  // AUDIT TIMERS2 M5: unless it is in already - the pause face redraws this window whole and puts the focus back where it
  // was (a filter's button), and Close took it off again a frame later
  if (focus) globalThis.requestAnimationFrame?.(() => { if (!win.contains?.(doc.activeElement)) close.focus?.({ preventScroll: true }); });
  return { root: win, stop: () => { if (tick) clearInterval(tick); tick = null; }, draw, close };
}
