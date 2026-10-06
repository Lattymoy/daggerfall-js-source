// LEGACY7 (2026-10-06, bible/06-Systems/Legacy-Arc.md section 9; Mac: "online integration with permadeath (Bloodline)
// or non-permadeath (Enduring)"): PROJECT LEGACY ONLINE, CLIENT SIDE - the line's realm copy (systems/legacy/realmLine.js),
// the session's tombstone (systems/realmSaves.js die), the host's online law (scenes/legacyHost.js: founded as asked, a
// fall the realm's tombstone and the Succession waiting on it, a birth whose first save answers later, the realm's id
// rebound into the record), the chargen's question open, and the world host's wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRealmLine, mergeLines } from '../src/systems/legacy/realmLine.js';
import { createRealmSession } from '../src/systems/realmSaves.js';
import { createLegacyHost, LEGACY_TEXT } from '../src/scenes/legacyHost.js';
import { foundFamily, readFamily, personOf, familyRng, MODELS, LEGACY_MOD, recordDeath, addChild } from '../src/systems/legacy/family.js';
import { loadFamily, storeFamily, readBirth } from '../src/systems/legacy/store.js';
import { birthSearch } from '../src/systems/legacy/places.js';
import { modSaveRecords, _resetModSaveData } from '../src/systems/modSaveData.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const mem = () => { const m = new Map(); return { map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const ent = (cid, name = 'Ysolde Hlaalu') => ({
  name, gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
  level: 9, characterId: cid, chargenDone: true, health: 40, maxHealth: 40, items: [], wagonItems: [],
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)),
});

test('LEGACY7 the line\'s realm copy: read in at the boot with the device\'s facts kept both ways; written after each write, a stale one merged and written past both; flushed', async () => {
  const storage = mem();
  const fam = foundFamily(ent('r1'), { id: 'fam-k1-abc123', model: MODELS.bloodline });
  const sib = addChild(fam, null, { rng: familyRng(2) }).person;
  // the service's copy is newer and knows a death the device does not; the device knows a person the service does not
  const theirs = readFamily(JSON.parse(JSON.stringify(fam)));
  recordDeath(theirs, 1, { at: 50, cause: 'fell' });
  theirs.rev = 9;
  storeFamily(storage, fam);
  const mine = loadFamily(storage, fam.id);
  addChild(mine, 1, { rng: familyRng(4) });
  storeFamily(storage, mine);
  const line = createRealmLine({ io: () => ({}), storage: () => storage, list: async () => ({ ok: true, lineages: [{ id: fam.id, record: theirs }] }), put: async () => ({ ok: true }) });
  const pulled = await line.pull();
  assert.deepEqual(pulled, { ok: true, ids: [fam.id] });
  const kept = loadFamily(storage, fam.id);
  assert.ok(personOf(kept, 1).died, 'the death another device wrote stands here');
  assert.equal(kept.people.length, 3, 'and the person only this device knew');
  assert.ok(kept.rev >= 9);
  assert.equal(mergeLines(null, theirs).rev, 9);
  // a stale write: the service's facts taken in, written past both
  const calls = [];
  let stored = readFamily(JSON.parse(JSON.stringify(fam)));
  recordDeath(stored, sib.id, { at: 70, cause: 'fell' });
  stored.rev = 20;
  const put = async (io, id, record) => {
    calls.push(record.rev);
    if (record.rev <= stored.rev) return { ok: false, error: 'stale', data: { rev: stored.rev, record: stored } };
    stored = record;
    return { ok: true, data: { rev: record.rev } };
  };
  const line2 = createRealmLine({ io: () => ({}), storage: () => storage, put });
  const local = loadFamily(storage, fam.id);
  line2.push(local);
  assert.equal(await line2.flush(), true);
  assert.deepEqual(calls, [local.rev, 21], 'refused, merged, written one past the service');
  assert.ok(personOf(stored, sib.id).died && personOf(stored, 1).died, 'both deaths');
  assert.ok(personOf(loadFamily(storage, fam.id), sib.id).died, 'and the device takes the service\'s fact too');
  // refused for good (the network): waits for the next flush
  const line3 = createRealmLine({ io: () => ({}), storage: () => storage, put: async () => ({ ok: false, error: 'offline' }) });
  line3.push(local);
  assert.equal(await line3.flush(), false);
  assert.equal(line3.error, 'offline');
  assert.equal(createRealmLine({ io: () => null, storage: () => storage }).push(local), null, 'signed out: nothing is sent');
});

