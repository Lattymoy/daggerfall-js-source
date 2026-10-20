// @ts-check
// KG1 (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md sections 2, 4 and 11; the owner, handing over
// thekingsgambit.dfmod: "How can we implement this using the illiac bay card system. A new minigame", then "Make the
// best and most detailed decisions. We also have permission"): THE KING'S GAMBIT'S LAW - the mod's game, pure,
// DOM-free and plain data (structuredClone-safe, as net/iliac/iliacHand.js's state is), ONE HOME for both ends: the tavern's
// regulars play by it offline (KG2, KG3) and the relay will run it online (KG5), so it imports only the enemy table its
// units are read from, the dice's unbiased draw and Unity's rounding (systems/mathf.js, its one home). Nothing here draws
// a picture, plays a sound or waits.
//
// THE MOD'S, VERBATIM - TheKingsGambit.dll, the mod's one assembly (read with ilspycmd; the record tables every number):
//   the board    Cols x Rows, MapTile; SetTile's mirror through the centre and its zone; BuildMap's four layouts and
//                thirty tries; RandomChunks, PlaceWallCell; MapIsPlayable (PathMap from the foot's king cell, the head's
//                reached and 97% of the floor, at float32); the Open field
//   the units    MakeUnit (level, hp, attack and cost at float32, Unity's RoundToInt rounding a half to even);
//                BuildRoster (every textured row - a monster by HasRangedAttack1, a calling only of RangedClasses);
//                the kings, PlayerKingClass the host's and EnemyKingClass the guest's
//   the armies   ArmyCost; the army's law (TryAdd, ParseArmy); AutoFill (two draws, the dearer kept)
//   the deploy   PlaceArmy (the king on (7, 12); dearest first; melee 11-10-12, ranged 12-10-11; CenterOut), AddPiece's
//                mirror for the guest
//   the turn     IsLegal; Apply (Move, Attack, Potion, EndTurn), SpendAction, QueueTurnEnd; GetReachable, InRange,
//                HasLineOfSight (RoundDiv), a blow's roll (Attack: 0.8 + 0.4 x NextDouble at float32), Heal
//   its end      FinishTurn: ApplyHazards (the side that moved), the round after the guest's turn, HazardTick on an even
//                round (every warning armed; a new warning pair while the board would hold at most MaxHazards);
//                CheckGameOver after every blow and every bite
//
// ITS FRAME IS THE HOST'S. The mod's `player` flag is the local client's own side (each client drew itself at the
// foot); here a SIDE is 0 - the host, who moves first, at the foot (rows 10-12) - or 1 - the guest, mirrored through the
// centre, (c, r) to (14 - c, 12 - r) - as the relay sees the board. A client turns the picture, never the law.
//
// THE DICE. The mod's `System.Random(seed)` is .NET's own stream; this law draws from the `rand32` it is handed, through
// net/dice.js drawBelow: Rand(a, b) is a + drawBelow(b - a), NextDouble is rand32 / 2^32 - the same uniform law over
// another stream, in the mod's ORDER of draws (BuildMap's, SpawnHazardPair's, a blow's one). Online the relay rolls, so
// no client must agree with its stream. A source that is not a 32-bit draw, or one that draws without end, is refused.
//
// EVERY STEP ANSWERS A NEW STATE: a command the law refuses answers its refusal word and changes nothing (cardLaw's way,
// so a relay keeps its last good state); one it takes answers the next state and the events it made.
//
// Not a DFU member: Daggerfall Unity has no such game - the mod does. Ledger A row (THE KING'S GAMBIT).
import { VANILLA_ENEMY_BASICS, enemyDisplayName } from '../characters/enemy/enemyBasics.js';   // DEX1: the vanilla rows by name - a mod that writes the live table's (Daggerfall Enemy Expansion's classic lines) never moves the roster, whenever this module is first read
import { drawBelow } from './dice.js';
import { roundToInt } from '../systems/mathf.js';   // Mathf.RoundToInt's one home

// ── THE MOD'S NUMBERS ─────────────────────────────────────────────────────────────────────────────────────────────

/** The board (Cols, Rows), and the rows a wall, a pillar, water or a hazard may stand in (ZoneTop, ZoneBottom). */
export const KG_COLS = 15;
export const KG_ROWS = 13;
export const KG_ZONE_TOP = 3;
export const KG_ZONE_BOTTOM = 9;
/** MapTile, in the mod's order. */
export const KG_TILE = Object.freeze({ floor: 0, wall: 1, pillar: 2, water: 3 });
/** The host's king's cell (PlaceArmy's, and MapIsPlayable's start); the guest's is its mirror, (7, 0). */
export const KG_KING_CELL = Object.freeze([7, 12]);
/** HazardKind in the mod's order, and each one's bite (FireDamage, SpikeDamage, PoisonDamage). */
export const KG_HAZARD_KINDS = Object.freeze(['fire', 'spikes', 'poison']);
export const KG_HAZARD_DAMAGE = Object.freeze({ fire: 8, spikes: 6, poison: 5 });
/** HazardPairsAtStart, HazardSpawnEvery, MaxHazards, and SpawnHazardPair's tries. */
export const KG_HAZARD_PAIRS_AT_START = 3;
export const KG_HAZARD_SPAWN_EVERY = 2;
export const KG_MAX_HAZARDS = 14;
export const KG_HAZARD_TRIES = 40;
/** BuildMap's tries, and the share of the floor MapIsPlayable asks the foot's king cell to reach. */
export const KG_MAP_TRIES = 30;
export const KG_PLAYABLE_SHARE = 0.97;
/** PathMap's "no way there" (Unreachable). */
export const KG_UNREACHABLE = 9999;
/** The army (PointBudget, MaxUnits), and a unit's least cost, cost scale and ranged factor (MinCost, CostScale,
 *  RangedCostFactor). */
