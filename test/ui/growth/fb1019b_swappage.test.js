// AUDIT SUGGESTIONS-1019 L6-1 (bible/01-Overview/audits/Audit-Suggestions-1019.md): SKILL-SWAP'S PAGE, DRAWN - the Growth
// tab's Specialisations page over the fake document (test/chargenDom.mjs) and the real guide (ui/growth/specGuide.js
// drawSpecGuide): the hint under a family's headline where one swap opens a path (L5-1), the form's two picks, its
// refusal standing beside a disabled press, its warnings (L5-1, L5-2) in the ask, and the ask's Yes doing the swap.
import '../../chargenDom.mjs';
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { byClass } from '../../chargenDom.mjs';
import { drawSpecGuide, resetSpecGuide } from '../../../src/ui/growth/specGuide.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';
import { createCharacter } from '../../../src/systems/chargen.js';
import { SKILLS, SKILL_NAMES } from '../../../src/systems/skills.js';
import { masterSkill } from '../../../src/systems/masterSkills.js';
import { SKILL_SWAP_GOLD } from '../../../src/systems/skillSwap.js';

const { BluntWeapon: BL, LongBlade: LB, Etiquette: ET, Streetwise: ST, Mercantile: ME, Dodging: DO, Lockpicking: LP, Climbing: CL, Medical: MD, Running: RU, Jumping: JU, Swimming: SW, Stealth: SE } = SKILLS;
function frank({ gold = SKILL_SWAP_GOLD, mastered = [BL], primary = [ET, ST, ME], major = [BL, DO, LP], minor = [CL, MD, RU, JU, SW, SE] } = {}) {
  const p = structuredClone(playerEntity);
  createCharacter(p, { name: 'Monk', hp: 12, primarySkills: primary, majorSkills: major, minorSkills: minor,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } }, -1, { rolls: () => 0.5 });
  p.career = { ...p.career, primarySkills: primary, majorSkills: major, minorSkills: minor };
  p._online = true; p.level = 30;
  p.skills = p.skills.map(() => 40);
  for (const s of mastered) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true); }
  p.goldPieces = gold; p.items = [];
  return p;
}
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
/** The page drawn for `entity` on its martial family, and what its ask was handed. */
function page(entity) {
  const asked = [];
  const detail = el('div');
  const draw = () => { detail.replaceChildren?.(); drawSpecGuide(detail, draw, { el, divider: (x) => el('div', 'px-divider', x), askCard: (rows, yes) => asked.push({ rows, yes }), entity }); };
  draw();
  return { detail, asked, redraw: draw };
}
const texts = (root, cls) => byClass(root, cls).map((n) => n.textContent);
const swapBox = (root) => byClass(root, 'gr-swap')[0];
const pressSwap = (root) => byClass(swapBox(root), 'act').find((b) => /Swap/.test(b.textContent));

beforeEach(() => resetSpecGuide('martial'));

test('AUDIT L6-1 THE PAGE: Brother Frank\'s martial family says under its headline that a class skill can be changed, and the form offers his unmastered class skills and the skills outside his class (mutants: the form never drawn; the hint dropped)', () => {
  const { detail } = page(frank());
  assert.ok(texts(detail, 'gr-fine').includes('You can change one of your class skills for a weapon skill below.'));
  const box = swapBox(detail);
  assert.ok(box, 'the form');
  const [out, inn] = box.children.filter((n) => n.tagName === 'SELECT');
  assert.ok(out.children.map((o) => o.textContent).includes(SKILL_NAMES[SE]));
  assert.ok(!out.children.map((o) => o.textContent).includes(SKILL_NAMES[BL]), 'never the mastered skill');
  assert.ok(inn.children.map((o) => o.textContent).includes(SKILL_NAMES[LB]));
});

