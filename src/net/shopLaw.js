// @ts-check
// SHOP (2026-10-28, bible/06-Systems/Shop.md; STOREFRONT 2026-10-29, Storefront.md): THE SHOP'S LAW, read by the account
// service (server-account/src/shop.js), the pause face's window (ui/enhanced/enhancedShop.js) and the Collections page. A
// ware is a cosmetic the ACCOUNT keeps, bought once: the service records the sale on the row, so what is held is read
// off the row at every ask (server-account/src/titles.js), and the relay sees it only in the signed token. AURUM-ONLY
// (2026-10-30, the owner: "nothing should cost money money anymore ... Aurem purchase itself should be the only thing"):
// every ware is bought with Aurum, and money buys the Aurum packs alone.
// Pure. Not a DFU member - Daggerfall Unity has no accounts. Ledger A (SHOP, STOREFRONT).
import { TITLES, AURAS, GLYPHS, ICONS } from './identityToken.js';
import { ARMORY_PIECES, ARMORY_NAME, ARMORY_SETS, armoryLinePieces } from './armoryLaw.js';   // ARMORY: the Aura Armory's shop pieces and its set - armoryLaw.js imports nothing
import { EFFECTS, effectOf } from './effectLaw.js';   // STOREFRONT: the kill effects, portal skins and mount looks - a leaf

/** The currency a pack is charged in, as Stripe spells it. */
export const SHOP_CURRENCY = 'usd';
/** STOREFRONT: the least a checkout may charge - Stripe's own floor for a dollar charge. */
export const SHOP_MIN_CENTS = 50;
/** How long Stripe's page stays up (ms): its own floor is thirty minutes, and a minute more covers the clocks' skew. */
export const SHOP_CHECKOUT_MS = 31 * 60_000;
/** The shop's sections, in the window's order (STOREFRONT: the sheet's rows; the titles and glyphs one section, the
 *  name visuals). AURUM (bible/06-Systems/Aurum.md): the profile icons, and the Aurum's packs last. PASS-PANELS: the
 *  Battle Pass a section of its own tracks, bought with Aurum - no ware of it is sold for money. */
export const SHOP_CATEGORIES = Object.freeze(['pass', 'kills', 'portals', 'mounts', 'names', 'icons', 'auras', 'armory', 'bundles', 'aurum']);
/** The section each kind of ware is sold in. */
export const SHOP_KIND_CATEGORY = Object.freeze({
  title: 'names', glyph: 'names', icon: 'icons', aura: 'auras', armory: 'armory', kill: 'kills', portal: 'portals', mount: 'mounts', bundle: 'bundles', aurum: 'aurum',
});
/** STOREFRONT: a ware's tier - the sheet's three columns. The pre-alpha wares have none (they carry their Pre-alpha mark). */
export const SHOP_TIERS = Object.freeze(['standard', 'premium', 'exclusive']);

/**
 * One ware. `price` its price in Aurum (a ware never sold alone: its worth in a bundle); an Aurum pack's `cents` its
 * price in US cents and `aurum` the Aurum it gives - a pack alone is sold for money (`cash`). `bit` its bit on
 * `players.shop_wares` (the first nine only, never renumbered: a stored bit is a sale) or 0 for one held by its id in
 * `players.shop_held`. `gives` what it holds for its holder; `alone` false for a bundle's alone.
 * @param {string} kind @param {string} key @param {number} price - Aurum, or a pack's US cents
 * @param {{ bit?: number, tier?: string|null, gives?: string[], alone?: boolean, preAlpha?: boolean, aurum?: number }} [o]
 */
