import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ENV_DEFAULTS, survivalCtx, survivalFeed, restGateEnv, installSurvivalGate, survivalRecordAt } from '../src/systems/survival/env.js';
import { REST_TEXT_SURVIVAL } from '../src/systems/survival/rest.js';
import { newSurvival, alignSurvival, ALIGN_GRACE_MINUTES } from '../src/systems/survival/needs.js';
import { raceById, RACES } from '../src/systems/races.js';
import { registerPreventRestCondition, getPreventedRestMessage, clearPreventRestConditions } from '../src/systems/restSession.js';
import { createPlayerTicker } from '../src/scenes/shared.js';
import { setWorldMinutes } from '../src/systems/worldTick.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { SKILLS } from '../src/systems/skills.js';

// ═══ SURV7 (2026-09-18): THE FEED, THE GATE, THE ALIGNMENT ═════════
//
// The hosts say where the player stands; survival/env.js builds the
// body's half from the entity, hands tickPlayerMinutes its `survival`
// argument, and puts the rest gate on DFU's own seam with the same
// reader. A load or an online arrival aligns the needs' markers to the
// world's clock on WORLD5's law.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const player = (raceId = RACES.Breton) => ({
  isPlayer: true, level: 3, health: 30, maxHealth: 40, magicka: 10, maxMagicka: 20, fatigue: 20 * 64, raceId,
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: 20, career: {}, skillUses: { [SKILLS.Medical]: 0 }, activeEffects: [], items: [],
  equip: { slots: new Array(27).fill(null) },
});
const NOON = { climateIndex: 232, month: 6, hour: 12, weather: 'sunny', inSunlight: true };

test('SURV7: the feed - null with the mod off or no env; the env over the defaults; the worn slots and the body\'s ctx off the entity; the live flags through', () => {
  _resetForTests();
  const p = player(RACES.Nord);
  assert.equal(survivalFeed(p, null), null, 'no env, no feed');
  assert.equal(survivalFeed(null, NOON), null);
  const f = survivalFeed(p, NOON, { say: () => {} });
  assert.deepEqual(f.env, { ...ENV_DEFAULTS, ...NOON }, 'the host\'s keys over the defaults');
  assert.equal(f.deps.worn, p.equip.slots, 'the equip table\'s slots are the worn items');
  assert.equal(f.deps.ctx.vampire, false);
  assert.equal(f.deps.ctx.raceId, RACES.Nord);
  assert.deepEqual(f.deps.ctx.raceTemplate, raceById(RACES.Nord), 'the race\'s own tolerance flags');
  assert.equal(raceById(RACES.Nord).resistanceFlags, 16, 'a Nord resists frost');
  assert.equal(typeof f.deps.say, 'function'); assert.equal(f.deps.rolls, undefined, 'no rolls handed, none forced');
  const g = survivalFeed(p, { ...NOON, lycanthrope: true, beastForm: true, fireResist: 30, frostResist: 10 });
  assert.deepEqual([g.deps.ctx.lycanthrope, g.deps.ctx.beastForm, g.deps.ctx.fireResist, g.deps.ctx.frostResist], [true, true, 30, 10]);
  assert.deepEqual(survivalCtx({ raceId: RACES.Breton, activeEffects: [] }).raceTemplate, raceById(RACES.Breton));
  assert.equal(survivalFeed({ ...p, equip: null }, NOON).deps.worn, null, 'no table, nothing worn');
  setPref('survival', false);
  assert.equal(survivalFeed(p, NOON), null, 'off with the switch');
  _resetForTests();
  assert.equal(ENV_DEFAULTS.climateIndex, 232); assert.equal(ENV_DEFAULTS.sleeping, null);
});

