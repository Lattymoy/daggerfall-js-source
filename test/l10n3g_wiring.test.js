// L10N3g (2026-09-28): THE GRAMMAR WHERE DFU RUNS IT. "DFU en français" writes its text with grammar tokens -
// {.le}{.FS}..., {IsPlural?..#..}, {masc/fem} - and DFU runs GrammarManager.grammarProcessor.ProcessGrammar at a fixed
// set of display sites: the HUD's popup text, every message box label, each tooltip row as drawn, the exterior
// automap's plates, the history window, the character sheet's race, chargen's class list and questions, the court's
// days and the talk window's name, greeting, topics, player-says line and question/answer pair. The port's processor
// (processGrammar; the French rules, systems/grammar/frenchGrammar.js) is called at each. Pinned through the port's own
// windows and functions, over made-up French (no pack's text is committed): a row carrying tokens is drawn resolved,
// English reads byte for byte as before (with no language chosen, and with English chosen again), and the hero's gender
// reaches the grammar from chargen's pick (CreateCharGenderSelect.cs:63/:70) and from the LIVE player entity at every
// start of a game (StartGameBehaviour.cs:147). The sites are read off the source by tools/l10nRouted.mjs's
// grammarSites: file by file (GRAMMAR - a site that goes back to the bare text is one a French player reads raw), none
// made once at module load, and the scan itself over a fixture.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as tm from '../src/systems/textManager.js';
import { _resetFrenchGrammarForTests } from '../src/systems/grammar/frenchGrammar.js';
import { grammarSites } from '../tools/l10nRouted.mjs';
import { ATLAS_COLS, ATLAS_ROWS, measureText } from '../src/ui/text.js';
import { FNT_ASCII_START } from '../src/formats/fntFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { TextRsc, RSC } from '../src/formats/textRsc.js';
import { HudText } from '../src/ui/hudText.js';
import { presentNpcInfoText } from '../src/player/activate.js';
import { layoutMessageBox, _setMessageBoxArtForTests } from '../src/ui/messageBox.js';
import { ActionTextBox } from '../src/ui/actionText.js';
import { ToolTip } from '../src/ui/toolTip.js';
import { exteriorAutomapTooltipFor } from '../src/ui/automapText.js';
import { ExteriorAutomapWindow, stampResidenceQuestNames, _resetZoomForTests } from '../src/ui/exteriorAutomapWindow.js';
import { buildingSummaries } from '../src/world/buildingSummaries.js';
import { discoverBuilding, discoveredBuildings, restoreDiscovery } from '../src/systems/discovery.js';
import { PlayerHistoryWindow } from '../src/ui/playerHistory.js';
import { daysUntilFreedomText, PrisonScreenWindow } from '../src/ui/prisonScreen.js';
import { CharSheet, preloadCharSheetArt } from '../src/ui/charsheet.js';
import { sheetModel } from '../src/ui/enhancedCharSheet.js';
import { GUILDS } from '../src/systems/guilds.js';
import { SKILLS, SKILL_NAMES, SKILL_COUNT } from '../src/systems/skills.js';
import { ChargenFlow, handHeroGenderToGrammar } from '../src/ui/chargen.js';
import { finishChargen, handHeroGenderToGrammar as sessionHeroGender } from '../src/systems/chargenSession.js';
import { CLASS_CAREERS } from '../src/systems/chargen.js';
import { parseQuestionLibrary } from '../src/systems/classQuestions.js';
import { playerEntity } from '../src/characters/playerEntity.js';
import { NativeTalkWindow, preloadTalkArt } from '../src/ui/nativeTalk.js';
import { talkPanelModel } from '../src/ui/enhancedTalk.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
beforeEach(() => { tm._resetTextManagerForTests(); _resetFrenchGrammarForTests(); });
const SITES = grammarSites();

