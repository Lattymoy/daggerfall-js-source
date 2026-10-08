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

import { GUIDANCE_PREF, GUIDANCE_TIERS, guidanceTier, townTierOn, dungeonQuestMarks, questCompassPick, townQuestBuildings, townBuildingLocal } from '../src/systems/questGuidance.js';
import { createTownSheet } from '../src/ui/townSheet.js';
import { nameplateAnchor, WORLD_PER_PX } from '../src/ui/nameplateLayout.js';
import { RMB_SIDE } from '../src/world/locationLayout.js';
import { questStandBox } from '../src/systems/quest/sceneMount.js';
import { followOn } from '../src/ui/questTracker.js';
import { QUEST_MARK_LIFT, QUEST_FOLLOWED_TEXT, QUEST_LEGEND_TEXT } from '../src/ui/questMarks.js';
import { setUiSkin, uiSkin } from '../src/systems/uiSkin.js';
import { getPref, setPref } from '../src/systems/uiPrefs.js';
import { createAutomapSheet } from '../src/ui/automapSheet.js';
import { floorStripLayout, paintFloorStrip, MARK_R, PLAN_PEN } from '../src/ui/inkAutomap.js';
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
    assert.equal(townTierOn(), true, 'Exact holds the Town tier');
    setPref(GUIDANCE_PREF, 'town');
    assert.equal(guidanceTier(), 'town');
    assert.equal(townTierOn(), true);
    setPref(GUIDANCE_PREF, 'journal');
    assert.equal(townTierOn(), false);
    setPref(GUIDANCE_PREF, 'exact');
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

test('AUDIT DELVE C7: the marks over the stand the producer mints - standQuestFlatIn\'s fields through questStandBox, the TOTEM-CAGE ride included', () => {
  // worldModes.js standQuestFlatIn: { x, y, z, width, height, off, active, dead, behaviour } - y the feet
  const stand = (over) => ({ ctx: {}, archive: 211, record: 3, x: 10, y: 2, z: 4, marker: null, width: 1, height: 1.5, batch: null, active: true, dead: false, behaviour: { questUID: 7, targetResource: { isItem: true } }, off: null, ...over });
  const [still, riding, unsized] = [stand(), stand({ off: [0, 3, -2] }), stand({ width: 0, height: 0 })];
  const marks = dungeonQuestMarks({ stands: [still, riding, unsized], boxOf: questStandBox, itemName: () => 'Totem of Wyrd' });
  assert.deepEqual(marks[0].at, [10, 2, 4], 'the foot of the box: the stand\'s own feet');
  assert.deepEqual(marks[1].at, [10, 5, 2], 'an item riding its marker stands where the marker carried it');
  assert.deepEqual(marks[2].at, [10, 2, 4], 'a stand whose picture has not loaded has a box of no size, at its feet');
});

test('AUDIT DELVE E6: a party mate\'s quest foe (a puppet, its behaviour the share\'s) and the dungeon\'s own quest people are marked', () => {
  const ulric = { questUID: 7, targetResource: { displayName: 'Ulric' } };
  const puppet = { dead: false, ai: { feet: [1, 0, 1] }, mobileType: 28, questBehaviour: null, _pupQuest: 'q7:ulric' };
  const share = { 'q7:ulric': ulric };
  const behaviourOf = (f) => f.questBehaviour ?? (f._pupQuest ? share[f._pupQuest] ?? null : null);
  const people = [
    { x: 5, y: 0, z: 5, active: true, questBehaviour: { questUID: 7, targetResource: { isPerson: true, displayName: 'Lady Brisienna' } } },
    { x: 6, y: 0, z: 6, active: false, questBehaviour: { questUID: 7, targetResource: { isPerson: true, displayName: 'Away' } } },
    { x: 7, y: 0, z: 7, active: true, questBehaviour: { questUID: 7, targetResource: { isPerson: true, displayName: 'Gone', isDestroyed: true } } },
    { x: 8, y: 0, z: 8, active: true, questBehaviour: null },
  ];
  const marks = dungeonQuestMarks({ foes: [puppet], people, boxOf: () => null, behaviourOf, followedId: '7' });
  assert.deepEqual(marks, [{ at: [1, 0, 1], name: 'Ulric', followed: true }, { at: [5, 0, 5], name: 'Lady Brisienna', followed: true }]);
  assert.deepEqual(dungeonQuestMarks({ foes: [puppet], boxOf: () => null }), [], 'by the foe\'s own behaviour alone, the puppet was dropped');
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /people: dungeonCtx\?\.people \?\? \[\], behaviourOf: \(f\) => dungeonCtx\?\.questFoeBehaviour\?\.\(f\) \?\? f\.questBehaviour \?\? null,/);
  const ctx = src('src/scenes/dungeonContext.js');
  assert.match(ctx, /questFoeBehaviour\(f\) \{\n\s+if \(!f\) return null;\n\s+if \(f\.questBehaviour\) return f\.questBehaviour;\n\s+return f\._pupQuest \? \(ownShare\(\)\?\.behaviourFor\?\.\(f\._pupQuest\) \?\? null\) : null;/);
});

