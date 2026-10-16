// SHIP-WATCH (2026-10-01, Mac: "Do #3" - life aboard between fights: the crew sleep below at night but their watch, a
// lookout at the bow cries "Sail ho!", the crew swab, haul and patch after a fight; "If not already, ships at night
// should use their lanterns (AI)"; "I also want to keep improving the AI"):
//
//   THE LAWS (systems/naval/shipWatch.js) - the sleeping hours and the watch, the night's sight by a ship's lanterns,
//   who runs dark, the far lanterns as points of light.
//   THE CREW (systems/naval/crewLife.js) - turned in to the hatch and below but the watch, every hand up at a fight's
//   call or the morning; the lookout at the bow; work and chores, swung at; and the host (scenes/naval/navalCrew.js) drawing
//   none below and the swing as the class's attack.
//   THE CAPTAINS (navalAI.js, shipLife.js) - a dark ship seen close, a lit one far, a ship firing seen by her flashes; a
//   merchantman waiting at her berth for the morning; a pirate lurking nearer the mouth by night.
//   THE HOST (scenes/naval/navalHost.js) - the lanterns lit or doused, the contacts' lights, the lookout's cry by night's law
//   and handed to my crew once, their work off their hurts, the far lamps drawn; and the world's wiring.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  asleepHour, watchCount, nightSight, runsDark, lampSize, lampAlpha, lampPoints,
  SLEEP_FROM_HOUR, SLEEP_TO_HOUR, NIGHT_LIT_SIGHT, NIGHT_DARK_SIGHT, LAMP_NEAR_M, LAMP_FADE_M, LAMP_MIN_M, LAMP_ANGLE, LAMP_MAX,
} from '../../../src/systems/naval/shipWatch.js';
import { createCrewLife, crewRoster, CREW_BLURBS, ALL_HANDS, WORK_S, LOOKOUT_BACK } from '../../../src/systems/naval/crewLife.js';
import { createNavalCrew } from '../../../src/scenes/naval/navalCrew.js';
import { buildDeck } from '../../../src/systems/naval/navalDeck.js';
import { boxColliderTriangles } from '../../../src/world/prefabColliders.js';
import { MOBILE } from '../../../src/systems/naval/navalBoarding.js';
import { classById, HULL } from '../../../src/systems/naval/navalShips.js';
import { createSeaShip, stepCaptain, WIND_RATED, ENGAGE_RANGE, GUNS_SEEN_S, FLEE_RANGE } from '../../../src/systems/naval/navalAI.js';
import { findHarbour, createWaterGrid, errandFor, stepErrand, LURK_R, NIGHT_LURK_K } from '../../../src/systems/naval/shipLife.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';
import { SAIL_HO_RANGE, SHIP_FADE_S } from '../../../src/scenes/naval/navalHost.js';
import { CREW_ORDERS } from '../../../src/systems/naval/shipCrew.js';
import { setLights } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { sea } from '../../navalSea.mjs';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const HOST = readFileSync(new URL('../../../src/scenes/naval/navalHost.js', import.meta.url), 'utf8');

/** A plain deck: a flat 8 m by 24 m at 2 m (her frame) with a mast amidships (livingcrew.test.js's). */
const plainDeck = () => buildDeck([
  { positions: [-4, 2, -12, 4, 2, -12, 4, 2, 12, -4, 2, 12], indices: [0, 1, 2, 0, 2, 3] },
  boxColliderTriangles({ m_Center: { x: 0, y: 6, z: 0 }, m_Size: { x: 1.2, y: 8, z: 1.2 } }),
], { minX: -6, maxX: 6, minZ: -14, maxZ: 14 });
const pirate = classById('pirateBrig');
function run(life, s, ctx = {}, each = null, dt = 0.05) { for (let t = 0; t < s; t += dt) { life.step(dt, ctx); each?.(life); } }
/** A crew of eight on the plain deck, her helmsman a station off it. */
const crewOf = (seed = 4, o = {}) => createCrewLife({ deck: plainDeck(), roster: crewRoster({ hull: 3, seed, shipClass: pirate }), seed, places: [[5.5, 3.2, -11]], ...o });

