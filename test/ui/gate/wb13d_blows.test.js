// WB13d (2026-10-01, Mac: "just overall bring more AAA grade polish to what is already developed"): THE BLOWS - his
// body and his host's flash when struck (whole for mine, lightly for the court's), a blow into his ward says Warded, his
// elemental blows shake the camera as his physical ones do and his landings shake it by how near they fall, each landing
// lights the floor where it lands, a release sound before each landing with his wind-ups spread apart, his fire cast and
// not swung, and the meteor seen falling longer and lower (bible/11-Multiplayer/World-Bosses.md section 20, WB13d).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATTACKS, HIT_KINDS, HOST, profileOf } from '../../../src/net/gate/gateBrain.js';
import { GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import {
  bossAct, bossGlow, bossCue, BOSS_CUES, GLOW_UP, GLOW_RANGE, CAST_RAISE_FRAME, CAST_LOOSE_FRAME, GATE_FLASH_COURT, GATE_FLASH_SHARE, gateHitFlash,
  LANDING_LIGHT_Y, LAND_SHAKE, landShake, RELEASE_LEAD_MS, ASPECT_CUE_IDS, FIRE_CAST_ID, BODY_FALL, SWING_LOW, emberColor, attackColor,
} from '../../../src/world/gate/gateBoss.js';
import { courtToDungeon } from '../../../src/world/gate/gateArena.js';
import { createGateCourt } from '../../../src/scenes/gate/gateCourt.js';
import { meteorFall, FX_KINDS, FX_LIGHT_MS, METEOR_FALL_MS, METEOR_ELEV_DEG, METEOR_FROM_M } from '../../../src/render/gate/gateFx.js';
import { HIT_FLASH_PEAK, HIT_FLASH_S } from '../../../src/systems/hitFlash.js';
import { numberFor } from '../../../src/ui/hitNumbers.js';
import { shakePlayerDamage, flashPlayerDamage, setRemoveHealthListener, playerDamageFlash } from '../../../src/ui/damageFlash.js';
import { destroyGateBossBar } from '../../../src/ui/gate/gateBossBar.js';
import { destroyGateMarksCard } from '../../../src/ui/gate/gateMarksView.js';
import { destroyGateGround } from '../../../src/ui/gate/gateGroundView.js';
import { ENEMY_BASICS, ENEMY_NAMES } from '../../../src/characters/enemy/enemyBasics.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const W = (key, over = {}) => ({ i: 1, a: ATTACKS[key].id, at: 10000, x: 0, z: 0, yw: 0, tg: [], ...over });
const state = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 900, max: 1000, fighters: 3, wrathAt: 10_000_000, ...over });

/** A court driven by hand (test/net/gate/wb4_gate_boss.test.js's): a link the test writes, a clock, feet, a renderer and a
 *  sprite - and the camera's shakes, heard. */
function court({ feet = [0, 0, 0] } = {}) {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const sounds = [], batches = [], shakes = [];
  const tex = { archive: 286, getFrameCount: () => 5, getSize: () => ({ width: 40, height: 60 }), getScale: () => ({ width: 0, height: 0 }) };
  const renderer = {
    textures: new Set(),
    createBillboardBatch: (archive, record, size) => { const b = { archive, record, size, bounds: new Float32Array([0, 0, 0, 1]) }; batches.push(b); return b; },
    destroyBillboardBatch: () => {},
  };
  const c = createGateCourt({
    renderer, gl: null, audio: { play3d: (clip, p, v, o) => sounds.push(['clip', clip, o.pitch]), play3dId: (id, p, v, o) => sounds.push(['id', id, o.pitch]) },
    getTexture: async () => tex, uploadRecordFrame: () => {},
    link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20), feet: () => courtToDungeon(feet[0], 0, feet[2]), player: () => ({ health: 100, maxHealth: 100 }),
    shake: (k) => shakes.push(k),
  });
  return { c, link, clock, sounds, batches, shakes };
}
const tick = async (h, t, st) => { if (st) h.link.st = st; h.clock.t = t; h.c.frame(); await new Promise((r) => setImmediate(r)); };
const clean = () => { destroyGateBossBar(); destroyGateMarksCard(); destroyGateGround(); };