export const KG_POINT_BUDGET = 300;
export const KG_MAX_UNITS = 12;
export const KG_MIN_COST = 6;
export const KG_COST_SCALE = 1;
export const KG_RANGED_COST_FACTOR = 1.35;
/** A unit's attack per level, and a ranged unit's share of it (DamagePerLevel, RangedDamageFactor). */
export const KG_DAMAGE_PER_LEVEL = 2;
export const KG_RANGED_DAMAGE_FACTOR = 0.75;
/** A king's and a calling's level and hp (KingLevel, KingHp, ClassLevel, ClassHp). */
export const KG_KING_LEVEL = 8;
export const KG_KING_HP = 70;
export const KG_CLASS_LEVEL = 6;
export const KG_CLASS_HP = 30;
/** The callings the roster recruits, every one ranged (RangedClasses: the Mage, the Sorcerer, the Archer, the Ranger). */
export const KG_RANGED_CLASSES = Object.freeze([128, 131, 141, 142]);
/** Each side's king: the host's PlayerKingClass (the Knight), the guest's EnemyKingClass (the Barbarian). */
export const KG_KING_CLASSES = Object.freeze([145, 143]);
/** A turn's actions, a side's potions, a potion's heal (ActionsPerTurn, PotionsPerSide, PotionHeal). */
export const KG_ACTIONS_PER_TURN = 2;
export const KG_POTIONS_PER_SIDE = 3;
export const KG_POTION_HEAL = 30;
/** The most potions a side may be dealt - the innkeeper's tiers deal 2 to 4 (a bound on what a caller may say). */
export const KG_POTIONS_MAX = 9;
/** The largest budget an army may be checked against - the innkeeper's tiers reach 450 (a bound, as above). */
export const KG_BUDGET_MAX = 10_000;
/** A move's steps and a ranged unit's reach (MoveRange, RangedRange); a sight line's samples per cell of its longer
 *  axis (HasLineOfSight's 4). */
export const KG_MOVE_RANGE = 3;
export const KG_RANGED_RANGE = 4;
export const KG_SIGHT_SAMPLES = 4;
/** A blow's roll (Attack): attack x (KG_BLOW_LOW + KG_BLOW_SPREAD x NextDouble). */
export const KG_BLOW_LOW = 0.8;
export const KG_BLOW_SPREAD = 0.4;
/** AutoFill's rounds, the ranged units it leans toward until the army holds, and how often it leans. */
export const KG_AUTOFILL_ROUNDS = 200;
export const KG_AUTOFILL_RANGED = 2;
export const KG_AUTOFILL_LEAN = 0.5;
/** The most draws one step may take from its source - a board's build takes a few thousand at the most; past this the
 *  source is broken (net/iliac/iliacHand.js ILIAC_RAND_DRAWS_MAX's law). */
export const KG_RAND_DRAWS_MAX = 100_000;

/** THE LAYOUTS - BuildMap's switch, by Rand(0, 4) - each its key and its two floor tones (floorA, floorB, RGB); and the
 *  Open field, its thirtieth failure. A layout's name is a word a player reads, so it is the client's to say through the
 *  text core (L10N4) - the key is what the law keeps and sends. */
export const KG_LAYOUTS = Object.freeze([
  Object.freeze({ key: 'pillared-hall', floor: Object.freeze([Object.freeze([0.27, 0.27, 0.3]), Object.freeze([0.36, 0.36, 0.4])]) }),
  Object.freeze({ key: 'guard-rooms', floor: Object.freeze([Object.freeze([0.3, 0.23, 0.17]), Object.freeze([0.4, 0.31, 0.22])]) }),
  Object.freeze({ key: 'ruined-keep', floor: Object.freeze([Object.freeze([0.24, 0.29, 0.2]), Object.freeze([0.32, 0.38, 0.26])]) }),
  Object.freeze({ key: 'moat-and-bridges', floor: Object.freeze([Object.freeze([0.4, 0.35, 0.24]), Object.freeze([0.49, 0.43, 0.3])]) }),
]);
export const KG_OPEN_FIELD = Object.freeze({ key: 'open-field', floor: Object.freeze([Object.freeze([0.24, 0.29, 0.2]), Object.freeze([0.32, 0.38, 0.26])]) });

/** The commands (GameCmdType, in the mod's order): a move, an attack, a potion, the turn ended. */
export const KG_COMMANDS = Object.freeze(['move', 'attack', 'potion', 'end']);

// ── FLOAT32 AND UNITY'S ROUNDING ──────────────────────────────────────────────────────────────────────────────────

const f32 = Math.fround;
// Mathf.RoundToInt, which rounds a half to the even neighbour, is `systems/mathf.js`'s roundToInt: ONE DFU MEMBER, ONE
// EXPORT (test/systems/talk/audit24_onehome.test.js).

// ── THE UNITS AND THE ROSTER ──────────────────────────────────────────────────────────────────────────────────────

/** @typedef {{id: number, name: string, level: number, hp: number, atk: number, cost: number, ranged: boolean, king: boolean}} GambitUnit */

/**
 * A UNIT of `mobileType` (MakeUnit), frozen - or null for a row the table does not hold, or a monster's row without its
 * numbers. A calling's level and hp are ClassLevel and ClassHp; a king's are KingLevel and KingHp, and it costs nothing.
 * Attack and cost are computed at float32, as the C# stores them, and rounded by RoundToInt.
 * @param {number} mobileType @param {{king?: boolean, ranged?: boolean}} [o]
 * @returns {GambitUnit|null}
 */
export function makeUnit(mobileType, { king = false, ranged = false } = {}) {
  const row = Number.isInteger(mobileType) ? VANILLA_ENEMY_BASICS[String(mobileType)] : undefined;
  if (!row) return null;
  const calling = mobileType >= 128;
  if (!king && !calling && !(Number.isInteger(row.level) && Number.isInteger(row.minHealth) && Number.isInteger(row.maxHealth))) return null;
  const level = king ? KG_KING_LEVEL : calling ? KG_CLASS_LEVEL : row.level;
  const hp = king ? KG_KING_HP : calling ? KG_CLASS_HP : Math.max(1, Math.trunc((row.minHealth + row.maxHealth) / 2));
  const atk = Math.max(1, roundToInt(f32(f32(f32(level) * KG_DAMAGE_PER_LEVEL) * f32(ranged ? KG_RANGED_DAMAGE_FACTOR : 1))));
  const worth = f32(f32(f32(Math.sqrt(f32(hp * atk))) * KG_COST_SCALE) * f32(ranged ? KG_RANGED_COST_FACTOR : 1));
  return Object.freeze({ id: mobileType, name: enemyDisplayName(mobileType), level, hp, atk, cost: king ? 0 : Math.max(KG_MIN_COST, roundToInt(worth)), ranged, king });
}