// ── the laws ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('SHIP-WATCH THE LAWS: a crew sleeps from SLEEP_FROM_HOUR to before SLEEP_TO_HOUR, a third of it (one at least) on watch; by night a lit ship is seen to NIGHT_LIT_SIGHT and a dark one to NIGHT_DARK_SIGHT, never farther than by day; a pirate afloat runs dark, and a merchantman running - a navy never, a struck pirate never (mutants: the hours shifted, the watch a half, the sight swapped, every pirate dark struck or not)', () => {
  assert.equal(asleepHour(SLEEP_FROM_HOUR), true); assert.equal(asleepHour(SLEEP_FROM_HOUR - 1), false);
  assert.equal(asleepHour(SLEEP_TO_HOUR - 1), true); assert.equal(asleepHour(SLEEP_TO_HOUR), false);
  assert.equal(asleepHour(0), true); assert.equal(asleepHour(12), false); assert.equal(asleepHour(NaN), false);
  assert.deepEqual([0, 1, 2, 3, 4, 6, 8].map(watchCount), [0, 1, 1, 1, 2, 2, 3]);
  assert.equal(nightSight(900, { night: false, lit: false }), 900, 'by day, the day\'s');
  assert.equal(nightSight(900, { night: true, lit: true }), NIGHT_LIT_SIGHT);
  assert.equal(nightSight(900, { night: true, lit: false }), NIGHT_DARK_SIGHT);
  assert.equal(nightSight(100, { night: true, lit: true }), 100, 'never farther than by day');
  assert.ok(NIGHT_DARK_SIGHT < NIGHT_LIT_SIGHT);
  assert.equal(runsDark({ faction: 'pirate', mode: 'cruise' }), true);
  assert.equal(runsDark({ faction: 'pirate', mode: 'engage', afloat: false }), false, 'struck: nothing left to hide');
  assert.equal(runsDark({ faction: 'merchant', mode: 'flee' }), true);
  assert.equal(runsDark({ faction: 'merchant', mode: 'cruise' }), false);
  assert.equal(runsDark({ faction: 'navy', mode: 'engage' }), false);
});

test('SHIP-WATCH THE FAR LAMPS: nought within LAMP_NEAR_M (her own lantern flats are seen), whole by LAMP_FADE_M on; LAMP_ANGLE of the view across at any range, never under LAMP_MIN_M; LAMP_MAX of a ship\'s lanterns, the first, the last and between (mutants: drawn near, a fixed size, every lantern)', () => {
  assert.equal(lampAlpha(LAMP_NEAR_M), 0); assert.equal(lampAlpha(10), 0);
  assert.ok(Math.abs(lampAlpha(LAMP_NEAR_M + LAMP_FADE_M / 2) - 0.5) < 1e-9);
  assert.equal(lampAlpha(LAMP_NEAR_M + LAMP_FADE_M), 1); assert.equal(lampAlpha(5000), 1);
  assert.equal(lampSize(10), LAMP_MIN_M);
  assert.ok(Math.abs(lampSize(1000) - 1000 * LAMP_ANGLE) < 1e-9, 'a few pixels at any range');
  assert.deepEqual(lampPoints([1, 2, 3]), [1, 2, 3]);
  const many = Array.from({ length: 18 }, (_, i) => i);
  const four = lampPoints(many);
  assert.equal(four.length, LAMP_MAX);
  assert.equal(four[0], 0); assert.equal(four[LAMP_MAX - 1], 17, 'stem to stern');
  assert.equal(new Set(four).size, LAMP_MAX);
});

// ── the watch ────────────────────────────────────────────────────────────────────────────────────────────────────

test('SHIP-WATCH TURNED IN: at the sleeping hour all but the watch walk to her hatch and go below - her station and her lookout kept on deck, then the roster\'s first to a third of the crew; the ones below are hers still (standing counts them, never gone), sing no song and say nothing; the watch speaks the night\'s words (mutants: nobody below, the station turned in, below counted gone, a song at night, the calm words at night)', () => {
  const life = crewOf();
  const n = life.standing();
  assert.equal(n, 8);
  run(life, 2, {});
  const lookout = life.lookout();
  run(life, 40, { asleep: true });
  const below = life.members.filter((m) => m.below);
  assert.equal(below.length, n - watchCount(n), `a third on watch: ${n - below.length} of ${n}`);
  assert.equal(life.belowCount(), below.length);
  assert.equal(life.asleep(), true);
  const station = life.members.find((m) => m.station);
  assert.ok(station && !station.below, 'her helmsman at his wheel');
  assert.ok(lookout && !lookout.below, 'her lookout at the bow');
  assert.equal(life.standing(), n, 'below is not gone');
  assert.ok(below.every((m) => !m.gone && m.state === 'below' && !m.line));
  // and they went down her hatch: each walked to it first
  assert.ok(below.every((m) => Math.hypot(m.pos[0] - life.hatch[0], m.pos[2] - life.hatch[2]) < 0.8), 'down her hatch');
  let sang = false;
  const words = new Set();
  run(life, 400, { asleep: true }, (l) => { if (l.singing()) sang = true; for (const s of l.speech()) words.add(s.text); });
  assert.equal(sang, false, 'no chanty in the night watch');
  assert.ok(words.size > 0, 'the watch talks');
  for (const w of words) assert.ok(!CREW_BLURBS.calm.includes(w) || CREW_BLURBS.night.includes(w), `a night word: ${w}`);
  assert.ok([...words].some((w) => CREW_BLURBS.night.includes(w)), 'the night\'s own words');
  for (const s of life.speech()) assert.ok(!s.member.below);
  // two stations on a crew of four: both keep their posts, whatever the watch's count
  const two = createCrewLife({ deck: plainDeck(), roster: crewRoster({ hull: 3, seed: 4, shipClass: pirate }).slice(0, 4), seed: 4, places: [[5.5, 3.2, -11], [-5.5, 3.2, -11]] });
  run(two, 40, { asleep: true });
  assert.equal(two.members.filter((m) => m.station).length, 2);
  assert.ok(two.members.filter((m) => m.station).every((m) => !m.below), 'every station at his post');
});

