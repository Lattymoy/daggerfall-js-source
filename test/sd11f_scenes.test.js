// SD11f (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 16's AUDIT SD II, sections
// 5, 6 and 11) - THE ARC'S SECOND AUDIT, ITS SCENES' LAST FINDINGS AND ITS DOCS, each fix as it stands
// (scenes/sdEnd.js, systems/sdRiftSound.js, world/sdDungeon.js, render/auraRing.js, the hosts). The way home is pressed,
// never walked into - it stands where the spoils land (L6 F9, the gate's SS3); it rises out of the floor with the Rift's
// bell tolled once, a fourth higher, and the Hour says it stands open - said and tolled as it rises, never to a page
// that comes later (L6 F16); the Hollow's Rift counts its Hour on its plaque - the fade by the hour and its last hour by
// the second, the collapse by the second (L6 F5); and a Hollow's own templates measured against the foe frame the Elite
// proved (L8 D1, G15 - over the real data, skipped without it).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createSdEnd, SD_HOME_TEXT, SD_HOME_RISE_MS, SD_HOME_SAY_MS, SD_HOME_ASSEMBLY, SD_RETURN_KEY, SD_RIFT_KEY } from '../src/scenes/sdEnd.js';
import { tollRiftBell, SD_HOME_TOLL, RIFT_BELL_KEY, RIFT_BELL_RECORDS } from '../src/systems/sdRiftSound.js';
import { sdRiftCount, SD_RETURN_SIZE, SD_END_TEXT } from '../src/world/sdDungeon.js';   // AUDIT SD III (T6, PIN MOVED): no long count of its own - the Timers' words
import { sdRise, sdFirst, sdFind, sdFell, SD_COLLAPSE_MS } from '../src/net/sdLaw.js';
import { SD_ARENA, realmToDungeon } from '../src/net/sdBrain.js';
import { SD_REM_SINK_MS } from '../src/scenes/sdRemnant.js';
import { clearOfPillars } from '../src/scenes/sdSpoils.js';
import { sdTemplates } from '../src/systems/sdSite.js';
import { isMainStoryDungeon } from '../src/world/dungeonTextures.js';
import { ELITE_FOE_MULTIPLIER } from '../src/world/spawnedDungeons.js';
import { FOES_FRAME_MAX, PARTY_MAX, FOE_HEALTH_MAX } from '../src/net/wire.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = read('src/scenes/world.js');
const constOf = (name) => { const at = W.indexOf(`\n  const ${name} = `); assert.ok(at > 0, name); return W.slice(at + 1, W.indexOf('\n  };\n', at) + 5); };
const T0 = 1_800_000_000_000, M = 60_000, H = 3_600_000;

/** A renderer that keeps its batches, and an engine that hears the toll. */
const fakeRenderer = () => ({ batches: [], createBillboardBatch(a, r, size, at) { const b = { archive: a, size, at }; this.batches.push(b); return b; }, destroyBillboardBatch() {}, uploadTexture() {} });
const fakeAudio = () => {
  const log = [];
  return {
    log,
    samplesOf: (i) => (i === RIFT_BELL_RECORDS.bell || i === RIFT_BELL_RECORDS.bubbles ? new Float32Array(4000).map((_, k) => Math.sin(k / 9)) : null),
    registerSamples: (key, s, rate) => { log.push(['reg', key, rate, s.length > 0]); return true; },
    play3d: (key, at, vol, opts) => { log.push(['toll', key, at, opts]); return 6.5; },
    loop3d: () => ({ stop() {} }),
  };
};

// ── L6 F9: the way home pressed alone ──────────────────────────────────

