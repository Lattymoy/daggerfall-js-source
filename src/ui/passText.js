// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md): THE PASS'S WORDS - the season's name and story, its stages',
// each challenge's, an item's name and kind by its grant, and the season's notices, in the player's language. PASS-PANELS
// (2026-10-30): no levels or boosters - the tracks are bought with Aurum, and (the owner: "It shouldnt be called battle
// pass. Something more lore accurate") the player reads FOLIOS: a track a folio, a panel a page. One home for the shop's
// Folios section and the season's notices in the world. Not a DFU member.
import { t } from '../systems/textManager.js';
import { TITLE_TEXT, AURA_TEXT } from './playerBadge.js';
import { ICON_TEXT } from './profileIcons.js';
import { GLYPH_LABEL } from './enhanced/enhancedAccount.js';
import { effectName } from './effectText.js';
import { passChallengeOf } from '../net/battlePassLaw.js';

/** Each season's name and its story in two sentences. */
export const PASS_SEASON_TEXT = Object.freeze({ s1: () => t('pass.season.s1', "Dwemer's Breach") });
export const PASS_SEASON_LOOK = Object.freeze({
  s1: () => t('pass.look.s1', 'A tremor runs under the Iliac Bay. Brass fissures open, Dwemer constructs walk again, and something vast wakes below.'),
});
/** PASS-PANELS: each season's two folios by track - the free track's and the premium track's. */
export const PASS_FOLIO_TEXT = Object.freeze({
  s1: Object.freeze({ free: () => t('pass.folio.s1.free', 'The Brass Folio'), premium: () => t('pass.folio.s1.premium', 'The Gilded Folio') }),
});
/** A folio's name, by its season and track. */
export const passFolioName = (/** @type {string} */ season, /** @type {string} */ track) =>
  /** @type {any} */ (PASS_FOLIO_TEXT)[season]?.[track]?.() ?? t('shop.pass.folio', 'Folio');
/** Each stage's name. */
export const PASS_STAGE_TEXT = Object.freeze({
  tremor: () => t('pass.stage.tremor', 'The Tremor'),
  halls: () => t('pass.stage.halls', 'The Brass Halls'),
  heart: () => t('pass.stage.heart', 'The Heart Wakes'),
});
/** Each challenge's family's words, its count `n` an argument - so a language writes its own plural forms. */
const CHALLENGE_WORDS = Object.freeze({
  foes: (n) => t('pass.ch.foes', 'Kill {n, plural, one {# foe} other {# foes}}', { n }),
  constructs: (n) => t('pass.ch.constructs', 'Destroy {n, plural, one {# Dwemer construct} other {# Dwemer constructs}}', { n }),
  gather: (n) => t('pass.ch.gather', 'Gather {n, plural, one {# time} other {# times}}', { n }),
  tavern: (n) => t('pass.ch.tavern', 'Win {n, plural, one {# tavern game} other {# tavern games}}', { n }),
  endgame: (n) => t('pass.ch.endgame', 'Win {n, plural, one {# endgame fight} other {# endgame fights}}: a breach, a Redoubt, the Serpent, the Dwarven Dragon or a star', { n }),
  elites: (n) => t('pass.ch.elites', 'Kill {n, plural, one {# elite or champion} other {# elites or champions}}', { n }),
  // AUDIT-STOREFRONT II (lane B 4): what its sources count (battlePassLaw.js PASS_CHALLENGES `make`, `loot`) - never a find
  make: (n) => t('pass.ch.make', 'Make, socket or reforge {n, plural, one {# item} other {# items}}', { n }),
  world: (n) => t('pass.ch.world', 'Finish {n, plural, one {# world event, quest or bounty} other {# world events, quests or bounties}}', { n }),
  sea: (n) => t('pass.ch.sea', 'Gather or win at sea {n, plural, one {# time} other {# times}}', { n }),
});
/** A challenge's words, its count in them - '' for a key the law does not know. */
export function passChallengeText(/** @type {string} */ key) {
  const c = passChallengeOf(key);
  if (!c) return '';
  const fam = /** @type {keyof typeof CHALLENGE_WORDS} */ (key.slice(key.indexOf('-') + 1));
  return CHALLENGE_WORDS[fam]?.(c.n) ?? '';
}
/** The season's notices in the world (scenes/seasonHost.js): a challenge done and the Aurum it paid, and the day's Aurum
 *  from finds all found. */
