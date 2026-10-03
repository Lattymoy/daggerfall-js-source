// AUDIT 29 (2026-09-28, Mac: "Lets audit everything so far before we continue") - THE GATHERING HOST AND THE SEAMS, AS
// THE AUDIT FOUND THEM: a node takes E only near the crosshair, in reach, seen, and ready; a press during an act is the
// act's; a switch shut mid-act ends it; the floating origin moves an act's node with it; one dungeon stand at a time; a
// kept harvest's answer says its rank's rise and stands its node again; the Basket is not mashed; a rock's foot is not
// inside its neighbour; the compass asks the near pixels alone - and the hosts' lines by source. Each pin failed on
// the code before its fix. bible/06-Systems/Online-Arc.md AUDIT 29.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createProfBook } from '../src/net/profBook.js';
import { veins, utcDayOfMs, nodeKey } from '../src/net/nodeLaw.js';
import { MINE_ACT, xpForRank } from '../src/net/professionLaw.js';
import { MINE_POINTS } from '../src/systems/mineAct.js';
import { createHerbAct } from '../src/systems/herbAct.js';
import { standMineNodes, mineKind } from '../src/scenes/mineHost.js';
import { createGatherHost, aimAt, NODE_AIM_DEG } from '../src/scenes/gatherHost.js';
import { herbKind } from '../src/scenes/herbHost.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));
const WOODS = 231, GLENUMBRA = 59;
/** The rig's pixel: two tier-1 Woodlands veins on the rig's day, so rank 0 may work one. */
const PX = 405;
const NOON = 20500 * 86_400 + 43_200;
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const flatPixel = () => ({ samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25), tilemap: new Uint8Array(128 * 128).fill(2) });
const OUTDOORS = { inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };

/** A host over one flat Woodlands pixel with a rock piece at every vein, its book a real one over a scripted door. */
function rig({ answer = null, clear = null } = {}) {
  const day = utcDayOfMs(NOON * 1000);
  const { samples, tilemap } = flatPixel();
  const law = veins({ x: PX, y: 150, day, climate: WOODS, region: GLENUMBRA });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const entry = { px: PX, py: 150, samples, tilemap, locationRect: null, batches: [], rocks };
  const asked = [];
  const r = {
    tracks: [{ profession: 'mining', xp: 0, rank: 0, specs: { 50: null, 100: null } }],
    open: true,
  };
  const door = {
    account: () => 'acct-1',
    state: async () => (r.open ? { ok: true, data: { day, character: 'c1', tracks: r.tracks, today: {}, taken: [], stores: [], caps: { harvests: 60, stores: 5000 } } } : { ok: false, error: 'prof-closed' }),
    pixels: async (c, px) => ({ ok: true, data: { pixels: px.map(([x, y]) => ({ x, y, state: 'none' })), dungeons: [] } }),
    harvest: async (b) => { asked.push(b); return (answer ?? (() => ({ ok: true, data: { node: b.node, kind: b.kind, material: 'metal:iron', qty: 3, xp: 22, track: { profession: 'mining', xp: 22, rank: 1 }, today: 1 } })))(b); },
  };
  const clock = { ms: NOON * 1000 };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => clock.ms, sleep: noWait });
  const said = [];
  const hud = { setPrompt: (p) => { said.prompt = p; }, setMeter: () => {}, toast: (t) => said.push(t), banner: (t) => said.push(`BANNER ${t}`), setChip: () => {}, frame: () => {}, dispose: () => {} };
  const built = new Map([[`${PX},150`, entry]]);
  const pick = { templateIndex: FT.PickAxe, currentCondition: 50, maxCondition: 50 };
  const entity = { items: [pick], stats: {} };
  const feet = [0, 0, 0];
  const view = { yaw: 0, pitch: 0 };
  const origin = [0, 0, 0];
  let input = { held: false, attack: false, choice: false };
  const host = createGatherHost({
    book, hud, kinds: [herbKind({ book }), mineKind({ book })],
    renderer: { createBillboardBatch: (a, r, size, centers) => ({ centers: centers.length }), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = origin[0]; out[1] = origin[1]; out[2] = origin[2]; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => clock.ms,
    eye: () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180)] }),
    view: () => view, feet: () => feet, entity: () => entity, keyLabel: () => 'E', input: () => input, active: () => true,
    ...(clear ? { clear } : {}),
  });
  /** Look at a node from where the player stands now. */
  const lookAt = (node) => {
    const [x, y, z] = node.local;
    const at = aimAt([feet[0], feet[1] + 1.6, feet[2]], [x + origin[0], y + origin[1] + (node.lift ?? 0.3), z + origin[2]], { yaw: 0, pitch: 0 });
    view.yaw = -at.yaw; view.pitch = -at.pitch;
  };
  const face = (node, offYaw = 0) => {
    const [x, y, z] = node.local;
    feet[0] = x + origin[0]; feet[1] = y + origin[1]; feet[2] = z - 1.5 + origin[2];
    const at = aimAt([feet[0], feet[1] + 1.6, feet[2]], [x + origin[0], y + origin[1] + (node.lift ?? 0.3), z + origin[2]], { yaw: 0, pitch: 0 });
    view.yaw = -at.yaw + offYaw; view.pitch = -at.pitch;
  };
  return { host, book, said, asked, entry, law, feet, view, origin, face, lookAt, r, clock, setInput: (i) => { input = { held: false, attack: false, choice: false, ...i }; } };
}
async function ready(t) {
  setForagingHost({ world: () => OUTDOORS });
  await t.book.refresh();
  t.host.onBuilt(t.entry);
  await tick(); await tick();
  return t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);   // one rank 0 may work
}

