// L10N3e/L10N3g (2026-09-28): THE QUEST'S NAMES AND ITS GRAMMAR, IN THE PLAYER'S LANGUAGE - the quest batch. DFU writes
// a quest resource's name in the language when it makes it (Foe.cs:276 GetLocalizedEnemyName, Person.cs:617 and every
// other faction name through GetFactionData, PersistentFactionData.cs:176) and a quest message's finished text goes
// through the language's grammar processor (QuestMacroHelper.cs:158), with the NPC's gender handed over by
// Person.ExpandMacro (Person.cs:298). The port keeps every name canonical where it is a key - a Foe's typeName and a
// Person's displayName are saved, the talk window's same-person test and the dialog links compare them, an artifact's
// name is LegacyGetArtifactSubType's - and looks the name up where it is shown. Pinned through the port's own
// functions: the resources' expandMacro, expandQuestMessage, the macro table, the topic tree's assemblers, the
// building namer, the combat mod's warnings, the broken-item line, the light lines. A made-up French row reaches the
// text, English reads byte for byte as before (with no language chosen and with English chosen again), and the key
// path still sees the canonical name.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as tm from '../src/systems/textManager.js';
import { _resetFrenchGrammarForTests } from '../src/systems/grammar/frenchGrammar.js';   // registers French's rules
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { Quest } from '../src/systems/quest/quest.js';
import { Symbol as QuestSymbol } from '../src/systems/quest/symbol.js';
import { Foe } from '../src/systems/quest/foe.js';
import { Person, shownPersonName } from '../src/systems/quest/person.js';
import { Item } from '../src/systems/quest/item.js';
import { expandQuestMessage, getContextValue, setIdFactions, setIdRegion } from '../src/systems/quest/questMacros.js';
import { TopicTree, QUESTION_TYPE, QUEST_INFO_RESOURCE_TYPE } from '../src/systems/topicTree.js';
import { generateBuildingName, shownFactionNames, BUILDING_TYPES } from '../src/world/buildingNames.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';
import { GENDERS } from '../src/characters/nameHelper.js';
import { NPC_CONTEXT } from '../src/characters/staticNpc.js';
import { setMagicItemTemplates } from '../src/systems/loot.js';
import { shownItemName } from '../src/systems/itemInfo.js';
import { lowerCondition } from '../src/systems/equip.js';
import { useItem, TEMPLATES } from '../src/systems/useItem.js';
import { tickPlayerTorch, TORCH_TICK_SECONDS } from '../src/systems/playerTorch.js';
import { pcaaoWarningMessagePlayerEquipmentCondition, pcaaoApplyConditionDamageThroughUnarmedDamage } from '../src/combat/pcaao.js';

// The quest tables, off the vendored DFU text (Quests-Foes, Quests-Factions, Quests-Items ...).
const TABLES = new URL('../vendor/dfu-quests/Tables/', import.meta.url);
loadQuestTables(Object.fromEntries(readdirSync(TABLES).map((f) => [f.replace(/\.txt$/, ''), readFileSync(new URL(f, TABLES), 'utf8')])));

beforeEach(() => {
  tm._resetTextManagerForTests();
  _resetFrenchGrammarForTests();
  setIdRegion(-1);
  setIdFactions(-1, -1);
  setMagicItemTemplates(null);
});

/** `show()` in English, again with the French rows in (English still chosen), then in French, then in English once
 *  more. Answers { en, fr }, holding every English read to the first. */
function inFrench(tables, show) {
  const en = show();
  for (const [table, rows] of Object.entries(tables)) tm.patchLocaleTable('fr', table, rows);
  assert.deepEqual(show(), en, 'English stands until French is chosen');
  tm.setLocale('fr');
  const fr = show();
  tm.setLocale('en');
  assert.deepEqual(show(), en, 'English again, byte for byte');
  return { en, fr };
}
/** The enemyNames list, 62 rows, with `over` (row -> name) in it. */
const enemyNames = (over) => Array.from({ length: 62 }, (_, i) => over[i] ?? `Ennemi ${i}`).join('\n');

