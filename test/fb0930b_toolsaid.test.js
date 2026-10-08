// FIELD BUGS 2026-09-30b (TOOL-SAID, then TOOL-USE) - three players, one fault: "I've been chopping wood but it doesn't
// look like anything about the logging profession is changing"; "I've been using my sickle to gather herbs in the wild,
// but I dont get any exp towards the herbology skill"; "I fish, or use the axe and I get no exp ... I just physically get
// lumber in the misc tab. Is using the tools in the wilderness via use/hotkey not how you gain exp?" ("Skinning is
// working though" - the Skinning Knife has no Use: a body is its only gesture).
//
// Online, a tool used from the pack, the hotbar or a quick slot was Foraging's own gesture (FORAGE0 law 4): the mod's
// yields into the pack, its quest and its wait page, its wear - and no profession. The professions gathered only at
// their nodes, by E. TOOL-SAID kept the mod's use (law 1) and said so after its words. The owner, 2026-09-30: "I dont
// care about DFU. We're our own thing now." TOOL-USE: online, while the professions are the account's, the Wood-Axe,
// the Pick-Axe, the Sickle, the Basket and the Fishing-Net are the professions' tools. Used from the hotbar or a quick
// slot at a node of their own kind they do what E does there (scenes/gatherHost.js useTool - the act, or what the node
// needs): the axe fells the tree, the pick mines the vein, the Sickle picks the herbs and the Basket searches for food
// (whatever the choice key picked, which stays as it was), the net casts. Anywhere else, and from the open pack (its
// window holds the world off), the Use gives none of the mod's yields, quests or wear: it says where the profession is
// done, and that the tool's Use there works too. Offline and a guest's lane are the mod's 1:1; the Spade is Foraging's
// alone. The real useItem, hotbarPress -> useQuickslot and useResultAction over `?online=1`, the real gathering host
// and its four kinds over a stand-in book, and the Professions page's words.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  setForagingHost, createForagingItem, installForaging, _setForagingRandomForTests, professionToolLine, PROFESSION_TOOL_HOW,
} from '../src/systems/foragingInstall.js';
import { FT, FORAGING_REFUSALS } from '../src/systems/foragingLaw.js';
import { useItem, usableItem } from '../src/systems/useItem.js';
import * as qs from '../src/systems/quickslots.js';
import { useResultAction } from '../src/ui/enhancedInventory.js';
import { registerPresenter } from '../src/systems/notify.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { FATIGUE_MULTIPLIER } from '../src/systems/statMods.js';
import { GATHER_HOW, STORES_EMPTY_LINE, STORES_EMPTY_CARRY_LINE } from '../src/ui/profPages.js';
import { createGatherHost, aimAt, ACT_STOPPED_LINE } from '../src/scenes/gatherHost.js';
import { herbKind, SICKLE_HAND } from '../src/scenes/herbHost.js';
import { mineKind, PICK_HAND } from '../src/scenes/mineHost.js';
import { treeKind, AXE_HAND } from '../src/scenes/treeHost.js';
import { fishKind } from '../src/scenes/fishHost.js';
import { trees, veins, dungeonVeins, utcDayOfMs } from '../src/net/nodeLaw.js';
import { CHOP_ACT, FISH_ACT, HERB_ACT } from '../src/net/professionLaw.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { resolveHover } from '../src/systems/worldHover.js';
import { foldQuickLoot, plaqueStep, plaqueActionFor } from '../src/systems/quickLoot.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';

const heard = [];
registerPresenter({ hudText: (l) => { heard.push(l); return true; }, popupMessage: (l) => { heard.push(`POPUP ${l}`); return true; }, priority: 99 });
installForaging({ fetchBytes: async () => new Uint8Array(0) });

