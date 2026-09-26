// CC-REP + CC-GRID + CC-STEP (2026-09-16, Ember on the Discord, relayed
// by Mac): "Class creation menu seems to be missing a reputation
// setting" - "the custom class building menu being in a list is a bit
// clunky ... having to scroll around to see all the options" - "the +
// and - symbols on the buttons seem a bit small".
//
// CC-REP: CreateCharReputationWindow was the one classic window the
// enhanced view did not draw (AUDIT 39 recorded it): its only door was
// a pixel hit on a 168x189 panel. The flow has a stepping door now -
// the same value law as a bar click - and the view draws the window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repStep, repClick, repPointsToDistribute, REP_GROUPS, REP_MAX } from '../src/systems/customClass.js';
import { ChargenFlow } from '../src/ui/chargen.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

test('CC-REP repStep: one integer step on one group, clamped to the bar\u2019s reach, negative zero normalised, an unknown group refused (mutant: the clamp or the group test dropped)', () => {
  const reps = { merchants: 0, peasants: 0, scholars: 0, nobility: 0, underworld: 0 };
  assert.equal(repStep(reps, 'merchants', 1), 1);
  assert.equal(repStep(reps, 'merchants', -1), -1);
  assert.equal(repStep({ ...reps, nobility: REP_MAX }, 'nobility', 1), REP_MAX, 'no higher than the bar');
  assert.equal(repStep({ ...reps, nobility: -REP_MAX }, 'nobility', -1), -REP_MAX, 'no lower than the bar');
  assert.ok(Object.is(repStep({ ...reps, scholars: 1 }, 'scholars', -1), 0), 'back to a plain zero, never -0 (the ledger is a C# short)');
  assert.equal(repStep(reps, 'guilds', 1), null, 'no such group');
  assert.equal(REP_MAX, 10, 'a 50px bar in 5px steps');
  // the same reach as the bar click: the top of the bar is +10
  assert.equal(repClick(10, 26).value, REP_MAX);
  assert.equal(repPointsToDistribute({ ...reps, merchants: 3, underworld: -1 }), -2, 'the ledger is the negated sum');
});

test('CC-REP the flow: the builder opens the window, steps move the ledger, the exit gate holds until it balances, the reopened window\u2019s stale zero is DFU\u2019s own quirk (mutant: the gate reads a fresh sum)', () => {
  const careers = Array.from({ length: 18 }, (_, i) => ({ name: `C${i}`, career: { name: `C${i}` } }));
  const f = new ChargenFlow(careers, () => 0);
  f.state = 'class';
  f.classListIndex = f.careers.length;
  f.useClass();
  assert.equal(f.state, 'customClass');
  const c = f.custom;
  assert.equal(f.applyHit({ customRep: true }), true);
  assert.equal(c.sub, 'rep', 'ReputationButton opens the window');
  assert.equal(c.repPoints, 0);
  f.applyHit({ repStep: { group: 'merchants', dir: 1 } });
  f.applyHit({ repStep: { group: 'merchants', dir: 1 } });
  assert.equal(c.reps.merchants, 2);
  assert.equal(c.repPoints, -2, 'two given, two to take');
  f.applyHit({ repExit: true });
  assert.equal(c.sub, 'rep', 'unbalanced: the window stays');
  assert.ok(c.box, 'and says so (TEXT.RSC 303)');
  c.box = null;
  f.applyHit({ repStep: { group: 'underworld', dir: -1 } });
  f.applyHit({ repStep: { group: 'peasants', dir: -1 } });
  assert.equal(c.repPoints, 0);
  f.applyHit({ repExit: true });
  assert.equal(c.sub, null, 'balanced: the window lets go');
  assert.deepEqual(c.reps, { merchants: 2, peasants: -1, scholars: 0, nobility: 0, underworld: -1 });
  f.applyHit({ repStep: { group: 'nowhere', dir: 1 } });
  assert.deepEqual(c.reps, { merchants: 2, peasants: -1, scholars: 0, nobility: 0, underworld: -1 }, 'an unknown group changes nothing');
  // DFU's quirk, kept: the reopened window's field is 0 until a bar is touched
  f.applyHit({ repStep: { group: 'scholars', dir: 1 } });   // (outside the window: still the same ledger)
  f.applyHit({ customRep: true });
  assert.equal(c.repPoints, 0, 'reopened: the stale field, not the sum');
  f.applyHit({ repExit: true });
  assert.equal(c.sub, null, 'and classic really does let you leave it unbalanced this way');
});

