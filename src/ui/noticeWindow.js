// @ts-check
// NOTICE1 (2026-09-28, Mac: "The new notice board should be a physical object that houses quests, the player auction
// house, etc"): THE NOTICE BOARD'S WINDOW - a corkboard of pinned parchment in the Enhanced Plus stone and brass
// (PROF0 10.1). Each note is a card with a pin and a wax seal whose colour says who posted it; a press opens it large.
//
// WHAT HANGS THERE, top to bottom (the Notices tab; the Work tab beside it holds PROF1's Court writs, and the others come
// with their slices, so no tab stands empty):
//   1. the town's rumour, pinned first - DFU's own sign, its rows as the rumour mill composed them (systems/
//      bulletinBoard.js, ROAD A9), under the town seal;
//   2. in a town with a bounty board, the line that sends the reader to it (BOUNTY1's hunts are the other boards');
//   3. the server's word under the red seal - today's Oblivion Gate while it stands, and the developers' notices;
//   4. the players' notes, newest first - a guild's recruitment under its own seal.
// A note's one button answers its author through a door that already stands (net/boardLaw.js NOTE_BUTTONS); the host
// decides which (`answer`).
//
// PROF1 (2026-09-28, Mac: "Begin!"): THE WORK TAB - the region's Court writs under the Court's purple seal, each with
// its need, its pay and Renown, its time left, what the Stores hold of it and a Take that fills it from them (PROF0 11,
// 21, 22: a Court writ is filled whole by the first to deliver, so taking it is delivering it); under them "Court writs
// today: 1 of 3" (CHAP2a: and the region's chapters' hall writs under their guilds' seals; AUDIT CHAP2 C5: the line
// "Writs today", one allowance for both). Shown only while the professions are this account's (`work`, the host's).
//
// GUILD1e (2026-09-30, Mac: "Finish the seats"): THE GUILDS TAB (PROF0 10.1: "Recruitment posters (each guild's heraldry
// and a line); a guild's own notes, members only") - the town's recruitment notes hung as their guilds' posters, and
// the reader's own guild's board (net/noticeBook.js readGuild), which its members pin to and its Officers keep. The
// board standing in a guild's hall opens this tab alone (`guildOnly`): the hall's private board, Seats-Arc 8.2.
//
// PROF5 (2026-09-29, Mac: "Continue"): THE MARKET TAB beside them (ui/marketTab.js) - the Bay's listings, the Bay's
// buy orders (GLOBAL-MARKET: every board's), this account's own and the History - shown while the market is this account's (`market`, the host's: the
// board, the professions and the Marks all open to it). Its region is handed to it on its own, not through Work's.
//
// BOARD-UI (2026-10-06, Mac: "overhaul the notice boards to enhance readability, Including each of the tabs"; "Reduce
// overusage of bloated text"): the Notices tab in two parts - the town's and the server's word ("News"), then the
// players' notes under their count; each tab names its count where it has one (the notes not yet read, the writs
// open); the Work tab's day stands above its cards, not under the last; the cards straight; the words cut to what the
// reader needs.
//
// THE HOUSE'S SHAPE, as the bounty board's (ui/bountyWindow.js) and the Broker's before it: a lazy chunk the door
// (ui/noticeDoor.js) mounts in its own host - `mountNoticeBoard(host, deps)` answers `{ repaint, unmount }` - the back
// key and a tap on the scrim leave through the door's own close. On the classic skins the window lays its own sheet,
// the kit's rules cut to its selectors, so it wears the Enhanced Plus stone whichever UI is chosen (online forces the
// enhanced lane, never necessarily its Plus face).
import { closeOnOutsideTap } from './enhancedOverlays.js';
import { overlayAction, isTextEntryTarget } from './input.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { NOTICE_CSS, PROF_CSS } from './enhancedPlusStyle.js';
import { frameCss } from './enhancedFrame.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';
import { scopeRules } from './brokerWindow.js';
import {
  NOTE_DAYS, NOTE_BUTTONS, NOTE_BUTTON_LABEL, NOTE_SUBJECT_MAX, NOTE_BODY_MAX, NOTE_LINES_MAX, NOTICE_DAYS_MAX,
  BOUNTY_BOARD_LINE, noteIsNew,
} from '../net/boardLaw.js';
import { accountRefusalText } from '../net/accountClient.js';   // PROF1: a writ's refusal, in words
import { hallPosterName } from '../net/npcChapterLaw.js';   // CHAP2a: a hall writ's guild, named
import { movedFirstText } from '../net/bagLaw.js';   // AUDIT2 BAG1 K8: what went into the Stores before a refusal
import { createMarketTab } from './marketTab.js';   // PROF5: the Market tab
import { createWorkTab } from './workTab.js';   // PROF6: the Work tab's guild writs and commissions
import { createSeatTab } from './seatTab.js';   // SEAT1b: the Seat tab - a seat town's standings, pledges and Tribute
import { createVendorTab } from './vendorTab.js';   // HOME-VENDOR: the Vendors tab, and a trader's stall
import { bannerSvg } from './heraldryArt.js';   // GUILD1e: a guild's banner over its notes and its posters

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
  b.onclick = (e) => { e.stopPropagation(); onPress(); };
  return b;
};

/** The seal a card wears - who posted it. */
export const NOTICE_SEALS = Object.freeze({ town: 'The town', bounty: 'The bounty board', server: 'The server', player: 'A player', guild: 'A guild' });
/** "2 days left", "5 hours left", "under an hour left". */
export function timeLeftText(expiresAt, nowS) {
  const s = Math.max(0, (Number(expiresAt) || 0) - nowS);
  if (s >= 86400) { const d = Math.floor(s / 86400); return `${d} day${d === 1 ? '' : 's'} left`; }
  if (s >= 3600) { const h = Math.floor(s / 3600); return `${h} hour${h === 1 ? '' : 's'} left`; }
  return 'under an hour left';
}
/** The first lines of a body, for its card - the whole is for the card opened large. */
export const snippetOf = (body, lines = 4) => String(body ?? '').split('\n').filter((l) => l.trim()).slice(0, lines).join('\n');

