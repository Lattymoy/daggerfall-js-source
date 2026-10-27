// LAIR-WORLD (2026-10-26, the owner: "with revenants and their lairs, this will work everywhere correct?"; asked, "Fix both
// in this PR" - bible/06-Systems/Revenants.md RVN7a, bible/06-Systems/Bounty-Boards.md LAIR-WORLD). A revenant's lair and a
// board's underground hunt were the Bay's alone: the world host's dungeon index was MAPS.BSA's rows, so past the Bay a
// revenant's deed found no dungeon in its ring and roamed - no hunt, no rumour, no circle, no trail - and the lair door's
// mend, the boards' rings, a bounty's id and the wire's copy of it stopped at the Bay's 1000 x 500. Past the Bay the
// dungeons are TESA8's lairs (world/tamrielDungeons.js), stood by the places host (scenes/tamrielPlacesHost.js), which now
// answers a pixel: its lair (`lairAt`), the lair laid unstood (`lairCloneAt` - a graveyard past the Bay is laid on a Bay
// template and may place no door), a place on it (`placeOnPixel`) and the stamp they stand on (`version`). Pinned: the
// door's law past the Bay, the boards' law and the wire's, the board host's ground kept under the stamp, the maps' circles
// over the continent, the hosts by source - and, on the player's data, the lairs, the door, a deed, a rumour and a board
// past the Bay.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../../../src/systems/revenant/revenant.js');
const { createLairDoor } = await import('../../../src/scenes/lairHost.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../../../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../../../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../../../src/characters/mobile/mobileTypes.js');
const { LOCATION_TYPES } = await import('../../../src/formats/mapsFile.js');
const B = await import('../../../src/systems/bounty/bountyBoard.js');
const { createBountyHost } = await import('../../../src/scenes/bountyHost.js');
const { validPartyPose, WORLD_PIXEL_BOUND } = await import('../../../src/net/wire.js');
const { readBountyMarks, readBountyMarksIn, REVENANT_LEGEND_TEXT } = await import('../../../src/ui/bounty/bountyMapMark.js');
const { hostText } = await import('../../hostText.mjs');

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const me = (id = 'char-lairworld') => ({ isPlayer: true, name: 'Zenako', characterId: id, level: 10, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 });
const foeOf = () => ({ mobileType: M.Orc, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster' });
const base = { foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {} };
/** A party pose the wire takes (test/scenes/audit28_bounty.test.js's). */
const POSE = { px: 1, py: 1, in: 0, loc: '', h: 1, hm: 1, f: 1, fm: 1, m: 1, mm: 1 };

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); setPlayerDoor(null); setWorldMinutes(1440 + 120);
});

// A tiny world past the Bay: model 56 carries a dungeon-entrance door, model 74 a building door alone.
const meshes = { 56: { subMeshes: [{ textureArchive: 56, textureRecord: 0, planes: [{}] }] }, 74: { subMeshes: [{ textureArchive: 74, textureRecord: 0, planes: [{}] }] } };
const fakeArch = { getRecordIndex: (id) => (meshes[id] ? id : -1), getMesh: (i) => meshes[i] };
const block = (...ids) => ({ layout: { models: ids.map((modelIdNum) => ({ modelIdNum })) } });
/** The places host's answer past the Bay, over a map of `x,y` -> { name, type, blocks, region }. */
function pastBayOf(lairs) {
  const asked = { lairAt: 0, clone: 0 };
  return {
    asked,
    lairAt: (x, y) => { asked.lairAt++; const l = lairs.get(`${x},${y}`); return l ? { mapId: 1, name: l.name, px: x, py: y, type: l.type ?? LOCATION_TYPES.DungeonLabyrinth, dungeonType: 0 } : null; },
    lairCloneAt: (x, y) => { const l = lairs.get(`${x},${y}`); if (!l) return null; asked.clone++; return { key: `${x},${y}`, exterior: { exteriorData: {} }, blocks: l.blocks }; },
    regionAt: (x, y) => lairs.get(`${x},${y}`)?.region ?? -1,
  };
}

