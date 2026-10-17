// @ts-check
// KG3 (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md sections 5.5, 14 and 16; the owner: "Ensure any of the UI is
// enhanced plus, our own coat and easily understandable/readable"): THE KING'S GAMBIT'S PANEL AT THE TAVERN TABLE - the
// third panel to wear the card tables' kit (ui/card/cardPanelKit.js, CARDS-PLUS), beside Hold'em's and Iliac Hand's: the
// setup (a regular from the free chairs, the stake, the crown), the army, the turn and the result.
//
// TWO HALVES, as the other two panels'. `gambitHudModel` is pure: the table's state as the rows, tiles, chips, lines
// and presses the panel shows - every word through the text core (ui/gambitTableWords.js), every number the law's own
// export, every press's lawfulness and the reason it is refused decided here (section 14.9, test/systems/kg3_panel.test.js).
// `createGambitTableHud` paints that model into the page and hands presses back to the table's half
// (scenes/gambitTableGame.js).
//
// THE COAT (14.1): the chrome is `cardPanelChromeCss('.dfgambit')` - the window's box, the header band and its fold, the
// line and its tones, the presses' row and their kinds, the log - and the panel's own parts are words of their own
// (`.dfgambit-<part>`) the kit paints by role (ui/enhanced/enhancedFrame.js FRAME_ROLES): this sheet writes geometry and words
// only - never a ground, a shadow or a radius on a role. TYPE (14.2): the chrome's sizes; the reading blocks 15 px at
// 1.55; chips 12, a unit's name 13, the result's headline 18 - nothing under 12. THE FINGER (14.3): every press, row and
// tile 44 px under a coarse pointer and at 480 px or less; what a hover says a press says; a press that costs gold says
// how much and asks twice. PLAIN WORDS (14.4): what this is, the next step, how it works, the words - on every stage.
//
// THE PICTURES ARE THE CARDS' (14.1): a unit's face is its card's picture alone (render/iliacCardFaces.js PICTURE - no
// gem, no shield, no rarity frame, no Iliac number beside the game's own), painted as the binder paints (cardCanvasCopy);
// a king is the Bay deck's painted King of the crown (render/cardFaces.js paintFace).
//
// Not a DFU member: Daggerfall Unity has no such game - the mod does. Ledger A row (THE KING'S GAMBIT).
import {
  KG_COLS, KG_ROWS, KG_POINT_BUDGET, KG_MAX_UNITS, KG_ACTIONS_PER_TURN, KG_POTION_HEAL, KG_ROSTER, KG_TILE, warningsArmAt,
  rosterUnit, armyCost, canRecruit, reachable, foesInRange, pieceById, pieceAt, hazardAt, tileAt, distance, rangeOf, hasLineOfSight,
} from '../net/kingsGambit.js';
import { GAMBIT_STAKE_MULTS, GAMBIT_CROWNS, crownIndex, stakeOf } from '../systems/gambit/gambitTableSession.js';
import { FOE_CARDS } from '../systems/card/cardSources.js';
import { cardById } from '../net/iliac/iliacCards.js';
import { ILIAC_CARD_ASPECT } from '../render/iliacCardFaces.js';
import { paintFace, SUIT_CROWNS, RANK_KING } from '../render/cardFaces.js';
import { cardCanvasCopy } from './card/cardBinderPage.js';
import { cardPanelChromeCss, dressCardPanel, foldWords } from './card/cardPanelKit.js';
import { PIXELIFY_FIVE_FACE } from './pixelifyFive.js';
import { noteFirstUse } from '../systems/tutorials.js';
import { DPAD_CODES } from './plus/plusPad.js';
import {
  unitName, kingName, pieceName, regularLines, stakeLabel, stakeWhat, stakePurse, stakeNight,
  kingLine, unitLine, unitCost, unitChips, armyPointsLeft, unitsHeld, armyKingLine, actionsLeft, refusalWords, cellWords,
  pieceInfoLines, gambitTitle, GAMBIT_HEADS, GAMBIT_PRESS, pressStart, pressForfeit, pressStandCost, pressDrink, pressStrike,
  potionsChip, fallenChip, healthOf, nextStep, resultHead, kingFalls, resultGold, nightSpent, gambitWhat, gambitGuide,
  gambitWords, layoutName, GAMBIT_ONLINE_PRESS, onlineHead, onlineSeat, clockChip, onlineStep, onlineEnd, watchWin,
  pressReadyStake, stakeHead, stakePick, stakeOnline, stakeChoose, boardHead, boardRow, boardYou, boardChampion, boardNeeds,
  boardReading, boardFailed, armyFull, actionsLeftOf, watchGold, armyEmpty, armySpent, stakeWhileReady, stakingWait, boardHide,
} from './gambitTableWords.js';

/** The card a unit stands as - its creature's or its calling's (systems/card/cardSources.js FOE_CARDS: every unit of the
 *  roster has one since KG-SET). @param {number} id */
export const unitCardId = (id) => FOE_CARDS[id] ?? null;

/** A tier's place on its four-step mark (a picture before a word - MENU-ORDER law 1). */
export const tierStep = (/** @type {string} */ key) => Math.max(1, ['amateur', 'seasoned', 'veteran', 'grandmaster'].indexOf(key) + 1);

/** THE GRID'S ORDER (10.2): the law's roster by cost, a cost's ties by the names the player reads (ordinal, as the mod
 *  compared them), then by id - the law keeps DFU's English order for every client and the relay. */
export function gridOrder() {
  const name = new Map(KG_ROSTER.map((u) => [u.id, unitName(u.id)]));
  return KG_ROSTER.slice().sort((a, b) => a.cost - b.cost || (name.get(a.id) < name.get(b.id) ? -1 : name.get(a.id) > name.get(b.id) ? 1 : 0) || a.id - b.id);
}

/** A PIECE'S RANGE (10.7, 14.8 - an outline alone on the cloth): the floor cells its blow or its shot reaches from where
 *  it stands - InRange's law over every cell a piece could stand on (a step for a melee piece; up to its reach along a
 *  sight line for a ranged one). @param {any} st the law's state @param {any} p a piece */
export function rangeCells(st, p) {
  /** @type {number[][]} */ const out = [];
  if (!st || !p) return out;
  const reach = rangeOf(p);
  for (let r = 0; r < KG_ROWS; r++) for (let c = 0; c < KG_COLS; c++) {
    const d = distance(p.col, p.row, c, r);
    if (d < 1 || d > reach || tileAt(st.tiles, c, r) !== KG_TILE.floor) continue;
    if (p.ranged && d > 1 && !hasLineOfSight(st.tiles, p.col, p.row, c, r)) continue;
    out.push([c, r]);
  }
  return out;
}

/** The cells a stake's pick, the night and the purse allow: each pick lawful or the reason it is not. */
export function stakePicks(/** @type {{tier: any, nightLeft: number, name: string}} */ r, /** @type {number} */ purse, /** @type {number|null} */ chosen) {
  return GAMBIT_STAKE_MULTS.map((m) => {
    const gold = stakeOf(r.tier, m);
    const why = gold > purse ? stakePurse(purse, gold) : gold > r.nightLeft ? stakeNight(r.name, r.nightLeft) : null;
    return { m, gold, label: stakeLabel(m, gold), enabled: !why, why, chosen: chosen === m && !why };
  });
}

