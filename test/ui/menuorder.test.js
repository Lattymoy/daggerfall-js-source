// MENU-ORDER (2026-10-12; the owner: "I want to really organize and enhance the decoration menu/buttons. Making it for
// palatable, readable and easy to understand. I want to do the same for stores, crafting menus, etc", then "I just feel
// like text lists are too much. Why cant you try something else"): bible/10-UI/Menu-Order.md. Pictures before words -
// the decorator's catalogue and its rooms as tiles, every kind and press its glyph, the bar's keys folded; the shop
// counter's prices on its rows and its lists as pictures on a press; the Stores page's stations as tiles, its works and
// patterns as cards.
import '../chargenDom.mjs';   // a document for the tabs that draw after an await (withDom's is the call's alone)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DFICON_ROWS, DFICON_CSS, dficonSvg } from '../../src/ui/menu/menuGlyphs.js';
import { DECOR_KINDS } from '../../src/systems/decor/decorCatalogue.js';
import { createDecorBar, decorBarKeys, decorFiltersText, DECOR_LAYOUT_WORDS, DECOR_KEYS_WORD, DECOR_CSS } from '../../src/ui/decorPanel.js';
import { all, one, text, chipNamed, rows, panelRig } from '../decorFakes.mjs';
import { fakeDoc, fakeWin, settle, toolRig } from '../decorFakes.mjs';
import { createDecorPanel } from '../../src/ui/decorPanel.js';
import { createShipPortraits, shipPortraitCamera, SHIP_PORTRAIT_W, SHIP_PORTRAIT_H, SHIP_PORTRAITS_A_FRAME, SHIP_PORTRAIT_WAIT_MS } from '../../src/scenes/shipPortraits.js';
import { canvasBoxUnder, PANEL_PICTURE_CLEAR, panelPicture, panelPictureStudio } from '../../src/scenes/panelPicture.js';
import { Renderer } from '../../src/render/renderer.js';
import { markRemapLaw, remapLawOf } from '../../src/world/texRemap.js';
import { ENHANCED_CSS } from '../../src/ui/enhanced/enhancedStyle.js';
import { DFICON_CSS as GLYPHS } from '../../src/ui/menu/menuGlyphs.js';
import { createComeSailAwayPool } from '../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { Boat } from '../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { fileURLToPath } from 'node:url';
import { decorThumbCamera, DECOR_THUMB_PX, DECOR_THUMBS_A_FRAME, DECOR_THUMB_WAIT_MS } from '../../src/scenes/decor/decorTool.js';
import { withDom } from '../invdrag.mjs';
import { mountEnhancedTrade, TRADE_TITLE, TRADE_OWN_HEAD, TRADE_COST_WORD, TRADE_GOLD_WORD, TRADE_VIEW_WORDS, tradeGoldText } from '../../src/ui/enhanced/enhancedTrade.js';
import { stockShopShelf } from '../../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { setProfessionsPages, drawStoresPage, stationWorkable, STATION_TILES, STATION_TILE_WORDS } from '../../src/ui/professions/profPages.js';
import { xpForRank, trackOf } from '../../src/net/professionLaw.js';
import { createMarketTab, MARKET_VIEW_ICONS, MARKET_VIEW_GROUPS } from '../../src/ui/marketTab.js';
import { createVendorTab } from '../../src/ui/vendor/vendorTab.js';
import { PROF_CSS } from '../../src/ui/enhanced/enhancedPlusStyle.js';
import { pictureNode } from '../../src/ui/menu/menuGlyphs.js';
import { setVendorPage, drawVendorPage, resetVendorPage } from '../../src/ui/vendor/vendorPage.js';
import { mountReforgeWindow, REFORGE_PAGES, REFORGE_PAGE_ICONS } from '../../src/ui/reforgeWindow.js';
import { SHIPYARD_CSS, SHIPYARD_TAB_ICONS } from '../../src/ui/shipyardWindow.js';
import { SHIPYARD_HULLS } from '../../src/systems/shipyards.js';
import { mountNavalYardWindow } from '../../src/ui/naval/navalYardWindow.js';
import { mountEnhancedMerchantPanel, MERCHANT_ICONS } from '../../src/ui/enhanced/enhancedMerchantPanel.js';
import { REFORGE_CSS, PLUS_CSS } from '../../src/ui/enhanced/enhancedPlusStyle.js';
import { BROKER_CSS } from '../../src/ui/enhanced/enhancedPlusStyle.js';
import { refusePress, brokerSkinCss } from '../../src/ui/brokerWindow.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const lit = (rows) => rows.join('').split('').filter((c) => c === '#').length;

test('MENU-ORDER the glyphs: every one twelve rows of twelve, drawn a rect a lit pixel, each its own mask in the sheet; every kind the catalogue sorts by and every station tile has one (mutants: a glyph a pixel short; a kind with none; the mask never named)', () => {
  for (const [name, rows] of Object.entries(DFICON_ROWS)) {
    assert.equal(rows.length, 12, `${name}: twelve rows`);
    for (const r of rows) assert.equal(r.length, 12, `${name}: a row of twelve`);
    assert.equal((dficonSvg(rows).match(/<rect /g) ?? []).length, lit(rows), `${name}: a rect a lit pixel`);
    assert.ok(DFICON_CSS.includes(`[data-dficon="${name}"] { --dficon: url("data:image/svg+xml,`), `${name}: its mask`);
  }
  assert.match(DFICON_CSS, /\[data-dficon\]::before \{ content: ''; [^}]*background-color: currentColor; -webkit-mask: var\(--dficon\)/, 'drawn in the word\'s own colour');
  for (const kind of Object.keys(DECOR_KINDS)) assert.ok(DFICON_ROWS[kind], `the kind ${kind} has its picture`);
  for (const [, icon] of Object.values(STATION_TILES)) assert.ok(DFICON_ROWS[icon], `the station glyph ${icon}`);
});

test('MENU-ORDER the decorator as pictures: the catalogue tiles by default, a model\'s tile its kind\'s glyph over the letters it keeps, a flat\'s its picture, what a piece does a badge; List lays it as lines and Pictures back; every tab, kind and has-filter its glyph; the layout\'s two chips after the tabs (mutants: the grid never laid; the model\'s glyph dropped; the badges dropped; the switch dead)', async () => {
  const rig = panelRig();
  rig.panel.open(rig.view());
  const root = rig.panel.root;
  const card = one(root, 'dfdecor-card');
  assert.equal(card.dataset.view, 'grid', 'pictures first');
  const byKey = new Map(rows(root).map((r) => [r.dataset.key, r]));
  const bed = rig.entries.find((e) => e.model != null && e.kind === 'bed');
  const bedThumb = one(byKey.get(bed.key), 'dfdecor-thumb');
  assert.deepEqual([bedThumb.dataset.dficon, bedThumb.textContent], ['bed', 'Be'], 'a model: its kind\'s glyph, the letters kept for a reader');
  const flat = rig.entries.find((e) => e.flat);
  assert.equal(one(byKey.get(flat.key), 'dfdecor-thumb').children[0].tag, 'img', 'a flat: its own picture');
  const chest = rig.entries.find((e) => e.storage);
  assert.deepEqual(all(byKey.get(chest.key), 'dfdecor-badge').map((b) => b.dataset.dficon), ['storage'], 'holds things, as a picture');
  const candle = rig.entries.find((e) => e.light != null);
  assert.ok(all(byKey.get(candle.key), 'dfdecor-badge').some((b) => b.dataset.dficon === 'light'), 'gives light, as a picture');
  chipNamed(root, DECOR_LAYOUT_WORDS.list).fire('click');
  assert.equal(card.dataset.view, 'list', 'List: lines');
  chipNamed(root, DECOR_LAYOUT_WORDS.grid).fire('click');
  assert.equal(card.dataset.view, 'grid', 'Pictures: tiles again');
  const tabs = all(one(root, 'dfdecor-tabs'), 'dfdecor-chip');
  assert.deepEqual(tabs.map((t) => t.dataset.dficon), ['all', 'room', 'own', 'furniture'], 'each view its picture');
  assert.equal(chipNamed(root, DECOR_KINDS.bed).dataset.dficon, 'bed');
  assert.deepEqual(['Holds things', 'Gives light'].map((w) => chipNamed(root, w).dataset.dficon), ['storage', 'light']);
  const chips = all(root, 'dfdecor-chip');
  assert.ok(chips.indexOf(chipNamed(root, DECOR_LAYOUT_WORDS.grid)) > chips.indexOf(tabs.at(-1)), 'the layout after the views');
});

