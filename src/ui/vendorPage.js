// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-VENDOR (net/vendorLaw.js) - THE VENDOR PAGE (Mac: "add a Vendor tab under professions (not in) that manages your
// vendor what youve sold etc and the search of other vendors to check the set waypoints and so on"). A page of its own on
// the pause window's Character rail, directly under the Professions (ui/enhancedMenu.js statsSections; the Stores are the Holdings rail's),
// shown while the market is this account's and its character trades in gold.
//
//   YOUR TRADERS: each trader of your homes (its town), the pieces standing at it (days left, Take back), what your
//   traders have SOLD (newest first, what each brought you after the market's cut), and the takings waiting - collected
//   into your account in the region you stand in.
//
//   FIND TRADERS: any region's traders (the region you stand in first), searched by every word over the item, the owner
//   and the town (vendorSearch); a row sets or clears the WAYPOINT (systems/vendorWaypoint.js), and the waypoint set is
//   named at the top with its Clear.
//
// The host (scenes/world.js) hands the reads and the acts through setVendorPage; this file draws them, as profPages.js
// draws the Professions from setProfessionsPages.
// ═══════════════════════════════════════════════════════════════════

import { goldText, wearOf, wearText } from '../net/marketLaw.js';
import { vendorSearch, VENDOR_LISTING_S } from '../net/vendorLaw.js';
import { accountRefusalText } from '../net/accountClient.js';
import { vendorStatsNode, injectVendorStatsCss } from './vendorTab.js';   // a piece's stats, as the board shows them

/** The rail's row: under the Professions. */
export const VENDOR_PAGE_SECTIONS = Object.freeze([Object.freeze(['vendor', 'Vendor'])]);
/** How long a read stands before the page asks again (a sale moves it). */
export const VENDOR_PAGE_FRESH_MS = 30_000;
/** The page's words. */
export const VENDOR_PAGE_TEXT = Object.freeze({
  noTraders: 'You have no trader. Place one in a home you own (Decorate, Catalogue, Vendors), then make it the "Hired trader" station.',
  noStock: 'Nothing is up for sale. Press your trader in its home to put a piece from your pack up.',
  noSales: 'Your traders have sold nothing yet.',
  noneFound: 'No trader in that region has anything for sale.',
  noMatch: 'No trader\'s goods match that search.',
  cold: 'The counting-house is not answering. Your traders cannot be read now.',
  reading: 'Asking after your traders...',
  takings: (g) => (g > 0 ? `Takings waiting: ${goldText(g)}` : 'No takings waiting.'),
  look: 'Press a piece to see its stats.',
  stays: `A piece stands at a trader ${Math.round(VENDOR_LISTING_S / 86_400)} days, then comes back to you.`,
});

let _provider = /** @type {any} */ (null);
/** The host's side: { shown, mine, search, regionHere, regionNames, nameOf, townOf, take, collectGold, waypoint, waypointKey,
 *  waypoint0, clearWaypoint }. */
export function setVendorPage(p) { _provider = p ?? null; }
export const vendorPageShown = () => { try { return !!_provider && _provider.shown() === true; } catch { return false; } };

const _st = {
  mine: /** @type {any} */ (null), mineAt: -Infinity, mineErr: /** @type {string|null} */ (null), mineBusy: false,
  region: /** @type {number|null} */ (null), found: /** @type {any} */ (null), foundFor: /** @type {number|null} */ (null), foundBusy: false,
  query: '', picked: /** @type {string|null} */ (null), word: /** @type {{ ok: boolean, text: string }|null} */ (null), busy: false,
};
/** A fresh page for a new character, or after the switch. */
export function resetVendorPage() {
  Object.assign(_st, { mine: null, mineAt: -Infinity, mineErr: null, mineBusy: false, region: null, found: null, foundFor: null, foundBusy: false, query: '', picked: null, word: null, busy: false });
}

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
/** Days or hours a piece still stands. */
const leftText = (expiresAt) => {
  const left = Math.max(0, Number(expiresAt) - Date.now() / 1000);
  return left >= 86_400 ? `${Math.floor(left / 86_400)}d left` : `${Math.max(1, Math.ceil(left / 3600))}h left`;
};
const agoText = (at) => {
  const s = Math.max(0, Date.now() / 1000 - Number(at));
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86_400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86_400)}d ago`;
};

/** The page's few rules of its own - a row a line, its button at its end; everything else is the pause window's. */
const VENDOR_PAGE_CSS = `/* HOME-VENDOR: the Stores' list rows (PROF_CSS .prof-smelt) - name, its line, the button; the Plus palette */
.vendor-rows { display: flex; flex-direction: column; gap: 0; margin: 2px 0 6px; }
.vendor-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 2px 10px; padding: 6px 0;
  border-bottom: 1px solid rgba(192,138,62,0.18); font-size: 14px; color: #d9cfbd; text-align: left; }
