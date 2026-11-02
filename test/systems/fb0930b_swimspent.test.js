// FIELD BUGS 2026-09-30b (SWIM-SPENT) - Mac: "Also you can get instakilled when fishing", and on the batch's answer
// that the collapse in the water was left as DFU's: "I dont care about DFU. We're our own thing now".
//
// A swimmer pays the swim's fatigue even holding still (worldTick.js; FATIGUE-IDLE spares dry ground only), and DFU's
// PlayerEntity.OnExhausted SetHealth(0)s a swimmer whose fatigue runs out - whatever the health, and said only after
// ("Fatigue overcomes you and sends you to a watery grave...."), in a box that held the swimmer still. FISH-TIRED keeps
// the net's angler off the last quarter of the bar; this is the death itself, for every swimmer: a drain to nothing in
// the water now costs a tenth of the health pool - one a game minute while the swimmer stays in it, five real seconds -
// said on the HUD with no box, so a swimmer at full health has some fifty seconds to make the shore, where the collapse
// is the rest hour it always was. On dry feet nothing changed: the safe collapse rests, foes about still kill.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { exhaustionOutcome, EXHAUSTED_SPENT_SHARE, EXHAUSTED_SWIMMING_LINE, EXHAUSTED_FIGHTING_LINE } from '../../src/systems/rest/rest.js';
import { createPlayerTicker } from '../../src/scenes/shared.js';
import { setSharedClock, setWorldMinutes, resetMagicRoundMarker } from '../../src/systems/worldTick.js';
import { hurtPlayer } from '../../src/characters/playerEntity.js';
import { maxFatigue } from '../../src/systems/statMods.js';
import { SKILLS } from '../../src/systems/skills.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const NOON = 100000 * 1440 + 12 * 60;

function swimmer({ fatigue = 0, swimmingSkill = 5 } = {}) {
  const skills = new Array(35).fill(30);
  skills[SKILLS.Swimming] = swimmingSkill;
  const entity = {
    isPlayer: true, level: 1, raceId: 0, name: 'Swimmer', health: 100, maxHealth: 100, magicka: 0, maxMagicka: 0,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills, skillUses: new Array(35).fill(0), activeEffects: [], items: [],
  };
  entity.fatigue = fatigue;
  return entity;
}

test('SWIM-SPENT: the law - in the water a drain to nothing is a tenth of the health and a line, foes about or not; on dry feet the safe collapse rests and foes about cost the same share (SPENT-ASHORE; they killed until 2026-10-13e)', () => {
  const e = swimmer();
  const wet = exhaustionOutcome({ enemiesNearby: false, swimming: true, entity: e });
  assert.deepEqual({ kind: wet.kind, damage: wet.damage, line: wet.line, inWater: wet.inWater }, { kind: 'drown', damage: 10, line: EXHAUSTED_SWIMMING_LINE, inWater: true });
  assert.equal(EXHAUSTED_SPENT_SHARE, 0.1);   // PIN MOVED (FIELD BUGS 2026-10-13e SPENT-ASHORE): renamed - the water's share and the shore's, one constant
  assert.equal(exhaustionOutcome({ enemiesNearby: true, swimming: true, entity: e }).kind, 'drown', 'foes about change nothing in the water');
  assert.equal(exhaustionOutcome({ swimming: true, entity: { ...e, maxHealth: 7 } }).damage, 1, 'rounded up - never nothing');
  assert.equal(exhaustionOutcome({ swimming: true, entity: { ...e, maxHealth: 0 } }).damage, 1, 'never nothing');
  assert.equal(exhaustionOutcome({ enemiesNearby: false, swimming: false, entity: e }).kind, 'rest');
  // PIN MOVED (FIELD BUGS 2026-10-13e SPENT-ASHORE): foes about on dry feet no longer kill - the water's share, its own
  // line (test/systems/fb1013e_spentashore.test.js)
  const near = exhaustionOutcome({ enemiesNearby: true, swimming: false, entity: e });
  assert.deepEqual([near.kind, near.damage, near.line, near.inWater], ['spent', 10, EXHAUSTED_FIGHTING_LINE, false]);
});