/** The grammar's sites, file by file. A new site raises its file's count here; a lost one fails. */
const GRAMMAR = {
  'src/systems/quest/questMacros.js': 1,
  'src/ui/chargen.js': 2,
  'src/ui/charsheet.js': 1,
  'src/ui/enhancedCharSheet.js': 1,
  'src/ui/exteriorAutomapWindow.js': 2,
  'src/ui/hudText.js': 1,
  'src/ui/messageBox.js': 3,
  'src/ui/nativeTalk.js': 6,
  'src/ui/playerHistory.js': 1,
  'src/ui/prisonScreen.js': 1,
  'src/ui/toolTip.js': 1,
};

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

const CANVAS = { width: 320, height: 200 };   // one native pixel a pixel: every drawn position is a native one
const M = { s: 1, ox: 0, oy: 0 };
/** A font of 4px glyphs; the space DrawText lays advances FixedWidth - 1 = 3 (DaggerfallFont.cs:328, :623-627). */
const FONT = { tex: 'font', fnt: { fixedHeight: 6, fixedWidth: 4, glyphWidth: () => 4 } };
/** A renderer that reads every painted string back. drawText hands a string to drawScreenQuadRun as one run of glyph
 *  cells, and a cell's place in the atlas names its character (glyphSrc's inverse); a pen that jumped further than a
 *  glyph's advance crossed spaces. `at(x, y)` is the string whose first glyph stands there; `rects` the flat fills. */
function painter() {
  const drawn = [];
  const rects = [];
  return {
    drawn, rects,
    get strings() { return drawn.map((d) => d.text); },
    at(x, y) { return drawn.find((d) => (x == null || d.x === x) && d.y === y)?.text ?? null; },
    uploadTexture: () => 'tex', releaseTexture() {}, createTexture: () => ({}),
    setScreenScissor() {}, clearScreenScissor() {}, screenScissor(_rect, body) { return body(); },
    endUiRun() {},   // PERF-2D (main): the talk window closes the frame's 2D run as its draw's last call
    drawScreenQuad(tex, dst) { if (tex == null) rects.push(dst); },
    drawScreenQuadRun(_tex, run) {
      let text = '';
      let pen = null;
      for (const { dst, src } of run) {
        const s = dst.w / 4;
        if (pen != null) text += ' '.repeat(Math.max(0, Math.round((dst.x - pen) / (3 * s))));
        text += String.fromCharCode(Math.round(src.v0 * ATLAS_ROWS) * ATLAS_COLS + Math.round(src.u0 * ATLAS_COLS) + FNT_ASCII_START);
        pen = dst.x + 5 * s;
      }
      drawn.push({ text, x: run[0].dst.x, y: run[0].dst.y });
    },
  };
}
const uniq = (a) => [...new Set(a)];

/** A TEXT.RSC of `records` ({ id: byte[] }), each ended by EndOfRecord - read with no carried table, the file alone. */
function rscFile(records) {
  const ids = Object.keys(records).map(Number);
  const bodies = ids.map((id) => [...records[id], RSC.EndOfRecord]);
  const bytes = new Uint8Array(2 + ids.length * 6 + bodies.reduce((n, b) => n + b.length, 0));
  const v = new DataView(bytes.buffer);
  v.setUint16(0, 6 * (ids.length + 1), true);
  let at = 2 + ids.length * 6;
  ids.forEach((id, i) => {
    v.setUint16(2 + i * 6, id, true);
    v.setUint32(4 + i * 6, at, true);
    bytes.set(bodies[i], at);
    at += bodies[i].length;
  });
  return new TextRsc().load(bytes, { table: null });
}
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

/** A 320x200 IMG of index 0, headerless with its trailing palette: what the art-gated windows need to draw at all. */
const ART = { renderer: { uploadTexture: () => 'tex', createTexture: () => ({}) }, fetchBytes: async () => new Uint8Array(64768), palette: new DFPalette() };

const sheetEntity = (over = {}) => ({
  name: 'Rhodri', race: 'Breton', gender: 'female', level: 1, health: 30, maxHealth: 30, magicka: 0, maxMagicka: 0,
  stats: {}, spells: [], activeEffects: [], items: [],
  skills: Object.fromEntries(SKILL_NAMES.map((_, id) => [id, 20 + id])),
  startingLevelUpSkillSum: 100, currentLevelUpSkillSum: 109,
  career: { name: 'Warrior', primarySkills: [SKILLS.HandToHand, SKILLS.Axe, SKILLS.CriticalStrike], majorSkills: [SKILLS.BluntWeapon, SKILLS.Archery, SKILLS.Climbing],
    minorSkills: [SKILLS.Swimming, SKILLS.Running, SKILLS.Jumping, SKILLS.Medical, SKILLS.Dodging, SKILLS.Backstabbing] },
  ...over,
});

