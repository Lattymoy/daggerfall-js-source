// AUDIT NAV1 (2026-09-29, Mac: "Lets do a deep comprehensive audit and ensure this is perfection. I want ship movement
// and combat to flow perfectly, just like assisins creed black flag") - THE PRESENTATION, the audit's fifth slice
// (bible/03-World/Naval-Combat.md "The presentation"): what the player sees and hears of a sea fight. First, going
// down: the kill is the frame a player watches closest, and it ended in a pop - the laws, and the host through real
// frames over Come Sail Away's real pool (test/navalSea.mjs), each hull's own meshes measured as drawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sea, seeded } from './navalSea.mjs';
import { sparsOf, FLAME_AWASH, BLAST_SHAKE, NEAR_BOOM_M, FAR_FADE_M, FAR_MATCH, GUN_PITCH_JITTER, GUN_GAIN_JITTER_DB, HIT_CONFIRM_REF_M, HIT_BURST_MAX, GUN_KICK, NEAR_LIFE_M, FAR_LIFE_EVERY,
  NAVAL_TAG_RANGE, NAVAL_TAG_NEAR, NAVAL_TAG_MAX, TAG_LIFT, SAIL_HO_RANGE, SAIL_HO_GAP_S, SAIL_HO_CHECK_S, bearingWords, withArticle,
  SMOKE_FROM, SMOKE_SPAN, DAMAGE_LIST_FROM, DAMAGE_LIST_MAX, DAMAGE_LIST_EASE_S, TIMBER_PER_HIT, sailsShown, lineOver } from '../src/scenes/navalHost.js';
import { createNavalEffects, TIMBER_LIFE, SMOLDER_RATE } from '../src/systems/naval/navalEffects.js';
import { drawNavalTags, tagState, tagAlpha, TAG_FADE_FROM, TAG_FADE_TO } from '../src/ui/navalHud.js';
import { NAVY_HUNTS } from '../src/systems/naval/navalAI.js';
import { NavalRenderer, NAVAL_GL_TEXTURES, NAVAL_STRIDE, ARC_WIDTH_VH, ARC_DASH_M, ARC_DASH_SPEED } from '../src/render/navalRender.js';
import { READY_FLASH_S } from '../src/systems/naval/navalGunnery.js';
import { NAVAL_SFX, NAVAL_SOUND_RANGE, NAVAL_CLASSIC, NAVAL_SINK_LOOP } from '../src/systems/naval/navalSounds.js';
import { navalHudText, drawNavalHud, destroyNavalHud, NAVAL_HUD_CSS, CARD_HIT_S, platePlace, cardScale, cardTopPx, navalPadPrompts, NAVAL_PLATE_BOTTOM, NAVAL_PLATE_TOUCH_BOTTOM,
  PLATE_GAP, PLATE_SCALE_MIN, PLATE_LAYOUT_S, NAVAL_SHORT_H, NAVAL_CARD_H, CARD_SCALE_MIN, NAVAL_CARD_GAP, NAVAL_WARN_UP, NAVAL_WARN_UP_SHORT, NAVAL_AIM_DOWN, NAVAL_AIM_DOWN_SHORT,
  NAVAL_CROSS_R, NAVAL_STACK_H, NAVAL_STACK_HALF, NAVAL_WARN_H, NAVAL_WARN_HALF, NAVAL_WARN_HALF_TOUCH, NAVAL_BRACE_H, NAVAL_BRACE_W, NAVAL_CARD_ASIDE_H, NAVAL_PLATE_W } from '../src/ui/navalHud.js';
import { HELM_CSS } from '../src/ui/enhancedHelm.js';
import { ONLINE_DRESS_CSS, STONE_DIM } from '../src/ui/enhancedPlusStyle.js';
import { NAVAL_PLUNDER_CSS } from '../src/ui/navalPlunderWindow.js';
import { byClass } from './chargenDom.mjs';
import { FLAG_DONOR_HULL } from '../src/scenes/comeSailAwayPool.js';
import { Boat, meshLocalBounds, worldBounds } from '../src/systems/comeSailAwayBoat.js';
import { createShipDamage, sinkAngles, sinkDepth, SHIP_STATES, SINK_SECONDS, SINK_LIST, SINK_PITCH, SINK_CLEAR } from '../src/systems/naval/navalDamage.js';
import { hullBuild, NAVAL_FACTIONS } from '../src/systems/naval/navalShips.js';
import { navalHitData } from '../src/systems/naval/navalWire.js';
import { NAVAL_DEG } from '../src/systems/naval/navalBallistics.js';
import { quatEuler } from '../src/world/unityAnimator.js';
import { quatRotate } from '../src/world/quat.js';

/** A ship stood where a test wants her (her Large Boat's rig `variant`), built and settled a frame. */
function place(h, classId, pos, { yaw = 0, variant = 0, seed = null } = {}) {
  const id = h.host.spawnShip(classId, { range: Math.hypot(pos[0], pos[2]), bearing: Math.atan2(pos[0], pos[2]), yaw });
  const e = h.host._sea.get(id);
  e.ship.pos = [...pos];
  e.ship.variant = variant;
  if (seed != null) e.ship.seed = seed >>> 0;
  h.host.frame(0.1);
  assert.ok(e.boat, 'built');
  return e;
}
/** Her highest drawn point in the world, as drawn: every rigid mesh rendered under her hull's mesh object (the harness's
 *  own walk, not the host's measure). */
function drawnTop(pool, boat) {
  let top = -Infinity;
  for (const node of boat.MeshObject.walk()) {
    if (!node.activeInHierarchy || !node.components.some((c) => c.type === 'MeshRenderer')) continue;
    const ref = node.getComponent('MeshFilter')?.m_Mesh;
    if (!ref || ref.builtin) continue;
    const local = meshLocalBounds({ models: pool.models }, ref);
    if (local) top = Math.max(top, worldBounds(node, local).max[1]);
  }
  return top;
}
/** A flame the host lights, recorded: where it stands and when (the sea's clock) it went out. */
function flameLog(h) {
  const flames = [];
  const clock = { t: 0 };
  h.deps.flame = (p) => { const f = { pos: [...p], out: null, move(q) { f.pos = [...q]; }, retire() { f.out = clock.t; } }; flames.push(f); return f; };
  const loops = [];
  h.deps.audio.loop3d = (k) => { const l = { k, stopped: null, move() {}, stop() { l.stopped = clock.t; } }; loops.push(l); return l; };
  return { flames, loops, clock };
}
/** A peer's word of one ship (navalWire.js: [n, cls, variant, x, y, z, yaw, speed, sails, hull%, sail%, crew%, state, heel,
 *  seed, fire]) - `state` the wire's code (2: sinking). */
const peerWord = (cls, state = 0, hull = 100, fire = 0) => ({ s: [[4, cls, 0, 120, 0, 0, Math.PI / 2, 0, 1, hull, 100, 100, state, 0, 999, fire]], v: [], b: [] });
const ONLINE = { id: () => 'b-player', peers: () => [{ id: 'a-player', feet: [10, 0, 0] }], sendHit: () => true };
/** The wire's class index (navalWire.js: SHIP_CLASSES' order). */
const WIRE_CLASS = { pirateBrig: 1 };

test('AUDIT NAV1 (the presentation) going down: every hull - the Large Boat\'s rigs, a brig, a galley, a carrack - is SINK_CLEAR under the sea with her highest spar when SINK_SECONDS is up, and only then gone (it was her deck and 8 m: a brig vanished with 19.5 m of mast standing, a galley 24.5, a carrack 32.2) (mutants: the old depth, the clearance dropped, the depth not squared)', async () => {
  for (const [classId, variant, seed] of [['pirateSloop', 0, 1], ['merchantCoaster', 3, 2], ['pirateBrig', 0, 0], ['navyGalley', 0, 3], ['pirateFlagship', 0, 1], ['merchantCarrack', 0, 2]]) {
    const h = await sea({ hull: 2 });
    const e = place(h, classId, [300, 0, 0], { variant, seed });
    const rest = drawnTop(h.pool, e.boat);
    assert.ok(rest > hullBuild(e.ship.hull).deck + 5, `${classId}: her masts stand over her deck`);
    e.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
    assert.equal(e.ship.damage.state, SHIP_STATES.sinking);
    let last = null, half = null, gone = null;
    for (let t = 0.1; t < SINK_SECONDS + 1; t += 0.1) {
      h.host.frame(0.1);
      if (!h.host._sea.has(e.id)) { gone = t; break; }
      last = drawnTop(h.pool, e.boat);
      if (half == null && t >= SINK_SECONDS / 2) half = last;
    }
    assert.ok(gone != null && gone >= SINK_SECONDS - 0.05 && gone <= SINK_SECONDS + 0.25, `${classId}: gone when SINK_SECONDS is up (${gone})`);
    assert.ok(last <= -(SINK_CLEAR - 0.6), `${classId} v${variant}: her highest spar ${last.toFixed(2)} m at the last frame drawn - under the sea`);
    assert.ok(last >= -(SINK_CLEAR + 1.5), `${classId}: and no deeper than the clearance asks (${last.toFixed(2)})`);
    assert.ok(half > rest * 0.5, `${classId}: slow as she fills - half her height still stands at half time (${half.toFixed(1)} of ${rest.toFixed(1)})`);
  }
});

test('AUDIT NAV1 (the presentation) she lists to her seed\'s side and goes down by the head or the stern - her seed\'s next bit - both growing over SINK_SECONDS; her root settles by the square of the time to the depth her own spars ask (mutants: the trim one way for every ship, the list\'s side fixed, the trim dropped)', async () => {
  assert.deepEqual(sinkAngles(0, 1), { roll: -SINK_LIST, pitch: SINK_PITCH });
  assert.deepEqual(sinkAngles(1, 1), { roll: SINK_LIST, pitch: SINK_PITCH });
  assert.deepEqual(sinkAngles(2, 1), { roll: -SINK_LIST, pitch: -SINK_PITCH });
  assert.deepEqual(sinkAngles(3, 0.5), { roll: SINK_LIST / 2, pitch: -SINK_PITCH / 2 });
  assert.deepEqual(sinkAngles(3, 7), sinkAngles(3, 1), 'no further than her last');
  assert.deepEqual(sinkAngles(1, -1), { roll: 0, pitch: 0 });
  assert.equal(sinkDepth(40, 0.5), 10);
  assert.equal(sinkDepth(40, 1), 40);
  assert.equal(sinkDepth(40, 2), 40);
  assert.equal(sinkDepth(-3, 1), 0);
  assert.equal(sinkDepth(40, NaN), 0);
  // on the real hull: by the head her stem goes under first, by the stern her taffrail
  for (const [seed, first, low] of [[0, 'bow', 'starboard'], [3, 'stern', 'port']]) {
    const h = await sea({ hull: 2 });
    const e = place(h, 'pirateBrig', [300, 0, 0], { seed });
    e.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
    h.run(SINK_SECONDS * 0.6);
    const b = hullBuild(e.ship.hull);
    const mo = e.boat.MeshObject;
    const bow = mo.transformPoint([0, b.deck, b.bowZ])[1], stern = mo.transformPoint([0, b.deck, b.aftZ])[1];
    // her 44 m trimmed 12 degrees by 0.6 of SINK_SECONDS: one end 9 m under the other
    if (first === 'bow') assert.ok(bow < stern - 5, `by the head: her stem ${bow.toFixed(1)} under her stern ${stern.toFixed(1)}`);
    else assert.ok(stern < bow - 5, `by the stern: her stern ${stern.toFixed(1)} under her stem ${bow.toFixed(1)}`);
    const port = mo.transformPoint([-b.halfWidth, b.deck, 0])[1], starboard = mo.transformPoint([b.halfWidth, b.deck, 0])[1];
    if (low === 'port') assert.ok(port < starboard - 3, `seed ${seed}: listed to port (${port.toFixed(1)} vs ${starboard.toFixed(1)})`);
    else assert.ok(starboard < port - 3, `seed ${seed}: listed to starboard (${starboard.toFixed(1)} vs ${port.toFixed(1)})`);
  }
});

test('AUDIT NAV1 (the presentation) her spars as drawn: the corners of every rigid mesh under her hull\'s mesh object, in its frame - never a skinned sail\'s bind pose (the Carrack\'s reads 101 m); the Large Boat\'s rigs apart (6 to 9.4 m); her depth her highest point at her LAST pose, over her mesh\'s lift, and SINK_CLEAR (mutants: the skinned sails counted, another rig\'s counted, one measure for every rig, the pose at rest measured, the lift dropped)', async () => {
  const h = await sea({ hull: 2 });
  const top = (sp) => sp.lift + Math.max(...sp.points.map((p) => p[1]));
  const carrack = place(h, 'merchantCarrack', [300, 0, 0]);
  const c = sparsOf(carrack.boat, h.pool.models);
  assert.ok(Math.abs(top(c) - 47.51) < 0.05, `the Carrack's mainmast truck, not her sails' bind pose (${top(c).toFixed(2)})`);
  const boats = [0, 1, 3].map((variant) => sparsOf(place(h, 'merchantCoaster', [300 + variant * 40, 0, 0], { variant }).boat, h.pool.models));
  assert.ok(boats.every((b) => Math.abs(b.lift - 0.1) < 1e-6), 'the Large Boat\'s mesh stands 0.1 m over her root');
  assert.deepEqual(boats.map((b) => Math.round(top(b) * 10) / 10), [9.3, 6, 9.4], 'her lateen, her short mast, her tall mast');
  assert.equal(sparsOf(null, h.pool.models), null);
  // the host measures a rig once and a ship once: two Large Boats of two rigs go down to two depths
  const s = await sea({ hull: 2 });
  const tall = place(s, 'merchantCoaster', [300, 0, 0], { variant: 3, seed: 0 });
  const short = place(s, 'merchantCoaster', [300, 0, 60], { variant: 1, seed: 0 });
  for (const e of [tall, short]) e.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  s.host.frame(0.1);
  assert.ok(tall.sinkUnder > short.sinkUnder + 2, `the tall mast goes deeper (${tall.sinkUnder.toFixed(1)} vs ${short.sinkUnder.toFixed(1)})`);
  // the law: her highest point at her last pose (by the head, to starboard - seed 0), over her mesh's lift, SINK_CLEAR more
  const sp = sparsOf(tall.boat, s.pool.models);
  const last = sinkAngles(0, 1);
  const q = quatEuler(last.pitch, 0, last.roll);
  const expect = sp.lift + Math.max(...sp.points.map((p) => quatRotate(q, p)[1])) + SINK_CLEAR;
  assert.ok(Math.abs(tall.sinkUnder - expect) < 1e-4, `${tall.sinkUnder} is ${expect} (measured at another frame's pose: the matrices' rounding)`);
  // a hull whose meshes are unknown goes down by her build's rig and her length's trim
  const u = await sea({ hull: 2 });
  const blind = place(u, 'pirateBrig', [300, 0, 0], { seed: 0 });
  blind.boat.MeshObject.setActive(false);   // nothing of her known to measure
  blind.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  u.host.frame(0.1);
  const b = hullBuild(blind.ship.hull);
  const reach = Math.max(b.top, ...b.rig.map(([, mx]) => mx[1])) + Math.max(-b.aftZ, b.bowZ) * Math.sin(SINK_PITCH * NAVAL_DEG);
  assert.ok(Math.abs(blind.sinkUnder - (reach + SINK_CLEAR)) < 1e-9, `the build's reach (${blind.sinkUnder.toFixed(2)})`);
});

