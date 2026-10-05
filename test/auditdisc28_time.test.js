// AUDIT DISC28 (2026-09-28, the pre-merge audit of the 2026-09-28 Discord batch, before the merge) - lane 3, TIME: the
// dead span (DISC28-E, worldTick.js skipDeadMinutes) and the absence (DISC28-F, alignEntityClocks -> normalizeAcross),
// read against PlayerEntity.Update and the port's online time model. Every finding was reproduced on the merged tree
// (2a8b70b2a) by driving the real modules, and each pin below FAILS there, except TM-5's, which pins a law the tree
// already kept and nothing held (two one-line mutants of skipDeadMinutes survived every revival suite):
//   TM-1 (Mac, 2026-09-28: "Recovery only") - an absence paid NormalizeReputations both ways, so a break wore every
//        positive standing down a point per 112 world days away and a guild member at their rank's line was demoted
//        on the next rank check. An absence now pays the recovery half only; the minutes spent DEAD are not an
//        absence and pay both halves, as any minute the world ran.
//   TM-2 - the host's encounter marker stood at the minute of death under the death screen, and a party mate's
//        Resurrect (and the Privateer's Hold rise, the Burning Court's cast-out) rolled every dead minute's
//        IntermittentEnemySpawn and 5%-a-minute Criminal Conspiracy on the first frame up. The rise raises DFU's
//        PreventEnemySpawns, which every host's loop reads and lowers.
//   TM-3 - the rise paid the span's normalise and dropped the rest of the Update's calendar: the day block (the room
//        swept, the loan checked) and the loop's other arms (the faction powers, the conditions, the racial override
//        quest rolls - the werewolf's and the vampire's cure). One body, runCalendarArms, walked by the tick and by
//        the rise, in the Update's order.
//   TM-4 - the body's own effect clocks stood at the minute of death: a disease billed every day the corpse lay on
//        the first round after the rise. They ride the span now, through the one walk an arrival uses.
//   TM-5 - the round broker's marker and the tick's reading move with the rise: a buff held across a death spends
//        one round on the first tick, not the span. [LIVED1: the tick's reading alone moves - the broker's marker is on
//        the character's clock, which stood under the screen; AUDIT LIVED1 T12 renamed its record to what it mutates.]
// LIVED1 (2026-09-29, Mac: "We need a better system for time online instead of a band aid fix") re-aims TM-1's dead
// span, TM-3 and TM-4: the character's own clock stands under the death screen, so nothing of theirs moves and none
// of their calendar walks the span - the cure and clan rolls, the landlord, the loans and the drift are theirs, and
// they did not live it. The world's half (the day's price flags and zones, the powers and conditions) walks it still.
// TM-1's absence arm, TM-2 and TM-5 stand as written.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tickPlayerMinutes, setSharedClock, worldMinutes, skyMinutes, ownMinutes, setOwnMinutes, alignEntityClocks, skipDeadMinutes, resetMagicRoundMarker, MINUTES_PER_DAY, REGION_CONDITIONS_INTERVAL_MINUTES } from '../src/systems/worldTick.js';
import { reviveForPlay } from '../src/systems/deathRespawn.js';
import { NORMALIZE_INTERVAL_MINUTES, REPUTATION_LOSS_PER_CRIME, CRIMES, legalRepOf, setCrimeCommitted } from '../src/systems/court.js';
import { GUILDS, joinGuild, updateRank } from '../src/systems/guilds.js';
import { createFactionRep, setReputation, getReputation } from '../src/systems/factionRep.js';
import { dateFromClassicMinutes } from '../src/systems/gameDate.js';
import { setRacialQuestHost, CURE_QUEST_INTERVAL_MINUTES, LYCANTHROPY_CURE_QUEST, VAMPIRE_INITIAL_QUEST } from '../src/systems/racialQuests.js';
import { createBankAccounts, borrowLoan, hasDefaulted } from '../src/systems/banking.js';
import { startDisease, DISEASES } from '../src/systems/diseases.js';
import { createInfection, INFECTION } from '../src/systems/infection.js';
import { passiveGuardSpawns } from '../src/systems/encounters.js';
import { RESURRECT_HEALTH_PCT, RESURRECT_TEXT } from '../src/systems/resurrect.js';

afterEach(() => { setSharedClock(null); setRacialQuestHost(null); });

