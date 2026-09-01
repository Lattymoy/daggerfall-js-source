// THE MACRO ENGINE (Q4-i) - QuestMacroHelper.cs + QuestMCP.cs + the
// MacroHelper.cs subset the quest path routes through. Resolves the
// in-place text macros of quest messages: the SYMBOL macros
// (_symbol_ name, __symbol_ town, ___symbol_ place, ____symbol_
// region, =symbol_ details, ==symbol_ faction, =#symbol_ binding)
// answered by the owning resource's expandMacro, and the %-CONTEXT
// macros answered by the handler table over the quest's macro data
// source (QuestMCP) with the machine's seams behind it.
//
// THE ERROR SHAPES ARE C#'s OWN (MacroHelper.GetValue): a token
// missing from the table renders `%x[undefined]`; a null table entry
// renders `%x[unhandled]`; a handler answering null renders `%x[nullMCP]`;
// a NotImplemented source method falls to the SECOND context
// provider (quest.externalMCP - the offer/talk window's NPC source,
// Q4-ii) and renders `%x[srcDataUnknown]` when that misses too.
// HEADLESS the world-backed handlers answer null and the error
// shapes surface LOUDLY - the corpus gate's charter.
//
// KEPT QUIRKS: the macro regex's inner class [a-zA-Z0-9.]+ has no
// underscore, so `_one_day_` truncates to `_one_` and misses its
// resource - the raw text stands, verbatim DFU; %pct (GuildTitle)
// with no external MCP falls through the null-mcp arm to the
// PLAYER's name; %di reads lastPlaceReferenced.scope BEFORE the
// null check, so an unreferenced place THROWS out of expansion as
// C#'s NRE does; GrammarManager.ProcessGrammar is identity
// (DefaultGrammarRules) and is skipped whole.
//
// Handlers the C# table carries but no corpus message reaches are
// NOT ported: they answer the token unchanged with one warn
// (PENDING_HANDLERS) - the coverage-ordered doctrine, the action
// registry's guard precedent.

import { srand, randomRangeInclusive } from '../../formats/dfRandom.js';
import { liveStat } from '../statMods.js';                       // M-X: %mad's MagicResist read
import { permanentSkillValue, SKILL_NAMES } from '../skills.js'; // M-X: %ski
import { entityMaxEncumbrance } from '../../combat/formulas.js'; // M-X: %enc (FormulaHelper.MaxEncumbrance over LiveStrength)
import { surname } from '../../characters/nameHelper.js';        // M-X: %ln
import { GENDERS, getNameBankOfRegion, fullName, getNameBank } from '../../characters/nameHelper.js';

// FactionRaces number -> race key (FactionFile.cs:609-624 through
// RaceTemplate.GetRaceFromFactionRace; unmapped falls to Breton in
// getNameBank's default arm, as C#'s None does).
const FACTION_RACE_KEYS = Object.freeze({
  0: 'Nord', 1: 'Khajiit', 2: 'Redguard', 3: 'Breton',
  4: 'Argonian', 5: 'WoodElf', 6: 'HighElf', 7: 'DarkElf',
});
import { dateFromSeconds, dateString, dayName, monthName, birthSignName, SEASON_NAMES, seasonValue, CLASSIC_EPOCH_IN_SECONDS } from '../gameDate.js';
import { REGION_TEMPLES } from '../../formats/mapsFile.js';
import { factionRaceFromRace } from '../../characters/staticNpc.js';

export const MACRO_TYPES = Object.freeze({
  None: 0, NameMacro1: 1, NameMacro2: 2, NameMacro3: 3, NameMacro4: 4,
  DetailsMacro: 5, FactionMacro: 6, ContextMacro: 7, BindingMacro: 8,
});

// Internal_Strings en values the handlers speak.
const EN = Object.freeze({
  pronounHe: 'he', pronounShe: 'she',
  pronounHim: 'him', pronounHer: 'her',
  pronounHimself: 'himself', pronounHerself: 'herself',
  pronounHis: 'his', pronounHer2: 'her',
  pronounHis2: 'his', pronounHers: 'hers',
  comma: ',  ',   // Internal_Strings id 424 is a comma and TWO spaces (AUDIT 24)
  // Internal_Strings id 425 - AUDIT 24: the en value is '...never mind...',
  // NOT the key name. This is what DFU prints when a place will not
  // resolve, and the port had been printing 'Resolving Error'.
  resolvingError: '...never mind...',
  letterPrefix: 'Letter: ',
});

// GetRulerTitle (MacroHelper.cs): ruler 1..12, default Lord.
const RULER_TITLES = Object.freeze([
  null, 'King', 'Queen', 'Duke', 'Duchess', 'Marquis', 'Marquise',
  'Count', 'Countess', 'Baron', 'Baroness', 'Lord', 'Lady',
]);
const rulerTitle = (ruler) => RULER_TITLES[ruler] ?? 'Lord';

// GetRandomDivine (QuestMCP.cs): Range(0,9) over the enum NAMES.
const DIVINES = Object.freeze([
  'Arkay', 'Zen', 'Mara', 'Ebonarm', 'Akatosh', 'Julianos', 'Dibella',
  'Stendarr', 'Kynareth',
]);

// Temple.Divines (Temple.cs:49-59) - the enum's VALUE is the factionId,
// and note the spelling: this arm says "Zenithar" where GetRandomDivine
// above says "Zen", because one stringifies Temple.Divines and the
// other FactionFile.FactionIDs. DFU's own inconsistency, kept.
const DIVINE_BY_FACTION = Object.freeze({
  21: 'Arkay', 22: 'Zenithar', 24: 'Mara', 26: 'Akatosh',
  27: 'Julianos', 29: 'Dibella', 33: 'Stendarr', 35: 'Kynareth',
});
const THE_FIGHTERS_GUILD = 41;   // FactionFile.FactionIDs (:90)

/** Temple.GetDivine (Temple.cs:306-321): the temple hall answers by its
 *  own factionId; a TEMPLAR ORDER answers by its faction record's
 *  parent; anything else throws. */