test('AUDIT NAV1 (the presentation) ONLINE: a ship another player stands goes down on my screen too - her sinking run on my clock between their words (every word reset it to nought: a peer\'s brig stood whole at the surface for 22 s, then vanished), and one their word lets go of mid-sinking finishes going down before she is gone; an afloat ship let go of goes at once, and a room left takes them all (mutants: the reset kept, the local clock dropped, the let-go dropped at once, the lost never dropped)', async () => {
  const h = await sea({ hull: 2, online: ONLINE });
  h.host.applyWord('a-player', peerWord(WIRE_CLASS.pirateBrig), (p) => p);
  h.run(0.3);
  const e = h.host._sea.get('a-player:4');
  assert.ok(e?.boat, 'her puppet');
  const rest = drawnTop(h.pool, e.boat);
  let seen = 0;
  for (let t = 0; t < 12; t++) { h.host.applyWord('a-player', peerWord(WIRE_CLASS.pirateBrig, 2, 0), (p) => p); h.run(1); seen++; }
  assert.equal(e.ship.damage.state, SHIP_STATES.sinking);
  assert.ok(Math.abs(e.ship.damage.sinkT - seen) < 0.15, `her clock runs on between their words (${e.ship.damage.sinkT.toFixed(2)} of ${seen})`);
  assert.ok(e.boat.GameObject.position[1] < -5, 'she settles');
  assert.ok(drawnTop(h.pool, e.boat) < rest - 5, 'and her masts go with her');
  // their word lets her go (her stander drops her the moment she is under - a word or two before my clock): she goes on down
  h.host.applyWord('a-player', { s: [], v: [], b: [] }, (p) => p);
  assert.equal(h.host._sea.has('a-player:4'), true, 'still going down');
  let gone = null, last = null;
  for (let t = 0; t < SINK_SECONDS; t += 0.1) { h.host.frame(0.1); if (!h.host._sea.has('a-player:4')) { gone = t; break; } last = drawnTop(h.pool, e.boat); }
  assert.ok(gone != null && Math.abs(gone - (SINK_SECONDS - seen)) < 0.3, `gone when her own clock is up (${gone?.toFixed(1)})`);
  assert.ok(last < 0, `under the sea when she went (${last.toFixed(2)})`);
  // an afloat ship out of the word goes at once; a sinking one when the room is left, at once too
  const o = await sea({ hull: 2, online: ONLINE });
  o.host.applyWord('a-player', peerWord(WIRE_CLASS.pirateBrig), (p) => p);
  o.run(0.3);
  o.host.applyWord('a-player', { s: [], v: [], b: [] }, (p) => p);
  assert.equal(o.host._sea.get('a-player:4')?.retiring, true, 'an afloat ship out of the word goes - fading as she does on her stander\'s screen (SHIP-FADE, 2026-10-02: PIN MOVED)');
  o.host.applyWord('a-player', peerWord(WIRE_CLASS.pirateBrig, 2, 0), (p) => p);
  o.run(1);
  o.host.clearPeers();
  assert.equal(o.host._sea.has('a-player:4'), false, 'a room left takes her');
  // back in the word, she is theirs again
  o.host.applyWord('a-player', peerWord(WIRE_CLASS.pirateBrig, 2, 0), (p) => p);
  o.run(1);
  o.host.applyWord('a-player', { s: [], v: [], b: [] }, (p) => p);
  const lost = o.host._sea.get('a-player:4');
  assert.equal(lost?.lost, true);
  o.host.applyWord('a-player', peerWord(WIRE_CLASS.pirateBrig, 2, 0), (p) => p);
  assert.equal(lost.lost, false, 'seen again in their word');
});

test('AUDIT NAV1 (the presentation) the word\'s sinking and a scuttle never start her over: restore keeps her clock while the state holds and starts it only on a new sinking; a second scuttle leaves her going down; a peer\'s clock stops at SINK_SECONDS and says she is under (mutants: restore resets every word, scuttle restarts her, sinkOn unbounded)', () => {
  const d = createShipDamage({ hullHp: 400, sailHp: 100, crew: 20 });
  d.restore({ hull: 0, sail: 100, crew: 20, fire: 0, state: SHIP_STATES.sinking });
  assert.equal(d.sinkT, 0);
  assert.equal(d.sinkOn(5), false);
  assert.equal(d.sinkT, 5);
  d.restore({ hull: 0, sail: 100, crew: 20, fire: 0, state: SHIP_STATES.sinking });
  assert.equal(d.sinkT, 5, 'the word says she still sinks: her clock kept');
  assert.equal(d.sinkOn(SINK_SECONDS), true, 'under');
  assert.equal(d.sinkT, SINK_SECONDS, 'and no further');
  d.restore({ hull: 50, sail: 100, crew: 20, fire: 0, state: SHIP_STATES.afloat });
  d.restore({ hull: 0, sail: 100, crew: 20, fire: 0, state: SHIP_STATES.sinking });
  assert.equal(d.sinkT, 0, 'a new sinking starts at nought');
  assert.equal(d.sinkOn(NaN), false);
  assert.equal(d.sinkT, 0);
  const s = createShipDamage({ hullHp: 400, sailHp: 100, crew: 20 });
  s.scuttle();
  s.step(6);
  s.scuttle();
  assert.equal(s.sinkT, 6, 'scuttled twice (a peer\'s claim after mine): she goes on down');
  const f = createShipDamage({ hullHp: 400, sailHp: 100, crew: 20 });
  assert.equal(f.sinkOn(3), false, 'afloat: no clock');
  assert.equal(f.sinkT, 0);
});

test('AUDIT NAV1 (the presentation) she burns as she goes down: a burning ship holed to nought keeps her fires (they went out the instant she was holed), each flame follows her deck as she lists and trims and goes out as the sea reaches its place - no ember nor smoke born under the sea (a scuttled hull\'s flames burned 5 m under it, 62 embers and puffs showing through the water) - and the fire\'s loop stops with the last (mutants: the sinking douses, no awash check, the loop never stopped)', async () => {
  const h = await sea({ hull: 2 });
  const { flames, loops, clock } = flameLog(h);
  const e = place(h, 'pirateBrig', [200, 0, 0], { seed: 0 });
  h.host.applyPeerHit('peer', navalHitData('local', { n: e.n, hull: 5, fire: true, zone: 'hull' }));
  h.run(0.5);
  assert.equal(flames.length, 3, 'three fires along her deck');
  // PIN MOVED (TOUGHER-SHIPS): her toughened hull takes two of a hit's most (navalWire.js NAVAL_HIT_MAX) - the first leaves her afloat
  h.host.applyPeerHit('peer', navalHitData('local', { n: e.n, hull: 400, zone: 'holed' }));
  assert.equal(e.ship.damage.state, SHIP_STATES.afloat);
  h.host.applyPeerHit('peer', navalHitData('local', { n: e.n, hull: 400, zone: 'holed' }));
  assert.equal(e.ship.damage.state, SHIP_STATES.sinking);
  assert.ok(e.ship.damage.fire > 0, 'her fires burn on as she goes down');
  let under = 0;
  for (let t = 0; t < SINK_SECONDS && h.host._sea.has(e.id); t += 0.1) {
    clock.t = t;
    h.host.frame(0.1);
    under = Math.max(under, h.host._effects.drawList().filter((p) => (p.kind === 'ember' || p.kind === 'smoke') && p.pos[1] < 0).length);
    for (const f of flames) if (f.out == null) assert.ok(f.pos[1] >= FLAME_AWASH - 1e-9, `a flame burns only over the sea (${f.pos[1].toFixed(2)})`);
  }
  const outs = flames.map((f) => f.out).sort((a, b) => a - b);
  assert.ok(outs.every((t) => t != null && t > 3), `each out as the sea reached it, never at the hole (${outs.map((t) => t?.toFixed(1)).join(', ')})`);
  assert.ok(outs[2] - outs[0] > 0.3, 'one by one - by the head, her forward fire first');
  assert.equal(under, 0, 'no ember nor smoke born under the sea');
  const fire = loops.filter((l) => l.k === NAVAL_CLASSIC.burning);
  assert.equal(fire.length, 1);
  assert.ok(Math.abs(fire[0].stopped - outs[2]) < 0.15, `her loop stops with her last flame (${fire[0].stopped?.toFixed(1)})`);
  // the flames follow her deck as she heels: a fire's place is her deck's, not the calm sea's
  const g = await sea({ hull: 2 });
  const log2 = flameLog(g);
  const b = place(g, 'pirateBrig', [200, 0, 0], { seed: 1 });
  g.host.applyPeerHit('peer', navalHitData('local', { n: b.n, hull: 5, fire: true, zone: 'hull' }));
  b.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  g.run(4);
  const mid = log2.flames.find((f) => f.out == null && Math.abs(f.pos[0] - b.ship.pos[0]) < 3 && Math.abs(f.pos[2] - b.ship.pos[2]) < 3);
  assert.ok(mid, 'her midships fire');
  const deckAt = b.boat.MeshObject.transformPoint([0, hullBuild(b.ship.hull).deck + 1, 0]);
  assert.ok(Math.hypot(mid.pos[0] - deckAt[0], mid.pos[1] - deckAt[1], mid.pos[2] - deckAt[2]) < 1e-6, 'on her deck as she lies');
});

test('AUDIT NAV1 (the presentation) a scuttled prize burns to the waterline and no further: the torch\'s flames go out as she settles, none under the sea (mutants: the awash check dropped)', async () => {
  const h = await sea({ hull: 2 });
  const { flames, clock } = flameLog(h);
  const e = place(h, 'merchantGalleon', [60, 0, 0], { seed: 2 });
  h.host.applyPeerHit('peer', navalHitData('local', { n: e.n, hull: 1, fire: true, zone: 'hull' }));
  h.run(0.2);
  e.ship.damage.scuttle();
  e.ship.damage.apply({ hull: 0, sail: 0, crew: 0, fire: true }, 0);   // openPrize's scuttle: the torch
  let worst = 0;
  for (let t = 0; t < SINK_SECONDS; t += 0.1) {
    clock.t = t;
    h.host.frame(0.1);
    worst = Math.max(worst, h.host._effects.drawList().filter((p) => (p.kind === 'ember' || p.kind === 'smoke') && p.pos[1] < -0.2).length);
  }
  assert.ok(flames.length === 3 && flames.every((f) => f.out != null && f.out < SINK_SECONDS / 2), `out by the time her deck is under (${flames.map((f) => f.out?.toFixed(1)).join(', ')})`);
  assert.equal(worst, 0);
});

test('AUDIT NAV1 (the presentation) her colours go down with her: the flag flies while she floats and its emitter stops the moment she founders (a flag flown on from a masthead under the sea showed through it) (mutants: the flag never stopped)', async () => {
  const h = await sea({ hull: 2 });
  const e = place(h, 'navyCutter', [200, 0, 0]);
  h.run(1);
  assert.ok(e.boat.FlagEmitter, 'she carries a flag');
  assert.equal(e.boat.FlagEmitter.isEmitting, true, 'afloat: her colours fly');
  e.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  h.run(0.2);
  assert.equal(e.boat.FlagEmitter.isEmitting, false, 'going down: her colours with her');
});

// ── feedback: the mix, a hit, the reload, her colours ──────────────────────────────────────────────────────────────
const RATE = 11025;
const pcm = (f) => { const b = readFileSync(new URL(`../public/sfx/${f}`, import.meta.url)); const i = b.indexOf('data') + 8; return Float32Array.from(b.subarray(i), (v) => (v - 128) / 128); };
const rms = (x, secs) => { const n = Math.min(x.length, Math.round(secs * RATE)); let s = 0; for (let i = 0; i < n; i++) s += x[i] * x[i]; return Math.sqrt(s / n); };
/** Every play3d the host makes, with the sea's clock it was made at. */
function soundLog(h) {
  const played = [];
  const at = { t: 0 };
  h.deps.audio.play3d = (k, p, v, opts) => played.push({ k, p: [...p], v, opts, t: at.t });
  return { played, at };
}
/** A peer's volley on their word, fired from `pos` out of her starboard side (navalWire.js's volley row). */
const peerVolley = (id, pos) => ({ s: [], v: [[id, -1, 2, 0, pos[0], pos[1], pos[2], Math.PI, 0, 0, 0.05, 99 + id, 0.5]], b: [] });

