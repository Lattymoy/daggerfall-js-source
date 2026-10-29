// @ts-check
// SHOP (2026-10-28, bible/06-Systems/Shop.md; STOREFRONT 2026-10-29, Storefront.md): THE SHOP'S LAW, read by the account
// service (server-account/src/shop.js), the pause face's window (ui/enhanced/enhancedShop.js) and the Collections page. A
// ware is a cosmetic the ACCOUNT keeps, bought once with money: the service records the sale on the row, so what is held
// is read off the row at every ask (server-account/src/titles.js), and the relay sees it only in the signed token.
// Pure. Not a DFU member - Daggerfall Unity has no accounts. Ledger A (SHOP, STOREFRONT).
import { TITLES, AURAS, GLYPHS } from './identityToken.js';
import { ARMORY_PIECES, ARMORY_NAME, ARMORY_SETS, armoryLinePieces } from './armoryLaw.js';   // ARMORY: the Aura Armory's shop pieces and its set - armoryLaw.js imports nothing
import { EFFECTS, effectOf } from './effectLaw.js';   // STOREFRONT: the kill effects, portal skins and mount looks - a leaf
import { passSeasonById, passOpen } from './battlePassLaw.js';   // STOREFRONT: a season's wares are sold while it runs - a leaf

/** The currency every price is charged in, as Stripe spells it. */
export const SHOP_CURRENCY = 'usd';
/** STOREFRONT: the least a checkout may charge - Stripe's own floor for a dollar charge. */
export const SHOP_MIN_CENTS = 50;
/** The shop's sections, in the window's order (STOREFRONT: the sheet's rows; the titles and glyphs one section, the
 *  name visuals). */
export const SHOP_CATEGORIES = Object.freeze(['pass', 'kills', 'portals', 'mounts', 'names', 'auras', 'armory', 'bundles', 'boosts']);
/** The section each kind of ware is sold in. */
export const SHOP_KIND_CATEGORY = Object.freeze({
  title: 'names', glyph: 'names', aura: 'auras', armory: 'armory', kill: 'kills', portal: 'portals', mount: 'mounts', pass: 'pass', boost: 'boosts', bundle: 'bundles',
});
/** STOREFRONT: a ware's tier - the sheet's three columns. The pre-alpha wares have none (they carry their Pre-alpha mark). */
export const SHOP_TIERS = Object.freeze(['standard', 'premium', 'exclusive']);

/**
 * One ware. `cents` its price in US cents (for a ware never sold alone, its worth inside a bundle); `bit` its bit on
 * `players.shop_wares` - the first nine only, never renumbered, since a stored bit is a sale that happened - or 0 for a
 * ware held by its id in `players.shop_held`. `gives` the wares it holds for whoever holds it; `extra` the worth of its
 * own beside them (a Deluxe Pass's). `season` the season it is sold in; `alone` false for a ware sold only in a bundle.
 * @param {string} kind @param {string} key @param {number} cents
 * @param {{ bit?: number, tier?: string|null, gives?: string[], extra?: number, season?: string|null, alone?: boolean, preAlpha?: boolean }} [o]
 */
const ware = (kind, key, cents, { bit = 0, tier = null, gives = [], extra = 0, season = null, alone = true, preAlpha = false } = {}) => Object.freeze({
  id: `${kind}:${key}`, kind, key, category: SHOP_KIND_CATEGORY[/** @type {keyof typeof SHOP_KIND_CATEGORY} */ (kind)], cents, bit, preAlpha, tier,
  gives: Object.freeze([...gives]), extra, season, alone,
});
const pre = (/** @type {number} */ bit) => ({ bit, preAlpha: true });
/** THE WARES, in the window's order within each section. The pre-alpha nine are the owner's (SHOP, ARMORY); the rest are
 *  the sheet's (STOREFRONT, Storefront.md sections 2-8). */
