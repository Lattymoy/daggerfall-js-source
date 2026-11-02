// HOLD-ONCE (2026-10-12, asked: "Let's make it where players outside of privateers hold cannot re enter"):
// online, Privateer's Hold is entered once - by the new game's start, or a save made inside it, or staff landing by a
// player there. Its door, a Recall to an anchor set inside, and a quest's transfer are refused, at the one funnel every
// dungeon entry takes (worldModes.js tryEnterDungeon). Offline, DFU's. `06-Systems/Online-Arc.md` HOLD-ONCE.
//
// Fixtures from the producers: MapsFile's own pixel math for the location, worldModes.js's tryEnterDungeon executed
// from its source, the real isPrivateersHold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { isPrivateersHold, isStartDungeon, HOLD_ONCE_TEXT } from '../../src/systems/startDungeon.js';
import { PRIVATEERS_HOLD_MAP_ID, MAIN_STORY_DUNGEON_IDS } from '../../src/world/dungeon/dungeonTextures.js';
import { mapPixelToLongitudeLatitude } from '../../src/formats/mapsFile.js';
import { setValue } from '../../src/systems/settings/settings.js';

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
/** A location as MapsFile mints it, standing on map pixel (x, y). */
function locationAt(x, y, { name = "Privateer's Hold", mapId = PRIVATEERS_HOLD_MAP_ID, regionIndex = 17 } = {}) {
  const { x: longitude, y: latitude } = mapPixelToLongitudeLatitude(x, y);
  return { name, regionIndex, mapTableData: { mapId, longitude, latitude } };
}
const HOLD = locationAt(109, 158);
const OTHER = locationAt(120, 150, { name: 'Castle Necromoghan', mapId: 9570447 });

test('HOLD-ONCE: the Hold is known by its map id (DaggerfallDungeon.IsMainStoryDungeon\'s first, 187853213) - a custom start cell moves the classic start, never which dungeon is the Hold', () => {
  assert.equal(PRIVATEERS_HOLD_MAP_ID, 187853213);
  assert.ok(MAIN_STORY_DUNGEON_IDS.has(PRIVATEERS_HOLD_MAP_ID), 'one literal, the main story\'s table reads it');
  assert.equal(isPrivateersHold(HOLD), true);
  assert.equal(isPrivateersHold(OTHER), false);
  assert.equal(isPrivateersHold({ name: 'no table' }), false);
  assert.equal(isPrivateersHold(null), false);
  try {
    setValue('Startup', 'StartCellX', '120');
    setValue('Startup', 'StartCellY', '150');
    assert.equal(isStartDungeon(OTHER), true, 'the configured start moved');
    assert.equal(isPrivateersHold(OTHER), false, 'and the Hold did not');
    assert.equal(isPrivateersHold(HOLD), true);
  } finally { setValue('Startup', 'StartCellX', '109'); setValue('Startup', 'StartCellY', '158'); }
  assert.equal(HOLD_ONCE_TEXT, 'You cannot go back into Privateer\'s Hold.');
});

// worldModes.js's tryEnterDungeon, executed from its source
const WM = read('src/scenes/worldModes.js');
const fns = new Map();
(function walk(n) {
  if (!n || typeof n !== 'object') return;
  if (n.type === 'FunctionDeclaration' && n.id?.name) fns.set(n.id.name, WM.slice(n.start, n.end));
  for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
})(parse(WM, { ecmaVersion: 'latest', sourceType: 'module' }));
function entry({ online }) {
  const said = [], built = [];
  const host = { dungeonOnline: () => online, wildDungeonGate: null };
  const tryEnterDungeon = new Function('host', 'say', 'isPrivateersHold', 'HOLD_ONCE_TEXT', 'gatedTransition', 'dungeonTransition',
    `${fns.get('tryEnterDungeon')} return tryEnterDungeon;`)(host, (l) => said.push(l), isPrivateersHold, HOLD_ONCE_TEXT,
    (step) => step(() => true), async (hit, entries, preferEnterMarker, live, fromLoad) => { built.push({ name: hit.dfLocation.name, fromLoad }); return true; });
  return { tryEnterDungeon, said, built };
}

