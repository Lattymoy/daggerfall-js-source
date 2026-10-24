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
// Charter (who holds it, how firmly, the Tithe and Edict); PLAIN-UI (bible/10-UI/Plain-Words.md): WHAT THIS IS and the
// reader's next step, HOW THE SEAT WAR WORKS (five steps, its counts the law's own) and WORDS ON THIS BOARD; This week
// (the phase on a strip - Muster, Reckoning, Turning - and its clock, the Season, the Tide); the battle; the standings,
// each guild's bar toward what it needs (the claim, or the holder's defence); your guild (its pledge, your part, the
// levers, its Fealty and Pacts - AUDIT 657 B10); the holder's orders; the Works; and the Chronicle.
//
// Every act goes through the window's one-at-a-time door (`ui.run`), and the standings are read again after each.
import { HALL_OF_RECORDS_SHUT } from '../systems/online/onlineHomes.js';   // AUDIT-SEATS: the Hall of Records' words where it cannot be read
import { accountRefusalText } from '../net/accountClient.js';
import {
  seatInfoLine, seatWeekLine, seatSpanWords, seatStandingLine, seatNoStandingsLine, seatMineLines, seatTributeLine, seatMay,
  SEAT_PLEDGE_WORDS, SEAT_PLEDGE_REGIONS_MAX, TRIBUTE_MARKS_PER_INFLUENCE, CLAIM_THRESHOLD, CLAIM_FEE, CONTESTED_MARGIN, ACCOUNT_SEAT_WEEK_CAP, SEAT_MEMBER_WAIT_S,
  seatHolderLine, seatBattleLine, seatClaimLine, chronicleLine, SEAT_RELINQUISH_WORDS,
  seatRuleLine, seatHoldingLines, edictLine, edictMayFollow, edictForTier, royalTourneyLines, EDICTS, seatTitheCap, SEAT_LEVER_RANKS, BOUNTY_MARKS,
  politicsRows, POLITICS_ACTS, seasonLine, guildWords,
  sideLine, siegeWindowText, SIEGE_WINDOW_DAYS, SIEGE_WINDOW_HOURS, SIEGE_WINDOW_DEFAULT, SELLSWORD_FEE_MAX, passOpens, passWindowEnds,
  CROWN_SIEGE_SLOT, CROWN_SEAT_REGIONS, STANDING_START, STANDING_UNREST, UNREST_BONUS, TITHE_CAP, SEAT_LEGACY_SHARE,
} from '../net/townSeatLaw.js';
import { fightAnnouncement } from '../net/siege/siegeHerald.js';   // AUDIT-SEATS G1: the battle's line, its start in the service's seconds
import { GUILD_RANK_MASTER } from '../net/guild/guildLaw.js';
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
/** BOARD-UI: the panels' names, in the order they stand. PLAIN-UI: what the seat is, and the board's words, first. */
export const SEAT_PANELS = Object.freeze({
  about: 'What this is', guide: 'How the seat war works', words: 'Words on this board',
  week: 'This week', battle: 'This week\'s battle', standings: 'Standings', mine: 'Your guild', holding: 'The holder\'s orders',
  chronicle: 'The Chronicle',
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
    // AUDIT 657 B9: Tribute is the Guildmaster's, paid from the treasury - never a member's earning; D6: the wait the law's
    ['Earn', `Members ${n(SEAT_MEMBER_WAIT_S / 86400)} days in the guild earn influence in the seat's region: walking the town (the Watch), closing Dagon's Breaches, a home in the town, Renown and seat writs. The Guildmaster adds Tribute from the treasury. One account counts for at most ${n(ACCOUNT_SEAT_WEEK_CAP)} a week at a seat.`],
    // AUDIT 657 B9: the law's taker - the strongest past the line whose treasury holds the fee (townSeatLaw.js turningPlan)
    ['Claim', `At the Turning, Sunday 18:00 UTC, an unheld Charter goes to the strongest guild with at least ${n(CLAIM_THRESHOLD[t])} influence whose treasury can pay ${n(CLAIM_FEE[t])} silver. Two guilds within ${Math.round(CONTESTED_MARGIN * 100)}% of each other meet in a Tourney for it.`],
    ['Siege', `A held Charter is challenged by beating the holder's defense with at least ${n(CLAIM_THRESHOLD[t])}: the strongest challenger wins a Right of Siege, fought in the holder's battle window. Sign for your side on this tab.`],
    ['Hold', 'The holder sets the Tithe and an Edict and pays upkeep each week. Keeping the town raises its Standing. At a Standing of 0 the town revolts.'],
  ];
}