test('SD11f THE WAY HOME IS PRESSED, NEVER WALKED INTO (L6 F9, the gate\'s SS3 back again): it stands where the Remnant fell, where its spoils land - a step into it, out and in, carries nobody; the press takes it; the Hollow\'s own Return, beside its Rift at the way in, is walked into as before (mutants: the way home walked into; every Return pressed alone)', () => {
  let clock = 1000, homes = 0;
  const e = createSdEnd({ now: () => clock, onReturn: () => { homes++; }, retTitle: SD_HOME_TEXT.title, retTo: SD_HOME_TEXT.to });
  e.stand({ rift: { at: [0, 0, -4], size: 4 }, retAt: null });
  e.standReturn([10, 0, 20]);
  for (const z of [21.2, 20.2, 21.2, 20.1]) { assert.equal(e.frame([10, 0, z]), null, `stepped to ${z}: nothing`); clock += 16; }
  assert.equal(homes, 0, 'never walked into');
  assert.deepEqual(e.hoverName(SD_RETURN_KEY), { title: SD_HOME_TEXT.title, subs: [SD_HOME_TEXT.to] }, 'named on the plaque, for the press');
  assert.equal(e.press(SD_RETURN_KEY), true);
  assert.equal(homes, 1, 'pressed: out');
  // the Hollow's own Return: walked into, the Portal Stones' latch
  let c2 = 1000, back = 0;
  const h = createSdEnd({ now: () => c2, onReturn: () => { back++; } });
  h.stand({ rift: { at: [0, 0, 0], size: 4 }, retAt: [5, 0, 0] });
  h.frame([5, 0, 1.4]); c2 += 16;
  assert.equal(h.frame([5, 0, 0.2]), 'return', 'the way in is still walked into');
  assert.equal(back, 1);
});

// ── L6 F16: the way home rises, tolled and said ───────────────────────

test('SD11f THE WAY HOME RISES, TOLLED (L6 F16): it stands up out of the floor over SD_HOME_RISE_MS (the gate\'s portal\'s), from a body\'s height under it - eased by the clock, then held; the Rift\'s bell tolled ONCE where it rises, a fourth higher, heard across the arena; a page that comes later finds it risen, in silence; the Hollow\'s own Return stands risen and untolled (mutants: never risen; risen at once; no toll; tolled to a late page; the toll at the Rift\'s pitch)', () => {
  let clock = 5000;
  const renderer = fakeRenderer(), audio = fakeAudio();
  const e = createSdEnd({ renderer, audio, now: () => clock });
  e.stand({ rift: { at: [0, 0, -4], size: 4 }, retAt: null });
  const tolls = () => audio.log.filter((x) => x[0] === 'toll');
  assert.equal(tolls().length, 0, 'the Rift loops; nothing tolled yet');
  e.standReturn([10, 2, 20], 0);
  // SD-LOOK (PIN MOVED): its foot as its arch is stood, a mesh now (it was a billboard's origin). PIN MOVED (SD-LOOK
  // S6): it assembles - its foot its jambs', rising out of the floor through their share of the rise (SD_HOME_ASSEMBLY)
  assert.ok(Math.abs(e.ret.foot - (2 - SD_RETURN_SIZE.h * 0.7)) < 1e-6, 'under the floor as it begins');
  clock += (SD_HOME_RISE_MS * SD_HOME_ASSEMBLY.jambs[1]) / 2; e.frame(null);
  assert.ok(Math.abs(e.ret.foot - (2 - SD_RETURN_SIZE.h * 0.35)) < 1e-6, `halfway at half their time (${e.ret.foot})`);
  clock += SD_HOME_RISE_MS; e.frame(null);
  assert.equal(e.ret.foot, 2, 'risen: its foot on the floor');
  clock += 5000; e.frame(null);
  assert.equal(e.ret.foot, 2, 'and held');
  assert.equal(tolls().length, 1, 'tolled once');
  const [, key, at, opts] = tolls()[0];
  assert.equal(key, RIFT_BELL_KEY, 'the Rift\'s own bell');
  assert.deepEqual(at, [10, 2 + SD_RETURN_SIZE.h / 2, 20], 'where it rises');
  assert.equal(opts.pitch, SD_HOME_TOLL.pitch);
  assert.ok(Math.abs(SD_HOME_TOLL.pitch - 4 / 3) < 1e-12, 'a fourth higher - the way out');
  assert.ok(opts.maxDistance >= 60 && opts.distanceModel === 'linear', 'heard across the arena');
  // a page that comes later: risen at once, in silence
  const r2 = fakeRenderer(), a2 = fakeAudio();
  const late = createSdEnd({ renderer: r2, audio: a2, now: () => clock });
  late.stand({ rift: { at: [0, 0, -4], size: 4 }, retAt: null });
  late.standReturn([10, 2, 20], SD_HOME_SAY_MS + 1);
  assert.equal(late.ret.foot, 2, 'risen');
  assert.equal(a2.log.filter((x) => x[0] === 'toll').length, 0, 'untolled');
  late.returnOut(); late.standReturn([1, 0, 1]);
  assert.equal(a2.log.filter((x) => x[0] === 'toll').length, 0, 'no age: a way home long risen');
  // a toll with no archive, or no engine, sounds nothing and never throws
  assert.equal(tollRiftBell(null, [0, 0, 0]), false);
  assert.equal(tollRiftBell({ ...fakeAudio(), samplesOf: () => null }, [0, 0, 0]), false);
  assert.equal(tollRiftBell({ ...fakeAudio(), play3d: () => { throw new Error('no context'); } }, [0, 0, 0]), false);
  // the Hollow's own Return: risen, untolled
  const r3 = fakeRenderer(), a3 = fakeAudio();
  const own = createSdEnd({ renderer: r3, audio: a3, now: () => clock });
  own.stand({ rift: { at: [0, 0, 0], size: 4 }, retAt: [5, 1, 0] });
  own.frame(null);
  assert.equal(own.ret.foot, 1);
  assert.equal(a3.log.filter((x) => x[0] === 'toll').length, 0);
});