test('LAIR-WORLD THE DOOR PAST THE BAY (scenes/lairHost.js): the ring about a pixel past the Bay is its lairs (the places host\'s `lairAt`) each with its region, one the player cannot go down into (laid unstood: `lairCloneAt`) never offered; the mend seeks the world\'s pixels - past the Bay\'s 1000 x 500 and west of its corner - and the Bay\'s own index is read first, as ever (mutants: the lairs past the Bay unread; their regions; their plan unlaid; the mend held to the Bay)', () => {
  const lairs = new Map([
    ['1506,300', { name: 'The Old Ghirpka Barrow', region: 63, blocks: [block(56)] }],
    ['1500,293', { name: 'Doorless Burial Ground', region: 63, type: LOCATION_TYPES.Graveyard, blocks: [block(74)] }],
    ['1494,306', { name: 'Castle Slucti', region: 63, blocks: [block(74, 56)] }],
    ['-46,-30', { name: 'The Vault West of the Corner', region: 70, blocks: [block(56)] }],
  ]);
  const pastBay = pastBayOf(lairs);
  const door = createLairDoor({
    maps: {}, blocks: {}, arch: fakeArch, locations: new Map(), dungeons: new Map([['105,100', 'A Bay Keep']]), regions: new Map([['105,100', 17]]),
    here: () => ({ x: 1500, y: 300 }), enhanced: () => false, layout: (loc) => ({ blocks: loc.blocks }), pastBay,
  });
  const at = door();
  assert.deepEqual(at.dungeons.map((d) => [d.name, d.px, d.py, d.region]).sort(), [['Castle Slucti', 1494, 306, 63], ['The Old Ghirpka Barrow', 1506, 300, 63]], 'its lairs past the Bay, the doorless one never offered');
  assert.equal(at.enterable(1500, 293), false, 'a lair laid on a doorless template: nobody goes down');
  assert.ok(pastBay.asked.clone >= 3, 'each laid to be judged');
  assert.deepEqual(at.nearest(1500, 293), { px: 1506, py: 300, name: 'The Old Ghirpka Barrow', region: 63 }, 'the mend past the Bay\'s 1000 x 500');
  assert.deepEqual(at.nearest(-40, -30), { px: -46, py: -30, name: 'The Vault West of the Corner', region: 70 }, 'and west and north of the Bay\'s corner');
  assert.deepEqual(door({ x: 100, y: 100 }).dungeons.map((d) => [d.name, d.region]), [['A Bay Keep', 17]], 'the Bay\'s index as ever');
  assert.equal(door({ x: WORLD_PIXEL_BOUND - 2, y: 0 }).nearest(WORLD_PIXEL_BOUND - 2, 0), null, 'past the world\'s bound nothing is sought');
});

test('LAIR-WORLD A REVENANT\'S DEED PAST THE BAY (systems/revenant/revenant.js revenantDeed, revenantRumor, revenantMapMarks): a win in the open past the Bay sends it to ground in a lair there, its region the province\'s; a town near it may tell of it; its circle is drawn over the continent and lost on the Bay\'s sheet alone (mutants: the door\'s lairs past the Bay unread; the held map\'s sheet the Bay\'s)', () => {
  const lairs = new Map([['1506,300', { name: 'The Old Ghirpka Barrow', region: 63, blocks: [block(56)] }]]);
  const door = createLairDoor({ maps: {}, blocks: {}, arch: fakeArch, locations: new Map(), dungeons: new Map(), regions: new Map(), here: () => ({ x: 1500, y: 300 }), enhanced: () => false, layout: (loc) => ({ blocks: loc.blocks }), pastBay: pastBayOf(lairs) });
  setPlayerDoor({ ...base, lairHere: door });
  const p = me();
  const r = N.revenantDeed(p, foeOf(), 'slew', { mobileType: M.Orc, rolls: () => 0 });
  assert.deepEqual(r.lair, { px: 1506, py: 300, name: 'The Old Ghirpka Barrow', region: 63 }, 'gone to ground past the Bay - it roamed, with no lair');
  const words = N.revenantRumor({ px: 1503, py: 304, region: 63 }, { numAnswersGivenTellMeAboutOrRumors: 0 }, { rolls: () => 0 });
  assert.match(words ?? '', /The Old Ghirpka Barrow/, 'a town past the Bay tells of it');
  assert.equal(N.revenantById(r.id).lairKnown, true);
  const marks = N.revenantMapMarks();
  assert.deepEqual(marks.map((m) => [m.cx, m.cy]), [[1506.5, 300.5]]);
  const continent = { x0: -300, y0: -200, w: 3000, h: 1600 };
  assert.deepEqual(readBountyMarksIn(() => marks, continent, REVENANT_LEGEND_TEXT).map((m) => [m.cx, m.cy]), [[1506.5, 300.5]], 'over the continent\'s frame');
  assert.deepEqual(readBountyMarks(() => marks, { width: 1000, height: 500 }, REVENANT_LEGEND_TEXT), [], 'the Bay\'s sheet alone drops it');
});

