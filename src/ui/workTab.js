// @ts-check
// PROF6 (2026-09-29, Mac: "continue"): THE WORK TAB'S GUILD WRITS AND COMMISSIONS, beside the Court's writs on the
// Notice Board (bible/06-Systems/Professions-Arc.md 11, 21's wireframe, 28) - drawn inside the board's window
// (ui/noticeWindow.js), their cards in the Court's own grid (AUDIT 31 U14).
//
// THIS REGION'S GUILD WRITS (the guild blue, its tag - no guild's colours are stored until SEAT1c): what the guild needs
// and pays a unit, what has come in, the time left; Deliver a number from the Stores, up to what the guild Stores can
// still take; Withdraw where the reader's rank may. THIS REGION'S COMMISSIONS (green): the crafter named, the piece and
// its least quality, the pay; the named crafter's Fill with a piece of their make, and Decline (pressed twice); the
// poster's Withdraw. YOURS: the account's commissions posted and naming it, and the guild's open writs, every region.
// POST A GUILD WRIT (a Guildmaster's, or an Officer's within the week's budget) and COMMISSION A PIECE (the crafter, the
// recipe by family, the least quality, the pay) - the note's "Commission a piece" button opens the second with its
// author named. Offered only while the service says they are this account's (`writsOpen`, AUDIT 31 U5).
//
// Every act goes through the window's one-at-a-time door (`ui.run`) and the writs' book (net/writBook.js); a piece that
// leaves the save for a commission is kept before it is asked. A number typed moves only the words that hang on it, and
// the field keeps the focus through a read's redraw - the window keeps it (AUDIT 31 U1), the tab keys its fields. The
// forms' drafts are the writs' book's, so a stray tap or Escape throws none away (AUDIT 31 U12); every field is
// labelled, and a button the reader cannot press says why (AUDIT 31 U2, U10).
//
// BOARD-UI (2026-10-06, Mac: "Reduce overusage of bloated text. Less AI like text"): the cards straight, the forms'
// terms one short line each, a refusal's reason in a few words.
//
// SILVER-WAYS (2026-10-03, Mac: "Do it"): THIS REGION'S GUILD CONTRACTS beside them - a guild's pay to each defender of a
// raid here, what is left of it, the time left; paid as the defender's raid is counted, never to its own Officers and
// Guildmaster; Withdraw where the reader's rank may; and POST A CONTRACT (a Guildmaster's, or an Officer's within the one
// writ budget). Offered while the service lists them (`contracts` on the list - silver's switch, not the professions').
//
// BOARD-SIFT (2026-10-21): each card handed to the board as an entry (`entries`) - its kind, whether it is open and
// fillable now, its silver, its end, its name and words - so the Work tab's bar sifts and orders it (ui/workSift.js).
import { wordsOf } from './workSift.js';   // BOARD-SIFT: a card's words, as the bar searches them
import { accountRefusalText } from '../net/accountClient.js';
import { CRAFTED_FAMILIES, marketCatalogue, saleTax, MARKET_PRICE_MAX, WEAR_WHOLE } from '../net/marketLaw.js';
import { RECIPES, QUALITY_NAMES, MASTERWORK } from '../net/recipeLaw.js';
import { marksText } from '../net/marksLaw.js';
import {
  WRIT_UNITS_MAX, writPayMax, commissionable, commissionTakesQuality, COMMISSIONS_MAX, GUILD_WRITS_MAX, writDeliverMay,
  GUILD_CONTRACTS_MAX, CONTRACT_PAY_MAX, CONTRACT_DEEDS_MAX, contractPaidMay,
} from '../net/writLaw.js';   // SILVER-WAYS: a guild contract's bounds
import { GUILD_RANK_MASTER } from '../net/guild/guildLaw.js';
import { HANDLE_RE } from '../net/handleShape.js';
import { WRIT_MOVED } from '../net/writBook.js';
import { FORT_MATERIALS, RAM_KIT_KEY } from '../net/fortLaw.js';   // SEAT2b: what a seat writ may ask; part two: a Siege Camp's Ram Kits
import { bannerSvg } from './heraldryArt.js';   // AUDIT-SEATS G11: a guild writ's card under its guild's banner
import { t } from '../systems/textManager.js';   // L10N4: the Work tab's words in the player's language