test('MENU-ORDER the decorator\'s presses: a placed piece\'s each its glyph, Remove edged as a warning, the room tiles too; the bar\'s keys folded behind Keys, its presses pictured; the legend\'s pairs and the phone fold\'s count; a portrait phone\'s bar the screen\'s width under the touch layer\'s presses (mutants: Remove not a warning; the legend shown from the first; the fold\'s count; the portrait bar narrow)', () => {
  const rig = panelRig();
  const piece = { id: 'p1', model: 41000, paid: 120, light: 1, storage: false };
  rig.panel.open(rig.view({ placed: [{ piece, name: 'Bed', entry: rig.entries[0], holds: false }] }));
  rig.panel.showRoom('p1');
  const root = rig.panel.root;
  assert.equal(one(root, 'dfdecor-card').dataset.view, 'grid', 'the room\'s pieces tile too');
  assert.deepEqual(all(rows(root)[0], 'dfdecor-badge').map((b) => b.dataset.dficon), ['light']);
  const btn = (re) => all(root, 'dfdecor-btn').find((b) => re.test(b.textContent));
  assert.deepEqual([/^Move$/, /^Duplicate$/, /^Turn left$/, /^Turn right$/, /^Light/, /^Holds things/, /^Station:/, /^Remove$/].map((re) => btn(re).dataset.dficon),
    ['move', 'place', 'turn-left', 'turn-right', 'light', 'storage', 'list', 'remove']);
  assert.ok(String(btn(/^Remove$/).className).split(/\s+/).includes('warn'), 'Remove, edged as a warning');
  const bar = createDecorBar({ on: {}, doc: fakeDoc() });
  assert.equal(bar.root.dataset.keys, '0', 'the legend folded');
  const keysChip = all(bar.root, 'dfdecor-chip').find((c) => c.textContent === DECOR_KEYS_WORD);
  keysChip.fire('click');
  assert.equal(bar.root.dataset.keys, '1', 'Keys unfolds it');
  keysChip.fire('click');
  assert.equal(bar.root.dataset.keys, '0');
  assert.deepEqual(['Place', 'Raise', 'Lower', 'Grid', 'Preview', 'Back'].map((w) => all(bar.root, w === 'Place' ? 'dfdecor-btn' : 'dfdecor-chip').find((c) => c.textContent === w).dataset.dficon),
    ['place', 'up', 'down', 'grid', 'decorate', 'back']);
  assert.match(text(one(bar.root, 'dfdecor-bar-keys')), /^Fly: walk keys/, 'the legend, a name and what presses it');
  assert.deepEqual(decorBarKeys(false).map(([k]) => k), ['Fly', 'Look', 'Turn', 'Raise/lower', 'Size', 'Grid', 'Place', 'Back']);
  assert.ok(!decorBarKeys(false, false).some(([k]) => k === 'Size'), 'a figure: no Size');
  assert.deepEqual(decorBarKeys(true).map(([k]) => k), ['Fly', 'Look']);
  assert.equal(decorFiltersText({ kinds: new Set(), size: null, storage: null, light: null }), 'Filters');
  assert.equal(decorFiltersText({ kinds: new Set(['bed', 'light']), size: 'small', storage: true, light: null }), 'Filters (4)');
  // a portrait phone's bar: under the touch layer's top-left presses (16px down, 48px tall), the screen's width
  assert.ok(DECOR_CSS.includes('@media (orientation: portrait) { .dfdecor-bar.touch { top: calc(72px + env(safe-area-inset-top, 0px)); max-width: calc(100vw - 24px); } }'),
    'a portrait phone\'s bar the screen\'s width, below the presses');
  assert.ok(DECOR_CSS.includes('.dfdecor-bar.touch { bottom: auto; top: calc(8px + env(safe-area-inset-top, 0px)); max-width: calc(100vw - 272px); }'), 'a landscape one keeps its clearance beside them');
});

/** Every word under a node - the fake's textContent is its own alone. */
const said = (n) => (n.textContent || '') + (n.children ?? []).map(said).join('');
const find = (root, sel, txt = null) => root.querySelectorAll(sel).find((n) => txt == null || n.textContent === txt) ?? null;
const shelf = () => stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 10 }, {}, { rolls: () => 0, torchesFromItems: false });

test('MENU-ORDER the shop counter: the mode whole in its title, the player\'s column named, the footer\'s two figures each under its name, a price on every shelf row (the strip\'s own), Steal set apart; the lists as pictures on a press (mutants: the row\'s price dropped; the figures run together; the switch dead)', () => {
  assert.equal(TRADE_TITLE.SellMagic, 'Sell magic items');
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const items = shelf();
    const view = mountEnhancedTrade(host, { mode: 'Buy', shopName: 'The Shop', shelfItems: () => items, packItems: () => [], accepts: () => true,
      enchanted: () => false, priceCtx: () => ({ quality: 10, priceAdjustment: 1000, skills: { mercantile: 50, personality: 50 } }), gold: () => 1840 });
    assert.equal(find(host, '.sb-who').children[0].textContent, 'The Shop — Buy');   // the title (the fake's tag reader stops at a digit)
    assert.equal(find(find(host, '.trade-ownhead'), '.remotewho').children[0].textContent, TRADE_OWN_HEAD);   // the fake reads one compound selector: nested finds
    assert.deepEqual(host.querySelectorAll('.trade-fig').map((f) => f.children.map((n) => [n.tagName, n.textContent])),
      [[['SMALL', TRADE_COST_WORD.Buy], ['B', tradeGoldText(0)]], [['SMALL', TRADE_GOLD_WORD], ['B', '1,840 gold']]], 'each figure under its name');
    const shelfRows = () => find(host, '.packremote').querySelectorAll('.itemrow');
    const row = shelfRows()[0];
    const price = find(row, '.itemprice').textContent;
    row.onclick({ timeStamp: 1 });
    const quote = Number(/^Buy for (\d+) gold$/.exec(find(host, '.trade-quote').textContent)?.[1]);
    assert.ok(quote > 0);
    assert.equal(price, tradeGoldText(quote), 'the row says what the strip quotes');
    assert.equal(shelfRows().filter((r) => !find(r, '.itemprice')).length, 0, 'every shelf row priced');
    assert.ok(find(host, '.trade-steal', 'Steal'), 'Steal, set apart');
    const shell = find(host, '.trade-shell');
    assert.equal(shell.dataset.view, 'list', 'lines first');
    find(find(host, '.trade-view'), '.act', TRADE_VIEW_WORDS.grid).onclick();
    assert.equal(find(host, '.trade-shell').dataset.view, 'grid', 'pictures on a press');
    find(find(host, '.trade-view'), '.act', TRADE_VIEW_WORDS.list).onclick();
    assert.equal(find(host, '.trade-shell').dataset.view, 'list');
    view.unmount();
  });
});