test('AUDIT NAV1 (the presentation) THE MIX, my broadside: each report at one over the root of her guns, its own pitch within GUN_PITCH_JITTER and level within GUN_GAIN_JITTER_DB, no far roll at my own guns, each gun\'s kick along the ripple - and summed as the bus sums them (no limiter) it no longer clips at the default volume (+3.4 dBFS before; 11% of samples clipped at full) (mutants: my ripple unscaled, the jitter dropped, the kick at the release once)', async () => {
  const clip = pcm('naval-cannon.wav');
  for (const hull of [2, 4]) {
    const h = await sea({ hull });
    const { played, at } = soundLog(h);
    h.host.frame(0.1);
    h.host.attackInput(true); h.host.frame(0.1); h.host.attackInput(false);
    for (let i = 0; i < 12; i++) { at.t += 0.05; h.host.frame(0.05); }
    const reports = played.filter((s) => s.k === NAVAL_SFX.cannon);
    const n = reports.length;
    assert.equal(n, hull === 2 ? 6 : 7, 'every gun heard');
    const lo = 10 ** (-GUN_GAIN_JITTER_DB / 20) / Math.sqrt(n), hi = 10 ** (GUN_GAIN_JITTER_DB / 20) / Math.sqrt(n);
    assert.ok(reports.every((r) => r.v >= lo - 1e-9 && r.v <= hi + 1e-9), `each at 1/sqrt(${n}), jittered (${reports.map((r) => r.v.toFixed(2))})`);
    assert.ok(reports.every((r) => Math.abs(r.opts.pitch - 1) <= GUN_PITCH_JITTER + 1e-9), 'each its own pitch');
    assert.ok(new Set(reports.map((r) => r.opts.pitch.toFixed(4))).size === n && new Set(reports.map((r) => r.v.toFixed(4))).size === n, 'no two guns one clip');
    assert.equal(played.some((s) => s.k === NAVAL_SFX.cannonFar), false, 'my own guns are near: no far roll');
    assert.deepEqual(h.log.shake, reports.map(() => GUN_KICK.long), 'a long gun\'s kick a gun');
    // the ripple summed as the bus sums it, at the default SoundVolume
    const out = new Float32Array(RATE * 3);
    for (const r of reports) {
      const start = Math.round(r.t * RATE);
      for (let i = 0; start + i < out.length; i++) { const s = i * r.opts.pitch, j = Math.floor(s); if (j + 1 >= clip.length) break; out[start + i] += r.v * (clip[j] + (clip[j + 1] - clip[j]) * (s - j)); }
    }
    const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0) * 0.5;
    assert.ok(peak < 0.8, `hull ${hull}: the ripple peaks ${peak.toFixed(2)} at the default volume - never clipped`);
  }
});

test('AUDIT NAV1 (the presentation) THE MIX, a broadside across the bay: the far roll once a volley at FAR_MATCH times the root of her guns (it was one a GUN - fourteen thumps for seven), the near reports and the roll crossfaded in equal power over FAR_FADE_M either side of NEAR_BOOM_M (the roll stood 6.5 dB over the near at the switch), FAR_MATCH the clips\' own; and nothing played past its range (mutants: the roll once a gun, the band dropped, the cull dropped)', async () => {
  // the clips' own match: their RMS through their references
  const near = rms(pcm('naval-cannon.wav'), 1), far = rms(pcm('naval-cannon-far.wav'), 1);
  const match = (near * NAVAL_SOUND_RANGE[NAVAL_SFX.cannon].refDistance) / (far * NAVAL_SOUND_RANGE[NAVAL_SFX.cannonFar].refDistance);
  assert.ok(Math.abs(20 * Math.log10(FAR_MATCH / match)) < 1, `FAR_MATCH ${FAR_MATCH} is the clips' ${match.toFixed(3)} within 1 dB`);
  const heard = async (x) => {
    const h = await sea({ hull: 2, online: ONLINE });
    const { played } = soundLog(h);
    h.host.applyWord('a-player', peerVolley(1, [x, 0, 0]), (p) => p);
    h.run(0.8);
    return played;
  };
  const close = await heard(150);
  const closeReports = close.filter((s) => s.k === NAVAL_SFX.cannon);
  assert.ok(closeReports.length >= 6 && !close.some((s) => s.k === NAVAL_SFX.cannonFar), 'near: her reports, no roll');
  assert.ok(closeReports.every((r) => r.v >= 10 ** (-GUN_GAIN_JITTER_DB / 20) - 1e-9), 'another\'s guns each at full weight - only my own ripple is scaled');
  const off = await heard(700);
  const rolls = off.filter((s) => s.k === NAVAL_SFX.cannonFar);
  assert.equal(off.filter((s) => s.k === NAVAL_SFX.cannon).length, 0, 'far: no near report');
  assert.equal(rolls.length, 1, 'one roll a volley');
  assert.ok(Math.abs(rolls[0].v - FAR_MATCH * Math.sqrt(6)) < 1e-9, `at FAR_MATCH x sqrt(6) (${rolls[0].v})`);
  assert.equal(rolls[0].opts.far, true, 'held off the ear as a far sound');
  const mid = await heard(NEAR_BOOM_M);
  const midReports = mid.filter((s) => s.k === NAVAL_SFX.cannon), midRoll = mid.filter((s) => s.k === NAVAL_SFX.cannonFar);
  assert.ok(midReports.length >= 6 && midRoll.length === 1, 'in the band: both');
  // each at its own place in the band: x = 0 at NEAR_BOOM_M - FAR_FADE_M, 1 at + FAR_FADE_M - the reports by cos, the roll
  // by sin: equal power across it (the feet at the origin)
  const xOf = (p) => Math.min(1, Math.max(0, (Math.hypot(p[0], p[2]) - (NEAR_BOOM_M - FAR_FADE_M)) / (2 * FAR_FADE_M)));
  for (const r of midReports) {
    const k = r.v / Math.cos(xOf(r.p) * Math.PI / 2);
    assert.ok(k >= 10 ** (-GUN_GAIN_JITTER_DB / 20) - 1e-9 && k <= 10 ** (GUN_GAIN_JITTER_DB / 20) + 1e-9, `a report faded by the cosine of its place (${k.toFixed(3)})`);
  }
  const x0 = xOf(midRoll[0].p);
  assert.ok(x0 > 0.3 && x0 < 0.7, `the volley in the band's middle (${x0.toFixed(2)})`);
  assert.ok(Math.abs(midRoll[0].v - FAR_MATCH * Math.sqrt(6) * Math.sin(x0 * Math.PI / 2)) < 1e-9, 'the roll coming in by the sine of its first gun\'s place');
  assert.ok(FAR_FADE_M > 0 && FAR_FADE_M < NEAR_BOOM_M);
  const gone = await heard(NAVAL_SOUND_RANGE[NAVAL_SFX.cannonFar].maxDistance + 200);
  assert.equal(gone.filter((s) => s.k === NAVAL_SFX.cannon || s.k === NAVAL_SFX.cannonFar).length, 0, 'past its range: nothing (the inverse law never reaches silence)');
});

test('AUDIT NAV1 (the presentation) a hit that registers: a ball of mine striking her hull is heard at HIT_CONFIRM_REF_M (19 dB down from 150 m at the hull\'s own 16), another\'s at the hull\'s own; its splinters, flash and puff grown for the eye that sees it far off, to HIT_BURST_MAX (a splinter at 150 m was two pixels) (mutants: no confirm, the burst unscaled)', async () => {
  const strike = async (shooter, x) => {
    const h = await sea({ hull: 2 });
    const { played } = soundLog(h);
    const e = place(h, 'merchantGalleon', [x, 0, 0], { yaw: 0 });
    const box = hullBuild(e.ship.hull);
    const p0 = [x - box.halfWidth - 3, 3, 0];
    h.host._shots.fireVolley({ id: 'v1', shooter, launches: [{ delay: 0, p0, v0: [60, 0.5, 0], gun: 'long', index: 0 }], resolve: true });
    h.run(0.3);
    return { hit: played.find((s) => s.k === NAVAL_SFX.hit), debris: h.host._effects.drawList().filter((p) => p.kind === 'debris') };
  };
  const mine = await strike('me:42', 150);
  assert.ok(mine.hit, 'struck her');
  assert.equal(mine.hit.opts.refDistance, HIT_CONFIRM_REF_M, 'mine: the confirm');
  assert.ok(mine.debris.some((p) => p.size > 0.4 * 2), `grown for a far eye (${Math.max(...mine.debris.map((p) => p.size)).toFixed(2)} m)`);
  assert.ok(mine.debris.every((p) => p.size <= 0.4 * HIT_BURST_MAX + 1e-9));
  const theirs = await strike('peer:a', 150);
  assert.equal(theirs.hit.opts.refDistance, NAVAL_SOUND_RANGE[NAVAL_SFX.hit].refDistance, 'another\'s: the hull\'s own');
  const close = await strike('me:42', 20);
  assert.ok(close.debris.every((p) => p.size <= 0.4 + 1e-9), 'close by: as it was');
});

test('AUDIT NAV1 (the presentation) a battery coming ready: the gun captain\'s word from her side (a new clip, NAVAL_SFX.ready) and its chip\'s flash for READY_FLASH_S - a side came ready in silence; a side loaded when I take the helm says nothing; a loaded side stands FULL brass (it filled to 97% and dropped to nought, loaded) (mutants: no word, the flash never ends, the gauge emptied loaded)', async () => {
  const h = await sea({ hull: 2 });
  const { played, at } = soundLog(h);
  h.host.frame(0.1);
  assert.equal(played.filter((s) => s.k === NAVAL_SFX.ready).length, 0, 'loaded as I came aboard: nothing said');
  h.host.attackInput(true); h.host.frame(0.1); h.host.attackInput(false);
  const side = () => h.host.hudModel().batteries.find((b) => b.side === 'starboard');
  assert.equal(side().loaded, false);
  let readyAt = null;
  for (let t = 0; t < 30 && readyAt == null; t += 0.1) { at.t = t; h.host.frame(0.1); if (played.some((s) => s.k === NAVAL_SFX.ready)) readyAt = t; }
  assert.ok(readyAt != null, 'the word when she is loaded');
  const word = played.filter((s) => s.k === NAVAL_SFX.ready);
  assert.equal(word.length, 1, 'once');
  assert.ok(word[0].p[0] > 3, 'from her starboard side');
  assert.equal(side().loaded, true);
  assert.equal(side().fresh, true, 'her chip flashes');
  h.run(READY_FLASH_S + 0.1);
  assert.equal(side().fresh, false, 'for READY_FLASH_S');
  assert.equal(played.filter((s) => s.k === NAVAL_SFX.ready).length, 1, 'and no more');
  const text = navalHudText(h.host.hudModel(), {});
  assert.equal(text.plate.batteries.find((b) => b.side === 'starboard').fill, 100, 'loaded: full brass');
  destroyNavalHud();
  drawNavalHud(h.host.hudModel(), { keys: {} });
  const chip = byClass(globalThis.document.body, 'dfnaval-gun starboard')[0] ?? byClass(globalThis.document.body, 'dfnaval-gun').find((g) => / starboard/.test(g.className));
  assert.equal(byClass(chip, 'dfnaval-gun-fill')[0].style.height, '100%', 'drawn full, loaded');
  destroyNavalHud();
  const reloading = navalHudText({ ...h.host.hudModel(), batteries: [{ side: 'port', gun: 'long', guns: 6, progress: 0.97, ready: false, loaded: false }] }, {});
  assert.equal(reloading.plate.batteries[0].fill, 97);
  const loaded = navalHudText({ ...h.host.hudModel(), batteries: [{ side: 'port', gun: 'long', guns: 6, progress: 1, ready: false, loaded: true, fresh: true }] }, {});
  assert.deepEqual([loaded.plate.batteries[0].fill, loaded.plate.batteries[0].fresh], [100, true], 'braced but loaded: full');
});

test('AUDIT NAV1 (the presentation) her hull bar reads a hit as the foe bar does (ui/barLoss.js): the pale ghost holds where it WAS, a bite of CARD_CHUNK_MIN_LOSS breaks a piece off over the span it took and flashes the card for CARD_HIT_S - it only slid, for 160 ms; a new target starts whole; the HUD hidden puts the pieces away (FRAME1c) (mutants: no ghost, no piece, no flash, a new ship\'s loss read off the last)', () => {
  destroyNavalHud();
  const target = (o = {}) => ({ id: 'a:1', name: 'The Red Wake', captain: null, classLine: 'Pirate Brigantine', faction: 'pirate', hull: 0.8, sail: 0.9, state: 'afloat', boarded: false, distance: 150, hostile: true, ...o });
  const model = (t) => ({ ship: null, armed: false, batteries: [], aim: null, aiming: false, target: t, board: null, boarding: null, notoriety: { crown: 'Wayrest', value: 0, level: 0 } });
  const draw = (t, dt = 0.016, o = {}) => drawNavalHud(model(t), { keys: {}, dt, ...o });
  draw(target());
  const card = byClass(globalThis.document.body, 'dfnaval-card')[0];
  const ghost = byClass(card, 'dfnaval-ghost')[0];
  const chunks = byClass(card, 'dfnaval-chunk');
  assert.equal(chunks.length, 2);
  assert.equal(ghost.style.width, '80%', 'whole at her bar');
  draw(target({ hull: 0.62 }));
  assert.equal(ghost.style.width, '80%', 'the ghost holds where it was');
  assert.match(chunks[0].className, /dfnaval-chunk fa/, 'a piece breaks off');
  assert.deepEqual([chunks[0].style.left, chunks[0].style.width], ['62.0%', '18.0%'], 'over the span the bite took');
  assert.match(card.className, /hit-[ab]$/, 'the card flashes');
  draw(target({ hull: 0.62 }), CARD_HIT_S + 0.01);
  assert.equal(card.className, 'dfnaval-card pirate hostile', 'for CARD_HIT_S');
  draw(target({ hull: 0.615 }));
  assert.equal(byClass(card, 'dfnaval-chunk').filter((c) => / f[ab]/.test(c.className)).length, 1, 'under CARD_CHUNK_MIN_LOSS: no piece');
  for (let i = 0; i < 40; i++) draw(target({ hull: 0.62 }), 0.05);
  assert.equal(ghost.style.width, '62%', 'then it drains to her bar');
  draw(target({ id: 'b:2', name: 'The Salt Maid', hull: 0.3 }));
  assert.equal(ghost.style.width, '30%', 'a new ship starts whole at her own bar - nothing lost to show');
  assert.ok(chunks.every((c) => c.className === 'dfnaval-chunk'), 'the last ship\'s pieces put away');
  draw(target({ id: 'b:2', name: 'The Salt Maid', hull: 0.2 }));
  assert.match(chunks[0].className, / f[ab]$/);
  drawNavalHud(model(target({ id: 'b:2', hull: 0.2 })), { keys: {}, dt: 0.016, covered: true });
  assert.ok(chunks.every((c) => c.className === 'dfnaval-chunk'), 'hidden under a window: the pieces put away, never replayed');
  destroyNavalHud();
});