export const SHOP_WARES = Object.freeze([
  // THE BATTLE PASS (bible/06-Systems/Battle-Pass.md): the Deluxe holds the Premium and is worth $20 of its own
  ware('pass', 's1premium', 2999, { tier: 'premium', season: 's1' }),
  ware('pass', 's1deluxe', 4999, { tier: 'exclusive', season: 's1', gives: ['pass:s1premium'], extra: 2000 }),
  ware('kill', 'ashen', 999, { tier: 'standard' }),
  ware('kill', 'voidrend', 1999, { tier: 'premium' }),
  ware('kill', 'pyre', 2999, { tier: 'exclusive' }),
  ware('portal', 'runic', 1499, { tier: 'standard' }),
  ware('portal', 'daedric', 2999, { tier: 'premium' }),
  ware('portal', 'aetheric', 4999, { tier: 'exclusive' }),
  ware('mount', 'spectral', 1999, { tier: 'standard' }),
  ware('mount', 'dawnfire', 3499, { tier: 'premium' }),
  ware('mount', 'warhorse', 5999, { tier: 'exclusive' }),
  ware('title', 'genesis', 500, pre(1)),
  ware('glyph', 'origin', 200, pre(2)),
  ware('title', 'dawnbringer', 699, { tier: 'standard' }),
  ware('title', 'voidwalker', 1299, { tier: 'premium' }),
  ware('title', 'eternalchampion', 2499, { tier: 'exclusive' }),
  ware('glyph', 'oblivion', 499, { alone: false }),
  ware('glyph', 'gatesigil', 499, { alone: false }),
  ware('glyph', 'gearcrown', 499, { alone: false }),
  ware('aura', 'eternal', 2000, pre(4)),
  ware('aura', 'dominion', 2499, { alone: false }),
  // ARMORY (bible/04-Characters/Aura-Armory.md section 4): the Eternal line - the owner: "The store set should be $20" -
  // whole at $20, and a piece a slot at $6; the Dagonfire line is the Sigil Broker's, never sold for money
  ware('armory', 'eternalset', 2000, { ...pre(256), gives: armoryLinePieces(ARMORY_SETS.eternalset).map((p) => `armory:${p.key}`) }),
  ware('armory', 'eternalhalo', 600, pre(8)),
  ware('armory', 'eternalsigil', 600, pre(16)),
  ware('armory', 'eternalarmlets', 600, pre(32)),
  ware('armory', 'eternalgreaves', 600, pre(64)),
  ware('armory', 'eternaledge', 600, pre(128)),
  ware('bundle', 'daedricchampion', 5999, { tier: 'exclusive', gives: ['aura:dominion', 'kill:pyre', 'title:eternalchampion', 'glyph:oblivion'] }),
  ware('bundle', 'portalmaster', 4999, { tier: 'premium', gives: ['portal:daedric', 'aura:dominion', 'glyph:gatesigil'] }),
  ware('bundle', 'lordofoblivion', 11999, { tier: 'exclusive', gives: ['mount:warhorse', 'portal:daedric', 'aura:dominion', 'kill:pyre'] }),
  ware('bundle', 'seasonalcollector', 6499, { tier: 'exclusive', season: 's1', gives: ['pass:s1deluxe', 'boost:s1heart', 'glyph:gearcrown'] }),
  ware('boost', 's1cog', 499, { tier: 'standard', season: 's1' }),
  ware('boost', 's1tonal', 1299, { tier: 'premium', season: 's1' }),
  ware('boost', 's1heart', 2499, { tier: 'exclusive', season: 's1' }),
]);
/** STOREFRONT: the English names of the wares no other table names - the titles', glyphs' and aura's are the client's
 *  own (playerBadge.js TITLE_TEXT, AURA_TEXT, enhancedAccount.js GLYPH_LABEL - a pin holds them equal). */
const OWN_NAME = Object.freeze({
  'title:dawnbringer': 'Dawnbringer', 'title:voidwalker': 'Voidwalker', 'title:eternalchampion': 'Eternal Champion',
  'glyph:oblivion': 'Oblivion Sigil', 'glyph:gatesigil': 'Gate Sigil', 'glyph:gearcrown': 'Brass Crown', 'aura:dominion': 'Daedric Dominion',
  'pass:s1premium': "Dwemer's Breach Premium Pass", 'pass:s1deluxe': "Dwemer's Breach Deluxe Pass",
  'bundle:daedricchampion': 'Daedric Champion', 'bundle:portalmaster': 'Portal Master', 'bundle:lordofoblivion': 'Lord of Oblivion', 'bundle:seasonalcollector': 'Seasonal Collector',
  'boost:s1cog': 'Cog Booster', 'boost:s1tonal': 'Tonal Booster', 'boost:s1heart': 'Heart Booster',
});
/** A ware's name and kind in English, for the service's pages, Stripe's line and the receipt. */
export const SHOP_WARE_NAME = Object.freeze({
  'title:genesis': 'Genesis', 'glyph:origin': 'Origin', 'aura:eternal': 'Eternal',
  ...Object.fromEntries([...ARMORY_PIECES.filter((p) => p.source === 'shop').map((p) => p.key), ...Object.keys(ARMORY_SETS)].map((k) => [`armory:${k}`, ARMORY_NAME[/** @type {keyof typeof ARMORY_NAME} */ (k)]])),
  ...Object.fromEntries(EFFECTS.map((e) => [`${e.slot}:${e.key}`, e.name])),
  ...OWN_NAME,
});
export const SHOP_KIND_NAME = Object.freeze({
  title: 'title', glyph: 'glyph', aura: 'aura', armory: 'Aura Armory', kill: 'kill effect', portal: 'portal skin', mount: 'mount look',
  pass: 'Battle Pass', boost: 'Pass Booster', bundle: 'bundle',
});
/** A ware by its id (`kind:key`), or null. */
export const shopWareById = (/** @type {unknown} */ id) => SHOP_WARES.find((w) => w.id === id) ?? null;
/** Every ware's key is in its vocabulary - a ware no token could carry would be a sale nobody sees - and a giver gives
 *  wares that are. */