test('LEGACY7 the session\'s tombstone: under the lease, quietly - the page stays for the Succession, nothing of the dead is checkpointed again', async () => {
  const asked = [];
  const fetch = async (url, init) => {
    asked.push([url, JSON.parse(init.body ?? 'null')]);
    return { ok: true, status: 200, headers: { get: (k) => (k === 'content-type' ? 'application/json' : null) }, json: async () => ({ ok: true, deadAt: 5 }) };
  };
  let lostWith = null;
  const s = createRealmSession({ io: { fetch, base: 'https://a', secret: 's', storage: null }, id: 'r0123456789abcdef0123', lease: 'f'.repeat(32), seq: 3, onLost: (w) => { lostWith = w; }, later: () => () => {}, watchHidden: () => {} });
  assert.equal(await s.die(), true);
  assert.deepEqual(asked.at(-1), ['https://a/v1/realm/die', { id: 'r0123456789abcdef0123', lease: 'f'.repeat(32) }]);
  assert.equal(lostWith, null, 'never the door: the Succession stands on this page');
  assert.equal(s.lost, 'dead');
  assert.equal(await s.die(), true, 'once');
  assert.equal(asked.length, 1);
  const r = await s.checkpoint('{}');
  assert.equal(r.ok, false, 'nothing of the dead written again');
  assert.equal(asked.length, 1);
  // refused: the session as it was, to be asked again
  const no = createRealmSession({ io: { fetch: async () => ({ ok: false, status: 409, headers: { get: () => 'application/json' }, json: async () => ({ error: 'lease' }) }), base: '', secret: 's', storage: null }, id: 'r0123456789abcdef0123', lease: 'f'.repeat(32), seq: 3, later: () => () => {}, watchHidden: () => {} });
  assert.equal(await no.die(), false);
  assert.equal(no.lost, null);
});

/** One online world: the host over shared storage, the tombstone asked through `tombstone`. */
function world({ model = MODELS.bloodline, tomb = true } = {}) {
  _resetModSaveData();
  _resetModSettings();
  const storage = mem(), tab = mem();
  const w = { said: [], booted: [], tombs: 0, saveOk: true, online: true, storage, tab, stored: 0, tombAnswer: tomb };
  w.e = ent('r-ysolde');
  w.host = createLegacyHost({
    get entity() { return w.e; },
    storage: () => storage, tab: () => tab, on: () => true, online: () => w.online, now: () => 100, own: () => 0,
    here: () => ({ pixel: { x: 10, y: 20 }, region: 'Daggerfall', mode: 'exterior', loc: 'Gothway Garden', locationType: LOCATION_TYPES.TownCity, mapId: 5001 }),
    town: (h) => ({ region: h.region, loc: h.loc, mapId: h.mapId }), nearestTown: () => ({ region: 'Daggerfall', loc: 'Gothway Garden' }),
    gold: () => 1000, say: (l) => w.said.push(l), boot: (s) => w.booted.push(s), search: () => '?online&realm=r-ysolde&load',
    loadCharacter: () => false, saveNow: () => (typeof w.saveOk === 'function' ? w.saveOk() : w.saveOk), hasSave: () => true, inFight: () => false, rng: familyRng(7),
    stored: () => { w.stored++; },
    tombstone: () => { w.tombs++; return Promise.resolve(w.tombAnswer); },
  });
  setModSetting(LEGACY_MOD, 'Family.Siblings Probability', 0);
  w.host.found(model);
  _resetModSettings();
  return w;
}
const tick = () => new Promise((r) => { setImmediate(r); });

test('LEGACY7 the host online: founded as asked; a fall is the realm\'s tombstone, and the heir is born into the realm only once the realm heard it', async () => {
  const w = world();
  assert.equal(w.host.family.model, MODELS.bloodline, 'Bloodline online, as asked');
  assert.ok(w.stored > 0, 'each write of the device\'s is the realm\'s to follow');
  const out = w.host.deathOutcome();
  assert.equal(out.kind, 'fall');
  assert.equal(w.tombs, 1, 'the tombstone asked at the door');
  assert.equal(w.host.succeed({ newborn: true }), true);
  assert.deepEqual(w.booted, [], 'the boot waits on the realm\'s word');
  await tick();
  assert.equal(w.booted.length, 1);
  assert.match(w.booted[0], /realmnew=1/, 'born into the realm');
  assert.match(w.booted[0], /legacyborn=/);
  assert.equal(w.tombs, 1, 'once');
});

test('LEGACY7 the host online: a tombstone refused is said, and asked again before anyone carries on - never a birth past an unheard death', async () => {
  const w = world({ tomb: false });
  w.host.deathOutcome();
  await tick();
  assert.ok(w.said.includes(LEGACY_TEXT.unTombed));
  assert.equal(w.host.succeed({ newborn: true }), true);
  await tick();
  assert.equal(w.tombs, 2, 'asked again');
  assert.deepEqual(w.booted, [], 'no birth while the realm has not heard');
  assert.ok(w.host.family.pending, 'the fall waits on the record - the Succession is raised again');
  w.tombAnswer = true;
  w.host.succeed({ personId: w.host.current().id });
  await tick();
  assert.equal(w.booted.length, 1, 'heard: carried on');
});

test('LEGACY7 the host online: a character founded at a load (no chargen answer) is Enduring whatever the Mods pane says - never a permadeath they did not choose', () => {
  _resetModSaveData();
  _resetModSettings();
  setModSetting(LEGACY_MOD, 'Legacy.Model', 1);
  const storage = mem();
  const mk = (online) => createLegacyHost({
    entity: ent(online ? 'r-old' : 'c-old'), storage: () => storage, tab: () => mem(), on: () => true, online: () => online, now: () => 0, own: () => 0,
    here: () => null, town: () => null, nearestTown: () => null, gold: () => 0, say: () => {}, boot: () => {}, search: () => '', loadCharacter: () => false,
    saveNow: () => true, inFight: () => false, rng: familyRng(1),
  });
  const on = mk(true);
  assert.equal(on.found().model, MODELS.enduring, 'online: Enduring');
  const off = mk(false);
  assert.equal(off.found().model, MODELS.bloodline, 'offline: the Mods pane\'s (D9)');
  _resetModSettings();
});