const WOODS = CLIMATES.Woodlands, GLENUMBRA = 59;
const WILD = Object.freeze({ inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour: 12, climate: WOODS, region: 17, enemiesNear: false, carriedWeight: 10, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' });
const player = () => ({ stats: { intelligence: 62, strength: 55, agility: 50, endurance: 50, luck: 45 }, items: [], wagonItems: [], fatigue: 40 * FATIGUE_MULTIPLIER, health: 20, maxHealth: 100, magicka: 5, maxMagicka: 50 });
const CHOP = 'You were able to chop and gather three Wood Bundles!';
const PROFESSION_TOOLS = Object.freeze([FT.WoodAxe, FT.PickAxe, FT.Sickle, FT.Basket, FT.FishingNet]);
const tick = () => new Promise((r) => setImmediate(r));

/** The stood pixel: Woodlands, flat grass (every patch stands), a rock piece north of every vein, and the forest's tree
 *  flats a metre off the law's trees (test/prof4_client.test.js's forest); day 20500 at noon UTC. */
const PX = 405, PY = 150;
const NOON_MS = (20500 * 86_400 + 43_200) * 1000;
const DAY = utcDayOfMs(NOON_MS);
/** Nothing of any kind within 50 m of here. */
const CLEARING = Object.freeze([400, 0, 400]);
/** The dungeon of 29h's report: nobody confirmed it, so every vein is its least - Silver, tier 3 (VEIN-NEED's). */
const DUNGEON = 88;
const wall = (marker, bearing) => [Math.sin(bearing) * 2, 1.2, Math.cos(bearing) * 2];
function pixelEntry() {
  const law = veins({ x: PX, y: PY, day: DAY, climate: WOODS, region: GLENUMBRA });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const flats = trees({ x: PX, y: PY, day: DAY, climate: WOODS }).map((t, i) => ({ id: i, group: '504_12', i, x: t.u * TERRAIN_SIZE + 1, y: 0, z: t.v * TERRAIN_SIZE }));
  const batch = { archive: 504, record: 12, size: { w: 4, h: 8 } };
  const forest = { base: 504, archive: 504, trees: flats, groups: new Map([['504_12', { batch, centers: flats.map((f) => [f.x, f.y, f.z]), size: batch.size }]]) };
  return {
    px: PX, py: PY, samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5), tilemap: new Uint8Array(128 * 128).fill(2),
    locationRect: null, batches: [], rocks, forest,
  };
}

/**
 * A player online (or not) with the five profession tools in the pack, the professions open (or not), in the wild at
 * noon - and the gathering host over the pixel (or, `under`, 29h's dungeon), its book a stand-in that records every
 * harvest asked. Foraging's host is world.js's: the world, the quests a Use starts, and `professionUse` the gathering
 * host's `useTool`.
 */
async function stage({ online = true, open = true, world = {}, rank = 100, under = false } = {}) {
  _resetModSettings(); heard.length = 0; qs.clearHotbar();
  globalThis.location = { search: online ? '?online=1' : '' };
  const S = { started: [], asked: [], said: [], taken: new Set(), counting: new Set(), rank, window: false, meter: null, prompt: null, used: 0, steps: [] };
  S.world = { ...WILD, ...(under ? { inside: true, insideDungeon: true } : {}), ...world };
  S.e = player();
  S.tools = Object.fromEntries([...PROFESSION_TOOLS, FT.Spade].map((t) => [t, createForagingItem(t)]));
  S.e.items.push(...[...PROFESSION_TOOLS, FT.Spade].map((t) => S.tools[t]));
  const fresh = Object.fromEntries(PROFESSION_TOOLS.map((t) => [t, S.tools[t].currentCondition]));
  const book = S.book = {
    state: { open: true, today: {}, hauls: 0, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }), askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0,
    taken: (k, h) => S.taken.has(`${k}|${h}`), counting: (k, h) => S.counting.has(`${k}|${h}`),
    track: () => ({ rank: S.rank, specs: { 50: null, 100: null } }),
    harvest: (h) => { S.asked.push(h); return new Promise(() => {}); },   // asked; the answer is the service's, not this pin's
  };
  const feet = [...CLEARING];
  const view = { yaw: 0, pitch: 0 };
  S.input = { held: false, attack: false, choice: false };
  const rad = Math.PI / 180;
  const eye = () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin(view.yaw * rad) * Math.cos(view.pitch * rad), Math.sin(view.pitch * rad), Math.cos(view.yaw * rad) * Math.cos(view.pitch * rad)] });
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, moveBillboardBatch: () => true };
  const entry = pixelEntry();
  const built = new Map([[`${PX},${PY}`, entry]]);
  S.host = createGatherHost({
    book, kinds: [herbKind({ book }), mineKind({ book }), treeKind({ book, renderer }),
      fishKind({ book, host: {
        pixel: () => ({ x: PX, y: PY }), ground: () => ({ climate: WOODS, region: GLENUMBRA }), eye, feet: () => feet, hour: () => 12,
        storm: () => false, climateAt: () => WOODS, trophy: () => false, day: () => DAY,
      } })],
    hud: {
      setPrompt: (p) => { S.prompt = p; }, setMeter: (a, label, o) => { S.meter = a ? { kind: a.state.kind, label, act: a, byUse: o?.byUse === true } : null; },
      toast: (t) => S.said.push(t), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {},
    },
    renderer, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON_MS,
    eye, view: () => view, feet: () => feet, entity: () => S.e,
    keyLabel: (a) => ({ Interact: 'E', ActChoice: 'Up' })[a] ?? '?', input: () => S.input,
    active: () => !under && !S.window, activeDungeon: () => under && !S.window,
    // PROF-MENU: the plaque's seams, each off unless a pin sets it
    plaque: () => !!S.plaque, lit: () => S.lit ?? null, choose: (rows, pick) => (S.choose ? S.choose(rows, pick) : false), step: (n) => { S.steps.push(n); return true; },
  });
  setForagingHost({
    world: () => S.world, monthValue: () => 5, entity: () => null, startQuest: (n) => { S.started.push(n); return true; },
    professionsOpen: () => open, keyLabel: (a) => (a === 'Interact' ? 'E' : a === 'ActChoice' ? 'Up' : null),
    professionUse: (t) => { S.used++; return S.host.useTool(t); },
  });
  _setForagingRandomForTests(() => 0.99);   // the best draw of every table: Foraging, where it is asked, always yields
  if (under) S.host.enterDungeon({ id: DUNGEON, climate: WOODS, region: GLENUMBRA, wall, stand: async () => ({}), drop: () => {} });
  else S.host.onBuilt(entry);
  await tick(); await tick();
  /** The stood nodes of a kind (the pixel's; underground, the dungeon's veins as the law and its wall stand them). */
  S.nodes = (kind) => (under
    ? dungeonVeins({ dungeon: DUNGEON, day: DAY, climate: WOODS, confirmed: false }).map((v) => ({ key: `dvein:${DUNGEON}:${DAY}:${v.slot}`, local: wall(v.marker, v.bearing), lift: 0.4, tier: v.tier }))
    : S.host.nodesOf(PX, PY).filter((n) => n.kind === kind));
  /** A node stood again at another tier (audit29's way: the host's own list, the node replaced). */
  S.retier = (n, tier) => { const list = S.host.nodesOf(PX, PY); const m = { ...n, tier }; list.splice(list.indexOf(n), 1, m); return m; };
  /** Stand a metre and a half south of a node and look at it; the host finds its target. */
  S.face = (n) => {
    const [x, y, z] = n.local;
    feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
    const a = aimAt([x, y + 1.6, z - 1.5], [x, y + (n.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
    view.yaw = -a.yaw; view.pitch = -a.pitch;
    S.host.tick(0.016);
  };
  S.away = () => { feet.splice(0, 3, ...CLEARING); view.yaw = 0; view.pitch = 0; S.host.tick(0.016); };
  /** The hotbar's press on the tool (hotbarPress -> the quick use door -> useQuickslot -> useItem, world.js's route). */
  S.hotbar = (t) => {
    qs.clearHotbar();
    qs.setHotbarSlot(0, qs.hotbarEntryForItem(S.tools[t]));
    const said = [];
    const doors = { quickUse: (n) => { qs.useQuickslot(n === 1 ? 'c1' : 'c2', { entity: S.e, items: S.e.items, hooks: {}, say: (l) => said.push(l) }); return true; } };
    const res = qs.hotbarPress(0, { entity: S.e, doors, say: (l) => said.push(l) });
    qs.clearHotbar();
    return { kind: res.kind, said };
  };
  /** The pack's Use (enhancedInventory, nativeInventory: the one use seam). */
  S.pack = (t) => useItem(S.tools[t], S.e.items, { entity: S.e });
  /** The frames of an act played through - `every` the input each frame, `dt` its length - to its end or `s` seconds. */
  S.play = (every, dt = 0.1, s = 20) => { for (let t = 0; t < s && S.host.acting(); t += dt) { S.input = every(t); S.host.tick(dt); } S.input = { held: false, attack: false, choice: false }; };
  /** The chop, as test/prof4_client.test.js plays it: attack as the ring meets the notch. */
  S.chop = () => { for (let i = 0; i < 20 && S.host.acting(); i++) { S.input = { held: false, attack: false, choice: false }; S.host.tick(CHOP_ACT.ringS); S.input = { held: false, attack: true, choice: false }; S.host.tick(0.001); } S.input = { held: false, attack: false, choice: false }; };
  /** Every strike its own swing. */
  S.strike = () => S.play((t) => ({ held: false, attack: Math.round(t * 10) % 5 === 0, choice: false }), 0.1, 10);
  /** Nothing of Foraging's: no yield in the pack, no quest, no wear. */
  S.untouched = (why) => {
    assert.deepEqual(S.e.items.map((i) => i.templateIndex), [...PROFESSION_TOOLS, FT.Spade], `${why}: nothing into the pack`);
    assert.deepEqual(S.started, [], `${why}: no Foraging quest (no wait page)`);
    for (const t of PROFESSION_TOOLS) assert.equal(S.tools[t].currentCondition, fresh[t], `${why}: no wear on ${t}`);
  };
  S.done = () => { S.host.dispose(); _setForagingRandomForTests(null); setForagingHost(null); delete globalThis.location; qs.clearHotbar(); };
  return S;
}
const lineOf = (t) => PROFESSION_TOOL_HOW[t]('E', 'Up');

test('TOOL-USE: the report, answered - the hotbar\'s Wood-Axe at a tree starts the act E starts there, and the tree\'s logs are asked of the service; no Wood Bundles, no ChopWoodQuest, no Foraging wear', async () => {
  const use = await stage();
  let oak, seen;
  try {
    oak = use.nodes('tree').find((n) => n.material === 'log:oak');
    use.face(oak);
    assert.equal(use.prompt?.verb, 'Chop Oak', 'the prompt E answers');
    assert.deepEqual(use.hotbar(FT.WoodAxe), { kind: 'used', said: [] }, 'the slot strikes gold and says nothing - the meter is the act\'s');
    assert.equal(use.host.acting(), true, 'the act started');
    assert.deepEqual(heard, [], 'no line, no Foraging words');
    use.untouched('the Use');
    use.host.tick(0.016);
    assert.equal(use.meter?.kind, 'chop', 'the Wood-Axe\'s ring');
    assert.deepEqual({ ...use.host.handTool(), state: 'Idle', frame: 0 }, { ...AXE_HAND, state: 'Idle', frame: 0 }, 'DFU\'s War Axe in the hand');
    use.chop();
    assert.deepEqual(use.asked.map((h) => [h.node, h.kind]), [[oak.key, 'logs']], 'the tree\'s logs asked - the Logging XP is its answer');
    assert.equal(use.tools[FT.WoodAxe].currentCondition, 49, 'the act\'s end wore the axe by one, as E\'s does (FORAGE0 14.1)');
    seen = { act: 'chop', asked: use.asked.map((h) => [h.node, h.kind]) };
  } finally { use.done(); }
  // E at the same tree: the same act, the same ask
  const key = await stage();
  try {
    key.face(key.nodes('tree').find((n) => n.key === oak.key));
    assert.equal(key.host.press(), true);
    key.host.tick(0.016);
    assert.equal(key.meter?.kind, seen.act);
    key.chop();
    assert.deepEqual(key.asked.map((h) => [h.node, h.kind]), seen.asked, 'E-equivalent');
  } finally { key.done(); }
});

test('TOOL-USE: at an herb patch the Sickle picks the herbs and the Basket searches for food (PROF-MENU: both the patch\'s list, its prompt the choice where no plaque stands); the Sickle\'s Use holds the steady hand; a tool\'s own harvest taken says so, never the other\'s act', async () => {
  const s = await stage();
  try {
    const patch = s.retier(s.nodes('herb')[0], 2);   // a Sickle's patch: the steady hand
    const name = templateByIndex(patch.herb).name;
    s.face(patch);
    assert.deepEqual([s.prompt?.verb, s.prompt?.rest], ['Choose', `Pick ${name} / Search with the Basket`], 'PROF-MENU: no plaque - the prompt says the choice E opens');
    // the Sickle: the herbs
    assert.equal(s.hotbar(FT.Sickle).kind, 'used');
    s.host.tick(0.016);
    assert.deepEqual([s.meter?.kind, s.host.handTool()], ['steady', SICKLE_HAND], 'the steady hand, DFU\'s Tanto in it');
    s.host.cancel();
    s.host.tick(0.016);
    assert.equal(s.prompt?.verb, 'Choose', 'the choice as it stood');
    s.hotbar(FT.Sickle);
    s.play(() => ({ held: false, attack: false, choice: false }), 0.1, HERB_ACT.steadyS + 1);   // E never held: the Use holds it
    assert.deepEqual(s.asked.map((h) => [h.node, h.kind, h.act?.clean]), [[patch.key, 'herbs', true]], 'the herbs, kept still: unbruised');
    assert.equal(s.tools[FT.Sickle].currentCondition, 49, 'the act wore the Sickle');
    // the Basket at a fresh patch, the choice on the herbs: the food, the choice unmoved
    const other = s.nodes('herb')[1];
    s.face(other);
    assert.equal(s.prompt?.rest, `Pick ${templateByIndex(other.herb).name} / Search with the Basket`);
    assert.equal(s.hotbar(FT.Basket).kind, 'used');
    s.host.tick(0.016);
    assert.deepEqual([s.meter?.kind, s.meter?.label], ['basket', 'click the glint']);   // PIN MOVED (AUDIT HERB-CURSOR C3): the cursor is free to click it
    s.host.cancel();
    s.host.tick(0.016);
    assert.equal(s.prompt?.rest, `Pick ${templateByIndex(other.herb).name} / Search with the Basket`, 'the choice still both');
    s.hotbar(FT.Basket);
    s.play(() => ({ held: false, attack: false, choice: false }));
    assert.deepEqual(s.asked.slice(1).map((h) => [h.node, h.kind]), [[other.key, 'food']]);
    assert.deepEqual(s.started, [], 'no Foraging quest');
    assert.deepEqual(heard.filter((l) => !l.startsWith('POPUP')), [], 'no line');
    // a tool's own harvest gone: it says so and starts nothing - E there still takes the other
    s.said.length = 0;
    s.taken.add(`${other.key}|herbs`);
    s.face(other);
    assert.deepEqual(s.hotbar(FT.Sickle), { kind: 'refused', said: [] });
    assert.equal(s.host.acting(), false, 'never the Basket\'s act');
    assert.deepEqual(s.said, [`Pick ${templateByIndex(other.herb).name}: gathered today`]);
    assert.equal(s.host.press(), true, 'E there: the Basket, as ever');
    s.host.tick(0.016);
    assert.equal(s.meter?.kind, 'basket');
    s.host.cancel();
    s.said.length = 0;
    s.taken.delete(`${other.key}|herbs`);
    s.taken.add(`${other.key}|food`);
    s.face(other);
    s.hotbar(FT.Basket);
    assert.equal(s.host.acting(), false);
    assert.deepEqual(s.said, ['Search with the Basket: gathered today'], 'the Basket\'s own words, never the herbs\' act');
    s.said.length = 0;
    s.taken.delete(`${other.key}|food`);
    s.counting.add(`${other.key}|herbs`);
    s.hotbar(FT.Sickle);
    assert.deepEqual(s.said, ['That gathering is being counted.']);
    // E's steady hand is still E's hold: let go, it ends
    s.counting.clear();
    const third = s.retier(s.nodes('herb')[2], 2);
    s.face(third);
    s.said.length = 0;
    assert.equal(s.host.press(), true);
    s.host.tick(0.016);
    assert.equal(s.host.acting(), false, 'E let go before the end: nothing lost');
    assert.deepEqual(s.said, [ACT_STOPPED_LINE]);
  } finally { s.done(); }
});

test('TOOL-USE: the Pick-Axe at a vein mines it - in the wild, and underground (29h\'s report 2: "if i use the pick axe it says \'you cannot mine in here!\'"), where a rank short is said with the player\'s own', async () => {
  const s = await stage();
  try {
    const vein = s.nodes('mine').find((n) => n.what === 'vein');
    s.face(vein);
    assert.equal(s.hotbar(FT.PickAxe).kind, 'used');
    s.host.tick(0.016);
    assert.equal(s.meter?.kind, 'mine');
    assert.deepEqual({ ...s.host.handTool(), state: 'Idle', frame: 0 }, { ...PICK_HAND, state: 'Idle', frame: 0 }, 'DFU\'s Warhammer');
    s.strike();
    assert.deepEqual(s.asked.map((h) => [h.node, h.kind]), [[vein.key, 'ore']]);
    assert.deepEqual(s.started, []);
    assert.deepEqual(heard.filter((l) => !l.startsWith('POPUP')), []);
  } finally { s.done(); }
  for (const rank of [0, 25]) {
    const d = await stage({ under: true, rank });
    try {
      const silver = d.nodes('mine')[0];
      assert.equal(silver.tier, 3, 'an unconfirmed dungeon: Silver');
      d.face(silver);
      const r = d.hotbar(FT.PickAxe);
      assert.deepEqual(heard, [], `rank ${rank}: "You cannot mine in here!" is not said`);
      if (rank === 0) {
        assert.deepEqual([r.kind, d.host.acting(), d.said], ['refused', false, ['Mine Silver: needs Mining 25 - your Mining is 0']], 'the vein says what it needs, at once');
      } else {
        assert.equal(r.kind, 'used');
        d.host.tick(0.016);
        assert.equal(d.meter?.kind, 'mine', 'Mining 25: the Silver is worked');
      }
      d.untouched(`underground, rank ${rank}`);
    } finally { d.done(); }
  }
});

test('TOOL-USE: the Fishing-Net in the water casts - a tap of E: no wind held, the net flies its shortest, and E takes the tug; out of the water it says where fishing is done', async () => {
  const s = await stage({ world: { swimming: true, exteriorWater: 'Swimming' } });
  try {
    s.away();   // a lake, nothing else near: the cast stands ahead of the look
    assert.equal(s.prompt?.verb, 'Cast the net');
    assert.equal(s.hotbar(FT.FishingNet).kind, 'used');
    s.host.tick(0.016);
    assert.deepEqual([s.meter?.kind, s.meter?.label, s.meter?.act.state.phase, s.meter?.act.state.throwM], ['fish', 'E', 'fly', FISH_ACT.throwMinM]);
    s.untouched('the cast');
    assert.deepEqual(heard, []);
    s.host.cancel();
    s.world = { ...WILD };
    s.host.tick(0.016);
    assert.deepEqual(s.hotbar(FT.FishingNet), { kind: 'refused', said: [] });
    assert.deepEqual(heard, [lineOf(FT.FishingNet)]);
  } finally { s.done(); }
});

test('TOOL-USE: no node of its own kind in reach - each of the five says where its profession is done (and that its Use there works), gives nothing, starts no quest, wears nothing; the Wood-Axe at an herb patch is no Use of the patch\'s; a Use during an act is the act\'s; a node\'s checks refuse in their own words', async () => {
  const s = await stage();
  try {
    for (const t of PROFESSION_TOOLS) {
      heard.length = 0;
      assert.deepEqual(s.hotbar(t), { kind: 'refused', said: [] }, `${t}: the slot flashes the refusal`);
      assert.deepEqual(heard, [lineOf(t)], `${t}: the HUD says the line`);
      assert.doesNotMatch(lineOf(t), /XP from this/, 'nothing was gathered to earn it');
    }
    s.untouched('the clearing');
    assert.match(lineOf(FT.WoodAxe), /^Logging is done at a tree in the wilderness: walk up to one until its acts show, then press E \(or use the Wood-Axe\)\./);   // PROF-MENU: its acts - the plaque's list, or the prompt
    assert.match(lineOf(FT.PickAxe), /ore vein or a boulder .* press E \(or use the Pick-Axe\)\.$/);
    assert.match(lineOf(FT.Sickle), /herb patch .* press E \(or use the Sickle\)\.$/);
    assert.match(lineOf(FT.Basket), /herb patch in the wilderness for food: .* then use the Basket \(or choose Search with the Basket on the list and press E\)\.$/);   // PROF-MENU: the list, not the act choice key
    assert.match(lineOf(FT.FishingNet), /^Fishing is done in water: .* press E \(or use the Fishing-Net\)\.$/);   // PIN MOVED (ANY-HOUR): "in water by daylight" - at any hour now
    // the Wood-Axe at a patch: the patch is Herbalism's
    heard.length = 0;
    s.face(s.nodes('herb')[0]);
    assert.equal(s.hotbar(FT.WoodAxe).kind, 'refused');
    assert.deepEqual([s.host.acting(), heard], [false, [lineOf(FT.WoodAxe)]]);
    // during an act, the Use is the act's - nothing more, nothing said; the Spade is no profession tool of the host's
    s.face(s.nodes('tree')[0]);
    s.hotbar(FT.WoodAxe);
    s.host.tick(0.016);
    const act = s.meter?.act;
    heard.length = 0; s.said.length = 0;
    assert.equal(s.hotbar(FT.WoodAxe).kind, 'refused');
    s.host.tick(0.016);
    assert.deepEqual([s.meter?.act === act, heard, s.said], [true, [], []], 'the same act, untouched');
    assert.equal(s.host.useTool(FT.Spade), false);
    s.host.cancel();
    // the node's checks refuse in their own words - Foraging's, the act's first (FORAGE0 14.3)
    s.world = { ...WILD, enemiesNear: true };
    heard.length = 0; s.said.length = 0;
    assert.equal(s.hotbar(FT.WoodAxe).kind, 'refused');
    assert.deepEqual([s.host.acting(), s.said, heard], [false, [FORAGING_REFUSALS[FT.WoodAxe].enemies], []]);
    // the professions shut on the book: the host takes no Use
    s.world = { ...WILD };
    s.book.state.open = false;
    assert.equal(s.host.useTool(FT.WoodAxe), false);
    s.untouched('every refusal');
  } finally { s.done(); }
});

test('TOOL-USE: the open pack\'s Use - its window holds the world off - says the line in its box, whatever node is under the look; indoors Foraging\'s refusal is not said either', async () => {
  const s = await stage();
  try {
    s.face(s.nodes('tree')[0]);
    s.window = true;
    const r = s.pack(FT.WoodAxe);
    assert.deepEqual([r?.refused, r?.text], [true, lineOf(FT.WoodAxe)]);
    assert.equal(useResultAction(r).text, lineOf(FT.WoodAxe), 'the open pack shows it');
    assert.deepEqual(heard, [lineOf(FT.WoodAxe)]);
    assert.equal(s.host.acting(), false, 'no act under a window');
    s.untouched('the pack');
    s.window = false;
    s.world = { ...WILD, inside: true };
    heard.length = 0;
    s.pack(FT.PickAxe);
    assert.deepEqual(heard, [lineOf(FT.PickAxe)], 'the line alone - "You cannot mine in here!" was Foraging\'s');
  } finally { s.done(); }
});

test('TOOL-USE keeps the lanes: offline, and online with the professions closed (a guest), the Wood-Axe is Foraging\'s 1:1 and the gathering host is never asked; online the Spade robs the grave, Foraging\'s alone', async () => {
  for (const o of [{ online: false, open: true }, { online: true, open: false }]) {
    const s = await stage(o);
    try {
      s.face(s.nodes('tree')[0]);
      const r = s.pack(FT.WoodAxe);
      assert.equal(r?.text, CHOP, JSON.stringify(o));
      assert.equal(s.e.items.filter((i) => i.templateIndex === FT.WoodBundle).length, 3);
      assert.deepEqual(s.started, ['ChopWoodQuest']);
      assert.equal(s.tools[FT.WoodAxe].currentCondition, 49);
      assert.equal(s.hotbar(FT.WoodAxe).kind, 'used', 'the hotbar\'s too');
      assert.deepEqual([s.used, s.host.acting()], [0, false], 'the professions are not asked');
      assert.equal(professionToolLine(FT.WoodAxe), null);
      setModSetting('foraging', 'Enabled', false);
      assert.equal(usableItem(s.tools[FT.WoodAxe]), false, `${JSON.stringify(o)}: the switch off, the tool is inert`);
    } finally { s.done(); }
  }
  const s = await stage({ world: { locationType: LOCATION_TYPES.Graveyard, inLocationRect: true } });
  try {
    const r = s.pack(FT.Spade);
    assert.match(s.started[0] ?? '', /^GraveRobbingQuest/, 'the Spade robs the grave (FORAGE0 14.2, 14.8)');
    assert.equal(r?.text ?? null, null);
    assert.deepEqual([professionToolLine(FT.Spade), s.used], [null, 0]);
    // PIN MOVED (2026-10-01 part four, TOUCH-HOLD - Mac: "Interact button + knife Use"): and the Skinning Knife's, 603
    assert.deepEqual(Object.keys(PROFESSION_TOOL_HOW).map(Number).sort((a, b) => a - b), [...PROFESSION_TOOLS, 603].sort((a, b) => a - b));
  } finally { s.done(); }
});

test('TOOL-USE: Foraging switched off online - the card still offers Use, and the tools are still the professions\' (law 6): the act at a tree, the line away from one', async () => {
  const s = await stage();
  try {
    setModSetting('foraging', 'Enabled', false);
    assert.equal(usableItem(s.tools[FT.Sickle]), true, 'the card offers Use');
    s.face(s.nodes('tree')[0]);
    assert.equal(s.hotbar(FT.WoodAxe).kind, 'used');
    assert.equal(s.host.acting(), true);
    s.host.cancel();
    s.away();
    const r = s.pack(FT.Sickle);
    assert.deepEqual([r?.refused, heard], [true, [lineOf(FT.Sickle)]]);
    s.untouched('the switch off');
  } finally { s.done(); }
});

test('TOOL-USE: the world host hands Foraging the professions, the keys, and the tool\'s Use to the gathering host (world.js setForagingHost)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const at = w.indexOf('setForagingHost({');
  assert.ok(at > 0);
  const host = w.slice(at, w.indexOf('\n  });', at));
  assert.match(host, /professionsOpen: \(\) => profBook\?\.state\.open === true,/);
  // PIN MOVED (2026-10-01 part four, TOUCH-HOLD): the key as the hand holds it - a pad in hand, its button (world.js
  // actKeyWord, pinned whole in test/fb1001_touchhold.test.js); else the key, as before
  assert.match(host, /keyLabel: \(a\) => actKeyWord\(a\),/);
  assert.match(host, /\n {4}professionUse: \(t\) => gatherHost\?\.useTool\(t\) \?\? false,/);
});

test('TOOL-USE: the Professions page says a tool\'s Use at the node is the key\'s and from the pack only points the way; the empty Stores say where their goods come from', () => {
  assert.match(GATHER_HOW.herbalism, /herb patch/);
  assert.match(GATHER_HOW.mining, /ore vein or a boulder/);
  assert.match(GATHER_HOW.logging, /tree/);
  assert.match(GATHER_HOW.herbalism, /The Sickle or Basket also works from your hotbar or a quick slot\. Used from your pack, a tool just tells you where it works\.$/);
  assert.match(GATHER_HOW.mining, /It also works from your hotbar or a quick slot\. Used from your pack, a tool just tells you where it works\.$/);
  assert.match(GATHER_HOW.logging, /It also works from your hotbar or a quick slot\. Used from your pack, a tool just tells you where it works\.$/);
  for (const k of ['herbalism', 'mining', 'logging']) assert.doesNotMatch(GATHER_HOW[k], /Foraging|earns no XP/);
  // PIN MOVED (2026-10-01 part four, TOUCH-HOLD): and the Skinning Knife's Use
  assert.match(STORES_EMPTY_LINE, /or use the matching tool from your hotbar or a quick slot\. Tools used from your pack gather nothing\.$/);
  const src = readFileSync(new URL('../src/ui/profPages.js', import.meta.url), 'utf8');
  assert.match(src, /if \(GATHER_HOW\[_sel\]\) pane\.append\(el\('p', 'px-note', GATHER_HOW\[_sel\]\)\);/);
  assert.match(src, /: STORES_EMPTY_LINE\)\);/);
  // AUDIT (2026-10-04): PROF-MENU retired the act choice key's search - the patch's and the body's lists carry it now; and
  // BAG1's page says where a carrying book's goods go (the bag or the pack), not the Stores
  assert.doesNotMatch(GATHER_HOW.herbalism, /act choice key/);
  assert.match(GATHER_HOW.herbalism, /the patch's list also lets you search it for food/);
  assert.doesNotMatch(src, /act choice key searches/);
  assert.match(src, /The body\\'s list also lets you search it\.'\)\);/);
  assert.match(STORES_EMPTY_CARRY_LINE, /goes into your Materials Bag or pack - put it in here in any town\.$/);
  assert.match(src, /all\.size \? 'Nothing in the Stores matches\.' : STORES_EMPTY_CARRY_LINE\)\);/);
});

