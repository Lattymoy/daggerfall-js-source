// WOD1 - WORLD OF DAGGERFALL: THE VENDORED FILES AND THEIR READERS.
//
// The mod is Kamer's (vendor/world-of-daggerfall/README.md). These pins
// hold three things: that the vendored files are the author's (sha256
// against the shipped archive, and the packs against the record the
// tool wrote), that the ported readers read them as LocationHelper.cs
// does (.NET TryParse, the shared index, the empty-prefab skip), and
// that the mod is wired where every vendored mod is - the registry,
// the credit, the Features row and the online lane.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadLocationInstance, loadLocationPrefab, validateValue, ntfsCompare,
  tryParseInt32, tryParseSingle, parseXml, newLocationInstance, newLocationObject,
} from '../src/world/wodLocationData.js';
import { encodeRegionPack, decodeRegionPack, WOD_PACK_COLUMNS } from '../src/world/wodLocationPack.js';
import { readRegionFolder, WOD_BUNDLE_ASSETS } from '../tools/worldOfDaggerfallAssets.mjs';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { FEATURES } from '../src/systems/features.js';
import { CREDITS } from '../src/ui/credits.js';
import { ONLINE_ROOM_MOD_KEYS, ONLINE_PLAYERS_OWN_MODS } from '../src/systems/onlineLane.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const V = join(ROOT, 'vendor/world-of-daggerfall');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const record = JSON.parse(readFileSync(join(V, 'locations.json'), 'utf8'));

// ── the author's files ──────────────────────────────────────────────

const SOURCES = {
  'Scripts/DungeonExterior.cs': '25e82a5eef715c0e3b005ffce5506d4cd38f070a633801dc1710fd9c6de3799d',
  'Scripts/LocationData.cs': 'c3a8ede41034e4f287781f0540e9a437e81edbedb50d4a34be310fdbfef5cf5e',
  'Scripts/LocationEnemySpawner.cs': '8b08119791b64820d3e3535ce692f8b5bd077a3b8a1e9191c58f717bcd6488a7',
  'Scripts/LocationHelper.cs': 'fc9269fe75fc98433a8a15d309bb74785aedb906e9916cd2ec2fd97c9133fcd5',
  'Scripts/LocationLoader.cs': 'f194472b13053705f03522ec48fd685aca1b2816d38fb41229bcc8c935edc650',
  'Scripts/LocationModLoader.cs': '384d8be4373312a2d9617d8252292b0bbadbd04030f859b5df4e26ddb901f791',
  'Scripts/MainQuestLocationOverhaul.cs': '897a64db39a3bdffdf43dce5311d1acbed0290eb6dcf297135407c686d3496ec',
  'Scripts/PrivateersHold.cs': '1a715cae1704a36f3f910f3c2ffc5c6169b749514a79070fe0625bac46d33ed1',
  'worldofdaggerfall.dfmod.json': '15b66ae1eb9e785f6178a2a531cd265e2c99e50e8ac646bb7e15402676da6d04',
};

test('WOD1: the eight sources and the manifest are the author\'s, byte for byte, and the README carries the same hashes', () => {
  const readme = readFileSync(join(V, 'README.md'), 'utf8');
  for (const [rel, want] of Object.entries(SOURCES)) {
    assert.equal(sha(readFileSync(join(V, rel))), want, rel);
    assert.ok(readme.includes(`\`${rel}\` ${want}`), `README lists ${rel} with its hash`);
  }
  assert.ok(readme.includes(record.dfmod.sha256), 'the bundle\'s own hash is on the README');
  // The tool maps every one of the bundle's text assets to one of them.
  assert.deepEqual(Object.values(WOD_BUNDLE_ASSETS).sort(), Object.keys(SOURCES).sort());
  assert.deepEqual(readdirSync(join(V, 'Scripts')).sort(), Object.keys(SOURCES).filter((k) => k.startsWith('Scripts/')).map((k) => k.slice(8)).sort());
});

