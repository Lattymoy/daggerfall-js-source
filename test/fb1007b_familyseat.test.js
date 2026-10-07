// FIELD BUGS 2026-10-07b FAMILY-SEAT (afjiz on Discord, #feature-feedback, "Family Seat - Option to ...": "when you want
// your family to be situated in a specific town, especially if your fresh from Privateer's Hold, you have to really
// rough it. ... Fast travel will also kind of just steer you into towns so you have to manually be conscious of that
// too. It would be nice if maybe either you had the option in the enhanced ui to reset your family seat to a town your
// currently in, from one that it was in prior"). `01-Overview/Field-Bugs-2026-10-07b.md`.
//
// The seat is the first town the house stands in (legacyHost.js tick: the first second on a town's map pixel - a road
// past one, a journey's crossing), and nothing moved it. The House page moves it now, to the town the one played stands
// in, two presses as a switch is. A moved seat carries when (`at`), and every merge keeps the later move - the merge
// kept whichever copy was the base by rev, so a stale tab's write carried the old seat back over a move.
//
// Fixtures from the producers: the Legacy host (createLegacyHost) over a storage, foundFamily, the store's and the
// realm line's own merges, readFamily, and the House page drawn headless (chargenDom.mjs).
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLegacyHost, LEGACY_TEXT, mergeFamily } from '../src/scenes/legacyHost.js';
import { foundFamily, readFamily, familyRng, MODELS, touch } from '../src/systems/legacy/family.js';
import { mergeFacts, loadFamily } from '../src/systems/legacy/store.js';
import { mergeLines } from '../src/systems/legacy/realmLine.js';
import { drawHousePage, setFamilyProvider, resetFamilyPages } from '../src/ui/familyPages.js';
import { _resetModSaveData } from '../src/systems/modSaveData.js';
import { _resetModSettings } from '../src/systems/modSettings.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const mem = () => { const m = new Map(); return { map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const ent = (name) => ({
  name, gender: 'female', race: 'Breton', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
  level: 1, characterId: 'c-seat', chargenDone: true, health: 40, maxHealth: 40, items: [], wagonItems: [],
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, () => 20),
});
const GLENPOINT = Object.freeze({ region: 'Glenpoint', loc: 'Tamhope', mapId: 1101 });   // the first town a road crossed
const WAYREST = Object.freeze({ region: 'Wayrest', loc: 'Wayrest', mapId: 2202 });       // where the player wants the line

/** The Legacy host the world host builds, over one storage; `w.town` is the town the one played stands in (null: none). */
function hostOf(w = { town: null, said: [], storage: mem(), wall: 1000 }) {
  _resetModSaveData();
  _resetModSettings();
  const host = createLegacyHost({
    entity: ent('Ysolde Hlaalu'), storage: () => w.storage, tab: () => mem(), on: () => true, online: () => false, now: () => 100, own: () => 0,
    here: () => null, town: () => w.town, nearestTown: () => null, gold: () => 0, say: (t) => w.said.push(t), boot: () => {}, search: () => '',
    loadCharacter: () => false, saveNow: () => true, hasSave: () => true, inFight: () => false, rng: familyRng(5), wall: () => w.wall,
  });
  host.found(MODELS.enduring);
  return { host, w };
}

test('FAMILY-SEAT: the seat noted at the first town moves, at the player\'s word, to the town the one played stands in - stamped, said and stored; never to the town it is already, nowhere, or while a Succession waits', () => {
  const { host, w } = hostOf();
  const f = host.family;
  w.town = { ...GLENPOINT };
  host.tick();
  assert.deepEqual(f.seat, GLENPOINT, 'the first town is the seat, as ever');
  assert.equal(host.familySeatHere(), null, 'standing in the seat: nothing to move');
  w.town = null;
  assert.equal(host.familySeatHere(), null, 'in the wilds or under a town: no town to move it to');
  assert.deepEqual(host.moveFamilySeat(), { ok: false, why: LEGACY_TEXT.seatNowhere });
  w.town = { ...WAYREST };
  assert.deepEqual(host.familySeatHere(), WAYREST, 'in another town: it may move there');
  host.tick();
  assert.deepEqual(f.seat, GLENPOINT, 'and a tick never moves it on its own');
  const rev = f.rev;
  w.wall = 5000;
  assert.deepEqual(host.moveFamilySeat(), { ok: true });
  assert.deepEqual(f.seat, { ...WAYREST, at: 5000 }, 'the seat is the town, stamped by the wall clock');
  assert.ok(f.rev > rev, 'touched');
  assert.equal(w.said.at(-1), LEGACY_TEXT.seatMoved('Wayrest'));
  assert.deepEqual(loadFamily(w.storage, f.id).seat, { ...WAYREST, at: 5000 }, 'stored at once, the stamp with it (readFamily keeps it)');
  assert.equal(host.familySeatHere(), null, 'moved: standing in the seat again');
  w.town = { ...GLENPOINT };
  f.pending = { fallenId: 1, at: 1, estate: 0, bequest: [] };
  assert.equal(host.familySeatHere(), null, 'a Succession waits: the seat stays where the heir is to be born');
  assert.deepEqual(host.moveFamilySeat(), { ok: false, why: LEGACY_TEXT.pending });
});