/**
 * THE PANEL'S MODEL - pure. `p`:
 *   phase      'setup' | 'army' | 'battle' | 'over'
 *   regulars   the free chairs' regulars [{name, seed, chair, tier, nightLeft, forFun}], in tier order then chair
 *   regular    the chosen one's index, or null;  friendly  a table that plays for fun (online, a realm character)
 *   purse      the player's gold;  stakeMult  the pick (GAMBIT_STAKE_MULTS) or null;  crown  the player's crown key
 *   army       the player's units (roster ids);  pressed  the unit last pressed, or null;  said  the press's outcome
 *   game       in the battle and after: {state, crowns: [mine, theirs] (GAMBIT_CROWNS keys), name (the regular's), stake,
 *              over, dealt: [pieces at the deal, each side], nightSpent} - the law's state as the session holds it
 *   selected   the player's piece chosen, or null;  staged  {kind: 'move'|'attack', col, row, target}|null (a finger's)
 *   info       {piece: id} | {cell: [c, r]} | null - what the information box shows (a press fills it, a hover may)
 *   why        a refusal said, holding the line until the next press;  armed  'forfeit'|'stand'|null (the second press)
 *   guideOpen, wordsOpen, armiesOpen;  log  the last lines;  touch  a finger's device (a press stages);  more  the
 *              phone's sheet over the battle's strip (14.7)
 *   online     KG5 (section 18): another player across the board - {seats: [{name, ready, mine}|null, ...] the relay's
 *              two, names: [host's, guest's], canSit, ready (mine), step and stepArgs (the next step, onlineStep's),
 *              watching (a game under way, unseated), clock (the turn's seconds left, or null)}; null with the regulars
 *   canOnline  the regulars' setup offers the online board (a relay that runs the game, at the friendly table)
 *              KG6 (section 19), on `online`: gold (the red table), stakes [{n, enabled, chosen, why}] (the mod's online
 *              stakes, a pick), staking (the service asked), canBoard (the season board may be read)
 *   board      KG6: the season board as read - 'reading', 'failed', or the service's answer; boardOpen its section shown
 * @param {any} p
 */
