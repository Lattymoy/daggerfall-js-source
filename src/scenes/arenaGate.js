// @ts-check
// ARENA3 (2026-10-02, Mac: "join a team (red and blue)"; "Joining a team comes with it's own enhanced UI"): THE GATE'S
// PEOPLE WHO ARE NOT THE HERALD - the Red and Blue Banners' recruiters, and (with the book) the bookmaker - answered in
// ONE place for both hosts that stand the colosseum (scenes/world.js, the streaming world; scenes/exterior.js, the city
// alone), so the two never drift; and THE ARENA WINDOW's model and its presses (ui/arenaDoor.js, systems/arenaBoard.js).
// Design: bible/11-Multiplayer/Arena.md "3. The teams", "5. The Arena window".
//
// Each person's word is a keyed choice (ui/talkWindow.js ChoiceWindow - the enhanced dialog on the Plus skin, the panel
// on the classic one) built by the pure law (systems/arenaHerald.js recruiterChoice); this file only does what a choice
// asks - joins the banner, quits it (asked twice), opens the Arena window on its Team page - and says what was done.
// The league rides the player (`playerEntity.arenaLeague`, systems/save.js), rolled to the season on every read.
//
// ARENA4b: ONLINE THE ACCOUNT IS THE LAW (bible/11-Multiplayer/Arena.md "7. Online"). While the arena online is live
// (scenes/arenaOnline.js): a recruiter's choice reads and writes the ACCOUNT's banner (the board's `me.banner`, `left`,
// `leftSeason`; the service refuses in its own words) and the save's league is left untouched; the Herald's choice
// (`heraldChoice`, both hosts' Herald) reads the account's climb - Fight offers its next bout, "the ladder done" is its,
// and until the realm's records are in Fight is not offered and his line says why; the window's Fight waits the same;
// the Keeper of the Hall reads the realm's wall (`hall` - the board the window last fetched, or asked). Offline all of it
// is ARENA3's, unchanged.
//
// Not a DFU member. Ledger A (ARENA).

import { ChoiceWindow } from '../ui/talkWindow.js';
import { ActionTextBox } from '../ui/actionText.js';   // ARENA4b: the Keeper's wall, read online
import { recruiterChoice, quitAsk, heraldChoice as heraldChoiceOf } from '../systems/arenaHerald.js';
import { joinBanner, quitBanner, rollLeague } from '../systems/arenaLeague.js';
import { ARENA_TEXT } from '../systems/arenaText.js';
import { bookmakerChoice, stakeChoice, placeWager, settleBook, bookVerdict, collectWinnings, oddsText, exhibitionOdds, priceFor } from '../systems/arenaBook.js';
import { exhibitionFor } from '../systems/arenaLadder.js';
import { fighterIdentity } from '../systems/arenaFighters.js';
import { totalGoldAmount, deductGold, addGold } from '../systems/court.js';
import { arenaBoard, hallLinesOnline, hallPlaques } from '../systems/arenaBoard.js';
import { PLAQUE_MAX } from '../world/arenaPlaques.js';   // ARENA5: the wall's cap
import { arenaReplaysRestore } from '../systems/arenaReplay.js';   // ARENA5: your ladder replay
import { nextLadderBout, arenaLadderRestore } from '../systems/arenaLadder.js';
import { FIGHT_HEALTH_MIN } from '../systems/arenaHerald.js';
import { createArenaOverlay, closeArenaDoor } from '../ui/arenaDoor.js';
import { bookRestore, houseOutcome } from '../systems/arenaBook.js';   // ARENA4b: online the relay's verdict settles, the house's only for an hour it never ran

/** How near the Herald the Arena window's Watch, Fight and Wager may be pressed, metres (the gate and its plaza). */
export const AT_GATE_M = 60;
/** Whether feet stand at the gate: within AT_GATE_M of the Herald's place (`herald` null - no gate here). */
export const nearArenaGate = (feet, herald) => !!feet && !!herald && Math.hypot(feet[0] - herald[0], feet[2] - herald[2]) <= AT_GATE_M;

