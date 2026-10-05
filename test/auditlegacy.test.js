// AUDIT LEGACY (2026-10-05, Mac: "Let's do a deep comprehensive audit on this. Needs to be perfection"): the five-lens audit
// of Project Legacy (LEGACY1-LEGACY4) - bible/01-Overview/Audit-Legacy.md, every finding pinned here by its id. The law
// end to end through the real host (scenes/legacyHost.js), the real save records (systems/modSaveData.js) and the real
// death door (characters/playerEntity.js); the world host's wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keydown } from './chargenDom.mjs';
import { createLegacyHost, mergeFamily } from '../src/scenes/legacyHost.js';
import {
  foundFamily, readFamily, addChild, personOf, familyRng, MODELS, newbornAllowed, DESCENDANTS, recordDeath, ESTATE_MAX,
} from '../src/systems/legacy/family.js';
import { loadFamily, listFamilies, leaveBirth, readBirth } from '../src/systems/legacy/store.js';
import { modSaveRecords, restoreModSaveRecords, _resetModSaveData } from '../src/systems/modSaveData.js';
import { hurtPlayer, setDeathListener, presentPlayerDeath } from '../src/characters/playerEntity.js';
import { walkButtons } from '../src/ui/legacyDoor.js';
import { personChips, disarmFamilyPages } from '../src/ui/familyPages.js';
import { setItemFields, mintCondition } from '../src/systems/itemTemplates.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const sword = () => ({ ...mintCondition(setItemFields({ group: 'Weapons', templateIndex: 120, material: 4, flags: 0, variant: 0, message: 0, stackCount: 1 })), equipSlot: 1 });

function person(cid, name = 'Ysolde Hlaalu') {
  return {
    name, gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
    level: 9, characterId: cid, chargenDone: true, health: 40, maxHealth: 40,
    stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)), items: [sword()], wagonItems: [],
  };
}

/** One world: the host over shared storage, the entity swappable (a load is a new character in the same slot). */
function world({ model = MODELS.bloodline, online = false, gold = 1000, storage = mem(), tab = mem() } = {}) {
  _resetModSaveData();
  const w = { said: [], booted: [], loads: [], saves: 0, saveOk: true, now: 100, online, fight: false, gold, at: false, opened: [] };
  w.e = person('c-ysolde');
  w.storage = storage; w.tab = tab;
  w.host = createLegacyHost({
    get entity() { return w.e; },
    storage: () => storage, tab: () => tab, on: () => true, online: () => w.online,
    now: () => w.now, own: () => 0,
    here: () => ({ pixel: { x: 10, y: 20 }, region: 'Daggerfall', mode: 'exterior', loc: 'Gothway Garden', locationType: LOCATION_TYPES.TownCity, world: { x: 0, z: 0 } }),
    town: (h) => ({ region: h.region, loc: h.loc }), nearestTown: () => ({ region: 'Daggerfall', loc: 'Gothway Garden' }),
    gold: () => w.gold, say: (l) => w.said.push(l), boot: (s) => w.booted.push(s), search: () => '?world',
    loadCharacter: (cid) => { w.loads.push(cid); return true; }, saveNow: () => { if (w.saveOk) w.saves++; return w.saveOk; },
    inFight: () => w.fight, payEstate: (n) => w.said.push(`estate ${n}`), rng: familyRng(7),
    atPlace: () => w.at, openRemains: (r, items) => { w.opened.push(items); return true; }, carried: () => [...w.e.items, ...w.e.wagonItems],
  });
  w.host.found(model);
  return w;
}
/** A load: the save's record restored with `entity` as the one in the slot. */
function load(w, rec, entity) { w.e = entity; restoreModSaveRecords({ ProjectLegacy: rec }); }

// ---- the death -------------------------------------------------------------------------------------------------------

