// L10N3d (2026-09-27): THE WORDS BETWEEN THE BATCHES, IN THE PLAYER'S LANGUAGE. The five part-2 batches each routed the
// words of their own DFU windows; the lines a batch found in another's file - or in no one's - were routed after the
// merge, and are pinned here through the port's own functions: the exhausted swimmer's line and the sick body's alert
// (their readers beside their constants), the over-encumbered swimmer's latch, the weapon hand's switch line (said by the
// rig, where it is shown), the
// pinched purse (the one-coin row and the %d row), the Features tile that shows DFU's dungeon-texture words while its
// law stays English (All off and the switch reading find Off by the law's words), and the menu clock, which reads the
// time off the date rather than splitting a formatted line a translation need not shape the same. English is byte for
// byte what each showed before, with no language chosen and with English chosen again.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as tm from '../src/systems/textManager.js';
import { exhaustedInWaterText, EXHAUSTED_IN_WATER } from '../src/systems/rest.js';
import { youFeelSomewhatBadText, YOU_FEEL_SOMEWHAT_BAD } from '../src/systems/diseases.js';
import { afloatMessageStep, CANNOT_FLOAT_TEXT } from '../src/player/motor.js';
import { PlayerWeapon, USING_RIGHT_HAND_TEXT, USING_LEFT_HAND_TEXT } from '../src/combat/playerWeapon.js';
import { pickpocket } from '../src/systems/talk.js';
import { SKILLS } from '../src/systems/skills.js';
import { FEATURES } from '../src/systems/features.js';
import { tileStates, barReading, classicSegment } from '../src/ui/enhancedMenu.js';
import { _resetForTests as resetSettings } from '../src/systems/settings.js';

beforeEach(() => { tm._resetTextManagerForTests(); resetSettings(); });
const fr = (rows, table = 'Internal_Strings') => { tm.patchLocaleTable('fr', table, rows); tm.setLocale('fr'); };
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test('L10N3d crossings: the exhausted swimmer\'s line and the sick body\'s alert read by DFU\'s keys - English their constants', () => {
  assert.equal(exhaustedInWaterText(), EXHAUSTED_IN_WATER);
  assert.equal(youFeelSomewhatBadText(), YOU_FEEL_SOMEWHAT_BAD);
  fr([['exhaustedInWater', 'La fatigue vous emporte dans une tombe liquide....'], ['youFeelSomewhatBad', 'Vous vous sentez un peu mal.']]);
  assert.equal(exhaustedInWaterText(), 'La fatigue vous emporte dans une tombe liquide....');
  assert.equal(youFeelSomewhatBadText(), 'Vous vous sentez un peu mal.');
  tm.setLocale('en');
  assert.equal(exhaustedInWaterText(), 'Fatigue overcomes you and sends you to a watery grave....');
  assert.equal(youFeelSomewhatBadText(), 'You feel somewhat bad.');
});

test('L10N3d crossings: the afloat latch says cannotFloat in the player\'s language, once; the weapon hand\'s switch - ToggleHand\'s English is the hand\'s name, and the rig says usingRightHand / usingLeftHand where it shows it', () => {
  const swimmer = () => ({ carriedWeight: () => 1000, swimming: true, displayAfloatMessage: false });
  assert.equal(afloatMessageStep(swimmer(), false), CANNOT_FLOAT_TEXT);
  fr([['cannotFloat', 'Vous portez trop pour flotter.'], ['usingRightHand', 'Arme dans la main droite.'], ['usingLeftHand', 'Arme dans la main gauche.']]);
  const p = swimmer();
  assert.equal(afloatMessageStep(p, false), 'Vous portez trop pour flotter.');
  assert.equal(afloatMessageStep(p, false), null, 'latched: said once');
  const w = new PlayerWeapon();
  assert.deepEqual([w.toggleHand({ apply: false, bowSwitching: false }), w.toggleHand({ apply: false, bowSwitching: false })].sort(),
    [USING_RIGHT_HAND_TEXT, USING_LEFT_HAND_TEXT].sort(), 'the hand\'s name, in any language (the rig reads it, and says the row)');
  const rig = readFileSync(new URL('../src/combat/weaponRig.js', import.meta.url), 'utf8');
  assert.match(rig, /say\(line === USING_RIGHT_HAND_TEXT \? localizedText\('usingRightHand', 'Using weapon in right hand\.'\) : localizedText\('usingLeftHand', 'Using weapon in left hand\.'\)\);/);
  assert.equal(/\bsay\(line\);/.test(rig), false, 'never the bare English');
});