test('AUDIT L6-1 THE REFUSAL: short of the gold the press stands disabled and the reason beside it; pressed, it asks nothing (mutants: the press enabled; the refusal unsaid; the press past its refusal)', () => {
  const { detail, asked } = page(frank({ gold: 10 }));
  const b = pressSwap(detail);
  assert.equal(b.disabled, true);
  assert.ok(texts(swapBox(detail), 'gr-reset-why').includes('Changing a class skill costs 100,000 gold. You have 10.'));
  b.onclick?.();
  assert.equal(asked.length, 0);
});

test('AUDIT L6-1 THE ASK: the press asks first - the price, the group the new skill joins, a spent group\'s warning - and Yes does the swap and says so (mutants: Yes doing nothing; the ask\'s group blank; the slots\' warning dropped)', () => {
  const e = frank({ mastered: [BL, DO] });   // both major slots spent
  const { detail, asked } = page(e);
  const [out, inn] = swapBox(detail).children.filter((n) => n.tagName === 'SELECT');
  out.value = String(LP); out.onchange?.();
  const after = swapBox(detail);
  const [, inn2] = after.children.filter((n) => n.tagName === 'SELECT');
  inn2.value = String(LB); inn2.onchange?.();
  void inn;
  pressSwap(detail).onclick();
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0].rows, [
    'Give up Lockpicking for Long Blade for 100,000 gold?',
    'Long Blade becomes one of your major skills. Lockpicking becomes a miscellaneous skill: it keeps its value but can no longer be mastered.',
    'Your major mastery slots are spent, so Long Blade could never be mastered.',
  ]);
  asked[0].yes();
  assert.ok(e.career.majorSkills.includes(LB));
  assert.ok(texts(detail, 'px-master-note').includes('Long Blade is now one of your major skills, in place of Lockpicking.'));
});

test('AUDIT L6-1: the picks are the page\'s own visit - another visit starts on the first of each list (mutant: the picks kept across visits)', () => {
  const e = frank();
  const { detail } = page(e);
  const [out] = swapBox(detail).children.filter((n) => n.tagName === 'SELECT');
  out.value = String(SE); out.onchange?.();
  resetSpecGuide('martial');
  const again = page(e);
  const [out2] = swapBox(again.detail).children.filter((n) => n.tagName === 'SELECT');
  assert.equal(out2.children.find((o) => o.selected)?.value, String(e.career.primarySkills[0]));
});

test('AUDIT L5-1 THE HINT\'S LAW: a class with no weapon skill and every mastery slot spent is told nothing - no swap can open a path for it (mutant: the hint on the class alone)', () => {
  const { detail } = page(frank({ primary: [ET, ST, ME], major: [CL, DO, LP], minor: [MD, RU, JU, SW, SE], mastered: [ET, ST, DO, LP, MD] }));
  assert.match(texts(detail, 'gr-headline').join(' '), /can't master two weapon skills/);
  assert.ok(!texts(detail, 'gr-fine').some((x) => /change one of your class skills/.test(x)));
});

test('SWAP-CYCLE THE GROUND, SAID: a swap that leaves the class\'s skills under the sum the level stands on says how many points they make up first - beside the picks and in the ask - and an even swap says nothing of it (mutant: the ground unsaid)', () => {
  const e = frank();
  e.skills[LB] = 6;
  const { detail, asked } = page(e);
  const pickPair = (out, inn) => {
    const [o] = swapBox(detail).children.filter((n) => n.tagName === 'SELECT');
    o.value = String(out); o.onchange?.();
    const [, i] = swapBox(detail).children.filter((n) => n.tagName === 'SELECT');
    i.value = String(inn); i.onchange?.();
  };
  const ground = 'Your level stays, but your class skills then earn nothing toward your next level until they make up 34 points.';
  pickPair(ET, LB);   // a primary at 40 for a skill at 6
  assert.ok(texts(swapBox(detail), 'gr-swap-warn').includes(ground));
  pressSwap(detail).onclick();
  assert.ok(asked[0].rows.includes(ground));
  e.skills[LB] = 40;
  pickPair(ET, LB);
  assert.ok(!texts(swapBox(detail), 'gr-swap-warn').some((x) => /make up/.test(x)), 'nothing given up: nothing said');
});