test('SHIP-WATCH ALL HANDS: the guns or a muster call every hand up at once out of her hatch, one crying ALL_HANDS - and her colours struck do too; the morning brings them up quietly; a man taken off her deck while below comes up out of her hatch; one going ashore comes home on her deck (mutants: the fight leaves them below, no cry, the morning shouts, the taken man where he slept)', () => {
  const life = crewOf();
  run(life, 40, { asleep: true });
  assert.ok(life.belowCount() > 0);
  life.step(0.05, { asleep: true, battle: true });
  assert.equal(life.belowCount(), 0, 'every hand up');
  assert.ok(life.speech().some((s) => s.text === ALL_HANDS && s.kind === 'shout'), 'the cry');
  assert.equal(life.asleep(), false);
  // the fight over, still night: down again
  run(life, 40, { asleep: true });
  assert.ok(life.belowCount() > 0);
  life.step(0.05, { asleep: true, muster: 1 });
  assert.equal(life.belowCount(), 0, 'a muster too');
  run(life, 40, { asleep: true });
  life.step(0.05, { asleep: true, struck: true });
  assert.equal(life.belowCount(), 0, 'her colours down');
  // the morning - PIN MOVED (AUDIT WK-W8): one at a time out of her hatch (auditwatchkit_crew), every hand up within
  // seconds, and quietly all the while
  const m2 = crewOf(5);
  run(m2, 40, { asleep: true });
  for (const m of m2.members) m.line = null;
  let shouted = false;
  run(m2, 10, { asleep: false }, (l) => { if (l.speech().some((s) => s.text === ALL_HANDS)) shouted = true; });
  assert.equal(m2.belowCount(), 0, 'the morning brings them up');
  assert.equal(shouted, false, 'quietly');
  // taken while below - up out of her hatch
  const m3 = crewOf(6);
  run(m3, 40, { asleep: true });
  const sleeper = m3.members.find((m) => m.below);
  const n = m3.members.indexOf(sleeper);
  const took = m3.take(1, { from: m3.members.slice(0, n).filter((m) => !m.gone).length });
  assert.equal(took.length, 1);
  assert.equal(sleeper.below, false);
  assert.ok(Math.hypot(took[0].pos[0] - m3.hatch[0], took[0].pos[2] - m3.hatch[2]) < 0.8, 'out of her hatch');
  // ashore while below - home on her deck
  const m4 = crewOf(7);
  run(m4, 40, { asleep: true });
  const s4 = m4.members.find((m) => m.below);
  m4.away(new Set([s4.i]));
  assert.equal(s4.below, false);
  m4.away(new Set());
  assert.equal(s4.gone, false); assert.equal(s4.below, false);
});

