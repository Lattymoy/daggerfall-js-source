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
// one's top) and the gap the layout puts between lines (the next line's top less the first's foot). A list that cannot
// be measured - no layout (node, a pane not shown), or every drawn row on one line - is drawn whole, which is what
// every list was before.
//
// AUDIT TRADE-VIRT (2026-10-20, the owner: "ensure this is perfect and fidelity isnt lost"): EVERY ROW ITS OWN HEIGHT.
// The window took ONE pitch off the first two lines drawn and sized every spacer as though each line were that tall -
// and a trade's rows are not: a book's title wraps to a second line (68 px against 52), a phone's weapons run 52, 64
// and 82. A list whose first row was tall scrolled into blank stretches the window thought were drawn (the whole list,
// on a phone), rows jumped as lines came and went, a click's repaint moved the rows under a still pointer so a double
// click took the next piece, and the scrollbar was the wrong length - where the old windows, every row in the document,
// were exact. Now each row's height is MEASURED as it is drawn and kept (`sizes`, by item - the caller keeps it across
// its repaints, so a repaint's spacers are the ones it replaces and the scroll it gives back shows the same rows); a
// line is its tallest row and the gap; a line never drawn is taken at the mean of the rows that were. Each aim reads the
// lines it drew, and HOLDS STILL the row the eye is on (the first of the band's first line): what its new neighbours
// measure moves the spacer above it, and the scroll moves with the spacer, so nothing under the eye or the pointer
// moves; then the band is asked again, so a window drawn short of it on a guess is drawn on to cover it. A list whose
// rows are one height is laid exactly as before.
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
/** AUDIT TRADE-VIRT: how many times one sync may aim again to cover the band, the rows it drew having measured short of
 *  their guess (each pass draws a band's worth more at the least, so two are already the worst real case). */
const AIM_PASSES = 4;

/**
 * Draw `items` into `container` through `build`, whole when short and as a window over the scroll when long.
 * `sync()` aims the window at what is on screen; it needs the list in the document (a call before it is, is nothing),
 * and runs again on every scroll of the list or any box that clips it. `sync({ draw: false })` only measures and sizes
 * the spacers - what a repaint needs before it gives a scroll position back. `sync({ remeasure: true })` reads the
 * layout again (a resize - every kept height let go). `dispose()` lets go of the scroll listeners; a list replaced by a
 * repaint is disposed. `onAim` is told each time the window moves - rows went and came, and whatever stood beside one
 * that went is the caller's to put away. `sizes` (AUDIT TRADE-VIRT): the rows' measured heights by item - a Map or a
 * WeakMap the caller keeps across its repaints of the same list in the same layout (a new one for another layout).
 * @param {any} container @param {any[]} items @param {(item: any) => any} build
 * @param {{ min?: number, first?: number, onAim?: (() => void) | null, sizes?: { get: (k: any) => any, set: (k: any, v: any) => any } | null }} [opts]
 */
