// U-cancel slice (AUDIT 23 ui-chargen-4): backing out of the RACE
// screen - the wizard's first - cancels the whole wizard, exactly
// RaceSelectWindow_OnClose's Cancelled arm (DaggerfallStartNewGame-
// Wizard.cs:299-302): the race template nulls and nothing re-pushes,
// unwinding the UI stack to the start screen. The flow FLAGS the
// cancel; the window fires onCancel once; the hosts own the unwind
// (a reload to the boot flow's front door).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChargenFlow } from '../src/ui/chargen.js';
import { createChargenWindow } from '../src/systems/chargenSession.js';
import { SKILLS } from '../src/systems/skills.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const career = {
  name: 'Warrior', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
  strength: 60, intelligence: 40, willpower: 45, agility: 55,
  endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};
const mkFlow = () => new ChargenFlow([{ name: 'Warrior', career }], seq(0));

test('ui-chargen-4: back on the race screen CANCELS the wizard; deeper backs only walk', () => {
  // the first screen's back = the wizard cancel
  const f = mkFlow();
  assert.equal(f.state, 'race');
  f.input('back');
  assert.equal(f.cancelled, true, 'RaceSelectWindow_OnClose Cancelled (:299-302)');
  assert.ok(!f.done, 'a cancelled wizard is never done');
  // walking BACK from gender lands on race NOT cancelled - only the
  // next back cancels (DFU: gender cancel re-pushes the race select)
  const g = mkFlow();
  g.input('confirm');   // race -> the confirm box or gender
  if (g.raceConfirm) g.input('confirm');
  assert.equal(g.state, 'gender');
  g.input('back');
  assert.equal(g.state, 'race');
  assert.ok(!g.cancelled, 'the walk-back is not the cancel');
  g.input('back');
  assert.equal(g.cancelled, true);
  // the race DESCRIPTION box's No only closes the box (the modal eats
  // the key) - never the wizard
  const h = mkFlow();
  h.raceConfirm = [['Breton', 0]];
  h.input('back');
  assert.equal(h.raceConfirm, null, 'No closes the box');
  assert.ok(!h.cancelled, 'the modal back never cancels the wizard');
});

test('ui-chargen-4: the window fires onCancel ONCE and goes dead, like onDone', () => {
  const f = mkFlow();
  let cancels = 0;
  let dones = 0;
  const w = createChargenWindow(f, { onDone: () => dones++, onCancel: () => cancels++ });
  w.input(null, { key: 'Escape' });
  assert.equal(cancels, 1, 'the race Escape cancelled through the window');
  assert.equal(dones, 0);
  // the modal contract: fired-once - further input is dead
  w.input(null, { key: 'Escape' });
  w.input(null, { key: 'Enter' });
  assert.equal(cancels, 1);
  assert.equal(dones, 0);
});

test('ui-chargen-4: every host owns the unwind - the reload arms', () => {
  // WAVE D: the dungeon host held the RAW flow and so had to POLL
  // `flow.cancelled` from tickOverlay. It holds the window now, like
  // the other two, and takes the unwind off the same onCancel latch -
  // which is also the only arm the enhanced skin can fire, since its
  // DOM view never reaches a host input seam at all.
  const dc = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  assert.ok(!dc.includes('chargenFlow?.cancelled'),
    'the poll is gone - the window owns the cancel');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    const s = readFileSync(join(root, host), 'utf8');
    assert.ok(s.includes('onCancel: () => location.reload()'), `${host} wires the window's onCancel`);
  }
});