test('MENU-ORDER the Stores page\'s stations as tiles: a tile a station, the ones worked here lit and drawn below, the ones away kept hidden until their tile is pressed (and hidden again on a second press); a section worked here is one with a press in it; the forge\'s works and the anvil\'s patterns are cards (mutants: an away station shown; the press never toggling; a section with a button read as away)', () => {
  withDom((dom) => {
    const held = new Map([['ore:iron', 34], ['ingot:iron', 6], ['wood:charcoal', 20]]);
    const tracks = new Map([['smithing', { profession: 'smithing', xp: xpForRank(10), rank: 10, specs: { 50: null, 100: null } }]]);
    const stores = new Map([...held].map(([k, n]) => [k, { material: k, own: n, bought: 0 }]));
    const book = {
      state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores, tracks, today: {}, caps: null }, stale: () => false, refresh: async () => ({ ok: true }),
      held: (k) => held.get(k) ?? 0, store: (k) => stores.get(k) ?? { material: k, own: 0, bought: 0 },
      track: (p) => tracks.get(trackOf(p)) ?? { profession: trackOf(p), xp: 0, rank: 0, specs: { 50: null, 100: null } }, materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0,
      choose: async () => ({ ok: true }),
    };
    setProfessionsPages({ book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), forge: () => ({ kind: 'shop', fee: 50 }), workbench: () => null,
      smelt: async () => ({ ok: true, text: '' }), craft: async () => ({ ok: true, text: '' }), stock: async () => ({ ok: true, text: '' }), heatBand: () => 1, planeBand: () => 1 });
    const el = (tag, cls, t) => { const n = document.createElement(tag); if (cls) n.className = cls; if (t != null) n.textContent = t; return n; };
    const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
    let root = null;
    const draw = () => { root = el('div'); drawStoresPage(root, draw, kit); };
    draw();
    const tile = (id) => root.querySelectorAll('.prof-stile').find((t) => t.attrs['data-station'] === id);
    assert.deepEqual([tile('forge').className.includes('here'), find(tile('forge'), '.prof-stile-state').textContent], [true, STATION_TILE_WORDS.here], 'the forge, worked here');
    assert.deepEqual([tile('workbench').className.includes('here'), find(tile('workbench'), '.prof-stile-state').textContent], [false, STATION_TILE_WORDS.away]);
    assert.equal(tile('forge').attrs['data-dficon'], STATION_TILES.forge[1]);
    const awayBox = () => find(root, '.prof-awaynotes').querySelectorAll('.prof-station').find((b) => /The Workbench/.test(said(b)));
    assert.equal(awayBox().hidden, true, 'away: its words kept, hidden');
    assert.ok(find(root, '.prof-works'), 'the forge\'s works, cards');
    assert.ok(find(root, '.prof-works').querySelectorAll('button').some((b) => b.textContent === 'Smelt'));
    assert.ok(find(root, '.prof-recipes'), 'the anvil\'s patterns, cards');
    tile('workbench').onclick();
    assert.equal(awayBox().hidden, false, 'pressed: where it is worked');
    assert.ok(tile('workbench').className.includes('on'));
    tile('workbench').onclick();
    assert.equal(awayBox().hidden, true, 'pressed again: put away');
    assert.equal(stationWorkable({ children: [{ tag: 'div', children: [{ tagName: 'BUTTON', children: [] }] }] }), true);
    assert.equal(stationWorkable({ children: [{ tag: 'h3', children: [] }, { tag: 'p', children: [] }] }), false);
    setProfessionsPages(null);
  });
});

test('MENU-ORDER the board\'s rows pictured: a Market material row, a supplier\'s row and a trader\'s piece wear the host\'s picture before their name (and none without one); a Stores card its material\'s; the market\'s views each their glyph, and a phone\'s row of them never squeezed to nothing (mutants: the picture never asked; asked of the wrong key; the views bare; the phone\'s views collapsed)', async () => {
  const PIC = { src: 'data:pic', w: 26, h: 26 };
  const asked = [];
  const picOf = (root) => { const out = []; const walk = (n) => { for (const c of n.children ?? []) { if (c.tagName === 'IMG') out.push(c); walk(c); } }; walk(root); return out; };
  {
    const data = { materials: { rows: [{ id: 'A', kind: 'material', material: 'ore:iron', units: 9, price: 3, region: 17, road: { courier: 0, seconds: 0, road: 0 } }], medians: {} } };
    const book = { state: { open: true, balance: 50, road: [], counts: {} }, pending: 0, cached: () => null, read: async (view) => ({ ok: true, data: data[view] ?? { rows: [] } }), settle: async () => ({ ok: true, settled: 0 }) };
    const m = { book, stores: () => new Map(), region: 17, regionName: 'Daggerfall', regionNameOf: () => 'Wayrest', hubs: {}, name: (k) => k, countName: (k) => k,
      pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'a piece', weavers: [{ key: 'cloth:linen', marks: 2 }], stock: async () => ({ ok: true }),
      picture: (k) => { asked.push(k); return k === 'ore:iron' || k === 'cloth:linen' ? PIC : null; } };
    let root = null;
    const tab = createMarketTab(m, { busy: () => false, run: async (go) => go(), rerender: () => { root = tab.body(); }, nowS: () => 0, alive: () => true });
    await tab.open();
    root = tab.body();
    const row = find(root, '.market-row');
    const name = row.children[0];
    assert.equal(name.tagName, 'B');
    assert.deepEqual(picOf(name).map((i) => [i.className, i.attrs.src]), [['market-pic', 'data:pic']], 'the material\'s picture before its name');
    assert.ok(asked.includes('ore:iron') && asked.includes('cloth:linen'), 'asked of the row\'s own material and the supplier\'s');
    const counter = find(root, '.market-counterrow');
    assert.equal(picOf(counter).length, 1, 'the supplier\'s row pictured');
    const views = root.querySelectorAll('.market-view');
    assert.deepEqual(views.map((v) => v.attrs['data-dficon']), MARKET_VIEW_GROUPS.flatMap(([, ids]) => ids).map((id) => MARKET_VIEW_ICONS[id]), 'each view its glyph');
    for (const icon of Object.values(MARKET_VIEW_ICONS)) assert.ok(DFICON_ROWS[icon], `a glyph for ${icon}`);
    const bare = createMarketTab({ ...m, picture: undefined }, { busy: () => false, run: async (go) => go(), rerender: () => {}, nowS: () => 0, alive: () => true });
    await bare.open();
    assert.equal(picOf(find(bare.body(), '.market-row')).length, 0, 'no picture: the name alone');
    const vendors = createVendorTab({ mode: 'board', read: async () => ({ ok: true, data: { rows: [{ id: 'v', item: { name: 'Dagger' }, price: 9, owner: 'Eve', map: 1, buildingKey: 2, expiresAt: 99 }] } }),
      nameOf: (i) => i.name, townOf: () => 'Daggerfall', picture: (it) => (it.name === 'Dagger' ? PIC : null) }, { busy: () => false, run: async (go) => go(), rerender: () => {}, nowS: () => 0, alive: () => true });
    await vendors.open?.();
    const vrow = find(vendors.body(), '.market-row');
    assert.deepEqual(picOf(vrow.children[0]).map((i) => i.attrs.src), ['data:pic'], 'a trader\'s piece pictured');
  }
  assert.match(PROF_CSS, /@media \(max-width: [0-9]+px\) \{[^]*?\.market-views \{ flex: none; flex-wrap: nowrap; overflow-x: auto;/, 'a phone\'s views keep their height');
  assert.equal(pictureNode(null, () => null, 'x'), null);
  withDom(() => {
    const held = new Map([['ore:iron', 34]]);
    const stores = new Map([...held].map(([k, n]) => [k, { material: k, own: n, bought: 0 }]));
    const book = { state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores, tracks: new Map(), today: {}, caps: null }, stale: () => false, refresh: async () => ({ ok: true }),
      held: (k) => held.get(k) ?? 0, store: (k) => stores.get(k), track: (pr) => ({ profession: trackOf(pr), xp: 0, rank: 0, specs: { 50: null, 100: null } }), materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0 };
    setProfessionsPages({ book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), picture: (k) => (k === 'ore:iron' ? PIC : null) });
    const el = (tag, cls, t) => { const n = document.createElement(tag); if (cls) n.className = cls; if (t != null) n.textContent = t; return n; };
    const root = el('div');
    drawStoresPage(root, () => {}, { el, divider: (w) => el('h3', null, w), meter: () => el('div') });
    const card = find(root, '.prof-mat');
    assert.deepEqual(picOf(card.children[0]).map((i) => [i.className, i.attrs.src]), [['prof-matpic', 'data:pic']], 'a Stores card its material\'s picture');
    setProfessionsPages(null);
  });
});

