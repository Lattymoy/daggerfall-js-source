// THE QUEST BRIDGE (Q4-v) - the machine goes LIVE in the hosts. One
// module owns the wiring: it builds the QuestMachine over the world
// seam the host composes, the QuestListsManager over the vendored
// pack (scenes/quest/questData.js loads it in the browser; tests feed fs),
// the offer flow, and the player notebook - and hands the scenes a
// small verb set: tick with the frame, click an NPC, open the Quests
// service, mount a scene's quest resources, snapshot/restore the
// whole envelope. Everything here is PURE WIRING over the pinned
// Q1-Q4 law modules - node-testable with a mock ctx; the scenes pass
// their live objects.
//
// ctx (the host's contract; every member optional unless noted):
//   data: { readListTable(name), getQuestSourceLines(name) }  REQUIRED
//   world                       - the machine's deps.world, composed by
//                                 the host per machine.js's contract
//                                 (maps/getBlock/player state/...);
//                                 absent members idle, and the bridge
//                                 NAMES them once at construction -
//                                 the headless charter (AUDIT-QUEST F1)
//   classicSeconds()            - the classic game clock in seconds
//                                 (the ticker's minutes * 60) - TIME3:
//                                 the quest's clock, the CHARACTER's
//                                 own online (playerTicker.ownMinutes;
//                                 the one clock offline)
//   skySeconds()                - TIME3: the sky (skyMinutes() * 60) -
//                                 a quest's hour, date and season
//   worldSeconds()              - TIME3: the event clock (worldMinutes()
//                                 * 60) - the journal's dates
//   raisedSeconds()             - TIME3: the session's raises
//                                 (raisedMinutes() * 60), charged nothing (QCLOCK-WORLD)
//   playerEntity                - { name, level, gender, ... }
//   playerRaceName()            - the birth race name (%ra)
//   getReputation(factionId)    - factionRep.getReputation over the
//                                 player's store
//   getGoldPieces()/deductGoldPieces(n)/deductGold(n)/addGold(n),
//   giveItemToPlayer(dfItem),
//   removeItemFromPlayer, playerHasItem, carriesQuestItem,
//   releaseQuestItem, makeHeldQuestItemsPermanent, offerReward,
//   isPlayerInTown()            - the item/click seams (Q2b)
//   showPopup(quest, tokens)    - ONE already-expanded message box
//                               (tokens ride the
//                                 message; the host chunks)
//   addHUDText(text), playVideo(name), playSound(id)
//   playSong(name)              - one MIDI.BSA record name; the
//                                 PlaySong action has already resolved
//                                 the SongFiles member (systems/
//                                 songFiles.js)
//   the talk seams              - addQuestTopics/dialogLink/addDialog/
//                                 rumor + scrub family (TalkManager's
//                                 consumers pend the talk arc; absent
//                                 is silent, recorded)
//   isPlayerInsideCastle(), removeNpcQuestor(nameSeed),
//   getGuildFactionId(guildGroup) - the offer flow's own seams
//   dateTimeString()/midDateTimeString()/cityName() - the notebook's
//   onQuestStarted(quest)       - extra listener beside the one-time
//                                 recording (optional)
//
// THE NPC-DATA LAW (StaticNPC.cs:210-224, :331-337) lives here too:
// the hash is x ^ y<<2 ^ z>>2 over the RAW layout ints; the nameSeed
// is position ^ (buildingKey + locationIndex) - C#'s + binds TIGHTER
// than ^, the famous precedence, kept; gender is flags & 32; the
// billboard indices ride along for the questor flat-pick (Q4-iii).

import { QuestMachine, TICKS_PER_SECOND } from '../../systems/quest/machine.js';
import { clockCounts } from '../../systems/quest/clock.js';   // DEAD-CLOCK: a clock whose end changes nothing is no deadline
import { repairActiveQuests, relayOnlineDungeons, relayMovedLayouts, relayBuiltDungeon } from '../../systems/quest/questRepair.js';   // QREPAIR: the Settings' repair (AUDIT DELVE E1: and a frozen size, crossing online)
import { t, getLocalizedFactionName, textRevision } from '../../systems/textManager.js';   // QUEST-RESET: the restart's words in the player's language (L10N4); QL12: a guild's name in it, its quests' titles kept while the text stands
import { isOnlinePage } from '../../systems/online/onlineLane.js';   // AUDIT DELVE E1: online, every dungeon is whole
import { isShelved } from '../../systems/quest/quest.js';   // QUEST-SHELF: a quest set aside
import { WA_RAID_QUESTS } from '../../systems/warmAshesShips.js';   // QUEST-SHELF: a raid the world runs is never set aside
import { QuestListsManager } from '../../systems/quest/questLists.js';
import { QuestOfferFlow, ACTIVE_QUESTOR } from '../../systems/quest/offerFlow.js';   // QUESTOR-SAID: a close that says why
import { localizedQuestDisplayName } from '../../systems/quest/localizedQuest.js';   // L10N3c: the pickers' localized labels
import { PlayerNotebook } from '../../systems/notebook.js';
import { GENDERS } from '../../characters/nameHelper.js';
import { ZERO_NPC_DATA, NPC_CONTEXT, raceFromFaction } from '../../characters/staticNpc.js';
import { GUILD_GROUPS } from '../../formats/factionFile.js';
import { expandMacroValues, setMacroWorld } from '../../systems/quest/questMacros.js';   // GQL1: the wait box's %pcf
import { firstName } from '../../systems/talk/talkSession.js';
import { getBool } from '../../systems/settings/settings.js';
import { noteOfferPending, clearPendingOffer } from '../../ui/pendingOffer.js';   // AUDIT 58: DaggerfallUI's GivePc.OnOfferPending subscription; QUEST-AUDIT III OFFER-STALE: a load lets the last game's go
import { getTitle } from '../../systems/guild/guilds.js';
import { addQuestResourceObjects } from '../../systems/quest/sceneMount.js';
import { SITE_TYPES } from '../../systems/quest/place.js';   // QUEST-HOME: a building's mount marks its sites reached
import { QuestLens } from '../../ui/quest/questLens.js';   // GUIDE1: the modern faces' one read-only picture of this machine
import { questHerald, heraldOn } from '../../ui/quest/questHerald.js';   // GUIDE3: the news the lens sees, told
import { questTracker, followOn } from '../../ui/quest/questTracker.js';   // GUIDE4: the quest the HUD follows (GUIDE5: the card's or the marks')
import { createQuestlines } from '../../systems/questlines/qlLayer.js';   // QL1: the questlines' layer over this machine (bible/06-Systems/Questlines-Arc.md)
import { questlineActionTemplates } from '../../systems/questlines/qlActions.js';   // QL4: ask, outcome, ql act, ql paid, ql name - registered here, every host's machine
import { setActSink } from '../../systems/questlines/qlActs.js';   // QL11: the features' acts, heard by this bridge's layer
import { questlineService, serviceReady } from './questlineHost.js';   // QL12: the endgame lines' claims - the account service's door, online alone
import { TITLE_TEXT } from '../../ui/playerBadge.js';   // QL12: a line's title, in the badge's own words
import { announceHonour } from '../../ui/lootBanner.js';   // AUDIT QUESTLINES SERVICE-7: a line's title, the house's HONOUR-BANNER
import { restackWeirKeys } from '../../systems/eliteGates/weirKey.js';   // AUDIT QUESTLINES SERVICE-7: the key's balance, the pack's face at once
import { questlinesOn } from '../../systems/questlines/qlLaw.js';   // QL12: the lines are the window's only while the questlines are on
import { ladders as guildLadders } from '../../systems/questlines/qlLadders.js';   // QL12: the guilds' ladders (section 4.4)
import { activeMemberships } from '../../systems/guild/guilds.js';   // QL12: the player's own book, for the ladders
import { factionsTable } from '../../systems/quest/tables.js';   // QL12: a guild's name, by its faction
import { quietText, clocksNamed } from '../../ui/quest/questLens.js';   // QL1: a sheet's line read quietly, as the journal's entries are; QUEST-AUDIT III NAMED-TIMER: the clocks an entry names
import { offerWaitingWords } from '../../ui/questlines/qlJournal.js';   // AUDIT QUESTLINES UI-6: a reward waiting, and the way to it on either skin
import { createQuestlineOffers, setLineBoard } from './questlineOffers.js';   // QL-OFFERED: a questline is taken, never sent - where each is offered

// AUDIT 24 (wave 24): SetLayoutData's three overloads and
// GetPositionHash now live in characters/staticNpc.js, next to the
// rest of StaticNPC.cs. They were here AND there: staticNpc.js had a
// stale copy of the layout overload that predated the seven-slice
// sweep's corrections - no race, no context, no zero-struct base, and
// a gender written as the STRING 'female' where this one writes the
// Genders enum the way C# does. Re-exported so the bridge's callers
// are unchanged.
import { positionHash, staticNpcData, layoutNpcData } from '../../characters/staticNpc.js';
import { festivalQuestEnded } from '../../systems/festival/festivalClient.js';   // WITCH1: a quest done asks a find

export { positionHash, staticNpcData, layoutNpcData };

/** Guild.IsSatisfyQuestReqByLevel: base FALSE; the two overrides are
 *  MagesGuild.cs:67 and KnightlyOrder.cs:83 - player level stands in
 *  for rank on their quest gates. */
export const SATISFY_QUEST_BY_LEVEL_GROUPS = Object.freeze([GUILD_GROUPS.MagesGuild, GUILD_GROUPS.KnightlyOrder]);

