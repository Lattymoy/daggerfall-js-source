// ═══════════════════════════════════════════════════════════════════
// VIRT (2026-10-16) — A LONG LIST DRAWS THE ROWS ON SCREEN, NOT ALL OF THEM.
//
// The enhanced pack rebuilds its DOM on every repaint (ui/domRepaint.js says why that is the shape), and a list
// rebuilt whole costs what the list HOLDS, not what the player can SEE: a wagon of 700 pieces built 700 rows on every
// pick and every take, and the repaint's scroll keeper then walked every node of them. Past `VIRTUAL_MIN` rows a list
// draws the rows in its visible band and a margin round it; two spacers stand in for the rest at the height those rows
// would take, so the scrollbar, the scroll position and every drawn row's place are the whole list's own.
//
// THE LAYOUT IS MEASURED, NEVER ASSUMED. The pack's dock is a wrapping grid of tiles, the loot window one column or two
// grid tracks, and a phone draws each smaller - so the first rows drawn give the columns (the rows that share the first
// one's top) and the line's pitch (the next line's top less the first's), and the spacers are whole lines of that pitch
// less the one gap the layout puts between a spacer and the rows beside it. A list that cannot be measured - no layout
// (node, a pane not shown), or every drawn row on one line - is drawn whole, which is what every list was before.
//
// THE ROWS ARE THE CALLER'S. `build(item)` makes a row exactly as the whole list made it; a row that leaves the window
// is removed and one that enters is built then, from the state the pane holds at that moment. A row still in the window
// is never moved or rebuilt by a scroll, so a hover, a press or a picture swapped into it keeps its node.
// ═══════════════════════════════════════════════════════════════════

/** A list shorter than this is drawn whole, every row, as it always was. */
export const VIRTUAL_MIN = 120;
/** The rows a long list draws before it can be measured - enough for two lines of any layout this pane has. */
export const VIRTUAL_FIRST = 48;
/** How far past each edge of the visible band the window reaches: a share of the band, and never under two lines. */
const OVERSCAN = 0.5;
const OVERSCAN_LINES = 2;

/**
 * Draw `items` into `container` through `build`, whole when short and as a window over the scroll when long.
 * `sync()` aims the window at what is on screen; it needs the list in the document (a call before it is, is nothing),
 * and runs again on every scroll of the list or any box that clips it. `sync({ draw: false })` only measures and sizes
 * the spacers - what a repaint needs before it gives a scroll position back. `sync({ remeasure: true })` reads the
 * layout again (a resize). `dispose()` lets go of the scroll listeners; a list replaced by a repaint is disposed.
 * `onAim` is told each time the window moves - rows went and came, and whatever stood beside one that went is the
 * caller's to put away.
 * @param {any} container @param {any[]} items @param {(item: any) => any} build
 * @param {{ min?: number, first?: number, onAim?: (() => void) | null }} [opts]
 */