const ware = (kind, key, price, { bit = 0, tier = null, gives = [], alone = true, preAlpha = false, aurum = 0 } = {}) => Object.freeze({
  id: `${kind}:${key}`, kind, key, category: SHOP_KIND_CATEGORY[/** @type {keyof typeof SHOP_KIND_CATEGORY} */ (kind)],
  price: kind === 'aurum' ? 0 : price, cents: kind === 'aurum' ? price : 0, bit, preAlpha, tier,
  gives: Object.freeze([...gives]), alone, cash: kind === 'aurum', aurum,
});
const icon = (/** @type {string} */ key, /** @type {number} */ price, /** @type {string} */ tier) => ware('icon', key, price, { tier });
const pre = (/** @type {number} */ bit) => ({ bit, preAlpha: true });
/** THE PRICE CAP (the owner, 2026-10-29: "the most expensive anything should be is $30"): no pack costs more, in US
 *  cents, and (AURUM-ONLY) no ware more Aurum than the cap at SHOP_AURUM_PER_DOLLAR; a pin holds every ware to it. */
export const SHOP_PRICE_CAP = 3000;
/** AURUM-ONLY (the owner chose "$1 = 100 Aurum"): a ware's Aurum price is its old dollar price at the smallest pack's
 *  rate, to the whole dollar - a bigger pack's bonus makes every ware cheaper bought in bulk. */
export const SHOP_AURUM_PER_DOLLAR = 100;
export const SHOP_AURUM_CAP = (SHOP_PRICE_CAP / 100) * SHOP_AURUM_PER_DOLLAR;
/** AURUM-ONLY: the least a giver's share may cost in Aurum, as SHOP_MIN_CENTS bounds a money charge. */
export const SHOP_MIN_PRICE = 50;
/** THE WARES, in the window's order within each section. The pre-alpha nine are the owner's (SHOP, ARMORY); the rest are
 *  the sheet's (STOREFRONT, Storefront.md sections 2-8). */
export const SHOP_WARES = Object.freeze([
  // Every price under SHOP_AURUM_CAP: the sheet's tiers kept (AUDIT-STOREFRONT II's dollar prices, each at
  // SHOP_AURUM_PER_DOLLAR). PASS-PANELS: the Folios' items are their own tracks' (battlePassLaw.js)
  ware('kill', 'ashen', 500, { tier: 'standard' }),
  ware('kill', 'voidrend', 1000, { tier: 'premium' }),
  ware('kill', 'pyre', 1500, { tier: 'exclusive' }),
  ware('portal', 'runic', 800, { tier: 'standard' }),
  ware('portal', 'daedric', 1300, { tier: 'premium' }),
  ware('portal', 'aetheric', 2000, { tier: 'exclusive' }),
  ware('mount', 'spectral', 1000, { tier: 'standard' }),
  ware('mount', 'dawnfire', 1500, { tier: 'premium' }),
  ware('mount', 'warhorse', 2500, { tier: 'exclusive' }),
  ware('title', 'genesis', 500, pre(1)),
  ware('glyph', 'origin', 200, pre(2)),
  ware('title', 'dawnbringer', 400, { tier: 'standard' }),
  ware('title', 'voidwalker', 700, { tier: 'premium' }),
  ware('title', 'eternalchampion', 1000, { tier: 'exclusive' }),
  ware('glyph', 'oblivion', 300, { alone: false }),
  ware('glyph', 'gatesigil', 300, { alone: false }),
  ware('aura', 'eternal', 2000, pre(4)),
  ware('aura', 'dominion', 1500, { alone: false }),
  // ARMORY (bible/04-Characters/Aura-Armory.md section 4): the Eternal line - the owner: "The store set should be $20" -
  // whole at 2,000 Aurum, and a piece a slot at 600; the Dagonfire line is the Sigil Broker's, never in the shop
  ware('armory', 'eternalset', 2000, { ...pre(256), gives: armoryLinePieces(ARMORY_SETS.eternalset).map((p) => `armory:${p.key}`) }),
  ware('armory', 'eternalhalo', 600, pre(8)),
  ware('armory', 'eternalsigil', 600, pre(16)),
  ware('armory', 'eternalarmlets', 600, pre(32)),
  ware('armory', 'eternalgreaves', 600, pre(64)),
  ware('armory', 'eternaledge', 600, pre(128)),
  ware('bundle', 'daedricchampion', 2800, { tier: 'exclusive', gives: ['aura:dominion', 'kill:pyre', 'title:eternalchampion', 'glyph:oblivion'] }),
  ware('bundle', 'portalmaster', 2000, { tier: 'premium', gives: ['portal:daedric', 'aura:dominion', 'glyph:gatesigil'] }),
  ware('bundle', 'lordofoblivion', 3000, { tier: 'exclusive', gives: ['mount:warhorse', 'portal:daedric', 'aura:dominion', 'kill:pyre'] }),
  // AURUM (bible/06-Systems/Aurum.md): the profile icons, and the Aurum's packs - bought again and again for money,
  // never held (shopRepeatable); a bigger pack gives more for each dollar
  icon('gatefire', 300, 'premium'), icon('aurbis', 400, 'exclusive'), icon('elderscroll', 300, 'premium'), icon('azurastar', 300, 'premium'),
  icon('redmountain', 400, 'exclusive'), icon('hourglass', 300, 'standard'), icon('sanguinerose', 200, 'standard'), icon('whitegold', 200, 'standard'),
  ware('aurum', '500', 499, { tier: 'standard', aurum: 500 }),
  ware('aurum', '1100', 999, { tier: 'standard', aurum: 1100 }),
  ware('aurum', '2400', 1999, { tier: 'premium', aurum: 2400 }),
  ware('aurum', '3900', 2999, { tier: 'exclusive', aurum: 3900 }),
]);
/** STOREFRONT: the English names of the wares no other table names - the titles', glyphs' and aura's are the client's
 *  own (playerBadge.js TITLE_TEXT, AURA_TEXT, enhancedAccount.js GLYPH_LABEL - a pin holds them equal). */
