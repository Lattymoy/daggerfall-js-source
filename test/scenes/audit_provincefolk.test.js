// AUDIT PROVINCE-FOLK (2026-10-28, bible/01-Overview/audits/Audit-Province-Folk.md; the owner: "Audit this", of
// PROVINCE-FOLK): the fixes pinned on the real producers - a foe drawn where it stands, so two machines in one room
// agree and a new kit never re-races it (A5, B1, C2); a revenant born past the Bay rising in its killer's race wherever
// it returns (A1); a ship's crew her waters' people, never the viewer's (A3, B2, C3); a room's standing people read
// with the faction table and the region's race (A2), a region's faction's people and a quest's the place's own past the
// Bay (A10, A6); a spouse in the line's race (A4); the Bay's walkers dressed off the same seed (A7); the regulars'
// place asked once a frame (A9); and the zones whose people differ from their province's (B6).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setFolkPlace, folkHere, nativeHere, folkAt, folkOfLocation, folkOfKey, folkKeyOf, withZone, ZONE_FOLK, PROVINCE_FOLK, FOLK_RACE_KEYS } from '../../src/characters/provinceFolk.js';
import { foeLook, foeSeed, applyWireLook, rosterLook, bodyRaceOf, FOE_RACES } from '../../src/characters/foeBodies.js';
import { standingPersonLook, personLook } from '../../src/characters/peopleBodies.js';
import { folkLook } from '../../src/characters/folkBodies.js';
import { regularsToStand } from '../../src/world/card/cardRegulars.js';
import { mintResident } from '../../src/systems/livingWorld/census.js';
import { townKeeper } from '../../src/systems/merchantYards.js';
import { raceOf } from '../../src/scenes/portHost.js';
import { createEquipTable } from '../../src/characters/equipTable.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { THEATRE_KEYS, theatreAt } from '../../src/world/worldWide/worldGrid.js';
import { CITIES } from '../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay } from '../../src/world/tamriel/tamrielFrame.js';
import { regionOfTheatre, CYRODIIL_REGION, REGION_RACES } from '../../src/formats/mapsTables.js';
import { mapPixelToLongitudeLatitude } from '../../src/formats/mapsFile.js';
import { RACES } from '../../src/systems/races.js';
import { GENDERS, BANK_TYPES } from '../../src/characters/nameHelper.js';
import { FACTION_TYPES, SOCIAL_GROUPS, GUILD_GROUPS } from '../../src/formats/factionFile.js';
import { PERSON_TEXTURES } from '../../src/characters/mobile/mobilePerson.js';
import { hostText } from '../hostText.mjs';
const { createExteriorFoes } = await import('../../src/scenes/exteriorFoes.js');
const N = await import('../../src/systems/revenant/revenant.js');
const RC = await import('../../src/systems/revenant/revenantCompanions.js');
const S = await import('../../src/systems/companionSlots.js');
const { setPref, _resetForTests } = await import('../../src/systems/uiPrefs.js');
const { MOBILE_TYPES } = await import('../../src/characters/mobile/mobileTypes.js');

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const theatre = (k) => THEATRE_KEYS.indexOf(k);
const MORROWIND = regionOfTheatre(theatre('Morrowind')), SKYRIM = regionOfTheatre(theatre('Skyrim'));
const share = (list, race) => list.filter((r) => r === race).length / list.length;
const cityPixel = (name) => { const c = CITIES.find((x) => x.name === name); return pictureToBay(c.at[0], c.at[1]).map(Math.floor); };
/** The world host's doors as world.js wires them: feet stand on the pixel `pixelOfFeet` says, the player on `player`;
 *  the region at a pixel is `regionAt`'s. */
const doors = (player, regionAt, pixelOfFeet = (feet) => ({ x: feet[0], y: feet[2] })) => setFolkPlace((feet) => (feet ? pixelOfFeet(feet) : player), regionAt);
const foe = (feet, extra = {}) => ({ mobileType: 130, marker: null, seq: feet[0] * 1000 + feet[2], gender: 'male', entity: { isClass: true, race: undefined, equip: createEquipTable(), items: [] }, ai: { feet, yaw: 0 }, ...extra });

