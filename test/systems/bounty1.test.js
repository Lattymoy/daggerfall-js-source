// BOUNTY1 (2026-09-28): the town's bounty boards - the law (systems/bounty/bountyBoard.js), the piece (systems/bounty/bountyReward.js),
// the host's hunt from Take to payday (scenes/bountyHost.js) and the party pose's `bq` (net/wire.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bountyTierFor, bountyGold, bountyItemRule, bountySites, boardPostings, parseBountyId, questBoardIndices,
  newBountyLedger, takeBounty, lapseBounties, bountyPackOwner, bountyDungeons, BOUNTY_LIFETIME_MINUTES, BOUNTY_PACK_MIN, BOUNTY_PACK_MAX,
} from '../../src/systems/bounty/bountyBoard.js';
import { mintBountyItem } from '../../src/systems/bounty/bountyReward.js';
import { createBountyHost } from '../../src/scenes/bountyHost.js';
import { validPartyPose } from '../../src/net/wire.js';
import { readBountyMarks, bountyRingTexels } from '../../src/ui/bounty/bountyMapMark.js';

const allLand = () => true;
const TOWN = { px: 300, py: 200, name: 'Daggerfall' };

test('BOUNTY1: the ladder - level bands, the purse, the piece (never past Magic)', () => {
  assert.deepEqual([1, 3, 4, 5, 6, 10, 11, 14, 15, 60].map((l) => bountyTierFor(l).min), [1, 1, 4, 4, 6, 6, 11, 11, 15, 15]);
  assert.ok(bountyTierFor(2).foes.includes(6), 'spiders at 1-3');
  assert.ok(bountyTierFor(4).foes.includes(4), 'grizzlies at 4-5');
  assert.ok(bountyTierFor(8).foes.includes(13) && bountyTierFor(12).foes.includes(19), 'harpies and mummies are on the board');
  // BOUNTY-PURSE: a full pack of eight pays Mac's numbers, four pays six tenths, by monster tier
  assert.deepEqual([2, 5, 8, 12].map((l) => bountyGold(l, 8, 0)), [50, 75, 90, 100]);
  assert.deepEqual([4, 5, 6, 7, 8].map((n) => bountyGold(2, n, 0)), [30, 35, 40, 45, 50]);
  assert.deepEqual([4, 5, 6, 7, 8].map((n) => bountyGold(4, n, 4)), [45, 53, 60, 68, 75]);
  assert.deepEqual([4, 5, 6, 7, 8].map((n) => bountyGold(8, n, 8)), [54, 63, 72, 81, 90]);
  assert.deepEqual([4, 5, 6, 7, 8].map((n) => bountyGold(12, n, 16)), [60, 70, 80, 90, 100]);
  assert.equal(bountyGold(6, 8, 8), 90, 'level 6 hunts tier 3 and is paid as tier 3');
  assert.deepEqual([2, 3, 4].map((n) => bountyGold(2, n, 0, true)), [30, 40, 50], 'a dungeon\'s 2/3/4 pay as 4/6/8');
  const t = bountyTierFor(20).foes;
  assert.equal(bountyGold(20, BOUNTY_PACK_MIN, t[0]), 150);
  assert.equal(bountyGold(20, BOUNTY_PACK_MAX, t[t.length - 1]), 200);
  assert.deepEqual([2, 5, 8, 12, 40].map((l) => bountyItemRule(l)), [
    { condition: 0.5, magicChance: 0 }, { condition: 0.75, magicChance: 0.5 }, { condition: 1, magicChance: 0.5 },
    { condition: 1, magicChance: 0.5 }, { condition: 1, magicChance: 0.5 }]);
  for (let i = 0; i < 20; i++) {
    const it = mintBountyItem(30, { rarityOn: true });
    assert.ok(!it.rarity || it.rarity === 'magic', 'never more than blue');
    if (it.maxCondition > 0) assert.equal(it.currentCondition, it.maxCondition);
  }
  const worn = mintBountyItem(2, { rarityOn: true });
  assert.ok(worn.maxCondition > 0 && Math.abs(worn.currentCondition / worn.maxCondition - 0.5) < 0.01, 'armour and weapons alike: half condition at 1-3');
  assert.equal(worn.rarity, undefined, 'white below 4');
});

