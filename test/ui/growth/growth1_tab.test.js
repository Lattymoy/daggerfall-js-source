// GROWTH (2026-10-17, the owner: "properly give the specialization its own UI for ease of player use and proper
// descriptions instead of keeping players guessing" and "instead of having ascend in one place and the firmament trees in
// another (including the new naval tree), I want to give the firmament, level up page, and specializations its own tab
// within the pause menu"; asked: "Growth", the skies "drawn in the tab", the old doors moved, the classic skin let in;
// bible/10-UI/Growth.md). Pinned here:
//   GROWTH1  the tab (PAUSE_TABS after Stats), its rail and its landings, what waits on each page, the moved doors
//   GROWTH2  the Specialisations guide - every path's state on this character, what opens it, what it does, its Choose
//   GROWTH3  the stage - a face kept across the window's redraws, full screen, a phone's door, the tab's Escape; the
//            three windows' `embed` modes (by source - the browser probe tools/growthProbe.mjs drives them for real)
//   GROWTH4  the classic sheet's rows open the guide; the one ask's words name the Growth tab on the enhanced skin
// The pure law first; the pause window driven over the fake document last (its globals stand for the rest of the file).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { playerEntity } from '../../../src/characters/playerEntity.js';
import { createCharacter } from '../../../src/systems/chargen.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { masterSkill } from '../../../src/systems/masterSkills.js';
import * as AP from '../../../src/systems/arcanePaths.js';
import * as MP from '../../../src/systems/martialPaths.js';
import { specGuideModel, skillStand, skillStandText, spellLines, techniqueLines, stateTag, SPEC_STATES } from '../../../src/ui/growth/specGuide.js';
import { GROWTH_PAGE_SECTIONS, growthPageAt, SPEC_LANDINGS } from '../../../src/ui/growth/growthPages.js';
import { growthSections, growthDue, resetGrowthTab, growthSection, setGrowthSection } from '../../../src/ui/growth/growthTab.js';
import { drawStage, dropStage, stageBack, stageLive, stageFace } from '../../../src/ui/growth/growthStage.js';
import { _resetForTests } from '../../../src/systems/uiPrefs.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const { LongBlade: LB, ShortBlade: SB, Archery: AR, Axe: AX, Destruction: DES, Restoration: RES, Alteration: ALT, Mysticism: MYS, Illusion: ILL } = SKILLS;

/** A made character of the given career groups, every skill at 30, then `raised` raised (and `mastered` mastered). */
function hero({ primary, major, minor, raised = {}, mastered = [] }) {
  const p = structuredClone(playerEntity);
  createCharacter(p, { name: 'Tester', hp: 12, primarySkills: primary, majorSkills: major, minorSkills: minor,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } }, -1, { rolls: () => 0.5 });
  p.career = { ...p.career, primarySkills: primary, majorSkills: major, minorSkills: minor };
  p._online = true; p.level = 20;
  p.skills = p.skills.map(() => 30);
  for (const s of mastered) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true, `master ${s}`); }
  for (const [s, v] of Object.entries(raised)) p.skills[s] = v;
  return p;
}
/** A spellsword: Long Blade, Archery and Destruction primary; Restoration, Alteration and Axe major; three minors. */
const spellsword = (o = {}) => hero({ primary: [LB, AR, DES], major: [RES, ALT, AX], minor: [MYS, ILL, SKILLS.Stealth], ...o });
const family = (m, id) => m.families.find((f) => f.id === id);

// ── GROWTH1: the tab and its rail ───────────────────────────────────────────────────────────────────────────────────