/** The offer flow's Guild surface composed from the port's pieces:
 *  the U-series guild object (divine name), the membership record
 *  (rank), and the faction store (reputation on the guild's own
 *  faction). */
export function offerGuildSurface({ guildGroup, guild, membership, reputation, playerEntity = null }) {
  return {
    isMember: () => membership != null,
    rank: membership?.rank ?? 0,
    deity: guild?.divine ?? '',
    getReputation: () => reputation ?? 0,
    isSatisfyQuestReqByLevel: () => SATISFY_QUEST_BY_LEVEL_GROUPS.includes(guildGroup),
    // AUDIT 24 (the seven-slice sweep): THE SECOND MACRO PROVIDER.
    // Guild implements IMacroContextProvider (Guild.cs:355-380) and
    // the offer flow lends it to the quest as ExternalMCP, which
    // MacroHelper.GetValue consults when the quest's own source answers
    // NOT_IMPLEMENTED. The port's macro engine reads a provider as
    // `{ quest, source }` and `source(mcp) = mcp?.source ?? null`, so
    // the RAW guild object it was handed had no source at all - and
    // that `?? null` makes a wrong-shaped provider indistinguishable
    // from no provider, so %pct degraded silently to its mcp-null arm,
    // the PLAYER'S NAME. 42 corpus quests use %pct; a guild offer read
    // "Arkay be with you, Bob Smith." where DFU says "...Curate."
    // GuildMacroDataSource answers exactly two macros.
    source: {
      guildTitle: () => getTitle(membership, playerEntity, guild),
      amount: () => String(guild?.trainingPrice ?? 0),
    },
  };
}

/** Message tokens -> parchment rows (the ServiceFlowWindow shape):
 *  text tokens append to the line, every formatting token breaks it -
 *  the same pairing loadMessage emits. */
export function tokensToRows(tokens) {
  const rows = [];
  let line = '';
  let sawText = false;
  for (const token of tokens ?? []) {
    if (token.formatting === 'text') { line += token.text; sawText = true; continue; }
    rows.push(line);
    line = '';
    sawText = false;
  }
  if (sawText) rows.push(line);
  return rows;
}

/** QL4 (bible/06-Systems/Questlines-Arc.md section 2.3): THE QUESTLINES' `ask` AS A BOX CHAIN, one home for every
 *  host's quest box (THE ONE CONSTRUCTION SEAM - world.js and exterior.js each hand it to their own showQuestBox): the
 *  question's message, then a pick among the choices' own words. The pick cannot be dismissed without an answer -
 *  Escape shows the question again - as PromptMulti's box cannot (PromptMulti.cs:87-88, AllowCancel false). The
 *  answer is the choice's index, given once.
 *  AUDIT QUESTLINES BRANCH-7: the chain waits BEHIND the boxes already up (`behind` - ui/guildServiceWindows.js
 *  ServiceFlowWindow.push): pushed in front, newest first, the question came before the words that set it up (A0C41Y18's
 *  coward's way over the sage's curse). AUDIT QUESTLINES BRANCH-3: a pick the window cannot show (its onCancel told
 *  'unshown', guildServiceWindows.js PICK_UNSHOWN - no list art yet) settles the chain with null, and the ask asks again later (qlActions.js ASK_AGAIN_TICKS);
 *  dropped unanswered it held the question up for the session, and re-shown it would loop the question for ever. A
 *  question with no words of its own (BRANCH-9: a message the quest lacks) is the pick alone. */
export function choiceBoxes(q, message, choices, respond) {
  const labels = choices.map((c) => tokensToRows(c.getTextTokens(-1, q.rolls)).join(' ').replace(/\s+/g, ' ').trim());
  let answered = false;
  const answer = (i) => { if (!answered) { answered = true; respond(i); } return []; };
  const question = () => (message ? { rows: tokensToRows(message.getTextTokens(-1, q.rolls)), onClick: () => [pick()] } : pick());
  const pick = () => ({ picker: labels, onPick: (i) => answer(i), onCancel: (why) => (why === 'unshown' ? answer(null) : [question()]) });
  return { ...question(), behind: true };
}

/** The host's door for the questlines' `ask`: the chain above, handed to that host's own quest box. HOST-SPLIT
 *  (bible/01-Overview/Host-Split.md): built here, so world.js's bootWorld and exterior.js's bootExterior each wire it in one
 *  entry - `showChoice: choiceDoor(showQuestBox)` - never an arrow of their own (bootWorld met its ceiling at the merge). */
export const choiceDoor = (showQuestBox) => (q, message, choices, respond) => showQuestBox(choiceBoxes(q, message, choices, respond));

/** StartGameBehaviour.cs:445-447 - the two quests a new character
 *  always starts, in this order. _BRISIEN is the main quest's first.
 *
 *  TUT1 (2026-10-11, Mac: "replace the current DFU tutorial with our own custom tutorial"): DFU's first is _TUTOR__,
 *  and it is no longer started - DFO's own tutorial (systems/tutorials.js, ui/tutorialPopup.js) stands where its pages
 *  stood. What _TUTOR__ did besides its pages is kept: every way out of it, finished or declined, ran its `_no_`
 *  task, `start quest 977 977` - the curse on the old capital's streets, a world quest (questFoeHost.js WORLD_QUESTS) -
 *  so S0000977 starts here, in the tutorial's place, as a player who said No to its first page started it. Port-Ledger
 *  section A. */
export const GAME_START_QUESTS = Object.freeze(['S0000977', '_BRISIEN']);

/** TUT1: the DFU tutorial a save from before TUT1 may still be running, and the quest its close starts. */
export const RETIRED_TUTORIAL_QUEST = '_TUTOR__';
export const RETIRED_TUTORIAL_STARTS = 'S0000977';

/** TUT1: A SAVE FROM BEFORE TUT1 may still be in DFU's tutorial - its next page waiting on a clock. It is retired at the
 *  load as its own No would have retired it: the quest goes (removeQuest: tombstoned, no notebook entry - it had nothing
 *  to file) and the curse it would have started starts, unless that save already holds it. Answers what it did. */
export function retireDfuTutorial(machine) {
  if (!machine?.quests) return { retired: 0, started: false };
  const live = [...machine.quests.values()].filter((q) => q?.questName === RETIRED_TUTORIAL_QUEST && !q.questComplete && !q.questTombstoned);
  if (!live.length) return { retired: 0, started: false };
  for (const q of live) machine.removeQuest(q);
  const held = [...machine.quests.values()].some((q) => String(q?.questName ?? '').toUpperCase() === RETIRED_TUTORIAL_STARTS);
  let started = false;
  // AUDIT TUT1: a start that throws (StartQuestImmediate propagates) costs the curse, never the load around it
  if (!held) { try { started = !!machine.startQuestByName(RETIRED_TUTORIAL_STARTS); } catch (e) { console.warn('[quest] the curse did not start in the retired tutorial\'s place', e); } }
  return { retired: live.length, started };
}

/**
 * THE CONTRACT, AND THE ONE LINE THAT SAYS WHAT A HOST DID NOT WIRE.
 *
 * AUDIT-QUEST F1/F2/F3, 2026-09-15. Three findings, one root cause: this
 * bridge never stated what it was given.
 *
 *   F1 - THE WORD "LOUDLY" WAS WRITTEN OVER AN OPERATION THAT IS
 *   SILENT. The header above said "absent members idle LOUDLY, the
 *   headless charter", and `machine.js` says the same of every Place
 *   pending its site. What actually happened was `sitePending = true` -
 *   a boolean. MEASURED: all 265 vendored quests start with no world
 *   seam at all, and 262 of them emit nothing whatsoever. Across the
 *   quest system 215 of 229 optional-chained seam calls are silent on
 *   absence.
 *
 *   F2 - `scenes/exterior.js` wires 30 of these 65 members. The 35 it
 *   does not include the whole item family, the reward, the disease and
 *   curse cures, video, song, and every talk and rumor seam - and
 *   `?exterior` is the scene a developer would reach for to test a
 *   quest. Nothing said so.
 *
 *   F3 - the gate that exists to catch exactly that,
 *   `test/systems/quest/audit24_questseams.test.js`'s "every bridge ctx seam is
 *   SUPPLIED or declared PENDING", opened `src/scenes/world.js` BY NAME
 *   and never looked at any other host.
 *
 * So the bridge reports, once, at construction. One line, naming what is
 * absent - which is what "loudly" was always supposed to mean.
 *
 * THE LIST IS GATED AGAINST THE BRIDGE'S OWN USAGE, both ways
 * (`test/scenes/auditquest_seams.test.js`), because a hand-kept contract list
 * would be F3 again in a new place.
 */
/** Every ctx member this bridge reads. DERIVED once and written down,
 *  and `test/scenes/auditquest_seams.test.js` re-derives it from this file's
 *  own source on every run and fails if the two disagree in EITHER
 *  direction - a member added to the code and not to this list, or a
 *  name here the bridge stopped reading. */
