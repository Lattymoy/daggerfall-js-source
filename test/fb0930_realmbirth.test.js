// FIELD BUGS 2026-09-30 (REALM-BIRTH) - "Crashing in the first dungeon after online character creation": "Was trying to
// make an online character and was just about to save it, when the game crashed to the main menu." Then: "I tried a new
// online character and it crashed again, It did save both characters though and afterwards I could load them and play
// them fine. I use the browser version."
//
// Nothing crashed. A character born online is made at the service once chargen is done, saved there at sequence 1, and
// booted from the realm by a reload (scenes/world.js realmBirth). That reload's address was systems/realmSaves.js
// realmBootSearch's `?online&load&realm=<id>`, and main.js boots a game only for a scene door (`interior`, `dungeon`,
// `world`, `exterior`/`region`/`loc`, `shot`/`nomenu`). With none of them the address fell to the front door, which
// clears every boot door key off it, the realm id with them, and shows the menu. The make and the save had landed, so
// the Online door's Play booted the same character fine. Now the birth's address carries the Online door's own boot -
// the classic start and the world host's scene door beside the realm's three keys.
//
// Everything here runs the source's own text: main.js's scene doors and its front door's decisions, and world.js's
// birth address, realm join and load arm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { realmBootSearch } from '../src/systems/realmSaves.js';
import { BOOT_DOOR_KEYS, publishBootParams } from '../src/systems/onlineLane.js';
import { testStartsOutdoors } from '../src/systems/testRoom.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MAIN = src('src/main.js');
const W = src('src/scenes/world.js');
const AsyncFunction = (async () => {}).constructor;
const ID = 'r' + 'k'.repeat(20);

/** main.js's router over an address: its scene doors in order, lifted off the boot above THE FRONT DOOR; anything no
 *  door takes is the front door's, which clears every boot door key before the menu decides them. */
function route(search) {
  const from = MAIN.indexOf('renderer.setWindowEmission(');
  const to = MAIN.indexOf('// ── THE FRONT DOOR');
  assert.ok(from > 0 && to > from, 'main.js\'s scene doors moved');
  const doors = [...MAIN.slice(from, to).matchAll(/^\s*if \((params\.has\([^\n]*?\))\) \{ await ensureData\(\); return (boot\w+)\(canvas, renderer, params, status\); \}/gm)]
    .map((m) => ({ when: new Function('params', `return ${m[1]};`), host: m[2] }));
  assert.ok(doors.length >= 5 && doors.some((d) => d.host === 'bootWorld'), 'the lift found main.js\'s scene doors');
  const params = new URLSearchParams(search);
  const door = doors.find((d) => d.when(params));
  if (door) return { host: door.host, params };
  assert.match(MAIN, /for \(const k of BOOT_DOOR_KEYS\) params\.delete\(k\);\s*\n\s*publishBootParams\(params\);\s*\n\s*const \{ runEnhancedMenu \}/, 'the front door clears the boot keys before its menu');
  for (const k of BOOT_DOOR_KEYS) params.delete(k);
  return { host: 'the front door', params };
}

/** The front door's decisions for a menu choice, run off main.js's own text (the block from `choice !== 'begin'` to its
 *  `return bootWorld(`): the address it publishes and the params the world host is booted with. */