test('MENU-ORDER the rest: the Vendor page\'s pieces and the Market\'s crafted pieces pictured; the Reforge\'s pages, the shipmaster\'s, the yard\'s and a merchant\'s presses each their glyph; a Reforge row with no press of its own gives its name the room; a ship\'s picture her size (mutants: each dropped)', async () => {
  const PIC = { src: 'data:pic', w: 26, h: 26 };
  const imgs = (root) => { const out = []; const walk = (n) => { for (const c of n.children ?? []) { if (c.tagName === 'IMG') out.push(c); walk(c); } }; walk(root); return out; };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const el = (tag, cls, t) => { const n = document.createElement(tag); if (cls) n.className = cls; if (t != null) n.textContent = t; return n; };
  // THE VENDOR PAGE: my trader's piece, pictured
  resetVendorPage();
  const piece = { name: 'Dagger' };
  setVendorPage({ shown: () => true, mine: async () => ({ ok: true, data: { traders: [{ map: 1, id: 2 }], stock: [{ id: 's', item: piece, price: 9, vendor: { map: 1, id: 2 }, expiresAt: Date.now() / 1000 + 86400 }], sold: [], gold: 0 } }),
    search: async () => ({ ok: true, data: { rows: [] } }), regionHere: () => 0, regionNames: ['Here'], nameOf: (it) => it.name, townOf: () => 'Town', picture: (it) => (it === piece ? PIC : null) });
  let page = el('div');
  const redraw = () => { page = el('div'); drawVendorPage(page, () => {}, { el, divider: (w) => el('h3', null, w) }); };
  redraw(); await tick(); redraw();
  const vrow = find(page, '.vendor-row');
  assert.deepEqual(imgs(vrow.children[0]).map((i) => [i.className, i.attrs.src]), [['vendor-pic', 'data:pic']], 'the page\'s piece pictured');
  setVendorPage(null);
  // THE MARKET'S CRAFTED PIECES
  const crafted = { crafted: { rows: [{ id: 'P', kind: 'piece', piece: { quality: 1, maker: 'Ann', wear: 0, provenance: 'pv' }, price: 30, region: 17, road: { courier: 0, seconds: 0, road: 0 } }] } };
  const book = { state: { open: true, balance: 50, road: [], counts: {} }, pending: 0, cached: () => null, read: async (view) => ({ ok: true, data: crafted[view] ?? { rows: [] } }), settle: async () => ({ ok: true, settled: 0 }) };
  let root = null;
  const tab = createMarketTab({ book, stores: () => new Map(), region: 17, regionName: 'D', regionNameOf: () => 'W', hubs: {}, name: (k) => k, countName: (k) => k, pieces: () => [],
    take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'Steel Longsword', weavers: [], stock: async () => ({ ok: true }), piecePicture: (p) => (p.provenance === 'pv' ? PIC : null) },
  { busy: () => false, run: async (go) => go(), rerender: () => { root = tab.body(); }, nowS: () => 0, alive: () => true });
  await tab.open();
  root = tab.body();
  root.querySelectorAll('.market-view').find((b) => b.attrs['data-dficon'] === MARKET_VIEW_ICONS.crafted).onclick();
  await tick(); await tick();
  root = tab.body();
  assert.deepEqual(imgs(find(root, '.market-row').children[0]).map((i) => i.attrs.src), ['data:pic'], 'a crafted piece pictured');
  // THE REFORGE'S PAGES
  withDom((dom) => {   // the Reforge writes a dataset, which the chargen stand-in has not
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, { items: () => [], payer: () => ({ items: [], goldPieces: 0 }), gold: () => 0, picture: () => null, nameOf: () => '', reforge: () => ({ ok: false }), salvage: () => ({ ok: false }) });
    const tabs = host.querySelectorAll('.reforge-tab');
    assert.ok(tabs.length >= 2);
    assert.deepEqual(tabs.map((t) => t.attrs['data-dficon']), tabs.map((t) => REFORGE_PAGE_ICONS[t.dataset.page]), 'each page its glyph');
    view.unmount?.();
  });
  for (const id of Object.keys(REFORGE_PAGES)) assert.ok(DFICON_ROWS[REFORGE_PAGE_ICONS[id]], `a glyph for ${id}`);
  assert.match(REFORGE_CSS, /\.reforge-shell \.broker-offer:not\(\.codex-row\):not\(\.codex-set\):not\(\.codex-gilded\):not\(\.scry-row\):not\(:has\(> button\)\) \{ grid-template-columns: 48px minmax\(0, 1fr\) max-content; \}/);
  // THE SHIPMASTER'S SHIPS, THEIR SIZE
  const sizes = SHIPYARD_HULLS.map((h) => Number(new RegExp(`\\.dfyard-card\\[data-hull="${h}"\\] \\.dfyard-pic::before \\{ width: (\\d+)px`).exec(SHIPYARD_CSS)?.[1]));
  assert.deepEqual(sizes, [...sizes].sort((a, b) => a - b), 'each hull larger than the last the yard sells');
  assert.ok(sizes.every((n) => n > 0) && new Set(sizes).size === sizes.length);
  for (const icon of Object.values(SHIPYARD_TAB_ICONS)) assert.ok(DFICON_ROWS[icon]);
  // THE YARD'S PAGES
  const yard = el('div');
  const proto = Object.getPrototypeOf(yard);
  proto.removeAttribute ??= function removeAttribute(k) { delete this.attrs[k]; };
  mountNavalYardWindow(yard, { model: { name: 'Small Ship', uid: 42, offer: () => ({ rows: [], whole: 0, gold: 100 }), ship: () => ({ hull: 1, maxHull: 1, sail: 1, maxSail: 1, crew: 1, maxCrew: 1, barrels: 0 }) } });
  assert.deepEqual(find(yard, '.dfnaval-tabs').children.map((b) => b.attrs['data-dficon']), ['saw', 'anchor', 'treasure']);
  // A MERCHANT'S PRESSES
  const shop = el('div');
  mountEnhancedMerchantPanel(shop, { title: 'Repair Shop', buttons: ['Repair item', 'Talk', 'Sell', 'Exit', 'Something else'].map((label) => ({ label, onClick() {} })) });
  assert.deepEqual(shop.querySelectorAll('.tavern-act').map((b) => b.attrs['data-dficon'] ?? null), ['anvil', 'talk', 'treasure', 'back', null], 'each known press its glyph, an unknown one its word alone');
  for (const icon of Object.values(MERCHANT_ICONS)) assert.ok(DFICON_ROWS[icon]);
  // THE HOST HANDS THE PICTURES OVER (scenes/world.js): the Stores page's, the board's market and traders, a stall's, the Vendor page's
  const W = hostText('src/scenes/world.js');
  assert.match(W, /book: profBook, name: \(k\) => materialLabel\(k\), withdraw: [^\n]*\n\s*picture: \(k, wake\) => materialPicture\(k, \{ onReady: wake \}\),/, 'the Stores page');
  assert.match(W, /hubs: marketHubs, name: \(k\) => materialLabel\(k\), countName: materialCountLabel,\n\s*picture: \(k, wake\) => materialPicture\(k, \{ onReady: wake \}\), itemPicture: \(it, wake\) => itemPicture\(it, \{ onReady: wake \}\), piecePicture: marketPiecePicture,/, 'the market');
  assert.equal((W.match(/picture: \(it, wake\) => itemPicture\(it, \{ onReady: wake \}\),/g) ?? []).length, 3, 'the board\'s traders, a stall and the Vendor page');
  assert.match(W, /const marketPiecePicture = \(piece, wake\) => \{[^]*?return itemPicture\(_pieceItems\.get\(piece\.provenance\), \{ onReady: wake \}\);/, 'a crafted piece, minted once');
});

test('MENU-ORDER a refused press says why when pressed (Plain-Words law 5, A FINGER HAS NO HOVER): never disabled - it reads refused and keeps its title for the pointer, its name starting with the word it shows, and a press tells its whole reason and does nothing else, the keys left on it; every refusal the Reforge draws is one, and the Broker\'s Buy; both skins grey it at rest, under the pointer, held and focused (mutants: disabled still; no title; the reason untold; the name the word left out of; the focus dropped; the grey on one skin; the grey a selector with nothing in it)', () => {
  const attrs = {};
  let acted = 0, told = null, stopped = 0;
  const btn = { textContent: 'Need 5 more', setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k] ?? null, onclick: () => { acted++; } };
  attrs['aria-label'] = 'Ruhn\'s Regalia: Not enough Deadlands Embers';
  refusePress(btn, 'Not enough Deadlands Embers', (r) => { told = r; });
  assert.deepEqual(attrs, { 'aria-disabled': 'true', title: 'Not enough Deadlands Embers', 'aria-label': 'Need 5 more - Ruhn\'s Regalia: Not enough Deadlands Embers' }, 'refused to the eye and a screen reader, never `disabled`; its name the word it shows, then whose and why (AUDIT MENU-ORDER U15)');
  btn.onclick({ stopPropagation: () => { stopped++; } });
  assert.deepEqual([acted, told, stopped], [0, 'Not enough Deadlands Embers', 1], 'pressed: its reason told, its act never run, the row under it never picked');
  // AUDIT MENU-ORDER U4: a window that draws itself again on the word - the keys find the press again by its name
  const again = { getAttribute: (k) => (k === 'aria-label' ? attrs['aria-label'] : null), focus() { again.focused = true; }, focused: false };
  const doc = { activeElement: null };
  const win = { querySelectorAll: () => [again] };
  const pressed = { textContent: 'Worn', ownerDocument: doc, isConnected: true, closest: () => win, setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k] ?? null };
  attrs['aria-label'] = 'Worn - Ebony Mace: Take it off first';
  refusePress(pressed, 'Take it off first', () => { pressed.isConnected = false; });
  doc.activeElement = pressed;
  pressed.onclick({ stopPropagation() {} });
  assert.equal(again.focused, true, 'the keys on the press drawn in its place');
  const reforge = readFileSync('src/ui/reforgeWindow.js', 'utf8');
  assert.equal((reforge.match(/setAttribute\('disabled'/g) ?? []).length, 0, 'no press of the Reforge is disabled');
  assert.equal((reforge.match(/\) refusePress\(\w+, /g) ?? []).length, 10, 'its ten refusals: salvage, reforge, hone, imprint, extract, unset, set, scry, lift, imbue');   // LOOT-GATE: the Imbue
  const broker = readFileSync('src/ui/brokerWindow.js', 'utf8');
  assert.equal((broker.match(/\) refusePress\(\w+, /g) ?? []).length, 2, 'the Broker\'s Buy and an insignia\'s');
  const sel = 'body .broker-shell .broker-win .act[aria-disabled="true"]';
  for (const css of [BROKER_CSS, brokerSkinCss()]) {
    const at = css.indexOf(`${sel}, ${sel}:hover,\n${sel}:active, ${sel}:focus-visible {`);
    assert.ok(at >= 0, 'grey at rest, under the pointer, held and focused - on both skins, under the window\'s own frame so the kit\'s held and focused presses never outweigh it (AUDIT MENU-ORDER U2/U3)');
    const body = css.slice(css.indexOf('{', at), css.indexOf('}', at));
    for (const d of ['color: #9c937d', 'border-color: rgba(125,116,96,0.3)', 'background-color: rgba(12,14,18,0.6)', 'background-image: none', 'translate: none']) assert.ok(body.includes(d), `the grey's own ${d} (AUDIT MENU-ORDER U9)`);
    assert.ok(css.includes(`${sel}:focus-visible { outline: 2px solid #9c937d; outline-offset: 2px; }`), 'focused, a ring of its own grey');
  }
});

