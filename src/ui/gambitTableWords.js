// @ts-check
// KG3 (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md sections 14.4-14.6 and 16): THE KING'S GAMBIT'S WORDS - every
// sentence the table says, one home, each one pattern through the text core (`t`, `cards.kingsGambit.*`) read when it
// is said, never at module load (tools/l10n/ROUTE-BRIEF.md), its numbers the law's own exports handed in as arguments
// (Plain Words law 3: a typed number is a mutant the pins kill). The panel (ui/gambitTableHud.js) and the table's half
// (scenes/gambitTableGame.js) read them.
//
// NAMES (14.6): a unit is named through Daggerfall Unity's own lookup (getLocalizedEnemyName - its pack's name for the
// creature or the calling), never the law's canonical English; a king is "{name}, King of {crown}" off the Bay deck's
// crowns (render/cardFaces.js SUIT_CROWNS) - never the law's KG_KINGS, the mod's classes; the regulars' and the kings'
// own names are never translated. NO PRONOUN GUESSED (D10): a regular is named, never "he" - the regulars are of both
// genders - and the mod's "He fields ...", "He will not sit down ...", "Protect him!" are said round the name or not at
// all. "Press", never "click": the table is a finger's too (CARDS-TOUCH).
//
// Not a DFU member: Daggerfall Unity has no such game - the mod does. Ledger A row (THE KING'S GAMBIT).
import {
  KG_COLS, KG_ROWS, KG_POINT_BUDGET, KG_MAX_UNITS, KG_RANGED_COST_FACTOR, KG_ACTIONS_PER_TURN, KG_POTIONS_PER_SIDE,
  KG_POTION_HEAL, KG_MOVE_RANGE, KG_RANGED_RANGE, KG_BLOW_LOW, KG_BLOW_SPREAD, KG_HAZARD_DAMAGE, KG_HAZARD_SPAWN_EVERY,
  KG_KING_LEVEL, KG_KING_HP, KG_KINGS, rosterUnit,
} from '../net/kingsGambit.js';
import { GAMBIT_STAKE_MULTS, GAMBIT_WIN_PAYS, crownIndex } from '../systems/gambit/gambitTableSession.js';
import { GAMBIT_IDLE_TURNS, GAMBIT_TURN_MS } from '../net/gambit/gambitTable.js';   // AUDIT KG II D9/D20: the online clock's numbers, the law's
import { GAMBIT_ONLINE_STAKES } from '../net/gambit/gambitStakes.js';
import { SUIT_CROWNS } from '../render/cardFaces.js';
import { t, getLocalizedEnemyName, intlLocale } from '../systems/textManager.js';

/** Percent of a factor, as the guide says it ("35% more"). */
const pct = (/** @type {number} */ x) => Math.round(x * 100);

// ── THE NAMES ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A unit's name as the player reads it: Daggerfall Unity's own (a pack's), else the law's. @param {number} id */
export const unitName = (id) => getLocalizedEnemyName(id, rosterUnit(id)?.name ?? '?');
/** The crown's King off the Bay deck: their name and their crown's. @param {any} crown a GAMBIT_CROWNS key */
const crownKing = (crown) => { const c = SUIT_CROWNS[crownIndex(crown)]; return { name: c.courts[2].name, crown: c.crown }; };
/** A king's whole title, "{name}, King of {crown}" - a list's or a label's: the crowns, the army's line, the box's head.
 *  @param {any} crown a GAMBIT_CROWNS key */
export const kingName = (crown) => t('cards.kingsGambit.king.name', '{name}, King of {crown}', crownKing(crown));
/** A king inside a sentence, "King {name}" - the log's, a refusal's, a press's: a whole title there wants commas round it
 *  ("Your Gothryd, King of Daggerfall moves." - FOUND AT KG3). @param {any} crown a GAMBIT_CROWNS key */
export const kingShort = (crown) => t('cards.kingsGambit.king.short', 'King {name}', { name: crownKing(crown).name });
/** A piece's name inside a sentence: a king's by its side's crown, a unit's by its kind (the law's `unit`, a mobile type).
 *  @param {{side: number, unit: number, king: boolean}} p @param {string[]} crowns the two sides' */
export const pieceName = (p, crowns) => (p.king ? kingShort(crowns[p.side]) : unitName(p.unit));

/** A tier's name and its words (the mod's blurbs, said round the tier - never "he", AUDIT KG D10). @param {string} key */
export function tierName(key) {
  switch (key) {
    case 'amateur': return t('cards.kingsGambit.tier.amateur.name', 'Amateur');
    case 'seasoned': return t('cards.kingsGambit.tier.seasoned.name', 'Seasoned');
    case 'veteran': return t('cards.kingsGambit.tier.veteran.name', 'Veteran');
    default: return t('cards.kingsGambit.tier.grandmaster.name', 'Grandmaster');
  }
}
export function tierBlurb(/** @type {string} */ key) {
  switch (key) {
    case 'amateur': return t('cards.kingsGambit.tier.amateur.blurb', 'A few drinks in, and barely sure of the rules.');
    case 'seasoned': return t('cards.kingsGambit.tier.seasoned.blurb', 'Plays most nights, and knows the game.');
    case 'veteran': return t('cards.kingsGambit.tier.veteran.blurb', 'A shrewd tactician who rarely makes a mistake.');
    default: return t('cards.kingsGambit.tier.grandmaster.blurb', 'Legendary across the Iliac Bay. Bring your best army.');
  }
}
/** A board's name, by the law's layout key (the law keeps keys; the words are the client's - L10N4). @param {string} key */
export function layoutName(key) {
  switch (key) {
    case 'pillared-hall': return t('cards.kingsGambit.layout.pillaredHall', 'Pillared hall');
    case 'guard-rooms': return t('cards.kingsGambit.layout.guardRooms', 'Guard rooms');
    case 'ruined-keep': return t('cards.kingsGambit.layout.ruinedKeep', 'Ruined keep');
    case 'moat-and-bridges': return t('cards.kingsGambit.layout.moatAndBridges', 'Moat and bridges');
    default: return t('cards.kingsGambit.layout.openField', 'Open field');
  }
}
/** A hazard's name by its kind (the law's key). @param {string} kind */
export function hazardName(kind) {
  switch (kind) {
    case 'fire': return t('cards.kingsGambit.hazard.fire', 'Fire');
    case 'spikes': return t('cards.kingsGambit.hazard.spikes', 'Spikes');
    default: return t('cards.kingsGambit.hazard.poison', 'Poison');
  }
}

// ── THE FOUR BLOCKS (PLAIN-UI a: what it is, the next step, how it works, the words) ──────────────────────────────

/** WHAT THIS IS (law 1). */
export const gambitWhat = () => t('cards.kingsGambit.what', 'The King\'s Gambit is a game of armies and kings, played on a board of {cols} by {rows, plural, one {# cell} other {# cells}}. Each side protects its king. Defeat the other king to win.', { cols: KG_COLS, rows: KG_ROWS });

/** HOW THE KING'S GAMBIT WORKS (law 4): seven short paragraphs, every number the law's. AUDIT KG II D9: at the board
 *  online (`online` - `{gold}`), its first two are another player's and that table's gold, never a regular's.
 *  @param {{gold?: boolean}|null} [online] */