function templeDivine(w, factionId) {
  if (DIVINE_BY_FACTION[factionId]) return DIVINE_BY_FACTION[factionId];
  const rec = w?.getFactionData?.(factionId);
  if (rec && DIVINE_BY_FACTION[rec.parent]) return DIVINE_BY_FACTION[rec.parent];
  throw new Error(`There is no Divine that matches the factionId: ${factionId}`);
}

/** GetMacro (QuestMacroHelper.cs:285-377): the ordered alternation -
 *  longest name-prefix first, then ==, =#, =, %. One macro per word;
 *  the token is the exact matched substring (prefix..suffix), so
 *  adjacent punctuation survives the replace. */
const MACRO_PATTERN = new RegExp(
  '(?<nm4>____[a-zA-Z0-9.]+_)'
  + '|(?<nm3>___[a-zA-Z0-9.]+_)'
  + '|(?<nm2>__[a-zA-Z0-9.]+_)'
  + '|(?<nm1>_[a-zA-Z0-9.]+_)'
  + '|(?<fac>==[a-zA-Z0-9.]+_)'
  + '|(?<bind>=#[a-zA-Z0-9.]+_)'
  + '|(?<det>=[a-zA-Z0-9.]+_)'
  + '|(?<ctx>%\\w+)');

const GROUP_TYPES = [
  ['nm4', MACRO_TYPES.NameMacro4, 4], ['nm3', MACRO_TYPES.NameMacro3, 3],
  ['nm2', MACRO_TYPES.NameMacro2, 2], ['nm1', MACRO_TYPES.NameMacro1, 1],
  ['fac', MACRO_TYPES.FactionMacro, 2], ['bind', MACRO_TYPES.BindingMacro, 2],
  ['det', MACRO_TYPES.DetailsMacro, 1], ['ctx', MACRO_TYPES.ContextMacro, 1],
];

export function getMacro(word) {
  const match = MACRO_PATTERN.exec(word);
  if (!match) return { token: '', type: MACRO_TYPES.None, symbol: '' };
  for (const [group, type, prefixLen] of GROUP_TYPES) {
    const token = match.groups[group];
    if (token == null) continue;
    const symbol = type === MACRO_TYPES.ContextMacro
      ? token.slice(prefixLen)
      : token.slice(prefixLen, -1);
    return { token, type, symbol };
  }
  return { token: '', type: MACRO_TYPES.None, symbol: '' };
}

/**
 * MH1 - THE ONE WALK for window text outside the quest pipeline.
 * MacroHelper is ONE file in DFU; the port had grown a third,
 * lawless path beside its two real tables - replaceAll chains in
 * talkSession, guildServiceActions and arrestFlow, each window
 * rediscovering the two or three symbols it needed. This is the walk
 * they all ride now.
 *
 * `values` is the CALLER's macro data source - its MCP, as a plain
 * map of symbol (no '%') to value. The resolution per token:
 *   1. the exact symbol in `values`: a non-null value expands (a
 *      function is called - lazy, for values that cost something);
 *      an explicitly NULL value leaves the token VERBATIM, which is
 *      the `if (x != null)` guard the legacy chains carried;
 *   2. absent from the map, the CONTEXT HANDLERS answer when a
 *      questLike context (machine.macroContext()) rides in - the
 *      same GetValue ladder the quest pipeline runs;
 *   3. otherwise the token stays VERBATIM - these windows never
 *      printed DFU's [undefined] shape and MH1 does not start.
 *
 * THE MATCH IS MAXIMAL-MUNCH WITH EXACT LOOKUP, GetMacro's own law
 * (`%\w+`, then a dictionary hit on the whole symbol). That RETIRES
 * a latent legacy bug: replaceAll('%a', ...) would also fire inside
 * '%adj' or '%arm' and corrupt the longer symbol - the walk matches
 * '%adj' whole, misses the map, and leaves it alone.
 */
export function expandMacroValues(text, values = {}, questLike = null) {
  return String(text ?? '').replace(/%\w+/g, (token) => {
    const sym = token.slice(1);
    if (sym in values) {
      const v = values[sym];
      if (v == null) return token;
      return String(typeof v === 'function' ? v() : v);
    }
    if (questLike && HANDLERS[token]) {
      return getContextValue(token, questLike, questLike.hooks);
    }
    return token;
  });
}

// ---- the quest's macro data source (QuestMCP.cs) ----

// The NotImplemented sentinel: a source method C#'s MacroDataSource
// base throws for. GetValue's ladder falls to the second provider.
export const NOT_IMPLEMENTED = Symbol('NotImplementedException');

const pronounOf = (quest, male, female) => {
  const last = quest.lastResourceReferenced;
  return (last?.gender === GENDERS.Female) ? female : male;
};

/** QuestMacroDataSource (QuestMCP.cs): the quest-context answers.
 *  Every method mirrors its C# body; absent = the base's
 *  NotImplementedException. */
