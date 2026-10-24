// @ts-check
// KG3 (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md sections 3, 5.3, 5.7, 10, 14 and 16; the owner: "Dont come back
// until this is completed in full"): THE KING'S GAMBIT ON THE SEAT - the host's half of the game, its own module so the
// interior host (scenes/worldModes.js, THE FOUR HOSTS: the one with taverns) hands it what it needs and keeps one slot
// for it, as it keeps one for Hold'em and one for Iliac Hand (section 3: each game opens by closing the other two, and
// every road off the seat closes all three).
//
// THE EVENING (section 14.5): the setup - a regular from the table's free chairs (each at the tier the regular's seed
// gives, systems/gambit/gambitPatrons.js tierFor), the stake (the tier's least times one of the mod's three, from the purse) and
// the crown (kept on the character); the army - the mod's roster whole, as the cards' pictures; the battle - the law's
// game (net/kingsGambit.js) at the session's clock (systems/gambit/gambitTableSession.js), the regular playing as the mod's
// innkeeper played; the result after its beat. The panel is ui/gambitTableHud.js, the board on the cloth
// world/gambitCloth.js and render/gambitTableDraw.js.
//
// THE GOLD (5.7): the stake leaves the purse at the deal and the table holds it; a win pays twice it, a loss and a
// forfeit leave it with the regular - every road off the seat while a game is under way is a forfeit (close's
// `concede`); a game that did not stand (the table's source broke) hands it back. A REGULAR'S NIGHT: what a regular has
// paid out tonight, net, is the character's book (`gambitPurses`) - a stake past what is left of it is refused, and a
// regular whose night is spent plays for fun until tomorrow. Online - a realm character or an online page - the regulars
// play for fun (a regular's gold paid on the client is a faucet the realm never sees). A load's road settles nothing: the
// save waits while a stake is down (`staked`), so the save it loaded predates the deal.
//
// THE CLOTH UNDER THE HAND (14.3): a press on the board is a cell (`pointer` - the table point under it, the frame's own
// lens); under a finger it snaps to the nearest of the player's pieces, the lit cells and the ringed foes within
// GAMBIT_SNAP_PX and STAGES - Move here, Strike, Drink, with Cancel - and with a fine pointer it acts at once. The keys
// and the pad walk a cell cursor (`key`): the arrows or the d-pad move it, Enter, Space or the pad's A press its cell,
// Escape or the pad's B cancel - and with nothing to cancel ask the Stand up press, which asks twice while a stake is
// down (a stray Escape forfeited the stake as a step off the seat does).
//
// KG4 (2026-10-14, sections 5.3, 10.1, 10.7, 14.3 and 17): THE BOARD RAISED. The session's events drive the pieces' motion
// (world/gambitMotion.js - the walk, the blow, the fall, the muster) and the draw lays it on the built board; a press
// reads the built board (world/gambitCloth.js gambitPressCell - a standing card's face is its cell, a wall's top is the
// wall's, never the cell behind it), and under a finger a piece snaps by its card's middle, where the finger sees it.
// THE LEAN (10.7): while a battle is on the seat leans over the board - the eye forward and up, pitched down - until the
// whole board lies in the screen the panel leaves clear (`lean`: world/gambitCloth.js gambitLean, fitted, never guessed),
// eased in and out over GAMBIT_LEAN_S (at once under reduced motion); the setup, the army and the result keep the seat's
// own view.
//
// KG4b (sections 5.6 and 17.4): THE SOUNDS - the mod's own clips at its own moments: the game's on the motion's clock
// (world/gambitMotion.js), the table's here - opening the game DiceRoll (OpenChallenge), a stake put down GoldPieces, a
// unit joining, an Auto-fill, a piece chosen and End turn ButtonClick, the result's ArenaFanfareLevelUp with the coins
// 0.6 s after it when gold was down, or the Groan, at the result's own beat (FinishMatch). Every one is played at the
// cloth through `play` - the room's 3D sound - never through the flat one-shot PEERFX1 observes, which reads Hit1..Hit5
// at volume 1 as the player struck and tells the room (section 5.6's trap).
//
// KG5 (2026-10-15, sections 5.8, 10.7 and 18): ANOTHER PLAYER ACROSS THE BOARD. With a relay that runs the game (`online`
// - the friendly table only; the red table's gold is KG6's), the setup offers the board's two seats: sit, build an army,
// say Ready; once both are, the relay deals and the battle is played as against a regular - the same panel, cloth, log
// and motion, through the online session (systems/gambit/gambitRemoteTable.js RemoteGambitSession: the law's check here, the
// command to the relay, the other side's actions shown GAMBIT_REMOTE_GAP_MS apart, the relay's clock on a chip). The
// guest reads the board turned about its middle and the cloth lays it where the host's lies (gambitPlaces `flip`), each
// player's king's row at its own foot. Unseated, a game under way is watched - the host's side as side 0, nothing
// pressed but the regulars and Stand up, no lean. Play a regular instead turns to the regulars (standing up from the
// board); a new welcome asks the table again; every road off the seat stands up from the board, forfeiting a game under
// way (the mod's FORFEIT online).
//
// KG6 (2026-10-15, sections 10.7 and 19): GOLD AT THE RED TABLE, AND THE SEASON. Online at the realm's gold table
// (`online.gold`), the army's panel offers the mod's online stakes - each the purse's to cover and the other player's
// stake's to match - and Ready puts it down: the realm service holds it first (`online.stake`: CARDS6's escrow, the
// record's own act), then the relay spends its order; the pot comes home in the relay's cash-outs, claimed by the
// card tables' stake book. The season board is read from either table (`online.board`).
//
// Not a DFU member: Daggerfall Unity has no such game - the mod does. Ledger A row (THE KING'S GAMBIT).
import { GambitTableSession, gambitNightLeft, gambitPursesAfter, stakeOf, gambitCrownRestore, crownIndex, GAMBIT_CROWNS, GAMBIT_LOG_MAX, GAMBIT_STAKE_MULTS, GAMBIT_RESULT_MS } from '../systems/gambit/gambitTableSession.js';
import { tierFor, GAMBIT_TIERS } from '../systems/gambit/gambitPatrons.js';
import { KG_POINT_BUDGET, KG_COLS, KG_ROWS, KG_KING_CELL, armyRefusal, armyCost, canRecruit, autoFill, rosterUnit, pieceById, pieceAt, reachable, foesInRange } from '../net/kingsGambit.js';
import { gambitHudModel, createGambitTableHud, boardCursorStep, gambitBoardKey } from '../ui/gambitTableHud.js';
import {
  pieceName, unitJoined, unitLeft, unitTooDear, armyFull, refusalWords, logLine, resultGold,
  dealLine, barkInvite, barkEnd, onlineRefusal,
} from '../ui/gambitTableWords.js';
import { RemoteGambitTable, RemoteGambitSession } from '../systems/gambit/gambitRemoteTable.js';
import { GAMBIT_ONLINE_STAKES } from '../net/gambit/gambitStakes.js';
import { stakeShort, stakeDiffers, stakeChoose, stakeRefusal } from '../ui/gambitTableWords.js';
import { gambitPlaces, gambitPressCell, gambitLean, gambitCardHeight, GAMBIT_CARD_FOOT } from '../world/gambitCloth.js';
import { createGambitMotion } from '../world/gambitMotion.js';
import { prefersReducedMotion } from '../systems/hitFlash.js';
import { SOUND } from '../systems/soundClips.js';
import { createGambitTableDraw } from '../render/gambitTableDraw.js';
import { tablePoint } from '../world/card/cardHand.js';
import { BARK_MS } from '../world/card/cardRegulars.js';
import { rayDirFromScreen, projectToScreen } from '../player/tapRay.js';
import { goldAmount, deductGold, addGold } from '../systems/court.js';
import { getPref, setPref } from '../systems/uiPrefs.js';
import { KINGS_GAMBIT_KEY } from '../systems/features.js';
import { noteAct } from '../systems/questlines/qlActs.js';   // QL11: the features' acts, heard by the running quests

