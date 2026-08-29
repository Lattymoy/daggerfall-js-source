// R6 — THE SWITCH AND THE CACHE. Pins for systems/roadsBoot.js, the
// derived store's contract, and the bug class that shipped in R5.
//
// The last test in this file is the important one. R5 wired the paint
// with `this._roadNetwork` inside buildPixel - a plain function in an
// ES module, so `this` is undefined and the property access threw a
// TypeError on EVERY streamed pixel, before `?? null` could help. Lint
// passed, the build passed, 4283 tests passed, and the world host was
// dead on the first terrain load. Nothing in the suite drives
// buildPixel: it wants GL and ARENA2. So the guard is a SOURCE SWEEP,
// the same shape AUDIT 17i used when the dungeon host kept building
// its own ChargenFlow - the rule enforced rather than remembered.

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';

import {
  roadsForWorld, bakeInputs, roadsCacheKey,
} from '../src/systems/roadsBoot.js';
import { serializeRoads, deserializeRoads, ROADS_V } from '../src/systems/roadBake.js';
import { createNetwork, linkPixels, hasRoad } from '../src/systems/roads.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';

// ── fixtures ─────────────────────────────────────────────────────

/** A tiny stand-in for the world host's three readers. */
function readers() {
  const woods = { heightMapBuffer: new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(40) };
  const maps = { getClimateIndex: () => CLIMATES.Woodlands };
  const locationIndex = new Map([
    ['10,20', { mapTableData: { locationType: LOCATION_TYPES.TownCity } }],
    ['300,140', { mapTableData: { locationType: LOCATION_TYPES.TownHamlet } }],
    ['7,9', { mapTableData: {} }],                       // no type at all
    ['12,21', {}],                                       // no mapTableData
  ]);
  return { woods, maps, locationIndex };
}

/** A small real network, and the bytes a store would hold. */
function bakedBytes() {
  const n = createNetwork(8, 8);
  for (let x = 1; x < 6; x++) linkPixels(n.trunkExits, 8, x, 3, x + 1, 3);
  return { network: n, bytes: serializeRoads(n) };
}

/** An in-memory stand-in for the derived store. */
function fakeStore(initial = null) {
  const cell = { bytes: initial, writes: 0, reads: 0 };
  return {
    cell,
    load: async (k) => { cell.reads++; cell.key = k; return cell.bytes; },
    save: async (k, b) => { cell.writes++; cell.key = k; cell.bytes = b; },
  };
}

/** inputs() that counts how often it was asked for - a cache hit must
 *  never touch the readers, which is the whole point of the bake being
 *  paid once. */
function countingInputs() {
  const r = readers();
  const state = { calls: 0 };
  return {
    state,
    inputs: () => {
      state.calls++;
      const i = bakeInputs(r.woods, r.maps, r.locationIndex);
      // keep the pins fast: bake over a small window, not 500,000 px
      return { ...i, width: 40, height: 40, locations: [
        { x: 3, y: 3, locationType: LOCATION_TYPES.TownCity },
        { x: 35, y: 30, locationType: LOCATION_TYPES.TownCity },
        { x: 20, y: 8, locationType: LOCATION_TYPES.TownHamlet },
        { x: 10, y: 30, locationType: LOCATION_TYPES.HomeFarms },
      ] };
    },
  };
}

// ── the switch ───────────────────────────────────────────────────