test('BOUNTY1: every client reads the same board - same spots, slots and counts; the tier is the reader\'s', () => {
  const sites = bountySites(TOWN.px, TOWN.py, allLand);
  const a = boardPostings({ day: 900, ...TOWN, level: 2, sites });
  const b = boardPostings({ day: 900, ...TOWN, level: 12, sites });
  assert.equal(a.length, 4);
  assert.deepEqual(a.map((p) => [p.target, p.count, p.slot]), b.map((p) => [p.target, p.count, p.slot]));
  assert.equal(new Set(a.map((p) => `${p.target.px},${p.target.py}`)).size, 4, 'four spots');
  for (const p of a) {
    const d = Math.max(Math.abs(p.target.px - TOWN.px), Math.abs(p.target.py - TOWN.py));
    assert.ok(d >= 4 && d <= 10, 'four to ten pixels out');
    assert.ok(p.count >= 4 && p.count <= 8);
    assert.match(p.story, /Daggerfall|town/);
    assert.match(p.mapLine, /black circle/);
  }
  assert.notDeepEqual(boardPostings({ day: 901, ...TOWN, level: 2, sites }).map((p) => p.target), a.map((p) => p.target), 'a new day, a new board');
  assert.deepEqual(parseBountyId(a[0].id), { day: 900, px: 300, py: 200, slot: 0, level: 2, slotKey: '900.300.200.0' });
});

test('BOUNTY1: half of a town\'s boards are bounty boards, spread by position', () => {
  const b = (x) => ({ box: [x, 0, 0, x + 1, 1, 1] });
  assert.deepEqual([...questBoardIndices([b(5), b(1)])], [1]);
  assert.deepEqual([...questBoardIndices([b(3), b(1), b(4), b(2)])].sort(), [0, 1]);
  assert.equal(questBoardIndices([b(1)]).size, 0, 'a lone board keeps its notices');
});

test('BOUNTY1: the hunt - take, stand the pack on its pixel, count the corpses, pay and hold the notice', async () => {
  // a pack small enough to be one group (BOUNTY-TRAIL splits six and more - its own test)
  const sites0 = bountySites(TOWN.px, TOWN.py, allLand);
  let day0 = 900, slot0 = -1;
  for (; day0 < 1000 && slot0 < 0; day0++) slot0 = boardPostings({ day: day0, ...TOWN, level: 2, sites: sites0 }).findIndex((q) => q.count < 6);
  day0--;
  let now = day0 * 1440 + 600;
  const entity = { goldPieces: 10, items: [] };
  const said = [];
  const shown = [];
  let windowUp = false;
  const pool = [];
  let here = null;
  let board = null;
  const host = createBountyHost({
    now: () => now, level: () => 2, entity: () => entity,
    townName: () => 'Daggerfall', siteOk: allLand, playerPixel: () => here, canStand: () => true,
    standPack: ({ count }) => {
      const foes = Array.from({ length: count }, () => ({ dead: false, corpse: false, entity: { health: 10 } }));
      pool.push(...foes);
      return { foes: Promise.resolve(foes), dx: 0, dz: 80 };
    },
    foePool: () => pool, say: (l) => said.push(l),
    showNotice: (n) => { if (windowUp) return false; shown.push(n); return true; },
    openBoardWindow: (d) => { board = d; },
    rolls: () => 0.3,
  });
  host.openBoard(TOWN);
  const rows = board.rows();
  assert.equal(rows.length, 4);
  const p = rows[slot0].posting;
  assert.equal(board.take(p.id).ok, true);
  assert.equal(board.take(p.id).ok, false, 'a slot is taken once');
  assert.equal(host.mapMarks().length, 1, 'a black circle on the map');
  here = { x: p.target.px, y: p.target.py };
  host.tick(1);
  await Promise.resolve(); await Promise.resolve();
  const pack = pool.slice();
  assert.equal(pack.length, p.count);
  // one culled (no corpse) and the rest killed: the cull is no kill
  pack[0].dead = true;
  for (const f of pack.slice(1)) { f.dead = true; f.corpse = true; f.entity.health = 0; }
  windowUp = true;
  host.tick(1);
  assert.equal(host.held()[0].killed, p.count - 1, 'the culled one stands again');
  host.tick(1);
  await Promise.resolve(); await Promise.resolve();
  const again = pool.slice(pack.length);
  assert.equal(again.length, 1, 'only what was left');
  again[0].dead = true; again[0].corpse = true;
  host.tick(1);
  assert.equal(entity.goldPieces, 10 + p.gold, 'the purse');
  assert.equal(entity.items.length, 1, 'the piece');
  assert.equal(shown.length, 0, 'the notice waits for the screen');
  windowUp = false;
  host.tick(0.01);
  assert.equal(shown.length, 1);
  assert.match(shown[0].story, /gold pieces/);
  assert.match(shown[0].reward.gold, /gold pieces/);
  assert.ok(shown[0].reward.item.length > 0, 'the notice names the piece');
  assert.equal(board.rows()[slot0].state, 'paid', 'not posted to me again today');
  // lapse
  const q = board.rows()[(slot0 + 1) % 4].posting;
  board.take(q.id);
  now += BOUNTY_LIFETIME_MINUTES;
  host.tick(1);
  assert.equal(host.held().length, 0);
  assert.ok(said.some((l) => /lapsed/.test(l)));
});