export function gambitGuide(online = null) {
  const [a, b, c] = GAMBIT_STAKE_MULTS;
  const first = online ? [
    { head: t('cards.kingsGambit.guide.online.head', 'Play another player'), body: t('cards.kingsGambit.guide.online.body', 'Sit at the board, build your army and press Ready. The game starts when both players are ready. Each turn lasts {s} seconds. If your clock runs out {idle, plural, one {# turn} other {# turns}} in a row, you lose.', { s: GAMBIT_TURN_MS / 1000, idle: GAMBIT_IDLE_TURNS }) },
    online.gold
      ? { head: t('cards.kingsGambit.guide.onlineGold.head', 'Stake gold'), body: t('cards.kingsGambit.guide.onlineGold.body', 'At the gold table both players stake the same amount: {stakes} gold. The winner takes the pot, both stakes. If you lose, forfeit, leave mid-game or let the clock run out, the other player takes it.', { stakes: GAMBIT_ONLINE_STAKES.join(', ') }) }
      : { head: t('cards.kingsGambit.guide.onlineFun.head', 'For fun'), body: t('cards.kingsGambit.guide.onlineFun.body', 'No gold changes hands at this table. A game between two registered accounts counts on the season board.') },
  ] : [
    { head: t('cards.kingsGambit.guide.regular.head', 'Choose a regular'), body: t('cards.kingsGambit.guide.regular.body', 'Each regular plays at a rank. A higher rank means a bigger army, more potions, fewer blunders and a higher minimum stake.') },
    { head: t('cards.kingsGambit.guide.stake.head', 'Put down your stake'), body: t('cards.kingsGambit.guide.stake.body', 'Stake {a}, {b} or {c} times the regular\'s minimum stake. If you win, you get back {pay} times your stake. If you lose, forfeit or stand up mid-game, the regular keeps it.', { a, b, c, pay: GAMBIT_WIN_PAYS }) },
  ];
  return [
    ...first,
    { head: t('cards.kingsGambit.guide.army.head', 'Build your army'), body: t('cards.kingsGambit.guide.army.body', 'Up to {units, plural, one {# unit} other {# units}} for {points, plural, one {# point} other {# points}}. Stronger units cost more, and ranged units cost {pct}% extra. Your king joins for free.', { units: KG_MAX_UNITS, points: KG_POINT_BUDGET, pct: pct(KG_RANGED_COST_FACTOR - 1) }) },
    { head: t('cards.kingsGambit.guide.turn.head', 'Take your turn'), body: t('cards.kingsGambit.guide.turn.body', '{actions, plural, one {# action} other {# actions}} a turn: move a piece up to {move, plural, one {# cell} other {# cells}}, strike, or give one of your pieces a potion that heals {heal} health. You have {potions, plural, one {# potion} other {# potions}} a game.', { actions: KG_ACTIONS_PER_TURN, move: KG_MOVE_RANGE, heal: KG_POTION_HEAL, potions: KG_POTIONS_PER_SIDE }) },
    { head: t('cards.kingsGambit.guide.strike.head', 'Strike'), body: t('cards.kingsGambit.guide.strike.body', 'A melee piece strikes the cell next to it. A ranged piece shoots up to {range, plural, one {# cell} other {# cells}} when nothing is in the way. A hit does {low}% to {high}% of the attacker\'s attack.', { range: KG_RANGED_RANGE, low: pct(KG_BLOW_LOW), high: pct(KG_BLOW_LOW + KG_BLOW_SPREAD) }) },
    { head: t('cards.kingsGambit.guide.ground.head', 'Mind the ground'), body: t('cards.kingsGambit.guide.ground.body', 'Walls and pillars block movement and shots. Water blocks movement, but shots pass over it. Every {every, plural, one {round} other {# rounds}}, warning cells turn into fire ({fire}), spikes ({spikes}) or poison ({poison}). A piece that ends its turn on one loses that much health.', { every: KG_HAZARD_SPAWN_EVERY, fire: KG_HAZARD_DAMAGE.fire, spikes: KG_HAZARD_DAMAGE.spikes, poison: KG_HAZARD_DAMAGE.poison }) },
    { head: t('cards.kingsGambit.guide.win.head', 'Win'), body: t('cards.kingsGambit.guide.win.body', 'Defeat the other king, or every piece on the other side.') },
  ];
}

/** WORDS ON THIS TABLE (law 2): each term over its meaning. AUDIT KG II D9: at the board online (`online`), the words
 *  it prints too. @param {boolean} [online] */
export function gambitWords(online = false) {
  return [
    ...(online ? [
      { term: t('cards.kingsGambit.words.ready.term', 'Ready'), meaning: t('cards.kingsGambit.words.ready.meaning', 'Your army is built and, at the gold table, your stake is placed. The game starts when both players are ready.') },
      { term: t('cards.kingsGambit.words.clock.term', 'Turn clock'), meaning: t('cards.kingsGambit.words.clock.meaning', 'Each turn lasts {s} seconds. If it runs out {idle, plural, one {# turn} other {# turns}} in a row, you lose.', { s: GAMBIT_TURN_MS / 1000, idle: GAMBIT_IDLE_TURNS }) },
      { term: t('cards.kingsGambit.words.pot.term', 'Pot'), meaning: t('cards.kingsGambit.words.pot.meaning', 'Both stakes, held by the table. The winner takes all of it.') },
      { term: t('cards.kingsGambit.words.season.term', 'Season board'), meaning: t('cards.kingsGambit.words.season.meaning', 'The season\'s ranking of rated games.') },
      { term: t('cards.kingsGambit.words.rated.term', 'Rated game'), meaning: t('cards.kingsGambit.words.rated.meaning', 'A game between two registered accounts. It moves both players\' ratings.') },
      { term: t('cards.kingsGambit.words.grandmaster.term', 'Grandmaster (the title)'), meaning: t('cards.kingsGambit.words.grandmaster.meaning', 'The title held by the season board\'s top player. It is separate from the regulars\' Grandmaster rank.') },
    ] : []),
    { term: t('cards.kingsGambit.words.regular.term', 'Regular'), meaning: t('cards.kingsGambit.words.regular.meaning', 'A tavern local at this table who plays against you.') },
    { term: t('cards.kingsGambit.words.tier.term', 'Tier'), meaning: t('cards.kingsGambit.words.tier.meaning', 'How strong a regular plays: Amateur, Seasoned, Veteran or Grandmaster.') },
    { term: t('cards.kingsGambit.words.blunder.term', 'Blunder'), meaning: t('cards.kingsGambit.words.blunder.meaning', 'A careless move a regular makes now and then. Lower-ranked regulars blunder more often.') },
    { term: t('cards.kingsGambit.words.leastStake.term', 'Minimum stake'), meaning: t('cards.kingsGambit.words.leastStake.meaning', 'The smallest stake a regular will play for.') },
    { term: t('cards.kingsGambit.words.stake.term', 'Stake'), meaning: t('cards.kingsGambit.words.stake.meaning', 'The gold you bet. The table holds it until the game ends.') },
    { term: t('cards.kingsGambit.words.forFun.term', 'For fun'), meaning: t('cards.kingsGambit.words.forFun.meaning', 'A game with no gold at stake: any game against a regular online or one who has paid out all they will tonight, and any game at a no-gold table.') },
    { term: t('cards.kingsGambit.words.crown.term', 'Crown'), meaning: t('cards.kingsGambit.words.crown.meaning', 'The kingdom whose King leads your army.') },
    { term: t('cards.kingsGambit.words.king.term', 'King'), meaning: t('cards.kingsGambit.words.king.meaning', 'Your most important piece. If your king falls, you lose.') },
    { term: t('cards.kingsGambit.words.army.term', 'Army'), meaning: t('cards.kingsGambit.words.army.meaning', 'The units you take into the game.') },
    { term: t('cards.kingsGambit.words.points.term', 'Points'), meaning: t('cards.kingsGambit.words.points.meaning', 'What you build your army with. Never gold.') },
    { term: t('cards.kingsGambit.words.level.term', 'Level'), meaning: t('cards.kingsGambit.words.level.meaning', 'How experienced a unit is. Higher levels hit harder.') },
    { term: t('cards.kingsGambit.words.health.term', 'Health'), meaning: t('cards.kingsGambit.words.health.meaning', 'How much damage a piece can take before it falls.') },
    { term: t('cards.kingsGambit.words.attack.term', 'Attack'), meaning: t('cards.kingsGambit.words.attack.meaning', 'How hard a piece strikes.') },
    { term: t('cards.kingsGambit.words.melee.term', 'Melee'), meaning: t('cards.kingsGambit.words.melee.meaning', 'Strikes only the cell next to it.') },
    { term: t('cards.kingsGambit.words.ranged.term', 'Ranged'), meaning: t('cards.kingsGambit.words.ranged.meaning', 'Shoots from a distance when nothing is in the way.') },
    { term: t('cards.kingsGambit.words.autofill.term', 'Auto-fill'), meaning: t('cards.kingsGambit.words.autofill.meaning', 'Fills the rest of your army for you.') },
    { term: t('cards.kingsGambit.words.action.term', 'Turn and action'), meaning: t('cards.kingsGambit.words.action.meaning', 'Each turn gives you actions: a move, a strike or a potion is one.') },
    { term: t('cards.kingsGambit.words.move.term', 'Move'), meaning: t('cards.kingsGambit.words.move.meaning', 'A piece walks a few cells, around walls, pillars and water.') },
    { term: t('cards.kingsGambit.words.potion.term', 'Potion'), meaning: t('cards.kingsGambit.words.potion.meaning', 'Heals one of your pieces. Each side has a few a game.') },
    { term: t('cards.kingsGambit.words.round.term', 'Round'), meaning: t('cards.kingsGambit.words.round.meaning', 'Your turn and the other side\'s together.') },
    { term: t('cards.kingsGambit.words.hazard.term', 'Fire, Spikes and Poison'), meaning: t('cards.kingsGambit.words.hazard.meaning', 'Hazards on the board. A piece that ends its turn on one is hurt.') },
    { term: t('cards.kingsGambit.words.warning.term', 'Warning'), meaning: t('cards.kingsGambit.words.warning.meaning', 'A cell where a hazard is coming. It hurts nobody yet.') },
    { term: t('cards.kingsGambit.words.ground.term', 'Wall, Pillar and Water'), meaning: t('cards.kingsGambit.words.ground.meaning', 'Cells no piece can walk on. Walls and pillars also block shots. Water does not.') },
    { term: t('cards.kingsGambit.words.layout.term', 'Layout'), meaning: t('cards.kingsGambit.words.layout.meaning', 'The shape of the board, chosen at random each game.') },
    { term: t('cards.kingsGambit.words.reach.term', 'Reach'), meaning: t('cards.kingsGambit.words.reach.meaning', 'The cells a piece can move to now.') },
    { term: t('cards.kingsGambit.words.range.term', 'Range and Target'), meaning: t('cards.kingsGambit.words.range.meaning', 'The cells a piece can strike, and a foe it can strike now.') },
    { term: t('cards.kingsGambit.words.fallen.term', 'Fallen'), meaning: t('cards.kingsGambit.words.fallen.meaning', 'The pieces a side has lost.') },
    { term: t('cards.kingsGambit.words.forfeit.term', 'Forfeit'), meaning: t('cards.kingsGambit.words.forfeit.meaning', 'You give up the game and lose your stake.') },
  ];
}

