// FIELD BUGS 2026-10-21b VOYAGE-HOLD (bible/01-Overview/bugs/Field-Bugs-2026-10-21b.md): grayhatharry, "I had a quest that
// wanted me to sail from one port to another, I bought a boat, sailed from one port town to another just a shy journey down
// the coast ... he informed me I hadn't sailed at all." "Under Sail" (QLIS01) waits on `port-reached`, which the harbour
// office says at a berth a quarter league on from the port she sailed from (scenes/harbourOffice.js PORT_VOYAGE_M). Each
// voyage here runs on the REAL naval host (test/navalSea.mjs), the REAL harbour office and captain ledger, the act sink
// listening - fb1020c_berthring.test.js's voyage, with the boat's pace and her arrival varied as players sail.
import './../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea } from '../../navalSea.mjs';
import { createHarbourOffice, PORT_VOYAGE_M } from '../../../src/scenes/harbourOffice.js';
import { createCaptainLedger } from '../../../src/systems/naval/captainLedger.js';
import { setActSink } from '../../../src/systems/questlines/qlActs.js';
import { BERTH_STILL } from '../../../src/scenes/naval/navalBerth.js';
import { boardPortAt, SEA_RING, seaBears } from '../../../src/world/portSites.js';
import { portTerrain, HAS_ARENA2 } from '../../portTerrain.mjs';
import { PORT_LOCATION_IDS } from '../../../src/systems/travel/travelPorts.js';
import { isPortTownType } from '../../../src/systems/portPlaces.js';
import { getPixelFromPixelID } from '../../../src/formats/mapsFile.js';

const A = { key: '152,35', name: 'Longham' }, B = { key: '152,38', name: 'Pencart' };
const OPEN = { nearPort: false, port: null };
/** A captain at her helm (a Small Ship's hull - the pace is the test's), her ledger, the harbour office, the acts heard. */
async function rig() {
  const heard = [], berths = [];
  setActSink((kind) => { heard.push(kind); return 1; });
  const L = createCaptainLedger();
  const office = createHarbourOffice({ ledger: L, now: () => 0, day: () => 3, level: () => 5, gold: () => 0, pay() {}, credit() {}, say() {}, mid() {}, notorietyOf: () => 0, port: () => null, ports: () => [], seaAt: () => true, waters: () => null });
  const w = { ...OPEN };
  const h = await sea({ hull: 2 });
  h.deps.where = () => ({ px: 100, py: 100, region: 23, day: 1, capitals: [{ region: 23, x: 100, y: 100 }], cityLights: false, night: false, ...w });
  h.deps.captain = { event: (ev) => { if (ev.type === 'berth') berths.push(ev); return office.event(ev); }, sites: () => [], sailed: (m) => L.sailed(m) };
  /** Where she is and her way (m/s) - the stand-in runtime's own way is its velocity. */
  const at = (where, v) => { Object.assign(w, OPEN, where); h.runtime.state.velocityCurrent = [0, 0, v]; };
  return { h, L, office, heard, berths, at };
}
const done = () => setActSink(null);

test('VOYAGE-HOLD the report: a Rowboat\'s pace (2 m/s) out of one port\'s waters straight into the next\'s - counted from where she lay, so the next port is reached', async () => {
  const r = await rig();
  try {
    r.at({ port: A }, 0); r.h.run(3);   // lying at Longham's quay
    r.at({ port: A }, 2); r.h.run(500);   // rowing out through Longham's waters - a slow berth every step, not still
    r.at({ port: B }, 2); r.h.run(200);   // into Pencart's: a thousand metres from the quay, then on
    assert.ok(r.berths.some((e) => e.port === A.key && e.still === false), 'her slow way through her port\'s waters berths, not still');
    assert.deepEqual(r.heard, ['port-reached'], 'a quarter league from where she lay - the departure no longer follows her out');
    r.at({ port: B }, 0); r.h.run(3);
    assert.equal(r.heard.length, 1, 'lying at the new quay: once');
  } finally { done(); }
});

