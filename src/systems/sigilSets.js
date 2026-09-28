// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SET1 (2026-09-26) — SIGIL SETS: ARMOUR THAT ANSWERS TO A DAEDRIC PRINCE.
//
// Mac: "I wanna talk about making sigil armor sets that also come with
// set builds (think having multiple of one set type grants detailed
// abilities)". Asked, Mac chose: sets "come from any source, just like
// weapons", a boss's own set at a new rarity (Aetheric), Sigil Stones
// as a currency at a vendor beside the gate; tiers at 2 / 4 / 6 pieces;
// "Grow together" - the bonuses scale with the LOWEST stage among the
// worn pieces; online only, never in duels. Then: "I want you to go all
// out on this, just like you did with the World Boss". Design, and the
// record of every slice: bible/11-Multiplayer/Sigil-Sets.md.
//
// ═══ THIS FILE IS THE LAW ══════════════════════════════════════════
//
// Pure but for the session's two words (online-ness and Renown are
// systems/sigil.js's; the duel is set here): the sets, what a set piece
// is, what an entity wears of each, the stage a set stands at, which of
// its tiers are awake and what every number in them is - and SET4's
// two acts, the roll a won piece is stamped with and the drink (which,
// as SIGIL1's, writes each worn piece a NEW record). What the tiers DO
// lives in systems/sigilSetPowers.js (SET3), which reads this.
//
// ═══ A SET PIECE ═══════════════════════════════════════════════════
//
// An item whose sigil names a set (sigil.js sigilSetId): a piece of
// armour, a shield, or a weapon (never ammunition) - never jewellery,
// clothing or anything else, whatever its record says. The places a
// set is worn are nine: the seven body pieces, the shield, and ONE
// weapon - Daggerfall readies a weapon in each hand and swings one at
// a time, so two weapons of a set in the two hands count once.
//
// ═══ THE STAGE AND THE NUMBERS ═════════════════════════════════════
//
// A piece's stage is its sigil's (sigilStageIn: the lower of its own
// rank and the stage its wearer's Renown opens); the SET's stage is the
// lowest of its worn pieces' - "grow together". Every number a tier has
// is given at Faint and at Ascendant, and a stage between takes its
// place on the line (stageValue). Asleep (-1): offline, online before
// the page knows its Renown, and in a duel - no tier wakes.
// ═══════════════════════════════════════════════════════════════════

import {
  SIGIL_STAGES, SIGIL_SET_IDS, SIGIL_BANDS, sigilSetId, sigilRank, sigilStageIn, renownSigilStage, sigilRenown, sigilChance,
  sigilParty, drinkSigil, sigilRiseLine, sigilOnline, sigilLines, sigilHasBlow,
} from './sigil.js';
import { equipTableOf } from './equip.js';
import { isShieldTemplate } from './armorMaterials.js';
import { isAmmunition } from './itemTemplates.js';
import { EQUIP_SLOTS } from '../characters/paperdoll.js';

/** The pieces a set's tiers wake at. */
export const SET_TIERS = Object.freeze([2, 4, 6]);
/** The last stage (Ascendant): the numbers' line runs from 0 to it. */
export const SET_STAGE_MAX = SIGIL_STAGES.length - 1;

/** The nine places a set is worn - the equip slots of the body pieces and the shield's hand; the weapon is its own
 *  (either hand, once a set). In the order a card lists them. */
export const SET_BODY_SLOTS = Object.freeze([
  EQUIP_SLOTS.Head, EQUIP_SLOTS.RightArm, EQUIP_SLOTS.LeftArm, EQUIP_SLOTS.ChestArmor,
  EQUIP_SLOTS.Gloves, EQUIP_SLOTS.LegsArmor, EQUIP_SLOTS.Feet,
]);
export const SET_PLACES = Object.freeze(['head', 'right arm', 'left arm', 'chest', 'hands', 'legs', 'feet', 'shield', 'weapon']);

