// NPC2b: WHICH MORROWIND CREATURE STANDS IN FOR WHICH DAGGERFALL
// BEAST - and, just as importantly, which ones nothing does.
//
// Mac's call: humanoids AND the beasts Morrowind genuinely has. The
// operative word is genuinely. Morrowind ships no bat, no spider, no
// scorpion, no centaur, no gargoyle and no dragon, and dressing a
// Daggerfall giant bat in a cliff racer would be the kind of "close
// enough" this port refuses everywhere else. Those keep their classic
// sprite and the card says why.
//
// ── HOW A ROW RESOLVES ───────────────────────────────────────────
//
// The same shape mwItemMap uses for items: a row names CANDIDATE ID
// TOKENS in preference order and the resolver takes the first that
// the player's OWN archives carry. Nothing here assumes a creature
// exists - three of the best matches (bear, wolf, spriggan) ship with
// BLOODMOON, so a player with only Morrowind.esm resolves fewer rows
// and is told so rather than shown a hole.
//
// Tokens are matched as SUBSTRINGS of the CREA record id, lowercased,
// because Bethesda's ids carry prefixes this port has no business
// hardcoding (an "ex_" or a mod's own). First token to match any
// record wins; among records matching one token, the ID SORT decides,
// so the archive's listing order can never choose the monster (AUDIT
// 29 F3's law, which the weapon pick learned the hard way).
import { MOBILE_TYPES } from './mobileTypes.js';

/**
 * DF mobile type -> the Morrowind creatures that may stand in for it.
 *
 * Each row is `{ tokens, why }`: the ids to try in order, and the
 * sentence the card prints when a row resolves to something that is
 * not an exact species match, so a substitution is never silent.
 */
export const MW_CREATURE_FOR = Object.freeze({
  // ── EXACT, or as near as two games get ──
  [MOBILE_TYPES.Rat]: { tokens: ['rat'], why: null },
  [MOBILE_TYPES.Slaughterfish]: { tokens: ['slaughterfish'], why: null },
  [MOBILE_TYPES.SkeletalWarrior]: { tokens: ['skeleton'], why: null },
  [MOBILE_TYPES.Ghost]: { tokens: ['ancestor_ghost', 'ghost'], why: null },
  [MOBILE_TYPES.Daedroth]: { tokens: ['daedroth'], why: null },
  [MOBILE_TYPES.Dreugh]: { tokens: ['dreugh'], why: null },
  [MOBILE_TYPES.Spriggan]: { tokens: ['spriggan'], why: 'Bloodmoon' },
  [MOBILE_TYPES.GrizzlyBear]: { tokens: ['bear'], why: 'Bloodmoon' },
  [MOBILE_TYPES.Werewolf]: { tokens: ['werewolf', 'wolf'], why: 'Bloodmoon' },
  [MOBILE_TYPES.FireAtronach]: { tokens: ['atronach_flame', 'flame_atronach'], why: null },
  [MOBILE_TYPES.IceAtronach]: { tokens: ['atronach_frost', 'frost_atronach'], why: null },
  // ── DECLARED SUBSTITUTIONS: close, and said out loud ──
  [MOBILE_TYPES.Zombie]: { tokens: ['bonewalker', 'zombie'], why: 'a Morrowind bonewalker stands in for the zombie' },
  [MOBILE_TYPES.Mummy]: { tokens: ['draugr', 'bonewalker'], why: 'a draugr stands in for the mummy' },
  [MOBILE_TYPES.FrostDaedra]: { tokens: ['atronach_frost', 'frost_atronach'], why: 'a frost atronach stands in for the frost daedra' },
  [MOBILE_TYPES.FireDaedra]: { tokens: ['dremora', 'atronach_flame'], why: 'a dremora stands in for the fire daedra' },
  [MOBILE_TYPES.DaedraLord]: { tokens: ['dremora'], why: 'a dremora stands in for the daedra lord' },
  [MOBILE_TYPES.DaedraSeducer]: { tokens: ['winged_twilight'], why: 'a winged twilight stands in for the daedra seducer' },
  [MOBILE_TYPES.Harpy]: { tokens: ['winged_twilight'], why: 'a winged twilight stands in for the harpy' },
  [MOBILE_TYPES.Wraith]: { tokens: ['ancestor_ghost', 'ghost'], why: 'an ancestor ghost stands in for the wraith' },
  [MOBILE_TYPES.Imp]: { tokens: ['scamp'], why: 'a scamp stands in for the imp' },
  [MOBILE_TYPES.Lich]: { tokens: ['bonelord'], why: 'a bonelord stands in for the lich' },
  [MOBILE_TYPES.AncientLich]: { tokens: ['bonelord'], why: 'a bonelord stands in for the ancient lich' },
  [MOBILE_TYPES.Giant]: { tokens: ['ogrim'], why: 'an ogrim stands in for the giant' },
});

