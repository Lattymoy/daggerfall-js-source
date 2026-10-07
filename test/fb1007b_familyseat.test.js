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
import { foundFamily, readFamily, familyRng, MODELS, touch, LEGACY_VENDOR } from '../src/systems/legacy/family.js';
import { mergeFacts, loadFamily } from '../src/systems/legacy/store.js';
import { mergeLines } from '../src/systems/legacy/realmLine.js';
import { drawHousePage, setFamilyProvider, resetFamilyPages, disarmFamilyPages, SEAT_HINT } from '../src/ui/familyPages.js';
import { repaintKeepingScroll } from '../src/ui/domRepaint.js';
import { _resetModSaveData, modSaveRecords, restoreModSaveRecords } from '../src/systems/modSaveData.js';
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

/** The Legacy host the world host builds, over one storage; `w.town` is the town the one played stands in (null: none),
 *  `w.on` Project Legacy's switch. A second tab of the same character shares `w.storage` (`fresh: false`). */
function hostOf(w = { town: null, said: [], storage: mem(), wall: 1000 }, { name = 'Ysolde Hlaalu', fresh = true } = {}) {
  if (fresh) { _resetModSaveData(); _resetModSettings(); }
  const entity = ent(name);
  const host = createLegacyHost({
    entity, storage: () => w.storage, tab: () => mem(), on: () => w.on !== false, online: () => false, now: () => 100, own: () => 0,
    here: () => null, town: () => w.town, nearestTown: () => null, gold: () => 0, say: (t) => w.said.push(t), boot: () => {}, search: () => '',
    loadCharacter: () => false, saveNow: () => true, hasSave: () => true, inFight: () => false, rng: familyRng(5), wall: () => w.wall,
  });
  host.found(MODELS.enduring);
  return { host, w, entity };
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
  assert.equal(f.surname, 'Hlaalu', 'the house keeps its name');
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
  // AUDIT FB1007b T3: the store's copy newer, the save's move stands too (the save made on another device)
  assert.deepEqual(mergeFamily(JSON.parse(JSON.stringify(stale)), JSON.parse(JSON.stringify(moved)), 'c-seat').seat, { ...WAYREST, at: 5000 }, 'the store\'s copy newer, the save\'s move stands');
  assert.deepEqual(mergeFamily(JSON.parse(JSON.stringify(stale)), JSON.parse(JSON.stringify(f)), 'c-seat').seat, GLENPOINT, 'a save that moved nothing moves nothing');
  // a later move over an earlier one
  const later = JSON.parse(JSON.stringify(moved));
  later.seat = { ...GLENPOINT, at: 9000 };
  const was = JSON.parse(JSON.stringify(moved));
  touch(was); touch(was); touch(was);
  mergeFacts(was, later);
  assert.deepEqual(was.seat, { ...GLENPOINT, at: 9000 });
  // ...and the base holding the later move keeps it over the other's earlier one
  const keeps = JSON.parse(JSON.stringify(later));
  touch(keeps); touch(keeps); touch(keeps); touch(keeps);
  mergeFacts(keeps, JSON.parse(JSON.stringify(moved)));
  assert.deepEqual(keeps.seat, { ...GLENPOINT, at: 9000 }, 'an earlier move never stands over a later one');
  // neither moved: the base's, or the other's where the base has none (the first town noted, LEGACY-NAME's merge)
  const a = JSON.parse(JSON.stringify(f));
  mergeFacts(a, { ...JSON.parse(JSON.stringify(f)), seat: { ...WAYREST } });
  assert.deepEqual(a.seat, GLENPOINT);
  const none = { ...JSON.parse(JSON.stringify(f)), seat: null };
  mergeFacts(none, JSON.parse(JSON.stringify(f)));
  assert.deepEqual(none.seat, GLENPOINT);
  assert.deepEqual(readFamily(JSON.parse(JSON.stringify(f))).seat, GLENPOINT, 'a seat never moved reads without a stamp');
});