// ── THE SETUP ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A regular's row: what makes the tier hard, the least stake, what is left of the night (14.5). */
export function regularLines(/** @type {{name: string, tier: any, nightLeft: number, forFun: boolean}} */ r, /** @type {boolean} */ friendly) {
  const T = r.tier, blunder = pct(T.blunder);
  return {
    tier: tierName(T.key),
    fields: blunder > 0
      ? t('cards.kingsGambit.regular.fields', 'An army of {points, plural, one {# point} other {# points}} - {potions, plural, one {# potion} other {# potions}} - blunders {pct}% of the time', { points: T.budget, potions: T.potions, pct: blunder })
      : t('cards.kingsGambit.regular.fieldsNever', 'An army of {points, plural, one {# point} other {# points}} - {potions, plural, one {# potion} other {# potions}} - never blunders', { points: T.budget, potions: T.potions }),
    least: t('cards.kingsGambit.regular.least', 'Sits down for {stake, number} gold or more', { stake: T.stake }),
    blurb: tierBlurb(T.key),
    night: friendly ? t('cards.kingsGambit.regular.online', 'Online, the regulars play for fun')
      : r.forFun ? t('cards.kingsGambit.regular.forFun', 'Plays for fun tonight')
        : t('cards.kingsGambit.regular.nightLeft', 'Can still pay {left, number} gold tonight', { left: r.nightLeft }),
  };
}
/** A stake's tile: "×{m} - {gold} gold". */
export const stakeLabel = (/** @type {number} */ m, /** @type {number} */ gold) => t('cards.kingsGambit.stake.pick', '×{m} - {gold, number} gold', { m, gold });
/** What the stake does, said before it is put down. */
export const stakeWhat = (/** @type {number} */ stake, /** @type {string} */ name) => t('cards.kingsGambit.stake.what', 'Win: you take back {pay, number} gold. Lose, forfeit or stand up mid-game: {name} keeps your {stake, number} gold.', { pay: stake * GAMBIT_WIN_PAYS, stake, name });
/** Why a stake's pick is refused: past the purse, or past the regular's night. */
export const stakePurse = (/** @type {number} */ gold, /** @type {number} */ stake) => t('cards.kingsGambit.stake.purse', 'You have {gold, number} gold, which is not enough for a stake of {stake, number}.', { gold, stake });
export const stakeNight = (/** @type {string} */ name, /** @type {number} */ left) => t('cards.kingsGambit.stake.night', '{name} can pay out only {left, number} gold more tonight.', { name, left });
/** The king's line under the crowns. */
export const kingLine = () => t('cards.kingsGambit.king.line', 'The crown only changes how your king looks. Every king plays the same: level {level}, {hp} health, attack {attack}.', { level: KG_KING_LEVEL, hp: KG_KING_HP, attack: KG_KINGS[0].atk });

// ── THE ARMY ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A unit's numbers in words (THE UNIT, shown large). @param {{level: number, hp: number, atk: number, ranged: boolean}} u */
export const unitLine = (u) => (u.ranged
  ? t('cards.kingsGambit.unit.ranged', 'Level {level} - Health {hp} - Attack {attack} - Ranged ({range, plural, one {# cell} other {# cells}})', { level: u.level, hp: u.hp, attack: u.atk, range: KG_RANGED_RANGE })
  : t('cards.kingsGambit.unit.melee', 'Level {level} - Health {hp} - Attack {attack} - Melee', { level: u.level, hp: u.hp, attack: u.atk }));
