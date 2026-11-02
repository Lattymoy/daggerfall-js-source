// FACE-NOTE (2026-10-26, the in-game verification pass): the Face step said "The portraits for this race could not be
// loaded" for every race's first load after a page load with Morrowind's data attached - the note stood while the heads
// were still being drawn, and a load that drew nothing showed the numbers WITHOUT it. The note now stands for a load
// that is over and drew nothing, and the Name step starts the load. Driven through the enhanced wizard on
// test/chargenDom.mjs's DOM, with the loader standing in for ui/facePortrait.js loadFaceCanvases (ten entries, null
// for a face it could not draw).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byClass, Node_ } from '../../chargenDom.mjs';
import { mountEnhancedChargen } from '../../../src/ui/enhanced/enhancedChargen.js';
import { ChargenFlow } from '../../../src/ui/chargen.js';
import { FACES_PER_RACE } from '../../../src/systems/races.js';
import { SKILLS } from '../../../src/systems/skills.js';

const CAREER = { name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1, strength: 40, intelligence: 60, willpower: 72, agility: 48, endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy], majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging] };

/** Let a settled load's `.then` / `.catch` run (and repaint). */
const settle = () => new Promise((resolve) => setImmediate(resolve));

/** The wizard mounted on `state` with `loadFaces`; the loader's calls are recorded. */
function wizardOn(state, loadFaces) {
  const flow = new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);
  flow.state = state;
  const calls = [];
  const loader = loadFaces && ((race, gender) => { calls.push(`${race}|${gender}`); return loadFaces(); });
  const host = new Node_('div');
  const view = mountEnhancedChargen(host, { flow, loadFaces: loader, onExit() {} });
  return { flow, host, view, calls };
}
const noteOf = (host) => byClass(host, 'mapnote').length;
const numbersOf = (host) => byClass(host, 'facenum').length;
const portraitsOf = (host) => byClass(host, 'facecell').filter((cell) => cell.querySelector('canvas')).length;

test('FACE-NOTE while the heads are loading the Face step shows the ten numbers and no note (mutant: the old empty-list test)', () => {
  const { host, view, calls } = wizardOn('face', () => new Promise(() => {}));
  assert.equal(calls.length, 1, 'the load started');
  assert.equal(noteOf(host), 0, 'no "could not be loaded" while loading');
  assert.equal(numbersOf(host), FACES_PER_RACE);
  view.unmount();
});

test('FACE-NOTE a load that is over and drew nothing - ten nulls, a rejected load, or no loader - shows the note (mutants: the note dropped; the catch arm left unpainted)', async () => {
  for (const [why, loadFaces] of [
    ['ten nulls', () => Promise.resolve(Array(FACES_PER_RACE).fill(null))],
    ['a rejected load', () => Promise.reject(new Error('no CIF'))],
    ['no loader', null],
  ]) {
    const { host, view } = wizardOn('face', loadFaces);
    await settle();
    assert.equal(noteOf(host), 1, why);
    assert.equal(numbersOf(host), FACES_PER_RACE, `${why}: every face still picks by its number`);
    view.unmount();
  }
});

test('FACE-NOTE a load that drew its heads shows them and no note; one face it could not draw keeps its number', async () => {
  const drawn = Array.from({ length: FACES_PER_RACE }, (_, i) => (i === 3 ? null : new Node_('canvas')));
  const { host, view } = wizardOn('face', () => Promise.resolve(drawn));
  await settle();
  assert.equal(noteOf(host), 0);
  assert.equal(portraitsOf(host), FACES_PER_RACE - 1);
  assert.equal(numbersOf(host), 1, 'the hole is kept in place');
  view.unmount();
});

test('FACE-NOTE the Name step starts the load for the chosen race and sex, so the Face step opens on drawn heads (mutant: the early load dropped)', async () => {
  const drawn = Array.from({ length: FACES_PER_RACE }, () => new Node_('canvas'));
  const { flow, host, view, calls } = wizardOn('name', () => Promise.resolve(drawn));
  assert.deepEqual(calls, [`${flow.race.key}|${flow.gender}`]);
  await settle();
  flow.state = 'face';
  view.repaint();
  assert.equal(calls.length, 1, 'loaded once, not again on the Face step');
  assert.equal(portraitsOf(host), FACES_PER_RACE);
  assert.equal(noteOf(host), 0);
  view.unmount();
});