/** The recruiters by their office (world/arenaCity.js ARENA_GATE_PEOPLE `role`) and the banner each keeps. */
export const RECRUITER_BANNER = Object.freeze({ redRecruiter: 'red', blueRecruiter: 'blue' });

/**
 * ARENA4b: A BANNER'S RECRUITER ONLINE - systems/arenaHerald.js recruiterChoice's shape over the ACCOUNT's membership (the
 * board's `me.banner`, `left`, `leftSeason`) and the realm's season and standing: join when the account may (free; the
 * other banner a season after quitting it, the one quit at once - server-account/src/arena.js arenaTeam's own law, said
 * here so the choice never offers what the service will refuse), quit (asked again - `quitAsk`), the window, leave; a
 * guest offered no banner, a line saying why; the realm's roll not yet in, a line and no join. Pure.
 * @param {{ banner: 'red'|'blue', board: any, guest?: boolean, window?: boolean }} o
 */
export function recruiterChoiceOnline({ banner, board, guest = false, window = true }) {
  const R = ARENA_TEXT.recruiter, T = ARENA_TEXT.teams, O = ARENA_TEXT.online;
  const other = banner === 'red' ? 'blue' : 'red';
  const lines = [...R.greet[banner], ''];
  let why = null;
  if (!board) { lines.push(O.rollWait); why = 'wait'; }
  else {
    const me = board.me ?? {}, st = board.team?.standings ?? { red: 0, blue: 0 };
    lines.push(`${O.seasonLine(board.season, board.day)}.`);
    lines.push(T.standing(st.red ?? 0, st.blue ?? 0));
    if (me.banner === banner) {
      why = 'already';
      lines.push(R.yours(T.the[banner]), T.given(me.points ?? 0));
      if (board.team?.laurel === banner) lines.push(T.laurelYou);
    } else if (me.banner) { why = 'other'; lines.push(R.theirs(T.the[me.banner])); }
    else if (me.left && me.left !== banner && Number(me.leftSeason) >= board.season) { why = 'season'; lines.push(R.wait(T.the[other])); }
    else if (guest) { why = 'guest'; lines.push(O.guestBanner); }
    else { lines.push(R.pitch, R.rule); }
  }
  const options = [];
  if (!why) options.push({ code: 'KeyJ', label: R.join(T.the[banner]), act: 'join' });
  if (why === 'already') options.push({ code: 'KeyQ', label: R.quit(T.the[banner]), act: 'quit' });
  if (window) options.push({ code: 'KeyA', label: R.window, act: 'window' });
  options.push({ code: 'KeyL', label: R.leave, act: 'leave' });
  options.push({ code: 'Escape', label: null, act: 'leave' });
  return { lines, options };
}

/**
 * @param {{
 *   playerEntity: any, gameMinutes: () => number, showOverlay: (w: any) => void, say?: (line: string) => void,
 *   openWindow?: ((page?: string) => any) | null, liveHour?: () => (number|null), begun?: () => boolean,
 *   heraldAct?: (a: string) => void, atGate?: () => boolean, onSand?: () => ({ a: string, b: string } | null),
 *   online?: () => any,
 * }} deps `openWindow` a door to the Arena window in place of the gate's own (ui/arenaDoor.js - null: none opens);
 *   `heraldAct` the Herald's own doors (watch, fight - the window's presses), `atGate` whether the player stands at the
 *   gate (systems/arenaGate.js nearArenaGate), `onSand` the names on the city's sand now;
 *   `liveHour` the hour whose exhibition stands on a floor here (its wager waits for its verdict), `begun` whether that
 *   bout's fight has begun (the book shuts at the word); ARENA4: `online` the arena online (scenes/arenaOnline.js) or
 *   null - while it is live the window reads the realm's boards and the hall, its challenge and its stands are pressed
 *   here, and a banner joined or quit at a recruiter is the account's too
 */
