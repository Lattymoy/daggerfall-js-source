// RVN7a - THE LAIR (bible/12-Enhanced-AI/Feud-Arc.md section 18.1; Mac, 2026-10-04: "more complex, less easy to
// accomplish and more detailed", then "Go"). At a deed in the open world a revenant's lair is the named dungeon in the
// bounty boards' 4-10 px ring about the deed's map pixel nearest a bearing drawn on its id - kept as {px, py, name,
// region}; with none in the ring it roams. A deed underground makes that dungeon its lair. The host says where a deed
// is done through the player's door (`lairHere`). A lair moved is one the player has not heard of.
// Pinned: the numbers; the pick (the bearing on its id, the nearer of two as near, none, the junk); the lair after a
// deed (kept, underground, nowhere known); the deed itself through the door, both ways, and `lairKnown`; the hosts'
// doors; the page.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../src/systems/revenant.js');
const F = await import('../src/systems/revenantFeud.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../src/systems/worldTick.js');
const { getSeed, setSeed } = await import('../src/formats/dfRandom.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { bountyDungeons, BOUNTY_MIN_PX, BOUNTY_MAX_PX } = await import('../src/systems/bountyBoard.js');
const { lairWords } = await import('../src/ui/revenantPage.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const me = (id = 'char-rvn7') => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 });

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); setPlayerDoor(null); setWorldMinutes(1440 + 120);
});

const D = (px, py, name, region = 3) => ({ px, py, name, region });

test('RVN7a THE NUMBERS: a rumour one time in 0.35 within 20 px of its lair; a lair stand\'s gold x1.25; the ring the boards\' 4-10 px (mutants: any moved)', () => {
  assert.equal(F.RUMOR_CHANCE, 0.35);
  assert.equal(F.RUMOR_PX, 20);
  assert.equal(F.LAIR_GOLD, 1.25);
  assert.deepEqual([BOUNTY_MIN_PX, BOUNTY_MAX_PX], [4, 10]);
});