export const PASS_EVENT_TEXT = Object.freeze({
  challenge: (/** @type {string} */ text, /** @type {number} */ n) => t('pass.event.challengeAurum', 'Season challenge done: {text}. {n, number} Aurum is yours.', { text, n }),
  full: () => t('pass.event.fullAurum', 'You have found all the Aurum you can today. More tomorrow.'),
});
/** Each grant's kind, as an item's card says it. */
const KIND_WORD = Object.freeze({
  title: () => t('pass.kind.title', 'Title'), glyph: () => t('pass.kind.glyph', 'Glyph'), icon: () => t('pass.kind.icon', 'Profile icon'),
  aura: () => t('pass.kind.aura', 'Aura'), kill: () => t('pass.kind.kill', 'Kill effect'), portal: () => t('pass.kind.portal', 'Portal skin'),
  mount: () => t('pass.kind.mount', 'Mount look'),
});
/** An item's kind in words. */
export const passGrantKind = (/** @type {string} */ grant) => KIND_WORD[/** @type {keyof typeof KIND_WORD} */ (grant.slice(0, grant.indexOf(':')))]?.() ?? '';
/** An item's name in the player's words, its key where it has none. */
export function passGrantName(/** @type {string} */ grant) {
  const i = grant.indexOf(':'), kind = grant.slice(0, i), key = grant.slice(i + 1);
  const table = kind === 'title' ? TITLE_TEXT : kind === 'aura' ? AURA_TEXT : kind === 'icon' ? ICON_TEXT : kind === 'glyph' ? GLYPH_LABEL : null;
  if (table) return /** @type {any} */ (table)[key] ?? key;
  return kind === 'kill' || kind === 'portal' || kind === 'mount' ? effectName(kind, key) : key;
}

/** PASS-PANELS: a page's number as its tab says it (`p` from 0): I, II, III. AUDIT-STOREFRONT III C4: `arabic` 1, 2, 3 -
 *  the Grimoire's Alagard draws a capital I as a 1, so its II read 11. */
