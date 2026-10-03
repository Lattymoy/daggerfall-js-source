// L10N3d part 2 (2026-09-27), THE TALK BATCH: TALK, THE MACROS, AND THE NAMES THEY BUILD, IN THE PLAYER'S LANGUAGE.
// DFU reads these Internal_Strings where it shows them - TalkManager's topic lists and its never-mind, MacroHelper's
// words (%ltn %lp %ct %cn2 %rt %sea), QuestMCP's divines, BiogFileMCP's %hpn/%hpw, RaceTemplate's names, ItemHelper's
// and the item MCP's (the long name, %po %ba %hs %mat %qua, the recipe box, the powers box - and the inventory window's
// panel shortenings, which live in the same module), FormulaHelper's building names and two combat lines,
// DaggerfallDateTime's formats and calendar, Place's residence and two quest actions' lines.
// The port reads each through the text core at the same moment. Pinned, through the port's own functions: each
// answers a translation's row once French is chosen, and its own English - byte for byte what it printed before -
// before French is chosen and after English is chosen again; a list DFU draws from is read WHOLE, so a translation's
// list and its length are the ones drawn; and the identities stay English whatever the language (a material's name,
// the Season trigger's word). townTalk's palace fallback lives inside the host's name bag, so it is pinned by source.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as tm from '../src/systems/textManager.js';
import { srand, randomRange } from '../src/formats/dfRandom.js';
import { RumorMill, RUMOR_TYPE, RESOLVING_ERROR, resolvingErrorText } from '../src/systems/rumorMill.js';
import { NativeTalkWindow, TALK_RECTS } from '../src/ui/nativeTalk.js';
import { TopicTree, EN, LIST_ITEM_TYPE, buildingTypeToGroupString, regionalBuildingNames } from '../src/systems/topicTree.js';
import { TOPIC_CATEGORIES } from '../src/systems/talkTopics.js';
import { BUILDING_TYPES, generateBuildingName, rulerTitle, RULER_TITLES } from '../src/world/buildingNames.js';
import { honorificOf, raceDisplayName, RACE_DISPLAY_NAME, expandAnswerRecord } from '../src/systems/talkSession.js';
import { getMacroValue, questMacroSource } from '../src/systems/quest/questMacros.js';
import { biogMacroSource } from '../src/systems/biography.js';
import {
  potionRecipeTokens, POTION_RECIPE_FOR_TEXT, POTION_RECIPE_WEIGHT_TEXT, conditionWord, CONDITION_WORDS,
  itemLongName, potionMacroName, expandItemInfo, materialName, infoPanelShorten,
} from '../src/systems/itemInfo.js';
import { magicPowersLines, itemPowers, POWERS_UNKNOWN_TEXT } from '../src/systems/itemPowers.js';
import { ENCHANTMENT_TYPES as T } from '../src/formats/magicDef.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import {
  dateString, dateTimeString, midDateTimeString, dayName, monthName, birthSignName, seasonName, classicGameStartDate,
  SEASON_NAMES, dayNames, monthNames,
} from '../src/systems/gameDate.js';
import { Place } from '../src/systems/quest/place.js';
import { GetItem, RevealLocation } from '../src/systems/quest/actions.js';
import { backstabDamage, calculateAttackDamage, MATERIAL_INEFFECTIVE_TEXT, SUCCESSFUL_BACKSTAB_TEXT } from '../src/combat/formulas.js';

beforeEach(() => tm._resetTextManagerForTests());

/** French rows for Internal_Strings; a list is written as DFU writes one, its lines joined by newlines. */
const fr = (rows) => tm.patchLocaleTable('fr', 'Internal_Strings',
  Object.entries(rows).map(([k, v]) => [k, Array.isArray(v) ? v.join('\n') : v]));

/** `read()` in English, then with the French rows loaded but English still chosen, then in French, then in English
 *  again. Both English readings after the first must be the first, byte for byte; answers { english, french }. */