test('AUDIT LEGACY A1/B3: THE DEATH IS DECIDED AT THE DOOR - the blow that kills records the fall before any screen; a load taken under the screen (F11) finds the past, never the living', () => {
  const w = world();
  setDeathListener('projectLegacy', () => w.host.onDeath());
  try {
    const save = JSON.parse(JSON.stringify(modSaveRecords().ProjectLegacy));   // the last save, the member alive in it
    w.e.health = 5;
    assert.equal(hurtPlayer(w.e, 50, { bypassShield: true }), true, 'the killing blow');
    const fam = loadFamily(w.storage, w.host.family.id);
    assert.ok(fam.people[0].died, 'written dead in the store at the blow - no reset has run');
    assert.equal(fam.pending.fallenId, 1, 'and the Succession waits on the record');
    // F11 under the screen: the last save, restored
    load(w, save, person('c-ysolde'));
    assert.equal(w.host.past?.id, 1, 'THE PAST: the fallen\'s save plays no living member');
    assert.equal(w.host.tick()?.fall?.kind, 'fall', 'and the Succession is asked');
    // the DEATH-KEPT re-ask hears the door again - one death, one decision (no second toll, no second remains)
    presentPlayerDeath({ health: 0 });
    assert.equal(loadFamily(w.storage, w.host.family.id).remains.length, 1);
  } finally { setDeathListener('projectLegacy', null); }
  assert.match(rd('src/scenes/world.js'), /setDeathListener\('projectLegacy', \(\) => legacyHost\?\.onDeath\(\)\);/);
  assert.match(rd('src/characters/playerEntity.js'), /hearDeath\(entity\);   \/\/ AUDIT LEGACY: OnDeath's subscribers, before the screen\n\s+_deathPresenter\?\.\(entity\);/);
});

test('AUDIT LEGACY A1: an Enduring toll is paid once a death - the door and the reset and a re-ask are one decision', () => {
  const w = world({ model: MODELS.enduring });
  const p = w.host.current();
  assert.equal(w.host.onDeath().kind, 'rise');
  assert.equal(w.host.onDeath().kind, 'rise');
  assert.equal(w.host.deathOutcome().kind, 'rise');
  assert.equal(p.toll, 11, 'one toll');
  assert.equal(w.host.willRise(), false, 'presented');
});

test('AUDIT LEGACY B1: the Succession is the death\'s own screen - the DEATH-KEPT backstop and the exit autosave read it', () => {
  const src = rd('src/scenes/world.js');
  assert.match(src, /!\(townTalk\.overlay instanceof DeathScreen\) && !modes\?\.deathUp\?\.\(\) && !successionOpen\(\)\) presentPlayerDeath\(playerEntity\);/);
  assert.equal((src.match(/deathUp: townTalk\.overlay instanceof DeathScreen \|\| !!modes\?\.deathUp\?\.\(\) \|\| successionOpen\(\)/g) ?? []).length, 2, 'both exit autosaves');
  assert.match(src, /function openLegacySuccession\(out, past = null\) \{\n\s+if \(successionOpen\(\)\) return;/);
});

// ---- the past and the record ---------------------------------------------------------------------------------------

test('AUDIT LEGACY A2/B2: the past played back is refused FOR GOOD - asked every tick until shown, never written into the line, never dying for the heir', () => {
  const w = world();
  const old = JSON.parse(JSON.stringify(modSaveRecords().ProjectLegacy));
  w.host.deathOutcome();
  w.host.succeed({ newborn: true });
  const heirId = w.host.family.currentId;
  load(w, old, person('c-ysolde'));
  for (let i = 0; i < 3; i++) assert.ok(w.host.tick()?.past, 'asked again and again - a window that stood the first time drops nothing');
  const rec = modSaveRecords().ProjectLegacy;
  assert.equal(personOf(rec, heirId).characterId, null, 'the dead\'s character is never written into the heir');
  assert.equal(personOf(rec, heirId).given !== 'Ysolde', true);
  assert.equal(w.host.deathOutcome().kind, 'none', 'and a death of the past records nobody');
  assert.ok(!personOf(w.host.family, heirId).died);
  assert.equal(w.host.switchRefusal(heirId), 'none', 'the past switches to no one - the window offers the line');
});

test('AUDIT LEGACY A5/H2: an Enduring member dead of their years, and a retired elder, are the past too - their saves never play again', () => {
  const w = world({ model: MODELS.enduring });
  const elderSave = () => JSON.parse(JSON.stringify(modSaveRecords().ProjectLegacy));
  w.host.current().toll = 100;   // an elder
  const r = w.host.passMantle();
  assert.equal(r.ok, true);
  assert.ok(w.host.family.people[0].retired != null);
  assert.equal(w.host.family.pending.bequest.length, 1, 'the elder\'s heirloom handed down - the bequest (F4/H9)');
  load(w, elderSave(), person('c-ysolde'));
  assert.equal(w.host.past?.id, 1, 'the retired elder\'s save is the past');
  const v = world({ model: MODELS.enduring });
  v.host.current().toll = 999;
  assert.equal(v.host.deathOutcome().kind, 'fall');
  load(v, JSON.parse(JSON.stringify(modSaveRecords().ProjectLegacy)), person('c-ysolde'));
  assert.equal(v.host.past?.id, 1, 'dead of their years: the past, whatever the model');
});

test('AUDIT LEGACY A3: a save made before its family is found in the store - never a second house, never a dead founder alive', () => {
  const storage = mem();
  const w = world({ storage });
  w.host.deathOutcome();   // the founder falls
  const id = w.host.family.id;
  load(w, null, person('c-ysolde'));   // an older save with no ProjectLegacy record
  assert.equal(w.host.family?.id, id, 'the store\'s house');
  assert.equal(w.host.past?.id, 1);
  w.host.found();
  assert.equal(listFamilies(storage).length, 1, 'no second house');
});

test('AUDIT LEGACY A4/B7: a fall waits on the record - a closed tab or a failed birth leaves the line its Succession, never stranded', () => {
  const w = world();
  const sib = addChild(w.host.family, 1, { rng: familyRng(3) }).person;
  sib.characterId = 'c-sib';   // a sibling already played
  modSaveRecords();   // a save: the store has them
  w.host.deathOutcome();
  // the tab closed under the window: the fallen's save loaded next time
  load(w, JSON.parse(JSON.stringify(modSaveRecords().ProjectLegacy)), person('c-ysolde'));
  const ask = w.host.tick();
  assert.equal(ask.fall.estate, 250, 'the estate waits with it');
  assert.ok(ask.fall.choices.some((p) => p.id === sib.id), 'the full Succession - every living member');
  // a living member's save loaded instead: they take the mantle, and the estate is theirs
  load(w, JSON.parse(JSON.stringify(w.host.family)), person('c-sib', 'Riadell Hlaalu'));
  assert.equal(w.host.family.pending, null);
  assert.equal(w.host.family.currentId, sib.id);
  w.host.tick();
  assert.ok(w.said.includes('estate 250'));
  // the birth handoff is READ, not taken, until the born member is saved
  leaveBirth(w.tab, { familyId: w.host.family.id, personId: 9, region: 'Daggerfall', loc: 'Gothway Garden', estate: 0 });
  assert.ok(readBirth(w.tab, 9));
  assert.ok(readBirth(w.tab, 9), 'still there - a failed boot retries');
  const src = rd('src/scenes/world.js');
  assert.match(src, /if \(!r\) \{ legacyBirthFailed\('no birth waits for this address'\); return; \}/);
  assert.match(src, /\}\)\.catch\(\(e\) => legacyBirthFailed\(e\?\.message \?\? String\(e\)\)\);/);
  assert.match(rd('src/scenes/legacyHost.js'), /payEstateOf\(p\);\n\s+born = null;\n\s+if \(deps\.saveNow\(\)\) clearBirth\(deps\.tab\(\)\);/, 'the born member saved at birth, the handoff answered then');
});

