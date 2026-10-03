// @ts-check
// ARENA4 (2026-10-02, Mac: "Players can choose to watch AI fights, player fights, join a team (red and blue) and climb
// esclating tiers of opponents, or choose to matchmake for a real opponent to take on in real time"; "Joining a team
// comes with it's own enhanced UI where you can view your ranking and even player leaderboards"): THE ARENA ONLINE ON
// THIS SCREEN - one home for the hosts that stand the colosseum (scenes/world.js), between the relay's rooms, the
// account service and the bout driver. Design: bible/11-Multiplayer/Arena.md "7. Online".
//
//   THE HALL      a socket of its own (`arena:hall`, a presence-less session the host makes), opened while the Arena
//                 window is up or a match is sought: the queue, the offer (Accept / Decline), the bout it sends me to,
//                 the bouts on the sand to watch (net/arenaLink.js foldHall).
//   THE BOUT      the floor's instance as the relay's room `arena:b<id>` (the presence session's own room there): my
//                 `in` once I stand on the sand or in the stands, its words handed to the bout driver
//                 (scenes/arenaBouts.js startRelay / relayWord), my blows' claims out, my yield out.
//   THE RECORDS   the board (`/v1/arena/board`, kept a while and asked again after a bout), the receipts carried to the
//                 service (net/arenaClaims.js), the banners joined or quit at the recruiters.
//   THE EXHIBITION (ARENA4b - Arena.md 2: "the relay runs it, every client sees one bout") the hour's bout is the relay's
//                 room `arena:x<hour>`: on the city's sand a spectator socket of its own (the hall's kind - `watchCity`),
//                 its words standing the relay's bout as the city's exhibition; from the Herald's Watch or the window's
//                 Bouts page the floor's instance as that room (`watchExhibition`); and its verdict, heard or asked of the
//                 room, is the bookmaker's (`exhibitionVerdict`).
//
// Nothing here decides a bout: the relay referees, the account service keeps. Offline (no session, a relay before the
// arena's rooms) `live()` is false and every host keeps ARENA3's offline arena.
//
// ARENA4b: THE ACCOUNT IS THE LAW ONLINE. The climb Fight offers is the account's and waits for it (`climb()` null
// until the board is in - asked then - and while a ladder win of mine is still with the service, CLIMB_WAIT_MS at most);
// a ladder win's purse is held (`owe`) until the service keeps that win - paid then, never for a win it refuses (out of
// the climb's order: its own words said); the climb the service answers a claim with is the board's at once. The realm's
// banners (`realm()` - my account's banner, the laurel its last season gave) are the bout driver's while online, for a
// relay's sand and for an exhibition on this screen's floor alike; a bout watched carries each fighter's banner as the
// hall billed it; a cheer or a boo from the stands goes down the bout's room (`send.cheer` - the relay fans it as `cr`).
//
// Not a DFU member. Ledger A (ARENA).
import { foldHall, HALL_EMPTY, verdictOfWord } from '../net/arenaLink.js';
import { arenaBoutRoom, ARENA_HALL, ARENA_NO_TEXT, ARENA_HIT, arenaLadderOf, arenaExhibitionRoom, bannerClaim, ARENA_EX_BANNERS } from '../net/arenaLaw.js';
import { exhibitionFor, exhibitionBoutId, EXHIBITION_KEPT_HOURS } from '../net/arenaExhibition.js';   // ARENA4b: the hour's exhibition, the relay's
import { arenaBoutSeed } from '../net/arenaBrain.js';
import { createArenaClaims, arenaClaimVerdict } from '../net/arenaClaims.js';
import { ARENA_TEXT } from '../systems/arenaText.js';
import { nextLadderBout } from '../systems/arenaLadder.js';
import { accountRefusalText } from '../net/accountClient.js';
import { readArenaReceipt } from '../net/arenaReceipt.js';   // ARENA4b: whose bout a claim's answer was, for its held purse

/** The board is asked again when the window is up and it is this old, ms. */
export const BOARD_STALE_MS = 20_000;
/** The hall's socket is kept this long after the window went and nothing is sought, ms. */
export const HALL_IDLE_MS = 60_000;
/** A bout this screen set out for and never stood in the room of is let go after this, ms. */
export const BOUT_ARRIVE_MS = 60_000;
/** The bouts to watch are asked again this often while the window is up, ms. */
export const LIVE_ASK_MS = 8000;
/** ARENA4b: a ladder win of mine still with the account service holds the next Fight back at most this long, ms - its
 *  answer moves the climb (the service's own `ladder`); past it the board's climb stands as it is. */
