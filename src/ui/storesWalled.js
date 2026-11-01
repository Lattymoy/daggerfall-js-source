// @ts-check
// RPT1026-MARKET STORES-SAID - the Stores' units a market listing or the guild Stores may not take, said where the player
// looks for them (ui/marketTab.js's List form, ui/socialPanel.js's guild Stores). The walls are the service's
// (server-account/src/professions.js spendableSql: WRIT_ORIGINS; market.js listGood's currency), unchanged; this only
// names what stands behind them.
import { t } from '../systems/textManager.js';
import { LOOSE_ORIGIN } from '../net/bagLaw.js';

/** How many materials one line names; the rest are counted. */
export const WALLED_SAID = 8;

/** RPT1026-MARKET STORES-SAID (private reports 2026-10-26: the Stores' newer materials, Arcane Essence and Cured Leather
 *  among them, missing from the market's List form and from the guild Stores' Put in - AUDIT RPT1026 D4: paraphrased):
 *  THE STORES' UNITS A
 *  LISTING IN `currency` MAY NOT TAKE - a silver listing's gold-bought ones (GOLD-MARKET's wall, Professions-Arc 10.8) and a
 *  gold listing's silver-bought ones, and either's loose ones (BAG-CRAFT A1: what a station's put-in brought from the
 *  pack, and what a station made of it - net/bagLaw.js LOOSE_ORIGIN, FB1020h ESSENCE-LOOSE). The List form offered only
 *  what may go and said nothing of the rest, so a Stores page full of Cured Leather and Arcane Essence made of looted or
 *  gold-bought goods read as the market losing them. */
export const walledUnits = (/** @type {any} */ s, /** @type {string} */ currency) =>
  s ? (currency === 'gold' ? s.bought | 0 : s.gold | 0) + (s[LOOSE_ORIGIN] | 0) : 0;
/** ...said: `{name} ({n})` of each such material of `stores` (the professions' book's Map), at most WALLED_SAID by name,
 *  or '' for none. `whose` 'gold' or 'marks' (a listing's currency), or 'guild' - the guild Stores, which take a silver
 *  listing's units (net/bagLaw.js WRIT_ORIGINS). */
export function walledText(
  /** @type {any} */ stores,
  /** @type {string} */ whose,
  /** @type {(key: string) => string} */ nameOf,
) {
  /** @type {Array<[string, number]>} */
  const rows = [...(stores?.values?.() ?? [])]
    .map(
      (/** @type {any} */ s) =>
        /** @type {[string, number]} */ ([s.material, walledUnits(s, whose === 'gold' ? 'gold' : 'marks')]),
    )
    .filter(([, n]) => n > 0);
  if (!rows.length) return '';
  const shown = rows
    .slice(0, WALLED_SAID)
    .map(([k, n]) => `${nameOf(k)} (${n.toLocaleString('en-US')})`)
    .join(', ');
  const list =
    rows.length > WALLED_SAID
      ? t('market.list.walledMore', '{list} and {n, number} more', { list: shown, n: rows.length - WALLED_SAID })
      : shown;
  if (whose === 'guild')
    return t(
      'market.list.walledGuild',
      'Not for the guild Stores: {list}. The guild takes only what you gathered or bought with silver. Goods bought with gold or from your pack stay in your own Stores.',
      { list },
    );
  return whose === 'gold'
    ? t(
        'market.list.walledGold',
        'Not for a gold sale: {list}. Goods bought with silver sell only for silver, and goods from your pack, or made from them, only go to crafting stations.',
        { list },
      )
    : t(
        'market.list.walledSilver',
        'Not for a silver sale: {list}. Goods bought with gold sell only for gold, and goods from your pack, or made from them, only go to crafting stations.',
        { list },
      );
}
