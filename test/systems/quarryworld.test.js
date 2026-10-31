// QUARRY-WORLD (2026-10-27, bible/06-Systems/Bounty-Boards.md section 13; the audit NO SYSTEM LEFT BEHIND IN THE BAY item 37 - "a
// note; Bay-wide too"): a bounty board's beasts were one global ladder by level (systems/bounty/bountyBoard.js BOUNTY_TIERS), so
// a Black Marsh board posted Orc Warlords and Centaurs and an Alik'r board Grizzly Bears. Now a tier hunts the land's own wild
// about the board's town - the encounter law's day and night tables there (DFU's climates on the Bay, TESA-BIOME's zones past
// it) - in its own band of levels. The owner: "Every single thing here needs to be addressed. No exceptions." (2026-10-26).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  bountyQuarry, bountyNames, bountyFoesWord, bountyPosting, boardPostings, postingFromId, bountyGold, bountySites, BOUNTY_TIERS, bountyTierFor, BOUNTY_STORIES,
} from '../../src/systems/bounty/bountyBoard.js';
import { landWildOf, bountyLandWild } from '../../src/systems/bounty/bountyQuarry.js';
import { CLIMATE_TABLE } from '../../src/systems/encounters.js';
import { encounterTableChoices, _resetEncounterTableSelectors, registerEncounterTableSelector } from '../../src/characters/encounterTableDoor.js';
import { VANILLA_ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { BIOMES } from '../../src/world/tamriel/tamrielBiomes.js';
import { BIOME_BANDS, installTamrielFauna, biomeTable } from '../../src/systems/tamrielFauna.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';
import { createBountyHost } from '../../src/scenes/bountyHost.js';
import { hostText } from '../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const CURSED = [9, 14, 28, 30];   // Werewolf, Wereboar, Vampire, Vampire Ancient
const TOWN = { px: 300, py: 200, name: 'Daggerfall' };
const sites = bountySites(TOWN.px, TOWN.py, () => true);

test('QUARRY-WORLD the law (bountyBoard.js bountyQuarry): a tier hunts the land\'s beasts in its own band of levels - its ladder\'s - weakest first; where none lies in it, the land\'s nearest it; the board names every one, never a curse-bearer; with no wild known the ladder, to the posting (mutants: the band, the nearest, the order, the words\' gate, the fallback)', () => {
  // each tier's band is its own beasts' levels, as Daggerfall has them
  for (const t of BOUNTY_TIERS) {
    const lv = t.foes.map((id) => VANILLA_ENEMY_BASICS[id].level);
    assert.deepEqual(t.levels, [Math.min(...lv), t === BOUNTY_TIERS[BOUNTY_TIERS.length - 1] ? Infinity : Math.max(...lv)], `tier ${t.min}`);
  }
  // no wild: the ladder - and the board's postings exactly as they were
  for (const level of [1, 4, 8, 12, 20]) assert.equal(bountyQuarry(level, null), bountyTierFor(level).foes);
  assert.deepEqual(boardPostings({ day: 900, ...TOWN, level: 8, sites }), boardPostings({ day: 900, ...TOWN, level: 8, sites, wild: [] }), 'an empty wild is the ladder');
  // a swamp's own: rats 1, spiders 4, zombies 5, a mudcrab's 2, skeletons 9, ghosts 11, wraiths 15, a vampire 19, a lich 20
  const wild = [[0, 1], [6, 4], [17, 5], [281, 2], [15, 9], [18, 11], [23, 15], [28, 19], [32, 20], [9, 6], [999, 3]];
  assert.deepEqual(bountyQuarry(2, wild), [0, 281, 6], 'tier 1 (levels 1-4): the rat, the mudcrab, the spider - weakest first');
  assert.deepEqual(bountyQuarry(4, wild), [6, 17], 'tier 2 (4-5)');
  assert.deepEqual(bountyQuarry(8, wild), [17, 15], 'tier 3 (5-10): never the werewolf - a bounty is no way to catch a curse');
  assert.deepEqual(bountyQuarry(12, wild), [18], 'tier 4 (10-13)');
  assert.deepEqual(bountyQuarry(20, wild), [23, 32], 'tier 5 (14 up): the wraith and the lich, never the vampire');
  assert.deepEqual(bountyQuarry(12, [[0, 1], [6, 4], [17, 5]]), [17], 'nothing in the band: the land\'s nearest it');
  assert.deepEqual(bountyQuarry(12, [[0, 1], [3, 1]]), [0, 3], 'ties all taken, by id');
  assert.equal(bountyQuarry(12, [[9, 6], [999, 3]]), bountyTierFor(12).foes, 'nothing the board can name: the ladder');
  for (const id of CURSED) assert.equal(bountyNames(id), false, `no words for ${id}`);
  // the posting draws from it, and the 15+ purse reads the beast's rank in it
  const p = bountyPosting({ day: 900, ...TOWN, slot: 0, level: 20, sites, wild });
  assert.ok([23, 32].includes(p.mobileType));
  assert.equal(p.gold, bountyGold(20, p.count, p.mobileType, false, [23, 32]));
  assert.equal(p.foes, bountyFoesWord(p.mobileType));
  assert.match(p.story, new RegExp(bountyFoesWord(p.mobileType)));
  assert.equal(bountyGold(20, 8, 32, false, [23, 32]), 200, 'the strongest of the land\'s, the top of the purse');
  assert.equal(bountyGold(20, 4, 23, false, [23, 32]), 150);
  // the id alone rebuilds it, with the same wild: every machine of the party reads the same pack
  assert.deepEqual(postingFromId(p.id, { name: TOWN.name, sites, wild }), p);
  // its story is its beast's kind's: a land of mudcrabs tells of vermin, of liches of the dead
  const vermin = bountyPosting({ day: 900, ...TOWN, slot: 0, level: 2, sites, wild: [[281, 2]] });
  assert.ok(BOUNTY_STORIES.vermin.some((st) => vermin.story.startsWith(st.split('{')[0])), vermin.story);
  const dead = bountyPosting({ day: 900, ...TOWN, slot: 1, level: 20, sites, wild: [[32, 20]] });
  assert.ok(BOUNTY_STORIES.undead.some((st) => dead.story.startsWith(st.split('{')[0])), dead.story);
});

test('QUARRY-WORLD the words (bountyBoard.js): the board names every monster the land\'s wild may hold - the Bay\'s climates and every zone past it, with Daggerfall Enemy Expansion\'s tables and without - but the curse-bearers; through the text core, the ladder\'s English unchanged (mutants: a word unrouted)', () => {
  installTamrielFauna();
  try {
    const monsters = new Set();
    const tables = [];
    for (const [, band] of CLIMATE_TABLE) for (const k of [1, 2]) tables.push(...encounterTableChoices(band[k]));
    for (const b of BIOMES) { const band = BIOME_BANDS.get(b.key); for (const k of [1, 2]) for (const dex of [false, true]) tables.push(biomeTable(band[k], dex, false)); }
    for (const t of tables) for (const id of t) if (id < 128 || (id >= 256 && id < 384)) monsters.add(id);
    const unnamed = [...monsters].filter((id) => !bountyNames(id) && !CURSED.includes(id) && VANILLA_ENEMY_BASICS[id]?.behaviour !== 'Aquatic').sort((a, b) => a - b);
    assert.deepEqual(unnamed, [], 'a word for each');
  } finally { _resetEncounterTableSelectors(); }
  assert.deepEqual([0, 3, 6, 4, 5, 7, 8, 12, 13, 19, 15, 17, 16, 20, 21, 22, 23, 24, 27].map(bountyFoesWord), ['Rats', 'Giant Bats', 'Spiders', 'Grizzly Bears', 'Sabretooth Tigers', 'Orcs',
    'Centaurs', 'Orc Sergeants', 'Harpies', 'Mummies', 'Skeletal Warriors', 'Zombies', 'Giants', 'Giant Scorpions', 'Orc Shamans', 'Gargoyles', 'Wraiths', 'Orc Warlords', 'Daedroths'], 'the ladder\'s words as they were');
  assert.equal(bountyFoesWord(283), 'Will-o\'-wisps');
  const src = rd('src/systems/bounty/bountyBoard.js');
  const table = src.slice(src.indexOf('const FOES = Object.freeze({'), src.indexOf('});', src.indexOf('const FOES = Object.freeze({')));
  const rows = table.split('\n').filter((l) => /^\s+\d+: \[/.test(l));
  assert.ok(rows.length >= 56 && rows.every((l) => /\(\) => t\('bounty\.foes\.\w+', '[^']*(?:\\'[^']*)*'\)\],/.test(l)), 'every word a text-core call');
  const en = readFileSync(new URL('../../locales/en/Port_Strings.csv', import.meta.url), 'utf8');
  assert.match(en, /^bounty\.foes\.mudcrabs,"Mudcrabs"$/m, 'in the catalog');
  for (const lang of ['bg', 'cs', 'da', 'de', 'es', 'fr', 'id', 'it', 'ko', 'nb', 'pt-BR', 'ro', 'ru']) {
    const csv = readFileSync(new URL(`../../locales/${lang}/Port_Strings.csv`, import.meta.url), 'utf8');
    assert.equal((csv.match(/^bounty\.foes\./gm) ?? []).length, 56, `${lang}: every word`);
  }
});

test('QUARRY-WORLD the land\'s wild (systems/bounty/bountyQuarry.js landWildOf): the encounter law\'s day and night tables of a pixel\'s band - DFU\'s climate tables on the Bay, a zone\'s past it - their monsters at their levels; none at sea (mutants: the night unread, the zone unread, a person kept)', () => {
  const level = (id) => VANILLA_ENEMY_BASICS[id]?.level ?? null;
  const desert = landWildOf(CLIMATES.Desert, null, level);
  const [, day, night] = CLIMATE_TABLE.get(CLIMATES.Desert);
  const want = [...new Set([...encounterTableChoices(day)[0], ...encounterTableChoices(night)[0]])].filter((id) => id < 128).sort((a, b) => a - b);
  assert.deepEqual(desert.map(([id]) => id), want, 'the Alik\'r\'s own: DFU\'s desert tables by day and by night');
  assert.ok(desert.every(([id, lv]) => lv === VANILLA_ENEMY_BASICS[id].level));
  assert.ok(!desert.some(([id]) => id >= 128 && id < 256), 'no person');
  assert.deepEqual(landWildOf(CLIMATES.Ocean, null, level), [], 'at sea none');
  // a mod's table (the door's selector) is read whole - its every choice - and an aquatic beast it writes onto the land never
  const [, d1] = CLIMATE_TABLE.get(CLIMATES.Desert);
  registerEncounterTableSelector({ table: () => null, choices: (i) => (i === d1 ? [[0, 41, 145], [3, 42, 11]] : null) });
  try {
    const modded = landWildOf(CLIMATES.Desert, null, level).map(([id]) => id);
    assert.ok(modded.includes(0) && modded.includes(3), 'both of the mod\'s choices');
    assert.ok(![41, 42, 11, 145].some((id) => modded.includes(id)), 'no Dreugh, Lamia or Slaughterfish on land, no person');
  } finally { _resetEncounterTableSelectors(); }
  // the same mod answering every band, every beast at one level: its two choices whole, and only its land monsters
  registerEncounterTableSelector({ table: () => null, choices: () => [[0, 41, 145], [3, 42, 11]] });
  try {
    assert.deepEqual(landWildOf(CLIMATES.Desert, null, () => 5), [[0, 5], [3, 5]], 'the rat and the bat: not the person (145) a level would let in');
  } finally { _resetEncounterTableSelectors(); }
  installTamrielFauna();
  try {
    const marsh = BIOME_BANDS.get('blackMarshGloomire');
    const wild = landWildOf(CLIMATES.Swamp, marsh, level).map(([id]) => id);
    const t = new Set([...biomeTable(marsh[1], false, false), ...biomeTable(marsh[2], false, false)].filter((id) => id < 128));
    assert.deepEqual(wild, [...t].sort((a, b) => a - b), 'Blackwood\'s zone\'s own, not the swamp climate\'s');
    assert.ok(!wild.includes(24) && !wild.includes(8), 'no Orc Warlord, no Centaur');
    for (let lv = 1; lv <= 30; lv++) for (const id of bountyQuarry(lv, landWildOf(CLIMATES.Swamp, marsh, level))) assert.ok(t.has(id), `level ${lv}: ${id} is Blackwood's`);
  } finally { _resetEncounterTableSelectors(); }
});

test('QUARRY-WORLD the host (scenes/bountyHost.js): a board posts the land\'s beasts about its town (its `wildAt`), and a taken notice rebuilt from its id hunts the same (mutants: the wild unhanded to the board, to the rebuild)', () => {
  const wild = [[281, 2], [271, 7], [272, 11], [32, 20]];
  let now = 900 * 1440 + 600;
  const opened = [];
  const host = createBountyHost({
    now: () => now, level: () => 2, entity: () => ({ goldPieces: 0, items: [] }), townName: () => TOWN.name, siteOk: () => true,
    playerPixel: () => null, canStand: () => false, standPack: () => null, say: () => {}, showNotice: () => true,
    openBoardWindow: (d) => opened.push(d), wildAt: (x, y) => (x === TOWN.px && y === TOWN.py ? wild : null),
  });
  assert.equal(host.openBoard(TOWN), true);
  const posts = opened[0].rows().map((r) => r.posting);
  assert.ok(posts.length === 4 && posts.every((p) => p.mobileType === 281), `the land's tier-1 beast on every slot (${posts.map((p) => p.mobileType)})`);
  assert.equal(host.take(posts[0].id).ok, true);
  const held = opened[0].rows().find((r) => r.held);
  assert.equal(held.posting.mobileType, 281, 'a taken notice, rebuilt from its id, hunts the land\'s beast');
  assert.equal(held.posting.foes, 'Mudcrabs');
});

test('QUARRY-WORLD by source: the world host hands the board the land\'s wild over its maps', () => {
  assert.match(hostText('src/scenes/world.js'), /wildAt: bountyLandWild\(maps\),/);
  const host = rd('src/scenes/bountyHost.js');
  assert.match(host, /dungeons: dungeonsFor\(b\.px, b\.py\),\n\s*wild: wildFor\(b\.px, b\.py\),\n\s*\}\);/);
  assert.match(host, /dungeons: dungeonsFor\(town\.px, town\.py\),\n\s*wild: wildFor\(town\.px, town\.py\),\n\s*\}\);/);
  let asked = 0;
  const at = bountyLandWild({ getClimateIndex: () => { asked++; return CLIMATES.Desert; } });
  assert.deepEqual(at(5, 5), at(5, 5));
  assert.equal(asked, 1, 'kept a pixel');
  registerEncounterTableSelector({ table: () => null, choices: () => null });   // the tables' door moved: read again
  try { at(5, 5); assert.equal(asked, 2, 'read again when the tables move'); } finally { _resetEncounterTableSelectors(); }
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK', 'TMAP00I0.IMG', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));
test('QUARRY-WORLD with ARENA2: a board in Black Marsh and one in the Alik\'r post their own land\'s beasts, every tier and day - where a Black Marsh board posted Orc Warlords and Centaurs', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { groundMaps } = await import('../../src/world/tamriel/tamrielGround.js');
  const { tamrielBiomeAt } = await import('../../src/world/tamriel/tamrielBiomes.js');
  const { faunaBandAt } = await import('../../src/systems/tamrielFauna.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  installTamrielFauna();
  try {
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    groundMaps(maps);
    maps.getFaunaBand = faunaBandAt;
    const wildAt = bountyLandWild(maps);
    let marsh = null;
    for (let y = 600; y < 1400 && !marsh; y += 7) for (let x = 2600; x < 3400 && !marsh; x += 7) if (tamrielBiomeAt(x, y)?.province === 'BlackMarsh') marsh = { px: x, py: y };
    assert.ok(marsh, 'a pixel of Black Marsh');
    let alikr = null;
    for (let y = 250; y < 480 && !alikr; y += 5) for (let x = 20; x < 400 && !alikr; x += 5) if (maps.getClimateIndex(x, y) === CLIMATES.Desert) alikr = { px: x, py: y };
    assert.ok(alikr, 'a pixel of the Alik\'r\'s desert');
    for (const [town, banned] of [[marsh, [24, 8, 4, 5]], [alikr, [4]]]) {
      const wild = wildAt(town.px, town.py);
      const own = new Set(wild.map(([id]) => id));
      const posted = new Set();
      for (let day = 0; day < 60; day++) for (const level of [1, 4, 8, 12, 20]) for (const p of boardPostings({ day, ...town, name: 'Town', level, sites: bountySites(town.px, town.py, () => true), wild })) posted.add(p.mobileType);
      assert.ok([...posted].every((id) => own.has(id)), `the land's own (${[...posted]})`);
      for (const id of banned) assert.ok(!posted.has(id), `never ${id}`);
      assert.ok(posted.size >= 4, `a range of the land's beasts (${posted.size})`);
    }
  } finally { _resetEncounterTableSelectors(); setTamrielTrace(null); setTamrielFit(null); }
});
