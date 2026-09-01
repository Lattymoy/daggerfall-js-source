// NPC4: THE PEOPLE WHO STAND STILL.
//
// A shopkeeper, a temple healer, a tavern patron, a questor. NPC3b
// dressed the wandering crowd; this is the other half, and it differs
// in one way that decides every law below: a static NPC carries a
// FACTION, so their identity is DATA - and it is data the game already
// derives, once, for the talk window. The body must read THAT record
// and not invent a second one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { staticMwBodyOpts } from '../src/characters/staticMwBody.js';
import { staticNpcData, ZERO_NPC_DATA, CHILDREN_FACTION_ID } from '../src/characters/staticNpc.js';
import { personaFor } from '../src/characters/mwWardrobe.js';
import { SOCIAL_GROUPS } from '../src/formats/factionFile.js';
import { RACES } from '../src/systems/races.js';
import { GENDERS } from '../src/characters/nameHelper.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A block person record, the shape collectInteriorPeople mints. */
const person = (over = {}) => ({
  x: 1, y: 0, z: 2, textureArchive: 334, textureRecord: 1,
  factionID: 0, flags: 0, rawX: 10, rawY: 20, rawZ: 30, position: 7, ...over,
});

test('NPC4: the body reads the ONE SetLayoutData record - it does not derive a second identity', () => {
  // The failure this forbids: a shopkeeper whose 3D body is a Nord man
  // while their own dialogue names a Redguard woman. Both must come
  // off the same NPCData, so the pin drives the body from a record
  // built by staticNpcData - DFU's law - and reads the answer back.
  const pn = person({ flags: 32, factionID: 0 });
  const data = staticNpcData(pn, {
    mapId: 3, locationIndex: 5, buildingKey: 100,
    getFaction: () => null,
    raceOfCurrentRegion: () => RACES.Redguard,
  });
  assert.equal(data.gender, GENDERS.Female, 'the flags&32 gender is the record\'s');
  assert.equal(data.race, RACES.Redguard, 'and an unfactioned person is a local');

  const opts = staticMwBodyOpts(data, { getFaction: () => null });
  assert.equal(opts.race, 'redguard', 'the body took a race the record did not carry');
  assert.equal(opts.female, true, 'the body took a sex the record did not carry');
  // ...and the CLOTHES are seeded by the seed their NAME comes from,
  // so a person's outfit is exactly as stable as their name.
  const persona = personaFor(data.nameSeed, SOCIAL_GROUPS.Commoners, true);
  assert.deepEqual(opts.worn, persona.worn, 'the outfit is not keyed by nameSeed');
  assert.equal(opts.faceIndex, persona.faceIndex);
  // A static NPC carries no equipment in Daggerfall: nothing to draw
  // and nothing to invent.
  assert.equal(opts.weapon, null);
  assert.equal(opts.hasAmmo, false);
});

test('NPC4: the nameSeed decides the outfit, so moving a person changes it and re-entering does not', () => {
  const deps = { getFaction: () => null, raceOfCurrentRegion: () => RACES.Breton };
  const ctx = { mapId: 1, locationIndex: 2, buildingKey: 40, ...deps };
  const a = staticMwBodyOpts(staticNpcData(person({ position: 7 }), ctx), deps);
  const again = staticMwBodyOpts(staticNpcData(person({ position: 7 }), ctx), deps);
  assert.deepEqual(a, again, 'walking back into the shop redressed the shopkeeper');
  // A DIFFERENT person in the same building is a different person: the
  // seed folds their record position in.
  const other = staticMwBodyOpts(staticNpcData(person({ position: 91 }), ctx), deps);
  assert.notDeepEqual(other.worn, a.worn, 'every person in the building wears one outfit');
});