test('AUDIT 29 C1: a node takes E only near the crosshair, in reach and seen - a door beside it keeps its press', async () => {
  try {
    const t = rig({ clear: () => !t.blocked });
    t.blocked = false;
    const v = await ready(t);
    assert.ok(v, 'a tier-1 vein stands');
    t.face(v, NODE_AIM_DEG + 3);
    t.host.tick(0.016);
    assert.equal(t.host.target, null, `${NODE_AIM_DEG + 3} degrees off the crosshair is not the node`);
    assert.ok(NODE_AIM_DEG <= 12);
    t.face(v);
    t.blocked = true;
    t.host.tick(0.016);
    assert.equal(t.host.target, null, 'a wall between: no target');
    t.blocked = false;
    t.feet[1] -= 5;
    t.lookAt(v);   // looking straight at it from a floor below
    t.host.tick(0.016);
    assert.equal(t.host.target, null, 'five metres below it, looked at: out of reach');
    t.face(v);
    t.host.tick(0.016);
    assert.equal(t.host.target?.node.key, v.key, 'near the crosshair, in reach, seen: the node');
  } finally { setForagingHost(null); }
});

test('AUDIT 29 C1 + D3: a node that cannot be worked takes no press (it goes on to the door); a press during an act is the act\'s', async () => {
  try {
    const t = rig();
    const v = await ready(t);
    const pick = t.host;   // the rig's entity holds the Pick-Axe; take it away
    assert.ok(pick);
    t.face(v);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true, 'with the Pick-Axe, E starts the act');
    assert.equal(t.host.acting(), true);
    assert.equal(t.host.press(), true, 'the next press is the act\'s, never a door\'s behind it');
    t.host.cancel();
    const bare = rig();
    const v2 = await ready(bare);
    bare.face(v2);
    bare.host.tick(0.016);
    bare.book.state.tracks.set('mining', { profession: 'mining', xp: 0, rank: 0, specs: { 50: null, 100: null } });
    // a tier the rank does not reach: the plan not ready, the press not the node's
    const high = { ...v2, tier: 3 };
    bare.host.nodesOf(PX, 150).splice(bare.host.nodesOf(PX, 150).indexOf(v2), 1, high);
    bare.host.tick(0.016);
    assert.match(bare.said.prompt?.rest ?? '', /needs Mining/);
    assert.equal(bare.host.press(), false, 'not ready: the press goes on');
    assert.equal(bare.host.acting(), false);
  } finally { setForagingHost(null); }
});

