// DFUSAVE (2026-09-20) - the test-side SHAPER: the port's own envelopes
// printed the way Daggerfall Unity's Full Serializer prints them
// ($version/$content on every [fsObject("v1")] type, enums by NAME,
// Dictionaries as Key/Value pairs, Types as assembly-qualified strings,
// DaggerfallDateTime as its six fields). The import tests feed these
// to the reader and the converter and expect the port's envelope back,
// so every field the restore reads is proven by a round trip - and the
// shaper is the C# field list a second time, written independently of
// the converter. No real DFU save is in the tree; DFU_SAVES_PATH gates
// the corpus test that would read one.

import * as E from '../src/formats/dfuEnums.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';
import { CLASSIC_EPOCH_IN_SECONDS } from '../src/systems/gameDate.js';

/** `[fsObject("v1")]` as printed. */
export const v1 = (content) => ({ $version: 'v1', $content: content });

/** An enum VALUE -> the first name declared for it (Enum.ToString). A
 *  null is what the port writes where C# has a struct field that can
 *  only be its zero, so it prints as the zero's name. */
export function nameOf(table, value) {
  if (value == null) value = 0;
  for (const [k, v] of Object.entries(table)) if (v === value) return k;
  return value;   // .NET prints the integer when no name matches (Races has no 0, and a zero NPCData carries one)
}

/** A [Flags] value -> ", "-joined names, .NET style; 0 -> its zero name. */
export function flagNames(table, value) {
  if (!value) return nameOf(table, 0);
  const parts = [];
  for (const [k, v] of Object.entries(table)) if (v && (value & v) === v && parts.every((p) => table[p] !== v)) parts.push(k);
  return parts.join(', ');
}

/** DaggerfallDateTime.FromSeconds (:446-473) - absolute seconds to the
 *  six serialised fields. */
export function dfuDate(seconds) {
  let dayno = Math.floor(seconds / 86400);
  const dayclock = seconds % 86400;
  let Year = 0, Month = 0;
  while (dayno >= 360) { dayno -= 360; Year++; }
  while (dayno >= 30) { dayno -= 30; Month++; }
  return { Year, Month, Day: dayno, Hour: Math.floor(dayclock / 3600), Minute: Math.floor((dayclock % 3600) / 60), Second: dayclock % 60 };
}
/** The port's classic seconds -> DFU's absolute date. */
export const classicSecondsToDate = (s) => dfuDate(Number(s) + CLASSIC_EPOCH_IN_SECONDS);
export const classicMinutesToSeconds = (m) => Number(m) * 60 + CLASSIC_EPOCH_IN_SECONDS;

/** A Dictionary with a non-string key, as fsSerializer prints one. */
export const pairs = (entries) => entries.map(([Key, Value]) => ({ Key, Value }));

export const symbol = (s) => (s ? { original: s.original, name: s.name ?? String(s.original).replace(/^_+|_+$/g, '') } : null);

const QUESTING = 'DaggerfallWorkshop.Game.Questing';
export const typeName = (short, ns = QUESTING) => `${ns}.${short}, Assembly-CSharp, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null`;

/** A port item -> ItemData_v1 (the inverse of the converter's map;
 *  DaggerfallUnityItem.GetSaveData :767-815). `uid` is the caller's. */
export function shapeItem(it, uid) {
  const groupIndex = GROUP_TEMPLATE_INDICES[it.group].indexOf(it.templateIndex);
  const legacyMagic = [];
  for (const e of it.enchantments ?? []) legacyMagic.push(e.type, e.param);
  return v1({
    uid, shortName: it.name ?? '', nativeMaterialValue: it.material ?? 0,
    dyeColor: nameOf(E.DFU_DYE_COLORS, it.dye ?? 18), weightInKg: it.weightInKg ?? 0, drawOrder: 0,
    value1: it.value ?? 0, value2: ((it.flags ?? 0) << 16) >>> 0,
    hits1: it.currentCondition ?? 0, hits2: it.maxCondition ?? 0, hits3: ((it.typeDependentData ?? 0) << 8) >>> 0,
    stackCount: it.stackCount ?? 1, enchantmentPoints: it.enchantmentPoints ?? 0, message: it.message ?? 0,
    legacyMagic, customMagic: null,
    playerTextureArchive: it.playerTextureArchive ?? 0, playerTextureRecord: it.playerTextureRecord ?? 0,
    worldTextureArchive: it.worldTextureArchive ?? 0, worldTextureRecord: it.worldTextureRecord ?? 0,
    itemGroup: it.group, groupIndex, currentVariant: it.variant ?? 0,
    isQuestItem: !!it.questItem, questUID: it.questUID ?? 0, questItemSymbol: it.questSymbol ? symbol(it.questSymbol) : null,
    trappedSoulType: it.trappedSoulType ?? 'None', className: null,
    poisonType: it.poisonType != null ? nameOf(E.DFU_POISONS, it.poisonType) : 'None',
    potionRecipe: it.potionRecipeKey ?? 0,
    repairData: v1(it.repairData
      ? { sceneName: `DaggerfallInterior [MapID=0, BuildingKey=${it.repairData.buildingKey}]`, timeStarted: classicMinutesToSeconds(it.repairData.timeStarted), repairTime: it.repairData.repairTime }
      : { sceneName: null, timeStarted: 0, repairTime: 0 }),
    timeForItemToDisappear: it.timeForItemToDisappear ?? 0, timeHealthLeechLastUsed: it.timeHealthLeechLastUsed ?? 0,
    artifactIndexBitfield: it.artifactIndexBitfield ?? 0,
  });
}

