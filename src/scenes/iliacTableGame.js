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

/** A regular's temper at Iliac Hand by his seed (one regular, one temper - Hold'em's three names). */
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
});

/** CARDS10: a log line for one of the relay's events (`names` the seats', `me` my seat or -1). */
export function iliacOnlineLine(/** @type {any} */ e, /** @type {(string|null)[]} */ names, /** @type {number} */ me) {
  const who = (p) => (p === me ? 'You' : names[p] ?? 'A player');
  switch (e.t) {
    case 'sit': return `${who(e.seat)} ${e.seat === me ? 'sit' : 'sits'} down to Iliac Hand.`;
    case 'leave': return `${e.seat === me ? 'You' : e.name ?? 'A player'} ${e.seat === me ? 'stand' : 'stands'} up.`;
    case 'game': return `The holdings: ${e.holdings.map((id) => cardById(id)?.name ?? id).join(', ')}.${e.ranked ? ' A ranked game.' : ''}`;
    case 'commit': return e.seat === me ? (e.timeout ? 'Your time runs out - you pass.' : '') : `${who(e.seat)} ${e.timeout ? 'runs out of time and passes' : 'commits'}.`;
    case 'turn': return `Turn ${e.turn}.`;
    case 'unveil': return 'The face-down cards are turned up.';
    case 'end': return e.how === 'left' ? `${who(1 - e.winner)} ${1 - e.winner === me ? 'concede' : 'concedes'} the game.` : '';
    default: return '';
  }
}

/** CARDS10: a watched game's end, as its watcher hears it (the relay's `last`). */
export function lastLineOf(/** @type {any} */ last) {
  if (!last) return null;
  if (last.winner === null || last.winner === undefined) return 'The game is drawn.';
  const w = last.names?.[last.winner] ?? 'A player', l = last.names?.[1 - last.winner] ?? 'the other';
  return last.how === 'left' ? `${l} concedes - ${w} wins.` : `${w} beats ${l}${last.how === 'holdings' ? ' on the holdings' : last.how === 'power' ? ' on power' : ''}.`;
}

/**
 * The game, opened on the seat. Answers its handle - `press`, `frame`, `draw`, `close` - or null when the page has no
 * panel to show it on.
 * @param {{doc?: any, renderer: any, entity: any, say: (t: string) => void, holdCursor: () => (() => boolean), relock?: () => void,
 *   rand32: () => number, now: () => number, day: number, key: string, grade: number, friendly: boolean,
 *   regulars: {name: string, seed: number, chair: number}[], frame: any, mySeatFeet: number[], chairFeet: (k: number) => number[],
 *   packPrice?: () => number|null, buyPack?: () => {ok: boolean, price: number}, onHoldem: () => void, onStand: () => void,
 *   online?: {send: (w: any) => boolean, myId: () => (string|null), table: number, chairs: number, chair: number, now: () => number,
 *     rankedWhy: () => (string|null), vouch: (deck: string[]) => Promise<{ok: boolean, order?: string, why?: string}>,
 *     board?: () => Promise<any>}|null}} d
 */
