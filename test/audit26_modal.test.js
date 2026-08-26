// AUDIT 26 - the MODAL host (src/scenes/worldModes.js): the interior /
// dungeon mode machine the two exterior hosts hand the frame to.
//
// Every pin below is a DFU law the machine had lost at one seam while
// its siblings kept it: the right-click a window owns, the motor a
// paused window stops, the window a forced door has to pop, the scene
// it has to cache, the StaticNPC.Data a conversation is keyed by, and
// the goods a sale actually takes out of the pack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { staticNpcData, staticNpcName } from '../src/characters/staticNpc.js';
import { RACES } from '../src/systems/races.js';
import { NPCSession, SOCIAL_GROUP } from '../src/systems/npcSession.js';
import { windowEmissionRGB } from '../src/render/windowEmission.js';
import { NOT_ENOUGH_SPELL_POINTS_TEXT } from '../src/systems/tradeModes.js';
import { RANDOM_TREASURE_MARKER_DIM } from '../src/systems/loot.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { questFlatStandY } from '../src/scenes/worldModes.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import {
  PRIVATE_PROPERTY_ITEMS_MODELS_0_TO_1, PRIVATE_PROPERTY_ITEMS_MODELS_2_TO_3,
  PRIVATE_PROPERTY_ITEMS_MODELS_4_TO_10, PRIVATE_PROPERTY_ITEMS_MODELS_11_TO_14,
  PRIVATE_PROPERTY_ITEMS_MODELS_15_AND_UP,
  privatePropertyItemList, stockHouseContainer, restockHouseContainerIfDue,
} from '../src/systems/shopStock.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(ROOT, f), 'utf8');
const WM = src('src/scenes/worldModes.js');
const INT = src('src/scenes/interior.js');
const WORLD = src('src/scenes/world.js');
const EXT = src('src/scenes/exterior.js');

/** The brace-matched body of a function/method, from its header. */
function bodyOf(text, header) {
  const i = text.indexOf(header);
  assert.ok(i > 0, `${header} not found`);
  let depth = 0;
  let j = text.indexOf('{', i + header.length - 1);
  const start = j;
  for (; j < text.length; j++) {
    if (text[j] === '{') depth++;
    else if (text[j] === '}' && --depth === 0) break;
  }
  return text.slice(start, j + 1);
}

/** Is `needle` inside a brace-matched `gate` block somewhere in text? */
function insideGate(text, gate, needle) {
  const target = text.indexOf(needle);
  assert.ok(target > 0, `${needle} not found`);
  for (let i = text.indexOf(gate); i >= 0; i = text.indexOf(gate, i + 1)) {
    let depth = 0;
    let j = text.indexOf('{', i + gate.length - 1);
    const open = j;
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}' && --depth === 0) break;
    }
    if (target > open && target < j) return true;
  }
  return false;
}

// ---------------------------------------------------------------------
// F205 - a right-click on a window is the WINDOW's.
// UserInterfaceManager.cs:179-185: AddWindow pauses the game for any
// PauseWhileOpen window, so the click never reaches WeaponManager - and
// in this port the modal sink runs magic.interceptAttack FIRST, so an
// ungated right-click cast the readied spell instead of removing an item.
// ---------------------------------------------------------------------