test('AUDIT LEGACY A6/H3: TWO AUTHORITIES - a death is the store\'s, what a character was given is their save\'s: a reload rewinds a grant with the bag, never a death', () => {
  const stored = foundFamily(person('c-a'), { id: 'fam-m' });
  stored.people[0].estate = 500;
  stored.remains = [{ id: 'r9', of: 9, name: 'X', items: [], first: [{ templateIndex: 1810 }], state: 'taken', by: 1, place: null }];
  stored.rev = 10;
  const saved = JSON.parse(JSON.stringify(stored));
  saved.rev = 4;
  saved.people[0].estatePaid = 0;   // the save was made before the letter was paid
  saved.remains[0] = { ...saved.remains[0], items: [{ templateIndex: 1810 }], state: 'lying', by: null };
  stored.people[0].estatePaid = 500;   // paid after it
  recordDeath(stored, 1, { at: 5 });   // and a world fact after it: a death stands
  const m = mergeFamily(readFamily(stored), readFamily(saved), 'c-a');
  assert.equal(m.people[0].estatePaid, 0, 'the letter is unpaid again - it went with the bag');
  assert.equal(m.remains[0].state, 'lying', 'the bones in the list again');
  assert.equal(m.remains[0].items.length, 1);
  assert.ok(m.people[0].died, 'the death stands');
  // another member's claim is a world fact to this one
  stored.remains[0].by = 2;
  assert.equal(mergeFamily(readFamily(stored), readFamily(saved), 'c-a').remains[0].state, 'taken');
});

