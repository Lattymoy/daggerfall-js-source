// AUDIT WATCH-KIT (2026-10-01, Mac: "Just want to audit this to make sure it's perfection") - LENS W, THE CREW'S LIFE
// ABOARD: SHIP-WATCH's crew (systems/naval/crewLife.js) and its host (scenes/navalCrew.js), with lens D's D5 and its
// safety net on the same two files. Every pin drives the real modules and fails on the code as it stood:
//
//   WK-W1  her lookout keeps her bow by day too - asked at every step from her first, another the step he is gone (never
//          a man on his way below); he talks to nobody, on his way to his post too.
//   WK-W3  a repair order keeps every hand at the work by night; the night watch takes up the work, never a chore.
//   WK-W4  a struck crew takes up no work, swings at none, says none of its words.
//   WK-W5  the guns end the lookout's watch and a walk to a job at once.
//   WK-W7  a crew first stood by night has its sleepers below from its first step - a pause's first frame too.
//   WK-W8  never two on one point: the morning brings them up one at a time, the alarm all at once each at a clear point
//          by her hatch; never into the player; the watch a third of her whole crew.
//   WK-W9  a hand the guns take while below is not below - mended back, he is drawn.
//   WK-W10 the hand her card names Lookout keeps her bow (`ctx.lookout`, his roster place).
//   WK-D5  at the guns her lookout stands at each post as the rest do.
//   WK-SN  the safety net: lens D's fresh mutants on these two files that the suites let live - each an untested law.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCrewLife, crewRoster, crewCount, deckExtentZ, CREW_BLURBS, CREW_TALKS, ALL_HANDS, LOOKOUT_BACK, CREW_LINE_S, CREW_HURRY } from '../src/systems/naval/crewLife.js';
import { watchCount } from '../src/systems/naval/shipWatch.js';
import { createNavalCrew, peopleFlatsOf } from '../src/scenes/navalCrew.js';
import { buildDeck, mainLevel, DECK_STEP } from '../src/systems/naval/navalDeck.js';
import { boxColliderTriangles } from '../src/world/prefabColliders.js';
import { MOBILE } from '../src/systems/naval/navalBoarding.js';
import { classById, HULL } from '../src/systems/naval/navalShips.js';
import { Boat, spawnBoat } from '../src/systems/comeSailAwayBoat.js';
import { ctxFor } from './csaScene.mjs';
import { sea, readyPool } from './navalSea.mjs';

/** A plain deck: a flat 8 m by 24 m at 2 m (her frame) with a mast amidships (livingcrew.test.js's). */
const plainDeck = () => buildDeck([
  { positions: [-4, 2, -12, 4, 2, -12, 4, 2, 12, -4, 2, 12], indices: [0, 1, 2, 0, 2, 3] },
  boxColliderTriangles({ m_Center: { x: 0, y: 6, z: 0 }, m_Size: { x: 1.2, y: 8, z: 1.2 } }),
], { minX: -6, maxX: 6, minZ: -14, maxZ: 14 });
const pirate = classById('pirateBrig');
function run(life, s, ctx = {}, each = null, dt = 0.05) { for (let t = 0; t < s; t += dt) { life.step(dt, ctx); each?.(life); } }
/** A crew of eight on the plain deck, her helmsman (#0) a station off it - shipwatch.test.js's. */
const crewOf = (seed = 4, o = {}) => createCrewLife({ deck: plainDeck(), roster: crewRoster({ hull: 3, seed, shipClass: pirate }), seed, places: [[5.5, 3.2, -11]], ...o });
const rosterOf = (...mobiles) => mobiles.map((mobile) => ({ mobile, gender: 'male' }));
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** Who keeps her bow now - read off the deck, never asked of the crew (production never calls `lookout()`). */
const atBow = (life) => life.members.filter((m) => !m.gone && !m.below && m.state === 'watch' && flat(m.pos, life.bow) < 0.6);
const settle = () => new Promise((r) => setTimeout(r, 0));
const hullOf = (hull) => { const b = new Boat(hull, 0); spawnBoat(b, ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] })); return b; };
function crewHost() {
  const renderer = { createBillboardBatch: (archive) => ({ archive }), destroyBillboardBatch() {}, textures: new Map() };
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 20 };
  return createNavalCrew({ renderer, getTexture: async () => tex, uploadRecordFrame() {}, rand: () => 0.3 });
}

// ── WK-W1: her bow kept by day ───────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-W1 HER BOW KEPT BY DAY: a crew stood by day has her lookout at her bow within half a minute and one man keeps it every step after - a walker, never her Bard nor her station, facing out over her stem, never once in a talk (nobody talks him off his way to it) - read off her deck, never asked for (was: nobody kept it all day until a nightfall or a cry chose him; 0 of 2401 steps) (mutants: chosen only by the night, a shipmate talks him off his way)', () => {
  for (const seed of [4, 5, 6, 7, 8]) {
    const life = crewOf(seed);
    let keeper = null;
    const talked = new Set();
    for (let t = 0; t < 120; t += 0.05) {
      life.step(0.05, {});
      for (const m of life.members) if (m.mate) talked.add(m);
      const at = atBow(life);
      if (t >= 30) assert.equal(at.length, 1, `seed ${seed}: her bow kept at ${t.toFixed(2)} s`);
      if (!at.length) continue;
      keeper = keeper ?? at[0];
      assert.equal(at[0], keeper, `seed ${seed}: one man keeps it`);
      assert.equal(at[0].face, 0, 'facing out over her stem');
    }
    assert.ok(keeper && !keeper.station && keeper.mobile !== MOBILE.Bard && keeper.i > 0, `seed ${seed}: a walker keeps it`);
    assert.ok(!talked.has(keeper), `seed ${seed}: he talks to nobody`);
  }
});

