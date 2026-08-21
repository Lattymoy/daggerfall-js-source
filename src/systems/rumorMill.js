// THE RUMOR MILL (TK-i) - TalkManager.cs's rumor family whole (MIT,
// Daggerfall Workshop): RumorMillEntry (:349-361), the mill list +
// the questor-post dictionary (:363-366), ImportClassicRumor /
// AddNonQuestRumor / GetFlagsForNewRumor / RefreshRumorMill /
// SetupRumorMill (:2665-2749), GetValidRumors (:1468-1519),
// WeightedRandomRumor (:1450-1466), GetNewsOrRumors (:1388-1440),
// GetNewsOrRumorsForBulletinBoard (:1355-1386), the six QUEST seams
// (:1558-1690) and TokensToString (:3561-3578). This is the CONSUMER
// of the quest machine's addQuestRumor / addProgressRumor /
// addQuestorPostMessage / remove* hooks - the bridge stops dropping
// them on the floor.
//
// TWO TOKEN DIALECTS ride the mill, exactly as C# has one Token type
// with two producers: quest rumors carry the QUEST message tokens
// (string formattings, questMacros' charter) and classic/non-quest
// rumors carry TEXT.RSC tokens (textRsc.readTokens' numeric codes).
// Each is consumed only by its own arm - the mill stores both
// opaquely.
//
// KEPT QUIRKS, each by C# line:
//   - THE REFRESH CULL (:2742): RefreshRumorMill removes every entry
//     with timeLimit < now - and the QUEST entries never set a
//     timeLimit, so their 0 dies on the first sweep. The sweep fires
//     from PlayerEntity.RegionPowerAndConditionsUpdate (:1630, the
//     every-few-days regional sim), meaning DFU's quest rumors
//     survive only days. Verbatim, pinned.
//   - THE BULLETIN HOLE: ImportClassicRumor (:2683-2692) never sets
//     textID, and the bulletin filter matches textID against the
//     allowed ids - an imported classic rumor can never appear on a
//     board.
//   - ImportClassicRumor parses the text BEFORE its three skip gates
//     (:2672-2681) - order kept.
//   - The empty-list overload (:1584): AddQuestRumorToRumorMill with
//     zero variant token lists silently adds NOTHING.
//   - AddOrReplaceQuestProgressRumor's replace arm (:1628-1632)
//     swaps ONLY the variants - the found entry keeps whatever
//     faction/region/flags it carried.
//   - GetNewsOrRumors' 'news' initial (:1393) is the localized
//     resolvingError literal '...never mind...' - a CommonRumor with
//     null variants answers it AND spends the NPC's one answer.
//
// deps (host wires; absent members idle LOUDLY per the charter):
//   nowClassicMinutes()   - ToClassicDaggerfallTime (the ONE clock's
//                           minutes ARE classic minutes)
//   getFactionData(id)    - the persistent store record | null
//   currentRegionIndex()
//   getRandomTokens(textId) - TextProvider.GetRandomTokens: ONE
//                           random TEXT.RSC variant as tokens,
//                           frozen at add time
//   expandCommonTokens(tokens, {faction1, faction2, regionID})
//                         - MacroHelper.ExpandMacros bracketed by
//                           SetFactionIdsAndRegionID (TK-iii's macro
//                           context; absent = tokens pass through,
//                           recorded)
//   expandQuestTokens(questID, tokens) - QuestMacroHelper.
//                           ExpandQuestMessage with reveal TRUE then
//                           TokensToString (the bridge wires the
//                           machine + questMacros); must not mutate
//   expandRandomTextRecord(recordIndex) - the out-of-news 1457
//   resolvingError()      - TextManager 'resolvingError'
//                           ('...never mind...')
//   npcsKnowEverything()  - the debug setting (default false)
//   questRumorWeight      - DaggerfallUnity.Settings.QuestRumorWeight
//                           (default 50)
//   rolls                 - Math.random-compatible (Random.Range +
//                           Dice100)

import { dice100 } from '../combat/formulas.js';

