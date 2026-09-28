// GUILD-SHELF (2026-09-27, Discord - Bagneres, "Potion seller restock instantly": "You only have to close the
// shopping window and the potions are available to purchase again. I dont know if its a bug, but you could buy
// infinite amount of potions this way"). A guild's Buy shelf is the DAY'S: minted once, bought down by the trade
// window, and restocked when the day turns - kept on the building through the scene hand-off and the save.
// AUDIT A4: kept AS LONG AS THE HALL'S SCENE IS - a map pixel left drops the town's scenes (world.js clearSceneCache),
// and the next open mints the day's shelf again; the known limit, recorded in Field-Bugs-2026-09-27e.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dayShelf, stockGuildPotions, stockSoulGems } from '../src/systems/shopStock.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import {
  createSceneCache, cacheScene, restoreCachedScene, snapshotSceneCache, restoreSceneCache,
} from '../src/systems/sceneCache.js';

const DAY = 400 * MINUTES_PER_DAY + 600;   // mid-morning of a game day
const potions = (m) => () => stockGuildPotions({ quality: 10, gameMinutes: m });

test('GUILD-SHELF: the report - a fresh mint on the same day hands the whole lot back, bought potions and all', () => {
  const a = dayShelf(null, 'BuyPotions', DAY, potions(DAY));
  assert.equal(a.items.length, 11, 'quality + 1 potions');
  a.items.splice(0, 11);   // bought out
  const b = dayShelf(null, 'BuyPotions', DAY + 5, potions(DAY + 5));
  assert.equal(b.items.length, 11, 'no kept shelf: the same day seeds the same full lot');
});

test('GUILD-SHELF: a bought potion stays bought - the reopen finds the shelf as it was left', () => {
  const store = {};
  const first = dayShelf(store, 'BuyPotions', DAY, potions(DAY));
  assert.equal(first.items.length, 11);
  const bought = first.items.splice(0, 3);   // the trade window's transfer out of the live array
  const again = dayShelf(store, 'BuyPotions', DAY + 30, potions(DAY + 30));
  assert.equal(again, first, 'the kept shelf, not a fresh mint');
  assert.equal(again.items.length, 8);
  for (const it of bought) assert.ok(!again.items.includes(it), 'nothing bought is back on it');
});

test("GUILD-SHELF: the next day restocks it, and the new day's shelf is the one kept", () => {
  const store = {};
  const first = dayShelf(store, 'BuyPotions', DAY, potions(DAY));
  first.items.length = 0;   // bought out
  const tomorrow = DAY + MINUTES_PER_DAY;
  const next = dayShelf(store, 'BuyPotions', tomorrow, potions(tomorrow));
  assert.notEqual(next, first);
  assert.equal(next.items.length, 11);
  assert.equal(store.BuyPotions, next);
  // and the day boundary is the stock's own: the last minute of today is still today
  const lastMinute = (Math.floor(DAY / MINUTES_PER_DAY) + 1) * MINUTES_PER_DAY - 1;
  const s2 = {};
  const t = dayShelf(s2, 'BuyPotions', DAY, potions(DAY));
  t.items.length = 0;
  assert.equal(dayShelf(s2, 'BuyPotions', lastMinute, potions(lastMinute)).items.length, 0);
});

test('GUILD-SHELF: each service keeps its own shelf', () => {
  const store = {};
  const p = dayShelf(store, 'BuyPotions', DAY, potions(DAY));
  const g = dayShelf(store, 'BuySoulgems', DAY, () => stockSoulGems({ quality: 10, gameMinutes: DAY }));
  assert.notEqual(p, g);
  g.items.splice(0, 1);
  assert.equal(dayShelf(store, 'BuyPotions', DAY, potions(DAY)).items.length, 11, "the gems bought are not the potions'");
  assert.equal(dayShelf(store, 'BuySoulgems', DAY, () => []).items.length, g.items.length);
});

