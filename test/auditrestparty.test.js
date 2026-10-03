// AUDIT REST-PARTY (2026-10-03, bible/06-Systems/Rest-Arc.md "AUDIT REST-PARTY"; the party rest adapted to REST5's
// night). REST5 shipped the party's night as a closure in world.js pinned by regexes alone, and three of its laws were
// wrong in ways no regex fails: it carried members in a tavern, temple or guild hall (TAVERN-REST1/GUILD-REST1 took the
// party's rest out of all three), it slept a member standing 4-15 m from the rester's fire on the bare ground (rough:
// "You slept poorly" in Casual, half the night's healing and stiff in Hard - PARTY-REST4's per-request "party member
// MUST heal their health near the leader"), and it told a dead member they slept. The decision is
// systems/partyRestLaw.js's now and RUN here on a table; the stamp says where the night was slept (restAct.js); the
// carried night is slept at the better of the rester's spot and mine - driven through a real createRestDeps bag in
// each tier, the sequence world.js's sleepCarriedNight runs.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nightMoved, carriedNightAction, carriedRestKind, PARTY_NIGHT_FRESH_MS, stampOf, STAMP_SLACK_MS } from '../src/systems/partyRestLaw.js';
import { nightStamp, nightKindOf, isNightStamp, setNightListener, REST_ACT_TEXT, PARTY_NIGHT_MARKS, runRestNight, ambushNight } from '../src/systems/restAct.js';
import { REST_TEXT, MINUTES_PER_TICK } from '../src/systems/restSession.js';
import { createRestDeps } from '../src/scenes/shared.js';
import { setSharedClock, setOwnMinutes, advanceOwnMinutes } from '../src/systems/worldTick.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { SURVIVAL_STORED } from '../src/systems/survival/difficulty.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
afterEach(() => { setSharedClock(null); _resetForTests(); });

test('AUDIT REST-PARTY the stamp says where: one mark a rest kind, read back exactly; a kind the table does not know is a fire\'s; an older build\'s open is no night; a stamp is never further ahead of the clock than the wire\'s slack allows', () => {
  for (const kind of ['rough', 'camp', 'bed']) {
    const at = nightStamp(7_000_123, kind);
    assert.equal(nightKindOf(at), kind, kind);
    assert.equal(isNightStamp(at), true);
    assert.equal(Math.floor(at / 1000), 7_000, 'the same second');
  }
  assert.equal(new Set(Object.values(PARTY_NIGHT_MARKS)).size, 3, 'three distinct marks');
  assert.equal(nightKindOf(nightStamp(7_000_123, 'toString')), 'camp', 'a name on the prototype is no kind');
  assert.equal(nightKindOf(nightStamp(7_000_123, null)), 'camp');
  assert.equal(nightKindOf(7_000_123), null, 'an older build stamps the open\'s own millisecond');
  assert.equal(nightKindOf(Number.NaN), null);
  for (const now of [7_000_000, 7_000_500, 7_000_999]) {
    const at = nightStamp(now, 'bed');
    assert.ok(at - now < STAMP_SLACK_MS && stampOf(at, now) === at, 'the reader takes it at once');
  }
});

test('AUDIT REST-PARTY nightMoved: the first sight is a baseline, an unmoved stamp nothing, a moved one a night only while fresh and only when it is a night\'s', () => {
  const now = 9_000_000;
  const at = now - 1_000;
  assert.equal(nightMoved(undefined, at, now, true), false, 'first sight');
  assert.equal(nightMoved(at, at, now, true), false, 'unmoved');
  assert.equal(nightMoved(at - 600_000, at, now, true), true, 'moved, fresh, a night');
  assert.equal(nightMoved(0, 0, now, true), false, 'no stamp');
  assert.equal(nightMoved(1, now - PARTY_NIGHT_FRESH_MS, now, true), true, 'at the edge');
  assert.equal(nightMoved(1, now - PARTY_NIGHT_FRESH_MS - 1, now, true), false, 'a night long over');
  assert.equal(nightMoved(1, at, now, false), false, 'AUDIT REST F7: an older build\'s open');
});

