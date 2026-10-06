// WATCH-KNOWS (2026-10-06, Mac: "improve the guards" - asked, "The watch knows you": guards greet or warn you by your
// legal standing, and a first minor offence draws a "Hold!" warning before an arrest; bible/06-Systems/Living-World.md
// WATCH-KNOWS): THE LIVING WORLD'S WATCH KNOWS YOU. Before it a watchman on duty greeted the player with the street's
// stranger lines whatever the law thought of them (no greeting read a legal standing: the REP1 stop was the only time
// the watch spoke by it, and only to a known criminal), and the watch came for a pocket picked as for a murder - the
// arrest box at its first blow. Pinned on the synthetic town (test/lwTown.mjs) and the arrest flow's own rig.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { LIVING_GREETINGS, WATCH_GREETINGS, watchBand, fillLine } from '../src/systems/livingWorld/lines.js';
import { CLASSIC_MINUTES_PER_SECOND, ownMinutes } from '../src/systems/worldTick.js';
import { createArrestFlow } from '../src/scenes/arrestFlow.js';
import { CRIMES, REPUTATION_LOSS_PER_CRIME, legalRepOf } from '../src/systems/court.js';
import { LYCANTHROPY_TYPES } from '../src/systems/infection.js';
import { WARNABLE_CRIMES, warningDue, noteWarning, standingOf, snapshotStanding, restoreStanding, knownCriminal, banish } from '../src/systems/standing.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });

