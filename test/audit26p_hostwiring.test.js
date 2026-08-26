// AUDIT 26 (host wiring): five DFU laws that were ported correctly into
// src/systems + src/world and then never reached from a scene host. A law
// nothing calls is not ported, so these pins do not read the hosts for a
// spelling - they LIFT the wired expression out of the host source and RUN
// it against the real modules, so the assertion is about what the wiring
// does, not about how it is written.
//
// The hosts cannot be imported (they are Vite modules - `import.meta.glob`),
// which is why the extraction exists at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  discoverBuilding, undiscoverBuilding, hasDiscoveredBuilding,
} from '../src/systems/discovery.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import {
  dungeonAmbient, isSpecialAreaBlock, DUNGEON_AMBIENT, CASTLE_AMBIENT, SPECIAL_AREA_AMBIENT,
  SPECIAL_AREA_BLOCK_NAME,
} from '../src/world/dungeonLights.js';
import { AmbientEffects, EXTERIOR_AMBIENT_WAITS, presetForExterior } from '../src/systems/ambientEffects.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { tickPlayerMinutes } from '../src/systems/worldTick.js';
import { useItem, TEMPLATES, MAP_TEXT_ID } from '../src/systems/useItem.js';
import { FATIGUE_LOSS } from '../src/systems/statMods.js';
import { SKILLS } from '../src/systems/skills.js';
import { RACES } from '../src/systems/races.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const host = (f) => readFileSync(join(root, 'src/scenes', f), 'utf8');

/** The balanced `(...)` or `{...}` group that opens at or after `from`. */
function group(s, from, open = '{') {
  const close = open === '{' ? '}' : ')';
  const start = s.indexOf(open, from);
  assert.ok(start >= 0, 'no opening bracket found');
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close) { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  throw new Error('unbalanced group');
}

/** The source text at `marker`, through the balanced group it opens. */
function from(src, marker, open = '{') {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, `host source no longer contains: ${marker}`);
  return src.slice(i, src.indexOf(open, i)) + group(src, i, open);
}

/** Evaluate a lifted EXPRESSION with the named scope bound. */
const runExpr = (expr, scope) =>
  new Function(...Object.keys(scope), `return (${expr});`)(...Object.values(scope));

/** Run lifted STATEMENTS with the named scope bound. */
const runStmts = (body, scope) =>
  new Function(...Object.keys(scope), body)(...Object.values(scope));

// --------------------------------------------------------------------------
// F099 - the undiscover guards reach PlayerGPS.UndiscoverBuilding
// --------------------------------------------------------------------------

test('F099: the wired dep refuses a shop, refuses a name that is not its own, and hides its residence', () => {
  const src = host('world.js');
  const i = src.indexOf('undiscoverBuilding: (');
  assert.ok(i >= 0, 'world.js no longer wires an undiscoverBuilding dep');
  const line = src.slice(i, src.indexOf('\n', i)).replace(/^undiscoverBuilding: /, '').replace(/,\s*$/, '');

  const LOC = '17:Tinkerton';
  const dep = runExpr(line, {
    undiscoverBuilding,
    _questLoc: () => ({ regionIndex: 17, name: 'Tinkerton' }),
  });

  // A residence, named by the quest that is hiding it: gone (:1019).
  discoverBuilding(LOC, { buildingKey: 901, name: 'Cirion\'s House', buildingType: BUILDING_TYPES.House2 });
  dep(901, 'Cirion\'s House');
  assert.equal(hasDiscoveredBuilding(LOC, 901), false, 'the quest residence comes off the map');

  // onlyIfResidence (:1005-1007): a shop is not a residence, so it stays.
  discoverBuilding(LOC, { buildingKey: 902, name: 'The Odd Dog', buildingType: BUILDING_TYPES.Alchemist });
  dep(902, 'The Odd Dog');
  assert.equal(hasDiscoveredBuilding(LOC, 902), true, 'onlyIfResidence=true must reach the dep');

  // matchName (:1014-1016): the OTHER quest's name may not hide this one.
  discoverBuilding(LOC, { buildingKey: 903, name: 'Alnaya\'s House', buildingType: BUILDING_TYPES.House1 });
  dep(903, 'Cirion\'s House');
  assert.equal(hasDiscoveredBuilding(LOC, 903), true, 'the name must reach the dep too');
  dep(903, 'Alnaya\'s House');
  assert.equal(hasDiscoveredBuilding(LOC, 903), false, 'and its own name still hides it');
});

