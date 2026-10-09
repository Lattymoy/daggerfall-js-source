// STAFF1 (2026-09-28, Mac: "So for developer, dungeon master and the shadow fang titles I want to add teleport, debug,
// and other admin commands") - THE STAFF'S CHAT COMMANDS: /tp (a place, a map pixel, a player), /god, /fly, /heal,
// /pos, /staff, for a player whose own glyphs are `dev`, `dm` or `shadowfang`, and nobody else.
//
// Pinned here: who may (isStaff), the grammar (parseStaffCommand), the matching (findPlace, findPlayer), the two
// switches at their doors (god at the damage veto, fly at the motor-flag write), and the world host's wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isStaff, STAFF_GLYPHS, parseStaffCommand, findPlace, findPlayer, STAFF_HELP_LINES, STAFF_COMMANDS } from '../src/net/staffCommands.js';
import { GLYPHS } from '../src/net/identityToken.js';
import { playerEntity, hurtPlayer, playerDamageWithheld, setStaffPowers, staffPowers, staffFly } from '../src/characters/playerEntity.js';
import { applyMotorEffectFlags } from '../src/scenes/shared.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('STAFF1 who: the Developer\'s, the Dungeon Master\'s and Shadow Fang\'s glyphs, every one a signed glyph - and no other', () => {
  assert.deepEqual([...STAFF_GLYPHS], ['dev', 'dm', 'shadowfang']);
  for (const g of STAFF_GLYPHS) assert.ok(GLYPHS.includes(g), `${g} is a glyph the token signs`);
  assert.equal(isStaff(['sprout', 'dm']), true);
  assert.equal(isStaff(['dev']), true);
  assert.equal(isStaff(['shadowfang']), true);
  for (const g of GLYPHS.filter((x) => !STAFF_GLYPHS.includes(x))) assert.equal(isStaff([g]), false, `${g} is not staff`);
  assert.equal(isStaff([]), false);
  assert.equal(isStaff(null), false);
  assert.equal(isStaff('dev'), false, 'a list, not a word');
});

test('STAFF1 grammar: /tp takes a place, a map pixel or @player; /god and /fly flip or take on|off; the rest take nothing; any other line is not staff\'s', () => {
  assert.deepEqual(parseStaffCommand('/tp Daggerfall'), { cmd: 'tp', place: 'Daggerfall' });
  assert.deepEqual(parseStaffCommand('/TP   the   Castle  Wayrest '), { cmd: 'tp', place: 'the Castle Wayrest' });
  assert.deepEqual(parseStaffCommand('/tp 207 213'), { cmd: 'tp', px: 207, py: 213 });
  assert.deepEqual(parseStaffCommand('/tp 999 499'), { cmd: 'tp', px: 999, py: 499 });
  assert.ok('error' in parseStaffCommand('/tp 1000 10'), 'off the map');
  assert.ok('error' in parseStaffCommand('/tp 10 500'), 'off the map');
  assert.deepEqual(parseStaffCommand('/tp @Bran'), { cmd: 'tp', player: 'Bran' });
  assert.ok('error' in parseStaffCommand('/tp @'));
  assert.ok('error' in parseStaffCommand('/tp'));
  assert.deepEqual(parseStaffCommand('/tp 12'), { cmd: 'tp', place: '12' }, 'one number is a name, not half a pixel');
  assert.deepEqual(parseStaffCommand('/god'), { cmd: 'god', on: true });
  assert.deepEqual(parseStaffCommand('/god', { god: true }), { cmd: 'god', on: false }, 'a bare /god flips');
  assert.deepEqual(parseStaffCommand('/god ON', { god: true }), { cmd: 'god', on: true });
  assert.deepEqual(parseStaffCommand('/fly off', { fly: false }), { cmd: 'fly', on: false });
  assert.deepEqual(parseStaffCommand('/fly', { fly: true }), { cmd: 'fly', on: false });
  assert.ok('error' in parseStaffCommand('/fly maybe'));
  assert.ok('error' in parseStaffCommand('/god on now'));
  assert.deepEqual(parseStaffCommand('/heal'), { cmd: 'heal' });
  assert.deepEqual(parseStaffCommand('/pos'), { cmd: 'pos' });
  assert.deepEqual(parseStaffCommand('/staff'), { cmd: 'staff' });
  assert.ok('error' in parseStaffCommand('/heal me'));
  for (const line of ['/red hi', '/unstuck', 'tp Daggerfall', '/tpx 1 2', '//tp 1 2', 'hello']) assert.equal(parseStaffCommand(line), null, line);
  assert.deepEqual([...STAFF_COMMANDS], ['tp', 'god', 'fly', 'heal', 'pos', 'staff']);
  for (const c of STAFF_COMMANDS.filter((n) => n !== 'staff')) assert.ok(STAFF_HELP_LINES.some((l) => l.startsWith(`/${c} `)), `/staff lists /${c}`);
});