test('BOUNTY1: the party - a share is taken up, a mate\'s clear pays me, one pack for all', async () => {
  const ledger = newBountyLedger();
  assert.equal(takeBounty(ledger, '900.300.200.1.5', 0).ok, true);
  assert.equal(lapseBounties(ledger, BOUNTY_LIFETIME_MINUTES - 1).length, 0);
  const at = { px: 301, py: 201 };
  const mates = [{ acct: 'a-1', p: { px: 301, py: 201, in: 0, bq: [{ i: '900.300.200.1.5' }] } }, { acct: 'a-0', p: { px: 1, py: 1, in: 0, bq: [{ i: '900.300.200.1.5' }] } }];
  const { bountyHuntKey } = await import('../../src/systems/bounty/bountyBoard.js');
  const hunt = bountyHuntKey('900.300.200.1.5');
  assert.equal(bountyPackOwner('b-9', mates, hunt, at), 'a-1', 'the lowest account on the pixel');
  assert.equal(bountyPackOwner('a-0x', [], hunt, at), 'a-0x');
  assert.equal(bountyPackOwner('b-9', mates, bountyHuntKey('900.300.200.1.12'), at), 'b-9', 'another tier on the same notice is another hunt');

  const entity = { goldPieces: 0, items: [] };
  let mateRows = [];
  const host = createBountyHost({
    now: () => 900 * 1440 + 60, level: () => 5, entity: () => entity, townName: () => 'Wayrest', siteOk: allLand,   // BOUNTY-TIER: the sharer's tier (4-5)
    playerPixel: () => null, canStand: () => true, standPack: () => null, say: () => {}, showNotice: () => true,
    openBoardWindow: () => {},
    social: () => ({ acct: 'me', inParty: true, mates: [{ acct: 'x', name: 'Aldric', p: { px: 0, py: 0, in: 0, bq: mateRows } }] }),
  });
  mateRows = [{ i: '900.300.200.2.4', s: 1 }];
  host.tick(1);
  assert.deepEqual(host.held().map((h) => [h.id, h.from]), [['900.300.200.2.5', 'Aldric']], 'the share, at MY level in its tier (AUDIT 28 B12)');
  assert.deepEqual(host.poseField(), { bq: [{ i: '900.300.200.2.5', s: 1 }] });
  mateRows = [{ i: '900.300.200.2.4', c: 1 }];
  host.tick(1);
  assert.equal(host.held().length, 1, 'a clear that says not WHEN pays nobody (AUDIT 28 B1)');
  mateRows = [{ i: '900.300.200.2.4', c: 1, t: 900 * 1440 + 60 }];
  host.tick(1);
  assert.equal(host.held().length, 0);
  const { postingFromId } = await import('../../src/systems/bounty/bountyBoard.js');
  const shared = postingFromId('900.300.200.2.5', { sites: bountySites(300, 200, allLand) });
  assert.equal(entity.goldPieces, shared.gold, 'paid at my level (5) and the hunt\'s pack');
  assert.deepEqual(host.poseField(), { bq: [{ i: '900.300.200.2.5', c: 1, t: 900 * 1440 + 60 }] });
});

