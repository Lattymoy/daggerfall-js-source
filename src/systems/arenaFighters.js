// @ts-check
// ARENA2 (2026-10-02, Mac: "Fighters from all around dagger come with the hopes of claiming the ultimate prize"): WHO
// FIGHTS - each AI fighter's name, home and epithet, drawn from the bout's seed, and how they stand on the sand. Design:
// bible/11-Multiplayer/Arena.md "2. The fights" ("Names from Daggerfall's own name generator by race; an epithet and a
// home town from the bout's seed - Gorlak gro-Mazgul of Wayrest, the Unbroken").
//
// THE NAME is DFU's NameHelper.FullName (characters/nameHelper.js) over the bank of the fighter's home (a Breton of High
// Rock, a Redguard of Hammerfell, a Nord of Skyrim...; an orc of Orsinium draws DFU's monster bank, as its quests name
// orcs), on Daggerfall's own DFRandom stream SEEDED BY THE BOUT and put back as it stood (the crew's own law,
// systems/naval/shipCrew.js handName) - one bout, one set of names, on every screen and at every load. A beast is billed
// by its kind and its wild ("The Grizzly Bear of the Wrothgarian Mountains").
//
// THE TEMPER: how readily an AI yields at the line (systems/arenaBout.js aiYields) - a class fighter's from the seed, a
// beast's none (it fights to the floor), a daedra's and an undead's none.
//
// Pure. Not a DFU member. Ledger A (ARENA).

import { srand, getSeed, setSeed } from '../formats/dfRandom.js';
import { fullName, monsterName, GENDERS, BANK_TYPES } from '../characters/nameHelper.js';
import { enemyDisplayName } from '../characters/enemyBasics.js';
import { MOBILE_TYPES as M } from '../characters/mobileTypes.js';
import { ARENA_TEXT } from './arenaText.js';
import { ARENA_HOMES, BEAST_HOMES, arenaHash, seededRng } from './arenaLadder.js';

/** The monsters that fight as beasts - billed by kind, no yield in them. */
export const ARENA_BEASTS = Object.freeze(new Set([M.GrizzlyBear, M.SabertoothTiger, M.GiantScorpion, M.Spriggan, M.IronAtronach]));
/** The monsters that fight on with no temper to yield (daedra, undead, atronachs) - and every beast. */
const NO_YIELD = new Set([...ARENA_BEASTS, M.DaedraSeducer, M.Vampire]);

/** A name drawn on DFU's stream seeded `seed`, the stream put back as it stood. */
function drawName(seed, bank, gender) {
  const saved = getSeed();
  try {
    srand((seed >>> 0) || 1);
    if (bank === BANK_TYPES.Monster1) return monsterName(gender, () => 0, BANK_TYPES.Monster1);
    return fullName(bank, gender);
  } finally { setSeed(saved); }
}

/**
 * A FIGHTER'S IDENTITY for fighter `i` of the bout seeded `seed`, a `mobile` (a MobileTypes id): `{ name, home,
 * epithet, billing, gender, temper, beast }`. A class fighter's gender is the seed's; a monster's the male texture's.
 */
export function fighterIdentity(seed, i, mobile) {
  const s = arenaHash(seed, 0x100 + i);
  const rng = seededRng(s);
  const epithet = ARENA_TEXT.epithets[Math.floor(rng() * ARENA_TEXT.epithets.length)];
  if (ARENA_BEASTS.has(mobile)) {
    const kind = enemyDisplayName(mobile) ?? 'Beast';
    const from = BEAST_HOMES[Math.floor(rng() * BEAST_HOMES.length)];
    return { name: `The ${kind}`, home: from, epithet: '', billing: ARENA_TEXT.beast(kind, from), gender: 'male', temper: 0, beast: true };
  }
  const isClass = mobile >= 128;
  const female = isClass && rng() < 0.4;
  const gender = female ? GENDERS.Female : GENDERS.Male;
  let home;
  if (mobile === M.OrcWarlord) home = ARENA_HOMES.find((h) => h.town === 'Orsinium');
  else if (mobile === M.DaedraSeducer) home = { town: 'Oblivion', bank: BANK_TYPES.Monster1 };
  else home = ARENA_HOMES.filter((h) => h.town !== 'Orsinium')[Math.floor(rng() * (ARENA_HOMES.length - 1))];
  const bank = home.bank === 8 ? BANK_TYPES.Monster1 : home.bank;
  const name = drawName(s ^ 0x5a5a5a5a, bank, mobile === M.DaedraSeducer ? GENDERS.Female : gender) || enemyDisplayName(mobile) || 'Fighter';
  const temper = NO_YIELD.has(mobile) ? 0 : 0.2 + rng() * 0.7;
  return { name, home: home.town, epithet, billing: `${name} of ${home.town}, ${epithet}`, gender: female || mobile === M.DaedraSeducer ? 'female' : 'male', temper, beast: false };
}

/** Where fighters stand at the call and walk to: `n` marks on the floor's long axis (x), sides apart, in the ring's
 *  frame ([x, z] from its centre) - side 0 west, side 1 east, a Grand Melee's sides round the ring. */
export const MARK_APART_M = 6;
export function boutMarks(sides, perSide) {
  /** @type {number[][][]} */
  const out = [];
  for (let s = 0; s < sides; s++) {
    const marks = [];
    for (let k = 0; k < perSide[s]; k++) {
      if (sides === 2) {
        const x = (s === 0 ? -1 : 1) * MARK_APART_M;
        marks.push([x, (k - (perSide[s] - 1) / 2) * 2.5]);
      } else {
        const a = (s / sides) * Math.PI * 2 + Math.PI;
        marks.push([Math.cos(a) * MARK_APART_M + k * 1.5, Math.sin(a) * MARK_APART_M]);
      }
    }
    out.push(marks);
  }
  return out;
}
/** Where they come from before the walk: the floor's two ends (the gates under the tiers), each mark's side. */
export const GATE_OUT_M = 15;
export const boutGateOf = (mark) => [Math.sign(mark[0] || 1) * GATE_OUT_M, mark[1]];