// ── the abilities' own constants (what the tiers' words name; sigilSetPowers.js reads them) ──
/** Dagon's Brand (6): a Rampage stack lasts this long, a kill refreshing every one, and no more than this many stand. */
export const RAMPAGE_SECONDS = 12;
export const RAMPAGE_STACKS = 3;
/** Nocturnal's Shroud (6): Eventide's shadow is a Chameleon of whole magic rounds, and online a round is five seconds
 *  of the shared clock (net/wire.js: a classic minute every five real seconds). */
export const ROUND_SECONDS = 5;
/** Ruhn's Regalia (4): Cleave finds the other foe within this many metres of the one struck. */
export const CLEAVE_METRES = 3;
/** Ruhn's Regalia (6): the Wrath wakes when a blow leaves you under this share of your health; its Nova reaches this
 *  far; its fury lasts this long. */
export const WRATH_BELOW = 0.3;
export const NOVA_METRES = 6;
export const WRATH_SECONDS = 10;

const tier = (at, key, name, values, text) => Object.freeze({ at, key, name, values: Object.freeze(values), text });

/**
 * THE SETS. Each: its id (the sigil's `set`), its name, its Prince, its colour, the one line that says what it is for,
 * `aetheric` for a boss's own, and its three tiers - each `{ at, key, name, values: { name: [faint, ascendant] },
 * text(v) }`, `text` saying the tier with the numbers of a stage.
 */
export const SIGIL_SETS = Object.freeze({
  malacath: Object.freeze({
    id: 'malacath', name: "Malacath's Bulwark", prince: 'Malacath', colour: '#a4b84e', aetheric: false,
    role: 'The one who will not fall',
    tiers: Object.freeze([
      tier(2, 'orc-hide', 'Orc-Hide', { armor: [2, 5], endurance: [2, 6] },
        (v) => `+${v.armor} armour on every part, +${v.endurance} Endurance`),
      tier(4, 'spite', 'Spite of the Spurned', { back: [10, 30] },
        (v) => `A foe whose blow lands on you takes ${v.back}% of it back`),
      tier(6, 'unbroken', 'Unbroken', { halved: [4, 8], recover: [300, 150] },
        (v) => `Damage that would kill you leaves you at 1 health instead, and all damage you take is halved for ${v.halved} s. Recovers in ${v.recover} s`),
    ]),
  }),
  dagon: Object.freeze({
    id: 'dagon', name: "Dagon's Brand", prince: 'Mehrunes Dagon', colour: '#ec5a3c', aetheric: false,
    role: 'The one who does not stop',
    tiers: Object.freeze([
      tier(2, 'ravager', 'Ravager', { strength: [2, 6], critical: [4, 12] },
        (v) => `+${v.strength} Strength, +${v.critical} Critical Strike`),
      tier(4, 'bloodfury', 'Bloodfury', { more: [4, 12] },
        (v) => `Your weapon blows deal +${v.more}% damage, +${v.more * 2}% below half health`),
      tier(6, 'rampage', 'Rampage', { stack: [4, 10] },
        (v) => `Each kill grants a Rampage stack for ${RAMPAGE_SECONDS} s, up to ${RAMPAGE_STACKS}: +${v.stack}% weapon damage a stack`),
    ]),
  }),
  nocturnal: Object.freeze({
    id: 'nocturnal', name: "Nocturnal's Shroud", prince: 'Nocturnal', colour: '#9384f2', aetheric: false,
    role: 'The one who is not seen',
    tiers: Object.freeze([
      tier(2, 'shadows-grace', "Shadow's Grace", { stealth: [4, 12], agility: [2, 6] },
        (v) => `+${v.stealth} Stealth, +${v.agility} Agility`),
      tier(4, 'nightfall', 'Nightfall Strike', { more: [25, 60] },
        (v) => `A weapon blow at a foe that has not noticed you deals +${v.more}% damage, arrows too`),
      tier(6, 'eventide', 'Eventide', { rounds: [1, 3], recover: [30, 15] },
        (v) => `A kill wraps you in shadow (Chameleon) for ${v.rounds * ROUND_SECONDS} s. Recovers in ${v.recover} s`),
    ]),
  }),
  mora: Object.freeze({
    id: 'mora', name: "Mora's Mantle", prince: 'Hermaeus Mora', colour: '#43c49b', aetheric: false,
    role: 'The one who knows',
    tiers: Object.freeze([
      tier(2, 'forbidden-lore', 'Forbidden Lore', { intelligence: [2, 6], schools: [2, 6] },
        (v) => `+${v.intelligence} Intelligence, +${v.schools} to every school of magic`),
      tier(4, 'waters', 'Waters of Oblivion', { less: [5, 15] },
        (v) => `Your spells cost ${v.less}% less magicka`),
      tier(6, 'eye', 'Eye of Mora', { absorb: [10, 30] },
        (v) => `A Destruction spell that strikes you is absorbed ${v.absorb}% of the time - its magicka yours, if you have room for it`),
    ]),
  }),
  ruhn: Object.freeze({
    id: 'ruhn', name: "Ruhn's Regalia", prince: 'Mehrunes Dagon', colour: '#ffae45', aetheric: true,
    role: 'The Warden of the Burning Gate, worn',
    tiers: Object.freeze([
      tier(2, 'burning-gate', 'The Burning Gate', { fire: [15, 45], sear: [2, 6] },
        (v) => `+${v.fire} fire resistance; your weapon blows sear for ${v.sear} more damage`),
      tier(4, 'cleave', 'Cleave', { share: [25, 60] },
        (v) => `Your melee blows also strike the nearest other foe within ${CLEAVE_METRES} m of your target for ${v.share}% of the blow`),
      tier(6, 'wrath', 'Wrath of the Warden', { nova: [10, 40], more: [10, 25], recover: [180, 90] },
        (v) => `When a blow takes you below ${Math.round(WRATH_BELOW * 100)}% health, a Flame Nova deals ${v.nova} damage to every foe within ${NOVA_METRES} m, and your weapon blows deal +${v.more}% for ${WRATH_SECONDS} s. Recovers in ${v.recover} s`),
    ]),
  }),
});
/** The sets of the world (the four any win may roll), and every set, in the registry's order. */
export const WORLD_SET_IDS = Object.freeze(Object.values(SIGIL_SETS).filter((s) => !s.aetheric).map((s) => s.id));
export const setById = (id) => (typeof id === 'string' && Object.hasOwn(SIGIL_SETS, id) ? SIGIL_SETS[id] : null);

