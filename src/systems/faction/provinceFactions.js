// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROVINCE-COURTS (2026-10-27; the audit "no system left behind in the Bay", item 33 - the owner's call taken: "Every
// single thing here needs to be addressed. No exceptions."; bible/03-World/World-Wide.md PROVINCE-COURTS): THE
// PROVINCES' OWN COURTS AND PEOPLE.
//
// FACTION.TXT gives each of the Bay's regions a Province faction (type 7) with its Court (14) and its People (15) as
// children, and a crown its ruler (an Individual, the Province's first child - Gothryd, Akorithi, Eadwyre). It has
// none for the provinces past the Bay (regions 62..70, WW-R), so there every reader of a region's court or people
// found nothing: the palace nobles were the People's (commoner work), %rn was a random stranger and %rt "Lord", a
// crime moved no commoner's standing, the price walk tilted by Random Ruler's power, no war, famine or plague walked a
// province, and a vampire turned there was a Lyrezi (FormulaHelper.GetVampireClan's default).
//
// DEPARTURE (named; Port-Ledger section A, PROVINCE-COURTS): the port's own factions, four a province - the Province,
// its ruler, its Court and its People - shaped as FACTION.TXT's per-region factions are (the crowns' own rows:
// Daggerfall 201 / Gothryd 364 / Court 595 / People 518), under ids FACTION.TXT never uses, keyed by the region:
// 6000 + region the Province, 6100 + region its ruler, 6200 + region its Court, 6300 + region its People. They ride
// every faction dictionary the game reads - the talk host's reader and the player's store, both through
// factionRep.addCustomFactions (DFU's AddCustomFactions, the one door a non-FACTION.TXT faction comes in by) - so every
// reader of a region's court or people finds them by DFU's own lookups, typed (talk.js getCourtOfCurrentRegion,
// getPeopleOfCurrentRegion, findFactionByTypeAndRegion). The Bay's records are FACTION.TXT's to the byte: nothing here
// touches one, and no Bay faction gains a child.
//
// THE RULERS: each province's crown seat's (WW7-3: Solitude, Mournhold, Alinor, Falinesti, Torval, Helstrom, the
// Imperial City), High Rock's and Hammerfell's land past the Bay held under the Bay's crowns by a duke and a duchess
// (WW7-3: no crown of their own). A ruler's name is drawn from the province's own name bank (REGION_NAME_BANKS) on the
// game's own banks (withGameNameBanks - every client names them alike: a faction's name is a key), seeded by the
// ruler's id, the DFRandom stream put back after; Cyrodiil's is Daggerfall's own Emperor, Uriel Septim VII (TEXT.RSC:
// "the true Emperor of Tamriel, Uriel Septim VII"), never a stranger's. The titles are the lore's (buildingNames.js
// RULER_TITLES: DFU's twelve and the port's High King/High Queen, Emperor/Empress after them).
//
// THE BLOODLINES: one of Daggerfall's nine clans a province, each clan once (the record's table, World-Wide.md).
//
// THE CLANS' REGIONS: FACTION.TXT's nine vampire clans (150-158) carry regions 62..70 - the provinces' very numbers
// (WW-R numbered them after the Bay's 62). Every lookup of a faction by a region is typed (a Province, a Court, a
// People - never a clan's type), and the war's border test past the Bay asks two Provinces and the provinces' own
// borders (factionRelations.js PROVINCE_BORDERS), so a clan never answers as a province's court, people or crown.
//
// Pure: no FACTION.TXT, no DOM.
// ═══════════════════════════════════════════════════════════════════
import { FACTION_TYPES, SOCIAL_GROUPS, GUILD_GROUPS, FACTION_FLAGS } from '../../formats/factionFile.js';
import {
  BAY_REGION_COUNT,
  PROVINCE_REGION_NAMES,
  REGION_NAMES,
  REGION_NAME_BANKS,
  isProvinceRegion,
} from '../../formats/mapsTables.js';
import { fullName, withGameNameBanks, GENDERS } from '../../characters/nameHelper.js';
import { srand, getSeed, setSeed } from '../../formats/dfRandom.js';
import { t, withBaseText, getLocalizedRegionName, registerFactionNameText } from '../textManager.js';
import { factionRaceFromRace } from '../../characters/staticNpc.js';
import { RACES } from '../races.js';

