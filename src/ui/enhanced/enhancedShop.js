// @ts-check
// SHOP (2026-10-28, the owner: "A new glyph panel alongside the timer and mailbox that will be used for our monetization
// shop. This needs to be detailed and panel based when open showing the purchasable items organized in categories with a
// strict disclaimer that all proceeds go towards development costs"; bible/06-Systems/Shop.md): THE SHOP. A gem at the
// end of the pause face's row of marks opens a window in the pause window's frame: the proceeds' disclaimer first, then
// STOREFRONT's carousel of the featured wares (2026-10-29, the owner: "a rotating panel carousel with limited featured
// items"; bible/06-Systems/Storefront.md section 9), then a tab a section and in each a panel a ware - seen live - its
// tier, the price it costs this account, and Buy, which opens Stripe's page. PASS-PANELS: the Folios (enhancedPass.js).
import { SHOP_WARES, SHOP_CATEGORIES, SHOP_TIERS, shopPriceText, shopWareById, shopWorth, shopClosure, shopRepeatable } from '../../net/shopLaw.js';
import { TERMS_URL } from '../../net/legalLaw.js';
import { titleBadge, paintTitle, glyphBadges, glyphSvgNode, TITLE_TEXT, AURA_TEXT, AURA_PAINT } from '../playerBadge.js';
import { GLYPH_LABEL } from './enhancedAccount.js';
import { t, intlLocale } from '../../systems/textManager.js';
import { armoryPieceOf, armoryKitPieces, armoryKitOf, armoryLineKit, armoryWarePieces, ARMORY_SETS } from '../../net/armoryLaw.js';   // ARMORY: the Aura Armory's pieces, sold in a section of their own
import { ARMORY_LOOK, ARMORY_SET_LOOK, armoryPieceName, armorySlotName } from '../armoryText.js';
import { effectWorn } from '../../net/effectLaw.js';   // STOREFRONT: the effects worn
import { effectName, effectLook, effectSlotName } from '../effectText.js';
import { profileIconNode, ICON_TEXT } from '../profileIcons.js';
import { wareArtNode } from '../wareArt.js';   // AUDIT-STOREFRONT: a piece's, a reward's and a banner's picture
import { mountPreview } from '../mountPreview.js';
import { playPreviewSound } from '../effectPreviewSound.js';
import { passSection, passItemsIn, passShownSeason, PASS_CSS } from './enhancedPass.js';   // PASS-PANELS: the Folios' section
import { AURUM_DEEDS, aurumBonusOf } from '../../net/aurumLaw.js';   // AURUM: the packs and the week's deeds
import { aurumArtNode } from '../aurumArt.js';
import { sharedClockOn, worldMinutes } from '../../systems/worldTick.js';   // AUDIT-STOREFRONT III B8: the shared clock's now
import { wallMsForClassicMinutes } from '../../net/wire.js';

/** Each section's tab, in the player's language. */
export const SHOP_CATEGORY_TEXT = Object.freeze({
  pass: () => t('shop.cat.folios', 'Folios'),   // PASS-PANELS: the owner's "something more lore accurate"
  kills: () => t('shop.cat.kills', 'Kill Effects'),
  portals: () => t('shop.cat.portals', 'Portal Skins'),
  mounts: () => t('shop.cat.mounts', 'Mounts'),
  names: () => t('shop.cat.names', 'Name Visuals'),
  auras: () => t('shop.cat.auras', 'Auras'),
  armory: () => t('shop.cat.armory', 'Aura Armory'),
  bundles: () => t('shop.cat.bundles', 'Bundles'),
  daily: () => t('shop.cat.deals', 'Daily Deals'),   // AURUM; AURUM-ONLY: the day's deals
  icons: () => t('shop.cat.icons', 'Profile Icons'),
  aurum: () => t('shop.cat.aurum', 'Aurum'),
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
  bundle: () => t('shop.kind.bundle', 'Bundle'),
  icon: () => t('shop.kind.icon', 'Profile icon'), aurum: () => t('shop.kind.aurum', 'Aurum pack'),   // AURUM
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
  'aura:dominion': () => t('shop.look.dominion', 'A ring of Daedric script burns black and crimson at your feet, embers rising off it. It comes in three bundles.'),
  'bundle:daedricchampion': () => t('shop.look.daedricchampion', 'Daedric Dominion, the Daedric Pyre, Eternal Champion and the Oblivion Sigil, together.'),
  'bundle:portalmaster': () => t('shop.look.portalmaster', 'The Daedric Stone, Daedric Dominion and the Gate Sigil, together.'),
  'bundle:lordofoblivion': () => t('shop.look.lordofoblivion', 'The Daedric Warhorse, the Daedric Stone, Daedric Dominion and the Daedric Pyre, together.'),
  // AURUM (bible/06-Systems/Aurum.md): the daily wares' icons, and the packs
  'icon:gatefire': () => t('shop.look.gatefire', 'Dagon\'s Breach between black spires, its fire turning, embers rising. It moves.'),
  'icon:aurbis': () => t('shop.look.aurbis', 'The wheel of the heavens about Aetherius, its spheres turning in their orbits. It moves.'),
  'icon:elderscroll': () => t('shop.look.elderscroll', 'An Elder Scroll open between gilded rollers, its script lit line by line. It moves.'),
  'icon:azurastar': () => t('shop.look.azurastar', "Azura's Star turning slowly in the dusk, its heart of light pulsing. It moves."),
  'icon:redmountain': () => t('shop.look.redmountain', 'Red Mountain under its ash, lava running down its flanks, smoke rising. It moves.'),
  'icon:hourglass': () => t('shop.look.hourglass', 'A gilded hourglass that turns over when its last grain falls. It moves.'),
  'icon:sanguinerose': () => t('shop.look.sanguinerose', 'A black-red rose in full bloom, dew on its petals, thorns along its stem.'),
  'icon:whitegold': () => t('shop.look.whitegold', 'The White-Gold Tower over the Imperial City and Lake Rumare at dusk.'),
  ...Object.fromEntries(SHOP_WARES.filter((w) => w.kind === 'aurum').map((w) => [w.id, () => t('shop.look.aurumAll', 'Aurum for every item in the shop and in the Folios. It has no cash value and cannot be traded.')])),
});
/** STOREFRONT: the names of the wares no other face names - the bundles'. */
const OWN_NAME = Object.freeze({
  'bundle:daedricchampion': () => t('shop.name.daedricchampion', 'Daedric Champion'),
  'bundle:portalmaster': () => t('shop.name.portalmaster', 'Portal Master'),
  'bundle:lordofoblivion': () => t('shop.name.lordofoblivion', 'Lord of Oblivion'),
});
/** A ware's name, as every face says it (the title's and the aura's English, the glyph's label, an effect's). */
export const shopWareName = (/** @type {{ id?: string, kind: string, key: string }} */ w) => {
  if (w.kind === 'title') return TITLE_TEXT[/** @type {keyof typeof TITLE_TEXT} */ (w.key)] ?? w.key;
  if (w.kind === 'icon') return ICON_TEXT[/** @type {keyof typeof ICON_TEXT} */ (w.key)] ?? w.key;   // AURUM
  if (w.kind === 'aurum') return t('shop.name.aurum', '{n, number} Aurum', { n: Number(w.key) || 0 });
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
  } else word.className = `sh-waretag-word fx-${w.kind}-${w.key}`;   // STOREFRONT: an effect, a bundle in its own colour
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
  if (w.kind === 'icon') return has(wd.icons);   // AURUM: the daily wares' icons
  return false;
}
/**
 * WHAT A WARE'S PANEL SAYS AND OFFERS, from the flow as it stands. Pure. AURUM-ONLY: a pack's `state` 'buy' (a link to
 * follow, `cents` its money price); any other ware's 'afford' (Buy, for `price` Aurum) or 'short' (`need` more), its
 * `price` this account's (a giver's share; a quarter off on its deal day, `deal`) and `list` its own. Either: 'held',
 * 'gone' (no longer sold), 'closed' (a pack while no payments are taken, a ware while Aurum is shut), 'guest', 'out'
 * (nobody signed in), 'reading'.
 * @param {any} flow @param {{ id: string, kind: string, key: string, cents: number, price: number }} ware
 */