/** A number of a tier at a stage: its place on the line from Faint to Ascendant, rounded. Stage clamped to 0..4. */
export function stageValue(pair, stage) {
  const [faint, asc] = pair;
  const s = Math.max(0, Math.min(SET_STAGE_MAX, Math.trunc(Number(stage) || 0)));
  return Math.round(faint + ((asc - faint) * s) / SET_STAGE_MAX);
}
/** Every number of a tier at a stage. */
export function tierValues(t, stage) {
  const out = {};
  for (const [k, pair] of Object.entries(t.values)) out[k] = stageValue(pair, stage);
  return out;
}

/** The kind of place an item is worn in, if it may be a set piece at all: 'armor' (a body piece), 'shield', 'weapon',
 *  or null (jewellery, clothing, ammunition, anything else). */
export function setPieceKind(item) {
  if (!item) return null;
  if (item.group === 'Armor') return isShieldTemplate(item.templateIndex) ? 'shield' : 'armor';
  if (item.group === 'Weapons') return isAmmunition(item) ? null : 'weapon';
  return null;
}
/** The set an item is a piece of, or null: its sigil names one AND it is a kind a set may be worn as. */
export const setIdOf = (item) => (setPieceKind(item) ? sigilSetId(item?.sigil) : null);
export const isSetPiece = (item) => setIdOf(item) != null;