/** world.js's way home's place and age, from its own text, over a fight link the test turns. */
function homeHost() {
  let state = null, now = 0;
  const said = [];
  const env = { sdFightLink: { state: () => state, now: () => now }, SD_REM_SINK_MS, clearOfPillars, sdRealmToDungeon: realmToDungeon, SD_ARENA, sdSay: (t) => said.push(t), SD_HOME_SAY_MS, SD_HOME_TEXT };
  const body = `let _sdHome = null;\n${constOf('sdHomeAt')}\n${constOf('sdHomeAge')}\nreturn { sdHomeAt, sdHomeAge };`;
  return { ...new Function(...Object.keys(env), body)(...Object.values(env)), said, set: (s, t) => { state = s; now = t; } };
}

test('SD11f THE WAY HOME SAID AS IT RISES (L6 F16), the world host from its own text: "The way home stands open." once a fall, as its body has sunk - never to a page that comes later; its age the fight\'s clock\'s, from the sink; the dungeon host stands it with that age; the mode machine hands it through (mutants: never said; said every frame; said to a late page; stood with no age)', () => {
  assert.equal(SD_HOME_TEXT.rises, 'The way home stands open.');
  const h = homeHost();
  const fell = (at, x = 3, z = -4) => ({ fell: { at, top: ['A'], n: 1 }, rem: { x, z } });
  h.set(fell(T0), T0 + 1000);
  assert.equal(h.sdHomeAt(), null, 'not before its body has sunk');
  assert.equal(h.sdHomeAge(), 1000 - SD_REM_SINK_MS);
  h.set(fell(T0), T0 + SD_REM_SINK_MS + 40);
  assert.ok(h.sdHomeAt());
  for (let i = 0; i < 5; i++) h.sdHomeAt();
  assert.deepEqual(h.said, [SD_HOME_TEXT.rises], 'said once');
  assert.equal(h.sdHomeAge(), 40);
  // the next Hollow's fall, reached late: stands, unsaid
  h.set(fell(T0 + 9 * H), T0 + 9 * H + SD_REM_SINK_MS + SD_HOME_SAY_MS + 10);
  assert.ok(h.sdHomeAt());
  assert.deepEqual(h.said, [SD_HOME_TEXT.rises], 'a page that comes later: nothing said');
  h.set(null, T0);
  assert.equal(h.sdHomeAge(), null);
  const D = read('src/scenes/dungeonContext.js'), M2 = read('src/scenes/worldModes.js');
  assert.match(D, /if \(home && !sdEnd\.hasRet\) sdEnd\.standReturn\(home, opts\.sdHomeAge\?\.\(\) \?\? Infinity, \{ dynamicDraws \}\);/);   // PIN MOVED (AUDIT SD V P1): the end asked `hasRet`, its look off the host's look door
  assert.match(M2, /sdHomeAge: \(\) => host\.sdHomeAge\?\.\(\) \?\? null,/);
  assert.match(W, /sdHomeAge: \(\) => sdHomeAge\(\),/);
});

