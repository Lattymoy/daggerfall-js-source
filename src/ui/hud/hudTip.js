// HUD-TIP (2026-10-20, Dudey: "make every other icon of debuffs, buffs, hunger etc hoverable when hovering over it
// with the mouse so it tells you in a toolbox like in the inventory what it does") - THE HUD'S HOVER CARD. The pack's own
// card (ui/enhanced/enhancedInventory.js showTip: `.inv-tip > .card`, an h3, a `.meta` line, the body), so each skin and
// each dress paints it the way it paints the pack's - Enhanced Plus's stone, DFO Grimoire's scroll - and nothing here
// names a colour. One card at a time, on the body, pointer-transparent, placed above the thing it speaks for (below it
// when there is no room above), kept on the screen.
//
// A tip is `{ title, meta?, lines?: string[], foot? }` - words only, never markup.

const TIP_CLASS = 'inv-tip hud-tip';
let tipEl = null;
let tipFor = null;

/** The card for `tip`, built in `doc` (not placed). */
export function buildHudTip(doc, tip) {
  const box = doc.createElement('div');
  box.className = TIP_CLASS;
  box.setAttribute('role', 'tooltip');
  const card = doc.createElement('div');
  card.className = 'card';
  const h = doc.createElement('h3');
  h.textContent = String(tip?.title ?? '');
  card.append(h);
  if (tip?.meta) {
    const m = doc.createElement('p');
    m.className = 'meta';
    m.textContent = String(tip.meta);
    card.append(m);
  }
  for (const line of tip?.lines ?? []) {
    if (!line) continue;
    const p = doc.createElement('p');
    p.className = 'hud-tip-line';
    p.textContent = String(line);
    card.append(p);
  }
  if (tip?.foot) {
    const f = doc.createElement('p');
    f.className = 'hud-tip-foot';
    f.textContent = String(tip.foot);
    card.append(f);
  }
  box.append(card);
  return box;
}

/** Where a card of `size` goes for an anchor's `rect` on a `view` - above it, centred, else below it; kept 8px inside. */
export function hudTipPlace(rect, size, view) {
  const pad = 8, gap = 8;
  let left = rect.left + rect.width / 2 - size.width / 2;
  left = Math.max(pad, Math.min(left, view.width - size.width - pad));
  let top = rect.top - size.height - gap;
  if (top < pad) top = rect.bottom + gap;
  top = Math.max(pad, Math.min(top, view.height - size.height - pad));
  return { left: Math.round(left), top: Math.round(top) };
}

/** Show `tip` for `anchor` (a node on the page); `key` says which card it is, so a hover that stays on one thing does
 *  not rebuild it. */
export function showHudTip(anchor, tip, key = null, doc = globalThis.document) {
  if (!doc?.body || !anchor || !tip) return null;
  if (tipEl && key != null && tipFor === key && tipEl.isConnected) return tipEl;
  hideHudTip();
  tipEl = buildHudTip(doc, tip);
  tipFor = key;
  tipEl.style.position = 'fixed';
  tipEl.style.left = '0px';
  tipEl.style.top = '0px';
  doc.body.append(tipEl);
  const r = anchor.getBoundingClientRect?.();
  const s = tipEl.getBoundingClientRect?.();
  if (r && s) {
    const at = hudTipPlace(r, s, { width: globalThis.innerWidth || s.width, height: globalThis.innerHeight || s.height });
    tipEl.style.left = `${at.left}px`;
    tipEl.style.top = `${at.top}px`;
  }
  return tipEl;
}

/** Take the card down. */
export function hideHudTip() {
  tipEl?.remove();
  tipEl = null;
  tipFor = null;
}

/** Whether a card is up, and for what. */
export const hudTipShowing = () => (tipEl ? tipFor ?? true : null);

/**
 * Give `host` hover cards: a pointer over one of its children that `pick(node)` answers for (its node and its tip, or
 * null) shows that tip; leaving it, or the host, takes it down. Returns the unbinding.
 * @param {HTMLElement} host
 * @param {(target: any) => ({ node: any, tip: any, key?: any } | null)} pick
 */
export function bindHudTips(host, pick) {
  const over = (e) => {
    const hit = pick(e.target);
    if (!hit) { hideHudTip(); return; }
    showHudTip(hit.node, hit.tip, hit.key ?? hit.node);
  };
  const out = (e) => { if (!host.contains(e.relatedTarget)) hideHudTip(); };
  host.addEventListener?.('mouseover', over);
  host.addEventListener?.('mouseout', out);
  return () => { host.removeEventListener?.('mouseover', over); host.removeEventListener?.('mouseout', out); hideHudTip(); };
}