// ─── the pin ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('L10N3g wiring: the grammar\'s sites, file by file - none lost, every new one counted - and not one made once at module load, where it would process whatever language and gender stood then', () => {
  const counts = {};
  for (const s of SITES) counts[s.file] = (counts[s.file] ?? 0) + 1;
  assert.deepEqual(counts, GRAMMAR);
  assert.deepEqual(SITES.filter((s) => s.loose).map((s) => `${s.file}:${s.line}`), []);
});

test('L10N3g wiring the scan itself: the core\'s processGrammar under any local name, a same-named function from elsewhere not counted, a call at load marked', () => {
  const root = mkdtempSync(join(tmpdir(), 'l10ngrammar-'));
  try {
    mkdirSync(join(root, 'src/ui'), { recursive: true });
    writeFileSync(join(root, 'src/ui/a.js'), [
      "import { processGrammar as pg, localizedText } from '../systems/textManager.js';",
      "import { processGrammar } from './elsewhere.js';",
      "export const FIRST = pg(localizedText('k', 'x'));",
      "export const shown = (t) => [pg(t), processGrammar(t)];",
    ].join('\n'));
    writeFileSync(join(root, 'src/ui/b.js'), "export const none = (t) => t.processGrammar;\n");
    assert.deepEqual(grammarSites(root).map((s) => [s.file, s.line, s.loose]), [
      ['src/ui/a.js', 3, true],
      ['src/ui/a.js', 4, false],
    ]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ─── the HUD, the message box, the tooltip ───────────────────────────────────────────────────────────────────────

test('L10N3g PopupText.AddText (PopupText.cs:117-118): a HUD line - the you-see line, a residence\'s name as activation says it (PlayerActivate.cs:472) - is queued, drawn and filed in the notebook resolved, and the repeat test reads the resolved line', () => {
  const residence = () => tm.localizedText('theNamedResidence', 'The %s Residence').replaceAll('%s', 'Dunmore');
  const show = () => {
    const hud = new HudText('l10n3g');
    const filed = [];
    hud.onMessage = (t) => filed.push(t);
    hud.add(presentNpcInfoText('Rhodri'));
    hud.add(presentNpcInfoText('Rhodri'));   // NOTICE-SPAM: the same line again refreshes the row it already has
    hud.add(residence());
    const p = painter();
    hud.draw(p, CANVAS, FONT);
    return { rows: hud.frame().rows, filed, drawn: p.strings };
  };
  const { en, fr } = inFrench({ Internal_Strings: [['youSee', 'Vous voyez {.un}{.MS}garde, %s.'], ['theNamedResidence', '{.FS}Maison %s']] }, show);
  const EN = ['You see Rhodri.', 'The Dunmore Residence'];
  assert.deepEqual(en, { rows: EN, filed: EN, drawn: EN });
  const FR = ['Vous voyez un garde, Rhodri.', 'Maison Dunmore'];
  assert.deepEqual(fr, { rows: FR, filed: FR, drawn: FR }, 'the row, the notebook\'s message ring (:123 AddMessage(pgText)) and the paint');
});

test('L10N3g MultiFormatTextLabel.AddTextLabel (:230): a message box\'s labels - a TEXT.RSC record\'s rows, a plain row, a tab-stopped table\'s cells - are measured, drawn and handed to the enhanced dialog resolved', () => {
  _setMessageBoxArtForTests({ slices: Array(9).fill('slice'), buttons: new Map() });
  try {
    const rsc = rscFile({ 7400: [...ascii('The blade breaks.'), RSC.JustifyCenter, ...ascii('Find another.'), RSC.JustifyLeft] });
    const guild = GUILDS.FightersGuild;
    const member = sheetEntity({
      guildMemberships: { [guild.guildGroup]: { guild: guild.name, rank: 2, lastRankChange: 0 } },
      factionRep: { dict: new Map([[guild.factionId, { name: 'The Fighters Guild', rep: 37 }]]) },
    });
    const show = () => {
      const record = new ActionTextBox(rsc.linesById(7400));   // the port's DaggerfallMessageBox, ClickAnywhereToClose
      const p1 = painter();
      record.draw(p1, CANVAS, FONT, 1);
      const levelling = new CharSheet(sheetEntity(), {});   // the bonus-points refusal: a plain row
      levelling.leveling = true;
      levelling.pool = 3;
      levelling._checkIfDoneLeveling();
      const p2 = painter();
      levelling.draw(p2, CANVAS, FONT, 1);
      const sheet = new CharSheet(member, {});   // ShowAffiliationsDialog: each cell its own label
      sheet._showAffiliations();
      const p3 = painter();
      sheet.draw(p3, CANVAS, FONT, 1);
      const box = layoutMessageBox(FONT, rsc.linesById(7400));   // what drawEnhancedDialog reads
      // an input box's typed field is DFU's TextBox, no label: what the player typed stands, braces and all
      const typed = layoutMessageBox(FONT, [{ text: 'Note > {.Le}{.FS}lame_', center: false, field: true }]).rows[0].text;
      return {
        record: uniq(p1.strings), refusal: uniq(p2.strings), table: uniq(p3.strings), typed,
        dialog: box.rows.map((r) => r.text), measured: box.textW === Math.max(...box.rows.map((r) => measureText(FONT.fnt, r.text))),
      };
    };
    const { en, fr } = inFrench({
      Internal_RSC: [['7400', '{.Le}{.FS}lame se brise.[/center]Trouvez-en {.un}{.FS}autre.[/left]']],
      Internal_Strings: [
        ['mustDistributeBonusPoints', 'Repartissez {.le}{.MP}points.'], ['affiliation', '{.Le}{.FS}guilde'], ['rank', 'Rang'],
        ['affiliationFormatString', '{0} ({.le}{.FS}rep. {1})'],
      ],
    }, show);
    assert.deepEqual(en, {
      record: ['The blade breaks.', 'Find another.'], refusal: ['You must distribute all bonus points.'],
      table: ['Affiliation', 'Rank', 'The Fighters Guild', 'Swordsman (rep:37)'], typed: 'Note > {.Le}{.FS}lame_',
      dialog: ['The blade breaks.', 'Find another.'], measured: true,
    });
    assert.deepEqual(fr, {
      record: ['La lame se brise.', 'Trouvez-en une autre.'], refusal: ['Repartissez les points.'],
      table: ['La guilde', 'Rang', 'The Fighters Guild', 'Swordsman (la rep. 37)'], typed: 'Note > {.Le}{.FS}lame_',
      dialog: ['La lame se brise.', 'Trouvez-en une autre.'], measured: true,
    }, 'each label through the grammar before it is measured (the box is sized on the words it shows); a field row is no label');
  } finally { _setMessageBoxArtForTests(null); }
});

test('L10N3g ToolTip.Draw (:215): each row is drawn through the grammar as it is drawn, while the box is sized off the rows as they stand - UpdateTextRows measures them (:257-264) before Draw runs the grammar, DFU\'s own order', () => {
  const show = () => {
    const text = exteriorAutomapTooltipFor('forward');   // UpdateButtonToolTipsText's row, String.Format'd
    const tip = new ToolTip(0);
    tip.show(text, 20, 20);
    tip.update(0);
    const p = painter();
    tip.draw(p, M, FONT);
    const raw = text.replace(/\\r/g, '\r').split('\r');
    return { drawn: p.strings, width: p.rects[0].w === Math.max(...raw.map((r) => measureText(FONT.fnt, r))) + 4, raw };
  };
  const { en, fr } = inFrench({ Internal_Strings: [['exteriorAutomapToolTipForwardButton', 'clic gauche : {.le}{.MS}nord\\rclic droit : {.le}{.FS}frontiere sud']] }, show);
  assert.deepEqual(en.drawn, en.raw, 'English: every row as it stands');
  assert.equal(en.width, true);
  assert.deepEqual(fr.drawn, ['clic gauche : le nord', 'clic droit : la frontiere sud']);
  assert.equal(fr.width, true, 'the box keeps the width of the rows as they stood');
});

// ─── the plates, the history, the court, the sheet ───────────────────────────────────────────────────────────────

test('L10N3g the exterior automap\'s plates (DaggerfallExteriorAutomapWindow.cs:878, :885): the label is drawn and measured resolved, its tooltip text is resolved, and the canonical name stays the key', () => {
  _resetZoomForTests();
  restoreDiscovery(null);
  try {
    // a block of two - a shop and a house - as the automap's own pins lay them (test/automap_ext.test.js)
    const block = {
      x: 1, y: 0,
      dfBlock: { rmbBlock: {
        fldHeader: {
          numBlockDataRecords: 2,
          buildingDataList: [{ buildingType: 9, nameSeed: 1, factionId: 0, quality: 10 }, { buildingType: 17, nameSeed: 2, factionId: 0, quality: 4 }],
        },
        subRecords: [
          { xPos: 2048, zPos: 1024, yRotation: 0, exterior: { block3dObjectRecords: [] }, interior: {} },
          { xPos: 512, zPos: 3072, yRotation: 0, exterior: { block3dObjectRecords: [] }, interior: {} },
        ],
      } },
    };
    const show = () => {
      restoreDiscovery(null);
      const summaries = buildingSummaries([{ buildingType: 9, nameSeed: 1, factionId: 0, quality: 10 }], [block], {});
      const house = summaries.find((b) => b.isResidence);
      discoverBuilding('r:l10n3g', { buildingKey: house.buildingKey, name: 'House', buildingType: 17 });
      // the quest's own name for the residence it marked (Place.GetBuildingName, quest/place.js)
      const buildingName = tm.localizedText('theNamedResidence', 'The %s Residence').replaceAll('%s', 'Dunmore');
      const quests = {
        getAllActiveQuestIds: () => [1],
        getQuest: () => ({ resources: new Map([['_house_', { isPlace: true, siteDetails: { buildingKey: house.buildingKey, buildingName } }]]) }),
        isBuildingQuestResource: () => ({ isQuestResource: true, locationWasMarkedOnMapByNPC: true }),
      };
      stampResidenceQuestNames(summaries, discoveredBuildings('r:l10n3g'), quests, 5);
      const w = new ExteriorAutomapWindow({
        locationName: 'T', locationId: 'r:l10n3g', gridW: 2, gridH: 2, blocks: [], playerPos: () => [102.4, 0, 102.4], playerYaw: () => 0,
        locOrigin: [0, 0, 0], isCustomLocation: false, arrowMesh: () => null, compassArt: null,
        buildings: () => summaries, directory: () => [], discovered: () => discoveredBuildings('r:l10n3g'),
      });
      const [plate] = w.buildPlates(FONT, M);
      w._hoverPlate = plate;
      w._hoverAt = [40, 40];
      const p = painter();
      w._drawChrome(p, CANVAS, FONT, M, 1);
      return {
        text: plate.text, tip: plate.tip, name: plate.name, w: plate.w === measureText(FONT.fnt, plate.text) * plate.scale, tooltip: p.at(42, 46),
        // the ToolTipText is the processed name (:878), so UpdateTextRows sizes the box off it
        tipBox: p.rects[p.rects.length - 1].w === measureText(FONT.fnt, plate.tip) + 4,
      };
    };
    const { en, fr } = inFrench({ Internal_Strings: [['theNamedResidence', '{.FS}Maison %s']] }, show);
    assert.deepEqual(en, { text: 'The Dunmore Residence', tip: 'The Dunmore Residence', name: 'The Dunmore Residence', w: true, tooltip: 'The Dunmore Residence', tipBox: true });
    assert.deepEqual(fr, { text: 'Maison Dunmore', tip: 'Maison Dunmore', name: '{.FS}Maison Dunmore', w: true, tooltip: 'Maison Dunmore', tipBox: true },
      'the label and the tooltip resolved; the plate\'s name - the rename box\'s fallback - stays the quest\'s own');
  } finally { restoreDiscovery(null); _resetZoomForTests(); }
});

test('L10N3g the history window (DaggerfallPlayerHistoryWindow.cs:152) draws each BackStory line through the grammar; the court\'s days are replaced, then processed (DaggerfallCourtWindow.cs:469, :523)', () => {
  const rsc = rscFile({ 7401: [...ascii('You were born at sea.'), RSC.JustifyLeft, ...ascii('Your father was a sailor.'), RSC.JustifyLeft] });
  const show = () => {
    const hero = sheetEntity({ backStory: rsc.linesById(7401).map((r) => r.text) });   // chargen composes it in the language it ran in
    const p = painter();
    new PlayerHistoryWindow(hero).draw(p, CANVAS, FONT);
    const prison = new PrisonScreenWindow({ daysInPrison: 2 });
    prison.updatePrisonScreen();
    return { history: uniq(p.strings), days: [daysUntilFreedomText(3), prison.label] };
  };
  const { en, fr } = inFrench({
    Internal_RSC: [['7401', 'Vous etes {.un}{.MS}marin.[/left]{.Le}{.MS}pere etait {.un}{.MS}pecheur.[/left]']],
    Internal_Strings: [['daysUntilFreedom', '%d {Number?nuit#nuits} au cachot.']],
  }, show);
  assert.deepEqual(en, { history: ['You were born at sea.', 'Your father was a sailor.'], days: ['3 days until freedom.', '1 days until freedom.'] });
  assert.deepEqual(fr, { history: ['Vous etes un marin.', 'Le pere etait un pecheur.'], days: ['3 nuits au cachot.', '1 nuit au cachot.'] });
});

test('L10N3g the character sheet\'s race (DaggerfallCharacterSheetWindow.cs:398), classic and enhanced, in the hero\'s gender - read live off the entity the start handed the grammar', async () => {
  await preloadCharSheetArt(ART);
  const show = () => {
    const hero = sheetEntity({ gender: 'female' });
    handHeroGenderToGrammar(hero);   // the start of the game (StartGameBehaviour.cs:147)
    const label = () => { const p = painter(); new CharSheet(hero, {}).draw(p, CANVAS, FONT, 1); return p.at(41, 14); };   // raceLabel (41,14)
    const female = { classic: label(), enhanced: sheetModel(hero).race };
    hero.gender = 'male';   // the same entity, a male hero's now (a save loaded into it)
    return { female, male: { classic: label(), enhanced: sheetModel(hero).race } };
  };
  const { en, fr } = inFrench({ Internal_Strings: [['breton', 'Armoric{ain/aine}']] }, show);
  assert.deepEqual(en, { female: { classic: 'Breton', enhanced: 'Breton' }, male: { classic: 'Breton', enhanced: 'Breton' } });
  assert.deepEqual(fr, { female: { classic: 'Armoricaine', enhanced: 'Armoricaine' }, male: { classic: 'Armoricain', enhanced: 'Armoricain' } },
    'the label follows the entity the getter reads, never a copy taken when it was handed over');
});

// ─── the hero's gender: chargen's pick, the start ────────────────────────────────────────────────────────────────

const CAREER = {
  name: 'Warrior', hitPointsPerLevel: 14, advancementMultiplier: 1, abilityFlagsAndSpellPointsBitfield: 0,
  strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.BluntWeapon], majorSkills: [SKILLS.Archery, SKILLS.Climbing, SKILLS.Running],
  minorSkills: [SKILLS.Swimming, SKILLS.Jumping, SKILLS.Medical, SKILLS.Stealth, SKILLS.Backstabbing, SKILLS.Mercantile],
};
const careers = () => CLASS_CAREERS.map((name) => ({ name, career: { ...CAREER, name } }));
/** TEXT.RSC 9000, the forty questions in the classic record's shape - each run opened by '{' - and a translation's
 *  rows keyed apart (9000.1..9000.40), as the flow's library reads them (parseQuestionLibrary). */
const QUESTIONS = rscFile({
  9000: Array.from({ length: 40 }, (_, i) => [...ascii(`{${i + 1}. Are you ready?`), RSC.JustifyLeft, ...ascii(' a) yes'), RSC.JustifyLeft, ...ascii(' b) no'), RSC.JustifyLeft, ...ascii(' c) maybe'), RSC.JustifyLeft]).flat(),
});
const FRENCH_QUESTIONS = Array.from({ length: 40 }, (_, i) => [`9000.${i + 1}`, `${i + 1}. Vous etes pret{/e} ?[/left] a) oui[/left] b) non[/left] c) jamais[/left]`]);

test('L10N3g chargen: the pick hands the grammar the hero\'s gender (CreateCharGenderSelect.cs:63/:70), and what the wizard shows after it speaks it - the class list (CreateCharClassSelect.cs:61) and the questions, each line a label (MultiFormatTextLabel.cs:230)', () => {
  const show = () => ['female', 'male'].map((gender) => {
    const f = new ChargenFlow(careers(), () => 0);
    f.questionLibrary = parseQuestionLibrary(QUESTIONS);
    f.classesData = new Uint8Array(216);
    f.state = 'gender';
    f.applyHit({ setGender: gender });   // the Male/Female button - and the M/F keys, and the enhanced wizard's buttons
    f.input('down');
    f.input('confirm');   // answer questions
    return { state: f.state, cls: f.classRowName(16), question: f.qDisplay.lines };
  });
  const { en, fr } = inFrench({ Internal_Strings: [['Warrior', 'Combattant{/e}']], Internal_RSC: FRENCH_QUESTIONS }, show);
  const Q = [' Are you ready?', ' a) yes', ' b) no', ' c) maybe'];
  assert.deepEqual(en, [{ state: 'classQuestions', cls: 'Warrior', question: Q }, { state: 'classQuestions', cls: 'Warrior', question: Q }]);
  assert.deepEqual(fr, [
    { state: 'classQuestions', cls: 'Combattante', question: [' Vous etes prete ?', ' a) oui', ' b) non', ' c) jamais'] },
    { state: 'classQuestions', cls: 'Combattant', question: [' Vous etes pret ?', ' a) oui', ' b) non', ' c) jamais'] },
  ]);
});

test('L10N3g the start: the new character\'s game (finishChargen) and the world host\'s boot hand the grammar the LIVE hero - GameManager.Instance.PlayerEntity.Gender, read at each ask (StartGameBehaviour.cs:147) - so a save loaded later speaks of the loaded hero', () => {
  tm.setLocale('fr');
  const say = () => tm.processGrammar('{il/elle}');
  const f = new ChargenFlow(careers(), () => 0);
  f.state = 'gender';
  f.applyHit({ setGender: 'female' });
  assert.equal(say(), 'elle', 'the wizard\'s pick');
  const hero = { isPlayer: true, level: 1, health: 50, maxHealth: 50, items: [], sGroupReputations: [0, 0, 0, 0, 0], stats: {} };
  finishChargen(hero, {
    name: 'Pin', gender: 'female', race: 'Breton', raceId: 1, faceIndex: 0, careerIndex: 16, career: { ...CAREER },
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: new Array(SKILL_COUNT).fill(30), reflexes: 2,
  }, null, { rolls: () => 0 });
  assert.equal(say(), 'elle');
  hero.gender = 'male';   // a male hero's save, loaded into the same entity
  assert.equal(say(), 'il', 'the entity itself, not the wizard\'s constant');
  // THE WORLD HOST'S BOOT: every start, a load included - the first thing bootWorld does, before anything awaits
  assert.equal(sessionHeroGender, handHeroGenderToGrammar, 'the hosts hand it through the session\'s door, one law');
  assert.ok(/\nexport async function bootWorld\(canvas, renderer, params, status\) \{ handHeroGenderToGrammar\(playerEntity\);/
    .test(readFileSync(join(ROOT, 'src/scenes/world.js'), 'utf8')), 'bootWorld no longer opens by handing the grammar the live hero');
  const was = playerEntity.gender;
  try {
    sessionHeroGender(playerEntity);
    playerEntity.gender = 'female';
    assert.equal(say(), 'elle');
    playerEntity.gender = 'male';
    assert.equal(say(), 'il');
  } finally { playerEntity.gender = was; }
});

// ─── the talk window ─────────────────────────────────────────────────────────────────────────────────────────────

test('L10N3g the talk window, both faces: the NPC\'s name (DaggerfallTalkWindow.cs:390), the greeting (:642), each topic row (:873), the player-says line (:1248) and the question/answer pair (:1256, :1268) through the grammar - the pair and the greeting stored resolved, as the logbook copies them', async () => {
  await preloadTalkArt(ART);
  const talk = rscFile({ 7410: ascii('Yes?'), 7411: ascii('Where is it?'), 7412: ascii('Down the road.') });
  const line = (id) => talk.plainText(id)[0];
  const show = () => {
    const notes = [];
    const hooks = {
      npcName: tm.getLocalizedFactionName(9999, 'Innkeeper'),
      categories: () => [{ label: '', buildings: [{ label: tm.localizedText('theNamedResidence', 'The %s Residence').replaceAll('%s', 'Dunmore') }] }],
      question: () => line(7411), answer: () => line(7412),
      tone: () => 1, setTone() {}, copyToNotebook: (tokens) => notes.push(...tokens),
    };
    const w = new NativeTalkWindow(line(7410), hooks);
    w.press('whereIs');   // the category list; its one row's empty caption is repaired to resolvingError
    const p1 = painter();
    w.draw(p1, CANVAS, FONT);
    const panel1 = talkPanelModel(w);
    w.useTopic(0);   // descend: the building row, its question in the player-says panel
    const p2 = painter();
    w.draw(p2, CANVAS, FONT);
    const panel2 = talkPanelModel(w);
    w.useTopic(0);   // ask: the pair lands in the conversation
    const p3 = painter();
    w.draw(p3, CANVAS, FONT);
    w.press('logbook', true);   // copy the whole conversation...
    w.press('goodbye');         // ...and file it on the way out
    return {
      name: p1.at(null, 53), panelName: panel1.npcName,   // labelNameNPC, centred in its panel at (117,52), a pixel down
      category: p1.at(6, 71), panelCategory: panel1.topics[0].label,
      says: p2.at(123, 8), panelSays: panel2.question, building: panel2.topics[0].label,
      conversation: w.conversation.map((c) => (typeof c === 'string' ? c : c.text)), panelLog: talkPanelModel(w).entries.map((e) => e.text),
      drawnLog: uniq(p3.drawn.filter((d) => d.x >= 189 && d.y >= 65).map((d) => d.text)),   // listboxConversation's panel (189,65)
      notes: notes.map((n) => n.text),
    };
  };
  const { en, fr } = inFrench({
    Internal_Factions: [['9999', '{.Le}{.MS}aubergiste']],
    Internal_Strings: [['resolvingError', '...{.le}{.MS}vide...'], ['theNamedResidence', '{.FS}Maison %s']],
    Internal_RSC: [['7410', 'Oui, {monsieur/madame} ?'], ['7411', 'Ou est {.le}{.FS}maison ?'], ['7412', '{.Le}{.FS}route {IsPlural?est#sont} longue.']],
  }, show);
  const LOG_EN = ['Yes?', 'Where is it?', 'Down the road.'];
  assert.deepEqual(en, {
    name: 'Innkeeper', panelName: 'Innkeeper', category: '...never mind...', panelCategory: '...never mind...',
    says: 'Where is it?', panelSays: 'Where is it?', building: 'The Dunmore Residence',
    conversation: LOG_EN, panelLog: LOG_EN, drawnLog: LOG_EN, notes: LOG_EN,
  });
  const LOG_FR = ['Oui, monsieur ?', 'Ou est la maison ?', 'La route est longue.'];
  assert.deepEqual(fr, {
    name: 'L\'aubergiste', panelName: 'L\'aubergiste', category: '...le vide...', panelCategory: '...le vide...',
    says: 'Ou est la maison ?', panelSays: 'Ou est la maison ?', building: 'Maison Dunmore',
    conversation: LOG_FR, panelLog: LOG_FR, drawnLog: LOG_FR, notes: LOG_FR,
  });
});
