// LW-FIX1 (2026-10-05, bible/06-Systems/Living-World.md "LW-FIX1"): THE REVIEW'S SIX - an independent read of LW6-LW8c
// found the dungeon the player is in read off a seam the context does not carry (LW6's companies and LW6b's remains never
// stood), a keepsake handed by the talk's town and not the resident's, a walker's going judged at where they made for, a
// table's talk re-dealt mid-round by one who came or went, the player's own dead laid again as the deep's, and an empty
// room never let go. Each pinned here (the dungeon's seam beside LW6's own pin, test/lw6_deep.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { mintKeepsake } from '../src/systems/livingWorld/keepsake.js';
import { createLivingIndoors, INDOOR_STIR_S, INDOOR_SEEN_M } from '../src/scenes/livingIndoors.js';
import { ROUND_S, GATHER_BEAT_S, SLOT_LINES, lineMinutes, dealCircles, circleSlots, slotSpoken, exchangeScript, circleLine } from '../src/systems/livingWorld/meetups.js';   // LW-TALK: PIN MOVED - a table's company
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });

function makeTown(extra = {}) {
  const { nav, buildings, doors } = synthTown();
  const clock = { t: 100 * DAY_MIN + 600 };
  const town = new LivingTown(nav, {
    town: TOWN, buildings, doors, makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND, ...extra,
  });
  return { town, clock };
}

test('LW-FIX1 a keepsake goes to the household of the resident\'s own town: a visitor whose house in their town bears the same number as the fallen\'s here takes nothing; their own town\'s keepsake they take; and the household noted is never another town\'s same-numbered house (mutants: the town, the household\'s town)', () => {
  const rel = createRelations();
  const carried = [];
  const { town, clock } = makeTown({ relations: () => rel, playerName: () => 'Mac', keepsakes: () => carried, takeKeepsake: (it) => carried.splice(carried.indexOf(it), 1) });
  const day = town.dayOf(clock.t);
  const local = town.peopleOf(day).find((r) => r.home != null && town.peopleOf(day).filter((x) => x.home === r.home).length >= 2);
  const home = local.home;
  const visitor = { id: 'L999.h3', name: 'Vis Itor', town: 999, home, job: 'merchant', slot: 3 };
  const person = (r) => ({ living: { id: r.id, res: r }, nameNPC: r.name });
  carried.push(mintKeepsake({ id: `L${TOWN.mapId}.t9`, name: 'Ada Lark', town: TOWN.mapId, home }));
  assert.equal(town.moment(person(visitor)), null, 'a visitor: another town\'s house, the same number - nothing');
  assert.equal(carried.length, 1);
  carried.length = 0;
  carried.push(mintKeepsake({ id: 'L999.t9', name: 'Bo Reed', town: 999, home }));
  assert.ok(town.moment(person(visitor)), 'their own town\'s keepsake: theirs');
  assert.equal(rel.regard(visitor.id, day), 35);
  for (const r of town.peopleOf(day).filter((x) => x.home === home)) assert.equal(rel.regard(r.id, day), 0, `${r.id}: this town's same-numbered house, not theirs`);
});

/** A mock room and the indoor layer over a mock town. */
function rig({ inside = [], clock = 100 * DAY_MIN + 1200, stays = true } = {}) {
  const st = { inside, clock };
  const collider = { move(q, dx, dy, dz) { q[0] = Math.max(-6.7, Math.min(6.7, q[0] + dx)); q[2] = Math.max(-4.7, Math.min(4.7, q[2] + dz)); q[1] += dy; }, raycast: () => null };
  const synced = [];
  const sprites = {
    sync(list) { synced.length = 0; synced.push(...list.map((x) => ({ ...x }))); },
    persons: () => synced.map((x) => ({ person: { living: { id: x.res.id, res: x.res }, pos: x.feet }, pos: x.feet })),
    batches: () => [], clear() { synced.length = 0; },
  };
  const BEAT = { roundMin: ROUND_S * 2, lineMin: lineMinutes(2) };
  const town = {
    insideAt: () => st.inside.map((x) => ({ res: x.res ?? x, e: stays ? { kind: 'tavern', t0: x.t0 ?? 0, t1: 1e12 } : { kind: 'tavern' } })),
    dayOf: (t) => Math.floor((t - 240) / DAY_MIN), talkBeat: () => BEAT,
    lineCtx: () => ({ weather: null, hour: 20, news: null }), typeOf: () => BUILDING_TYPES.Tavern, greetingFor: () => null,
    o: { relations: () => createRelations() },
  };
  const layer = createLivingIndoors({
    sprites, building: () => ({ key: 7000, town }), collider: () => collider, floorAt: () => 0, origin: () => null,
    staticFeet: () => [], clock: () => st.clock, ready: () => true,
  });
  return { layer, synced, st, BEAT };
}
const RES = (i) => ({ id: `L9.${i}`, name: `Res${i} Lane`, job: 'labourer', cls: null });
const AWAY = [0, 0, -4.65];   // AUDIT LW-ROOMS: a step behind the door's row, looking out of it

