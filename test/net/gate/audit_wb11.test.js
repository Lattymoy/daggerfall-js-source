// AUDIT WB11 (2026-10-01, before the merge - Mac: "Definitely want to perform a comprehensive audit on this and ensure
// it's perfect"). The WB11 slice - the Legion-Lord's host and the marks' rotation for nine trials - read by six lenses
// over a frozen tree (94d91bdb): the brain (B), the relay and the wire (R), the court's client (C), the player's blows on
// his host (W), a real browser (U) and the record (D); each finding reproduced by a script against the real modules
// before anything changed, then fixed. One test a finding - one two lenses found is pinned once, under both names. The
// modules are read through their namespaces, so on the unfixed tree each test fails for its own finding, never the file
// for a name it lacks. bible/11-Multiplayer/World-Bosses.md section 17, "AUDIT WB11".
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as GB from '../../../src/net/gate/gateBrain.js';
import * as GL from '../../../src/net/gate/gateLink.js';
import * as GH from '../../../src/scenes/gate/gateHost.js';
import * as GBoss from '../../../src/world/gate/gateBoss.js';
import * as W from '../../../src/net/wire.js';
import { createGateCourt } from '../../../src/scenes/gate/gateCourt.js';
import { courtToDungeon } from '../../../src/world/gate/gateArena.js';
import { createEnchantCtx } from '../../../src/scenes/hostEnchant.js';
import { setDefaultEnchantCtx, ENCHANTMENT_TYPES as ET, PAYLOAD, doItemEnchantmentPayloads } from '../../../src/systems/enchantments.js';
import { stateAnims, HURT_ANIMS, MOVE_ANIMS, mobileOrientation, FLY_ANIM_SPEED } from '../../../src/characters/mobile/mobileUnit.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { DAMAGE_CHART_CSS } from '../../../src/ui/gate/gateDamageChart.js';
import { MARK_TIPS } from '../../../src/ui/gate/gateMarksView.js';
import { GATE_TRIALS } from '../../../src/net/gate/gateMods.js';   // WB13b
import { bossBarModel, destroyGateBossBar } from '../../../src/ui/gate/gateBossBar.js';
import { destroyGateMarksCard } from '../../../src/ui/gate/gateMarksView.js';
import { destroyGateGround } from '../../../src/ui/gate/gateGroundView.js';
import { marksLine, gateModsOf, gateTimes, gateRoomKey } from '../../../src/net/gate/gateLaw.js';
import { fakeRooms } from '../../fakeRoom.mjs';