/** A unit's cost in points (never gold). */
export const unitCost = (/** @type {number} */ cost) => t('cards.kingsGambit.unit.cost', '{cost, plural, one {# point} other {# points}}', { cost });
/** A tile's chips, short: level, health, attack, melee or ranged, cost. */
export const unitChips = (/** @type {{level: number, hp: number, atk: number, ranged: boolean, cost: number}} */ u) => [
  t('cards.kingsGambit.chip.level', 'Lv {n}', { n: u.level }),
  t('cards.kingsGambit.chip.health', 'HP {n}', { n: u.hp }),
  t('cards.kingsGambit.chip.attack', 'Atk {n}', { n: u.atk }),
  u.ranged ? t('cards.kingsGambit.chip.ranged', 'Ranged') : t('cards.kingsGambit.chip.melee', 'Melee'),
  t('cards.kingsGambit.chip.cost', '{n} pts', { n: u.cost }),
];
/** The army's two chips. */
export const armyPointsLeft = (/** @type {number} */ left) => t('cards.kingsGambit.army.pointsLeft', 'Points left {left} of {budget}', { left, budget: KG_POINT_BUDGET });
export const unitsHeld = (/** @type {number} */ n) => t('cards.kingsGambit.army.units', 'Units {n} of {max}', { n, max: KG_MAX_UNITS });
/** The king's line under the army. */
export const armyKingLine = (/** @type {string} */ crown) => t('cards.kingsGambit.army.king', 'Your king: {king} (free). If your king falls, you lose.', { king: kingName(crown) });
/** A press on a unit, said: it joined, or why not. */
export const unitJoined = (/** @type {number} */ id) => t('cards.kingsGambit.army.joined', '{name} joins your army.', { name: unitName(id) });
export const unitLeft = (/** @type {number} */ id) => t('cards.kingsGambit.army.left', '{name} leaves your army.', { name: unitName(id) });
export const unitTooDear = (/** @type {number} */ id, /** @type {number} */ left) => t('cards.kingsGambit.army.tooDear', '{name} costs {cost, plural, one {# point} other {# points}}; you have {left} left.', { name: unitName(id), cost: rosterUnit(id)?.cost ?? 0, left });
export const armyFull = () => t('cards.kingsGambit.army.full', 'Your army is full: {max, plural, one {# unit} other {# units}}.', { max: KG_MAX_UNITS });

// ── THE TURN ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** The actions left, in words beside the pips. */
export const actionsLeft = (/** @type {number} */ n) => t('cards.kingsGambit.turn.actions', '{n} of {max} actions left', { n, max: KG_ACTIONS_PER_TURN });
/** AUDIT KG II D4: a watcher's - whose actions they are. @param {string} name @param {number} n */
export const actionsLeftOf = (name, n) => t('cards.kingsGambit.turn.actionsOf', '{name}: {n} of {max} actions left', { name, n, max: KG_ACTIONS_PER_TURN });

/** THE LAW'S REFUSALS, IN WORDS (gambitRefusal's and armyRefusal's, 14.9): a word the law answers said to the player. */
export function refusalWords(/** @type {string} */ word, /** @type {{piece?: string, target?: string}} */ a = {}) {
  switch (word) {
    case 'full': return t('cards.kingsGambit.refuse.full', '{piece} is at full health.', { piece: a.piece ?? '' });
    case 'potions': return t('cards.kingsGambit.refuse.potions', 'You have no potions left.');
    case 'cell': return t('cards.kingsGambit.refuse.cell', '{piece} cannot reach that cell.', { piece: a.piece ?? '' });
    case 'range': return t('cards.kingsGambit.refuse.range', '{target} is out of range.', { target: a.target ?? '' });   // AUDIT KG II D21: reach is a move's, range a blow's
    case 'target': return t('cards.kingsGambit.refuse.target', 'Strike a piece of the other side.');
    case 'piece': return t('cards.kingsGambit.refuse.piece', 'Choose one of your own pieces.');
    case 'turn': return t('cards.kingsGambit.refuse.turn', 'It is not your turn.');
    case 'ending': return t('cards.kingsGambit.refuse.ending', 'Your turn is ending.');
    case 'over': return t('cards.kingsGambit.refuse.over', 'The game is over.');
    case 'empty': return t('cards.kingsGambit.refuse.empty', 'Your army needs one unit at least.');
    case 'units': return t('cards.kingsGambit.refuse.units', 'Your army is full: {max, plural, one {# unit} other {# units}}.', { max: KG_MAX_UNITS });
    case 'points': return t('cards.kingsGambit.refuse.points', 'Your army costs more than {points, plural, one {# point} other {# points}}.', { points: KG_POINT_BUDGET });
    case 'rand': return t('cards.kingsGambit.refuse.rand', 'The table could not deal this game. Nothing was lost.');
    default: return t('cards.kingsGambit.refuse.shape', 'That cannot be done now.');
  }
}

// ── THE INFORMATION BOX ───────────────────────────────────────────────────────────────────────────────────────────

/** Names as the player's language lists them ("A, B and C"). @param {string[]} names */
const listOf = (names) => {
  try { return new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format(names); } catch { return names.join(', '); }
};
/** A cell, described (TileDescription's, in plain words): open floor, ground no piece walks on, a hazard, a warning. */
export function cellWords(/** @type {{tile: number, hazard: any, round: number}} */ c) {
  if (c.hazard?.active) return t('cards.kingsGambit.cell.hazard', '{kind}: a piece that ends its turn here loses {damage} health.', { kind: hazardName(c.hazard.kind), damage: KG_HAZARD_DAMAGE[c.hazard.kind] });
  if (c.hazard) return t('cards.kingsGambit.cell.warning', 'Warning: this cell becomes {kind, select, fire {fire} spikes {spikes} other {poison}} at the end of round {round}. It is harmless until then.', { kind: c.hazard.kind, round: c.round });
  switch (c.tile) {
    case 1: return t('cards.kingsGambit.cell.wall', 'A wall: no piece walks through it, and it blocks a ranged shot.');
    case 2: return t('cards.kingsGambit.cell.pillar', 'A pillar: no piece walks through it, and it blocks a ranged shot.');
    case 3: return t('cards.kingsGambit.cell.water', 'Water: it cannot be crossed on foot, but ranged attacks pass over it.');
    default: return t('cards.kingsGambit.cell.floor', 'Open floor.');
  }
}
/** A piece's lines: its side, its numbers, its reach, whom it can strike now, a king's warning. */
export function pieceInfoLines(/** @type {{name: string, mine: boolean, regular: string, piece: any, foes: string[], hazard?: string|null}} */ x) {
  const p = x.piece;
  const lines = [
    x.mine ? t('cards.kingsGambit.info.mine', '{name} - yours', { name: x.name }) : t('cards.kingsGambit.info.theirs', '{name} - {regular}\'s', { name: x.name, regular: x.regular }),
    p.ranged
      ? t('cards.kingsGambit.info.ranged', 'Level {level} - Attack {attack} - Ranged: shoots up to {range, plural, one {# cell} other {# cells}}', { level: p.level, attack: p.atk, range: KG_RANGED_RANGE })
      : t('cards.kingsGambit.info.melee', 'Level {level} - Attack {attack} - Melee: strikes the cell next to it', { level: p.level, attack: p.atk }),
    t('cards.kingsGambit.info.health', 'Health {hp} of {max}', { hp: p.hp, max: p.maxHp }),
    t('cards.kingsGambit.info.moves', 'Moves up to {move, plural, one {# cell} other {# cells}} a move.', { move: KG_MOVE_RANGE }),
    // AUDIT KG II C8 + D21: whom it can strike now, by name (14.5), in range - reach is a move's word
    t('cards.kingsGambit.info.foes', '{n, plural, =0 {No foe in range now.} one {In range now: {names}.} other {# foes in range now: {names}.}}', { n: x.foes.length, names: listOf(x.foes) }),
  ];
  if (x.hazard) lines.push(x.hazard);   // AUDIT KG II C8: its cell's hazard (14.5)
  if (p.king) lines.push(x.mine ? t('cards.kingsGambit.info.kingMine', 'If this king falls, you lose.') : t('cards.kingsGambit.info.kingTheirs', 'If this king falls, {name} loses.', { name: x.regular }));
  return lines;
}

// ── THE HEADERS, THE SECTIONS AND THE PRESSES ─────────────────────────────────────────────────────────────────────

