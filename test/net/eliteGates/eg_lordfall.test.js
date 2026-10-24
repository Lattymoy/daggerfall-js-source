// EG-FALL (2026-10-21, the owner: "I notice in the Elite Breaches, when the boss dies it freezes in place. Oblivion gates do the
// boss death the best way"; bible/11-Multiplayer/Elite-Gates.md section 16.2 and EG-FALL): A LORD'S FALL IS THE GATE'S
// (scenes/eliteGates/egLordFall.js - fourteen of these through scenes/eliteGates/egFight.js's own draw path over a recording renderer,
// the rest the module's own law and its pass over a recording WebGL; Daggerfall's own pictures where ARENA2 stands, the last
// test). A felled lord held its fourth hurt frame, standing, for the hall's life; it now falls as the Warden does - its hurt
// picture to the floor by the thud, sunk into the stone, its corpse left where it fell - with the gate's beats: the death cry,
// the burst and the white flash and the shake at the kill, the thud and the column of embers, its ember's glow dying; each once
// a fall and only while news, on the gate's numbers, its sink, its corpse and its beats' height grown by the lord's drawn size.
// AUDIT EG-FALL (bible/01-Overview/audits/Audit-EG-FALL.md): the pins the audit's lanes found missing are the last ten here;
// the relay's own words, eg_lordfall_relay.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { TextureFile } from '../../../src/formats/textureFile.js';
import { createEgFight, egBodyAct, egLookOf, EG_LORD_HOVER_M } from '../../../src/scenes/eliteGates/egFight.js';
import {
  createEgLordFall, egLordFallAct, egLordEmber, egLordEl, egFallCry, egFallSinkM, egFallTallM, egCorpseScale, EG_FALL_PER, egFallAloft,
} from '../../../src/scenes/eliteGates/egLordFall.js';
import { FALL_MS, THUD_AT_MS, FALL_SINK_M, CORPSE_SCALE, BOSS_CUES, ASPECT_COLORS, EMBER_COLOR, GLOW_RANGE, GLOW_UP_SHARE, FALL_GLOW_K } from '../../../src/world/gate/gateBoss.js';
import { BOSS_H } from '../../../src/net/gate/gateBrain.js';
import { FALL_FLASH_MS, FALL_SHAKE, COLUMN_BURSTS, COLUMN_STEP_MS, FALL_CRY_LATE_MS, WHITE, FALL_NEWS_MS, FALL_BURST_UP, FALL_FLASH_Y, FALL_FLASH_K, FALL_FLASH_RANGE } from '../../../src/scenes/gate/gateCourt.js';
import { stateAnims } from '../../../src/characters/mobile/mobileUnit.js';
import { egLightsWith } from '../../../src/world/eliteGates/egHall.js';
import { getPref } from '../../../src/systems/uiPrefs.js';
import { FX_KINDS, FX_SPARKS, FX_SPARK_VS, GateFxRenderer } from '../../../src/render/gate/gateFx.js';
import { egHallOf } from '../../../src/net/eliteGates/egLaw.js';
import { EG_BOSS_KEYS } from '../../../src/net/eliteGates/egLords.js';
import { EG_ROLE, EG_FL } from '../../../src/net/eliteGates/egBodies.js';
import { egBodyOf, egBodyPlace, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { egHallCentre } from '../../../src/world/eliteGates/egHall.js';
import { GLOBAL_SCALE } from '../../../src/world/meshReader.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { EG_ACCESS_PREFS } from '../../../src/ui/eliteGates/egAccess.js';

const T0 = 1_800_000_000_000;
const FELL = T0 + 60_000;
const SEED = 12345;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const tick = () => new Promise((r) => setTimeout(r, 0));
/** A lord's row as the wire says it (egLink.js egBodyOf's `[i, role, k, pt, x, z, hp, max, fl, tx, tz, v, at, y, ty, st, sa, sz, yw]`) -
 *  fallen at `fell` (EG_FL.fell, its fall's instant in `sa`), else standing; walking to (tx, tz) at `v` from `at`. */
const lordRow = (i, key, { pt = 0, x = 0, z = 30, y = 0, fl = 0, fell = 0, tx = x, tz = z, v = 0, at = 0 } = {}) =>
  egBodyOf([i, EG_ROLE.lord, EG_BOSS_KEYS.indexOf(key), pt, x, z, fell ? 0 : 900, 1000, fell ? fl | EG_FL.fell : fl, tx, tz, v, at, y, y, 2, fell, 0, Math.PI], T0);
/** The body's pictures 40 by 80 texels, one frame a record as Daggerfall's hurt records hold (AUDIT EG-FALL L1-5, L2-8: TEXTURE.270
 *  and 280-291's records 10-14); a corpse's (its own archive) 64 by 24. */
const CORPSE_TEXELS = Object.freeze({ width: 64, height: 24 });
const corpseArchives = new Set(Object.values(ENEMY_BASICS).map((E) => E?.corpseTexture?.archive).filter((a) => a != null));
/** A recording WebGL (test/net/gate/wb9e_gate_blows.test.js's): every call, a program that links, a location its name. */
function recordingGl() {
  const calls = [];
  const gl = new Proxy({ BLEND: 9, ONE: 10, CULL_FACE: 11, POINTS: 0, TRIANGLES: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7 }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; if (k === 'getExtension') return null; return {}; }) });
  return { gl, calls };
}

