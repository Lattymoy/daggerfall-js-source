// EG-LOOK (2026-10-15, Mac: "Bosses should also be oversized sprites. Not modeled like the abyss dungeon"; bible/11-Multiplayer/
// Elite-Gates-Look.md section 9): THE LORDS, OVERSIZED (scenes/eliteGates/egFight.js over world/eliteGates/egKit.js EG_LORD_PRESENCE). Every lord and
// champion is still Daggerfall's own sprite, drawn at its PRESENCE over its body's scale - a Court's lord 1.6, a Valkynaz 1.8, a
// champion 1.4, a twin and a mirror their own lord's - through egFight's own draw path over a recording renderer (the lab
// cannot show a lord: the sprites are the player's ARENA2, never shipped). The law of the body stands: `scale` the body's, the
// relay's bodyR and the hit target read off it, the wire untouched. What is seen follows the drawn sprite: its feet on the
// body's place (the quad grows up from its base), a flyer's hover risen with it, no giant's shadow (OW-BIG's law), an errand's
// numerals over its drawn head; its picture uploaded and sampled as at any size (NEAREST).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createEgFight, egLookOf, egPresenceOf, egGivenAt, EG_LORD_HOVER_M, EG_GIVEN_OVER_HEAD_M, EG_GIVEN_UP_LORD_M } from '../../../src/scenes/eliteGates/egFight.js';
import { EG_LORD_PRESENCE } from '../../../src/world/eliteGates/egKit.js';
import { EG_LORDS, EG_CHAMPIONS, EG_VALKYNAZ, EG_SEALED_MS, EG_DECREE_BY_KEY, EG_LAW_UNIT, egHallOf } from '../../../src/net/eliteGates/egLaw.js';
import { EG_BOSS_KEYS, egBossLook, egLordsOf } from '../../../src/net/eliteGates/egLords.js';
import { EG_ROLE, EG_FL } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND, EG_LEGION_KINDS, egKindLook } from '../../../src/net/eliteGates/egLegion.js';
import { egBreachNew, egEnter, egStep, egStateOf, egFightStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egBodyOf, egBodyHeight, foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { validEgOut } from '../../../src/net/wire.js';
import { egHallCentre } from '../../../src/world/eliteGates/egHall.js';
import { egScreenAt } from '../../../src/world/eliteGates/egTelegraph.js';
import { lookAt, perspective, multiply, UP_Y } from '../../../src/world/mat4.js';
import { GLOBAL_SCALE } from '../../../src/world/meshReader.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';

const T0 = 1_800_000_000_000;
const SEED = 12345;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };
/** Every record of every mobile 40 by 80 texels - 1 m by 2 m at Daggerfall's own scale. */
const SPRITE = Object.freeze({ w: 40 * GLOBAL_SCALE, h: 80 * GLOBAL_SCALE });
/** A boss's body row as the wire says it (net/eliteGates/egLink.js egBodyOf's `[i, role, k, pt, x, z, hp, max, fl, tx, tz, v, at, y, ty, st,
 *  sa, sz, yw]`) - `sz` thousandths of its look's size (0 its look's own). */
const lordRow = (i, key, { pt = 0, x = 0, z = 0, fl = 0, y = 0, sz = 0 } = {}) => egBodyOf([i, EG_ROLE.lord, EG_BOSS_KEYS.indexOf(key), pt, x, z, 900, 1000, fl, x, z, 0, 0, y, y, 1, 0, sz, Math.PI], T0);
const addRow = (i, k, { x = 0, z = 0, y = 0 } = {}) => egBodyOf([i, EG_ROLE.add, k, 0, x, z, 50, 50, 0, x, z, 0, 0, y, y, 0, 0, 0, Math.PI], T0);

/**
 * egFight over a recording renderer and the player's texture door stood in: every batch it makes (its archive, its record, its
 * size, its centres) and every frame it asks uploaded. `state()` the link's state, `clock.t` the fight's clock.
 */
