// @ts-check
// SEAT2b (2026-10-01, Mac: "Finish the seats"; "We need to do a comprehensive audit on everything and finish the not
// done"): THE WORKS - the Seat tab's fortifications panel (bible/11-Multiplayer/Seats-Arc.md 7.9: "the stockpile: every
// fortification project and what it still needs, each need a writ on the Work tab"; 7.5 the works). Each work the seat
// may raise, its tier and what it does, the project raising its next tier and what it still wants (or the day it
// stands); the stockpile; and for the holder's Guildmaster or an Officer, a lever a work - "Raise the Walls to tier 2
// (3,000 Drakes)" - which begins the project (the service burns its Drakes from the treasury). The needs are delivered
// by seat writs, posted from the Work tab, and - DOMAIN1 - given by the guild's own members (drawSeatGifts, below).
//
// Drawn into a host the Seat tab hands it (ui/seatTab.js), its acts through the tab's own one-at-a-time door.
import { FORT_WORKS, fortMayRaise, fortMaxTier, fortTierRow, fortWorkLine } from '../net/fortLaw.js';
import { giftChoices } from '../net/seatGiftLaw.js'; // DOMAIN1: what a member may give
import { t, formatNumber } from '../systems/textManager.js'; // DOMAIN1: the gifts' words in the player's language

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
export function drawSeatWorks(
  host,
  { forts, seat, port = false, lever = false, nameOf = (k) => k, whenOf, onBegin = () => {}, busy = false },
) {
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
    const li = el(
      'p',
      'notice-seat-works-line',
      fortWorkLine(w.id, row, { nameOf, seatTier: seat.tier, ...(whenOf ? { whenOf } : {}) }),
    );
    box.append(li);
    const next = Number(row.tier ?? 0) + 1;
    if (
      lever &&
      row.building == null &&
      next <= fortMaxTier(w.id) &&
      fortMayRaise(w.id, { tier: seat.tier, coastal: port, walls })
    ) {
      const b = /** @type {HTMLButtonElement} */ (
        el('button', `act notice-seat-fort-${w.id}`, fortLeverText(w.id, next))
      );
      b.setAttribute('type', 'button');
      b.disabled = busy;
      b.onclick = (e) => {
        e?.stopPropagation?.();
        return onBegin(w.id);
      };
      box.append(b);
      buttons[w.id] = b;
    }
  }
  const stock = (forts.stockpile ?? []).filter(([, n]) => n > 0);
  box.append(
    el(
      'p',
      'notice-seat-works-stock',
      stock.length
        ? `The stockpile: ${stock.map(([k, n]) => `${Number(n).toLocaleString('en-US')} ${nameOf(k, n)}`).join(', ')}.`
        : SEAT_WORKS_WORDS.emptyStock,
    ),
  );
  host.append(box);
  return buttons;
}

// ─── DOMAIN1: A GIFT TO THE TOWN (bible/11-Multiplayer/Domains.md 5) ──────────────────────────────

/** The gift panel's heading, by its place. */
export const giftHead = (place) =>
  place === 'camp'
    ? t('seat.gift.headCamp', 'Give to the Siege Camp')
    : t('seat.gift.headStockpile', 'Give to the stockpile');
/** What the panel is for, every rule the service asks said before the press (GUILD3 law 3). */
export const giftRuleLine = (place) =>
  place === 'camp'
    ? t(
        'seat.gift.ruleCamp',
        "Any member may give materials from their Stores or their bag - what they gathered, made or bought with silver, never with gold. The Siege Camp is spent at the Turning on the siege it is raised for, and nothing given comes back. Each unit you gathered or made counts 1 influence a silver of its value for your guild here, as a seat writ's delivery does.",
      )
    : t(
        'seat.gift.ruleStockpile',
        "Any member may give materials from their Stores or their bag - what they gathered, made or bought with silver, never with gold. The works take what they need from the stockpile, and nothing given comes back. Each unit you gathered or made counts 1 influence a silver of its value for your guild here, as a seat writ's delivery does.",
      );
/** One gift as the board names it: "Alda gave 40 Cut Stone."
 * @param {{ who: string, material: string, units: number }} g @param {(k: string, n: number) => string} [nameOf] */
export const giftLine = (g, nameOf = (k, _n) => k) =>
  t('seat.gift.recent', '{who} gave {n, number} {material}.', {
    who: g.who,
    n: Number(g.units),
    material: nameOf(g.material, Number(g.units)),
  });
/** A gift made, in words - and what it counted. `r` the seats' book's answer (`data.gift`, `repeat`, `counted`).
 * @param {any} r @param {string} seatName @param {(k: string, n: number) => string} [nameOf] */