test('RVN7a THE PICK: of the dungeons about the deed, the one nearest a bearing drawn on its id (east 0, north a quarter turn) - the nearer of two as near; one id one lair, the shared DFRandom unmoved; none in reach, or junk, null - it roams (mutants: the bearing off its id; the nearest by distance alone; the tie the farther; north and south swapped; the junk kept)', () => {
  const at = [100, 100];
  const ring = [D(106, 100, 'East Keep'), D(100, 94, 'North Barrow'), D(94, 100, 'West Crypt'), D(100, 106, 'South Mine')];
  // each id's bearing decides: across many ids every one of the four is someone's lair, each the nearest to its bearing
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const id = `rvn7a-${i}`;
    const lair = F.pickLair(id, at[0], at[1], ring);
    seen.add(lair.name);
    assert.deepEqual(F.pickLair(id, at[0], at[1], ring), lair, 'one id, one lair');
  }
  assert.deepEqual([...seen].sort(), ['East Keep', 'North Barrow', 'South Mine', 'West Crypt']);
  // a bearing found by search: the id whose lair is the North Barrow is north of east - the screen's y runs south
  const northId = [...Array(200).keys()].map((i) => `rvn7a-${i}`).find((id) => F.pickLair(id, at[0], at[1], ring).name === 'North Barrow');
  assert.equal(F.pickLair(northId, at[0], at[1], [D(100, 94, 'N'), D(100, 106, 'S')]).name, 'N', 'north is y less');
  // two on one bearing: the nearer
  const eastId = [...Array(200).keys()].map((i) => `rvn7a-${i}`).find((id) => F.pickLair(id, at[0], at[1], ring).name === 'East Keep');
  assert.equal(F.pickLair(eastId, at[0], at[1], [D(110, 100, 'Far East'), D(105, 100, 'Near East'), D(94, 100, 'West')]).name, 'Near East');
  // its region and its shape, sanitized
  assert.deepEqual(F.pickLair(eastId, at[0], at[1], [D(105, 100, 'Near East', 17)]), { px: 105, py: 100, name: 'Near East', region: 17 });
  assert.deepEqual(F.pickLair(eastId, at[0], at[1], [{ px: 105, py: 100, name: 'X' }]).region, -1);
  // the bearing itself, read off its id's stream: a dungeon on it beats its mirror across east-west, and one a little past
  // north of east (the wrap) beats one farther back
  const bearingOf = (id) => F.idStream(id, 'lair')() * Math.PI * 2;
  const ids = [...Array(400).keys()].map((i) => `rvn7a-b${i}`);
  const northish = ids.find((id) => { const b = bearingOf(id); return b > Math.PI / 6 && b < (5 * Math.PI) / 6; });
  const b = bearingOf(northish);
  const on = D(at[0] + Math.round(8 * Math.cos(b)), at[1] - Math.round(8 * Math.sin(b)), 'On Its Bearing');
  const mirror = D(at[0] + Math.round(8 * Math.cos(b)), at[1] + Math.round(8 * Math.sin(b)), 'Its Mirror');
  assert.equal(F.pickLair(northish, at[0], at[1], [mirror, on]).name, 'On Its Bearing', 'north is up the map (y less)');
  const late = ids.find((id) => bearingOf(id) > (2 * Math.PI) * (330 / 360));
  const bl = bearingOf(late);
  const past = D(at[0] + Math.round(9 * Math.cos(bl + 0.35)), at[1] - Math.round(9 * Math.sin(bl + 0.35)), 'Just Past East');
  const back = D(at[0] + Math.round(9 * Math.cos(bl - 0.9)), at[1] - Math.round(9 * Math.sin(bl - 0.9)), 'Farther Back');
  assert.equal(F.pickLair(late, at[0], at[1], [back, past]).name, 'Just Past East', 'the turn wraps');
  // junk on its very bearing never hides a lair beside it
  assert.equal(F.pickLair(northish, at[0], at[1], [{ ...on, px: on.px + 0.5 }, mirror]).name, 'Its Mirror');
  setSeed(4242);
  F.pickLair('rvn7a-seed', at[0], at[1], ring);
  assert.equal(getSeed(), 4242, 'the shared DFRandom unmoved');
  assert.equal(F.pickLair('x', at[0], at[1], []), null, 'none in reach: it roams');
  assert.equal(F.pickLair('x', at[0], at[1], null), null);
  assert.equal(F.pickLair('x', at[0], at[1], [{ px: 1.5, py: 2, name: 'A' }, { px: 1, py: 2, name: '' }, null]), null, 'junk');
  assert.equal(F.pickLair('x', null, 3, ring), null, 'no pixel');
  // the boards' own ring feeds it: 4-10 px, never nearer
  const idx = new Map([[`${at[0] + 3},${at[1]}`, 'Too Near'], [`${at[0] + 7},${at[1]}`, 'In Reach'], [`${at[0] + 11},${at[1]}`, 'Too Far']]);
  const list = bountyDungeons(at[0], at[1], (x, y) => idx.get(`${x},${y}`) ?? null);
  assert.deepEqual(list.map((d) => d.name), ['In Reach']);
});

test('RVN7a AFTER A DEED: underground, that dungeon; in the open world the lair it has, else one picked about the deed; nowhere known, as it was (mutants: an open-world deed moving a kept lair; underground ignored; nothing known wiping it)', () => {
  const kept = D(5, 5, 'Old Lair', 2);
  const here = { px: 100, py: 100, dungeons: [D(106, 100, 'East Keep')] };
  assert.deepEqual(F.lairAfter({ id: 'a', lair: kept }, here), kept, 'kept');
  assert.deepEqual(F.lairAfter({ id: 'a', lair: null }, here), D(106, 100, 'East Keep', 3), 'picked');
  assert.deepEqual(F.lairAfter({ id: 'a', lair: kept }, { underground: D(9, 9, 'Below', 4) }), D(9, 9, 'Below', 4), 'underground: that dungeon');
  assert.deepEqual(F.lairAfter({ id: 'a', lair: kept }, null), kept, 'nowhere known: as it was');
  assert.equal(F.lairAfter({ id: 'a', lair: null }, null), null);
  assert.deepEqual(F.lairAfter({ id: 'a', lair: kept }, { underground: { px: 'x' } }), kept, 'a junk dungeon: as it was');
  assert.equal(F.sameLair(D(1, 2, 'a'), D(1, 2, 'b')), true, 'by its pixel');
  assert.equal(F.sameLair(D(1, 2, 'a'), D(2, 2, 'a')), false);
  assert.equal(F.sameLair(D(1, 2, 'a'), D(1, 3, 'a')), false);
  assert.equal(F.sameLair(null, null), true);
  assert.equal(F.sameLair(null, D(1, 2, 'a')), false);
});