test('AUDIT NAV1 (the presentation) her colours by her state: her faction\'s while she sails, struck with her (the flag stops), the captor\'s orange once taken, gone down with her - she flew her faction\'s whatever she was; a Carrack at sea flies them from her mainmast\'s truck (the pirate flagship and the merchant carrack flew none), a player\'s Carrack keeps the mod\'s rig; the card\'s hostile red wins over a trade\'s colour; a powder barrel on my deck shakes past a holed ball (mutants: struck colours flying, the prize in her faction\'s, no graft, the donor never found, hostile under the trade)', async () => {
  const h = await sea({ hull: 2 });
  const e = place(h, 'navyCutter', [200, 0, 0]);
  h.run(0.5);
  assert.deepEqual(e.boat.flagColor, NAVAL_FACTIONS.navy.flag);
  assert.equal(e.boat.FlagEmitter.isEmitting, true, 'afloat: her colours fly');
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 }, 0);
  assert.equal(e.ship.damage.state, SHIP_STATES.struck);
  h.run(0.2);
  assert.equal(e.boat.FlagEmitter.isEmitting, false, 'struck: her colours come down');
  e.ship.damage.takePrize();
  h.run(0.2);
  assert.equal(e.boat.FlagEmitter.isEmitting, true, 'taken: colours again -');
  assert.equal(e.boat.flagColor, null, '- the captor\'s orange (FlagMaterial\'s, the player\'s boats\' own)');
  // the Carrack's graft
  const c = place(h, 'pirateFlagship', [400, 0, 0], { seed: 0 });
  assert.ok(c.boat.FlagObject, 'a Carrack at sea flies her colours');
  assert.equal(c.boat.FlagObject.parent.name, 'CarrackMast1', 'on her tallest mast - heeling with it');
  const at = c.boat.MeshObject.inverseTransformPoint(c.boat.FlagObject.position);   // her hull's own frame: the swell heels it
  assert.ok(Math.abs(at[0]) < 0.05 && Math.abs(at[1] - 47.51) < 0.05 && Math.abs(at[2] + 3.09) < 0.05, `at its truck (${at.map((v) => v.toFixed(2))})`);
  assert.equal(c.boat.FlagEmitter, c.boat.FlagObject.getComponentInChildren('ParticleSystem').particleSystem);
  assert.equal(c.boat.FlagEmitter.renderer.m_RenderMode, 4, 'a mesh flag - the world draws it as her colours');
  h.run(1);
  assert.ok(c.boat.FlagEmitter.particleCount > 0 && c.boat.particleSystems.includes(c.boat.FlagEmitter), 'flying, among her particle systems');
  assert.deepEqual(c.boat.flagColor, NAVAL_FACTIONS.pirate.flag, 'the black');
  const own = h.pool.spawnNow(Object.assign(new Boat(4, 0), { uid: 7 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  assert.equal(own.FlagObject, null, 'a player\'s Carrack: the mod\'s rig as it is');
  assert.equal(FLAG_DONOR_HULL, 2);
  // the card: the hostile red last, so it wins over a navy's or a merchantman's colour
  const i = (sel) => NAVAL_HUD_CSS.indexOf(sel);
  assert.ok(i('.dfnaval-card.hostile .dfnaval-card-name') > i('.dfnaval-card.navy .dfnaval-card-name') && i('.dfnaval-card.hostile .dfnaval-card-name') > i('.dfnaval-card.merchant .dfnaval-card-name'));
  // a powder barrel going up on my deck
  const b = await sea({ hull: 2 });
  b.host._shots.dropBarrel({ id: 'x', shooter: 'x:1', pos: [0, 0, 0], resolve: true });
  b.run(3);
  assert.ok(b.log.shake.includes(BLAST_SHAKE) && BLAST_SHAKE > 2.5, `a barrel shakes past a holed ball (${b.log.shake})`);
});

// ── the layout and the words (5c) ─────────────────────────────────────────────────────────────────────────────────

const HUD_KEYS = { aim: 'RIGHT CLICK', board: 'E', brace: 'C' };
/** A helm's model with the aim up, a ship in the look and a volley's tally - every part standing. */
const layoutModel = (o = {}) => ({
  ship: { name: 'Small Ship', hull: 0.72, sail: 0.8, crew: 0.9, fire: true, wrecked: false, braced: false },
  armed: true, aiming: true, board: null, boarding: null,
  aim: { side: 'starboard', gun: 'long', range: 138, max: 211, hot: true, barrel: false, state: 'ready' },
  batteries: [{ side: 'port', gun: 'long', guns: 6, progress: 1, ready: true, active: false, barrels: null }, { side: 'starboard', gun: 'long', guns: 6, progress: 1, ready: true, active: true, barrels: null }],
  target: { id: 'a:1', name: 'The Red Wake', captain: 'Irna Vosk', classLine: 'Pirate brig', faction: 'pirate', hull: 0.55, sail: 0.8, state: 'afloat', boarded: false, distance: 142, hostile: true },
  notoriety: { crown: 'Wayrest', value: 30, level: 1 }, incoming: null, tally: { balls: 6, hits: 3, holed: 2, rig: 1 }, ...o,
});
/** A box as a DOM rect. */
const rect = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top });
/** Run `fn` on a `w` x `h` screen, the page's own put back after. */
function onScreen(w, h, fn) {
  const was = [globalThis.innerWidth, globalThis.innerHeight];
  globalThis.innerWidth = w; globalThis.innerHeight = h;
  try { return fn(); } finally { [globalThis.innerWidth, globalThis.innerHeight] = was; destroyNavalHud(); }
}
/** The readout mounted (at scale 0.75, which no case below uses, so every variable a case sets is written) and its root
 *  with its CSS variables caught, and its plate given a box (the fake page lays nothing out). */
function laidOut(plateW = NAVAL_PLATE_W, plateH = 263, o = {}) {
  drawNavalHud(layoutModel(), { keys: HUD_KEYS, scale: 0.75, ...o });
  const [root] = byClass(globalThis.document.body, 'dfnaval-hud');
  const vars = {};
  root.style.setProperty = (k, v) => { vars[k] = v; };
  const [plate] = byClass(root, 'dfnaval-plate');
  let reads = 0;
  Object.defineProperty(plate, 'offsetWidth', { get: () => plateW, configurable: true });
  Object.defineProperty(plate, 'offsetHeight', { get: () => { reads += 1; return plateH; }, configurable: true });
  return { root, vars, plate, reads: () => reads };
}

test('AUDIT NAV1 (the presentation) THE PLATE\'S PLACE (platePlace) - measured in a real browser over the real HUD and helm panel, 1920x1080 to a 740x360 phone at HUD scale 0.5 to 2: she stands over the vitals where she would reach into their rows (at scale 1.5 on a 1280 screen she covered them) rather than shrinking; her scale is capped by the room under what stands over her columns (the helm panel\'s bar, the card\'s band), never above the HUD\'s nor under PLATE_SCALE_MIN; and she steps clear of the centre column\'s bands - narrower or lower, whichever costs her less (mutants: never lifted, a bar beside her read as over her, the band unread, the dearer step taken)', () => {
  const P = { plateW: NAVAL_PLATE_W, plateH: 263 };
  assert.deepEqual(platePlace({ ...P, scale: 1, W: 1920, H: 1080, vitals: rect(659, 1038, 1261, 1058) }), { scale: 1, bottom: NAVAL_PLATE_BOTTOM }, 'her corner free: the margin, the HUD\'s scale');
  assert.deepEqual(platePlace({ ...P, scale: 1.5, W: 1280, H: 720, vitals: rect(189, 668, 1092, 698) }), { scale: 1.5, bottom: 720 - 668 + PLATE_GAP }, 'over the vitals, at the scale asked');
  assert.equal(platePlace({ ...P, scale: 1, W: 1280, H: 720, vitals: rect(339, 678, 941, 698) }).bottom, NAVAL_PLATE_BOTTOM, 'clear of their columns: never lifted');
  // the helm panel's bar over her columns - a phone's, over the touch corner
  const phone = platePlace({ ...P, scale: 1, W: 844, H: 390, bottom: NAVAL_PLATE_TOUCH_BOTTOM, over: [rect(128, 8, 828, 146)] });
  assert.deepEqual(phone, { scale: (390 - NAVAL_PLATE_TOUCH_BOTTOM - 146 - PLATE_GAP) / 263, bottom: NAVAL_PLATE_TOUCH_BOTTOM });
  assert.equal(platePlace({ ...P, scale: 1, W: 1920, H: 400, over: [rect(100, 8, 900, 146)] }).scale, 1, 'a bar beside her columns caps nothing');
  assert.equal(platePlace({ ...P, scale: 1, W: 740, H: 300, bottom: NAVAL_PLATE_TOUCH_BOTTOM, over: [rect(0, 8, 740, 146)] }).scale, PLATE_SCALE_MIN, 'never under the floor');
  assert.equal(platePlace({ ...P, scale: 0.8, W: 3840, H: 2160 }).scale, 0.8, 'never over the HUD\'s');
  // the centre column's bands: 1280x720 at scale 2, her compact rose (198) and the stack's keep - narrower costs less
  const C = { plateW: NAVAL_PLATE_W, plateH: 198, scale: 2, W: 1280, bottom: 64 };
  const stack = { bottom: 360 + (NAVAL_AIM_DOWN_SHORT + NAVAL_STACK_H) * 2, half: NAVAL_STACK_HALF * 2 + PLATE_GAP };
  assert.equal(platePlace({ ...C, H: 720, bands: [stack] }).scale, (640 - 18 - stack.half) / NAVAL_PLATE_W);
  // ...and lower costs less where the band is wide: her top under its foot
  assert.equal(platePlace({ ...C, H: 1200, bands: [{ bottom: 900, half: 600 }] }).scale, (1200 - 64 - 900 - PLATE_GAP) / 198);
  assert.equal(platePlace({ ...C, W: 1920, H: 720, bands: [stack] }).scale, 2, 'clear of its half: untouched');
  assert.equal(platePlace({ ...C, H: 2000, bands: [stack] }).scale, 2, 'under its rows: untouched');
});

test('AUDIT NAV1 (the presentation) THE CARD\'S COLUMN (cardScale): the card stands under the compass, or the helm panel\'s bar, at the HUD\'s scale capped by the room down to the warning\'s band over the crosshair - at scale 1.5 on a 1366x768 screen its foot stood in that band, and the warning over it; where the room holds it at less than CARD_SCALE_MIN (or the HUD\'s own, less) it stands aside; on foot no warning stands and the crosshair\'s arms bound it; its head by the sheet\'s law (cardTopPx) where no panel stands (mutants: uncapped, the floor unread, the warning\'s band on foot)', () => {
  const top = 156 + NAVAL_CARD_GAP;   // 1366x768 at 1.5: the helm panel's bar's foot, measured
  assert.equal(cardScale({ scale: 1.5, H: 768, top }), (384 - NAVAL_WARN_UP * 1.5 - PLATE_GAP - top) / NAVAL_CARD_H);
  assert.ok(Math.abs(cardScale({ scale: 1.5, H: 768, top }) - 1.211) < 0.001);
  assert.equal(cardScale({ scale: 1.5, H: 1080, top }), 1.5, 'room enough: the HUD\'s');
  assert.equal(cardScale({ scale: 2, H: 720, top: 178 }), null, '1280x720 at scale 2: aside');
  assert.equal(cardScale({ scale: 1, H: 390, top: 154 }), null, 'a phone at the helm: its column is the helm panel\'s');
  assert.equal(cardScale({ scale: 0.5, H: 720, top: 150 }), 0.5, 'a half-scale HUD: its own, where it fits');
  assert.equal(cardScale({ scale: 1, H: 390, top: cardTopPx(1), warn: false }), 1, 'on foot: to the crosshair\'s arms');
  assert.equal(cardScale({ scale: 1, H: 320, top: cardTopPx(1), warn: false }), (160 - NAVAL_CROSS_R - PLATE_GAP - cardTopPx(1)) / NAVAL_CARD_H);
  assert.equal(CARD_SCALE_MIN, 0.75);
  assert.equal(cardTopPx(1.5), 18 + 28 * 1.5 + 12);
  assert.equal(cardTopPx(1, 46), 18 + 28 + 12 + 46, 'the foe bar\'s step');
});

