// AUDIT MERGE-PLUS, lens B (2026-09-26, the pre-merge audit of the Enhanced Plus patch: the online fx, the quickslots,
// the pad). What the audit found, each pinned on the code it was found in. A blow I struck in a dungeon or a building
// went out through the OVERWORLD's map and landed millions of units from anyone who could have seen it (B1). A torch
// slot whose last torch had burnt out, pressed under a raised shield, took the shield off, refused, put it back - and
// billed the swap's three seconds without a swing, said by nothing (B2). A party mate back from a dungeon replayed the
// last blow and hurt they had carried away, at a point long stale (B3); a modified client's pose said a new blow and a
// new hurt on every frame it sent, and its light's radius of 63 lit a whole dungeon (B6). A d-pad tap that a window or
// a dropped pad interrupted fired once the window closed or the pad came back (B4). And the Plus legend said "LB:
// Transport" over a button the crossbar swallows (B5).
//
// Everything is DRIVEN - the peer-fx player on a hand-wound clock, the hotbar's press through the host's own doors,
// the light reader, the pad's poller at sixty ticks a second, the legend - but B1, whose two laws live inside
// world.js's boot. That slice is MOUNTED from comment-stripped source (test/auditpscale1.test.js's way: a line inside a
// comment is a line that is gone) and a real blow is struck through it, sender to receiver, in every mode; the three
// facts of the wiring are pinned beside it, and say so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { noteMyBlow, poseFx, createPeerFxPlayer, FX_MIN_GAP_S, _resetPeerFxForTests } from '../src/net/peerFx.js';
import { validPose, POSE_HZ_MAX } from '../src/net/wire.js';
import { StreamingWorldState } from '../src/world/streamingWorld.js';
import * as HB from '../src/systems/quickslots.js';
import { equipTableOf, EQUIP_SLOTS, equipItem, isEquipped } from '../src/systems/equip.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import {
  peerLightRangeMax, peerTorchLight, torchPoseByte, torchRange, PEER_LIGHT_RADIUS_MAX, GUTTER_BASE, GUTTER_SWING,
  ITEM_BASED_TORCH_INTENSITY,
} from '../src/systems/playerTorch.js';
import { createBindings, resetDefaults, getBinding, setBinding } from '../src/systems/inputActions.js';
import { applyPlusPadLayout, registerCrossbar, CROSSBAR_HOLD, PLUS_PAD_LAYOUT_VERSION } from '../src/ui/plusPad.js';
import { plusPadLegend } from '../src/ui/plusPadBinds.js';
import { setBindings } from '../src/ui/input.js';
import { attachGamepad } from '../src/ui/gamepadInput.js';
import { setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { _resetForTests as resetSettings } from '../src/systems/settings.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const mount = (src, scope, tail) => { const k = Object.keys(scope); return new Function(...k, `${src}\n${tail}`)(...k.map((x) => scope[x])); };
/** The statement that starts at `from`, through its own `;` - brackets and strings stepped over. */
function statementAt(text, from) {
  let depth = 0, quote = null;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '\'' || c === '"' || c === '`') quote = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ';' && depth === 0) return text.slice(from, i + 1);
  }
  throw new Error(`no end to the statement at ${from}`);
}

// ── B1: the struck point, in the mode's own frame ─────────────────────────────────────────────────────────────────

/** THE BOOT'S TWO LAWS, AS WORLD.JS HOLDS THEM: the overworld's own (`campToWire`), the two declared beside the pose
 *  (`onlineToScene` and its inverse `sceneToOnline`), the splash observer that hands a blow of mine to PEERFX1, and the
 *  frame's per-mode slice (`shedY`, the pose, both laws re-written) - each a whole statement of the stripped source. */
function bootSlices() {
  const W = strip(read('src/scenes/world.js'));
  const one = (head) => {
    const i = W.indexOf(head);
    assert.ok(i >= 0, `world.js has no \`${head}\``);
    assert.equal(W.indexOf(head, i + 1), -1, `\`${head}\` stands once`);
    return statementAt(W, i);
  };
  const frame = [];
  for (let i = W.indexOf('const shedY = '); i >= 0;) {
    while (/\s/.test(W[i])) i++;
    const s = statementAt(W, i);
    if (!/^(?:const shedY|const pose|onlineToScene|sceneToOnline) =/.test(s)) break;
    frame.push(s); i += s.length;
  }
  assert.ok(frame.length >= 3, 'the frame\'s slice: shedY, the pose and its law');
  return {
    W, camp: one('const campToWire = '), toScene: one('let onlineToScene = '), toWire: one('let sceneToOnline = '),
    observer: one('setSplashObserver((bloodIndex, pos, hit) =>'), frame: frame.join('\n'),
  };
}
/** One player's boot, as far as a blow of theirs goes - their floating origin, where they stand, the laws, the
 *  observer (strict, as the module is), and a frame in a given mode. */