const { HOST, COURTS, COURT_CENTRE, HIT_KINDS, ATTACKS } = GB;
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000;
const seeded = (s) => { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const LEGION = Object.freeze(['burning', 'legion', 'echoing']);
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
/** A Legion-Lord fight, its challengers seated at `lv`. */
function fightOf(n = 4, lv = 30, md = LEGION) {
  const f = GB.newFight(7, T0, T0 + 3_600_000, 'ruhn', md);
  for (let i = 0; i < n; i++) assert.ok(GB.joinFight(f, `s${i + 1}`, `P${i + 1}`, lv, T0, true));
  return f;
}
const hostOf = (over = {}) => ({ n: 0, ads: [], harryAt: 0, sapAt: 0, fed: 0, wardCt: -1, hSent: '', hSentAt: 0, ...over });
const body = (o) => ({ i: 1, k: HOST.harrier, h: 1000, m: 1000, x: 0, z: 0, mv: null, atk: null, tg: null, tgAt: 0, up: 0, next: 0, ...o });

/** The court and its host driver over a link the test writes (scenes/gate/gateCourt.js), a sprite of every record if asked. */
function rig({ feet = [0, 0, 4], textured = false, eye = [0, 1.7, -10] } = {}) {
  const link = { st: GL.GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const said = [], sent = [], hsent = [], made = [];
  const me = { health: 100, maxHealth: 100 };
  const tex = (a) => ({ archive: a, recordCount: 30, getFrameCount: () => 4, getSize: () => ({ width: 40, height: 60 }), getScale: () => ({ width: 0, height: 0 }) });
  const renderer = textured ? { textures: new Set(), createBillboardBatch: (archive, rkey, size) => { const b = { archive, record: rkey, size, bounds: [0, 0, 0, 0], origin: null }; made.push(b); return b; }, destroyBillboardBatch() {} } : null;
  const c = createGateCourt({
    renderer, gl: null, link, now: () => clock.t,
    getTexture: textured ? async (a) => tex(a) : null,
    uploadRecordFrame: textured ? (a, r, fr) => renderer.textures.add(`${a}_${r}#${fr}`) : null,
    audio: { play3d() {}, play3dId() {} },
    cam: () => courtToDungeon(eye[0], eye[1], eye[2]), feet: () => courtToDungeon(feet[0], 0, feet[2]), player: () => me,
    say: (t) => said.push(t), send: (h) => { sent.push(h); return true; }, sendHost: (h) => { hsent.push(h); return true; },
  });
  return { c, link, clock, said, sent, hsent, made, me };
}
const stOf = (over = {}) => ({ ...GL.GATE_STATE_EMPTY, day: 700, boss: 'ruhn', phase: 1, hp: 800, max: 1000, fighters: 3, wrathAt: 10_000_000, md: LEGION, lg: { ads: [], gone: [] }, ...over });
const ad = (o) => ({ i: 1, k: HOST.harrier, h: 45, m: 45, x: 0, z: 6, mv: null, atk: null, rose: -Infinity, yaw: 0, ...o });
const settle = () => new Promise((r) => setImmediate(r));
function clean() { destroyGateBossBar(); destroyGateMarksCard(); destroyGateGround(); }

// ═══ W: THE PLAYER'S BLOWS ON HIS HOST ═════════════════════════════════════════════════════════════════════════════

const FIRE = { index: 7, name: 'Wizard\'s Fire', rangeType: 1, element: 0, effects: [] };
const player = { isPlayer: true, level: 20, skills: new Array(40).fill(100), stats: { strength: 100, agility: 100, luck: 100, speed: 50 }, items: [], activeEffects: [], health: 100, maxHealth: 100 };
const blade = () => ({ name: 'Saber', templateIndex: 117, material: 0, group: 'Weapons', currentCondition: 1000, maxCondition: 1000, enchantments: [{ type: ET.CastWhenStrikes, param: 7 }] });

test('AUDIT WB11 W1 a Cast When Strikes blade that cut one of his host cast on HIM, wherever he stood: each body and each crystal has its own stand-in, naming it; the enchant door hands the stand-in it met to the court\'s door; the hosts\' mounts hand it through; the dungeon context lands the spell on the body it names (mutants: the stand-in dropped at the door; one stand-in a look; every stand-in routed to him)', () => {
  const look = GBoss.hostLookOf(HOST.harrier, 'burning');
  const a = GBoss.hostStandIn(look, 3), b = GBoss.hostStandIn(look, 4);
  assert.equal(a.hostI, 3, 'a host body\'s stand-in names it');
  assert.notEqual(a, b, 'one a body');
  assert.equal(GBoss.crystalStandIn(GBoss.bossLookOf('ruhn'), 2).crystalC, 2, 'a crystal\'s names its crystal');
  // the door: the stand-in it met goes with the spell
  const met = [];
  const magic = { applySpellToFoe: () => assert.fail('never a foe'), applySpellToPlayer: () => {} };
  setDefaultEnchantCtx(createEnchantCtx({ playerEntity: player, spellsByIndex: () => new Map([[7, FIRE]]), now: () => 0, sinks: {}, magic, foes: () => [], foeSinks: () => ({}), bossSpell: (r, t) => met.push([r.name, t]) }));
  try { doItemEnchantmentPayloads(PAYLOAD.Strikes, blade(), { entity: player, target: a, damage: 12 }); } finally { setDefaultEnchantCtx(null); }
  assert.deepEqual(met.map(([n, t]) => [n, t?.hostI]), [['Wizard\'s Fire', 3]], 'the spell and the body it met');
  // the hosts' mounts hand the stand-in to the live court's door
  for (const file of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const m = /\n {6}bossSpell: ([^\n]*?),   \/\/ WARDEN-STRIKE/.exec(read(file));
    assert.ok(m, `${file} mounts a door`);
    const got = [];
    new Function('modes', `return (${m[1]});`)({ dungeonCtx: { spellOnBoss: (r, t) => got.push(t) } })(FIRE, a);
    assert.equal(got[0], a, `${file}: the stand-in through the mount`);
  }
  // the context lands it on the body the stand-in names - one of his host, a crystal, else him
  // PIN MOVED (FIELD BUGS 2026-10-19f STAND-IN-WHOLE, HOST-SPLIT): the router left the context with the spell doors
  // (scenes/gate/standInSpell.js), which the context wires (its enchant door and its api ask spellOnStandIn)
  assert.match(read('src/scenes/dungeonContext.js'), /const \{ spellOnBoss, spellOnCrystal, spellOnHost, spellOnRival, spellOnStandIn, standInRound \} = createStandInSpell\(\{/);   // PIN MOVED (FIELD BUGS 2026-10-19f BOSS-DOT): and the rounds' frame
  const fn = /function spellOnStandIn\(record, target = null\) \{\n([\s\S]*?)\n {2}\}/.exec(read('src/scenes/gate/standInSpell.js'));
  assert.ok(fn, 'the context routes a strike spell by the stand-in it met');
  const route = new Function('spellOnHost', 'spellOnCrystal', 'spellOnBoss', `return (record, target = null) => {\n${fn[1]}\n};`)((r, i) => `host ${i}`, (r, c) => `crystal ${c}`, () => 'him');
  assert.deepEqual([route(FIRE, a), route(FIRE, GBoss.crystalStandIn(GBoss.bossLookOf('ruhn'), 1)), route(FIRE, GBoss.bossStandIn(GBoss.bossLookOf('ruhn'), 'Valkynaz Ruhn'))], ['host 3', 'crystal 1', 'him']);
  // the court offers each body with its own stand-in
  clean();
  const h = rig();
  h.link.st = stOf({ lg: { ads: [ad({ i: 1, x: 2, z: 6 }), ad({ i: 2, x: -2, z: 6 })], gone: [] } }); h.clock.t = 10; h.c.frame();
  const T = h.c.hostTargets();
  assert.deepEqual(T.map((q) => q.entity.hostI), [1, 2]);
  assert.notEqual(T[0].entity, T[1].entity);
  h.c.leave(); clean();
});

test('AUDIT WB11 W2 a shaft on one of his host - or a crystal - is no backstab: neither keeps a facing (their `yaw` 0 made every shaft from the -z side one, x3 and a Backstabbing use each); his own shaft keeps his facing (mutants: the feet handed to the host\'s shaft; to the crystal\'s)', () => {
  const d = read('src/scenes/dungeonContext.js');
  const opts = (who) => new RegExp(`playerArrowHitFoe\\(m, ${who}, \\{([^}]*)\\}`).exec(d)?.[1] ?? '';
  assert.match(opts('hb'), /playerFeet: null/, 'the host\'s shaft');
  assert.match(opts('cr'), /playerFeet: null/, 'the crystal\'s shaft');
  assert.match(opts('boss'), /playerFeet,/, 'his own shaft reads his facing');
});

test('AUDIT WB11 W3 ONE BLOW, ONE TOKEN: every frame of one blow (its `q`) on a body it has not met rides on the token it spent, BLOW_BODIES_MAX bodies at most and within BLOW_GROUP_MS - a swing through six Imps lands on six; a second frame on a body already met, a new sequence, or a late frame is a blow of its own; the court gives one sequence to the frames one frame of mine sends; the gate\'s frame bucket passes two such swings a second (mutants: a token a body; the court\'s two sequences; the bucket at 8)', () => {
  const f = fightOf(1, 30);
  const C = COURTS[0], pose = { x: C[0] + 3, z: C[1] + 4 };
  f.lg = hostOf({ ads: Array.from({ length: 10 }, (_, k) => body({ i: k + 1, x: C[0] + 2 + k * 0.2, z: C[1] + 5 })) });
  const p = f.players.s1, hp = () => f.lg.ads.map((a) => a.h);
  const t = T0 + 1000;
  for (let i = 1; i <= 6; i++) GB.applyHostHit(f, 's1', i, 5, HIT_KINDS.Spell, pose, t, 1);
  assert.deepEqual(hp().slice(0, 6), [995, 995, 995, 995, 995, 995], 'one blow met six bodies: six landed');
  assert.ok(Math.abs(p.rate - (GB.GATE_HIT_HZ_MAX - 1)) < 1e-9, 'one token spent');
  GB.applyHostHit(f, 's1', 1, 5, HIT_KINDS.Spell, pose, t, 1);
  GB.applyHostHit(f, 's1', 2, 5, HIT_KINDS.Spell, pose, t, 2);
  GB.applyHostHit(f, 's1', 3, 5, HIT_KINDS.Spell, pose, t, 3);
  GB.applyHostHit(f, 's1', 4, 5, HIT_KINDS.Spell, pose, t, 4);
  assert.deepEqual(hp().slice(0, 4), [990, 990, 990, 995], 'a body met twice is a second blow, and the hand still holds GATE_HIT_HZ_MAX blows a second');
  // ten bodies under one sequence, the hand full again: BLOW_BODIES_MAX ride on one token, the rest on a second
  const t2 = t + 2000;
  for (let i = 1; i <= 10; i++) GB.applyHostHit(f, 's1', i, 5, HIT_KINDS.Spell, pose, t2, 9);
  assert.ok(hp().every((h, k) => h === [985, 985, 985, 990, 990, 990, 995, 995, 995, 995][k]), `all ten landed: ${hp()}`);
  assert.ok(Math.abs(p.rate - (GB.GATE_HIT_HZ_MAX - 2)) < 1e-9, `two tokens for ten bodies (BLOW_BODIES_MAX ${GB.BLOW_BODIES_MAX})`);
  const late = t2 + GB.BLOW_GROUP_MS + 50, before = Math.min(GB.GATE_HIT_HZ_MAX, p.rate + ((late - t2) / 1000) * GB.GATE_HIT_HZ_MAX);
  f.lg.ads.push(body({ i: 11, x: C[0] + 2, z: C[1] + 6 }));
  GB.applyHostHit(f, 's1', 11, 5, HIT_KINDS.Spell, pose, late, 9);
  assert.ok(Math.abs(p.rate - (before - 1)) < 1e-9, 'a frame of it past BLOW_GROUP_MS is charged');
  // the one hand: a frame on him of a blow that met his host rides on it too, and the crystals' the same
  const g = fightOf(1, 30);
  g.lg = hostOf({ ads: [body({ i: 1, x: C[0] + 2, z: C[1] + 5 })] });
  const q = g.players.s1;
  GB.applyHostHit(g, 's1', 1, 5, HIT_KINDS.Spell, pose, t, 7);
  assert.ok(GB.applyHit(g, 's1', 5, HIT_KINDS.Spell, pose, t, 7) > 0, 'him, met by the same blow');
  assert.ok(Math.abs(q.rate - (GB.GATE_HIT_HZ_MAX - 1)) < 1e-9, 'one token for the two');
  // the court: one sequence to every frame of one frame of mine; a body met twice is a new blow; a frame ends the blow
  clean();
  const h = rig();
  h.link.st = stOf({ lg: { ads: [ad({ i: 1, x: 1, z: 6 }), ad({ i: 2, x: -1, z: 6 })], gone: [] } }); h.clock.t = 10; h.c.frame();
  assert.equal(h.c.hit({ d: 10, r: HIT_KINDS.Melee }), true);
  h.c.hostHit({ i: 1, d: 10, r: HIT_KINDS.Melee }); h.c.hostHit({ i: 2, d: 10, r: HIT_KINDS.Melee }); h.c.hostHit({ i: 1, d: 10, r: HIT_KINDS.Melee });
  h.clock.t = 30; h.c.frame();
  h.c.hostHit({ i: 2, d: 10, r: HIT_KINDS.Melee });
  assert.deepEqual([h.sent.map((m) => m.q), h.hsent.map((m) => m.q)], [[1], [1, 1, 2, 3]], 'him and two of his host by one swing: one sequence');
  h.c.leave(); clean();
  assert.ok(W.GATE_HZ_MAX >= 2 * (GB.HOST_STANDING_MAX + 1), 'two swings a second through a pack of his host and him pass the frame bucket');
});

test('AUDIT WB11 W4 one of his host still rising out of the stone is met where it is DRAWN - its offered body sinks with its sprite and stands at its hover once risen (it was offered whole from its first moment: a shaft stopped by nothing seen) (mutant: the sink not followed)', () => {
  clean();
  const h = rig();
  const look = GBoss.hostLookOf(HOST.harrier, 'burning');
  h.link.st = stOf({ lg: { ads: [ad({ i: 1, x: 20, z: 6, rose: 9_800 })], gone: [] } }); h.clock.t = 10_000; h.c.frame();
  const sink = GB.HOST_KINDS[HOST.harrier].h * (1 - 200 / GB.HOST_RISE_MS[HOST.harrier]);
  assert.ok(Math.abs(h.c.hostTargets()[0].feet[1] - (COURT_CENTRE[1] + look.hover - sink)) < 1e-9, 'rising: under the floor by its sink');
  h.clock.t = 9_800 + GB.HOST_RISE_MS[HOST.harrier] + 1; h.c.frame();
  assert.ok(Math.abs(h.c.hostTargets()[0].feet[1] - (COURT_CENTRE[1] + look.hover)) < 1e-9, 'risen: at its hover');
  h.c.leave(); clean();
});

test('AUDIT WB11 W5 one of his host bleeds against its OWN whole - the stand-in\'s health nothing can empty threw the lowest rung of blood at every blow: the court\'s target carries its whole, the context\'s body its `bloodOf`, and the swing and the shaft ladder against it (mutants: the swing laddered on the stand-in; the shaft)', () => {
  clean();
  const h = rig();
  h.link.st = stOf({ lg: { ads: [ad({ i: 1, h: 30, m: 75 })], gone: [] } }); h.clock.t = 10; h.c.frame();
  assert.equal(h.c.hostTargets()[0].m, 75, 'its whole on the target');
  h.c.leave(); clean();
  const d = read('src/scenes/dungeonContext.js');
  assert.match(d, /out\.push\(\{ host: q\.i, m: q\.m \?\? 0, bloodOf: \{ maxHealth: q\.m > 0 \? q\.m : 0 \},/, 'the body\'s blood');
  assert.match(d, /bloodHit\(damage, hb\.bloodOf, \{ fromPlayer: true,/, 'the swing\'s');
  assert.match(read('src/combat/arrowFlight.js'), /bloodHit\(dmg, foe\.bloodOf \?\? foe\.entity, \{ fromPlayer: true, weapon: m\.weapon \?\? null \}\)/, 'the shaft\'s (every other foe its entity\'s, as ever)');
});

// ═══ B: THE BRAIN ══════════════════════════════════════════════════════════════════════════════════════════════════

/** A wave of his host risen this beat, if any. */
const waveOf = (out, k) => out.find((o) => o.k === 'ad' && o.w === k) ?? null;

test('AUDIT WB11 B1/D4 a rim too crowded for the dice never has a wave risen beside them: four archers on the second court\'s far rim, and the Atronachs rise SAP_SPAWN_CLEAR clear of every challenger and SAP_FROM_HIM of him (swept round the rim); a first court ringed so no spot clears holds its Imps a beat, and they rise once the ring steps in (the rest went evenly round the rim, inside the clearance) (mutants: the sweep\'s spots unchecked; the wave\'s clock spent on a closed rim)', () => {
  const C1 = COURTS[1];
  for (let seed = 1; seed <= 12; seed++) {
    const f = fightOf(5, 30);
    f.phase = 2; f.court = 1; f.pos = [...C1]; f.yaw = 0; f.xa = [T0 - 60_000]; f.nextAt = T0 + 1e9; f.hp = f.max * 0.5; f.pending = null; f.queue = []; f.shieldUntil = 0;
    f.lg = hostOf({ wardCt: 1, sapAt: T0 });
    const bodies = [{ sub: 's1', x: C1[0] + 2.5, z: C1[1] + 1, dead: false }];
    for (let k = 0; k < 4; k++) { const a = Math.PI + (k / 3 - 0.5) * 2 * 1.05; bodies.push({ sub: `s${k + 2}`, x: C1[0] + Math.sin(a) * 20, z: C1[1] + Math.cos(a) * 20, dead: false }); }
    const wave = waveOf(GB.stepBrain(f, T0, bodies, seeded(seed)), HOST.sapper);
    assert.ok(wave && wave.a.length >= 1, `seed ${seed}: the wave rose`);
    for (const [, x, z] of wave.a) {
      assert.ok(Math.min(...bodies.map((b) => dist(b.x, b.z, x, z))) >= GB.SAP_SPAWN_CLEAR - 0.02, `seed ${seed}: an Atronach risen inside SAP_SPAWN_CLEAR`);
      assert.ok(dist(x, z, f.pos[0], f.pos[1]) >= GB.SAP_FROM_HIM - 0.02, `seed ${seed}: an Atronach risen inside SAP_FROM_HIM`);
    }
    for (let i = 0; i < wave.a.length; i++) for (let j = i + 1; j < wave.a.length; j++) assert.ok(dist(wave.a[i][1], wave.a[i][2], wave.a[j][1], wave.a[j][2]) >= GB.HOST_GAP_M - 0.02, 'two of a wave on top of each other');
    assert.equal(wave.m, GB.hostTeamHpFor(GB.SAPPER_TEAM_S, bodies.map(() => 30), wave.a.length), 'the wave\'s health shared by those that rose');
  }
  // the first court ringed at its rim - every rim spot within HOST_SPAWN_CLEAR of somebody: held, not raised beside them
  const C0 = COURTS[0];
  const f = fightOf(16, 30);
  f.nextAt = T0 + 1e9;
  f.lg = hostOf({ harryAt: T0 });
  const ring = (r) => Array.from({ length: 16 }, (_, k) => ({ sub: `s${k + 1}`, x: C0[0] + Math.sin((k / 16) * 2 * Math.PI) * r, z: C0[1] + Math.cos((k / 16) * 2 * Math.PI) * r, dead: false }));
  assert.equal(waveOf(GB.stepBrain(f, T0, ring(GB.HOST_RIM_R), seeded(1)), HOST.harrier), null, 'no spot clears: no wave');
  assert.equal(f.lg.harryAt, T0, 'held: the wave still due');
  const w = waveOf(GB.stepBrain(f, T0 + 250, ring(10), seeded(2)), HOST.harrier);
  assert.ok(w && w.a.length > 0, 'the ring stepped in: the wave rises at once');
  for (const [, x, z] of w.a) assert.ok(Math.min(...ring(10).map((b) => dist(b.x, b.z, x, z))) >= GB.HOST_SPAWN_CLEAR - 0.02);
  assert.equal(f.lg.harryAt, T0 + 250 + GB.HARRY_EVERY_MS, 'and the next one HARRY_EVERY_MS after it');
});

test('AUDIT WB11 B4/D5 the Ward-Bearers are sized by every challenger of the fight in the room as he lands - the fallen too: a court wiped through the bound\'s wind-up had two of HOST_HP_MIN, one blow each, when it walked back in (mutant: the fallen not counted)', () => {
  const OFF = [[3, 4], [-5, 2], [10, -8], [-12, 10], [6, 9], [-3, -11]];
  const raised = (deadFrom) => {
    const f = fightOf(6, 50);
    f.hp = f.max * (GB.PHASE_AT[0] - 0.01); f.nextAt = T0;
    for (let t = T0; t < T0 + 8000; t += 250) {
      const bodies = OFF.map(([x, z], i) => ({ sub: `s${i + 1}`, x, z, dead: t >= deadFrom }));
      const w = waveOf(GB.stepBrain(f, t, bodies, seeded(t)), HOST.bearer);
      if (w) return w;
    }
    return null;
  };
  const lived = raised(Infinity), wiped = raised(T0 + 1000);
  assert.ok(lived && wiped, 'both courts\' bearers rose');
  assert.deepEqual([wiped.a.length, wiped.m], [lived.a.length, lived.m], 'the wiped court\'s are the living court\'s');
  assert.equal(wiped.a.length, GB.bearerCountFor(6));
  assert.equal(wiped.m, GB.hostTeamHpFor(GB.BEARER_TEAM_S, OFF.map(() => 50), GB.bearerCountFor(6)));
});

test('AUDIT WB11 B2/C4 as Dagon\'s Wrath gathers his host crumbles AFTER his word (a screen that heard the crumbling first read it as the Ward-Bearers\' cap), and the court says nothing of his ward then - it stands through the wind-up (it said "his ward breaks") (mutants: the crumbling before the word; the line said over the Wrath)', () => {
  const f = fightOf(4, 30);
  f.phase = 2; f.court = 1; f.pos = [...COURTS[1]]; f.xa = [T0 - 60_000]; f.nextAt = T0 + 1e9;
  f.wrathAt = T0 + 60_000; f.shieldUntil = T0 + 100_000;
  f.lg = hostOf({ wardCt: 1, ads: [body({ i: 1, k: HOST.bearer, x: COURTS[1][0] + 9, z: COURTS[1][1] })] });
  const bodies = [[3, 4], [-5, 2], [10, -8], [-12, 10]].map(([x, z], i) => ({ sub: `s${i + 1}`, x: COURTS[1][0] + x, z: COURTS[1][1] + z, dead: false }));
  const out = GB.stepBrain(f, f.wrathAt - ATTACKS.wrath.windup, bodies, seeded(1));
  const ks = out.map((o) => o.k);
  assert.ok(ks.indexOf('atk') >= 0 && ks.indexOf('adie') > ks.indexOf('atk'), `his word first: ${ks}`);
  // the court, the Wrath gathering over the bearers' crumbling: no line of his ward
  clean();
  const h = rig({ feet: [COURTS[1][0], 0, COURTS[1][1] + 4] });
  const wrathAtk = { i: 9, a: ATTACKS.wrath.id, at: 20_000, x: COURTS[1][0], z: COURTS[1][1], yw: 0, tg: [] };
  h.link.st = stOf({ phase: 2, court: 1, x: COURTS[1][0], z: COURTS[1][1], shieldUntil: 99_000, lg: { ads: [ad({ i: 1, k: HOST.bearer, x: COURTS[1][0] + 9, z: COURTS[1][1] })], gone: [] } });
  h.clock.t = 14_000; h.c.frame();
  h.link.st = stOf({ phase: 2, court: 1, x: COURTS[1][0], z: COURTS[1][1], shieldUntil: 99_000, atk: wrathAtk, lg: { ads: [], gone: [{ i: 1, k: HOST.bearer, x: COURTS[1][0] + 9, z: COURTS[1][1], w: GB.HOST_GONE.crumbled, n: null, at: 14_100 }] } });
  h.clock.t = 14_200; h.c.frame();
  assert.ok(!h.said.includes(GH.COURT_HOST_TEXT.crumbled), `said over the Wrath: ${h.said}`);
  h.c.leave(); clean();
});

test('AUDIT WB11 B3/R2 a blow on one of his host standing before a wave rises is said by `ah` - the rising\'s word took the whole host\'s health as said and the screens held the old until the next whole state (mutant: the rising marking every one\'s health said)', () => {
  const f = fightOf(4, 30);
  const bodies = [[3, 4], [-5, 2], [10, -8], [-12, 10]].map(([x, z], i) => ({ sub: `s${i + 1}`, x, z, dead: false }));
  let t = T0;
  for (; t <= T0 + GB.HARRY_FIRST_MS + 2000; t += 250) GB.stepBrain(f, t, bodies, seeded(t));
  const a = f.lg.ads[0], next = f.lg.harryAt;
  for (; t < next; t += 250) GB.stepBrain(f, t, bodies, seeded(t));
  GB.applyHostHit(f, 's1', a.i, 25, HIT_KINDS.Spell, { x: 3, z: 4 }, t - 100);
  const said = [];
  for (let k = 0; k < 3; k++, t += 250) said.push(...GB.stepBrain(f, t, bodies, seeded(t)));
  assert.ok(waveOf(said, HOST.harrier), 'the wave rose');
  const ah = said.find((o) => o.k === 'ah' && o.h.some(([i]) => i === a.i));
  assert.ok(ah, 'its health said');
  assert.deepEqual(ah.h.find(([i]) => i === a.i), [a.i, Math.ceil(a.h)]);
});

// ═══ R: THE RELAY ══════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT WB11 R1 a blow on one of his host - and on a crystal - keeps the beat as a blow on him does (AUDIT WBX R6): they returned before it, and a host struck by a fighter come back without a word stood frozen, never walking or Biting (mutant: the beat kept for him alone)', async () => {
  let DAY = 0;
  while (!gateModsOf(DAY).includes('legion')) DAY++;
  for (const k of ['ahit', 'xhit']) {
    const TT = gateTimes(DAY), realNow = Date.now;
    let clock = TT.openAt + 1000;
    Date.now = () => clock;
    try {
      const r = fakeRooms({ now: () => clock }).room(gateRoomKey(DAY));
      const at = (x, z) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0 });
      const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'gate', ...o }));
      const tick = async (n) => { for (let i = 0; i < n; i++) { clock += GB.BRAIN_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); } };
      const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 10));
      await say(a, { k: 'in', lv: 10, bv: W.GATE_BRAIN_V });
      await tick((GB.HARRY_FIRST_MS + 2000) / GB.BRAIN_TICK_MS);
      const f = r.room._fight;
      assert.ok(f.lg?.ads.length, 'a wave stands');
      a.close(1000, 'bye'); await r.drop(a);
      await tick(2);
      assert.ok(r.alarm.at - clock > 60_000, 'the court emptied: the beat sleeps');
      clock += 60_000;
      const b = r.connect(); await r.hello(b, 'peer-0001', at(0, 10));
      await say(b, k === 'ahit' ? { k, i: f.lg.ads[0].i, q: 9, d: 15, r: HIT_KINDS.Spell } : { k, c: 0, q: 9, d: 15, r: HIT_KINDS.Spell });
      assert.ok(r.alarm.at - clock <= GB.BRAIN_TICK_MS, `${k}: the beat kept`);
    } finally { Date.now = realNow; }
  }
});

