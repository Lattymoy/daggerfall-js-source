// FEUD HARNESS (bible/12-Enhanced-AI/Feud-Arc.md section 28 and the FEUD HARNESS record; Mac, 2026-10-05: "Take care of
// both gaps"). The duel harness (tools/tellDuel.mjs) fought a revenant alone and never let it run; it now fights the rest
// of what the pools give it - its band (its kin by rank about it, each its own motor, attack and brain; rank 5's rally at
// its stand, through a portal when none is left; scattered when it runs) and its flight (systems/revenant.js
// revenantFleeStep: escaped, the fight is over; chased, run down). Modelling it found a fault in the game: a revenant
// risen in its last stand as it ran ran on - its motor's run (`ai.fleeLeft`) never ended, so it was neither cornered nor
// escaped, untargeted for the rest of its run. `beginLastStand` ends it now, as a kneel's and a tear-away's do.
// Pinned: the fault's fix through a real motor; the band's size by rank, its ring, its kin's own blows and the dodger
// out of them; the flight - run down, or let go and escaped; the rally to it and through a portal; the band first;
// the cell's counts; the header's word.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const H = await import('../tools/tellDuel.mjs');
const N = await import('../src/systems/revenant.js');
const F = await import('../src/systems/revenantFeud.js');
const FATE = await import('../src/systems/revenantFate.js');
const { EnemyAI } = await import('../src/characters/enemyMotor.js');
const { Collider } = await import('../src/player/collider.js');
const { EnemyAttack } = await import('../src/characters/enemyAttack.js');
const { setPref, getPref } = await import('../src/systems/uiPrefs.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SEEDS = (n, from = 1) => Array.from({ length: n }, (_, i) => from + i);
const fights = (opts, seeds) => seeds.map((seed) => H.revenantFight({ ...opts, seed }));

test('FEUD HARNESS THE FAULT: risen in its last stand as it runs, its run is over - the motor no longer flees, and the flee law asks nothing more of it (mutants: the run left running)', () => {
  const was = getPref('lootRarity');
  setPref('lootRarity', true);
  try {
    N._resetRevenantForTests(); globalThis.localStorage.clear();
    const me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-feudharness', level: 10, items: [] };
    const r = N.revenantDeed(me, { mobileType: M.Orc, level: 10, champion: 'mighty', health: 1, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0, now: 1 });
    r.rank = 3; r.out = false;
    const entity = { mobileType: M.Orc, level: 10, health: 60, maxHealth: 60, team: 'Monster', items: [] };
    N.applyRevenant(entity, r, { now: 2 });
    const ai = new EnemyAI(new Collider(() => 0), [0, 0, 4], Math.PI, { vitals: () => entity });
    const f = { entity, ai, mobileType: M.Orc, gender: 'male', dead: false, fleeing: true, _fleeRolled: true };
    ai.flee([0, 0, 0], N.REVENANT_FLEE_SECONDS);
    entity.health = 0;
    assert.equal(FATE.revenantLastStandDue(f), true);
    FATE.beginLastStand(me, f, { now: 0, clock: 0 });
    assert.equal(f.fleeing, false);
    assert.equal(ai.fleeLeft, 0, 'its run over');
    assert.equal(N.revenantFleeStep(f, [0, 0, 0]), null, 'and nothing more of the flee law');
  } finally { setPref('lootRarity', was); }
});

test('FEUD HARNESS THE BAND STANDS: its rank\'s kin (RETINUE\'s - none at 1, then 1, 2, 3, 3), each its kind\'s own ordinary foe of its band in the ring out to BAND_SPACING about it; none when the band is off (mutants: the band unstood; the ring moved; its master unnamed)', () => {
  for (const rank of [1, 2, 3, 4, 5]) assert.equal(H.revenantFight({ rank, seconds: 0.05, seed: 7 }).band, F.RETINUE[rank], `rank ${rank}`);
  assert.equal(H.revenantFight({ rank: 5, seconds: 0.05, seed: 7, band: false }).band, 0);
  let i = 0;
  const rand = () => [0.25, 0, 0.25, 0.999][i++ % 4];
  const near = H.standKin({ mobileType: M.OrcSergeant, level: null }, [0, 0, 4], Math.PI, 'rid', rand);
  const far = H.standKin({ mobileType: M.Orc, level: null }, [0, 0, 4], Math.PI, 'rid', rand);
  const off = (g) => Math.hypot(g.ai.feet[0], g.ai.feet[2] - 4);
  assert.ok(Math.abs(off(near) - 1) < 1e-9, 'the ring\'s near edge');
  assert.ok(Math.abs(off(far) - (1 + 0.999 * (F.BAND_SPACING - 1))) < 1e-9, 'its far edge');
  assert.deepEqual([near.entity.retinueOf, near.entity.champion ?? null, !!near.entity.eliteFoe, near.dead, near.scattering], ['rid', null, false, false, false]);
});

test('FEUD HARNESS ITS BAND PRESSES: its kin swing at me while I strike its master; a kin of the tier winds up at me and lands on the trader - the dodger is out of its blows as of its master\'s (mutants: the kin unstepped; their swings uncounted; the dodger blind to them)', () => {
  const orc = fights({ rank: 5, mode: 'trade' }, SEEDS(4));
  assert.ok(orc.every((x) => x.bandSwings > 0), 'every fight');
  assert.ok(fights({ rank: 5, mode: 'trade', band: false }, SEEDS(4)).every((x) => x.bandSwings === 0));
  const trade = fights({ type: M.Harpy, rank: 5, mode: 'trade' }, SEEDS(12));
  const dodge = fights({ type: M.Harpy, rank: 5, mode: 'dodge' }, SEEDS(12));
  const sum = (rows, k) => rows.reduce((a, x) => a + x[k], 0);
  assert.ok(sum(trade, 'bandWindups') > 0 && sum(trade, 'bandHits') > 0, 'a Fae band winds up, and lands on the trader');
  assert.ok(sum(dodge, 'bandWindups') > 0);
  assert.equal(sum(dodge, 'bandHits'), 0, 'the dodger is out of every one');
});

test('FEUD HARNESS ITS FLIGHT: under a fifth of its health it may run - striking nothing as it runs, its band scattering from it; chased at a run it is brought down (no escape on flat ground, no fight left hanging); let go, it escapes and the fight is over, `fled` (mutants: the flight unasked; it strikes as it runs; the escape unread; the band unscattered; the chase at a walk)', () => {
  const step = EnemyAttack.prototype.update;
  let struckRunning = 0;
  EnemyAttack.prototype.update = function (dt, ai, ...rest) { if (ai?.fleeLeft > 0 && ai.vitals?.()?.revenant) struckRunning++; return step.call(this, dt, ai, ...rest); };
  let rows;
  try { rows = fights({ rank: 3, mode: 'trade' }, SEEDS(40)); } finally { EnemyAttack.prototype.update = step; }
  assert.equal(struckRunning, 0, 'running, its attack is never stepped (the pools\' `continue`)');
  const ran = rows.filter((x) => x.flight);
  assert.ok(ran.length >= 3, `some run (${ran.length})`);
  assert.ok(ran.every((x) => x.scattered === x.band), 'its band scatters from it');
  assert.ok(ran.every((x) => x.end === 'knelt' || x.end === 'tore'), 'run down');
  assert.ok(ran.some((x) => x.stoodInFlight), 'some rise in their last stand as they run - and fight on to their end');
  assert.ok(ran.some((x) => x.caught), 'some are brought down as they run');
  const long = ran.filter((x) => x.t - x.flightAt > F.BAND_SCATTER_S + 0.5);
  assert.ok(long.length > 0 && long.every((x) => x.bandGone === x.band), 'its scattered band gone when its run is spent');
  assert.ok(ran.filter((x) => x.t - x.flightAt < F.BAND_SCATTER_S - 0.5).every((x) => x.bandGone === 0), 'not before');
  const let_ = fights({ rank: 3, mode: 'trade', chase: false }, ran.map((x) => rows.indexOf(x) + 1));
  assert.ok(let_.filter((x) => x.flight).length > 0 && let_.filter((x) => x.flight).every((x) => x.end === 'fled'), 'let go, it escapes');
  assert.ok(fights({ rank: 3, mode: 'trade', flight: false }, SEEDS(40)).every((x) => !x.flight && x.end !== 'fled'), 'no flight: none');
});

test('FEUD HARNESS RANK 5\'S RALLY: at its stand its band\'s survivors to it; its band scattered by its flight, RALLY_KIN of its kin through a portal (mutants: the rally unasked; the portal unopened; the count moved)', () => {
  const rows = fights({ rank: 5, mode: 'trade' }, SEEDS(40));
  const stood = rows.filter((x) => x.stood);
  assert.ok(stood.some((x) => x.rallied === x.band && x.portal === 0), 'its band standing: to it');
  const portal = stood.filter((x) => x.portal > 0);
  assert.ok(portal.length > 0, 'a portal');
  assert.ok(portal.every((x) => x.portal === F.RALLY_KIN && x.rallied === 0 && x.scattered === x.band), 'none standing - its kin through a portal');
  assert.ok(fights({ rank: 3, mode: 'trade' }, SEEDS(10)).every((x) => x.rallied === 0 && x.portal === 0), 'rank 3: no rally');
});

test('FEUD HARNESS ITS BAND FIRST: struck down kin by kin before its master; at rank 5 its stand finds none - its kin through a portal (mutants: the band first unread; a slain kin left standing)', () => {
  const rows = fights({ rank: 5, mode: 'trade', order: 'band' }, SEEDS(6));
  assert.ok(rows.every((x) => x.bandSlain >= 1), 'its kin slain');
  assert.ok(rows.some((x) => x.portal === F.RALLY_KIN), 'a portal at its stand');
  assert.ok(fights({ rank: 5, mode: 'trade' }, SEEDS(6)).every((x) => x.bandSlain === 0), 'its master first: none slain');
});

test('FEUD HARNESS THE CELL AND THE HEADER: a cell counts its flight and its band; the measure stands its band-first and alone rows beside the targets; the header names what is modelled and what is not (mutants: a count dropped)', () => {
  const c = H.revenantCell({ rank: 3, mode: 'trade' }, 4);
  for (const k of ['fled', 'flights', 'cornered', 'caught', 'stoodInFlight', 'band', 'bandSwings', 'bandWindups', 'bandHits', 'rallied', 'portal', 'bandSlain', 'scattered']) assert.ok(k in c, k);
  assert.equal(c.band, 2);
  const src = read('tools/tellDuel.mjs');
  assert.match(src, /and the rest of the fight the pools give it - ITS BAND/);
  assert.match(src, /Never modelled: the player's own health \(the band's plain blows - under the tier - land on nobody here\), a\n\/\/ kin's spells/);
  assert.doesNotMatch(src, /Never modelled: a flight/);
  const m = H.measureFeud({ fights: 1, weapons: ['Longsword'] });
  assert.deepEqual(m.beside.map((x) => `${x.rank}/${x.mode}/${x.order}/${x.band}`), ['3/trade/band/2', '3/dodge/band/2', '5/trade/band/3', '5/dodge/band/3', '3/trade/alone/0', '3/dodge/alone/0']);
  assert.ok(m.beside.filter((x) => x.order === 'alone').every((x) => x.flights === 0));
});
