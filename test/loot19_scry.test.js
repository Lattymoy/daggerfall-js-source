// LOOT19 - SCRYING (2026-10-07; bible/06-Systems/Loot-II-Arc.md section 11; Mac: "what could we do to make it even more
// amazing, while also balancing everyrhing?", then "Lets go all in").
//
// The codex says where an unfound Legendary is said to be - among a family of foes, whose dungeon kinds weigh its
// records at their piles (LOOT6). At the Reforge the guild's scryers turn the hint into a place: name a family and, for 3
// Welkynd Shards and 500 gold, they reveal the NEAREST dungeon of its kinds in the region that is not yet on the map -
// DFU's own discovery, the travel map's own dots - and name it. Nothing hidden of that family there: said, and nothing
// paid. It changes no odds; it is information.
//
// Pinned by execution: the families and their kinds; the region's rows; the nearest hidden haunt (the baked flag and the
// player's store both hide one, a tie to the lower id); every refusal, asked before a coin is taken; the scrying paid
// and the place on the map, the next nearest after it; the window's page (a row a family, its press or why not, the
// press and its word) and the codex's way to it; the hosts' hooks.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import { SCRY_PRICE, SCRY_FAMILIES, SCRY_FAMILY_WORDS, familyKinds, familyPlaces, scryRows, nearestHidden, scryRefusal, scryPlace } from '../src/systems/lootScry.js';
import { restoreDiscovery, hasDiscoveredLocationId, discoverLocation } from '../src/systems/discovery.js';
import { DUNGEON_TYPES, longitudeLatitudeToMapPixel } from '../src/formats/mapsFile.js';
import { welkyndShards } from '../src/systems/gateSpoils.js';
import { shardsHeld } from '../src/systems/reforge.js';
import { _resetCodexForTests } from '../src/systems/lootCodex.js';
import { mountReforgeWindow, SCRIED, SCRY_FOR_KIN, REFORGE_REFUSALS } from '../src/ui/reforgeWindow.js';
import { withDom } from './invdrag.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); restoreDiscovery(null); _resetCodexForTests(); };
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
const D = DUNGEON_TYPES;
/** A region as maps.getRegion hands one: its names and its map table (longitude/latitude in the table's own units). */
const at = (x, y) => ({ longitude: x * 128 + 64, latitude: (499 - y) * 128 + 64 });
const REGION = {
  name: 'Daggerfall',
  mapNames: ['Daggerfall', 'Fallen Crypt', 'Old Cemetery', 'Far Haunt', 'Orc Hold', 'Known Crypt', 'Twin A', 'Twin B'],
  mapTable: [
    { mapId: 100, ...at(200, 200), discovered: true, dungeonType: 255 },
    { mapId: 101, ...at(205, 200), discovered: false, dungeonType: D.Crypt },
    { mapId: 102, ...at(203, 204), discovered: false, dungeonType: D.Cemetery },
    { mapId: 103, ...at(260, 260), discovered: false, dungeonType: D.VampireHaunt },
    { mapId: 104, ...at(201, 201), discovered: false, dungeonType: D.OrcStronghold },
    { mapId: 105, ...at(200, 201), discovered: true, dungeonType: D.Crypt },
    { mapId: 207, ...at(300, 300), discovered: false, dungeonType: D.Coven },
    { mapId: 206, ...at(300, 300), discovered: false, dungeonType: D.Laboratory },
  ],
};
const where = () => ({ rows: scryRows(REGION), at: { x: 200, y: 200 } });
const rich = () => ({ items: [welkyndShards(10)], goldPieces: 5000 });

