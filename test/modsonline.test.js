// MODS-ONLINE-2 (2026-09-22, Mac: "Is it possible to allow all mods to
// be toggled on and off for online?" and then, of the first answer,
// "So all mods can now be toggled?").
//
// NOW THEY CAN. MODS-ONLINE freed eight mods and left eight forced
// because they sounded like world state; this pin holds the reading
// that freed the other eight, and the one thing that stayed.
//
// THE READING. A room desyncs when two machines apply different RULES
// to one shared thing. The port does not work that way: everywhere a
// mod could disagree, the answer is computed by the machine that OWNS
// the actor and crosses the wire as a RESULT.
//
//   - the striker rolls the damage and the host applies the number
//     without recomputing (dungeonContext applyHit), so PCAAO's
//     formulas were never shared to begin with;
//   - a foe's stats are minted where it SPAWNS and a peer steps a
//     puppet, so Meaner Monsters is already the owner's;
//   - a corpse's pile is rolled and granted by the owner's word
//     (WORLD6b-iii(c)), so Unleveled Loot is the owner's;
//   - a blow is mitigated where it LANDS - damageShieldPool inside
//     damageFoe for a foe, inside hurtPlayer for me - so the Shield
//     Widget's block is always the defender's own;
//   - Oblivion leveling is written into a character at creation,
//     Handheld Torches is an item in my save with a light on my
//     screen, Travel Options is my own journey.
//
// ONE THING IS NOT A RULE - IT IS THE FLOOR. Basic Roads rewrites
// TERRAIN HEIGHTS (terrainGen calls smoothRoadHeights over the beds),
// so `Enabled` (whose network is painted) and `SmoothRoads` (whether
// the beds are smoothed at all) decide where the ground IS. Two
// players who disagree stand on two floors along every road in the
// Bay. `RiversAndStreams` does NOT: it paints tiles the smoother
// never looks at, and the third test here MEASURES that rather than
// asserting it.
//
// AND THE OLD LANE HAD THIS BACKWARDS. It forced `Enabled` and left
// `SmoothRoads` - a DIAL - to the player, so the heights have been
// diverging online since the lane was written, for anyone who turned
// the smoothing off for the "minor extra performance" its own
// description offers. The table is by KEY now, which is what makes
// that fixable at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOD_SETTINGS, modSetting, setModSetting, modSettingIfDeclared } from '../src/systems/modSettings.js';
import { ONLINE_PLAYERS_OWN_MODS, ONLINE_ROOM_MOD_KEYS, onlineForcedModSetting, onlineForcedPref, ONLINE_PLAYERS_OWN_PREFS } from '../src/systems/onlineLane.js';
import { runSurvivalMinutes } from '../src/systems/survival/needs.js';   // MODS-ONLINE-3: the needs run, measured
import { FEATURES } from '../src/systems/features.js';   // MODS-ONLINE-3: the rows a player sees as mods, whichever store carries them
import { smoothRoadHeights, SMOOTHED_TILES, ROAD_TILES, RIVER_TILES, STREAM_TILES, TRACK_TILES } from '../src/world/roadPainter.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (f) => readFileSync(join(ROOT, f), 'utf8');

test('MODS-ONLINE-2: every vendored mod is classified, and the only keys the lane forces are a mod\'s own declared ones', () => {
  const all = Object.keys(MOD_SETTINGS).sort();
  const classified = [...Object.keys(ONLINE_ROOM_MOD_KEYS), ...ONLINE_PLAYERS_OWN_MODS].sort();

  assert.deepEqual(all.filter((m) => !classified.includes(m)), [],
    'a new mod must be decided: does the room\'s GROUND depend on one of its switches, or is every switch the player\'s?');
  assert.deepEqual(ONLINE_PLAYERS_OWN_MODS.filter((m) => m in ONLINE_ROOM_MOD_KEYS), [],
    'a mod whose every switch is the player\'s cannot also own a forced key');
  assert.deepEqual(classified.filter((m) => !all.includes(m)), [],
    'a classification for a mod that does not exist is dead weight');

  // A forced key must be a key the mod actually declares, forced to the
  // value the mod itself ships - the room's floor is the mod's own
  // floor, not a number invented here.
  for (const [vendor, keys] of Object.entries(ONLINE_ROOM_MOD_KEYS)) {
    for (const [key, value] of Object.entries(keys)) {
      const def = MOD_SETTINGS[vendor]?.keys?.[key];
      assert.ok(def, `${vendor}/${key} is a declared switch`);
      assert.equal(value, def.default, `${vendor}/${key} is forced to the mod's own shipped default`);
    }
  }
});

