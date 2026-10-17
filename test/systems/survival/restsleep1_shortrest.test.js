// REST-SLEEP1 (2026-10-04, from play: "Seems like if you have to wait for night to pass you cannot rest again to remove
// the tiredness/drowsy debuffs until the time passes"; bible/06-Systems/Rest-Arc.md, As built "REST-SLEEP1"). Inside
// the night interval a rest is a short rest, and it paid nothing of the sleep need - the need has no other payer, so a
// night that left its sleeper Tired or Drowsy (a foe's break in the first hour still stamps the interval; a rough
// night pays a third of a bed's rate; a debt past the twelve hours a night pays) kept the penalties for the whole ten
// real minutes, at the fire. A short rest now pays the debt as a night of its kind would, through the minute law's own
// pay, the tier's rough floor kept - and still moves no clock.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { sleepShortRest, stampNight, NIGHT_MINUTES, REST_ACT_TEXT } from '../../../src/systems/rest/restAct.js';
import { paySleep, sleepStage, survivalStatMods, NEED } from '../../../src/systems/survival/needs.js';
import { REST_KIND } from '../../../src/systems/survival/rest.js';
import { SURVIVAL_RULES, SURVIVAL_STORED, HARD_RULES } from '../../../src/systems/survival/difficulty.js';
import { SURVIVAL_PREF } from '../../../src/systems/survival/switch.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { setSharedClock, ownMinutes, advanceOwnMinutes, setOwnMinutes } from '../../../src/systems/worldTick.js';

const CASUAL_RULES = SURVIVAL_RULES.casual;
afterEach(() => { setSharedClock(null); _resetForTests(); });

const record = (sleepDebt, awakeSince = 0) => ({ sleepDebt, awakeSince, notes: {} });

test('REST-SLEEP1 the law: a short rest pays the sleep debt a night of its kind pays - twelve hours at a bed or a fire, four on rough ground, Hard\'s rough floor kept - and its sleeper is awake from now', () => {
  const debts = (kind, rules, from) => {
    const e = { survival: record(from) };
    assert.equal(sleepShortRest(e, kind, rules, 9_000), true);
    assert.equal(e.survival.awakeSince, 9_000, 'awake from the short rest\'s end');
    return e.survival.sleepDebt;
  };
  assert.deepEqual([
    debts(REST_KIND.Bed, CASUAL_RULES, 20), debts(REST_KIND.Camp, HARD_RULES, 20), debts(REST_KIND.Camp, CASUAL_RULES, 9),
    debts(REST_KIND.Rough, CASUAL_RULES, 9), debts(REST_KIND.Rough, HARD_RULES, 9), debts(REST_KIND.Rough, HARD_RULES, 5),
    debts(REST_KIND.Rough, HARD_RULES, 3),
  ], [8, 8, 0, 5, 5, 4, 0], 'a bed or a fire 1.5 an hour; rough 0.5; Hard\'s rough never below Tired (4), and never lifting a rested sleeper up to it');
});

test('REST-SLEEP1 the short rest pays what the minute law pays across a night: the same pay, made once', () => {
  for (const kind of [REST_KIND.Bed, REST_KIND.Camp, REST_KIND.Rough]) {
    for (const rules of [CASUAL_RULES, HARD_RULES]) {
      const walked = record(NEED.SLEEP_DEBT_MAX);
      for (let m = 1; m <= NIGHT_MINUTES; m++) paySleep(walked, kind, 1, 5_000 + m, rules);
      const once = { survival: record(NEED.SLEEP_DEBT_MAX) };
      sleepShortRest(once, kind, rules, 5_000 + NIGHT_MINUTES);
      assert.ok(Math.abs(once.survival.sleepDebt - walked.sleepDebt) < 1e-9, `${kind} under ${rules.id}: ${once.survival.sleepDebt} against ${walked.sleepDebt}`);
      assert.equal(once.survival.awakeSince, walked.awakeSince);
    }
  }
});