function inFrench(rows, read) {
  const english = read();
  fr(rows);
  assert.deepEqual(read(), english, 'English stands until French is chosen');
  tm.setLocale('fr');
  const french = read();
  tm.setLocale('en');
  assert.deepEqual(read(), english, 'English again, byte for byte');
  return { english, french };
}

const t = (text) => ({ text, formatting: 1, x: 0, y: 0 });

test('L10N3d talk: the never-mind is the language\'s - GetNewsOrRumors\' initial answer and the talk window\'s caption repair, the ListItem written back with it', () => {
  const mill = () => {
    const m = new RumorMill({ nowClassicMinutes: () => 0, getFactionData: () => null, currentRegionIndex: () => 17, rolls: () => 0 });
    m.listRumorMill.push({ rumorType: RUMOR_TYPE.CommonRumor, listRumorVariants: null, questID: 0, timeLimit: 999999, faction1: 0, faction2: 0, regionID: -1, flags: 8, type: 100, textID: 1475 });
    return m.getNewsOrRumors({ numAnswersGivenTellMeAboutOrRumors: 0 });
  };
  const repaired = () => {
    const place = { questionType: 4, key: '_dungeon_', caption: '' };
    const w = new NativeTalkWindow('greeting', {
      categories: () => [], tellMeAboutTopics: () => [{ label: '', listItem: place }, { label: null, listItem: { key: '' } }],
      peopleTopics: () => [], thingsTopics: () => [], question: (row) => row.label, answer: () => '', tone: () => 1, setTone: () => {}, npcName: 'Cims Ravel',
    });
    w.click(TALK_RECTS.tellMeAbout[0] + 1, TALK_RECTS.tellMeAbout[1] + 1);
    return [...w.topics.map((r) => r.label), place.caption];
  };
  const { english, french } = inFrench({ resolvingError: '...peu importe...' }, () => [resolvingErrorText(), mill(), ...repaired()]);
  assert.deepEqual(english, [RESOLVING_ERROR, RESOLVING_ERROR, RESOLVING_ERROR, RESOLVING_ERROR, RESOLVING_ERROR]);
  assert.deepEqual(french, Array(5).fill('...peu importe...'));
});

test('L10N3d talk: the topic lists are assembled in the language - Any news?/Where am I?, the building-type groups, Previous List, General, Regional, and every "Any %s" off the whole buildingNames list', () => {
  const lists = () => {
    const tree = new TopicTree({
      getQuest: () => null,
      getBuildingList: () => [
        { name: 'The Howling Wolf', buildingType: BUILDING_TYPES.Tavern, buildingKey: 3 },
        { name: 'Castle Daggerfall', buildingType: BUILDING_TYPES.Palace, buildingKey: 9 },
      ],
    });
    tree.assembleTopiclistTellMeAbout();
    tree.assembleTopicListLocation();
    const groups = tree.listTopicLocation.map((g) => [g.caption, g.listChildItems.map((c) => (c.type === LIST_ITEM_TYPE.NavigationBack ? `<${c.caption}>` : c.caption))]);
    return { tell: tree.listTopicTellMeAbout.slice(0, 2).map((i) => i.caption), groups };
  };
  const names = regionalBuildingNames().map((n) => `${n} (fr)`);
  const { english, french } = inFrench({
    AnyNews: 'Des nouvelles ?', WhereAmI: 'Où suis-je ?', PreviousList: 'Liste précédente', General: 'Général', Regional: 'Régional',
    any: 'Un(e) %s', Taverns: 'Tavernes', buildingNames: names,
  }, lists);
  assert.deepEqual(english.tell, ['Any news?', 'Where am I?']);
  assert.deepEqual(french.tell, ['Des nouvelles ?', 'Où suis-je ?']);
  assert.deepEqual(english.groups.map(([c]) => c), ['Taverns', 'General', 'Regional']);
  assert.deepEqual(french.groups.map(([c]) => c), ['Tavernes', 'Général', 'Régional']);
  assert.deepEqual(english.groups[1][1], ['<Previous List>', 'Castle Daggerfall'], 'a building\'s own name is not a DFU word');
  assert.deepEqual(french.groups[1][1], ['<Liste précédente>', 'Castle Daggerfall']);
  assert.equal(english.groups[2][1][1], 'Any Temple of Akatosh');
  assert.equal(french.groups[2][1][1], 'Un(e) Temple of Akatosh (fr)', 'the "any" pattern over the list\'s row, %s replaced');
  assert.equal(french.groups[2][1].length, english.groups[2][1].length);
  // BuildingTypeToGroupString's thirteen, and T3c's fallback category list (the same words, read where drawn)
  const captions = () => [buildingTypeToGroupString(BUILDING_TYPES.Temple), TOPIC_CATEGORIES.map((c) => c.caption)];
  const c = inFrench({ Localtemples: 'Temples locaux', Clothingstores: 'Tailleurs' }, captions);
  assert.equal(c.english[0], 'Local temples');
  assert.equal(c.french[0], 'Temples locaux');
  assert.ok(c.english[1].includes('Clothing stores') && c.english[1].includes('Local temples'));
  assert.ok(c.french[1].includes('Tailleurs') && c.french[1].includes('Temples locaux') && c.french[1].includes('Tavernes'));
  assert.ok(c.french[1].includes('Banks'), 'a row the language lacks keeps its English');
});