const at = (m, [x, y, z]) => [0, 1, 2].map((i) => m[i] * x + m[4 + i] * y + m[8 + i] * z + m[12 + i]);
test('MENU-ORDER a model\'s own picture in its tile: the catalogue\'s, a placed piece\'s and a built-in one\'s each ask the host for it and show it over the kind\'s glyph; the host draws each with the preview\'s own pass, a few a frame, in a square under the card, copies it out and hands it back - the model whole, turned and looked down on - and an ask made in another room\'s textures, or for a model that never came, gives none (mutants: the tile never asks; the pass drawn every ask at once; the square off the card; the copy from the wrong square; the camera level; another room\'s textures drawn)', async () => {
  // the panel: a model's tile asks as a flat's does, and wears what it is handed over its glyph
  const doc = fakeDoc();
  const asked = [];
  const panel = createDecorPanel({ doc, win: fakeWin(), onPlace() {}, thumbOf: async (e) => { asked.push(e.key); return `data:${e.key}`; } });
  const { entries } = panelRig();
  const models = entries.filter((e) => !e.flat && e.model != null);
  const base = [{ key: 'm0:41100', shape: 'm41100', name: 'Table', kind: 'furniture', model: 41100, flat: null, hidden: false, holds: false, dist: 1.4 }];
  const piece = { id: 'p1', model: models[0].model, paid: 120 };
  const view = { where: 'Your house', entries, progress: 1, ready: true, gold: 1000, count: 1, cap: 200, radiusOf: () => 0.5, priceOf: () => 75, placed: [{ piece, name: 'Bed', entry: models[0], holds: false }], own: [], base };
  panel.open(view);
  await settle();
  assert.ok(models.length > 0 && models.every((e) => asked.includes(e.key)), 'every model\'s tile asked for its picture');
  const pic = (r) => all(r, 'dfdecor-modelpic')[0];
  for (const r of rows(panel.root).filter((x) => models.some((e) => e.key === x.dataset.key))) {
    assert.equal(pic(r).getAttribute('src'), `data:${r.dataset.key}`);
    assert.ok(one(r, 'dfdecor-thumb').dataset.dficon, 'its kind\'s glyph under it, for the moment before it lands');
  }
  panel.showRoom('p1');
  await settle();
  assert.equal(pic(rows(panel.root)[0]).getAttribute('src'), `data:${models[0].key}`, 'a placed piece: its entry\'s picture');
  all(panel.root, 'dfdecor-chip').find((c) => String(c.textContent).startsWith('Built in')).fire('click');
  await settle();
  assert.equal(pic(rows(panel.root)[0]).getAttribute('src'), 'data:m41100', 'a built-in piece: its own');
  assert.ok(DECOR_CSS.includes('.dfdecor-thumb img.dfdecor-modelpic { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%;'), 'drawn over the glyph, over the whole tile (AUDIT MENU-ORDER U6: in its flow, the letters pushed it right and cut it)');
  assert.ok(DECOR_CSS.includes('.dfdecor-thumb img.dfdecor-modelpic:not([src]) { display: none; }'));
  // the camera: the box's middle at the middle, looked down on
  const cam = decorThumbCamera([-0.5, -0.1, -0.5, 0.5, 0.9, 0.5]);
  assert.ok(at(cam.model, [0, 0.4, 0]).every((v) => Math.abs(v) < 1e-6), 'the box\'s middle at the origin');
  const near = at(cam.view, at(cam.model, [0, 0.9, 0]))[2], mid = at(cam.view, [0, 0, 0])[2];
  assert.ok(mid < 0 && near > mid + 0.1, 'the top nearer the eye than the middle - looked down on');
  // the host: the preview's pass, a few a frame, in a square under the card, copied out
  const rig = toolRig();
  rig.frame();
  rig.tool.drawPreview('remap');
  rig.tool.openPanel();
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
  const root = rig.doc.body.children.find((c) => c.className === 'dfdecor');
  one(root, 'dfdecor-card').getBoundingClientRect = () => ({ left: 100, top: 50, width: 600, height: 350 });
  const copies = [];
  const make = rig.doc.createElement;
  rig.doc.createElement = (t) => {
    const n = make(t);
    if (t === 'canvas') { n.getContext = () => ({ drawImage: (...a) => copies.push(a) }); n.toDataURL = () => `data:model${copies.length}`; }
    return n;
  };
  const tiles = rows(root).filter((r) => pic(r));
  assert.ok(tiles.length > DECOR_THUMBS_A_FRAME, 'more models than a frame draws');
  assert.ok(tiles.every((r) => !pic(r).getAttribute('src')), 'none before the frame');
  rig.tool.drawPreview('remap');   // the frame asks the models up; they land after it
  await settle();
  assert.ok(tiles.every((r) => !pic(r).getAttribute('src')), 'none before its model has come');
  rig.draws.length = 0;
  rig.tool.drawPreview('remap');
  await settle();
  const passes = rig.draws.filter((d) => d.panel && d.panel.rect.w === DECOR_THUMB_PX);
  assert.equal(passes.length, DECOR_THUMBS_A_FRAME, 'a few a frame');
  assert.deepEqual(passes[0].panel.rect, { x: 724, y: 374, w: DECOR_THUMB_PX, h: DECOR_THUMB_PX }, 'a square of the canvas under the card\'s middle');
  assert.deepEqual(copies[0].slice(1), [724, 374, DECOR_THUMB_PX, DECOR_THUMB_PX, 0, 0, DECOR_THUMB_PX, DECOR_THUMB_PX], 'copied out of that square');
  assert.equal(rig.draws.filter((d) => d.gpu != null && d.remap === 'remap').length >= DECOR_THUMBS_A_FRAME, true, 'in the room\'s textures');
  assert.equal(tiles.filter((r) => String(pic(r).getAttribute('src') ?? '').startsWith('data:model')).length, DECOR_THUMBS_A_FRAME);
  for (let i = 0; i < 40; i++) { rig.tool.drawPreview('remap'); await settle(); }
  const shown = rows(root).filter((r) => pic(r));
  assert.ok(shown.every((r) => String(pic(r).getAttribute('src') ?? '').startsWith('data:model')), 'every tile in the end');
  // another room's textures: what was asked in this one is never drawn in them
  const other = toolRig({ now: () => 0 });
  other.frame();
  other.tool.drawPreview('remap');
  other.tool.openPanel();
  for (let i = 0; i < 6; i++) { other.frame({ overlayUp: true }); await settle(); }
  const oroot = other.doc.body.children.find((c) => c.className === 'dfdecor');
  one(oroot, 'dfdecor-card').getBoundingClientRect = () => ({ left: 100, top: 50, width: 600, height: 350 });
  other.draws.length = 0;
  other.tool.drawPreview('elsewhere');
  await settle();
  other.tool.drawPreview('elsewhere');
  await settle();
  assert.equal(other.draws.filter((d) => d.panel && d.panel.rect.w === DECOR_THUMB_PX).length, 0, 'none drawn in another room\'s textures');
  assert.ok(rows(oroot).filter((r) => pic(r)).every((r) => !pic(r).getAttribute('src')), 'the glyph stands');
  // a picture is its room's textures: the panel opened in another room asks again, and is drawn in those
  rig.tool.close();
  rig.tool.drawPreview('elsewhere');
  rig.tool.openPanel();
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
  assert.ok(rows(root).filter((r) => pic(r)).every((r) => !pic(r).getAttribute('src')), 'none kept from the last room\'s textures');
  rig.draws.length = 0;
  for (let i = 0; i < 3; i++) { rig.tool.drawPreview('elsewhere'); await settle(); }
  assert.ok(rig.draws.some((d) => d.gpu != null && d.remap === 'elsewhere') && rows(root).filter((r) => pic(r)).some((r) => pic(r).getAttribute('src')), 'drawn again in this one\'s');
  // a model that comes too late is given up on - the tile keeps its glyph and nothing is drawn after
  let t = 0;
  const lands = [];
  const slow = toolRig({ now: () => t, getGpuMesh: (id) => new Promise((r) => { lands.push(() => r({ gpu: id })); }) });
  const open = async (r, remap) => {
    r.frame();
    r.tool.drawPreview(remap);
    r.tool.openPanel();
    for (let i = 0; i < 6; i++) { r.frame({ overlayUp: true }); await settle(); }
    one(r.doc.body.children.find((c) => c.className === 'dfdecor'), 'dfdecor-card').getBoundingClientRect = () => ({ left: 100, top: 50, width: 600, height: 350 });
  };
  await open(slow, 'remap');
  slow.tool.drawPreview('remap');
  t = DECOR_THUMB_WAIT_MS + 1;
  slow.tool.drawPreview('remap');   // given up on
  for (const land of lands) land();
  await settle();
  slow.draws.length = 0;
  slow.tool.drawPreview('remap');
  await settle();
  assert.equal(slow.draws.filter((d) => d.panel && d.panel.rect.w === DECOR_THUMB_PX).length, 0, 'nothing drawn of a model given up on');
  // drawn in the host's law only once it answered (AUDIT 05b A5), as the preview is
  const table = new Map();
  let answer = null;
  const law = toolRig({ prepareModel: () => new Promise((r) => { answer = r; }) });
  await open(law, table);
  for (let i = 0; i < 3; i++) { law.tool.drawPreview(table); await settle(); }
  assert.equal(law.draws.filter((d) => d.panel && d.panel.rect.w === DECOR_THUMB_PX).length, 0, 'not before the law answered');
  answer?.();
  await settle();
  for (let i = 0; i < 3; i++) { law.tool.drawPreview(table); await settle(); }
  assert.ok(law.draws.filter((d) => d.panel && d.panel.rect.w === DECOR_THUMB_PX).length > 0, 'drawn once it did');
});

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
const standInPipeline = () => {
  const textureFiles = new Map();
  return {
    textureFiles, cpuModels: new Map(), gpuMeshes: new Map(),
    getTexture: async (a) => { if (!textureFiles.has(a)) textureFiles.set(a, { recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) }); return textureFiles.get(a); },
    uploadRecord() {},
  };
};
test('MENU-ORDER a ship\'s own picture on the shipmaster\'s card: her portrait boat is her as the world draws her (every mesh, at its own matrix), built once and never on the water; the host draws one a frame once she has come, in a box of the canvas under the window, and copies it out; once a hull for the session; a window that asks again moves a waiting ask under it; one never answered gives none, and is asked again (mutants: a part left out; the box off the window; every ask at once; asked anew each card; never given up)', async () => {
  // the pool's portrait: the same meshes and matrices its own draw gives a boat of the hull standing at the origin
  const made = [];
  const renderer = {
    createMesh: (m) => { const g = { model: m, bounds: [0, 1, 0, 2], subMeshes: m.subMeshes }; made.push(g); return g; },
    drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {}, destroyMesh() {},
  };
  const pool = createComeSailAwayPool({ renderer, pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(pool.portrait(2), null, 'nothing before the models are in');
  await pool.ensureModels();
  let her = null;
  for (let i = 0; i < 40 && !her; i++) { her = pool.portrait(2); await settle(); }
  assert.ok(her && her.parts.length > 3, 'her parts, once every one has come');
  assert.equal(pool.boats.length + pool.peerBoats.length + pool.seaBoats.length, 0, 'never on the water');
  assert.equal(pool.portrait(2).parts[0][1], her.parts[0][1], 'the same boat asked again - built once');
  const b = pool.spawnPeerNow(new Boat(2, 0));
  for (let i = 0; i < 3; i++) { pool.frame(1, { playerPosition: [0, 0, 0] }); await settle(); }
  const drawn = [];
  pool.draw({ ...renderer, drawMesh: (g, m) => drawn.push([g, Array.from(m)]) });
  const key = ([g, m]) => `${g.model?.subMeshes?.map((x) => `${x.textureArchive}.${x.textureRecord}`).join(',')}@${Array.from(m).map((v) => v.toFixed(3)).join(',')}`;
  const keys = (list) => list.map(key).sort();
  assert.ok(drawn.length > 3);
  assert.deepEqual(keys(her.parts), keys(drawn), 'her as the world draws her: every mesh - her sails baked too - at its matrix');
  pool.remove(b);
  const [x0, y0, z0, x1, y1, z1] = her.box;
  assert.ok(x1 > x0 && y1 > y0 && z1 > z0 && z1 - z0 > 4, 'her box, her length in it');
  // the camera: her box's middle at the middle of the frame, seen from above
  const cam = shipPortraitCamera(her.box);
  const mid = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const v = at(cam.view, mid);
  assert.ok(Math.abs(v[0]) < 1e-3 && Math.abs(v[1]) < 1e-3 && v[2] < 0, 'centred, in front');
  assert.ok(at(cam.view, [mid[0], y1, mid[2]])[2] > v[2] + 0.1, 'her masthead nearer the eye than her middle - looked down on');
  assert.ok(Math.abs(at(cam.view, [mid[0], mid[1], mid[2] + 10])[0] - v[0]) > 8, 'off her beam: her length across the picture, never end on');
  assert.ok(Math.abs(cam.proj[5] / cam.proj[0] + SHIP_PORTRAIT_W / SHIP_PORTRAIT_H) < 1e-4, 'the picture\'s own shape, mirrored as the world\'s lens is');
  // the host's turn: one a frame, under the window, copied out; once a hull
  const calls = [];
  const fakeR = { panelFrame: (o, body) => { calls.push({ panel: o }); body(); }, drawMesh: (g, m) => calls.push({ g, m }), setFog() {}, setLighting() {} };
  const canvas = { width: 1600, height: 900, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }) };
  const copies = [];
  const doc = { createElement: () => ({ getContext: () => ({ drawImage: (...a) => copies.push(a) }), toDataURL: () => `data:ship${copies.length}` }) };
  let t = 0;
  let ready = false;
  const parts = [[{ id: 'hull' }, new Float32Array(16)], [{ id: 'mast' }, new Float32Array(16)]];
  const sp = createShipPortraits({ renderer: fakeR, canvas, doc, now: () => t, portrait: (hull) => (ready ? { parts, box: [-1, 0, -4, 1, 6, 4], hull } : null) });
  const box = { left: 150, top: 40, width: 500, height: 370 };
  const p0 = sp.picture(0, () => box), p2 = sp.picture(2, () => box);
  assert.equal(sp.picture(0, () => box), p0, 'once a hull');
  assert.equal(sp.draw(), 0, 'nothing before she has come');
  ready = true;
  assert.equal(sp.draw(), SHIP_PORTRAITS_A_FRAME, 'one a frame');
  const panel = calls.find((c) => c.panel).panel;
  assert.deepEqual(panel.rect, canvasBoxUnder(canvas, box, SHIP_PORTRAIT_W, SHIP_PORTRAIT_H));
  assert.deepEqual(panel.rect, { x: 560, y: 330, w: SHIP_PORTRAIT_W, h: SHIP_PORTRAIT_H }, 'under the window\'s middle, in the canvas\'s pixels');
  assert.deepEqual(panel.clear, [...PANEL_PICTURE_CLEAR]);
  assert.deepEqual(calls.filter((c) => c.g).map((c) => c.g.id), ['hull', 'mast'], 'every part');
  assert.deepEqual(copies[0].slice(1), [560, 330, SHIP_PORTRAIT_W, SHIP_PORTRAIT_H, 0, 0, SHIP_PORTRAIT_W, SHIP_PORTRAIT_H], 'copied out of that box');
  assert.equal(await p0, 'data:ship1');
  sp.draw();
  assert.equal(await p2, 'data:ship2');
  assert.equal(sp.picture(2, () => box), p2, 'kept for the session');
  // a window that asks again: the waiting ask is drawn under the new one
  ready = false;
  const p3 = sp.picture(3, () => null);
  sp.picture(3, () => ({ left: 0, top: 0, width: 400, height: 300 }));
  ready = true;
  calls.length = 0;
  sp.draw();
  assert.deepEqual(calls.find((c) => c.panel).panel.rect, { x: 160, y: 180, w: SHIP_PORTRAIT_W, h: SHIP_PORTRAIT_H }, 'under the window that asked last');
  assert.ok(await p3);
  // never answered: none, and asked again by the next window
  ready = false;
  const p4 = sp.picture(4, () => box);
  t = SHIP_PORTRAIT_WAIT_MS + 1;
  sp.draw();
  assert.equal(await p4, null, 'given up on');
  await settle();
  assert.notEqual(sp.picture(4, () => box), p4, 'asked again');
  assert.equal(sp.pending(), 1);
  // the world's hand-over: the pool's portrait, the window's ask, the frame's turn after the decorator's preview
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const shipPortraits = createShipPortraits\(\{ renderer, canvas, doc: [^\n]*portrait: \(hull\) => \(csaOn\(\) \? csa\.portrait\(hull\) : null\) \}\);/);
  assert.match(w, /picture: \(hull, where\) => shipPortraits\.picture\(hull, where\),/);
  assert.match(w, /yards\?\.drawPreview\(\);[^\n]*\n    shipPortraits\.draw\(\);/);
  // her picture at her size on her card, as her glyph was
  const widths = SHIPYARD_HULLS.map((h) => Number(new RegExp(`\\.dfyard-card\\[data-hull="${h}"\\] \\.dfyard-shipimg \\{ width: (\\d+)%`).exec(SHIPYARD_CSS)?.[1] ?? 100));
  assert.deepEqual(widths, [50, 62, 76, 88, 100], 'a rowboat\'s the card\'s half, a galley\'s its width');
  assert.ok(SHIPYARD_CSS.includes('.dfyard-pic:has(> .dfyard-shipimg[src])::before { display: none; }'), 'her glyph gives way to her');
});

