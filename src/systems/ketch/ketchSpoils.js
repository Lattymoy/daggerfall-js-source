// @ts-check
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 9): THE KETCHMASTER'S HOLD - what one member's share of the
// Tonal Warden's fall pays, rolled from the relay's receipt (net/ketch/ketchReceipt.js `y1`): the Brass Remnant's spoils'
// twin (systems/superDungeon/sdSpoils.js) rung for rung, and THE ONE PLACE A GUN IS FOUND.
//
// PER MEMBER, AND THE SEED'S OWN: everything here is rolled on `seededRng(c)` (systems/wind/wind.js) - the receipt's seed,
// 32 bits of the relay's CSPRNG - so each member's share is their own, and a member who dealt and one who stood are paid
// alike. The roll reads the player's world as well as the seed (its level, its registered pieces), so what was rolled is
// what is kept - the spoils pool records the pieces themselves (scenes/spoilsPool.js).
//
// THE ROLL (the owner: "A chance to drop both guns with a gilded version of each gun", and "ensure any gun drop is rare,
// only found within this activity"):
//   - gold, KT_SPOILS_GOLD_PER_LEVEL a level, the seed varying it a fifth either way;
//   - ONE piece Legendary KT_SPOILS_LEGENDARY of the time, else Rare; ONE more Rare or better by the source's chances (a
//     boss past the ladder's top tier - KT_SPOILS_SOURCE); each known, the ladder's last pass after them;
//   - DWEMER PELLETS, KT_SPOILS_PELLETS - the Ketch's own foundry's, always: the one door that pays the shot by the score
//     (PELLETS-SCARCE: no shelf sells it, and the loot door finds it rarely - systems/thunderlock.js);
//   - THE DWARVEN THUNDERLOCK, KT_THUNDERLOCK_CHANCE; THE DWARVEN PISTOLET, KT_PISTOLET_CHANCE - each its own draw (GUNS-
//     UNFOUND: no other door in the game mints either);
//   - the sockets' passes and the technique's over the two pieces (never a gun's - a fixed find takes none);
//   - and LAST OF ALL the Ketch's two Gilded guns (systems/gilded.js rollKetchGilded - Volendrung's Echo and the
//     Ketchmaster's Word, KETCH_GILDED_CHANCE each), so no roll before them ever moves.
//
// Not a DFU member. Ledger A (KETCH).
import { seededRng } from '../wind/wind.js';
import { spoilsBase } from '../gate/gateSpoils.js';
import { applyRarity, lastPass, socketPass, weaponSocketPass, techniquePass } from '../loot/lootRarity.js';
import { rareOrBetter } from '../superDungeon/sdSpoils.js';
import { createThunderlock, createPellets } from '../thunderlock.js';
import { createPistolet } from '../pistolet.js';
import { rollKetchGilded } from '../gilded.js';
import { RANDOM_TREASURE_ICONS } from '../loot/loot.js';
import { t } from '../textManager.js';

/** Gold a level of the member's, before the seed's variation. */
export const KT_SPOILS_GOLD_PER_LEVEL = 450;
/** The first piece is Legendary this share of the time, else Rare. */
export const KT_SPOILS_LEGENDARY = 0.25;
/** The source the second piece is laddered at: a boss past the ladder's top, a lucky hand. */
export const KT_SPOILS_SOURCE = Object.freeze({ boss: true, tier: 22, luck: 65 });
/** The Pellets the Ketch's foundry pays, always: from `min` to `max`, one draw. */
export const KT_SPOILS_PELLETS = Object.freeze({ min: 20, max: 40 });
/** KETCH-PELLETS (2026-10-25, the owner: "We need more aquireable sources of deeamer pellets"): WHAT HER CONSTRUCTS DROP -
 *  each construct downed lays Pellets on her deck where it fell, for every hand aboard (each screen its own pile, as the
 *  share is), `{ min, max, p }` a kind: `p` the chance it drops any. The spiders pour from the vents while the engine
 *  starves, so theirs is a chance of one; the Wardens' and the Captain's a fistful. And a voyage's construct Pellets are
 *  capped (KT_CONSTRUCT_PELLETS_MAX) so no hand farms the vents. */