test('AUDIT LEGACY A7: a damaged record reads in shape - no throw in a tick, a choose or the quest log', () => {
  const f = foundFamily(person('c-a'), { id: 'fam-x' });
  const bad = JSON.parse(JSON.stringify(f));
  bad.people[0].groups = { primary: 5, major: ['x', 3], minor: null };
  bad.remains = [{ id: 'r1', of: 1 }, { id: 7 }, null, { id: 'r2', of: 2, items: 'no', state: 'gone' }];
  bad.pending = { fallenId: 99 };
  const r = readFamily(bad);
  assert.deepEqual(r.people[0].groups, { primary: [], major: [3], minor: [] });
  assert.deepEqual(r.remains.map((x) => [x.id, x.items.length, x.state]), [['r1', 0, 'lying'], ['r2', 0, 'lying']]);
  assert.equal(r.pending, null, 'a waiting fall of nobody is none');
  assert.doesNotThrow(() => addChild(r, 1, { rng: familyRng(1) }));
});

test('AUDIT LEGACY A8: a living member of an ended line plays on - the line goes on, said', () => {
  const w = world();
  const sib = addChild(w.host.family, 1, { rng: familyRng(3) }).person;
  sib.characterId = 'c-sib';
  w.host.endLine();
  load(w, JSON.parse(JSON.stringify(w.host.family)), person('c-sib', 'Riadell Hlaalu'));
  assert.equal(w.host.family.ended, null);
  assert.ok(w.said.some((l) => /goes on/.test(l)));
});

// ---- online ----------------------------------------------------------------------------------------------------------

test('AUDIT LEGACY B4/F1: ONLINE until the realm keeps lineages - a house is Enduring, a Bloodline death is the room\'s, a spent life rises, no Succession is answered', () => {
  const w = world({ online: true });
  assert.equal(w.host.family.model, MODELS.enduring, 'founded Enduring whatever was asked');
  const b = world();
  b.online = true;
  assert.equal(b.host.deathOutcome().kind, 'none', 'an offline Bloodline played online: the room\'s respawn stands');
  assert.ok(!b.host.family.people[0].died);
  const e = world({ model: MODELS.enduring, online: true });
  e.host.current().toll = 999;
  const out = e.host.deathOutcome();
  assert.equal(out.kind, 'rise');
  assert.match(out.line, /Online, a life's last breath waits on the realm's lineage/);
  const s = world();
  s.host.deathOutcome();
  s.online = true;
  assert.equal(s.host.succeed({ newborn: true }), false, 'no birth online');
});

// ---- the host's other doors -------------------------------------------------------------------------------------------

test('AUDIT LEGACY B6: a switch and a retirement never go on without their save', () => {
  const w = world({ model: MODELS.enduring });
  const sib = addChild(w.host.family, 1, { rng: familyRng(2) }).person;
  w.saveOk = false;
  assert.deepEqual(w.host.switchTo(sib.id), { ok: false, why: 'Your journey could not be saved here - not now.' });
  assert.equal(w.host.family.currentId, 1);
  w.host.current().toll = 100;
  assert.equal(w.host.passMantle().ok, false);
  assert.equal(w.host.family.people[0].retired, null, 'not retired by a save that did not take');
  assert.equal(w.host.family.pending, null);
  w.saveOk = true;
  assert.equal(w.host.mantleRefusal(), null);
});

test('AUDIT LEGACY B5: Privateer\'s Hold - a death Project Legacy will raise respawns at the start marker offline too, the toll said, no online penalty', () => {
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /const legacyRise = host\.legacyWillRise\?\.\(\) \?\? false;\n\s+const online = host\.dungeonOnline\?\.\(\) \?\? false;\n\s+if \(isPrivateersHold && \(online \|\| legacyRise\)\) \{/);
  assert.match(m, /const goldLost = online \? applyDeathPenalty\(playerEntity\) : 0;/);
  assert.match(rd('src/scenes/world.js'), /legacyRiseLine: \(\) => \{ const o = legacyHost\?\.deathOutcome\(\); return o\?\.kind === 'rise' \? o\.line : null; \},/);
});

