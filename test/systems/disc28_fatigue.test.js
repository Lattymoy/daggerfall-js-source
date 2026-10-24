// DISC28-E (2026-09-28, Discord: "dying infinitely from fatigue" - the respawn at 0% fatigue, a second player's
// "it gives me a small portion and I collapse again") and DISC28-F (the repeated Criminal Conspiracy arrests whose
// legal reputation never came back).
//
// E: the online revival handed back a body the next tick killed. Two flaws. The fatigue was restored only when it was
// exactly zero, so a death with a sliver left stood up with the sliver. And the minutes spent on the death screen were
// charged to the revived body: the shared clock runs on under the screen with nothing ticking, the markers stood at the
// minute of death, and the first tick after the rise replayed the whole span of stamina drain and needs against the
// half pool just given. DFU charges a dead player nothing (PlayerEntity.cs:352-353 returns before the minute loop).
//
// F: DFU's reputation normalise fires on the exact multiples of 161280 minutes the per-minute loop walks. Online, the
// stamps that end an absence moved the marker to now without walking the span, so a boundary that fell while away was
// lost for good.
//
// Driven through the real tick (tickPlayerMinutes), the real revival door and the real arrival (alignEntityClocks).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { tickPlayerMinutes, setSharedClock, alignEntityClocks, normalizeAcross, skipDeadMinutes, ownMinutes, setOwnMinutes } from '../../src/systems/worldTick.js';
import { reviveForPlay, respawnHealth } from '../../src/systems/deathRespawn.js';
import { maxFatigue } from '../../src/systems/statMods.js';
import { SURVIVAL_RULES } from '../../src/systems/survival/difficulty.js';
import { newSurvival } from '../../src/systems/survival/needs.js';
import { exhaustionOutcome } from '../../src/systems/rest/rest.js';
import { NORMALIZE_INTERVAL_MINUTES, RECOVERY_INTERVAL_MINUTES } from '../../src/systems/court.js';

afterEach(() => setSharedClock(null));

/** A Hard-tier body in the red - exhausted, parched, starving - hunted until it dies of the drain, then the death
 *  screen stands `screenMinutes` of the shared clock and the online respawn's order runs: the revival BEFORE the first
 *  tick after the screen (world.js respawnOnlinePlayer). Answers the body after that first tick. */
function dieAndRise(screenMinutes) {
  let clock = 300000;
  setSharedClock(() => clock);
  const e = {
    stats: { strength: 40, intelligence: 50, willpower: 50, agility: 50, endurance: 40, personality: 50, speed: 50, luck: 50 },
    health: 40, maxHealth: 60, magicka: 50, maxMagicka: 50, fatigue: 30, activeEffects: [], items: [], skills: {},
    lastGameMinutes: clock, survival: newSurvival(clock),
  };
  Object.assign(e.survival, { sleepDebt: 13, thirst: 110, lastAte: clock - 2000, lastMinute: clock });
  const events = [];
  const sinks = {
    hurt: (n) => { e.health = Math.max(0, e.health - n); }, heal() {}, drainMagicka() {}, restoreMagicka() {}, say() {},
    drainFatigue: (n) => {
      if (n <= 0) return;
      e.fatigue = Math.max(0, e.fatigue - n);
      if (e.fatigue <= 0 && e.health > 0) {
        // PIN MOVED (FIELD BUGS 2026-10-13e SPENT-ASHORE): foes about, a collapse is no longer a death but a tenth of the
        // health a drain (the hosts' arm, through the damage door) - the hunted body still dies of the drain, ten minutes on
        const o = exhaustionOutcome({ enemiesNearby: true, entity: e });
        events.push(o.kind);
        if (o.kind === 'spent') e.health = Math.max(0, e.health - o.damage); else e.fatigue = Math.min(maxFatigue(e), e.fatigue + o.fatigue);
      }
    },
    restoreFatigue: (n) => { if (n > 0) e.fatigue = Math.min(maxFatigue(e), e.fatigue + n); },
  };
  const feed = { env: {}, deps: { rules: SURVIVAL_RULES.hard, worn: null, ctx: {} } };
  while (e.health > 0) { clock += 1; tickPlayerMinutes({ entity: e, classicMinutes: clock, dt: 5, sinks, survival: feed }); }
  clock += screenMinutes;   // the death screen: the host holds its frame, the world's clock runs
  const r = reviveForPlay(e, { force: true });
  const revived = e.fatigue;
  clock += 1;
  tickPlayerMinutes({ entity: e, classicMinutes: clock, dt: 5, sinks, survival: feed });
  return { e, revived, r, events };
}

for (const screen of [12, 60, 90]) {
  test(`DISC28-E: ${screen} game minutes (${screen / 12} real) on the death screen - the revived body survives its first tick`, () => {
    const { e, revived, r } = dieAndRise(screen);
    assert.equal(r.skipped, true, 'the span the corpse lay was skipped, not charged');
    assert.ok(e.health > 0, `alive after the first tick (health ${e.health})`);
    assert.ok(revived >= respawnHealth(maxFatigue(e)), 'stood up on at least the floor');
    assert.ok(e.fatigue > maxFatigue(e) * 0.45, `and the first tick charged one minute, not the span (${e.fatigue}/${maxFatigue(e)})`);
  });
}