const OWN_NAME = Object.freeze({
  'title:dawnbringer': 'Dawnbringer', 'title:voidwalker': 'Voidwalker', 'title:eternalchampion': 'Eternal Champion',
  'glyph:oblivion': 'Oblivion Sigil', 'glyph:gatesigil': 'Gate Sigil', 'aura:dominion': 'Daedric Dominion',
  'bundle:daedricchampion': 'Daedric Champion', 'bundle:portalmaster': 'Portal Master', 'bundle:lordofoblivion': 'Lord of Oblivion',
  'aurum:500': '500 Aurum', 'aurum:1100': '1,100 Aurum', 'aurum:2400': '2,400 Aurum', 'aurum:3900': '3,900 Aurum',   // AURUM: Stripe's line and the receipt
});
/** A ware's name and kind in English, for the service's pages, Stripe's line and the receipt (a money order's, older
 *  than AURUM-ONLY, names its ware still). */
export const SHOP_WARE_NAME = Object.freeze({
  'title:genesis': 'Genesis', 'glyph:origin': 'Origin', 'aura:eternal': 'Eternal',
  ...Object.fromEntries([...ARMORY_PIECES.filter((p) => p.source === 'shop').map((p) => p.key), ...Object.keys(ARMORY_SETS)].map((k) => [`armory:${k}`, ARMORY_NAME[/** @type {keyof typeof ARMORY_NAME} */ (k)]])),
  ...Object.fromEntries(EFFECTS.map((e) => [`${e.slot}:${e.key}`, e.name])),
  ...OWN_NAME,
});
export const SHOP_KIND_NAME = Object.freeze({
  title: 'title', glyph: 'glyph', icon: 'profile icon', aura: 'aura', armory: 'Aura Armory', kill: 'kill effect', portal: 'portal skin', mount: 'mount look',
  bundle: 'bundle', aurum: 'Aurum',
});
/** A ware by its id (`kind:key`), or null. */
export const shopWareById = (/** @type {unknown} */ id) => SHOP_WARES.find((w) => w.id === id) ?? null;
/** Every ware's key is in its vocabulary - a ware no token could carry would be a sale nobody sees - and a giver gives
 *  wares that are. */