/**
 * The beasts Morrowind has NO analog for, with the reason - so the
 * card can say "nothing in your data" rather than leaving a hole, and
 * so nobody proposes a cliff racer for a giant bat again.
 */
export const NO_MW_CREATURE = Object.freeze({
  [MOBILE_TYPES.GiantBat]: 'Morrowind ships no bat',
  [MOBILE_TYPES.SabertoothTiger]: 'Morrowind ships no big cat',
  [MOBILE_TYPES.Spider]: 'Morrowind ships no spider',
  [MOBILE_TYPES.GiantScorpion]: 'Morrowind ships no scorpion',
  [MOBILE_TYPES.Centaur]: 'Morrowind ships no centaur',
  [MOBILE_TYPES.Nymph]: 'Morrowind ships no nymph',
  [MOBILE_TYPES.Wereboar]: 'Morrowind ships no wereboar',
  [MOBILE_TYPES.Gargoyle]: 'Morrowind ships no gargoyle',
  [MOBILE_TYPES.Dragonling]: 'Morrowind ships no dragon',
  [MOBILE_TYPES.Dragonling_Alternate]: 'Morrowind ships no dragon',
  [MOBILE_TYPES.Lamia]: 'Morrowind ships no lamia',
  [MOBILE_TYPES.IronAtronach]: 'Morrowind ships no iron atronach',
  [MOBILE_TYPES.FleshAtronach]: 'Morrowind ships no flesh atronach',
  [MOBILE_TYPES.Vampire]: 'a Morrowind vampire is a body with vampire head parts, not a creature',
  [MOBILE_TYPES.VampireAncient]: 'a Morrowind vampire is a body with vampire head parts, not a creature',
});

/**
 * Resolve one Daggerfall beast against the creature records the
 * player's data actually carries.
 *
 * @returns {{record:object, why:string|null} | {record:null, reason:string}}
 */
export function pickMwCreature(mobileType, creatures) {
  const row = MW_CREATURE_FOR[mobileType];
  if (!row) {
    return { record: null, reason: NO_MW_CREATURE[mobileType] ?? 'no Morrowind creature is mapped to this enemy' };
  }
  const pool = (creatures ?? []).filter((c) => c && c.id && c.model);
  for (const token of row.tokens) {
    // AUDIT 29 F3's law: among the records a token matches, the ID
    // SORT decides - never the archive's listing order.
    const hits = pool.filter((c) => c.id.includes(token)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (hits.length) return { record: hits[0], why: row.why };
  }
  return {
    record: null,
    reason: row.why === 'Bloodmoon'
      ? 'your data carries no such creature - it ships with Bloodmoon'
      : `your data carries no creature matching ${row.tokens.map((t) => `"${t}"`).join(' or ')}`,
  };
}

/** Every enemy this map has an opinion about, for the coverage pin. */
export const MAPPED_BEASTS = Object.freeze(Object.keys(MW_CREATURE_FOR).map(Number));