test('AUDIT WK-W1 ANOTHER THE STEP HE IS GONE: by day her lookout ashore with the player, taken over the rail or fallen to the guns - another keeps her bow (her first man when none else can); at nightfall, the rest on their way below, the call goes to a man who stays on deck - never one walking to her hatch (was: her bow unkept till the next nightfall) (mutants: none chosen by day, a man on his way below chosen)', () => {
  const life = crewOf(4);
  run(life, 40, {});
  const first = atBow(life)[0];
  assert.ok(first, 'her lookout');
  life.away(new Set([first.i]));   // ashore with the player
  run(life, 30, {});
  const second = atBow(life)[0];
  assert.ok(second && second !== first, 'another keeps it');
  life.take(1, { from: life.members.slice(0, second.i).filter((m) => !m.gone).length });   // over the rail
  assert.ok(second.gone && second.taken);
  run(life, 30, {});
  const third = atBow(life)[0];
  assert.ok(third && third !== second && third !== first, 'and another');
  // the guns: her lookout the last of her roster (the trim's first) - none left to keep it but her first man
  const four = createCrewLife({ deck: plainDeck(), roster: rosterOf(MOBILE.Warrior, MOBILE.Bard, MOBILE.Bard, MOBILE.Archer), seed: 3 });
  run(four, 40, {});
  assert.equal(atBow(four)[0]?.i, 3, 'past her Bards');
  four.trim(3);
  run(four, 30, {});
  assert.equal(atBow(four)[0]?.i, 0, 'her first man, none else able');
  // nightfall: her lookout goes ashore while the rest walk to her hatch (her watch: her helmsman, him, her Bard)
  const night = createCrewLife({ deck: plainDeck(), roster: rosterOf(MOBILE.Warrior, MOBILE.Archer, MOBILE.Bard, MOBILE.Monk, MOBILE.Rogue, MOBILE.Warrior, MOBILE.Barbarian, MOBILE.Archer), seed: 5, places: [[5.5, 3.2, -11]] });
  run(night, 40, {});
  const lk = atBow(night)[0];
  assert.equal(lk?.i, 1);
  night.step(0.05, { asleep: true });
  assert.ok(night.members.filter((m) => m.state === 'turnIn').length >= 4, 'on their way below');
  night.away(new Set([lk.i]));
  for (const m of night.members) m.line = null;
  night.step(0.05, { asleep: true, call: 'Sail ho! Off the port bow!' });
  const crier = night.speech().find((s) => s.text === 'Sail ho! Off the port bow!')?.member;
  assert.ok(crier && crier.state !== 'turnIn' && !crier.below, `cried by a man who stays on deck: #${crier?.i} ${crier?.state}`);
});

// ── WK-W3: the work by night ─────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-W3 THE WORK BY NIGHT: a repair order keeps every hand up and at the work through the sleeping hours, and given after they turned in brings them up to it; without one her hurts are her watch\'s work - the rest turned in, the watch at it, swinging; at peace with nothing to mend never a chore by night, and every crew turns in but its watch (was: nobody worked by night, the order or none - 0 of 3600 steps) (mutants: the order sleeps, the watch idle by night, the night ends the work, a chore by night)', () => {
  const order = crewOf(4);
  let below = 0, working = 0, swings = 0;
  run(order, 120, { asleep: true, order: 'repair', work: 1 }, (l) => {
    below = Math.max(below, l.belowCount());
    working = Math.max(working, l.members.filter((m) => m.state === 'work').length);
    swings += l.members.filter((m) => m.swing).length;
  });
  assert.equal(below, 0, 'every hand up');
  assert.ok(working >= 3 && swings > 20, `hands at work: ${working}, ${swings} swings`);
  const late = crewOf(5);
  run(late, 40, { asleep: true });
  assert.ok(late.belowCount() > 0);
  let lateWork = 0;
  run(late, 60, { asleep: true, order: 'repair', work: 1 }, (l) => { lateWork = Math.max(lateWork, l.members.filter((m) => m.state === 'work').length); });
  assert.equal(late.belowCount(), 0, 'the order brings them up');
  assert.ok(lateWork >= 3, `and to the work: ${lateWork}`);
  // her hurts, no order: her watch at them
  const hurt = crewOf(6);
  let watchWork = 0, watchSwings = 0;
  run(hurt, 300, { asleep: true, work: 0.6 }, (l) => { watchWork = Math.max(watchWork, l.members.filter((m) => m.state === 'work').length); watchSwings += l.members.filter((m) => m.swing).length; });
  assert.equal(hurt.belowCount(), hurt.standing() - watchCount(hurt.standing()), 'the rest turned in');
  assert.ok(watchWork >= 1 && watchSwings > 5, `her watch at the work: ${watchWork}, ${watchSwings} swings`);
  // nothing to mend: no chore taken up, none walked to
  const calm = crewOf(7);
  let chores = 0;
  run(calm, 300, { asleep: true }, (l) => { chores += l.members.filter((m) => m.state === 'work' || m.state === 'toWork').length; });
  assert.equal(chores, 0, 'never a chore by night');
  assert.equal(calm.belowCount(), calm.standing() - watchCount(calm.standing()), 'every crew turns in but its watch');
});

test('AUDIT WK-W3 A CHORE AT NIGHTFALL: a man of her watch at a chore when the night comes leaves it that step, and one walking to a chore never takes it up - the work by night is her hurts\' alone (mutants: the night ends no chore, a walk to one at nightfall begun)', () => {
  let ended = 0, walked = 0;
  for (let seed = 1; seed <= 60 && !(ended && walked); seed++) {
    for (const want of ['work', 'toWork']) {
      if (want === 'work' ? ended : walked) continue;
      const life = crewOf(seed);
      const w = life.members[2];   // her watch's third: her helmsman, her lookout, then the roster's first
      let t = 0;
      for (; t < 300; t += 0.05) {
        life.step(0.05, {});
        if (w.state === want && (want === 'work' ? w.t > 1 : !!w.path && w.path.length - w.leg >= 2)) break;
      }
      if (t >= 300) continue;
      life.step(0.05, { asleep: true });
      assert.ok(!w.below && w.state !== 'turnIn', `seed ${seed}: of her watch`);
      let worked = 0;
      for (let k = 0; k < 400; k++) { life.step(0.05, { asleep: true }); if (w.state === 'work') worked++; }
      assert.equal(worked, 0, `seed ${seed}: no chore by night (${want} at nightfall)`);
      if (want === 'work') ended++; else walked++;
    }
  }
  assert.ok(ended && walked, `found: at a chore ${ended}, walking to one ${walked}`);
});