test('F099: the BANK undiscover keeps DFU\'s bare one-argument call', () => {
  // DaggerfallBankManager.cs:460 sells a house with UndiscoverBuilding(key)
  // alone - no residence gate, no name. worldModes.js must NOT grow the
  // quest arguments: a HouseForSale deed is not a House1-4 residence, and
  // onlyIfResidence would refuse to take the sold house off the map.
  const line = host('worldModes.js').match(/undiscoverBuilding: \(k\) => \{[\s\S]*?\n {12}\},/)[0];
  assert.ok(!/true/.test(line), 'the bank arm passes the key alone');

  const LOC = '4:Daggerfall';
  discoverBuilding(LOC, { buildingKey: 77, name: 'Selby\'s residence', buildingType: BUILDING_TYPES.HouseForSale });
  const dep = runExpr(line.replace(/^undiscoverBuilding: /, '').replace(/,\s*$/, ''), {
    undiscoverBuilding, discoveryLocationId: () => LOC,
  });
  dep(77);
  assert.equal(hasDiscoveredBuilding(LOC, 77), false, 'a sold HouseForSale still comes off the map');
});

// --------------------------------------------------------------------------
// F183 - the castle / special-area ambient
// --------------------------------------------------------------------------

const ambientCases = (expr, ctxName) => {
  const at = (inCastle, inSpecialArea) => [...runExpr(expr, {
    dungeonAmbient, Float32Array,
    [ctxName]: { inCastle, inSpecialArea },
  })];
  return at;
};

test('F183: both dungeon hosts light a castle block and the treasure room at 0.58', () => {
  // PlayerAmbientLight.UpdateAmbientLight (:84-92):
  //     if (IsPlayerInsideDungeonCastle) targetAmbientLight = CastleAmbientLight;
  //     else if (IsPlayerInsideSpecialArea) targetAmbientLight = SpecialAreaLight;
  //     else targetAmbientLight = DungeonAmbientLight * scale;
  for (const [file, ctxName] of [['worldModes.js', 'dungeonCtx'], ['dungeon.js', 'ctx']]) {
    const expr = from(host(file), 'new Float32Array(dungeonAmbient(', '(');
    const at = ambientCases(expr, ctxName);
    // The host uploads a Float32Array, so the DFU literals are compared at
    // the same precision the renderer receives.
    const f32 = (v) => [...new Float32Array(v)];
    assert.deepEqual(at(true, false), f32(CASTLE_AMBIENT), `${file}: a castle block lights at CastleAmbientLight`);
    assert.deepEqual(at(false, true), f32(SPECIAL_AREA_AMBIENT), `${file}: the treasure room lights at SpecialAreaLight`);
    assert.deepEqual(at(false, false), f32(DUNGEON_AMBIENT), `${file}: the dungeon floor keeps 0.12`);
    // The 0.58 is not the 0.12 - the pin would pass on a flat host otherwise.
    assert.notDeepEqual(f32(CASTLE_AMBIENT), f32(DUNGEON_AMBIENT));
    // Branch ORDER: a castle block that is also special still takes Castle.
    assert.deepEqual(at(true, true), f32(CASTLE_AMBIENT), `${file}: the castle arm is first`);
  }
});

