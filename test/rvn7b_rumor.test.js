// RVN7b - THE RUMOUR (bible/12-Enhanced-AI/Feud-Arc.md section 18.2; Mac, 2026-10-04: "more complex, less easy to
// accomplish and more detailed", then "Go"). "Any news?" asked within 20 px of a living, unsworn revenant's lair, or
// in its lair's region, one time in 0.35 is answered with it - built from its record ("They say a scarred orc called
// Grushnak the Butcher has been seen near the Tomb of Vaness, a long walk to the east.") - spending the person's one
// answer as the mill does, and marking its lair known. One rumour in two carries its weakness: hinted, or one time in
// three named. Nothing is written into the mill.
// Pinned: the numbers and the hints; the words, every gate (the odds, the person's answer and the spymaster, the reach
// and the region, the sworn, the fallen, no lair, the switch), the pick among several, the weakness both ways and
// never forgotten, the record marked and saved; the world host's door before the mill.
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
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS } = await import('../src/systems/rumorMill.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const me = (id = 'char-rvn7b') => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 });

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); setPlayerDoor(null); setWorldMinutes(1440 + 120);
});

const LAIR = Object.freeze({ px: 106, py: 100, name: 'Tomb of Vaness', region: 3 });
function made(p, { mobileType = M.Orc, scars = true, weak = 'fire', lair = LAIR } = {}) {
  const r = N.revenantDeed(p, { mobileType, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType, rolls: () => 0 });
  r.lair = lair ? { ...lair } : null; r.lairKnown = false; r.weak = weak; r.weakKnown = 0;
  r.scars = scars ? [{ k: 'blade', at: 0 }] : [];
  return r;
}
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const fresh = () => ({ numAnswersGivenTellMeAboutOrRumors: 0, isSpyMaster: false });
const HERE = Object.freeze({ px: 100, py: 100, region: 7 });

test('RVN7b THE NUMBERS: one in two carries its weakness, one in three of those named; the hints by its kind (mutants: any moved)', () => {
  assert.equal(F.RUMOR_WEAK, 0.5);
  assert.equal(F.RUMOR_NAMED, 1 / 3);
  assert.deepEqual({ ...F.RUMOR_HINTS }, { element: 'some element is its bane', metal: 'a metal bites it deep', weapon: 'one kind of weapon hurts it more than the rest', sun: 'it shuns the sun' });
  assert.equal(MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS, 1);
});

test('RVN7b THE WORDS: within reach, one time in 0.35 - its kind (scarred or not), its name, its lair, how far and which way; the person\'s one answer spent and its lair known, saved; past the odds nothing spent (mutants: the odds; the answer unspent; the lair unknown; the way or the distance wrong)', () => {
  const p = me();
  const r = made(p);
  const s = fresh();
  assert.equal(N.revenantRumor(HERE, s, { rolls: seq(0.34, 0, 0.9) }), `They say a scarred orc called ${r.name} has been seen near Tomb of Vaness, a long walk to the east.`);
  assert.equal(s.numAnswersGivenTellMeAboutOrRumors, 1, 'the answer spent');
  assert.equal(r.lairKnown, true, 'its lair known');
  N._resetRevenantForTests();   // the mirror read back from the save: its lair known there too
  assert.equal(N.revenantsFor(p).find((x) => x.id === r.id)?.lairKnown, true, 'saved');
  // past the odds: the mill's turn, nothing spent
  N._resetRevenantForTests(); _store.clear();
  const q = made(p);
  const s2 = fresh();
  assert.equal(N.revenantRumor(HERE, s2, { rolls: seq(0.35, 0, 0) }), null);
  assert.equal(s2.numAnswersGivenTellMeAboutOrRumors, 0);
  assert.equal(q.lairKnown, false);
  // its kind with no scar, the ways and the distances
  N._resetRevenantForTests(); _store.clear();
  const o = made(p, { scars: false, lair: { px: 100, py: 96, name: 'North Barrow', region: 3 } });
  assert.equal(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.9) }), `They say an orc called ${o.name} has been seen near North Barrow, half a day's walk to the north.`);
  o.lair = { px: 90, py: 110, name: 'Deep Hole', region: 3 };
  assert.equal(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.9) }), `They say an orc called ${o.name} has been seen near Deep Hole, a day's ride to the south-west.`);
  o.lair = { px: 102, py: 101, name: 'Near Den', region: 3 };
  assert.match(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.9) }), /near Near Den, a short walk to the (south-)?east\.$/);
  o.lair = { px: 103, py: 103, name: 'Square Den', region: 3 };
  assert.match(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.9) }), /near Square Den, a short walk to the south-east\.$/, 'the boards\' measure: the longer side');
  o.lair = { px: 100, py: 100, name: 'Under Town', region: 3 };
  assert.match(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.9) }), /seen in Under Town, close by\.$/);
});

