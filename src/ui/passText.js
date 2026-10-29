// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md): THE PASS'S WORDS - the season's name and story, its stages',
// each challenge's and booster's, and a reward's name by its grant, in the player's language. One home for the shop's
// Battle Pass section and the season's notices in the world. Not a DFU member.
import { t } from '../systems/textManager.js';
import { TITLE_TEXT, AURA_TEXT } from './playerBadge.js';
import { ICON_TEXT } from './profileIcons.js';
import { GLYPH_LABEL } from './enhanced/enhancedAccount.js';
import { effectName } from './effectText.js';
import { PASS_BOOSTS, passChallengeOf } from '../net/battlePassLaw.js';

/** Each season's name and its story in two sentences. */
export const PASS_SEASON_TEXT = Object.freeze({ s1: () => t('pass.season.s1', "Dwemer's Breach") });
export const PASS_SEASON_LOOK = Object.freeze({
  s1: () => t('pass.look.s1', 'A tremor runs under the Iliac Bay. Brass fissures open, Dwemer constructs walk again, and something vast wakes below.'),
});
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
  endgame: (n) => t('pass.ch.endgame', 'Win {n, plural, one {# endgame fight} other {# endgame fights}}: a breach, a Redoubt, the Serpent or a star', { n }),
  elites: (n) => t('pass.ch.elites', 'Kill {n, plural, one {# elite or champion} other {# elites or champions}}', { n }),
  make: (n) => t('pass.ch.make', 'Make or find {n, plural, one {# item} other {# items}}', { n }),
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
/** A booster's look: its share and the levels it gives - AUDIT PASS 12: and that a level past the open stage's top waits
 *  for the next stage (passLevelOf holds it there), which a paid line has to say. */
export function passBoostText(/** @type {string} */ id) {
  const b = Object.hasOwn(PASS_BOOSTS, id) ? PASS_BOOSTS[/** @type {keyof typeof PASS_BOOSTS} */ (id)] : null;
  if (!b) return '';
  const share = t('pass.boost.share', '{pct}% more season experience from every deed, for the whole season.', { pct: Math.round((b.mult - 1) * 100) });
  return b.levels ? `${share} ${t('pass.boost.levels', 'And {n} levels at once. Levels past the open stage are kept for the next.', { n: b.levels })}` : share;
}
/** The season's notices in the world (scenes/seasonHost.js): a level reached with its rewards, a challenge paid, the day's
 *  experience spent. */
export const PASS_EVENT_TEXT = Object.freeze({
  level: (/** @type {number} */ level) => t('pass.event.level', 'Season level {level}!', { level }),
  rewards: (/** @type {string} */ list) => t('pass.event.rewards', 'New in your wardrobe: {list}.', { list }),
  challenge: (/** @type {string} */ text) => t('pass.event.challenge', 'Season challenge done: {text}.', { text }),
  full: () => t('pass.event.full', 'You have found all the season experience you can today. More tomorrow.'),
});
/** Each grant's kind, as a reward chip says it. */
const KIND_WORD = Object.freeze({
  title: () => t('pass.kind.title', 'Title'), glyph: () => t('pass.kind.glyph', 'Glyph'), icon: () => t('pass.kind.icon', 'Portrait'),
  aura: () => t('pass.kind.aura', 'Aura'), kill: () => t('pass.kind.kill', 'Kill effect'), portal: () => t('pass.kind.portal', 'Portal skin'),
  mount: () => t('pass.kind.mount', 'Mount look'),
});
/** A reward's kind in words. */
export const passGrantKind = (/** @type {string} */ grant) => KIND_WORD[/** @type {keyof typeof KIND_WORD} */ (grant.slice(0, grant.indexOf(':')))]?.() ?? '';
/** A reward's name in the player's words, its key where it has none. */
export function passGrantName(/** @type {string} */ grant) {
  const i = grant.indexOf(':'), kind = grant.slice(0, i), key = grant.slice(i + 1);
  const table = kind === 'title' ? TITLE_TEXT : kind === 'aura' ? AURA_TEXT : kind === 'icon' ? ICON_TEXT : kind === 'glyph' ? GLYPH_LABEL : null;
  if (table) return /** @type {any} */ (table)[key] ?? key;
  return kind === 'kill' || kind === 'portal' || kind === 'mount' ? effectName(kind, key) : key;
}
