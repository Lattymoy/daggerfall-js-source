// AUDIT LW-STIR D10 (2026-10-08; bible/01-Overview/Audit-LW-Stir.md): THE STREET'S STIR, MEASURED - the synthetic row of
// LW-STIR's measured table (bible/06-Systems/Living-World.md "LW-STIR", "Measured"), which no harness or day could re-run:
// lens D's own measure, committed. No GPU and no ARENA2: the synthetic town the pins stand (test/lwTown.mjs synthTown),
// its day's incidents as the town deals them (livingTown.js _stirOf) and every resident's small voices over the day's
// plans (stir.js smallVoice, sampled every `step` minutes), averaged over `days`. Its visitors as the roads mint them:
// in at the four gates through the morning and the afternoon, each party of two leaving no sooner than two hours on.
//
// Usage: node tools/livingStirProbe.mjs [blocks=9] [visitors=12] [step=0.05] [days=100,101,102]
//   blocks 9 posts no gate (WATCH-DAY: one for each nine blocks past nine); 45 posts the four.
import { synthTown } from '../test/lwTown.mjs';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { travellerRoster } from '../src/systems/livingWorld/census.js';
import { DAY_MIN, DAY_START_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { smallVoice, humourOf } from '../src/systems/livingWorld/stir.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const RATE = CLASSIC_MINUTES_PER_SECOND, MPM = PERSON_MOVE_SPEED / RATE, MAP = 24680;
const blocks = Number(process.argv[2] ?? 9), nVis = Number(process.argv[3] ?? 12), step = Number(process.argv[4] ?? 0.05);
const days = (process.argv[5] ?? '100,101,102').split(',').map(Number);
const built = synthTown();
/** @type {Record<string, number>} */
const tot = {};
const add = (/** @type {string} */ k, n = 1) => { tot[k] = (tot[k] ?? 0) + n; };
for (const day of days) {
  const D0 = day * DAY_MIN + DAY_START_MIN;
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const vis = travellerRoster({ mapId: 999, blocks: 45, region: 17, people: 3 }).slice(0, nVis).map((res, i) => {
    const inT = D0 + 300 + ((Math.floor(i / 2) * 2 * 97) % 700);   // in twos, a party apiece
    return { res, inT, outT: Math.max(day * DAY_MIN + 17 * 60, inT + 120), yaw: yaws[Math.floor(i / 2) % 4], dock: false, trip: { from: { name: 'Wayrest' }, party: [res] } };
  });
  const lt = new LivingTown(built.nav, {
    town: { mapId: MAP, blocks, region: 17, people: 3, port: false }, buildings: built.buildings, doors: built.doors,
    makePerson: () => null, suppressSpawns: () => true, clock: () => D0, rate: () => RATE, mpm: MPM,
    tripsOf: () => ({ away: new Map(), visitors: vis, holders: null, news: null, places: ['Daggerfall', 'Sentinel'] }),
  });
  lt._now = day * DAY_MIN + 12 * 60; lt._tick([0, 0, 0], 0);
  const people = lt.peopleOf(day);
  add('people', people.length);
  const strangers = new Set();
  for (const list of lt._stirDays.get(day)?.by.values() ?? []) {
    for (const inc of list) {
      add(inc.kind);
      if (inc.kind === 'gate' || inc.kind === 'challenge') strangers.add(inc.members[1].id);
      if (inc.guard) add('broken up');
    }
  }
  add('strangers questioned', strangers.size);
  for (const id of strangers) { const r = people.find((p) => p.id === id); if (r && humourOf(r, day) === 'hostile') add('hostile of them'); }
  const fromTavern = (/** @type {any} */ e) => e.from?.kind === 'door' && lt.typeOf(e.from.building) === BUILDING_TYPES.Tavern;
  for (const res of people) {
    for (const e of lt.planOf(res, day)) {
      let was = null;
      for (let t = Math.max(e.t0, D0); t < Math.min(e.t1, D0 + DAY_MIN); t += step) {
        const v = smallVoice(res, e, t, RATE, { town: 'X', weather: null }, fromTavern);
        if (v && v.text !== was) add(v.kind === 'sing' ? 'songs' : e.kind === 'stall' ? 'stall cries' : e.kind === 'beg' ? 'beggar calls' : 'the hour called');
        was = v ? v.text : null;
      }
    }
  }
}
/** @type {Record<string, number>} */
const perDay = {};
for (const [k, v] of Object.entries(tot)) perDay[k] = +(v / days.length).toFixed(2);
console.log(JSON.stringify({ blocks, visitors: nVis, step, days, perDay }));