test('RVN7b THE GATES: a person with no answer left has none (a spymaster always does); out of reach and of its region, none - in its region however far, one; the sworn, the fallen and one with no lair, none; the switch off, none (mutants: each gate dropped)', () => {
  const p = me();
  const r = made(p);
  assert.equal(N.revenantRumor(HERE, { numAnswersGivenTellMeAboutOrRumors: 1 }, { rolls: seq(0, 0, 0.9) }), null, 'spent');
  assert.ok(N.revenantRumor(HERE, { numAnswersGivenTellMeAboutOrRumors: 1, isSpyMaster: true }, { rolls: seq(0, 0, 0.9) }), 'a spymaster');
  r.lair = { ...LAIR, px: 121, py: 100, region: 3 };
  assert.equal(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.9) }), null, '21 px off, another region');
  r.lair = { ...LAIR, px: 120, py: 100, region: 3 };
  assert.ok(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.9) }), '20 px: in reach');
  r.lair = { ...LAIR, px: 160, py: 100, region: 7 };
  assert.ok(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.9) }), 'its own region, however far');
  assert.equal(N.revenantRumor({ ...HERE, region: -1 }, fresh(), { rolls: seq(0, 0, 0.9) }), null, 'no region of mine: reach alone');
  r.lair = { ...LAIR, px: 160, py: 100, region: -1 };
  assert.equal(N.revenantRumor({ ...HERE, region: -1 }, fresh(), { rolls: seq(0, 0, 0.9) }), null, 'two unknown regions are no match');
  r.lair = { ...LAIR };
  r.sworn = true;
  assert.equal(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.9) }), null, 'sworn');
  r.sworn = false; r.defeated = true;
  assert.equal(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.9) }), null, 'fallen');
  r.defeated = false; r.lair = null;
  assert.equal(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.9) }), null, 'no lair');
  r.lair = { ...LAIR };
  setPref('lootRarity', false);
  assert.equal(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.9) }), null, 'the switch off');
  setPref('lootRarity', true);
  assert.equal(N.revenantRumor(null, fresh()), null);
  assert.equal(N.revenantRumor(HERE, null), null);
  assert.equal(N.revenantRumor({ px: 1.5, py: 2, region: 3 }, fresh(), { rolls: seq(0, 0, 0.9) }), null, 'no pixel, even in its region');
});

test('RVN7b THE PICK AND THE WEAKNESS: of several in reach, the roll\'s; one in two carries its weakness - hinted by its kind, one in three named - and what the player knows of it never goes back (mutants: the first always; the weakness always or never; named always; the known forgotten)', () => {
  const p = me();
  const a = made(p, { lair: { ...LAIR, name: 'A Den' } });
  N.revenantDeed(p, { mobileType: M.Orc, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  const b = N.revenantsFor(p).find((x) => x !== a);
  b.lair = { ...LAIR, name: 'B Den' }; b.weak = 'silver'; b.weakKnown = 0;
  assert.match(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.9) }), /A Den/);
  assert.match(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0.99, 0.9) }), /B Den/);
  // its weakness
  assert.equal(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.49, 0.5) }).endsWith(' Folk say some element is its bane.'), true, 'hinted');
  assert.equal(a.weakKnown, 1);
  assert.equal(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.49, 0.33) }).endsWith(" Folk say it can't abide fire."), true, 'named');
  assert.equal(a.weakKnown, 2);
  N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.49, 0.9) });
  assert.equal(a.weakKnown, 2, 'never forgotten');
  assert.equal(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0, 0.5, 0) }).includes('Folk say'), false, 'one in two');
  assert.equal(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0.99, 0.1, 0.9) }).endsWith(' Folk say a metal bites it deep.'), true, 'a metal hinted');
  b.weak = 'daylight';
  assert.equal(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0.99, 0.1, 0.9) }).endsWith(' Folk say it shuns the sun.'), true);
  b.weak = 'axe';
  assert.equal(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0.99, 0.1, 0.1) }).endsWith(" Folk say it can't abide axes."), true);
  b.weak = null;
  assert.equal(N.revenantRumor(HERE, fresh(), { rolls: seq(0, 0.99, 0.1, 0.1) }).includes('Folk say'), false, 'no weakness, none said');
});

test('RVN7b THE WORLD HOST: its talk asks the revenants first, at my map pixel and region, then the mill (mutants: unwired; the mill first)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /getNewsOrRumors: \(session\) => revenantRumor\(rumorHere\(\), session\) \?\? rumorMill\.getNewsOrRumors\(session\),/);
  assert.match(w, /function rumorHere\(\) \{ const p = playerTravelPixel\(\); return \{ px: p\.x, py: p\.y, region: _questRegionIndex\(\) \}; \}/);
});