/** TalkManager.RumorType (:341-346). */
export const RUMOR_TYPE = Object.freeze({ CommonRumor: 0, QuestProgressRumor: 1, QuestRumorMill: 2 });

/** allowedBulletinTextIds (:121). */
export const ALLOWED_BULLETIN_TEXT_IDS = Object.freeze([1475, 1476, 1477, 1478, 1479, 1482, 1483]);

/** GetNewsOrRumors' outOfNewsRecordIndex (:1390). */
export const OUT_OF_NEWS_RECORD_INDEX = 1457;

/** maxNumAnswersNpcGivesTellMeAboutOrRumors (:125). */
export const MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS = 1;

/** AddNonQuestRumor's TTL (:2711): now + 43140 classic minutes (a
 *  hair under 30 days - the literal, not 43200). */
export const NON_QUEST_RUMOR_TTL_MINUTES = 43140;

/** The QuestRumorWeight setting's shipped default. */
export const DEFAULT_QUEST_RUMOR_WEIGHT = 50;

/** The resolvingError literal (Internal_Strings en id 425). */
export const RESOLVING_ERROR = '...never mind...';

/** TokensToString (:3561-3578): text fragments append; an empty or
 *  missing text appends the separator - ' ' by default, '' when
 *  addSpaceAtTokenEnd is false. */
export function tokensToString(tokens, addSpaceAtTokenEnd = true) {
  const separator = addSpaceAtTokenEnd ? ' ' : '';
  let out = '';
  for (const token of tokens ?? []) {
    out += (token.text != null && token.text !== '') ? token.text : separator;
  }
  return out;
}

export class RumorMill {
  constructor(deps = {}) {
    this.deps = deps;
    this.listRumorMill = [];
    this.dictQuestorPostQuestMessage = new Map();
  }

  _rolls() { return this.deps.rolls ?? Math.random; }
  _now() { return this.deps.nowClassicMinutes?.() ?? 0; }
  /** Random.Range(0, n) - int, exclusive top. */
  _range(n) { return Math.floor(this._rolls()() * n); }

  // SetupRumorMill (:2745-2749) only guards a NULL list; the JS list
  // is never null, so the add-side `null || Count == 0` calls
  // (:1563, :1581, :1600) are structurally satisfied - recorded, no
  // code to carry.

  /** ImportClassicRumor (:2665-2693). `rumor` is a rumorFile.js
   *  record; `readTokens(rumorText)` is injected so the format layer
   *  stays with the caller (the host passes textRsc.readTokens over
   *  the byte payload). The token parse runs BEFORE the three skip
   *  gates, C#'s own order. */
  importClassicRumor(rumor, readTokens) {
    const tokens = readTokens(rumor.rumorText);
    if ((rumor.flags & 4) !== 0) return;   // a quest rumor - not imported
    if ((rumor.flags & 1) !== 0) return;   // a sign message - not imported
    if (rumor.npcID !== 0) return;         // an NPC-specific post-quest greeting - not imported
    this.listRumorMill.push({
      rumorType: RUMOR_TYPE.CommonRumor,
      listRumorVariants: [tokens],
      questID: 0,
      timeLimit: rumor.timeLimit,
      faction1: rumor.faction1,
      faction2: rumor.faction2,
      regionID: rumor.regionID,
      flags: rumor.flags,
      type: rumor.type,
      textID: 0,   // THE BULLETIN HOLE: never set on imports
    });
  }

  /** AddNonQuestRumor (:2695-2715). */
  addNonQuestRumor(faction1, faction2, regionID, type, textId) {
    const tokens = this.deps.getRandomTokens?.(textId) ?? [];
    this.listRumorMill.push({
      rumorType: RUMOR_TYPE.CommonRumor,
      listRumorVariants: [tokens],
      questID: 0,
      timeLimit: this._now() + NON_QUEST_RUMOR_TTL_MINUTES,
      faction1, faction2, regionID, type,
      flags: this.getFlagsForNewRumor(type),
      textID: textId,
    });
  }