/** The ids, keyed by the province's region (62..70): 6000 + region its Province, 6100 + its ruler, 6200 + its Court,
 *  6300 + its People - past every id FACTION.TXT uses (0..977, and the duplicates' resolver from 980) and every custom
 *  faction the port registers (Roleplay & Realism's 1020-1022, Immersive Travel's 8642-8643). */
export const PROVINCE_FACTION_BASE = Object.freeze({ province: 6000, ruler: 6100, court: 6200, people: 6300 });
/** A province faction's id - `kind` one of PROVINCE_FACTION_BASE's - or -1 for a region no province's.
 *  @param {'province'|'ruler'|'court'|'people'} kind @param {number} region */
export const provinceFactionId = (kind, region) =>
  isProvinceRegion(region) && Object.hasOwn(PROVINCE_FACTION_BASE, kind) ? PROVINCE_FACTION_BASE[kind] + region : -1;

/** FACTION.TXT's vampire clans (DaggerfallUnityEnums.VampireClans - the values the clans' own faction ids; infection.js
 *  VAMPIRE_CLANS, pinned equal). */
const CLAN = Object.freeze({
  Vraseth: 150,
  Haarvenu: 151,
  Thrafey: 152,
  Lyrezi: 153,
  Montalion: 154,
  Khulari: 155,
  Garlythi: 156,
  Anthotis: 157,
  Selenu: 158,
});
/** A people's race in FACTION.TXT's own numbering (FactionFile.FactionRaces - characters/staticNpc.js factionRaceFromRace). */
const RACE = Object.freeze(
  Object.fromEntries(
    ['Nord', 'Khajiit', 'Redguard', 'Breton', 'Argonian', 'WoodElf', 'HighElf', 'DarkElf'].map((k) => [
      k,
      factionRaceFromRace(RACES[k]),
    ]),
  ),
);
/** A flat as FACTION.TXT packs one (archive << 7 | record) - FLATS.CFG's nobles of archive 183. */
const flat = (archive, record) => (archive << 7) + record;
/** MacroHelper.GetRulerTitle's codes (buildingNames.js RULER_TITLES): odd a man's, even a woman's ((ruler + 1) % 2). */
export const RULER = Object.freeze({
  King: 1,
  Queen: 2,
  Duke: 3,
  Duchess: 4,
  HighKing: 13,
  HighQueen: 14,
  Emperor: 15,
  Empress: 16,
});

/**
 * THE NINE, by region (the record's table - World-Wide.md PROVINCE-COURTS, the reasons there): the ruler's title code,
 * the Province's power (the Bay's crowns stand at 75-80, its other regions about 50-70), the bloodline a vampire turned
 * there takes, the people's race (FactionRaces; Cyrodiil's Imperials as Bretons, WW-R's REGION_RACES), the ruler's flat
 * (FLATS.CFG's nobles: 183.4 a noble-looking man, 183.6 a bearded king, 183.7 a king wearing a turban, 183.10 a king,
 * 183.11 a queen, 183.13 a handsome young king, 183.9 a brunette queen) and its face there (TFAC00I0.RCI), and whether
 * the province is a crown's (WW7-3 - High Rock's and Hammerfell's land past the Bay is no crown's).
 */
export const PROVINCE_COURTS = Object.freeze([
  Object.freeze({
    region: 62,
    ruler: RULER.Duke,
    power: 60,
    vam: CLAN.Garlythi,
    race: RACE.Breton,
    rulerFlat: flat(183, 4),
    face: 405,
    crown: false,
  }),
  Object.freeze({
    region: 63,
    ruler: RULER.Duchess,
    power: 60,
    vam: CLAN.Anthotis,
    race: RACE.Redguard,
    rulerFlat: flat(183, 9),
    face: 407,
    crown: false,
  }),
  Object.freeze({
    region: 64,
    ruler: RULER.HighKing,
    power: 80,
    vam: CLAN.Haarvenu,
    race: RACE.Nord,
    rulerFlat: flat(183, 6),
    face: 377,
    crown: true,
  }),
  Object.freeze({
    region: 65,
    ruler: RULER.King,
    power: 80,
    vam: CLAN.Montalion,
    race: RACE.DarkElf,
    rulerFlat: flat(183, 10),
    face: 389,
    crown: true,
  }),
  Object.freeze({
    region: 66,
    ruler: RULER.Queen,
    power: 80,
    vam: CLAN.Thrafey,
    race: RACE.HighElf,
    rulerFlat: flat(183, 11),
    face: 362,
    crown: true,
  }),
  Object.freeze({
    region: 67,
    ruler: RULER.King,
    power: 70,
    vam: CLAN.Khulari,
    race: RACE.WoodElf,
    rulerFlat: flat(183, 13),
    face: 402,
    crown: true,
  }),
  Object.freeze({
    region: 68,
    ruler: RULER.Queen,
    power: 70,
    vam: CLAN.Lyrezi,
    race: RACE.Khajiit,
    rulerFlat: flat(183, 9),
    face: 407,
    crown: true,
  }),
  Object.freeze({
    region: 69,
    ruler: RULER.King,
    power: 65,
    vam: CLAN.Selenu,
    race: RACE.Argonian,
    rulerFlat: flat(183, 7),
    face: 377,
    crown: true,
  }),
  Object.freeze({
    region: 70,
    ruler: RULER.Emperor,
    power: 90,
    vam: CLAN.Vraseth,
    race: RACE.Breton,
    rulerFlat: flat(183, 6),
    face: 377,
    crown: true,
  }),
]);
/** The province of a region, or null. @param {number} region */
export const provinceCourtOf = (region) => PROVINCE_COURTS.find((p) => p.region === region) ?? null;