test('AUDIT NAV1 (the presentation) THE DRAW BY THE SCREEN: a screen NAVAL_SHORT_H tall or less in the HUD\'s own pixels is SHORT (a phone on its side; 720 lines at scale 1.5) - her rose packed, the aim\'s range and state alone (the rose\'s lit side is the battery), the tally its count alone and waiting while the aim is up, the card aside; else the card in its column at its capped scale, under the helm panel\'s foot; the panel measured only while a card stands or the layout is due (mutants: short by the CSS pixels, the side\'s words kept, the tally over the aim, the card\'s scale unwritten)', () => {
  onScreen(1920, 1080, () => {
    const { root, vars } = laidOut();
    drawNavalHud(layoutModel(), { keys: HUD_KEYS, scale: 1, dt: PLATE_LAYOUT_S });
    assert.equal(root.className, 'dfnaval-hud');
    assert.equal(byClass(root, 'dfnaval-aim-text')[0].textContent, 'Starboard broadside - ');
    assert.equal(byClass(root, 'dfnaval-tally')[0].style.display, '', 'the tally under the aim');
    // under the helm panel: the card's head its foot and a gap, its scale the column's
    drawNavalHud(layoutModel(), { keys: HUD_KEYS, scale: 1.5, under: { getBoundingClientRect: () => rect(493, 80, 1427, 156) } });
    assert.equal(byClass(root, 'dfnaval-card')[0].style.top, `${156 + NAVAL_CARD_GAP}px`);
    assert.equal(vars['--nc-card-scale'], '1.5');
  });
  onScreen(1366, 768, () => {
    const { root, vars } = laidOut();
    drawNavalHud(layoutModel(), { keys: HUD_KEYS, scale: 1.5, under: { getBoundingClientRect: () => rect(216, 80, 1150, 156) } });
    assert.equal(root.className, 'dfnaval-hud', '768 lines at 1.5 are 512 of the HUD\'s: not short');
    assert.equal(vars['--nc-card-scale'], '1.211', 'the column\'s room caps it');
  });
  onScreen(1280, 720, () => {
    let reads = 0;
    const under = { getBoundingClientRect: () => { reads += 1; return rect(173, 80, 1107, 156); } };
    const { root, vars } = laidOut(NAVAL_PLATE_W, 263, { under });
    assert.ok(vars['--nc-card-scale'] === undefined && byClass(root, 'dfnaval-card')[0].style.top === `${156 + NAVAL_CARD_GAP}px`, 'mounted at 0.75: in its column');
    drawNavalHud(layoutModel(), { keys: HUD_KEYS, scale: 1.5, under });
    assert.equal(root.className, 'dfnaval-hud short aside', '720 lines at 1.5 are 480 of the HUD\'s');
    assert.equal(byClass(root, 'dfnaval-card')[0].style.top, '', 'aside: the sheet places it');
    assert.equal(vars['--nc-card-scale'], '', 'no column scale aside');
    assert.deepEqual([byClass(root, 'dfnaval-aim-text')[0].textContent, byClass(root, 'dfnaval-aim-range')[0].textContent, byClass(root, 'dfnaval-aim-target')[0].textContent], ['', '138 m', ' - on target']);
    assert.equal(byClass(root, 'dfnaval-tally')[0].style.display, 'none', 'the tally waits while the aim is up');
    drawNavalHud(layoutModel({ aim: null, aiming: false }), { keys: HUD_KEYS, scale: 1.5, under });
    assert.equal(byClass(root, 'dfnaval-tally')[0].style.display, '', '...and stands in its place once it is down');
    drawNavalHud(layoutModel({ aim: { side: 'stern', gun: 'barrel', range: 0, max: 0, hot: false, barrel: true, state: 'ready' } }), { keys: HUD_KEYS, scale: 1.5, under });
    assert.equal(byClass(root, 'dfnaval-aim-text')[0].textContent, 'Stern - roll a fire barrel', 'no range to stand alone: the words stay');
    // no ship in the look, the layout not due: the panel unmeasured
    reads = 0;
    drawNavalHud(layoutModel({ target: null }), { keys: HUD_KEYS, scale: 1.5, under, dt: 0.01 });
    assert.equal(reads, 0);
    drawNavalHud(layoutModel({ target: null }), { keys: HUD_KEYS, scale: 1.5, under, dt: PLATE_LAYOUT_S });
    assert.equal(reads, 1, 'the layout due: measured');
    // the same screen at scale 1 is not short, and its column holds the card
    drawNavalHud(layoutModel(), { keys: HUD_KEYS, scale: 1, under });
    assert.equal(root.className, 'dfnaval-hud');
  });
  assert.match(NAVAL_HUD_CSS, /\.dfnaval-hud\.short \.dfnaval-tally-rest \{ display: none; \}/);
  assert.equal(NAVAL_SHORT_H, 500);
});

test('AUDIT NAV1 (the presentation) THE PLACES WRITTEN: her foot over the vitals, or the classic compass (the plate stood on it, 91% of its width at 1280x720); her scale and width; the aside card at her foot, left of her (and her Brace), no wider than the room right of the quick block in its rows; the stack no wider than the room either side of the centre line; read on a change of the screen, the scale, the skin or her rows and every PLATE_LAYOUT_S - never every frame (mutants: the compass unread, the brace\'s width left out, the quick block unread, the stack uncapped, the placement every frame)', () => {
  onScreen(1280, 720, () => {
    const opts = { keys: HUD_KEYS, scale: 1.5, vitals: { getBoundingClientRect: () => rect(189, 668, 1092, 698) }, quick: { getBoundingClientRect: () => rect(24, 271, 372, 650) } };
    const l = laidOut(NAVAL_PLATE_W, 198);   // her packed height, measured
    drawNavalHud(layoutModel(), { ...opts, dt: PLATE_LAYOUT_S });
    assert.deepEqual([l.vars['--nc-foot'], l.vars['--nc-plate-scale'], l.vars['--nc-plate-w']], [`${720 - 668 + PLATE_GAP}px`, '1.5', '408px']);
    assert.equal(l.vars['--nc-card-right'], `${18 + 408 + PLATE_GAP}px`);
    assert.equal(l.vars['--nc-card-max'], `${Math.floor((1280 - (18 + 408 + PLATE_GAP) - (372 + PLATE_GAP)) / 1.5)}px`, 'right of the quick block');
    assert.equal(l.vars['--nc-stack-max'], `${Math.floor((2 * (640 - 18 - 408 - PLATE_GAP)) / 1.5)}px`, 'short of her either side');
    // never every frame
    const n = l.reads();
    drawNavalHud(layoutModel(), { ...opts, dt: 0.1 });
    drawNavalHud(layoutModel(), { ...opts, dt: 0.1 });
    assert.equal(l.reads(), n, 'the same screen and rows: not read');
    const calm = layoutModel({ ship: { name: 'Small Ship', hull: 0.72, sail: 0.8, crew: 0.9, fire: false, wrecked: false, braced: false } });
    drawNavalHud(calm, { ...opts, dt: 0.1 });
    assert.equal(l.reads(), n + 1, 'a row gone (her chips): read again');
    drawNavalHud(calm, { ...opts, dt: 0.1 });
    assert.equal(l.reads(), n + 1);
    drawNavalHud(calm, { ...opts, dt: PLATE_LAYOUT_S });
    assert.equal(l.reads(), n + 2, '...and on its clock (the helm panel\'s bar rewraps unseen)');
  });
  onScreen(1280, 720, () => {
    // the classic skin: over the compass box, the vitals not the enhanced HUD's
    const l = laidOut();
    drawNavalHud(layoutModel(), { keys: HUD_KEYS, scale: 1, compass: { w: 138, h: 34 }, vitals: { getBoundingClientRect: () => rect(189, 668, 1092, 698) }, dt: PLATE_LAYOUT_S });
    assert.equal(l.root.className, 'dfnaval-hud classic');
    assert.equal(l.vars['--nc-foot'], `${34 + PLATE_GAP}px`);
  });
  onScreen(900, 520, () => {
    // the card's band held for her whether or not a card stands: no ship in the look, the vitals' column tall (a hotbar
    // over them) - her room runs to the card's foot in the column (58 + 95), not the screen's head
    const l = laidOut();
    drawNavalHud(layoutModel({ target: null }), { keys: HUD_KEYS, scale: 1, vitals: { getBoundingClientRect: () => rect(200, 420, 700, 500) }, dt: PLATE_LAYOUT_S });
    const foot = 520 - 420 + PLATE_GAP;
    assert.equal(l.vars['--nc-foot'], `${foot}px`);
    assert.equal(l.vars['--nc-plate-scale'], String(Math.round(((520 - foot - (cardTopPx(1) + NAVAL_CARD_H) - PLATE_GAP) / 263) * 1000) / 1000));
  });
  onScreen(1024, 540, () => {
    // a foe's bar under the compass: the column's head a step lower (the sheet's :has() law, read), the card's scale less
    const l = laidOut();
    const doc = { ...globalThis.document, querySelector: (sel) => (sel === '.hud-foe.on' ? {} : null) };
    drawNavalHud(layoutModel(), { keys: HUD_KEYS, scale: 1, doc, dt: PLATE_LAYOUT_S });
    assert.equal(l.vars['--nc-card-scale'], String(Math.round(((270 - NAVAL_WARN_UP - PLATE_GAP - cardTopPx(1, 46)) / NAVAL_CARD_H) * 1000) / 1000));
    drawNavalHud(layoutModel(), { keys: HUD_KEYS, scale: 1, dt: PLATE_LAYOUT_S });
    assert.equal(l.vars['--nc-card-scale'], '1', 'the bar gone: its full scale');
  });
  onScreen(844, 390, () => {
    // a finger's: her Brace beside her foot, the card aside left of both
    const under = { getBoundingClientRect: () => rect(128, 8, 828, 146) };
    const l = laidOut(NAVAL_PLATE_W, 198);
    drawNavalHud(layoutModel(), { keys: HUD_KEYS, scale: 1, touch: true, under, dt: PLATE_LAYOUT_S });
    const k = (390 - NAVAL_PLATE_TOUCH_BOTTOM - 146 - PLATE_GAP) / 198, pw = Math.round(NAVAL_PLATE_W * k);
    assert.equal(l.vars['--nc-plate-scale'], String(Math.round(k * 1000) / 1000));
    assert.equal(l.vars['--nc-foot'], `${NAVAL_PLATE_TOUCH_BOTTOM}px`);
    assert.equal(l.vars['--nc-card-right'], `${18 + pw + 8 + NAVAL_BRACE_W + PLATE_GAP}px`);
    assert.equal(l.root.className, 'dfnaval-hud touch short aside');
  });
});

test('AUDIT NAV1 (the presentation) THE BRACE under a finger is its own press on the readout\'s root, beside the plate\'s foot at NAVAL_BRACE_H by NAVAL_BRACE_W whatever her scale - under her rose it shrank with her (23 px at a phone\'s half scale, under the platforms\' 48); the finger\'s warning names it ("Hold Brace" was wider than a small phone\'s room) (mutants: the press back in the plate, its size scaled)', () => {
  onScreen(844, 390, () => {
    drawNavalHud(layoutModel(), { keys: HUD_KEYS, scale: 1, touch: true });
    const [root] = byClass(globalThis.document.body, 'dfnaval-hud');
    const [brace] = byClass(root, 'dfnaval-brace');
    assert.equal(brace.parentNode, root, 'the root\'s own');
    assert.equal(byClass(byClass(root, 'dfnaval-plate')[0], 'dfnaval-brace').length, 0, 'not in the plate');
  });
  assert.ok(NAVAL_BRACE_H >= 48 && NAVAL_BRACE_W >= 48, 'the platforms\' 48 px');
  const rule = /\.dfnaval-brace \{([^}]*)\}/.exec(NAVAL_HUD_CSS)[1];
  assert.match(rule, /position: absolute; right: calc\(18px \+ var\(--nc-plate-w, 272px\) \+ 8px \+ env\(safe-area-inset-right, 0px\)\);/);
  assert.match(rule, /bottom: calc\(var\(--nc-foot, 76px\) \+ env\(safe-area-inset-bottom, 0px\)\); box-sizing: border-box; width: 96px;\s+height: 48px;/);
  assert.doesNotMatch(rule, /scale/, 'at no scale');
  assert.equal(navalHudText(layoutModel({ incoming: { name: 'x' } }), HUD_KEYS, { touch: true }).warn.key, 'Brace');
  assert.equal(navalHudText(layoutModel({ incoming: { name: 'x' } }), HUD_KEYS).warn.key, 'C: brace');
  assert.equal(NAVAL_WARN_HALF_TOUCH < NAVAL_WARN_HALF, true);
});