test('AUDIT PROVINCE-FOLK A5 (B1, C2): a foe is drawn where it STANDS - two machines in one room, their players on either side of a border, stand one foe as one people; a new kit never re-races it; the player\'s own place for none (mutants: the viewer\'s place; the race drawn again with the kit)', () => {
  try {
    // the border at x 0: Morrowind's land west of it, Cyrodiil's east - the foe on Morrowind's side
    const regionAt = (x) => (x < 0 ? MORROWIND : CYRODIIL_REGION);
    let differ = 0;
    for (let i = 0; i < 200; i++) {
      const owner = foe([-5 - i, 0, 3]);
      doors({ x: -10, y: 0 }, regionAt);   // the owner stands in Morrowind
      const mine = foeLook(owner).race;
      const copy = foe([-5 - i, 0, 3], { _mwWire: 'seed' });
      applyWireLook(copy, { ls: foeSeed(owner) });
      doors({ x: 40, y: 0 }, regionAt);   // the peer stands in Cyrodiil
      assert.equal(foeLook(copy).race, mine, `foe ${i}: one people on both machines`);
      if (mine !== foeLook(foe([5 + i, 0, 3], { _mwSeedWire: foeSeed(owner) })).race) differ++;
    }
    assert.ok(differ > 100, `the same seed across the border is another people (${differ} of 200)`);
    doors({ x: -10, y: 0 }, regionAt);
    const f = foe([-50, 0, 9]), race = foeLook(f).race;
    doors({ x: 40, y: 0 }, regionAt);
    f.ai.feet = [60, 0, 9];   // it walked over the border
    f.entity.equip.slots[EQUIP_SLOTS.ChestClothes] = { templateIndex: 165, group: 'MensClothing', equipSlot: EQUIP_SLOTS.ChestClothes, dye: 2 };   // and changed its shirt
    assert.equal(foeLook(f).race, race, 'its race was drawn once, where it stood');
    doors({ x: -10, y: 0 }, regionAt, () => null);
    assert.equal(folkHere(), PROVINCE_FOLK.Morrowind, 'the player\'s own place');
  } finally { setFolkPlace(null, null); }
});

const settle = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); };
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const poolRig = () => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes: async () => new Uint8Array(74),
  getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: { level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5,
});
const me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-pfolk', level: 8, health: 100, maxHealth: 100 };

test('AUDIT PROVINCE-FOLK A1: a revenant born past the Bay is the race its killer was drawn in - its record keeps it, every return anywhere stands it, a save keeps it and drops a race no people has, its sworn self at my side wears it (mutants: the race unkept; the stamp without it; the save drops it; the party without it)', async () => {
  try {
    _resetForTests(); setPref('lootRarity', true);
    N._resetRevenantForTests(); RC._resetRetinuePlayer?.(); S._resetCompanionSlotsForTests(); RC.setRetinuePlayer(me);
    doors({ x: 3, y: 4 }, () => MORROWIND, () => ({ x: 3, y: 4 }));   // the deed done in Morrowind
    let found = null;
    for (let i = 0; i < 40 && !found; i++) {
      const pool = createExteriorFoes(poolRig());
      const killer = await pool.spawnFoe(MOBILE_TYPES.Warrior, [3 + i * 7, 0, 4], { gender: 'female', feetGiven: true });
      const race = foeLook(killer)?.race;
      const bay = (setFolkPlace(null, null), foeLook({ ...killer, _mwLook: undefined, _mwLookSlots: undefined, _mwRaceSeed: undefined, entity: { ...killer.entity } })?.race);
      doors({ x: 3, y: 4 }, () => MORROWIND, () => ({ x: 3, y: 4 }));
      if (race && race !== bay) found = { killer, race };
    }
    assert.ok(found, 'a Morrowind killer the Bay\'s draw would make another race');
    const { killer, race } = found;
    killer.entity.champion = 'mighty'; killer.entity.unquiet = true; killer.entity.level = 6;
    assert.equal(bodyRaceOf(killer), race, 'its body\'s race, as the lane draws it');
    const r = N.revenantDeed(me, killer.entity, 'felled', { mobileType: killer.mobileType, gender: killer.gender, rec: killer, ally: 'Aldric', rolls: () => 0 });
    assert.ok(r, 'a revenant');
    assert.equal(r.race, race, 'born in its killer\'s race');
    assert.equal(killer.entity.revenant.race, race, 'stamped on the body still standing');
    setFolkPlace(null, null);   // it returns on the Bay
    const back = await createExteriorFoes(poolRig()).spawnFoe(r.mobileType, [40, 0, -12], { feetGiven: true, ...N.revenantSpawnOptions(r, me.level) });
    assert.equal(foeLook(back).race, race, 'a return on the Bay: the same race');
    const saved = N.mergeRevenants([JSON.parse(JSON.stringify(r))], [])[0];
    assert.equal(saved.race, race, 'the save keeps it');
    assert.equal(N.mergeRevenants([{ ...JSON.parse(JSON.stringify(r)), race: 'Dremora' }], [])[0].race, null, 'and drops a race no people has');
    assert.ok(N.revenantSpared(me, back.entity, { state: 'with' }), 'sworn');
    const party = RC.revenantParty().party;
    assert.equal(party[0].folk, race, 'the sworn member carries its race to the layer');
    assert.match(rd('src/scenes/crewAshore.js'), /rec\.person = companionPerson\(c\);[^\n]*\n\s*rec\.folk = c\.folk \?\? null;/, 'which stamps it with its person');
    assert.equal(foeLook(foe([9, 0, 9], { person: 77, folk: race })).race, race, 'and the body it stands is that race');
  } finally { setFolkPlace(null, null); }
});

