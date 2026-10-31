// @ts-check
// SHOP (2026-10-28, the owner: "A new glyph panel alongside the timer and mailbox that will be used for our monetization
// shop. This needs to be detailed and panel based when open showing the purchasable items organized in categories with a
// strict disclaimer that all proceeds go towards development costs"; bible/06-Systems/Shop.md): THE SHOP. A gem at the
// end of the pause face's row of marks (the hourglass, the envelope, the laurel) opens a window in the pause window's
// frame: the proceeds' disclaimer first, then a tab a category, and in each a panel a ware - seen live (the title on its
// flame, the glyph moving, the aura on a stand-in figure), its price, and Buy, which opens Stripe's page in a browser.
// What is held and what is on sale are the account read's (ui/accountFlow.js `shop`); a purchase lands on its own.
import { SHOP_WARES, SHOP_CATEGORIES, SHOP_CATEGORY_KIND, shopPriceText, shopWareById } from '../../net/shopLaw.js';
import { TERMS_URL } from '../../net/legalLaw.js';
import {
  titleBadge,
  paintTitle,
  glyphBadges,
  glyphSvgNode,
  TITLE_TEXT,
  AURA_TEXT,
  AURA_PAINT,
} from '../playerBadge.js';
import { GLYPH_LABEL } from './enhancedAccount.js';
import { t, intlLocale } from '../../systems/textManager.js';
import {
  armoryPieceOf,
  armoryKitPieces,
  armoryKitOf,
  armoryLineKit,
  armoryWarePieces,
  ARMORY_SETS,
} from '../../net/armoryLaw.js'; // ARMORY: the Aura Armory's pieces, sold in a section of their own
import { ARMORY_LOOK, ARMORY_SET_LOOK, armoryPieceName, armorySlotName } from '../armoryText.js';

/** Each category's tab, in the player's language. */
export const SHOP_CATEGORY_TEXT = Object.freeze({
  titles: () => t('shop.cat.titles', 'Titles'),
  glyphs: () => t('shop.cat.glyphs', 'Glyphs'),
  auras: () => t('shop.cat.auras', 'Auras'),
  armory: () => t('shop.cat.armory', 'Aura Armory'),
});
/** Each kind's word on its panel. */
const KIND_TEXT = Object.freeze({
  title: () => t('shop.kind.title', 'Title'),
  glyph: () => t('shop.kind.glyph', 'Glyph'),
  aura: () => t('shop.kind.aura', 'Aura'),
  armory: () => t('shop.kind.armory', 'Aura Armory'),
});
/** ARMORY: the line a set ware gives whole, or null for any other ware. */
const setOf = (/** @type {{ kind: string, key: string }} */ w) =>
  w.kind === 'armory' ? (ARMORY_SETS[/** @type {keyof typeof ARMORY_SETS} */ (w.key)] ?? null) : null;
/** A ware's kind as its panel says it - an armory piece's with its slot, a set's with its count. */
const kindText = (/** @type {{ kind: string, key: string }} */ w) =>
  w.kind === 'armory'
    ? `${KIND_TEXT.armory()} · ${setOf(w) ? t('shop.armory.setOf', 'a set of {n}', { n: armoryWarePieces(w.key).length }) : armorySlotName(armoryPieceOf(w.key)?.slot ?? '')}`
    : KIND_TEXT[/** @type {keyof typeof KIND_TEXT} */ (w.kind)]();
/** Each ware in a sentence: what it looks like. */
export const SHOP_LOOK = Object.freeze({
  'title:genesis': () =>
    t('shop.look.genesis', 'A title set on a plate of blue-violet fire that burns behind its letters, over your name.'),
  'glyph:origin': () =>
    t(
      'shop.look.origin',
      'A dragon coiled round on itself, biting its tail, a spark burning at its heart. Light runs round its scales.',
    ),
  'aura:eternal': () =>
    t(
      'shop.look.eternal',
      'A cape of blue-violet fire on your back. It flows as you move, and wisps of flame trail behind you.',
    ),
  // ARMORY: a piece's own words (ui/armoryText.js), one home for every face that says them
  ...Object.fromEntries(Object.entries({ ...ARMORY_LOOK, ...ARMORY_SET_LOOK }).map(([k, f]) => [`armory:${k}`, f])),
});
/** A ware's name, as every face says it (the title's and the aura's English, the glyph's label). */
export const shopWareName = (/** @type {{ kind: string, key: string }} */ w) =>
  (w.kind === 'title'
    ? TITLE_TEXT[/** @type {keyof typeof TITLE_TEXT} */ (w.key)]
    : w.kind === 'aura'
      ? AURA_TEXT[/** @type {keyof typeof AURA_TEXT} */ (w.key)]
      : w.kind === 'armory'
        ? armoryPieceName(w.key)
        : GLYPH_LABEL[/** @type {keyof typeof GLYPH_LABEL} */ (w.key)]) ?? w.key;

