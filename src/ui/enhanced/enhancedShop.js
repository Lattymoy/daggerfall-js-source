// @ts-check
// SHOP (2026-10-28, the owner: "A new glyph panel alongside the timer and mailbox that will be used for our monetization
// shop. This needs to be detailed and panel based when open showing the purchasable items organized in categories with a
// strict disclaimer that all proceeds go towards development costs"; bible/06-Systems/Shop.md): THE SHOP. A gem at the
// end of the pause face's row of marks opens a window in the pause window's frame: the proceeds' disclaimer first, then
// STOREFRONT's carousel of the featured wares (2026-10-29, the owner: "a rotating panel carousel with limited featured
// items"; bible/06-Systems/Storefront.md section 9), then a tab a section and in each a panel a ware - seen live - its
// tier, the price it costs this account, and Buy, which opens Stripe's page in a browser.
import { SHOP_WARES, SHOP_CATEGORIES, SHOP_TIERS, shopPriceText, shopWareById, shopWorth, shopClosure } from '../../net/shopLaw.js';
import { TERMS_URL } from '../../net/legalLaw.js';
import { titleBadge, paintTitle, glyphBadges, glyphSvgNode, TITLE_TEXT, AURA_TEXT, AURA_PAINT } from '../playerBadge.js';
import { GLYPH_LABEL } from './enhancedAccount.js';
import { t, intlLocale } from '../../systems/textManager.js';
import { armoryPieceOf, armoryKitPieces, armoryKitOf, armoryLineKit, armoryWarePieces, ARMORY_SETS } from '../../net/armoryLaw.js';   // ARMORY: the Aura Armory's pieces, sold in a section of their own
import { ARMORY_LOOK, ARMORY_SET_LOOK, armoryPieceName, armorySlotName } from '../armoryText.js';
import { effectWorn } from '../../net/effectLaw.js';   // STOREFRONT: the effects worn
import { effectName, effectLook, effectSlotName } from '../effectText.js';
import { profileIconNode } from '../profileIcons.js';
import { wareArtNode } from '../wareArt.js';   // AUDIT-STOREFRONT: a piece's, a reward's and a banner's picture
import { mountPreview } from '../mountPreview.js';
import { playPreviewSound } from '../effectPreviewSound.js';
import { PASS_SEASONS, PASS_REWARDS, PASS_DELUXE, PASS_CHALLENGES, PASS_LEVELS, PASS_XP_PER_LEVEL, PASS_BOOSTS, PASS_WARES, passSeasonById } from '../../net/battlePassLaw.js';
import { PASS_SEASON_TEXT, PASS_SEASON_LOOK, PASS_STAGE_TEXT, passChallengeText, passBoostText, passGrantName, passGrantKind } from '../passText.js';

/** Each section's tab, in the player's language. */
export const SHOP_CATEGORY_TEXT = Object.freeze({
  pass: () => t('shop.cat.pass', 'Battle Pass'),
  kills: () => t('shop.cat.kills', 'Kill Effects'),
  portals: () => t('shop.cat.portals', 'Portal Skins'),
  mounts: () => t('shop.cat.mounts', 'Mounts'),
  names: () => t('shop.cat.names', 'Name Visuals'),
  auras: () => t('shop.cat.auras', 'Auras'),
  armory: () => t('shop.cat.armory', 'Aura Armory'),
  bundles: () => t('shop.cat.bundles', 'Bundles'),
  boosts: () => t('shop.cat.boosts', 'Pass Boosters'),
});
/** STOREFRONT: each tier's mark. */
export const SHOP_TIER_TEXT = Object.freeze({
  standard: () => t('shop.tier.standard', 'Standard'),
  premium: () => t('shop.tier.premium', 'Premium'),
  exclusive: () => t('shop.tier.exclusive', 'Exclusive'),
});
/** Each kind's word on its panel. */
const KIND_TEXT = Object.freeze({
  title: () => t('shop.kind.title', 'Title'), glyph: () => t('shop.kind.glyph', 'Glyph'), aura: () => t('shop.kind.aura', 'Aura'), armory: () => t('shop.kind.armory', 'Aura Armory'),
  kill: () => effectSlotName('kill'), portal: () => t('shop.kind.portal', 'Portal skin'), mount: () => t('shop.kind.mount', 'Mount look'),
  pass: () => t('shop.kind.pass', 'Battle Pass'), boost: () => t('shop.kind.boost', 'Pass Booster'), bundle: () => t('shop.kind.bundle', 'Bundle'),
});
/** ARMORY: the line a set ware gives whole, or null for any other ware. */
const setOf = (/** @type {{ kind: string, key: string }} */ w) => (w.kind === 'armory' ? ARMORY_SETS[/** @type {keyof typeof ARMORY_SETS} */ (w.key)] ?? null : null);
/** A ware's kind as its panel says it - an armory piece's with its slot, a set's with its count, a bundle's with its count. */
const kindText = (/** @type {{ kind: string, key: string, gives?: ReadonlyArray<string> }} */ w) => {
  if (w.kind === 'armory') return `${KIND_TEXT.armory()} · ${setOf(w) ? t('shop.armory.setOf', 'a set of {n}', { n: armoryWarePieces(w.key).length }) : armorySlotName(armoryPieceOf(w.key)?.slot ?? '')}`;
  if (w.kind === 'bundle') return `${KIND_TEXT.bundle()} · ${t('shop.bundle.of', '{n} items', { n: w.gives?.length ?? 0 })}`;
  return KIND_TEXT[/** @type {keyof typeof KIND_TEXT} */ (w.kind)]?.() ?? w.kind;
};
/** Each ware in a sentence: what it looks like. */
export const SHOP_LOOK = Object.freeze({
  'title:genesis': () => t('shop.look.genesis', 'A title set on a plate of blue-violet fire that burns behind its letters, over your name.'),
  'glyph:origin': () => t('shop.look.origin', 'A dragon coiled round on itself, biting its tail, a spark burning at its heart. Light runs round its scales.'),
  'aura:eternal': () => t('shop.look.eternal', 'A cape of blue-violet fire on your back. It flows as you move, and wisps of flame trail behind you.'),
  // ARMORY: a piece's own words (ui/armoryText.js), one home for every face that says them
  ...Object.fromEntries(Object.entries({ ...ARMORY_LOOK, ...ARMORY_SET_LOOK }).map(([k, f]) => [`armory:${k}`, f])),
  // STOREFRONT: the effects' own words (ui/effectText.js), and the sheet's other wares
  ...Object.fromEntries(SHOP_WARES.filter((w) => w.kind === 'kill' || w.kind === 'portal' || w.kind === 'mount').map((w) => [w.id, () => effectLook(w.kind, w.key)])),
  'title:dawnbringer': () => t('shop.look.dawnbringer', 'A title on a plate of gold, rays of dawn rising behind its letters, over your name.'),
  'title:voidwalker': () => t('shop.look.voidwalker', 'A title on a plate of violet void, stars drawn slowly into its dark, over your name.'),
  'title:eternalchampion': () => t('shop.look.eternalchampion', 'A title on a plate of crimson fire under a gold edge, over your name.'),
  'glyph:oblivion': () => t('shop.look.oblivion', 'A Daedric sigil, its spokes burning crimson round a dark eye. It comes in the Daedric Champion bundle.'),
  'glyph:gatesigil': () => t('shop.look.gatesigil', 'A gate of runes, a spark burning between its pillars. It comes in the Portal Master bundle.'),
  'glyph:gearcrown': () => t('shop.look.gearcrown', 'A crown of brass cogs, an aetherium stone at its brow. It comes in the Seasonal Collector bundle.'),
  'aura:dominion': () => t('shop.look.dominion', 'A ring of Daedric script burns black and crimson at your feet, embers rising off it. It comes in three bundles.'),
  'pass:s1premium': () => t('shop.look.s1premium', "Opens the premium track of Dwemer's Breach: {n, plural, one {# more reward} other {# more rewards}}, given as you reach them and at once for levels behind you.", { n: PASS_REWARDS.s1.filter((r) => r.track === 'premium').length }),   // AUDIT-STOREFRONT S11: counted, never written
  'pass:s1deluxe': () => t('shop.look.s1deluxe', 'The Premium Pass, five levels at once, and three rewards of its own now: the Gilded Coil, the Brass Automaton and Echo of Numidium.'),
  'bundle:daedricchampion': () => t('shop.look.daedricchampion', 'Daedric Dominion, the Daedric Pyre, Eternal Champion and the Oblivion Sigil, together.'),
  'bundle:portalmaster': () => t('shop.look.portalmaster', 'The Daedric Stone, Daedric Dominion and the Gate Sigil, together.'),
  'bundle:lordofoblivion': () => t('shop.look.lordofoblivion', 'The Daedric Warhorse, the Daedric Stone, Daedric Dominion and the Daedric Pyre, together.'),
  'bundle:seasonalcollector': () => t('shop.look.seasonalcollector', 'The Deluxe Pass, the Heart Booster and the Brass Crown, together.'),
  ...Object.fromEntries(Object.keys(PASS_BOOSTS).map((id) => [id, () => passBoostText(id)])),
});
/** STOREFRONT: the names of the wares no other face names - the passes', the bundles' and the boosters'. */
const OWN_NAME = Object.freeze({
  'pass:s1premium': () => t('shop.name.s1premium', "Dwemer's Breach Premium Pass"),
  'pass:s1deluxe': () => t('shop.name.s1deluxe', "Dwemer's Breach Deluxe Pass"),
  'bundle:daedricchampion': () => t('shop.name.daedricchampion', 'Daedric Champion'),
  'bundle:portalmaster': () => t('shop.name.portalmaster', 'Portal Master'),
  'bundle:lordofoblivion': () => t('shop.name.lordofoblivion', 'Lord of Oblivion'),
  'bundle:seasonalcollector': () => t('shop.name.seasonalcollector', 'Seasonal Collector'),
  'boost:s1cog': () => t('shop.name.s1cog', 'Cog Booster'),
  'boost:s1tonal': () => t('shop.name.s1tonal', 'Tonal Booster'),
  'boost:s1heart': () => t('shop.name.s1heart', 'Heart Booster'),
});
/** A ware's name, as every face says it (the title's and the aura's English, the glyph's label, an effect's). */
export const shopWareName = (/** @type {{ id?: string, kind: string, key: string }} */ w) => {
  if (w.kind === 'title') return TITLE_TEXT[/** @type {keyof typeof TITLE_TEXT} */ (w.key)] ?? w.key;
  if (w.kind === 'aura') return AURA_TEXT[/** @type {keyof typeof AURA_TEXT} */ (w.key)] ?? w.key;
  if (w.kind === 'armory') return armoryPieceName(w.key);
  if (w.kind === 'glyph') return GLYPH_LABEL[/** @type {keyof typeof GLYPH_LABEL} */ (w.key)] ?? w.key;
  if (w.kind === 'kill' || w.kind === 'portal' || w.kind === 'mount') return effectName(w.kind, w.key);
  return OWN_NAME[/** @type {keyof typeof OWN_NAME} */ (`${w.kind}:${w.key}`)]?.() ?? w.key;
};