test('FAMILY-SEAT: the later move stands in every merge - whichever copy is the base by rev - and a seat neither copy moved merges as it always did', () => {
  const f = foundFamily(ent('Ysolde Hlaalu'), { model: MODELS.enduring, seat: { ...GLENPOINT }, rng: familyRng(1), id: 'fam-seat-aaaaaa' });
  const moved = readFamily(JSON.parse(JSON.stringify(f)));
  moved.seat = { ...WAYREST, at: 5000 };
  touch(moved);
  const stale = readFamily(JSON.parse(JSON.stringify(f)));
  touch(stale); touch(stale);   // a stale tab's later writes: the newer by rev, with the old seat
  assert.ok(stale.rev > moved.rev);
  assert.deepEqual(mergeLines(JSON.parse(JSON.stringify(stale)), JSON.parse(JSON.stringify(moved))).seat, { ...WAYREST, at: 5000 }, 'the realm line: the move over the newer stale copy');
  assert.deepEqual(mergeLines(JSON.parse(JSON.stringify(moved)), JSON.parse(JSON.stringify(stale))).seat, { ...WAYREST, at: 5000 }, 'either way round');
  const base = JSON.parse(JSON.stringify(stale));
  mergeFacts(base, JSON.parse(JSON.stringify(moved)));
  assert.deepEqual(base.seat, { ...WAYREST, at: 5000 }, 'the store\'s merge');
  assert.deepEqual(mergeFamily(JSON.parse(JSON.stringify(moved)), JSON.parse(JSON.stringify(stale)), 'c-seat').seat, { ...WAYREST, at: 5000 }, 'the save\'s copy newer, the store\'s move stands');
  // a later move over an earlier one
  const later = JSON.parse(JSON.stringify(moved));
  later.seat = { ...GLENPOINT, at: 9000 };
  const was = JSON.parse(JSON.stringify(moved));
  touch(was); touch(was); touch(was);
  mergeFacts(was, later);
  assert.deepEqual(was.seat, { ...GLENPOINT, at: 9000 });
  // neither moved: the base's, or the other's where the base has none (the first town noted, LEGACY-NAME's merge)
  const a = JSON.parse(JSON.stringify(f));
  mergeFacts(a, { ...JSON.parse(JSON.stringify(f)), seat: { ...WAYREST } });
  assert.deepEqual(a.seat, GLENPOINT);
  const none = { ...JSON.parse(JSON.stringify(f)), seat: null };
  mergeFacts(none, JSON.parse(JSON.stringify(f)));
  assert.deepEqual(none.seat, GLENPOINT);
  assert.deepEqual(readFamily(JSON.parse(JSON.stringify(f))).seat, GLENPOINT, 'a seat never moved reads without a stamp');
});

const el = (tag, cls, text) => { const n = globalThis.document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
const divider = (t) => el('h2', null, t);

test('FAMILY-SEAT: the House page offers the town the one played stands in - one press says what moving the seat does, the second moves it - and offers nothing where there is nothing to move', () => {
  const { host, w } = hostOf();
  w.town = { ...GLENPOINT };
  host.tick();
  let d = null, moves = 0;
  setFamilyProvider({
    on: () => true, family: () => host.family, lived: () => 0, inWorld: () => true, livingWorld: () => true, switchRefusal: () => 'none',
    familySeatHere: () => host.familySeatHere(), moveFamilySeat: () => { moves++; return host.moveFamilySeat(); },
  });
  resetFamilyPages();
  const draw = () => { d = el('div'); drawHousePage(d, draw, { el, divider }); };
  draw();
  assert.equal(d.querySelector('.fam-moveseat'), null, 'standing in the seat: no button');
  w.town = { ...WAYREST };
  draw();
  const b = d.querySelector('.fam-moveseat');
  assert.equal(b?.textContent, 'Make Wayrest the family seat');
  b.click();
  assert.equal(moves, 0, 'the first press moves nothing');
  assert.equal(d.querySelector('.fam-moveseat').textContent, 'Yes - make Wayrest the family seat');
  assert.match(d.textContent, /heirs will be born in Wayrest/);
  d.querySelector('.fam-moveseat').click();
  assert.equal(moves, 1);
  assert.equal(host.family.seat.loc, 'Wayrest');
  assert.equal(d.querySelector('.fam-moveseat'), null, 'moved: standing in the seat');
  assert.match(d.textContent, /Wayrest is your family's seat now\./);
  const g = d.querySelector('.fam-grid');
  const i = g.children.findIndex((c) => c.textContent === 'Seat');
  assert.equal(g.children[i + 1].textContent, 'Wayrest, Wayrest', 'the Seat fact says the new seat');
  draw();
  assert.doesNotMatch(d.textContent, /is your family's seat now/, 'the word is said once');
  setFamilyProvider(null);
});

test('FAMILY-SEAT: the world host hands the House page the Legacy host\'s two doors', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /familySeatHere: \(\) => legacyHost\?\.familySeatHere\(\) \?\? null,/);
  assert.match(w, /moveFamilySeat: \(\) => legacyHost\?\.moveFamilySeat\(\) \?\? \{ ok: false, why: 'Not here\.' \},/);
});