export function openIliacTableGame(d) {
  const g = {
    phase: /** @type {'setup'|'playing'|'over'} */ ('setup'), session: null, staged: [], pick: null, log: [], why: null,
    setup: { deck: null, foe: null, forKeeps: false }, landed: new Map(), draw: createIliacTableDraw(d.renderer, { doc: d.doc }),
    hud: null, release: d.holdCursor(), places: null, closed: false,
    // CARDS10: the relay's table - `mode` 'online' while the panel is the room's, 'regulars' once he plays the tavern's own
    mode: d.online ? 'online' : 'offline', remote: d.online ? new RemoteIliacTable({ myId: d.online.myId() }) : null,
    busy: false, sat: false, rankedOn: false, rankedLine: null, clockShown: -1, endWhy: null, board: null, boardBusy: false,
  };
  const online = () => g.mode === 'online';
  const mySeat = () => g.remote?.seat() ?? -1;
  const decks = () => binderDecks(binderOf(d.entity.items)).map((x) => ({ name: x.name, cards: x.cards, word: (() => { const r = deckRefusal(x.cards, d.entity.items); return r ? DECK_REFUSAL_WORDS[r] ?? r : null; })() }));
  const foes = () => d.regulars.map((r) => ({ ...r, temper: iliacTemperOf(r.seed), paid: forfeitsFor(d.entity.iliacForfeits, d.key, d.day).includes(r.name) }));
  const keepsWhy = () => {
    if (d.friendly) return 'Online, a regulars\' table plays for fun.';
    const f = foes()[g.setup.foe ?? -1];
    return f?.paid ? `${f.name} has paid a card tonight.` : null;
  };
  const onlineModel = (now) => {
    const r = g.remote, why = d.online.rankedWhy();
    return {
      ranked: g.rankedOn, rankedOn: g.rankedOn, rankedOk: !why, rankedWhy: why, busy: g.busy, regularsOk: mySeat() < 0 && d.regulars.length > 0,
      waiting: r.waiting(), watching: mySeat() < 0 && !!r.state?.game, clock: r.clockLeft(now), error: null, rankedLine: g.rankedLine,
      lastLine: mySeat() < 0 ? lastLineOf(r.state?.last) : null,   // a watched game's end, said of its players
      board: g.board, boardBusy: g.boardBusy,
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
    g.places = iliacPlaces(d.frame, d.mySeatFeet, d.chairFeet(foe.chair), 0);
    g.landed.clear();
    g.phase = 'playing';
    g.staged = []; g.pick = null; g.log = []; g.why = null;
    d.say(forKeeps ? `You deal Iliac Hand with ${foe.name}, for a card.` : `You deal Iliac Hand with ${foe.name}.`);
    frame(now);
  };
  /** The game is decided (or conceded): the card that changes hands moved, the book written. */
  const settle = () => {
    const s = g.session;
    if (!s?.prize || s.settled) return;
    s.settled = true;
    const foe = s.seats[1];
    if (s.prize.from === 'patron') {
      const c = mintIliacCard(s.prize.card);
      if (c) addItem(d.entity.items, c);
      d.entity.iliacForfeits = forfeitsAfter(d.entity.iliacForfeits, d.key, d.day, foe.name);
      d.say(`${foe.name} pays you a card: ${cardById(s.prize.card)?.name ?? 'a card'}.`);
    } else {
      const items = d.entity.items;
      const at = items.findIndex((x) => isIliacCard(x) && x.card === s.prize.card);
      if (at >= 0) { if ((items[at].stackCount ?? 1) > 1) items[at].stackCount -= 1; else items.splice(at, 1); }
      d.say(`${foe.name} takes a card from your deck: ${cardById(s.prize.card)?.name ?? 'a card'}.`);
    }
  };
  function frame(now) {
    if (g.closed) return;
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
      if (id === 'deck') g.setup.deck = value;
      else if (id === 'ranked') { if (!d.online.rankedWhy()) g.rankedOn = !g.rankedOn; }
      else if (id === 'regulars') { if (mySeat() < 0 && d.regulars.length) { g.mode = 'regulars'; g.why = null; } }
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
      if (d.online.send({ op: 'commit', table: d.online.table, plays: g.staged })) { g.log.push(g.staged.length ? `You commit ${g.staged.length} ${g.staged.length === 1 ? 'play' : 'plays'}.` : 'You pass.'); g.why = null; }
      else g.why = 'The relay is not answering - try again.';
    }
    paint();
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
      if (g.closed) return;
      const ok = d.online.send({ op: 'sit', table: d.online.table, chair: d.online.chair, chairs: d.online.chairs, deck: deck.cards.slice(), ...(order ? { order } : {}) });
      if (!ok) { g.why = 'The relay is not answering - try again.'; paint(); return; }
      g.sat = true; g.phase = 'playing'; g.staged = []; g.pick = null; g.why = null; g.rankedLine = null;
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
    if (g.closed || !online() || f.table !== d.online.table) return;   // the tavern's own game, once chosen, is no relay's
    const now = d.now();
    const events = g.remote.apply(f, d.online.now());
    if (typeof f.error === 'string') {
      g.why = ILIAC_ONLINE_REFUSALS[f.error] ?? ILIAC_REFUSAL_WORDS[f.error] ?? f.error;
      if (mySeat() < 0 && g.phase !== 'setup' && !g.remote.state?.game) { g.phase = 'setup'; g.sat = false; }
      paint();
      return;
    }
    if (typeof f.receipt === 'string') { g.rankedLine = 'The result goes to the season\'s board.'; paint(); return; }   // carried by the host's claims (scenes/worldModes.js iliacOnlineFrame)
    const me = mySeat();
    const names = g.remote.state?.seats?.map((x) => x?.name ?? null) ?? [];
    let ended = false, dealt = false;
    for (const e of events) {
      const line = iliacOnlineLine(e, names, me) || (e.t === 'commit' ? '' : iliacEventLine(e, names));
      if (line) g.log.push(line);
      if (e.t === 'game') dealt = true;
      if (e.t === 'end') { ended = true; g.endWhy = e.how === 'left' && e.winner === me ? 'won-left' : null; }
    }
    g.log = g.log.slice(-12);
    const st = g.remote.state;
    if (dealt) { g.staged = []; g.pick = null; g.endWhy = null; g.rankedLine = null; g.landed.clear(); g.places = null; }
    if (ended) { g.staged = []; g.pick = null; }
    // the phase is the table's: seated, waiting or playing or a game just over; standing, a game watched, or the setup
    if (me >= 0) { g.sat = true; g.phase = ended ? 'over' : dealt || g.phase === 'setup' ? 'playing' : g.phase; }
    else {
      if (g.sat) { g.sat = false; g.why = g.why ?? 'You are no longer seated at this table.'; }   // stood up by the relay (a new socket, a chair gone)
      g.phase = ended ? 'over' : st?.game ? 'playing' : g.phase === 'over' && !dealt ? 'over' : 'setup';
    }
    if (st?.game && !g.places && st.seats.every(Boolean)) g.places = iliacPlaces(d.frame, d.chairFeet(st.seats[0].chair), d.chairFeet(st.seats[1].chair), me >= 0 ? me : 0);
    const v = g.remote.view();
    if (v?.players?.[v.viewer]?.committed) { g.staged = []; g.pick = null; }
    if (v) iliacLanded(g.landed, v, now / 1000, false);
    paint();
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
    staked: () => g.phase === 'playing' && !!g.session?.forKeeps,
    /** The game closes: one under way conceded (its card settled), the panel, the draw and the cursor let go. Once. */
    close({ concede = true } = {}) {
      if (g.closed) return;
      if (concede && g.session && !g.session.over) { g.session.leave(d.now()); settle(); }
      if (d.online && mySeat() >= 0) d.online.send({ op: 'stand', table: d.online.table });   // CARDS10: up at the relay too (a game there conceded)
      g.closed = true;
      g.hud?.destroy();
      g.draw?.destroy();
      if (g.release?.()) d.relock?.();
    },
  };
}
