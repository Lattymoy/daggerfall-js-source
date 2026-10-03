// L10N3d (2026-09-27): EVERY DFU WORD THE PORT ROUTES, CHECKED WHERE IT STANDS. Read off the whole of src/: each
// `localizedText('key', 'English')` and `localizedTextList('key', [...])` with a literal key, and each entry of a
// `localizedStrings({...})` or `localizedTable({...})` table. Pinned for every one: the key is one of DFU's in the
// collection it names (vendor/dfu-text), and the English is DFU's, byte for byte, unless it is named below with the
// reason; a single word is read where it is shown, never once at module load (where it would freeze in English); and
// the count of routed words, file by file - a site that goes back to a bare literal is a word no translation reaches.
// The scan is tools/l10nRouted.mjs's (its CLI prints the ROUTED map below); the helpers themselves (localizedTable,
// formatText) are pinned at the foot.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as tm from '../src/systems/textManager.js';
import { routedWords, dfuTables } from '../tools/l10nRouted.mjs';

beforeEach(() => tm._resetTextManagerForTests());

/** DFU's English, by collection: the vendored master tables. */
const DFU = dfuTables();

/** The words whose English is the port's own, by `file|key`, and why. */
const OWN_ENGLISH = new Map([
  ['src/systems/skills.js|pickpocket', ['Pickpocket', 'the port\'s skill name, derived from the enum key since U10; DFU ships "Pickpocketing" (reported, not changed here)']],
  ['src/ui/enhancedChargen.js|commoners', ['Peasants', 'the reputation window\'s painted art; DFU keys the group "commoners"']],
  ['src/ui/settingsLaw.js|FourThree', ['4:3', 'DFU\'s shipped English (Internal_Strings_en.asset); the master CSV\'s "4:03" is a spreadsheet\'s reading of 4:3']],
  ['src/ui/settingsCopy.js|depthOfField', ['Depth Of Field', 'the settings screen\'s Title Case (settingsCopy.js LABELS) of DFU\'s "Depth of Field"']],
  ['src/world/buildingNames.js|WeaponStoresB', [DFU.get('Internal').get('WeaponStoresB').replace(/\r\n/g, '\n'),
    'DFU\'s row separates its lines with CRLF where every other list uses LF; GetLocalizedTextList splits on either, so the rows are DFU\'s byte for byte']],
  ['src/ui/enhancedRest.js|restHowManyHours', ['Rest how many hours?', 'the enhanced card asks DFU\'s field label as its heading; DFU: "Rest how many hours : "']],
  ['src/ui/enhancedRest.js|loiterHowManyHours', ['Loiter how many hours?', 'the enhanced card asks DFU\'s field label as its heading; DFU: "Loiter how many hours : "']],
]);

const WORDS = routedWords();