/** A WARE'S NAME IN ITS OWN PAINT, for a line that names it (the mailbox's receipt): a title on its flame, a glyph's
 *  drawing before its label, an aura in its title's paint, an effect in its colour. Null for an id that is no ware. */
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
  } else if (w.kind === 'title' || w.kind === 'aura' || w.kind === 'armory') {
    paintTitle(word, titleBadge({ title: w.kind === 'title' ? w.key : AURA_PAINT[/** @type {keyof typeof AURA_PAINT} */ (w.kind === 'armory' ? armoryPieceOf(w.key)?.line ?? 'eternal' : w.key)] }), w.kind === 'title');   // ARMORY: a piece in its line's aura's paint
  } else word.className = `sh-waretag-word fx-${w.kind}-${w.key}`;   // STOREFRONT: an effect, a pass, a bundle in its own colour
  tag.append(word);
  return tag;
}

/** The card's row for a ware, or null. */
const rowOf = (/** @type {any} */ flow, /** @type {string} */ id) => flow?.shop?.wares?.find((/** @type {any} */ r) => r.id === id) ?? null;
/**
 * STOREFRONT: WHETHER THE ACCOUNT HOLDS A WARE - the card's word for a ware sold alone, else the wardrobe's (a bundle's
 * glyph, aura or effect is held as any is). Pure.
 * @param {any} flow @param {string} id
 */
export function shopHeldAny(flow, id) {
  if (rowOf(flow, id)?.held) return true;
  const w = shopWareById(id), wd = flow?.wardrobe;
  if (!w || !wd) return false;
  const has = (/** @type {unknown} */ list) => Array.isArray(list) && list.includes(w.key);
  if (w.kind === 'title') return has(wd.titles);
  if (w.kind === 'glyph') return has(wd.glyphs);
  if (w.kind === 'aura') return has(wd.auras);
  if (w.kind === 'armory') return has(wd.armoryHeld);
  if (w.kind === 'kill' || w.kind === 'portal' || w.kind === 'mount') return has(wd.effectsHeld?.[w.kind]);
  return false;
}
/**
 * WHAT A WARE'S PANEL SAYS AND OFFERS, from the flow as it stands. Pure. `state`: 'held', 'spent' (a booster a stronger one
 * held makes worth nothing), 'buy' (a link to follow), 'soon' (its season not begun), 'gone' (no longer sold), 'closed' (the shop takes no payments yet), 'guest', 'out' (nobody
 * signed in), 'reading'. `cents` what it costs this account (STOREFRONT: a bundle's or the Deluxe's, less what is held).
 * @param {any} flow @param {{ id: string, kind: string, key: string, cents: number, season?: string|null }} ware
 * @param {number} [nowMs]
 */
export function shopWareState(flow, ware, nowMs = Date.now()) {
  const row = rowOf(flow, ware.id);
  const cents = row?.cents ?? ware.cents;
  if (row?.held) return { state: 'held', worn: shopWorn(flow, ware), buy: null, cents };
  if (row?.spent) return { state: 'spent', buy: null, cents };   // AUDIT-STOREFRONT S5: a stronger booster held
  if (!flow || flow.stage === 'loading') return { state: 'reading', buy: null, cents };
  if (flow.stage !== 'in') return { state: 'out', buy: null, cents };
  if (!flow.account?.handle) return { state: 'guest', buy: null, cents };
  if (!flow.shop) return { state: 'closed', buy: null, cents };
  const season = ware.season ? passSeasonById(ware.season) : null;
  if (row && !row.sale && season && nowMs < season.fromMs) return { state: 'soon', buy: null, cents, opens: season.fromMs };
  if (row && !row.sale) return { state: 'gone', buy: null, cents };
  if (!flow.shop.on || !row?.buy) return { state: 'closed', buy: null, cents };
  return { state: 'buy', buy: row.buy, cents };
}
/** Whether a held ware is worn: the title, the aura, a glyph not taken off, an effect in its slot. Pure. */
export function shopWorn(/** @type {any} */ flow, /** @type {{ kind: string, key: string }} */ w) {
  const wd = flow?.wardrobe;
  if (!wd) return false;
  if (w.kind === 'glyph') return Array.isArray(wd.glyphs) && wd.glyphs.includes(w.key) && !(Array.isArray(wd.glyphsOff) && wd.glyphsOff.includes(w.key));
  if (w.kind === 'armory') { const kit = armoryKitPieces(wd.armory); return armoryWarePieces(w.key).every((k) => kit[armoryPieceOf(k)?.slot ?? ''] === k); }   // ARMORY: worn in its slot - a set, every piece of it
  if (w.kind === 'kill' || w.kind === 'portal' || w.kind === 'mount') return effectWorn(wd.effects, w.kind) === w.key;   // STOREFRONT
  if (w.kind === 'title' || w.kind === 'aura') return wd[w.kind] === w.key;
  return false;
}
/** Whether a ware is worn at all - a pass, a booster and a bundle are held, never worn. Pure. */
const wearable = (/** @type {{ kind: string }} */ w) => !['pass', 'boost', 'bundle'].includes(w.kind);
/** The line under the panels: who a purchase is for, or why nothing can be bought. Pure. */
export function shopWhoText(/** @type {any} */ flow) {
  if (!flow || flow.stage === 'loading') return t('shop.who.reading', 'Reading your account...');
  if (flow.stage !== 'in') return t('shop.who.out', 'Sign in from your profile to buy.');
  if (!flow.account?.handle) return t('shop.who.guest', 'A guest account cannot buy. Add a username from your profile first.');
  if (!flow.shop?.on) return t('shop.who.closed', 'The shop does not take payments yet.');
  return t('shop.who.for', 'Purchases go to the account {name}, for every character on it.', { name: flow.account.handle });
}

/** STOREFRONT: the carousel turns a panel this often (ms) - never for less motion, nor while pointed at, focused or paused. */
export const CAROUSEL_TURN_MS = 8000;
/** STOREFRONT: whether the carousel turns now - two slides or more, nobody holding it, its panel shown long enough. Pure. */
export const carouselTurns = (/** @type {{ n: number, paused: boolean, reduced: boolean, hovered: boolean, focusedIn: boolean, since: number }} */ c, /** @type {number} */ nowMs) =>
  c.n > 1 && !c.paused && !c.reduced && !c.hovered && !c.focusedIn && nowMs - c.since >= CAROUSEL_TURN_MS;
/** STOREFRONT: THE CAROUSEL'S PANELS - the card's featured wares in its order (the live season's passes first), each sold
 *  alone; none with no card. Pure. */
export const shopCarouselOf = (/** @type {any} */ flow) => (Array.isArray(flow?.shop?.featured) ? flow.shop.featured.map((/** @type {string} */ id) => shopWareById(id)).filter((/** @type {any} */ w) => !!w && w.alone) : []);
/** STOREFRONT: A BUNDLE'S CONTENTS - each ware it gives with its name, kind, whether this account holds it, and (AUDIT-
 *  STOREFRONT S12) whether it holds part of it - a giver inside, the Premium of the Deluxe - which its price takes off. Pure. */