.vendor-row b { grid-column: 1; grid-row: 1; color: #efe0b8; font-weight: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vendor-row .vendor-meta { grid-column: 1; grid-row: 2; font-size: 12px; color: #9d917d; }
.vendor-row .act { grid-column: 2; grid-row: 1 / span 2; }
.vendor-price { color: #f3cf86; }
.vendor-word { margin: 6px 0; font-size: 12px; color: #e9e4d9; } .vendor-word.bad { color: #e59a8e; }
.vendor-takings, .vendor-waypoint { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin: 6px 0; }
.vendor-line { margin: 4px 0; font-size: 14px; color: #efe0b8; text-align: left; }
.vendor-takings .vendor-line, .vendor-waypoint .vendor-line { flex: 1 1 0; min-width: 0; }
.vendor-sum { margin: 6px 0 2px; font-size: 13px; color: #b9ab93; text-align: left; }
.vendor-look { cursor: pointer; } .vendor-look:hover b { color: #f3cf86; }
.vendor-look.on { background: rgba(192,138,62,0.10); box-shadow: inset 2px 0 0 var(--brass, #c08a3e); padding-left: 8px; }
.vendor-row .vendor-rowstats { grid-column: 1 / -1; grid-row: 3; }
@media (pointer: coarse) { .vendor-row { min-height: 40px; } }`;
function injectVendorCss() {
  if (typeof document === 'undefined' || document.getElementById?.('vendor-page-css')) return;
  const st = document.createElement('style');
  st.id = 'vendor-page-css';
  st.textContent = VENDOR_PAGE_CSS;
  document.head?.append(st);
}

/**
 * THE PAGE, drawn into the pause window's detail pane.
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: (tag: string, cls?: string|null, text?: string|null) => any, divider: (t: string) => any }} kit
 */
export function drawVendorPage(detail, rerender, kit) {
  const p = _provider;
  if (!p) return;
  const { el, divider } = kit;
  injectVendorCss();
  injectVendorStatsCss();
  const btn = (cls, text, onPress, disabled = false) => {
    const b = el('button', `act ${cls}`, text);
    b.type = 'button';
    b.disabled = disabled || _st.busy;
    b.onclick = (e) => { e?.stopPropagation?.(); onPress(); };
    return b;
  };
  const nameOf = (it) => safe(() => p.nameOf(it), 'a piece') || 'a piece';
  const townOf = (map) => safe(() => p.townOf(map), 'a town') || 'a town';
  /** An act: one at a time, its word kept, my traders read again. */
  const act = async (start) => {
    if (_st.busy) return;
    _st.busy = true; rerender();
    let r = null;
    try { r = await start(); } catch { r = { ok: false, text: accountRefusalText('server') }; }
    _st.busy = false;
    _st.word = { ok: !!r?.ok, text: r?.text ?? '' };
    _st.mineAt = -Infinity;
    rerender();
  };

  /** A row's piece LOOKED AT: its name pressed opens its stats under it (one open at a time, `key` the row's own). */
  const lookable = (row, key, item) => {
    const open = _st.picked === key;
    row.classList?.add?.('vendor-look');
    if (open) row.classList?.add?.('on');
    const name = row.querySelector?.('b');
    if (name) { name.setAttribute?.('role', 'button'); name.setAttribute?.('aria-expanded', open ? 'true' : 'false'); name.title = open ? 'Hide its stats' : 'Show its stats'; }
    row.onclick = (e) => { if (e?.target?.closest?.('button')) return; _st.picked = open ? null : key; rerender(); };
    if (open) {
      let stats = null;
      try { stats = p.stats?.(item) ?? null; } catch { stats = null; }
      const look = vendorStatsNode(stats, el);
      if (look) { look.classList?.add?.('vendor-rowstats'); row.append(look); }
    }
  };
  // THE READS - mine when stale, the search's region when it changed
  if (!_st.mineBusy && Date.now() - _st.mineAt > VENDOR_PAGE_FRESH_MS) {
    _st.mineBusy = true;
    Promise.resolve(safe(() => p.mine(), null)).then((r) => {
      _st.mineBusy = false; _st.mineAt = Date.now();
      if (r?.ok) { _st.mine = r.data; _st.mineErr = null; } else _st.mineErr = r?.error ?? 'server';
      rerender();
    }, () => { _st.mineBusy = false; _st.mineAt = Date.now(); _st.mineErr = 'offline'; rerender(); });
  }
  if (_st.region == null) _st.region = safe(() => p.regionHere(), null) ?? 0;
  if (!_st.foundBusy && _st.foundFor !== _st.region) {
    const want = _st.region;
    _st.foundBusy = true;
    Promise.resolve(safe(() => p.search(want), null)).then((r) => {
      _st.foundBusy = false; _st.foundFor = want;
      _st.found = r?.ok ? r.data : { rows: [], error: r?.error ?? 'server' };
      rerender();
    }, () => { _st.foundBusy = false; _st.foundFor = want; _st.found = { rows: [], error: 'offline' }; rerender(); });
  }

  if (_st.word?.text) detail.append(el('p', `vendor-word${_st.word.ok ? '' : ' bad'}`, _st.word.text));

  // ─── YOUR TRADERS ───
  detail.append(divider('Your traders'));
  const mine = _st.mine;
  if (!mine) detail.append(el('p', 'px-note', _st.mineErr ? (_st.mineErr === 'offline' || _st.mineErr === 'server' ? VENDOR_PAGE_TEXT.cold : accountRefusalText(_st.mineErr)) : VENDOR_PAGE_TEXT.reading));
  else {
    const traders = mine.traders ?? [];
    if (!traders.length) detail.append(el('p', 'px-note', VENDOR_PAGE_TEXT.noTraders));
    for (const t of traders) {
      const here = (mine.stock ?? []).filter((l) => l.vendor?.map === t.map && l.vendor?.id === t.id);
      detail.append(el('p', 'vendor-line', `${townOf(t.map)} - ${here.length} piece${here.length === 1 ? '' : 's'} for sale`));
    }
    const takings = el('div', 'vendor-takings');
    takings.append(el('span', 'vendor-line', VENDOR_PAGE_TEXT.takings(Number(mine.gold) || 0)));
    if (Number(mine.gold) > 0) takings.append(btn('vendor-collect', 'Collect here', () => act(() => p.collectGold())));
    detail.append(takings);

    detail.append(divider('For sale'));
    const stock = mine.stock ?? [];
    if (!stock.length) detail.append(el('p', 'px-note', traders.length ? VENDOR_PAGE_TEXT.noStock : ''));
    const grid = el('div', 'vendor-rows');
    for (const l of stock) {
      const row = el('div', 'vendor-row');
      row.append(el('b', null, nameOf(l.item)), el('span', 'vendor-meta', `${wearText(wearOf(l.item)) ?? 'whole'} · ${goldText(l.price)} · ${townOf(l.vendor?.map)} · ${leftText(l.expiresAt)}`),
        btn('vendor-take', 'Take back', () => act(() => p.take(l))));
      lookable(row, `s:${l.id}`, l.item);
      grid.append(row);
    }
    detail.append(grid, el('p', 'vendor-sum', VENDOR_PAGE_TEXT.stays));

    detail.append(divider('Sold'));
    // LW15: the town's patrons' purchases beside the players' - each named, the buyer the town's own resident
    const sold = [...(mine.sold ?? []), ...(mine.patronSold ?? [])].sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
    if (!sold.length) detail.append(el('p', 'px-note', VENDOR_PAGE_TEXT.noSales));
    const sg = el('div', 'vendor-rows');
    let total = 0;
    for (const s of sold) {
      total += Number(s.gets) || 0;
      const row = el('div', 'vendor-row');
      const who = s.patron ? safe(() => p.patronName?.(s.patron), null) : null;   // LW15: "Sold to Ada Lark of Wayrest"
      row.append(el('b', null, nameOf(s.item)), el('span', 'vendor-meta', `${who ? `Sold to ${who} - ` : ''}${goldText(s.total)} - you got ${goldText(s.gets)} · ${townOf(s.vendor?.map)} · ${agoText(s.at)}`));
      lookable(row, `d:${s.listing}:${s.at}`, s.item);
      sg.append(row);
    }
    if (sold.length) sg.append(el('p', 'vendor-sum', `${sold.length} sale${sold.length === 1 ? '' : 's'} shown, ${goldText(total)} to you.`));
    detail.append(sg);
  }

  // ─── FIND TRADERS ───
  detail.append(divider('Find traders'));
  const wp = safe(() => p.waypoint0(), null);
  if (wp) {
    const line = el('div', 'vendor-waypoint');
    line.append(el('span', 'vendor-line', `Waypoint: ${wp.owner || 'a trader'}'s house in ${wp.town || townOf(wp.map)}`), btn('vendor-clear', 'Clear waypoint', () => { p.clearWaypoint(); rerender(); }));
    detail.append(line);
  }
  const head = el('div', 'prof-storehead');
  const search = el('input', 'prof-search');
  search.type = 'search'; search.placeholder = 'Search items, owners, towns'; search.value = _st.query;
  search.setAttribute?.('data-focus', 'vendor-search');
  search.oninput = () => { _st.query = search.value; _st.picked = null; rerender(); };
  const region = el('select', 'prof-sort');
  const names = p.regionNames ?? [];
  const here = safe(() => p.regionHere(), null);
  names.forEach((n, i) => {
    if (!n) return;
    const o = el('option', null, i === here ? `${n} (here)` : n);
    o.value = String(i);
    if (i === _st.region) o.selected = true;
    region.append(o);
  });
  region.onchange = () => { _st.region = Number(region.value); _st.picked = null; rerender(); };
  head.append(search, region);
  detail.append(head, el('p', 'vendor-sum', VENDOR_PAGE_TEXT.look));
  const found = _st.foundFor === _st.region ? _st.found : null;
  if (!found) { detail.append(el('p', 'px-note', 'Asking after the traders...')); return; }
  if (found.error && !(found.rows ?? []).length) { detail.append(el('p', 'px-note', found.error === 'offline' || found.error === 'server' ? VENDOR_PAGE_TEXT.cold : accountRefusalText(found.error))); return; }
  const rows = /** @type {any[]} */ (vendorSearch(found.rows ?? [], _st.query, { nameOf, townOf }));
  if (!rows.length) { detail.append(el('p', 'px-note', (found.rows ?? []).length ? VENDOR_PAGE_TEXT.noMatch : VENDOR_PAGE_TEXT.noneFound)); return; }
  const fg = el('div', 'vendor-rows');
  const wpKey = safe(() => p.waypointKey(), null);
  for (const r of rows) {
    const row = el('div', 'vendor-row');
    const set = wpKey === `${r.map}:${r.buildingKey}`;
    row.append(el('b', null, nameOf(r.item)), el('span', 'vendor-meta', `${goldText(r.price)} · ${r.owner ?? 'someone'}'s house, ${townOf(r.map)}${r.mine ? ' · yours' : ''}`),
      set ? btn('vendor-clear', 'Clear waypoint', () => { p.clearWaypoint(); rerender(); })
        : btn('vendor-wp', 'Set waypoint', () => { p.waypoint(r); rerender(); }));
    lookable(row, `f:${r.id}`, r.item);
    fg.append(row);
  }
  detail.append(fg);
}