/** The EV6 recording GL (test/ui/automap/roadc_panelframe.test.js's), for the panel bracket's own calls. */
function recordingRenderer(log) {
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (k === 'drawingBufferWidth') return 640;
      if (k === 'drawingBufferHeight') return 400;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
  const r = new Renderer({ getContext: () => stub, clientWidth: 640, clientHeight: 400, width: 640, height: 400 });
  log.length = 0;
  return r;
}
test('AUDIT MENU-ORDER the passes: a panel\'s ground is its whole rect (R1); the pictures drawn after the frame is shown and its shots taken (R2); encoded later by the browser (R3); a tile\'s model held by the panel alone and let go with it (R4); lit by their own studio, none of the world\'s lights (R6); an ask ages only while the panel stands (C1); a room entered again knows its pictures by its textures\' law (C3) (mutants: each undone)', async () => {
  // R1: the clear quad drawn under the whole-canvas viewport (its rect is the canvas's pixels), the panel's set after it
  const log = [];
  const r = recordingRenderer(log);
  r.beginPanelFrame(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), new Float32Array([0, 1, 0]), { x: 10, y: 20, w: 300, h: 160 }, [0.1, 0.1, 0.1, 1]);
  const quad = log.findIndex((c) => c[0] === 'drawElements');
  assert.ok(quad > 0, 'the clear drawn');
  const vpBefore = log.slice(0, quad).filter((c) => c[0] === 'viewport').at(-1);
  assert.deepEqual(vpBefore.slice(1), [0, 0, 640, 400], 'under the whole canvas - never squeezed into the rect');
  assert.deepEqual(log.filter((c) => c[0] === 'viewport').at(-1).slice(1), [10, 400 - 180, 300, 160], 'the panel\'s viewport after it');
  r.endPanelFrame();
  // R2: the world's frame shows itself, takes its shots, then draws the panels
  const w = hostText('src/scenes/world.js');
  assert.match(w, /deliverOwedShots\(\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*yards\?\.drawPreview\(\);[^\n]*\n\s*shipPortraits\.draw\(\);/, 'after the frame and its shots');
  assert.equal(w.split('yards?.drawPreview();').length, 2, 'and nowhere amid the world pass');
  assert.equal(w.split('shipPortraits.draw();').length, 2);
  // R3 + R6: the studio, and the browser's encoding
  const calls = [];
  const rec = new Proxy({}, { get: (o, k) => (k === 'panelFrame' ? (opts, body) => { opts.setup(); body(); } : (...a) => calls.push([k, ...a])) });
  panelPictureStudio(rec);
  const named = (k) => calls.find((c) => c[0] === k);
  assert.deepEqual(named('setFog').slice(1), ['off']);
  assert.equal(named('setMoonlight')[1], null);
  assert.equal(named('setThirdLight')[1], null);
  assert.equal(named('setPointLights')[1].length, 0, 'no lanterns');
  assert.deepEqual([...named('setIndirectLight')[1]], [0, 0, 0]);
  assert.deepEqual([...named('setWindowEmission')[1]], [0, 0, 0]);
  assert.equal(named('setCloudShadow')[1], null);
  let encodedNow = 0;
  const doc = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => { encodedNow++; return 'data:x'; }, toBlob: (cb) => setTimeout(() => cb(new Blob(['png'])), 0) }) };
  const url = await panelPicture({ renderer: rec, canvas: {}, doc, rect: { x: 0, y: 0, w: 16, h: 16 }, proj: null, view: null, body() {} });
  assert.match(String(url), /^blob:/, 'a blob\'s URL, encoded by the browser later');
  assert.equal(encodedNow, 0, 'never toDataURL, which waits on the GPU');
  // R4 + C1: the panel's own hold; an ask that waits out a closed panel is drawn when it opens again
  let t = 0;
  const pinned = [], held = [];
  let released = 0;
  const rig = toolRig({ now: () => t, getGpuMesh: async (id) => { pinned.push(id); return { gpu: id }; }, thumbHold: () => ({ getGpuMesh: async (id) => { held.push(id); return { gpu: id }; }, release: () => { released++; } }) });
  rig.frame();
  rig.tool.drawPreview('remap');
  rig.tool.openPanel();
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
  const root = rig.doc.body.children.find((c) => c.className === 'dfdecor');
  one(root, 'dfdecor-card').getBoundingClientRect = () => ({ left: 100, top: 50, width: 600, height: 350 });
  const make = rig.doc.createElement;
  rig.doc.createElement = (tag) => { const n = make(tag); if (tag === 'canvas') { n.getContext = () => ({ drawImage() {} }); n.toDataURL = () => 'data:model'; } return n; };
  const pic = (row) => all(row, 'dfdecor-modelpic')[0];
  const models = () => rows(root).filter((row) => pic(row));
  rig.tool.close();   // the panel down at once, every ask pending
  assert.equal(released, 0, 'nothing held yet');
  t = DECOR_THUMB_WAIT_MS * 3;
  for (let i = 0; i < 3; i++) { rig.tool.drawPreview('remap'); await settle(); }
  rig.tool.openPanel();
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
  one(root, 'dfdecor-card').getBoundingClientRect = () => ({ left: 100, top: 50, width: 600, height: 350 });
  for (let i = 0; i < 12; i++) { rig.tool.drawPreview('remap'); await settle(); }
  assert.ok(models().length > 0 && models().every((row) => pic(row).getAttribute('src') === 'data:model'), 'C1: every picture drawn - the closed panel aged none');
  assert.ok(held.length > 0 && held.every((id) => !pinned.includes(id)), 'R4: the tiles\' models through the panel\'s hold, never the pinned door');
  rig.tool.close();
  rig.tool.drawPreview('remap');
  assert.equal(released, 1, 'let go with the panel');
  // C3: two tables built in one law are one: a house entered again knows its pictures
  const a = markRemapLaw(new Map(), 'climate:1.0'), b = markRemapLaw(new Map(), 'climate:1.0');
  assert.equal(remapLawOf(a), 'climate:1.0');
  assert.equal(remapLawOf(new Map()), null);
  const room = toolRig();
  room.frame();
  room.tool.drawPreview(a);
  room.tool.openPanel();
  for (let i = 0; i < 6; i++) { room.frame({ overlayUp: true }); await settle(); }
  const rroot = room.doc.body.children.find((c) => c.className === 'dfdecor');
  one(rroot, 'dfdecor-card').getBoundingClientRect = () => ({ left: 100, top: 50, width: 600, height: 350 });
  const rmake = room.doc.createElement;
  room.doc.createElement = (tag) => { const n = rmake(tag); if (tag === 'canvas') { n.getContext = () => ({ drawImage() {} }); n.toDataURL = () => 'data:roomA'; } return n; };
  for (let i = 0; i < 12; i++) { room.tool.drawPreview(a); await settle(); }
  room.tool.close();
  room.tool.drawPreview(b);   // the same house, its table built anew
  room.draws.length = 0;
  room.tool.openPanel();
  for (let i = 0; i < 6; i++) { room.frame({ overlayUp: true }); await settle(); }
  const rpics = rows(rroot).filter((row) => pic(row));
  assert.ok(rpics.length > 0 && rpics.every((row) => pic(row).getAttribute('src') === 'data:roomA'), 'its pictures known at once');
  room.tool.drawPreview(b);
  assert.equal(room.draws.filter((d) => d.panel && d.panel.rect.w === DECOR_THUMB_PX).length, 0, 'none drawn again');
  assert.match(readFileSync('src/scenes/interiorContext.js', 'utf8'), /\n  markRemapLaw\(texRemap, `climate:\$\{climateBase\}\.\$\{season\}`\);/, 'a building\'s table named by its climate and season');
  assert.match(w, /const texRemap = markRemapLaw\(new Map\(\), `climate:\$\{townClimateBase\}\.\$\{pixelSeason\}`\);/, 'a town\'s (a yard\'s) the same (PIN MOVED, PRECIP4: the pixel\'s own season)');
  assert.match(readFileSync('src/scenes/worldModes.js', 'utf8'), /thumbHold: \(\) => placeHoldOf\('decor-thumbs', 'interior'\),/, 'the room\'s decorator asks through a hold of its own');
  assert.match(readFileSync('src/scenes/homeYards.js', 'utf8'), /\.\.\.\(deps\.meshes\.hold \? \{ thumbHold: \(\) => deps\.meshes\.hold\('decor-thumbs', 'yard'\) \} : \{\}\),/, 'and a yard\'s');
});