/** GUILD1e: the town board's recruitment notes that still recruit - each hung on the Guilds tab as its guild's poster. */
export const recruitPosters = (board) => (board?.notes ?? []).filter((n) => n?.button === 'guild' && n.guild);
/** GUILD1e: what the Guilds tab says of the reader's own guild board when it has none to show. */
export const GUILD_BOARD_EMPTY = Object.freeze({
  'no-guild': 'Join a guild to read its board.',
  shut: 'Guild boards are closed to you.',
  slow: 'Your guild\'s board did not load.',
  none: (name) => `No notes from ${name} yet.`,
});
/** BOARD-UI: the window's own fixed words, in one place - short, and plain. */
export const BOARD_WORDS = Object.freeze({
  reading: 'Reading the board...',
  stale: 'This may be out of date - the server is slow to answer.',
  closed: 'The Notice Board is closed to you. Only the town\'s news is shown.',
  slow: 'Players\' notes did not load. Only the town\'s news is shown.',
  noNotes: 'No notes from players yet.',
  news: 'News',
  notes: 'Players\' notes',
  writsShut: 'Court work is closed to you.',
  writsSlow: 'The writs did not load.',
  writsNone: (region) => `No Court writs in ${region} today. They go up once players have gathered in the region.`,
  writsReading: 'Reading the writs...',
  noRecruits: 'No guild is recruiting here.',
  hidden: 'Hidden after reports until a moderator looks at it. You can still take it down.',
  guestAnswer: 'Only a registered account can answer a note',
  pinTip: 'Answers come to you as letters. A recruit button needs a guild rank that can invite.',
  noticeTip: 'Goes up on every board, under the red seal.',
});

/**
 * The cards of a board, in the order they hang (the header's four arms, above). Pure over what the window is handed.
 * @param {{ town:{name:string}, rumour?:string[], bountyLine?:boolean, gate?:({subject:string, body:string}|null),
 *   board?:any, seenAt?:number|null }} o
 */
export function noticeCards({ town, rumour = [], bountyLine = false, gate = null, board = null, seenAt = null }) {
  const cards = [];
  const lines = (rumour ?? []).map((l) => String(l ?? '').trim()).filter(Boolean);
  if (lines.length) cards.push({ key: 'rumour', seal: 'town', subject: `News of ${town.name || 'the town'}`, body: lines.join('\n') });
  if (bountyLine) cards.push({ key: 'bounty', seal: 'bounty', subject: 'Bounties', body: BOUNTY_BOARD_LINE });
  if (gate) cards.push({ key: 'gate', seal: 'server', subject: gate.subject, body: gate.body });
  for (const n of board?.notices ?? []) {
    cards.push({ key: `notice:${n.id}`, seal: 'server', subject: n.subject, body: n.body, from: n.from, at: n.at, expiresAt: n.expiresAt, notice: n, isNew: noteIsNew(n, seenAt) });
  }
  for (const n of board?.notes ?? []) {
    cards.push({ key: `note:${n.id}`, seal: n.guild ? 'guild' : 'player', subject: n.subject, body: n.body, from: n.from, at: n.at, expiresAt: n.expiresAt, note: n, isNew: noteIsNew(n, seenAt) });
  }
  return cards;
}

export const NOTICE_SKIN_STYLE_ID = 'notice-skin-style';
/** The window's own sheet for the classic skins: its layout and the kit's rules cut to its selectors. TOAST-SPLIT: the
 *  board's window, header and presses only - "notice" alone took the HUD toasts' `.notice` dress and fade too. */
