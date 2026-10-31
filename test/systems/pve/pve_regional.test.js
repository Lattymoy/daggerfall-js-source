// REGIONAL-PVE (2026-10-31): past the Bay, outdoors, a zone's roster (Latty's TESA-BIOME, systems/tamrielFauna.js
// ROSTERS) decides which creatures PvE stands and how often; people, dungeons, the Bay and the sea keep PvE's own law.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEX_SPECIES, SPECIES_BY_KEY, SPECIES_BY_BODY, CANDIDATE_SPECIES } from '../../../src/systems/pve/pveSpecies.js';
import { MOB_TEMPLATES } from '../../../src/systems/pve/pveTemplates.js';
import { regionalSpecies, zoneRosterAt, speciesStandingAt, BESTIARY_BY_SPECIES, ROSTER_SHARE } from '../../../src/systems/pve/pveBestiary.js';
import { encounterPool } from '../../../src/systems/pve/pveEncounter.js';
import { ZONE_BANDS } from '../../../src/systems/pve/pveZones.js';
import { ROSTERS, isDexId } from '../../../src/systems/tamrielFauna.js';
import { tamrielBiomeAt } from '../../../src/world/tamriel/tamrielBiomes.js';
import { DEX_TABLE_TEXT } from '../../../src/systems/enemyExpansion/dexTableText.js';
import { readCsvTable, parseCsInt } from '../../../src/systems/enemyExpansion/dexCsv.js';
import { CLIMATES } from '../../../src/formats/mapsTables.js';
import { DUNGEON_TYPES } from '../../../src/formats/mapsFile.js';

const zones = new Map();
for (let x = -2000; x < 3000; x += 6) for (let y = -2000; y < 2500; y += 6) {
  const b = tamrielBiomeAt(x, y);
  if (b && !zones.has(b.key)) zones.set(b.key, { x, y, b });
}
const templated = new Set(MOB_TEMPLATES.map((t) => t.species));

test('the Enemy Expansion species are the mod\'s own rows', () => {
  const t = readCsvTable(DEX_TABLE_TEXT['MonsterBase.mdb.csv']);
  const rows = new Map(t.rows.map((r) => [parseCsInt(r.tokens[t.column('ID')]), r.tokens]));
  const group = { Humanoid: 'humanoid', Animals: 'animal', Undead: 'undead', Daedra: 'daedra' };
  for (const s of DEX_SPECIES) {
    const r = rows.get(s.body);
    assert.ok(r, s.name);
    assert.equal(r[t.column('Name')], s.name);
    assert.equal(group[r[t.column('Group')]] ?? 'none', s.group, s.name);
    assert.equal(r[t.column('Behaviour')] === 'Flying', s.flying, s.name);
  }
  for (const c of CANDIDATE_SPECIES) assert.ok(!SPECIES_BY_KEY.has(c.key), c.key);
});

test('every monster a roster names has a species and a template, Enemy Expansion\'s too', () => {
  for (const [zone, r] of Object.entries(ROSTERS)) for (const [id] of [...r.day, ...r.night]) {
    const sp = SPECIES_BY_BODY.get(id);
    if (id >= 128 && id < 256) continue;   // people keep PvE's own law
    if (id >= 384) continue;               // the mod's people: none in PvE yet
    assert.ok(sp, `${zone}: ${id}`);
    if (sp.aquatic) continue;
    assert.ok(templated.has(sp.key), `${zone}: ${sp.key} has no template`);
  }
});