test('L10N3d crossings: the pinched purse - youPinchedGoldPiece for one coin, youPinchedGoldPieces with %d filled AFTER the lookup', () => {
  const thief = () => ({
    isPlayer: true, level: 8, goldPieces: 0, items: [],
    skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 100])),
    skillUses: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 0])),
    stats: { personality: 50 }, activeEffects: [],
  });
  assert.equal(pickpocket(thief(), { rolls: seq(0, 0.5, 0.5) }).message, 'You pinched 4 gold pieces.');
  assert.equal(pickpocket(thief(), { rolls: seq(0, 0.5, 0) }).message, 'You pinched 1 gold piece.');
  fr([['youPinchedGoldPiece', 'Vous avez chipé 1 pièce d\'or.'], ['youPinchedGoldPieces', 'Vous avez chipé %d pièces d\'or.']]);
  assert.equal(pickpocket(thief(), { rolls: seq(0, 0.5, 0.5) }).message, 'Vous avez chipé 4 pièces d\'or.');
  assert.equal(pickpocket(thief(), { rolls: seq(0, 0.5, 0) }).message, 'Vous avez chipé 1 pièce d\'or.');
});

test('L10N3d crossings: the dungeon-texture tile shows DFU\'s words in the player\'s language while its law - the labels All off and the switch reading use - stays English', () => {
  const row = FEATURES.find((f) => f.id === 'dungeon-wall-style');
  const en = tileStates(row);
  assert.deepEqual(en.labels, ['Classic', 'Climate', 'Climate Only', 'Random', 'Random Only']);
  assert.deepEqual(en.shown, en.labels, 'English: the words shown are the law\'s');
  tm.patchLocaleTable('fr', 'Internal_Settings', [['dungeonTextureModes', 'Classique\nClimat\nClimat seul\nAléatoire\nAléatoire seul']]);
  tm.setLocale('fr');
  const st = tileStates(row);
  assert.deepEqual(st.shown, ['Classique', 'Climat', 'Climat seul', 'Aléatoire', 'Aléatoire seul']);
  assert.deepEqual(st.labels, en.labels, 'the law under the words never moves');
  assert.deepEqual(barReading(st), barReading(en), 'a choice with no Off in either language');
  assert.equal(classicSegment(row, st), 0, 'All off still presses Classic');
  const src = readFileSync(new URL('../src/ui/enhancedMenu.js', import.meta.url), 'utf8');
  assert.match(src, /el\('button', `ft-segb\$\{i === r\.off \? ' off' : ''\}`, st\.shown\?\.\[i\] \?\? L\)/, 'the bar draws the shown word, else the law\'s');
});

test('L10N3d crossings: the menu clock reads the time off the date - never by splitting a formatted line at " on ", which a translation\'s pattern need not contain', () => {
  const src = readFileSync(new URL('../src/ui/enhancedMenu.js', import.meta.url), 'utf8');
  assert.equal(/split\(' on '\)/.test(src), false);
  assert.match(src, /el\('span', 'px-clocktime', formatText\('\{0:00\}:\{1:00\}:\{2:00\}', d\.hour, d\.minute, d\.second\)\)/);
  assert.equal(tm.formatText('{0:00}:{1:00}:{2:00}', 7, 5, 0), '07:05:00');
});

