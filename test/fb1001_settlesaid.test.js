// FIELD BUGS 2026-10-01 - Mac: "Are you actually looking into tools not being able to be used on boulders? Like it gives a
// notification but you cant mine".
//
// SETTLE-SAID. A gathering act asks Foraging's checks at its start (FORAGE0 14.3), the settlement's among them: a town,
// a hamlet, a village, a farm, a wealthy home, a tavern or a temple - its footprint and a whole city block round it
// (PlayerGPS's location rect). The plans of a vein, a boulder, an herb patch and a tree never asked it, and those nodes
// stand there - a rock field's pieces and the wild's stone on a farm's pixel, the forest and its herbs to forty metres
// of the footprint - so the prompt said "Quarry the stone - Mining 40", and E or the Pick-Axe's Use played no act and
// said "You cannot mine in a settlement!", every time. Hunting's and Fishing's plans ask it (AUDIT 32 H4, NET_WHERE);
// now the ground's nodes do (net/professionLaw.js GROUND_WHERE, each kind's `where`, the host's planFor): the prompt
// says "not in a settlement", E passes on to the door or says it, the tool's Use says it, and no act is played. A
// dungeon's vein asks no settlement. The real gathering host with its herb, mine and tree kinds over a stood pixel
// (test/fb1001_anyhour.test.js's).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setForagingHost, createForagingItem } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { createGatherHost, aimAt } from '../src/scenes/gatherHost.js';
import { herbKind } from '../src/scenes/herbHost.js';
import { mineKind } from '../src/scenes/mineHost.js';
import { treeKind } from '../src/scenes/treeHost.js';
import { trees, veins, boulders, utcDayOfMs } from '../src/net/nodeLaw.js';
import { groundAt } from '../src/world/terrainNature.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { GROUND_WHERE, GROUND_WHERE_WORDS } from '../src/net/professionLaw.js';

