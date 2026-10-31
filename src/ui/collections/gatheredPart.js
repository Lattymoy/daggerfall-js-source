// @ts-check
// HUNTERS-MARK (2026-10-27; bible/10-UI/Collections.md section 10): THE GATHERED PARTS - the trophies a character has
// taken and the fish its net has brought up (systems/hunt/gatheredLog.js, its save's), and the pages of the Annals of
// 3E 398 the account keeps (the wardrobe's `annals`, server-account/src/index.js). Each lists the whole set, held or
// not, and says how the rest is had. A horse's coats are no part: the stable keeps the horses a character has now, never
// the coats it has owned, so such a list would forget a coat sold.
// MUSIC-BOX (2026-10-31): and the Tunes - every song a music box can play, its sheet read or not (systems/musicBox.js).
import { t, getLocalizedItemName } from '../../systems/textManager.js';
import { gatheredOf } from '../../systems/hunt/gatheredLog.js';
import { TROPHY_BEASTS, trophyBeastName } from '../../systems/hunt/trophies.js';
import { PASSIVE_FISH_SPECIES } from '../../world/passiveFish.js';
import { EG_ANNALS, EG_ANNALS_FOUND } from '../../net/eliteGates/egAnnals.js';
import { wordPair } from './wardrobeCatalogue.js';
import { MUSIC_TUNES, tunesHeard, tuneCount, tuneName } from '../../systems/musicBox.js';   // MUSIC-BOX: the Tunes part

/** The parts, in the switch's order after the codex and the cards: the character's three, then the account's. */
export const GATHERED_PARTS = Object.freeze([
  wordPair('trophies', () => t('coll.part.trophies', 'Trophies')),
  wordPair('fish', () => t('coll.part.fish', 'Fish')),
  wordPair('tunes', () => t('coll.part.tunes', 'Tunes')),   // MUSIC-BOX: the songs a music box can play
  wordPair('annals', () => t('coll.part.annals', 'Annals')),
]);
export const isGatheredPart = (/** @type {string} */ id) => GATHERED_PARTS.some(([k]) => k === id);

/** The bits of the pages an account keeps (`players.eg_annals`, a bit a page, the first 31 pages). */
export const annalsHeldOf = (/** @type {any} */ wardrobe) => {
  const bits = Number(wardrobe?.annals);
  if (!Number.isSafeInteger(bits) || bits < 0) return null;
  return EG_ANNALS.map((_, p) => p).filter((p) => p < 31 && (bits & (1 << p)) !== 0);
};
/** The beasts the Trophies part lists: every beast a trophy can be of, then a mod's beast once taken. */
const trophyKeys = () => [...new Set([...TROPHY_BEASTS, ...Object.keys(gatheredOf('trophies')).map(Number)])];

/** A part's count, `{ held, total }` - held null where it cannot be known (the account not read). */
export function gatheredCount(/** @type {string} */ id, /** @type {any} */ wardrobe) {
  if (id === 'trophies') { const have = gatheredOf('trophies'); const keys = trophyKeys(); return { held: keys.filter((k) => have[k]).length, total: keys.length }; }
  if (id === 'tunes') return tuneCount();
  if (id === 'fish') { const have = gatheredOf('fish'); return { held: PASSIVE_FISH_SPECIES.filter((s) => have[s.templateIndex]).length, total: PASSIVE_FISH_SPECIES.length }; }
  const held = annalsHeldOf(wardrobe);
  return { held: held ? held.length : null, total: EG_ANNALS.length };
}

/** The UTC day a row was first gathered on, as a date. */
const dateOf = (/** @type {number} */ day) => new Date(day * 86_400_000).toISOString().slice(0, 10);

/** One row: its name (or "Unfound"), and under it its count and first day, or how it is had. */
function line(/** @type {Function} */ el, /** @type {string} */ name, /** @type {string} */ sub, /** @type {boolean} */ found) {
  const r = el('div', `codex-line${found ? ' found' : ''}`);
  r.append(el('span', 'nm', name), el('span', 'sub', sub));
  return r;
}

/**
 * A GATHERED PART into `detail`. `wardrobe` the account's, or null (nobody signed in, the read not back).
 * @param {any} detail @param {{ el: Function, divider: Function }} kit @param {string} id @param {any} wardrobe
 */
export function drawGatheredPart(detail, { el, divider }, id, wardrobe) {
  const list = el('div', 'codex-list');
  if (id === 'trophies') {
    const have = gatheredOf('trophies');
    const n = gatheredCount(id, wardrobe);
    detail.append(divider(t('coll.trophies.head', 'Trophies - {n} of {total} beasts', { n: n.held, total: n.total })));
    detail.append(el('p', 'coll-acct', t('coll.trophies.how', 'A named beast from a bounty board gives one, and so does a Trophy Hunter\'s clean pelt of a grade 5 or 6 body.')));
    for (const foe of trophyKeys()) {
      const row = have[foe];
      list.append(line(el, trophyBeastName(foe), row ? t('coll.gathered.row', '{n} taken · first on {date}', { n: row.n, date: dateOf(row.day) }) : t('coll.trophies.none', 'No trophy yet'), !!row));
    }
  } else if (id === 'fish') {
    const have = gatheredOf('fish');
    const n = gatheredCount(id, wardrobe);
    detail.append(divider(t('coll.fish.head', 'Fish - {n} of {total} kinds', { n: n.held, total: n.total })));
    detail.append(el('p', 'coll-acct', t('coll.fish.how', 'Cast a Fishing-Net in water. Each water has its own fish.')));
    for (const s of PASSIVE_FISH_SPECIES) {
      const row = have[s.templateIndex];
      list.append(line(el, getLocalizedItemName(s.templateIndex, s.itemName), row ? t('coll.fish.row', '{n} hauls · first on {date}', { n: row.n, date: dateOf(row.day) }) : t('coll.fish.none', 'Not caught yet'), !!row));
    }
  } else if (id === 'tunes') {
    const have = tunesHeard();
    const n = tuneCount();
    detail.append(divider(t('coll.tunes.head', 'Tunes - {n} of {total} songs', { n: n.held, total: n.total })));
    detail.append(el('p', 'coll-acct', t('coll.tunes.how', 'Foes sometimes drop sheet music. Use a sheet to add its tune. Make a placed piece a Music box in your house to play them.')));
    for (const x of MUSIC_TUNES) {
      const day = have[x.key];
      list.append(line(el, tuneName(x.key), day != null ? t('coll.tunes.row', 'Learned on {date}', { date: dateOf(day) }) : t('coll.tunes.none', 'Not found yet'), day != null));
    }
  } else {
    const held = annalsHeldOf(wardrobe);
    detail.append(divider(t('coll.annals.head', 'The Annals of 3E 398 - {n} of {total} pages', { n: held ? held.length : '–', total: EG_ANNALS.length })));
    if (!held) detail.append(el('p', 'coll-acct', t('coll.annals.signIn', 'Sign in to your account to read the pages it keeps.')));
    EG_ANNALS.forEach(([title, text], p) => {
      const found = !!held?.includes(p);
      const how = p < EG_ANNALS_FOUND ? t('coll.annals.hidden', 'Hidden in the Elite Breach\'s halls') : t('coll.annals.lord', 'Given at a lord\'s first fall');
      list.append(line(el, found ? title : t('coll.codex.unfound', 'Unfound'), found ? text : how, found));
    });
  }
  detail.append(list);
}