export function gambitHudModel(p) {
  const phase = p.phase;
  const regs = (p.regulars ?? []).map((r, i) => ({ ...r, i }));
  const chosen = p.regular != null ? regs[p.regular] ?? null : null;
  const friendly = !!p.friendly;
  const forFun = friendly || !!chosen?.forFun;
  const short = !!chosen && !forFun && p.purse < chosen.tier.stake;
  const picks = chosen && !forFun ? stakePicks(chosen, p.purse, p.stakeMult) : null;
  const stake = forFun || !chosen ? 0 : picks?.find((x) => x.chosen)?.gold ?? 0;
  const game = p.game ?? null;
  const st = game?.state ?? null;
  const out = {
    phase, what: gambitWhat(), title: '', next: '', message: '', tone: '',
    // AUDIT KG II D9: at the board online, the guide's first steps and the words are another player's and the table's gold
    guide: { open: !!p.guideOpen, head: GAMBIT_HEADS.guide, paras: gambitGuide(p.online ? { gold: !!p.online.gold } : null) },
    words: { open: !!p.wordsOpen, head: GAMBIT_HEADS.words, items: gambitWords(!!p.online) },
    /** @type {any} */ setup: null, /** @type {any} */ army: null, /** @type {any} */ battle: null, /** @type {any} */ result: null,
    /** @type {any[]} */ actions: [], log: (p.log ?? []).slice(), touch: !!p.touch, more: !!p.more,
  };
  let next = 'chooseRegular', nextArgs = {};
  /** @type {string|null} */ let line = null;   // KG5: an online next step, said as it is
  const online = p.online ?? null;
  if (phase === 'setup' && online) {
    out.title = gambitTitle({ phase });
    out.setup = {
      heads: { regulars: GAMBIT_HEADS.regulars, stake: GAMBIT_HEADS.stake, crown: GAMBIT_HEADS.crown },
      online: { head: onlineHead(), seats: online.seats.map((/** @type {any} */ x) => ({ line: onlineSeat(x), mine: !!x?.mine })) },
      regulars: [], stakes: null, stakeLine: null,
      crowns: GAMBIT_CROWNS.map((key, i) => ({ key, i, name: kingName(key), chosen: crownIndex(p.crown) === i })),
      kingLine: kingLine(),
    };
    line = onlineStep(online.step, online.stepArgs);
    out.actions.push({ id: 'sit', label: GAMBIT_ONLINE_PRESS.sit, enabled: !!online.canSit, kind: 'primary', why: online.canSit ? null : onlineStep('full') });
    if (online.canBoard) out.actions.push({ id: 'board', label: p.boardOpen ? boardHide() : GAMBIT_ONLINE_PRESS.board, enabled: true });   // KG6; AUDIT KG II D18
    out.actions.push({ id: 'regulars', label: GAMBIT_ONLINE_PRESS.regulars, enabled: true });
    out.actions.push({ id: 'holdem', label: GAMBIT_PRESS.holdem, enabled: true }, { id: 'iliac', label: GAMBIT_PRESS.iliac, enabled: true });
    out.actions.push({ id: 'stand', label: GAMBIT_PRESS.stand, enabled: true, kind: 'quiet' });
  } else if (phase === 'setup') {
    out.title = gambitTitle({ phase });
    out.setup = {
      heads: { regulars: GAMBIT_HEADS.regulars, stake: GAMBIT_HEADS.stake, crown: GAMBIT_HEADS.crown },
      regulars: regs.map((r) => ({ i: r.i, name: r.name, tierKey: r.tier.key, step: tierStep(r.tier.key), chosen: chosen?.i === r.i, ...regularLines(r, friendly) })),
      stakes: picks, stakeLine: chosen && !forFun && stake ? stakeWhat(stake, chosen.name) : null,
      crowns: GAMBIT_CROWNS.map((key, i) => ({ key, i, name: kingName(key), chosen: crownIndex(p.crown) === i })),
      kingLine: kingLine(),
    };
    if (!regs.length) next = 'noRegular';
    else if (!chosen) next = 'chooseRegular';
    else if (friendly) next = 'online';
    else if (chosen.forFun) { next = 'forFun'; nextArgs = { name: chosen.name }; }
    else if (short) { next = 'short'; nextArgs = { name: chosen.name, stake: chosen.tier.stake }; }
    else if (!stake) next = 'chooseStake';
    else next = 'chooseKing';
    const ready = !!chosen && (forFun || (!short && stake > 0));
    out.actions.push({ id: 'next', label: GAMBIT_PRESS.next, enabled: ready, kind: 'primary', why: ready ? null : nextStep(next, nextArgs) });
    if (p.canOnline) out.actions.push({ id: 'online', label: GAMBIT_ONLINE_PRESS.online, enabled: true });
    out.actions.push({ id: 'holdem', label: GAMBIT_PRESS.holdem, enabled: true }, { id: 'iliac', label: GAMBIT_PRESS.iliac, enabled: true });
    out.actions.push({ id: 'stand', label: GAMBIT_PRESS.stand, enabled: true, kind: 'quiet' });
  } else if (phase === 'army') {
    const army = (p.army ?? []).slice();
    const left = KG_POINT_BUDGET - armyCost(army);
    out.title = gambitTitle({ phase });
    const pressed = p.pressed != null ? rosterUnit(p.pressed) : null;
    out.army = {
      heads: { unit: GAMBIT_HEADS.unit, grid: GAMBIT_HEADS.grid, army: GAMBIT_HEADS.army },
      chips: [armyPointsLeft(left), unitsHeld(army.length)],
      unit: pressed ? { id: pressed.id, card: unitCardId(pressed.id), name: unitName(pressed.id), line: unitLine(pressed), cost: unitCost(pressed.cost), said: p.said ?? null } : null,
      grid: gridOrder().map((u) => {
        const ok = canRecruit(army, u.id);
        return { id: u.id, card: unitCardId(u.id), name: unitName(u.id), chips: unitChips(u), ok, dim: !ok, chosen: p.pressed === u.id };
      }),
      rows: army.map((id, at) => ({ at, id, name: unitName(id), cost: unitCost(rosterUnit(id)?.cost ?? 0) }))
        .sort((a, b) => (rosterUnit(b.id)?.cost ?? 0) - (rosterUnit(a.id)?.cost ?? 0) || a.at - b.at),
      kingLine: armyKingLine(p.crown),
      remove: GAMBIT_PRESS.remove,
    };
    next = army.length ? 'start' : 'addUnit';
    // AUDIT KG II D17: a press that cannot act says why
    const fillWhy = army.length >= KG_MAX_UNITS ? armyFull() : left < Math.min(...KG_ROSTER.map((u) => u.cost)) ? armySpent() : null;
    out.actions.push({ id: 'autofill', label: GAMBIT_PRESS.autofill, enabled: !fillWhy, why: fillWhy });
    out.actions.push({ id: 'clear', label: GAMBIT_PRESS.clear, enabled: army.length > 0, why: army.length ? null : armyEmpty() });
    if (online) {
      // KG5: Ready says the army to the relay; a ready army is taken back by Not ready before it changes
      if (army.length || online.step === 'theirReady') line = onlineStep(online.step, online.stepArgs);   // the other ready: said first
      // KG6: at the gold table the stake is picked here and put down with Ready - what it wins and loses said first
      const pick = online.gold ? (online.stakes ?? []).find((/** @type {any} */ x) => x.chosen) ?? null : null;
      if (online.gold) {
        out.army.stakes = { head: stakeHead(), picks: (online.stakes ?? []).map((/** @type {any} */ x) => ({ n: x.n, label: stakePick(x.n), enabled: !!x.enabled, chosen: !!x.chosen, why: x.why ?? (online.ready ? stakeWhileReady() : null) })), line: pick ? stakeOnline(pick.n) : null };   // AUDIT KG II D17
        if (army.length && !pick && !online.ready) line = stakeChoose();
      }
      out.actions.push({ id: 'leave', label: GAMBIT_ONLINE_PRESS.leave, enabled: true });
      // AUDIT KG II B8: a pick the other seat's stake has closed says why, and Ready waits on another
      const readyWhy = !army.length ? refusalWords('empty') : online.gold && !pick ? stakeChoose() : online.gold && !pick.enabled ? pick.why : null;
      out.actions.push(online.ready
        ? { id: 'unready', label: GAMBIT_ONLINE_PRESS.unready, enabled: true, kind: 'primary' }
        : online.staking ? { id: 'ready', label: GAMBIT_ONLINE_PRESS.staking, enabled: false, kind: 'primary', why: stakingWait() }   // AUDIT KG II D17
        : { id: 'ready', label: pick ? pressReadyStake(pick.n) : GAMBIT_ONLINE_PRESS.ready, enabled: !readyWhy, kind: 'primary', why: readyWhy });
    } else {
      out.actions.push({ id: 'back', label: GAMBIT_PRESS.back, enabled: true });
      out.actions.push({ id: 'start', label: stake ? pressStart(stake) : GAMBIT_PRESS.startFun, enabled: army.length > 0, kind: 'primary', why: army.length ? null : refusalWords('empty') });
    }
    out.actions.push({ id: 'stand', label: GAMBIT_PRESS.stand, enabled: true, kind: 'quiet' });
  } else if (st) {
    const watching = !!online?.watching;   // KG5: a game watched - the host's side read as side 0, no press of the game's
    // AUDIT KG II C6: a game decided (a forfeit, a game that did not stand) is nobody's turn in the beat before its result
    const decided = !!game.decided || !!game.over;
    const crowns = game.crowns, name = game.name, mine = !watching && st.turn === 0 && !st.over && !decided;
    const names = (id) => { const pc = pieceById(st, id); return pc ? pieceName(pc, crowns) : '?'; };
    const sel = mine && p.selected != null ? pieceById(st, p.selected) : null;
    const lit = sel && sel.side === 0 ? reachable(st, sel) : [];
    const targets = sel && sel.side === 0 ? foesInRange(st, sel).map((x) => x.id) : [];
    // a press on any piece shows its range, either side's (the mod's hover - 10.7): the piece shown, else the chosen one
    const shown = p.info?.piece != null ? pieceById(st, p.info.piece) : Array.isArray(p.info?.cell) ? pieceAt(st, p.info.cell[0], p.info.cell[1]) : null;
    if (phase === 'battle') {
      // AUDIT KG II D4: a watcher's game is neither side's own - whose turn it is, by name
      out.title = gambitTitle({ phase: decided ? 'over' : phase, round: st.round, mine: !watching && st.turn === 0, name: watching ? online.names?.[st.turn] ?? '' : name });
      const fallen = [0, 1].map((s) => (game.dealt?.[s] ?? 0) - st.pieces.filter((x) => x.side === s).length);
      out.battle = {
        // AUDIT KG II D3: the phone's strip holds the clock and the actions alone, the clock first - the rest (`more`) in
        // More's sheet; D4: a watcher's actions are the side whose turn it is, by name
        chips: [
          ...(online?.clock != null ? [{ key: 'clock', text: clockChip(online.clock) }] : []),   // KG5: the relay's turn clock
          watching
            ? { key: 'actions', pips: st.actions, of: KG_ACTIONS_PER_TURN, text: actionsLeftOf(online.names?.[st.turn] ?? '', st.actions) }
            : { key: 'actions', pips: st.turn === 0 ? st.actions : 0, of: KG_ACTIONS_PER_TURN, text: actionsLeft(st.turn === 0 ? st.actions : 0) },
          // a watcher reads both sides by their players' names
          { key: 'potionsMine', more: true, text: watching ? potionsChip(false, st.potions[0], online.names?.[0] ?? '') : potionsChip(true, st.potions[0], name) },
          { key: 'potionsTheirs', more: true, text: potionsChip(false, st.potions[1], watching ? online.names?.[1] ?? '' : name) },
          { key: 'fallenMine', more: true, text: watching ? fallenChip(false, Math.max(0, fallen[0]), online.names?.[0] ?? '') : fallenChip(true, Math.max(0, fallen[0]), name) },
          { key: 'fallenTheirs', more: true, text: fallenChip(false, Math.max(0, fallen[1]), watching ? online.names?.[1] ?? '' : name) },
        ],
        layout: layoutName(st.layout),
        info: infoBox(st, p.info, crowns, name, watching ? online.names ?? null : null),   // AUDIT KG II D4: a watcher's by name
        armies: { open: !!p.armiesOpen, head: GAMBIT_HEADS.armies, sides: [0, 1].map((s) => st.pieces.filter((x) => x.side === s).map((x) => ({ id: x.id, name: names(x.id), hp: x.hp, max: x.maxHp, health: healthOf(x.hp, x.maxHp), king: x.king, selected: x.id === p.selected, mine: s === 0 }))) },
        lit, targets, range: rangeCells(st, shown ?? sel), selected: sel?.id ?? null, staged: p.staged ?? null,
      };
      if (!mine) next = st.ending ? (st.turn === 0 ? 'ending' : 'theirTurn') : 'theirTurn';
      else if (sel) next = 'piece';
      else if (warningsArmAt(st.round) === st.round && st.hazards.some((h) => !h.active)) next = 'warnings';
      else next = 'yourTurn';
      if (st.turn === 0 && st.ending) next = 'ending';
      if (decided) next = 'decided';
      nextArgs = { name, n: st.actions };
      if (watching) {
        // AUDIT KG II D2: the phone's strip holds them - and More, the sheet's door (the info, the armies, the guide)
        line = onlineStep('watch', { a: online.names?.[0] ?? '', b: online.names?.[1] ?? '' });
        out.actions.push({ id: 'regulars', label: GAMBIT_ONLINE_PRESS.regulars, enabled: true, strip: true });
        out.actions.push({ id: 'stand', label: GAMBIT_PRESS.stand, enabled: true, kind: 'quiet', strip: true });
        out.actions.push({ id: 'more', label: GAMBIT_PRESS.more, enabled: true, kind: 'quiet', strip: true, phone: true });
      }
      const staked = game.stake > 0;
      // THE STRIP (14.7): on a phone the battle's presses are the staged one and Cancel, else Drink, End turn and More -
      // `strip` marks them; Forfeit and Stand up wait in More's sheet
      if (watching) { /* the watcher's two presses, above */ } else if (p.staged && mine) {
        const s = p.staged;
        const target = s.kind === 'attack' ? pieceById(st, s.target) : null;
        out.actions.push(s.kind === 'attack' ? { id: 'strike', label: pressStrike(target ? names(target.id) : '?'), enabled: !!target, kind: 'primary', strip: true } : { id: 'move', label: GAMBIT_PRESS.moveHere, enabled: true, kind: 'primary', strip: true });
        out.actions.push({ id: 'cancel', label: GAMBIT_PRESS.cancel, enabled: true, strip: true });
      } else {
        if (sel) {
          const healed = Math.min(KG_POTION_HEAL, sel.maxHp - sel.hp);
          const why = sel.hp >= sel.maxHp ? refusalWords('full', { piece: names(sel.id) }) : st.potions[0] <= 0 ? refusalWords('potions') : null;
          out.actions.push({ id: 'drink', label: pressDrink(names(sel.id), healed), enabled: !why, why, strip: true });
          if (p.touch) out.actions.push({ id: 'cancel', label: GAMBIT_PRESS.cancel, enabled: true, strip: true });   // a finger has no Escape
        }
        out.actions.push({ id: 'end', label: GAMBIT_PRESS.endTurn, enabled: mine && !st.ending, kind: 'primary', why: mine ? null : st.turn === 0 && st.ending ? refusalWords('ending') : refusalWords('turn'), strip: true });
      }
      if (!watching) {
        out.actions.push({ id: 'forfeit', label: p.armed === 'forfeit' ? GAMBIT_PRESS.armed : staked ? pressForfeit(game.stake) : GAMBIT_PRESS.forfeitFun, enabled: !decided, kind: 'warn', armed: p.armed === 'forfeit' });
        out.actions.push({ id: 'stand', label: p.armed === 'stand' ? GAMBIT_PRESS.armed : staked ? pressStandCost(game.stake) : GAMBIT_PRESS.stand, enabled: true, kind: 'warn', armed: p.armed === 'stand' });
        out.actions.push({ id: 'more', label: GAMBIT_PRESS.more, enabled: true, kind: 'quiet', strip: true, phone: true });   // the phone's alone - its sheet's door
      }
    } else {
      out.title = gambitTitle({ phase: 'over' });
      const over = game.over ?? { winner: null, by: 'void' };
      const fallenCrown = over.winner === 0 ? crowns[1] : over.winner === 1 ? crowns[0] : null;
      out.result = {
        head: watching && over.winner !== null && over.by !== 'void' ? watchWin(online.names?.[over.winner] ?? '') : resultHead(over),
        tone: watching ? '' : over.winner === 0 ? 'won' : over.winner === 1 ? 'lost' : '',
        king: over.by === 'king' && fallenCrown ? kingFalls(fallenCrown) : null,
        why: online && !watching ? onlineEnd(over, name) : null,
        gold: watching ? watchGold(over, game.pot ?? 0, online.names ?? []) : resultGold(over, game.stake, name),   // AUDIT KG II B4 + D5: a watcher's gold is not in it - the pot's, said as the players'
        night: game.nightSpent ? nightSpent(name) : null,
      };
      next = 'over';
      if (online) {
        // KG5: another game is the army built again and Ready said again; or the regulars
        if (!watching) { line = onlineStep('over'); out.actions.push({ id: 'again', label: GAMBIT_PRESS.again, enabled: true, kind: 'primary' }); }
        else {
          line = onlineStep(online.step, online.stepArgs);
          // AUDIT KG II B7: the step a watcher is told - a seat free - is a press here
          if (online.canSit) out.actions.push({ id: 'sit', label: GAMBIT_ONLINE_PRESS.sit, enabled: true, kind: 'primary' });
        }
        if (online.canBoard) out.actions.push({ id: 'board', label: p.boardOpen ? boardHide() : GAMBIT_ONLINE_PRESS.board, enabled: true });   // KG6; AUDIT KG II D18: open, it hides
        out.actions.push({ id: 'regulars', label: GAMBIT_ONLINE_PRESS.regulars, enabled: true });
      } else {
        out.actions.push({ id: 'again', label: GAMBIT_PRESS.again, enabled: true, kind: 'primary' });
        out.actions.push({ id: 'army', label: GAMBIT_PRESS.changeArmy, enabled: true });
        out.actions.push({ id: 'regulars', label: GAMBIT_PRESS.otherRegular, enabled: true });
      }
      out.actions.push({ id: 'stand', label: GAMBIT_PRESS.leave, enabled: true, kind: 'quiet' });
    }
  }
  // KG6: THE SEASON BOARD, as read - a top ten, the reader's own, its Grandmaster, what the title needs
  if (online && p.boardOpen && p.board) {
    const b = p.board;
    out.board = b === 'reading' || b === 'failed' ? { head: GAMBIT_ONLINE_PRESS.board, rows: [], lines: [b === 'reading' ? boardReading() : boardFailed()] }
      : { head: boardHead(b.season?.n ?? 0), rows: (b.rows ?? []).map((/** @type {any} */ r) => ({ line: boardRow(r), you: !!r.you })), lines: [boardYou(b.me && b.me.games ? { ...b.me, rank: (b.rows ?? []).concat(b.pinned ? [b.pinned] : []).find((/** @type {any} */ r) => r.you)?.rank ?? 0 } : null), boardChampion(b.champion?.name ?? null), boardNeeds(b.titleNeeds?.games ?? 0, b.titleNeeds?.foes ?? 0)] };
  }
  out.next = line ?? nextStep(next, nextArgs);
  out.message = p.why ?? out.next;
  // the line's tone is the chrome's three (a refusal, your turn, theirs): the line says the next step - at the end too,
  // where the verdict is the result box's own (its head's dfgambit-won / -lost)
  out.tone = p.why ? 'warn' : phase === 'battle' && !online?.watching && st?.turn === 0 && !st.ending ? 'turn' : phase === 'battle' ? 'wait' : '';
  return out;
}