export function questMacroSource(quest) {
  const world = () => quest.hooks?.world ?? null;
  return {
    // %n %nam - seeded by the quest UID; gender by DFRandom's own coin
    name() {
      srand(quest.uid);
      const w = world();
      const bank = getNameBankOfRegion(w?.currentRegionIndex?.() ?? -1);
      const gender = randomRangeInclusive(0, 1) === 1 ? GENDERS.Female : GENDERS.Male;
      return fullName(bank, gender);
    },
    // %fn - seed uid; %mn - seed uid + 3457
    femaleName() {
      srand(quest.uid);
      return fullName(getNameBankOfRegion(world()?.currentRegionIndex?.() ?? -1), GENDERS.Female);
    },
    maleName() {
      srand(quest.uid + 3457);
      return fullName(getNameBankOfRegion(world()?.currentRegionIndex?.() ?? -1), GENDERS.Male);
    },
    // %kno - the quest faction's name, 'The ' trimmed for readability
    factionOrderName() {
      const record = world()?.getFactionData?.(quest.factionId);
      if (!record) return null;
      return record.name.startsWith('The ') ? record.name.slice(4) : record.name;
    },
    pronoun() { return pronounOf(quest, EN.pronounHe, EN.pronounShe); },
    pronoun2() { return pronounOf(quest, EN.pronounHim, EN.pronounHer); },
    pronoun2self() { return pronounOf(quest, EN.pronounHimself, EN.pronounHerself); },
    pronoun3() { return pronounOf(quest, EN.pronounHis, EN.pronounHer2); },
    pronoun4() { return pronounOf(quest, EN.pronounHis2, EN.pronounHers); },
    // %vcn - the last-referenced Person's vampire clan by HOME region
    vampireNpcClan() {
      const person = quest.lastResourceReferenced;
      if (!person?.isPerson) return null;
      if (person.factionData?.type !== 6) return null;   // FactionTypes.VampireClan
      let regionIndex = person.homeRegionIndex ?? -1;
      if (regionIndex === -1) regionIndex = world()?.currentRegionIndex?.() ?? -1;
      return world()?.regionVampireClanName?.(regionIndex) ?? person.factionData.name;
    },
    // %qdt %qdat - the CURRENT log step's date (the journal sets
    // currentLogMessageId while rendering; -1 falls to quest start)
    questDate() {
      return dateString(dateFromSeconds(quest.getCurrentLogMessageTime()));
    },
    // %oth - by the questor's race (DFU's fix over classic's region
    // race); the seam speaks TEXT.RSC 201+oathId.
    //
    // AUDIT 24 (the seven-slice sweep): every branch here now carries a
    // RACES value and ONE GetFactionRaceFromRace runs at the end,
    // exactly as QuestMCP.Oath (:182-202) does it. It used to mix the
    // two enums - the questor branch read a FactionRaces field, the
    // clicked branch read a Races off NPCData, and the region fallback
    // read whatever currentRegionRace() felt like - and then added all
    // three to 201 as if they were one numbering.
    oath() {
      let race = -1;   // Races (EntityEnums), -1 = None
      const questors = [...(quest.questors?.keys() ?? [])];
      if (questors.length > 0) race = quest.getPerson({ name: questors[0] })?.race ?? -1;
      else {
        // "%oth is used in some of the main quests before the questor
        // is actually set. In this case try to use the data from the
        // last clicked NPC, which should be the questor." (:191-193)
        const clicked = quest.hooks?.lastNPCClicked?.();
        if (clicked) race = clicked.race ?? -1;
      }
      if (race === -1) race = world()?.currentRegionRace?.() ?? -1;
      return world()?.getRandomText?.(201 + factionRaceFromRace(race)) ?? null;
    },
    homeRegion() {
      const last = quest.lastResourceReferenced;
      return last?.isPerson ? (last.homeRegionName ?? '') : '';
    },
    // %god - the temple the player stands in, else a random divine
    god() {
      // QuestMCP.God (:217-243), whole. AUDIT 24 systems: the port had
      // only the temple-building arm and rolled a random divine
      // everywhere else, so %god named a different god on every
      // expansion outside a temple. DFU falls back to the REGION's
      // dominant temple - GetTempleOfCurrentRegion (PlayerGPS.cs:495-
      // 498) is `MapsFile.RegionTemples[CurrentRegionIndex]` - and
      // only rolls when that answers 0, or the Fighters Guild (whose
      // halls "are considered temples in some areas").
      const w = world();
      const inside = w?.playerInside?.();
      let factionId = 0;
      if (inside?.building?.buildingType === 14) {   // Temple
        factionId = inside.building.factionId ?? 0;
      } else {
        // C# indexes the table directly and would throw out of range;
        // headless (no region) falls to the random arm instead.
        factionId = REGION_TEMPLES[w?.currentRegionIndex?.()] ?? 0;
      }
      if (factionId === 0 || factionId === THE_FIGHTERS_GUILD) {
        return DIVINES[Math.floor((quest.rolls ?? Math.random)() * 9)];   // Range(0,9) on the quest's rolls
      }
      return templeDivine(w, factionId);
    },
    // %di - C# QUIRK KEPT: LastPlaceReferenced.Scope is read BEFORE
    // the null check, so an unreferenced place THROWS (the NRE)
    direction() {
      const place = quest.lastPlaceReferenced;
      const w = world();
      if (place.scope === 'remote') {
        return w?.locationCompassDirection?.(place) ?? EN.resolvingError;
      } else if (place.scope === 'local') {
        if (place.siteDetails?.locationName === w?.currentLocation?.()?.name) {
          return w?.buildingCompassDirection?.(place.siteDetails.buildingKey) ?? EN.resolvingError;
        }
        return place.siteDetails?.locationName + EN.comma
          + (w?.locationCompassDirection?.(place) ?? EN.resolvingError);
      }
      return EN.resolvingError;
    },
  };
}

// ---- the %-macro handler table (MacroHelper.cs, the quest subset) ----

const source = (mcp) => mcp?.source ?? null;
const call = (mcp, method) => {
  const src = source(mcp);
  if (!src) return null;                       // C#: handler's mcp-null arm
  if (typeof src[method] !== 'function') return NOT_IMPLEMENTED;
  return src[method]();
};
const capFirst = (s) => s.substring(0, 1).toUpperCase() + s.substring(1);

// %reg's static region override (MacroHelper.idRegion; talk windows
// set it around expansions).
let idRegion = -1;
export const setIdRegion = (v) => { idRegion = v; };
// M-X: SetFactionIdsAndRegionID's other two outs - the news pair
// %fx1/%fx2 (and the lord/title reads over them) speak these.
let idFaction1 = -1, idFaction2 = -1;
export const setIdFactions = (f1, f2) => { idFaction1 = f1; idFaction2 = f2; };

/** CapFirst over a source method's answer, leaving a null/non-string
 *  miss alone - MacroHelper's *Cap handlers all read
 *  `if (mcp == null) return null; return CapFirst(...)`. */
const cap = (p) => (typeof p === 'string' ? capFirst(p) : p);