/** egFight over a recording renderer, audio and shake: every batch made and freed, every sound, every shake. */
function screen(state, clock, extra = {}, { frames = 1 } = {}) {
  const batches = [], freed = [], sounds = [], shakes = [], uploads = [];
  const renderer = {
    textures: new Set(),
    createBillboardBatch: (archive, record, size, centres) => { const b = { archive, record, size: { ...size }, centres, origin: null, bounds: [0, 0, 0, Math.hypot(size.w, size.h) / 2], noShadow: undefined }; batches.push(b); return b; },
    destroyBillboardBatch: (b) => freed.push(b),
  };
  const getTexture = async (archive) => ({ archive, getSize: () => (corpseArchives.has(archive) && !Object.values(ENEMY_BASICS).some((E) => E?.maleTexture === archive) ? CORPSE_TEXELS : { width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => frames });
  const audio = { play3d: (clip, at, volume, o) => sounds.push({ clip, at, volume, pitch: o?.pitch, reach: o?.maxDistance }), play3dId: (id, at, volume, o) => sounds.push({ id, at, volume, pitch: o?.pitch }), playOneShot: () => {} };
  const fight = createEgFight({ renderer, getTexture, uploadRecordFrame: (...a) => uploads.push(a), audio, link: { state }, now: () => clock.t, feet: () => null, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0',
    shake: (k) => shakes.push(k), ...extra });
  return { fight, batches, freed, sounds, shakes, uploads, renderer };
}
/** A trial at Hall `h` of SEED with `bodies` on its fight. */
function hallWith(h, bodies) {
  const spec = egHallOf(SEED, h, 0);
  return { spec, E: { ...EG_STATE_EMPTY, b: '0123456789abcdef', h, sg: 'trial', seed: SEED, geo: 0, end: null, hw: T0 - 5000, co: [['acct-0', 'Mac', 1]], fight: { ...EG_STATE_EMPTY.fight, h, wk: T0, bodies, pg: {} } } };
}
/** The batch drawn this frame at (x, z) over the hall's centre - the body's own archive, or the corpse's. */
/** AUDIT EG-FALL (L2-8): the records mobile `m`'s hurt table draws (characters/mobile/mobileUnit.js stateAnims), as `record#0` keys. */
const hurtKeys = (m, winged = false) => new Set(stateAnims('hurt', m, !!ENEMY_BASICS[m]?.hasIdle, false, false, true, false, winged).map((a) => `${a.record}#0`));
const drawnAt = (fight, centre, x, z, archive) => fight.batches().find((q) => q.archive === archive && near(q.origin[0], centre[0] + x, 1e-6) && near(q.origin[2], centre[2] + z, 1e-6));

test('EG-FALL THE BODY (scenes/eliteGates/egLordFall.js egLordFallAct - world/gate/gateBoss.js bossAct\'s fall): a fallen lord plays its hurt frames to the floor by THUD_AT_MS (five, the last held), sinks FALL_SINK_M grown by its drawn size over the Warden\'s 3 into the stone over the rest of FALL_MS, and is gone past it; a flyer drops out of its hover by the thud; egBodyAct says it so - never its fourth hurt frame held, standing, for the hall\'s life (mutants: the old act; the sink from the end; the sink ungrown; never gone; four frames; the flyer never dropping)', () => {
  assert.deepEqual([FALL_MS, THUD_AT_MS, FALL_SINK_M, CORPSE_SCALE, BOSS_H], [2400, 1500, 1.5, 3, 5.6], 'the gate\'s own numbers');
  assert.deepEqual([FALL_NEWS_MS, FALL_BURST_UP, FALL_FLASH_Y, FALL_FLASH_K, FALL_FLASH_RANGE, GLOW_UP_SHARE, FALL_GLOW_K], [1000, 0.5, 3, 4, 40, 0.55, 2.2], 'AUDIT EG-FALL (L2-9): the gate\'s fall numbers its court wrote in line, named once and read by the breach');
  const A = 'hurt', at = (since, drawn = 4.8) => egLordFallAct(since, A, drawn);
  assert.deepEqual([0, 299, 300, 600, 900, 1200, 1499, 1500, 2000].map((s) => at(s).frame), [0, 0, 1, 2, 3, 4, 4, 4, 4], 'its hurt frames to the floor');
  assert.deepEqual([0, 750, 1500, 2000].map((s) => at(s).aloft), [1, 0.75, 0, 0], 'a flyer\'s hover under it, gone by the thud');
  assert.equal(at(1500).sink, 0, 'on the floor at the thud');
  assert.ok(near(at(1950).sink, 2.4 * 0.5), `half sunk midway (${at(1950).sink})`);
  assert.ok(near(at(2399).sink, 2.4 * (899 / 900)), 'all but sunk at the end');
  assert.ok(near(egLordFallAct(1950, A, 3).sink, 0.75), 'the Warden\'s own 1.5 m at his own size');
  assert.deepEqual(at(2400), { act: 'gone', anims: A, frame: 0, loop: false, sink: 0, aloft: 0 }, 'gone once its fall is spent');
  assert.equal(at(1000).act, 'fall');
  assert.deepEqual([EG_FALL_PER(4.8), egFallSinkM(4.8), egFallTallM(4.8), egCorpseScale(4.8)].map((v) => Math.round(v * 1e9) / 1e9), [1.6, 2.4, 8.96, 4.8], 'grown as the lord is drawn');
  // the body as the fight sees it - its look's drawn size, its own hurt table
  const b = lordRow(1, 'hound', { fell: FELL }), look = egLookOf(b, 0);
  assert.equal(egBodyAct(b, FELL - 1, look.mobile, null, 0, look.drawn).act, 'idle', 'standing until its fall\'s moment');
  assert.deepEqual([egBodyAct(b, FELL + 900, look.mobile, null, 0, look.drawn).act, egBodyAct(b, FELL + 900, look.mobile, null, 0, look.drawn).frame], ['fall', 3]);
  assert.ok(near(egBodyAct(b, FELL + 1950, look.mobile, null, 0, look.drawn).sink, 2.4 * 0.5), 'sinking at its drawn size');
  assert.equal(egBodyAct(b, FELL + 60_000, look.mobile, null, 0, look.drawn).act, 'gone', 'never standing frozen a minute on');
});

test('EG-FALL ITS EMBER AND ITS CRY: a lord falls in the gate\'s ember under its element\'s aspect (fire the Burning\'s own, frost the Rime\'s, shock the Storm\'s, poison the Venom\'s), a Twin by its clan (Vael fire, Isk frost), a lord with none and a champion in its band\'s; its death cry the gate\'s `fall` cue in its own voice (mutants: one Twin\'s ember for both; the cry in the Warden\'s voice)', () => {
  assert.deepEqual(['hound', 'spellmaster', 'cairnkeeper', 'dusk', 'armsmaster', 'kynreeve'].map((k) => egLordEl(k)), ['fire', 'shock', 'poison', 'frost', null, null]);
  assert.deepEqual([egLordEl('twins', 0), egLordEl('twins', 1)], ['fire', 'frost']);
  assert.deepEqual(egLordEmber('hound', 0, 2), EMBER_COLOR, 'fire: the Burning\'s ember, whatever its band');
  assert.deepEqual(egLordEmber('twins', 1, 1), ASPECT_COLORS.rime.ember, 'Isk: the Rime\'s');
  assert.deepEqual(egLordEmber('twins', 0, 1), EMBER_COLOR, 'Vael: the Burning\'s');
  assert.deepEqual(egLordEmber('spellmaster', 0, 0), ASPECT_COLORS.storm.ember);
  assert.deepEqual(egLordEmber('cairnkeeper', 0, 1), ASPECT_COLORS.venom.ember);
  assert.deepEqual(egLordEmber('stalker', 0, 2), ASPECT_COLORS.rime.ember, 'no element: the Shade\'s rime');
  assert.deepEqual(egLordEmber('armsmaster', 0, 0), EMBER_COLOR, 'no element: the Galleries\' burning');
  assert.deepEqual(egLordEmber('kynreeve', 0, 1), ASPECT_COLORS.venom.ember, 'a champion: its band\'s');
  const cry = egFallCry(27);
  assert.deepEqual(cry, { ...BOSS_CUES.fall, clip: ENEMY_BASICS[27].barkSound }, 'Grath\'s own bark at the gate\'s pitch, loudness and reach');
  assert.notEqual(cry.clip, BOSS_CUES.fall.clip, 'not the Warden\'s voice');
  assert.deepEqual(egFallCry(31), BOSS_CUES.fall, 'a Daedra Lord\'s is the gate\'s own');
});

test('EG-FALL THE FALL DRAWN (scenes/eliteGates/egFight.js drawBody over a recording renderer): at the kill its death cry in its own voice, the camera shaken FALL_SHAKE, a burst of Dagon\'s size out of its chest resting on the floor, the hall\'s light white for FALL_FLASH_MS and its ember\'s glow; its hurt frames where it FELL (never on along the walk said before it); at THUD_AT_MS the thud once and the column of embers, COLUMN_BURSTS of them COLUMN_STEP_MS apart; sunk into the stone; then its mobile\'s corpse at its feet, grown as it is, casting no giant\'s shadow - and no body my blows meet at any moment of it, and nothing played again a minute on (mutants: the place carried on; the cry while not news; the thud while not news; one ember of the column; no flash; no glow; no corpse; the corpse ungrown)', async () => {
  const b = lordRow(1, 'hound', { fell: FELL, x: 2, z: 30, tx: 12, tz: 30, v: 4, at: FELL - 1000 });
  const { spec, E } = hallWith(5, [b]), centre = egHallCentre(spec), look = egLookOf(b, spec.band);
  const clock = { t: FELL - 40 };
  const S = screen(() => E, clock);
  S.fight.frame(); await tick(); S.fight.frame();
  assert.equal(S.sounds.length, 0, 'nothing before its fall');
  const [fx, fz] = egBodyPlace(b, FELL), feetY = centre[1] + (b.y ?? 0), archive = ENEMY_BASICS[look.mobile].maleTexture;
  assert.ok(!near(egBodyPlace(b, FELL + 1000)[0], fx), 'its walk would carry it on');
  const ember = egLordEmber('hound', 0, spec.band), tall = egFallTallM(look.drawn);
  // THE KILL
  clock.t = FELL;
  S.fight.frame();
  const body = () => drawnAt(S.fight, centre, fx, fz, archive);
  assert.ok(body(), 'its body drawn where it fell');
  assert.ok(hurtKeys(look.mobile).has(body().record), `its hurt picture (${body().record})`);
  assert.equal(S.fight.hostTargets().length, 0, 'no body my blows meet');
  assert.deepEqual(S.sounds.map((s) => [s.clip, s.pitch, s.volume, s.reach]), [[ENEMY_BASICS[27].barkSound, BOSS_CUES.fall.pitch, BOSS_CUES.fall.volume, BOSS_CUES.fall.reach]], 'its death cry, once');
  assert.ok(near(S.sounds[0].at[1], feetY + tall * 0.5, 1e-9) && near(S.sounds[0].at[0], centre[0] + fx, 1e-9), 'from its chest');
  assert.deepEqual(S.shakes, [FALL_SHAKE], 'the camera shaken');
  const B = S.fight.fall().bursts(clock.t + 100);
  assert.equal(B.length, 1);
  assert.equal(B[0].kind, FX_KINDS.dagon, 'Dagon\'s own size'); assert.deepEqual(B[0].color, ember);
  assert.ok(near(B[0].at[1], feetY + tall * 0.5, 1e-9) && near(B[0].floor, feetY, 1e-9), 'out of its chest, resting on the floor');
  const L = S.fight.lights();
  const flash = L.find((l) => near(l.color[0], WHITE[0] * 4, 1e-9) && near(l.color[2], WHITE[2] * 4, 1e-9));
  assert.ok(flash && flash.range === 40 && near(flash.y, feetY + 3, 1e-9) && flash.carried === true, 'the hall\'s light white, casting no shadow');
  const glow = L.find((l) => l !== flash);
  assert.ok(glow && glow.range === GLOW_RANGE.landing && near(glow.color[0], ember[0] * 2.2, 1e-9) && near(glow.y, feetY + tall * 0.55, 1e-9), 'its ember\'s glow at its chest');
  // falling
  clock.t = FELL + FALL_FLASH_MS - 1; S.fight.frame();
  assert.equal(S.fight.lights().length, 2, 'the flash stands FALL_FLASH_MS');
  clock.t = FELL + FALL_FLASH_MS; S.fight.frame();
  const L2 = S.fight.lights();
  assert.equal(L2.length, 1, 'the flash gone past FALL_FLASH_MS, the glow dying');
  assert.ok(near(L2[0].color[0], ember[0] * 2.2 * (1 - FALL_FLASH_MS / FALL_MS), 1e-9));
  clock.t = FELL + 900; S.fight.frame();
  assert.ok(body(), 'where it fell, never along its walk');
  assert.ok(hurtKeys(look.mobile).has(body().record) && near(body().origin[1], feetY), 'its hurt picture, on its feet');
  assert.equal(S.sounds.length, 1, 'no thud before its body meets the floor');
  // THE THUD and the column
  clock.t = FELL + THUD_AT_MS; S.fight.frame();
  assert.deepEqual(S.sounds.slice(1).map((s) => [s.clip, s.pitch, s.volume, s.reach]), [[BOSS_CUES.thud.clip, BOSS_CUES.thud.pitch, BOSS_CUES.thud.volume, BOSS_CUES.thud.reach]], 'its thud');
  for (let k = 1; k < COLUMN_BURSTS; k++) { clock.t = FELL + THUD_AT_MS + k * COLUMN_STEP_MS; S.fight.frame(); }
  assert.equal(S.sounds.length, 2, 'the thud once');
  const col = S.fight.fall().bursts(FELL + THUD_AT_MS + (COLUMN_BURSTS - 1) * COLUMN_STEP_MS + 10).filter((q) => q.kind === FX_KINDS.embers);
  assert.equal(col.length, COLUMN_BURSTS, 'the column of embers');
  assert.deepEqual(col.map((q) => q.at0 - FELL), [1500, 1750, 2000]);
  assert.ok(col.every((q) => near(q.at[1], feetY + 0.1, 1e-9) && near(q.floor, feetY, 1e-9) && q.color === ember), 'off the floor in its ember');
  assert.ok(near(body().origin[1], feetY - 2.4 * (500 / 900), 1e-9), `sinking into the stone (${feetY - body().origin[1]} m)`);
  // ITS BODY LEFT
  clock.t = FELL + FALL_MS; S.fight.frame(); await tick(); S.fight.frame();
  assert.equal(body(), undefined, 'its body gone');
  const ct = ENEMY_BASICS[look.mobile].corpseTexture, corpse = drawnAt(S.fight, centre, fx, fz, ct.archive);
  assert.ok(corpse, 'its corpse where it fell');
  assert.equal(corpse.record, `${ct.record}#0`);
  assert.ok(near(corpse.origin[1], feetY, 1e-9), 'on the floor');
  assert.ok(near(corpse.size.w, 64 * GLOBAL_SCALE * 4.8, 1e-9) && near(corpse.size.h, 24 * GLOBAL_SCALE * 4.8, 1e-9), `grown as Grath is drawn (${corpse.size.w} x ${corpse.size.h})`);
  assert.equal(corpse.noShadow, true, 'no giant\'s shadow');
  assert.equal(S.fight.lights().length, 0, 'its glow spent');
  // a minute on: still there, nothing played again, no target
  const made = S.batches.length;
  clock.t = FELL + 60_000; S.fight.frame(); S.fight.frame();
  assert.ok(drawnAt(S.fight, centre, fx, fz, ct.archive) === corpse && S.batches.length === made, 'the same corpse, none made again');
  assert.equal(body(), undefined, 'never its body standing frozen');
  assert.deepEqual([S.sounds.length, S.shakes.length, S.fight.fall().bursts().length, S.fight.hostTargets().length], [2, 1, 0, 0]);
});

test('EG-FALL ONLY WHILE NEWS: a screen that first sees a lord after its fall sees its body on the floor and nothing played - no cry, no shake, no burst, no flash, no thud, no column (the gate\'s FALL_CRY_LATE_MS and its second for the thud and the column); a screen that comes in late in the fall sees the thud and the embers still to come (mutants: the cry while not news; the thud while not news; the column while not news)', async () => {
  for (const late of [FALL_CRY_LATE_MS, 30_000]) {
    const b = lordRow(1, 'garoth', { fell: FELL });
    const { spec, E } = hallWith(5, [b]), centre = egHallCentre(spec), look = egLookOf(b, spec.band);
    const clock = { t: FELL + late };
    const S = screen(() => E, clock);
    S.fight.frame(); await tick(); S.fight.frame();
    assert.deepEqual([S.sounds.length, S.shakes.length, S.fight.lights().filter((l) => near(l.color[0], WHITE[0] * 4 * (1 - late / FALL_FLASH_MS), 1e-6)).length], [late < THUD_AT_MS + FALL_NEWS_MS ? 1 : 0, 0, 0], `${late} ms late: no cry, no shake, no flash`);
    if (late < THUD_AT_MS + FALL_NEWS_MS) assert.equal(S.sounds[0].clip, BOSS_CUES.thud.clip, 'its thud still news');
    assert.ok(S.fight.fall().bursts(clock.t + 1).every((q) => q.kind === FX_KINDS.embers), 'no kill burst');
    if (late >= 30_000) {
      assert.equal(S.fight.fall().bursts(clock.t + 1).length, 0, 'no embers a half minute on');
      const ct = ENEMY_BASICS[look.mobile].corpseTexture;
      assert.ok(drawnAt(S.fight, centre, b.x, b.z, ct.archive), 'its body on the floor');
    } else {
      for (let k = 1; k < COLUMN_BURSTS; k++) { clock.t = FELL + THUD_AT_MS + k * COLUMN_STEP_MS; S.fight.frame(); }
      assert.equal(S.fight.fall().bursts(clock.t + 1).filter((q) => q.kind === FX_KINDS.embers).length, COLUMN_BURSTS, 'the column still to come, each at its moment');
      assert.equal(S.sounds.length, 1, 'and no cry after it');
    }
  }
});

test('EG-FALL AN EMBER OF THE COLUMN IS NEWS FOR A SECOND (gateCourt.js fallEvent\'s): a screen that first sees the fall just past the first ember\'s second draws none of it - its spark pass would still show its last tenth - and the two after it, still news (mutants: the column while not news)', async () => {
  const b = lordRow(1, 'hound', { fell: FELL });
  const { E } = hallWith(5, [b]), clock = { t: FELL + THUD_AT_MS + FALL_NEWS_MS + 50 };
  const S = screen(() => E, clock);
  S.fight.frame();
  assert.deepEqual(S.fight.fall().bursts(clock.t).map((q) => q.at0 - FELL), [1750, 2000], 'the first ember a second gone, the next two seen');
});

test('EG-FALL A FLYER FALLS OUT OF THE AIR: the Mother of Dusk, felled aloft, drops from her hover (her presence\'s, with its bob) to her feet by the thud, then sinks as every lord does (mutants: her hover held through the fall)', async () => {
  const b = lordRow(1, 'dusk', { fell: FELL, fl: EG_FL.fly });
  const { spec, E } = hallWith(5, [b]), centre = egHallCentre(spec), look = egLookOf(b, spec.band), archive = ENEMY_BASICS[look.mobile].maleTexture;
  assert.ok(look.hover === EG_LORD_HOVER_M * look.presence && look.hover > 0, 'aloft');
  const clock = { t: FELL - 40 };
  const S = screen(() => E, clock);
  S.fight.frame(); await tick();
  const lift = () => drawnAt(S.fight, centre, b.x, b.z, archive).origin[1] - centre[1];
  const bob = (t) => look.hover + 0.15 * look.presence * Math.sin(t / 260 + b.i);
  for (const [since, aloft] of [[0, 1], [750, 0.75], [1200, 1 - 0.8 * 0.8]]) {
    clock.t = FELL + since; S.fight.frame();
    assert.ok(near(lift(), aloft * bob(clock.t), 1e-9), `${since} ms in: ${aloft} of her hover (${lift()})`);
  }
  clock.t = FELL + THUD_AT_MS; S.fight.frame();
  assert.ok(near(lift(), 0, 1e-9), 'on her feet at the thud');
  clock.t = FELL + 2000; S.fight.frame();
  assert.ok(near(lift(), -egFallSinkM(look.drawn) * (500 / 900), 1e-9), 'then sunk');
});

test('EG-FALL A TWIN RAISED STANDS AGAIN, AND FALLS AGAIN: a fallen Twin\'s corpse is put away the frame the room raises it (its flag cleared - net/eliteGates/egLink.js fellOf) and it stands; felled again, its fall plays again from its new moment; a lord gone from the fight, a new hall and the breach left each put its corpse away (mutants: the raised Twin\'s corpse kept; its second fall never played; leave keeping the corpse; a new hall keeping it)', async () => {
  const fallen = (fell) => lordRow(2, 'twins', { pt: 1, fell }), standing = lordRow(2, 'twins', { pt: 1 });
  let H = hallWith(5, [fallen(FELL)]);
  const centre = egHallCentre(H.spec), look = egLookOf(standing, H.spec.band), ct = ENEMY_BASICS[look.mobile].corpseTexture, archive = ENEMY_BASICS[look.mobile].maleTexture;
  const clock = { t: FELL + 3000 };
  const S = screen(() => H.E, clock);
  S.fight.frame(); await tick(); S.fight.frame();
  const corpse = drawnAt(S.fight, centre, standing.x, standing.z, ct.archive);
  assert.ok(corpse, 'Isk lies where she fell');
  // raised (the Twins' fifteen seconds)
  H = hallWith(5, [standing]);
  clock.t = FELL + 9000; S.fight.frame();
  assert.ok(S.freed.includes(corpse), 'her corpse put away');
  assert.equal(drawnAt(S.fight, centre, standing.x, standing.z, ct.archive), undefined);
  const up = drawnAt(S.fight, centre, standing.x, standing.z, archive);
  assert.ok(up && near(up.origin[1], centre[1], 1e-9), 'she stands');
  assert.equal(S.fight.fall().state().length, 0, 'nothing held of her fall');
  // felled again
  const again = FELL + 12_000, cries = S.sounds.filter((s) => s.clip === ENEMY_BASICS[25].barkSound).length;
  H = hallWith(5, [fallen(again)]);
  clock.t = again; S.fight.frame();
  assert.equal(S.sounds.filter((s) => s.clip === ENEMY_BASICS[25].barkSound).length, cries + 1, 'her second death cry');
  assert.equal(S.fight.fall().state()[0].at, again, 'from its own moment');
  clock.t = again + FALL_MS; S.fight.frame();
  const second = drawnAt(S.fight, centre, standing.x, standing.z, ct.archive);
  assert.ok(second && second !== corpse, 'her body left again');
  // raised and felled again between two frames this screen draws (a hidden tab): its new fall is a new fall
  const unseen = again + 20_000, cries2 = S.sounds.filter((s) => s.clip === ENEMY_BASICS[25].barkSound).length;
  H = hallWith(5, [fallen(unseen)]);
  clock.t = unseen; S.fight.frame();
  assert.ok(S.freed.includes(second), 'the last fall\'s corpse put away');
  assert.equal(drawnAt(S.fight, centre, standing.x, standing.z, ct.archive), undefined, 'not lying there through its new fall');
  assert.equal(S.sounds.filter((s) => s.clip === ENEMY_BASICS[25].barkSound).length, cries2 + 1, 'its third death cry');
  clock.t = unseen + FALL_MS; S.fight.frame();
  const latest = drawnAt(S.fight, centre, standing.x, standing.z, ct.archive);
  assert.ok(latest && latest !== second, 'its body left once more');
  // the breach left
  S.fight.leave();
  assert.ok(S.freed.includes(latest), 'freed with the breach');
  // a new hall
  H = hallWith(5, [fallen(FELL)]);
  clock.t = FELL + 5000; S.fight.frame(); S.fight.frame();
  const third = drawnAt(S.fight, centre, standing.x, standing.z, ct.archive);
  assert.ok(third, 'laid in the hall again');
  const next = hallWith(6, []);
  H = { ...next, E: { ...next.E, fight: H.E.fight } };   // the next hall entered, its fight not yet heard (the last hall's still held)
  S.fight.frame();
  assert.ok(S.freed.includes(third), 'put away at a new hall, before its fight is heard');
  // gone from the fight's bodies
  H = hallWith(5, [fallen(FELL)]);
  S.fight.frame(); S.fight.frame();
  const fourth = drawnAt(S.fight, egHallCentre(H.spec), standing.x, standing.z, ct.archive);
  assert.ok(fourth);
  H = { ...H, E: { ...H.E, fight: { ...H.E.fight, bodies: [] } } };
  S.fight.frame();
  assert.ok(S.freed.includes(fourth), 'put away when the room keeps it no more');
});

test('EG-FALL THE SPARKS AND THE SHAKE\'S LAW (the module over a recording WebGL): the kill\'s burst and the column drawn by the gate\'s own spark pass (render/gate/gateFx.js), a draw of points a burst, its share of the sparks - and nothing touched with none standing; the shake under the player\'s motion (the Spire\'s egShakeMotion: reduced motion none, Technique camera motion its share) (mutants: the shake past the motion law; no sparks drawn)', () => {
  const b = lordRow(1, 'hound', { fell: FELL }), look = egLookOf(b, 0), centre = [100, 20, -50];
  for (const m of [1, 0.5, 0]) {
    const { gl, calls } = recordingGl(), shakes = [], batches = [], lights = [];
    let t = FELL;
    const F = createEgLordFall({ gl, now: () => t, shake: (k) => shakes.push(k), motion: () => m, batches, lights });
    const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    F.see(b, t, look, centre); F.sweep();
    assert.deepEqual(shakes, m > 0 ? [FALL_SHAKE * m] : [], `motion ${m}`);
    calls.length = 0;
    t = FELL + 100;
    assert.equal(F.draw(I, I, [0, 0, 0], t / 1000), true, 'the kill\'s burst drawn');
    const pts = calls.filter((c) => c[0] === 'drawArrays' && c[1] === 0);
    assert.deepEqual(pts.map((c) => c[3]), [Math.round(FX_SPARKS * FX_KINDS.dagon.share)], 'its sparks');
    t = FELL + THUD_AT_MS + 2 * COLUMN_STEP_MS + 50;
    lights.length = 0; F.see(b, t, look, centre); F.sweep();
    calls.length = 0;
    F.draw(I, I, [0, 0, 0], t / 1000);
    assert.equal(calls.filter((c) => c[0] === 'drawArrays' && c[1] === 0).length, COLUMN_BURSTS, 'the column\'s three');
    t = FELL + 30_000;
    calls.length = 0;
    assert.equal(F.draw(I, I, [0, 0, 0], t / 1000), false);
    assert.equal(calls.length, 0, 'none standing touches nothing');
  }
});

test('EG-FALL IN THE FIGHT\'S WORLD PASS (scenes/eliteGates/egFight.js drawPass over a recording WebGL): the fall\'s sparks drawn after the telegraph floors, whether or not a telegraph stands (mutants: drawPass never drawing the fall)', async () => {
  const b = lordRow(1, 'hound', { fell: FELL });
  const { E } = hallWith(5, [b]), clock = { t: FELL };
  const { gl, calls } = recordingGl();
  const S = screen(() => E, clock, { gl });
  S.fight.frame();
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  clock.t = FELL + 100;
  calls.length = 0;
  assert.equal(S.fight.drawPass(I, I, [0, 0, 0], clock.t / 1000), true, 'it drew');
  assert.ok(calls.filter((c) => c[0] === 'drawArrays' && c[1] === 0).some((c) => c[3] === Math.round(FX_SPARKS * FX_KINDS.dagon.share)), 'the kill\'s sparks');
});

test('EG-FALL THE FIGHT\'S SHAKE UNDER THE PLAYER\'S MOTION (section 25.7, world/eliteGates/egTelegraph.js egShakeMotion - the Spire\'s heavy blows\' own law): Technique camera motion at half shakes half FALL_SHAKE at the kill, the Spire shelf\'s reduced motion none (mutants: the fight\'s fall shaking past the motion law)', () => {
  const was = [getPref('techniqueMotion'), getPref(EG_ACCESS_PREFS.motion)];   // AUDIT EG-FALL (L2-11): put back as found
  try {
    for (const [technique, still, want] of [[0.5, false, [FALL_SHAKE * 0.5]], [1, true, []]]) {
      setPref('techniqueMotion', technique); setPref(EG_ACCESS_PREFS.motion, still);
      const { E } = hallWith(5, [lordRow(1, 'hound', { fell: FELL })]), clock = { t: FELL };
      const S = screen(() => E, clock);
      S.fight.frame();
      assert.deepEqual(S.shakes, want, `Technique ${technique}, reduced ${still}`);
    }
  } finally { setPref('techniqueMotion', was[0]); setPref(EG_ACCESS_PREFS.motion, was[1]); }
});

// ── AUDIT EG-FALL (bible/01-Overview/audits/Audit-EG-FALL.md): the pins the lanes found missing ────────────────────────────────
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** Hall 5's fight floor (its court, 19 m over the hall's 0) - the lords' own ground. */
const COURT5 = Object.freeze({ x: 61.5, z: 71.14, y: 19 });

test('AUDIT EG-FALL L2-6/L2-7/L2-10 THE BEATS WHERE THEY STAND: the glow and the flash each their own record, whole (place, reach, colour and its green, carried), the flash fading over FALL_FLASH_MS; the cry from the chest and the thud a metre over the floor; no corpse before FALL_MS though its pictures stand, the corpse\'s frame asked of the renderer, and the bursts forgotten with the breach (mutants: the thud\'s place; a light\'s green; a light\'s place; the flash never fading; the glow casting; the corpse laid from the thud; its frame never uploaded; leave keeping the bursts)', async () => {
  const b = lordRow(1, 'hound', { fell: FELL, x: 3, z: 28 });
  const { spec, E } = hallWith(5, [b]), centre = egHallCentre(spec), look = egLookOf(b, spec.band), ember = egLordEmber('hound', 0, spec.band), tall = egFallTallM(look.drawn);
  const F = [centre[0] + 3, centre[1], centre[2] + 28];
  const clock = { t: FELL - 40 }, S = screen(() => E, clock);
  S.fight.frame(); await tick(); S.fight.frame();
  clock.t = FELL + 100; S.fight.frame();
  const k = FALL_FLASH_K * (1 - 100 / FALL_FLASH_MS), g = FALL_GLOW_K * (1 - 100 / FALL_MS);
  const lit = () => S.fight.lights().map((l) => ({ x: l.x, y: l.y, z: l.z, range: l.range, color: [...l.color], carried: l.carried }));
  assert.deepEqual(lit(), [
    { x: F[0], y: F[1] + tall * GLOW_UP_SHARE, z: F[2], range: GLOW_RANGE.landing, color: ember.map((c) => c * g), carried: true },
    { x: F[0], y: F[1] + FALL_FLASH_Y, z: F[2], range: FALL_FLASH_RANGE, color: WHITE.map((c) => c * k), carried: true },
  ], 'the glow at its chest and the flash over its fall, whole');
  clock.t = FELL + 300; S.fight.frame();
  assert.deepEqual(lit()[1].color, WHITE.map((c) => c * FALL_FLASH_K * (1 - 300 / FALL_FLASH_MS)), 'the flash fading');
  assert.deepEqual(S.sounds[0].at, [F[0], F[1] + tall * FALL_BURST_UP, F[2]], 'the cry from its chest');
  clock.t = FELL + THUD_AT_MS; S.fight.frame(); await tick(); S.fight.frame();
  assert.deepEqual(S.sounds.at(-1).at, [F[0], F[1] + 1, F[2]], 'the thud a metre over the floor');
  const ct = ENEMY_BASICS[look.mobile].corpseTexture, lying = () => drawnAt(S.fight, centre, 3, 28, ct.archive);
  clock.t = FELL + FALL_MS - 1; S.fight.frame(); await tick(); S.fight.frame();
  assert.equal(lying(), undefined, 'no corpse while it still sinks');
  clock.t = FELL + FALL_MS; S.fight.frame(); await tick(); S.fight.frame();
  assert.ok(lying(), 'its corpse at FALL_MS');
  assert.ok(S.uploads.some((u) => u[0] === ct.archive && u[1] === ct.record && u[2] === 0), 'the corpse\'s frame asked of the renderer');
  // the bursts forgotten with the breach - a new one's first frames never show the last one's sparks
  const S2 = screen(() => E, { t: FELL });
  S2.fight.frame();
  assert.ok(S2.fight.fall().bursts(FELL + 100).length > 0);
  S2.fight.leave();
  assert.equal(S2.fight.fall().bursts(FELL + 100).length, 0, 'no burst kept past the breach');
});

test('AUDIT EG-FALL L2-4/L2-5 A FALL FIRST SEEN LATE, ON A COURT ABOVE THE HALL: a screen that first sees a walking lord 300 ms into its fall still hears its cry and is shaken, its burst and its flash run from the fall\'s own instant (the flash at a quarter), and it lies where it was AT the fall - never where its walk had carried it since; its feet, its burst\'s floor and its corpse on its own floor 19 m up (mutants: the burst from first sight; the flash from first sight; the place read now; the feet at the hall\'s 0)', async () => {
  const b = lordRow(1, 'hound', { fell: FELL, x: COURT5.x, z: COURT5.z, y: COURT5.y, tx: COURT5.x + 10, tz: COURT5.z, v: 4, at: FELL - 1000 });
  const { spec, E } = hallWith(5, [b]), centre = egHallCentre(spec), look = egLookOf(b, spec.band), archive = ENEMY_BASICS[look.mobile].maleTexture, ct = ENEMY_BASICS[look.mobile].corpseTexture;
  const [fx, fz] = egBodyPlace(b, FELL), floorY = centre[1] + COURT5.y;
  assert.ok(near(fx, COURT5.x + 4, 1e-9) && !near(egBodyPlace(b, FELL + 300)[0], fx), 'walking: 4 m along at its fall, more since');
  const clock = { t: FELL + 300 }, S = screen(() => E, clock);
  S.fight.frame();
  assert.deepEqual([S.sounds.length, S.shakes.length], [1, 1], 'its cry and the shake, 300 ms late');
  const B = S.fight.fall().bursts(clock.t);
  assert.equal(B[0].at0, FELL, 'the burst from the fall\'s instant');
  assert.ok(near(B[0].floor, floorY, 1e-9) && near(B[0].at[0], centre[0] + fx, 1e-9), 'on its own floor, where it fell');
  const flash = S.fight.lights().find((l) => l.range === FALL_FLASH_RANGE);
  assert.ok(flash && near(flash.color[0], WHITE[0] * FALL_FLASH_K * (1 - 300 / FALL_FLASH_MS), 1e-12), 'the flash at a quarter - from the fall\'s instant');
  await tick(); clock.t += 16; S.fight.frame();
  const hurt = hurtKeys(look.mobile), body = S.fight.batches().find((q) => q.archive === archive && hurt.has(q.record));
  assert.ok(body && near(body.origin[0], centre[0] + fx, 1e-9) && near(body.origin[1], floorY, 1e-9), `its body where it fell, on its floor (${body?.origin})`);
  clock.t = FELL + FALL_MS; S.fight.frame(); await tick(); S.fight.frame();
  const lying = S.fight.batches().find((q) => q.archive === ct.archive);
  assert.ok(lying && near(lying.origin[0], centre[0] + fx, 1e-9) && near(lying.origin[1], floorY, 1e-9), 'its corpse there, on its floor');
});

test('AUDIT EG-FALL L2-4 A LORD WITH NO ELEMENT FALLS IN ITS BAND\'S EMBER, THROUGH THE FIGHT: the Night-Stalker (no element) felled in the Shade Perilous (hall 55, band 2) bursts and glows in the Rime\'s ember the fight\'s band hands the fall (mutants: the band never reaching the fall)', () => {
  const b = lordRow(1, 'stalker', { fell: FELL });
  const { spec, E } = hallWith(55, [b]);
  assert.equal(spec.band, 2, 'the Shade');
  const S = screen(() => E, { t: FELL });
  S.fight.frame();
  assert.deepEqual(S.fight.fall().bursts(FELL + 50)[0].color, ASPECT_COLORS.rime.ember, 'the Rime\'s ember');
});

test('AUDIT EG-FALL L1-4/L1-5 A WINGED LORD FALLS BEATING ITS WINGS, ITS BEATS FROM THE AIR: the Mother of Dusk felled aloft cries and bursts from her chest in the air she fell from, her glow drops with her (egFallAloft), and she beats her wings on the flyers\' clock as she falls (the gate\'s host\'s winged fall - her winged table looped) where a one-picture hurt record holds (mutants: the beats from the floor; the glow left in the air; the wings held mid-beat)', async () => {
  const b = lordRow(1, 'dusk', { fell: FELL, fl: EG_FL.fly });
  const { spec, E } = hallWith(5, [b]), centre = egHallCentre(spec), look = egLookOf(b, spec.band), tall = egFallTallM(look.drawn), archive = ENEMY_BASICS[look.mobile].maleTexture;
  const clock = { t: FELL - 40 }, S = screen(() => E, clock, {}, { frames: 8 });
  S.fight.frame(); await tick(); S.fight.frame();
  clock.t = FELL; S.fight.frame();
  assert.ok(near(S.sounds[0].at[1], centre[1] + look.hover + tall * FALL_BURST_UP, 1e-9), `her cry from the air (${S.sounds[0].at[1]} m)`);
  assert.ok(near(S.fight.fall().bursts(FELL + 10)[0].at[1], centre[1] + look.hover + tall * FALL_BURST_UP, 1e-9), 'her burst there');
  const winged = hurtKeys(look.mobile, true), framesSeen = [];
  for (const since of [0, 300, 750, 1200]) {
    clock.t = FELL + since; S.fight.frame();
    const glow = S.fight.lights().find((l) => l.range === GLOW_RANGE.landing);
    assert.ok(near(glow.y, centre[1] + look.hover * egFallAloft(since) + tall * GLOW_UP_SHARE, 1e-9), `${since} ms in: her glow drops with her`);
    const q = S.fight.batches().find((x) => x.archive === archive);
    assert.ok(q && winged.has(`${q.record.split('#')[0]}#0`), `her winged table (${q?.record})`);
    framesSeen.push(Number(q.record.split('#')[1]));
  }
  assert.deepEqual(framesSeen, [0, 300, 750, 1200].map((s) => Math.floor((s / 1000) * 10) % 8), 'her wings beating at the flyers\' ten a second, looped');
});

test('AUDIT EG-FALL L1-3 THE FALL\'S LIGHTS CAST NO SHADOW IN THE SPIRE: the Spire\'s light seam (world/eliteGates/egHall.js egLightsWith) honours a light\'s `carried` mask as the gate\'s does (world/gate/gateArena.js withCourtLights), so the flash and the glow take no shadow caster\'s slot and a crystal\'s light still casts (mutants: the mask dropped)', () => {
  const glow = { x: 0, y: 2, z: 0, range: 18, color: [1, 0.5, 0.2], carried: true }, flash = { x: 0, y: 3, z: 0, range: 40, color: [4, 4, 4], carried: true }, crystal = { x: 2, y: 2, z: 0, range: 6, color: [1, 0, 0] };
  const lit = egLightsWith({ data: new Float32Array(0), colors: new Float32Array(0), carried: new Uint8Array(0) }, [glow, crystal, flash], [], [0, 0, 0]);
  assert.deepEqual([...lit.carried], [1, 0, 1]);
  assert.deepEqual([...lit.data.carried], [1, 0, 1], 'the list the renderer reads carries it');
});

test('AUDIT EG-FALL L1-6/L1-7 THE SPARK PASS WARMED, SIZED AND FREED (the module over a recording WebGL): warmed while a lord stands it is built before the kill, so the kill\'s frame links nothing; its sparks sized by the world image\'s height (the Hour\'s - a canvas twice it under a render scale); freed with the breach - its programs, arrays and buffers deleted once - and built again for the next (mutants: never warmed; the canvas\'s height; never freed)', () => {
  const b = lordRow(1, 'hound', { fell: FELL }), look = egLookOf(b, 0), centre = [100, 20, -50];
  const { gl, calls } = recordingGl();
  let t = FELL - 5000;
  const F = createEgLordFall({ gl, renderer: { worldViewportPx: [0, 0, 1440, 720] }, now: () => t, batches: [], lights: [] });
  F.warm();
  assert.equal(calls.filter((c) => c[0] === 'linkProgram').length, 2, 'built at the warm: its two programs linked');
  calls.length = 0;
  t = FELL; F.see(b, t, look, centre); F.sweep();
  t = FELL + 100;
  assert.equal(F.draw(I4, I4, [0, 0, 0], t / 1000), true);
  assert.equal(calls.filter((c) => c[0] === 'linkProgram').length, 0, 'the kill\'s frame links nothing');
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uPxPerM'), ['uniform1f', 'uPxPerM', 360], 'the world image\'s 720 px, not the canvas\'s');
  calls.length = 0;
  F.dispose();
  assert.deepEqual(['deleteProgram', 'deleteVertexArray', 'deleteBuffer'].map((k) => calls.filter((c) => c[0] === k).length), [2, 2, 2], 'freed whole');
  F.dispose();
  assert.equal(calls.filter((c) => c[0] === 'deleteProgram').length, 2, 'once');
  calls.length = 0;
  t = FELL + 9000; F.see({ ...b, fellAt: t }, t, look, centre); F.sweep();
  t += 100;
  assert.equal(F.draw(I4, I4, [0, 0, 0], t / 1000), true, 'the next breach\'s fall drawn');
  assert.equal(calls.filter((c) => c[0] === 'linkProgram').length, 2, 'by a pass built again');
});