test('AUDIT DELVE C6: the compass\'s pick - the followed quest\'s nearest, else the nearest of all', () => {
  const marks = [{ at: [10, 0, 0], followed: false }, { at: [30, 0, 0], followed: true }, { at: [2, 0, 0], followed: false }, { at: [40, 0, 0], followed: true }];
  assert.deepEqual(questCompassPick(marks, [0, 0, 0]), [30, 0], 'the followed quest\'s nearest, though another is nearer');
  assert.deepEqual(questCompassPick(marks.filter((m) => !m.followed), [0, 0, 0]), [2, 0], 'none followed: the nearest');
  assert.equal(questCompassPick([], [0, 0, 0]), null);
  assert.equal(questCompassPick(marks, null), null);
});

test('AUDIT DELVE E7: the Exact tier follows the tracker\'s quest - it is fed while the tier is on', () => {
  const skin = uiSkin(), pref = getPref(GUIDANCE_PREF), marks = getPref('questMarks'), tracker = getPref('questTracker');
  try {
    setUiSkin('enhanced'); setPref('questMarks', false); setPref('questTracker', false);
    setPref(GUIDANCE_PREF, 'journal');
    assert.equal(followOn(), false);
    setPref(GUIDANCE_PREF, 'exact');
    assert.equal(followOn(), true, 'with the card and the marks off, the Exact compass still follows');
  } finally { setUiSkin(skin); setPref(GUIDANCE_PREF, pref); setPref('questMarks', marks); setPref('questTracker', tracker); }
});