export function giftDoneText(r, seatName, nameOf = (k, _n) => k) {
  const g = r?.data?.gift;
  if (!g) return '';
  if (r.data.repeat) return t('seat.gift.repeat', 'That gift was already made.');
  const args = { n: Number(g.units), material: nameOf(g.material, Number(g.units)), seat: seatName };
  const done =
    g.place === 'camp'
      ? t('seat.gift.doneCamp', 'You gave {n, number} {material} to the Siege Camp at {seat}.', args)
      : t('seat.gift.doneStockpile', 'You gave {n, number} {material} to the stockpile at {seat}.', args);
  return `${done} ${
    r.data.counted
      ? t('seat.gift.counted', 'It counts as influence for your guild here.')
      : t(
          'seat.gift.uncounted',
          'It counts no influence this week: only a member seven days in the guild, whose account fights for it this week, counts.',
        )
  }`;
}

/**
 * THE GIFT PANEL into `host` - for a member of the guild that holds this seat (`gifts.place` 'stockpile') or pledged it
 * this week ('camp'): the rule, each material it takes that the member holds (its Stores and its bag), a count and Give;
 * a Siege Camp's contents (the stockpile's are the works panel's own line); and the guild's last gifts there. `stores`
 * and `bag` a material's spendable Stores and the bag's counted units; `counts` the counts asked so far, by material
 * (kept across redraws by the tab); `onGive(key, n)` the act. Returns the Give buttons drawn, by material (a test reads
 * them).
 * @param {HTMLElement} host
 * @param {{ gifts: { place: string, contents?: any[], recent?: any[] }, stores: (k: string) => number, bag: (k: string) => number,
 *   counts?: Record<string, number>, nameOf?: (k: string, n: number) => string, onGive?: (key: string, n: number) => any, busy?: boolean }} o
 */
export function drawSeatGifts(
  host,
  { gifts, stores, bag, counts = {}, nameOf = (k) => k, onGive = () => {}, busy = false },
) {
  const box = el('div', 'notice-seat-works notice-seat-gifts');
  box.append(el('h4', 'notice-seat-head', giftHead(gifts.place)));
  box.append(el('p', 'notice-seat-works-line', giftRuleLine(gifts.place)));
  /** @type {Record<string, HTMLButtonElement>} */
  const buttons = {};
  const choices = giftChoices(gifts.place, stores, bag);
  if (!choices.length)
    box.append(
      el(
        'p',
        'notice-seat-works-line',
        t('seat.gift.none', 'You hold none of what it takes, in your Stores or your bag.'),
      ),
    );
  for (const c of choices) {
    const row = el('div', 'notice-seat-gift');
    row.append(
      el(
        'span',
        'notice-seat-gift-what',
        t('seat.gift.choice', '{material}: {stores, number} in your Stores, {bag, number} in your bag', {
          material: nameOf(c.key, 2),
          stores: c.stores,
          bag: c.bag,
        }),
      ),
    );
    const n = /** @type {HTMLInputElement} */ (el('input', 'notice-seat-gift-n'));
    n.type = 'number';
    n.min = '1';
    n.max = String(c.most);
    n.step = '1';
    n.value = String(Math.min(c.most, Math.max(1, Math.floor(Number(counts[c.key]) || c.most))));
    n.setAttribute('aria-label', t('seat.gift.count', 'Units of {material} to give', { material: nameOf(c.key, 2) }));
    n.oninput = () => {
      counts[c.key] = Math.floor(Number(n.value) || 0);
    };
    n.onkeydown = (e) => e.stopPropagation(); // the world's keys stay the world's; a count is typed here
    const b = /** @type {HTMLButtonElement} */ (el('button', 'act notice-seat-give', t('seat.gift.give', 'Give')));
    b.setAttribute('type', 'button');
    b.setAttribute('data-material', c.key);
    b.disabled = busy;
    b.onclick = (e) => {
      e?.stopPropagation?.();
      const want = Math.floor(Number(n.value) || 0);
      return onGive(c.key, Math.min(c.most, Math.max(1, want)));
    };
    row.append(n, b);
    box.append(row);
    buttons[c.key] = b;
  }
  if (gifts.place === 'camp') {
    const held = (gifts.contents ?? []).filter(([, q]) => q > 0);
    box.append(
      el(
        'p',
        'notice-seat-works-stock',
        held.length
          ? t('seat.gift.campHolds', 'The Siege Camp holds: {list}.', {
              list: held.map(([k, q]) => `${formatNumber(Number(q))} ${nameOf(k, q)}`).join(', '),
            }) // AUDIT DOMAINS C5: the player's own grouping
          : t('seat.gift.campEmpty', 'The Siege Camp is empty.'),
      ),
    );
  }
  for (const g of gifts.recent ?? []) box.append(el('p', 'notice-seat-gift-recent', giftLine(g, nameOf)));
  host.append(box);
  return buttons;
}