test('AUDIT EG-FALL L2-3 THE FALL AND A TELEGRAPH IN ONE WORLD PASS (scenes/eliteGates/egFight.js drawPass over a recording WebGL): burning ground on hall 5\'s court and a lord fallen beside it draw both - the floors and the kill\'s sparks - and the pass answers it drew; burning ground alone still answers (mutants: the sparks dropped when a floor drew; the floors\' answer dropped)', () => {
  const zone = (t) => ({ i: 7, kind: 'burn', s: ['d', COURT5.x, COURT5.z, 6], from: t - 1000, until: t + 60_000, p: 0, b: 0, el: 'fire', y: COURT5.y });
  for (const fallen of [true, false]) {
    const b = lordRow(1, 'hound', { fell: fallen ? FELL : 0, x: COURT5.x + 4, z: COURT5.z, y: COURT5.y });
    const H = hallWith(5, [b]);
    const E = { ...H.E, fight: { ...H.E.fight, zones: [zone(FELL)] } }, clock = { t: FELL };
    const { gl, calls } = recordingGl();
    const S = screen(() => E, clock, { gl });
    S.fight.frame();
    clock.t = FELL + 100; S.fight.frame();
    calls.length = 0;
    assert.equal(S.fight.drawPass(I4, I4, [0, 0, 0], clock.t / 1000), true, `${fallen ? 'the fall and the ground' : 'the ground alone'}: it drew`);
    const floors = calls.filter((c) => c[0] === 'drawArrays' && c[1] === 4).length, sparks = calls.filter((c) => c[0] === 'drawArrays' && c[1] === 0 && c[3] === Math.round(FX_SPARKS * FX_KINDS.dagon.share)).length;
    assert.ok(floors > 0, `the burning ground's floors drawn (${floors})`);
    assert.equal(sparks, fallen ? 1 : 0, 'the kill\'s sparks beside them');
  }
});