const npcData = (n) => (n ? {
  hash: n.hash, flags: n.flags, factionID: n.factionID, nameSeed: n.nameSeed,
  gender: nameOf(E.DFU_GENDERS, n.gender), race: nameOf(E.DFU_RACES, n.race), context: nameOf(E.DFU_NPC_CONTEXT, n.context),
  mapID: n.mapID, locationID: n.locationID, buildingKey: n.buildingKey, nameBank: nameOf(E.DFU_BANK_TYPES, n.nameBank),
  billboardArchiveIndex: n.billboardArchiveIndex, billboardRecordIndex: n.billboardRecordIndex,
} : null);

const marker = (m) => (m ? {
  questUID: m.questUID, placeSymbol: symbol(m.placeSymbol), targetResources: m.targetResources ? m.targetResources.map(symbol) : null,
  markerType: nameOf(E.DFU_MARKER_TYPES, m.markerType), flatPosition: { ...m.flatPosition },
  dungeonX: m.dungeonX, dungeonZ: m.dungeonZ, buildingKey: m.buildingKey, markerID: m.markerID,
} : null);

const SCOPE_NAME = { none: 'None', fixed: 'Fixed', remote: 'Remote', local: 'Local' };
const TASK_NAME = { headless: 'Headless', standard: 'Standard', persistUntil: 'PersistUntil', variable: 'Variable', globalVarLink: 'GlobalVarLink' };

function shapeResourceSpecific(type, sp, uidOf) {
  if (!sp) return null;
  switch (type) {
    case 'Clock': return v1({ ...sp, lastWorldTimeSample: classicSecondsToDate(sp.lastWorldTimeSample) });
    case 'Foe': return { $version: 'v2', $content: { ...sp, humanoidGender: nameOf(E.DFU_GENDERS, sp.humanoidGender), itemQueue: (sp.itemQueue ?? []).map((it) => shapeItem(it, uidOf())) } };
    case 'Item': return v1({ ...sp, item: sp.item ? shapeItem(sp.item, uidOf()) : null });
    case 'Person': return v1({
      ...sp, race: nameOf(E.DFU_RACES, sp.race), nameBank: nameOf(E.DFU_BANK_TYPES, sp.nameBank), npcGender: nameOf(E.DFU_GENDERS, sp.npcGender),
      homePlaceSymbol: symbol(sp.homePlaceSymbol), lastAssignedPlaceSymbol: symbol(sp.lastAssignedPlaceSymbol), questorData: npcData(sp.questorData),
    });
    case 'Place': return v1({
      ...sp, scope: SCOPE_NAME[sp.scope] ?? 'None',
      siteDetails: sp.siteDetails ? {
        ...sp.siteDetails, siteType: nameOf(E.DFU_SITE_TYPES, sp.siteDetails.siteType),
        questSpawnMarkers: (sp.siteDetails.questSpawnMarkers ?? []).map(marker), questItemMarkers: (sp.siteDetails.questItemMarkers ?? []).map(marker),
        selectedMarker: marker(sp.siteDetails.selectedMarker),
      } : null,
    });
    default: return structuredClone(sp);
  }
}