test('F183: dungeonContext\'s block predicates answer for the block the player stands in', () => {
  // PlayerEnterExit.cs:338 (isPlayerInsideDungeonCastle = block.CastleBlock)
  // and SpecialAreaCheck (:1221-1237, the one treasure-room block name).
  const src = host('dungeonContext.js');
  const scope = {
    dungeon: {
      blocks: [
        { originX: 0, originZ: 0, name: 'N0000001.RDB', layout: { castleBlock: false } },
        { originX: 2048, originZ: 0, name: 'N0000002.RDB', layout: { castleBlock: true } },
        { originX: 0, originZ: 2048, name: SPECIAL_AREA_BLOCK_NAME, layout: { castleBlock: false } },
      ],
    },
    RDB_SIDE: 2048,
    isSpecialAreaBlock,
  };
  const castleAt = runExpr(`(${from(src, 'function castleBlockAt(')})`, scope);
  const specialAt = runExpr(`(${from(src, 'function specialAreaBlockAt(')})`, scope);

  assert.equal(castleAt(100, 100), false);
  assert.equal(castleAt(2100, 100), true, 'the castle block reads CastleBlock');
  assert.equal(specialAt(100, 2100), true, 'S0000161.RDB is the special area');
  assert.equal(specialAt(100, 100), false);
  assert.equal(specialAt(2100, 100), false, 'a castle block is not automatically special');
  // Outside every block: DFU's playerBlockIndex == -1 arm (:343-346).
  assert.equal(castleAt(-1, -1), false);
  assert.equal(specialAt(-1, -1), false);
});

// --------------------------------------------------------------------------
// F088 / F089 - the exterior ambience follows the Exterior GameObject
// --------------------------------------------------------------------------

const stubEngine = () => {
  const rec = { loops: [], plays3d: [] };
  rec.engine = {
    play3d: (index, pos, vol, opts) => { rec.plays3d.push({ index, pos, opts }); return 2.0; },
    playOneShot: () => 2.0,
    loop: (index) => { const h = { index, stopped: false, stop() { this.stopped = true; } }; rec.loops.push(h); return h; },
  };
  return rec;
};

test('F088: going indoors DEACTIVATES the exterior ambient player in both exterior hosts', () => {
  // WeatherAmbientEffects is a child of the `Exterior` GameObject, and
  // EnableInteriorParent/EnableDungeonParent both run DisableAllParents,
  // whose ExteriorParent.SetActive(false) (PlayerEnterExit.cs:1048) stops
  // the component. The rain loop must not follow the player inside.
  for (const file of ['world.js', 'exterior.js']) {
    const modalBlock = from(host(file), 'if (modes.frame(dt, now)) {');
    const rec = stubEngine();
    const ambience = new AmbientEffects(EXTERIOR_AMBIENT_WAITS, rec.engine, () => 0.5);
    ambience.setPreset('rain');
    ambience.update(0.016, { playerPos: [0, 0, 0], inside: false });
    assert.equal(rec.loops.length, 1, `${file}: the rain loop is playing outside`);

    runStmts(modalBlock, {
      modes: { frame: () => true }, ambience,
      townTalk: { frame: () => {} }, requestAnimationFrame: () => {}, frame: () => {},
      dt: 0.016, now: 0,
    });
    assert.equal(ambience.active, false, `${file}: the Exterior parent is switched off`);
    assert.equal(rec.loops[0].stopped, true, `${file}: and its AudioSources stop with it`);
    // Update stops running with the object (AmbientEffectsPlayer has no
    // Update while its GameObject is inactive).
    ambience.update(0.016, { playerPos: [0, 0, 0], inside: true });
    assert.equal(rec.loops.length, 1, `${file}: no loop restarts while inactive`);
  }
});

test('F088: the exterior frame reactivates the player and reports IsPlayerInside=false', () => {
  // EnableExteriorParent (:1056-1071) switches the object back on; the
  // cemetery layer's gate is PlayerEnterExit.IsPlayerInside (:154), and a
  // frame that got past the modal return is by definition outside.
  for (const [file, posName] of [['world.js', 'cam'], ['exterior.js', 'eye']]) {
    const src = host(file);
    const a = src.indexOf('ambience.setActive(true)');
    assert.ok(a >= 0, `${file}: the exterior frame never reactivates the ambient player`);
    const u = src.indexOf('ambience.update(dt,', a);
    const body = src.slice(a, src.indexOf(';', src.indexOf('}', u)) + 1);

    const calls = [];
    const ambience = {
      active: false,
      setActive: (v) => { ambience.active = v; },
      setPreset: (p) => calls.push(['preset', p]),
      update: (dt, deps) => calls.push(['update', deps]),
    };
    runStmts(body, {
      ambience, presetForExterior, isNight: () => false, weather: 'rain',
      minute: 600, dt: 0.016, cam: { pos: [1, 2, 3] }, eye: [1, 2, 3],
    });
    assert.equal(ambience.active, true, `${file}: the Exterior parent is back on`);
    assert.deepEqual(calls[0], ['preset', 'rain'], `${file}: WeatherManager.SetAmbientEffects still runs`);
    assert.equal(calls[1][0], 'update');
    assert.equal(calls[1][1].inside, false, `${file}: the cemetery gate is fed, not defaulted`);
    assert.deepEqual(calls[1][1].playerPos, [1, 2, 3], `${file}: ...at the ${posName} position`);
  }
});

