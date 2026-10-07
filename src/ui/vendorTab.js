// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-VENDOR (net/vendorLaw.js) - THE TRADERS, ON THE NOTICE BOARD AND AT THE STALL. One tab, two faces, in the Notice
// Board's window (ui/noticeWindow.js) and its styles (the Market tab's rows):
//
//   THE BOARD's Vendors tab: every piece standing at a trader of a home in the board's region, newest first, searched by
//   every word typed over the item's name, the owner and the town (vendorSearch). A row picked says whose house and which
//   town, and sets a WAYPOINT on it (the host's: the town marked on the travel map, the house on the town map). Nothing
//   is bought here - a trader's goods are bought at the trader alone.
//
//   THE STALL (a trader pressed in its home): a visitor's Buy off the purse, at the listing's own price; the owner's
//   stock with Take back, and a piece from the pack put up at a price for the trader's thirty days.
//
// The host (scenes/world.js) hands the reads and the acts; this file draws them.
// ═══════════════════════════════════════════════════════════════════

import { accountRefusalText } from '../net/accountClient.js';
import { goldText, wearOf, wearText, MARKET_PRICE_MAX } from '../net/marketLaw.js';
import { vendorSearch, VENDOR_LISTING_S } from '../net/vendorLaw.js';

const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const button = (cls, text, onPress) => {
  const b = /** @type {HTMLButtonElement} */ (el('button', `act ${cls}`, text));
  b.setAttribute('type', 'button');
  b.onclick = (e) => { e?.stopPropagation?.(); return onPress(); };
  return b;
};
const intOf = (s, lo, hi) => { const n = Math.floor(Number(s)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };
/** BOARD-UI: the column names over the rows - the Market tab's own (`.market-listhead`, its piece rows' columns). */
const listHead = (names) => {
  const h = el('div', 'market-listhead market-piece');
  h.setAttribute('aria-hidden', 'true');
  for (const n of names) h.append(el('span', null, n));
  return h;
};
/** How long a piece still stands, in days or hours. */
export function standsText(expiresAt, nowS) {
  const left = Math.max(0, Number(expiresAt) - nowS);
  const days = Math.floor(left / 86_400);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} left`;
  const hours = Math.max(1, Math.ceil(left / 3600));
  return `${hours} hour${hours === 1 ? '' : 's'} left`;
}
/** A piece's stats as the Notice Board and the Vendor page show them - `stats` the host's `{ rows, magic }` (the look
 *  panel's rows - damage, armour, hands, material, condition, weight - and the magic the trade window names), a row a
 *  line and the magic in the tier's gold under them; null for a piece the host cannot read. */
export function vendorStatsNode(stats, el = (t, c = null, x = null) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }) {
  if (!stats || (!stats.rows?.length && !stats.magic?.length)) return null;
  const box = el('div', 'vendor-stats');
  if (stats.rows?.length) {
    const dl = el('div', 'vendor-statrows');
    for (const r of stats.rows) dl.append(el('span', 'vendor-stat', r));
    box.append(dl);
  }
  if (stats.magic?.length) {
    const ul = el('ul', 'vendor-magic');
    for (const m of stats.magic) ul.append(el('li', null, m));
    box.append(ul);
  }
  return box;
}
/** The stats' dress - the Plus palette, the board's and the pause window's alike. */
export const VENDOR_STATS_CSS = `.vendor-stats { flex: 1 1 100%; display: flex; flex-direction: column; gap: 4px; margin: 2px 0; text-align: left; }
.vendor-statrows { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: #d9cfbd; }
.vendor-stat { white-space: nowrap; }
.vendor-magic { margin: 0; padding: 0 0 0 14px; font-size: 12px; color: #f3cf86; }
.vendor-magic li { margin: 1px 0; }`;
export function injectVendorStatsCss() {
  if (typeof document === 'undefined' || document.getElementById?.('vendor-stats-css')) return;
  const st = document.createElement('style');
  st.id = 'vendor-stats-css';
  st.textContent = VENDOR_STATS_CSS;
  document.head?.append(st);
}

/** The words the stall and the board say. BOARD-UI (Mac: "Reduce overusage of bloated text"): short, and plain. */
export const VENDOR_TEXT = Object.freeze({
  boardEmpty: 'No trader in this region has anything for sale.',
  searchEmpty: 'No trader\'s goods match that search.',
  stallEmpty: 'The trader has nothing for sale.',
  ownEmpty: 'Your trader has nothing for sale yet. Put up a piece from your pack below.',
  reading: 'Reading the traders...',
  cold: 'The traders did not load.',
  boardTip: 'Bought only at the trader\'s stall, in the owner\'s house. Pick a row for its stats and a waypoint.',
  noGold: 'Only a character whose gold is kept online can trade here.',
  packEmpty: 'Nothing in your pack can be put up for sale.',
  stockTip: `Each piece stays up ${Math.round(VENDOR_LISTING_S / 86_400)} days, then comes back to you. Collect your takings on the Vendor page (pause menu, Professions).`,
});

/**
 * THE TAB. `v` the host's side:
 *   both: stats(item) -> { rows: string[], magic: string[] } | null - a piece's stats, shown on the picked row
 *   mode 'board': { region, regionName, read() -> {ok,data:{rows},error}, nameOf(item), townOf(map), waypoint(row) -> bool,
 *                   waypointKey() -> 'map:key'|null, clearWaypoint() }
 *   mode 'stall': { owner, own, read() -> {ok,data:{vendor,rows},error}, nameOf(item), purse() -> gold|null,
 *                   buy(row) -> {ok,text}, take(row) -> {ok,text}, goods() -> [{item, why?}], put(goodItem, price) -> {ok,text} }
 * `ui` the window's: { busy(), run(start), rerender(), nowS(), alive() }.
 * @param {any} v @param {{ busy: () => boolean, run: (start: () => Promise<any>) => Promise<void>, rerender: () => void, nowS: () => number, alive: () => boolean }} ui
 */
export function createVendorTab(v, ui) {
  const st = { data: /** @type {any} */ (null), error: /** @type {string|null} */ (null), loading: false, query: '', picked: /** @type {string|null} */ (null), price: 100, good: /** @type {any} */ (null) };
  const stall = v.mode === 'stall';
  const nameOf = (it) => { try { return v.nameOf?.(it) || 'a piece'; } catch { return 'a piece'; } };
  const townOf = (map) => { try { return v.townOf?.(map) || 'a town'; } catch { return 'a town'; } };
  let seq = 0;
  async function load() {
    const mine = ++seq;
    st.loading = true; ui.rerender();
    let r = null;
    try { r = await v.read(); } catch { r = { ok: false, error: 'offline' }; }
    if (!ui.alive() || mine !== seq) return;
    st.loading = false;
    st.data = r?.ok ? r.data : st.data;
    st.error = r?.ok ? null : (r?.error ?? 'server');
    ui.rerender();
  }
  /** An act through the window's one door, the tab read again on its answer. */
  const act = (start) => ui.run(async () => {
    let r = null;
    try { r = await start(); } catch { r = { ok: false, text: accountRefusalText('server') }; }
    load();
    return r;
  });

  /** A row as the Market tab draws one (its `.market-row`, its picked `.market-bar` straight under it in the list - the
   *  Plus dress's own rules, no wrapper of this tab's): the row, and its bar when picked. */
  function rowNodes(row, { buy = false, take = false, where = false } = {}) {
    const b = el('button', `market-row market-piece market-good${st.picked === row.id ? ' on' : ''}`);
    b.setAttribute('type', 'button');
    b.setAttribute('aria-expanded', st.picked === row.id ? 'true' : 'false');
    b.onclick = () => { st.picked = st.picked === row.id ? null : row.id; ui.rerender(); };
    b.append(el('b', null, nameOf(row.item)),
      el('span', 'market-quality', wearText(wearOf(row.item)) ?? 'whole'),
      el('span', 'market-price', goldText(row.price)),
      el('span', 'market-where', where ? `${row.owner ?? 'someone'}'s house, ${townOf(row.map)}` : standsText(row.expiresAt, ui.nowS())));
    if (row.mine && !stall) b.append(el('span', 'market-mine', 'yours'));   // at my own stall every piece is mine: said once, in its title
    if (st.picked !== row.id) return [b];
    const bar = el('div', 'market-bar');
    // THE PIECE LOOKED AT: its stats and its magic, before what to do with it
    let stats = null;
    try { stats = v.stats?.(row.item) ?? null; } catch { stats = null; }
    const look = vendorStatsNode(stats, el);
    if (look) bar.append(look);
    if (where) {
      const set = v.waypointKey?.() === `${row.map}:${row.buildingKey}`;
      bar.append(el('span', 'market-ask', `Sold at ${row.owner ?? 'someone'}'s house in ${townOf(row.map)}.`));
      bar.append(set
        ? button('market-cancel', 'Clear waypoint', () => { v.clearWaypoint?.(); ui.rerender(); })
        : button('primary market-buy', 'Set waypoint', () => { v.waypoint?.(row); ui.rerender(); }));
    }
    if (buy) {
      const purse = v.purse?.();
      const short = purse != null && purse < row.price;
      bar.append(el('span', 'market-ask', purse == null ? VENDOR_TEXT.noGold : `Buy ${nameOf(row.item)} for ${goldText(row.price)}?${short ? ' You cannot pay that.' : ''}`));
      const go = button('primary market-buy', ui.busy() ? 'Buying...' : 'Buy', () => act(() => v.buy(row)));
      go.disabled = ui.busy() || purse == null || short;
      bar.append(go);
    }
    if (take) {
      bar.append(el('span', 'market-ask', `Take ${nameOf(row.item)} off sale and back into your pack?`));
      const back = button('market-cancel', 'Take back', () => act(() => v.take(row)));
      back.disabled = ui.busy();
      bar.append(back);
    }
    return [b, bar];
  }

  function searchNode() {
    const row = el('div', 'market-filters');
    const search = /** @type {HTMLInputElement} */ (el('input', 'notice-input market-search'));
    search.placeholder = 'Search items, owners, towns';
    search.setAttribute('aria-label', 'Search the traders');
    search.setAttribute('data-focus', 'vendor-search');
    search.value = st.query;
    search.oninput = () => { st.query = search.value; st.picked = null; ui.rerender(); };
    search.type = 'search';   // the field's own clear
    row.append(search);
    return row;
  }

  function putNode() {
    const box = el('div', 'market-listform');   // the Market tab's List form's dress
    box.append(el('h4', null, 'Put up a piece from your pack'));
    const goods = (v.goods?.() ?? []).filter((g) => !g.why);
    if (!goods.some((g) => g.item === st.good)) st.good = goods[0]?.item ?? null;
    if (!goods.length) { box.append(el('p', 'notice-tip', VENDOR_TEXT.packEmpty)); return box; }
    const sel = /** @type {HTMLSelectElement} */ (el('select', 'notice-select market-select'));
    sel.setAttribute('aria-label', 'Piece from your pack');
    goods.forEach((g, i) => { const o = /** @type {HTMLOptionElement} */ (el('option', null, nameOf(g.item))); o.value = String(i); if (g.item === st.good) o.selected = true; sel.append(o); });
    sel.onchange = () => { st.good = goods[Number(sel.value)]?.item ?? null; ui.rerender(); };
    const price = /** @type {HTMLInputElement} */ (el('input', 'notice-input market-num'));
    price.type = 'number'; price.min = '1'; price.max = String(MARKET_PRICE_MAX); price.value = String(st.price);
    price.setAttribute('aria-label', 'Price in gold');
    price.setAttribute('data-focus', 'vendor-price');
    price.oninput = () => { st.price = intOf(price.value, 1, MARKET_PRICE_MAX); };
    const chosen = st.good;
    const go = button('primary market-post', ui.busy() ? 'Putting up...' : 'Put up for sale', () => act(() => v.put(chosen, st.price)));
    go.disabled = ui.busy() || !chosen;
    // AUDIT 657 B3: its fields under their names, as the List form's (marketTab.js field) - BOARD-UI stood that form's
    // fields in a column, and this form, in its dress, stood its select and its press each the window's width
    const field = (name, input, cls = '') => { const f = el('label', `market-field${cls ? ` ${cls}` : ''}`); f.append(el('span', 'notice-label', name), input); return f; };
    const fields = el('div', 'market-fields');
    fields.append(field('Piece', sel, 'market-field-wide'), field('Price in gold', price), go);
    box.append(fields, el('p', 'notice-tip', VENDOR_TEXT.stockTip));
    return box;
  }

  function body() {
    injectVendorStatsCss();
    const box = el('div', 'notice-cork market-body vendor-body');
    if (st.error && !st.data) {
      const p = el('p', 'notice-empty', st.error === 'offline' || st.error === 'server' ? VENDOR_TEXT.cold : accountRefusalText(st.error));
      p.append(button('notice-retry', 'Try again', () => load()));
      box.append(p);
      return box;
    }
    if (st.loading && !st.data) { box.append(el('p', 'notice-empty', VENDOR_TEXT.reading)); return box; }
    const rows = st.data?.rows ?? [];
    const list = el('div', 'market-rows');
    if (!stall) {
      box.append(el('p', 'notice-tip', VENDOR_TEXT.boardTip), searchNode());
      const found = vendorSearch(rows, st.query, { nameOf, townOf });
      if (found.length) list.append(listHead(['Item', 'Condition', 'Price', 'Sold at']));
      for (const r of found) list.append(...rowNodes(r, { where: true }));
      if (st.data && !found.length) list.append(el('p', 'notice-empty', rows.length ? VENDOR_TEXT.searchEmpty : VENDOR_TEXT.boardEmpty));
      box.append(list);
      return box;
    }
    const own = v.own === true;
    if (rows.length) list.append(listHead(['Item', 'Condition', 'Price', 'Stays up']));
    for (const r of rows) list.append(...rowNodes(r, { buy: !own && !r.mine, take: own && r.mine }));
    if (st.data && !rows.length) list.append(el('p', 'notice-empty', own ? VENDOR_TEXT.ownEmpty : VENDOR_TEXT.stallEmpty));
    box.append(list);
    if (own) box.append(putNode());
    return box;
  }

  return { body, open: load, load, state: st };
}
