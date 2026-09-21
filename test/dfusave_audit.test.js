// AUDIT-DFUSAVE (2026-09-21) - the pins the audit of the DFU save
// import arc (DFUSAVE1-3) left behind. Three read-only lanes went over
// the converter against the DFU C#, the reader against Full Serializer
// and the door, and the arc's own pins against the code; what they
// found is fixed in the arc's modules and pinned HERE, one pin per
// finding, so a regression names the finding it undoes. The struct
// pin regenerates the C# save structs' field lists from the reference
// clone (PY1's DFU_PATH) and holds the fixture to printing every field
// and the converter to reading none the C# does not declare - the
// audit's first question, asked of the code every run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDfuSave, parseFsJson, unwrapFs, enumValue } from '../src/formats/dfuSave.js';
import * as E from '../src/formats/dfuEnums.js';
import {
  dfuSaveToSnapshot, dfuDateToSeconds, dfuItem, dfuSpell, dfuActiveEffects, dfuAnchor, dfuTalk, dfuDiscovery, flagIndex,
} from '../src/systems/dfuSaveImport.js';
import { importDfuSaves } from '../src/systems/dfuSaveDoor.js';
import { v1, pairs, shapeItem, shapeTalk, shapeQuestMachine, dfCareer, buildDfuSaveFiles, classicMinutesToSeconds } from './dfuSaveFixture.mjs';
import { dfuFile, missingDfu } from './dfuRoot.mjs';
import { SAVE_DATA_PREFIX, SAVE_INFO_PREFIX, SAVE_SHOT_PREFIX, screenshotOf, loadSlot } from '../src/systems/saveSlots.js';
import { ITEM_IDENTIFIED_MASK, ITEM_ARTIFACT_MASK, CLASSIC_RECIPE_KEYS } from '../src/systems/loot.js';
import { dateToSeconds } from '../src/systems/gameDate.js';
import { spellPoints, spellPointMultiplier } from '../src/systems/chargen.js';
import { levelUpSkillSum } from '../src/systems/advancement.js';
import { VAMPIRE_SPELL_TAG, LYCANTHROPY_SPELL_TAG } from '../src/systems/lycanthropy.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { GUILD_GROUPS } from '../src/formats/factionFile.js';
import { RumorMill } from '../src/systems/rumorMill.js';
import { TopicTree, newQuestResourceInfo } from '../src/systems/topicTree.js';
import { NPCSession } from '../src/systems/npcSession.js';
import { QuestMachine } from '../src/systems/quest/machine.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const SKIP_DFU = missingDfu('Assets/Scripts/Game/Serialization/SerializableGameObject.cs') && 'no DFU checkout (DFU_PATH)';

const weapon = (over = {}) => ({
  uid: 33554501, shortName: 'Broadsword', nativeMaterialValue: 3, dyeColor: 'Unchanged', weightInKg: 4.5, drawOrder: 0,
  value1: 320, value2: ((0x20 | 0x800) << 16) | 0x1234, hits1: 88, hits2: 120, hits3: (3 << 8) | 0x11,
  stackCount: 1, enchantmentPoints: 15, message: 0, legacyMagic: [1, 5, -1, 0], customMagic: null,
  playerTextureArchive: 233, playerTextureRecord: 6, worldTextureArchive: 207, worldTextureRecord: 6,
  itemGroup: 'Weapons', groupIndex: 6, currentVariant: 0, isQuestItem: false, questUID: 0, questItemSymbol: null,
  trappedSoulType: 'None', className: null, poisonType: 'None', potionRecipe: 0,
  repairData: { sceneName: null, timeStarted: 0, repairTime: 0 }, timeForItemToDisappear: 0, timeHealthLeechLastUsed: 0, artifactIndexBitfield: 0,
  ...over,
});
const open = (over = {}) => readDfuSave(0, buildDfuSaveFiles(over));

// ───────────────────────────────────────── the C# struct field lists

/**
 * The members Full Serializer prints of `name`'s body in `file`: the
 * public instance fields, `[SerializeField]` members, and public auto
 * properties; nested types, constructors, methods and computed
 * properties skipped. A second, independent reading of the C# the
 * fixture and the converter were written from.
 */