test('F089: world.js arms the cemetery layer off the location-rect crossing', () => {
  // PlayerGPS raises OnEnterLocationRect / OnExitLocationRect on the
  // true<->false crossing of the widened rect (:701-715), and
  // AmbientEffectsPlayer answers both (:518-534). Nothing armed the layer,
  // so AmbientDistantHowl / AmbientCreepyBirdCall never played at a
  // graveyard.
  const src = host('world.js');
  const i = src.indexOf('let _crimeRectKey = null;');
  const f = src.indexOf('function syncLocationRectCrime()', i);
  assert.ok(i >= 0 && f > i, 'world.js no longer tracks the rect');
  const body = src.slice(i, f) + 'function syncLocationRectCrime() ' + group(src, f);

  const build = (locationType) => {
    const rec = stubEngine();
    const ambience = new AmbientEffects(EXTERIOR_AMBIENT_WAITS, rec.engine, () => 0);
    const built = runStmts(
      'let __inRect = false; let _topicsKey = null;\n'
        + 'const _musicInLocationRect = () => __inRect;\n' + body
        + '\nreturn { sync: syncLocationRectCrime, set: (r, k) => { __inRect = r; _topicsKey = k; } };',
      {
        clearCrimeOnLocationExit: () => {}, playerEntity: {},
        ambience, _musicLocationType: () => locationType, modes: { mode: 'exterior' },
      },
    );
    return { ...built, ambience, rec };
  };

  // A graveyard rect: entering arms IsCemeteryNearby, leaving clears it.
  const g = build(LOCATION_TYPES.Graveyard);
  g.sync();
  assert.equal(g.ambience.isCemeteryNearby, false, 'standing outside every rect arms nothing');
  g.set(true, '11,22');
  g.sync();
  assert.equal(g.ambience.isCemeteryNearby, true, 'entering a Graveyard rect arms the layer');
  g.sync();
  assert.equal(g.ambience.isCemeteryNearby, true, 'standing still is not a new entry');
  g.set(false, null);
  g.sync();
  assert.equal(g.ambience.isCemeteryNearby, false, 'leaving the rect clears it');

  // Any other location type arms nothing (:525).
  const t = build(LOCATION_TYPES.TownCity);
  t.set(true, '11,22');
  t.sync();
  assert.equal(t.ambience.isCemeteryNearby, false, 'a town is not a graveyard');
});

test('F089: exterior.js arms the layer too - its one location IS the rect', () => {
  // This host loads a single location and _musicInLocationRect is constant
  // true, so PlayerGPS's enter-rect event (:701-709) has already happened
  // by the first frame - the arming is raised once at mount instead.
  const src = host('exterior.js');
  const i = src.indexOf('ambience.onEnterLocationRect(');
  assert.ok(i >= 0, 'exterior.js never arms the cemetery layer');
  const stmt = src.slice(i, src.indexOf('\n', i));

  const arm = (locationType) => {
    const rec = stubEngine();
    const ambience = new AmbientEffects(EXTERIOR_AMBIENT_WAITS, rec.engine, () => 0);
    runStmts(stmt, { ambience, _musicLocationType: () => locationType });
    return ambience;
  };
  assert.equal(arm(LOCATION_TYPES.Graveyard).isCemeteryNearby, true, 'a graveyard arms it');
  assert.equal(arm(LOCATION_TYPES.TownCity).isCemeteryNearby, false, 'a town does not');
});

