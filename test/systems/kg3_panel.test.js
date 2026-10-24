// KG3 (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md sections 14 and 16): THE KING'S GAMBIT'S PANEL - its model over
// the law's own states (gambitHudModel: every stage's next step, the regulars' rows, the stake's picks and their
// refusals, the crowns, the army's grid and rows, the turn's chips, presses and marks, the information box, the result's
// lines), its words (every number the law's export; every refusal word of the law said; a log line for every event of
// the law; units named through Daggerfall Unity's own lookup, kings off the Bay deck's crowns), and its painter (the
// chrome's parts, the game's own words, the kit's states, the fold, the phone's strip, the tutorial's first sight).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  KG_COLS, KG_ROWS, KG_POINT_BUDGET, KG_MAX_UNITS, KG_ACTIONS_PER_TURN, KG_POTIONS_PER_SIDE, KG_POTION_HEAL, KG_MOVE_RANGE,
  KG_RANGED_RANGE, KG_BLOW_LOW, KG_BLOW_SPREAD, KG_HAZARD_DAMAGE, KG_HAZARD_SPAWN_EVERY, KG_KING_LEVEL, KG_KING_HP, KG_KINGS,
  KG_RANGED_COST_FACTOR, KG_ROSTER, KG_TILE, autoFill, armyRefusal, gambitRefusal, gambitAct, finishTurn, rosterUnit, pieceById,
  reachable, foesInRange, cellIndex, warningsArmAt,
} from '../../src/net/kingsGambit.js';
import { GAMBIT_TIERS, dealRegular } from '../../src/systems/gambit/gambitPatrons.js';
import { GAMBIT_STAKE_MULTS, GAMBIT_WIN_PAYS, GAMBIT_CROWNS } from '../../src/systems/gambit/gambitTableSession.js';
import { SUIT_CROWNS } from '../../src/render/cardFaces.js';
import { ENEMY_NAMES } from '../../src/characters/enemy/enemyBasics.js';
import { FOE_CARDS } from '../../src/systems/card/cardSources.js';
import {
  gambitHudModel, createGambitTableHud, gridOrder, stakePicks, rangeCells, infoBox, tierStep, unitCardId, boardCursorStep, GAMBIT_TABLE_CSS,
} from '../../src/ui/gambitTableHud.js';
import {
  kingName, kingShort, pieceName, unitName, refusalWords, logLine, gambitGuide, gambitWords, gambitWhat, resultGold, nextStep, barkEnd, regularLines,
} from '../../src/ui/gambitTableWords.js';
import { cardPanelChromeCss, isCardPanelSelector } from '../../src/ui/card/cardPanelKit.js';
import { PIXELIFY_FIVE_FACE } from '../../src/ui/pixelifyFive.js';
import { FRAME_ROLES } from '../../src/ui/enhanced/enhancedFrame.js';
import { SMALL_WINDOWS, kitCss, G, GRIM_TONES, INK_ROOTS, WOOD_ROOTS } from '../../src/ui/grimoireDress.js';
import * as tm from '../../src/systems/textManager.js';
import { _resetTutorialTriggerForTests, setTutorialHandler } from '../../src/systems/tutorials.js';
import { setPref, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { xorshift } from '../../tools/kgMeasure.mjs';
import { fakeDoc, all, text } from '../decorFakes.mjs';
import { uiSheetRules, collisions } from '../sheetRules.mjs';

beforeEach(() => { tm._resetTextManagerForTests(); resetPrefs(); });

const [AMATEUR, SEASONED, VETERAN, GRANDMASTER] = GAMBIT_TIERS;
const reg = (name, tier, chair, nightLeft = tier.stake * 15, forFun = false) => ({ name, seed: chair * 11 + 1, chair, tier, nightLeft, forFun });
const REGS = [reg('Ana', AMATEUR, 1), reg('Bors', SEASONED, 2), reg('Cael', GRANDMASTER, 3)];
const setup = (o = {}) => gambitHudModel({ phase: 'setup', regulars: REGS, regular: null, purse: 5000, stakeMult: null, crown: 'daggerfall', ...o });
const rules = (css) => [...css.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sels: m[1].split(',').map((s) => s.trim()), body: m[2] }));
/** A real game against a Seasoned regular, the player's army Auto-filled. */
function dealt(seed = 5) {
  const rnd = xorshift(seed);
  const st = dealRegular({ army: autoFill([], KG_POINT_BUDGET, rnd), tier: SEASONED, rand32: rnd });
  return { st, rnd, dealtCounts: [0, 1].map((s) => st.pieces.filter((p) => p.side === s).length) };
}
const battle = (st, o = {}) => gambitHudModel({ phase: 'battle', game: { state: st, crowns: ['daggerfall', 'orsinium'], name: 'Bors', stake: 100, over: null, dealt: o.dealt ?? [0, 1].map((s) => st.pieces.filter((p) => p.side === s).length) }, ...o });

test('KG3 the setup\'s next step, arm by arm - no regular free, none chosen, online, a regular playing for fun, a purse short of the least stake, no stake, the king - and Build your army refused with that step\'s words until it is ready (mutants: an arm; the press enabled early)', () => {
  const said = (m) => [m.next, m.actions.find((a) => a.id === 'next').enabled];
  assert.deepEqual(said(setup({ regulars: [] })), [nextStep('noRegular'), false]);
  assert.deepEqual(said(setup()), [nextStep('chooseRegular'), false]);
  assert.deepEqual(said(setup({ regular: 1, friendly: true })), [nextStep('online'), true], 'online: for fun, no stake to choose');
  const fun = setup({ regulars: [reg('Ana', AMATEUR, 1, 0, true)], regular: 0 });
  assert.deepEqual(said(fun), [nextStep('forFun', { name: 'Ana' }), true]);
  assert.equal(fun.setup.stakes, null, 'no stake to pick for fun');
  const short = setup({ regular: 2, purse: 999 });
  assert.deepEqual(said(short), [nextStep('short', { name: 'Cael', stake: 1000 }), false]);
  assert.match(short.next, /Cael will not sit down for less than 1,000 gold\. Come back with more, or choose another regular\./);
  assert.deepEqual(said(setup({ regular: 1 })), [nextStep('chooseStake'), false]);
  assert.deepEqual(said(setup({ regular: 1, stakeMult: 2 })), [nextStep('chooseKing'), true]);
  assert.equal(setup({ regular: 1 }).actions.find((a) => a.id === 'next').why, nextStep('chooseStake'), 'a refused press says why when pressed');
  assert.deepEqual(setup().actions.map((a) => [a.id, a.kind ?? null]), [['next', 'primary'], ['holdem', null], ['iliac', null], ['stand', 'quiet']]);
});

