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
//
// L10N3f (2026-09-28): A TRANSLATION'S NAME BANKS, READ ONCE A SESSION.
// DFU's NameHelper reads NameGen.txt once, in its constructor at
// startup: the Resources copy, replaced whole by StreamingAssets/Text/
// NameGen.txt where a translation pack installs its own
// (LoadNameGenData, NameHelper.cs:77-80, :372-392). Here the banks are
// read the FIRST TIME the game makes a name - the pack's NameGen of the
// language standing then, else the vendored banks - and held for the
// rest of the page, whatever the language does after. The Nord
// surname's suffix (GetLocalizedText("nordSurnameImmutableSuffix"),
// :246) is part of every Nord surname and is read with them.
//
// WHY ONCE, AND NOT THE LANGUAGE OF THE MOMENT: a generated name is a
// KEY. A static NPC's name is made again from its seed every time it is
// shown (StaticNPC.GetDisplayName, StaticNPC.cs:315-328) and compared
// with the quest Person's name, which was made from the SAME seed when
// the quest began and is saved as a string (Person.cs:602-628, :867,
// :1143) - TalkManager.cs:3159, topicTree.js _dialogPartnerIsSamePerson.
// A building's %ef and a painting's artist are made again from their
// seeds the same way. Were the banks to follow a language
// switched in play, every name made after would be spelled from other
// parts than the names already held, and the comparisons would miss. So
// the port keeps DFU's own law - one set of banks a run - and a new set
// is read only by a new page. A save made under other banks keeps its
// names as they were spelled, exactly as DFU's does when a pack is
// installed between two sessions (L10N5: saves hold ids).

import { rand, srand, randomRangeInclusive } from '../formats/dfRandom.js';
import { REGION_RACES } from '../formats/mapsFile.js';
import { RACES } from '../systems/races.js';
import { localeDocument, localizedText } from '../systems/textManager.js';   // L10N3f: a pack's NameGen.txt and the Nord suffix
import { PACK_KIND } from '../systems/translationPacks.js';
import nameGen from './nameGen.json' with { type: 'json' };

export const BANK_TYPES = Object.freeze({
  Breton: 0, Redguard: 1, Nord: 2, DarkElf: 3, HighElf: 4,
  WoodElf: 5, Khajiit: 6, Imperial: 7, Monster1: 8, Monster2: 9, Monster3: 10,
});
export const GENDERS = Object.freeze({ Male: 0, Female: 1 });

const BANK_NAMES = ['Breton', 'Redguard', 'Nord', 'DarkElf', 'HighElf',
  'WoodElf', 'Khajiit', 'Imperial', 'Monster1', 'Monster2', 'Monster3'];

/**
 * The JSON NameHelper deserializes, read as DFU's FullSerializer
 * parser (fsJsonParser) reads it - which is looser than JSON.parse, and
 * every pack's NameGen.txt is written against it (DFU's own has one
 * missing comma between two Monster3 sets and a trailing comma, and
 * the French pack's the same two): a comma between two values is
 * optional, one before a closing bracket is allowed, and `//` and
 * `/* *\/` comments are whitespace. Throws on anything else.
 */
export function parseFsJson(src) {
  const s = String(src ?? '');
  let i = 0;
  const fail = (what) => { throw new Error(`${what} at ${i}`); };
  const space = () => {
    for (;;) {
      while (i < s.length && /\s/.test(s[i])) i++;
      if (s[i] === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++; continue; }
      if (s[i] === '/' && s[i + 1] === '*') { const end = s.indexOf('*/', i + 2); i = end < 0 ? s.length : end + 2; continue; }
      return;
    }
  };
  const ESCAPES = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
  const string = () => {
    if (s[i] !== '"') fail('Expected a string');
    let out = '';
    for (i++; i < s.length && s[i] !== '"'; i++) {
      if (s[i] !== '\\') { out += s[i]; continue; }
      const e = s[++i];
      if (e === 'u') { const hex = s.slice(i + 1, i + 5); if (!/^[0-9a-f]{4}$/i.test(hex)) fail('Bad \\u escape'); out += String.fromCharCode(parseInt(hex, 16)); i += 4; } else if (ESCAPES[e] !== undefined) out += ESCAPES[e];
      else fail(`Bad escape \\${e}`);
    }
    if (s[i] !== '"') fail('Unterminated string');
    i++;
    return out;
  };
  const value = () => {
    space();
    if (s[i] === '{') {
      const obj = {};
      for (i++, space(); i < s.length && s[i] !== '}'; space()) {
        const key = string();
        space();
        if (s[i] !== ':') fail(`Expected : after key "${key}"`);
        i++;
        obj[key] = value();
        space();
        if (s[i] === ',') i++;
      }
      if (s[i] !== '}') fail('No closing } for object');
      i++;
      return obj;
    }
    if (s[i] === '[') {
      const arr = [];
      for (i++, space(); i < s.length && s[i] !== ']'; space()) {
        arr.push(value());
        space();
        if (s[i] === ',') i++;
      }
      if (s[i] !== ']') fail('No closing ] for array');
      i++;
      return arr;
    }
    if (s[i] === '"') return string();
    const m = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(s.slice(i, i + 32));
    if (!m) fail('Unexpected character');
    i += m[0].length;
    return m[0] === 'true' ? true : m[0] === 'false' ? false : m[0] === 'null' ? null : Number(m[0]);
  };
  const out = value();
  space();
  return out;
}