/** THE INFORMATION BOX (14.5): a piece - its picture, name, side, numbers, reach, foes in reach, a king's warning; or a
 *  cell - its ground or its hazard. Null when nothing is chosen. */
export function infoBox(/** @type {any} */ st, /** @type {any} */ info, /** @type {string[]} */ crowns, /** @type {string} */ regular, /** @type {string[]|null} */ names = null) {
  if (!info) return null;
  if (info.piece != null) {
    const pc = pieceById(st, info.piece);
    if (!pc) return null;
    const name = pc.king ? kingName(crowns[pc.side]) : pieceName(pc, crowns);   // the box's head: a king's whole title
    // AUDIT KG II C8: the foes it can strike now named, and its own cell's hazard (14.5)
    const hz = hazardAt(st, pc.col, pc.row);
    const hazard = hz ? cellWords({ tile: tileAt(st.tiles, pc.col, pc.row), hazard: hz, round: warningsArmAt(st.round) }) : null;
    const foes = foesInRange(st, pc).map((x) => (x.king ? kingName(crowns[x.side]) : pieceName(x, crowns)));
    // AUDIT KG II D4: a watcher's piece is neither's own - each side its player's, by name (`names`)
    return { kind: 'piece', id: pc.id, card: pc.king ? null : unitCardId(pc.unit), crown: pc.king ? crowns[pc.side] : null, name, lines: pieceInfoLines({ name, mine: !names && pc.side === 0, regular: names ? names[pc.side] ?? '' : regular, piece: pc, foes, hazard }) };
  }
  if (Array.isArray(info.cell)) {
    const [c, r] = info.cell;
    if (tileAt(st.tiles, c, r) < 0) return null;
    const pc = pieceAt(st, c, r);
    if (pc) return infoBox(st, { piece: pc.id }, crowns, regular, names);
    const hz = hazardAt(st, c, r);
    const armsAt = warningsArmAt(st.round);
    return { kind: 'cell', col: c, row: r, lines: [cellWords({ tile: tileAt(st.tiles, c, r), hazard: hz, round: armsAt })] };
  }
  return null;
}