const BOARD_KIT_SEL = /\.notice-(?:shell|win|head)\b/;
export const noticeSkinCss = () => [NOTICE_CSS, PROF_CSS, scopeRules(frameCss(), (sel) => BOARD_KIT_SEL.test(sel))].join('\n');
function injectSkin(doc = document) {
  if (isEnhancedPlus() || doc.getElementById?.(NOTICE_SKIN_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = NOTICE_SKIN_STYLE_ID;
  st.textContent = noticeSkinCss();
  (doc.head ?? doc.body).append(st);
}

/**
 * THE BOARD.
 * @param {HTMLElement} host
 * @param {{
 *   town: { name: string, mapId: number },
 *   rumour?: string[], bountyLine?: boolean, gate?: () => ({subject:string, body:string}|null),
 *   book: any,
 *   answer?: (note: any) => ({ ok: boolean, text?: string } | void),
 *   character?: () => (string|null),
 *   nowS?: () => number,
 *   onExit?: (() => void) | null,
 *   work?: ({ book: any, region: number, regionName: string, countName: (key: string, n: number) => string,
 *     onTaken?: (r: any) => (string|void), writs?: any, regionNameOf?: (r: number) => string,
 *     pieces?: (c: any) => any[], settle?: () => any, onList?: (data: any) => void, forgetMarket?: () => void } | null),
 *   market?: (any | null),
 *   guilds?: boolean,
 *   guildOnly?: ({ name: string } | null),
 *   seat?: ({ seat: any, book: any, nameOf?: (key: number) => (string|null) } | null), seatBattle?: (seat: any, fight: any) => boolean,
 *   seatRoyal?: (seat: any, royal: any, watch: boolean) => boolean, seatRecords?: (seat: any) => Promise<boolean>,
 *   vendors?: any, traderOnly?: { title: string, sub?: string } | null,
 * }} deps HOME-VENDOR: `vendors` the Vendors tab's host (ui/vendorTab.js), `traderOnly` a stall's window. `work` - PROF1's Court writs for the board's region (net/profBook.js), or null where the professions are not
 *   this account's; PROF6: with `writs` (net/writBook.js) the guild writs and commissions beside them (ui/workTab.js),
 *   `pieces` the pieces in the save that answer a commission; `market` - PROF5's Market tab's host (ui/marketTab.js createMarketTab's `m`), or null where the
 *   market is not; `guilds` - GUILD1e: the Guilds tab shown (online, the board open); `guildOnly` - the board in a guild's
 *   hall: the guild's own notes alone, under the guild's name (no town is read); `seat` - SEAT1b: a seat town's
 *   Seat tab (ui/seatTab.js createSeatTab's host - the seat, the seats' book), shown while the seats are open to this account
 */
export function mountNoticeBoard(host, deps) {
  const exit = () => deps.onExit?.();
  const nowS = deps.nowS ?? (() => Math.floor(Date.now() / 1000));
  const map = deps.town.mapId;
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectSkin();
  const shell = el('div', 'notice-shell');
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', `Notice board of ${deps.town.name}`);
  const win = el('div', 'notice-win');
  shell.append(win);
  host.append(shell);

  let view = 'board';   // 'board' | 'read' | 'pin' | 'notice'
  const guildOnly = deps.guildOnly ?? null;
  // HOME-VENDOR: a trader's stall - the window over its one tab, under its owner's name (no town's board is read)
  const traderOnly = guildOnly ? null : (deps.traderOnly ?? null);
  let tab = guildOnly ? 'guilds' : traderOnly ? 'vendors' : 'notices';  // PROF1: 'notices' | 'work'; PROF5: 'market'; GUILD1e: 'guilds'
  // GUILD1e: the reader's guild board - its own read, its own one-at-a-time door
  let gboard = null, gerror = null, gstale = false, gbusy = false;
  const guildsShown = () => !!guildOnly || !!deps.guilds;
  const character = () => deps.character?.() ?? null;
  const gme = () => gboard?.me ?? { canPin: false, live: 0, max: 3, keeper: false };
  let writs = null, writsError = null, writsStale = false, writsBusy = false;   // PROF1: the Work tab's list
  const work = deps.work ?? null;
  const workShown = () => !!work && work.book?.state?.open === true;
  // PROF5: the Market tab - its own state and views, the window's one-at-a-time door and its status line
  const marketHost = deps.market ?? null;
  // MARKET-AUDIT U4: a market that shuts while its tab is read stays the tab, its shut word said (AUDIT 30 U11) - it vanished.
  // AUDIT 657 B5: and a Market the board showed as it opened stays for this opening - the board's own read of the market
  // (BOARD-UI's prefetch) can hear it is shut before the tab is pressed, and the tab went with no word; pressed, it says why
  const marketAtOpen = !!marketHost && marketHost.book?.state?.open !== false;
  const marketShown = () => !!marketHost && (marketAtOpen || marketHost.book?.state?.open !== false || tab === 'market');
  // AUDIT 30 U12: the market's door is its own - a board read under way never greys Buy, and a market act never the board
  let marketBusy = false;
  const market = marketHost ? createMarketTab(marketHost, {
    busy: () => marketBusy || !!marketHost.book?.busy,
    run: async (start) => {
      if (marketBusy) return;
      marketBusy = true; render();
      let r = null;
      try { r = await start(); } catch (e) { console.warn('[board] act', e); r = { ok: false, text: accountRefusalText('server') }; } finally { marketBusy = false; }   // MARKET-AUDIT: an act that threw left every button greyed
      if (!alive) return;
      word = { ok: !!r?.ok, text: r?.text ?? '' };
      render();
    },
    rerender: () => render(),
    hush: () => { word = null; },   // MARKET-AUDIT U6: an act's word stays with the view it was said in
    nowS,
    alive: () => alive,
  }) : null;
  let marketOpened = false;
  // HOME-VENDOR: the Vendors tab (a town's board: the region's traders) or the stall (traderOnly) - its own door, as the market's
  const vendorHost = guildOnly ? null : (deps.vendors ?? null);
  let vendorBusy = false, vendorOpened = false;
  const vendorTab = vendorHost ? createVendorTab(vendorHost, {
    busy: () => vendorBusy,
    run: async (start) => {
      if (vendorBusy) return;
      vendorBusy = true; render();
      let r = null;
      try { r = await start(); } catch (e) { console.warn('[board] act', e); r = { ok: false, text: accountRefusalText('server') }; } finally { vendorBusy = false; }   // MARKET-AUDIT: an act that threw left every button greyed
      if (!alive) return;
      word = { ok: !!r?.ok, text: r?.text ?? '' };
      render();
    },
    rerender: () => { if (alive) render(); },
    nowS,
    alive: () => alive,
  }) : null;
  // SEAT1b (Seats-Arc 7.9): the Seat tab, at a seat town's rumour board while the seats are open to this account - its
  // own door, as the market's
  const seatHost = guildOnly ? null : (deps.seat ?? null);
  const seatShown = () => !!seatHost && seatHost.book?.open === true;
  let seatBusy = false, seatOpened = false;
  const seatTab = seatHost ? createSeatTab({ ...seatHost, ...(deps.seatBattle ? { enterBattle: deps.seatBattle } : {}), ...(deps.seatRoyal ? { enterRoyal: deps.seatRoyal } : {}), ...(deps.seatRecords ? { readRecords: deps.seatRecords } : {}), banner: (h, w) => bannerImg(h, w) }, {   // SEAT2a part four: and the battle's door
    busy: () => seatBusy,
    run: async (start) => {
      if (seatBusy) return;
      seatBusy = true; render();
      let r = null;
      try { r = await start(); } catch (e) { console.warn('[board] act', e); r = { ok: false, text: accountRefusalText('server') }; } finally { seatBusy = false; }   // MARKET-AUDIT: an act that threw left every button greyed
      if (!alive) return;
      word = { ok: !!r?.ok, text: r?.text ?? '' };
      render();
    },
    rerender: () => { if (alive) render(); },
    nowS,
    alive: () => alive,
  }) : null;
  // PROF6: the Work tab's guild writs and commissions - their own door, as the market's
  let workBusy = false;
  const workMore = work?.writs ? createWorkTab({
    writs: work.writs, held: (m) => work.book.held(m), carrying: () => work.book.carrying?.() === true, region: work.region, regionName: work.regionName,   // AUDIT BAG1: whose count `held` is
    regionNameOf: work.regionNameOf ?? ((r) => String(r)), countName: work.countName, pieces: work.pieces ?? (() => []),
    reload: () => { work.book.forgetWrits?.(); loadWrits(true); },   // AUDIT 31 B7: a read begun before the act is read again
  }, {
    busy: () => workBusy || busy || !!work.writs.busy,
    nowMs: () => nowS() * 1000,
    run: async (start) => {
      if (workBusy) return;
      workBusy = true; render();
      let r = null;
      try { r = await start(); } catch (e) { console.warn('[board] act', e); r = { ok: false, text: accountRefusalText('server') }; } finally { workBusy = false; }   // MARKET-AUDIT: an act that threw left every button greyed
      if (!alive) return;
      word = { ok: !!r?.ok, text: r?.text ?? '' };
      render();
    },
    rerender: () => render(),
    nowS,
  }) : null;
  let reading = null;   // the card read large
  let word = null;      // { ok, text } - the status line
  let board = null, stale = false, error = null, busy = false;
  const seenAtOpen = deps.book.seenAt(map);   // what was new when the window opened stays marked new while it is up
  let alive = true;
  // AUDIT 28 N13: the book keeps what is being written, for the session - a stray tap outside throws nothing away
  const draft = deps.book.draft?.(map) ?? { subject: '', body: '', days: NOTE_DAYS[NOTE_DAYS.length - 1], button: '' };
  const noticeDraft = deps.book.noticeDraft?.() ?? { subject: '', body: '', days: 3 };

  const back = () => {
    if (tab === 'work' && workMore?.closeForm()) { render(); return; }   // AUDIT 31 U12: Escape closes an open form first
    if (tab === 'work' || tab === 'market' || tab === 'seat' || tab === 'vendors' || view === 'board') exit(); else { view = 'board'; reading = null; render(); }
  };
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTextEntryTarget(e.target) && e.key !== 'Escape') return;   // a field's keys are the field's
    if (e.key === 'Escape' || overlayAction(e) === 'back') { e.preventDefault(); e.stopPropagation(); back(); }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  const offOutside = closeOnOutsideTap(shell, '.notice-win', exit);

  async function load(force = false) {
    if (guildOnly) { loadGuild(force); return; }   // GUILD1e: the hall's board reads no town
    if (traderOnly) { if (vendorTab && !vendorOpened) { vendorOpened = true; vendorTab.open(); } return; }   // HOME-VENDOR: nor a stall
    busy = true; render();
    const r = await deps.book.read(map, { force });
    if (!alive) return;
    busy = false;
    board = r.board; stale = !!r.stale; error = r.error;
    if (board) deps.book.markSeen(map);
    render();
  }

  /** GUILD1e: THE READER'S GUILD BOARD read - an older read that answers after a newer one paints nothing. */
  let guildSeq = 0;
  async function loadGuild(force = false) {
    const seq = ++guildSeq;
    gbusy = true; render();
    const r = await deps.book.readGuild(character(), { force });
    if (!alive || seq !== guildSeq) return;
    gbusy = false;
    gboard = r.data; gerror = r.error; gstale = !!r.stale;
    render();
  }
  /** GUILD1e: a guild board's act - one at a time, as the town's; its answer repaints from the book's fresh read. */
  async function gact(start, after = 'board') {
    if (gbusy || busy) return;
    gbusy = true; render();
    const r = await start();
    if (!alive) return;
    gbusy = false;
    word = { ok: !!r?.ok, text: r?.text ?? '' };
    if (r?.ok) { gboard = deps.book.cachedGuild(character()) ?? gboard; view = after; reading = null; }
    render();
  }

  /** One act at a time (AUDIT 28 N9: a double press of Report or Take it down sent it twice, and the second's "no such
   *  note" overwrote the first's word). `start` is called only when nothing else is under way. */
  async function act(start, after = 'board') {
    if (busy) return;
    busy = true; render();
    const r = await start();
    if (!alive) return;
    busy = false;
    word = { ok: !!r?.ok, text: r?.text ?? '' };
    if (r?.ok) { board = deps.book.cached(map) ?? board; view = after; reading = null; deps.book.markSeen(map); }
    render();
  }

  const me = () => board?.me ?? { canPin: false, live: 0, max: 3, moderator: false, developer: false };

  function header() {
    const head = el('header', 'notice-head');
    const title = el('div', 'notice-title');
    const notes = board?.notes?.length ?? 0;
    const gnotes = gboard?.notes?.length ?? 0;
    const sub = tab === 'guilds'
      ? (gboard ? `${gnotes} note${gnotes === 1 ? '' : 's'} on ${gboard.guild?.name ?? 'your guild'}'s board · yours up: ${gme().live} of ${gme().max}` : (gbusy ? BOARD_WORDS.reading : ''))
      : board
        ? `${notes} note${notes === 1 ? '' : 's'} pinned here${me().canPin ? ` · yours up: ${me().live} of ${me().max}` : ''}`
        : (busy ? BOARD_WORDS.reading : '');
    title.append(el('h2', null, guildOnly ? `The board of ${gboard?.guild?.name ?? guildOnly.name}` : traderOnly ? traderOnly.title : `Notice Board of ${deps.town.name}`), el('p', 'notice-sub', traderOnly ? (traderOnly.sub ?? '') : sub));
    const line = el('p', `notice-word${word?.ok ? ' ok' : ''}`, word?.text ?? ((tab === 'guilds' ? gstale : stale) ? BOARD_WORDS.stale : ''));
    line.setAttribute('aria-live', 'polite');
    title.append(line);
    const acts = el('div', 'notice-headacts');
    if (tab === 'work' || tab === 'market' || tab === 'seat' || tab === 'vendors') {   // HOME-VENDOR
      acts.append(button('notice-close', 'Close', exit));
      head.append(title, acts);
      return [head, tabsNode()];
    }
    if (tab === 'guilds') {
      // GUILD1e: a note for the guild's own board, while the member has room
      if (view === 'board' && gboard && gme().canPin && gme().live < gme().max) acts.append(button('primary notice-pinbtn', 'Pin a note for the guild', () => { view = 'gpin'; word = null; render(); }));
      acts.append(button('notice-close', view === 'board' ? 'Close' : 'Back', back));
      head.append(title, acts);
      return [head, tabsNode()];
    }
    if (view === 'board' && me().canPin && me().live < me().max) acts.append(button('primary notice-pinbtn', 'Pin a note', () => { view = 'pin'; word = null; render(); }));
    if (view === 'board' && me().developer) acts.append(button('notice-noticebtn', 'Post a notice', () => { view = 'notice'; word = null; render(); }));
    acts.append(button('notice-close', view === 'board' ? 'Close' : 'Back', back));
    head.append(title, acts);
    return [head, tabsNode()];
  }

  /** BOARD-UI: a tab's count - the Notices' notes not yet read when the window opened, the Work tab's writs open to take
   *  once its list is read; null for none. */
  const tabCount = (id) => {
    if (id === 'notices') return noticeCards({ town: deps.town, board, seenAt: seenAtOpen }).filter((c) => c.isNew).length || null;
    if (id === 'work' && writs) return (writs.writs ?? []).filter((w) => w.state === 'open').length + (writs.writsOpen === true ? (writs.guildWrits ?? []).filter((w) => w.state === 'open').length + (writs.commissions ?? []).filter((c) => c.state === 'open' && c.forMe).length : 0) || null;
    return null;
  };
  /** The tabs: Notices alone, or Notices and Work while the professions are this account's (PROF1), and Market while
   *  the market is (PROF5). */
  function tabsNode() {
    const tabs = el('nav', 'notice-tabs');
    const shown = guildOnly ? [['guilds', 'Guild notes']] : traderOnly ? [['vendors', 'Trader']]   // HOME-VENDOR: a stall's one tab
      : [['notices', 'Notices'], ...(workShown() ? [['work', 'Work']] : []), ...(marketShown() ? [['market', 'Market']] : []), ...(vendorTab ? [['vendors', 'Vendors']] : []), ...(guildsShown() ? [['guilds', 'Guilds']] : []), ...(seatShown() ? [['seat', 'Seat']] : [])];
    if (!shown.some(([id]) => id === tab)) tab = shown[0][0];
    for (const [id, label] of shown) {
      const t = el(shown.length > 1 ? 'button' : 'span', `notice-tab${tab === id ? ' on' : ''}`, label);
      const n = shown.length > 1 ? tabCount(id) : null;
      if (n) { t.append(el('span', 'notice-tabcount', String(n))); t.setAttribute('aria-label', `${label}, ${n} ${id === 'work' ? 'open' : 'new'}`); }
      if (tab === id) t.setAttribute('aria-current', 'page');
      if (shown.length > 1) {
        t.setAttribute('type', 'button');
        t.onclick = () => {
          if (tab === id) return;
          tab = id; word = null;
          if (id === 'work') openWork();
          if (id === 'market' && market && !marketOpened) { marketOpened = true; market.open(); }
          if (id === 'seat' && seatTab && !seatOpened) { seatOpened = true; seatTab.open(); }   // SEAT1b
          if (id === 'vendors' && vendorTab && !vendorOpened) { vendorOpened = true; vendorTab.open(); }   // HOME-VENDOR
          if (id === 'guilds') { view = 'board'; reading = null; if (!gboard && !gbusy) loadGuild(false); }   // GUILD1e
          else if (view === 'gpin') view = 'board';
          render();
        };
      }
      tabs.append(t);
    }
    // BOARD-UI: the chosen tab scrolled into the strip, once it is in the window (a phone's strip scrolls sideways)
    Promise.resolve().then(() => { try { /** @type {any} */ (tabs.querySelector?.('.notice-tab.on'))?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); } catch { /* none to scroll */ } });
    return tabs;
  }

  /** AUDIT 31 U5: whether commissions are this account's here - the Work tab shown, and the service's word on its list
   *  (read at the window's opening where it has not been). */
  const commissionsOpen = () => !!workMore && workShown() && (writs ? workMore.open(writs) : true);
  /** The Work tab shown: PROF6's kept fills settled once (a commission's piece whose answer was lost), the list read. */
  let workSettled = false;
  function openWork() {
    if (!workSettled && work?.settle) { workSettled = true; Promise.resolve(work.settle()).catch(() => {}).then(() => { if (alive && workMore) loadWrits(true); }); }
    if (!writs && !writsBusy) loadWrits(false);
  }

  /** AUDIT 31 B7: the Work list's reads in order - an older read that answers after a newer one paints nothing. */
  let writsSeq = 0;
  async function loadWrits(force) {
    if (!work) return;
    const seq = ++writsSeq;
    writsBusy = true; render();
    const r = await work.book.writs(work.region, { force });
    if (!alive || seq !== writsSeq) return;
    writsBusy = false;
    writs = r.data; writsError = r.error; writsStale = !!r.stale;
    if (r.data && !r.stale) {
      try { work.onList?.(r.data); } catch (e) { console.warn('[work] list', e); }   // AUDIT 31 B5: its balance the Bank's
      // AUDIT 31 H6: a commission of this account's filled - its piece comes by the market's deliveries, read fresh there
      if ((r.data.yours?.commissions ?? []).some((c) => c.mine && c.state === 'filled')) { try { work.forgetMarket?.(); } catch { /* the market's own */ } }
    }
    render();
  }

  /** A Court writ's card: its need, pay and Renown, its time left, what the Stores hold of it, and Take. CHAP2a: a hall
   *  writ's the same, under the guild's seal and name (npcChapterLaw.js hallPosterName) - its pay its guild's standing too. */
  function writNode(w) {
    const poster = w.kind === 'hall' ? hallPosterName(w.faction) ?? 'guild' : null;
    const li = el('li', `notice-card notice-writ ${poster ? 'seal-guild' : 'seal-court'}${w.state !== 'open' ? ' done' : ''}`);
    li.append(el('span', 'notice-pin'), el('span', 'writ-kind', poster ? 'Hall writ' : 'Court writ'));
    li.append(el('p', 'writ-need', poster
      ? `Wanted: ${w.qty} ${work.countName(w.material, w.qty)}, for the ${poster} in ${work.regionName}`
      : `The Court of ${work.regionName} needs ${w.qty} ${work.countName(w.material, w.qty)}`));
    li.append(el('p', 'writ-pay', `Pays ${w.pay.toLocaleString('en-US')} silver, ${w.renown.toLocaleString('en-US')} Renown${poster ? ` and standing with the ${poster}` : ''}`));
    li.append(el('p', 'writ-left', w.state === 'mine' ? 'Taken by you' : w.state === 'taken' ? 'Filled by another' : timeLeftText(w.expiresAt, nowS())));
    const held = work.book.held(w.material);
    const take = el('div', 'writ-take');
    if (w.state === 'open') {
      const full = (work.book.state.writs?.today ?? 0) >= (work.book.state.writs?.max ?? 3);
      const b = button('primary notice-take', 'Take', () => takeWrit(w));
      b.disabled = busy || workBusy || held < w.qty || full;   // AUDIT 31 B10: nor while a guild writ's or a commission's act is out
      if (held < w.qty) b.title = work.book.carrying?.() ? 'Not enough - your Stores, Materials Bag and pack together' : 'Not enough in your Stores';   // BAG1; AUDIT BAG1: and the pack
      else if (full) b.title = 'You have filled today\'s writs';   // CHAP2a: the Court's and the halls' one allowance
      take.append(b);
    }
    take.append(el('span', null, `${held.toLocaleString('en-US')} ${work.book.carrying?.() ? 'held' : 'in your Stores'}`));   // BAG1: the Stores' and what is carried
    li.append(take, el('span', 'notice-seal', ''));
    return li;
  }

  async function takeWrit(w) {
    if (busy || workBusy) return;
    busy = true; render();
    const r = await work.book.deliver(w.id, work.region, { material: w.material, qty: w.qty });   // AUDIT BAG1 B9: the card's own word
    // AUDIT CHAP2 C1: the host hears a filled writ whether or not the board still stands - its balance, its Renown and a
    // hall writ's Roll refresh were lost with a board closed while the answer was out
    const said = r?.ok ? work.onTaken?.(r) : null;
    if (!alive) return;
    busy = false;
    if (r?.ok) {
      writs = work.book.state && writs ? { ...writs, writs: writs.writs.map((x) => (x.id === w.id ? { ...x, state: 'mine' } : x)), today: r.data?.today ?? writs.today } : writs;
      word = { ok: true, text: said || `Writ filled: ${r.data?.pay ?? w.pay} silver.` };
    } else {
      word = { ok: false, text: `${accountRefusalText(r?.error)}${movedFirstText(r)}` };
      if (r?.error === 'writ-taken' || r?.error === 'writ-expired') loadWrits(true);
    }
    render();
  }

  function workBody() {
    const body = el('div', 'notice-cork');
    // BOARD-UI: the day's count above the cards - under the last card it stood off the bottom of a long list
    const today = writs?.today ?? { filled: work.book.state.writs?.today ?? 0, max: work.book.state.writs?.max ?? 3 };
    // AUDIT CHAP2 C5: "Writs" - the count is every writ the account filled today, the Court's and the halls' (CALL 8)
    body.append(el('p', 'notice-worktoday', `Writs today: ${today.filled} of ${today.max}${writsStale ? ' - the list may be out of date' : ''}`));
    const grid = el('ul', 'notice-grid');
    grid.setAttribute('role', 'list');
    const list = writs?.writs ?? [];
    for (const w of list) grid.append(writNode(w));
    // PROF6: this region's guild writs and commissions in the Court's own grid (AUDIT 31 U14 - the Court's stood alone)
    const more = workMore ? workMore.cards(writs) : [];
    for (const c of more) grid.append(c);
    if (writsBusy && !writs) grid.append(el('li', 'notice-empty', BOARD_WORDS.writsReading));
    else if (!writs && writsError) {
      const shut = writsError === 'prof-closed' || writsError === 'no-session' || writsError === 'auth';
      const li = el('li', 'notice-empty', shut ? BOARD_WORDS.writsShut : BOARD_WORDS.writsSlow);   // AUDIT 31 U13: the guilds' and the commissions' too
      if (!shut) li.append(button('notice-retry', 'Try again', () => loadWrits(true)));   // AUDIT 29 C11: read now, not in a minute
      grid.append(li);
    }
    else if (writs && !list.length) grid.append(el('li', 'notice-empty', BOARD_WORDS.writsNone(work.regionName)));
    body.append(grid);
    const yours = workMore ? workMore.node(writs) : null;   // PROF6: "Yours", the forms
    if (yours) body.append(yours);
    return body;
  }

  function cardNode(c) {
    const li = el('li', `notice-card seal-${c.seal}${c.isNew ? ' new' : ''}${c.note?.hidden ? ' hidden' : ''}`);
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.append(el('span', 'notice-pin'), el('h4', null, c.subject), el('p', 'notice-snippet', snippetOf(c.body)));
    const foot = el('div', 'notice-foot');
    foot.append(el('span', 'notice-from', c.from ? `- ${c.from}` : NOTICE_SEALS[c.seal]));
    if (c.isNew) foot.append(el('span', 'notice-new', 'new'));
    li.append(foot, el('span', 'notice-seal', ''));
    const open = () => { reading = c; view = 'read'; word = null; render(); };
    li.onclick = open;
    li.onkeydown = (e) => { if (e.target === li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault?.(); open(); } };
    return li;
  }

  /** BOARD-UI: a part's name over its grid, ruled, with its count where it has one. */
  function sectionHead(text, count = null) {
    const h = el('h3', 'notice-section', text);
    if (count != null) h.append(el('span', 'notice-sectioncount', String(count)));
    return h;
  }
  function gridOf(cards) {
    const grid = el('ul', 'notice-grid');
    grid.setAttribute('role', 'list');
    for (const c of cards) grid.append(cardNode(c));
    return grid;
  }
  /** THE NOTICES TAB (BOARD-UI): the town's and the server's word ("News"), then the players' notes under their count. */
  function boardBody() {
    const body = el('div', 'notice-cork');
    const cards = noticeCards({ town: deps.town, rumour: deps.rumour, bountyLine: deps.bountyLine, gate: deps.gate?.() ?? null, board, seenAt: seenAtOpen });
    const news = cards.filter((c) => !c.note), notes = cards.filter((c) => c.note);
    if (news.length) body.append(sectionHead(BOARD_WORDS.news), gridOf(news));
    body.append(sectionHead(BOARD_WORDS.notes, board ? notes.length : null));
    const grid = gridOf(notes);
    if (!board && !busy && error) {
      // AUDIT 28 N11: a board closed to this account says so - the next press is DFU's own sign again
      grid.append(el('li', 'notice-empty', error === 'board-closed' || error === 'no-session' || error === 'auth' ? BOARD_WORDS.closed : BOARD_WORDS.slow));
    }
    else if (board && !notes.length) grid.append(el('li', 'notice-empty', `${BOARD_WORDS.noNotes}${me().canPin ? ' Pin the first.' : ''}`));
    body.append(grid);
    return body;
  }

  /** GUILD1e: a guild's banner as a picture (the port's own drawing, heraldryArt.js) - null for a guild with none. */
  function bannerImg(heraldry, width) {
    if (!heraldry) return null;
    const img = /** @type {HTMLImageElement} */ (el('img', 'notice-banner'));
    img.alt = '';
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bannerSvg(heraldry, { width }))}`;
    return img;
  }

  /** GUILD1e: a town's recruitment note hung as its guild's poster - the banner, the guild, the note's subject. */
  function posterNode(n) {
    const c = { key: `note:${n.id}`, seal: 'guild', subject: n.subject, body: n.body, from: n.from, at: n.at, expiresAt: n.expiresAt, note: n };
    const li = el('li', 'notice-card notice-poster seal-guild');
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    const img = bannerImg(n.guild.heraldry, 38);
    li.append(el('span', 'notice-pin'));
    if (img) li.append(img);
    li.append(el('h4', null, `<${n.guild.tag}> ${n.guild.name}`), el('p', 'notice-snippet', n.subject));
    li.append(el('div', 'notice-foot', `- ${n.from}`), el('span', 'notice-seal', ''));
    const open = () => { reading = c; view = 'read'; word = null; render(); };
    li.onclick = open;
    li.onkeydown = (e) => { if (e.target === li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault?.(); open(); } };
    return li;
  }

  /** GUILD1e: THE GUILDS TAB - the reader's own guild's board under its banner, then the town's recruitment posters (the
   *  hall's board: the guild's notes alone). */
  function guildsBody() {
    const body = el('div', 'notice-cork');
    const g = gboard?.guild ?? null;
    const head = el('h3', 'notice-section');
    const img = g ? bannerImg(g.heraldry, 30) : null;
    if (img) head.append(img);
    head.append(el('span', null, g ? `<${g.tag}> ${g.name} - members only` : 'Your guild'));
    body.append(head);
    const grid = el('ul', 'notice-grid');
    grid.setAttribute('role', 'list');
    const notes = gboard?.notes ?? [];
    for (const n of notes) grid.append(cardNode({ key: `gnote:${n.id}`, seal: 'guild', subject: n.subject, body: n.body, from: n.from, at: n.at, expiresAt: n.expiresAt, gnote: n }));
    if (gbusy && !gboard) grid.append(el('li', 'notice-empty', 'Reading your guild\'s board...'));
    else if (!gboard && gerror) {
      const shut = gerror === 'board-closed' || gerror === 'no-session' || gerror === 'auth';
      const li = el('li', 'notice-empty', gerror === 'no-guild' ? GUILD_BOARD_EMPTY['no-guild'] : shut ? GUILD_BOARD_EMPTY.shut : GUILD_BOARD_EMPTY.slow);
      if (!shut && gerror !== 'no-guild') li.append(button('notice-retry', 'Try again', () => loadGuild(true)));
      grid.append(li);
    }
    else if (gboard && !notes.length) grid.append(el('li', 'notice-empty', GUILD_BOARD_EMPTY.none(g?.name ?? 'your guild')));
    body.append(grid);
    if (!guildOnly) {
      const posters = recruitPosters(board);
      body.append(sectionHead(`Recruiting in ${deps.town.name}`));
      const pg = el('ul', 'notice-grid');
      pg.setAttribute('role', 'list');
      for (const n of posters) pg.append(posterNode(n));
      if (!posters.length) pg.append(el('li', 'notice-empty', BOARD_WORDS.noRecruits));
      body.append(pg);
    }
    return body;
  }

  /** GUILD1e: a note for the guild's own board - a letter pinned up for the members (no button: they answer in its chat). */
  function guildPinBody() {
    const d = deps.book.guildDraft?.(character()) ?? { subject: '', body: '', days: NOTE_DAYS[NOTE_DAYS.length - 1] };
    const body = el('div', 'notice-cork');
    const form = el('form', 'notice-form');
    const subject = /** @type {HTMLInputElement} */ (el('input', 'notice-input'));
    subject.maxLength = NOTE_SUBJECT_MAX; subject.value = d.subject; subject.placeholder = 'What is it about?';
    subject.setAttribute('data-focus', 'gsubject');
    const text = /** @type {HTMLTextAreaElement} */ (el('textarea', 'notice-textarea'));
    text.maxLength = NOTE_BODY_MAX; text.value = d.body; text.rows = 7; text.placeholder = 'Your note';
    text.setAttribute('data-focus', 'gbody');
    const counted = el('span', 'notice-count', `${d.body.length} / ${NOTE_BODY_MAX}`);
    subject.oninput = () => { d.subject = subject.value; };
    text.oninput = () => { d.body = text.value; counted.textContent = `${text.value.length} / ${NOTE_BODY_MAX}${text.value.split('\n').length > NOTE_LINES_MAX ? ` - at most ${NOTE_LINES_MAX} lines` : ''}`; };
    const days = /** @type {HTMLSelectElement} */ (el('select', 'notice-select'));
    for (const n of NOTE_DAYS) { const o = /** @type {HTMLOptionElement} */ (el('option', null, `${n} day${n === 1 ? '' : 's'}`)); o.value = String(n); if (n === d.days) o.selected = true; days.append(o); }
    days.onchange = () => { d.days = Number(days.value); };
    form.append(field('Subject', subject), field('Note', text, counted), field('Keep it up for', days));
    form.append(el('p', 'notice-tip', `Only members of ${gboard?.guild?.name ?? 'your guild'} can read it.`));
    const acts = el('div', 'notice-acts');
    acts.append(button('primary notice-dopin', gbusy ? 'Pinning...' : 'Pin it', () => {
      gact(() => deps.book.pinGuild(character(), { subject: d.subject, body: d.body, days: d.days }))
        .then(() => { if (word?.ok) { d.subject = ''; d.body = ''; } });
    }));
    form.onsubmit = (e) => { e.preventDefault(); };
    form.append(acts);
    body.append(form);
    setTimeout(() => subject.focus?.(), 0);
    return body;
  }

  function readBody() {
    const c = reading;
    const body = el('div', 'notice-cork');
    const card = el('article', `notice-read seal-${c.seal}`);
    card.append(el('span', 'notice-pin'), el('h3', null, c.subject));
    const n = c.note;
    if (n?.guild) card.append(el('p', 'notice-guild', `Recruiting for <${n.guild.tag}> ${n.guild.name}`));
    card.append(el('p', 'notice-text', c.body));
    const meta = el('p', 'notice-meta');
    meta.textContent = [c.from ? `Posted by ${c.from}${n?.title ? `, ${n.title}` : ''}` : NOTICE_SEALS[c.seal], c.expiresAt ? timeLeftText(c.expiresAt, nowS()) : ''].filter(Boolean).join(' · ');
    card.append(meta);
    if (!me().moderator && n?.mine && n.hidden) card.append(el('p', 'notice-mod', BOARD_WORDS.hidden));   // AUDIT 28 N2
    if (me().moderator && n?.hidden) card.append(el('p', 'notice-mod', `Hidden by ${n.reports} report${n.reports === 1 ? '' : 's'} · note ${n.id}`));
    else if (me().moderator && n) card.append(el('p', 'notice-mod', `Note ${n.id}${n.reports ? ` · ${n.reports} report${n.reports === 1 ? '' : 's'}` : ''}`));
    const acts = el('div', 'notice-acts');
    if (n && n.button && !n.mine && deps.answer) {
      const b = button('primary notice-answer', NOTE_BUTTON_LABEL[n.button] ?? 'Answer', () => {
        // PROF6: a crafter's advertisement - the Work tab's commission form, its author named (10.6)
        if (n.button === 'commission') {
          if (!commissionsOpen()) { word = { ok: false, text: 'Commissions are not open to you here.' }; render(); return; }
          workMore.openCommission(n.from);
          tab = 'work'; view = 'board'; reading = null; word = null;
          openWork();
          render();
          return;
        }
        const r = deps.answer?.(n);
        if (r && r.ok === false) { word = { ok: false, text: r.text ?? '' }; render(); }
      });
      if (!me().canPin) { b.disabled = true; b.title = BOARD_WORDS.guestAnswer; }
      // AUDIT 31 U5: a crafter's button only where commissions are this account's - never pressed to be refused
      else if (n.button === 'commission' && !commissionsOpen()) { b.disabled = true; b.setAttribute('title', 'Commissions are not open to you here'); }
      acts.append(b);
    }
    if (n?.mine) acts.append(button('notice-takedown', 'Take it down', () => act(() => deps.book.takeDown(map, n.id))));
    if (n && !n.mine && me().canPin) acts.append(button('notice-report', 'Report', () => act(() => deps.book.report(map, n.id))));
    if (n && me().moderator) {
      if (n.hidden) acts.append(button('notice-restore', 'Restore', () => act(() => deps.book.modRestore(map, n.id))));
      acts.append(button('notice-remove', 'Remove', () => act(() => deps.book.modRemove(map, n.id))));
    }
    if (c.notice && me().developer) acts.append(button('notice-remove', 'Take the notice down', () => act(() => deps.book.noticeRemove(map, c.notice.id))));
    // GUILD1e: a guild note - its author's to take down, and an Officer's or the guildmaster's (the service asks again)
    if (c.gnote && (c.gnote.mine || gme().keeper)) acts.append(button('notice-takedown', 'Take it down', () => gact(() => deps.book.takeDownGuild(character(), c.gnote.id))));
    card.append(acts);
    body.append(card);
    return body;
  }

  function field(label, input, count = null) {
    const f = el('label', 'notice-field');
    f.append(el('span', 'notice-label', label), input);
    if (count) f.append(count);
    return f;
  }

  function pinBody() {
    const body = el('div', 'notice-cork');
    const form = el('form', 'notice-form');
    const subject = /** @type {HTMLInputElement} */ (el('input', 'notice-input'));
    subject.maxLength = NOTE_SUBJECT_MAX; subject.value = draft.subject; subject.placeholder = 'What is it about?';
    const text = /** @type {HTMLTextAreaElement} */ (el('textarea', 'notice-textarea'));
    text.maxLength = NOTE_BODY_MAX; text.value = draft.body; text.rows = 7; text.placeholder = 'Your note';
    const counted = el('span', 'notice-count', `${draft.body.length} / ${NOTE_BODY_MAX}`);
    subject.oninput = () => { draft.subject = subject.value; };
    text.oninput = () => { draft.body = text.value; counted.textContent = `${text.value.length} / ${NOTE_BODY_MAX}${text.value.split('\n').length > NOTE_LINES_MAX ? ` - at most ${NOTE_LINES_MAX} lines` : ''}`; };
    const days = /** @type {HTMLSelectElement} */ (el('select', 'notice-select'));
    for (const d of NOTE_DAYS) { const o = /** @type {HTMLOptionElement} */ (el('option', null, `${d} day${d === 1 ? '' : 's'}`)); o.value = String(d); if (d === draft.days) o.selected = true; days.append(o); }
    days.onchange = () => { draft.days = Number(days.value); };
    const btn = /** @type {HTMLSelectElement} */ (el('select', 'notice-select'));
    for (const k of ['', ...NOTE_BUTTONS]) { const o = /** @type {HTMLOptionElement} */ (el('option', null, k ? NOTE_BUTTON_LABEL[k] : 'None')); o.value = k; if (k === draft.button) o.selected = true; btn.append(o); }
    btn.onchange = () => { draft.button = btn.value; };
    form.append(field('Subject', subject), field('Note', text, counted), field('Keep it up for', days), field('Answer button', btn));
    form.append(el('p', 'notice-tip', BOARD_WORDS.pinTip));
    const acts = el('div', 'notice-acts');
    const pin = button('primary notice-dopin', busy ? 'Pinning...' : 'Pin it', () => {
      act(() => deps.book.pin(map, { subject: draft.subject, body: draft.body, days: draft.days, button: draft.button || null, character: deps.character?.() ?? null }))
        .then(() => { if (word?.ok) { draft.subject = ''; draft.body = ''; draft.button = ''; } });
    });
    acts.append(pin);
    form.onsubmit = (e) => { e.preventDefault(); };
    form.append(acts);
    body.append(form);
    setTimeout(() => subject.focus?.(), 0);
    return body;
  }

  function noticeBody() {
    const body = el('div', 'notice-cork');
    const form = el('form', 'notice-form');
    const subject = /** @type {HTMLInputElement} */ (el('input', 'notice-input'));
    subject.maxLength = NOTE_SUBJECT_MAX; subject.value = noticeDraft.subject;
    const text = /** @type {HTMLTextAreaElement} */ (el('textarea', 'notice-textarea'));
    text.maxLength = NOTE_BODY_MAX; text.value = noticeDraft.body; text.rows = 6;
    const days = /** @type {HTMLInputElement} */ (el('input', 'notice-input notice-days'));
    days.type = 'number'; days.min = '1'; days.max = String(NOTICE_DAYS_MAX); days.value = String(noticeDraft.days);
    subject.oninput = () => { noticeDraft.subject = subject.value; };
    text.oninput = () => { noticeDraft.body = text.value; };
    days.oninput = () => { noticeDraft.days = Number(days.value); };
    form.append(field('Subject', subject), field('Notice', text), field(`Days (1 to ${NOTICE_DAYS_MAX})`, days));
    form.append(el('p', 'notice-tip', BOARD_WORDS.noticeTip));
    const acts = el('div', 'notice-acts');
    acts.append(button('primary notice-dopost', 'Post on every board', () => {
      // AUDIT 28 N7: posted, the draft is spent - a second press never puts the same notice up twice
      act(() => deps.book.notice(map, { ...noticeDraft })).then(() => { if (word?.ok) { noticeDraft.subject = ''; noticeDraft.body = ''; } });
    }));
    form.onsubmit = (e) => { e.preventDefault(); };
    form.append(acts);
    body.append(form);
    return body;
  }

  /**
   * AUDIT 31 U1: WHAT A REDRAW KEEPS - the field being typed in (its `data-focus` key, its caret) and how far the body is
   * scrolled, taken BEFORE the window empties itself and given back after it is drawn. The tabs looked for the focused
   * field themselves (AUDIT 30 U8) after the window had already emptied, when the focus had fallen to the page: every
   * read's answer threw the reader out of the number they were typing and back to the top of the list.
   */
  function keptOf() {
    const a = /** @type {any} */ (globalThis.document?.activeElement);
    const key = a && win.contains?.(a) ? a.getAttribute?.('data-focus') ?? null : null;
    let at = null;
    if (key) { try { at = [a.selectionStart, a.selectionEnd]; } catch { /* a number field has none */ } }
    const b = /** @type {any} */ (win.querySelector?.('.notice-cork'));
    return { key, at, top: b?.scrollTop ?? 0, where: `${tab}|${view}` };
  }
  function giveBack(k) {
    const b = /** @type {any} */ (win.querySelector?.('.notice-cork'));
    if (b && k.top && k.where === `${tab}|${view}`) b.scrollTop = k.top;
    if (!k.key) return;
    const n = /** @type {any} */ ([...(win.querySelectorAll?.('input, select, textarea') ?? [])].find((x) => x.getAttribute?.('data-focus') === k.key));
    if (!n) return;
    try { n.focus?.({ preventScroll: true }); } catch { n.focus?.(); }
    if (k.at && k.at[0] != null) { try { n.setSelectionRange(k.at[0], k.at[1]); } catch { /* none to set */ } }
  }
  /** CRASH-BLUR (from play, 2026-10-07: "NotFoundError: Failed to execute 'replaceChildren' ... Perhaps it was moved in a
   *  'blur' event handler"): a paint asked for WHILE one paints is coalesced, never run inside it. Emptying the window
   *  takes a focused list out of the document, the browser blurs it as it goes, and the Market's answer held for that
   *  list (marketTab.js's redraw) repaints on that blur - a second replaceChildren inside the first emptied the window
   *  under it, and the first threw on the node already gone. The inner ask is kept and drawn once the outer is done. */
  let painting = false, paintAgain = false;
  function render() {
    if (!alive) return;
    if (painting) { paintAgain = true; return; }
    painting = true;
    try {
      do { paintAgain = false; paint(); } while (paintAgain && alive);
    } finally { painting = false; }
  }
  function paint() {
    const kept = keptOf();
    win.replaceChildren();
    win.append(...header());
    if (tab === 'work' && workShown()) win.append(workBody());
    else if (tab === 'market' && market && marketShown()) win.append(market.body());
    else if (tab === 'seat' && seatTab && seatShown()) win.append(seatTab.body());   // SEAT1b
    else if (tab === 'vendors' && vendorTab) win.append(vendorTab.body());   // HOME-VENDOR
    else if (tab === 'guilds' && guildsShown()) win.append(view === 'gpin' ? guildPinBody() : view === 'read' && reading ? readBody() : guildsBody());   // GUILD1e
    else win.append(view === 'read' && reading ? readBody() : view === 'pin' ? pinBody() : view === 'notice' ? noticeBody() : boardBody());
    giveBack(kept);
  }

  render();
  load(false);
  // BOARD-UI (Mac: "Enhance the speed at which the notice board and market loads"): the Market's first view read as the
  // board opens, beside the board's own read - its tab answers from the minute's cache, or joins the read under way
  if (market && marketShown()) market.prefetch?.();
  return {
    repaint: () => render(),
    unmount() {
      if (!alive) return;
      alive = false;
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      offOutside();
      shell.remove();
    },
  };
}