test('L10N3d talk: %hnr and %ra - GetHonoric\'s Sir/Ma\'am and RaceTemplate\'s names, off the race KEY', () => {
  const words = () => [honorificOf('male'), honorificOf('female'), raceDisplayName('DarkElf'), raceDisplayName('Breton'), raceDisplayName('Vampire'),
    { ...RACE_DISPLAY_NAME }.WoodElf, expandAnswerRecord('%hnr, a fellow %ra.', {})];
  const { english, french } = inFrench({ Sir: 'Messire', "Ma'am": 'Madame', darkElf: 'Elfe noir', breton: 'Bréton', woodElf: 'Elfe des bois' }, words);
  assert.deepEqual(english, ['Sir', "Ma'am", 'Dark Elf', 'Breton', 'Vampire', 'Wood Elf', 'Sir, a fellow Breton.']);
  assert.deepEqual(french, ['Messire', 'Madame', 'Elfe noir', 'Bréton', 'Vampire', 'Elfe des bois', 'Messire, a fellow Bréton.'], 'a race DFU names no key for passes through');
});

test('L10N3d talk: MacroHelper\'s words - %ltn\'s fourteen bands, %lp, %ct, %cn2\'s fallback, %rt, %sea - and QuestMCP\'s temple divine', () => {
  let rep = 11, race = 1, type = 0;
  const hooks = {
    nowSeconds: () => (3 * 30 * 1440) * 60,   // 1st of Rain's Hand: Spring
    world: {
      legalRepNow: () => rep, currentRegionRace: () => race, currentLocationType: () => type,
      currentRegionIndex: () => 17, currentLocationIndex: () => 0,
      maps: { getRegion: () => ({ mapTable: [{ locationType: 0 }], mapNames: ['Daggerfall'] }) },   // the only city is here
      findFactionByTypeAndRegion: () => ({ ruler: 2 }),
    },
  };
  const god = () => questMacroSource({ hooks: { world: { playerInside: () => ({ building: { buildingType: 14, factionId: 22 } }) } } }).god();
  const macros = () => {
    const out = {};
    for (const r of [81, 61, 41, 21, 11, 1, 0, -81, -61, -41, -21, -11, -1]) { rep = r; out[`ltn${r}`] = getMacroValue('%ltn', null, hooks); }
    for (const r of [1, 2]) { race = r; out[`lp${r}`] = getMacroValue('%lp', null, hooks); }
    for (const x of [0, 1, 2, 3, 11, 8, 6, 5, 9]) { type = x; out[`ct${x}`] = getMacroValue('%ct', null, hooks); }
    out.cn2 = getMacroValue('%cn2', null, hooks);
    out.rt = getMacroValue('%rt', null, hooks);
    out.sea = getMacroValue('%sea', null, hooks);
    out.god = god();
    return out;
  };
  const { english, french } = inFrench({
    revered: 'vénéré', respected: 'respecté', aCommonCitizen: 'un simple citoyen', pondScum: 'la lie', undependable: 'peu fiable',
    highRock: 'Haute-Roche', hammerfell: 'Lenclume', city: 'cité', shack: 'masure', shrine: 'sanctuaire',
    daggerfall: 'Daguefilante', Queen: 'Reine', seasonNames: ['Automne', 'Printemps', 'Été', 'Hiver'], Zenithar: 'Zénithar',
  }, macros);
  assert.deepEqual(Object.entries(english).filter(([k]) => k.startsWith('ltn')).map(([, v]) => v), ['revered', 'esteemed', 'honored', 'admired',
    'respected', 'dependable', 'a common citizen', 'hated', 'pond scum', 'a villain', 'a criminal', 'a scoundrel', 'undependable']);
  assert.deepEqual([french.ltn81, french.ltn11, french.ltn0, french['ltn-61'], french['ltn-1']], ['vénéré', 'respecté', 'un simple citoyen', 'la lie', 'peu fiable']);
  assert.equal(french.ltn61, 'esteemed', 'a band the language lacks keeps its English');
  assert.deepEqual([english.lp1, english.lp2, french.lp1, french.lp2], ['High Rock', 'Hammerfell', 'Haute-Roche', 'Lenclume']);
  assert.deepEqual([english.ct0, english.ct11, english.ct9, english.ct6], ['city', 'shack', 'shrine', 'community']);
  assert.deepEqual([french.ct0, french.ct11, french.ct9, french.ct6], ['cité', 'masure', 'sanctuaire', 'community']);
  assert.deepEqual([english.cn2, french.cn2], ['Daggerfall', 'Daguefilante'], 'MacroHelper.cs:585, the "localized fallback"');
  assert.deepEqual([english.rt, french.rt], ['Queen', 'Reine']);
  assert.deepEqual([english.sea, french.sea], ['Spring', 'Printemps']);
  assert.deepEqual([english.god, french.god], ['Zenithar', 'Zénithar'], 'GetLocalizedText(divine.ToString()), QuestMCP.cs:242');
});

