// FATIGUE-IDLE (2026-09-29, Mac: "fatigue seems to be insanely draining when being idle with no status effects", then
// "You shouldn't lose fatigue at an insane rate standing still"; asked what standing still should cost: "Nothing", and
// Roleplay Realism's overload keeps the mod's rule). MEASURED FIRST, on the live build and through the hosts' own
// ticker (offline and online, 60 and 144 fps): standing still paid exactly the walk's minute - 8 fatigue a game minute
// on BALANCE1's scale, a full bar at STR/END 50 in ~67 real minutes of doing nothing - because DFU charges
// DefaultFatigueLoss every minute the player is not climbing, running or swimming (PlayerEntity.cs:405-418), standing
// still included. No second drain was found and nothing charged twice; the rule itself was the cost.
//
// THE DEPARTURE (Ledger A, FATIGUE-IDLE): the minute's band charges nothing while the motor reports the player standing
// still ON THE GROUND (player/motor.js `standing` - grounded, no move input; PlayerMotor.IsStandingStill's term) and not
// swimming. Walking, running, climbing, swimming (the failed roll's 44 and the passed roll's 11 alike), a jump, a swing,
// fatigue damage and Roleplay Realism's overload keep their amounts - the overload is the mod's own round, not the band.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../modsOff.js';
import { codeOnly } from '../codeOnly.mjs';
import { tickPlayerMinutes, CLASSIC_MINUTES_PER_SECOND, setSharedClock, setWorldMinutes, resetMagicRoundMarker } from '../../src/systems/worldTick.js';
import { createPlayerTicker } from '../../src/scenes/shared.js';
import { installRoleplayRealism } from '../../src/systems/roleplayRealism/rrInstall.js';
import { setModSetting } from '../../src/systems/modSettings.js';
import { mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { FATIGUE_DRAIN_SCALE } from '../../src/systems/statMods.js';
import { carriedWeight } from '../../src/systems/inventory.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const entity = (extra = {}) => ({ level: 1, health: 50, maxHealth: 50, fatigue: 6400, magicka: 0, stats: {}, skills: new Array(35).fill(30), skillUses: [], items: [], activeEffects: [], ...extra });

/** What one minute's crossing charges, for an activity - the tick's own band, one call. `roll` is the swimming roll's draw. */
function minute(activity, { roll = 0.5, e = entity() } = {}) {
  let n = 0;
  tickPlayerMinutes({
    entity: e, classicMinutes: 59.99, dt: 0.05, activity, fatigueMultiplier: 1, rolls: () => roll,
    sinks: { drainFatigue: (d) => { n += d; } },
  });
  return n;
}

test('FATIGUE-IDLE: standing still on the ground costs nothing a minute - walking, running, climbing, swimming and a jump keep their amounts', () => {
  assert.equal(minute({ standing: true }), 0, 'standing still: nothing');
  assert.equal(minute({}), 8, 'walking: the walk (11 x BALANCE1\'s 0.75)');
  assert.equal(minute({ standing: false }), 8, 'moving, said out loud: the walk');
  assert.equal(minute({ running: true }), 66, 'running: the run');
  assert.equal(minute({ standing: true, climbing: true }), 16, 'on a wall, the motor\'s grounded term says standing - the climb is charged');
  assert.equal(minute({ standing: true, jumped: true }), 8, 'a jump from a standstill costs its jump');
  // swimming keeps BOTH its amounts: the failed Swimming roll's 44 and the passed roll's walk (Dice100 against skill 30)
  assert.equal(minute({ standing: true, swimming: true }, { roll: 0.9 }), 33, 'a failed roll in the water: the swim');
  assert.equal(minute({ standing: true, swimming: true }, { roll: 0.01 }), 8, 'a passed roll in the water: the walk, never free - treading water is not standing on the ground');
  const resting = entity({ isResting: true });
  assert.equal(minute({}, { e: resting }), 0, 'and resting charges nothing, as it always has (S40)');
});

test('FATIGUE-IDLE: through the hosts\' own ticker at 60 fps - an hour standing still costs nothing, an hour walking 480, offline and online', () => {
  const idleHour = (standing, online) => {
    const e = entity({ isPlayer: true, stats: { strength: 50, endurance: 50 }, raceId: 0 });
    const t = { clock: 100000 };
    if (online) setSharedClock(() => t.clock); else { setSharedClock(null); setWorldMinutes(100000); }
    e.lastGameMinutes = 100000;
    resetMagicRoundMarker(100000);
    const ticker = createPlayerTicker(e);
    const f0 = e.fatigue, dt = 1 / 60, frames = Math.round(60 / CLASSIC_MINUTES_PER_SECOND / dt);   // an hour of game time
    try {
      for (let i = 0; i < frames; i++) {
        if (online) t.clock += dt * CLASSIC_MINUTES_PER_SECOND;
        ticker.tick(dt, { running: false, runningTally: false, swimming: false, climbing: false, jumped: false, standing });
      }
    } finally { setSharedClock(null); }
    return f0 - e.fatigue;
  };
  for (const online of [false, true]) {
    const where = online ? 'online' : 'offline';
    assert.equal(idleHour(true, online), 0, `${where}: an hour standing still`);
    const walked = idleHour(false, online);
    assert.ok(walked >= 472 && walked <= 480, `${where}: an hour walking is the walk's 8 a minute (${walked})`);
  }
});

test('FATIGUE-IDLE: Roleplay Realism\'s overload keeps the mod\'s rule - a laden player standing still still pays its round (Mac: "Keep the mod\'s rule")', () => {
  installRoleplayRealism();
  setModSetting('roleplay-realism', 'Enabled', true);
  setModSetting('roleplay-realism', 'encumbranceEffects', true);
  try {
    const claymore = () => mintCondition(setItemFields({ group: 'Weapons', templateIndex: WEAPONS.Claymore, material: 0 }));
    const e = entity({ isPlayer: true, stats: { strength: 40, speed: 60, endurance: 50 }, items: Array.from({ length: 7 }, claymore), health: 20 });
    // the overload's own round, as test/systems/rr1_realism.test.js computes it: float32 over the pack's ceiling (STR 40: 60 kg)
    const over = Math.fround(Math.fround(Math.fround(Math.min(Math.fround(carriedWeight(e) / 60), 1.2)) - 0.75) * 2);
    const overload = Math.floor(Math.trunc(over * 100) * FATIGUE_DRAIN_SCALE + 1e-9);
    assert.ok(overload > 0, `seven claymores are an overload (${carriedWeight(e)} kg of 60)`);
    resetMagicRoundMarker(59);
    assert.equal(minute({ standing: true }, { e }), overload, 'standing still, laden: the overload\'s round and nothing of the band');
  } finally {
    setModSetting('roleplay-realism', 'encumbranceEffects', false);
    setModSetting('roleplay-realism', 'Enabled', false);
  }
});

test('FATIGUE-IDLE: every host hands the tick the motor\'s standing - the street, the world, the interiors, the dungeon, and the dungeon\'s report carries it', () => {
  const standingFeed = /standing: !!player\.standing,/;
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = codeOnly(rd(f));
    const at = s.indexOf('playerTicker.tick(dt * timeScaleMult');
    assert.ok(at > 0, `${f}: the ticker call is where it was`);
    assert.match(s.slice(at, at + 1500), standingFeed, `${f}: the activity carries standing`);
  }
  const modes = codeOnly(rd('src/scenes/worldModes.js'));
  const interior = modes.indexOf('interiorTicker.tick(dt, {');
  assert.ok(interior > 0);
  assert.match(modes.slice(interior, interior + 1500), standingFeed, 'worldModes: the interior ticker');
  const report = modes.indexOf('dungeonCtx.reportActivity?.({');
  assert.ok(report > 0);
  assert.match(modes.slice(report, report + 600), /standing: !!player\.standing/, 'worldModes: the dungeon\'s report');
  const dungeon = codeOnly(rd('src/scenes/dungeon.js'));
  const dreport = dungeon.indexOf('ctx.reportActivity?.({');
  assert.ok(dreport > 0);
  assert.match(dungeon.slice(dreport, dreport + 600), /standing: !!player\.standing/, 'dungeon.js: the report');
  const ctx = codeOnly(rd('src/scenes/dungeonContext.js'));
  assert.match(ctx, /reportActivity\(\{ running = false, runningTally = false, swimming = false, climbing = false, standing = false,/, 'dungeonContext: the report takes it (a host that says nothing is moving - the walk, never free)');
  assert.match(ctx, /_activity\.standing = standing;/, 'and hands it to the tick');
});