/** CompareOrdinal: the names' code units, as .NET's ordinal compare reads them. */
const ordinal = (/** @type {string} */ a, /** @type {string} */ b) => (a < b ? -1 : a > b ? 1 : 0);

/** THE ROSTER (BuildRoster): every row of the table with a MaleTexture - a monster ranged when it HasRangedAttack1 (none
 *  does), a calling only one of KG_RANGED_CLASSES, ranged - sorted by cost, then by name. The two Dragonlings (34, and
 *  40, DFU's alternate) cost and read alike; the mod left their order to .NET's unstable sort, the port breaks the tie by
 *  id. Frozen. */
export const KG_ROSTER = Object.freeze(buildRoster());
function buildRoster() {
  /** @type {GambitUnit[]} */
  const out = [];
  for (const key of Object.keys(VANILLA_ENEMY_BASICS)) {
    const id = Number(key), row = VANILLA_ENEMY_BASICS[key];
    if (!(row.maleTexture > 0)) continue;
    let ranged;
    if (id < 128) ranged = row.hasRangedAttack1 === true;
    else if (KG_RANGED_CLASSES.includes(id)) ranged = true;
    else continue;
    const u = makeUnit(id, { ranged });
    if (u) out.push(u);
  }
  return out.sort((a, b) => a.cost - b.cost || ordinal(a.name, b.name) || a.id - b.id);
}
const BY_ID = new Map(KG_ROSTER.map((u) => [u.id, u]));
/** A recruitable unit by its mobile type, or null. @param {number} id @returns {GambitUnit|null} */
export const rosterUnit = (id) => BY_ID.get(id) ?? null;
/** THE KINGS: KG_KING_CLASSES' rows as kings - the host's, then the guest's (one set of numbers: level 8, 70 hp, attack
 *  16, free). */
export const KG_KINGS = Object.freeze(KG_KING_CLASSES.map((id) => makeUnit(id, { king: true })));

// ── THE ARMIES ────────────────────────────────────────────────────────────────────────────────────────────────────

/** An army's cost (ArmyCost): its units' costs, an id the roster does not hold costing nothing (armyRefusal refuses
 *  it first). @param {number[]} ids */
export function armyCost(ids) {
  let sum = 0;
  for (const id of ids) sum += rosterUnit(id)?.cost ?? 0;
  return sum;
}

/**
 * Why an army may not take the board - 'shape' (not a list of integers), 'empty', 'units' (more than KG_MAX_UNITS),
 * 'unit' (an id the roster does not hold), 'points' (it costs more than `budget`) - or null. ParseArmy's law, and
 * TryAdd's bounds (StartBattle asks for one unit at least). Every index is read: a hole in a list is no integer (AUDIT
 * KG A3 - `every` steps over a hole, so `[0, , 1]` passed and the deployment threw).
 * @param {any} ids @param {number} [budget]
 */
export function armyRefusal(ids, budget = KG_POINT_BUDGET) {
  if (!Array.isArray(ids) || !Array.from(ids).every(Number.isInteger)) return 'shape';
  if (!ids.length) return 'empty';
  if (ids.length > KG_MAX_UNITS) return 'units';
  if (!ids.every((id) => BY_ID.has(id))) return 'unit';
  return armyCost(ids) > budget ? 'points' : null;
}

/** Whether unit `id` may join `army` (TryAdd): the roster holds it, there is room for it, and the points cover it.
 *  @param {number[]} army @param {number} id @param {number} [budget] */
export function canRecruit(army, id, budget = KG_POINT_BUDGET) {
  const u = rosterUnit(id);
  return !!u && army.length < KG_MAX_UNITS && armyCost(army) + u.cost <= budget;
}

/**
 * AUTO-FILL (AutoFill): `army` topped up toward `budget`, as a new list - or null for a source that is not one (the
 * law's checked source, checkedRand32: AUDIT KG A2 - one stuck at a draw drawBelow throws back spun for ever). While it
 * holds fewer than KG_MAX_UNITS, and for at most KG_AUTOFILL_ROUNDS rounds: the units the points left still buy (none:
 * stop); while it holds fewer than KG_AUTOFILL_RANGED ranged units, one time in two (KG_AUTOFILL_LEAN) only the ranged
 * among them, if there are any; two drawn at random from those, the dearer kept (the first on a tie). `rand32` stands
 * for Unity's shared Random - Random.value is nextDouble at float32, compared with the C#'s 0.5f (AUDIT KG A1: raw
 * draws 2147483584 to 2147483647 round up to 0.5f and do not lean), Random.Range(0, n) drawBelow(n). The player's
 * Auto-fill and a regular's army alike.
 * @param {number[]} army @param {number} budget @param {() => number} source
 * @returns {number[]|null}
 */
export function autoFill(army, budget, source) {
  const out = army.slice();
  const rand32 = checkedRand32(source);
  let money = budget - armyCost(out);
  try {
    for (let round = 0; out.length < KG_MAX_UNITS && round < KG_AUTOFILL_ROUNDS; round++) {
      let list = KG_ROSTER.filter((u) => u.cost <= money);
      if (!list.length) break;
      if (out.filter((id) => rosterUnit(id)?.ranged).length < KG_AUTOFILL_RANGED && f32(nextDouble(rand32)) < f32(KG_AUTOFILL_LEAN)) {
        const ranged = list.filter((u) => u.ranged);
        if (ranged.length) list = ranged;
      }
      let u = list[drawBelow(list.length, rand32)];
      const v = list[drawBelow(list.length, rand32)];
      if (v.cost > u.cost) u = v;
      out.push(u.id);
      money -= u.cost;
    }
  } catch { return null; }
  return out;
}