test('AUDIT 26 F205: every host gates the RMB press on "no window up" - and none of them gates the release', () => {
  const press = [
    ['src/scenes/worldModes.js', /if \(e\.button === 2 && !modalWindowUp\(\)\) modalAttackSink\(\)\?\.\(0, 0, true\);/],
    ['src/scenes/dungeon.js', /if \(e\.button === 2 && !ctx\.uiOverlayActive\) ctx\.playerAttackInput\(0, 0, true\);/],
    ['src/scenes/world.js', /if \(e\.button === 2 && !townTalk\.overlayActive && walkMode/],
    ['src/scenes/exterior.js', /if \(e\.button === 2 && !townTalk\.overlayActive && walkMode/],
  ];
  for (const [host, re] of press) {
    assert.match(src(host), re, `${host}: the modal RMB press must be refused while a window is up`);
  }
  // ...and the RELEASE is never gated: a window opened mid-swing must
  // still let go, which is why the four mouseup arms carry no window test.
  const release = [
    ['src/scenes/worldModes.js', /if \(e\.button === 2\) modalAttackSink\(\)\?\.\(0, 0, false\);/],
    ['src/scenes/dungeon.js', /if \(e\.button === 2\) ctx\.playerAttackInput\(0, 0, false\);/],
    ['src/scenes/world.js', /if \(e\.button === 2 && walkMode && modeNow\(\) === 'exterior'\) weaponRig\.attackInput\(0, 0, false\);/],
    ['src/scenes/exterior.js', /if \(e\.button === 2 && walkMode && modeNow\(\) === 'exterior'\) weaponRig\.attackInput\(0, 0, false\);/],
  ];
  for (const [host, re] of release) assert.match(src(host), re, `${host}: the release stays ungated`);
  // ONE expression for "a mode window is up" - the cursor toggle and the
  // attack seam read the same one rather than each spelling it out.
  assert.match(WM, /const modalWindowUp = \(\) => \(mode === 'dungeon' \? !!dungeonCtx\?\.uiOverlayActive : !!interiorOverlay\);/);
  assert.match(WM, /bindCursorToggle\(canvas, modalWindowUp, actionOf\);/);
});

// ---------------------------------------------------------------------
// F065 - PauseGame(true) sets Time.timeScale = 0 (GameManager.cs:600-609),
// so PlayerMotor stops updating entirely. Zeroed inputs are the PARALYSIS
// law, not this one: they let gravity, velocity and the crouch edge keep
// running under an open menu.
// ---------------------------------------------------------------------

test('AUDIT 26 F065: the world-hosted motor stops under a window, as the standalone dungeon host does', () => {
  assert.ok(insideGate(WM, 'if (!overlayHeld) {', 'player.update(dt, paralyzed ?'),
    'worldModes runs the player motor under an open window');
  assert.ok(insideGate(WM, 'if (!overlayHeld) {', 'latch.crouch = crouchHeld;'),
    'the crouch edge is the motor step, and it toggled under a window');
  assert.ok(insideGate(WM, 'if (!overlayHeld) {', '_footsteps.update(player.pos'),
    'and the footstep clock rides the same gate');
  // the zeroed-input bag is PARALYSIS alone now (the standalone host's
  // own shape: `player.update(dt, paralyzed ? ...` inside its gate)
  assert.doesNotMatch(WM, /const inputHeld = paralyzed \|\| overlayHeld;/,
    'overlayHeld must not be folded into the motor input bag - that is what let the fall complete');
  assert.match(src('src/scenes/dungeon.js'), /if \(walkMode && !overlayHeld\) \{/,
    'the standalone host is the shape being matched');
  // the motor's FRAME FLAGS are reset by the update that sets them, so
  // their readers cannot run on a paused frame or they re-report a stale
  // jump / landing every frame the window is open
  for (const call of [
    'if (!overlayHeld) dungeonCtx.reportActivity?.(',
    'if (!overlayHeld) dungeonCtx.reportMotor?.(',
    'if (!overlayHeld) applyFallLanding(playerEntity, player.landedFallDistance',
    'if (!overlayHeld) interiorTicker.tick(dt, {',
  ]) assert.ok(WM.includes(call), `the motor-flag reader must be held: ${call}`);
});

// ---------------------------------------------------------------------
// F211 + F064 - the FORCED door (anchor recall, the guild's Teleportation
// service, a quest TeleportPc landing). Teleport.cs:145-148 caches the
// interior scene before departing; UserInterfaceManager.cs:189-196 runs
// OnPop on every window it removes, and RestWindow raises IsResting on
// open and clears it there alone.
// ---------------------------------------------------------------------

test('AUDIT 26 F211 + F064: the forced exit caches the interior and disposes the window it drops', () => {
  const force = bodyOf(WM, 'forceExitToExterior() {');
  // Teleport.cs:148 - CacheScene(playerEnterExit.Interior.name), the same
  // write the real door makes (PlayerEnterExit.cs:860 / tryExit)
  assert.match(force, /cacheInteriorScene\(\);/,
    'a recall out of a building discarded every change made inside it');
  assert.ok(force.indexOf('cacheInteriorScene();') < force.indexOf('interiorCtx.destroy()'),
    'the cache is written while the shelves and action objects are still alive');
  // OnPop: the slot is DISPOSED, never dropped raw
  assert.match(force, /interiorOverlay\?\.dispose\?\.\(\);/,
    'the interior slot was nulled raw - a rest window there left isResting raised for the session');
  assert.ok(force.indexOf('interiorOverlay?.dispose?.();') < force.indexOf('interiorOverlay = null'),
    'dispose before the slot is cleared, or _close never runs');
  assert.match(force, /dungeonCtx\.overlayWindow\?\.\(\)\?\.dispose\?\.\(\);/,
    'the dungeon context is destroyed without popping its own window');
  assert.ok(force.indexOf('dungeonCtx.overlayWindow?.()?.dispose?.();') < force.indexOf('dungeonCtx.destroy()'),
    'and it is popped before the context that holds it is torn down');
  // the real door has always done both - the pin is that they agree
  const door = bodyOf(WM, 'function tryExit() {');
  assert.match(door, /cacheInteriorScene\(\);/, 'the real door still caches it too (PlayerEnterExit.cs:860)');
});

// ---------------------------------------------------------------------
// F018 - TalkToStaticNPC reads targetNPC.Data (TalkManager.cs:752-770):
// the nameSeed the questor pool and castleNPCsSpokenTo are keyed by, the
// factionID the faction walk starts from, the race the NPCData carries.
// The port handed it the raw block-person record, which has none of them.
// ---------------------------------------------------------------------

const blockPerson = (over = {}) => ({
  x: 1, y: 2, z: 3, textureArchive: 182, textureRecord: 4,
  factionID: 0, flags: 0, rawX: 10, rawY: 20, rawZ: 30, position: 1234, ...over,
});

const session = (over = {}) => new NPCSession({
  factionData: () => null,
  factionName: () => '',
  reactionToPlayer: () => 0,
  expandRandomTextRecord: (id) => `record:${id}`,
  randomTokens: (id) => [{ text: `tokens:${id}` }],
  messageBox: () => {},
  pushTalkWindow: () => {},
  sgroupReputation: () => 1000,
  rolls: () => 0.9,
  ...over,
});

test('AUDIT 26 F018: the talk seam is handed StaticNPC.Data - the block record has no nameSeed at all', () => {
  const pn = blockPerson();
  assert.equal(pn.nameSeed, undefined, 'collectInteriorPeople writes no such field - `pn.nameSeed ?? 0` is always 0');
  // SetLayoutData (StaticNPC.cs:210-224): position ^ (buildingKey + locationIndex)
  const data = staticNpcData(pn, { mapId: 5, locationIndex: 9, buildingKey: 7 });
  assert.equal(data.nameSeed, 1218);
  assert.equal(data.nameSeed, (1234 ^ (7 + 9)) | 0);

  // ...and the questor pool is keyed by that derived seed (TalkManager.cs
  // :2845/:2868 add by npcData.nameSeed, :759 looks up by .Data.nameSeed).
  const work = { npc: data, socialGroup: SOCIAL_GROUP.Merchants, buildingName: 'The Inn' };
  const s = session();
  s.npcsWithWork.set(data.nameSeed, work);
  assert.equal(s.talkToStaticNPC({ data, isChildNPC: false, displayName: 'x' }).kind, 'questOffer',
    'the derived record finds the questor');
  const s2 = session();
  s2.npcsWithWork.set(data.nameSeed, work);
  assert.equal(s2.talkToStaticNPC({ data: pn, isChildNPC: false, displayName: 'x' }).kind, 'talk',
    'the block record keys by 0, so no townsperson in the game could ever be carrying work');

  // the host passes the derived record at BOTH talk seams - the click and
  // the guild popup's Talk button - and seeds the answer PRNG from it
  assert.equal(WM.match(/\{ data: npcData, isChildNPC: !!pn\.isChildNPC, displayName/g)?.length, 2);
  assert.equal(WM.match(/npcSeed: npcData\.nameSeed/g)?.length, 2);
  assert.doesNotMatch(WM, /npcSeed: pn\.nameSeed/, 'the field nothing writes is gone');
  assert.doesNotMatch(WM, /\{ data: pn,/, 'and so is the block record as `data`');
});

// ---------------------------------------------------------------------
// F017 - GetRaceFromFaction (StaticNPC.cs:357-369) always has the live
// FactionData lookup and the region fallback. The guild popup's Talk
// button re-derived the data without either, so every NPC reached that
// way was a Nord answering to a different generated name than the same
// NPC clicked directly.
// ---------------------------------------------------------------------

test('AUDIT 26 F017: the popup Talk reads the same StaticNPC.Data the click derived - race lookups and all', () => {
  const pn = blockPerson({ factionID: 88 });
  // FACTION.TXT's own race enum: Breton is 3 there (FactionFile.cs:609-623)
  const getFaction = (id) => (id === 88 ? { id: 88, type: 1, race: 3, name: 'The Merchants' } : null);
  const withLookups = staticNpcData(pn, {
    buildingKey: 7, locationIndex: 9, getFaction, raceOfCurrentRegion: () => RACES.Redguard,
  });
  assert.equal(withLookups.race, RACES.Breton, 'a named faction lends its race');
  // no lookups: GetFactionData's out-struct default is FactionRaces.Nord
  assert.equal(staticNpcData(pn, { buildingKey: 7, locationIndex: 9 }).race, RACES.Nord);
  // same seed, different bank, different draw - the two seams answered
  // different names for one NPC
  assert.notEqual(
    staticNpcName(withLookups, { getFaction }),
    staticNpcName(staticNpcData(pn, { buildingKey: 7, locationIndex: 9 }), { getFaction }),
    'the race picks the name bank, so the popup renamed the NPC it opened over',
  );

  // the host derives it ONCE per click and lends it to the popup, which is
  // what DFU's single StaticNPC component is
  assert.match(WM, /const npcData = questBridge\?\.clickNpc\(pn, npcSceneCtx\) \?\? staticNpcData\(pn, npcSceneCtx\);/);
  assert.match(WM, /function openGuildService\(pn, route, npcData\) \{/);
  assert.match(WM, /openGuildService\(pn, route, npcData\);/);
  const popup = bodyOf(WM, 'function openGuildService(pn, route, npcData) {');
  assert.doesNotMatch(popup, /staticNpcData\(/,
    'the popup must not re-derive the record without the bridge\'s race lookups');
});

// ---------------------------------------------------------------------
// F063 - DaggerfallTradeWindow.cs:795 TransferItem takes a staged item OUT
// of PlayerEntity.Items, and the Sell confirm then clears the remote lot
// (:1036-1051). The port's window stages out of a filtered COPY of the
// pack, so nothing ever left it: the sale paid and the goods stayed.
// ---------------------------------------------------------------------

test('AUDIT 26 F063: a native-mode sale takes the goods out of the pack, and the two sell paths agree', () => {
  const commit = bodyOf(WM, 'function commitTrade(shelf, mode, staged, price, proceeds, identifySpell = null) {');
  // the Sell arm removes what it just paid for
  assert.match(commit, /const i = playerEntity\.items\.indexOf\(it\);\s*\n\s*if \(i >= 0\) playerEntity\.items\.splice\(i, 1\);\s*\n\s*shelf\.items\.push\(it\);/,
    'Sell paid full price and left the item in the pack - unlimited gold, one item');
  // ...and the keyed path has always done exactly that, so the two agree
  const sell = bodyOf(WM, 'function doSell(shelf, it) {');
  assert.match(sell, /playerEntity\.items\.splice\(playerEntity\.items\.indexOf\(it\), 1\);/);
  // Identify and Repair move NOTHING back: the staged item never left, so
  // an addItem aliased it into the pack twice (or doubled a stack).
  assert.equal((commit.match(/addItem\(/g) ?? []).length, 1,
    'the only addItem in the transaction is Buy\'s - the shelf item that really does change hands');
  assert.doesNotMatch(commit, /for \(const it of staged\) addItem\(playerEntity\.items, it\);/);
  assert.doesNotMatch(commit, /it\.isIdentified = true; addItem\(playerEntity\.items, it\);/);
  // and the collection the window is handed is named for what it is
  assert.match(WM, /packItems: \(\) => \(playerEntity\.items \?\?= \[\]\)\.filter\(\(it\) => !isEquipped\(it\)\),/);
});

// ---------------------------------------------------------------------
// AUDIT 26 hosts-modal - the five parity findings below. Each is a DFU
// law the modal host had lost, and each pin is written against the C#
// rather than against the port.
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// F001 - a building interior is laid out with WindowStyle.Disabled
// (DaggerfallInterior.cs:473, :517, :1270), and Disabled is
// EmissionColor = Color.black (MaterialReader.cs:934-936). The port's
// emission uniform is global and only the two EXTERIOR frames ever wrote
// it, so inside every shop the glass kept the town's day/night glow.
// ---------------------------------------------------------------------

test('AUDIT 26 F001: WindowStyle.Disabled is black, and both interior hosts state it every frame', () => {
  // ChangeWindowEmissionColor's five arms, verbatim, as the renderer
  // uploads them (color/255 * intensity).
  assert.deepEqual([...windowEmissionRGB('disabled')], [0, 0, 0],
    'WindowStyle.Disabled sets EmissionColor to Color.black outright');
  // ...and the four LIT arms are untouched by that addition
  assert.deepEqual([...windowEmissionRGB('day')].map((v) => +v.toFixed(6)),
    [(89 / 255) * 0.5, (154 / 255) * 0.5, (178 / 255) * 0.5].map((v) => +v.toFixed(6)));
  assert.deepEqual([...windowEmissionRGB('night')].map((v) => +v.toFixed(6)),
    [(255 / 255) * 0.8, (182 / 255) * 0.8, (56 / 255) * 0.8].map((v) => +v.toFixed(6)));
  // an unknown style still falls back to Day (GetMaterial's default)
  assert.deepEqual([...windowEmissionRGB('nonesuch')], [...windowEmissionRGB('day')]);

  // THE FOUR HOSTS: the modal host's interior arm and the standalone
  // ?interior scene both say it; the exterior arms keep the day/night/fog
  // read, which is DaggerfallLocation.WindowTextureStyle (:143-145).
  assert.match(WM, /renderer\.setWindowEmission\(windowEmissionRGB\('disabled'\)\);/,
    'the modal interior frame must set the interior window style');
  assert.match(INT, /renderer\.setWindowEmission\(windowEmissionRGB\('disabled'\)\);/,
    'the standalone ?interior host must set it too - main.js boots the global to Day');
  for (const [name, text] of [['world.js', WORLD], ['exterior.js', EXT]]) {
    assert.match(text, /windowStyleForWeather\(weather\) \?\? windowStyleForTime\(minute\)/,
      `${name} keeps the exterior day/night/fog read`);
    assert.doesNotMatch(text, /windowEmissionRGB\('disabled'\)/,
      `${name} is an exterior frame - Disabled is not its style`);
  }
});

// ---------------------------------------------------------------------
// F066 - PlayerActivate.cs:887-899: a shelf stocks either way, and then
// IsPlayerInsideOpenShop decides the WINDOW - the Buy trade window when
// the shop is open, SetShopShelfStealing + the inventory over the shelf
// as LootTarget (:959-961) when it is shut. The port computed the latch
// at the door (:1120) and fed it only to the people gate.
// ---------------------------------------------------------------------

test('AUDIT 26 F066: a shut shop opens the stealing inventory, never the Buy window', () => {
  const open = bodyOf(WM, 'function openShelf(i) {');
  // the stock is unconditional - DFU stocks before it branches
  const stockAt = open.indexOf('stockShelfIfDue(shelf, b);');
  const gateAt = open.indexOf('if (!interiorOpenShop)');
  assert.ok(stockAt > 0 && gateAt > stockAt,
    'PlayerActivate stocks the shelf (:881-885) BEFORE it asks whether the shop is open');
  // the shut arm is the inventory with the shelf as remote loot target...
  assert.match(open, /if \(!interiorOpenShop\) \{[\s\S]*?host\.makeInventory\?\.\(\{ loot: \{ items: \(\) => \(shelf\.items \?\?= \[\]\) \} \}\)/,
    'a shut shop takes InventoryWindow.LootTarget, not a trade window');
  // ...and it RETURNS, so neither trade path below can run
  const shutArm = open.slice(gateAt, open.indexOf('// U8c: the native trade screen'));
  assert.match(shutArm, /return;/, 'the stealing arm must end the activation');
  assert.ok(open.indexOf('openTradeWindow(shelf, b, \'Buy\')') > gateAt,
    'the Buy window is only reachable past the open-shop gate');

  // the latch is PlayerActivate.cs:1120's, computed once at the door...
  assert.match(WM, /const insideOpenShop = _bt != null && isShop\(_bt\) && isBuildingOpen\(_bt, _hour\);\s*\n\s*interiorOpenShop = insideOpenShop;/,
    'the door computes it and the latch keeps it - a shop entered open stays open');
  // ...and it leaves with the interior, like the identity and the overlay
  assert.equal((WM.match(/interiorOpenShop = false;/g) ?? []).length, 3,
    'declared false and cleared on both exit paths (the door and the forced teardown)');
});

// ---------------------------------------------------------------------
// F067 - DaggerfallTradeWindow.DoModeAction (:956-995): the Identify
// SPELL refuses the whole pass when it costs more than CurrentMagicka,
// and it never reaches ConfirmTrade, so it never reaches the
// TallySkill(Mercantile, 1) at :1088. The port tallied every cast and
// clamped the magicka to zero instead of refusing.
// ---------------------------------------------------------------------

test('AUDIT 26 F067: the Identify SPELL refuses on low magicka and never tallies Mercantile', () => {
  const commit = bodyOf(WM, 'function commitTrade(shelf, mode, staged, price, proceeds, identifySpell = null) {');
  // the refusal, in front of the pass
  const gateAt = commit.indexOf('if (identifySpell.cost > (playerEntity.magicka ?? 0))');
  const passAt = commit.indexOf('identifySpellPass(');
  assert.ok(gateAt > 0 && passAt > gateAt,
    'IdentifySpellCost > CurrentMagicka refuses BEFORE anything is identified');
  assert.match(commit.slice(gateAt, passAt), /say\(NOT_ENOUGH_SPELL_POINTS_TEXT\);\s*\n\s*return;/,
    'DFU shows notEnoughSpellpointsLeft and returns');
  // Internal_Strings.csv:1052, verbatim
  assert.equal(NOT_ENOUGH_SPELL_POINTS_TEXT, 'You do not have enough spell points left.');
  // the tally belongs to ConfirmTrade, which the spell pass never reaches
  assert.match(commit, /if \(!identifySpell\) tallySkill\(playerEntity, SKILLS\.Mercantile, 1\);/,
    'ConfirmTrade_OnButtonClick:1088 is the only TallySkill, and DoModeAction returns before it');
  assert.equal((commit.match(/tallySkill\(/g) ?? []).length, 1,
    'one tally per concluded deal, and the spell concludes no deal');
});

// ---------------------------------------------------------------------
// F068 - AddQuestNPC rays the ground (GameObjectHelper.cs:1040) and
// AddQuestItem (:1116-1160) never does: an item's dungeon shift is the
// CONSTANT -randomTreasureMarkerDim / 2 * GlobalScale, not its own
// half-height, and nothing snaps it to the floor. The port ran one law
// for both, so an item on a table was pulled down to the floor.
// ---------------------------------------------------------------------

test('AUDIT 26 F068: a quest ITEM takes AddQuestItem\'s law - a fixed dungeon shift and no ground ray', () => {
  // DaggerfallLoot.cs:33 dim = 40, MeshReader.GlobalScale = 0.025
  assert.equal(RANDOM_TREASURE_MARKER_DIM, 40);
  assert.equal(GLOBAL_SCALE, 0.025);
  assert.equal((RANDOM_TREASURE_MARKER_DIM / 2) * GLOBAL_SCALE, 0.5,
    'AddQuestItem:1135-1136 shifts a dungeon item by exactly -0.5 world units');

  // The law, driven. An ITEM's dungeon shift is that constant and does
  // NOT depend on the sprite; an NPC's is the sprite's own half height.
  const rays = [];
  const floorAt = (groundY) => (origin, dir, distance) => {
    rays.push({ origin: [...origin], dir: [...dir], distance });
    return origin[1] - groundY;
  };
  for (const sizeH of [0.4, 1.6, 3.25]) {
    assert.equal(questFlatStandY({ y: 10, sizeH, isItem: true, inDungeon: true }), 9.5);
    assert.equal(questFlatStandY({ y: 10, sizeH, isItem: true, inDungeon: false }), 10);
    assert.equal(questFlatStandY({ y: 10, sizeH, isItem: false, inDungeon: true }), 10 - sizeH / 2);
  }
  // ...and an item is never snapped to a floor, which is what keeps one
  // on a table, a shelf or a cage marker where the quest put it.
  rays.length = 0;
  assert.equal(questFlatStandY({ y: 10, sizeH: 1.6, isItem: true, inDungeon: true, raycast: floorAt(2) }), 9.5,
    'a floor 7 units below must not move a quest item at all');
  assert.equal(rays.length, 0, 'AddQuestItem never calls AlignBillboardToGround');
  // the NPC arm on the very same inputs DOES align, from 0.2 above,
  // distance 4, landing 2% of a height clear of the floor (:336-346)
  const npc = questFlatStandY({ x: 1, y: 10, z: 2, sizeH: 1.6, isItem: false, inDungeon: true, raycast: floorAt(8.5) });
  assert.deepEqual(rays[0], { origin: [1, 10 - 0.8 + 0.2, 2], dir: [0, -1, 0], distance: 4 });
  assert.equal(+npc.toFixed(10), +(8.5 + 1.6 * 0.02).toFixed(10));

  // both adapters route items and NPCs through the right arm
  assert.match(WM, /standQuestFlat\(false, flatData\.archive/);
  assert.match(WM, /standQuestFlat\(true, t\.worldTextureArchive/);
  assert.match(WM, /standDungeonQuestFlat\(false, flatData\.archive/);
  assert.match(WM, /standDungeonQuestFlat\(true, t\.worldTextureArchive/);
  // and the stand body reads the law rather than repeating it
  assert.match(WM, /const by = questFlatStandY\(\{/);
});

// ---------------------------------------------------------------------
// F209 - StockHouseContainer (DaggerfallLoot.cs:291-375) was unported:
// private furniture "starts EMPTY" and nothing ever filled it, so no
// house container in the game ever held anything.
// ---------------------------------------------------------------------

test('AUDIT 26 F209: the private-property tables are DaggerfallLootDataTables, verbatim', () => {
  for (const t of [PRIVATE_PROPERTY_ITEMS_MODELS_0_TO_1, PRIVATE_PROPERTY_ITEMS_MODELS_2_TO_3,
    PRIVATE_PROPERTY_ITEMS_MODELS_4_TO_10, PRIVATE_PROPERTY_ITEMS_MODELS_11_TO_14,
    PRIVATE_PROPERTY_ITEMS_MODELS_15_AND_UP]) {
    assert.equal(t.length, 24, 'one row per BuildingTypes Alchemist(0)..Town23(23)');
  }
  // spot rows, straight off DaggerfallLootDataTables.cs:63-198
  assert.deepEqual([...PRIVATE_PROPERTY_ITEMS_MODELS_0_TO_1[0]], [0x06, 0x0C]);
  assert.deepEqual([...PRIVATE_PROPERTY_ITEMS_MODELS_0_TO_1[2]], [0x02, 0x06, 0x0C]);
  assert.deepEqual([...PRIVATE_PROPERTY_ITEMS_MODELS_2_TO_3[4]],
    [0x09, 0x0A, 0x0B, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x14, 0x19]);
  assert.deepEqual([...PRIVATE_PROPERTY_ITEMS_MODELS_4_TO_10[0]],
    [0x07, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x15]);
  assert.deepEqual([...PRIVATE_PROPERTY_ITEMS_MODELS_11_TO_14[16]], [0x04, 0x07, 0x09, 0x0D, 0x19]);
  assert.deepEqual([...PRIVATE_PROPERTY_ITEMS_MODELS_15_AND_UP[4]],
    [0x02, 0x03, 0x04, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x15]);

  // the band ladder (:305-334) and its `<= Town23` gate (:303)
  assert.deepEqual([...privatePropertyItemList(17, 0)], [...PRIVATE_PROPERTY_ITEMS_MODELS_0_TO_1[17]]);
  assert.deepEqual([...privatePropertyItemList(17, 1)], [...PRIVATE_PROPERTY_ITEMS_MODELS_0_TO_1[17]]);
  assert.deepEqual([...privatePropertyItemList(17, 2)], [...PRIVATE_PROPERTY_ITEMS_MODELS_2_TO_3[17]]);
  assert.deepEqual([...privatePropertyItemList(17, 3)], [...PRIVATE_PROPERTY_ITEMS_MODELS_2_TO_3[17]]);
  assert.deepEqual([...privatePropertyItemList(17, 4)], [...PRIVATE_PROPERTY_ITEMS_MODELS_4_TO_10[17]]);
  assert.deepEqual([...privatePropertyItemList(17, 10)], [...PRIVATE_PROPERTY_ITEMS_MODELS_4_TO_10[17]]);
  assert.deepEqual([...privatePropertyItemList(17, 11)], [...PRIVATE_PROPERTY_ITEMS_MODELS_11_TO_14[17]]);
  assert.deepEqual([...privatePropertyItemList(17, 14)], [...PRIVATE_PROPERTY_ITEMS_MODELS_11_TO_14[17]]);
  assert.deepEqual([...privatePropertyItemList(17, 15)], [...PRIVATE_PROPERTY_ITEMS_MODELS_15_AND_UP[17]]);
  assert.deepEqual([...privatePropertyItemList(17, 99)], [...PRIVATE_PROPERTY_ITEMS_MODELS_15_AND_UP[17]]);
  assert.equal(privatePropertyItemList(BUILDING_TYPES.Ship, 0), null, 'buildingType > Town23 has no row');
  assert.equal(privatePropertyItemList(BUILDING_TYPES.AllValid, 0), null);
});

test('AUDIT 26 F209: StockHouseContainer mints on the halving DFRandom continue chance', () => {
  // ONE group for the whole container, then the loop of
  // DaggerfallLoot.cs:369-371 - the add comes AFTER the test, so the
  // FIRST item is unconditional and the chance halves 50, 25, 12, ...
  const drawsFor = (dfSeq) => {
    let i = 0;
    return stockHouseContainer({ buildingType: BUILDING_TYPES.House1, textureRecord: 0 },
      { level: 1, gender: 'male' }, { rolls: () => 0.5, dfRand: () => dfSeq[i++] ?? 99 });
  };
  // rand()%100 = 99 > 50 on the first test: exactly one item, never zero
  assert.equal(drawsFor([99]).length, 1, 'the add is after the test - a stocked container is never empty');
  // 10 <= 50 continues; 30 > 25 stops
  assert.equal(drawsFor([10, 30]).length, 2);
  // 10 <= 50, 20 <= 25, 20 > 12 stops
  assert.equal(drawsFor([10, 20, 20]).length, 3);
  // House1 row 17 of the 0-to-1 table is {Armor, MensClothing, WomensClothing};
  // 0.5 * 3 = index 1 = MensClothing (0x06)
  assert.deepEqual([...PRIVATE_PROPERTY_ITEMS_MODELS_0_TO_1[BUILDING_TYPES.House1]], [0x02, 0x06, 0x0C]);
  assert.equal(drawsFor([99])[0].group, 'MensClothing',
    'the group is drawn once for the whole container, not per item');
  // every item is finished the way a shelf item is - name and value
  const it = drawsFor([99])[0];
  assert.ok(it.name && typeof it.value === 'number' && it.maxCondition > 0);
  // ...and there is no gender swap here: BOTH clothing ids route to
  // CreateRandomClothing, which picks the group off the PLAYER's gender
  const female = stockHouseContainer({ buildingType: BUILDING_TYPES.House1, textureRecord: 0 },
    { level: 1, gender: 'female' }, { rolls: () => 0.5, dfRand: () => 99 });
  assert.equal(female[0].group, 'WomensClothing');

  // a building past Town23 stocks nothing at all
  assert.deepEqual(stockHouseContainer({ buildingType: BUILDING_TYPES.Ship, textureRecord: 0 },
    { level: 1 }, { rolls: () => 0.5, dfRand: () => 99 }), []);
});

test('AUDIT 26 F209: the container arm restocks per game day, skips a house the player owns, and the host calls it', () => {
  const date = { year: 405, month: 3, day: 3 };            // the 4th of the 4th month
  const c = { items: [], record: 0, stockedDate: 0 };
  const opts = { rolls: () => 0.5, dfRand: () => 99 };
  assert.equal(restockHouseContainerIfDue(c, { buildingType: BUILDING_TYPES.House1 }, date, {}, opts), true);
  assert.equal(c.items.length, 1);
  // same game day: PlayerActivate.cs:911's `<` is false, nothing re-rolls
  c.items = [];
  assert.equal(restockHouseContainerIfDue(c, { buildingType: BUILDING_TYPES.House1 }, date, {}, opts), false);
  assert.deepEqual(c.items, [], 'an emptied cupboard stays empty until the day rolls over');
  // ...and the next day it does
  assert.equal(restockHouseContainerIfDue(c, { buildingType: BUILDING_TYPES.House1 },
    { year: 405, month: 3, day: 4 }, {}, opts), true);
  assert.equal(c.items.length, 1);

  // the playerOwned arm (:903-908): stockedDate = 1, and NOTHING is rolled
  const mine = { items: [{ group: 'Weapons', templateIndex: 1 }], record: 0, stockedDate: 0 };
  assert.equal(restockHouseContainerIfDue(mine, { buildingType: BUILDING_TYPES.House1, playerOwned: true }, date, {}, opts), false);
  assert.equal(mine.stockedDate, 1, 'DFU stamps it 1 "to ensure it gets serialized"');
  assert.deepEqual(mine.items, [{ group: 'Weapons', templateIndex: 1 }],
    'an owned house\'s furniture is the player\'s own storage - it is never re-stocked');

  // and the host's HouseContainers arm runs it, with the empty-container
  // early-out (:917-918) in front of the transfer
  const arm = WM.slice(WM.indexOf("if (key.startsWith('container:')) {"));
  const stockAt = arm.indexOf('restockHouseContainerIfDue(c, {');
  const emptyAt = arm.indexOf('if (!c.items.length) return true;');
  const takeAt = arm.indexOf('transferAll(c.items, playerEntity.items);');
  assert.ok(stockAt > 0 && emptyAt > stockAt && takeAt > emptyAt,
    'stock on first access, then "if no contents, do nothing", then open');
  assert.match(arm, /playerOwned: \(b\?\.buildingType === BUILDING_TYPES\.Ship && ownsShip\(playerEntity\)\)/);
  // the stamp rides the scene cache with the items (SerializableLootContainer.cs:72)
  assert.match(WM, /containerType: LOOT_CONTAINER_TYPES\.HouseContainers, key: `container:\$\{i\}`, items: c\.items \?\? null, stockedDate: c\.stockedDate \?\? 0,/);
});