test('LAIR-WORLD THE BOARDS\' LAW AND THE WIRE\'S (systems/bounty/bountyBoard.js, net/wire.js validPartyPose `bq`): a bounty\'s id carries the world\'s pixel - past the Bay four digits, west of its corner below zero - read back whole, the Bay\'s as ever, and refused past the world\'s bound; a board\'s ground and dungeons are sought on the world\'s pixels; a party pose carries a hunt past the Bay (mutants: the parse held to the Bay; either ring held to the Bay; the id\'s or the wire\'s digits)', () => {
  for (const [px, py] of [[2170, 485], [-46, -30], [300, 200], [WORLD_PIXEL_BOUND - 1, -(WORLD_PIXEL_BOUND - 1)]]) {
    const id = B.bountyId(900, px, py, 3, 12);
    const b = B.parseBountyId(id);
    assert.deepEqual([b?.px, b?.py, b?.slot, b?.level], [px, py, 3, 12], id);
    const pose = validPartyPose({ ...POSE, bq: [{ i: id, s: 1 }] });
    assert.deepEqual(pose?.bq, [{ i: id, s: 1 }], `the wire carries ${id}`);
  }
  assert.equal(B.parseBountyId('900.300.200.3.12').px, 300, 'a Bay id reads as it always did');
  assert.equal(B.parseBountyId(`900.${WORLD_PIXEL_BOUND}.200.3.12`), null, 'past the world\'s bound');
  assert.equal(validPartyPose({ ...POSE, bq: [{ i: '900.12345.200.3.12' }] })?.bq, undefined, 'five digits: no pixel of the world');
  assert.ok(validPartyPose({ ...POSE, bq: [{ i: '900.12345.200.3.12' }] }), 'the pose itself stands');
  const ring = B.bountySites(2170, 485, () => true);
  assert.equal(ring.length, 21 * 21 - 7 * 7, 'the whole ring past the Bay');
  assert.ok(ring.every(([x, y]) => Math.max(Math.abs(x - 2170), Math.abs(y - 485)) >= 4));
  assert.equal(B.bountySites(-2, -2, () => true).length, 21 * 21 - 7 * 7, 'west and north of the corner too');
  const dungeons = B.bountyDungeons(2170, 485, (x, y) => (x === 2163 && y === 479 ? 'The Androgulus Reformatory' : x === 2166 && y === 482 ? 'The Cassius Vaults' : null), (x, y) => x === 2166 && y === 482);
  assert.deepEqual(dungeons, [{ px: 2163, py: 479, name: 'The Androgulus Reformatory', graveyard: false }, { px: 2166, py: 482, name: 'The Cassius Vaults', graveyard: true }]);
});

test('LAIR-WORLD THE BOARD HOST (scenes/bountyHost.js): a board past the Bay posts underground hunts in its lairs, its notice\'s id the world\'s pixel; a town\'s ground and dungeons are kept under what the places past the Bay stand on (`placesVersion`) - read again when it moves, never before (mutants: the stamp unread)', () => {
  const TOWN = { px: 2170, py: 485, name: 'Bravil' };
  let version = 'v1', asked = 0;
  const names = { v1: 'The Androgulus Reformatory', v2: 'The Hall of Barivoth' };
  let board = null;
  const host = createBountyHost({
    now: () => 900 * 1440 + 60, level: () => 5, entity: () => ({ goldPieces: 0, items: [] }), townName: () => 'Bravil', siteOk: () => true,
    dungeonAt: (x, y) => { asked++; return x === 2163 && y === 479 ? names[version] : x === 2171 && y === 479 ? "Caelus's Hold" : null; },
    graveyardAt: () => false, placesVersion: () => version,
    playerPixel: () => null, canStand: () => true, standPack: () => ({ foes: Promise.resolve([]), dx: 0, dz: 80 }), foePool: () => [],
    say: () => {}, showNotice: () => true, openBoardWindow: (d) => { board = d; }, rolls: () => 0.3,
  });
  host.openBoard(TOWN);
  const under = (rows) => rows.map((r) => r.posting).filter((p) => p.kind === 'dungeon');
  const first = under(board.rows());
  assert.ok(first.length >= 1, 'underground hunts past the Bay');
  assert.ok(first.every((p) => [names.v1, "Caelus's Hold"].includes(p.place)), 'in its lairs');
  assert.ok(first.some((p) => p.place === names.v1), 'the lair the land stands now');
  assert.deepEqual([B.parseBountyId(first[0].id)?.px, B.parseBountyId(first[0].id)?.py], [2170, 485], 'its id the world\'s pixel');
  const n = asked;
  board.rows();
  assert.equal(asked, n, 'kept');
  version = 'v2';
  const second = under(board.rows());
  assert.ok(asked > n, 'read again under the new stamp');
  assert.deepEqual(second.map((p) => p.place), first.map((p) => (p.place === names.v1 ? names.v2 : p.place)), 'the lair the land now stands, in its slot');
});

