// EVENT-RULES (2026-10-25, the owner: "A lot of people are unhappy with the world event restrictions including the regen
// not working"; asked, "Back, held in a fight" and "Resurrect allowed"): A WORLD EVENT'S RULES, SAID. The made levels
// (systems/madeLevel.js) hold regeneration now instead of turning it off, and the status widget's first tile says every
// rule the place holds - its name the place's, its tip the law's own table in plain words, its foot the regeneration's
// pause while it runs - and a Regenerate's own tip no longer promises what the place breaks.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { madeRulesLines, madeRulesTile, statusTip, ENTRY_WORDS, MADE_LEVEL_PLACE } from '../../../src/ui/hud/statusTips.js';
import { statusTiles } from '../../../src/ui/hud/hudStatus.js';
import { MADE_LEVELS, MADE_LEVEL_RULES } from '../../../src/systems/madeLevel.js';
import { setCourtRules, courtRulesHurt, regenPausedMs, REGEN_HELD_HURT_MS } from '../../../src/systems/courtRules.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('EVENT-RULES THE LAW: every made level holds regeneration (`held`) and none refuses a party member\'s Resurrect; the rest of each row stands (mutants: a level left off; a Resurrect refused again)', () => {
  for (const lv of MADE_LEVELS) {
    assert.equal(MADE_LEVEL_RULES[lv].regen, 'held', `${lv}: held, not off`);
    assert.equal(MADE_LEVEL_RULES[lv].resurrect, null, `${lv}: Resurrect allowed`);
    assert.equal(MADE_LEVEL_RULES[lv].save, 'refused', `${lv}: the saves still refused`);
  }
});

test('EVENT-RULES THE TILE: a made level\'s tile names its place and says the regeneration\'s pause at its foot while it runs; none outside a made level; it stands first on the widget, a warning, its own glyph (mutants: the foot always; the tile outside a level; a level unnamed)', () => {
  assert.equal(madeRulesTile(null), null);
  assert.equal(madeRulesTile('arena'), null, 'not a made level');
  assert.deepEqual(madeRulesTile('court', 0), { level: 'court', name: 'The Burning Court', foot: null });
  assert.deepEqual(madeRulesTile('hour', 3200), { level: 'hour', name: 'The Shattered Hour', foot: '4s' });
  for (const lv of MADE_LEVELS) assert.ok(MADE_LEVEL_PLACE[lv]().length > 3, `${lv} named`);
  const [first, ...rest] = statusTiles({ rules: madeRulesTile('spire', 1000), rested: { minutes: 5 } });
  assert.deepEqual([first.key, first.kind, first.glyph, first.name, first.foot, first.level], ['rules', 'warn', 'rules', 'The Spire', '1s', 'spire']);
  assert.equal(rest[0].key, 'rested', 'first, before the rest');
  assert.equal(statusTiles({}).some((t) => t.key === 'rules'), false);
  // the HUD reads the law itself - no host line hands it in
  const hud = read('src/ui/enhanced/enhancedHud.js');
  assert.match(hud, /const rules = madeRulesTile\(madeLevelHere\(\), regenPausedMs\(\)\);\n\s*if \(rules\) all\.unshift\(\.\.\.statusTiles\(\{ rules \}\)\);/);
});

test('EVENT-RULES THE TIP: every rule the level holds, said off its own row - the held regeneration, no saving or resting, the map, Mark and Recall, companions, the Spire\'s potions and flight, the death\'s way (a friend\'s Resurrect named), the purse spared; nothing for a rule a level leaves alone (mutants: a rule unsaid; a rule said of a level that leaves it; the Recall said in the court)', () => {
  const court = madeRulesLines('court'), hour = madeRulesLines('hour'), spire = madeRulesLines('spire'), ketch = madeRulesLines('ketch');
  const has = (lines, re) => lines.some((l) => re.test(l));
  for (const lines of [court, hour, spire, ketch]) {
    assert.ok(has(lines, new RegExp(`half strength, and not at all for ${REGEN_HELD_HURT_MS / 1000} seconds after you are hurt`)), 'the held regeneration');
    assert.ok(has(lines, /No saving and no resting/));
    assert.ok(has(lines, /No map/));
    assert.ok(has(lines, /Companions wait outside/));
  }
  assert.ok(has(court, /^Mark does not work here/), 'the court refuses the Mark alone');
  assert.ok(!has(court, /Recall/));
  assert.ok(has(hour, /Mark and Recall/));
  assert.ok(has(court, /casts you out before the gate/));
  assert.ok(has(hour, /final for this Abyss Dungeon - unless a party member raises you within 60 seconds/));   // PIN MOVED (AUDIT WORLD-EVENTS L1-5): the body's minute
  assert.ok(has(spire, /2 restoring potions a hall/));
  assert.ok(!has(hour, /potions/), 'the Hour counts none');
  assert.ok(has(spire, /No Levitate and no Slowfall/) && has(hour, /^No Levitate\.$/));
  assert.ok(has(spire, /weapon technique cannot carry you/) && !has(court, /technique/));
  assert.ok(has(ketch, /A death lays you down for 60 seconds: a party member can raise you there\. Past it, you fall\./) && has(spire, /lays you down for 60 seconds/));   // PIN MOVED (AUDIT WORLD-EVENTS L1-4): raise before the fall
  assert.ok(has(court, /^No \/unstuck\.$/) && has(spire, /^No \/unstuck\.$/) && has(hour, /way home/), 'AUDIT WORLD-EVENTS L5-14: the unstuck rule said');
  assert.ok(has(spire, /no gold/) && !has(court, /no gold/));
  assert.ok(has(spire, /Stendarr/) && !has(hour, /Stendarr/));
  assert.deepEqual(madeRulesLines(null), []);
  const tip = statusTip(statusTiles({ rules: madeRulesTile('court', 2000) })[0], null);
  assert.equal(tip.title, 'The Burning Court');
  assert.equal(tip.meta, 'Event rules');
  assert.deepEqual(tip.lines, court);
  assert.equal(tip.foot, 'Regeneration resumes in 2s');
  assert.equal(statusTip(statusTiles({ rules: madeRulesTile('court', 0) })[0], null).foot, null);
});

test('EVENT-RULES A REGENERATE\'S OWN TIP: "Restores health every round." outside a made level; inside one, held and said so - never a promise the place breaks (mutants: the promise kept inside)', () => {
  try {
    setCourtRules(false);
    assert.equal(ENTRY_WORDS.regenerate({}), 'Restores health every round.');
    setCourtRules(true, 0);
    assert.equal(ENTRY_WORDS.regenerate({}), `Restores health every round - held here: half, and none for ${REGEN_HELD_HURT_MS / 1000} seconds after you are hurt.`);
    setCourtRules(true, 10); courtRulesHurt({ before: 50, after: 40 });
    assert.equal(regenPausedMs(), REGEN_HELD_HURT_MS);
  } finally { setCourtRules(false); }
  assert.equal(regenPausedMs(), 0, 'off: no pause');
});