export const shopVocabularyOk = () => SHOP_WARES.every((w) => {
  if (w.gives.length && !w.gives.every((g) => shopWareById(g))) return false;
  if (w.kind === 'bundle') return w.gives.length > 0;
  if (w.kind === 'aurum') return Number.isSafeInteger(w.aurum) && w.aurum > 0 && w.cash;   // AURUM: a pack gives Aurum, for money
  if (w.kind === 'icon') return ICONS.includes(w.key);
  if (w.kind === 'kill' || w.kind === 'portal' || w.kind === 'mount') return !!effectOf(w.kind, w.key);
  return ({ title: TITLES, aura: AURAS, glyph: GLYPHS, armory: [...ARMORY_PIECES.filter((p) => p.source === 'shop').map((p) => p.key), ...Object.keys(ARMORY_SETS)] })[w.kind]?.includes(w.key);
});
/** Every bit once, and the bits the column may hold together. */
export const SHOP_BITS_ALL = SHOP_WARES.reduce((a, w) => a | w.bit, 0);
/** STOREFRONT: an id in `shop_held` - a ware's own shape, so a row's text is never read past it. */
export const SHOP_HELD_ID_RE = /^[a-z]{3,8}:[a-z0-9]{2,24}$/;

/** AURUM: a ware bought again and again and never held - an Aurum pack. Its paid orders are the Aurum it gives
 *  (net/aurumLaw.js), so a payment taken back takes them back with it. Pure. */
export const shopRepeatable = (/** @type {unknown} */ w) => !!w && /** @type {any} */ (w).kind === 'aurum';

/** The ware ids a row's `shop_wares` bits hold, in the wares' order. A bit no ware has is not held. Pure. */
export function shopHeldOf(/** @type {unknown} */ bits) {
  const b = Number(bits);
  if (!Number.isSafeInteger(b) || b <= 0) return [];
  return SHOP_WARES.filter((w) => w.bit !== 0 && (b & w.bit) !== 0).map((w) => w.id);
}
/** STOREFRONT: what a row holds directly - its bits and its held ids (`shop_held`, space-separated). A number is read as
 *  the bits alone (the SHOP pins' shape). Answers ware ids, each once, in the wares' order. Pure. */
export function shopHeldDirect(/** @type {unknown} */ row) {
  const bits = typeof row === 'object' && row ? /** @type {any} */ (row).shop_wares : row;
  const text = typeof row === 'object' && row ? /** @type {any} */ (row).shop_held : '';
  const ids = /** @type {Set<string>} */ (new Set(shopHeldOf(bits)));
  if (typeof text === 'string') for (const id of text.split(' ')) if (SHOP_HELD_ID_RE.test(id) && shopWareById(id)) ids.add(id);
  return SHOP_WARES.filter((w) => ids.has(w.id)).map((w) => w.id);
}
/** STOREFRONT (AUDIT-STOREFRONT S1): THE WARES A ROW'S GIVERS NO LONGER GIVE - `-<id>` in `shop_held`. A giver sold
 *  with credit for a ware held then never paid for it, so when that ware's own payment goes back it leaves the row whole
 *  (shop.js revokeOrder); a payment that covers it again takes the mark off. Pure. */
export function shopLostOf(/** @type {unknown} */ row) {
  const text = typeof row === 'object' && row ? /** @type {any} */ (row).shop_held : '';
  const out = /** @type {Set<string>} */ (new Set());
  if (typeof text === 'string') for (const t of text.split(' ')) if (t[0] === '-' && SHOP_HELD_ID_RE.test(t.slice(1)) && shopWareById(t.slice(1))) out.add(t.slice(1));
  return out;
}
/** STOREFRONT: EVERYTHING A ROW HOLDS - what it holds directly and, through every giver it holds, what that gives (but a
 *  ware it lost, shopLostOf). Pure. */