test('LOOT19: the families a scrying names, each with its dungeon kinds and their words; the region\'s rows as the law reads them', () => {
  on();
  assert.deepEqual(SCRY_PRICE, { shards: 3, gold: 500 });
  assert.deepEqual(familyKinds('undead'), [D.Crypt, D.VampireHaunt, D.RuinedCastle, D.Cemetery]);
  assert.deepEqual(familyKinds('dragon'), [D.DragonsDen]);
  assert.deepEqual(familyKinds('caster'), [D.Coven, D.Laboratory]);
  assert.deepEqual([...SCRY_FAMILIES].sort(), [...LR.FAMILY_IDS].sort(), 'every family has a kind of its own');
  for (const f of SCRY_FAMILIES) assert.ok(SCRY_FAMILY_WORDS[f], `${f}: its words`);
  assert.equal(familyPlaces('undead'), 'crypts, vampire haunts, ruined castles and cemeteries');
  assert.equal(familyPlaces('dragon'), 'dragon\'s dens');
  assert.ok(!familyKinds('undead').includes(D.Mine) && !SCRY_FAMILIES.some((f) => familyKinds(f).includes(D.Mine)), 'a mine is no family\'s');
  const rows = scryRows(REGION);
  assert.equal(rows.length, REGION.mapTable.length);
  assert.deepEqual(rows[1], { mapId: 101, discovered: false, dungeonType: D.Crypt, name: 'Fallen Crypt', regionName: 'Daggerfall', ...longitudeLatitudeToMapPixel(REGION.mapTable[1].longitude, REGION.mapTable[1].latitude) });
  assert.deepEqual([rows[1].x, rows[1].y], [205, 200], 'its map pixel');
  assert.deepEqual(scryRows(null), []);
});

test('LOOT19: the nearest hidden haunt - of the family\'s kinds, on no map (the baked flag and the player\'s store both), the nearest by the map, a tie to the lower id', () => {
  on();
  const w = where();
  assert.equal(nearestHidden(w.rows, 'undead', w.at).name, 'Fallen Crypt', 'five away, the cemetery five and a fraction, the known crypt never');
  discoverLocation(101, { regionName: 'Daggerfall', locationName: 'Fallen Crypt' });
  assert.equal(nearestHidden(w.rows, 'undead', w.at).name, 'Old Cemetery', 'the player\'s store hides one too');
  assert.equal(nearestHidden(w.rows, 'brute', w.at).name, 'Orc Hold');
  assert.equal(nearestHidden(w.rows, 'caster', w.at).mapId, 206, 'two at one spot: the lower id');
  assert.equal(nearestHidden(w.rows, 'dragon', w.at), null, 'none of theirs');
  assert.equal(nearestHidden(null, 'undead', w.at), null);
});

test('LOOT19: the scrying - every refusal asked before a coin is taken; paid, the place on the map and named; the next nearest after it; off, nothing', () => {
  on();
  const me = rich();
  assert.equal(scryRefusal(me, 'dragon', where()), 'none', 'nothing hidden: said, nothing asked');
  assert.equal(scryRefusal(me, 'giants', where()), 'family');
  assert.equal(scryRefusal(me, 'undead', null), 'nowhere');
  assert.equal(scryRefusal(me, 'undead', { rows: [], at: { x: 0, y: 0 } }), 'nowhere');
  assert.equal(scryRefusal({ items: [welkyndShards(2)], goldPieces: 5000 }, 'undead', where()), 'shards');
  assert.equal(scryRefusal({ items: [welkyndShards(3)], goldPieces: 499 }, 'undead', where()), 'gold');
  assert.equal(scryRefusal(me, 'undead', where()), null);
  const poor = { items: [welkyndShards(2)], goldPieces: 5000 };
  assert.deepEqual(scryPlace(poor, 'undead', where()), { ok: false, reason: 'shards' });
  assert.deepEqual([shardsHeld(poor.items), poor.goldPieces, hasDiscoveredLocationId(101)], [2, 5000, false], 'nothing taken, nothing found');
  const done = scryPlace(me, 'undead', where());
  assert.equal(done.ok, true);
  assert.equal(done.place.name, 'Fallen Crypt');
  assert.deepEqual([shardsHeld(me.items), me.goldPieces], [7, 4500], 'paid: the shards, then the gold');
  assert.equal(hasDiscoveredLocationId(101), true, 'on the map - DFU\'s own store');
  assert.equal(scryPlace(me, 'undead', where()).place.name, 'Old Cemetery', 'the next nearest');
  assert.equal(scryPlace(me, 'undead', where()).place.name, 'Far Haunt');
  assert.deepEqual(scryPlace(me, 'undead', where()), { ok: false, reason: 'none' }, 'and then none - asked first');
  assert.deepEqual([shardsHeld(me.items), me.goldPieces], [1, 3500]);
  setPref('lootRarity', false);
  assert.equal(scryRefusal(rich(), 'brute', where()), 'off');
  _resetForTests();
});