/** The port's machine.getSaveData() -> QuestMachineData_v1 as printed. */
export function shapeQuestMachine(m) {
  let uid = 40000000;
  const uidOf = () => uid++;
  return v1({
    siteLinks: m.siteLinks.map((l) => ({ ...l, placeSymbol: symbol(l.placeSymbol), siteType: nameOf(E.DFU_SITE_TYPES, l.siteType ?? 0) })),
    quests: m.quests.map((q) => v1({
      uid: q.uid, questComplete: q.questComplete, questSuccess: q.questSuccess, questName: q.questName, displayName: q.displayName, factionId: q.factionId,
      questStartTime: classicSecondsToDate(q.questStartTime), questTombstoned: q.questTombstoned,
      questTombstoneTime: classicSecondsToDate(q.questTombstoned ? q.questTombstoneTime : 0),
      smallerDungeonsState: nameOf(E.DFU_QUEST_SMALLER_DUNGEONS_STATE, q.smallerDungeonsState), compiledByVersion: '1.1.1',
      activeLogMessages: q.activeLogMessages.map((l) => ({ stepID: l.stepID, messageID: l.messageID, dateTime: classicSecondsToDate(l.time) })),
      messages: q.messages.map((x) => v1({ id: x.id, lines: [...x.lines] })),
      resources: q.resources.map((r) => v1({
        type: typeName(r.type), symbol: symbol(r.symbol), infoMessageID: r.infoMessageID, usedMessageID: r.usedMessageID,
        rumorsMessageID: r.rumorsMessageID, hasPlayerClicked: r.hasPlayerClicked, isHidden: r.isHidden,
        resourceSpecific: shapeResourceSpecific(r.type, r.resourceSpecific, uidOf),
      })),
      questors: pairs(q.questors.map((x) => [x.name, { symbol: symbol(x.symbol), name: x.displayName }])),
      tasks: q.tasks.map((t) => v1({
        ...t, symbol: symbol(t.symbol), targetSymbol: symbol(t.targetSymbol), type: TASK_NAME[t.type] ?? 'Standard',
        actions: t.actions.map((a) => v1({ ...a, type: typeName(a.type, `${QUESTING}.Actions`), actionSpecific: a.actionSpecific })),
      })),
      oneTimeDisplayedMessages: [...q.oneTimeDisplayedMessages],
    })),
  });
}

const FMT_NAME = { text: 'Text', highlight: 'TextHighlight', question: 'TextQuestion', answer: 'TextAnswer', newline: 'NewLineOffset', center: 'JustifyCenter', nothing: 'Nothing' };
export const shapeToken = (t) => ({ formatting: FMT_NAME[t.formatting] ?? t.formatting, text: t.text, x: t.x ?? 0, y: t.y ?? 0 });
const shapeLines = (lines) => lines.map((l) => l.map(shapeToken));

/** The port's flat `talk` bag -> SaveDataConversation as printed. */
export function shapeTalk(t) {
  return v1({
    dictQuestInfo: pairs(t.dictQuestInfo.map((q) => [q.questID, {
      resourceInfo: Object.fromEntries(q.resourceInfo.map((r) => [r.name, {
        resourceType: nameOf(E.DFU_QUEST_INFO_RESOURCE_TYPE, r.resourceType),
        anyInfoAnswers: shapeLines(r.anyInfoAnswers), rumorsAnswers: shapeLines(r.rumorsAnswers),
        availableForDialog: r.availableForDialog, hasEntryInTellMeAbout: r.hasEntryInTellMeAbout, hasEntryInWhereIs: r.hasEntryInWhereIs,
        questPlaceResourceHintTypeReceived: nameOf(E.DFU_BUILDING_LOCATION_HINT, r.questPlaceResourceHintTypeReceived),
        dialogLinkedLocations: r.dialogLinkedLocations, dialogLinkedPersons: r.dialogLinkedPersons, dialogLinkedThings: r.dialogLinkedThings,
        questResource: { $id: '7', $type: `${QUESTING}.Person`, $version: 'v1', $content: { symbol: { original: `_${r.name}_`, name: r.name } } },   // the polymorphic resource graph the port drops
      }])),
    }])),
    listRumorMill: t.listRumorMill.map((r) => ({ ...r, rumorType: nameOf(E.DFU_RUMOR_TYPE, r.rumorType), listRumorVariants: shapeLines(r.listRumorVariants) })),
    dictQuestorPostQuestMessage: pairs(t.dictQuestorPostQuestMessage.map((r) => [r.questID, r.tokens.map(shapeToken)])),
    npcsWithWork: pairs(t.npcsWithWork.map(([k, w]) => [k, { npc: npcData(w.npc), socialGroup: nameOf(E.DFU_SOCIAL_GROUPS, w.socialGroup), buildingName: w.buildingName }])),
    castleNPCsSpokenTo: pairs(t.castleNPCsSpokenTo),
  });
}