/**
 * THE WORN PIECES, per set: `Map<id, item[]>`, in the registry's order - the body pieces and the shield where they
 * are worn, and one weapon a set (the right hand's before the left's: the first found). An entity that wears no set
 * piece answers an empty map. The table is the entity's equip table (equip.js equipTableOf); a piece in the pack
 * counts for nothing.
 */
export function wornSetPieces(entity) {
  /** @type {Map<string, any[]>} */
  const out = new Map();
  const slots = entity?.equip ? equipTableOf(entity) : null;
  if (!slots) return out;
  const add = (it) => { const id = setIdOf(it); if (!id) return; if (!out.has(id)) out.set(id, []); out.get(id).push(it); };
  for (const slot of SET_BODY_SLOTS) { const it = slots[slot]; if (it && setPieceKind(it) === 'armor') add(it); }
  const left = slots[EQUIP_SLOTS.LeftHand], right = slots[EQUIP_SLOTS.RightHand];
  if (left && setPieceKind(left) === 'shield') add(left);
  const weaponOf = new Set();
  for (const hand of [right, left]) {
    if (!hand || setPieceKind(hand) !== 'weapon') continue;
    const id = setIdOf(hand);
    if (!id || weaponOf.has(id)) continue;   // one weapon a set
    weaponOf.add(id);
    add(hand);
  }
  // the registry's order, whatever order the table gave
  return new Map([...out.entries()].sort((a, b) => SIGIL_SET_IDS.indexOf(a[0]) - SIGIL_SET_IDS.indexOf(b[0])));
}

// ── the session: the duel (online-ness and Renown are sigil.js's) ──
let _dueling = false;
/** The host's word (scenes/world.js, at a duel's start and end): the player is in a duel, and every set sleeps. */
export function setSetsDueling(on) { _dueling = !!on; }
export const setsDueling = () => _dueling;
/** Are sets awake at all: online, my Renown known, not in a duel. */
export const setsAwake = () => sigilRenown() != null && !_dueling;

/**
 * A WORN SET'S STATE for a Renown: how many of its pieces are worn, the stage it stands at (-1 asleep), what holds it
 * there - `heldPiece`, the worn piece of the lowest rank when it is no higher than the Renown's stage (the one to
 * grow), and `heldRenown` when the Renown's stage is no higher than that piece's (both, when they meet; neither at
 * Ascendant or asleep) - and its three tiers, each awake or not with its numbers AT THE SET'S STAGE (Faint's while it
 * sleeps, so a card can still say what it would do).
 * AUDIT SET U3: the piece holding the set is the one FURTHEST BEHIND - the least XP - not the first of the lowest stage
 * in slot order: a helm 100 XP from Kindled and fresh boots are both Faint, and the boots are the ones to grow.
 * AUDIT SET L5: `text: false` leaves the tiers' words unbuilt - the powers and the HUD ask every frame, and read numbers.
 * @param {string} id @param {Array<{ sigil?: any }>} pieces @param {number|null} renown @param {boolean} [awake]
 * @param {{ text?: boolean }} [opts]
 */
export function setState(id, pieces, renown, awake = true, { text = true } = {}) {
  const set = setById(id);
  if (!set) return null;
  const count = pieces.length;
  const cap = awake ? renownSigilStage(renown) : -1;
  let low = null, lowXp = Infinity;
  for (const p of pieces) { const x = Number(p.sigil?.xp) || 0; if (x < lowXp) { lowXp = x; low = p; } }
  const lowRank = low ? sigilRank(low.sigil) : SET_STAGE_MAX + 1;
  const stage = cap < 0 || !count ? -1 : Math.min(lowRank, cap);
  let heldPiece = null, heldRenown = false;
  if (stage >= 0 && stage < SET_STAGE_MAX) { heldPiece = lowRank <= cap ? low : null; heldRenown = cap <= lowRank; }
  const at = Math.max(0, stage);
  return {
    id, set, count, stage, heldPiece, heldRenown,
    renownNext: heldRenown ? SIGIL_STAGES[stage + 1].renown : null,   // the Renown that opens the next stage
    stageName: stage < 0 ? 'Dormant' : SIGIL_STAGES[stage].name,
    tiers: set.tiers.map((t) => {
      const values = tierValues(t, at);
      return { at: t.at, key: t.key, name: t.name, awake: stage >= 0 && count >= t.at, values, text: text ? t.text(values) : '',
        full: text ? t.text(tierValues(t, SET_STAGE_MAX)) : '' };
    }),
  };
}
/** Every set an entity wears at least one piece of, in the registry's order - what the card, the paperdoll and the
 *  powers read. `renown` and `awake` default to the session's. */