test('NPC4: "what they are" is the faction social group, exactly as it is for the crowd', () => {
  const deps = (sgroup) => ({ getFaction: () => ({ sgroup }), raceOfCurrentRegion: () => RACES.Breton });
  const build = (sgroup) => {
    const d = deps(sgroup);
    return staticMwBodyOpts(staticNpcData(person({ factionID: 42 }), { buildingKey: 8, ...d }), d)
      .worn.map((w) => w.name);
  };
  const noble = build(SOCIAL_GROUPS.Nobility);
  const commoner = build(SOCIAL_GROUPS.Commoners);
  const thief = build(SOCIAL_GROUPS.Underworld);
  assert.notDeepEqual(noble, commoner, 'the noble and the beggar dress the same');
  assert.notDeepEqual(noble, thief);
  // ...and a group with no rack of its own dresses as a commoner,
  // which is the honest default rather than a hole.
  assert.deepEqual(build(SOCIAL_GROUPS.GuildMembers), commoner);
  assert.deepEqual(build(SOCIAL_GROUPS.SupernaturalBeings), commoner);
});

test('NPC4: no faction lookup at all still dresses somebody - a commoner', () => {
  // The host may reach a person before FACTION.TXT has loaded. That
  // must not strip them naked or drop them back to a sprite forever.
  const data = staticNpcData(person(), { raceOfCurrentRegion: () => RACES.Nord });
  const opts = staticMwBodyOpts(data, {});
  assert.ok(opts, 'a person with no faction lookup got no body');
  assert.deepEqual(opts.worn, personaFor(data.nameSeed, SOCIAL_GROUPS.Commoners, false).worn);
});

test('NPC4: a CHILD keeps their sprite - Morrowind has no child body', () => {
  // StaticNPC.IsChildNPCData (:342-350): the eight child texture pairs
  // OR the children faction. Dressing a child record in an adult mesh
  // would stand a grown man where the game put a kid, which is worse
  // than the billboard.
  const byTexture = staticNpcData(person({ textureArchive: 334, textureRecord: 2 }),
    { raceOfCurrentRegion: () => RACES.Breton });
  assert.equal(staticMwBodyOpts(byTexture, {}), null, 'a child by texture pair got an adult body');
  const byFaction = staticNpcData(person({ factionID: CHILDREN_FACTION_ID }),
    { getFaction: () => null, raceOfCurrentRegion: () => RACES.Breton });
  assert.equal(staticMwBodyOpts(byFaction, {}), null, 'a child by faction 514 got an adult body');
  // ...and the adult beside them still does.
  const adult = staticNpcData(person({ textureArchive: 334, textureRecord: 1 }),
    { raceOfCurrentRegion: () => RACES.Breton });
  assert.ok(staticMwBodyOpts(adult, {}), 'the child gate swallowed the adults too');
});

test('NPC4: a race that does not resolve is a REFUSAL, not a guess', () => {
  // staticNpcData starts from the zero struct, whose race field is
  // `(Races)0` - not a member of the enum at all. A host that cannot
  // answer GetRaceOfCurrentRegion leaves it there, and there is
  // nothing to build from it.
  assert.equal(staticMwBodyOpts({ ...ZERO_NPC_DATA }, {}), null, 'race 0 built a body out of nothing');
  assert.equal(staticMwBodyOpts(null, {}), null);
  // Every real race DOES resolve, spelled the way the Morrowind data
  // spells it - so the refusal above is the zero struct and not a
  // hole the whole table falls into.
  const spelling = {
    [RACES.Breton]: 'breton', [RACES.Redguard]: 'redguard', [RACES.Nord]: 'nord',
    [RACES.DarkElf]: 'dark elf', [RACES.HighElf]: 'high elf', [RACES.WoodElf]: 'wood elf',
    [RACES.Khajiit]: 'khajiit', [RACES.Argonian]: 'argonian',
  };
  for (const [id, mw] of Object.entries(spelling)) {
    assert.equal(staticMwBodyOpts({ ...ZERO_NPC_DATA, race: Number(id) }, {})?.race, mw,
      `race ${id} does not reach the Morrowind data`);
  }
});