test('LAIR-WORLD THE HOSTS BY SOURCE: the world host hands the lair door and the boards the places past the Bay - the door its `pastBay`, the boards\' dungeons and graveyards the lairs there, their ground no place the build stands there, their caches the stamp; the held map reads the hunts\' and the lairs\' circles over the continent\'s sheet (mutants: any unwired)', () => {
  const w = hostText('src/scenes/world.js');
  assert.ok(w.includes('lairHere: createLairDoor({ maps, blocks, arch, locations: locationIndex, dungeons: _bountyDungeonPixels, regions: _dungeonRegionPixels, here: playerTravelPixel, pastBay: provinceQuestPlaces }),'));
  assert.ok(w.includes('dungeonAt: (x, y) => _bountyDungeonPixels.get(`${x},${y}`) || provinceQuestPlaces.lairAt(x, y)?.name || null,'));
  assert.ok(w.includes('graveyardAt: (x, y) => _bountyGraveyardPixels.has(`${x},${y}`) || provinceQuestPlaces.lairAt(x, y)?.type === LOCATION_TYPES.Graveyard,'));
  assert.ok(w.includes('siteOk: (x, y) => (onTheBay(x, y) ? x > 0 && y > 0 && x < 999 && y < 499 && !_bountyLocPixels.has(`${x},${y}`) && !spawnsDungeon(_spawnSalt, x, y) : !provinceQuestPlaces.placeOnPixel(x, y))'));
  assert.ok(w.includes('placesVersion: provinceQuestPlaces.version,'));
  const places = read('src/scenes/tamrielPlacesHost.js');
  assert.ok(places.includes('    lairAt, lairCloneAt, placeOnPixel, version: placesVersion,'), 'the places host hands them on');
  const held = read('src/ui/heldMap.js');
  assert.ok(held.includes('    const sheet = this._marksBox();'));   // PIN MOVED (BAY-LEFT-MAPS): the sheet's one box, every mark's (heldMap.js _marksBox)
  assert.ok(held.includes('const bounties = readBountyMarksIn(this.deps.bounties, sheet);'));
  assert.ok(held.includes('const lairs = readBountyMarksIn(this.deps.revenants, sheet, REVENANT_LEGEND_TEXT);'));
});

// ─── THE PLAYER'S DATA ───────────────────────────────────────────────────────────────
const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAS = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA')) && existsSync(join(ARENA2, 'ARCH3D.BSA'));
let _world = null;
async function world() {
  if (_world) return _world;
  const { standWorldPastBay } = await import('../quest/r25World.mjs');
  const w = await standWorldPastBay(ARENA2);
  const { Arch3dFile } = await import('../../../src/formats/arch3dFile.js');
  const arch = new Arch3dFile(); arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const P = w.places.provinceQuestPlaces;
  const door = createLairDoor({ maps: w.maps, blocks: w.blocks, arch, locations: w.locationIndex, dungeons: new Map(), regions: new Map(), here: () => ({ x: 2170, y: 485 }), enhanced: () => false, pastBay: P });
  return (_world = { ...w, P, door });
}

test('LAIR-WORLD on the player\'s data: THE PLACES HOST - `lairAt` is the build\'s own lair on its cell\'s site (lairsNear\'s rows, every one) and none beside it or on the Bay; `placeOnPixel` a lair, the Imperial City and open ground told apart; a lair\'s region its province\'s (mutants: the site unchecked; the Bay read as past it)', { skip: !HAS && 'no ARENA2_PATH' }, async () => {
  const { P } = await world();
  const rows = P.lairsNear(2069, 658, 60);
  assert.ok(rows.length > 50, `the lairs about the Imperial City (${rows.length})`);
  for (const r of rows) {
    assert.deepEqual(P.lairAt(r.px, r.py), r, `${r.name}`);
    assert.equal(P.lairAt(r.px + 1, r.py), null, `${r.name}: none beside its site`);
  }
  assert.equal(P.lairAt(565, 427), null, 'the Bay\'s are MAPS.BSA\'s');
  // every cell's site on the Bay's own ground: none - the Bay's dungeons are its rows', never a roll's
  const { lairCellOf, lairSite } = await import('../../../src/world/tamrielDungeons.js');
  const { inBay } = await import('../../../src/world/tamriel/tamrielFrame.js');
  let sites = 0;
  for (let y = 0; y < 500; y += 3) for (let x = 0; x < 1000; x += 3) {
    const c = lairCellOf(x, y), s = c < 0 ? null : lairSite(c);
    if (!s || !inBay(s.px, s.py) || s.px !== x || s.py !== y) continue;
    sites++;
    assert.equal(P.lairAt(x, y), null, `${x},${y}: a Bay cell's site`);
  }
  assert.ok(sites > 100, `the Bay's cell sites read (${sites})`);
  assert.deepEqual([P.placeOnPixel(2163, 479), P.placeOnPixel(2069, 658), P.placeOnPixel(2170, 485)], [true, true, false]);
  assert.equal(P.regionAt(2163, 479), 70, 'Cyrodiil\'s');
  assert.equal(P.lairCloneAt(2163, 479)?.name, 'The Androgulus Reformatory', 'laid, not stood');
  assert.equal(P.lairCloneAt(2170, 485), null);
});

