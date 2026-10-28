// AUDIT TESA II, lane P (2026-10-25; bible/03-World/Arena-Provinces.md, bible/03-World/World-Wide.md) - THE LAWS: the
// discovery store's key of a place off the Bay's pixel ids (P6), the journey into the land past the Bay (P4), and the
// nearest safe place of the world (P2/P3, A2-4's rise), each run over the producers' own ids.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { discoverLocation, hasDiscoveredLocationId, discoveryKeyOf, snapshotDiscovery, restoreDiscovery } from '../../src/systems/discovery.js';
import { countryPlaceId, countryOrdinal } from '../../src/world/tamrielCountry.js';
import { lairPlaceId, lairCellOf } from '../../src/world/tamrielDungeons.js';
import { arenaPlaceId } from '../../src/world/arenaLocations.js';
import { etherPlaceId } from '../../src/world/etherPlaces.js';
import { capitalPlaceId } from '../../src/world/tamrielCapitals.js';
import { spawnedMapId } from '../../src/world/spawnedDungeons.js';
import { spawnedHallMapId } from '../../src/net/wire.js';
import { getAbyssMapId } from '../../src/world/oceanHoles.js';
import { pastBayJourney, PAST_BAY_TRAVEL_TEXT } from '../../src/systems/travel/pastBayTravel.js';
import { nearestSafePlace } from '../../src/systems/deathRespawn.js';
import { LOCATION_TYPES as T } from '../../src/formats/mapsFile.js';
import { ETHER_BOX } from '../../src/world/ethericSea.js';

afterEach(() => restoreDiscovery(null));

test('AUDIT TESA II P6: a place off the Bay\'s pixel ids is filed and found by its whole id - a farm never finds the farm 64 rows away, a lair never a farm, an isle\'s place never an Arena town; a Bay place, a spawn on a Bay pixel and an Abyss pit keep DFU\'s mask; a hall is never filed (mutant: the mask kept for every id; the Bay\'s bound off by one)', () => {
  const farm = (x, y) => countryPlaceId(countryOrdinal(x, y));
  const a = farm(1900, -280), b = farm(1900, -152);   // 128 rows apart: two lanes, the same low 20 bits
  assert.equal(a & 0xfffff, b & 0xfffff, 'the producer mints them alike in the low 20 bits');
  assert.ok(discoverLocation(a, { regionName: 'Skyrim', locationName: 'The Mojens Farmstead' }));
  assert.equal(hasDiscoveredLocationId(a), true);
  assert.equal(hasDiscoveredLocationId(b), false, 'the farm two lanes away not found');
  const c = lairCellOf(2179, -359), lair = lairPlaceId(c), farmOfLair = countryPlaceId(c);   // the lair's low 20 a farm's
  assert.equal(lair & 0xfffff, farmOfLair & 0xfffff);
  discoverLocation(lair);
  assert.equal(hasDiscoveredLocationId(farmOfLair), false, 'a lair never a farm');
  const town = arenaPlaceId({ provinceIndex: 0, id: 5 }), isle = etherPlaceId({ cx: 5, cy: 0 });
  assert.equal(town & 0xfffff, isle & 0xfffff, 'an Arena town and an isle\'s place of row 0 share the low 20 bits');
  discoverLocation(isle);
  assert.equal(hasDiscoveredLocationId(town), false);
  assert.equal(discoveryKeyOf(capitalPlaceId(0)), capitalPlaceId(0), 'a capital by its whole id');
  // the Bay's own: DFU's mask - a spawn on a Bay pixel is that pixel's, an Abyss pit its pixel's
  const bayPixel = 123 * 1000 + 456;
  assert.equal(discoveryKeyOf(bayPixel), bayPixel);
  assert.equal(discoveryKeyOf(spawnedMapId(3, 456, 123)), bayPixel);
  assert.equal(discoveryKeyOf(getAbyssMapId(456, 123)), bayPixel);
  assert.equal(discoveryKeyOf(499 * 1000 + 999), 499999, 'the Bay\'s last pixel id is the Bay\'s');
  assert.equal(discoveryKeyOf((7 << 20) | 500000) >>> 0, ((7 << 20) | 500000) >>> 0, 'the first id past it is whole');
  assert.equal(discoverLocation(spawnedHallMapId(2069, 700)), false, 'a hall is never filed');
});