function makeTown({ legal = undefined, relations = createRelations() } = {}) {
  const fx = synthTown();
  const asked = [];
  const town = new LivingTown(fx.nav, {
    town: TOWN, buildings: fx.buildings, doors: fx.doors,
    makePerson: (archive, guard) => new ResidentWalker(fx.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => 100 * DAY_MIN + 12 * 60, rate: () => RATE, mpm: MPM, relations: () => relations, playerName: () => 'Mac', townName: 'Synth', regionName: 'Daggerfall',
    ...(legal === undefined ? {} : { legalStanding: (region) => { asked.push(region); return legal(); } }),
  });
  return { town, relations, asked };
}
/** A watchman of the town on duty at a minute of day 100, and one off duty, each with that minute. */
function watchmen(town) {
  let on = null, off = null;
  for (const res of town.peopleOf(100).filter((r) => r.guard)) {
    for (let m = 6 * 60; m < 22 * 60 && (!on || !off); m += 17) {
      const t = 100 * DAY_MIN + m, e = town.entryOf(res, t)?.e;
      if (!e) continue;
      if (e.duty && !on) on = { res, t };
      if (!e.duty && e.kind !== 'sleep' && !off) off = { res, t };
    }
  }
  return { on, off };
}
const said = (pool) => pool.map((l) => fillLine(l, { player: 'Mac', town: 'Synth' }));

test('WATCH-KNOWS the watch\'s word by the law: one of the watch on duty greets the player by their standing with the town\'s region (watchBand: above 40 honoured, above 10 respected, 0 to 10 a common citizen, below 0 watched, a known criminal - under -10 or banished - known), the honoured by name; to a common citizen now and then, as a stranger speaks, else always; off duty, or with a grudge of his own, the street\'s own word; no law read, none of it (mutants: the bands, the known, the duty, the grudge, the seldom, the region, the town\'s name)', () => {
  assert.deepEqual([[50, false], [41, false], [40, false], [11, false], [10, false], [0, false], [-1, false], [-10, false], [60, true], [-11, true]].map(([r, k]) => watchBand(r, k)),
    ['honoured', 'honoured', 'respected', 'respected', 'citizen', 'citizen', 'watched', 'watched', 'known', 'known']);
  let st = { rep: 0, known: false };
  const { town, relations, asked } = makeTown({ legal: () => st });
  const { on, off } = watchmen(town);
  assert.ok(on && off, 'a watchman on duty and one off it');
  for (const [rep, known, band] of [[55, false, 'honoured'], [20, false, 'respected'], [3, false, 'citizen'], [-4, false, 'watched'], [-30, true, 'known'], [12, true, 'known']]) {
    st = { rep, known };
    const word = town.greetingFor(on.res, on.t, true);
    assert.ok(said(WATCH_GREETINGS[band]).includes(word), `${rep}${known ? ' known' : ''}: "${word}" the ${band}'s`);
  }
  assert.ok(asked.length > 0 && asked.every((r) => r === TOWN.region), 'the town\'s own region asked');
  // the honoured by name, the watched by the town
  assert.ok(WATCH_GREETINGS.honoured.every((l) => l.includes('{player}')), 'the honoured by name');
  assert.ok(said(WATCH_GREETINGS.watched).includes('Mind your step in Synth.'));
  // now and then to a common citizen passing (as a stranger speaks), always to the rest
  const passing = (rep) => { st = { rep, known: false }; let n = 0; for (let k = 0; k < 40; k++) if (town.greetingFor(on.res, on.t + k * 3, false) != null) n++; return n; };
  const seldom = passing(3);
  assert.ok(seldom > 0 && seldom < 30, `a common citizen now and then (${seldom} of 40)`);
  assert.deepEqual([55, 20, -4].map(passing), [40, 40, 40], 'the honoured, the respected and the watched always');
  // off duty: the street's own word
  st = { rep: -30, known: true };
  assert.ok([...LIVING_GREETINGS.stranger, ...LIVING_GREETINGS.known].map((l) => fillLine(l, { player: 'Mac' })).includes(town.greetingFor(off.res, off.t, true)), 'off duty, a townsman');
  // a grudge of his own stays cold, whatever the law thinks
  st = { rep: 80, known: false };
  relations.note(on.res.id, 'slain', 100);
  assert.ok(said(LIVING_GREETINGS.enemy).includes(town.greetingFor(on.res, on.t, true)), 'his own grudge');
  // no law read (the host hands none): the street's word, on duty or not
  const plain = makeTown();
  const p = watchmen(plain.town);
  assert.ok([...LIVING_GREETINGS.stranger, ...LIVING_GREETINGS.known].map((l) => fillLine(l, { player: 'Mac' })).includes(plain.town.greetingFor(p.on.res, p.on.t, true)));
});

// The arrest flow's rig (test/jailhit.test.js's shape): a talk that keeps the overlay it was handed.
function mkTalk() {
  const slot = { win: null };
  return { slot, texts: () => null, showOverlay(win) { if (slot.win && slot.win !== win) slot.win.dispose?.(); slot.win = win; }, close() { slot.win = null; } };
}
const mkPlayer = (over = {}) => ({
  name: 'Mac', health: 40, maxHealth: 40, fatigue: 0, maxFatigue: 100, magicka: 0, maxMagicka: 20,
  stats: { endurance: 50, strength: 50, willpower: 50, personality: 50 },
  crimeCommitted: CRIMES.Pickpocketing, legalRep: { 17: 5, 18: 5 }, items: [], skills: 30,
  haveShownSurrenderDialogue: false, arrested: false, activeEffects: [], ...over,
});
const mkFlow = (townTalk, player, region = 17, warns = true) => createArrestFlow({
  townTalk, playerEntity: player, regionIndex: () => region, rolls: () => 0.99,
  advanceDays: () => {}, advanceMinutes: () => {}, guildRankOf: () => null,
  clearEnemies: () => {}, positionPlayerAtLocationEntrance: () => {},
  warnsFirst: () => warns, regionName: (r) => ({ 17: 'Daggerfall', 18: 'Wayrest' })[r] ?? 'this region',
});
/** The watch's first blow: whether it was withheld, whether it landed, and the box it put up. */
function blow(flow, townTalk) {
  let landed = 0;
  townTalk.slot.win = null;
  const held = flow.onGuardHit(5, () => { landed++; });
  return { held, landed, win: townTalk.slot.win };
}

test('WATCH-KNOWS the first minor offence is warned: the living world\'s watch, come for a door tried, a trespass, a night in the street or a pocket picked (WARNABLE_CRIMES) that the character was never warned for in this region, halts them with a word - "Hold!" and the crime by name - instead of the arrest box: the blow withheld, the crime charged as the box would, the warning noted, the crime let go; the next minor offence there, a worse crime, a known criminal, a beast, DFU\'s watch - the box (mutants: the minor, the first, the known, the charge, the note, the let go, the words, the lane)', () => {
  assert.deepEqual([...WARNABLE_CRIMES], [CRIMES.Attempted_Breaking_And_Entering, CRIMES.Trespassing, CRIMES.Vagrancy, CRIMES.Pickpocketing]);
  const townTalk = mkTalk();
  const player = mkPlayer();
  const flow = mkFlow(townTalk, player);
  const first = blow(flow, townTalk);
  assert.equal(first.held, true, 'the blow withheld');
  assert.equal(first.landed, 0);
  assert.equal(first.win.options.length, 0, 'a word, not a question');
  assert.deepEqual(first.win.lines, ['Hold! Pickpocketing is against the law of Daggerfall.', 'This once, you have a warning. The next time, it is the court.']);
  assert.equal(player.crimeCommitted, 0, 'the crime let go - the watch walks off with it');
  assert.equal(legalRepOf(player, 17), 5 - REPUTATION_LOSS_PER_CRIME[CRIMES.Pickpocketing], 'charged as the box would');
  assert.ok(Number.isFinite(standingOf(player).warned[17]), 'the warning noted');
  assert.equal(player.haveShownSurrenderDialogue, false);
  // the next minor offence in the region: the box
  player.crimeCommitted = CRIMES.Pickpocketing;
  const second = blow(flow, townTalk);
  assert.equal(second.held, true);
  assert.equal(second.win.options.length, 2, 'the arrest box - Y or N');
  // another region's first: warned there too - a night in the street, the crime as the rest box writes it (a string)
  const other = mkPlayer({ crimeCommitted: 'Vagrancy' });
  const t2 = mkTalk();
  const w2 = blow(mkFlow(t2, other, 18), t2);
  assert.deepEqual(w2.win.lines[0], 'Hold! Vagrancy is against the law of Wayrest.');
  assert.equal(other.crimeCommitted, 0);
  // each of the four, warned; nothing else
  for (const crime of Object.values(CRIMES).filter((c) => typeof c === 'number' && c > 0)) {
    const t = mkTalk(), pl = mkPlayer({ crimeCommitted: crime });
    const b = blow(mkFlow(t, pl), t);
    assert.equal(b.win.options.length === 0, WARNABLE_CRIMES.includes(crime), `crime ${crime}`);
  }
  // a known criminal (under -10), or a banished one (REP3's term running): the box - the watch knows their face
  const banished = mkPlayer({ legalRep: { 17: 30 }, regionConditions: { 17: {} } });
  assert.equal(banish(banished, 17, ownMinutes()), true);   // on the clock the flow reads (its term: 30 days of it)
  for (const pl of [mkPlayer({ legalRep: { 17: -11 } }), banished]) {
    assert.equal(knownCriminal(pl, 17, { ownNow: ownMinutes(), worldNow: ownMinutes() }), true);
    const t = mkTalk();
    assert.equal(blow(mkFlow(t, pl), t).win.options.length, 2, 'a known criminal: the box');
  }
  assert.equal(warningDue(mkPlayer({ legalRep: { 17: -10 } }), 17, CRIMES.Pickpocketing), true, 'at -10, not yet known');
  // a beast is halted as a beast (WERE-FRIGHT's box), and a chase the box already asked in is the box's: never warned
  const beast = mkPlayer({ activeEffects: [{ kind: 'racialOverride', racial: 'lycanthropy', infectionType: LYCANTHROPY_TYPES.Werewolf, isTransformed: true }] });
  const tb = mkTalk(), wb = blow(mkFlow(tb, beast), tb);
  assert.ok(wb.win && !String(wb.win.lines?.[0] ?? '').startsWith('Hold!') && standingOf(beast).warned[17] === undefined, 'the beast\'s own box');
  const asked = mkPlayer({ haveShownSurrenderDialogue: true });
  const ta = mkTalk(), wa = blow(mkFlow(ta, asked), ta);
  assert.deepEqual([wa.held, asked.crimeCommitted, standingOf(asked).warned[17]], [false, CRIMES.Pickpocketing, undefined], 'asked already: the blow lands');
  // DFU's watch (the classic lane): the box, warned or not
  const t3 = mkTalk();
  assert.equal(blow(mkFlow(t3, mkPlayer(), 17, false), t3).win.options.length, 2, 'DFU\'s watch: the box');
  // the note survives a save; a save from before it was never warned
  const saved = mkPlayer();
  noteWarning(saved, 17, 1234);
  const back = mkPlayer();
  restoreStanding(back, JSON.parse(JSON.stringify(snapshotStanding(saved))));
  assert.equal(standingOf(back).warned[17], 1234);
  restoreStanding(back, { challengeAt: {}, graceUntil: {}, penance: {}, pardons: {} });
  assert.deepEqual(standingOf(back).warned, {});
});

test('WATCH-KNOWS the hosts: the world host hands the living town the player\'s standing with a region\'s law (its number, and whether its watch knows them) and the arrest flow its lane (livingWorldOn), the region\'s name and the world\'s calendar; the fixed-city host hands none - DFU\'s watch (mutants: the host\'s law, the lane)', () => {
  const world = rd('src/scenes/world.js');
  assert.match(world, /legalStanding: \(region\) => \(\{ rep: legalRepOf\(playerEntity, region\), known: knownCriminal\(playerEntity, region, \{ ownNow: ownMinutes\(\), worldNow: trustedWorldMinutes\(\) \}\) \}\),/);
  assert.match(world, /warnsFirst: \(\) => livingWorldOn\(\), regionName: \(r\) => REGION_NAMES\[r\] \?\? 'this region', worldNow: \(\) => trustedWorldMinutes\(\),/);
  const exterior = rd('src/scenes/exterior.js');
  const flow = exterior.slice(exterior.indexOf('createArrestFlow({'), exterior.indexOf('});', exterior.indexOf('createArrestFlow({')));
  assert.doesNotMatch(flow, /warnsFirst/, 'the fixed-city page: DFU\'s watch');
});