// ── WK-W4: a struck crew at no work ──────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-W4 A STRUCK CREW AT NO WORK: her colours down, nobody takes up a chore or a job, swings or says the work\'s words - her surrender\'s few alone (AUDIT NAV2 F46); a man at his work when she strikes leaves it that step, one walking to it stops (was: chores on 13762 of 24000 steps, 680 swings, "Swab that deck!" after she struck) (mutants: a struck crew takes up chores, works on, walks on to it)', () => {
  const words = new Set();
  let work = 0, swings = 0;
  for (const seed of [4, 5, 6, 7]) {
    const life = crewOf(seed);
    run(life, 300, { struck: true, work: 0 }, (l) => {
      work += l.members.filter((m) => m.state === 'work' || m.state === 'toWork').length;
      swings += l.members.filter((m) => m.swing).length;
      for (const s of l.speech()) words.add(s.text);
    });
  }
  assert.equal(work, 0, 'no chore'); assert.equal(swings, 0, 'no swing');
  assert.ok(words.size > 0);
  for (const w of words) assert.ok(CREW_BLURBS.struck.includes(w), `a surrender's word: ${w}`);
  // at it, and on the way to it, when she strikes - her hurts as bad as they come (the sea's say none once she strikes)
  let atWork = null, toWork = null, life = null;
  for (let seed = 4; seed < 40 && !(atWork && toWork); seed++) {
    life = crewOf(seed);
    for (let t = 0; t < 120 && !(atWork && toWork); t += 0.05) {
      life.step(0.05, { work: 1 });
      atWork = life.members.find((m) => m.state === 'work' && m.t > 1) ?? null;
      toWork = life.members.find((m) => m.state === 'toWork' && !!m.path && m.path.length - m.leg >= 2) ?? null;
    }
  }
  assert.ok(atWork && toWork);
  life.step(0.05, { struck: true, work: 1 });
  assert.notEqual(atWork.state, 'work', 'his work left'); assert.equal(atWork.swing, false);
  assert.notEqual(toWork.state, 'toWork', 'his walk to it given up'); assert.equal(toWork.path, null);
  let since = 0;
  run(life, 30, { struck: true, work: 1 }, (l) => { since += l.members.filter((m) => m.state === 'work' || m.state === 'toWork' || m.swing).length; });
  assert.equal(since, 0, 'none after');
});

// ── WK-W5: the guns end it ───────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-W5 THE GUNS END IT AT ONCE: her lookout leaves his watch the step the guns open and runs as a gunner, never at his watch while they fire; a man walking to a job gives the walk up that step and runs to a post (was: the watch kept up to 22 s, the walk ambled on up to 58 s) (mutants: the watch through the guns, the walk to the job through them)', () => {
  for (const seed of [4, 5, 6]) {
    const life = crewOf(seed);
    run(life, 2, {}); run(life, 30, { asleep: true }); run(life, 60, {});   // a night and a morning: at his post as it ever was
    const lk = atBow(life)[0];
    assert.ok(lk);
    life.step(0.05, { battle: true });
    assert.notEqual(lk.state, 'watch', `seed ${seed}: the guns end his watch`);
    let ran = false;
    run(life, 20, { battle: true }, () => { assert.notEqual(lk.state, 'watch'); if (lk.moving && lk.speed === CREW_HURRY) ran = true; });
    assert.ok(ran, `seed ${seed}: a gunner like the rest`);
  }
  let found = 0;
  for (let seed = 1; seed <= 40 && found < 3; seed++) {
    const life = crewOf(seed);
    let w = null;
    for (let t = 0; t < 120 && !w; t += 0.05) { life.step(0.05, { work: 1 }); w = life.members.find((m) => m.state === 'toWork' && !!m.path && m.path.length - m.leg >= 2) ?? null; }
    if (!w) continue;
    found++;
    life.step(0.05, { battle: true, work: 1 });
    assert.equal(w.state, 'idle', `seed ${seed}: his walk to the job given up`);
    assert.equal(w.path, null);
    let ran = false;
    run(life, 5, { battle: true, work: 1 }, () => { assert.notEqual(w.state, 'toWork'); if (w.moving) { assert.equal(w.speed, CREW_HURRY); ran = true; } });
    assert.ok(ran, `seed ${seed}: to a post at a run`);
  }
  assert.equal(found, 3);
});