test('AUDIT FB1007b S1: the name is the house\'s, never its seat\'s - a copy that never learned the name takes the one the other holds though the seat moved since, in every merge; and a member of the blood a stale save left nameless takes the house\'s', () => {
  // a single-named founder, fresh from Privateer's Hold: a nameless house, named "of <town>" at its first town. Two tabs
  // of the character over one storage - tab B opened in the Hold, before the first town
  const w = { town: null, said: [], storage: mem(), wall: 1000 };
  const { host: a } = hostOf(w, { name: 'Ysolde' });
  const wb = { town: null, said: [], storage: w.storage, wall: 1000 };
  const { host: b } = hostOf(wb, { name: 'Ysolde', fresh: false });
  assert.equal(b.family.id, a.family.id, 'one house');
  assert.equal(a.family.surname, '', 'nameless in the Hold');
  w.town = { ...GLENPOINT };
  a.tick();
  assert.equal(a.family.surname, 'of Tamhope', 'named at its first town');
  w.town = { ...WAYREST }; w.wall = 5000;
  assert.deepEqual(a.moveFamilySeat(), { ok: true });
  assert.equal(a.family.surname, 'of Tamhope', 'the move keeps the name');
  modSaveRecords();   // tab B saves, still in the Hold - its copy nameless, its founder saved last
  const kept = loadFamily(w.storage, a.family.id);
  assert.deepEqual([kept.surname, kept.seat.loc], ['of Tamhope', 'Wayrest'], 'the store: the house\'s name, the moved seat (was "of Wayrest")');
  assert.equal(kept.people.find((p) => p.characterId === 'c-seat').surname, 'of Tamhope', 'and the founder\'s');
  assert.deepEqual(wb.said, [], 'nothing said of a name the house had');
  // the realm line's and the save's merges, either copy the base
  const named = JSON.parse(JSON.stringify(a.family));
  const nameless = JSON.parse(JSON.stringify(named));
  nameless.surname = ''; nameless.seat = null;
  for (const p of nameless.people) { p.surname = ''; p.savedAt = 9e12; }
  for (const [x, y] of [[named, nameless], [nameless, named]]) {
    const m = mergeLines(JSON.parse(JSON.stringify(x)), JSON.parse(JSON.stringify(y)));
    assert.deepEqual([m.surname, m.seat.loc], ['of Tamhope', 'Wayrest'], `the realm line, base rev ${m.rev}`);
    assert.ok(m.people.every((p) => p.surname === 'of Tamhope'), 'every member of the blood named with the house');
  }
  const later = JSON.parse(JSON.stringify(nameless)); touch(later);
  const m = mergeFamily(JSON.parse(JSON.stringify(named)), later, 'c-seat');
  assert.deepEqual([m.surname, m.seat.loc], ['of Tamhope', 'Wayrest'], 'the save\'s copy newer and nameless, the store\'s name stands');
  // a named base, a nameless copy that saved its founder last: the founder keeps the house's name
  const base = JSON.parse(JSON.stringify(named)); touch(base); touch(base);
  mergeFacts(base, JSON.parse(JSON.stringify(nameless)));
  assert.equal(base.people.find((p) => p.characterId === 'c-seat').surname, 'of Tamhope', 'a stale save never unnames a member');
});

test('AUDIT FB1007b S2: a move is stamped after the seat it moves, though this clock run behind the one that stamped it - the later move stands in every merge', () => {
  const { host, w } = hostOf();
  w.town = { ...GLENPOINT };
  host.tick();
  w.town = { ...WAYREST }; w.wall = 90000;   // a device's clock a day ahead
  host.moveFamilySeat();
  const ahead = JSON.parse(JSON.stringify(host.family));
  w.town = { ...GLENPOINT }; w.wall = 5000;  // this one's, set right
  assert.deepEqual(host.moveFamilySeat(), { ok: true });
  assert.deepEqual(host.family.seat, { ...GLENPOINT, at: 90001 }, 'after the seat it moved');
  touch(ahead); touch(ahead); touch(ahead); touch(ahead);   // that device's copy, the newer by rev
  for (const [x, y] of [[ahead, host.family], [host.family, ahead]]) {
    assert.equal(mergeLines(JSON.parse(JSON.stringify(x)), JSON.parse(JSON.stringify(y))).seat.loc, 'Tamhope', 'the later move');
  }
});