/** A DFCareer as printed, from its semantic fields (defaults = a Knight-ish nobody). */
export function dfCareer(over = {}) {
  return {
    Name: 'Warrior', AdvancementMultiplier: 1.5, HitPointsPerLevel: 20,
    Strength: 60, Intelligence: 40, Willpower: 40, Agility: 50, Endurance: 55, Personality: 45, Speed: 50, Luck: 50,
    PrimarySkill1: 'LongBlade', PrimarySkill2: 'Axe', PrimarySkill3: 'BluntWeapon',
    MajorSkill1: 'Archery', MajorSkill2: 'ShortBlade', MajorSkill3: 'CriticalStrike',
    MinorSkill1: 'Dodging', MinorSkill2: 'Jumping', MinorSkill3: 'Running', MinorSkill4: 'Climbing', MinorSkill5: 'Swimming', MinorSkill6: 'Medical',
    Paralysis: 'Normal', Magic: 'Resistant', Poison: 'Immune', Fire: 'LowTolerance', Frost: 'CriticalWeakness', Shock: 'Normal', Disease: 'Resistant',
    ShortBlades: 'Normal', LongBlades: 'Expert', HandToHand: 'Forbidden', Axes: 'Normal', BluntWeapons: 'Normal', MissileWeapons: 'Expert',
    UndeadAttackModifier: 'Bonus', DaedraAttackModifier: 'Normal', HumanoidAttackModifier: 'Phobia', AnimalsAttackModifier: 'Normal',
    DarknessPoweredMagery: 'ReducedPowerInLight', LightPoweredMagery: 'Normal',
    ForbiddenMaterials: 'Iron, Daedric', ForbiddenShields: 'TowerShield', ForbiddenArmors: 'Plate', ForbiddenProficiencies: 'HandToHand', ExpertProficiencies: 'LongBlades, MissileWeapons',
    SpellPointMultiplier: 'Times_1_50', SpellPointMultiplierValue: 1.5, SpellAbsorption: 'InDarkness',
    NoRegenSpellPoints: true, AcuteHearing: false, Athleticism: true, AdrenalineRush: false,
    Regeneration: 'InWater', RapidHealing: 'Always', DamageFromSunlight: false, DamageFromHolyPlaces: true,
    ...over,
  };
}

/** A whole save folder's files, DFU-shaped, from a few knobs. Returns
 *  the UPPERCASE-name -> text map `readDfuSave` takes. */