/** NextDouble: a [0, 1) draw off a 32-bit source - the law's (a blow's roll), and Unity's Random.value at float32, where
 *  it is [0, 1] as Unity's is (the top 128 draws round to 1): Auto-fill's lean, and the regulars' choices
 *  (systems/gambit/gambitPatrons.js, KG2). @param {() => number} rand32 */
export const nextDouble = (rand32) => (rand32() >>> 0) / 4294967296;

// ── THE BOARD ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A cell's index in a board's `tiles` (row-major), and whether a cell is on the board (InBounds). */
export const cellIndex = (/** @type {number} */ c, /** @type {number} */ r) => r * KG_COLS + c;
export const inBounds = (/** @type {number} */ c, /** @type {number} */ r) => c >= 0 && c < KG_COLS && r >= 0 && r < KG_ROWS;
/** A cell's tile, or -1 off the board. @param {number[]} tiles @param {number} c @param {number} r */
export const tileAt = (tiles, c, r) => (inBounds(c, r) ? tiles[cellIndex(c, r)] : -1);
/** IsPassable: floor alone is walked. @param {number[]} tiles @param {number} c @param {number} r */
export const isPassable = (tiles, c, r) => tileAt(tiles, c, r) === KG_TILE.floor;
/** BlocksSight: a wall or a pillar (water does not). @param {number[]} tiles @param {number} c @param {number} r */
export const blocksSight = (tiles, c, r) => { const t = tileAt(tiles, c, r); return t === KG_TILE.wall || t === KG_TILE.pillar; };

/** The four steps breadth-first walks take, in the mod's order. */
const STEPS = Object.freeze([Object.freeze([1, 0]), Object.freeze([-1, 0]), Object.freeze([0, 1]), Object.freeze([0, -1])]);

/** Rand(a, b): a draw in [a, b). @param {() => number} rand32 @param {number} a @param {number} b */
const rand = (rand32, a, b) => a + drawBelow(b - a, rand32);

/** SetTile: a cell and its mirror through the centre, only within the zone's rows. */
function setTile(/** @type {number[]} */ tiles, /** @type {number} */ c, /** @type {number} */ r, /** @type {number} */ t) {
  if (c >= 0 && c < KG_COLS && r >= KG_ZONE_TOP && r <= KG_ZONE_BOTTOM) {
    tiles[cellIndex(c, r)] = t;
    tiles[cellIndex(KG_COLS - 1 - c, KG_ROWS - 1 - r)] = t;
  }
}
/** PlaceWallCell: a wall on floor, never on the board's first or last column, within the zone's rows. */
function placeWallCell(/** @type {number[]} */ tiles, /** @type {number} */ c, /** @type {number} */ r) {
  if (c >= 1 && c <= KG_COLS - 2 && r >= KG_ZONE_TOP && r <= KG_ZONE_BOTTOM && tiles[cellIndex(c, r)] === KG_TILE.floor) setTile(tiles, c, r, KG_TILE.wall);
}
/** RandomChunks: `count` small walls, each a cell and its shape's neighbours. */
function randomChunks(/** @type {number[]} */ tiles, /** @type {number} */ count, /** @type {() => number} */ rand32) {
  for (let i = 0; i < count; i++) {
    const c = rand(rand32, 1, 14), r = rand(rand32, 3, 7), shape = rand(rand32, 0, 5);
    placeWallCell(tiles, c, r);
    if (shape === 1) placeWallCell(tiles, c + 1, r);
    else if (shape === 2) placeWallCell(tiles, c, r + 1);
    else if (shape === 3) { placeWallCell(tiles, c + 1, r); placeWallCell(tiles, c, r + 1); }
    else if (shape === 4) { placeWallCell(tiles, c - 1, r); placeWallCell(tiles, c + 1, r); }
  }
}

/**
 * PathMap: each cell's steps from (c, r) over floor, four ways, pieces no bar - or KG_UNREACHABLE. A flat array, the
 * board's index; a start off the board reaches nothing.
 * @param {number[]} tiles @param {number} c @param {number} r
 */
export function pathMap(tiles, c, r) {
  const dist = new Array(KG_COLS * KG_ROWS).fill(KG_UNREACHABLE);
  if (!inBounds(c, r)) return dist;
  dist[cellIndex(c, r)] = 0;
  const queue = [[c, r]];
  for (let q = 0; q < queue.length; q++) {
    const [x, y] = queue[q];
    for (const [dx, dy] of STEPS) {
      const nx = x + dx, ny = y + dy;
      if (isPassable(tiles, nx, ny) && dist[cellIndex(nx, ny)] === KG_UNREACHABLE) {
        dist[cellIndex(nx, ny)] = dist[cellIndex(x, y)] + 1;
        queue.push([nx, ny]);
      }
    }
  }
  return dist;
}

/** MapIsPlayable: the head's king cell reached from the foot's over floor, and at least KG_PLAYABLE_SHARE of the floor
 *  with it - compared at float32, as the C# writes it. @param {number[]} tiles */
export function mapIsPlayable(tiles) {
  const [kc, kr] = KG_KING_CELL;
  const dist = pathMap(tiles, kc, kr);
  if (dist[cellIndex(kc, KG_ROWS - 1 - kr)] >= KG_UNREACHABLE) return false;
  let floor = 0, reached = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] !== KG_TILE.floor) continue;
    floor++;
    if (dist[i] < KG_UNREACHABLE) reached++;
  }
  return f32(reached) >= f32(f32(floor) * f32(KG_PLAYABLE_SHARE));
}

/** @typedef {{col: number, row: number, kind: string, active: boolean}} GambitHazard */
/** @typedef {{id: number, side: number, unit: number, king: boolean, ranged: boolean, col: number, row: number, level: number, hp: number, maxHp: number, atk: number}} GambitPiece */
/** @typedef {{tiles: number[], hazards: GambitHazard[], pieces: GambitPiece[]}} GambitBoard */

