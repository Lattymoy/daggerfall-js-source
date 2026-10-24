// FIELD BUGS 2026-09-30 (TAVERN-DRINK) - #bug-reports, "Climates & Calories Bugs": "most people are disabling the mod
// because of these issues ... 2 - Drinking beverages at an inn/tavern does not fill your hydration. It is supposed to,
// and food works properly, it's only beverages."
//
// A meal snaps the hunger to fed (tavernEat); a drink took forty off a thirst that runs to a hundred and fifty, and its
// quarter hour climbed while it was drunk - a desert inn's juice read 150, 126.7, 103.3, 80, 56.7, four cups to leave the
// red. A Casual thirst loan is repaid only when the thirst leaves red, so it stayed owed through three paid drinks. A
// tavern drink quenches the thirst WHOLE now, whatever its kind; the drunk counter by kind and the quarter hour stand, and
// the host's quarter hour is the minute law's first sight of the met thirst - the loan comes back in the same pick.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { tavernMenu, tavernDrink, DRINK_ALCOHOL, DRINK_MINUTES, TAVERN_MENU_TEXT } from '../../../src/systems/survival/tavernMenu.js';
import { survivalOf, thirstStage, NEED, SURVIVAL_TEXT } from '../../../src/systems/survival/needs.js';
import { SURVIVAL_RULES } from '../../../src/systems/survival/difficulty.js';
import { SURVIVAL_PREF } from '../../../src/systems/survival/switch.js';
import { TavernWindow } from '../../../src/ui/tavernWindow.js';
import { mountEnhancedTavern } from '../../../src/ui/enhanced/enhancedTavern.js';
import { createPlayerTicker } from '../../../src/scenes/shared.js';
import { setWorldMinutes, ownMinutes } from '../../../src/systems/worldTick.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { withDom } from '../../invdrag.mjs';

afterEach(() => { _resetForTests(); setWorldMinutes(0); });

const STATS = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
/** The report's inn: the desert in Sun's Height, the afternoon, indoors. */
const INN_AT = 6 * 30 * 1440 + 13 * 60;
const INN = (minutes) => ({ climateIndex: CLIMATES.Desert, month: 6, hour: ((minutes % 1440) + 1440) % 1440 / 60, weather: 'sunny', insideBuilding: true });
/** A Casual traveller in from the sand, dehydrated, the pool 600 short - all of it the thirst's loan. */
const traveller = () => {
  const p = {
    isPlayer: true, name: 'Mac', level: 3, health: 30, maxHealth: 40, magicka: 10, maxMagicka: 20, fatigue: 6400 - 600, raceId: 2,
    stats: { ...STATS }, skills: 20, career: {}, skillUses: { [SKILLS.Medical]: 0 }, activeEffects: [], items: [],
    equip: { slots: new Array(27).fill(null) }, goldPieces: 100, rentedRooms: [], lastTimePlayerAteOrDrankAtTavern: 0,
  };
  const s = survivalOf(p, INN_AT);
  Object.assign(s, { thirst: NEED.THIRST_MAX, lastAte: INN_AT - 60, lastMinute: INN_AT, borrowed: { thirst: 600 }, loanPool: 6400 - 600 });
  return p;
};
/** The tavern's hooks on a real ticker: a pick's minutes run the needs on the host's clock, as worldModes' tavern does. */
const hooksOn = (p, said = []) => {
  const ticker = createPlayerTicker(p, { say: (t) => said.push(t), isInside: () => true, survivalEnv: () => INN(Math.floor(ownMinutes())) });
  return {
    rows: (id) => [{ text: `r${id}`, center: true }], now: () => Math.floor(ownMinutes()), mapId: () => 1, buildingKey: () => 2, buildingName: () => 'The Sand Lantern',
    quality: () => 10, bedCount: () => 2, freeRooms: () => false, skills: () => ({ mercantile: 50, personality: 50 }),
    heal: () => {}, rolls: () => 0.5, climateIndex: () => CLIMATES.Desert, advanceMinutes: (n) => ticker.advance(n), endurance: () => 50,
  };
};
const softDrink = () => tavernMenu({ climateIndex: CLIMATES.Desert, quality: 10, hour: 13 }).rows.find((r) => r.kind === 'drink' && r.strength === 0);