test('STAFF1 matching: a place by exact name, then the shortest it begins, then one it contains; a player exact, then begun', () => {
  const places = [{ name: 'Daggerfall Hollow', px: 1, py: 1 }, { name: 'Daggerfall', px: 2, py: 2 }, { name: 'Old Daggerfall Keep', px: 3, py: 3 }, { name: 'Ruins of Cosh Hall', px: 4, py: 4 }];
  assert.equal(findPlace(places, 'daggerfall').px, 2, 'exact outranks begun');
  assert.equal(findPlace(places, 'Daggerf').px, 2, 'the shortest begun');
  assert.equal(findPlace(places, 'cosh').px, 4, 'contained');
  assert.equal(findPlace(places, 'ruins of cosh-hall').px, 4, 'hyphens and case folded');
  assert.equal(findPlace(places, 'Sentinel'), null);
  assert.equal(findPlace(places, '  '), null);
  const players = [{ name: 'Brandon', px: 5 }, { name: 'Bran', px: 6 }];
  assert.equal(findPlayer(players, 'bran').px, 6, 'exact outranks begun');
  assert.equal(findPlayer(players, 'Brando').px, 5);
  assert.equal(findPlayer(players, 'Ann'), null);
});

test('STAFF1 switches: /god withholds every blow at the damage veto\'s door; /fly levitates the motor with no spell', () => {
  try {
    playerEntity.health = 40;
    setStaffPowers({ god: true });
    assert.equal(playerDamageWithheld(), true);
    assert.equal(hurtPlayer(playerEntity, 25), false);
    assert.equal(hurtPlayer(playerEntity, 25, { bypassShield: true }), false, 'the SetHealth(0) door too');
    assert.equal(playerEntity.health, 40);
    setStaffPowers({ god: false });
    assert.equal(playerDamageWithheld(), false);
    hurtPlayer(playerEntity, 5);
    assert.ok(playerEntity.health < 40, 'off, a blow lands');
    const player = { levitating: false };
    applyMotorEffectFlags(player, { activeEffects: [] });
    assert.equal(player.levitating, false);
    setStaffPowers({ fly: true });
    assert.equal(staffFly(), true);
    applyMotorEffectFlags(player, { activeEffects: [] });
    assert.equal(player.levitating, true);
    setStaffPowers({ god: 'yes' });
    assert.equal(staffPowers().god, false, 'only a boolean moves a switch');
  } finally { setStaffPowers({ god: false, fly: false }); }
});

test('STAFF1 host wiring by source: asked only of staff by the service\'s own glyphs; the switches cleared with the title; the dungeon\'s levitation ORs /fly', () => {
  const w = rd('src/scenes/world.js');
  // TESTBUILD (THE WROTHGARIAN ZONE): the host asks isStaffT, which is isStaff OR the test build's switch - so "only of
  // staff" holds while the switch ships off, and that is pinned with it. PIN MOVED: isStaff -> isStaffT, and /godmode
  // folded to /god before the parser
  assert.match(w, /\nconst TEST_GODMODE = false;\nconst isStaffT = \(g\) => TEST_GODMODE \|\| isStaff\(g\);\n/, 'TESTBUILD: the switch ships off, so isStaffT is isStaff');
  assert.match(w, /const staffCmd = isStaffT\(staffGlyphs\(\)\) \? parseStaffCommand\(text\.replace\(\/\^\\\/godmode\\b\/i, '\/god'\), staffPowers\(\)\) : null;[^\n]*\n\s*if \(staffCmd\) \{ runStaffCommand\(tabId, staffCmd\); return 'error' in staffCmd \? false : true; \}/);
  assert.ok(w.indexOf('const staffCmd = isStaffT(') < w.indexOf('const cmd = parseChatLine('), 'asked before the chat\'s own refusal');
  assert.match(w, /_staffGlyphs = Array\.isArray\(who\?\.glyphs\) \? who\.glyphs : \[\];[^\n]*\n\s*if \(!isStaffT\(_staffGlyphs\)\) setStaffPowers\(\{ god: false, fly: false \}\);/);
  assert.match(w, /const staffGlyphs = \(\) => _staffGlyphs;/);
  assert.match(w, /if \(_teleporting \|\| worldMoveBusy\(\)\) \{ say\('You cannot teleport right now\.'\); return; \}\n\s*hudFade\.smashHUDToBlack\(\);[^\n]*\n\s*teleportTo\(pick\)\.catch\(/);
  assert.match(rd('src/scenes/dungeonContext.js'), /playerLevitating: \(\) => hasActiveEffect\(playerEntity, 'levitate'\) && !levitateWarded\(\) \|\| staffFly\(\),/);   // PIN MOVED (AUDIT SD V L1): the ward holds the effect, never /fly
});