/** The first hazard on (c, r) (HazardAt), or null. @param {{hazards: GambitHazard[]}} board @param {number} c @param {number} r */
export const hazardAt = (board, c, r) => board.hazards.find((h) => h.col === c && h.row === r) ?? null;
/** KG3: the round at whose end the warnings standing in round `round` turn into hazards - HazardTick's clock as
 *  finishTurn keeps it (the round counts on after the guest's turn, and every KG_HAZARD_SPAWN_EVERY-th count arms them),
 *  so a client says it off the law and never off the constant's present value. @param {number} round */
export const warningsArmAt = (round) => round + ((KG_HAZARD_SPAWN_EVERY - ((round + 1) % KG_HAZARD_SPAWN_EVERY)) % KG_HAZARD_SPAWN_EVERY);
/** The piece on (c, r) (PieceAt), or null. @param {{pieces: GambitPiece[]}} board @param {number} c @param {number} r */
export const pieceAt = (board, c, r) => board.pieces.find((p) => p.col === c && p.row === r) ?? null;
/** The piece numbered `id` (PieceById), or null. @param {{pieces: GambitPiece[]}} board @param {number} id */
export const pieceById = (board, id) => board.pieces.find((p) => p.id === id) ?? null;

/** FreeForHazard: floor on the board with no hazard and no piece on it. @param {GambitBoard} board */
function freeForHazard(board, /** @type {number} */ c, /** @type {number} */ r) {
  return isPassable(board.tiles, c, r) && !hazardAt(board, c, r) && !pieceAt(board, c, r);
}
/** SpawnHazardPair: up to KG_HAZARD_TRIES tries of a cell in the zone and its mirror, neither the centre's own nor taken;
 *  the pair's kind drawn after its cells. Answers whether a pair was laid. @param {GambitBoard} board */
function spawnHazardPair(board, /** @type {boolean} */ active, /** @type {() => number} */ rand32) {
  for (let i = 0; i < KG_HAZARD_TRIES; i++) {
    const c = rand(rand32, 0, KG_COLS), r = rand(rand32, KG_ZONE_TOP, KG_ZONE_BOTTOM + 1);
    const mc = KG_COLS - 1 - c, mr = KG_ROWS - 1 - r;
    if ((c !== mc || r !== mr) && freeForHazard(board, c, r) && freeForHazard(board, mc, mr)) {
      const kind = KG_HAZARD_KINDS[rand(rand32, 0, KG_HAZARD_KINDS.length)];
      board.hazards.push({ col: c, row: r, kind, active }, { col: mc, row: mr, kind, active });
      return true;
    }
  }
  return false;
}

/** A clear board: every cell floor. */
const clearTiles = () => new Array(KG_COLS * KG_ROWS).fill(KG_TILE.floor);

/**
 * THE BOARD (BuildMap): `{tiles, hazards, layout}`. Up to KG_MAP_TRIES tries, each a cleared board, a layout by Rand(0,
 * 4), KG_HAZARD_PAIRS_AT_START active pairs, kept when it is playable; past them the Open field, no wall and its pairs.
 * @param {() => number} rand32
 */
export function buildMap(rand32) {
  for (let i = 0; i < KG_MAP_TRIES; i++) {
    const tiles = clearTiles(), board = { tiles, hazards: [], pieces: [] };
    const which = rand(rand32, 0, KG_LAYOUTS.length);
    if (which === 0) {
      for (let r = 3; r <= 9; r += 2) for (let c = 1; c < 14; c += 3) setTile(tiles, c, r, KG_TILE.pillar);
      randomChunks(tiles, 2, rand32);
    } else if (which === 1) {
      const k = rand(rand32, 1, 4);
      for (let c = 0; c < KG_COLS; c++) if (c !== k && c !== 7 && c !== 14 - k) setTile(tiles, c, 5, KG_TILE.wall);
      setTile(tiles, 5, 6, KG_TILE.wall);
      randomChunks(tiles, 2, rand32);
    } else if (which === 2) {
      randomChunks(tiles, 8, rand32);
    } else {
      const k = rand(rand32, 2, 6);
      for (let c = 0; c < KG_COLS; c++) if (c !== k && c !== 7 && c !== 14 - k) setTile(tiles, c, 6, KG_TILE.water);
      randomChunks(tiles, 3, rand32);
    }
    for (let n = 0; n < KG_HAZARD_PAIRS_AT_START; n++) spawnHazardPair(board, true, rand32);
    if (mapIsPlayable(tiles)) return { tiles, hazards: board.hazards, layout: KG_LAYOUTS[which].key };
  }
  const board = { tiles: clearTiles(), hazards: [], pieces: [] };
  for (let n = 0; n < KG_HAZARD_PAIRS_AT_START; n++) spawnHazardPair(board, true, rand32);
  return { tiles: board.tiles, hazards: board.hazards, layout: KG_OPEN_FIELD.key };
}

// ── THE DEPLOYMENT ────────────────────────────────────────────────────────────────────────────────────────────────

/** CenterOut: the columns from the board's middle outward, the lower side first (7, 6, 8, 5, 9 ... 0, 14). */
export const KG_CENTER_OUT = Object.freeze((() => {
  const mid = KG_KING_CELL[0], out = [mid];
  for (let i = 1; i < KG_COLS; i++) {
    if (mid - i >= 0) out.push(mid - i);
    if (mid + i < KG_COLS) out.push(mid + i);
  }
  return out;
})());

/** PlaceArmy, for side `side` (AddPiece mirrors the guest's): the king on its cell, then the units dearest first (a tie
 *  by id) - a melee unit into row 11, else 10, else 12; a ranged one into 12, else 10, else 11 - each row centre-out,
 *  row 12 without the king's column. Pieces are numbered from `next.n` in that order. */