test('LEGACY7 the host online: an elder\'s retirement is the realm\'s tombstone too; a switch and the mantle are open online', async () => {
  const w = world({ model: MODELS.enduring });
  const sib = addChild(w.host.family, null, { rng: familyRng(3) }).person;
  sib.parents = [];
  assert.equal(w.host.switchRefusal(sib.id), null, 'online too');
  w.host.current().toll = 100;
  assert.equal(w.host.mantleRefusal(), null);
  assert.equal(w.host.passMantle().ok, true);
  assert.equal(w.tombs, 1, 'never played again - in the realm too');
});

test('LEGACY7 the realm names the character: the person rebound to the realm\'s id; a birth whose first save answers later stands with it - or is undone', async () => {
  const w = world();
  const founder = w.host.current();
  assert.equal(founder.characterId, 'r-ysolde');
  w.e.characterId = 'rabc';
  assert.equal(w.host.rebind('r-ysolde', 'rabc'), true);
  assert.equal(founder.characterId, 'rabc');
  assert.equal(w.host.rebind('nobody', 'x'), false);
  modSaveRecords();
  assert.equal(founder.characterId, 'rabc', 'the save writes the record again - under the realm\'s id, not refused as another character\'s');
  // the online birth: the first save is the realm's, answered later
  w.host.deathOutcome();
  w.host.succeed({ newborn: true });
  await tick();
  const id = w.host.current().id;
  let answer;
  w.saveOk = () => new Promise((r) => { answer = r; });
  w.host.takeBorn(id);
  w.e = ent('rheir', 'Ilse Hlaalu');
  const born = w.host.onBorn();
  assert.equal(typeof born.then, 'function');
  answer(true);
  assert.equal(await born, true);
  assert.equal(personOf(loadFamily(w.storage, w.host.family.id), id).characterId, 'rheir', 'the birth stands with its save');
  assert.equal(readBirth(w.tab, id), null, 'the handoff answered');
  // refused: undone, the handoff kept
  const v = world();
  v.host.deathOutcome();
  v.host.succeed({ newborn: true });
  await tick();
  const vid = v.host.current().id;
  v.saveOk = () => Promise.resolve(false);
  const vb = v.host.takeBorn(vid);
  v.e = ent('rheir2', `${vb.person.given} ${vb.person.surname}`);
  assert.equal(await v.host.onBorn(), false);
  assert.ok(v.said.includes(LEGACY_TEXT.notBorn(personOf(v.host.family, vid).given)));
  assert.ok(readBirth(v.tab, vid), 'the handoff waits');
});

test('LEGACY7 the chargen\'s question and the birth\'s address: Bloodline open online; an online birth is the realm\'s', () => {
  assert.match(birthSearch('?online&realm=r1&load', 4, { region: 'Daggerfall', loc: 'Ashbury' }), /^\?online=&world=1&realmnew=1&legacyborn=4&region=Daggerfall&loc=Ashbury$/);
  assert.doesNotMatch(birthSearch('?world', 4, null), /realmnew/, 'offline: a birth of the device');
});

test('LEGACY7 wiring: the boot reads the lines before any save; the realm\'s copy follows each write; a fall is the session\'s tombstone; a member is born and joined through the realm', () => {
  const w = rd('src/scenes/world.js');
  const pull = w.indexOf('await legacyRealmLine.pull()');
  assert.ok(pull > 0 && pull < w.indexOf('restoreModSaveRecords('), 'read before any save is restored');
  assert.match(w, /stored: \(f\) => \{ legacyRealmLine\?\.push\(f\); \},\n\s+tombstone: \(\) => \(realmSession \? realmSession\.die\(\) : false\),/);
  assert.match(w, /if \(realmNew\) \{ legacyRealmBirth\(host\)\.catch\(/);
  assert.match(w, /saveNow: \(\) => \(legacyFirstSave \? legacyFirstSave\(\) : /);
  assert.match(w, /if \(legacyRealmLine\) \{\n\s+if \(legacyRealmRoster && !legacyRealmRoster\.has\(String\(cid\)\)\) return false;\n\s+legacyBoot\(realmBootSearch\(location\.search, String\(cid\), BOOT_DOOR_KEYS\)\);/);
  assert.match(w, /async function legacyBoot\(search\) \{\n\s+if \(legacyRealmLine\) \{[\s\S]{0,200}legacyRealmLine\.flush\(\)[\s\S]{0,200}realmSession\.leave\(\)/, 'the line written and the lease given up before the next joins');
  assert.match(w, /made = await realmCreate\(io, playerEntity\.name \|\| 'Traveller', realmSummaryOf\(playerEntity\), born\);/);
});