test('AUDIT NAV1 (the presentation) THE CENTRE COLUMN\'S SHEET: the aim and the tally one stack under the crosshair, no wider than its room and wrapping balanced (they ran under the plate at scale 1.5), a range and the seconds kept whole; closer on a short screen, the warning too; the card at its column\'s scale and no wider than the screen at it; the aside card at the plate\'s foot; a short plate\'s rose in two rows, port and starboard either side of bow over stern (mutants: the stack uncapped, the range broken, the short offsets unread, the rose unpacked)', () => {
  const rule = (sel) => new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(NAVAL_HUD_CSS)?.[1] ?? '';
  assert.match(rule('.dfnaval-stack'), /top: calc\(50% \+ 34px \* var\(--hud-scale, 1\)\); transform: translateX\(-50%\) scale\(var\(--hud-scale, 1\)\);/);
  assert.match(rule('.dfnaval-stack'), /flex-direction: column;[^;]*; gap: 4px; width: max-content;[\s\S]*max-width: var\(--nc-stack-max,/);
  assert.match(rule('.dfnaval-hud.short .dfnaval-stack'), new RegExp(`top: calc\\(50% \\+ ${NAVAL_AIM_DOWN_SHORT}px \\* var\\(--hud-scale, 1\\)\\)`));
  assert.match(rule('.dfnaval-aim'), /text-wrap: balance;/);
  assert.doesNotMatch(rule('.dfnaval-aim'), /position|nowrap/, 'a line in the stack, free to wrap');
  assert.match(rule('.dfnaval-aim-range'), /white-space: nowrap;/);
  assert.match(rule('.dfnaval-tally'), /text-wrap: balance;/);
  assert.match(rule('.dfnaval-warn'), new RegExp(`top: calc\\(50% - ${NAVAL_WARN_UP}px \\* var\\(--hud-scale, 1\\)\\)`));
  assert.match(rule('.dfnaval-hud.short .dfnaval-warn'), new RegExp(`top: calc\\(50% - ${NAVAL_WARN_UP_SHORT}px \\* var\\(--hud-scale, 1\\)\\)`));
  assert.match(rule('.dfnaval-card'), /transform: translateX\(-50%\) scale\(var\(--nc-card-scale, var\(--hud-scale, 1\)\)\);[\s\S]*max-width: calc\(86vw \/ var\(--nc-card-scale, var\(--hud-scale, 1\)\)\);/);
  assert.match(rule('.dfnaval-hud.aside .dfnaval-card'), /right: var\(--nc-card-right, 302px\); bottom: var\(--nc-foot, 22px\);[\s\S]*transform-origin: 100% 100%; box-sizing: border-box; width: 300px; max-width: var\(--nc-card-max, 300px\);/);
  assert.match(rule('.dfnaval-hud.short .dfnaval-rose'), /grid-template-rows: auto auto;/);
  assert.match(rule('.dfnaval-hud.short .dfnaval-gun.port, .dfnaval-hud.short .dfnaval-gun.starboard'), /grid-row: 1 \/ span 2;/);
  assert.match(rule('.dfnaval-hud.short .dfnaval-gun.stern'), /grid-row: 2;/);
  assert.match(rule('.dfnaval-hud.short .dfnaval-ship'), /display: none;/);
  assert.equal(NAVAL_AIM_DOWN, 34);
  // the stack's DOM: the aim, then the tally
  onScreen(1920, 1080, () => {
    drawNavalHud(layoutModel(), { keys: HUD_KEYS });
    const [stack] = byClass(globalThis.document.body, 'dfnaval-stack');
    assert.deepEqual(stack.children.map((c) => c.className.split(' ')[0]), ['dfnaval-aim', 'dfnaval-tally']);
  });
  assert.equal(navalHudText(layoutModel({ aim: { side: 'port', gun: 'long', range: 90, max: 211, hot: false, barrel: false, state: 'reloading', left: 4.24 } }), HUD_KEYS).aim.target, ' - reloading 4.2 s');
  assert.equal(NAVAL_STACK_H >= 2 * 15 + 4 + 2 * 14, true, 'two lines of aim, two of tally');
  assert.equal(NAVAL_WARN_H >= 29, true, 'the warning as drawn');
  assert.equal(NAVAL_CARD_ASIDE_H >= 55, true, 'the slim card as drawn');
});

test('AUDIT NAV1 (the presentation) THE PAD AT THE GUNS: the readout names the pad\'s own buttons while one is in hand (a pad player read "Hold RIGHT CLICK to aim"), and the prompt bar at an armed helm shows the guns\' rows beside the d-pad\'s - the attack laying and firing, the brace, Activate for the ship in reach - a row only for a bound button (mutants: the keys named to a pad, a row for an unbound button, the words of the wrong board)', () => {
  const codes = { aim: 'JoystickAxis10Button0', board: 'JoystickButton0', brace: 'JoystickButton4' };
  assert.deepEqual(navalPadPrompts(layoutModel({ armed: false }), codes), [], 'no guns: no rows');
  assert.deepEqual(navalPadPrompts(layoutModel({ aiming: false }), codes), [[[codes.aim], 'Hold: lay the guns'], [[codes.brace], 'Hold: brace']]);
  assert.deepEqual(navalPadPrompts(layoutModel(), codes)[0], [[codes.aim], 'Let go: fire']);
  const board = (kind) => navalPadPrompts(layoutModel({ aiming: false, board: { name: 'The Red Wake', kind } }), codes).at(-1);
  // GUN-HOLD: while the guns are laid Activate holds fire - its row says so, over any ship in reach
  assert.deepEqual(navalPadPrompts(layoutModel({ board: { name: 'The Red Wake', kind: 'board' } }), codes).at(-1), [[codes.board], 'Hold fire']);
  assert.deepEqual(navalPadPrompts(layoutModel(), codes).at(-1), [[codes.board], 'Hold fire'], 'laid, with nothing in reach: still the hold');
  assert.deepEqual(board('board'), [[codes.board], 'Board The Red Wake']);
  assert.deepEqual(board('hold'), [[codes.board], "Open The Red Wake's hold"]);
  assert.deepEqual(board('heave'), [[codes.board], 'Heave to']);
  assert.deepEqual(board('yard'), [[codes.board], 'The shipwright']);
  assert.deepEqual(navalPadPrompts(layoutModel(), { aim: codes.aim }), [[[codes.aim], 'Let go: fire']], 'a row only for a bound button');
  assert.equal(navalHudText(layoutModel({ aiming: false, aim: null }), { aim: 'RT', board: 'A', brace: 'LB' }).plate.hint, 'Hold RT to aim - LB: brace');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /return \{ aim: getBinding\(b, 'SwingWeapon', false\) \?\? getJoystickUIBinding\(b, 'RightClick'\), board: getJoystickUIBinding\(b, 'LeftClick'\), brace: getBinding\(b, 'Crouch', false\) \};/);
  assert.match(w, /const family = controllerLook\(\) \? padFamily\(\) : null;[^\n]*\n\s+const pad = family \? navalPadCodes\(\) : null;/);
  assert.match(w, /keys: pad \? \{ aim: pad\.aim \? hdGlyphName\(family, pad\.aim\) : null, board: pad\.board \? hdGlyphName\(family, pad\.board\) : null, brace: pad\.brace \? hdGlyphName\(family, pad\.brace\) : null \}\n\s+: \{ aim: navalKeyName\('SwingWeapon'\), board: navalKeyName\('Interact'\), brace: navalKeyName\('Crouch'\) \},/);
  assert.match(w, /return r && naval\?\.atGuns \? \[\.\.\.r, \.\.\.navalPadPrompts\(naval\.hudModel\(\), navalPadCodes\(\)\)\] : r; \},/);
  assert.match(w, /compass: !isEnhanced\(\) && hudArt\?\.compassBox \? classicCompassBox\(\) : null,/);
  assert.match(w, /return \{ w: hudArt\.compassBox\.w \* s \* k, h: hudArt\.compassBox\.h \* s \* k \};/);
});