/**
 * PLAIN-UI (bible/10-UI/Plain-Words.md; a player: "The seat page on the notice board is extremely vague ... doesnt
 * explain anything"): WHAT THIS IS - the seat in two sentences, before any of its numbers. Pure.
 * @param {{ name: string }} seat
 */
export const seatAbout = (seat) => `${seat.name} is a seat: one player guild at a time holds its Charter and rules the town. `
  + 'Each week the guilds pledged here earn influence; at the week\'s end the strongest takes an unheld Charter, or wins the right to fight its holder for it.';

/**
 * PLAIN-UI: whether the reader may pledge their guild HERE now - the Muster, the pledge's rank, no pledge in the region
 * yet and room for one more region (leversNode's own pledge arm). AUDIT PLAIN-UI U2: the next step then carries the
 * lever itself, where it stood two screens down under Your guild. Pure.
 * @param {{ region: number }} seat @param {any} data the standings' answer
 */
export function seatMayPledgeHere(seat, data) {
  const mine = data?.mine ?? null;
  const pledges = mine?.pledges ?? [];
  return !!mine && data?.phase === 'muster' && seatMay(mine.rank, 'pledge') && !pledges.some((/** @type {any} */ p) => p.region === seat.region)
    && pledges.length < SEAT_PLEDGE_REGIONS_MAX;
}

/**
 * PLAIN-UI: THE READER'S NEXT STEP at this seat - one sentence from where the reader stands (no guild; a guild not pledged
 * here, in the Muster or after it; a pledge elsewhere; a member not yet counted; one who earns here). AUDIT PLAIN-UI U2:
 * the seat a pledge elsewhere is for, by `nameOf`, and the time left to a deadline by `nowS`, where given. Pure.
 * @param {{ name: string, region: number, key: number }} seat @param {any} data the standings' answer
 * @param {{ nameOf?: (key: number) => (string|null), nowS?: number }} [o]
 */
export function seatNextStep(seat, data, { nameOf = () => null, nowS = NaN } = {}) {
  const mine = data?.mine ?? null;
  const left = (/** @type {unknown} */ at) => (Number.isFinite(at) && Number.isFinite(nowS) ? ` (in ${seatSpanWords(Number(at) - nowS)})` : '');
  // AUDIT PLAIN-UI W12: a guest's guild is refused ('guilds-need-account') - the step says what a guild needs
  if (!mine) return 'You need a guild to take part. Open Social (beside the chat), then its Guild page to join or found one. A guild needs an account with a username and a password.';
  const here = (mine.pledges ?? []).find((/** @type {any} */ p) => p.region === seat.region) ?? null;
  if (!here) {
    if (data?.phase !== 'muster') return `Pledges are locked until the Turning, Sunday 18:00 UTC${left(data?.turningAt)}. Your guild can pledge here in next week's Muster.`;
    // AUDIT PLAIN-UI W5: a guild at its regions' most has no pledge button here (leversNode) - its next step says so
    if ((mine.pledges ?? []).length >= SEAT_PLEDGE_REGIONS_MAX) return `Your guild has pledged in ${SEAT_PLEDGE_REGIONS_MAX} regions this week, the most it can. Take one pledge down to pledge here.`;
    return seatMay(mine.rank, 'pledge')
      ? `Pledge your guild to ${seat.name} before Friday 18:00 UTC${left(data?.reckoningAt)}.`
      : `Ask an Officer or your Guildmaster to pledge your guild to ${seat.name} before Friday 18:00 UTC${left(data?.reckoningAt)}.`;
  }
  if (here.key !== seat.key) return `Your guild fights for ${nameOf(here.key) ?? 'another seat of this region'} this week, and what you earn counts there.`;
  if (!mine.seasoned) return `You count for your guild once you have been in it ${SEAT_MEMBER_WAIT_S / 86400} days.`;
  if (mine.bound && mine.bound !== mine.guild) return 'Your account fights for another guild this week, and what you earn counts there.';
  return here.held
    ? 'Your guild holds this Charter. Earn influence here to keep its defense above every challenger: walk the town, close Dagon\'s Breaches, keep a home here, gain Renown, fill seat writs.'
    : 'Earn influence for your guild here: walk the town, close Dagon\'s Breaches, keep a home here, gain Renown, fill seat writs.';
}