test('HOLD-ONCE: online, the Hold\'s door (and every way in through the funnel) is refused aloud and nothing is built - a save made inside it and a way in marked `holdOpen` pass', async () => {
  const on = entry({ online: true });
  assert.equal(await on.tryEnterDungeon({ dfLocation: HOLD }, []), false, 'the door');
  assert.equal(await on.tryEnterDungeon({ dfLocation: HOLD }, [], { preferEnterMarker: true }), false, 'a Recall or a quest\'s transfer (startInDungeon, no holdOpen)');
  assert.deepEqual(on.said, [HOLD_ONCE_TEXT, HOLD_ONCE_TEXT]);
  assert.deepEqual(on.built, [], 'refused before the gate: no build');
  assert.equal(await on.tryEnterDungeon({ dfLocation: HOLD }, [], { preferEnterMarker: true, fromLoad: true }), true, 'a save made inside');
  assert.equal(await on.tryEnterDungeon({ dfLocation: HOLD }, [], { preferEnterMarker: true, holdOpen: true }), true, 'the new game\'s start, a staff landing');
  assert.equal(await on.tryEnterDungeon({ dfLocation: OTHER }, []), true, 'every other dungeon, as ever');
  assert.deepEqual(on.built.map((b) => b.name), ["Privateer's Hold", "Privateer's Hold", 'Castle Necromoghan']);
  assert.equal(on.said.length, 2, 'nothing more said');
  const off = entry({ online: false });
  assert.equal(await off.tryEnterDungeon({ dfLocation: HOLD }, []), true, 'offline the Hold\'s door is DFU\'s');
  assert.deepEqual(off.said, []);
});

test('HOLD-ONCE: the ways in - startInDungeon hands `holdOpen` to the funnel; the world host marks the new game\'s start and the staff landing alone, never a Recall, a quest\'s transfer or the cemetery', () => {
  assert.match(fns.get('startInDungeon'), /async function startInDungeon\(\{ locationKey = null, fromLoad = false, holdOpen = false, recorded = undefined \} = \{\}\)/);   // PIN MOVED (INSTANCES' audit): and what was recorded of the place
  assert.match(fns.get('startInDungeon'), /return tryEnterDungeon\(hit, entries, \{ preferEnterMarker: true, fromLoad, holdOpen, recorded \}\);/);   // PIN MOVED (INSTANCES' audit): and what was recorded of the place
  assert.match(WM, /if \(hit\.door\.doorType === DOOR_TYPE\.DUNGEON_ENTRANCE\) return enterDungeonDoor\(hit, entries\);[^\n]*\n[\s\S]*?const enterDungeonDoor = [^\n]*tryEnterDungeon\(hit, entries, \{ entry \}\)/, 'the door: the funnel, no holdOpen');   // PIN MOVED (INSTANCES' audit): the door through its own entry - the entry its popup chose, still no holdOpen
  const W = read('src/scenes/world.js');
  const calls = [...W.matchAll(/startInDungeon\??\.?\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(calls.filter((c) => /holdOpen/.test(c)).sort(), ['{ holdOpen: true }', '{ locationKey: d.locationKey ?? null, holdOpen: true, recorded: { ins: d.ins ?? null, whole: d.whole === true, staff: true } }'], 'the new game\'s start and the staff landing');   // PIN MOVED (INSTANCES' audit): the staff landing in the player's own room (the relay admits staff)
  assert.match(W, /status\('entering the dungeon'\);\n {4}const entered = await modes\.startInDungeon\(\{ holdOpen: true \}\);/, 'the new game\'s start');
  assert.match(W, /else if \(d\.kind === 'dungeon'\) \{\n {6}entered = await modes\?\.startInDungeon\?\.\(\{ locationKey: d\.locationKey \?\? null, holdOpen: true, recorded: \{ ins: d\.ins \?\? null, whole: d\.whole === true, staff: true \} \}\);/, 'the staff landing');   // PIN MOVED (INSTANCES' audit): and the player's room
  assert.match(W, /if \(plan\.arrive === 'dungeon'\) \{[\s\S]{0,400}landed = !!\(await modes\?\.startInDungeon\?\.\(\{ recorded: a\.dungeon \?\? \{\} \}\)\);/, 'a Recall: no holdOpen');   // PIN MOVED (INSTANCES' audit): the room and layout the anchor recorded - still no holdOpen
});