test('BOUNTY1: the wire carries `bq` in its law and drops what is not', () => {
  const base = { px: 1, py: 1, in: 0, loc: '', h: 1, hm: 1, f: 1, fm: 1, m: 1, mm: 1 };
  const out = validPartyPose({ ...base, bq: [{ i: '900.300.200.1.5', s: 1, x: 9 }, { i: 'nope' }, { i: '900.300.200.3.12', c: 1 }] });
  assert.deepEqual(out.bq, [{ i: '900.300.200.1.5', s: 1 }, { i: '900.300.200.3.12', c: 1 }]);
  assert.equal('bq' in validPartyPose({ ...base, bq: [] }), false);
});

test('BOUNTY1: the black circle - read, and on the classic page', () => {
  const marks = readBountyMarks(() => [{ cx: 10.5, cy: 20.5, r: 1.5, label: 'Rats' }, { cx: NaN }], { width: 1000, height: 500 });
  assert.equal(marks.length, 1);
  const tex = bountyRingTexels(marks, 0, 0, 100, 100);
  assert.ok(tex.some(([x, y]) => x === 10 && y === 20), 'the target pixel itself');
  assert.ok(tex.length >= 8);
});

test('BOUNTY1: dungeon bounties - slots 2 and 3 name nearby dungeons, the pack stands inside', async () => {
  const DUNG = { '305,199': 'Castle Wightmoor', '293,206': 'The Dark Hollow' };
  const dungeonAt = (x, y) => DUNG[`${x},${y}`] ?? null;
  const sites = bountySites(TOWN.px, TOWN.py, allLand);
  const dungeons = bountyDungeons(TOWN.px, TOWN.py, dungeonAt);
  const posts = boardPostings({ day: 900, ...TOWN, level: 5, sites, dungeons });
  assert.deepEqual(posts.map((p) => p.kind), ['field', 'field', 'dungeon', 'dungeon']);
  assert.equal(new Set(posts.slice(2).map((p) => p.place)).size, 2, 'two different dungeons');
  for (const p of posts.slice(2)) assert.ok(p.count >= 2 && p.count <= 4, 'a dungeon pack is 2 to 4');
  for (const p of posts.slice(0, 2)) assert.ok(p.count >= 4 && p.count <= 8, 'the open ground keeps 4 to 8');
  const t = bountyTierFor(20).foes;
  assert.equal(bountyGold(20, 2, t[0], true), 150);
  assert.equal(bountyGold(20, 4, t[t.length - 1], true), 200, 'a full dungeon pack of the strongest pays the most');
  for (const p of posts.slice(2)) { assert.match(p.story, new RegExp(p.place)); assert.match(p.mapLine, new RegExp(`${p.place} is marked with a black circle`)); }
  const one = boardPostings({ day: 900, ...TOWN, level: 5, sites, dungeons: dungeons.slice(0, 1) });
  assert.deepEqual(one.map((p) => p.kind), ['field', 'field', 'field', 'dungeon']);
  assert.ok(boardPostings({ day: 900, ...TOWN, level: 5, sites }).every((p) => p.kind === 'field'), 'no dungeon in reach: all open ground');

  const pool = [];
  let below = null, outside = null, board = null;
  const entity = { goldPieces: 0, items: [] };
  const host = createBountyHost({
    now: () => 900 * 1440 + 60, level: () => 5, entity: () => entity, townName: () => 'Daggerfall', siteOk: allLand, dungeonAt,
    playerPixel: () => outside, dungeonPixel: () => below, canStand: () => true, canStandDungeon: () => true,
    standPack: () => { throw new Error('the open-air stander must not stand a dungeon pack'); },
    standDungeonPack: ({ count }) => { const foes = Array.from({ length: count }, () => ({ dead: false, entity: { health: 5 } })); pool.push(...foes); return { foes: Promise.resolve(foes), dx: 30, dz: 0 }; },
    foePool: () => pool, say: () => {}, showNotice: () => true, openBoardWindow: (d) => { board = d; },
  });
  host.openBoard(TOWN);
  const p = board.rows()[3].posting;
  assert.equal(p.kind, 'dungeon');
  board.take(p.id);
  outside = { x: p.target.px, y: p.target.py };
  host.tick(1);
  assert.equal(pool.length, 0, 'standing on the pixel outside is not being inside');
  outside = null; below = { x: p.target.px, y: p.target.py };
  host.tick(1);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(pool.length, p.count);
  for (const f of pool) { f.dead = true; f.corpse = true; }
  host.tick(1);
  assert.equal(entity.goldPieces, p.gold, 'paid underground');
  assert.equal(entity.items.length, 1);
});