function csFields(file, name) {
  const src = readFileSync(dfuFile(`Assets/Scripts/${file}`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/^\s*#[^\n]*/gm, '');
  const m = new RegExp(`(?:public|internal)\\s+(?:partial\\s+)?(?:class|struct)\\s+${name}\\b[^{]*\\{`).exec(src);
  if (!m) throw new Error(`${name} not in ${file}`);
  // the body, with every nested body replaced by a marker that ends its segment
  let depth = 1, out = '', nested = '';
  for (let i = m.index + m[0].length; i < src.length && depth; i++) {
    const c = src[i];
    if (c === '{') { depth++; if (depth === 2) nested = ''; }
    else if (c === '}') { depth--; if (depth === 1) out += /^\s*get;\s*(?:\w+\s+)?set;\s*$/.test(nested) ? '\u0001;' : '\u0002;'; }
    else if (depth === 1) out += c;
    else if (depth === 2) nested += c;
  }
  const fields = [];
  for (const seg of out.split(';')) {
    if (seg.includes('\u0002')) continue;   // a ctor, a method, a nested type, a computed property
    const serialised = /\[SerializeField\]/.test(seg);
    const l = seg.replace(/\u0001/g, '').replace(/\[[^\]]*\]/g, ' ').trim();
    const f = (serialised
      ? /^(?:public\s+|private\s+|internal\s+)?(?!static|const)(?:readonly\s+)?[\w.<>,[\]\s?]+?\s+(\w+)\s*(?:=[^;]*)?$/
      : /^public\s+(?!static|const|class|struct|enum|delegate|event)(?:readonly\s+)?[\w.<>,[\]\s?]+?\s+(\w+)\s*(?:=[^;]*)?$/).exec(l);
    if (f) fields.push(f[1]);
  }
  return fields;
}

const SGO = 'Game/Serialization/SerializableGameObject.cs';
const STRUCTS = {
  SaveData_v1: [SGO, 'SaveData_v1'], DateAndTime_v1: [SGO, 'DateAndTime_v1'], PlayerData_v1: [SGO, 'PlayerData_v1'],
  PlayerEntityData_v1: [SGO, 'PlayerEntityData_v1'], PlayerPositionData_v1: [SGO, 'PlayerPositionData_v1'],
  ItemData_v1: [SGO, 'ItemData_v1'], ItemRepairData_v1: [SGO, 'ItemRepairData_v1'], GuildMembership_v1: [SGO, 'GuildMembership_v1'],
  RoomRental_v1: [SGO, 'RoomRental_v1'], BankRecordData_v1: [SGO, 'BankRecordData_v1'], TravelMapSaveData: [SGO, 'TravelMapSaveData'],
  SaveInfo_v1: [SGO, 'SaveInfo_v1'], ModInfo_v1: [SGO, 'ModInfo_v1'],
  QuestSaveData_v1: ['Game/Questing/Quest.cs', 'QuestSaveData_v1'], LogEntry: ['Game/Questing/Quest.cs', 'LogEntry'], QuestorData: ['Game/Questing/Quest.cs', 'QuestorData'],
  ResourceSaveData_v1: ['Game/Questing/QuestResource.cs', 'ResourceSaveData_v1'], TaskSaveData_v1: ['Game/Questing/Task.cs', 'TaskSaveData_v1'],
  ActionSaveData_v1: ['Game/Questing/QuestAction.cs', 'ActionSaveData_v1'], QuestMachineData_v1: ['Game/Questing/QuestMachine.cs', 'QuestMachineData_v1'],
  Person: ['Game/Questing/Person.cs', 'SaveData_v1'], Foe_v1: ['Game/Questing/Foe.cs', 'SaveData_v1'], Foe_v2: ['Game/Questing/Foe.cs', 'SaveData_v2'],
  Item: ['Game/Questing/Item.cs', 'SaveData_v1'], Place: ['Game/Questing/Place.cs', 'SaveData_v1'], Clock: ['Game/Questing/Clock.cs', 'SaveData_v1'],
  Symbol: ['Game/Questing/Symbol.cs', 'Symbol'], SiteLink: ['DaggerfallUnityStructs.cs', 'SiteLink'], SiteDetails: ['DaggerfallUnityStructs.cs', 'SiteDetails'],
  QuestMarker: ['DaggerfallUnityStructs.cs', 'QuestMarker'], FaceDetails: ['DaggerfallUnityStructs.cs', 'FaceDetails'],
  SaveDataConversation: ['Game/TalkManager.cs', 'SaveDataConversation'], QuestResourceInfo: ['Game/TalkManager.cs', 'QuestResourceInfo'],
  QuestResources: ['Game/TalkManager.cs', 'QuestResources'], RumorMillEntry: ['Game/TalkManager.cs', 'RumorMillEntry'], NpcWorkEntry: ['Game/TalkManager.cs', 'NpcWorkEntry'],
  NPCData: ['Game/StaticNPC.cs', 'NPCData'],
  EffectBundleSettings: ['Game/MagicAndEffects/MagicAndEffectsStructs.cs', 'EffectBundleSettings'], EffectEntry: ['Game/MagicAndEffects/MagicAndEffectsStructs.cs', 'EffectEntry'],
  SpellReference: ['Game/MagicAndEffects/MagicAndEffectsStructs.cs', 'SpellReference'],
  EffectBundleSaveData_v1: ['Game/MagicAndEffects/EntityEffectManager.cs', 'EffectBundleSaveData_v1'], EffectSaveData_v1: ['Game/MagicAndEffects/EntityEffectManager.cs', 'EffectSaveData_v1'],
  RegionDataRecord: ['Game/Entities/PlayerEntity.cs', 'RegionDataRecord'], DFCareer: ['API/DFCareer.cs', 'DFCareer'],
};

/** A maximal fixture: every knob filled, the quest and talk files from the port's own producers. */
function maximalSave() {
  const m = new QuestMachine({ nowSeconds: () => 523530 * 60 });
  const quest = { uid: 5, questComplete: false, questSuccess: false, questName: 'X', displayName: null, factionId: 0, questStartTime: 100, questTombstoned: false, questTombstoneTime: 0, smallerDungeonsState: 0, compiledByVersion: '', activeLogMessages: [{ stepID: 1, messageID: 1010, time: 120 }], messages: [{ id: 1010, lines: ['a'] }], resources: [], questors: [{ name: 'q', symbol: { original: '_q_' }, displayName: 'Q' }], tasks: [{ symbol: { original: '_t_' }, targetSymbol: null, triggered: false, prevTriggered: false, type: 'standard', dropped: false, globalVarName: null, globalVarLink: -1, hasTriggerConditions: false, actions: [{ type: 'StartTask', isComplete: false, isTriggerCondition: false, isAlwaysOnTriggerCondition: false, debugSource: null, actionSpecific: null }] }], oneTimeDisplayedMessages: [] };
  const marker = { questUID: 5, placeSymbol: { original: '_p_' }, targetResources: null, markerType: 1, flatPosition: { x: 1, y: 2, z: 3 }, dungeonX: 0, dungeonZ: 0, buildingKey: 7, markerID: 1 };
  const siteDetails = { questUID: 5, siteType: 1, mapId: 1, locationId: 2, regionIndex: 17, regionName: 'Daggerfall', locationName: 'Daggerfall', buildingKey: 7, buildingName: 'B', questSpawnMarkers: [marker], questItemMarkers: [], selectedQuestSpawnMarker: 0, selectedQuestItemMarker: 0, selectedMarker: marker, magicNumberIndex: 0 };
  const npc = { hash: 1, flags: 2, factionID: 3, nameSeed: 12, gender: 1, race: 2, context: 2, mapID: 5, locationID: 6, buildingKey: 7, nameBank: 1, billboardArchiveIndex: 182, billboardRecordIndex: 3 };
  const item = dfuItem(weapon());
  quest.resources = [
    { type: 'Clock', symbol: { original: '_c_' }, infoMessageID: -1, usedMessageID: -1, rumorsMessageID: -1, hasPlayerClicked: false, isHidden: false, resourceSpecific: { lastWorldTimeSample: 90, startingTimeInSeconds: 30, remainingTimeInSeconds: 10, flag: 0, minRange: 0, maxRange: 0, clockEnabled: true, clockFinished: false } },
    { type: 'Foe', symbol: { original: '_f_' }, infoMessageID: -1, usedMessageID: -1, rumorsMessageID: -1, hasPlayerClicked: false, isHidden: false, resourceSpecific: { spawnCount: 1, foeId: 3, humanoidGender: 0, injuredTrigger: false, restrained: false, killCount: 0, displayName: null, typeName: null, spellQueue: [{ ClassicID: 7, CustomKey: null }], itemQueue: [item] } },
    { type: 'Item', symbol: { original: '_i_' }, infoMessageID: -1, usedMessageID: -1, rumorsMessageID: -1, hasPlayerClicked: false, isHidden: false, resourceSpecific: { artifact: false, useClicked: false, actionWatching: false, allowDrop: false, playerDropped: false, madePermanent: false, item } },
    { type: 'Person', symbol: { original: '_n_' }, infoMessageID: -1, usedMessageID: -1, rumorsMessageID: -1, hasPlayerClicked: false, isHidden: false, resourceSpecific: { race: 2, nameBank: 1, npcGender: 0, faceIndex: 0, nameSeed: 1, isQuestor: true, isIndividualNPC: false, isIndividualAtHome: false, displayName: 'N', homePlaceSymbol: { original: '_p_' }, lastAssignedPlaceSymbol: null, assignedToHome: false, factionID: 0, factionTableKey: null, questorData: npc, discoveredThroughTalkManager: false, isMuted: false, isDestroyed: false } },
    { type: 'Place', symbol: { original: '_p_' }, infoMessageID: -1, usedMessageID: -1, rumorsMessageID: -1, hasPlayerClicked: false, isHidden: false, resourceSpecific: { scope: 'local', name: 'tavern', p1: 0, p2: 0, p3: 0, siteDetails } },
  ];
  const machine = { siteLinks: [{ questUID: 5, placeSymbol: { original: '_p_' }, siteType: 1, mapId: 1, buildingKey: 7, magicNumberIndex: 0 }], quests: [quest] };
  void m;
  const talk = {
    listRumorMill: [{ rumorType: 2, listRumorVariants: [[{ formatting: 'text', text: 'A rumor.', x: 0, y: 0 }]], questID: 5, timeLimit: 600, faction1: 1, faction2: 2, regionID: 17, flags: 0, type: 3, textID: 1001 }],
    dictQuestorPostQuestMessage: [{ questID: 5, tokens: [{ formatting: 'text', text: 'Thanks.', x: 0, y: 0 }] }],
    dictQuestInfo: [{ questID: 5, resourceInfo: [{ name: 'n', resourceType: 3, anyInfoAnswers: [], rumorsAnswers: [], availableForDialog: true, hasEntryInTellMeAbout: true, hasEntryInWhereIs: false, questPlaceResourceHintTypeReceived: 0, dialogLinkedLocations: [], dialogLinkedPersons: [], dialogLinkedThings: [] }] }],
    npcsWithWork: [[12, { npc, socialGroup: 1, buildingName: 'The Bank' }]],
    castleNPCsSpokenTo: [[9, true]],
  };
  const bundle = { Version: 1, BundleType: 'Spell', TargetType: 'AreaAtRange', ElementType: 'Fire', RuntimeFlags: '', Name: 'My Blast', IconIndex: 3, Icon: { key: '', index: 0 }, MinimumCastingCost: false, NoCastingAnims: false, Tag: null, Effects: [{ Key: 'Damage-Health', Settings: {}, EnchantmentParam: null }], LegacyEffects: null, StandardSpellIndex: null };
  const instanced = { version: 1, bundleType: 'Disease', targetType: 'CasterOnly', elementType: 'Magic', runtimeFlags: '', name: 'Plague', iconIndex: 0, icon: { key: '', index: 0 }, casterEntityType: 'Player', casterLoadID: 0, fromEquippedItemID: 0, castByItemID: 0, fromPoison: false, liveEffects: [{ key: 'Disease-Plague', effectSettings: {}, enchantmentParam: null, roundsRemaining: 1, chanceSuccess: true, statMods: [0, 0, -2, 0, 0, 0, 0, 0], statMaxMods: null, skillMods: null, isIncumbent: true, variantCount: 1, currentVariant: 0, effectEnded: false, effectSpecific: { incubationOver: true, lastDay: 3400, daysOfSymptomsLeft: 4 } }] };
  const first = buildDfuSaveFiles({});
  const position = JSON.parse(first['SAVEDATA.TXT']).$content.playerData.$content.playerPosition;
  const files = buildDfuSaveFiles({
    items: [weapon()], spellbook: [bundle], bundles: [instanced], anchorPosition: position, boardShipPosition: position,
    guildMemberships: [[GUILD_GROUPS.FightersGuild, { rank: 3, lastRankChange: 700, variant: 0, flags: 0 }]],
    bankAccounts: [{ accountGold: 500, loanTotal: 100, loanDueDate: 523999, regionIndex: 17, hasDefaulted: false }],
    bankDeeds: v1({ shipType: 1, houses: [] }),
    regionData: [{ Values: new Array(29).fill(0), Flags: new Array(29).fill(false), Flags2: new Array(14).fill(false), LegalRep: 0, PrecipitationOverride: 0, SeverePunishmentFlags: 0, IDOfPersecutedTemple: 0, PriceAdjustment: 1000 }],
    rentedRooms: [{ name: 'The Inn', mapID: 5, buildingKey: 6, allocatedBedIndex: 1, expiryTime: classicMinutesToSeconds(524000) }],
    escortingFaces: [{ questUID: 5, targetPerson: { original: '_p_', name: 'p' }, targetFoe: null, targetRace: 'Redguard', gender: 'Female', isChild: false, faceIndex: 4, factionFaceIndex: -1 }],
    travelMapData: { filterDungeons: false, filterTemples: false, filterHomes: false, filterTowns: false, sleepInn: true, speedCautious: true, travelShip: true },
    modInfoData: [{ fileName: 'roads.dfmod', title: 'Roads', guid: 'g', version: '1', loadPriority: 0 }],
    questData: shapeQuestMachine(machine), conversationData: shapeTalk(talk),
  });
  return { files, machine, talk };
}

test('AUDIT-DFUSAVE: the fixture prints EVERY field the C# save structs declare and the converter reads NONE they do not (regenerated from the reference clone)', { skip: SKIP_DFU }, () => {
  const F = Object.fromEntries(Object.entries(STRUCTS).map(([k, [file, name]]) => [k, csFields(file, name)]));
  for (const [k, list] of Object.entries(F)) assert.ok(list.length >= (k === 'QuestResources' ? 1 : 2), `${k}: ${list.length} fields read`);
  assert.deepEqual(F.Symbol, ['original', 'name'], 'the two [SerializeField] members, not the computed properties');
  assert.ok(F.DFCareer.includes('Name') && F.DFCareer.includes('DamageFromHolyPlaces') && !F.DFCareer.includes('CFGData'), 'DFCareer stops at its nested CFGData');
  assert.ok(F.QuestResourceInfo.includes('resourceType'), 'a field after a constructor');

  // 1. the fixture (what DFU prints) - every field, no more
  const { files } = maximalSave();
  const c = (n) => n?.$content ?? n;
  const keys = (n) => Object.keys(c(n)).filter((k) => !k.startsWith('$')).sort();
  const same = (node, struct, what) => assert.deepEqual(keys(node), [...F[struct]].sort(), `${what} prints ${struct}'s fields`);
  const sd = c(JSON.parse(files['SAVEDATA.TXT']));
  const info = JSON.parse(files['SAVEINFO.TXT']);
  same(info, 'SaveInfo_v1', 'SaveInfo.txt'); same(c(info).dateAndTime, 'DateAndTime_v1', 'the clock');
  same(sd, 'SaveData_v1', 'SaveData.txt'); same(sd.dateAndTime, 'DateAndTime_v1', 'the clock');
  const pd = c(sd.playerData); same(pd, 'PlayerData_v1', 'playerData');
  const pe = c(pd.playerEntity); same(pe, 'PlayerEntityData_v1', 'playerEntity');
  same(pd.playerPosition, 'PlayerPositionData_v1', 'playerPosition'); same(pd.boardShipPosition, 'PlayerPositionData_v1', 'boardShipPosition'); same(pe.anchorPosition, 'PlayerPositionData_v1', 'anchorPosition');
  same(pe.items[0], 'ItemData_v1', 'an item'); same(c(pe.items[0]).repairData, 'ItemRepairData_v1', 'its repair job');
  same(pd.guildMemberships[0].Value, 'GuildMembership_v1', 'a membership'); same(pe.rentedRooms[0], 'RoomRental_v1', 'a room');
  same(sd.bankAccounts[0], 'BankRecordData_v1', 'a bank account'); same(sd.travelMapData, 'TravelMapSaveData', 'the travel map');
  same(sd.escortingFaces[0], 'FaceDetails', 'an escort face'); same(pe.regionData[0], 'RegionDataRecord', 'a region row');
  same(pe.careerTemplate, 'DFCareer', 'the career'); same(sd.modInfoData[0], 'ModInfo_v1', 'a mod');
  same(pe.spellbook[0], 'EffectBundleSettings', 'a spellbook entry'); same(pe.spellbook[0].Effects[0], 'EffectEntry', 'its effect');
  same(pe.instancedEffectBundles[0], 'EffectBundleSaveData_v1', 'a live bundle'); same(pe.instancedEffectBundles[0].liveEffects[0], 'EffectSaveData_v1', 'its effect');
  const qm = c(JSON.parse(files['QUESTDATA.TXT']));
  same(qm, 'QuestMachineData_v1', 'QuestData.txt'); same(qm.siteLinks[0], 'SiteLink', 'a site link'); same(qm.siteLinks[0].placeSymbol, 'Symbol', 'a symbol');
  const q = c(qm.quests[0]); same(q, 'QuestSaveData_v1', 'a quest');
  same(q.activeLogMessages[0], 'LogEntry', 'a log entry'); same(q.questors[0].Value, 'QuestorData', 'a questor');
  same(q.resources[0], 'ResourceSaveData_v1', 'a resource'); same(q.tasks[0], 'TaskSaveData_v1', 'a task'); same(c(q.tasks[0]).actions[0], 'ActionSaveData_v1', 'an action');
  const byType = Object.fromEntries(q.resources.map((r) => [c(r).type.split(',')[0].split('.').pop(), c(r).resourceSpecific]));
  same(byType.Clock, 'Clock', 'a Clock'); same(byType.Foe, 'Foe_v2', 'a Foe (v2)'); same(byType.Item, 'Item', 'an Item'); same(byType.Person, 'Person', 'a Person'); same(byType.Place, 'Place', 'a Place');
  same(c(byType.Foe).itemQueue[0], 'ItemData_v1', 'a queued item'); same(c(byType.Foe).spellQueue[0], 'SpellReference', 'a queued spell');
  same(c(byType.Person).questorData, 'NPCData', 'a questor\'s NPCData'); same(c(byType.Place).siteDetails, 'SiteDetails', 'site details'); same(c(byType.Place).siteDetails.selectedMarker, 'QuestMarker', 'a marker');
  const cv = c(JSON.parse(files['CONVERSATIONDATA.TXT']));
  same(cv, 'SaveDataConversation', 'ConversationData.txt'); same(cv.listRumorMill[0], 'RumorMillEntry', 'a rumor');
  same(cv.dictQuestInfo[0].Value, 'QuestResources', 'a quest\'s resources'); same(Object.values(cv.dictQuestInfo[0].Value.resourceInfo)[0], 'QuestResourceInfo', 'a resource info');
  same(cv.npcsWithWork[0].Value, 'NpcWorkEntry', 'an NPC with work'); same(cv.npcsWithWork[0].Value.npc, 'NPCData', 'its NPCData');

  // 2. the converter - every `var.field` read of a struct is a field the struct declares
  const src = rd('src/systems/dfuSaveImport.js');
  const fn = (name) => {
    const m = new RegExp(`^(?:export )?(?:function ${name}\\(|const ${name} = )[\\s\\S]*?^(?:\\}|\\) : null\\);|\\}\\);|\\}\\)\\);)$`, 'm').exec(src);
    assert.ok(m, `${name} is in the converter`);
    return m[0];
  };
  const reads = (text, v) => [...new Set([...text.matchAll(new RegExp(`(?<![\\w.])${v}\\??\\.(\\w+)`, 'g'))].map((x) => x[1]))];
  const within = (text, v, structs, what) => {
    const fields = new Set(structs.flatMap((s) => F[s]));
    const got = reads(text, v);
    assert.ok(got.length, `${what}: ${v} is read`);
    for (const k of got) assert.ok(fields.has(k), `${what} reads ${v}.${k}, which ${structs.join('/')} does not declare`);
  };
  const item = fn('dfuItem');
  within(item, 'd', ['ItemData_v1'], 'dfuItem'); within(item, 'd\\.repairData', ['ItemRepairData_v1'], 'dfuItem');
  const spell = fn('dfuSpell');
  within(spell, 'b', ['EffectBundleSettings'], 'dfuSpell'); within(spell, 'e', ['EffectEntry'], 'dfuSpell');
  const fx = fn('dfuActiveEffects');
  within(fx, 'b', ['EffectBundleSaveData_v1'], 'dfuActiveEffects'); within(fx, 'fx', ['EffectSaveData_v1'], 'dfuActiveEffects');
  within(fn('dfuWorldBag'), 'p', ['PlayerPositionData_v1'], 'dfuWorldBag'); within(fn('dfuAnchor'), 'p', ['PlayerPositionData_v1'], 'dfuAnchor');
  within(fn('dfuFaces'), 'f', ['FaceDetails'], 'dfuFaces'); within(fn('dfuMembershipBook'), 'm', ['GuildMembership_v1'], 'dfuMembershipBook');
  within(fn('dfuBank'), 'a', ['BankRecordData_v1'], 'dfuBank');
  const quest = fn('dfuQuest');
  within(quest, 'q', ['QuestSaveData_v1'], 'dfuQuest'); within(quest, 'l', ['LogEntry'], 'dfuQuest'); within(quest, 'r', ['ResourceSaveData_v1'], 'dfuQuest');
  within(quest, 't', ['TaskSaveData_v1'], 'dfuQuest'); within(quest, 'a', ['ActionSaveData_v1'], 'dfuQuest'); within(quest, 'd', ['QuestorData'], 'dfuQuest');
  const rs = fn('resourceSpecific');
  within(rs, 'sp', ['Clock', 'Foe_v1', 'Foe_v2', 'Item', 'Person', 'Place'], 'resourceSpecific'); within(rs, 'r', ['SpellReference'], 'resourceSpecific');
  within(fn('siteDetails'), 's', ['SiteDetails'], 'siteDetails'); within(fn('marker'), 'm', ['QuestMarker'], 'marker'); within(fn('npcData'), 'n', ['NPCData'], 'npcData');
  const env = fn('dfuQuestEnvelope');
  within(env, 'l', ['SiteLink'], 'dfuQuestEnvelope'); within(env, 'questData', ['QuestMachineData_v1'], 'dfuQuestEnvelope');
  const talk = fn('dfuTalk');
  within(talk, 'c', ['SaveDataConversation'], 'dfuTalk'); within(talk, 'r', ['RumorMillEntry', 'QuestResourceInfo'], 'dfuTalk'); within(talk, 'q', ['QuestResources'], 'dfuTalk'); within(talk, 'w', ['NpcWorkEntry'], 'dfuTalk');
  const career = fn('dfuCareerToRecord');
  within(career, 'c', ['DFCareer'], 'dfuCareerToRecord');
  const main = fn('dfuSaveToSnapshot');
  within(main, 'sd', ['SaveData_v1'], 'dfuSaveToSnapshot'); within(main, 'pd', ['PlayerData_v1'], 'dfuSaveToSnapshot'); within(main, 'pos', ['PlayerPositionData_v1'], 'dfuSaveToSnapshot');
  within(main, 'pe', ['PlayerEntityData_v1'], 'dfuSaveToSnapshot'); within(main, 'pd\\.boardShipPosition', ['PlayerPositionData_v1'], 'dfuSaveToSnapshot');
  within(main, 'sd\\.travelMapData', ['TravelMapSaveData'], 'dfuSaveToSnapshot'); within(main, 'r', ['RoomRental_v1'], 'dfuSaveToSnapshot'); within(main, 'm', ['ModInfo_v1'], 'dfuSaveToSnapshot');
  for (const k of main.match(/'reputation\w+'/g).map((s) => s.slice(1, -1))) assert.ok(F.PlayerEntityData_v1.includes(k), `${k} is a PlayerEntityData_v1 field (the REP list)`);
});

// ─────────────────────────────────────────── the converter's findings

test('AUDIT-DFUSAVE C7/C13: the artifact and identified bits are read apart; stackCount rides verbatim as FromItemData copies it', () => {
  const art = dfuItem(weapon({ value2: ITEM_ARTIFACT_MASK << 16, legacyMagic: [] }));
  assert.equal(art.artifact, true); assert.equal(art.isIdentified, false);
  const known = dfuItem(weapon({ value2: ITEM_IDENTIFIED_MASK << 16, legacyMagic: [] }));
  assert.equal(known.artifact, false); assert.equal(known.isIdentified, true);
  assert.notEqual(ITEM_ARTIFACT_MASK, ITEM_IDENTIFIED_MASK);
  assert.equal(dfuItem(weapon({ stackCount: 5 })).stackCount, 5, 'a stack of five, not the template\'s one');
  assert.equal(dfuItem(weapon({ stackCount: undefined })).stackCount, 1, 'absent: FromItemData\'s default');
  assert.equal(dfuItem(weapon({ stackCount: 0 })).stackCount, 0, 'zero rides as zero - the converter does not repair a DFU stack');
});

test('AUDIT-DFUSAVE C8: FromItemData\'s back-fills run on every item - the classic recipe from typeDependentData, the Ark\'ay book, the artifact bitfield', () => {
  // a potion whose potionRecipe is the pre-recipe-key zero: the classic key comes from typeDependentData (FromItemData :1673-1678)
  const potionGroup = 'UselessItems1';
  const potionIndex = GROUP_TEMPLATE_INDICES[potionGroup].indexOf(TEMPLATES.Glass_Bottle);
  assert.ok(potionIndex >= 0, 'a potion is useItem.js\'s isPotion: a UselessItems1 Glass_Bottle');
  const potion = dfuItem(weapon({ itemGroup: potionGroup, groupIndex: potionIndex, hits3: 3 << 8, potionRecipe: 0, legacyMagic: [], value2: 0 }));
  assert.equal(potion.potionRecipeKey, CLASSIC_RECIPE_KEYS[3]);
  const keyed = dfuItem(weapon({ itemGroup: potionGroup, groupIndex: potionIndex, hits3: 3 << 8, potionRecipe: 9999, legacyMagic: [], value2: 0 }));
  assert.equal(keyed.potionRecipeKey, 9999, 'a written key wins');
  const bookIndex = GROUP_TEMPLATE_INDICES.Books.indexOf(277);
  assert.ok(bookIndex >= 0);
  assert.equal(dfuItem(weapon({ itemGroup: 'Books', groupIndex: bookIndex, message: 10000, legacyMagic: [], value2: 0 })).message, 5, 'the Ark\'ay book id 10000 -> 5 (:1686-1687)');
  assert.equal(dfuItem(weapon({ itemGroup: 'Books', groupIndex: bookIndex, message: 10001, legacyMagic: [], value2: 0 })).message, 10001);
  assert.match(rd('src/systems/dfuSaveImport.js'), /legacyArtifactIndexBitfieldCheck\(item\);/, 'the bitfield check is loot.js\'s own, not a copy');
});

test('AUDIT-DFUSAVE C1: DFU repairTime SECONDS -> the port\'s classic MINUTES, rounded, never below one', () => {
  const at = (repairTime) => dfuItem(weapon({ repairData: { sceneName: 'DaggerfallInterior [MapID=1, BuildingKey=9]', timeStarted: classicMinutesToSeconds(523000), repairTime } })).repairData;
  assert.deepEqual(at(86400), { buildingKey: 9, timeStarted: 523000, repairTime: 1440 });
  assert.equal(at(61).repairTime, 1); assert.equal(at(90).repairTime, 2, 'rounded, not floored'); assert.equal(at(1).repairTime, 1, 'never zero: a zero job is no job to repairService.js');
});

test('AUDIT-DFUSAVE C5: a tagged bundle (a vampire\'s or a werebeast\'s granted spell) is the port\'s TAGGED custom record at the cast-cost floor, not the bare index', () => {
  const w = [];
  let n = -1;
  const next = () => n--;
  const bundle = { StandardSpellIndex: 7, Name: 'Levitate', Tag: 'vampire', MinimumCastingCost: true, TargetType: 'CasterOnly', ElementType: 'Magic', IconIndex: 4, Effects: [{ Key: 'Levitate', Settings: {} }] };
  const vamp = dfuSpell(bundle, next, w);
  assert.equal(typeof vamp, 'object');
  assert.equal(vamp.tag, VAMPIRE_SPELL_TAG); assert.equal(vamp.minimumCastingCost, true); assert.equal(vamp.custom, true); assert.equal(vamp.index, -1); assert.equal(vamp.name, 'Levitate');
  assert.equal(dfuSpell({ ...bundle, Tag: 'lycanthrope' }, next, w).tag, LYCANTHROPY_SPELL_TAG);
  assert.equal(dfuSpell({ ...bundle, Tag: null }, next, w), 7, 'untagged: the stock index');
  assert.equal(dfuSpell({ ...bundle, Tag: '' }, next, w), 7, 'an empty tag is no tag');
  assert.deepEqual(w, []);
  // the port's own grants carry exactly these marks (vampirism.js:163, lycanthropy.js:199)
  assert.match(rd('src/systems/vampirism.js'), /tag: VAMPIRE_SPELL_TAG, custom: true, minimumCastingCost: true/);
  assert.match(rd('src/systems/lycanthropy.js'), /tag: LYCANTHROPY_SPELL_TAG, custom: true, minimumCastingCost: true/);
  // MinimumCastingCost without a tag is honoured too
  const floor = dfuSpell({ Name: 'Cheap', MinimumCastingCost: true, Effects: [{ Key: 'Levitate', Settings: {} }] }, next, w);
  assert.equal(floor.minimumCastingCost, true); assert.equal('tag' in floor, false);
});

test('AUDIT-DFUSAVE C12/C14: a fourth effect is dropped with a line, the icon index wraps at the classic 55, an icon pack is named as not carried', () => {
  const w = [];
  const next = () => -1;
  const four = dfuSpell({ Name: 'Four', Effects: ['Levitate', 'Levitate', 'Levitate', 'Levitate'].map((Key) => ({ Key, Settings: {} })) }, next, w);
  assert.equal(four.effects.length, 3); assert.equal(four.effects.every((e) => e.type !== -1), true);
  assert.deepEqual(w, ['spell "Four": 1 effect(s) past the classic record\'s three were dropped']);
  w.length = 0;
  assert.equal(dfuSpell({ Name: 'I', IconIndex: 54, Effects: [{ Key: 'Levitate' }] }, next, w).icon, 54);
  assert.equal(dfuSpell({ Name: 'I', IconIndex: 55, Effects: [{ Key: 'Levitate' }] }, next, w).icon, 0, 'spellMaker.js\'s SetIcon law: index % 55');
  assert.equal(dfuSpell({ Name: 'I', IconIndex: 3, Icon: { key: 'Pack', index: 60 }, Effects: [{ Key: 'Levitate' }] }, next, w).icon, 5, 'a pack icon\'s index still wraps');
  assert.deepEqual(w, ['spell "I": its icon pack "Pack" does not come over; the classic icon index does']);
  assert.match(rd('src/systems/spellMaker.js'), /% ?SPELL_ICON_COUNT|SPELL_ICON_COUNT ?=|% ?55/, 'the count is the spell maker\'s');
});

test('AUDIT-DFUSAVE C4/C10/C13: a Transfer-* drain comes over as transferAttribute, an ended effect is skipped, a HeldMagicItem bundle is the held-item runtime\'s', () => {
  const w = [];
  const out = dfuActiveEffects([
    { bundleType: 'Spell', liveEffects: [{ key: `${E.DFU_TRANSFER_KEY_PREFIX}Strength`, statMods: null, effectSpecific: { magnitude: 4, drainStat: 'Strength' } }] },
    { bundleType: 'Spell', liveEffects: [{ key: `${E.DFU_DRAIN_KEY_PREFIX}Luck`, effectEnded: true, effectSpecific: { magnitude: 9, drainStat: 'Luck' } }] },
    { bundleType: 'HeldMagicItem', liveEffects: [{ key: 'Disease-Plague', effectSpecific: { incubationOver: true, lastDay: 1, daysOfSymptomsLeft: 1 } }] },
  ], w);
  assert.deepEqual(out, [{ kind: 'transferAttribute', stat: 'strength', magnitude: 4, permanent: true }]);
  assert.deepEqual(w, [], 'an ended effect and a held-item bundle are not "dropped" - they were never live');
  assert.equal(E.DFU_TRANSFER_KEY_PREFIX, 'Transfer-');
  assert.match(rd('src/systems/statMods.js'), /transferAttribute/, 'the port reads the kind');
  assert.equal(E.DFU_BUNDLE_TYPES.HeldMagicItem, enumValue('HeldMagicItem', E.DFU_BUNDLE_TYPES));
});

test('AUDIT-DFUSAVE C2/C9/C11: an indoor Recall anchor is null with a line; the level-sum guards; maxMagicka derived through chargen; name trimmed; readiedSpellIndex null', () => {
  const w = [];
  const inside = { worldContext: 'Interior', insideBuilding: true, worldPosX: 5, worldPosZ: 5, position: { x: 0, y: 0, z: 0 }, worldCompensation: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0 };
  assert.equal(dfuAnchor(inside, w), null);
  assert.deepEqual(w, ['your Recall anchor was set inside a building or dungeon: it does not come over']);
  assert.equal(dfuAnchor(null, w), null); assert.equal(w.length, 1);

  const save = open({ name: '  Ysolda  ', extraEntity: { currentLevelUpSkillSum: 0, startingLevelUpSkillSum: 0 } });
  const s = dfuSaveToSnapshot(save).snap;
  assert.equal(s.name, 'Ysolda', 'SerializablePlayer.cs:371 Name.Trim()');
  assert.equal(s.currentLevelUpSkillSum, levelUpSkillSum({ career: s.career, skills: s.skills }), 'a zero current sum is recomputed from the career\'s skills (:295-296)');
  assert.ok(s.currentLevelUpSkillSum > 0);
  const estimated = Math.trunc(((s.level + 0.5) * 15) - (28 + s.currentLevelUpSkillSum)) * -1;
  assert.equal(s.startingLevelUpSkillSum, estimated, 'EstimateStartingLevelUpSkillSum (PlayerEntity.cs:1480-1489)');
  const kept = dfuSaveToSnapshot(open({ extraEntity: { currentLevelUpSkillSum: 140, startingLevelUpSkillSum: 90 } })).snap;
  assert.equal(kept.currentLevelUpSkillSum, 140); assert.equal(kept.startingLevelUpSkillSum, 90);
  // MaxMagicka is never serialised by DFU: the port derives it as the classic import does
  assert.equal(s.maxMagicka, spellPoints(42, spellPointMultiplier(s.career.abilityFlagsAndSpellPointsBitfield)));
  assert.equal(s.maxMagicka, 63, 'INT 42 at the fixture career\'s Times_1_50');
  assert.equal(s.readiedSpellIndex, null, 'no spell readied - the port\'s restore hands it back as an extra');
});

test('AUDIT-DFUSAVE C2: discovery keyed by region INDEX comes through the whole save, an unknown region dropped with a line', () => {
  const discoveryData = pairs([[1234, {
    mapID: 0x12345678, mapPixelID: 1234, regionName: 'Daggerfall', locationName: 'Daggerfall',
    discoveredBuildings: pairs([[777, { buildingKey: 777, displayName: 'The Odd Blades', oldDisplayName: null, isOverrideName: false, factionID: 41, quality: 12, buildingType: 'WeaponSmith', lastLockpickAttempt: 0, customUserDisplayName: null }]]),
  }], [2, { mapID: 9, mapPixelID: 2, regionName: 'Nirn', locationName: 'Nowhere', discoveredBuildings: pairs([[1, { buildingKey: 1, displayName: 'x', factionID: 0, quality: 0, buildingType: 'Tavern', lastLockpickAttempt: 0 }]]) }]]);
  const out = dfuSaveToSnapshot(open({ discoveryData }));
  assert.deepEqual(out.snap.discovery, dfuDiscovery(discoveryData));
  assert.deepEqual(Object.keys(out.snap.discovery.buildings), ['17:Daggerfall']);
  assert.ok(out.warnings.includes('discovered buildings in "Nowhere": region "Nirn" is not one of the 62 - dropped'), out.warnings.join('|'));
});

test('AUDIT-DFUSAVE D1: dfuDateToSeconds IS gameDate.js\'s dateToSeconds (one home), and the classic epoch is the port\'s own', () => {
  const dt = { Year: 405, Month: 3, Day: 17, Hour: 13, Minute: 42, Second: 7 };
  assert.equal(dfuDateToSeconds(dt), dateToSeconds({ year: 405, month: 3, day: 17, hour: 13, minute: 42, second: 7 }));
  assert.match(rd('src/systems/dfuSaveImport.js').match(/export function dfuDateToSeconds[\s\S]*?\n\}/)[0], /return dateToSeconds\(/, 'no second copy of the calendar');
});

// ───────────────────────────────────────────── the reader's findings

test('AUDIT-DFUSAVE R6/R7: a ZERO [Flags] value prints as "" and reads as zero through both doors; an unnamed enum prints as null and NPCData reads it as zero', () => {
  assert.equal(enumValue('', E.DFU_SPECIAL_ABILITY_FLAGS), 0);
  assert.equal(flagIndex('', E.DFU_TARGET_TYPES), 0);
  assert.equal(enumValue('A,C', { A: 1, B: 2, C: 4 }), 5, 'a comma-joined list, no space');
  assert.throws(() => enumValue('Nope', { A: 1 }), /unknown enum name "Nope"/);
  const talk = dfuTalk({ npcsWithWork: pairs([[12, { npc: { hash: 1, flags: 2, factionID: 3, nameSeed: 12, gender: null, race: null, context: null, mapID: 5, locationID: 6, buildingKey: 7, nameBank: null, billboardArchiveIndex: 182, billboardRecordIndex: 3 }, socialGroup: 'Merchants', buildingName: 'B' }]]) });
  assert.deepEqual(talk.npcsWithWork[0][1].npc, { hash: 1, flags: 2, factionID: 3, nameSeed: 12, gender: 0, race: 0, context: 0, mapID: 5, locationID: 6, buildingKey: 7, nameBank: 0, billboardArchiveIndex: 182, billboardRecordIndex: 3 });
});

test('AUDIT-DFUSAVE R2: a $ref resolves to the SAME object wherever it sits, before or after its $id; a $ref with no $id is a schema error, not a null', () => {
  const doc = parseFsJson(JSON.stringify({ a: [{ $ref: '2' }], b: { $id: '2', $content: { x: 1 }, $version: 'v1' }, c: { d: { $ref: '2' } } }));
  const out = unwrapFs(doc);
  assert.deepEqual(out.b, { x: 1 });
  assert.equal(out.a[0], out.b, 'the forward reference is the definition itself');
  assert.equal(out.c.d, out.b, 'and the nested one');
  assert.throws(() => unwrapFs({ a: { $ref: '9' } }), /\$ref 9 has no \$id/);
  assert.equal(unwrapFs(null), null); assert.equal(unwrapFs(7), 7);
});

// ────────────────────────────────────────────── the door's findings

function mockStorage({ refuse = () => false } = {}) {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (refuse(k)) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _map: m,
  };
}