test('SURV7: the gate - the record\'s felt word, the host\'s fire and roof, on DFU\'s prevent-rest seam; too cold without either, too hot anywhere, nothing off the switch', () => {
  _resetForTests();
  clearPreventRestConditions();
  const p = player();
  let env = { byFire: false, insideBuilding: false };
  assert.deepEqual(restGateEnv(p, env), { tempWord: 'comfortable', byFire: false, insideBuilding: false }, 'no reading yet reads comfortable');
  p.survival = newSurvival(0); p.survival.felt = -100;
  assert.equal(restGateEnv(p, { byFire: true }).byFire, true);
  const handlers = installSurvivalGate(registerPreventRestCondition, () => p, () => env);
  assert.equal(handlers.length, 2);
  assert.equal(getPreventedRestMessage(), REST_TEXT_SURVIVAL.tooCold, 'deadly cold on the ground');
  env = { byFire: true, insideBuilding: false };
  assert.equal(getPreventedRestMessage(), null, 'a fire near');
  env = { byFire: false, insideBuilding: true };
  assert.equal(getPreventedRestMessage(), null, 'a roof');
  env = { byFire: false, insideBuilding: false };
  p.survival.felt = 0;
  assert.equal(getPreventedRestMessage(), null, 'comfortable');
  p.survival.felt = 100;
  assert.equal(getPreventedRestMessage(), REST_TEXT_SURVIVAL.tooHot);
  env = { byFire: true, insideBuilding: true };
  assert.equal(getPreventedRestMessage(), REST_TEXT_SURVIVAL.tooHot, 'no fire or roof helps the heat');
  setPref('survival', false);
  assert.equal(getPreventedRestMessage(), null, 'off with the switch');
  _resetForTests();
  clearPreventRestConditions();
});

test('SURV7: composed - the ticker feeds the minute law from the host\'s env (the felt reading lands on the record, the thirst moves), puts the gate on the seam, and feeds nothing with the mod off; the alignment law', () => {
  _resetForTests();
  clearPreventRestConditions();
  setWorldMinutes(3 * 1440 + 12 * 60);
  const p = player();
  const env = { ...NOON, byFire: false, insideBuilding: false };
  const t = createPlayerTicker(p, { say: () => {}, isInside: () => false, survivalEnv: () => env });
  assert.equal(p.survival, undefined);
  t.advance(120);
  assert.ok(Number.isFinite(p.survival?.felt), 'two hours fed: the felt reading rides the record');
  assert.ok(p.survival.thirst > 0, 'and the thirst moved');
  p.survival.felt = -100;
  assert.equal(getPreventedRestMessage(), REST_TEXT_SURVIVAL.tooCold, 'the gate stands on the seam with this ticker\'s readers');
  clearPreventRestConditions();
  // a ticker with no reader feeds nothing
  setWorldMinutes(3 * 1440 + 12 * 60);
  const q = player();
  createPlayerTicker(q, { say: () => {}, isInside: () => false }).advance(120);
  assert.equal(q.survival, undefined, 'no env, no needs');
  assert.equal(getPreventedRestMessage(), null, 'and no gate');
  // the mod off
  setPref('survival', false);
  setWorldMinutes(3 * 1440 + 12 * 60);
  const r = player();
  createPlayerTicker(r, { say: () => {}, isInside: () => false, survivalEnv: () => env }).advance(120);
  assert.equal(r.survival, undefined, 'off with the switch');
  _resetForTests();
  clearPreventRestConditions();
  // the alignment: a gap past a day resets, within it keeps, a record ahead of now resets
  const a = player(); const now = 10 * 1440;
  survivalRecordAt(a, now - 2 * 1440).lastAte = now - 2 * 1440 - 10;
  assert.equal(alignSurvival(a, now, now - ALIGN_GRACE_MINUTES - 1), true); assert.equal(a.survival.lastAte, now - 10);
  a.survival.lastAte = now - 300;
  assert.equal(alignSurvival(a, now, now - 60), false); assert.equal(a.survival.lastAte, now - 300, 'an hour away keeps its hunger');
  a.survival.lastAte = now + 500;
  assert.equal(alignSurvival(a, now, now), true, 'a record from further along than the world starts fresh');
});