test('KG3 the regulars\' rows: the tier a word and a four-step mark, what makes it hard in the law\'s numbers, the least stake, the blurb, what is left of the night - and online, the regulars\' fun (mutants: the blunder\'s percent; never blunders; the steps; the night\'s line)', () => {
  const m = setup({ regular: 0 });
  const [a, b, c] = m.setup.regulars;
  assert.deepEqual([a.tier, a.step, a.chosen], ['Amateur', 1, true]);
  assert.equal(a.fields, `An army of ${AMATEUR.budget} points - ${AMATEUR.potions} potions - blunders ${Math.round(AMATEUR.blunder * 100)}% of the time`);
  assert.equal(b.fields, `An army of ${SEASONED.budget} points - ${SEASONED.potions} potions - blunders ${Math.round(SEASONED.blunder * 100)}% of the time`);
  assert.equal(c.fields, `An army of ${GRANDMASTER.budget} points - ${GRANDMASTER.potions} potions - never blunders`);
  // every count said with its noun goes through the plural - a language with more forms than English needs it
  assert.equal(regularLines({ name: 'Ana', tier: { ...AMATEUR, budget: 1, potions: 1 }, nightLeft: 10, forFun: false }, false).fields, `An army of 1 point - 1 potion - blunders ${Math.round(AMATEUR.blunder * 100)}% of the time`);
  assert.equal(c.least, 'Sits down for 1,000 gold or more');
  assert.equal(c.step, 4);
  assert.deepEqual(GAMBIT_TIERS.map((t) => tierStep(t.key)), [1, 2, 3, 4]);
  assert.equal(a.blurb, 'A few drinks in, and barely sure of the rules.');
  assert.ok(!/\bhe\b|\bhim\b|\bhis\b/i.test(GAMBIT_TIERS.map((t) => setup({ regulars: [reg('X', t, 1)] }).setup.regulars[0].blurb).join(' ')), 'no pronoun guessed');
  assert.equal(b.night, `Can still pay ${(SEASONED.stake * 15).toLocaleString('en-US')} gold tonight`);
  assert.equal(setup({ regulars: [reg('Ana', AMATEUR, 1, 0, true)] }).setup.regulars[0].night, 'Plays for fun tonight');
  assert.equal(setup({ friendly: true }).setup.regulars[0].night, 'Online, the regulars play for fun');
});

test('KG3 the stake\'s picks: the tier\'s least times the mod\'s three, each refused in words past the purse or past the regular\'s night, chosen only when lawful; what it wins and loses said before it is down (mutants: a multiplier; the purse unread; the night unread; the win\'s pay)', () => {
  const r = REGS[1];
  const picks = stakePicks(r, 5000, 2);
  assert.deepEqual(picks.map((p) => [p.m, p.gold, p.enabled, p.chosen]), GAMBIT_STAKE_MULTS.map((m) => [m, SEASONED.stake * m, true, m === 2]));
  assert.equal(picks[0].label, '×1 - 50 gold');
  const poor = stakePicks(r, 120, 5);
  assert.deepEqual(poor.map((p) => p.enabled), [true, true, false]);
  assert.equal(poor[2].why, 'You have 120 gold, which is not enough for a stake of 250.');
  assert.equal(poor[2].chosen, false, 'a refused pick is never the chosen one');
  const tired = stakePicks({ ...r, nightLeft: 100 }, 5000, null);
  assert.deepEqual(tired.map((p) => p.enabled), [true, true, false]);
  assert.equal(tired[2].why, 'Bors can pay out only 100 gold more tonight.');
  const m = setup({ regular: 1, stakeMult: 5 });
  assert.equal(m.setup.stakeLine, `Win: you take back ${(250 * GAMBIT_WIN_PAYS).toLocaleString('en-US')} gold. Lose, forfeit or stand up mid-game: Bors keeps your 250 gold.`);
});

test('KG3 the kings are the Bay deck\'s four, named off SUIT_CROWNS ("{name}, King of {crown}" in a list or a label, "King {name}" inside a sentence - FOUND AT KG3) - never the law\'s Knight and Barbarian - the chosen marked, every king the mod\'s numbers (mutants: the court; the crown\'s order; the numbers; the whole title in a sentence)', () => {
  const m = setup({ crown: 'wayrest' });
  assert.deepEqual(m.setup.crowns.map((c) => [c.key, c.name, c.chosen]), SUIT_CROWNS.map((c, i) => [c.crown.toLowerCase(), `${c.courts[2].name}, King of ${c.crown}`, c.crown === 'Wayrest']));
  assert.deepEqual(GAMBIT_CROWNS, ['orsinium', 'sentinel', 'wayrest', 'daggerfall']);
  assert.equal(kingName('nowhere'), 'Gothryd, King of Daggerfall', 'a key it does not hold: the game\'s own crown');
  assert.equal(m.setup.kingLine, `The crown only changes how your king looks. Every king plays the same: level ${KG_KING_LEVEL}, ${KG_KING_HP} health, attack ${KG_KINGS[0].atk}.`);
  assert.ok(!/Knight|Barbarian/.test(JSON.stringify(m)));
  // inside a sentence the whole title wants the commas round it ("Your Gothryd, King of Daggerfall moves."): a king there
  // is "King {name}" - the log's, a refusal's, a press's; the box's head and the fall keep the whole title
  assert.equal(kingShort('daggerfall'), 'King Gothryd');
  assert.equal(pieceName({ king: true, side: 1, unit: 0 }, ['daggerfall', 'orsinium']), 'King Gortwog');
  assert.equal(logLine({ t: 'move', side: 0, piece: 1 }, { regular: 'Bors', names: () => pieceName({ king: true, side: 0, unit: 0 }, ['daggerfall', 'orsinium']) }), 'Your King Gothryd moves.');
  assert.equal(refusalWords('full', { piece: kingShort('orsinium') }), 'King Gortwog is at full health.');
});