// ─── PROF-MENU (2026-10-01, Mac: "They should use the same menu the loot menu uses and not an interaction button") ───
/** The plaque's frame for the host's node, as the hosts resolve it (worldHover resolveHover over the host's own namer). */
const plaqueOf = (s, ray = null) => resolveHover(s.host.hoverHit(ray), { name: (k) => s.host.hoverName(k) });

test('PROF-MENU: a patch IS the loot plaque\'s list - named, its herbs and its Basket the rows, the first lit, no prompt beside it; the lit row is what E presses, and a click presses it too, held by the press as a tool\'s Use holds it; a click with no lit row of the node\'s is not the node\'s (mutants: the prompt kept, the lit row unread, the click unheld)', async () => {
  const s = await stage();
  try {
    const patch = s.retier(s.nodes('herb')[0], 2);   // a Sickle's patch: the steady hand
    const name = templateByIndex(patch.herb).name;
    s.plaque = true;
    s.face(patch);
    assert.equal(s.prompt, null, 'the plaque names it - no prompt');
    const f = plaqueOf(s);
    assert.deepEqual([f.kind, f.key, f.title, f.subs, f.rows.map((r) => [r.id, r.name, r.disabled]), f.startRow ?? 0],
      ['actions', `prof:${patch.key}`, name, ['Herbalism 100'], [['herbs', `Pick ${name}`, false], ['food', 'Search with the Basket', false]], 0]);
    s.lit = 'food';
    assert.equal(s.host.press(), true);
    s.host.tick(0.016);
    assert.equal(s.meter?.kind, 'basket', 'the lit row: the Basket');
    s.host.cancel();
    s.lit = null;
    assert.deepEqual([s.host.press({ click: true }), s.host.acting()], [false, false], 'a click with nothing of the node\'s lit is the ladder\'s');
    s.lit = 'herbs';
    assert.equal(s.host.press({ click: true }), true);
    s.host.tick(0.016);
    assert.deepEqual([s.meter?.kind, s.meter?.byUse, s.meter?.label], ['steady', true, ''], 'the click\'s steady hand: held by the press, no key named');
    s.play(() => ({ held: false, attack: false, choice: false }), 0.1, HERB_ACT.steadyS + 1);
    assert.deepEqual(s.asked.map((h) => [h.node, h.kind, h.act?.clean]), [[patch.key, 'herbs', true]], 'no key held, kept still: unbruised');
  } finally { s.done(); }
});