/** A WARE'S NAME IN ITS OWN PAINT, for a line that names it (the mailbox's receipt): a title on its flame, a glyph's
 *  drawing before its label, an aura in its title's paint. Null for an id that is no ware. */
export function shopWareTag(/** @type {Document} */ doc, /** @type {unknown} */ id) {
  const w = shopWareById(id);
  if (!w) return null;
  const tag = doc.createElement('span');
  tag.className = 'sh-waretag';
  const word = doc.createElement('span');
  word.textContent = shopWareName(w);
  if (w.kind === 'glyph') {
    const g = glyphBadges({ glyphs: [w.key] })[0];
    const art = g ? glyphSvgNode(doc, g, 'sh-waretag-glyph', 1.8) : null;
    if (art) tag.append(art);
  } else
    paintTitle(
      word,
      titleBadge({
        title:
          w.kind === 'title'
            ? w.key
            : AURA_PAINT[
                /** @type {keyof typeof AURA_PAINT} */ (
                  w.kind === 'armory' ? (armoryPieceOf(w.key)?.line ?? 'eternal') : w.key
                )
              ],
      }),
      w.kind === 'title',
    ); // ARMORY: a piece in its line's aura's paint
  tag.append(word);
  return tag;
}

/**
 * WHAT A WARE'S PANEL SAYS AND OFFERS, from the flow as it stands. Pure. `state`: 'held', 'buy' (a link to follow),
 * 'gone' (no longer sold), 'closed' (the shop takes no payments yet), 'guest', 'out' (nobody signed in), 'reading'.
 * @param {any} flow @param {{ id: string, kind: string, key: string }} ware
 */
export function shopWareState(flow, ware) {
  const row = flow?.shop?.wares?.find((/** @type {any} */ w) => w.id === ware.id) ?? null;
  if (row?.held) return { state: 'held', worn: shopWorn(flow, ware), buy: null };
  if (!flow || flow.stage === 'loading') return { state: 'reading', buy: null };
  if (flow.stage !== 'in') return { state: 'out', buy: null };
  if (!flow.account?.handle) return { state: 'guest', buy: null };
  if (!flow.shop) return { state: 'closed', buy: null };
  if (row && !row.sale) return { state: 'gone', buy: null };
  if (!flow.shop.on || !row?.buy) return { state: 'closed', buy: null };
  return { state: 'buy', buy: row.buy };
}
/** Whether a held ware is worn: the title, the aura, a glyph not taken off. Pure. */
export function shopWorn(/** @type {any} */ flow, /** @type {{ kind: string, key: string }} */ w) {
  const wd = flow?.wardrobe;
  if (!wd) return false;
  if (w.kind === 'glyph')
    return (
      Array.isArray(wd.glyphs) &&
      wd.glyphs.includes(w.key) &&
      !(Array.isArray(wd.glyphsOff) && wd.glyphsOff.includes(w.key))
    );
  if (w.kind === 'armory') {
    const kit = armoryKitPieces(wd.armory);
    return armoryWarePieces(w.key).every((k) => kit[armoryPieceOf(k)?.slot ?? ''] === k);
  } // ARMORY: worn in its slot - a set, every piece of it
  return wd[w.kind] === w.key;
}
/** The line under the panels: who a purchase is for, or why nothing can be bought. Pure. */
export function shopWhoText(/** @type {any} */ flow) {
  if (!flow || flow.stage === 'loading') return t('shop.who.reading', 'Reading your account...');
  if (flow.stage !== 'in') return t('shop.who.out', 'Sign in from your profile to buy.');
  if (!flow.account?.handle)
    return t('shop.who.guest', 'A guest account cannot buy. Add a username from your profile first.');
  if (!flow.shop?.on) return t('shop.who.closed', 'The shop does not take payments yet.');
  return t('shop.who.for', 'Purchases go to the account {name}, for every character on it.', {
    name: flow.account.handle,
  });
}