function placeArmy(/** @type {GambitPiece[]} */ pieces, /** @type {number[]} */ ids, /** @type {number} */ side, /** @type {{n: number}} */ next) {
  const [kc, kr] = KG_KING_CELL;
  const add = (/** @type {GambitUnit} */ u, /** @type {number} */ col, /** @type {number} */ row) => {
    if (side === 1) { col = KG_COLS - 1 - col; row = KG_ROWS - 1 - row; }
    pieces.push({ id: next.n++, side, unit: u.id, king: u.king, ranged: u.ranged, col, row, level: u.level, hp: u.hp, maxHp: u.hp, atk: u.atk });
  };
  add(KG_KINGS[side], kc, kr);
  /** @type {number[][]} */ const back = [], middle = [], front = [];
  for (const c of KG_CENTER_OUT) {
    if (c !== kc) back.push([c, kr]);
    middle.push([c, kr - 1]);
    front.push([c, kr - 2]);
  }
  const units = ids.map(rosterUnit).sort((a, b) => b.cost - a.cost || a.id - b.id);
  for (const u of units) {
    const slot = u.ranged ? (back.shift() ?? front.shift() ?? middle.shift()) : (middle.shift() ?? front.shift() ?? back.shift());
    if (slot) add(u, slot[0], slot[1]);
  }
}

// ── A GAME ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** @typedef {GambitBoard & {layout: string, turn: number, actions: number, round: number, potions: number[], ending: boolean, over: {winner: number, fallen: number}|null}} GambitState */

/** The two sides, the host's and the guest's. */
const SIDES = Object.freeze([0, 1]);

/** THE SOURCE, CHECKED: a 32-bit draw, at most KG_RAND_DRAWS_MAX of them, or it throws ('rand32') - so a step that
 *  draws through it is refused rather than spun for ever. The law's every step, and the regulars' (gambitPatrons.js
 *  regularStep). @param {any} source @returns {() => number} */
export function checkedRand32(source) {
  let draws = 0;
  return () => {
    const v = source();
    if (!Number.isInteger(v) || v < 0 || v > 0xFFFFFFFF || ++draws > KG_RAND_DRAWS_MAX) throw new Error('rand32');
    return v;
  };
}

/**
 * A NEW GAME (BeginMatch), or null for one the law refuses: two armies (`armies[side]`, roster ids, each lawful within
 * its `budgets[side]` - the host's KG_POINT_BUDGET, a regular's its tier's), each side's `potions` (the host's
 * KG_POTIONS_PER_SIDE, a regular's its tier's), and `rand32`. The board is built first (BuildMap), then the host's army
 * placed, then the guest's - the pieces numbered in that order. The host moves first, two actions; round 1.
 * @param {{armies: number[][], rand32: () => number, potions?: number[], budgets?: number[]}} p
 * @returns {GambitState|null}
 */
export function newGambit({ armies, rand32: source, potions = [KG_POTIONS_PER_SIDE, KG_POTIONS_PER_SIDE], budgets = [KG_POINT_BUDGET, KG_POINT_BUDGET] }) {
  // each side read by its index, as armyRefusal reads a list: `every` and `some` step over a hole (AUDIT KG A3)
  if (!Array.isArray(armies) || armies.length !== 2 || typeof source !== 'function') return null;
  if (!Array.isArray(budgets) || budgets.length !== 2 || !SIDES.every((s) => Number.isInteger(budgets[s]) && budgets[s] >= 0 && budgets[s] <= KG_BUDGET_MAX)) return null;
  if (!Array.isArray(potions) || potions.length !== 2 || !SIDES.every((s) => Number.isInteger(potions[s]) && potions[s] >= 0 && potions[s] <= KG_POTIONS_MAX)) return null;
  if (SIDES.some((s) => armyRefusal(armies[s], budgets[s]) !== null)) return null;
  let map;
  try { map = buildMap(checkedRand32(source)); } catch { return null; }
  /** @type {GambitPiece[]} */ const pieces = [];
  const next = { n: 0 };
  placeArmy(pieces, armies[0], 0, next);
  placeArmy(pieces, armies[1], 1, next);
  return { layout: map.layout, tiles: map.tiles, hazards: map.hazards, pieces, turn: 0, actions: KG_ACTIONS_PER_TURN, round: 1, potions: potions.slice(), ending: false, over: null };
}

// ── WHAT A PIECE MAY DO ───────────────────────────────────────────────────────────────────────────────────────────

/** Manhattan distance (Distance). */
export const distance = (/** @type {number} */ c1, /** @type {number} */ r1, /** @type {number} */ c2, /** @type {number} */ r2) => Math.abs(c1 - c2) + Math.abs(r1 - r2);
/** A piece's reach (RangeOf): KG_RANGED_RANGE ranged, 1 else. @param {{ranged: boolean}} p */
export const rangeOf = (p) => (p.ranged ? KG_RANGED_RANGE : 1);
/** RoundDiv: num / den rounded half away from zero, in integers (den > 0). */
export function roundDiv(/** @type {number} */ num, /** @type {number} */ den) {
  const q = Math.trunc((2 * Math.abs(num) + den) / (2 * den));
  return num >= 0 ? q : -q;
}
/**
 * HasLineOfSight: KG_SIGHT_SAMPLES samples a cell along the longer axis from (c1, r1) to (c2, r2), each rounded by
 * RoundDiv; a wall or a pillar on any sampled cell but the two ends blocks it.
 * @param {number[]} tiles @param {number} c1 @param {number} r1 @param {number} c2 @param {number} r2
 */
export function hasLineOfSight(tiles, c1, r1, c2, r2) {
  const dc = c2 - c1, dr = r2 - r1, n = Math.max(Math.abs(dc), Math.abs(dr)) * KG_SIGHT_SAMPLES;
  for (let i = 1; i < n; i++) {
    const c = c1 + roundDiv(dc * i, n), r = r1 + roundDiv(dr * i, n);
    if ((c !== c1 || r !== r1) && (c !== c2 || r !== r2) && blocksSight(tiles, c, r)) return false;
  }
  return true;
}
/**
 * InRange: whether piece `p`, standing on (col, row), reaches `target` - Manhattan distance 1 to its reach, and a ranged
 * blow past 1 only along a sight line.
 * @param {GambitBoard} board @param {GambitPiece} p @param {number} col @param {number} row @param {GambitPiece} target
 */