test('MODS-ONLINE-4: every mod switch is the player\'s online, except the twenty-one the room owns', () => {
  for (const [vendor, def] of Object.entries(MOD_SETTINGS)) {
    for (const key of Object.keys(def.keys)) {
      const room = ONLINE_ROOM_MOD_KEYS[vendor] && Object.hasOwn(ONLINE_ROOM_MOD_KEYS[vendor], key);
      assert.equal(onlineForcedModSetting(vendor, key, '?online=1'), room ? ONLINE_ROOM_MOD_KEYS[vendor][key] : undefined,
        `${vendor}/${key} online is ${room ? 'the room\'s ground' : 'the player\'s'}`);
      assert.equal(onlineForcedModSetting(vendor, key, ''), undefined,
        `${vendor}/${key} offline is always the player's`);
    }
  }
  // The whole shelf, counted, so a mod quietly re-forced shows up as a
  // number rather than as a player's complaint.
  const forced = Object.values(ONLINE_ROOM_MOD_KEYS).reduce((n, keys) => n + Object.keys(keys).length, 0);
  assert.equal(forced, 21, 'the lane forces twenty-one mod switches in the whole shelf');   // DS1: Detailed Ships' Enabled, the ships' shared deck   // MODS-ONLINE-5: one ruleset per room - RR's six combat overrides and its intensive training   // RRI1/RR1 (merged 2026-09-23): five of Roleplay & Realism: Items' (the items that change hands) and two of Roleplay & Realism's (the location, the host's foes)   // WOD1: World of Daggerfall's Enabled, the second floor
  // MODS-ONLINE-4 (Mac: "What about player balance?"): the two GROUND
  // switches, and the three that spend somebody else's evening - the
  // host's dungeon foes (meaner monsters, the overhaul) and a roll that
  // leaves the roller's hands (unleveled loot). WOD1: and a third ground
  // switch, World of Daggerfall's, which levels camp sites into the same
  // terrain the road beds are smoothed into.
  assert.deepEqual(Object.keys(ONLINE_ROOM_MOD_KEYS).sort(),
    ['detailed-ships', 'meanerMonsters', 'pcaao', 'roads-hazelnut', 'roleplay-realism', 'roleplay-realism-items', 'unleveledLoot', 'world-of-daggerfall']);
  assert.equal(ONLINE_PLAYERS_OWN_MODS.length, Object.keys(MOD_SETTINGS).length - 8);
});

test('MODS-ONLINE-2: a declared key is an OWN key - the lane and the store both refuse a name off Object.prototype', () => {
  // The survivor of tools/mutants/modsonline1.json found this. Drop
  // `Object.hasOwn` from onlineForcedModSetting and `room['toString']`
  // is a FUNCTION - handed back as a forced setting value - so the
  // guard is not decoration. Nothing in the port asks for these names
  // today; a vendor or key that ever arrives from data would.
  for (const name of ['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__']) {
    assert.equal(onlineForcedModSetting('roads-hazelnut', name, '?online=1'), undefined,
      `${name} is not a switch the room's ground depends on`);
    assert.throws(() => modSetting('roads-hazelnut', name), /is not a declared switch/,
      `${name} is not a declared switch`);
    assert.throws(() => setModSetting('roads-hazelnut', name, true), /is not a declared switch/,
      `${name} cannot be written either`);
    assert.equal(modSettingIfDeclared('roads-hazelnut', name), undefined, `${name} reads as undeclared across mods`);
    assert.throws(() => modSetting(name, 'Enabled'), /is not a declared switch/, `${name} is not a vendor either`);
  }
  // ...and the real switches still answer, so the guard did not close the door on them.
  assert.equal(modSetting('roads-hazelnut', 'SmoothRoads'), true);
  assert.equal(onlineForcedModSetting('roads-hazelnut', 'SmoothRoads', '?online=1'), true);
});