// ═══ C: THE COURT'S CLIENT ═════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT WB11 C1/C7 his host moves by its own mobile\'s law (characters/mobile/mobileUnit.js stateAnims and the flyer\'s clock): an Imp has no idle frames and idles and rises on its move loop at FLY_ANIM_SPEED; the winged Seducer idles at the flyer\'s clock; every look\'s tables are the port\'s own (mutants: the Imp on idle records it lacks; the Seducer at the walker\'s clock)', () => {
  for (const [key, table] of Object.entries(GBoss.HOST_LOOKS)) {
    for (const aspect of Object.keys(table)) {
      const k = GB.HOST_KINDS.find((q) => q.key === key).id, look = GBoss.hostLookOf(k, aspect);
      const want = (state) => stateAnims(state, look.mobile, !!ENEMY_BASICS[look.mobile]?.hasIdle, false, false, true, false, look.winged);
      assert.equal(GBoss.hostAct({ k, rose: -Infinity }, 10_000, look).anims, want('idle'), `${key}/${aspect} idle`);
      assert.equal(GBoss.hostAct({ k, rose: 9_900 }, 10_000, look).anims, want('idle'), `${key}/${aspect} rising`);
    }
  }
  const imp = GBoss.hostLookOf(HOST.harrier, 'rime');
  assert.equal(GBoss.hostAct({ k: HOST.harrier, rose: -Infinity }, 10_000, imp).anims, MOVE_ANIMS, 'the Imp idles on its move loop');
  assert.equal(GBoss.hostAct({ k: HOST.harrier, rose: 10_000 }, 10_500, imp).frame, Math.floor(0.5 * FLY_ANIM_SPEED), 'rising at the flyer\'s clock');
  const seducer = GBoss.hostLookOf(HOST.bearer, 'storm');
  assert.equal(GBoss.hostAct({ k: HOST.bearer, rose: -Infinity }, 1000, seducer).frame, FLY_ANIM_SPEED, 'the winged Seducer idles at the flyer\'s clock');
});