/** The gem: the button at the end of the row of marks. */
export function shopMark(/** @type {Document} */ doc, { onOpen, open = false }) {
  injectShopStyle(doc); // its place in the row is the sheet's - before the window was ever opened
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = 'px-shopmark';
  b.setAttribute('aria-label', t('shop.title', 'Shop'));
  b.setAttribute('aria-haspopup', 'dialog');
  b.setAttribute('aria-expanded', open ? 'true' : 'false');
  b.title = t('shop.title', 'Shop');
  const gem = doc.createElement('span');
  gem.className = 'px-shopgem';
  gem.setAttribute('aria-hidden', 'true');
  b.append(gem);
  b.addEventListener('click', () => onOpen());
  return b;
}

/**
 * THE WINDOW. `flow()` the visit's account flow (ui/accountFlow.js), read once when first asked; `keep` the caller's record
 * of the tab open (`keep.cat`), so a face rebuilt around it reopens there. `focus` - just opened: the focus goes in.
 * Answers { root, stop, draw, close }: `draw` updates it in place (the flow's every change); `stop` lets the previews go.
 * `preview(canvas, aura, kit)` starts an aura's stage (render/auraPreview.js) or an armory piece's (`kit`), or null.
 * @param {Document} doc
 * @param {{ flow: () => any, onClose: () => void, keep?: { cat?: string }, focus?: boolean, preview?: (canvas: HTMLCanvasElement, aura: string|null, kit?: string|null) => Promise<{ stop: () => void }|null> }} o
 */