test('AUDIT-DFUSAVE R1: a screenshot the storage refuses (quota) costs the picture, not the save', async () => {
  const storage = mockStorage({ refuse: (k) => k.startsWith(SAVE_SHOT_PREFIX) });
  const files = buildDfuSaveFiles({ name: 'Ysolda' });
  files['SCREENSHOT.JPG'] = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3);
  const [r] = await importDfuSaves([{ index: 4, folder: 'Saves/SAVE4', files }], { storage, loaded: true });
  assert.equal(r.ok, true, r.error ?? '');
  assert.ok(r.warnings.includes('the screenshot did not fit in the browser\'s storage; the save stands without it'), r.warnings.join('|'));
  assert.equal(storage.getItem(SAVE_DATA_PREFIX + r.key) != null, true); assert.equal(storage.getItem(SAVE_INFO_PREFIX + r.key) != null, true);
  assert.equal(screenshotOf(r.key, storage), null);
  assert.equal(loadSlot(r.key, storage).name, 'Ysolda');
  // and a storage that refuses the DATA is the old failure, reported by name
  const [bad] = await importDfuSaves([{ index: 4, folder: 'Saves/SAVE4', files }], { storage: mockStorage({ refuse: (k) => k.startsWith(SAVE_DATA_PREFIX) }), loaded: true });
  assert.equal(bad.ok, false); assert.equal(bad.error, 'the slot could not be written (QuotaExceededError)');
});