test('CC-REP/GRID/STEP by source: the view draws the window and presses the flow\u2019s doors alone; the builder is a two-column grid from 900px; the steppers carry a minus and a plus at the button\u2019s size (mutant: a door dropped, the view writing the ledger, the glyphs shrunk back)', () => {
  const view = rd('src/ui/enhancedChargen.js');
  assert.match(view, /if \(c\.sub === 'rep'\) return customRepPane\(c\);/, 'the window over the builder');
  const pane = view.slice(view.indexOf('function customRepPane(c)'), view.indexOf('function customClassStage()'));
  assert.match(pane, /flow\.applyHit\(\{ repStep: \{ group, dir \} \}\)/, 'a step presses the flow');
  assert.match(pane, /flow\.applyHit\(\{ repExit: true \}\)/, 'Done presses the exit gate');
  assert.match(pane, /for \(const group of REP_GROUPS\)/, 'five rows, the window\u2019s own groups');
  assert.doesNotMatch(pane, /c\.reps\[[^\]]*\]\s*=[^=]/, 'the view never writes the ledger');
  const builder = view.slice(view.indexOf('function customClassStage()'), view.indexOf('// ── HOW YOUR HISTORY'));
  assert.match(builder, /\['Reputations', repNote, \{ customRep: true \}\]/, 'the ReputationButton\u2019s row, with what the ledger says');
  assert.match(builder, /el\('div', 'skillpane builder'\)/, 'CC-GRID: the builder\u2019s own pane class');
  // RE-AIMED at UXB1-J: THREE columns now - the skills, the attributes, the class itself - which the 900px grid lays
  // out as two (the class under the attributes) and a desk as three (enhancedStyle.js, the UXB1-J block).
  assert.deepEqual(builder.match(/el\('div', 'builder-col b-\w+'\)/g), [
    "el('div', 'builder-col b-skills')", "el('div', 'builder-col b-attrs')", "el('div', 'builder-col b-class')"],
    'three columns: the skills, the attributes, the class');
  assert.match(builder, /box\.classList\.add\('span'\);/, 'the name spans both');
  assert.match(builder, /el\('div', 'acts span b-acts'\)/, 'and so do the acts');
  const css = rd('src/ui/enhancedStyle.js');
  assert.match(css, /@media \(min-width: 900px\) \{\n\s+\.skillpane\.builder \{ max-width: 1180px; display: grid; grid-template-columns: 1fr 1fr;/, 'two columns from 900px up');
  assert.match(css, /\.skillpane\.builder > \.span \{ grid-column: 1 \/ -1; \}/);
  assert.match(view, /for \(const \[dir, glyph\] of \[\[-1, '\\u2212'\], \[1, '\+'\]\]\)/, 'CC-STEP: a minus sign and a plus');
  assert.match(css, /\.step \{[^}]*font-size: 22px; line-height: 1;/, 'at the button\u2019s size');
  assert.match(css, /@media \(pointer: coarse\) \{[\s\S]*?\.step \{ font-size: 26px; \}/, 'and larger on the thumb-sized button');
  assert.match(rd('src/ui/chargen.js'), /if \(hit\.repStep\) \{[\s\S]*?repStep\(this\.custom\.reps, hit\.repStep\.group, hit\.repStep\.dir\)[\s\S]*?repPointsToDistribute\(this\.custom\.reps\)/, 'the flow\u2019s door updates the ledger as a bar click does');
});