export const passPanelNumeral = (/** @type {number} */ p, arabic = false) => (arabic ? String(p + 1) : ['I', 'II', 'III', 'IV', 'V', 'VI'][p] ?? String(p + 1));
/** PASS-PANELS: THE FOLIOS' WORDS, as the shop's Folios section says them (ui/enhanced/enhancedPass.js). */
export const PASS_PANEL_TEXT = Object.freeze({
  how: () => t('shop.pass.howFolios', 'Spend Aurum on any item of an open page. Each page opens once you spend enough in its folio. The folios never close.'),
  freeLine: () => t('shop.pass.freeLine', 'Every registered account can buy from it.'),
  premiumLine: () => t('shop.pass.premiumLine', 'Unlock it once with Aurum, then buy its items. It never expires.'),
  premiumOpen: () => t('shop.pass.premiumOpen', 'Unlocked. It is yours for good.'),
  holds: (/** @type {number} */ n) => t('shop.pass.holds', '{n, plural, one {# item} other {# items}}', { n }),
  owned: (/** @type {number} */ n, /** @type {number} */ m) => t('shop.pass.panelOwned', '{n} of {m} owned', { n, m }),
  free: () => t('shop.pass.free', 'Free'),
  unlocked: () => t('shop.pass.unlocked', 'Unlocked'),
  locked: () => t('shop.pass.locked', 'Locked'),
  open: () => t('shop.pass.open', 'Open'),
  coverLabel: (/** @type {string} */ name, /** @type {string} */ state, /** @type {number} */ n, /** @type {number} */ m) => t('shop.pass.coverLabel', '{name}: {state}, {n} of {m} owned. Open it.', { name, state, n, m }),
  back: () => t('shop.pass.back', 'Back'),
  backLabel: () => t('shop.pass.backLabel', 'Back to the folios'),
  page: (/** @type {string} */ n) => t('shop.pass.page', 'Page {n}', { n }),
  pages: (/** @type {string} */ name) => t('shop.pass.pages', 'The pages of {name}', { name }),
  pageTab: (/** @type {string} */ n, /** @type {string} */ state) => t('shop.pass.pageTab', 'Page {n}: {state}', { n, state }),
  prev: () => t('shop.pass.prev', 'Previous page'),
  next: () => t('shop.pass.next', 'Next page'),
  pageLocked: (/** @type {number} */ n) => t('shop.pass.pageLocked', 'Spend {n, number} more Aurum in this folio to open this page.', { n }),
  pageFolio: () => t('shop.pass.pageFolioLocked', 'Unlock this folio to open this page.'),   // AUDIT-STOREFRONT III C17: no name mid-sentence
  spent: (/** @type {number} */ n) => t('shop.pass.spent', '{n, number} Aurum spent', { n }),
  found: (/** @type {number} */ n, /** @type {number} */ max) => t('shop.pass.found', 'Aurum found today: {n, number} of {max, number}', { n, max }),
  foundLabel: () => t('shop.pass.foundLabel', 'Aurum your deeds found today'),
  foundLine: () => t('shop.pass.foundLine', 'Deeds find Aurum each day, up to a limit. Challenges pay their Aurum beside it.'),
  unlock: (/** @type {number} */ n) => t('shop.pass.unlock', 'Unlock for {n, number} Aurum', { n }),
  unlockLabel: (/** @type {string} */ name, /** @type {number} */ n) => t('shop.pass.unlockFolio', 'Unlock {name} for {n, number} Aurum', { name, n }),
  unlockConfirm: (/** @type {number} */ n) => t('shop.pass.unlockConfirm', 'Confirm: {n, number} Aurum', { n }),
  unlockConfirmLabel: (/** @type {string} */ name, /** @type {number} */ n) => t('shop.pass.unlockFolioConfirm', 'Confirm: unlock {name} for {n, number} Aurum', { name, n }),
  price: (/** @type {number} */ n) => t('shop.pass.price', '{n, number} Aurum', { n }),
  buy: () => t('shop.pass.buy', 'Buy'),
  buyLabel: (/** @type {string} */ name, /** @type {number} */ n) => t('shop.pass.buyLabel', 'Buy {name} for {n, number} Aurum', { name, n }),
  confirm: () => t('shop.pass.confirm', 'Confirm'),
  confirmLabel: (/** @type {string} */ name, /** @type {number} */ n) => t('shop.pass.confirmLabel', 'Confirm: buy {name} for {n, number} Aurum', { name, n }),
  buying: () => t('shop.pass.buying', 'Buying...'),   // AUDIT-STOREFRONT III C12: a spend's press while its answer is out
  unlocking: () => t('shop.pass.unlocking', 'Unlocking...'),
  itemOwned: () => t('shop.state.held', 'Owned'),
  short: (/** @type {number} */ n) => t('shop.daily.short', 'You need {n, number} more Aurum', { n }),
  getAurum: () => t('shop.daily.get', 'Get Aurum'),
  signIn: () => t('shop.pass.signInFolios', 'Sign in with a username to buy from the Folios.'),
  guest: () => t('shop.who.guest', 'A guest account cannot buy. Add a username from your profile first.'),
  reading: () => t('shop.who.reading', 'Reading your account...'),
  closed: () => t('shop.pass.closedFolios', 'The Folios are not open yet.'),
  soon: (/** @type {string} */ day) => t('shop.pass.soonFolios', 'The Folios open on {day}.', { day }),
  // AUDIT-STOREFRONT III C5: why an item or the unlock offers no press, on it - the shop's own short words
  itemSoon: (/** @type {string} */ day) => t('shop.pass.opens', 'Opens {day}', { day }),
  itemClosed: () => t('shop.state.closed', 'Not on sale yet'),
  itemGuest: () => t('shop.state.guest', 'Needs a username'),
  itemOut: () => t('shop.state.out', 'Sign in to buy'),
  stageOpens: (/** @type {string} */ day) => t('shop.pass.opens', 'Opens {day}', { day }),
  stageUntil: (/** @type {string} */ day) => t('shop.pass.until', 'Until {day}', { day }),
  stageEnded: (/** @type {string} */ day) => t('shop.pass.ended', 'Ended {day}', { day }),
  challenges: () => t('shop.pass.challenges', 'This stage\'s challenges'),
  challengePay: (/** @type {number} */ n) => t('shop.deed.pay', '+{n, number} Aurum', { n }),
  over: () => t('shop.pass.overFolios', 'The season is over, and its challenges with it. Its folios stay open.'),
});