test('GUILD-SHELF: the kept shelf rides the scene hand-off and the save; an older record carries none', () => {
  const store = {};
  const shelf = dayShelf(store, 'BuyPotions', DAY, potions(DAY));
  shelf.items.splice(0, 4);
  const cache = createSceneCache();
  cacheScene(cache, 'hall', { lootContainers: [], actionDoors: [], guildShelves: store });
  // written, loaded: the save's JSON round trip
  const loaded = restoreSceneCache(createSceneCache(), JSON.parse(JSON.stringify(snapshotSceneCache(cache))));
  const back = restoreCachedScene(loaded, 'hall');
  assert.equal(back.guildShelves.BuyPotions.day, shelf.day);
  assert.equal(back.guildShelves.BuyPotions.items.length, 7);
  assert.notEqual(back.guildShelves.BuyPotions.items, shelf.items, 'detached from the live shelf');
  // the host's next open after the walk back in finds the bought-down shelf
  assert.equal(dayShelf(back.guildShelves, 'BuyPotions', DAY + 60, potions(DAY + 60)).items.length, 7);
  // the plain hand-off (no save between) is detached too - the scene being torn down keeps nothing of it
  const direct = restoreCachedScene(cache, 'hall');
  assert.equal(direct.guildShelves.BuyPotions.items.length, 7);
  assert.notEqual(direct.guildShelves.BuyPotions.items, shelf.items, 'a copy, not the live array');
  cacheScene(cache, 'old', { lootContainers: [], actionDoors: [] });
  assert.deepEqual(restoreCachedScene(cache, 'old').guildShelves, {});
});

test('GUILD-SHELF: all three guild Buy arms mint through the day shelf, and the building keeps it', () => {
  const src = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  for (const [service, stock] of [['BuySoulgems', 'stockSoulGems'], ['BuyPotions', 'stockGuildPotions'], ['BuyMagicItems', 'stockGuildMagicItems']]) {
    assert.match(src, new RegExp(`guildShelf\\((?:'${service}'|\`${service}\\|[^\`]*\`), \\(\\) => ${stock}\\(`), `${service} goes through the day's shelf`);   // AUDIT A10: the magic shelf's key names its inputs
  }
  assert.doesNotMatch(src, /\{ items: stock(?:SoulGems|GuildPotions|GuildMagicItems)\(/, 'no arm mints a throwaway shelf');
  assert.match(src, /const guildShelf = \(service, mint\) => dayShelf\(interiorCtx \? \(interiorCtx\.guildShelves \?\?= \{\}\) : null, service, Math\.floor\(worldMinutes\(\)\), mint\);/);
  assert.match(src, /return \{ lootContainers, actionDoors, droppedPiles, droppedTorches, decor, decorItems, decorOwn, hiddenBase, frame: 'building', terrainScale: STREAMING_TERRAIN_SCALE, guildShelves \};/);
  assert.match(src, /interiorCtx\.guildShelves = data\.guildShelves \?\? \{\};/);
});

// ─── AUDIT (the batch's audit, agent A) ────────────────────────────────────────────────────────────────────────────

test('AUDIT GUILD-SHELF A10: the magic shelf is the day\'s FOR WHAT IT WAS MINTED FROM - the soul gems the rank opens, the level and the body its items are rolled for - so a member promoted at noon sees the gems that day; a past day\'s shelf goes when the day\'s is kept (mutants: the key without its inputs; the stale day kept)', () => {
  const src = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(src, /const sellsSoulGems = canAccessService\(guild, membership, 'BuySoulgems'\);\s*\n\s*const playerLevel = playerEntity\.level \?\? 1, gender = playerEntity\.gender \?\? 0;\s*\n\s*const shelf = guildShelf\(`BuyMagicItems\|\$\{sellsSoulGems \? 1 : 0\}\|\$\{playerLevel\}\|\$\{gender\}`, \(\) => stockGuildMagicItems\(\{/);
  const DAY = 40 * MINUTES_PER_DAY + 600;
  const store = {};
  let minted = 0;
  const mint = () => { minted++; return [{ id: minted }]; };
  const rank3 = dayShelf(store, 'BuyMagicItems|0|12|0', DAY, mint);
  assert.equal(dayShelf(store, 'BuyMagicItems|0|12|0', DAY + 60, mint), rank3, 'the same inputs, the same day: the same shelf');
  const rank4 = dayShelf(store, 'BuyMagicItems|1|12|0', DAY + 120, mint);
  assert.notEqual(rank4, rank3, 'promoted: the shelf the rank opens');
  assert.equal(minted, 2);
  dayShelf(store, 'BuyPotions', DAY + MINUTES_PER_DAY, mint);   // the next day's first open
  assert.deepEqual(Object.keys(store), ['BuyPotions'], 'yesterday\'s shelves are gone, and the save with them');
});