/** The deserialize's other half (Dictionary<BankTypes, NameBank>): a
 *  pack's banks, held to the shape the generators read - every one of
 *  the eleven, each with as many sets as the game's own and every set
 *  a non-empty list of strings (a draw over none is DFU's
 *  DivideByZeroException). Throws otherwise. */
export function nameBanksOf(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('NameGen is not a dictionary of banks');
  const banks = {};
  for (const name of BANK_NAMES) {
    const bank = parsed[name];
    if (!Array.isArray(bank?.sets) || bank.sets.length < nameGen[name].sets.length) throw new Error(`NameGen bank ${name} is missing or short`);
    for (const set of bank.sets) {
      if (!Array.isArray(set?.parts) || !set.parts.length || !set.parts.every((p) => typeof p === 'string')) throw new Error(`NameGen bank ${name} has a set without parts`);
    }
    banks[name] = bank;
  }
  return banks;
}

/** LoadNameGenData (NameHelper.cs:372-392) for the language standing:
 *  its pack's NameGen.txt, else the game's own banks. A file that will
 *  not read is said, with DFU's line, and the game's own banks stand -
 *  DFU's catch would leave NO banks and every name empty, keys and all
 *  (a departure, recorded). */
export function loadNameGenData() {
  const text = localeDocument(PACK_KIND.NAMEGEN, 'NameGen');
  if (text == null) return nameGen;
  try { return nameBanksOf(parseFsJson(text)); } catch (err) {
    console.log(`Could not load or deserialize NameGen.txt database from StreamingAssets/Text or internal Resources. Check file exists and is in correct format. (${err?.message ?? err})`);
    return nameGen;
  }
}

// The session's banks and Nord suffix - read at the first name made, then held (see L10N3f above).
let _session = null;
function session() {
  if (!_session) _session = { banks: loadNameGenData(), nordSuffix: localizedText('nordSurnameImmutableSuffix', 'sen') };
  return _session;
}
/** A new session's read, as a new page makes one. Tests; nothing in the game calls it. */
export function resetNameBanks() { _session = null; }

const bankOf = (type) => session().banks[BANK_NAMES[type]];
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

/** EntityEnums.Races ordinal -> race key, so the 1..8 roll below can
 *  be handed to getNameBank exactly as C# hands GetNameBank a Races. */
const RACE_KEY_BY_ORDINAL = Object.freeze(Object.fromEntries(
  Object.entries(RACES).map(([key, ordinal]) => [ordinal, key])));

/** MacroHelper.GetRandomNameBank (MacroHelper.cs:303-308):
 *
 *      DFRandom.Seed = (uint)random.Next();
 *      Races race = (Races)DFRandom.random_range_inclusive(1, 8);
 *      return GetNameBank(race);
 *
 *  A bank drawn from a RANDOM one of the eight playable races - it
 *  reads no PlayerGPS and no region at all, which is what separates it
 *  from GetRandomFullName (:333-341, the region-bank form). The seed is
 *  System.Random.Next(), i.e. a non-negative Int32, cast to uint.
 *  Ledger A's engine-PRNG rule puts Math.random on that outer draw. */
export function getRandomNameBank() {
  srand((Math.random() * 0x80000000) >>> 0);
  return getNameBank(RACE_KEY_BY_ORDINAL[randomRangeInclusive(1, 8)]);
}

/** MacroHelper.GetRandomFullName (MacroHelper.cs:333-341), the
 *  REGION-bank form - the sibling of getRandomNameBank above, and the
 *  one the talk MCP's %n fallback and RegentName's no-individual-ruler
 *  arm both call:
 *
 *      NameHelper.BankTypes nameBankType = NameHelper.BankTypes.Breton;
 *      if (GameManager.Instance.PlayerGPS.CurrentRegionIndex > -1)
 *          nameBankType = (NameHelper.BankTypes)MapsFile.RegionRaces[...];
 *      Genders gender = (DFRandom.random_range_inclusive(0, 1) == 1)
 *          ? Genders.Female : Genders.Male;
 *      return DaggerfallUnity.Instance.NameHelper.FullName(nameBankType, gender);
 *
 *  AUDIT 58: the GENDER IS A COIN FLIP on the DFRandom stream, and it
 *  is drawn whichever way it lands. The talk MCP hardcoded Male, so
 *  the fallback stranger was never a woman AND the unspent draw left
 *  every later value on that stream shifted by one. `regionIndex` is
 *  PlayerGPS.CurrentRegionIndex; getNameBankOfRegion carries the -1
 *  guard verbatim. */
export function getRandomFullName(regionIndex) {
  const bank = getNameBankOfRegion(regionIndex ?? -1);
  const gender = randomRangeInclusive(0, 1) === 1 ? GENDERS.Female : GENDERS.Male;
  return fullName(bank, gender);
}

/** Verbatim MapsFile.GetNameBankOfRegion. */
export function getNameBankOfRegion(regionIndex) {
  if (regionIndex > -1) return REGION_RACES[regionIndex];
  return BANK_TYPES.Breton;
}

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
      // Verbatim: 0+1 + the immutable localized suffix (default "sen") - L10N3f: the session's (see above).
      return draw(bank.sets[0].parts) + draw(bank.sets[1].parts) + session().nordSuffix;
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
