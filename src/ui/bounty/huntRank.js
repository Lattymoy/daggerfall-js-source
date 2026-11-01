// @ts-check
// HUNTERS-MARK (2026-10-27; bible/06-Systems/Bounty-Boards.md 12.3): THE HUNTER'S RANK IN WORDS - the rungs' names, the
// bounty board's header line (ui/bounty/bountyWindow.js) and the Standing page's block (ui/enhanced/enhancedMenu.js
// statsStanding), each read off the hunt's book (net/huntBook.js) - the account service's count, never the save's.
import { t } from '../../systems/textManager.js';
import { huntBook } from '../../net/huntBook.js';
import { HUNT_RUNGS, HUNT_MARK_RUNG, huntRungOf, huntNextRung, HUNT_TITLES } from '../../net/huntLaw.js';
import { TITLE_TEXT } from '../playerBadge.js';
import { accountRefusalText } from '../../net/accountClient.js'; // AUDIT HORIZONTAL F4: a guest's line, the refusal's own words

/** Each rung's name, as a player reads it. */
export const RUNG_WORDS = Object.freeze({
  unblooded: () => t('hunt.rung.unblooded', 'Unblooded'),
  tracker: () => t('hunt.rung.tracker', 'Tracker'),
  hunter: () => t('hunt.rung.hunter', 'Hunter'),
  stalker: () => t('hunt.rung.stalker', 'Stalker'),
  slayer: () => t('hunt.rung.slayer', 'Slayer'),
  huntmaster: () => t('hunt.rung.huntmaster', 'Huntmaster'),
});
export const rungName = (/** @type {string} */ id) => RUNG_WORDS[/** @type {keyof typeof RUNG_WORDS} */ (id)]?.() ?? id;

/** The words of a rank: `head` "Stalker · 52 bounties", `region` "7 here", `next` "Slayer at 100". `rank` the bounty
 *  host's (scenes/huntersMark.js boardRank). */
export function rankWords(/** @type {any} */ rank) {
  if (rank?.closed) return { head: accountRefusalText('hunt-need-account'), region: '', next: '' };
  if (!rank || rank.reading)
    return { head: t('hunt.rank.reading', "Reading your hunter's rank…"), region: '', next: '' };
  return {
    head: t('hunt.rank.head', '{rung} · {n, plural, one {# bounty} other {# bounties}}', {
      rung: rungName(rank.rung),
      n: rank.clears,
    }),
    region: rank.region == null ? '' : t('hunt.rank.region', '{n} in this region', { n: rank.region }),
    next: rank.next
      ? t('hunt.rank.next', '{rung} at {n}', { rung: rungName(rank.next.id), n: rank.next.at })
      : t('hunt.rank.top', 'The top rung'),
  };
}
/** How far to the next rung, 0..1 (1 at the top). */
export const rankShare = (/** @type {any} */ rank) =>
  !rank?.next ? 1 : Math.max(0, Math.min(1, (rank.clears - rank.from) / Math.max(1, rank.next.at - rank.from)));

/** The board's header line - the rung and the clears, this region's, a bar to the next rung - or null offline. */
export function rankLine(
  /** @type {(tag: string, cls?: string|null, text?: string|null) => any} */ el,
  /** @type {any} */ rank,
) {
  if (!rank) return null;
  const w = rankWords(rank);
  const box = el('div', 'bounty-rank');
  box.append(el('b', null, w.head));
  if (w.region) box.append(el('span', 'bounty-rankregion', w.region));
  if (!rank.reading && !rank.closed) {
    const bar = el('span', 'bounty-rankbar');
    const fill = el('i');
    fill.style.width = `${Math.round(rankShare(rank) * 100)}%`;
    bar.append(fill);
    box.append(bar, el('span', 'bounty-ranknext', w.next));
    if (rank.waiting > 0)
      box.append(el('span', 'bounty-rankwait', t('hunt.rank.waiting', '{n} still to count', { n: rank.waiting })));
  }
  return box;
}

/**
 * THE STANDING PAGE'S HUNT: the rung, the bar, the named beasts slain and the account's own count - online, once the book
 * has the service's word (asked here when it has none).
 * @param {any} detail @param {{ el: Function, divider: Function, meter: Function }} kit
 */
export function statsHunt(detail, { el, divider, meter }) {
  const book = huntBook();
  if (!book) return;
  detail.append(divider(t('hunt.standing.title', 'The Hunt')));
  const s = book.state;
  // AUDIT HORIZONTAL F4: a guest's account keeps no rank - said once; the book's own beat asks again, never each draw
  if (book.closed) {
    detail.append(el('p', 'px-note', accountRefusalText('hunt-need-account')));
    return;
  }
  if (!s) {
    book.tick();
    detail.append(el('p', 'px-note', t('hunt.rank.reading', "Reading your hunter's rank…")));
    return;
  }
  const i = huntRungOf(s.clears);
  const next = huntNextRung(s.clears);
  const row = el('div', 'px-stat px-hunt');
  row.append(
    el('span', 'k', rungName(HUNT_RUNGS[i].id)),
    el('span', 'v', t('hunt.standing.clears', '{n, plural, one {# bounty} other {# bounties}}', { n: s.clears })),
  );
  detail.append(row);
  if (next) {
    detail.append(meter(s.clears - HUNT_RUNGS[i].at, next.at - HUNT_RUNGS[i].at));
    detail.append(
      el('p', 'px-note', t('hunt.standing.next', '{rung} at {n} bounties.', { rung: rungName(next.id), n: next.at })),
    );
  }
  detail.append(
    el(
      'p',
      'px-note',
      i >= HUNT_MARK_RUNG
        ? t('hunt.standing.marks', 'Named beasts slain: {n}. The boards post one a week.', { n: s.marks ?? 0 })
        : t('hunt.standing.marksAt', 'At {rung}, the boards post you a named beast each week.', {
            rung: rungName(HUNT_RUNGS[HUNT_MARK_RUNG].id),
          }),
    ),
  );
  const acct = s.account?.clears;
  const title = HUNT_TITLES.find(([, n]) => (acct ?? 0) < n);
  if (Number.isSafeInteger(acct))
    detail.append(
      el(
        'p',
        'px-note',
        title
          ? t('hunt.standing.account', 'Your account: {n} bounties. The title {title} at {at}.', {
              n: acct,
              title: TITLE_TEXT[/** @type {keyof typeof TITLE_TEXT} */ (title[0])],
              at: title[1],
            })
          : t('hunt.standing.accountAll', 'Your account: {n} bounties. Every hunt title is yours.', { n: acct }),
      ),
    );
}
