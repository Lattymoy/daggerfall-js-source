// @ts-check
// SEAT1b (2026-09-30, Mac: "Finish the seats"): THE SEAT TAB of the Notice Board (bible/11-Multiplayer/Seats-Arc.md 7.9:
// "its Seat tab, at every Notice Board in a seat town (not its bounty boards) ... the standings: every pledged guild's
// influence this week, live") - drawn inside the board's window (ui/noticeWindow.js), beside Notices, Work, Market and
// Guilds, at a seat town's rumour board while the seats are open to this account.
//
// WHAT HANGS THERE, top to bottom: the seat's Charter (SEAT1a's words - unheld until SEAT1c's claims); the week's clock
// (the Muster until the Reckoning, then the Reckoning until the Turning); THE STANDINGS - every guild pledged here this
// week, its banner, its name and its influence, highest first; the reader's own guild at this seat (pledged here, or to
// another seat of the region, or nowhere; whether this character counts yet and whether its account fights for another
// guild this week; its own week here against the 2,000 cap); an Officer's or the guildmaster's pledge buttons, in the
// Muster; and the guildmaster's Tribute, with its room.
//
// A seat is run from its town's board, in person - that is the point of a physical board: the war has a place.
//
// BOARD-UI (2026-10-06, Mac: "Enhance the guild war tab of the board for better organization, instruction and
// readability"): the same parts, each on its own panel under its own name, in the order a reader asks them - the
// Charter (who holds it, how firmly, the Tithe and Edict); This week (the phase on a strip - Muster, Reckoning,
// Turning - and its clock, the Season, the Tide); the battle; the standings, each guild's bar toward what it needs (the
// claim, or the holder's defence); your guild (its pledge, your part, the levers); the holder's orders; the Works;
// Fealty and Pacts; HOW THE SEAT WAR WORKS, five steps folded under one line (its numbers the law's own); and the
// Chronicle.
//
// Every act goes through the window's one-at-a-time door (`ui.run`), and the standings are read again after each.
import { HALL_OF_RECORDS_SHUT } from '../systems/onlineHomes.js';   // AUDIT-SEATS: the Hall of Records' words where it cannot be read
import { accountRefusalText } from '../net/accountClient.js';
import {
  seatInfoLine, seatWeekLine, seatStandingLine, seatNoStandingsLine, seatMineLines, seatTributeLine, seatMay,
  SEAT_PLEDGE_WORDS, SEAT_PLEDGE_REGIONS_MAX, TRIBUTE_MARKS_PER_INFLUENCE, CLAIM_THRESHOLD, CLAIM_FEE, CONTESTED_MARGIN, ACCOUNT_SEAT_WEEK_CAP,
  seatHolderLine, seatBattleLine, seatClaimLine, chronicleLine, SEAT_RELINQUISH_WORDS,
  seatRuleLine, seatHoldingLines, edictLine, edictMayFollow, edictForTier, royalTourneyLines, EDICTS, seatTitheCap, SEAT_LEVER_RANKS, BOUNTY_MARKS,
  politicsRows, POLITICS_ACTS, seasonLine, guildWords,
  sideLine, siegeWindowText, SIEGE_WINDOW_DAYS, SIEGE_WINDOW_HOURS, SIEGE_WINDOW_DEFAULT, SELLSWORD_FEE_MAX, passOpens, passWindowEnds,
  CROWN_SIEGE_SLOT, CROWN_SEAT_REGIONS,
} from '../net/townSeatLaw.js';
import { fightAnnouncement } from '../net/siegeHerald.js';   // AUDIT-SEATS G1: the battle's line, its start in the service's seconds
import { GUILD_RANK_MASTER } from '../net/guildLaw.js';
import { tideLine } from '../net/tideLaw.js';
import { drawSeatWorks } from './seatWorks.js';   // SEAT2b: the works
import { towersText } from '../net/fortLaw.js';   // SEAT2b part two: the Watchtowers' word
import { heraldryIndex, armsNamed } from '../net/heraldryIndex.js';   // HERALDRY-SHOWN: the Chronicle's guilds' heraldry, by tag (and name)
import { heraldrySwatch, chronicleGuildOf } from './heraldrySwatch.js';   // HERALDRY-SHOWN (Seats-Arc 8.1): a Chronicle line under its guild's shield

/** SEAT1c: how long the relinquish button stays armed after its first press, ms. */
export const SEAT_RELINQUISH_ARM_MS = 4000;

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

/** What the tab says while it has no standings to show. */
export const SEAT_TAB_WORDS = Object.freeze({
  reading: 'Reading the week\'s standings...',
  slow: 'The standings did not load.',
  shut: 'The seats are not open to you yet.',
});
/** BOARD-UI: the panels' names, in the order they stand. */
export const SEAT_PANELS = Object.freeze({
  week: 'This week', battle: 'This week\'s battle', standings: 'Standings', mine: 'Your guild', holding: 'The holder\'s orders',
  guide: 'How the seat war works', chronicle: 'The Chronicle',
});
/** BOARD-UI: the week's three phases, as the strip names them - the Muster (pledges open), the Reckoning (locked), the
 *  Turning (the week settles). */