test('REST-SLEEP1 nothing to pay: the arc off, a vampire (no need for sleep - the minute law freezes the debt) and a body with no record are left as they are', () => {
  const off = { survival: record(9) };
  assert.equal(sleepShortRest(off, REST_KIND.Camp, null, 9_000), false);
  assert.deepEqual(off.survival, record(9));
  const vampire = { survival: record(9), activeEffects: [{ kind: 'racialOverride', racial: 'vampirism' }] };
  assert.equal(sleepShortRest(vampire, REST_KIND.Camp, CASUAL_RULES, 9_000), false);
  assert.deepEqual(vampire.survival, record(9));
  const bare = {};
  assert.equal(sleepShortRest(bare, REST_KIND.Camp, CASUAL_RULES, 9_000), false);
  assert.equal(bare.survival, undefined, 'no record minted for a body that owes nothing');
});

/** The rest bag a host composes, online, a night slept at `kind` ten real minutes ago or less - the interval running. */
async function insideTheInterval(kind, tier, sleepDebt) {
  const { createRestDeps } = await import('../../../src/scenes/shared.js');
  _resetForTests();
  setPref(SURVIVAL_PREF, SURVIVAL_STORED[tier]);
  setSharedClock(() => 5_000_000);
  setOwnMinutes(400_000);
  const e = {
    health: 20, maxHealth: 60, fatigue: 0, magicka: 0, maxMagicka: 30,
    stats: { endurance: 50, strength: 50, willpower: 50, agility: 50 }, skills: [], career: {}, activeEffects: [],
    survival: { ...record(sleepDebt, 400_000), lastAte: 400_000, thirst: 0, wet: 0, exposure: 0, drunk: 0 },
  };
  stampNight(e, ownMinutes() - 30);
  const deps = createRestDeps(e, { restPoint: () => ({ kind, where: 'fire' }), restKind: () => kind, advanceMinutes: (n) => advanceOwnMinutes(n), endLines: () => null });
  assert.equal(deps.restAct().night, false, 'the interval runs: the rest is a short one');
  return { e, deps };
}

test('REST-SLEEP1 through the host\'s own bag: Drowsy at a fire inside the interval, a short rest wakes them rested - the attributes given back - and still moves no clock', async () => {
  const { e, deps } = await insideTheInterval(REST_KIND.Camp, 'hard', 9);
  assert.equal(sleepStage(e.survival.sleepDebt), 'drowsy');
  assert.equal(survivalStatMods(e.survival, null, ownMinutes(), { rules: HARD_RULES }).strength, -5, 'Drowsy: five off every attribute');
  const mark = ownMinutes();
  deps.setResting(true);
  const r = deps.restShort();
  deps.setResting(false);
  assert.equal(ownMinutes(), mark, 'a short rest moves no clock');
  assert.equal(r.text, REST_ACT_TEXT.shortRest);
  assert.equal(e.health, 60, 'and heals, as it did');
  assert.equal(e.survival.sleepDebt, 0);
  assert.equal(e.survival.awakeSince, Math.floor(mark));
  assert.equal(survivalStatMods(e.survival, null, ownMinutes(), { rules: HARD_RULES }).strength, undefined, 'no penalty left to wait out');
});

test('REST-SLEEP1 through the host\'s own bag: the short rest pays as its kind - Hard\'s rough ground four hours down to its floor; with the arc off there is no need to pay', async () => {
  const rough = await insideTheInterval(REST_KIND.Rough, 'hard', 9);
  rough.deps.setResting(true); rough.deps.restShort(); rough.deps.setResting(false);
  assert.equal(rough.e.survival.sleepDebt, 5, 'four hours paid on the ground, Tired still - the Bedroll\'s price, kept');
  const off = await insideTheInterval(REST_KIND.Camp, 'off', 9);
  off.deps.setResting(true); off.deps.restShort(); off.deps.setResting(false);
  assert.equal(off.e.survival.sleepDebt, 9, 'the arc off: the need is nobody\'s');
});
