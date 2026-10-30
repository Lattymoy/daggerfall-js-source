// FIELD BUGS 2026-10-30f (bible/01-Overview/bugs/Field-Bugs-2026-10-30f.md), the Discord, "Prince Helseth's Blackmail -
// Bugged quest": "If you fast travel to any location, or use overworld travel, you get the message below with the quest
// ending." S0000002 is parsed wherever level 4 finds the player, and its `_1stparton_` (flag 17: 2.5 times the trip to
// the quest's places) was measured there, beside a manor drawn in that region - then Helseth starts it in Wayrest.
// TRIP-FROM-START: a travel clock measures its trip again as it starts, and keeps the longer. TRIP-PIXEL: a site past
// the Bay is measured to its own pixel. The real S0000002 over the freeware where ARENA2_PATH is set (tools/fetch-data.sh).
// Mutants: tools/mutants/fb1030f_triphome.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Clock, travelTimeSeconds } from '../../../src/systems/quest/clock.js';
import { mapPixelToWorldCoord, worldCoordToMapPixel, longitudeLatitudeToMapPixel } from '../../../src/formats/mapsFile.js';
import { calculateTravelTime, arrivalClampMinutes } from '../../../src/systems/travel/travel.js';
import { Symbol as QuestSymbol } from '../../../src/systems/quest/symbol.js';
import { AddAsQuestor, DropAsQuestor } from '../../../src/systems/quest/actions.js';
import { QUEST_REACH_TUNING } from '../../../src/systems/quest/questReach.js';

const ARENA2 = process.env.ARENA2_PATH;
const NO_DATA = ARENA2 ? false : 'ARENA2_PATH unset (sh tools/fetch-data.sh)';
const DAY = 86400, FLOOR = 216000;   // a place's one-day floor, times the 2.5 return
const LETTER = 'Clock _1stparton_ 00:00 0 flag 17 range 0 2';   // S0000002's, verbatim

/** A quest as the clock reads it: its trip to its places (`trip`, seconds, or null headless) and its own clock. */
const questOf = (trip) => ({ rolls: () => 0, trip, now: 1000, travelSeconds() { return this.trip; }, nowSeconds() { return this.now; }, raisedSeconds: () => null, getTask: () => null });

test('TRIP-FROM-START: a travel clock measures its trip again as it starts and keeps the longer - never shorter, never a clock that is not a trip\'s, never one that has run; a measure that throws keeps the parse\'s number (mutants: the start unmeasured; the shorter taken; a run clock measured again; the arm unmarked; the measure unguarded)', () => {
  const q = questOf(FLOOR);
  const c = new Clock(q, LETTER);
  assert.deepEqual([c.travelArm, c.startingTimeInSeconds], [true, FLOOR], 'parsed where the manor is near: the floor');
  q.trip = 100 * DAY;   // Helseth hands the letter over far from it
  c.startTimer();
  assert.deepEqual([c.clockEnabled, c.startingTimeInSeconds, c.remainingTimeInSeconds], [true, 100 * DAY, 100 * DAY], 'the trip from where it starts');
  assert.equal(c.expandMacro(5), '100', '"I have =1stparton_ days" reads it');

  const far = questOf(100 * DAY);
  const f = new Clock(far, LETTER);
  far.trip = FLOOR;   // started nearer than it was parsed
  f.startTimer();
  assert.equal(f.startingTimeInSeconds, 100 * DAY, 'the longer kept - a clock is never made shorter than DFU\'s');

  const day = questOf(FLOOR);
  const s0 = new Clock(day, 'Clock _S.00_ 1.00:00 0 flag 1 range 0 1');   // S0000002's "this time tomorrow": a day, no trip
  day.trip = 100 * DAY;
  s0.startTimer();
  assert.deepEqual([s0.travelArm, s0.startingTimeInSeconds], [false, DAY], 'a declared time defeats the bit-0 hack: never measured');
  assert.equal(new Clock(questOf(FLOOR), 'Clock _c_ 0.00:00 flag 1 range 0 2').travelArm, true, 'the bit-0 hack\'s trip (A0C00Y17\'s shape)');

  const blind = questOf(FLOOR);
  const b = new Clock(blind, LETTER);
  blind.travelSeconds = () => { throw new TypeError('no maps'); };   // a world seam that cannot measure (a test's stub)
  const said = [], warn = console.warn;
  console.warn = (m) => said.push(String(m));
  try { b.startTimer(); } finally { console.warn = warn; }
  assert.deepEqual([b.clockEnabled, b.startingTimeInSeconds], [true, FLOOR], 'a measure that throws keeps the parse\'s number and starts');
  assert.equal(said.length, 1, 'said once');

  const run = questOf(FLOOR);
  const r = new Clock(run, LETTER);
  r.startTimer();
  run.now += 3600;
  r.tick(run);
  r.stopTimer();
  run.trip = 100 * DAY;
  r.startTimer();
  assert.deepEqual([r.startingTimeInSeconds, r.remainingTimeInSeconds], [FLOOR, FLOOR - 3600], 'a clock that has run resumes its remainder');
});