export function shopWindow(doc, { flow, onClose, keep = {}, focus = true, preview = loadAuraPreview }) {
  injectShopStyle(doc);
  const el = (/** @type {string} */ tag, /** @type {string|null} */ cls, /** @type {string|null} */ text = null) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (/** @type {string} */ cls, /** @type {string} */ text, /** @type {() => void} */ fn) => {
    const b = /** @type {HTMLButtonElement} */ (el('button', `act ${cls}`, text));
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  };
  const win = el('div', 'px-win px-shopwin');
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'true');
  win.setAttribute('aria-labelledby', 'sh-title');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', 'px-gem px-corner px-' + c));
  const body = el('div', 'px-body');
  const head = el('div', 'sh-head');
  const title = el('h3', 'sh-title', t('shop.title', 'Shop'));
  title.id = 'sh-title';
  const phase = el('span', 'sh-phase', t('shop.phase', 'Pre-alpha'));
  const close = button('sh-close', t('shop.close', 'Close'), () => onClose());
  head.append(title, phase, close);
  // THE DISCLAIMER, first and whole, before any ware - the owner's "strict disclaimer"
  const proceeds = el('aside', 'sh-proceeds');
  proceeds.setAttribute('role', 'note');
  proceeds.append(
    el('strong', 'sh-proceeds-main', t('shop.proceeds', 'All proceeds go to the costs of developing DFO Online.')),
    el('span', 'sh-proceeds-sub', t('shop.cosmetic', 'Every item is cosmetic. It gives no power in the game.')),
  ); // net/shopLaw.js SHOP_PROCEEDS, SHOP_COSMETIC - a pin holds them equal
  const tabs = el('div', 'sh-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', t('shop.cats', 'Categories'));
  // the strip's keys (the WAI-ARIA tabs pattern): an arrow steps to the next category, Home and End to the first and last
  tabs.addEventListener?.('keydown', (/** @type {KeyboardEvent} */ e) => {
    const i = SHOP_CATEGORIES.indexOf(cat),
      n = SHOP_CATEGORIES.length;
    const to =
      e.key === 'ArrowRight'
        ? (i + 1) % n
        : e.key === 'ArrowLeft'
          ? (i + n - 1) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : -1;
    if (to < 0) return;
    e.preventDefault?.();
    e.stopPropagation?.();
    pick(SHOP_CATEGORIES[to]);
  });
  const panels = el('div', 'sh-panels');
  panels.setAttribute('role', 'tabpanel');
  const say = el('p', 'sh-say');
  say.setAttribute('role', 'status');
  const foot = el('div', 'sh-foot');
  const who = el('span', 'sh-who');
  const terms = /** @type {HTMLAnchorElement} */ (el('a', 'sh-terms', t('shop.terms', 'Terms of Service')));
  terms.href = TERMS_URL;
  terms.target = '_blank';
  terms.rel = 'noopener';
  const paid = el(
    'span',
    'sh-paid',
    t(
      'shop.stripe',
      'Payments are taken by Stripe. Prices are in US dollars, and Stripe can show your own currency and ways to pay. No card details reach the game.',
    ),
  );
  foot.append(who, paid, terms);
  body.append(head, proceeds, tabs, panels, say, foot);
  win.append(body);

  let cat = SHOP_CATEGORIES.includes(/** @type {any} */ (keep.cat))
    ? /** @type {string} */ (keep.cat)
    : SHOP_CATEGORIES[0];
  /** @type {Array<{ stop: () => void }>} the panels' live previews, let go when the panels are drawn again */
  let live = [];
  let liveGen = 0; // a preview that lands after its panels were drawn again (or the window went) is let go at once
  /** @type {Map<string, any>} each drawn panel's parts, by ware */
  let drawn = new Map();
  /** @type {Map<string, HTMLButtonElement>} */
  const tabOf = new Map();
  /** @type {HTMLElement[]} the name each picture is shown beside - the account's, once it is read */
  let names = [];
  const nameText = () => f()?.account?.handle || t('shop.yourName', 'Your Name');
  const f = () => flow();

  const stopLive = () => {
    for (const p of live) p.stop();
    live = [];
    liveGen++;
  };
  /** A ware's picture, live: the title on its flame over a name, the glyph large and beside a name, the aura on its stage. */
  const stageOf = (/** @type {any} */ w) => {
    const stage = el('div', 'sh-stage sh-stage-' + w.kind);
    const nameEl = () => {
      const n = el('div', 'sh-tagname', nameText());
      names.push(n);
      return n;
    };
    if (w.kind === 'title') {
      const big = paintTitle(el('div', 'sh-bigtitle', shopWareName(w)), titleBadge({ title: w.key }));
      const tag = el('div', 'sh-nametag');
      tag.append(paintTitle(el('div', 'sh-tagtitle', shopWareName(w)), titleBadge({ title: w.key })), nameEl());
      stage.append(big, tag);
    } else if (w.kind === 'glyph') {
      const g = glyphBadges({ glyphs: [w.key] })[0];
      const art = g ? glyphSvgNode(doc, g, 'sh-bigglyph', 1.8) : null;
      const tag = el('div', 'sh-nametag sh-nameline');
      tag.append(nameEl());
      const small = g ? glyphSvgNode(doc, g, 'sh-smallglyph', 1.8) : null;
      if (small) tag.append(small);
      if (art) stage.append(art);
      stage.append(tag);
    } else {
      const canvas = /** @type {HTMLCanvasElement} */ (el('canvas', 'sh-auracanvas'));
      canvas.setAttribute('aria-hidden', 'true');
      stage.append(canvas);
      const gen = liveGen;
      const armory = w.kind === 'armory'; // ARMORY: a piece on the stand-in, worn alone
      globalThis.requestAnimationFrame?.(() => {
        // once the canvas has its size in the page
        if (!canvas.isConnected || gen !== liveGen) return;
        preview(canvas, armory ? null : w.key, armory ? armoryKitOf(armoryWarePieces(w.key)) : null)
          .catch(() => null)
          .then((p) => {
            if (p && gen === liveGen) {
              live.push(p);
              return;
            }
            p?.stop();
            if (!p && gen === liveGen)
              stage.append(
                el(
                  'p',
                  'sh-nogl',
                  armory
                    ? t('shop.noPreviewArmory', 'This device cannot show the piece here.')
                    : t('shop.noPreview', 'This device cannot show the aura here.'),
                ),
              );
          });
      });
    }
    return stage;
  };
  const buildPanels = () => {
    stopLive();
    drawn = new Map();
    names = [];
    panels.textContent = '';
    panels.setAttribute('aria-labelledby', `sh-tab-${cat}`);
    const kind = SHOP_CATEGORY_KIND[/** @type {keyof typeof SHOP_CATEGORY_KIND} */ (cat)];
    for (const w of SHOP_WARES.filter((x) => x.kind === kind)) {
      const panel = el('article', 'sh-panel');
      panel.setAttribute('data-ware', w.id);
      const info = el('div', 'sh-info');
      const nameline = el('div', 'sh-nameline');
      nameline.append(el('h4', 'sh-name', shopWareName(w)), el('span', 'sh-kind', kindText(w)));
      const look = el('p', 'sh-look', SHOP_LOOK[/** @type {keyof typeof SHOP_LOOK} */ (w.id)]?.() ?? '');
      const tags = el('ul', 'sh-tags');
      tags.append(
        el('li', 'sh-tag sh-tag-pre', t('shop.tag.preAlpha', 'Pre-alpha only')),
        el('li', 'sh-tag', t('shop.tag.account', 'Every character on your account')),
      );
      const buyrow = el('div', 'sh-buyrow');
      const price = el('span', 'sh-price', shopPriceText(w.cents, intlLocale()));
      const state = el('span', 'sh-state');
      buyrow.append(price, state);
      info.append(nameline, look, tags, buyrow);
      panel.append(stageOf(w), info);
      panels.append(panel);
      drawn.set(w.id, { buyrow, state, act: /** @type {any} */ (null), actKey: '' });
    }
  };
  const buildTabs = () => {
    tabs.textContent = '';
    tabOf.clear();
    for (const c of SHOP_CATEGORIES) {
      const kind = SHOP_CATEGORY_KIND[/** @type {keyof typeof SHOP_CATEGORY_KIND} */ (c)];
      const n = SHOP_WARES.filter((w) => w.kind === kind).length;
      const tb = button('sh-tab', '', () => pick(c));
      tb.id = `sh-tab-${c}`;
      tb.setAttribute('role', 'tab');
      tb.append(
        el('span', 'sh-tabname', SHOP_CATEGORY_TEXT[/** @type {keyof typeof SHOP_CATEGORY_TEXT} */ (c)]()),
        el('span', 'sh-tabcount', String(n)),
      );
      tabs.append(tb);
      tabOf.set(c, tb);
    }
  };
  const pick = (/** @type {string} */ c) => {
    if (c === cat) return;
    cat = c;
    keep.cat = c;
    buildPanels();
    draw();
    tabOf.get(c)?.focus?.();
  };
  /** A held ware's press: wear it, or take it off (a glyph shown or hidden) - the flow's own, as the account card's. */
  const wear = (/** @type {any} */ w) => {
    const fl = f();
    if (!fl || fl.busy) return;
    if (w.kind === 'title') fl.equip?.(w.key);
    else if (w.kind === 'aura') fl.wearAura?.(w.key);
    else if (w.kind === 'armory' && setOf(w))
      fl.wearArmoryKit?.(shopWorn(fl, w) ? null : armoryLineKit(setOf(w))); // ARMORY: a set, all its pieces at once
    else if (w.kind === 'armory')
      fl.wearArmory?.(armoryPieceOf(w.key)?.slot, w.key); // ARMORY: in its slot
    else fl.toggleGlyph?.(w.key);
  };
  const actFor = (/** @type {any} */ w, /** @type {any} */ st) => {
    if (st.state === 'held') {
      const words =
        w.kind === 'glyph'
          ? st.worn
            ? t('shop.hide', 'Hide')
            : t('shop.show', 'Show')
          : st.worn
            ? t('shop.takeOff', 'Take off')
            : t('shop.wear', 'Wear');
      const b = button('sh-wear', words, () => wear(w));
      if (f()?.busy) b.setAttribute('aria-disabled', 'true');
      return b;
    }
    if (st.state === 'buy') {
      const a = /** @type {HTMLAnchorElement} */ (el('a', 'act sh-buy', t('shop.buy', 'Buy')));
      a.href = st.buy;
      a.target = '_blank';
      a.rel = 'noopener';
      a.setAttribute(
        'aria-label',
        t('shop.buyLabel', 'Buy {name} for {price}', {
          name: shopWareName(w),
          price: shopPriceText(w.cents, intlLocale()),
        }),
      );
      a.addEventListener('click', () => f()?.shopOpened?.(w.id));
      return a;
    }
    return null;
  };
  const STATE_TEXT = Object.freeze({
    held: () => t('shop.state.held', 'Owned'),
    gone: () => t('shop.state.gone', 'No longer sold'),
    closed: () => t('shop.state.closed', 'Not on sale yet'),
    guest: () => t('shop.state.guest', 'Needs a username'),
    out: () => t('shop.state.out', 'Sign in to buy'),
    reading: () => '',
    buy: () => '',
  });
  const draw = () => {
    const fl = f();
    for (const w of SHOP_WARES) {
      const d = drawn.get(w.id);
      if (!d) continue;
      const st = shopWareState(fl, w);
      const words = STATE_TEXT[/** @type {keyof typeof STATE_TEXT} */ (st.state)]();
      if (d.state.textContent !== words) d.state.textContent = words;
      d.state.className = 'sh-state sh-state-' + st.state;
      const key = `${st.state}:${st.worn ? 1 : 0}:${st.buy ?? ''}:${fl?.busy ? 1 : 0}`;
      if (d.actKey !== key) {
        const had = d.act && doc.activeElement === d.act;
        d.act?.remove?.();
        d.act = actFor(w, st);
        d.actKey = key;
        if (d.act) {
          d.buyrow.append(d.act);
          if (had) d.act.focus?.({ preventScroll: true });
        }
      }
    }
    for (const [c, tb] of tabOf) {
      tb.setAttribute('aria-selected', c === cat ? 'true' : 'false');
      tb.tabIndex = c === cat ? 0 : -1;
      tb.classList.toggle('on', c === cat);
    }
    const shown = nameText();
    for (const n of names) if (n.textContent !== shown) n.textContent = shown;
    const whoText = shopWhoText(fl);
    if (who.textContent !== whoText) who.textContent = whoText;
    const line = fl?.error || fl?.note || '';
    if (say.textContent !== line) say.textContent = line;
    say.classList.toggle('bad', !!fl?.error);
  };

  buildTabs();
  buildPanels();
  draw();
  // BACK FROM THE BROWSER, the account is read again - a payment that landed shows here (the account card's way)
  const view = doc.defaultView;
  const onFocus = () => {
    const fl = f();
    if (win.isConnected && fl?.stage === 'in') Promise.resolve(fl.refresh?.()).catch(() => {});
  };
  view?.addEventListener?.('focus', onFocus);
  if (focus) globalThis.requestAnimationFrame?.(() => tabOf.get(cat)?.focus?.({ preventScroll: true }));
  return {
    root: win,
    draw,
    close,
    stop: () => {
      stopLive();
      view?.removeEventListener?.('focus', onFocus);
    },
  };
}

