// WB9d (2026-09-30, Mac: "Further improve his effects, ensure his ground affects actually cause damage and the player
// recieves proper feedback"): HIS GROUND BITES HARDER, AND IS FELT. Each pool bites half again what it did (a second in
// the fire was 5% and 2 points - easy to stand through), and every bite and every elemental blow of his says itself on
// the screen - the rim in its colour, flaring at the bite and breathing while I stand in it, its name and "step out"
// under the crosshair, and the hiss of the step in at once (the bite is a tick off: a step through is free, standing is
// not). DFU's red flash stays a blow's alone (ui/damageFlash.js - spell damage never flashed); the court speaks in its own.
//
//   the view       ui/gate/gateGroundView.js groundViewModel, drawGateGround
//   the court      scenes/gate/gateCourt.js burn/land - the ground's name and colour, the bite's moment and colour, the hiss
//   the ground     net/gate/gateBrain.js POOLS, SCAR_POOLS; render/gate/gateTelegraph.js poolShapes in the ground's own grain
//
// Design: bible/11-Multiplayer/World-Bosses.md section 14 (WB9d).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ATTACKS, POOLS, SCAR_POOLS, POOL_TICK_MS, fightProfile } from '../../../src/net/gate/gateBrain.js';
import { strikeDamage, landingPools } from '../../../src/net/gate/gateStrike.js';
import { GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import { BOSS_CUES, BURNING, ASPECT_CUE_IDS, groundStepCue, poolColor, attackColor } from '../../../src/world/gate/gateBoss.js';
import { courtToDungeon } from '../../../src/world/gate/gateArena.js';
import { poolShapes, TELEGRAPH_STYLE, TELEGRAPH_FS, TELEGRAPH_POOL } from '../../../src/render/gate/gateTelegraph.js';
import { createGateCourt } from '../../../src/scenes/gate/gateCourt.js';
import {
  groundViewModel, drawGateGround, destroyGateGround, GROUND_BITE_MS, GROUND_EDGE_IN, GROUND_EDGE_BITE, GROUND_EDGE_STEP, GROUND_VIEW_TEXT, GROUND_VIEW_CSS,
} from '../../../src/ui/gate/gateGroundView.js';
import { destroyGateBossBar } from '../../../src/ui/gate/gateBossBar.js';
import { destroyGateMarksCard } from '../../../src/ui/gate/gateMarksView.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const W = (key, over = {}) => ({ i: 1, a: ATTACKS[key].id, at: 10000, x: 0, z: 0, yw: 0, tg: [], ...over });
const state = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', phase: 2, hp: 900, max: 1000, fighters: 3, wrathAt: 10_000_000, ...over });

function fakeDoc() {
  const made = [];
  const node = (tag) => {
    const n = { tag, className: '', children: [], writes: { opacity: 0, background: 0, text: 0 }, append(...c) { this.children.push(...c); }, remove() { this.gone = true; } };
    const st = {}; let text = '';
    n.style = new Proxy(st, { set(o, k, v) { if (k === 'opacity') n.writes.opacity++; if (k === 'background') n.writes.background++; o[k] = v; return true; } });
    Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = v; n.writes.text++; } });
    made.push(n);
    return n;
  };
  const styles = [];
  return { made, styles, doc: { createElement: node, body: node('body'), head: { append: (s) => styles.push(s) }, getElementById: (id) => styles.find((s) => s.id === id) ?? null } };
}

test('WB9d the ground bites harder: every pool half again WBX5\'s - a second in the burning ground is 8% and 3 points, a meteor\'s 10% and 4 - Scarring\'s scars as much, Vengeful\'s a quarter more again (mutants: the old bite)', () => {
  assert.deepEqual({ ...POOLS.hellfire }, { r: 3, ms: 6000, pct: 0.08, base: 3 });
  assert.deepEqual({ ...POOLS.meteor }, { r: 5, ms: 9000, pct: 0.1, base: 4 });
  for (const k of ['slam', 'leap']) assert.deepEqual([SCAR_POOLS[k].pct, SCAR_POOLS[k].base], [0.08, 3]);
  assert.equal(strikeDamage(POOLS.hellfire.pct, 100, POOLS.hellfire.base), 11, 'a bite at 100 health');
  assert.equal(strikeDamage(POOLS.meteor.pct, 200, POOLS.meteor.base), 24);
  const V = fightProfile(['burning', 'vengeful']);
  assert.deepEqual([V.atk.hellfire.pool.pct, V.atk.hellfire.pool.base], [0.08 * 1.25, 3 * 1.25]);
  assert.equal(POOL_TICK_MS, 1000, 'a bite a second, as it was - the first a tick after the step in');
});

