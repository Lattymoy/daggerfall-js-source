// U52 - THE ENHANCED CHARACTER SHEET, pinned.
//
// This one has REAL ARITHMETIC to hold, which the pause door did not.
// `sheetModel` is pure and separate for exactly that reason: the
// figures on the enhanced sheet must be the figures ui/charsheet.js
// DRAWS, and node can prove that without a canvas by evaluating the
// classic window's own expressions beside it. A sheet that quietly
// disagreed with the classic one about encumbrance would be a bug
// nobody could see without opening both.
//
// The DOM half is source sweeps, and says so; the child push/pop is
// driven for real in a browser by tools/enhancedSheetProbe.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { sheetModel, SKILL_GROUPS } from '../src/ui/enhancedCharSheet.js';
import { createCharSheetWindow, charSheetDoorReady } from '../src/ui/charSheetDoor.js';
import { carriedWeight } from '../src/ui/charsheet.js';
import { SKILL_NAMES } from '../src/systems/skills.js';
import { STAT_KEYS_ORDER } from '../src/systems/chargen.js';
import { liveStat, maxFatigue, FATIGUE_MULTIPLIER } from '../src/systems/statMods.js';
import { maxEncumbrance } from '../src/combat/formulas.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const skin = (v) => { _resetForTests(); globalThis.location = { search: `?skin=${v}` }; };

/** A character with a career, a drain on one stat, and a pack. The
 *  drain is the point: liveStat and the raw base differ, and the sheet
 *  must show the live one or a poisoned player reads a lie. */
const hero = () => ({
  name: 'Aelwyn',
  race: 'Redguard',
  level: 4,
  career: { name: 'Spellsword', primarySkills: [0, 1], majorSkills: [2, 3], minorSkills: [4, 5, 6] },
  stats: {
    strength: 50, intelligence: 62, willpower: 40, agility: 55,
    endurance: 48, personality: 33, speed: 51, luck: 44,
  },
  activeEffects: [{ kind: 'drainAttribute', stat: 'strength', magnitude: 12 }],
  skills: { 0: 41, 1: 38, 2: 27, 3: 22, 4: 15, 5: 11, 6: 9 },
  health: 41, maxHealth: 58, magicka: 20, maxMagicka: 44,
  fatigue: 3200,
  items: [{ name: 'Gold Pieces', group: 'Currency', stackCount: 1287 }],
});

// ── THE NUMBERS ARE THE CLASSIC SHEET'S ──────────────────────────

test('U52: every figure is the expression ui/charsheet.js draws', () => {
  const e = hero();
  const m = sheetModel(e);

  // the eight attributes come through liveStat, so the drain shows
  assert.deepEqual(m.attributes.map((a) => a.key), [...STAT_KEYS_ORDER]);
  for (const { key, value } of m.attributes) assert.equal(value, liveStat(e, key));
  assert.equal(m.attributes[0].value, 38, 'strength 50 with a 12-point drain reads 38');
  assert.notEqual(m.attributes[0].value, e.stats.strength, 'and NOT the raw base');

  // fatigue is DFU's display divisor, trunc on both sides
  assert.equal(m.fatigue.now, Math.trunc(e.fatigue / FATIGUE_MULTIPLIER));
  assert.equal(m.fatigue.max, Math.trunc(maxFatigue(e) / FATIGUE_MULTIPLIER));

  // encumbrance is FormulaHelper.MaxEncumbrance over LIVE strength -
  // the drained one, which is the same trap the attributes carry
  assert.equal(m.encumbrance.max, maxEncumbrance(liveStat(e, 'strength')));
  assert.notEqual(m.encumbrance.max, maxEncumbrance(e.stats.strength));
  assert.equal(m.encumbrance.now, Math.trunc(carriedWeight(e)));

  assert.equal(m.gold, 1287, 'the Currency stack, as the classic label reads it');
  assert.deepEqual(m.health, { now: 41, max: 58 });
  assert.deepEqual(m.magicka, { now: 20, max: 44 });
});

test('U52: an entity with no fatigue stored reads as full, exactly as the label does', () => {
  // `e.fatigue ?? maxFatigue(e)` - the classic sheet's own fallback.
  const e = hero();
  delete e.fatigue;
  const m = sheetModel(e);
  assert.equal(m.fatigue.now, m.fatigue.max);
});

test('U52: the race default is the classic sheet’s own', () => {
  const e = hero();
  delete e.race;
  assert.equal(sheetModel(e).race, 'Breton', "charsheet.js draws `e.race ?? 'Breton'`");
});

test('U52: an empty entity produces a sheet rather than a throw', () => {
  // Every host can open this before a character exists (the ?dungeon
  // dev page boots on a bare entity), and a sheet that throws takes
  // the overlay slot with it.
  const m = sheetModel({});
  assert.equal(m.level, 1);
  assert.equal(m.gold, 0);
  assert.equal(m.encumbrance.now, 0);
  assert.equal(m.attributes.length, 8);
  assert.equal(sheetModel(undefined).name, '');
});