export function shopWareState(flow, ware) {
  const row = rowOf(flow, ware.id), aurum = !shopRepeatable(ware);
  const base = aurum ? { price: row?.price ?? ware.price, list: ware.price, deal: row?.deal === true, cents: 0 } : { cents: row?.cents ?? ware.cents, price: 0, list: 0, deal: false };
  if (row?.held || (aurum && shopHeldAny(flow, ware.id))) return { state: 'held', worn: shopWorn(flow, ware), buy: null, ...base };
  if (!flow || flow.stage === 'loading') return { state: 'reading', buy: null, ...base };
  if (flow.stage !== 'in') return { state: 'out', buy: null, ...base };
  if (!flow.account?.handle) return { state: 'guest', buy: null, ...base };
  if (!flow.shop) return { state: 'closed', buy: null, ...base };
  if (row && !row.sale) return { state: 'gone', buy: null, ...base };
  if (aurum) {
    const a = flow.aurum;
    if (!row || !a?.open) return { state: 'closed', buy: null, ...base };
    return a.balance >= base.price ? { state: 'afford', buy: null, ...base } : { state: 'short', buy: null, need: base.price - a.balance, ...base };   // AUDIT AURUM-SPEND F5: a debt counts
  }
  if (!flow.shop.on || !row?.buy) return { state: 'closed', buy: null, ...base };
  return { state: 'buy', buy: row.buy, ...base };
}
/** Whether a held ware is worn: the title, the aura, a glyph not taken off, an effect in its slot. Pure. */
export function shopWorn(/** @type {any} */ flow, /** @type {{ kind: string, key: string }} */ w) {
  const wd = flow?.wardrobe;
  if (!wd) return false;
  if (w.kind === 'glyph') return Array.isArray(wd.glyphs) && wd.glyphs.includes(w.key) && !(Array.isArray(wd.glyphsOff) && wd.glyphsOff.includes(w.key));
  if (w.kind === 'armory') { const kit = armoryKitPieces(wd.armory); return armoryWarePieces(w.key).every((k) => kit[armoryPieceOf(k)?.slot ?? ''] === k); }   // ARMORY: worn in its slot - a set, every piece of it
  if (w.kind === 'kill' || w.kind === 'portal' || w.kind === 'mount') return effectWorn(wd.effects, w.kind) === w.key;   // STOREFRONT
  if (w.kind === 'title' || w.kind === 'aura' || w.kind === 'icon') return wd[w.kind] === w.key;   // AURUM: an icon in the portrait well
  return false;
}
/** Whether a ware is worn at all - a bundle and Aurum are held, never worn. Pure. */
const wearable = (/** @type {{ kind: string }} */ w) => !['bundle', 'aurum'].includes(w.kind);
/** AURUM: how long until the day's deals turn, in words. Pure. */
export function aurumTurnsText(/** @type {number} */ untilMs, /** @type {number} */ nowMs) {
  const min = Math.max(1, Math.ceil((untilMs - nowMs) / 60_000)), h = Math.floor(min / 60);
  return h ? t('shop.deals.turnsH', 'New deals in {h} h {m} min', { h, m: min % 60 }) : t('shop.deals.turnsM', 'New deals in {m} min', { m: min });
}
/** AURUM: a week's deed, as its chip says it (net/aurumLaw.js AURUM_DEEDS, a receipt each). */
const DEED_TEXT = Object.freeze({
  gate: () => t('shop.deed.gate', 'Close a Dagon\'s Breach'), eg: () => t('shop.deed.eg', 'Take an Elite Breach Redoubt'), serpent: () => t('shop.deed.serpent', 'Kill a sea serpent'),
  star: () => t('shop.deed.star', 'Hold a fallen star'), raid: () => t('shop.deed.raid', 'Defend a town'),
});
/** The line under the panels: who a purchase is for, or why nothing can be bought. Pure. */
export function shopWhoText(/** @type {any} */ flow) {
  if (!flow || flow.stage === 'loading') return t('shop.who.reading', 'Reading your account...');
  if (flow.stage !== 'in') return t('shop.who.out', 'Sign in from your profile to buy.');
  if (!flow.account?.handle) return t('shop.who.guest', 'A guest account cannot buy. Add a username from your profile first.');
  if (!flow.shop?.on && !flow.aurum?.open) return t('shop.who.closed', 'The shop does not take payments yet.');   // AURUM-ONLY: a ware is bought with Aurum
  return t('shop.who.for', 'Purchases go to the account {name}, for every character on it.', { name: flow.account.handle });
}

/** AUDIT-STOREFRONT III B8: THE SHOP'S NOW - the shared clock's wall while one stands (the finds' clock,
 *  scenes/aurumCacheHost.js), so every device says Buy or "opens on" at the same instant; the device's own offline. */
export const shopNow = () => (sharedClockOn() ? wallMsForClassicMinutes(worldMinutes()) : Date.now());

/** STOREFRONT: the carousel turns a panel this often (ms) - never for less motion, nor while pointed at, focused or paused. */
export const CAROUSEL_TURN_MS = 8000;
/** STOREFRONT: whether the carousel turns now - two slides or more, nobody holding it, its panel shown long enough. Pure. */
export const carouselTurns = (/** @type {{ n: number, paused: boolean, reduced: boolean, hovered: boolean, focusedIn: boolean, since: number, hidden?: boolean }} */ c, /** @type {number} */ nowMs) =>
  c.n > 1 && !c.paused && !c.reduced && !c.hovered && !c.focusedIn && !c.hidden && nowMs - c.since >= CAROUSEL_TURN_MS;   // AUDIT-STOREFRONT II (lane E 16): never scrolled out of sight
/** STOREFRONT: THE CAROUSEL'S PANELS - the card's featured wares in its order, each sold alone; none with no card. Pure. */
export const shopCarouselOf = (/** @type {any} */ flow) => (Array.isArray(flow?.shop?.featured) ? flow.shop.featured.map((/** @type {string} */ id) => shopWareById(id)).filter((/** @type {any} */ w) => !!w && w.alone) : []);
/** STOREFRONT: A BUNDLE'S CONTENTS - each ware it gives with its name, kind, whether this account holds it, and (AUDIT-
 *  STOREFRONT S12) whether it holds part of it - a giver inside, a piece of a set - which its price takes off. Pure. */
export const shopBundleRows = (/** @type {any} */ flow, /** @type {{ gives: ReadonlyArray<string> }} */ w) => w.gives.map((id) => {
  const g = shopWareById(id), held = shopHeldAny(flow, id);
  return { id, name: g ? shopWareName(g) : id, kind: g ? KIND_TEXT[/** @type {keyof typeof KIND_TEXT} */ (g.kind)]?.() ?? g.kind : '', held, part: !held && shopClosure(id).some((x) => x !== id && shopHeldAny(flow, x)) };
});
/** STOREFRONT: the sections the window shows - each with a ware the card lists (every one sold alone with no card);
 *  PASS-PANELS: the Folios' always; AURUM: the day's deals after the Folios while Aurum is open to the account. Pure. */
export function shopSections(/** @type {any} */ flow) {
  const listed = (/** @type {any} */ w) => w.alone && (!flow?.shop || !!rowOf(flow, w.id));
  const out = SHOP_CATEGORIES.filter((c) => c === 'pass' || SHOP_WARES.some((w) => w.category === c && listed(w)));
  if (flow?.aurum?.open && flow.aurum.daily?.wares?.length) out.splice(out[0] === 'pass' ? 1 : 0, 0, 'daily');
  return out;
}
/** A whole number as the player's language writes it. */
const num = (/** @type {number} */ n) => { try { return new Intl.NumberFormat(intlLocale()).format(n); } catch { return String(n); } };
/** A date as a panel says it: "12 Nov", in UTC (the schedule's days). */
const dayText = (/** @type {number} */ ms) => { try { return new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(ms)); } catch { return new Date(ms).toISOString().slice(5, 10); } };
/** STOREFRONT: how long a featured window has left, in words. Pure. */
export function shopUntilText(/** @type {number} */ untilMs, /** @type {boolean} */ limited, nowMs = Date.now()) {
  const days = Math.ceil((untilMs - nowMs) / 86_400_000);
  const left = days <= 1 ? t('shop.until.today', 'Ends today') : t('shop.until.days', '{n} days left', { n: days });
  return limited ? t('shop.until.limited', 'Limited: sold only until {day}. {left}.', { day: dayText(untilMs - 1), left }) : t('shop.until.featured', 'Featured until {day}. {left}.', { day: dayText(untilMs - 1), left });
}

/** SHOP-REREAD (2026-10-31): the signed-in account read again - the window's focus and every press of the gem ask it, so
 *  a card read from an older service (a deploy's gap: no Aurum, no Folios) mends at the next open. Nothing for no flow. */