export function shopHeldIds(/** @type {unknown} */ row) {
  const out = /** @type {Set<string>} */ (new Set(shopHeldDirect(row)));
  const lost = shopLostOf(row);
  const stack = [...out];
  while (stack.length) {
    const w = shopWareById(stack.pop());
    for (const g of w?.gives ?? []) if (!out.has(g) && !lost.has(g)) { out.add(g); stack.push(g); }
  }
  return SHOP_WARES.filter((w) => out.has(w.id)).map((w) => w.id);
}
/** STOREFRONT (AUDIT-STOREFRONT S1): a ware and every ware it gives, through every giver - in the wares' order. Pure. */
export function shopClosure(/** @type {unknown} */ id) {
  const out = /** @type {Set<string>} */ (new Set());
  const stack = shopWareById(id) ? [String(id)] : [];
  while (stack.length) {
    const x = /** @type {string} */ (stack.pop());
    if (out.has(x)) continue;
    out.add(x);
    stack.push(...(shopWareById(x)?.gives ?? []));
  }
  return SHOP_WARES.filter((w) => out.has(w.id)).map((w) => w.id);
}
/** STOREFRONT (AUDIT-STOREFRONT S1): A SALE'S CREDIT - what of a giver a row holds already, which its price for the row
 *  takes off (shopPriceFor). The order keeps it, so a payment covers only the rest (shop.js). Pure. */
export const shopCreditOf = (/** @type {unknown} */ row, /** @type {unknown} */ id) => {
  const held = shopHeldIds(row);
  return shopClosure(id).filter((x) => x !== id && held.includes(x));
};
/** The keys of one kind (`title`, `glyph`, `aura`, `armory`, `kill`, `portal`, `mount`) a row holds, in the wares' order -
 *  a giver's never (the Eternal Set's pieces, a bundle's wares). Pure. */
export const shopKeysOf = (/** @type {unknown} */ row, /** @type {string} */ kind) => {
  const held = shopHeldIds(row);
  return SHOP_WARES.filter((w) => w.kind === kind && !w.gives.length && held.includes(w.id)).map((w) => w.key);
};
/** STOREFRONT: A WARE'S WORTH in Aurum - its price, or for a giver what it gives, at their worth. Pure. */
export function shopWorth(/** @type {unknown} */ id) {
  const w = shopWareById(id);
  if (!w) return 0;
  return w.gives.length ? w.gives.reduce((a, g) => a + shopWorth(g), 0) : w.price;
}
/** The worth of what a ware gives that `held` (ware ids, as shopHeldIds answers) does not - 0 once all of it is held. */
function worthLeft(/** @type {any} */ w, /** @type {ReadonlyArray<string>} */ held) {
  if (!w || held.includes(w.id)) return 0;
  return w.gives.length ? w.gives.reduce((a, /** @type {string} */ g) => a + worthLeft(shopWareById(g), held), 0) : w.price;
}
/** Whether a row holds what a ware gives - its own id, or everything it gives: a ware so held is not sold again. An
 *  Aurum pack is never held (AURUM-ONLY: its Aurum `price` is none, which is not "nothing left to buy"). Pure. */
export const shopOwns = (/** @type {unknown} */ row, /** @type {string} */ id) => {
  const w = shopWareById(id);
  return !!w && !shopRepeatable(w) && worthLeft(w, shopHeldIds(row)) === 0;
};
/** STOREFRONT: A WARE'S PRICE FOR A ROW, in Aurum - a giver's price times the share of its worth not yet held (never
 *  under SHOP_MIN_PRICE), any other ware's own; null when it is owned, and for a pack (its price is its `cents`). The
 *  service charges it and the window shows it. Pure. */
export function shopPriceFor(/** @type {unknown} */ row, /** @type {string} */ id) {
  const w = shopWareById(id);
  if (!w || shopRepeatable(w)) return null;
  const left = worthLeft(w, shopHeldIds(row));
  if (left === 0) return null;
  if (!w.gives.length) return w.price;
  return Math.max(SHOP_MIN_PRICE, Math.min(w.price, Math.round((w.price * left) / shopWorth(w.id))));
}

/** WHAT IS ON SALE, off the service's config (`SHOP_ON_SALE = "title:genesis,glyph:origin,aura:eternal"`): the wares it
 *  names, in the wares' order. A word that is no ware's id is not read, nor a ware never sold alone. The owner ends a
 *  sale by taking its id off. */