// The faction store the world answers from: FACTION.TXT's shape, the ids DFU's tables key by.
const FACTIONS = new Map([
  [1, { id: 1, type: FACTION_TYPES.Daedra, name: 'Clavicus Vile', race: -1, children: [] }],
  [21, { id: 21, type: FACTION_TYPES.God, name: 'Arkay', children: [82] }],
  [22, { id: 22, type: FACTION_TYPES.God, name: 'Zenithar', children: [] }],
  [40, { id: 40, type: FACTION_TYPES.Group, name: 'The Mages Guild', race: 3, children: [] }],
  [82, { id: 82, type: FACTION_TYPES.Temple, name: 'The Order of Arkay', children: [] }],
  [150, { id: 150, type: FACTION_TYPES.VampireClan, name: 'The Vraseth', children: [] }],
  [201, { id: 201, type: FACTION_TYPES.Province, name: 'Daggerfall', region: 17, ruler: 1, race: 3, rulerNameSeed: 5, children: [364, 365] }],
  [202, { id: 202, type: FACTION_TYPES.Province, name: 'Glenpoint', region: 18, ruler: 1, race: 3, rulerNameSeed: 5, children: [] }],
  [352, { id: 352, type: FACTION_TYPES.Individual, name: 'Lady Brisienna', race: 3, children: [] }],
  [364, { id: 364, type: FACTION_TYPES.Individual, name: 'King Gothryd', children: [] }],
  [365, { id: 365, type: FACTION_TYPES.Individual, name: 'Queen Aubk-i', children: [] }],
]);
const world = {
  getFactionData: (id) => FACTIONS.get(id) ?? null,
  findFactionByTypeAndRegion: (type, region) => [...FACTIONS.values()].find((f) => f.type === type && f.region === region) ?? null,
  currentRegionFaction: () => 201,
  currentRegionIndex: () => 17,
  currentRegionRace: () => 1,
  currentLocation: () => null,
  flatCaption: (archive, record) => (archive === 175 && record === 0 ? 'young lady in green' : null),   // FLATS.CFG's one row here
};
/** A real Quest over that world, its faction the Mages Guild's (the questor's guild). */
const questOf = () => { const q = new Quest({ hooks: { world }, rolls: () => 0.25 }); q.factionId = 40; return q; };
/** A Person made as a quest's own (no declaration line): its symbol, record, name and gender set as setup leaves them. */
function personOf(quest, name, { faction = null, displayName = '', gender = GENDERS.Male, ...over } = {}) {
  const p = new Person(quest);
  p.symbol = new QuestSymbol(name);
  p.factionData = faction;
  p.displayName = displayName;
  p.npcGender = gender;
  Object.assign(p, over);
  quest.addResource(p);
  return p;
}
/** ExpandQuestMessage over one text token, the answer its finished text. */
const expanded = (quest, text) => { const tokens = [{ formatting: 0, text }]; expandQuestMessage(quest, tokens); return tokens[0].text; };

// ─── the resources' own names ────────────────────────────────────────────────────────────────────────────────────

test('L10N3e quest: a Foe\'s _symbol_ shows its type in the player\'s language by its MobileTypes id (SetFoeName, Foe.cs:276, printed at :164); the canonical type name is the one the save keeps', () => {
  const quest = questOf();
  const wraith = new Foe(quest, 'Foe _wraith_ is Wraith');
  const thief = new Foe(quest, 'Foe _thief_ is 2 Thief');
  quest.addResource(wraith);
  quest.addResource(thief);
  const show = () => [wraith.expandMacro(1), thief.expandMacro(1), expanded(quest, 'Beware _wraith_ and _thief_.')];
  const { en, fr } = inFrench({ Internal_Strings: [['enemyNames', enemyNames({ 23: 'Spectre factice', 53: 'Voleur factice' })]] }, show);
  assert.deepEqual(en, ['Wraith', 'Thief', 'Beware Wraith and Thief.']);
  assert.deepEqual(fr, ['Spectre factice', 'Voleur factice', 'Beware Spectre factice and Voleur factice.'],
    'a monster by its id, a class by 43 + id - 128');
  tm.setLocale('fr');
  assert.equal(wraith.typeName, 'Wraith');
  assert.equal(wraith.getSaveData().typeName, 'Wraith', 'the save keeps the canonical name');
  assert.equal(thief.getSaveData().typeName, 'Thief');
});