export function createArenaGate(deps) {
  const P = deps.playerEntity;
  /** The window's door: the host's own, or the gate's (ui/arenaDoor.js, shown in the host's slot). */
  const openWindow = deps.openWindow === undefined ? (page) => { const ov = windowOverlay(page); if (ov) deps.showOverlay(ov); return !!ov; } : deps.openWindow;
  const gm = () => Math.floor(Number(deps.gameMinutes()) || 0);
  const say = (line) => deps.say?.(line);
  /** The league on today's season, written back so the save carries the roll. */
  const league = () => (P.arenaLeague = rollLeague(P.arenaLeague, gm()));
  const choice = (ch, act) => deps.showOverlay(new ChoiceWindow({ lines: ch.lines, options: ch.options.map((o) => ({ code: o.code, label: o.label ?? undefined, action: () => act(o.act, o) })) }));
  const liveHour = () => deps.liveHour?.() ?? null;
  /** ARENA4: the arena online while it is live, else null. */
  const online = () => { const o = deps.online?.() ?? null; return o?.live?.() ? o : null; };
  const begun = () => !!deps.begun?.();
  /** The book written back into the league. */
  const setBook = (book) => { P.arenaLeague = { ...league(), book }; };

  /** A RECRUITER's choice (`role` 'redRecruiter' | 'blueRecruiter'). True: it is up. ARENA4b: online the account's. */
  function recruiter(role) {
    const banner = RECRUITER_BANNER[role];
    if (!banner) return false;
    const on = online();
    if (on) return recruiterOnline(on, banner);
    const name = ARENA_TEXT.teams.the[banner];
    const ch = recruiterChoice({ banner, league: league(), gameMinutes: gm(), window: typeof openWindow === 'function' });
    choice(ch, (a) => {
      if (a === 'join') {
        const r = joinBanner(league(), banner, gm());
        P.arenaLeague = r.league;
        if (r.ok) { say(ARENA_TEXT.recruiter.joined(name)); openWindow?.('team'); }
      } else if (a === 'quit') {
        choice(quitAsk(banner), (b) => {
          if (b !== 'quit') return;
          const r = quitBanner(league(), gm());
          P.arenaLeague = r.league;
          if (r.ok) say(ARENA_TEXT.recruiter.quitDone(name));
        });
      } else if (a === 'window') openWindow?.('team');
    });
    return true;
  }
  /** ARENA4b: A RECRUITER ONLINE - the account's banner joined or quit at the service (scenes/arenaOnline.js team: its
   *  refusal said in its own words), the save's league untouched; the welcome said and the Team page opened once the
   *  service took it. The realm's roll asked when it is not yet in. */
  function recruiterOnline(on, banner) {
    const name = ARENA_TEXT.teams.the[banner];
    const board = on.board?.() ?? null;
    if (!board) on.climb?.();   // the roll asked now - the next word reads it
    const ch = recruiterChoiceOnline({ banner, board, guest: !!on.guest?.(), window: typeof openWindow === 'function' });
    choice(ch, (a) => {
      if (a === 'join') void Promise.resolve(on.team(banner)).then((r) => { if (r?.ok) { say(ARENA_TEXT.recruiter.joined(name)); openWindow?.('team'); } });
      else if (a === 'quit') {
        choice(quitAsk(banner), (b) => {
          if (b !== 'quit') return;
          void Promise.resolve(on.team(null)).then((r) => { if (r?.ok) say(ARENA_TEXT.recruiter.quitDone(name)); });
        });
      } else if (a === 'window') openWindow?.('team');
    });
    return true;
  }

  // ── THE HERALD AND THE KEEPER (ARENA4b) ─────────────────────────────────────────────────────────────────
  /** THE HERALD'S CHOICE (systems/arenaHerald.js) for both hosts' Herald (scenes/world.js, scenes/exterior.js
   *  arenaHerald): offline the save's ladder and league; online the account's climb (`climb` - Fight offers its next bout,
   *  "the ladder done" is its) and its banner under the realm's laurel - and while the climb is not yet known, no Fight
   *  and his line says the realm's records are on their way. `cityBout` the names on the city's sand now; `healthShare`
   *  and `league` the host's (the player's share of health, the save's league - read offline only). */
  function heraldChoice({ cityBout = null, healthShare = (P.health ?? 0) / Math.max(1, P.maxHealth ?? 1), league = P.arenaLeague } = {}) {
    const on = online();
    if (!on) return heraldChoiceOf({ gameMinutes: gm(), cityBout, ladder: arenaLadderRestore(P.arenaLadder), healthShare, league, replays: arenaReplaysRestore(P.arenaReplays).length });   // ARENA5: the last bout kept, offered again
    const climb = on.climb?.() ?? null;
    const ch = heraldChoiceOf({ gameMinutes: gm(), cityBout, ladder: climb, healthShare, league: null });
    if (!climb) {
      const H = ARENA_TEXT.herald;
      const next = ch.next ? H.ladderNext(ch.next.tierName, ch.next.label) : null;
      ch.lines = ch.lines.map((l) => (l === next ? ARENA_TEXT.online.climbWait : l)).filter((l) => l !== H.noFight);
      ch.options = ch.options.filter((o) => o.act !== 'fight');
      ch.next = null;
    }
    const me = on.board?.()?.me;
    if (me?.banner === 'red' || me?.banner === 'blue') ch.lines.push(on.board().team?.laurel === me.banner ? ARENA_TEXT.teams.laurelYou : ARENA_TEXT.teams.under(ARENA_TEXT.teams.the[me.banner]));
    return ch;
  }
  /** THE KEEPER OF THE HALL online (scenes/worldModes.js, the undercroft's Keeper): the realm's wall (systems/arenaBoard.js
   *  hallLinesOnline) - the board the window last fetched, or asked and read when it comes. False offline: the host reads
   *  this save's wall (systems/arenaLadder.js hallOfChampions). */
  function hall() {
    const on = online();
    if (!on) return false;
    const show = (b) => deps.showOverlay(new ActionTextBox(b ? hallLinesOnline(b, P.name ?? '') : [ARENA_TEXT.undercroft.hallTitle, '', ARENA_TEXT.online.rollWait]));
    const b = on.board?.() ?? null;
    if (b) show(b);
    else void Promise.resolve(on.fetchBoard?.() ?? null).then(show, () => show(null));
    return true;
  }
  /** ARENA5: THE HALL'S PLAQUES (world/arenaPlaques.js, both hosts' `arenaHallPlaques` - scenes/worldModes.js hangs the
   *  wall): offline this save's Grand Champions, online the realm's (the board the window last fetched; asked when it is
   *  not in, and until it comes the wall stands bare - never the save's names as the realm's). systems/arenaBoard.js
   *  hallPlaques' `[{ name, banner, season }]`. */
  function plaques() {
    const on = online();
    if (!on) return hallPlaques({ ladder: P.arenaLadder, league: P.arenaLeague, gameMinutes: gm(), name: P.name ?? '', max: PLAQUE_MAX });
    const b = on.board?.() ?? null;
    if (!b) on.refresh?.();
    return b ? hallPlaques({ board: b, max: PLAQUE_MAX }) : [];
  }
  /** WHETHER A BANNER IS WORN - the pause window's Arena door (both hosts' `arenaJoined`): offline the save's league;
   *  online the account's banner (the board's `me.banner` - the board asked when it is not yet in). */
  function joined() {
    const on = online();
    if (!on) return !!rollLeague(P.arenaLeague, gm()).team;
    const b = on.board?.() ?? null;
    if (!b) on.refresh?.();
    return !!b?.me?.banner;
  }

  // ── THE BOOKMAKER ───────────────────────────────────────────────────────────────────────────────────────
  const B = ARENA_TEXT.book;
  /** Every wager that can be settled now, settled (systems/arenaBook.js settleBook) - its winnings owed at the stall. */
  function settle() {
    const on = online();
    if (!on?.exhibitions?.()) { setBook(settleBook(league().book, gm(), { liveHour: liveHour() }).book); return; }
    // ARENA4b: ONLINE THE RELAY'S VERDICT SETTLES (Arena.md 2: the relay runs the exhibition, every client sees one bout).
    // A wager whose bout this screen saw to its verdict is settled by it (verdictSeen - the mirror's, the relay's); one
    // whose hour is out and whose verdict was not seen here is settled by the relay's, asked of its room
    // (scenes/arenaOnline.js exhibitionVerdict) - the house's seeded record only for an hour the relay ran no bout in (or
    // has long let go); an hour still unanswered waits. Never the house's by the clock alone: -Infinity is "no hour is
    // out" to settleBook, which then settles the verdicts kept and nothing else.
    let book = league().book;
    const g = gm(), here = liveHour();
    for (const w of bookRestore(book).wagers) {
      if (w.status !== 'open' || w.hour === here || g < (w.hour + 1) * 60 || bookRestore(book).seen.some((x) => x.hour === w.hour)) continue;
      const v = on.exhibitionVerdict(w.hour, g);
      if (v?.house) { const ex = exhibitionFor(w.hour * 60); book = bookVerdict(book, w.hour, ex ? houseOutcome(ex) : null); }
      else if (v) book = bookVerdict(book, w.hour, v.side);
    }
    setBook(settleBook(book, -Infinity).book);
  }
  /** THE VERDICT SEEN of the exhibition of `hour` (the driver's - scenes/arenaBouts.js `exhibitionVerdict`): a wager on it
   *  is settled by what was seen. */
  function verdictSeen(hour, side) {
    setBook(bookVerdict(league().book, hour, side));
    settle();
  }
  /** PLACE a wager of `stake` on fighter `side` of the exhibition of `hour`: `{ ok, text }` - the gold taken from the
   *  purse (coins, then letters - DFU's own payment law, systems/court.js deductGold). */
  function wager(hour, side, stake) {
    const ex = exhibitionFor(gm());
    if (!ex || ex.hour !== hour) return { ok: false, text: B.whyRefused.closed };
    const r = placeWager(league().book, ex, side, stake, { gold: totalGoldAmount(P), begun: begun(), gameMinutes: gm() });
    if (!r.ok) return { ok: false, text: B.whyRefused[r.reason ?? 'closed'] };
    deductGold(P, r.cost);
    setBook(r.book);
    const name = fighterIdentity(ex.seed, side, ex.opponents[side].mobile).name;
    return { ok: true, text: B.taken(r.cost, name, oddsText(priceFor(exhibitionOdds(ex)[side]))) };
  }
  /** THE BOOKMAKER'S CHOICE: collect, back a fighter (then the stake), the window, leave. True: it is up. */
  function bookmaker() {
    settle();
    const ch = bookmakerChoice({ league: league(), gameMinutes: gm(), gold: totalGoldAmount(P), begun: begun(), window: typeof openWindow === 'function' });
    choice(ch, (a) => {
      if (a === 'collect') {
        const r = collectWinnings(league().book);
        setBook(r.book);
        if (r.gold > 0) { addGold(P, r.gold); say(B.paid(r.gold)); }
      } else if (a === 'back0' || a === 'back1') {
        const ex = ch.exhibition;
        if (!ex) return;
        const side = a === 'back1' ? 1 : 0;
        const name = fighterIdentity(ex.seed, side, ex.opponents[side].mobile).name;
        const price = oddsText(priceFor(exhibitionOdds(ex)[side]));
        choice(stakeChoice({ name, price, gold: totalGoldAmount(P) }), (b, o) => {
          if (b !== 'stake') return;
          const r = wager(ex.hour, side, o.stake);
          say(r.text);
        });
      } else if (a === 'window') openWindow?.('bouts');
    });
    return true;
  }

  // ── THE ARENA WINDOW ────────────────────────────────────────────────────────────────────────────────────
  /** THE WINDOW'S MODEL now (systems/arenaBoard.js): the save's ladder and league (the book settled first), the clock,
   *  the gate's state. */
  function board() {
    settle();
    return arenaBoard({
      ladder: P.arenaLadder, league: league(), gameMinutes: gm(), name: P.name ?? '', atGate: !!deps.atGate?.(), onSand: deps.onSand?.() ?? null,
      healthShare: (P.health ?? 0) / Math.max(1, P.maxHealth ?? 1), gold: totalGoldAmount(P), liveHour: liveHour(), begun: begun(),
      online: online()?.model() ?? null,   // ARENA4: the realm's boards and the hall, while online
      replays: P.arenaReplays ?? [],   // ARENA5: the Records page's Watch the replay
    });
  }
  /** A PRESS IN THE WINDOW: Watch and Fight are the Herald's (the window goes, the floor's instance comes); Wager is the
   *  book's. Each refused at the host too - a press the model allowed a frame ago may not stand now. */
  function windowAct(kind, data = {}) {
    const atGate = !!deps.atGate?.();
    if (kind === 'wager') {
      if (!atGate) return { ok: false, text: ARENA_TEXT.window.whyGate };
      return wager(data.hour, data.side === 1 ? 1 : 0, Math.floor(Number(data.stake) || 0));
    }
    // ARENA4: the challenge and the stands - pressed anywhere the window stands (a match called sends me to the sand)
    if (kind === 'queue' || kind === 'casual' || kind === 'unqueue' || kind === 'accept' || kind === 'decline' || kind === 'spectate') return online()?.act(kind, data) ?? { ok: false, text: ARENA_TEXT.online.whyOffline };
    // ARENA5: a bout the records keep, watched again - at the gate, as Watch is; offline (the save's records)
    if (kind === 'replay') {
      if (online()) return { ok: false, text: ARENA_TEXT.replay.offline };
      if (!atGate) return { ok: false, text: ARENA_TEXT.window.whyGate };
      const i = Math.floor(Number(data.i) || 0);
      if (!arenaReplaysRestore(P.arenaReplays)[i]) return { ok: false, text: ARENA_TEXT.replay.gone };
      closeArenaDoor();
      deps.heraldAct?.(`replay:${i}`);
      return { ok: true, text: '' };
    }
    if (kind === 'watch' || kind === 'fight') {
      if (!atGate) return { ok: false, text: ARENA_TEXT.window.whyGate };
      const on = online();
      const onLadder = on ? on.climb?.() ?? null : P.arenaLadder;   // ARENA4: online the climb is the account's
      if (kind === 'fight' && on && !onLadder) return { ok: false, text: ARENA_TEXT.online.climbWait };   // ARENA4b: and waited for
      if (kind === 'fight' && !nextLadderBout(onLadder)) return { ok: false, text: ARENA_TEXT.herald.ladderDone };
      if (kind === 'fight' && (P.health ?? 0) / Math.max(1, P.maxHealth ?? 1) < FIGHT_HEALTH_MIN) return { ok: false, text: ARENA_TEXT.window.whyHurt };
      closeArenaDoor();
      deps.heraldAct?.(kind);
      return { ok: true, text: '' };
    }
    return { ok: false, text: '' };
  }
  /** THE ARENA WINDOW as an overlay for a host's slot (not shown - the host shows it where it holds overlays), on `page`. */
  function windowOverlay(page = 'bouts') {
    return createArenaOverlay({ page, board: () => board(), act: (k, d) => windowAct(k, d) });
  }

  return { recruiter, bookmaker, wager, settle, verdictSeen, board, windowAct, windowOverlay, heraldChoice, hall, joined, openWindow: (page) => openWindow?.(page) ?? false,
    plaques,   // ARENA5: the Hall of Champions' plaques
  };
}