test('BOUNTY-FARM: a farm stands while held, lingers until the hunter is 200 m off, and goes with its pixel', async () => {
  const { createBountyFarms, farmSpotLocal, FARM_LINGER_M } = await import('../../src/scenes/bountyFarms.js');
  assert.deepEqual(farmSpotLocal('900.300.200.0.2', 0), farmSpotLocal('900.300.200.0.2', 0), 'every holder reads the same spot');
  const buckets = new Map();
  const collider = { heightAt: () => 10, addMesh: (k) => buckets.set(k, (buckets.get(k) ?? 0) + 1), removeBucket: (k) => buckets.delete(k) };
  let builtPx = true, mode = 'exterior', feet = [400, 0, 400];
  const drawn = [];
  const farms = createBountyFarms({
    collider: () => collider, pixelTranslation: () => [0, 0, 0], pixelBuilt: () => (builtPx ? { texRemap: null } : null),
    farmBlockNear: () => ({ models: [{ modelIdNum: 1, matrix: new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]) }, { modelIdNum: 2, matrix: new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,5,0,0,1]) }], side: 100 }),
    getGpuMesh: async (id) => ({ id }), cpuModel: () => ({ positions: [0, 0, 0], indices: [0] }), prepare: async () => {},
    spotOk: () => true, feet: () => feet, mode: () => mode,
  });
  const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  const w = [{ id: '900.300.200.0.2', px: 300, py: 200 }];
  farms.sync(w); await flush();
  assert.deepEqual(farms.standing(), ['900.300.200.0.2']);
  assert.equal(buckets.get('bounty:farm:900.300.200.0.2'), 2, 'its walls are solid');
  assert.equal(farms.draw({ drawMesh: (g) => drawn.push(g.id) }), 2);
  assert.ok(farms.anchorFor(w[0].id), 'the pack makes its stand at the farm');
  // the bounty ends while the hunter stands beside it: it stays
  const c = farms.anchorFor(w[0].id);
  feet = [c[0] + 20, 0, c[2]];
  farms.sync([]);
  assert.equal(farms.standing().length, 1, 'never vanishes under the eyes');
  feet = [c[0] + FARM_LINGER_M + 60, 0, c[2]];   // the linger is measured from the farm's middle; the house may stand up to half a block off it
  farms.sync([]);
  assert.equal(farms.standing().length, 0, 'gone once 200 m off');
  assert.equal(buckets.size, 0, 'and its collider with it');
  // held again: the pixel unloads and returns
  farms.sync(w); await flush();
  builtPx = false; farms.sync(w);
  assert.equal(farms.standing().length, 0, 'its pixel unloaded');
  builtPx = true; farms.sync(w); await flush();
  assert.equal(farms.standing().length, 1, 'stood again on return');
  mode = 'dungeon'; farms.sync(w);
  assert.equal(farms.standing().length, 0, 'underground: every farm comes down');
});