test('AUDIT WB11 C2 one of his host falls as it last faced - it turned to +z for its fall, a side view gone to its back (mutant: the fall at yaw 0)', async () => {
  clean();
  const h = rig({ textured: true, eye: [0, 1.7, -10] });
  const s0 = stOf({ lg: { ads: [ad({ i: 5, x: 0, z: 6, yaw: Math.PI / 2 })], gone: [] } });
  h.link.st = s0; h.clock.t = 1000; h.c.frame(); await settle(); h.clock.t = 1016; h.c.frame();
  const imp = () => h.made.filter((b) => b.archive === ENEMY_BASICS[GBoss.hostLookOf(HOST.harrier, 'burning').mobile].maleTexture);
  assert.equal(imp().length, 1, 'drawn');
  h.link.st = stOf({ lg: { ads: [], gone: [{ i: 5, k: HOST.harrier, x: 0, z: 6, w: GB.HOST_GONE.slain, n: 'Ann', at: 1020 }] } });
  h.clock.t = 1032; h.c.frame();
  const feet = courtToDungeon(0, 0, 6), eye = courtToDungeon(0, 1.7, -10);
  const want = HURT_ANIMS[mobileOrientation(Math.PI / 2, feet, eye)].record, yaw0 = HURT_ANIMS[mobileOrientation(0, feet, eye)].record;
  assert.notEqual(want, yaw0, 'the premise: its facing and +z show it apart');
  assert.equal(imp()[0].record.split('#')[0], String(want), 'falling as it faced');
  h.c.leave(); clean();
});