test('VOYAGE-HOLD drifting where two ports\' waters meet: lying still in each in turn makes no voyage, however long', async () => {
  const r = await rig();
  try {
    for (let i = 0; i < 8; i++) { r.at({ port: i % 2 ? B : A }, BERTH_STILL * 0.8); r.h.run(600); }   // 0.4 m/s, 240 m each, 1.9 km in all
    assert.ok(r.L.log.sailed > PORT_VOYAGE_M);
    assert.deepEqual(r.heard, [], 'each port she lies in her departure, in turn');
  } finally { done(); }
});

test('VOYAGE-HOLD out and back, then a short hop: the voyage counts from where she last lay, never a loop made before it', async () => {
  const r = await rig();
  try {
    r.at({ port: A }, 0); r.h.run(3);
    r.at({}, 6); r.h.run(PORT_VOYAGE_M / 6 + 60);   // a loop out at sea
    r.at({ port: A }, 0); r.h.run(3);   // home to Longham's quay, lying there
    r.at({ port: A }, 2); r.h.run(100); r.at({ port: B }, 2); r.h.run(50);   // 300 m on into Pencart's waters
    r.at({ port: B }, 0); r.h.run(3);
    assert.deepEqual(r.heard, [], 'a short hop from where she lay');
  } finally { done(); }
});

test('VOYAGE-HOLD brought in at speed and the helm let go: the port is reached (no slow berth was ever said for it)', async () => {
  const r = await rig();
  try {
    r.at({ port: A }, 0); r.h.run(3);
    r.at({}, 6); r.h.run(PORT_VOYAGE_M / 6 + 20);
    r.at({ port: B }, 6); r.h.run(0.5);
    r.h.runtime.sailing = false; r.h.runtime.state.velocityCurrent = [0, 0, 0];   // Come Sail Away's StopSailingDelayed: her way off at once
    r.h.run(5);
    assert.deepEqual(r.heard, ['port-reached']);
    assert.ok(r.berths.some((e) => e.port === B.key && e.still === true), 'the helm let go in her waters is a berth, still');
    r.h.run(30);
    assert.equal(r.berths.filter((e) => e.port === B.key).length, 1, 'said once, at the letting go');
    // and let go out at sea, nothing; nor in port with a hostile near (the serpent's waters - no berth, as the yard's law)
    const s = await rig();
    try { s.at({ port: A }, 0); s.h.run(3); s.at({}, 6); s.h.run(PORT_VOYAGE_M / 6 + 20); s.h.runtime.sailing = false; s.h.run(5); assert.deepEqual(s.heard, [], 'let go at sea'); }
    finally { done(); }
    const f = await rig();
    try {
      f.at({ port: A }, 0); f.h.run(3); f.at({}, 6); f.h.run(PORT_VOYAGE_M / 6 + 20); f.at({ port: B }, 6); f.h.run(0.5);
      f.h.deps.serpent = { near: () => true };
      const p = f.h.boat.GameObject.position;
      f.h.view.feet = [p[0], p[1] + 3, p[2]];   // on her deck as the helm is let go
      f.h.runtime.sailing = false; f.h.run(5);
      assert.deepEqual(f.heard, [], 'let go with a hostile near');
    } finally { done(); }
  } finally { done(); }
});

test('VOYAGE-HOLD run aground in the next port\'s waters at the helm: she lies still, so she berths - and logs no leagues while she lies', async () => {
  const r = await rig();
  try {
    r.at({ port: A }, 0); r.h.run(3);
    r.at({}, 6); r.h.run(PORT_VOYAGE_M / 6 + 20);
    r.at({ port: B }, 9.86); r.h.runtime.IsBeached = () => true;   // the runtime keeps a beached boat's last way (a Small Ship read 9.86 m/s)
    const before = r.L.log.sailed;
    r.h.run(20);
    assert.deepEqual(r.heard, ['port-reached']);
    assert.equal(r.L.log.sailed, before, 'no leagues logged aground (197 m in 20 s before)');
  } finally { done(); }
});