export const CLIMB_WAIT_MS = 15_000;
/** ARENA4b: a held purse no answer came for is let go after this, ms (the receipt is still carried - unpaid). */
export const OWED_KEEP_MS = 10 * 60_000;
/** ARENA4b: an exhibition's socket (the city's sand's, or a verdict asked) that has heard nothing in this long is let go,
 *  and asked again no sooner than EX_RETRY_MS after, ms. */
export const EX_WAIT_MS = 20_000;
export const EX_RETRY_MS = 30_000;

/** A fresh bout id, 16 hex - a ladder bout this screen opens. */
export function newBoutId(rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  return [...rand(8)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
/** A blow's kind on the wire, from the dungeon's kind of hit ('melee', 'arrow', 'spell'). */
export const hitKindOf = (kind) => (kind === 'arrow' ? ARENA_HIT.Shaft : kind === 'spell' ? ARENA_HIT.Spell : ARENA_HIT.Melee);

/**
 * @param {{
 *   now?: () => number, session: () => any, makeHall: () => any, account: any, store?: any, bouts: any,
 *   enterFloor: (kind: string, o: string, side?: number) => Promise<boolean>|boolean, closeWindow?: () => void,
 *   say?: (line: string) => void, notice?: (lines: string[]) => void, names?: (seed: number) => (i: number, mobile: number) => any,
 *   level?: () => number, guest?: () => boolean, struck?: (d: number) => void, myHealth?: (hp: number, max: number) => void,
 *   inBout?: () => boolean, character?: () => (string|null), characterName?: () => (string|null), onRenown?: (data: any) => void,
 *   verdictHeard?: () => void,
 * }} deps
 */
export function createArenaOnline(deps) {
  const now = deps.now ?? (() => performance.now());
  const say = (l) => deps.say?.(l);
  const O = ARENA_TEXT.online;
  let hallLink = null;
  /** @type {any} */
  let hall = { ...HALL_EMPTY };
  let hallWantedAt = -Infinity;
  let liveAskedAt = -Infinity;
  let board = null, boardAt = -Infinity, boardAsking = false, boardAgain = false;
  /** The bout this screen is going to or stands in: `{ o, room, kind: 'pvp'|'pve'|'watch', side, tier, bout, next, sent }`
   *  (ARENA4b: `room` the bout's room - `arena:b<o>`, or an exhibition's `arena:x<hour>` with its `ex`). */
  let bout = null;
  /** ARENA4b: the city's sand's spectator socket - `{ hour, o, room, link, sent, heard, started, at }` - or null. */
  let city = null, cityRetryAt = -Infinity;
  /** ARENA4b: a verdict asked of an exhibition's room for the book - `{ hour, room, link, sent, at }` - or null. */
  let asking = null;
  const askedAt = new Map();
  /** ARENA4b: the exhibitions this screen has heard the end of: hour -> `{ side }` (the relay's verdict) or `{ none: true }`
   *  (its room had no bout - nobody watched it while it might begin, or it is long forgotten). */
  const exSeen = new Map();
  /** ARENA4b: LADDER PURSES HELD for the service's word, by bout id: `{ gold, pay, won, at }` - `gold`/`pay` the verdict's
   *  (scenes/arenaBouts.js relayVerdict `owe`), `won` the service's answer (true kept, false refused), paid once both are in. */
  const owed = new Map();
  const claims = createArenaClaims({
    claim: async (r, c, n) => { const a = await deps.account.claim(r, c, n); answered(r, a); return a; }, store: deps.store ?? null, me: () => deps.account.me?.() ?? null,
    onCounted: (d) => { counted(d); askBoard(true); },
    onGuest: () => say(O.guest),
    // ARENA4b: the fighter a receipt is kept with (its bout's Renown is that character's), and the Renown an answer pays
    character: () => deps.character?.() ?? null, name: () => deps.characterName?.() ?? null, onRenown: (d) => deps.onRenown?.(d),
  });
  /** ARENA4b: the realm's banners while online, for the bout driver (scenes/arenaBouts.js setRealm): my account's banner
   *  and the laurel the realm's last season gave - null offline, where the save's league is the law. */
  const realm = () => (live() ? { banner: board?.me?.banner ?? null, laurel: board?.team?.laurel ?? null } : null);
  deps.bouts?.setRealm?.(realm);

  /** Is the arena online here: a session open on a relay that opens its rooms. */
  const live = () => { const s = deps.session?.(); return !!s && s.status === 'open' && !!s.arenaOk; };

  // ── THE HALL ──
  function wantHall() {
    hallWantedAt = now();
    if (hallLink || !live()) return hallLink;
    hallLink = deps.makeHall?.() ?? null;
    if (!hallLink) return null;
    hallLink.onArena = (w) => hallWord(w);
    hallLink.join?.(ARENA_HALL);
    return hallLink;
  }
  function hallWord(w) {
    if (w.k === 'live') w = { ...w, l: w.l.map(billExhibition) };   // ARENA4b: an exhibition named off its hour
    hall = foldHall(hall, w, now(), 0);
    if (w.k === 'qx' && w.m && w.m !== 'left') say(ARENA_NO_TEXT[w.m] ?? w.m);
    if (w.k === 'of') say(O.offerLine(w.vs.n, w.vs.r ?? '?'));
    if (w.k === 'go') goTo({ o: w.o, kind: 'pvp', side: w.side, vs: w.vs, casual: w.u === 1 });   // ARENA4b: a casual bout's call
  }
  const hallSend = (w) => { const l = wantHall(); return !!l && l.sendArena?.(w) === true; };
  function closeHallIfIdle(t) {
    if (!hallLink) return;
    const seeking = hall.queue === 'queued' || hall.queue === 'offer';
    if (!seeking && t - hallWantedAt > HALL_IDLE_MS) { try { hallLink.leave?.(); } catch { /* gone */ } hallLink = null; hall = { ...HALL_EMPTY }; }
  }

  // ── THE BOARD ──
  /** The board asked of the service (`force` - now, else when stale). ARENA4b: a forced ask while one is out is asked
   *  again when it returns (the one out may have left before the write it must show), and `fetchBoard` waits for it. */
  let boardWait = null, boardTriedAt = -Infinity;
  function askBoard(force = false) {
    if (boardAsking) { if (force) boardAgain = true; return boardWait; }
    if (!force && now() - Math.max(boardAt, boardTriedAt) < BOARD_STALE_MS) return null;   // ARENA4b: a failed ask waits too
    boardAsking = true;
    boardTriedAt = now();
    boardWait = Promise.resolve().then(() => deps.account.board()).then((r) => { if (r?.ok && r.data) { board = r.data; boardAt = now(); } }, () => {})
      .finally(() => { boardAsking = false; if (boardAgain) { boardAgain = false; askBoard(true); } })
      .then(() => board);
    return boardWait;
  }
  /** ARENA4b: the board now, or asked and waited for (null when it cannot be had). */
  function fetchBoard() {
    if (board) return Promise.resolve(board);
    if (!live()) return Promise.resolve(null);
    return askBoard(true) ?? Promise.resolve(board);
  }
  /** ARENA4b: A CLAIM ANSWERED (net/arenaClaims.js carries it - this sees each answer): a ladder receipt's held purse paid
   *  when the service kept the win, let go when it refused it or the account cannot keep one (a guest), held while the
   *  answer may still change (offline, a key the service will mend); the climb the service answers with is the board's.
   *  A receipt the service says it kept already (`claimed` - the first answer lost on the way, the claim carried again)
   *  is the account's own bout, kept as the receipt reads: its win pays the purse still held for it. */
  function answered(r, a) {
    const c = readArenaReceipt(r);
    if (!c || c.a !== 'l') return;
    const d = a?.ok ? a.data : null;
    if (d?.ladder && board?.me) board = { ...board, me: { ...board.me, ladder: d.ladder } };
    let won = null;
    if (d?.recorded === true) won = d.won === true;
    else if (d?.why === 'claimed') won = c.r === 1;   // kept before: the receipt's own result (a ladder receipt's r 1 is a win)
    else if (arenaClaimVerdict(a) === 'done' || d?.why === 'guest') won = false;   // out of the climb's order, a guest's, a receipt refused for good
    if (d?.recorded === false && d.why === 'order') say(O.order);
    if (won === null) return;
    const e = owed.get(c.j) ?? { gold: null, pay: null, won: null, at: now() };
    e.won = won;
    owed.set(c.j, e);
    settleOwed(c.j);
  }
  /** ARENA4b: A LADDER WIN'S PURSE, held (relayVerdict's `owe`): paid when the service keeps the win. */
  function owe(o, gold, pay) {
    const e = owed.get(o) ?? { gold: null, pay: null, won: null, at: now() };
    e.gold = gold; e.pay = pay; e.at = now();
    owed.set(o, e);
    settleOwed(o);
  }
  function settleOwed(o) {
    const e = owed.get(o);
    if (!e || e.won === null || e.gold === null) return;
    owed.delete(o);
    if (e.won && e.gold > 0) e.pay?.(e.gold);
  }
  /** ARENA4b: is a ladder win of mine still with the service (its purse held, no answer yet) - the climb not yet moved. */
  const climbPending = () => {
    const t = now();
    let wait = false;
    for (const [o, e] of owed) {
      if (t - e.at > OWED_KEEP_MS) owed.delete(o);
      else if (e.gold !== null && e.won === null && t - e.at < CLIMB_WAIT_MS) wait = true;
    }
    return wait;
  };
  /** ARENA4b: THE ACCOUNT'S CLIMB as Fight reads it, or null until it is known - the board not yet in (asked now), or a
   *  ladder win of mine still with the service. */
  function climb() {
    if (!live()) return null;
    if (!board) { askBoard(true); return null; }
    if (climbPending()) return null;
    return board.me?.ladder ?? arenaLadderOf([]);
  }
  /** What a bout's counting says, once the service kept it. */
  function counted(d) {
    if (d.kind === 'pvp') {
      if (!d.rated) say(O.unrated);
      else say(d.result === 'won' ? O.pvpWon(d.delta, d.rating) : d.result === 'lost' ? O.pvpLost(-d.delta, d.rating) : O.pvpDraw(d.rating));
    } else if (d.kind === 'ladder') {
      if (d.grand) say(O.grand);
      if (d.points > 0 && d.banner) say(O.points(d.points, ARENA_TEXT.teams.the[d.banner]));
    }
  }

  // ── A BOUT ──
  /** To the floor for a bout: the instance entered as the bout's room, the driver standing the relay's bout on it. */
  async function goTo(b) {
    bout = { ...b, room: b.room ?? arenaBoutRoom(b.o), sent: false, seen: false, at: now(), leftAt: null };
    deps.closeWindow?.();
    const me = b.kind === 'watch' ? '' : b.kind === 'pvp' ? `p${b.side ?? 0}` : 'p0';
    if (b.ex) {
      // ARENA4b: THE HOUR'S EXHIBITION FROM THE STANDS - the relay's bout stood as the hour's (scenes/arenaBouts.js
      // startExhibitionRelay), the floor's instance entered as its room (`x<hour>`, world.js arenaFloorRoomOf). Its other
      // sockets of mine let go first - the city's, and a verdict asked of that same room: one id twice in a room is
      // replaced at the relay, and a replaced socket is a seat lost (makeHall's onSuperseded)
      closeCity();
      if (asking?.hour === b.ex.hour) closeAsk();
      deps.bouts.ask({ where: 'floor', relayEx: { o: b.o, ex: b.ex, names: deps.names ? deps.names(b.ex.seed) : undefined } });
      const ok = await deps.enterFloor('watch', `x${b.ex.hour}`, 0);
      if (!ok) { bout = null; deps.bouts.dismiss?.(); }
      return ok;
    }
    // ARENA4b: each fighter's banner as the hall billed it - my rival's (its `go`), a watched bout's two (its live entry)
    const banners = b.kind === 'pvp' ? { [`p${1 - (b.side ?? 0)}`]: b.vs?.b ?? null } : b.kind === 'watch' ? { ...(b.banners ?? {}) } : {};
    deps.bouts.ask({
      where: 'floor', kind: 'relay',
      relay: {
        o: b.o, kind: b.kind === 'pvp' ? 'pvp' : b.kind === 'watch' ? (b.watchKind ?? 'pvp') : 'pve', me, next: b.next ?? null,
        names: deps.names ? deps.names(arenaBoutSeed(b.o)) : undefined,
        send: { hit: (w) => boutSend({ ...w, k: 'hit' }), yield: () => boutSend({ k: 'yd' }), cheer: (c) => boutSend({ k: 'ch', c }) },   // ARENA4b: the stands' shout
        struck: (d) => deps.struck?.(d), myHealth: (hp, max) => deps.myHealth?.(hp, max),
        onEnd: () => { if (b.casual) say(O.casualEnd); askBoard(true); },   // ARENA4b: a casual bout owes no receipt - its end says so
        banners, owe: (gold, pay) => owe(b.o, gold, pay),   // ARENA4b: a ladder win's purse waits on the service's word
      },
    });
    const kind = b.kind === 'watch' ? 'watch' : b.kind === 'pvp' && b.side === 1 ? 'rival' : 'ladder';
    const ok = await deps.enterFloor(kind, b.o, b.side ?? 0);
    if (!ok) { bout = null; deps.bouts.dismiss?.(); }
    return ok;
  }
  /** A word down the bout room's socket (the presence session's own room). */
  function boutSend(w) {
    const s = deps.session?.();
    if (!bout || !s || s.room !== bout.room) return false;
    return s.sendArena?.(w) === true;
  }
  /** A word from the bout's room. */
  function word(w, room) {
    if (!bout || room !== bout.room) return false;
    if (w.k === 'rc') { claims.add(w.r); return true; }
    if (bout.ex) {
      // ARENA4b: the hour's exhibition from the stands - its verdict kept for the book, its refusal said
      heardEx(bout.ex.hour, w);
      if (w.k === 'no') { say(ARENA_NO_TEXT[w.m] ?? w.m); return true; }
      return deps.bouts.exhibitionWord?.(w) ?? false;
    }
    if (w.k === 'no') { say(w.m === 'early' ? ARENA_TEXT.refuse.yieldEarly : ARENA_NO_TEXT[w.m] ?? w.m); return true; }
    if (w.k === 'st' && bout.kind === 'watch' && !bout.watchKind) bout.watchKind = w.kind;
    return deps.bouts.relayWord?.(w) ?? false;
  }
  /** A blow of mine on one of the relay's fighters (the dungeon's own lane, `onFoeHit` for its puppet - scenes/arenaBouts.js
   *  ARENA_PUPPET_OWNER), or on my opponent's body (`i` its fighter id): the claim out to the referee. */
  function hit({ i, d, kind = 'melee', w = -1, m = 0, q = null }) {
    if (bout?.kind === 'watch') return false;   // ARENA4b: the stands strike nobody - the relay would junk the word
    return boutSend({ k: 'hit', i, d: Math.max(0, Math.round(Number(d) || 0)), r: hitKindOf(kind), ...(Number.isInteger(w) && w >= -1 ? { w } : {}), ...(Number.isInteger(m) && m >= 0 && m <= 15 ? { m } : {}), ...(Number.isInteger(q) ? { q } : {}) });
  }

  // ── ARENA4b: THE HOUR'S EXHIBITION, THE RELAY'S ──
  /** Does the relay run the hour's exhibition here: the arena online, on a relay that opens its rooms - the exhibition's
   *  room came in the relay version that opened the bouts' (world155, net/wire.js relaySupportsArena), so the one gate
   *  serves both, and an older relay (or none) leaves every host its own seeded exhibition. */
  const exhibitions = () => live();
  /** The bout the floor's instance watches the hour's exhibition by (goTo): its id, its room, the hour's exhibition. */
  const exhibitionBout = (ex) => ({ o: exhibitionBoutId(ex.hour), room: arenaExhibitionRoom(ex.hour), kind: 'watch', watchKind: 'ex', ex });
  /** An exhibition on the hall's list, named as every screen names it - off its hour (the relay knows no names): the
   *  Red's fighter against the Blue's, each under the banner the relay bills its side by (ARENA_EX_BANNERS before it).
   *  Any other entry as it came. */
  function billExhibition(e) {
    if (e?.kind !== 'ex') return e;
    const ex = exhibitionFor(e.h * 60);
    const nm = ex && deps.names ? deps.names(ex.seed) : null;
    const bill = (i, side) => ({ n: (ex && nm ? nm(i, ex.opponents[i].mobile)?.name : null) || ARENA_TEXT.window.fighter, b: side?.b ?? ARENA_EX_BANNERS[i] });
    return { ...e, a: bill(0, e.a), b: bill(1, e.b) };
  }
  /** ARENA4b: MY BANNER as my queue and ladder words claim it - the account's (the board's `me`), none before the board
   *  is heard: a pennant on my bill for my rival and the stands, cosmetic (net/arenaLaw.js bannerClaim). */
  const myBanner = () => { const b = bannerClaim(board?.me?.banner); return b ? { b } : {}; };
  /** What an exhibition's word says of its end, kept for the book: the relay's verdict, or that its room had no bout. */
  function heardEx(hour, w) {
    if (w?.k === 'no' && w.m === 'no bout') { if (!exSeen.has(hour)) exSeen.set(hour, { none: true }); return; }
    const v = verdictOfWord(w);
    if (v) exSeen.set(hour, v);
  }
  /**
   * THE CITY'S EXHIBITION (world.js arenaFrame, while I stand near the colosseum in its hour): a spectator socket of its
   * own (the hall's kind - presence-less) to the hour's room, the relay's bout stood on the city's sand
   * (scenes/arenaBouts.js startExhibitionRelay) - its first watcher opening it inside its window. An hour whose end was
   * heard (or whose room had none) is not stood again. Answers whether the relay's exhibition is this hour's here.
   */
  function watchCity(ex) {
    if (!live() || !ex || exSeen.has(ex.hour)) return false;
    if (city?.hour === ex.hour) return true;
    if (bout || now() < cityRetryAt) return false;
    closeCity();
    const link = deps.makeHall?.() ?? null;
    if (!link) return false;
    const room = arenaExhibitionRoom(ex.hour);
    const C = city = { hour: ex.hour, o: exhibitionBoutId(ex.hour), room, link, sent: false, heard: false, started: false, at: now() };
    link.onArena = (w, r) => { if (city === C && r === room) cityWord(C, w); };
    link.join?.(room);
    deps.bouts.ask({ where: 'city', relayEx: { o: C.o, ex, names: deps.names ? deps.names(ex.seed) : undefined } });
    return true;
  }
  /** A word from the city's exhibition's room: its end kept, a refusal letting the sand go, the rest the bout's. */
  function cityWord(C, w) {
    C.heard = true;
    heardEx(C.hour, w);
    if (w.k === 'no') {
      // no bout (the hour went unwatched while it might begin) is the hour's last word; the stands full, asked again later
      if (w.m !== 'no bout') cityRetryAt = now() + EX_RETRY_MS;
      closeCity();
      if (deps.bouts.relay?.()?.o === C.o) deps.bouts.dismiss?.();
      return;
    }
    deps.bouts.exhibitionWord?.(w);
  }
  function closeCity() {
    if (!city) return;
    try { city.link.leave?.(); } catch { /* gone */ }
    city = null;
  }
  /** THE HERALD'S WATCH ONLINE: the floor's instance as the hour's exhibition's room, the relay's bout from its stands. */
  function watchExhibition(ex) {
    if (!live() || !ex || bout || deps.inBout?.()) return false;
    void goTo(exhibitionBout(ex));
    return true;
  }
  /**
   * THE RELAY'S VERDICT on the exhibition of `hour`, for the book (scenes/arenaGate.js settle): `{ side }` the relay's
   * (0 / 1, null a draw); `{ house: true }` - its room had no bout (nobody watched it while it might begin) or has let it
   * go (EXHIBITION_KEPT_HOURS after - net/arenaLaw.js ARENA_EX_KEEP_MS), the house's own record then; or null - not
   * known yet, and asked of its room (a spectator's `in`, which a finished exhibition answers with its whole bout).
   */
  function exhibitionVerdict(hour, gameMinutes) {
    const k = exSeen.get(hour);
    if (k) return k.none ? { house: true } : { side: k.side };
    if (Number(gameMinutes) >= (hour + EXHIBITION_KEPT_HOURS) * 60) return { house: true };
    askVerdict(hour);
    return null;
  }
  function askVerdict(hour) {
    const t = now();
    if (!live() || asking || city?.hour === hour || bout?.ex?.hour === hour || t - (askedAt.get(hour) ?? -Infinity) < EX_RETRY_MS) return;
    const link = deps.makeHall?.() ?? null;
    if (!link) return;
    askedAt.set(hour, t);
    const room = arenaExhibitionRoom(hour);
    const A = asking = { hour, room, link, sent: false, at: t };
    // its answer settles the book at once (the host's `verdictHeard` - scenes/arenaGate.js settle), not at the next visit
    link.onArena = (w, r) => { if (asking === A && r === room) { heardEx(hour, w); if (exSeen.has(hour) || w.k === 'no') closeAsk(); if (exSeen.has(hour)) deps.verdictHeard?.(); } };
    link.join?.(room);
  }
  function closeAsk() {
    if (!asking) return;
    try { asking.link.leave?.(); } catch { /* gone */ }
    asking = null;
  }
  /** The exhibitions' sockets, a frame: each says its `in` once it stands in its room; the city's goes with the bout it
   *  stood (walked off, or the instance taken), and either goes when it has heard nothing in EX_WAIT_MS. */
  function exTick(t) {
    if (city) {
      const r = deps.bouts.relay?.();
      if (r?.o === city.o) city.started = true;
      else if (city.started) closeCity();
    }
    for (const L of [city, asking]) {
      if (!L) continue;
      const l = L.link;
      if (l.status === 'open' && l.room === L.room) { if (!L.sent) L.sent = l.sendArena?.({ k: 'in', r: 's' }) === true; }
      else L.sent = false;
    }
    if (city && !city.heard && t - city.at > EX_WAIT_MS) {
      const o = city.o;
      closeCity(); cityRetryAt = t + EX_RETRY_MS;
      if (deps.bouts.relay?.()?.o === o) deps.bouts.dismiss?.();
    }
    if (asking && t - asking.at > EX_WAIT_MS) closeAsk();
  }

  /** ONE FRAME: the receipts offered when due, the hall kept or let go, my `in` said once I stand in the bout's room. */
  function tick() {
    const t = now();
    claims.tick();
    closeHallIfIdle(t);
    if (hallLink && t - liveAskedAt >= LIVE_ASK_MS && t - hallWantedAt < 2000) { liveAskedAt = t; hallSend({ k: 'ls' }); }
    const s = deps.session?.();
    if (bout && s) {
      const here = s.room === bout.room && s.status === 'open';
      if (!here) bout.sent = false;
      else if (!bout.sent) {
        // ARENA4b: a ladder bout's `in` names my level (believed only from a token before the signed one, held to the
        // tier's cap) and no health - the relay's vitality is the signed character level's (net/arenaLaw.js ladderVitality)
        const inWord = bout.kind === 'watch' ? { k: 'in', r: 's' }
          : bout.kind === 'pve' ? { k: 'in', r: 'f', tier: bout.tier, bout: bout.bout, lv: Math.max(1, Math.floor(deps.level?.() ?? 1)), ...myBanner() }
            : { k: 'in', r: 'f' };
        bout.sent = s.sendArena?.(inWord) === true;
      }
    }
    exTick(t);   // ARENA4b: the city's exhibition's socket and a verdict asked
    // the bout let go: left (its room no longer mine for a while after I stood in it), or never reached
    if (bout) {
      const here = !!s && s.room === bout.room;
      if (here) { bout.seen = true; bout.leftAt = null; }
      else if (bout.seen && !deps.inBout?.()) { if (bout.leftAt == null) bout.leftAt = t; else if (t - bout.leftAt > 5000) bout = null; }
      else if (!bout.seen && t - bout.at > BOUT_ARRIVE_MS) bout = null;
    }
  }

  // ── THE WINDOW ──
  /** The window's online half (systems/arenaBoard.js arenaBoard's `online`), or null offline. */
  function model() {
    if (!live()) return null;
    wantHall();
    askBoard();
    return { board, hall: { ...hall, status: hallLink?.status === 'open' ? 'open' : 'off' }, guest: !!deps.guest?.(), busy: !!bout || !!deps.inBout?.(), now: now() };
  }
  /** A press in the window that is the arena online's. */
  function act(kind, data = {}) {
    if (!live()) return { ok: false, text: O.whyOffline };
    if (kind === 'queue' || kind === 'casual') {
      if (deps.guest?.()) return { ok: false, text: O.whyGuest };
      if (bout || deps.inBout?.()) return { ok: false, text: O.whyBusy };
      // ARENA4b: Casual bout - the same queue word with `u`, paired only with another casual seeker (net/arenaLaw.js pairQueue)
      const casual = kind === 'casual';
      if (!hallSend({ k: 'q', lv: Math.max(1, Math.floor(deps.level?.() ?? 1)), ...myBanner(), ...(casual ? { u: 1 } : {}) })) return { ok: false, text: O.whyOffline };
      hall = { ...hall, casual };
      return { ok: true, text: O.queueState.queued };   // ARENA4b: my banner billed to my rival
    }
    if (kind === 'unqueue') { hallSend({ k: 'x' }); hall = { ...hall, queue: 'idle', offer: null, casual: false }; return { ok: true, text: O.leaveQueue }; }
    if (kind === 'accept' || kind === 'decline') {
      const o = hall.offer?.o;
      if (!o) return { ok: false, text: ARENA_NO_TEXT.lapsed };
      hallSend({ k: kind === 'accept' ? 'y' : 'n', o });
      if (kind === 'decline') hall = { ...hall, queue: 'idle', offer: null };
      return { ok: true, text: kind === 'accept' ? O.accept : O.decline };
    }
    if (kind === 'spectate') {
      if (bout || deps.inBout?.()) return { ok: false, text: O.whyBusy };
      if (typeof data.o !== 'string') return { ok: false, text: O.boutOver };
      const entry = hall.live.find((x) => x.o === data.o);
      // ARENA4b: the hour's exhibition on the list is watched as the Herald's Watch watches it - its own room
      if (entry?.kind === 'ex') { const ex = exhibitionFor(entry.h * 60); if (!ex) return { ok: false, text: O.boutOver }; void goTo(exhibitionBout(ex)); return { ok: true, text: '' }; }
      void goTo({ o: data.o, kind: 'watch', watchKind: entry?.kind ?? null, banners: { p0: entry?.a?.b ?? null, p1: entry?.b?.b ?? null } });
      return { ok: true, text: '' };
    }
    return { ok: false, text: '' };
  }
  /** THE LADDER ONLINE: the account's climb (the board's `me`), its next bout fought on the relay. Answers `{ ok, text }`.
   *  ARENA4b: refused with a line until the account's climb is known (`climb`) - never an empty climb's Pit. */
  function fightLadder() {
    if (!live()) return { ok: false, text: O.whyOffline };
    if (bout || deps.inBout?.()) return { ok: false, text: O.whyBusy };
    const L = climb();
    if (!L) return { ok: false, text: O.climbWait };
    const next = nextLadderBout(L);
    if (!next) return { ok: false, text: ARENA_TEXT.herald.ladderDone };
    void goTo({ o: newBoutId(), kind: 'pve', tier: next.tier, bout: next.bout, next });
    return { ok: true, text: '' };
  }
  /** A banner joined (`'red'`/`'blue'`) or quit (null) on the account: the service's word said when it refuses. ARENA4b:
   *  a guest is told here (a banner takes a registered fighter); a join or quit the service took is the board's at once
   *  (the window opened on its Team page shows it), the board asked again for the rest. */
  async function team(banner) {
    if (!live()) return null;
    if (deps.guest?.()) { say(O.guestBanner); return { ok: false, error: 'guest' }; }
    const r = await deps.account.team(banner).catch(() => null);
    if (r && !r.ok && r.error && r.error !== 'no-session') say(accountRefusalText(r.error));
    if (r?.ok && board?.me) {
      const was = board.me.banner ?? null, worn = r.data?.banner === undefined ? banner : r.data.banner;
      board = { ...board, me: { ...board.me, banner: worn ?? null, ...(worn === null && was ? { left: was, leftSeason: board.season } : {}) } };
    }
    askBoard(true);
    return r;
  }

  return {
    live, model, act, fightLadder, team, word, hit, tick, claims,
    climb, fetchBoard, realm,   // ARENA4b: the account's climb as Fight reads it, the board waited for, the realm's banners
    /** ARENA4b: the board asked when it is stale (a door that reads it without a press - the pause window's). */
    refresh: () => { if (live()) askBoard(); },
    /** ARENA4b: is this a guest's session (a banner, a counted bout, need a registered account). */
    guest: () => !!deps.guest?.(),
    exhibitions, watchCity, watchExhibition, exhibitionVerdict,   // ARENA4b: the hour's exhibition, the relay's
    /** The account's ladder online (the board's), or null before the board is heard. */
    ladder: () => board?.me?.ladder ?? null,
    board: () => board,
    hall: () => hall,
    /** The bout this screen is in or going to, or null. */
    bout: () => bout,
    /** The bout's fighter id of mine ('' in the stands), for the host's puppet and rival seams. */
    me: () => (bout ? (bout.kind === 'watch' ? '' : bout.kind === 'pvp' ? `p${bout.side ?? 0}` : 'p0') : null),
  };
}