test('AUDIT PROVINCE-FOLK A3 (B2, C3): a ship\'s crew are her waters\' people wherever she is met - a Morrowind ship\'s Dark Elves at Daggerfall, a Bay ship\'s the Bay\'s at Mournhold - and every crew\'s home rides her entry (mutants: the home unread; the viewer\'s place; the entry\'s home dropped)', () => {
  try {
    for (const [player, people] of [[17, 'Morrowind'], [MORROWIND, null]]) {
      doors({ x: 0, y: 0 }, () => player);
      const hands = Array.from({ length: 300 }, (_, i) => rosterLook({}, { mobileType: 130, seed: i * 31, home: people }).race);
      if (people) assert.ok(share(hands, 'DarkElf') > 0.72, `a Morrowind ship's hands at Daggerfall: ${share(hands, 'DarkElf')}`);
      else assert.ok(share(hands, 'DarkElf') < 0.15 && hands.every((r) => FOE_RACES.some(([x]) => x === r)), 'a Bay ship\'s at Mournhold: the Bay\'s');
    }
    assert.match(rd('src/scenes/naval/navalCrew.js'), /seed: Math\.imul\(\(ship\.seed \| 0\) \+ i, 0x9e3779b1\) >>> 0,\n\s*home: ship\.home,\n\s*\}\);/);
    assert.match(rd('src/scenes/naval/navalCrew.js'), /seed: w\.seed \| 0,\n\s*home: w\.home \?\? null,\n\s*\};/);
    assert.match(rd('src/scenes/naval/navalHost.js'), /seed: e\.ship\.seed, home: watersFolkKey\(e\), faction:/);
    assert.match(rd('src/scenes/naval/navalHost.js'), /const watersFolkKey = \(e\) => folkKeyOf\(Number\.isInteger\(e\.area\) && e\.area >= BAY_AREA_COUNT \? folkOfArea\(e\.area\) : folkOfRegion\(e\.region \?\? -1\)\);/);
    assert.match(hostText('src/scenes/world.js'), /seed: s\.seed, home: s\.home, faction: s\.faction,/);
  } finally { setFolkPlace(null, null); }
});

const fac = (o) => ({ type: FACTION_TYPES.Generic, sgroup: SOCIAL_GROUPS.Commoners, ggroup: GUILD_GROUPS.None, race: -1, region: -1, ...o });
const pnOf = (o = {}) => ({ factionID: 0, flags: 0, nameSeed: 77, hash: 5, billboardArchiveIndex: 182, billboardRecordIndex: 1, textureArchive: 182, textureRecord: 1, ...o });