test('SHIP-WATCH THE LOOKOUT: a walker - never her Bard nor her station, her first man only if none else - walks to her bow (LOOKOUT_BACK from her stem, on her centre line) and keeps it facing out over her stem, talking to nobody; a call is shouted by him, and a lookout gone is another (mutants: the Bard at the bow, no post, he chats, the call by the first man)', () => {
  const roster = [{ mobile: MOBILE.Warrior, gender: 'male' }, { mobile: MOBILE.Bard, gender: 'male' }, { mobile: MOBILE.Archer, gender: 'female' }, { mobile: MOBILE.Monk, gender: 'male' }];
  const life = createCrewLife({ deck: plainDeck(), roster, seed: 3 });
  const lk = life.lookout();
  assert.ok(lk && lk.mobile !== MOBILE.Bard && lk.i > 0, `${lk?.mobile}`);
  assert.equal(lk.mobile, MOBILE.Archer, 'past her Bard to the next');
  assert.ok(life.bow && Math.abs(life.bow[0]) < 0.5 && life.bow[2] > 10, `her bow ${life.bow}`);
  run(life, 30, {});
  assert.ok(Math.hypot(lk.pos[0] - life.bow[0], lk.pos[2] - life.bow[2]) < 0.6, 'at the bow');
  assert.ok(['watch', 'walk'].includes(lk.state));
  let chats = 0;
  run(life, 120, {}, () => { if (lk.mate) chats++; if (lk.state === 'watch') assert.equal(lk.face, 0); });
  assert.equal(chats, 0, 'he keeps his watch');
  for (const m of life.members) m.line = null;
  life.step(0.05, { call: 'Sail ho! Off the port bow!' });
  const said = life.speech().find((s) => s.text === 'Sail ho! Off the port bow!');
  assert.ok(said && said.member === lk && said.kind === 'shout', 'cried from the bow');
  life.trim(1);   // the guns took him
  const next = life.lookout();
  assert.notEqual(next, lk);
  assert.ok(!next || (!next.gone && next.mobile !== MOBILE.Bard) || next.i === 0);
  assert.ok(Math.abs(LOOKOUT_BACK - 0.75) < 1e-9);
});

test('SHIP-WATCH AT WORK: what a fight left to mend sets most of the idle crew to work at free spots - swinging at it (a swing a step at WORK_SWING_S), saying the work\'s words; at peace now and then a chore; the guns end the work; the host plays the swing as the class\'s attack and draws none below (mutants: no work, no swing, the swing every step, the work through the guns, the sleepers drawn)', () => {
  const busy = crewOf(8);
  let working = 0, swings = 0, steps = 0, words = new Set();
  run(busy, 120, { work: 1 }, (l) => {
    steps++;
    working = Math.max(working, l.members.filter((m) => m.state === 'work').length);
    swings += l.members.filter((m) => m.swing).length;
    for (const s of l.speech()) words.add(s.text);
  });
  assert.ok(working >= 3, `hands at work: ${working}`);
  assert.ok(swings > 20 && swings < steps * 3, `swings ${swings} over ${steps} steps`);
  assert.ok([...words].some((w) => CREW_BLURBS.work.includes(w)), 'the work\'s words');
  // at peace: chores now and then, far fewer
  const calm = crewOf(8);
  let chores = 0, calmSum = 0, calmN = 0;
  run(calm, 240, {}, (l) => { const n = l.members.filter((m) => m.state === 'work').length; chores = Math.max(chores, n); calmSum += n; calmN++; });
  assert.ok(chores >= 1, 'a chore at peace');
  const busy2 = crewOf(8);
  let busySum = 0, busyN = 0;
  run(busy2, 240, { work: 1 }, (l) => { busySum += l.members.filter((m) => m.state === 'work').length; busyN++; });
  assert.ok(busySum / busyN > 2 * (calmSum / calmN), `the work draws them: ${(busySum / busyN).toFixed(2)} at work against ${(calmSum / calmN).toFixed(2)} at peace`);
  // the guns end it
  busy.step(0.05, { battle: true, work: 1 });
  busy.step(0.05, { battle: true, work: 1 });
  assert.equal(busy.members.filter((m) => m.state === 'work').length, 0, 'to the guns');
  assert.ok(WORK_S[0] > 0 && WORK_S[1] > WORK_S[0]);
  // the host: the swing is the attack, the sleepers undrawn
  const NAV = readFileSync(new URL('../../../src/scenes/naval/navalCrew.js', import.meta.url), 'utf8');
  assert.match(NAV, /_motion\.striking = !!member\.swing;/);
  assert.match(NAV, /if \(member\.below \|\| !s\.unit \|\| !s\.batch\) continue;/);
  assert.match(NAV, /if \(s\?\.batch && s\.unit && !m\.below\) out\.push\(s\.batch\);/);
});

