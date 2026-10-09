// @ts-check
// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 33; section 6.4: "At the same tavern table, seated the
// same way. Offline against a patron who has a deck of his own"): ILIAC HAND ON THE SEAT - the host's half of the game,
// its own module so the interior host (scenes/worldModes.js, THE FOUR HOSTS: the one with taverns) hands it what it needs
// and keeps one slot for it, as it keeps one for the Hold'em game.
//
// THE GAME'S ROADS. Sitting at a card table opens Hold'em (CARDS4); its panel offers "Play Iliac Hand" (and a pack - the
// house sells them: CARDS9). This game's panel (ui/iliacTableHud.js) asks for a deck (the binder's lawful decks the pack
// holds - ui/cardBinderPage.js deckRefusal) and a regular (the table's free chairs, each with his temper and his deck:
// systems/iliacPatrons.js, by his seed - the same deck every evening), and whether to play for a card; then it plays
// the offline game (systems/iliacTableSession.js), the cloth showing it (world/iliacCloth.js, render/iliacTableDraw.js).
// Every road off the seat closes it: a game under way is conceded (for keeps, the player's card is the regular's).
//
// FOR KEEPS - AND ONLINE. A card won from a regular is minted on this device; a realm character's or an online page's
// table plays for fun (section 14's law for the regulars' gold: a mint the service never sees), so the box is shut there.
// A regular who paid tonight plays for fun too (the forfeits' book on the character's save).
//
// THE RELAY'S TABLE (`d.online`, a relay that deals Iliac Hand). Online the panel opens on the room's table: it looks
// (a game under way is watched, the spectator's view), and "Sit at the table" sits the chosen deck in this chair - for
// the season's board when the realm vouches for it (`ranked`: the service's deck order, asked first) - and waits for a
// second player; the relay deals, runs the clock, and deals again after a game while both still sit. A ranked game's
// signed result is carried by the host's claims (net/iliacClaims.js). Alone in the room, "Play a regular instead" plays
// the offline game, friendly. Standing up stands at the relay too (a game under way conceded there).
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { IliacTableSession, forfeitsFor, forfeitsAfter } from '../systems/iliacTableSession.js';
import { patronDeck, ILIAC_TEMPER_NAMES } from '../systems/iliacPatrons.js';
import { binderOf, binderDecks, mintIliacCard, isIliacCard } from '../systems/iliacItems.js';
import { addItem } from '../systems/inventory.js';
import { deckRefusal, DECK_REFUSAL_WORDS } from '../ui/cardBinderPage.js';
import { iliacHudModel, createIliacTableHud, stagedRefusal, ILIAC_REFUSAL_WORDS } from '../ui/iliacTableHud.js';
import { iliacPlaces, iliacPoses, iliacLanded } from '../world/iliacCloth.js';
import { RemoteIliacTable } from '../systems/iliacRemoteTable.js';
import { createIliacTableDraw } from '../render/iliacTableDraw.js';
import { cardById } from '../net/iliacCards.js';
import { ILIAC_IDLE_TURNS } from '../net/iliacTable.js';

/** A regular's temper at Iliac Hand by his seed - Hold'em's three names (AUDIT CARDS-6 B9: his Hold'em temper is that
 *  evening's draw, not this). */
export const iliacTemperOf = (/** @type {number} */ seed) => ILIAC_TEMPER_NAMES[(seed >>> 0) % ILIAC_TEMPER_NAMES.length];

/** A log line for a game event (`names` the two seats', the player's first). */
export function iliacEventLine(/** @type {any} */ e, /** @type {string[]} */ names) {
  const who = (p) => (p === 0 ? 'You' : names[p] ?? 'Your opponent');
  switch (e.t) {
    case 'game': return `The holdings: ${e.holdings.map((id) => cardById(id)?.name ?? id).join(', ')}.${e.forKeeps ? ' For a card.' : ''}`;
    case 'commit': return e.p === 0 ? '' : `${who(e.p)} ${e.n ? 'commits' : 'passes'}.`;
    case 'turn': return `Turn ${e.turn}.`;
    case 'unveil': return 'The face-down cards are turned up.';
    default: return '';
  }
}

