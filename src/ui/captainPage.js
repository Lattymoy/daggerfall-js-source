// @ts-check
// CAPT-LOG (2026-10-11, bible/03-World/Captains-Sea.md) - THE CAPTAIN PAGE, on the pause menu's Holdings rail
// (ui/enhanced/enhancedMenu.js pauseHoldings), after the Fleet: a captain's standing with each of the Bay's three crowns - the
// rank it has named them and what that rank brings in its harbours, how far the next lies, and whether its harbours keep
// no favours for them (their notoriety in its waters PERKS_REFUSED_AT and over) - the letter of marque held, the contracts
// under way, and the captain's log. It stands beside the Fleet's page, wherever there are ships to captain (AUDIT
// CAPTAIN'S SEA L15: from a new character's first pause with Come Sail Away off, the Fleet hidden).
// The model is the host's (scenes/world.js, the Holdings provider's `captain`), so this page touches no runtime;
// dressed by the kit's roles as the Fleet's cards are.

import { holdingsProvider, ensureHoldingsStyle, holdingMeter } from './holdingsPages.js';
import { CROWN_RANKS, nextRankOf, PERKS_REFUSED_AT } from '../systems/naval/captainLedger.js';

export const CAPTAIN_PAGE_SECTIONS = Object.freeze([Object.freeze(['captain', 'Captain'])]);
/** The page stands while the host gives the captain's model (the world host, whose ledger it is). */
export const captainPageShown = () => typeof holdingsProvider()?.captain?.model === 'function';

const pc = (x) => `${Math.round(x * 100)}%`;
/** What a rank's favours are, in words - the page's line under a crown (none for an Unsworn captain). Pure. */
export function perkWords(p) {
  if (!p) return '';
  const out = [];
  if (p.yard) out.push(`the shipwright's repairs and powder ${pc(p.yard)} off`);   // AUDIT CAPTAIN'S SEA B15: his stores and grog are what they cost
  if (p.pay || p.offers) out.push(`the harbour board pays ${pc(p.pay)} more${p.offers ? `, ${p.offers} more ${p.offers === 1 ? 'offer' : 'offers'} a day` : ''}`);
  if (p.marque) out.push('a letter of marque');
  if (p.admiralty) out.push('the Admiralty\'s Carrack');
  if (p.seasoned) out.push('seasoned hands hired');
  if (p.relief) out.push('its navy always answers you');
  return out.join(' - ');
}
/** The standing's meter: from the rank's floor (an Unsworn captain's none, or the standing itself below it) to the next
 *  rank's, or full at the top - its label the standing the next still wants (AUDIT CAPTAIN'S SEA L5: a standing of -99
 *  read "15 to Sworn Captain" over an empty meter; it wants 114). Pure. */
export function standingMeter(standing, rank) {
  const floor = Number.isFinite(rank.at) ? rank.at : Math.min(0, standing);
  const next = CROWN_RANKS[rank.rank + 1];
  return next ? { now: Math.max(0, standing - floor), max: next.at - floor, label: `${nextRankOf(standing)?.wanting ?? 0} to ${next.title}` } : { now: 1, max: 1, label: 'The highest rank' };
}

/**
 * THE PAGE: `detail` the rail's detail pane; `kit` the menu's makers ({ el, divider, meter }).
 */
export function drawCaptainPage(detail, rerender, { el, divider, meter = null } = /** @type {any} */ ({})) {
  ensureHoldingsStyle();
  const m = holdingsProvider()?.captain?.model?.() ?? null;
  detail.append(divider('Captain'));
  if (!m) { detail.append(el('p', 'px-note', 'Your standing at sea is kept in the world.')); return; }
  detail.append(el('p', 'px-note', 'The Bay\'s three crowns judge a captain by the sea: pirates ended in their waters and their harbours\' contracts done raise you; piracy against their ships lowers you. Each rank brings favours in that crown\'s harbours.'));
  const list = el('div', 'hld-list');
  for (const c of m.crowns ?? []) {
    const row = el('div', 'hld-refit');
    const head = el('div', 'hld-head');
    const refused = (c.notoriety ?? 0) >= (m.refusedAt ?? PERKS_REFUSED_AT);
    head.append(el('span', 'hld-name', c.crown), el('span', `hld-state${refused ? ' is-lost' : c.rank.rank ? '' : ' is-away'}`, c.rank.title));
    row.append(head);
    row.append(el('span', 'hld-sub', `${c.ruler}'s waters - standing ${c.standing}`));
    const mtr = standingMeter(c.standing, c.rank);
    row.append(holdingMeter(el, meter, 'Rank', mtr.now, mtr.max, 'verdigris'));
    row.append(el('span', 'hld-sub', mtr.label));
    const words = perkWords(c.perks);
    if (refused) row.append(el('span', 'hld-why', 'Its harbours keep no favours for you while your notoriety in its waters stands so high.'));   // AUDIT CAPTAIN'S SEA L10: its navy hunts at twice it
    else if (words) row.append(el('span', 'hld-sub', `In its harbours: ${words}.`));
    list.append(row);
  }
  detail.append(list);
  // AUDIT CAPTAIN'S SEA L14/D16: the letter makes a rival's lawful ships - merchantmen and navies - prizes in its crown's eyes;
  // the rival still names it piracy
  if (m.marque) detail.append(el('p', 'hld-said', `Sailing under ${m.marque.crown}'s letter of marque - ${m.marque.days} ${m.marque.days === 1 ? 'day' : 'days'} left. Its rivals' ships are your prizes in ${m.marque.crown}'s eyes, though their own crowns still call it piracy; ${m.marque.crown}'s own ships are not.`));
  if (m.contracts?.length) {
    detail.append(divider(`Contracts (${m.contracts.length})`));
    const cl = el('div', 'hld-list');
    for (const k of m.contracts) {
      const row = el('div', 'hld-refit');
      const head = el('div', 'hld-head');
      head.append(el('span', 'hld-name', k.title), el('span', `hld-state${k.done ? '' : ' is-away'}`, k.state));
      row.append(head);
      if (k.line) row.append(el('span', 'hld-sub', k.line));
      cl.append(row);
    }
    detail.append(cl);
  }
  // CAPT-CHARTS: the caches marked from treasure charts
  if (m.charts?.length) {
    detail.append(divider(`Treasure charts (${m.charts.length})`));
    const ch = el('div', 'hld-list');
    for (const k of m.charts) {
      const row = el('div', 'hld-refit');
      row.append(el('span', 'hld-name', k.title));
      if (k.line) row.append(el('span', 'hld-sub', k.line));
      ch.append(row);
    }
    detail.append(ch);
  }
  detail.append(divider('The log'));
  const log = el('div', 'hld-list');
  for (const [label, value] of m.log ?? []) {
    const r = el('div', 'hld-log');
    r.append(el('span', 'hld-mk', label), el('span', 'hld-sub', value));
    log.append(r);
  }
  detail.append(log);
}