export const shopVocabularyOk = () => SHOP_WARES.every((w) => {
  if (w.gives.length && !w.gives.every((g) => shopWareById(g))) return false;
  if (w.kind === 'pass' || w.kind === 'boost') return !!passSeasonById(w.season);
  if (w.kind === 'bundle') return w.gives.length > 0;
  if (w.kind === 'kill' || w.kind === 'portal' || w.kind === 'mount') return !!effectOf(w.kind, w.key);
  return ({ title: TITLES, aura: AURAS, glyph: GLYPHS, armory: [...ARMORY_PIECES.filter((p) => p.source === 'shop').map((p) => p.key), ...Object.keys(ARMORY_SETS)] })[w.kind]?.includes(w.key);
});
/** Every bit once, and the bits the column may hold together. */
export const SHOP_BITS_ALL = SHOP_WARES.reduce((a, w) => a | w.bit, 0);
/** STOREFRONT: an id in `shop_held` - a ware's own shape, so a row's text is never read past it. */
export const SHOP_HELD_ID_RE = /^[a-z]{3,8}:[a-z0-9]{2,24}$/;

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
  const ids = new Set(shopHeldOf(bits));
  if (typeof text === 'string') for (const id of text.split(' ')) if (SHOP_HELD_ID_RE.test(id) && shopWareById(id)) ids.add(id);
  return SHOP_WARES.filter((w) => ids.has(w.id)).map((w) => w.id);
}
/** STOREFRONT: EVERYTHING A ROW HOLDS - what it holds directly and, through every giver it holds, what that gives. Pure. */
export function shopHeldIds(/** @type {unknown} */ row) {
  const out = new Set(shopHeldDirect(row));
  const stack = [...out];
  while (stack.length) {
    const w = shopWareById(stack.pop());
    for (const g of w?.gives ?? []) if (!out.has(g)) { out.add(g); stack.push(g); }
  }
  return SHOP_WARES.filter((w) => out.has(w.id)).map((w) => w.id);
}
/** The keys of one kind (`title`, `glyph`, `aura`, `armory`, `kill`, `portal`, `mount`) a row holds, in the wares' order -
 *  a giver's never (the Eternal Set's pieces, a bundle's wares). Pure. */
export const shopKeysOf = (/** @type {unknown} */ row, /** @type {string} */ kind) => {
  const held = shopHeldIds(row);
  return SHOP_WARES.filter((w) => w.kind === kind && !w.gives.length && held.includes(w.id)).map((w) => w.key);
};
/** STOREFRONT: A WARE'S WORTH - its price, or for a giver what it gives and its own beside them, at their worth. Pure. */
export function shopWorth(/** @type {unknown} */ id) {
  const w = shopWareById(id);
  if (!w) return 0;
  return w.gives.length ? w.extra + w.gives.reduce((a, g) => a + shopWorth(g), 0) : w.cents;
}
/** The worth of what a ware gives that `held` (ware ids, as shopHeldIds answers) does not - 0 once all of it is held. */
function worthLeft(/** @type {any} */ w, /** @type {ReadonlyArray<string>} */ held) {
  if (!w || held.includes(w.id)) return 0;
  return w.gives.length ? w.extra + w.gives.reduce((a, /** @type {string} */ g) => a + worthLeft(shopWareById(g), held), 0) : w.cents;
}
/** Whether a row holds what a ware gives - its own id, or everything it gives: a ware so held is not sold again. Pure. */
export const shopOwns = (/** @type {unknown} */ row, /** @type {string} */ id) => {
  const w = shopWareById(id);
  return !!w && worthLeft(w, shopHeldIds(row)) === 0;
};
/** STOREFRONT: A WARE'S PRICE FOR A ROW - a giver's price times the share of its worth not yet held (never under
 *  SHOP_MIN_CENTS), any other ware's own; null when it is owned. The service charges it and the window shows it. Pure. */