test('PROF-MENU: a refused row says why - the herbs gathered, the Basket lit first; a row whose label says it carries no "(not now)"; a node with nothing to press yields the plaque to the ray\'s own winner in reach, and lists its refusals where none stands (mutants: refusals hidden, the start not the first pressable, the yield lost)', async () => {
  const s = await stage();
  try {
    const patch = s.nodes('herb')[0];
    const name = templateByIndex(patch.herb).name;
    s.plaque = true;
    s.taken.add(`${patch.key}|herbs`);
    s.face(patch);
    let f = plaqueOf(s);
    assert.deepEqual([f.rows.map((r) => [r.name, r.disabled]), f.startRow], [[[`Pick ${name} (gathered today)`, true], ['Search with the Basket', false]], 1]);
    // a row whose label already says it: drawn bare
    assert.equal(resolveHover({ key: 'k', distance: 1, reach: 2 }, { name: () => ({ title: 'T', actions: [{ id: 'herbs', label: `${name} - gathered today`, disabled: true, why: '' }] }) }).rows[0].name, `${name} - gathered today`);
    // a row refused for want of a tool: nothing to press, and a door in reach takes the plaque
    s.taken.clear();
    s.e.items = s.e.items.filter((i) => i !== s.tools[FT.Basket] && i !== s.tools[FT.Sickle]);
    const rare = s.retier(s.nodes('herb')[1], 2);
    s.face(rare);
    f = plaqueOf(s);
    assert.deepEqual(f.rows.map((r) => [r.name, r.disabled]), [[`Pick ${templateByIndex(rare.herb).name} (needs a Sickle)`, true], ['Search with the Basket (needs a Basket)', true]]);
    assert.equal(s.host.hoverHit({ key: 'door', distance: 1.2, reach: 3 }), null, 'a door in reach: the plaque the door\'s, as the press is');
    assert.ok(s.host.hoverHit({ key: 'door', distance: 9, reach: 3 }), 'a door out of reach: the node\'s refusals stand');
  } finally { s.done(); }
});