export function wornSets(entity, renown = sigilRenown(), awake = setsAwake(), opts = undefined) {
  const out = [];
  for (const [id, pieces] of wornSetPieces(entity)) { const st = setState(id, pieces, renown, awake, opts); if (st) out.push(st); }
  return out;
}
/**
 * THE POWERS' ONE QUESTION: the numbers of tier `index` (0, 1, 2 - the 2-, 4- and 6-piece) of set `id` if it is awake
 * on this entity now, else null. Only the player's own sets are ever awake (a peer's entity here, or a foe, answers
 * null): the Renown the session knows is mine.
 */
export function awakeTier(entity, id, index) {
  if (!entity?.isPlayer || entity.peer || !setsAwake()) return null;
  const pieces = wornSetPieces(entity).get(id);
  if (!pieces) return null;
  const st = setState(id, pieces, sigilRenown(), true);
  const t = st?.tiers[index];
  return t && t.awake ? t.values : null;
}

// ═══ SET4: WHERE SET PIECES COME FROM, AND HOW THEY GROW ═══════════
//
// THE WIN (Mac: sets "come from any source, just like weapons"): when a list is won online - a corpse at its foe's
// death, a pile when it is minted: every door SIGIL1 stamps at (lootRarity.js stampWonWeapons) - every Magic-or-better
// piece of armour and every shield rolls a set sigil by SIGIL1's own chance law, one of the four sets of the world at
// even odds; and a weapon's sigil, when it lands, joins a set one time in three. The Aetheric set is never rolled here:
// it is the boss's (SET6) and the Broker's (SET7).
//
// THE DRINK ("grow together"): every point of Renown XP I earn is drunk by the weapon in my hand (SIGIL1) and by
// every set piece I wear, each once; a rise is said once for a set, when its own rank - its lowest piece's - rises.

/** A weapon sigil a win stamps joins a set of the world one time in this many. */
export const SET_WEAPON_JOIN_IN = 3;
/** One of the four sets of the world, at even odds, off one roll. */
export const rollWorldSet = (rolls = Math.random) => WORLD_SET_IDS[Math.min(WORLD_SET_IDS.length - 1, Math.floor(rolls() * WORLD_SET_IDS.length))];
/**
 * A won piece of armour's (or a shield's) set sigil, for its tier and its fight: SIGIL1's own chance law (sigilChance -
 * 200 per mille alone, 40 more a fighter past the first), then one of the four sets of the world. Null most times, and
 * always for a tier with no sigil band (Common, an artifact); else a fresh record at Faint with no blow.
 */
export function rollSetSigil(tier, party, rolls = Math.random) {
  if (!SIGIL_BANDS[tier]) return null;
  if (rolls() * 1000 >= sigilChance(party)) return null;
  return { set: rollWorldSet(rolls), party: sigilParty(party), xp: 0 };
}
/** A fresh weapon sigil's set: one of the four, one time in SET_WEAPON_JOIN_IN; else null. */
export const rollSetJoin = (rolls = Math.random) => (rolls() * SET_WEAPON_JOIN_IN < 1 ? rollWorldSet(rolls) : null);

/** A set's own rank: its lowest piece's (0..4), whatever the Renown. */
const lowestRank = (pieces) => pieces.reduce((low, p) => Math.min(low, sigilRank(p.sigil)), SET_STAGE_MAX);
/** What the page says when a set I wear rises to `rank`: its stage, and what my Renown holds it at when that is lower
 *  (SIGIL1's line, for a set). */
