// DISC23-A (2026-09-24, Starempire42 on Discord, "Being able to see players on your town/dungeon map": "It would be
// really nice to be able to see your party members on the town and dungeon maps. This would make it much easier to
// figure out where everyone is and find each other").
//
// THE GAP: the party was on the BAY only (SOC6), read off the hub's travel pixel - which is the whole town, the whole
// dungeon. The town and dungeon plans took no party at all: the doors built their bags without one, and neither sheet
// had anywhere to draw one. A plan needs metres, and the only metres this client has for another player are their
// body's (scenes/world.js peersNear), so the plans read a second dep - `partyNear`, the members whose bodies stand in
// this room - drawn as a caret of the player's own shape in the party's green, on the member's own storey.
//
// Driven through the real sheets (ui/automapSheet.js, ui/townSheet.js), the real ink and the real floor model; the
// hosts' wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAutomapSheet } from '../src/ui/automapSheet.js';
import { createTownSheet } from '../src/ui/townSheet.js';
import { readPartyBodies, PARTY_MARK_CSS, PARTY_LEGEND_TEXT } from '../src/ui/partyMapMarks.js';
import { toPaper, CARET_R } from '../src/ui/inkMap.js';
import { FLOOR_PARTY_DOT } from '../src/ui/inkAutomap.js';
import { BLOCK_PX, WORLD_PER_PX } from '../src/ui/inkTown.js';
import { RMB_DIMENSION } from '../src/formats/blocksFile.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A canvas that records every call with the pen it was made in. */
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: String(t).length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}
/** Each caret's nose, per fill colour: paintCaret's first moveTo after its fill is set. */
const noses = (ctx, fill) => ctx.calls.filter((c, i) => c.fn === 'moveTo' && c.fillStyle === fill && ctx.calls[i - 1]?.fn === 'beginPath').map((c) => c.args);
const words = (ctx, fill) => ctx.calls.filter((c) => c.fn === 'fillText' && c.fillStyle === fill).map((c) => c.args[0]);

// ── the dungeon ─────────────────────────────────────────────────────────────────────────────────────────────────────
const quad = (key, y, x0, z0, x1, z1, ny = 1) => ({
  key, aabb: { min: [x0, y, z0], max: [x1, y, z1] },
  positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  normals: new Float32Array([0, ny, 0, 0, ny, 0, 0, ny, 0, 0, ny, 0]), matrix: null,
});
const room = (key, y, x0, z0, x1, z1) => [quad(`${key}f`, y, x0, z0, x1, z1, 1), quad(`${key}c`, y + 4, x0, z0, x1, z1, -1)];
const LEVEL = [...room('a', 0, 100, 200, 120, 220), ...room('c', 12, 100, 200, 120, 220)];
const rec = () => ({ revealed: new Set(['af', 'cf']), visitedThisRun: new Set(), entranceDiscovered: false, notes: new Map(), teleporters: new Map() });
const VIEW = { ox: 0, oy: 0, scale: 4 };
const ENV = { view: VIEW, paperW: 800, paperH: 600, dpr: 1, pulse: 0 };
const ME = [105, 0, 205];

test('DISC23-A: a member in the dungeon stands on the plan where they stand - the player\'s own space, facing their way, named', () => {
  let party = [{ acct: 'a1', name: 'Starempire42', feet: [...ME], yaw: 0 }];
  const s = createAutomapSheet({ record: rec, model: () => ({ rows: LEVEL }), player: () => ({ feet: ME, yaw: 0 }), party: () => party });
  let ctx = recordingCtx();
  s.paintOverlay(ctx, ENV);
  const [friend] = noses(ctx, PARTY_MARK_CSS);
  assert.ok(friend, 'the member is drawn, in the party\'s green (the plans had no party at all)');
  const player = ctx.calls.filter((c) => c.fn === 'moveTo').at(-1).args;   // the player's caret is the last drawn, its nose its one moveTo
  assert.deepEqual(friend.map(Math.round), player.map(Math.round), 'a member standing where I stand is drawn where I am drawn');
  assert.deepEqual(words(ctx, PARTY_MARK_CSS), ['Starempire42']);
  // three metres east is twelve paper pixels east at this zoom, and a member facing east points east
  party = [{ acct: 'a1', name: 'Starempire42', feet: [ME[0] + 3, 0, ME[2]], yaw: Math.PI / 2 }];
  ctx = recordingCtx();
  s.paintOverlay(ctx, ENV);
  const [east] = noses(ctx, PARTY_MARK_CSS);
  assert.ok(Math.abs(east[0] - (player[0] + 12 + CARET_R)) < 1e-6 && Math.abs(east[1] - (player[1] + CARET_R)) < 1e-6,
    `the nose is CARET_R east of a body 12 px east (${east} against the player's ${player})`);
  // the pointer over them answers their name
  assert.equal(s.hoverLabel(east[0] - CARET_R, east[1]).label, 'Starempire42');
  // the caret goes down BEFORE mine, so I am never under a friend
  const fills = ctx.calls.filter((c) => c.fn === 'fill').map((c) => c.fillStyle);
  assert.ok(fills.indexOf(PARTY_MARK_CSS) < fills.length - 1 && fills.at(-1) !== PARTY_MARK_CSS);
});