/** CARDS10: the relay's refusals of an Iliac word, as the panel says them. */
export const ILIAC_ONLINE_REFUSALS = Object.freeze({
  taken: 'Someone sits in that chair.', full: 'Two already play at this table.', seated: 'You already sit here.', 'bad deck': 'The table will not take that deck.',
  'other game': 'Hold\'em is being played at this table.', 'account seated': 'Your account already sits at a table here.', busy: 'The room is busy - try again.',
  'table differs': 'That table is laid differently.', 'deck refused': 'The realm could not vouch for that deck.', 'ranked closed': 'Ranked games are closed here.',
  'no game': 'No game is under way.', 'not seated': 'You do not sit in this game.', 'no table': 'Nobody sits at this table.',
  stale: 'Too late - that turn had already turned over.',   // AUDIT CARDS-6 C3: a commit for a turn gone
});
/** AUDIT CARDS-6 C10: a refusal's words, never a word a book merely inherits ('constructor' said a function's source). */
const wordOf = (/** @type {any} */ book, /** @type {string} */ k) => (Object.hasOwn(book, k) ? book[k] : null);

/** CARDS10: a log line for one of the relay's events (`names` the seats', `me` my seat or -1). */
export function iliacOnlineLine(/** @type {any} */ e, /** @type {(string|null)[]} */ names, /** @type {number} */ me) {
  const who = (p) => (p === me ? 'You' : names[p] ?? 'A player');
  switch (e.t) {
    case 'sit': return `${who(e.seat)} ${e.seat === me ? 'sit' : 'sits'} down to Iliac Hand.`;
    case 'leave': return e.idle ? `${e.seat === me ? 'You are' : `${e.name ?? 'A player'} is`} stood up - the clock passed ${e.seat === me ? 'you' : 'them'} ${ILIAC_IDLE_TURNS} turns running.`   // AUDIT CARDS-6 C6
      : `${e.seat === me ? 'You' : e.name ?? 'A player'} ${e.seat === me ? 'stand' : 'stands'} up.`;
    case 'gone': return `${who(e.seat)} ${e.seat === me ? 'have' : 'has'} lost the link - the seat is kept a moment.`;   // AUDIT CARDS-6 C7
    case 'back': return `${who(e.seat)} ${e.seat === me ? 'are' : 'is'} back at the table.`;
    case 'game': return `The holdings: ${e.holdings.map((id) => cardById(id)?.name ?? id).join(', ')}.${e.ranked ? ' A ranked game.' : ''}`;
    case 'commit': return e.seat === me ? (e.timeout ? 'Your time runs out - you pass.' : '') : `${who(e.seat)} ${e.timeout ? 'runs out of time and passes' : 'commits'}.`;
    case 'turn': return `Turn ${e.turn}.`;
    case 'unveil': return 'The face-down cards are turned up.';
    case 'end': return e.how === 'left' ? `${who(1 - e.winner)} ${1 - e.winner === me ? 'concede' : 'concedes'} the game.` : e.how === 'void' ? 'No contest - the game is let go.' : '';   // AUDIT CARDS-6 C7/E13
    default: return '';
  }
}

/** CARDS10: a watched game's end, as its watcher hears it (the relay's `last`). */
export function lastLineOf(/** @type {any} */ last) {
  if (!last) return null;
  if (last.how === 'void') return 'No contest - the game was let go.';   // AUDIT CARDS-6 C7/E13
  if (last.winner === null || last.winner === undefined) return 'The game is drawn.';
  const w = last.names?.[last.winner] ?? 'A player', l = last.names?.[1 - last.winner] ?? 'the other';
  return last.how === 'left' ? `${l} concedes - ${w} wins.` : `${w} beats ${l}${last.how === 'holdings' ? ' on the holdings' : last.how === 'power' ? ' on power' : ''}.`;
}

