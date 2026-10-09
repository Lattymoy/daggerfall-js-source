// FIELD BUGS 2026-10-09c - WILD-KEEP, the Discord's "Stuff pvp zone": "I was in a PvP zone when I died. I went back to
// recover my gear, but unfortunately my game crashed before I could retrieve it. When I logged back in, my gear was no
// longer visible on the map, so I was unable to recover it and ended up losing all of my equipment."
//
// The room (the relay's place room) holds a fallen player's pile for WILD_REMAINS_MS whatever the client does. The
// client's one record of it - world.js `_wildMine`: where it lies, the room, its end, the hall - lived in memory alone:
// a crash took the held map's ring, the record's claim on the pile and the hall-lock's way back in with it. The record is
// kept on the device now for the character that fell (systems/wildRemainsWaypoint.js keepMine / keptMine / forgetMine)
// and read back once by the zone's frame. `01-Overview/Field-Bugs-2026-10-09c.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keepMine, keptMine, forgetMine, WILD_MINE_KEY, WILD_WP_KEY } from '../src/systems/wildRemainsWaypoint.js';

function device() {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  return store;
}
const NOW = 1_800_000_000_000;
const MINE = { r: 'abcdefghij', room: 'c:1203:322', p: [39_500_000.5, 120.25, 5_400_000.75], until: NOW + 9 * 60_000, dungeon: null };

test('WILD-KEEP: my remains\' record survives the session - read back for the character that fell, while they last, as it was kept', () => {
  const store = device();
  try {
    assert.notEqual(WILD_MINE_KEY, WILD_WP_KEY, 'apart from the flag\'s: a flag taken down by hand keeps the record');
    keepMine(MINE, 'realm:7');
    // ...the game crashes; a new session reads the device
    assert.deepEqual(keptMine(NOW + 60_000, 'realm:7'), MINE, 'the same record, the room and the point and the end');
    assert.deepEqual(keptMine(NOW, 'realm:7').p, MINE.p, 'the point to the bit');
    assert.equal(keptMine(NOW, 'realm:8'), null, 'another character\'s death is not mine');
    assert.equal(keptMine(NOW, null), null, 'nor a session that does not know who it is');
    assert.equal(keptMine(MINE.until, 'realm:7'), null, 'at its end, gone - the room has let them go');
    keepMine({ ...MINE, dungeon: 'wd:3' }, 'realm:7');
    assert.equal(keptMine(NOW, 'realm:7').dungeon, 'wd:3', 'a hall\'s death keeps its hall - the lock\'s way back in');
    keepMine(null);
    assert.equal(store.has(WILD_MINE_KEY), false, 'forgotten');
    keepMine(MINE, null);
    assert.equal(store.has(WILD_MINE_KEY), false, 'kept for no one is not kept');
  } finally { delete globalThis.localStorage; }
});

test('WILD-KEEP: the room\'s "gone" forgets its own record and no other; a torn or foreign record is no record', () => {
  const store = device();
  try {
    keepMine(MINE, 'realm:7');
    forgetMine('zzzzzzzzzz');
    assert.ok(keptMine(NOW, 'realm:7'), 'another pile\'s gone leaves mine');
    forgetMine(MINE.r);
    assert.equal(keptMine(NOW, 'realm:7'), null);
    for (const bad of ['{', 'null', '[]', JSON.stringify({ ...MINE, who: 'realm:7', p: [1, 2] }), JSON.stringify({ ...MINE, who: 'realm:7', until: 'later' }), JSON.stringify({ ...MINE, who: 'realm:7', r: 5 })]) {
      store.set(WILD_MINE_KEY, bad);
      assert.equal(keptMine(NOW, 'realm:7'), null, bad);
    }
    delete globalThis.localStorage;
    assert.doesNotThrow(() => keepMine(MINE, 'realm:7'));
    assert.equal(keptMine(NOW, 'realm:7'), null, 'no storage: the session holds it alone');
  } finally { delete globalThis.localStorage; }
});

test('WILD-KEEP by source: world.js keeps the record where it mints it, reads it back once in the zone\'s frame, and forgets it at its end and at the room\'s "gone"', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /if \(sent\) _wildMine = \{ r, room: online\.room, p, until: Date\.now\(\) \+ WILD_REMAINS_MS,[^\n]*\n\s+if \(sent\) keepMine\(_wildMine, wildWho\(\)\);/);
  const frame = w.slice(w.indexOf('const wildFrame = () => {'), w.indexOf('remainsMarkTick(Date.now());'));
  assert.match(frame, /if \(!_wildMineRead\) \{ _wildMineRead = true; _wildMine \?\?= keptMine\(Date\.now\(\), wildWho\(\)\); \}/);
  assert.match(frame, /if \(_wildMine && Date\.now\(\) > _wildMine\.until\) \{ _wildMine = null; keepMine\(null\); \}/);
  assert.match(w, /if \(w\?\.k === 'gone'\) \{ remainsGone\(w\.r\); forgetMine\(w\.r\); \}/);
  assert.match(w, /const wildWho = \(\) => \(realmSession\?\.id != null \? `realm:\$\{realmSession\.id\}` : playerEntity\?\.name \? `name:\$\{playerEntity\.name\}` : null\);/, 'the realm\'s character, else the name');
});