/** The panel's header by its stage (14.5). */
export function gambitTitle(/** @type {{phase: string, round?: number, mine?: boolean, name?: string}} */ m) {
  if (m.phase === 'battle') return m.mine ? t('cards.kingsGambit.title.mine', 'Round {round} - your turn', { round: m.round }) : t('cards.kingsGambit.title.theirs', 'Round {round} - {name}\'s turn', { round: m.round, name: m.name });
  if (m.phase === 'army') return t('cards.kingsGambit.title.army', 'The King\'s Gambit: your army');
  if (m.phase === 'over') return t('cards.kingsGambit.title.over', 'The King\'s Gambit: the result');
  return t('cards.kingsGambit.title.setup', 'The King\'s Gambit');
}
/** The sections' heads. */
export const GAMBIT_HEADS = Object.freeze({
  get regulars() { return t('cards.kingsGambit.head.regulars', 'Choose a regular'); },
  get stake() { return t('cards.kingsGambit.head.stake', 'Your stake'); },
  get crown() { return t('cards.kingsGambit.head.crown', 'Your king'); },
  get unit() { return t('cards.kingsGambit.head.unit', 'The unit'); },
  get grid() { return t('cards.kingsGambit.head.grid', 'Recruit'); },
  get army() { return t('cards.kingsGambit.head.army', 'Your army'); },
  get info() { return t('cards.kingsGambit.head.info', 'The information box'); },
  get armies() { return t('cards.kingsGambit.head.armies', 'Armies'); },
  get guide() { return t('cards.kingsGambit.head.guide', 'How The King\'s Gambit works'); },
  get words() { return t('cards.kingsGambit.head.words', 'What the words mean'); },
});
/** The presses' words (14.5): every press says what it does, a press that costs gold says how much. */
export const GAMBIT_PRESS = Object.freeze({
  get next() { return t('cards.kingsGambit.press.next', 'Build your army'); },
  get autofill() { return t('cards.kingsGambit.press.autofill', 'Auto-fill'); },
  get clear() { return t('cards.kingsGambit.press.clear', 'Clear'); },
  get back() { return t('cards.kingsGambit.press.back', 'Back'); },
  get remove() { return t('cards.kingsGambit.press.remove', 'Remove'); },
  get startFun() { return t('cards.kingsGambit.press.startFun', 'Start the battle'); },
  get endTurn() { return t('cards.kingsGambit.press.endTurn', 'End turn'); },
  get forfeitFun() { return t('cards.kingsGambit.press.forfeitFun', 'Forfeit'); },
  get armed() { return t('cards.kingsGambit.press.armed', 'Press again to confirm'); },
  get stand() { return t('cards.kingsGambit.press.stand', 'Stand up'); },
  get again() { return t('cards.kingsGambit.press.again', 'Play again'); },
  get changeArmy() { return t('cards.kingsGambit.press.changeArmy', 'Change army'); },
  get otherRegular() { return t('cards.kingsGambit.press.otherRegular', 'Choose another regular'); },
  get leave() { return t('cards.kingsGambit.press.leave', 'Leave the table'); },
  get moveHere() { return t('cards.kingsGambit.press.moveHere', 'Move here'); },
  get cancel() { return t('cards.kingsGambit.press.cancel', 'Cancel'); },
  get more() { return t('cards.kingsGambit.press.more', 'More'); },
  get holdem() { return t('cards.kingsGambit.press.holdem', 'Play Hold\'em instead'); },
  get iliac() { return t('cards.kingsGambit.press.iliac', 'Play Iliac Hand instead'); },
});
export const pressStart = (/** @type {number} */ stake) => t('cards.kingsGambit.press.start', 'Start the battle and stake {stake, number} gold', { stake });
export const pressForfeit = (/** @type {number} */ stake) => t('cards.kingsGambit.press.forfeit', 'Forfeit - lose {stake, number} gold', { stake });
export const pressStandCost = (/** @type {number} */ stake) => t('cards.kingsGambit.press.standCost', 'Stand up and lose {stake, number} gold', { stake });
export const pressDrink = (/** @type {string} */ piece, /** @type {number} */ healed) => t('cards.kingsGambit.press.drink', 'Give {piece} a potion (+{healed})', { piece, healed });
export const pressStrike = (/** @type {string} */ name) => t('cards.kingsGambit.press.strike', 'Strike {name}', { name });
/** The press the Hold'em and Iliac Hand panels offer (section 3). */
export const playGambitWord = () => t('cards.kingsGambit.press.play', 'Play The King\'s Gambit');

// ── THE TURN'S CHIPS ──────────────────────────────────────────────────────────────────────────────────────────────

export const potionsChip = (/** @type {boolean} */ mine, /** @type {number} */ n, /** @type {string} */ name) => (mine
  ? t('cards.kingsGambit.chip.potionsMine', 'Your potions {n}', { n })
  : t('cards.kingsGambit.chip.potionsTheirs', '{name}\'s potions {n}', { n, name }));
export const fallenChip = (/** @type {boolean} */ mine, /** @type {number} */ n, /** @type {string} */ name) => (mine
  ? t('cards.kingsGambit.chip.fallenMine', 'Your fallen {n}', { n })
  : t('cards.kingsGambit.chip.fallenTheirs', '{name}\'s fallen {n}', { n, name }));
export const healthOf = (/** @type {number} */ hp, /** @type {number} */ max) => t('cards.kingsGambit.armies.health', '{hp} of {max}', { hp, max });

// ── THE NEXT STEP (law 1's live sentence) ─────────────────────────────────────────────────────────────────────────

/**
 * THE NEXT STEP, one sentence by the reader's state (14.4). `s` names it: 'noRegular', 'chooseRegular', 'online',
 * 'forFun', 'short', 'chooseStake', 'chooseKing', 'addUnit', 'start', 'yourTurn', 'warnings', 'piece', 'theirTurn',
 * 'ending', 'over'.
 * @param {string} s @param {{name?: string, stake?: number, n?: number}} [a]
 */
export function nextStep(s, a = {}) {
  switch (s) {
    case 'noRegular': return t('cards.kingsGambit.next.noRegular', 'No regular is free to play at this table.');
    case 'chooseRegular': return t('cards.kingsGambit.next.chooseRegular', 'Choose a regular to challenge.');
    case 'online': return t('cards.kingsGambit.next.online', 'Online, the regulars play for fun: choose your king, then build your army.');
    case 'forFun': return t('cards.kingsGambit.next.forFun', '{name} plays for fun tonight, so no gold changes hands. Choose your king, then build your army.', { name: a.name ?? '' });
    case 'short': return t('cards.kingsGambit.next.short', '{name} will not sit down for less than {stake, number} gold. Come back with more, or choose another regular.', { name: a.name ?? '', stake: a.stake ?? 0 });
    case 'chooseStake': return t('cards.kingsGambit.next.chooseStake', 'Choose your stake.');
    case 'chooseKing': return t('cards.kingsGambit.next.chooseKing', 'Choose your king, then build your army.');
    case 'addUnit': return t('cards.kingsGambit.next.addUnit', 'Add a unit from the list, or press Auto-fill.');
    case 'start': return t('cards.kingsGambit.next.start', 'Your army is ready: start the battle when you are.');
    case 'yourTurn': return t('cards.kingsGambit.next.yourTurn', 'Your turn: {n, plural, one {# action} other {# actions}} left. Choose one of your pieces.', { n: a.n ?? 0 });
    case 'warnings': return t('cards.kingsGambit.next.warnings', 'Your turn: {n, plural, one {# action} other {# actions}} left. The warnings turn into hazards at the end of this round.', { n: a.n ?? 0 });
    case 'piece': return t('cards.kingsGambit.next.piece', 'Press a lit cell to move, a ringed foe to strike, or give the piece a potion.');
    case 'theirTurn': return t('cards.kingsGambit.next.theirTurn', '{name} is taking a turn.', { name: a.name ?? '' });
    case 'ending': return t('cards.kingsGambit.next.ending', 'Your turn is ending.');
    case 'decided': return t('cards.kingsGambit.next.decided', 'The game is decided. The result follows.');   // AUDIT KG II C6
    default: return t('cards.kingsGambit.next.over', 'Play again, change your army, or choose another regular.');
  }
}

// ── THE LOG (a line an event of the law - section 16's table) ─────────────────────────────────────────────────────