export function shopOnSaleOf(/** @type {unknown} */ raw) {
  if (typeof raw !== 'string' || !raw) return [];
  const named = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  return SHOP_WARES.filter((w) => w.alone && named.has(w.id)).map((w) => w.id);
}

// ═══ STOREFRONT: FEATURED, AND LIMITED (bible/06-Systems/Storefront.md section 3.1) ═════════════════════════════════
const DAY_MS = 86_400_000;
/** An instant from the config: a day (`2026-11-10`, its first moment - `end` its last, the day inside) or an exact UTC
 *  time (`2026-11-10T18:00Z`). NaN for anything else. Pure. */
export function shopWhenOf(/** @type {unknown} */ s, end = false) {
  if (typeof s !== 'string') return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?Z)?$/.exec(s);
  if (!m) return NaN;
  const [y, mo, d, h = 0, mi = 0, se = 0] = m.slice(1).map((x) => (x === undefined ? undefined : +x));
  const ms = Date.UTC(/** @type {number} */ (y), /** @type {number} */ (mo) - 1, d, h, mi, se), at = new Date(ms);
  // AUDIT-STOREFRONT S4: a date that rolls over (a 13th month, 31 November, 24:00) is no date - never a later one
  if (at.getUTCFullYear() !== y || at.getUTCMonth() + 1 !== mo || at.getUTCDate() !== d || at.getUTCHours() !== h || at.getUTCMinutes() !== mi || at.getUTCSeconds() !== se) return NaN;
  return ms + (end && m[4] === undefined ? DAY_MS : 0);
}
/** THE FEATURED SCHEDULE, off the service's config (`SHOP_FEATURED`): an entry a line (or `;`), `<ware> <from> <to>
 *  [limited]` - `{ id, fromMs, toMs, limited }` in the config's order. AUDIT-STOREFRONT S4: a line naming a ware that does
 *  not read whole is kept as `{ id, bad: true }`, which shuts that ware's sale (shopSellable) - a typo in a limited
 *  window must never sell it for good. A line naming no ware is dropped (the live config's pin reads every line). */
export function shopFeaturedOf(/** @type {unknown} */ raw) {
  if (typeof raw !== 'string' || !raw) return [];
  const out = [];
  for (const line of raw.split(/[;\n]/)) {
    const [id, from, to, mark, ...rest] = line.trim().split(/\s+/);
    const w = shopWareById(id), fromMs = shopWhenOf(from), toMs = shopWhenOf(to, true);
    if (!w) continue;
    const ok = w.alone && !rest.length && (mark === undefined || mark === 'limited') && toMs > fromMs;
    out.push(Object.freeze(ok ? { id: w.id, fromMs, toMs, limited: mark === 'limited' } : { id: w.id, fromMs: NaN, toMs: NaN, limited: false, bad: true }));
  }
  return out;
}
/** The entries featured at `nowMs`, a ware once (its first entry live), in the schedule's order. Pure. */
export function shopFeaturedNow(/** @type {ReadonlyArray<{ id: string, fromMs: number, toMs: number, limited: boolean }>} */ list, /** @type {number} */ nowMs) {
  const seen = new Set(), out = [];
  for (const e of list) if (nowMs >= e.fromMs && nowMs < e.toMs && !seen.has(e.id)) { seen.add(e.id); out.push(e); }
  return out;
}
/** WHETHER A WARE IS SOLD AT `nowMs` (AURUM-ONLY: a pack for money, any other for Aurum): sold alone, named on sale,
 *  and - for a ware the schedule marks limited - inside one of its limited windows. OPEN-ALL (2026-10-31, the owner): a
 *  window that is not limited only features a ware, it never holds its sale back. Pure. */