const N = NORMALIZE_INTERVAL_MINUTES;
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const quiet = () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} });
/** A store with one faction per guild (guilds.test.js's shape): the real ChangeReputation walks it. */
const guildStore = (rep) => {
  const dict = new Map();
  for (const g of Object.values(GUILDS)) {
    dict.set(g.factionId, { id: g.factionId, parent: 0, rep: 0, flags: 0, power: 50,
      ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, type: 0, ggroup: 0 });
  }
  const store = createFactionRep(dict);
  for (const g of Object.values(GUILDS)) setReputation(store, g.factionId, rep);
  return store;
};

test('AUDIT DISC28 TM-1: an absence pays the recovery half only - a Fighters Guild 40 away 95 days keeps 40 and its rank; the dead span (LIVED1) walks none of the character\'s calendar', () => {
  // 95 real days at the shared clock's 12x cross ten 112-day boundaries (one every 9.3 real days): [last, last + 10N)
  // crosses exactly ten
  const g = GUILDS.FightersGuild;
  const last = 7 * N + 100, back = last + 10 * N;
  setSharedClock(() => back);
  const skills = {}; for (const s of g.skills) skills[s] = 100;
  const e = { name: 'Tester', skills, legalRep: [0, -15, 3], factionRep: guildStore(40), lastGameMinutes: last };
  const memberships = {};
  const m = joinGuild(memberships, g, dateFromClassicMinutes(last - 40 * MINUTES_PER_DAY));
  m.rank = 4;   // rank 4 asks a reputation of 40 (Guild.cs rankReqReputation)
  alignEntityClocks(e, back, { worldLeft: last });   // the arrival - save.js's load arm, from the world's minute the save left at (LIVED1)
  assert.equal(getReputation(e.factionRep, g.factionId), 40, 'a positive standing is not worn down by the time away');
  // REP4 (the reputation overhaul, "Earn it + faster drift"): PIN MOVED - the recovery half is WEEKLY now, so the ten
  // 112-day spans away are 160 weeks and the -15 is home (DFU's ten boundaries: -5); the good standing is kept as ever
  assert.deepEqual(e.legalRep, [0, 0, 3], 'a legal reputation below zero drifts back a point a week; one above it is kept');
  assert.equal(updateRank(memberships, g, e, e.factionRep, dateFromClassicMinutes(back)), null, 'and the next rank check moves nothing');
  // ...and a legal -15 away across ONE boundary goes to -14
  const once = { legalRep: [-15], factionRep: null, lastGameMinutes: N - 5 };
  setSharedClock(() => N + 5);
  alignEntityClocks(once, N + 5, { worldLeft: N - 5 });
  assert.deepEqual(once.legalRep, [-14]);
  // a correction of this machine's clock (no minute left at) is not an absence and pays nothing
  const corr = { legalRep: [-15], factionRep: null };
  alignEntityClocks(corr, N + 5);
  assert.deepEqual(corr.legalRep, [-15]);

  // LIVED1: THE DEAD SPAN IS NOT LIVED. The character's clock stood under the death screen, so the boundary the
  // world crossed is not theirs: their standing is untouched, both halves (the next lived boundary pays it, as DFU's)
  const corpse = { health: 0, maxHealth: 60, fatigue: 0, stats: { strength: 50, endurance: 50 }, legalRep: [0, -15, 3],
    factionRep: guildStore(40), activeEffects: [], items: [], skills: {}, lastGameMinutes: N - 5 };
  let clock = N - 5;
  setSharedClock(() => clock);
  setOwnMinutes(N - 5);
  alignEntityClocks(corpse, N - 5);   // the world's reading, at the minute of death
  clock = N + 5;
  reviveForPlay(corpse, { force: true });
  assert.deepEqual(corpse.legalRep, [0, -15, 3], 'the dead span walks no reputation of the character\'s');
  assert.equal(getReputation(corpse.factionRep, g.factionId), 40);
  assert.equal(ownMinutes(), N - 5, 'the character\'s clock stood through the death');
});

// ── TM-2: world.js's own runEncounterTick, resurrectInPlace and closeDeathScreen, out of the LIVE source ──────────────
/** The source of `function name(...) {...}` in `text` - the parameter list's parentheses matched first (a default
 *  `{ ... } = {}` or an arrow in it has braces of its own), then the body's braces, both past comments and strings
 *  (audit27h.test.js's literal reader, taken one step further). */