test('SHIP-WATCH THE HOST DRAWS NONE BELOW: through the real crew host, a ship\'s crew at night - the ones below stand no batch, the watch does, and every hand is drawn again at the guns (mutants: the sleepers drawn)', async () => {
  const made = [];
  const renderer = { createBillboardBatch: (archive, record, size) => { const b = { archive, record, size }; made.push(b); return b; }, destroyBillboardBatch() {}, textures: new Map() };
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 20 };
  const crew = createNavalCrew({ renderer, getTexture: async () => tex, uploadRecordFrame: () => {}, rand: () => 0.3 });
  const deck = plainDeck();
  const boat = { GameObject: { position: [0, 0, 0], childCount: 0, getChild: () => null }, MeshObject: { worldMatrix: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) } };
  crew.sync([{ key: 's', boat, deck, count: 8, rosterOf: () => crewRoster({ hull: 3, seed: 4, shipClass: pirate }), seed: 4, faction: 'pirate' }]);
  await new Promise((r) => setTimeout(r, 0));
  for (let t = 0; t < 40; t += 0.1) crew.frame(0.1, [0, 5, 0], () => ({ asleep: true }));
  const life = crew.ships()[0].life;
  assert.ok(life.belowCount() > 0);
  assert.equal(crew.batches().length, life.standing() - life.belowCount(), 'the watch alone drawn');
  crew.frame(0.1, [0, 5, 0], () => ({ asleep: true, battle: true }));
  assert.equal(crew.batches().length, life.standing(), 'every hand at the guns');
});

// ── the captains ─────────────────────────────────────────────────────────────────────────────────────────────────

const open = () => true;
const worldAt = (o = {}) => ({ now: 0, dt: 0.1, seaY: 0, wind: [0, 0, WIND_RATED], isWater: open, contacts: [], random: () => 0.5, ...o });
const contactOf = (s, o = {}) => ({ id: s.id, kind: 'ship', faction: s.cls.faction, pos: s.pos, vel: [0, 0, 0], speed: 0, yaw: s.yaw, hull: s.hull, ship: s, ...o });

test('SHIP-WATCH THE CAPTAINS BY NIGHT: a bold pirate takes a lit merchantman at 600 m by night but not a dark one there - a dark one only within NIGHT_DARK_SIGHT; by day both at once; a ship that fired within GUNS_SEEN_S is seen by her flashes; and a merchantman runs from a dark pirate only once it is that close (mutants: the night unread, the lit flag unread, the flashes unread, the flee range by day)', () => {
  const engaged = (o) => {
    const p = createSeaShip({ id: 'p', seed: 1, classId: 'pirateBrig', pos: [0, 0, 0], yaw: 0, temper: 'bold' });
    const m = createSeaShip({ id: 'm', seed: 2, classId: 'merchantGalleon', pos: [0, 0, o.at], yaw: 0 });
    stepCaptain(p, worldAt({ night: o.night, contacts: [contactOf(m, { lit: o.lit })], gunfire: o.gunfire ?? [], now: o.now ?? 0 }));
    return p.mode === 'engage' && p.target === 'm';
  };
  assert.ok(600 < ENGAGE_RANGE && 600 < NIGHT_LIT_SIGHT && 600 > NIGHT_DARK_SIGHT);
  assert.equal(engaged({ at: 600, night: false, lit: false }), true, 'by day');
  assert.equal(engaged({ at: 600, night: true, lit: true }), true, 'her lanterns show her');
  assert.equal(engaged({ at: 600, night: true, lit: false }), false, 'dark: unseen');
  assert.equal(engaged({ at: NIGHT_DARK_SIGHT - 20, night: true, lit: false }), true, 'close aboard');
  assert.equal(engaged({ at: 600, night: true, lit: false, now: 30, gunfire: [{ pos: [0, 0, 600], at: 30 - GUNS_SEEN_S + 2, by: 'm' }] }), true, 'her flashes');
  assert.equal(engaged({ at: 600, night: true, lit: false, now: 30, gunfire: [{ pos: [0, 0, 600], at: 30 - GUNS_SEEN_S - 2, by: 'm' }] }), false, 'long since');
  // the merchantman's lookout: a dark pirate within FLEE_RANGE by day, only NIGHT_DARK_SIGHT by night
  const runs = (o) => {
    const m = createSeaShip({ id: 'm', seed: 2, classId: 'merchantGalleon', pos: [0, 0, 0], yaw: 0 });
    const p = createSeaShip({ id: 'p', seed: 1, classId: 'pirateBrig', pos: [0, 0, o.at], yaw: Math.PI, temper: 'bold' });
    stepCaptain(m, worldAt({ night: o.night, contacts: [contactOf(p, { lit: false })] }));
    return m.mode === 'flee';
  };
  const mid = (FLEE_RANGE + NIGHT_DARK_SIGHT) / 2;
  assert.equal(runs({ at: mid, night: false }), true, 'by day she runs');
  assert.equal(runs({ at: mid, night: true }), false, 'by night she never saw her');
  assert.equal(runs({ at: NIGHT_DARK_SIGHT - 20, night: true }), true, 'close aboard she runs');
});