test('AUDIT PROVINCE-FOLK A2, A10, A6: a room\'s standing person is read as the street reads one - the faction table and the region\'s race - so a factionless one has a body and a factioned one their faction\'s race; past the Bay a region\'s faction\'s people (a Bay town\'s, a province\'s court) and a quest\'s are the place\'s own; a named one keeps theirs (mutants: the room\'s context alone; a Bay faction\'s race past the Bay; the named lifted)', () => {
  try {
    const dict = new Map([[526, fac({ type: FACTION_TYPES.People, race: 3, region: 23 })], [406, fac({ type: FACTION_TYPES.Individual, race: 2, region: 20 })], [40, fac({ ggroup: GUILD_GROUPS.MagesGuild, type: 2, race: -1 })], [399, fac({ race: 2 })]]);
    const ctx = { mapId: 1, locationIndex: 2, buildingKey: 3 };
    setFolkPlace(null, null);   // the Bay: DFU's GetRaceFromFaction
    assert.equal(standingPersonLook(pnOf(), ctx, dict, REGION_RACES[20] + 1)?.race, 'Redguard', 'a factionless person of Sentinel: a body, the region\'s race');
    assert.equal(standingPersonLook(pnOf({ factionID: 399 }), ctx, dict, REGION_RACES[17] + 1)?.race, 'Redguard', 'a factioned one: their faction\'s race, never Nord');
    assert.equal(standingPersonLook(pnOf({ factionID: 40 }), ctx, dict, REGION_RACES[17] + 1)?.race, 'Breton', 'a guild\'s (no race): the region\'s');
    assert.equal(standingPersonLook(pnOf({ factionID: 526 }), ctx, dict, REGION_RACES[17] + 1)?.race, 'Breton');
    doors({ x: NaN, y: NaN }, () => SKYRIM);
    assert.equal(standingPersonLook(pnOf({ factionID: 526 }), ctx, dict, REGION_RACES[SKYRIM] + 1)?.race, 'Nord', 'the People of Wayrest in a Skyrim building: Skyrim\'s');
    assert.equal(standingPersonLook(pnOf({ factionID: 406 }), ctx, dict, REGION_RACES[SKYRIM] + 1)?.race, 'Redguard', 'a named one keeps theirs');
    assert.equal(standingPersonLook(pnOf({ factionID: 399 }), ctx, dict, REGION_RACES[SKYRIM] + 1)?.race, 'Redguard', 'one of a people\'s own faction keeps theirs');
    doors({ x: NaN, y: NaN }, () => CYRODIIL_REGION);
    assert.equal(standingPersonLook(pnOf(), ctx, dict, REGION_RACES[CYRODIIL_REGION] + 1)?.race, 'Imperial', 'a factionless one of Cyrodiil indoors: an Imperial');
    const quest = { race: RACES.Breton, gender: GENDERS.Male, nameSeed: 1, hash: 2, factionID: 0, billboardArchiveIndex: 182, billboardRecordIndex: 1, questPerson: true };
    assert.equal(personLook({}, quest, null).race, 'Imperial', 'a quest\'s person of the region there: an Imperial (A6)');
    assert.match(rd('src/scenes/worldModes.js'), /return standingPersonLook\(pn, staticNpcSceneCtx\(pn\), dict, figureCtx\.race\);/, 'the building\'s people and the dungeon\'s (its one standingLook)');
  } finally { setFolkPlace(null, null); }
});