test('PROF-MENU: where no plaque stands the prompt says the choice and E opens it as a list - a pick from it starts that act, held by the press; a list that cannot open leaves E the first act, as before (mutants: the list never opened, the pick not the row, the fallback lost)', async () => {
  const s = await stage();
  try {
    const patch = s.retier(s.nodes('herb')[0], 2);
    const name = templateByIndex(patch.herb).name;
    s.face(patch);
    assert.deepEqual([s.prompt?.key, s.prompt?.verb, s.prompt?.rest], ['E', 'Choose', `Pick ${name} / Search with the Basket`]);
    let list = null;
    s.choose = (rows, pick) => { list = { rows, pick }; return true; };
    assert.deepEqual([s.host.press(), s.host.acting(), list?.rows], [true, false, [`Pick ${name}`, 'Search with the Basket']]);
    list.pick(1);
    s.host.tick(0.016);
    assert.deepEqual([s.meter?.kind, s.meter?.byUse], ['basket', false], 'the list\'s pick: the Basket');
    s.host.cancel();
    list.pick(0);
    s.host.tick(0.016);
    assert.deepEqual([s.meter?.kind, s.meter?.byUse], ['steady', true], 'the herbs, held by the pick');
    s.host.cancel();
    s.choose = () => false;   // the list's art not in
    assert.equal(s.host.press(), true);
    s.input = { held: true, attack: false, choice: false };   // E's steady hand, E held
    s.host.tick(0.016);
    s.input = { held: false, attack: false, choice: false };
    assert.deepEqual([s.meter?.kind, s.meter?.byUse], ['steady', false], 'E the first act, E\'s own hold');
  } finally { s.done(); }
});