  /** GetFlagsForNewRumor (:2717-2733): the seven sign-message types
   *  answer 1, everything else 8 (spoken). */
  getFlagsForNewRumor(type) {
    switch (type) {
      case 10: case 18: case 7: case 4: case 28: case 27: case 26:
        return 1;
      default:
        return 8;
    }
  }

  /** RefreshRumorMill (:2735-2743) - THE REFRESH CULL, verbatim:
   *  every entry with timeLimit < now goes, quest entries' 0
   *  included. */
  refreshRumorMill() {
    const now = this._now();
    this.listRumorMill = this.listRumorMill.filter((x) => !(x.timeLimit < now));
  }

  /** GetValidRumors (:1468-1519). */
  getValidRumors(readingSign = false) {
    const valid = [];
    for (const entry of this.listRumorMill) {
      // the bulletin filter matches entry.textID against the allowed
      // ids - and runs FIRST, before any type check
      if (readingSign && !ALLOWED_BULLETIN_TEXT_IDS.includes(entry.textID)) continue;
      if (entry.rumorType === RUMOR_TYPE.CommonRumor) {
        // the region gate (the crime-wave arm; DFU dropped classic's
        // ruler regioning by never stamping those - the CODE is the law)
        if (entry.regionID !== -1 && entry.regionID !== (this.deps.currentRegionIndex?.() ?? -1)) continue;
        // sign rumors never SPEAK; spoken rumors never post
        if (!readingSign && (entry.flags & 1) === 1) continue;
        if (readingSign && (entry.flags & 1) !== 1) continue;
        if (entry.faction1 !== 0 || entry.faction2 !== 0 || entry.type !== 100) {
          // a faction carrying flags&1 suppresses its rumors 75% of
          // the time (Dice100.SuccessRoll(75))
          const f1 = entry.faction1 !== 0 ? this.deps.getFactionData?.(entry.faction1) : null;
          const f2 = entry.faction2 !== 0 ? this.deps.getFactionData?.(entry.faction2) : null;
          if (((f1 && (f1.flags & 1) === 1) || (f2 && (f2.flags & 1) === 1)) && dice100(75, this._rolls()())) continue;
        }
      }
      valid.push(entry);
    }
    return valid;
  }

  /** WeightedRandomRumor (:1450-1466): the running weighted choice -
   *  quest entries weigh questRumorWeight (setting, default 50),
   *  ambient entries 1; each step keeps the current pick with
   *  probability weight/(totalSoFar + weight). */
  weightedRandomRumor(validRumors) {
    const questRumorWeight = this.deps.questRumorWeight ?? DEFAULT_QUEST_RUMOR_WEIGHT;
    let totalWeight = 0;
    let selected = validRumors[0];
    for (const rumor of validRumors) {
      const weight = rumor.questID !== 0 ? questRumorWeight : 1;
      const r = this._range(totalWeight + weight);
      if (r >= totalWeight) selected = rumor;
      totalWeight += weight;
    }
    return selected;
  }

  /** The region ladder both news faces share (:1367-1377, :1405-1415):
   *  the entry's own region, else faction1's, else faction2's, else
   *  the current region (classic rolled a random one - DFU's comment
   *  owns the change). */
  _resolveRegionID(entry) {
    if (entry.regionID !== -1) return entry.regionID;
    const f1 = this.deps.getFactionData?.(entry.faction1);
    if (f1 && f1.region !== -1) return f1.region;
    const f2 = this.deps.getFactionData?.(entry.faction2);
    if (f2 && f2.region !== -1) return f2.region;
    return this.deps.currentRegionIndex?.() ?? -1;
  }

  _expandCommon(entry, tokens) {
    const ctx = { faction1: entry.faction1, faction2: entry.faction2, regionID: this._resolveRegionID(entry) };
    return this.deps.expandCommonTokens?.(tokens, ctx) ?? tokens;
  }