test('WB13d his body struck flashes on the game\'s own curve - whole for my blow, GATE_FLASH_COURT of a flash for the court\'s (a fall in his health of GATE_FLASH_SHARE of his whole or more, counted from the last), none over his fall (mutants: no flash; the court\'s whole; a sliver flashing; a flash on his falling body)', async () => {
  clean();
  assert.equal(gateHitFlash(5000, -Infinity, 5000), HIT_FLASH_PEAK);
  assert.equal(gateHitFlash(-Infinity, 5000, 5000), GATE_FLASH_COURT * HIT_FLASH_PEAK);
  assert.equal(gateHitFlash(5000, 5000, 5000), HIT_FLASH_PEAK, 'mine over the court\'s');
  assert.equal(gateHitFlash(5000, 5000, 5000 + HIT_FLASH_S * 1000), 0, 'gone with the curve');
  const h = court();
  await tick(h, 1000, state());
  await tick(h, 1016);
  const body = h.batches[0];
  assert.ok(body, 'his body drawn');
  assert.equal(body.hitFlash || 0, 0);
  assert.equal(h.c.hit({ d: 30, r: HIT_KINDS.Melee }), false, 'nothing sent here - the blow is still mine');
  await tick(h, 1016);
  assert.equal(body.hitFlash, HIT_FLASH_PEAK, 'my blow: the whole flash');
  await tick(h, 1016 + HIT_FLASH_S * 1000);
  assert.equal(body.hitFlash, 0);
  // the court's: a sliver of his health is nothing; the sliver after it makes a share, and flashes him lightly
  const sliver = Math.ceil(1000 * GATE_FLASH_SHARE * 0.6);
  await tick(h, 2000, state({ hp: 900 - sliver }));
  assert.equal(body.hitFlash, 0, 'under a share');
  await tick(h, 2250, state({ hp: 900 - 2 * sliver }));
  assert.equal(body.hitFlash, GATE_FLASH_COURT * HIT_FLASH_PEAK, 'the court\'s blows, counted from the last');
  await tick(h, 2500, state({ hp: 950 }));
  await tick(h, 2600, state({ hp: 950 - 2 * sliver }));
  assert.equal(body.hitFlash, GATE_FLASH_COURT * HIT_FLASH_PEAK, 'a heal starts the count again where he stands');
  await tick(h, 2610, state({ hp: 0, fell: { at: 2610, top: [], n: 3 } }));
  assert.equal(body.hitFlash, 0, 'his fall is its own');
  h.c.leave();
});

test('WB13d his host struck flashes too - whole for my blow on one, lightly for any fall in its health the relay says (mutants: the host never flashing)', async () => {
  clean();
  const h = court({ feet: [0, 0, 4] });
  const imp = (hp) => ({ i: 1, k: HOST.harrier, h: hp, m: 45, x: 0, z: 6, mv: null, atk: null, rose: -Infinity, yaw: 0 });
  const st = (hp) => state({ md: ['burning', 'unyielding', 'legion'], lg: { ads: [imp(hp)], gone: [] } });
  await tick(h, 1000, st(45));
  await tick(h, 1016);
  const body = h.batches.find((b) => b.archive === ENEMY_BASICS[1].maleTexture);
  assert.ok(body, 'the Imp drawn');
  assert.equal(h.c.hostHit({ i: 1, d: 12, r: HIT_KINDS.Melee }), false);
  await tick(h, 1016);
  assert.equal(body.hitFlash, HIT_FLASH_PEAK, 'my blow on it');
  await tick(h, 2000, st(44));
  assert.equal(body.hitFlash, GATE_FLASH_COURT * HIT_FLASH_PEAK, 'the court\'s');
  h.c.leave();
});

