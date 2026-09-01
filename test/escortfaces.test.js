// FE1 - THE HUD ESCORTING FACES (2026-08-28). AddFace/DropFace have
// carried machine hooks since Q4 into a world ctx that mounted
// nothing, so every escort quest ran faceless. The panel is
// HUDEscortingNPCFaces.cs verbatim (one module-level panel - DFU has
// one HUD), the quest-end sweep rides a NEW machine seam
// (onQuestEnded, QuestMachine.cs:1047's raise), and the faces array
// rides the save envelope as SaveData_v1.escortingFaces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createFaceDetailsPerson, createFaceDetailsFoe, resolveFaceImage, layoutEscortFaces,
  initEscortFaces, addEscortFace, dropEscortFace, clearEscortFaces, escortQuestEnded,
  getEscortFacesSaveData, restoreEscortFacesSaveData, _escortFaces,
  ESCORT_MAX_FACES, CHILDREN_FACTION_ID,
} from '../src/ui/hudEscortFaces.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { GENDERS } from '../src/characters/nameHelper.js';
import { RACES, raceArt } from '../src/systems/races.js';

const read = (p) => readFileSync(p, 'utf8');

// deps that never resolve art - the pure laws don't need pixels
const deps = (getFactionData = null) => ({
  fetchBytes: () => new Promise(() => {}), palette: null, renderer: null, getFactionData,
});

const person = (over = {}) => ({
  parentQuest: { uid: 42 }, symbol: { original: '_guenevere_' },
  race: RACES.Breton, gender: GENDERS.Female, factionData: { id: 0 },
  faceIndex: 5, isIndividualNPC: false, ...over,
});
const foe = (over = {}) => ({
  isFoe: true, parentQuest: { uid: 42 }, symbol: { original: '_badguy_' },
  gender: GENDERS.Male, ...over,
});

// ── CreateFaceDetails, verbatim (:139-184) ───────────────────────

test('FE1 person: the struct, field for field - and factionFaceIndex only for Individuals', () => {
  const f = createFaceDetailsPerson(person());
  assert.deepEqual(f, {
    questUID: 42, targetPerson: '_guenevere_', targetFoe: null,
    targetRace: RACES.Breton, gender: GENDERS.Female, isChild: false,
    faceIndex: 5, factionFaceIndex: -1,
  });
  // an Individual reads FACTION.TXT's own `face` field (:151-158)
  const fd = createFaceDetailsPerson(person({ isIndividualNPC: true, factionData: { id: 100 } }),
    { getFactionData: (id) => (id === 100 ? { face: 33 } : null) });
  assert.equal(fd.factionFaceIndex, 33);
  // a non-Individual NEVER looks the faction up
  const calls = [];
  createFaceDetailsPerson(person(), { getFactionData: (id) => { calls.push(id); return { face: 9 }; } });
  assert.deepEqual(calls, [], ':151 - the read is inside the IsIndividualNPC arm');
});

test('FE1 person: the child variant - offset 0 or 2 plus the gender (:160-166)', () => {
  const child = (gender, roll) =>
    createFaceDetailsPerson(person({ gender, factionData: { id: CHILDREN_FACTION_ID } }), { roll: () => roll });
  assert.equal(child(GENDERS.Male, 0.1).faceIndex, 0, 'Range(0,2)==0 -> offset 0, male');
  assert.equal(child(GENDERS.Female, 0.1).faceIndex, 1, 'offset 0, female');
  assert.equal(child(GENDERS.Male, 0.9).faceIndex, 2, 'the other variant, male');
  assert.equal(child(GENDERS.Female, 0.9).faceIndex, 3, '"indexed 0-3" - the C# comment');
  assert.equal(child(GENDERS.Male, 0.1).isChild, true);
});

test('FE1 foe: "Always creates a Breton face for now" (:171-184)', () => {
  const f = createFaceDetailsFoe(foe(), () => 0.79);
  assert.deepEqual(f, {
    questUID: 42, targetPerson: null, targetFoe: '_badguy_',
    targetRace: RACES.Breton, gender: GENDERS.Male, isChild: false,
    faceIndex: 7, factionFaceIndex: -1,   // Range(0, faceCount=10) at 0.79
  });
});

// ── the RefreshFaces resolution law (:209-262) ───────────────────