test('WOD1: the manifest is the shipped one - title, version, author, GUID, and the eight files it names', () => {
  const mf = JSON.parse(readFileSync(join(V, 'worldofdaggerfall.dfmod.json'), 'utf8'));
  assert.equal(mf.ModTitle, 'World_of_Daggerfall');
  assert.equal(mf.ModVersion, '2.0');
  assert.equal(mf.ModAuthor, 'Kamer');
  assert.equal(mf.ContactInfo, 'DFU forums');
  assert.equal(mf.DFUnity_Version, '0.11.0');
  assert.equal(mf.GUID, '98f05888-989f-4ff1-b455-f4cafedaeb88');
  assert.deepEqual(mf.Files.map((f) => f.split('/').pop()).filter((f) => f.endsWith('.cs')).sort(),
    Object.keys(SOURCES).filter((k) => k.endsWith('.cs')).map((k) => k.slice(8)).sort());
});

test('WOD1: every region pack is the record\'s - hash, size, count, and the file table in the mod\'s own load order', () => {
  assert.deepEqual(record.totals, { prefabs: 65, prefabObjects: 1739, regions: 44, files: 2413, instances: 227938 });
  const onDisk = readdirSync(join(V, 'Locations')).sort();
  assert.deepEqual(onDisk, record.regions.map((r) => `${r.region}.bin`).sort(), 'one pack per recorded folder, and nothing else');
  let instances = 0, files = 0;
  for (const r of record.regions) {
    const bytes = readFileSync(join(V, r.pack));
    assert.equal(bytes.length, r.bytes, r.pack);
    assert.equal(sha(bytes), r.sha256, r.pack);
    const d = decodeRegionPack(new Uint8Array(bytes));
    assert.equal(d.region, r.region);
    assert.equal(d.count, r.count);
    // The pack's file table IS the record's, name for name and count
    // for count, and it is in NTFS order - the order Directory.GetFiles
    // hands LocationLoader, which decides which instance wins a pixel.
    assert.deepEqual(d.files.map((f) => [f.file, f.count]), r.files.map(([name, , count]) => [name, count]), r.pack);
    const names = r.files.map(([name]) => name);
    assert.deepEqual(names, [...names].sort(ntfsCompare), `${r.pack}: files in NTFS order`);
    instances += d.count; files += d.files.length;
  }
  assert.equal(instances, 227938);
  assert.equal(files, 2413);
  // The order's teeth: upcase-ordinal, not natural, not case-sensitive.
  assert.deepEqual(['AlikrDesert_Rocks_2.txt', 'alikrDesert_Rocks_13.txt', 'AlikrDesert_Bandits_1.txt', 'AlikrDesert_Rocks_1.txt', 'AlikrDesert_Rocks_10.txt'].sort(ntfsCompare),
    ['AlikrDesert_Bandits_1.txt', 'AlikrDesert_Rocks_1.txt', 'AlikrDesert_Rocks_10.txt', 'alikrDesert_Rocks_13.txt', 'AlikrDesert_Rocks_2.txt']);
});