export const shopBundleRows = (/** @type {any} */ flow, /** @type {{ gives: ReadonlyArray<string> }} */ w) => w.gives.map((id) => {
  const g = shopWareById(id), held = shopHeldAny(flow, id);
  return { id, name: g ? shopWareName(g) : id, kind: g ? KIND_TEXT[/** @type {keyof typeof KIND_TEXT} */ (g.kind)]?.() ?? g.kind : '', held, part: !held && shopClosure(id).some((x) => x !== id && shopHeldAny(flow, x)) };
});
/** STOREFRONT: the sections the window shows - each with a ware the card lists (every one sold alone with no card). Pure. */
export function shopSections(/** @type {any} */ flow) {
  const listed = (/** @type {any} */ w) => w.alone && (!flow?.shop || !!rowOf(flow, w.id));
  return SHOP_CATEGORIES.filter((c) => SHOP_WARES.some((w) => w.category === c && listed(w)));
}
/** A date as a panel says it: "12 Nov", in UTC (the schedule's days). */
const dayText = (/** @type {number} */ ms) => { try { return new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(ms)); } catch { return new Date(ms).toISOString().slice(5, 10); } };
/** STOREFRONT: how long a featured window has left, in words. Pure. */
export function shopUntilText(/** @type {number} */ untilMs, /** @type {boolean} */ limited, nowMs = Date.now()) {
  const days = Math.ceil((untilMs - nowMs) / 86_400_000);
  const left = days <= 1 ? t('shop.until.today', 'Ends today') : t('shop.until.days', '{n} days left', { n: days });
  return limited ? t('shop.until.limited', 'Limited: sold only until {day}. {left}.', { day: dayText(untilMs - 1), left }) : t('shop.until.featured', 'Featured until {day}. {left}.', { day: dayText(untilMs - 1), left });
}