// ── WK-W7: stood by night ────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-W7 STOOD BY NIGHT: a crew first stood in the sleeping hours has its sleepers below from its first step - nobody walks to her hatch, no sleeper moved - and through the real crew host on the real hulls only her watch is ever drawn, a paused first frame too (nothing moving under the pause after); a crew stood by day still walks to her hatch at nightfall (was: every hand stood on deck, then walked below before the eye for up to 30 s) (mutants: a walk below at her first step, every nightfall at once, a paused first step skipped, every step her first)', async () => {
  for (const seed of [4, 5, 6]) {
    const life = crewOf(seed);
    const at = life.members.map((m) => [...m.pos]);
    life.step(0.05, { asleep: true });
    const n = life.standing();
    assert.equal(life.belowCount(), n - watchCount(n), `seed ${seed}: below from the first step`);
    let walked = 0;
    run(life, 40, { asleep: true }, (l) => { walked += l.members.filter((m) => m.state === 'turnIn').length; });
    assert.equal(walked, 0, 'nobody walked to her hatch');
    for (const m of life.members) if (m.below) assert.deepEqual(m.pos, at[m.i], 'no sleeper moved');
  }
  // the real host on the real hulls - and a pause over her first frame
  const pool = await readyPool();
  for (const [hull, cls, paused] of [[HULL.SmallShip, 'merchantGalleon', false], [HULL.LargeGalley, 'navyGalley', false], [HULL.Carrack, 'merchantCarrack', true]]) {
    const crew = crewHost();
    const shipClass = classById(cls);
    crew.sync([{ key: 's', boat: hullOf(hull), deck: pool.deckOf(hull, 0), count: crewCount({ hull, shipClass, crewShare: 1 }), rosterOf: () => crewRoster({ hull, seed: 11, shipClass }), seed: 11, faction: shipClass.faction }]);
    await settle();
    const life = crew.ships()[0].life;
    crew.frame(paused ? 0 : 0.05, [0, 10, 0], () => ({ asleep: true }));
    // her watch: her stations at their posts, her lookout, then the roster's first to a third
    const watch = life.standing() - life.belowCount();
    assert.ok(life.belowCount() > 0 && watch >= watchCount(life.standing()), `${cls}: below from her first frame${paused ? ', a paused one' : ''}`);
    assert.equal(crew.batches().length, watch, `${cls}: her watch alone drawn`);
    let most = 0;
    if (paused) {
      const still = JSON.stringify(life.members.map((m) => [m.pos, m.state]));
      for (let i = 0; i < 20; i++) { crew.frame(0, [0, 10, 0], () => ({ asleep: true })); most = Math.max(most, crew.batches().length); }
      assert.equal(JSON.stringify(life.members.map((m) => [m.pos, m.state])), still, 'nothing moves under the pause after');
    }
    let walked = 0;
    for (let t = 0; t < 30; t += 0.05) { crew.frame(0.05, [0, 10, 0], () => ({ asleep: true })); most = Math.max(most, crew.batches().length); walked += life.members.filter((m) => m.state === 'turnIn').length; }
    assert.equal(most, watch, `${cls}: only her watch ever drawn`);
    assert.equal(walked, 0, `${cls}: nobody walked below before the eye`);
  }
  // stood by day: the night still walks them below
  const day = crewOf(4);
  run(day, 2, {});
  let walked = 0;
  run(day, 40, { asleep: true }, (l) => { walked += l.members.filter((m) => m.state === 'turnIn').length; });
  assert.ok(walked > 0, 'stood by day: to her hatch at nightfall');
  for (const m of day.members) if (m.below) assert.ok(flat(m.pos, day.hatch) < 0.8, 'down her hatch');
});

// ── WK-W8: never two on one point ────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-W8 OUT OF HER HATCH ONE AT A TIME: the morning brings her sleepers up one a step at the most, each out only while nobody stands at her hatch, every hand up within seconds; the alarm brings every hand up that step, one crying ALL_HANDS, each at her hatch or beside it where nobody stands; the guns while the morning\'s still coming up bring the rest at once, crying it (was: every sleeper stood on her hatch\'s one point, five merged there for up to 5 s) (mutants: all on her hatch, the alarm\'s on one point, the alarm one at a time, the guns wait on the morning, no cry)', async () => {
  for (const seed of [4, 5, 6, 7]) {
    const life = crewOf(seed);
    run(life, 40, { asleep: true });
    const n = life.belowCount();
    assert.ok(n >= 4);
    let t = 0;
    for (; t < 10 && life.belowCount() > 0; t += 0.05) {
      const was = new Set(life.members.filter((m) => m.below));
      life.step(0.05, {});
      const rose = [...was].filter((m) => !m.below);
      assert.ok(rose.length <= 1, `seed ${seed}: one at a time (${rose.length} at ${t.toFixed(2)} s)`);
      for (const r of rose) for (const o of life.members) if (o !== r && !o.gone && !o.below) assert.ok(flat(o.pos, r.pos) > 0.5, `seed ${seed}: #${r.i} up beside #${o.i}`);
    }
    assert.equal(life.belowCount(), 0, `seed ${seed}: every hand up within seconds (${t.toFixed(2)} s)`);
  }
  // the alarm - on the plain deck and on the real hulls
  const pool = await readyPool();
  const decks = [[plainDeck(), crewRoster({ hull: 3, seed: 5, shipClass: pirate })], [pool.deckOf(HULL.SmallShip, 0), crewRoster({ hull: 2, seed: 5, shipClass: pirate })], [pool.deckOf(HULL.Carrack, 0), crewRoster({ hull: 4, seed: 5, shipClass: classById('merchantCarrack') })]];
  for (const [deck, roster] of decks) {
    const life = createCrewLife({ deck, roster, seed: 5 });
    run(life, 2, {});
    run(life, 40, { asleep: true });
    assert.ok(life.belowCount() > 0);
    const sleepers = life.members.filter((m) => m.below);
    for (const m of life.members) m.line = null;
    life.step(0.05, { asleep: true, battle: true });
    assert.equal(life.belowCount(), 0, 'every hand up that step');
    assert.ok(life.speech().some((s) => s.text === ALL_HANDS && s.kind === 'shout'), 'the cry');
    for (const r of sleepers) {
      assert.ok(flat(r.pos, life.hatch) < 2.7, 'at her hatch or beside it');
      for (const o of life.members) if (o !== r && !o.gone) assert.ok(flat(o.pos, r.pos) > 0.3, `#${r.i} and #${o.i} on one point`);
    }
    // PIN MOVED (AUDIT GALLEON D7, 2026-10-02): her hatch stands beside her hatchway now, never on its cover - her
    // risers come up on her deck beside the hole and file off it one behind another (AUDIT NAV2 F41's yield), the
    // last off at a run 1.30 s after the alarm on the galleon and 1.55 s on the Carrack (seed 5; on her cover it was
    // 0.45 and 0.60 - and 1.85 s on the Carrack's seed 11): each off at a run within two seconds
    const ran = new Set();
    run(life, 2, { battle: true }, () => { for (const r of sleepers) if (r.moving && r.speed === CREW_HURRY) ran.add(r); });
    assert.equal(ran.size, sleepers.length, 'each off at a run');
  }
  // the guns while the morning's hands still come up
  const mid = crewOf(6);
  run(mid, 40, { asleep: true });
  mid.step(0.05, {});
  assert.ok(mid.belowCount() > 0, 'the morning\'s still coming up');
  for (const m of mid.members) m.line = null;
  mid.step(0.05, { battle: true });
  assert.equal(mid.belowCount(), 0, 'the rest at once');
  assert.ok(mid.speech().some((s) => s.text === ALL_HANDS), 'cried');
});

