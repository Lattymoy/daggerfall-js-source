// FB1020c BERTH-RING (the field, 2026-10-20: "during the tutorial quest where you need to sail from one harbor too another
// the objective doesnt register as complete") - A PORT'S WATERS ARE THE PORT LAW'S RING (scenes/world.js navalPortHere
// and where().port, scenes/naval/navalHost.js inPortWaters, systems/naval/harbourBoard.js deliveryPort).
//
// "Under Sail" (QLIS01) and "The Packet Lanes" (QLOC02) wait on `port-reached`, which the harbour office says at a berth
// at another port a quarter league under sail after the last (scenes/harbourOffice.js); a berth is the naval host's -
// at her helm, slow, no hostile ship near, in a port's waters (navalHost.js siteStep, yardHere). A port's waters were a
// map pixel about the player's (navalPortHere, and navalNearPort's flagged place), and the shore DFU's kernel builds lies
// past it at twelve of the harbour board's ports - no water a Small Ship lies in within a pixel of Daggerfall or Wayrest:
// a voyage out of or into one never counted, a cargo for one never arrived, its shipwright never stood. The ring is the
// port law's now - SEA_RING, the open sea's reach that makes a town a port (world/portSites.js) - for the berth, the
// shipwright and the crew's port, the board's port lain at, and the ports a cargo goes to. The sea's traffic and its
// waters (navalDirector.js factionWeights, watersOf: `nearPort` alone) ask another question and keep their pixel.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sea } from '../../navalSea.mjs';
import { createHarbourOffice, PORT_VOYAGE_M } from '../../../src/scenes/harbourOffice.js';
import { createCaptainLedger } from '../../../src/systems/naval/captainLedger.js';
import { setActSink } from '../../../src/systems/questlines/qlActs.js';
import { deliveryPort } from '../../../src/systems/naval/harbourBoard.js';
import { SEA_RING } from '../../../src/world/portSites.js';
import { hostText } from '../../hostText.mjs';
import { portTerrain, HAS_ARENA2 } from '../../portTerrain.mjs';

const DAGGERFALL = { key: '207,213', name: 'Daggerfall' }, SENTINEL = { key: '397,343', name: 'Sentinel' };

/** A voyage at my helm on the real naval host, the real harbour office and the captain's ledger, the act's sink
 *  listening: lying where her voyage begins (`from` - the world's where(): `{ nearPort, port }`), a quarter league and
 *  more under way out of every port's waters, then lying slow at `to`. Answers the berths said and the acts heard. */
async function voyage(from, to) {
  const heard = [], berths = [];
  setActSink((kind) => { heard.push(kind); return 1; });
  try {
    const L = createCaptainLedger();
    const office = createHarbourOffice({ ledger: L, now: () => 0, day: () => 3, level: () => 5, gold: () => 0, pay() {}, credit() {}, say() {}, mid() {}, notorietyOf: () => 0, port: () => null, ports: () => [], seaAt: () => true, waters: () => null });
    const w = { nearPort: false, port: null };
    const h = await sea({ hull: 2 });
    h.deps.where = () => ({ px: 100, py: 100, region: 23, day: 1, capitals: [{ region: 23, x: 100, y: 100 }], cityLights: false, night: false, ...w });
    h.deps.captain = { event: (ev) => { if (ev.type === 'berth') berths.push(ev.port); return office.event(ev); }, sites: () => [], sailed: (m) => L.sailed(m) };
    const lie = (at, v) => { Object.assign(w, at); h.runtime.state.velocityCurrent = [0, 0, v]; };
    lie(from, 0); h.run(3);
    lie({ nearPort: false, port: null }, 6); h.run(PORT_VOYAGE_M / 6 + 20);
    lie(to, 1); h.run(3);
    return { heard, berths };
  } finally { setActSink(null); }
}

test('FB1020c BERTH-RING the berth: a board port within SEA_RING of her pixel is a port\'s waters whether or not a flagged place lies within one - out of Daggerfall\'s ring and into Sentinel\'s, a port reached under sail; with no port in either ring, no berth (the bug\'s record: the berth asked a flagged place within a pixel, and at Daggerfall no ship can lie within one) (mutants: the shipwright reads `nearPort` alone; inPortWaters reads `port` alone)', async () => {
  const ring = await voyage({ nearPort: false, port: DAGGERFALL }, { nearPort: false, port: SENTINEL });
  assert.deepEqual([...new Set(ring.berths)], [DAGGERFALL.key, SENTINEL.key], 'both berths said in the ring');
  assert.deepEqual(ring.heard, ['port-reached'], 'the tutorial\'s act');
  const pixel = await voyage({ nearPort: true, port: DAGGERFALL }, { nearPort: true, port: SENTINEL });
  assert.deepEqual(pixel.heard, ['port-reached'], 'within a pixel, as it always was');
  const none = await voyage({ nearPort: false, port: null }, { nearPort: false, port: SENTINEL });
  assert.deepEqual(none.berths.filter((k) => k === DAGGERFALL.key), [], 'no port in reach where she began: no berth there');
  assert.deepEqual(none.heard, [], 'her first berth only marks where she lies (the harbour office\'s own law)');
  const flagged = await voyage({ nearPort: true, port: null }, { nearPort: false, port: SENTINEL });
  assert.deepEqual(flagged.heard, [], 'a flagged place no board port is no port a berth names');
});