test('AUDIT REST-PARTY carriedNightAction: a tavern, temple or guild hall carries nobody; my switch off, theirs off or my death - nothing; near - carried unless busy (asked only then); here but beyond reach - told; elsewhere - nothing', () => {
  const base = { withParty: true, resterAlone: false, exempt: false, dead: false, near: true, here: true, busy: false };
  assert.equal(carriedNightAction(base), 'carry');
  assert.equal(carriedNightAction({ ...base, exempt: true }), null, 'TAVERN-REST1/GUILD-REST1');
  assert.equal(carriedNightAction({ ...base, withParty: false }), null, 'REST-OPT: my rest is my own');
  assert.equal(carriedNightAction({ ...base, resterAlone: true }), null, 'their night is their own');
  assert.equal(carriedNightAction({ ...base, dead: true }), null, 'the dead do not sleep');
  assert.equal(carriedNightAction({ ...base, busy: true }), 'busy');
  assert.equal(carriedNightAction({ ...base, near: false }), 'far', 'PARTY-REST-FAR1, online');
  assert.equal(carriedNightAction({ ...base, near: false, here: false }), null, 'across the map: nothing to come near to');
  assert.equal(carriedNightAction({ ...base, near: false, exempt: true }), null, 'nor in a tavern');
  let asked = 0;
  const busy = () => { asked++; return false; };
  assert.equal(carriedNightAction({ ...base, near: false, busy }), 'far');
  assert.equal(carriedNightAction({ ...base, exempt: true, busy }), null);
  assert.equal(asked, 0, 'the rest gate is asked only of a member who would be carried');
  assert.equal(carriedNightAction({ ...base, busy }), 'carry');
  assert.equal(asked, 1);
});

test('AUDIT REST-PARTY carriedRestKind: the better of my spot and the rester\'s - by their fire, not on the ground beside it; at my own fire beside their Bedroll, by mine; an unknown side yields', () => {
  assert.equal(carriedRestKind('rough', 'camp'), 'camp');
  assert.equal(carriedRestKind('rough', 'bed'), 'bed');
  assert.equal(carriedRestKind('camp', 'rough'), 'camp');
  assert.equal(carriedRestKind('bed', 'camp'), 'bed');
  assert.equal(carriedRestKind('rough', 'rough'), 'rough');
  assert.equal(carriedRestKind(null, 'camp'), 'camp');
  assert.equal(carriedRestKind('rough', null), 'rough');
  assert.equal(carriedRestKind('toString', 'constructor'), null, 'names on the prototype are no kinds');
  assert.equal(carriedRestKind(undefined, undefined), null);
});

const sleeper = () => ({ health: 5, maxHealth: 60, fatigue: 0, magicka: 0, maxMagicka: 30, stats: { endurance: 50, strength: 50, willpower: 50, agility: 50 }, skills: [], career: {}, activeEffects: [] });
/** world.js sleepCarriedNight's own sequence over a real bag: the kind read, the override, the open, the night. */
const carry = (tier, own, theirs) => {
  setPref('survival', SURVIVAL_STORED[tier]);
  setSharedClock(() => 5_000_000);
  setOwnMinutes(400_000);
  const e = sleeper();
  const said = [];
  const bag = createRestDeps(e, { restKind: () => own, restPoint: () => null, advanceMinutes: (n) => advanceOwnMinutes(n), endLines: () => null, say: (t) => said.push(t) });
  const kind = carriedRestKind(bag.placeKind(), theirs);
  if (kind) bag.overrideRestKind(() => kind);
  bag.setResting(true);
  try { bag.restNight({ carried: true }); } finally { bag.setResting(false); }
  return { e, said };
};

test('AUDIT REST-PARTY the carried night, slept: a member 5 m from the rester\'s fire wakes as the rester does in every tier - before, Casual said "slept poorly" and Hard left 17 of 60 and stiff', () => {
  for (const tier of ['off', 'casual', 'hard']) {
    const { e, said } = carry(tier, 'rough', 'camp');
    assert.equal(e.health, 60, `${tier}: healed whole by the fire`);
    assert.deepEqual(said, [], `${tier}: no poor night, no stiff morning`);
  }
  // and the rester's own Bedroll is still a rough night for the party where the tier prices it so
  const { e, said } = carry('hard', 'rough', 'rough');
  assert.ok(e.health < 60, 'a Bedroll night in Hard is the Bedroll\'s');
  assert.equal(said.length, 1, 'and its stiff morning');
});

test('AUDIT REST-PARTY the night is heard with its spot, read before the night spends the fire\'s fuel; a carried night is not heard; placeKind is where I stand', () => {
  setSharedClock(() => 5_000_000);
  setOwnMinutes(400_000);
  const heard = [];
  const prev = setNightListener((kind) => heard.push(kind));
  try {
    let lit = true;
    const bag = createRestDeps(sleeper(), { restKind: () => (lit ? 'camp' : 'rough'), restPoint: () => null, advanceMinutes: (n) => advanceOwnMinutes(n), endLines: () => null, onNightSlept: () => { lit = false; } });
    assert.equal(bag.placeKind(), 'camp');
    bag.setResting(true); bag.restNight(); bag.setResting(false);
    assert.deepEqual(heard, ['camp'], 'the last of the fuel burned through the night it was slept by');
    assert.equal(bag.placeKind(), 'rough');
    bag.setResting(true); bag.restNight({ carried: true }); bag.setResting(false);
    assert.deepEqual(heard, ['camp'], 'not passed on');
  } finally { setNightListener(prev); }
});