test('WB9d the view\'s reading: nothing to feel, nothing drawn; standing in his ground the rim breathes between its two strengths in the ground\'s colour and the warning names it; a bite flares the rim over the breath, in its own colour, falling over GROUND_BITE_MS; written in whole steps (mutants: the bite never falling; the warning out of the ground)', () => {
  assert.equal(groundViewModel({ now: 5000 }), null);
  assert.equal(groundViewModel({ now: 5000, biteAt: 5000 - GROUND_BITE_MS }), null, 'a bite long gone');
  const fire = [1, 0.4, 0.1], frost = [0.5, 0.8, 1];
  for (let t = 0; t < 2000; t += 37) {
    const m = groundViewModel({ inside: true, ground: 'Rime', color: frost, now: t });
    assert.ok(m.edge >= GROUND_EDGE_IN[0] - GROUND_EDGE_STEP / 2 && m.edge <= GROUND_EDGE_IN[1] + GROUND_EDGE_STEP / 2, `breathing: ${m.edge}`);
    assert.ok(Math.abs(m.edge / GROUND_EDGE_STEP - Math.round(m.edge / GROUND_EDGE_STEP)) < 1e-9, 'in whole steps');
    assert.equal(m.warn, 'Rime - step out!');
    assert.equal(m.rgb, '128, 204, 255');
  }
  const bite = groundViewModel({ inside: true, ground: 'Burning ground', color: fire, biteAt: 1000, biteColor: [1, 0, 0], now: 1000 });
  assert.ok(bite.edge >= GROUND_EDGE_IN[0] + GROUND_EDGE_BITE - GROUND_EDGE_STEP, `the bite flares: ${bite.edge}`);
  assert.equal(bite.rgb, '255, 0, 0', 'in the bite\'s colour');
  const flare = groundViewModel({ inside: false, biteAt: 1000, biteColor: [1, 0, 0], now: 1000 });
  const fade = groundViewModel({ inside: false, biteAt: 1000, biteColor: [1, 0, 0], now: 1000 + GROUND_BITE_MS * 0.5 });
  assert.ok(fade.edge > 0 && fade.edge < flare.edge && fade.warn === null, 'a blow landed, out of the ground: the flare alone, falling');
  assert.equal(GROUND_VIEW_TEXT.warn(''), 'Burning ground - step out!');
  assert.match(GROUND_VIEW_CSS, /\.wb-ground-edge \{ position: fixed; inset: 0; pointer-events: none;/, 'a readout: nothing to click');
});

test('WB9d the view drawn: two nodes made on the first need, each written only when it changes - the rim\'s colour once, its strength by the step, the warning\'s words once; hidden with the HUD and with nothing to feel; put away with the page (mutants: a write a frame; the warning left standing)', () => {
  destroyGateGround();
  const { made, doc } = fakeDoc();
  drawGateGround(null, { doc });
  assert.equal(made.length, 1, 'nothing made for nothing');
  const m = { edge: 0.3, rgb: '255, 102, 26', warn: 'Burning ground - step out!' };
  drawGateGround(m, { doc });
  const [edge, warn] = made.filter((n) => n.className.startsWith('wb-ground'));
  assert.equal(edge.className, 'wb-ground-edge'); assert.equal(warn.className, 'wb-ground-warn');
  assert.match(edge.style.background, /rgba\(255, 102, 26, 1\) 100%/);
  assert.equal(edge.style.opacity, '0.3'); assert.equal(warn.textContent, m.warn); assert.equal(warn.style.display, '');
  for (let i = 0; i < 5; i++) drawGateGround({ ...m }, { doc });
  assert.deepEqual([edge.writes.opacity, edge.writes.background, warn.writes.text], [1, 1, 1], 'nothing written again');
  drawGateGround({ ...m, edge: 0.32 }, { doc });
  assert.equal(edge.writes.opacity, 2);
  drawGateGround({ ...m, warn: null }, { doc });
  assert.equal(warn.style.display, 'none', 'out of the ground: no warning');
  drawGateGround(m, { doc, hidden: true });
  assert.equal(edge.style.opacity, '0'); assert.equal(warn.style.display, 'none');
  destroyGateGround();
  assert.ok(edge.gone && warn.gone);
});

function court({ feet = [0, 0, 0], save = 100 } = {}) {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const struck = [], sounds = [];
  const me = { health: 200, maxHealth: 200 };
  const c = createGateCourt({
    link, now: () => clock.t, audio: { play3d: (clip, p, v, o) => sounds.push(['clip', clip, p, o]), play3dId: (id, p, v, o) => sounds.push(['id', id, p, o]) },
    feet: () => courtToDungeon(feet[0], 0, feet[2]), player: () => me, save: () => save, strike: (d, how) => { struck.push([d, how]); },
  });
  return { c, link, clock, struck, sounds, feet };
}
const tick = (h, t, st) => { if (st) h.link.st = st; h.clock.t = t; h.c.frame(); };

test('WB9d the court feels it: a step into his ground hisses at my feet at once and the rim and the warning stand; each bite strikes through my throw and flares the rim in the ground\'s colour; his elemental blow landing on me flares it in its own; a plain blow is DFU\'s red flash alone; out of the ground, the warning goes (mutants: no hiss; the bite unflared; every blow flaring)', () => {
  destroyGateBossBar(); destroyGateMarksCard(); destroyGateGround();
  const h = court({ feet: [15, 0, 15] });
  const hf = W('hellfire', { i: 7, at: 10000, tg: [[1, 1]] });
  tick(h, 10000, state({ atk: hf }));
  assert.equal(h.c.state().pools.length, 1, 'the ground laid where it landed');
  h.feet[0] = 1; h.feet[2] = 1;
  tick(h, 10500);
  const hiss = h.sounds.filter((s) => s[1] === BURNING && s[3].pitch === BOSS_CUES.groundStep.pitch);
  assert.equal(hiss.length, 1, 'the step in hisses at once');
  assert.deepEqual(hiss[0][2], courtToDungeon(1, 0, 1), 'at my feet');
  assert.equal(h.c.state().inFire, true);
  assert.equal(h.struck.length, 0, 'the bite a tick off');
  tick(h, 11500);
  assert.equal(h.struck.length, 1);
  assert.deepEqual(h.struck[0], [strikeDamage(POOLS.hellfire.pct, 200, POOLS.hellfire.base), { fire: true, el: 'fire', name: 'burning ground' }]);
  assert.equal(h.c.state().biteAt, 11500, 'the bite flares the rim');
  tick(h, 11600);
  assert.equal(h.sounds.filter((s) => s[3]?.pitch === BOSS_CUES.groundStep.pitch).length, 1, 'no hiss while I stay');
  h.feet[0] = 15; h.feet[2] = 15;
  tick(h, 11700);
  assert.equal(h.c.state().inFire, false);
  // his elemental blow on me flares it; a plain one does not
  const r = court({ feet: [1, 0, 1], save: 50 });
  tick(r, 9999, state({ atk: W('hellfire', { i: 8, at: 10000, tg: [[1, 1]] }), md: ['rime'] }));
  tick(r, 10000);
  assert.equal(r.c.state().biteAt, 10000);
  const p = court({ feet: [1, 0, 1] });
  tick(p, 9999, state({ atk: W('slam', { i: 9, at: 10000 }) }));
  tick(p, 10000);
  assert.equal(p.struck.length, 1); assert.equal(p.c.state().biteAt, -Infinity, 'a blow of his weight: the dungeon context\'s red flash, as any foe\'s');
  assert.deepEqual(attackColor(ATTACKS.hellfire, fightProfile(['rime'])), [...attackColor(ATTACKS.hellfire, fightProfile(['rime']))]);
  // the hiss in his aspect's voice
  assert.equal(groundStepCue(fightProfile(['burning'])), BOSS_CUES.groundStep);
  assert.equal(groundStepCue(fightProfile(['rime'])).id, ASPECT_CUE_IDS.rime);
  assert.equal(groundStepCue(fightProfile(['venom'])).at, 'point');
});

test('WB9d the ground drawn in its own grain: each court\'s pools on their own quad, in his ground\'s colour and his element\'s grain, seething rather than winding up (mutants: the pools in the fire\'s grain under the rime)', () => {
  const R = fightProfile(['rime', 'scarring']);
  const pools = [...landingPools(W('slam', { x: 2, z: -3 }), R), ...landingPools(W('meteor', { tg: [[-68, -22]] }), R)];
  const shapes = poolShapes(pools, 10500, poolColor(R), TELEGRAPH_STYLE[R.el]);
  assert.equal(shapes.length, 2, 'one a court');
  assert.deepEqual(shapes.map((s) => s.court).sort(), [0, 1]);
  for (const s of shapes) { assert.equal(s.style, TELEGRAPH_STYLE.frost); assert.equal(s.pool, TELEGRAPH_POOL.ground); assert.equal(s.color, poolColor(R)); }
  assert.match(TELEGRAPH_FS, /if \(uPool == 1\) \{/);
  assert.match(TELEGRAPH_FS, /float seethe = 0\.85 \+ 0\.15 \* sin\(uSince \* 6\.283185307179586 \* 0\.6\);/, 'it seethes on its own clock (WB13a: slow - terrain, never a blow to come)');
  const gc = read('src/scenes/gate/gateCourt.js');
  assert.match(gc, /drawGateGround\(groundViewModel\(\{ inside: inFire, ground: groundName, color: groundColor, biteAt, biteColor, now: t, peril: order \?\? onMe, blindAt: arsenal\.blindAt\(\) \}\), \{ hidden: hudHidden\(\) \}\);/);   // WB13a: and a blow to come on my feet; PIN MOVED (WB14d): his or his Flame's (onMe)
  assert.match(gc, /drawGateGround\(null\);   \/\/ WB9d/, 'put away with the court');
  assert.match(read('src/scenes/world.js'), /drawGateBanner\(null\); drawGateMarksCard\(null\);( drawGateDamageChart\(null\);)? drawGateGround\(null\);/, 'and with a held frame');   // GATE-UX: the damage chart between them
  assert.match(read('src/scenes/dungeonContext.js'), /if \(!el\) flashPlayerDamage\(dmg\);/, 'DFU\'s red flash still a blow\'s alone');
});