test('L10N3d talk: GenerateBuildingName draws from the language\'s lists - their length included - and speaks its words (House for sale, The Bank of, Palace, City Wall, the %rt title)', () => {
  const tavernA = ['Le Chat', 'Le Chien', 'Le Rat'], tavernB = ['Noir'];
  const names = () => [
    generateBuildingName(1234, BUILDING_TYPES.Tavern, {}),
    generateBuildingName(7, BUILDING_TYPES.Bank, { regionName: 'Daggerfall' }),
    generateBuildingName(7, BUILDING_TYPES.HouseForSale, {}),
    generateBuildingName(7, BUILDING_TYPES.Palace, {}),
    generateBuildingName(7, BUILDING_TYPES.Town23, {}),
    generateBuildingName(63, BUILDING_TYPES.WeaponSmith, { regentRuler: 12 }),
    rulerTitle(2), rulerTitle(0), RULER_TITLES[12],
  ];
  const { english, french } = inFrench({
    TavernsA: tavernA, TavernsB: tavernB, theBankOf: 'La Banque de', houseForSale: 'Maison à vendre', palace: 'Palais', cityWall: 'Rempart',
    StoresA: ['Chez la %rt'], WeaponStoresB: ['Armes'], Queen: 'Reine', Lord: 'Seigneur', Lady: 'Dame',
  }, names);
  srand(1234);
  const b = tavernB[randomRange(0, tavernB.length)];
  const a = tavernA[randomRange(0, tavernA.length)];
  assert.equal(french[0], `${a} ${b}`, 'the draw ranges over the French lists, B first then A');
  assert.deepEqual(english.slice(1, 5), ['The Bank of Daggerfall', 'House for sale', 'Palace', 'City Wall']);
  assert.deepEqual(french.slice(1, 5), ['La Banque de Daggerfall', 'Maison à vendre', 'Palais', 'Rempart']);
  assert.match(english[5], /^The Lady's /, 'seed 63 rolls StoresA[15], "The %rt\'s" (audit18)');
  assert.equal(french[5], 'Chez la Dame Armes', 'a one-row list, the macro filled with the language\'s title');
  assert.deepEqual(english.slice(6), ['Queen', 'Lord', 'Lady']);
  assert.deepEqual(french.slice(6), ['Reine', 'Seigneur', 'Dame'], 'the default arm is the language\'s Lord too');
});

test('L10N3d talk: the biography\'s %hpn and %hpw (BiogFileMCP.cs:91-141)', () => {
  const words = () => ['Breton', 'Nord', 'Redguard'].flatMap((r) => [biogMacroSource(r, 0).homeProvinceName(), biogMacroSource(r, 0).geographicalFeature()]);
  const { english, french } = inFrench({ highRock: 'Haute-Roche', rollingHills: 'collines', skyrim: 'Bordeciel', desertLand: 'désert' }, words);
  assert.deepEqual(english, ['High Rock', 'rolling hills', 'Skyrim', 'mountains', 'Hammerfell', 'desertland']);
  assert.deepEqual(french, ['Haute-Roche', 'collines', 'Bordeciel', 'mountains', 'Hammerfell', 'désert']);
});

test('L10N3d talk: an item speaks the language - the long name\'s material and formats, the plant variants, %po, the recipe box, %qua %ba %hs %mat - while materialName stays the English identity', () => {
  const dagger = { group: 'Weapons', templateIndex: 113, material: 1 };
  const cuirass = { group: 'Armor', templateIndex: 102, material: ARMOR_MATERIAL.Iron };
  const plant = { group: 'PlantIngredients1', templateIndex: 12 };
  const potion = { group: 'UselessItems1', templateIndex: 83, potionRecipeKey: -12345 };
  const words = () => [
    itemLongName(dagger), itemLongName(cuirass), itemLongName(plant), potionMacroName(potion),
    potionRecipeTokens().map((r) => r.text).join('|'), conditionWord({ currentCondition: 100, maxCondition: 100 }), Object.values(CONDITION_WORDS).join(','),
    expandItemInfo('%mat|%ba|%hs', dagger), materialName(dagger),
  ];
  const { english, french } = inFrench({
    steel: 'acier', iron: 'fer', longWeaponNameFormatString: '{1} en {0}', longArmorNameFormatString: '{1} de {0}',
    ingredientFormatString: '{0} {1}', northern: '(du nord)', potionOf: 'Potion de %po', unknownPowers: 'pouvoirs inconnus',
    potionRecipeFor: 'Recette de la potion de %po', potionRecipeWeight: 'Poids : %kg kilogrammes', New: 'Neuf', SlightlyUsed: 'Peu usé',
    unknownAuthor: 'auteur inconnu', Nothing: 'Rien',
  }, words);
  assert.deepEqual(english, ['Steel Dagger', 'Iron Cuirass', 'Root Tendrils (northern)', 'Potion of Unknown Powers',
    `${POTION_RECIPE_FOR_TEXT}|${POTION_RECIPE_WEIGHT_TEXT}`, 'New', 'Broken,Useless,Battered,Worn,Used,Slightly Used,Almost New,New',
    'Steel|unknown author|Nothing', 'Steel']);
  assert.deepEqual(french, ['Dagger en acier', 'Cuirass de fer', 'Root Tendrils (du nord)', 'Potion de pouvoirs inconnus',
    'Recette de la potion de %po|Poids : %kg kilogrammes', 'Neuf', 'Broken,Useless,Battered,Worn,Used,Peu usé,Almost New,Neuf',
    'acier|auteur inconnu|Rien', 'Steel'], 'the template name is L10N3e\'s; materialName keys fpArm\'s record and the CIF suffix');
  // the info panel's three shortenings (the inventory window's kgSrc..arRep, DaggerfallInventoryWindow.cs:130-135)
  const panel = () => infoPanelShorten([{ text: '9 points of damage, 2 kilograms, 7 armor rating' }, { text: '9 points de dégâts, 2 kilogrammes' }]).map((r) => r.text);
  const p = inFrench({ kgSrc: 'kilogrammes', kgRep: 'kg', damSrc: 'points de dégâts', damRep: 'dégâts', arSrc: 'points d\'armure', arRep: 'armure' }, panel);
  assert.deepEqual(p.english, ['9 damage, 2 kg, 7 armor', '9 points de dégâts, 2 kilogrammes']);
  assert.deepEqual(p.french, ['9 points of damage, 2 kilograms, 7 armor rating', '9 dégâts, 2 kg'], 'a translated record shortens its own words');
});

test('L10N3d talk: the powers box - itemPowers and each parameter list read whole by its key, and "Powers unknown."', () => {
  const item = { enchantments: [{ type: T.PotentVs, param: 0 }, { type: T.GoodRepWith, param: 1 }, { type: T.ExtraSpellPts, param: 2 }, { type: T.None }] };
  const lines = () => [magicPowersLines(item), magicPowersLines(item, { identified: false }), itemPowers().length];
  const powers = itemPowers().map((p) => `${p}~`);
  const { english, french } = inFrench({
    itemPowers: powers, enemyGroupNames: ['morts-vivants', 'Daedra', 'humanoïdes', 'animaux'], repWithGroups: ['Roturiers', 'Marchands', 'Érudits', 'Nobles', 'Pègre', 'Tous'],
    powersUnknown: 'Pouvoirs inconnus.',
  }, lines);
  assert.deepEqual(english, [['Potent vs undead', 'Good rep with Merchants', 'Extra spell pts during Summer'], [POWERS_UNKNOWN_TEXT], 26]);
  assert.deepEqual(french, [['Potent vs~ morts-vivants', 'Good rep with~ Marchands', 'Extra spell pts~ during Summer'], ['Pouvoirs inconnus.'], 26],
    'a list the language lacks keeps its English rows');
});

test('L10N3d talk: DaggerfallDateTime\'s formats and calendar - DateString, DateTimeString, MidDateTimeString and the four name lists - while SEASON_NAMES stays the Season trigger\'s English', () => {
  const d = classicGameStartDate();   // 13:30 on the 4th of Morning Star, 3E405 - a Middas
  const late = { year: 405, month: 11, day: 24, hour: 9, minute: 5, second: 59 };
  const dates = () => [dateString(d), dateTimeString(d), midDateTimeString(d), midDateTimeString(late), dayName(d), monthName(late), birthSignName(d), seasonName(d), [...SEASON_NAMES].join(',')];
  const { english, french } = inFrench({
    dateFormatString: '{0} {1} {3:00}', dateTimeFormatString: '{0:00}h{1:00}:{2:00}, le {3} {5:00} 3E{6}', midDateTimeFormatString: '{3:00}/{4:00}/3E{5} {0:00}:{1:00}',
    dayNames: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'], monthNames: monthNames().map((m) => `Mois de ${m}`),
    birthSignNames: ['Le Rituel'], seasonNames: ['Automne', 'Printemps', 'Été', 'Hiver'],
  }, dates);
  assert.deepEqual(english, ['Middas the 4th of Morning Star', '13:30:00 on 4th of Morning Star, 3E405', '13:30:00 04 Morning Star 3E405',
    '09:05:59 25 Evening Star 3E405', 'Middas', 'Evening Star', 'The Ritual', 'Winter', 'Fall,Spring,Summer,Winter']);
  assert.deepEqual(french, ['Mercredi 4 Mois de Morning Star', '13h30:00, le 4 Mois de Morning Star 3E405', '04/Mois de Morning Star/3E405 13:30',
    '25/Mois de Evening Star/3E405 09:05', 'Mercredi', 'Mois de Evening Star', 'Le Rituel', 'Hiver', 'Fall,Spring,Summer,Winter']);
  assert.equal(dayNames().length, 7);
});

test('L10N3d talk: Place\'s "The %s Residence", GetItem\'s gold line and RevealLocation\'s notebook entry, %s and %map replaced in the language\'s row', () => {
  const residence = () => { srand(5); return new Place({ rolls: () => 0 })._getBuildingName({}, 17, { regionIndex: 17 }, null); };
  const said = () => {
    const hud = [], notes = [];
    const quest = {
      uid: 1, getItem: () => ({ daggerfallUnityItem: { group: 'Currency', templateIndex: 276, stackCount: 50 } }),
      getPlace: () => ({ siteDetails: { regionName: 'Daggerfall', locationName: 'Privateer\'s Hold' } }),
      hooks: { addGold: () => {}, addHUDText: (line) => hud.push(line), world: { discoverLocation: () => {}, addNote: (line) => notes.push(line) } },
    };
    const get = new GetItem(quest); get.itemSymbol = { name: 'gold' }; get.textId = 0; get.update();
    const reveal = new RevealLocation(quest); reveal.placeSymbol = { name: 'hold' }; reveal.readMap = true; reveal.update();
    return [residence(), ...hud, ...notes];
  };
  const { english, french } = inFrench({
    theNamedResidence: 'La résidence %s', youReceiveGoldPieces: 'Vous recevez %s pièces d\'or.', readMap: 'Vous avez trouvé %map sur une carte.',
  }, said);
  const surname = /^The (.+) Residence$/.exec(english[0])?.[1];
  assert.ok(surname);
  assert.deepEqual(english.slice(1), ['You receive 50 gold pieces.', 'Discovered the location of Privateer\'s Hold after studying a map.']);
  assert.deepEqual(french, [`La résidence ${surname}`, 'Vous recevez 50 pièces d\'or.', 'Vous avez trouvé Privateer\'s Hold sur une carte.']);
});

test('L10N3d talk: FormulaHelper\'s two combat lines - a successful backstab, and a weapon whose material cannot bite - said in the language', () => {
  const lines = () => {
    const said = [];
    backstabDamage(10, 50, () => 0.4, (l) => said.push(l));
    calculateAttackDamage({ isPlayer: true }, { minMetalToHit: 2 }, { weapon: { group: 'Weapons', templateIndex: 113, material: 1 }, say: (l) => said.push(l) });
    return said;
  };
  const { english, french } = inFrench({ successfulBackstab: 'Coup dans le dos réussi !', materialIneffective: 'Le métal de votre arme est inefficace.' }, lines);
  assert.deepEqual(english, [SUCCESSFUL_BACKSTAB_TEXT, MATERIAL_INEFFECTIVE_TEXT]);
  assert.deepEqual(french, ['Coup dans le dos réussi !', 'Le métal de votre arme est inefficace.']);
});

test('L10N3d talk by source: townTalk\'s palace resolver hands a palace that is not one of the three capitals to GenerateBuildingName\'s own localized "palace" (FormulaHelper.cs:3069); the Daggerfall/Wayrest/Sentinel lookup stays an identity - it keys the canonical location name', () => {
  const tt = readFileSync(new URL('../src/scenes/townTalk.js', import.meta.url), 'utf8');
  assert.match(tt, /const id = \{ Daggerfall: 475, Wayrest: 476, Sentinel: 477 \}\[locName\];/);
  assert.match(tt, /return v\?\.\[0\] \? v\[0\]\.replace\(\/\\\.\$\/, ''\) : null;/);
  const { english, french } = inFrench({ palace: 'Palais' }, () => generateBuildingName(7, BUILDING_TYPES.Palace, { palaceName: () => null }));
  assert.deepEqual([english, french], ['Palace', 'Palais']);
});