test('WB13d a blow into his ward says Warded - never a number, the relay refuses it - in the ward\'s gold; his stand-in carries the ward (mutants: the number shown; the word on any blow)', () => {
  assert.deepEqual(numberFor({ hit: true, damage: 14, target: { warded: true } }), { kind: 'warded', text: 'Warded', tag: null });
  assert.deepEqual(numberFor({ hit: true, damage: 14, target: { warded: false } }), { kind: 'hit', text: '14', tag: null });
  assert.deepEqual(numberFor({ hit: false, target: { warded: true } }), { kind: 'miss', text: 'Miss', tag: null }, 'a miss is a miss');
  assert.match(read('src/ui/enhanced/enhancedStyle.js'), /\.hitnum-warded \{ font-size: calc\(20px \* var\(--hud-scale, 1\)\); font-weight: 600; color: #ffdf8e; \}/);
  assert.match(read('src/scenes/dungeonContext.js'), /b\.entity\.warded = !!b\.warded;/);
});

test('WB13d his elemental blows shake the camera as his physical ones do - the DamageShaker hears the amount - and still never flash (DFU\'s spell damage does not) (mutants: no shake; a flash for his frost)', () => {
  const heard = [];
  setRemoveHealthListener((n) => heard.push(n));
  try {
    playerDamageFlash.takeBlow();
    shakePlayerDamage(23);
    assert.deepEqual(heard, [23]);
    assert.equal(playerDamageFlash.takeBlow(), false, 'no flash');
    flashPlayerDamage(7);
    assert.deepEqual(heard, [23, 7]);
    assert.equal(playerDamageFlash.takeBlow(), true, 'a physical blow: both');
  } finally { setRemoveHealthListener(null); }
  assert.match(read('src/scenes/dungeonContext.js'), /if \(!el\) flashPlayerDamage\(dmg\);\n\s*else shakePlayerDamage\(dmg\);/);
});

test('WB13d a landing felt: the camera shaken by how near it fell to my feet (LAND_SHAKE: its weight at nought metres, nothing at its reach) - his own where he stands, the meteor\'s at its mark; the Wrath and the Reckoning wherever I stand; nothing for one with no weight (mutants: the shake for every landing; the distance ignored)', async () => {
  clean();
  assert.equal(landShake(ATTACKS.slam, 0), LAND_SHAKE.slam[0]);
  assert.equal(landShake(ATTACKS.slam, 6), LAND_SHAKE.slam[0] / 2);
  assert.equal(landShake(ATTACKS.slam, LAND_SHAKE.slam[1] + 1), 0);
  assert.equal(landShake(ATTACKS.wrath, 400), LAND_SHAKE.wrath[0], 'the whole arena');
  assert.equal(landShake(ATTACKS.cleave, 0), 0, 'a blade\'s landing is the blow\'s alone');
  const h = court({ feet: [0, 0, 6] });
  await tick(h, 9000, state({ atk: W('slam') }));
  await tick(h, 10000);
  assert.deepEqual(h.shakes, [LAND_SHAKE.slam[0] / 2], 'six metres from his slam');
  await tick(h, 10100);
  assert.equal(h.shakes.length, 1, 'once');
  await tick(h, 19000, state({ phase: 2, atk: W('meteor', { i: 2, at: 20000, tg: [[0, 1]] }) }));
  await tick(h, 20000);
  assert.ok(Math.abs(h.shakes[1] - LAND_SHAKE.meteor[0] * (1 - 5 / LAND_SHAKE.meteor[1])) < 1e-9, 'five metres from where the meteor fell');
  const far = court({ feet: [0, 0, 20] });
  await tick(far, 9000, state({ atk: W('slam') }));
  await tick(far, 10000);
  assert.deepEqual(far.shakes, [], 'out of its reach: nothing');
  await tick(far, 29000, state({ phase: 3, atk: W('wrath', { i: 3, at: 30000 }) }));
  await tick(far, 30000);
  assert.deepEqual(far.shakes, [LAND_SHAKE.wrath[0]], 'the Wrath wherever I stand');
  assert.match(read('src/scenes/world.js'), /shake: \(amount\) => betterAmbience\.weaponKick\(amount\),   \/\/ WB13d/, 'under the player\'s own maxShake');
});

test('WB13d each landing lights the floor where it lands, never his chest: his own at his feet LANDING_LIGHT_Y over the floor; one away from him (the meteor, the hellfire) leaves his ember and lights where it fell for FX_LIGHT_MS, fading (mutants: the flare back on his chest; the meteor\'s light at him; a light that never fades)', async () => {
  clean();
  const slam = state({ atk: W('slam') });
  const g = bossGlow(slam, 10050);
  assert.ok(Math.abs(g.y - courtToDungeon(0, LANDING_LIGHT_Y, 0)[1]) < 1e-9, 'on the floor');
  assert.equal(g.range, GLOW_RANGE.landing);
  assert.ok(Math.abs(bossGlow(slam, 9000).y - courtToDungeon(0, GLOW_UP, 0)[1]) < 1e-9, 'through the wind-up at his chest');
  const met = state({ phase: 2, atk: W('meteor', { tg: [[8, 2]] }) });
  const m = bossGlow(met, 10050);
  assert.equal(m.range, GLOW_RANGE.ember, 'his ember while it lands away from him');
  assert.deepEqual(m.color, emberColor(profileOf(met)).map((c) => c * 0.45));
  assert.ok(FX_KINDS.meteor.light && FX_KINDS.hellfire.light && !FX_KINDS.slam.light && !FX_KINDS.nova.light, 'the far landings carry their own');
  const h = court({ feet: [0, 0, 20] });
  await tick(h, 9000, met);
  await tick(h, 10000);
  const at = courtToDungeon(8, 0.1, 2);
  const lit = () => h.c.lights().filter((l) => l.range === FX_KINDS.meteor.light[1]);
  h.clock.t = 10000 + FX_LIGHT_MS / 2;
  const [L] = lit();
  assert.ok(L, 'a light where it fell');
  assert.ok(Math.abs(L.x - at[0]) < 1e-9 && Math.abs(L.z - at[2]) < 1e-9 && Math.abs(L.y - (at[1] + LANDING_LIGHT_Y)) < 1e-9);
  const c = attackColor(ATTACKS.meteor, profileOf(met));
  assert.ok(L.color.every((v, k) => Math.abs(v - c[k] * FX_KINDS.meteor.light[0] * 0.5) < 1e-9), 'in its colour, half its light half way');
  h.clock.t = 10000 + FX_LIGHT_MS;
  assert.deepEqual(lit(), [], 'gone');
});

test('WB13d the release: RELEASE_LEAD_MS before each landing, once - his blade\'s swing, his weight gathered, his fire loosed (his aspect\'s cast under an aspect; Dagon\'s his own) (mutants: no release; a release every frame)', async () => {
  clean();
  assert.deepEqual(BOSS_CUES.release.cleave, { clip: SWING_LOW, pitch: 0.45, volume: 1.5, reach: 40, at: 'him' });
  assert.equal(BOSS_CUES.release.slam.clip, BODY_FALL);
  assert.deepEqual([BOSS_CUES.release.nova.id, BOSS_CUES.release.nova.pitch], [FIRE_CAST_ID, 1.1]);
  for (const k of Object.keys(ATTACKS)) assert.ok(BOSS_CUES.release[k], `${k}: every landing has its release`);
  const rime = profileOf(state({ md: ['rime', 'colossal', 'echoing'] }));
  assert.deepEqual([bossCue('release', ATTACKS.nova, rime).id, bossCue('release', ATTACKS.nova, rime).pitch], [ASPECT_CUE_IDS.rime, 1.1], 'his frost loosed');
  assert.equal(bossCue('release', ATTACKS.wrath, rime).id, FIRE_CAST_ID, 'Dagon\'s is Dagon\'s');
  assert.equal(bossCue('release', ATTACKS.slam, rime).clip, BODY_FALL, 'his weight is his own');
  const h = court({ feet: [0, 0, 20] });
  await tick(h, 9000, state({ atk: W('slam') }));
  const before = h.sounds.length;
  await tick(h, 10000 - RELEASE_LEAD_MS - 1);
  assert.equal(h.sounds.length, before, 'not yet');
  await tick(h, 10000 - RELEASE_LEAD_MS);
  assert.deepEqual(h.sounds.slice(before), [['clip', BODY_FALL, 0.5]]);
  await tick(h, 10000 - RELEASE_LEAD_MS / 2);
  assert.equal(h.sounds.length, before + 1, 'once');
});

test('WB13d his wind-ups that share a clip stand at least four semitones apart in his rotation - the Cleave, the Slam and the Leap were one sound - the bound and Dagon\'s own aside, each with its own words (mutants: the Cleave back by the Slam)', () => {
  const st = (p, q) => Math.abs(12 * Math.log2(p / q));
  const groups = new Map();
  for (const [k, c] of Object.entries(BOSS_CUES.windup)) {
    if (k === 'cross' || k === 'wrath' || k === 'reckon') continue;
    const src = c.clip != null ? `clip${c.clip}` : `id${c.id}`;
    if (!groups.has(src)) groups.set(src, []);
    groups.get(src).push([k, c.pitch]);
  }
  const close = [];
  for (const g of groups.values()) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (st(g[i][1], g[j][1]) < 4) close.push(`${g[i][0]} ${g[j][0]}: ${st(g[i][1], g[j][1]).toFixed(2)}`);
  assert.deepEqual(close, []);
  assert.ok([...groups.values()].some((g) => g.length >= 4), 'the bark carries four');
});

test('WB13d his fire is cast, not swung: CAST_RAISE_FRAME held through a fire\'s wind-up, CAST_LOOSE_FRAME as it is loosed - the Daedra Lord\'s own spell frames; his blade and his weight keep the swing (mutants: the cast swung; the swing cast)', () => {
  assert.equal(ENEMY_NAMES[31], 'Daedra Lord', 'his mobile');
  assert.deepEqual([ENEMY_BASICS[31].spellAnimFrames[0], ENEMY_BASICS[31].spellAnimFrames[2]], [CAST_RAISE_FRAME, CAST_LOOSE_FRAME]);
  const nova = state({ phase: 2, atk: W('nova') }), slam = state({ atk: W('slam') });
  assert.deepEqual([bossAct(nova, 8800).frame, bossAct(nova, 9900).frame, bossAct(nova, 10020).frame], [CAST_RAISE_FRAME, CAST_RAISE_FRAME, CAST_LOOSE_FRAME]);
  assert.deepEqual([bossAct(nova, 8800).act, bossAct(nova, 10020).act], ['windup', 'strike']);
  assert.deepEqual([bossAct(slam, 8500).frame, bossAct(slam, 9900).frame, bossAct(slam, 10020).frame], [0, 1, 2], 'his weight swings');
});

test('WB13d the meteor seen falling: METEOR_FALL_MS long, METEOR_ELEV_DEG over the horizon - in the frame of one looking at him, never a dot overhead (mutants: the old 63 degrees; the old 1100 ms)', () => {
  assert.equal(METEOR_FALL_MS, 1700);
  assert.equal(METEOR_ELEV_DEG, 35);
  const atk = W('meteor', { tg: [[0, 0]] });
  const top = meteorFall(atk, atk.at - METEOR_FALL_MS);
  assert.ok(Math.abs(top.at[1] - METEOR_FROM_M * Math.sin((35 * Math.PI) / 180)) < 1e-9, 'its height at the start');
  assert.ok(Math.abs(Math.atan2(top.at[1], Math.hypot(top.at[0], top.at[2])) - (35 * Math.PI) / 180) < 1e-9);
});