test('AUDIT EG-FALL L1-5/L3-4 DAGGERFALL\'S OWN PICTURES (where ARENA2 stands - CLAUDE.md: the freeware is fetched, tools/fetch-data.sh): every lord\'s hurt records hold ONE picture (the fall\'s frame index is one held picture, as the gate\'s), every lord\'s corpse record stands in its archive, and Grath falls through the fight on his real pictures - his hurt picture on the floor, then his corpse 9.0 by 4.2 m (TEXTURE.400 record 1 at his drawn 4.8)', { skip: !process.env.ARENA2_PATH || !existsSync(process.env.ARENA2_PATH) }, async () => {
  const A = process.env.ARENA2_PATH, names = new Map(readdirSync(A).map((f) => [f.toUpperCase(), f]));
  const load = (archive) => { const name = TextureFile.indexToFileName(archive).toUpperCase(), tex = new TextureFile(); assert.ok(tex.load(new Uint8Array(readFileSync(join(A, names.get(name)))), name), name); tex.archive = archive; return tex; };
  for (const key of EG_BOSS_KEYS) for (const pt of key === 'twins' ? [0, 1] : [0]) {
    const look = egLookOf(lordRow(1, key, { pt }), 0), E = ENEMY_BASICS[look.mobile], body = load(E.maleTexture), corpse = load(E.corpseTexture.archive);
    for (const k of hurtKeys(look.mobile)) assert.equal(body.getFrameCount(Number(k.split('#')[0])), 1, `${key}: hurt record ${k} one picture`);
    assert.ok(corpse.getFrameCount(E.corpseTexture.record) >= 1, `${key}: its corpse record stands`);
  }
  const b = lordRow(1, 'hound', { fell: FELL }), { spec, E } = hallWith(5, [b]), centre = egHallCentre(spec), look = egLookOf(b, spec.band);
  const clock = { t: FELL - 40 }, S = screen(() => E, clock, { getTexture: async (archive) => load(archive) });
  S.fight.frame(); await tick(); S.fight.frame();
  clock.t = FELL + 900; S.fight.frame();
  assert.ok(S.fight.batches().some((q) => q.archive === ENEMY_BASICS[look.mobile].maleTexture && hurtKeys(look.mobile).has(q.record)), 'his hurt picture');
  clock.t = FELL + FALL_MS; S.fight.frame(); await tick(); S.fight.frame();
  const lying = drawnAt(S.fight, centre, b.x, b.z, 400);
  assert.ok(lying && near(lying.size.w, 9.0, 0.06) && near(lying.size.h, 4.2, 0.06), `his corpse 9.0 by 4.2 m (${lying?.size.w} x ${lying?.size.h})`);
});

