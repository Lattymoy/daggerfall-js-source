// FIELD BUGS 2026-10-01 part four - "minig is broken doesnt work" (#bug-reports), and Mac: "Also mining, the life
// skill, is broken".
//
// ACT-TOUCH. Mining's act is struck with Attack: the gathering host reads the frame's SwingWeapon press off the edge
// ring (scenes/world.js `input().attack`), which only the mouse and the keyboard write. A finger's Attack button or
// swipe and a pad's trigger reach the world through the hooks object (`inputHooks.attack`), and there, during an act,
// the press was refused ("an act's tap is the act's") and given to nobody - in the street and underground alike (the
// dungeon's attack sink drops it too, dungeonContext.js playerAttackInput). So on a phone or a pad no strike ever
// landed: the meter stood, the glint moved round, and the vein was never mined. Logging's chop, the Basket's glints and
// the net's tug read the same input (CORRECTED by the audit, test/fb1001_audit.test.js: the steady hand, the trace and
// the haul's band read E held, not Attack - TOUCH-HOLD, asked). Now the hooks hand the press to the act (`gatherHost.strike(held)`): one strike
// a press, a held finger or a swinging stick never a second. The real gathering host with its kinds over a stood
// pixel of the producers' own (test/fb0930b_toolsaid.test.js's), and the world host's hook read off its source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createGatherHost, aimAt, NODE_AIM_DEG } from '../src/scenes/gatherHost.js';
import { herbKind } from '../src/scenes/herbHost.js';
import { mineKind, standMineNodes } from '../src/scenes/mineHost.js';
import { treeKind } from '../src/scenes/treeHost.js';
import { trees, veins, boulders, utcDayOfMs } from '../src/net/nodeLaw.js';
import { groundAt } from '../src/world/terrainNature.js';
import { keyEdges, noteKeyDown, beginInputFrame, pressed, held } from '../src/ui/input.js';
import { CHOP_ACT, MINE_ACT } from '../src/net/professionLaw.js';
import { createForagingItem, setForagingHost } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';

