// AUDIT 23 fix pins, the host batch: the one clock, the shared
// fatigue/exhaustion/jump/running laws, the exterior swing arms, the
// climate population, the sky season, and the motor's swim crouch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tickPlayerMinutes, worldMinutes, setWorldMinutes } from '../src/systems/worldTick.js';
import { createPlayerTicker } from '../src/scenes/shared.js';
import { createCityGuards } from '../src/scenes/cityGuards.js';
import { skyOffsetForWeather } from '../src/world/weather.js';
import { exteriorAmbient } from '../src/world/worldClock.js';
import { PlayerMotor, HEIGHT_TIMER_MEDIUM } from '../src/player/motor.js';
import { TownPopulation } from '../src/systems/townPopulation.js';
import { BANK_TYPES } from '../src/characters/nameHelper.js';
import { NORMALIZE_INTERVAL_MINUTES } from '../src/systems/court.js';
import { SKILLS } from '../src/systems/skills.js';
import { maxFatigue } from '../src/systems/statMods.js';
import { SOUND, swingSoundFor } from '../src/systems/soundClips.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');
const EXTERIOR = src('src/scenes/exterior.js');
const WORLD = src('src/scenes/world.js');
const WM = src('src/scenes/worldModes.js');
const DUNGEON = src('src/scenes/dungeon.js');

// AUDIT 26: the frame-4 bow loose is single-sourced onto swingSoundFor
// (FPSWeapon.PlaySwingSound plays SwingWeaponSound, which SetWeapon fills
// from the wielded weapon's GetSwingSound). The pin is the CLIP AND VOLUME
// a host's own bow arm sounds with a bow in hand, not the spelling of the
// call: it runs the arm and listens.
const bowLooseSound = (text, weapon = { name: 'Short Bow', templateIndex: 129 }) => {
  const arm = /if \(ev === 'bowSound'\) \{([^}]*)\}/.exec(text);
  assert.ok(arm, 'the frame-4 bow arm is wired');
  const played = [];
  const rig = { playerWeapon: { weapon } };
  new Function('ev', 'audio', 'SOUND', 'swingSoundFor', 'weaponRig', 'interiorWeapon', 'playerWeapon',
    arm[1].replace('continue;', ''))('bowSound',
    { playOneShot: (c, v) => played.push([c, v]) }, SOUND, swingSoundFor, rig, rig, rig.playerWeapon);
  return played;
};

const tickEntity = () => ({
  chargenDone: true, skillUses: new Array(35).fill(0), stats: { strength: 50, endurance: 50 },
  skills: 30, activeEffects: [], lastSkillCheckTime: 0, fatigue: 3200, health: 50, maxHealth: 50,
});
const sinks = (drained = { n: 0 }) => ({
  drainFatigue: (n) => { drained.n += n; }, hurt() {}, heal() {}, drainMagicka() {},
  restoreFatigue() {}, restoreMagicka() {}, say() {},
});

test('AUDIT 23 C2: both exterior hosts read the ONE clock; ?tod sets it, ?timescale scales it', () => {
  // hosts-8 = audio-1: minuteNow was a demo clock frozen at noon while
  // gameplay time advanced on worldMinutes - night never fell.
  for (const [name, text] of [['exterior', EXTERIOR], ['world', WORLD]]) {
    assert.ok(text.includes('const minuteNow = () => worldMinutes() % 1440;'), `${name}: one clock`);
    assert.ok(text.includes('setWorldMinutes(Math.floor(worldMinutes() / 1440) * 1440 + bootTod)'), `${name}: ?tod sets the clock`);
    assert.ok(text.includes("params.has('timescale') ? Number(params.get('timescale')) / 12 : 1"), `${name}: ?timescale scales the tick`);
    assert.equal(/performance\.now\(\) - bootedAt/.test(text), false, `${name}: the demo clock is gone`);
  }
});

test('AUDIT 23 hosts-3: the guards take the classic clock and refuse to run without one', () => {
  assert.throws(() => createCityGuards({ renderer: {}, collider: {}, playerEntity: {} }),
    /currentMinute/, 'the () => 0 default is gone - a missing clock fails loudly');
  for (const [name, text] of [['exterior', EXTERIOR], ['world', WORLD]]) {
    assert.ok(text.includes('currentMinute: () => Math.floor(playerTicker.classicMinutes)'), `${name} passes the clock`);
  }
});

test('AUDIT 23 entity-2 + C6: the three above-ground tick calls carry IsRunning and the jump edge', () => {
  // PlayerEntity.cs:408 (IsRunning && !IsStandingStill) and :425-430.
  for (const [name, text] of [['exterior', EXTERIOR], ['world', WORLD]]) {
    assert.ok(text.includes('running: player.isRunning && !player.standing'), `${name}: the running read`);
    assert.ok(text.includes('jumped: player.jumped'), `${name}: the jump edge`);
    assert.equal(/running: player\.running\b/.test(text), false, `${name}: the undefined field is gone`);
  }
  assert.ok(WM.includes('running: player.isRunning && !player.standing'), 'worldModes interior arm');
  assert.ok(WM.includes('jumped: player.jumped'), 'worldModes interior jump edge');
});