test('FE1 resolve: the factionFaceIndex bands - 0..60 FACES.CIF, 61..502 the mod set, else generic', () => {
  const base = { targetRace: RACES.Breton, gender: GENDERS.Male, isChild: false, faceIndex: 4 };
  assert.deepEqual(resolveFaceImage({ ...base, factionFaceIndex: 0 }),
    { file: 'FACES.CIF', record: 0, special: true });
  assert.deepEqual(resolveFaceImage({ ...base, factionFaceIndex: 60 }),
    { file: 'FACES.CIF', record: 60, special: true });
  assert.deepEqual(resolveFaceImage({ ...base, factionFaceIndex: 61 }),
    { file: 'TFAC00I0.RCI', record: 61, special: true });
  assert.deepEqual(resolveFaceImage({ ...base, factionFaceIndex: 502 }),
    { file: 'TFAC00I0.RCI', record: 502, special: true });
  assert.equal(resolveFaceImage({ ...base, factionFaceIndex: 503 }).special, false,
    '503 falls off BOTH bands into the generic arm');
});

test('FE1 resolve: the generic arm - race switch (Redguard or Breton), gender heads, child file', () => {
  const base = { factionFaceIndex: -1, isChild: false, faceIndex: 4 };
  assert.deepEqual(resolveFaceImage({ ...base, targetRace: RACES.Redguard, gender: GENDERS.Male }),
    { file: raceArt('Redguard', 'male').heads, record: 4, special: false });
  assert.deepEqual(resolveFaceImage({ ...base, targetRace: RACES.Breton, gender: GENDERS.Female }),
    { file: raceArt('Breton', 'female').heads, record: 4, special: false });
  // "Only Redguard and Breton supported for now" (:207) - a Nord
  // face defaults to the Breton heads, the C# switch's own default
  assert.equal(resolveFaceImage({ ...base, targetRace: RACES.Nord, gender: GENDERS.Male }).file,
    raceArt('Breton', 'male').heads);
  // a child reads KIDS00I0.CIF whatever the race (:253-256)
  assert.deepEqual(resolveFaceImage({ ...base, isChild: true, targetRace: RACES.Redguard, gender: GENDERS.Female, faceIndex: 3 }),
    { file: 'KIDS00I0.CIF', record: 3, special: false });
});

test('FE1 layout: startY 36, spaceY 40 or 50 when taller, maxFaces 3 disables the rest (:56-87)', () => {
  const placed = layoutEscortFaces([{ w: 48, h: 48 }, { w: 32, h: 40 }, null, { w: 32, h: 40 }]);
  assert.deepEqual(placed, [
    { x: 8, y: 36, enabled: true },
    { x: 8, y: 86, enabled: true },    // the 48-tall special advanced 50
    { x: 8, y: 126, enabled: true },   // 40-tall (and unloaded) advance 40; 40 < 40 is FALSE
    { x: 0, y: 0, enabled: false },    // faceCount++ >= maxFaces
  ]);
  assert.equal(ESCORT_MAX_FACES, 3);
});

// ── the panel's live state ───────────────────────────────────────

test('FE1 panel: add dispatches the overload, drop matches quest AND symbol, quest-end sweeps', () => {
  initEscortFaces(deps((id) => (id === 100 ? { face: 12 } : null)));
  addEscortFace(person());
  addEscortFace(foe());
  addEscortFace(person({ parentQuest: { uid: 43 }, symbol: { original: '_other_' } }));
  assert.equal(_escortFaces().length, 3);
  assert.equal(_escortFaces()[1].targetFoe, '_badguy_', 'the isFoe marker picked the Foe arm');

  // DropFace(Person) (:119-123): quest UID AND targetPerson both match
  dropEscortFace(person({ symbol: { original: '_nobody_' } }));
  assert.equal(_escortFaces().length, 3, 'same quest, wrong symbol - nothing drops');
  dropEscortFace(person());
  assert.deepEqual(_escortFaces().map((f) => f.targetFoe ?? f.targetPerson), ['_badguy_', '_other_']);
  // the Foe overload matches targetFoe, not targetPerson
  dropEscortFace(foe());
  assert.deepEqual(_escortFaces().map((f) => f.targetPerson), ['_other_']);

  // "Unlike Daggerfall will try to remove face when related quest
  // ends, even if quest script forgets to drop face" (:295-304)
  addEscortFace(person({ parentQuest: { uid: 43 }, symbol: { original: '_second_' } }));
  escortQuestEnded({ uid: 43 });
  assert.equal(_escortFaces().length, 0, 'EVERY face of the ended quest goes');
  clearEscortFaces();
});