test('AUDIT WK-W8 NEVER INTO THE PLAYER, AND THE WATCH A THIRD OF HER CREW: the player standing on her hatch holds the morning\'s hands below - none comes up into him - and they come once he steps off; the alarm stands none within 0.6 m of him; a night falling on the morning\'s rising (a repair order given and lifted) keeps a third of her whole crew on watch, the hands still below counted (mutants: up into the player, the watch a third of those on deck)', () => {
  const life = crewOf(4);
  run(life, 40, { asleep: true });
  const me = [...life.hatch];
  run(life, 10, { avoid: me }, (l) => { for (const m of l.members) if (!m.gone && !m.below) assert.ok(flat(m.pos, me) >= 0.6, `#${m.i} up into the player`); });
  assert.ok(life.belowCount() > 0, 'held below while he stands there');
  const off = [me[0] + 3, me[1], me[2]];
  run(life, 10, { avoid: off });
  assert.equal(life.belowCount(), 0, 'up once he steps off');
  const alarm = crewOf(5);
  run(alarm, 40, { asleep: true });
  const me2 = [...alarm.hatch];
  alarm.step(0.05, { asleep: true, battle: true, avoid: me2 });
  assert.equal(alarm.belowCount(), 0);
  for (const m of alarm.members) if (!m.gone) assert.ok(flat(m.pos, me2) >= 0.6 - CREW_HURRY * 0.05, `#${m.i} up into the player`);
  // the order given and lifted at night: one of the morning's up, the rest still below
  for (const seed of [4, 5]) {
    const l = crewOf(seed);
    run(l, 40, { asleep: true });
    const n = l.standing();
    l.step(0.05, { asleep: true, order: 'repair' });
    l.step(0.05, { asleep: true, order: 'repair' });
    assert.ok(l.belowCount() > 0 && l.belowCount() < n - watchCount(n), 'some of them up');
    run(l, 40, { asleep: true });
    assert.equal(n - l.belowCount(), watchCount(n), `seed ${seed}: a third of her whole crew on watch`);
  }
});

// ── WK-W9: gone is never below ───────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-W9 TAKEN WHILE BELOW, MENDED BACK, DRAWN: a hand the guns take while he sleeps is not below; mended back by day he stands on her deck - and through the real crew host on the real Small Ship he is drawn (was: kept below, counted but never drawn till 05:00) (mutants: gone and below)', async () => {
  const life = crewOf(4);
  run(life, 40, { asleep: true });
  const n = life.standing();
  life.trim(n - 2);
  assert.ok(life.members.every((m) => !(m.gone && m.below)), 'gone is never below');
  run(life, 10, {});
  life.restore(n);
  assert.equal(life.standing(), n);
  assert.equal(life.belowCount(), 0, 'mended back on her deck');
  // the real host: my crew of 24 asleep, a fire takes four, the morning, the yard signs four back on
  const pool = await readyPool();
  const crew = crewHost();
  const boat = hullOf(HULL.SmallShip), deck = pool.deckOf(HULL.SmallShip, 0);
  const entry = (men) => ({ key: boat, boat, deck, count: crewCount({ hull: HULL.SmallShip, crew: men }), rosterOf: () => crewRoster({ hull: HULL.SmallShip, seed: 9, crew: men }), seed: 9, faction: null, battle: false, away: new Set() });
  const frames = (s, men, asleep) => { for (let t = 0; t < s; t += 0.05) { crew.sync([entry(men)]); crew.frame(0.05, [0, 10, 0], () => ({ order: 'stand', asleep })); } };
  crew.sync([entry(24)]);
  await settle();
  frames(40, 24, true);
  const sh = crew.ships()[0].life;
  assert.ok(sh.belowCount() > 0);
  frames(1, 20, true);
  frames(5, 20, false);
  frames(5, 24, false);
  await settle();
  frames(20, 24, false);
  assert.equal(sh.standing(), crewCount({ hull: HULL.SmallShip, crew: 24 }));
  assert.equal(crew.batches().length, sh.standing(), 'every hand drawn');
});