test('TRIP-FROM-START: the mark rides the save - a restored clock measures at its start as the parsed one does, and a save from before the mark reads flag 16 (mutants: the mark unsaved; the old save\'s reading)', () => {
  const q = questOf(FLOOR);
  const restore = (data) => { const c = new Clock(q); c.symbol = new QuestSymbol('_1stparton_'); c.restoreSaveData(data); return c; };   // (the quest's restore names it)
  const letter = new Clock(q, LETTER).getSaveData();
  assert.equal(letter.travelArm, true);
  const back = restore(structuredClone(letter));
  q.trip = 100 * DAY;
  back.startTimer();
  assert.equal(back.startingTimeInSeconds, 100 * DAY, 'restored, then started far off: measured');
  q.trip = FLOOR;
  const hack = new Clock(q, 'Clock _c_ 0.00:00 flag 1 range 0 2').getSaveData();
  assert.equal(restore(structuredClone(hack)).travelArm, true, 'the bit-0 hack\'s mark is the save\'s alone - its flag cannot tell it');
  const old = (data) => { const d = structuredClone(data); delete d.travelArm; return restore(d).travelArm; };
  assert.equal(old(letter), true, 'an older save of S0000002\'s letter: flag 16');
  assert.equal(old(new Clock(q, 'Clock _S.00_ 1.00:00 0 flag 1 range 0 1').getSaveData()), false, 'an older save of its day: no trip');
});

test('TRIP-PIXEL: a site past the Bay is measured to its own pixel, found by its name or not; a site on the Bay to its row\'s world coords, as DFU (mutants: the row\'s coords read past the Bay; a site past the Bay not found counted 0)', () => {
  const player = { x: 600, y: 300 };
  const near = mapPixelToWorldCoord(player.x + 1, player.y);
  const row = (wc) => ({ exterior: { recordElement: { header: { x: wc.x, y: wc.z ?? wc.y } } } });
  const measure = (site, found) => travelTimeSeconds({
    hooks: { world: { maps: { getLocationByName: () => found, getClimateIndex: () => 231 }, playerPixel: () => player } },
    resources: new Map([['p', { isPlace: true, siteDetails: site }]]),
  });
  const bay = row(near);
  assert.deepEqual(worldCoordToMapPixel(bay.exterior.recordElement.header.x, bay.exterior.recordElement.header.y), { x: 601, y: 300 }, 'the fixture\'s row stands a pixel off');
  assert.equal(measure({ regionName: 'Wayrest', locationName: 'Near' }, bay), FLOOR, 'the Bay: the row\'s coords');
  const skyrim = { regionName: 'Skyrim', locationName: 'Ingmald Court', worldPixel: { x: 601, y: 300 } };
  assert.equal(measure(skyrim, row({ x: 0, y: 0 })), FLOOR, 'past the Bay: its own pixel, not the row\'s');
  assert.equal(measure(skyrim, null), FLOOR, 'past the Bay, its name found nowhere: its pixel still measured');
  assert.equal(measure({ regionName: 'Wayrest', locationName: 'Nowhere' }, null), 0, 'a Bay site found nowhere: DFU\'s logged 0');
});