test('KG3 the army: the 46 units in the law\'s order - a cost\'s ties by the names the player reads, then by id - each its card\'s picture, chips and cost in points; the points and the twelve refusing a unit in words, the unit still pressable; the rows dearest first; the presses (mutants: the order; the chips; a refusal; the start\'s stake)', () => {
  const order = gridOrder();
  assert.equal(order.length, KG_ROSTER.length);
  for (let i = 1; i < order.length; i++) {
    const a = order[i - 1], b = order[i];
    assert.ok(a.cost < b.cost || (a.cost === b.cost && (unitName(a.id) < unitName(b.id) || (unitName(a.id) === unitName(b.id) && a.id < b.id))), `${a.id} before ${b.id}`);
  }
  assert.deepEqual(order.filter((u) => u.name === 'Dragonling').map((u) => u.id), [34, 40], 'the Dragonling twice, by id');
  const army = autoFill([], KG_POINT_BUDGET, xorshift(3));
  const m = gambitHudModel({ phase: 'army', army, crown: 'sentinel', regulars: REGS, regular: 1, stakeMult: 2, purse: 5000, pressed: 0, said: 'x' });
  const left = KG_POINT_BUDGET - army.reduce((s, id) => s + rosterUnit(id).cost, 0);
  assert.deepEqual(m.army.chips, [`Points left ${left} of ${KG_POINT_BUDGET}`, `Units ${army.length} of ${KG_MAX_UNITS}`]);
  for (const u of m.army.grid) {
    const r = rosterUnit(u.id);
    assert.equal(u.card, FOE_CARDS[u.id], `${u.id}: its card`);
    assert.deepEqual(u.chips, [`Lv ${r.level}`, `HP ${r.hp}`, `Atk ${r.atk}`, r.ranged ? 'Ranged' : 'Melee', `${r.cost} pts`]);
    assert.equal(u.dim, armyRefusal([...army, u.id]) !== null, `${u.id}: dimmed as the law refuses it`);
  }
  assert.ok(KG_ROSTER.every((u) => typeof unitCardId(u.id) === 'string'), 'every unit wears a card since KG-SET');
  const costs = m.army.rows.map((r) => rosterUnit(r.id).cost);
  assert.deepEqual(costs, costs.slice().sort((a, b) => b - a), 'dearest first');
  assert.equal(m.army.unit.line, 'Level 1 - Health 12 - Attack 2 - Melee');
  assert.equal(m.army.unit.cost, '6 points');
  assert.equal(m.army.kingLine, 'Your king: Camaron, King of Sentinel (free). If your king falls, you lose.');
  const start = m.actions.find((a) => a.id === 'start');
  assert.deepEqual([start.label, start.enabled, start.kind], ['Start the battle and stake 100 gold', true, 'primary']);
  const empty = gambitHudModel({ phase: 'army', army: [], crown: 'sentinel', regulars: REGS, regular: 1, stakeMult: 2, purse: 5000 });
  assert.deepEqual([empty.actions.find((a) => a.id === 'start').enabled, empty.actions.find((a) => a.id === 'start').why, empty.next], [false, refusalWords('empty'), nextStep('addUnit')]);
  const fun = gambitHudModel({ phase: 'army', army, regulars: REGS, regular: 1, friendly: true, purse: 0 });
  assert.equal(fun.actions.find((a) => a.id === 'start').label, 'Start the battle', 'for fun: no gold in the label');
  assert.equal(gambitHudModel({ phase: 'army', army: Array(KG_MAX_UNITS).fill(0), regulars: REGS, regular: 0, purse: 0 }).actions.find((a) => a.id === 'autofill').enabled, false, 'a full army fills no more');
});

test('KG3 the turn: the title by whose turn, the chips (pips and words, both sides\' potions and fallen), the next step\'s arms, a chosen piece\'s reach, range and targets, Drink and its refusals, End turn refused on the regular\'s turn, Forfeit and Stand up in blood with the stake in their words and asked twice (mutants: the fallen; a pip; the next step; the drink\'s refusal; the armed words)', () => {
  const { st, dealtCounts } = dealt();
  const m = battle(st, { dealt: dealtCounts });
  assert.equal(m.title, `Round ${st.round} - your turn`);
  assert.deepEqual(m.battle.chips.map((c) => c.text), [`${KG_ACTIONS_PER_TURN} of ${KG_ACTIONS_PER_TURN} actions left`, `Your potions ${KG_POTIONS_PER_SIDE}`, `Bors's potions ${SEASONED.potions}`, 'Your fallen 0', 'Bors\'s fallen 0']);
  assert.equal(m.battle.chips[0].pips, KG_ACTIONS_PER_TURN);
  assert.equal(m.next, nextStep('yourTurn', { n: KG_ACTIONS_PER_TURN }));
  const mine = st.pieces.find((p) => p.side === 0 && !p.king);
  const sel = battle(st, { selected: mine.id });
  assert.equal(sel.next, nextStep('piece'));
  assert.deepEqual(sel.battle.lit, reachable(st, mine));
  assert.deepEqual(sel.battle.targets, foesInRange(st, mine).map((x) => x.id));
  assert.deepEqual(sel.battle.range, rangeCells(st, mine));
  const drink = sel.actions.find((a) => a.id === 'drink');
  assert.deepEqual([drink.enabled, drink.why], [false, refusalWords('full', { piece: unitName(mine.unit) })], 'a piece at its full health');
  const hurt = structuredClone(st);
  pieceById(hurt, mine.id).hp -= 10;
  assert.equal(battle(hurt, { selected: mine.id }).actions.find((a) => a.id === 'drink').label, `Give ${unitName(mine.unit)} a potion (+10)`);
  hurt.potions[0] = 0;
  assert.equal(battle(hurt, { selected: mine.id }).actions.find((a) => a.id === 'drink').why, refusalWords('potions'));
  const fell = structuredClone(st);
  fell.pieces = fell.pieces.filter((p) => p.id !== mine.id);
  assert.equal(battle(fell, { dealt: dealtCounts }).battle.chips[3].text, 'Your fallen 1', 'a fallen piece counted against the deal');
  const forfeit = m.actions.find((a) => a.id === 'forfeit'), stand = m.actions.find((a) => a.id === 'stand');
  assert.deepEqual([forfeit.label, forfeit.kind, stand.label, stand.kind], ['Forfeit - lose 100 gold', 'warn', 'Stand up and lose 100 gold', 'warn']);
  assert.equal(battle(st, { armed: 'forfeit' }).actions.find((a) => a.id === 'forfeit').label, 'Press again to confirm');
  // the regular's turn
  const out = gambitAct(st, 0, { type: 'end' });
  const theirs = finishTurn(out.state, xorshift(1)).state;
  const t = battle(theirs);
  assert.equal(t.title, `Round ${theirs.round} - Bors's turn`);
  assert.equal(t.next, nextStep('theirTurn', { name: 'Bors' }));
  const end = t.actions.find((a) => a.id === 'end');
  assert.deepEqual([end.enabled, end.why], [false, refusalWords('turn')]);
  assert.equal(battle(out.state).next, nextStep('ending'), 'your turn is ending');
  assert.equal(t.tone, 'wait');
  // the round whose end turns the warnings says so on the next-step line - off the law's clock (warningsArmAt)
  for (const r of [1, 2, 3, 4]) {
    const w = structuredClone(st);
    w.round = r; w.hazards[0].active = false;
    assert.equal(battle(w).next, warningsArmAt(r) === r ? nextStep('warnings', { n: w.actions }) : nextStep('yourTurn', { n: w.actions }), `round ${r}`);
  }
  // a pip an action left, none on the regular's turn
  assert.equal(t.battle.chips[0].pips, 0, 'the regular\'s turn lights no pip of yours');
  const mover = st.pieces.find((p) => p.side === 0 && reachable(st, p).length);
  const [mc, mr] = reachable(st, mover)[0];
  const one = battle(gambitAct(st, 0, { type: 'move', piece: mover.id, col: mc, row: mr }).state).battle.chips[0];
  assert.deepEqual([one.pips, one.text], [KG_ACTIONS_PER_TURN - 1, `${KG_ACTIONS_PER_TURN - 1} of ${KG_ACTIONS_PER_TURN} actions left`]);
});