test('DISC23-A: a member on another storey is not on this one - the strip dots their storey instead', () => {
  const party = [{ acct: 'a1', name: 'Gryphoth', feet: [110, 12, 210], yaw: 0 }];
  const s = createAutomapSheet({ record: rec, model: () => ({ rows: LEVEL }), player: () => ({ feet: ME, yaw: 0 }), party: () => party });
  assert.equal(s.floor, 0, 'I am on Floor 1');
  assert.deepEqual(s.partyHere(), [], 'the member is upstairs');
  assert.deepEqual([...s.partyStoreys()], [1]);
  const ctx = recordingCtx();
  s.paintStatic(ctx, ENV);
  s.paintOverlay(ctx, ENV);
  assert.equal(noses(ctx, PARTY_MARK_CSS).length, 0, 'no caret on a floor they are not on');
  const up = s.strip.rows.find((r) => r.index === 1);
  const dot = ctx.calls.find((c) => c.fn === 'arc' && c.fillStyle === PARTY_MARK_CSS);
  assert.ok(dot, 'Floor 2 wears the party\'s dot');
  const k = s.strip.scale;
  assert.ok(Math.abs(dot.args[0] - (up.x - (FLOOR_PARTY_DOT.gap + FLOOR_PARTY_DOT.r) * k)) < 1e-6 && Math.abs(dot.args[1] - (up.y + up.h / 2)) < 1e-6,
    'beside Floor 2\'s own label');
  // up a storey, and there they are
  s.setFloor(1);
  const up2 = recordingCtx();
  s.paintOverlay(up2, ENV);
  assert.equal(noses(up2, PARTY_MARK_CSS).length, 1);
  assert.deepEqual(words(up2, PARTY_MARK_CSS), ['Gryphoth']);
});

test('DISC23-A: the plan breathes while anyone of the party is in the level, so a member walking on appears within a beat', () => {
  let party = [];
  const s = createAutomapSheet({ record: rec, model: () => ({ rows: LEVEL }), player: () => ({ feet: ME, yaw: 0 }), party: () => party });
  assert.equal(s.breathes(), false, 'nothing to repaint for');
  party = [{ acct: 'a1', name: 'x', feet: [110, 12, 210], yaw: 0 }];
  assert.equal(s.breathes(), true, 'a member on ANOTHER storey still keeps the beat - they may climb onto this one');
  // and a sheet with no party dep at all (every offline game) is the sheet it was
  const solo = createAutomapSheet({ record: rec, model: () => ({ rows: LEVEL }), player: () => ({ feet: ME, yaw: 0 }) });
  assert.equal(solo.breathes(), false);
  assert.deepEqual(solo.partyHere(), []);
});

// ── the town ────────────────────────────────────────────────────────────────────────────────────────────────────────
function blockGrid(rects) {
  const g = new Uint8Array(BLOCK_PX * BLOCK_PX);
  for (const [x0, y0, x1, y1, v] of rects) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y * BLOCK_PX + x] = v;
  return g;
}

