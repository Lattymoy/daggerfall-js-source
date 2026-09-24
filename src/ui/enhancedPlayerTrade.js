// ENHANCED PLAYER TRADE (TRADE1, 2026-09-21) - the window two players share when one presses F on the other and picks
// Trade. It is drawn in the enhanced inventory's own structure - the `.packcol` / `.itemrow` / `.packtabs` shape and the
// `.px-home` / `.px-win` frame ui/enhancedTrade.js (the shop counter) wears - but it is NOT the shop counter: there is
// no price, no haggle, no steal and no repair here, only two offers and two locks. So it does not extend that module
// (which keeps its state in module variables and is built around ui/nativeTrade.js's hooks bag); it borrows the SAME
// row and icon builders (`itemLine`, `linePictureUrl`) and the same stylesheet, so an item reads the same everywhere.
//
// THREE COLUMNS: your pack (tabbed, worn gear hidden) | your offer (items + a gold box) | their offer (read only, live).
// THE LAW IS net/tradeSession.js's: this file draws a session and calls its four verbs (setOffer, lock/unlock, confirm,
// cancel). It never touches the pack, the wire or a price. Every offer change unlocks both sides - and the footer says so.
//
// CLOSING: Escape / Close cancels a trade that is still being negotiated. Once the goods are in flight (`committing`) the
// window cannot be cancelled and says so; when the session ends it shows the outcome a moment and closes itself.
import { itemLine, linePictureUrl } from './enhancedInventory.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { overlayAction, isTextEntryTarget } from './input.js';
import { TABS, tabAccepts } from './nativeInventory.js';
import { TRADE_ITEMS_MAX } from '../net/wire.js';
import { TRADE_RANGE_M } from '../net/tradeSession.js';

const TAB_LABEL = Object.freeze({ weapons: 'Weapons & Armor', magic: 'Magic Items', clothing: 'Clothing & Misc', ingredients: 'Ingredients' });
const STYLE_ID = 'dagger-ptrade-style';
/** Three columns above the shop counter's own stacking breakpoint (ui/enhancedStyle.js: 1100px); below it the lists stack as they do there. */
const PTRADE_CSS = `
@media (min-width: 1101px) { .ptrade-shell .packlists { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.ptrade-shell .goldbox { display: flex; align-items: center; gap: 8px; padding: 8px 4px; }
.ptrade-shell input { font: inherit; }   /* AUDIT DROPS F1: every form control, the stack-quantity field included - a control falls to the browser's face unless told */
.ptrade-shell .goldbox input { width: 110px; background: #0e1013; color: var(--bone, #e9e4d9); border: 1px solid var(--iron, #2b323b);
  border-radius: 3px; padding: 4px 6px; font: inherit; }
.ptrade-shell .lockmark { font-size: 12px; padding: 2px 8px; border-radius: 3px; background: var(--iron, #2b323b); color: var(--dim, #8b8578); }
.ptrade-shell .lockmark.on { background: var(--brass, #c08a3e); color: var(--ink, #0e1013); }
.ptrade-shell .ptrade-note { margin: 0; padding: 6px 4px; font-size: 12.5px; color: var(--dim, #8b8578); flex: 1 1 100%; }
.ptrade-shell .itemrow.staged { outline: 1px solid var(--brass, #c08a3e); }
`;
function injectPtradeStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID; s.textContent = PTRADE_CSS;
  (document.head ?? document.body).append(s);
}

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/**
 * Mount the window on `hostEl` over a live `session` (net/tradeSession.js TradeSession). `deps`:
 *   items()   - the live pack array;  entity - the player entity (itemLine's identity);  gold() - purse
 *   onExit()  - the window wants to close (the overlay wrapper's own `close`)
 * Returns `{ repaint, unmount }` - the host calls `repaint` on every session change.
 */