test('AUDIT-DFUSAVE C6: the ship arrival converts the imported boarding memory\'s WORLD units under the port\'s origin (world.js)', () => {
  const world = rd('src/scenes/world.js');
  assert.match(world, /t\.restore\.pos \?\? \(Number\.isFinite\(t\.restore\.nativeX\) \? \{ nativeX: t\.restore\.nativeX, nativeZ: t\.restore\.nativeZ, y: t\.restore\.y \} : null\)/, 'the ship transition hands the native units on when there is no local pos');
  assert.match(world, /if \(localPos && !Array\.isArray\(localPos\) && Number\.isFinite\(localPos\.nativeX\)\) \{\n\s+const \[lx, lz\] = state\.localFromWorld\(localPos\.nativeX, localPos\.nativeZ\);\n\s+localPos = \[lx, \(localPos\.y \?\? 2\) \+ state\.compensation\[1\], lz\];\n\s+\}\n\s+const local = landing\?\.pos \?\? localPos;/, 'the teleport core converts them once the pixel is built, BEFORE the location landing outranks them');
});

// ───────────────────────────────────── the round trips, strengthened

test('AUDIT-DFUSAVE P3: the talk THREE halves round-trip through their own restores - the mill, the topic tree (relinked to the live quest) and the session', () => {
  const mill = new RumorMill({});
  mill.listRumorMill.push({ rumorType: 2, listRumorVariants: [[{ formatting: 'text', text: 'A rumor.', x: 0, y: 0 }]], questID: 5, timeLimit: 600, faction1: 1, faction2: 2, regionID: 17, flags: 0, type: 3, textID: 1001 });
  mill.dictQuestorPostQuestMessage.set(5, [{ formatting: 'text', text: 'Thanks.', x: 0, y: 0 }]);
  const resource = { isPerson: true, isPlace: false, isItem: false, symbol: { original: '_n_', name: 'n' } };
  const quest = { uid: 5, resources: new Map([['_n_', resource]]) };
  const getQuest = (id) => (id === 5 ? quest : null);
  const tree = new TopicTree({ getQuest });
  tree.dictQuestInfo.set(5, { resourceInfo: new Map([['n', { ...newQuestResourceInfo(), resourceType: 3, anyInfoAnswers: [[{ formatting: 'text', text: 'x', x: 0, y: 0 }]], rumorsAnswers: [], hasEntryInTellMeAbout: true, dialogLinkedLocations: ['a'], questResource: resource }]]) });
  const session = new NPCSession({});
  session.npcsWithWork.set(12, { npc: { hash: 1, flags: 2, factionID: 3, nameSeed: 12, gender: 1, race: 2, context: 2, mapID: 5, locationID: 6, buildingKey: 7, nameBank: 1, billboardArchiveIndex: 182, billboardRecordIndex: 3 }, socialGroup: 1, buildingName: 'The Bank' });
  session.castleNPCsSpokenTo.set(9, true);
  const portTalk = { ...mill.getSaveData(), ...tree.getSaveData(), ...session.getSaveData() };
  const imported = dfuTalk(unwrapFs(parseFsJson(JSON.stringify(shapeTalk(portTalk)))));
  assert.deepEqual(imported, portTalk);
  const mill2 = new RumorMill({}); mill2.restoreSaveData(imported);
  assert.deepEqual(mill2.getSaveData(), mill.getSaveData());
  const tree2 = new TopicTree({ getQuest }); tree2.restoreSaveData(imported);
  assert.deepEqual(tree2.getSaveData(), tree.getSaveData());
  assert.equal(tree2.dictQuestInfo.get(5).resourceInfo.get('n').questResource, resource, 'the relink found the live resource by its symbol name');
  const session2 = new NPCSession({}); session2.restoreSaveData(imported);
  assert.deepEqual(session2.getSaveData(), session.getSaveData());
});

test('AUDIT-DFUSAVE P2: an item through the fixture and back is the same item to the restore - the ItemData_v1 columns the mint left out are the zeros it assumes', () => {
  const port = dfuItem(weapon({ stackCount: 5, trappedSoulType: 'Daedroth', repairData: { sceneName: 'DaggerfallInterior [MapID=1, BuildingKey=9]', timeStarted: classicMinutesToSeconds(523000), repairTime: 3600 } }));
  const printed = unwrapFs(parseFsJson(JSON.stringify(shapeItem(port, 1))));
  assert.deepEqual(dfuItem(printed), port);
  assert.equal(printed.trappedSoulType, 'Daedroth', 'the soul by NAME in the print');
  assert.equal(printed.repairData.repairTime, 3600, 'SECONDS in the print');
});
