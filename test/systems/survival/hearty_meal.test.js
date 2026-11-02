// HEARTY-MEAL (2026-10-23, the owner: "eating a meal in taverns should make you fed and not thirsty for a while (Well Fed
// buff etc)"): A TAVERN MEAL IS A SIT-DOWN MEAL - quenched at the table, and held fed and quenched for HEARTY_MEAL_MINUTES
// (survival/needs.js), the HUD's Well Fed tile counting its hours down (survival/status.js survivalHudChips).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSurvival, survivalMinute, hungerStage, hungerMinutes, thirstStage, heartyMeal, heartyMealHeld, heartyMealLeft, pauseSurvival, alignSurvival, HEARTY_MEAL_MINUTES, runSurvivalMinutes } from '../../../src/systems/survival/needs.js';
import { tavernEat, tavernOrder, TAVERN_MENU_TEXT, MEAL_MINUTES } from '../../../src/systems/survival/tavernMenu.js';
import { survivalHudChips, heartyMealWord, HEARTY_MEAL_GLYPH } from '../../../src/systems/survival/status.js';
import { SURVIVAL_RULES } from '../../../src/systems/survival/difficulty.js';
import { statusTip } from '../../../src/ui/hud/statusTips.js';

const body = (s) => ({ survival: s, items: [], fatigue: 100, maxFatigue: 100 });
const live = (e, from, to) => { for (let m = from; m < to; m++) survivalMinute(e, m, { air: 20 }, { autoDrink: false, autoEat: false }); };

test('HEARTY-MEAL: a tavern meal quenches the thirst and holds hunger Fed and thirst at nought for six hours; then both run again from there (mutants: no hold; the thirst left; the hold forever)', () => {
  assert.equal(HEARTY_MEAL_MINUTES, 360);
  const s = { ...newSurvival(0), lastAte: -700, thirst: 70 };
  const e = body(s);
  const r = tavernEat(s, 0, 240);
  assert.equal(r.ok, true);
  assert.equal(r.text, TAVERN_MENU_TEXT.invigorated);
  assert.equal(s.thirst, 0, 'the table pours with the meal');
  assert.equal(s.mealUntil, MEAL_MINUTES + HEARTY_MEAL_MINUTES, 'held from the meal\'s end');
  live(e, MEAL_MINUTES, MEAL_MINUTES + HEARTY_MEAL_MINUTES - 1);
  const held = MEAL_MINUTES + HEARTY_MEAL_MINUTES - 1;
  assert.equal(hungerStage(hungerMinutes(s, held)), 'fed', 'fed through the hold');
  assert.equal(s.thirst, 0, 'and never thirsty');
  assert.equal(heartyMealHeld(s, held), true);
  live(e, held, held + 200);
  assert.equal(heartyMealHeld(s, held + 200), false);
  assert.ok(s.thirst > 0, 'past the hold the thirst runs');
  assert.equal(hungerStage(hungerMinutes(s, held + 200)), 'fed', 'and the hunger leaves the hold fed - a meal\'s four hours from its end');
  live(e, held + 200, held + 300);
  assert.equal(hungerStage(hungerMinutes(s, held + 300)), 'peckish', 'and runs on from there');
});

test('HEARTY-MEAL: a wasted meal grants no hold; a full stomach under the hold is refused by a tier that will not waste one; a stood-still clock carries the hold and a clock run back clears it (mutants: the hold on the wasted meal; the pause not carried)', () => {
  const full = { ...newSurvival(0), lastAte: 990, thirst: 40 };
  assert.equal(tavernEat(full, 1000, 240).ok, false);
  assert.equal(heartyMealHeld(full, 1031), false, 'a meal gone to waste is no meal');
  const s = heartyMeal({ ...newSurvival(0), lastAte: 0 }, 100);
  assert.equal(heartyMealLeft(s, 160), HEARTY_MEAL_MINUTES - 60);
  survivalMinute(body(s), 101, { air: 20 }, { autoDrink: false, autoEat: false });
  assert.equal(tavernOrder(s, 102, { kind: 'food', worth: 240 }, { rules: SURVIVAL_RULES.casual }).ok, false, 'too full while the meal holds');
  const e = body(s);
  pauseSurvival(e, 200, 1200);
  assert.equal(s.mealUntil, 100 + HEARTY_MEAL_MINUTES + 1000, 'Off\'s pause carries it as it carries the hunger');
  alignSurvival(e, 10, 5000);
  assert.equal(heartyMealHeld(s, 10), false, 'a clock run back holds no meal');
});