test('AUDIT 29 C5: the switch shut mid-act ends the act - the swing is no longer held off, the tool leaves the hand', async () => {
  try {
    const t = rig();
    const v = await ready(t);
    t.face(v);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true);
    assert.equal(t.host.acting(), true);
    t.book.state.open = false;
    t.host.tick(0.016);
    assert.equal(t.host.acting(), false);
    assert.equal(t.host.handTool(), null);
  } finally { setForagingHost(null); }
});

test('AUDIT 29 C6: the floating origin moves an act\'s node with the player - a recentre mid-act is no walk-off', async () => {
  try {
    const t = rig();
    const v = await ready(t);
    t.face(v);
    t.host.tick(0.016);
    t.host.press();
    t.origin[0] -= 819.2;   // the scene recentred: every pixel, and the player, moved together
    t.feet[0] -= 819.2;
    t.host.tick(0.016);
    assert.equal(t.host.acting(), true, 'still at the vein');
    for (let i = 0; i < 8 && t.host.acting(); i++) {
      const g = MINE_POINTS[0];
      assert.ok(g);
      t.setInput({ attack: true }); t.host.tick(MINE_ACT.swingS + 0.01); t.setInput({}); t.host.tick(0.01);
    }
    await tick(); await tick();
    assert.equal(t.asked.length, 1, 'the act finished and was asked');
  } finally { setForagingHost(null); }
});

test('AUDIT 29 C4: a kept harvest answered through the pump says its rank\'s rise, and its node stands again', async () => {
  try {
    let n = 0;
    const t = rig({ answer: (b) => (++n === 1 ? { ok: false, error: 'offline' } : { ok: true, data: { node: b.node, kind: b.kind, material: 'metal:iron', qty: 3, xp: 22, track: { profession: 'mining', xp: xpForRank(25), rank: 25 }, today: 1 } }) });
    t.r.tracks = [{ profession: 'mining', xp: xpForRank(25) - 5, rank: 24, specs: { 50: null, 100: null } }];
    const v = await ready(t);
    t.face(v);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true);
    for (let i = 0; i < 8 && t.host.acting(); i++) { t.setInput({ attack: true }); t.host.tick(MINE_ACT.swingS + 0.01); t.setInput({}); t.host.tick(0.01); }
    for (let i = 0; i < 6; i++) await tick();
    assert.equal(t.book.pendingHarvests, 1, 'kept - its first ask unanswered');
    assert.ok(!t.said.some((x) => /Mining 24 -> 25/.test(x)));
    const shown = t.host.nodesOf(PX, 150).filter((x) => x.what === 'vein').length;
    assert.ok(shown > 0);
    const drawnBefore = t.entry.batches.reduce((a, b) => a + (b.centers ?? 0), 0);
    t.clock.ms += 3_000;   // its wait past: the host's pump asks it again
    for (let i = 0; i < 10 && t.book.pendingHarvests; i++) { t.host.tick(0.016); await tick(); await tick(); }
    assert.equal(t.book.pendingHarvests, 0, 'answered through the pump');
    assert.ok(t.said.some((x) => /Mining 24 -> 25/.test(x)), `the rise said: ${JSON.stringify(t.said)}`);
    assert.ok(t.said.includes('BANNER Apprentice Miner'));
    for (let i = 0; i < 4; i++) await tick();
    assert.ok(t.book.taken(v.key, 'ore'), 'taken by the service\'s word');
    const centers = () => t.entry.batches.reduce((a, b) => a + (b.centers ?? 0), 0);
    assert.equal(centers(), drawnBefore - 3, 'its node\'s flats taken down - its pixel stood again by the node\'s key (VEIN_FLATS)');
  } finally { setForagingHost(null); }
});