test('FE1 save: GetSaveData round-trips; the null arm CLEARS (SaveLoadManager.cs:1071-1079)', () => {
  initEscortFaces(deps());
  addEscortFace(person());
  const saved = getEscortFacesSaveData();
  assert.equal(saved.length, 1);
  assert.equal(JSON.parse(JSON.stringify(saved))[0].targetPerson, '_guenevere_',
    'FaceDetails is plain JSON - symbols travel as their original strings');
  clearEscortFaces();
  restoreEscortFacesSaveData(saved);
  assert.deepEqual(_escortFaces(), saved);
  restoreEscortFacesSaveData(null);
  assert.equal(_escortFaces().length, 0, 'a save without the block clears the panel');
});

// ── the machine's new seam ───────────────────────────────────────

test('FE1 machine: tombstoneQuest raises onQuestEnded LAST (QuestMachine.cs:1042-1048)', () => {
  const ended = [];
  const m = new QuestMachine({
    nowSeconds: () => 0,
    onQuestEnded: (q) => ended.push({ uid: q.uid, tombstoned: q.questTombstoned }),
  });
  const q = {
    uid: 7, resources: new Map(), tasks: new Map(), questTombstoned: false,
    tombstone() { this.questTombstoned = true; },
  };
  m.siteLinks = [{ questUID: 7 }, { questUID: 8 }];
  m.tombstoneQuest(q);
  assert.deepEqual(ended, [{ uid: 7, tombstoned: true }],
    'raised after the tombstone - C#\'s own order (Dispose, Tombstone, scrub, raise)');
  assert.deepEqual(m.siteLinks, [{ questUID: 8 }], 'and after the SiteLink scrub');
});

// ── the mounts, source-pinned ────────────────────────────────────

test('FE1 world: the ctx mounts, the session init, the faction-face read', () => {
  const world = read('src/scenes/world.js');
  // AUDIT 39 F96 moved this pin: OnQuestEnded stopped being the HUD's
  // private event. GuildManager registers on it from its own ctor
  // (GuildManager.cs:45-47) and that listener is the ONLY door into the
  // Thieves Guild and the Dark Brotherhood, so the ctx arm now runs the
  // join first and the escort sweep after. The three doors still stand
  // together; the third is a block.
  assert.match(world, /addFace: \(r\) => addEscortFace\(r\),\s*\n\s*dropFace: \(r\) => dropEscortFace\(r\),\s*\n\s*onQuestEnded: \(q\) => \{/,
    'the three ctx doors stand together');
  assert.match(world, /guildInitiationQuestEnded\([\s\S]{0,220}?\);\n\s*escortQuestEnded\(q\);/,
    'the sweep still runs on every quest end, whatever the guild arm made of it');
  assert.match(world, /initEscortFaces\(\{\s*\n\s*fetchBytes, palette, renderer,\s*\n\s*getFactionData: \(id\) => _questStore\(\)\?\.dict\.get\(id\) \?\? null,/,
    'the session mount, with the persistent-store faction read');
});

test('FE1 hud: drawn on EVERY branch - the large-HUD force-off never names the faces', () => {
  const hud = read('src/ui/hud.js');
  // AUDIT 39 F133 MOVED THIS PIN from 2 to 3: the ENHANCED skin is the
  // shipping default and returned before either call, so the escort
  // column never drew for a default player. DaggerfallHUD adds the
  // panel unconditionally (:183-185) and the force-off block
  // (:214-220) names vitals, compass and mode icon only - so all three
  // branches draw it.
  assert.equal((hud.match(/drawEscortFaces\(renderer, canvas\);/g) ?? []).length, 3,
    'DaggerfallHUD.cs:214-220 turns off vitals/compass/mode icon only');
  const enhanced = hud.indexOf('if (isEnhanced() && typeof document');
  const ret = hud.indexOf('return;', enhanced);
  assert.ok(hud.lastIndexOf('drawEscortFaces(renderer, canvas);', ret) > enhanced,
    'the enhanced branch draws the column before it returns');
});

test('FE1 save: the envelope carries escortingFaces beside quest/talk/travelMap', () => {
  const save = read('src/systems/save.js');
  assert.match(save, /escortingFaces: getEscortFacesSaveData\(\),/, 'SaveLoadManager.cs:869');
  assert.match(save, /restoreEscortFacesSaveData\(extras\?\.escortingFaces \?\? null\);/,
    'the restore arm, null clearing');
  const bridge = read('src/scenes/questBridge.js');
  assert.match(bridge, /onQuestEnded: \(q\) => ctx\.onQuestEnded\?\.\(q\),/, 'the bridge passthrough');
});