export function shopSellable(/** @type {any} */ w, /** @type {ReadonlyArray<string>} */ onSale, /** @type {ReadonlyArray<any>} */ featured, /** @type {number} */ nowMs) {
  if (!w?.alone || !onSale.includes(w.id)) return false;
  const mine = featured.filter((e) => e.id === w.id);
  if (mine.some((e) => e.bad)) return false;
  const limits = mine.filter((e) => e.limited);
  return !limits.length || limits.some((e) => nowMs >= e.fromMs && nowMs < e.toMs);
}

/** AUDIT-STOREFRONT S2: WHETHER A WARE MAY BE TOLD at `nowMs` - a limited ware once its first limited window opens (a
 *  drop is news when it lands; OPEN-ALL: any other at once); a ware the schedule cannot read has no date to tell. One told
 *  and not sold now is no longer sold; one not told is not on the card at all. Pure. */
export function shopDropped(/** @type {any} */ w, /** @type {ReadonlyArray<any>} */ featured, /** @type {number} */ nowMs) {
  if (!w?.alone) return false;
  const mine = featured.filter((e) => e.id === w.id), limits = mine.filter((e) => e.limited);
  return !mine.some((e) => e.bad) && (!limits.length || nowMs >= Math.min(...limits.map((e) => e.fromMs)));
}

/** A price in words, in the player's own form where the platform can say it ("$5.00"). Pure but for Intl. */
export function shopPriceText(/** @type {number} */ cents, locale = 'en-US') {
  const n = Number.isSafeInteger(cents) && cents >= 0 ? cents : 0;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: SHOP_CURRENCY.toUpperCase() }).format(n / 100);
  } catch {
    return `$${(n / 100).toFixed(2)}`;
  }
}

/** An order's id: the service's own, 24 lower-case hex (a letter's batch is `shop-<id>`). */
export const SHOP_ORDER_ID_RE = /^[0-9a-f]{24}$/;
/** The receipt letter's batch for an order - one letter an order (0093's one-a-batch index). */
export const shopReceiptBatch = (/** @type {string} */ orderId) => `shop-${orderId}`;


/**
 * THE SHOP'S CARD as the account read carries it (`/v1/account`'s `shop`), checked on the way in: `{ on, wares, featured }`
 * - `on` whether the service takes payments, each ware `{ id, sale, held, buy, cents, price, deal, until, limited }`
 * (AURUM-ONLY: a pack's `buy` the service's own https link or null and `cents` its money price; any other ware's `price`
 * this account's in Aurum - a giver's share, or `deal` today's (net/aurumLaw.js aurumDealOf); `until` the end of its
 * featured window now, or null), `featured` the carousel's ware ids in order. Null for anything else. Pure.
 * @param {any} card
 */
export function shopCardOf(card) {
  if (!card || typeof card !== 'object' || typeof card.on !== 'boolean') return null;
  const rows = Array.isArray(card.wares) ? card.wares : [];
  const wares = [];
  for (const r of rows) {
    const w = shopWareById(r?.id);
    if (!w || wares.some((x) => x.id === w.id)) continue;
    const buy = w.cash && typeof r.buy === 'string' && r.buy.startsWith('https://') && r.buy.length <= 2048 ? r.buy : null;
    const cents = w.cash && Number.isSafeInteger(r.cents) && r.cents >= SHOP_MIN_CENTS && r.cents <= w.cents ? r.cents : w.cents;
    const price = !w.cash && Number.isSafeInteger(r.price) && r.price > 0 && r.price <= w.price ? r.price : w.price;
    const until = Number.isSafeInteger(r.until) && r.until > 0 ? r.until : null;
    wares.push({ id: w.id, sale: r.sale === true, held: r.held === true, buy: card.on && r.sale === true && r.held !== true ? buy : null, cents, price,
      deal: !w.cash && r.deal === true, until, limited: until !== null && r.limited === true });
  }
  const featured = (Array.isArray(card.featured) ? card.featured : []).filter((/** @type {unknown} */ id, /** @type {number} */ i, /** @type {unknown[]} */ a) => wares.some((x) => x.id === id) && a.indexOf(id) === i);
  return { on: card.on, wares, featured };
}