test('RVN7a THE DEED through the door: a deed in the open world picks its lair about the door\'s pixel and keeps it; a deed underground moves it there and forgets that the player knew it; a deed in the lair it has keeps what the player knows (mutants: the door unread; lairKnown kept on a move; wiped on a stay)', () => {
  const p = me();
  let here = { px: 100, py: 100, dungeons: [D(106, 100, 'East Keep', 3), D(94, 100, 'West Crypt', 3), D(100, 94, 'North Barrow', 3), D(100, 106, 'South Mine', 3)] };
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, lairHere: () => here });
  const foe = { mobileType: M.Orc, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' };
  const r = N.revenantDeed(p, foe, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  assert.ok(r.lair, 'a lair');
  assert.deepEqual(r.lair, F.pickLair(r.id, 100, 100, here.dungeons));
  assert.equal(r.lairKnown, false);
  const first = r.lair;
  r.lairKnown = true;
  here = { px: 300, py: 300, dungeons: [D(306, 300, 'Elsewhere', 9)] };
  N.revenantDeed(p, foe, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  assert.deepEqual(r.lair, first, 'kept');
  assert.equal(r.lairKnown, true, 'and still known');
  here = { underground: D(first.px, first.py, first.name, first.region) };
  N.revenantDeed(p, foe, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  assert.equal(r.lairKnown, true, 'a deed in its own lair: still known');
  here = { underground: D(40, 41, 'The Pit', 5) };
  N.revenantDeed(p, foe, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  assert.deepEqual(r.lair, D(40, 41, 'The Pit', 5), 'moved underground');
  assert.equal(r.lairKnown, false, 'a lair moved is unheard of');
  // the record saves it
  assert.deepEqual(F.feudFields({ ...r }, { id: r.id, mobileType: r.mobileType, rank: r.rank }).lair, D(40, 41, 'The Pit', 5));
  // with no door, or none in reach, it roams
  setPlayerDoor(null);
  const lone = N.revenantDeed(p, { mobileType: M.Orc, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  assert.notEqual(lone, r, 'a new one');
  assert.equal(lone.lair, null);
});

test('RVN7a THE HOSTS: the world host\'s door names my map pixel and the named dungeons in the boards\' ring with their regions; the dungeon\'s names itself; the cast engine publishes it (mutants: unwired)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /lairHere: \(\) => \{[^\n]*\n\s*const p = playerTravelPixel\(\);\n\s*const dungeons = bountyDungeons\(p\.x, p\.y, \(x, y\) => _bountyDungeonPixels\.get\(`\$\{x\},\$\{y\}`\) \|\| null\)\.map\(\(d\) => \(\{ \.\.\.d, region: _dungeonRegionPixels\.get\(`\$\{d\.px\},\$\{d\.py\}`\) \?\? -1 \}\)\);\n\s*return \{ px: p\.x, py: p\.y, dungeons \};/);
  assert.match(w, /_dungeonRegionPixels\.set\(`\$\{p\.x\},\$\{p\.y\}`, r\);/);
  const d = read('src/scenes/dungeonContext.js');
  assert.match(d, /return \{ underground: \{ px: p\.x, py: p\.y, name: String\(dfLocation\.name\), region: dfLocation\.regionIndex \?\? -1 \} \};/);
  assert.match(read('src/scenes/hostMagic.js'), /lairHere: \(\) => \{ try \{ return lairHere\?\.\(\) \?\? null; \} catch \{ return null; \} \},/);
  assert.match(read('src/systems/revenant.js'), /const lair = lairAfter\(r, playerDoor\(\)\?\.lairHere\?\.\(\) \?\? null\);\n\s*if \(!sameLair\(lair, r\.lair\)\) \{ r\.lair = lair; r\.lairKnown = false; \}/);
});

test('RVN7a the page: its lair as I know it - roaming, unknown, or named (mutants: a lair unknown named)', () => {
  assert.equal(lairWords({ lair: null }), 'Lair: none - it roams.');
  assert.equal(lairWords({ lair: D(1, 2, 'Tomb of Vaness'), lairKnown: false }), 'Lair: unknown - the towns about it may have heard.');
  assert.equal(lairWords({ lair: D(1, 2, 'Tomb of Vaness'), lairKnown: true }), 'Lair: Tomb of Vaness - on your map.');   // PIN MOVED (RVN7c: and marked on the map)
  assert.match(read('src/ui/revenantPage.js'), /if \(!fallen\) text\.append\(el\('span', 'rvn-will', lairWords\(r\)\)\);   \/\/ RVN7/);
});