test('AUDIT REST-PARTY the words: a night out of reach says whose and how far', () => {
  assert.equal(REST_ACT_TEXT.carriedFar('Ada'), 'Ada rested a night without you - come within 15 m of them to rest with the party.');
});

test('AUDIT REST-PARTY by source: the follow tick hands the law its readings, sleeps at the carried kind, says the far word, and the vote\'s tally is shut online', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /here: present && samePlace\(myPartyLocation\(\), \{ px: m\.p\.px, py: m\.p\.py, in: m\.p\.in, bk: m\.p\.bk \}\),/, 'the same place, for the far word');
  assert.match(w, /const dead = playerEntity\.health <= 0 \|\| !!modes\?\.deathUp\?\.\(\);/, 'dead, or the death screen up');
  assert.match(w, /if \(act === 'far'\) setMidScreenText\(REST_ACT_TEXT\.carriedFar\(name\), 4\);/);
  assert.match(w, /else sleepCarriedNight\(name, nightKindOf\(at\)\);/, 'the rester\'s spot, off their stamp');
  assert.match(w, /const kind = carriedRestKind\(bag\.placeKind\?\.\(\) \?\? null, theirs\);/);
  assert.match(w, /if \(!social\?\.party \|\| modes\?\.insidePartyRestExempt \|\| !restTogether\(\) \|\| sharedClockOn\(\)\) \{ _partyRestVoteLastReady = null;/, 'no vote online, so no tally');
  assert.match(rd('src/scenes/shared.js'), /const spot = carried \? null : _spot;[^\n]*\n    const \{ result, hours \} = runRestNight\(out, \{ rentedHours \}\);/, 'the spot the open read');
});

test('AUDIT REST-PARTY A1: an encounter a host stands inside the night breaks it at the next sub-tick - no later sub-tick rolls, the hours slept are counted; with no night running the latch is nobody\'s', () => {
  assert.equal(ambushNight(), false, 'no night: nothing hears it');
  const log = [];
  let ticks = 0;
  const deps = {
    advanceMinutes: (n) => { log.push(`advance:${n}`); if (++ticks === 20) assert.equal(ambushNight(), true, 'the night hears it'); },
    tickQuests: () => {}, tickVitals: () => false, enemiesNearby: () => false, dead: () => false, fullyHealed: () => false,
    onEnemyBreak: () => log.push('break'),
  };
  const r = runRestNight(deps);
  assert.equal(r.result.enemyBroke, true);
  assert.equal(r.result.textId, REST_TEXT.enemiesNearby, 'DFU\'s line');
  assert.equal(log.filter((l) => l === `advance:${MINUTES_PER_TICK}`).length, 20, 'the sub-tick that stood the foe is the last that rolled');
  assert.equal(log.at(-1), 'break');
  assert.equal(r.hours, 3, 'three whole hours slept before the foe');
  assert.equal(ambushNight(), false, 'the latch went with the night');
});

test('AUDIT REST-PARTY A1: an ambushed night through a real bag heals nothing beyond its hours, is not heard by the party, and still stamps the interval it slept into', () => {
  setSharedClock(() => 5_000_000);
  setOwnMinutes(400_000);
  const heard = [];
  const prev = setNightListener((k) => heard.push(k));
  try {
    const e = sleeper();
    let n = 0;
    const bag = createRestDeps(e, { restKind: () => 'camp', restPoint: () => null, advanceMinutes: (m) => { advanceOwnMinutes(m); if (++n === 7) ambushNight(); }, endLines: () => null });
    bag.setResting(true);
    const r = bag.restNight();
    bag.setResting(false);
    assert.equal(r.enemyBroke, true);
    assert.ok(e.health < 60, 'no full yield on a broken night');
    assert.deepEqual(heard, [], 'nobody is carried into a night a foe broke');
    assert.ok(Number.isFinite(e.restNightAt), 'the hour it slept is a night begun');
  } finally { setNightListener(prev); }
});

test('AUDIT REST-PARTY A1 by source: both hosts that stand a resting encounter tell the night the moment its spot is found, before the awaits', () => {
  const d = rd('src/scenes/dungeonContext.js');
  const spawn = d.slice(d.indexOf('async function _spawnEncounter('), d.indexOf('function restEncounter(hit)'));
  assert.match(spawn, /if \(!spot\) return null;\n    ambushNight\(\);[^\n]*\n[\s\S]*await buildFoeAt\(/, 'the dungeon: before buildFoeAt');
  const w = rd('src/scenes/world.js');
  const stand = w.slice(w.indexOf('const _standEncounterFoe = (hit, feet) => {'), w.indexOf('journeyMet();   // AUDIT OW5b E1'));
  assert.match(stand, /if \(!spot\) return null;\n    ambushNight\(\);[^\n]*\n[\s\S]*exteriorFoes\.spawnFoe\(/, 'the open world: before spawnFoe');
});
