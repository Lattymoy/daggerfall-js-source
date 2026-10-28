// IC-PROPS (2026-10-27, the owner: "Old daggerfall city layout placements are in imperial city"; bible/03-World/
// Arena-Provinces.md IC-PROPS) - THE GRAND CITY THE ONLY LAYOUT THE IMPERIAL CITY PLACES FROM. 671 cells of its plan were
// Daggerfall's own city blocks (a town's square of houses, garden walls, hedges and props, each district's trade along its
// avenue and round its heart) among the city's own; none is now but the arena's, and what they carried that the grand
// city means to keep is its fabric's: each district's signature trade among its buildings (the Temple District's temples
// of the Eight, the Waterfront's Thieves Guild, Talos Plaza's and the Market's banks and stores), and the Arcane
// University's halls a neighbourhood of their own inside its curtain, clear of its tower, its hall and its two walks.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  IMPERIAL, IMPERIAL_SPAN, IMPERIAL_ARENA_CODE, imperialSlicePlan, imperialClassic, imperialCodeCell, imperialCellRect, imperialDistrictAt,
  imperialArenaCell, universityGatesAt, universityTowerAt, universityHallAt, polar,
} from '../../src/world/imperialCity.js';
import * as City from '../../src/world/imperialCity.js';
import { hoodAt, fabricKeptClear, fabricPlotAt, universityGrounds, CLEAR, IMPERIAL_STYLES } from '../../src/world/imperialFabric.js';
import { fabricCellBuildings, FABRIC_DONORS, DISTRICT_TRADE, fabricDonorOf } from '../../src/world/imperialFabricBuildings.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { GUILD_FACTION_IDS } from '../../src/systems/guild/guildFactions.js';
import { hostText } from '../hostText.mjs';

const N = IMPERIAL_SPAN;
/** Every own cell of a district (by its middle), in the plan's order. */
function districtCells(d) {
  const out = [];
  for (let s = 0; s < N * N; s++) {
    const plan = imperialSlicePlan(s), sx = s % N, sy = Math.floor(s / N);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      if (!imperialCodeCell(plan[i][j])) continue;
      const r = sy * 8 + i, c = sx * 8 + j, [x0, z0, x1, z1] = imperialCellRect(r, c);
      if (imperialDistrictAt((x0 + x1) / 2, (z0 + z1) / 2) === d) out.push([r, c]);
    }
  }
  return out;
}
const middle = (q) => q.reduce((m, v) => [m[0] + v[0] / 4, m[1] + v[1] / 4], [0, 0]);

test('IC-PROPS NO BLOCK OF DAGGERFALL\'S IN THE IMPERIAL CITY BUT ITS ARENA - every cell of the plan the lake, the open shore past it, the arena\'s, or the city\'s own (its ground, walls, streets and buildings the grand plan\'s); the trade tables of Daggerfall\'s blocks gone with them (mutant: a district\'s trade cell back in the plan)', () => {
  const kinds = { L: 0, O: 0, arena: 0, own: 0, classic: 0 };
  for (let s = 0; s < N * N; s++) {
    for (const cell of imperialSlicePlan(s).flat()) {
      if (cell === 'L' || cell === 'O') kinds[cell]++;
      else if (cell === IMPERIAL_ARENA_CODE) kinds.arena++;
      else if (imperialCodeCell(cell)) kinds.own++;
      if (imperialClassic(cell)) kinds.classic++;
    }
  }
  assert.equal(kinds.classic, 0, JSON.stringify(kinds));
  assert.equal(kinds.arena, 1);
  assert.equal(kinds.L + kinds.O + kinds.arena + kinds.own, (N * 8) ** 2);
  const [ar, ac] = imperialArenaCell();
  assert.equal(imperialSlicePlan(Math.floor(ar / 8) * N + Math.floor(ac / 8))[ar % 8][ac % 8], IMPERIAL_ARENA_CODE, 'Daggerfall\'s arena, the plan\'s one');
  assert.equal('IMPERIAL_MIX' in City, false);
  assert.equal('IMPERIAL_SIGNATURE' in City, false);
  assert.doesNotMatch(hostText('src/world/imperialFabric.js'), /imperialClassic/, 'the fabric keeps no street round a block of Daggerfall\'s');
});

