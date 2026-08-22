// TalkManagerMCP.cs, 1:1 (TK-v) - the macro data source
// ExpandRandomTextRecord hands every talk record to.
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
// The handlers below are that MCP. Each is named for its C# override,
// and every one of them reads the pipeline or the session rather than
// a copy of its own.
import { tokensToString } from './rumorMill.js';
import { QUESTION_TYPE } from './topicTree.js';
import { TALK_STRINGS } from './answerPipeline.js';

/** The %-macro tokens MacroHelper resolves through the talk MCP, in
 *  the order GetMacro's alternation reaches them. */
export const TALK_MACROS = Object.freeze([
  '%n', '%fn', '%mn', '%di', '%hnt2', '%hnt', '%oth',
  '%g4', '%g3', '%g2', '%g', '%pqn', '%pqp',
  // TK-vi: the three MacroHelper GLOBALS that read TalkManager's own
  // fields. They are not "the talk MCP's" - DialogKeySubject
  // (MacroHelper.cs:1059-1083), MarkLocationOnMap (:1085-1090) and
  // LocationOfRegionalBuilding (:1097-1100) are static handlers that
  // reach GameManager.Instance.TalkManager directly - but
  // ExpandRandomTextRecord runs the WHOLE table, so a talk record
  // carrying them resolves them. The port's expansion answered the
  // empty string for all three, which silently deleted the building
  // name from every direction and map-reveal answer and dropped %loc's
  // map-marking SIDE EFFECT with it.
  '%key', '%loc', '%fcn',
]);

/** MacroHelper's oath base (:201 + the faction race id), the same
 *  literal talkSession.js already carries for the mobile ladder. */
export const OATH_BASE_TEXT_ID = 201;

/** The talk MCP's handler table. `ctx` carries the two engine objects
 *  and the host's data seams:
 *    pipeline  - TK-iii's AnswerPipeline (the fields C# reads off
 *                TalkManager: currentQuestionListItem, greetingNameNPC,
 *                markLocationOnMap, locationOfRegionalBuilding)
 *    session   - TK-iv's NPCSession (npcRace, the questor pool)
 *    fullName(gender)          - NameHelper.FullName for the region
 *    randomText(id)            - TextProvider.GetRandomText
 *    localizedText(key)        - TextManager
 *    raceOfCurrentRegion()     - PlayerGPS
 *    factionRaceId(race)       - RaceTemplate.GetFactionRaceFromRace
 *    bumpSeed(delta)           - DFRandom.Seed += / -= (MaleName's quirk)
 */