/**
 * PLAIN-UI: WORDS ON THIS BOARD - every name the Seat tab uses, `[word, meaning]`, its numbers the law's own
 * (net/townSeatLaw.js), so the words never drift from the rules. Pure.
 * @param {{ tier?: string }} seat
 */
export function seatWords(seat) {
  const t = seat?.tier === 'crown' ? 'crown' : 'palace';
  return [
    ['Charter', 'The right to rule this town. One player guild holds it at a time.'],
    ['Influence', `A guild's score at this seat for the week, earned by its members and bought with Tribute. ${SEAT_LEGACY_SHARE === 0.1 ? 'A tenth' : `${Math.round(SEAT_LEGACY_SHARE * 100)}%`} carries into the next week (none past a Season's end); the rest is cleared at the Turning.`],
    ['Muster, Reckoning, Turning', 'The week\'s three parts. The Muster, Sunday 18:00 to Friday 18:00 UTC: guilds pledge. The Reckoning, to Sunday 18:00: pledges are locked, influence still counts. The Turning, Sunday 18:00: the week is settled.'],
    // AUDIT PLAIN-UI W4: the pledged seat takes the region's Breaches and Renown too (seatInfluence.js countsAt)
    ['Pledge', 'A guild\'s choice of the one seat it fights for in a region this week. Its members\' work counts there: the Watch, a home and seat writs in that seat\'s town; Dagon\'s Breaches and Renown anywhere in the region.'],
    ['Defence', 'The holder\'s strength here this week: its own influence, raised or cut by the town\'s Standing, its last siege, how many seats it holds and its liege. A challenger must beat it.'],   // seatDefence
    ['Right of Siege', `Won at the Turning by the strongest challenger past the defense (and at least ${CLAIM_THRESHOLD[t].toLocaleString('en-US')} influence): a battle with the holder for the Charter, in the holder's battle window.`],
    ['Tourney', `Two guilds that pass the claim's line within ${Math.round(CONTESTED_MARGIN * 100)}% of each other fight for an unheld Charter in a Tourney.`],
    ['Standing', `How the town feels about its holder, from 0 to 100. A new Charter starts at ${STANDING_START}. Under ${STANDING_UNREST} the town is in Unrest and challengers earn ${Math.round(UNREST_BONUS * 100)}% more influence. At 0 it revolts.`],
    ['Tithe', `The holder's cut of each sale at the Notice Boards of its part of the region, set once a week (at most ${TITHE_CAP[t]}% here, more with a Market Hall).`],
    ['Edict', 'A law the holder proclaims for the coming week, such as a Market Day, a Curfew or a Festival. Some raise the town\'s Standing, some lower it.'],
    ['Tribute', `Silver the Guildmaster pays from the treasury for influence: 1 for every ${TRIBUTE_MARKS_PER_INFLUENCE} silver, at most a fifth of the guild's influence here a week. The silver is spent.`],
    // AUDIT PLAIN-UI W7: a player of neither guild in the battle - a third guild's member may be one
    ['Sellsword', 'A player of neither guild in the battle, hired for a fee by one side\'s Guildmaster to fight on that side.'],
    // AUDIT PLAIN-UI T6: the Works and crown politics are on this tab too
    ['The Works', 'The seat\'s own buildings, such as Walls, a Gatehouse, Watchtowers, Barracks and a Market Hall. The holder builds them with silver and the goods in its stockpile. They stay with the seat when the Charter changes hands, and each drops a grade.'],
    ['Fealty and Pacts', 'A guild holding a palace in a crown\'s kingdom can swear fealty to the crown\'s holder. The vassal pays the crown a share of its Tithe and gains half the crown\'s reach in its defense, and neither can pledge against the other. A Pact of non-aggression stops two guilds pledging against each other\'s seats for the rest of a Season.'],
    ['Season and Tide', 'A Season is a run of weeks, and This week shows which week of it this is. A Tide is the week\'s change of fortune in a land, such as a Harvest, a Blight or a Plague.'],
  ];
}
/**
 * PLAIN-UI: A FOLD ON THE BOARD - a `<details>` under `title`, drawn `open`, whose reader's choice is told to `chose`
 * from the `<summary>`'s press (a click, or Enter or Space on it) and never from `toggle`: AUDIT PLAIN-UI C1 - a browser
 * fires `toggle` for an `open` the draw set as well, so the default the code drew was recorded as the reader's own and a
 * redraw's queued echo could undo a fold. The press comes before the browser flips it, so the choice is `!open`.
 * @param {(tag: string, cls?: string|null, text?: string|null) => any} make the window's element maker
 * @param {string} cls @param {string} title @param {boolean} open @param {(open: boolean) => void} chose
 */
