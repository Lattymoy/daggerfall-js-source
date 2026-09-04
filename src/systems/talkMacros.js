// TalkManagerMCP.cs, 1:1 (TK-v, completed by E7) - the macro data
// source ExpandRandomTextRecord hands every talk record to.
//
// This is the module that makes the arc's live slots OBSERVABLE. TK-iii
// found two TalkManager fields that exist only for the duration of one
// expansion - markLocationOnMap for %loc and greetingNameNPC for %n -
// and fixed the port to fill and clear them at C#'s moments. Nothing
// read them until now, because nothing had ported the reader. This is
// the reader.
//
// C#'s ExpandRandomTextRecord (:3580-3587) is three lines:
//   tokens = GetRandomTokens(recordIndex)
//   MacroHelper.ExpandMacros(ref tokens, this)   // this = TalkManagerMCP
//   return TokensToString(tokens, false)         // note: NO separator
//
// E7 (2026-09-02) - THE TABLE IS THE WHOLE TABLE. `ExpandMacros` runs
// MacroHelper's ONE macroHandlers dictionary - 217 rows - over every
// token it is handed, whatever the context provider is. This file used
// to carry a private table of twenty-six rows and answer everything
// else with the EMPTY STRING, so the ~190 other macros DFU renders for
// real were silently deleted out of talk records, and the four error
// shapes GetValue speaks were unreachable. It carries no table at all
// now: the port's one table is quest/questMacros.js (MacroHelper's home
// since M-X, completed to all 217 rows by E7) and this module supplies
// what C# supplies - the MCP.
//
// What a talk expansion is, in DFU's own three parts:
//   the DATA SOURCE   TalkManagerDataSource's THIRTEEN overrides
//                     (TalkManagerMCP.cs:41-199), below as
//                     talkMacroSource. Everything the base class does
//                     NOT override throws NotImplementedException,
//                     which is why %str, %q7b, %mat and the rest of
//                     the contextual table answer symbolStr +
//                     "[srcDataUnknown]" in a talk record - GetValue's
//                     second-provider retry lands on a null mcp2.
//   the GAME MANAGER  the GLOBAL rows read GameManager.Instance
//                     directly (PlayerEntity, PlayerGPS, WorldTime,
//                     TalkManager itself). The port's stand-in is the
//                     quest machine's macro hooks - ONE GameManager,
//                     as C# has - plus the TalkManager seams below,
//                     which the answer pipeline is.
//   the LADDER        MacroHelper.GetValue, questMacros' getMacroValue.
import { tokensToString } from './rumorMill.js';
import { QUESTION_TYPE } from './topicTree.js';
import { TALK_STRINGS } from './answerPipeline.js';
import { getMacroValue, macroTableCoverage } from './quest/questMacros.js';

/** Every symbol MacroHelper's dictionary carries, handled rows and
 *  C#-null rows alike - the set ExpandMacros can resolve. Read off
 *  the ONE table so the two can never drift. */
export const MACRO_SYMBOLS = Object.freeze((() => {
  const { handled, nulls } = macroTableCoverage();
  return [...handled, ...nulls];
})());

/** The symbols a TALK record resolves through the MCP's own data
 *  source - the thirteen overrides, and the rows C# points at them.
 *  Note the sharing: Name answers %n/%nam/%bn, FemaleName %fn/%fn2,
 *  MaleName %mn/%mn2, and each Pronoun answers its lowercase row AND
 *  its CapFirst twin (MacroHelper.cs:236-241). Everything else in the
 *  table is either a global or a source method the talk MCP does not
 *  override. */
export const TALK_MACROS = Object.freeze([
  '%n', '%nam', '%bn',
  '%fn', '%fn2', '%mn', '%mn2',
  '%di', '%hnt', '%hnt2', '%oth',
  '%g', '%g1', '%G', '%G1', '%g2', '%G2', '%g3', '%G3', '%g4', '%G4',
  '%pqn', '%pqp',
]);

/** The thirteen method names TalkManagerDataSource overrides
 *  (TalkManagerMCP.cs:49-199), in file order. */
export const TALK_SOURCE_METHODS = Object.freeze([
  'name', 'femaleName', 'maleName', 'direction', 'dialogHint',
  'dialogHint2', 'oath', 'pronoun', 'pronoun2', 'pronoun3', 'pronoun4',
  'potentialQuestorName', 'potentialQuestorLocation',
]);