  /** GetNewsOrRumors (:1388-1440). `npcSession` is the per-
   *  conversation NPC state the caller owns
   *  ({ numAnswersGivenTellMeAboutOrRumors, isSpyMaster }) - the
   *  method spends one answer exactly as C# mutates npcData. */
  getNewsOrRumors(npcSession = { numAnswersGivenTellMeAboutOrRumors: 0, isSpyMaster: false }) {
    if (npcSession.numAnswersGivenTellMeAboutOrRumors < MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS
      || npcSession.isSpyMaster || (this.deps.npcsKnowEverything?.() ?? false)) {
      let news = this.deps.resolvingError?.() ?? RESOLVING_ERROR;
      const validRumors = this.getValidRumors();
      if (validRumors.length === 0) return this.deps.expandRandomTextRecord?.(OUT_OF_NEWS_RECORD_INDEX) ?? '';
      const entry = this.weightedRandomRumor(validRumors);
      if (entry.rumorType === RUMOR_TYPE.CommonRumor) {
        if (entry.listRumorVariants != null) {
          const tokens = this._expandCommon(entry, entry.listRumorVariants[0]);
          news = tokensToString(tokens, false);
        }
      } else if (entry.rumorType === RUMOR_TYPE.QuestRumorMill || entry.rumorType === RUMOR_TYPE.QuestProgressRumor) {
        const variant = this._range(entry.listRumorVariants.length);
        news = this.deps.expandQuestTokens?.(entry.questID, entry.listRumorVariants[variant])
          ?? tokensToString(entry.listRumorVariants[variant]);
      }
      npcSession.numAnswersGivenTellMeAboutOrRumors++;
      return news;
    }
    return this.deps.expandRandomTextRecord?.(OUT_OF_NEWS_RECORD_INDEX) ?? '';
  }

  /** GetNewsOrRumorsForBulletinBoard (:1355-1386): the FIRST valid
   *  CommonRumor's first variant, macro-expanded, as TOKENS; null
   *  when the board has nothing. */
  getNewsOrRumorsForBulletinBoard() {
    const validRumors = this.getValidRumors(true);
    if (validRumors.length === 0) return null;
    const validRumor = validRumors.find((x) => x.rumorType === RUMOR_TYPE.CommonRumor) ?? null;
    if (validRumor && validRumor.listRumorVariants != null) {
      return this._expandCommon(validRumor, validRumor.listRumorVariants[0]);
    }
    return null;
  }

  // ---- the quest machine's seams (:1558-1690) ----

  /** AddQuestRumorToRumorMill(questID, message) (:1558-1577): every
   *  variant's UNEXPANDED tokens. */
  addQuestRumorToRumorMill(questID, message) {
    if (message == null) throw new Error('AddQuestRumorToRumorMill(): Message cannot be null.');
    const listRumorVariants = [];
    for (let i = 0; i < message.variants.length; i++) {
      listRumorVariants.push(message.getTextTokensByVariant(i, false));
    }
    this.listRumorMill.push({
      rumorType: RUMOR_TYPE.QuestRumorMill, questID, listRumorVariants,
      timeLimit: 0, faction1: 0, faction2: 0, regionID: 0, flags: 0, type: 0, textID: 0,
    });
  }

  /** The List<Token[]> overload (:1579-1593): an EMPTY list adds
   *  nothing, silently. */
  addQuestRumorTokensToRumorMill(questID, listTokens) {
    if (listTokens.length > 0) {
      this.listRumorMill.push({
        rumorType: RUMOR_TYPE.QuestRumorMill, questID, listRumorVariants: listTokens,
        timeLimit: 0, faction1: 0, faction2: 0, regionID: 0, flags: 0, type: 0, textID: 0,
      });
    }
  }