test('AUDIT NAV1 (the presentation) THE SKINS AND THE WORDS: the kit\'s face on the classic skin too (it fell to monospace); on Stone the dim words read 5:1 (the hint 1.9, the waters 2.9, the labels and the card\'s sub-line 3.8, the plunder window\'s 3.3-3.5); a refused choice greyed by its title, its reason whole (2.3:1 faded); the helm panel\'s bar as wide as its buttons and a finger\'s clear of the corner\'s presses; a raider comes alongside in one number; the hold\'s one wording (mutants: the fonts left to the enhanced HUD, a dim word left dim, the tile faded, the menu\'s press under the bar)', () => {
  destroyNavalHud();
  for (const n of [...globalThis.document.head.children]) if (n.id === 'dagger-enhanced-fonts') n.remove();
  drawNavalHud(layoutModel(), { keys: HUD_KEYS });
  assert.ok(globalThis.document.head.children.some((n) => n.id === 'dagger-enhanced-fonts'), 'the face loaded by the readout itself');
  destroyNavalHud();
  assert.match(NAVAL_HUD_CSS, /\.dfnaval-hint \{[^}]*color: #b3a684;/);
  for (const sel of ['dfnaval-hint', 'dfnaval-waters', 'dfnaval-bar-label', 'dfnaval-card-sub', 'dfnaval-winsub', 'dfnaval-lede', 'dfnaval-count', 'dfnaval-choice span', 'dfnaval-yardrow span']) {
    assert.ok(ONLINE_DRESS_CSS.includes(`:root[data-plus-theme="stone"] body .${sel}`), sel);
  }
  assert.ok(ONLINE_DRESS_CSS.includes(`.dfnaval-yardrow span { color: ${STONE_DIM};`));
  assert.match(NAVAL_PLUNDER_CSS, /\.dfnaval-choice:disabled \{ cursor: default; background-color: rgba\(8,9,12,0\.6\); \}\n\.dfnaval-choice:disabled b \{ color: #8f8670;[^}]*\}\n\.dfnaval-choice:disabled span \{ color: #c9bfa4; \}/);
  assert.doesNotMatch(NAVAL_PLUNDER_CSS, /\.dfnaval-choice:disabled \{[^}]*opacity/);
  assert.match(HELM_CSS, /\.helmpanel-bar \{[^}]*width: max-content; max-width: calc\(100vw - 24px\);/);
  const t = readFileSync(new URL('../src/ui/touch.js', import.meta.url), 'utf8');
  assert.match(t, /button\('≡', edge\('left', hooks\.dial \? 72 : 16\), edge\('top', 16\), 48,/);
  assert.match(HELM_CSS, /\.helmpanel\.touch \.helmpanel-bar \{ top: calc\(8px \+ env\(safe-area-inset-top, 0px\)\); left: calc\(50% \+ 56px \+ \(env\(safe-area-inset-left, 0px\) - env\(safe-area-inset-right, 0px\)\) \/ 2\);\n\s+max-width: calc\(100vw - 144px - env\(safe-area-inset-left, 0px\) - env\(safe-area-inset-right, 0px\)\); \}/);
  assert.equal(144, 72 + 48 + 8 + 16, 'the menu\'s press, air, and the right margin');
  assert.equal(56, (72 + 48 + 8 - 16) / 2, 'centred in what is left');
  const host = readFileSync(new URL('../src/scenes/navalHost.js', import.meta.url), 'utf8');
  assert.ok(host.includes("`Grappling hooks! ${entry.ship.names?.name ? `${entry.ship.names.name} is` : 'The pirates are'} coming alongside - repel boarders!`"));
});

// ── the sea at a glance (5d) ──────────────────────────────────────────────────────────────────────────────────────

/** A recording GL whose wraps and textures are told apart by name. */
function namedGl() {
  const calls = [];
  let ids = 0;
  const named = new Set(['ARRAY_BUFFER', 'TRIANGLES', 'TEXTURE_2D', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'REPEAT', 'CLAMP_TO_EDGE', 'ONE', 'ONE_MINUS_SRC_ALPHA', 'BLEND', 'DEPTH_TEST', 'CULL_FACE', 'LEQUAL']);
  const gl = new Proxy({}, {
    get(_, k) {
      if (named.has(k)) return k;
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createTexture') return () => { const o = { id: ++ids }; calls.push([k, o]); return o; };
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  return { gl, calls };
}

test('AUDIT NAV1 (the presentation) THE ARCS AS LINES (#4): each ball\'s arc ARC_WIDTH_VH of the view\'s height across at its own distance (a 0.12 m ribbon was 0.7 px at 150 m and ~30 px beside the eye), in the LINE picture - repeated along it, so its dash runs by the metres flown (a 2.5 m dash judged once an 8 m segment aliased), marching out on the sea\'s clock at ARC_DASH_SPEED - bound with the arcs alone; the host hands the pass its clock (mutants: the width in metres, the soft dot again, the dash per segment, the line clamped, the clock unread)', () => {
  const { gl, calls } = namedGl();
  const view = new Float32Array(16); view[0] = 1; view[5] = 1; view[10] = 1; view[15] = 1;
  const proj = new Float32Array(16); proj[5] = 1.57;
  const r = { gl, _proj: proj, _view: view, _camPos: [0, 0, 0], _ambient: [0.3, 0.3, 0.3], _sunColor: [1, 1, 1], _sunScale: 1, _lightDir: [0, 1, 0], _fogColor: [0.5, 0.5, 0.6], _fogMode: 1, _fogDensity: 0.001, _fogRange: [10, 900], _dwFog: new Float32Array(4), _focus: new Float32Array(4), markForeignPass() {} };
  const pass = new NavalRenderer(r);
  const arc = [[-10, 5, -40], [10, 6, -40], [30, 5, -40]];   // across the view, 40 m out
  pass.draw({ particles: [], aim: { arcs: [arc], zone: [], hot: true, radius: 2 }, time: 2 });
  // the pictures: the line alone repeated along (AUDIT NAV1, #13: the particles' four on one sheet, the line its own)
  const made = calls.filter((c) => c[0] === 'createTexture').map((c) => c[1]);
  const names = Object.keys(NAVAL_GL_TEXTURES);
  assert.deepEqual(names, ['sheet', 'line']);
  const wrapS = new Map();
  let bound = null;
  for (const c of calls) {
    if (c[0] === 'bindTexture') bound = c[2];
    if (c[0] === 'texParameteri' && c[2] === 'TEXTURE_WRAP_S' && bound) wrapS.set(names[made.indexOf(bound)], c[3]);
  }
  assert.equal(wrapS.get('line'), 'REPEAT');
  for (const n of names.filter((x) => x !== 'line')) assert.equal(wrapS.get(n), 'CLAMP_TO_EDGE', n);
  // the arc's two segments drawn with the line bound
  const line = made[names.indexOf('line')];
  const draws = [];
  bound = null;
  for (const c of calls) { if (c[0] === 'bindTexture') bound = c[2]; if (c[0] === 'drawArrays') draws.push([bound, c[2], c[3]]); }
  assert.deepEqual(draws.filter((d) => d[0] === line).map((d) => d[2]), [12], 'its two segments, and nothing else');
  // one width on the screen at its own distance; the u the metres flown from the marching offset
  const d = pass.data;
  const vtx = (i) => [d[i * NAVAL_STRIDE], d[i * NAVAL_STRIDE + 1], d[i * NAVAL_STRIDE + 2]];
  const across = Math.hypot(...vtx(0).map((x, k) => x - vtx(5)[k]));   // the corners that differ across it alone
  assert.ok(Math.abs(across - ARC_WIDTH_VH * (2 / 1.57) * Math.hypot(0, 5.5, -40)) < 1e-4, 'its width the view\'s share at its distance');
  const seg = Math.hypot(20, 1);
  const off = 2 * ARC_DASH_SPEED;
  assert.ok(Math.abs(d[3] - (0 - off) / ARC_DASH_M) < 1e-5 && Math.abs(d[NAVAL_STRIDE + 3] - (seg - off) / ARC_DASH_M) < 1e-5, 'u by the metres flown');
  assert.ok(Math.abs(d[6 * NAVAL_STRIDE + 3] - (seg - off) / ARC_DASH_M) < 1e-5, 'continuous into the next segment');
  const host = readFileSync(new URL('../src/scenes/navalHost.js', import.meta.url), 'utf8');
  // PIN MOVED (SHIP-WATCH): the particles carry the far ships' lamps too, laid into the effects' list first
  // PIN MOVED (SALVAGE): the floaters a wreck's wreckage marked among them
  assert.match(host, /const particles = effects\.drawList\(\);\n\s*lampsInto\(particles\);[^\n]*\n\s*return \{ particles, balls: shots\.balls\(\), floaters: shots\.floaters\(\)\.map\(\(f\) => \(isSalvage\(f\.lot\) \? \{ \.\.\.f, wreck: true \} : f\)\), aim: aimDraw, time: clock \};/);
});

test('AUDIT NAV1 (the presentation) THE FAR SHIPS\' COST (#17): an idle particle system - stopped, nothing alive - is stepped without a question (it walked up its node\'s parents to ask whether it was active, then did nothing: a war galley\'s 224 systems, one live, cost 0.45 ms a far frame), a playing or living one as ever; a ship\'s animators found once (her tree walked for them every frame: 0.44 ms); past NEAR_LIFE_M her rigging stepped every FAR_LIFE_EVERY frames with the time it missed - five far galleys 5.7 ms a frame, now 0.9 (mutants: the idle system asked, the walk every frame, the far stride unread, the missed time dropped)', async () => {
  const h = await sea({ hull: 2, settings: { ShipsAtSea: 'off' } });
  const near = place(h, 'navyGalley', [0, 0, 300]);
  const far = place(h, 'navyGalley', [0, 0, 1000]);
  h.run(FAR_LIFE_EVERY * 2 / 60, 1 / 60);   // the far one's parts first stepped on her stride
  // an idle system: stepped without a question and left as it was
  const idle = far.boat.particleSystems.find((ps) => !ps.isPlaying && !ps.particleCount);
  assert.ok(idle, 'a galley carries idle systems');
  let asked = 0;
  Object.defineProperty(idle.node, 'activeInHierarchy', { get: () => { asked += 1; return true; }, configurable: true });
  const list = idle.particles;
  idle.step(1 / 60);
  assert.equal(asked, 0, 'no question asked');
  assert.equal(idle.particles, list, 'nothing changed');
  // a living one, stopped, still ages its particles; a playing one runs its clock
  const live = near.boat.particleSystems.find((ps) => ps.isPlaying);
  assert.ok(live, 'her flag or wake plays');
  const t0 = live.time;
  live.step(0.1);
  assert.ok(live.time > t0, 'a playing system runs');
  idle.particles = [{ remainingLifetime: 5, startLifetime: 5, position: [0, 0, 0], velocity: [0, 0, 0], size: 1, rotation: 0, randomSeed: 1, startSize: 1, startColor: [1, 1, 1, 1] }];
  idle.step(0.5);
  assert.ok(Math.abs(idle.particles[0].remainingLifetime - 4.5) < 1e-9, 'a stopped one with the living ages them');
  // her animators found once: her tree unwalked frame to frame
  let walks = 0;
  const walk = near.boat.GameObject.walk.bind(near.boat.GameObject);
  near.boat.GameObject.walk = function* () { walks += 1; yield* walk(); };
  h.run(10 / 60, 1 / 60);
  assert.equal(walks, 0, 'no walk a frame');
  // the stride: the far one every FAR_LIFE_EVERY frames with the time it missed, the near one every frame
  const seen = (e) => { const dts = []; for (const a of e.boat.animators) { const up = a.update.bind(a); a.update = (dt) => { dts.push(+dt.toFixed(6)); up(dt); }; } return dts; };
  const nd = seen(near), fd = seen(far);
  const perFrame = (e) => e.boat.animators.length;
  for (let i = 0; i < FAR_LIFE_EVERY * 2; i++) h.host.frame(1 / 60);
  assert.equal(nd.length, FAR_LIFE_EVERY * 2 * perFrame(near), 'near: every frame');
  assert.equal(fd.length, 2 * perFrame(far), 'far: every FAR_LIFE_EVERY frames');
  assert.ok(fd.every((dt) => Math.abs(dt - FAR_LIFE_EVERY / 60) < 1e-5), 'with the time it missed');
  assert.equal(NEAR_LIFE_M, 600);
});

test('AUDIT NAV1 (the presentation) THE SHIPS\' TAGS (#14): one card within 6 degrees of the look was all the sea said - now a tag over each ship within NAVAL_TAG_RANGE of the eye and past NAVAL_TAG_NEAR, NAVAL_TAG_MAX of them nearest first: her name, what she is to me (a pirate hostile, a merchant not), her hull and state, the card\'s ship marked - TAG_LIFT over her highest spar as she stands, settling as she goes down (mutants: every ship tagged, the far first, the near one tagged, the spar unread, the sinking unread)', async () => {
  const h = await sea({ hull: 2, settings: { ShipsAtSea: 'off' } });
  const a = place(h, 'pirateBrig', [0, 0, 200]);
  const b = place(h, 'merchantGalleon', [300, 0, 0]);
  place(h, 'navyGalley', [0, 0, -(NAVAL_TAG_RANGE + 100)]);
  place(h, 'pirateSloop', [NAVAL_TAG_NEAR / 2, 0, 5]);
  h.host.frame(0.05);
  let tags = h.host.tags();
  assert.deepEqual(tags.map((t) => t.id), [a.id, b.id], 'in reach, past the near, nearest first');
  const [ta, tb] = tags;
  assert.equal(ta.name, a.ship.names.name);
  assert.deepEqual([ta.faction, ta.hostile, tb.faction, tb.hostile], ['pirate', true, 'merchant', false]);
  assert.deepEqual([ta.hull, ta.state, ta.boarded], [1, 'afloat', false]);
  const sp = sparsOf(a.boat, h.pool.models);
  const top = sp.lift + Math.max(...sp.points.map((q) => q[1]));
  const root = a.boat.GameObject.position;
  assert.ok(Math.abs(ta.point[1] - (root[1] + top + TAG_LIFT)) < 1e-9 && ta.point[0] === root[0] && ta.point[2] === root[2], 'over her highest spar');
  assert.ok(ta.distance > 150 && ta.distance < 250);
  // the card's ship marked
  h.view.look = { origin: [0, 5, 0], dir: [0, 0, 1] };
  h.host.hudModel();
  assert.deepEqual(h.host.tags().map((t) => t.target), [true, false]);
  // going down: her tag settles with her
  a.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  h.run(3, 0.1);
  const sunkBy = h.host.tags().find((t) => t.id === a.id);
  assert.equal(sunkBy.state, 'sinking');
  assert.ok(sunkBy.point[1] < ta.point[1] - 0.5, 'lower as she goes');
  // the cap
  for (let i = 0; i < NAVAL_TAG_MAX + 2; i++) place(h, 'merchantGalleon', [-100 - i * 40, 0, 100]);
  h.host.frame(0.05);
  assert.equal(h.host.tags().length, NAVAL_TAG_MAX);
});

test('AUDIT NAV1 (the presentation) THE LOOKOUT (#14): a pirate turning on me said nothing - now "Sail ho!" as a ship afloat turns hostile within SAIL_HO_RANGE, her class and where she bears off my bow (dead ahead, off the bow, on the beam, off the quarter, dead astern), the nearest first, once while she stays hostile, SAIL_HO_GAP_S after the last; never a merchant; a navy when my notoriety turns her; one out of range when she comes within it (mutants: every ship hailed, hailed again, the gap unread, the bearing unread, the range unread)', async () => {
  assert.deepEqual([0, 30, -40, 90, -100, 130, -150, 170, -179].map(bearingWords), ['dead ahead', 'off the starboard bow', 'off the port bow', 'on the starboard beam', 'on the port beam', 'off the starboard quarter', 'off the port quarter', 'dead astern', 'dead astern']);
  assert.deepEqual(['Pirate Brigantine', 'Iliac Cutter'].map(withArticle), ['A Pirate Brigantine', 'An Iliac Cutter']);
  const h = await sea({ hull: 2, settings: { ShipsAtSea: 'off' } });
  const hails = () => h.log.say.filter((l) => l.startsWith('Sail ho'));
  // both out of the lookout's range, the further one seen first; then both within it on one frame: the nearer hailed
  const sloop = place(h, 'pirateSloop', [-1500, 0, 0]);
  const brig = place(h, 'pirateBrig', [1600, 0, 0]);
  place(h, 'merchantGalleon', [0, 0, -300]);
  sloop.ship.pos = [-300, 0, 300 + 150];
  brig.ship.pos = [400, 0, 0];
  const far = place(h, 'pirateSloop', [0, 0, -(SAIL_HO_RANGE + 200)]);
  h.run(SAIL_HO_CHECK_S * 2, 0.05);
  assert.deepEqual(hails(), ['Sail ho! A Pirate Brigantine on the starboard beam!'], 'the nearest, where she bears');
  h.run(SAIL_HO_GAP_S - 2, 0.1);
  assert.equal(hails().length, 1, 'not again inside the gap');
  h.run(2.5, 0.1);
  assert.equal(hails()[1], 'Sail ho! A Pirate Sloop off the port bow!', 'the next after it');
  h.run(SAIL_HO_GAP_S + 1, 0.1);
  assert.equal(hails().length, 2, 'each once while she stays hostile; never the merchant; the far one not yet');
  far.ship.pos = [0, 0, -(SAIL_HO_RANGE - 100)];
  h.run(SAIL_HO_CHECK_S * 2, 0.05);
  assert.equal(hails()[2], 'Sail ho! A Pirate Sloop dead astern!', 'within the range: hailed');
  // a navy my notoriety turns
  const navy = place(h, 'navyGalley', [0, 0, 350]);
  h.run(SAIL_HO_GAP_S + 1, 0.1);
  assert.equal(hails().length, 3, 'a lawful navy: no hail');
  h.host.notoriety.add(navy.ship.names.crown, NAVY_HUNTS);
  h.run(SAIL_HO_CHECK_S * 2, 0.05);
  assert.match(hails()[3], /^Sail ho! A \w+ War Galley dead ahead!$/);
});

test('AUDIT NAV1 (the presentation) THE TAGS DRAWN (#14): one node a slot, moved, never rebuilt - her name in her trade\'s colour (a hostile ship red), her hull, her state in the card\'s words, the card\'s ship ringed, at the HUD\'s scale over her point, fading with her distance to the tags\' reach; a window over the world hides them all; the world projects them through the frame\'s own matrices behind a sight cache of their own, after the names, and every clear hides them (mutants: rebuilt each frame, the scale unread, never hidden, the fade reversed, the state unsaid or saying hostile)', () => {
  destroyNavalHud();
  const pt = (o = {}) => ({ id: 'a:1', name: 'The Red Wake', faction: 'pirate', hostile: true, hull: 0.62, state: 'afloat', boarded: false, target: false, distance: 150, x: 400, y: 200, ...o });
  drawNavalTags([pt(), pt({ id: 'b:2', name: 'Salt Maid', faction: 'merchant', hostile: false, hull: 1, x: 900, y: 240, distance: 500, target: true })], { scale: 1.5, reach: 700 });
  const [layer] = byClass(globalThis.document.body, 'dfnaval-tags');
  const nodes = byClass(layer, 'dfnaval-tag');
  assert.equal(nodes.length, 2);
  assert.deepEqual(nodes.map((n) => n.className), ['dfnaval-tag pirate hostile', 'dfnaval-tag merchant target']);
  assert.deepEqual(nodes.map((n) => byClass(n, 'dfnaval-tag-name')[0].textContent), ['The Red Wake', 'Salt Maid']);
  assert.equal(byClass(nodes[0], 'dfnaval-tag-bar')[0].children[0].style.width, '62%');
  assert.equal(nodes[0].style.transform, 'translate(400px, 200px) scale(1.5) translate(-50%, -100%)');
  assert.deepEqual(nodes.map((n) => n.style.opacity), ['1', String(Math.round(tagAlpha(500, 700) * 100) / 100)]);
  // moved, never rebuilt
  drawNavalTags([pt({ x: 420, state: 'struck', hostile: false })], { scale: 1.5, reach: 700 });
  const again = byClass(layer, 'dfnaval-tag');
  assert.equal(again[0], nodes[0], 'the same node');
  assert.equal(again[0].style.transform, 'translate(420px, 200px) scale(1.5) translate(-50%, -100%)');
  assert.equal(byClass(again[0], 'dfnaval-tag-state')[0].textContent, 'Colours struck');
  assert.equal(again[1].style.display, 'none', 'a slot with no ship hidden');
  drawNavalTags([pt()], { covered: true });
  assert.ok(byClass(layer, 'dfnaval-tag').every((n) => n.style.display === 'none'), 'covered: all hidden');
  destroyNavalHud();
  assert.equal(byClass(globalThis.document.body, 'dfnaval-tags').length, 0);
  // the words and the fade
  assert.deepEqual([{ state: 'sinking' }, { state: 'prize' }, { state: 'afloat', boarded: true }, { state: 'struck' }, { state: 'afloat', hostile: true }].map((t) => tagState({ name: 'The Red Wake', ...t })),
    ['Going down', 'Taken', 'Boarded', 'Colours struck', ''], 'the card\'s words; none sailing - her red says hostile');
  assert.equal(tagState({ state: 'struck' }), 'Colours struck', 'a nameless ship with no board in reach is not mine');
  assert.equal(tagAlpha(TAG_FADE_FROM, 700), 1);
  assert.equal(tagAlpha(700, 700), TAG_FADE_TO);
  assert.equal(tagAlpha(2000, 700), TAG_FADE_TO);
  // the world's pass
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /drawPeerNames\(proj, view, mwv\.eye\);[^\n]*\n\s+navalTags\(proj, view, mwv\.eye\);/);
  assert.match(w, /const covered = townTalk\.overlayActive \|\| gamePaused\(\) \|\| !!townTalk\.hudHidden \|\| _mode\(\) !== 'exterior' \|\| !!travelView\?\.active;/);
  assert.match(w, /const at = projectToScreen\(t\.point, w, h, proj, view, rect\);/);
  assert.match(w, /if \(shipSight\.blocked\(player\.collider, eye, t\.id, t\.point\)\) continue;/);
  assert.match(w, /drawNavalTags\(points, \{ covered, scale: enhancedHudScale\(\), reach: NAVAL_TAG_RANGE, focus: \{ x: r\.x \+ r\.w \/ 2, y: r\.y \+ r\.h \/ 2 \} \}\);/);   // SHIP-CLUTTER: and the crosshair
  assert.match(w, /drawNavalHud\(null\); drawNavalTags\(\[\]\); drawCrewBars\(\[\]\); drawCrewLines\(\[\]\); \};/, 'the clear hides them - SHIPMATES: the crew\'s bars with them');
  assert.match(w, /drawNavalHud\(null\); drawNavalTags\(\[\]\); \} \}/, 'the switch off hides them');
});

test('AUDIT NAV1 (the presentation) HER HURTS SEEN, her list and her canvas (#15): her hurts showed nowhere but the card - now under DAMAGE_LIST_FROM of her hull she lists to the side she will go down on, to DAMAGE_LIST_MAX at nought, taken on as she fills (a hit would snap her over) and at it from her first pose; the sinking\'s own list takes it on with no snap back, her last pose the sinking\'s own; her canvas comes down with her sail share, her highest sails first, and goes back up mended (mutants: one side for all, the list unscaled, the list snapped, the sinking\'s list dropped, every sail kept, the lowest furled first)', async () => {
  assert.deepEqual([1, 0.81, 0.8, 0.41, 0.4, 0.01, 0, -1, 2].map((k) => sailsShown(5, k)), [5, 5, 4, 3, 2, 1, 0, 0, 5]);
  assert.equal(sailsShown(1, 0.01), 1, 'a rag of canvas left: her one sail');
  const h = await sea({ hull: 2, wind: [0, 0, 0] });   // no wind: no bob, her pose her heel and her list alone
  const near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
  const posed = (e, pitch, roll) => near(e.boat.MeshObject.localRotation, quatEuler(pitch, 0, e.ship.heel + roll));
  const e = place(h, 'merchantCarrack', [0, 0, 300], { seed: 1 });
  const lean = Math.sign(sinkAngles(1, 1).roll);
  const d = e.ship.damage;
  h.run(0.5);
  assert.ok(posed(e, 0, 0), 'whole: upright');
  d.apply({ hull: d.maxHull * 0.5, sail: 0, crew: 0 }, 0);
  h.run(0.5);
  assert.ok(posed(e, 0, 0), 'half her hull: upright still');
  d.apply({ hull: d.maxHull * 0.3, sail: 0, crew: 0 }, 0);   // 0.2: half way from DAMAGE_LIST_FROM to nought
  const want = DAMAGE_LIST_MAX * (DAMAGE_LIST_FROM - d.hullShare()) / DAMAGE_LIST_FROM;
  assert.ok(Math.abs(want - DAMAGE_LIST_MAX / 2) < 0.05, `about half DAMAGE_LIST_MAX (${want.toFixed(3)})`);
  h.host.frame(0.1);
  const first = want * (1 - Math.exp(-0.1 / DAMAGE_LIST_EASE_S));
  assert.ok(Math.abs(e.list - first) < 1e-9 && posed(e, 0, lean * first), 'taken on as she fills - not snapped over');
  h.run(DAMAGE_LIST_EASE_S * 6);
  assert.ok(Math.abs(e.list - want) < 0.02 && posed(e, 0, lean * e.list), `half DAMAGE_LIST_MAX at half way to nought (${e.list.toFixed(2)})`);
  // the other side for the other seed, and a ship first seen battered at her list at once
  const id = h.host.spawnShip('merchantCarrack', { range: 300, bearing: -1, yaw: 0 });
  const o = h.host._sea.get(id);
  o.ship.pos = [300, 0, 0];
  o.ship.seed = 0;
  o.ship.damage.apply({ hull: o.ship.damage.maxHull * 0.8, sail: 0, crew: 0 }, 0);
  h.host.frame(0.1);
  assert.ok(o.boat && Math.abs(o.list - want) < 1e-9, 'first seen battered: at her list');
  assert.ok(posed(o, 0, Math.sign(sinkAngles(0, 1).roll) * want) && Math.sign(sinkAngles(0, 1).roll) === -lean, 'to her own going-down side');
  // she founders: the sinking's list takes hers on, never back toward upright, and ends as the sinking's own
  d.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  let prev = e.list, last = null;
  while (h.host._sea.has(e.id) && d.sinkT < SINK_SECONDS - 0.15) {
    h.host.frame(0.1);
    const sink = sinkAngles(1, d.sinkT / SINK_SECONDS);
    const roll = Math.max(Math.abs(sink.roll), e.list);
    assert.ok(posed(e, sink.pitch, lean * roll), `her pose at ${d.sinkT.toFixed(1)} s`);
    assert.ok(roll >= prev - 1e-9, 'never back toward upright');
    prev = roll;
    last = { roll, sink: Math.abs(sink.roll) };
  }
  assert.ok(last && last.roll === last.sink && last.sink > DAMAGE_LIST_MAX, 'her last pose the sinking\'s own');
  // her canvas by her sail share, the highest first
  const c = place(h, 'merchantCarrack', [-300, 0, 0], { seed: 2 });
  const sails = [...c.boat.Sails];
  assert.equal(sails.length, 5);
  const high = (n) => n.worldMatrix()[13];
  c.ship.damage.apply({ hull: 0, sail: c.ship.damage.maxSail - Math.floor(c.ship.damage.maxSail * 0.4), crew: 0 }, 0);   // 0.4 of her canvas left, or a hair under
  h.host.frame(0.1);
  const shown = sails.filter((n) => n.activeSelf), gone = sails.filter((n) => !n.activeSelf);
  assert.equal(shown.length, sailsShown(5, c.ship.damage.sailShare()));
  assert.equal(shown.length, 2);
  assert.ok(Math.min(...gone.map(high)) > Math.max(...shown.map(high)), 'her highest furled away first');
  c.ship.damage.repair();
  h.host.frame(0.1);
  assert.ok(sails.every((n) => n.activeSelf), 'mended: all her canvas back');
});

test('AUDIT NAV1 (the presentation) HER HURTS SEEN, her smoke and her planks (#15): under SMOKE_FROM of her hull she smokes along SMOKE_SPAN of her deck each way from amidships (one point would be a chimney on a 93 m galley), more as she is hurt, from the part of it the sea has not reached - none born under it as she goes down; a ball into her hull sheds TIMBER_PER_HIT planks afloat where she was struck, laid long, a heavy ball one more, a ball through her canvas none; they drift and are gone by half again TIMBER_LIFE (mutants: the rate unscaled, a point not a line, the awash cut dropped, no planks, the heavy one dropped, planks off the rig)', async () => {
  // the line over the sea
  assert.deepEqual(lineOver([0, 2, 0], [10, 4, 0], 1), [[0, 2, 0], [10, 4, 0]]);
  assert.deepEqual(lineOver([0, 0, 0], [10, 4, 0], 1), [[2.5, 1, 0], [10, 4, 0]]);
  assert.deepEqual(lineOver([0, 4, 0], [10, 0, 0], 1), [[0, 4, 0], [7.5, 1, 0]]);
  assert.equal(lineOver([0, 0, 0], [10, 0.5, 0], 1), null);
  // the effects' smolder: SMOLDER_RATE puffs a second at the worst, by her hurt, each on the line
  const born = (k) => {
    const fx = createNavalEffects({ random: seeded(7) });
    for (let i = 0; i < 400; i++) fx.smolder([0, 5, -20], [0, 5, 20], 0.1, k);
    return fx.drawList();
  };
  const worst = born(1), light = born(0.25);
  assert.ok(Math.abs(worst.length - SMOLDER_RATE * 40) < SMOLDER_RATE * 40 * 0.25, `${worst.length} puffs in 40 s at the worst`);
  assert.ok(Math.abs(light.length - SMOLDER_RATE * 40 / 4) < SMOLDER_RATE * 40 / 4 * 0.45, `${light.length} at a quarter`);
  assert.ok(worst.every((p) => p.kind === 'smoke' && p.pos[1] === 5 && Math.abs(p.pos[0]) <= 1.2 && Math.abs(p.pos[2]) <= 20 + 1.2), 'on the line');
  const zs = worst.map((p) => p.pos[2]);
  assert.ok(Math.min(...zs) < -12 && Math.max(...zs) > 12, 'along the whole of it');
  // the host: her deck line by her hull, cut where the sea has reached
  const h = await sea({ hull: 2, wind: [0, 0, 0] });
  const calls = new Map();
  const fx = h.host._effects, smolder = fx.smolder;
  let tag = null;
  fx.smolder = (a, b, dt, k) => { calls.get(tag)?.push({ a, b, k }); smolder(a, b, dt, k); };
  const whole = place(h, 'merchantGalleon', [0, 0, 300]);
  const hurt = place(h, 'merchantGalleon', [300, 0, 0], { seed: 0 });   // by the head
  whole.fade = 1; hurt.fade = 1;   // AUDIT BAY A14 PIN MOVED: in the world whole - one coming into it raises no smoke under FADE_FLATS
  hurt.ship.damage.apply({ hull: hurt.ship.damage.maxHull * 0.7, sail: 0, crew: 0 }, 0);
  const seen = [];
  fx.smolder = (a, b, dt, k) => { seen.push({ a, b, k }); smolder(a, b, dt, k); };
  h.run(1);
  const build = hullBuild(hurt.ship.hull);
  assert.ok(seen.length >= 9, 'every frame');
  for (const { a, b, k } of seen) {
    assert.ok(Math.abs(k - (SMOKE_FROM - hurt.ship.damage.hullShare()) / SMOKE_FROM) < 1e-9, 'her hurt');
    assert.ok(Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) - (build.bowZ - build.aftZ) * SMOKE_SPAN) < 1e-6, 'SMOKE_SPAN of her length');
    assert.ok(Math.hypot(a[0] - hurt.ship.pos[0], a[2] - hurt.ship.pos[2]) > 5, 'from her deck, not her root');
  }
  assert.ok(!seen.some(({ a }) => Math.hypot(a[0] - whole.ship.pos[0], a[2] - whole.ship.pos[2]) < 40), 'a whole ship none');
  // she goes down by the head: her deck line cut at the sea, then none; no puff born under it
  seen.length = 0;
  hurt.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  let under = 0, cut = 0;
  while (h.host._sea.has(hurt.id)) {
    h.host.frame(0.1);
    under = Math.max(under, fx.drawList().filter((p) => p.kind === 'smoke' && p.pos[1] < 0).length);
  }
  for (const { a, b } of seen) {
    assert.ok(a[1] >= FLAME_AWASH - 1e-9 && b[1] >= FLAME_AWASH - 1e-9, 'the part over the sea');
    if (Math.abs(Math.min(a[1], b[1]) - FLAME_AWASH) < 1e-9) cut++;
  }
  assert.ok(cut > 5, `cut at the sea as she went (${cut})`);
  assert.equal(under, 0, 'no smoke born under the sea');
  // planks off a holed hull: TIMBER_PER_HIT at her waterline where she was struck, a heavy ball one more; none off her canvas
  const strike = async (gun, y) => {
    const g = await sea({ hull: 2, wind: [0, 0, 0] });
    const e = place(g, 'merchantGalleon', [150, 0, 0], { yaw: 0 });
    const hits = [];
    const hit = g.host._effects.hit;
    g.host._effects.hit = (p, ...rest) => { hits.push([...p]); hit(p, ...rest); };
    g.host._shots.fireVolley({ id: 'v1', shooter: 'me:42', launches: [{ delay: 0, p0: [150 - hullBuild(e.ship.hull).halfWidth - 3, y, 0], v0: [60, 0.5, 0], gun, index: 0 }], resolve: true });
    g.run(0.3);
    return { g, hits, planks: g.host._effects.drawList().filter((p) => p.kind === 'timber'), shreds: g.host._effects.drawList().filter((p) => p.kind === 'shred') };
  };
  const long = await strike('long', 3);
  assert.equal(long.hits.length, 1, 'struck her hull');
  assert.equal(long.planks.length, TIMBER_PER_HIT);
  for (const p of long.planks) {
    assert.ok(p.flat && p.solid && p.aspect >= 3 && p.aspect <= 5, 'a plank laid long on the sea');
    assert.ok(Math.abs(p.pos[1] - 0.06) < 1e-9, 'afloat');
    assert.ok(Math.hypot(p.pos[0] - long.hits[0][0], p.pos[2] - long.hits[0][2]) < 3, 'where she was struck');
  }
  // each plank followed by its own place (she fires back: planks off my own hull join them)
  const mine = long.planks.map((p) => p.pos), at = mine.map((q) => [...q]);
  const alive = () => { const all = new Set(long.g.host._effects.drawList().map((p) => p.pos)); return mine.filter((q) => all.has(q)); };
  long.g.run(5);
  assert.equal(alive().length, TIMBER_PER_HIT);
  assert.ok(mine.every((q, i) => Math.hypot(q[0] - at[i][0], q[2] - at[i][2]) > 0.3 && q[1] === at[i][1]), 'drifting on the sea');
  long.g.run(TIMBER_LIFE * 1.5 - 5 + 0.2, 0.5);
  assert.equal(alive().length, 0, 'gone by half again TIMBER_LIFE');
  assert.equal((await strike('heavy', 3)).planks.length, TIMBER_PER_HIT + 1, 'a heavy ball one more');
  const rig = await strike('long', 20);
  assert.ok(rig.shreds.length > 0 && rig.planks.length === 0, 'through her canvas: shreds, no planks');
});

test('AUDIT NAV1 (the presentation) SHE GROANS AS SHE GOES DOWN (#15): a gurgle at her founder was all, then silence for the rest of her going - now NAVAL_SFX.sinking loops from her founder under NAVAL_SINK_LOOP\'s profile, moved with her, until she is gone; asked again each frame until the bus has it; none for a struck ship; a peer\'s ship going down the same, and a room left or a clear stops it (mutants: never looped, never stopped, the fire\'s profile, never moved, asked once)', async () => {
  const h = await sea({ hull: 2 });
  const loops = [];
  let ready = false;
  h.deps.audio.loop3d = (k, p, v, opts) => {
    if (!ready) return null;
    const l = { k, v, opts, at: [...p], moves: 0, stopped: false, move(q) { l.moves++; l.at = [...q]; }, stop() { l.stopped = true; } };
    loops.push(l);
    return l;
  };
  const e = place(h, 'merchantGalleon', [200, 0, 0]);
  const d = e.ship.damage;
  d.apply({ hull: d.maxHull * 0.8, sail: 0, crew: 0 }, 0);
  h.run(1);
  assert.equal(d.state, SHIP_STATES.struck);
  assert.equal(loops.length, 0, 'struck: no groan');
  d.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  h.run(0.3);
  assert.equal(loops.length, 0, 'the bus not ready');
  ready = true;
  h.host.frame(0.1);
  assert.equal(loops.length, 1, 'asked again: heard');
  const [l] = loops;
  assert.deepEqual([l.k, l.v, l.opts], [NAVAL_SFX.sinking, 0.85, NAVAL_SINK_LOOP]);
  const moves = l.moves;
  e.ship.pos = [210, 0, 5];
  h.run(1);
  assert.equal(loops.length, 1, 'one loop');
  assert.ok(l.moves >= moves + 9 && l.at[0] === 210 && l.at[2] === 5, 'moved with her');
  while (h.host._sea.has(e.id)) h.host.frame(0.1);
  assert.equal(l.stopped, true, 'gone with her');
  // a peer's ship going down: the same, stopped when the room is left
  const o = await sea({ hull: 2, online: ONLINE });
  const heard = [];
  o.deps.audio.loop3d = (k) => { const x = { k, stopped: false, move() {}, stop() { x.stopped = true; } }; heard.push(x); return x; };
  o.host.applyWord('a-player', peerWord(WIRE_CLASS.pirateBrig, 2, 0), (p) => p);
  o.run(0.5);
  const theirs = heard.filter((x) => x.k === NAVAL_SFX.sinking);
  assert.equal(theirs.length, 1, 'their ship groans on my screen');
  o.host.clearPeers();
  assert.equal(theirs[0].stopped, true, 'a room left: silent');
  // a clear stops it too
  o.host.applyWord('a-player', peerWord(WIRE_CLASS.pirateBrig, 2, 0), (p) => p);
  o.run(0.5);
  const again = heard.filter((x) => x.k === NAVAL_SFX.sinking && !x.stopped);
  assert.equal(again.length, 1);
  o.host.clear();
  assert.equal(again[0].stopped, true, 'a clear: silent');
});