const WOODS = CLIMATES.Woodlands, GLENUMBRA = 59;
const PX = 405, PY = 150;
const NOON_MS = (20500 * 86_400 + 43_200) * 1000;
const DAY = utcDayOfMs(NOON_MS);
const tick = () => new Promise((r) => setImmediate(r));
/** The wild at `hour`: no settlement, no foe near, the load light, dry ground. */
const wild = (hour) => ({ inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 10, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' });

/** A Woodlands pixel on flat grass: a rock piece north of every vein, every boulder its own piece, the forest's flats a
 *  metre off the law's trees (test/fb1001_mining.test.js's). */
function pixelEntry() {
  const law = veins({ x: PX, y: PY, day: DAY, climate: WOODS, region: GLENUMBRA });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5);
  for (const b of boulders({ x: PX, y: PY, day: DAY, climate: WOODS })) {
    const x = b.u * TERRAIN_SIZE, z = b.v * TERRAIN_SIZE, g = groundAt(samples, x, z);
    rocks.push([x - 1.5, g - 1, z + 1, x + 1.5, g + 4, z + 4]);
  }
  const flats = trees({ x: PX, y: PY, day: DAY, climate: WOODS }).map((t, i) => ({ id: i, group: '504_12', i, x: t.u * TERRAIN_SIZE + 1, y: 0, z: t.v * TERRAIN_SIZE }));
  const batch = { archive: 504, record: 12, size: { w: 4, h: 8 } };
  const forest = { base: 504, archive: 504, trees: flats, groups: new Map([['504_12', { batch, centers: flats.map((f) => [f.x, f.y, f.z]), size: batch.size }]]) };
  return { px: PX, py: PY, samples, tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [], rocks, forest };
}

/** A player with the Sickle, the Basket, the Pick-Axe and the Wood-Axe, every profession at 100 and open, in the wild at
 *  the wild - and the gathering host over the pixel, its book a stand-in that records every harvest asked. */
async function stage() {
  let world = wild(12);
  const S = { asked: [], said: [], prompt: null, meter: null };
  S.e = { stats: { intelligence: 60, agility: 60, strength: 55, endurance: 50, luck: 50 }, items: [FT.Sickle, FT.Basket, FT.PickAxe, FT.WoodAxe].map((t) => createForagingItem(t)), wagonItems: [] };
  const book = {
    state: { open: true, today: {}, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }), askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }),
    harvest: (h) => { S.asked.push(h); return new Promise(() => {}); },
  };
  const feet = [400, 0, 400];
  const view = { yaw: 0, pitch: 0 };
  S.input = { held: false, attack: false, choice: false };
  const rad = Math.PI / 180;
  const eye = () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin(view.yaw * rad) * Math.cos(view.pitch * rad), Math.sin(view.pitch * rad), Math.cos(view.yaw * rad) * Math.cos(view.pitch * rad)] });
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, moveBillboardBatch: () => true };
  const entry = pixelEntry();
  const built = new Map([[`${PX},${PY}`, entry]]);
  S.host = createGatherHost({
    book, kinds: [herbKind({ book }), mineKind({ book }), treeKind({ book, renderer })],
    hud: {
      setPrompt: (p) => { S.prompt = p; }, setMeter: (a) => { S.meter = a ? a.state.kind : null; },
      toast: (t) => S.said.push(t), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {},
    },
    renderer, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON_MS,
    eye, view: () => view, feet: () => feet, entity: () => S.e,
    keyLabel: (a) => ({ Interact: 'E', ActChoice: 'Up' })[a] ?? '?', input: () => S.input,
    active: () => true, activeDungeon: () => false,
  });
  setForagingHost({ world: () => world, monthValue: () => 5, entity: () => null, startQuest: () => true, professionsOpen: () => true, keyLabel: () => 'E', professionUse: () => false });
  S.host.onBuilt(entry);
  await tick(); await tick();
  S.nodes = (kind) => S.host.nodesOf(PX, PY).filter((n) => n.kind === kind);
  /** Stand a metre and a half south of a node and look at its aim point; the host finds its target. */
  S.face = (n) => {
    const [x, y, z] = n.local;
    feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
    const a = aimAt([x, y + 1.6, z - 1.5], [x, y + (n.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
    view.yaw = -a.yaw; view.pitch = -a.pitch;
    S.host.tick(0.016);
  };
  /** E at the node: whether an act began, and its kind. */
  S.start = (n) => { S.face(n); S.said.length = 0; S.host.press(); S.host.tick(0.016); const kind = S.host.acting() ? S.meter : null; S.host.cancel(); return kind; };
  /** Where the player stands: the wild, or a settlement's ground (`type`, inside its footprint and the block round it). */
  S.at = (type) => { world = type === null ? wild(12) : { ...wild(12), locationType: type, inLocationRect: true }; };
  S.done = () => { S.host.dispose(); setForagingHost(null); };
  return S;
}

test('SETTLE-SAID: on a settlement\'s ground a vein, a boulder, an herb patch and a tree are no ready node - the prompt says so, E plays no act and says why, the tool\'s Use the same (mutants: the plan never asks; the dungeon\'s vein asked too)', async () => {
  const s = await stage();
  try {
    const vein = s.nodes('mine').find((n) => n.what === 'vein');
    const boulder = s.nodes('mine').find((n) => n.what === 'boulder');
    const tree = s.nodes('tree')[0];
    const patch = s.nodes('herb')[0];
    assert.ok(vein && boulder && tree && patch, 'a vein, a boulder, a tree and a patch stand');
    assert.deepEqual([...GROUND_WHERE], ['town']);
    for (const [n, verb, tool] of [[boulder, /^Quarry the stone$/, FT.PickAxe], [vein, /^Mine /, FT.PickAxe], [tree, /^Chop /, FT.WoodAxe], [patch, /^(Pick |Search)/, FT.Sickle]]) {
      for (const type of [LOCATION_TYPES.HomeFarms, LOCATION_TYPES.TownCity, LOCATION_TYPES.ReligionTemple]) {
        s.at(type);
        s.face(n);
        assert.match(s.prompt?.verb ?? '', verb);
        assert.equal(s.prompt?.rest, GROUND_WHERE_WORDS.town, `${n.key}: the prompt says it (${s.prompt?.verb} - ${s.prompt?.rest})`);
        s.said.length = 0;
        assert.equal(s.host.press(), false, 'E is not the node\'s - it goes on to the door, the chest or the foe');
        assert.equal(s.host.sayNeed(), true, 'and with nothing else opened, the node says why');
        assert.match(s.said.join(' | '), /: not in a settlement$/);
        s.host.tick(0.016);
        assert.equal(s.host.acting(), false, 'no act');
        s.said.length = 0;
        assert.equal(s.host.useTool(tool), 'taken', 'the tool\'s Use: the node\'s, nothing started');
        assert.match(s.said.join(' | '), /: not in a settlement$/, 'and said');
        assert.equal(s.host.acting(), false);
        assert.ok(!s.said.some((t) => /You cannot/.test(t)), 'never the act\'s refusal after a prompt that said it was ready');
      }
      // the wild: ready, and the act plays
      s.at(null);
      assert.ok(s.start(n), `${n.key}: in the wild the act starts`);
      assert.notEqual(s.prompt?.rest, GROUND_WHERE_WORDS.town);
      // a hut that is no settlement (a poor home), or outside the block round a farm: ready
      s.at(LOCATION_TYPES.HomePoor);
      assert.ok(s.start(n), `${n.key}: a poor home is no settlement`);
    }
    assert.deepEqual(s.asked, [], 'nothing was asked of the service');
  } finally { s.done(); }
});

test('SETTLE-SAID: a dungeon\'s vein asks no settlement - its act skips the surface\'s checks (DUNGEON_SKIP), and so does its plan', () => {
  const kind = mineKind({ book: { taken: () => false, counting: () => false, state: {} } });
  setForagingHost({ world: () => ({ ...wild(12), locationType: LOCATION_TYPES.TownCity, inLocationRect: true }), monthValue: () => 5, entity: () => null, startQuest: () => true });
  try {
    assert.equal(kind.where({ what: 'dvein' }), null);
    assert.equal(kind.where({ what: 'boulder' }), GROUND_WHERE_WORDS.town);
    assert.equal(kind.where({ what: 'vein' }), GROUND_WHERE_WORDS.town);
    assert.equal(herbKind({ book: { taken: () => false, counting: () => false } }).where({}), GROUND_WHERE_WORDS.town);
  } finally { setForagingHost(null); }
});
