// @ts-check
// CARDS4b (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 18; Mac: "Do 3 4 and 5"): THE REGULARS AT THE
// TABLE - pure, DOM-free. CARDS4 seated the tavern's regulars as names on the panel; here they sit in their chairs,
// drawn as an online peer is drawn (world/familyBodies.js's layers - a Morrowind body where this client stands those,
// posed seated through the pose's own `st`, as a seated peer is; else a class sprite or a paperdoll standing at the
// chair, the sprite lane's own CARDS2c), and say their play over their heads.
//
// A REGULAR'S LOOK is minted from the seed that names him (the town, the building, the chair's order - CARDS4's
// tavernRegulars): his region's people (the name bank's race), a face, and a tavern-goer's clothes from Daggerfall's own
// templates - a shirt or a tunic, trousers or a skirt (or a gown), shoes or boots - in the look's shape the peer layers
// read (net/remotePlayers.js peerStubEntity). The same regular wears the same clothes every evening.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { BANK_TYPES } from '../characters/nameHelper.js';
import { EQUIP_SLOTS } from '../characters/paperdoll.js';
import { seatTopByte } from '../player/seatPose.js';

/** The races a name bank stands for (the Imperial bank's people are drawn as Bretons - the bay's own). */
const RACE_OF_BANK = Object.freeze({
  [BANK_TYPES.Breton]: 'Breton', [BANK_TYPES.Redguard]: 'Redguard', [BANK_TYPES.Nord]: 'Nord', [BANK_TYPES.DarkElf]: 'DarkElf',
  [BANK_TYPES.HighElf]: 'HighElf', [BANK_TYPES.WoodElf]: 'WoodElf', [BANK_TYPES.Khajiit]: 'Khajiit', [BANK_TYPES.Imperial]: 'Breton',
});
/** A tavern-goer's clothes by Daggerfall's templates (characters/paperdoll.js ITEM_TEMPLATES): chests, legs, feet - and
 *  a woman's gown or dress, worn in place of the shirt and skirt. */
export const REGULAR_CLOTHES = Object.freeze({
  male: Object.freeze({ chest: [165, 167, 158, 173, 180], legs: [151, 152], feet: [147, 149] }),
  female: Object.freeze({ chest: [184, 202, 204], legs: [190, 212], feet: [186, 188], gown: [196, 197] }),
});
/** The faces a look may name (the peer layers' bound). */
export const REGULAR_FACES = 10;

/** A small seeded stream (mulberry32): a look's choices, in order. */
function stream(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

/**
 * A regular's look: `{race, gender, faceIndex, items}` - the region's people, a face, the clothes - from `seed` (the one
 * that named him), his name bank and his gender (0 male, 1 female, as residentName's).
 * @param {number} seed @param {number} bank @param {number} gender
 */
export function regularLook(seed, bank, gender) {
  const r = stream(seed ^ 0x6c6f6f6b);
  const female = gender === 1;
  const kit = female ? REGULAR_CLOTHES.female : REGULAR_CLOTHES.male;
  const group = female ? 'WomensClothing' : 'MensClothing';
  const items = [];
  const put = (templateIndex, equipSlot) => items.push({ templateIndex, group, equipSlot, variant: Math.floor(r() * 2) });
  if (female && r() < 0.35) put(pick(r, REGULAR_CLOTHES.female.gown), EQUIP_SLOTS.ChestClothes);
  else { put(pick(r, kit.chest), EQUIP_SLOTS.ChestClothes); put(pick(r, kit.legs), EQUIP_SLOTS.LegsClothes); }
  put(pick(r, kit.feet), EQUIP_SLOTS.Feet);
  return { race: RACE_OF_BANK[bank] ?? 'Breton', gender: female ? 'female' : 'male', faceIndex: Math.floor(r() * REGULAR_FACES), items };
}

/**
 * The regulars to stand this frame: one per patron still at the table, in the chair the cloth gives him - `{key, res:
 * {id, name, look}, feet, yaw, st}` (`st` the pose's seated byte, net/wire.js seatOf's - the peer layers pose a body
 * seated by it). `session` the evening (systems/cardTableSession.js), `seats` the table's chairs (world/cardTables.js),
 * `seatOf[i]` the chair of the session's seat i, `regulars` the CARDS4 regulars by name: `{name -> {seed, bank, gender}}`,
 * `key` the table's.
 * @param {{session: any, seats: any[], seatOf: number[], regulars: Map<string, {seed: number, bank: number, gender: number}>, key: string}} p
 */
export function regularsToStand({ session, seats, seatOf, regulars, key }) {
  const out = [];
  if (!session) return out;
  session.seats.forEach((s, i) => {
    if (s.kind !== 'patron' || s.gone) return;
    const chair = seats[seatOf[i]];
    const who = regulars.get(s.name);
    if (!chair || !who) return;
    out.push({ key: `card:${key}:${i}`, res: { id: `card:${key}:${i}`, name: s.name, look: regularLook(who.seed, who.bank, who.gender) }, feet: chair.feet, yaw: chair.yaw, st: seatTopByte(chair.top) });
  });
  return out;
}

/** MEASURE (CARDS4b): how long a regular's line stands over his head, and how high that is over his feet, seated. */
export const BARK_MS = 2600;
export const REGULAR_HEAD_M = 1.35;

/**
 * What a regular says for his play - a line for an action, a win, a leave - or null (nothing worth a word). `roll` a
 * uniform in [0, 1) picks among the ways he may say it.
 * @param {any} e - a session event @param {number} roll
 */
export function regularBark(e, roll = 0) {
  const one = (list) => list[Math.min(list.length - 1, Math.floor(roll * list.length))];
  if (e.t === 'act') {
    if (e.allIn) return one(['All of it.', 'Everything I have.', 'I\'m all in.']);
    if (e.type === 'raise') return e.bet ? one([`${e.to}.`, `Bet ${e.to}.`]) : one([`Raise. ${e.to}.`, `Make it ${e.to}.`]);
    if (e.type === 'call') return one(['I\'ll see that.', 'Call.', 'I\'m in.']);
    if (e.type === 'check') return one(['Check.', 'I\'ll knock.']);
    if (e.type === 'fold') return one(['Not this one.', 'I\'m out.', 'Fold.']);
  }
  if (e.t === 'won') return one(['Mine, I think.', 'Ha! Pay up.', 'Lady luck.']);
  if (e.t === 'leave') return one(['That\'s me cleaned out.', 'Gods. I\'m done for the night.']);
  return null;
}