/**
 * The game, opened on the seat. Answers its handle - `press`, `frame`, `draw`, `close` - or null when the page has no
 * panel to show it on.
 * @param {{doc?: any, renderer: any, entity: any, say: (t: string) => void, holdCursor: () => (() => boolean), relock?: () => void,
 *   rand32: () => number, now: () => number, day: number|(() => number), key: string, grade: number, friendly: boolean,
 *   regulars: {name: string, seed: number, chair: number}[], frame: any, mySeatFeet: number[], chairFeet: (k: number) => number[],
 *   packPrice?: () => number|null, buyPack?: () => {ok: boolean, price: number}, onHoldem: () => void, onStand: () => void,
 *   online?: {send: (w: any) => boolean, myId: () => (string|null), table: number, chairs: number, chair: number, now: () => number,
 *     rankedWhy: () => (string|null), vouch: (deck: string[]) => Promise<{ok: boolean, order?: string, why?: string}>,
 *     board?: () => Promise<any>, welcomes?: () => number}|null}} d
 */
export function openIliacTableGame(d) {
  const g = {
    phase: /** @type {'setup'|'playing'|'over'} */ ('setup'), session: null, escrow: null, staged: [], pick: null, log: [], why: null,   // AUDIT CARDS-6 B1: `escrow` the stake held
    setup: { deck: null, foe: null, forKeeps: false }, landed: new Map(), draw: createIliacTableDraw(d.renderer, { doc: d.doc }),
    hud: null, release: d.holdCursor(), places: null, closed: false,
    // CARDS10: the relay's table - `mode` 'online' while the panel is the room's, 'regulars' once he plays the tavern's own
    mode: d.online ? 'online' : 'offline', remote: d.online ? new RemoteIliacTable({ myId: d.online.myId() }) : null,
    busy: false, sat: false, rankedOn: false, rankedLine: null, clockShown: -1, endWhy: null, board: null, boardBusy: false,
    // AUDIT CARDS-6: `seated` the relay has shown me in my chair (`sat` is a sit sent, or that); `latch` the commit in
    // flight (E3); `welcomes` my socket's welcomes seen (E5); `myGame` the last game I was dealt; a ranked seat and the
    // deck it sat (C5: vouched for again when the relay asks)
    seated: false, latch: /** @type {{gameNo: number, turn: number}|null} */ (null), welcomes: d.online?.welcomes?.() ?? 0, sitWelcome: 0, myGame: 0,
    rankedSeat: false, satDeck: /** @type {string[]|null} */ (null), vouching: false,
  };
  const online = () => g.mode === 'online';
  const mySeat = () => g.remote?.seat() ?? -1;
  // AUDIT CARDS-6 B5: the game day NOW (the host hands its clock) - read when the book is asked and when it is written,
  // never the day the panel opened (a game won past midnight, or a rest taken with the panel up, booked the old day)
  const today = () => (typeof d.day === 'function' ? d.day() : d.day);
  const decks = () => binderDecks(binderOf(d.entity.items)).map((x) => ({ name: x.name, cards: x.cards, word: (() => { const r = deckRefusal(x.cards, d.entity.items); return r ? DECK_REFUSAL_WORDS[r] ?? r : null; })() }));
  const foes = () => d.regulars.map((r) => ({ ...r, temper: iliacTemperOf(r.seed), paid: forfeitsFor(d.entity.iliacForfeits, d.key, today()).includes(r.name) }));
  const keepsWhy = () => {
    if (d.friendly) return 'Online, a regulars\' table plays for fun.';
    const f = foes()[g.setup.foe ?? -1];
    return f?.paid ? `${f.name} has paid a card tonight.` : null;
  };
  const onlineModel = (now) => {
    const r = g.remote, why = d.online.rankedWhy(), st = r.state;
    const view = r.view();
    return {
      // AUDIT CARDS-6 C5: the game's own word on whether it counts - a seat whose vouch lapsed plays its game friendly
      ranked: g.phase === 'setup' ? g.rankedOn : st?.game ? !!st.ranked : st?.last ? !!st.last.ranked : g.rankedSeat,
      rankedOn: g.rankedOn, rankedOk: !why, rankedWhy: why, busy: g.busy, regularsOk: mySeat() < 0 && !g.sat && !g.busy && d.regulars.length > 0,   // AUDIT CARDS-6 E4
      waiting: r.waiting(), watching: mySeat() < 0 && !!st?.game, clock: r.clockLeft(now), error: null, rankedLine: g.rankedLine,
      lastLine: mySeat() < 0 ? lastLineOf(st?.last) : null,   // a watched game's end, said of its players
      board: g.board, boardBusy: g.boardBusy,
      // AUDIT CARDS-6 E19/E10/E3: my sit on its way, both chairs filled (the next game deals only then), a commit in flight
      seating: g.sat && !g.seated, full: !!st?.seats?.every(Boolean),
      committing: !!g.latch && g.latch.gameNo === r.mine?.gameNo && g.latch.turn === view?.turn,
    };
  };
  const paint = () => {
    if (g.closed) return;
    if (online()) {
      const view = g.remote.view();
      g.hud.render(iliacHudModel({
        phase: g.phase, view, staged: g.staged, pick: g.pick, log: g.log, why: g.why, friendly: false, online: onlineModel(d.online.now()),
        setup: { decks: decks(), foes: [], deck: g.setup.deck, foe: null }, end: g.endWhy, packPrice: d.packPrice?.() ?? null,
      }));
      return;
    }
    const s = g.session;
    const view = s?.view() ?? null;
    g.hud.render(iliacHudModel({
      phase: g.phase, view, staged: g.staged, pick: g.pick, log: g.log, why: g.why, friendly: d.friendly,
      setup: { decks: decks(), foes: foes(), deck: g.setup.deck, foe: g.setup.foe, forKeeps: g.setup.forKeeps, keepsOk: !keepsWhy(), keepsWhy: keepsWhy() },
      end: s?.over ?? null, prize: s?.prize ?? null, packPrice: d.packPrice?.() ?? null,
    }));
  };
  /** AUDIT CARDS-6 B1: one card `id` lifted out of the pack - a stack's one minted apart (a split mints a fresh record,
   *  systems/iliacItems.js), a lone record taken whole - or null when the pack holds none. */
  const liftCard = (/** @type {any[]} */ items, /** @type {string|null} */ id) => {
    const at = id ? items.findIndex((x) => isIliacCard(x) && x.card === id) : -1;
    if (at < 0) return null;
    if ((items[at].stackCount ?? 1) > 1) { items[at].stackCount -= 1; return mintIliacCard(id); }
    return items.splice(at, 1)[0];
  };
  const deal = (now) => {
    const ds = decks(), fs = foes();
    const deck = ds[g.setup.deck ?? -1], foe = fs[g.setup.foe ?? -1];
    if (!deck || deck.word || !foe) { paint(); return; }
    const forKeeps = g.setup.forKeeps && !keepsWhy();
    g.session = new IliacTableSession({
      player: { id: 'you', name: d.entity.name || 'You', deck: deck.cards.slice() },
      patron: { id: `regular:${foe.chair}`, name: foe.name, temper: foe.temper, grade: d.grade, deck: patronDeck(foe.seed, foe.temper, d.grade) },
      rand32: d.rand32, now, forKeeps,
    });
    if (g.session.over === 'refused') { g.why = 'The table could not deal that deck.'; g.session = null; paint(); return; }
    // AUDIT CARDS-6 B1: THE STAKE HELD - the player's card for keeps, drawn at the deal, lifted out of his pack now and
    // kept by the table (`g.escrow`): home again on a win or a draw, the regular's on a loss or a concession. The binder's
    // Drop mid-game emptied the pack, and a loss then cost nothing while the table said it took a card
    g.escrow = forKeeps ? liftCard(d.entity.items, g.session.stake) : null;
    if (forKeeps && !g.escrow) { g.why = 'The table could not deal that deck.'; g.session = null; paint(); return; }
    g.places = iliacPlaces(d.frame, d.mySeatFeet, d.chairFeet(foe.chair), 0);
    g.landed.clear();
    g.phase = 'playing';
    g.staged = []; g.pick = null; g.log = []; g.why = null;
    d.say(forKeeps ? `You deal Iliac Hand with ${foe.name}, for a card - your ${cardById(g.escrow.card)?.name ?? 'card'} lies on the table.` : `You deal Iliac Hand with ${foe.name}.`);
    frame(now);
  };
  /** The game is decided (or conceded): the card that changes hands moved, the book written. AUDIT CARDS-6 B1: the
   *  player's stake left his pack at the deal - a win or a draw puts it back, a loss leaves it the regular's (said only
   *  when it was held: no take is said that did not happen). A load's road settles nothing: the save it loaded was
   *  written before the deal (it waits while a card is staked), so it holds the stake. */
  const settle = () => {
    const s = g.session;
    if (!s?.over || s.settled) return;
    s.settled = true;
    const foe = s.seats[1];
    const held = g.escrow;
    g.escrow = null;
    if (s.prize?.from === 'patron') {
      const c = mintIliacCard(s.prize.card);
      if (c) addItem(d.entity.items, c);
      if (held) addItem(d.entity.items, held);
      d.entity.iliacForfeits = forfeitsAfter(d.entity.iliacForfeits, d.key, today(), foe.name);
      d.say(`${foe.name} pays you a card: ${cardById(s.prize.card)?.name ?? 'a card'}.`);
    } else if (s.prize?.from === 'player') {
      if (held) d.say(`${foe.name} takes a card from your deck: ${cardById(held.card)?.name ?? 'a card'}.`);
    } else if (held) addItem(d.entity.items, held);   // a draw: nobody pays, the stake comes home
  };
  function frame(now) {
    if (g.closed) return;
    if (d.online) {
      // AUDIT CARDS-6 E5: a new socket (the relay's welcome again) - what the old one missed is asked for: the table as it
      // stands, which says whether my seat was kept (Hold'em's AUDIT CARDS-3 B1 way) - and whether a sit the old socket
      // carried ever landed (relay() reads the answer)
      const w = d.online.welcomes?.() ?? 0;
      if (w !== g.welcomes) {
        g.welcomes = w;
        d.online.send({ op: 'look', table: d.online.table });
      }
    }
    if (online()) {
      // the relay's clock, told once a second
      const left = g.remote.clockLeft(d.online.now());
      if (left !== g.clockShown) { g.clockShown = left; if (g.phase === 'playing') paint(); }
      return;
    }
    const s = g.session;
    if (!s) return;
    s.tick(now);
    const events = s.drain();
    for (const e of events) { const line = iliacEventLine(e, s.seats.map((x) => x.name)); if (line) g.log.push(line); }
    g.log = g.log.slice(-12);
    if (s.over && g.phase === 'playing') { g.phase = 'over'; settle(); }
    if (events.length || g.phase !== 'setup') {
      // a committed turn's staging is spent; an index past the hand (it changed) is forgotten
      const v = s.view();
      if (v?.players[0].committed || events.some((e) => e.t === 'turn')) { g.staged = []; g.pick = null; }
      if (v) iliacLanded(g.landed, v, now / 1000, false);
      if (events.length) paint();
    }
  }
  function press(id, value) {
    if (g.closed) return;
    const now = d.now();
    if (id === 'stand') { d.onStand(); return; }
    if (id === 'holdem') { d.onHoldem(); return; }
    if (id === 'pack') { const r = d.buyPack?.(); if (r) d.say(r.ok ? `You buy a pack of Iliac Hand cards for ${r.price} gold. Use it from your pack to open it.` : `A pack costs ${r.price} gold - your purse is short.`); paint(); return; }
    if (online()) { pressOnline(id, value); return; }
    if (g.phase === 'setup') {
      if (id === 'deck') g.setup.deck = value;
      else if (id === 'foe') g.setup.foe = value;
      else if (id === 'keeps') g.setup.forKeeps = !g.setup.forKeeps;
      else if (id === 'deal') { deal(now); return; }
      paint();
      return;
    }
    if (g.phase === 'over') {
      if (id === 'again') { g.phase = 'setup'; g.session = null; g.landed.clear(); g.log = []; paint(); }
      return;
    }
    const view = g.session?.view();
    if (!view) return;
    if (id === 'pick') g.pick = g.pick === value ? null : value;
    else if (id === 'hold' && g.pick !== null) {
      const next = [...g.staged, { card: g.pick, holding: value }];
      const no = stagedRefusal(view, next);
      if (no) g.why = ILIAC_REFUSAL_WORDS[no] ?? no; else { g.staged = next; g.pick = null; g.why = null; }
    } else if (id === 'unstage') g.staged = g.staged.filter((_, k) => k !== value);
    else if (id === 'clear') { g.staged = []; g.pick = null; }
    else if (id === 'commit') {
      const no = g.session.playerCommit(g.staged, now);
      if (no) g.why = ILIAC_REFUSAL_WORDS[no] ?? no;
      else { g.log.push(g.staged.length ? `You commit ${g.staged.length} ${g.staged.length === 1 ? 'play' : 'plays'}.` : 'You pass.'); g.staged = []; g.pick = null; }
      frame(now);
    }
    paint();
  }
  /** CARDS10: a press at the relay's table. */
  function pressOnline(id, value) {
    if (g.phase === 'setup') {
      // AUDIT CARDS-6 E4/E12: the setup is frozen while the realm vouches for the chosen deck - the deck, the box and the
      // regulars as they were pressed (a deck changed mid-vouch sat the old one; the regulars left a ghost seat)
      if (g.busy && id !== 'board') { paint(); return; }
      if (id === 'deck') g.setup.deck = value;
      else if (id === 'ranked') { if (!d.online.rankedWhy()) g.rankedOn = !g.rankedOn; }
      else if (id === 'regulars') { if (mySeat() < 0 && !g.sat && d.regulars.length) { g.mode = 'regulars'; g.why = null; } }
      else if (id === 'deal') { sitOnline(); return; }
      else if (id === 'board') { seasonBoard(); return; }
      paint();
      return;
    }
    const view = g.remote.view();
    if (id === 'pick') g.pick = g.pick === value ? null : value;
    else if (id === 'hold' && g.pick !== null && view) {
      const next = [...g.staged, { card: g.pick, holding: value }];
      const no = stagedRefusal(view, next);
      if (no) g.why = ILIAC_REFUSAL_WORDS[no] ?? no; else { g.staged = next; g.pick = null; g.why = null; }
    } else if (id === 'unstage') g.staged = g.staged.filter((_, k) => k !== value);
    else if (id === 'clear') { g.staged = []; g.pick = null; }
    else if (id === 'commit' && view && stagedRefusal(view, g.staged) === null) {
      // AUDIT CARDS-6 E3/C3: one commit a turn in flight, and it names the game and the turn it is for - a second press
      // before the relay's answer committed a pass for the NEXT turn (the first had turned the turn over)
      const at = { gameNo: g.remote.mine?.gameNo ?? -1, turn: view.turn };
      if (g.latch && g.latch.gameNo === at.gameNo && g.latch.turn === at.turn) { paint(); return; }
      if (d.online.send({ op: 'commit', table: d.online.table, gameNo: at.gameNo, turn: at.turn, plays: g.staged })) { g.latch = at; g.log.push(g.staged.length ? `You commit ${g.staged.length} ${g.staged.length === 1 ? 'play' : 'plays'}.` : 'You pass.'); g.why = null; }
      else g.why = 'The relay is not answering - try again.';
    }
    paint();
  }
  /** AUDIT CARDS-6 C5/D2: the relay asks (`{t: 'vouch'}`) as it schedules a ranked pair's next deal: the seat's deck
   *  vouched for again (the realm asked as the sit asked it) and said back - a refusal plays the seat friendly from now,
   *  said; the realm or the link not answering leaves the next game friendly, and the next ask asks again. */
  function revouch() {
    const deck = g.satDeck;
    if (!deck) { g.rankedSeat = false; return; }
    g.vouching = true;
    d.online.vouch(deck.slice()).then((r) => {
      g.vouching = false;
      if (g.closed || !g.rankedSeat) return;
      if (r?.ok && r.order) { d.online.send({ op: 'vouch', table: d.online.table, order: r.order }); return; }
      g.rankedSeat = false;
      g.why = `${r?.why ?? 'The realm could not vouch for that deck.'} You play friendly at this table from now.`;
      paint();
    }, () => { g.vouching = false; });
  }
  /** CARDS10: the season's board asked of the service (its rows, its #1, my standing) - shown under the setup; a second
   *  press hides it. */
  function seasonBoard() {
    if (g.board) { g.board = null; paint(); return; }
    if (!d.online.board || g.boardBusy) return;
    g.boardBusy = true; paint();
    d.online.board().then((r) => {
      g.boardBusy = false;
      if (g.closed) return;
      g.board = r?.ok && r.data ? r.data : { error: 'The season board is not answering - try again.' };
      paint();
    }, () => { g.boardBusy = false; if (!g.closed) { g.board = { error: 'The season board is not answering - try again.' }; paint(); } });
  }
  /** CARDS10: the chosen deck sat in this chair - ranked, the realm's order on it asked first. */
  function sitOnline() {
    const deck = decks()[g.setup.deck ?? -1];
    if (!deck || deck.word || g.busy) { paint(); return; }
    const go = (order) => {
      if (g.closed || !online() || g.phase !== 'setup') return;   // AUDIT CARDS-6 E4: the panel left the room's setup meanwhile - no sit
      const ok = d.online.send({ op: 'sit', table: d.online.table, chair: d.online.chair, chairs: d.online.chairs, deck: deck.cards.slice(), ...(order ? { order } : {}) });
      if (!ok) { g.why = 'The relay is not answering - try again.'; paint(); return; }
      g.sat = true; g.phase = 'playing'; g.staged = []; g.pick = null; g.why = null; g.rankedLine = null;
      g.satDeck = deck.cards.slice(); g.rankedSeat = !!order;   // AUDIT CARDS-6 C5: the deck the relay's asks vouch for again
      g.sitWelcome = g.welcomes;   // AUDIT CARDS-6 E5: the socket that carried it
      paint();
    };
    if (g.rankedOn && !d.online.rankedWhy()) {
      g.busy = true; paint();
      d.online.vouch(deck.cards.slice()).then((r) => {
        g.busy = false;
        if (g.closed) return;
        if (!r?.ok || !r.order) { g.why = r?.why ?? 'The realm could not vouch for that deck.'; paint(); return; }
        go(r.order);
      }, () => { g.busy = false; if (!g.closed) { g.why = 'The realm is not answering - try again.'; paint(); } });
      return;
    }
    go(null);
  }
  /** CARDS10: a frame of the relay's for this table (scenes/worldModes.js hands it on). */
  function relay(f) {
    // AUDIT CARDS-6 E4: the relay's table is kept in every mode - a panel gone to the regulars still knows whether the
    // relay seats it, so its close stands it up there
    if (g.closed || !d.online || f.table !== d.online.table) return;
    const now = d.now();
    const events = g.remote.apply(f, d.online.now());
    if (f.mine || typeof f.error === 'string') g.latch = null;   // AUDIT CARDS-6 E3: the commit in flight answered
    if (!online()) return;   // the tavern's own game, once chosen, is no relay's
    // AUDIT CARDS-6 E10: a watcher's phase - a game watched; between two games of a full table the last one's end; else
    // the setup, a chair free to sit in (he stood in 'over' with nothing to press but Leave)
    const watched = (st) => (st?.game ? 'playing' : st?.last && st.seats.every(Boolean) ? 'over' : 'setup');
    if (typeof f.error === 'string') {
      g.why = wordOf(ILIAC_ONLINE_REFUSALS, f.error) ?? wordOf(ILIAC_REFUSAL_WORDS, f.error) ?? f.error;   // AUDIT CARDS-6 C10
      if (mySeat() < 0 && g.sat && !g.seated) { g.sat = false; g.phase = watched(g.remote.state); }   // my sit refused
      paint();
      return;
    }
    if (typeof f.receipt === 'string') { g.rankedLine = 'The result goes to the season\'s board.'; paint(); return; }   // carried by the host's claims (scenes/worldModes.js iliacOnlineFrame)
    const me = mySeat();
    const st = g.remote.state;
    const names = st?.seats?.map((x) => x?.name ?? null) ?? [];
    let ended = false, dealt = false, asked = false;
    for (const e of events) {
      const line = iliacOnlineLine(e, names, me) || (e.t === 'commit' ? '' : iliacEventLine(e, names));
      if (line) g.log.push(line);
      if (e.t === 'game') dealt = true;
      if (e.t === 'turn') g.why = null;   // a refusal of the turn gone goes with it
      if (e.t === 'vouch') asked = true;   // AUDIT CARDS-6 C5/D2: the next ranked game deals on fresh orders
      if (e.t === 'end') {
        ended = true; g.why = null;
        g.endWhy = e.how === 'void' ? 'void' : e.how === 'left' && e.winner === me ? 'won-left' : null;
      }
    }
    g.log = g.log.slice(-12);
    // AUDIT CARDS-6 E5: a game I sit in that I was never told was dealt (a look after a new socket) is dealt all the same
    if (me >= 0 && st?.game && st.gameNo !== g.myGame) dealt = true;
    if (dealt) { g.staged = []; g.pick = null; g.endWhy = null; g.rankedLine = null; g.landed.clear(); g.places = null; g.latch = null; g.why = null; }
    if (me >= 0 && st?.game) g.myGame = st.gameNo;
    if (ended) { g.staged = []; g.pick = null; }
    // AUDIT CARDS-6 E5: the table as it stands (a look's answer: no events) after a new socket, without me in it - a sit
    // the old socket carried never landed
    if (me < 0 && g.sat && !g.seated && f.state && f.events?.length === 0 && g.sitWelcome < g.welcomes) { g.sat = false; g.why = 'The table did not hear you sit down - sit again.'; }
    // the phase is the table's: seated, a game played, or between games the end of mine, or waiting for one; my sit on
    // its way; standing, the watcher's
    if (me >= 0) { g.sat = true; g.seated = true; g.phase = st?.game ? 'playing' : g.myGame && st?.last?.gameNo === g.myGame ? 'over' : 'playing'; }
    else if (g.seated) {
      g.seated = false; g.sat = false; g.why = g.why ?? 'You are no longer seated at this table.';   // stood up by the relay (a new socket, a chair gone, the clock)
      g.phase = watched(st);
    } else if (!g.sat) g.phase = watched(st);
    if (st?.game && !g.places && st.seats.every(Boolean)) g.places = iliacPlaces(d.frame, d.chairFeet(st.seats[0].chair), d.chairFeet(st.seats[1].chair), me >= 0 ? me : 0);
    const v = g.remote.view();
    if (v?.players?.[v.viewer]?.committed) { g.staged = []; g.pick = null; }
    if (v) iliacLanded(g.landed, v, now / 1000, false);
    paint();
    if (asked && g.rankedSeat && g.seated && !g.vouching) revouch();   // AUDIT CARDS-6 C5/D2: the relay asked - answered
  }
  // the first lawful deck and the first regular, chosen for him (a press changes either)
  const lawful = decks().findIndex((x) => !x.word);
  g.setup.deck = lawful >= 0 ? lawful : null;
  g.setup.foe = d.regulars.length ? 0 : null;
  g.hud = createIliacTableHud({ onPress: press, doc: d.doc });
  paint();
  if (d.online) d.online.send({ op: 'look', table: d.online.table });   // the room's table as it stands: a game under way is watched
  return {
    g, press, frame, relay,
    /** The cloth's picture this frame (the room's own pass, after the decor). */
    draw(now) {
      const v = online() ? g.remote.view() : g.session?.view();
      if (!v || !g.places) return;
      g.draw.draw(iliacPoses(v, g.places, now / 1000, g.landed));
    },
    /** Whether a game is under way. */
    playing: () => g.phase === 'playing',
    /** Whether a game for keeps is under way - a card in play: the save waits on it, as on the Hold'em chips. */
    staked: () => !g.closed && g.phase === 'playing' && !!g.session?.forKeeps,   // AUDIT CARDS-6 B13: a closed game stakes nothing
    /** The game closes: one under way conceded (its card settled), the panel, the draw and the cursor let go. Once. */
    close({ concede = true } = {}) {
      if (g.closed) return;
      if (concede && g.session && !g.session.over) { g.session.leave(d.now()); settle(); }
      // CARDS10: up at the relay too (a game there conceded) - AUDIT CARDS-6 E11: a sit on its way included (the relay seated
      // a ghost); E13: naming the game the panel showed, so a game dealt as he pressed is not his to concede
      if (d.online && (mySeat() >= 0 || g.sat)) d.online.send({ op: 'stand', table: d.online.table, gameNo: g.remote.state?.gameNo ?? 0 });
      g.closed = true;
      g.hud?.destroy();
      g.draw?.destroy();
      if (g.release?.()) d.relock?.();
    },
  };
}