test('L10N3e quest: a Person\'s _symbol_ shows an Individual\'s or a Daedra\'s name as the language has it, by its faction record\'s id (AssignDisplayName, Person.cs:617); a drawn name stands, the zero record reads no row, and the saved name is the canonical one', () => {
  const quest = questOf();
  const brisienna = new Person(quest, 'Person _brisi_ named Lady_Brisienna');
  const vile = new Person(quest, 'Person _vile_ named Clavicus_Vile');
  quest.addResource(brisienna);
  quest.addResource(vile);
  const clerk = personOf(quest, '_clerk_', { faction: FACTIONS.get(40), displayName: 'Jean Dupont' });
  const lost = personOf(quest, '_lost_', { faction: { id: 0, type: FACTION_TYPES.Daedra, name: '' }, displayName: 'Anne Doe' });   // a failed lookup: C#'s zero struct
  const show = () => [brisienna.expandMacro(1), vile.expandMacro(1), clerk.expandMacro(1), lost.expandMacro(1),
    expanded(quest, 'Seek _brisi_, not _vile_.')];
  const { en, fr } = inFrench({ Internal_Factions: [['352', 'Dame Brisienna (factice)'], ['1', 'Clavicus factice'], ['40', 'Guilde factice'], ['0', 'Zéro factice']] }, show);
  assert.deepEqual(en, ['Lady Brisienna', 'Clavicus Vile', 'Jean Dupont', 'Anne Doe', 'Seek Lady Brisienna, not Clavicus Vile.']);
  assert.deepEqual(fr, ['Dame Brisienna (factice)', 'Clavicus factice', 'Jean Dupont', 'Anne Doe', 'Seek Dame Brisienna (factice), not Clavicus factice.']);
  tm.setLocale('fr');
  assert.equal(brisienna.displayName, 'Lady Brisienna', 'setup wrote the canonical name');
  assert.equal(brisienna.getSaveData().displayName, 'Lady Brisienna', 'and the save keeps it');
  assert.equal(shownPersonName(brisienna), 'Dame Brisienna (factice)');
});

test('L10N3e quest: a Person\'s ==symbol_ is its faction\'s name as the language has it - the quest\'s guild for a questor (Person.cs:335-336), its own record\'s for anyone else (:342), each by the record\'s id', () => {
  const quest = questOf();
  const questor = personOf(quest, '_qgiver_', { faction: FACTIONS.get(352), displayName: 'Lady Brisienna', isQuestor: true });
  const member = personOf(quest, '_member_', { faction: FACTIONS.get(150), displayName: 'Jean Dupont' });
  const show = () => [questor.expandMacro(6), member.expandMacro(6), expanded(quest, 'For ==qgiver_ and ==member_.')];
  const { en, fr } = inFrench({ Internal_Factions: [['40', 'Guilde factice'], ['150', 'Clan factice'], ['352', 'Dame factice']] }, show);
  assert.deepEqual(en, ['The Mages Guild', 'The Vraseth', 'For The Mages Guild and The Vraseth.']);
  assert.deepEqual(fr, ['Guilde factice', 'Clan factice', 'For Guilde factice and Clan factice.'], 'the questor answers the GUILD, not their own record');
});