function fnText(text, name) {
  const i = text.indexOf(`function ${name}(`);
  assert.ok(i >= 0, `could not find function ${name}`);
  const skip = (k) => {   // the index of the last character of a comment or a string opening at k, else k
    const c = text[k];
    if (c === '/' && text[k + 1] === '/') return text.indexOf('\n', k);
    if (c === '/' && text[k + 1] === '*') return text.indexOf('*/', k) + 1;
    if (c === '\'' || c === '"' || c === '`') { for (k++; k < text.length; k++) { if (text[k] === '\\') k++; else if (text[k] === c) return k; } }
    return k;
  };
  const match = (from, o, c) => {
    let depth = 0;
    for (let k = from; k < text.length; k++) {
      const j = skip(k);
      if (j !== k) { k = j; continue; }
      if (text[k] === o) depth++;
      else if (text[k] === c && --depth === 0) return k;
    }
    throw new Error(`unbalanced ${o}${c} in function ${name}`);
  };
  const params = match(i + `function ${name}`.length, '(', ')');
  return text.slice(i, match(text.indexOf('{', params), '{', '}') + 1);
}

test('AUDIT DISC28 TM-2: a Resurrect replays no dead minute of the encounter loop - the rise raises PreventEnemySpawns, and every host\'s loop reads and lowers it', () => {
  const w = rd('src/scenes/world.js');
  const deps = ['playerTicker', 'playerEntity', 'amGroupRollOwner', 'online', 'player', 'partyNear', 'modes', 'walkMode', 'playerSpawned',
    'intermittentEnemySpawn', '_musicInLocationRect', 'maps', 'playerTravelPixel', 'SOLITARY_TYPES', 'partyExtraFoes', 'partySize',
    '_standEncounterFoe', '_questRegionIndex', 'passiveGuardSpawns', 'legalRepOf', 'setCrimeCommitted', 'CRIMES', '_witnessResponse',
    'cityGuards', '_guardPool', 'reviveForPlay', 'RESURRECT_HEALTH_PCT', 'RESURRECT_TEXT', 'townTalk', 'DeathScreen', 'sharedClockOn', 'worldMinutes', 'skyMinutes',   // LIVED1: the spawn roll's sky; TIME1: the sky's own clock
    'statedDeathLoss', 'stateDeathLoss', 'effectiveLevel',
    'revenantPresence', 'takeRevenantNotice', 'revenantToReturn', 'exteriorFoes', 'revenantSay', 'forgetLastSlew'];   // AUDIT FEUD: the Resurrect forgets this death's killer   // REVENANT: none here - the loop reads, and stands nobody   // SOFTCAP2: the mentor's level the loop's roll reads   // THE MERGE: DEATH-PENALTY's screen loss, withdrawn by a rescue (AUDIT 28 B5)
  const body = 'let _lastEncMinutes = null, _respawning = false, _rezSeen = null, _deadMark = null, _partyComposedAt = 0, _deathWasOnline = true;\n'
    + `${fnText(w, 'runEncounterTick')}\n${fnText(w, 'resurrectInPlace')}\n${fnText(w, 'closeDeathScreen')}\n`
    + 'return { runEncounterTick, resurrectInPlace, marker: () => _lastEncMinutes };';
  let clock = 400 * MINUTES_PER_DAY + 13 * 60;
  setSharedClock(() => clock);
  const e = { health: 80, maxHealth: 80, fatigue: 5000, stats: { strength: 50, endurance: 50 }, activeEffects: [], legalRep: [0, -15], level: 5, lastGameMinutes: clock };
  let guardCalls = 0;
  // eslint-disable-next-line no-new-func
  const host = new Function(...deps, body)({ get classicMinutes() { return worldMinutes(); }, get ownMinutes() { return ownMinutes(); } }, e, () => true, null,
    { feetAt: () => [0, 0, 0], isPlayerSwimming: false, stopAutorun() {} }, () => [], { mode: 'exterior', clearDeath() {} }, true, true,
    // REP1: PIN MOVED - the loop's minute no longer rolls DFU's conspiracy (the watch's stop replaced it), so the minute
    // this pin counts is the encounter roll's own ask - every minute the loop walks asks it once
    () => { guardCalls++; return null; }, () => true, { getClimateIndex: () => 0 }, () => ({ x: 0, y: 0 }), new Set(), () => 0, () => 1, () => {}, () => 1,
    (ctx) => passiveGuardSpawns(ctx, () => 0), legalRepOf, setCrimeCommitted, CRIMES, () => {},
    { makeNpcGuardsIntoEnemies: () => Promise.resolve() }, () => [], reviveForPlay, RESURRECT_HEALTH_PCT, RESURRECT_TEXT,
    { overlay: null, overlayActive: false, say() {}, closeOverlay() {} }, class { restoreView() {} }, () => true, worldMinutes, skyMinutes, () => null, () => {}, (x) => x?.level ?? 1,
    () => false, () => null, () => null, { foes: [] }, () => false, () => {});
  host.runEncounterTick([0, 0, 0]);   // a living frame: the marker at now
  e.health = 0; clock += 12;           // the death screen's 60 s at 12x - world.js's frame holds the loop under it
  host.resurrectInPlace({ name: 'Mate' });
  assert.equal(e.preventEnemySpawns, true, 'the rise raised the flag');
  host.runEncounterTick([0, 0, 0]);   // the first frame up
  assert.equal(guardCalls, 0, `the first frame after the rise rolled the dead span's minutes: ${guardCalls} roll(s)`);
  assert.equal(host.marker(), Math.floor(clock), 'the host\'s marker moved to now OUTSIDE the guard (PlayerEntity.Update\'s lastGameMinutes)');
  assert.equal(e.preventEnemySpawns, false, 'and the flag lowered at the tail, as the Update\'s own');
  clock += 3; host.runEncounterTick([0, 0, 0]);
  assert.equal(guardCalls, 3, 'the minutes lived after the rise roll as ever - the flag covers the span, not the life');

  // the rise's door raises it online only, and a living release keeps its minutes
  const living = { health: 30, maxHealth: 80, fatigue: 100, stats: { strength: 50, endurance: 50 }, lastGameMinutes: clock - 30 };
  reviveForPlay(living);
  assert.equal(living.preventEnemySpawns, undefined, 'a living release lived its minutes, and they roll');
  const offline = { health: 0, maxHealth: 80, fatigue: 0, stats: { strength: 50, endurance: 50 }, lastGameMinutes: 100 };
  setSharedClock(null);
  reviveForPlay(offline, { force: true });
  assert.equal(offline.preventEnemySpawns, undefined, 'offline a death is a load - nothing to prevent');
  // every host whose loop runs reads the flag as a span of nothing, moves its marker outside the guard and lowers it
  for (const [host2, text] of [['world.js', w], ['exterior.js', rd('src/scenes/exterior.js')]]) {
    const loop = fnText(text, 'runEncounterTick');
    assert.match(loop, /const span = playerEntity\.preventEnemySpawns \? 0 : Math\.min\(now - _lastEncMinutes, 1440\);/, `${host2} reads it`);
    assert.ok(loop.indexOf('_lastEncMinutes = now;') < loop.indexOf('if (playerEntity.preventEnemySpawns) playerEntity.preventEnemySpawns = false;'),
      `${host2} moves its marker and then lowers it`);
  }
});