test('LAIR-WORLD on the player\'s data: THE DOOR - the ring about a pixel past the Bay names its lairs, each one the player can go down into, in Cyrodiil\'s region; of the 350 graveyards past the Bay within 200 pixels of the Imperial City 12 are laid on a doorless template - never offered, each mended to an enterable lair (mutants: the door\'s lairs past the Bay unread; their plan unlaid)', { skip: !HAS && 'no ARENA2_PATH' }, async () => {
  const { P, door } = await world();
  const ring = door({ x: 2170, y: 485 }).dungeons;
  for (const name of ["Caelus's Hold", 'The Androgulus Reformatory', 'The Hall of Barivoth']) assert.ok(ring.some((d) => d.name === name), name);
  assert.ok(ring.length >= 3 && ring.every((d) => d.region === 70 && door().enterable(d.px, d.py)), 'enterable, Cyrodiil\'s');
  assert.ok(!ring.some((d) => d.name === 'The Cassius Vaults'), 'its doorless graveyard never offered');
  const graves = P.lairsNear(2069, 658, 200).filter((r) => r.type === LOCATION_TYPES.Graveyard);
  const shut = graves.filter((r) => !door().enterable(r.px, r.py));
  // PIN MOVED (NIBEN-SEA, TAMRIEL-DEEP, bible/03-World/Tamriel.md): 364 and 13 on the tamriel branch - thirteen stood on
  // the Niben's course, the sea's now, one of them doorless; and The Galgulus Burial Ground on Lake Rumare's east shore
  // (2171, 649) is no place once the sea beside it carries no large-map detail
  assert.deepEqual([graves.length, shut.length], [350, 12]);
  for (const g of shut) {
    const to = door({ x: g.px, y: g.py }).nearest(g.px, g.py);
    assert.ok(to && door().enterable(to.px, to.py) && to.px >= 1000, `${g.name}: mended past the Bay`);
  }
});

test('LAIR-WORLD on the player\'s data: A DEED AND A BOARD PAST THE BAY - a revenant\'s win near Bravil\'s country sends it to ground in a lair of Cyrodiil the player can enter; a board there posts its lairs, the graveyard flagged for the open air (mutants: the door\'s lairs unread; the boards\' graveyards unread)', { skip: !HAS && 'no ARENA2_PATH' }, async () => {
  const { P, door } = await world();
  setPlayerDoor({ ...base, lairHere: door });
  const r = N.revenantDeed(me('char-lairworld-data'), foeOf(), 'slew', { mobileType: M.Orc, rolls: () => 0 });
  assert.ok(r.lair && r.lair.px >= 1000 && r.lair.region === 70 && door().enterable(r.lair.px, r.lair.py), JSON.stringify(r.lair));
  const dungeonAt = (x, y) => P.lairAt(x, y)?.name || null, graveyardAt = (x, y) => P.lairAt(x, y)?.type === LOCATION_TYPES.Graveyard;
  const d = B.bountyDungeons(2170, 485, dungeonAt, graveyardAt);
  assert.ok(d.some((x) => x.name === 'The Cassius Vaults' && x.graveyard), 'a graveyard\'s hunt in the open air outside it');
  assert.ok(d.some((x) => x.name === 'The Androgulus Reformatory' && !x.graveyard));
  const posts = B.boardPostings({ day: 900, px: 2170, py: 485, name: 'Bravil', level: 5, sites: B.bountySites(2170, 485, () => true), dungeons: d });
  assert.ok(posts.some((p) => p.kind === 'dungeon'), 'an underground hunt past the Bay');
});
