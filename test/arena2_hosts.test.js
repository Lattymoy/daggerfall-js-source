// ARENA2 (2026-10-02): THE FOUR HOSTS (bible/Home.md's rule: wire or flag by name). scenes/world.js - WIRED: the one
// bout driver for both floors (the city's exhibition on the hour, the instance's), ticked before the modal return, the
// crowd's batches in both passes, the music held while a bout is heard, the duel's law (rest, travel, journeys) while my
// bout stands, my ring, the Herald's choice and its doors, the 1 HP spare and the landing out of the instance, the
// displaced house's doors. scenes/worldModes.js - WIRED: the Herald's click, the floor's instance (enter, its gates,
// its light and air, its stage, the gates shut while my bout stands, the way out to the Herald), the fighters' hall.
// scenes/dungeonContext.js - WIRED: the foe yield floor, a fighter's level and no loot, the spare on my blows taken,
// and what the sand will not allow (rest, save, map). scenes/exterior.js - FLAGGED by name at ARENA2: no bout driver;
// WIRED at ARENA-FIX 12 (the driver, the city's exhibitions, the Herald, the instance, the pit - the test below holds it;
// ARENA5 corrected this header, which still said FLAGGED).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const W = rd('src/scenes/world.js'), M = rd('src/scenes/worldModes.js'), D = rd('src/scenes/dungeonContext.js'), X = rd('src/scenes/exterior.js');

