// ═══════════════════════════════════════════════════════════════════
// PX14 — THE DIAL: the in-game compass rose (Mac's vision, Skyrim's
// four-way dial as the door to every in-game window).
//
// ── WHAT THIS IS ─────────────────────────────────────────────────
// One press over the live game raises a four-armed rose on a light
// scrim: SKILLS above, ITEMS right, MAP below, MAGIC left — the same
// four doors Skyrim hangs on its dial, mapped onto the windows the
// hosts ALREADY OWN (toggleCharSheet, toggleInventory, toggleAutomap,
// toggleSpellbook). The dial ROUTES; it does not reimplement — the
// windows behind the doors keep every law they have, and each one's
// pixel redesign is its own slice (the journal pattern: one structure
// learned once, then applied surface by surface).
//
// ── THE SHAPE ────────────────────────────────────────────────────
// A fixed overlay, a 0.45 ink scrim (lighter than the pause window's
// 0.55 — the dial is a glance, not a room), a center knot of layered
// diamonds, four arms drawn as 2px rules with the label at each end.
// Selection is the gold pair; states SNAP. Everything is the ◆/◇
// glyph — never a rotated box (a rotated square anti-aliases its
// diagonals; the pixel font does not).
//
// ── INPUT, WHOLE ─────────────────────────────────────────────────
// Pointer: hover selects, click commits, click on the scrim closes.
// Keyboard: arrows/WASD select by direction, Enter/Space commits,
// Escape closes — capture-phase and stopped, the U50 lesson (a modal
// overlay owns its input; the host underneath must not walk the
// player while the dial is up). Every arm is a real ≥44px button.
//
// ── WHO MOUNTS IT ────────────────────────────────────────────────
// mountPixelDial(hostEl, { entries, onClose }) — entries are the
// host's own four (or fewer) doors: { id, label, dir: 'n'|'e'|'s'|'w',
// open() }. A host missing a window simply passes fewer arms and the
// rose draws what it has — NEVER a dead arm that lies (a drawn door
// that opens nothing is the hidden-settings bug wearing ornament).
// FLAGGED (THE FOUR HOSTS RULE): no host is wired yet — world.js,
// worldModes.js, exterior.js and dungeonContext.js each need a key
// (Tab is free in all four key tables by grep) routing to their own
// toggles; wiring lands as PX15 with the per-host key audit, because
// a key grab without reading each host's table is how F5 reloaded
// the page in AUDIT 17e.
// ═══════════════════════════════════════════════════════════════════

import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';

const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

// Direction geometry: where each arm's label sits and which arrow
// key reaches it. One table, so the draw and the keys cannot drift.
const DIRS = Object.freeze({
  n: { keys: ['ArrowUp', 'w', 'W'] },
  e: { keys: ['ArrowRight', 'd', 'D'] },
  s: { keys: ['ArrowDown', 's', 'S'] },
  w: { keys: ['ArrowLeft', 'a', 'A'] },
});

/**
 * Raise the dial. Returns { unmount } — and unmount is the ONLY way
 * it leaves except its own commit/close, so the caller owns the
 * lifecycle the way every overlay host here does.
 */
export function mountPixelDial(hostEl, { entries = [], onClose = () => {} } = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();

  let selected = null;
  let keyHandler = null;

  const root = el('div', 'px-dial');
  const rose = el('div', 'px-rose');
  rose.append(el('span', 'px-knot', '\u25c6'));
  rose.append(el('span', 'px-knot px-knot2', '\u25c7'));

  const byDir = {};
  for (const entry of entries) {
    if (!DIRS[entry.dir] || byDir[entry.dir]) continue;   // one arm per direction, no dead arms
    byDir[entry.dir] = entry;
    const arm = el('button', `px-arm px-${entry.dir}`);
    arm.append(el('span', 'px-c', '\u25c6'), document.createTextNode(entry.label));
    arm.onmouseenter = () => select(entry.dir);
    arm.onclick = () => commit(entry.dir);
    rose.append(arm);
  }
  root.append(rose);

  // The scrim is the close: a glance dismissed by looking away.
  root.onclick = (e) => { if (e.target === root) close(); };

  function select(dir) {
    selected = dir;
    for (const d of Object.keys(byDir)) {
      rose.querySelector(`.px-${d}`)?.classList.toggle('on', d === dir);
    }
  }

  function commit(dir) {
    const entry = byDir[dir ?? selected];
    if (!entry) return;
    unmount();            // the dial leaves FIRST — the window it opens
    entry.open();         // must not find the dial still eating keys
  }

  function close() { unmount(); onClose(); }

  function unmount() {
    if (keyHandler) globalThis.removeEventListener('keydown', keyHandler, { capture: true });
    keyHandler = null;
    root.remove();
  }

  keyHandler = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); commit(); return; }
    for (const [dir, { keys }] of Object.entries(DIRS)) {
      if (keys.includes(e.key)) {
        e.preventDefault(); e.stopPropagation();
        if (byDir[dir]) select(dir);
        return;
      }
    }
    // A key the dial does not use passes through untouched — the Tab
    // half of U50's must-not law.
  };
  globalThis.addEventListener('keydown', keyHandler, { capture: true });

  hostEl.append(root);
  return { unmount };
}