test('BOUNTY-FARM: only notices about farms raise one, never a dungeon\'s', () => {
  const sites = bountySites(TOWN.px, TOWN.py, allLand);
  let farms = 0;
  for (let d = 900; d < 940; d++) {
    for (const p of boardPostings({ day: d, ...TOWN, level: 2, sites, dungeons: [{ px: 305, py: 199, name: 'Castle Wightmoor' }] })) {
      if (p.kind === 'dungeon') assert.equal(p.farm, false);
      if (p.farm) { farms++; assert.match(p.story, /granar|orchard|harvest|cattle|shepherd|farm/i); }
    }
  }
  assert.ok(farms > 0);
});

test('BOUNTY1: a bounty is in the quest log as a side quest with its clock, and the journal can abandon it', async () => {
  const { abandonBountyQuest, isBountyQuestId, bountyQuestShareable } = await import('../../src/systems/bounty/bountyJournal.js');
  const { questRail } = await import('../../src/ui/quest/questRail.js');
  let board = null;
  const host = createBountyHost({
    now: () => 900 * 1440 + 60, level: () => 3, entity: () => ({ goldPieces: 0, items: [] }), townName: () => 'Daggerfall',
    siteOk: allLand, playerPixel: () => null, canStand: () => false, standPack: () => null, say: () => {}, showNotice: () => true,
    openBoardWindow: (d) => { board = d; },
  });
  host.openBoard(TOWN);
  const p = board.rows()[0].posting;
  board.take(p.id);
  const rows = host.questLogEntries();
  assert.equal(rows.length, 1);
  assert.ok(isBountyQuestId(rows[0].id));
  const rail = questRail({ active: rows, finished: [] });
  assert.equal(rail.active.length, 1, 'the journal draws it');
  assert.equal(rail.active[0].main, false, 'filed under side quests');
  assert.ok(rail.active[0].clockSeconds > 0, 'with its time left');
  assert.ok(rail.active[0].entries[0].some((l) => /black circle/.test(l)));
  assert.equal(bountyQuestShareable(rows[0].id), false, 'no party: no share');
  assert.equal(abandonBountyQuest(rows[0].id), true);
  assert.equal(host.held().length, 0, 'abandoned from the journal');
  assert.equal(host.questLogEntries().length, 0);
});

test('BOUNTY-TRAIL: a pack of six or more is hunted in two groups, the second found by its trail', async () => {
  const { bountyGroups, bountyStage } = await import('../../src/scenes/bountyHost.js');
  assert.deepEqual(bountyGroups({ kind: 'field', count: 7 }), [4, 3]);
  assert.deepEqual(bountyGroups({ kind: 'field', count: 5 }), [5]);
  assert.deepEqual(bountyGroups({ kind: 'dungeon', count: 4 }), [4]);
  assert.equal(bountyStage({ kind: 'field', count: 8 }, 3), 0);
  assert.equal(bountyStage({ kind: 'field', count: 8 }, 4), 1);

  const sites = bountySites(TOWN.px, TOWN.py, allLand);
  let day = 900, p = null;
  for (; day < 1000 && !p; day++) p = boardPostings({ day, ...TOWN, level: 5, sites }).find((q) => q.count >= 6) ?? null;
  day--;
  const pool = [], said = [], asks = [];
  let far = true, board = null;
  const entity = { goldPieces: 0, items: [] };
  const host = createBountyHost({
    now: () => day * 1440 + 60, level: () => 5, entity: () => entity, townName: () => 'Daggerfall', siteOk: allLand,
    playerPixel: () => ({ x: p.target.px, y: p.target.py }), canStand: () => true,
    standPack: (o) => {
      asks.push(o);
      if (o.stage === 1 && far) return { far: true, dx: 0, dz: 230 };
      const foes = Array.from({ length: o.count }, () => ({ dead: false, entity: { health: 5 } }));
      pool.push(...foes);
      return { foes: Promise.resolve(foes), dx: 0, dz: 60 };
    },
    foePool: () => pool, say: (l) => said.push(l), showNotice: () => true, openBoardWindow: (d) => { board = d; },
  });
  host.openBoard(TOWN);
  board.take(board.rows().find((r) => r.posting.slot === p.slot).posting.id);
  const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
  host.tick(1); await flush();
  const [g1, g2] = bountyGroups(p);
  assert.equal(pool.length, g1, 'the first group alone');
  for (const f of pool) { f.dead = true; f.corpse = true; }
  host.tick(1);
  assert.ok(said.some((l) => /got away/.test(l)), 'the first group\'s fall is told');
  host.tick(1);
  assert.equal(asks.at(-1).stage, 1);
  assert.ok(said.some((l) => /tracks leading away.*230 meters to the north/.test(l)), 'the clue names the way');
  assert.ok(host.questLogEntries()[0].messages[0].some((t) => /tracks leading away/.test(t.text)), 'and the journal keeps it');
  const n = said.length;
  host.tick(1); host.tick(1);
  assert.equal(said.length, n, 'said once');
  far = false;
  host.tick(1); await flush();
  assert.equal(pool.length, g1 + g2, 'the second group stands once the hunter is close');
  for (const f of pool.slice(g1)) { f.dead = true; f.corpse = true; }
  host.tick(1);
  assert.equal(entity.goldPieces, p.gold, 'paid after both groups');
});