/** The coast of test/systems/naval/shiplife.test.js: land north of z = 200 and a headland. */
const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const TOWN = { minX: -100, maxX: 100, minZ: 220, maxZ: 420 };
function lifeOn(harbour, o = {}) {
  const grids = new Map();
  const grid = (h) => grids.get(h) ?? (grids.set(h, createWaterGrid({ isWater: coast, hull: h })), grids.get(h));
  return { harbour: (k) => (k === 'port' ? harbour : null), grid, free: () => true, harbours: () => [{ key: 'port', harbour, free: () => true }], ...o };
}

test('SHIP-WATCH THE ERRANDS BY NIGHT: a merchantman whose dwell is spent after dark keeps her berth till the morning, then departs; a navy does not wait; a pirate lurking closes on the mouth to NIGHT_LURK_K of her day\'s reach by night, her ring laid afresh at the turn, and back out by day (mutants: the merchantman sails at night, the navy waits too, the lurk unmoved, the ring kept)', () => {
  const harbour = findHarbour({ rect: TOWN, isWater: coast });
  const b = harbour.berths[0];
  const moored = (faction, classId) => {
    const ship = createSeaShip({ id: faction, seed: 9, classId, pos: [b.pos[0], 0, b.pos[1]], yaw: b.yaw });
    ship.errand = { kind: 'moored', harbour: 'port', berth: 0, until: 10, path: null, i: 0 };
    ship.clock = 20;
    return ship;
  };
  const m = moored('merchant', 'merchantGalleon');
  const held = stepErrand(m, 0.1, lifeOn(harbour, { night: true }));
  assert.ok(held?.hold, 'held at her berth');
  assert.equal(m.errand.kind, 'moored');
  stepErrand(m, 0.1, lifeOn(harbour, { night: false }));
  assert.equal(m.errand.kind, 'depart', 'the morning: she departs');
  const n = moored('navy', 'navyCutter');
  stepErrand(n, 0.1, lifeOn(harbour, { night: true }));
  assert.equal(n.errand.kind, 'depart', 'a navy does not wait');
  // the lurk
  const p = createSeaShip({ id: 'p', seed: 9, classId: 'pirateBrig', pos: [600, 0, -600], yaw: 0, temper: 'bold' });
  p.errand = errandFor({ seed: 9, faction: 'pirate', hull: p.hull, pos: p.pos, harbours: [{ key: 'port', harbour, free: () => true }] });
  assert.equal(p.errand.kind, 'lurk');
  const at = [...p.errand.at];
  const day = stepErrand(p, 0.1, lifeOn(harbour, { night: false }));
  const dayRing = p.errand.path.map((q) => [...q]);
  const night = stepErrand(p, 0.1, lifeOn(harbour, { night: true }));
  const nightAt = [harbour.mouth[0] + (at[0] - harbour.mouth[0]) * NIGHT_LURK_K, harbour.mouth[1] + (at[1] - harbour.mouth[1]) * NIGHT_LURK_K];
  assert.ok(Math.abs(Math.hypot(nightAt[0] - harbour.mouth[0], nightAt[1] - harbour.mouth[1]) - LURK_R * NIGHT_LURK_K) < 1e-6);
  const ringMid = (ring) => [ring.reduce((a, q) => a + q[0], 0) / ring.length, ring.reduce((a, q) => a + q[1], 0) / ring.length];
  const dn = ringMid(p.errand.path);
  assert.ok(Math.hypot(dn[0] - nightAt[0], dn[1] - nightAt[1]) < Math.hypot(dn[0] - at[0], dn[1] - at[1]), 'her ring by night round the nearer place');
  assert.notDeepEqual(p.errand.path, dayRing, 'laid afresh');
  assert.ok(day && night);
  stepErrand(p, 0.1, lifeOn(harbour, { night: false }));
  const dd = ringMid(p.errand.path);
  assert.ok(Math.hypot(dd[0] - at[0], dd[1] - at[1]) < Math.hypot(dd[0] - nightAt[0], dd[1] - nightAt[1]), 'back out by day');
});