test('F089: an armed cemetery layer actually plays its three clips outside', () => {
  // End to end through the real component: the wired arming plus the
  // exterior frame's `inside: false` is what lets the 1/80-second cemetery
  // window fire PlaySomewhereAround (:154-162, :308-320).
  const rec = stubEngine();
  const ambience = new AmbientEffects(EXTERIOR_AMBIENT_WAITS, rec.engine, () => 0);
  ambience.onEnterLocationRect(LOCATION_TYPES.Graveyard, { inside: false });
  ambience.update(2, { playerPos: [0, 0, 0], inside: false });
  assert.equal(rec.plays3d.length, 1, 'the cemetery one-shot fires');
  assert.equal(rec.plays3d[0].index, 113, 'AmbientDistantHowl at roll 0');
  // ...and the same layer is silent for a host that reports inside.
  const rec2 = stubEngine();
  const inside = new AmbientEffects(EXTERIOR_AMBIENT_WAITS, rec2.engine, () => 0);
  inside.onEnterLocationRect(LOCATION_TYPES.Graveyard, { inside: false });
  inside.update(2, { playerPos: [0, 0, 0], inside: true });
  assert.equal(rec2.plays3d.length, 0, 'IsPlayerInside gates it (:154)');
});

test('F089: the dungeon ambient player states IsPlayerInside rather than defaulting it', () => {
  // PlayerEnterExit.IsPlayerInside is TRUE underground (EnableDungeonParent
  // :1106), and the DUNGEON instance of AmbientEffectsPlayer is the one
  // whose cemetery guard is live in DFU.
  const deps = from(host('dungeonContext.js'), 'sceneAmbience.update(dt, {');
  const obj = runExpr('(' + deps.slice(deps.indexOf('{')) + ')', {
    playerFeet: [0, 0, 0], playerHeight: 1.8, _surf: null,
    castleBlockAt: () => false,
  });
  assert.equal(obj.inside, true, 'the dungeon instance reports inside');
});

// --------------------------------------------------------------------------
// F083 - climbing fatigue reaches the per-minute band from every host
// --------------------------------------------------------------------------

/** A climbing player whose Run key is also held, in the water. If the host
 *  drops `climbing`, the band falls through to Running (88) or Swimming. */
const climbingPlayer = () => ({
  climb: { isClimbing: true }, isRunning: true, standing: false,
  swimming: true, jumped: false, movingLessThanHalfSpeed: false, landedFallDistance: 0,
});

const entity = () => ({
  health: 500, maxHealth: 500, fatigue: 100000, magicka: 200, level: 1,
  raceId: RACES.Breton, skills: { [SKILLS.Swimming]: 20 }, skillUses: {},
});

/** What the per-minute band charges for one host's activity object. */
function chargedFor(activity) {
  let paid = 0;
  tickPlayerMinutes({
    entity: entity(), classicMinutes: 0, dt: 5, activity, rolls: () => 0.99,
    sinks: { drainFatigue: (n) => { paid += n; }, hurt: () => {}, heal: () => {} },
  });
  return paid;
}

/** Lift the activity object literal a host passes to `marker`. */
function activityAt(file, marker) {
  const src = host(file);
  const i = src.indexOf(marker);
  assert.ok(i >= 0, `${file}: no longer calls ${marker}`);
  const obj = group(src, i);
  return runExpr(`(${obj})`, {
    player: climbingPlayer(), keys: new Set(['Run']), held: () => true, moving: true,
  });
}

test('F083: every host that feeds the per-minute band reports ClimbingMotor.IsClimbing', () => {
  // PlayerEntity.cs:405-407 leads the band with the climbing arm at
  // ClimbingFatigueLoss (22, :110) and short-circuits both the running arm
  // and the Swimming Dice100. No host fed activity.climbing, so a climb
  // could only ever bill 11 - or 88 with the Run key held, which is how
  // most climbs are made.
  const sites = [
    ['world.js', 'playerTicker.tick(dt * timeScaleMult, {'],
    ['exterior.js', 'playerTicker.tick(dt * timeScaleMult, {'],
    ['worldModes.js', 'interiorTicker.tick(dt, {'],
    ['worldModes.js', 'dungeonCtx.reportActivity?.({'],
    ['dungeon.js', 'ctx.reportActivity?.({'],
  ];
  for (const [file, marker] of sites) {
    const activity = activityAt(file, marker);
    assert.equal(activity.climbing, true, `${file} @ ${marker}: the climb flag is reported`);
    assert.equal(chargedFor(activity), FATIGUE_LOSS.Climbing,
      `${file} @ ${marker}: a climb costs 22, not ${FATIGUE_LOSS.Running}`);
  }
});