/** The routed words, file by file. A new site raises its file's count here; a lost one fails. */
const ROUTED = {
  'src/characters/nameHelper.js': 1,
  'src/combat/formulas.js': 2,
  'src/combat/weaponRig.js': 3,
  'src/player/activate.js': 2,
  'src/player/climbing.js': 1,
  'src/player/interactionMode.js': 5,
  'src/player/mobileEnemyActivate.js': 2,
  'src/player/motor.js': 1,
  'src/scenes/corpseMarker.js': 2,
  'src/scenes/dungeonContext.js': 2,
  'src/scenes/exterior.js': 1,
  'src/scenes/hostMagic.js': 6,
  'src/scenes/world.js': 13,
  'src/scenes/worldModes.js': 7,
  'src/systems/answerPipeline.js': 24,
  'src/systems/artifactEffects.js': 1,
  'src/systems/banking.js': 5,
  'src/systems/biography.js': 16,
  'src/systems/bookshelf.js': 1,
  'src/systems/buildingLocks.js': 3,
  'src/systems/controlsConfig.js': 1,
  'src/systems/court.js': 18,
  'src/systems/createItem.js': 30,
  'src/systems/customClass.js': 8,
  'src/systems/decorCatalogue.js': 3,
  'src/systems/diseases.js': 1,
  'src/systems/effects.js': 11,
  'src/systems/enchanting.js': 1,
  'src/systems/enchantmentCatalogue.js': 20,
  'src/systems/equip.js': 2,
  'src/systems/gameDate.js': 7,
  'src/systems/guildServiceFlow.js': 21,
  'src/systems/guildServices.js': 9,
  'src/systems/guildVariants.js': 13,
  'src/systems/guilds.js': 6,
  'src/systems/inventorySession.js': 2,
  'src/systems/itemInfo.js': 38,
  'src/systems/itemPowers.js': 13,
  'src/systems/itemTransfer.js': 4,
  'src/systems/knightlyGifts.js': 1,
  'src/systems/legalBands.js': 14,   // REP5 (main): the %ltn ladder's one home
  'src/systems/lycanthropy.js': 2,
  'src/systems/mysticism.js': 14,
  'src/systems/notebook.js': 5,
  'src/systems/playerTorch.js': 1,
  'src/systems/potions.js': 20,
  'src/systems/quest/actions.js': 2,
  'src/systems/quest/offerFlow.js': 2,
  'src/systems/quest/place.js': 1,
  'src/systems/quest/questMacros.js': 34,   // REP5 (main): %ltn's fourteen bands live in legalBands.js now
  'src/systems/repairService.js': 4,
  'src/systems/rest.js': 1,
  'src/systems/restSession.js': 7,
  'src/systems/rumorMill.js': 1,
  'src/systems/skills.js': 37,
  'src/systems/specialAdvantages.js': 71,
  'src/systems/spellEffects.js': 68,
  'src/systems/spellMaker.js': 1,
  'src/systems/talk.js': 12,
  'src/systems/talkSession.js': 10,
  'src/systems/talkTopics.js': 13,
  'src/systems/tavern.js': 14,
  'src/systems/topicTree.js': 20,
  'src/systems/tradeModes.js': 4,
  'src/systems/useItem.js': 8,
  'src/systems/vampirism.js': 4,
  'src/systems/worldTick.js': 2,
  'src/ui/automapText.js': 28,
  'src/ui/bankPurchaseWindow.js': 1,
  'src/ui/bankWindow.js': 1,
  'src/ui/chargen.js': 19,
  'src/ui/chargenArt.js': 5,
  'src/ui/charsheet.js': 6,
  'src/ui/controlsWindow.js': 2,
  'src/ui/enhancedChargen.js': 5,
  'src/ui/enhancedControls.js': 2,
  'src/ui/enhancedInventory.js': 1,
  'src/ui/enhancedMenu.js': 5,
  'src/ui/enhancedRest.js': 2,
  'src/ui/guildServiceWindows.js': 3,
  'src/ui/itemMakerWindow.js': 1,
  'src/ui/joystickControlsWindow.js': 1,
  'src/ui/levelNotice.js': 1,
  'src/ui/merchantServiceWindow.js': 2,
  'src/ui/mouseControlsWindow.js': 18,
  'src/ui/nativeInventory.js': 3,
  'src/ui/nativeTrade.js': 2,
  'src/ui/pauseWindow.js': 1,
  'src/ui/potionMakerWindow.js': 4,
  'src/ui/prisonScreen.js': 1,
  'src/ui/profileWindow.js': 19,
  'src/ui/questJournal.js': 19,   // GUIDE2 (main): locationInRegionProvince lives in questLens.js now
  'src/ui/questLens.js': 1,
  'src/ui/questRail.js': 1,   // GUIDE3 (main): the journal's date header read off the language's dateFormatString
  'src/ui/saveWindow.js': 18,
  'src/ui/settingsCopy.js': 6,
  'src/ui/settingsLaw.js': 15,
  'src/ui/spellIconPickerWindow.js': 1,
  'src/ui/spellIcons.js': 10,
  'src/ui/spellMakerWindow.js': 18,
  'src/ui/spellbookWindow.js': 7,
  'src/ui/transportWindow.js': 1,
  'src/ui/travelMapWindow.js': 2,
  'src/ui/useMagicItemWindow.js': 1,
  'src/world/actionSystem.js': 5,
  'src/world/buildingNames.js': 30,
};

test('L10N3d sites: every routed word names one of DFU\'s keys in its collection and holds DFU\'s English byte for byte - or is named, with its reason', () => {
  assert.ok(WORDS.length > 0);
  for (const w of WORDS) {
    const where = `${w.file}:${w.line} ${w.key}`;
    assert.ok(w.collection, `${where}: its collection is TextCollections.<name>`);
    const table = DFU.get(w.collection);
    assert.ok(table, `${where}: ${w.collection} is vendored`);
    assert.ok(table.has(w.key), `${where}: no ${tm.DEFAULT_COLLECTION_NAMES[w.collection]} key`);
    assert.ok(w.en !== undefined, `${where}: the English is a literal`);
    const own = OWN_ENGLISH.get(`${w.file}|${w.key}`);
    assert.equal(w.en, own ? own[0] : table.get(w.key), `${where}: not DFU's English`);
  }
  for (const [k] of OWN_ENGLISH) assert.ok(WORDS.some((w) => `${w.file}|${w.key}` === k), `${k} is still routed`);
});