test('AUDIT 29 C7: one dungeon stand at a time - the entry\'s stand and the witnessed state\'s, both in flight, draw the veins once', async () => {
  try {
    const t = rig();
    await ready(t);
    t.host.tick(0.016);   // the pixel's witnessed state asked and answered first
    for (let i = 0; i < 4; i++) await tick();
    let release;
    const gate = new Promise((r) => { release = r; });
    const stood = [], dropped = [];
    t.host.enterDungeon({ id: 88, climate: 226, region: 23, wall: () => [0, 0, 0], stand: async (a, r, sc, c) => { await gate; const b = { a, r, c }; stood.push(b); return b; }, drop: (b) => dropped.push(b) });
    t.clock.ms += 10_000;
    t.host.tick(0.016);   // the dungeon's witnessed state asked - its answer stands the veins again
    for (let i = 0; i < 6; i++) await tick();
    release();
    for (let i = 0; i < 12; i++) await tick();
    const live = stood.filter((b) => !dropped.includes(b));
    const { dungeonVeins } = await import('../src/net/nodeLaw.js');
    const law = dungeonVeins({ dungeon: 88, day: utcDayOfMs(NOON * 1000), climate: 226, confirmed: false });
    assert.equal(live.length, law.length, `${live.length} vein flats standing for ${law.length} veins`);
    t.host.leaveDungeon();
  } finally { setForagingHost(null); }
});

test('AUDIT 29 C9: the Basket is not mashed - a press before a glint shows spends it', () => {
  const mash = createHerbAct({ kind: 'basket', rng: () => 0.5 });
  for (let i = 0; i < 400 && !mash.state.done; i++) mash.tick(0.05, { attack: true });
  assert.equal(mash.state.done, true);
  assert.equal(mash.report().finds, 0, 'every press early: nothing found');
  const skilled = createHerbAct({ kind: 'basket', rng: () => 0.5 });
  for (let i = 0; i < 400 && !skilled.state.done; i++) skilled.tick(0.05, { attack: skilled.state.spot >= 0 });
  assert.equal(skilled.report().finds, 3, 'a press while each shows: all three');
});

test('AUDIT 29 C11: a rock\'s foot inside its neighbour stands no node there - a vein takes the stone-tile fallback, a boulder none', () => {
  const { samples, tilemap } = flatPixel();
  const day = 20500;
  const law = veins({ x: 400, y: 150, day, climate: WOODS, region: GLENUMBRA });
  const x = law[0].u * TERRAIN_SIZE, z = law[0].v * TERRAIN_SIZE;
  // a piece south of the vein's point, and a second overlapping its north face (where the foot would stand)
  const rocks = [[x - 2, 0, z + 4, x + 2, 6, z + 8], [x - 3, 0, z + 2, x + 3, 6, z + 4.5]];
  const nodes = standMineNodes({ px: 400, py: 150, day, climate: WOODS, region: GLENUMBRA, samples, tilemap, rocks: rocks.slice(0, 1).concat([rocks[1]]) });
  for (const n of nodes) {
    const [fx, , fz] = n.local;
    for (const b of rocks) assert.ok(!(fx > b[0] && fx < b[3] && fz > b[2] && fz < b[5]), `${n.what} ${n.slot} stands inside a rock`);
  }
});

test('AUDIT 29 C10: the compass asks the near pixels alone', async () => {
  try {
    const t = rig();
    await ready(t);
    assert.ok(t.host.stoodOf('mine', () => true).length > 0);
    assert.deepEqual(t.host.stoodOf('mine', () => true, { pos: [5000, 0, 5000], r: 200 }), [], 'a pixel 5 km off is not walked');
  } finally { setForagingHost(null); }
});