test('NPC4: interior people get a batch EACH, kept out of the shared flat groups', () => {
  // The Morrowind lane needs to leave one person out of the sprite
  // pass while the person beside them keeps theirs. A merged
  // (archive, record) batch of centres cannot do that, which is why
  // people no longer pour into flatGroups.
  const ic = rd('src/scenes/interiorContext.js');
  assert.ok(!/for \(const pn of people\) \{[\s\S]{0,200}?flatGroups\.get\(key\)\.push/.test(ic),
    'people are back in the shared flat groups - the lane cannot skip one');
  assert.match(ic, /pn\.batch = batch;/, 'each person carries their own batch');
  assert.match(ic, /peopleBatches,\s*\/\/ NPC4/, 'and the host is handed them');
  // They are NOT in billboardBatches: that array is drawn whole, and a
  // person in it would draw as a sprite UNDER their own body.
  const build = ic.slice(ic.indexOf('const peopleBatches = []'), ic.indexOf('return {'));
  assert.ok(!/billboardBatches\.push\(batch\)[\s\S]{0,80}peopleBatches/.test(build));
  assert.match(ic, /for \(const b of peopleBatches\) renderer\.destroyBatch\(b\);/,
    'the per-person batches leak on every interior exit');
});

test('NPC4: the host draws body OR sprite, never both, and asks once', () => {
  const wm = rd('src/scenes/worldModes.js');
  const seam = wm.slice(wm.indexOf('NPC4: THE PEOPLE STANDING IN THE ROOM'));
  assert.ok(seam.length > 0, 'the interior people seam is gone');
  const loop = seam.slice(0, seam.indexOf('drawBillboards'));
  // `continue` on a successful body draw is the whole no-double-draw
  // story: a body that drew must not also push its billboard.
  assert.match(loop, /\}\)\) continue;\s*\n\s*_pplBatches\.push\(pn\.batch\);/,
    'a person who drew as a body still pushes their sprite');
  // The identity is derived through the SAME scene context the click
  // uses - one function, two readers.
  assert.equal((wm.match(/function staticNpcSceneCtx\(pn\)/g) ?? []).length, 1);
  assert.match(wm, /const npcSceneCtx = staticNpcSceneCtx\(pn\);/, 'the click no longer shares the context');
  assert.match(wm, /staticNpcData\(pn, \{ \.\.\.staticNpcSceneCtx\(pn\), \.\.\.lookups \}\)/,
    'the body derives its own scene context');
  // ...and the race lookups come from the bridge that already owns
  // them, rather than a second pair off a different store.
  assert.match(wm, /questBridge\?\.npcRaceLookups\?\.\(\) \?\? \{\}/);
  assert.match(rd('src/scenes/questBridge.js'), /\n    npcRaceLookups,\n/,
    'the bridge stopped publishing the lookups');
  // A settled refusal is REMEMBERED: `undefined` means not asked, and
  // null is an answer. Without that a child re-derives an NPCData
  // every frame, forever.
  assert.match(wm, /if \(pn\._mwOpts !== undefined\) return pn\._mwOpts;/);
});

test('NPC4: they stand still and face you, because that is what the sprite did', () => {
  const wm = rd('src/scenes/worldModes.js');
  const seam = wm.slice(wm.indexOf('NPC4: THE PEOPLE STANDING IN THE ROOM'));
  const loop = seam.slice(0, seam.indexOf('drawBillboards'));
  // AddPeople stands a building's people and gives them no motion at
  // all, so the body plays its idle - a walking shopkeeper would be a
  // departure from the game, not a fidelity gain.
  assert.match(loop, /moving: false/);
  // The billboard they replace turns to the player every frame; there
  // is no facing in the block record to be faithful to instead.
  assert.match(loop, /yaw: Math\.atan2\(cam\.pos\[0\] - pn\.x, cam\.pos\[2\] - pn\.z\)/);
});