// ── the host ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('SHIP-WATCH THE LANTERNS ON THE REAL HOST: at the lights\' hour a merchantman and a navy light theirs and a pirate keeps hers out - a merchantman running douses hers; by day none; the captains\' contacts say who shows a light, mine my own lantern switch; the captains are told the night (mutants: every ship lit, the pirate lit, the contacts unlit, the night untold)', async () => {
  const h = await sea({ hull: HULL.SmallShip, where: { cityLights: true, night: true } });   // AUDIT WK-N5 (PIN MOVED): the dark's hours named apart from the lanterns'
  const ids = { m: h.host.spawnShip('merchantGalleon', { range: 300, bearing: 1 }), n: h.host.spawnShip('navyCutter', { range: 320, bearing: -1 }), p: h.host.spawnShip('pirateBrig', { range: 700, bearing: Math.PI, temper: 'bold' }) };
  h.run(0.5);
  const e = (k) => h.host._sea.get(ids[k]);
  for (const k of ['m', 'n', 'p']) assert.ok(e(k).boat?.Lights?.length > 0, `${k} carries lanterns`);
  assert.equal(e('m').boat.LightOn, true);
  assert.equal(e('n').boat.LightOn, true);
  assert.equal(e('p').boat.LightOn, false, 'the pirate prowls dark');
  // a pirate close aboard (dark - seen only so near): the merchantman runs, and douses hers
  e('p').ship.pos[0] = e('m').ship.pos[0] + 120; e('p').ship.pos[2] = e('m').ship.pos[2];
  for (let t = 0; t < 5 && e('m').ship.mode !== 'flee'; t += 0.1) h.host.frame(0.1);
  assert.equal(e('m').ship.mode, 'flee');
  assert.ok(HOST.includes('const lit = shipLit(e);'), 'posed by the law');
  assert.equal(e('m').boat.LightOn, false, 'running, she douses hers');
  // the contacts the captains see
  assert.match(HOST, /ship: e\.ship, lit: shipLit\(e\) \}\);/);
  // AUDIT WK-N4 (PIN MOVED): a boat lit only by lanterns she carries; WK-N5: the captains' night is the dark's
  assert.match(HOST, /lit: !!boat\.LightOn && carriesLanterns\(boat, boat\.hull\),/);
  assert.match(HOST, /lit: !!p\.boat\?\.LightOn && carriesLanterns\(p\.boat, p\.hull\),/);
  assert.match(HOST, /const night = !!where\(\)\.night;[^\n]*\n\s*const world = \{/);
  assert.match(HOST, /\n\s*night,[^\n]*\n\s*\};\n\s*life\.night = night;/);
  const d = await sea({ hull: HULL.SmallShip, where: { cityLights: false } });
  const dm = d.host._sea.get(d.host.spawnShip('merchantGalleon', { range: 300, bearing: 1 }));
  d.run(0.5);
  assert.equal(dm.boat.LightOn, false, 'by day none');
});

test('SHIP-WATCH THE LOOKOUT\'S CRY ON THE REAL HOST: by night a dark pirate is hailed only within NIGHT_DARK_SIGHT (by day at SAIL_HO_RANGE); the cry goes to my crewed boat\'s lookout, taken once through myCrew, which also says her work - all hands to it under a repair order, else her hurts\' (mutants: the night unread, the cry never handed, handed every frame, the work unread)', async () => {
  const h = await sea({ hull: HULL.SmallShip, where: { cityLights: true, night: true } });   // AUDIT WK-N5 (PIN MOVED)
  h.boat.crewed = true;
  const p = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: (SAIL_HO_RANGE + NIGHT_DARK_SIGHT) / 2, bearing: Math.PI / 2, temper: 'bold' }));
  p.ship.speed = 0;
  h.run(1.2);
  assert.ok(!h.log.say.some((t) => /Sail ho/.test(t)), 'unseen in the dark');
  const day = await sea({ hull: HULL.SmallShip, where: { cityLights: false } });
  day.boat.crewed = true;
  day.host._sea.get(day.host.spawnShip('pirateBrig', { range: (SAIL_HO_RANGE + NIGHT_DARK_SIGHT) / 2, bearing: Math.PI / 2, temper: 'bold' }));
  day.run(1.2);
  assert.ok(day.log.say.some((t) => /Sail ho/.test(t)), `by day: ${day.log.say}`);
  const crew = day.host.myCrew(day.boat);
  assert.ok(crew.call && /^Sail ho! (Off|On|Dead)/.test(crew.call), `the lookout's cry: ${crew.call}`);
  assert.equal(day.host.myCrew(day.boat).call, null, 'taken once');
  // close aboard by night: hailed
  p.ship.pos[0] = h.boat.GameObject.position[0] + NIGHT_DARK_SIGHT - 40; p.ship.pos[2] = h.boat.GameObject.position[2];
  h.run(1.2);
  assert.ok(h.log.say.some((t) => /Sail ho/.test(t)), `close aboard: ${h.log.say}`);
  // her work
  const w = await sea({ hull: HULL.SmallShip });
  w.boat.crewed = true;
  assert.equal(w.host.myCrew(w.boat).work, 0, 'sound, nothing to mend');
  w.host.restoreSaveData({ v: 1, boats: { 42: { hull: 100, sail: 160, crew: 24, fire: 0, state: 'afloat', barrels: 4 } }, notoriety: {}, day: 1, raids: [] });
  const hurt = w.host.myCrew(w.boat).work;
  assert.ok(hurt > 0.4 && hurt <= 1, `her hurts: ${hurt}`);
  assert.match(HOST, /const work = boat\.crewed && st\.crew\.order === CREW_ORDERS\.repair \? 1 : workOf\(st\.damage\);/);
  assert.ok(CREW_ORDERS.repair);
});