test('WOD1: the shipped data, measured - every instance type 2, the names and prefabs the arc page states', () => {
  const byName = new Map(), prefabs = new Set();
  let zeroCoords = 0, zeroIds = 0;
  for (const r of record.regions) {
    const d = decodeRegionPack(new Uint8Array(readFileSync(join(V, r.pack))));
    for (let i = 0; i < d.count; i++) {
      assert.equal(d.type[i], 2);
      byName.set(d.name[i], (byName.get(d.name[i]) ?? 0) + 1);
      prefabs.add(d.prefab[i]);
      if (d.worldX[i] === 0 && d.worldY[i] === 0 && d.terrainX[i] === 0 && d.terrainY[i] === 0) zeroCoords++;
      if (d.locationID[i] === 0) zeroIds++;
    }
  }
  assert.deepEqual(Object.fromEntries([...byName].sort()), { Bandits: 7000, Mountains: 2502, Rocks: 209436, Ruins: 4000, Shrine: 5000 });
  assert.equal(prefabs.size, 60);
  const vendored = readdirSync(join(V, 'LocationPrefab')).map((f) => f.replace(/\.txt$/, ''));
  assert.deepEqual([...prefabs].filter((p) => !vendored.includes(p)), [], 'every named prefab is vendored');
  assert.deepEqual(vendored.filter((p) => !prefabs.has(p)).sort(),
    ['WOD_Betony_Docks_North_00', 'WOD_Poor_Docks_North_00', 'WOD_Rocks_Cave_00', 'WOD_Rocks_Large_01', 'WOD_Rocks_Large_02']);
  assert.equal(zeroCoords, 3000, 'the 3,000 empty-coordinate instances read as 0,0,0,0');
  assert.equal(zeroIds, 155398, 'the IDs TryParse refuses read 0: 152,347 past Int32, 3,000 empty, 51 like "625450-103" - and not one is genuinely 0');
});

test('WOD1: the 65 prefabs are the author\'s and the ported LoadLocationPrefab reads every object of every one', () => {
  assert.equal(record.prefabs.length, 65);
  let objects = 0;
  for (const p of record.prefabs) {
    const bytes = readFileSync(join(V, 'LocationPrefab', p.name));
    assert.equal(sha(bytes), p.sha256, p.name);
    const prefab = loadLocationPrefab(bytes.toString('utf8'));
    assert.equal(prefab.obj.length, p.objects, p.name);
    for (const o of prefab.obj) assert.ok(validateValue(o.type, o.name), `${p.name}: ${o.type}:${o.name}`);
    objects += prefab.obj.length;
  }
  assert.equal(objects, 1739);
  // One camp, read in full: the first object of WOD_BanditCamp_01, every field.
  const camp = loadLocationPrefab(rd('vendor/world-of-daggerfall/LocationPrefab/WOD_BanditCamp_01.txt'));
  assert.deepEqual([camp.height, camp.width, camp.obj.length], [2, 2, 31]);
  assert.deepEqual(camp.obj[0], {
    type: 0, name: '41130', objectID: 0,
    pos: { x: Math.fround(3.29), y: Math.fround(0.598), z: Math.fround(10.41) },
    rot: { x: 0, y: Math.fround(-0.3057964), z: 0, w: Math.fround(0.9520969) },
    scale: { x: 1, y: 1, z: 1 },
  });
  assert.deepEqual(camp.obj[3].name, '210.1', 'the campfire is a flat');
});

// ── the reader's law ────────────────────────────────────────────────

test('WOD1: int.TryParse - an Int32 or ZERO (the out is zeroed on failure, not left at the field default)', () => {
  const cases = [
    ['968712709', 968712709], ['2147483647', 2147483647], ['-2147483648', -2147483648],
    ['2147483648', 0], ['4374449871', 0], ['625450-103', 0], ['', 0], ['  12 ', 12],
    ['+7', 7], ['-0', 0], ['007', 7], ['1.0', 0], ['0x10', 0], ['1e3', 0],
  ];
  assert.deepEqual(cases.map(([s]) => tryParseInt32(s)), cases.map(([, v]) => v));
  assert.ok(Object.is(tryParseInt32('-0'), 0), 'not -0');
});

test('WOD1: float.TryParse - through double, narrowed to a C# float; exponents and group separators as en-US reads them', () => {
  assert.equal(tryParseSingle('3.29'), Math.fround(3.29));
  assert.notEqual(tryParseSingle('3.29'), 3.29, 'narrowed');
  assert.equal(tryParseSingle('3.099442E-06'), Math.fround(3.099442e-6));
  assert.equal(tryParseSingle('-0.3057964'), Math.fround(-0.3057964));
  assert.equal(tryParseSingle('1,234.5'), 1234.5);
  assert.equal(tryParseSingle(''), 0);
  assert.equal(tryParseSingle('3,29e'), 0);
  assert.equal(tryParseSingle('1e39'), 0, 'past float.MaxValue fails, as .NET Framework\'s Single.TryParse does');
});