test('AUDIT WB11 C3 two Ward-Bearers cut down between two of my frames are said with the count each left - "2 stand", "1 stands" - never the count after both twice, nor "the last" twice (mutant: the count taken once a frame)', () => {
  for (const [n, want] of [[3, ['Ann cuts down a Ward-Bearer. 2 stand.', 'Bo cuts down a Ward-Bearer. 1 stands.']], [2, ['Ann cuts down a Ward-Bearer. 1 stands.', GH.COURT_HOST_TEXT.felled('Bo', 0)]]]) {
    clean();
    const h = rig();
    const bearers = Array.from({ length: n }, (_, k) => ad({ i: k + 1, k: HOST.bearer, x: 9 * Math.sin(k * 2), z: 9 * Math.cos(k * 2) }));
    h.link.st = stOf({ phase: 2, shieldUntil: 99_000, lg: { ads: bearers, gone: [] } }); h.clock.t = 10_000; h.c.frame();
    const gone = (b, who) => ({ i: b.i, k: HOST.bearer, x: b.x, z: b.z, w: GB.HOST_GONE.slain, n: who, at: 10_050 });
    h.link.st = stOf({ phase: 2, shieldUntil: 99_000, lg: { ads: bearers.slice(2), gone: [gone(bearers[0], 'Ann'), gone(bearers[1], 'Bo')] } });
    h.clock.t = 10_100; h.c.frame();
    assert.deepEqual(h.said.filter((t) => t.includes('Ward-Bearer') && !t.startsWith('His')), want, `${n} bearers`);
    h.c.leave(); clean();
  }
});