test('SWIM-SPENT: a swimmer run out of fatigue on the real ticker lives through the first drain, drowns only in the water\'s own time - some fifty real seconds from full health - and at the shore rests instead', () => {
  setSharedClock(null); setWorldMinutes(NOON); resetMagicRoundMarker(NOON);
  const e = swimmer({ fatigue: 0 });
  e.lastGameMinutes = NOON;
  const swimming = true;
  const collapses = [];
  const lines = [];
  const ticker = createPlayerTicker(e, {
    isInside: () => false,
    onExhausted: () => {   // scenes/world.js onExhaustedExterior's three arms
      const out = exhaustionOutcome({ enemiesNearby: false, swimming, entity: e, day: true, inside: false });
      collapses.push(out.kind);
      if (out.kind === 'drown') { lines.push(out.line); hurtPlayer(e, out.damage, { bypassShield: true }); return; }
      hurtPlayer(e, e.health, { bypassShield: true });   // the old water arm - never reached here while the law drowns
    },
  });
  const dt = 1 / 30;
  let t = 0;
  const run = (seconds) => { for (const end = t + seconds; t < end && e.health > 0; t += dt) ticker.tick(dt, { running: false, runningTally: false, swimming, climbing: false, jumped: false, standing: true }); };
  run(6);
  assert.equal(collapses[0], 'drown', 'the first drain to nothing in the water');
  assert.ok(e.health > 0 && e.health < 100, `alive after it (${e.health})`);
  assert.equal(lines[0], EXHAUSTED_SWIMMING_LINE, 'and told to get out');
  run(120);
  assert.equal(e.health <= 0, true, 'staying in the water drowns');
  assert.ok(t >= 40 && t <= 70, `in the water's own time from full health: ${t.toFixed(1)} s`);
  assert.ok(collapses.every((k) => k === 'drown'));

  // the shore: a second swimmer who makes it out after twenty seconds rests there, and loses no more
  setWorldMinutes(NOON); resetMagicRoundMarker(NOON);
  const s = swimmer({ fatigue: 0 });
  s.lastGameMinutes = NOON;
  let wet = true;
  const kinds = [];
  let inExhaustion = false;   // world.js's _inExhaustion: the rest hour's own minutes re-enter no collapse
  const tk = createPlayerTicker(s, {
    isInside: () => false,
    onExhausted: () => {
      if (inExhaustion) return;
      inExhaustion = true;
      try {
        const out = exhaustionOutcome({ enemiesNearby: false, swimming: wet, entity: s, day: true, inside: false });
        kinds.push(out.kind);
        if (out.kind === 'drown') { hurtPlayer(s, out.damage, { bypassShield: true }); return; }
        if (out.kind === 'rest') { tk.advance(60); s.fatigue = Math.min(maxFatigue(s), s.fatigue + out.fatigue); }
      } finally { inExhaustion = false; }
    },
  });
  for (let u = 0; u < 20; u += dt) tk.tick(dt, { running: false, runningTally: false, swimming: true, climbing: false, jumped: false, standing: true });
  const ashore = s.health;
  assert.ok(ashore > 0, `alive at the shore (${ashore})`);
  wet = false;
  for (let u = 0; u < 20; u += dt) tk.tick(dt, { running: true, runningTally: true, swimming: false, climbing: false, jumped: false, standing: false });
  assert.ok(s.health >= ashore, 'no drowning on dry feet');
  assert.ok(s.fatigue > 0, 'the collapse there rests the hour');
  assert.equal(kinds.at(-1), 'rest');
});

test('SWIM-SPENT: the three hosts a swimmer can collapse in take the drown arm first - a line, the share, no box, no death heard by Come Sail Away - and the watery-grave box is gone from them', () => {
  const W = hostText('src/scenes/world.js'), X = rd('src/scenes/exterior.js'), D = rd('src/scenes/dungeonContext.js');
  const arm = /if \(out\.kind === 'drown'\) \{ townTalk\.say\(out\.line\); hurtPlayer\(playerEntity, out\.damage, \{ bypassShield: true \}\); return; \}/;
  for (const [name, src] of [['world.js', W], ['exterior.js', X]]) {
    const fn = src.slice(src.indexOf('function onExhaustedExterior()'), src.indexOf('function onExhaustedExterior()') + 4000);
    assert.match(fn, arm, `${name}: the drown arm`);
    assert.ok(fn.search(arm) < fn.indexOf("['You collapse from exhaustion.']"), `${name}: before the box`);
    assert.doesNotMatch(src, /EXHAUSTED_IN_WATER/, `${name}: no watery grave`);
  }
  const wfn = W.slice(W.indexOf('function onExhaustedExterior()'), W.indexOf('function onExhaustedExterior()') + 4000);
  assert.ok(wfn.search(arm) < wfn.indexOf('csaRuntime.OnPlayerDeath()'), 'world.js: Come Sail Away hears no death of a swimmer still swimming');
  const dfn = D.slice(D.indexOf('  function onExhausted() {'), D.indexOf('  function onExhausted() {') + 3000);
  const darm = /if \(out\.kind === 'drown'\) \{ hudText\.add\(out\.line\); hurtEntity\(playerEntity, out\.damage, \{ bypassShield: true \}\); surfacePlayer\(\); return; \}/;
  assert.match(dfn, darm, 'dungeonContext.js: the drown arm');
  assert.ok(dfn.search(darm) < dfn.indexOf('opts.csaOnPlayerDeath?.()'), 'dungeonContext.js: before the death is heard');
  assert.doesNotMatch(D, /EXHAUSTED_IN_WATER/, 'dungeonContext.js: no watery grave');
});