// ── L6 F5: the Rift counts its Hour ───────────────────────────────────

test('SD11f THE RIFT COUNTS ITS HOUR (L6 F5): its plaque\'s second row - found or risen, the fade by the hour and minute ("Fades in 46h 12m"), its last hour by the minute and second (the gate\'s countdown words, never 0:00 while time is left); in its collapse "Collapses in 2:31"; nothing for another slot\'s record, none, or one gone; the plaque shows it under the Rift\'s own row; the hosts hand it through (mutants: no count on the plaque; the hours by the second; the collapse uncounted; another slot counted)', () => {
  const r = sdRise(sdFirst(T0 - 3 * H), T0 - 10 * M, 0);
  // AUDIT SD III (T6, PIN MOVED): the Timers' own words (systems/eventTimers.js timerText), as its banner, its card and the
  // Timers row say it - it counted "46h 12m" beside their "1d 22h"
  assert.equal(sdRiftCount(r, r.s, r.until - 47 * H), 'Fades in 1d 23h', 'risen: by the day and hour');
  assert.equal(sdRiftCount(r, r.s, r.until - 46.2 * H), 'Fades in 1d 22h');
  assert.equal(sdRiftCount(r, r.s, r.until - (H + 1)), 'Fades in 1:00:01', 'its last day by the second - never less than is left');
  assert.equal(sdRiftCount(r, r.s, r.until - H), 'Fades in 1:00:00');
  assert.equal(sdRiftCount(r, r.s, r.until - (H - 1000)), 'Fades in 59:59', 'its last hour by the second');
  assert.equal(sdRiftCount(r, r.s, r.until - (12 * M + 4000)), 'Fades in 12:04');
  assert.equal(sdRiftCount(r, r.s, r.until - 300), 'Fades in 0:01', 'never 0:00 while time is left');
  assert.equal(sdRiftCount(r, r.s, r.until), null, 'gone: nothing');
  const f = sdFind(r, T0, 'Mara');
  assert.equal(sdRiftCount(f, f.s, f.until - 3 * H), 'Fades in 3:00:00', 'found: the same');
  const k = sdFell(f, T0 + 2 * M, { top: 'Mara', n: 2 });
  assert.equal(sdRiftCount(k, k.s, k.fellAt + 29 * 1000), 'Collapses in 2:31', 'its collapse by the second');
  assert.equal(sdRiftCount(k, k.s, k.fellAt + SD_COLLAPSE_MS), null, 'collapsed: nothing');
  assert.equal(sdRiftCount(f, f.s + 1, T0), null, 'another slot\'s record');
  assert.equal(sdRiftCount(null, 1, T0), null);
  // the plaque: the Rift's own row, then its count
  let n = 'Fades in 3:00:00';
  const e = createSdEnd({ riftCount: () => n });
  e.stand({ rift: { at: [0, 0, 0], size: 4 }, retAt: [2, 0, 0] });
  assert.deepEqual(e.hoverName(SD_RIFT_KEY), { title: SD_END_TEXT.rift, subs: [SD_END_TEXT.riftTo, 'Fades in 3:00:00'] });
  n = null;
  assert.deepEqual(e.hoverName(SD_RIFT_KEY), { title: SD_END_TEXT.rift, subs: [SD_END_TEXT.riftTo] }, 'no count: its own row alone');
  assert.deepEqual(createSdEnd({}).hoverName(SD_RIFT_KEY), null);
  // the hosts: the Hollow's Rift asks the world host's word for it; the Hour's own Rift counts nothing (its readouts do)
  const D = read('src/scenes/dungeonContext.js');
  assert.match(D, /const sdEnd = _superTier \? createSdEnd\(\{ renderer, audio, onRift: \(\) => sdRiftStep\(\), onReturn: \(\) => sdReturnStep\(\), riftCount: \(\) => sdEndWord\(\)\?\.count \?\? null, look: \(\) => \(opts\.superRiftLook \? opts\.superRiftLook\(dfLocation\?\.sdSlot\) : sdEndWord\(\)\?\.look\) \?\? null, clock: sdEndClock \}\)/);   // PIN MOVED (AUDIT SD V P1): the end asked `hasRet`, its look off the host's look door
  assert.match(W, /count: sdRiftCount\(rec, s, now\), look: riftLook\(rec, s, now, seen\), enter: \(\) => sdEnterRealm\(s\) \};/);
});