test('FB1020c BERTH-RING a cargo goes to a port the sea bears on within SEA_RING - the ring the berth names it in (mutants: the ring a pixel; the sea not asked)', () => {
  assert.equal(SEA_RING, 2);
  const seaSouth = (x, y) => y >= 102;
  assert.deepEqual([100, 101, 99].map((py) => deliveryPort({ px: 50, py }, seaSouth)), [true, true, false], 'two pixels off the sea and nearer; three off, none');
  assert.equal(deliveryPort({ px: 50, py: 100 }, null), false);
});

test('FB1020c BERTH-RING by source: the board\'s port lain at is the nearest within SEA_RING, imported where it lives; where() hands it whether or not a flagged place is near; the berth, the shipwright and the crew\'s port read the two through one question; navalNearPort keeps its pixel for the sea\'s traffic and its waters (mutants: the ring a literal; where() gates the port on nearPort)', () => {
  const W = hostText('src/scenes/world.js');
  // PIN MOVED (FIELD BUGS 2026-10-21b VOYAGE-HOLD): the ring and the nearest within it are the port law's own, read where
  // they live (world/portSites.js boardPortAt - by the crow's flight, a tie no longer the list's first)
  assert.match(W, /import \{[^}]*\bboardPortAt\b[^}]*\} from '\.\.\/world\/portSites\.js';/);
  assert.match(W, /const port = boardPortAt\(navalPortList\(\), p\.x, p\.y\);/);
  assert.match(W, /nearPort, port: navalPortHere\(\), waters: ether \? 'ether' : watersOf\(\{ nearPort, portPx: navalPortPx\(\) \}\),/);
  assert.match(W, /for \(let dy = -1; dy <= 1 && !near; dy\+\+\) for \(let dx = -1; dx <= 1 && !near; dx\+\+\) near = csaIsPortTown\(p\.x \+ dx, p\.y \+ dy\);/, 'the traffic\'s port stays a pixel');
  const N = readFileSync(new URL('../../../src/scenes/naval/navalHost.js', import.meta.url), 'utf8');
  assert.match(N, /const inPortWaters = \(\) => \{ const w = where\(\); return !!\(w\.nearPort \|\| w\.port\); \};/);
  assert.match(N, /if \(!enabled \|\| !boat \|\| !inPortWaters\(\)\) return false;/, 'the shipwright, and the berth through him');
  assert.match(N, /inPort: inPortWaters\(\) && Math\.hypot\(v\[0\], v\[2\]\) <= YARD_SPEED && !hostile, atSea: !inPortWaters\(\)/, 'the crew\'s port');
  assert.match(N, /nearPort: !!w\.nearPort, deep: w\.waters === 'deep'/, 'the traffic\'s port weights: the pixel, unchanged');
  assert.equal((N.match(/where\(\)\.nearPort/g) ?? []).length, 0, 'no reader of the port\'s pixel left beside the traffic\'s');
});

/** The twelve board ports with no water a Small Ship lies in within one map pixel - the berth's old ring. */
const RING_ONE_DRY = Object.freeze(['Aldbrugh', 'Daggerfall', 'Gallocart', 'Holwych', 'Isfakabi', 'Longmore Field', 'Longwich End', 'Pencart', 'Ripmore', 'Wartale', 'Wayrest', 'Wilderham']);

test('FB1020c BERTH-RING (ARENA2): every one of the 106 board ports has water a Small Ship lies in (a 45 m square) within SEA_RING of its pixel on the ground the game builds; within one pixel twelve had none - Daggerfall and Wayrest among them', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, () => {
  const t = portTerrain();
  assert.equal(t.towns.length, 106);
  const within = (town, r) => { let n = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) n += t.shipWater(town.px + dx, town.py + dy); return n; };
  const dryOne = t.towns.filter((town) => within(town, 1) === 0).map((town) => town.name).sort();
  assert.deepEqual(dryOne, [...RING_ONE_DRY], 'the bug: no berth could ever name them');
  assert.deepEqual(t.towns.filter((town) => within(town, SEA_RING) === 0).map((town) => town.name), [], 'within the ring, every one');
});