function bootOf(slices, { origin, comp, pos }) {
  const state = new StreamingWorldState();
  state.mapOrigin = { ...origin };
  state.compensation = comp.slice();
  const player = { pos: pos.slice() };
  let observer = null;
  const host = mount(
    `'use strict';\n${slices.camp}\n${slices.toScene}\n${slices.toWire}\n${slices.observer}\n`
      + `const frameIn = (mode) => { const overworld = mode === 'exterior'; const wc = state.worldCoords(player.pos);\n${slices.frame}\nreturn pose; };`,
    { state, player, cam: { yaw: 0.5, pitch: -0.1 }, noteMyBlow, peerFxPlayer: { splashed() {} }, setSplashObserver: (fn) => { observer = fn; } },
    'return { frameIn, toScene: (p) => onlineToScene(p), campToWire };');
  return { ...host, strike: (pos) => observer(3, pos.slice(), { fromPlayer: true, damage: 5, maxHealth: 20 }) };
}
const near = (a, b, msg) => assert.ok(a.length === b.length && a.every((v, k) => Math.abs(v - b[k]) < 1e-6), `${msg}: ${JSON.stringify(a)}, not ${JSON.stringify(b)}`);
const minus = (a, b) => a.map((v, k) => v - b[k]);

test('AUDIT MERGE-PLUS B1 the struck point rides the mode\'s own law, by source: `sceneToOnline` declared beside `onlineToScene` (the overworld\'s law until a frame says otherwise), the splash observer hands PEERFX1 that live law and never the overworld\'s, and every frame writes it from the mode, right after its inverse (mutants: the splash back on campToWire, the per-frame law never written, no law declared)', () => {
  const { W, frame } = bootSlices();
  assert.match(W, /let onlineToScene = \(p\) => \[p\.x, p\.y, p\.z\];\s+let sceneToOnline = campToWire;/, 'declared beside the pose\'s own law');
  assert.match(W, /setSplashObserver\(\(bloodIndex, pos, hit\) => \{ peerFxPlayer\.splashed\(pos\); if \(hit\?\.fromPlayer\) noteMyBlow\(pos, bloodIndex, hit, \(q\) => sceneToOnline\(q\)\); \}\);/, 'my blow goes out through the law of the frame it was struck in');
  assert.ok(!/noteMyBlow\([^;]*campToWire/.test(W), 'no blow of mine is mapped by the overworld\'s law alone');
  assert.match(frame, /\(p\) => \[p\.x, shedY \? p\.y \+ state\.compensation\[1\] : p\.y, p\.z\];\s*sceneToOnline = overworld \? campToWire : \(q\) => \[q\[0\], shedY \? q\[1\] - state\.compensation\[1\] : q\[1\], q\[2\]\];$/, 'written each frame, beside its inverse');
  assert.equal((W.match(/\bsceneToOnline =/g) ?? []).length, 2, 'the declaration and the frame, nowhere else');
});

test('AUDIT MERGE-PLUS B1 a blow struck in the overworld, a building or a dungeon lands, on the receiver\'s screen, where it was struck beside the striker\'s body - the boot\'s slice MOUNTED and a real blow struck through it (validPose, the peer-fx player, the receiver\'s own law); in a dungeon, the very point. Before, it went out through the overworld\'s law in every mode and landed millions of units away (mutants: the splash back on campToWire, the per-frame law never written, no law declared)', () => {
  const slices = bootSlices();
  const P = [12.5, -3, 40.25];     // the striker, in their own scene
  const Q = [13.25, -1.75, 41.5];  // the foe's chest they struck
  try {
    for (const mode of ['exterior', 'interior', 'dungeon']) {
      _resetPeerFxForTests();
      const me = bootOf(slices, { origin: { x: 207, y: 213 }, comp: [30, 4, -20], pos: P });
      const them = bootOf(slices, { origin: { x: 206, y: 214 }, comp: [-8, -2.5, 11], pos: [0, 0, 0] });
      const pose = me.frameIn(mode);
      them.frameIn(mode);
      // the pose's own law: a blow struck where I stand goes out where my pose says I stand
      me.strike(P);
      assert.deepEqual(poseFx().hp, [pose.x, pose.y, pose.z], `${mode}: my blow's point and my body ride one law`);
      me.strike(Q);
      const before = validPose({ ...pose });
      const wire = validPose({ ...pose, ...poseFx() });
      assert.equal(wire.hk, 2, `${mode}: the blow rides the pose`);
      assert.ok(wire.hp, `${mode}: its point passes the wire's door`);
      let t = 0;
      const blows = [];
      const fx = createPeerFxPlayer({ toScene: them.toScene, now: () => t, play: { blow: (b) => blows.push(b) } });
      fx.update('striker', before, them.toScene(before));
      fx.frame();
      fx.update('striker', wire, them.toScene(wire));
      t = 1; fx.frame();
      assert.equal(blows.length, 1, `${mode}: the blow plays once`);
      near(minus(blows[0].at, them.toScene(wire)), minus(Q, P), `${mode}: where it was struck, beside the striker's drawn body`);
      if (mode === 'dungeon') near(blows[0].at, Q, 'a dungeon\'s frame is its own and shared: the very point');
    }
    // one host, frame after frame: the law is the overworld's until a frame runs, then each frame's own mode
    _resetPeerFxForTests();
    const me = bootOf(slices, { origin: { x: 207, y: 213 }, comp: [30, 4, -20], pos: P });
    me.strike(Q);
    assert.deepEqual(poseFx().hp, me.campToWire(Q), 'before the first frame: the overworld\'s law, the declaration\'s');
    for (const mode of ['dungeon', 'exterior', 'interior', 'dungeon']) {
      const pose = me.frameIn(mode);
      me.strike(P);
      assert.deepEqual(poseFx().hp, [pose.x, pose.y, pose.z], `${mode}, re-entered: the frame wrote its own law`);
    }
  } finally { _resetPeerFxForTests(); }
});

// ── B2: a ghosted light slot under a raised shield ────────────────────────────────────────────────────────────────

const kite = () => ({ group: 'Armor', templateIndex: 111, material: 0, name: 'Kite Shield', currentCondition: 80, maxCondition: 100 });
const lightOf = (templateIndex, name, currentCondition = 40) => ({ group: 'UselessItems2', templateIndex, name, currentCondition, maxCondition: 100 });
const body = (items) => ({ isPlayer: true, level: 5, career: {}, activeEffects: [], spells: [], stats: {}, items, lightSource: null });
/** A shield raised, `light` on hotbar slot 0, `pause` of the equip delay already running - and the host's doors: the
 *  pack's own Use behind quickUse, one popup channel for the hotbar and the door both, every knock logged with
 *  whether the shield was on the arm when it came. */
function shieldUp(light, { pause = 0 } = {}) {
  HB.clearQuickslots();
  const sh = kite();
  const me = body([sh, light]);
  equipItem(me, sh);
  me.equipCountdown = pause;
  HB.setHotbarSlot(0, HB.hotbarEntryForItem(light));
  const said = [];
  const say = (line) => said.push(line);
  const knocks = [];
  const doors = { quickUse: (n) => { knocks.push({ n, shieldOn: isEquipped(sh) }); HB.useQuickslot('c1', { entity: me, items: me.items, say }); return true; } };
  return { sh, me, said, knocks, press: () => HB.hotbarPress(0, { entity: me, doors, say }) };
}

test('AUDIT MERGE-PLUS B2 a torch slot whose last torch is gone, pressed under a raised shield, is refused before the shield moves: "You have no Torch.", no door knocked on, the shield never off the arm, the equip pause as it was (it came off, the pack said "You have no Torch left.", it went back on, and three seconds without a swing were billed) (mutants: the ghost refused only after the shield came off)', () => {
  try {
    assert.equal(HB.HOTBAR_TEXT.lightGone('Torch'), 'You have no Torch.');
    for (const pause of [0, 777]) {
      const r = shieldUp(lightOf(TEMPLATES.Torch, 'Torch'), { pause });
      r.me.items = [r.sh];   // the last torch burnt out, or was sold: the slot is a ghost
      assert.equal(HB.hotbarView(r.me)[0].ghost, true, 'the rig: a ghost slot');
      assert.deepEqual(r.press(), { kind: 'refused', name: 'Torch' });
      assert.deepEqual(r.said, ['You have no Torch.'], 'said once, by the hotbar');
      assert.deepEqual(r.knocks, [], 'the pack\'s Use is never asked');
      assert.equal(equipTableOf(r.me)[EQUIP_SLOTS.LeftHand], r.sh, 'the shield is where it was');
      assert.equal(r.me.equipCountdown, pause, `no swap happened, so no swap's pause (${pause} stays ${pause})`);
    }
  } finally { HB.clearQuickslots(); }
});

test('AUDIT MERGE-PLUS B2 a light that will not light - a Lantern with no oil, the one light a dead flame leaves in the pack - takes the shield off, puts it back, and leaves the equip pause what it was before the press; a torch that lights is a real swap and still pays for it (mutants: the refusal leaves the pause billed)', () => {
  try {
    for (const pause of [0, 1234]) {
      const r = shieldUp(lightOf(TEMPLATES.Lantern, 'Lantern', 0), { pause });
      assert.equal(HB.hotbarView(r.me)[0].ghost, false, 'the rig: no ghost - the lantern is in the pack');
      assert.equal(r.press().kind, 'refused');
      assert.deepEqual(r.knocks.map((k) => k.shieldOn), [false], 'the shield came off for the light (SHIELD1)');
      assert.equal(equipTableOf(r.me)[EQUIP_SLOTS.LeftHand], r.sh, 'and went back on');
      assert.equal(r.me.lightSource, null, 'nothing lit');
      assert.equal(r.me.equipCountdown, pause, `the shield is back where it was - nothing changed hands, nothing billed (${pause} stays ${pause})`);
    }
    const lit = shieldUp(lightOf(TEMPLATES.Torch, 'Torch'));
    assert.equal(lit.press().kind, 'light');
    assert.equal(isEquipped(lit.sh), false, 'the shield came off');
    assert.ok(lit.me.equipCountdown > 0, 'and a torch went up in its place: that swap is billed');
  } finally { HB.clearQuickslots(); }
});

// ── B3 / B6: the others' blows and hurts ──────────────────────────────────────────────────────────────────────────

/** The peer-fx player on a hand-wound clock, each play logged with the time it played. `maps` holds every Map it
 *  built - its store of the peers it has seen is one, caught as it is made: the only way to see what it keeps. */
function fxRig() {
  let t = 0;
  const log = [];
  const maps = [];
  const RealMap = globalThis.Map;
  globalThis.Map = class extends RealMap { constructor(...a) { super(...a); maps.push(this); } };
  let fx;
  try {
    fx = createPeerFxPlayer({
      toScene: (p) => [p.x, p.y, p.z], now: () => t,
      play: { blow: (b) => log.push(['blow', t, b.at]), hurt: (b) => log.push(['hurt', t, b.at]), flinch: (id) => log.push(['flinch', t, id]) },
    });
  } finally { globalThis.Map = RealMap; }
  return { fx, log, maps, at: (v) => { t = v; }, now: () => t, of: (kind) => log.filter((e) => e[0] === kind) };
}

test('AUDIT MERGE-PLUS B3 the peer back from absence: a party mate who left the room (dropped from its peers, never forgotten) and came back with both counters moved replays NOTHING - no flash, no ring, no splash; a frame without them is absence enough; their counters are taken as they are, so the next new blow and hurt play once each (mutants: a returning peer not seen afresh, the frame counter never advanced)', () => {
  const r = fxRig();
  const peers = new Map();
  // world.js peerFxFrame: every peer in the room I can see, once a frame, then the frame
  const frame = () => { for (const [id, p] of peers) r.fx.update(id, p, [p.x, p.y, p.z], 1.8); r.fx.frame(); r.at(r.now() + 1 / 60); };
  peers.set('P', { x: 0, y: 0, z: 0, hk: 3, hp: [1, 1, 1], hu: 2, uq: 20 });
  frame(); frame();
  assert.deepEqual(r.log, [], 'a first sight plays nothing (PEERFX1)');
  peers.delete('P');   // into a dungeon: {t:'leave'} drops them from online.peers, and nothing forgets them
  for (let i = 0; i < 120; i++) frame();
  peers.set('P', { x: 50, y: 0, z: 50, hk: 9, hp: [400, 1, -300], hu: 5, uq: 60 });   // they fought down there, and come back out
  for (let i = 0; i < 60; i++) frame();
  assert.deepEqual(r.log, [], 'the blow and the hurt they carried away are not played on their return');
  Object.assign(peers.get('P'), { hk: 10, hp: [51, 1, 51], hu: 6 });
  for (let i = 0; i < 60; i++) frame();
  assert.deepEqual(r.log.map((e) => e[0]).sort(), ['blow', 'flinch', 'hurt'], 'the next new ones play, once each');
  assert.deepEqual(r.of('blow')[0][2], [51, 1, 51], 'at the new blow\'s point');
  // one frame missed is a peer gone
  const q = fxRig();
  const pose = (hk, hu) => ({ x: 0, y: 0, z: 0, hk, hp: [1, 1, 1], hu, uq: 20 });
  q.fx.update('P', pose(3, 2), [0, 0, 0], 1.8); q.fx.frame();
  q.fx.update('P', pose(3, 2), [0, 0, 0], 1.8); q.fx.frame();
  q.fx.frame();   // a frame without them
  q.at(1); q.fx.update('P', pose(4, 3), [0, 0, 0], 1.8); q.fx.frame();
  q.at(2); q.fx.frame();
  assert.deepEqual(q.log, [], 'their first pose back is a first sight');
});

test('AUDIT MERGE-PLUS B3 a peer seen every frame is never taken for one come back: at sixty frames a second, a blow and a hurt every 31 frames all play, on odd frames and even; and a blow the foe\'s owner already drew is still skipped - PEERFX1\'s dedupe, which test/peerfx1.test.js\'s last step now reaches only through the re-seed (mutants: the entry never refreshed)', () => {
  const r = fxRig();
  let hk = 1, hu = 1;
  const pose = () => ({ x: 0, y: 0, z: 0, hk, hp: [hk * 3, 1, 0], hu, uq: 20 });
  const frames = (n, onFrame = () => {}) => {
    for (let i = 0; i < n; i++) { onFrame(i); r.fx.update('P', pose(), [0, 0, 0], 1.8); r.fx.frame(); r.at(r.now() + 1 / 60); }
  };
  frames(1);   // the first sight
  frames(31 * 7, (i) => { if (i % 31 === 30) { hk++; hu++; } });
  frames(60);
  assert.equal(r.of('blow').length, 7, `every blow: ${JSON.stringify(r.of('blow').map((e) => e[2]))}`);
  assert.equal(r.of('hurt').length, 7, 'every hurt');
  assert.equal(r.of('flinch').length, 7, 'every flash');
  // the owner's own splash, drawn within a metre while this one waited its delay: not drawn twice
  hk++;
  frames(3);
  r.fx.splashed([hk * 3 + 0.3, 1, 0]);
  frames(60);
  assert.equal(r.of('blow').length, 7, 'the owner drew that one already');
});

test('AUDIT MERGE-PLUS B3 the store of peers seen is bounded: a hundred seen once and gone are dropped once it holds more than 64 and a frame has passed without them; the ones still seen are kept whole (their next blow plays); 64 are no burden and stay for their first sight again (mutants: the store unbounded)', () => {
  const r = fxRig();
  const at = (i, hk = 1) => ({ x: 0, y: 0, z: 0, hk, hp: [i * 10, 1, 0] });
  for (let i = 0; i < 100; i++) r.fx.update(`p${i}`, at(i), [0, 0, 0]);
  const seen = r.maps.find((m) => m.has('p0') && m.has('p99'));
  assert.ok(seen, 'the rig: the player\'s store, caught as it was built');
  assert.equal(seen.size, 100);
  r.fx.frame();
  assert.equal(seen.size, 100, 'all were seen on the frame just drawn');
  const live = ['p0', 'p1', 'p2'];
  for (let f = 0; f < 3; f++) { for (const id of live) r.fx.update(id, at(Number(id.slice(1))), [0, 0, 0]); r.fx.frame(); }
  assert.deepEqual([...seen.keys()].sort(), live, 'the gone are dropped, the seen kept');
  r.at(1);
  for (const id of live) r.fx.update(id, at(Number(id.slice(1)), 2), [0, 0, 0]);
  r.fx.frame();
  r.at(2); r.fx.frame();
  assert.equal(r.of('blow').length, 3, 'kept whole: a new blow of each still plays');
  const few = fxRig();
  for (let i = 0; i < 64; i++) few.fx.update(`p${i}`, at(i), [0, 0, 0]);
  for (let f = 0; f < 5; f++) few.fx.frame();
  assert.equal(few.maps.find((m) => m.has('p0')).size, 64, 'a bound, not a sweep');
});

test('AUDIT MERGE-PLUS B6 a pose that says a new blow and a new hurt on every frame it may send (a modified client at the relay\'s POSE_HZ_MAX for ten seconds, the point in the victim\'s face) plays each at most once per FX_MIN_GAP_S - blood, ring and flash - where it played all of them (mutants: a peer\'s blows ungated, a peer\'s hurts ungated)', () => {
  assert.equal(FX_MIN_GAP_S, 0.25, 'no swing, shot or string of hits lands faster');
  const r = fxRig();
  for (let i = 0; i <= POSE_HZ_MAX * 10; i++) {
    r.at(i / POSE_HZ_MAX);
    const pose = validPose({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, hk: i + 1, hp: [40.5, 1.6, i % 2 ? 0.75 : -0.75], hb: 63, hq: 100, hu: i + 1, uq: 100 });
    r.fx.update('griefer', pose, [0, 0, 0], 1.8);
    r.fx.frame();
  }
  r.at(r.now() + 1); r.fx.frame();
  const cap = Math.floor(10 / FX_MIN_GAP_S) + 1;
  for (const kind of ['blow', 'hurt', 'flinch']) {
    const n = r.of(kind).length;
    assert.ok(n > 0 && n <= cap, `${kind}: ${n} in ten seconds - at most ${cap}, where every one of the ${POSE_HZ_MAX * 10} played`);
  }
  const flashes = r.of('flinch').map((e) => e[1]);
  for (let k = 1; k < flashes.length; k++) assert.ok(flashes[k] - flashes[k - 1] >= FX_MIN_GAP_S - 1e-9, `flashes at ${flashes[k - 1]} and ${flashes[k]}`);
});

test('AUDIT MERGE-PLUS B6 the gap is each kind\'s own, and an honest fight loses nothing: a blow and a hurt in one pose both play; a blow, or a hurt, inside FX_MIN_GAP_S of the last one played does not, and one a whole FX_MIN_GAP_S after does; a blow and a hurt every half second for five seconds all play (mutants: a peer\'s blows ungated, a peer\'s hurts ungated)', () => {
  const r = fxRig();
  const step = (t, hk, hu) => { r.at(t); r.fx.update('P', { x: 0, y: 0, z: 0, hk, hp: [hk * 3, 1, 0], hu, uq: 50 }, [0, 0, 0], 2); r.fx.frame(); };
  step(0, 1, 1);        // the first sight
  step(0.0625, 2, 2);   // a blow and a hurt at once
  step(0.25, 3, 2);     // a blow 0.1875 s after it
  step(0.3125, 4, 2);   // a blow exactly FX_MIN_GAP_S after the one that played
  step(0.375, 4, 3);    // a hurt 0.3125 s after the last
  step(0.4375, 4, 4);   // a hurt 0.0625 s after that
  step(0.625, 4, 5);    // a hurt exactly FX_MIN_GAP_S after the one that played
  step(1, 4, 5); step(2, 4, 5);
  assert.deepEqual(r.of('blow').map((e) => e[2]), [[6, 1, 0], [12, 1, 0]], 'the blows at 0.0625 and 0.3125; not the one between');
  assert.deepEqual(r.of('flinch').map((e) => e[1]), [0.0625, 0.375, 0.625], 'the hurts at 0.0625, 0.375 and 0.625; not the one between');
  assert.equal(r.of('hurt').length, 3);
  const honest = fxRig();
  let hk = 1, hu = 1;
  for (let f = 0; f <= 60 * 5; f++) {
    honest.at(f / 60);
    if (f && f % 30 === 0) { hk++; hu++; }
    honest.fx.update('P', { x: 0, y: 0, z: 0, hk, hp: [hk * 3, 1, 0], hu, uq: 20 }, [0, 0, 0], 1.8);
    honest.fx.frame();
  }
  honest.at(10); honest.fx.frame();
  assert.equal(honest.of('blow').length, 10, 'every blow half a second apart');
  assert.equal(honest.of('hurt').length, 10, 'every hurt');
});

test('AUDIT MERGE-PLUS B6 a peer\'s light reads no wider than the widest light the game has - the Lantern\'s 16, the brightest of the Torch\'s, Lantern\'s and Candle\'s templates - whatever radius the pose says (the wire lets 63 through); a guttering one flickers from the clamp; the game\'s own lights each read their whole radius (mutants: a peer\'s light unclamped)', () => {
  const ranges = [TEMPLATES.Torch, TEMPLATES.Lantern, TEMPLATES.Candle].map((templateIndex) => torchRange({ templateIndex }));
  assert.deepEqual(ranges, [14, 16, 8], 'the Torch, the Lantern, the Candle');
  assert.equal(peerLightRangeMax(), Math.max(...ranges));
  const widest = validPose({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, lt: 1e9 });
  assert.equal(widest.lt >> 1, PEER_LIGHT_RADIUS_MAX, 'the wire\'s bound: a radius of 63');
  for (const lt of [34, 64, 100, widest.lt & ~1]) assert.equal(peerTorchLight({ lt, yaw: 0 }, [0, 0, 0]).range, 16, `lt ${lt} (radius ${lt >> 1}) reads 16 here`);
  assert.ok(widest.lt & 1, 'the rig: the widest pose gutters');
  assert.ok(Math.abs(peerTorchLight(widest, [0, 0, 0], 0).range - 16 * (GUTTER_BASE + GUTTER_SWING) / ITEM_BASED_TORCH_INTENSITY) < 1e-9, 'guttering, from 16 - not from 63');
  for (const [templateIndex, radius] of [[TEMPLATES.Torch, 14], [TEMPLATES.Lantern, 16], [TEMPLATES.Candle, 8]]) {
    const lt = torchPoseByte({ _torch: { range: radius }, lightSource: { templateIndex, currentCondition: 40 } });
    assert.equal(peerTorchLight({ lt, yaw: 0 }, [0, 0, 0]).range, radius, `an honest light reads whole: ${radius}`);
  }
});

// ── B4 / B5: the pad ──────────────────────────────────────────────────────────────────────────────────────────────

const LEFT = 14, DOWN = 13, LB = 4, RB = 5;   // the standard mapping's button indices
/** The Plus pad under the crossbar (the hotbar in Plus with a pad in hand), polled at sixty ticks a second -
 *  test/padplus10.test.js's rig. `store` is laid out already; the one-time Plus move is stamped as done. */
function padRig({ store = null, overlay = () => false, inForce = () => true } = {}) {
  const prev = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  resetPrefs(); resetSettings();
  const b = store ?? (() => { const s = createBindings(); resetDefaults(s); applyPlusPadLayout(s); return s; })();
  setPref('plusPadLayout', PLUS_PAD_LAYOUT_VERSION);
  setBindings(b);
  registerCrossbar({ inForce, press() {}, setActive() {} });
  const events = [];
  const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  let pads = [pad];
  const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
  const gp = attachGamepad(canvas, { overlayActive: overlay, paused: overlay, attack() {}, look() {} }, {
    getPads: () => pads, dispatch: (type, code) => events.push(`${type}:${code}`), makeEvent: (type, init) => ({ type, ...init }),
  });
  return {
    store: b, events,
    key: (action) => `keydown:${getBinding(b, action)}`,
    keydowns: () => events.filter((e) => e.startsWith('keydown')),
    tick: (n = 1) => { for (let i = 0; i < n; i++) gp.tick(1 / 60); },
    down: (i) => { pad.buttons[i] = { pressed: true, value: 1 }; },
    up: (i) => { pad.buttons[i] = { pressed: false, value: 0 }; },
    unplug: () => { pads = []; }, plug: () => { pads = [pad]; },
    dispose: () => { gp.dispose(); registerCrossbar(null); setBindings(null); resetPrefs(); resetSettings(); globalThis.window = prev; },
  };
}

test('AUDIT MERGE-PLUS B4 a d-pad press a window interrupts is forgotten: left pressed (a tap is the quest log), a window up - a dialog, a loot window - and let go under it, or still held when it closes: the quest log does not open once the window is gone; a tap with no window between still opens it (mutants: a window keeps the d-pad press)', () => {
  let overlay = false;
  const pad = padRig({ overlay: () => overlay });
  try {
    pad.tick();
    pad.events.length = 0;
    pad.down(LEFT); pad.tick(6);
    overlay = true; pad.tick(3);
    pad.up(LEFT); pad.tick(30);
    overlay = false; pad.tick(3);
    assert.deepEqual(pad.keydowns(), [], 'let go under the window: nothing once it closed');
    pad.down(LEFT); pad.tick(6);
    overlay = true; pad.tick(30);
    overlay = false; pad.tick(40);
    pad.up(LEFT); pad.tick(3);
    assert.deepEqual(pad.keydowns(), [], 'held through the window: nothing when it closed, nothing on the release');
    pad.down(LEFT); pad.tick(6);
    pad.up(LEFT); pad.tick(3);
    assert.deepEqual(pad.keydowns(), [pad.key('LogBook')], 'a tap with no window between is the quest log');
  } finally { pad.dispose(); }
});

test('AUDIT MERGE-PLUS B4 a d-pad press the pad drops is forgotten: down pressed (a tap is the map), the pad gone for a second - a battery, Bluetooth - and back with nothing pressed: the map does not open; a tap on a pad that stays opens it (mutants: a dropped pad keeps the d-pad press)', () => {
  const pad = padRig();
  try {
    pad.tick();
    pad.events.length = 0;
    pad.down(DOWN); pad.tick(6);
    pad.unplug(); pad.tick(60);
    pad.up(DOWN);
    pad.plug(); pad.tick(3);
    assert.deepEqual(pad.keydowns(), [], 'the map is not opened by a press the pad dropped');
    pad.down(DOWN); pad.tick(6);
    pad.up(DOWN); pad.tick(3);
    assert.deepEqual(pad.keydowns(), [pad.key('AutoMap')], 'a tap is the map');
  } finally { pad.dispose(); }
});

test('AUDIT MERGE-PLUS B5 the legend says LB and RB are the crossbar\'s while it holds them: rows the player kept on the bumpers from before Plus (Transport on LB, the character sheet on RB) read "... (off while the crossbar holds it)" - as the pad has it, each bumper sending nothing - and their plain names once the crossbar lets the bumpers go, as each then sends its own; the menu\'s call, with no word of the crossbar, asks the pad; no other row changes (mutants: the row labelled as before, the menu\'s legend never asking the crossbar)', () => {
  const [LB_CODE, RB_CODE] = CROSSBAR_HOLD;
  const store = createBindings();
  resetDefaults(store);
  setBinding(store, LB_CODE, 'Transport', false);        // the player's own bumper rows, from before Plus
  setBinding(store, RB_CODE, 'CharacterSheet', false);
  applyPlusPadLayout(store);
  assert.deepEqual([getBinding(store, 'Transport', false), getBinding(store, 'CharacterSheet', false)], [LB_CODE, RB_CODE], 'the rig: the one-time Plus move keeps the buttons the player bound');
  let xb = true;
  const pad = padRig({ store, inForce: () => xb });
  const bump = (i) => { pad.tick(); pad.events.length = 0; pad.down(i); pad.tick(5); pad.up(i); pad.tick(); return pad.keydowns(); };
  try {
    const onBumper = ([codes]) => codes.length === 1 && CROSSBAR_HOLD.includes(codes[0]);
    const held = plusPadLegend(store, { crossbar: true }), free = plusPadLegend(store, { crossbar: false });
    assert.deepEqual(held.filter(onBumper), [[[LB_CODE], 'Transport (off while the crossbar holds it)'], [[RB_CODE], 'Character sheet (off while the crossbar holds it)']]);
    assert.deepEqual(free.filter(onBumper), [[[LB_CODE], 'Transport'], [[RB_CODE], 'Character sheet']]);
    assert.deepEqual(held.filter((r) => !onBumper(r)), free.filter((r) => !onBumper(r)), 'no other row changes - the crossbar\'s own, the d-pad\'s Transport hold');
    assert.deepEqual(plusPadLegend(store), held, 'the menu\'s call asks the pad: the crossbar is in force');
    assert.deepEqual([bump(LB), bump(RB)], [[], []], 'and so it is: neither bumper sends a thing while the crossbar holds them');
    xb = false;
    assert.deepEqual(plusPadLegend(store), free, 'the crossbar let go: the menu\'s legend says the plain names');
    assert.deepEqual([bump(LB), bump(RB)], [[`keydown:${LB_CODE}`], [`keydown:${RB_CODE}`]], 'and each bumper sends its own');
  } finally { pad.dispose(); }
});