export const QUEST_CTX_CONTRACT = Object.freeze([
  'addDialog', 'addFace', 'addGold', 'addHUDText', 'addProgressRumor',
  'addQuestRumor', 'addQuestTopics', 'addQuestorPostMessage',
  'carriesQuestItem', 'changeLegalRep', 'changeReputation', 'cityName',
  'classicSeconds', 'clearEnemies', 'cureDisease', 'data',
  'dateTimeString', 'deductGold', 'deductGoldPieces', 'dialogLink',
  'dropFace', 'endLycanthropy', 'endVampirism', 'forceTopicListsUpdate',
  'getGoldPieces', 'getGuild', 'getGuildFactionId',
  'getReputation', 'getTotalGold', 'giveItemToPlayer', 'hasQuestTopics',
  'isPlayerInTown', 'isPlayerInsideCastle', 'keepsQuestItem', 'makeEnemiesHostile',   // AUDIT QA3 B8: the reclaim's read of every keeping
  'makeHeldQuestItemsPermanent', 'makePcDiseased', 'midDateTimeString',
  'noteMinutes', 'notePlace',   // L10N5: a notebook header's render data
  'offerReward', 'onQuestEnded', 'onQuestStarted', 'onQuestlineOffer', 'ownMinutes', 'partyHas', 'partySize', 'playSong',   // QL3: a quest's choice of gear, rolled - the host's window
  'playSound', 'playVideo', 'playerEntity', 'playerHasItem',
  'playerRaceName', 'questClockStepMax', 'questFoeInstances', 'questFoeKilled', 'questWhere',   // GUIDE4: the host's two questions for the lens's look
  'questlineService',   // QL12: the account service's door for the questlines' claims - optional, the page's own by default
  'raiseTime', 'raisedSeconds', 'regionPriceAdjustment', 'releaseQuestItem',
  'relinkQuestTopics', 'removeItemFromPlayer', 'removeNpcQuestor',
  'removeProgressRumors', 'removeQuestInfoTopics', 'removeQuestRumors',
  'removeQuestorPostMessage', 'setPlayerCrime', 'sharedClock', 'showChoice', 'showPopup',   // QL4: `ask`'s box and pick
  'showPrompt', 'showPromptMulti', 'skySeconds', 'spawnCityGuards',
  'undiscoverBuilding', 'waitOnline', 'world', 'worldSeconds',
]);

export const QUEST_CTX_REQUIRED = Object.freeze(['data']);

/** Members a host may decline on purpose. `onQuestStarted` is an EXTRA
 *  listener beside the bridge's own one-time recording, and the shipping
 *  host declines it - so its absence is not worth a word. */
export const QUEST_CTX_OPTIONAL_BY_DESIGN = Object.freeze(['onQuestStarted', 'hasQuestTopics', 'onQuestlineOffer', 'questlineService']);   // QREPAIR: only a host with a topic tree can say whether a quest has its topics; QL3: a reward waiting is said in the host's HUD line whether or not a host listens; QL12: the service's door is the page's own (questlineHost.js) - a host hands one only to replace it (a test's fake)

/** QUEST-SHELF: the bridge's own refusal beside the machine's ladder (machine.js shelveRefusal) - a raid the world runs
 *  (WA_RAID_QUESTS - the sea's own, ended by its fight). One word for the press and the button alike. */
const refuseRaid = (q) => (WA_RAID_QUESTS.includes(q.questName) ? 'raid' : null);
/** QUEST-SHELF: why a quest could not be set aside or reclaimed, in words - the player's language (QUEST-AUDIT III
 *  SHELF-WORDS: these were English in every language; the restart's share their keys where the words are the same). */
export function shelfRefusalText(reason) {
  switch (reason) {
    case 'gone': return t('pause.journal.restartGone', 'That quest is over.');
    case 'shelved': return t('pause.journal.shelfShelved', 'That quest is already abandoned.');
    case 'running': return t('pause.journal.shelfRunning', 'That quest is not abandoned.');
    case 'ending': return t('pause.journal.restartEnding', 'That quest is ending.');
    case 'protected': return t('pause.journal.shelfProtected', 'That quest cannot be abandoned.');
    case 'raid': return t('pause.journal.restartRaid', 'Not while the raid is on.');
    case 'twin': return t('pause.journal.shelfTwin', 'You have taken that quest up again. Finish or abandon it first.');
    default: return t('pause.journal.restartRefused', 'That cannot be done now.');
  }
}
/** QUESTOR-SAID (FIELD BUGS 2026-10-19f): a questor's close in words - the quest still open, by the name the journal
 *  gives it (its DisplayName, a translation's -LOC one where it has one); with none, the work alone. The player's
 *  language (L10N4). */
export function questorBusyRows(quest) {
  const name = quest?.displayName || '';
  return [{ text: name ? t('quest.offer.questorBusy', 'You have not finished the work you were given here: {quest}.', { quest: name })
    : t('quest.offer.questorBusyUnnamed', 'You have not finished the work you were given here.'), center: true }];
}
/** QUEST-RESET: why a quest could not be restarted, in words (machine.js restartRefusal) - the player's language (L10N4). */
export function restartRefusalText(reason) {
  switch (reason) {
    case 'gone': return t('pause.journal.restartGone', 'That quest is over.');
    case 'shelved': return t('pause.journal.restartShelved', 'That quest is abandoned. Reclaim it first.');
    case 'ending': return t('pause.journal.restartEnding', 'That quest is ending.');
    case 'protected': return t('pause.journal.restartProtected', 'That quest cannot be restarted.');
    case 'questor': return t('pause.journal.restartQuestor', 'Someone gave you that quest. Abandon it and ask them for it again.');
    case 'paid': return t('pause.journal.restartPaid', 'That quest has already paid you, so it cannot be started again.');   // QUEST-AUDIT III RESTART-PAID
    case 'child': return t('pause.journal.restartChild', 'Another quest depends on that one, so it cannot be restarted.');
    case 'started': return t('pause.journal.restartStarted', 'That quest has already started another, so starting it again would start that one twice.');   // AUDIT QA3 B1
    case 'raid': return t('pause.journal.restartRaid', 'Not while the raid is on.');
    case 'unparsed': return t('pause.journal.restartUnparsed', 'That quest could not be started again here.');
    case 'failed': return t('pause.journal.restartFailed', 'That quest could not be started again.');
    default: return t('pause.journal.restartRefused', 'That cannot be done now.');
  }
}

/**
 * What this host did not wire. Returned as well as logged, so a caller
 * (or a test) can read it rather than scrape the console.
 */
export function reportUnwiredSeams(ctx, contract, label = 'host') {
  const absent = contract.filter((k) => ctx?.[k] == null && !QUEST_CTX_OPTIONAL_BY_DESIGN.includes(k));
  const missingRequired = QUEST_CTX_REQUIRED.filter((k) => ctx?.[k] == null);
  if (missingRequired.length) {
    console.error(`[quest] ${label} wired NO ${missingRequired.join(', ')} - the bridge cannot read quest source without it`);
  }
  if (absent.length) {
    console.warn(`[quest] ${label} wired ${contract.length - absent.length}/${contract.length} seams; `
      + `absent (these quest verbs will idle): ${absent.join(', ')}`);
  }
  return absent;
}