test('MODS-ONLINE-2 by execution: the smoothing MOVES the ground and rivers do not - which is why one is forced and the other is free', () => {
  // The claim the whole classification rests on, measured on the real
  // smoother rather than argued in a comment above it.
  const hDim = 129, tDim = 128;
  const flat = () => Float32Array.from({ length: hDim * hDim }, (_, i) => (i % 7) * 3);   // a ground with relief, so an average can move it
  const map = (tile) => { const t = new Uint8Array(tDim * tDim); for (let y = 20; y < 100; y++) t[y * tDim + 64] = tile; return t; };

  // A ROAD BED: the smoother finds it and the heights move.
  const road = flat();
  const roadTouched = smoothRoadHeights(road, map(ROAD_TILES[0][0]), hDim, null);
  assert.ok(roadTouched > 0, 'a road bed is smoothed');
  assert.notDeepEqual(Array.from(road), Array.from(flat()), 'SmoothRoads on and off are two different floors');

  // RIVERS AND STREAMS: every tile either table can write, and the
  // smoother touches none of them - so the dial is paint, not ground.
  const waterTiles = [...new Set([...RIVER_TILES, ...STREAM_TILES].flatMap((r) => r ?? []))].filter((t) => t !== 0);
  assert.ok(waterTiles.length >= 9, 'the water tables were read');
  for (const tile of waterTiles) {
    const s = flat();
    assert.equal(smoothRoadHeights(s, map(tile), hDim, null), 0, `water tile ${tile} moves no height`);
    assert.deepEqual(Array.from(s), Array.from(flat()), `water tile ${tile} leaves the floor alone`);
  }
  // And the reason: the smoother's own set names the road bed and
  // nothing the water tables can write.
  for (const tile of waterTiles) assert.ok(!SMOOTHED_TILES.has(tile), `${tile} is not a smoothed tile`);
  const trackTiles = [...new Set(TRACK_TILES.flatMap((r) => r ?? []))];
  assert.ok([...SMOOTHED_TILES].some((t) => ROAD_TILES.some((r) => r?.includes(t))),
    'the smoothed set is the ROAD table\'s');
  assert.ok(!trackTiles.some((t) => SMOOTHED_TILES.has(t)), 'and not a track\'s');
});