test('ARENA2 hosts - world.js: one driver, ticked before the modal return, its stages the city\'s and the instance\'s', () => {
  assert.match(W, /const arenaBouts = createArenaBouts\(\{/);
  const tick = W.indexOf('    arenaFrame(dt);   // ARENA2');
  assert.ok(tick > 0);
  assert.ok(tick < W.indexOf('if (!gateScoreFrame() && !arenaScoreFrame()) musicDirector.update({'), 'ticked before the music and the modal return below it');
  assert.match(W, /if \(mode === 'dungeon'\) return modes\?\.arenaFloorStage\?\.\(\) \?\? modes\?\.arenaPitStage\?\.\(\) \?\? null;/, 'in the instance its stage (ARENA-FIX 4: in the undercroft the pit\'s)');
  assert.match(W, /if \(mode !== 'exterior' \|\| !walkMode \|\| !playerSpawned \|\| !arenaCityPixel\(\)\) return null;/);
  assert.match(W, /if \(ex\?\.open && ex\.hour !== _arenaHourRun\) \{ _arenaHourRun = ex\.hour; arenaBouts\.ask\(\{ where: 'city', kind: 'exhibition', ex \}\); \}/, 'the hour\'s bout, once an hour');
  // ARENA4b: and a relay's mirrored fighter `placed` - every screen stands its own copy, the cell's stream carries it to nobody
  assert.match(W, /spawn: \(mobile, feet, o\) => exteriorFoes\.spawnFoe\(mobile, feet, \{ yaw: o\.yaw, gender: o\.gender, level: o\.level, loose: true, transient: true, managed: true, champion: null, \.\.\.\(o\.mirror \? \{ placed: true \} : \{\}\) \}\)/);
  assert.match(W, /crime: \(\) => \{ setCrimeCommitted\(playerEntity, CRIMES\.Assault\); _crimeResponse\(\); \}/, 'the watch for a brawler, by the street\'s law');
  assert.match(W, /if \(b\.blockName === ARENA_BLOCK\) arenaOrigin = \[originMatrix\[12\], originMatrix\[13\], originMatrix\[14\]\];/);
  assert.match(W, /arena: arenaOrigin,/);
});

test('ARENA2 hosts - world.js: the crowd drawn in both passes, the music held, the duel\'s law, my ring, the doors handed the modes', () => {
  assert.match(W, /for \(const b of arenaBouts\.batches\(\)\) \{ if \(cullOn && billboardOutside\(b\)\) continue; allBatches\.push\(b\); \}/);
  assert.match(W, /\.\.\.\(\(modes\?\.mode \?\? 'exterior'\) === 'dungeon' \? arenaBouts\.batches\(\) : \[\]\)\]/);
  assert.match(W, /if \(!gateScoreFrame\(\) && !arenaScoreFrame\(\)\) musicDirector\.update\(\{/);
  assert.match(W, /for \(const song of Object\.values\(arenaScoreSongs\(\)\)\) music\.registerSong\(song\.name, song\);/);
  assert.match(W, /function duelEnemyNear\(\) \{ return !!duelMgr\?\.live \|\| arenaBouts\.holds\(\); \}/, 'no rest, no travel, no journey in my bout');
  assert.match(W, /if \(!player\.arena\) player\.arena = arenaBouts\.ring\(\);   \/\/ ARENA2/, 'online');
  assert.match(W, /if \(!player\.arena\) player\.arena = arenaBouts\.ring\(\); \/\* ARENA2/, 'and offline');
  for (const door of ['arenaHerald: () => arenaHerald(),', 'arenaPlayerSpare: () => arenaBouts.playerSpare(),', 'arenaHolds: () => arenaBouts.holds(),', 'arenaLanding: () => {']) assert.ok(W.includes(door), door);
  assert.match(W, /townTalk\.showOverlay\(new ChoiceWindow\(\{ lines: ch\.lines, options: ch\.options\.map/, 'the Herald\'s choice is a ChoiceWindow (the enhanced dialog on the Plus skin)');
  assert.match(W, /modes\?\.enterArenaFloor\?\.\('watch'\);/);
  assert.match(W, /modes\?\.enterArenaFloor\?\.\('ladder'\);/);
  assert.match(W, /else if \(a === 'hall'\) modes\?\.enterArenaUndercroft\?\.\(\);/);
});

test('ARENA2 hosts - worldModes.js: the Herald, the instance, its gates and its air, the way out before the Herald', () => {
  assert.match(M, /if \(!info && arenaGatePersonOf\(pn\)\?\.role === 'herald'\) \{ if \(!host\.arenaHerald\?\.\(\)\)/);
  // ARENA5: the blocks file is made with the bout's banners hung (test/arena5_banners.test.js pins the host's half)
  assert.match(M, /const hit = \{ dfLocation, blocksFile: arenaFloorBlocks\(blocks, kind, host\.arenaFloorBanners\?\.\(\) \?\? null\), arenaFloor: kind,/);
  assert.match(M, /if \(hit\.arenaFloor\) standArenaFloor\(ctx\);/);
  assert.match(M, /arena: hit\.arenaFloor \?\? null,/);
  assert.match(M, /if \(isArenaFloor\(dungeonLoc\)\) \{ if \(host\.arenaHolds\?\.\(\)\) \{ setMidScreenText\(ARENA_TEXT\.refuse\.door\); return true; \} return exitDungeonNow\(\); \}/, 'the gates shut while my bout stands');
  assert.match(M, /dungeonReturn\.arena \? host\.arenaLanding\?\.\(\) \?\? null/);
  assert.match(M, /playerSpare: \(\) => host\.arenaPlayerSpare\?\.\(\) \?\? null,/);
  assert.match(M, /if \(isArenaFloor\(dungeonLoc\)\) renderer\.setLighting\(new Float32Array\(ARENA_FLOOR_AMBIENT\), 0\);/);
  assert.match(M, /if \(isArenaFloor\(dungeonLoc\)\) applyFog\(renderer, dungeonFog\(!!renderer\.lightingLane, ARENA_FLOOR_FOG\)\);/);
  assert.match(M, /spawn: \(mobile, feet, o\) => ctx\.spawnLooseFoe\?\.\(mobile, \[feet\[0\], feet\[1\] \+ 0\.9, feet\[2\]\], \{ gender: o\.gender \?\? null, yawRad: o\.yaw \?\? null, level: o\.level \?\? null, bout: o\.bout \?\? null \}\)/);
  assert.match(M, /enterArenaFloor, enterArenaUndercroft, arenaFloorStage, arenaPitStage,/);
  assert.match(M, /const e = entries\.find\(\(x\) => isUndercroftDoor\(x, DOOR_TYPE\.DUNGEON_ENTRANCE\) && x\.dfLocation\?\.arenaUndercroft\);/, 'the fighters\' hall is the stair\'s own door');
});

test('ARENA2 hosts - dungeonContext.js wired (what the sand will not allow); ARENA-FIX 12: exterior.js WIRED (the FOUR HOSTS)', () => {
  assert.match(D, /if \(isArenaFloor\(dfLocation\)\) \{ hudText\.add\(ARENA_TEXT\.refuse\.rest\); return; \}/);
  assert.match(D, /if \(isArenaFloor\(dfLocation\)\) \{ if \(!quiet\) hudText\.add\(ARENA_TEXT\.refuse\.save\); return false; \}/);
  assert.match(D, /if \(isArenaFloor\(dfLocation\)\) \{ hudText\.add\(ARENA_TEXT\.refuse\.map\); return; \}/);
  assert.match(D, /savingPrevented: \(\) => isGateArena\(dfLocation\) \|\| isArenaFloor\(dfLocation\),/);
  assert.match(D, /if \(!isGateArena\(dfLocation\) && !isArenaFloor\(dfLocation\)\) sceneAmbience\.update\(dt, \{/, 'no dungeon drip on the open sand');
  assert.match(X, /\/\/ ARENA-FIX 12 \(2026-10-02\): WIRED - THE FOUR HOSTS\./);
  assert.match(X, /const arenaBouts = createArenaBouts\(\{/, 'one driver');
  assert.match(X, /arenaHerald: \(\) => arenaHerald\(\),/, 'the Herald\'s choice through the mode machine');
  assert.match(X, /arenaFrame\(dt\);[^\n]*\n\s*player\.arena = arenaBouts\.ring\(\);[^\n]*\n(?:[^\n]*\n){0,14}?\s*if \(modes\.frame\(dt, now\)\) \{/, 'ticked before the modal return (above the torch sweep that sits on it), its ring on the motor');
  assert.match(X, /for \(const b of arenaBouts\.batches\(\)\) _visBatches\.push\(b\);/, 'the crowd in the billboard pass');
  assert.match(X, /extraBillboards: \(\) => \(\(modes\?\.mode \?\? 'exterior'\) === 'dungeon' \? arenaBouts\.batches\(\) : \[\]\),/, '...and in the instance\'s');
  assert.match(X, /registerAttackResolutionListener\('arena'/, 'its misses and crits heard');
});