test('AUDIT WB11 C5/U3 the bar\'s "of how many rose" is kept only while one of that wave stands: a whole state after a lost socket kept the last court\'s ("3 of 4 stand" where three rose) (mutant: the old wave\'s count kept)', () => {
  const md = [...LEGION];
  const st = (lg, sh) => W.validGateOut({ k: 'st', d: 7, b: 'ruhn', ph: 2, h: 900, m: 1000, x: 0, z: 0, yw: 0, mv: null, atk: null, sh, wr: 9e12, n: 4, fell: null, wrath: null, md, ct: 1, xa: [], lg });
  let s = GL.foldGate(GL.GATE_STATE_EMPTY, st([], 50_000), 1000);
  s = GL.foldGate(s, W.validGateOut({ k: 'ad', w: HOST.bearer, m: 100, a: [[1, 9, 0], [2, -9, 0], [3, 0, 9], [4, 0, -9]], at: 1000 }), 1000);
  const tuple = (i, x, z) => [i, HOST.bearer, 100, 100, x, z, x, z, 0, 0, 0, 0, 0];
  const next = GL.foldGate(s, st([tuple(9, 9, 0), tuple(10, -9, 0), tuple(11, 0, 9)], 50_000), 2000);
  const bar = bossBarModel(next, 2000, { name: 'Valkynaz Ruhn', title: 'Warden' });
  assert.ok(bar.callout && !/ of 4 /.test(bar.callout.text) && bar.callout.text.includes('3'), `the bar: ${bar.callout?.text}`);
  assert.equal(next.lg.ward, undefined, 'another wave\'s state: the count dropped');
  const same = GL.foldGate(s, st([tuple(2, -9, 0), tuple(3, 0, 9)], 50_000), 2000);
  assert.equal(same.lg.ward?.n, 4, 'a state of the same wave keeps its count');
  assert.deepEqual(s.lg.ward, { n: 4, at: 1000, is: [1, 2, 3, 4] }, 'the wave\'s count and which rose');
});

test('AUDIT WB11 C6/U4 a Sapper\'s path and a Ward-Bearer\'s tether seethe by a clock a float can hold (the page\'s in seconds moved every 128 s in the pass\'s float, and never throbbed) (mutant: the epoch\'s seconds)', () => {
  const P = GB.fightProfile(LEGION), now = 1_790_812_800_000;
  const s = stOf({ phase: 2, shieldUntil: now + 5000, x: 0, z: 0, lg: { ads: [ad({ i: 1, k: HOST.sapper, x: -20, z: 0, mv: { x: -20, z: 0, tx: -3, tz: 0, v: 1.6, at: now - 2000 } }), ad({ i: 2, k: HOST.bearer, x: 9, z: 0 })], gone: [] } });
  const lanes = GH.hostShapes(s, now, P).filter((q) => q.pool);
  assert.equal(lanes.length, 2, 'a path and a tether');
  for (const q of lanes) assert.ok(q.since >= 0 && q.since < 60, `since ${q.since}`);
  assert.ok(Math.abs(GH.hostShapes(s, now + 333, P).find((q) => q.pool).since - lanes[0].since - 0.333) < 1e-6, 'and it runs');
});

test('AUDIT WB11 C8 his host\'s shapes are refilled into their slots, never made a frame - AUDIT WB D10\'s law the driver claimed (mutant: a new shape a frame)', () => {
  const P = GB.fightProfile(LEGION), out = [];
  const s = stOf({ phase: 2, shieldUntil: 15_000, lg: { ads: [ad({ i: 1, atk: { at: 10_500, x: 2, z: 3 } }), ad({ i: 2, k: HOST.bearer, x: 9, z: 0 })], gone: [] } });
  GH.hostShapes(s, 10_000, P, out);
  const first = [...out];
  GH.hostShapes(s, 10_016, P, out);
  assert.equal(out.length, first.length);
  out.forEach((q, k) => { assert.equal(q, first[k], 'the same slot'); assert.equal(q.origin, first[k].origin, 'its arrays too'); });
});

// ═══ U: THE BROWSER'S ══════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT WB11 C9/U5 a Legion-Lord night\'s chart keeps its Host column on a narrow screen, in the place of the falls (it folded away whole; the patch said a Host column on those nights) (mutant: the column folded)', () => {
  const narrow = /@media \(max-width: 640px\), \(max-height: 480px\) \{([\s\S]*?)\n\}/.exec(DAMAGE_CHART_CSS)?.[1] ?? '';   // WB13c: a phone held sideways is narrow too
  assert.match(narrow, /\.wb-dmg-hosted \.wb-dmg-row > \.wb-dmg-host \{ display: block; \}/, 'the Host column shown');
  assert.match(narrow, /\.wb-dmg-hosted \.wb-dmg-row > \.wb-dmg-falls \{ display: none; \}/, 'in the falls\' place');
  assert.match(narrow, /\.wb-dmg-hosted \.wb-dmg-row \{ grid-template-columns: 18px minmax\(0, 1fr\) 58px 44px 50px; \}/, 'the narrow grid\'s five columns, the last wide enough for a host\'s five figures');
});

test('AUDIT WB11 U1/M1/D6 the Legion-Lord\'s tip is as short as the others\' (138 characters made the tallest marks card, off a landscape phone\'s foot), and its line keeps its creatures capitalised wherever it is said - the chat lowers a line\'s first letter, and "imps harry ... Atronachs" read wrong (mutants: the long tip; the line on "Imps")', () => {
  const others = Object.entries(MARK_TIPS).filter(([k]) => k !== 'legion').map(([, v]) => v.length);
  assert.ok(MARK_TIPS.legion.length <= Math.max(...others), `${MARK_TIPS.legion.length} characters against ${Math.max(...others)}`);
  // WB13b: the chat names the marks (the card says what each does) - the trial's line keeps its creatures capitalised
  assert.equal(marksLine({ boss: 'Valkynaz Ruhn', md: ['burning', 'echoing', 'legion'] }), 'Valkynaz Ruhn comes the Burning tonight, Echoing and Legion-Lord.');
  assert.match(GATE_TRIALS.find((t) => t.id === 'legion').text, /Imps, Atronachs and Ward-Bearers/);
});