/** AUDIT 31 U11: how long a Decline stays armed after its first press - the Guild tab's confirm's kind. */
export const WORK_ARM_MS = 4000;

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const button = (cls, text, onPress) => {
  const b = /** @type {HTMLButtonElement} */ (el('button', `act ${cls}`, text));
  b.setAttribute('type', 'button');
  b.onclick = (e) => { e?.stopPropagation?.(); return onPress(); };
  return b;
};
/** A button that cannot be pressed says why - its title, beside the words that say it (AUDIT 31 U2). */
const why = (b, reason) => {
  b.disabled = !!reason;
  if (reason) b.setAttribute('title', reason);
  return b;
};
/** A field, named and keyed for the focus a redraw keeps. */
const input = (type, value, label, focus, cls = 'notice-input work-num') => {
  const i = /** @type {HTMLInputElement} */ (el('input', cls));
  i.type = type; i.value = String(value);
  i.setAttribute('aria-label', label);
  i.setAttribute('data-focus', focus);
  return i;
};
const select = (options, value, onChange, label) => {
  const s = /** @type {HTMLSelectElement} */ (el('select', 'notice-select work-select'));
  s.setAttribute('aria-label', label);
  s.setAttribute('data-focus', `select|${label}`);
  for (const [v, text] of options) { const o = /** @type {HTMLOptionElement} */ (el('option', null, text)); o.value = v; if (v === value) o.selected = true; s.append(o); }
  s.onchange = () => onChange(s.value);
  return s;
};
/** AUDIT 31 U2: a form's field under its visible name. */
const labelled = (text, field, cls = '') => {
  const l = el('label', `work-label${cls ? ` ${cls}` : ''}`);
  l.append(el('span', 'work-label-text', text), field);
  return l;
};
/** SEAT2b: where a seat writ's units go, as the card and the form say it. */
export function seatWritPlace(x, { cap = false } = {}) {
  const name = x?.name || '';
  if (x?.camp) {
    if (!name) return cap ? t('prof.work.seat.campNoneCap', 'The Siege Camp at the seat') : t('prof.work.seat.campNone', 'the Siege Camp at the seat');
    return cap ? t('prof.work.seat.campCap', 'The Siege Camp at {name}', { name }) : t('prof.work.seat.camp', 'the Siege Camp at {name}', { name });
  }
  if (!name) return cap ? t('prof.work.seat.stockpileNoneCap', "The seat's stockpile") : t('prof.work.seat.stockpileNone', "the seat's stockpile");
  return t('prof.work.seat.stockpile', "{name}{endsInS, select, yes {''} other {''s}} stockpile", { name: cap ? name.replace(/^t/, 'T') : name, endsInS: endsInS(name) });
}
export const seatWritFor = (x) => t('prof.work.seat.for', 'for {place}', { place: seatWritPlace(x) });
/** AUDIT-SEATS G11: a guild writ's banner - the port's own drawing of its guild's heraldry - or null for none. */
const writBanner = (heraldry) => {
  if (!heraldry) return null;
  const img = /** @type {HTMLImageElement} */ (el('img', 'notice-banner writ-banner'));
  img.alt = '';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bannerSvg(heraldry, { width: 26 }))}`;
  return img;
};
const intOf = (s, lo, hi) => { const n = Math.floor(Number(s)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };
/** "5 days left", "3 hours left", "under an hour left", "ended". */
export function writLeftText(atS, nowS) {
  const s = (Number(atS) || 0) - nowS;
  if (s <= 0) return t('prof.work.left.ended', 'ended');
  if (s >= 86400) return t('prof.work.left.days', '{n, plural, one {{n, number} day left} other {{n, number} days left}}', { n: Math.floor(s / 86400) });
  if (s >= 3600) return t('prof.work.left.hours', '{n, plural, one {{n, number} hour left} other {{n, number} hours left}}', { n: Math.floor(s / 3600) });
  return t('prof.work.left.underHour', 'under an hour left');
}
const recipeName = (id) => RECIPES.find((r) => r.id === id)?.name ?? id;
/** "a Mithril Longsword, Fine or better" - a commission's piece in words. */
export function commissionPieceText(c) {
  const name = recipeName(c.recipe);
  const article = /^[AEIOU]/i.test(name) ? 'an' : 'a';
  return c.quality != null ? t('prof.work.comm.pieceQuality', '{article, select, an {an} other {a}} {name}, {quality} or better', { article, name, quality: QUALITY_NAMES[c.quality] })
    : t('prof.work.comm.piece', '{article, select, an {an} other {a}} {name}', { article, name });
}
/** A name's possessive: "Ann's", "Silas'" - AUDIT 31 U13: "fill Ann commission" said nothing right. L10N4: the
 *  possessive is each sentence's own pattern, its `endsInS` choosing the apostrophe. */
const endsInS = (name) => (/s$/i.test(name) ? 'yes' : 'no');
/** A closed commission's state, as "Yours" says it. */
const commissionSaid = (state) => (state === 'filled' ? t('prof.work.said.filled', 'filled') : state === 'withdrawn' ? t('prof.work.said.withdrawn', 'withdrawn')
  : state === 'declined' ? t('prof.work.said.declined', 'declined') : state === 'expired' ? t('prof.work.said.expired', 'run out') : state);
/** AUDIT 31 U13: what a sale's words say of its pay - "114 Marks struck to your account (6 Marks tax taken)", never
 *  "114 struck, less 6 tax", which reads as 108. */
export const paidText = (pay, tax) => (tax > 0 ? t('prof.work.paidTax', '{pay} struck to your account ({tax} tax taken)', { pay: marksText(pay), tax: marksText(tax) })
  : t('prof.work.paid', '{pay} struck to your account', { pay: marksText(pay) }));
/** WRIT-WALL (FIELD BUGS 2026-10-13e, "Cant turn in writs": "Have the materials literally on hand. They don't accept
 *  them"): what a writ's card says of the units held that no writ may spend (net/profBook.js `walled`) - law 3 and the
 *  gold wall in UNCOUNTED's words, on the card and on its button's title alike: a Court or chapter writ's
 *  (ui/noticeWindow.js writNode) and a guild writ's (guildWritCard). `material` its name, counted. */
export const writWalledText = (n, material) => t('prof.work.writ.walled',
  '{n, number} {material} you hold can\'t fill a writ. Only what you gathered or bought with silver counts.',
  { n: Number(n), material });

/**
 * THE WORK TAB'S PROF6 SECTIONS.
 * @param {{
 *   writs: any, held: (material: string) => number, walled?: (material: string) => number, carrying?: () => boolean, region: number, regionName: string, regionNameOf: (r: number) => string,
 *   countName: (key: string, n: number) => string,
 *   pieces: (c: any) => Array<{ item: any, where: string, name: string, quality?: number|null, take: () => boolean, putBack: (item: any, where: string) => void }>,
 *   reload: () => void,
 * }} w `writs` - net/writBook.js; `held` - the Stores' count of a material (the professions' book) - BAG1: and what is carried, where `carrying`; `walled` -
 *   WRIT-WALL: what is held of it that no writ may spend (the book's `walled`); `pieces` - the
 *   pieces in the save that answer a commission (the service's named ones where it named them, the least quality
 *   first); `reload` - the Work tab's list read again
 * @param {{ busy: () => boolean, run: (start: () => Promise<any>) => Promise<void>, rerender: () => void, nowS: () => number,
 *   nowMs?: () => number }} ui
 */
export function createWorkTab(w, ui) {
  const catalogue = marketCatalogue();
  const nowMs = ui.nowMs ?? (() => Date.now());
  const fresh = () => ({
    /** the open form: 'writ' | 'commission' | null */
    form: /** @type {string|null} */ (null),
    writ: { material: catalogue.find((m) => m.key === 'log:oak')?.key ?? catalogue[0]?.key ?? '', units: 100, pay: 1 },
    contract: { pay: 20, deeds: 10 },   // SILVER-WAYS
    comm: { crafter: '', family: 'weapons', recipe: '', quality: 2, pay: 100 },
    /** a delivery's units typed, by writ; a commission's piece picked, by commission */
    supply: /** @type {Record<string, number>} */ ({}),
    pick: /** @type {Record<string, string>} */ ({}),
    /** AUDIT 31 U11: the Decline pressed once - `{ id, at }` */
    arm: /** @type {{ id: string, at: number }|null} */ (null),
    /** AUDIT 31 U9: a field to take the focus once the next draw is in the window */
    focus: /** @type {string|null} */ (null),
  });
  // AUDIT 31 U12: the drafts are the writs' book's - they outlive the window a stray tap closed
  const keep = w.writs?.state ?? null;
  const st = keep ? (keep.workDrafts ??= fresh()) : fresh();
  const recipesOf = (family) => RECIPES.filter((r) => r.family === family && commissionable(r.id));
  const firstRecipe = (family) => recipesOf(family)[0]?.id ?? '';
  if (!st.comm.recipe) st.comm.recipe = firstRecipe(st.comm.family);

  /** An act through the window's door: its word; the list read again on success, and on a word that says it moved. */
  const act = (start, okText) => ui.run(async () => {
    const r = await start();
    if (r?.ok) { w.reload(); return { ok: true, text: typeof okText === 'function' ? okText(r.data) : okText }; }
    if (WRIT_MOVED.includes(r?.error)) w.reload();
    return { ok: false, text: r?.text ?? accountRefusalText(r?.error) };
  });
  const busyWhy = () => (ui.busy() ? t('prof.work.busy', 'A moment') : '');
  const guildName = (g) => (g?.tag ? `${g.name} [${g.tag}]` : g?.name ?? t('prof.work.aGuild', 'A guild'));
  /** The bounds a guild's writ and contract share, said before the press (AUDIT 31 U10). */
  const treasuryShort = (g) => t('prof.work.treasuryShort', 'The guild\'s treasury holds only {held}.', { held: marksText(g.marks ?? 0) });
  const noBudget = () => t('prof.work.noBudget', 'The Guildmaster has set no writ budget for Officers this week.');
  const pastBudget = (g) => t('prof.work.pastBudget', 'That is past your writ budget this week ({left} left).', { left: marksText(g.left ?? 0) });
  const budgetLine = (g) => t('prof.work.budget', 'Your writ budget this week: {left} of {budget} left.', { left: marksText(g.left ?? 0), budget: marksText(g.budget ?? 0) });
  /** AUDIT 31 S6: whether this character's rank in the writ's guild delivers to it (writLaw writDeliverMay). */
  const mayDeliver = (data, x) => data?.guild?.id !== x.guild?.id || writDeliverMay(data.guild.rank);
  /** AUDIT 31 U11: Decline pressed once arms it, twice declines - a stray tap never sends a crafter's work away. */
  const declineButton = (c) => {
    const armed = () => st.arm?.id === c.id && nowMs() - st.arm.at < WORK_ARM_MS;
    const d = button(`work-decline${armed() ? ' armed' : ''}`, armed() ? t('prof.work.declineArmed', 'Decline? Press again') : t('prof.work.decline', 'Decline'), () => {
      if (!armed()) { st.arm = { id: c.id, at: nowMs() }; ui.rerender(); return; }
      st.arm = null;
      return act(() => w.writs.decline(c.id), t('prof.work.declined', 'Declined. Its pay goes back to its poster.'));
    });
    return why(d, busyWhy());
  };

  // ─── A GUILD WRIT ──────────────────────────────────────────────────
  function guildWritCard(x, data) {
    const li = el('li', `notice-card notice-writ seal-guild${x.state !== 'open' ? ' done' : ''}`);
    li.append(el('span', 'notice-pin'), el('span', 'writ-kind', x.seat != null ? t('prof.work.writ.seatKind', 'Seat writ') : t('prof.work.writ.kind', 'Guild writ')));
    const flag = writBanner(x.guild?.heraldry);   // AUDIT-SEATS G11: its guild's banner
    if (flag) li.append(flag);
    const need = { guild: guildName(x.guild), n: Number(x.left), material: w.countName(x.material, x.left) };
    li.append(el('p', 'writ-need', x.seat != null ? t('prof.work.writ.needFor', '{guild} needs {n, number} more {material} for {place}', { ...need, place: seatWritPlace({ name: x.seatName, camp: x.camp }) })
      : t('prof.work.writ.need', '{guild} needs {n, number} more {material}', need)));
    li.append(el('p', 'writ-pay', t('prof.work.writ.pay', 'Pays {pay} each - {done, number} / {units, number} delivered', { pay: marksText(x.pay), done: Number(x.units - x.left), units: Number(x.units) })));
    li.append(el('p', 'writ-left', writLeftText(x.expiresAt, ui.nowS())));
    const held = w.held(x.material);
    // AUDIT 31 U10: no more than the guild Stores can still take of it
    const room = Number.isSafeInteger(x.room) ? x.room : Infinity;
    const most = guildWritMost(x, held);
    // WRIT-WALL: what is held past `held` - looted, shop-bought, traded or gold-bought - named where it would fill more
    const walled = x.state === 'open' && mayDeliver(data, x) && held < Math.min(x.left, room) ? Number(w.walled?.(x.material)) || 0 : 0;
    const walledSaid = walled > 0 ? writWalledText(walled, w.countName(x.material, walled)) : null;
    const bar = el('div', 'writ-take');
    if (x.state === 'open' && !mayDeliver(data, x)) bar.append(el('span', 'work-none', t('prof.work.writ.ownGuild', 'Officers and the Guildmaster do not deliver to their own guild\'s writs.')));
    else if (x.state === 'open' && most > 0) {
      const units = () => intOf(st.supply[x.id] ?? most, 1, most);
      const n = input('number', units(), t('prof.work.writ.unitsLabel', 'Units to deliver to {guild}', { guild: guildName(x.guild) }), `supply|${x.id}`);
      n.min = '1'; n.max = String(most);
      const deliverWord = () => t('prof.work.writ.deliver', 'Deliver {n, number}', { n: units() });
      const go = button('primary notice-take work-deliver', deliverWord(), () => {
        const u = units();
        return act(() => w.writs.supply({ region: w.region, writ: x.id, units: u, material: x.material }),   // BAG1: the material, so what is carried goes in first
          (d) => t('prof.work.writ.delivered', 'Delivered {n, number} {material}: {paid}.', { n: u, material: w.countName(x.material, u), paid: paidText(d?.fill?.pay ?? 0, d?.fill?.tax ?? 0) }));
      });
      why(go, busyWhy());
      n.oninput = () => { st.supply[x.id] = intOf(n.value, 1, most); go.textContent = deliverWord(); };
      bar.append(labelled(t('prof.work.label.units', 'Units'), n), go);
    } else if (x.state === 'open') {
      // AUDIT BAG1: a carrying book's count is the Stores' and what is carried - said as such. WRIT-WALL: never "You have
      // none" beside units held and walled - the walled line under the bar says what they are
      const none = held > 0 ? t('prof.work.writ.guildFull', 'The guild\'s Stores can take no more of it.') : walledSaid ? null
        : w.carrying?.() ? t('prof.work.writ.noneCarried', 'You have none in your Stores, Materials Bag or pack.') : t('prof.work.writ.noneHeld', 'Your Stores hold none of it.');
      if (none) bar.append(el('span', 'work-none', none));
    }
    bar.append(el('span', null, w.carrying?.() ? t('prof.work.writ.heldCarried', '{n, number} held', { n: Number(held) }) : t('prof.work.writ.held', '{n, number} in your Stores', { n: Number(held) })));
    if (x.may) bar.append(withdrawWrit(x));
    li.append(bar);
    if (walledSaid) li.append(el('p', 'writ-walled', walledSaid));   // WRIT-WALL: on the card - a phone has no hover
    li.append(el('span', 'notice-seal', ''));
    return li;
  }
  /** AUDIT 31 U10: the units a delivery may bring a guild writ - what it still asks, what is held, what the guild Stores can
   *  still take (BOARD-SIFT: the card's Deliver and the bar's "Only what I can fill" alike). */
  const guildWritMost = (x, held = w.held(x.material)) => Math.min(x.left, held, Number.isSafeInteger(x.room) ? x.room : Infinity);
  const withdrawWrit = (x) => why(button('work-withdraw', t('prof.work.withdraw', 'Withdraw'), () => act(() => w.writs.withdraw(x.id), t('prof.work.withdrawnGuild', 'Withdrawn. The unpaid silver is back in the guild\'s treasury.'))),
    busyWhy());

  // ─── A GUILD CONTRACT (SILVER-WAYS) ────────────────────────────────
  function contractCard(x, data) {
    const li = el('li', `notice-card notice-writ seal-guild${x.state !== 'open' ? ' done' : ''}`);
    li.append(el('span', 'notice-pin'), el('span', 'writ-kind', t('prof.work.contract.kind', 'Guild contract')));
    const flag = writBanner(x.guild?.heraldry);
    if (flag) li.append(flag);
    li.append(el('p', 'writ-need', t('prof.work.contract.need', '{guild} pays the defenders of {region}\'s towns against raiders', { guild: guildName(x.guild), region: w.regionNameOf(x.region) })));
    li.append(el('p', 'writ-pay', t('prof.work.contract.pay', '{pay} each - {n, plural, one {{n, number} defender} other {{n, number} defenders}} left of {deeds, number}', { pay: marksText(x.pay), n: Number(x.left), deeds: Number(x.deeds) })));
    li.append(el('p', 'writ-left', writLeftText(x.expiresAt, ui.nowS())));
    const bar = el('div', 'writ-take');
    const own = data?.guild?.id === x.guild?.id && !contractPaidMay(data.guild.rank);
    bar.append(el('span', 'work-none', own ? t('prof.work.contract.ownGuild', 'Officers and the Guildmaster are not paid by their own guild\'s contracts.')
      : t('prof.work.contract.how', 'Hit a raider in a town here and stay until the town is cleansed. You are paid when the raid is counted, less {tax} tax.', { tax: marksText(saleTax(x.pay)) })));   // AUDIT 657 B6: what earns it said (raidLaw.js - a blow struck, and the town stood in at the cleanse)
    if (x.may) bar.append(withdrawContract(x));
    li.append(bar, el('span', 'notice-seal', ''));
    return li;
  }
  const withdrawContract = (x) => why(button('work-withdraw', t('prof.work.withdraw', 'Withdraw'), () => act(() => w.writs.withdrawContract(x.id), t('prof.work.withdrawnGuild', 'Withdrawn. The unpaid silver is back in the guild\'s treasury.'))),
    busyWhy());

  // ─── A COMMISSION (this board's region's) ──────────────────────────
  function commissionCard(c) {
    const li = el('li', `notice-card notice-writ seal-commission${c.state !== 'open' ? ' done' : ''}`);
    li.append(el('span', 'notice-pin'), el('span', 'writ-kind', t('prof.work.comm.kind', 'Commission')));
    li.append(el('p', 'writ-need', c.crafter != null ? t('prof.work.comm.for', 'For {crafter} only: {piece}', { crafter: c.crafter, piece: commissionPieceText(c) })
      : t('prof.work.comm.forAny', 'For a crafter only: {piece}', { piece: commissionPieceText(c) })));
    li.append(el('p', 'writ-pay', c.poster ? t('prof.work.comm.payFrom', 'Pays {pay} - from {poster}', { pay: marksText(c.pay), poster: c.poster }) : t('prof.work.comm.pay', 'Pays {pay}', { pay: marksText(c.pay) })));
    li.append(el('p', 'writ-left', writLeftText(c.expiresAt, ui.nowS())));
    const bar = el('div', 'writ-take');
    if (c.state === 'open' && c.forMe) bar.append(...fillNodes(c), declineButton(c));
    if (c.state === 'open' && c.mine) {
      bar.append(why(button('work-withdraw', t('prof.work.withdraw', 'Withdraw'), () => act(() => w.writs.cancel(c.id), t('prof.work.comm.withdrawn', 'Withdrawn. {pay} back to your account.', { pay: marksText(c.pay) }))), busyWhy()));
    }
    li.append(bar, el('span', 'notice-seal', ''));
    return li;
  }
  /** The crafter's Fill: a piece of theirs that answers it, picked (the least quality that answers it first, each named
   *  with its quality - AUDIT 31 U7), handed over (out of the save first - kept). */
  function fillNodes(c) {
    const pieces = w.pieces(c);
    if (!pieces.length) {
      // AUDIT 31 H8: one that answers it is in the pack but will not leave it - said, never "you carry none"
      return [el('span', 'work-none', /** @type {any} */ (pieces).blocked > 0 ? t('prof.work.fill.blocked', 'Your piece for it is equipped, locked or bound. Free it first.')
        : t('prof.work.fill.none', 'You carry no unworn piece you made for it.'))];
    }
    const picked = () => pieces.find((p) => p.item.provenance === st.pick[c.id]) ?? pieces[0];
    const label = (p) => (p.quality != null ? t('prof.work.fill.pieceQuality', '{name} ({quality})', { name: p.name, quality: QUALITY_NAMES[p.quality] }) : p.name);
    const s = select(pieces.map((p) => [p.item.provenance, label(p)]), picked().item.provenance, (v) => { st.pick[c.id] = v; },
      c.poster ? t('prof.work.fill.pieceLabel', "The piece to fill {name}{endsInS, select, yes {''} other {''s}} commission with", { name: c.poster, endsInS: endsInS(c.poster) })
        : t('prof.work.fill.pieceLabelNone', "The piece to fill its poster's commission with"));
    const go = button('primary work-fill', t('prof.work.fill', 'Fill'), () => {
      const p = picked();
      const paid = paidText(c.pay - saleTax(c.pay), saleTax(c.pay));
      return act(() => w.writs.fulfil({ region: w.region, commission: c.id, provenance: p.item.provenance, wear: WEAR_WHOLE }, p),
        c.poster != null ? t('prof.work.fill.filled', 'Filled: {piece} is on its way to {poster}; {paid}.', { piece: p.name, poster: c.poster, paid })
          : t('prof.work.fill.filledNone', 'Filled: {piece} is on its way to its poster; {paid}.', { piece: p.name, paid }));
    });
    return [labelled(t('prof.work.label.piece', 'Piece'), s, 'work-label-wide'), why(go, busyWhy())];
  }

  // ─── YOURS ─────────────────────────────────────────────────────────
  function yoursNode(data) {
    const cs = data?.yours?.commissions ?? [], gw = data?.yours?.guildWrits ?? [], gc = data?.yoursContracts ?? [];
    if (!cs.length && !gw.length && !gc.length) return null;
    const box = el('div', 'work-yours');
    box.append(el('h3', 'work-head', t('prof.work.yours', 'Yours')));
    const list = el('ul', 'work-rows');
    for (const c of cs) {
      const li = el('li', 'work-row');
      const what = { piece: commissionPieceText(c), pay: marksText(c.pay) };
      const who = !c.mine ? t('prof.work.yours.commFor', '{poster} commissioned you: {piece}, {pay}', { ...what, poster: c.poster })
        : c.crafter != null ? t('prof.work.yours.commBy', 'You commissioned {crafter}: {piece}, {pay}', { ...what, crafter: c.crafter })
          : t('prof.work.yours.commGone', 'You commissioned a crafter whose account is gone: {piece}, {pay}', what);
      const here = c.region === w.region;
      const where = here ? t('prof.work.here', 'here') : w.regionNameOf(c.region);
      // AUDIT 31 H6: a filled one of yours comes by the market's deliveries - collected at the Market tab
      const said = c.state === 'open' ? writLeftText(c.expiresAt, ui.nowS())
        : c.mine && c.state === 'filled' ? t('prof.work.yours.collect', 'filled. Collect it at the Market tab')
          : !c.mine ? commissionSaid(c.state)
            : c.returned ? t('prof.work.yours.silverBack', '{state} - silver back', { state: commissionSaid(c.state) }) : t('prof.work.yours.silverToCome', '{state} - silver to come back', { state: commissionSaid(c.state) });
      li.append(el('span', 'work-what', who), el('span', 'work-where', t('prof.work.yours.where', '{where} · {said}', { where, said })));
      if (c.state === 'open' && c.mine) {
        li.append(why(button('work-withdraw', t('prof.work.withdraw', 'Withdraw'), () => act(() => w.writs.cancel(c.id), t('prof.work.comm.withdrawn', 'Withdrawn. {pay} back to your account.', { pay: marksText(c.pay) }))), busyWhy()));
      }
      // AUDIT 31 U4: one naming you - declined from here, filled at its own region's boards
      if (c.state === 'open' && c.forMe) {
        li.append(el('span', 'work-where', here ? t('prof.work.yours.fillAbove', 'Fill it on its card above.') : t('prof.work.yours.fillThere', 'Filled at the boards of {where}.', { where })), declineButton(c));
      }
      list.append(li);
    }
    for (const x of gw) {
      const li = el('li', 'work-row');
      li.append(el('span', 'work-what', t('prof.work.yours.writ', '{guild}: {n, number} more {material}, {pay} each', { guild: guildName(x.guild), n: Number(x.left), material: w.countName(x.material, x.left), pay: marksText(x.pay) })),
        el('span', 'work-where', t('prof.work.yours.where', '{where} · {said}', { where: x.region === w.region ? t('prof.work.here', 'here') : w.regionNameOf(x.region), said: writLeftText(x.expiresAt, ui.nowS()) })));
      if (x.may) li.append(withdrawWrit(x));
      list.append(li);
    }
    for (const x of gc) {   // SILVER-WAYS: the guild's contracts, every region
      const li = el('li', 'work-row');
      li.append(el('span', 'work-what', t('prof.work.yours.contract', '{guild}: {pay} to each of {n, plural, one {{n, number} defender} other {{n, number} defenders}} more', { guild: guildName(x.guild), pay: marksText(x.pay), n: Number(x.left) })),
        el('span', 'work-where', t('prof.work.yours.where', '{where} · {said}', { where: x.region === w.region ? t('prof.work.here', 'here') : w.regionNameOf(x.region), said: writLeftText(x.expiresAt, ui.nowS()) })));
      if (x.may) li.append(withdrawContract(x));
      list.append(li);
    }
    box.append(list);
    return box;
  }

  /** SILVER-WAYS: POST A CONTRACT - its pay a defender and how many, held from the treasury (the Officers' one budget). */
  function contractForm(g, data) {
    const box = el('div', 'work-form');
    box.append(el('h3', 'work-head', t('prof.work.contract.title', 'Post a guild contract - {guild}', { guild: guildName(g) })));
    const f = st.contract;
    const pay = input('number', f.pay, t('prof.work.contract.payLabel', 'Silver each defender'), 'contract|pay');
    pay.min = '1'; pay.max = String(CONTRACT_PAY_MAX);
    const deeds = input('number', f.deeds, t('prof.work.contract.deedsLabel', 'Defenders it pays'), 'contract|deeds');
    deeds.min = '1'; deeds.max = String(CONTRACT_DEEDS_MAX);
    const said = el('p', 'work-hint');
    said.setAttribute('aria-live', 'polite');
    const go = button('primary work-post', t('prof.work.post', 'Post'), () => act(() => w.writs.contract({ region: w.region, kind: 'raid', pay: f.pay, deeds: f.deeds }),
      () => { st.form = null; return t('prof.work.posted', 'Posted in {region} for 7 days.', { region: w.regionName }); }));
    const standing = (data?.yoursContracts ?? []).length;
    const refresh = () => {
      const escrow = f.pay * f.deeds;
      const officer = g.rank !== GUILD_RANK_MASTER;
      const reason = busyWhy()
        || (standing >= GUILD_CONTRACTS_MAX ? t('prof.work.contract.full', 'The guild has {n} contracts posted already.', { n: GUILD_CONTRACTS_MAX })
          : escrow > (g.marks ?? 0) ? treasuryShort(g)
            : officer && !(g.budget > 0) ? noBudget()
              : officer && escrow > (g.left ?? 0) ? pastBudget(g) : '');
      said.textContent = t('prof.work.contract.said', 'Pays each defender of a raid in {region}, less 5% tax. Holds {escrow} of the treasury\'s {held} for up to 7 days. Your own Officers and Guildmaster are not paid.',
        { region: w.regionName, escrow: marksText(escrow), held: marksText(g.marks ?? 0) })
        + (officer ? ` ${budgetLine(g)}` : '')
        + (reason && !busyWhy() ? ` ${reason}` : '');
      why(go, reason);
    };
    pay.oninput = () => { f.pay = intOf(pay.value, 1, CONTRACT_PAY_MAX); refresh(); };
    deeds.oninput = () => { f.deeds = intOf(deeds.value, 1, CONTRACT_DEEDS_MAX); refresh(); };
    refresh();
    const row = el('div', 'work-fields');
    row.append(labelled(t('prof.work.label.silverEach', 'Silver each'), pay), labelled(t('prof.work.label.defenders', 'Defenders'), deeds), go);
    box.append(row, said);
    return box;
  }

  // ─── THE FORMS ─────────────────────────────────────────────────────
  function writForm(g, data) {
    const box = el('div', 'work-form');
    box.append(el('h3', 'work-head', t('prof.work.writ.title', 'Post a guild writ - {guild}', { guild: guildName(g) })));
    const max = () => writPayMax(st.writ.material);
    const f = st.writ;
    f.pay = intOf(f.pay, 1, Math.max(1, max()));
    // SEAT2b (Professions-Arc 11): a seat writ - for a seat of this region the guild holds (its stockpile) or is pledged to
    // this week (its Siege Camp) - asks only what a work asks
    const seats = Array.isArray(g.seats) ? g.seats : [];
    if (!seats.some((x) => x.key === f.seat)) f.seat = null;
    // SEAT2b part two (Seats-Arc 4.2): a Siege Camp's writ may ask Ram Kits too; a kit is a camp's alone (writs.js)
    const camp = f.seat != null && !!seats.find((x) => x.key === f.seat)?.camp;
    const choices = f.seat != null ? catalogue.filter((m) => FORT_MATERIALS.includes(m.key) || (camp && m.key === RAM_KIT_KEY)) : catalogue.filter((m) => m.key !== RAM_KIT_KEY);
    if (!choices.some((m) => m.key === f.material)) f.material = choices[0]?.key ?? f.material;
    const forSel = seats.length ? select([['', t('prof.work.writ.guildStores', 'The guild Stores')], ...seats.map((x) => [String(x.key), seatWritPlace(x, { cap: true })])], f.seat == null ? '' : String(f.seat),
      (v) => { f.seat = v === '' ? null : Number(v); ui.rerender(); }, t('prof.work.writ.forLabel', "Where the writ's units go")) : null;
    const mat = select(choices.map((m) => [m.key, w.countName(m.key, 2)]), f.material, (v) => { f.material = v; f.pay = Math.min(f.pay, writPayMax(v)); ui.rerender(); }, t('prof.work.writ.materialLabel', 'The material the writ asks'));
    const units = input('number', f.units, t('prof.work.writ.unitsAsked', 'Units the writ asks'), 'writ|units');
    units.min = '1'; units.max = String(WRIT_UNITS_MAX);
    const pay = input('number', f.pay, t('prof.work.label.silverEach', 'Silver each'), 'writ|pay');
    pay.min = '1'; pay.max = String(max());
    const said = el('p', 'work-hint');
    said.setAttribute('aria-live', 'polite');
    const go = button('primary work-post', t('prof.work.post', 'Post'), () => act(() => w.writs.post({ region: w.region, material: f.material, units: f.units, pay: f.pay, ...(f.seat != null ? { seat: f.seat } : {}) }),
      () => { st.form = null; return t('prof.work.posted', 'Posted in {region} for 7 days.', { region: w.regionName }); }));
    const standing = (data?.yours?.guildWrits ?? []).length;
    const refresh = () => {
      const escrow = f.units * f.pay;
      const officer = g.rank !== GUILD_RANK_MASTER;
      // AUDIT 31 U10: every bound the service keeps, said before the press
      const reason = busyWhy()
        || (standing >= GUILD_WRITS_MAX ? t('prof.work.writ.full', 'The guild has {n} writs posted already.', { n: GUILD_WRITS_MAX })
          : escrow > (g.marks ?? 0) ? treasuryShort(g)
            : officer && !(g.budget > 0) ? noBudget()
              : officer && escrow > (g.left ?? 0) ? pastBudget(g) : '');
      said.textContent = t('prof.work.writ.said', 'Holds {escrow} of the treasury\'s {held} for up to 7 days. At most {most} each.',
        { escrow: marksText(escrow), held: marksText(g.marks ?? 0), most: marksText(max()) })
        + (officer ? ` ${budgetLine(g)}` : '')
        + (reason && !busyWhy() ? ` ${reason}` : '');
      why(go, reason);
    };
    units.oninput = () => { f.units = intOf(units.value, 1, WRIT_UNITS_MAX); refresh(); };
    pay.oninput = () => { f.pay = intOf(pay.value, 1, Math.max(1, max())); refresh(); };
    refresh();
    const row = el('div', 'work-fields');
    if (forSel) row.append(labelled(t('prof.work.label.for', 'For'), forSel, 'work-label-wide'));
    row.append(labelled(t('prof.work.label.material', 'Material'), mat, 'work-label-wide'), labelled(t('prof.work.label.units', 'Units'), units), labelled(t('prof.work.label.silverEach', 'Silver each'), pay), go);
    box.append(row, said);
    return box;
  }
  function commissionForm(data) {
    const box = el('div', 'work-form');
    box.append(el('h3', 'work-head', t('prof.work.comm.title', 'Commission a piece')));
    const f = st.comm;
    const who = input('text', f.crafter, t('prof.work.comm.crafterLabel', 'The crafter\'s name'), 'comm|crafter', 'notice-input work-text');
    who.maxLength = 24;
    who.placeholder = t('prof.work.comm.crafterHint', 'Their username');
    const fam = select(CRAFTED_FAMILIES.map(([k, label]) => [k, label]), f.family, (v) => { f.family = v; f.recipe = firstRecipe(v); ui.rerender(); }, t('prof.work.comm.familyLabel', 'The family of piece'));
    const rec = select(recipesOf(f.family).map((r) => [r.id, r.name]), f.recipe, (v) => { f.recipe = v; ui.rerender(); }, t('prof.work.comm.recipeLabel', 'The piece'));
    const takesQ = commissionTakesQuality(f.recipe);
    const q = takesQ ? select(QUALITY_NAMES.map((n, i) => [String(i), t('prof.work.comm.orBetter', '{quality} or better', { quality: n })]), String(f.quality), (v) => { f.quality = intOf(v, 0, MASTERWORK); },
      t('prof.work.comm.qualityLabel', 'The least quality it takes')) : null;
    const pay = input('number', f.pay, t('prof.work.comm.payLabel', 'Silver it pays'), 'comm|pay');
    pay.min = '1'; pay.max = String(MARKET_PRICE_MAX);
    const said = el('p', 'work-hint');
    said.setAttribute('aria-live', 'polite');
    const go = button('primary work-post', t('prof.work.comm.go', 'Commission'), () => act(() => w.writs.commission({
      region: w.region, crafter: f.crafter.trim(), recipe: f.recipe, quality: takesQ ? f.quality : null, pay: f.pay,
    }), () => { st.form = null; return t('prof.work.comm.done', 'Commissioned from {crafter}. The pay is held until it is filled, withdrawn or declined.', { crafter: f.crafter.trim() }); }));
    const mineOpen = (data?.yours?.commissions ?? []).filter((c) => c.mine && c.state === 'open').length;
    const balance = Number.isSafeInteger(data?.balance) ? data.balance : null;
    const refresh = () => {
      const name = f.crafter.trim();
      // AUDIT 31 U10: every bound the service keeps, said before the press
      const reason = busyWhy()
        || (!name ? t('prof.work.comm.noName', 'Name the crafter.')
          : !HANDLE_RE.test(name) ? t('prof.work.comm.badName', 'That isn\'t a valid username.')
            : data?.me && name.toLowerCase() === String(data.me).toLowerCase() ? t('prof.work.comm.self', 'You cannot commission yourself.')
              : !f.recipe ? t('prof.work.comm.noRecipe', 'Choose the piece.')
                : mineOpen >= COMMISSIONS_MAX ? t('prof.work.comm.full', 'You have {n} commissions posted already.', { n: COMMISSIONS_MAX })
                  : balance != null && f.pay > balance ? t('prof.work.comm.short', 'You hold only {balance}.', { balance: marksText(balance) }) : '');
      said.textContent = t('prof.work.comm.said', 'Holds {pay} for 7 days. The crafter gets it, less {tax} tax, for an unworn piece they made. Up to {n} at a time.',
        { pay: marksText(f.pay), tax: marksText(saleTax(f.pay)), n: COMMISSIONS_MAX })
        + (reason && !busyWhy() ? ` ${reason}` : '');
      why(go, reason);
    };
    who.oninput = () => { f.crafter = who.value; refresh(); };
    pay.oninput = () => { f.pay = intOf(pay.value, 1, MARKET_PRICE_MAX); refresh(); };
    refresh();
    const row = el('div', 'work-fields');
    row.append(labelled(t('prof.work.label.crafter', 'Crafter'), who, 'work-label-wide'), labelled(t('prof.work.label.kind', 'Kind'), fam), labelled(t('prof.work.label.piece', 'Piece'), rec, 'work-label-wide'),
      ...(q ? [labelled(t('prof.work.label.leastQuality', 'Least quality'), q)] : []), labelled(t('prof.work.label.paySilver', 'Pay (silver)'), pay), go);
    box.append(row, said);
    return box;
  }
  /** AUDIT 31 U9: the field the next draw hands the focus to, and scrolls into view - once it is in the window. */
  const focusSoon = (box) => {
    const key = st.focus;
    if (!key) return;
    st.focus = null;
    Promise.resolve().then(() => {
      const n = /** @type {any} */ ([...box.querySelectorAll('input, select')].find((x) => x.getAttribute('data-focus') === key));
      if (!n) return;
      try { n.focus?.({ preventScroll: true }); } catch { n.focus?.(); }
      n.scrollIntoView?.({ block: 'nearest' });
    });
  };

  /**
   * BOARD-SIFT: this region's guild writs, contracts and commissions, each as the Work tab's bar sifts it (ui/workSift.js
   * WorkEntry) - a guild writ fillable while the reader may deliver to it and has a unit it takes; a contract never at the
   * board (it is earned in a raid); a commission naming the reader while a piece of theirs answers it. Its card is made
   * only when it is drawn. AUDIT BOARD-SIFT: a writ's words its material one and many, and a seat writ's what its card
   * says (its kind, its stockpile or Siege Camp - lane B L1: "seat" and "camp" found none); a contract's silver what one
   * defender is paid (SILVER-WAYS' contracts came best-paying first, `contracts.js` contractBoard - "Most silver" keeps it).
   * @returns {import('./workSift.js').WorkEntry[]}
   */
  function entries(data) {
    if (data?.writsOpen !== true) return [];
    const gws = data?.guildWrits ?? [], cs = data?.commissions ?? [], gcs = data?.contracts ?? [];   // SILVER-WAYS: and its contracts
    return [
      ...gws.map((x) => {
        const name = w.countName(x.material, 2), open = x.state === 'open';
        const seat = x.seat != null ? [t('prof.work.writ.seatKind', 'Seat writ'), seatWritPlace({ name: x.seatName, camp: x.camp })] : [];
        return { kind: 'guild', open, fill: open && mayDeliver(data, x) && guildWritMost(x) > 0, pay: Number(x.pay) * Number(x.left) || 0,
          ends: Number(x.expiresAt) || 0, name, words: wordsOf(name, w.countName(x.material, 1), guildName(x.guild), ...seat), card: () => guildWritCard(x, data) };
      }),
      ...gcs.map((x) => ({ kind: 'contract', open: x.state === 'open', fill: false, pay: Number(x.pay) || 0, ends: Number(x.expiresAt) || 0,
        name: guildName(x.guild), words: wordsOf(guildName(x.guild), w.regionNameOf(x.region)), card: () => contractCard(x, data) })),
      ...cs.map((c) => {
        const open = c.state === 'open';
        return { kind: 'commission', open, fill: open && !!c.forMe && w.pieces(c).length > 0, pay: Number(c.pay) || 0, ends: Number(c.expiresAt) || 0,
          name: recipeName(c.recipe), words: wordsOf(recipeName(c.recipe), c.crafter, c.poster), card: () => commissionCard(c) };
      }),
    ];
  }

  return {
    /** Whether guild writs and commissions are this account's - the service's word on the list (AUDIT 31 U5). */
    open: (data) => data?.writsOpen === true,
    /** This region's guild writs and commissions - cards for the Court's grid (AUDIT 31 U14: one grid). */
    cards: (data) => entries(data).map((e) => e.card()),
    entries,
    /** "Yours", and the forms, under the grid - none while they are not this account's. */
    node(data) {
      if (data?.writsOpen !== true) return null;
      const box = el('div', 'work-more');
      const yours = yoursNode(data);
      if (yours) box.append(yours);
      const g = data?.guild ?? null;
      const acts = el('div', 'work-acts');
      const opener = (form, text) => {
        const b = button(`work-open${st.form === form ? ' on' : ''}`, text, () => { st.form = st.form === form ? null : form; ui.rerender(); });
        b.setAttribute('aria-expanded', st.form === form ? 'true' : 'false');   // AUDIT 31 U14
        return b;
      };
      if (g?.mayPost) acts.append(opener('writ', t('prof.work.open.writ', 'Post a guild writ')));
      if (g && data?.contractPost === true) acts.append(opener('contract', t('prof.work.open.contract', 'Post a guild contract')));   // SILVER-WAYS
      acts.append(opener('commission', t('prof.work.open.commission', 'Commission a piece')));
      box.append(acts);
      if (st.form === 'writ' && g?.mayPost) box.append(writForm(g, data));
      if (st.form === 'contract' && g && data?.contractPost === true) box.append(contractForm(g, data));
      if (st.form === 'commission') box.append(commissionForm(data));
      focusSoon(box);
      return box;
    },
    /** The note's "Commission a piece" (10.6): the form open, its author named, the pay the next to fill (AUDIT 31 U9). */
    openCommission(crafter) {
      st.form = 'commission';
      if (typeof crafter === 'string') st.comm.crafter = crafter;
      st.focus = 'comm|pay';
    },
    /** AUDIT 31 U12: Escape closes an open form first - answers whether one was open. */
    closeForm() { if (!st.form) return false; st.form = null; return true; },
    /** The tab's state, for a test. */
    _state: st,
  };
}
