// GUIDE8 (the delve arc, 2026-10-05; bible/06-Systems/Quest-Guide-Arc.md GUIDE8, DECISIONS 3: "a player who cannot read
// a dungeon should be able to ask for it").
//
// THE GUIDANCE TIERS, and the Exact tier underground: every quest resource standing in the dungeon on the held map's
// dungeon sheet (its floor on the strip, listed before it is walked) and the followed quest's nearest on the compass -
// off by default, its own row (systems/questGuidance.js, scenes/worldModes.js dungeonQuestMarksHere,
// scenes/dungeonContext.js, ui/automapSheet.js, ui/inkAutomap.js). And ECHO1's mark on the same sheet.
// bible/03-World/Delve-Arc.md, GUIDE8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GUIDANCE_PREF, guidanceTier, dungeonQuestMarks } from '../src/systems/questGuidance.js';
import { setUiSkin, uiSkin } from '../src/systems/uiSkin.js';
import { getPref, setPref } from '../src/systems/uiPrefs.js';
import { createAutomapSheet } from '../src/ui/automapSheet.js';
import { floorStripLayout, paintFloorStrip } from '../src/ui/inkAutomap.js';
import { QUEST_MARK_CSS } from '../src/ui/questMarks.js';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../src/systems/features.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('GUIDE8: the tier - Exact only on the enhanced skin and only when asked for', () => {
  const skin = uiSkin(), pref = getPref(GUIDANCE_PREF);
  try {
    setUiSkin('enhanced');
    setPref(GUIDANCE_PREF, 'journal');
    assert.equal(guidanceTier(), 'journal');
    setPref(GUIDANCE_PREF, 'exact');
    assert.equal(guidanceTier(), 'exact');
    setUiSkin('classic');
    assert.equal(guidanceTier(), 'journal', 'the classic skin is DFU\'s: no quest marks underground');
    setUiSkin('enhanced');
    setPref(GUIDANCE_PREF, 'something else');
    assert.equal(guidanceTier(), 'journal');
  } finally { setUiSkin(skin); setPref(GUIDANCE_PREF, pref); }
  assert.equal(FEATURE_PREF_DEFAULTS.questGuidance, 'journal', 'off by default');
});

test('GUIDE8: the marks - every standing, unhidden stand and every live quest foe, named, the followed quest\'s said', () => {
  const box = (x, y, z) => ({ min: [x - 0.5, y, z - 0.5], max: [x + 0.5, y + 2, z + 0.5] });
  const stand = (uid, res, extra = {}) => ({ active: true, dead: false, behaviour: { questUID: uid, targetResource: res }, box: box(10, 0, 4), ...extra });
  const stands = [
    stand(7, { isItem: true }),
    stand(7, { isPerson: true, displayName: 'Lady Brisienna' }, { box: box(20, 3, 0) }),
    stand(8, { isItem: true }, { active: false }),
    stand(8, { isItem: true }, { dead: true }),
    stand(8, { isItem: true, isHidden: true }),
    stand(9, { isPerson: true, displayName: '' }),
    { active: true, behaviour: null },
  ];
  const foes = [
    { dead: false, ai: { feet: [1, 2, 3] }, mobileType: 12, questBehaviour: { questUID: 8, targetResource: { displayName: 'Ulric' } } },
    { dead: false, ai: { feet: [4, 5, 6] }, mobileType: 3, questBehaviour: { questUID: 7, targetResource: { displayName: '' } } },
    { dead: true, ai: { feet: [0, 0, 0] }, questBehaviour: { questUID: 7, targetResource: {} } },
    { dead: false, ai: { feet: [0, 0, 0] }, questBehaviour: null },
    { dead: false, ai: { feet: [0, 0, 0] }, questBehaviour: { questUID: 7, targetResource: { isHidden: true } } },
  ];
  const marks = dungeonQuestMarks({ stands, foes, boxOf: (s) => s.box, followedId: '7', itemName: () => 'Totem of Wyrd', foeName: (f) => `kind ${f.mobileType}` });
  assert.deepEqual(marks, [
    { at: [10, 0, 4], name: 'Totem of Wyrd', followed: true },
    { at: [20, 3, 0], name: 'Lady Brisienna', followed: true },
    { at: [10, 0, 4], name: 'Someone', followed: false },
    { at: [1, 2, 3], name: 'Ulric', followed: false },
    { at: [4, 5, 6], name: 'kind 3', followed: true },
  ]);
  assert.equal(dungeonQuestMarks({ stands, foes, boxOf: (s) => s.box })[0].followed, false, 'no quest followed, none filled');
  assert.equal(dungeonQuestMarks({ stands: [stand(1, { isItem: true })], boxOf: (s) => s.box })[0].name, 'Quest item', 'an item with no name');
  assert.deepEqual(dungeonQuestMarks({ stands: null, foes: null, boxOf: () => null }), []);
});