test('AUDIT TESA II P6: the save keeps a whole id and drops a key of before - a place past the Bay filed by its low 20 bits, which no id answers now and which named several places (mutant: the old key kept)', () => {
  const a = countryPlaceId(countryOrdinal(1900, -280));
  discoverLocation(a, { regionName: 'Skyrim', locationName: 'A Farm' });
  discoverLocation(5 * 1000 + 7, { regionName: 'Daggerfall', locationName: 'A Bay Town' });
  const snap = JSON.parse(JSON.stringify(snapshotDiscovery()));
  restoreDiscovery(snap);
  assert.deepEqual([hasDiscoveredLocationId(a), hasDiscoveredLocationId(5 * 1000 + 7)], [true, true], 'round trip');
  const old = { locations: { [a & 0xfffff]: { regionName: 'Skyrim', locationName: 'A Farm' }, [5007]: { regionName: 'Daggerfall', locationName: 'A Bay Town' } } };
  restoreDiscovery(old);
  assert.deepEqual(Object.keys(snapshotDiscovery().locations), ['5007'], 'the old key past the Bay let go, the Bay\'s kept');
});

test('AUDIT TESA II P4: no journey INTO the land past the Bay - its end past the Bay refused in the door\'s words; the Bay\'s ends, the Veil\'s side and the open zone\'s own journeys (inside to inside) the zone\'s verdict; the zone\'s refusal said first (mutant: the end on the Bay refused; the zone\'s own journeys refused; the zone\'s refusal lost)', () => {
  const ok = { ok: true, fee: 0 }, bay = { x: 200, y: 200 }, windhelm = { x: 2215, y: -371 };
  assert.deepEqual(pastBayJourney(bay, windhelm, null, ok), { ok: false, text: PAST_BAY_TRAVEL_TEXT.refused });
  assert.match(PAST_BAY_TRAVEL_TEXT.refused, /Portal Stone/);
  assert.equal(pastBayJourney(windhelm, windhelm, null, ok).ok, false, 'from past the Bay to past it: no fast travel there either');
  assert.equal(pastBayJourney(windhelm, bay, null, ok), ok, 'out to the Bay: the zone\'s verdict (OWNER - recorded on TESA-NO-FAST)');
  assert.equal(pastBayJourney(bay, { x: 999, y: 499 }, null, ok), ok, 'the Bay\'s last pixel is the Bay\'s');
  assert.equal(pastBayJourney(bay, { x: 1000, y: 499 }, null, ok).ok, false, 'one past it is not');
  assert.equal(pastBayJourney(bay, { x: ETHER_BOX.x0 + 10, y: ETHER_BOX.y0 + 10 }, null, ok), ok, 'past the Veil: the Veil\'s law');
  // the zone: a mask of the zone's own shape (systems/wild/wildZone.js - a grid of cells on the world), a square of Cyrodiil
  const w = 200, inside = new Uint8Array(w * w);
  for (let y = 50; y < 150; y++) for (let x = 50; x < 150; x++) inside[y * w + x] = 1;
  const mask = { ox: 2000, oy: 600, cell: 1, width: w, height: w, inside, near: inside };
  const z = { ...ok, fee: 40 };
  assert.equal(pastBayJourney({ x: 2069, y: 700 }, { x: 2100, y: 700 }, mask, z), z, 'inside to inside: the zone\'s fee and wait');
  const refused = { ok: false, text: 'You cannot travel into Cyrodiil.' };
  assert.equal(pastBayJourney(bay, { x: 2100, y: 700 }, mask, refused), refused, 'the zone\'s own words first');
  assert.equal(pastBayJourney({ x: 2300, y: 900 }, { x: 2100, y: 700 }, mask, ok).ok, false, 'into the zone from past it, the zone\'s own word aside: refused');
  assert.equal(pastBayJourney({ x: 2069, y: 700 }, { x: 2300, y: 900 }, mask, ok).ok, false, 'out of the zone to past the Bay: refused');
});

test('AUDIT TESA II P2/P3: the nearest safe place of the world - the three kinds over the registry\'s rows (`type`) and a list beside them (`locationType`), the crow\'s nearest the caller accepts, nearestSafeLocation\'s shape (mutant: a dungeon a rise; the nearer lost to the later; accept ignored)', () => {
  const rows = [{ type: T.TownVillage, px: 10, py: 0 }, { type: T.DungeonKeep, px: 1, py: 0 }, { type: T.ReligionTemple, px: 5, py: 0 }];
  const extra = [{ locationType: T.TownHamlet, px: 3, py: 0 }];
  const hit = nearestSafePlace([rows, extra], { x: 0, y: 0 });
  assert.deepEqual([hit.kind, hit.mapPixel, hit.locationIndex], ['city', { x: 3, y: 0 }, -1]);
  assert.equal(nearestSafePlace([rows], { x: 0, y: 0 }).kind, 'temple');
  assert.deepEqual(nearestSafePlace([rows, extra], { x: 0, y: 0 }, (h) => h.mapPixel.x > 4).mapPixel, { x: 5, y: 0 });
  assert.equal(nearestSafePlace([[{ type: T.DungeonKeep, px: 1, py: 0 }]], { x: 0, y: 0 }), null);
});