/**
 * A LOG LINE for one of the session's events, or null for one the log does not keep: the player in the second person,
 * the regular by name, one pattern an event. `names(piece)` names a piece by its number (it may have fallen since - the
 * event carries what the line needs); `regular` the regular's name.
 * @param {any} e @param {{regular: string, names: (id: number) => string, layout?: string}} x
 */
export function logLine(e, x) {
  const mine = e.side === 0;
  switch (e.t) {
    case 'game': return t('cards.kingsGambit.log.game', 'The board is laid: {layout}.', { layout: layoutName(e.layout) });
    case 'move': return mine ? t('cards.kingsGambit.log.moveMine', 'Your {piece} moves.', { piece: x.names(e.piece) }) : t('cards.kingsGambit.log.moveTheirs', '{name}\'s {piece} moves.', { name: x.regular, piece: x.names(e.piece) });
    case 'attack': {
      const a = { name: x.regular, piece: x.names(e.piece), target: x.names(e.target), damage: e.damage };
      if (e.killed) return mine ? t('cards.kingsGambit.log.killMine', 'Your {piece} strikes {target} for {damage}. It falls.', a) : t('cards.kingsGambit.log.killTheirs', '{name}\'s {piece} strikes your {target} for {damage}. It falls.', a);
      if (e.shot) return mine ? t('cards.kingsGambit.log.shotMine', 'Your {piece} shoots {target} for {damage}.', a) : t('cards.kingsGambit.log.shotTheirs', '{name}\'s {piece} shoots your {target} for {damage}.', a);
      return mine ? t('cards.kingsGambit.log.strikeMine', 'Your {piece} strikes {target} for {damage}.', a) : t('cards.kingsGambit.log.strikeTheirs', '{name}\'s {piece} strikes your {target} for {damage}.', a);
    }
    case 'potion': return mine ? t('cards.kingsGambit.log.potionMine', 'Your {piece} drinks a potion: +{healed}.', { piece: x.names(e.piece), healed: e.healed }) : t('cards.kingsGambit.log.potionTheirs', '{name}\'s {piece} drinks a potion: +{healed}.', { name: x.regular, piece: x.names(e.piece), healed: e.healed });
    case 'hazard': {
      const a = { kind: e.kind, piece: x.names(e.piece), damage: e.damage, name: x.regular };
      if (e.killed) return mine ? t('cards.kingsGambit.log.hazardKillMine', '{kind, select, fire {Fire} spikes {Spikes} other {Poison}} hits your {piece} for {damage}. It falls.', a) : t('cards.kingsGambit.log.hazardKillTheirs', '{kind, select, fire {Fire} spikes {Spikes} other {Poison}} hits {name}\'s {piece} for {damage}. It falls.', a);
      return mine ? t('cards.kingsGambit.log.hazardMine', '{kind, select, fire {Fire} spikes {Spikes} other {Poison}} bites your {piece} for {damage}.', a) : t('cards.kingsGambit.log.hazardTheirs', '{kind, select, fire {Fire} spikes {Spikes} other {Poison}} bites {name}\'s {piece} for {damage}.', a);
    }
    case 'armed': return t('cards.kingsGambit.log.armed', 'The warnings turn into hazards: {n, plural, one {# hazard is} other {# hazards are}} now active.', { n: e.cells.length });
    case 'warning': return t('cards.kingsGambit.log.warning', 'Warning: {kind, select, fire {fire is} spikes {spikes are} other {poison is}} coming to {n, plural, one {# cell} other {# cells}}.', { kind: e.kind, n: e.cells.length });
    case 'turn': return e.side === 0 ? t('cards.kingsGambit.log.turnMine', 'Round {round}: your turn.', { round: e.round }) : t('cards.kingsGambit.log.turnTheirs', 'Round {round}: {name}\'s turn.', { round: e.round, name: x.regular });
    case 'end': return mine ? t('cards.kingsGambit.log.endMine', 'You end your turn.') : t('cards.kingsGambit.log.endTheirs', '{name} ends the turn.', { name: x.regular });
    case 'forfeit': return e.side === 1 ? t('cards.kingsGambit.log.forfeitTheirs', '{name} forfeits the game.', { name: x.regular }) : t('cards.kingsGambit.log.forfeit', 'You forfeit the game.');
    case 'timeout': return mine ? t('cards.kingsGambit.log.timeoutMine', 'Your time runs out: your turn ends.') : t('cards.kingsGambit.log.timeoutTheirs', '{name}\'s time runs out: the turn ends.', { name: x.regular });   // KG5: the relay's clock
    case 'decided': return e.by === 'void' ? t('cards.kingsGambit.log.void', 'The game cannot go on: no contest.') : e.winner === 0 ? t('cards.kingsGambit.log.won', 'You win.') : t('cards.kingsGambit.log.lost', '{name} wins.', { name: x.regular });
    default: return null;
  }
}

// ── THE TABLE'S OWN LINES: the deal said, the regular's voice ─────────────────────────────────────────────────────

/** What the table says at the deal: the stake put down, or a game for fun. */
export const dealLine = (/** @type {string} */ name, /** @type {number} */ stake) => (stake
  ? t('cards.kingsGambit.say.deal', 'You put down {stake, number} gold and sit down to The King\'s Gambit with {name}.', { stake, name })
  : t('cards.kingsGambit.say.dealFun', 'You sit down to The King\'s Gambit with {name}, for fun.', { name }));
/** THE REGULAR'S VOICE (10.5; MEASURE KG3, section 16): the invitation as the player chooses the regular - the mod's own
 *  line - and a word at the end, the regular's win or loss, one of three by `roll` (a uniform in [0, 1)). */
export const barkInvite = () => t('cards.kingsGambit.bark.invite', 'Care for a game of The King\'s Gambit?');
export function barkEnd(/** @type {boolean} */ regularWon, /** @type {number} */ roll) {
  const k = Math.max(0, Math.min(2, Math.floor((Number(roll) || 0) * 3)));
  if (regularWon) {
    if (k === 0) return t('cards.kingsGambit.bark.won1', 'A fine game. And mine.');
    return k === 1 ? t('cards.kingsGambit.bark.won2', 'Better luck next time.') : t('cards.kingsGambit.bark.won3', 'The board is mine tonight.');
  }
  if (k === 0) return t('cards.kingsGambit.bark.lost1', 'Well played.');
  return k === 1 ? t('cards.kingsGambit.bark.lost2', 'You have my measure tonight.') : t('cards.kingsGambit.bark.lost3', 'Again, and I will have you.');
}

/** The save's refusal while a stake is down (5.7 - world.js's two doors). */
export const stakedSaveRefusal = () => t('cards.kingsGambit.save.staked', 'You cannot save with gold staked on the table.');

// ── THE RESULT ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The result's headline. @param {{winner: number|null, by: string}} over */
export function resultHead(over) {
  if (over.by === 'void') return t('cards.kingsGambit.result.void', 'No contest');
  if (over.winner === 0) return t('cards.kingsGambit.result.win', 'You win');
  return over.by === 'forfeit' ? t('cards.kingsGambit.result.loseForfeit', 'You lose by forfeit') : t('cards.kingsGambit.result.lose', 'You lose');
}
/** The king's fall, its own sentence round the whole title: "{name}, King of {crown}, falls." */
export const kingFalls = (/** @type {string} */ crown) => t('cards.kingsGambit.result.kingFalls', '{name}, King of {crown}, falls.', crownKing(crown));
/** The gold, in one sentence. @param {{winner: number|null, by: string}} over @param {number} stake @param {string} name */
export function resultGold(over, stake, name) {
  if (!stake) return t('cards.kingsGambit.result.fun', 'Played for fun. No gold changed hands.');
  if (over.by === 'void' || over.winner === null) return t('cards.kingsGambit.result.back', 'No contest. Your {stake, number} gold is back in your purse.', { stake });
  return over.winner === 0
    ? t('cards.kingsGambit.result.collect', 'You collect the pot: your {stake, number} gold back, plus {stake, number} gold from {name}.', { stake, name })
    : t('cards.kingsGambit.result.keeps', '{name} keeps your {stake, number} gold.', { stake, name });
}
/** AUDIT KG II D5: a watched game's gold - the pot the winner's, each stake home in no contest, or none.
 *  @param {{winner: number|null, by: string}} over @param {number} pot @param {string[]} names */