test('GUIDE8: the host hands the Exact tier\'s marks to the dungeon, which draws them on its map and its compass', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /const dungeonQuestMarksHere = \(\) => \(guidanceTier\(\) !== 'exact' \? null : dungeonQuestMarks\(\{/);
  assert.match(wm, /stands: dungeonQuestFlats, foes: dungeonCtx\?\.foes \?\? \[\], boxOf: questStandBox, followedId: questTracker\.tracked\(\)\?\.id \?\? null,/);
  assert.match(wm, /questMarks: \(\) => dungeonQuestMarksHere\(\),/);
  const ctx = src('src/scenes/dungeonContext.js');
  assert.match(ctx, /quests: \(\) => opts\.questMarks\?\.\(\) \?\? null,/);
  assert.match(ctx, /quest: questCompassMark\(playerFeet\),/);
  assert.match(ctx, /for \(const pass of \[true, false\]\) \{\n\s+for \(const q of list\) \{\n\s+if \(pass && !q\.followed\) continue;/, 'the followed quest\'s first, else the nearest');
  assert.match(src('src/ui/automapDoor.js'), /quests: deps\.quests \?\? null,/);
});

// the sheet: a two-storey level (disc22g's fixture), rooms a and b side by side at 0, room c at 12
const quad = (key, y, x0, z0, x1, z1, ny = 1) => ({
  key, aabb: { min: [x0, y, z0], max: [x1, y, z1] },
  positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]), indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  normals: new Float32Array([0, ny, 0, 0, ny, 0, 0, ny, 0, 0, ny, 0]), matrix: null,
});
const room = (key, y, x0, z0, x1, z1, h = 4) => [quad(`${key}f`, y, x0, z0, x1, z1, 1), quad(`${key}c`, y + h, x0, z0, x1, z1, -1)];
const LEVEL = [...room('a', 0, 100, 200, 110, 210), ...room('b', 0, 110, 200, 120, 210), ...room('c', 12, 100, 200, 110, 210)];
const rec = (revealed, extra = {}) => ({ revealed: new Set(revealed), visitedThisRun: new Set(), entranceDiscovered: false, notes: new Map(), teleporters: new Map(), ...extra });
const PAPER = { paperW: 400, paperH: 300, dpr: 1 };
function recordingCtx() {
  const calls = [];
  const state = { font: '', lineWidth: 1 };
  return new Proxy({ calls, measureText: (t) => ({ width: String(t).length * 6 }) }, {
    get: (t, k) => (k in t ? t[k] : k in state ? state[k] : (...args) => { calls.push({ fn: k, args }); }),
    set: (_, k, v) => { state[k] = v; calls.push({ fn: `=${String(k)}`, args: [v] }); state[k] = v; return true; },
  });
}

test('GUIDE8/ECHO1: the sheet carries the quest marks and the echoes on their own storeys, and the echo breathes', () => {
  const quests = [{ at: [105, 0, 205], name: 'Totem of Wyrd', followed: true }, { at: [105, 12, 205], name: 'Ulric', followed: false }];
  const echoes = [[115, 0, 205]];
  const s = createAutomapSheet({ record: () => rec(['af']), model: () => ({ rows: LEVEL }), player: () => ({ feet: [105, 0, 205], yaw: 0 }), quests: () => quests, echoes: () => echoes });
  const ctx = recordingCtx();
  s.paintOverlay(ctx, { view: { ox: 0, oy: 0, scale: 8 }, ...PAPER, pulse: 0 });
  const texts = ctx.calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]);
  assert.ok(texts.includes('Totem of Wyrd'), 'the quest item on the ground floor');
  assert.ok(!texts.includes('Ulric'), 'the foe upstairs is on its own storey');
  assert.ok(texts.includes('Moved'), 'the echo - in a room not yet seen, because the press said which way');
  assert.ok(ctx.calls.some((c) => c.fn === '=strokeStyle' && c.args[0] === QUEST_MARK_CSS), 'the journal\'s gold');
  assert.equal(s.breathes(), true, 'an echo on the sheet breathes');
  s.setFloor(1);
  const up = recordingCtx();
  s.paintOverlay(up, { view: { ox: 0, oy: 0, scale: 8 }, ...PAPER, pulse: 0 });
  assert.ok(up.calls.some((c) => c.fn === 'fillText' && c.args[0] === 'Ulric'));
  // nothing handed, nothing drawn - and nothing breathes for it
  const bare = createAutomapSheet({ record: () => rec(['af']), model: () => ({ rows: LEVEL }), player: () => ({ feet: [105, 0, 205], yaw: 0 }), quests: () => null, echoes: () => null });
  assert.equal(bare.breathes(), false);
});

