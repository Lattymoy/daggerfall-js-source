// SKILL-TRADE's page (test/systems/skilltrade.test.js holds the law): the Growth tab's swap form over the fake document
// (test/chargenDom.mjs) - another group's class skills offered under Take instead with their group named, the trade's
// own ask and warnings, Yes doing it, and the family hint where only a trade opens a path.
import '../../chargenDom.mjs';
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { byClass } from '../../chargenDom.mjs';
import { drawSpecGuide, resetSpecGuide } from '../../../src/ui/growth/specGuide.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';
import { createCharacter } from '../../../src/systems/chargen.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { masterSkill } from '../../../src/systems/masterSkills.js';
import { SKILL_SWAP_GOLD } from '../../../src/systems/skillSwap.js';

const { Destruction: DE, Alteration: AL, Illusion: IL, Restoration: RE, Mysticism: MY, Thaumaturgy: TH, Climbing: CL, Medical: MD, Running: RU, Jumping: JU, Swimming: SW, Stealth: SE,
  LongBlade: LB, ShortBlade: SB, Axe: AX, BluntWeapon: BL, Archery: AR, HandToHand: HH, Etiquette: ET, Streetwise: ST, Mercantile: ME, Dodging: DO, Lockpicking: LP } = SKILLS;
function mage({ mastered = [], primary = [DE, AL, IL], major = [RE, MY, TH], minor = [CL, MD, RU, JU, SW, SE] } = {}) {
  const p = structuredClone(playerEntity);
  createCharacter(p, { name: 'Mage', hp: 8, primarySkills: primary, majorSkills: major, minorSkills: minor,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } }, -1, { rolls: () => 0.5 });
  p.career = { ...p.career, primarySkills: primary, majorSkills: major, minorSkills: minor };
  p._online = true; p.level = 20;
  p.skills = p.skills.map(() => 40);
  for (const s of mastered) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true); }
  p.goldPieces = SKILL_SWAP_GOLD; p.items = [];
  return p;
}
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
function page(entity) {
  const asked = [];
  const detail = el('div');
  const draw = () => { detail.replaceChildren?.(); drawSpecGuide(detail, draw, { el, divider: (x) => el('div', 'px-divider', x), askCard: (rows, yes) => asked.push({ rows, yes }), entity }); };
  draw();
  return { detail, asked };
}
const texts = (root, cls) => byClass(root, cls).map((n) => n.textContent);
const swapBox = (root) => byClass(root, 'gr-swap')[0];
const picks = (root) => swapBox(root).children.filter((n) => n.tagName === 'SELECT');
const pressSwap = (root) => byClass(swapBox(root), 'act').find((b) => /Swap/.test(b.textContent));

beforeEach(() => resetSpecGuide('arcane'));

test('SKILL-TRADE THE PICKS: Take instead offers the other groups\' unmastered class skills after the outsiders, each with its group, never the given-up skill\'s own group nor a mastered one; the lead says so (mutants: the trades not offered; the group unnamed)', () => {
  const { detail } = page(mage({ mastered: [TH] }));
  assert.ok(texts(detail, 'gr-lead').includes('You can also take an unmastered class skill from another group. The two skills change groups.'));
  const [out, inn] = picks(detail);
  assert.equal(out.children.find((o) => o.selected)?.value, String(DE));
  const names = inn.children.map((o) => o.textContent);
  assert.deepEqual(names.slice(-8), ['Restoration (Major)', 'Mysticism (Major)', 'Climbing (Minor)', 'Medical (Minor)', 'Running (Minor)', 'Jumping (Minor)', 'Swimming (Minor)', 'Stealth (Minor)']);
  assert.ok(!names.some((n) => /Alteration|Thaumaturgy/.test(n)));
  assert.ok(names.slice(0, 35 - 12).every((n) => !n.includes('(')), 'the outsiders first, as before');
});