export function buildDfuSaveFiles({
  name = 'Tester', gender = 'Female', level = 4, gameTime = CLASSIC_EPOCH_IN_SECONDS + 523530 * 60 + 7200,
  items = [], equipTable = new Array(27).fill(0), wagonItems = [], otherItems = [], spellbook = [], bundles = [],
  worldPosX = 4000 * 32768 + 12345, worldPosZ = (499 - 250) * 32768 + 6789, worldContext = 'Exterior', insideDungeon = false, insideBuilding = false,
  weather = 'Fog', guildMemberships = [], vampireMemberships = [], bankAccounts = [], bankDeeds = null, regionData = null,
  rentedRooms = [], escortingFaces = [], travelMapData = null, modInfoData = [], anchorPosition = null, boardShipPosition = null,
  crime = 'Trespassing', career = dfCareer(), raceId = 3, extraEntity = {}, extraPlayer = {}, questData = null, conversationData = null,
  discoveryData = null, notebookData = null, factionData = null, bio = null, lightSourceUID = 0, enemyData = [], sceneCache = null,
} = {}) {
  const position = (wx, wz, y = 3.25) => v1({
    position: { x: 10.5, y, z: 20.25 }, worldCompensation: { x: 0, y: 1.25, z: 0 }, worldContext, floatingOriginVersion: 3,
    yaw: 91.5, pitch: -4.25, isCrouching: true, worldPosX: wx, worldPosZ: wz, insideDungeon, insideBuilding,
    insideOpenShop: false, insideTavern: false, insideResidence: false, playerTeleportedIntoDungeon: false,
    terrainSamplerName: 'DefaultTerrainSampler', terrainSamplerVersion: 1, smallerDungeonsState: 'Enabled',
    exteriorDoors: null, buildingDiscoveryData: null, weather,
  });
  const stats = { Strength: 61, Intelligence: 42, Willpower: 43, Agility: 54, Endurance: 55, Personality: 46, Speed: 57, Luck: 48 };
  const skills = {};
  for (const [k, i] of Object.entries(E.DFU_SKILLS)) if (i >= 0 && i < 35) skills[k] = 10 + i;
  const info = v1({ saveVersion: 1, saveName: 'Quick', characterName: name, dateAndTime: v1({ gameTime, realTime: 638000000000000000 }), dfuVersion: '1.1.1' });
  const data = v1({
    header: v1({ description: 'Daggerfall Unity Save Game v1' }),
    currentUID: 33554500,
    dateAndTime: v1({ gameTime, realTime: 638000000000000000 }),
    playerData: v1({
      playerPosition: position(worldPosX, worldPosZ),
      playerEntity: v1({
        gender, faceIndex: 7, raceTemplate: { ID: raceId, Name: 'Nord' }, careerTemplate: career, reflexes: 'High',
        name, level, stats, skills, resistances: { Fire: 0, Frost: 10, DiseaseOrPoison: 0, Shock: 0, Magic: 5 },
        maxHealth: 80, currentHealth: 61, currentFatigue: 5000, currentMagicka: 33, currentBreath: 0,
        skillUses: Array.from({ length: 35 }, (_, i) => i * 3), timeOfLastSkillIncreaseCheck: 523000, skillsRecentlyRaised: [5, 9],
        timeOfLastSkillTraining: 523100, startingLevelUpSkillSum: 90, currentLevelUpSkillSum: 140,
        equipTable, items, wagonItems, otherItems, goldPieces: 1234,
        globalVars: [{ index: 3, name: 'Foo', value: true }, { index: 0, name: 'Bar', value: false }],
        minMetalToHit: 'Silver',
        biographyResistDiseaseMod: 1, biographyResistMagicMod: -2, biographyAvoidHitMod: 3, biographyResistPoisonMod: 4, biographyFatigueMod: -5, biographyReactionMod: 6,
        timeForThievesGuildLetter: 7, timeForDarkBrotherhoodLetter: 8, thievesGuildRequirementTally: 9, darkBrotherhoodRequirementTally: 10,
        timeToBecomeVampireOrWerebeast: 11, lastTimePlayerAteOrDrankAtTavern: 12, spellbook, instancedEffectBundles: bundles,
        crimeCommitted: crime, haveShownSurrenderToGuardsDialogue: true, lightSourceUID,
        reputationCommoners: 1, reputationMerchants: 2, reputationScholars: 3, reputationNobility: 4, reputationUnderworld: 5,
        reputationSGroup5: 6, reputationSupernaturalBeings: 7, reputationGuildMembers: 8, reputationSGroup8: 9, reputationSGroup9: 10, reputationSGroup10: 11,
        previousVampireClan: 'Lyrezi', daedraSummonDay: 13, daedraSummonIndex: 14, anchorPosition, regionData, rentedRooms,
        ...extraEntity,
      }),
      weaponDrawn: true, usingLeftHand: true, transportMode: 'Horse', boardShipPosition,
      guildMemberships: pairs(guildMemberships), vampireMemberships: pairs(vampireMemberships), oneTimeQuestsAccepted: ['M0B00Y00'],
      ...extraPlayer,
    }),
    dungeonData: v1({ actionDoors: [], actionObjects: [] }),
    enemyData, lootContainers: [],
    bankAccounts, bankDeeds, escortingFaces,
    sceneCache: sceneCache ?? v1({ sceneCache: [], permanentScenes: ['DaggerfallInterior [MapID=1, BuildingKey=2]'] }),
    travelMapData, advancedClimbingState: { isClimbing: false }, modInfoData,
  });
  const files = { 'SAVEINFO.TXT': JSON.stringify(info), 'SAVEDATA.TXT': JSON.stringify(data) };
  if (questData) files['QUESTDATA.TXT'] = JSON.stringify(questData);
  if (conversationData) files['CONVERSATIONDATA.TXT'] = JSON.stringify(conversationData);
  if (discoveryData) files['DISCOVERYDATA.TXT'] = JSON.stringify(discoveryData);
  if (notebookData) files['NOTEBOOKDATA.TXT'] = JSON.stringify(notebookData);
  if (factionData) files['FACTIONDATA.TXT'] = JSON.stringify(factionData);
  if (bio != null) files['BIO.TXT'] = bio;
  return files;
}