test('L10N3e quest: a Person\'s =symbol_ is the flat\'s caption from the flats table by the flat\'s id (GetFlatDetailsString, Person.cs:375-380: (archive << 7) + record), and with no caption the race\'s name as the language has it (RaceTemplate.Name, :382)', () => {
  const quest = questOf();
  const maiden = personOf(quest, '_maiden_', { faction: { id: 40, type: FACTION_TYPES.Group, name: 'The Mages Guild', flat1: 22400, flat2: 22400 }, displayName: 'Anne Doe' });
  const elf = personOf(quest, '_elf_', { faction: { id: 40, type: FACTION_TYPES.Group, name: 'The Mages Guild', flat1: 22401, flat2: 22401 }, displayName: 'Ilyn Dreth', race: 4 });
  const show = () => [maiden.expandMacro(5), elf.expandMacro(5), expanded(quest, 'Ask the =maiden_.')];
  const { en, fr } = inFrench({ Internal_Flats: [['22400', 'jeune dame factice']], Internal_Strings: [['darkElf', 'Elfe noir factice']] }, show);
  assert.deepEqual(en, ['young lady in green', 'Dark Elf', 'Ask the young lady in green.']);
  assert.deepEqual(fr, ['jeune dame factice', 'Elfe noir factice', 'Ask the jeune dame factice.']);
});

test('L10N3e quest: an artifact Item\'s _symbol_ is its shortName as the language has it, by its MAGIC.DEF template (Item.cs:245 over DaggerfallUnityItem.cs:602); the item keeps the canonical name', () => {
  // Ten artifact records at their stream positions (4 + 62 x record); Azura's Star is the tenth (ArtifactsSubTypes 9)
  setMagicItemTemplates(Array.from({ length: 10 }, (_, k) => ({
    index: 4 + 62 * k, name: k === 9 ? 'Azura\'s Star' : `Artifact ${k}`, type: 1, group: 14, groupIndex: 0,
    enchantments: [{ type: 26, param: k }], uses: 50, value: 5000, material: 0,
  })));
  const quest = questOf();
  const star = new Item(quest, 'Item _star_ artifact Azuras_Star');
  quest.addResource(star);
  const show = () => [star.expandMacro(1), star.expandMacro(5), expanded(quest, 'Bring me _star_.')];
  const { en, fr } = inFrench({ Internal_MagicItems: [['562', 'Astre factice']] }, show);
  assert.deepEqual(en, ['Azura\'s Star', 'Azura\'s Star', 'Bring me Azura\'s Star.']);
  assert.deepEqual(fr, ['Astre factice', 'Astre factice', 'Bring me Astre factice.']);
  tm.setLocale('fr');
  assert.equal(star.daggerfallUnityItem.name, 'Azura\'s Star', 'the mint wrote the canonical name');
});

// ─── the macro table's faction names ─────────────────────────────────────────────────────────────────────────────

test('L10N3e quest: %kno (and %fon) is the quest faction\'s name as the language has it, THEN "The " trimmed (QuestMCP.cs:60-61)', () => {
  const quest = questOf();
  const show = () => [getContextValue('%kno', quest, quest.hooks), getContextValue('%fon', quest, quest.hooks), expanded(quest, 'The %kno awaits.')];
  const { en, fr } = inFrench({ Internal_Factions: [['40', 'The Guilde factice']] }, show);
  assert.deepEqual(en, ['Mages Guild', 'Mages Guild', 'The Mages Guild awaits.']);
  assert.deepEqual(fr, ['Guilde factice', 'Guilde factice', 'The Guilde factice awaits.'], 'the trim reads the shown name');
});

test('L10N3e quest: %vcn falls back to the last Person\'s faction name as the language has it (QuestMCP.cs:162), by the record\'s id', () => {
  const quest = questOf();
  const vampire = personOf(quest, '_vamp_', { faction: FACTIONS.get(150), displayName: 'Jean Dupont' });
  const show = () => { quest.lastResourceReferenced = vampire; return getContextValue('%vcn', quest, quest.hooks); };
  const { en, fr } = inFrench({ Internal_Factions: [['150', 'Clan factice']] }, show);
  assert.equal(en, 'The Vraseth');
  assert.equal(fr, 'Clan factice');
});