export function targetInRange(board, p, col, row, target) {
  const d = distance(col, row, target.col, target.row);
  if (d < 1 || d > rangeOf(p)) return false;
  return !(p.ranged && d > 1 && !hasLineOfSight(board.tiles, col, row, target.col, target.row));
}
/** FoesInRange: the other side's pieces `p` reaches from where it stands, in the pieces' order. @param {GambitBoard} board @param {GambitPiece} p */
export const foesInRange = (board, p) => board.pieces.filter((o) => o.side !== p.side && targetInRange(board, p, p.col, p.row, o));
/**
 * GetReachable's walk, the law's one: breadth-first from `p`'s cell over floor up to KG_MOVE_RANGE steps, through no piece
 * (its own side's included) - `{met, from}`: the cells in the order the walk meets them, and each met cell's index to the
 * index of the cell it was met from (the start's -1).
 * @param {GambitBoard} board @param {GambitPiece} p
 */
function walkFrom(board, p) {
  /** @type {number[][]} */ const met = [];
  const start = cellIndex(p.col, p.row);
  const steps = new Map([[start, 0]]), from = new Map([[start, -1]]), queue = [[p.col, p.row]];
  for (let q = 0; q < queue.length; q++) {
    const [x, y] = queue[q], d = steps.get(cellIndex(x, y));
    if (d >= KG_MOVE_RANGE) continue;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx, ny = y + dy;
      if (isPassable(board.tiles, nx, ny) && !steps.has(cellIndex(nx, ny)) && !pieceAt(board, nx, ny)) {
        steps.set(cellIndex(nx, ny), d + 1);
        from.set(cellIndex(nx, ny), cellIndex(x, y));
        queue.push([nx, ny]);
        met.push([nx, ny]);
      }
    }
  }
  return { met, from };
}

/**
 * GetReachable: the cells `p` may move to, breadth-first over floor up to KG_MOVE_RANGE steps, through no piece (its own
 * side's included), never its own cell - `[col, row]` in the order the walk meets them.
 * @param {GambitBoard} board @param {GambitPiece} p
 */
export const reachable = (board, p) => walkFrom(board, p).met;

/**
 * KG4 (section 10.1, AUDIT KG C22): THE WAY A MOVE WALKED - GetReachable's own walk from `p`'s cell, kept as the path it
 * met (col, row) by: `[[col, row], ...]` from `p`'s cell to (col, row), a cell a step, or null where the walk does not
 * reach it. The mod slides a piece straight at its new cell (MoveTowards), through whatever stands between; the board
 * walks it this way, so a piece never crosses a wall. Read on the board BEFORE the move (the move event carries only its
 * two ends).
 * @param {GambitBoard} board @param {GambitPiece} p @param {number} col @param {number} row
 */
export function reachPath(board, p, col, row) {
  const { from } = walkFrom(board, p);
  const end = inBounds(col, row) ? cellIndex(col, row) : -1;
  if (end === cellIndex(p.col, p.row) || !from.has(end)) return null;
  /** @type {number[][]} */ const path = [];
  for (let i = end; i !== -1; i = /** @type {number} */ (from.get(i))) path.unshift([i % KG_COLS, Math.floor(i / KG_COLS)]);
  return path;
}

/** A blow's damage (Attack): attack x (KG_BLOW_LOW + KG_BLOW_SPREAD x u) at float32, rounded by RoundToInt, at least 1.
 *  `u` is the blow's one NextDouble. @param {number} atk @param {number} u */
export function blowRoll(atk, u) {
  const m = f32(f32(KG_BLOW_LOW) + f32(f32(u) * f32(KG_BLOW_SPREAD)));
  return Math.max(1, roundToInt(f32(f32(atk) * m)));
}

/**
 * Why side `side` may not give command `cmd` now (IsLegal), or null. The words: 'over', 'side', 'shape' (no command, or
 * one missing its numbers), 'ending' (the turn is ending - or out of actions), 'turn' (not this side's), 'piece' (no
 * piece of this side's by that number), 'cell' (a cell the piece does not reach), 'target' (no foe by that number),
 * 'range' (a foe the piece does not reach), 'full' (a potion on a piece at its full health), 'potions' (none left).
 * A command: `{type: 'move', piece, col, row}`, `{type: 'attack', piece, target}`, `{type: 'potion', piece}`,
 * `{type: 'end'}`.
 * @param {GambitState|null} state @param {number} side @param {any} cmd
 */
export function gambitRefusal(state, side, cmd) {
  if (!state || state.over) return 'over';
  if (side !== 0 && side !== 1) return 'side';
  if (!cmd || typeof cmd !== 'object' || !KG_COMMANDS.includes(cmd.type)) return 'shape';
  if (state.ending || state.actions <= 0) return 'ending';
  if (side !== state.turn) return 'turn';
  if (cmd.type === 'end') return null;
  if (!Number.isInteger(cmd.piece)) return 'shape';
  const p = pieceById(state, cmd.piece);
  if (!p || p.side !== side) return 'piece';
  if (cmd.type === 'move') {
    if (!Number.isInteger(cmd.col) || !Number.isInteger(cmd.row)) return 'shape';
    return reachable(state, p).some(([c, r]) => c === cmd.col && r === cmd.row) ? null : 'cell';
  }
  if (cmd.type === 'attack') {
    if (!Number.isInteger(cmd.target)) return 'shape';
    const t = pieceById(state, cmd.target);
    if (!t || t.side === side) return 'target';
    return targetInRange(state, p, p.col, p.row, t) ? null : 'range';
  }
  if (p.hp >= p.maxHp) return 'full';
  return state.potions[side] > 0 ? null : 'potions';
}