test('a zone stands its own roster: day and night differ, the mod\'s bodies or their stand-ins', () => {
  assert.ok(zones.size >= 30, String(zones.size));
  const { x, y } = zones.get('skyrimTundra');
  const day = new Map(zoneRosterAt(x, y, false, true).entries), night = new Map(zoneRosterAt(x, y, true, true).entries);
  assert.equal(day.get('troll'), 'R');
  assert.equal(day.get('wolf'), 'C');
  assert.ok(night.has('ghost') && !day.has('ghost'));
  const classic = new Map(zoneRosterAt(x, y, false, false).entries);
  assert.ok(!classic.has('troll') && !classic.has('wolf'), 'without the mod its creatures stand in or are left out');
  assert.ok([...classic.keys()].every((k) => !isDexId(SPECIES_BY_KEY.get(k).body)));
  // the share is the rarity's
  const at = { px: x, py: y, province: 'Skyrim', met: [], factions: ['bandits'] };
  for (const s of regionalSpecies(at)) if (SPECIES_BY_KEY.get(s.species).kind === 'monster' && !s.species.startsWith('orc')) assert.equal(s.weight, ROSTER_SHARE[classic.get(s.species)], s.species);
  // nothing the roster leaves out stands: no orcs, centaurs or wereboars in Skyrim's tundra
  const held = new Set(regionalSpecies(at).map((s) => s.species));
  for (const k of ['centaur', 'wereboar', 'giant-scorpion']) assert.ok(!held.has(k), k);
  // people keep PvE's law: the outlaws are still there
  assert.ok(held.has('warrior') && held.has('knight'));
});

test('the Bay, the sea, a pixel-less place and a dungeon keep PvE\'s own list', () => {
  assert.equal(zoneRosterAt(500, 250, false), null);   // the Bay
  assert.equal(zoneRosterAt(undefined, undefined, false), null);
  const { x, y } = zones.get('skyrimTundra');
  const dun = { px: x, py: y, province: 'Skyrim', dungeon: DUNGEON_TYPES.Crypt, met: [], factions: [] };
  assert.deepEqual(regionalSpecies(dun), regionalSpecies({ ...dun, px: undefined, py: undefined }));
});

test('a water body never stands on land, only at sea', () => {
  const r = BESTIARY_BY_SPECIES.get('slaughterfish');
  assert.equal(speciesStandingAt(r, { province: 'BlackMarsh', climate: CLIMATES.Swamp }), 'unavailable');
  assert.notEqual(speciesStandingAt(r, { province: 'BlackMarsh', climate: CLIMATES.Ocean }), 'unavailable');
  for (const { x, y } of zones.values()) for (const night of [false, true])
    assert.ok(zoneRosterAt(x, y, night, true).entries.every(([k]) => !SPECIES_BY_KEY.get(k).aquatic));
});

test('no zone is left with nothing to meet in any band, day or night', () => {
  for (const [k, { x, y, b }] of zones) for (const met of [[], ['night']]) for (const band of ZONE_BANDS) {
    const p = encounterPool(band, { px: x, py: y, province: b.province, region: 70, climate: null, dungeon: null, met, factions: ['bandits'] });
    assert.ok(p.pool.length > 0, `${k} ${band} ${met}`);
  }
});

test('an Enemy Expansion creature drops as a template creature: its level the tier, a creature\'s gear share, its rank\'s pieces', async () => {
  const { templateGearKinds, templateDropSource } = await import('../../../src/systems/pve/pveDrops.js');
  const troll = { pveTemplate: 'troll-elder', pveCategory: 'strong', mobileType: SPECIES_BY_KEY.get('troll').body, level: 37 };
  assert.equal(templateDropSource(troll, { tier: 1 }).tier, 37);
  let gear = 0, n = 2000, i = 0;
  const seq = () => ((i = (i * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let k = 0; k < n; k++) if (templateGearKinds({ ...troll, pveCategory: 'normal' }, seq).some((x) => x === 'weapon' || x === 'armor')) gear++;
  assert.ok(gear / n > 0.2 && gear / n < 0.4, String(gear / n));   // DROP_CREATURE_GEAR 0.3: read as a creature, not a person
  assert.ok(!templateGearKinds({ ...troll, pveCategory: 'normal' }, () => 0).includes('cloth'), 'a creature wears no clothing');
  assert.ok(templateGearKinds(troll, seq).length >= 1, 'a strong one carries its rank\'s piece');
});