test('GUIDE8: the host hands the Exact tier\'s marks to the dungeon, which draws them on its map and its compass', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /const dungeonQuestMarksHere = \(\) => \(guidanceTier\(\) !== 'exact' \? null : dungeonQuestMarks\(\{/);
  assert.match(wm, /stands: dungeonQuestFlats, foes: dungeonCtx\?\.foes \?\? \[\], boxOf: questStandBox, followedId: questTracker\.tracked\(\)\?\.id \?\? null,/);
  assert.match(wm, /questMarks: \(\) => dungeonQuestMarksHere\(\),/);
  const ctx = src('src/scenes/dungeonContext.js');
  assert.match(ctx, /quests: \(\) => opts\.questMarks\?\.\(\) \?\? null,/);
  assert.match(ctx, /quest: questCompassMark\(playerFeet\),/);
  assert.match(ctx, /return questCompassPick\(feet \? opts\.questMarks\?\.\(\) \?\? null : null, feet\);/, 'the followed quest\'s first, else the nearest (questGuidance.js questCompassPick)');
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
  // AUDIT DELVE D11: an echo upstairs does not make the flat plan of the ground floor breathe
  const upstairs = createAutomapSheet({ record: () => rec(['af']), model: () => ({ rows: LEVEL }), player: () => ({ feet: [105, 0, 205], yaw: 0 }), echoes: () => [[105, 12, 205]] });
  upstairs.paintOverlay(recordingCtx(), { view: { ox: 0, oy: 0, scale: 8 }, ...PAPER, pulse: 0 });
  assert.equal(upstairs.breathes(), false, 'not on the sheet in view');
  upstairs.setFloor(1);
  assert.equal(upstairs.breathes(), true);
});

test('AUDIT DELVE D3/D4: the diamond is the mark under the pointer, and the hover says what a filled one is', () => {
  const quests = [{ at: [105, 0, 205], name: 'Totem of Wyrd', followed: true }, { at: [115, 0, 205], name: 'Ulric', followed: false }];
  const s = createAutomapSheet({ record: () => rec(['af', 'bf']), model: () => ({ rows: LEVEL }), player: () => ({ feet: [100, 0, 200], yaw: 0 }), quests: () => quests });
  const view = { ox: 0, oy: 0, scale: 8 };
  const ctx = recordingCtx();
  s.paintOverlay(ctx, { view, ...PAPER, pulse: 0 });
  // the spot, read off the name the sheet wrote under it (paintMarkName: MARK_R + 2 below the spot)
  const at = (name) => { const c = ctx.calls.find((x) => x.fn === 'fillText' && x.args[0] === name); return [c.args[1], c.args[2] - MARK_R - 2]; };
  const [tx, ty] = at('Totem of Wyrd');
  assert.equal(s.hoverLabel(tx, ty)?.label, `Totem of Wyrd - ${QUEST_FOLLOWED_TEXT}`, 'D4: what the filled diamond means');
  assert.ok(s.hoverLabel(tx, ty - QUEST_MARK_LIFT)?.label?.startsWith('Totem of Wyrd'), 'D3: on the diamond, the mark');
  const [ux, uy] = at('Ulric');
  const ul = [s.hoverLabel(ux, uy)?.label];
  assert.equal(ul[0], `Ulric - ${QUEST_LEGEND_TEXT}`, 'a hollow one: a quest not followed');
});

test('AUDIT DELVE D1: on the solid map an echo or a quest off the floor in view says its floor', () => {
  const quests = [{ at: [105, 0, 205], name: 'Totem of Wyrd', followed: true }, { at: [105, 12, 205], name: 'Ulric', followed: false }];
  const sheet = src('src/ui/automapSheet.js');
  assert.match(sheet, /return solidOn && s >= 0 && s !== index \? ` \\u00b7 \$\{f\.sheets\[s\]\.label\}` : '';/);
  assert.match(sheet, /name: `Moved\$\{floorOf\(p\[1\]\)\}`/);
  assert.match(sheet, /name: `\$\{q\.name \?\? ''\}\$\{floorOf\(p\[1\]\)\}`/);
  // on the flat plan, a mark is on its own sheet and needs no word
  const s = createAutomapSheet({ record: () => rec(['af']), model: () => ({ rows: LEVEL }), player: () => ({ feet: [105, 0, 205], yaw: 0 }), quests: () => quests });
  const ctx = recordingCtx();
  s.paintOverlay(ctx, { view: { ox: 0, oy: 0, scale: 8 }, ...PAPER, pulse: 0 });
  const at = ctx.calls.findIndex((c) => c.fn === 'fillText' && c.args[0] === 'Totem of Wyrd');
  assert.ok(at >= 0, 'no floor word on the flat plan');
  // AUDIT DELVE D7: in the names' pen
  const pen = ctx.calls.slice(0, at).reverse().find((c) => c.fn === '=fillStyle');
  assert.equal(pen?.args[0], PLAN_PEN.note, 'the names\' pen, not the marks\'');
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
  // AUDIT DELVE D2: you, the way out and a quest on one floor - the diamond stays on the paper
  for (const paperW of [640, 900, 1280]) {
    const full = floorStripLayout([{ index: 0, label: 'Floor 1' }, { index: 1, label: 'Floor 2' }], 0, { paperW, you: 0, exit: 0, quest: new Set([0]) });
    const row = full.rows.find((r) => r.index === 0);
    const k = 3 * full.scale, g = 4 * full.scale;
    const right = row.x + row.w + g + (k * 1.6 + g) + (k * 2 + g) + k * 2.4;
    assert.ok(right <= paperW, `${paperW}: the diamond's right point ${right.toFixed(1)} is on the paper`);
    const bare = floorStripLayout([{ index: 0, label: 'Floor 1' }], 0, { paperW });
    assert.equal(bare.rows[0].x + bare.rows[0].w, paperW - 26 * bare.scale, 'with no marks the words keep their pad');
  }
  const sheet = src('src/ui/automapSheet.js');
  assert.match(sheet, /for \(const q of questSheets\(\)\) keep\.add\(q\);/, 'listed before it is walked');
  assert.match(sheet, /you: youSheet\(\), exit: exitSheet\(\), seen: c\?\.seen \?\? null, quest: questSheets\(\),/);
});

test('GUIDE8: the Features row - Enhanced, Journal or Exact, Journal by default and on All off', () => {
  const f = FEATURES.find((x) => x.id === 'quest-guidance');
  assert.ok(f);
  assert.deepEqual(f.kinds, ['enhanced']);
  assert.equal(f.control.key, GUIDANCE_PREF);
  assert.deepEqual(f.control.tiers.map(([v]) => v), ['journal', 'town', 'exact']);
  assert.deepEqual(f.control.tiers.map(([v]) => v), [...GUIDANCE_TIERS], 'the row\'s tiers are the law\'s');
  assert.equal(f.control.initial, 'journal');
  assert.equal(f.control.classic, 'journal');
  assert.equal(f.control.online, 'player');
  assert.match(f.note, /spoil/);
});

test('GUIDE8 TOWN TIER (AUDIT DELVE): the buildings the journal names in this town - by its map id, once a key, the followed one said', () => {
  const v = (id, mapId, buildingKey) => ({ id, target: buildingKey == null ? { building: null } : { building: { mapId, buildingKey } } });
  const views = [v(7, 4242, 0x10205), v(8, 4242, 0x10205), v(9, 4242, 0x20101), v(10, 99, 0x30303), v(11, 4242, null), { id: 12, target: null }, null];
  assert.deepEqual(townQuestBuildings(views, 4242, '7'), [{ buildingKey: 0x10205, followed: true }, { buildingKey: 0x20101, followed: false }], 'the followed quest\'s, though another quest names it after');
  assert.deepEqual(townQuestBuildings(views, 4242 + 2 ** 32, null).length, 2, 'the map id as DFU\'s uint');
  assert.deepEqual(townQuestBuildings(views, 1234), []);
  assert.deepEqual(townQuestBuildings(views, undefined), []);
  // the building's place in the location's own frame - the frame the town map's player and plates share
  const summary = { blockX: 2, blockY: 1, position: [30, 0, 70] };
  const at = townBuildingLocal(summary, RMB_SIDE);
  assert.deepEqual(at, [2 * RMB_SIDE + 30, RMB_SIDE + 70]);
  const plate = nameplateAnchor(2, 1, [30, 0, 70]);
  assert.ok(Math.abs(at[0] / WORLD_PER_PX - plate[0]) <= 1 && Math.abs(at[1] / WORLD_PER_PX - plate[1]) <= 1, 'where the town map lays its plate');
  assert.equal(townBuildingLocal({}, RMB_SIDE), null);
});

test('GUIDE8 TOWN TIER (AUDIT DELVE): the town map rings a building the journal names, found or not; the host hands them only while the tier is on, and the compass points at it in its town', () => {
  const KEY = (1 << 16) + (2 << 8) + 5;
  const rows = [{ buildingKey: KEY, blockX: 1, blockY: 2, position: [10, 0, 10], name: 'The Woodfield Residence', isResidence: true }, { buildingKey: 9, blockX: 0, blockY: 0, position: [5, 0, 5], name: 'x' }];
  const mk = (q) => createTownSheet({ gridW: 2, gridH: 3, blocks: [], buildings: () => rows, discovered: () => [], questBuildings: q });
  assert.equal(mk(() => []).quests().length, 0, 'unfound and unnamed by a quest: no ring');
  assert.equal(mk(() => [{ buildingKey: KEY, followed: true }]).quests().length, 1, 'the building the journal names: ringed, found or not');
  assert.equal(mk(null).quests().length, 0);
  assert.match(src('src/ui/townMapDoor.js'), /questBuildings: deps\.townQuestBuildings \?\? null,/);
  const w = src('src/scenes/world.js');
  assert.match(w, /townQuestBuildings: \(\) => \(townTierOn\(\) \? townQuestBuildings\(questTracker\.views, dfLoc\.mapTableData\?\.mapId, questTracker\.tracked\(\)\?\.id \?\? null\) : \[\]\),/);
  assert.match(w, /quest: vendorCompassMark\(\) \?\? townQuestCompassMark\(\) \?\? questCompassMark\(\),/);
  const fn = w.slice(w.indexOf('const townQuestCompassMark = () => {'), w.indexOf('const gateCompassMark = () => {'));
  assert.match(fn, /if \(!townTierOn\(\) \|\| \(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) return null;/, 'the tier, on the street');
  assert.match(fn, /const bld = questTracker\.tracked\(\)\?\.target\?\.building;/, 'the tracked quest\'s named building');
  assert.match(fn, /\(\(dfLoc\.mapTableData\?\.mapId \?\? -1\) >>> 0\) !== \(Number\(bld\.mapId\) >>> 0\)\) return null;/, 'only in its town');
  assert.match(fn, /return \[_townQuestAt\.at\[0\] \+ t\[0\] \+ b\.locOrigin\[0\], _townQuestAt\.at\[1\] \+ t\[2\] \+ b\.locOrigin\[2\]\];/, 'the town map\'s frame turned back: local + translation + origin, as `local` is taken');
  assert.match(w, /const local = \[feet\[0\] - t\[0\] - b\.locOrigin\[0\], feet\[1\] - t\[1\] - b\.locOrigin\[1\], feet\[2\] - t\[2\] - b\.locOrigin\[2\]\];/, 'the frame it is the inverse of');
});

test('GUIDE8 EXACT INDOORS (AUDIT DELVE): the interior hands its quest marks to its map and its compass', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /const interiorQuestMarksHere = \(\) => \(guidanceTier\(\) !== 'exact' \|\| !interiorCtx \? null : dungeonQuestMarks\(\{\n\s+stands: questFlats, foes: interiorFoePool\(\), people: interiorCtx\.people \?\? \[\], boxOf: questStandBox, followedId: questTracker\.tracked\(\)\?\.id \?\? null,/);
  assert.match(wm, /itemName: \(st\) => interiorHoverName\(`questflat:\$\{questFlats\.indexOf\(st\)\}`\)\?\.title \?\? null,/, 'the interior plaque\'s own word');
  assert.match(wm, /quest: questCompassPick\(interiorQuestMarksHere\(\), player\.pos\),/);
  assert.match(wm, /quests: \(\) => interiorQuestMarksHere\(\),/);
});