test('L10N3e quest: the rulers - %rn the region\'s first Individual child (MacroHelper.cs:662-663), %nrn the region faction\'s first child (:320-322) - as the language names them, by the child\'s id; the drawn-name arms stand', () => {
  const quest = questOf();
  const glenpoint = { ...world, currentRegionIndex: () => 18, currentRegionFaction: () => 202 };
  const show = () => [getContextValue('%rn', quest, quest.hooks), getContextValue('%nrn', quest, quest.hooks),
    getContextValue('%nrn', quest, { world: glenpoint })];
  const { en, fr } = inFrench({ Internal_Factions: [['364', 'Roi factice'], ['365', 'Reine factice'], ['202', 'Pointe factice']] }, show);
  assert.equal(en[0], 'King Gothryd');
  assert.equal(en[1], 'King Gothryd');
  assert.deepEqual(fr.slice(0, 2), ['Roi factice', 'Roi factice']);
  assert.equal(fr[2], en[2], 'no Individual child: the seeded lord name, the same in any language');
});

test('L10N3e quest: the news pair %fx1 / %fx2 names its two factions as the language has them (MacroHelper.cs:1002-1003, :1010-1011); no record is the charter\'s null', () => {
  const quest = questOf();
  const show = () => {
    setIdFactions(40, 150);
    const pair = [getContextValue('%fx1', quest, quest.hooks), getContextValue('%fx2', quest, quest.hooks)];
    setIdFactions(999, -1);
    return [...pair, getContextValue('%fx1', quest, quest.hooks), getContextValue('%fx2', quest, quest.hooks)];
  };
  const { en, fr } = inFrench({ Internal_Factions: [['40', 'Guilde factice'], ['150', 'Clan factice'], ['999', 'Rien factice']] }, show);
  assert.deepEqual(en, ['The Mages Guild', 'The Vraseth', '%fx1[nullMCP]', '%fx2[nullMCP]']);
  assert.deepEqual(fr, ['Guilde factice', 'Clan factice', '%fx1[nullMCP]', '%fx2[nullMCP]']);
});

// ─── the quest's grammar hooks ───────────────────────────────────────────────────────────────────────────────────

test('L10N3g quest: a quest message\'s finished text goes through the language\'s grammar (QuestMacroHelper.cs:158) - after its macros, so a faction name\'s {.FS} gives the article its gender; English is the identity', () => {
  const quest = questOf();
  personOf(quest, '_npc_', { faction: FACTIONS.get(40), displayName: 'Jean Dupont' });
  const show = () => [expanded(quest, '{.Le}{.MS}garde de _npc_ attend.'), expanded(quest, '{.Le}==npc_ vous attend.'), expanded(quest, 'Meet _npc_ at noon.')];
  const { en, fr } = inFrench({ Internal_Factions: [['40', '{.FS}Guilde factice']] }, show);
  assert.deepEqual(en, ['{.Le}{.MS}garde de Jean Dupont attend.', '{.Le}The Mages Guild vous attend.', 'Meet Jean Dupont at noon.'],
    'English: the identity, tokens and all');
  assert.deepEqual(fr, ['Le garde de Jean Dupont attend.', 'La Guilde factice vous attend.', 'Meet Jean Dupont at noon.']);
});