export function boardFold(make, cls, title, open, chose) {
  const d = make('details', cls);
  d.open = open;
  const s = make('summary', null, title);
  s.onclick = () => chose(!d.open);
  d.append(s);
  return d;
}

/**
 * PLAIN-UI: whether HOW THE SEAT WAR WORKS stands open when the tab is drawn - open for a reader whose guild has no
 * pledge in the seat's region (no guild, or a guild not in this war yet), folded for one already in it. Pure.
 * @param {{ region: number }} seat @param {any} data the standings' answer
 */
export const seatGuideOpen = (seat, data) => !(data?.mine?.pledges ?? []).some((/** @type {any} */ p) => p.region === seat.region);

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
  let guideOpen = null;   // BOARD-UI: the guide unfolded - PLAIN-UI: null until the reader folds or unfolds it (seatGuideOpen)
  let wordsOpen = false;   // PLAIN-UI: the board's words unfolded

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
    // window's close) - a signed fighter to fight, anyone else to watch (net/siege/siegeSession.js, through the world's hook)
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
      /** PLAIN-UI (bible/10-UI/Plain-Words.md): WHAT THIS IS and the reader's next step (where the standings say it), then
       *  HOW THE SEAT WAR WORKS and the board's words - above the numbers they explain, where they stood folded under the
       *  whole tab; AUDIT PLAIN-UI C4: and drawn for a reader the standings refused or have not reached yet, whom they
       *  explain the seat to as well. */
      const explain = () => {
        const about = panel(SEAT_PANELS.about, 'seat-aboutpanel');
        about.append(el('p', 'seat-about', seatAbout(seat)));
        if (data) {
          const next = el('p', 'seat-next', seatNextStep(seat, data, { nameOf, nowS: ui.nowS() }));
          // AUDIT PLAIN-UI U2: the step's own lever beside it - the pledge, where Your guild's stood two screens down
          if (seatMayPledgeHere(seat, data)) {
            const b = button('seat-next-pledge', SEAT_PLEDGE_WORDS.pledge(seat), () => act(() => book.pledge(seat)));
            b.disabled = ui.busy();
            next.append(b);
          }
          about.append(next);
        }
        const guide = boardFold(el, 'notice-panel seat-guide board-guide', SEAT_PANELS.guide, guideOpen ?? seatGuideOpen(seat, data), (o) => { guideOpen = o; });
        const steps = el('ol');
        for (const [name, words] of seatGuide(seat)) { const li = el('li'); li.append(el('b', null, `${name}. `), words); steps.append(li); }
        guide.append(steps);
        body.append(guide);
        const glossary = boardFold(el, 'notice-panel seat-words board-words', SEAT_PANELS.words, wordsOpen, (o) => { wordsOpen = o; });
        const dl = el('dl');
        for (const [word, meaning] of seatWords(seat)) dl.append(el('dt', null, word), el('dd', null, meaning));
        glossary.append(dl);
        body.append(glossary);
      };
      if (!data) {
        const shut = SHUT.has(error ?? '');
        const p = el('p', 'notice-empty', loading || !error ? SEAT_TAB_WORDS.reading : shut ? (error === 'seat-unconfirmed' ? accountRefusalText(error) : SEAT_TAB_WORDS.shut) : SEAT_TAB_WORDS.slow);
        if (error && !shut && !loading) p.append(button('notice-retry', 'Try again', () => load(true)));
        body.append(p);
        explain();
        return body;
      }
      who.append(el('p', 'notice-seat-mine', seatHolderLine(holder)));
      // SEAT1d: the Tithe and the Edict for everyone; the holder's own lines and its Officers' levers
      const rule = seatRuleLine(seat, holder);
      if (rule) who.append(el('p', 'notice-seat-mine', rule));
      if (data.holding) for (const line of seatHoldingLines(seat, data.holding)) who.append(el('p', 'notice-seat-mine', line));
      explain();
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
