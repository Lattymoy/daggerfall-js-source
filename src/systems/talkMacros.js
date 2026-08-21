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
  '%g4', '%g3', '%g2', '%g', '%pqn', '%pql',
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

    /** PotentialQuestorName / PotentialQuestorLocation (:197-205). */
    '%pqn': () => ctx.session?.getQuestorName() ?? '',
    '%pql': () => ctx.session?.getQuestorLocation() ?? '',
  };
}

/** MacroHelper.ExpandMacros over the talk MCP: every token's text is
 *  scanned for the handlers' tokens, longest first so %hnt2 is not
 *  eaten by %hnt and %g4 not by %g. C# resolves in GetMacro's
 *  alternation order, which is the same intent. The tokens are
 *  rewritten IN PLACE, as C#'s `ref` array is. */
export function expandTalkMacros(tokens, handlers) {
  const names = Object.keys(handlers).sort((a, b) => b.length - a.length);
  for (const token of tokens ?? []) {
    if (!token || typeof token.text !== 'string' || token.text === '') continue;
    let out = token.text;
    for (const name of names) {
      if (!out.includes(name)) continue;
      // resolved ONCE per record, as MacroHelper resolves per token
      const value = String(handlers[name]() ?? '');
      out = out.split(name).join(value);
    }
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