test('roads default ON, and the bake stays visible and cached', () => {
  // R6 shipped this false. Mac's call reversed it: a player on the
  // ENHANCED skin has asked for enhancements, and one nobody finds is
  // not shipped. What the reversal owes them is that the twenty-six
  // seconds is announced and paid once - so the pins that make it
  // survivable are named here, beside the default they justify.
  assert.equal(PREF_DEFAULTS.roads, true);
  const world = readFileSync('src/scenes/world.js', 'utf8');
  assert.match(world, /status\(`baking roads: \$\{phase\}/,
    'the bake must report, or an on-by-default cost looks like a hang');
  // R3W (2026-08-28): read as ORDER, not adjacency. The first draft
  // required `try {` and the `if` to be consecutive lines, so adding
  // the skin gate's comment between them failed a pin about the catch.
  const tryAt = world.indexOf('  let roadNetwork = null;');
  const gate = world.indexOf("getPref('roads')", tryAt);
  const catchAt = world.indexOf('} catch', tryAt);
  assert.ok(tryAt > 0 && world.slice(tryAt, gate).includes('try {'),
    'the bake sits inside a try - on by default means a bake that throws '
    + 'would otherwise take every boot down');
  assert.ok(gate > 0 && catchAt > gate, '...and behind the preference, inside it');
  // R3W: and behind the SKIN. Roads are an enhanced-mode addition;
  // classic Daggerfall has none, so a classic session must not bake
  // them or paint them across its terrain.
  assert.match(world, /if \(isEnhanced\(\) && getPref\('roads'\)\)/,
    'roads are gated on the enhanced skin as well as the preference');
});

test('the preference lives on the UI shelf, NOT in DFU\'s settings store', () => {
  // systems/settings.js holds exactly 171 DFU keys and a parity pin
  // asserts that count; a port-invented preference there breaks it.
  const settings = readFileSync('src/systems/settings.js', 'utf8');
  assert.ok(!/\broads\b/i.test(settings),
    'a roads key appeared in the DFU settings store');
  assert.ok('roads' in PREF_DEFAULTS, 'and it must be on the UI shelf');
});

test('switched off answers a null network and touches nothing', async () => {
  const store = fakeStore();
  const { state, inputs } = countingInputs();
  const r = await roadsForWorld({ enabled: false, ...store, inputs });
  assert.equal(r.network, null);
  assert.equal(r.fromCache, false);
  assert.equal(state.calls, 0, 'the readers must not be touched');
  assert.equal(store.cell.reads, 0, 'and neither must the store');
});

// ── the cache law ────────────────────────────────────────────────

test('a cold boot bakes, writes back, and never reads the store twice', async () => {
  const store = fakeStore(null);
  const { state, inputs } = countingInputs();
  const r = await roadsForWorld({ enabled: true, ...store, inputs });
  assert.ok(r.network, 'a network came back');
  assert.equal(r.fromCache, false);
  assert.equal(state.calls, 1, 'the readers were assembled exactly once');
  assert.equal(store.cell.writes, 1, 'and the artifact was stored');
  assert.ok(store.cell.bytes instanceof Uint8Array);
  assert.ok(r.stats.trunkLaid > 0);
});

test('a warm boot takes the cache and NEVER assembles the readers', async () => {
  // The reason the twenty-six seconds is paid once: inputs() is lazy
  // and only called on a miss.
  const { bytes, network } = bakedBytes();
  const store = fakeStore(bytes);
  const { state, inputs } = countingInputs();
  const r = await roadsForWorld({ enabled: true, ...store, inputs });
  assert.equal(r.fromCache, true);
  assert.equal(state.calls, 0, 'a cache hit must not touch the readers');
  assert.equal(store.cell.writes, 0, 'nor write anything back');
  assert.deepEqual([...r.network.trunkExits], [...network.trunkExits]);
  assert.ok(hasRoad(r.network, 3, 3));
});

test('a TORN artifact rebakes rather than loading a broken world', async () => {
  const { bytes } = bakedBytes();
  const torn = Uint8Array.from(bytes);
  torn[torn.length - 6] ^= 0x04;
  const store = fakeStore(torn);
  const { state, inputs } = countingInputs();
  const r = await roadsForWorld({ enabled: true, ...store, inputs });
  assert.equal(r.fromCache, false, 'the corrupt artifact must be refused');
  assert.equal(state.calls, 1);
  assert.equal(store.cell.writes, 1, 'and replaced');
});

test('a store that THROWS costs the roads, never the game', async () => {
  // Roads decorate a game that ran without them for five slices.
  const { state, inputs } = countingInputs();
  const r = await roadsForWorld({
    enabled: true,
    load: async () => { throw new Error('IndexedDB is unavailable'); },
    save: async () => { throw new Error('quota exceeded'); },
    inputs,
  });
  assert.ok(r.network, 'a read that throws must bake instead');
  assert.equal(r.fromCache, false);
  assert.equal(state.calls, 1);
  // and a write that throws is swallowed - the call above resolved
});

test('the cache key carries the version, so switching builds does not thrash', async () => {
  // The envelope would refuse a stale artifact and rebake correctly -
  // but it would also OVERWRITE it, so a player moving between builds
  // would pay the bake every single switch. Keyed by version, each
  // build keeps its own and finds it again.
  assert.equal(roadsCacheKey(), `roads.v${ROADS_V}`);
  assert.notEqual(roadsCacheKey(ROADS_V), roadsCacheKey(ROADS_V + 1));
  const store = fakeStore();
  const { inputs } = countingInputs();
  await roadsForWorld({ enabled: true, ...store, inputs });
  assert.equal(store.cell.key, roadsCacheKey());
});

test('progress is reported through the bake, for the boot status line', async () => {
  const phases = new Set();
  const { inputs } = countingInputs();
  await roadsForWorld({
    enabled: true, ...fakeStore(), inputs,
    onProgress: ({ phase }) => phases.add(phase),
  });
  for (const want of ['candidates', 'trunk', 'spurs']) assert.ok(phases.has(want));
});

// ── the inputs ───────────────────────────────────────────────────

test('bakeInputs reads the world host\'s own three readers', () => {
  const { woods, maps, locationIndex } = readers();
  const i = bakeInputs(woods, maps, locationIndex);
  assert.equal(i.width, MAP_WIDTH);
  assert.equal(i.height, MAP_HEIGHT);
  assert.equal(i.heightBytes, woods.heightMapBuffer, 'the plane itself, not a copy');
  assert.equal(i.climateAt(5, 5), CLIMATES.Woodlands);
  assert.equal(typeof i.isWater, 'function', 'the water law must be supplied');
  assert.equal(i.locations.length, 4);
});

test('the "x,y" key parses back to numbers, both coordinates', () => {
  // The index is keyed by a STRING the host built; splitting it wrong
  // silently puts every location at NaN and the bake finds no hubs.
  const { woods, maps, locationIndex } = readers();
  const { locations } = bakeInputs(woods, maps, locationIndex);
  const at = locations.find((l) => l.x === 300);
  assert.ok(at, 'the three-digit x must survive the parse');
  assert.equal(at.y, 140);
  assert.equal(at.locationType, LOCATION_TYPES.TownHamlet);
  for (const l of locations) {
    assert.ok(Number.isInteger(l.x) && Number.isInteger(l.y), `${l.x},${l.y} is not a pixel`);
  }
});

test('a location missing its type is a location, not a crash', () => {
  const { woods, maps, locationIndex } = readers();
  const { locations } = bakeInputs(woods, maps, locationIndex);
  const bare = locations.find((l) => l.x === 12 && l.y === 21);
  assert.ok(bare, 'a location with no mapTableData must still be indexed');
  assert.equal(bare.locationType, 0);
});

// ── the bug class R5 shipped ─────────────────────────────────────

test('no host reads `this` from a function it CALLS BARE - the R5 crash, swept', () => {
  // R5 wired the paint as `this._roadNetwork ?? null` inside
  // buildPixel. ES modules are strict mode, so `this` is undefined in
  // a function invoked BARE, and the property access threw a TypeError
  // on EVERY streamed pixel - before the `?? null` could do anything.
  // Lint passed. The build passed. 4283 tests passed. The world host
  // was dead on its first terrain load, because nothing in the suite
  // drives buildPixel: it wants GL and ARENA2.
  //
  // WHAT DETERMINES `this` IS THE CALL, NOT THE DECLARATION, and the
  // first version of this sweep did not know that: it flagged
  // dungeonContext's drawFoes, which is declared exactly like
  // buildPixel and is entirely correct, because worldModes calls it as
  // `dungeonCtx.drawFoes(...)` and a method call binds `this` to the
  // context. So the rule is: a plain function that uses `this` is a
  // bug only if the module also calls it BARE.
  const offenders = [];
  for (const file of readdirSync('src/scenes').filter((f) => f.endsWith('.js'))) {
    const path = `src/scenes/${file}`;
    const lines = readFileSync(path, 'utf8').split('\n');
    const strip = (l) => l.replace(/\/\/.*$/, '');
    const whole = lines.map(strip).join('\n');

    let depth = 0, open = false, fnLine = 0, fnName = '', usesThis = false;
    const close = () => {
      if (open && usesThis) {
        // called bare anywhere in the module? (not `.name(`, not the
        // declaration itself)
        const bare = new RegExp(`(^|[^.\\w])${fnName}\\s*\\(`, 'gm');
        const calls = [...whole.matchAll(bare)]
          .filter((m) => !/function\s*$/.test(whole.slice(0, m.index + m[0].length - fnName.length - 1).trimEnd().slice(-20)));
        if (calls.length > 0) {
          offenders.push(`${path}:${fnLine} - ${fnName}() uses \`this\` and is called bare`);
        }
      }
      open = false; usesThis = false;
    };
    lines.forEach((line, i) => {
      const code = strip(line);
      if (!open) {
        const m = /^ {2}(?:async )?function (\w+)\s*\(/.exec(code);
        if (m) { open = true; depth = 0; fnLine = i + 1; fnName = m[1]; usesThis = false; }
      }
      if (open) {
        if (/\bthis\s*[.[]/.test(code)) usesThis = true;
        depth += (code.match(/\{/g) ?? []).length;
        depth -= (code.match(/\}/g) ?? []).length;
        if (depth <= 0 && i + 1 > fnLine) close();
      }
    });
    close();
  }
  assert.deepEqual(offenders, [],
    `\`this\` is undefined in a bare-called function - it THROWS, it does not read undefined:\n${offenders.join('\n')}`);
});

test('the world host paints roads from a BINDING, and bakes before it streams', () => {
  const src = readFileSync('src/scenes/world.js', 'utf8');
  assert.ok(/paintRoadTiles\(tilemap, roadNetwork, px, py\)/.test(src),
    'the paint must take the module binding');
  // comments stripped: the fix's own note NAMES the old expression, and
  // a pin that greps prose would fail on the explanation of its own bug
  const code = src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.ok(!/this\._roadNetwork/.test(code), 'and never the `this` that does not exist');
  // the bake has to be ABOVE the streamer, or the first pixels paint
  // against a null the bake was about to fill
  assert.ok(src.indexOf('let roadNetwork = null;') < src.indexOf('async function buildPixel'),
    'the network must be resolved before buildPixel is defined');
});

test('the derived store is swept by an ARENA2 re-pick, and the other packs are not', () => {
  // A derived artifact is an ANSWER ABOUT a folder, not a pack the
  // player supplied - keeping it across a re-pick hands the new data
  // the old map. The music/texture/Morrowind packs have their own
  // lifecycle and must survive.
  const src = readFileSync('src/scenes/dataSource.js', 'utf8');
  const wipe = src.slice(src.indexOf('export async function clearStoredData'));
  // comments stripped, and the assertion is on the CLEAR CALL, not on a
  // mention: deleting the clear leaves DERIVED_STORE named in the
  // transaction list and in the comment above it, and the first version
  // of this pin was satisfied by exactly that.
  const body = wipe.slice(0, wipe.indexOf('\n}\n'))
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.ok(/objectStore\(DERIVED_STORE\)\s*\.\s*clear\(\)/.test(body),
    'recovery must actually CLEAR the derived store, not merely name it');
  assert.ok(/transaction\(\s*\[[^\]]*DERIVED_STORE/.test(body),
    'and the store must be in the transaction scope or the clear throws');
  for (const survivor of ['MUSIC_STORE', 'TEXTURE_STORE', 'MW_STORE']) {
    assert.ok(!new RegExp(`objectStore\\(${survivor}\\)`).test(body),
      `${survivor} must survive a re-pick`);
  }
  assert.ok(/indexedDB\.open\(DB_NAME, 5\)/.test(src),
    'adding a store needs the version bump, or existing players never get it');
});