// ── L8 D1, G15: a Hollow's foes fit the frame ─────────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('SD11f A HOLLOW\'S FOES FIT THE FRAME (L8 D1, G15), over MAPS.BSA and BLOCKS.BSA: every Hollow template (12+-block labyrinths and keeps with a spawn\'s clearance, never the main story\'s - laid whole) counted for its enemy markers, the largest tripled by the Elite\'s expansion, in the foes frame\'s worst records, under FOES_FRAME_MAX - the budget the Elite proved at 151 markers, measured for the Hollow\'s own', { skip: skipReal }, async () => {
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const { BlocksFile, RDB_RESOURCE_TYPES } = await import('../src/formats/blocksFile.js');
  const maps = new MapsFile();
  maps.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))));
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const markersOf = new Map();
  const blockMarkers = (name) => {
    if (markersOf.has(name)) return markersOf.get(name);
    let n = 0;
    for (const root of blocks.getBlockByName(name)?.rdbBlock?.objectRootList ?? []) {
      for (const o of root.rdbObjects ?? []) {
        if (!o || o.type !== RDB_RESOURCE_TYPES.Flat) continue;
        const fl = o.resources.flatResource;
        if (fl.textureArchive === 199 && (fl.textureRecord === 15 || fl.textureRecord === 16)) n++;
      }
    }
    markersOf.set(name, n);
    return n;
  };
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) for (let l = 0; l < (maps.getRegion(r)?.locationCount ?? 0); l++) rows.push(maps.getLocation(r, l));
  const templates = sdTemplates(rows, isMainStoryDungeon);
  assert.ok(templates.length > 20, `the Hollows' templates (${templates.length})`);
  let most = 0, where = '';
  for (const t of templates) {
    const n = t.dungeon.blocks.reduce((a, b) => a + blockMarkers(b.blockName), 0);
    if (n > most) { most = n; where = t.name; }
  }
  const records = [];
  for (let i = 0; i < most * ELITE_FOE_MULTIPLIER; i++) {
    records.push({ i, t: 140 + (i % 10), f: [-1234.56, -123.45, -1234.56], y: 6.283, h: FOE_HEALTH_MAX, d: 1, a: 99, m: 9, g: 'k3j4h5g6f7d8', c: 99, s: 999, x: 1, l: 30, n: PARTY_MAX });
  }
  const frame = JSON.stringify({ t: 'foes', data: { n: 1e9, k: 'dungeon:4294967295', f: records } });
  assert.ok(frame.length < FOES_FRAME_MAX, `the largest Hollow (${where}, ${most} markers, ${records.length} foes): ${frame.length} of ${FOES_FRAME_MAX} bytes`);
});