test('DISC23-A: a member in the streets stands on the plan where the player would - the host\'s own conversion, one seam', () => {
  const div = RMB_DIMENSION * 0.025;
  const at = [1 * div + (4 / BLOCK_PX) * div, 0, 0 * div + ((BLOCK_PX - 3) / BLOCK_PX) * div];   // location-frame metres
  let party = [{ acct: 'a1', name: 'Skeptikali', feet: at, yaw: 0 }];
  const s = createTownSheet({
    gridW: 2, gridH: 2,
    blocks: [{ x: 1, y: 0, autoMap: blockGrid([[4, 2, 5, 3, 1]]) }],
    buildings: () => [], discovered: () => [],
    player: () => ({ x: at[0] / WORLD_PER_PX, y: at[2] / WORLD_PER_PX, yaw: 0 }),   // world.js townPlayer's own division
    party: () => party,
  });
  const ctx = recordingCtx();
  s.paintOverlay(ctx, { view: { ox: 0, oy: 0, scale: 1 }, paperW: 4000, paperH: 4000, dpr: 1, pulse: 0 });
  const [friend] = noses(ctx, PARTY_MARK_CSS);
  const player = ctx.calls.filter((c) => c.fn === 'moveTo').at(-1).args;
  assert.ok(friend, 'the member is on the street plan (it took no party at all)');
  assert.deepEqual(friend.map((v) => +v.toFixed(6)), player.map((v) => +v.toFixed(6)), 'a member where the player stands is drawn on the player - +Z up, EM-BUG3\'s seam');
  assert.deepEqual(words(ctx, PARTY_MARK_CSS), ['Skeptikali']);
  const [x, y] = toPaper({ ox: 0, oy: 0, scale: 1 }, s.party()[0].x, s.party()[0].y);
  assert.equal(s.hoverLabel(x, y).label, 'Skeptikali', 'a friend stands in front of a shop');
  assert.equal(s.breathes(), true);
  party = [];
  assert.equal(s.breathes(), false);
});

test('DISC23-A: the one reading - a body with no place in this frame is not drawn, and a nameless one is still a friend', () => {
  assert.deepEqual(readPartyBodies(null), []);
  assert.deepEqual(readPartyBodies(() => 'nope'), []);
  const got = readPartyBodies(() => [
    { acct: 'a', name: '  Mac ', feet: [1, 2, 3], yaw: 0.5 },
    { acct: 'b', name: 'lost', feet: [NaN, 0, 0] },
    { acct: 'c', name: 'none' },
    { acct: 'd', name: '', feet: new Float32Array([4, 5, 6]), yaw: 'x' },
  ]);
  assert.deepEqual(got, [
    { acct: 'a', name: 'Mac', feet: [1, 2, 3], yaw: 0.5 },
    { acct: 'd', name: PARTY_LEGEND_TEXT, feet: [4, 5, 6], yaw: 0 },
  ]);
});

test('DISC23-A: the hosts hand the plans the party\'s bodies - the dungeon, the building and the town, through their doors', () => {
  const world = src('src/scenes/world.js');
  // the one host reading: a party member's peer body, in this scene's frame, with its facing
  assert.match(world, /const partyNear = \(\) => \{\s*\n\s*const near = peersNear\(\);[\s\S]*?for \(const m of social\.others\(\)\) \{\s*\n\s*const peer = near\.find\(\(p\) => m\.peers\?\.includes\(p\.id\)\);/);
  assert.match(world, /yaw: online\?\.peers\.get\(peer\.id\)\?\.shown\?\.yaw \?\? 0 \}\);/);
  // the town: the player's own subtraction, into the location's frame
  assert.match(world, /townParty: \(\) => partyNear\(\)\.map\(\(m\) => \(\{ \.\.\.m, feet: \[m\.feet\[0\] - t\[0\] - b\.locOrigin\[0\], m\.feet\[1\] - t\[1\] - b\.locOrigin\[1\], m\.feet\[2\] - t\[2\] - b\.locOrigin\[2\]\] \}\)\),/);
  assert.match(world, /partyNear: \(\) => partyNear\(\),/);
  const modes = src('src/scenes/worldModes.js');
  assert.match(modes, /selfId: \(\) => host\.selfId\?\.\(\) \?\? null, party: \(\) => host\.partyNear\?\.\(\) \?\? \[\],/, 'the dungeon\'s opts');
  assert.match(modes, /title: interiorBuilding\?\.name \?\? 'Interior',\s*\n\s*party: \(\) => host\.partyNear\?\.\(\) \?\? \[\],/, 'the building\'s map');
  assert.match(src('src/scenes/dungeonContext.js'), /title: dfLocation\?\.name \?\? 'Dungeon',\s*\n\s*party: opts\.party \?\? null,/);
  // the doors used to drop the key on the floor: each builds its sheet's bag by hand
  assert.match(src('src/ui/automapDoor.js'), /party: deps\.party \?\? null,/);
  assert.match(src('src/ui/townMapDoor.js'), /party: deps\.townParty \?\? null,/);
});