const HANDLERS = {
  '%pcn': (mcp, hooks) => hooks?.playerName?.() ?? null,
  '%pcf': (mcp, hooks) => {
    const name = hooks?.playerName?.();
    if (name == null) return null;
    const parts = name.split(' ');
    return parts.length > 0 ? parts[0] : name;
  },
  // %pct: no QuestMCP override exists, so the quest source answers
  // NOT_IMPLEMENTED, the ladder falls to externalMCP (Q4-ii's NPC
  // source), and a NULL second provider lands on the handler's
  // mcp-null arm: the PLAYER's name - the C# chain, kept whole
  '%pct': (mcp, hooks) => {
    if (!source(mcp)) return hooks?.playerName?.() ?? null;
    return call(mcp, 'guildTitle');
  },
  '%ra': (mcp, hooks) => hooks?.playerRaceName?.() ?? null,
  '%reg': (mcp, hooks) => {
    if (idRegion !== -1) return hooks?.world?.maps?.getRegion?.(idRegion)?.name ?? null;
    const w = hooks?.world;
    return w ? (w.maps?.getRegion?.(w.currentRegionIndex?.())?.name ?? null) : null;
  },
  '%crn': (mcp, hooks) => {
    const w = hooks?.world;
    return w ? (w.maps?.getRegion?.(w.currentRegionIndex?.())?.name ?? null) : null;
  },
  // %rn: the region Province faction's first Individual child is the
  // ruler; no defined individual -> a random full name
  '%rn': (mcp, hooks) => {
    const w = hooks?.world;
    const region = w?.findFactionByTypeAndRegion?.(7, w.currentRegionIndex?.());   // FactionTypes.Province
    if (region?.children) {
      for (const childID of region.children) {
        const child = w.getFactionData?.(childID);
        if (child?.type === 4) return child.name;   // Individual
      }
    }
    if (!w) return null;
    const bank = getNameBankOfRegion(w.currentRegionIndex?.() ?? -1);
    const gender = randomRangeInclusive(0, 1) === 1 ? GENDERS.Female : GENDERS.Male;
    return fullName(bank, gender);
  },
  // %rt/%t: RegentTitle (MacroHelper.cs:644-650) DISCARDS
  // FindFactionByTypeAndRegion's bool and reads the out struct
  // regardless - and PersistentFactionData assigns
  // `new FactionFile.FactionData()` BEFORE searching, so a miss hands
  // back all zeros and GetRulerTitle(0) takes its `default:` arm and
  // answers "Lord".
  //
  // AUDIT 24 (wave 26): the port gated its null on the LOOKUP
  // (`if (!region) return null`), conflating two different nothings -
  // "there is no world at all", which is the port's own headless
  // charter, and "the world is here and the lookup missed", which in
  // DFU is Lord. The sibling %rn above already separates them, gating
  // on `!w`; these two did not. rulerTitle's own `?? 'Lord'` is
  // already GetRulerTitle's default arm, so the zero struct falls
  // through it exactly.
  '%rt': (mcp, hooks) => {
    const w = hooks?.world;
    if (!w) return null;
    const region = w.findFactionByTypeAndRegion?.(7, w.currentRegionIndex?.());
    return rulerTitle(region?.ruler ?? 0);
  },
  '%t': (mcp, hooks) => HANDLERS['%rt'](mcp, hooks),
  // %nrn: the faction's first Individual child, else the SEEDED lord
  // name (rulerNameSeed & 0xffff; even rulers are female)
  // %nrn: LordOfCurrentRegion -> GetLordNameForFaction
  // (MacroHelper.cs:310-331), which drops GetFactionData's bool the
  // same way and has NO null path at all. Wave 26: same conflation as
  // %rt above. The zero struct gives ruler 0 -> gender (0+1)%2 = 1 =
  // Female (Genders { Male, Female }), race 0 -> FactionRaces.Nord,
  // and seed 0 & 0xffff = 0.
  '%nrn': (mcp, hooks) => {
    const w = hooks?.world;
    if (!w) return null;
    const fd = w.getFactionData?.(w.currentRegionFaction?.());
    if (fd?.children?.length > 0) {
      const firstChild = w.getFactionData?.(fd.children[0]);
      if (firstChild?.type === 4) return firstChild.name;
    }
    const gender = ((fd?.ruler ?? 0) + 1) % 2;   // C#: (Genders)((ruler+1)%2) - even rulers are female
    srand((fd?.rulerNameSeed ?? 0) & 0xffff);
    return fullName(getNameBank(FACTION_RACE_KEYS[fd?.race ?? 0]), gender);
  },
  '%vam': (mcp, hooks) => hooks?.world?.playerVampireClanName?.() ?? '%vam[ERROR: PC not a vampire]',
  '%jok': (mcp, hooks) => hooks?.world?.getRandomText?.(200) ?? null,
  '%cn': (mcp, hooks) => {
    const w = hooks?.world;
    if (!w) return null;
    const loc = w.currentLocation?.();
    if (loc?.loaded) return loc.name;
    return w.maps?.getRegion?.(w.currentRegionIndex?.())?.name ?? null;
  },
  '%dat': (mcp) => {
    const now = mcp?.quest?.nowSeconds?.();
    return now != null ? dateString(dateFromSeconds(now)) : null;
  },
  '%pg3': (mcp, hooks) =>
    (hooks?.playerGender?.() === 'female') ? EN.pronounHer2 : EN.pronounHis,
  // AUDIT 24 systems: MacroHelper.cs:240-245 registers ALL SIX
  // capitalized forms, each CapFirst over the same source method as
  // its lowercase twin (Pronoun3Cap :1355-1359 and friends). The port
  // carried only %G, so the corpus's fourteen %G3 lines and one %G1
  // line rendered the literal "%G3[undefined]" / "%G1[undefined]"
  // through the getContextValue miss arm.
  '%G': (mcp) => cap(call(mcp, 'pronoun')),
  '%G1': (mcp) => cap(call(mcp, 'pronoun')),
  '%G2': (mcp) => cap(call(mcp, 'pronoun2')),
  '%G2self': (mcp) => cap(call(mcp, 'pronoun2self')),
  '%G3': (mcp) => cap(call(mcp, 'pronoun3')),
  '%G4': (mcp) => cap(call(mcp, 'pronoun4')),
  '%g': (mcp) => call(mcp, 'pronoun'),
  '%g1': (mcp) => call(mcp, 'pronoun'),
  '%g2': (mcp) => call(mcp, 'pronoun2'),
  '%g2self': (mcp) => call(mcp, 'pronoun2self'),
  '%g3': (mcp) => call(mcp, 'pronoun3'),
  '%g4': (mcp) => call(mcp, 'pronoun4'),
  '%n': (mcp) => call(mcp, 'name'),
  '%nam': (mcp) => call(mcp, 'name'),
  '%fn': (mcp) => call(mcp, 'femaleName'),
  '%mn': (mcp) => call(mcp, 'maleName'),
  '%kno': (mcp) => call(mcp, 'factionOrderName'),
  '%oth': (mcp) => call(mcp, 'oath'),
  '%god': (mcp) => call(mcp, 'god'),
  '%di': (mcp) => call(mcp, 'direction'),
  '%qdt': (mcp) => call(mcp, 'questDate'),
  '%qdat': (mcp) => call(mcp, 'questDate'),
  '%vcn': (mcp) => call(mcp, 'vampireNpcClan'),
  '%hrn': (mcp) => call(mcp, 'homeRegion'),

  // ── M-X (2026-08-27): THE REST OF MacroHelper's TABLE ──────────
  // Every remaining row, in the C# handler's own shape. Three kinds:
  //  1. mcp CALL-THROUGHS - `mcp.GetMacroDataSource().X()` verbatim
  //     as call(mcp, 'x'); a source without the override answers the
  //     error ladder ([srcDataUnknown]), DFU's own behavior. The
  //     SOURCES land with their arcs: the biography MCP (%q block,
  //     %hpn/%hpw/%bn...), the spell-info MCP (%1am..%clm/%mpw), the
  //     bank MCP (%ml/%r2-4).
  //  2. PLAYER/WORLD GLOBALS off hooks - an absent hook answers null
  //     -> [nullMCP], the headless charter; the world members the
  //     talk arc has not mounted yet answer the same way.
  //  3. C#-null rows join NULL_HANDLERS below ([unhandled]).

  // the ATTRIBUTE block (Str..Luck, all mcp-sourced)
  '%str': (mcp) => call(mcp, 'str'),
  '%int': (mcp) => call(mcp, 'int'),
  '%wil': (mcp) => call(mcp, 'wil'),
  '%agi': (mcp) => call(mcp, 'agi'),
  '%end': (mcp) => call(mcp, 'end'),
  '%per': (mcp) => call(mcp, 'per'),
  '%spd': (mcp) => call(mcp, 'spd'),
  '%luc': (mcp) => call(mcp, 'luck'),
  '%ark': (mcp) => call(mcp, 'attributeRating'),

  // the PLAYER VITALS (globals off the entity hook)
  '%spc': (mcp, hooks) => str(hooks?.playerEntity?.()?.magicka),
  '%spt': (mcp, hooks) => str(hooks?.playerEntity?.()?.maxMagicka),
  '%enc': (mcp, hooks) => {
    const e = hooks?.playerEntity?.();
    return e ? String(entityMaxEncumbrance(e)) : null;
  },
  '%mad': (mcp, hooks) => {
    const e = hooks?.playerEntity?.();
    return e ? String(Math.floor(liveStat(e, 'willpower') / 10)) : null;   // PlayerEntity.MagicResist
  },
  // the four BIOGRAPHY-fed modifiers, in C#'s "+0;-0;0" signed format
  '%thd': (mcp, hooks) => signedOff(hooks, 'toHitModifier'),
  '%dam': (mcp, hooks) => signedOff(hooks, 'damageModifier'),
  '%hea': (mcp, hooks) => signedOff(hooks, 'hitPointsModifier'),
  '%hmd': (mcp, hooks) => signedOff(hooks, 'healingRateModifier'),
  // %ski - the first PRIMARY skill at permanent 100, else "BLANK"
  '%ski': (mcp, hooks) => {
    const e = hooks?.playerEntity?.();
    if (!e?.career?.primarySkills) return null;
    for (const id of e.career.primarySkills) {
      if (permanentSkillValue(e, id) === 100) return SKILL_NAMES[id] ?? String(id);
    }
    return 'BLANK';
  },

  // the DATE/TIME block (DaggerfallDateTime's own laws, off the
  // machine's nowSeconds clock)
  '%hour': (mcp, hooks) => str(nowDate(hooks)?.hour),
  '%min': (mcp, hooks) => str(nowDate(hooks)?.minute),
  '%tim': (mcp, hooks) => {
    const d = nowDate(hooks);
    return d ? `${String(d.hour).padStart(2, '0')}:${String(d.minute).padStart(2, '0')}` : null;   // MinTimeString
  },
  '%day': (mcp, hooks) => str(nowDate(hooks) && nowDate(hooks).day + 1),   // DayOfMonth is ONE-based (:626)
  '%dayn': (mcp, hooks) => { const d = nowDate(hooks); return d ? dayName(d) : null; },
  '%days': (mcp, hooks) => {
    const d = nowDate(hooks);
    return d ? `${d.day + 1}${daySuffix(d.day + 1)}` : null;   // DayOfMonthWithSuffix (:195-198)
  },
  '%mon': (mcp, hooks) => str(nowDate(hooks) && nowDate(hooks).month + 1),   // MonthOfYear, one-based
  '%monn': (mcp, hooks) => { const d = nowDate(hooks); return d ? monthName(d) : null; },
  '%year': (mcp, hooks) => str(nowDate(hooks)?.year),
  '%sea': (mcp, hooks) => { const d = nowDate(hooks); return d ? SEASON_NAMES[seasonValue(d)] : null; },
  '%sign': (mcp, hooks) => { const d = nowDate(hooks); return d ? birthSignName(d) : null; },

  // the PLAYER IDENTITY block
  '%pcl': (mcp, hooks) => {   // GetLastname: parts[1] or the whole name
    const name = hooks?.playerName?.();
    if (name == null) return null;
    const parts = name.split(' ');
    return parts.length > 1 ? parts[1] : name;
  },
  '%pg': (mcp, hooks) => pgender(hooks) ? EN.pronounShe : EN.pronounHe,   // %pg and %pg1 share PlayerPronoun
  '%pg1': (mcp, hooks) => pgender(hooks) ? EN.pronounShe : EN.pronounHe,
  '%pg2': (mcp, hooks) => pgender(hooks) ? EN.pronounHer : EN.pronounHim,
  '%pg2self': (mcp, hooks) => pgender(hooks) ? EN.pronounHerself : EN.pronounHimself,
  '%pg4': (mcp, hooks) => pgender(hooks) ? EN.pronounHers : EN.pronounHis2,

  // RANDOM NAMES (the mcp-less %ln off the current region's bank;
  // the mcp-sourced pairs ride the biography/talk sources)
  '%ln': (mcp, hooks) => {
    const w = hooks?.world;
    if (!w) return null;
    const bank = getNameBankOfRegion(w.currentRegionIndex?.() ?? -1);
    return surname(bank);
  },
  '%bn': (mcp) => call(mcp, 'name'),
  '%fn2': (mcp) => call(mcp, 'femaleName'),
  '%mn2': (mcp) => call(mcp, 'maleName'),
  '%imp': (mcp) => call(mcp, 'imperialName'),

  // REPUTATION AND MONEY (mcp-sourced except the legal-rep bands)
  '%ml': (mcp) => call(mcp, 'maxLoan'),
  '%r2': (mcp) => call(mcp, 'merchantsRep'),
  '%r3': (mcp) => call(mcp, 'scholarsRep'),
  '%r1': (mcp) => call(mcp, 'commonersRep'),
  '%r4': (mcp) => call(mcp, 'nobilityRep'),
  '%r5': (mcp) => call(mcp, 'underworldRep'),
  // %ltn - LegalReputation's fourteen bands, the exact C# chain
  // (:the > ladder then the < ladder; "unknown" is unreachable and
  // kept as the C# tail)
  '%ltn': (mcp, hooks) => {
    const rep = hooks?.world?.legalRepNow?.();
    if (rep == null) return null;
    if (rep > 80) return 'revered';
    if (rep > 60) return 'esteemed';
    if (rep > 40) return 'honored';
    if (rep > 20) return 'admired';
    if (rep > 10) return 'respected';
    if (rep > 0) return 'dependable';
    if (rep === 0) return 'a common citizen';
    if (rep < -80) return 'hated';
    if (rep < -60) return 'pond scum';
    if (rep < -40) return 'a villain';
    if (rep < -20) return 'a criminal';
    if (rep < -10) return 'a scoundrel';
    if (rep < 0) return 'undependable';
    return 'unknown';
  },

  // PLACE (globals over the world hook)
  '%lp': (mcp, hooks) => {   // LocalProvince: Breton region -> High Rock, else Hammerfell
    const race = hooks?.world?.currentRegionRace?.();
    if (race == null) return null;
    return race === LOCAL_PROVINCE_BRETON ? 'High Rock' : 'Hammerfell';
  },
  '%ct': (mcp, hooks) => {   // CityType's switch, verbatim strings
    const t = hooks?.world?.currentLocationType?.();
    if (t == null) return null;
    return CITY_TYPES[t] ?? String(t);
  },
  '%cn2': (mcp, hooks) => {   // the region's first OTHER TownCity
    const w = hooks?.world;
    const region = w?.maps?.getRegion?.(w.currentRegionIndex?.());
    if (!region?.mapTable) return null;
    const here = w.currentLocationIndex?.() ?? -1;
    for (let i = 0; i < region.mapTable.length; i++) {
      if (i !== here && region.mapTable[i].locationType === TOWN_CITY_TYPE) return region.mapNames?.[i] ?? null;
    }
    return null;
  },
  '%cbd': (mcp, hooks) => {   // CurrentBuilding: "[invalid]" outside
    const w = hooks?.world;
    if (!w) return null;
    return w.currentBuildingName?.() ?? '[invalid]';
  },
  '%nt': (mcp, hooks) => hooks?.world?.randomTavernName?.() ?? null,

  // THE TALK BLOCK (TalkManager's own getters; the talk arc mounts
  // them on the world hook - absent answers the charter's null).
  // C#'s OWN asymmetries kept: %fae reads GetFactionNPCEnemy exactly
  // as %fe does, and %fea reads GetFactionNPCAlly exactly as %fa.
  '%fa': (mcp, hooks) => hooks?.world?.factionNPCAlly?.() ?? null,
  '%fae': (mcp, hooks) => hooks?.world?.factionNPCEnemy?.() ?? null,
  '%fe': (mcp, hooks) => hooks?.world?.factionNPCEnemy?.() ?? null,
  '%fea': (mcp, hooks) => hooks?.world?.factionNPCAlly?.() ?? null,
  '%fnpc': (mcp, hooks) => hooks?.world?.factionNPC?.() ?? null,
  '%fpa': (mcp, hooks) => hooks?.world?.factionName?.() ?? null,
  '%fpc': (mcp, hooks) => hooks?.world?.factionPC?.() ?? null,
  '%fon': (mcp) => call(mcp, 'factionOrderName'),
  // the NEWS pair + their lords (SetFactionIdsAndRegionID's outs)
  '%fx1': (mcp, hooks) => (idFaction1 !== -1 ? hooks?.world?.getFactionData?.(idFaction1)?.name ?? null : null),
  '%fx2': (mcp, hooks) => (idFaction2 !== -1 ? hooks?.world?.getFactionData?.(idFaction2)?.name ?? null : null),
  '%fl1': (mcp, hooks) => hooks?.world?.lordNameForFaction?.(idFaction1) ?? null,
  '%fl2': (mcp, hooks) => hooks?.world?.lordNameForFaction?.(idFaction2) ?? null,
  '%lt1': (mcp, hooks) => {
    const fd = hooks?.world?.getFactionData?.(idFaction1);
    return fd ? rulerTitle(fd.ruler ?? 0) : null;
  },
  '%ol1': (mcp, hooks) => hooks?.world?.lordNameForFaction?.(idFaction1, true) ?? null,
  '%olf': (mcp, hooks) => hooks?.world?.oldLeaderFate?.(randomRangeInclusive(0, 4)) ?? null,

  // the mcp-sourced singles
  '%gdd': (mcp) => call(mcp, 'godDesc'),
  '%dae': (mcp) => call(mcp, 'daedra'),
  '%dng': (mcp) => call(mcp, 'dungeon'),
  '%hpn': (mcp) => call(mcp, 'homeProvinceName'),
  '%hpw': (mcp) => call(mcp, 'geographicalFeature'),
  '%lev': (mcp) => call(mcp, 'guildTitle'),   // %lev shares GuildTitle with %pct, minus its player-name fallback

  // the SPELL-INFO block (the spell bundle's MCP - the spellbook
  // info arc mounts the source)
  '%1am': (mcp) => call(mcp, 'magnitudePlusMin'),
  '%1bm': (mcp) => call(mcp, 'magnitudeBaseMin'),
  '%2am': (mcp) => call(mcp, 'magnitudePlusMax'),
  '%2bm': (mcp) => call(mcp, 'magnitudeBaseMax'),
  '%ach': (mcp) => call(mcp, 'chancePlus'),
  '%adr': (mcp) => call(mcp, 'durationPlus'),
  '%bch': (mcp) => call(mcp, 'chanceBase'),
  '%bdr': (mcp) => call(mcp, 'durationBase'),
  '%clc': (mcp) => call(mcp, 'chancePerLevel'),
  '%cld': (mcp) => call(mcp, 'durationPerLevel'),
  '%clm': (mcp) => call(mcp, 'magnitudePerLevel'),
  '%mpw': (mcp) => call(mcp, 'magicPowers'),   // token-level in C#; the string arm until the spell MCP lands (recorded)
};