const WOODS = CLIMATES.Woodlands, GLENUMBRA = 59;
const PX = 405, PY = 150;
const NOON_MS = (20500 * 86_400 + 43_200) * 1000;
const DAY = utcDayOfMs(NOON_MS);
const tick = () => new Promise((r) => setImmediate(r));
/** Foraging's world at noon in the wild (its checks gate every act's start - FORAGE0 14.3). */
const WILD = Object.freeze({ inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 10, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' });

/** A Woodlands pixel at noon: a rock piece north of every vein, the forest's flats a metre off the law's trees. */
function pixelEntry() {
  const law = veins({ x: PX, y: PY, day: DAY, climate: WOODS, region: GLENUMBRA });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  // NODE-AIM: every boulder its own piece of the rock field, four metres over the ground
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5);
  for (const b of boulders({ x: PX, y: PY, day: DAY, climate: WOODS })) {
    const x = b.u * TERRAIN_SIZE, z = b.v * TERRAIN_SIZE, g = groundAt(samples, x, z);
    rocks.push([x - 1.5, g - 1, z + 1, x + 1.5, g + 4, z + 4]);
  }
  const flats = trees({ x: PX, y: PY, day: DAY, climate: WOODS }).map((t, i) => ({ id: i, group: '504_12', i, x: t.u * TERRAIN_SIZE + 1, y: 0, z: t.v * TERRAIN_SIZE }));
  const batch = { archive: 504, record: 12, size: { w: 4, h: 8 } };
  const forest = { base: 504, archive: 504, trees: flats, groups: new Map([['504_12', { batch, centers: flats.map((f) => [f.x, f.y, f.z]), size: batch.size }]]) };
  return {
    px: PX, py: PY, samples, tilemap: new Uint8Array(128 * 128).fill(2),
    locationRect: null, batches: [], rocks, forest,
  };
}

/** A player with the Pick-Axe and the Wood-Axe, Mining and Logging at 100, the professions open; the host's input
 *  the mouse's and keyboard's - never pressed here: every strike comes through `strike`, as a finger's or a pad's. */
async function stage({ clear = undefined } = {}) {
  const S = { asked: [], said: [], meter: null, prompt: null };
  S.e = { stats: { intelligence: 60, agility: 60, strength: 55, endurance: 50, luck: 50 }, items: [createForagingItem(FT.PickAxe), createForagingItem(FT.WoodAxe)], wagonItems: [] };
  const book = {
    state: { open: true, today: {}, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }), askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }),
    harvest: (h) => { S.asked.push(h); return new Promise(() => {}); },
  };
  const feet = [400, 0, 400];
  const view = { yaw: 0, pitch: 0 };
  const rad = Math.PI / 180;
  const eye = () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin(view.yaw * rad) * Math.cos(view.pitch * rad), Math.sin(view.pitch * rad), Math.cos(view.yaw * rad) * Math.cos(view.pitch * rad)] });
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, moveBillboardBatch: () => true };
  const entry = pixelEntry();
  const built = new Map([[`${PX},${PY}`, entry]]);
  S.host = createGatherHost({
    book, kinds: [herbKind({ book }), mineKind({ book }), treeKind({ book, renderer })],
    hud: {
      setPrompt: (p) => { S.prompt = p; }, setMeter: (a) => { S.meter = a ? a.state.kind : null; S.act = a ?? S.act; },
      toast: (t) => S.said.push(t), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {},
    },
    renderer, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON_MS,
    eye, view: () => view, feet: () => feet, entity: () => S.e,
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }),
    active: () => true, activeDungeon: () => false, clear,
  });
  setForagingHost({ world: () => WILD, monthValue: () => 5, entity: () => null, startQuest: () => true, professionsOpen: () => true, keyLabel: () => 'E', professionUse: () => false });
  S.host.onBuilt(entry);
  await tick(); await tick();
  S.nodes = (kind) => S.host.nodesOf(PX, PY).filter((n) => n.kind === kind);
  /** Stand a metre and a half south of a node and look at it - at its aim point, or `at` (a point of its own). */
  S.face = (n, at = null) => {
    const [x, y, z] = n.local;
    feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
    const a = aimAt([x, y + 1.6, z - 1.5], at ?? [x, y + (n.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
    view.yaw = -a.yaw; view.pitch = -a.pitch;
    S.host.tick(0.016);
  };
  return S;
}

test('ACT-TOUCH: the report - a finger\'s or a pad\'s Attack strikes the vein: E at it, then a press and a lift for each strike, and the ore is asked of the service; nothing comes of a press with no act (mutants: the strike never reaches the act; the strike kept past its frame; a press with no act banked)', async () => {
  const s = await stage();
  try {
    const vein = s.nodes('mine').find((n) => n.what === 'vein');
    assert.ok(vein, 'a vein stands at its rock');
    s.face(vein);
    assert.match(s.prompt?.verb ?? '', /^Mine /, `the prompt: ${s.prompt?.verb}`);
    s.host.strike(true); s.host.strike(false);   // a tap before any act, in the frame E lands: nobody's
    assert.equal(s.host.press(), true, 'E starts the act');
    s.host.tick(0.016);
    assert.equal(s.meter, 'mine');
    assert.equal(s.host.acting(), true);
    assert.equal(s.act.state.strikes, 0, 'the tap before the act struck nothing');
    const need = vein.tier <= 2 ? 4 : vein.tier <= 4 ? 5 : 7;
    let strikes = 0;
    for (let i = 0; i < 40 && s.host.acting(); i++) {
      s.host.strike(true);                 // the finger lands
      s.host.tick(0.016);
      strikes++;
      s.host.strike(false);                // and lifts
      s.host.tick(MINE_ACT.swingS);        // the swing plays out
    }
    assert.equal(s.host.acting(), false, 'the act finished');
    assert.ok(strikes <= need, `${strikes} presses for a vein of ${need} strikes`);
    assert.deepEqual(s.asked.map((h) => [h.node, h.kind]), [[vein.key, 'ore']], 'the ore asked - the Mining XP is its answer');
    assert.equal(s.asked[0].act.strikes, strikes, 'every press a strike, and no other');
  } finally { s.host.dispose(); setForagingHost(null); }
});

test('ACT-TOUCH: one strike a press - a held finger, a stick swung through many frames, or a press repeated without a lift strikes once; the next press after a lift strikes again (mutants: the edge read off the hold; a strike carried to the next act)', async () => {
  const s = await stage();
  try {
    const vein = s.nodes('mine').find((n) => n.what === 'vein');
    s.face(vein);
    s.host.press();
    s.host.tick(0.016);
    const act = () => s.host.target ?? null;
    void act;
    // held for two seconds - the pad's swing calls the hook every frame with `held` true
    for (let t = 0; t < 2; t += 0.05) { s.host.strike(true); s.host.tick(0.05); }
    s.host.tick(1);
    assert.equal(s.host.acting(), true, 'still acting');
    s.host.strike(false);
    s.host.strike(true); s.host.tick(0.016); s.host.strike(false); s.host.tick(MINE_ACT.swingS);
    // finish it off and read the report
    for (let i = 0; i < 40 && s.host.acting(); i++) { s.host.strike(true); s.host.tick(0.016); s.host.strike(false); s.host.tick(MINE_ACT.swingS); }
    const need = vein.tier <= 2 ? 4 : vein.tier <= 4 ? 5 : 7;
    const r = s.asked[0]?.act;
    assert.ok(r, 'the act finished');
    // the two seconds held were ONE strike: every strike after is a press of its own
    assert.ok(r.strikes >= 2 && r.strikes <= need, `strikes ${r.strikes} of ${need}`);
    const presses = 1 + 1 + (r.strikes - 2);
    assert.equal(r.strikes, presses, 'the hold struck once');
    // a press is its own act's: struck, then Escape and E in the same frame - the new act starts unstruck
    s.face(vein);
    s.host.press();
    s.host.tick(0.016);
    s.host.strike(true); s.host.strike(false);
    assert.equal(s.host.cancel(), true, 'Escape');
    assert.equal(s.host.press(), true, 'E again');
    s.host.tick(0.016);
    assert.equal(s.act.state.strikes, 0, 'the press before Escape struck the act it was made in, not this one');
  } finally { s.host.dispose(); setForagingHost(null); }
});

test('ACT-TOUCH: Logging\'s chop by a finger - the press as the ring meets the notch fells the tree (the same door for every act that reads Attack)', async () => {
  const s = await stage();
  try {
    const tree = s.nodes('tree')[0];
    assert.ok(tree, 'a tree node');
    s.face(tree);
    assert.equal(s.host.press(), true);
    s.host.tick(0.016);
    assert.equal(s.meter, 'chop');
    for (let i = 0; i < 20 && s.host.acting(); i++) {
      s.host.tick(CHOP_ACT.ringS);
      s.host.strike(true); s.host.tick(0.001); s.host.strike(false);
    }
    assert.deepEqual(s.asked.map((h) => h.kind), ['logs'], 'the logs asked');
  } finally { s.host.dispose(); setForagingHost(null); }
});

test('ACT-TOUCH: the world host hands every hooks press to the act before its gates - the street\'s and, through the same hook, the dungeon\'s and a building\'s (mutants: the hook never calls it; called after the act\'s own refusal)', () => {
  const src = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const at = src.indexOf('    attack: (dx, dy, held, o = null) => {');   // PIN MOVED (AUDIT 2026-10-01 part four, PAD-PULSE): the hook hears a held stroke's repeat
  assert.ok(at > 0, 'the hooks object\'s attack');
  const body = src.slice(at, src.indexOf('\n    },', at));
  const strike = body.indexOf('gatherHost?.strike(held, o?.repeat === true)');
  assert.ok(strike > 0, `the hook hands the press to the act:\n${body}`);
  assert.ok(strike < body.indexOf('if (!walkMode)'), 'before any gate - the act ends itself off the walk (gatherHost.tick)');
  assert.ok(strike < body.indexOf("if (modeNow() === 'exterior')"), 'and before the street and the modal rigs part');
  // a finger's tap mid-act is a strike, and arms no activation (it did nothing mid-act, AUDIT 32 H5) - asked right after
  // the decorator's flight, under which a tap is no press at all (DECOR1e's first line)
  const tapAt = src.indexOf('    tap: (x, y, opts = null) => {');
  const tap = src.slice(tapAt, src.indexOf('\n    },', tapAt));
  const [, first = '', second = ''] = tap.split('\n');
  assert.match(first, /^\s*if \(modes\?\.decorFlying\?\.\(\) \|\| yards\?\.flying\(\)\) return;/, `the tap's first line: ${first}`);
  // PIN MOVED (AUDIT 2026-10-01 part four, STICK-TAP): never the stick's lock-only tap, and after the view's own test (a
  // tap in the docked bar's strip is no tap) - its third line; test/fb1001_audit.test.js
  const third = tap.split('\n')[3] ?? '';
  assert.match(second, /^\s*if \(!ndcFromScreen\(x, y, /, `the tap's second line: ${second}`);
  assert.match(third, /^\s*if \(gatherHost\?\.acting\(\) && !opts\?\.lockOnly\) \{ gatherHost\.strike\(true\); gatherHost\.strike\(false\); return; \}/, `the tap's third line: ${third}`);
});

test('NODE-AIM: a boulder is found by looking at its stones - the look meets a node anywhere from its base to its aim point; past the base or the aim point by the cone, nothing (mutants: the aim point alone; the span past the base; the span past the aim point)', async () => {
  const s = await stage();
  try {
    const b = s.nodes('mine').find((n) => n.what === 'boulder');
    assert.ok(b, 'a boulder stands at its rock');
    assert.equal(b.lift, 1.2, 'its aim point 1.2 m up its four-metre rock');
    const [x, y, z] = b.local;
    s.face(b, [x, y + 0.1, z]);   // the loose stone at its foot, where its glow stands
    assert.equal(s.host.target?.node.key, b.key, 'the stones find it');
    assert.equal(s.prompt?.verb, 'Quarry the stone');
    s.face(b, [x, y + 0.6, z]);
    assert.equal(s.host.target?.node.key, b.key, 'and the rock between');
    s.face(b);
    assert.equal(s.host.target?.node.key, b.key, 'and its aim point, as before');
    // outside the span by more than the cone: no target - 1.5 m off at 1.5 m is far past NODE_AIM_DEG
    s.face(b, [x, y - 1.5, z]);
    assert.notEqual(s.host.target?.node.key, b.key, 'under the ground: none');
    s.face(b, [x, y + 3, z]);
    assert.notEqual(s.host.target?.node.key, b.key, 'over the aim point: none');
    assert.equal(NODE_AIM_DEG, 12);
  } finally { s.host.dispose(); setForagingHost(null); }
});

test('NODE-AIM: of the nodes in the cone the nearest the look that is SEEN is the target - one hidden behind its rock hides no other (mutants: only the nearest asked; the hidden one taken)', async () => {
  let hidden = null;
  const s = await stage({ clear: (from, to) => !hidden || Math.hypot(to[0] - hidden[0], to[2] - hidden[2]) > 0.01 });
  try {
    const a = s.nodes('mine').find((n) => n.what === 'vein');
    // a second vein a quarter metre east of it - about nine degrees round from 1.5 m, inside the cone
    const list = s.host.nodesOf(PX, PY);
    const b = { ...a, key: `${a.key}-b`, slot: 9, local: [a.local[0] + 0.25, a.local[1], a.local[2]] };
    list.push(b);
    s.face(a);
    assert.equal(s.host.target?.node.key, a.key, 'both seen: the nearest the look');
    hidden = a.local;
    s.face(a);
    assert.equal(s.host.target?.node.key, b.key, 'the nearest hidden: the next one seen');
    hidden = null;
    list.splice(list.indexOf(b), 1);
    hidden = a.local;
    s.face(a);
    assert.equal(s.host.target, null, 'nothing else in the cone: none');
  } finally { s.host.dispose(); setForagingHost(null); }
});

test('VEIN-CLEAR: a vein with no rock left to claim stands on stone outside every piece - never inside a rock, where no look reaches it (mutants: the stone tile inside a piece taken; the last fallback inside a piece taken)', () => {
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5);
  const law = veins({ x: PX, y: PY, day: DAY, climate: WOODS, region: GLENUMBRA });
  assert.ok(law.length >= 2, 'two veins or more');
  // ROCK-FOOT, ROCK-SHARE: a stone a metre across over each of the first veins' own tile corners - where its stone tile and
  // nature's ground stand - each one node's, as many as there are boulders; the boulders claim first and take them, so
  // those veins have no piece left (MORE-NODES: the Woodlands' four veins, three boulders)
  const nb = boulders({ x: PX, y: PY, day: DAY, climate: WOODS }).length;
  assert.ok(nb >= 2 && nb < law.length);
  const covered = law.slice(0, nb);
  const rocks = covered.map((v) => {
    const cx = Math.floor(v.u * 128) * (TERRAIN_SIZE / 128), cz = Math.floor(v.v * 128) * (TERRAIN_SIZE / 128);
    return [cx - 0.5, 0, cz - 0.5, cx + 0.5, 3, cz + 0.5];
  });
  const inside = (p) => rocks.some((r) => p[0] > r[0] && p[0] < r[3] && p[2] > r[2] && p[2] < r[5]);
  const stone = standMineNodes({ px: PX, py: PY, day: DAY, climate: WOODS, region: GLENUMBRA, samples, tilemap: new Uint8Array(128 * 128).fill(3), rocks });
  assert.deepEqual(stone.filter((n) => n.what === 'boulder').map((n) => rocks.indexOf(n.rock)).sort(), covered.map((_, i) => i), 'the boulders took the stones');
  const veinsStood = stone.filter((n) => n.what === 'vein');
  assert.equal(veinsStood.length, law.length, 'every vein stands - on the stone beside its own');
  for (const v of veinsStood) assert.equal(v.rock, null, 'no stone left for a vein');
  for (const v of veinsStood) assert.equal(inside(v.local), false, `vein ${v.slot} at ${v.local.map((c) => c.toFixed(1))} is outside the rock`);
  // no stone anywhere (grass): the last fallback, nature at the vein's own tile - inside its stone, so it stands nowhere
  const grass = standMineNodes({ px: PX, py: PY, day: DAY, climate: WOODS, region: GLENUMBRA, samples, tilemap: new Uint8Array(128 * 128).fill(2), rocks });
  const g = grass.filter((n) => n.what === 'vein' && n.slot < nb);
  assert.equal(g.length, 0, `no vein over a stone stands inside it (${g.length} of ${nb})`);
  for (const v of grass.filter((n) => n.what === 'vein')) assert.equal(inside(v.local), false);
  for (const b of grass.filter((n) => n.what === 'boulder')) assert.equal(inside(b.local), false);
});

test('ACT-CLICK: the act\'s strike is either button - the world host\'s input reads the swing\'s and the activation\'s press off the edge ring (a left click, Mouse0, strikes; E does not) (mutants: the click left out; the hold read for the press)', () => {
  const src = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const at = src.indexOf('gatherHost = createGatherHost({');
  const line = src.slice(src.indexOf('        input: () => ({', at), src.indexOf('\n', src.indexOf('        input: () => ({', at)));
  const body = line.slice(line.indexOf('() =>'), line.indexOf('}),') + 2);
  // the very closure, over the real edge ring and the shipped bindings
  const latch = { edge: keyEdges() };
  const keys = new Set();
  const csaRuntime = null;
  const input = new Function('held', 'pressed', 'latch', 'keys', 'csaRuntime', `return (${body});`)(held, pressed, latch, keys, csaRuntime);
  const frame = (code) => { if (code) { keys.add(code); noteKeyDown(latch.edge, code); } beginInputFrame(latch.edge); const r = input(); if (code) keys.delete(code); return r.attack; };
  assert.equal(frame('Mouse1'), true, 'the right button (SwingWeapon) strikes, as before');
  assert.equal(frame('Mouse0'), true, 'the left (ActivateCenterObject) strikes too');
  assert.equal(frame('KeyE'), false, 'E is the act\'s start and its hold, never a strike');
  assert.equal(frame(null), false, 'no press, no strike');
  // a click held over frames strikes once - the press, never the hold
  keys.add('Mouse0'); noteKeyDown(latch.edge, 'Mouse0');
  beginInputFrame(latch.edge);
  assert.equal(input().attack, true, 'pressed');
  beginInputFrame(latch.edge);
  assert.equal(input().attack, false, 'held: no second strike');
  keys.delete('Mouse0');
});