test('L10N3d crossings, by source: the hosts say each crossing line through its reader - never the bare English or its constant, which would stay English in every language', () => {
  const rd = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  const hosts = Object.fromEntries(['world', 'worldModes', 'exterior', 'dungeonContext', 'dungeon', 'townTalk'].map((h) => [h, rd(`scenes/${h}.js`)]));
  const BARE = [
    /\bTOO_FAR_AWAY_TEXT\b/, /'You are too far away\.\.\.'/, /\bEXHAUSTED_IN_WATER\b/, /watery grave/, /\bSUNLIGHT_TRAVEL_TEXT\b/,
    /initiate fast travel during the day/, /\bLOCKED_EXTERIOR_DOOR_TEXT\b/, /'Locked\.'/, /Interaction is now in \$\{/,
  ];
  for (const [h, s] of Object.entries(hosts)) for (const re of BARE) assert.equal(re.test(s), false, `${h}.js says ${re} bare`);
  // SWIM-SPENT (main, 2026-09-30): the three hosts with water drown a swimmer by a share of the health and the port's
  // own line (rest.js EXHAUSTED_SWIMMING_LINE, L10N4's); DFU's watery grave stands in the interior host alone
  for (const h of ['world', 'exterior', 'dungeonContext']) assert.match(hosts[h], /out\.kind === 'drown'/, `${h}: the drowning swimmer`);
  assert.match(hosts.worldModes, /out\.inWater \? \[exhaustedInWaterText\(\)\] :/, 'worldModes: the exhausted swimmer');
  assert.match(hosts.worldModes, /townTalk\?\.say\?\.\(lockedExteriorDoorText\(\)\);/, 'the locked door');
  assert.match(hosts.world, /sayWithNightfall\(sunlightTravelText\(\)\);/, 'the travel map door (LIVED1: and the world\'s nightfall after it)');
  assert.match(hosts.world, /&& isDayFromMinutes\(nowMin\)\) return withNightfall\(sunlightTravelText\(\)\);/, 'the party\'s refusal');
  for (const h of ['world', 'exterior']) assert.match(hosts[h], /tooFarText: tooFarAwayText,/, `${h}: the horse cart's refusal`);
  assert.match(hosts.dungeon, /\{ setMidScreenText\(tooFarAwayText\(\)\); return true; \}/, 'the dungeon\'s own reach');
  for (const [p, n] of [['systems/diseases.js', 1], ['systems/poisons.js', 1]]) {
    assert.equal((rd(p).match(/onAlert\(youFeelSomewhatBadText\(\)\)/g) ?? []).length, n, `${p}: the alert`);
    assert.equal(/onAlert\((?:YOU_FEEL_SOMEWHAT_BAD|'You feel somewhat bad\.')\)/.test(rd(p)), false, `${p}: never bare`);
  }
});

test('L10N3d crossings: the court\'s words - each crime by its enum name (MacroHelper.Crime), 0 left to the caller\'s "None"; the sentence\'s three rows, %gtp and %dip filled after the lookup', async () => {
  const { CRIME_NAMES, penaltyText, CRIMES } = await import('../src/systems/court.js');
  assert.equal(CRIME_NAMES[CRIMES.Attempted_Breaking_And_Entering], 'Attempted Breaking and Entering');
  assert.equal(CRIME_NAMES[CRIMES.LoanDefault], 'Loan Default');
  assert.equal(CRIME_NAMES[0], undefined, 'the arrest flow says its own "None"');
  assert.equal(penaltyText({ punishmentType: 2, fine: 120, daysInPrison: 3 }), '120 gold pieces in fines and 3 days in prison');
  assert.equal(penaltyText({ punishmentType: 1 }), 'Execution');
  assert.equal(penaltyText({ punishmentType: 0 }), 'Banishment');
  fr([['Murder', 'Meurtre'], ['Loan_Default', 'Défaut de prêt'], ['Regular_Punishment_String', '%dip jours de prison et %gtp pièces d\'or d\'amende'], ['Execution', 'Exécution'], ['Banishment', 'Bannissement']]);
  assert.equal(CRIME_NAMES[CRIMES.Murder], 'Meurtre');
  assert.equal(CRIME_NAMES[CRIMES.LoanDefault], 'Défaut de prêt', 'the DFU key, not the port\'s enum spelling');
  assert.equal(penaltyText({ punishmentType: 2, fine: 120, daysInPrison: 3 }), '3 jours de prison et 120 pièces d\'or d\'amende', 'the translation\'s own order');
  assert.equal(penaltyText({ punishmentType: 1 }), 'Exécution');
  assert.equal(penaltyText({ punishmentType: 0 }), 'Bannissement');
});