/** An aura's stage, its module loaded on the first ask - ARMORY: a weapon piece alone on the blade's (weapon glow law 7). */
export const loadAuraPreview = (
  /** @type {HTMLCanvasElement} */ canvas,
  /** @type {string|null} */ aura,
  /** @type {string|null} */ kit = null,
) =>
  (aura || !kit ? Promise.resolve(null) : import('../../systems/weaponGlow.js')).then((g) => {
    const look = g?.armoryWeaponStage(kit);
    if (g && look)
      return import('../../render/weaponPiecePreview.js').then((m) =>
        m.startWeaponPiecePreview(canvas, g.glowSpec(look, g.ARMORY_LEVEL)),
      );
    return import('../../render/auraPreview.js').then((m) => m.startAuraPreview(canvas, aura, { kit }));
  });

/** The gem, painted as the row's other marks are: twelve pixels, crisp - a cut stone in the Genesis fire's colours. */
const GEM_ROWS = Object.freeze([
  '...DDDDDD...',
  '..DLLHVVLD..',
  '.DLHHVVVVLD.',
  'DGGGGGGGGGGD',
  'DVLVVBVVBVLD',
  '.DVVBVVBVVD.',
  '..DVVBBVVD..',
  '...DVBBVD...',
  '....DVVD....',
  '.....DD.....',
]);
const GEM_INK = Object.freeze({ D: '#2a1580', L: '#d6b8ff', H: '#f4eeff', V: '#8f5bff', B: '#3f63ff', G: '#b593ff' });
const gemSvg = () => {
  const rects = [];
  GEM_ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const ink = /** @type {any} */ (GEM_INK)[ch];
      if (ink) rects.push(`<rect x='${x}' y='${y + 1}' width='1' height='1' fill='${ink.replace('#', '%23')}'/>`);
    }),
  );
  return `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' shape-rendering='crispEdges'>${rects.join('')}</svg>")`;
};