test('AUDIT EG-FALL L1-1/L1-2 THE SAME FALL, TOLD AGAIN (the module, row by row): a fall stamped at `efl`\'s arrival and then told at the relay\'s own instant is one fall - its flash moved to the relay\'s instant with it (ended 400 ms after the instant, not the stamp); its place, first seen along a walk, taken from a row the relay stopped (world248: where it lies on every screen), and never from a row still walking (an older relay carrying it on) (mutants: the flash left at the stamp; the stopped row unread; the walking row read)', () => {
  const look = egLookOf(lordRow(1, 'hound'), 0), centre = [0, 0, 0], lights = [];
  const F = createEgLordFall({ now: () => FELL, batches: [], lights });
  // first seen at the screen's stamp, 120 ms after the relay's instant, on the walk the screen held: 4 m/s from x 0 since FELL - 1000
  const walking = lordRow(1, 'hound', { fell: FELL + 120, x: 0, z: 30, tx: 10, tz: 30, v: 4, at: FELL - 1000 });
  F.see(walking, FELL + 130, look, centre); F.sweep();
  const first = [...F.placeOf(1)];
  assert.ok(near(first[0], 4.48, 1e-9), `first seen along its walk at the stamp (${first[0]})`);
  // the whole fight: the relay's instant, the row the relay stopped where it fell (x 4 - the walk at FELL)
  const stopped = lordRow(1, 'hound', { fell: FELL, x: 4, z: 30 });
  lights.length = 0; F.see(stopped, FELL + 390, look, centre); F.sweep();
  assert.ok(near(F.placeOf(1)[0], 4, 1e-9), 'the stopped row\'s place taken');
  const flash = lights.find((l) => l.range === FALL_FLASH_RANGE);
  assert.ok(flash && near(flash.color[0], WHITE[0] * FALL_FLASH_K * (1 - 390 / FALL_FLASH_MS), 1e-12), 'its flash at the relay\'s instant: 390 ms into it');
  lights.length = 0; F.see(stopped, FELL + 410, look, centre); F.sweep();
  assert.equal(lights.filter((l) => l.range === FALL_FLASH_RANGE).length, 0, 'the flash ended 400 ms after the instant');
  // an older relay: the whole fight re-says the walk from where it carried it - the place first seen is kept
  const G = createEgLordFall({ now: () => FELL, batches: [], lights: [] });
  G.see(walking, FELL + 130, look, centre); G.sweep();
  const carried = lordRow(1, 'hound', { fell: FELL, x: 8, z: 30, tx: 10, tz: 30, v: 4, at: FELL + 2000 });
  G.see(carried, FELL + 2010, look, centre); G.sweep();
  assert.deepEqual(G.placeOf(1), first, 'a row still walking never moves it');
  assert.equal(G.state().length, 1, 'and it is one fall');
});