export function watchGold(over, pot, names) {
  if (!pot) return t('cards.kingsGambit.result.fun', 'Played for fun. No gold changed hands.');
  if (over.by === 'void' || over.winner === null) return t('cards.kingsGambit.online.watchGold.void', 'No contest. Each player gets their stake back.');
  return t('cards.kingsGambit.online.watchGold.pot', '{name} takes the pot: {pot, number} gold.', { name: names[over.winner] ?? '', pot });
}
/** AUDIT KG II D17: why a quiet press does nothing. */
export const armyEmpty = () => t('cards.kingsGambit.army.empty', 'Your army is already empty.');
export const armySpent = () => t('cards.kingsGambit.army.spent', 'Your army has no points left for another unit.');
export const stakeWhileReady = () => t('cards.kingsGambit.online.stake.whileReady', 'Press Not ready to change your stake.');
export const stakingWait = () => t('cards.kingsGambit.online.stake.wait', 'Placing your stake. Wait a moment.');
/** AUDIT KG II D18: the season board's press, while it is open. */
export const boardHide = () => t('cards.kingsGambit.online.press.boardHide', 'Hide the season board');
/** A regular whose night ran out: the next game is for fun. */
export const nightSpent = (/** @type {string} */ name) => t('cards.kingsGambit.result.nightSpent', '{name} will not pay out any more tonight. The next game is for fun.', { name });

// ── KG5: ONLINE (section 18) - another player across the board ───────────────────────────────────────────────────

/** The online presses' words. */
export const GAMBIT_ONLINE_PRESS = Object.freeze({
  get sit() { return t('cards.kingsGambit.online.press.sit', 'Sit at the board'); },
  get ready() { return t('cards.kingsGambit.online.press.ready', 'Ready'); },
  get unready() { return t('cards.kingsGambit.online.press.unready', 'Not ready'); },
  get leave() { return t('cards.kingsGambit.online.press.leave', 'Leave the board'); },
  get regulars() { return t('cards.kingsGambit.online.press.regulars', 'Play a regular instead'); },
  get online() { return t('cards.kingsGambit.online.press.online', 'Play another player'); },
  get board() { return t('cards.kingsGambit.online.press.board', 'Season board'); },   // KG6
  get staking() { return t('cards.kingsGambit.online.press.staking', 'Staking...'); },   // KG6
});
/** KG6: Ready at the gold table says its stake. @param {number} n */
export const pressReadyStake = (n) => t('cards.kingsGambit.online.press.readyStake', 'Ready - stake {n, number} gold', { n });
/** The board's two seats, as the setup lists them. */
export const onlineHead = () => t('cards.kingsGambit.online.head', 'At this board');
/** A seat, by its player: who sits, whether they are ready (KG6: and for what stake); or an empty seat. @param {{name: string, ready?: boolean, stake?: number|null}|null} s */
export function onlineSeat(s) {
  if (!s) return t('cards.kingsGambit.online.seatEmpty', 'An empty seat');
  if (s.ready && s.stake) return t('cards.kingsGambit.online.seatStake', '{name} - ready, {n, number} gold', { name: s.name, n: s.stake });   // KG6
  return s.ready ? t('cards.kingsGambit.online.seatReady', '{name} - ready', { name: s.name }) : t('cards.kingsGambit.online.seat', '{name}', { name: s.name });
}
/** The turn's clock, as a chip: the seconds the turn has left. @param {number} n */
export const clockChip = (n) => t('cards.kingsGambit.online.clock', '{n, plural, one {# second} other {# seconds}} left', { n });
/**
 * THE NEXT STEP ONLINE (14.4's law 1): 'sit', 'alone', 'ready', 'theirReady', 'readyWait', 'aloneReady', 'dealing',
 * 'watch', 'full', 'over'. @param {string} s @param {{name?: string, a?: string, b?: string}} [x]
 */
export function onlineStep(s, x = {}) {
  switch (s) {
    case 'sit': return t('cards.kingsGambit.online.next.sit', 'Sit at the board to play another player at this table, or play a regular instead.');
    case 'alone': return t('cards.kingsGambit.online.next.alone', 'Build your army while you wait for another player to sit down.');
    case 'ready': return t('cards.kingsGambit.online.next.ready', 'Build your army, then press Ready. {name} sits across the board.', { name: x.name ?? '' });
    case 'theirReady': return t('cards.kingsGambit.online.next.theirReady', '{name} is ready: build your army, then press Ready.', { name: x.name ?? '' });
    case 'readyWait': return t('cards.kingsGambit.online.next.readyWait', 'You are ready. Waiting for {name}.', { name: x.name ?? '' });
    case 'aloneReady': return t('cards.kingsGambit.online.next.aloneReady', 'You are ready. Waiting for another player to sit down.');
    case 'dealing': return t('cards.kingsGambit.online.next.dealing', 'Both players are ready. Setting up the board.');
    case 'watch': return t('cards.kingsGambit.online.next.watch', 'You are watching {a} play {b}.', { a: x.a ?? '', b: x.b ?? '' });
    case 'full': return t('cards.kingsGambit.online.next.full', 'Two players sit at this board. Wait for a seat, or play a regular instead.');
    default: return t('cards.kingsGambit.online.next.over', 'Press Play again to build your army for another game, or play a regular instead.');
  }
}
/** A watched game's headline: who won it. @param {string} name */
export const watchWin = (name) => t('cards.kingsGambit.online.watchWin', '{name} wins', { name });
/** Why an online game ended, beside its headline: the other player gone, away, or giving it up. @param {{winner: number|null, how?: string}} over @param {string} name */
export function onlineEnd(over, name) {
  if (over.how === 'left' && over.winner === 0) return t('cards.kingsGambit.online.end.left', '{name} left the board.', { name });
  // AUDIT KG II D20: the law's count, never a typed one
  if (over.how === 'idle') return over.winner === 0 ? t('cards.kingsGambit.online.end.idleTheirs', '{name} let the clock run out {n, plural, one {# turn} other {# turns}} in a row.', { name, n: GAMBIT_IDLE_TURNS }) : t('cards.kingsGambit.online.end.idleMine', 'You let the clock run out {n, plural, one {# turn} other {# turns}} in a row.', { n: GAMBIT_IDLE_TURNS });
  if (over.how === 'forfeit' && over.winner === 0) return t('cards.kingsGambit.online.end.forfeit', '{name} gave up the game.', { name });
  return null;
}
/** The relay's refusals of the room's own (a sit, a Ready), as the panel says them - the law's are refusalWords'. @param {string} word */
export function onlineRefusal(word) {
  switch (word) {
    case 'link': return t('cards.kingsGambit.online.refuse.link', 'The table could not be reached. Try again in a moment.');
    case 'other game': return t('cards.kingsGambit.online.refuse.otherGame', 'Another game is being played at this table.');
    case 'taken': return t('cards.kingsGambit.online.refuse.taken', 'That seat is taken.');
    case 'full': return t('cards.kingsGambit.online.refuse.full', 'Two players already sit at this board.');
    case 'busy': return t('cards.kingsGambit.online.refuse.busy', 'The room is busy. Try again.');
    case 'account seated': return t('cards.kingsGambit.online.refuse.accountSeated', 'Your account already sits at a table here.');
    case 'in a game': return t('cards.kingsGambit.online.refuse.inGame', 'A game is under way at this board.');
    case 'stale': return t('cards.kingsGambit.online.refuse.stale', 'Too late. That turn has already passed.');   // AUDIT KG II D16
    // KG6: the gold table's
    case 'stake needed': return t('cards.kingsGambit.online.refuse.stakeNeeded', 'Choose your stake first.');
    case 'stake differs': return t('cards.kingsGambit.online.refuse.stakeDiffers', 'The other player chose a different stake. Match it to play.');
    case 'stakes closed': return t('cards.kingsGambit.online.refuse.stakesClosed', 'Gold games are closed here right now.');
    case 'stake refused': case 'stake elsewhere': case 'stake spent': return t('cards.kingsGambit.online.refuse.stake', 'The table refused that stake. Your gold has been returned.');
    case 'friendly table': return t('cards.kingsGambit.online.refuse.friendly', 'This table plays for no gold.');
    case 'ready': return t('cards.kingsGambit.online.refuse.ready', 'You are ready already.');
    // AUDIT KG II D16: the relay's other words, each with its way forward
    case 'seated': return t('cards.kingsGambit.online.refuse.seated', 'You already sit at this board.');
    case 'not seated': return t('cards.kingsGambit.online.refuse.notSeated', 'You are no longer seated at this board. Sit down again.');
    case 'no table': return t('cards.kingsGambit.online.refuse.noTable', 'Nobody is at this board. Sit down to start a game.');
    case 'no game': return t('cards.kingsGambit.online.refuse.noGame', 'That game has already ended.');
    case 'table differs': return t('cards.kingsGambit.online.refuse.tableDiffers', 'This board has changed. Stand up and sit down again.');
    default: return refusalWords(word);
  }
}