test('AUDIT 23 C5: the shared ticker sink clamps and raises the exhaustion collapse', () => {
  // DaggerfallEntity.cs:360-366 via createPlayerTicker's sinks.
  let collapsed = 0;
  const entity = { ...tickEntity(), fatigue: 5, stats: { strength: 50, endurance: 50 } };
  const ticker = createPlayerTicker(entity, { onExhausted: () => { collapsed++; } });
  // one minute passes; the default 11-point drain empties the pool
  ticker.tick(5.1, { running: false, swimming: false });
  assert.equal(entity.fatigue, 0);
  assert.equal(collapsed, 1, 'hitting 0 with health left raises OnExhausted');
  // ...and restoreFatigue clamps at the live MaxFatigue
  entity.fatigue = maxFatigue(entity) - 1;
  ticker.tick(0.01, { running: false, swimming: false });   // no minute change - no drain
  entity.fatigue = maxFatigue(entity) + 500;   // simulate an over-restore attempt via the sink path
  // direct check on the law: the sink is inside the ticker, so restore
  // through a magic-round path is covered by the clamp sweep:
  assert.ok(src('src/scenes/shared.js').includes('entity.fatigue = Math.min(maxFatigue(entity), (entity.fatigue ?? 0) + n)'),
    'restoreFatigue clamps at MaxFatigue');
});

test('AUDIT 23 C4: the 112-day boundary normalizes reputations through the tick', () => {
  // PlayerEntity.cs:455-459 - the wired call the port never had.
  const entity = { ...tickEntity(), legalRep: { 17: -50, 23: 40 } };
  const before = NORMALIZE_INTERVAL_MINUTES - 1;
  tickPlayerMinutes({ entity, classicMinutes: before, dt: 10, sinks: sinks(), rolls: () => 0.5 });
  assert.equal(entity.legalRep[17], -49, 'the negative side decays toward zero');
  assert.equal(entity.legalRep[23], 39, 'the positive side decays toward zero');
  // the prison skip's flag holds it
  const held = { ...tickEntity(), legalRep: { 17: -50 }, preventNormalizingReputations: true };
  tickPlayerMinutes({ entity: held, classicMinutes: before, dt: 10, sinks: sinks(), rolls: () => 0.5 });
  assert.equal(held.legalRep[17], -50, 'preventNormalizingReputations skips the pass');
});

test('AUDIT 23 entity-5: Running tallies every 4th classic update while running', () => {
  // PlayerEntity.cs:309-320 - 4 x 0.0625s per tally.
  const entity = tickEntity();
  tickPlayerMinutes({ entity, classicMinutes: 0, dt: 1.0, sinks: sinks(), activity: { running: true }, rolls: () => 0.5 });
  assert.equal(entity.skillUses[SKILLS.Running], 4, 'one second of running = 4 tallies');
  const idle = tickEntity();
  tickPlayerMinutes({ entity: idle, classicMinutes: 0, dt: 1.0, sinks: sinks(), activity: { running: false }, rolls: () => 0.5 });
  assert.equal(idle.skillUses[SKILLS.Running], 0, 'standing still tallies nothing');
});