test('AUDIT EG-FALL L1-6 THE FIGHT WARMS THE SPARKS WHILE A LORD STANDS, AND A FREED PASS DRAWS NOTHING (egFight over a recording WebGL; render/gate/gateFx.js): a hall whose fight holds a lord starts the spark pass\'s programs before any kill, a hall with none does not; a destroyed pass asked to draw touches nothing (mutants: the fight never warming; a destroyed pass drawing)', () => {
  for (const [bodies, want] of [[[lordRow(1, 'hound')], true], [[], false]]) {
    const { E } = hallWith(5, bodies), { gl, calls } = recordingGl();
    const S = screen(() => E, { t: FELL }, { gl });
    S.fight.frame();
    assert.equal(calls.some((c) => c[0] === 'shaderSource' && c[2] === FX_SPARK_VS), want, `${want ? 'a lord stands' : 'no lord'}: the sparks ${want ? '' : 'not '}warmed`);
  }
  const { gl, calls } = recordingGl(), pass = new GateFxRenderer(gl);
  pass.destroy();
  calls.length = 0;
  pass.draw([{ at: [0, 0, 0], t: 0.2, kind: FX_KINDS.dagon, color: [1, 1, 1] }], null, I4, I4, [0, 0, 0], 1);
  assert.deepEqual([calls.length, pass.bursts], [0, 0], 'nothing touched, nothing drawn');
});
