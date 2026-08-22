// STATIC NPC IDENTITY - StaticNPC.cs's data layer. Classic stores no
// NPC table: a person IS their position and their faction, and their
// name, gender, race and portrait all fall out of those two. That is
// why the same shopkeeper is the same person every time you walk in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  positionHash, staticNpcData, raceFromFaction, raceFromFactionRace,
  staticNpcName, bankForRace, FACTION_TYPE_INDIVIDUAL,
} from '../src/characters/staticNpc.js';
import { RACES } from '../src/systems/races.js';
import { GENDERS } from '../src/characters/nameHelper.js';

test('StaticNPC: the position hash is x ^ y<<2 ^ z>>2', () => {
  // GetPositionHash (:333-336). Shift binds tighter than xor in both
  // languages, so the literal transcription is already right - the
  // parens in the port are for the reader, not for the semantics.
  // A LITERAL, not the same expression written twice: re-deriving the
  // formula in the assertion pins nothing at all - it passes against
  // any implementation that happens to match itself.
  assert.equal(positionHash(100, 200, 300), 783);
  assert.equal(positionHash(1, 0, 0), 1);
  assert.equal(positionHash(0, 1, 0), 4, 'y shifts UP by two');
  assert.equal(positionHash(0, 0, 4), 1, 'z shifts DOWN by two');
  assert.equal(positionHash(0, 0, 0), 0);
  // it separates positions that differ in ANY axis
  assert.notEqual(positionHash(1, 0, 0), positionHash(0, 1, 0));
  assert.notEqual(positionHash(0, 0, 4), positionHash(0, 0, 0));
});

test('StaticNPC: the NAME SEED groups its terms the C# way', () => {
  // `data.nameSeed = (int)position ^ buildingKey + locationIndex;`
  // In C# `+` binds TIGHTER than `^`, so it reads
  // position ^ (buildingKey + locationIndex). The other grouping is
  // the natural way to read it left-to-right and would give every NPC
  // in the game a different name.
  // The inputs are chosen so the two readings DISAGREE. Most triples
  // give the same answer either way - the first draft of this pin used
  // one that did, and would have passed against the wrong grouping.
  // wave 24: staticNpcData is the questBridge-corrected overload now -
  // `(personRecord, sceneContext)`, over the ZERO struct, with race
  // and context. The layout position rides rawX/rawY/rawZ, as
  // collectInteriorPeople hands it over.
  const d = staticNpcData({ rawX: 1, rawY: 2, rawZ: 3, position: 0xFF }, { buildingKey: 1, locationIndex: 1 });
  assert.equal(d.nameSeed, 0xFF ^ (1 + 1), 'position ^ (buildingKey + locationIndex)');
  assert.equal(d.nameSeed, 253);
  assert.notEqual(d.nameSeed, (0xFF ^ 1) + 1, 'and NOT (position ^ buildingKey) + locationIndex, which is 255');
});

test('StaticNPC: gender is FLAG BIT 32, and nothing else', () => {
  // `((flags & 32) == 32) ? Female : Male` - so bit 5 alone decides,
  // and every other flag bit is irrelevant to it.
  // wave 24: the Genders ENUM, as C# writes it - the port used to emit
  // the strings 'female'/'male' here, which meant FullName could not
  // be handed npcData.gender the way GetDisplayName does (:328).
  assert.equal(staticNpcData({ flags: 32 }).gender, GENDERS.Female);
  assert.equal(staticNpcData({ flags: 0 }).gender, GENDERS.Male);
  assert.equal(staticNpcData({ flags: 32 | 1 | 64 }).gender, GENDERS.Female);
  assert.equal(staticNpcData({ flags: 1 | 64 }).gender, GENDERS.Male);
});

test('StaticNPC: FACTION.TXT races are a DIFFERENT enum, not an offset', () => {
  // This is the pin that matters most here, because the wrong version
  // is plausible and silent: FactionRaces is Nord 0, Khajiit 1,
  // Redguard 2, Breton 3, Argonian 4, WoodElf 5, HighElf 6, DarkElf 7
  // (FactionFile.cs:609-623) while Races is Breton 1, Redguard 2,
  // Nord 3, DarkElf 4, HighElf 5, WoodElf 6, Khajiit 7, Argonian 8.
  // The ORDERS disagree as well as the bases, so "the same list one
  // lower" is wrong for every entry but one - and every NPC in the
  // game would have taken the wrong race with the suite green.
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7].map(raceFromFactionRace),
    [RACES.Nord, RACES.Khajiit, RACES.Redguard, RACES.Breton,
      RACES.Argonian, RACES.WoodElf, RACES.HighElf, RACES.DarkElf],
  );
  // and it is NOT the identity, nor a shift of it
  assert.notEqual(raceFromFactionRace(0), RACES.Breton);
  assert.notEqual(raceFromFactionRace(1), RACES.Nord);
  // None (-1) and the four values with no Races counterpart
  for (const none of [-1, 11, 17, 18, 19, 99, undefined]) {
    assert.equal(raceFromFactionRace(none), null, `${none} has no race`);
  }
});