/** MacroHelper's oath base (:201 + the faction race id), the same
 *  literal talkSession.js already carries for the mobile ladder. */
export const OATH_BASE_TEXT_ID = 201;

/**
 * TalkManagerDataSource (TalkManagerMCP.cs:41-199) - the MCP's own
 * thirteen answers. `ctx` carries the two engine objects and the
 * host's data seams:
 *   pipeline  - TK-iii's AnswerPipeline (the fields C# reads off
 *               TalkManager: currentQuestionListItem, greetingNameNPC,
 *               markLocationOnMap, locationOfRegionalBuilding)
 *   session   - TK-iv's NPCSession (npcRace, the questor pool)
 *   fullName(gender)          - NameHelper.FullName for the region
 *   randomFullName()          - MacroHelper.GetRandomFullName
 *   randomText(id)            - TextProvider.GetRandomText
 *   localizedText(key)        - TextManager
 *   raceOfCurrentRegion()     - PlayerGPS
 *   factionRaceId(race)       - RaceTemplate.GetFactionRaceFromRace
 *   bumpSeed(delta)           - DFRandom.Seed += / -= (MaleName's quirk)
 *   questorGender()           - TalkManagerContext.potentialQuestorGender
 * A method ABSENT from this object is C#'s MacroDataSource base
 * throwing NotImplementedException - the ladder's [srcDataUnknown]
 * arm - so the list must stay exactly the thirteen.
 */
export function talkMacroSource(ctx) {
  const text = (key) => ctx.localizedText?.(key) ?? TALK_STRINGS[key] ?? '';
  const item = () => ctx.pipeline?.currentQuestionListItem ?? null;
  const qt = () => item()?.questionType ?? null;
  const err = () => text('resolvingError');
  const female = () => ctx.questorGender?.() === 'female';

  return {
    /** Name (:49-56): "Used for greeting messages only: 7215, 7216,
     *  7217". THE %n SLOT - greetingNameNPC is live for exactly one
     *  expansion, and when it is empty the macro falls back to a
     *  RANDOM full name rather than to nothing. */
    name() {
      const greeting = ctx.pipeline?.greetingNameNPC ?? '';
      if (greeting) return greeting;
      return ctx.randomFullName?.() ?? null;
    },

    /** FemaleName (:58-62): a full name from the region's name bank. */
    femaleName() { return ctx.fullName?.('female') ?? null; },

    /** MaleName (:64-71). THE SEED NUDGE: C# adds 3547 to DFRandom's
     *  seed before drawing and subtracts it after, so a male name and
     *  a female name drawn in the same breath differ - and the stream
     *  is left exactly where it was found. */
    maleName() {
      ctx.bumpSeed?.(3547);
      const name = ctx.fullName?.('male') ?? null;
      ctx.bumpSeed?.(-3547);
      return name;
    },

    /** Direction (:73-80): the compass, for the two where-is types
     *  only. Everything else is the resolving error. */
    direction() {
      const t = qt();
      if (t === QUESTION_TYPE.LocalBuilding || t === QUESTION_TYPE.Person) {
        return ctx.pipeline.getKeySubjectLocationCompassDirection();
      }
      return err();
    },

    /** DialogHint (:82-101) and DialogHint2 (:103-122). The two differ
     *  in ONE arm - the quest types, where %hnt reads anyInfo and
     *  %hnt2 reads rumors (with the spymaster inversion inside). Every
     *  other arm is identical, which is why the building fork runs for
     *  both. */
    dialogHint() {
      const t = qt();
      if (t === QUESTION_TYPE.LocalBuilding) return ctx.pipeline.getKeySubjectBuildingHint();
      if (t === QUESTION_TYPE.Person) return ctx.pipeline.getKeySubjectPersonHint();
      if (t === QUESTION_TYPE.QuestLocation || t === QUESTION_TYPE.QuestPerson || t === QUESTION_TYPE.QuestItem) {
        return ctx.pipeline.getDialogHint(item());
      }
      if (t === QUESTION_TYPE.OrganizationInfo) return ctx.pipeline.getOrganizationInfo(item());
      return err();
    },
    dialogHint2() {
      const t = qt();
      if (t === QUESTION_TYPE.LocalBuilding) return ctx.pipeline.getKeySubjectBuildingHint();
      if (t === QUESTION_TYPE.Person) return ctx.pipeline.getKeySubjectPersonHint();
      if (t === QUESTION_TYPE.QuestLocation || t === QUESTION_TYPE.QuestPerson || t === QUESTION_TYPE.QuestItem) {
        return ctx.pipeline.getDialogHint2(item());
      }
      if (t === QUESTION_TYPE.OrganizationInfo) return ctx.pipeline.getOrganizationInfo(item());
      return err();
    },

    /** Oath (:124-137). DFU's own improvement, with its comment: the
     *  oath is chosen by the NPC's FACTION race id, where classic used
     *  the region's hardcoded race - which had every High Rock NPC
     *  swearing Nord oaths and every Hammerfell NPC swearing Khajiit
     *  ones. The NPC's race falls back to the region's when unset. */
    oath() {
      let race = ctx.session?.npcData?.race ?? null;
      if (!race) race = ctx.raceOfCurrentRegion?.() ?? null;
      const oathId = ctx.factionRaceId?.(race) ?? 0;
      return ctx.randomText?.(OATH_BASE_TEXT_ID + oathId) ?? null;
    },

    /** The four pronouns (:139-187), every one of them the POTENTIAL
     *  QUESTOR's gender - not the talk partner's. C#'s `default:`
     *  shares the Male case, so anything that is not Female is he.
     *  Pronoun2self is NOT overridden here, which is why %g2self in a
     *  talk record answers [srcDataUnknown]. */
    pronoun() { return text(female() ? 'pronounShe' : 'pronounHe'); },
    pronoun2() { return text(female() ? 'pronounHer' : 'pronounHim'); },
    pronoun3() { return text(female() ? 'pronounHer2' : 'pronounHis'); },
    pronoun4() { return text(female() ? 'pronounHers' : 'pronounHis2'); },

    /** PotentialQuestorName / PotentialQuestorLocation (:189-197).
     *  The location's key is **%pqp** - MacroHelper.cs:163, "Potential
     *  Quest Giver's Location". Not %pql, which is not a macro at all
     *  and would have left every record carrying the real one
     *  unresolved. */
    potentialQuestorName() { return ctx.session?.getQuestorName() ?? null; },
    potentialQuestorLocation() { return ctx.session?.getQuestorLocation() ?? null; },
  };
}

