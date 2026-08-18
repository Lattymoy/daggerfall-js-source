// U2b: the verbatim pool rules + the flow (transitions, conservation,
// the pool-0 confirm gates, reroll).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statUp, statDown, skillUp, skillDown, ChargenFlow, MAX_STAT_VALUE } from '../src/ui/chargen.js';
import { SKILLS } from '../src/systems/skills.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const career = {
  name: 'Warrior', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
  strength: 60, intelligence: 40, willpower: 45, agility: 55,
  endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};

test('chargen ui: the four verbatim clamps', () => {
  assert.deepEqual(statUp(50, 3), { working: 51, pool: 2 });
  assert.deepEqual(statUp(MAX_STAT_VALUE, 3), { working: 100, pool: 3 });   // max 100
  assert.deepEqual(statUp(50, 0), { working: 50, pool: 0 });                // pool 0
  assert.deepEqual(statDown(52, 50, 1), { working: 51, pool: 2 });          // points return
  assert.deepEqual(statDown(50, 50, 1), { working: 50, pool: 1 });          // floor = rolled
  assert.deepEqual(skillUp(31, 6), { working: 32, pool: 5 });               // no upper clamp
  assert.deepEqual(skillUp(31, 0), { working: 31, pool: 0 });
  assert.deepEqual(skillDown(30, 28, 4), { working: 29, pool: 5 });
  assert.deepEqual(skillDown(28, 28, 4), { working: 28, pool: 4 });         // floor = rolled
});

test('chargen ui: the flow end to end, conservation, confirm gates', () => {
  const flow = new ChargenFlow([{ name: 'Warrior', career }], seq(0));
  for (const c of 'Mac') flow.input('char:' + c);
  flow.input('confirm');
  // S3c/U9: RACE and FACE now sit between name and class (classic
  // asks race first) - the port hardcoded Breton male face 0.
  assert.equal(flow.state, 'race');
  flow.input('down'); flow.input('down');      // Breton -> Nord
  assert.equal(flow.race.key, 'Nord');
  flow.input('confirm');
  assert.equal(flow.state, 'gender');
  flow.input('down');                          // toggles
  assert.equal(flow.gender, 'female');
  flow.input('confirm');
  assert.equal(flow.state, 'face');
  flow.input('up');                            // wraps to the last face
  assert.equal(flow.faceIndex, 9);
  flow.input('down');
  assert.equal(flow.faceIndex, 0);
  flow.input('down'); flow.input('down');
  assert.equal(flow.faceIndex, 2);
  flow.input('confirm');
  assert.equal(flow.state, 'class');
  flow.input('confirm');                       // class -> stats (rolled)
  assert.equal(flow.state, 'stats');
  const baseTotal = Object.values(flow.rolledStats).reduce((a, b) => a + b, 0);
  const pool0 = flow.statPool;
  assert.equal(pool0, 6);                      // seq(0) -> min pool
  flow.input('confirm');
  assert.equal(flow.state, 'stats');           // gated: pool unspent
  for (let i = 0; i < pool0; i++) flow.input('plus');
  assert.equal(flow.statPool, 0);
  const spentTotal = Object.values(flow.stats).reduce((a, b) => a + b, 0);
  assert.equal(spentTotal, baseTotal + pool0); // conservation
  flow.input('minus');                         // give one back at the cursor
  assert.equal(flow.statPool, 1);
  flow.input('plus');
  flow.input('confirm');
  assert.equal(flow.state, 'skills');
  flow.input('confirm');
  assert.equal(flow.state, 'skills');          // gated: three pools of 6
  // spend primary 6 on the cursor skill, then the other two groups
  for (let i = 0; i < 6; i++) flow.input('plus');
  assert.equal(flow.pools.primary, 0);
  assert.equal(flow.skills[SKILLS.LongBlade], flow.rolledSkills[SKILLS.LongBlade] + 6);
  // move to a major skill (cursor 3) and a minor (cursor 6)
  flow.input('down'); flow.input('down'); flow.input('down');
  for (let i = 0; i < 6; i++) flow.input('plus');
  flow.input('down'); flow.input('down'); flow.input('down');
  for (let i = 0; i < 6; i++) flow.input('plus');
  flow.input('confirm');
  assert.ok(flow.done);
  const r = flow.result();
  assert.equal(r.name, 'Mac');
  assert.equal(r.gender, 'female');
  assert.equal(r.race, 'Nord');
  assert.equal(r.raceId, 3, 'the Races enum is 1-based');
  assert.equal(r.faceIndex, 2);
  assert.equal(r.careerIndex, 0);
  assert.equal(Object.values(r.stats).reduce((a, b) => a + b, 0), baseTotal + pool0);
});

test('chargen ui: reroll replaces the working set on the active screen', () => {
  const flow = new ChargenFlow([{ name: 'W', career }], seq(0.999));
  // name -> race -> gender -> face -> class -> stats (S3c/U9 added
  // the race and face screens)
  for (const a of ['char:X', 'confirm', 'confirm', 'confirm', 'confirm', 'confirm']) flow.input(a);
  assert.equal(flow.state, 'stats');
  assert.equal(flow.statPool, 14);             // max pool at seq(0.999)
  flow.input('plus');
  flow.rolls = seq(0);                         // the next roll set
  flow.input('reroll');
  assert.equal(flow.statPool, 6);              // fresh roll, spent point gone
  assert.deepEqual(flow.stats, flow.rolledStats);
});