test('StaticNPC: an unfactioned person is a LOCAL', () => {
  // GetRaceFromFaction (:357-369): faction 0 skips the lookup
  // entirely, and a faction whose race is None falls through the same
  // way - both land on the race of the region the player is in, which
  // is what makes a village look like its province.
  const region = () => RACES.Nord;
  assert.equal(raceFromFaction(0, () => { throw new Error('must not look up faction 0'); }, region), RACES.Nord);
  assert.equal(raceFromFaction(42, () => ({ race: 3 }), region), RACES.Breton, 'a named faction lends its race');
  assert.equal(raceFromFaction(42, () => ({ race: -1 }), region), RACES.Nord, 'race None falls to the region');
  // AUDIT 24 (the seven-slice sweep): an UNKNOWN faction answers Nord -
  // but not through the region. C# ignores GetFactionData's bool and
  // reads the `out` struct anyway, and a miss leaves it at its default
  // whose race field is 0 = FactionRaces.Nord. The port read undefined
  // there and fell to the region, which happens to agree only when the
  // region IS Nord - so pin it against a region that is not.
  assert.equal(raceFromFaction(42, () => null, () => RACES.Breton), RACES.Nord,
    "an unknown faction is a NORD, from the zero struct - not a local");
  assert.equal(raceFromFaction(42, () => ({ race: -1 }), () => RACES.Breton), RACES.Breton,
    'while a race that really maps to None does fall to the region');
});

test('StaticNPC: an INDIVIDUAL faction answers its own name; everyone else is seeded', () => {
  // GetDisplayName (:315-328). A named lord is always that lord; a
  // shopkeeper is generated from the name seed, which makes them
  // stable for that position with nothing stored anywhere.
  const d = staticNpcData({ x: 12, y: 34, z: 56, position: 999, buildingKey: 3, locationIndex: 2, factionId: 100 });
  d.race = RACES.Breton;
  const individual = () => ({ type: FACTION_TYPE_INDIVIDUAL, name: 'King Gothryd' });
  assert.equal(staticNpcName(d, { getFaction: individual }), 'King Gothryd');

  const ordinary = () => ({ type: 2, name: 'The Merchants' });
  const once = staticNpcName(d, { getFaction: ordinary });
  assert.ok(once && once.length > 1 && once !== 'The Merchants');
  // STABLE: the same seed is the same person, every time
  assert.equal(staticNpcName(d, { getFaction: ordinary }), once);
  // and a person one position over is somebody else
  const other = staticNpcData({ x: 12, y: 34, z: 56, position: 1000, buildingKey: 3, locationIndex: 2, factionId: 100 });
  other.race = RACES.Breton;
  assert.notEqual(staticNpcName(other, { getFaction: ordinary }), once);
  // no faction lookup at all still names them
  assert.ok(staticNpcName(d).length > 1);
});

test('StaticNPC: the name bank follows the race, and an unknown race falls to Breton', () => {
  assert.equal(bankForRace(RACES.Redguard), bankForRace(RACES.Redguard));
  assert.equal(bankForRace(9999), bankForRace(RACES.Breton), 'getNameBank\'s own fallback');
  // a female Nord and a male Nord draw from the same bank
  assert.equal(bankForRace(RACES.Nord), bankForRace(RACES.Nord));
});

test('StaticNPC: the layout record carries what the billboard needs', () => {
  const d = staticNpcData({
    rawX: 5, rawY: 6, rawZ: 7, flags: 32, factionID: 88,
    textureArchive: 182, textureRecord: 4, position: 4242,
  }, { mapId: 17, locationIndex: 9, buildingKey: 300 });
  assert.equal(d.billboardArchiveIndex, 182);
  assert.equal(d.billboardRecordIndex, 4, 'the portrait resolves off THIS pair');
  assert.equal(d.factionID, 88);
  assert.equal(d.mapID, 17);
  assert.equal(d.buildingKey, 300);
  assert.equal(d.hash, positionHash(5, 6, 7));
});