test('WOD1: LoadLocationInstance - the shared index, the empty-prefab skip, the zeroed fields, and the null for a foreign root', () => {
  const xml = `<locations>
<locationInstance><name>Bandits</name><type>2</type><prefab>WOD_BanditCamp_03</prefab>
<worldX>968</worldX><worldY>27</worldY><terrainX>71</terrainX><terrainY>9</terrainY><locationID>968712709</locationID></locationInstance>
<locationInstance><name>Skip</name><type>2</type><prefab></prefab>
<worldX>1</worldX><worldY>2</worldY><terrainX>3</terrainX><terrainY>4</terrainY><locationID>5</locationID></locationInstance>
<locationInstance><name>Rocks</name><type>2</type><prefab>WOD_Rocks_Small_04</prefab>
<worldX></worldX><worldY></worldY><terrainX></terrainX><terrainY></terrainY><locationID>625450-103</locationID></locationInstance>
</locations>`;
  assert.deepEqual(loadLocationInstance(xml), [
    { locationID: 968712709, name: 'Bandits', type: 2, prefab: 'WOD_BanditCamp_03', worldX: 968, worldY: 27, terrainX: 71, terrainY: 9 },
    { locationID: 0, name: 'Rocks', type: 2, prefab: 'WOD_Rocks_Small_04', worldX: 0, worldY: 0, terrainX: 0, terrainY: 0 },
  ]);
  assert.equal(loadLocationInstance('<locationPrefab><height>1</height></locationPrefab>'), null, '"Wrong file format"');
  assert.equal(loadLocationInstance(null), null, 'the File.Exists miss');
  // A list short of a tag is the C#'s NullReferenceException, not a silent 0.
  assert.throws(() => loadLocationInstance('<locations><locationInstance><prefab>X</prefab></locationInstance></locations>'), /NullReferenceException/);
  assert.throws(() => parseXml('<locations><a></b></locations>'), /XmlException/);
  assert.deepEqual(newLocationInstance(), { locationID: 0, name: 'DF_Rocks', type: 0, prefab: '', worldX: 0, worldY: 0, terrainX: 0, terrainY: 0 });
  assert.deepEqual(newLocationObject().rot, { x: 0, y: 0, z: 0, w: 1 });
});

test('WOD1: ValidateValue - an Int32 mesh name, an ARCHIVE.RECORD flat, nothing else', () => {
  const cases = [
    [0, '41130', true], [0, '4113a', false], [0, '99999999999', false], [0, '210.1', false],
    [1, '210.1', true], [1, '097.12', true], [1, '201.00', true], [1, '210', false], [1, '210.1.2', false], [1, 'a.1', false],
    [2, '41130', false],
  ];
  assert.deepEqual(cases.map(([t, n]) => validateValue(t, n)), cases.map(([, , v]) => v));
});

test('WOD1: readRegionFolder reads a folder as the loader does - .txt only, NTFS order, the reader over each', () => {
  const inst = (prefab) => `<locations><locationInstance><name>N</name><type>2</type><prefab>${prefab}</prefab><worldX>1</worldX><worldY>1</worldY><terrainX>1</terrainX><terrainY>1</terrainY><locationID>1</locationID></locationInstance></locations>`;
  const { files } = readRegionFolder([
    { name: 'X_Rocks_2.txt', bytes: Buffer.from(inst('B')) },
    { name: 'notes.md', bytes: Buffer.from('ignored') },
    { name: 'X_Rocks_10.txt', bytes: Buffer.from(inst('A')) },
    { name: 'X_Bandits_1.txt', bytes: Buffer.from(inst('C')) },
  ]);
  assert.deepEqual(files.map((f) => [f.file, f.instances[0].prefab]), [['X_Bandits_1.txt', 'C'], ['X_Rocks_10.txt', 'A'], ['X_Rocks_2.txt', 'B']]);
});

