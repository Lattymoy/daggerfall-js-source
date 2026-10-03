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
// SILVER-WAYS (2026-10-03, Mac: "Do it"): THIS REGION'S GUILD CONTRACTS beside them - a guild's pay to each defender of a
// raid here, what is left of it, the time left; paid as the defender's raid is counted, never to its own Officers and
// Guildmaster; Withdraw where the reader's rank may; and POST A CONTRACT (a Guildmaster's, or an Officer's within the one
// writ budget). Offered while the service lists them (`contracts` on the list - silver's switch, not the professions').
import { accountRefusalText } from '../net/accountClient.js';
import { CRAFTED_FAMILIES, marketCatalogue, saleTax, MARKET_PRICE_MAX, WEAR_WHOLE } from '../net/marketLaw.js';
import { RECIPES, QUALITY_NAMES, MASTERWORK } from '../net/recipeLaw.js';
import { marksText } from '../net/marksLaw.js';
import {
  WRIT_UNITS_MAX, writPayMax, commissionable, commissionTakesQuality, COMMISSIONS_MAX, GUILD_WRITS_MAX, writDeliverMay,
  GUILD_CONTRACTS_MAX, CONTRACT_PAY_MAX, CONTRACT_DEEDS_MAX, contractPaidMay,
} from '../net/writLaw.js';   // SILVER-WAYS: a guild contract's bounds
import { GUILD_RANK_MASTER } from '../net/guildLaw.js';
import { HANDLE_RE } from '../net/handleShape.js';
import { WRIT_MOVED } from '../net/writBook.js';
import { FORT_MATERIALS, RAM_KIT_KEY } from '../net/fortLaw.js';   // SEAT2b: what a seat writ may ask; part two: a Siege Camp's Ram Kits
import { bannerSvg } from './heraldryArt.js';   // AUDIT-SEATS G11: a guild writ's card under its guild's banner

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
export function seatWritPlace(x) {
  const name = x?.name || 'the seat';
  return x?.camp ? `the Siege Camp at ${name}` : `${whose(name)} stockpile`;
}
export const seatWritFor = (x) => `for ${seatWritPlace(x)}`;
/** AUDIT-SEATS G11: a guild writ's banner - the port's own drawing of its guild's heraldry - or null for none. */
const writBanner = (heraldry) => {
  if (!heraldry) return null;
  const img = /** @type {HTMLImageElement} */ (el('img', 'notice-banner writ-banner'));
  img.alt = '';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bannerSvg(heraldry, { width: 26 }))}`;
  return img;
};
const intOf = (s, lo, hi) => { const n = Math.floor(Number(s)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };
const count = (n) => Number(n).toLocaleString('en-US');
const plural = (n, one) => `${count(n)} ${one}${n === 1 ? '' : 's'}`;
/** "5 days left", "3 hours left", "under an hour left", "ended". */
export function writLeftText(atS, nowS) {
  const s = (Number(atS) || 0) - nowS;
  if (s <= 0) return 'ended';
  if (s >= 86400) return `${plural(Math.floor(s / 86400), 'day')} left`;
  if (s >= 3600) return `${plural(Math.floor(s / 3600), 'hour')} left`;
  return 'under an hour left';
}
const recipeName = (id) => RECIPES.find((r) => r.id === id)?.name ?? id;
/** "a Mithril Longsword, Fine or better" - a commission's piece in words. */
export function commissionPieceText(c) {
  const name = recipeName(c.recipe);
  const an = /^[AEIOU]/i.test(name) ? 'an' : 'a';
  return `${an} ${name}${c.quality != null ? `, ${QUALITY_NAMES[c.quality]} or better` : ''}`;
}
/** A name's possessive: "Ann's", "Silas'" - AUDIT 31 U13: "fill Ann commission" said nothing right. */
const whose = (name) => (name ? `${name}${/s$/i.test(name) ? '\'' : '\'s'}` : 'its poster\'s');
/** A closed commission's state, as "Yours" says it. */
const COMMISSION_SAID = Object.freeze({ filled: 'filled', withdrawn: 'withdrawn', declined: 'declined', expired: 'run out' });
/** AUDIT 31 U13: what a sale's words say of its pay - "114 Marks struck to your account (6 Marks tax taken)", never
 *  "114 struck, less 6 tax", which reads as 108. */
export const paidText = (pay, tax) => `${marksText(pay)} struck to your account${tax > 0 ? ` (${marksText(tax)} tax taken)` : ''}`;

/**
 * THE WORK TAB'S PROF6 SECTIONS.
 * @param {{
 *   writs: any, held: (material: string) => number, region: number, regionName: string, regionNameOf: (r: number) => string,
 *   countName: (key: string, n: number) => string,
 *   pieces: (c: any) => Array<{ item: any, where: string, name: string, quality?: number|null, take: () => boolean, putBack: (item: any, where: string) => void }>,
 *   reload: () => void,
 * }} w `writs` - net/writBook.js; `held` - the Stores' count of a material (the professions' book); `pieces` - the
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
  const busyWhy = () => (ui.busy() ? 'A moment' : '');
  const guildName = (g) => (g?.tag ? `${g.name} [${g.tag}]` : g?.name ?? 'A guild');
  /** AUDIT 31 S6: whether this character's rank in the writ's guild delivers to it (writLaw writDeliverMay). */
  const mayDeliver = (data, x) => data?.guild?.id !== x.guild?.id || writDeliverMay(data.guild.rank);
  /** AUDIT 31 U11: Decline pressed once arms it, twice declines - a stray tap never sends a crafter's work away. */
  const declineButton = (c) => {
    const armed = () => st.arm?.id === c.id && nowMs() - st.arm.at < WORK_ARM_MS;
    const d = button(`work-decline${armed() ? ' armed' : ''}`, armed() ? 'Decline - press again' : 'Decline', () => {
      if (!armed()) { st.arm = { id: c.id, at: nowMs() }; ui.rerender(); return; }
      st.arm = null;
      return act(() => w.writs.decline(c.id), 'Declined. Its pay goes back to its poster.');
    });
    return why(d, busyWhy());
  };

  // ─── A GUILD WRIT ──────────────────────────────────────────────────
  function guildWritCard(x, i, data) {
    const li = el('li', `notice-card notice-writ seal-guild${x.state !== 'open' ? ' done' : ''}`);
    li.style.setProperty('--tilt', `${((i * 41) % 5) - 2}deg`);
    li.append(el('span', 'notice-pin'), el('span', 'writ-kind', x.seat != null ? 'Seat writ' : 'Guild writ'));
    const flag = writBanner(x.guild?.heraldry);   // AUDIT-SEATS G11: its guild's banner
    if (flag) li.append(flag);
    li.append(el('p', 'writ-need', `${guildName(x.guild)} needs ${count(x.left)} more ${w.countName(x.material, x.left)}${x.seat != null ? ` ${seatWritFor({ name: x.seatName, camp: x.camp })}` : ''}`));
    li.append(el('p', 'writ-pay', `Pays ${marksText(x.pay)} each - ${count(x.units - x.left)} / ${count(x.units)} delivered`));
    li.append(el('p', 'writ-left', writLeftText(x.expiresAt, ui.nowS())));
    const held = w.held(x.material);
    // AUDIT 31 U10: no more than the guild Stores can still take of it
    const room = Number.isSafeInteger(x.room) ? x.room : Infinity;
    const most = Math.min(x.left, held, room);
    const bar = el('div', 'writ-take');
    if (x.state === 'open' && !mayDeliver(data, x)) bar.append(el('span', 'work-none', 'Your guild\'s Officers and Guildmaster do not deliver to its writs.'));
    else if (x.state === 'open' && most > 0) {
      const units = () => intOf(st.supply[x.id] ?? most, 1, most);
      const n = input('number', units(), `Units to deliver to ${guildName(x.guild)}`, `supply|${x.id}`);
      n.min = '1'; n.max = String(most);
      const go = button('primary notice-take work-deliver', `Deliver ${count(units())}`, () => {
        const u = units();
        return act(() => w.writs.supply({ region: w.region, writ: x.id, units: u }),
          (d) => `Delivered ${count(u)} ${w.countName(x.material, u)}: ${paidText(d?.fill?.pay ?? 0, d?.fill?.tax ?? 0)}.`);
      });
      why(go, busyWhy());
      n.oninput = () => { st.supply[x.id] = intOf(n.value, 1, most); go.textContent = `Deliver ${count(units())}`; };
      bar.append(labelled('Units', n), go);
    } else if (x.state === 'open') {
      bar.append(el('span', 'work-none', held <= 0 ? 'Your Stores hold none of it.' : 'The guild\'s Stores can take no more of it.'));
    }
    bar.append(el('span', null, `${count(held)} in your Stores`));
    if (x.may) bar.append(withdrawWrit(x));
    li.append(bar, el('span', 'notice-seal', ''));
    return li;
  }
  const withdrawWrit = (x) => why(button('work-withdraw', 'Withdraw', () => act(() => w.writs.withdraw(x.id), 'Withdrawn. What was left of its pay is back in the guild\'s treasury.')),
    busyWhy());

  // ─── A GUILD CONTRACT (SILVER-WAYS) ────────────────────────────────
  function contractCard(x, i, data) {
    const li = el('li', `notice-card notice-writ seal-guild${x.state !== 'open' ? ' done' : ''}`);
    li.style.setProperty('--tilt', `${((i * 37) % 5) - 2}deg`);
    li.append(el('span', 'notice-pin'), el('span', 'writ-kind', 'Guild contract'));
    const flag = writBanner(x.guild?.heraldry);
    if (flag) li.append(flag);
    li.append(el('p', 'writ-need', `${guildName(x.guild)} pays the defenders of ${w.regionNameOf(x.region)}'s towns against raiders`));
    li.append(el('p', 'writ-pay', `${marksText(x.pay)} each - ${plural(x.left, 'defender')} left of ${count(x.deeds)}`));
    li.append(el('p', 'writ-left', writLeftText(x.expiresAt, ui.nowS())));
    const bar = el('div', 'writ-take');
    const own = data?.guild?.id === x.guild?.id && !contractPaidMay(data.guild.rank);
    bar.append(el('span', 'work-none', own ? 'Your guild\'s Officers and Guildmaster are not paid by its contracts.'
      : `Strike a raider here and stand in the town as it is cleansed: paid as your raid is counted, less ${marksText(saleTax(x.pay))} tax.`));
    if (x.may) bar.append(withdrawContract(x));
    li.append(bar, el('span', 'notice-seal', ''));
    return li;
  }
  const withdrawContract = (x) => why(button('work-withdraw', 'Withdraw', () => act(() => w.writs.withdrawContract(x.id), 'Withdrawn. What was left of its pay is back in the guild\'s treasury.')),
    busyWhy());

  // ─── A COMMISSION (this board's region's) ──────────────────────────
  function commissionCard(c, i) {
    const li = el('li', `notice-card notice-writ seal-commission${c.state !== 'open' ? ' done' : ''}`);
    li.style.setProperty('--tilt', `${((i * 29) % 5) - 2}deg`);
    li.append(el('span', 'notice-pin'), el('span', 'writ-kind', 'Commission'));
    li.append(el('p', 'writ-need', `For ${c.crafter ?? 'a crafter'} only: ${commissionPieceText(c)}`));
    li.append(el('p', 'writ-pay', `Pays ${marksText(c.pay)}${c.poster ? ` - from ${c.poster}` : ''}`));
    li.append(el('p', 'writ-left', writLeftText(c.expiresAt, ui.nowS())));
    const bar = el('div', 'writ-take');
    if (c.state === 'open' && c.forMe) bar.append(...fillNodes(c), declineButton(c));
    if (c.state === 'open' && c.mine) {
      bar.append(why(button('work-withdraw', 'Withdraw', () => act(() => w.writs.cancel(c.id), `Withdrawn. ${marksText(c.pay)} back to your account.`)), busyWhy()));
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
      return [el('span', 'work-none', /** @type {any} */ (pieces).blocked > 0 ? 'Your piece that answers it is equipped, locked or bound - free it first.'
        : 'You carry no piece of your make that answers it - unworn, and on no sale.')];
    }
    const picked = () => pieces.find((p) => p.item.provenance === st.pick[c.id]) ?? pieces[0];
    const label = (p) => (p.quality != null ? `${p.name} (${QUALITY_NAMES[p.quality]})` : p.name);
    const s = select(pieces.map((p) => [p.item.provenance, label(p)]), picked().item.provenance, (v) => { st.pick[c.id] = v; }, `The piece to fill ${whose(c.poster)} commission with`);
    const go = button('primary work-fill', 'Fill', () => {
      const p = picked();
      return act(() => w.writs.fulfil({ region: w.region, commission: c.id, provenance: p.item.provenance, wear: WEAR_WHOLE }, p),
        `Filled: ${p.name} is on its way to ${c.poster ?? 'its poster'}; ${paidText(c.pay - saleTax(c.pay), saleTax(c.pay))}.`);
    });
    return [labelled('Piece', s, 'work-label-wide'), why(go, busyWhy())];
  }

  // ─── YOURS ─────────────────────────────────────────────────────────
  function yoursNode(data) {
    const cs = data?.yours?.commissions ?? [], gw = data?.yours?.guildWrits ?? [], gc = data?.yoursContracts ?? [];
    if (!cs.length && !gw.length && !gc.length) return null;
    const box = el('div', 'work-yours');
    box.append(el('h3', 'work-head', 'Yours'));
    const list = el('ul', 'work-rows');
    for (const c of cs) {
      const li = el('li', 'work-row');
      const who = c.mine ? `You commissioned ${c.crafter ?? 'a crafter whose account is gone'}` : `${c.poster} commissioned you`;
      const here = c.region === w.region;
      const where = here ? 'here' : w.regionNameOf(c.region);
      // AUDIT 31 H6: a filled one of yours comes by the market's deliveries - collected at the Market tab
      const said = c.state === 'open' ? writLeftText(c.expiresAt, ui.nowS())
        : c.mine && c.state === 'filled' ? 'filled - collect it at the Market tab'
          : `${COMMISSION_SAID[c.state] ?? c.state}${c.mine ? (c.returned ? ' - silver back' : ' - silver to come back') : ''}`;
      li.append(el('span', 'work-what', `${who}: ${commissionPieceText(c)}, ${marksText(c.pay)}`), el('span', 'work-where', `${where} · ${said}`));
      if (c.state === 'open' && c.mine) {
        li.append(why(button('work-withdraw', 'Withdraw', () => act(() => w.writs.cancel(c.id), `Withdrawn. ${marksText(c.pay)} back to your account.`)), busyWhy()));
      }
      // AUDIT 31 U4: one naming you - declined from here, filled at its own region's boards
      if (c.state === 'open' && c.forMe) {
        li.append(el('span', 'work-where', here ? 'Fill it on its card above.' : `Filled at the boards of ${where}.`), declineButton(c));
      }
      list.append(li);
    }
    for (const x of gw) {
      const li = el('li', 'work-row');
      li.append(el('span', 'work-what', `${guildName(x.guild)}: ${count(x.left)} more ${w.countName(x.material, x.left)}, ${marksText(x.pay)} each`),
        el('span', 'work-where', `${x.region === w.region ? 'here' : w.regionNameOf(x.region)} · ${writLeftText(x.expiresAt, ui.nowS())}`));
      if (x.may) li.append(withdrawWrit(x));
      list.append(li);
    }
    for (const x of gc) {   // SILVER-WAYS: the guild's contracts, every region
      const li = el('li', 'work-row');
      li.append(el('span', 'work-what', `${guildName(x.guild)}: ${marksText(x.pay)} to each of ${plural(x.left, 'defender')} more`),
        el('span', 'work-where', `${x.region === w.region ? 'here' : w.regionNameOf(x.region)} · ${writLeftText(x.expiresAt, ui.nowS())}`));
      if (x.may) li.append(withdrawContract(x));
      list.append(li);
    }
    box.append(list);
    return box;
  }

  /** SILVER-WAYS: POST A CONTRACT - its pay a defender and how many, held from the treasury (the Officers' one budget). */
  function contractForm(g, data) {
    const box = el('div', 'work-form');
    box.append(el('h3', 'work-head', `Post a guild contract - ${guildName(g)}`));
    const f = st.contract;
    const pay = input('number', f.pay, 'Silver each defender', 'contract|pay');
    pay.min = '1'; pay.max = String(CONTRACT_PAY_MAX);
    const deeds = input('number', f.deeds, 'Defenders it pays', 'contract|deeds');
    deeds.min = '1'; deeds.max = String(CONTRACT_DEEDS_MAX);
    const said = el('p', 'work-hint');
    said.setAttribute('aria-live', 'polite');
    const go = button('primary work-post', 'Post', () => act(() => w.writs.contract({ region: w.region, kind: 'raid', pay: f.pay, deeds: f.deeds }),
      () => { st.form = null; return `Posted on the boards of ${w.regionName} for seven days.`; }));
    const standing = (data?.yoursContracts ?? []).length;
    const refresh = () => {
      const escrow = f.pay * f.deeds;
      const officer = g.rank !== GUILD_RANK_MASTER;
      const reason = busyWhy()
        || (standing >= GUILD_CONTRACTS_MAX ? `The guild has ${GUILD_CONTRACTS_MAX} contracts posted already.`
          : escrow > (g.marks ?? 0) ? `The guild's treasury holds only ${marksText(g.marks ?? 0)}.`
            : officer && !(g.budget > 0) ? 'The Guildmaster has set no writ budget for Officers this week.'
              : officer && escrow > (g.left ?? 0) ? `That is past your writ budget this week (${marksText(g.left ?? 0)} left).` : '');
      said.textContent = `Pays each defender of a raid in ${w.regionName} as their raid is counted, less the 5% tax. Holds ${marksText(escrow)} from the guild's treasury (it holds ${marksText(g.marks ?? 0)}) until it is paid out, withdrawn or runs out in seven days. Your guild's Officers and Guildmaster are not paid by it.`
        + (officer ? ` Your writ budget this week: ${marksText(g.left ?? 0)} of ${marksText(g.budget ?? 0)} left.` : '')
        + (reason && !busyWhy() ? ` ${reason}` : '');
      why(go, reason);
    };
    pay.oninput = () => { f.pay = intOf(pay.value, 1, CONTRACT_PAY_MAX); refresh(); };
    deeds.oninput = () => { f.deeds = intOf(deeds.value, 1, CONTRACT_DEEDS_MAX); refresh(); };
    refresh();
    const row = el('div', 'work-fields');
    row.append(labelled('Silver each', pay), labelled('Defenders', deeds), go);
    box.append(row, said);
    return box;
  }

  // ─── THE FORMS ─────────────────────────────────────────────────────
  function writForm(g, data) {
    const box = el('div', 'work-form');
    box.append(el('h3', 'work-head', `Post a guild writ - ${guildName(g)}`));
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
    const forSel = seats.length ? select([['', 'The guild Stores'], ...seats.map((x) => [String(x.key), seatWritPlace(x).replace(/^t/, 'T')])], f.seat == null ? '' : String(f.seat),
      (v) => { f.seat = v === '' ? null : Number(v); ui.rerender(); }, "Where the writ's units go") : null;
    const mat = select(choices.map((m) => [m.key, w.countName(m.key, 2)]), f.material, (v) => { f.material = v; f.pay = Math.min(f.pay, writPayMax(v)); ui.rerender(); }, 'The material the writ asks');
    const units = input('number', f.units, 'Units the writ asks', 'writ|units');
    units.min = '1'; units.max = String(WRIT_UNITS_MAX);
    const pay = input('number', f.pay, 'Silver each', 'writ|pay');
    pay.min = '1'; pay.max = String(max());
    const said = el('p', 'work-hint');
    said.setAttribute('aria-live', 'polite');
    const go = button('primary work-post', 'Post', () => act(() => w.writs.post({ region: w.region, material: f.material, units: f.units, pay: f.pay, ...(f.seat != null ? { seat: f.seat } : {}) }),
      () => { st.form = null; return `Posted on the boards of ${w.regionName} for seven days.`; }));
    const standing = (data?.yours?.guildWrits ?? []).length;
    const refresh = () => {
      const escrow = f.units * f.pay;
      const officer = g.rank !== GUILD_RANK_MASTER;
      // AUDIT 31 U10: every bound the service keeps, said before the press
      const reason = busyWhy()
        || (standing >= GUILD_WRITS_MAX ? `The guild has ${GUILD_WRITS_MAX} writs posted already.`
          : escrow > (g.marks ?? 0) ? `The guild's treasury holds only ${marksText(g.marks ?? 0)}.`
            : officer && !(g.budget > 0) ? 'The Guildmaster has set no writ budget for Officers this week.'
              : officer && escrow > (g.left ?? 0) ? `That is past your writ budget this week (${marksText(g.left ?? 0)} left).` : '');
      said.textContent = `Holds ${marksText(escrow)} from the guild's treasury (it holds ${marksText(g.marks ?? 0)}) until it is delivered, withdrawn or runs out in seven days. At most ${marksText(max())} each - half again the material's worth.`
        + (officer ? ` Your writ budget this week: ${marksText(g.left ?? 0)} of ${marksText(g.budget ?? 0)} left.` : '')
        + (reason && !busyWhy() ? ` ${reason}` : '');
      why(go, reason);
    };
    units.oninput = () => { f.units = intOf(units.value, 1, WRIT_UNITS_MAX); refresh(); };
    pay.oninput = () => { f.pay = intOf(pay.value, 1, Math.max(1, max())); refresh(); };
    refresh();
    const row = el('div', 'work-fields');
    if (forSel) row.append(labelled('For', forSel, 'work-label-wide'));
    row.append(labelled('Material', mat, 'work-label-wide'), labelled('Units', units), labelled('Silver each', pay), go);
    box.append(row, said);
    return box;
  }
  function commissionForm(data) {
    const box = el('div', 'work-form');
    box.append(el('h3', 'work-head', 'Commission a piece'));
    const f = st.comm;
    const who = input('text', f.crafter, 'The crafter\'s name', 'comm|crafter', 'notice-input work-text');
    who.maxLength = 24;
    who.placeholder = 'Their username';
    const fam = select(CRAFTED_FAMILIES.map(([k, label]) => [k, label]), f.family, (v) => { f.family = v; f.recipe = firstRecipe(v); ui.rerender(); }, 'The family of piece');
    const rec = select(recipesOf(f.family).map((r) => [r.id, r.name]), f.recipe, (v) => { f.recipe = v; ui.rerender(); }, 'The piece');
    const takesQ = commissionTakesQuality(f.recipe);
    const q = takesQ ? select(QUALITY_NAMES.map((n, i) => [String(i), `${n} or better`]), String(f.quality), (v) => { f.quality = intOf(v, 0, MASTERWORK); }, 'The least quality it takes') : null;
    const pay = input('number', f.pay, 'Silver it pays', 'comm|pay');
    pay.min = '1'; pay.max = String(MARKET_PRICE_MAX);
    const said = el('p', 'work-hint');
    said.setAttribute('aria-live', 'polite');
    const go = button('primary work-post', 'Commission', () => act(() => w.writs.commission({
      region: w.region, crafter: f.crafter.trim(), recipe: f.recipe, quality: takesQ ? f.quality : null, pay: f.pay,
    }), () => { st.form = null; return `Commissioned from ${f.crafter.trim()}. The pay is held until it is filled, withdrawn or declined.`; }));
    const mineOpen = (data?.yours?.commissions ?? []).filter((c) => c.mine && c.state === 'open').length;
    const balance = Number.isSafeInteger(data?.balance) ? data.balance : null;
    const refresh = () => {
      const name = f.crafter.trim();
      // AUDIT 31 U10: every bound the service keeps, said before the press
      const reason = busyWhy()
        || (!name ? 'Name the crafter.'
          : !HANDLE_RE.test(name) ? 'That is not a name a crafter could have.'
            : data?.me && name.toLowerCase() === String(data.me).toLowerCase() ? 'You cannot commission yourself.'
              : !f.recipe ? 'Choose the piece.'
                : mineOpen >= COMMISSIONS_MAX ? `You have ${COMMISSIONS_MAX} commissions posted already.`
                  : balance != null && f.pay > balance ? `You hold only ${marksText(balance)}.` : '');
      said.textContent = `Holds ${marksText(f.pay)} for seven days; the crafter receives it less ${marksText(saleTax(f.pay))} tax, and only for a piece of their own make, unworn. At most ${COMMISSIONS_MAX} of yours stand at once.`
        + (reason && !busyWhy() ? ` ${reason}` : '');
      why(go, reason);
    };
    who.oninput = () => { f.crafter = who.value; refresh(); };
    pay.oninput = () => { f.pay = intOf(pay.value, 1, MARKET_PRICE_MAX); refresh(); };
    refresh();
    const row = el('div', 'work-fields');
    row.append(labelled('Crafter', who, 'work-label-wide'), labelled('Kind', fam), labelled('Piece', rec, 'work-label-wide'),
      ...(q ? [labelled('Least quality', q)] : []), labelled('Pay (silver)', pay), go);
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

  return {
    /** Whether guild writs and commissions are this account's - the service's word on the list (AUDIT 31 U5). */
    open: (data) => data?.writsOpen === true,
    /** This region's guild writs and commissions - cards for the Court's grid (AUDIT 31 U14: one grid). */
    cards(data) {
      if (data?.writsOpen !== true) return [];
      const gws = data?.guildWrits ?? [], cs = data?.commissions ?? [], gcs = data?.contracts ?? [];   // SILVER-WAYS: and its contracts
      return [...gws.map((x, i) => guildWritCard(x, i, data)), ...gcs.map((x, i) => contractCard(x, gws.length + i, data)),
        ...cs.map((c, i) => commissionCard(c, gws.length + gcs.length + i))];
    },
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
      if (g?.mayPost) acts.append(opener('writ', 'Post a guild writ'));
      if (g && data?.contractPost === true) acts.append(opener('contract', 'Post a guild contract'));   // SILVER-WAYS
      acts.append(opener('commission', 'Commission a piece'));
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