test('AUDIT FB1007b S3: the seat moves for the one played, alive, in the line\'s present, with Legacy on - and a town of the seat\'s name in another region is another town', () => {
  const { host, w, entity } = hostOf();
  w.town = { ...GLENPOINT };
  host.tick();
  w.town = { region: 'Wayrest', loc: 'Tamhope', mapId: 3303 };
  assert.deepEqual(host.familySeatHere(), w.town, 'another region\'s Tamhope: it may move there');
  w.town = { region: 'Glenpoint', loc: 'Copperham', mapId: 1102 };
  assert.deepEqual(host.familySeatHere(), w.town, 'and another town of the seat\'s region (T2)');
  w.town = { ...WAYREST };
  w.on = false;
  assert.equal(host.familySeatHere(), null, 'Legacy off');
  w.on = true;
  entity.characterId = 'c-heir';
  assert.equal(host.familySeatHere(), null, 'another character in the world (a switch in flight): the line is not theirs to move');
  entity.characterId = 'c-seat';
  const me = host.current();
  me.died = { at: 1, cause: 'slain' };
  assert.equal(host.familySeatHere(), null, 'the one played dead, before the Succession');
  delete me.died;
  assert.deepEqual(host.familySeatHere(), WAYREST, 'those alone refused it');
  // the past played back: a retired member's save loaded
  const rec = JSON.parse(JSON.stringify(host.family));
  rec.people.find((p) => p.characterId === 'c-seat').retired = 1;
  rec.rev += 5;
  restoreModSaveRecords({ [LEGACY_VENDOR]: rec });
  assert.ok(host.past, 'the past');
  assert.equal(host.familySeatHere(), null, 'the past played back');
  assert.deepEqual(host.moveFamilySeat(), { ok: false, why: LEGACY_TEXT.seatNowhere });
  assert.equal(host.family.seat.loc, 'Tamhope');
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

test('AUDIT FB1007b S3-S5: the House page says a refusal as one, leaves no armed word behind another press or visit, keeps the keyboard on the move\'s word (U7\'s way), and says where the seat can move where it is not offered', async () => {
  const { host, w } = hostOf();
  w.town = { ...GLENPOINT };
  host.tick();
  let past = null;
  setFamilyProvider({
    on: () => true, family: () => host.family, lived: () => 0, inWorld: () => true, livingWorld: () => true, switchRefusal: () => 'none',
    past: () => past, familySeatHere: () => host.familySeatHere(), moveFamilySeat: () => host.moveFamilySeat(),
  });
  resetFamilyPages();
  // the pause window's own repaint, the keyboard kept by data-focus (ui/domRepaint.js)
  const app = el('div');
  globalThis.document.body.append(app);
  const draw = () => repaintKeepingScroll(app, () => { app.innerHTML = ''; const d = el('div'); drawHousePage(d, draw, { el, divider }); app.append(d); }, { focus: true });
  const hint = () => app.querySelector('.fam-seathint')?.textContent ?? null;
  // S5: in the seat, the hint - the host's own refusal's words
  draw();
  assert.equal(SEAT_HINT, LEGACY_TEXT.seatNowhere);
  assert.equal(app.querySelector('.fam-moveseat'), null);
  assert.equal(hint(), SEAT_HINT, 'standing in the seat: where it can move');
  w.town = null;
  draw();
  assert.equal(hint(), SEAT_HINT, 'in the wilds');
  past = host.current();
  draw();
  assert.equal(hint(), null, 'the past played back: no hint of a move it never makes');
  past = null;
  host.family.pending = { fallenId: 1, at: 1, estate: 0, bequest: [] };
  draw();
  assert.equal(hint(), null, 'a Succession waits: none');
  delete host.family.pending;
  // the move offered: no hint
  w.town = { ...WAYREST };
  draw();
  assert.equal(hint(), null);
  // S3: an armed word never waits behind another page's press, or the next visit
  app.querySelector('.fam-moveseat').click();
  assert.match(app.textContent, /heirs will be born in Wayrest/);
  disarmFamilyPages();
  draw();
  assert.doesNotMatch(app.textContent, /heirs will be born/, 'disarmed: the word goes with the arming');
  assert.equal(app.querySelector('.fam-moveseat').textContent, 'Make Wayrest the family seat');
  app.querySelector('.fam-moveseat').click();
  resetFamilyPages();
  draw();
  assert.doesNotMatch(app.textContent, /heirs will be born/, 'a fresh visit: no word left over');
  // S3: a refused second press says the refusal - never the move
  app.querySelector('.fam-moveseat').click();
  const armed = app.querySelector('.fam-moveseat');
  armed.focus();
  host.family.pending = { fallenId: 1, at: 1, estate: 0, bequest: [] };   // a death between the presses
  armed.click();
  assert.equal(host.family.seat.loc, 'Tamhope', 'not moved');
  assert.equal(app.querySelector('.fam-why')?.textContent, LEGACY_TEXT.pending, 'the refusal said, as a refusal');
  assert.doesNotMatch(app.textContent, /is your family's seat now/);
  delete host.family.pending;
  // S4: the move's word holds the keyboard - the pressed button is gone with the move
  draw();
  app.querySelector('.fam-moveseat').focus();
  app.querySelector('.fam-moveseat').click();
  assert.equal(globalThis.document.activeElement?.textContent, 'Yes - make Wayrest the family seat', 'armed: the keyboard stays on the button');
  globalThis.document.activeElement.click();
  assert.equal(host.family.seat.loc, 'Wayrest');
  const said = app.querySelector('.fam-said');
  assert.equal(said?.textContent, 'Wayrest is your family\'s seat now.');
  assert.equal(said.getAttribute('tabindex'), '-1');
  assert.equal(said.getAttribute('data-focus'), 'fam-seat-said');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(globalThis.document.activeElement, said, 'the keyboard on the word, never fallen to the page');
  app.remove();
  setFamilyProvider(null);
});

test('FAMILY-SEAT: the world host hands the House page the Legacy host\'s two doors', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /familySeatHere: \(\) => legacyHost\?\.familySeatHere\(\) \?\? null,/);
  assert.match(w, /moveFamilySeat: \(\) => legacyHost\?\.moveFamilySeat\(\) \?\? \{ ok: false, why: 'Not here\.' \},/);
});
