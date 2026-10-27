// Probe: spawned dungeons past the Bay - the roll answers, the clone throws (spawnedMapId's Bay bound).
const R = '/home/user/daggerfall-js-source/src/';
const sd = await import(R + 'world/spawnedDungeons.js');
let rolled = 0, n = 0;
for (let y = -400; y < -300; y++) for (let x = 2150; x < 2250; x++) { n++; if (sd.spawnsDungeon(sd.WORLD_SALT, x, y)) rolled++; }
console.log(`Skyrim box 100x100: spawnsDungeon true on ${rolled}/${n} pixels`);
let elite = 0; for (let y = -400; y < -300; y++) for (let x = 2150; x < 2250; x++) if (sd.isEliteSpawn(sd.WORLD_SALT, x, y)) elite++;
console.log(`  isEliteSpawn true on ${elite}`);
try { console.log(sd.spawnedMapId(sd.WORLD_SALT, 2215, -371)); } catch (e) { console.log('spawnedMapId(2215,-371) throws:', e.message); }
const tmpl = { name: 'T', mapTableData: { mapId: 5 }, exterior: { exteriorData: { width: 1, height: 1 } }, dungeon: { header: {} }, hasDungeon: true };
try { sd.synthesizeDungeonLocation(tmpl, { salt: sd.WORLD_SALT, px: 2215, py: -371, where: { regionIndex: 64, regionName: 'Skyrim', politic: 0, climate: {} }, elite: false }); console.log('clone ok'); } catch (e) { console.log('synthesizeDungeonLocation past the Bay throws:', e.message); }