test('VOYAGE-HOLD a load between the two ports (a relog, a reload, a crash) keeps the voyage', async () => {
  const r = await rig();
  try {
    r.at({ port: A }, 0); r.h.run(3);
    r.at({}, 6); r.h.run(100);
    r.L.restoreSaveData(JSON.parse(JSON.stringify(r.L.getSaveData())));   // the save's record, as the world's mod loop restores it
    r.h.run(PORT_VOYAGE_M / 6);
    r.at({ port: B }, 1); r.h.run(3);
    assert.deepEqual(r.heard, ['port-reached']);
  } finally { done(); }
});

test('VOYAGE-HOLD boardPortAt: the nearest board port within SEA_RING by the crow\'s flight - a tie of the ring\'s squares no longer the list\'s first; outside every ring, none', () => {
  const a = { key: 'a', px: 0, py: 0 }, b = { key: 'b', px: 4, py: 1 }, c = { key: 'c', px: 10, py: 0 };
  const ports = [a, b, c];
  assert.equal(boardPortAt(ports, 2, 1), b, 'two squares from each, the second listed nearer by the crow (4 against 5)');
  assert.equal(boardPortAt(ports, 1, 0), a);
  assert.equal(boardPortAt(ports, 0, SEA_RING), a, 'the ring\'s edge');
  assert.equal(boardPortAt(ports, -SEA_RING - 1, 0), null, 'past it');
  assert.equal(boardPortAt(ports, 7, 0), null, 'between rings');
  assert.equal(boardPortAt(ports, 8, 2), c, 'a corner of the ring: 2 squares, 8 by the crow - still within');
});

/** The board ports as the world host lists them (scenes/world.js navalPortList), in its order - the order a tie read. */
function boardPorts(t) {
  const out = new Map();
  for (const id of new Set(PORT_LOCATION_IDS)) {
    const s = t.dict.get(id & 0x000fffff);
    if (!s || !isPortTownType(s.locationType)) continue;
    const at = getPixelFromPixelID(s.id);
    if (!seaBears(at.x, at.y, t.openSea)) continue;
    const name = t.maps.getRegion(s.regionIndex)?.mapNames?.[s.mapIndex];
    const key = `${at.x},${at.y}`;
    if (!name || out.has(key)) continue;
    out.set(key, { key, name, px: at.x, py: at.y });
  }
  return [...out.values()];
}
test('VOYAGE-HOLD (ARENA2): the port whose waters a pixel lies in is the nearest by the crow\'s flight - every one of the 106 board ports names water a Small Ship lies in; by the ring\'s squares Pencart\'s every pixel tied Longham\'s and went to the list\'s first', { skip: !HAS_ARENA2 && 'no ARENA2 (tools/fetch-data.sh)' }, () => {
  const t = portTerrain();
  const board = boardPorts(t);
  assert.equal(board.length, 106);
  const bySquares = (x, y) => { let port = null, best = Infinity; for (const q of board) { const d = Math.max(Math.abs(q.px - x), Math.abs(q.py - y)); if (d <= SEA_RING && d < best) { best = d; port = q; } } return port; };
  const owned = (rule) => {
    const m = new Map(board.map((p) => [p.key, 0])), seen = new Set();
    for (const p of board) for (let dy = -SEA_RING; dy <= SEA_RING; dy++) for (let dx = -SEA_RING; dx <= SEA_RING; dx++) {
      const x = p.px + dx, y = p.py + dy;
      if (seen.has(`${x},${y}`)) continue;
      seen.add(`${x},${y}`);
      const w = t.shipWater(x, y), q = w ? rule(x, y) : null;
      if (q) m.set(q.key, m.get(q.key) + w);
    }
    return board.filter((p) => !m.get(p.key)).map((p) => p.name);
  };
  assert.deepEqual(owned(bySquares), ['Pencart'], 'the bug: no berth could ever name Pencart');
  assert.deepEqual(owned((x, y) => boardPortAt(board, x, y)), [], 'every one names water of its own');
  const pencart = board.find((p) => p.name === 'Pencart'), longham = board.find((p) => p.name === 'Longham');
  assert.equal(boardPortAt(board, 150, 37), pencart, 'its pixel two from each, 1,832 m from Pencart and 2,317 m from Longham');
  assert.equal(boardPortAt(board, 151, 36), longham);
  assert.equal(boardPortAt(board, 0, 0), null, 'the map\'s corner, outside every ring: none');
});