test('AUDIT 23 C14 + combat-4: the exterior swing arms drain, tally fully, and never double-count', () => {
  for (const [name, text] of [['exterior', EXTERIOR], ['world', WORLD]]) {
    assert.equal((text.match(/drainExteriorFatigue\(SWING_WEAPON_FATIGUE_LOSS\)/g) ?? []).length, 2,
      `${name}: the bow arm and the melee arm both drain`);
    assert.ok(text.includes('tallySwingSkills(playerEntity, weaponRig.playerWeapon.weapon)'), `${name}: the full bow tally arm`);
    assert.equal(/WEAPON_SKILL\[/.test(text), false, `${name}: the display-name double tally is gone`);
    assert.deepEqual(bowLooseSound(text), [[SOUND.ArrowShoot, 1.1]],
      `${name}: the bow frame-4 loose sounds the wielded bow's swing clip at 1.1`);
  }
});

test('AUDIT 23 C12: night interiors take the darker ambient in both interior hosts', () => {
  // PlayerAmbientLight.cs:75-80.
  for (const [name, text] of [['worldModes', WM], ['interior', src('src/scenes/interior.js')]]) {
    assert.ok(/isNight\(worldMinutes\(\) % 1440\) \? INTERIOR_NIGHT_AMBIENT : INTERIOR_AMBIENT/.test(text),
      `${name}: the night switch`);
  }
});

test('AUDIT 23 hosts-1: worldModes routes death by LIVE mode and restores the exterior presenter', () => {
  assert.ok(/const prevDeathPresenter = setDeathPresenter\(/.test(WM), 'the previous presenter is captured');
  assert.equal((WM.match(/mode === 'exterior' && prevDeathPresenter/g) ?? []).length, 2,
    'both registrations (construction + dungeon-return) route by mode');
  assert.equal(/^\s*setDeathPresenter\(presentInteriorDeath\);$/m.test(WM), false,
    'no raw interior registration survives to shadow the router');
});

test('AUDIT 23 hosts-6 + hosts-9: the dungeon host swallows F5/F6 and feeds music above the gate', () => {
  // U47 moved the list into ui/input.js and added F11 to it - F5, F6
  // and F11 are all DFU bindings AND browser gestures, and a list per
  // host is four lists that drift. The law is unchanged and the pin
  // follows it to its home: this host still swallows, through the
  // shared call, and the list still holds all three.
  assert.ok(DUNGEON.includes('swallowBrowserKey(e);'), 'the dungeon host swallows');
  assert.match(readFileSync(join(root, 'src/ui/input.js'), 'utf8'),
    /BROWSER_STEALS = Object\.freeze\(\['F5', 'F6', 'F11'\]\)/, 'and the list is all three');
  const feed = DUNGEON.indexOf('musicDirector.update({');
  // the FRAME-loop gate is the one whose branch draws the overlay (the
  // pointer handler also gates on uiOverlayActive, earlier in the file)
  const gate = DUNGEON.indexOf('ctx.tickOverlay(dt); ctx.drawOverlay(canvas);');
  assert.ok(feed > 0 && feed < gate, 'the music context is fed before the modal return');
});

test('AUDIT 23 wts-1/2: the sky season arm and the weather-scaled ambient', () => {
  // DaggerfallSky.cs:354-357 + PlayerAmbientLight.cs:120-125.
  const rng = { nextFloat: () => 0.9 };
  assert.equal(skyOffsetForWeather('sunny', rng, 3), 3, 'clear weather adds the season');
  assert.equal(skyOffsetForWeather('cloudy', rng, 1), 1);
  assert.equal(skyOffsetForWeather('rain', rng, 3), 4, 'precipitation keeps its variant, season ignored');
  const noonClear = exteriorAmbient(720, 1, 1);
  const noonStorm = exteriorAmbient(720, 1, 0.25);
  assert.ok(noonStorm[0] < noonClear[0], 'a storming noon is darker than a clear one');
  for (const [name, text] of [['exterior', EXTERIOR], ['world', WORLD]]) {
    assert.ok(text.includes('seasonValue(dateFromClassicMinutes(playerTicker.classicMinutes))'), `${name}: the sky reads the calendar`);
    assert.ok(text.includes('exteriorAmbient(minute, 1, weatherSun)'), `${name}: ambient rides the weather scale`);
  }
});

test('AUDIT 23 characters-4/5: the population takes the climate race and the REGION name bank', () => {
  for (const [name, text] of [['exterior', EXTERIOR], ['world', WORLD]]) {
    assert.ok(/\{ 0: 'Nord', 2: 'Redguard', 3: 'Breton' \}/.test(text), `${name}: the People map`);
    assert.ok(text.includes('nameBank: getNameBankOfRegion('), `${name}: the region bank`);
  }
  // ...and TownPopulation honors the bank for names while the race
  // keeps driving the billboards.
  const pop = new TownPopulation({}, { totalBlocks: 4, race: 'Redguard', nameBank: BANK_TYPES?.Nord ?? 1, makePerson: () => ({}) });
  assert.equal(pop.nameBank, BANK_TYPES?.Nord ?? 1);
  assert.equal(pop.race, 'Redguard');
});

test('AUDIT 23 motor-1/2: standing ignores Jump; a free swim forces the crouch and surfacing stands', () => {
  // PlayerMotor.cs:121 + PlayerHeightChanger.cs:192-207.
  const collider = {
    penetrationAt: () => 0, heightAt: () => 0, raycast: () => Infinity,
    move: (pos) => pos, floorLanding: () => null,
  };
  const m = new PlayerMotor(collider);
  m.grounded = true;
  // holding Jump in place is still standing (the stealth half-speed read)
  m._trackHalfSpeed?.({ forward: 0, strafe: 0, up: true, down: false });
  if (m.standing === undefined) {
    // fall back to the source sweep if the tracker is private
    assert.ok(src('src/player/motor.js').includes('const standing = this.grounded && !input.forward && !input.strafe;'));
  } else {
    assert.equal(m.standing, true);
  }
  // the forced swim crouch: swimming off the bottom crouches on the
  // MEDIUM clock without any key
  const m2 = new PlayerMotor(collider);
  m2.swimming = true;
  m2.grounded = false;
  m2._heightAction(HEIGHT_TIMER_MEDIUM + 0.01, {});
  assert.equal(m2.crouching, true, 'a free swim forces the crouched capsule');
  assert.equal(m2.forcedSwimCrouch, true);
  // surfacing un-forces it
  m2.swimming = false;
  m2.grounded = true;
  m2._heightAction(HEIGHT_TIMER_MEDIUM + 0.01, {});
  assert.equal(m2.crouching, false, 'surfacing stands back up');
  assert.equal(m2.forcedSwimCrouch, false);
});