export function shopReread(/** @type {any} */ fl) {
  if (fl?.stage !== 'in' || typeof fl.refresh !== 'function') return false;
  Promise.resolve(fl.refresh()).catch(() => {});
  return true;
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
 * @param {{ flow: () => any, onClose: () => void, keep?: { cat?: string, slide?: number, folio?: string|null, page?: number }, focus?: boolean, now?: () => number,
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
  // AURUM: the balance, a readout beside the title while Aurum is open to the account
  const balance = el('span', 'sh-balance');
  const coin = aurumArtNode(doc, 0, 20, 'sh-coin'), balanceN = el('span', 'sh-balancen'), balanceSay = el('span', 'sh-sr');
  balanceN.setAttribute('aria-hidden', 'true');   // AUDIT-STOREFRONT III C9: a span's aria-label is dropped - its words are its own
  if (coin) balance.append(coin);
  balance.append(balanceN, balanceSay);
  const close = button('sh-close', t('shop.close', 'Close'), () => onClose());
  head.append(title, phase, balance, close);
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
  const tabs = el('div', 'sh-tabs');   // AUDIT-STOREFRONT II (lane E 6): over the scrolled part, so a section is a press away at any height
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
  const paid = el('span', 'sh-stripe', t('shop.stripe', 'Payments are taken by Stripe. Prices are in US dollars, and Stripe can show your own currency and ways to pay. No card details reach the game.'));
  foot.append(who, paid, terms);
  // AUDIT-STOREFRONT II (lane E 6): the head, the disclaimer and the tabs stand; the featured wares and the section's
  // panels scroll under them
  const scroll = el('div', 'sh-scroll');
  scroll.append(carousel, panels, say, foot);
  body.append(head, proceeds, tabs, scroll);
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

  /** AUDIT-STOREFRONT II (lane E 16): a stage starts once it is scrolled near sight - never a live canvas a panel nobody
   *  has seen, nor the carousel turning out of sight. With no IntersectionObserver, at once. */
  const IO = /** @type {any} */ (doc.defaultView ?? globalThis).IntersectionObserver;
  /** @type {Map<any, () => void>} */ const waiting = new Map();
  const sight = typeof IO === 'function' ? new IO((/** @type {any[]} */ es) => {
    for (const e of es) {
      if (e.target === carousel) { carouselHidden = !e.isIntersecting; continue; }
      const go = e.isIntersecting ? waiting.get(e.target) : null;
      if (go) { waiting.delete(e.target); sight.unobserve(e.target); go(); }
    }
  }, { root: scroll, rootMargin: '160px 0px' }) : null;
  let carouselHidden = false;
  sight?.observe(carousel);
  const whenSeen = (/** @type {HTMLElement} */ node, /** @type {() => void} */ go) => {
    if (!sight) { go(); return; }
    for (const k of [...waiting.keys()]) if (!k.isConnected) { waiting.delete(k); sight.unobserve(k); }   // a panel drawn again
    waiting.set(node, go);
    sight.observe(node);
  };
  /** A canvas preview started once it stands in the page and in sight, kept in `into` while its generation stands. */
  const startCanvas = (/** @type {HTMLElement} */ stage, /** @type {(c: HTMLCanvasElement) => Promise<{ stop: () => void }|null>} */ start, /** @type {string} */ none, /** @type {boolean} */ slide) => {
    const canvas = /** @type {HTMLCanvasElement} */ (el('canvas', 'sh-auracanvas'));
    canvas.setAttribute('aria-hidden', 'true');
    stage.append(canvas);
    const gen = slide ? slideGen : liveGen;
    const mine = () => (slide ? slideGen : liveGen) === gen;
    whenSeen(stage, () => globalThis.requestAnimationFrame?.(() => {   // once the canvas has its size in the page
      if (!canvas.isConnected || !mine()) return;
      start(canvas).catch(() => null).then((p) => {
        if (p && mine()) { (slide ? slideLive : live).push(p); stage.addEventListener?.('pointerenter', () => /** @type {any} */ (p).again?.()); return; }   // pointed at: its loop from the top, its sound with it
        p?.stop();
        if (!p && mine()) stage.append(el('p', 'sh-nogl', none));
      });
    }));
  };
  /** A ware's picture, live: the title on its plate over a name, the glyph large, the aura or the piece on its stage, an
   *  effect playing on the stand-in, the horse in its look, a bundle's contents. */
  const stageOf = (/** @type {any} */ w, slide = false) => {
    const stage = el('div', `sh-stage sh-stage-${w.kind}${w.tier ? ` sh-tierstage-${w.tier}` : ''}`);
    const nameEl = () => { const n = el('div', 'sh-tagname', nameText()); names.push(n); return n; };
    stage.addEventListener?.('pointerenter', () => { heard = w.id; });
    if (w.kind === 'title') {
      const big = paintTitle(el('div', 'sh-bigtitle', shopWareName(w)), titleBadge({ title: w.key }));   // on the stage's wood: its own light paint
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
    } else if (w.kind === 'icon') {   // AURUM: the icon large, and small beside the name as the portrait well wears it
      const art = profileIconNode(doc, w.key, 'sh-bigicon', 148);
      const tag = el('div', 'sh-nametag sh-nameline');
      const small = profileIconNode(doc, w.key, 'sh-smallicon', 24, { still: true });
      if (small) tag.append(small);
      tag.append(nameEl());
      if (art) stage.append(art);
      stage.append(tag);
    } else if (w.kind === 'aurum') {   // AURUM: a pack's coins, its count, and its share past the smallest pack's rate
      const n = w.aurum, art = aurumArtNode(doc, n, 132, 'sh-aurumpic'), bonus = aurumBonusOf(w.id);
      if (art) stage.append(art);
      stage.append(el('div', 'sh-aurumn', t('shop.aurum.count', '{n, number} Aurum', { n })));
      if (bonus) stage.append(el('div', 'sh-bonus', t('shop.aurum.bonus', '{pct}% more Aurum', { pct: bonus })));
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
    }
    return stage;
  };
  /** A ware's tags: its tier, the account line, a pre-alpha ware's mark, a featured window's. */
  const tagsOf = (/** @type {any} */ w) => {
    const tags = el('ul', 'sh-tags');
    if (w.tier && w.kind !== 'aurum') tags.append(el('li', `sh-tag sh-tier sh-tier-${w.tier}`, SHOP_TIER_TEXT[/** @type {keyof typeof SHOP_TIER_TEXT} */ (w.tier)]()));   // AURUM: a pack's size is its own mark
    if (w.preAlpha) tags.append(el('li', 'sh-tag sh-tag-pre', t('shop.tag.preAlpha', 'Pre-alpha only')));
    tags.append(el('li', 'sh-tag', t('shop.tag.account', 'Every character on your account')));
    return tags;   // a featured window's tag is drawPanel's, as the card moves
  };
  /** A ware's panel: its stage, its words, its contents (a bundle's), its price and its press. AURUM-ONLY: any ware but a
   *  pack priced in Aurum, its press the Aurum's; `daily` one among the day's deals. */
  const panelOf = (/** @type {any} */ w, slide = false, daily = false) => {
    const inAurum = !shopRepeatable(w);
    const panel = el('article', slide ? 'sh-ware sh-slide' : `sh-ware sh-panel sh-panel-${w.kind}${daily ? ' sh-daily' : ''}${w.tier ? ` sh-tierpanel-${w.tier}` : ''}`);
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
      info.append(contents, el('p', 'sh-worth', t('shop.bundle.worthAurum', 'Worth {n, number} Aurum bought alone.', { n: shopWorth(w.id) })));
    }
    const buyrow = el('div', 'sh-buyrow');
    const price = el('span', inAurum ? 'sh-price sh-aurumprice' : 'sh-price', '');
    const priceN = inAurum ? el('span', 'sh-pricen') : price, priceSay = inAurum ? el('span', 'sh-sr') : null;
    if (inAurum) { const c = aurumArtNode(doc, 0, 22, 'sh-coin'); if (c) price.append(c); priceN.setAttribute('aria-hidden', 'true'); price.append(priceN, /** @type {any} */ (priceSay)); }   // AUDIT-STOREFRONT III C9: its currency said
    const was = el('s', 'sh-was', '');
    const state = el('span', 'sh-state');
    buyrow.append(was, price, state);
    info.append(buyrow);
    panel.append(stageOf(w, slide), info);
    return { panel, parts: { inAurum, buyrow, state, price, priceN, priceSay, was, contents, wintag, until, untilKey: '', act: /** @type {any} */ (null), actKey: '', contentsKey: '' } };
  };

  // ── PASS-PANELS: THE FOLIOS' SECTION (enhancedPass.js), drawn in place as the flow moves ──
  /** @type {{ nodes: any[], draw: (fl: any) => void, back: () => boolean, says: (fl: any) => boolean }|null} */
  let passView = null;
  const passCtx = () => ({
    flow: f, now, el, button, num, dayText,
    armed: (/** @type {string} */ id) => armed?.id === id,
    arm: (/** @type {string|null} */ id) => { armed = id ? { id, at: now() } : null; draw(); },
    redraw: () => draw(),
    canGetAurum: () => shopSections(f()).includes('aurum'),
    toAurum: () => pick('aurum'),
    wearPress: (/** @type {{ kind: string, key: string }} */ w, /** @type {boolean} */ worn) => actFor(w, { state: 'held', worn }),
    worn: (/** @type {{ kind: string, key: string }} */ w) => shopWorn(f(), w),
    keep, reduced,
  });

  // ── AURUM: THE DAILY WARES' AND THE AURUM'S SECTIONS ──
  /** The day's wares' head: when they turn, and the week's deeds - each its Aurum, struck or still to do. */
  let turnsEl = /** @type {HTMLElement|null} */ (null);
  const dailySection = () => {
    const a = f()?.aurum;
    const box = el('section', 'sh-dailyhead');
    const top = el('div', 'sh-sectop');
    turnsEl = el('span', 'sh-turns', a?.daily?.until ? aurumTurnsText(a.daily.until, now()) : '');
    top.append(el('h4', 'sh-secname', t('shop.deals.title', "Today's deals")), turnsEl);
    box.append(top, el('p', 'sh-secline', t('shop.deals.line', 'Each costs a quarter less today. New deals come each day at midnight UTC.')));
    const deeds = el('ul', 'sh-deeds');
    deeds.setAttribute('aria-label', t('shop.deed.head', "This week's deeds"));
    for (const [k, n] of Object.entries(AURUM_DEEDS)) {
      const done = (a?.week?.deeds?.[k] ?? 0) > 0;
      const li = el('li', `sh-deed${done ? ' sh-deed-done' : ''}`);
      li.append(el('span', 'sh-deedname', DEED_TEXT[/** @type {keyof typeof DEED_TEXT} */ (k)]()), el('span', 'sh-deedpay', done ? t('shop.deed.done', 'Done this week') : t('shop.deed.pay', '+{n, number} Aurum', { n })));
      deeds.append(li);
    }
    box.append(el('h5', 'sh-subhead', t('shop.deed.head', "This week's deeds")), deeds, el('p', 'sh-secline', t('shop.deed.line', 'Each deed pays once a week. A new week starts on Monday, UTC.')));
    return box;
  };
  /** The Aurum's head: the balance, what Aurum is for and where it comes from, and what it never is. */
  const aurumSection = () => {
    const a = f()?.aurum;
    const box = el('section', 'sh-aurumhead');
    const art = aurumArtNode(doc, 0, 56, 'sh-aurumcoin');
    if (art) box.append(art);
    const words = el('div', 'sh-aurumwords');
    words.append(el('h4', 'sh-secname', a ? t('shop.aurum.hold', 'Your balance: {n, number} Aurum', { n: a.balance }) : SHOP_CATEGORY_TEXT.aurum()),
      el('p', 'sh-secline', t('shop.aurum.lineAll', "Aurum buys every item in the shop and in the Folios. Your deeds find it, the week's deeds pay it, and you can buy it here.")),
      el('p', 'sh-secline', t('shop.aurum.rules', 'Aurum has no cash value. It cannot be traded, and it buys no power.')));
    box.append(words);
    return box;
  };
  /** The day's wares the card lists, in its order (each a daily ware once). */
  const dailyWares = (/** @type {any} */ fl) => (fl?.aurum?.daily?.wares ?? []).map((/** @type {any} */ r) => shopWareById(r.id)).filter(Boolean);
  /** A section's head (the day's wares', the Aurum's) and what it is drawn from - drawn again when the account read brings
   *  another. */
  const HEADS = /** @type {Record<string, { build: () => HTMLElement, key: (fl: any) => string }>} */ ({
    daily: { build: () => dailySection(), key: (fl) => JSON.stringify([fl?.aurum?.daily?.until, fl?.aurum?.week]) },
    aurum: { build: () => aurumSection(), key: (fl) => JSON.stringify([fl?.aurum?.balance]) },
  });
  let headNode = /** @type {HTMLElement|null} */ (null), headKey = '', dailyKey = '';
  /** The wares a section lists: the day's for the deals, else each sold alone that the card lists. */
  const waresOf = (/** @type {string} */ c, /** @type {any} */ fl) => (c === 'daily' ? dailyWares(fl)
    : SHOP_WARES.filter((x) => x.category === c && x.alone && (!fl?.shop || !!rowOf(fl, x.id))));
  const buildPanels = () => {
    stopLive();
    drawn = new Map();
    names = [];
    panels.textContent = '';
    panels.setAttribute('aria-labelledby', `sh-tab-${cat}`);
    const fl = f(), h = HEADS[cat];
    headNode = h ? h.build() : null;
    headKey = h ? h.key(fl) : '';
    dailyKey = dailyWares(fl).map((/** @type {any} */ w) => w.id).join(',');
    if (headNode) panels.append(headNode);
    passView = cat === 'pass' ? passSection(doc, passCtx()) : null;
    if (passView) panels.append(...passView.nodes);
    for (const w of waresOf(cat, fl)) {
      const { panel, parts } = panelOf(w, false, cat === 'daily');
      panels.append(panel);
      drawn.set(w.id, parts);
    }
  };
  const buildTabs = () => {
    tabs.textContent = '';
    tabOf.clear();
    for (const c of shopSections(f())) {
      const n = c === 'pass' ? passItemsIn(passShownSeason(f(), now()).id).length : waresOf(c, f()).length;   // PASS-PANELS: its tracks' items
      const tb = /** @type {HTMLButtonElement} */ (el('button', 'sh-tab'));   // AUDIT-STOREFRONT II (lane E 1): a tab, never the kit's press too
      tb.type = 'button';
      tb.addEventListener('click', () => pick(c));
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
    if (typeof panels.offsetTop === 'number') scroll.scrollTop = panels.offsetTop;   // AUDIT-STOREFRONT II (lane E 6): the section's own panels in sight, the featured above them
  };

  // ── THE CAROUSEL'S CLOCK ──
  let slides = /** @type {any[]} */ ([]), at = Math.max(0, keep.slide | 0), paused = false, hovered = false, focusedIn = false, slideAt = now();
  /** @type {any} */ let slideParts = null;
  let slidesKey = '';
  /** The slide `at` built - its live stage the only one of the carousel's running; `moved` a turn, which slides it in
   *  (AUDIT-STOREFRONT II, lane E 14: never the first, on opening). */
  const showSlide = (moved = false) => {
    stopSlide();
    slideHost.textContent = '';
    slideParts = null;
    const w = slides[at];
    if (!w) return;
    const { panel, parts } = panelOf(w, true);
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-roledescription', t('shop.carousel.slide', 'slide'));
    panel.setAttribute('aria-label', t('shop.carousel.of', '{n} of {m}', { n: at + 1, m: slides.length }));
    if (moved && !reduced) panel.classList?.toggle('sh-slidein', true);
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
      const d = /** @type {HTMLButtonElement} */ (el('button', 'sh-cdot'));   // a dot, never the kit's raised press
      d.type = 'button';
      d.addEventListener('click', () => { at = i; heard = w.id; showSlide(true); carouselState(); });
      d.setAttribute('aria-label', shopWareName(w));
      dots.append(d);
    });
  };
  /** A step through the slides, `by` one either way; `chosen` the player's, whose effect is then heard. */
  function turn(/** @type {number} */ by, chosen = false) {
    if (slides.length < 2) return;
    at = (at + by + slides.length) % slides.length;
    if (chosen) heard = slides[at].id;
    showSlide(true);
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
    pauseB.hidden = reduced;   // AUDIT-STOREFRONT II (lane E 13): for less motion it never turns, so nothing to pause
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
    if (carouselTurns({ n: slides.length, paused, reduced, hovered, focusedIn, since: slideAt, hidden: carouselHidden }, now())) turn(1);
    if (Math.floor(now() / 86_400_000) !== day) {   // AUDIT-STOREFRONT S9: a UTC midnight moves every "days left"; AURUM: and turns the day's wares
      day = Math.floor(now() / 86_400_000);
      draw();
      const fl = f();
      if (fl?.aurum && fl.stage === 'in') Promise.resolve(fl.refresh?.()).catch(() => {});
    }
    if (armed && now() - armed.at > ARM_MS) { armed = null; draw(); }   // AURUM: a Buy armed and left goes back to Buy
    const a = f()?.aurum;
    if (turnsEl && a?.daily?.until) { const tx = aurumTurnsText(a.daily.until, now()); if (turnsEl.textContent !== tx) turnsEl.textContent = tx; }
  }, 500);
  /** @type {any} */ (clock)?.unref?.();
  function stopClock() { if (clock != null) globalThis.clearInterval?.(clock); }

  /** A held ware's press: wear it, or take it off (a glyph shown or hidden) - the flow's own, as the account card's.
   *  PASS-PANELS: a track's item held is worn the same way. */
  const wear = (/** @type {any} */ w) => {
    const fl = f();
    if (!fl || fl.busy) return;
    if (w.kind === 'title') fl.equip?.(w.key);
    else if (w.kind === 'aura') fl.wearAura?.(w.key);
    else if (w.kind === 'armory' && setOf(w)) fl.wearArmoryKit?.(shopWorn(fl, w) ? null : armoryLineKit(setOf(w)));   // ARMORY: a set, all its pieces at once
    else if (w.kind === 'armory') fl.wearArmory?.(armoryPieceOf(w.key)?.slot, w.key);   // ARMORY: in its slot
    else if (w.kind === 'kill' || w.kind === 'portal' || w.kind === 'mount') fl.wearEffect?.(w.kind, w.key);   // STOREFRONT: in its slot
    else if (w.kind === 'icon') fl.wearIcon?.(w.key);   // AURUM: in the portrait well
    else fl.toggleGlyph?.(w.key);
  };
  /** AURUM: A WARE'S PRESS FOR AURUM (AURUM-ONLY: any ware but a pack). Spending is pressed twice - Buy arms it, saying
   *  the price again, and the second press buys at that price; left alone it goes back to Buy. Short of the price, Get
   *  Aurum (while the packs are sold). Held, Wear. */
  let armed = /** @type {{ id: string, at: number }|null} */ (null);
  let buying = /** @type {string|null} */ (null);   // AUDIT-STOREFRONT III C12: the ware whose buy is out, its press saying so
  const aurumActFor = (/** @type {any} */ w, /** @type {any} */ st) => {
    if (st.state === 'held') return actFor(w, st);
    if (st.state === 'afford') {
      const on = armed?.id === w.id, n = st.price, going = buying === w.id;
      const b = button('sh-buy sh-aurumbuy', going ? t('shop.pass.buying', 'Buying...') : on ? t('shop.daily.confirm', 'Confirm: {n, number} Aurum', { n }) : t('shop.daily.buy', 'Buy for {n, number} Aurum', { n }), () => {
        const fl = f();
        if (!fl || fl.busy || buying) return;
        if (armed?.id !== w.id) { armed = { id: w.id, at: now() }; draw(); return; }
        armed = null;
        buying = w.id;
        draw();
        Promise.resolve(fl.buyWare?.(w.id, n)).catch(() => {}).finally(() => { buying = null; draw(); });
      });
      if (!going) b.setAttribute('aria-label', on ? t('shop.daily.confirmLabel', 'Confirm: buy {name} for {n, number} Aurum', { name: shopWareName(w), n }) : t('shop.daily.buyLabel', 'Buy {name} for {n, number} Aurum', { name: shopWareName(w), n }));
      if (on || going) b.setAttribute('data-armed', 'true');
      if (f()?.busy) b.setAttribute('aria-disabled', 'true');
      return b;
    }
    if (st.state === 'short' && shopSections(f()).includes('aurum')) return button('sh-getaurum', t('shop.daily.get', 'Get Aurum'), () => pick('aurum'));
    return null;
  };
  /** A wear press's full words: what it does and to which item. */
  const wearLabel = (/** @type {any} */ w, /** @type {boolean} */ worn) => {
    const name = shopWareName(w);
    if (w.kind === 'glyph') return worn ? t('shop.hideLabel', 'Hide {name}', { name }) : t('shop.showLabel', 'Show {name}', { name });
    return worn ? t('shop.takeOffLabel', 'Take off {name}', { name }) : t('shop.wearLabel', 'Wear {name}', { name });
  };
  const actFor = (/** @type {any} */ w, /** @type {any} */ st) => {
    if (st.state === 'held' && wearable(w)) {
      const words = w.kind === 'glyph' ? (st.worn ? t('shop.hide', 'Hide') : t('shop.show', 'Show')) : (st.worn ? t('shop.takeOff', 'Take off') : t('shop.wear', 'Wear'));
      const b = button('sh-wear', words, () => wear(w));
      b.setAttribute('aria-label', wearLabel(w, st.worn));   // AUDIT-STOREFRONT III C9: which item it wears
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
  /** AURUM: how long a Buy stays armed for its second press (ms). */
  const ARM_MS = 6000;
  const STATE_TEXT = Object.freeze({
    held: () => t('shop.state.held', 'Owned'),
    gone: () => t('shop.state.gone', 'No longer sold'),
    closed: () => t('shop.state.closed', 'Not on sale yet'),
    guest: () => t('shop.state.guest', 'Needs a username'),
    out: () => t('shop.state.out', 'Sign in to buy'),
    reading: () => '',
    buy: () => '',
    afford: () => '',
  });
  /** What a panel's state says: the Aurum it still needs, Aurum shut, or the state's own words. */
  const stateWords = (/** @type {any} */ st, /** @type {boolean} */ inAurum) => (st.state === 'short' ? t('shop.daily.short', 'You need {n, number} more Aurum', { n: st.need })
    : inAurum && st.state === 'closed' ? t('shop.daily.closed', 'Aurum is not open yet') : STATE_TEXT[/** @type {keyof typeof STATE_TEXT} */ (st.state)]());
  /** One panel brought up to date: its price (this account's, the list's struck through beside it), its state, its press,
   *  a bundle's contents. AURUM-ONLY: a ware's in Aurum (a deal's tag beside it), a pack's in money. */
  const drawPanel = (/** @type {any} */ w, /** @type {any} */ d, /** @type {any} */ fl) => {
    const st = /** @type {any} */ (shopWareState(fl, w));
    const words = stateWords(st, d.inAurum);
    if (d.state.textContent !== words) d.state.textContent = words;
    d.state.className = 'sh-state sh-state-' + st.state;
    d.buyrow.className = 'sh-buyrow sh-buyrow-' + st.state;   // AUDIT-STOREFRONT II (lane E 12): held, its price dimmed under its state
    if (d.inAurum) {
      const priceText = num(st.price), say = t('shop.daily.priceLabel', '{n, number} Aurum', { n: st.price });
      if (d.priceN.textContent !== priceText) d.priceN.textContent = priceText;
      if (d.priceSay && d.priceSay.textContent !== say) d.priceSay.textContent = say;
    } else {
      const priceText = shopPriceText(st.cents, intlLocale());
      if (d.price.textContent !== priceText) d.price.textContent = priceText;
    }
    const less = d.inAurum && st.price < st.list && st.state !== 'held';   // a deal, or a giver's share
    const wasText = less ? num(st.list) : '';
    if (d.was.textContent !== wasText) d.was.textContent = wasText;
    d.was.setAttribute?.('aria-label', less ? t('shop.was', 'Was {price}', { price: t('shop.daily.priceLabel', '{n, number} Aurum', { n: st.list }) }) : '');
    // AUDIT-STOREFRONT S9: a featured window told only beside its sale, its days left counted again as they pass
    const row = rowOf(fl, w.id), win = row?.until && row.sale ? row : null, deal = st.deal && st.state !== 'held';
    const untilText = win ? shopUntilText(win.until, win.limited, now()) : '', uk = `${deal ? 1 : 0}${win ? `${win.limited ? 1 : 0}${untilText}` : ''}`;
    if (d.untilKey !== uk) {   // empty, each is not shown (SHOP_CSS)
      d.untilKey = uk;   // AURUM-ONLY: a deal's tag before a featured window's - its price is the day's
      d.wintag.className = deal ? 'sh-tag sh-tag-deal' : win ? `sh-tag ${win.limited ? 'sh-tag-limited' : 'sh-tag-featured'}` : 'sh-tag';
      d.wintag.textContent = deal ? t('shop.tag.deal', "Today's deal") : !win ? '' : win.limited ? t('shop.tag.limited', 'Limited') : t('shop.tag.featured', 'Featured');
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
          else if (r.part) li.append(el('span', 'sh-contentheld', t('shop.bundle.part', 'Partly owned: its price is less')));   // AUDIT-STOREFRONT S12: a giver inside it held in part
          d.contents.append(li);
        }
        d.contentsKey = key;
      }
    }
    const key = `${st.state}:${st.worn ? 1 : 0}:${st.buy ?? ''}:${st.price}:${armed?.id === w.id ? 1 : 0}:${fl?.busy ? 1 : 0}:${shopSections(fl).includes('aurum') ? 1 : 0}:${buying === w.id ? 1 : 0}`;
    if (d.actKey !== key) {
      const had = d.act && doc.activeElement === d.act;
      d.act?.remove?.();
      d.act = d.inAurum ? aurumActFor(w, st) : actFor(w, st);
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
    if (cat === 'daily' && dailyWares(fl).map((/** @type {any} */ w) => w.id).join(',') !== dailyKey) buildPanels();   // AURUM: the day turned
    for (const [id, d] of drawn) { const w = shopWareById(id); if (w) drawPanel(w, d, fl); }
    passView?.draw(fl);   // PASS-PANELS: the tracks in place - a press keeps its focus
    const h = HEADS[cat], hk = h ? h.key(fl) : '';
    if (headNode && h && hk !== headKey) { const next = h.build(); headNode.replaceWith?.(next); headNode = next; headKey = hk; }   // the card read again: the head on it
    const a = fl?.aurum, showBal = !!a?.open && fl?.stage === 'in';   // AURUM: the balance in the head
    balance.hidden = !showBal;
    if (showBal) {
      const bt = num(a.balance);
      if (balanceN.textContent !== bt) balanceN.textContent = bt;
      const bs = t('shop.aurum.balance', 'Your Aurum: {n, number}', { n: a.balance });
      if (balanceSay.textContent !== bs) balanceSay.textContent = bs;
      balance.classList.toggle('sh-owing', a.balance < 0);
    }
    for (const [c, tb] of tabOf) { tb.setAttribute('aria-selected', c === cat ? 'true' : 'false'); tb.tabIndex = c === cat ? 0 : -1; tb.classList.toggle('on', c === cat); }
    const shown = nameText();
    for (const n of names) if (n.textContent !== shown) n.textContent = shown;
    const whoText = shopWhoText(fl);
    if (who.textContent !== whoText) who.textContent = whoText;
    const line = passView?.says(fl) ? '' : fl?.error || fl?.note || '';   // AUDIT-STOREFRONT III C10/C11: said once, by the Folios
    if (say.textContent !== line) say.textContent = line;
    say.classList.toggle('bad', !!fl?.error);
  };

  buildTabs();
  buildPanels();
  draw();
  // BACK FROM THE BROWSER, the account is read again - a payment that landed shows here (the account card's way)
  const view = doc.defaultView;
  const onFocus = () => { if (win.isConnected) shopReread(f()); };
  view?.addEventListener?.('focus', onFocus);
  if (focus) globalThis.requestAnimationFrame?.(() => tabOf.get(cat)?.focus?.({ preventScroll: true }));
  return {
    root: win,
    draw,
    close,
    back: () => passView?.back() ?? false,   // AUDIT-STOREFRONT III C8: Escape asks this first - an open folio closes to its covers
    stop: () => { stopLive(); stopSlide(); stopClock(); sight?.disconnect?.(); view?.removeEventListener?.('focus', onFocus); },
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

/** THE SHOP'S SHEET: the gem's place in the row of marks and the window's geometry and words. AUDIT-STOREFRONT II (lane E 1):
 *  every surface's paint is the enhanced kit's, by its role (ui/enhanced/enhancedFrame.js FRAME_ROLES - the window, its
 *  panels, presses, tabs, chips, wells, head and foot), so a theme and the Grimoire dress it: a border here is its width
 *  and style alone, never its colour. A stage keeps its own dark ground - the picture's - and a word its colour. */
export const SHOP_CSS = `
.px-shopmark { position: absolute; top: 12px; right: 480px; z-index: 4; display: flex; align-items: center;
  min-height: 44px; min-width: 44px; justify-content: center; padding: 0 6px; background: none; border: 0; cursor: pointer; }
.px-shopmark:focus-visible { outline: 2px solid #f3cf86; outline-offset: 2px; }
.px-shopgem { display: block; width: 34px; height: 34px; image-rendering: pixelated; position: relative;
  filter: drop-shadow(2px 2px 0 rgba(0,0,0,0.8)) drop-shadow(0 0 5px rgba(143,91,255,0.55)); background: ${gemSvg()} center / contain no-repeat; }
.px-shopgem::after { content: ''; position: absolute; left: 7px; top: 7px; width: 6px; height: 6px; background: #f4eeff;
  clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); opacity: 0; animation: sh-glint 3.6s steps(6) infinite; }
@keyframes sh-glint { 0%, 70%, 100% { opacity: 0; transform: scale(.4); } 80% { opacity: 1; transform: scale(1); } 90% { opacity: .6; transform: scale(.7); } }
.px-shopmark:hover .px-shopgem, .px-shopmark:focus-visible .px-shopgem { transform: translateY(-2px); transition: transform 160ms steps(2); }
@media (prefers-reduced-motion: reduce) { .px-shopgem::after { animation: none; } }
/* THE WINDOW: one height for every section (a tab never moves its frame); the head, the disclaimer and the tabs stand,
   the featured wares and the section scroll under them */
.px-win.px-shopwin { height: min(820px, 92dvh); width: min(840px, 95vw); }
.px-home > .px-stage:has(~ .px-shopstage) { visibility: hidden; }   /* AUDIT-STOREFRONT III C14: the inert pause window under it, unseen */
.px-win.px-shopwin .px-body { padding: 14px 18px 12px; display: flex; flex-direction: column; gap: 10px; overflow: hidden; min-height: 0; }
.px-shopwin .sh-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; position: relative; display: flex; flex-direction: column; gap: 12px;
  padding: 2px 6px 4px 2px; margin-right: -6px; scrollbar-gutter: stable; overscroll-behavior: contain; }
.px-shopwin .sh-head { display: flex; align-items: center; gap: 10px; padding: 0 2px 10px; border-bottom-width: 2px; border-bottom-style: solid; flex-wrap: wrap; }
.px-shopwin .sh-title { margin: 0; font-size: 22px; letter-spacing: 0.18em; text-transform: uppercase; color: #efe8d6; }
.px-shopwin .sh-phase { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #f3cf86; border-width: 1px; border-style: solid; padding: 2px 7px; margin-right: auto; }
.px-shopwin .sh-balance { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 6px; min-height: 30px; box-sizing: border-box;
  border-width: 1px; border-style: solid; font-size: 16px; color: #ffe29a; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.px-shopwin .sh-balance[hidden] { display: none; }
.px-shopwin .sh-balance.sh-owing { color: #ff9a7a; }
.px-shopwin .sh-coin { width: 20px; height: 20px; flex: none; }
.px-shopwin .sh-close { min-height: 40px; padding: 0 16px; }
.px-shopwin .sh-proceeds { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 12px; padding: 8px 14px; border-width: 1px 1px 1px 4px; border-style: solid; }
.px-shopwin .sh-proceeds-main { font-size: 14.5px; color: #fff4e0; letter-spacing: 0.02em; }
.px-shopwin .sh-proceeds-sub { font-size: 12.5px; color: #e2dccd; }
/* THE TABS: the kit's tab, its word the strip's own (ui/enhanced/enhancedStyle.js .px-tabs) */
.px-shopwin .sh-tabs { display: flex; gap: 2px 4px; flex-wrap: wrap; justify-content: center; }
.px-shopwin .sh-tab { font: inherit; display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 4px 10px; font-size: 14px; letter-spacing: 0.1em;
  text-transform: uppercase; color: #d8cfae; background: none; border: 0; cursor: pointer; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-shopwin .sh-tab:hover, .px-shopwin .sh-tab:focus-visible { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); outline: none; }
.px-shopwin .sh-tab.on { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-shopwin .sh-tab:focus-visible { outline: 2px solid #f3cf86; outline-offset: -2px; }
.px-shopwin .sh-tabcount { font-variant-numeric: tabular-nums; font-size: 11px; }   /* AUDIT-STOREFRONT III C7: dimmed, it read 3.9:1 on Stone */
/* A WARE'S PANEL: its stage beside its words */
.px-shopwin .sh-panels { display: flex; flex-direction: column; gap: 12px; }
.px-shopwin .sh-ware { display: grid; grid-template-columns: minmax(240px, 1.1fr) 1fr; gap: 16px; }
.px-shopwin .sh-panel { padding: 12px; border-width: 2px; border-style: solid; }
.px-shopwin .sh-stage { position: relative; min-height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  background-color: #08070d; background-image: radial-gradient(ellipse at 50% 60%, rgba(120,140,190,0.16), rgba(10,9,16,0) 70%); border-width: 2px; border-style: solid; overflow: hidden; }
.px-shopwin .sh-tierstage-premium { background-image: radial-gradient(ellipse at 50% 60%, rgba(190,120,255,0.2), rgba(10,9,16,0) 70%); }
.px-shopwin .sh-tierstage-exclusive { background-image: radial-gradient(ellipse at 50% 60%, rgba(255,190,80,0.2), rgba(10,9,16,0) 70%); }
.px-shopwin .sh-stage-title { container-type: inline-size; }
.px-shopwin .sh-bigtitle { font-size: min(40px, calc(88cqw / (var(--n, 10) * 0.7))); letter-spacing: 0.06em; white-space: nowrap; }
.px-shopwin .sh-nametag { display: flex; flex-direction: column; align-items: center; gap: .18em; font-size: 15px; color: #e9e4d9;
  text-shadow: 0 1px 0 #000, 0 0 3px #000; }
.px-shopwin .sh-nametag.sh-nameline { flex-direction: row; gap: .4em; }
.px-shopwin .sh-tagtitle { font-size: .78em; letter-spacing: .04em; white-space: nowrap; }
.px-shopwin .sh-bigglyph { width: 140px; height: 140px; filter: drop-shadow(0 0 12px rgba(143,91,255,0.55)); }
.px-shopwin .sh-smallglyph { width: 15px; height: 15px; }
.px-shopwin .sh-bigicon { width: 148px; height: 148px; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.7)); }
.px-shopwin .sh-smallicon { width: 24px; height: 24px; }
.px-shopwin .sh-aurumpic { width: 132px; height: 132px; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.7)); }
.px-shopwin .sh-aurumn { font-size: 28px; color: #ffe29a; letter-spacing: 0.04em; font-variant-numeric: tabular-nums; text-shadow: 0 0 12px rgba(255,190,80,0.45), 0 2px 0 #000; margin-top: -8px; }
.px-shopwin .sh-bonus { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9fe8b4; }
.px-shopwin .sh-auracanvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.px-shopwin .sh-stage-aura, .px-shopwin .sh-stage-armory, .px-shopwin .sh-stage-kill, .px-shopwin .sh-stage-portal { min-height: 300px; }
.px-shopwin .sh-stage-mount canvas.mountpreview { width: min(100%, 330px); height: auto; image-rendering: pixelated; }
.px-shopwin .sh-nogl { color: var(--dim); font-size: 13px; padding: 0 16px; text-align: center; }
.px-shopwin .sh-info { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.px-shopwin .sh-nameline { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.px-shopwin .sh-name { margin: 0; font-size: 22px; color: #f4ecd8; letter-spacing: 0.04em; }
.px-shopwin .sh-kind { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #d8b56a; }
.px-shopwin .sh-look { margin: 0; font-size: 14px; line-height: 1.5; color: #e2dccd; }
.px-shopwin .sh-tags { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.px-shopwin .sh-tag { font-size: 11px; letter-spacing: 0.08em; padding: 3px 8px; color: #e2dccd; border-width: 1px; border-style: solid; }
.px-shopwin .sh-tag-pre { color: #d6b8ff; }
.px-shopwin .sh-tier { font-weight: bold; letter-spacing: 0.14em; text-transform: uppercase; }
.px-shopwin .sh-tier-standard { color: #b8d8ff; }
.px-shopwin .sh-tier-premium { color: #e0b8ff; }
.px-shopwin .sh-tier-exclusive { color: #ffd27a; }
.px-shopwin .sh-tag-featured { color: #ffd27a; }
.px-shopwin .sh-tag-limited { color: #ffb08f; font-weight: bold; }
.px-shopwin .sh-tag-deal { color: #9fe6a8; font-weight: bold; }   /* AURUM-ONLY: a deal's tag */
.px-shopwin .sh-until { margin: 0; font-size: 12.5px; color: #ffd27a; }
.px-shopwin .sh-until:empty, .px-shopwin .sh-tag:empty { display: none; }
.px-shopwin .sh-until-limited { color: #ff9a7a; font-weight: bold; }
/* THE PRICE AND THE PRESS */
.px-shopwin .sh-buyrow { margin-top: auto; display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; }
.px-shopwin .sh-price { font-size: 24px; color: #fff4e0; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.px-shopwin .sh-aurumprice { display: inline-flex; align-items: center; gap: 6px; color: #ffe29a; }
.px-shopwin .sh-aurumprice .sh-coin { width: 22px; height: 22px; }
.px-shopwin .sh-buyrow-held .sh-price { font-size: 15px; opacity: 0.8; }
.px-shopwin .sh-was { font-size: 15px; color: var(--dim); }
.px-shopwin .sh-was:empty { display: none; }
.px-shopwin .sh-state { font-size: 12.5px; color: var(--dim); }
.px-shopwin .sh-state-held { color: #9fe8b4; font-size: 14px; }
.px-shopwin .sh-state-short { color: #ffb08f; }
.px-shopwin .sh-buy, .px-shopwin .sh-wear, .px-shopwin .sh-getaurum { min-height: 44px; display: inline-flex; align-items: center; padding: 0 18px; text-decoration: none; }
.px-shopwin .sh-buy { color: #ffe9b8; border-width: 2px; border-style: solid; font-size: 15px; letter-spacing: 0.1em; text-transform: uppercase; }
.px-shopwin .sh-buy:hover, .px-shopwin .sh-buy:focus-visible { color: #fff6dc; }
.px-shopwin .sh-buy[data-armed="true"] { color: rgb(243,239,44); }
.px-shopwin .sh-aurumbuy { text-transform: none; letter-spacing: 0.04em; }
.px-shopwin :is(.sh-wear, .sh-buy)[aria-disabled="true"] { opacity: 0.55; }
.px-shopwin .sh-say { margin: 0; min-height: 16px; font-size: 13px; color: #9fe8b4; }
.px-shopwin .sh-say:empty { display: none; }
.px-shopwin .sh-say.bad { color: #e8a49c; }
.px-shopwin .sh-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; font-size: 12px; color: var(--dim);
  border-top-width: 2px; border-top-style: solid; padding: 10px 4px 2px; margin-top: auto; }
.px-shopwin .sh-who { color: #e2dccd; flex: 1 1 100%; }
.px-shopwin .sh-terms { color: #f3cf86; }
/* STOREFRONT (bible/06-Systems/Storefront.md section 9): THE CAROUSEL - the featured wares a panel at a time, large, its
   controls over it */
.px-shopwin .sh-carousel { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px 10px; border-width: 2px; border-style: solid; flex: none; }
.px-shopwin .sh-carousel.sh-empty { display: none; }
.px-shopwin .sh-cctrl { display: flex; align-items: center; gap: 6px; }
.px-shopwin .sh-cprev, .px-shopwin .sh-cnext { min-width: 44px; min-height: 36px; padding: 0; font-size: 20px; }
.px-shopwin .sh-cprev::before { content: '\\2039'; } .px-shopwin .sh-cnext::before { content: '\\203A'; }
.px-shopwin .sh-cpause { min-height: 36px; padding: 0 12px; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; }
.px-shopwin .sh-cpause[hidden] { display: none; }
.px-shopwin .sh-cdots { display: flex; gap: 2px; flex: 1; justify-content: center; flex-wrap: wrap; }
.px-shopwin .sh-cdot { width: 24px; height: 24px; min-width: 24px; min-height: 24px; padding: 0; border: 0; border-radius: 50%; background: transparent; box-shadow: none; display: inline-flex; align-items: center; justify-content: center; }
.px-shopwin .sh-cdot::before { content: ''; width: 12px; height: 12px; box-sizing: border-box; border-radius: 50%; border: 2px solid #c9a55a; }
.px-shopwin .sh-cdot[aria-pressed="true"]::before { background: #f3cf86; border-color: #f3cf86; }
.px-shopwin .sh-cdot:focus-visible { outline: 2px solid #f3cf86; outline-offset: 0; }
.px-shopwin .sh-cslides { touch-action: pan-y; }
.px-shopwin .sh-slide .sh-stage { min-height: 280px; }
.px-shopwin .sh-slidein { animation: sh-slidein 280ms steps(4); }
@keyframes sh-slidein { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }
/* A BUNDLE: its pieces laid out on its stage, each in its own picture, and what it gives listed */
.px-shopwin .sh-bundlemark { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #ffd27a; padding-top: 10px; }   /* VISUAL PASS: clear of the stage's frame over a four-item list */
.px-shopwin .sh-bundleart { list-style: none; margin: 0; padding: 2px 12px 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; width: 100%; max-width: 440px; box-sizing: border-box; }
.px-shopwin .sh-bundle-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.px-shopwin .sh-bpiece { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 5px; padding: 10px 6px 9px; text-align: center; min-width: 0;
  background: radial-gradient(circle at 50% 34%, rgba(243,207,134,0.14), rgba(10,9,16,0) 70%), rgba(255,255,255,0.025); border: 1px solid rgba(243,207,134,0.18); }
.px-shopwin .sh-bpic { min-height: 64px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.65)); }
.px-shopwin .sh-bpic .sh-bart { width: 64px; max-width: 100%; }
.px-shopwin .sh-bpiece-title { container-type: inline-size; }
.px-shopwin .sh-bpiece-title .sh-bname { font-size: max(11px, min(13px, calc(84cqw / (var(--n, 10) * 0.7)))); padding: 1px 5px; }
.px-shopwin .sh-bname { font-size: 13px; line-height: 1.15; color: #f1ead8; overflow-wrap: anywhere; }
.px-shopwin .sh-bkind { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); }
.px-shopwin .sh-contents { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 13.5px; }
.px-shopwin .sh-content { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; padding: 4px 8px; border-left: 2px solid rgba(243,207,134,0.45); }
.px-shopwin .sh-content-held { border-left-color: #9fe8b4; }
.px-shopwin .sh-content-part { border-left-color: #c9e89f; }
.px-shopwin .sh-contentkind { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); }
.px-shopwin .sh-contentheld { font-size: 11.5px; color: #9fe8b4; }
.px-shopwin .sh-worth { margin: 0; font-size: 12.5px; color: #e2dccd; }
/* A SECTION'S HEAD: the Folios' season; the day's wares' turn and the week's deeds; the Aurum */
.px-shopwin :is(.sh-pass, .sh-dailyhead, .sh-aurumhead) { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-width: 2px; border-style: solid; }
.px-shopwin .sh-passname, .px-shopwin .sh-secname { margin: 0; font-size: 22px; color: #ffe2a8; letter-spacing: 0.05em; }
.px-shopwin .sh-passlook, .px-shopwin .sh-secline { margin: 0; font-size: 13.5px; line-height: 1.45; color: #e2dccd; }
.px-shopwin .sh-sectop { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 14px; }
.px-shopwin .sh-turns { font-size: 13px; color: #9fdcff; font-variant-numeric: tabular-nums; }
.px-shopwin .sh-deeds { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 6px; }
.px-shopwin .sh-deed { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 6px 10px; border-width: 1px; border-style: solid; font-size: 13px; color: #e2dccd; }
.px-shopwin .sh-deedpay { font-size: 12.5px; color: #ffe29a; white-space: nowrap; font-variant-numeric: tabular-nums; }
.px-shopwin .sh-deed-done .sh-deedname { opacity: 0.7; }
.px-shopwin .sh-deed-done .sh-deedpay { color: #9fe8b4; }
.px-shopwin .sh-aurumhead { flex-direction: row; align-items: center; gap: 14px; }
.px-shopwin .sh-aurumcoin { width: 56px; height: 56px; flex: none; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.6)); }
.px-shopwin .sh-aurumwords { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.px-shopwin .sh-stages { list-style: none; margin: 8px 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.px-shopwin .sh-stagechip { position: relative; display: flex; flex-direction: column; gap: 2px; padding: 6px 8px 8px; border-width: 1px; border-style: solid; font-size: 12px; color: #e2dccd; }
.px-shopwin .sh-stagechip.sh-stage-open::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: #9fdcff; }   /* the open stage's bar, under the chip's own ring */
.px-shopwin .sh-stagechip.sh-stage-done { opacity: 0.6; }
.px-shopwin .sh-stagenum { font-size: 11px; letter-spacing: 0.18em; color: #d8b56a; }
.px-shopwin .sh-stagename { font-size: 13.5px; color: #ffe2a8; }
.px-shopwin .sh-stagewhen { color: var(--dim); }
.px-shopwin .sh-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.px-shopwin .sh-subhead { margin: 4px 0 0; padding-bottom: 3px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #d8b56a; border-bottom-width: 1px; border-bottom-style: solid; }
/* THE OPEN STAGE'S CHALLENGES: one set of columns for every row (AUDIT-STOREFRONT II, lane E 10) */
.px-shopwin .sh-challenges { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr) 120px max-content max-content; gap: 6px 10px; }
.px-shopwin .sh-challenge { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; align-items: center; font-size: 13px; color: #e2dccd; }
.px-shopwin .sh-cdone .sh-cwhat { color: #9fe8b4; }
.px-shopwin .sh-cdone .sh-cwhat::before { content: '\\2713  '; }
.px-shopwin .sh-ccount { font-variant-numeric: tabular-nums; color: var(--dim); text-align: right; }
${PASS_CSS}
.sh-waretag { display: inline-flex; align-items: center; gap: .35em; }
.sh-waretag-glyph { width: 1.2em; height: 1.2em; }
/* NARROW: a panel's words under its stage; a challenge's meter on a row of its own */
@media (max-width: 640px) {
  .px-win.px-shopwin { height: 94dvh; }
  .px-win.px-shopwin .px-body { padding: 10px 10px 8px; }
  .px-shopwin .sh-ware { grid-template-columns: 1fr; }
  .px-shopwin .sh-stage { min-height: 200px; }
  .px-shopwin .sh-stage-aura, .px-shopwin .sh-stage-armory, .px-shopwin .sh-stage-kill, .px-shopwin .sh-stage-portal { min-height: 240px; }
  .px-shopwin .sh-bigtitle { font-size: min(30px, calc(88cqw / (var(--n, 10) * 0.7))); }
  .px-shopwin .sh-stages { grid-template-columns: 1fr; }
  .px-shopwin .sh-challenges { grid-template-columns: minmax(0, 1fr) auto auto; }
  .px-shopwin .sh-cmeter { grid-column: 1 / -1; grid-row: 2; }
  .px-shopwin .sh-tab { font-size: 12.5px; padding: 4px 7px; letter-spacing: 0.06em; }
}
/* AUDIT-STOREFRONT III C16: a phone's sections in one row that scrolls sideways - wrapped, they took half its height */
@media (max-width: 640px), (max-height: 480px) {
  .px-shopwin .sh-tabs { flex-wrap: nowrap; justify-content: flex-start; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; flex-shrink: 0; }
  .px-shopwin .sh-tabs::-webkit-scrollbar { display: none; }
  .px-shopwin .sh-tab { flex: none; }
}
/* SHORT (AUDIT-STOREFRONT II, lane E 6): the standing part tighter and the featured stage lower, so a section's tabs and
   its first panel are in sight at 600 px; on a phone on its side, the disclaimer on one line and the stages lower still */
@media (max-height: 760px) {
  .px-win.px-shopwin { height: 94dvh; }
  .px-win.px-shopwin .px-body { padding-top: 10px; gap: 8px; }
  .px-shopwin .sh-head { padding-bottom: 6px; }
  .px-shopwin .sh-slide .sh-stage { min-height: 200px; }
  .px-shopwin .sh-tab { min-height: 36px; }
}
@media (max-height: 480px) {
  .px-win.px-shopwin { height: 98dvh; }
  .px-win.px-shopwin .px-body { padding: 6px 10px 6px; gap: 6px; }
  .px-shopwin .sh-title { font-size: 17px; }
  .px-shopwin .sh-head { padding-bottom: 4px; }
  .px-shopwin .sh-close { min-height: 34px; }
  .px-shopwin .sh-proceeds { padding: 4px 10px; }
  .px-shopwin .sh-proceeds-main { font-size: 12.5px; }
  .px-shopwin .sh-proceeds-sub { font-size: 11.5px; }
  .px-shopwin .sh-tab { min-height: 32px; padding: 2px 6px; font-size: 12px; }
  .px-shopwin .sh-tabcount { display: none; }
  .px-shopwin .sh-ware { grid-template-columns: minmax(180px, 0.9fr) 1fr; gap: 10px; }
  .px-shopwin .sh-panel { padding: 8px; }
  .px-shopwin .sh-stage, .px-shopwin .sh-slide .sh-stage, .px-shopwin .sh-stage-aura, .px-shopwin .sh-stage-armory, .px-shopwin .sh-stage-kill, .px-shopwin .sh-stage-portal { min-height: 170px; }
  .px-shopwin .sh-slide .sh-look { display: none; }
  .px-shopwin .sh-name { font-size: 18px; }
}
/* WIDE: a larger window, the wares two to a row - each its stage over its words - and a section's head across both;
   PASS-PANELS: the folios across both */
@media (min-width: 1440px) and (min-height: 820px) {
  .px-win.px-shopwin { width: min(1180px, 90vw); height: min(900px, 90dvh); }
  .px-shopwin .sh-panels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; }
  .px-shopwin .sh-panels > :is(.sh-pass, .sh-dailyhead, .sh-aurumhead, .sh-folios, .sh-pchal) { grid-column: 1 / -1; }
  .px-shopwin .sh-pitems { --card: 164px; }
  .px-shopwin .sh-pitempic { height: 104px; }
  .px-shopwin .sh-pitemart { width: 76px; height: 76px; }
  .px-shopwin .sh-panels > .sh-panel { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  .px-shopwin .sh-slide { grid-template-columns: minmax(360px, 1.3fr) 1fr; }
  .px-shopwin .sh-slide .sh-stage { min-height: 340px; }
}
@media (prefers-reduced-motion: reduce) {
  .px-shopwin .sh-slidein { animation: none; }
}
:root[data-plus-theme="stone"] .px-shopwin { --dim: #e2dccd; text-shadow: 1px 1px 0 rgba(5,6,8,0.85); }
:root[data-plus-theme="stone"] .px-shopwin :is(.sh-ppanelnum, .sh-subhead) { color: #e8c98a; }   /* AUDIT-STOREFRONT III C7: #d8b56a read 4.3:1 */
/* AUDIT-STOREFRONT III C15: a finger's press is 44 pixels at the least */
@media (pointer: coarse) {
  .px-shopwin :is(.sh-close, .sh-tab, .sh-cprev, .sh-cnext, .sh-cpause, .sh-pageprev, .sh-pagenext, .sh-pagetab, .sh-fback) { min-height: 44px; }
  .px-shopwin .sh-pitem :is(.sh-buy, .sh-wear, .sh-getaurum) { min-height: 44px; }
  .px-shopwin .sh-cdot { width: 44px; height: 44px; min-width: 44px; min-height: 44px; }
  .px-shopwin .sh-pagetab { min-width: 44px; justify-content: center; }
  .px-shopwin .sh-terms { display: inline-flex; align-items: center; min-height: 44px; }
}
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
