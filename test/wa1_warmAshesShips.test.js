// WA1 (2026-09-25, Mac: "All mods attached are to be compatible and
// implemented 1:1") - WARM ASHES - SHIPS 1.1 (Kamer).
//
// Held here: the vendored files (the manifest, the assembly and the IL
// the port reads, the quests byte for byte, the six variant patches'
// form); the script, arm by arm off its IL - the voyage's roll and its
// three outcomes, the post-travel coroutine and its clock, the boarding
// and the lent ship taken back, "Leave Ship" in and out of region 31 -
// the save record and DFU's per-mod slot as a registry; the quests under
// the port's own machine (every line a known action, "Leave Ship" run by
// a quest, a save carrying it restored); the host's wiring, pinned where
// DFU raises each event; the switch, the lane, the credit - and, with
// ARENA2_PATH set, the variants rebuilt and served through the door with
// Detailed Ships' building laid over them, as DFU composes the two.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import {
  WARM_ASHES_VENDOR, WA_QUEST_LIST, WA_RAID_QUEST, WA_SHIP_BLOCKS, WA_PEACEFUL_PERCENT, WA_BOARD_DELAY_S, WA_SEA_REGION,
  warmAshesOn, newSaveData, getSaveData, restoreSaveData, isTempShip, hasArmedAmbush, boardPending,
  setWarmAshesHost, resetShipVariants, onPreFastTravel, onPostFastTravel, frame, LeaveShip, installWarmAshesShips, _resetWarmAshesShips,
} from '../src/systems/warmAshesShips.js';
import { registerModSaveData, modSaveRecords, restoreModSaveRecords, newGameModSaveRecords, registeredModSaveVendors, _resetModSaveData } from '../src/systems/modSaveData.js';
import { SHIP_TYPES, resetShip, assignShipToPlayer } from '../src/systems/banking.js';
import { QuestListsManager, registeredQuestLists, _resetQuestLists } from '../src/systems/quest/questLists.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { GUILD_GROUPS } from '../src/formats/factionFile.js';
import { ANY_LOCATION_KEY, clearWorldDataVariants, setBlockVariant, setLastLocationKeyTo, getBlockVariantHere } from '../src/systems/worldDataVariants.js';
import { MOD_SETTINGS, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { ONLINE_ROOM_MOD_KEYS, ONLINE_PLAYERS_OWN_MODS } from '../src/systems/onlineLane.js';
import { CREDITS } from '../src/ui/credits.js';
import { PATCH_FORMAT, rebuildWorldDataPatch } from '../src/formats/worldDataPatch.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { getDFBlockReplacementData, bindWorldDataBlocks, installWorldDataReplacement, _resetWorldDataReplacement } from '../src/formats/worldDataReplacement.js';
import { registerWorldDataPatch } from '../src/scenes/modWorldData.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'vendor/warm-ashes-ships');
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && existsSync(join(ARENA2, 'BLOCKS.BSA'));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const questLines = (name) => readFileSync(join(VENDOR, 'Quests', `${name}.txt`), 'utf8').split(/\r?\n/);
function loadTables() {
  const T = join(ROOT, 'vendor/dfu-quests/Tables');
  loadQuestTables(Object.fromEntries(readdirSync(T).map((f) => [f.replace(/\.txt$/, ''), readFileSync(join(T, f), 'utf8')])));
}

/** A recording host: every seam the mod reaches for, answering as told and logging the calls in order. */
function recordingHost({ roll = 0.9, owns = false, region = WA_SEA_REGION, quest = { name: WA_RAID_QUEST } } = {}) {
  const calls = [];
  const variants = [];
  const h = {
    calls, variants, owned: owns,
    random: () => roll,
    ownsShip: () => h.owned,
    assignShip: (t) => { calls.push(['assign', t]); h.owned = t !== SHIP_TYPES.None; },
    resetShip: () => { calls.push(['reset']); h.owned = false; },
    getQuest: (name, faction) => { calls.push(['getQuest', name, faction]); return quest; },
    startQuest: (q) => calls.push(['start', q.name]),
    setTransportModeShip: () => calls.push(['ship']),
    currentRegionIndex: () => region,
    setBlockVariant: (block, variant, key) => { variants.push([block, variant, key]); calls.push(['variant', block, variant]); },
  };
  return h;
}

// ---- the vendored files -------------------------------------------------------

test('WA1 the manifest, the assembly and its IL: the shipped files, and the lines the port reads off them', () => {
  const m = JSON.parse(read('vendor/warm-ashes-ships/warm-ashes-ships.dfmod.json'));
  assert.equal(m.ModTitle, 'Warm Ashes - Ships');
  assert.equal(m.ModVersion, '1.1');
  assert.equal(m.ModAuthor, 'Kamer');
  assert.equal(m.ContactInfo, 'DFU Discord');
  assert.equal(m.GUID, '5e2ce334-65ae-4ddd-ada6-00c6dd4344fd');
  assert.deepEqual(m.Contributes, { QuestLists: [WA_QUEST_LIST], LooseQuestsList: ['WAQ_SHIP_RAID', 'WAQ_SHIP_ATTACK_PIRATE', 'WAQ_SHIP_BASE', 'WAQ_SHIP_SMALLRAID'] });
  assert.equal(m.Files.length, 13);
  assert.deepEqual(m.Files.filter((f) => /\/WorldData\//.test(f)).map((f) => f.split('/').pop()).sort(),
    ['SHIPAA00.RMB_base.json', 'SHIPAA00.RMB_raid.json', 'SHIPAA00.RMB_smallraid.json', 'SHIPAA01.RMB_base.json', 'SHIPAA01.RMB_raid.json', 'SHIPAA01.RMB_smallraid.json']);
  assert.equal(sha(readFileSync(join(VENDOR, 'Warm Ashes - Ships.dll'))), '047e98d38da113b1e1dd76bfca1dc638d067e6affc3babcace0a12faa729180a');
  const il = read('vendor/warm-ashes-ships/il/Warm_Ashes_Ships.il.txt');
  // the roll, its bound and the two variants' names and key
  assert.match(il, /IL_042d: ldc\.i4\.s\s+100\n\s+IL_042f: call\s+UnityEngine\.Random::Range\n\s+IL_0434: ldc\.i4\.s\s+75\n\s+IL_0436: blt/);
  assert.match(il, /IL_0470: call\s+DaggerfallWorkshop\.Game\.Banking\.DaggerfallBankManager::AssignShipToPlayer/);
  assert.match(il, /IL_046f: ldc\.i4\.1/, 'the LARGE ship is the one lent');
  assert.match(il, /IL_0484: ldstr\s+"_smallraid"\n\s+IL_0489: ldc\.i4\.s\s+-8/);
  // the coroutine's wait and its quest
  assert.match(il, /IL_05ff: ldc\.r4\s+0\.05000000074505806/);
  assert.match(il, /IL_0630: ldstr\s+"WAQ_SHIP_SMALLRAID"/);
  // Leave Ship's region
  assert.match(il, /IL_054f: ldc\.i4\.s\s+31/);
  assert.match(il, /IL_050c: ldstr\s+"Leave Ship"/);
  assert.equal(WA_PEACEFUL_PERCENT, 75);
  assert.equal(WA_BOARD_DELAY_S, 0.05);
  assert.equal(WA_SEA_REGION, 31);
  assert.deepEqual([...WA_SHIP_BLOCKS], ['SHIPAA00.RMB', 'SHIPAA01.RMB']);
});

test('WA1 the quests: the shipped text byte for byte (CRLF as shipped), the list filing both rows under GuildGroups.None', () => {
  const want = {
    'QuestList-WA_Ships': '2ec9eb23ec1e6285ed9f7af8b05ad1c08a4c690f6e6a6542094ff332ee9925fb',
    WAQ_SHIP_ATTACK_PIRATE: '73b6e891c2c45d60aff9785ea80ed0b9f6cc0232e29000dbbe16219048b10563',
    WAQ_SHIP_BASE: '5658e9fab6e82ab85e5a38a569ffb6a98f5c6a2a6795b86230f63326e84a734a',
    WAQ_SHIP_RAID: 'da2956ed38eb4664d1ee57cd9dbc435cf218c144276569f7a8587496c960233d',
    WAQ_SHIP_SMALLRAID: '49b6ef09f8b71907802bb8b9dbea730c57a87cd6a596e38b582af94c5ed86b59',
  };
  assert.deepEqual(readdirSync(join(VENDOR, 'Quests')).sort(), Object.keys(want).map((n) => `${n}.txt`).sort());
  for (const [n, h] of Object.entries(want)) assert.equal(sha(readFileSync(join(VENDOR, 'Quests', `${n}.txt`))), h, n);
  _resetQuestLists(); _resetModSettings();
  assert.equal(installWarmAshesShips(), true);
  assert.equal(installWarmAshesShips(), false, 'once');
  assert.ok(registeredQuestLists().includes(WA_QUEST_LIST));
  const lists = new QuestListsManager({ readListTable: (name) => (name === WA_QUEST_LIST ? readFileSync(join(VENDOR, 'Quests', `QuestList-${name}.txt`), 'utf8') : null) });
  assert.deepEqual(lists.guilds.get(GUILD_GROUPS.None).map((q) => [q.name, q.membership, q.minReq, q.oneTime]),
    [['WAQ_SHIP_SMALLRAID', 'M', 0, false], ['WAQ_SHIP_ATTACK_PIRATE', 'M', 0, false]]);
  setModSetting(WARM_ASHES_VENDOR, 'Enabled', false);
  assert.ok(!registeredQuestLists().includes(WA_QUEST_LIST), 'the list stands behind the switch, as a loaded mod\'s does');
  _resetModSettings(); _resetQuestLists(); _resetWarmAshesShips(); _resetModSaveData();
  // the pack loader globs the mod's folder beside Roleplay & Realism's
  assert.match(read('src/scenes/questData.js'), /import\.meta\.glob\('\.\.\/\.\.\/vendor\/warm-ashes-ships\/Quests\/\*\.txt'/);
});

test('WA1 the six variant patches: the author\'s edit of each ship block, the classic ship subrecords he copied carried as COPY ops', () => {
  const dir = join(VENDOR, 'WorldDataPatches');
  const want = {
    'SHIPAA00.RMB_base.json': [390, '8616ee9e565c75c27299743f7babb9c6df15d061e1adba3ad60a057a93a1e09b', 2],
    'SHIPAA00.RMB_raid.json': [390, 'e2707c4cb2cb25ed1421e08e71dd309bf5c51dc07081489f01a0ad5943a43165', 35],
    'SHIPAA00.RMB_smallraid.json': [390, 'f3dceb72893182111ade67464e19b5aa4f498804a208baf3b562f193be602d8f', 51],
    'SHIPAA01.RMB_base.json': [630, '09ca6c194b444ac7ca1e728e102ae899ce4c84e1096c7f16d38a53083694e29b', 2],
    'SHIPAA01.RMB_raid.json': [630, '79c87df1139bf9cef87f366eabbdb352e9ec00844bacf8f6bca0c7865c58ba58', 49],
    'SHIPAA01.RMB_smallraid.json': [630, '004aebb3d0be21969ee43c966b757327640ea16a32792f1754d081df469d6c33', 50],
  };
  assert.deepEqual(readdirSync(dir).sort(), Object.keys(want).sort());
  for (const [f, [index, hash, n]] of Object.entries(want)) {
    const p = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    assert.equal(p.format, PATCH_FORMAT);
    assert.equal(p.rebuilds, f);
    assert.deepEqual([p.base.kind, p.base.block, p.base.index], ['block', f.slice(0, 12), index], f);
    assert.equal(p.sha256, hash, f);
    assert.equal(p.ops.length, n, f);
  }
  // the pirate vessels are the classic ship's own subrecord, named, never carried
  const copies = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).ops.filter((o) => o[0] === 'ci').map((o) => [o[1].join('.'), o[2].block, o[2].path.join('.')]);
  assert.deepEqual(copies('SHIPAA00.RMB_smallraid.json'), [['RmbBlock.SubRecords.1', 390, 'RmbBlock.SubRecords.0']]);
  assert.deepEqual(copies('SHIPAA01.RMB_smallraid.json'), [['RmbBlock.SubRecords.1', 390, 'RmbBlock.SubRecords.0'], ['RmbBlock.SubRecords.2', 390, 'RmbBlock.SubRecords.0']]);
  assert.deepEqual(copies('SHIPAA01.RMB_raid.json'), [['RmbBlock.SubRecords.1', 630, 'RmbBlock.SubRecords.0']]);
});

// ---- the script -------------------------------------------------------------

test('WA1 OnPreFastTravel: no sea, nothing; three crossings in four, peace; sailing, the ambush armed and the blocks raided; on foot, the blocks at _base', () => {
  _resetWarmAshesShips();
  let h = recordingHost();
  setWarmAshesHost(h);
  assert.equal(onPreFastTravel({ oceanPixels: 0, travelShip: true }), 'no-water');
  assert.deepEqual(h.calls, [], 'no water: not even the roll');
  // Random.Range(0, 100) < 75 - the bound, both sides of it
  h = recordingHost({ roll: 0.74 }); setWarmAshesHost(h);
  assert.equal(onPreFastTravel({ oceanPixels: 3, travelShip: true }), 'peace', '74 < 75');
  assert.deepEqual(h.calls, []);
  h = recordingHost({ roll: 0.75, owns: true }); setWarmAshesHost(h);
  assert.equal(onPreFastTravel({ oceanPixels: 3, travelShip: true }), 'raid', '75 is the first ambush');
  assert.equal(hasArmedAmbush(), true);
  assert.equal(isTempShip(), false, 'an owner is lent nothing');
  assert.deepEqual(h.variants, [['SHIPAA00.RMB', '_smallraid', ANY_LOCATION_KEY], ['SHIPAA01.RMB', '_smallraid', ANY_LOCATION_KEY]]);
  // no ship: the large one is lent, and the lend is remembered
  _resetWarmAshesShips();
  h = recordingHost({ roll: 0.99 }); setWarmAshesHost(h);
  assert.equal(onPreFastTravel({ oceanPixels: 1, travelShip: true }), 'raid-lent');
  assert.deepEqual(h.calls[0], ['assign', SHIP_TYPES.Large]);
  assert.equal(isTempShip(), true);
  // a lent ship out: every crossing is peaceful until Leave Ship runs
  assert.equal(onPreFastTravel({ oceanPixels: 1, travelShip: true }), 'peace');
  // on foot
  _resetWarmAshesShips();
  h = recordingHost({ roll: 0.99 }); setWarmAshesHost(h);
  assert.equal(onPreFastTravel({ oceanPixels: 9, travelShip: false }), 'base');
  assert.deepEqual(h.variants, [['SHIPAA00.RMB', '_base', ANY_LOCATION_KEY], ['SHIPAA01.RMB', '_base', ANY_LOCATION_KEY]]);
  assert.equal(hasArmedAmbush(), false);
  _resetWarmAshesShips();
});

test('WA1 OnPostFastTravel and the coroutine: armed only by an ambush; 0.05 s of scaled time; the quest, then the boarding, then a lent ship taken back', () => {
  _resetWarmAshesShips();
  let h = recordingHost();
  setWarmAshesHost(h);
  onPostFastTravel();
  assert.equal(boardPending(), false, 'CheckforEncounters: no ambush, no coroutine');
  h = recordingHost({ roll: 0.99 }); setWarmAshesHost(h);
  onPreFastTravel({ oceanPixels: 2, travelShip: true });   // lent
  h.calls.length = 0;
  onPostFastTravel();
  assert.equal(boardPending(), true);
  assert.equal(frame(0), false, 'a paused frame holds the wait');
  assert.equal(frame(0.049), false);
  assert.deepEqual(h.calls, []);
  assert.equal(frame(0.002), true, 'WaitForSeconds(0.05) elapsed');
  assert.deepEqual(h.calls, [['getQuest', WA_RAID_QUEST, 0], ['start', WA_RAID_QUEST], ['ship'], ['reset']],
    'StartQuest, TransportMode = Ship, then ResetShip - the lent ship taken back with the player on it');
  assert.equal(hasArmedAmbush(), false);
  assert.equal(isTempShip(), true, 'tempShip stays set until Leave Ship');
  assert.equal(frame(1), false, 'the coroutine ran once');
  // a quest that will not load: no start, no boarding - and the lend is still taken back
  _resetWarmAshesShips();
  h = recordingHost({ roll: 0.99, quest: null }); setWarmAshesHost(h);
  onPreFastTravel({ oceanPixels: 2, travelShip: true });
  h.calls.length = 0;
  onPostFastTravel(); frame(0.05);
  assert.deepEqual(h.calls, [['getQuest', WA_RAID_QUEST, 0], ['reset']]);
  _resetWarmAshesShips();
});

test('WA1 Leave Ship: in region 31, the blocks back to _base and ashore - a lent ship lent again just to leave it; anywhere else, only done', () => {
  _resetWarmAshesShips();
  const t = new LeaveShip(null);
  assert.equal(t.createNew('Leave Ship', {}) instanceof LeaveShip, true);
  assert.equal(t.createNew('leave ship', {}), null, 'the pattern is the literal, case and all');
  assert.equal(t.typeName, 'LeaveShip');
  // an owner
  let h = recordingHost({ owns: true }); setWarmAshesHost(h);
  let a = t.createNew('Leave Ship', {});
  a.update(null);
  assert.equal(a.isComplete, true);
  assert.deepEqual(h.calls, [['variant', 'SHIPAA00.RMB', '_base'], ['variant', 'SHIPAA01.RMB', '_base'], ['ship']]);
  // a lent ship: lent again, sailed off, taken back - in that order
  h = recordingHost({ roll: 0.99 }); setWarmAshesHost(h);
  onPreFastTravel({ oceanPixels: 1, travelShip: true });
  onPostFastTravel(); frame(0.05);
  h.calls.length = 0;
  a = t.createNew('Leave Ship', {});
  a.update(null);
  assert.deepEqual(h.calls, [['variant', 'SHIPAA00.RMB', '_base'], ['variant', 'SHIPAA01.RMB', '_base'], ['assign', SHIP_TYPES.Large], ['ship'], ['reset']]);
  assert.equal(isTempShip(), false);
  assert.equal(a.isComplete, true);
  // not at sea: nothing but done
  h = recordingHost({ region: 17 }); setWarmAshesHost(h);
  a = t.createNew('Leave Ship', {});
  a.update(null);
  assert.deepEqual(h.calls, []);
  assert.equal(a.isComplete, true);
  _resetWarmAshesShips();
});

test('WA1 the save record and DFU\'s per-mod slot: the record\'s shape, NewSaveData for a save without one, a new game starts fresh', () => {
  _resetWarmAshesShips(); _resetModSaveData();
  assert.deepEqual(newSaveData(), { TempShip: false, HasTraveledbyShip: false });
  restoreSaveData({ TempShip: true, HasTraveledbyShip: true });
  assert.deepEqual(getSaveData(), { TempShip: true, HasTraveledbyShip: true });
  installWarmAshesShips();
  assert.deepEqual(registeredModSaveVendors(), [WARM_ASHES_VENDOR]);
  assert.deepEqual(modSaveRecords(), { [WARM_ASHES_VENDOR]: { TempShip: true, HasTraveledbyShip: true } });
  restoreModSaveRecords({ 'horse-cart-and-cargo': { Version: 2 } });
  assert.deepEqual(getSaveData(), newSaveData(), 'a save without the record: the mod\'s NewSaveData (SaveLoadManager.cs:1529-1534)');
  restoreModSaveRecords({ [WARM_ASHES_VENDOR]: { TempShip: true, HasTraveledbyShip: false } });
  assert.deepEqual(getSaveData(), { TempShip: true, HasTraveledbyShip: false });
  restoreModSaveRecords(null);
  assert.deepEqual(getSaveData(), newSaveData());
  restoreSaveData({ TempShip: true, HasTraveledbyShip: true });
  newGameModSaveRecords();
  assert.deepEqual(getSaveData(), newSaveData(), 'the recorded departure: a new character does not inherit the last one\'s lend');
  // a second registration for a vendor replaces the first
  let got = null;
  registerModSaveData('x', { newSaveData: () => ({ a: 0 }), getSaveData: () => ({ a: 1 }), restoreSaveData: (r) => { got = r; } });
  registerModSaveData('x', { newSaveData: () => ({ a: 2 }), getSaveData: () => ({ a: 3 }), restoreSaveData: (r) => { got = r; } });
  assert.deepEqual(modSaveRecords().x, { a: 3 });
  restoreModSaveRecords({});
  assert.deepEqual(got, { a: 2 });
  _resetModSaveData(); _resetWarmAshesShips();
});

test('WA1 banking.resetShip: DaggerfallBankManager.ResetShip - the ship and nothing else', () => {
  const scenes = [];
  const p = { ownedShip: SHIP_TYPES.None };
  assignShipToPlayer(p, SHIP_TYPES.Large, { addPermanentScene: (s) => scenes.push(s) });
  assert.equal(p.ownedShip, SHIP_TYPES.Large);
  resetShip(p);
  assert.equal(p.ownedShip, SHIP_TYPES.None);
  assert.deepEqual(scenes, [SHIP_TYPES.Large], 'the permanent scenes stay listed, as DFU leaves them');
});

test('WA1 the quests under the port\'s machine: every line a known action, and a quest\'s "Leave Ship" runs the mod\'s action, and restores', () => {
  loadTables();
  _resetWarmAshesShips();
  const m = new QuestMachine({ nowSeconds: () => 0 });
  m.registerAction(new LeaveShip(null));
  const warns = []; const ow = console.warn; console.warn = (...a) => warns.push(a.join(' '));
  let raid;
  try {
    raid = m.parseQuestForLists(questLines('WAQ_SHIP_SMALLRAID'), 0, { rolls: () => 0 });
    for (const n of ['WAQ_SHIP_BASE', 'WAQ_SHIP_RAID']) assert.ok(m.parseQuestForLists(questLines(n), 0, { rolls: () => 0 }), n);
  } finally { console.warn = ow; }
  assert.deepEqual(warns, [], 'no line pended, none refused');
  assert.equal(raid.questName, WA_RAID_QUEST);
  const leaves = [...raid.tasks.values()].flatMap((t) => t.actions).filter((a) => a instanceof LeaveShip);
  assert.equal(leaves.length, 3, 'the three endings each run it');
  // a quest that says it, run by the machine
  const h = recordingHost({ owns: true }); setWarmAshesHost(h);
  const q = m.scheduleQuest(['Quest: WATEST', 'QRC:', 'Message:  1011', ' ashore', '', 'QBN:', 'Leave Ship', ''], 0, { rolls: () => 0 });
  m.tick();
  assert.deepEqual(h.calls, [['variant', 'SHIPAA00.RMB', '_base'], ['variant', 'SHIPAA01.RMB', '_base'], ['ship']]);
  // and a save carrying it restores through the registry (the type resolves only because it is registered)
  const saved = JSON.parse(JSON.stringify(m.getSaveData()));
  const m2 = new QuestMachine({ nowSeconds: () => 0 });
  m2.registerAction(new LeaveShip(null));
  m2.restoreSaveData(saved);
  assert.ok([...m2.quests.values()].some((r) => r.questName === 'WATEST' && [...r.tasks.values()].some((t) => t.actions.some((a) => a instanceof LeaveShip))), `${q.uid} came back with its action`);
  _resetWarmAshesShips();
});

// ---- the host ---------------------------------------------------------------

test('WA1 the host: the events where DFU raises them, the coroutine\'s clock, the action registered whatever the switch says, the quest gate, the ship\'s fade', () => {
  const w = read('src/scenes/world.js');
  const ft = w.slice(w.indexOf('async function fastTravelTo('), w.indexOf('// P-slice: the ABOVE-GROUND QUICKSAVE'));
  const pre = ft.indexOf('warmAshesPreTravel({ oceanPixels: computed.oceanPixels ?? 0, travelShip: !!opts.travelShip })');
  assert.ok(pre > ft.indexOf('deductGold(playerEntity,'), 'RaiseOnPreFastTravelEvent follows DeductFastTravelGold (:326-328)');
  assert.ok(pre < ft.indexOf('await _teleportToPixel('), '...and precedes the teleport');
  const post = ft.indexOf('warmAshesPostTravel()');
  assert.ok(post > ft.indexOf('setCrimeCommitted(playerEntity, CRIMES.None);'), 'RaiseOnPostFastTravelEvent is the last statement (:383)');
  assert.equal((w.match(/warmAshesFrame\(gamePaused\(\) \? 0 : dt \* worldTimeScale\(\)\);/g) ?? []).length, 2, 'the clock ticks in the modal branch and outdoors, as HCC\'s LateUpdate does');
  assert.match(w, /\n {2}questBridge\.machine\.registerAction\(new LeaveShip\(null\)\);\n/, 'registered unconditionally');
  assert.match(w, /if \(!townTalk\.overlayActive && !worldMoveBusy\(\) && !hudFade\.fadeInProgress\) questBridge\.tick\(dt\);/);
  const board = w.slice(w.indexOf('async function boardOrDisembark()'), w.indexOf('// ---- A10 - THE RECALL ANCHOR', w.indexOf('async function boardOrDisembark()')));
  assert.ok(board.indexOf('hudFade.smashHUDToBlack();') < board.indexOf('await _teleportToPixel(') && board.indexOf('hudFade.fadeHUDFromBlack();') > board.indexOf('await _teleportToPixel('), 'black, the teleport, the fade back');
  assert.match(w, /function shipTransportMode\(\) \{\n\s+if \(\(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) modes\?\.forceExitToExterior\(\);\n\s+return boardOrDisembark\(\);/);
  assert.match(w, /modData: \{ \[HCC_VENDOR\]: hccRuntime\.getSaveData\(\), \.\.\.modSaveRecords\(\) \}/);
  assert.match(w, /if \(hccRecord\) hccRuntime\.restoreSaveData\(hccRecord\);\n\s+restoreModSaveRecords\(extras\.modData\);/);
  assert.match(w, /if \(!_loadedGame\) newGameModSaveRecords\(\);/);
  const d = read('src/scenes/dungeonContext.js');
  assert.match(d, /opts\.modSaveLoad\?\.\(extras\.modData \?\? null\);[^\n]*\n\s+opts\.horseCartLoad\?\./);
  assert.match(read('src/scenes/shared.js'), /installWarmAshesShips\(\);[^\n]*\n\s+installDiverseWeaponsIcons\(\);/);
});

test('WA1 the switch, the lane and the credit: one Enabled on by default, the player\'s own online, Kamer credited, the permission RECORD OPEN', () => {
  _resetModSettings();
  const def = MOD_SETTINGS[WARM_ASHES_VENDOR];
  assert.equal(def.author, 'Kamer');
  assert.deepEqual(Object.keys(def.keys), ['Enabled']);
  assert.equal(def.keys.Enabled.default, true);
  assert.equal(warmAshesOn(), true);
  assert.ok(ONLINE_PLAYERS_OWN_MODS.includes(WARM_ASHES_VENDOR));
  assert.equal(ONLINE_ROOM_MOD_KEYS[WARM_ASHES_VENDOR], undefined);
  const row = CREDITS.mods.find((r) => r.vendor?.includes(WARM_ASHES_VENDOR));
  assert.deepEqual([row.author, row.version, row.contact], ['Kamer', '1.1', 'DFU Discord']);
  assert.match(read('vendor/warm-ashes-ships/README.md'), /\[Mac: record the author's permission/);
  assert.match(read('bible/01-Overview/Mod-Registry.md'), /\| `warm-ashes-ships` \|[^\n]*\*\*RECORD OPEN\*\*/);
});

// ---- with the player's own data ----------------------------------------------

test('WA1 with ARENA2: the variants rebuilt and served; with Detailed Ships on, its building laid over the player\'s ship and the pirates\' left classic', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, async () => {
  const blocks = new BlocksFile();
  assert.ok(blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))));
  const patch = (vendor, f) => JSON.parse(readFileSync(join(ROOT, 'vendor', vendor, 'WorldDataPatches', f), 'utf8'));
  // the rebuilt variants: the pirate ships where the author stood them
  const small = rebuildWorldDataPatch(patch('warm-ashes-ships', 'SHIPAA01.RMB_smallraid.json'), blocks);
  assert.deepEqual(small.RmbBlock.SubRecords.map((s) => [s.XPos, s.ZPos, s.YRotation, s.Exterior.Block3dObjectRecords[0].ModelIdNum]),
    [[1408, 1600, -512, 909], [2450, 3680, -722, 910], [2321, 140, -317, 910]]);
  const warn = console.warn; const log = console.log; console.warn = () => {}; console.log = () => {};
  try {
    _resetWorldDataReplacement(); installWorldDataReplacement(); bindWorldDataBlocks(blocks); clearWorldDataVariants();
    for (const f of readdirSync(join(ROOT, 'vendor/warm-ashes-ships/WorldDataPatches'))) assert.equal(await registerWorldDataPatch(patch('warm-ashes-ships', f), null), true, f);
    assert.equal(await registerWorldDataPatch(patch('detailed-ships', 'SHIPAA01.RMB-630-building0.json'), null), true);
    setLastLocationKeyTo(31, 2);
    setBlockVariant('SHIPAA01.RMB', '_smallraid', ANY_LOCATION_KEY);
    assert.equal(getBlockVariantHere('SHIPAA01.RMB'), '_smallraid');
    const served = getDFBlockReplacementData(630, 'SHIPAA01.RMB');
    const subs = served.rmbBlock.subRecords;
    assert.equal(subs.length, 3);
    assert.equal(subs[0].interior.block3dObjectRecords.length, 1134, 'the player\'s ship is Detailed Ships\' - its building file over the variant block');
    assert.equal(subs[1].interior.block3dObjectRecords.length, blocks.readClassicBlock(390).rmbBlock.subRecords[0].interior.block3dObjectRecords.length, 'the pirates\' is the classic small ship');
    assert.deepEqual([subs[0].xPos, subs[0].zPos], [1408, 1600], 'the variant\'s own position stands (only Exterior and Interior are replaced)');
  } finally {
    console.warn = warn; console.log = log;
    _resetWorldDataReplacement(); clearWorldDataVariants();
  }
});