/**
 * The GameManager the GLOBAL rows read, for the duration of a talk
 * expansion. `ctx.hooks` is the host's one macro-hook bundle (the
 * quest machine's macroContext) - DFU has ONE GameManager and so does
 * the port - and this adds the rows whose singleton is
 * `GameManager.Instance.TalkManager`, which in this port is the
 * ANSWER PIPELINE. %key, %loc, %fcn, %hnr and %1com are static
 * MacroHelper handlers rather than the MCP's, but ExpandMacros runs
 * the whole table, so a talk record carrying them resolves them here.
 * With no pipeline they are simply absent and answer [nullMCP].
 */
export function talkMacroHooks(ctx) {
  const base = ctx?.hooks ?? {};
  const p = ctx?.pipeline ?? null;
  if (!p) return base;
  return {
    ...base,
    world: {
      ...(base.world ?? {}),
      // DialogKeySubject's four reads (MacroHelper.cs:1059-1083)
      talkKeySubjectType: () => p.currentKeySubjectType,
      talkKeySubject: () => p.currentKeySubject,
      talkWorkString: () => p.getWorkString(),
      talkCurrentQuestionListItem: () => p.currentQuestionListItem ?? null,
      // MarkLocationOnMap's flag and its SIDE EFFECT (:1085-1090)
      talkMarkLocationOnMap: () => p.markLocationOnMap,
      markKeySubjectLocationOnMap: () => p.markKeySubjectLocationOnMap(),
      // LocationOfRegionalBuilding (:1097-1100)
      talkLocationOfRegionalBuilding: () => p.locationOfRegionalBuilding,
      // Honorific (:890-893) -> TalkManager.GetHonoric (:1826-1832),
      // by the PLAYER's gender
      talkHonoric: () => p.getHonoric(ctx.playerGender?.() ?? base.playerGender?.() ?? ''),
      // GreetingOrFollowUpText (:957-960) -> GetPCGreetingOrFollowUpText
      // (TalkManager.cs:1149-1156), which reads TalkManager's three
      // live fields with no arguments at all: the current talk tone,
      // the reaction (the greeting addresses the NPC by name only
      // above 0, else by 7221+tone) and nameNPC.
      talkPCGreetingOrFollowUpText: () => p.getPCGreetingOrFollowUpText(
        ctx.toneIndex?.() ?? 1,
        ctx.session?.reactionToPlayer ?? 0,
        ctx.session?.nameNPC ?? '',
      ),
    },
  };
}