test('AUDIT LEGACY B8 + F5: the maps ring nothing with the mod off; "Always have descendants" answers at the death', () => {
  const f = foundFamily(person('c-a'), { id: 'fam-n' });
  f.people[0].heir = false;
  assert.equal(newbornAllowed(f, f.people[0], { descendants: DESCENDANTS.random }), false);
  assert.equal(newbornAllowed(f, f.people[0], { descendants: DESCENDANTS.always }), true, 'the dial turned to Always later answers for everyone born');
  assert.match(rd('src/scenes/legacyHost.js'), /const mapMarks = \(\) => \(family && deps\.on\(\) && !past \? openRemains\(\) : \[\]\)/);
  assert.equal(ESTATE_MAX, 9_900);
});

// ---- the UI -------------------------------------------------------------------------------------------------------------

test('AUDIT LEGACY U2/U6/U10: the tree captures the pointer only once a drag is under way; its tools sit at the top, named', () => {
  const src = rd('src/ui/familyPages.js');
  assert.doesNotMatch(src, /onpointerdown = \(e\) => \{[^\n]*setPointerCapture/, 'never at the press');
  assert.match(src, /if \(!drag\.held\) \{ drag\.held = true; view\.classList\.add\('dragging'\); view\.setPointerCapture\?\.\(drag\.id\); \}/);
  assert.match(src, /\.px-sys \.fam-tools \{ position: absolute; right: 6px; top: 6px;/);
  assert.match(src, /b\.setAttribute\('aria-label', title\);/);
});

test('AUDIT LEGACY U3: the Succession walks by keyboard - arrows and Tab move, Enter presses the lit button, the line\'s end lit when no one is left', () => {
  const root = globalThis.document.createElement('div');
  globalThis.document.body.append(root);
  const pressed = [];
  const mk = (cls) => { const b = globalThis.document.createElement('button'); b.className = cls; b.onclick = () => pressed.push(cls); b.click = () => b.onclick(); b.focus = () => { globalThis.document.activeElement = b; }; root.append(b); return b; };
  mk('lgs-go-a'); mk('lgs-go-b'); mk('lgs-end');
  walkButtons(root, 'ArrowDown');
  walkButtons(root, 'ArrowDown');
  walkButtons(root, 'Enter');
  assert.deepEqual(pressed, ['lgs-go-b']);
  walkButtons(root, 'Tab', { shiftKey: true });
  walkButtons(root, 'Space');
  assert.deepEqual(pressed, ['lgs-go-b', 'lgs-go-a']);
  assert.match(rd('src/ui/legacySuccession.js'), /\|\| win\.querySelector\?\.\('\.lgs-go'\) \|\| win\.querySelector\?\.\('\.lgs-end'\)\)\?\.focus\?\.\(\)/);
  assert.match(rd('src/ui/legacyDoor.js'), /input\(code, e = null\) \{ walkButtons\(host, code, e\); \},/);
  void keydown;
});

test('AUDIT LEGACY U4/U8/H9: the mantle\'s refusal on the card; an armed act never waits for the way back; the tree says whose remains are at peace', () => {
  const src = rd('src/ui/familyPages.js');
  assert.match(src, /const why = _provider\?\.mantleRefusal\?\.\(\) \?\? null;/);
  assert.match(rd('src/ui/enhancedMenu.js'), /b\.onclick = \(\) => \{ famSec = id; disarmFamilyPages\(\); render\(\); \};/);
  assert.doesNotThrow(() => disarmFamilyPages());
  const f = foundFamily(person('c-a'), { id: 'fam-c' });
  const k = addChild(f, 1, { rng: familyRng(5) }).person;
  recordDeath(f, k.id, { at: 1 });
  f.remains = [{ id: `r${k.id}`, of: k.id, state: 'lying', items: [] }];
  assert.ok(personChips(f, k, 0).some((c) => c.text === 'Lies unclaimed'));
  f.remains[0].state = 'rested';
  assert.ok(personChips(f, k, 0).some((c) => c.text === 'At peace'));
});

test('AUDIT LEGACY U5: five tabs on one row - the tab spacing a step tighter', () => {
  assert.match(rd('src/ui/enhancedStyle.js'), /\.px-tabs button \{ font: inherit; font-size: 20px; letter-spacing: 0\.12em; text-indent: 0\.12em;\n[^\n]*\n\s+min-height: 44px; padding: 6px 12px; display: flex; align-items: center; gap: 8px;/);
});