export const SEAT_PHASES = Object.freeze([['muster', 'Muster'], ['reckoning', 'Reckoning'], ['turning', 'Turning']]);
/**
 * BOARD-UI (Mac: "better organization, instruction"): HOW THE SEAT WAR WORKS, five steps - `[name, words]` - for a seat
 * of `seat.tier`. Its numbers are the law's own (net/townSeatLaw.js), so the words never drift from the rules. Pure.
 * @param {{ tier?: string }} seat
 */
export function seatGuide(seat) {
  const t = seat?.tier === 'crown' ? 'crown' : 'palace';
  const n = (x) => Number(x).toLocaleString('en-US');
  return [
    ['Pledge', `In the Muster, a guild's Officers or Guildmaster pledge it to one seat a region, in up to ${SEAT_PLEDGE_REGIONS_MAX} regions. Pledges lock at the Reckoning, Friday 18:00 UTC.`],
    ['Earn', `Members 7 days in the guild earn influence in the seat's region: walking the town (the Watch), Oblivion Gate kills, a home in the town, Renown, seat writs and Tribute. One account counts for at most ${n(ACCOUNT_SEAT_WEEK_CAP)} a week at a seat.`],
    ['Claim', `At the Turning, Sunday 18:00 UTC, an unheld Charter goes to the top guild with ${n(CLAIM_THRESHOLD[t])} influence, for ${n(CLAIM_FEE[t])} silver from its treasury. Two guilds within ${Math.round(CONTESTED_MARGIN * 100)}% of each other meet in a Tourney for it.`],
    ['Siege', `A held Charter is challenged by beating the holder's defence with at least ${n(CLAIM_THRESHOLD[t])}: the strongest challenger wins a Right of Siege, fought in the holder's battle window. Sign for your side on this tab.`],
    ['Hold', 'The holder sets the Tithe and an Edict and pays upkeep each week. Keeping the town raises its Standing; a Standing of nought brings revolt.'],
  ];
}
/** The refusals that say the seats are shut to this account (no retry offered). */
const SHUT = new Set(['seats-closed', 'no-session', 'auth', 'seat-unconfirmed']);

/**
 * @param {{ seat: { key: number, name: string, region: number, tier: string },
 *   book: ReturnType<typeof import('../net/townSeatBook.js').createTownSeatBook>,
 *   nameOf?: (key: number) => (string|null), banner?: (heraldry: any, width: number) => (Node|null),
 *   enterBattle?: (seat: any, fight: any) => boolean, enterRoyal?: (seat: any, royal: any, watch: boolean) => boolean,
 *   readRecords?: (seat: any) => Promise<boolean>, port?: boolean, countName?: (key: string, n: number) => string }} host   AUDIT-SEATS: the Hall of Records, opened from the board   SEAT2a part four: the world's door into the battle   CROWN1 part two: and into a Royal Tourney
 * @param {{ busy: () => boolean, run: (start: () => Promise<any>) => any, rerender: () => void, nowS: () => number,
 *   alive?: () => boolean }} ui
 */