/** Cyrodiil's ruler: Daggerfall's own Emperor (TEXT.RSC's "the true Emperor of Tamriel, Uriel Septim VII"). */
export const CYRODIIL_RULER_NAME = 'Uriel Septim VII';

/** The Court's and the People's names: the canonical English is the key (FACTION.TXT's "Court of Daggerfall" shape);
 *  each is shown in the player's language through the same pattern. */
const COURT_NAME = 'Court of {province}';
const PEOPLE_NAME = 'People of {province}';
const courtName = (province) => t('faction.province.court', COURT_NAME, { province });
const peopleName = (province) => t('faction.province.people', PEOPLE_NAME, { province });

/** THE RULER'S NAME, a key: drawn from the province's own name bank on the game's own banks, the ruler's id the seed,
 *  the DFRandom stream as it was after (a faction's names are drawn when a dictionary is made, mid-game). */
export function provinceRulerName(region) {
  const p = provinceCourtOf(region);
  if (!p) return null;
  if (region === BAY_REGION_COUNT + PROVINCE_REGION_NAMES.length - 1) return CYRODIIL_RULER_NAME;
  const was = getSeed();
  try {
    return withGameNameBanks(() => {
      srand(provinceFactionId('ruler', region));
      return fullName(REGION_NAME_BANKS[region], p.ruler % 2 === 1 ? GENDERS.Male : GENDERS.Female);
    });
  } finally {
    setSeed(was);
  }
}

/** A record of FACTION.TXT's shape (formats/factionFile.js newFaction's fields, every one). */
const record = (o) => ({
  id: 0,
  parent: 0,
  type: 0,
  name: '',
  rep: 0,
  summon: -1,
  region: -1,
  power: 0,
  flags: 0,
  ruler: 0,
  ally1: 0,
  ally2: 0,
  ally3: 0,
  enemy1: 0,
  enemy2: 0,
  enemy3: 0,
  face: -1,
  race: -1,
  flat1: 0,
  flat2: 0,
  sgroup: 0,
  ggroup: 0,
  minf: 0,
  maxf: 0,
  vam: 0,
  rank: 0,
  rulerNameSeed: 0,
  rulerPowerBonus: 0,
  children: null,
  ...o,
});

/**
 * THE THIRTY-SIX RECORDS - each province's Province, ruler, Court and People in that order, as fresh objects (a store
 * clones what it is handed; a reader's dictionary takes these as its own). Shaped on FACTION.TXT's crowns: the Province
 * a root (parent 0) of sgroup Nobility and ggroup Region, RulerImmune (the named ruler stands; a crown's other bits its
 * crowns' 60, a crownless land's the immunity alone), its children the ruler, the Court, the People - the ruler first,
 * as Gothryd is Daggerfall's (%rn, %nrn and the throne room read the first child); the ruler an Individual of the
 * Nobility; the Court as the crowns' Courts (power 25, flags 128, sgroup Nobility, ggroup Region); the People as the
 * crowns' People (sgroup Commoners, ggroup GeneralPopulace, power 5, Wayrest's). The Province's and the Court's flats
 * the generic ruler's and the courts' own (FACTION.TXT 852's 183.6 / 183.8; the courts' and the people's 182.20 /
 * 182.28).
 */
