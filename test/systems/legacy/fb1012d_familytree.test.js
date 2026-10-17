// FIELD BUGS 2026-10-12b (Discord #bug-reports, "Odd family tree behavior"; `01-Overview/bugs/Field-Bugs-2026-10-12d.md`):
// "A marriage between two Enduring bloodline characters resulted in some strange things happening with the family tree.
// ... The two heirs originally had two different names and classes, but once the mantle was passed on they suddenly both
// had the same name and class, although different birthdays. ... The nightblade is gone entirely." And: "the house
// (admittedly a tiny hovel on a farm) purchased and made the seat of the house by the parent character was not where the
// heir ended up spawning ... the game spat them out near Privateer's Hold instead of starting them at the family's seat."
//
// HEIR-CLONE. Online the heir's birth waits on the realm with the world running (scenes/world.js legacyRealmBirth: the
// world standing, the character made, its first save), and the fall it answers is settled only as the heir lands
// (legacyHost.js onBorn, AUDIT LEGACY II B1) - so the slow tick offered the waiting Succession again OVER THE NEWBORN, its
// lit choice the other heir. One press made that heir the line's current on a page playing the newborn, and the birth's
// first save wrote the newborn over them (writeCurrent: a person with no character id passed its guard) - name, class,
// face and the newborn's character id, their own birthday kept. Now the page bearing a member offers no Succession, and a
// save writes only the person who IS the character in the world.
// BIRTH-START. The Online page's waiting house (HOUSE-WAITS) booted its birth with the classic start, which the world
// host reads before the place the birth names: the heir stood in Privateer's Hold. Now its birth starts in its seat.
// SEAT-HOME. The seat moved only to a TOWN, and a home on a farm stands on no town's map: the line lived there, its heirs
// were born in the town first noted. Now the seat moves to a place where the house holds a home of its own as well, and
// a member met there is born there.
//
// Fixtures from the producers: the Legacy host (createLegacyHost) over one storage and one tab, its own founding,
// wedding (wedPlayer, a union's shape as net/wedSession.js hands it), children (the slow tick's childStep), mantle,
// Succession, birth and save (modSaveRecords - the save's own GetSaveData); main.js's front door and world.js's start
// and town reads run off their own text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLegacyHost, LEGACY_TEXT } from '../../../src/scenes/legacyHost.js';
import { personOf, familyRng, MODELS, LEGACY_MOD, fullNameOf } from '../../../src/systems/legacy/family.js';
import { loadFamily, readBirth } from '../../../src/systems/legacy/store.js';
import { isTownEntry } from '../../../src/systems/legacy/places.js';
import { BOOT_DOOR_KEYS, publishBootParams } from '../../../src/systems/online/onlineLane.js';
import { testStartsOutdoors } from '../../../src/systems/testRoom.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { modSaveRecords, restoreModSaveRecords, _resetModSaveData } from '../../../src/systems/modSaveData.js';
import { setModSetting, _resetModSettings } from '../../../src/systems/modSettings.js';

const rd = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
const MAIN = rd('src/main.js');
const W = rd('src/scenes/world.js');
const AsyncFunction = (async () => {}).constructor;
const mem = () => { const m = new Map(); return { map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const tick = () => new Promise((r) => { setImmediate(r); });

/** The character in the world, as finishChargen leaves it - a person's own identity when one is born. */
const ent = (cid, name, { careerIndex = 5, className = 'Nightblade', race = 'DarkElf', gender = 'female', faceIndex = 3 } = {}) => ({
  name, gender, race, faceIndex, careerIndex, career: { name: className, primarySkills: [28], majorSkills: [], minorSkills: [] },
  level: 9, characterId: cid, chargenDone: true, health: 40, maxHealth: 40, items: [], wagonItems: [],
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)),
});
const bornEntity = (p, cid) => ent(cid, fullNameOf(p.given, p.surname), { careerIndex: p.careerIndex, className: p.className, race: p.race, gender: p.gender, faceIndex: p.face });
/** The other player's character, as the realm's union names it (server-account/src/legacy.js unionView). */
const CARD = { player: 'acct-iszara', char: 'r0123456789abcdef0123', name: 'Iszara Dres', house: { hn: 'Dres', hc: 'Iszara' }, gender: 'male', race: 'Redguard', face: 7 };