async function frontDoor(search, choice, realmId = null) {
  const at = MAIN.indexOf("if (choice !== 'begin') {");
  const end = MAIN.indexOf('return bootWorld(canvas, renderer, params, status);', at);
  assert.ok(at > 0 && end > at, 'the front door\'s decisions moved');
  const body = MAIN.slice(at + "if (choice !== 'begin') {".length, end + 'return bootWorld(canvas, renderer, params, status);'.length).replace(/await import\(/g, 'await load(');
  const params = new URLSearchParams(search);
  for (const k of BOOT_DOOR_KEYS) params.delete(k);   // the clear before the menu (route above holds it to main.js)
  const load = async (p) => {
    if (p === './ui/enhancedMenu.js') return { takePickedSaveKey: () => null, takePickedRealmId: () => realmId, takePickedLegacyBirth: () => null };
    if (p === './systems/testRoom.js') return { testStartsOutdoors };
    throw new Error(`the front door imports ${p}: the pin needs it`);
  };
  let published = null, booted = null;
  const run = new AsyncFunction('params', 'choice', 'ensureData', 'load', 'publishBootParams', 'bootWorld', 'canvas', 'renderer', 'status', body);
  const host = await run(params, choice, async () => {}, load, (p) => { published = publishBootParams(p, { history: null, location: null }); },
    (c, r, p) => { booted = new URLSearchParams(p); return 'bootWorld'; }, null, null, null);
  assert.equal(host, 'bootWorld');
  return { published, booted };
}

/** The address realmBirth reloads to, run off its own `location.replace(` - over the chargen page's address. */
function birthAddress(chargenSearch) {
  const birth = W.slice(W.indexOf('async function realmBirth()'));
  const m = /\n {4}location\.replace\((`[^`\n]*`)\);\n {2}\}/.exec(birth);
  assert.ok(m, 'realmBirth\'s reload moved');
  const location = { pathname: '/', search: chargenSearch };
  const href = new Function('location', 'realmBootSearch', 'BOOT_DOOR_KEYS', 'made', `return ${m[1]};`)(location, realmBootSearch, BOOT_DOOR_KEYS, { data: { id: ID } });
  return href.slice(href.indexOf('?'));
}

/** What the world host makes of its params at the top of the boot: the realm join and the birth, lifted off world.js. */
function hostReads(params) {
  const nw = /const realmNew = ([^;\n]+);/.exec(W);
  const join = /const realmBoot = ([^?\n]+) \? await openRealmBoot\(\{ io: realmIoNow\(\), id: params\.get\('realm'\) \}\) : null;/.exec(W);
  assert.ok(nw && join, 'the world host\'s realm reads moved');
  return { realmNew: new Function('params', `return ${nw[1]};`)(params), joins: new Function('params', `return ${join[1]};`)(params), id: params.get('realm') };
}

/** The boot's load door: the arm it takes at the end of the walk, run off its own conditions, with the classic import
 *  empty, StartInDungeon on and a start cell that has a dungeon. */
function bootArm(params) {
  const from = W.indexOf('let _loadedGame = false;');
  const to = W.indexOf('if (testRoomOffline) townTalk.say(TEST_ROOM_OFFLINE_TEXT);', from);
  assert.ok(from > 0 && to > from, 'the boot\'s load door moved');
  const walk = W.slice(from, to);
  const arms = [...walk.matchAll(/^ {2}(?:\} else )?if \((.+)\) \{$/gm)].map((m, i, all) => ({ when: m[1], body: walk.slice(m.index, all[i + 1]?.index ?? walk.length) }));
  assert.ok(arms.length >= 3, 'the lift found the load door\'s arms');
  const taken = arms.find((a) => new Function('params', 'peekPendingClassicSave', 'getBool', 'startLoc', `return ${a.when};`)(params, () => false, () => true, { hasDungeon: true }));
  if (!taken) return 'no arm';
  if (/worldQuickLoad\(/.test(taken.body)) return 'the save loaded';
  if (/modes\.startInDungeon\(\)/.test(taken.body)) return 'a new game in the start dungeon';
  return 'another arm';
}

test('REALM-BIRTH: the report - a character born online reloads into the world host, joined to its realm character and loading its save, never to the front door (mutants: the front door; the dungeon host; born again; the door keys ride; classic starts over)', async () => {
  const chargen = await frontDoor('?fps', 'online-new');
  assert.equal(chargen.published, '?fps&online=1&realmnew=1&classic=1', 'the chargen page, as the Online door\'s New online character publishes it');
  const birth = birthAddress(chargen.published);
  const { host, params } = route(birth);
  assert.equal(host, 'bootWorld', `the born character's address ${birth} boots the world host`);
  assert.deepEqual(hostReads(params), { realmNew: false, joins: true, id: ID }, 'it joins the realm character it just made, and is not born a second time');
  assert.equal(bootArm(params), 'the save loaded', 'the save at sequence 1 is the one loaded - where chargen left the character');
  // the report's own boot, as it was: the realm's three keys alone - the front door, and nothing of the realm left
  const before = route(`?fps&online=1&load=1&realm=${ID}`);
  assert.equal(before.host, 'the front door');
  assert.equal(String(before.params), 'fps=', 'the realm id and the load cleared before the menu');
});

test('REALM-BIRTH: the born character\'s boot IS the Online door\'s Play of it - the same host, every boot door key the same, the scene door alone added (mutants: no classic start; the door drifts)', async () => {
  const chargen = await frontDoor('?fps', 'online-new');
  const birth = route(birthAddress(chargen.published));
  const play = await frontDoor(chargen.published, 'online', ID);   // the menu's Play on the same character, from the same page
  const keys = (p) => Object.fromEntries(BOOT_DOOR_KEYS.filter((k) => p.has(k)).map((k) => [k, p.get(k)]));
  assert.deepEqual(keys(play.booted), { load: '1', online: '1', realm: ID, classic: '1' }, 'the Online door\'s Play: the save, the lane, the character and the classic start');
  assert.equal(birth.host, 'bootWorld', 'the host the door\'s `return bootWorld(` boots');
  assert.deepEqual(keys(birth.params), keys(play.booted), 'the birth\'s address decides every boot door key as the door does');
  const rest = (p) => [...p.keys()].filter((k) => !BOOT_DOOR_KEYS.includes(k)).sort();
  assert.deepEqual(rest(birth.params), [...rest(play.booted), 'world'].sort(), 'the rest of the page\'s address rides, and the one key added is the scene door that routes it');
  assert.deepEqual(hostReads(birth.params), hostReads(play.booted), 'the world host reads the two alike');
  assert.equal(bootArm(birth.params), bootArm(play.booted));
});