test('GROWTH1 THE TAB: Growth stands after Stats in the window\'s one list; a landing names it, a page of it, or a family\'s guide - each a Growth landing, no other tab\'s (mutants: the tab left out; a family landing unread; the leaf drifting from the tab)', () => {
  const menu = rd('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /const PAUSE_TABS = Object\.freeze\(\[\['quests', 'Quests'\], \['stats', 'Stats'\], \['growth', 'Growth'\], \['holdings', 'Holdings'\],/);
  assert.match(menu, /growth: pauseGrowth,/);
  assert.match(menu, /else if \(growthPageAt\(at\)\) pauseTab = 'growth';/);
  assert.match(menu, /resetGrowthTab\(at\);/);
  assert.deepEqual(GROWTH_PAGE_SECTIONS.map(([id]) => id), ['level', 'specs', 'firmament', 'captain']);
  for (const at of ['growth', 'level', 'specs', 'firmament', 'captain', 'specs:arcane', 'specs:martial']) assert.equal(growthPageAt(at), true, at);
  for (const at of ['stats', 'holdings', 'family', null, undefined, 'specs:nope']) assert.equal(growthPageAt(at), false, String(at));
  assert.deepEqual(SPEC_LANDINGS, { 'specs:arcane': 'arcane', 'specs:martial': 'martial' });
  resetGrowthTab('specs:martial'); assert.equal(growthSection(), 'specs');
  resetGrowthTab('captain'); assert.equal(growthSection(), 'captain');
  resetGrowthTab(null); assert.equal(growthSection(), 'level', 'a bare landing: the Level page');
  setGrowthSection('firmament'); assert.equal(growthSection(), 'firmament');
  setGrowthSection('nope'); assert.equal(growthSection(), 'firmament', 'no such page: it stays');
  // the boot door reads the LEAF, never the tab (whose guide reads the spellbook's chunk)
  assert.match(rd('src/ui/pauseDoor.js'), /import \{ growthPageAt \} from '\.\/growth\/growthPages\.js';/);
  assert.doesNotMatch(rd('src/ui/pauseDoor.js'), /growth\/growthTab\.js/);
});

test('GROWTH1 THE RAIL: the Captain\'s Stars where the host hands a captain\'s sky over (else three pages); what waits - a level owed, the paths open, the captain\'s points unspent (mutants: the captain drawn for any host; a due page read off another\'s count)', () => {
  assert.deepEqual(growthSections({}).map(([id]) => id), ['level', 'specs', 'firmament']);
  assert.deepEqual(growthSections({ captain: { stars: () => ({}) } }).map(([id]) => id), ['level', 'specs', 'firmament', 'captain']);
  const e = spellsword({ mastered: [LB, AR] });
  e.readyToLevelUp = true;
  const due = growthDue({ entity: e, captain: { model: () => ({ stars: { points: 6, set: 2 } }) } });
  assert.deepEqual(due, { level: 1, specs: 1, firmament: 0, captain: 4 });
  e.readyToLevelUp = false;
  assert.deepEqual(growthDue({ entity: e }), { level: 0, specs: 1, firmament: 0, captain: 0 });
});

// ── GROWTH2: the guide's law ────────────────────────────────────────────────────────────────────────────────────────

test('GROWTH2 THE GUIDE: every path of both families, each in its state on THIS character - open (both mastered), ready (both at 100, one to master), within reach, closed (the family\'s other path held), never (a skill this class cannot master) - in that order, the nearest first (mutants: a state misread; the order the table\'s; the nearest last)', () => {
  // Long Blade and Archery mastered (primary: 2 of 2), Destruction primary unmastered - its slot gone; Restoration at 100
  const e = spellsword({ mastered: [LB, AR], raised: { [RES]: 100, [ALT]: 76, [AX]: 64 } });
  const m = specGuideModel(e);
  assert.equal(m.masterOn, true);
  const ma = family(m, 'martial');
  assert.equal(ma.paths.length, 15);
  assert.deepEqual(ma.paths.map((p) => p.state), [...ma.paths.map((p) => p.state)].sort((a, b) => SPEC_STATES.indexOf(a) - SPEC_STATES.indexOf(b)), 'in the states\' order');
  assert.equal(ma.paths[0].id, 'ranger'); assert.equal(ma.paths[0].state, 'open');
  assert.equal(ma.open, 1);
  const st = (f, id) => f.paths.find((p) => p.id === id).state;
  assert.equal(st(ma, 'woodsman'), 'reach', 'Axe (major, a slot left) and Archery (mastered)');
  assert.equal(st(ma, 'blademaster'), 'never', 'Short Blade is no skill of this class');
  const ar = family(m, 'arcane');
  assert.equal(st(ar, 'bloodmage'), 'never', 'Destruction is primary and the primary masteries are spent');
  assert.equal(st(ar, 'warden'), 'reach', 'Alteration and Restoration, both major, two major slots');
  // the nearest first: Warden (Restoration at 100, Alteration 76 - 24 owed) before Trickster (Alteration and Illusion - 94)
  const reach = ar.paths.filter((p) => p.state === 'reach').map((p) => p.id);
  assert.ok(reach.indexOf('warden') < reach.indexOf('trickster'), reach.join());
  // ready: both at 100, one still to master
  const r = spellsword({ mastered: [RES], raised: { [ALT]: 100 } });
  assert.equal(st(family(specGuideModel(r), 'arcane'), 'warden'), 'ready');
  // chosen, and the family's others closed; the other family untouched
  const c = spellsword({ mastered: [LB, AR] });
  assert.equal(MP.chooseMartialPath(c, 'ranger').ok, true);
  const cm = specGuideModel(c);
  assert.deepEqual([family(cm, 'martial').held.id, st(family(cm, 'martial'), 'ranger'), st(family(cm, 'martial'), 'woodsman')], ['ranger', 'chosen', 'closed']);
  assert.equal(family(cm, 'martial').paths[0].id, 'ranger', 'the chosen first');
  assert.equal(st(family(cm, 'arcane'), 'warden'), 'reach', 'the arcane family is its own');
  // Master Skills off: nothing opens - the guide says why (the state is reach, never open)
  const off = spellsword({ mastered: [LB, AR] });
  off._online = false; off.masterSkills = false;
  const om = specGuideModel(off);
  assert.equal(om.masterOn, false);
  assert.equal(st(family(om, 'martial'), 'ranger'), 'reach');
  assert.equal(family(om, 'martial').open, 0);
});

test('GROWTH2 WHAT OPENS IT: each skill of a pair in its own words - mastered, ready to master, its climb to 100, its group\'s masteries spent, or no skill of the class (mutants: a state\'s words swapped; the climb\'s count wrong)', () => {
  const e = spellsword({ mastered: [LB, AR], raised: { [RES]: 100, [ALT]: 76 } });
  const s = (id) => skillStand(e, id);
  assert.deepEqual([s(LB).state, s(RES).state, s(ALT).state, s(DES).state, s(SB).state], ['mastered', 'ready', 'climb', 'full', 'misc']);
  assert.equal(skillStandText(s(LB)), 'Long Blade: mastered (100)');
  assert.equal(skillStandText(s(RES)), 'Restoration: 100 - ready to master in Master Skills');
  assert.equal(skillStandText(s(ALT)), 'Alteration: 76 of 100, then master it');
  assert.equal(skillStandText(s(DES)), 'Destruction: your primary masteries are all chosen');
  assert.equal(skillStandText(s(SB)), 'Short Blade: not one of your class\'s skills, so it cannot be mastered');
  assert.deepEqual(['open', 'ready', 'reach', 'closed', 'never', 'chosen'].map(stateTag), ['Open to you', 'Master its skills', 'Within reach', 'Closed', 'Not for your class', 'Chosen']);
});

test('GROWTH2 WHAT IT DOES: the passive and the signature in the laws\' own words; a signature spell read as the spellbook reads it (its target, its element, each effect - no empty slot), a signature technique by each of its weapons (its cooldown, its fatigue) (mutants: an empty slot read; the forms\' numbers not the law\'s)', () => {
  const e = spellsword({ mastered: [LB, AR] });
  const m = specGuideModel(e);
  const ranger = family(m, 'martial').paths.find((p) => p.id === 'ranger');
  assert.deepEqual(ranger.passive, MP.MARTIAL_BY_ID.ranger.passive);
  assert.equal(ranger.signature.kind, 'technique');
  assert.equal(ranger.signature.name, MP.MARTIAL_BY_ID.ranger.technique.name);
  assert.equal(ranger.signature.text, `${MP.MARTIAL_BY_ID.ranger.technique.text} ${MP.MARTIAL_BY_ID.ranger.rider}`);
  const forms = MP.MARTIAL_BY_ID.ranger.forms;
  assert.deepEqual(techniqueLines(MP.MARTIAL_BY_ID.ranger), [
    `With Long Blade: ready again after ${MP.signatureById(forms.longBlade).cooldown} seconds, costs ${MP.signatureById(forms.longBlade).fatigue} fatigue.`,
    `With Archery: ready again after ${MP.signatureById(forms.archery).cooldown} seconds, costs ${MP.signatureById(forms.archery).fatigue} fatigue.`,
  ].sort((a, b) => techniqueLines(MP.MARTIAL_BY_ID.ranger).indexOf(a) - techniqueLines(MP.MARTIAL_BY_ID.ranger).indexOf(b)));
  const blood = family(m, 'arcane').paths.find((p) => p.id === 'bloodmage');
  assert.deepEqual([blood.signature.kind, blood.signature.name, blood.signature.text], ['spell', AP.PATH_BY_ID.bloodmage.spell.name, AP.PATH_BY_ID.bloodmage.rider]);
  const lines = spellLines('bloodmage');
  assert.equal(lines[0], 'Single target at range - Fire based');
  assert.equal(lines.length, 2, 'one effect: the maker\'s two empty slots read nothing');
  assert.match(lines[1], /^Damage Health\. Magnitude: 10 - 18 \+ 2 - 3 per 1 level\(s\)\.$/);
  assert.equal(spellLines('nope').length, 0);
});

test('GROWTH2 CHOOSE: an open path\'s Choose asks in the law\'s own box and commits through the law - permanent; a path not open has none (mutants: the ask the other family\'s; the choice not the law\'s)', () => {
  const e = spellsword({ mastered: [LB, AR, RES], raised: { [ALT]: 100 } });
  assert.equal(masterSkill(e, ALT).ok, true);
  const m = specGuideModel(e);
  const warden = family(m, 'arcane').paths.find((p) => p.id === 'warden');
  assert.equal(warden.state, 'open');
  assert.deepEqual(warden.ask(), AP.pathChoiceRows(e, 'warden'));
  const ranger = family(m, 'martial').paths.find((p) => p.id === 'ranger');
  assert.deepEqual(ranger.ask(), MP.martialChoiceRows(e, 'ranger'));
  assert.deepEqual(warden.choose(), { ok: true, text: 'Specialisation chosen: Warden.' });
  assert.equal(e.arcanePath, 'warden');
  assert.equal(family(specGuideModel(e), 'arcane').paths.find((p) => p.id === 'trickster').choose().ok, false, 'the law refuses a second');
});

// ── GROWTH3: the stage (pure: a made host) and the windows' embedding (by source) ───────────────────────────────────

/** The smallest host a stage needs: elements that hold children, a body to stand a full screen on. */
function fakeDoc() {
  const mk = (tag) => {
    const n = { tag, className: '', children: [], parentNode: null, textContent: '', onclick: null,
      append(...k) { for (const c of k) { if (typeof c === 'string') continue; c.parentNode?.children && (c.parentNode.children = c.parentNode.children.filter((x) => x !== c)); c.parentNode = n; n.children.push(c); } },
      click() { n.onclick?.(); },
      remove() { if (n.parentNode) n.parentNode.children = n.parentNode.children.filter((x) => x !== n); n.parentNode = null; },
      querySelector(sel) { const cls = sel.split(' ').pop().replace(/^\./, ''); const walk = (x) => { for (const c of x.children) { if (String(c.className).split(' ').includes(cls)) return c; const f = walk(c); if (f) return f; } return null; }; return walk(n); },
      get isConnected() { let x = n; while (x.parentNode) x = x.parentNode; return x === body; },
      get clientWidth() { return 800; },
    };
    return n;
  };
  const body = mk('body');
  return { mk, body, doc: { body, querySelector: (sel) => body.querySelector(sel) } };
}

test('GROWTH3 THE STAGE: a face is mounted ONCE a visit and its host moved into each new draw of its page (its canvas, view and pending stars with it); another page drops it; full screen moves the same host over the window and back; the tab\'s Escape asks the face, then leaves full screen (mutants: a mount per draw; the face left up on another page; Escape past the face\'s own)', async () => {
  const { mk, body, doc } = fakeDoc();
  const was = globalThis.document;
  globalThis.document = doc;
  const keptW = globalThis.innerWidth;
  globalThis.innerWidth = 1280;
  const el = (t, c, x) => { const n = mk(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
  const words = { el, full: 'Full screen', leave: 'Leave full screen', loading: 'Loading...', failed: 'Failed.' };
  try {
    let mounts = 0, backs = 0, destroyed = 0, sized = [];
    const face = { destroy: () => { destroyed++; }, resize: (refit) => sized.push(refit), back: () => backs++ === 0 };
    const mount = () => { mounts++; return face; };
    const d1 = el('div', 'px-qdetail'); body.append(d1);
    drawStage(d1, 'firmament', mount, words);
    await new Promise((r) => setTimeout(r, 0));
    const host = stageFace() === face ? d1.querySelector('.gr-stagehost') : null;
    assert.ok(host, 'mounted into its host, in the stage');
    d1.remove();
    const d2 = el('div', 'px-qdetail'); body.append(d2);
    drawStage(d2, 'firmament', mount, words);
    assert.equal(mounts, 1, 'mounted once a visit');
    assert.equal(d2.querySelector('.gr-stagehost'), host, 'the same host, moved into the new draw');
    assert.ok(sized.includes(true), 'its first true size refits its view');
    // full screen and back - the same host over the window, then in the stage again
    d2.querySelector('.gr-stagebar').children.find((c) => c.tag === 'button').onclick();
    assert.deepEqual(stageLive(), { key: 'firmament', full: true });
    assert.equal(body.querySelector('.gr-fullbox')?.children.includes(host), true);
    // the tab's Escape: the face's own first (its back() took it), then full screen left
    assert.equal(stageBack(), true); assert.equal(backs, 1); assert.equal(stageLive().full, true, 'the face took the press');
    assert.equal(stageBack(), true); assert.equal(stageLive().full, false, 'then full screen left');
    assert.equal(stageBack(), false, 'nothing of its own: the window goes on (resumes)');
    // another page drops it
    const d3 = el('div', 'px-qdetail'); body.append(d3);
    drawStage(d3, 'captain', () => ({ destroy: () => {} }), words);
    assert.equal(destroyed, 1, 'the Firmament taken down for the captain\'s sky');
    dropStage();
    assert.equal(stageLive(), null);
    // A PHONE'S STAGE IS THE SCREEN: a door, and the face over everything on its press
    globalThis.innerWidth = 360;
    const d4 = el('div', 'px-qdetail'); body.append(d4);
    drawStage(d4, 'level', () => ({ destroy: () => {} }), { ...words, open: 'Open', lead: 'A line.' });
    assert.equal(d4.querySelector('.gr-stage'), null, 'no stage in a phone\'s pane');
    d4.querySelector('.gr-stagecard').children.find((c) => c.tag === 'button').onclick();
    assert.deepEqual(stageLive(), { key: 'level', full: true });
    dropStage();
  } finally { globalThis.document = was; globalThis.innerWidth = keptW; dropStage(); }
});

test('GROWTH3 THE WINDOWS, EMBEDDED (by source; tools/growthProbe.mjs drives them): the Firmament, the captain\'s stars and the Ascension each draw at the stage\'s size with no overlay and no Escape of their own - the window\'s back stack asks back(); unaccepted stars asked about once; a stage between two draws hears no key (mutants: an embedded window\'s own Escape; its overlay registered; the deaf check dropped)', () => {
  const firm = rd('src/ui/firmamentWindow.js');
  assert.match(firm, /\.fmt-root\.fmt-embed \{ position: absolute; z-index: auto; \}/);
  assert.match(firm, /if \(embed\) \{ root\.classList\.add\('fmt-embed'\); root\.setAttribute\('aria-modal', 'false'\); exitBtn\.hidden = true; \}/);
  assert.match(firm, /if \(dead \|\| \(embed && !root\.isConnected\)\) return;/);
  assert.match(firm, /case 'Escape':\n\s*if \(embed\) \{ used = false; break; \}/);
  assert.match(firm, /let unregister = embed \? \(\) => \{\} : registerOverlay\(overlayClose\);/);
  assert.match(firm, /if \(unaccepted\(\) && !armedClose\) \{ armedClose = true; say\(UNACCEPTED_ESCAPE, true\); return true; \}/);
  const cap = rd('src/ui/captainTreeWindow.js');
  assert.match(cap, /case 'Escape': if \(embed\) \{ used = false; break; \} tryClose\(\); break;/);
  assert.match(cap, /if \(dead \|\| !unaccepted\(\) \|\| armedClose\) return false;/);
  const lv = rd('src/ui/enhanced/enhancedLevelUp.js');
  assert.match(lv, /if \(embed\) root\.classList\.add\('lv-embed'\);/);
  assert.match(lv, /if \(!embed\) unregister = registerOverlay\(closeArm\);/);
  assert.match(lv, /if \(embed \|\| overlayAction\(e\) !== 'back'\) return;/, 'Escape is the window\'s: a level left stays owed');
  // the window's back stack asks the face first, on the Growth tab with a face up
  assert.match(rd('src/ui/enhanced/enhancedMenu.js'), /: mode === 'pause' && pauseTab === 'growth' && stageLive\(\) \? \(\) => \{ if \(!growthBack\(\)\) onAction\('resume'\); \}/);
  // and a face up widens the window
  assert.match(rd('src/ui/enhanced/enhancedMenu.js'), /if \(pauseTab === 'growth' && stageLive\(\)\) win\.classList\.add\('px-win-wide'\);/);
});

// ── GROWTH4: the classic sheet's rows and the one ask's words ───────────────────────────────────────────────────────

test('GROWTH4 THE CLASSIC SHEET: where a document stands, its S and W rows open the Growth tab\'s guide on their family - the enhanced pause, pushed as the sheet\'s own child (its Resume back to the sheet); the rows stand whenever the class can meet a path (mutants: the rows only while a path is open; the family landing swapped; the guide on the host\'s slot)', async () => {
  const { CharSheet } = await import('../../../src/ui/charsheet.js');
  const e = spellsword({ raised: { [LB]: 64 } });
  const asked = [];
  const sheet = new CharSheet(e, { growth: (at) => { asked.push(at); return { done: false, tick() {}, draw() {} }; } });
  sheet.page = 1;
  sheet._pathRow = [0, 0, 10, 9]; sheet._martialRow = [0, 10, 10, 9];
  sheet.input('KeyS');
  assert.deepEqual(asked, ['specs:arcane']);
  assert.ok(sheet.child, 'pushed as the sheet\'s child');
  sheet.child = null;
  sheet.input('KeyW');
  assert.deepEqual(asked, ['specs:arcane', 'specs:martial']);
  const src = rd('src/ui/charsheet.js');
  assert.match(src, /: guide && pathPossible\(e\) \? t\('schools\.sheet\.guide', 'Specialisations  \(S\)'\) : null;/);
  assert.match(src, /: guide && martialPossible\(e\) \? t\('martial\.sheet\.guide', 'Martial paths  \(W\)'\) : null;/);
  const door = rd('src/ui/charSheetDoor.js');
  assert.match(door, /if \(typeof document !== 'undefined'\) hooks\.growth = \(at\) => openPauseFlow\(\(\) => \{\}, \{ \.\.\.\(deps\.pause\?\.\(\) \?\? \{\}\), at, onResume: \(\) => \{\} \}\);/);
  assert.match(rd('src/ui/pauseDoor.js'), /if \(growthPageAt\(hooks\.at\) && typeof document !== 'undefined'\) return enhancedPauseOverlay\(show, hooks\);/, 'on either skin');
});

test('GROWTH4 THE ONE ASK\'S WORDS: on the enhanced skin the No and the several-open box name the Growth tab; the classic skin\'s the skill screen, whose rows open the same guide (mutants: the skins\' words swapped)', () => {
  assert.equal(AP.pathDeclinedGrowthText(), 'You can choose a specialisation later on the Growth tab of the pause menu.');
  assert.equal(MP.martialDeclinedGrowthText(), 'You can choose a martial specialisation later on the Growth tab of the pause menu.');
  assert.equal(AP.pathsOpenRows([AP.PATH_BY_ID.warden], { growth: true }).at(-1), 'Read each and choose one on the Growth tab of the pause menu. The choice cannot be undone.');
  assert.equal(MP.martialOpenRows([MP.MARTIAL_BY_ID.ranger], { growth: true }).at(-1), 'Read each and choose one on the Growth tab of the pause menu. The choice cannot be undone.');
  assert.equal(MP.martialOpenRows([MP.MARTIAL_BY_ID.ranger]).at(-1), 'Choose one in your skill screen. The choice cannot be undone.');
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /\(\) => say\(isEnhanced\(\) \? pathDeclinedGrowthText\(\) : pathDeclinedText\(\)\)\);/);
  assert.match(shared, /\(\) => say\(isEnhanced\(\) \? martialDeclinedGrowthText\(\) : martialDeclinedText\(\)\)\);/);
  assert.match(shared, /ask\(pathsOpenRows\(open, \{ growth: isEnhanced\(\) \}\), null, null, \{ okOnly: true \}\);/);
  assert.match(shared, /ask\(martialOpenRows\(open, \{ growth: isEnhanced\(\) \}\), null, null, \{ okOnly: true \}\);/);
});