/** world.js's own `town` read - a town is the one standing on the pixel, never a dungeon below it. */
const TOWN_OF = (() => {
  const m = /\n {4}town: (\(h\) => \(h && h\.mode !== 'dungeon'[^\n]*?: null\)),\n/.exec(W);
  assert.ok(m, 'world.js\'s town read moved');
  return new Function('isTownEntry', `return ${m[1]};`)(isTownEntry);
})();
/** Where the one played stands, in the shape world.js legacyHere mints. */
const at = (region, loc, locationType, mapId, mode = 'exterior') => ({ pixel: { x: 10, y: 20 }, regionIndex: 17, region, mode, loc, locationType, mapId, dungeon: null, pos: null, world: null });
const GOTHWAY = at('Daggerfall', 'Gothway Garden', LOCATION_TYPES.TownVillage, 5001);
const FARM = at('Daggerfall', 'Ashfield Farm', LOCATION_TYPES.HomeFarms, 7707, 'interior');
const HOVEL = Object.freeze({ regionIndex: 17, mapId: 7707, buildingKey: 3, location: 'Ashfield Farm' });

/** One tab of the world host's Legacy host, online, over the account's storage and the tab's. */
function page(w, { realm = true } = {}) {
  return createLegacyHost({
    get entity() { return w.e; }, storage: () => w.storage, tab: () => w.tab, on: () => true, online: () => w.online,
    now: () => 100 + Math.floor(w.own / 1440), own: () => w.own, here: () => w.here, town: TOWN_OF,
    nearestTown: () => ({ region: 'Daggerfall', loc: 'Gothway Garden' }), gold: () => 0, say: (l) => w.said.push(l),
    boot: (s) => w.booted.push(s), search: () => (w.online ? '?online=1&realm=r-elder&load=1' : '?world=1'),
    loadCharacter: () => false, saveNow: () => { w.saves.push(modSaveRecords()); return true; }, hasSave: () => true, inFight: () => false,
    rng: familyRng(11), templeOf: () => null, realmId: () => w.e?.characterId ?? null, heldHouses: () => w.held,
    tombstone: () => Promise.resolve(realm),
  });
}
function world({ online = true, siblings = 0, model = MODELS.enduring } = {}) {
  _resetModSaveData();
  _resetModSettings();
  const w = { storage: mem(), tab: mem(), said: [], booted: [], saves: [], own: 0, online, here: null, held: [], e: ent('r-elder', 'Ysolde Hlaalu') };
  setModSetting(LEGACY_MOD, 'Family.Siblings Probability', siblings ? 100 : 0);
  setModSetting(LEGACY_MOD, 'Family.Max Siblings', siblings);
  w.host = page(w);
  w.host.found(model);
  _resetModSettings();
  return w;
}
/** What of a person a save writes (store.js MEMBER_SAVE_FIELDS' identity) and who they are (born, character id). */
const who = (p) => ({ given: p.given, surname: p.surname, gender: p.gender, race: p.race, face: p.face, careerIndex: p.careerIndex, className: p.className, born: p.born, characterId: p.characterId });