test('BOUNTY-TIER: a share is taken up only in its tier; a helper of another tier still sees the farm', async () => {
  const { bountyTierFits, bountyHuntKey, postingFromId } = await import('../../src/systems/bounty/bountyBoard.js');
  assert.equal(bountyTierFits('900.300.200.1.4', 5), true, 'levels 4 and 5 are one tier');
  assert.equal(bountyTierFits('900.300.200.1.14', 3), false);
  assert.equal(bountyHuntKey('900.300.200.1.4'), bountyHuntKey('900.300.200.1.5'));
  assert.notEqual(bountyHuntKey('900.300.200.1.5'), bountyHuntKey('900.300.200.1.12'));

  // a notice that raises a farm, for the helper's half
  const sites = bountySites(TOWN.px, TOWN.py, allLand);
  let farmId = null;
  for (let d = 900; d < 1000 && !farmId; d++) farmId = boardPostings({ day: d, ...TOWN, level: 14, sites }).find((q) => q.farm)?.id ?? null;
  let mateRows = [];
  const said = [];
  const entity = { goldPieces: 0, items: [] };
  const host = createBountyHost({
    now: () => Number(farmId.split('.')[0]) * 1440 + 60, level: () => 3, entity: () => entity, townName: () => 'Daggerfall', siteOk: allLand,
    playerPixel: () => null, canStand: () => false, standPack: () => null, say: (l) => said.push(l), showNotice: () => true, openBoardWindow: () => {},
    social: () => ({ acct: 'me', inParty: true, mates: [{ acct: 'x', name: 'Aldric', p: { px: 0, py: 0, in: 0, bq: mateRows } }] }),
  });
  mateRows = [{ i: farmId, s: 1 }];   // a level 14's farm bounty, shared with a level 3
  host.tick(1);
  assert.equal(host.held().length, 0, 'not taken across tiers');
  assert.ok(said.some((l) => /stronger hunters.*help them hunt/.test(l)), 'told why, and that they may help');
  const farm = postingFromId(farmId, { sites });
  assert.deepEqual(host.farmsWanted(), [{ id: farm.slotKey, px: farm.target.px, py: farm.target.py }], 'the helper sees the farm');
  mateRows = [{ i: farmId, c: 1 }];
  host.tick(1);
  assert.equal(entity.goldPieces, 0, 'the helper is not paid');
});

