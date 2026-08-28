// PX21c (Mac: "a small tooltip for when you're hovering over a
// lootpile, showing you the list of items that are available").
//
// Daggerfall tells you nothing about a pile until you open it, and
// opening it is a window. This is the enhanced skin's answer: LOOK at a
// pile and a small plaque names what is in it, in the same dress as
// every other floating surface - so the decision "is this worth
// stopping for" happens in the world rather than through a door.
//
// It is a READOUT, not a control: no clicks, no keys, nothing to
// dismiss. It follows what the crosshair already resolves - the same
// activation pick the take uses - so it can never disagree with what
// pressing the button would open.
//
// ONE NODE, UPDATED ON CHANGE. A per-frame rebuild of a DOM list is
// the entrance-replay bug (PX19k) wearing a different hat: the node is
// created once and its contents are rewritten only when the KEY under
// the crosshair changes, so looking at the same pile for ten seconds
// costs nothing after the first frame.
import { injectEnhancedStyle } from './enhancedStyle.js';

/** How many lines before the plaque says "and N more" instead. A pile
 *  is a glance, not a list to read; DFU's own loot windows scroll. */
export const HOVER_MAX = 6;

let node = null;
let shownKey = null;

function ensure() {
  if (node || typeof document === 'undefined') return node;
  injectEnhancedStyle();
  node = document.createElement('div');
  node.className = 'loothover';
  node.setAttribute('aria-hidden', 'true');   // the crosshair is not a reading order
  document.body.append(node);
  return node;
}

/** The lines a pile shows: name, and a count when a stack. Pure. */
export function hoverLines(items, max = HOVER_MAX) {
  const rows = (items ?? []).filter(Boolean).map((it) => ({
    name: it.name ?? 'Something',
    stack: (it.stackCount ?? 1) > 1 ? it.stackCount : 0,
  }));
  const shown = rows.slice(0, max);
  const rest = rows.length - shown.length;
  return { shown, rest, empty: rows.length === 0 };
}

/**
 * Show the plaque for `key` with `items`, or hide it when key is null.
 * Idempotent per key: calling it every frame with the same key does
 * nothing after the first.
 */
export function showLootHover(key, items, title = 'Loot') {
  const n = ensure();
  if (!n) return;
  if (key === shownKey) return;
  shownKey = key;
  if (key === null) { n.classList.remove('on'); n.textContent = ''; return; }
  const { shown, rest, empty } = hoverLines(items);
  n.textContent = '';
  const head = document.createElement('div');
  head.className = 'loothover-head';
  head.textContent = title;
  n.append(head);
  if (empty) {
    const p = document.createElement('div');
    p.className = 'loothover-row loothover-empty';
    p.textContent = 'Empty';
    n.append(p);
  }
  for (const r of shown) {
    const row = document.createElement('div');
    row.className = 'loothover-row';
    const nm = document.createElement('span');
    nm.textContent = r.name;
    row.append(nm);
    if (r.stack) {
      const c = document.createElement('span');
      c.className = 'loothover-count';
      c.textContent = `\u00d7${r.stack}`;
      row.append(c);
    }
    n.append(row);
  }
  if (rest > 0) {
    const more = document.createElement('div');
    more.className = 'loothover-row loothover-more';
    more.textContent = `and ${rest} more`;
    n.append(more);
  }
  n.classList.add('on');
}

/** Tear down with the host that raised it. */
export function destroyLootHover() {
  try { node?.remove(); } catch { /* already gone */ }
  node = null;
  shownKey = null;
}

/** For tests. */
export const _hoverKeyForTests = () => shownKey;
