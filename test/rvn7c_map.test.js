// RVN7c - THE MAP AND THE JOURNAL (bible/12-Enhanced-AI/Feud-Arc.md section 18.3; Mac, 2026-10-04: "more complex,
// less easy to accomplish and more detailed", then "Go"). A lair the player has heard of is drawn on the travel maps - a
// blood-red circle with its name, in the bounty circle's shape, read where the bounty circle is read (the held map, the
// classic region page, the ink sheet) - and rides the quest log as a hunt ("Hunt: Grushnak the Butcher"), whose
// Abandon forgets the lair.
// Pinned: the ring's size and colours; the marks (only a lair heard of, of the living and unsworn, the switch); the
// reader's fallback label; the ink sheet painting it blood red; every map's read and the world host's dep; the hunt's
// rows (the way from where I stand, no clock) and its Abandon through the journal leaf (forgotten, saved, heard again);
// both journal faces' presses; the world host's quest log; the page.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../src/systems/revenant.js');
const F = await import('../src/systems/revenantFeud.js');
const HJ = await import('../src/systems/huntJournal.js');
const BM = await import('../src/ui/bountyMapMark.js');
const { paintInkOverlay } = await import('../src/ui/inkMap.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { lairWords } = await import('../src/ui/revenantPage.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const me = (id = 'char-rvn7c') => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 });

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); setPlayerDoor(null); setWorldMinutes(1440 + 120);
});

const LAIR = Object.freeze({ px: 106, py: 100, name: 'Tomb of Vaness', region: 3 });
function made(p, { lair = LAIR, known = true } = {}) {
  const r = N.revenantDeed(p, { mobileType: M.Orc, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  r.lair = lair ? { ...lair } : null; r.lairKnown = known;
  return r;
}

test('RVN7c THE RING: a bounty\'s size, in blood red - never the bounty\'s black or the party\'s green; its legend (mutants: a colour moved; the size)', () => {
  assert.equal(F.LAIR_RING_R, BM.BOUNTY_RING_R);
  assert.equal(BM.REVENANT_RING_CSS, '#7a0a0a');
  assert.equal(BM.REVENANT_FILL_CSS, 'rgba(122, 10, 10, 0.16)');
  assert.deepEqual([...BM.REVENANT_DOT_RGB], [122, 10, 10]);
  assert.equal(BM.REVENANT_LEGEND_TEXT, 'Revenant lair');
  assert.notEqual(BM.REVENANT_RING_CSS, BM.BOUNTY_RING_CSS);
  // the reader's own fallback label: a lair's mark with none is a "Revenant lair", a bounty's a "Bounty"
  assert.equal(BM.readBountyMarks(() => [{ cx: 10, cy: 10, r: 1.5 }], { width: 100, height: 100 }, BM.REVENANT_LEGEND_TEXT)[0].label, 'Revenant lair');
  assert.equal(BM.readBountyMarks(() => [{ cx: 10, cy: 10, r: 1.5 }], { width: 100, height: 100 })[0].label, BM.BOUNTY_LEGEND_TEXT);
});

test('RVN7c THE MARKS: a circle at each lair heard of - of the living and unsworn alone, named for it, at its pixel\'s middle; none unheard of; none with the switch off (mutants: unknown lairs drawn; the sworn or the fallen drawn; the pixel\'s corner; the switch)', () => {
  const p = me();
  const r = made(p);
  assert.deepEqual(N.revenantMapMarks(), [{ cx: 106.5, cy: 100.5, r: 1.5, label: r.given, id: r.id }]);
  r.lairKnown = false;
  assert.deepEqual(N.revenantMapMarks(), [], 'unheard of');
  r.lairKnown = true; r.sworn = true;
  assert.deepEqual(N.revenantMapMarks(), [], 'sworn');
  r.sworn = false; r.defeated = true;
  assert.deepEqual(N.revenantMapMarks(), [], 'fallen');
  r.defeated = false; r.lair = null;
  assert.deepEqual(N.revenantMapMarks(), [], 'no lair');
  r.lair = { ...LAIR };
  setPref('lootRarity', false);
  assert.deepEqual(N.revenantMapMarks(), [], 'the switch off');
});

test('RVN7c THE INK SHEET: a lair\'s circle painted in blood red, its wash and its name; a bounty\'s still black (mutants: the lair unpainted; painted black)', () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (typeof k === 'string' ? (...a) => { calls.push([k, ...a]); if (k === 'measureText') return { width: 10 }; return undefined; } : undefined)),
    set: (t, k, v) => { t[k] = v; calls.push(['=' + String(k), v]); return true; },
  });
  paintInkOverlay(ctx, { ox: 0, oy: 0, scale: 4 }, { paperW: 400, paperH: 400, clear: true, revenants: [{ cx: 20, cy: 20, r: 1.5, label: 'Grushnak' }] });
  const sets = (k) => calls.filter((c) => c[0] === `=${k}`).map((c) => c[1]);
  assert.ok(sets('strokeStyle').includes(BM.REVENANT_RING_CSS), 'its ring');
  assert.ok(sets('fillStyle').includes(BM.REVENANT_FILL_CSS), 'its wash');
  assert.ok(calls.some((c) => c[0] === 'fillText' && c[1] === 'Grushnak'), 'its name');
  calls.length = 0;
  paintInkOverlay(ctx, { ox: 0, oy: 0, scale: 4 }, { paperW: 400, paperH: 400, clear: true, bounties: [{ cx: 20, cy: 20, r: 1.5, label: 'Rats' }] });
  assert.ok(sets('strokeStyle').includes(BM.BOUNTY_RING_CSS));
  assert.ok(!sets('strokeStyle').includes(BM.REVENANT_RING_CSS), 'a bounty stays black');
});