test('TRIP-HOME: a deadline counts the way back to the seat of each at-home individual the quest makes its questor, once a seat and only away from it; a delay, a person not at home and a person never a questor count nothing (mutants: the leg uncounted; counted at the seat; any person; any questor line; a seat twice; every clock)', () => {
  const at = (x, y) => { const wc = mapPixelToWorldCoord(x, y); return { exterior: { recordElement: { header: { x: wc.x, y: wc.z ?? wc.y } } } }; };
  const towns = { Wayrest: at(601, 300), 'Isle of Balfiera': null };
  const regions = { 23: 'Wayrest', 9: 'Isle of Balfiera' };
  const person = (region, extra = {}) => ({ isPerson: true, isIndividualNPC: true, isIndividualAtHome: true, factionData: { region }, ...extra });
  /** A quest with one place a pixel off the player, the persons `persons`, `add X as questor` for `questors` and `drop X as
   *  questor` for `drops`. */
  const quest = (here, persons, questors, drops = []) => {
    const q = { resources: new Map([['manor', { isPlace: true, siteDetails: { regionName: 'Wayrest', locationName: 'Manor' } }]]), tasks: new Map() };
    for (const [name, p] of Object.entries(persons)) q.resources.set(name, p);
    q.tasks.set('yes', { actions: [...questors.map((n) => new AddAsQuestor(q).createNew(`add _${n}_ as questor`, q)),   // the actions' own producers
      ...drops.map((n) => new DropAsQuestor(q).createNew(`drop _${n}_ as questor`, q))] });
    q.hooks = { world: { playerPixel: () => here, maps: {
      getRegion: (r) => (regions[r] ? { name: regions[r] } : null),
      getLocationByName: (rn, ln) => (ln === 'Manor' ? at(here.x + 1, here.y) : towns[ln] ?? null),
      getClimateIndex: () => 231,
    } } };
    return q;
  };
  const away = { x: 600, y: 300 }, home = { x: 601, y: 300 };
  const measure = (q, opts) => travelTimeSeconds(q, null, true, opts);
  const elysana = { elysana: person(23) };
  assert.equal(measure(quest(away, elysana, ['elysana']), { home: true }), 2 * FLOOR, 'away from Wayrest: the manor and the way back');
  assert.equal(measure(quest(away, elysana, ['elysana'])), FLOOR, 'a delay, or the parse: the manor alone');
  assert.equal(measure(quest(home, elysana, ['elysana']), { home: true }), FLOOR, 'at her seat: nothing added');
  assert.equal(measure(quest(away, { helseth: person(23), eadwyre: person(23) }, ['helseth', 'eadwyre']), { home: true }), 2 * FLOOR, 'two questors of one seat: once');
  assert.equal(measure(quest(away, elysana, [], ['elysana']), { home: true }), FLOOR, 'never a questor (only dropped as one): not counted');
  assert.equal(measure(quest(away, { elysana: person(23, { isIndividualAtHome: false }) }, ['elysana']), { home: true }), FLOOR, 'not at home: not counted');
  assert.equal(measure(quest(away, { medora: person(9) }, ['medora']), { home: true }), FLOOR, 'a region with no town of its name: no seat');
});

// ─── WITH ARENA2: THE REPORT, S0000002 OVER THE FREEWARE ─────────────────────────────

let _w = null;
async function world() {
  if (_w) return _w;
  const { standWorldPastBay, questLayerAt } = await import('./r25World.mjs');
  const { loadTables, questSource } = await import('../../qlSources.mjs');
  loadTables();
  _w = { w: await standWorldPastBay(ARENA2), questLayerAt, questSource };
  return _w;
}
const seeded = (seed) => () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const pixelOf = (loc) => longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);

/** S0000002 offered where level 4 finds the player (`from`), the letter handed over in Wayrest: S.00's day, Helseth
 *  clicked (S.01 set, as ClickedNpc sets it), S.03 run. Answers the clock as parsed and as started, and the manor. */
async function letter(from, seed) {
  const { w, questLayerAt, questSource } = await world();
  const wayrest = w.maps.getLocationByName('Wayrest', 'Wayrest');
  const L = await questLayerAt(w, from);
  const now = { s: 1000 };
  L.machine.deps.nowSeconds = () => now.s;
  L.machine.deps.playerLevel = () => 4;
  const q = quiet(() => L.machine.parseQuestForLists(questSource('S0000002', true), 0, { rolls: seeded(seed) }));
  quiet(() => { L.machine.startQuestImmediate(q); L.machine.tick(); });
  const clock = q.getResource({ name: '1stparton' });
  const parsed = clock.startingTimeInSeconds;
  assert.equal(clock.clockEnabled, false, 'not started at the offer');
  L.state.pixel = pixelOf(wayrest); L.state.location = wayrest;
  now.s += DAY + 60;
  quiet(() => { L.machine.tick(); q.getTask(new QuestSymbol('_S.01_')).start(); L.machine.tick(); L.machine.tick(); });
  assert.equal(clock.clockEnabled, true, 'S.03 started it');
  const sd = q.getResource({ name: 'castfort' }).siteDetails;
  const row = w.maps.getLocationByName(sd.regionName, sd.locationName);
  const manor = sd.worldPixel ?? worldCoordToMapPixel(row.exterior.recordElement.header.x, row.exterior.recordElement.header.y);
  return { q, clock, parsed, sd, manor, wayrest: pixelOf(wayrest), maps: w.maps };
}
/** The travel map's default trip there and back, seconds: cautious, inns, ships, on foot, from 9:00, each arrival
 *  clamped as world.js's fast travel clamps it offline. */