test('L10N3d crossings: the broken item (itemHasBroken / itemHasBrokenPlural, %s filled after the lookup), the reputation-change words and the Create Item picker', async () => {
  const { lowerCondition } = await import('../src/systems/equip.js');
  const { repChangeStr } = await import('../src/ui/chargenArt.js');
  const { createItemLabels, CREATE_ITEM_ROWS } = await import('../src/systems/createItem.js');
  const breakOne = (templateIndex, name) => { const said = []; lowerCondition({ templateIndex, name, currentCondition: 1, maxCondition: 10 }, 5, null, (t) => said.push(t)); return said[0]; };
  assert.equal(breakOne(102, 'Chain Cuirass'), 'Chain Cuirass has broken.');
  assert.equal(breakOne(108, 'Boots'), 'Boots have broken.');
  assert.deepEqual([repChangeStr(0), repChangeStr(-2), repChangeStr(3)], ['Unchanged', 'Lower', 'Higher']);
  assert.deepEqual(createItemLabels(), CREATE_ITEM_ROWS.map((r) => r.label), 'English: each row\'s own label');
  fr([['itemHasBroken', '%s est brisé.'], ['itemHasBrokenPlural', '%s sont brisées.'], ['unchanged', 'Inchangée'], ['lower', 'Moindre'], ['higher', 'Meilleure'],
    ['LeatherCuirass', 'Cuirasse de cuir'], ['SteelBattleAxe', 'Hache de bataille en acier']]);
  assert.equal(breakOne(102, 'Chain Cuirass'), 'Chain Cuirass est brisé.');
  assert.equal(breakOne(108, 'Boots'), 'Boots sont brisées.');
  assert.deepEqual([repChangeStr(0), repChangeStr(-2), repChangeStr(3)], ['Inchangée', 'Moindre', 'Meilleure']);
  const labels = createItemLabels();
  assert.equal(labels[0], 'Cuirasse de cuir');
  assert.equal(labels[CREATE_ITEM_ROWS.findIndex((r) => r.label === 'Steel Battle Axe')], 'Hache de bataille en acier');
  assert.equal(labels[1], 'Leather Gauntlets', 'a row the pack lacks: its English');
});

test('L10N3d crossings: the skill names (GetSkillName, a getter per element; Orcish and Daedric revert to the language\'s own name for a pack that predates their skill rows) and the profile card\'s attribute and vital words', async () => {
  const { SKILL_NAMES, SKILL_KEYS, SKILLS } = await import('../src/systems/skills.js');
  const { ATTR_SHORT, ATTR_LABELS, VITAL_LABELS } = await import('../src/ui/profileWindow.js');
  const derived = SKILL_KEYS.map((k) => (k === 'HandToHand' ? 'Hand-to-Hand' : k.replace(/([a-z])([A-Z])/g, '$1 $2')));
  assert.deepEqual([...SKILL_NAMES], derived, 'English: the names the sheet has always printed');
  assert.ok(Array.isArray(SKILL_NAMES) && Object.isFrozen(SKILL_NAMES) && SKILL_NAMES.length === 35);
  assert.deepEqual([...ATTR_SHORT, ...ATTR_LABELS, ...VITAL_LABELS], ['STR', 'INT', 'WIL', 'AGI', 'END', 'PER', 'SPD', 'LUC',
    'Strength', 'Intelligence', 'Willpower', 'Agility', 'Endurance', 'Personality', 'Speed', 'Luck', 'Health', 'Fatigue', 'Magicka']);
  fr([['shortBlade', 'Lame courte'], ['orcish', 'Orque'], ['daedricSkill', 'Daedrique (compétence)'], ['STR', 'FOR'], ['strength', 'Force'], ['fatigue', 'Fatigue (fr)']]);
  assert.equal(SKILL_NAMES[SKILLS.ShortBlade], 'Lame courte');
  assert.equal(SKILL_NAMES[SKILLS.Orcish], 'Orque', 'no orcishSkill row: the language\'s own name');
  assert.equal(SKILL_NAMES[SKILLS.Daedric], 'Daedrique (compétence)', 'the skill row where the pack has one');
  assert.equal(SKILL_NAMES[SKILLS.Medical], 'Medical', 'a row the pack lacks: its English');
  assert.equal(SKILL_NAMES.map((n) => n)[SKILLS.ShortBlade], 'Lame courte', 'read through map as a window reads it');
  assert.deepEqual([ATTR_SHORT[0], ATTR_LABELS[0], VITAL_LABELS[1]], ['FOR', 'Force', 'Fatigue (fr)']);
});

test('L10N3d crossings: the race a screen shows - raceDisplayName by key or by a stored name, liveRaceName the curse\'s own name for the cursed and the birth race\'s shown name for everyone else', async () => {
  const { raceDisplayName } = await import('../src/systems/talkSession.js');
  const { liveRaceName, createVampirismCurse } = await import('../src/systems/vampirism.js');
  const { VAMPIRE_CLANS } = await import('../src/systems/infection.js');
  const mortal = (race) => ({ isPlayer: true, race, gender: 'male', level: 10, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    items: [], activeEffects: [], spells: [], health: 100, maxHealth: 100, fatigue: 100 });
  assert.equal(raceDisplayName('DarkElf'), 'Dark Elf');
  assert.equal(raceDisplayName('Dark Elf'), 'Dark Elf');
  assert.equal(liveRaceName(mortal('DarkElf')), 'Dark Elf');
  const v = mortal('Breton');
  createVampirismCurse(v, VAMPIRE_CLANS.Lyrezi, { now: 523530 });
  assert.equal(liveRaceName(v), 'Vampire');
  fr([['darkElf', 'Elfe noir'], ['breton', 'Bréton'], ['vampire', 'Vampire (fr)']]);
  assert.equal(raceDisplayName('Dark Elf'), 'Elfe noir', 'a stored name finds its key');
  assert.equal(liveRaceName(mortal('DarkElf')), 'Elfe noir');
  assert.equal(liveRaceName(v), 'Vampire (fr)', 'the curse\'s name, in the player\'s language');
  assert.equal(v.race, 'Breton', 'the entity keeps its English identity');
});