test('AUDIT DISC28 TM-3 (LIVED1): the dead span walks the WORLD\'s calendar alone - the character\'s own (the cure and clan rolls, the landlord\'s sweep, the loan check, the normalise) did not live it, and none of it runs', () => {
  const started = [];
  setRacialQuestHost({ startQuest: (n) => started.push(n), findQuests: () => [], startQuestObject() {}, getVampireClanQuest: () => null });
  const corpse = (last, extra = {}) => ({ health: 0, maxHealth: 60, fatigue: 0, stats: { strength: 50, endurance: 50 }, legalRep: [0],
    factionRep: null, activeEffects: [], items: [], skills: {}, lastGameMinutes: last, ...extra });
  /** The death: the world's reading and the character's clock at `at`, then the world runs to `to` under the screen. */
  const dieAcross = (e, at, to) => { let clock = at; setSharedClock(() => clock); setOwnMinutes(at); alignEntityClocks(e, at); clock = to; return e; };
  // the werewolf's CURE roll on the 84-day minute the corpse lay across
  const C = 5 * CURE_QUEST_INTERVAL_MINUTES;
  skipDeadMinutes(dieAcross(corpse(C - 5, { racialOverride: { racial: 'lycanthropy', ended: false } }), C - 5, C + 5), C + 5, { rolls: () => 0 });
  assert.deepEqual(started, [], 'no cure roll: the 84-day minute is the character\'s, and they were dead');
  // the vampire's initiation on the 38-day minute
  const V = 7 * REGION_CONDITIONS_INTERVAL_MINUTES;
  skipDeadMinutes(dieAcross(corpse(V - 5, { racialOverride: { racial: 'vampirism', ended: false, hasStartedInitialVampireQuest: false } }), V - 5, V + 5), V + 5, { rolls: () => 0 });
  assert.deepEqual(started, [], 'no clan quest either');

  // the landlord, through the rise's own door: the room runs on the character's clock, which stood - it is still theirs
  const M = 700 * MINUTES_PER_DAY;
  const lodger = dieAcross(corpse(M - 20, { rentedRooms: [{ mapId: 1, buildingKey: 2, expiryMinutes: M - 10 }], sceneCache: null }), M - 20, M + 10);
  reviveForPlay(lodger, { force: true });
  assert.equal(lodger.rentedRooms.length, 1, 'not swept across the death: its last ten minutes are the character\'s to live');

  // the loan: overdue already on the character's clock, and still NOT settled by the death - the next lived midnight does it
  const debtor = dieAcross(corpse(N - 5, { bankAccounts: createBankAccounts(4), regionPrices: {} }), N - 5, N + 5);
  borrowLoan(debtor.bankAccounts, 0, 1000, { level: 10, nowMinutes: 0 });
  debtor.bankAccounts[0].loanDueDate = N - MINUTES_PER_DAY;
  debtor.bankAccounts[0].accountGold = 0;
  skipDeadMinutes(debtor, N + 5, { rolls: () => 0.5 });
  assert.equal(hasDefaulted(debtor.bankAccounts, 0), false, 'the loan check is the character\'s day block, and it did not run');
  assert.equal(legalRepOf(debtor, 0), 0, 'nor the normalise');

  // ONE LAW: the tick and the rise walk the same bodies, the rise the world's half of them
  const t = rd('src/systems/worldTick.js');
  const tick = fnText(t, 'tickPlayerMinutesOnce'), rise = fnText(t, 'skipDeadMinutes'), arrive = fnText(t, 'alignEntityClocks');   // AUDIT LIVED1 J: the tick's body (tickPlayerMinutes wraps it, counting the tick in flight)
  assert.match(tick, /runCalendarArms\(entity, lastMinutes, nowMinutes, \{ rolls \}\);/, 'the tick\'s loop is runCalendarArms (offline, whole)');
  assert.match(tick, /runCalendarArms\(entity, lastMinutes, nowMinutes, \{ rolls, arms: DAY_ARMS\.own \}\);\s*\n\s*for \(const \[s, e\] of worldPieces\) runCalendarArms\(entity, s, e, \{ rolls, arms: DAY_ARMS\.world \}\);/, 'online, the character\'s arms on their clock and the world\'s on the world\'s (over what no walk covered: AUDIT LIVED1 I, LIVED1b P3)');
  assert.ok(rise.indexOf('runDayChange(') >= 0 && rise.indexOf('runDayChange(') < rise.indexOf('runCalendarArms('), 'the rise walks the day block, then the arms');
  // AUDIT LIVED1b P3: over each piece of the span no walk this session covered
  assert.match(rise, /runDayChange\(\{ entity, lastMinutes: s, nowMinutes: e, rolls, say, arms: DAY_ARMS\.world \}\);/, '...the world\'s half of the day block');
  assert.match(rise, /runCalendarArms\(entity, s, e, \{ rolls, arms: DAY_ARMS\.world \}\);/, '...and of the arms');
  assert.equal(t.split('i % NORMALIZE_INTERVAL_MINUTES === 0').length - 1, 1, 'the normalise arm has one home');
  assert.equal(arrive.includes('runCalendarArms('), false, 'an absence walks no arm but the recovery half (recorded, not DFU\'s)');
});