// M-X: the BIOGRAPHY %q block - Q1..Q12 with the a/b arms (C# has
// all thirty-six), every one `mcp.GetMacroDataSource().Qx()` (the
// biography MCP is its arc's).
for (let n = 1; n <= 12; n++) {
  for (const suffix of ['', 'a', 'b']) HANDLERS[`%q${n}${suffix}`] = (mcp) => call(mcp, `q${n}${suffix}`);
}

// M-X helper laws
const str = (v) => (v == null ? null : String(v));
const signedFmt = (n) => (n > 0 ? `+${n}` : String(n));   // C#'s "+0;-0;0"
const signedOff = (hooks, field) => {
  const e = hooks?.playerEntity?.();
  return e ? signedFmt(e[field] ?? 0) : null;
};
const pgender = (hooks) => hooks?.playerGender?.() === 'female';
/** hooks.nowSeconds is EPOCH-RELATIVE (classic minutes x 60), so the
 *  epoch goes back on before the date is read - otherwise %year answers
 *  1 where DFU's WorldTime.Now.Year answers 405. The epoch is exactly
 *  404 x 360-day years, so every other field is unmoved by this. */
const nowDate = (hooks) => {
  const sec = hooks?.nowSeconds?.();
  return sec == null ? null : dateFromSeconds(CLASSIC_EPOCH_IN_SECONDS + sec);
};
/** GetSuffix (DaggerfallDateTime.cs:641-651), on the ONE-based day. */
const daySuffix = (day) => (day === 1 || day === 21 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th');
/** RaceTemplate ID 1 = Breton (the bridge's currentRegionRace answers
 *  REGION_RACES + 1, RaceTemplate ids). */
const LOCAL_PROVINCE_BRETON = 1;
/** DFRegion.LocationTypes.TownCity (mapsFile.LOCATION_TYPES). */
const TOWN_CITY_TYPE = 0;
/** CityType's switch (MacroHelper %ct), the Internal_Strings values
 *  over mapsFile.LOCATION_TYPES' real ids: TownCity 0 city,
 *  TownHamlet 1 hamlet, TownVillage 2 village, HomeFarms 3 farm,
 *  HomePoor 11 shack, HomeWealthy 8 manor, Tavern 6 community,
 *  ReligionTemple 5 temple, ReligionCult 9 shrine; everything else
 *  falls to the enum's own name-string arm (the default:). */
const CITY_TYPES = Object.freeze({
  0: 'city', 1: 'hamlet', 2: 'village', 3: 'farm',
  11: 'shack', 8: 'manor', 6: 'community', 5: 'temple', 9: 'shrine',
});


// C#'s table carries these with a NULL handler - '[unhandled]'.
const NULL_HANDLERS = new Set(['%1hn', '%2hn', '%3hn', '%cbl', '%dts', '%ef',
  // M-X: the rest of C#'s null rows - each renders [unhandled], verbatim
  '%hol', '%hrg', '%htwn', '%key2', '%mit', '%on', '%pdg', '%plq', '%pnq',
  '%ptm', '%qot', '%vn', '%wpn']);

/** M-X: the coverage gate's surface - the table's whole membership,
 *  so test/macrocoverage.test.js can diff it against MacroHelper.cs
 *  itself and the count can never silently rot. */
export const macroTableCoverage = () => ({ handled: Object.keys(HANDLERS), nulls: [...NULL_HANDLERS] });

/** MacroHelper.GetValue (MacroHelper.cs:502-528): the error-shape
 *  ladder, verbatim. mcp/mcp2 are {quest, source} bundles or null. */
export function getContextValue(symbolStr, quest, hooks) {
  const mcp = quest ? { quest, source: questMacroSource(quest) } : null;
  const mcp2 = quest?.externalMCP ?? null;
  if (NULL_HANDLERS.has(symbolStr)) return symbolStr + '[unhandled]';
  const handler = HANDLERS[symbolStr];
  if (!handler) return symbolStr + '[undefined]';
  const try1 = handler(mcp, hooks);
  if (try1 !== NOT_IMPLEMENTED) {
    return try1 != null ? try1 : symbolStr + '[nullMCP]';
  }
  const try2 = handler(mcp2, hooks);
  if (try2 !== NOT_IMPLEMENTED && try2 != null) return try2;
  return symbolStr + '[srcDataUnknown]';
}

// ---- ExpandQuestMessage (QuestMacroHelper.cs:91-160) ----

/** Expands macros inside message tokens IN PLACE. revealDialogLinks
 *  feeds the talk window's dialog table on NameMacro1 expansions
 *  (true only for talk answers and quest popups, as C# documents).
 *  The grammar pass is DefaultGrammarRules' identity and is skipped. */
export function expandQuestMessage(parentQuest, tokens, revealDialogLinks = false) {
  for (const token of tokens) {
    if (!token.text) continue;
    const words = token.text.split(' ');
    for (let w = 0; w < words.length; w++) {
      const macro = getMacro(words[w]);
      if (macro.type === MACRO_TYPES.None) continue;
      if (macro.type === MACRO_TYPES.ContextMacro) {
        words[w] = words[w].replace(macro.token, getContextValue(macro.token, parentQuest, parentQuest?.hooks));
        continue;
      }
      // the parentQuest-null bail (a DFU forum-bug fix, kept)
      if (!parentQuest) return;
      const resource = parentQuest.getResource({ name: macro.symbol });
      if (!resource) continue;
      const result = resource.expandMacro?.(macro.type);
      if (typeof result === 'string') words[w] = words[w].replace(macro.token, result);
      if (revealDialogLinks && macro.type === MACRO_TYPES.NameMacro1) {
        const hooks = parentQuest.hooks;
        // AUDIT 24 systems: the reveal arms take the THREE-argument
        // overload (QuestMacroHelper.cs:131/:135/:139 and :218/:222/
        // :226), whose instantRebuildTopicLists defaults to TRUE
        // (TalkManager.cs:2222) - so the open talk window's listbox
        // refreshes on the spot. Only the AddDialog quest ACTION
        // passes false (AddDialog.cs:73), and actions.js still does.
        if (resource.isPlace) hooks?.addDialog?.(parentQuest.uid, macro.symbol, 'Location');
        else if (resource.isPerson) hooks?.addDialog?.(parentQuest.uid, macro.symbol, 'Person');
        else if (resource.isItem) hooks?.addDialog?.(parentQuest.uid, macro.symbol, 'Thing');
      }
    }
    token.text = words.join(' ');
  }
}

/** ExpandLetterSignoff (QuestMacroHelper.cs:176-264): names a quest
 *  LETTER item from its message - the inventory arc's parchment
 *  label rides this (ItemHelper.ResolveItemLongName's quest-letter
 *  arm feeds tokens from getTextTokens(-1, roll, false)). Walks the
 *  tokens LAST to FIRST and keeps exactly ONE non-empty line (C#'s
 *  own `lines >= 1` break - its caller's comment says two, the code
 *  takes one, bug-for-bug). Name/details/faction/context/binding
 *  macros expand as the message pass does - NameMacro1 ALWAYS
 *  reveals the dialog link here (no revealDialogLinks gate) - but a
 *  location macro (__x_/___x_/____x_) replaces its WHOLE word with
 *  "...", swallowing any attached punctuation, verbatim. The
 *  accumulated line lands as `'Letter: ' + line + ' '` - the
 *  trailing space is C#'s `final.Trim() + " " + signoff` over the
 *  empty seed. A null quest throws out, as C#'s NRE does. */
export function expandLetterSignoff(parentQuest, tokens) {
  let signoff = '';
  let lines = 0;
  for (let t = tokens.length - 1; t >= 0; t--) {
    const words = (tokens[t].text ?? '').split(' ');
    for (let w = 0; w < words.length; w++) {
      const macro = getMacro(words[w]);
      switch (macro.type) {
        case MACRO_TYPES.NameMacro1:
        case MACRO_TYPES.DetailsMacro:
        case MACRO_TYPES.FactionMacro:
        case MACRO_TYPES.ContextMacro:
        case MACRO_TYPES.BindingMacro: {
          if (macro.type === MACRO_TYPES.ContextMacro) {
            words[w] = words[w].replace(macro.token, getContextValue(macro.token, parentQuest, parentQuest.hooks));
          } else {
            const resource = parentQuest.getResource({ name: macro.symbol });
            if (resource) {
              const result = resource.expandMacro?.(macro.type);
              if (typeof result === 'string') words[w] = words[w].replace(macro.token, result);
              if (macro.type === MACRO_TYPES.NameMacro1) {
                const hooks = parentQuest.hooks;
                if (resource.isPlace) hooks?.addDialog?.(parentQuest.uid, macro.symbol, 'Location');
                else if (resource.isPerson) hooks?.addDialog?.(parentQuest.uid, macro.symbol, 'Person');
                else if (resource.isItem) hooks?.addDialog?.(parentQuest.uid, macro.symbol, 'Thing');
              }
            }
          }
          break;
        }
        case MACRO_TYPES.NameMacro2:
        case MACRO_TYPES.NameMacro3:
        case MACRO_TYPES.NameMacro4:
          words[w] = '...';
          break;
      }
    }
    const final = words.join(' ');
    if (final.length > 0) {
      signoff = final.trim() + ' ' + signoff;
      lines++;
    }
    if (lines >= 1) break;
  }
  return EN.letterPrefix + signoff;
}

/** ExpandQuestString (QuestMacroHelper.cs:162-169): one context
 *  macro in a bare string. */
export function expandQuestString(parentQuest, questString) {
  const macro = getMacro(questString);
  if (macro.type !== MACRO_TYPES.ContextMacro) return questString;
  return questString.replace(macro.token, getContextValue(macro.token, parentQuest, parentQuest?.hooks));
}

/** GetMessageResources (QuestMacroHelper.cs:61-83): every resource a
 *  message's macros reference. */
export function getMessageResources(message) {
  if (!message) return null;
  const resources = [];
  const tokens = message.getTextTokens(-1, Math.random, false);
  for (const token of tokens) {
    if (!token.text) continue;
    for (const word of token.text.split(' ')) {
      const macro = getMacro(word);
      const resource = message.parentQuest?.getResource({ name: macro.symbol });
      if (resource) resources.push(resource);
    }
  }
  return resources;
}
