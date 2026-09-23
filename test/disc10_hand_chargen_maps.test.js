// DISC10 (2026-09-23, Discord through Mac) - the third round of field
// reports, 01-Overview/Field-Bugs-2026-09-23.md. Pinned by execution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keydown, byClass, text, Node_ } from './chargenDom.mjs';
import { mountEnhancedChargen } from '../src/ui/enhancedChargen.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { SKILLS } from '../src/systems/skills.js';

const CAREER = { name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1, strength: 40, intelligence: 60, willpower: 72, agility: 48, endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy], majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging] };

function wizardAtName() {
  const flow = new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);
  flow.biogFor = () => ({ backstoryId: 0, questions: [{ text: ['Q1', ''], answers: [{ text: 'a', effects: [] }] }] });
  const host = new Node_('div');
  const exits = [];
  const view = mountEnhancedChargen(host, { flow, onExit: (w) => exits.push(w) });
  flow.input('confirm'); flow.input('confirm'); flow.input('char:m'); flow.input('confirm'); flow.input('confirm');
  if (flow.state === 'class' && flow.classConfirm) flow.applyHit({ confirmClass: true });
  if (flow.state === 'bioMethod') { flow.input('down'); flow.input('confirm'); }
  if (flow.state === 'biography') { flow.answerBiography(0); if (flow.biogRepBox) flow.input('confirm'); }
  view.repaint();
  return { flow, host, view, exits };
}

test('DISC10-B: Escape leaves the Name page with its box focused - the one stage the keyboard could not leave - to the biography method, as DFU\'s name window cancels with its TextBox focused; letters still type into the box, not the wizard (Discord: "once you reach name selection you can\'t go back to any previous step"; mutant: the field owns Escape)', () => {
  const { flow, host } = wizardAtName();
  assert.equal(flow.state, 'name');
  const box = byClass(host, 'namebox')[0];
  assert.equal(globalThis.document.activeElement, box, 'the name box holds the focus, as it does on every paint');
  const typed = keydown('q', box);
  assert.equal(typed.defaultPrevented, false, 'a letter is the field\'s');
  assert.equal(flow.state, 'name');
  const esc = keydown('Escape', box);
  assert.ok(esc.defaultPrevented && esc.stopped, 'the wizard used Escape, and kept it from the host');
  assert.equal(flow.state, 'bioMethod', 'Escape went back');
});

test('DISC10-B: BACK leaves every stage from Name on, and the rail is a readout that nothing presses (no handler, out of the tab order, no pointer)', () => {
  const { flow, host } = wizardAtName();
  for (const b of byClass(host, 'railbtn')) {
    assert.ok(!b.onclick && !(b.listeners.click?.length), `${text(b)}: no handler`);
    assert.equal(b.tabIndex, -1); assert.equal(b.getAttribute('aria-disabled'), 'true');
  }
  const back = byClass(host, 'actionbar')[0].children.find((c) => text(c) === 'Back');
  back.click();
  assert.equal(flow.state, 'bioMethod');
});

test('DISC10-B: Escape on the FIRST stage cancels the wizard, as its Cancel button does (mutant: the view reads done only)', () => {
  const flow = new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);
  const host = new Node_('div');
  const exits = [];
  mountEnhancedChargen(host, { flow, onExit: (w) => exits.push(w) });
  assert.equal(flow.state, 'race');
  keydown('Escape', globalThis.document.body);
  assert.deepEqual(exits, ['cancel']);
});