test('HEARTY-MEAL: the HUD wears a Well Fed buff tile on the hunger\'s glyph with its hours left, in every tier, and in Boons it stands for the Well fed boon; its tip says what it holds (mutants: no tile; Boons alone; both Well fed tiles)', () => {
  assert.deepEqual([heartyMealWord(), HEARTY_MEAL_GLYPH], ['Well Fed', 'hunger']);
  for (const rules of [SURVIVAL_RULES.casual, SURVIVAL_RULES.hard ?? SURVIVAL_RULES.casual]) {
    const s = heartyMeal({ ...newSurvival(0), lastAte: 0 }, 0);
    const chips = survivalHudChips(body(s), 90, { rules });
    const meal = chips.find((c) => c.key === 'boon:meal');
    assert.deepEqual(meal && [meal.text, meal.level, meal.glyph, meal.foot], ['Well Fed', 'boon', 'hunger', '5h']);
  }
  const b = heartyMeal({ ...newSurvival(0), lastAte: 0, boons: ['fed', 'quenched'] }, 0);
  const boons = survivalHudChips(body(b), 30, { rules: SURVIVAL_RULES.boons }).map((c) => c.text);
  assert.deepEqual(boons, ['Well Fed', 'Quenched'], 'the meal stands for the fed boon, the quenched one kept');
  assert.deepEqual(survivalHudChips(body(heartyMeal({ ...newSurvival(0) }, 0)), 30, { vampire: true, rules: SURVIVAL_RULES.casual }).filter((c) => c.key === 'boon:meal'), [], 'a vampire eats nothing');
  const tip = statusTip({ key: 'need:boon:meal', kind: 'buff', name: 'Well Fed', foot: '5h' }, {});
  assert.equal(tip.meta, 'Boon');
  assert.match(tip.lines[0], /hearty tavern meal/);
  assert.equal(tip.foot, '5h left');
});

// AUDIT UPDATE (2026-10-25, bible/01-Overview/audits/Audit-Update-2026-10-25.md): lane E's laws of the hold
test('AUDIT UPDATE E3, E-N4, E-N5: a second meal never stacks the hold; no record holds longer than one meal; a journey past the replayed span still owes nothing for the hours the meal held (mutants: the holds summed; the record unbounded; the skipped hold lost)', () => {
  const s = { ...newSurvival(0) };
  heartyMeal(s, 100); heartyMeal(s, 200);
  assert.equal(s.mealUntil, 200 + HEARTY_MEAL_MINUTES, 'six hours from the last meal, never twelve');
  const f = { ...newSurvival(1000), mealUntil: 1e9 };
  alignSurvival(body(f), 1000, 990);
  assert.equal(f.mealUntil, 1000 + HEARTY_MEAL_MINUTES, 'a far hold (carried, or written) is one meal\'s');
  for (const days of [1, 3]) {
    const j = { ...newSurvival(0), lastAte: -800, thirst: 50 };
    const e = body(j);
    tavernEat(j, 0, 240);
    j.lastMinute = MEAL_MINUTES;
    const end = MEAL_MINUTES + days * 1440;
    runSurvivalMinutes(e, MEAL_MINUTES, end, { air: 20 }, { autoDrink: false, autoEat: false });
    assert.equal(hungerMinutes(j, end), end - (MEAL_MINUTES + HEARTY_MEAL_MINUTES - 11), `${days} day(s): hungry only from the hold's end, as a day replayed is`);
  }
});