export function createSeatTab(host, ui) {
  const { seat, book } = host;
  const nameOf = host.nameOf ?? (() => null);
  const banner = host.banner ?? (() => null);
  let data = null, error = null, loading = false;
  let queued = null;   // AUDIT-SEATS C9: a reload asked while one was in flight (true: forced) - run after it, never dropped
  let tributeDrakes = 0;
  let armedAt = -Infinity;   // SEAT1c: the relinquish button's first press
  let disarm = null;   // AUDIT-SEATS C13: the redraw that puts the relinquish button's words back when its arm runs out
  let titheAsk = null, edictAsk = null, bountyAside = 200;   // SEAT1d: the levers' own choices, kept across redraws
  let windowAsk = null, hireHandle = '', hireFee = 0;   // SEAT2a: the window and the contract asked, kept across redraws
  let politicsTag = '';   // CROWN2: the guild an offer is made to, kept across redraws
  let forts = null;   // SEAT2b: the works as last read, read with the standings
  let guideOpen = false;   // BOARD-UI: the guide unfolded

  async function load(force) {
    // AUDIT-SEATS C9: a reload asked mid-read is queued - the act's read after another act's was dropped, and the tab
    // stood on the earlier act's answer (an Edict just proclaimed read as none)
    if (loading) { queued = !!(queued || force); return; }
    loading = true; ui.rerender();
    let r, f;
    // SEAT2b: the works beside them - a reader who cannot read them sees the board without its panel. BOARD-UI (Mac:
    // "Enhance the speed at which the notice board ... loads"): asked AT ONCE with the standings, never after their answer
    const works = book.forts ? Promise.resolve().then(() => book.forts(seat.key)).catch(() => null) : null;
    try { r = await book.standings(seat.key, { force }); } catch { r = { data: null, error: 'offline' }; }
    try { f = r.data && works ? await works : null; } catch { f = null; }
    loading = false;
    if (ui.alive && !ui.alive()) { queued = null; return; }
    if (r.data) data = r.data;
    if (f?.data) forts = f.data;
    error = r.error;
    if (queued !== null) { const again = queued; queued = null; load(again); return; }
    ui.rerender();
  }
  /** An act through the window's door, the standings read afresh after it. */
  const act = (start) => ui.run(async () => { const r = await start(); load(true); return r; });
  /** AUDIT-SEATS C13: the relinquish button drawn again once its arm has run out - it stood on "Press again" until some
   *  other redraw came, and a press then only armed it again. */
  const disarmLater = () => {
    if (disarm) clearTimeout(disarm);
    disarm = setTimeout(() => { disarm = null; if (!ui.alive || ui.alive()) ui.rerender(); }, SEAT_RELINQUISH_ARM_MS);
  };

  /** BOARD-UI: what a challenger's influence must reach this week - the claim's threshold at an unheld seat, past the
   *  holder's defence (and the threshold) at a held one. */
  const targetOf = () => {
    const need = CLAIM_THRESHOLD[seat.tier === 'crown' ? 'crown' : 'palace'];
    return Number.isFinite(data?.defence) ? Math.max(need, data.defence + 1) : need;
  };
  function standingsNode() {
    const list = el('ol', 'notice-standings');
    const rows = data?.standings ?? [];
    const holderId = data?.holder?.guild?.id ?? null;
    const target = targetOf();
    rows.forEach((s, i) => {
      const li = el('li', `notice-standing${data?.mine?.guild === s.guild.id ? ' mine' : ''}`);
      const img = banner(s.guild.heraldry, 26);
      li.append(img ?? el('span', 'seat-nobanner'));
      li.append(el('span', null, seatStandingLine(s, i)));
      // BOARD-UI: a challenger's bar toward what it needs (never the holder's - its influence is its defence)
      if (s.guild.id !== holderId) {
        const share = Math.max(0, Math.min(1, (Number(s.influence) || 0) / target));
        const bar = el('span', `seat-bar${share >= 1 ? ' past' : ''}`);
        bar.setAttribute('title', `${Number(s.influence || 0).toLocaleString('en-US')} of ${target.toLocaleString('en-US')} ${holderId ? 'to win a Right of Siege' : 'to claim the Charter'}`);
        const fill = el('i');
        fill.style.width = `${(share * 100).toFixed(1)}%`;
        bar.append(fill);
        li.append(bar);
      }
      list.append(li);
    });
    if (!rows.length) list.append(el('li', 'notice-empty', seatNoStandingsLine(seat)));
    // SEAT2b part two (7.5): the Watchtowers' word - the service answers it to the holder's members alone
    for (const w of Array.isArray(data?.towers) ? data.towers : []) list.append(el('li', 'notice-seat-towers', towersText(seat.name, guildWords({ name: w.name, tag: w.tag }), w.share)));
    return list;
  }

  function leversNode(mine) {
    const out = el('div', 'notice-seat-levers');
    const here = mine.pledges.find((p) => p.region === seat.region) ?? null;
    const busy = ui.busy();
    if (seatMay(mine.rank, 'pledge') && data.phase === 'muster' && !here?.held) {   // SEAT1c: a held region is pledged by its Charter
      let b = null;
      if (here?.key === seat.key) b = button('notice-seat-drop', SEAT_PLEDGE_WORDS.drop, () => act(() => book.unpledge(seat.region)));
      else if (here) b = button('notice-seat-pledge', SEAT_PLEDGE_WORDS.move(seat), () => act(() => book.pledge(seat)));
      else if (mine.pledges.length >= SEAT_PLEDGE_REGIONS_MAX) out.append(el('p', 'notice-seat-mine', SEAT_PLEDGE_WORDS.full));
      else b = button('notice-seat-pledge', SEAT_PLEDGE_WORDS.pledge(seat), () => act(() => book.pledge(seat)));
      if (b) { b.disabled = busy; out.append(b); }
    }
    if (seatMay(mine.rank, 'tribute') && here?.key === seat.key) {
      const room = Math.max(0, Number(mine.tributeRoom) || 0);
      out.append(el('p', 'notice-seat-mine', seatTributeLine(room)));
      if (room >= TRIBUTE_MARKS_PER_INFLUENCE) {
        const n = /** @type {HTMLInputElement} */ (el('input', 'notice-input notice-seat-drakes'));
        n.type = 'number'; n.min = String(TRIBUTE_MARKS_PER_INFLUENCE); n.step = String(TRIBUTE_MARKS_PER_INFLUENCE); n.max = String(room);
        if (!tributeDrakes || tributeDrakes > room) tributeDrakes = Math.min(100, room - (room % TRIBUTE_MARKS_PER_INFLUENCE));
        n.value = String(tributeDrakes);
        n.setAttribute('aria-label', 'Silver for Tribute');
        n.setAttribute('data-focus', 'seat-tribute');
        n.oninput = () => { tributeDrakes = Math.floor(Number(n.value) || 0); };
        const pay = button('notice-seat-tribute', 'Pay Tribute', () => {
          const marks = Math.floor(tributeDrakes / TRIBUTE_MARKS_PER_INFLUENCE) * TRIBUTE_MARKS_PER_INFLUENCE;
          if (marks < TRIBUTE_MARKS_PER_INFLUENCE || marks > room) return ui.run(async () => ({ ok: false, text: accountRefusalText('bad-tribute') }));
          return act(() => book.tribute(seat, marks));
        });
        pay.disabled = busy;
        out.append(n, pay);
      }
    }
    return out;
  }

  /** SEAT1d: THE HOLDER'S LEVERS (SEAT0 7.9: "for the holder's Officers: the levers - the Tithe, the Edict") - the
   *  Tithe, once a week, within its tier's cap; the coming week's Edict, proclaimed or taken back. */
  function holdingNode(h) {
    const out = el('div', 'notice-seat-levers');
    const busy = ui.busy();
    const cap = seatTitheCap(seat);   // AUDIT SEATS-2 L1: the Market Hall's point a tier, as the service's titheCapAt
    if (h.titheWeek !== data.week) {
      const n = /** @type {HTMLInputElement} */ (el('input', 'notice-input notice-seat-tithe'));
      n.type = 'number'; n.min = '0'; n.max = String(cap); n.step = '1';
      n.value = String(titheAsk ?? h.tithe);
      n.setAttribute('aria-label', 'The Tithe, in percent');
      n.setAttribute('data-focus', 'seat-tithe');
      n.oninput = () => { titheAsk = Math.floor(Number(n.value) || 0); };
      const set = button('notice-seat-tithe-set', 'Set the Tithe', () => act(() => book.tithe(seat, Math.max(0, Math.min(cap, titheAsk ?? h.tithe)))));
      set.disabled = busy;
      out.append(n, set);
    } else out.append(el('p', 'notice-seat-mine', 'The Tithe has been set this week.'));
    const sel = /** @type {HTMLSelectElement} */ (el('select', 'notice-input notice-seat-edict'));
    sel.setAttribute('aria-label', 'The Edict for next week');
    // none two weeks running but Market Day: this week's Edict is not offered again
    const allowed = Object.keys(EDICTS).filter((k) => edictForTier(k, seat.tier) && edictMayFollow(k, h.edict));   // CROWN1: a crown's own at a crown
    for (const k of allowed) {
      const o = /** @type {HTMLOptionElement} */ (el('option', null, EDICTS[k].name));
      o.value = k;
      sel.append(o);
    }
    const chosen = edictAsk && allowed.includes(edictAsk) ? edictAsk : (h.next && allowed.includes(h.next) ? h.next : allowed[0] ?? null);
    if (chosen) sel.value = chosen;
    sel.onchange = () => { edictAsk = sel.value; ui.rerender(); };
    out.append(sel);
    const words = edictLine(chosen, seat.tier, data?.tides?.next ?? 'calm');   // SEASON1 part two: the coming week's Tide on its cost
    if (words) out.append(el('p', 'notice-seat-mine', words));
    if (chosen === 'bounty') {
      const a = /** @type {HTMLInputElement} */ (el('input', 'notice-input notice-seat-bounty'));
      a.type = 'number'; a.min = String(BOUNTY_MARKS); a.step = String(BOUNTY_MARKS); a.value = String(bountyAside);
      a.setAttribute('aria-label', 'Silver set aside for the Bounty');
      a.oninput = () => { bountyAside = Math.floor(Number(a.value) || 0); };
      out.append(a);
    }
    const go = button('notice-seat-edict-set', 'Proclaim for next week', () => act(() => book.edict(seat, chosen, chosen === 'bounty' ? bountyAside : 0)));
    go.disabled = busy || !chosen;
    out.append(go);
    if (h.next) {
      const back = button('notice-seat-edict-back', 'Take it back', () => act(() => book.edict(seat, null)));
      back.disabled = busy;
      out.append(back);
    }
    return out;
  }

  /** SEAT2a: THE HOLDER'S WINDOW (SEAT0 6.3) - a day and a start hour, its Officers' and guildmaster's to set. */
  function windowNode(w) {
    const out = el('div', 'notice-seat-levers');
    const busy = ui.busy();
    // AUDIT SEATS-3 D6 (6.3, DECIDED): a crown's sieges are its Saturday slot, whatever the holder's window - said, and no
    // lever to set a window that moves nothing
    const slot = seat.tier === 'crown' ? CROWN_SIEGE_SLOT[CROWN_SEAT_REGIONS[seat.region]] ?? null : null;
    if (slot) {
      out.append(el('p', 'notice-seat-mine', `Sieges here are fought on the crown's Saturday slot, ${siegeWindowText(slot)}, whatever the holder's window.`));
      return out;
    }
    out.append(el('p', 'notice-seat-mine', `Battles here are fought from ${siegeWindowText(w ?? SIEGE_WINDOW_DEFAULT)}${w ? '' : ' (the default)'}.`));
    const want = windowAsk ?? w ?? SIEGE_WINDOW_DEFAULT;
    const day = /** @type {HTMLSelectElement} */ (el('select', 'notice-input notice-seat-window-day'));
    day.setAttribute('aria-label', 'The window\'s day');
    SIEGE_WINDOW_DAYS.forEach((d, i) => { const o = /** @type {HTMLOptionElement} */ (el('option', null, d)); o.value = String(i); day.append(o); });
    day.value = String(want.day);
    const hour = /** @type {HTMLSelectElement} */ (el('select', 'notice-input notice-seat-window-hour'));
    hour.setAttribute('aria-label', 'The window\'s start');
    for (const h of SIEGE_WINDOW_HOURS) { const o = /** @type {HTMLOptionElement} */ (el('option', null, `${String(h).padStart(2, '0')}:00 UTC`)); o.value = String(h); hour.append(o); }
    hour.value = String(want.hour);
    day.onchange = () => { windowAsk = { day: Number(day.value), hour: want.hour }; ui.rerender(); };
    hour.onchange = () => { windowAsk = { day: want.day, hour: Number(hour.value) }; ui.rerender(); };
    const set = button('notice-seat-window-set', 'Set the window', () => act(() => book.window(seat, want.day, want.hour)));
    set.disabled = busy;
    out.append(day, hour, set);
    return out;
  }

  /** CROWN1 part two: THE ROYAL TOURNEY ruling at this crown this week (SEAT0 7.6) - what it is and gives, the ladder, and
   *  the doors into it (net/royalSession.js, through the world's hook): to contend, or to watch. */
  function royalNode(r) {
    const out = el('div', 'notice-seat-royal');
    const lines = royalTourneyLines(r);
    out.append(el('p', 'notice-seat-battle', lines[0]));
    for (const line of lines.slice(1)) out.append(el('p', 'notice-seat-mine', line));
    if (host.enterRoyal) {
      const busy = ui.busy();
      /** @type {Array<[string, string, boolean, string]>} */
      const doors = [['notice-seat-royal-enter', 'Enter the Royal Tourney', false, 'To the ring.'], ['notice-seat-royal-watch', 'Watch the Royal Tourney', true, 'You take your place to watch.']];
      for (const [cls, words, watch, said] of doors) {
        const b = button(cls, words, () => ui.run(async () => (host.enterRoyal(seat, r, watch) ? { ok: true, text: said } : { ok: false, text: '' })));
        b.disabled = busy;
        out.append(b);
      }
    }
    return out;
  }

  /** CROWN2: A GUILD'S CROWN POLITICS (SEAT0 7.8) - its liege, vassals, Pacts and the offers standing, for every member;
   *  for an Officer or the guildmaster, each one's lever and a guild's tag to offer fealty or a Pact to. */
  function politicsNode(p, lever) {
    const out = el('div', 'notice-seat-politics');
    const busy = ui.busy();
    out.append(el('p', 'notice-section', 'Fealty and Pacts'));
    const rows = politicsRows(p);
    if (!rows.length) out.append(el('p', 'notice-seat-mine', 'Your guild has no liege, no vassal and no Pact.'));
    const acts = {
      'fealty-accept': (t) => book.acceptFealty(t), 'fealty-withdraw': (t) => book.breakFealty(t), 'fealty-break': (t) => book.breakFealty(t),
      'pact-accept': (t) => book.offerPact(t), 'pact-withdraw': (t) => book.breakPact(t), 'pact-break': (t) => book.breakPact(t),
      'fealty-decline': (t) => book.declineFealty(t), 'pact-decline': (t) => book.declinePact(t),   // AUDIT-SEATS: an offer turned down
    };
    for (const r of rows) {
      const line = el('p', 'notice-seat-mine', r.text);
      for (const k of lever ? [r.act, r.alt] : []) {
        if (!k) continue;
        const b = button(`notice-seat-${k}`, POLITICS_ACTS[k], () => act(() => acts[k](r.tag)));
        b.disabled = busy;
        line.append(b);
      }
      out.append(line);
    }
    if (!lever) return out;
    const tag = /** @type {HTMLInputElement} */ (el('input', 'notice-input notice-seat-politics-tag'));
    tag.setAttribute('aria-label', 'A guild\'s tag');
    tag.placeholder = 'Guild tag';
    tag.maxLength = 8;
    tag.value = politicsTag;
    tag.oninput = () => { politicsTag = tag.value.trim(); };
    out.append(tag);
    /** @type {Array<[string, string, (t: string) => Promise<any>]>} */
    const offers = [
      ['notice-seat-swear', 'Swear fealty', (t) => book.offerFealty(t, 'vassal')],
      ['notice-seat-take', 'Take as vassal', (t) => book.offerFealty(t, 'liege')],
      ['notice-seat-pact', 'Offer a Pact', (t) => book.offerPact(t)],
    ];
    for (const [cls, words, ask] of offers) {
      const b = button(cls, words, () => (politicsTag ? act(() => ask(politicsTag)) : null));
      b.disabled = busy;
      out.append(b);
    }
    return out;
  }

  /** SEAT2a: THE WEEK'S BATTLE (SEAT0 6.3-6.4) - its announcement, each side's roster, the reader's place on it (signed,
   *  or a button to sign while the rosters are open), and a side's Guildmaster's Sellswords. */
  function fightNode(f) {
    const out = el('div', 'notice-seat-fight');
    const busy = ui.busy();
    out.append(el('p', 'notice-seat-battle', fightAnnouncement(f, seat.name)));   // AUDIT-SEATS G1: its start is the service's seconds (the law reads ms)
    const label = f.kind === 'tourney' ? ['The first contender', 'The second contender'] : ['Attackers', 'Defenders'];
    if (f.kind !== 'revolt') out.append(el('p', 'notice-seat-mine', sideLine(label[0], f.sides.attack.n, f.max, f.sides.attack.swords)));   // SEAT2b part two (c): a revolt's rising is the relay's own
    out.append(el('p', 'notice-seat-mine', sideLine(label[1], f.sides.defend.n, f.max, f.sides.defend.swords)));
    const mine = f.mine ?? null;
    if (!f.open) out.append(el('p', 'notice-seat-mine', 'The rosters are closed.'));
    if (mine?.signed) {
      // AUDIT-SEATS C8: the side in its own words - "for the the first contender" built off the roster's label
      const sideWords = f.kind === 'tourney' ? ['first contender', 'second contender'] : ['attackers', 'defenders'];
      out.append(el('p', 'notice-seat-mine', `You are signed for the ${mine.side === 'attack' ? sideWords[0] : sideWords[1]}${mine.sellsword ? ' as a Sellsword' : ''}.`));
      if (f.open) { const b = button('notice-seat-unsign', 'Give back your place', () => act(() => book.unsign(seat))); b.disabled = busy; out.append(b); }
    } else if (f.open && (mine?.side || mine?.hire)) {
      const words = mine.hire ? `Sign as a Sellsword${mine.hire.fee ? ` (${mine.hire.fee} silver)` : ''}` : 'Sign for your side';
      const b = button('notice-seat-sign', words, () => act(() => book.sign(seat)));
      b.disabled = busy;
      out.append(b);
    }
    // SEAT2a part four: THE BATTLE ENTERED from here, while its door is open (ten minutes before the start to its
    // window's close) - a signed fighter to fight, anyone else to watch (net/siegeSession.js, through the world's hook)
    const nowS = ui.nowS();
    if (host.enterBattle && f.startsAt && nowS >= passOpens({ starts_at: f.startsAt }) && nowS < passWindowEnds({ starts_at: f.startsAt, kind: f.kind, tier: f.tier })) {
      const b = button('notice-seat-enter', mine?.signed ? 'Enter the battle' : 'Watch the battle', () => ui.run(async () => {
        const ok = host.enterBattle(seat, f);
        return ok ? { ok: true, text: mine?.signed ? 'To the field.' : 'You take your place to watch.' } : { ok: false, text: '' };
      }));
      b.disabled = busy;
      out.append(b);
    }
    if (mine?.hires && f.open) {
      for (const h of mine.hires) {
        const p = el('p', 'notice-seat-mine', `${h.handle} - ${h.state === 'signed' ? 'signed' : 'offered'}${h.fee ? `, ${h.fee} silver` : ''}.`);
        if (h.state === 'offered') { const w = button('notice-seat-withdraw', 'Withdraw', () => act(() => book.withdrawHire(seat, h.handle))); w.disabled = busy; p.append(w); }
        out.append(p);
      }
      if (mine.hires.length < f.swordsMax) {
        const n = /** @type {HTMLInputElement} */ (el('input', 'notice-input notice-seat-hire-name'));
        n.value = hireHandle; n.setAttribute('aria-label', 'The Sellsword\'s username'); n.setAttribute('data-focus', 'seat-hire-name');
        n.oninput = () => { hireHandle = n.value.trim(); };
        const fee = /** @type {HTMLInputElement} */ (el('input', 'notice-input notice-seat-hire-fee'));
        fee.type = 'number'; fee.min = '0'; fee.max = String(SELLSWORD_FEE_MAX); fee.value = String(hireFee);
        fee.setAttribute('aria-label', 'The Sellsword\'s fee in silver'); fee.setAttribute('data-focus', 'seat-hire-fee');
        fee.oninput = () => { hireFee = Math.max(0, Math.floor(Number(fee.value) || 0)); };
        const hire = button('notice-seat-hire', 'Hire a Sellsword', () => (hireHandle
          ? act(() => book.hire(seat, hireHandle, Math.min(SELLSWORD_FEE_MAX, hireFee)))
          : ui.run(async () => ({ ok: false, text: accountRefusalText('bad-handle') }))));
        hire.disabled = busy;
        out.append(n, fee, hire);
      }
    }
    return out;
  }

  return {
    /** The tab first shown: the standings read. */
    open: () => load(false),
    /** The standings read again (the window's refresh). */
    reload: () => load(true),
    body() {
      const body = el('div', 'notice-cork notice-seat');
      /** BOARD-UI: a part of the tab - its own panel, under its own name. */
      const panel = (name, cls = '') => { const p = el('section', `notice-panel${cls ? ` ${cls}` : ''}`); if (name) p.append(el('h3', null, name)); body.append(p); return p; };
      // SEAT1c: the Charter under its holder's banner, the holder, this week's battle
      const holder = data?.holder ?? null;
      const charter = el('section', 'notice-panel seat-head');
      const img = holder ? banner(holder.guild.heraldry, 30) : null;
      if (img) charter.append(img);
      const who = el('div', 'seat-who');
      who.append(el('p', 'seat-charter', seatInfoLine(seat, holder?.guild ?? null)));
      charter.append(who);
      body.append(charter);
      if (!data) {
        const shut = SHUT.has(error ?? '');
        const p = el('p', 'notice-empty', loading || !error ? SEAT_TAB_WORDS.reading : shut ? (error === 'seat-unconfirmed' ? accountRefusalText(error) : SEAT_TAB_WORDS.shut) : SEAT_TAB_WORDS.slow);
        if (error && !shut && !loading) p.append(button('notice-retry', 'Try again', () => load(true)));
        body.append(p);
        return body;
      }
      who.append(el('p', 'notice-seat-mine', seatHolderLine(holder)));
      // SEAT1d: the Tithe and the Edict for everyone; the holder's own lines and its Officers' levers
      const rule = seatRuleLine(seat, holder);
      if (rule) who.append(el('p', 'notice-seat-mine', rule));
      if (data.holding) for (const line of seatHoldingLines(seat, data.holding)) who.append(el('p', 'notice-seat-mine', line));
      // THIS WEEK: the phase on its strip, the Season, the Tide, the clock
      const week = panel(SEAT_PANELS.week, 'seat-weekpanel');
      const strip = el('ol', 'seat-phases');
      for (const [id, name] of SEAT_PHASES) {
        const li = el('li', data.phase === id ? 'on' : null, name);
        if (data.phase === id) li.setAttribute('aria-current', 'step');
        strip.append(li);
      }
      week.append(strip);
      const season = seasonLine(data.week, data.season ?? null);   // SEASON1
      if (season) week.append(el('p', 'notice-seat-week notice-seat-season', season));
      const tide = data.tides ? tideLine(seat.region, data.tides.now, data.tides.next) : null;   // SEASON1 part two (9.3)
      if (tide) week.append(el('p', 'notice-seat-week notice-seat-tide', tide));
      week.append(el('p', 'notice-seat-week', seatWeekLine(data, ui.nowS())));
      // SEAT2a: the battle placed in the week, with its sides - or the Turning's line where none is placed (an older week);
      // CROWN1 part two: the Royal Tourney ruling here
      const battle = data.fight?.kind ? null : seatBattleLine(data.battle ?? null);
      if (data.fight?.kind || battle || data.royal) {
        const b = panel(SEAT_PANELS.battle, 'seat-battlepanel');
        if (data.fight?.kind) b.append(fightNode(data.fight));
        else if (battle) b.append(el('p', 'notice-seat-battle', battle));
        if (data.royal) b.append(royalNode(data.royal));
      }
      // THE STANDINGS, and what it takes
      const standings = panel(SEAT_PANELS.standings, 'seat-standingspanel');
      standings.append(standingsNode(), el('p', 'notice-seat-mine', seatClaimLine(seat, data.defence ?? null)));
      // YOUR GUILD: its pledge, your part, the levers (SEAT1b); CROWN2's Fealty and Pacts under it
      const mine = panel(SEAT_PANELS.mine, 'seat-minepanel');
      for (const line of seatMineLines(seat, data.mine ?? null, nameOf)) mine.append(el('p', 'notice-seat-mine', line));
      if (data.mine) mine.append(leversNode(data.mine));
      if (data.mine?.politics) mine.append(politicsNode(data.mine.politics, SEAT_LEVER_RANKS.includes(data.mine.rank)));   // CROWN2
      // THE HOLDER'S ORDERS - its Officers' and Guildmaster's levers: the Tithe and the Edict (SEAT1d), the battle window
      // (SEAT2a), and the Charter given up (SEAT1c, the Guildmaster's)
      const ruling = !!holder && data.mine?.guild === holder.guild.id && SEAT_LEVER_RANKS.includes(data.mine?.rank);
      const levers = !!data.holding && SEAT_LEVER_RANKS.includes(data.mine?.rank);
      if (ruling || levers) {
        const orders = panel(SEAT_PANELS.holding, 'seat-holdingpanel');
        if (levers) orders.append(holdingNode(data.holding));
        if (ruling) orders.append(windowNode(data.fight?.window ?? null));
        // SEAT1c: the guildmaster of the holder gives the Charter up here, at its board - armed by a first press
        if (ruling && data.mine.rank === GUILD_RANK_MASTER) {
          const armed = () => ui.nowS() * 1000 - armedAt < SEAT_RELINQUISH_ARM_MS;   // asked at the press, not at the draw
          const b = button('notice-seat-relinquish', armed() ? SEAT_RELINQUISH_WORDS.sure : SEAT_RELINQUISH_WORDS.arm, () => {
            if (!armed()) { armedAt = ui.nowS() * 1000; ui.rerender(); disarmLater(); return null; }
            armedAt = -Infinity;
            return act(() => book.relinquish(seat));
          });
          b.disabled = ui.busy();
          orders.append(b);
        }
      }
      // SEAT2b (Seats-Arc 7.9): the works and the stockpile - a holder's Officers and guildmaster begin a project here
      if (holder && forts) {
        drawSeatWorks(panel(null, 'seat-workspanel'), {
          forts, seat, port: host.port === true, busy: ui.busy(),
          lever: ruling,
          nameOf: host.countName ?? ((k) => k),
          onBegin: (work) => act(() => book.fortFund(seat, work, host.port === true)),
        });
      }
      // BOARD-UI: HOW THE SEAT WAR WORKS - folded under its line, and kept open across the tab's redraws
      const guide = /** @type {any} */ (el('details', 'notice-panel seat-guide'));
      guide.open = guideOpen;
      guide.addEventListener?.('toggle', () => { guideOpen = !!guide.open; });
      guide.append(el('summary', null, SEAT_PANELS.guide));
      const steps = el('ol');
      for (const [name, words] of seatGuide(seat)) { const li = el('li'); li.append(el('b', null, `${name}. `), words); steps.append(li); }
      guide.append(steps);
      body.append(guide);
      // SEAT1c: the Chronicle (SEAT0 9.2), newest first
      const lines = (data.chronicle ?? []).map((r) => chronicleLine(r, seat, book.zero ?? null)).filter(Boolean);   // SEASON1 part three: in its Season's words
      if (lines.length || host.readRecords) {
        const chron = panel(SEAT_PANELS.chronicle, 'seat-chroniclepanel');
        if (lines.length) {
          const ol = el('ol', 'notice-chronicle');
          // HERALDRY-SHOWN (Seats-Arc 8.1: "drawn on ... the Chronicle"): each line under the shield of the guild it is about,
          // where the client knows that guild's heraldry - this answer's (its holder, battle and standings), then the seats' list
          const arms = heraldryIndex(data, book.data);
          const about = (data.chronicle ?? []).filter((r) => chronicleLine(r, seat)).map(chronicleGuildOf);
          lines.forEach((l, i) => {
            const li = el('li');
            const g = about[i];
            // AUDIT HERALDRY H3: the tag's guild by its name too; AUDIT2 GUILD2 G1: as the guild is named NOW (`now`, the service's)
            const shield = g ? heraldrySwatch(document, armsNamed(arms, g.now?.tag ?? g.tag, g.now?.name ?? g.name)) : null;
            if (shield) li.append(shield);
            li.append(el('span', null, l));
            ol.append(li);
          });
          chron.append(ol);
        }
        // AUDIT-SEATS (9.2: "the board's Chronicle pinboard ... read it as prose"): the whole Chronicle, the Hall of Records
        // book, from the board - every seat's, a crown's and a palace with no shelf to hold it included
        if (host.readRecords) {
          const b = button('notice-seat-records', 'Read the Hall of Records', () => ui.run(async () => ((await host.readRecords(seat)) ? { ok: true, text: '' } : { ok: false, text: HALL_OF_RECORDS_SHUT })));
          b.disabled = ui.busy();
          chron.append(b);
        }
      }
      return body;
    },
  };
}