test('BOUNTY-TIER: the sharer is told which mates are too low or too high level to take it', () => {
  const base = { px: 1, py: 1, in: 0, loc: '', h: 1, hm: 1, f: 1, fm: 1, m: 1, mm: 1 };
  assert.equal(validPartyPose({ ...base, lv: 7 }).lv, 7, 'the pose carries a level');
  assert.equal('lv' in validPartyPose({ ...base, lv: 0 }), false);
  assert.equal('lv' in validPartyPose({ ...base, lv: 1.5 }), false);
  const said = [];
  let board = null;
  const mates = [
    { acct: 'a', name: 'Bran', p: { px: 0, py: 0, in: 0, lv: 3 } },    // tier 1: too low
    { acct: 'b', name: 'Cyra', p: { px: 0, py: 0, in: 0, lv: 5 } },    // tier 2: fits
    { acct: 'c', name: 'Dorn', p: { px: 0, py: 0, in: 0, lv: 12 } },   // tier 4: too high
    { acct: 'd', name: 'Eld', p: { px: 0, py: 0, in: 0 } },            // an older client: no level, not named
  ];
  const host = createBountyHost({
    now: () => 900 * 1440 + 60, level: () => 4, entity: () => ({ goldPieces: 0, items: [] }), townName: () => 'Daggerfall',
    siteOk: allLand, playerPixel: () => null, canStand: () => false, standPack: () => null, say: (l) => said.push(l),
    showNotice: () => true, openBoardWindow: (d) => { board = d; },
    social: () => ({ acct: 'me', inParty: true, mates }),
  });
  host.openBoard(TOWN);
  const p = board.rows()[0].posting;
  board.take(p.id);
  const done = board.share(p.id);
  assert.deepEqual(done.shut.map((m) => [m.name, m.low]), [['Bran', true], ['Dorn', false]]);
  assert.ok(said.some((l) => l === 'Bran (level 3) is too low level to take this bounty, but can still help you hunt.'));
  assert.ok(said.some((l) => /Dorn \(level 12\) is too high level/.test(l)));
  assert.ok(!said.some((l) => /Cyra|Eld/.test(l)));
});

test('BOUNTY-TIERLABEL: a notice names its tier and the levels in it', async () => {
  const { bountyTierLabel } = await import('../../src/systems/bounty/bountyBoard.js');
  assert.deepEqual([1, 4, 6, 11, 15, 30].map(bountyTierLabel), [
    'Tier 1 (levels 1\u20133)', 'Tier 2 (levels 4\u20135)', 'Tier 3 (levels 6\u201310)', 'Tier 4 (levels 11\u201314)', 'Tier 5 (levels 15+)', 'Tier 5 (levels 15+)']);
  const p = boardPostings({ day: 900, ...TOWN, level: 5, sites: bountySites(TOWN.px, TOWN.py, allLand) })[0];
  assert.equal(p.tier, 2);
  assert.equal(p.tierLabel, 'Tier 2 (levels 4\u20135)');
});

test('BOUNTY1: the bounties tick in the modal arm too - inside a dungeon or a building the hunt is not asleep', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  const arm = src.indexOf('    if (modes.frame(dt, now)) {');
  const armEnd = src.indexOf('      requestAnimationFrame(frame);\n      return;\n    }', arm);
  assert.ok(arm > 0 && armEnd > arm, 'the modal arm is where it was');
  const body = src.slice(arm, armEnd);
  assert.match(body, /bountyHost\?\.tick\(dt\)/, 'the bounty tick runs in the modal arm (Mac: the graveyard\'s spiders never stood)');
  assert.match(body, /bountyFarms\?\.sync\(/, 'and the farms are brought in line there (they come down underground)');
  assert.match(src, /dungeonPixel: \(\) => \{[\s\S]{0,400}modes\?\.dungeonLocation\?\.mapTableData/, 'the dungeon\'s own pixel is its location\'s');
});

test('BOUNTY-FARM-PICK: a notice copies one of the eight nearest farms, the same one for everyone', async () => {
  const { pickFarm, FARM_PICK_NEAREST } = await import('../../src/scenes/bountyFarms.js');
  const farms = Array.from({ length: 30 }, (_, i) => ({ px: 300 + i, py: 200, name: `F${i}` }));
  const picks = new Set();
  for (let s = 0; s < 4; s++) {
    for (let d = 900; d < 910; d++) {
      const key = `${d}.300.200.${s}`;
      const f = pickFarm(farms, 300, 200, key);
      assert.equal(pickFarm([...farms].reverse(), 300, 200, key), f, 'the list\'s order does not change the pick');
      assert.ok(f.px - 300 < FARM_PICK_NEAREST, 'one of the nearest eight');
      picks.add(f.name);
    }
  }
  assert.ok(picks.size >= 5, `neighbouring hunts get different farms (${picks.size} of 8 seen)`);
  assert.equal(pickFarm([], 0, 0, 'x'), null);
});