export function setRiseLine(id, rank) {
  const set = setById(id), stage = SIGIL_STAGES[rank];
  if (!set || !stage) return null;
  const line = `Your ${set.name} brightens: ${stage.name}.`;
  const cap = renownSigilStage(sigilRenown());
  if (cap < 0 || cap >= rank) return line;
  return `${line} Your Renown holds it at ${SIGIL_STAGES[cap].name} until Renown ${SIGIL_STAGES[cap + 1].renown}.`;
}
/**
 * THE DRINK, WHOLE (scenes/world.js sigilDrinks, at every kill's and quest's Renown XP): the weapon in my hand drinks
 * `xp` (SIGIL1's drinkSigil: online, my Renown known, never past the last stage) and so does every set piece I wear -
 * the counted ones (the body pieces, the shield, one weapon a set), each once, the weapon in hand never twice - while
 * the sets are awake (never in a duel). A rise is said ONCE FOR A SET, when its own rank rises ("Your Dagon's Brand
 * brightens: Kindled."); the weapon in hand's own line is said unless its set has just said one. `nameOf(item)` names
 * the weapon as its tooltip does. Answers the lines, in order, and `rose`: some set's own rank rose, so the numbers of
 * its tiers may have moved (the host recomputes the fold).
 * @returns {{ lines: string[], rose: boolean }}
 */
export function drinkWorn(entity, held, xp, nameOf = (it) => String(it?.name ?? 'weapon')) {
  const worn = setsAwake() ? wornSetPieces(entity) : new Map();
  const was = new Map([...worn].map(([id, pieces]) => [id, lowestRank(pieces)]));
  // AUDIT SET D8: a set's weapon sleeps with its set in a duel (section 2: "no piece drinks"); a plain sigil weapon
  // drinks as SIGIL1 says
  const rank = setIdOf(held) && _dueling ? null : drinkSigil(held, xp);
  for (const pieces of worn.values()) for (const p of pieces) if (p !== held) drinkSigil(p, xp);
  const risen = [];
  for (const [id, pieces] of worn) { const now = lowestRank(pieces); if (now > was.get(id)) risen.push([id, now]); }
  const lines = [];
  const heldSet = setIdOf(held);
  if (rank != null && !risen.some(([id]) => id === heldSet)) lines.push(sigilRiseLine(nameOf(held), rank));
  for (const [id, now] of risen) lines.push(setRiseLine(id, now));
  return { lines: lines.filter(Boolean), rose: risen.length > 0 };
}

// ═══ SET5: WHAT THE PAGE SHOWS OF A SET ════════════════════════════
//
// The card's set block, the paperdoll's strip and the words a classic tooltip prints all read ONE view of a set for a
// wearer (setCardView): what it is, how many of its nine places are filled and which, the stage it stands at and
// what holds it there, why it sleeps, and its three tiers with their numbers at that stage.

let _wearer = () => null;
/** The host's word (scenes/world.js): whose worn sets a reader with no wearer of its own reads - the classic tooltip,
 *  a plaque - the player's entity. */
export function setSetsWearer(fn) { _wearer = typeof fn === 'function' ? fn : () => null; }
export const setsWearer = () => { try { return _wearer() ?? null; } catch { return null; } };

/** Which of the nine places (SET_PLACES' order) a set's pieces fill on an entity - the weapon's place filled by one in
 *  either hand. */