test('RVN7c EVERY MAP READS IT: the held map (its poll, its sheet, its legend), the classic region page (its texels and its repaint), and the world host\'s dep (mutants: any unwired)', () => {
  const h = read('src/ui/heldMap.js');
  assert.match(h, /const lairs = readBountyMarks\(this\.deps\.revenants, this\._size, REVENANT_LEGEND_TEXT\);/);
  assert.match(h, /if \(lKey !== this\._revenantsKey\) \{ this\._revenantsKey = lKey; this\._revenants = lairs; gateMoved = true; this\._dirty = true; \}/);
  assert.match(h, /revenants: this\._revenants,   \/\/ RVN7c/);
  assert.match(h, /if \(this\._revenants\.length\) \{   \/\/ RVN7c: and a lair's blood-red circle\n\s*const dot = el\('span', 'hmlegdot'\);\n\s*dot\.style\.background = REVENANT_RING_CSS;/);
  assert.match(h, /!this\._bounties\.length && !this\._revenants\.length && !this\._raids\.length/);
  const t = read('src/ui/travelMapWindow.js');
  assert.match(t, /const lairs = readBountyMarks\(this\.deps\.revenants, \{ width: MAP_WIDTH, height: MAP_HEIGHT \}, REVENANT_LEGEND_TEXT\);\n\s*this\._revenantsKey = bountyMarksKey\(lairs\);\n\s*if \(lairs\.length\) \{\n\s*const lairPx = packRGBA\(REVENANT_DOT_RGB\[0\], REVENANT_DOT_RGB\[1\], REVENANT_DOT_RGB\[2\], 255\);\n\s*for \(const \[x, y\] of bountyRingTexels\(lairs, originX, originY, width, height\)\) plot\(x, y, lairPx\);/);
  assert.match(t, /bountyMarksKey\(readBountyMarks\(this\.deps\.revenants, \{ width: MAP_WIDTH, height: MAP_HEIGHT \}, REVENANT_LEGEND_TEXT\)\) === \(this\._revenantsKey \?\? ''\)\n[^\n]*\) return false;/);   // PIN MOVED (FEUD's merge of main): HOME-VENDOR's trader is asked after the lairs
  assert.match(read('src/ui/inkMap.js'), /for \(const b of opts\.revenants \?\? \[\]\) if \(visible\(b\.cx, b\.cy, b\.r \+ 2\)\) paintBountyRing\(ctx, view, b, pulse, REVENANT_INK\);/);
  assert.match(read('src/scenes/world.js'), /revenants: \(\) => revenantMapMarks\(\),/);
});

test('RVN7c THE HUNT IN THE JOURNAL: each lair heard of a side quest - "Hunt: <name>", its kind and rank, its lair and the way there from where I stand, no clock; none unheard of; its Abandon through the journal leaf forgets the lair and saves it, and a rumour brings it back (mutants: unknown hunts listed; the way wrong; a clock; the Abandon unwired; unsaved)', () => {
  const p = me();
  const r = made(p);
  const rows = N.revenantHuntEntries({ px: 100, py: 100 });
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.id, `hunt:${r.id}`);
  assert.equal(row.name, `Hunt: ${r.name}`);
  assert.equal(row.hunt, true);
  assert.equal(row.clockSeconds, null, 'no clock');
  assert.deepEqual(row.messages[0].map((l) => l.text), ['Orc, rank I.', 'Its lair: Tomb of Vaness, a long walk to the east - marked on your map with a red circle.', 'Find it there before it finds you.']);
  assert.ok(row.messages[0].every((l) => l.formatting === 'text'));
  assert.equal(N.revenantHuntEntries({ px: 106, py: 100 })[0].messages[0][1].text, 'Its lair: Tomb of Vaness - marked on your map with a red circle.', 'standing on it');
  assert.equal(N.revenantHuntEntries(null)[0].messages[0][1].text, 'Its lair: Tomb of Vaness - marked on your map with a red circle.', 'nowhere known');
  r.lairKnown = false;
  assert.deepEqual(N.revenantHuntEntries({ px: 100, py: 100 }), [], 'unheard of');
  r.lairKnown = true;
  setPref('lootRarity', false);
  assert.deepEqual(N.revenantHuntEntries({ px: 100, py: 100 }), [], 'the switch off');
  setPref('lootRarity', true);
  // the Abandon, through the journal leaf
  assert.equal(HJ.HUNT_QUEST_PREFIX, 'hunt:');
  assert.equal(HJ.isHuntQuestId(row.id), true);
  assert.equal(HJ.isHuntQuestId('bounty:x'), false);
  assert.equal(HJ.isHuntQuestId(null), false);
  assert.equal(HJ.abandonHuntQuest('bounty:x'), false);
  assert.equal(HJ.abandonHuntQuest(`quest${r.id}`), false, 'another prefix of as many letters is no hunt');
  assert.equal(r.lairKnown, true);
  assert.equal(HJ.abandonHuntQuest(row.id), true);
  assert.equal(r.lairKnown, false, 'forgotten');
  assert.deepEqual(N.revenantHuntEntries({ px: 100, py: 100 }), []);
  assert.deepEqual(N.revenantMapMarks(), [], 'off the map');
  assert.equal(HJ.abandonHuntQuest(row.id), false, 'twice: nothing to forget');
  assert.equal(N.forgetRevenantLair('nobody'), false);
  N._resetRevenantForTests();
  assert.equal(N.revenantsFor(p).find((x) => x.id === r.id)?.lairKnown, false, 'saved');
  // heard again
  const again = N.revenantsFor(p).find((x) => x.id === r.id);
  again.weak = null;
  assert.ok(N.revenantRumor({ px: 100, py: 100, region: 3 }, { numAnswersGivenTellMeAboutOrRumors: 0 }, { rolls: () => 0 }));
  assert.equal(N.revenantHuntEntries({ px: 100, py: 100 }).length, 1, 'back in the journal');
  // the leaf with no door
  HJ.setHuntJournal(null);
  assert.equal(HJ.abandonHuntQuest(row.id), false);
});

test('RVN7c THE FACES AND THE HOST: the pause window\'s Quests tab and the chronicle each give a hunt its Abandon (twice), never a share; the world host folds the hunts into the quest log beside the bounties, the way from where I stand (mutants: a face unwired; a hunt shared; the log unwired)', () => {
  const m = read('src/ui/enhancedMenu.js');
  assert.match(m, /if \(sel\.entries && isHuntQuestId\(sel\.id\)\) \{[\s\S]{0,400}const ab = el\('button', 'act', armed \? 'Click again to abandon' : 'Abandon hunt'\);[\s\S]{0,200}abandonHuntQuest\(sel\.id\);/);
  const c = read('src/ui/enhancedChronicle.js');
  assert.match(c, /if \(section === 'quests' && isHuntQuestId\(e\.uid\)\) \{[\s\S]{0,500}abandonHuntQuest\(e\.uid\);/);
  assert.match(c, /!e\.main && !isBountyQuestId\(e\.uid\) && !isHuntQuestId\(e\.uid\)/, 'never the quest share');
  assert.match(read('src/scenes/world.js'), /const extra = \[\.\.\.\(bountyHost\?\.questLogEntries\?\.\(\) \?\? \[\]\), \.\.\.revenantHuntEntries\(rumorHere\(\)\)\];/);
});

test('RVN7c the page: a lair heard of is on the map (mutants: unsaid)', () => {
  assert.equal(lairWords({ lair: { ...LAIR }, lairKnown: true }), 'Lair: Tomb of Vaness - on your map.');
});