test('L10N3d crossings: the magic-item, transport, enchanting, level-up, trade and carry refusals read by DFU\'s keys; by source, every window and host says them through the readers', async () => {
  const { noItemToActivateText, NO_ITEM_TO_ACTIVATE_TEXT } = await import('../src/ui/useMagicItemWindow.js');
  const { cannotChangeIndoorsText, CANNOT_CHANGE_INDOORS } = await import('../src/ui/transportWindow.js');
  const { enchantDecision } = await import('../src/systems/enchanting.js');
  assert.equal(noItemToActivateText(), NO_ITEM_TO_ACTIVATE_TEXT);
  assert.equal(cannotChangeIndoorsText(), CANNOT_CHANGE_INDOORS);
  assert.equal(enchantDecision({ templateIndex: 102 }, [], []).text, 'You have not prepared enchantments for this item.');
  fr([['noItemToActivate', 'Aucun objet magique utilisable'], ['cannotChangeTransportationIndoors', 'Pas de monture à l\'intérieur.'], ['noEnchantments', 'Aucun enchantement préparé.']]);
  assert.equal(noItemToActivateText(), 'Aucun objet magique utilisable');
  assert.equal(cannotChangeIndoorsText(), 'Pas de monture à l\'intérieur.');
  assert.equal(enchantDecision({ templateIndex: 102 }, [], []).text, 'Aucun enchantement préparé.');
  const rd = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  for (const [p, re] of [
    ['scenes/world.js', /if \(!taverns\.length\) return localizedText\('tavern', 'tavern'\);/],
    ['scenes/world.js', /\{ \.\.\.sale, text: cannotCarryText\(\) \}/],
    ['ui/nativeTrade.js', /text: cannotRemoveItemText\(\), center: true/], ['ui/enhancedTrade.js', /text: cannotRemoveItemText\(\), center: true/],
    ['ui/nativeTrade.js', /plan\.refusal\?\.text \?\? cannotCarryText\(\)/], ['ui/enhancedTrade.js', /plan\.refusal\?\.text \?\? cannotCarryText\(\)/],
    ['ui/levelUpView.js', /LANE_VIRTUE \? REMAINING_POINTS_ERROR : mustDistributeBonusPointsText\(\)\);/],
    ['combat/pcaao.js', /say\?\.\(successfulBackstabText\(\)\);/], ['combat/pcaao.js', /say\?\.\(materialIneffectiveText\(\)\);/],
    ['ui/enhancedInventory.js', /potion: localizedText\('potionOf', 'Potion of %po'\)\.replaceAll\('%po', potionMacroName\(item\)\)/],
    ['ui/chargenArt.js', /shadowText\(renderer, font, raceDisplayName\(flow\.race\.key\)/], ['ui/provinceMap.js', /people: raceDisplayName\(race\.key\),/],
    ['ui/enhancedChargen.js', /`Play as \$\{raceDisplayName\(flow\.race\.key\)\}`/], ['ui/chargen.js', /line\(`\$\{raceDisplayName\(this\.race\.key\)\} \$\{this\.gender\}`/],
    ['ui/charsheet.js', /label\(processGrammar\(liveRaceName\(e\) \|\| 'Breton'\), 41, 14\);/], ['ui/enhancedCharSheet.js', /race: processGrammar\(liveRaceName\(e\) \|\| 'Breton'\),/],
  ]) assert.match(rd(p), re, p);
  for (const h of ['world', 'worldModes', 'dungeonContext']) assert.match(rd(`scenes/${h}.js`), /noItemToActivateText\(\)\)/, `${h}: the U key`);
  for (const h of ['worldModes', 'dungeonContext']) assert.match(rd(`scenes/${h}.js`), /openTransport\(\) \{ [^}]*cannotChangeIndoorsText\(\)/, `${h}: the T key`);
});