test('KG3 under a finger the turn stages: Move here or Strike {name}, with Cancel; the strip\'s presses marked - the staged, Drink, End turn and More, never Forfeit or Stand up (mutants: the staged press; the strip\'s marks)', () => {
  const { st } = dealt(8);
  const mine = st.pieces.find((p) => p.side === 0 && reachable(st, p).length);
  const [c, r] = reachable(st, mine)[0];
  const mv = battle(st, { selected: mine.id, staged: { kind: 'move', col: c, row: r }, touch: true });
  assert.deepEqual(mv.actions.map((a) => [a.id, !!a.strip]), [['move', true], ['cancel', true], ['forfeit', false], ['stand', false], ['more', true]]);
  assert.equal(mv.actions[0].label, 'Move here');
  const foe = st.pieces.find((p) => p.side === 1);
  const sk = battle(st, { selected: mine.id, staged: { kind: 'attack', target: foe.id }, touch: true });
  assert.equal(sk.actions[0].label, `Strike ${foe.king ? kingShort('orsinium') : unitName(foe.unit)}`);
  const picked = battle(st, { selected: mine.id, touch: true });
  assert.deepEqual(picked.actions.map((a) => a.id), ['drink', 'cancel', 'end', 'forfeit', 'stand', 'more'], 'a finger has no Escape: Cancel lets the piece go');
  assert.deepEqual(battle(st, { selected: mine.id }).actions.map((a) => a.id), ['drink', 'end', 'forfeit', 'stand', 'more'], 'a fine pointer: Escape cancels');
  assert.ok(battle(st).actions.find((a) => a.id === 'more').phone, 'More is the phone\'s');
});

test('KG3 the information box: a piece - its side, its numbers, its reach in words, its foes in reach, a king\'s warning; a cell - its ground or its hazard in plain words (mutants: the side; the king\'s line; a ground\'s words; a warning\'s round)', () => {
  const { st } = dealt(4);
  const king = st.pieces.find((p) => p.side === 0 && p.king);
  const box = infoBox(st, { piece: king.id }, ['daggerfall', 'orsinium'], 'Bors');
  assert.deepEqual(box.lines, ['Gothryd, King of Daggerfall - yours', `Level ${KG_KING_LEVEL} - Attack ${KG_KINGS[0].atk} - Melee: strikes the cell next to it`, `Health ${KG_KING_HP} of ${KG_KING_HP}`, `Moves up to ${KG_MOVE_RANGE} cells a move.`, 'No foe in range now.', 'If this king falls, you lose.']);   // PIN MOVED (AUDIT KG II D21): range, a blow's word
  const theirKing = st.pieces.find((p) => p.side === 1 && p.king);
  assert.equal(infoBox(st, { piece: theirKing.id }, ['daggerfall', 'orsinium'], 'Bors').lines.at(-1), 'If this king falls, Bors loses.');
  assert.equal(infoBox(st, { piece: theirKing.id }, ['daggerfall', 'orsinium'], 'Bors').lines[0], 'Gortwog, King of Orsinium - Bors\'s');
  const at = (tile) => { for (let i = 0; i < st.tiles.length; i++) if (st.tiles[i] === tile && !st.pieces.some((p) => cellIndex(p.col, p.row) === i) && !st.hazards.some((h) => cellIndex(h.col, h.row) === i)) return [i % KG_COLS, Math.floor(i / KG_COLS)]; return null; };
  assert.deepEqual(infoBox(st, { cell: at(KG_TILE.floor) }, ['daggerfall', 'orsinium'], 'Bors').lines, ['Open floor.']);
  const wall = at(KG_TILE.wall) ?? at(KG_TILE.pillar);
  if (wall) assert.match(infoBox(st, { cell: wall }, ['daggerfall', 'orsinium'], 'Bors').lines[0], /no piece walks through it, and it blocks a ranged shot\./);
  const h = st.hazards[0];
  const hz = infoBox(st, { cell: [h.col, h.row] }, ['daggerfall', 'orsinium'], 'Bors').lines[0];
  assert.equal(hz, `${h.kind[0].toUpperCase()}${h.kind.slice(1)}: a piece that ends its turn here loses ${KG_HAZARD_DAMAGE[h.kind]} health.`, 'the deal\'s hazards are active');
  const warned = structuredClone(st);
  warned.hazards[0].active = false;
  for (const r of [1, 2, 3, 4]) {   // a round whose end arms them, and one whose end does not
    warned.round = r;
    assert.equal(infoBox(warned, { cell: [h.col, h.row] }, ['daggerfall', 'orsinium'], 'Bors').lines[0], `Warning: this cell becomes ${h.kind} at the end of round ${warningsArmAt(r)}. It is harmless until then.`, `round ${r}`);
  }
  assert.deepEqual([1, 2, 3, 4].map(warningsArmAt), [1, 3, 3, 5]);
  // THE LAW'S OWN CLOCK (HazardTick, finishTurn): a warning standing in round r turns at the end of round
  // warningsArmAt(r) - read off a game played on, never off the constant's present value
  let g = dealt(4).st, seen = 0;
  for (let i = 0; i < 24 && !g.over; i++) {
    const r = g.round, waiting = g.turn === 1 && g.hazards.some((x) => !x.active);
    const out = finishTurn(gambitAct(g, g.turn, { type: 'end' }).state, xorshift(i + 1));
    if (waiting) { assert.equal(out.events.some((e) => e.t === 'armed'), warningsArmAt(r) === r, `the end of round ${r}`); seen++; }
    g = out.state;
  }
  assert.ok(seen >= 6, 'rounds read at both arms');
  assert.equal(infoBox(st, { cell: [-1, 0] }, ['daggerfall', 'orsinium'], 'Bors'), null, 'off the board: nothing');
  assert.equal(infoBox(st, null, [], ''), null);
});

test('KG3 the result: the headline, the king\'s fall, the gold in one sentence - the pot collected, the stake kept, for fun, no contest - a spent night said; the four presses (mutants: a gold line; the fallen crown; the night)', () => {
  const { st } = dealt(6);
  const over = (o, stake = 100, spent = false) => gambitHudModel({ phase: 'over', game: { state: st, crowns: ['daggerfall', 'orsinium'], name: 'Bors', stake, over: o, dealt: [1, 1], nightSpent: spent } });
  const won = over({ winner: 0, by: 'king' });
  assert.deepEqual([won.result.head, won.result.king, won.result.gold, won.result.tone], ['You win', 'Gortwog, King of Orsinium, falls.', 'You collect the pot: your 100 gold back, plus 100 gold from Bors.', 'won']);
  const lost = over({ winner: 1, by: 'king' });
  assert.deepEqual([lost.result.head, lost.result.king, lost.result.gold], ['You lose', 'Gothryd, King of Daggerfall, falls.', 'Bors keeps your 100 gold.']);
  const ff = over({ winner: 1, by: 'forfeit' });
  assert.deepEqual([ff.result.head, ff.result.king], ['You lose by forfeit', null], 'a forfeit fells no king');
  assert.equal(over({ winner: 0, by: 'king' }, 0).result.gold, 'Played for fun. No gold changed hands.');
  assert.equal(over({ winner: null, by: 'void' }).result.gold, 'No contest. Your 100 gold is back in your purse.');
  assert.equal(over({ winner: 0, by: 'king' }, 100, true).result.night, 'Bors will not pay out any more tonight. The next game is for fun.');
  assert.deepEqual(won.actions.map((a) => [a.id, a.kind ?? null]), [['again', 'primary'], ['army', null], ['regulars', null], ['stand', 'quiet']]);
  assert.deepEqual([won.tone, lost.tone, won.message], ['', '', nextStep('over')], 'the line says the next step in no tone of the chrome\'s three: the verdict is the box\'s');
  assert.equal(resultGold({ winner: 1, by: 'king' }, 0, 'Bors'), 'Played for fun. No gold changed hands.');
});