export const KT_CONSTRUCT_PELLETS = Object.freeze({
  sphere: Object.freeze({ min: 2, max: 4, p: 1 }),
  sentry: Object.freeze({ min: 3, max: 5, p: 1 }),
  spider: Object.freeze({ min: 1, max: 1, p: 0.35 }),
  warden: Object.freeze({ min: 8, max: 12, p: 1 }),
  captain: Object.freeze({ min: 10, max: 15, p: 1 }),
  tonal: Object.freeze({ min: 15, max: 25, p: 1 }),
});
export const KT_CONSTRUCT_PELLETS_MAX = 90;
/** KETCH-PELLETS: how many Pellets construct `kind` drops on one roll source (0 for none, or an unknown kind). Pure. */
export function ketchConstructPellets(kind, rolls = Math.random) {
  const D = KT_CONSTRUCT_PELLETS[kind];
  if (!D || !(rolls() < D.p)) return 0;
  return D.min + Math.floor(rolls() * (D.max - D.min + 1));
}
/** THE GUNS: each its own draw (rare - a share a voyage at most, every ten hours: net/ketch/ketchLaw.js's voyage). */
export const KT_THUNDERLOCK_CHANCE = 1 / 10;
export const KT_PISTOLET_CHANCE = 1 / 8;
/** The device's record of spoils no save holds yet, and the receipts spent - the spoils pool's two keys, the Ketch's own. */
export const KT_SPOILS_KEYS = Object.freeze({ store: 'kt.spoils', day: 'kt.spoilsDay' });
export const KT_SPOILS_RECORDS_MAX = 8;
/** The words - the chest opened (its share thrown into the pool, scenes/spoilsPool.js spew; the pool says its own when
 *  they are gathered) and the share put straight into the pack (off the ship, or no floor to throw onto) - each read
 *  through the text core when it is said (L10N4). */
export const KT_SPOILS_TEXT = Object.freeze({
  get spilled() { return t('ketch.spoils.spilled', 'The Ketchmaster\'s hold opens. Your share spills across the cabin floor.'); },
  get granted() { return t('ketch.spoils.granted', 'Your share of the Ketchmaster\'s hold is in your pack.'); },
  get gathered() { return t('ketch.spoils.gathered', 'What was left of your share on the cabin floor is in your pack.'); },
});
/** The word the pool says when leaving gathers the cabin's floor - its own words' sentinel, said by the Ketch's say in
 *  the player's language when it is said (KT_SPOILS_TEXT.gathered; the pool keeps one string from its making). */
export const KT_SPOILS_GATHERED = '\u0000ketch.spoils.gathered';
/** A receipt as the pool keys it spent: its voyage and its ship. */
export const ketchSpoilsDay = (d, o) => `kt:${d}.${o}`;
/** The voyage and ship a spent key names, or null. Pure. */
export function ketchSpoilsOf(day) {
  const m = typeof day === 'string' ? /^kt:(\d{1,10})\.([0-9a-f]{16})$/.exec(day) : null;
  return m ? { d: Number(m[1]), o: m[2] } : null;
}

function graded(item, tier, rolls) {
  applyRarity(item, tier, rolls);
  item.isIdentified = true;
  return { item, tier: item.rarity ?? tier };
}

/**
 * THE SHARE for one member: `{ gold, pieces: [{ item, tier }], pellets, guns: [item], gilded: [item] }` - the same seed,
 * level and world answer the same share.
 * @param {number} seed the receipt's `c` @param {number} level the level it fought at
 */
export function rollKetchSpoils(seed, level) {
  const rolls = seededRng(seed >>> 0);
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const gold = Math.round(KT_SPOILS_GOLD_PER_LEVEL * lv * (0.8 + 0.4 * rolls()));
  const pieces = [];
  pieces.push(graded(spoilsBase(lv, rolls), rolls() < KT_SPOILS_LEGENDARY ? 'legendary' : 'rare', rolls));
  pieces.push(graded(spoilsBase(lv, rolls), rareOrBetter(rolls, KT_SPOILS_SOURCE), rolls));
  lastPass(pieces.map((p) => p.item), rolls);
  const P = KT_SPOILS_PELLETS;
  const pellets = P.min + Math.min(P.max - P.min, Math.floor(rolls() * (P.max - P.min + 1)));
  const guns = [];
  if (rolls() < KT_THUNDERLOCK_CHANCE) guns.push(createThunderlock());
  if (rolls() < KT_PISTOLET_CHANCE) guns.push(createPistolet());
  socketPass(pieces.map((p) => p.item), rolls);
  weaponSocketPass(pieces.map((p) => p.item), rolls);
  techniquePass(pieces.map((p) => p.item), rolls);
  const gilded = rollKetchGilded(rolls);   // LAST OF ALL
  return { gold, pieces, pellets, guns, gilded };
}

/** The share as the pool throws it (scenes/spoilsPool.js's pieces): the pieces, the guns, the Gilded, the Pellets, then the
 *  gold - each dressed in the treasure flat the seed chooses. Pure. */
export function ketchSpoilsList(seed, level) {
  const look = seededRng(((seed >>> 0) ^ 0x6b74) >>> 0);
  const flat = () => RANDOM_TREASURE_ICONS[Math.floor(look() * RANDOM_TREASURE_ICONS.length)];
  const s = rollKetchSpoils(seed, level);
  return [
    ...s.pieces.map((p) => ({ kind: 'item', item: p.item, tier: p.tier, record: flat() })),
    ...s.guns.map((g) => ({ kind: 'item', item: g, tier: 'common', record: flat() })),
    ...s.gilded.map((g) => ({ kind: 'item', item: g, tier: g.rarity ?? 'gilded', record: flat() })),
    { kind: 'item', item: createPellets(s.pellets), tier: 'common', record: flat() },
    { kind: 'gold', gold: s.gold, tier: 'common', record: flat() },
  ];
}