test('PROF-MENU: the act choice key steps the plaque\'s light down the node\'s list, the last back to the first; with no plaque, or one row, it steps nothing (mutants: no step, no wrap)', async () => {
  const s = await stage();
  try {
    const patch = s.retier(s.nodes('herb')[0], 2);
    s.plaque = true;
    s.face(patch);
    s.lit = 'herbs';
    s.input = { held: false, attack: false, choice: true }; s.host.tick(0.016);
    s.lit = 'food';
    s.host.tick(0.016);
    s.input = { held: false, attack: false, choice: false };
    assert.deepEqual(s.steps, [1, -1]);
    s.plaque = false;
    s.input = { held: false, attack: false, choice: true }; s.host.tick(0.016); s.input = { held: false, attack: false, choice: false };
    assert.deepEqual(s.steps, [1, -1], 'no plaque: nothing to step');
    s.plaque = true;
    s.face(s.nodes('tree')[0]);
    s.input = { held: false, attack: false, choice: true }; s.host.tick(0.016); s.input = { held: false, attack: false, choice: false };
    assert.deepEqual(s.steps, [1, -1], 'a tree\'s one row: nothing to step');
  } finally { s.done(); }
  // the quick loot's own step: a list of verbs nudged on the next fold, never nothing
  const frame = { key: 'prof:x', kind: 'actions', title: 'x', subs: [], rows: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], rest: 0, empty: false };
  foldQuickLoot(frame);
  assert.equal(plaqueActionFor('prof:x'), 'a');
  assert.equal(plaqueStep(1), true);
  foldQuickLoot(frame);
  assert.equal(plaqueActionFor('prof:x'), 'b');
  foldQuickLoot(null);
  assert.equal(plaqueStep(1), false, 'no list: nothing stepped');
});