test('KG3 THE NUMBERS ARE THE LAW\'S (14.4): what it is, the guide\'s seven paragraphs and the words read every figure from its export (mutants: a typed number in any of them)', () => {
  assert.equal(gambitWhat(), `The King's Gambit is a game of armies and kings, played on a board of ${KG_COLS} by ${KG_ROWS} cells. Each side protects its king. Defeat the other king to win.`);
  const g = gambitGuide();
  assert.equal(g.length, 7);
  const body = (i) => g[i].body;
  assert.equal(body(1), `Stake ${GAMBIT_STAKE_MULTS[0]}, ${GAMBIT_STAKE_MULTS[1]} or ${GAMBIT_STAKE_MULTS[2]} times the regular's minimum stake. If you win, you get back ${GAMBIT_WIN_PAYS} times your stake. If you lose, forfeit or stand up mid-game, the regular keeps it.`);
  assert.equal(body(2), `Up to ${KG_MAX_UNITS} units for ${KG_POINT_BUDGET} points. Stronger units cost more, and ranged units cost ${Math.round((KG_RANGED_COST_FACTOR - 1) * 100)}% extra. Your king joins for free.`);
  assert.equal(body(3), `${KG_ACTIONS_PER_TURN} actions a turn: move a piece up to ${KG_MOVE_RANGE} cells, strike, or give one of your pieces a potion that heals ${KG_POTION_HEAL} health. You have ${KG_POTIONS_PER_SIDE} potions a game.`);
  assert.equal(body(4), `A melee piece strikes the cell next to it. A ranged piece shoots up to ${KG_RANGED_RANGE} cells when nothing is in the way. A hit does ${Math.round(KG_BLOW_LOW * 100)}% to ${Math.round((KG_BLOW_LOW + KG_BLOW_SPREAD) * 100)}% of the attacker's attack.`);
  assert.equal(body(5), `Walls and pillars block movement and shots. Water blocks movement, but shots pass over it. Every ${KG_HAZARD_SPAWN_EVERY} rounds, warning cells turn into fire (${KG_HAZARD_DAMAGE.fire}), spikes (${KG_HAZARD_DAMAGE.spikes}) or poison (${KG_HAZARD_DAMAGE.poison}). A piece that ends its turn on one loses that much health.`);
  const w = gambitWords();
  assert.equal(w.length, 28);
  assert.deepEqual(w.map((x) => x.term).slice(0, 4), ['Regular', 'Tier', 'Blunder', 'Minimum stake']);
  assert.ok(w.every((x) => x.term && x.meaning && !/\bhe\b|\bhis\b|\bhim\b|click/i.test(x.meaning)), 'no pronoun guessed; a press, never a click');
});

test('KG3 every refusal word the law answers is said in words - gambitRefusal\'s and armyRefusal\'s - none left to the catch-all (mutant: a word unsaid)', () => {
  const words = ['over', 'ending', 'turn', 'piece', 'cell', 'target', 'range', 'full', 'potions', 'empty', 'units', 'points', 'rand'];
  const fallback = refusalWords('???');
  for (const w of words) assert.notEqual(refusalWords(w, { piece: 'Rat', target: 'Imp' }), fallback, w);
  assert.equal(refusalWords('shape'), fallback, 'a malformed command is the catch-all\'s');
  assert.equal(refusalWords('cell', { piece: 'Rat' }), 'Rat cannot reach that cell.');
  assert.equal(refusalWords('range', { target: 'Imp' }), 'Imp is out of range.');   // PIN MOVED (AUDIT KG II D21)
  assert.equal(refusalWords('units'), `Your army is full: ${KG_MAX_UNITS} units.`);
  // every word the law's two refusals can say is one of them (the law's own sources, read)
  const { st } = dealt(2);
  const p = st.pieces.find((x) => x.side === 0);
  const said = new Set([gambitRefusal(null, 0, {}), gambitRefusal(st, 2, { type: 'end' }), gambitRefusal(st, 0, null), gambitRefusal(st, 1, { type: 'end' }), gambitRefusal(st, 0, { type: 'move', piece: 999, col: 0, row: 0 }), gambitRefusal(st, 0, { type: 'move', piece: p.id, col: -5, row: 0 }), gambitRefusal(st, 0, { type: 'attack', piece: p.id, target: p.id }), gambitRefusal(st, 0, { type: 'potion', piece: p.id }), armyRefusal([]), armyRefusal(Array(13).fill(0)), armyRefusal([999]), armyRefusal(Array(12).fill(42))]);
  for (const w of said) if (w && w !== 'side' && w !== 'unit' && w !== 'shape') assert.ok(words.includes(w), `the law's ${w} is said`);
});

test('KG3 THE LOG: a line for every event the law and the session say - the player in the second person, the regular by name, a fallen piece still named; nothing for an event the log does not keep (mutants: a pattern; the side; the kill)', () => {
  const names = (id) => ({ 1: 'Rat', 2: 'Imp', 3: 'Orc' })[id] ?? '?';
  const x = { regular: 'Bors', names };
  const lines = [
    [{ t: 'game', layout: 'moat-and-bridges' }, 'The board is laid: Moat and bridges.'],
    [{ t: 'move', side: 0, piece: 1 }, 'Your Rat moves.'],
    [{ t: 'move', side: 1, piece: 3 }, 'Bors\'s Orc moves.'],
    [{ t: 'attack', side: 0, piece: 1, target: 3, damage: 4, killed: false, shot: false }, 'Your Rat strikes Orc for 4.'],
    [{ t: 'attack', side: 1, piece: 3, target: 1, damage: 9, killed: true, shot: false }, 'Bors\'s Orc strikes your Rat for 9. It falls.'],
    [{ t: 'attack', side: 0, piece: 2, target: 3, damage: 7, killed: false, shot: true }, 'Your Imp shoots Orc for 7.'],
    [{ t: 'attack', side: 1, piece: 3, target: 2, damage: 7, killed: false, shot: true }, 'Bors\'s Orc shoots your Imp for 7.'],
    [{ t: 'potion', side: 0, piece: 1, healed: 30 }, 'Your Rat drinks a potion: +30.'],
    [{ t: 'potion', side: 1, piece: 3, healed: 12 }, 'Bors\'s Orc drinks a potion: +12.'],
    [{ t: 'hazard', side: 0, piece: 1, kind: 'fire', damage: 8, killed: false }, 'Fire bites your Rat for 8.'],
    [{ t: 'hazard', side: 1, piece: 3, kind: 'poison', damage: 5, killed: true }, 'Poison hits Bors\'s Orc for 5. It falls.'],
    [{ t: 'armed', cells: [[1, 1], [2, 2]] }, 'The warnings turn into hazards: 2 hazards are now active.'],
    [{ t: 'armed', cells: [[1, 1]] }, 'The warnings turn into hazards: 1 hazard is now active.'],
    [{ t: 'warning', kind: 'spikes', cells: [[1, 1], [2, 2]] }, 'Warning: spikes are coming to 2 cells.'],
    [{ t: 'warning', kind: 'fire', cells: [[1, 1], [2, 2]] }, 'Warning: fire is coming to 2 cells.'],
    [{ t: 'turn', side: 0, round: 3 }, 'Round 3: your turn.'],
    [{ t: 'turn', side: 1, round: 3 }, 'Round 3: Bors\'s turn.'],
    [{ t: 'end', side: 0 }, 'You end your turn.'],
    [{ t: 'end', side: 1 }, 'Bors ends the turn.'],
    [{ t: 'forfeit', side: 0 }, 'You forfeit the game.'],
    [{ t: 'decided', winner: 0, by: 'king' }, 'You win.'],
    [{ t: 'decided', winner: 1, by: 'forfeit' }, 'Bors wins.'],
    [{ t: 'decided', winner: null, by: 'void' }, 'The game cannot go on: no contest.'],
  ];
  for (const [e, line] of lines) assert.equal(logLine(e, x), line, e.t);
  for (const t of ['over', 'result']) assert.equal(logLine({ t }, x), null, `${t}: the log keeps the decision's own line`);
  for (const [e] of lines) assert.ok(logLine(e, x).length <= 64, `one line of the panel: ${logLine(e, x)}`);
  assert.equal(barkEnd(true, 0), 'A fine game. And mine.');
  assert.equal(barkEnd(false, 0.99), 'Again, and I will have you.');
});