// ── WK-W10: her card's Lookout ───────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-W10 HER CARD\'S LOOKOUT KEEPS HER BOW: `ctx.lookout` names his roster place - he keeps her bow and cries the call; ashore, another keeps it for him; home, he takes it back and the one who kept it leaves it - never two at her bow; a place none can keep it from (her Bard, her station, past her roster, no number) is today\'s rule (was: her Bosun at the bow while her card\'s Lookout wandered) (mutants: the card unread, the stand-in kept at the bow, a Bard named)', () => {
  const life = crewOf(4);
  const named = 4;
  run(life, 40, { lookout: named });
  assert.equal(atBow(life)[0]?.i, named, 'he keeps her bow');
  for (const m of life.members) m.line = null;
  life.step(0.05, { lookout: named, call: 'Sail ho! Dead ahead!' });
  assert.equal(life.speech().find((s) => s.text === 'Sail ho! Dead ahead!')?.member.i, named, 'and cries it');
  life.away(new Set([named]));
  run(life, 40, { lookout: named });
  const standIn = atBow(life)[0];
  assert.ok(standIn && standIn.i !== named, 'another keeps it for him');
  life.away(new Set());
  life.step(0.05, { lookout: named });
  assert.notEqual(standIn.state, 'watch', 'the one who kept it sent off it that step');
  let two = 0;
  run(life, 40, { lookout: named }, (l) => { if (l.members.filter((m) => !m.gone && flat(m.pos, l.bow) < 0.6).length > 1) two++; });
  assert.equal(atBow(life)[0]?.i, named, 'his post again');
  assert.equal(two, 0, 'never two at her bow');
  // home while the one keeping it for him is still on his way to it: that walk is given up too
  const walk = crewOf(5);
  run(walk, 40, { lookout: named });
  walk.away(new Set([named]));
  let going = null;
  for (let t = 0; t < 60 && !going; t += 0.05) { walk.step(0.05, { lookout: named }); going = walk.members.find((m) => m.state === 'walk' && m.path && flat(m.path.at(-1), walk.bow) < 0.3 && m.path.length - m.leg >= 2) ?? null; }
  assert.ok(going, 'one on his way to keep it');
  walk.away(new Set());
  walk.step(0.05, { lookout: named });
  assert.ok(!going.path || flat(going.path.at(-1), walk.bow) > 0.6, 'his walk to her bow given up');
  // none can keep it from there: today's rule (her first walker past her Bard)
  const bard = () => createCrewLife({ deck: plainDeck(), roster: rosterOf(MOBILE.Warrior, MOBILE.Bard, MOBILE.Archer, MOBILE.Monk), seed: 3, places: [[5.5, 3.2, -11]] });
  for (const place of [1, 0, 9, -1, 2.5, null, undefined]) {
    const l = bard();
    run(l, 40, { lookout: place });
    assert.equal(atBow(l)[0]?.i, 2, `lookout ${place}: today's rule`);
  }
});

test('AUDIT WK-W10 THE REAL CARD: her Large Galley\'s card names a hand Lookout (the host\'s crewOf hands, shipCrew.js ROLES) - stood by world.js\'s roster with her own flats\' places, he keeps her bow and cries her lookout\'s call (was: her Bosun did)', async () => {
  const h = await sea({ hull: HULL.LargeGalley, where: { cityLights: false } });
  h.boat.crewed = true;
  h.run(0.2);
  const mine = h.host.myCrew(h.boat), card = h.host.crewOf(h.boat);
  const roster = crewRoster({ hull: HULL.LargeGalley, seed: 42, crew: mine.crew }).map((r, i) => (card.hands[i] ? { mobile: card.hands[i].mobile, gender: card.hands[i].gender } : r));
  const deck = h.pool.deckOf(HULL.LargeGalley, 0);
  const main = mainLevel(deck);
  const places = peopleFlatsOf(h.boat).filter((f) => f.feet[1] >= main - DECK_STEP).map((f) => f.feet);
  const named = card.hands.findIndex((x) => x.role === 'Lookout');
  assert.ok(named > 0 && named < roster.length, `her Lookout on her deck: #${named}`);
  const life = createCrewLife({ deck, roster, seed: 42, places });
  life.step(0.05, { lookout: named, call: 'Sail ho! Off the port bow!' });
  assert.equal(life.speech().find((s) => /Sail ho/.test(s.text))?.member.i, named, `cried by ${card.hands[named].name}, Lookout`);
  run(life, 60, { lookout: named });
  assert.equal(atBow(life)[0]?.i, named, 'at her bow');
});

// ── WK-D5: a gunner like the rest ────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-D5 A GUNNER LIKE THE REST: at the guns her lookout stands at each post as the rest do - moving no more of the fight than they - and by day he takes his watch the step he reaches her bow (was: at the guns he ran post to post without a stop, moving 91% of the steps against 32-40%) (mutants: no stand at the guns, a dawdle at the bow)', () => {
  for (const seed of [4, 5, 6]) {
    const life = crewOf(seed);
    run(life, 2, {}); run(life, 30, { asleep: true }); run(life, 60, {});   // a night and a morning: at his post as it ever was
    const lk = atBow(life)[0];
    assert.ok(lk);
    const moved = new Map(life.members.map((m) => [m, 0]));
    let n = 0;
    run(life, 120, { battle: true }, (l) => { n++; for (const m of l.members) if (m.moving) moved.set(m, moved.get(m) + 1); });
    const others = life.members.filter((m) => m !== lk && !m.station).map((m) => moved.get(m) / n);
    assert.ok(moved.get(lk) / n < Math.max(...others) + 0.1, `seed ${seed}: the lookout moving ${(moved.get(lk) / n).toFixed(2)} against ${others.map((x) => x.toFixed(2))}`);
  }
  for (const seed of [4, 5, 6, 7]) {
    const life = crewOf(seed);
    let arrived = -1;
    for (let k = 0; k < 1200; k++) {
      const walking = life.members.filter((m) => m.state === 'walk' && m.path && flat(m.path.at(-1), life.bow) < 0.3);
      life.step(0.05, {});
      const there = walking.find((m) => !m.path && flat(m.pos, life.bow) < 0.3);
      if (there) { arrived = k; life.step(0.05, {}); assert.equal(there.state, 'watch', `seed ${seed}: his watch the step after he reaches it`); break; }
    }
    assert.ok(arrived >= 0, `seed ${seed}: he reached her bow`);
  }
});