test('L10N3g quest: {NPCGender?a#b} follows the gender of the quest\'s LAST referenced resource when the text is processed - Person.ExpandMacro hands the processor that getter (Person.cs:298); a Foe\'s gender counts, a monster is male', () => {
  const quest = questOf();
  personOf(quest, '_her_', { displayName: 'Jeanne', gender: GENDERS.Female });
  personOf(quest, '_him_', { displayName: 'Jean', gender: GENDERS.Male });
  const rat = new Foe(quest, 'Foe _rat_ is Giant_rat');
  const archer = new Foe(quest, 'Foe _archer_ is Archer');
  archer.humanoidGender = GENDERS.Female;
  quest.addResource(rat);
  quest.addResource(archer);
  const show = () => [
    expanded(quest, '_her_ est {NPCGender?prêt#prête}.'),
    expanded(quest, '_him_ est {NPCGender?prêt#prête}.'),
    expanded(quest, '_him_ et _her_ : {NPCGender?a#b}'),
    expanded(quest, '_her_ et _him_ : {NPCGender?a#b}'),
    expanded(quest, '_her_ fuit _rat_ : {NPCGender?a#b}'),
    expanded(quest, '_him_ voit _archer_ : {NPCGender?a#b}'),
  ];
  const { en, fr } = inFrench({}, show);
  assert.deepEqual(en, ['Jeanne est {NPCGender?prêt#prête}.', 'Jean est {NPCGender?prêt#prête}.', 'Jean et Jeanne : {NPCGender?a#b}',
    'Jeanne et Jean : {NPCGender?a#b}', 'Jeanne fuit Rat : {NPCGender?a#b}', 'Jean voit Archer : {NPCGender?a#b}'], 'English: untouched');
  assert.deepEqual(fr, ['Jeanne est prête.', 'Jean est prêt.', 'Jean et Jeanne : b', 'Jeanne et Jean : a', 'Jeanne fuit Rat : a', 'Jean voit Archer : b']);
});

// ─── the topic tree ──────────────────────────────────────────────────────────────────────────────────────────────

test('L10N3e quest: the talk topics SHOW the names - an organization by its faction id (TalkManager.cs:3194 through GetFactionName, PersistentFactionData.cs:313), a quest person\'s and a quest thing\'s captions (:3156, :3173, and Where Is :3435-3436) - while the same-person tests compare the canonical names (:3159, :3449)', () => {
  const quest = questOf();
  const brisienna = new Person(quest, 'Person _brisi_ named Lady_Brisienna');
  quest.addResource(brisienna);
  brisienna.isQuestor = true;
  brisienna.questorData = { ...brisienna.questorData, mapID: 100, context: NPC_CONTEXT.Building };
  const daggerItem = new Item(quest, 'Item _dagger_ item class 2 template 113');   // the modded "class N template M" form: a Dagger
  quest.addResource(daggerItem);
  const tree = (partner) => new TopicTree({
    getQuest: () => quest, getAllActiveQuestIds: () => [quest.uid], currentRegionIndex: () => 17, currentMapId: () => 100,
    isPlayerInside: () => true, isPlayerInsideCastle: () => false, currentBuildingKey: () => 55,
    factionName: (id) => FACTIONS.get(id)?.name ?? '', talkPartner: () => partner,
  });
  const lists = (partner = null) => {
    const t = tree(partner);
    t.addQuestTopicWithInfoAndRumors(quest.uid, brisienna, 'brisi', QUEST_INFO_RESOURCE_TYPE.Person, [[{ formatting: 0, text: 'a' }]], null);
    t.addQuestTopicWithInfoAndRumors(quest.uid, daggerItem, 'dagger', QUEST_INFO_RESOURCE_TYPE.Thing, [[{ formatting: 0, text: 'b' }]], null);
    t.assembleTopiclistTellMeAbout();
    t.assembleTopicListPerson();
    const org = t.listTopicTellMeAbout.find((i) => i.questionType === QUESTION_TYPE.OrganizationInfo && i.factionID === 40);
    return {
      org: org?.caption, tell: t.listTopicTellMeAbout.filter((i) => i.key).map((i) => i.caption),
      where: t.listTopicPerson.map((i) => i.caption),
    };
  };
  const show = () => lists();
  const { en, fr } = inFrench({ Internal_Factions: [['40', 'Guilde factice'], ['352', 'Dame factice']], Internal_Items: [['113', 'Poignard factice']] }, show);
  assert.deepEqual(en, { org: 'The Mages Guild', tell: ['Lady Brisienna', 'Dagger'], where: ['Lady Brisienna'] });
  assert.deepEqual(fr, { org: 'Guilde factice', tell: ['Dame factice', 'Poignard factice'], where: ['Dame factice'] });
  // Talking TO her, in her building: both of her topics hide - in French too, since the partner's name and hers are
  // compared as the canonical names they are
  tm.setLocale('fr');
  const same = lists({ isStatic: true, nameNPC: 'Lady Brisienna', buildingKey: 55 });
  assert.deepEqual(same.tell, ['Poignard factice'], 'Tell Me About: the same person hides');
  assert.deepEqual(same.where, [], 'Where Is: the same person hides');
});