/** THE FEATURES SWITCH (10.7): on by default; off, no card table offers the game. */
export const gambitTableOn = () => !!getPref(KINGS_GAMBIT_KEY);
/** A press that costs gold asks twice: the first arms it this long (ui/seatTab.js SEAT_RELINQUISH_ARM_MS's way). */
export const GAMBIT_ARM_MS = 4000;
/** Under a finger a press snaps to the nearest of the player's pieces, the lit cells and the ringed foes within this
 *  many CSS px (14.3 - fifteen columns across a 390 px screen are 26 px a column at best). */
export const GAMBIT_SNAP_PX = 22;
/** KG4: the lean comes in, and goes, over this long (s) - at once under reduced motion. */
export const GAMBIT_LEAN_S = 0.6;
/** KG4 (14.7): on a touch device the touch layer's presses stand at the screen's top - the lean keeps the board under
 *  this many CSS px. */
export const GAMBIT_TOUCH_TOP_PX = 64;
/** AUDIT KG II C5: the least of the world's view a clear screen is worth fitting the board into - below it (More's sheet
 *  over a landscape phone's whole width) the lean keeps the last it fitted. */
export const GAMBIT_CLEAR_MIN = 0.04;

/**
 * THE CLEAR SCREEN (14.7; MEASURE KG4): the part of the world's view the lean fits the board into - the largest of what
 * lies left of the panel, right of it and above it (the desktop's column, the phone's strip, the landscape phone's
 * column), and under the touch layer's presses on a touch device. Shares of the world's view, y down.
 * @param {{left: number, right: number, top: number, bottom: number, width: number, height: number}|null} box the panel's
 * @param {{w: number, h: number, rect?: {x: number, y: number, w: number, h: number}|null}} view the canvas (CSS px) and the
 *   world's strip on it (hudLarge.js worldViewportRect: shares, y from the foot - Unity's)
 * @param {boolean} [touch]
 * AUDIT KG II C5: null when no part left clear is worth fitting into (under GAMBIT_CLEAR_MIN of the view).
 */
export function gambitClear(box, { w, h, rect = null }, touch = false) {
  const R = rect ?? { x: 0, y: 0, w: 1, h: 1 };
  const fx = (/** @type {number} */ px) => Math.max(0, Math.min(1, (px / w - R.x) / R.w));
  const fy = (/** @type {number} */ py) => Math.max(0, Math.min(1, (py / h - (1 - R.y - R.h)) / R.h));
  const y0 = touch ? Math.min(0.3, fy(GAMBIT_TOUCH_TOP_PX)) : 0;
  if (!box || !(box.width > 0) || !(box.height > 0)) return { x0: 0, x1: 1, y0, y1: 1 };
  const area = (/** @type {any} */ c) => Math.max(0, c.x1 - c.x0) * R.w * w * Math.max(0, c.y1 - c.y0) * R.h * h;
  const options = [
    { x0: 0, x1: fx(box.left), y0, y1: 1 },
    { x0: fx(box.right), x1: 1, y0, y1: 1 },
    { x0: 0, x1: 1, y0, y1: fy(box.top) },
  ];
  const best = options.reduce((a, b) => (area(b) > area(a) ? b : a));
  return area(best) >= GAMBIT_CLEAR_MIN * R.w * w * R.h * h ? best : null;
}

/** A REGULAR'S CROWN (10.4): the regular's seed's - the four in the deck's suit order, by the seed mod 4 - and the next
 *  round that order when it is the player's. @param {number} seed @param {string} mine the player's crown key */
export function regularCrown(seed, mine) {
  const i = (seed >>> 0) % GAMBIT_CROWNS.length;
  return GAMBIT_CROWNS[GAMBIT_CROWNS[i] === mine ? (i + 1) % GAMBIT_CROWNS.length : i];
}
/** THE REGULARS AT THIS TABLE (14.5): each free chair's regular at the tier their seed gives, in tier order, then by
 *  chair. @param {{name: string, seed: number, chair: number}[]} regulars */
export const gambitRegulars = (regulars) => regulars.map((r) => ({ ...r, tier: tierFor(r.seed) }))
  .sort((a, b) => GAMBIT_TIERS.indexOf(a.tier) - GAMBIT_TIERS.indexOf(b.tier) || a.chair - b.chair);

/**
 * The game, opened on the seat. Answers its handle: `press`, `frame`, `draw`, `pointer` (a press on the cloth), `key`
 * (the board's cursor), `regularsNow` (who sits in the chairs, and what they say), `playing`, `staked`, `close`.
 * @param {{doc?: any, renderer: any, entity: any, say: (t: string) => void, holdCursor: () => (() => boolean), relock?: () => void,
 *   rand32: () => number, now: () => number, day: number|(() => number), key: string, friendly: boolean,
 *   regulars: {name: string, seed: number, chair: number}[], frame: any, mySeatFeet: number[], touch?: () => boolean,
 *   onHoldem: () => void, onIliac: () => void, onStand: () => void, play?: (clip: number, at: number[]) => void,
 *   online?: {send: (w: any) => boolean, myId: () => string|null, now: () => number, table: number, chairs: number,
 *     chair: number, chairFeet: (k: number) => number[]|null, welcomes?: () => number, gold?: boolean,
 *     stake?: (amount: number) => Promise<any>, purse?: () => (number|null), seated?: (id: string) => void,
 *     board?: () => Promise<any>, standDue?: (due: boolean) => void}|null}} d
 *   `online` KG5: the relay's King's Gambit table at this cloth (its index, its chairs, the player's chair), or null;
 *   KG6: `gold` the realm's gold table - `stake` the service's hold on a stake, `purse` the record's gold, `seated` the
 *   stake book told the relay sat it - and `board` the season's.
 */