export function virtualRows(container, items, build, { min = VIRTUAL_MIN, first = VIRTUAL_FIRST, onAim = null, sizes = null } = {}) {
  const total = items.length;
  if (total < min) {
    for (const it of items) container.append(build(it));
    return { container, whole: true, sync() {}, dispose() {}, range: () => [0, total] };
  }
  // NOT THE SCROLL'S ANCHOR. The browser holds a node in view still while what stands above it changes size, and the
  // window swaps whole lines for spacer of exactly their height - there is nothing to hold, and the hold the browser
  // took anyway (a jump to the foot of a 700-piece loot list, every drawn row replaced) landed 22 px short of the foot.
  // AUDIT TRADE-VIRT: the window holds its own (hold, below) - the row the eye is on, by its own measure.
  container.style.overflowAnchor = 'none';
  /** index -> its row, for the rows in the window */
  const nodes = new Map();
  /** AUDIT TRADE-VIRT: each item's row height as drawn, and the mean of those this list knows (a line never drawn) */
  const sized = sizes ?? new Map();
  let knownSum = 0, known = 0;
  for (const it of items) { const h = sized.get(it); if (h > 0) { knownSum += h; known++; } }
  let start = 0, end = Math.min(total, first);
  let top = null, foot = null, geo = null, scrollers = null, queued = false;
  let whole = false, gone = false;
  for (let i = start; i < end; i++) { const n = build(items[i]); nodes.set(i, n); container.append(n); }

  const later = (f) => (typeof globalThis.requestAnimationFrame === 'function' ? globalThis.requestAnimationFrame(f) : setTimeout(f, 16));
  const onScroll = () => { if (queued || gone) return; queued = true; later(() => { queued = false; sync(); }); };
  const rect = (i) => nodes.get(i)?.getBoundingClientRect?.();

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

  /** The columns and the gap between lines, off the drawn rows - or null when they do not say. The first drawn row
   *  always opens a line: it follows a whole-line spacer, or it is the list's first. The gap is the next line's top less
   *  the first line's foot (its tallest row's). */
  const measure = () => {
    const r0 = rect(start);
    if (!r0 || !(r0.height > 0)) return null;
    let cols = 0, foot0 = r0.bottom;
    for (let i = start; i < end; i++) {
      const r = rect(i);
      if (Math.abs(r.top - r0.top) < 1) { cols++; foot0 = Math.max(foot0, r.bottom); continue; }
      return r.top - r0.top > 0 ? { cols, gap: Math.max(0, r.top - foot0) } : null;
    }
    return null;
  };

  /** AUDIT TRADE-VIRT: the drawn rows' heights kept by their items. */
  const learn = () => {
    for (const [i, n] of nodes) {
      const h = n.getBoundingClientRect?.().height;
      if (!(h > 0)) continue;
      const it = items[i], was = sized.get(it);
      if (was > 0) { if (was === h) continue; knownSum -= was; known--; }
      sized.set(it, h); knownSum += h; known++;
    }
  };
  /** A line's pitch: its tallest row (a row never drawn at the mean of those that were) and the gap after it. */
  const pitchOf = (l) => {
    const { cols, gap } = geo, guess = known ? knownSum / known : 0;
    let h = 0;
    for (let i = l * cols, e = Math.min(total, i + cols); i < e; i++) { const s = sized.get(items[i]); h = Math.max(h, s > 0 ? s : guess); }
    return h + gap;
  };
  const lineCount = () => Math.ceil(total / geo.cols);
  /** The pitches of lines [a, b), summed. */
  const span = (a, b) => { let s = 0; for (let l = a; l < b; l++) s += pitchOf(l); return s; };
  /** The line `y` below line 0's top stands in (clamped to the list). */
  const lineAt = (y) => {
    const lines = lineCount();
    if (!(y > 0)) return 0;
    let s = 0;
    for (let l = 0; l < lines; l++) { s += pitchOf(l); if (s > y) return l; }
    return lines - 1;
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
    const { cols, gap } = geo;
    const lines = lineCount();
    const above = Math.floor(start / cols);
    const below = Math.ceil(end / cols);
    top = spacer(top, above > 0 ? span(0, above) - gap : 0, true);
    foot = spacer(foot, below < lines ? span(below, lines) - gap : 0, false);
  };
  /** AUDIT TRADE-VIRT: row `i` back where it stood (`was`, its screen top), by the scroll - the spacer above it moved by
   *  what the rows drawn about it measured against their guess, and the scroll moves the same. */
  const hold = (i, was) => {
    const r = rect(i);
    if (!r || !Number.isFinite(was)) return;
    const d = r.top - was, s = ownScroller();
    if (s && Math.abs(d) >= 0.5) s.scrollTop += d;
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

  /** One aim at the band: false when the window already covers it (the spacers set again from what is known), true when
   *  it moved - the rows it drew read, and the row the eye is on held still. */
  const steer = () => {
    const { cols } = geo;
    const lines = lineCount();
    // line 0's top is the content's top - the top spacer's, or the first row's when nothing stands above it
    const origin = (top ?? nodes.get(start))?.getBoundingClientRect().top;
    const [lo, hi] = band();
    if (!Number.isFinite(origin) || !(hi > lo)) { place(); return false; }
    const v0 = lineAt(lo - origin), v1 = lineAt(hi - origin);
    const line = (l) => Math.max(0, Math.min(lines - 1, l));
    // a line either side of the band still drawn, on this layout's own columns: the window stands
    const aligned = start % cols === 0 && (end === total || end % cols === 0);
    if (aligned && start <= line(v0 - 1) * cols && end >= Math.min(total, (line(v1 + 1) + 1) * cols)) { place(); return false; }
    const over = Math.max(OVERSCAN_LINES, Math.ceil(((hi - lo) * OVERSCAN) / (pitchOf(v0) || 1)));
    // the row the eye is on: the first drawn row in the band, where it stands before the aim (the aim's own spacers move
    // it as much as what it draws measures) - or, a jump that left none of them, the band's first line where the aim
    // first draws it
    let eye = -1, was = NaN;
    for (const [i, n] of nodes) {
      if (eye >= 0 && i > eye) continue;
      const r = n.getBoundingClientRect();
      if (r.bottom > lo && r.top < hi) { eye = i; was = r.top; }
    }
    aim(line(v0 - over) * cols, Math.min(total, (line(v1 + over) + 1) * cols));
    if (eye < 0 || !nodes.has(eye)) { eye = v0 * cols; was = rect(eye)?.top; }
    learn();
    place();
    hold(eye, was);
    return true;
  };

  function sync({ draw = true, remeasure = false } = {}) {
    if (whole || gone || container.isConnected === false) return;
    if (remeasure || !geo) {
      const g = measure();
      if (!g) { if (!geo) drawAll(); return; }   // never measured: drawn whole; measured once: kept as it was
      if (remeasure && geo) {   // another layout: every height kept was this one's
        for (const it of items) sized.set?.(it, 0);
        knownSum = 0; known = 0;
      }
      geo = g;
      learn();
    }
    if (!draw) { place(); return; }
    for (let pass = 0; pass < AIM_PASSES && steer(); pass++);
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
