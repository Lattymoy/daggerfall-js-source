// CRUX1 (2026-09-22, a player through Mac: "the final dungeon mission
// is unbeatable"): THE ROAD INTO THE MANTELLAN CRUX, MADE OF DFU'S
// PARTS. The final quest (S0000016) rides `transfer pc inside` into a
// dungeon nothing else can reach, and the port's respawn entered a
// dungeon only through an entrance DOOR found in the loaded exterior -
// DFU's StartDungeonInterior(location) builds the dungeon directly and
// never looks for one. A `start quest` whose child throws in set-up
// took its PARENT down with it (DFU catches at ParseQuest). And two
// videos due on one tick (the ending's) played over each other where
// DFU stacks them. Three seams, each DFU's law.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { makeVideoQueue } from '../src/systems/quest/videoQueue.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(VENDOR, 'Tables', f), 'utf8').replace(/^\ufeff/, '');
  loadQuestTables(sources);
}
const HEADER = ['Quest: __PARENT', 'QRC:', 'Message:  1011', ' x', '', 'QBN:'];
const BROKEN_CHILD = ['Quest: __BAD', 'QRC:', 'QBN:', 'this is not a line signature at all'];
const GOOD_CHILD = ['Quest: __CHILD', 'QRC:', 'Message:  1011', ' c', '', 'QBN:', 'variable _x_'];

test('CRUX1: a `start quest` whose child cannot be set up leaves the PARENT alive - the child answers null under ParseQuest\'s catch, the parent\'s action completes and the parent is not error-terminated', () => {
  const warned = [];
  const orig = console.warn; console.warn = (...a) => warned.push(a.join(' '));
  try {
    const m = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: (n) => (n === 'S0000016' ? BROKEN_CHILD : n === 'S0000500' ? GOOD_CHILD : null) });
    const parent = m.scheduleQuest([...HEADER, ' start quest 16 16', ' start quest 500 500'], 0, { rolls: () => 0 });
    m.tick(); m.tick(); m.tick();
    assert.ok([...m.quests.values()].includes(parent), 'the parent quest still runs');
    assert.equal(parent.questComplete, false);
    assert.ok([...m.quests.values()].some((q) => q.questName === '__CHILD'), 'the good child went live on the same parent');
    assert.ok(!([...m.quests.values()].some((q) => q.questName === '__BAD')), 'the broken one did not');
    assert.ok(warned.some((w) => /Parsing quest S0000016 FAILED!/.test(w)), `the failure is logged in ParseQuest's words (${warned.join(' | ')})`);
    assert.equal(m.scheduleQuestByName('S0000016'), null, 'and by name: null, not a throw');
    assert.equal(m.scheduleQuestByName('S0000999'), null, 'no source: null');
  } finally { console.warn = orig; }
});

test('CRUX1: the video queue - a second video waits for the first, a failed play releases the next, and the count of pending plays is honest', async () => {
  const log = [];
  let release;
  const play = (name) => new Promise((res, rej) => {
    log.push(`start ${name}`);
    if (name === 'bad') { log.push('fail bad'); rej(new Error('no ANIM')); return; }
    release = () => { log.push(`end ${name}`); res(); };
  });
  const q = makeVideoQueue(play);
  const a = q('ANIM0003'); const b = q('bad'); const c = q('ANIM0014');
  assert.equal(q.pending(), 3);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(log, ['start ANIM0003'], 'the second waits - one player on the canvas at a time');
  release();
  await a;
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(log.slice(0, 4), ['start ANIM0003', 'end ANIM0003', 'start bad', 'fail bad'], 'then the next, which fails');
  await b;
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(log.at(-1), 'start ANIM0014', 'the failure released the third');
  release(); await c;
  assert.equal(q.pending(), 0);
});

test('CRUX1: by source - the dungeon start falls back to the host\'s doorless site; the host answers its own pixel\'s location with a dungeon (an interior season, no door, the pixel as the group) and null without one; the entry reads nothing off `hit.door`; the quest teleport, the cemetery transfer and the new game all ride startInDungeon; the videos go through the queue', () => {
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /const hit = entries\.find\(\(e\) => e\.door\.doorType === DOOR_TYPE\.DUNGEON_ENTRANCE\) \?\? host\.dungeonStartSite\?\.\(\) \?\? null;\s*\n\s*if \(!hit\) return false;/);
  const enter = wm.slice(wm.indexOf('async function tryEnterDungeon('), wm.indexOf('function tryExitDungeon('));
  assert.doesNotMatch(enter, /hit\.door\b/, 'the door-based entry never reads the door itself - a doorless hit is whole');
  for (const f of ['hit.dfLocation', 'hit.climateBase', 'hit.season', 'hit.group']) assert.ok(enter.includes(f), `${f} is what a hit must carry`);
  const w = rd('src/scenes/world.js');
  assert.match(w, /dungeonStartSite: \(\) => \{\s*\n\s*const p = playerTravelPixel\(\);\s*\n\s*const key = `\$\{p\.x\},\$\{p\.y\}`;\s*\n\s*const dfLocation = locationIndex\.get\(key\) \?\? null;\s*\n\s*if \(!dfLocation\?\.hasDungeon\) return null;\s*\n\s*return \{ dfLocation, climateBase: getWorldClimateSettings\(maps\.getClimateIndex\(p\.x, p\.y\)\)\.climateType, season: INTERIOR_SEASON, group: key, door: null, dfBlock: null, recordIndex: -1 \};/);
  assert.match(w, /const entered = await modes\?\.startInDungeon\(\);\s*\n\s*if \(!entered\) console\.warn\('\[quest\] respawn: no dungeon entrance at site/, 'the quest teleport');
  assert.match(w, /_lastEncMinutes = Math\.floor\(playerTicker\.classicMinutes\);\s*\n\s*const entered = await \(modes\?\.startInDungeon\?\.\(\) \?\? false\);/, 'the vampire wakes in the crypt');
  assert.match(w, /playVideo: \(name\) => \{ _questVideos\(name\); \},/);
  assert.match(w, /const _questVideos = makeVideoQueue\(async \(name\) => \{/);
  assert.equal((w.match(/_questVideos\(name\)/g) ?? []).length, 1, 'one door into the queue');
  const m = rd('src/systems/quest/machine.js');
  assert.match(m, /scheduleQuestByName\(questName, factionId = 0, opts = \{\}\) \{[\s\S]*?try \{\s*\n\s*return this\.scheduleQuest\(lines, factionId, opts\);\s*\n\s*\} catch \(ex\) \{/);
});