export function openGambitTableGame(d) {
  const today = () => (typeof d.day === 'function' ? d.day() : d.day);
  const touch = () => !!d.touch?.();
  const g = {
    phase: /** @type {'setup'|'army'|'battle'|'over'} */ ('setup'), closed: false,
    regs: gambitRegulars(d.regulars), regular: /** @type {number|null} */ (null), stakeMult: /** @type {number|null} */ (null),
    crown: gambitCrownRestore(d.entity?.gambitCrown), army: /** @type {number[]} */ ([]), pressed: /** @type {number|null} */ (null), said: /** @type {string|null} */ (null),
    session: /** @type {GambitTableSession|null} */ (null), game: /** @type {any} */ (null), settled: false,
    selected: /** @type {number|null} */ (null), staged: /** @type {any} */ (null), info: /** @type {any} */ (null), cursor: /** @type {number[]|null} */ (null),
    why: /** @type {string|null} */ (null), armed: /** @type {'forfeit'|'stand'|null} */ (null), armedAt: 0,
    wordsOpen: false, armiesOpen: false, more: false, log: /** @type {string[]} */ ([]),
    barks: new Map(), places: gambitPlaces(d.frame, d.mySeatFeet), look: /** @type {any} */ (null), cam: /** @type {any} */ (null),
    draw: createGambitTableDraw(d.renderer, { doc: d.doc }), hud: /** @type {any} */ (null), release: d.holdCursor(),
    motion: createGambitMotion({ pick: (n) => (d.rand32() >>> 0) % Math.max(1, n) }), leanK: 0, leanAt: /** @type {number|null} */ (null),
    // KG5: the board's two seats online - the relay's table as told, the last word sent (its refusal is the room's or the
    // law's), the socket's welcomes (a new one asks the table again), the clock's last second shown
    mode: /** @type {'online'|'regulars'} */ (d.online ? 'online' : 'regulars'),
    remote: d.online ? new RemoteGambitTable({ myId: d.online.myId() }) : null, lastOp: /** @type {string|null} */ (null),
    welcomes: d.online?.welcomes?.() ?? 0, clockShown: /** @type {number|null} */ (null),
    // KG6: the gold table's stake - its pick, the service asked, the stake book's id till the relay sits it - and the
    // season board as read
    stakePick: /** @type {number|null} */ (null), staking: false, stakeId: /** @type {string|null} */ (null),
    board: /** @type {any} */ (null), boardOpen: false,
    // AUDIT KG II B3: the game open was opened unseated - watched, whatever the seats say by its end; A2: a sit on its
    // way (the relay may seat it after the panel has gone)
    watcher: false, sitting: false,
    // AUDIT KG II C3: a finger the cloth took, until it lifts
    finger: false,
    lastCmd: /** @type {any} */ (null),   // AUDIT KG II D16: the last command sent
    clearShown: /** @type {any} */ (null),   // AUDIT KG II C5: the last clear screen the lean fitted
  };
  g.motion.lay(g.places.end);
  /** A sound of the table's own, now or `after` ms on, from the board's middle (the motion's clock plays it). */
  const sound = (/** @type {number} */ clip, after = 0) => g.motion.cue(clip, d.now() + after, null);
  // HOW IT WORKS stands open until the player - not the character: a preference - has finished one game; their own
  // fold or unfold holds from then on (14.4)
  const guideOpen = () => { const v = getPref('gambitGuideOpen'); return typeof v === 'boolean' ? v : !getPref('gambitPlayed'); };
  const purse = () => goldAmount(d.entity);
  /** A regular's row as the panel reads it: what is left of their night, and whether they play for fun tonight. */
  const rows = () => g.regs.map((r) => {
    const nightLeft = d.friendly ? 0 : gambitNightLeft(d.entity.gambitPurses, d.key, today(), r.name, r.tier);
    return { ...r, nightLeft, forFun: !d.friendly && nightLeft < r.tier.stake };
  });
  const chosen = () => (g.regular != null ? rows()[g.regular] ?? null : null);
  /** The stake the setup has chosen, as it stands now: 0 for fun, or null when no lawful pick is down. */
  const stakeNow = () => {
    const r = chosen();
    if (!r) return null;
    if (d.friendly || r.forFun) return 0;
    const gold = stakeOf(r.tier, g.stakeMult ?? 0);
    return gold > 0 && gold <= purse() && gold <= r.nightLeft ? gold : null;
  };
  const nameOf = (/** @type {number} */ id) => g.game?.names.get(id) ?? '?';
  /** KG5: the online board's own - my seat at it (-1 unseated), whether I watch a game under way. */
  const online = () => g.mode === 'online' && !!g.remote;
  const mySeat = () => (online() ? g.remote.seat() : -1);
  const watching = () => online() && !!g.session && g.watcher;   // AUDIT KG II B3: a seat stood up by its result still played it
  /** KG5: the board's two seats as the panel reads them (section 18), or null with the regulars. */
  const onlineModel = () => {
    if (!online()) return null;
    const st = g.remote.state, me = mySeat();
    const seats = [0, 1].map((k) => { const x = st?.seats?.[k]; return x ? { name: x.name, ready: !!x.ready, mine: k === me } : null; });
    const other = me >= 0 ? seats[1 - me] : null, ready = me >= 0 && !!seats[me]?.ready;
    const step = me < 0 ? (st?.game ? 'watch' : seats.every(Boolean) ? 'full' : 'sit')
      : ready ? (other ? (other.ready ? 'dealing' : 'readyWait') : 'aloneReady') : other ? (other.ready ? 'theirReady' : 'ready') : 'alone';
    // KG6: the mod's online stakes - each the purse's to cover, the other player's to match once they put theirs down
    const purse = d.online.purse?.() ?? 0, theirs = me >= 0 ? st?.seats?.[1 - me]?.stake ?? null : null;
    const stakes = d.online.gold ? GAMBIT_ONLINE_STAKES.map((n) => {
      const why = theirs !== null && theirs !== n ? stakeDiffers(other?.name ?? '', theirs) : (purse ?? 0) < n ? stakeShort(purse ?? 0) : null;
      return { n, enabled: !why && !ready, chosen: g.stakePick === n, why };
    }) : null;
    return {
      seats: seats.map((x, k) => (x ? { ...x, stake: st?.seats?.[k]?.stake ?? null } : null)), names: seats.map((x) => x?.name ?? ''), canSit: me < 0 && !st?.game && !seats.every(Boolean), ready, step,
      stepArgs: { name: other?.name ?? '', a: seats[0]?.name ?? '', b: seats[1]?.name ?? '' }, watching: watching(),
      clock: g.session && st?.game ? g.remote.clockLeft(d.online.now()) : null,
      gold: !!d.online.gold, stakes, staking: g.staking, canBoard: !!d.online.board,
    };
  };
  const model = () => {
    const s = g.session;
    return gambitHudModel({
      online: onlineModel(), canOnline: !!d.online, board: g.board, boardOpen: g.boardOpen,
      phase: g.phase, regulars: rows(), regular: g.regular, friendly: d.friendly, purse: purse(), stakeMult: g.stakeMult, crown: g.crown,
      army: g.army, pressed: g.pressed, said: g.said,
      game: s && g.game ? { state: s.state, crowns: g.game.crowns, name: g.game.name, stake: g.game.stake, pot: g.game.pot ?? 0, over: s.shown ? s.over : null, decided: !!s.over, dealt: g.game.dealt, nightSpent: g.game.nightSpent } : null,   // AUDIT KG II C6: decided before its result is shown
      selected: g.selected, staged: g.staged, info: g.info, why: g.why, armed: g.armed,
      guideOpen: guideOpen(), wordsOpen: g.wordsOpen, armiesOpen: g.armiesOpen, log: g.log, touch: touch(), more: g.more,
    });
  };
  /** The board's look on the cloth (render/gambitTableDraw.js paintGambitMat), read off the panel's own marks. */
  const lookOf = (/** @type {any} */ m) => {
    const st = g.session?.state;
    if (!st || !m.battle && !m.result) return st ? { layout: st.layout, tiles: st.tiles, hazards: st.hazards, pieces: st.pieces.map(pieceLook), selected: null, lit: [], range: [], targets: [], cursor: null, staged: null } : null;
    const b = m.battle;
    return {
      layout: st.layout, tiles: st.tiles, hazards: st.hazards, pieces: st.pieces.map(pieceLook),
      selected: b?.selected ?? null, lit: b?.lit ?? [], range: b?.range ?? [], targets: b?.targets ?? [],
      cursor: g.phase === 'battle' ? g.cursor : null, staged: b?.staged && b.staged.kind === 'move' ? { col: b.staged.col, row: b.staged.row } : null,
    };
  };
  const paint = () => {
    if (g.closed) return;
    const m = model();
    g.look = g.phase === 'battle' || g.phase === 'over' ? lookOf(m) : null;
    g.hud.render(m);
  };

  // ── THE GAME ───────────────────────────────────────────────────────────────────────────────────────────────────

  /** A bark over a regular's head (CARDS4b's layer). */
  const bark = (/** @type {string} */ name, /** @type {string} */ text, /** @type {number} */ now) => { if (name && text) g.barks.set(name, { text, until: now + BARK_MS }); };
  /** THE DEAL: the stake read again at the press (the purse may have shrunk since it was chosen), the session dealt,
   *  the gold taken and held by the table. */
  function deal(/** @type {number} */ now) {
    const r = chosen();
    const no = armyRefusal(g.army);
    if (!r) { g.phase = 'setup'; paint(); return; }
    if (no) { g.why = refusalWords(no); paint(); return; }
    const stake = stakeNow();
    if (stake === null) { g.phase = 'setup'; g.stakeMult = null; paint(); return; }   // the pick no longer stands: chosen again, said by the next step
    const session = new GambitTableSession({ army: g.army.slice(), regular: { name: r.name, seed: r.seed, tier: r.tier }, stake, rand32: d.rand32, now });
    if (session.over) { g.why = refusalWords('rand'); paint(); return; }   // the table could not deal: nothing taken
    if (stake > 0) deductGold(d.entity, stake);
    const st = session.state;
    const crowns = [g.crown, regularCrown(r.seed, g.crown)];
    g.session = session;
    g.settled = false;
    g.game = {
      stake, regular: r.name, name: r.name, tier: r.tier, crowns,
      dealt: [0, 1].map((s) => st.pieces.filter((p) => p.side === s).length),
      names: new Map(st.pieces.map((p) => [p.id, pieceName(p, crowns)])),   // a fallen piece is still said by name
      nightSpent: false,
    };
    g.phase = 'battle';
    g.selected = null; g.staged = null; g.info = null; g.why = null; g.armed = null; g.more = false; g.log = [];
    const king = st.pieces.find((p) => p.side === 0 && p.king);
    g.cursor = king ? [king.col, king.row] : KG_KING_CELL.slice();
    d.say(dealLine(r.name, stake));
    pump(now);
  }
  /** The session's events into the log, the game settled the moment it is decided, the result shown after its beat. */
  function pump(/** @type {number} */ now) {
    const s = g.session;
    if (!s) return false;
    const events = s.drain();
    if (events.length) g.motion.feed(events, now, s.state);   // KG4: the pieces' motion, from the law's own words
    const watched = watching();   // KG5: a watcher's log would call the host's pieces "yours" - the board says it
    for (const e of events) {
      // AUDIT KG II B11: a press held while another was on its way, refused on the board it was sent on
      if (e.t === 'refused') { g.why = e.why === 'link' ? onlineRefusal(e.why) : refusalWords(e.why, { piece: e.cmd?.piece != null ? nameOf(e.cmd.piece) : '', target: e.cmd?.target != null ? nameOf(e.cmd.target) : '' }); continue; }
      const line = watched ? null : logLine(e, { regular: g.game.name, names: nameOf });
      if (line) g.log.push(line);
      if (e.t === 'decided') {
        settle(now);
        // FinishMatch: the fanfare and the coins, or the groan, at the result's beat
        if (watched) continue;
        if (e.winner === 0) { sound(SOUND.ArenaFanfareLevelUp, GAMBIT_RESULT_MS); if (g.game?.stake > 0) sound(SOUND.GoldPieces, GAMBIT_RESULT_MS + 600); }
        else if (e.winner === 1 && e.by !== 'forfeit') sound(SOUND.Groan, GAMBIT_RESULT_MS);   // AUDIT KG II C11: the mod's forfeit is silent (ChooseArmy clears the pending sounds, IL_098f - never FinishMatch)
      }
    }
    g.log = g.log.slice(-GAMBIT_LOG_MAX);
    if (events.length) {
      // a selection the game took away - its piece fallen, the turn passed - is let go
      const st = s.state;
      const sel = g.selected != null ? pieceById(st, g.selected) : null;
      if (!sel || st.turn !== 0 || st.ending || st.over || s.over) { g.selected = null; g.staged = null; }   // AUDIT KG II C6: a game decided lets go too
      if (g.info?.piece != null && !pieceById(st, g.info.piece)) g.info = null;
    }
    if (s.shown && g.phase === 'battle') { g.phase = 'over'; g.armed = null; g.staged = null; g.selected = null; g.more = false; }
    return events.length > 0;
  }
  /** THE GOLD, once decided: the table pays out (a win's pot, or a stake that did not stand), the regular's night
   *  booked - a game for fun touches neither. The player has finished a game: the guide folds from now (14.4). */
  function settle(/** @type {number} */ now) {
    const s = g.session;
    if (!s?.over || g.settled) return;
    g.settled = true;
    if (s.over.winner === 0 && !watching()) noteAct('gambit-won');   // QL11: a game won - side 0 is mine, a regular's game or the relay's (a watcher's board is the host's)
    const r = g.game;
    const gold = s.settlement() ?? { pay: 0, net: 0 };
    if (gold.pay > 0) addGold(d.entity, gold.pay);
    if (!d.friendly && r.stake > 0 && gold.net !== 0) {
      d.entity.gambitPurses = gambitPursesAfter(d.entity.gambitPurses, d.key, today(), r.name, gold.net);
      r.nightSpent = gold.net > 0 && gambitNightLeft(d.entity.gambitPurses, d.key, today(), r.name, r.tier) < r.tier.stake;
    }
    if (online()) { if (s.over.by !== 'void' && !watching()) setPref('gambitPlayed', true); return; }   // KG5: no gold, no regular's word
    if (s.over.by !== 'void') d.say(resultGold(s.over, r.stake, r.name));
    if (s.over.winner !== null) bark(r.name, barkEnd(s.over.winner === 1, (d.rand32() >>> 0) / 2 ** 32), now);
    if (s.over.by === 'king' || s.over.by === 'forfeit') setPref('gambitPlayed', true);
  }
  /** The player's command (side 0): taken, or its refusal said. */
  function act(/** @type {any} */ cmd, /** @type {number} */ now) {
    const s = g.session;
    if (!s?.playing()) return;
    const piece = cmd.piece != null ? nameOf(cmd.piece) : '';
    const target = cmd.target != null ? nameOf(cmd.target) : '';
    const no = s.act(cmd, now);
    g.staged = null;
    if (no) { g.why = no === 'link' ? onlineRefusal(no) : refusalWords(no, { piece, target }); return; }
    g.why = null;
    pump(now);
  }

  // ── THE PRESSES ────────────────────────────────────────────────────────────────────────────────────────────────

  /** A cell pressed on the board (the cloth, the cursor): the mod's OnCellClicked - select one's own piece, move to a
   *  lit cell, strike a ringed foe - staged under a finger, at once with a fine pointer; any other cell or piece is
   *  shown in the information box. */
  function cellPress(/** @type {number[]} */ cell, /** @type {boolean} */ stage, /** @type {number} */ now) {
    const s = g.session, st = s?.state;
    if (!st || g.phase !== 'battle') return;
    const [c, r] = cell;
    g.cursor = [c, r];
    const mine = s.playing() && st.turn === 0 && !st.ending && !watching();   // KG5: a watcher presses nothing of the game's
    const sel = g.selected != null ? pieceById(st, g.selected) : null;
    const pc = pieceAt(st, c, r);
    if (pc && pc.side === 0) {
      g.info = { piece: pc.id }; g.staged = null;
      // OnCellClicked: one's own piece chosen - again, if it was (the mod's IL 0x4620: never let go by its own press;
      // AUDIT KG II C14 - the port had toggled it off)
      g.selected = mine ? pc.id : null;
      if (mine) sound(SOUND.ButtonClick);
      return;
    }
    if (pc && sel && mine && foesInRange(st, sel).some((x) => x.id === pc.id)) {
      g.info = { piece: pc.id };
      if (stage) g.staged = { kind: 'attack', target: pc.id };
      else act({ type: 'attack', piece: sel.id, target: pc.id }, now);
      return;
    }
    if (!pc && sel && mine && reachable(st, sel).some(([x, y]) => x === c && y === r)) {
      if (stage) { g.staged = { kind: 'move', col: c, row: r }; g.info = { cell: [c, r] }; }
      else act({ type: 'move', piece: sel.id, col: c, row: r }, now);
      return;
    }
    g.info = pc ? { piece: pc.id } : { cell: [c, r] };
    g.staged = null;
    g.selected = null;   // the mod's: a press on anything else - an empty cell out of reach, a foe out of range - lets the piece go (AUDIT KG II C14)
  }
  /** @param {string} id @param {any} [value] */
  function press(id, value) {
    if (g.closed) return;
    const now = d.now();
    // A PRESS THAT COSTS GOLD ASKS TWICE (14.3): any other press disarms the first
    if (id !== 'say' && id !== g.armed) g.armed = null;
    if (id === 'say') { g.why = typeof value === 'string' ? value : null; paint(); return; }
    if (id === 'guide') { setPref('gambitGuideOpen', !!value); paint(); return; }   // the reader's own fold, kept (14.4)
    if (id === 'words') { g.wordsOpen = !!value; paint(); return; }
    if (id === 'armies') { g.armiesOpen = !!value; paint(); return; }
    if (id === 'holdem') { d.onHoldem(); return; }
    if (id === 'iliac') { d.onIliac(); return; }
    if (id === 'stand') {
      if (g.session?.playing() && !watching() && g.armed !== 'stand') { g.armed = 'stand'; g.armedAt = now; paint(); return; }   // AUDIT KG II B6: a watcher's costs nothing
      d.onStand();   // a game under way is forfeited by the close (every road off the seat)
      return;
    }
    g.why = null;
    if (online() && onlinePress(id, value, now)) { paint(); return; }
    if (id === 'online' && d.online) { toOnline(); paint(); return; }
    if (g.phase === 'setup') setupPress(id, value, now);
    else if (g.phase === 'army') armyPress(id, value, now);
    else if (g.phase === 'battle') battlePress(id, value, now);
    else overPress(id, now);
    paint();
  }
  function setupPress(/** @type {string} */ id, /** @type {any} */ value, /** @type {number} */ now) {
    if (id === 'regular' && Number.isInteger(value) && g.regs[value]) {
      if (g.regular !== value) { g.regular = value; g.stakeMult = null; bark(g.regs[value].name, barkInvite(), now); }
    } else if (id === 'stake' && GAMBIT_STAKE_MULTS.includes(value)) { g.stakeMult = value; sound(SOUND.GoldPieces); }   // DrawChallenge: the stake put down
    else if (id === 'crown' && Number.isInteger(value) && GAMBIT_CROWNS[value]) { g.crown = GAMBIT_CROWNS[value]; d.entity.gambitCrown = g.crown; }
    else if (id === 'next' && stakeNow() !== null) g.phase = 'army';
  }
  function armyPress(/** @type {string} */ id, /** @type {any} */ value, /** @type {number} */ now) {
    if (id === 'unit' && rosterUnit(value)) {
      g.pressed = value;
      if (canRecruit(g.army, value)) { g.army = [...g.army, value]; g.said = unitJoined(value); sound(SOUND.ButtonClick); return; }   // TryAdd
      // why not, as the law words it: a thirteenth unit, or points the army no longer has
      g.said = armyRefusal([...g.army, value]) === 'units' ? armyFull() : unitTooDear(value, KG_POINT_BUDGET - armyCost(g.army));
      g.why = g.said;
    } else if (id === 'remove' && Number.isInteger(value) && g.army[value] != null) {
      const gone = g.army[value];
      g.army = g.army.filter((_, k) => k !== value);
      g.said = unitLeft(gone);
    } else if (id === 'autofill') {
      const filled = autoFill(g.army, KG_POINT_BUDGET, d.rand32);
      if (filled) { g.army = filled; g.said = null; sound(SOUND.ButtonClick); } else g.why = refusalWords('rand');   // AutoFill
    } else if (id === 'clear') { g.army = []; g.said = null; }
    else if (id === 'back') g.phase = 'setup';
    else if (id === 'start') deal(now);
  }
  function battlePress(/** @type {string} */ id, /** @type {any} */ value, /** @type {number} */ now) {
    const s = g.session, st = s?.state;
    if (!st) return;
    if (id === 'piece' && Number.isInteger(value)) {
      const pc = pieceById(st, value);
      if (pc) cellPress([pc.col, pc.row], true, now);   // a row is the panel's - a strike from it is staged, never at once
    } else if (id === 'cell' && Array.isArray(value)) cellPress(value, touch(), now);
    else if (id === 'move' && g.staged?.kind === 'move' && g.selected != null) act({ type: 'move', piece: g.selected, col: g.staged.col, row: g.staged.row }, now);
    else if (id === 'strike' && g.staged?.kind === 'attack' && g.selected != null) act({ type: 'attack', piece: g.selected, target: g.staged.target }, now);
    else if (id === 'cancel') { if (g.staged) g.staged = null; else { g.selected = null; g.info = null; } }
    else if (id === 'drink' && g.selected != null) act({ type: 'potion', piece: g.selected }, now);
    else if (id === 'end') { if (s.playing() && st.turn === 0 && !st.ending) sound(SOUND.ButtonClick); act({ type: 'end' }, now); }   // EndTurnClicked, when the player can act
    else if (id === 'more') g.more = !g.more;
    else if (id === 'forfeit') {
      if (!s.playing()) return;
      if (g.armed !== 'forfeit') { g.armed = 'forfeit'; g.armedAt = now; return; }
      g.armed = null;
      s.forfeit(now);
      pump(now);
    }
  }
  function overPress(/** @type {string} */ id, /** @type {number} */ now) {
    if (id === 'again') { g.phase = 'army'; deal(now); if (g.phase === 'army') g.phase = 'setup'; }   // a stake that no longer stands is chosen again
    else if (id === 'army') { g.phase = 'army'; g.session = null; g.game = null; g.look = null; }
    else if (id === 'regulars') { g.phase = 'setup'; g.session = null; g.game = null; g.look = null; g.stakeMult = null; }
  }

  // ── KG5: THE BOARD ONLINE ──────────────────────────────────────────────────────────────────────────────────────

  /** A word to the relay's table at this cloth: false, and said, when the link will not carry it. @param {any} w */
  function send(w) {
    if (!d.online) return false;
    g.lastOp = w.op;
    if (w.op === 'act') g.lastCmd = w.cmd;   // AUDIT KG II D16: a refusal of it names its piece and target
    const ok = d.online.send({ ...w, table: d.online.table });
    if (!ok && w.op !== 'look' && w.op !== 'stand') g.why = onlineRefusal('link');
    // AUDIT KG II B12: a stand the link would not carry is the host's to say again each frame (Hold'em's AUDIT CARDS-3
    // B4) - a ready seat the relay kept would be dealt in and clocked out of its stake; a sit takes it back
    if (w.op === 'stand' || (ok && w.op === 'sit')) d.online.standDue?.(w.op === 'stand' && !ok);
    return ok;
  }
  /** Sit at the board's free seat. */
  const sitDown = () => { g.sitting = send({ op: 'sit', chair: d.online.chair, chairs: d.online.chairs, crown: crownIndex(g.crown) }); };
  /** AUDIT KG II A1 + A2: up from the board - seated, or a sit on its way (Iliac Hand's AUDIT CARDS-6 E11) - naming the
   *  game the panel showed, so a game dealt as the press went is not this player's to concede (E13). */
  const standUp = () => { if (mySeat() >= 0 || g.sitting) send({ op: 'stand', gameNo: g.remote.state?.gameNo ?? 0 }); g.sitting = false; };
  /** The online board's presses; true when the press was the board's. */
  function onlinePress(/** @type {string} */ id, /** @type {any} */ value, /** @type {number} */ now) {
    const me = mySeat();
    if (id === 'regulars') { toRegulars(); return true; }
    if (id === 'board' && d.online.board) { readBoard(); return true; }   // KG6
    if (g.phase === 'setup') {
      if (id === 'sit') { if (me < 0) sitDown(); return true; }
      if (id === 'crown' && Number.isInteger(value) && GAMBIT_CROWNS[value]) { g.crown = GAMBIT_CROWNS[value]; d.entity.gambitCrown = g.crown; return true; }
      return id === 'next' || id === 'regular' || id === 'stake';   // the regulars' presses are not the board's
    }
    if (g.phase === 'army') {
      const ready = me >= 0 && g.remote.ready(me);
      if (id === 'leave') { standUp(); g.phase = 'setup'; return true; }
      if (id === 'ready') {
        const no = armyRefusal(g.army);
        if (no) { g.why = refusalWords(no); return true; }
        if (me < 0 || g.staking || ready || g.stakeId) return true;   // AUDIT KG II B1: one stake on its way, and none past a Ready
        if (d.online.gold) {   // KG6: the stake held by the service first
          // AUDIT KG II B8: a pick the other seat's stake has closed is never asked of the realm
          const pick = onlineModel()?.stakes?.find((/** @type {any} */ x) => x.chosen) ?? null;
          if (!pick?.enabled) { g.why = pick?.why ?? stakeChoose(); return true; }
          readyStaked();
          return true;
        }
        send({ op: 'ready', army: g.army.slice(), crown: crownIndex(g.crown) });
        return true;
      }
      if (id === 'stake' && d.online.gold && GAMBIT_ONLINE_STAKES.includes(value)) {   // KG6: a pick, while not ready
        const pick = onlineModel()?.stakes?.find((/** @type {any} */ x) => x.n === value);
        if (pick && !pick.enabled) { g.why = pick.why; return true; }
        g.stakePick = value;
        return true;
      }
      if (id === 'unready') { if (ready) send({ op: 'unready' }); return true; }
      // a change to a ready army takes the Ready back first (the relay keeps the army it was told)
      if (ready && ['unit', 'remove', 'autofill', 'clear'].includes(id)) send({ op: 'unready' });
      if (id === 'start' || id === 'back') return true;   // the regulars' - online, Ready and Leave the board
      return false;
    }
    if (g.phase === 'battle' && watching()) return true;   // a watcher's presses are the regulars and Stand up
    if (g.phase === 'over') {
      if (id === 'again') { g.phase = 'army'; g.session = null; g.game = null; g.look = null; g.motion.reset?.(); return true; }
      // AUDIT KG II B7: a watcher at a board a seat has come free at sits down from the result
      if (id === 'sit') { if (me < 0) { g.phase = 'setup'; g.session = null; g.game = null; g.look = null; g.motion.reset?.(); sitDown(); } return true; }
      return id === 'army';
    }
    return false;
  }
  /** KG6: READY AT THE GOLD TABLE - the stake asked of the realm service (the record's own act: the purse checkpointed,
   *  the gold held out of it while asked), then the relay's Ready with the service's order on it. A stake the relay
   *  never spends (a refusal, a lost word, a panel closed) is the stake book's to void back (net/card/cardStakes.js voidable). */
  async function readyStaked() {
    const amount = g.stakePick;
    if (amount === null || !d.online?.stake) { g.why = onlineRefusal('stake needed'); return; }
    g.staking = true;
    g.why = null;
    paint();
    let r;
    try { r = await d.online.stake(amount); } catch { r = { ok: false, error: 'offline' }; }
    g.staking = false;
    if (g.closed) return;
    if (!r?.ok) { g.why = stakeRefusal(r); paint(); return; }   // AUDIT KG II B16: the realm's own word - nothing held, or an answer lost
    // the stake book's id till the relay sits it (AUDIT KG II B1: or refuses it, or the socket changes) - a stake never
    // sent is the book's to void back
    g.stakeId = mySeat() >= 0 && send({ op: 'ready', army: g.army.slice(), crown: crownIndex(g.crown), stake: r.stake }) ? r.id ?? null : null;
    paint();
  }
  /** KG6: THE SEASON BOARD - read from the service, shown in its section; pressed again, folded. */
  async function readBoard() {
    if (g.boardOpen && g.board && g.board !== 'reading') { g.boardOpen = false; return; }
    g.boardOpen = true;
    g.board = 'reading';
    let b;
    try { b = await d.online?.board?.(); } catch { b = null; }
    if (g.closed) return;
    g.board = b?.ok ? (b.data ?? b) : 'failed';
    paint();
  }
  /** Play a regular instead: up from the board (a game under way forfeited), the regulars' setup. */
  function toRegulars() {
    standUp();
    g.mode = 'regulars';
    g.phase = 'setup'; g.session = null; g.game = null; g.look = null; g.armed = null;
    g.places = gambitPlaces(d.frame, d.mySeatFeet);
    g.motion.lay(g.places.end);
  }
  /** Play another player: the board's seats, asked of the relay. */
  function toOnline() {
    if (g.session?.playing()) return;
    g.mode = 'online';
    g.phase = 'setup'; g.session = null; g.game = null; g.look = null;
    send({ op: 'look' });
  }
  /** The game the relay dealt (or the one under way, told by a look), opened as this seat reads it - a watcher the
   *  host's side. @param {any} st the relay's table @param {number} now */
  function openOnline(st, now, dealt) {
    const me = mySeat(), side = me === 1 ? 1 : 0;
    g.watcher = me < 0;
    const host = st.seats[0], guest = st.seats[1];
    g.places = gambitPlaces(d.frame, d.online.chairFeet(host?.chair ?? d.online.chair) ?? d.mySeatFeet, { flip: side === 1 });
    g.motion.reset?.();
    g.motion.lay(g.places.end);
    const session = new RemoteGambitSession({
      side, game: st.game, gameNo: st.gameNo, now, watch: me < 0, midway: !dealt,
      send: (cmd) => send({ op: 'act', gameNo: st.gameNo, cmd }), forfeit: () => send({ op: 'forfeit', gameNo: st.gameNo }),
    });
    const crownOf = (/** @type {any} */ x) => GAMBIT_CROWNS[x?.crown] ?? GAMBIT_CROWNS[0];
    const crowns = side === 1 ? [crownOf(guest), crownOf(host)] : [crownOf(host), crownOf(guest)];
    const name = (side === 1 ? host?.name : guest?.name) ?? '?';
    const view = session.state;
    g.session = /** @type {any} */ (session);
    g.settled = false;
    g.game = {
      stake: me >= 0 && st.pot ? Math.floor(st.pot / 2) : 0, regular: name, name, tier: null, crowns,   // KG6: each player's stake in the pot - a watcher's none (AUDIT KG II B4)
      pot: st.pot ?? 0,   // AUDIT KG II D5: the pot, as a watcher is told it
      dealt: [0, 1].map((k) => view.pieces.filter((p) => p.side === k).length),
      names: new Map(view.pieces.map((p) => [p.id, pieceName(p, crowns)])), nightSpent: false,
    };
    g.phase = 'battle';
    g.selected = null; g.staged = null; g.info = null; g.why = null; g.armed = null; g.more = false; g.log = [];
    const king = view.pieces.find((p) => p.side === 0 && p.king);
    g.cursor = king ? [king.col, king.row] : KG_KING_CELL.slice();
    if (me >= 0) d.say(dealLine(name, g.game.stake));   // AUDIT KG II B5: the gold table's said
    pump(now);
  }
  /** A FRAME OF THE RELAY'S for this table (scenes/worldModes.js routes them): the table told, a game opened or fed, the
   *  seats' changes read into the phase, a refusal said. @param {any} f */
  function relay(f) {
    if (g.closed || !d.online || f?.table !== d.online.table) return;
    const now = d.now();
    const events = g.remote.apply(f, d.online.now());
    if (typeof f.error === 'string') {
      // the law's word for a command, the room's for the rest ('full' is both - a sit's and a full health's)
      // AUDIT KG II D16: the room's own words on a command (too late, gone) are the room's; the law's name the command's
      // piece and target
      const c = g.lastCmd;
      g.why = g.lastOp === 'act' && !['stale', 'no game', 'not seated'].includes(f.error)
        ? refusalWords(f.error, { piece: c?.piece != null ? nameOf(c.piece) : '', target: c?.target != null ? nameOf(c.target) : '' })
        : onlineRefusal(f.error);
      if (g.session instanceof RemoteGambitSession) g.session.sentAt = null;
      g.stakeId = null;   // AUDIT KG II B1: a Ready refused is a stake never sat - the stake book's to void back
      if (mySeat() < 0) g.sitting = false;   // AUDIT KG II A2: a sit refused
      if (online()) paint();
      return;
    }
    if (!online()) return;   // playing the regulars: the board's frames are told, and wait for the online setup
    const st = g.remote.state;
    const me = mySeat();
    if (me >= 0) g.sitting = false;   // AUDIT KG II A2: the sit landed - the seat says it now
    // KG6: the relay spent my stake (my seat ready with it): the stake book keeps it as sat, owed its cash-out
    if (g.stakeId && me >= 0 && st?.seats?.[me]?.stake) { d.online.seated?.(g.stakeId); g.stakeId = null; }
    const dealt = events.some((/** @type {any} */ e) => e.t === 'game');
    const s = g.session instanceof RemoteGambitSession ? g.session : null;
    if (st?.game && (dealt || !s || s.gameNo !== st.gameNo)) openOnline(st, now, dealt);
    else if (s && s.gameNo === (st?.game ? st.gameNo : st?.last?.gameNo)) s.feed(events, st);
    else if (s && !s.over && !st?.game) { g.session = null; g.game = null; g.look = null; g.phase = 'setup'; g.motion.reset?.(); }   // AUDIT KG II B2: a game the relay no longer holds, nor its end
    if (!g.session) {
      if (me >= 0 && g.phase === 'setup') g.phase = 'army';
      else if (me < 0 && g.phase === 'army') g.phase = 'setup';   // stood up by the relay (the clock, another table)
    }
    paint();
  }

  // ── THE CLOTH AND THE KEYS ─────────────────────────────────────────────────────────────────────────────────────

  /** A PRESS ON THE CLOTH (14.3): `at` the press's CSS px on the canvas, `view` the canvas's size and the world strip
   *  (`{w, h, rect}`), `how` its pointer (`{touch, button}`). Answers whether the table took it - a press on the board,
   *  or anywhere on the table while a battle is on, is never the seat's swing or its step. */
  function pointer(/** @type {number[]} */ at, /** @type {{w: number, h: number, rect?: any}} */ view, /** @type {{touch?: boolean, button?: number}} */ how = {}) {
    if (g.closed || g.phase !== 'battle' || !g.cam || !g.session) return false;
    const { w, h, rect = null } = view, cam = g.cam;
    const ray = rayDirFromScreen(at[0], at[1], w, h, cam.proj, cam.view, cam.eye, rect);
    const p = ray ? tablePoint(cam.eye, ray, g.places.top) : null;
    const built = ray ? gambitPressCell(g.places, g.session.state, cam.eye, ray, g.selected) : null;   // KG4: the built board - a card's face, a wall's top (AUDIT KG II C7: the chosen card where it is drawn, lifted)
    if (!built && (!p || !onFelt(p))) return false;
    if (how.touch) g.finger = true;   // AUDIT KG II C3: the cloth's until it lifts - never the touch layer's stick
    const now = d.now();
    g.armed = null;
    if ((how.button ?? 0) !== 0) { press('cancel'); return true; }   // another button on the table cancels - never the swing
    let cell = built;
    // AUDIT KG II C13: a finger on a foe's card is that foe (14.3: its information box, a strike if it is ringed) - never
    // snapped to one of the player's own beside it; a press on the mat, a wall or one's own card snaps
    const pressed = built ? pieceAt(g.session.state, built[0], built[1]) : null;
    if (how.touch && pressed?.side !== 1) {
      // UNDER A FINGER: the nearest of the player's pieces, the lit cells and the ringed foes within GAMBIT_SNAP_PX
      const m = model();
      const st = g.session.state;
      const candidates = [...st.pieces.filter((x) => x.side === 0).map((x) => [x.col, x.row, 1]), ...(m.battle?.lit ?? []).map((c) => [c[0], c[1], 0]), ...(m.battle?.targets ?? []).map((id) => { const x = pieceById(st, id); return x ? [x.col, x.row, 1] : null; }).filter(Boolean)];
      let best = null, bestD = GAMBIT_SNAP_PX;
      const mid = GAMBIT_CARD_FOOT + gambitCardHeight(g.places.cell) / 2;   // KG4: a piece where the finger sees it - its card's middle
      for (const c of candidates) {
        const o = g.places.at(c[0], c[1]);
        const s = projectToScreen(c[2] ? [o[0], o[1] + mid, o[2]] : o, w, h, cam.proj, cam.view, rect);
        const dist = s.front ? Math.hypot(s.x - at[0], s.y - at[1]) : Infinity;
        if (dist <= bestD) { bestD = dist; best = [c[0], c[1]]; }
      }
      cell = best ?? cell;
    }
    if (!cell) { paint(); return true; }   // the table round the board: taken, and nothing pressed
    g.why = null;
    cellPress(cell, !!how.touch, now);
    paint();
    return true;
  }
  /** Whether a table point lies on the felt (the board and the cloth round it). */
  const onFelt = (/** @type {number[]} */ p) => {
    const f = d.frame, a = [Math.sin(f.axisYaw), Math.cos(f.axisYaw)];
    const dx = p[0] - f.centre[0], dz = p[2] - f.centre[2];
    return Math.abs(dx * a[0] + dz * a[1]) <= f.halfLong && Math.abs(dx * a[1] - dz * a[0]) <= f.halfShort;
  };
  /** THE KEYS AND THE PAD ON THE BOARD (14.3): `code` a key's or a pad button's code. Answers whether it was taken. */
  function key(/** @type {string} */ code) {
    if (g.closed || g.phase !== 'battle' || !g.session) return false;
    const st = g.session.state;
    const k = gambitBoardKey(code);
    if (k?.startsWith('Arrow')) {
      g.cursor = boardCursorStep(g.cursor ?? KG_KING_CELL.slice(), k);
      const pc = pieceAt(st, g.cursor[0], g.cursor[1]);
      g.info = pc ? { piece: pc.id } : { cell: g.cursor.slice() };
      g.armed = null;
      paint();
      return true;
    }
    if (k === 'press') {
      g.armed = null;
      g.why = null;
      if (g.staged) press(g.staged.kind === 'move' ? 'move' : 'strike');
      else { cellPress(g.cursor ?? KG_KING_CELL.slice(), false, d.now()); paint(); }
      return true;
    }
    if (k === 'cancel') {
      if (g.staged || g.selected != null) press('cancel');
      else press('stand');   // nothing to cancel: the Stand up press - asked twice while a game is under way
      return true;
    }
    return false;
  }

  // ── THE FRAME ──────────────────────────────────────────────────────────────────────────────────────────────────

  function frame(/** @type {number} */ now) {
    if (g.closed) return;
    let changed = false;
    if (g.armed && now - g.armedAt >= GAMBIT_ARM_MS) { g.armed = null; changed = true; }
    if (g.session) { g.session.tick(now); changed = pump(now) || changed; }
    if (online()) {
      const w = d.online?.welcomes?.() ?? 0;
      // a new socket: the relay stood the old one up (a stake it sat comes home as a cash-out) - ask again, until the gate
      // lets the look go (AUDIT KG II B17)
      if (w !== g.welcomes) { g.stakeId = null; g.sitting = false; if (send({ op: 'look' })) g.welcomes = w; }
      const c = g.remote.state?.game ? g.remote.clockLeft(d.online.now()) : null;
      if (c !== g.clockShown) { g.clockShown = c; changed = true; }
    }
    // THE SOUNDS come due, each played at the cloth (the board's middle for the table's own)
    for (const c of g.motion.sounds(now)) d.play?.(c.clip, c.cell ? g.places.at(c.cell[0], c.cell[1]) : g.places.at((KG_COLS - 1) / 2, (KG_ROWS - 1) / 2));
    if (changed) paint();
  }

  const pieceLook = (/** @type {any} */ p) => ({ id: p.id, side: p.side, col: p.col, row: p.row, king: p.king, unit: p.unit });
  g.hud = createGambitTableHud({ onPress: press, doc: d.doc });
  sound(SOUND.DiceRoll);   // OpenChallenge
  if (online()) send({ op: 'look' });   // KG5: the board as the relay keeps it
  paint();
  return {
    g, press, frame, pointer, key, relay,
    /** The cloth's picture this frame (the room's own pass, after the decor): the board and its pieces; `cam` the
     *  frame's lens, kept for the next press on the cloth. */
    draw(/** @type {number} */ _now, /** @type {{proj: any, view: any, eye: number[]}} */ cam) {
      if (g.closed) return;
      if (cam) g.cam = { proj: cam.proj, view: Float32Array.from(cam.view), eye: cam.eye.slice() };
      if (!g.look) return;
      const now = typeof _now === 'number' ? _now : d.now();
      const poses = g.session ? g.motion.poses(g.session.state, now, { reduced: prefersReducedMotion() }) : null;
      g.draw.draw({ places: g.places, look: g.look, crowns: g.game ? g.game.crowns.map(crownIndex) : [3, 0], poses, eye: g.cam?.eye, now });
    },
    /**
     * THE LEAN (10.7): this frame's eye over the board - `{eye, fwd}` eased between the seat's own (`seat`) and the lean,
     * or null on the seat's own view. `view` the canvas (CSS px), its world strip and the lens (`{w, h, rect, aspect,
     * fovY}`). @param {number} now @param {any} view @param {{eye: number[], fwd: number[]}} seat
     */
    lean(now, view, seat) {
      if (g.closed) return null;
      const want = g.phase === 'battle' && !watching() ? 1 : 0;   // KG5: a watcher keeps the seat's own view
      const dt = g.leanAt === null ? 0 : Math.max(0, (now - g.leanAt) / 1000);
      g.leanAt = now;
      g.leanK = prefersReducedMotion() ? want : want > g.leanK ? Math.min(want, g.leanK + dt / GAMBIT_LEAN_S) : Math.max(want, g.leanK - dt / GAMBIT_LEAN_S);
      if (g.leanK <= 0) return null;
      // AUDIT KG II C5: a panel over the whole view (More's sheet on a landscape phone) keeps the last clear screen
      const clear = gambitClear(g.hud?.root?.getBoundingClientRect?.() ?? null, view, touch()) ?? g.clearShown ?? undefined;
      g.clearShown = clear ?? null;
      const L = gambitLean(g.places, { aspect: view.aspect, fovY: view.fovY, clear });
      const k = g.leanK * g.leanK * (3 - 2 * g.leanK);
      const eye = [0, 1, 2].map((i) => seat.eye[i] + (L.eye[i] - seat.eye[i]) * k);
      const f = [0, 1, 2].map((i) => seat.fwd[i] + (L.fwd[i] - seat.fwd[i]) * k), m = Math.hypot(f[0], f[1], f[2]) || 1;
      return { eye, fwd: [f[0] / m, f[1] / m, f[2] / m] };
    },
    /** The regulars in their chairs this frame - every free chair's, as the setup lists them - each with what they say. */
    regularsNow(/** @type {number} */ now) {
      return g.regs.map((r) => { const b = g.barks.get(r.name); return { name: r.name, seed: r.seed, chair: r.chair, say: b && now < b.until ? b.text : null }; });
    },
    /** The panel's box on the page (a press inside it is the panel's). */
    box: () => g.hud?.root?.getBoundingClientRect?.() ?? null,
    /** Whether a battle is under way (dealt and undecided). */
    playing: () => !g.closed && !!g.session?.playing(),
    /** AUDIT KG II C3: whether a finger the cloth took is still down; and its lift. */
    fingerHeld: () => !g.closed && g.finger,
    fingerUp() { g.finger = false; },
    /** AUDIT KG II C4: whether the board's keys are live (the battle's phase) - the pad's d-pad its cursor. */
    boardUp: () => !g.closed && g.phase === 'battle',
    /** Whether gold is down on the table - a stake held: the save waits on it, as on the Hold'em chips (5.7). */
    staked: () => !g.closed && !!g.session?.playing() && (g.game?.stake ?? 0) > 0,
    /** KG5: whether this player sits at the relay's board here. */
    seatedOnline: () => !g.closed && mySeat() >= 0,
    /** The game closes: a battle under way forfeited (the stake the regular's - every road off the seat), the panel,
     *  the draw and the cursor let go. `concede` false is a load's road: nothing settles (the save predates the deal).
     *  Once. */
    close({ concede = true } = {}) {
      if (g.closed) return;
      if (online()) standUp();   // KG5: up from the relay's board - a game under way is the other player's
      else if (concede && g.session?.playing()) { g.session.forfeit(d.now()); pump(d.now()); }
      g.closed = true;
      g.hud?.destroy();
      g.draw?.destroy();
      if (g.release?.()) d.relock?.();
    },
  };
}