export function talkMacroHandlers(ctx) {
  const text = (key) => ctx.localizedText?.(key) ?? TALK_STRINGS[key] ?? '';
  const item = () => ctx.pipeline?.currentQuestionListItem ?? null;
  const qt = () => item()?.questionType ?? null;
  const err = () => text('resolvingError');

  return {
    /** Name (:51-58): "Used for greeting messages only: 7215, 7216,
     *  7217". THE %n SLOT - greetingNameNPC is live for exactly one
     *  expansion, and when it is empty the macro falls back to a
     *  RANDOM full name rather than to nothing. */
    '%n': () => {
      const greeting = ctx.pipeline?.greetingNameNPC ?? '';
      if (greeting) return greeting;
      return ctx.randomFullName?.() ?? '';
    },

    /** FemaleName (:60-64): a full name from the region's name bank. */
    '%fn': () => ctx.fullName?.('female') ?? '',

    /** MaleName (:66-73). THE SEED NUDGE: C# adds 3547 to DFRandom's
     *  seed before drawing and subtracts it after, so a male name and
     *  a female name drawn in the same breath differ - and the stream
     *  is left exactly where it was found. */
    '%mn': () => {
      ctx.bumpSeed?.(3547);
      const name = ctx.fullName?.('male') ?? '';
      ctx.bumpSeed?.(-3547);
      return name;
    },

    /** Direction (:75-82): the compass, for the two where-is types
     *  only. Everything else is the resolving error. */
    '%di': () => {
      const t = qt();
      if (t === QUESTION_TYPE.LocalBuilding || t === QUESTION_TYPE.Person) {
        return ctx.pipeline.getKeySubjectLocationCompassDirection();
      }
      return err();
    },

    /** DialogHint (:84-103) and DialogHint2 (:105-131). The two differ
     *  in ONE arm - the quest types, where %hnt reads anyInfo and
     *  %hnt2 reads rumors (with the spymaster inversion inside). Every
     *  other arm is identical, which is why the building fork runs for
     *  both. */
    '%hnt': () => {
      const t = qt();
      if (t === QUESTION_TYPE.LocalBuilding) return ctx.pipeline.getKeySubjectBuildingHint();
      if (t === QUESTION_TYPE.Person) return ctx.pipeline.getKeySubjectPersonHint();
      if (t === QUESTION_TYPE.QuestLocation || t === QUESTION_TYPE.QuestPerson || t === QUESTION_TYPE.QuestItem) {
        return ctx.pipeline.getDialogHint(item());
      }
      if (t === QUESTION_TYPE.OrganizationInfo) return ctx.pipeline.getOrganizationInfo(item());
      return err();
    },
    '%hnt2': () => {
      const t = qt();
      if (t === QUESTION_TYPE.LocalBuilding) return ctx.pipeline.getKeySubjectBuildingHint();
      if (t === QUESTION_TYPE.Person) return ctx.pipeline.getKeySubjectPersonHint();
      if (t === QUESTION_TYPE.QuestLocation || t === QUESTION_TYPE.QuestPerson || t === QUESTION_TYPE.QuestItem) {
        return ctx.pipeline.getDialogHint2(item());
      }
      if (t === QUESTION_TYPE.OrganizationInfo) return ctx.pipeline.getOrganizationInfo(item());
      return err();
    },

    /** Oath (:133-144). DFU's own improvement, with its comment: the
     *  oath is chosen by the NPC's FACTION race id, where classic used
     *  the region's hardcoded race - which had every High Rock NPC
     *  swearing Nord oaths and every Hammerfell NPC swearing Khajiit
     *  ones. The NPC's race falls back to the region's when unset. */
    '%oth': () => {
      let race = ctx.session?.npcData?.race ?? null;
      if (!race) race = ctx.raceOfCurrentRegion?.() ?? null;
      const oathId = ctx.factionRaceId?.(race) ?? 0;
      return ctx.randomText?.(OATH_BASE_TEXT_ID + oathId) ?? '';
    },

    /** The four pronouns (:146-194), every one of them the POTENTIAL
     *  QUESTOR's gender - not the talk partner's. C#'s `default:`
     *  shares the Male case, so anything that is not Female is he. */
    '%g': () => text(ctx.questorGender?.() === 'female' ? 'pronounShe' : 'pronounHe'),
    '%g2': () => text(ctx.questorGender?.() === 'female' ? 'pronounHer' : 'pronounHim'),
    '%g3': () => text(ctx.questorGender?.() === 'female' ? 'pronounHer2' : 'pronounHis'),
    '%g4': () => text(ctx.questorGender?.() === 'female' ? 'pronounHers' : 'pronounHis2'),

    /** DialogKeySubject (:1059-1083) - %key. The switch is on the
     *  key-subject TYPE, and four of its six arms answer the same
     *  field; Work goes through GetWorkString and QuestTopic prefers
     *  the current list item's caption, falling back to the field when
     *  there is no item. Unset (and C#'s shared `default:`) is ''. */
    '%key': () => {
      const p = ctx.pipeline;
      if (!p) return '';
      switch (p.currentKeySubjectType) {
        case 'Building':
        case 'Person':
        case 'Thing':
        case 'Organization':
          return p.currentKeySubject;
        case 'Work':
          return p.getWorkString();
        case 'QuestTopic':
          return item() != null ? item().caption : p.currentKeySubject;
        default:
          return '';
      }
    },

    /** MarkLocationOnMap (:1085-1090) - %loc. THE SIDE EFFECT LIVES IN
     *  THE MACRO: the map is revealed only when the answer being
     *  expanded is the map-reveal record, which is what
     *  GetKeySubjectBuildingOnMap's flag says, and the macro answers
     *  the key subject either way. Nystul's own comment on the table
     *  row says it: "it seems to return the name of the building and
     *  reveal the map only if a 7332 dialog was chosen". */
    '%loc': () => {
      const p = ctx.pipeline;
      if (!p) return '';
      if (p.markLocationOnMap) p.markKeySubjectLocationOnMap();
      return p.currentKeySubject;
    },

    /** LocationOfRegionalBuilding (:1097-1100) - %fcn, the town the
     *  regional-building answer named. */
    '%fcn': () => ctx.pipeline?.locationOfRegionalBuilding ?? '',

    /** PotentialQuestorName / PotentialQuestorLocation (:197-205).
     *  The location's key is **%pqp** - MacroHelper.cs:163, "Potential
     *  Quest Giver's Location". Not %pql, which is not a macro at all
     *  and would have left every record carrying the real one
     *  unresolved. */
    '%pqn': () => ctx.session?.getQuestorName() ?? '',
    '%pqp': () => ctx.session?.getQuestorLocation() ?? '',
  };
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
 *  Unknown macros resolve through the same path and answer whatever
 *  the handler table has for them - here, nothing, which leaves the
 *  symbol replaced by the empty string exactly as MacroHelper's own
 *  missing-handler path does.
 *
 *  The tokens are rewritten IN PLACE, as C#'s `ref` array is. */
export function expandTalkMacros(tokens, handlers) {
  const cache = new Map();
  const valueOf = (name) => {
    if (cache.has(name)) return cache.get(name);
    const v = String(handlers[name]?.() ?? '');
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