test('HEIR-CLONE: the report - two players wed, two children of the union, the elder passes the mantle online and the second carries it on: the page bearing them offers no Succession, the first child stays themselves, and one person is the heir\'s character (mutants: the born page\'s Succession; a save into one never played)', async () => {
  const w = world();
  const elder = w.host.current();
  w.host.wedPlayer({ sid: 'wedAbc1234', mine: 'r-elder', partner: CARD, at: 5, endedAt: null, endedWhy: null, endedBy: null });
  const fam = w.host.family;
  // the children of the union, on the elder's own clock (marriage.js childStep, the slow tick's)
  for (let d = 1; fam.people.filter((p) => p.parents.includes(elder.id)).length < 2 && d < 400; d++) { w.own = d * 30 * 1440; w.host.tick(); }
  const [first, second] = fam.people.filter((p) => p.parents.includes(elder.id));
  assert.ok(first && second, 'two children of the union');
  assert.notEqual(first.born, second.born, 'born on two days');
  const firstWas = who(first);
  // the elder passes the mantle and the second child carries it on (the Succession's choice)
  elder.toll = 200;
  const out = w.host.passMantle();
  assert.equal(out.ok, true);
  assert.deepEqual(out.outcome.choices.map((p) => p.id), [first.id, second.id], 'both children may carry it on');
  assert.equal(w.host.succeed({ personId: second.id }), true);
  await tick();
  assert.equal(w.booted.length, 1, 'the boot, once the realm heard the retirement');
  assert.match(w.booted[0], new RegExp(`realmnew=1&legacyborn=${second.id}&`), 'born into the realm');
  // THE PAGE BEARING THEM: the world host's boot (`?legacyborn=`) over the same storage and tab - no realm session yet,
  // so its tombstone answers false (scenes/world.js: `realmSession ? realmSession.die(why) : false`)
  w.e = { chargenDone: false, characterId: null };
  const born = page(w, { realm: false });
  assert.ok(born.takeBorn(String(second.id)), 'the birth waits for this page');
  w.e = bornEntity(born.current(), 'c-client');   // finishChargen over bornResult: the person's own identity
  assert.equal(born.family.pending?.fallenId, elder.id, 'the fall waits on the record until the heir lands (AUDIT LEGACY II B1)');
  assert.equal(born.tick(), null, 'the page bearing the heir offers the Succession to nobody - it IS the answer');
  // and a choice made all the same (the window an older build raised, its lit button the first child's): the save the
  // birth makes writes the newborn into the newborn alone
  born.succeed({ personId: first.id });
  w.e.characterId = 'r-heir';   // realmCreateLegacy: the realm's id
  born.rebind('c-client', 'r-heir');
  assert.equal(born.onBorn(), true);
  const kept = loadFamily(w.storage, fam.id);
  assert.deepEqual(who(personOf(kept, first.id)), firstWas, 'the first child is themselves - name, class, face, birthday, and never played');
  assert.equal(personOf(kept, second.id).characterId, 'r-heir', 'the heir is the realm\'s character');
  assert.deepEqual(kept.people.filter((p) => p.characterId === 'r-heir').map((p) => p.id), [second.id], 'one person is the heir\'s character');
  // the realm's boot of the heir loads them: the person who IS that character is the one played
  w.e = bornEntity(personOf(kept, second.id), 'r-heir');
  const joined = page(w);
  restoreModSaveRecords(w.saves.at(-1));
  assert.equal(joined.current()?.id, second.id);
  modSaveRecords();
  assert.deepEqual(who(personOf(loadFamily(w.storage, fam.id), first.id)), firstWas, 'and every save after');
});

test('HEIR-CLONE: a save writes only the person who IS the character in the world - never a member a choice made current while this page still plays its own (a Succession after a fall, a switch), before the boot goes (mutant: a save into one never played)', async () => {
  // a Bloodline fall, offline: the Succession's choice of a sibling never played - the page plays the fallen until the boot
  const w = world({ online: false, siblings: 1, model: MODELS.bloodline });
  const sib = w.host.family.people.find((p) => p.id !== w.host.current().id);
  assert.ok(sib && !sib.characterId, 'a sibling never played (rollSiblings)');
  const sibWas = who(sib);
  assert.equal(w.host.deathOutcome().kind, 'fall');
  assert.equal(w.host.succeed({ personId: sib.id }), true);
  assert.equal(w.host.current().id, sib.id, 'the line\'s current is the heir');
  assert.equal(w.booted.length, 1);
  modSaveRecords();   // the page's save before it goes (an exit's, a checkpoint's)
  assert.deepEqual(who(personOf(loadFamily(w.storage, w.host.family.id), sib.id)), sibWas, 'the fallen is never written over the heir');
  // a switch to a sibling never played: saved first, then theirs - and a save after writes nothing into them
  const v = world({ online: false, siblings: 1 });
  const other = v.host.family.people.find((p) => p.id !== v.host.current().id);
  const otherWas = who(other);
  assert.equal(v.host.switchTo(other.id).ok, true);
  modSaveRecords();
  assert.deepEqual(who(personOf(loadFamily(v.storage, v.host.family.id), other.id)), otherWas, 'the switch\'s target stays themselves');
  // the one played is still written by every save of theirs
  const u = world({ online: false });
  u.e.level = 12;
  modSaveRecords();
  assert.equal(personOf(loadFamily(u.storage, u.host.family.id), u.host.current().id).level, 12, 'the played member, written');
});

