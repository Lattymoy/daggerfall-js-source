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
// missing from the table renders `%x[undefined]` - the corpus's 14
// `%G3` and 1 `%G1` lines really do render that way in DFU, only %G
// has a capitalized handler; a null table entry renders
// `%x[unhandled]`; a handler answering null renders `%x[nullMCP]`;
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
import { GENDERS, getNameBankOfRegion, fullName, getNameBank } from '../../characters/nameHelper.js';

// FactionRaces number -> race key (FactionFile.cs:609-624 through
// RaceTemplate.GetRaceFromFactionRace; unmapped falls to Breton in
// getNameBank's default arm, as C#'s None does).
const FACTION_RACE_KEYS = Object.freeze({
  0: 'Nord', 1: 'Khajiit', 2: 'Redguard', 3: 'Breton',
  4: 'Argonian', 5: 'WoodElf', 6: 'HighElf', 7: 'DarkElf',
});
import { dateFromSeconds, dateString } from '../gameDate.js';

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
  comma: ', ',
  resolvingError: 'Resolving Error',
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
    // %oth - by the questor's FACTION race (DFU's fix over classic's
    // region race); the seam speaks TEXT.RSC 201+oathId
    oath() {
      let race = -1;   // FactionRaces number, the port's carrier
      const questors = [...(quest.questors?.keys() ?? [])];
      if (questors.length > 0) race = quest.getPerson({ name: questors[0] })?.factionRace ?? -1;
      else {
        const clicked = quest.hooks?.lastNPCClicked?.();
        if (clicked) race = clicked.race ?? -1;
      }
      if (race === -1) race = world()?.currentRegionRace?.() ?? -1;
      return world()?.getRandomText?.(201 + race) ?? null;
    },
    homeRegion() {
      const last = quest.lastResourceReferenced;
      return last?.isPerson ? (last.homeRegionName ?? '') : '';
    },
    // %god - the temple the player stands in, else a random divine
    god() {
      const w = world();
      const inside = w?.playerInside?.();
      if (inside?.building?.buildingType === 14 && inside.building.factionId) {   // Temple
        const name = w?.divineOfTempleFaction?.(inside.building.factionId);
        if (name) return name;
      }
      return DIVINES[Math.floor((quest.rolls ?? Math.random)() * 9)];   // Range(0,9) on the quest's rolls
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
  '%rt': (mcp, hooks) => {
    const w = hooks?.world;
    const region = w?.findFactionByTypeAndRegion?.(7, w.currentRegionIndex?.());
    if (!region) return null;
    return rulerTitle(region.ruler);
  },
  '%t': (mcp, hooks) => HANDLERS['%rt'](mcp, hooks),
  // %nrn: the faction's first Individual child, else the SEEDED lord
  // name (rulerNameSeed & 0xffff; even rulers are female)
  '%nrn': (mcp, hooks) => {
    const w = hooks?.world;
    const fd = w?.getFactionData?.(w?.currentRegionFaction?.());
    if (!fd) return null;
    if (fd.children?.length > 0) {
      const firstChild = w.getFactionData?.(fd.children[0]);
      if (firstChild?.type === 4) return firstChild.name;
    }
    const gender = (fd.ruler + 1) % 2;   // C#: (Genders)((ruler+1)%2) - even rulers are female
    srand((fd.rulerNameSeed ?? 0) & 0xffff);
    return fullName(getNameBank(FACTION_RACE_KEYS[fd.race]), gender);
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
};

// C#'s table carries these with a NULL handler - '[unhandled]'.
const NULL_HANDLERS = new Set(['%1hn', '%2hn', '%3hn', '%cbl', '%dts', '%ef']);

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