test('AUDIT WB11 U2 under the Burning a Ward-Bearer\'s Pulse - the disc that hurts - is the fire\'s orange, apart from the ward\'s gold its tether wears (both were hue 43) (mutant: the Nova\'s gold)', () => {
  const hue = ([r, g, b]) => { const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m; if (!d) return 0; const h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  const pulse = GBoss.hostPulseColor(GB.fightProfile(['burning', 'legion', 'echoing']));
  assert.ok(Math.abs(hue(pulse) - hue(GBoss.WARD_COLOR)) >= 10, `hue ${hue(pulse).toFixed(1)} against the ward's ${hue(GBoss.WARD_COLOR).toFixed(1)}`);
  for (const a of ['rime', 'storm', 'venom']) assert.deepEqual(GBoss.hostPulseColor(GB.fightProfile([a, 'legion', 'echoing'])), GBoss.ASPECT_COLORS[a].nova, `${a}: his element's own`);
});

// ═══ D: THE RECORD ═════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT WB11 D1 when the last Ward-Bearer falls his OWN ward follows for its breath (SHIELD_MS, Unyielding\'s 6 s - the signature cast under it): the court\'s words say it fails, never that it breaks - every blow in that breath still turned (mutants: "breaks" said; the breath dropped)', () => {
  assert.ok(!/breaks/.test(GH.COURT_HOST_TEXT.felled('Ann', 0)) && !/breaks/.test(GH.COURT_HOST_TEXT.crumbled));
  assert.match(GH.COURT_HOST_TEXT.felled('Ann', 0), /his ward is failing!$/i);
  // the patch notes say the same - on the pull request since REL6 (#503), no longer a file in the tree
  // the brain: the bearers' wait over, his own ward for SHIELD_MS
  const f = fightOf(4, 30);
  f.phase = 2; f.court = 1; f.pos = [...COURTS[1]]; f.xa = [T0 - 60_000];
  f.pending = { wait: 'bearers' }; f.waitUntil = T0 + 20_000; f.shieldUntil = f.waitUntil; f.nextAt = T0; f.queue = [];
  f.lg = hostOf({ wardCt: 1, ads: [] });
  const bodies = [[3, 4], [-5, 2], [10, -8], [-12, 10]].map(([x, z], i) => ({ sub: `s${i + 1}`, x: COURTS[1][0] + x, z: COURTS[1][1] + z, dead: false }));
  GB.stepBrain(f, T0 + 250, bodies, seeded(1));
  assert.equal(f.shieldUntil, T0 + 250 + GB.fightProfile(LEGION).shieldMs, 'his own ward follows');
  const pose = { x: COURTS[1][0] + 3, z: COURTS[1][1] + 4 };
  assert.equal(GB.applyHit(f, 's1', 50, HIT_KINDS.Spell, pose, f.shieldUntil - 10), 0, 'a blow in its breath turns');
  assert.ok(GB.applyHit(f, 's1', 50, HIT_KINDS.Spell, pose, f.shieldUntil + 10) > 0, 'after it, lands');
});

test('AUDIT WB11 D2/D7 what the slice\'s row said it pinned, pinned: a blow on his host clipped at HIT_CAP_X short of its body\'s health, and nothing from an empty bucket; the Atronachs never armed while the Burning Court\'s turn is pending or his ward holds; a non-Legion fight\'s quiet beats roll nothing; no more than HARRIERS_MAX Imps stand; an Imp keeps its mark HOST_RETARGET_MS; a Sapper drunk never heals him past his whole; a Ward-Bearer Pulses every BEARER_PULSE_MS; `ah` at most every HP_SEND_MS (mutants: each cap, each clock)', () => {
  const C0 = COURTS[0], pose = { x: C0[0] + 3, z: C0[1] + 4 };
  // the purse: the cap, then the bucket
  {
    const f = fightOf(1, 30);
    f.lg = hostOf({ ads: [body({ i: 1, h: 1e6, m: 1e6, x: C0[0] + 2, z: C0[1] + 5 })] });
    const p = f.players.s1, cap = GB.HIT_CAP_X * GB.dpsRef(30);
    GB.applyHostHit(f, 's1', 1, 1e5, HIT_KINDS.Spell, pose, T0 + 1000, 1);
    assert.ok(Math.abs(1e6 - f.lg.ads[0].h - cap) < 1e-6, 'clipped at HIT_CAP_X a blow');
    p.bucket = 0; p.bucketAt = T0 + 2000;
    const h = f.lg.ads[0].h;
    GB.applyHostHit(f, 's1', 1, 50, HIT_KINDS.Spell, pose, T0 + 2000, 2);
    assert.equal(f.lg.ads[0].h, h, 'nothing from an empty bucket');
  }
  // the Atronachs armed only once the turn is done and the ward down
  {
    const C1 = COURTS[1];
    const bodies = [[3, 4], [-5, 2], [10, -8], [-12, 10]].map(([x, z], i) => ({ sub: `s${i + 1}`, x: C1[0] + x, z: C1[1] + z, dead: false }));
    for (const hold of [{ pending: { a: ATTACKS.nova.id } }, { queue: [{ a: ATTACKS.nova.id }] }, { shieldUntil: T0 + 1e9 }]) {
      const f = fightOf(4, 30);
      Object.assign(f, { phase: 2, court: 1, pos: [...C1], xa: [T0 - 60_000], nextAt: T0 + 1e9, pending: null, queue: [], shieldUntil: 0 }, hold);
      f.lg = hostOf({ wardCt: 1 });
      for (let t = T0; t < T0 + GB.SAP_FIRST_MS + 2000; t += 250) assert.equal(waveOf(GB.stepBrain(f, t, bodies, seeded(t)), HOST.sapper), null, JSON.stringify(hold));
      assert.equal(f.lg.sapAt, 0, 'not armed');
    }
  }
  // a non-Legion fight: its quiet beats roll nothing (the host's dice are the trial's alone)
  {
    const f = GB.newFight(7, T0, T0 + 3_600_000, 'ruhn', ['burning', 'echoing', 'vengeful']);
    for (let i = 0; i < 4; i++) GB.joinFight(f, `s${i + 1}`, `P${i + 1}`, 10, T0, true);
    const bodies = [[3, 4], [-5, 2], [10, -8], [-12, 10]].map(([x, z], i) => ({ sub: `s${i + 1}`, x, z, dead: false }));
    let quiet = 0;
    for (let t = T0; t < T0 + 60_000; t += 250) {
      let n = 0;
      const r = seeded(t);
      const out = GB.stepBrain(f, t, bodies, () => { n++; return r(); });
      if (!out.some((o) => ['atk', 'mv', 'cx', 'ph'].includes(o.k))) { quiet++; assert.equal(n, 0, `a quiet beat rolled ${n} at ${t - T0}`); }
    }
    assert.ok(quiet > 100);
  }
  // no more than HARRIERS_MAX standing
  {
    const f = fightOf(9, 30);
    f.nextAt = T0 + 1e9;
    f.lg = hostOf({ harryAt: T0, n: 5, ads: Array.from({ length: 5 }, (_, k) => body({ i: k + 1, h: 45, m: 45, x: C0[0] + 15, z: C0[1] + k })) });
    const bodies = Array.from({ length: 9 }, (_, k) => ({ sub: `s${k + 1}`, x: C0[0] + Math.sin(k) * 6, z: C0[1] + Math.cos(k) * 6, dead: false }));
    const w = waveOf(GB.stepBrain(f, T0, bodies, seeded(3)), HOST.harrier);
    assert.equal(w?.a.length, GB.HARRIERS_MAX - 5, 'the wave capped by those standing');
  }
  // an Imp keeps its mark HOST_RETARGET_MS, then looks again
  {
    const f = fightOf(2, 30);
    f.nextAt = T0 + 1e9; f.pos = [C0[0], C0[1]];
    f.lg = hostOf({ harryAt: T0 + 1e9, ads: [body({ i: 1, h: 45, m: 45, x: C0[0] + 10, z: C0[1], tg: 's1', tgAt: T0 })] });
    const near = { sub: 's1', x: C0[0] + 15, z: C0[1], dead: false }, far = { sub: 's2', x: C0[0] - 20, z: C0[1], dead: false };
    GB.stepBrain(f, T0 + 250, [near, far], seeded(1));
    assert.equal(f.lg.ads[0].tg, 's1', 'kept');
    GB.stepBrain(f, T0 + GB.HOST_RETARGET_MS + 250, [near, far], seeded(2));
    assert.equal(f.lg.ads[0].tg, 's2', 'then the farthest');
  }
  // a Sapper drunk never heals him past his whole
  {
    const f = fightOf(4, 30);
    const C1 = COURTS[1];
    Object.assign(f, { phase: 2, court: 1, pos: [...C1], xa: [T0 - 60_000], nextAt: T0 + 1e9, pending: null, queue: [], shieldUntil: 0 });
    f.hp = f.max - 1;
    f.lg = hostOf({ wardCt: 1, sapAt: T0 + 1e9, ads: [body({ i: 1, k: HOST.sapper, h: 50, m: 50, x: C1[0] + 1, z: C1[1] })] });
    const bodies = [{ sub: 's1', x: C1[0] + 10, z: C1[1] + 10, dead: false }];
    GB.stepBrain(f, T0, bodies, seeded(1));
    assert.equal(f.lg.fed, 1, 'drunk');
    assert.equal(f.hp, f.max, 'to his whole, never past it');
  }
  // a Ward-Bearer Pulses every BEARER_PULSE_MS while a challenger stands near
  {
    const f = fightOf(1, 30);
    const C1 = COURTS[1];
    Object.assign(f, { phase: 2, court: 1, pos: [...C1], xa: [T0 - 60_000], nextAt: T0 + 1e9, pending: null, queue: [], shieldUntil: T0 + 1e9 });
    f.lg = hostOf({ wardCt: 1, ads: [body({ i: 1, k: HOST.bearer, h: 200, m: 200, x: C1[0] + 9, z: C1[1], next: T0 })] });
    const bodies = [{ sub: 's1', x: C1[0] + 11, z: C1[1], dead: false }];
    const at = [];
    for (let t = T0; t < T0 + 2 * GB.BEARER_PULSE_MS + 500; t += 250) for (const o of GB.stepBrain(f, t, bodies, seeded(t))) if (o.k === 'aatk') at.push(t - T0);
    assert.deepEqual(at, [0, GB.BEARER_PULSE_MS, 2 * GB.BEARER_PULSE_MS]);
  }
  // `ah` at most every HP_SEND_MS
  {
    const f = fightOf(1, 30);
    f.nextAt = T0 + 1e9;
    f.lg = hostOf({ harryAt: T0 + 1e9, ads: [body({ i: 1, h: 500, m: 500, x: C0[0] + 2, z: C0[1] + 5 })] });
    const bodies = [{ sub: 's1', x: C0[0] + 3, z: C0[1] + 4, dead: false }];
    GB.applyHostHit(f, 's1', 1, 5, HIT_KINDS.Spell, pose, T0, 1);
    assert.ok(GB.stepBrain(f, T0, bodies, seeded(1)).some((o) => o.k === 'ah'), 'said');
    GB.applyHostHit(f, 's1', 1, 5, HIT_KINDS.Spell, pose, T0 + 50, 2);
    assert.ok(!GB.stepBrain(f, T0 + GB.HP_SEND_MS - 50, bodies, seeded(2)).some((o) => o.k === 'ah'), 'not again inside HP_SEND_MS');
    assert.ok(GB.stepBrain(f, T0 + GB.HP_SEND_MS, bodies, seeded(3)).some((o) => o.k === 'ah'), 'then');
  }
});

