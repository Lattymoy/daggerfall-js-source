// @ts-check
// PVP-VILLAIN (systems/wild/villainLaw.js): THE VILLAIN BAR at the top of the pause menu's Standing page (the owner: "should
// be in standing", "top of standings") - the meter as the zone's referee last said it, "Villainy 3,240 / 5,000", its bar
// to VILLAIN.max with a red mark at VILLAIN.red. Always shown: out of the zone, the last word this browser heard for the
// character, else 0. A departure: DFU has no PvP.
import { t } from '../systems/textManager.js';
import { appStorage } from '../systems/appStorage.js';
import { pvpVillainy } from '../scenes/pvpFlagHost.js';
import { VILLAIN, isVillain } from '../systems/wild/villainLaw.js';

/** The row's number: the meter and the mark it climbs to - the red line, or the top once past it. */
export function villainyLine(/** @type {number} */ n) {
  const goal = isVillain(n) ? VILLAIN.max : VILLAIN.red;
  return `${n.toLocaleString('en-US')} / ${goal.toLocaleString('en-US')}`;
}

const STORE = 'dfo.pvpVillainy.v1';
const page = new Map(); // a blocked store keeps it for the page
/** The last meter heard for character `who`, kept in this browser (a viewer's convenience), or null. */
export function villainyKept(who, heard = null) {
  if (heard != null && who) page.set(who, heard);
  try {
    const all = JSON.parse(appStorage()?.getItem(STORE) ?? '{}') ?? {};
    if (heard != null && who) {
      all[who] = heard;
      appStorage()?.setItem(STORE, JSON.stringify(all));
    }
    if (Number.isFinite(all[who])) return all[who];
  } catch {
    /* the page's own below */
  }
  return page.get(who) ?? null;
}

/** The section, appended to the sheet's `detail` with the menu's own kit: the referee's word, else the last kept, else 0. */
export function statsVillainy(
  /** @type {HTMLElement} */ detail,
  /** @type {{ el: (tag: string, cls?: string | null, text?: string) => HTMLElement, meter: (now: number, max: number, tone: string) => HTMLElement }} */ {
    el,
    meter,
  },
  heard = pvpVillainy(),
  who = '',
) {
  const n = villainyKept(who, heard) ?? heard ?? 0;
  const row = el('div', 'px-mrow px-villainy');
  const top = el('div', 'px-mtop');
  top.append(el('span', 'k', t('pvp.villain.label', 'Villainy')), el('span', 'v', villainyLine(n)));
  const bar = meter(n, VILLAIN.max, 'blood');
  bar.style.position = 'relative';
  const mark = el('div', 'px-tick');
  Object.assign(mark.style, { left: `${(VILLAIN.red / VILLAIN.max) * 100}%`, width: '2px', background: '#d42a1e' });
  bar.append(mark);
  row.append(top, bar);
  detail.append(row);
  if (isVillain(n))
    detail.append(
      el('p', 'px-note', t('pvp.villain.red', 'You are a villain. You have a red skull, and your PvP flag stays on.')),
    );
}