// ── THE SKILL GROUPS ARE _drawSkillPage'S OWN ────────────────────

test('U52: Miscellaneous is every skill in no career group, not a fixed list', () => {
  const e = hero();
  const m = sheetModel(e);
  assert.deepEqual(m.groups.map((g) => g.name), [...SKILL_GROUPS]);
  assert.deepEqual(m.groups[0].ids, [0, 1]);
  assert.deepEqual(m.groups[1].ids, [2, 3]);
  assert.deepEqual(m.groups[2].ids, [4, 5, 6]);
  const misc = m.groups[3].ids;
  assert.equal(misc.length, SKILL_NAMES.length - 7, 'the remainder, and all of it');
  for (const id of [0, 1, 2, 3, 4, 5, 6]) assert.ok(!misc.includes(id));

  // MOVE a skill between careers and it moves between groups - which
  // is what "not a fixed list" means, and the mutation that hardcodes
  // the remainder dies here.
  e.career.majorSkills = [2, 3, 9];
  const m2 = sheetModel(e);
  assert.ok(m2.groups[1].ids.includes(9));
  assert.ok(!m2.groups[3].ids.includes(9), 'skill 9 left Miscellaneous when it joined a career');
  assert.equal(m2.groups[3].ids.length, SKILL_NAMES.length - 8);
});

test('U52: a career-less entity has every skill in Miscellaneous', () => {
  const m = sheetModel({ stats: {} });
  assert.equal(m.groups[3].ids.length, SKILL_NAMES.length);
  for (let i = 0; i < 3; i++) assert.equal(m.groups[i].ids.length, 0);
});

test('U52: the whole catalogue is reachable - 35 skills, none dropped', () => {
  // The classic sheet pages nine at a time (`ids.slice(0, 9)` in
  // _drawSkillPage) because a 320x200 panel has nowhere to put the
  // rest. This screen exists to stop doing that, so the pin is that
  // the four groups PARTITION the catalogue: every id exactly once.
  const m = sheetModel(hero());
  const all = m.groups.flatMap((g) => g.ids).sort((a, b) => a - b);
  assert.deepEqual(all, SKILL_NAMES.map((_, i) => i));
  assert.equal(new Set(all).size, all.length, 'no skill in two groups');
});

// ── THE FORK ─────────────────────────────────────────────────────

// A DOCUMENT, JUST ENOUGH OF ONE - and the SECOND time this file's
// author needed the lesson. The fork's other clause is `typeof
// document !== 'undefined'`, node has none, so a classic-skin test run
// headless takes the classic branch for the WRONG REASON and deleting
// `isEnhanced()` survives. It survived here exactly as it survived the
// first draft of test/enhancedPause.test.js.
function withDocument(fn) {
  const node = { id: '', style: {}, removed: false, remove() { this.removed = true; } };
  globalThis.document = { createElement: () => node, body: { append() {} } };
  try { return fn(node); } finally { delete globalThis.document; }
}

test('U52: the classic skin still gets the canvas sheet', () => {
  skin('classic');
  withDocument(() => {
    const win = createCharSheetWindow({ entity: hero() });
    assert.equal(win?.constructor?.name, 'CharSheet',
      'a player who chose classic must get INFO00I0, not the DOM sheet');
  });
});