test('SKILL-TRADE THE ASK: the trade asks first - the price, both groups, a spent group\'s warning for the skill that leaves - and Yes trades them and says so (mutants: the swap\'s ask on a trade; the slots\' warning dropped)', () => {
  const e = mage({ mastered: [MY, TH] });   // both major slots spent
  const { detail, asked } = page(e);
  const [, inn] = picks(detail);
  inn.value = String(RE); inn.onchange?.();
  pressSwap(detail).onclick();
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0].rows, [
    'Exchange Destruction and Restoration for 100,000 gold?',
    'Restoration becomes one of your primary skills, and Destruction one of your major skills. Both keep their values.',
    'Your major mastery slots are spent, so Destruction could never be mastered.',
  ]);
  asked[0].yes();
  assert.deepEqual([e.career.primarySkills, e.career.majorSkills], [[RE, AL, IL], [DE, MY, TH]]);
  assert.ok(texts(detail, 'px-master-note').includes('Restoration is now one of your primary skills, and Destruction one of your major skills.'));
});

test('SKILL-TRADE THE HINT: six weapon skills all minor (one slot) meet no martial path and no outsider is a weapon - one trade into another group opens one, so the hint is said (mutant: the hint blind to trades)', () => {
  resetSpecGuide('martial');
  const { detail } = page(mage({ primary: [ET, ST, ME], major: [DO, LP, CL], minor: [LB, SB, AX, BL, AR, HH] }));
  assert.match(texts(detail, 'gr-headline').join(' '), /Your class can't master two weapon skills/);
  assert.ok(texts(detail, 'gr-fine').includes('You can change one of your class skills for a weapon skill below.'));
});

/** The swap form's warnings for `out` given up and `inn` taken, offline with Master Skills off (DFU's 95 lock). */
function lockWarns(entity, out, inn) {
  const { detail } = page(entity);
  const [o] = picks(detail);
  o.value = String(out); o.onchange?.();
  const [, i] = picks(detail);
  i.value = String(inn); i.onchange?.();
  return texts(swapBox(detail), 'gr-swap-warn');
}

test('AUDIT SKILL-TRADE A1 THE LOCK\'S WORDS: a trade out of the primaries names the skill entering them at 100 and the one leaving - not `inn` and `out` as a swap does (mutant: the swap\'s words on a trade)', () => {
  const offline = (at100) => { const e = mage(); e._online = false; e.masterSkills = false; e.skills[at100] = 100; return e; };
  assert.deepEqual(lockWarns(offline(RE), RE, DE), ['With Master Skills off, Restoration at 100 as a primary skill holds your other skills at 95.']);
  assert.deepEqual(lockWarns(offline(DE), RE, DE), ['With Master Skills off, your other skills are no longer held at 95 once Destruction leaves your primary skills.']);
  assert.deepEqual(lockWarns(offline(RE), DE, RE), ['With Master Skills off, Restoration at 100 as a primary skill holds your other skills at 95.'], 'the trade the other way round says the same');
});

test('AUDIT SKILL-TRADE A3 A NEW START AFTER YES: a swap or trade done, both picks go back to the first of each list - the reverse trade is never left one Yes away (mutant: the picks kept)', () => {
  const e = mage();
  e.goldPieces = 2 * SKILL_SWAP_GOLD;
  const { detail, asked } = page(e);
  const [, inn] = picks(detail);
  inn.value = String(RE); inn.onchange?.();
  pressSwap(detail).onclick();
  asked[0].yes();
  const [o2, i2] = picks(detail);
  assert.equal(o2.children.find((o) => o.selected)?.value, String(e.career.primarySkills[0]));
  assert.equal(i2.children.find((o) => o.selected)?.value, i2.children[0].value);
  assert.ok(!i2.children[0].textContent.includes('('), 'the first outsider, not a trade');
});

test('AUDIT SKILL-TRADE C8: a major skill given up is offered the primaries, each named so (mutant: the primary label wrong)', () => {
  const { detail } = page(mage());
  const [o] = picks(detail);
  o.value = String(RE); o.onchange?.();
  const [, i] = picks(detail);
  assert.deepEqual(i.children.map((n) => n.textContent).filter((x) => x.includes('(Primary)')), ['Destruction (Primary)', 'Alteration (Primary)', 'Illusion (Primary)']);
});