test('PROF-MENU host by source: the street\'s plaque races the node over its own winner and names it first, its click presses a lit row (never mid-act), the list opens where no plaque stands; the dungeon\'s the same through its host; an absent reason still says "not now" (mutants: each wire cut)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /plaque: \(\) => worldPlaqueOn\(\),\n\s*lit: \(key\) => plaqueActionFor\(key\),\n\s*choose: \(rows, pick\) => profChoose\(rows, pick\),\n\s*step: \(n\) => plaqueStep\(n\),/);
  assert.match(w, /const _hoverNamers = \[\n\s*\(key\) => gatherHost\?\.hoverName\?\.\(key\) \?\? null,/);
  assert.match(w, /pick: \(\) => profHoverOver\(modes\.exteriorHoverPick\(cam\.pos, _hd, \{/);
  assert.match(w, /const profHoverOver = \(ray\) => gatherHost\?\.hoverHit\?\.\(ray\) \?\? ray;/);
  assert.match(w, /const nodeClicked = !useEdge && _act\.activate && !_holdFire && !modes\.transitioning && !gatherHost\?\.acting\(\) && !_actClick && !naval\?\.takesActivate\?\.\(\) && profClickPress\(\);/);   // PIN MOVED (AUDIT HERB-CURSOR B2): nor an act's click lifting
  assert.match(w, /return typeof lit\?\.key === 'string' && lit\.key\.startsWith\('prof:'\) && lit\.id != null && \(gatherHost\?\.press\(\{ click: true \}\) \?\? false\);/);
  assert.match(w, /const win = new ListPickerWindow\(\{ backdrop: 'none', items: rows, onPick: \(i\) => \{ close\(\); pick\(i\); \}, onCancel: close \}\);/, 'the list closed before the act starts');
  assert.match(w, /profClick: \(\) => profClickPress\(\),/);
  assert.match(w, /profHoverPick: \(ray\) => gatherHost\?\.hoverHit\?\.\(ray\) \?\? null,/);
  const m = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  // PIN MOVED (FIELD BUGS 2026-10-07 INDOOR-SKIN): the building's ladder carries the same arm, above - this pin is the dungeon's
  assert.match(m.slice(m.indexOf('  function tryExitDungeon(')), /if \(!interact && !pressCast && !actClick && !host\.profActing\?\.\(\) && host\.profClick\?\.\(\)\) return true;/);
  assert.match(m, /profHoverPick: \(ray\) => host\.profHoverPick\?\.\(ray\) \?\? null,/);
  const d = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(d, /return opts\.profHoverPick\?\.\(ray\) \?\? ray;/);
  assert.match(d, /hoverName\(key, hit\) \{ return opts\.profHoverName\?\.\(key\) \?\? _namer\(key, hit\); \}/);
  assert.equal(resolveHover({ key: 'k', distance: 1, reach: 2 }, { name: () => ({ title: 'T', actions: [{ id: 'a', label: 'A', disabled: true, why: null }] }) }).rows[0].name, 'A (not now)');
});