test('LW-FIX1 a walker whose day ends mid-walk goes where they are unseen - judged where they are, not where they make for (mutants: the place)', () => {
  const r = rig({ inside: [RES(1)], stays: false });
  r.layer.frame(0.016, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  // AUDIT LW-ROOMS: PIN MOVED - a walk with over 4 m to go: the player stands halfway on, and the walker a second's
  // stroll on must not have passed them (the room's walk dealt this one a first walk of 1.6 m)
  const left = () => { const s = r.layer.stood()[0]; return s.walking ? Math.hypot(s.at[0] - r.synced[0].feet[0], s.at[2] - r.synced[0].feet[2]) : 0; };
  let k = 0;
  while (left() < 4 && k++ < 4000) r.layer.frame(0.5, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  assert.ok(r.layer.stood()[0].walking && left() >= 4, 'a walk');
  r.layer.frame(0.2, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  const now = r.synced[0].feet, to = r.layer.stood()[0].at;
  // the player halfway on, facing back at the walker: the walker in view, where they make for behind
  const q = [(now[0] + to[0]) / 2, 0, (now[2] + to[2]) / 2];
  const yaw = Math.atan2(now[0] - q[0], now[2] - q[2]);
  assert.ok(Math.hypot(now[0] - q[0], now[2] - q[2]) < INDOOR_SEEN_M);
  r.st.inside = [];
  r.layer.frame(INDOOR_STIR_S[0] > 1 ? 1 : 1, q, yaw, [q[0], 1.6, q[2]]);
  assert.equal(r.layer.size, 1, 'in view: the walker stays');
  r.layer.frame(0.016, q, yaw + Math.PI, [q[0], 1.6, q[2]]);
  assert.equal(r.layer.size, 0, 'looked away from: gone');
});

test('LW-FIX1 a table\'s talk is never re-dealt mid-script - LW-TALK: PIN MOVED - one who sits down while its exchange is on waits for its last line, the company there talking it out, and the new company meets after it; a circle one of whom goes falls silent at once (mutants: the round\'s deal, the gone)', () => {
  const r = rig({ inside: [RES(1), RES(2)] });
  r.layer.frame(0.016, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  const [a, b] = r.layer.stood();
  assert.equal(a.table, b.table);
  const since = r.st.clock;
  const pairCircle = (t) => { const round = Math.floor((t - since) / r.BEAT.roundMin), start = since + round * r.BEAT.roundMin; return dealCircles(`in:7000:${a.table}:${since}`, [a.res, b.res], round, start, start + r.BEAT.roundMin, GATHER_BEAT_S * r.BEAT.roundMin / ROUND_S)[0]; };
  // the pair's first spoken exchange, a line said and more to come
  const c0 = pairCircle(since);
  const slots = circleSlots(c0, r.BEAT.lineMin);
  const k = slots.findIndex((_, i) => slotSpoken(c0, i) && exchangeScript(c0, i, r.BEAT.lineMin, {}, null).script.length >= 3);
  const s0 = slots[k];
  r.st.clock = s0 + 0.5 * r.BEAT.lineMin;
  r.layer.frame(0.016, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  // a third sits down at their table mid-exchange: the pair talk it out
  r.st.inside = [RES(1), RES(2), RES(3)];
  r.layer.frame(1, AWAY, Math.PI, [0, 1.6, -4.65]);   // AUDIT LW-ROOMS: PIN MOVED - looking away a step behind the door's
  // row (the room's walk deals the pair's table a place in that row, square to the look, where the eye's own rounding saw it)
  assert.equal(r.layer.stood().filter((x) => x.table === a.table).length, 3, 'the third at their table');
  const ctx = { weather: null, hour: 20, news: null, room: 'tavern' };
  for (let i = 1; i < SLOT_LINES; i++) {
    const tm = s0 + (i + 0.5) * r.BEAT.lineMin;
    r.st.clock = tm;
    r.layer.frame(0.016, AWAY, Math.PI, [0, 1.6, -4.65]);
    const want = circleLine(c0, tm, r.BEAT.lineMin, ctx);
    assert.deepEqual(r.layer.speech([0, 1.6, -4.65]).map((l) => l.text), want ? [want.text] : [], 'the pair\'s talk, as dealt');
  }
  // after its last line, the three's company meets - its talk from its own first line
  const met = s0 + SLOT_LINES * r.BEAT.lineMin;
  const trio = dealCircles(`in:7000:${a.table}:${met}`, r.layer.stood().filter((x) => x.table === a.table).map((x) => x.res), 0, met, met + r.BEAT.roundMin, GATHER_BEAT_S * r.BEAT.roundMin / ROUND_S)[0];
  assert.equal(trio.members.length, 3);
  let heard = 0;
  for (let tm = met; tm < met + r.BEAT.roundMin && heard < 3; tm += 0.25 * r.BEAT.lineMin) {
    r.st.clock = tm;
    r.layer.frame(0.016, AWAY, Math.PI, [0, 1.6, -4.65]);
    const want = circleLine(trio, tm, r.BEAT.lineMin, ctx);
    assert.deepEqual(r.layer.speech([0, 1.6, -4.65]).map((l) => l.text), want ? [want.text] : [], 'the three\'s talk');
    if (want) heard++;
  }
  assert.ok(heard > 0, 'the three talking');
  // one of the three goes mid-exchange: the two left never carry the three's talk - theirs meets anew, at once
  const t3 = r.layer.stood().filter((x) => x.table === a.table);
  const trioK = circleSlots(trio, r.BEAT.lineMin).findIndex((_, i) => slotSpoken(trio, i));
  const ts = circleSlots(trio, r.BEAT.lineMin)[trioK] + 0.5 * r.BEAT.lineMin;
  r.st.clock = ts;
  r.layer.frame(0.016, AWAY, Math.PI, [0, 1.6, -4.65]);
  const leaver = t3.find((x) => x.res.id !== circleLine(trio, ts, r.BEAT.lineMin, ctx).who.id).res.id;
  r.st.inside = [RES(1), RES(2), RES(3)].filter((x) => x.id !== leaver);
  r.layer.frame(1, AWAY, Math.PI, [0, 1.6, -4.65]);
  const two = r.layer.stood().filter((x) => x.table === a.table).map((x) => x.res);
  assert.equal(two.length, 2, 'two left at the table');
  const left = r.st.clock;
  const theirs = dealCircles(`in:7000:${a.table}:${left}`, two, 0, left, left + r.BEAT.roundMin, GATHER_BEAT_S * r.BEAT.roundMin / ROUND_S)[0];
  for (let i = 1; i < SLOT_LINES; i++) {
    const tm = ts + i * r.BEAT.lineMin;
    r.st.clock = tm;
    r.layer.frame(0.016, AWAY, Math.PI, [0, 1.6, -4.65]);
    const want = circleLine(theirs, tm, r.BEAT.lineMin, ctx);
    assert.deepEqual(r.layer.speech([0, 1.6, -4.65]).map((l) => l.text), want ? [want.text] : [], 'the two\'s own talk, never the three\'s carried');
  }
  // one of the pair goes mid-exchange (the player looking away): the circle silent at once
  const solo = rig({ inside: [RES(1), RES(2)] });
  solo.layer.frame(0.016, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  solo.st.clock = s0 + 0.5 * solo.BEAT.lineMin;
  solo.layer.frame(0.016, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  solo.st.inside = [RES(1)];
  solo.layer.frame(1, AWAY, Math.PI, [0, 1.6, -4.65]);
  assert.equal(solo.layer.size, 1);
  for (let i = 0; i < 3; i++) {
    solo.st.clock = s0 + (i + 1.5) * solo.BEAT.lineMin;
    solo.layer.frame(0.016, AWAY, Math.PI, [0, 1.6, -4.65]);
    assert.deepEqual(solo.layer.speech([0, 1.6, -4.65]), [], 'silent');
  }
});

test('LW-FIX1 the streaming host: the deep passes by the player\'s own dead (slain, died - the pool\'s corpses) and makes its books again below when a turn is made there, for the remains and the divers alike; a room with nobody in it is let go on the way out like one with people (mutants: the slain, the died, the books for each, the empty room each way)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /return !turns\.fallen\.has\(key\) && !turns\.spared\.has\(key\) && !turns\.slain\.has\(key\) && !turns\.died\.has\(key\) && !livingDivers\?\.stood\(r\.trip\.id, r\.res\.id\);/);
  assert.match(w, /livingTurnsFresh\(\);   \/\/ LW-FIX1: a turn made below[^\n]*\n\s*livingMemoFresh\(\);[^\n]*\n\s*const turns = livingRelations\.turns\(\);\n\s*_livingRemainsList = here \? fallenIn\(/);
  assert.match(w, /livingTurnsFresh\(\);   \/\/ LW-FIX1: the books fresh below too\n\s*livingMemoFresh\(\);[^\n]*\n\s*_livingDiversList = here \? diversAt\(/);
  assert.match(w, /if \(!livingWorldOn\(\) \|\| _mode\(\) !== 'interior'\) \{ if \(livingIndoors\?\.size \|\| livingIndoors\?\.spots\(\)\.length\) livingIndoors\.clear\(\); return; \}/);
  assert.match(w, /if \(livingIndoors\?\.size \|\| livingIndoors\?\.spots\(\)\.length\) livingIndoors\.clear\(\);   \/\/ LW8: the street again/);
});