/** main.js's front door for a menu choice, run off its own text (test/systems/fb0930_realmbirth.test.js's lift): the params the
 *  world host is booted with. */
async function frontDoor(choice, legacyBirth = null) {
  const at0 = MAIN.indexOf("if (choice !== 'begin') {");
  const end = MAIN.indexOf('return bootWorld(canvas, renderer, params, status);', at0);
  assert.ok(at0 > 0 && end > at0, 'the front door\'s decisions moved');
  const body = MAIN.slice(at0 + "if (choice !== 'begin') {".length, end + 'return bootWorld(canvas, renderer, params, status);'.length).replace(/await import\(/g, 'await load(');
  const params = new URLSearchParams('?fps');
  const load = async (p) => {
    if (p === './ui/enhanced/enhancedMenu.js') return { takePickedSaveKey: () => null, takePickedRealmId: () => null, takePickedLegacyBirth: () => legacyBirth };
    if (p === './systems/testRoom.js') return { testStartsOutdoors };
    throw new Error(`the front door imports ${p}: the pin needs it`);
  };
  let booted = null;
  const run = new AsyncFunction('params', 'choice', 'ensureData', 'load', 'publishBootParams', 'bootWorld', 'canvas', 'renderer', 'status', body);
  await run(params, choice, async () => {}, load, (p) => publishBootParams(p, { history: null, location: null }), (c, r, p) => { booted = new URLSearchParams(p); return 'bootWorld'; }, null, null, null);
  return booted;
}
/** world.js's start, run off its own text: the location the boot stands the world at, over a start cell holding
 *  Privateer's Hold and a named place. */
function startOf(params) {
  const from = W.indexOf('  let startLoc = null;\n  if (params.has(\'classic\')) {');
  const to = W.indexOf('  if (!startLoc) throw new Error(`location not found: ${regionName}/${locationName}`);', from);
  assert.ok(from > 0 && to > from, 'world.js\'s start moved');
  const names = /const regionName = ([^;\n]+);\n\s*const locationName = ([^;\n]+);/.exec(W);
  assert.ok(names, 'world.js\'s start names moved');
  const HOLD = { name: 'Privateer\'s Hold' };
  const run = new Function('params', 'getInt', 'locationIndex', 'maps', `const regionName = ${names[1]}; const locationName = ${names[2]}; ${W.slice(from, to)} return startLoc;`);
  const loc = run(params, (s, k) => (k === 'StartCellX' ? 109 : 158), new Map([['109,158', HOLD]]), { getLocationByName: (r, l) => ({ name: `${l}, ${r}` }) });
  return loc?.name ?? null;
}

test('BIRTH-START: a member born from the Online page\'s waiting house is born in the seat its birth names - never the classic start\'s Privateer\'s Hold; every other door begins where Daggerfall begins (mutant: the classic start kept)', async () => {
  const birth = await frontDoor('online-new', { personId: 4, region: 'Daggerfall', loc: 'Ashfield Farm' });
  assert.equal(birth.get('legacyborn'), '4');
  assert.equal(birth.has('classic'), false, 'no classic start under the birth');
  assert.equal(startOf(birth), 'Ashfield Farm, Daggerfall', 'the world stands in the seat');
  const fresh = await frontDoor('online-new');
  assert.equal(fresh.get('classic'), '1', 'a new online character begins in the start cell, as ever');
  assert.equal(startOf(fresh), 'Privateer\'s Hold');
  assert.equal(startOf(await frontDoor('new')), 'Privateer\'s Hold', 'and a new game');
});

test('SEAT-HOME: the seat moves to a place where the house holds a home of its own - a farm\'s hovel - and the members never played are born there; never a farm not the house\'s, never a dungeon under it (mutants: the home\'s arm; any farm; the move\'s read; the dungeon)', async () => {
  const w = world({ online: false, siblings: 1 });
  const f = w.host.family;
  w.here = GOTHWAY;
  w.held = [{ regionIndex: 17, mapId: 5001, buildingKey: 9, location: 'Gothway Garden' }];   // a house in the town
  w.host.tick();
  modSaveRecords();
  assert.equal(f.seat?.loc, 'Gothway Garden', 'the first town is the seat, as ever');
  w.here = FARM;
  assert.equal(w.host.familySeatHere(), null, 'a farm the house holds no home on: nowhere to move it');
  assert.deepEqual(w.host.moveFamilySeat(), { ok: false, why: LEGACY_TEXT.seatNowhere });
  w.held = [HOVEL];   // the town house sold, the hovel bought (banking.js's deed rows) - the line learns it with the save that holds it
  modSaveRecords();
  assert.deepEqual(f.houses.map((h) => h.location), ['Ashfield Farm'], 'the line\'s home');
  assert.deepEqual(w.host.familySeatHere(), { region: 'Daggerfall', loc: 'Ashfield Farm', mapId: 7707 }, 'standing in the hovel: the farm may be the seat');
  w.here = { ...FARM, mode: 'dungeon' };
  assert.equal(w.host.familySeatHere(), null, 'never a dungeon under it');
  w.here = FARM;
  assert.deepEqual(w.host.moveFamilySeat(), { ok: true });
  assert.equal(f.seat.loc, 'Ashfield Farm');
  assert.equal(w.said.at(-1), LEGACY_TEXT.seatMoved('Ashfield Farm'));
  assert.deepEqual(loadFamily(w.storage, f.id).seat, { region: 'Daggerfall', loc: 'Ashfield Farm', mapId: 7707, at: f.seat.at }, 'stored');
  // a member never played is born at the seat - the farm - wherever the one who chose stands (legacyHost.js play, the
  // Succession's and the Family tab's one door)
  const sib = f.people.find((p) => p.id !== w.host.current().id);
  w.here = GOTHWAY;
  assert.equal(w.host.switchTo(sib.id).ok, true);
  assert.match(w.booted.at(-1), new RegExp(`legacyborn=${sib.id}&region=Daggerfall&loc=Ashfield\\+Farm$`), 'born in the seat: the farm');
});

test('SEAT-HOME: a member met at a home of the house\'s own is born there, and their first day names it - the seat elsewhere (mutants: the met place a town alone; the birth\'s words)', async () => {
  const w = world({ online: false, siblings: 1 });
  const f = w.host.family;
  w.here = GOTHWAY;
  w.host.tick();
  w.held = [HOVEL];
  modSaveRecords();
  const sib = f.people.find((p) => p.id !== w.host.current().id);
  w.here = FARM;   // met in the hovel (LEGACY-HOME: the never-played live in the family home)
  assert.equal(w.host.switchTo(sib.id, { here: true }).ok, true);
  assert.equal(f.seat.loc, 'Gothway Garden', 'the seat stands where it was');
  assert.match(w.booted.at(-1), /region=Daggerfall&loc=Ashfield\+Farm$/, 'born where they were met - the farm, not the seat');
  const b = readBirth(w.tab, sib.id);
  assert.equal(b.loc, 'Ashfield Farm');
  // the page bearing them, in the farm the boot stood: their first day names it
  w.e = { chargenDone: false, characterId: null };
  const born = page(w);
  assert.ok(born.takeBorn(String(sib.id)));
  w.e = bornEntity(born.current(), 'c-sib');
  assert.equal(born.onBorn(), true);
  assert.ok(w.said.includes(LEGACY_TEXT.born(fullNameOf(sib.given, sib.surname), 'Ashfield Farm')), 'their first day names the farm');
});