export function setPlacesWorn(entity, id) {
  const out = new Array(SET_PLACES.length).fill(false);
  const slots = entity?.equip ? equipTableOf(entity) : null;
  if (!slots || !id) return out;
  SET_BODY_SLOTS.forEach((slot, i) => { const it = slots[slot]; if (it && setPieceKind(it) === 'armor' && setIdOf(it) === id) out[i] = true; });
  const left = slots[EQUIP_SLOTS.LeftHand], right = slots[EQUIP_SLOTS.RightHand];
  if (left && setPieceKind(left) === 'shield' && setIdOf(left) === id) out[SET_BODY_SLOTS.length] = true;
  if ([right, left].some((h) => h && setPieceKind(h) === 'weapon' && setIdOf(h) === id)) out[SET_BODY_SLOTS.length + 1] = true;
  return out;
}
/** Why every set sleeps now, or null while they wake: 'offline', 'renown' (online, my Renown not yet known), 'duel'. */
export const setsSleep = () => (!sigilOnline() ? 'offline' : sigilRenown() == null ? 'renown' : _dueling ? 'duel' : null);

/**
 * THE VIEW OF A SET PIECE'S SET for a wearer (the player by default): the set (`name`, `prince`, `role`, `colour`,
 * `aetheric`), `count` of the nine places filled (`of`) and which (`places`), whether this piece is one of them
 * (`worn`), the `stage` the set stands at (-1 asleep or none worn) and its name, `heldPiece` (the worn piece holding the
 * stage back) and `renownNext` (the Renown that opens the next stage, when the Renown holds it), `sleep` (why every set
 * sleeps, or null), and the three `tiers` - each `{ at, key, name, awake, text, full }`, the numbers at the set's stage
 * (Faint's while none can wake). Null for an item that is no set piece.
 */
export function setCardView(item, wearer = setsWearer()) {
  const id = setIdOf(item);
  const set = setById(id);
  if (!set) return null;
  const pieces = wornSetPieces(wearer).get(id) ?? [];
  const sleep = setsSleep();
  const st = setState(id, pieces, sigilRenown(), sleep == null);
  return {
    id, name: set.name, prince: set.prince, role: set.role, colour: set.colour, aetheric: set.aetheric,
    count: st.count, of: SET_PLACES.length, places: setPlacesWorn(wearer, id), worn: pieces.includes(item),
    stage: st.stage, stageName: st.stage < 0 ? null : st.stageName, heldPiece: st.heldPiece, renownNext: st.renownNext,
    sleep, tiers: st.tiers,
  };
}
const SLEEP_WORDS = Object.freeze({ offline: 'sets wake online', renown: 'sets wake with your Renown', duel: 'sets sleep in a duel' });
/** Why the sets sleep, in the page's words, or null. */
export const setSleepText = (sleep) => SLEEP_WORDS[sleep] ?? null;
/** AUDIT SET U11: a set piece's sigil in words - a set's ARMOUR asleep in a duel, as its set's own lines say (the
 *  sigil's alone read only the Renown, and called a sleeping set's piece "Sigil (Kindled)"). A set's weapon keeps its
 *  own lines: its blow is SIGIL1's, foes only, and lands on a foe in a duel as any sigil weapon's does. */
export function setSigilLines(item) {
  const lines = sigilLines(item);
  return lines.length && _dueling && setIdOf(item) && !sigilHasBlow(item.sigil) ? ['Sigil (asleep in a duel)'] : lines;
}
/** The set in words, for a tooltip that prints lines (the classic skin's, a plaque's): its name and what is worn, then a
 *  line a tier - which are awake, and what each wants. Plain ASCII, as the classic font draws. [] for no set piece. */
export function setLines(item, wearer = setsWearer()) {
  const v = setCardView(item, wearer);
  if (!v) return [];
  const why = setSleepText(v.sleep);
  const head = `${v.name}: ${v.count} of ${v.of} worn${v.stageName ? `, ${v.stageName}` : ''}${why ? ` (${why})` : ''}`;
  return [head, ...v.tiers.map((t) => `${t.at} pieces - ${t.name}: ${t.text}${t.awake ? '' : v.count < t.at ? ` (${t.at - v.count} more)` : ' (asleep)'}`)];
}

/** Tests only: forget the duel and the wearer. */
export function _resetSigilSetsForTests() { _dueling = false; _wearer = () => null; }