// ── KG6: GOLD AT THE RED TABLE, AND THE SEASON (section 19) ───────────────────────────────────────────────────────

/** The stake picks' head, and a pick. */
export const stakeHead = () => t('cards.kingsGambit.online.stake.head', 'Your stake');
export const stakePick = (/** @type {number} */ n) => t('cards.kingsGambit.online.stake.pick', '{n, number} gold', { n });
/** What a stake wins and loses, said under the picks before it is put down (10.7). @param {number} n */
export const stakeOnline = (n) => t('cards.kingsGambit.online.stake.what', 'Win, and you take the pot: {pot, number} gold. Lose, forfeit or leave mid-game, and the other player takes it.', { pot: n * 2 });
/** Why a pick is closed: the purse short of it, or the other player's stake another. */
export const stakeShort = (/** @type {number} */ gold) => t('cards.kingsGambit.online.stake.short', 'You have {gold, number} gold, too little for this stake.', { gold });
export const stakeDiffers = (/** @type {string} */ name, /** @type {number} */ n) => t('cards.kingsGambit.online.stake.differs', '{name} stakes {n, number} gold. Match it to play.', { name, n });
/** AUDIT KG II B16: why the realm would not hold a stake, in its own word (net/card/cardStakes.js stake) - nothing held, or
 *  an answer lost (then the stake is settled when the realm answers). @param {{error?: string, unknown?: boolean}|null|undefined} r */
export function stakeRefusal(r) {
  if (r?.unknown) return t('cards.kingsGambit.online.stakeRefuse.unknown', 'The realm did not answer. Your stake will be settled when it does.');
  switch (r?.error) {
    case 'realm-gold': return t('cards.kingsGambit.online.stakeRefuse.purse', 'Your purse cannot cover that stake.');
    case 'cards-closed': return t('cards.kingsGambit.online.stakeRefuse.closed', 'The realm is not holding stakes right now.');
    case 'offline': return t('cards.kingsGambit.online.stakeRefuse.offline', 'The realm could not be reached. Try again.');
    case 'busy': return t('cards.kingsGambit.online.stakeRefuse.busy', 'The realm is busy. Try again in a moment.');
    case 'cards-kept-full': return t('cards.kingsGambit.online.stakeRefuse.keptFull', 'You have too many stakes waiting to be settled. Visit the tables where you placed them first.');
    default: return t('cards.kingsGambit.online.stakeRefuse.other', 'The realm could not take your stake. Try again.');
  }
}
/** The next step at the gold table with no stake chosen. */
export const stakeChoose = () => t('cards.kingsGambit.online.stake.choose', 'Choose your stake, then press Ready.');
/** THE SEASON BOARD'S words. */
export const boardHead = (/** @type {number} */ n) => t('cards.kingsGambit.online.board.head', 'Season {n}: the board', { n });
export const boardRow = (/** @type {{rank: number, name: string, rating: number, wins: number, losses: number}} */ r) => t('cards.kingsGambit.online.board.row', '{rank}. {name} - rating {rating} ({wins, plural, one {# win} other {# wins}}, {losses, plural, one {# loss} other {# losses}})', r);   // AUDIT KG II D20
export const boardYou = (/** @type {{rank: number, rating: number, wins: number, losses: number}|null} */ r) => (r
  ? t('cards.kingsGambit.online.board.you', 'You: rank {rank}, rating {rating} ({wins, plural, one {# win} other {# wins}}, {losses, plural, one {# loss} other {# losses}}).', r)
  : t('cards.kingsGambit.online.board.youNone', 'You have no rated game this season.'));
export const boardChampion = (/** @type {string|null} */ name) => (name
  ? t('cards.kingsGambit.online.board.champion', 'Grandmaster: {name}', { name })
  : t('cards.kingsGambit.online.board.noChampion', 'Nobody wears the Grandmaster title yet.'));
// AUDIT KG II D10: a guest is signed in and never rated - the words say registered, with the counts' plurals
export const boardNeeds = (/** @type {number} */ games, /** @type {number} */ foes) => t('cards.kingsGambit.online.board.needs', 'The season\'s top player earns the Grandmaster title after playing {games, plural, one {# rated game} other {# rated games}} against {foes, plural, one {# different player} other {# different players}}. Only games between two registered accounts count.', { games, foes });
export const boardReading = () => t('cards.kingsGambit.online.board.reading', 'Loading the season board...');
export const boardFailed = () => t('cards.kingsGambit.online.board.failed', 'The season board could not be loaded. Try again.');
/** What the season's claims say, in the town's talk (scenes/world.js gambitClaims). */
export const seasonCounted = (/** @type {number} */ rating, /** @type {number} */ delta) => t('cards.kingsGambit.season.counted', 'The King\'s Gambit: the game counts on the season board. Your rating is now {rating} ({change}).', { rating, change: `${delta >= 0 ? '+' : ''}${delta}` });
/** A game kept and not counted - AUDIT KG II D11: by the cap that held it (the service's `cap`), the pair's day or its
 *  season; neither said (the second carrier's answer) the plain words. @param {string|undefined} [cap] */
export function seasonKept(cap) {
  if (cap === 'day') return t('cards.kingsGambit.season.kept', 'The King\'s Gambit: the game does not count for your rating. You have played that opponent too often today.');
  if (cap === 'season') return t('cards.kingsGambit.season.keptSeason', 'The King\'s Gambit: the game does not count for your rating. You have played that opponent as often as this season allows.');
  return t('cards.kingsGambit.season.keptPair', 'The King\'s Gambit: the game does not count for your rating. You have played that opponent too often for now.');
}
/** AUDIT KG II D10: the other player has no registered account - nothing on the board. */
export const seasonFoeGuest = () => t('cards.kingsGambit.season.foeGuest', 'The King\'s Gambit: the game does not count on the season board because the other player is not registered.');
export const seasonGuest = () => t('cards.kingsGambit.season.guest', 'The King\'s Gambit: register your account to keep your games on the season board.');