// ─── the building names ──────────────────────────────────────────────────────────────────────────────────────────

test('L10N3e quest: a guild hall and a temple can SHOW their faction\'s name as the language has it (FormulaHelper.cs:3022, :3036 through GetFactionData) - the name bag\'s shown pair, by the record\'s own id; a bag without it names them canonically, as before', () => {
  const getFaction = (id) => FACTIONS.get(id) ?? null;
  const canonical = {
    factionName: (id) => getFaction(id)?.name ?? '',
    templeName: (id) => { const f = getFaction(id); return (f?.children?.length ? getFaction(f.children[0])?.name : f?.name) ?? ''; },
  };
  const names = (opts) => [
    generateBuildingName(7, BUILDING_TYPES.GuildHall, { ...opts, factionId: 40 }),
    generateBuildingName(7, BUILDING_TYPES.Temple, { ...opts, factionId: 21 }),   // Arkay: its first child names the temple
    generateBuildingName(7, BUILDING_TYPES.Temple, { ...opts, factionId: 22 }),   // no child: the bag's own law, the faction
    generateBuildingName(7, BUILDING_TYPES.GuildHall, { ...opts, factionId: 999 }),   // no record: the canonical resolver's ''
  ];
  const show = () => ({ shown: names({ ...canonical, ...shownFactionNames(getFaction) }), plain: names(canonical) });
  const { en, fr } = inFrench({ Internal_Factions: [['40', 'Guilde factice'], ['82', 'Ordre factice'], ['21', 'Arkay factice'], ['22', 'Zénithar factice']] }, show);
  assert.deepEqual(en.shown, ['The Mages Guild', 'The Order of Arkay', 'Zenithar', '']);
  assert.deepEqual(en.plain, en.shown);
  assert.deepEqual(fr.shown, ['Guilde factice', 'Ordre factice', 'Zénithar factice', '']);
  assert.deepEqual(fr.plain, en.plain, 'the canonical path is unchanged in any language');
});

// ─── the systems' item names ─────────────────────────────────────────────────────────────────────────────────────

const dagger = (over = {}) => ({ group: 'Weapons', templateIndex: 113, name: 'Dagger', material: 0, maxCondition: 100, currentCondition: 100, isIdentified: true, ...over });

test('L10N3e quest: "%s has broken." names the item as shown when the caller hands the name in (ItemBreaks, DaggerfallUnityItem.cs:1207 - the port\'s short name, localized); without one, the canonical name as before', () => {
  const broken = (nameOf) => { const said = []; lowerCondition(dagger({ currentCondition: 1 }), 5, null, (t) => said.push(t), null, nameOf); return said[0]; };
  const show = () => ({ shown: broken(shownItemName), plain: broken(null) });
  const { en, fr } = inFrench({ Internal_Items: [['113', 'Poignard factice']] }, show);
  assert.deepEqual(en, { shown: 'Dagger has broken.', plain: 'Dagger has broken.' });
  assert.deepEqual(fr, { shown: 'Poignard factice has broken.', plain: 'Dagger has broken.' });
});