test('AUDIT MENU-ORDER the screens: a station the provider has here reads Here, its words alone or not (C2); one wake for every vendor row (C5); a short screen folds the decorator\'s filters (U1), a phone\'s views wrap (U11); the counter\'s title its own row on a phone (U7); a finger\'s press 44px (U14); the glyphs on every enhanced page (U8); the folds said (U15); the CSS the pins never held (U13) (mutants: each undone)', () => {
  // C2 + U15: the temper at a forge with nothing to temper is worked here; an away tile says whether its words are open
  withDom((dom) => {
    const tracks = new Map([['smithing', { profession: 'smithing', xp: xpForRank(10), rank: 10, specs: { 50: null, 100: null } }]]);
    const book = {
      state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: null }, stale: () => false, refresh: async () => ({ ok: true }),
      held: () => 0, store: (k) => ({ material: k, own: 0, bought: 0 }),
      track: (p) => tracks.get(trackOf(p)) ?? { profession: trackOf(p), xp: 0, rank: 0, specs: { 50: null, 100: null } }, materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0,
      choose: async () => ({ ok: true }),
    };
    setProfessionsPages({ book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), forge: () => ({ kind: 'shop', fee: 50 }), workbench: () => null,
      smelt: async () => ({ ok: true, text: '' }), craft: async () => ({ ok: true, text: '' }), stock: async () => ({ ok: true, text: '' }), heatBand: () => 1, planeBand: () => 1,
      temperable: () => [], temper: async () => ({ ok: true, text: '' }) });
    const el = (tag, cls, t) => { const n = document.createElement(tag); if (cls) n.className = cls; if (t != null) n.textContent = t; return n; };
    const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
    let root = null;
    const draw = () => { root = el('div'); drawStoresPage(root, draw, kit); };
    draw();
    const tile = (id) => root.querySelectorAll('.prof-stile').find((t) => t.attrs['data-station'] === id);
    assert.ok(tile('temper-anvil').className.includes('here'), 'C2: at the forge, the temper is here - nothing to temper or not');
    assert.equal(tile('temper-anvil').attrs['aria-expanded'], undefined, 'a tile worked here opens nothing');
    assert.equal(tile('workbench').attrs['aria-expanded'], 'false', 'U15: an away tile says its words are folded');
    tile('workbench').onclick();
    assert.equal(tile('workbench').attrs['aria-expanded'], 'true');
    setProfessionsPages(null);
  });
  // C5: the vendor board asks every row's picture with one wake
  const vsrc = readFileSync('src/ui/vendor/vendorTab.js', 'utf8');
  assert.match(vsrc, /const wake = \(\) => ui\.rerender\(\);/);
  assert.match(vsrc, /v\.picture\?\.\(row\.item, wake\)/, 'one wake, never a closure a row');
  // U1 + U11: the decorator on a short screen and a narrow one
  assert.match(DECOR_CSS, /@media \(max-height: 500px\) \{\n  \.dfdecor-ftoggle \{ display: inline-block; flex: none; \}\n  \.dfdecor-filters:not\(\[data-open="1"\]\) \.dfdecor-fline-more \{ display: none; \}/, 'U1: a landscape phone folds the filters');
  assert.ok(!/\.dfdecor-tabs, \.dfdecor-roomsbar \{ flex-wrap: nowrap/.test(DECOR_CSS) && DECOR_CSS.includes('.dfdecor-roomsbar { flex-wrap: nowrap; overflow-x: auto; }'), 'U11: the views wrap; the rooms scroll');
  // U7 + U14: the counter's header on a phone, and a finger's presses
  const E = ENHANCED_CSS;
  assert.ok(E.includes('.trade-shell .sb-top { grid-template-columns: 1fr auto; grid-template-areas: "who who" "view close"; row-gap: 8px; }'), 'U7: the title its own row');
  assert.ok(E.includes('@media (pointer: coarse) { .trade-shell .trade-view .act { min-height: 44px; } }'), 'U14: the switch a finger\'s press');
  assert.ok(PLUS_CSS.includes('@media (pointer: coarse) { .market-views .market-view { min-height: 44px; } }'), 'U14: the Market\'s views too');
  // U8: the glyphs on every page the enhanced sheet is laid on, the classic skin's windows among them
  assert.ok(E.includes(GLYPHS), 'U8: the glyph sheet in the base enhanced sheet');
  // U13: the CSS the pins never held
  assert.ok(SHIPYARD_CSS.includes('.dfyard-shipimg:not([src]) { display: none; }'), 'a picture not yet come takes no room');
  assert.ok(PLUS_CSS.includes('  .trade-shell .packtabs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }'), 'a phone\'s page tabs two by two');
  assert.ok(E.includes('.trade-shell .trade-detail-empty .meta { margin: 0; font-size: 13px; color: var(--dim); letter-spacing: 0.04em; }'), 'the empty strip\'s hint in FONT3\'s dim, at 13px');
  // U15: the decorator's filters say they are folded from the first
  const rig = panelRig();
  rig.panel.open(rig.view());
  assert.equal(one(rig.panel.root, 'dfdecor-ftoggle').getAttribute('aria-expanded'), 'false');
  return (async () => {
    // C4: a picture there is none of is never asked again, nor waited on, however often the list is drawn
    const asked = [];
    const panel = createDecorPanel({ doc: fakeDoc(), win: fakeWin(), onPlace() {}, thumbOf: async (e) => { asked.push(e.key); return null; } });
    const view = rig.view();
    panel.open(view);
    await settle();
    for (let i = 0; i < 3; i++) { panel.update({ ...view, gold: view.gold + i + 1 }); panel.select(view.entries[i % view.entries.length].key); await settle(); }
    const once = new Set(asked);
    assert.equal(asked.length, once.size, 'each asked once - none to be had is known');
  })();
});