// ── the pause window, driven (LAST: the fake document's globals stand for the rest of the file) ─────────────────────

test('GROWTH THE WINDOW, DRIVEN: the Stats page\'s Growth door (its count) lands on the Growth tab; a family\'s landing opens its guide; a path\'s detail says what opens it, what it does and how it is used, and its Choose asks and chooses; Master Skills and the Captain page lead into the tab; no Ascend or Firmament button stands on the Stats page (mutants: the door\'s count; the detail\'s parts; the moved doors)', async () => {
  await import('../../chargenDom.mjs');
  _resetForTests();
  const { mountEnhancedMenu } = await import('../../../src/ui/enhanced/enhancedMenu.js');
  const { setHoldingsProvider } = await import('../../../src/ui/holdingsPages.js');
  const kept = { ...playerEntity };
  const restore = () => { for (const k of Object.keys(playerEntity)) if (!(k in kept)) delete playerEntity[k]; Object.assign(playerEntity, kept); };
  try {
    Object.assign(playerEntity, spellsword({ mastered: [LB, AR] }));
    const host = globalThis.document.createElement('div');
    const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: {}, onAction: () => {}, at: 'stats' });
    const btn = (text) => host.querySelectorAll('button').find((b) => b.textContent.startsWith(text));
    const rail = (text) => host.querySelectorAll('button').find((b) => String(b.className).includes('px-qrow') && b.textContent.includes(text));
    const tabOn = () => host.querySelectorAll('button').find((b) => b.className === 'on')?.textContent ?? '';
    try {
      assert.equal(btn('Ascend'), undefined, 'no Ascend on the Stats page');
      assert.equal(btn('Firmament'), undefined, 'no Firmament on the Stats page');
      assert.equal(btn('Growth')?.textContent, 'Growth (1)', 'the Growth door counts the path waiting');
      btn('Growth').onclick();
      assert.match(tabOn(), /Growth/);
      rail('Specialisations').onclick();
      const bar = host.querySelectorAll('button').find((b) => String(b.className).includes('gr-pathbar') && b.textContent.startsWith('Ranger'));
      bar.onclick();
      const detail = host.querySelectorAll('div').find((d) => String(d.className).includes('gr-detail'))?.textContent ?? '';
      for (const part of ['What opens it', 'Long Blade: mastered', 'Passive: Hunter\'s Instinct', 'Signature technique: Mark of the Hunt', 'With Archery: ready again after', 'Weapon Technique key']) assert.ok(detail.includes(part), part);
      btn('Choose Ranger').onclick();
      const ask = globalThis.document.body.querySelectorAll('div').find((d) => String(d.className).includes('px-master-ask'));
      assert.match(ask.textContent, /Martial specialisation: Ranger\?/);
      ask.querySelectorAll('button').find((b) => b.textContent === 'Yes').onclick();
      assert.equal(playerEntity.martialPath, 'ranger');
      // the Master Skills page's link into the guide
      host.querySelectorAll('button').find((b) => b.textContent.includes('Stats')).onclick();
      btn('Master Skills').onclick();
      btn('Specialisations').onclick();
      assert.match(tabOn(), /Growth/);
      assert.ok(host.querySelectorAll('div').some((d) => String(d.className).includes('gr-switch')), 'on the guide');
    } finally { menu.unmount(); }
    // a family's landing (the classic sheet's W) opens its guide; the Captain page's stars lead into the tab
    setHoldingsProvider({ captain: { model: () => ({ crowns: [], refusedAt: 0, marque: null, contracts: [], charts: [], log: [], stars: { level: 3, xp: 100, points: 2, next: 400, set: 0 } }), openStars: () => true, stars: () => ({ ledger: null }) } });
    const host2 = globalThis.document.createElement('div');
    const menu2 = mountEnhancedMenu(host2, { mode: 'pause', hooks: {}, onAction: () => {}, at: 'specs:arcane' });
    try {
      const fam = host2.querySelectorAll('button').find((b) => String(b.className).includes('gr-fam') && String(b.className).includes('on'));
      assert.match(fam.textContent, /^Arcane/, 'the S row\'s family');
      host2.querySelectorAll('button').find((b) => b.textContent.includes('Holdings')).onclick();
      host2.querySelectorAll('button').find((b) => String(b.className).includes('px-qrow') && b.textContent.includes('Captain')).onclick();
      host2.querySelectorAll('button').find((b) => b.textContent === 'Open the stars').onclick();
      const on = host2.querySelectorAll('button').find((b) => String(b.className).includes('px-qrow') && String(b.className).includes('on'));
      assert.match(on.textContent, /Captain's Stars/, 'the Growth tab\'s Captain\'s Stars');
    } finally { menu2.unmount(); setHoldingsProvider(null); }
  } finally { restore(); dropStage(); }
});