// ── THE PAINTER ───────────────────────────────────────────────────────────────────────────────────────────────────

const STYLE_ID = 'dfgambit-style';
/** MEASURE (KG3): a grid tile's picture, the unit shown large, a crown's King - CSS px tall. */
export const GAMBIT_TILE_H = 64;
export const GAMBIT_UNIT_H = 132;
export const GAMBIT_CROWN_H = 84;
const cardW = (/** @type {number} */ h) => Math.round(h * ILIAC_CARD_ASPECT);

/** THE PANEL'S SHEET - geometry and words only (14.1): the kit paints every role, its states too (a tile's chosen is
 *  its `aria-pressed`, a list row's its `.on` - ui/enhanced/enhancedFrame.js). The game's own marks that are no role - the
 *  actions' pips, a tier's four steps, the armed press's ring - are written here, in the kit's brass and blood. THE
 *  DESKTOP: a column at the right on a wide screen, the cloth left clear (Iliac Hand's). THE PHONE (14.7): at 480 px
 *  wide or less, or 480 px tall, the setup, the army and the result a sheet from the foot - its header and presses
 *  fixed, its body scrolling, 16 px gutters, no taller than 70% of a portrait screen - and the battle a strip no taller
 *  than a quarter of it (in landscape a column at the right, 30% of the width): the next step, one row of chips, the
 *  strip's presses; More opens the rest as the sheet. A landscape phone's sheet and column are bounded by the chrome's
 *  own height (one home for the bound, CARDS-PLUS). */
export const GAMBIT_TABLE_CSS = `
${PIXELIFY_FIVE_FACE}
${cardPanelChromeCss('.dfgambit')}
.dfgambit{left:50%;bottom:18px;transform:translateX(-50%);width:min(760px,calc(100vw - 32px))}
@media (min-width:1100px){.dfgambit{left:auto;right:16px;transform:none;width:560px}}
.dfgambit:focus{outline:none}
.dfgambit.collapsed .dfgambit-body{display:none}
.dfgambit-block{margin:0 0 8px;font-size:15px;line-height:1.55}
.dfgambit-what{color:var(--cp-word)}
.dfgambit-sec{margin:8px 0 0;padding:6px 8px 8px;border-width:2px;border-style:solid}
.dfgambit-sec > h3, .dfgambit-sec > summary{margin:0 0 6px;padding:0 0 4px;font:inherit;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;border-bottom-width:2px;border-bottom-style:solid;cursor:default}
.dfgambit-sec > summary{cursor:pointer;min-height:32px}
.dfgambit-list{display:flex;flex-direction:column;gap:6px}
.dfgambit-regular{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:start;padding:6px 8px;min-height:44px;border-width:2px;border-style:solid;cursor:pointer}
.dfgambit-seat,.dfgambit-rank{padding:4px 8px;border-left:2px solid var(--cp-dim)}
.dfgambit-seat.on,.dfgambit-rank.on{border-left-color:#f3cf86;color:#efe0b8}
.dfgambit-regname{font-size:15px;color:#efe0b8}
.dfgambit-line{font-size:15px;line-height:1.55}
.dfgambit-dim{color:var(--cp-dim)}
.dfgambit-tiles{display:flex;flex-wrap:wrap;gap:8px}
.dfgambit-stake, .dfgambit-crown{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:96px;min-height:44px;padding:6px 10px;border-width:2px;border-style:solid;cursor:pointer;font-size:14px}
.dfgambit-stake[aria-disabled="true"], .dfgambit-unit.dfgambit-off .dfgambit-cost{color:var(--cp-dim)}
.dfgambit-crown canvas{display:block;width:${cardW(GAMBIT_CROWN_H)}px;height:${GAMBIT_CROWN_H}px}
.dfgambit-chips{display:flex;flex-wrap:wrap;gap:4px 6px;margin:0 0 6px}
.dfgambit-chip{display:inline-flex;align-items:center;gap:4px;padding:1px 6px;font-size:12px;border-width:1px;border-style:solid}
.dfgambit-pips{display:inline-flex;gap:3px}
.dfgambit-pip{display:inline-block;width:9px;height:9px;transform:rotate(45deg);background:rgba(4,5,7,.8);box-shadow:0 0 0 1px #050608,inset 0 0 0 1px #5a5446}
.dfgambit-pip.dfgambit-lit{background:#f3cf86;box-shadow:0 0 0 1px #050608}
.dfgambit-step{display:inline-flex;gap:2px;vertical-align:middle;margin-right:4px}
.dfgambit-step i{display:inline-block;width:6px;height:10px;background:rgba(4,5,7,.8);box-shadow:0 0 0 1px #050608,inset 0 0 0 1px #7a5424}
.dfgambit-step i.dfgambit-lit{background:#c9a24a}
.dfgambit-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px}
.dfgambit-unit{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 4px;min-height:44px;border-width:2px;border-style:solid;cursor:pointer;text-align:center}
.dfgambit-unit canvas{display:block;width:${cardW(GAMBIT_TILE_H)}px;height:${GAMBIT_TILE_H}px}
.dfgambit-uname{font-size:13px;line-height:1.25;overflow-wrap:anywhere}
.dfgambit-unit .dfgambit-chips{justify-content:center;margin:0}
.dfgambit-face{display:flex;gap:12px;align-items:flex-start;padding:6px;border-width:2px;border-style:solid}
.dfgambit-face canvas{display:block;flex:none;width:${cardW(GAMBIT_UNIT_H)}px;height:${GAMBIT_UNIT_H}px}
.dfgambit-armyrow, .dfgambit-piece{display:flex;align-items:center;gap:8px;padding:4px 8px;min-height:44px;border-width:2px;border-style:solid}
.dfgambit-armyrow .dfgambit-grow, .dfgambit-piece .dfgambit-grow{flex:1 1 auto;min-width:0}
.dfgambit-piece{cursor:pointer}
.dfgambit-meter{display:block;width:96px;height:10px;border-width:1px;border-style:solid}
.dfgambit-fill{display:block;height:100%}
.dfgambit-info{margin:8px 0 0;padding:6px 8px;border-width:2px;border-style:solid;font-size:15px;line-height:1.55}
.dfgambit-result{margin:8px 0 0;padding:8px;border-width:2px;border-style:solid}
.dfgambit-head{font-size:18px;line-height:1.3;margin:0 0 6px;color:#efe0b8}
.dfgambit-head.dfgambit-won{color:#f3cf86}
.dfgambit-head.dfgambit-lost{color:var(--cp-red)}
.dfgambit-term{color:#f3cf86;font-size:15px}
.dfgambit-para{margin:0 0 6px}
.dfgambit button[aria-disabled="true"]{color:var(--cp-dim)}
.dfgambit button[data-armed="true"]{outline:2px solid #e0584a;outline-offset:1px}
.dfgambit [tabindex="0"]:focus-visible,.dfgambit button:focus-visible,.dfgambit summary:focus-visible{outline:2px solid #f3cf86;outline-offset:2px}
.dfgambit-chiprow{flex-wrap:wrap}
.dfgambit .tableacts button[data-phone]{display:none}
@media (pointer:coarse){.dfgambit-regular,.dfgambit-stake,.dfgambit-crown,.dfgambit-unit,.dfgambit-armyrow,.dfgambit-piece,.dfgambit-sec > summary,.dfgambit .tableacts button{min-height:44px}}
@media (max-width:480px),(max-height:480px){
.dfgambit{left:0;right:0;bottom:0;transform:none;width:auto;padding:0 16px 10px;display:flex;flex-direction:column;overflow:hidden}
.dfgambit .tablehead{margin:0 -16px 8px;padding:7px 16px 6px}
.dfgambit .tablehead,.dfgambit .dfgambit-chiprow,.dfgambit .msg,.dfgambit .tableacts,.dfgambit .log{flex:none}
.dfgambit-body{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain}
.dfgambit-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.dfgambit-regular,.dfgambit-stake,.dfgambit-crown,.dfgambit-unit,.dfgambit-armyrow,.dfgambit-piece,.dfgambit-sec > summary,.dfgambit .tableacts button{min-height:44px}
.dfgambit-face{flex-direction:column}
.dfgambit .tableacts button[data-phone]{display:inline-block}
.dfgambit.dfgambit-battle:not(.dfgambit-more){overflow:auto}
.dfgambit.dfgambit-battle:not(.dfgambit-more) .tablehead,.dfgambit.dfgambit-battle:not(.dfgambit-more) .dfgambit-body,.dfgambit.dfgambit-battle:not(.dfgambit-more) .log,.dfgambit.dfgambit-battle:not(.dfgambit-more) .tableacts button:not([data-strip]){display:none}
.dfgambit.dfgambit-battle:not(.dfgambit-more) .dfgambit-chiprow{flex-wrap:wrap}
.dfgambit.dfgambit-battle:not(.dfgambit-more) .dfgambit-chip[data-more]{display:none}
.dfgambit.dfgambit-battle:not(.dfgambit-more) .msg{margin-top:8px}
}
@media (max-width:480px){
.dfgambit{max-height:70vh}
.dfgambit.dfgambit-battle:not(.dfgambit-more){max-height:25vh}
}
@media (max-height:480px) and (min-width:481px){
.dfgambit.dfgambit-battle:not(.dfgambit-more){left:auto;right:0;width:30vw}
.dfgambit.dfgambit-battle:not(.dfgambit-more) .dfgambit-chiprow{flex-wrap:wrap}
}
@media (prefers-reduced-motion:reduce){.dfgambit *{transition:none}}
`;

