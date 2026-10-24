// SKILL-READY / FIRM-STARS / STATUS-TIPS / BELT-LANTERN / MONSTER-VOL / HOOD-GAP (2026-10-20, Dudey): the tiles beside
// the Renown bar, the status tiles' hover words, the lantern's own slot, the monsters' quieter calls and their volume,
// and the hood that sits on the body.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unplacedStars, advanceReach, askBookWhenDue, _resetAdvanceForTests, ADV_GAP, ADV_WORDS } from '../../../src/ui/hud/hudAdvance.js';
import { statusTip, spellTipLines, diseaseLines } from '../../../src/ui/hud/statusTips.js';
import { hudTipPlace } from '../../../src/ui/hud/hudTip.js';
import { STATUS_GLYPHS } from '../../../src/ui/hud/hudStatus.js';
import { HUD_PIECES } from '../../../src/ui/hud/hudLayout.js';
import { beltLanternOf, hangBeltLantern, unhangBeltLantern } from '../../../src/systems/beltLantern.js';
import { lanternAtWaist, LANTERN_TEMPLATE } from '../../../src/systems/playerTorch.js';
import { EnemySoundSource, FOE_ATTRACT_SCALE, COMPANION_ATTRACT_SCALE, attractStep } from '../../../src/characters/enemy/enemySounds.js';
import { tickEnemySound } from '../../../src/scenes/hostCombat.js';
import { closeHoodFoot } from '../../../src/player/eyeOfTheBeholder/layeredArmor.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { monsterVolume } from '../../../src/systems/monsterVolume.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('FIRM-STARS: the stars not placed are the purses less the tree in force, and nothing while the book does not know', () => {
  assert.equal(unplacedStars(null), null);
  assert.equal(unplacedStars({ open: null }), null);
  assert.deepEqual(unplacedStars({ open: true, tree: { start: null, keys: [] }, stars: 4, craft: 1 }), { stars: 4, craft: 1 });
  assert.match(ADV_WORDS.starsLine(4, 1), /4 stars and 1 craft point not yet placed/);
});

test('FIRM-STARS: the book is asked once, then again only when the Renown rises, never twice inside the wait', () => {
  _resetAdvanceForTests();
  let reads = 0;
  const book = { state: { open: null }, read: async () => { reads++; } };
  assert.equal(askBookWhenDue(book, 5, 0), true);
  book.state.open = true;
  assert.equal(askBookWhenDue(book, 5, 60_000), false, 'no rise, no read');
  assert.equal(askBookWhenDue(book, 6, 61_000), true, 'a rise asks again');
  assert.equal(askBookWhenDue(book, 7, 62_000), false, 'not inside the wait');
  assert.equal(reads, 2);
});

test('CLEAR-HOTBAR: a tile stands past the hotbar\'s end where the hotbar is wider than the Renown row, else its gap', () => {
  assert.deepEqual(advanceReach({ left: 522, right: 918 }, { left: 448, right: 993, width: 545 }), { left: 84, right: 85 });
  assert.deepEqual(advanceReach({ left: 419, right: 1021 }, { left: 448, right: 993, width: 545 }), { left: ADV_GAP, right: ADV_GAP });
  assert.deepEqual(advanceReach({ left: 100, right: 300 }, null), { left: ADV_GAP, right: ADV_GAP });
});

test('SKILL-READY / FIRM-STARS: two 16px outlined glyphs, two movable pieces, and the strip no longer counts the skills', () => {
  for (const g of ['skillup', 'firmstar']) {
    assert.equal(STATUS_GLYPHS[g].rows.length, 16);
    assert.ok(STATUS_GLYPHS[g].rows.every((r) => r.length === 16));
  }
  const ids = HUD_PIECES.map((p) => p.id);
  assert.ok(ids.includes('skillsReady') && ids.includes('starsUnspent'));
  assert.match(src('src/ui/levelUp/levelNotice.js'), /improvable: improvable \?\? 0 \}/);
});

test('STATUS-TIPS: a spell says what its effects do, a disease what it wears down, a need what it is', () => {
  const e = { activeEffects: [
    { kind: 'fortifyAttribute', stat: 'strength', magnitude: 10, bundleId: 1, roundsRemaining: 5 },
    { kind: 'regenerate', bundleId: 1, roundsRemaining: 5 },
    { kind: 'survival', statMods: { strength: -2 } },
  ] };
  assert.deepEqual(spellTipLines(e, 1), ['Raises Strength by 10.', 'Restores health every round.']);
  const tip = statusTip({ key: 'spell0', kind: 'buff', name: 'Ox', foot: '5', bundle: 1, endable: true }, e, { endHint: 'Right-click to end this spell' });
  assert.equal(tip.meta, 'Buff');
  assert.equal(tip.foot, '5 rounds left');
  assert.ok(tip.lines.includes('Right-click to end this spell'));
  assert.match(diseaseLines(0)[0], /Strength, Endurance and health/);
  const need = statusTip({ key: 'need:hunger', kind: 'danger', name: 'Starving', foot: '3/3' }, e);
  assert.ok(need.lines.some((l) => /food/.test(l)) && need.lines.some((l) => /Strength -2/.test(l)));
});

