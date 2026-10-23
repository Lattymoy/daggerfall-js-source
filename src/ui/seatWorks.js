// @ts-check
// SEAT2b (2026-10-01, Mac: "Finish the seats"; "We need to do a comprehensive audit on everything and finish the not
// done"): THE WORKS - the Seat tab's fortifications panel (bible/11-Multiplayer/Seats-Arc.md 7.9: "the stockpile: every
// fortification project and what it still needs, each need a writ on the Work tab"; 7.5 the works). Each work the seat
// may raise, its tier and what it does, the project raising its next tier and what it still wants (or the day it
// stands); the stockpile; and for the holder's Guildmaster or an Officer, a lever a work - "Raise the Walls to tier 2
// (3,000 Drakes)" - which begins the project (the service burns its Drakes from the treasury). The needs are delivered
// by seat writs, posted from the Work tab.
//
// Drawn into a host the Seat tab hands it (ui/seatTab.js), its acts through the tab's own one-at-a-time door.
import { FORT_WORKS, fortMayRaise, fortMaxTier, fortTierRow, fortWorkLine } from '../net/fortLaw.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** The panel's fixed words. */
export const SEAT_WORKS_WORDS = Object.freeze({
  head: 'The Works',
  emptyStock: 'The stockpile is empty.',
  reading: 'Reading the works...',
});
/** A lever's words: "Raise the Walls to tier 2 (3,000 Drakes)". */
export const fortLeverText = (id, t) => {
  const w = FORT_WORKS.find((x) => x.id === id);
  const row = fortTierRow(id, t);
  return w && row ? `Raise the ${w.name} to grade ${t} (${row.marks.toLocaleString('en-US')} silver)` : '';
};

/**
 * THE PANEL into `host`: `forts` the service's read (`{ works, stockpile }`, or null while it is read), `seat`
 * `{ tier }`, `port` whether DFU names its town a port (a Harbour's ask), `lever` whether this reader may begin a
 * project, `nameOf(key, n)` a material's name for a count, `whenOf(ms)` a moment's words, `onBegin(work)` the lever's act.
 * Returns the buttons drawn, by work (a test reads them).
 * @param {HTMLElement} host
 * @param {{ forts: any, seat: { tier: string }, port?: boolean, lever?: boolean, nameOf?: (k: string, n: number) => string,
 *   whenOf?: (ms: number) => string, onBegin?: (work: string) => any, busy?: boolean }} o
 */
export function drawSeatWorks(host, { forts, seat, port = false, lever = false, nameOf = (k) => k, whenOf, onBegin = () => {}, busy = false }) {
  const box = el('div', 'notice-seat-works');
  box.append(el('h4', 'notice-seat-head', SEAT_WORKS_WORDS.head));
  /** @type {Record<string, HTMLButtonElement>} */
  const buttons = {};
  if (!forts) {
    box.append(el('p', 'notice-seat-works-line', SEAT_WORKS_WORDS.reading));
    host.append(box);
    return buttons;
  }
  const works = forts.works ?? {};
  const walls = Number(works.walls?.tier ?? 0);
  for (const w of FORT_WORKS) {
    const row = works[w.id] ?? { tier: 0, building: null };
    if (!row.tier && row.building == null && !fortMayRaise(w.id, { tier: seat.tier, coastal: port, walls })) continue;
    const li = el('p', 'notice-seat-works-line', fortWorkLine(w.id, row, { nameOf, seatTier: seat.tier, ...(whenOf ? { whenOf } : {}) }));
    box.append(li);
    const next = Number(row.tier ?? 0) + 1;
    if (lever && row.building == null && next <= fortMaxTier(w.id) && fortMayRaise(w.id, { tier: seat.tier, coastal: port, walls })) {
      const b = /** @type {HTMLButtonElement} */ (el('button', `act notice-seat-fort-${w.id}`, fortLeverText(w.id, next)));
      b.setAttribute('type', 'button');
      b.disabled = busy;
      b.onclick = (e) => { e?.stopPropagation?.(); return onBegin(w.id); };
      box.append(b);
      buttons[w.id] = b;
    }
  }
  const stock = (forts.stockpile ?? []).filter(([, n]) => n > 0);
  box.append(el('p', 'notice-seat-works-stock', stock.length
    ? `The stockpile: ${stock.map(([k, n]) => `${Number(n).toLocaleString('en-US')} ${nameOf(k, n)}`).join(', ')}.` : SEAT_WORKS_WORDS.emptyStock));
  host.append(box);
  return buttons;
}