test('AUDIT WB11 D7 the court\'s words of his host the slice\'s pins never read: the Ward-Bearers\' rising said once, their crumbling once (a court not under the Wrath), and the bar\'s foot counting the rest of his host (mutants: either line dropped; the foot\'s count)', () => {
  clean();
  const h = rig();
  const bearers = [ad({ i: 1, k: HOST.bearer, x: 9, z: 0, rose: 9_900 }), ad({ i: 2, k: HOST.bearer, x: -9, z: 0, rose: 9_900 })];
  h.link.st = stOf({ phase: 2, shieldUntil: 99_000, lg: { ads: bearers, gone: [] } }); h.clock.t = 10_000; h.c.frame();
  h.clock.t = 10_100; h.c.frame();
  assert.equal(h.said.filter((t) => t === GH.COURT_HOST_TEXT.bearers()).length, 1, 'their rising, once');
  const gone = bearers.map((b) => ({ i: b.i, k: HOST.bearer, x: b.x, z: b.z, w: GB.HOST_GONE.crumbled, n: null, at: 10_200 }));
  h.link.st = stOf({ phase: 2, shieldUntil: 10_200, lg: { ads: [], gone } }); h.clock.t = 10_300; h.c.frame();
  h.clock.t = 10_400; h.c.frame();
  assert.equal(h.said.filter((t) => t === GH.COURT_HOST_TEXT.crumbled).length, 1, 'their crumbling, once');
  h.c.leave(); clean();
  const s = stOf({ lg: { ads: [ad({ i: 1 }), ad({ i: 2, x: 3 })], gone: [] } });
  const bar = bossBarModel(s, 10_000, { name: 'Valkynaz Ruhn', title: 'Warden' });
  assert.equal(bar.host, 'His host: 2', 'the foot counts his host');
});

// ═══ K: WHAT THE KILL RUN FOUND ════════════════════════════════════════════════════════════════════════════════════

test('AUDIT WB11 K1 (the kill run; main\'s since WB9b) a blow on him from his new court before the walkway into it is laid is refused - he lands there 2.4 s after the bound\'s word, the walkway is whole only at 5 s, and nobody can stand in the court between: the floor\'s check is the only one that turns it (`inCourt` passes), and no pin held it (mutant WB3-a-blow-from-off-the-court, its slack widened, survived)', () => {
  const f = fightOf(1, 30, null);
  f.phase = 2; f.court = 1; f.pos = [...COURTS[1]]; f.xa = [T0]; f.shieldUntil = 0;
  const now = T0 + ATTACKS.cross.windup + 200;
  const C1 = COURTS[1], C0 = COURTS[0], L = dist(C0[0], C0[1], C1[0], C1[1]);
  const pose = { x: C1[0] + ((C0[0] - C1[0]) / L) * 10, z: C1[1] + ((C0[1] - C1[1]) / L) * 10 };
  assert.ok(GB.inCourt(pose.x, pose.z, 1, GB.POSE_SLACK) && !GB.onFloor(pose.x, pose.z, f.xa, now, GB.POSE_SLACK), 'the premise: in his court, on no laid floor yet');
  assert.equal(GB.applyHit(f, 's1', 50, HIT_KINDS.Spell, pose, now, 1), 0, 'refused');
  assert.ok(GB.applyHit(f, 's1', 50, HIT_KINDS.Spell, pose, T0 + GB.WALK_LEAD_MS + GB.WALK_FORM_MS + 10, 2) > 0, 'once it is laid, a blow from there lands');
});