test('AUDIT DISC28 TM-4 (LIVED1): the body\'s own effect clocks STAND through the dead span - the character\'s clock stood, so a disease bills no day the corpse lay and nothing has to be carried; their deadlines stand with it', () => {
  let clock = 300 * MINUTES_PER_DAY + 600;
  setSharedClock(() => clock);
  setOwnMinutes(clock);
  resetMagicRoundMarker(clock);
  const e = { isPlayer: true, level: 5, health: 80, maxHealth: 80, fatigue: 5000, activeEffects: [], items: [], skills: {}, lastGameMinutes: clock,
    stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 60, personality: 50, speed: 50, luck: 50 },
    bankAccounts: createBankAccounts(2) };
  alignEntityClocks(e, clock);
  const day0 = Math.floor(clock / MINUTES_PER_DAY);
  startDisease(e, DISEASES.Plague, day0, () => 0.5);
  const wolf = createInfection(INFECTION.Werewolf, { day: day0 });
  e.activeEffects.push(wolf);
  const curse = { kind: 'racialOverride', racial: 'lycanthropy', ended: false, lastKilledInnocent: clock - 100, lastCastMorphSelf: 0, lastUrgeNotify: clock - 50 };
  e.activeEffects.push(curse);
  borrowLoan(e.bankAccounts, 1, 1000, { level: 10, nowMinutes: clock });
  const due = e.bankAccounts[1].loanDueDate;
  const sinks = { ...quiet(), hurt: (n) => { e.health = Math.max(0, e.health - n); } };
  const own0 = ownMinutes();
  e.health = 0;
  const span = 3 * MINUTES_PER_DAY;   // a hidden tab: the screen's countdown runs on frames, the world on the wall
  clock += span;
  reviveForPlay(e, { force: true });
  const risen = e.health;
  assert.equal(ownMinutes(), own0, 'the character\'s clock stood through the three days');
  assert.equal(e.activeEffects.find((a) => a.kind === 'disease' && !a.infection).lastDay, day0, 'the disease\'s day stands - nothing to carry');
  assert.equal(wolf.startingDay, day0, 'so does the incubation');
  assert.deepEqual([curse.lastKilledInnocent, curse.lastCastMorphSelf, curse.lastUrgeNotify], [own0 - 100, 0, own0 - 50], 'and the curse\'s minutes');
  assert.equal(e.bankAccounts[1].loanDueDate, due, 'the loan is due when it was due, on the character\'s clock');
  clock += 1; tickPlayerMinutes({ entity: e, classicMinutes: clock, dt: 5, sinks, rolls: () => 0.5, realSeconds: 0.3 });
  assert.equal(e.health, risen, `the first tick after the rise billed the dead days: health ${risen} -> ${e.health}`);
  assert.equal(ownMinutes(), own0 + 1, 'and the first lived minute is one minute of the character\'s');

  // no walk exists to forget a marker in
  const t = rd('src/systems/worldTick.js');
  assert.equal(t.includes('carryOwnEffectClocks('), false, 'the arrival and the rise carry nothing - the clock that stood needs no carrying');
});

