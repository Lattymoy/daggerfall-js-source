// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT) - a port town's sites kept across
// launches (world/portSitesKept.js, the world host's townPlacesFor asks it). Held here: a kept answer equals
// portSitesOn's and closes the ground as portSitesOn does, without placing again; another ground or another sea refuses
// it; a malformed record is refused; each answer is the caller's own to dress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portSitesOn, seaField } from '../../src/world/portSites.js';
import { keptPortSitesOn, prefetchPortSites, portSitesStamp, portSitesKey, _flushPortSites, _resetPortSites } from '../../src/world/portSitesKept.js';

const W = 96, H = 80;
function groundOf({ blockedAt = () => false, roadAt = () => false } = {}) {
  const blocked = new Uint8Array(W * H), road = new Uint8Array(W * H);
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) { blocked[gy * W + gx] = blockedAt(gx, gy) ? 1 : 0; road[gy * W + gx] = roadAt(gx, gy) ? 1 : 0; }
  return { width: W, height: H, blocked, road };
}
const HOUSES = { blockedAt: (x, y) => x > 30 && x < 50 && y > 20 && y < 60, roadAt: (x, y) => y === 40 };
function storeOf() {
  const m = new Map();
  return { m, async get(k) { return m.get(k) ?? null; }, async set(k, v) { m.set(k, structuredClone(v)); return true; } };
}
async function launch(store) { _resetPortSites(); await prefetchPortSites(store); }

test('FIRST-VISIT port sites: the second launch answers portSitesOn\'s sites, closed on the ground as it closes them, from the record (mutants: the kept sites not closed; the hit ignored)', async () => {
  const store = storeOf();
  const field = seaField(W, H, null, [4, 0]);
  const want = groundOf(HOUSES);
  const wantSites = portSitesOn(want, field);
  assert.equal(wantSites.length, 2, 'the fixture: a shipyard and a lighthouse');
  await launch(store);
  assert.deepEqual(keptPortSitesOn(groundOf(HOUSES), field), wantSites, 'the first launch places');
  await _flushPortSites();
  await launch(store);
  const g = groundOf(HOUSES);
  const got = keptPortSitesOn(g, field);
  assert.deepEqual(got, wantSites);
  assert.deepEqual(g.blocked, want.blocked, 'closed as portSitesOn closes it');
  got[0].name = 'dressed';
  assert.equal(keptPortSitesOn(groundOf(HOUSES), field)[0].name, undefined, 'a caller\'s dressing never reaches the record');
  // served from the record, not placed again: a record whose shipyard stands elsewhere is what answers
  const rec = store.m.get(portSitesKey());
  for (const sites of rec.values()) sites[0].gx += 1;
  await launch(store);
  assert.equal(keptPortSitesOn(groundOf(HOUSES), field)[0].gx, wantSites[0].gx + 1);
  _resetPortSites();
});

test('FIRST-VISIT port sites: another ground or another sea is another key; a malformed record is refused (mutants: the road or the field left out of the stamp; any Map taken)', async () => {
  const field = seaField(W, H, null, [4, 0]);
  const stamp = portSitesStamp(groundOf(HOUSES), field);
  assert.notEqual(portSitesStamp(groundOf({ ...HOUSES, roadAt: (x, y) => y === 41 }), field), stamp);
  assert.notEqual(portSitesStamp(groundOf(HOUSES), seaField(W, H, null, [0, 4])), stamp);
  const store = storeOf();
  store.m.set(portSitesKey(), new Map([[stamp, [{ kind: 'shipyard' }]]]));
  assert.equal(await prefetchPortSites(store), 0, 'refused');
  _resetPortSites();
});
