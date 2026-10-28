// AUDIT BAY-LEFT, its packages merged (2026-10-27, bible/01-Overview/audits/Audit-Left-In-The-Bay.md): THE SEAM BETWEEN
// WW-GATES-EVERYWHERE A2c AND WW5. A2c made a province's gate scan a few ring pixels an idle moment
// (scenes/gate/gateLanes.js createTheatreGateScans' warm); WW5's Starfall and Hollow lanes read the same scans
// (scenes/eventTheatres.js) and made a theatre's scan in one idle moment of their own (`scanOf`) - merged, every province's
// walk was one task again (A2c's probe: 200 to 700 ms a province cold). The event lanes ask `wholeScan` and wait on the
// gate's own slices. tools/mutants/bayleft_scanseam.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTheatreGateScans } from '../../../src/scenes/gate/gateLanes.js';
import { createEventTheatres } from '../../../src/scenes/eventTheatres.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { THEATRE_KEYS } from '../../../src/world/worldWide/worldGrid.js';
import { CITIES } from '../../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay, inBay, setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';

/** A province's towns from TAMRIEL1's cities (the authored shape), off the Bay - ww_gates_everywhere.test.js's rows. */
const provinceRows = (province, base) => CITIES.filter((c) => c.province === province).map((c, i) => { const [px, py] = pictureToBay(c.at[0], c.at[1]).map(Math.floor); return { mapId: base + i, name: c.name, px, py, type: LOCATION_TYPES.TownCity }; }).filter((r) => !inBay(r.px, r.py));

/** The registry with its place asks counted. */
function counted() {
  const places = createWorldPlaces();
  places.register('tesa', [...provinceRows('Skyrim', 50_000), ...provinceRows('Morrowind', 51_000)]);
  const n = { asks: 0 };
  return { n, places: { generation: places.generation, theatres: places.theatres, inTheatre: places.inTheatre, at: (x, y) => { n.asks++; return places.at(x, y); } } };
}

/** An idle moment with a little time in it (the gate's slices step until it is spent). */
const moment = () => { let left = 3; return { didTimeout: false, timeRemaining: () => (left-- > 0 ? 10 : 0) }; };

test('AUDIT BAY-LEFT THE SCAN SEAM: wholeScan answers a whole scan, or none and the gate\'s warm begun - never a walk in the asking task where the page has idle moments; with none, or for a theatre no gate lane stands on, made where it is asked as scanOf is (mutants: a scan made whole in the ask; the page with no idle moments answered none; a closed lane\'s theatre never made)', () => {
  setTamrielTrace(null); setTamrielFit(null);
  const sky = THEATRE_KEYS.indexOf('Skyrim'), mor = THEATRE_KEYS.indexOf('Morrowind');
  const { n, places } = counted();
  const gq = [];
  const scans = createTheatreGateScans({ places, wet: () => false, idle: (fn) => gq.push(fn), clock: () => 0 });
  assert.equal(scans.wholeScan(sky), null, 'not whole yet: none');
  assert.equal(n.asks, 0, 'and no place asked in the asking task');
  assert.equal(gq.length, 1, 'the gate\'s warm begun');
  while (gq.length) gq.shift()(moment());
  const sc = scans.wholeScan(sky);
  assert.ok(sc && sc.towns.length > 0, 'whole once the gate\'s slices are done');
  const at = n.asks;
  assert.equal(scans.wholeScan(sky), sc, 'kept: the same scan');
  assert.equal(n.asks, at, 'and nothing asked again');
  // no idle moments (a probe's, node's): made where it is asked, the scan scanOf makes
  const bare = counted();
  const now = createTheatreGateScans({ places: bare.places, wet: () => false, idle: null });
  const made = now.wholeScan(sky);
  assert.ok(made && made.towns.length === sc.towns.length, 'no idle moments: made at once');
  assert.deepEqual([...made.byArea].map(([a, l]) => [a, [...l]]), [...sc.byArea].map(([a, l]) => [a, [...l]]), 'the same scan the slices made');
  // a theatre the warm does not make (its gate lane shut): made where it is asked, never waited on for ever
  const shut = counted();
  const closed = createTheatreGateScans({ places: shut.places, wet: () => false, idle: () => {}, clock: () => 0, open: (t) => t !== mor });
  const m = closed.wholeScan(mor);
  assert.ok(m && m.towns.length > 0, 'a closed lane\'s theatre: made where it is asked');
});

test('AUDIT BAY-LEFT THE SCAN SEAM: the Starfall\'s and the Hollows\' theatres (eventTheatres) wait on the gate\'s slices - no idle moment of theirs walks a theatre; owed until the gate\'s scan is whole, then warm with no ask again; a scans object with no wholeScan (a test\'s, an older host\'s) is scanned as before (mutants: the drain made the scan whole itself; the owed theatre dropped before it is whole)', () => {
  setTamrielTrace(null); setTamrielFit(null);
  const sky = THEATRE_KEYS.indexOf('Skyrim');
  const { n, places } = counted();
  const gq = [], eq = [];
  const scans = createTheatreGateScans({ places, wet: () => false, idle: (fn) => gq.push(fn), clock: () => 0 });
  const T = createEventTheatres({ scans: () => scans, generation: places.generation, idle: (fn) => eq.push(fn) });
  assert.equal(T.scanOf(sky), null, 'asked: none yet');
  assert.equal(eq.length, 1, 'an idle moment of the events\' owed');
  let worst = 0, drains = 0;
  for (let guard = 0; guard < 10_000 && (eq.length || gq.length); guard++) {
    if (eq.length) { const before = n.asks; eq.shift()(); drains++; worst = Math.max(worst, n.asks - before); }
    if (gq.length) gq.shift()(moment());
  }
  assert.ok(drains > 1, `the theatre waited on over ${drains} of the events' idle moments`);
  assert.equal(worst, 0, 'no idle moment of the events\' asked a single place - the walk is the gate\'s slices\'');
  assert.equal(T.ready(sky), true, 'warm once whole, with no ask again');
  assert.ok(T.scanOf(sky)?.towns.length > 0);
  // a scans object with no wholeScan: scanned in the events' idle moment, as WW5 shipped it
  const plain = { scanOf: (t) => ({ theatre: t, byArea: new Map(), towns: [], townOf: new Map() }), theatres: () => [], siteOf: () => null };
  const q = [];
  const P = createEventTheatres({ scans: () => plain, idle: (fn) => q.push(fn) });
  P.scanOf(sky);
  q.shift()();
  assert.equal(P.ready(sky), true, 'no wholeScan: made in the one idle moment');
});