export function virtualRows(container, items, build, { min = VIRTUAL_MIN, first = VIRTUAL_FIRST, onAim = null } = {}) {
  const total = items.length;
  if (total < min) {
    for (const it of items) container.append(build(it));
    return { container, whole: true, sync() {}, dispose() {}, range: () => [0, total] };
  }
  // NOT THE SCROLL'S ANCHOR. The browser holds a node in view still while what stands above it changes size, and the
  // window swaps whole lines for spacer of exactly their height - there is nothing to hold, and the hold the browser
  // took anyway (a jump to the foot of a 700-piece loot list, every drawn row replaced) landed 22 px short of the foot.
  container.style.overflowAnchor = 'none';
  /** index -> its row, for the rows in the window */
  const nodes = new Map();
  let start = 0, end = Math.min(total, first);
  let top = null, foot = null, geo = null, scrollers = null, queued = false;
  let whole = false, gone = false;
  for (let i = start; i < end; i++) { const n = build(items[i]); nodes.set(i, n); container.append(n); }

  const later = (f) => (typeof globalThis.requestAnimationFrame === 'function' ? globalThis.requestAnimationFrame(f) : setTimeout(f, 16));
  const onScroll = () => { if (queued || gone) return; queued = true; later(() => { queued = false; sync(); }); };

  /** Every row, drawn: what a list that cannot be measured falls back to. */
  const drawAll = () => {
    whole = true;
    top?.remove(); top = null;
    foot?.remove(); foot = null;
    const firstDrawn = nodes.get(start) ?? null;
    for (let i = 0; i < start; i++) container.insertBefore(build(items[i]), firstDrawn);
    for (let i = end; i < total; i++) container.append(build(items[i]));
    nodes.clear();
    start = 0; end = total;
  };

  /** The columns, the line's pitch and the gap between lines, off the drawn rows - or null when they do not say. The
   *  first drawn row always opens a line: it follows a whole-line spacer, or it is the list's first. */
  const measure = () => {
    const r0 = nodes.get(start)?.getBoundingClientRect?.();
    if (!r0 || !(r0.height > 0)) return null;
    let cols = 0;
    for (let i = start; i < end; i++) {
      const t = nodes.get(i).getBoundingClientRect().top;
      if (Math.abs(t - r0.top) < 1) { cols++; continue; }
      const pitch = t - r0.top;
      return pitch > 0 ? { cols, pitch, gap: Math.max(0, pitch - r0.height) } : null;
    }
    return null;
  };

  /** The band of the screen the list can show through: the window, cut by every box round the list that clips - up to
   *  the first fixed box (nothing above it clips it) and never the page's own body, whose box a fixed overlay leaves
   *  empty. Each is listened to, so a scroll of any of them moves the window. */
  const band = () => {
    if (!scrollers) {
      scrollers = [];
      const doc = container.ownerDocument ?? globalThis.document;
      for (let a = container; a && a.nodeType === 1 && a !== doc?.body && a !== doc?.documentElement; a = a.parentElement) {
        const cs = globalThis.getComputedStyle?.(a);
        if (cs?.overflowY && cs.overflowY !== 'visible') { scrollers.push(a); a.addEventListener('scroll', onScroll, { passive: true }); }
        if (cs?.position === 'fixed') break;
      }
    }
    let lo = 0, hi = globalThis.innerHeight ?? 0;
    for (const s of scrollers) { const r = s.getBoundingClientRect(); lo = Math.max(lo, r.top); hi = Math.min(hi, r.bottom); }
    // CUT AWAY WHOLE - a box round the list (a phone's window, below its fold) hides all of it: the window still follows
    // the list's own scroll, so what its scroller holds in view is drawn the moment the list is shown
    const own = ownScroller();
    if (!(hi > lo) && own) { const r = own.getBoundingClientRect(); return [r.top, r.bottom]; }
    return [lo, hi];
  };
  /** AUDIT VIRT: the box that scrolls the list - the first round it with more to show than it holds. The first that
   *  merely clips can be the list's own column (the dock's, `overflow: auto` and never past its content), whose box is
   *  the whole list: aimed at, it drew every row. */
  const ownScroller = () => scrollers?.find((s) => s.scrollHeight > s.clientHeight) ?? scrollers?.[0] ?? null;
  /** AUDIT VIRT: the row holding the keyboard's focus went with the window (a key's jump scrolled it away), and the focus
   *  fell to the page - a page that scrolls nothing, so the next Home or Page Down did nothing. The list's own scroller
   *  takes it, out of the Tab order, and the keys go on scrolling the list. */
  const keepFocus = () => {
    const s = ownScroller();
    if (!s) return;
    if (!s.hasAttribute?.('tabindex')) s.tabIndex = -1;
    s.focus?.({ preventScroll: true });
  };

  const spacer = (s, h, atTop) => {
    if (!(h > 0)) { s?.remove(); return null; }
    if (!s) {
      s = (container.ownerDocument ?? globalThis.document).createElement('div');
      s.className = 'vrows-gap';
      s.setAttribute('aria-hidden', 'true');
      // a whole line in every layout the rows sit in: a flex wrap's line, a grid's row, a block
      Object.assign(s.style, { flex: '0 0 100%', gridColumn: '1 / -1', width: '100%', margin: '0', padding: '0', border: '0', pointerEvents: 'none' });
      if (atTop) container.insertBefore(s, container.firstChild); else container.append(s);
    }
    s.style.height = `${h}px`;
    return s;
  };
  /** The spacers for the lines above and below the window. A partial last line drawn is a line. */
  const place = () => {
    const { cols, pitch, gap } = geo;
    const lines = Math.ceil(total / cols);
    const above = Math.floor(start / cols);
    const below = lines - Math.ceil(end / cols);
    top = spacer(top, above > 0 ? above * pitch - gap : 0, true);
    foot = spacer(foot, below > 0 ? below * pitch - gap : 0, false);
  };

  /** The window moved to rows [ns, ne): the rows that stay are not touched, the rest removed or built. */
  const aim = (ns, ne) => {
    const active = (container.ownerDocument ?? globalThis.document)?.activeElement ?? null;
    let lostFocus = false;
    for (const [i, n] of nodes) if (i < ns || i >= ne) { if (active && n.contains?.(active)) lostFocus = true; n.remove(); nodes.delete(i); }
    const keepA = Math.max(ns, start), keepB = Math.min(ne, end);
    const add = (i, before) => { const n = build(items[i]); nodes.set(i, n); container.insertBefore(n, before); };
    if (keepA < keepB) {
      const anchor = nodes.get(keepA);
      for (let i = ns; i < keepA; i++) add(i, anchor);
      for (let i = keepB; i < ne; i++) add(i, foot);
    } else {
      for (let i = ns; i < ne; i++) add(i, foot);
    }
    start = ns; end = ne;
    place();
    if (lostFocus) keepFocus();
    onAim?.();
  };

  function sync({ draw = true, remeasure = false } = {}) {
    if (whole || gone || container.isConnected === false) return;
    if (remeasure || !geo) {
      const g = measure();
      if (!g) { if (!geo) drawAll(); return; }   // never measured: drawn whole; measured once: kept as it was
      geo = g;
    }
    if (!draw) { place(); return; }
    const { cols, pitch } = geo;
    const lines = Math.ceil(total / cols);
    // line 0's top is the content's top - the top spacer's, or the first row's when nothing stands above it
    const origin = (top ?? nodes.get(start))?.getBoundingClientRect().top;
    const [lo, hi] = band();
    if (!Number.isFinite(origin) || !(hi > lo)) { place(); return; }   // off screen: nothing to aim at
    const v0 = Math.floor((lo - origin) / pitch), v1 = Math.floor((hi - origin) / pitch);
    const line = (l) => Math.max(0, Math.min(lines - 1, l));
    // a line either side of the band still drawn, on this layout's own columns: the window stands
    const aligned = start % cols === 0 && (end === total || end % cols === 0);
    if (aligned && start <= line(v0 - 1) * cols && end >= Math.min(total, (line(v1 + 1) + 1) * cols)) { place(); return; }
    const over = Math.max(OVERSCAN_LINES, Math.ceil(((hi - lo) * OVERSCAN) / pitch));
    aim(line(v0 - over) * cols, Math.min(total, (line(v1 + over) + 1) * cols));
  }

  return {
    container,
    get whole() { return whole; },
    sync,
    dispose() {
      gone = true;
      for (const s of scrollers ?? []) s.removeEventListener('scroll', onScroll);
      scrollers = null;
    },
    /** Test seam: the rows drawn, [first, past the last). */
    range: () => [start, end],
  };
}