/** THE SHOP'S SHEET: the gem's place in the row of marks and the window's geometry and words. The window's frame, its
 *  buttons and its dim words are the enhanced kit's (.px-win, .act) - this writes what is the shop's own. */
export const SHOP_CSS = `
.px-shopmark { position: absolute; top: 12px; right: 480px; z-index: 4; display: flex; align-items: center;
  min-height: 44px; min-width: 44px; justify-content: center; padding: 0 6px; background: none; border: 0; cursor: pointer; }
.px-shopmark:focus-visible { outline: 2px solid #d6b8ff; outline-offset: 2px; }
.px-shopgem { display: block; width: 34px; height: 34px; image-rendering: pixelated; position: relative;
  filter: drop-shadow(2px 2px 0 rgba(0,0,0,0.8)) drop-shadow(0 0 5px rgba(143,91,255,0.55)); background: ${gemSvg()} center / contain no-repeat; }
.px-shopgem::after { content: ''; position: absolute; left: 7px; top: 7px; width: 6px; height: 6px; background: #f4eeff;
  clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); opacity: 0; animation: sh-glint 3.6s steps(6) infinite; }
@keyframes sh-glint { 0%, 70%, 100% { opacity: 0; transform: scale(.4); } 80% { opacity: 1; transform: scale(1); } 90% { opacity: .6; transform: scale(.7); } }
.px-shopmark:hover .px-shopgem, .px-shopmark:focus-visible .px-shopgem { transform: translateY(-2px); transition: transform 160ms steps(2); }
.px-win.px-shopwin { height: auto; max-height: min(760px, 90dvh); width: min(760px, 95vw); background: #0a0910; }
.px-win.px-shopwin .px-body { padding: 18px 22px 18px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.px-shopwin .sh-head { display: flex; align-items: center; gap: 12px; }
.px-shopwin .sh-title { margin: 0; font-size: 22px; letter-spacing: 0.18em; text-transform: uppercase; color: #efe8d6; }
.px-shopwin .sh-phase { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #d6b8ff; border: 1px solid rgba(143,91,255,0.7);
  padding: 2px 7px; margin-right: auto; }
.px-shopwin .sh-proceeds { display: flex; flex-direction: column; gap: 3px; padding: 10px 14px; border: 2px solid #c08a3e;
  background: linear-gradient(90deg, rgba(192,138,62,0.18), rgba(192,138,62,0.06)); }
.px-shopwin .sh-proceeds-main { font-size: 15px; color: #fff4e0; letter-spacing: 0.02em; }
.px-shopwin .sh-proceeds-sub { font-size: 12px; color: #e2dccd; }
.px-shopwin .sh-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.px-shopwin .sh-tab { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; }
.px-shopwin .sh-tab.on { color: #0a0910; background: #d6b8ff; border-color: #d6b8ff; }
.px-shopwin .sh-tabcount { font-variant-numeric: tabular-nums; font-size: 11px; opacity: 0.8; }
.px-shopwin .sh-panels { display: flex; flex-direction: column; gap: 12px; }
.px-shopwin .sh-panel { display: grid; grid-template-columns: minmax(240px, 1.1fr) 1fr; gap: 16px; padding: 12px;
  border: 1px solid rgba(143,91,255,0.45); background: linear-gradient(160deg, rgba(23,11,74,0.55), rgba(10,9,16,0.9)); }
.px-shopwin .sh-stage { position: relative; min-height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  background: radial-gradient(ellipse at 50% 60%, rgba(63,99,255,0.18), rgba(10,9,16,0) 70%), #08070d; border: 1px solid rgba(214,184,255,0.18); overflow: hidden; }
.px-shopwin .sh-bigtitle { font-size: 40px; letter-spacing: 0.06em; white-space: nowrap; }
.px-shopwin .sh-nametag { display: flex; flex-direction: column; align-items: center; gap: .18em; font-size: 15px; color: #e9e4d9;
  text-shadow: 0 1px 0 #000, 0 0 3px #000; }
.px-shopwin .sh-nametag.sh-nameline { flex-direction: row; gap: .35em; }
.px-shopwin .sh-tagtitle { font-size: .78em; letter-spacing: .04em; white-space: nowrap; }
.px-shopwin .sh-bigglyph { width: 140px; height: 140px; filter: drop-shadow(0 0 12px rgba(143,91,255,0.55)); }
.px-shopwin .sh-smallglyph { width: 15px; height: 15px; }
.px-shopwin .sh-auracanvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.px-shopwin .sh-stage-aura, .px-shopwin .sh-stage-armory { min-height: 300px; }
.px-shopwin .sh-nogl { color: var(--dim); font-size: 13px; padding: 0 16px; text-align: center; }
.px-shopwin .sh-info { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.px-shopwin .sh-nameline { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.px-shopwin .sh-name { margin: 0; font-size: 22px; color: #f4eeff; letter-spacing: 0.04em; }
.px-shopwin .sh-kind { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #b593ff; }
.px-shopwin .sh-look { margin: 0; font-size: 14px; line-height: 1.5; color: #e2dccd; }
.px-shopwin .sh-tags { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.px-shopwin .sh-tag { font-size: 11px; letter-spacing: 0.08em; padding: 3px 8px; color: #e2dccd; border: 1px solid rgba(226,220,205,0.35); }
.px-shopwin .sh-tag-pre { color: #d6b8ff; border-color: rgba(143,91,255,0.75); }
.px-shopwin .sh-buyrow { margin-top: auto; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.px-shopwin .sh-price { font-size: 24px; color: #fff4e0; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.px-shopwin .sh-state { font-size: 12px; color: var(--dim); }
.px-shopwin .sh-state-held { color: #9fe8b4; }
.px-shopwin .sh-buy, .px-shopwin .sh-wear { min-height: 44px; display: inline-flex; align-items: center; padding: 0 20px; text-decoration: none; }
.px-shopwin .sh-buy { color: #0a0910; background: #d6b8ff; border-color: #d6b8ff; font-size: 15px; letter-spacing: 0.1em; text-transform: uppercase; }
.px-shopwin .sh-buy:hover, .px-shopwin .sh-buy:focus-visible { background: #f4eeff; }
.px-shopwin .sh-wear[aria-disabled="true"] { opacity: 0.55; }
.px-shopwin .sh-say { margin: 0; min-height: 16px; font-size: 13px; color: #9fe8b4; }
.px-shopwin .sh-say.bad { color: #e8a49c; }
.px-shopwin .sh-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; font-size: 12px; color: var(--dim);
  border-top: 1px solid rgba(125,116,96,0.3); padding-top: 10px; }
.px-shopwin .sh-who { color: #e2dccd; flex: 1 1 100%; }
.sh-waretag { display: inline-flex; align-items: center; gap: .35em; }
.sh-waretag-glyph { width: 1.2em; height: 1.2em; }
.px-shopwin .sh-terms { color: #d6b8ff; }
@media (max-width: 640px) {
  .px-shopwin .sh-panel { grid-template-columns: 1fr; }
  .px-shopwin .sh-stage { min-height: 200px; }
  .px-shopwin .sh-stage-aura, .px-shopwin .sh-stage-armory { min-height: 260px; }
  .px-shopwin .sh-bigtitle { font-size: 30px; }
}
@media (prefers-reduced-motion: reduce) { .px-shopgem::after { animation: none; } }
:root[data-plus-theme="stone"] .px-shopwin { --dim: #e2dccd; text-shadow: 1px 1px 0 rgba(5,6,8,0.85); }
`;
export const SHOP_STYLE_ID = 'dagger-shop-style';
/** The sheet in the document, once (the Collections page's way). */
export function injectShopStyle(/** @type {any} */ doc) {
  if (!doc?.head || doc.getElementById?.(SHOP_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = SHOP_STYLE_ID;
  st.textContent = SHOP_CSS;
  doc.head.append(st);
}