test('SHIP-WATCH THE FAR LAMPS ON THE REAL HOST: by night a lit ship past LAMP_NEAR_M is drawn as up to LAMP_MAX added points of light at her lanterns, sized and faded by range; a dark pirate none; by day none (mutants: lamps by day, the pirate\'s drawn, none at all)', async () => {
  const h = await sea({ hull: HULL.SmallShip, where: { cityLights: true } });
  const m = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 400, bearing: 1 }));
  const p = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: 400, bearing: -1, temper: 'bold' }));
  h.run(SHIP_FADE_S + 0.3);   // AUDIT BAY A13 PIN MOVED: come into the world whole - under FADE_FLATS a ship shows no lamp
  m.ship.speed = 0; p.ship.speed = 0;
  const lamps = h.host.drawFrame().particles.filter((q) => q.kind === 'lamp');
  assert.ok(lamps.length >= 1 && lamps.length <= LAMP_MAX * 2, `lamps: ${lamps.length}`);
  for (const l of lamps) {
    assert.equal(l.blend, 'add');
    const eye = h.view.look.origin, d = Math.hypot(l.pos[0] - eye[0], l.pos[1] - eye[1], l.pos[2] - eye[2]);
    assert.ok(d > LAMP_NEAR_M);
    assert.ok(Math.abs(l.size - lampSize(d)) < 1e-9 && Math.abs(l.color[3] - lampAlpha(d)) < 1e-9);
    assert.ok(Math.hypot(l.pos[0] - m.ship.pos[0], l.pos[2] - m.ship.pos[2]) < 60, 'the merchantman\'s - never the dark pirate\'s');
  }
  // her own lantern flats near the eye: no lamp of hers within LAMP_NEAR_M
  h.view.look = { origin: [m.ship.pos[0], 6, m.ship.pos[2] + 8], dir: [1, 0, 0] };
  const near = h.host.drawFrame().particles.filter((q) => q.kind === 'lamp' && Math.hypot(q.pos[0] - m.ship.pos[0], q.pos[2] - m.ship.pos[2]) < 60);
  for (const l of near) assert.ok(Math.hypot(l.pos[0] - h.view.look.origin[0], l.pos[1] - h.view.look.origin[1], l.pos[2] - h.view.look.origin[2]) > LAMP_NEAR_M);
  assert.ok(near.length < lamps.length, 'the near ones left to her flats');
  // by day none - a lit boat of mine either (her switch on in daylight)
  const d = await sea({ hull: HULL.SmallShip, where: { cityLights: false } });
  d.host.spawnShip('merchantGalleon', { range: 400, bearing: 1 });
  d.run(0.3);
  setLights(d.boat, true);
  d.view.look = { origin: [300, 6, 300], dir: [1, 0, 0] };
  assert.equal(d.boat.LightOn, true);
  assert.equal(d.host.drawFrame().particles.filter((q) => q.kind === 'lamp').length, 0, 'by day none');
});

test('SHIP-WATCH THE WORLD\'S WIRING: every crew is told the night (the world\'s hour, through the watch\'s law), her work - mine off myCrew, the sea\'s off their hurts - and my lookout\'s cry, handed on once (mutants: the night untold, the work unread, the cry kept)', () => {
  assert.match(WORLD, /const asleep = asleepHour\(hourOf\(minuteNow\(\)\)\);/);
  assert.match(WORLD, /_crewCtx\.asleep = asleep; _crewCtx\.work = ship\.mine \? ship\.mine\.work \?\? 0 : ship\.work \?\? 0;/);
  assert.match(WORLD, /_crewCtx\.call = ship\.mine\?\.call \?\? null;\n\s*if \(ship\.mine\) ship\.mine\.call = null;/);
  assert.match(WORLD, /hold: s\.hold, work: s\.work \?\? 0 \}\);/);
  assert.match(HOST, /toward, work: st === SHIP_STATES\.afloat \? workOf\(e\.ship\.damage\) : 0 \}\);/);
  assert.ok(SHIP_STATES.afloat);
});