test('L10N3d sites: a single word is read where it is shown - never once, at module load, where it would stay English whatever the language', () => {
  const loose = WORDS.filter((w) => w.loose).map((w) => `${w.file}:${w.line} ${w.key}`);
  assert.deepEqual(loose, []);
});

test('L10N3d sites: the routed words, file by file - none lost, every new one counted', () => {
  const counts = {};
  for (const w of WORDS) counts[w.file] = (counts[w.file] ?? 0) + 1;
  assert.deepEqual(counts, ROUTED);
});

test('L10N3d localizedTable: the port\'s own names over DFU\'s keys, English as the fallback, frozen and enumerable; formatText: {n} and {n:00}, a missing argument left standing', () => {
  const T = tm.localizedTable({ Training: ['serviceTraining', 'Training'], Quests: ['serviceQuests', 'Get Quest'] });
  assert.deepEqual({ ...T }, { Training: 'Training', Quests: 'Get Quest' });
  assert.ok(Object.isFrozen(T));
  tm.patchLocaleTable('fr', 'Internal_Strings', [['serviceTraining', 'Entraînement'], ['Training', 'faux']]);
  tm.setLocale('fr');
  assert.equal(T.Training, 'Entraînement', 'read by its DFU key, not its own name');
  assert.equal(T.Quests, 'Get Quest');
  const S = tm.localizedTable({ fire: ['12', 'Fireball'] }, tm.TextCollections.TextSpells);
  tm.patchLocaleTable('fr', 'Internal_Spells', [['12', 'Boule de feu']]);
  assert.equal(S.fire, 'Boule de feu');
  assert.equal(tm.formatText('{0} gold, {1} left', 12, 'none'), '12 gold, none left');
  assert.equal(tm.formatText('{1} {0}', 'a', 'b'), 'b a', 'the order is the pattern\'s');
  assert.equal(tm.formatText('{0:00}:{1:00}', 7, 5), '07:05');
  assert.equal(tm.formatText('{0:00}', -3), '-03');
  assert.equal(tm.formatText('{0:000}', 1234), '1234');
  assert.equal(tm.formatText('{0} and {2}', 'x'), 'x and {2}', 'a slip left standing, not thrown');
  assert.equal(tm.formatText('{0}', null), '', 'null prints nothing, as string.Format prints it');
});

test('L10N3d the scan itself: the core\'s routers under any local name, a lookup of the same name from elsewhere not counted, a word read at load marked, a table\'s rows by their DFU keys, the collection named, an English held by the module\'s own const (a let is no literal)', () => {
  const root = mkdtempSync(join(tmpdir(), 'l10nrouted-'));
  try {
    mkdirSync(join(root, 'src/ui'), { recursive: true });
    writeFileSync(join(root, 'src/ui/a.js'), [
      "import { localizedText as lt, localizedTable, TextCollections } from '../systems/textManager.js';",
      "import { localizedText } from './elsewhere.js';",
      "export const LOAD = lt('saveGame', 'Save Game');",
      "export const label = () => lt('loadGame', 'Load Game') + localizedText('quit', 'Quit');",
      "export const S = localizedTable({ Training: ['serviceTraining', 'Training'] }, TextCollections.TextSpells);",
      "export const hook = (localizedStrings) => localizedStrings({ x: 'y' });",
      "export const AVOID = 'By the mercy of Stendarr, you survive certain death!';",
      "let later = 'x';",
      "export const said = () => [lt('avoidDeath', AVOID), lt('quit', later)];",
    ].join('\n'));
    const words = routedWords(root);
    assert.deepEqual(words.map((w) => [w.file, w.line, w.via, w.key, w.en, w.collection, w.loose]), [
      ['src/ui/a.js', 3, 'localizedText', 'saveGame', 'Save Game', 'Internal', true],
      ['src/ui/a.js', 4, 'localizedText', 'loadGame', 'Load Game', 'Internal', false],
      ['src/ui/a.js', 5, 'localizedTable', 'serviceTraining', 'Training', 'TextSpells', false],
      ['src/ui/a.js', 9, 'localizedText', 'avoidDeath', 'By the mercy of Stendarr, you survive certain death!', 'Internal', false],
      ['src/ui/a.js', 9, 'localizedText', 'quit', undefined, 'Internal', false],
    ]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