test('SURV7: by source - the four hosts feed their env (the roof, the floor, the fire each owns), the two dev scenes through the mode machine; the gate per ticker; the load arm and the arrival align; the leaf is pure', () => {
  const shared = read('src/scenes/shared.js'), world = read('src/scenes/world.js'), ext = read('src/scenes/exterior.js');
  const modes = read('src/scenes/worldModes.js'), dc = read('src/scenes/dungeonContext.js'), save = read('src/systems/save.js');
  assert.match(shared, /survival: survivalFeed\(entity, survivalEnv\?\.\(\) \?\? null, \{ say \}\),/, 'the ticker\'s feed');
  assert.match(shared, /if \(survivalEnv\) installSurvivalGate\(registerPreventRestCondition, \(\) => entity, survivalEnv\);/, 'the gate per ticker');
  for (const [name, src] of [['world', world], ['exterior', ext]]) {
    assert.match(src, /const survivalEnvNow = \(\) => \{/, `${name}: the reader`);
    assert.match(src, /insideBuilding: m === 'interior', insideDungeon: m === 'dungeon',/, `${name}: the mode's flags`);
    assert.match(src, /inSunlight: m === 'exterior' && !isNight\(minuteNow\(\)\) && \(weather === 'sunny' \|\| weather === 'cloudy'\),/, `${name}: the sun`);
    assert.match(src, /byFire: m === 'exterior' && camps\.byFire\(feet\),/, `${name}: the fire`);
    assert.match(src, /sleeping: playerEntity\.isResting && !playerEntity\.isLoitering \? \(playerEntity\.restKind \?\? 'rough'\) : null,/, `${name}: the sleep and its kind`);
    assert.match(src, /fireResist: elementalResistanceChance\(playerEntity, ELEMENTS\.Fire\), frostResist: elementalResistanceChance\(playerEntity, ELEMENTS\.Frost\),/, `${name}: the resistances`);
    assert.match(src, /survivalEnv: \(\) => \(_mode\(\) === 'dungeon' \? null : survivalEnvNow\(\)\),/, `${name}: the ticker's reader, silent underground`);
    assert.match(src, /survivalEnv: \(\) => survivalEnvNow\(\),/, `${name}: the host bag's reader`);
  }
  assert.match(world, /climateIndex: maps\.getClimateIndex\(playerTravelPixel\(\)\.x, playerTravelPixel\(\)\.y\),\n\s+month: dateFromClassicMinutes\(wm\)\.month/, 'world: the pixel\'s climate');
  assert.match(ext, /climateIndex: locClimateIndex,\n\s+month: dateFromClassicMinutes\(wm\)\.month/, 'exterior: the location\'s climate');
  assert.match(world, /alignSurvival\(playerEntity, Math\.floor\(worldMinutes\(\)\), Math\.floor\(worldMinutes\(\)\)\);/, 'world: the arrival');
  assert.match(modes, /survivalEnv: \(\) => \(host\.survivalEnv \? \{ \.\.\.host\.survivalEnv\(\), insideBuilding: true, insideDungeon: false, inSunlight: false, swimming: false, byFire: false \} : null\),/, 'interior: the roof');
  assert.match(modes, /survivalEnv: \(\) => host\.survivalEnv\?\.\(\) \?\? null,/, 'the dungeon gets the outer reader');
  assert.match(dc, /insideBuilding: false, insideDungeon: true, inSunlight: false, swimming: false, transport: false,/, 'dungeon: the floor');
  assert.match(dc, /byFire: !!\(_fpFeet && camps\.byFire\(_fpFeet\)\),/, 'dungeon: its own fire');
  assert.match(dc, /survival: survivalFeed\(playerEntity, survivalEnvNow\(\), \{ say: \(msg\) => hudText\.add\(msg\) \}\),/, 'dungeon: its own tick feeds');
  assert.match(dc, /installSurvivalGate\(registerPreventRestCondition, \(\) => playerEntity, survivalEnvNow\);/, 'dungeon: its own gate');
  assert.match(save, /if \(sharedClockOn\(\)\) alignSurvival\(entity, Math\.floor\(worldMinutes\(\)\), Math\.floor\(snap\.classicMinutes \?\? 0\)\);/, 'the load arm');
  assert.match(read('src/systems/worldTick.js'), /felt = runSurvivalMinutes\(entity, lastMinutes, nowMinutes, survival\.env \?\? \{\}, /, 'the tick runs the minutes');
  assert.doesNotMatch(read('src/systems/survival/env.js'), /from '\.\.\/\.\.\/scenes\/|from '\.\.\/\.\.\/ui\/|from '\.\.\/\.\.\/combat\/|from '\.\.\/spellcast|from '\.\.\/diseases|from '\.\.\/effects|from '\.\.\/lycanthropy|document\.|window\./);
});