test('IC-PROPS EACH DISTRICT\'S SIGNATURE IN ITS FABRIC - the temples of the Eight (each block\'s temple, its record\'s god; one main front in so many of the Temple District\'s, each god alike whatever the plot\'s size), the Thieves Guild\'s houses on the Waterfront (a House2 of the guild\'s faction), the University\'s Mages Guild halls; the Market\'s bank and Talos Plaza\'s general stores among their shops (mutants: the halls unread; a temple by its size)', () => {
  const temples = FABRIC_DONORS.filter((d) => d.pool === 'temple'), thieves = FABRIC_DONORS.filter((d) => d.pool === 'thieves');
  assert.deepEqual(temples.map((d) => d.faction).sort((a, b) => a - b), [21, 22, 24, 27, 29, 33, 35, 92], 'the Eight, one temple each');
  assert.ok(temples.every((d) => d.type === BUILDING_TYPES.Temple));
  assert.ok(thieves.length >= 2 && thieves.every((d) => d.type === BUILDING_TYPES.House2 && d.faction === GUILD_FACTION_IDS.ThievesGuild));
  for (const area of [60, 150, 400]) {
    const gods = new Set(Array.from({ length: 160 }, (_, k) => FABRIC_DONORS[fabricDonorOf('temple', 1000 + k, area)].faction));
    assert.equal(gods.size, 8, `every god a ${area} m2 plot\'s`);
  }
  assert.deepEqual(DISTRICT_TRADE['Temple District'].halls.map(([p]) => p), ['temple']);
  assert.deepEqual(DISTRICT_TRADE['Waterfront District'].halls.map(([p]) => p), ['thieves']);
  assert.deepEqual(DISTRICT_TRADE['Arcane University'].halls.map(([p]) => p), ['mages']);
  assert.ok(DISTRICT_TRADE['Market District'].shops.includes('bank') && DISTRICT_TRADE['Talos Plaza District'].shops.includes('general'));
  // the district's own buildings stand them: the first temples of the Temple District, the first Thieves Guild house of
  // the Waterfront, in the plan's order
  const find = (d, pool, want) => {
    const out = [];
    for (const [r, c] of districtCells(d)) {
      for (const b of fabricCellBuildings(r, c)) if (b.pool === pool && imperialDistrictAt(...middle(b.plot.q)) === d) out.push(b);
      if (out.length >= want) break;
    }
    return out;
  };
  const t = find('Temple District', 'temple', 3);
  assert.equal(t.length, 3, 'temples in the Temple District');
  for (const b of t) assert.ok(b.type === BUILDING_TYPES.Temple && temples.some((d) => d.faction === b.factionId) && b.door.street === 'main', 'a god\'s temple on a main street');
  const h = find('Waterfront District', 'thieves', 1);
  assert.equal(h.length, 1, 'the Thieves Guild on the Waterfront');
  assert.equal(h[0].factionId, GUILD_FACTION_IDS.ThievesGuild);
  assert.equal(h[0].type, BUILDING_TYPES.House2);
});

test('IC-PROPS THE ARCANE UNIVERSITY\'S HALLS - a neighbourhood of its own inside its curtain, its frame square to its walls; its buildings entered, its Mages Guild\'s halls among them; none past its curtain\'s inner face, on its Arch-Mage\'s tower or its hall or their doors\' forecourts, or on its two walks - each from a gate straight across the compound, open all the way (mutants: the University\'s grounds kept clear; the walks unread)', () => {
  const U = IMPERIAL.university, [cx, cz] = polar(U.b, U.r), G = universityGrounds();
  assert.ok(IMPERIAL_STYLES['Arcane University'], 'its own style');
  const h = hoodAt(cx, cz);
  assert.equal(h?.district, 'Arcane University');
  assert.equal(h.turn, 0);
  assert.deepEqual(G.centre, [cx, cz]);
  let built = 0, halls = 0;
  const [tx, tz] = universityTowerAt(), [hx, hz] = universityHallAt();
  for (const [r, c] of districtCells('Arcane University')) {
    for (const b of fabricCellBuildings(r, c)) {
      if (imperialDistrictAt(...middle(b.plot.q)) !== 'Arcane University') continue;
      built++;
      if (b.type === BUILDING_TYPES.GuildHall) { halls++; assert.equal(b.factionId, GUILD_FACTION_IDS.MagesGuild); }
      for (const [x, z] of b.plot.q) {
        assert.ok(Math.abs(x - cx) < G.inner + 0.01 && Math.abs(z - cz) < G.inner + 0.01, 'inside the curtain');
        assert.ok(Math.hypot(x - tx, z - tz) >= U.spireR + CLEAR.uniTower - 0.01, 'off the tower');
        assert.ok(!(Math.abs(x - hx) < U.hall / 2 + CLEAR.uniHall - 0.01 && Math.abs(z - hz) < U.hall / 2 + CLEAR.uniHall - 0.01), 'off the hall');
      }
    }
  }
  assert.ok(built >= 300, `${built} buildings`);
  assert.ok(halls >= 15, `${halls} Mages Guild halls`);
  // the walks: from each gate in across the compound, no building and kept clear all the way
  const gates = universityGatesAt();
  assert.equal(gates.length, 2);
  for (const [gx, gz] of gates) {
    const northSouth = Math.abs(gz - (cz - U.half)) < 4;
    for (let t = -G.inner + 2; t < G.inner - 2; t += 3) {
      for (const off of [-CLEAR.uniWalk + 0.5, 0, CLEAR.uniWalk - 0.5]) {
        const [x, z] = northSouth ? [gx + off, cz + t] : [cx + t, gz + off];
        assert.equal(fabricPlotAt(x, z), null, `no building on the walk at ${x.toFixed(0)},${z.toFixed(0)}`);
        assert.ok(fabricKeptClear(x, z), 'the walk kept clear');
      }
    }
  }
  // out past the curtain, the isle's: kept clear
  assert.ok(fabricKeptClear(cx + U.half + 10, cz) && fabricKeptClear(cx, cz + U.half - 10));
});
