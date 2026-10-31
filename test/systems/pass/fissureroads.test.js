// STOREFRONT, AUDIT LANE 5 (2026-10-29; bible/06-Systems/Battle-Pass.md section 6): A BRASS FISSURE KEEPS OFF THE ROADS.
// Seven of the season's 344 fissures stood within 12 m of a road's or a track's band on the player's map - one a Heart
// Fissure, 1.2.43.0 by Rhaniriza - their solid slabs across it. A draw whose heart reaches Basic Roads' network (the room's,
// forced on online) is passed over as a draw too near a fissure is (systems/pass/seasonWorld.js), the same on every machine;
// the host stands none before it has read the roads. tools/mutants/storefront_seasonaudit.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stageFissures, FISSURE_ROAD_M, FISSURES_BY_STAGE } from '../../../src/systems/pass/seasonWorld.js';
import { pointNearPath, UNITS_PER_METRE } from '../../../src/world/road/roadClearance.js';
import { MOD_ROADS } from '../../../src/world/roadsProducer.js';
import { createSeasonHost } from '../../../src/scenes/seasonHost.js';
import { gateScanner } from '../../../src/systems/gate/gateSite.js';
import { WoodsFile } from '../../../src/formats/woodsFile.js';
import { HAS_ARENA2, ARENA2, ROOT, loadMaps } from '../../arena1Data.mjs';
import { HEART_T, SCAN, settle } from '../../scenes/seasonRig.mjs';

const vendored = (k) => new Uint8Array(readFileSync(join(ROOT, 'vendor/roads-hazelnut', `${k}Data.bytes`)));
const NET = { roads: vendored('road'), tracks: vendored('track') };
const onRoad = (net, f) => pointNearPath(net, f.px, f.py, f.spot[0] * UNITS_PER_METRE, f.spot[1] * UNITS_PER_METRE, FISSURE_ROAD_M * UNITS_PER_METRE);

test('AUDIT LANE 5 (10): a fissure\'s draw that reaches a road is passed over - none stands on one, the rest where they stood, the same every run (mutants: the roads unread; the margin dropped)', () => {
  const every = { roads: new Uint8Array(500_000).fill(0xff), tracks: new Uint8Array(500_000) };   // a road out of every pixel's middle, every way
  for (const stage of [0, 1, 2]) {
    const bare = stageFissures(1, stage, SCAN), kept = stageFissures(1, stage, SCAN, every);
    assert.deepEqual(stageFissures(1, stage, SCAN, every), kept, 'the same every run');
    assert.ok(kept.every((f) => !onRoad(every, f)), `stage ${stage}: none on a road`);
    const moved = bare.filter((f) => onRoad(every, f));
    // a region's draws go in turn, each apart from the ones before: one off a road, behind none that moved, keeps its pixel
    const movedIn = new Set();
    for (const f of bare) {
      if (onRoad(every, f)) { movedIn.add(f.region); continue; }
      if (!movedIn.has(f.region)) assert.ok(kept.some((k) => k.key === f.key && k.px === f.px && k.py === f.py), `${f.key} kept its pixel`);
    }
    if (stage === 2) assert.ok(moved.length > 0, 'some drawn on a road moved');
  }
  assert.equal(FISSURE_ROAD_M, 12);
});

test('AUDIT LANE 5 (10): on the player\'s map, none of the season\'s fissures within FISSURE_ROAD_M of a road or a track - every region still its stage\'s, a Heart Fissure each; the Heart Fissure by Rhaniriza moved off its road', { skip: HAS_ARENA2 ? false : 'no ARENA2 (sh tools/fetch-data.sh, then ARENA2_PATH)' }, () => {
  const woods = new WoodsFile();
  woods.load(new Uint8Array(readFileSync(join(ARENA2, 'WOODS.WLD'))));
  const scan = gateScanner(loadMaps(), { heightAt: (x, y) => woods.getHeightMapValue(x, y) }).step();
  let near = 0;
  for (const stage of [0, 1, 2]) {
    const bare = stageFissures(1, stage, scan), list = stageFissures(1, stage, scan, NET);
    near += bare.filter((f) => onRoad(NET, f)).length;
    assert.equal(list.length, bare.length, `stage ${stage}: as many`);
    assert.equal(list.length, scan.byRegion.size * FISSURES_BY_STAGE[stage]);
    assert.equal(list.filter((f) => onRoad(NET, f)).length, 0, `stage ${stage}: none on a road`);
    if (stage === 2) {
      assert.equal(list.filter((f) => f.heart).length, scan.byRegion.size);
      const was = bare.find((f) => f.key === '1.2.43.0'), now = list.find((f) => f.key === '1.2.43.0');
      assert.ok(was.heart && onRoad(NET, was) && !onRoad(NET, now) && (was.px !== now.px || was.py !== now.py), 'Rhaniriza\'s Heart Fissure off its road');
    }
  }
  assert.equal(near, 7, 'the seven the audit measured');
});

test('AUDIT LANE 5 (10): the host stands no fissure before Basic Roads\' bytes are read - then the law\'s, kept off them (mutants: the fissures stood before the roads)', async () => {
  const realFetch = globalThis.fetch, realNow = Date.now;
  let answer = null;
  globalThis.fetch = (url) => new Promise((ok) => { answer = () => ok(new Response(String(url) === MOD_ROADS.roads ? NET.roads : String(url) === MOD_ROADS.tracks ? NET.tracks : null, { status: String(url) === MOD_ROADS.roads || String(url) === MOD_ROADS.tracks ? 200 : 404 })); });
  Date.now = () => HEART_T;
  try {
    const host = createSeasonHost({ state: { pixelTranslation: (px, py, out) => out }, gateScanOf: () => SCAN, get online() { return {}; }, _sharedOffsetMs: 0, relayNowS: () => 1, bindPass: false, storage: null });
    assert.deepEqual([host.mapMarks(), host.fissureClears()], [[], []], 'the roads unread: none');
    for (let i = 0; i < 4 && answer; i++) { const a = answer; answer = null; a(); await settle(); }
    assert.deepEqual(host.mapMarks().map((m) => m.key), stageFissures(1, 2, SCAN, NET).map((f) => f.key));
    assert.deepEqual(host.fissureClears().map((c) => [c.px, c.py]), stageFissures(1, 2, SCAN, NET).map((f) => [f.px, f.py]));
  } finally { globalThis.fetch = realFetch; Date.now = realNow; }
});