  /** AddOrReplaceQuestProgressRumor (:1595-1634): the first
   *  progress entry for the quest gets ONLY its variants swapped;
   *  none found appends fresh. */
  addOrReplaceQuestProgressRumor(questID, message) {
    if (message == null) throw new Error('AddOrReplaceQuestProgressRumor(): Message cannot be null.');
    let i;
    for (i = 0; i < this.listRumorMill.length; i++) {
      if (this.listRumorMill[i].rumorType === RUMOR_TYPE.QuestProgressRumor && this.listRumorMill[i].questID === questID) break;
    }
    const listRumorVariants = [];
    for (let v = 0; v < message.variants.length; v++) {
      listRumorVariants.push(message.getTextTokensByVariant(v, false));
    }
    if (i >= this.listRumorMill.length) {
      this.listRumorMill.push({
        rumorType: RUMOR_TYPE.QuestProgressRumor, questID, listRumorVariants,
        timeLimit: 0, faction1: 0, faction2: 0, regionID: 0, flags: 0, type: 0, textID: 0,
      });
    } else {
      this.listRumorMill[i].listRumorVariants = listRumorVariants;
    }
  }

  /** RemoveQuestRumorsFromRumorMill (:1636-1654). */
  removeQuestRumorsFromRumorMill(questID) {
    this.listRumorMill = this.listRumorMill.filter((e) => !(e.rumorType === RUMOR_TYPE.QuestRumorMill && e.questID === questID));
  }

  /** RemoveQuestProgressRumorsFromRumorMill (:1656-1674). */
  removeQuestProgressRumorsFromRumorMill(questID) {
    this.listRumorMill = this.listRumorMill.filter((e) => !(e.rumorType === RUMOR_TYPE.QuestProgressRumor && e.questID === questID));
  }

  /** AddQuestorPostQuestMessage (:1676-1682): variant 0, unexpanded;
   *  one slot per quest, last write wins. */
  addQuestorPostQuestMessage(questID, message) {
    if (message == null) throw new Error('AddQuestorPostQuestMessage(): Message cannot be null.');
    this.dictQuestorPostQuestMessage.set(questID, message.getTextTokens(0, this._rolls(), false));
  }

  /** RemoveQuestorPostQuestMessage (:1684-1690). */
  removeQuestorPostQuestMessage(questID) {
    this.dictQuestorPostQuestMessage.delete(questID);
  }

  /** The greeting consumer's read (TK-iii; GetNPCQuestGreeting reads
   *  the dictionary). */
  getQuestorPostQuestMessage(questID) {
    return this.dictQuestorPostQuestMessage.get(questID) ?? null;
  }

  /** RestoreConversationData's mill-orphan sweep (:2522-2533): quest
   *  rumors whose quest no longer exists in the machine drop on load,
   *  with the verbatim log line. TK-ii's host restore calls this after
   *  the mill restores. */
  removeOrphanedQuestRumors(hasQuest) {
    for (let i = this.listRumorMill.length - 1; i >= 0; i--) {
      const entry = this.listRumorMill[i];
      if (entry.rumorType === RUMOR_TYPE.QuestRumorMill || entry.rumorType === RUMOR_TYPE.QuestProgressRumor) {
        if (!hasQuest(entry.questID)) {
          console.log(`Save data contains orphaned rumors for quest with id ${entry.questID}. Removing these rumors...`);
          this.listRumorMill.splice(i, 1);
        }
      }
    }
  }

  // ---- the SaveDataConversation halves this slice owns ----

  /** listRumorMill + dictQuestorPostQuestMessage, plain data (the
   *  rest of SaveDataConversation - dictQuestInfo, npcsWithWork,
   *  castleNPCsSpokenTo - rides TK-ii/TK-iv). */
  getSaveData() {
    return {
      listRumorMill: structuredClone(this.listRumorMill),
      dictQuestorPostQuestMessage: [...this.dictQuestorPostQuestMessage.entries()].map(([questID, tokens]) => ({ questID, tokens: structuredClone(tokens) })),
    };
  }

  restoreSaveData(data) {
    if (!data) return;
    this.listRumorMill = structuredClone(data.listRumorMill ?? []);
    this.dictQuestorPostQuestMessage = new Map((data.dictQuestorPostQuestMessage ?? []).map((r) => [r.questID, structuredClone(r.tokens)]));
  }
}