/** A press on the panel is the panel's - never a swing, a look or a step off the seat (the other two panels' law). */
const swallowPresses = (/** @type {any} */ node) => {
  const swallow = (/** @type {any} */ e) => e.stopPropagation();
  for (const k of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) node.addEventListener(k, swallow);
};

/**
 * The panel in the page. `onPress(id, value)`: 'regular', 'stake', 'crown', 'unit' (a roster id), 'remove' (an army
 * index), 'piece' (a piece's number), 'next', 'holdem', 'iliac', 'autofill', 'clear', 'back', 'start', 'drink', 'end',
 * 'move', 'strike', 'cancel', 'forfeit', 'stand', 'more', 'again', 'army', 'regulars', 'guide', 'words', 'armies' and
 * 'say' (a refused press: its reason as `value`). `render(model)` repaints; `destroy()` takes it away (once).
 * @param {{onPress: (id: string, value?: any) => void, doc?: any}} p
 */
export function createGambitTableHud({ onPress, doc = globalThis.document }) {
  if (doc?.getElementById && !doc.getElementById(STYLE_ID)) {
    const s = doc.createElement('style');
    s.id = STYLE_ID; s.textContent = GAMBIT_TABLE_CSS;
    (doc.head ?? doc.body)?.append(s);
  }
  dressCardPanel(doc);   // the kit on the classic skin, the face on every skin (CARDS-PLUS)
  noteFirstUse('kings-gambit');   // 14.5: the page's first sight inside the panel's own painter (TUT1)
  const root = doc.createElement('div');
  root.className = 'dfgambit';
  root.setAttribute('tabindex', '-1');
  swallowPresses(root);
  // Tab walks the panel, and Space and Enter on it are the panel's - never the game's jump, which stands the player up
  root.addEventListener('keydown', (/** @type {any} */ e) => { if (e.key === 'Tab' || e.key === ' ' || e.key === 'Enter') e.stopPropagation?.(); });
  doc.body?.append(root);
  try { root.focus?.({ preventScroll: true }); } catch { /* a page that cannot focus */ }
  const el = (/** @type {string} */ tag, /** @type {string|null} */ cls, /** @type {any} */ text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const ACTIVATE = new Set(['Enter', ' ']);
  const pressable = (/** @type {any} */ n, /** @type {string} */ key, /** @type {() => void} */ fn) => {
    n.setAttribute('tabindex', '0');
    n.setAttribute('role', 'button');
    n.setAttribute('data-focus', key);
    n.addEventListener('click', fn);
    n.addEventListener('keydown', (/** @type {any} */ e) => { if (!ACTIVATE.has(e.key)) return; e.preventDefault?.(); e.stopPropagation?.(); fn(); });
  };
  const focusedKey = () => { const a = doc.activeElement; return a && a !== root && root.contains?.(a) ? a.getAttribute?.('data-focus') ?? null : null; };
  const refocus = (/** @type {string|null} */ key) => {
    if (!key) return;
    const keyed = [];
    const walk = (/** @type {any} */ n) => { for (const c of n.children ?? []) { if (c.getAttribute?.('data-focus')) keyed.push(c); walk(c); } };
    walk(root);
    const took = (/** @type {any} */ n) => { try { n.focus({ preventScroll: true }); } catch { n.focus?.(); } return doc.activeElement === n; };
    const at = keyed.find((n) => n.getAttribute('data-focus') === key);
    if (at && took(at)) return;
    took(root);
  };
  const canPaint = !!doc.createElement('canvas')?.getContext?.('2d');
  /** A unit's picture (its card's, picture-only), a fresh copy for each place it stands. */
  const unitFace = (/** @type {string|null} */ cardId, /** @type {number} */ h) => (canPaint && cardId ? cardCanvasCopy(doc, cardById(cardId), h, { picture: true }) : null);
  /** A crown's King, the Bay deck's own painting. */
  const kingFace = (/** @type {string} */ crown, /** @type {number} */ h) => {
    if (!canPaint) return null;
    const cv = doc.createElement('canvas'), dpr = Math.min(2, Number(globalThis.devicePixelRatio) || 1), w = cardW(h);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    try { ctx.scale(dpr, dpr); paintFace(ctx, crownIndex(crown) * 13 + RANK_KING, w, h); } catch { /* a face that will not paint is a blank one */ }
    return cv;
  };
  const sec = (/** @type {string} */ head, /** @type {any[]} */ parts) => { const s = el('div', 'dfgambit-sec', null); s.append(el('h3', null, head), ...parts); return s; };
  const fold = (/** @type {string} */ id, /** @type {string} */ head, /** @type {boolean} */ open, /** @type {any[]} */ parts) => {
    const d = el('details', 'dfgambit-sec', null);
    d.open = open;
    const s = el('summary', null, head);
    s.setAttribute('data-focus', `fold-${id}`);
    // the reader's own choice, from the summary's press - never the `toggle` event (AUDIT PLAIN-UI C1)
    s.addEventListener('click', (/** @type {any} */ e) => { e.preventDefault?.(); onPress(id, !d.open); });
    s.addEventListener('keydown', (/** @type {any} */ e) => { if (!ACTIVATE.has(e.key)) return; e.preventDefault?.(); e.stopPropagation?.(); onPress(id, !d.open); });
    d.append(s, ...parts);
    return d;
  };
  const chips = (/** @type {string[]} */ words, /** @type {string} */ cls = '') => { const c = el('div', 'dfgambit-chips', null); for (const w of words) c.append(el('span', `dfgambit-chip${cls}`, w)); return c; };
  let alive = true, shownKey = null, msgEl = null, collapsed = false, lastModel = null;
  /** The root's words: the panel, folded, the battle (the phone's strip), More's sheet over it. */
  const rootWords = (/** @type {any} */ m) => ['dfgambit', collapsed ? 'collapsed' : '', m?.phase === 'battle' ? 'dfgambit-battle' : '', m?.more ? 'dfgambit-more' : ''].filter(Boolean).join(' ');
  const foldToggle = () => {
    const f = el('span', 'fold', collapsed ? '+' : '−');
    const say = () => { f.textContent = collapsed ? '+' : '−'; foldWords(f, collapsed); f.setAttribute('aria-expanded', String(!collapsed)); };
    say();
    pressable(f, 'fold', () => { collapsed = !collapsed; root.className = rootWords(lastModel); say(); });
    return f;
  };
  return {
    root,
    /** @param {any} m */
    render(m) {
      if (!alive) return;
      lastModel = m;
      const key = JSON.stringify({ ...m, message: null });
      if (key === shownKey && msgEl) { msgEl.textContent = m.message; return; }
      shownKey = key;
      const kept = focusedKey();
      root.replaceChildren();
      root.className = rootWords(m);
      const head = el('h3', 'tablehead', null);
      head.append(el('span', 'tabletitle', m.title), foldToggle());
      root.append(head);
      if (m.battle) {   // the turn's chips stand outside the body: the phone's strip shows them (14.7)
        const row = el('div', 'dfgambit-chips dfgambit-chiprow', null);
        for (const c of m.battle.chips) {
          const n = el('span', 'dfgambit-chip', null);
          if (c.key === 'actions') {
            const pips = el('span', 'dfgambit-pips', null);
            pips.setAttribute('aria-hidden', 'true');   // the words beside them say it
            for (let k = 0; k < c.of; k++) pips.append(el('i', `dfgambit-pip${k < c.pips ? ' dfgambit-lit' : ''}`, null));
            n.append(pips);
          }
          n.append(el('span', null, c.text));
          if (c.more) n.setAttribute('data-more', 'true');   // AUDIT KG II D3: More's sheet's, not the phone's strip
          row.append(n);
        }
        root.append(row);
      }
      const body = el('div', 'dfgambit-body', null);
      body.append(el('p', 'dfgambit-block dfgambit-what', m.what));
      if (m.setup) {
        const s = m.setup;
        const list = el('div', 'dfgambit-list', null);
        // KG5: online, the board's two seats in the regulars' place - who sits, who is ready, the player's own marked
        if (s.online) for (const x of s.online.seats) list.append(el('div', `dfgambit-seat${x.mine ? ' on' : ''}`, x.line));   // AUDIT KG II D18: a seat is read, never pressed
        for (const r of s.regulars) {
          const row = el('div', `dfgambit-regular${r.chosen ? ' on' : ''}`, null);   // a chosen list row is the kit's .on
          row.setAttribute('aria-pressed', String(!!r.chosen));
          const step = el('span', 'dfgambit-step', null);
          step.setAttribute('aria-hidden', 'true');   // a picture beside the tier's word, which says it
          for (let k = 1; k <= 4; k++) step.append(el('i', k <= r.step ? 'dfgambit-lit' : null, null));
          const tierChip = el('span', 'dfgambit-chip', null);
          tierChip.append(step, el('span', null, r.tier));
          const words = el('div', null, null);
          words.append(el('div', 'dfgambit-regname', r.name), el('div', 'dfgambit-line', r.fields), el('div', 'dfgambit-line', r.least), el('div', 'dfgambit-line dfgambit-dim', r.blurb), el('div', 'dfgambit-line', r.night));
          row.append(tierChip, words);
          pressable(row, `regular-${r.i}`, () => onPress('regular', r.i));
          list.append(row);
        }
        body.append(sec(s.online ? s.online.head : s.heads.regulars, [list]));
        if (s.stakes) {
          const tiles = el('div', 'dfgambit-tiles', null);
          for (const k of s.stakes) {
            const n = el('div', 'dfgambit-stake', k.label);
            n.setAttribute('aria-pressed', String(!!k.chosen));
            if (!k.enabled) n.setAttribute('aria-disabled', 'true');
            pressable(n, `stake-${k.m}`, () => (k.enabled ? onPress('stake', k.m) : onPress('say', k.why)));
            tiles.append(n);
          }
          const parts = [tiles];
          if (s.stakeLine) parts.push(el('p', 'dfgambit-line', s.stakeLine));
          body.append(sec(s.heads.stake, parts));
        }
        const crowns = el('div', 'dfgambit-tiles', null);
        for (const c of s.crowns) {
          const n = el('div', 'dfgambit-crown', null);
          const face = kingFace(c.key, GAMBIT_CROWN_H);
          if (face) n.append(face);
          n.append(el('span', null, c.name));
          n.setAttribute('aria-pressed', String(!!c.chosen));
          pressable(n, `crown-${c.i}`, () => onPress('crown', c.i));
          crowns.append(n);
        }
        body.append(sec(s.heads.crown, [crowns, el('p', 'dfgambit-line', s.kingLine)]));
      }
      if (m.army) {
        const a = m.army;
        if (a.stakes) {   // KG6: the gold table's stake picks - AUDIT KG II D14: first, where the line that asks for them is read
          const tiles = el('div', 'dfgambit-tiles', null);
          for (const k of a.stakes.picks) {
            const n = el('div', 'dfgambit-stake', k.label);
            n.setAttribute('aria-pressed', String(!!k.chosen));
            if (!k.enabled) n.setAttribute('aria-disabled', 'true');
            pressable(n, `stake-${k.n}`, () => (k.enabled ? onPress('stake', k.n) : onPress('say', k.why)));
            tiles.append(n);
          }
          body.append(sec(a.stakes.head, a.stakes.line ? [tiles, el('p', 'dfgambit-line', a.stakes.line)] : [tiles]));
        }
        body.append(chips(a.chips));
        if (a.unit) {
          const face = el('div', 'dfgambit-face', null);
          const cv = unitFace(a.unit.card, GAMBIT_UNIT_H);
          if (cv) face.append(cv);
          const words = el('div', null, null);
          words.append(el('div', 'dfgambit-regname', a.unit.name), el('div', 'dfgambit-line', a.unit.line), el('div', 'dfgambit-line', a.unit.cost));
          if (a.unit.said) words.append(el('div', 'dfgambit-line', a.unit.said));
          face.append(words);
          body.append(sec(a.heads.unit, [face]));
        }
        const grid = el('div', 'dfgambit-grid', null);
        for (const u of a.grid) {
          const tile = el('div', `dfgambit-unit${u.dim ? ' dfgambit-off' : ''}`, null);
          const cv = unitFace(u.card, GAMBIT_TILE_H);
          if (cv) tile.append(cv);
          tile.append(el('div', 'dfgambit-uname', u.name));
          const c = el('div', 'dfgambit-chips', null);
          u.chips.forEach((w, k) => c.append(el('span', `dfgambit-chip${k === u.chips.length - 1 ? ' dfgambit-cost' : ''}`, w)));
          tile.append(c);
          tile.setAttribute('aria-pressed', String(!!u.chosen));
          pressable(tile, `unit-${u.id}`, () => onPress('unit', u.id));
          grid.append(tile);
        }
        body.append(sec(a.heads.grid, [grid]));
        const rows = el('div', 'dfgambit-list', null);
        for (const r of a.rows) {
          const row = el('div', 'dfgambit-armyrow', null);
          const rm = el('button', null, a.remove);
          rm.setAttribute('data-focus', `remove-${r.at}`);
          rm.addEventListener('click', () => onPress('remove', r.at));
          row.append(el('span', 'dfgambit-grow', r.name), el('span', 'dfgambit-dim', r.cost), rm);
          rows.append(row);
        }
        body.append(sec(a.heads.army, [rows, el('p', 'dfgambit-line', a.kingLine)]));
      }
      if (m.battle) {
        const b = m.battle;
        if (b.info) {
          const box = el('div', 'dfgambit-info', null);
          const top = el('div', 'dfgambit-face', null);
          const cv = b.info.card ? unitFace(b.info.card, GAMBIT_TILE_H) : b.info.crown ? kingFace(b.info.crown, GAMBIT_TILE_H) : null;
          if (cv) top.append(cv);
          const words = el('div', null, null);
          for (const line of b.info.lines) words.append(el('div', 'dfgambit-line', line));
          top.append(words);
          box.append(top);
          body.append(box);
        }
        const sides = el('div', 'dfgambit-list', null);
        for (const side of b.armies.sides) for (const pc of side) {
          const r = el('div', `dfgambit-piece${pc.selected ? ' on' : ''}`, null);
          r.setAttribute('aria-pressed', String(!!pc.selected));
          const meter = el('span', 'dfgambit-meter', null), fill = el('span', 'dfgambit-fill', null);
          fill.style && (fill.style.width = `${Math.round((100 * Math.max(0, pc.hp)) / Math.max(1, pc.max))}%`);
          meter.append(fill);
          r.append(el('span', 'dfgambit-grow', pc.name), meter, el('span', 'dfgambit-dim', pc.health));
          pressable(r, `piece-${pc.id}`, () => onPress('piece', pc.id));
          sides.append(r);
        }
        body.append(fold('armies', b.armies.head, b.armies.open, [sides]));
      }
      if (m.result) {
        const r = m.result, box = el('div', 'dfgambit-result', null);
        box.append(el('div', `dfgambit-head${r.tone ? ` dfgambit-${r.tone}` : ''}`, r.head));
        for (const line of [r.king, r.why, r.gold, r.night]) if (line) box.append(el('p', 'dfgambit-line', line));
        body.append(box);
      }
      if (m.board) {   // KG6: the season board - AUDIT KG II D18: after the result it would push down; a rank is read, never pressed
        const list = el('div', 'dfgambit-list', null);
        for (const r of m.board.rows) list.append(el('div', `dfgambit-rank${r.you ? ' on' : ''}`, r.line));
        body.append(sec(m.board.head, [list, ...m.board.lines.map((/** @type {string} */ l) => el('p', 'dfgambit-line', l))]));
      }
      const guide = m.guide.paras.map((g) => { const d = el('div', 'dfgambit-para', null); d.append(el('div', 'dfgambit-term', g.head), el('div', 'dfgambit-line', g.body)); return d; });
      body.append(fold('guide', m.guide.head, m.guide.open, guide));
      const words = m.words.items.map((w) => { const d = el('div', 'dfgambit-para', null); d.append(el('div', 'dfgambit-term', w.term), el('div', 'dfgambit-line', w.meaning)); return d; });
      body.append(fold('words', m.words.head, m.words.open, words));
      root.append(body);
      msgEl = el('div', `msg${m.tone ? ` ${m.tone}` : ''}`, m.message);
      msgEl.setAttribute('aria-live', 'polite');
      root.append(msgEl);
      const acts = el('div', 'tableacts', null);
      for (const a of m.actions) {
        const b = el('button', null, a.label);
        if (!a.enabled) b.setAttribute('aria-disabled', 'true');   // a refused press keeps its edge and says why when pressed
        if (a.kind) b.dataset.kind = a.kind;
        if (a.armed) b.setAttribute('data-armed', 'true');
        if (a.strip) b.setAttribute('data-strip', a.id);   // the phone's strip shows it (14.7)
        if (a.phone) b.setAttribute('data-phone', 'true');   // the phone's alone
        b.setAttribute('data-focus', `act-${a.id}`);
        b.addEventListener('keydown', (/** @type {any} */ e) => { if (ACTIVATE.has(e.key)) e.stopPropagation?.(); });
        b.addEventListener('click', () => (a.enabled ? onPress(a.id) : a.why ? onPress('say', a.why) : null));
        acts.append(b);
      }
      root.append(acts);
      if (m.log?.length) {
        const log = el('div', 'log', null);
        log.append(...m.log.map((/** @type {string} */ line) => el('div', null, line)));
        root.append(log);
        log.scrollTop = log.scrollHeight ?? 0;
      }
      refocus(kept);
    },
    destroy() { if (!alive) return; alive = false; root.remove?.(); },
  };
}

/** THE BOARD'S OWN KEYS (14.3): the arrows and the d-pad step the cell cursor, Enter, Space and the pad's A press its
 *  cell, Escape and the pad's B cancel. They are the panel's keys while a battle is on - a window's own, as
 *  ui/input.js's overlayAction reads a window's arrows and Enter - so the hosts ask `gambitBoardKey` and read no bound
 *  key raw (KB1 law 5; test/scenes/inputmap.test.js I2). */
export const GAMBIT_CURSOR_KEYS = Object.freeze({
  ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
  [DPAD_CODES.left]: 'ArrowLeft', [DPAD_CODES.right]: 'ArrowRight', [DPAD_CODES.up]: 'ArrowUp', [DPAD_CODES.down]: 'ArrowDown',
});
export const GAMBIT_PRESS_KEYS = Object.freeze(['Enter', 'NumpadEnter', 'Space', 'JoystickButton0']);
export const GAMBIT_CANCEL_KEYS = Object.freeze(['Escape', 'JoystickButton1']);
/** What a key's or a pad button's code does on the board: the arrow its cursor step is, 'press', 'cancel', or null.
 *  @param {string} code @returns {string|null} */
export const gambitBoardKey = (code) => (Object.hasOwn(GAMBIT_CURSOR_KEYS, code) ? GAMBIT_CURSOR_KEYS[code]
  : GAMBIT_PRESS_KEYS.includes(code) ? 'press' : GAMBIT_CANCEL_KEYS.includes(code) ? 'cancel' : null);

/** The cell a key moves the board's cursor to (14.3: the arrows or the d-pad; the board's edges hold it). */
export const boardCursorStep = (/** @type {number[]} */ at, /** @type {string} */ key) => {
  const [c, r] = at;
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
  return d ? [Math.max(0, Math.min(KG_COLS - 1, c + d[0])), Math.max(0, Math.min(KG_ROWS - 1, r + d[1]))] : at;
};
