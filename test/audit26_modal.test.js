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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(ROOT, f), 'utf8');
const WM = src('src/scenes/worldModes.js');

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