test('WOD1: the pack round-trips a folder exactly, at the narrowest width that holds each column', () => {
  const a = { name: 'Rocks', prefab: 'WOD_Rocks_Small_01', type: 2, worldX: 999, worldY: -1, terrainX: 100, terrainY: 0, locationID: -2147483648 };
  const b = { name: 'Bandits', prefab: 'WOD_BanditCamp_01', type: 0, worldX: 0, worldY: 499, terrainX: 1, terrainY: 127, locationID: 2147483647 };
  const bytes = encodeRegionPack(35, [{ file: 'F_1.txt', instances: [a] }, { file: 'F_2.txt', instances: [b, a] }]);
  const d = decodeRegionPack(bytes);
  assert.equal(d.region, 35);
  assert.deepEqual(d.files, [{ file: 'F_1.txt', count: 1 }, { file: 'F_2.txt', count: 2 }]);
  const back = [0, 1, 2].map((i) => Object.fromEntries(WOD_PACK_COLUMNS.map((c) => [c, d[c][i]])));
  assert.deepEqual(back, [a, b, a]);
  assert.throws(() => encodeRegionPack(1, [{ file: 'F', instances: [{ ...a, worldX: 2 ** 31 }] }]), /Int32/);
  assert.throws(() => decodeRegionPack(new Uint8Array([...bytes, 0])), /trailing/);
});

// ── the wiring every vendored mod carries ───────────────────────────

test('WOD1: the registry row, the credit, the Features row and the online lane all name the mod as the others are named', () => {
  const reg = rd('bible/01-Overview/Mod-Registry.md');
  const row = reg.split('\n').find((l) => l.startsWith('| `world-of-daggerfall` |'));
  assert.ok(row, 'a registry row');
  const cells = row.slice(row.indexOf('|', 1) + 1).split(' | ').map((c) => c.trim());
  assert.equal(cells[1], 'Kamer');
  assert.equal(cells[2], '2.0');
  assert.doesNotMatch(row, /RECORD OPEN/, 'the permission is confirmed, not a prompt');
  assert.match(row, /`03-World\/World-Of-Daggerfall\.md`/);

  const credit = CREDITS.mods.filter((m) => m.author === 'Kamer');
  assert.deepEqual(credit.map((m) => m.title), ['Windmills of Daggerfall', 'World of Daggerfall', 'Warm Ashes - Ships'], 'the mill first (CR1 finds it by his name), then this (WA1: then his third)');
  assert.deepEqual([...credit[1].vendor], ['world-of-daggerfall']);
  assert.equal(credit[1].version, '2.0');
  assert.equal(credit[1].contact, 'DFU forums', 'the manifest\'s ContactInfo, verbatim');

  const mod = MOD_SETTINGS['world-of-daggerfall'];
  assert.equal(mod.title, 'World of Daggerfall');
  assert.equal(mod.author, 'Kamer');
  assert.deepEqual(Object.keys(mod.keys), ['Enabled'], 'no modsettings.json ships, so Enabled alone');
  const row2 = FEATURES.find((f) => f.id === 'mod-world-of-daggerfall');
  assert.equal(row2.effect, 'Takes effect when the world next loads.');
  assert.equal(row2.group, 'world');

  // The ground the room stands on: room-owned, like the roads.
  assert.deepEqual({ ...ONLINE_ROOM_MOD_KEYS['world-of-daggerfall'] }, { Enabled: true });
  assert.ok(!ONLINE_PLAYERS_OWN_MODS.includes('world-of-daggerfall'));
});