export function provinceFactionRecords() {
  const out = [];
  for (const p of PROVINCE_COURTS) {
    const region = p.region,
      province = REGION_NAMES[region];
    const ids = {
      province: provinceFactionId('province', region),
      ruler: provinceFactionId('ruler', region),
      court: provinceFactionId('court', region),
      people: provinceFactionId('people', region),
    };
    out.push(
      record({
        id: ids.province,
        type: FACTION_TYPES.Province,
        name: province,
        region,
        power: p.power,
        flags: p.crown ? 60 : FACTION_FLAGS.RulerImmune,
        ruler: p.ruler,
        race: p.race,
        flat1: flat(183, 6),
        flat2: flat(183, 8),
        sgroup: SOCIAL_GROUPS.Nobility,
        ggroup: GUILD_GROUPS.Region,
        minf: 20,
        maxf: 70,
        vam: p.vam,
        children: [ids.ruler, ids.court, ids.people],
      }),
    );
    out.push(
      record({
        id: ids.ruler,
        parent: ids.province,
        type: FACTION_TYPES.Individual,
        name: provinceRulerName(region),
        region,
        power: 15,
        face: p.face,
        race: p.race,
        flat1: p.rulerFlat,
        flat2: p.rulerFlat,
        sgroup: SOCIAL_GROUPS.Nobility,
        ggroup: GUILD_GROUPS.None,
        minf: 20,
        maxf: 90,
      }),
    );
    out.push(
      record({
        id: ids.court,
        parent: ids.province,
        type: FACTION_TYPES.Courts,
        name: withBaseText(() => courtName(province)),
        region,
        power: 25,
        flags: 128,
        race: p.race,
        flat1: flat(182, 20),
        flat2: flat(182, 20),
        sgroup: SOCIAL_GROUPS.Nobility,
        ggroup: GUILD_GROUPS.Region,
        minf: 20,
        maxf: 80,
      }),
    );
    out.push(
      record({
        id: ids.people,
        parent: ids.province,
        type: FACTION_TYPES.People,
        name: withBaseText(() => peopleName(province)),
        region,
        power: 5,
        race: p.race,
        flat1: flat(182, 20),
        flat2: flat(182, 28),
        sgroup: SOCIAL_GROUPS.Commoners,
        ggroup: GUILD_GROUPS.GeneralPopulace,
        minf: 5,
        maxf: 30,
      }),
    );
  }
  return out;
}
/** Every province faction's id, in the records' order. */
export const PROVINCE_FACTION_IDS = Object.freeze(
  PROVINCE_COURTS.flatMap((p) =>
    ['province', 'ruler', 'court', 'people'].map((k) => provinceFactionId(/** @type {any} */ (k), p.region)),
  ),
);
const ID_SET = new Set(PROVINCE_FACTION_IDS);
/** Is `id` one of the provinces' factions? @param {number} id */
export const isProvinceFactionId = (id) => ID_SET.has(id);

/**
 * THE DOOR: every province faction a dictionary does not already hold, added (a fresh record each), its name in
 * `nameToId` where the caller keeps one (factionNameToIDDict - first name wins, as FactionFile's). Answers how many
 * were added. Their children are their own (the Province names its three), so no relink is asked and no Bay record
 * moves. @param {Map<number, any>} dict @param {Map<string, number>|null} [nameToId]
 */
export function addProvinceFactions(dict, nameToId = null) {
  if (!dict || typeof dict.set !== 'function') return 0;
  let added = 0;
  for (const f of provinceFactionRecords()) {
    if (dict.has(f.id)) continue;
    dict.set(f.id, f);
    if (nameToId && !nameToId.has(f.name)) nameToId.set(f.name, f.id);
    added++;
  }
  return added;
}

/** THE SHOWN NAME of a province faction in the player's language (textManager.js getLocalizedFactionName asks it after
 *  a translation pack's own table): the Province its region's shown name, the Court and the People the pattern over it,
 *  the ruler their own name; null for any other id. @param {number} id */
export function provinceFactionShownName(id) {
  if (!isProvinceFactionId(id)) return null;
  const kind = Math.floor(id / 100) * 100,
    region = id - kind;
  const shown = getLocalizedRegionName(region, (i) => REGION_NAMES[i]);
  if (kind === PROVINCE_FACTION_BASE.province) return shown;
  if (kind === PROVINCE_FACTION_BASE.court) return courtName(shown);
  if (kind === PROVINCE_FACTION_BASE.people) return peopleName(shown);
  return provinceRulerName(region);
}
registerFactionNameText(provinceFactionShownName);