test('L10N3e quest: the combat mod\'s warnings and its broken line carry the item\'s short name as shown (the mod\'s item.shortName, minted in the player\'s language - DaggerfallUnityItem.cs:551)', () => {
  const warn = (item) => { const said = []; pcaaoWarningMessagePlayerEquipmentCondition(item, 100, (t) => said.push(t)); return said[0]; };
  const broke = () => {
    const said = [];
    const cuirass = { group: 'Armor', templateIndex: 102, name: 'Cuirass', material: 0, maxCondition: 100, currentCondition: 1 };
    pcaaoApplyConditionDamageThroughUnarmedDamage(cuirass, null, 5, { fadingEnchantedItems: false }, (t) => said.push(t));
    return said[0];
  };
  const show = () => ({
    plain: warn(dagger({ currentCondition: 48 })),
    made: warn(dagger({ name: 'Mac\'s Blade', currentCondition: 48 })),
    custom: warn(dagger({ currentCondition: 48, customMagic: [], enchantments: [{ type: 0, param: 14 }] })),
    broke: broke(),
  });
  const { en, fr } = inFrench({ Internal_Items: [['113', 'Poignard factice'], ['102', 'Cuirasse factice']] }, show);
  assert.deepEqual(en, { plain: 'My Dagger Could Use A Sharpening', made: 'My Mac\'s Blade Could Use A Sharpening',
    custom: 'My Dagger Is Flickering Slightly', broke: 'Cuirass has broken.' });
  assert.deepEqual(fr, { plain: 'My Poignard factice Could Use A Sharpening', made: 'My Mac\'s Blade Could Use A Sharpening',
    custom: 'My Poignard factice Is Flickering Slightly', broke: 'Cuirasse factice has broken.' });
});

test('L10N3e quest: the light lines\' %it name the light as shown when the caller hands the name in - UseItem\'s (DaggerfallInventoryWindow.cs:1777-1800) and the dying torch\'s (EnablePlayerTorch.cs:82); without one, the canonical name as before', () => {
  const torch = () => ({ group: 'UselessItems2', templateIndex: TEMPLATES.Torch, name: 'Torch', maxCondition: 50, currentCondition: 50 });
  const lantern = () => ({ group: 'UselessItems2', templateIndex: TEMPLATES.Lantern, name: 'Lantern', maxCondition: 100, currentCondition: 100 });
  const oil = () => ({ group: 'UselessItems2', templateIndex: TEMPLATES.Oil, name: 'Oil', currentCondition: 10 });
  const uses = (nameOf) => {
    const t = torch();
    const lit = useItem(t, [t], { entity: {}, nameOf }).text;
    const o = oil();
    const full = useItem(o, [lantern(), o], { entity: {}, nameOf }).text;
    const o2 = oil();
    const refuelled = useItem(o2, [{ ...lantern(), currentCondition: 50 }, o2], { entity: {}, nameOf }).text;
    return [lit, full, refuelled];
  };
  const dies = (nameOf) => {
    const t = { ...torch(), currentCondition: 1 };
    const entity = { lightSource: t, items: [t] };
    const said = [];
    tickPlayerTorch(entity, TORCH_TICK_SECONDS + 1, { fromItems: true, say: (s) => said.push(s), nameOf });
    return said[0];
  };
  const show = () => ({ shown: [...uses(shownItemName), dies(shownItemName)], plain: [...uses(null), dies(null)] });
  const { en, fr } = inFrench({ Internal_Items: [[String(TEMPLATES.Torch), 'Torche factice'], [String(TEMPLATES.Lantern), 'Lanterne factice']] }, show);
  assert.deepEqual(en.shown, ['You light the Torch.', 'Your Lantern is full.', 'You refuel your Lantern with a bottle of oil.', 'Your Torch flickers and dies.']);
  assert.deepEqual(en.plain, en.shown);
  assert.deepEqual(fr.shown, ['You light the Torche factice.', 'Your Lanterne factice is full.', 'You refuel your Lanterne factice with a bottle of oil.',
    'Your Torche factice flickers and dies.']);
  assert.deepEqual(fr.plain, en.plain);
});