test('KG3 NAMES: a unit by Daggerfall Unity\'s own name list in the player\'s language (getLocalizedEnemyName) - the grid, the rows, the log - never the law\'s English; English again byte for byte (mutant: the law\'s name)', () => {
  const en = gridOrder().map((u) => unitName(u.id));
  const rows = Array.from({ length: ENEMY_NAMES.length }, (_, i) => `Créature ${i}`);
  rows[0] = 'Rat d\'égout';
  rows[43 + 141 - 128] = 'Archère';
  tm.patchLocaleTable('fr', 'Internal_Strings', [['enemyNames', rows.join('\n')]]);
  tm.setLocale('fr');
  assert.equal(unitName(0), 'Rat d\'égout');
  assert.equal(unitName(141), 'Archère', 'a calling at 43 + id - 128');
  const m = gambitHudModel({ phase: 'army', army: [0], regulars: REGS, regular: 0, purse: 100, pressed: 141 });
  assert.equal(m.army.grid.find((u) => u.id === 0).name, 'Rat d\'égout');
  assert.equal(m.army.unit.name, 'Archère');
  assert.equal(m.army.rows[0].name, 'Rat d\'égout');
  tm.setLocale('en');
  assert.deepEqual(gridOrder().map((u) => unitName(u.id)), en);
});

test('KG3 the panel painted: the chrome\'s parts once each, the game\'s own words its own, a chosen row the kit\'s .on and a chosen tile its aria-pressed, the stage on the root (the phone\'s strip reads it), the turn\'s chips outside the body, the strip\'s presses marked, the fold kept across repaints, the tutorial\'s first sight from the painter itself (mutants: the root\'s stage; the .on; the chips inside the body; the strip\'s mark; the fold; the first sight)', () => {
  const seen = [];
  _resetTutorialTriggerForTests();
  const off = setTutorialHandler((id) => { seen.push(id); return true; });
  const doc = fakeDoc();
  const pressed = [];
  const hud = createGambitTableHud({ onPress: (id, v) => pressed.push([id, v]), doc });
  off();
  assert.deepEqual(seen, ['kings-gambit'], 'the page\'s first sight, inside the painter');
  hud.render(setup({ regular: 1, stakeMult: 2 }));
  assert.equal(hud.root.className, 'dfgambit');
  for (const w of ['tablehead', 'tabletitle', 'fold', 'msg', 'tableacts']) assert.equal(all(hud.root, w).length, 1, w);
  const rowsOn = all(hud.root, 'dfgambit-regular');
  assert.deepEqual(rowsOn.map((r) => [r.className, r.attrs['aria-pressed']]), [['dfgambit-regular', 'false'], ['dfgambit-regular on', 'true'], ['dfgambit-regular', 'false']]);
  const stakes = all(hud.root, 'dfgambit-stake');
  assert.deepEqual(stakes.map((s) => s.attrs['aria-pressed']), ['false', 'true', 'false']);
  stakes[2].fire('click');
  assert.deepEqual(pressed.at(-1), ['stake', 5]);
  // the battle
  const { st } = dealt();
  const mine = st.pieces.find((p) => p.side === 0 && !p.king);
  hud.render(battle(st, { selected: mine.id, touch: true }));
  assert.equal(hud.root.className, 'dfgambit dfgambit-battle');
  const chiprow = all(hud.root, 'dfgambit-chiprow')[0];
  assert.ok(hud.root.children.includes(chiprow), 'the chips stand outside the body');
  assert.ok(!all(all(hud.root, 'dfgambit-body')[0], 'dfgambit-chiprow').length);
  assert.equal(all(hud.root, 'dfgambit-pip').length, KG_ACTIONS_PER_TURN);
  const acts = all(hud.root, 'tableacts')[0].children;
  assert.deepEqual(acts.map((b) => [b.attrs['data-focus'], b.attrs['data-strip'] ?? null, b.dataset.kind ?? null]), [['act-drink', 'drink', null], ['act-cancel', 'cancel', null], ['act-end', 'end', 'primary'], ['act-forfeit', null, 'warn'], ['act-stand', null, 'warn'], ['act-more', 'more', 'quiet']]);
  assert.equal(acts.at(-1).attrs['data-phone'], 'true');
  const piece = all(hud.root, 'dfgambit-piece').find((r) => r.attrs['data-focus'] === `piece-${mine.id}`);
  assert.equal(piece.className, 'dfgambit-piece on', 'the chosen piece\'s row');
  hud.render(battle(st, { more: true }));
  assert.equal(hud.root.className, 'dfgambit dfgambit-battle dfgambit-more');
  all(hud.root, 'fold')[0].fire('click');
  assert.equal(hud.root.className, 'dfgambit collapsed dfgambit-battle dfgambit-more');
  hud.render(battle(st, { more: true, why: 'No.' }));
  assert.match(hud.root.className, /collapsed/, 'the fold kept across a repaint');
  assert.equal(all(hud.root, 'msg')[0].attrs['aria-live'], 'polite');
  // a refused press says why
  const end = all(hud.root, 'tableacts')[0].children.find((b) => b.attrs['data-focus'] === 'act-forfeit');
  end.fire('click');
  assert.deepEqual(pressed.at(-1), ['forfeit', undefined]);
  hud.destroy();
  assert.ok(hud.root.removed);
});