test('HUD-TIP: the card stands above what it speaks for, below it where there is no room, always on the screen', () => {
  assert.deepEqual(hudTipPlace({ left: 100, right: 136, top: 500, bottom: 536, width: 36 }, { width: 200, height: 100 }, { width: 1000, height: 800 }), { left: 18, top: 392 });
  assert.deepEqual(hudTipPlace({ left: 980, right: 1000, top: 20, bottom: 40, width: 20 }, { width: 200, height: 100 }, { width: 1000, height: 800 }), { left: 792, top: 48 });
});

test('BELT-LANTERN: one lantern hangs at a time, a hung one is at the waist whatever the switch, a torch never hangs', () => {
  const a = { templateIndex: LANTERN_TEMPLATE }, b = { templateIndex: LANTERN_TEMPLATE }, torch = { templateIndex: 247 };
  const e = { items: [a, b, torch] };
  assert.equal(hangBeltLantern(e, torch), false);
  assert.equal(hangBeltLantern(e, a), true);
  assert.equal(hangBeltLantern(e, b), true);
  assert.equal(beltLanternOf(e), b);
  assert.equal(a.beltLantern, undefined);
  assert.equal(lanternAtWaist(b), true);
  assert.equal(unhangBeltLantern(b), true);
  assert.equal(beltLanternOf(e), null);
  assert.match(src('src/ui/enhanced/enhancedInventory.js'), /\{ label: 'Lantern', lantern: true \}/);
});

test('MONSTER-QUIET and MONSTER-VOL: a foe calls 40% as often, a companion as before; the Audio tab\'s volume scales every call', () => {
  assert.equal(FOE_ATTRACT_SCALE, 2.5);
  const rat = new EnemySoundSource(0, () => 0);   // a rat; the roll's floor: DFU's 3 s wait
  const feet = [0, 0, 0];
  assert.equal(tickEnemySound(rat, feet, [1, 0, 0], 3.5), null, 'past DFU\'s 3 s, inside the 7.5 s');
  assert.notEqual(tickEnemySound(rat, feet, [1, 0, 0], 4.5), null, 'past 7.5 s it calls');
  assert.equal(attractStep({ mobileType: 146 }, 1), 1, 'the watch keeps its clock');
  assert.equal(attractStep({ mobileType: 0 }, 1, true), 1, 'a companion keeps its own');
  assert.equal(COMPANION_ATTRACT_SCALE, 6);
  _resetForTests();
  assert.equal(monsterVolume(), 1);
  setPref('monsterVolume', 0);
  assert.equal(monsterVolume(), 0);
  setPref('monsterVolume', 0.35);
  assert.equal(monsterVolume(), 0.35);
  _resetForTests();
  assert.match(src('src/scenes/hostCombat.js'), /out\.volume \* monsterVolume\(\)/);
  assert.match(src('src/ui/settings/settingsMap.js'), /"Controls\/MusicVolume", "port:monsterVolume"/);
});

test('HOOD-GAP: a run of empty px under the hood\'s foot with the body under it takes the foot\'s colour; open air stays open', () => {
  const w = 3, h = 10, d = new Uint8Array(w * h * 4);
  const put = (x, y, v) => { const o = (y * w + x) * 4; d[o] = v; d[o + 1] = v; d[o + 2] = v; d[o + 3] = 255; };
  put(0, 2, 7); put(0, 6, 99);   // column 0: the hood's foot at 2, the body at 6 - a gap of three
  put(1, 2, 7);                  // column 1: nothing under the foot - open air
  closeHoodFoot(d, w, h, Int16Array.from([2, 2, -1]));
  for (const y of [3, 4, 5]) assert.equal(d[(y * w) * 4 + 3], 255);
  assert.equal(d[(3 * w) * 4], 7);
  for (let y = 3; y < h; y++) assert.equal(d[(y * w + 1) * 4 + 3], 0);
});

test('QUEST-WORDS-FIRST: a click a quest heard ticks the machine at once, and the NPC\'s door waits for the windows it raised', async () => {
  const { createQuestClickFirst, clickHeardByQuest } = await import('../../../src/scenes/quest/questClickFirst.js');
  let top = null, opened = 0, heard = true;
  const first = createQuestClickFirst({ tick: () => { top = 'questBox'; }, top: () => top, heard: () => heard });
  assert.equal(first.hold(() => { opened++; }), true, 'the box came up: the door waits');
  first.settled('rewardPile');
  assert.equal(opened, 0, 'the reward next');
  first.settled(null);
  assert.equal(opened, 1, 'then the conversation');
  heard = false;
  assert.equal(first.hold(() => {}), false, 'a click no quest heard opens at once');
  const silent = createQuestClickFirst({ tick: () => {}, top: () => null, heard: () => true });
  assert.equal(silent.hold(() => {}), false, 'a tick that said nothing opens at once');
  const person = { isPerson: true, hasPlayerClicked: true };
  assert.equal(clickHeardByQuest({ quests: new Map([[1, { questComplete: false, resources: new Map([['a', person]]) }]]) }), true);
  assert.equal(clickHeardByQuest({ quests: new Map([[1, { questComplete: true, resources: new Map([['a', person]]) }]]) }), false);
  assert.match(src('src/scenes/worldModes.js'), /questWordsFirst\.hold\(/);
});