test('DISC28-E: the respawn stands a sliver up at the floor - the zero test handed it back as it lay', () => {
  const sliver = { health: 0, maxHealth: 80, fatigue: 150, stats: { strength: 50, endurance: 60 } };
  reviveForPlay(sliver, { force: true });
  assert.equal(sliver.fatigue, respawnHealth(maxFatigue(sliver)));
  const living = { health: 30, maxHealth: 80, fatigue: 150, stats: { strength: 50, endurance: 60 } };
  const r = reviveForPlay(living);
  assert.equal(living.fatigue, 150, 'a living release is not a rest');
  assert.equal(r.skipped, false, 'and it skips nobody\'s minutes');
});

test('DISC28-E: offline there is no dead span to skip - the revival moves no clock', () => {
  const e = { health: 0, maxHealth: 80, fatigue: 0, stats: { strength: 50, endurance: 60 }, lastGameMinutes: 1000 };
  const r = reviveForPlay(e, { force: true });
  assert.equal(r.skipped, false);
  assert.equal(e.lastGameMinutes, 1000);
});

test('DISC28-E (LIVED1): the skip moves nothing of the player\'s - their own clock stood under the death screen, so the markers, the needs\' clocks and a room stand where they were; only the world\'s reading moves', () => {
  let clock = 4000;
  setSharedClock(() => clock);
  setOwnMinutes(4000);
  const e = { lastGameMinutes: 4000, survival: { lastMinute: 4000, lastAte: 3900, awakeSince: 3000 }, rentedRooms: [{ expiryMinutes: 4600 }] };
  alignEntityClocks(e, 4000);   // the world's reading at the minute of death
  clock = 5000;
  assert.equal(skipDeadMinutes(e, 5000), true);
  assert.deepEqual([e.lastGameMinutes, e.survival.lastMinute, e.survival.lastAte, e.survival.awakeSince, e.rentedRooms[0].expiryMinutes],
    [4000, 4000, 3900, 3000, 4600], 'hunger did not age in a corpse, and the room kept its ten hours - nothing was carried, nothing had to be');
  assert.equal(ownMinutes(), 4000, 'the character\'s clock stands where they fell');
  assert.equal(e.preventEnemySpawns, true, 'TM-2: the span is shielded from the encounter loop');
});

const N = NORMALIZE_INTERVAL_MINUTES;
// REP4 (the reputation overhaul, "Earn it + faster drift"): PIN MOVED - an absence pays the recovery half on the WEEKLY
// boundaries now (court.js RECOVERY_INTERVAL_MINUTES), so these pins count weeks where they counted DFU's 112 days; the
// laws they hold - every boundary paid once, [last, now), the prison skip's shield - are the same
const W = RECOVERY_INTERVAL_MINUTES;
const convict = (last) => ({ lastGameMinutes: last, legalRep: [0, -15, 3], factionRep: null });

test('DISC28-F: an arrival across three normalise boundaries pays all three - the reputation walks back toward zero', () => {
  setSharedClock(() => 3 * W + 10);
  const e = convict(W - 5);
  alignEntityClocks(e, 3 * W + 10, { worldLeft: W - 5 });   // crosses W, 2W and 3W - from the world's minute the save left at (LIVED1)
  // AUDIT DISC28 TM-1 (Mac, 2026-09-28: "Recovery only"): an absence pays the recovery half - the -15 walks back three,
  // the +3 standing is kept (it went to 0 before the decision)
  assert.deepEqual(e.legalRep.slice(0, 3), [0, -12, 3], 'three boundaries, three points of recovery, no standing lost');
});

test('DISC28-F: an arrival inside one interval pays nothing; the boundary minute is [last, now) - DFU\'s own convention', () => {
  const e = convict(W + 1);
  alignEntityClocks(e, 2 * W, { worldLeft: W + 1 });   // 2W itself is not in [W+1, 2W)
  assert.deepEqual(e.legalRep.slice(0, 3), [0, -15, 3]);
  assert.equal(normalizeAcross(convict(W), W, W + 1), 1, 'W itself is in [W, W+1)');
  assert.equal(normalizeAcross(convict(0), 5, 5), 0);
});

test('DISC28-F: the prison skip\'s one-jump shield holds over a catch-up too', () => {
  const e = { ...convict(N - 5), preventNormalizingReputations: true };
  assert.equal(normalizeAcross(e, N - 5, N + 5), 0);
  assert.deepEqual(e.legalRep.slice(0, 3), [0, -15, 3]);
});

test('DISC28-F (LIVED1): a death that lay across a boundary pays nothing of the character\'s - their clock stood, and the boundary is paid when they live it', () => {
  let clock = N - 10;
  setSharedClock(() => clock);
  setOwnMinutes(N - 10);
  const e = { ...convict(N - 10), health: 0, maxHealth: 80, fatigue: 0, stats: { strength: 50, endurance: 60 } };
  alignEntityClocks(e, N - 10);
  clock = N + 10;
  reviveForPlay(e, { force: true });
  assert.equal(e.legalRep[1], -15, 'not under the death screen');
  assert.equal(normalizeAcross(e, ownMinutes(), ownMinutes() + 20), 1, 'the character\'s own boundary is still ahead of them, twenty lived minutes on');
});