test('TAVERN-DRINK: the report - a dehydrated Casual traveller buys one soft drink at the classic window: the thirst is met, and the thirst\'s loan comes back in the same pick (mutants: the drink takes forty again; the drink quenches nothing; the quarter hour lost; the loan waits for an empty thirst; the classic pick passes no minute)', () => {
  _resetForTests(); setPref(SURVIVAL_PREF, 'casual'); setWorldMinutes(INN_AT);
  const p = traveller(); const said = [];
  const w = new TavernWindow({ entity: p, ...hooksOn(p, said), onTalk: () => {}, onClose: () => {} });
  w._food();
  const drink = softDrink();
  const out = w.flow.top.onPick(w.flow.top.picker.indexOf(drink.text));
  assert.equal(out[0].rows[0].text, TAVERN_MENU_TEXT.refreshed, 'poured and said');   // PIN MOVED (AUDIT C&C I6): a soft drink refreshes - "fortifies" was said over the milk
  assert.equal(p.goldPieces, 100 - drink.price, 'paid for');
  assert.equal(Math.floor(ownMinutes()), INN_AT + DRINK_MINUTES, 'the quarter hour stands');
  assert.equal(thirstStage(p.survival.thirst), 'fine', `one drink leaves the red and the thirst (${p.survival.thirst.toFixed(1)} after its quarter hour)`);
  assert.ok(p.survival.thirst < NEED.THIRSTY / 2, 'what is left is the quarter hour\'s own climb, from nothing');
  assert.equal(p.survival.borrowed, undefined, 'the thirst\'s loan is paid back');
  assert.ok(p.fatigue > 6400 - 64, `the pool is whole again, but for the jump's one classic fatigue minute (${p.fatigue})`);
  assert.ok(said.includes(SURVIVAL_TEXT.repaid), 'and the strength returning is said');
});

test('TAVERN-DRINK: every kind quenches whole - milk, ale, wine and spirit alike; the drunk counter by its alcohol and the quarter hour stand, and Hard\'s blackout is still past the endurance (mutants: only a soft drink quenches; the drink takes forty again; the drink quenches nothing; the quench drops the drink\'s count; the quarter hour lost)', () => {
  // PIN MOVED (AUDIT C&C I8): a drink counts its own alcohol, the mod's by its place in its list (DRINK_ALCOHOL), not a
  // kind the port guessed from its name - every alcohol the mod's lists pour, nought (the soft ones) to forty
  const alcohols = [...new Set(Object.values(DRINK_ALCOHOL).flat())].sort((a, b) => a - b);
  assert.deepEqual(alcohols, [0, 10, 12, 15, 20, 25, 30, 40]);
  for (const strength of alcohols) {
    const s = { thirst: NEED.THIRST_MAX, drunk: 5 };
    const r = tavernDrink(s, strength, { endurance: 50, rules: SURVIVAL_RULES.casual });
    assert.equal(s.thirst, 0, `${strength}: the thirst whole`);
    assert.equal(s.drunk, 5 + strength, `${strength}: counted by its alcohol`);
    assert.equal(r.minutes, DRINK_MINUTES, `${strength}: a quarter hour`);
  }
  const s = { thirst: 60, drunk: 20 };
  const r = tavernDrink(s, 40, { endurance: 50, rules: SURVIVAL_RULES.hard });
  assert.deepEqual([s.thirst, s.drunk, r.blackout], [0, 60, true], 'Hard: a Nereid Wine past the endurance quenches and blacks out');
  const dry = { thirst: 0, drunk: 0 };
  tavernDrink(dry, 0);
  assert.equal(dry.thirst, 0, 'no thirst stays no thirst');
});

test('TAVERN-DRINK: the enhanced window pours the same law - one ale from Dehydrated leaves the thirst fine and repays the loan in the pick (mutants: the drink takes forty again; only a soft drink quenches; the drink quenches nothing; the quench drops the drink\'s count; the loan waits for an empty thirst; the enhanced pick passes no minute)', () => {
  _resetForTests(); setPref(SURVIVAL_PREF, 'casual'); setWorldMinutes(INN_AT);
  const hadLoc = Object.hasOwn(globalThis, 'location'), loc = globalThis.location;
  globalThis.location = { search: '?skin=classic' };
  try {
    withDom((dom) => {
      const p = traveller();
      const host = dom.mk('div'); dom.body.append(host);
      const view = mountEnhancedTavern(host, { entity: p, ...hooksOn(p), onExit: () => {} });
      const text = (n) => (n.textContent || '') + n.children.map(text).join(' ');
      dom.doc.querySelectorAll('.tavern-act').find((b) => b.textContent === 'Food & drink').onclick();
      const ale = tavernMenu({ climateIndex: CLIMATES.Desert, quality: 10, hour: 13 }).rows.find((r) => r.kind === 'drink' && r.strength === 10);   // PIN MOVED (AUDIT C&C I8): the South's Beer, alcoMid's 10
      dom.doc.querySelectorAll('.tavern-row').find((r) => text(r).includes(ale.name)).onclick();
      assert.ok(p.survival.drunk > 0 && p.survival.drunk <= 10, `the ale counted (${p.survival.drunk} - its quarter hour sobers a point a ten minutes)`);
      assert.equal(thirstStage(p.survival.thirst), 'fine', 'and quenched whole');
      assert.equal(p.survival.borrowed, undefined, 'the loan back in the same pick');
      view?.unmount?.();
    });
  } finally {
    if (hadLoc) globalThis.location = loc; else delete globalThis.location;
  }
});