function defaultRoundTrip(maps, a, b) {
  const o = { speedCautious: true, sleepModeInn: true, travelShip: true };
  const climate = (x, y) => maps.getClimateIndex(x, y);
  let t = 9 * 60;
  for (const [from, to] of [[a, b], [b, a]]) { const m = calculateTravelTime(from, to, o, climate).minutes; t += m + arrivalClampMinutes(t + m, o); }
  return (t - 9 * 60) * 60;
}

test('FIELD BUGS 2026-10-30f THE REPORT with ARENA2: levelled in Daggerfall, Helseth\'s manor is drawn in Daggerfall\'s region and the clock was the 2.5-day floor; handed over in Wayrest it is measured from Wayrest and outlasts the default trip there and back - and levelled in Wayrest nothing moves (mutants: the start unmeasured)', { skip: NO_DATA }, async () => {
  QUEST_REACH_TUNING.override = true;   // NEARBY-QUESTS, the game's default
  try {
    const { w } = await world();
    const dag = w.maps.getLocationByName('Daggerfall', 'Daggerfall');
    for (const seed of [3, 7, 11]) {
      const r = await letter({ pixel: pixelOf(dag), location: dag }, seed);
      const trip = defaultRoundTrip(r.maps, r.wayrest, r.manor);
      assert.equal(r.sd.regionName, 'Daggerfall', `seed ${seed}: the manor in the region the offer found the player in`);
      assert.ok(r.parsed < trip, `seed ${seed}: the report - ${r.parsed / DAY} days armed at the offer, ${trip / DAY} days of road`);
      assert.ok(r.clock.startingTimeInSeconds >= trip, `seed ${seed}: ${r.clock.startingTimeInSeconds / DAY} days from Wayrest, ${trip / DAY} days of road`);
      assert.equal(r.clock.remainingTimeInSeconds, r.clock.startingTimeInSeconds);
    }
    const way = w.maps.getLocationByName('Wayrest', 'Wayrest');
    const home = await letter({ pixel: pixelOf(way), location: way }, 7);
    assert.equal(home.clock.startingTimeInSeconds, home.parsed, 'levelled in Wayrest: the same trip, the same clock');
    assert.ok(home.parsed >= defaultRoundTrip(home.maps, home.wayrest, home.manor));
  } finally { QUEST_REACH_TUNING.override = null; }
});

test('FIELD BUGS 2026-10-30f PAST THE BAY with ARENA2: levelled in Solitude, the manor is in Skyrim and measured to its own pixel - the 2.5-day floor, not 149 days to a pixel in the Bay - and handed over in Wayrest the clock outlasts the road to Skyrim and back (mutants: the row\'s coords read past the Bay)', { skip: NO_DATA }, async () => {
  QUEST_REACH_TUNING.override = true;
  try {
    const { w } = await world();
    const solitude = { x: 1569, y: -430 };
    const r = await letter({ pixel: solitude, location: w.places.provinceQuestPlaces.standAt(solitude.x, solitude.y) }, 3);
    assert.equal(r.sd.regionName, 'Skyrim');
    assert.ok(r.sd.worldPixel, 'a site past the Bay carries its pixel');
    assert.equal(r.parsed, FLOOR, 'a manor under a day from Solitude: the floor');
    const trip = defaultRoundTrip(r.maps, r.wayrest, r.manor);
    assert.ok(r.clock.startingTimeInSeconds >= trip, `${r.clock.startingTimeInSeconds / DAY} days from Wayrest, ${trip / DAY} days of road`);
  } finally { QUEST_REACH_TUNING.override = null; }
});

/** S0000006 offered where level 6 finds the player (`from`), Yes answered there (its `yes` task, which starts the clock):
 *  the clock as parsed and as started, and the road - the manor, then Elysana in Wayrest. */
