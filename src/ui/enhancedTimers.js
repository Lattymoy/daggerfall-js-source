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
import { eventTimerRows, timerText, localWhenText } from '../systems/eventTimers.js';

/** A row's kind -> its marker class (colour in the sheet). */
export const TIMER_KINDS = Object.freeze(['gate', 'serpent', 'super', 'raid', 'battle', 'seat', 'reset']);   // SERPENT-TIMERS: the sea serpent's; SD2c: the Super dungeon's, once found

/**
 * The hourglass, the button beside the profile mark.
 * @param {Document} doc
 * @param {{ onOpen: () => void, open?: boolean }} o
 */
export function timersMark(doc, { onOpen, open = false }) {
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = 'px-timersmark';
  b.setAttribute('aria-label', 'Timers: gates, the sea serpent, the Abyss Dungeon, raids, battles and resets');   // SD2c: its row
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
 * when the window goes (a render, an unmount).
 * @param {Document} doc
 * @param {{ read: () => any, onClose: () => void, every?: number }} o
 */
export function timersWindow(doc, { read, onClose, every = 1000 }) {
  const el = (tag, cls, text) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
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
  body.append(el('p', 'tm-lead', 'Times are in your own clock. The countdowns run live.'));
  const list = el('div', 'tm-list');
  body.append(list);
  win.append(body);

  /** @type {Map<string, any>} */
  let cells = new Map();
  let shape = null;   // never a list's shape, so the first draw always builds (an empty one says so)
  const draw = () => {
    const src = read();
    const rows = src ? eventTimerRows(src) : [];
    const now = Number(src?.now) || Date.now();
    const offset = now - Date.now();   // the relay's clock against this machine's - the local time is the machine's
    // A cleared raid can change only the detail count while the displayed raid stays the same.
    const nextShape = JSON.stringify(rows.map((r) => [r.id, r.live, r.title, r.where, r.detail]));
    if (nextShape !== shape) {
      shape = nextShape;
      cells = new Map();
      list.textContent = '';
      // AUDIT TIMERS1 UI-8: the rows are never empty while there is a clock (the days and the gate always stand), so an
      // empty list is the source gone - the connection, not the calendar - and says so
      if (!rows.length) list.append(el('p', 'tm-empty', 'The world\'s clock cannot be read right now.'));
      let section = null;
      for (const r of rows) {
        if (section !== r.live) {
          section = r.live;
          list.append(el('h4', 'tm-section', r.live ? 'Now' : 'Coming up'));
        }
        const row = el('div', `tm-row tm-${r.kind}${r.live ? ' live' : ''}`);
        const text = el('div', 'tm-text');
        text.append(el('span', 'tm-name', r.title));
        if (r.where) text.append(el('span', 'tm-where', r.where));
        if (r.detail) text.append(el('span', 'tm-detail', r.detail));
        const clock = el('div', 'tm-clock');
        const count = el('span', 'tm-count');
        const when = el('span', 'tm-when');
        clock.append(count, when);
        row.append(text, clock);
        list.append(row);
        cells.set(r.id, { count, when });
      }
    }
    for (const r of rows) {
      const c = cells.get(r.id);
      if (!c) continue;
      const left = timerText(r.at - now);
      if (c.count.textContent !== left) c.count.textContent = left;
      const when = `${r.live ? 'ends' : 'at'} ${localWhenText(r.at - offset)}`;
      if (c.when.textContent !== when) c.when.textContent = when;
    }
  };
  let tick = null;
  // AUDIT TIMERS1 UI-10: a window taken out of the page without its stop stops itself on the next tick
  const step = () => { if (win.isConnected === false && tick) { clearInterval(tick); tick = null; return; } draw(); };
  draw();
  tick = setInterval(step, every);
  // AUDIT TIMERS1 UI-5: the focus goes INTO the window (it had stayed on the hourglass, under the scrim)
  globalThis.requestAnimationFrame?.(() => close.focus?.());
  return { root: win, stop: () => { if (tick) clearInterval(tick); tick = null; }, draw, close };
}
