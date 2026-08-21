// THE QUEST LISTS (Q2b-ii) - QuestListsManager.cs over the vendored
// QuestList tables (QuestList-Classic + QuestList-DFU, the same
// provenance-pinned pack the quest sources ship in). Each row files a
// quest under its guild group, social group, or InitAtGameStart; the
// pools answer the offer flow (Q4 consumes them) with the classic
// membership/minReq/reputation gates verbatim, and GetQuest resolves
// a quest by name for StartQuest and the offer surfaces. The
// mod/quest-pack discovery half (StreamingAssets folders, ModManager)
// is DFU-mod infrastructure with no port-side counterpart - the two
// shipped lists are the whole classic surface.
//
// deps (all injectable):
//   readListTable(name)        - raw text of `QuestList-<name>.txt`
//                                (the vendored Tables through the
//                                host's data seam; tests read fs)
//   getQuestSourceLines(name)  - quest source by name (the machine's
//                                own seam; GetQuest checks it FIRST,
//                                as C# checks QuestSourceFolder)
//   parseQuest(lines, factionId, partialParse) - parse WITHOUT
//                                scheduling (the machine's parse
//                                glue; the caller schedules via
//                                scheduleParsedQuest; partialParse
//                                skips QRC/QBN for the quest picker)
//   rolls()                    - SelectQuest's pool draw
//                                (UnityEngine.Random - Ledger A)
//   playerNudity               - DaggerfallUnity.Settings.PlayerNudity
//                                (the adult-quest gate; default false)

import { Table } from './table.js';
import { GUILD_GROUPS, SOCIAL_GROUPS } from '../../formats/factionFile.js';

/** QuestListsManager.MembershipStatus - char-backed, the table's
 *  membership column verbatim. */
export const MEMBERSHIP_STATUS = Object.freeze({
  Nonmember: 'N', Member: 'M', Prospect: 'P',
  Akatosh: 'T', Arkay: 'A', Dibella: 'D', Julianos: 'J',
  Kynareth: 'K', Mara: 'R', Stendarr: 'S', Zenithar: 'Z',
});

const INIT_AT_GAME_START = 'InitAtGameStart';
const isInt = (s) => /^\s*[+-]?\d+\s*$/.test(s);   // int.TryParse's accepting surface

export class QuestListsManager {
  constructor(deps = {}) {
    this.deps = deps;
    this.guilds = new Map();   // guild group id -> QuestData[]
    this.social = new Map();   // social group id -> QuestData[]
    this.init = [];            // InitAtGameStart rows
    this.oneTimeQuestsAccepted = null;
    this.loadQuestLists();
  }

  /** LoadQuestLists (:151-162): the two shipped lists; quest-pack
   *  lists are mod infrastructure (recorded above). */
  loadQuestLists() {
    this.guilds.clear();
    this.social.clear();
    this.init.length = 0;
    this._loadQuestList('Classic');
    this._loadQuestList('DFU');
  }

  _loadQuestList(name) {
    const text = this.deps.readListTable?.(name);
    if (text == null) { console.warn(`[quest] Quest list ${name} not found`); return; }
    // LoadQuestList (:194-202) contains failures PER LIST: a
    // malformed table logs and the other lists survive (Q2b-ii
    // VERIFY: a throw here used to destroy the whole manager).
    try {
      this._parseQuestList(new Table(text));
    } catch (e) {
      console.warn(`[quest] Unable to parse quest list table ${name}: ${e?.message ?? e}`);
    }
  }

  /** ParseQuestList (:204-254): a row whose minReq fails int.TryParse
   *  is skipped SILENTLY, verbatim. Groups resolve against the
   *  FACTION.TXT enums by NAME - a guild group, a social group, or
   *  the InitAtGameStart bucket; anything else is dropped (the C#
   *  "TODO other groups"). */
  _parseQuestList(table) {
    for (let i = 0; i < table.rowCount; i++) {
      const minRep = table.getValue('minReq', i);
      if (!isInt(minRep)) continue;
      const flag = table.getValue('flag', i)[0];
      const questData = {
        name: table.getValue('name', i),
        group: table.getValue('group', i),
        membership: table.getValue('membership', i)[0],
        minReq: parseInt(minRep, 10),
        oneTime: flag === '1',
        adult: flag === 'X',
      };
      if (Object.hasOwn(GUILD_GROUPS, questData.group)) {
        const id = GUILD_GROUPS[questData.group];
        if (!this.guilds.has(id)) this.guilds.set(id, []);
        this.guilds.get(id).push(questData);
      } else if (Object.hasOwn(SOCIAL_GROUPS, questData.group)) {
        const id = SOCIAL_GROUPS[questData.group];
        if (!this.social.has(id)) this.social.set(id, []);
        this.social.get(id).push(questData);
      } else if (questData.group === INIT_AT_GAME_START) {
        this.init.push(questData);
      }
    }
  }