export function mountEnhancedPlayerTrade(hostEl, { session, deps }) {
  injectEnhancedStyle(); injectEnhancedFonts(); injectPtradeStyle();
  let tab = 'weapons';
  let selected = null;        // { item, side: 'pack' | 'offer' | 'theirs' }
  let note = '';              // the last refusal, in words
  let closing = null;
  let alive = true;
  const DOUBLE_MS = 500;
  let lastClick = { item: null, t: 0 };

  const entries = () => session.mine.entries;
  const stagedSet = () => new Set(entries().map((e) => e.item));
  const say = (t) => { note = t ?? ''; };

  /** Every change to my offer goes through the session, which answers `{ok, why}` and unlocks both sides. */
  const applyOffer = (next, gold = session.mine.gold) => {
    const r = session.setOffer(next, gold);
    say(r.ok ? '' : r.why);
    render();
  };
  const stage = (item, count = null) => {
    if (session.phase !== 'open' || session.myConfirm) return;   // AUDIT DROPS B1: confirmed = frozen
    if (entries().length >= TRADE_ITEMS_MAX) { say(`At most ${TRADE_ITEMS_MAX} items in one trade.`); render(); return; }
    const n = count ?? Math.max(1, item.stackCount ?? 1);
    applyOffer([...entries(), { item, count: n }]);
  };
  const unstage = (item) => { if (session.phase === 'open' && !session.myConfirm) applyOffer(entries().filter((e) => e.item !== item)); };   // AUDIT DROPS B1

  const itemTile = (line) => {
    const src = linePictureUrl(line, { scale: 2, onReady: () => alive && render() });   // DISC22-D / DISC24-B: the pack's own door
    if (src) {
      const tile = el('span', 'tile has-icon'); const img = el('img'); img.src = src; img.alt = ''; tile.append(img); tile.title = line.name; return tile;
    }
    const tile = el('span', 'tile', line.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase());
    tile.title = line.name; return tile;
  };

  const row = (item, side, count = null) => {
    const line = itemLine(item, deps.entity);
    const b = el('button', 'itemrow');
    b.append(itemTile(line));
    const mid = el('span', 'itemname');
    const n = count ?? (line.stack || 0);
    mid.append(el('span', null, line.name + (n > 1 ? ` ×${n}` : '')));
    const sub = [line.material, line.word].filter(Boolean).join(' · ');
    if (sub) mid.append(el('small', null, sub));
    b.append(mid, el('span', 'itemwt', `${line.weight.toFixed(2)} kg`));
    if (selected?.item === item) b.classList.add('picked');
    if (side === 'offer') b.classList.add('staged');
    b.onclick = (e) => {
      if (lastClick.item === item && e.timeStamp - lastClick.t <= DOUBLE_MS) {   // the shop counter's manual double click: render() replaces the node
        lastClick = { item: null, t: 0 }; selected = null;
        if (side === 'pack') stage(item); else if (side === 'offer') unstage(item); else render();
        return;
      }
      lastClick = { item, t: e.timeStamp };
      selected = { item, side }; render();
    };
    return b;
  };

  const lockMark = (on, label) => el('span', `lockmark${on ? ' on' : ''}`, `${label}${on ? ' - locked' : ''}`);

  const packCol = () => {
    const col = el('section', 'packcol');
    const tabs = el('div', 'packtabs');
    for (const t of TABS) { const b = el('button', `packtab${t === tab ? ' on' : ''}`, TAB_LABEL[t]); b.onclick = () => { tab = t; render(); }; tabs.append(b); }
    col.append(tabs);
    const list = el('div', 'remotelist');
    const staged = stagedSet();
    const worn = (it) => it.equipSlot != null;
    const items = (deps.items() ?? []).filter((it) => !worn(it) && !staged.has(it) && tabAccepts(it, tab));
    if (!items.length) list.append(el('p', 'packempty', 'Nothing here answers to that page.'));
    for (const it of items) list.append(row(it, 'pack'));
    col.append(list);
    return col;
  };

  const offerCol = () => {
    const col = el('section', 'packcol packremote');
    const head = el('div', 'remotehead'); const who = el('div', 'remotewho');
    who.append(el('h3', null, 'Your offer'), el('p', 'meta', `${entries().length} item${entries().length === 1 ? '' : 's'}`));
    head.append(who, lockMark(session.myLock, 'You'));
    col.append(head);
    const list = el('div', 'remotelist');
    if (!entries().length) list.append(el('p', 'packempty', 'Double-click an item to offer it.'));
    for (const e of entries()) list.append(row(e.item, 'offer', e.count));
    col.append(list);
    const gold = el('div', 'goldbox');
    const input = el('input'); input.type = 'number'; input.min = '0'; input.max = String(deps.gold()); input.value = String(session.mine.gold);
    input.disabled = session.phase !== 'open' || session.myConfirm;   // AUDIT DROPS B1: confirmed = frozen
    const commit = () => { input.blur(); const v = Math.max(0, Math.floor(Number(input.value) || 0)); if (v !== session.mine.gold) applyOffer(entries(), v); };
    input.onchange = commit;
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } };
    gold.append(el('span', 'meta', 'Gold'), input, el('span', 'meta', `of ${deps.gold()}`));
    col.append(gold);
    return col;
  };

  const theirCol = () => {
    const col = el('section', 'packcol packremote');
    const head = el('div', 'remotehead'); const who = el('div', 'remotewho');
    const n = session.theirs.items.length;
    who.append(el('h3', null, `${session.peerName}'s offer`), el('p', 'meta', `${n} item${n === 1 ? '' : 's'}`));
    head.append(who, lockMark(session.theirLock, session.peerName));
    col.append(head);
    const list = el('div', 'remotelist');
    if (!n) list.append(el('p', 'packempty', 'Nothing offered yet.'));
    for (const it of session.theirs.items) list.append(row(it, 'theirs'));
    col.append(list);
    col.append(el('div', 'goldbox', `Gold: ${session.theirs.gold}`));
    return col;
  };

  const detail = () => {
    if (!selected) return null;
    const line = itemLine(selected.item, deps.entity);
    const bar = el('div', 'trade-detail'); bar.append(itemTile(line));
    const info = el('div', 'trade-detail-info');
    info.append(el('h4', null, line.name + (line.stack ? ` ×${line.stack}` : '')));
    const bits = [line.material, line.word, `${line.weight.toFixed(2)} kg`];
    if (line.damage != null) bits.push(`Damage ${line.damage}`);
    if (line.armour != null) bits.push(`Armour ${line.armour}`);
    for (const t of line.survival ?? []) bits.push(t);
    info.append(el('p', 'meta', bits.filter(Boolean).join(' · ')));
    bar.append(info);
    const stack = Math.max(1, selected.item.stackCount ?? 1);
    if (selected.side === 'pack' && session.phase === 'open' && !session.myConfirm) {
      let qty = null;
      if (stack > 1) { qty = el('input'); qty.type = 'number'; qty.min = '1'; qty.max = String(stack); qty.value = String(stack); qty.style.width = '64px'; bar.append(qty); }
      const b = el('button', 'act primary', 'Offer'); b.onclick = () => { const it = selected.item; selected = null; stage(it, qty ? Math.min(stack, Math.max(1, Math.floor(Number(qty.value) || 1))) : null); }; bar.append(b);
    } else if (selected.side === 'offer' && session.phase === 'open' && !session.myConfirm) {
      const b = el('button', 'act', 'Remove'); b.onclick = () => { const it = selected.item; selected = null; unstage(it); }; bar.append(b);
    }
    const c = el('button', 'act', 'Close'); c.onclick = () => { selected = null; render(); }; bar.append(c);
    return bar;
  };

  const footer = () => {
    const bar = el('div', 'remoteacts trade-footer');
    const status = session.phase === 'committing' ? 'Exchanging goods...'
      : session.phase === 'done' || session.phase === 'cancelled' ? (session.lastMessage || '')
        : session.withdrawing ? `Cancelling - waiting for ${session.peerName} to answer...`   // AUDIT 68: a confirm that left binds until the peer answers
        : session.bothLocked ? 'Both locked - press Confirm to finish, or change your offer to reopen.'
          : session.myLock ? `Locked. Waiting for ${session.peerName} to lock...`
            : `Any change to either offer unlocks both sides. Stay within ${TRADE_RANGE_M} m of ${session.peerName}.`;
    bar.append(el('p', 'ptrade-note', note || status));
    const open = session.phase === 'open';
    const cancel = el('button', 'act', open ? 'Cancel trade' : 'Close');
    cancel.disabled = session.phase === 'committing' || session.withdrawing;
    cancel.onclick = () => (open ? session.cancel() : deps.onExit());
    bar.append(cancel);
    const lock = el('button', 'act', session.myLock ? 'Unlock' : 'Lock');
    lock.disabled = !open || session.myConfirm || (!session.myLock && !session.hasContent);
    lock.onclick = () => { const r = session.myLock ? session.unlock() : session.lock(); say(r.ok ? '' : (r.why ?? '')); render(); };
    const confirm = el('button', 'act primary', session.myConfirm ? 'Confirmed' : 'Confirm');
    confirm.disabled = !open || !session.bothLocked || session.myConfirm;
    confirm.onclick = () => { const r = session.confirm(); say(r.ok ? '' : (r.why ?? '')); render(); };
    bar.append(lock, confirm);
    return bar;
  };

  function render() {
    if (!alive) return;
    const prev = Array.from(hostEl.querySelectorAll('.packcol')).map((c) => c.scrollTop);
    const focusedGold = document.activeElement?.tagName === 'INPUT' && hostEl.contains(document.activeElement);
    if (focusedGold) return;   // never rebuild under a field the player is typing in; its own change/Enter repaints
    hostEl.innerHTML = '';
    const shell = el('div', 'px-home px-over trade-shell ptrade-shell');
    const win = el('div', 'px-win trade-win');
    for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));
    const head = el('header', 'sb-top'); const who = el('div', 'sb-who');
    who.append(el('h2', null, `Trade with ${session.peerName}`));
    head.append(el('span', 'sb-spacer'), who);
    win.append(head);
    const body = el('div', 'px-body trade-body'); const lists = el('div', 'packlists');
    lists.append(packCol(), offerCol(), theirCol());
    body.append(lists);
    const d = detail(); if (d) body.append(d);
    win.append(body, footer());
    shell.append(win); hostEl.append(shell);
    hostEl.querySelectorAll('.packcol').forEach((c, i) => { if (prev[i] != null) c.scrollTop = prev[i]; });
    if (session.isOver && !closing) closing = setTimeout(() => deps.onExit(), session.phase === 'done' ? 1400 : 600);
  }

  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (overlayAction(e) === 'back') {
      if (isTextEntryTarget(e.target)) { e.target.blur?.(); e.preventDefault(); return; }
      e.preventDefault(); e.stopImmediatePropagation();
      if (session.phase === 'open') session.cancel(); else if (session.isOver) deps.onExit();
    }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  render();
  return {
    repaint: render,
    unmount() { alive = false; if (closing) clearTimeout(closing); globalThis.removeEventListener('keydown', onKey, { capture: true }); },
  };
}