function screen(state, clock, extra = {}) {
  const batches = [], uploads = [];
  const renderer = {
    textures: new Set(),
    createBillboardBatch: (archive, record, size, centres) => { const b = { archive, record, size: { ...size }, centres, origin: null, bounds: [0, 0, 0, Math.hypot(size.w, size.h) / 2], noShadow: undefined }; batches.push(b); return b; },
    destroyBillboardBatch: () => {},
  };
  const getTexture = async (archive) => ({ archive, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 });
  const fight = createEgFight({ renderer, getTexture, uploadRecordFrame: (...a) => uploads.push(a), audio: { play3d: () => {}, play3dId: () => {}, playOneShot: () => {} },
    link: { state }, now: () => clock.t, feet: () => null, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0', ...extra });
  return { fight, batches, uploads };
}
/** A trial at Hall `h` of SEED with `bodies` on its fight - its words as the screen holds them. */
function hallWith(h, bodies, pg = {}) {
  const spec = egHallOf(SEED, h, 0);
  return { spec, E: { ...EG_STATE_EMPTY, b: '0123456789abcdef', h, sg: 'trial', seed: SEED, geo: 0, end: null, hw: T0 - 5000, co: [['acct-0', 'Mac', 1]], fight: { ...EG_STATE_EMPTY.fight, h, wk: T0, bodies, pg } } };
}
/** The batch drawn for body `b` (by its place over the hall's centre). */
const batchOf = (fight, centre, b) => fight.batches().find((q) => near(q.origin[0], centre[0] + b.x, 1e-6) && near(q.origin[2], centre[2] + b.z, 1e-6));

test('EG-LOOK THE LORDS\' PRESENCE (Elite-Gates-Look.md section 9; world/eliteGates/egKit.js EG_LORD_PRESENCE, scenes/eliteGates/egFight.js egPresenceOf and egLookOf): a Court lord 1.6, a Valkynaz 1.8 (the four of the law\'s `valk`), a champion 1.4 (the Kyn ranks), the Twins a Court\'s; every boss on the wire looked at with `scale` its BODY\'s - its look\'s scale times the room\'s size and a mirror\'s 0.95 - and `drawn` that times its presence, a mirror\'s exactly 0.95 of its true lord\'s, Colossal\'s size multiplying both; a flyer\'s hover its body\'s 6 m times its presence, none grounded; the legion drawn as it was (mutants: a champion at a lord\'s presence; the Valkynaz at a lord\'s; the mirror\'s 0.95 lost; Colossal\'s size unread; the hover at the body\'s)', () => {
  assert.ok(Object.isFrozen(EG_LORD_PRESENCE));
  assert.deepEqual({ ...EG_LORD_PRESENCE }, { lord: 1.6, valkynaz: 1.8, champion: 1.4 });
  assert.deepEqual(Object.values(EG_LORDS).filter((L) => L.valk).map((L) => L.key).sort(), [...EG_VALKYNAZ].sort(), 'the Valkynaz are the law\'s four');
  for (const key of EG_BOSS_KEYS) {
    const want = EG_CHAMPIONS.some((C) => C.key === key) ? 1.4 : EG_LORDS[key]?.valk ? 1.8 : 1.6;
    assert.equal(egPresenceOf(key), want, `${key}'s presence`);
  }
  assert.deepEqual(['twins', 'hound', 'wyrm', 'colossus', 'garoth', 'seyth', 'kynreeve', 'markynaz'].map(egPresenceOf), [1.6, 1.6, 1.6, 1.6, 1.8, 1.8, 1.4, 1.4]);
  for (const [i, key] of EG_BOSS_KEYS.entries()) for (const pt of key === 'twins' ? [0, 1] : [0]) for (const sz of [0, 1250, 1400]) for (const mirror of [false, true]) {
    const b = lordRow(i + 1, key, { pt, sz, fl: mirror ? EG_FL.mirror : 0 }), L = egBossLook(key, pt), size = sz ? sz / EG_LAW_UNIT : 1, look = egLookOf(b, 0);
    const scale = L.scale * size * (mirror ? 0.95 : 1);
    assert.equal(look.mobile, L.mobile);
    assert.ok(near(look.scale, scale), `${key}: its body's scale (${look.scale})`);
    assert.equal(look.presence, egPresenceOf(key));
    assert.ok(near(look.drawn, scale * egPresenceOf(key)), `${key}: drawn at its presence (${look.drawn})`);
    assert.equal(look.hover, 0, 'a walker');
    if (mirror) assert.ok(near(look.drawn, 0.95 * egLookOf(lordRow(i + 1, key, { pt, sz }), 0).drawn), `${key}: a mirror 0.95 of its lord`);
  }
  // the flyers - the Mother of Dusk, the Wyrm - hover at their body's 6 m times their presence; grounded, on their feet
  for (const key of Object.values(EG_LORDS).filter((L) => L.fly).map((L) => L.key)) {
    assert.equal(egLookOf(lordRow(1, key, { fl: EG_FL.fly }), 0).hover, EG_LORD_HOVER_M * egPresenceOf(key), `${key} aloft`);
    assert.equal(egLookOf(lordRow(1, key, { fl: EG_FL.fly | EG_FL.grounded }), 0).hover, 0, `${key} dragged down`);
  }
  assert.equal(EG_LORD_HOVER_M, 6, 'the body\'s hover, as it was');
  // the legion as it was: its kind's scale, no presence
  for (let band = 0; band < 4; band++) for (const k of Object.values(EG_KIND)) {
    const look = egLookOf(addRow(1, k), band), K = egKindLook(k, band);
    assert.deepEqual([look.mobile, look.scale, look.presence, look.drawn], [K.mobile, K.scale, 1, K.scale]);
  }
});

test('EG-LOOK THE LORDS, DRAWN (section 9; scenes/eliteGates/egFight.js drawBody over a recording renderer): every boss\'s sprite at its presence - its quad w and h the record\'s times its body\'s scale times its presence, its sphere reaching the drawn quad - its FEET on its body\'s place (the base the renderer stands the quad up from), a mirror\'s 0.95 of its lord\'s, a champion\'s and a Valkynaz\'s their own; a grown sprite casts no shadow (OW-BIG\'s law) and the legion\'s still do; the hit target\'s reach the BODY\'s - its radius off its body\'s scale (the relay\'s bodyR), never the drawn one - and its height the drawn sprite\'s (the relay judges no height: a shot at the head you see meets him), standing at the drawn feet; a flyer\'s feet risen with its presence (its hover and its bob), clear over the company\'s heads, and its target with it; dragged down, on its feet (mutants: the sprite at the body\'s scale; the feet centred; the shadow kept; the sphere at the body\'s size; the target short of the drawn head; the hover or its bob at the body\'s; the target left on the ground under a flyer)', async () => {
  const at = (x) => ({ x, z: 30 });
  const bodies = [
    lordRow(1, 'hound', at(-12)), lordRow(2, 'garoth', at(-6)), lordRow(3, 'garoth', { ...at(0), fl: EG_FL.mirror }), lordRow(4, 'kynreeve', at(6)),
    lordRow(5, 'twins', { ...at(12), pt: 1 }), lordRow(6, 'dusk', { ...at(18), fl: EG_FL.fly }), lordRow(7, 'wyrm', { ...at(24), fl: EG_FL.fly | EG_FL.grounded }),
    addRow(8, EG_KIND.dlord, at(30)),
  ];
  const { spec, E } = hallWith(5, bodies), centre = egHallCentre(spec);
  // the clock at the crest of Dusk's bob (sin(t / 260 + 6) = 1 - her feet at their highest), past every body's rise
  const turn = Math.ceil((T0 + 1000 - 260 * (Math.PI / 2 - 6)) / (2 * Math.PI * 260));
  const clock = { t: 260 * (Math.PI / 2 - 6 + 2 * Math.PI * turn) };
  const S = screen(() => E, clock);
  S.fight.frame(); await new Promise((r) => setTimeout(r, 0));
  S.fight.frame();
  assert.equal(S.fight.batches().length, bodies.length, 'every body drawn');
  const targets = S.fight.hostTargets();
  for (const b of bodies) {
    const look = egLookOf(b, spec.band), q = batchOf(S.fight, centre, b), tg = targets.find((x) => x.i === b.i), key = EG_BOSS_KEYS[b.k];
    assert.ok(q && tg, `body ${b.i} drawn and a body my blows meet`);
    assert.equal(q.archive, ENEMY_BASICS[look.mobile].maleTexture, 'Daggerfall\'s own sprite');
    const w = SPRITE.w * look.drawn, h = SPRITE.h * look.drawn;
    assert.ok(near(Math.abs(q.size.w), w, 1e-9) && near(q.size.h, h, 1e-9), `body ${b.i}: its quad at its drawn size (${q.size.w} x ${q.size.h})`);
    assert.ok(near(q.bounds[3], Math.hypot(w, h) / 2, 1e-9), 'its sphere the drawn quad\'s');
    const feet = centre[1] + egBodyHeight(b, clock.t), lift = q.origin[1] - feet;
    if (b.role === EG_ROLE.lord) {
      assert.equal(q.noShadow, true, `${key}: a grown sprite casts no shadow`);
      assert.ok(near(tg.height, (2.2 * look.drawn) / 1.2, 1e-9) && near(tg.radius, Math.max(0.8, (1.8 * look.scale) / 3), 1e-9), `${key}: its target's reach the body's, its height the drawn sprite's (${tg.height}, ${tg.radius})`);
    } else {
      assert.equal(q.noShadow, undefined, 'the legion casts as it did');
      assert.deepEqual([tg.height, tg.radius], [EG_LEGION_KINDS[b.k].h, EG_LEGION_KINDS[b.k].r]);
    }
    assert.ok(near(tg.feet[1], q.origin[1], 1e-9) && near(tg.feet[0], q.origin[0], 1e-9) && near(tg.feet[2], q.origin[2], 1e-9), 'its target where its feet are drawn');
    if (look.hover > 0) {
      const P = look.presence;
      assert.ok(near(lift, (EG_LORD_HOVER_M + 0.15) * P, 1e-6), `${key}: her feet at her bob's crest, both grown with her (${lift} m)`);
      assert.ok(lift - 0.15 * P >= EG_LORD_HOVER_M * P - 1e-9 && lift - 0.15 * P > 1.8 + EG_LORD_HOVER_M, 'over the company\'s heads, higher than her body\'s hover');
    } else assert.ok(near(lift, 0, 1e-9), `body ${b.i}: its feet on its body's place (${lift})`);
  }
  // the ratios the law names, read off the drawn quads
  const H = (i) => batchOf(S.fight, centre, bodies[i - 1]).size.h;
  assert.ok(near(H(1), SPRITE.h * 3 * 1.6, 1e-9), 'Grath at a Court lord\'s 1.6 (9.6 m on a 2 m record)');
  assert.ok(near(H(2), SPRITE.h * 4 * 1.8, 1e-9), 'Garoth at a Valkynaz\'s 1.8');
  assert.ok(near(H(3), 0.95 * H(2), 1e-9), 'his mirror 0.95 of him');
  assert.ok(near(H(4), SPRITE.h * 2.5 * 1.4, 1e-9), 'the Kynreeve at a champion\'s 1.4');
  assert.ok(near(H(5), SPRITE.h * 2.6 * 1.6, 1e-9), 'Isk at a Court lord\'s');
  assert.ok(near(H(8), SPRITE.h * EG_LEGION_KINDS[EG_KIND.dlord].scale, 1e-9), 'the legion\'s Daedra Lord at its own scale');
});

/** A breach at Hall `h` of SEED woken, the circle bearing `dc` (net/eliteGates/egBrain.js's director, as test/net/eliteGates/egz_relay.test.js stands it). */
function wokenAt(h, dc = []) {
  let s = 7;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = [['acct-0', 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed: SEED, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  B.dc = dc.map((p) => [...p]);
  const spec = egHallOf(SEED, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  for (let k = 0; k < 80 && B.sg !== 'trial'; k++) { now += 250; egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); }
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  const E = foldEg(foldEg(EG_STATE_EMPTY, wire(egStateOf(B, now)), now), wire(egFightStateOf(B, now)), now);
  return { B, E, spec, now };
}

test('EG-LOOK THE BODY STANDS THE RELAY\'S (section 9, "the relay\'s bodyR and the client\'s hit target, both unchanged"; the shape the director mints): seed 12345\'s first Court\'s Grath stood by the director - at his look\'s own size and under Colossal II (1400) - folded through the wire onto a screen that draws him at his presence over his body: the reach to him exactly the radius the relay judges by, his target\'s height his drawn sprite\'s, his quad his body times 1.6, his size on the wire still his body\'s; nothing of the relay reads a presence (mutants: the target\'s radius off the drawn size; Colossal\'s size unread on the screen)', async () => {
  for (const [dc, sz] of [[[], 0], [[[EG_DECREE_BY_KEY.colossal.id, 2]], 1400]]) {
    const W = wokenAt(5, dc), L = egLordsOf(W.B.F)[0], clock = { t: W.now };
    assert.equal(L.key, 'hound');
    assert.equal(L.sz, sz, 'his size on the wire, the body\'s');
    const S = screen(() => W.E, clock), centre = egHallCentre(W.spec);
    S.fight.frame(); await new Promise((r) => setTimeout(r, 0));
    S.fight.frame();
    const tg = S.fight.hostTargets().find((q) => q.i === L.i), body = W.E.fight.bodies.find((q) => q.i === L.i), q = batchOf(S.fight, centre, body);
    const scale = egBossLook('hound').scale * (sz ? sz / EG_LAW_UNIT : 1);
    assert.ok(tg && q, 'drawn and met');
    assert.ok(near(tg.radius, L.r, 1e-9), `the reach to him the relay's own radius (${tg.radius} for ${L.r})`);
    assert.ok(near(tg.height, (2.2 * scale * EG_LORD_PRESENCE.lord) / 1.2, 1e-9), 'his target as tall as his drawn sprite - the relay judges no height');
    assert.ok(near(q.size.h, SPRITE.h * scale * EG_LORD_PRESENCE.lord, 1e-9), `drawn at his presence (${q.size.h} m)`);
    assert.ok(q.size.h >= tg.height - 1e-9, 'his capsule inside his sprite');
  }
  // the presence is this screen's alone: nothing under src/net/ names it (the relay's bundle - test/net/relayversion.test.js - unmoved)
  const net = new URL('../../../src/net/', import.meta.url).pathname, files = [];
  const walk = (dir) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) files.push(p); } };
  walk(net);
  for (const p of files) assert.doesNotMatch(readFileSync(p, 'utf8'), /EG_LORD_PRESENCE|egPresenceOf|egKit\.js/, `${p} reads no presence`);
});

test('EG-LOOK OVER THE DRAWN HEAD (section 9; AUDIT EG IV lane1 #15\'s errands by numeral, scenes/eliteGates/egFight.js egGivenAt): an errand\'s numerals over a lord stand EG_GIVEN_OVER_HEAD_M over the head its sprite is drawn to - a Court lord\'s grown head, a flyer\'s at its hover - where the camera sees it; with no sprite of it on this screen (its picture not yet come, a vanished lord) the law\'s EG_GIVEN_UP_LORD_M over its feet, never a head drawn some frame before (mutants: the numerals at the body\'s height; a vanished lord\'s stale head; the margin dropped)', async () => {
  const vael = lordRow(1, 'twins', { x: 0, z: 30 }), dusk = lordRow(2, 'dusk', { x: 8, z: 34, fl: EG_FL.fly });
  const { spec, E } = hallWith(5, [vael, dusk], { as: [[1, 1], [2, 1]] }), centre = egHallCentre(spec);
  const clock = { t: T0 + 1000 };
  const S = screen(() => E, clock);
  const eye = [centre[0] + 4, centre[1] + 8, centre[2] - 30], view = lookAt(eye, [centre[0] + 4, centre[1] + 10, centre[2] + 32], UP_Y), proj = perspective(1.4, 16 / 9, 0.1, 500), vp = multiply(proj, view);
  const sigilOf = (i) => S.fight.sigils().find((s) => s.key === `e${i}`);
  // no picture yet: the law's height over its feet
  S.fight.frame(); S.fight.drawPass(proj, view, eye, 1);
  const law = egScreenAt(vp, [centre[0] + vael.x, centre[1] + vael.y + EG_GIVEN_UP_LORD_M, centre[2] + vael.z]);
  assert.ok(law && near(sigilOf(1).x, law[0], 1e-9) && near(sigilOf(1).y, law[1], 1e-9), 'over its feet at the law\'s height while no sprite stands');
  await new Promise((r) => setTimeout(r, 0));
  S.fight.frame(); S.fight.drawPass(proj, view, eye, 1);
  for (const b of [vael, dusk]) {
    const q = batchOf(S.fight, centre, b), head = q.origin[1] + q.size.h, want = egScreenAt(vp, [q.origin[0], head + EG_GIVEN_OVER_HEAD_M, q.origin[2]]);
    assert.ok(want && near(sigilOf(b.i).x, want[0], 1e-9) && near(sigilOf(b.i).y, want[1], 1e-9), `${EG_BOSS_KEYS[b.k]}'s numerals over its drawn head (${head - centre[1]} m)`);
    assert.deepEqual(egGivenAt(b, centre, clock.t, head), [q.origin[0], head + EG_GIVEN_OVER_HEAD_M, q.origin[2]]);
    assert.ok(head - centre[1] > EG_GIVEN_UP_LORD_M + 3, 'far over where the law\'s height stood them');
  }
  assert.ok(EG_GIVEN_OVER_HEAD_M > 0);
  // Dusk vanishes from this screen (hidden): her numerals go back to the law's height, never her last drawn head
  E.fight = { ...E.fight, bodies: [vael, { ...dusk, fl: dusk.fl | EG_FL.hidden }] };
  S.fight.frame(); S.fight.drawPass(proj, view, eye, 1);
  const back = egScreenAt(vp, egGivenAt(dusk, centre, clock.t));
  assert.ok(back && near(sigilOf(2).x, back[0], 1e-9) && near(sigilOf(2).y, back[1], 1e-9), 'a vanished lord\'s numerals at the law\'s height');
  assert.deepEqual(egGivenAt(dusk, centre, clock.t), [centre[0] + dusk.x, centre[1] + dusk.y + EG_GIVEN_UP_LORD_M, centre[2] + dusk.z]);
});

test('EG-LOOK THE PIXEL LAW AT EVERY SIZE (section 9; SD-LOOK\'s NEAREST): a lord\'s frame is asked of the texture door by archive, record and frame alone - the same picture under the same key whatever size it is drawn at (Grath at his look\'s size and under Colossal ask one key) - and the door\'s upload names no sampling (scenes/dataPipeline.js uploadRecordFrame), so the renderer samples it NEAREST (render/renderer.js textureParams); the batch keeps the frame\'s key (mutants: none here - the door\'s and the renderer\'s own pins hold their halves)', async () => {
  const a = lordRow(1, 'hound', { x: 0, z: 30 }), b = lordRow(2, 'hound', { x: 6, z: 30, sz: 1400 });
  const { E } = hallWith(5, [a, b]), clock = { t: T0 + 1000 };
  const S = screen(() => E, clock);
  S.fight.frame(); await new Promise((r) => setTimeout(r, 0));
  S.fight.frame();
  assert.ok(S.uploads.length >= 2 && S.uploads.every((u) => u.length === 3 && u.every(Number.isInteger)), 'archive, record, frame - nothing of a size');
  const keys = new Set(S.uploads.map(([ar, rec, fr]) => `${ar}_${rec}#${fr}`));
  assert.equal(keys.size, 1, 'one picture for both sizes');
  assert.ok(S.fight.batches().every((q) => keys.has(`${q.archive}_${q.record}`)), 'each batch on that key');
  const pipe = readFileSync(new URL('../../../src/scenes/dataPipeline.js', import.meta.url), 'utf8');
  const door = pipe.slice(pipe.indexOf('const uploadRecordFrame = (archive, record, frame) => {'), pipe.indexOf('const uploadRecordFrame = (archive, record, frame) => {') + 3000);
  assert.match(door, /renderer\.uploadTexture\(archive, key, color32, \{ replacement \}\);/, 'the frame uploaded with no sampling of its own');
  const { textureParams } = await import('../../../src/render/renderer.js');
  const gl = { REPEAT: 'REPEAT', CLAMP_TO_EDGE: 'CLAMP', NEAREST: 'NEAREST', LINEAR: 'LINEAR' };
  assert.deepEqual(textureParams(gl, { replacement: true }), { wrap: 'REPEAT', filter: 'NEAREST' });
  assert.deepEqual(textureParams(gl, { replacement: false }), { wrap: 'REPEAT', filter: 'NEAREST' });
});