test('AUDIT DISC28 TM-5 (LIVED1): the tick\'s reading moves with the rise (the broker\'s marker, on the character\'s clock, never moved) - a 100-round effect across a 60-minute death spends one round', () => {
  let clock = 500000;
  setSharedClock(() => clock);
  resetMagicRoundMarker(clock);   // the broker is module state: anchored here as a session's start, whatever ran before
  const e = { health: 60, maxHealth: 60, fatigue: 4000, stats: { strength: 50, endurance: 50 }, items: [], skills: {}, lastGameMinutes: clock,
    activeEffects: [{ kind: 'waterBreathing', roundsRemaining: 100 }] };
  clock += 1; tickPlayerMinutes({ entity: e, classicMinutes: clock, dt: 5, sinks: quiet() });   // alive: one lived minute, one round
  const atDeath = e.activeEffects[0].roundsRemaining;
  assert.equal(atDeath, 99);
  e.health = 0; clock += 60;   // five real minutes on the death screen
  reviveForPlay(e, { force: true });
  clock += 1;
  const r = tickPlayerMinutes({ entity: e, classicMinutes: clock, dt: 5, sinks: quiet() });
  // EntityEffectManager.DoMagicRound runs no bundle of a perished entity - the effect keeps what it had
  assert.equal(r.rounds, 1, 'one round for the one lived minute, not sixty-one');
  assert.equal(e.activeEffects[0].roundsRemaining, atDeath - 1);
});