/** The talk MCP bound to one expansion: MacroHelper's whole table as
 *  niladic handlers, each already carrying GetValue's ladder - so a
 *  row the talk source does not override answers its sentinel rather
 *  than nothing. `%pql` is absent because it is not a DFU macro. */
export function talkMacroHandlers(ctx) {
  const mcp = { source: talkMacroSource(ctx) };
  const hooks = talkMacroHooks(ctx);
  const table = {};
  for (const symbol of MACRO_SYMBOLS) table[symbol] = () => getMacroValue(symbol, mcp, hooks);
  return table;
}

/** MacroHelper's macro terminators (:412). Any non-alpha character
 *  that can end a macro symbol lives here - which is what separates
 *  `%hnt2` from `%hnt` and `%g4` from `%g` WITHOUT any longest-first
 *  ordering: the scan simply runs to the next terminator. */
export const MACRO_TERMINATORS = Object.freeze([
  ' ', '%', '.', ',', "'", '?', '!', '/', '(', ')', '{', '}', '[', ']', '"', ';', ':', '|',
]);

/** MacroHelper.ExpandMacros (:419-494) over the talk MCP, verbatim.
 *
 *  THE MACRO CACHE is the piece worth reading twice. C# builds one
 *  dictionary per ExpandMacros CALL, with its own comment saying why:
 *  "used to ensure macros are only evaluated once per ExpandMacros()
 *  call. Important since some macros evaluate differently each time
 *  (e.g. macros with random generated names)". So a record naming
 *  `%fn` in two places names the SAME woman twice - and a port that
 *  re-evaluated per occurrence would introduce two.
 *
 *  THE PIPE IS EATEN (:472-475): `|` terminates a macro AND is
 *  swallowed, which is how `%di|ern` becomes "southern". Every other
 *  terminator is left in the text.
 *
 *  E7: A SYMBOL THE TABLE DOES NOT CARRY is `symbolStr +
 *  "[undefined]"` - GetValue's outermost else (:526-527) - not the
 *  empty string this walk used to substitute. That was the FLAG at
 *  :268, and it was blocked on exactly one thing: a 26-row table would
 *  have stamped `%xx[undefined]` across ~190 macros DFU renders for
 *  real. The table is all 217 rows now, so the shape is safe to speak
 *  and every one of the four sentinels is reachable. Handlers passed
 *  in directly (a test's two-row map) take the same arm.
 *
 *  The tokens are rewritten IN PLACE, as C#'s `ref` array is. */
export function expandTalkMacros(tokens, handlers) {
  const cache = new Map();
  const valueOf = (name) => {
    if (cache.has(name)) return cache.get(name);
    const v = name in handlers ? String(handlers[name]() ?? '') : `${name}[undefined]`;
    cache.set(name, v);
    return v;
  };
  for (const token of tokens ?? []) {
    const text = token?.text;
    if (typeof text !== 'string' || text.indexOf('%') < 0) continue;
    let out = '';
    let currentPos = 0;
    let macroPos;
    while ((macroPos = text.indexOf('%', currentPos)) >= 0) {
      // the scan starts ONE past the %, so `%.` names `%` and leaves
      // the full stop; and it stops AT the end of the string, which is
      // the guard that makes a trailing macro terminate at all
      let endPos = macroPos + 1;
      while (endPos < text.length && !MACRO_TERMINATORS.includes(text[endPos])) endPos++;
      out += text.slice(currentPos, macroPos);
      out += valueOf(text.slice(macroPos, endPos));
      currentPos = endPos;
      if (currentPos < text.length && text[currentPos] === '|') currentPos++;
    }
    out += text.slice(currentPos);
    token.text = out;
  }
  return tokens;
}

/** ExpandRandomTextRecord (:3580-3587), the three lines whole - and
 *  note the conversion passes FALSE, so an empty token contributes
 *  nothing rather than a space. Everything the arc answers with comes
 *  through here. */
export function expandRandomTextRecord(recordIndex, ctx) {
  const tokens = (ctx.randomTokens?.(recordIndex) ?? []).map((t) => ({ ...t }));
  expandTalkMacros(tokens, talkMacroHandlers(ctx));
  return tokensToString(tokens, false);
}