/** The gem: the button at the end of the row of marks. */
export function shopMark(/** @type {Document} */ doc, { onOpen, open = false }) {
  injectShopStyle(doc);   // its place in the row is the sheet's - before the window was ever opened
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

/** THE WINDOW. `flow()` the visit's account flow; `keep` the tab and the carousel's panel, so a face rebuilt reopens there.
 *  Answers { root, stop, draw, close }: `draw` updates it in place, `stop` lets the previews and the clock go.
 * @param {Document} doc
 * @param {{ flow: () => any, onClose: () => void, keep?: { cat?: string, slide?: number }, focus?: boolean, now?: () => number,
 *   preview?: (canvas: HTMLCanvasElement, aura: string|null, kit?: string|null, body?: (() => any)|null) => Promise<{ stop: () => void }|null>,
 *   effectPreview?: (canvas: HTMLCanvasElement, slot: string, key: string, cue: (slot: string, key: string|null) => void, body?: (() => any)|null) => Promise<{ stop: () => void }|null>,
 *   wearer?: (() => any)|null, reduced?: boolean }} o `wearer` the player's own body for the stages (the profile's, ui/profileBody.js) - asked once
 */
export function shopWindow(doc, { flow, onClose, keep = {}, focus = true, preview = loadAuraPreview, effectPreview = loadEffectPreview, wearer = null, now = () => Date.now(), reduced = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches }) {
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
  proceeds.append(el('strong', 'sh-proceeds-main', t('shop.proceeds', 'All proceeds go to the costs of developing DFO Online.')), el('span', 'sh-proceeds-sub', t('shop.cosmetic', 'Every item is cosmetic. It gives no power in the game.')));   // net/shopLaw.js SHOP_PROCEEDS, SHOP_COSMETIC - a pin holds them equal
  // STOREFRONT: THE CAROUSEL - a region of slides (the WAI-ARIA carousel pattern), its controls before its panel
  const carousel = el('section', 'sh-carousel');
  carousel.setAttribute('aria-roledescription', t('shop.carousel.role', 'carousel'));
  carousel.setAttribute('aria-label', t('shop.carousel.label', 'Featured'));
  const ctrl = el('div', 'sh-cctrl');
  const pauseB = button('sh-cpause', '', () => { paused = !paused; carouselState(); });
  const prevB = button('sh-cprev', '', () => turn(-1, true));
  prevB.setAttribute('aria-label', t('shop.carousel.prev', 'Previous featured item'));
  const nextB = button('sh-cnext', '', () => turn(1, true));
  nextB.setAttribute('aria-label', t('shop.carousel.next', 'Next featured item'));
  const dots = el('div', 'sh-cdots');
  dots.setAttribute('role', 'group');
  dots.setAttribute('aria-label', t('shop.carousel.choose', 'Choose a featured item'));
  ctrl.append(pauseB, prevB, dots, nextB);
  const slideHost = el('div', 'sh-cslides');
  slideHost.setAttribute('aria-live', 'off');
  carousel.append(ctrl, slideHost);
  const tabs = el('div', 'sh-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', t('shop.cats', 'Categories'));
  // the strip's keys (the WAI-ARIA tabs pattern): an arrow steps to the next section, Home and End to the first and last
  tabs.addEventListener?.('keydown', (/** @type {KeyboardEvent} */ e) => {
    const list = shopSections(f()), i = list.indexOf(cat), n = list.length;
    const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (to < 0 || !n) return;
    e.preventDefault?.(); e.stopPropagation?.();
    pick(list[to]);
  });
  const panels = el('div', 'sh-panels');
  panels.setAttribute('role', 'tabpanel');
  const say = el('p', 'sh-say');
  say.setAttribute('role', 'status');
  const foot = el('div', 'sh-foot');
  const who = el('span', 'sh-who');
  const terms = /** @type {HTMLAnchorElement} */ (el('a', 'sh-terms', t('shop.terms', 'Terms of Service')));
  terms.href = TERMS_URL; terms.target = '_blank'; terms.rel = 'noopener';
  const paid = el('span', 'sh-paid', t('shop.stripe', 'Payments are taken by Stripe. Prices are in US dollars, and Stripe can show your own currency and ways to pay. No card details reach the game.'));
  foot.append(who, paid, terms);
  body.append(head, proceeds, carousel, tabs, panels, say, foot);
  win.append(body);

  const f = () => flow();
  /** AUDIT-STOREFRONT: the player's body, asked once a window and worn on every stage that draws a figure */
  let bodyAsked = /** @type {Promise<any>|null} */ (null);
  const bodyOf = wearer ? () => (bodyAsked ??= Promise.resolve().then(wearer).catch(() => null)) : null;
  let cat = shopSections(f()).includes(/** @type {any} */ (keep.cat)) ? /** @type {string} */ (keep.cat) : shopSections(f())[0] ?? SHOP_CATEGORIES[0];
  /** @type {Array<{ stop: () => void }>} the panels' live previews, let go when the panels are drawn again */
  let live = [];
  let liveGen = 0;   // a preview that lands after its panels were drawn again (or the window went) is let go at once
  /** @type {Map<string, any>} each drawn panel's parts, by ware */
  let drawn = new Map();
  /** @type {Map<string, HTMLButtonElement>} */
  const tabOf = new Map();
  /** @type {HTMLElement[]} the name each picture is shown beside - the account's, once it is read */
  let names = [];
  const nameText = () => f()?.account?.handle || t('shop.yourName', 'Your Name');
  const stopLive = () => { for (const p of live) p.stop(); live = []; liveGen++; };
  /** @type {Array<{ stop: () => void }>} the carousel's slide's live preview, let go when it turns */
  let slideLive = [];
  let slideGen = 0;
  const stopSlide = () => { for (const p of slideLive) p.stop(); slideLive = []; slideGen++; };
  /** An effect's sound is heard when the player turned to it - a slide chosen, a panel pointed at - never on a loop. */
  let heard = /** @type {string|null} */ (null);
  const cueOf = (/** @type {string} */ id) => (/** @type {string} */ slot, /** @type {string|null} */ key) => { if (heard === id) { heard = null; playPreviewSound(slot, key); } };

  /** A canvas preview started once it stands in the page, kept in `into` while its generation stands. */
  const startCanvas = (/** @type {HTMLElement} */ stage, /** @type {(c: HTMLCanvasElement) => Promise<{ stop: () => void }|null>} */ start, /** @type {string} */ none, /** @type {boolean} */ slide) => {
    const canvas = /** @type {HTMLCanvasElement} */ (el('canvas', 'sh-auracanvas'));
    canvas.setAttribute('aria-hidden', 'true');
    stage.append(canvas);
    const gen = slide ? slideGen : liveGen;
    const mine = () => (slide ? slideGen : liveGen) === gen;
    globalThis.requestAnimationFrame?.(() => {   // once the canvas has its size in the page
      if (!canvas.isConnected || !mine()) return;
      start(canvas).catch(() => null).then((p) => {
        if (p && mine()) { (slide ? slideLive : live).push(p); stage.addEventListener?.('pointerenter', () => /** @type {any} */ (p).again?.()); return; }   // pointed at: its loop from the top, its sound with it
        p?.stop();
        if (!p && mine()) stage.append(el('p', 'sh-nogl', none));
      });
    });
  };
  /** A ware's picture, live: the title on its plate over a name, the glyph large, the aura or the piece on its stage, an
   *  effect playing on the stand-in, the horse in its look, a bundle's contents, the season's banner. */
  const stageOf = (/** @type {any} */ w, slide = false) => {
    const stage = el('div', `sh-stage sh-stage-${w.kind}${w.tier ? ` sh-tierstage-${w.tier}` : ''}`);
    const nameEl = () => { const n = el('div', 'sh-tagname', nameText()); names.push(n); return n; };
    stage.addEventListener?.('pointerenter', () => { heard = w.id; });
    if (w.kind === 'title') {
      const big = paintTitle(el('div', 'sh-bigtitle', shopWareName(w)), titleBadge({ title: w.key }));
      big.style?.setProperty?.('--n', String(shopWareName(w).length));   // AUDIT-STOREFRONT: its size fits its name to the stage (SHOP_CSS)
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
    } else if (w.kind === 'aura' || w.kind === 'armory') {
      const armory = w.kind === 'armory';   // ARMORY: a piece on the stand-in, worn alone
      startCanvas(stage, (c) => preview(c, armory ? null : w.key, armory ? armoryKitOf(armoryWarePieces(w.key)) : null, bodyOf),
        armory ? t('shop.noPreviewArmory', 'This device cannot show the piece here.') : t('shop.noPreview', 'This device cannot show the aura here.'), slide);
    } else if (w.kind === 'kill' || w.kind === 'portal') {
      startCanvas(stage, (c) => effectPreview(c, w.kind, w.key, cueOf(w.id), bodyOf), t('shop.noPreviewEffect', 'This device cannot show the effect here.'), slide);
    } else if (w.kind === 'mount') {
      const m = mountPreview(doc);
      m.set(w.key);
      (slide ? slideLive : live).push({ stop: () => m.dispose() });
      stage.append(m.node);
    } else if (w.kind === 'bundle') {   // AUDIT-STOREFRONT: its pieces laid out, each in its own picture - a title its plate
      const list = el('ul', `sh-bundleart sh-bundle-${w.gives.length}`);
      for (const g of w.gives) {
        const gw = /** @type {any} */ (shopWareById(g));
        const li = el('li', `sh-bpiece sh-bpiece-${gw?.kind}`);
        const pic = el('div', 'sh-bpic'), art = wareArtNode(doc, g, 64, 'sh-bart');
        if (art) pic.append(art);
        const name = el('span', `sh-bname fx-${gw?.kind}-${gw?.key}`, gw ? shopWareName(gw) : g);
        if (gw?.kind === 'title') { paintTitle(name, titleBadge({ title: gw.key })); name.style?.setProperty?.('--n', String(shopWareName(gw).length)); }   // its plate fits its tile (SHOP_CSS)
        li.append(pic, name);
        li.append(el('span', 'sh-bkind', KIND_TEXT[/** @type {keyof typeof KIND_TEXT} */ (gw?.kind)]?.() ?? ''));
        list.append(li);
      }
      stage.append(el('div', 'sh-bundlemark', KIND_TEXT.bundle()), list);
    } else {   // a pass or a booster: the season's banner, AUDIT-STOREFRONT its own art at its heart
      const season = passSeasonById(w.season), boost = PASS_BOOSTS[/** @type {keyof typeof PASS_BOOSTS} */ (w.id)];
      const ban = el('div', `sh-seasonart sh-seasonart-${w.kind} sh-seasonart-${w.key}`);
      const halo = el('div', 'sh-seasonhalo'), art = wareArtNode(doc, w.id, 112, 'sh-seasonpic');
      if (art) halo.append(art);
      ban.append(halo, el('div', 'sh-seasonname', shopWareName(w)));
      if (boost) {
        ban.append(el('div', 'sh-boostmult', `×${boost.mult}`));
        if (boost.levels) ban.append(el('div', 'sh-seasondays', t('pass.boost.levels', 'And {n} levels at once.', { n: boost.levels })));
      } else if (season) {
        const own = PASS_DELUXE[/** @type {keyof typeof PASS_DELUXE} */ (season.id)];
        if (w.id === PASS_WARES[/** @type {keyof typeof PASS_WARES} */ (season.id)]?.deluxe && own) {   // the Deluxe's own three, shown
          const row = el('div', 'sh-seasonown');
          for (const g of own.grants) row.append(rewardChip(g));
          ban.append(row);
        }
        ban.append(el('div', 'sh-seasondays', `${dayText(season.fromMs)} - ${dayText(season.toMs - 1)}`));
      }
      if (season) ban.append(el('div', 'sh-seasoncap', PASS_SEASON_TEXT[/** @type {keyof typeof PASS_SEASON_TEXT} */ (season.id)]?.() ?? season.id));
      stage.append(ban);
    }
    return stage;
  };
  /** A ware's tags: its tier, the account line, a pre-alpha ware's mark, a season's, a featured window's. */
  const tagsOf = (/** @type {any} */ w) => {
    const tags = el('ul', 'sh-tags');
    if (w.tier) tags.append(el('li', `sh-tag sh-tier sh-tier-${w.tier}`, SHOP_TIER_TEXT[/** @type {keyof typeof SHOP_TIER_TEXT} */ (w.tier)]()));
    if (w.preAlpha) tags.append(el('li', 'sh-tag sh-tag-pre', t('shop.tag.preAlpha', 'Pre-alpha only')));
    if (w.season) tags.append(el('li', 'sh-tag sh-tag-season', t('shop.tag.season', 'Season One')));
    tags.append(el('li', 'sh-tag', t('shop.tag.account', 'Every character on your account')));
    return tags;   // a featured window's tag is drawPanel's, as the card moves
  };
  /** A ware's panel: its stage, its words, its contents (a bundle's), its price and its press. */
  const panelOf = (/** @type {any} */ w, slide = false) => {
    const panel = el('article', slide ? 'sh-panel sh-slide' : `sh-panel sh-panel-${w.kind}${w.tier ? ` sh-tierpanel-${w.tier}` : ''}`);
    panel.setAttribute('data-ware', w.id);
    const info = el('div', 'sh-info');
    const nameline = el('div', 'sh-nameline');
    nameline.append(el('h4', 'sh-name', shopWareName(w)), el('span', 'sh-kind', kindText(w)));
    const look = el('p', 'sh-look', SHOP_LOOK[/** @type {keyof typeof SHOP_LOOK} */ (w.id)]?.() ?? '');
    // AUDIT-STOREFRONT S9: the featured window's tag and its days left, drawn by drawPanel while the ware is sold in it
    const tags = tagsOf(w), wintag = el('li', 'sh-tag'), until = el('p', 'sh-until');
    tags.append(wintag);
    info.append(nameline, tags, look, until);
    /** @type {HTMLElement|null} */ let contents = null;
    if (w.kind === 'bundle') {   // STOREFRONT: what it gives, each held one marked, and its worth alone
      contents = el('ul', 'sh-contents');
      info.append(contents, el('p', 'sh-worth', t('shop.bundle.worth', 'Worth {price} bought alone.', { price: shopPriceText(shopWorth(w.id), intlLocale()) })));
    }
    const buyrow = el('div', 'sh-buyrow');
    const price = el('span', 'sh-price', '');
    const was = el('s', 'sh-was', '');
    const state = el('span', 'sh-state');
    buyrow.append(was, price, state);
    info.append(buyrow);
    panel.append(stageOf(w, slide), info);
    return { panel, parts: { buyrow, state, price, was, contents, wintag, until, untilKey: '', act: /** @type {any} */ (null), actKey: '', contentsKey: '' } };
  };

  // ── THE BATTLE PASS'S SECTION ──
  /** The season's banner, the account's progress, the track, the open stage's challenges - over the passes' panels. */
  const passSection = () => {
    const season = passSeasonById(f()?.pass?.season) ?? PASS_SEASONS.find((s) => now() < s.toMs) ?? PASS_SEASONS[PASS_SEASONS.length - 1];
    const card = f()?.pass?.season === season.id ? f().pass : null, nowMs = now();
    const box = el('section', 'sh-pass');
    const hero = el('div', 'sh-passhero');
    hero.append(el('h4', 'sh-passname', PASS_SEASON_TEXT[/** @type {keyof typeof PASS_SEASON_TEXT} */ (season.id)]?.() ?? season.id), el('p', 'sh-passlook', PASS_SEASON_LOOK[/** @type {keyof typeof PASS_SEASON_LOOK} */ (season.id)]?.() ?? ''));
    const stages = el('ol', 'sh-stages');
    season.stages.forEach((st, i) => {
      const state = nowMs >= st.toMs ? 'done' : nowMs >= st.fromMs ? 'open' : 'soon';
      const li = el('li', `sh-stagechip sh-stage-${state}`);
      li.append(el('span', 'sh-stagenum', ['I', 'II', 'III'][i] ?? String(i + 1)), el('span', 'sh-stagename', PASS_STAGE_TEXT[/** @type {keyof typeof PASS_STAGE_TEXT} */ (st.key)]?.() ?? st.key),
        el('span', 'sh-stagewhen', state === 'soon' ? t('shop.pass.opens', 'Opens {day}', { day: dayText(st.fromMs) }) : t('shop.pass.levels', 'Levels to {n}', { n: st.top })));
      stages.append(li);
    });
    hero.append(stages);
    box.append(hero);
    if (card) {   // the account's level, its experience to the next, today's, its booster
      const prog = el('div', 'sh-passprog');
      const into = card.level >= PASS_LEVELS ? PASS_XP_PER_LEVEL : card.xp - card.level * PASS_XP_PER_LEVEL;
      const banked = Math.floor(card.xp / PASS_XP_PER_LEVEL) > card.level && card.level >= card.top;
      const bar = el('div', 'sh-xpbar');
      const fill = el('div', 'sh-xpfill');
      fill.style.width = `${Math.round(Math.max(0, Math.min(1, into / PASS_XP_PER_LEVEL)) * 100)}%`;
      bar.append(fill);
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(PASS_XP_PER_LEVEL)); bar.setAttribute('aria-valuenow', String(Math.min(PASS_XP_PER_LEVEL, into)));
      bar.setAttribute('aria-label', t('shop.pass.toNext', 'Experience to the next level'));
      prog.append(el('div', 'sh-passlevel', t('shop.pass.level', 'Level {n} of {max}', { n: card.level, max: PASS_LEVELS })), bar,
        el('p', 'sh-passline', `${t('shop.pass.today', 'Today: {xp} of {max} experience.', { xp: card.today.toLocaleString(), max: card.dayMax.toLocaleString() })}${card.mult > 1 ? ` ${t('shop.pass.boosted', 'Your booster adds {pct}%.', { pct: Math.round((card.mult - 1) * 100) })}` : ''}${banked ? ` ${t('shop.pass.banked', 'Experience past this stage is kept for the next.')}` : ''}`));
      box.append(prog);
    } else box.append(el('p', 'sh-passline', t('shop.pass.signIn', 'Sign in with a username to play the pass. The free track is every account\'s.')));
    // THE TRACK: a column a level with a reward, the free row over the premium; reached lit, the premium locked without it
    const track = el('div', 'sh-track');
    track.setAttribute('role', 'list');
    track.setAttribute('aria-label', t('shop.pass.track', 'The track'));
    const rewards = PASS_REWARDS[/** @type {keyof typeof PASS_REWARDS} */ (season.id)] ?? [];
    for (const level of [...new Set(rewards.map((r) => r.level))]) {
      const col = el('div', `sh-trackcol${card && card.level >= level ? ' sh-reached' : ''}`);
      col.setAttribute('role', 'listitem');
      col.append(el('span', 'sh-tracklevel', String(level)));
      for (const track2 of ['free', 'premium']) {
        const cell = el('div', `sh-trackcell sh-track-${track2}${track2 === 'premium' && !card?.tracks?.premium ? ' sh-locked' : ''}`);
        for (const r of rewards.filter((x) => x.level === level && x.track === track2)) cell.append(rewardChip(r.grant));
        col.append(cell);
      }
      track.append(col);
    }
    const legend = el('div', 'sh-tracklegend');
    legend.append(el('span', 'sh-legend-free', t('shop.pass.free', 'Free')), el('span', 'sh-legend-premium', t('shop.pass.premium', 'Premium')));
    box.append(legend, track);
    const deluxe = PASS_DELUXE[/** @type {keyof typeof PASS_DELUXE} */ (season.id)];
    if (deluxe) {
      const d = el('div', 'sh-deluxe');
      d.append(el('span', 'sh-deluxehead', t('shop.pass.deluxeOwn', 'The Deluxe Pass\'s own, given at once:')));
      for (const g of deluxe.grants) d.append(rewardChip(g));
      box.append(d);
    }
    // THE OPEN STAGE'S CHALLENGES: each its count, its experience, paid once
    const st = card ? card.stage : season.stages.findIndex((s) => nowMs >= s.fromMs && nowMs < s.toMs);
    if (st >= 0) {
      const list = el('ul', 'sh-challenges');
      list.setAttribute('aria-label', t('shop.pass.challenges', 'This stage\'s challenges'));
      for (const c of PASS_CHALLENGES.filter((x) => x.stage === st)) {
        const got = card?.challenges?.find((/** @type {any} */ x) => x.key === c.key);
        const li = el('li', `sh-challenge${got?.paid ? ' sh-paid' : ''}`);
        const meter = el('div', 'sh-cmeter');
        const fill = el('div', 'sh-cfill');
        fill.style.width = `${Math.round(Math.min(1, (got?.n ?? 0) / c.n) * 100)}%`;
        meter.append(fill);
        li.append(el('span', 'sh-cwhat', passChallengeText(c.key)), meter, el('span', 'sh-ccount', `${(got?.n ?? 0).toLocaleString()} / ${c.n.toLocaleString()}`), el('span', 'sh-cxp', t('shop.pass.xp', '+{xp} experience', { xp: c.xp.toLocaleString() })));
        list.append(li);
      }
      box.append(el('h5', 'sh-subhead', t('shop.pass.challenges', 'This stage\'s challenges')), list);
    }
    const boosters = button('sh-toboosts', t('shop.pass.toBoosts', 'Pass Boosters'), () => pick('boosts'));
    box.append(boosters);
    return box;
  };
  /** A reward's chip: its picture where it has one (AUDIT-STOREFRONT: every kind but a title - wareArtNode), its name and kind. */
  function rewardChip(/** @type {string} */ grant) {
    const i = grant.indexOf(':'), kind = grant.slice(0, i), key = grant.slice(i + 1);
    const chip = el('span', `sh-reward sh-reward-${kind} fx-${kind}-${key}`);
    const art = wareArtNode(doc, grant, 28, 'sh-rewardart');
    if (art) chip.append(art);
    const word = el('span', 'sh-rewardname', passGrantName(grant));
    if (kind === 'title') paintTitle(word, titleBadge({ title: key }), false);
    chip.append(word, el('span', 'sh-rewardkind', passGrantKind(grant)));
    return chip;
  }

  /** The pass section drawn, and the card it was drawn from - drawn again when the account read brings another. */
  let passNode = /** @type {HTMLElement|null} */ (null), passKey = '';
  const buildPanels = () => {
    stopLive();
    drawn = new Map();
    names = [];
    panels.textContent = '';
    panels.setAttribute('aria-labelledby', `sh-tab-${cat}`);
    passNode = null;
    if (cat === 'pass') { passNode = passSection(); passKey = JSON.stringify(f()?.pass ?? null); panels.append(passNode); }
    for (const w of SHOP_WARES.filter((x) => x.category === cat && x.alone && (!f()?.shop || !!rowOf(f(), x.id)))) {
      const { panel, parts } = panelOf(w);
      panels.append(panel);
      drawn.set(w.id, parts);
    }
  };
  const buildTabs = () => {
    tabs.textContent = '';
    tabOf.clear();
    for (const c of shopSections(f())) {
      const n = SHOP_WARES.filter((w) => w.category === c && w.alone && (!f()?.shop || !!rowOf(f(), w.id))).length;
      const tb = button('sh-tab', '', () => pick(c));
      tb.id = `sh-tab-${c}`;
      tb.setAttribute('role', 'tab');
      tb.append(el('span', 'sh-tabname', SHOP_CATEGORY_TEXT[/** @type {keyof typeof SHOP_CATEGORY_TEXT} */ (c)]()), el('span', 'sh-tabcount', String(n)));
      tabs.append(tb);
      tabOf.set(c, tb);
    }
  };
  const pick = (/** @type {string} */ c) => {
    if (c === cat) return;
    cat = c; keep.cat = c;
    buildPanels();
    draw();
    tabOf.get(c)?.focus?.();
  };

  // ── THE CAROUSEL'S CLOCK ──
  let slides = /** @type {any[]} */ ([]), at = Math.max(0, keep.slide | 0), paused = false, hovered = false, focusedIn = false, slideAt = now();
  /** @type {any} */ let slideParts = null;
  let slidesKey = '';
  /** The slide `at` built - its live stage the only one of the carousel's running. */
  const showSlide = () => {
    stopSlide();
    slideHost.textContent = '';
    slideParts = null;
    const w = slides[at];
    if (!w) return;
    const { panel, parts } = panelOf(w, true);
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-roledescription', t('shop.carousel.slide', 'slide'));
    panel.setAttribute('aria-label', t('shop.carousel.of', '{n} of {m}', { n: at + 1, m: slides.length }));
    if (!reduced) panel.classList?.toggle('sh-slidein', true);
    slideHost.append(panel);
    slideParts = { w, parts };
    keep.slide = at;
    slideAt = now();
    drawPanel(w, parts, f());   // its price, its state and its press at once - never waiting for the flow's next change
  };
  /** The dots, a button a slide, the one shown pressed. */
  const buildDots = () => {
    dots.textContent = '';
    slides.forEach((w, i) => {
      const d = button('sh-cdot', '', () => { at = i; heard = w.id; showSlide(); carouselState(); });
      d.setAttribute('aria-label', shopWareName(w));
      dots.append(d);
    });
  };
  /** A step through the slides, `by` one either way; `chosen` the player's, whose effect is then heard. */
  function turn(/** @type {number} */ by, chosen = false) {
    if (slides.length < 2) return;
    at = (at + by + slides.length) % slides.length;
    if (chosen) heard = slides[at].id;
    showSlide();
    carouselState();
  }
  /** The controls' words and the dots' pressed state; the carousel hidden with no slide. */
  function carouselState() {
    const any = slides.length > 0;
    carousel.classList?.toggle('sh-empty', !any);
    carousel.setAttribute('aria-hidden', any ? 'false' : 'true');
    const rolling = !paused && !reduced && slides.length > 1;
    pauseB.textContent = paused || reduced ? t('shop.carousel.play', 'Play') : t('shop.carousel.pause', 'Pause');
    pauseB.setAttribute('aria-label', rolling ? t('shop.carousel.stop', 'Stop turning the featured items') : t('shop.carousel.start', 'Turn the featured items'));
    pauseB.disabled = reduced || slides.length < 2;
    slideHost.setAttribute('aria-live', rolling ? 'off' : 'polite');
    Array.from(/** @type {any} */ (dots.children) ?? []).forEach((/** @type {any} */ d, /** @type {number} */ i) => d.setAttribute('aria-pressed', i === at ? 'true' : 'false'));
    for (const b of [prevB, nextB]) b.disabled = slides.length < 2;
  }
  carousel.addEventListener?.('pointerenter', () => { hovered = true; });
  carousel.addEventListener?.('pointerleave', () => { hovered = false; slideAt = now(); });
  carousel.addEventListener?.('focusin', () => { focusedIn = true; });
  carousel.addEventListener?.('focusout', () => { focusedIn = false; slideAt = now(); });
  carousel.addEventListener?.('keydown', (/** @type {KeyboardEvent} */ e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault?.(); e.stopPropagation?.();
    turn(e.key === 'ArrowRight' ? 1 : -1, true);
  });
  let downX = /** @type {number|null} */ (null);
  slideHost.addEventListener?.('pointerdown', (/** @type {PointerEvent} */ e) => { downX = e.clientX; });
  slideHost.addEventListener?.('pointerup', (/** @type {PointerEvent} */ e) => {
    if (downX == null) return;
    const dx = e.clientX - downX;
    downX = null;
    if (Math.abs(dx) >= 40) turn(dx < 0 ? 1 : -1, true);   // a swipe
  });
  // the clock asks twice a second; a window taken off the page without its stop lets it go after a minute away, and it
  // never holds a process open (Node's timers)
  let away = 0, day = Math.floor(now() / 86_400_000);
  const clock = globalThis.setInterval?.(() => {
    if (!win.isConnected) { if (++away > 120) stopClock(); return; }
    away = 0;
    if (carouselTurns({ n: slides.length, paused, reduced, hovered, focusedIn, since: slideAt }, now())) turn(1);
    if (Math.floor(now() / 86_400_000) !== day) { day = Math.floor(now() / 86_400_000); draw(); }   // AUDIT-STOREFRONT S9: a UTC midnight moves every "days left"
  }, 500);
  /** @type {any} */ (clock)?.unref?.();
  function stopClock() { if (clock != null) globalThis.clearInterval?.(clock); }

  /** A held ware's press: wear it, or take it off (a glyph shown or hidden) - the flow's own, as the account card's. */
  const wear = (/** @type {any} */ w) => {
    const fl = f();
    if (!fl || fl.busy) return;
    if (w.kind === 'title') fl.equip?.(w.key);
    else if (w.kind === 'aura') fl.wearAura?.(w.key);
    else if (w.kind === 'armory' && setOf(w)) fl.wearArmoryKit?.(shopWorn(fl, w) ? null : armoryLineKit(setOf(w)));   // ARMORY: a set, all its pieces at once
    else if (w.kind === 'armory') fl.wearArmory?.(armoryPieceOf(w.key)?.slot, w.key);   // ARMORY: in its slot
    else if (w.kind === 'kill' || w.kind === 'portal' || w.kind === 'mount') fl.wearEffect?.(w.kind, w.key);   // STOREFRONT: in its slot
    else fl.toggleGlyph?.(w.key);
  };
  const actFor = (/** @type {any} */ w, /** @type {any} */ st) => {
    if (st.state === 'held' && wearable(w)) {
      const words = w.kind === 'glyph' ? (st.worn ? t('shop.hide', 'Hide') : t('shop.show', 'Show')) : (st.worn ? t('shop.takeOff', 'Take off') : t('shop.wear', 'Wear'));
      const b = button('sh-wear', words, () => wear(w));
      if (f()?.busy) b.setAttribute('aria-disabled', 'true');
      return b;
    }
    if (st.state === 'buy') {
      const a = /** @type {HTMLAnchorElement} */ (el('a', 'act sh-buy', t('shop.buy', 'Buy')));
      a.href = st.buy; a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('aria-label', t('shop.buyLabel', 'Buy {name} for {price}', { name: shopWareName(w), price: shopPriceText(st.cents, intlLocale()) }));
      a.addEventListener('click', () => f()?.shopOpened?.(w.id));
      return a;
    }
    return null;
  };
  const STATE_TEXT = Object.freeze({
    held: () => t('shop.state.held', 'Owned'),
    spent: () => t('shop.state.spent', 'A stronger booster is yours'),   // AUDIT-STOREFRONT S5
    gone: () => t('shop.state.gone', 'No longer sold'),
    soon: () => t('shop.state.soon', 'On sale when the season opens'),
    closed: () => t('shop.state.closed', 'Not on sale yet'),
    guest: () => t('shop.state.guest', 'Needs a username'),
    out: () => t('shop.state.out', 'Sign in to buy'),
    reading: () => '',
    buy: () => '',
  });
  /** One panel brought up to date: its price (this account's, the list's struck through beside it), its state, its press,
   *  a bundle's contents. */
  const drawPanel = (/** @type {any} */ w, /** @type {any} */ d, /** @type {any} */ fl) => {
    const st = shopWareState(fl, w, now());
    const words = st.state === 'soon' && st.opens ? t('shop.state.opens', 'On sale from {day}', { day: dayText(st.opens) }) : STATE_TEXT[/** @type {keyof typeof STATE_TEXT} */ (st.state)]();
    if (d.state.textContent !== words) d.state.textContent = words;
    d.state.className = 'sh-state sh-state-' + st.state;
    const priceText = shopPriceText(st.cents, intlLocale()), wasText = st.cents < w.cents && st.state !== 'held' ? shopPriceText(w.cents, intlLocale()) : '';
    if (d.price.textContent !== priceText) d.price.textContent = priceText;
    if (d.was.textContent !== wasText) d.was.textContent = wasText;
    d.was.setAttribute?.('aria-label', wasText ? t('shop.was', 'Was {price}', { price: wasText }) : '');
    // AUDIT-STOREFRONT S9: a featured window told only beside its sale, its days left counted again as they pass
    const row = rowOf(fl, w.id), win = row?.until && row.sale ? row : null;
    const untilText = win ? shopUntilText(win.until, win.limited, now()) : '', uk = win ? `${win.limited ? 1 : 0}${untilText}` : '';
    if (d.untilKey !== uk) {   // empty, each is not shown (SHOP_CSS)
      d.untilKey = uk;
      d.wintag.className = win ? `sh-tag ${win.limited ? 'sh-tag-limited' : 'sh-tag-featured'}` : 'sh-tag';
      d.wintag.textContent = !win ? '' : win.limited ? t('shop.tag.limited', 'Limited') : t('shop.tag.featured', 'Featured');
      d.until.className = `sh-until${win?.limited ? ' sh-until-limited' : ''}`;
      d.until.textContent = untilText;
    }
    if (d.contents) {
      const rows = shopBundleRows(fl, w), key = rows.map((r) => (r.held ? 2 : r.part ? 1 : 0)).join('');
      if (d.contentsKey !== key) {
        d.contents.textContent = '';
        for (const r of rows) {
          const li = el('li', `sh-content${r.held ? ' sh-content-held' : r.part ? ' sh-content-part' : ''}`);
          const tag = shopWareTag(doc, r.id);
          if (tag) li.append(tag);
          li.append(el('span', 'sh-contentkind', r.kind));
          if (r.held) li.append(el('span', 'sh-contentheld', t('shop.bundle.held', 'Owned: its price is taken off')));
          else if (r.part) li.append(el('span', 'sh-contentheld', t('shop.bundle.part', 'Partly owned: its price is less')));   // AUDIT-STOREFRONT S12: a Premium inside the Deluxe
          d.contents.append(li);
        }
        d.contentsKey = key;
      }
    }
    const key = `${st.state}:${st.worn ? 1 : 0}:${st.buy ?? ''}:${fl?.busy ? 1 : 0}`;
    if (d.actKey !== key) {
      const had = d.act && doc.activeElement === d.act;
      d.act?.remove?.();
      d.act = actFor(w, st);
      d.actKey = key;
      if (d.act) { d.buyrow.append(d.act); if (had) d.act.focus?.({ preventScroll: true }); }
    }
  };
  const draw = () => {
    const fl = f();
    // the carousel's slides off the card: a new list (the card read again) begins again where it was, if it still can
    const list = shopCarouselOf(fl), lk = list.map((w) => w.id).join(',');
    if (lk !== slidesKey) { slidesKey = lk; slides = list; if (at >= slides.length) at = 0; buildDots(); showSlide(); }
    if (slideParts) drawPanel(slideParts.w, slideParts.parts, fl);
    carouselState();
    const sections = shopSections(fl);
    if (sections.join(',') !== [...tabOf.keys()].join(',')) { buildTabs(); if (!sections.includes(cat)) { cat = sections[0] ?? cat; buildPanels(); } }
    for (const w of SHOP_WARES) { const d = drawn.get(w.id); if (d) drawPanel(w, d, fl); }
    const pk = JSON.stringify(fl?.pass ?? null);
    if (passNode && pk !== passKey) { const next = passSection(); passNode.replaceWith?.(next); passNode = next; passKey = pk; }   // the season's card read: the section on it
    for (const [c, tb] of tabOf) { tb.setAttribute('aria-selected', c === cat ? 'true' : 'false'); tb.tabIndex = c === cat ? 0 : -1; tb.classList.toggle('on', c === cat); }
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
  const onFocus = () => { const fl = f(); if (win.isConnected && fl?.stage === 'in') Promise.resolve(fl.refresh?.()).catch(() => {}); };
  view?.addEventListener?.('focus', onFocus);
  if (focus) globalThis.requestAnimationFrame?.(() => tabOf.get(cat)?.focus?.({ preventScroll: true }));
  return {
    root: win,
    draw,
    close,
    stop: () => { stopLive(); stopSlide(); stopClock(); view?.removeEventListener?.('focus', onFocus); },
  };
}

/** AUDIT-STOREFRONT: THE CHARACTER'S STAGE on a ware's canvas (render/characterStage.js), as the profile's - the stand-in
 *  figure until `body` answers the player's own (ui/profileBody.js), or for good with none. */
const stageWith = (/** @type {HTMLCanvasElement} */ canvas, /** @type {any} */ o, /** @type {(() => any)|null} */ body) => import('../../render/characterStage.js').then((m) => {
  const s = m.startCharacterStage(canvas, o);
  if (s && body) Promise.resolve().then(body).then((b) => { if (b && s.alive()) s.setBody(b); }).catch(() => {});
  return s;
});
/** STOREFRONT: a kill effect's or a portal skin's stage, its module loaded on the first ask - the effect tried on the
 *  character as the profile tries one. */
export const loadEffectPreview = (/** @type {HTMLCanvasElement} */ canvas, /** @type {string} */ slot, /** @type {string} */ key, /** @type {(slot: string, key: string|null) => void} */ cue, /** @type {(() => any)|null} */ body = null) =>
  stageWith(canvas, { cue }, body).then((s) => {
    if (!s) return null;
    s.setEffect(slot, key);
    return { stop: () => s.stop(), again: () => { s.setEffect(null, null); s.setEffect(slot, key); } };
  });

/** An aura's stage, its module loaded on the first ask - worn by the character (AUDIT-STOREFRONT: the profile's stage, its
 *  body the player's), ARMORY: a weapon piece alone on the blade's (weapon glow law 7). */
export const loadAuraPreview = (/** @type {HTMLCanvasElement} */ canvas, /** @type {string|null} */ aura, /** @type {string|null} */ kit = null, /** @type {(() => any)|null} */ body = null) => (aura || !kit ? Promise.resolve(null) : import('../../systems/weaponGlow.js')).then((g) => {
  const look = g?.armoryWeaponStage(kit);
  if (g && look) return import('../../render/weaponPiecePreview.js').then((m) => m.startWeaponPiecePreview(canvas, g.glowSpec(look, g.ARMORY_LEVEL)));
  return /** @type {Promise<any>} */ (stageWith(canvas, { aura, kit }, body));
});

/** The gem, painted as the row's other marks are: twelve pixels, crisp - a cut stone in the Genesis fire's colours. */
const GEM_ROWS = Object.freeze([
  '...DDDDDD...', '..DLLHVVLD..', '.DLHHVVVVLD.', 'DGGGGGGGGGGD', 'DVLVVBVVBVLD', '.DVVBVVBVVD.',
  '..DVVBBVVD..', '...DVBBVD...', '....DVVD....', '.....DD.....',
]);
const GEM_INK = Object.freeze({ D: '#2a1580', L: '#d6b8ff', H: '#f4eeff', V: '#8f5bff', B: '#3f63ff', G: '#b593ff' });
const gemSvg = () => {
  const rects = [];
  GEM_ROWS.forEach((row, y) => [...row].forEach((ch, x) => { const ink = /** @type {any} */ (GEM_INK)[ch]; if (ink) rects.push(`<rect x='${x}' y='${y + 1}' width='1' height='1' fill='${ink.replace('#', '%23')}'/>`); }));
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
.px-shopwin .sh-stage-title { container-type: inline-size; }
.px-shopwin .sh-bigtitle { font-size: min(40px, calc(88cqw / (var(--n, 10) * 0.7))); letter-spacing: 0.06em; white-space: nowrap; }
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
/* STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md section 9): THE CAROUSEL - the featured wares a panel at a time,
   large, its controls over it; the tiers' marks; a bundle's contents; the Battle Pass's season, track and challenges. */
.px-shopwin .sh-carousel { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 2px solid rgba(214,184,255,0.55);
  background: linear-gradient(180deg, rgba(63,99,255,0.12), rgba(10,9,16,0.6)); }
.px-shopwin .sh-carousel.sh-empty { display: none; }
.px-shopwin .sh-cctrl { display: flex; align-items: center; gap: 6px; }
.px-shopwin .sh-cprev, .px-shopwin .sh-cnext { min-width: 44px; min-height: 36px; font-size: 18px; }
.px-shopwin .sh-cprev::before { content: '‹'; } .px-shopwin .sh-cnext::before { content: '›'; }
.px-shopwin .sh-cpause { min-height: 36px; padding: 0 12px; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; }
.px-shopwin .sh-cdots { display: flex; gap: 2px; flex: 1; justify-content: center; flex-wrap: wrap; }
.px-shopwin .sh-cdot { width: 24px; height: 24px; min-width: 24px; min-height: 24px; padding: 0; border: 0; border-radius: 50%; background: transparent; display: inline-flex; align-items: center; justify-content: center; }
.px-shopwin .sh-cdot::before { content: ''; width: 14px; height: 14px; box-sizing: border-box; border-radius: 50%; border: 2px solid #d6b8ff; }
.px-shopwin .sh-cdot[aria-pressed="true"]::before { background: #d6b8ff; }
.px-shopwin .sh-cslides { touch-action: pan-y; }
.px-shopwin .sh-slide { border-color: rgba(214,184,255,0.8); }
.px-shopwin .sh-slide .sh-stage { min-height: 300px; }
.px-shopwin .sh-slidein { animation: sh-slidein 360ms ease-out; }
@keyframes sh-slidein { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: none; } }
.px-shopwin .sh-until { margin: 0; font-size: 12.5px; color: #ffd27a; }
.px-shopwin .sh-until:empty, .px-shopwin .sh-tag:empty { display: none; }
.px-shopwin .sh-until-limited { color: #ff9a7a; font-weight: bold; }
.px-shopwin .sh-tier { font-weight: bold; letter-spacing: 0.14em; text-transform: uppercase; }
.px-shopwin .sh-tier-standard { color: #b8d8ff; border-color: rgba(120,170,255,0.7); }
.px-shopwin .sh-tier-premium { color: #e0b8ff; border-color: rgba(190,120,255,0.8); }
.px-shopwin .sh-tier-exclusive { color: #ffd27a; border-color: rgba(255,190,80,0.9); background: rgba(255,190,80,0.08); }
.px-shopwin .sh-tag-season { color: #9fdcff; border-color: rgba(90,190,255,0.7); }
.px-shopwin .sh-tag-featured { color: #ffd27a; border-color: rgba(255,210,122,0.7); }
.px-shopwin .sh-tag-limited { color: #ffb08f; border-color: rgba(255,120,90,0.85); font-weight: bold; }
.px-shopwin .sh-tierpanel-exclusive { border-color: rgba(255,190,80,0.6); box-shadow: inset 0 0 0 1px rgba(255,190,80,0.18); }
.px-shopwin .sh-tierpanel-premium { border-color: rgba(190,120,255,0.6); }
.px-shopwin .sh-was { font-size: 15px; color: var(--dim); }
.px-shopwin .sh-was:empty { display: none; }
.px-shopwin .sh-state-soon { color: #9fdcff; }
.px-shopwin .sh-stage-mount canvas.mountpreview { width: min(100%, 330px); height: auto; image-rendering: pixelated; }
.px-shopwin .sh-stage-kill, .px-shopwin .sh-stage-portal { min-height: 300px; }
.px-shopwin .sh-bundlemark { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #ffd27a; }
.px-shopwin .sh-bundleart { list-style: none; margin: 0; padding: 2px 12px 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; width: 100%; max-width: 440px; box-sizing: border-box; }
.px-shopwin .sh-bundle-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.px-shopwin .sh-bpiece { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 5px; padding: 10px 6px 9px; text-align: center; min-width: 0;
  background: radial-gradient(circle at 50% 34%, rgba(214,184,255,0.16), rgba(10,9,16,0) 70%), rgba(255,255,255,0.025); border: 1px solid rgba(214,184,255,0.18); border-radius: 6px; }
.px-shopwin .sh-bpic { min-height: 64px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.65)); }
.px-shopwin .sh-bpic .sh-bart { width: 64px; max-width: 100%; }
.px-shopwin .sh-bpiece-title { container-type: inline-size; }
.px-shopwin .sh-bpiece-title .sh-bname { font-size: min(13px, calc(84cqw / (var(--n, 10) * 0.7))); white-space: nowrap; padding: 1px 5px; }
.px-shopwin .sh-bname { font-size: 13px; line-height: 1.15; color: #f1ead8; overflow-wrap: anywhere; }
.px-shopwin .sh-bkind { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); }
.px-shopwin .sh-contents { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 13.5px; }
.px-shopwin .sh-content { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; padding: 4px 8px; border-left: 2px solid rgba(214,184,255,0.45); }
.px-shopwin .sh-content-held { border-left-color: #9fe8b4; }
.px-shopwin .sh-content-part { border-left-color: #c9e89f; }
.px-shopwin .sh-contentkind { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); }
.px-shopwin .sh-contentheld { font-size: 11.5px; color: #9fe8b4; }
.px-shopwin .sh-worth { margin: 0; font-size: 12.5px; color: #e2dccd; }
.px-shopwin .sh-stage-pass, .px-shopwin .sh-stage-boost { justify-content: stretch; }
.px-shopwin .sh-seasonart { position: relative; flex: 1; align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 18px 16px; box-sizing: border-box;
  background: radial-gradient(circle at 50% 36%, rgba(90,190,255,0.32), rgba(10,9,16,0) 60%), linear-gradient(160deg, #3a2a12, #0d0a05); }
.px-shopwin .sh-seasonart-s1premium { background: radial-gradient(circle at 50% 36%, rgba(90,190,255,0.34), rgba(10,9,16,0) 60%), linear-gradient(160deg, #1f3a4a, #0a1016); }
.px-shopwin .sh-seasonart-s1deluxe { background: repeating-conic-gradient(from 0deg at 50% 36%, rgba(255,226,140,0.09) 0 6deg, rgba(0,0,0,0) 6deg 18deg),
  radial-gradient(circle at 50% 36%, rgba(255,210,122,0.38), rgba(10,9,16,0) 60%), linear-gradient(160deg, #4a3612, #120d06); }
.px-shopwin .sh-seasonhalo { position: relative; width: 132px; height: 132px; display: grid; place-items: center; }
.px-shopwin .sh-seasonhalo::before { content: ''; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, rgba(90,190,255,0.32), rgba(90,190,255,0) 66%); }
.px-shopwin .sh-seasonhalo::after { content: ''; position: absolute; inset: 2px; border-radius: 50%; border: 1px dashed rgba(243,215,138,0.5); animation: sh-cog 30s linear infinite; }
.px-shopwin .sh-seasonart-s1deluxe .sh-seasonhalo::before { background: radial-gradient(circle, rgba(255,210,122,0.45), rgba(255,210,122,0) 66%); }
.px-shopwin .sh-seasonpic { position: relative; width: 112px; height: 112px; filter: drop-shadow(0 6px 14px rgba(0,0,0,0.75)); }
.px-shopwin .sh-seasonart-s1cog .sh-seasonpic { animation: sh-cog 16s linear infinite; }
.px-shopwin .sh-seasonart-s1tonal .sh-seasonhalo::before { animation: sh-ring 2.6s ease-out infinite; }
.px-shopwin .sh-seasonart-s1heart .sh-seasonpic { animation: sh-beat 1.7s ease-in-out infinite; }
@keyframes sh-ring { 0% { transform: scale(0.7); opacity: 1; } 100% { transform: scale(1.18); opacity: 0; } }
@keyframes sh-beat { 0%, 40%, 100% { transform: scale(1); } 15% { transform: scale(1.07); } 28% { transform: scale(1.03); } }
.px-shopwin .sh-seasonown { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; width: 100%; max-width: 340px; margin: 4px 0; }
.px-shopwin .sh-seasonown .sh-reward { align-items: center; text-align: center; gap: 3px; font-size: 11.5px; line-height: 1.15; }
.px-shopwin .sh-seasonown .sh-rewardart { width: 36px; height: 36px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6)); }
.px-shopwin .sh-seasonown .sh-reward-title .sh-rewardname { font-size: 10.5px; padding: 1px 4px; }
.px-shopwin .sh-seasonown .sh-rewardkind { display: none; }
.px-shopwin .sh-seasoncap { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #c9a55a; }
@keyframes sh-cog { to { transform: rotate(360deg); } }
.px-shopwin .sh-seasonname { font-size: 22px; letter-spacing: 0.06em; color: #ffe2a8; text-shadow: 0 0 10px rgba(255,190,80,0.5); text-align: center; line-height: 1.15; }
.px-shopwin .sh-seasondays { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9fdcff; }
.px-shopwin .sh-boostmult { font-size: 34px; color: #9fdcff; text-shadow: 0 0 12px rgba(90,190,255,0.7); font-variant-numeric: tabular-nums; }
.px-shopwin .sh-pass { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid rgba(255,190,80,0.5);
  background: linear-gradient(170deg, rgba(58,42,18,0.85), rgba(10,9,16,0.95)); }
.px-shopwin .sh-passname { margin: 0; font-size: 24px; color: #ffe2a8; letter-spacing: 0.06em; }
.px-shopwin .sh-passlook { margin: 2px 0 0; font-size: 13.5px; color: #e2dccd; }
.px-shopwin .sh-stages { list-style: none; margin: 8px 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.px-shopwin .sh-stagechip { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border: 1px solid rgba(200,154,74,0.45); font-size: 12px; color: #e2dccd; }
.px-shopwin .sh-stage-open { border-color: #9fdcff; box-shadow: inset 0 0 0 1px rgba(90,190,255,0.45); }
.px-shopwin .sh-stage-done { opacity: 0.6; }
.px-shopwin .sh-stagenum { font-size: 11px; letter-spacing: 0.18em; color: #c89a4a; }
.px-shopwin .sh-stagename { font-size: 13.5px; color: #ffe2a8; }
.px-shopwin .sh-stagewhen { color: var(--dim); }
.px-shopwin .sh-passprog { display: flex; flex-direction: column; gap: 5px; }
.px-shopwin .sh-passlevel { font-size: 16px; color: #fff4e0; }
.px-shopwin .sh-xpbar, .px-shopwin .sh-cmeter { height: 10px; border: 1px solid rgba(200,154,74,0.7); background: rgba(0,0,0,0.5); }
.px-shopwin .sh-xpfill, .px-shopwin .sh-cfill { height: 100%; background: linear-gradient(90deg, #c89a4a, #9fdcff); }
.px-shopwin .sh-passline { margin: 0; font-size: 12.5px; color: #e2dccd; }
.px-shopwin .sh-tracklegend { display: flex; gap: 14px; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
.px-shopwin .sh-legend-free { color: #e2dccd; } .px-shopwin .sh-legend-premium { color: #ffd27a; }
.px-shopwin .sh-track { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 6px; scroll-snap-type: x proximity; }
.px-shopwin .sh-trackcol { flex: 0 0 132px; display: flex; flex-direction: column; gap: 4px; scroll-snap-align: start; }
.px-shopwin .sh-tracklevel { text-align: center; font-size: 13px; color: var(--dim); border-bottom: 1px solid rgba(200,154,74,0.4); }
.px-shopwin .sh-reached .sh-tracklevel { color: #9fdcff; border-bottom-color: #9fdcff; }
.px-shopwin .sh-trackcell { min-height: 56px; display: flex; flex-direction: column; gap: 4px; padding: 4px; border: 1px solid rgba(226,220,205,0.18); }
.px-shopwin .sh-track-premium { border-color: rgba(255,190,80,0.4); background: rgba(255,190,80,0.05); }
.px-shopwin .sh-locked { opacity: 0.55; }
.px-shopwin .sh-reward { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; font-size: 12.5px; color: #f4eeff; }
.px-shopwin .sh-rewardart { width: 28px; height: 28px; }
.px-shopwin .sh-rewardkind { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); }
.px-shopwin .sh-deluxe { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; font-size: 12.5px; color: #ffd27a; }
.px-shopwin .sh-deluxehead { flex-basis: 100%; }
.px-shopwin .sh-deluxe .sh-reward { flex: 1 1 150px; flex-direction: row; align-items: center; gap: 8px; }
.px-shopwin .sh-subhead { margin: 4px 0 0; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #c89a4a; }
.px-shopwin .sh-challenges { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.px-shopwin .sh-challenge { display: grid; grid-template-columns: minmax(0, 1fr) 120px auto auto; align-items: center; gap: 4px 10px; font-size: 13px; color: #e2dccd; }
.px-shopwin .sh-paid { color: #9fe8b4; }
.px-shopwin .sh-ccount { font-variant-numeric: tabular-nums; color: var(--dim); }
.px-shopwin .sh-cxp { font-size: 12px; color: #ffd27a; }
.px-shopwin .sh-toboosts { align-self: flex-start; min-height: 40px; padding: 0 14px; }
@media (max-width: 640px) {
  .px-shopwin .sh-challenge { grid-template-columns: 1fr auto; }
  .px-shopwin .sh-cmeter { grid-column: 1 / -1; }
  .px-shopwin .sh-stages { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { .px-shopwin .sh-slidein, .px-shopwin .sh-seasonpic, .px-shopwin .sh-seasonhalo::before, .px-shopwin .sh-seasonhalo::after { animation: none; } }
.sh-waretag { display: inline-flex; align-items: center; gap: .35em; }
.sh-waretag-glyph { width: 1.2em; height: 1.2em; }
.px-shopwin .sh-terms { color: #d6b8ff; }
@media (max-width: 640px) {
  .px-shopwin .sh-panel { grid-template-columns: 1fr; }
  .px-shopwin .sh-stage { min-height: 200px; }
  .px-shopwin .sh-stage-aura, .px-shopwin .sh-stage-armory { min-height: 260px; }
  .px-shopwin .sh-bigtitle { font-size: min(30px, calc(88cqw / (var(--n, 10) * 0.7))); }
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