test('U52: the fork asks the SKIN, not only the document', () => {
  // The behaviour pins take both branches; this holds the condition
  // itself, because `typeof document` alone would send a classic
  // player to the DOM sheet in every real browser there is.
  assert.match(read('src/ui/charSheetDoor.js'),
    /if \(isEnhanced\(\) && typeof document !== 'undefined'\) \{/,
    'both clauses, in that order');
});

test('U52: a host with no document keeps the canvas sheet, on either skin', () => {
  skin('enhanced');
  assert.equal(typeof document, 'undefined', 'this test is only meaningful headless');
  assert.equal(createCharSheetWindow({ entity: hero() })?.constructor?.name, 'CharSheet');
});

test('PX27: the enhanced skin gets the PAUSE WINDOW\'s Stats page, and the host holds it', () => {
  // U52 gave the enhanced skin its own DOM character sheet. PX25 gave
  // the pause window's Stats page the four buttons that sheet carried,
  // and PX27 retired the sheet: there were TWO enhanced character
  // sheets reading the same four sections out of the same sheetModel,
  // and one of them was the last pre-PX surface in the game.
  //
  // The DOOR's contract is unchanged - the host is handed an overlay it
  // mounts - so no host learned anything new.
  skin('enhanced');
  withDocument((node) => {
    const win = createCharSheetWindow({ entity: hero() });
    assert.notEqual(win?.constructor?.name, 'CharSheet');
    assert.equal(win.done, false, 'a sheet that reports done on arrival is torn down on arrival');
    assert.equal(node.id, 'enhanced-sheetpage');
    assert.match(node.style.cssText, /position:fixed;inset:0/);
    assert.match(node.style.cssText, /z-index:13/, 'the pause door\'s depth: peers, never stacked');
    win.dispose();
    assert.equal(win.done, true);
    assert.equal(node.removed, true);
  });
});

test('PX27: the child-push machinery went WITH the overlay, and nothing needs it', () => {
  const src = read('src/ui/charSheetDoor.js');
  // The old overlay could PUSH a canvas child - hiding its own div
  // while the child drew underneath, then popping back - because the
  // sheet's four buttons opened CLASSIC windows. PX23 and PX24 gave
  // all three of those an enhanced window, so the doors now CLOSE the
  // sheet and hand over rather than stacking on top of it.
  for (const gone of ["host.style.visibility = 'hidden'", 'stepChild', 'mountEnhancedCharSheet']) {
    assert.ok(!src.includes(gone), `${gone} retired with the overlay it served`);
  }
  // IT LANDS ON STATS. Without this the F5 key opens the pause MENU
  // and the sheet is one press further in - which is the fault PX26
  // fixed on the dial's north, arriving here by another road.
  assert.match(src, /^\s*at: 'stats',$/m, 'F5 lands on the sheet, not on a menu with it inside');
  // AND IT CLOSES BEFORE IT HANDS OVER. Two overlays at once is U55's
  // stacking bug; the old sheet solved it by hiding itself and pushing
  // a child, and this solves it by leaving.
  for (const arm of ['inventory', 'spellbook', 'logbook']) {
    assert.match(src, new RegExp(`hooks\\.${arm} \\? \\(\\) => \\{ close\\(\\); hooks\\.${arm}\\(\\); \\} : undefined`),
      `${arm}: the door closes, THEN hands over`);
  }
  // A host that hands no hook gets NO button - the same honest refusal
  // the classic sheet gives, rather than a dead one.
  assert.match(src, /: undefined,\n\s*openSpellbook:/);
  // ui/enhancedCharSheet.js STAYS: sheetModel is the model both sheets
  // always read, and the one that remains reads it.
  assert.match(read('src/ui/enhancedMenu.js'), /import \{ sheetModel \} from '\.\/enhancedCharSheet\.js';/);
  assert.match(read('src/ui/enhancedCharSheet.js'), /export function sheetModel/);
});

// ── THE SCREEN'S OWN INPUT ───────────────────────────────────────

test('U52: Escape and F5 close it, and F5 is claimed', () => {
  const src = read('src/ui/enhancedCharSheet.js');
  const onKey = src.slice(src.indexOf('function onKey(e)'), src.indexOf('/** The pointer lock'));
  assert.match(onKey, /overlayAction\(e\) !== 'back' && e\.key !== 'F5'/,
    'the shared table for Escape, the event for F5 - which is a host BINDING, not overlay vocabulary');
  const claimAt = onKey.indexOf('e.preventDefault()');
  const testAt = onKey.indexOf("e.key !== 'F5'");
  assert.ok(testAt > 0, 'the F5 arm is gone');
  assert.ok(claimAt > testAt,
    'the screen decides it used the key BEFORE it claims it - and an F5 this screen '
    + 'does use, left unclaimed, is a browser reload that destroys the session');
  assert.match(onKey, /e\.stopPropagation\(\)/,
    'the host walks the player on the keys underneath a modal overlay');
});

test('U52: every listener has an owner', () => {
  const src = read('src/ui/enhancedCharSheet.js');
  const unmount = src.slice(src.indexOf('    unmount() {'));
  assert.match(unmount, /removeEventListener\('keydown', keyHandler, \{ capture: true \}\)/);
  assert.match(unmount, /removeEventListener\('pointerlockchange', lockHandler\)/);
  // and here the leak has a specific cost worth naming: this listener
  // claims F5, so an orphan eats the key that OPENS the sheet.
  assert.match(src, /eats the key that opens it/);
});

test('U52: a button is drawn only where the host handed a factory', () => {
  const src = read('src/ui/enhancedCharSheet.js');
  const nav = src.slice(src.indexOf('function nav()'), src.indexOf('function render()'));
  assert.match(nav, /if \(typeof hooks\[which\] !== 'function'\) continue;/,
    'the classic sheet answers the press with a notice because its rects are painted '
    + 'into the art; this one can remove the button, so it does');
  assert.match(nav, /if \(!openChild\(which\)\)/, 'and a hook that returns null still gets a notice');
});

test('U52: it draws no paperdoll, and the reason is written down', () => {
  // The classic sheet composes it at DFU's (200,8). Dropping it
  // silently is the thing this project's audits punish; the module
  // says which slice owns it and why it is not this one.
  const src = read('src/ui/enhancedCharSheet.js');
  assert.doesNotMatch(src, /drawPaperDoll|refreshPaperDoll/);
  assert.match(src, /THE PAPERDOLL\./);
  assert.match(src, /inventory slice with the equip map/);
});
