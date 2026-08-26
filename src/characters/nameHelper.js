// Townsfolk name banks (Characters C2).
// 1:1 translation of Daggerfall Unity's NameHelper.cs + the
// MapsFile.GetNameBankOfRegion switch (MIT, Daggerfall Workshop).
// Bank data is DFU's Assets/Resources/NameGen.txt committed verbatim as
// nameGen.json with its two lenient-JSON constructs normalized (one
// missing comma between Monster3 set objects, one trailing comma -
// DFU's FullSerializer parser treats both as optional, so the
// normalized file is byte-for-byte the dataset DFU actually loads).
// Verbatim rules on DFRandom.rand():
//   - FirstName: sets 0+1 (male) / 2+3 (female), two draws, concat.
//   - Surname:   sets 4+5, two draws, concat.
//   - Nord surname: sets 0+1 + the immutable "sen" suffix.
//   - Redguard single name: 0+1+2 then set 3 (male, only when
//     rand()%100 < 75) or set 4 (female, always). The C# short-circuit
//     is load-bearing for RNG-stream parity: the FEMALE path never
//     draws the 75% roll.
//   - FullName: first + " " + surname when the surname is non-empty
//     (only REDGUARD names carry no surname - Surname(Nord) has no
//     gender arm and always mints the 0+1+'sen' form; AUDIT 23).
//   - MonsterName (S17): the BANK pick (Monster1 or Monster2 "for
//     now") rides UnityEngine.Random in DFU - a uniform roll here
//     (the Ledger A engine-PRNG rule); every PART draw stays on
//     DFRandom.rand(), verbatim order.

import { rand } from '../formats/dfRandom.js';
import { REGION_RACES } from '../formats/mapsFile.js';
import nameGen from './nameGen.json' with { type: 'json' };

export const BANK_TYPES = Object.freeze({
  Breton: 0, Redguard: 1, Nord: 2, DarkElf: 3, HighElf: 4,
  WoodElf: 5, Khajiit: 6, Imperial: 7, Monster1: 8, Monster2: 9, Monster3: 10,
});
export const GENDERS = Object.freeze({ Male: 0, Female: 1 });

const BANK_NAMES = ['Breton', 'Redguard', 'Nord', 'DarkElf', 'HighElf',
  'WoodElf', 'Khajiit', 'Imperial', 'Monster1', 'Monster2', 'Monster3'];

const bankOf = (type) => nameGen[BANK_NAMES[type]];
const draw = (parts) => parts[rand() % parts.length];

/** MacroHelper.GetNameBank (MacroHelper.cs:344-366) - the PLAYER
 *  race's bank. Note the quirk DFU's own enum comments: ARGONIAN maps
 *  to the IMPERIAL bank, "Imperial names appear where one would
 *  expect Argonian names" (NameHelper.cs:50). Anything unknown falls
 *  to Breton, which is C#'s `default` arm sharing the Breton case. */
const BANK_BY_RACE = Object.freeze({
  Breton: BANK_TYPES.Breton, Redguard: BANK_TYPES.Redguard, Nord: BANK_TYPES.Nord,
  DarkElf: BANK_TYPES.DarkElf, HighElf: BANK_TYPES.HighElf, WoodElf: BANK_TYPES.WoodElf,
  Khajiit: BANK_TYPES.Khajiit, Argonian: BANK_TYPES.Imperial,
});
export const getNameBank = (raceKey) => BANK_BY_RACE[raceKey] ?? BANK_TYPES.Breton;

/** Verbatim MapsFile.GetNameBankOfRegion. */
export function getNameBankOfRegion(regionIndex) {
  if (regionIndex > -1) return REGION_RACES[regionIndex];
  return BANK_TYPES.Breton;
}

/** PlayerGPS.GetNameBankOfCurrentRegion (PlayerGPS.cs:421-427) and
 *  GetRaceOfCurrentRegion (:430-434) read the SAME MapsFile.RegionRaces
 *  entry: the bank IS that value, the race is that value + 1. So the
 *  region's bank falls out of the region's race, which is the seam the
 *  hosts already answer, and a race outside the table takes
 *  GetNameBankOfCurrentRegion's own no-region answer, Breton. */