test('KG3 THE COAT (14.1): the sheet is the chrome\'s for .dfgambit plus geometry and words - no edge with a colour on a role, no size under 12 px - the roles name every surface beside the other two panels\', the kit\'s cut and Grimoire\'s small windows take the third (mutants: the chrome; an edge coloured; a size under the floor; a role dropped)', () => {
  assert.ok(GAMBIT_TABLE_CSS.startsWith(`\n${PIXELIFY_FIVE_FACE}`), 'the five first');
  assert.ok(GAMBIT_TABLE_CSS.includes(cardPanelChromeCss('.dfgambit')), 'the shared chrome, as built');
  const roleSurfaces = Object.values(FRAME_ROLES).flat().filter(isCardPanelSelector).map((x) => x.replace(/^body /, ''));
  for (const r of rules(GAMBIT_TABLE_CSS)) {
    if (r.sels.some((x) => roleSurfaces.includes(x))) assert.doesNotMatch(r.body, /border(-(top|right|bottom|left))?: ?\d+px solid/, `${r.sels.join(', ')}: an edge is a width and a style`);
    for (const m of r.body.matchAll(/font-size: ?(\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, `${r.sels.join(', ')}: ${m[0]} under the floor`);
  }
  const want = {
    window: ['body .dfgambit'], button: ['body .dfgambit button', 'body .dfgambit .fold'], primary: ['body .dfgambit button[data-kind="primary"]'],
    warn: ['body .dfgambit button[data-kind="warn"]'], header: ['body .dfgambit .tablehead'], ruleTop: ['body .dfgambit .log'],
    panel: ['body .dfgambit-sec', 'body .dfgambit-info', 'body .dfgambit-result'], headerRule: ['body .dfgambit-sec > summary', 'body .dfgambit-sec > h3'],
    tile: ['body .dfgambit-unit', 'body .dfgambit-stake', 'body .dfgambit-crown'], listRow: ['body .dfgambit-regular', 'body .dfgambit-armyrow', 'body .dfgambit-piece'],
    chip: ['body .dfgambit-chip'], well: ['body .dfgambit-face', 'body .dfgambit-meter'], meterFill: ['body .dfgambit-fill'],
  };
  for (const [role, sels] of Object.entries(want)) for (const s of sels) assert.ok(FRAME_ROLES[role].includes(s), `${role}: ${s}`);
  for (const s of Object.values(want).flat()) assert.ok(isCardPanelSelector(s), `the classic cut takes ${s}`);
  assert.ok(!isCardPanelSelector('body .dfgambitx') && !isCardPanelSelector('.dfgambits'), 'its own words, no other');
  assert.ok(SMALL_WINDOWS.includes('body .dfgambit'));
  assert.match(GAMBIT_TABLE_CSS, /\.dfgambit\.collapsed \.dfgambit-body\{display:none\}/, 'the fold puts the body away');
  assert.match(GAMBIT_TABLE_CSS, /@media \(max-width:480px\)\{\n\.dfgambit\{max-height:70vh\}\n\.dfgambit\.dfgambit-battle:not\(\.dfgambit-more\)\{max-height:25vh\}\n\}/, 'on a portrait phone the sheet 70% of the screen, the strip a quarter of it - in landscape the chrome\'s own bound');
  assert.match(GAMBIT_TABLE_CSS, /\.dfgambit\.dfgambit-battle:not\(\.dfgambit-more\)\{left:auto;right:0;width:30vw/, 'in landscape a column at the right');
});

const every = (n, out = []) => { out.push(n); for (const c of n.children ?? []) every(c, out); return out; };
const classesIn = (n) => new Set(every(n).flatMap((x) => String(x.className ?? '').split(/\s+/).filter(Boolean)));
/** A sheet's rules, a selector list split where no bracket is open (the dress writes :is(a, b)). */
const rulesIs = (css) => [...css.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sels: m[1].split(/,(?![^(]*\))/).map((x) => x.trim()), body: m[2] }));
const classWords = (sel) => [...sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);

test('KG3 THE WORDS ARE ITS OWN (CARDS-PLUS\'s law, the third panel): every class the painter writes over every stage - the setup with a stake refused and one chosen, the guide and the words open; the army with a unit shown, the grid dimmed and the rows; the battle with a piece chosen, a move staged under a finger, More, a piece\'s and a cell\'s information, an armed press and the log; the regular\'s turn; every result; folded - is styled by no rule from outside the panel in any sheet the game injects, and every class its own sheet, its roles and the dress\'s own block name is one it writes; the Grimoire dress re-says its marks - the armed press and the keyboard in the pack\'s red, a name, a term and the result\'s head in the ink on the page and never on wood, the win green and the loss red, a lit pip and step gold leaf - and leaves a chosen tile and row to the kit\'s own marks (mutants: a bare word; the dress\'s lit word; the ink on the wood; the chosen re-said)', async () => {
  const words = new Set();
  const doc = fakeDoc();
  const hud = createGambitTableHud({ onPress: () => {}, doc });
  const paint = (m) => { hud.render(m); for (const w of classesIn(hud.root)) words.add(w); };
  paint(setup({ regular: 1, stakeMult: 2, guideOpen: true, wordsOpen: true, why: 'No.' }));
  paint(setup({ regular: 2, purse: 10 }));
  paint(gambitHudModel({ phase: 'army', army: autoFill([], KG_POINT_BUDGET, xorshift(3)), crown: 'sentinel', regulars: REGS, regular: 1, stakeMult: 2, purse: 5000, pressed: 0, said: 'x' }));
  const { st, dealtCounts } = dealt();
  const mine = st.pieces.find((p) => p.side === 0 && reachable(st, p).length);
  const [c, r] = reachable(st, mine)[0];
  paint(battle(st, { dealt: dealtCounts, selected: mine.id, staged: { kind: 'move', col: c, row: r }, touch: true }));
  paint(battle(st, { more: true, info: { piece: mine.id }, armed: 'forfeit', log: ['You move.', 'Bors strikes.'] }));
  paint(battle(st, { info: { cell: [c, r] }, armiesOpen: true }));
  paint(battle(finishTurn(gambitAct(st, 0, { type: 'end' }).state, xorshift(1)).state));
  const over = (o, stake = 100, spent = false) => gambitHudModel({ phase: 'over', game: { state: st, crowns: ['daggerfall', 'orsinium'], name: 'Bors', stake, over: o, dealt: [1, 1], nightSpent: spent } });
  for (const o of [{ winner: 0, by: 'king' }, { winner: 1, by: 'forfeit' }, { winner: null, by: 'void' }]) paint(over(o, 100, true));
  // AUDIT KG II D15: the board online too - its seats, the gold table's picks, the season board, a watcher, a result
  const seats = [{ name: 'Ana', ready: true, mine: false, stake: 50 }, { name: 'Ves', ready: false, mine: true, stake: null }];
  const online = { seats, names: ['Ana', 'Ves'], canSit: false, ready: false, step: 'theirReady', stepArgs: { name: 'Ana', a: 'Ana', b: 'Ves' }, watching: false, clock: 42, gold: true,
    stakes: [10, 50, 200].map((n) => ({ n, enabled: n === 50, chosen: n === 50, why: n === 50 ? null : 'Ana stakes 50 gold. Match it to play.' })), staking: false, canBoard: true };
  const board = { season: { n: 4 }, rows: [{ rank: 1, name: 'Eira', rating: 1612, wins: 14, losses: 2 }, { rank: 2, name: 'Ves', rating: 1530, wins: 6, losses: 4, you: true }], me: { rating: 1530, wins: 6, losses: 4, games: 10 }, champion: { name: 'Eira' }, titleNeeds: { games: 10, foes: 5 } };
  paint(gambitHudModel({ phase: 'setup', online: { ...online, step: 'sit', canSit: true }, canOnline: true, crown: 'daggerfall', board, boardOpen: true }));
  paint(gambitHudModel({ phase: 'army', online, canOnline: true, army: autoFill([], KG_POINT_BUDGET, xorshift(3)), crown: 'daggerfall' }));
  paint(gambitHudModel({ phase: 'battle', online: { ...online, watching: true }, game: { state: st, crowns: ['daggerfall', 'orsinium'], name: 'Ana', stake: 0, pot: 100, over: null, dealt: dealtCounts }, touch: true }));
  paint(gambitHudModel({ phase: 'over', online: { ...online, watching: true, canSit: true, step: 'sit' }, game: { state: st, crowns: ['daggerfall', 'orsinium'], name: 'Ana', stake: 0, pot: 100, over: { winner: 0, by: 'king', how: 'king' }, dealt: dealtCounts }, board, boardOpen: true }));
  all(hud.root, 'fold')[0].fire('click');
  for (const w of classesIn(hud.root)) words.add(w);
  for (const w of ['dfgambit', 'collapsed', 'dfgambit-battle', 'dfgambit-more', 'tablehead', 'tabletitle', 'fold', 'msg', 'warn', 'wait', 'turn', 'tableacts', 'log', 'on',
    'dfgambit-body', 'dfgambit-block', 'dfgambit-what', 'dfgambit-list', 'dfgambit-regular', 'dfgambit-step', 'dfgambit-lit', 'dfgambit-chip', 'dfgambit-regname', 'dfgambit-line',
    'dfgambit-dim', 'dfgambit-sec', 'dfgambit-tiles', 'dfgambit-stake', 'dfgambit-crown', 'dfgambit-chips', 'dfgambit-face', 'dfgambit-grid', 'dfgambit-unit', 'dfgambit-off',
    'dfgambit-uname', 'dfgambit-cost', 'dfgambit-armyrow', 'dfgambit-grow', 'dfgambit-chiprow', 'dfgambit-pips', 'dfgambit-pip', 'dfgambit-info', 'dfgambit-piece',
    'dfgambit-meter', 'dfgambit-fill', 'dfgambit-result', 'dfgambit-head', 'dfgambit-won', 'dfgambit-lost', 'dfgambit-para', 'dfgambit-term', 'dfgambit-seat', 'dfgambit-rank']) assert.ok(words.has(w), `the painter wrote ${w} (the sweep reads what it paints)`);
  for (const w of ['card', 'row', 'note', 'head', 'side', 'acts', 'chip', 'won', 'lost', 'sel']) assert.equal(words.has(w), false, `the bare '${w}'`);
  const { rules: all_ } = await uiSheetRules();
  const own = new Set([...words].filter((w) => /^dfgambit(-|$)/.test(w)));
  assert.deepEqual(collisions(all_, words, own), [], 'a rule from outside the panel styles a class it writes');
  const back = collisions(all_, new Set([...words, 'card', 'row', 'note', 'side']), own);
  for (const w of ['card', 'row', 'note', 'side']) assert.ok(back.some((x) => x.includes(`ENHANCED_CSS .${w} {`)), `the law bites on the bare .${w}`);
  // no dead word: the panel's own sheet (past the face and the chrome), its roles and the dress's own block name what it writes
  for (const rl of rulesIs(GAMBIT_TABLE_CSS.replace(PIXELIFY_FIVE_FACE, '').replace(cardPanelChromeCss('.dfgambit'), ''))) for (const sel of rl.sels) for (const w of classWords(sel)) assert.ok(words.has(w), `the sheet's ${sel}: .${w} is never written`);
  for (const sel of Object.values(FRAME_ROLES).flat().filter((x) => /dfgambit/.test(x))) for (const w of classWords(sel)) assert.ok(words.has(w), `the role ${sel}: .${w} is never written`);
  const dress = rulesIs(kitCss());
  const block = dress.filter((rl) => rl.sels.every((x) => x.startsWith(`${G} body .dfgambit `)));
  assert.ok(block.length >= 6, 'the dress\'s own block');
  for (const rl of block) for (const sel of rl.sels) for (const w of classWords(sel)) assert.ok(words.has(w), `the dress's ${sel}: .${w} is never written`);
  // the marks, re-said
  const T = GRIM_TONES;
  const said = (start, re) => dress.some((rl) => rl.sels.some((x) => x.startsWith(`${G} ${start}`)) && re.test(rl.body));
  assert.ok(said('body .dfgambit button[data-armed="true"]', new RegExp(`outline: 2px solid ${T.red} !important`)), 'the armed press in the pack\'s red');
  assert.ok(said('body .dfgambit [tabindex="0"]:focus-visible', new RegExp(`outline: 2px solid ${T.red} !important`)), 'the keyboard\'s ring, as the other two panels\'');
  const inked = block.find((rl) => rl.sels[0].startsWith(`${G} body .dfgambit :is(.dfgambit-regname, .dfgambit-term, .dfgambit-head)`));
  assert.ok(inked && inked.body.includes(`color: ${T.ink} !important`), 'a name, a term and the head in the ink');
  assert.ok(inked.sels[0].includes(':is([data-grim="ink"], [data-grim="ink"] *)') && inked.sels[0].includes(':not([data-grim="wood"], [data-grim="wood"] *)'), 'on the page, never on the wood');
  assert.ok(WOOD_ROOTS.includes('body .dfgambit-face') && INK_ROOTS.includes('body .dfgambit-sec'), 'a unit\'s name in its picture\'s well stands on wood');
  assert.ok(said('body .dfgambit .dfgambit-head.dfgambit-won:is(', /color: #1d5530 !important/) && said('body .dfgambit .dfgambit-head.dfgambit-lost:is(', new RegExp(`color: ${T.red} !important`)), 'the win yours, the loss the pack\'s red');
  assert.ok(said('body .dfgambit .dfgambit-pip.dfgambit-lit', new RegExp(`background: ${T.goldLeaf} !important`)) && said('body .dfgambit .dfgambit-step i.dfgambit-lit', new RegExp(`background: ${T.goldLeaf} !important`)), 'lit, gold leaf on the wooden chip');
  assert.ok(!block.some((rl) => rl.sels.some((x) => /aria-pressed|\.on\b/.test(x))), 'a chosen tile and row: the kit\'s own marks (NO-BAR)');
  hud.destroy();
});

test('KG3 the board\'s cursor: the arrows and the d-pad walk it, the board\'s edges hold it (mutant: an edge)', () => {
  assert.deepEqual(boardCursorStep([7, 12], 'ArrowUp'), [7, 11]);
  assert.deepEqual(boardCursorStep([0, 0], 'ArrowLeft'), [0, 0]);
  assert.deepEqual(boardCursorStep([KG_COLS - 1, KG_ROWS - 1], 'ArrowRight'), [KG_COLS - 1, KG_ROWS - 1]);
  assert.deepEqual(boardCursorStep([KG_COLS - 1, KG_ROWS - 1], 'ArrowDown'), [KG_COLS - 1, KG_ROWS - 1]);
  assert.deepEqual(boardCursorStep([3, 3], 'KeyQ'), [3, 3]);
});