export function createQuestBridge(ctx, { label = 'host' } = {}) {
  // F1: the charter's "loudly", made true - one line, at construction.
  reportUnwiredSeams(ctx, QUEST_CTX_CONTRACT, label);
  const notebook = new PlayerNotebook({
    dateTimeString: () => ctx.dateTimeString?.() ?? '',
    midDateTimeString: () => ctx.midDateTimeString?.() ?? '',
    cityName: () => ctx.cityName?.() ?? '',
    nowMinutes: () => ctx.noteMinutes?.(),   // L10N5: a header's render data - optional seams, a host without them files text alone
    place: () => ctx.notePlace?.() ?? null,
  });

  let questLists = null;
  /** QL1: the questlines' layer, made below over this machine - declared first, so a dep the machine calls before it is
   *  made reads null, never the temporal dead zone (AUDIT QUESTLINES LAW-15). */
  /** @type {any} */ let questlines = null;
  const machine = new QuestMachine({
    world: ctx.world ?? null,
    nowSeconds: () => ctx.classicSeconds?.() ?? 0,
    // TIME3 (bible/06-Systems/Online-Time-Arc.md 6.3): the sky, the event clock and the session's raises beside the
    // character's clock above - null where a host names none (the machine falls back to the one clock)
    skySeconds: () => ctx.skySeconds?.() ?? null,
    worldSeconds: () => ctx.worldSeconds?.() ?? null,
    raisedSeconds: () => ctx.raisedSeconds?.() ?? null,
    // AUDIT LIVED1b D1 (A1, O6): the character's clock, for the stamps a quest makes on it (TrainPc's training time) -
    // AUDIT LIVED1 D gave the machine the hook and world.js the member, and the deps below are built key by key, so the
    // member never reached the machine: TrainPc stamped the world's minute, the guild's gate read the character's
    // (refused for 84 days of their time behind the world, open at once ahead of it)
    ownMinutes: () => ctx.ownMinutes?.() ?? null,
    questClockStepMax: () => ctx.questClockStepMax?.() ?? Infinity,   // WORLD7: online, a quest clock bounds the LIVED part of a gap to the host's step, a raise charged nothing (QCLOCK-WORLD; TIME3 charged it whole); a host that says nothing charges every clock, DFU's own
    sharedClock: () => !!ctx.sharedClock?.(),   // GUARD-ONLINE: online, a guarded quest's window is the player's arrival's (quest/onlineGuard.js)
    getQuestSourceLines: (name, questlines) => ctx.data.getQuestSourceLines(name, questlines),   // AUDIT QUESTLINES BRANCH-12: a copy's script as its stamp read it (machine.js parseQuestShape)
    playerLevel: () => ctx.playerEntity?.level ?? 0,
    playerGender: () => ctx.playerEntity?.gender ?? 'male',
    playerName: () => ctx.playerEntity?.name ?? null,
    playerRaceName: () => ctx.playerRaceName?.() ?? null,
    playerEntity: ctx.playerEntity ?? null,   // M-X: the macro globals (vitals, %ski, the biography modifiers)
    // Q5: the un-pended actions' host doors
    setPlayerCrime: (crime) => ctx.setPlayerCrime?.(crime),
    getGoldPieces: () => ctx.getGoldPieces?.() ?? 0,
    deductGoldPieces: (n) => ctx.deductGoldPieces?.(n),
    raiseTime: (seconds) => ctx.raiseTime?.(seconds),
    waitOnline: (seconds, quest) => ctx.waitOnline?.(seconds, quest),   // FORAGE4: online, QAE's raise time is the host's wait (scenes/foragingWait.js)
    spawnCityGuards: (immediate) => ctx.spawnCityGuards?.(immediate),
    makeEnemiesHostile: () => ctx.makeEnemiesHostile?.(),
    clearEnemies: () => ctx.clearEnemies?.(),
    questFoeInstances: (symbol) => ctx.questFoeInstances?.(symbol) ?? [],   // MT-iii
    getReputation: (fid) => ctx.getReputation?.(fid) ?? 0,
    getTotalGold: () => ctx.getTotalGold?.() ?? 0,   // PayMoney's `money` arm - GetGoldAmount
    deductGold: (n) => ctx.deductGold?.(n),
    addGold: (n) => ctx.addGold?.(n),
    addHUDText: (t) => ctx.addHUDText?.(t),
    showPopup: (q, tokens) => ctx.showPopup?.(q, tokens),
    questFoeKilled: (q, foe, n) => ctx.questFoeKilled?.(q, foe, n),   // QUEST-NOTE: a quest's foe fell
    showPrompt: (q, message, respond) => (ctx.showPrompt ? ctx.showPrompt(q, message, respond) ?? true : false),   // QUEST-AUDIT III PROMPT-HELD: false - no box, the prompt is spent at once
    // QG1: PromptMulti's box - 2-4 BUTTONS.RCI records, the click
    // answering the record number back (the action routes by value)
    showPromptMulti: (q, message, buttons, respond) => (ctx.showPromptMulti ? ctx.showPromptMulti(q, message, buttons, respond) ?? true : false),
    // QL4: the questlines' `ask` - the question's message, then a pick among 2-4 choices' messages, the index back
    showChoice: (q, message, choices, respond) => ctx.showChoice?.(q, message, choices, respond),
    playVideo: (name) => ctx.playVideo?.(name),
    playSound: (id) => ctx.playSound?.(id),
    playSong: (name) => ctx.playSong?.(name),
    giveItemToPlayer: (item, front) => ctx.giveItemToPlayer?.(item, front),
    removeItemFromPlayer: (item) => ctx.removeItemFromPlayer?.(item),
    playerHasItem: (item) => ctx.playerHasItem?.(item) ?? false,
    carriesQuestItem: (item) => ctx.carriesQuestItem?.(item) ?? false,
    keepsQuestItem: (item) => (ctx.keepsQuestItem ?? ctx.carriesQuestItem)?.(item) ?? false,   // AUDIT QA3 B8: anywhere the player keeps it (the reclaim's read)
    releaseQuestItem: (uid, item) => ctx.releaseQuestItem?.(uid, item),
    makeHeldQuestItemsPermanent: (uid, sym) => ctx.makeHeldQuestItemsPermanent?.(uid, sym),
    offerReward: (q, item) => ctx.offerReward?.(q, item),
    // QL1/QL3 (bible/06-Systems/Questlines-Arc.md): the layer's two answers to the machine - a starting quest's stamp and
    // a paying quest's reward. Late-bound: the layer is made below, over this machine and its lists.
    questlinesStamp: (q) => questlines?.stamp(q) ?? null,
    questReward: (q, item, resource) => questlines?.reward(q, item, resource) ?? null,
    questEnding: (q) => questlines?.ending(q) ?? null,
    isPlayerInTown: () => ctx.isPlayerInTown?.() ?? false,
    partySize: () => ctx.partySize?.() ?? 1,   // REALM P0.4: a shared quest's gold, split
    partyHas: (acct) => ctx.partyHas?.(acct) ?? true,   // AUDIT QA3 E1: the sharer of a received copy, still in the party
    // AUDIT 58: DaggerfallUI.Awake's one subscription to GivePc's
    // static OnOfferPending event (DaggerfallUI.cs:352) - the handler
    // latches the sender and nothing else (:1731-1735). The two key
    // presses that spend the latch live in the hosts' rest and
    // fast-travel doors, through ui/pendingOffer.js's giveOffer().
    // That is the WHOLE of the subscription - no host fan-out to
    // forget to mount, because DFU has no second subscriber.
    onOfferPending: (givePc) => noteOfferPending(givePc),
    getGuild: (fid) => ctx.getGuild?.(fid) ?? null,
    regionPriceAdjustment: () => ctx.regionPriceAdjustment?.() ?? 0,
    changeReputation: (fid, amount, propagate) => ctx.changeReputation?.(fid, amount, propagate),
    changeLegalRep: (amount) => ctx.changeLegalRep?.(amount),
    makePcDiseased: (t) => ctx.makePcDiseased?.(t),
    cureDisease: (t) => ctx.cureDisease?.(t),
    endVampirism: () => ctx.endVampirism?.(),
    endLycanthropy: () => ctx.endLycanthropy?.(),
    // the talk seams (the talk arc's consumers; silent while absent)
    addQuestTopics: (q) => ctx.addQuestTopics?.(q),
    relinkQuestTopics: (q) => ctx.relinkQuestTopics?.(q),   // AUDIT 68 S29-share-topics: a resync's rebuilt resources
    dialogLink: (...a) => ctx.dialogLink?.(...a),
    addDialog: (...a) => ctx.addDialog?.(...a),
    addQuestRumor: (uid, m) => ctx.addQuestRumor?.(uid, m),
    addProgressRumor: (uid, m) => ctx.addProgressRumor?.(uid, m),
    addQuestorPostMessage: (uid, m) => ctx.addQuestorPostMessage?.(uid, m),
    removeProgressRumors: (uid) => ctx.removeProgressRumors?.(uid),
    removeQuestorPostMessage: (uid) => ctx.removeQuestorPostMessage?.(uid),
    removeQuestRumors: (uid) => ctx.removeQuestRumors?.(uid),
    removeQuestInfoTopics: (uid) => ctx.removeQuestInfoTopics?.(uid),
    undiscoverBuilding: (buildingKey, buildingName) => ctx.undiscoverBuilding?.(buildingKey, buildingName),   // AUDIT 63 F0: Quest.cs:655's tombstone sweep
    forceTopicListsUpdate: () => ctx.forceTopicListsUpdate?.(),
    addFace: (r) => ctx.addFace?.(r),
    dropFace: (r) => ctx.dropFace?.(r),
    // Q4-iv: the tombstone filing lands in the notebook here
    // QL3: and a stamped quest's outcome filed with it - the archive says how it ended (the layer settled it a moment
    // before, at the same `end quest`). AUDIT QUESTLINES UI-5: as the entry's side record (notebook.js
    // fileFinishedOutcome), never a line of DFU's classic logbook - the enhanced archive draws it
    addFinishedQuest: (messages) => {
      notebook.addFinishedQuest(messages);
      const line = questlines?.outcomeLine(messages?.[0]?.parentQuest, quietText);
      if (line) notebook.fileFinishedOutcome?.(line);
    },
    // the one-time recording IS the OnQuestStarted subscription
    onQuestStarted: (q) => { questLists.noteQuestStarted(q); ctx.onQuestStarted?.(q); },
    // FE1: the tombstone's OnQuestEnded (QuestMachine.cs:1047) - the
    // HUD escort faces' quest-end sweep rides the world ctx
    // AUDIT QUESTLINES LINES-7: and a questline's step gone without its end (an error terminated it) is offered again a day
    // later, never parsed again every tick
    // WITCH1: and a quest done is a Witches' Festival find (systems/festival/festivalClient.js - nothing while it is not live)
    onQuestEnded: (q) => { questlines?.runner?.dropped?.(q); festivalQuestEnded(q); ctx.onQuestEnded?.(q); },
  });
  // QL4 (bible/06-Systems/Questlines-Arc.md section 2.3): the questlines' six actions, after DFU's 82 - here, so every
  // host's machine has them before a save or a script that says them is read (a first-match scan; none of DFU's claims
  // these lines - test/systems/questlines/ql4_actions.test.js).
  for (const template of questlineActionTemplates()) machine.registerAction(template);
  // MACRO-ONE: this machine's hooks are the page's GameManager for every
  // macro walk that is not handed a context of its own (questMacros.js
  // setMacroWorld) - one registration, every window, every host.
  setMacroWorld(() => machine.macroContext());

  questLists = new QuestListsManager({
    readListTable: (name) => ctx.data.readListTable(name),
    getQuestSourceLines: (name) => ctx.data.getQuestSourceLines(name),
    parseQuest: (lines, factionId, partialParse) =>
      machine.parseQuestForLists(lines, factionId, { partialParse }),
    // AUDIT 24 (the seven-slice sweep): a LIVE read, not a hardcoded
    // false. DaggerfallUnity.Settings.PlayerNudity is a real setting
    // the port already stores and the launcher already renders as a
    // toggle - and questLists.js:"|| (quest.minReq >= 10 && quest.minReq <= rep)" gates adult quests on it, so
    // flipping it did nothing at all. A GETTER because C# reads the
    // setting at the point of use, and the consumer reads
    // `deps.playerNudity` as a value.
    get playerNudity() { return getBool('ChildGuard', 'PlayerNudity'); },
  });

  const offerFlow = new QuestOfferFlow(machine, questLists, {
    isPlayerInsideCastle: () => ctx.isPlayerInsideCastle?.() ?? false,
    removeNpcQuestor: (seed) => ctx.removeNpcQuestor?.(seed),
    getGuildFactionId: (g) => ctx.getGuildFactionId?.(g) ?? 0,
    // likewise: offerFlow.js:"NONMEMBER, rank =" branches on this and the launcher
    // offers it, so the list-box arm was unreachable. Defaults off,
    // which is the classic random draw.
    get guildQuestListBox() { return getBool('Enhancements', 'GuildQuestListBox'); },
    // L10N3c: DaggerfallGuildServicePopupWindow.cs:637's GetLocalizedQuestDisplayName - the list box's label in the
    // player's language, '' (the quest's own DisplayName) where the language has no -LOC file for it
    getLocalizedQuestDisplayName: (questName) => localizedQuestDisplayName(questName),
    sharedClock: () => !!ctx.sharedClock?.(),   // REPUTE-GATE: online, two Mages Guild quests wait for their headers' standing
  });

  // QL1 (bible/06-Systems/Questlines-Arc.md decision 2): THE QUESTLINES' LAYER, made here once over this machine and its
  // lists (THE ONE CONSTRUCTION SEAM - every host with quests holds this bridge). It never runs a quest; it reads them.
  // Its host doors are closures over ctx, so this file stays the one place the bridge's contract is read from.
  // QL12: the account service's door for the endgame lines (questlineHost.js) - a host's own (a test's fake, or null
  // to have none) where it hands one, else the page's: online, the stored session's
  const qlService = ctx.questlineService !== undefined ? ctx.questlineService : questlineService();
  questlines = createQuestlines({
    machine, questLists, service: qlService,
    ctx: {
      carriesQuestItem: (r) => ctx.carriesQuestItem?.(r) ?? false,
      get playerEntity() { return ctx.playerEntity ?? null; },
      changeReputation: (fid, amount, propagate) => ctx.changeReputation?.(fid, amount, propagate),
      changeLegalRep: (amount) => ctx.changeLegalRep?.(amount),
      // AUDIT QUESTLINES REWARD-13: the door a taken piece goes through, only where the host has one (the ?exterior host
      // has none: its offers wait, untaken, for a host that does)
      get offerReward() { return typeof ctx.offerReward === 'function' ? (q, item) => ctx.offerReward(q, item) : undefined; },
      // a choice of gear waits: told in the host's own HUD line (every host has one), and to the host's own listener.
      // AUDIT QUESTLINES UI-6 (REWARD-8): the line names the way to the Quests tab on the skin worn (qlJournal.js)
      onQuestlineOffer: (offer) => {
        ctx.addHUDText?.(offerWaitingWords(offer));
        ctx.onQuestlineOffer?.(offer);
      },
      // AUDIT QUESTLINES REWARD-8: an offer the cap cut (qlLayer.js OFFERS_MAX) is said, never lost unsaid
      onOfferDropped: (offer) => ctx.addHUDText?.(t('ql.reward.dropped', 'Too many rewards wait: the one for {title} is gone.', { title: offer.title })),
      // QL12: the lines - the character's clock, whether there is an account to claim for, and what the service paid
      nowSeconds: () => ctx.classicSeconds?.() ?? 0,
      online: () => serviceReady(qlService),
      expand: (q, text, key) => quietText(q, text, key),
      // AUDIT QUESTLINES SERVICE-7: a title is the house's HONOUR-BANNER as every title grant is (the line, the record, either
      // way); the key's balance restacks the pack's keys at once (weirKey.js: the item is the balance's face)
      // AUDIT QUESTLINES LINES-4: a key kept that the account had already taken is said, never silent
      onHonour: ({ title, key, keys, keyHeld }) => {
        if (title) { announceHonour('title', title); ctx.addHUDText?.(t('ql.line.honourTitle', 'You have earned the title {title}.', { title: TITLE_TEXT[title] ?? title })); }
        if (key) ctx.addHUDText?.(t('ql.line.honourKey', 'A Weir Key is yours: it waits with your keys.'));
        if (keyHeld && !key) ctx.addHUDText?.(t('ql.line.honourKeyHeld', 'The Covens\u2019 Hoard gives one Weir Key to an account, and yours was given already.'));
        if (key && Number.isSafeInteger(keys) && ctx.playerEntity?.items) restackWeirKeys(ctx.playerEntity.items, keys);
      },
    },
  });

  // QL-OFFERED (scenes/quest/questlineOffers.js): THE QUESTLINES ON OFFER, posted where the player asks - the notice board
  // (read through its one door, ui/noticeDoor.js), a giver's door (offerGuildQuest, offerSocialQuest below) and the Quests
  // tab (journalClean.takeLine) - and taken there, the take said in the host's HUD line
  const lineOffers = createQuestlineOffers({
    machine, questlines, rowsOf: tokensToRows,
    ctx: {
      say: (text) => ctx.addHUDText?.(text), nowSeconds: () => ctx.classicSeconds?.() ?? 0,
      isPlayerInsideCastle: () => ctx.isPlayerInsideCastle?.() ?? false, removeNpcQuestor: (seed) => ctx.removeNpcQuestor?.(seed),
    },
  });
  setLineBoard(() => lineOffers.board());

  // QL12 (Questlines-Arc.md section 4.4): THE GUILDS' LADDERS, read for the window - each guild the player is a member of,
  // its list's quests by rank, named as the journal names them (the pack's DisplayName, a translation's where one is)
  // AUDIT QUESTLINES UI-19: kept while the text stands - a locale switched, or its documents loaded, reads them again
  const ladderTitles = new Map();
  let ladderTitlesAt = -1;
  const questTitle = (name) => {
    if (ladderTitlesAt !== textRevision()) { ladderTitles.clear(); ladderTitlesAt = textRevision(); }
    if (!ladderTitles.has(name)) {
      const lines = ctx.data?.getQuestSourceLines?.(name) ?? [];
      const shipped = (lines.find((l) => /^\s*DisplayName:/i.test(l)) ?? '').replace(/^\s*DisplayName:\s*/i, '').trim();
      ladderTitles.set(name, localizedQuestDisplayName(name) || shipped || name);
    }
    return ladderTitles.get(name);
  };
  const factionWords = (fid) => {
    let name = '';
    try { name = String(factionsTable().getKeyForValue('p3', String(fid)) ?? '').replace(/_/g, ' '); } catch { /* the tables not loaded: the id stands */ }
    return getLocalizedFactionName(fid, name || String(fid));
  };
  function ladderRows() {
    // AUDIT QUESTLINES LINES-5, LINES-16: the level (two guilds offer by it) and the adult setting, as the list reads them
    return guildLadders({ memberships: activeMemberships(ctx.playerEntity ?? null), pools: questLists.guilds, history: questlines.history(), level: ctx.playerEntity?.level ?? 1, adult: getBool('ChildGuard', 'PlayerNudity') })
      .map((l) => ({ ...l, name: factionWords(l.factionId), rungs: l.rungs.map((r) => ({ ...r, quests: r.quests.map((q) => ({ ...q, title: questTitle(q.name) })) })) }));
  }

  // QL11: the features' acts (systems/questlines/qlActs.js noteAct) reach this layer - the page's one bridge, as the
  // macro world is (setMacroWorld above)
  setActSink((kind, n) => questlines.act(kind, n));

  // QuestMachine.Update's pacing (QuestMachine.cs:305-320): tick at
  // ticksPerSecond of REAL time; the timer resets to ZERO on fire,
  // dropping the excess, verbatim.
  let updateTimer = 0;
  function tick(dtSeconds) {
    updateTimer += dtSeconds;
    if (updateTimer < 1 / TICKS_PER_SECOND) return false;
    machine.tick();
    updateTimer = 0;
    questlines.look();   // QL1: what each stamped quest's state has shown, latched
    news();
    return true;
  }

  // GUIDE3: THE NEWS - one lens look after each machine tick, handed to
  // the herald (ui/quest/questHerald.js), and only while it is listening (the
  // enhanced skin, its switch on), so a player who never hears it never
  // pays for the look. Here rather than in a host because every host
  // that has quests ticks this bridge (THE ONE CONSTRUCTION SEAM): the
  // news reaches all of them at once. A herald that starts listening
  // mid-game hears a baseline first, never the backlog of whatever
  // happened while it was off - the lens's: a look after a stretch with
  // no look is one (AUDIT GUIDE L8), and a lens the tracker kept looking
  // has no backlog, only this tick's news (AUDIT GUIDE H11: a flag of the
  // bridge's own dropped that tick). The look is the lens's quiet one
  // (GUIDE1's pin plays a game with a look at every tick and without:
  // the same save, the same popups, the same draws), and a look that
  // throws costs the news and never the frame: the machine has ticked.
  //
  // GUIDE4: THE TRACKER hears the same look - every one, the baseline
  // included, because what it shows is the quests as they stand and not
  // only what changed - and the look answers the host's own two questions
  // (`ctx.questWhere`: is a place on the player's map, which place is the
  // player in - GUIDE2's gates), so the card can say "(you are here)".
  let newsWarned = false, lookedLast = false, textHour = null;
  const warnNewsOnce = (err) => {
    if (newsWarned) return;
    newsWarned = true;
    console.warn(`[quest herald] the lens could not look (${err?.message ?? err}); the news is silent, the machine is not`);
  };
  // GUIDE5: THE QUEST THE PLAYER FOLLOWS has two faces now - the tracker's
  // card and the marks (ui/quest/questMarks.js) - and one model (questTracker):
  // it hears every look while either face is on, and when neither is, what
  // it followed is forgotten here (the player's tracked choice is the
  // save's and stays).
  function news() {
    const herald = heraldOn(), follow = followOn();
    // AUDIT GUIDE T3: the tracked quest is let go when it is gone - every tick, faces on or off, so no save carries
    // a uid a later quest could be minted under (the uid counter is re-derived from the loaded quests, Q4-iv)
    if (questTracker.pinned != null) {
      const q = machine.quests.get(Number(questTracker.pinned));
      if (!q || q.questComplete || isShelved(q)) questTracker.pinned = null;   // QUEST-SHELF: one set aside is let go too
    }
    if (!follow && (questTracker.views.length || questTracker.follow != null)) questTracker.forget();
    if (!herald && !follow) { lookedLast = false; return; }
    // AUDIT GUIDE L8/T8: a look after a stretch with no look at all is a baseline, not a diff against the look before
    // the gap - its "news" would be the backlog in the walk's order, and the card would follow the last of it
    if (!lookedLast) lens.reset();
    lookedLast = true;
    // AUDIT GUIDE L6: a kept line whose macros read the world as it is (a clock's days, %di) is read again each game
    // hour - the card's opening says what the journal says now
    // TIME3: on either clock's hour - a clock's days run on the character's, %di and the dates on the sky's
    const hour = `${Math.floor((ctx.classicSeconds?.() ?? 0) / 3600)}|${Math.floor((ctx.skySeconds?.() ?? 0) / 3600)}`;
    if (textHour !== hour) { if (textHour != null) lens.rereadText(); textHour = hour; }
    // AUDIT GUIDE L4: the look AND its listeners: a face that throws costs the news, never the frame
    try {
      const seen = lens.look(ctx.questWhere ?? {});
      if (follow) questTracker.hear(seen);
      if (herald) questHerald.hear(seen);
    } catch (err) { warnNewsOnce(err); }
  }

  /** GetRaceFromFaction's two inputs, off the machine's own world. */
  const npcRaceLookups = () => ({
    getFaction: (id) => ctx.world?.getFactionData?.(id) ?? null,
    raceOfCurrentRegion: () => ctx.world?.currentRegionRace?.() ?? 0,
  });

  // GUIDE1: the quest lens is made HERE, once, over this bridge's own
  // walk - THE ONE CONSTRUCTION SEAM: every host that has quests holds
  // the bridge, so no host builds a lens of its own - and a load resets
  // it (restore, below), so the loaded game's quests are its baseline.
  const lens = new QuestLens({ questLog: () => bridge.questLog({ windows: false }) });   // AUDIT QUESTLINES LAW-11: a look a tick reads no line or ladder

  const bridge = {
    machine, questLists, offerFlow, notebook, lens, questlines, lineOffers,
    tick,

    /**
     * MAC-K2 - THE QUEST WALK, ONE HOME.
     *
     * `{active, finished, ended}`: one row per live quest that has
     * written a log entry, its messages in the machine's own order
     * (and, GUIDE1, the step each was written at), and the TIGHTEST
     * RUNNING clock on the quest's resources (Clock carries
     * `remainingTimeInSeconds` in game seconds beside
     * `clockEnabled`/`clockFinished`, quest/clock.js:"this.startingTimeInSeconds = 0".."this.remainingTimeInSeconds = 0;" - AUDIT REST
     * III D6: the fields, where an off-by-one and a comment line stood). The
     * archive is the notebook's filed entries; `ended` the completed
     * quests the machine still holds, with their verdict.
     *
     * IT WAS WRITTEN THREE TIMES - world.js's pause hooks,
     * dungeonContext.js's, and exterior.js's `pauseQuestLog`, whose own
     * comment said "world.js keeps two copies of this walk; two copies
     * is two laws the day one of them moves". MAC-K2 needed a FOURTH
     * reader (the chronicle's Quests section, which is what the L key
     * opens), so the walk moved here instead - the bridge is the one
     * thing every host that has quests already holds.
     * AUDIT QUESTLINES LAW-11: `windows: false` (the lens's look, a tick at 10 Hz) leaves out the questlines' and the
     * guilds' ladders' rows - the windows' alone, each a walk of its own.
     */
    questLog({ windows = true } = {}) {
      const active = [];
      // GUIDE1: a quest that has COMPLETED - its log is gone
      // (Quest.getLogMessages answers null) but it lingers a week as a
      // tombstone - with the verdict the notebook files it under
      // ('completed' when the quest paid out, notebook.js
      // _createFinishedQuest). The quest lens reads it to say how a
      // quest it was showing ended.
      const ended = [];
      // QUEST-SHELF (2026-10-08): the quests set aside - walked as the running ones are, their clocks as they stopped
      // (frozen: no time counts while one is away), for the journal's Abandoned list and its Reclaim
      const shelved = [];
      const unlogged = [];   // QL2: stamped quests whose objectives stand before their first journal entry
      for (const q of machine.quests.values()) {
        if (q.questComplete) {
          notebook?.unhideQuest?.(q.uid);   // JOURNAL-CLEAN: an ended quest is no longer hidden (one that filed no entry never reached addFinishedQuest's drop)
          ended.push({ id: String(q.uid), name: q.displayName || null, questName: q.questName || '', success: !!q.questSuccess, ql: questlines.rowOf(q, quietText) });   // QL1: its outcome
          continue;
        }
        const les = q.getLogMessages();
        if (!les?.length) {
          // QL2: a stamped quest with no journal entry yet, whose objectives the machine has opened - the pause tab's
          const ql = isShelved(q) ? null : questlines.rowOf(q, quietText);
          if (ql?.objectives?.length) unlogged.push({ id: String(q.uid), name: q.displayName || null, questName: q.questName || '', ql });
          continue;
        }
        // GUIDE1: each message beside the step it was written at -
        // `steps[i]` is `messages[i]`'s - so a face can order the
        // entries by when they were written (ui/quest/questRail.js
        // writtenOrder) and tell a new one from one it has read.
        const messages = [], steps = [];
        for (const le of les) {
          const message = q.getMessage(le.messageID);
          if (!message) continue;
          messages.push(message);
          steps.push({ stepID: le.stepID, messageID: le.messageID, time: le.time ?? null });
        }
        if (!messages.length) continue;
        let clockSeconds = null;
        const clocks = [];   // AUDIT GUIDE H1: each counting clock by name - the lens counts only one the journal names
        // REST8 (2026-10-03, bible/06-Systems/Rest-Arc.md section 8; Mac's OPEN 12): online a DELAY is no time left to
        // show - it lands on the short wait (quest/clock.js waitsShort) - so the walk skips it, and no surface it feeds
        // counts a letter down; a DEADLINE keeps its "Time remains", its rail line and the herald's urgency, in played
        // time. TIMEFREE's walk skipped every clock online.
        for (const r of q.resources.values()) {
          if (r.waitsShort) continue;   // REST8
          if (r.clockEnabled && !r.clockFinished && Number.isFinite(r.remainingTimeInSeconds) && clockCounts(q, r)) {   // DEAD-CLOCK
            const left = isShelved(q) ? r.remainingTimeInSeconds : r.liveRemainingSeconds(q);   // QT-LIVE1: as of NOW, not as of the last tick the pause gate let through; QUEST-SHELF: set aside, as it stopped
            clockSeconds = clockSeconds == null ? left : Math.min(clockSeconds, left);
            clocks.push({ name: r.symbol?.name ?? '', seconds: left });
          }
        }
        // QUEST-AUDIT III NAMED-TIMER: the journal windows' "Time remains" is the deadline the entries name where they name
        // one (the lens's own law, AUDIT GUIDE H1) - the tightest counting clock showed a letter's six hours as urgent beside
        // "I have 236 days to rescue her" (B0B00Y00, K0C00Y03, N0B00Y09). A quest whose entries name none keeps the tightest
        // (DEAD-CLOCK, PX5 - whether such a clock should leave the windows too is still the owner's call). Read for the
        // windows' walk alone: the lens's look reads `clocks`
        if (windows) {
          const named = new Set();
          for (const m of messages) for (const c of clocksNamed(m)) named.add(c);
          const told = clocks.filter((c) => named.has(c.name)).map((c) => c.seconds);
          if (told.length) clockSeconds = Math.min(...told);
        }
        (isShelved(q) ? shelved : active).push({ id: String(q.uid), name: q.displayName || null, questName: q.questName || '', clockSeconds, clocks, messages, steps, ql: questlines.rowOf(q, quietText) });   // QL1: its objectives, choices and outcome - null for DFU's quest
      }
      // JOURNAL-CLEAN: `hidden` is the uids the player hid from the journal. The rows stay in `active` - the lens,
      // the tracker and the marks read this walk and a hidden quest still runs - and the journal's rail
      // (ui/quest/questRail.js) is what leaves them out.
      // AUDIT JOURNAL-CLEAN F3: an id hidden for a quest no longer running is dropped - whatever ended it
      notebook?.pruneHiddenQuests?.([...machine.quests.values()].filter((q) => !q.questComplete).map((q) => q.uid));
      return { active, finished: notebook?.getFinishedQuests() ?? [], ended, hidden: notebook?.getHiddenQuests?.() ?? [], shelved, unlogged, lines: windows && questlinesOn() ? questlines.lineRows() : [], ladders: windows && questlinesOn() ? ladderRows() : [] };   // QL12: the questlines and the guilds' ladders - none while they are off
    },

    /**
     * JOURNAL-CLEAN (2026-09-30, Discord: "Should there be a way to clean both finished and unfinished quests from
     * your journal for a cleaner look?"): the enhanced journal's four tidy-ups, one home - every host that hands its
     * pause window `questLog` hands `journalClean` beside it (world.js, worldModes.js through world.js's host,
     * exterior.js, dungeonContext.js). Removing an archived entry and clearing the archive act on the notebook's
     * filed entries (the classic logbook's right-click remove, ui/quest/questJournal.js removeEntry, is the same store);
     * hide/unhide only file a uid in the notebook's hidden list, which saves with the notebook.
     */
    journalClean: {
      /** The archived entry at notebook index `i` (the rail's `f:<i>` key); answers whether one went. */
      removeFinished(i) {
        if (!notebook || !Number.isInteger(i) || i < 0 || i >= notebook.getFinishedQuests().length) return false;
        notebook.removeFinishedQuest(i);
        return true;
      },
      /** Every archived entry; answers how many went. */
      clearFinished() {
        const n = notebook?.getFinishedQuests().length ?? 0;
        notebook?.clearFinishedQuests();
        return n;
      },
      hide: (id) => notebook?.hideQuest(id) ?? false,
      unhide: (id) => notebook?.unhideQuest(id) ?? false,
      /**
       * QUEST-SHELF (2026-10-08, Mac: "All quests should be able to be abandoned and reclaimed"): ABANDON - the quest
       * set aside, kept (machine.js shelveQuest; its words, shelfRefusalText). Beside the journal's tidy-ups, so every host
       * that hands its pause window `journalClean` hands these too. Refused for a raid the world runs (WA_RAID_QUESTS - the
       * sea's own, ended by its fight) and for one that is not running. Answers `{ ok, reason?, text }`.
       */
      abandon(id) {
        const r = machine.shelveQuest(Number(id), { refuse: refuseRaid });
        if (r.ok && questTracker.pinned != null && Number(questTracker.pinned) === Number(id)) questTracker.pinned = null;
        // QUEST-AUDIT III SHELF-WORDS: in the player's language, and the door named that both journals can say it beside
        // (the chronicle has no Reclaim of its own)
        return { ...r, quest: undefined, text: r.ok ? `${t('pause.journal.abandonedSaid', 'Abandoned: {name}. You can reclaim it from the Quests tab of the pause menu.', { name: r.quest.displayName || r.quest.questName })}${r.quest.shelvedItems?.length ? ` ${t('pause.journal.shelfItemsFree', 'You can throw its items away now. They come back if you reclaim it.')}` : ''}` : shelfRefusalText(r.reason) };
      },
      /** QUEST-SHELF: RECLAIM - the quest back as it was (machine.js reclaimQuest), on the journal's page: one the player
       *  had hidden is shown again (its audit - taken up again, it was put where no row showed it). Answers
       *  `{ ok, reason?, text }`. */
      reclaim(id) {
        const r = machine.reclaimQuest(Number(id));
        if (r.ok) notebook?.unhideQuest?.(id);
        return { ...r, quest: undefined, text: r.ok ? `${t('pause.journal.reclaimed', 'Reclaimed: {name}.', { name: r.quest.displayName || r.quest.questName })}${r.returned ? ` ${t('pause.journal.shelfItemsBack', '{n, plural, one {Its item is back in your pack.} other {Its items are back in your pack.}}', { n: r.returned })}` : ''}` : shelfRefusalText(r.reason) };
      },
      /** QUEST-SHELF: whether the quest may be abandoned now - the journal draws the button only where it is. */
      canAbandon: (id) => machine.shelveRefusal(Number(id), { refuse: refuseRaid }) === null,
      /** QUEST-RESET (LostMyLeg: "an option that can fully reset a quest"): RESTART - the quest thrown away and started
       *  again from its first step (machine.js restartQuest); the tracker follows it to its new copy. Answers
       *  `{ ok, reason?, uid?, text }` - `uid` the new copy's. */
      restart(id) {
        const r = machine.restartQuest(Number(id), { refuse: refuseRaid });
        if (r.ok && questTracker.pinned != null && Number(questTracker.pinned) === Number(id)) questTracker.pinned = String(r.quest.uid);
        return { ok: r.ok, reason: r.reason, uid: r.quest?.uid, text: r.ok ? t('pause.journal.restarted', 'Restarted: {name}. It begins again from its first step.', { name: r.quest.displayName || r.quest.questName }) : restartRefusalText(r.reason) };
      },
      /** QUEST-RESET: whether the quest may be restarted now - the journal draws the button only where it is. */
      canRestart: (id) => machine.restartRefusal(Number(id), { refuse: refuseRaid }) === null,
      /** STORY-AGAIN (#982, "Add way to reset a failed mandatory main quest"): the main story's failed steps that may be
       *  started again (machine.js storyAgainRefusal), each `{ questName, title }` - the journal's Main Quests draw them. */
      storyAgain: () => machine.storyAgainQuests().map((n) => ({ questName: n, title: questTitle(n) || n })),
      /** STORY-AGAIN: start the failed step again from its first step (machine.js startStoryAgain) - its questor offers
       *  it once more. Answers `{ ok, reason?, uid?, text }` - `uid` the new copy's. */
      startStoryAgain(questName) {
        const r = machine.startStoryAgain(questName);
        return { ok: r.ok, reason: r.reason, uid: r.quest?.uid, text: r.ok ? t('quest.story.againDone', '{name} begins again from its first step. The main story can go on.', { name: questTitle(r.quest.questName) || r.quest.displayName || r.quest.questName }) : restartRefusalText(r.reason) };
      },
      /** QL3 (bible/06-Systems/Questlines-Arc.md section 5.2): the rewards waiting to be chosen, and the take - beside the
       *  journal's tidy-ups, so every host that hands its pause window `journalClean` hands these too (the four hosts,
       *  through the one door). */
      // AUDIT QUESTLINES UI-19: a waiting reward is named in the language of the page that draws it - the quest's title as
      // the ladders name it (questTitle: a translation's, else the pack's DisplayName), never the words it was rolled in
      offers: () => questlines.offers().map((o) => ({ ...o, title: questTitle(o.questName) || o.title })),
      takeOffer: (id, index) => questlines.take(id, index),
      /** QL-OFFERED: the Quests tab's Take up - a questline on offer begun (or its first step, set aside, taken back);
       *  answers `{ ok, reason?, text }` (scenes/quest/questlineOffers.js takeUp). */
      takeLine: (id) => lineOffers.takeUp(id),
    },

    /** SetLayoutData's direct overload for a host that has a quest
     *  Person rather than a block record (worldModes' quest-flat
     *  click). AUDIT 24: it is a bridge method now so the race lookup
     *  rides along - the host used to hand-roll the object literal and
     *  leave race and context off it. */
    layoutNpcData(fields) { return layoutNpcData({ ...fields, ...npcRaceLookups() }); },

    /** PlayerActivate's questor half: derive the NPCData and store the
     *  click (the Person sweep rides setLastNPCClicked). Answers the
     *  data for the caller's own use. */
    clickNpc(pn, sceneCtx) {
      const data = staticNpcData(pn, { ...sceneCtx, ...npcRaceLookups() });
      // wave 25: the person record IS the GameObject on this side -
      // StartQuest's tail attaches the questor behaviour to it.
      machine.setLastNPCClicked(data, pn ?? null);
      return data;
    },

    /** TK-iv: the SOCIAL door - a plain static-NPC click that the NPC
     *  session's questor pool answered for. TalkToStaticNPC opens
     *  DaggerfallQuestOfferWindow instead of the talk window when the
     *  clicked NPC is carrying work (:758-770), so this is the arm
     *  that finally makes a townsperson a questor. */
    /** G7: the daedric quest a successful summoning offers - its offer step, or null when no quest can be made
     *  (SUMMON-OFFER: the summoning then spends and records nothing). */
    offerDaedricQuest(questName, summonerFactionId) {
      return offerFlow.offerNamedQuest(questName, summonerFactionId);
    },
    /** CW1: the coven popup's Quest button - the Witches pool as
     *  nonmember, homed on the witch NPC's own faction. */
    offerCovenQuest(factionId, reputation = 0) {
      return offerFlow.offerCovenQuest(factionId, reputation);
    },
    /** QL-OFFERED: `tavern` - the player stands in a tavern (the host's own read), where Corvane's, Imrah's and Hamid's
     *  lines are offered by someone with work before DFU's own draw (questlineOffers.js atTavern). */
    offerSocialQuest(npcData, socialGroup, menu = false, tavern = false) {
      return (tavern ? lineOffers.atTavern(npcData) : null) ?? offerFlow.offerSocialQuest(npcData, socialGroup, menu);
    },

    /** The guild popup's Quests service (guildServiceFlow's questOffer
     *  destination): compose the offer-flow guild surface and run the
     *  guild door. QL-OFFERED: a Mages Guild hall's questor offers Ysolde's line on offer, a temple's the Prior's, before
     *  the guild's own draw (questlineOffers.js atGuild). */
    offerGuildQuest({ guildGroup, guild, membership, reputation, buildingFactionId = 0 }) {
      return lineOffers.atGuild(guildGroup) ?? offerFlow.offerGuildQuest({
        guildGroup,
        guild: offerGuildSurface({ guildGroup, guild, membership, reputation, playerEntity: ctx.playerEntity ?? null }),
        buildingFactionId,
      });
    },

    /** An offer-flow step as a ServiceFlowWindow box chain. C#'s
     *  silent faces ('close', a null step) show nothing - but a popup's
     *  close on a questor whose quest is still open SAYS so (QUESTOR-SAID,
     *  offerFlow.js questorBusy: the guild's popup read the empty chain as
     *  no service and printed "That service is not available yet."). rows(id)
     *  is the host's TEXT.RSC record reader (townTalk.lines). */
    offerBoxes(step, rows) {
      if (!step) return [];
      switch (step.kind) {
        case 'close': return step.reason === ACTIVE_QUESTOR ? [{ rows: questorBusyRows(step.quest) }] : [];
        case 'fail': return [{ rows: rows?.(step.textId) ?? [] }];
        case 'offer': return [{
          rows: tokensToRows(step.prompt.tokens),
          buttons: 'YesNo',
          onYes: () => this.offerBoxes(step.respond(true), rows),
          onNo: () => this.offerBoxes(step.respond(false), rows),
        }];
        case 'accepted':
        case 'refused':
          return step.popup ? [{ rows: tokensToRows(step.popup.tokens) }] : [];
        // GQL1 (Discord, kurkku, 2026-09-21: "this service isn't
        // available" on every guild quest): with Choose Guild Jobs ON
        // the flow's first step is the 'gettingQuests' wait box and its
        // dismissal is the 'pickQuest' picker - and this switch boxed
        // neither, so the chain came back EMPTY, the questOffer arm
        // read empty as C#'s silent close, and the popup printed its
        // no-flow refusal. GettingQuestsBox (:610-622) is a
        // click-anywhere DaggerfallMessageBox whose generic macro pass
        // expands %pcf; its OnClose raises the DaggerfallListPickerWindow
        // (:624-652), whose pick runs OfferQuest and whose cancel just
        // pops the window.
        case 'gettingQuests': return [{
          rows: step.textLines.map((line) => expandMacroValues(line, { pcf: firstName(ctx.playerEntity?.name ?? '') })),
          onClick: () => this.offerBoxes(step.onClose(), rows),
        }];
        case 'pickQuest': return [{
          picker: step.entries,
          onPick: (index) => this.offerBoxes(step.onPick(index), rows),
          onCancel: () => [],
        }];
        default: return [];
      }
    },

    /** The scene mount (Q4-iii's walk) over the host's adapter. */
    mountScene(adapter, siteType, buildingKey = 0) {
      // QUEST-HOME (Mac, 2026-10-15: "Close both"): the player stands in this building - every quest's site here is
      // reached, and never chosen again should it become a player's home (QuestMachine.noteSiteReached)
      if (siteType === SITE_TYPES.Building) machine.noteSiteReached(adapter.currentMapId?.() ?? 0, buildingKey);
      addQuestResourceObjects(machine, adapter, siteType, buildingKey);
    },

    /** QUEST-VOID (systems/quest/questRepair.js relayBuiltDungeon): before the dungeon's mount, a quest target on a
     *  marker the dungeon as built has not is laid again on this build. `location` the built (sized) dungeon, `mapId` the mount's key for it. Answers
     *  the count of Places re-laid. */
    relayBuiltDungeon(location, mapId) {
      return relayBuiltDungeon(machine, location, { carriesQuestItem: (item) => ctx.carriesQuestItem?.(item) ?? false }, mapId);
    },

    /** QREPAIR (Mac: "Add a quest refresh option to settings" - "Repair active quests"): the one pass
     *  (systems/quest/questRepair.js) over this machine and this host's seams. Answers the report; `text` is the line
     *  the Settings row shows. */
    repair() {
      const world = ctx.world ?? null;
      return repairActiveQuests(machine, {
        discoverLocation: (region, location) => world?.discoverLocation?.(region, location),
        hasQuestTopics: ctx.hasQuestTopics ? (q) => ctx.hasQuestTopics(q) : null,
        addQuestTopics: ctx.addQuestTopics ? (q) => ctx.addQuestTopics(q) : null,
        carriesQuestItem: (item) => ctx.carriesQuestItem?.(item) ?? false,
        mountCurrentSite: () => world?.mountCurrentSiteQuestResources?.(),
      });
    },

    /** The NEW-GAME quest start, whole (StartGameBehaviour.cs:444-456).
     *
     *  AUDIT 24 (the seven-slice sweep): the port called only the
     *  InitAtGameStart half - and with vanilla tables that list is
     *  EMPTY, so a new character started no quests at all. The two
     *  lines above it in C# are hard-coded:
     *      QuestMachine.Instance.StartQuest("_TUTOR__");
     *      QuestMachine.Instance.StartQuest("_BRISIEN");
     *  _BRISIEN is the MAIN QUEST's first quest. Both files are
     *  vendored; neither had ever been parsed. TUT1: the first of the
     *  two is now the curse _TUTOR__'s close started (GAME_START_QUESTS
     *  above) - DFO's own tutorial replaces DFU's. The optional
     *  LaunchQuest arm between them has no port-side setter and is
     *  recorded rather than invented. */
    initAtGameStart() {
      for (const name of GAME_START_QUESTS) machine.startQuestByName(name);
      questLists.initAtGameStartQuests((q) => machine.startQuestImmediate(q));
    },

    onExteriorTransition() { machine.notifyExteriorTransition(); },
    onInitWorld() { machine.notifyInitWorld(); },

    /** The save envelope: the machine's shape + the notebook's + the
     *  one-time list (C# carries the last two on SerializablePlayer -
     *  :196/:434 - the port keeps them beside the machine's). */
    snapshot() {
      return {
        machine: machine.getSaveData(),
        notebook: notebook.getSaveData(),
        oneTimeQuestsAccepted: questLists.oneTimeQuestsAccepted ? [...questLists.oneTimeQuestsAccepted] : null,
        questlines: questlines.snapshot(),   // QL3: the rewards waiting to be chosen - the character's, outliving their quests
      };
    },
    restore(data) {
      if (!data) return;
      machine.clearState();   // C#'s load path: ClearState before RestoreSaveData
      offerFlow.reset();   // QUEST-UID1: an offer parsed in the game being replaced is not the loaded game's to start
      lineOffers.reset();   // QL-OFFERED: nor a questline's offer, nor a giver's rest
      clearPendingOffer();   // QUEST-AUDIT III OFFER-STALE: nor its pending hand-over (the press it would spend)
      machine.restoreSaveData(data.machine ?? { siteLinks: [], quests: [] });
      // AUDIT DELVE E1: online the room builds every dungeon at its own size (SD-ONLINE: the world's), so a quest frozen
      // at another offline has its dungeon markers enumerated again on the room's build (questRepair.js
      // relayOnlineDungeons) - before anything mounts
      if (isOnlinePage()) relayOnlineDungeons(machine, { carriesQuestItem: (item) => ctx.carriesQuestItem?.(item) ?? false });
      // MEDIUM-DISTINCT: a medium dungeon that laid one interior block twice lays two now, so a quest at a medium size
      // has its markers enumerated again where its dungeon's layout moved (questRepair.js relayMovedLayouts) - online and off
      relayMovedLayouts(machine, { carriesQuestItem: (item) => ctx.carriesQuestItem?.(item) ?? false });
      retireDfuTutorial(machine);   // TUT1: a save still in DFU's tutorial leaves it, as its No would have
      // AUDIT 26 F102: DFU restores the notebook only when the save
      // CARRIES one (`if (!string.IsNullOrEmpty(notebookDataJson))`,
      // SaveLoadManager.cs:1451-1456) - the empty-block substitute
      // wiped every note and filed quest of the session on an
      // old-version envelope.
      if (data.notebook) notebook.restoreSaveData(data.notebook);
      // STORY-AGAIN (#982): a save from before the story's record reads it off the journal's archive, once
      machine.seedStory(notebook.getFinishedQuests().map((e) => e[0]?.render).filter((r) => r?.kind === 'quest'));
      // AUDIT JOURNAL-CLEAN F3: ...and at the load, before any new quest can take a uid a stale id names
      notebook?.pruneHiddenQuests?.([...machine.quests.values()].filter((q) => !q.questComplete).map((q) => q.uid));
      questLists.oneTimeQuestsAccepted = data.oneTimeQuestsAccepted ? [...data.oneTimeQuestsAccepted] : null;
      questlines.restore(data.questlines);   // QL3: an older envelope carries none - nothing waits
      lens.reset();   // GUIDE1: a loaded game is not news
      questTracker.forget();   // GUIDE4: ...nor what the last game's card followed (the tracked quest is the save's own record)
      questHerald.clear();   // AUDIT GUIDE O2: ...nor the last game's news - a notice standing over the loaded game could merge a same-uid quest's news under its verdict
    },
  };
  return bridge;
}