export function shopPriceFor(/** @type {unknown} */ row, /** @type {string} */ id) {
  const w = shopWareById(id);
  if (!w) return null;
  const left = worthLeft(w, shopHeldIds(row));
  if (left === 0) return null;
  if (!w.gives.length) return w.cents;
  return Math.max(SHOP_MIN_CENTS, Math.min(w.cents, Math.round((w.cents * left) / shopWorth(w.id))));
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
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (day) { const ms = Date.UTC(+day[1], +day[2] - 1, +day[3]); return new Date(ms).getUTCDate() === +day[3] ? ms + (end ? DAY_MS : 0) : NaN; }
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/.test(s) ? Date.parse(s) : NaN;
}
/** THE FEATURED SCHEDULE, off the service's config (`SHOP_FEATURED`): an entry a line (or `;`), `<ware> <from> <to>
 *  [limited]` - `{ id, fromMs, toMs, limited }` in the config's order. An entry that does not read whole is dropped. */
export function shopFeaturedOf(/** @type {unknown} */ raw) {
  if (typeof raw !== 'string' || !raw) return [];
  const out = [];
  for (const line of raw.split(/[;\n]/)) {
    const [id, from, to, mark, ...rest] = line.trim().split(/\s+/);
    const w = shopWareById(id), fromMs = shopWhenOf(from), toMs = shopWhenOf(to, true);
    if (!w || !w.alone || rest.length || (mark !== undefined && mark !== 'limited') || !(toMs > fromMs)) continue;
    out.push(Object.freeze({ id: w.id, fromMs, toMs, limited: mark === 'limited' }));
  }
  return out;
}
/** The entries featured at `nowMs`, a ware once (its first entry live), in the schedule's order. Pure. */
export function shopFeaturedNow(/** @type {ReadonlyArray<{ id: string, fromMs: number, toMs: number, limited: boolean }>} */ list, /** @type {number} */ nowMs) {
  const seen = new Set(), out = [];
  for (const e of list) if (nowMs >= e.fromMs && nowMs < e.toMs && !seen.has(e.id)) { seen.add(e.id); out.push(e); }
  return out;
}
/** WHETHER A WARE IS SOLD AT `nowMs`: sold alone, named on sale, inside its season's days, never before its first featured
 *  window (a drop is news when it lands), and - for a ware the schedule marks limited - inside one of its limited
 *  windows. Pure. */
export function shopSellable(/** @type {any} */ w, /** @type {ReadonlyArray<string>} */ onSale, /** @type {ReadonlyArray<any>} */ featured, /** @type {number} */ nowMs) {
  if (!w?.alone || !onSale.includes(w.id)) return false;
  if (w.season && !passOpen(passSeasonById(w.season), nowMs)) return false;
  const mine = featured.filter((e) => e.id === w.id);
  if (mine.length && nowMs < Math.min(...mine.map((e) => e.fromMs))) return false;
  const limits = mine.filter((e) => e.limited);
  return !limits.length || limits.some((e) => nowMs >= e.fromMs && nowMs < e.toMs);
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
 * - `on` whether the service takes payments, each ware `{ id, sale, held, buy, cents, until, limited }` (`buy` the
 * service's own https link, or null; `cents` this account's price, a giver's share; `until` the end of its featured window
 * now, or null), `featured` the carousel's ware ids in order. Null for anything else, which draws nothing to buy. Pure.
 * @param {any} card
 */
export function shopCardOf(card) {
  if (!card || typeof card !== 'object' || typeof card.on !== 'boolean') return null;
  const rows = Array.isArray(card.wares) ? card.wares : [];
  const wares = [];
  for (const r of rows) {
    const w = shopWareById(r?.id);
    if (!w || wares.some((x) => x.id === w.id)) continue;
    const buy = typeof r.buy === 'string' && r.buy.startsWith('https://') && r.buy.length <= 2048 ? r.buy : null;
    const cents = Number.isSafeInteger(r.cents) && r.cents >= SHOP_MIN_CENTS && r.cents <= w.cents ? r.cents : w.cents;
    const until = Number.isSafeInteger(r.until) && r.until > 0 ? r.until : null;
    wares.push({ id: w.id, sale: r.sale === true, held: r.held === true, buy: card.on && r.sale === true && r.held !== true ? buy : null, cents, until, limited: until !== null && r.limited === true });
  }
  const featured = (Array.isArray(card.featured) ? card.featured : []).filter((/** @type {unknown} */ id, /** @type {number} */ i, /** @type {unknown[]} */ a) => wares.some((x) => x.id === id) && a.indexOf(id) === i);
  return { on: card.on, wares, featured };
}