test('F083: a host that is not climbing still bills the arm below it', () => {
  // The wiring must READ the motor, not hardcode the flag.
  const src = host('world.js');
  const i = src.indexOf('playerTicker.tick(dt * timeScaleMult, {');
  const obj = group(src, i);
  const activity = runExpr(`(${obj})`, {
    player: { ...climbingPlayer(), climb: { isClimbing: false }, swimming: false },
    keys: new Set(), held: () => false, moving: false,
  });
  assert.equal(activity.climbing, false);
  assert.equal(chargedFor(activity), FATIGUE_LOSS.Running, 'the running arm is still reachable');
});

test('F083: dungeonContext carries the flag from reportActivity into the band\'s activity', () => {
  const src = host('dungeonContext.js');
  const literal = runExpr('(' + group(src, src.indexOf('const _activity = {')) + ')', {});
  assert.ok('climbing' in literal, 'the activity object the band reads has a climbing column');
  assert.equal(literal.climbing, false, 'and starts false, like ClimbingMotor');

  const r = src.indexOf('reportActivity({');
  const open = src.indexOf('= {}) {', r) + '= {}) '.length;   // the method BODY's brace
  assert.ok(r >= 0 && open > r, 'dungeonContext no longer exposes reportActivity');
  const method = src.slice(r, open) + group(src, open);
  const report = runExpr(`({ ${method} }).reportActivity`, {
    _activity: literal, audio: { playOneShot: () => {} }, SOUND: { SplashLarge: 0 },
    applyFallLanding: () => {}, playerEntity: {}, hurtPlayer: () => {},
  });

  report({ climbing: true, running: true, swimming: true });
  assert.equal(literal.climbing, true, 'the host-fed flag lands on the band\'s activity');
  assert.equal(chargedFor(literal), FATIGUE_LOSS.Climbing, 'and the band charges 22');
  report({});
  assert.equal(literal.climbing, false, 'and clears with the motor');
});

// --------------------------------------------------------------------------
// The trade window's MAP arm (ui-crafting wave hand-off) - staging a map
// through TransferItem must REVEAL and CONSUME it
// --------------------------------------------------------------------------

test('trade: openTradeWindow hands the window the host\'s reveal door, and a staged map is read and eaten', () => {
  // DaggerfallTradeWindow EXTENDS the inventory window and stages through
  // the same TransferItem (:795), whose MAP arm (:1471-1478) runs
  // RecordLocationFromMap and removes the item - a map never reaches the
  // other side of the trade. nativeTrade reads that through `revealMap`,
  // and worldModes is the ONLY host that mounts this window.
  const src = host('worldModes.js');
  const i = src.indexOf('revealMap:', src.indexOf('function openTradeWindow('));
  assert.ok(i >= 0 && i < src.indexOf('function commitTrade('),
    'openTradeWindow no longer passes a revealMap hook');
  const expr = src.slice(i + 'revealMap:'.length, src.indexOf('\n', i)).replace(/,\s*$/, '').trim();

  // A host WITH a region to walk: the map is read and consumed.
  const asked = [];
  const hook = runExpr(expr, { host: { revealLocation: (k) => { asked.push(k); return 'Wayrest'; } } });
  const map = { group: 'Maps', templateIndex: TEMPLATES.Map };
  const pack = [map];
  const out = useItem(map, pack, { revealMap: hook });
  assert.deepEqual(asked, ['readMap'], 'through the ONE reveal door, under DFU\'s own note key');
  assert.deepEqual(out, { kind: 'map', textId: MAP_TEXT_ID, revealed: 'Wayrest' });
  assert.deepEqual(pack, [], 'RemoveItem (:1745) - the map is consumed');

  // A host with NO reveal seam answers null, and useItem's recorded safe
  // arm leaves the map unread AND uneaten rather than claiming a reveal.
  const bare = runExpr(expr, { host: {} });
  assert.equal(bare, null, 'a host without a region index passes null, not a hook that lies');
  const pack2 = [map];
  assert.deepEqual(useItem(map, pack2, { revealMap: bare }), { kind: 'map', pending: true });
  assert.deepEqual(pack2, [map], 'and the map stays in the pack');
});