test('GUIDE8: the strip lists a quest\'s floor before it is walked, and marks it with the diamond', () => {
  // the trail says only the ground floor was stood on; the quest stands upstairs
  const trail = new Set(['105,0,205']);
  const quests = [{ at: [105, 12, 205], name: 'Ulric', followed: true }];
  const mk = (q) => createAutomapSheet({ record: () => rec(['af', 'cf'], { trail }), model: () => ({ rows: LEVEL }), player: () => ({ feet: [105, 0, 205], yaw: 0 }), quests: () => q });
  const without = mk(null);
  without.paintStatic(recordingCtx(), { view: { ox: 0, oy: 0, scale: 8 }, ...PAPER });
  assert.deepEqual(without.strip.rows.map((r) => r.label), ['Floor 1'], 'the walked floor alone (EM3-3D\'s list)');
  const s = mk(quests);
  s.paintStatic(recordingCtx(), { view: { ox: 0, oy: 0, scale: 8 }, ...PAPER });
  assert.deepEqual(s.strip.rows.map((r) => [r.label, !!r.quest]), [['Floor 2', true], ['Floor 1', false]], 'the quest\'s floor listed, and marked');
  // the strip's own law, driven
  const lay = floorStripLayout([{ index: 0, label: 'Floor 1' }, { index: 1, label: 'Floor 2' }], 0, { quest: new Set([1]) });
  assert.deepEqual(lay.rows.map((r) => [r.label, r.quest]), [['Floor 2', true], ['Floor 1', false]]);
  const p = recordingCtx();
  paintFloorStrip(p, lay);
  assert.ok(p.calls.some((c) => c.fn === '=strokeStyle' && c.args[0] === QUEST_MARK_CSS), 'the quest floor wears the gold diamond');
  const none = recordingCtx();
  paintFloorStrip(none, floorStripLayout([{ index: 0, label: 'Floor 1' }], 0, {}));
  assert.ok(!none.calls.some((c) => c.fn === '=strokeStyle' && c.args[0] === QUEST_MARK_CSS));
  const sheet = src('src/ui/automapSheet.js');
  assert.match(sheet, /for \(const q of questSheets\(\)\) keep\.add\(q\);/, 'listed before it is walked');
  assert.match(sheet, /you: youSheet\(\), exit: exitSheet\(\), seen: c\?\.seen \?\? null, quest: questSheets\(\),/);
});

test('GUIDE8: the Features row - Enhanced, Journal or Exact, Journal by default and on All off', () => {
  const f = FEATURES.find((x) => x.id === 'quest-guidance');
  assert.ok(f);
  assert.deepEqual(f.kinds, ['enhanced']);
  assert.equal(f.control.key, GUIDANCE_PREF);
  assert.deepEqual(f.control.tiers.map(([v]) => v), ['journal', 'exact']);
  assert.equal(f.control.initial, 'journal');
  assert.equal(f.control.classic, 'journal');
  assert.equal(f.control.online, 'player');
  assert.match(f.note, /spoil/);
});