// ── WK-SN: the safety net ────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-SN THE WORK\'S MEASURE AND ITS WORDS: the more a fight left her to mend the more of her crew at it (WORK_SHARE scaled by her work) - and a man at a chore at peace says the chore\'s words, at her hurts the work\'s (mutants LD-CL-work-unscaled, LD-CL-chores-say-work)', () => {
  const busy = (work) => { let sum = 0, n = 0; for (const seed of [4, 5, 6, 7, 8, 9]) run(crewOf(seed), 240, { work }, (l) => { sum += l.members.filter((m) => m.state === 'work').length; n++; }); return sum / n; };
  const little = busy(0.1), much = busy(1);
  assert.ok(much > 1.6 * little, `at work: ${much.toFixed(2)} with everything to mend, ${little.toFixed(2)} with a tenth`);
  const said = { work: new Set(), chore: new Set() };
  for (const [kind, work] of [['chore', 0], ['work', 1]]) {
    for (const seed of [4, 5, 6, 7]) run(crewOf(seed), 300, { work }, (l) => { for (const s of l.speech()) if (s.member.state === 'work' && s.member.line.t > CREW_LINE_S - 0.051) said[kind].add(s.text); });
  }
  assert.ok(said.chore.size > 0 && said.work.size > 0);
  for (const w of said.chore) assert.ok(CREW_BLURBS.chore.includes(w) || !CREW_BLURBS.work.includes(w), `a chore's word: ${w}`);
  assert.ok([...said.chore].some((w) => CREW_BLURBS.chore.includes(w) && !CREW_BLURBS.work.includes(w)), 'the chore\'s own words');
  assert.ok([...said.work].some((w) => CREW_BLURBS.work.includes(w) && !CREW_BLURBS.chore.includes(w)), 'the work\'s own words');
});

test('AUDIT WK-SN THE NIGHT\'S WORDS: her watch says the night\'s words - never her trade\'s, never her crew\'s own lines (their spirits\', their order\'s), which they say by day (mutants LD-CL-their-lines-at-night, LD-CL-trade-words-at-night)', () => {
  const OURS = 'Our own line.';
  const words = (asleep) => { const out = new Set(); for (const seed of [4, 5, 6]) run(crewOf(seed, { faction: 'pirate' }), 600, { asleep, line: () => OURS }, (l) => { for (const s of l.speech()) out.add(s.text); }); return out; };
  const night = words(true), day = words(false);
  assert.ok(night.size > 0);
  assert.ok(!night.has(OURS), 'their own lines wait for the day');
  for (const w of night) assert.ok(!CREW_BLURBS.pirate.includes(w), `a trade's word by night: ${w}`);
  assert.ok(day.has(OURS), 'by day they say them');
});

test('AUDIT WK-SN HER HATCH AND HER BOW: her hatch at her main deck\'s middle, her bow LOOKOUT_BACK from her stem - each the deck cell nearest her centre line there (mutants LD-CL-hatch-at-stern, LD-CL-bow-at-stem)', async () => {
  const pool = await readyPool();
  for (const deck of [plainDeck(), pool.deckOf(HULL.SmallShip, 0), pool.deckOf(HULL.LargeGalley, 0), pool.deckOf(HULL.Carrack, 0)]) {
    const life = createCrewLife({ deck, roster: crewRoster({ hull: 3, seed: 4, shipClass: pirate }), seed: 4 });
    // PIN MOVED (GALLEON, 2026-10-01): her MAIN deck's middle, as said - the new galleon's castle (and the Carrack's
    // forecastle) up their flights her deck too, never where her hatch is. PIN MOVED (AUDIT GALLEON D4 and D7,
    // 2026-10-02): her bow LOOKOUT_BACK from her MAIN deck's stem, a cell of it (the Carrack's ran up her forecastle's
    // stair: her lookout watched up there 1460 s of 1740) - and her hatch the cell of her main deck nearest its middle:
    // her hatchways no deck now, so beside one where one lies there (the galleon's 1.6 m to port of her fore
    // hatchway's middle, the Carrack's 2.5 m before her middle at her 5 m cargo hatch's fore end)
    const lv = mainLevel(deck), main = deckExtentZ(deck, lv), mid = (main[0] + main[1]) / 2;
    assert.deepEqual(life.hatch, deck.nearest(0, mid, lv), 'her hatch the cell of her main deck nearest her middle');
    assert.ok(Math.abs(life.hatch[2] - mid) < (deck === pool.deckOf(HULL.Carrack, 0) ? 2.6 : 1.5), `her hatch amidships: ${life.hatch[2]} in ${main}`);
    // PIN MOVED (SHIPS-2, 2026-10-07): the Carrack is Mac's carrack now - her fore mast's partner (2.5 m across, 0.78
    // m over her deck) stands on her main deck's stem, and her bow is the cell nearest it on her centre line, abaft the
    // partner (1.25 m further aft than LOOKOUT_BACK); every other deck's LOOKOUT_BACK from her stem as it was
    const reach = deck === pool.deckOf(HULL.Carrack, 0) ? 1.3 : deck.cell;
    assert.ok(Math.abs(life.bow[2] - (main[1] - LOOKOUT_BACK)) < reach && Math.abs(life.bow[0]) < deck.cell, `her bow ${LOOKOUT_BACK} m from her main deck's stem: ${life.bow[2]} in ${main}`);
    assert.deepEqual(life.bow, deck.nearest(0, main[1] - LOOKOUT_BACK, lv));
    assert.ok(Math.abs(life.bow[1] - lv) <= DECK_STEP && Math.abs(life.hatch[1] - lv) <= DECK_STEP, 'each on her main deck');
    assert.ok(deck.walkable(life.bow[0], life.bow[2]) && deck.walkable(life.hatch[0], life.hatch[2]), 'each a cell of her deck');
  }
});

