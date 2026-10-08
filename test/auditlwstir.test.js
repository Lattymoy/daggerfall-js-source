// AUDIT LW-STIR (2026-10-08, Mac, of LW-STIR: "Lets audit everything and ensure perfection"; the record is
// bible/01-Overview/Audit-LW-Stir.md) - every pin red on the code as it stood (its mutants,
// tools/mutants/auditlwstir.json), on the synthetic towns (test/lwTown.mjs) and, where ARENA2_PATH names the data, the
// game's own (test/lwRealTown.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown } from './lwTown.mjs';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { travellerRoster } from '../src/systems/livingWorld/census.js';
import { DAY_MIN, DAY_START_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { lineMinutes } from '../src/systems/livingWorld/meetups.js';
import { stirLine, STIR_GATHER_S, STIR_AFTER_S } from '../src/systems/livingWorld/stir.js';
import { GATE_SCRIPTS, CHALLENGE_SCRIPTS, QUARREL_SCRIPTS } from '../src/systems/livingWorld/lines.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;
const DAY = 100, D0 = DAY * DAY_MIN + DAY_START_MIN;
const H = (hh) => DAY * DAY_MIN + Math.round(hh * 60);
const MAP = 24680;
const LINE = lineMinutes(RATE), GATHER = STIR_GATHER_S * RATE, AFTER = STIR_AFTER_S * RATE;

/** A living town on the synthetic grid (its watch posting the gates at 45 blocks), with `visitors`, no bodies made. */
function townOf(built, visitors, blocks = 45) {
  return new LivingTown(built.nav, {
    town: { mapId: MAP, blocks, region: 17, people: 3, port: false }, buildings: built.buildings, doors: built.doors,
    makePerson: () => null, suppressSpawns: () => true, clock: () => H(12), rate: () => RATE, mpm: MPM,
    tripsOf: () => ({ away: new Map(), visitors, holders: null, news: null, places: ['Daggerfall', 'Sentinel'] }),
  });
}
/** What the street says from `eye` with the residents `ids` stood where they stand (rows given back after). */
function sayWith(lt, ids, eye) {
  lt.pool = ids.flatMap((id) => {
    const res = lt.peopleOf(lt.dayOf(lt._now)).find((r) => r.id === id);
    const w = res ? lt.where(res, lt._now, false) : null;
    return w && !w.pending ? [{ active: true, visible: true, res, flee: false, person: { pos: [w.x, 0, w.z], yaw: w.yaw, moving: !!w.moving, living: { id } } }] : [];
  });
  lt._greetings = [];
  const out = lt.speech(eye, 1e6);
  lt.pool = [];
  return out;
}

test('AUDIT LW-STIR F1: the gate\'s and the watch\'s {place} is the stranger\'s own town - their trip\'s home, where the roads know it - never a town of this one\'s own travels (a stranger come from Wayrest named Daggerfall, a town this one\'s people go to, as theirs); a quarrel\'s and a haggle\'s {place} is still the roads\' (mutants: the home unread, the home for every word, the trip unread)', () => {
  // the words, by the line: the home where the word is the gate's or the watch's, the roads' town elsewhere
  const post = { id: `L${MAP}.w9`, name: 'Hal Ward', job: 'guard', town: MAP, guard: true }, stranger = { id: 'L999.t1', name: 'Bram Stoke', job: 'merchant', town: 999 };
  const civil = GATE_SCRIPTS.civil.find((s) => s.some((l) => l.text.includes('{place}')));
  const word = (kind, script, members = [post, stranger]) => ({ kind, spot: 'xn', members, anchor: 0, guard: null, mood: 'civil', script, seed: 11, round: 0, t0: H(10), from: H(10) + GATHER, end: H(10) + GATHER + script.length * LINE + AFTER, loudFrom: Infinity });
  const placeLine = (inc) => inc.script.findIndex((l) => l.text.includes('{place}'));
  const said = (inc, ctx) => stirLine(inc, inc.from + (placeLine(inc) + 0.5) * LINE, LINE, ctx).text;
  const ctx = { town: 'Ripmarket', places: ['Daggerfall'], home: 'Wayrest' };
  const gate = word('gate', civil);
  assert.ok(said(gate, ctx).includes('Wayrest') && !said(gate, ctx).includes('Daggerfall'), `the gate: ${said(gate, ctx)}`);
  const stop = word('challenge', CHALLENGE_SCRIPTS.civil.find((s) => s.some((l) => l.text.includes('{place}'))));
  assert.ok(said(stop, ctx).includes('Wayrest'), `the watch's stop: ${said(stop, ctx)}`);
  assert.ok(said(gate, { ...ctx, home: null }).includes('Daggerfall'), 'no home known: the roads\' town, as before');
  const quarrel = word('quarrel', QUARREL_SCRIPTS.find((s) => s.some((l) => l.text.includes('{place}'))) ?? [{ by: 'a', text: 'Back from {place}, are you?', loud: false }], [stranger, post]);
  assert.ok(said(quarrel, ctx).includes('Daggerfall') && !said(quarrel, ctx).includes('Wayrest'), 'a quarrel\'s: the roads\'');
  // the street: strangers come from Wayrest, halted at the kept gates - each gate word's {place} line says Wayrest
  const built = synthTown();
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const vis = travellerRoster({ mapId: 999, blocks: 45, region: 17, people: 3 }).map((res, i) => ({ res, inT: D0 + 300 + ((i * 53) % 700), outT: H(17), yaw: yaws[i % 4], trip: { from: { name: 'Wayrest' }, party: [res] } }));
  const lt = townOf(built, vis);
  lt._now = H(12); lt._tick([0, 0, 0], 0);
  let heard = 0;
  for (const [, list] of lt._stirDays.get(DAY).by) {
    for (const inc of list) {
      if (inc.kind !== 'gate') continue;
      const i = placeLine(inc);
      if (i < 0) continue;
      lt._now = inc.from + (i + 0.5) * LINE; lt._tick([0, 0, 0], 0);
      const at = lt._aloneAt.get(inc.members[0].id);
      if (!at) continue;
      const line = sayWith(lt, inc.members.map((m) => m.id), [at.x, 1.6, at.z]).find((o) => inc.members.some((m) => m.id === o.person.living.id));
      if (!line) continue;
      assert.ok(line.text.includes('Wayrest') && !/Daggerfall|Sentinel/.test(line.text), `${inc.members[1].id} at ${inc.spot}: "${line.text}"`);
      heard++;
    }
  }
  assert.ok(heard >= 2, `the gate's words naming their home, heard (${heard})`);
});