async function robe(from, seed) {
  const { w, questLayerAt, questSource } = await world();
  const L = await questLayerAt(w, from);
  L.machine.deps.nowSeconds = () => 1000;
  L.machine.deps.playerLevel = () => 6;
  const q = quiet(() => L.machine.parseQuestForLists(questSource('S0000006', true), 0, { rolls: seeded(seed) }));
  quiet(() => { L.machine.startQuestImmediate(q); L.machine.tick(); });
  const clock = q.getResource({ name: 'queston' });
  const parsed = clock.startingTimeInSeconds;
  quiet(() => { q.getTask(new QuestSymbol('yes')).start(); L.machine.tick(); });
  assert.equal(clock.clockEnabled, true, 'the Yes started it');
  const sd = q.getResource({ name: 'casfort' }).siteDetails;
  const row = w.maps.getLocationByName(sd.regionName, sd.locationName);
  const manor = sd.worldPixel ?? worldCoordToMapPixel(row.exterior.recordElement.header.x, row.exterior.recordElement.header.y);
  const o = { speedCautious: true, sleepModeInn: true, travelShip: true };
  const climate = (x, y) => w.maps.getClimateIndex(x, y);
  let t = 9 * 60;
  for (const [a, b] of [[from.pixel, manor], [manor, pixelOf(w.maps.getLocationByName('Wayrest', 'Wayrest'))]]) { const m = calculateTravelTime(a, b, o, climate).minutes; t += m + arrivalClampMinutes(t + m, o); }
  return { clock, parsed, road: (t - 9 * 60) * 60 };
}

test('TRIP-HOME with ARENA2: Elysana\'s Robe offered in Daggerfall or in Solitude armed 2.5 to 5.4 days for weeks of road back to Wayrest; now its deadline counts the way back to her, and offered in Wayrest nothing moves (mutants: the leg uncounted; counted at the seat)', { skip: NO_DATA }, async () => {
  QUEST_REACH_TUNING.override = true;
  try {
    const { w } = await world();
    const dag = w.maps.getLocationByName('Daggerfall', 'Daggerfall');
    const solitude = { x: 1569, y: -430 };
    for (const [where, from] of [['Daggerfall', { pixel: pixelOf(dag), location: dag }], ['Solitude', { pixel: solitude, location: w.places.provinceQuestPlaces.standAt(solitude.x, solitude.y) }]]) {
      for (const seed of [3, 7]) {
        const r = await robe(from, seed);
        assert.ok(r.parsed < r.road, `${where} seed ${seed}: the report's shape - ${r.parsed / DAY} days for ${r.road / DAY} of road`);
        assert.ok(r.clock.startingTimeInSeconds >= r.road, `${where} seed ${seed}: ${r.clock.startingTimeInSeconds / DAY} days for ${r.road / DAY} of road`);
      }
    }
    const way = w.maps.getLocationByName('Wayrest', 'Wayrest');
    const home = await robe({ pixel: pixelOf(way), location: way }, 7);
    assert.equal(home.clock.startingTimeInSeconds, home.parsed, 'offered at her seat: DFU\'s clock');
  } finally { QUEST_REACH_TUNING.override = null; }
});

test('TRIP-HOME with ARENA2: a delay counts no way back - S0000012\'s `_2palace_` (the messenger comes when it ends) started away from the Queen\'s Daggerfall is measured without it (mutants: every clock)', { skip: NO_DATA }, async () => {
  QUEST_REACH_TUNING.override = true;
  try {
    const { w, questLayerAt, questSource } = await world();
    const sen = w.maps.getLocationByName('Sentinel', 'Sentinel');
    const L = await questLayerAt(w, { pixel: pixelOf(sen), location: sen });
    L.machine.deps.nowSeconds = () => 1000;
    const q = quiet(() => L.machine.parseQuestForLists(questSource('S0000012', true), 0, { rolls: seeded(7) }));
    const palace = q.getResource({ name: '2palace' });
    assert.equal(palace.isDeadline, false, 'a delay');
    const parsed = palace.startingTimeInSeconds, plain = q.travelSeconds(), withHome = q.travelSeconds({ home: true });
    assert.ok(withHome > Math.max(parsed, plain), 'the Queen\'s seat is away: a deadline would count it');
    palace.startTimer();
    assert.equal(palace.startingTimeInSeconds, Math.max(parsed, plain), 'the delay keeps the trip alone');
  } finally { QUEST_REACH_TUNING.override = null; }
});