test('LOOT19: the scryers\' page - a row a family, its press or why not, a press that names the place; the codex\'s unfound record leads to its kin; the hosts hand the region', () => {
  on();
  withDom((dom) => {
    const me = rich();
    const calls = [];
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, {
      page: 'scry', items: () => me.items, payer: () => me, gold: () => me.goldPieces, picture: () => null, nameOf: (it) => it.name,
      reforge: () => ({ ok: false }), salvage: () => ({ ok: false }),
      scry: (f) => { calls.push(f); return scryPlace(me, f, where()); }, scryWhere: where,
    });
    try {
      const shell = one(host, 'reforge-shell');
      const rows = () => kids(shell, 'scry-row');
      assert.deepEqual(rows().map((r) => r.dataset.family), [...SCRY_FAMILIES]);
      const rowOf = (f) => rows().find((r) => r.dataset.family === f);
      const dragon = one(rowOf('dragon'), 'scry-press');
      assert.equal(dragon.textContent, 'None hidden');
      assert.equal(dragon.attrs.disabled, '');
      assert.equal(dragon.attrs.title, REFORGE_REFUSALS.none);
      const undead = one(rowOf('undead'), 'scry-press');
      assert.equal(undead.textContent, 'Scry');
      assert.ok(textOf(rowOf('undead')).includes('Crypts, vampire haunts, ruined castles and cemeteries'));
      undead.onclick({ stopPropagation() {} });
      assert.deepEqual(calls, ['undead']);
      assert.equal(one(shell, 'broker-note').textContent, SCRIED('Fallen Crypt', 'undead'));
      assert.ok(rowOf('undead').classList.contains('on'));
      // the codex: an unfound record's kin, to this page
      kids(shell, 'reforge-tab').find((t) => t.dataset.page === 'codex').onclick({ stopPropagation() {} });
      const other = LR.allLegendaries().find((r) => LR.foundAmong(r.id) && LR.foundAmong(r.id) !== 'undead');   // a kin the page has not lit
      const rec = kids(shell, 'codex-row').find((r) => r.dataset.record === other.id);
      rec.onclick();
      const go = one(shell, 'scry-kin');
      assert.equal(go.textContent, SCRY_FOR_KIN);
      go.onclick({ stopPropagation() {} });
      assert.ok(kids(shell, 'reforge-tab').find((t) => t.dataset.page === 'scry').classList.contains('on'), 'the scryers\' page');
      assert.ok(rowOf(LR.foundAmong(other.id)).classList.contains('on'), 'its kin\'s row lit');
      assert.ok(!rowOf('undead').classList.contains('on'), 'and only it');
    } finally { view.unmount(); }
  });
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, { pages: ['codex'], items: () => [], payer: () => ({ items: [] }), gold: () => 0, reforge: () => ({ ok: false }), salvage: () => ({ ok: false }), nameOf: (it) => it.name, picture: () => null });
    try {
      const shell = one(host, 'reforge-shell');
      kids(shell, 'codex-row').find((r) => r.dataset.record === 'graveward').onclick();
      assert.equal(one(shell, 'scry-kin'), null, 'the pack\'s Codex has no scryers');
    } finally { view.unmount(); }
  });
  assert.match(read('src/scenes/worldModes.js'), /scry: \(family\) => \{ const done = scryPlace\(playerEntity, family, host\.scryWhere\?\.\(\) \?\? null\);/, 'the guild\'s window scries on the player\'s purse');
  assert.match(read('src/scenes/world.js'), /const region = maps\.getRegion\(maps\.getRegionIndexAt\(at\.x, at\.y\)\);\n\s+return region \? \{ rows: scryRows\(region\), at: \{ x: at\.x, y: at\.y \} \} : null;/, 'the world host\'s region');
  assert.match(read('src/scenes/world.js'), /\n\s+scryWhere,   \/\/ LOOT19/, 'handed to the interior host');
  _resetForTests();
});