/** CheckGameOver, in the host's frame: a side with no king, or no piece, has fallen - the guest's fall read first, as
 *  the host's client reads its opponent's (one blow or one bite can fell one side only). Sets `over`, ends any turn's
 *  ending, says it. Answers whether the game is over. */
function checkOver(/** @type {GambitState} */ st, /** @type {any[]} */ events) {
  if (st.over) return true;
  const king = [false, false], any = [false, false];
  for (const p of st.pieces) {
    any[p.side] = true;
    if (p.king) king[p.side] = true;
  }
  const fallen = !king[1] || !any[1] ? 1 : !king[0] || !any[0] ? 0 : -1;
  if (fallen < 0) return false;
  st.over = { winner: 1 - fallen, fallen };
  st.ending = false;
  events.push({ t: 'over', winner: 1 - fallen, fallen });
  return true;
}

/**
 * A COMMAND APPLIED (Submit: IsLegal, then Apply and SpendAction): `{state, events}` - a NEW state - or `{refused}`
 * (gambitRefusal's word, or 'rand' for a source that is not one; nothing changes). An attack draws its blow's one roll
 * from `rand32`. The turn's last action, or End turn, leaves the turn ENDING until finishTurn.
 * Events: `{t: 'move', side, piece, from, to}`, `{t: 'attack', side, piece, target, damage, killed, shot}` (`shot` a
 * ranged blow past 1 - the mod's bolt), `{t: 'potion', side, piece, healed}`, `{t: 'end', side}`, `{t: 'over', winner,
 * fallen}`.
 * @param {GambitState} state @param {number} side @param {any} cmd @param {() => number} [rand32]
 */
export function gambitAct(state, side, cmd, rand32) {
  const no = gambitRefusal(state, side, cmd);
  if (no) return { refused: no };
  /** @type {any[]} */ const events = [];
  let u = 0;
  if (cmd.type === 'attack') {
    try { u = nextDouble(checkedRand32(rand32)); } catch { return { refused: 'rand' }; }
  }
  /** @type {GambitState} */ const st = structuredClone(state);
  if (cmd.type === 'end') {
    st.actions = 0;
    st.ending = true;
    events.push({ t: 'end', side });
    return { state: st, events };
  }
  const p = pieceById(st, cmd.piece);
  if (cmd.type === 'move') {
    const from = [p.col, p.row];
    p.col = cmd.col;
    p.row = cmd.row;
    events.push({ t: 'move', side, piece: p.id, from, to: [p.col, p.row] });
  } else if (cmd.type === 'attack') {
    const t = pieceById(st, cmd.target);
    const damage = blowRoll(p.atk, u);
    t.hp -= damage;
    const killed = t.hp <= 0;
    events.push({ t: 'attack', side, piece: p.id, target: t.id, damage, killed, shot: p.ranged && distance(p.col, p.row, t.col, t.row) > 1 });
    if (killed) st.pieces = st.pieces.filter((x) => x !== t);
    checkOver(st, events);
  } else {
    st.potions[side]--;
    const healed = Math.min(KG_POTION_HEAL, p.maxHp - p.hp);
    p.hp += healed;
    events.push({ t: 'potion', side, piece: p.id, healed });
  }
  st.actions--;
  if (!st.over && st.actions <= 0) st.ending = true;
  return { state: st, events };
}

/**
 * THE TURN'S END (FinishTurn), taken only while a turn is ending: `{state, events}` - a NEW state - or `{refused}`
 * ('over', 'ending' when no turn is ending, 'rand'). The side that moved takes its hazards, a piece at a time in the
 * pieces' order until the game ends (ApplyHazards: an active hazard bites a piece that ends its turn on it); after the
 * guest's turn the round counts on, and every KG_HAZARD_SPAWN_EVERY-th round the hazards tick (HazardTick: every warning
 * armed, then a new WARNING pair while the board would hold at most KG_MAX_HAZARDS); then the other side's turn, with
 * KG_ACTIONS_PER_TURN actions.
 * Events: `{t: 'hazard', side, piece, kind, damage, killed}`, `{t: 'over', winner, fallen}`, `{t: 'armed', cells}`,
 * `{t: 'warning', kind, cells}`, `{t: 'turn', side, round}`.
 * @param {GambitState} state @param {() => number} [rand32]
 */
export function finishTurn(state, rand32) {
  if (!state || state.over) return { refused: 'over' };
  if (!state.ending) return { refused: 'ending' };
  /** @type {GambitState} */ const st = structuredClone(state);
  /** @type {any[]} */ const events = [];
  st.ending = false;
  const side = st.turn;
  for (const p of st.pieces.slice()) {
    if (p.side !== side) continue;
    const h = hazardAt(st, p.col, p.row);
    if (!h || !h.active) continue;
    const damage = KG_HAZARD_DAMAGE[h.kind];
    p.hp -= damage;
    const killed = p.hp <= 0;
    events.push({ t: 'hazard', side, piece: p.id, kind: h.kind, damage, killed });
    if (killed) st.pieces = st.pieces.filter((x) => x !== p);
    if (checkOver(st, events)) return { state: st, events };
  }
  if (side === 1) {
    st.round++;
    if (st.round % KG_HAZARD_SPAWN_EVERY === 0) {
      const armed = st.hazards.filter((h) => !h.active).map((h) => [h.col, h.row]);
      for (const h of st.hazards) h.active = true;
      if (armed.length) events.push({ t: 'armed', cells: armed });
      if (st.hazards.length + 2 <= KG_MAX_HAZARDS) {
        let laid;
        try { laid = spawnHazardPair(st, false, checkedRand32(rand32)); } catch { return { refused: 'rand' }; }
        if (laid) {
          const [a, b] = st.hazards.slice(-2);
          events.push({ t: 'warning', kind: a.kind, cells: [[a.col, a.row], [b.col, b.row]] });
        }
      }
    }
  }
  st.turn = 1 - side;
  st.actions = KG_ACTIONS_PER_TURN;
  events.push({ t: 'turn', side: st.turn, round: st.round });
  return { state: st, events };
}