test('AUDIT 29: the hosts by source - the seams the audit moved', () => {
  const w = src('src/scenes/world.js');
  const m = src('src/scenes/worldModes.js');
  const d = src('src/scenes/dungeonContext.js');
  const rigSrc = src('src/combat/weaponRig.js');
  const g = src('src/scenes/gatherHost.js');
  // D1: the Escape the act spent is marked, and the mode machine lets it be
  assert.match(w, /e\.preventDefault\(\); e\.profActEnded = true; return true; \}/);
  assert.match(m, /if \(e\.profActEnded\) return;/);
  assert.ok(m.indexOf('if (e.profActEnded) return;') < m.indexOf('// U43: THE ONE DISPATCH.'));
  // D2: the press alone gated underground; the rig swings nothing behind the tool; the street casts no spell mid-act
  assert.match(d, /if \(held && opts\.profActing\?\.\(\)\) return;/);
  assert.match(rigSrc, /const canAttack = [^\n]*&& !actTool\(\);/);
  assert.match(w, /if \(_act\.cast && (?:!_holdFire && )?!gatherHost\?\.acting\(\)\) magic\.interceptAttack\(true\);/);
  // C2 + D3: a dungeon vein on Interact alone, before QG1
  assert.match(m, /\(mode === 'dungeon' \? tryExitDungeon : tryExit\)\(\{ pressCast: _act\.pressCast, interact: useEdge, actClick \}\)/);   // PIN MOVED (AUDIT 2026-10-01 part four, CLICK-LIFT): and the act's click to its release
  const t = m.slice(m.indexOf('function tryExitDungeon('));
  assert.ok(t.indexOf('host.profPress?.()') < t.indexOf('pickQuestFoe('), 'the vein before the quest foe');
  // C3 + C11 + D5: the dungeon's own mesh; no vein in the air; no court
  assert.match(d, /const PROF_VEIN_ONLY = Object\.freeze\(\{ only: Object\.freeze\(\['dungeon'\]\) \}\);/);
  assert.match(d, /collider\.raycastHit\(from, dir, PROF_VEIN_WALL_M, PROF_VEIN_ONLY\)/);
  assert.match(d, /if \(!Number\.isFinite\(down\)\) continue;/);
  assert.match(d, /isGateArena\(dfLocation\) \|\| isArenaFloor\(dfLocation\) \|\| !Number\.isSafeInteger/);   // ARENA2: nor the arena's floor
  // C8: nature's rect - a WoD site's too
  assert.match(src('src/scenes/herbHost.js'), /locationRect: entry\.locationRect \?\? entry\.wodSite \?\? null/);
  assert.match(src('src/scenes/mineHost.js'), /locationRect: entry\.locationRect \?\? entry\.wodSite \?\? null/);
  // C1: the host's sight, handed in
  assert.match(w, /clear: \(from, to, underground\) => \{/);
  // B3 + B4: the fee on the first answer; the kept withdrawals settled on every good read and on the Stores page
  assert.match(w, /if \(f\.fee > 0\) \{ deductGold\(playerEntity, f\.fee\); saveSoon\.changed\(\); \}/);   // PROF-SAVE: and the save soon
  assert.doesNotMatch(w, /!r\.data\?\.repeat\) \{? ?deductGold/);
  assert.match(g, /if \(r\?\.ok\) \{ refreshAt = 0; restandAll\(\); if \(book\.pendingWithdrawals \|\| book\.pendingCrafts\) deps\.onSettle\?\.\(\); \}/);
  assert.match(src('src/ui/profPages.js'), /if \(\(book\.pendingWithdrawals \|\| book\.pendingCrafts\) && p\.settle && Date\.now\(\) - _stores\.settledAt > 30_000\)/);   // PROF5 (FOUND): a kept craft settles too
  // D4: a smith's open for trade
  assert.match(m, /return interiorBuilding\.insideOpenShop === false \? null : \{ kind: 'shop', fee: FORGE_FEE \};/);
});