  /** GetQuest (:279-321): the source seam first (C#'s
   *  QuestSourceFolder File.Exists), then init, guild and social
   *  lists by name. Answers null for an unknown quest. */
  getQuest(questName, factionId = 0) {
    if (this.deps.getQuestSourceLines?.(questName)) {
      return this.loadQuest({ name: questName }, factionId);
    }
    for (const questData of this.init) {
      if (questData.name === questName) return this.loadQuest(questData, factionId);
    }
    for (const pool of this.guilds.values()) {
      for (const questData of pool) {
        if (questData.name === questName) return this.loadQuest(questData, factionId);
      }
    }
    for (const pool of this.social.values()) {
      for (const questData of pool) {
        if (questData.name === questName) return this.loadQuest(questData, factionId);
      }
    }
    return null;
  }

  /** GetGuildQuest (:322-327). */
  getGuildQuest(guildGroup, status, factionId, rep, rank) {
    const pool = this.getGuildQuestPool(guildGroup, status, factionId, rep, rank);
    return this.selectQuest(pool, factionId);
  }

  /** GetGuildQuestPool (:331-360): the eligibility law verbatim -
   *  Temple dual membership folds any member status to Member for
   *  HolyOrder; a non-member sees only minReq 0; minReq < 10 is a
   *  rank gate, >= 10 a reputation gate; adult quests need the
   *  nudity setting; an accepted one-time quest never re-offers. */
  getGuildQuestPool(guildGroup, status, _factionId, rep, rank) {
    if (this.oneTimeQuestsAccepted == null) this.oneTimeQuestsAccepted = [];
    const guildQuests = this.guilds.get(guildGroup);
    if (!guildQuests) return null;
    const tplMemb = (guildGroup === GUILD_GROUPS.HolyOrder && status !== MEMBERSHIP_STATUS.Nonmember)
      ? MEMBERSHIP_STATUS.Member : status;
    const pool = [];
    for (const quest of guildQuests) {
      if ((status === quest.membership || tplMemb === quest.membership)
        && ((status === MEMBERSHIP_STATUS.Nonmember && quest.minReq === 0)
          || (quest.minReq < 10 && quest.minReq <= rank)
          || (quest.minReq >= 10 && quest.minReq <= rep))) {
        if ((!quest.adult || this.deps.playerNudity)
          && !(quest.oneTime && this.oneTimeQuestsAccepted.includes(quest.name))) {
          pool.push(quest);
        }
      }
    }
    return pool;
  }

  /** GetSocialQuest (:362-389): minReq < 10 gates on player LEVEL (or
   *  reputation covers it); membership here is N=any, M=male,
   *  F=female. */
  getSocialQuest(socialGroup, factionId, gender, rep, level) {
    if (this.oneTimeQuestsAccepted == null) this.oneTimeQuestsAccepted = [];
    const socialQuests = this.social.get(socialGroup);
    if (!socialQuests) return null;
    const pool = [];
    for (const quest of socialQuests) {
      if (((quest.minReq < 10 && quest.minReq <= level) || rep >= quest.minReq)
        && (quest.membership === 'N'
          || (quest.membership === 'M' && gender === 'male')
          || (quest.membership === 'F' && gender === 'female'))) {
        if ((!quest.adult || this.deps.playerNudity)
          && !(quest.oneTime && this.oneTimeQuestsAccepted.includes(quest.name))) {
          pool.push(quest);
        }
      }
    }
    return this.selectQuest(pool, factionId);
  }

  /** SelectQuest (:391-408): Random.Range over the pool; a compile
   *  failure logs and answers null rather than throwing. */
  selectQuest(pool, factionId) {
    if (pool && pool.length > 0) {
      const roll = this.deps.rolls ?? Math.random;
      const questData = pool[Math.floor(roll() * pool.length)];
      try {
        return this.loadQuest(questData, factionId);
      } catch (e) {
        console.warn(`[quest] Exception for quest ${questData.name} during quest compile: ${e?.message ?? e}`);
      }
    }
    return null;
  }

  /** LoadQuest (:422-455): the source seam stands in for the file
   *  read; a missing source THROWS, as C#'s missing file does. The
   *  loaded quest carries the row's OneTime flag. partialParse skips
   *  the QRC/QBN halves (Parser.cs:144) - the guild quest picker
   *  reads DisplayName from header-only parses (Q4-ii). */
  loadQuest(questData, factionId, partialParse = false) {
    const lines = this.deps.getQuestSourceLines?.(questData.name);
    if (!lines) throw new Error(`Quest file ${questData.name} not found.`);
    const quest = this.deps.parseQuest?.(lines, factionId, partialParse);
    if (!quest) return null;
    quest.oneTime = !!questData.oneTime;
    return quest;
  }

  /** InitAtGameStartQuests (:263-273): parse and START every
   *  game-start row IMMEDIATELY - C# calls QuestMachine.StartQuest,
   *  not ScheduleQuest, so the quest is live before this returns
   *  (Q2b-ii VERIFY: the first draft deferred them a tick). The
   *  caller hands in the machine's startQuestImmediate. */
  initAtGameStartQuests(startQuestImmediate) {
    for (const questData of this.init) {
      const quest = this.loadQuest(questData, 0);
      if (!quest) continue;
      startQuestImmediate(quest);
    }
  }

  /** QuestMachine_OnQuestStarted (:88-95): a started one-time quest
   *  never re-offers. The machine's onQuestStarted dep is the event. */
  noteQuestStarted(quest) {
    if (quest.oneTime && this.oneTimeQuestsAccepted != null) {
      this.oneTimeQuestsAccepted.push(quest.questName);
    }
  }
}