test('AUDIT WK-SN THE ALARM ON THE WAY BELOW, AND THE TALKS A NIGHT ENDS: a man still walking to her hatch when the guns open stops and runs to them within a second (never below through the fight); a nightfall ends every talk across her watch - nobody on deck left talking to a man going below, no talk\'s line from one (mutants LD-CL-allup-walkers-left, LD-CL-allup-slow, LD-CL-turnin-talk-kept)', () => {
  for (const seed of [4, 5, 6]) {
    const life = crewOf(seed);
    run(life, 2, {});
    run(life, 1, { asleep: true });
    const walking = life.members.filter((m) => m.state === 'turnIn');
    assert.ok(walking.length >= 2, `seed ${seed}: on their way below`);
    life.step(0.05, { asleep: true, battle: true });
    assert.ok(walking.every((m) => m.state !== 'turnIn'), 'stopped');
    const ran = new Set();
    run(life, 1.2, { battle: true }, (l) => { assert.equal(l.belowCount(), 0); for (const m of walking) if (m.moving && m.speed === CREW_HURRY) ran.add(m); });
    assert.equal(ran.size, walking.length, `seed ${seed}: each at the guns within a second`);
  }
  let checked = 0;
  for (let seed = 1; seed <= 40 && checked < 3; seed++) {
    const life = crewOf(seed);
    const watch = new Set(life.members.slice(0, 3));   // her helmsman, her lookout, the roster's first
    let pair = null;
    for (let t = 0; t < 300 && !pair; t += 0.05) {
      life.step(0.05, {});
      pair = life.members.find((m) => m.mate && m.state === 'talk' && m.talk?.lead && watch.has(m) !== watch.has(m.mate)) ?? null;
    }
    if (!pair) continue;
    checked++;
    run(life, 30, { asleep: true }, (l) => {
      for (const m of l.members) {
        if (m.gone) continue;
        if (m.below || m.state === 'turnIn') assert.ok(!m.mate && !(m.line && CREW_TALKS.some((s) => s.includes(m.line.text))), `seed ${seed}: #${m.i} at a talk on his way below`);
        else if (m.mate) assert.ok(!m.mate.below && m.mate.state !== 'turnIn', `seed ${seed}: #${m.i} talking to a man going below`);
      }
    });
  }
  assert.equal(checked, 3);
});

test('AUDIT WK-SN THE CALL AND WHO CRIES IT: a lookout chosen in the middle of a talk leaves it to cry the call, and his own words wait two lines after it; the alarm is cried by one of the watch on deck, never a man who was below (mutants LD-CL-call-over-talk, LD-CL-call-blurb-unheld, LD-CL-live-counts-sleepers)', () => {
  let cried = 0;
  for (let seed = 1; seed <= 40 && cried < 2; seed++) {
    const life = crewOf(seed);
    const next = life.members[2];   // her lookout once #1 goes ashore
    let t = 0;
    for (; t < 300 && !(next.mate && next.state === 'talk'); t += 0.05) life.step(0.05, {});
    if (t >= 300) continue;
    const mate = next.mate;
    life.away(new Set([1]));
    for (const m of life.members) m.line = null;
    life.step(0.05, { call: 'Sail ho! On the starboard beam!' });
    assert.equal(life.speech().find((s) => s.text === 'Sail ho! On the starboard beam!')?.member, next, `seed ${seed}: her new lookout cries it`);
    assert.equal(next.mate, null, 'his talk left'); assert.equal(mate.mate, null);
    cried++;
  }
  assert.equal(cried, 2);
  // his own word due just after the call: held two lines
  const life = crewOf(4);
  run(life, 40, { sings: false });
  const lk = atBow(life)[0];
  for (const m of life.members) m.line = null;
  lk.blurbT = CREW_LINE_S + 0.2;
  life.step(0.05, { sings: false, call: 'Sail ho! Dead ahead!' });
  const heard = [];
  run(life, CREW_LINE_S * 2 - 0.2, { sings: false }, () => { if (lk.line && lk.line.text !== 'Sail ho! Dead ahead!') heard.push(lk.line.text); });
  assert.deepEqual(heard, [], 'the call alone');
  // three hands, no station: her watch her lookout alone - the alarm is his to cry
  const three = createCrewLife({ deck: plainDeck(), roster: rosterOf(MOBILE.Warrior, MOBILE.Archer, MOBILE.Monk), seed: 3 });
  run(three, 40, {});
  run(three, 40, { asleep: true });
  assert.equal(three.belowCount(), 2);
  const onDeck = three.members.find((m) => !m.below);
  three.step(0.05, { asleep: true, battle: true });
  assert.equal(three.speech().find((s) => s.text === ALL_HANDS)?.member, onDeck, 'cried by her watch');
});

test('AUDIT WK-SN A MAN BELOW CLAIMS NO SPOT: the spots her watch walks to by night are hers whatever lies below them - a sleeper\'s last place on her deck is free to a man awake (mutant LD-CL-free-spot-sleepers)', () => {
  let stood = 0;
  for (const seed of [4, 5, 6]) {
    const life = crewOf(seed);
    life.step(0.05, { asleep: true });   // stood by night: each sleeper below where he stood
    const beds = life.members.filter((m) => m.below).map((m) => [...m.pos]);
    run(life, 600, { asleep: true }, (l) => { for (const m of l.members) if (!m.below && !m.station && m.path && beds.some((b) => flat(m.path.at(-1), b) < 1.2)) stood++; });
  }
  assert.ok(stood > 0, 'a man of the watch walked to a sleeper\'s place');
});

test('AUDIT WK-SN THE HOST KEEPS HER WORK: a sea ship\'s work rides her entry to her ship (world.js reads `ship.work` into her crew\'s step) - a number kept, anything else nought (mutant LD-NC-sea-work-dropped)', async () => {
  const crew = crewHost();
  const deck = plainDeck();
  const entry = (work) => ({ key: 's', boat: { GameObject: { position: [0, 0, 0], childCount: 0, getChild: () => null }, MeshObject: { worldMatrix: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) } }, deck, count: 8, rosterOf: () => crewRoster({ hull: 3, seed: 4, shipClass: pirate }), seed: 4, faction: 'pirate', work });
  const w = entry(0.7);
  crew.sync([w]);
  assert.equal(crew.ships()[0].work, 0.7);
  crew.sync([{ ...w, work: 'much' }]);
  assert.equal(crew.ships()[0].work, 0);
  crew.sync([{ ...w, work: 1 }]);
  await settle();
  let working = 0;
  for (let t = 0; t < 120; t += 0.1) { crew.frame(0.1, [0, 5, 0], (key, ship) => ({ work: ship.work })); working = Math.max(working, crew.ships()[0].life.members.filter((m) => m.state === 'work').length); }
  assert.ok(working >= 3, `her crew at her hurts: ${working}`);
});