export const nameBankOfRegionRace = (race) => (
  race >= BANK_TYPES.Breton + 1 && race <= BANK_TYPES.Imperial + 1
    ? race - 1 : BANK_TYPES.Breton);

export function firstName(type, gender) {
  const bank = bankOf(type);
  switch (type) {
    case BANK_TYPES.Breton:
    case BANK_TYPES.Nord:
    case BANK_TYPES.DarkElf:
    case BANK_TYPES.HighElf:
    case BANK_TYPES.WoodElf:
    case BANK_TYPES.Khajiit:
    case BANK_TYPES.Imperial: {
      const [a, b] = gender === GENDERS.Male
        ? [bank.sets[0].parts, bank.sets[1].parts]
        : [bank.sets[2].parts, bank.sets[3].parts];
      return draw(a) + draw(b);
    }
    case BANK_TYPES.Redguard: {
      const partsD = gender === GENDERS.Male ? bank.sets[3].parts : bank.sets[4].parts;
      const a = draw(bank.sets[0].parts);
      const b = draw(bank.sets[1].parts);
      const c = draw(bank.sets[2].parts);
      let d = '';
      // Verbatim short-circuit: female never rolls the 75%.
      if (gender === GENDERS.Female || (rand() % 100 < 75)) d = draw(partsD);
      return a + b + c + d;
    }
    default:
      return '';
  }
}

export function surname(type) {
  const bank = bankOf(type);
  switch (type) {
    case BANK_TYPES.Breton:
    case BANK_TYPES.DarkElf:
    case BANK_TYPES.HighElf:
    case BANK_TYPES.WoodElf:
    case BANK_TYPES.Khajiit:
    case BANK_TYPES.Imperial:
      return draw(bank.sets[4].parts) + draw(bank.sets[5].parts);
    case BANK_TYPES.Nord:
      // Verbatim: 0+1 + the immutable localized suffix (default "sen").
      return draw(bank.sets[0].parts) + draw(bank.sets[1].parts) + 'sen';
    default:
      return '';
  }
}

/** Verbatim FullName: first + " " + surname when surname non-empty. */
export function fullName(type, gender) {
  const first = firstName(type, gender);
  const last = surname(type);
  return last ? `${first} ${last}` : first;
}

/** NameHelper.MonsterName / GetRandomMonsterName, verbatim (S17 -
 *  quest-facing). bankRoll picks Monster1 (8) or Monster2 (9)
 *  uniformly (DFU: UnityEngine.Random.Range(8, 10)); pass a bankType
 *  to force one (the Monster3 branch is ported whole even though the
 *  pick never returns it, exactly as GetRandomMonsterName carries
 *  it). All part draws ride DFRandom.rand(). */
export function monsterName(gender = GENDERS.Male, bankRoll = Math.random, bankType = null) {
  const type = bankType ?? (8 + Math.floor(bankRoll() * 2));
  const bank = bankOf(type);
  const partsA = bank.sets[0].parts;
  const partsB = bank.sets[1].parts;
  const partsC = bank.sets[2].parts;
  const partsD = bank.sets.length >= 4 ? bank.sets[3].parts : null;
  let a = '', b = '', c = '', d = '';
  if (type !== BANK_TYPES.Monster3) {   // Monster1 or Monster2
    a = draw(partsA);
    if (rand() % 50 < 25) b = draw(partsB);
    c = draw(partsC);
    // Additional set for Monster2 female
    if (partsD && gender === GENDERS.Female) d = draw(partsD);
  } else {   // Monster3
    if (gender === GENDERS.Female || rand() % 100 >= 25) {
      a = draw(partsA);
    } else {
      a = draw(partsD) + ' ';
      b = draw(partsA);
    }
    c = draw(partsB);
    d = draw(partsC);
  }
  return a + b + c + d;
}