test('MODS-ONLINE-2 by source: the port resolves each freed mod where the actor lives, so nothing of it crosses as a rule', () => {
  // THE READING, held where it lives. If any of these four doors ever
  // starts trusting the RECEIVER's rules instead of the sender's
  // number, the mod above it stops being safe to toggle and this fails
  // before a player finds it as two worlds.
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /const i = data\.i \| 0, dmg = Number\(data\.dmg\);/, 'PCAAO: the peer\'s damage NUMBER is what arrives');
  assert.match(dc.replace(/\n\s*\/\/ /g, ' '), /The number is a peer's word and the host trusts it without recomputing/,
    '...and the host does not re-roll it under its own formulas');
  assert.match(dc, /const healthDamage = bypassShield \? damage : damageShieldPool\(foe\.entity, damage\);/, 'Shield Widget: a foe\'s block is the foe owner\'s');
  const pe = rd('src/characters/playerEntity.js');
  assert.match(pe, /export function hurtPlayer\(entity, dmg, \{ bypassShield = false, spare = null \} = \{\}\) \{/, 'Shield Widget: and my block is mine');   // DUEL1: `spare`, the duel's floor
  assert.match(pe, /if \(!bypassShield\) \{/, '...mitigated here, where the blow lands');
  assert.match(rd('src/characters/meanerMonsters.js'), /export const meanerMonstersEnabled = /, 'Meaner Monsters: read where an entity is MADE');
  assert.match(rd('src/systems/oblivionLeveling.js'), /export const ORL_VENDOR = 'oblivion-remaster-leveling';/, 'Oblivion leveling: a character\'s own system');

  // And the one that is not a rule: the lane forces it, the terrain
  // reads it, and the smoother is the reason.
  assert.match(rd('src/world/terrainGen.js'), /if \(roads\.smooth !== false\) smoothRoadHeights\(samples, tilemap, 129, hasLocation \? locationRect : null\);/,
    'the smoothing is what SmoothRoads decides, and it writes the heights');
  assert.match(rd('src/scenes/world.js'), /const roadSwitches = \{ smooth: modSetting\('roads-hazelnut', 'SmoothRoads'\), water: modSetting\('roads-hazelnut', 'RiversAndStreams'\) \};/,
    'and the world reads it through modSetting, which is where the lane answers');
});

test('MODS-ONLINE-2: the lock, the pane and the door all say the same true thing', () => {
  const menu = rd('src/ui/enhancedMenu.js');
  // A lock that gives the wrong reason is as bad as no reason: the two
  // road rows are not locked because "online is the enhanced lane".
  assert.match(menu, /const ONLINE_GROUND_NOTE = '[^']*same ground[^']*';/, 'the ground lock has its own words');
  assert.match(menu, /const ground = onlineForcedModSetting\(vendor, key\);/);
  // MODS-ONLINE-4: the three balance switches are not locked for the
  // GROUND's reason, so they do not wear the ground's words.
  assert.match(menu, /const ONLINE_SHARED_NOTE = '[^']*belong to whoever is hosting it[^']*';/, 'the shared lock has its own words');
  assert.match(menu, /if \(ground !== undefined\) lockOnline\(b, null, \{ note: onlineLockNote\(vendor, key\), value: ground \}\);/);
  // WOD1: the ground's words go to the two vendors that write terrain heights, and only them. DS1: and the ships' shared deck.
  assert.match(menu, /const ONLINE_GROUND_VENDORS = Object\.freeze\(\['roads-hazelnut', 'world-of-daggerfall', 'detailed-ships'\]\);/);
  // MODS-ONLINE-5: the ruleset's reason is its own words, and only RR's seven wear them
  assert.match(menu, /const ONLINE_RULESET_NOTE = '[^']*one ruleset[^']*';/, 'the ruleset lock has its own words');
  assert.match(menu, /const onlineLockNote = \(vendor, key\) => \(ONLINE_GROUND_VENDORS\.includes\(vendor\) \? ONLINE_GROUND_NOTE : ONLINE_RULESET_KEYS\[vendor\]\?\.includes\(key\) \? ONLINE_RULESET_NOTE : ONLINE_SHARED_NOTE\);/);
  assert.match(menu, /if \(isOnlinePage\(\)\) body\.append\(el\('p', 'meta', ONLINE_MODS_NOTE\)\);/, 'the Mods pane says what is true of MODS');
  // The Online pane's own sentence claimed every mod was on for
  // everyone. A player reading that and then toggling one would be
  // reading a lie the port no longer tells.
  assert.ok(!/every enhancement and every mod is on for everyone/.test(menu), 'the old claim is gone');
  assert.match(menu, /Most of your mods stay yours - turn them on or off online as you like\. Six switches are the room/, 'the door says what is true');
});

test('MODS-ONLINE-2: a mod the player owns reaches no wire, no save and no roll', () => {
  // Held by execution rather than by the note above it: a player's mod
  // whose own modules start putting something on the wire, writing a
  // save record or drawing from a shared roll fails here before a
  // player finds it as two worlds.
  const OWN_MODULES = {
    'dynamic-skies': ['src/systems/dynamicSkies.js'],
    'seasons-iliac-bay': ['src/systems/seasonsIliacBay.js'],
    'weapon-widget': ['src/combat/weaponWidgetMotion.js'],
    'eye-of-the-beholder': ['src/player/eotbBody.js', 'src/player/eotbCamera.js'],
    'ambient-text': ['src/systems/ambientText.js'],
    'immersive-footsteps': ['src/systems/immersiveFootsteps.js'],
    'better-ambience': ['src/systems/betterAmbience.js'],
    'shield-widget': ['src/combat/shieldWidget.js'],
    'oblivion-remaster-leveling': ['src/systems/oblivionLeveling.js'],
    'handheld-torches': ['src/systems/handheldTorches.js'],
  };
  const BANNED = /\bsendWorld\b|\bsendAct\b|from '\.\.\/net\/|getSaveData|restoreSaveData|snapshotPlayer/;

  for (const [vendor, files] of Object.entries(OWN_MODULES)) {
    assert.ok(ONLINE_PLAYERS_OWN_MODS.includes(vendor), `${vendor} is on the player's list`);
    for (const f of files) {
      const src = rd(f).split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
      assert.ok(!BANNED.test(src), `${f} is a player's mod and must not reach the wire or the save`);
    }
  }
});

// ── MODS-ONLINE-3 (2026-09-22, Mac) ──────────────────────────────────
// "What part of mod toggle for online do you not understand?"
//
// The right question. MODS-ONLINE-2 freed the sixteen VENDORED mods and
// stopped there, because two more rows the player sees as mods are
// carried on the PREFS shelf instead of the mod store - a distinction
// that exists nowhere a player can see it. Both sat in the Mods pane,
// under their authors' names, beside sixteen rows that were all free,
// and both were still locked online:
//
//   - Climates & Calories (`survival`). The port's own code built from
//     Ralzar's IL, which is why it was on the prefs shelf. Everything it
//     computes is resolved on the machine that owns the actor: hunger,
//     thirst, exposure and the felt temperature are minted fresh each
//     tick from MY climate, MY clothes and MY race onto MY entity; a
//     camp is local (the braziers are scenery the terrain carries
//     either way); a shop's stock is its own. The one thing that leaves
//     the machine is a corpse's food, minted by the KILLER - and a
//     corpse's pile is ALREADY the owner's word, granted to peers as it
//     stands (WORLD6b-iii(c)). That is Unleveled Loot's shape exactly,
//     and Unleveled Loot is the player's.
//   - Weapon Sheathing (`mwSheathing`). Forced "so every body a peer
//     sees wears its blade the same way" - a claim about how MY machine
//     DRAWS someone else, which is `peerClassSprites`'s category and has
//     always been the player's.
//
// What is still forced is `enhancedEnvironments`, and deliberately: it
// is the port's own enhanced outdoors (OL1's half of the lane, which
// Mac has not revoked), and it carries the shared weather's evolution.
// It wears a `mod` kind only because Dynamic Skies opens its knobs on
// that tile - and Dynamic Skies itself is the player's.
test('MODS-ONLINE-3: every row a player sees as a MOD is theirs online, whichever store carries it', () => {
  const locked = FEATURES
    .filter((r) => r.kinds?.includes('mod') && r.control)
    .filter((r) => onlineForcedPref(r.control.key, '?online=1') !== undefined)
    .map((r) => r.control.key);
  // The one exception is named, so freeing it is a decision somebody
  // makes rather than a list quietly growing back.
  assert.deepEqual(locked, ['enhancedEnvironments'],
    'a mod row the lane forces must be the port\'s own enhanced lane and nothing else');

  for (const key of ['survival', 'mwSheathing']) {
    assert.equal(onlineForcedPref(key, '?online=1'), undefined, `${key} is the player's online`);
    assert.ok(ONLINE_PLAYERS_OWN_PREFS.includes(key), `${key} is declared the player's BY NAME, not by omission`);
  }
});

test('MODS-ONLINE-3 by execution: the survival system writes only its own entity, so two players may disagree about it', () => {
  // The claim that freed it, measured. Needs are computed onto the
  // entity handed in and nowhere else, so one player's switch cannot
  // reach another player's character.
  const body = () => ({ health: 50, maxHealth: 50, level: 1, stats: { endurance: 50, luck: 50, strength: 50 }, items: [] });
  const mine = body(), theirs = body();
  const before = JSON.stringify(theirs);
  const env = { climate: 223, month: 11, hour: 3, weather: 'snow', outside: true };
  runSurvivalMinutes(mine, 0, 600, env, { rolls: () => 0.5, autoDrink: false, autoEat: false });
  assert.equal(JSON.stringify(theirs), before, 'my needs never touched the other player\'s entity');
  assert.notEqual(JSON.stringify(mine), JSON.stringify(body()), 'and they really did land on mine');
});

test('MODS-ONLINE-5: one ruleset per room - the reason PCAAO is forced whole forces RR\'s six combat overrides the same way, and intensive training is forced OFF because the shared clock would hand its +4 out for free', () => {
  const rr = ONLINE_ROOM_MOD_KEYS['roleplay-realism'];
  for (const k of ['advancedArchery', 'weaponSpeed', 'weaponMaterials', 'equipDamage', 'encumbranceEffects']) assert.equal(onlineForcedModSetting('roleplay-realism', k, '?online=1'), true, `${k} is the room's, at the mod's own default`);
  assert.equal(onlineForcedModSetting('roleplay-realism', 'classicStrengthDamageBonus', '?online=1'), false, 'the classic bonus ships off and stays off');
  assert.equal(onlineForcedModSetting('roleplay-realism', 'RefinedTraining.intensiveTraining', '?online=1'), false, 'CLOCK-REFUSAL: the four days would not pass');
  for (const k of ['bandaging', 'climbingRestriction', 'loanAmountPerLevel', 'shipPorts', 'bedSleeping', 'underworldExpulsion', 'EnhancedRiding.TrampleCivilians', 'RefinedTraining.variableTrainingPrice']) assert.equal(onlineForcedModSetting('roleplay-realism', k, '?online=1'), undefined, `${k} stays the player's - it reaches nobody`);
  assert.equal(Object.keys(rr).length, 9);
  assert.equal(Object.keys(ONLINE_ROOM_MOD_KEYS.pcaao).length, 1, 'PCAAO is forced whole through its one switch - the precedent');
  assert.match(rd('src/systems/onlineLane.js'), /ONE RULESET PER ROOM\. PCAAO was forced\s+\/\/ whole/);
});