test('AUDIT PROVINCE-FOLK A4, A7, A9: a spouse stands in the line\'s race; a Bay walker is dressed off its roll alone, the race in its key; a table\'s regulars ask the place once a frame, and only for the Imperial bank (mutants: the census\'s race over the line\'s; the race in the seed; the place asked per regular)', () => {
  assert.match(rd('src/scenes/legacyHost.js'), /const res = \{ \.\.\.census, race: s\.race \|\| census\.race, name: fullNameOf\(s\.given, s\.surname\),/);
  const a = { archive: PERSON_TEXTURES.Breton.male[0], personFaceRecordId: 3, nameNPC: 'Aldo Hent', gender: GENDERS.Male, state: 'move' };
  folkLook(a, 'Breton');
  const b = { ...a, _mwShell: a._mwShell, _mwFolk: undefined, folk: 'DarkElf' };
  folkLook(b, 'Breton');
  assert.equal(b._mwFolk.seed, a._mwFolk.seed, 'one roll, one dress - whatever its race');
  assert.notEqual(b._mwFolk.key, a._mwFolk.key, 'and the race in its key: another look');
  try {
    let asked = 0;
    setFolkPlace(() => { asked++; return { x: NaN, y: NaN }; }, () => CYRODIIL_REGION);
    const session = { seats: [0, 1, 2, 3].map((i) => ({ kind: 'patron', name: `R${i}` })) };
    const seats = [0, 1, 2, 3].map(() => ({ feet: [0, 0, 0], yaw: 0, top: 0 }));
    const stand = (bank) => regularsToStand({ session, seats, seatOf: [0, 1, 2, 3], regulars: new Map([0, 1, 2, 3].map((i) => [`R${i}`, { seed: i, bank, gender: i % 2 }])), key: 'k' });
    const out = stand(BANK_TYPES.Imperial);
    assert.equal(asked, 1, 'once a frame for the table');
    assert.ok(out.every((o) => o.res.look.race === 'Imperial'), 'Cyrodiil\'s regulars');
    stand(BANK_TYPES.Breton);
    assert.equal(asked, 1, 'never for a bank whose race it names');
  } finally { setFolkPlace(null, null); }
});

test('AUDIT PROVINCE-FOLK B6: the zones whose people are their own - the Reach\'s Reachmen, Reaper\'s March\'s Khajiit, Gideon\'s and Leyawiin\'s Blackwood - read off the pixel by the walkers, the census, the keepers, the hands, the foes and the standing people; the rest of a province its own (mutants: a zone unread; a zone\'s people moved)', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(ZONE_FOLK).map(([k, f]) => [k, f.map(([r, w]) => `${r} ${w}`).join(', ')])), {
    skyrimReach: 'Breton 60, Nord 28, Imperial 4, Redguard 3, DarkElf 3, Khajiit 2',
    valenwoodReapersMarch: 'WoodElf 55, Khajiit 35, Imperial 5, HighElf 3, Breton 2',
    blackMarshGloomire: 'Argonian 60, Imperial 30, DarkElf 4, Khajiit 3, Breton 3',
    cyrodiilBlackwood: 'Imperial 60, Argonian 16, Khajiit 12, Breton 4, Redguard 3, WoodElf 3, DarkElf 2',
  });
  for (const f of Object.values(ZONE_FOLK)) assert.equal(f.reduce((n, [, w]) => n + w, 0), 100);
  assert.ok(Object.values(ZONE_FOLK).flat().every(([r]) => FOLK_RACE_KEYS.includes(r)));
  const at = (city) => { const [x, y] = cityPixel(city); return { x, y, region: regionOfTheatre(theatreAt(x, y)) }; };
  for (const [city, key] of [['Markarth', 'skyrimReach'], ['Arenthia', 'valenwoodReapersMarch'], ['Gideon', 'blackMarshGloomire'], ['Leyawiin', 'cyrodiilBlackwood'], ['Solitude', 'Skyrim'], ['Mournhold', 'Morrowind'], ['Imperial City', 'Imperial']]) {
    const p = at(city);
    assert.equal(folkKeyOf(folkAt(p.x, p.y, p.region)), key, city);
    const ll = mapPixelToLongitudeLatitude(p.x, p.y);
    assert.equal(folkOfLocation({ regionIndex: p.region, mapTableData: { longitude: ll.x, latitude: ll.y } }), folkOfKey(key), `${city}: a location's people off its row`);
  }
  assert.equal(withZone(null, ...cityPixel('Markarth')), null, 'none on the Bay');
  const m = at('Markarth');
  const res = Array.from({ length: 200 }, (_, s) => mintResident({ mapId: 9200, px: m.x, py: m.y, type: 0, region: m.region, people: 0, blocks: 16 }, 'h', s, 'townsperson').race);
  assert.ok(share(res, 'Breton') > 0.5, `Markarth's residents are the Reachmen: ${share(res, 'Breton')}`);
  const k = townKeeper(4242, m.region, folkAt(m.x, m.y, m.region));
  assert.equal(k.home, 'skyrimReach', 'a keeper there, and his hands with him');
  const hands = Array.from({ length: 200 }, (_, i) => raceOf({ key: `m${i}`, regionIndex: m.region, keeper: k }, { role: 'worker', i }));
  assert.ok(share(hands, 'Breton') > 0.5, `the Reach's hands: ${share(hands, 'Breton')}`);
  try {
    doors({ x: m.x, y: m.y }, () => m.region);
    assert.equal(nativeHere(), 'Breton', 'the Reach\'s standing people: its own');
    const foes = Array.from({ length: 200 }, (_, i) => foeLook(foe([m.x, 0, m.y], { seq: i + 1 })).race);
    assert.ok(share(foes, 'Breton') > 0.5, `and its foes: ${share(foes, 'Breton')}`);
  } finally { setFolkPlace(null, null); }
  assert.match(hostText('src/scenes/world.js'), /folk = folkOfLocation\(dfLocation\);/, 'the town\'s keepers');
  assert.match(hostText('src/scenes/world.js'), /keeper: yardKeeper\(mapId, t\.kind, regionIndex, folk\)/);
  assert.match(hostText('src/scenes/world.js'), /portKeeper\(mapId, 'shipyard', regionIndex, folk\)/);
});
