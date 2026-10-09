// SD25 S8 (2026-10-09, the Abyss Dungeon's look; bible/11-Multiplayer/Super-Dungeons-Look.md section 10): THE BRASS
// REMNANT, THE REST OF IT - its tells (a tell atlas in its own archive; a part's remap lights its region alone), its
// back-dial and the hand that keeps the fight's time, its rib lamps counting the Hearts, its fall (the heart torn out,
// the dial rolling free). Each law run from its own code; the frames measured for what they make.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  remnantTellArt, remnantDialArt, remnantLampArt, remnantLookArt, remnantArt, tellLit, SD_REMNANT_ARCHIVE, SD_REMNANT_TELL_RECORD, SD_REMNANT_WHITE_RECORD,
  SD_REMNANT_HUSK_RECORD, SD_REMNANT_DIAL_RECORD, SD_REMNANT_HAND_RECORD, SD_REMNANT_LAMP_RECORD, SD_REMNANT_RIM_RECORD, SD_TELL_REGION, SD_TELL_ART_SIZE,
  SD_TELL_BLOW, SD_TELL_GLOW, SD_BLADE_MID, SD_DIAL_ART, SD_LAMP_ART, SD_DIAL_RIM_GLOW, SD_REMNANT_GATHER_RECORD, SD_GATHER_GLOW, echoMetalArt,
} from '../src/world/sdRemnantArt.js';
import {
  buildRemnantParts, buildBackDialModel, buildDialHandModel, buildRibLampsModel, buildTornHeartModel, ribLampAt, heartRecordOf, remnantMatrix,
  SD_REMNANT_DIAL, SD_REMNANT_BODY, SD_REMNANT_KIT, SD_REMNANT_PARTS,
} from '../src/world/sdRemnantModel.js';
import {
  createSdRemnant, ensureSdRemnantArt, sdTellsAt, sdDialHandAt, sdRibLampsLit, SD_TELLS, SD_TELL_HEAT, SD_TELL_AFTER_MS, SD_DIAL_LOOK, SD_DIAL_TURNS,
  SD_GEAR_DRAWS, SD_DECOR_DRAWS,
} from '../src/scenes/sdRemnant.js';
import { dialHandMatrix, dialFallMatrix, heartFallMatrix, gearFlightOf, mul4, sdGatherGearsAt, SD_FALL_DECOR, SD_RIG_PARTS, SD_REM_HAND } from '../src/scenes/sdRemnantRig.js';
import { SD_BLOW_COLOR } from '../src/scenes/sdRemnantBlows.js';
import { SD_BLOWS, SD_BODY, SD_HEARTS, SD_STUN_MS, SD_ECHO_PAIR_MS, SD_REM_START, windupFor } from '../src/net/sdRemnant.js';
import { SD_FIGHT_EMPTY } from '../src/net/sdFightLink.js';
import { SD_REALM_ARCHIVE, SD_REALM_BRASS_RECORD } from '../src/world/sdRealm.js';
import { realmBrassArt, realmArt } from '../src/world/sdRealmArt.js';
import { SD_ENDINGS } from '../src/net/sdMarks.js';
import { sdTick } from '../src/world/sdLook.js';
import { numeralCell, numeralWidth, SD_HOUR_NUMERALS } from '../src/world/sdSkyArt.js';
import { perspective, lookAt, mirrorProjectionX } from '../src/world/mat4.js';
import { SD_ARENA, SD_REALM_ORIGIN } from '../src/net/sdBrain.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const T0 = 1_800_000_000_000;
const TAU = Math.PI * 2;
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const texel = (img, x, y) => { const i = (y * img.width + x) * 4; return [img.colors[i], img.colors[i + 1], img.colors[i + 2]]; };
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const inRegion = (R, x, y) => x >= R[0] && x < R[0] + R[2] && y >= R[1] && y < R[1] + R[3];
const vertsOf = (m) => Array.from({ length: m.positions.length / 3 }, (_, i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]]);
/** A sub-mesh's corners: positions, uvs and normals. */
const cornersOf = (m, sm) => Array.from({ length: sm.primitiveCount * 3 }, (_, k) => { const i = m.indices[sm.startIndex + k]; return { p: [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]], uv: [m.uvs[i * 2], m.uvs[i * 2 + 1]], n: [m.normals[i * 3], m.normals[i * 3 + 1], m.normals[i * 3 + 2]] }; });
const subOf = (m, archive, rec) => m.subMeshes.find((s) => s.textureArchive === archive && s.textureRecord === rec) ?? null;
/** A uv's texel in the tell atlas. */
const uvTexel = (uv) => [Math.floor(uv[0] * SD_TELL_ART_SIZE), Math.floor(uv[1] * SD_TELL_ART_SIZE)];
/** The page's fight (net/sdFightLink.js's shape): the Remnant where a fight begins it, facing the way in. */
const fight = (o = {}) => ({ ...SD_FIGHT_EMPTY, fi: 1, op: T0 - 300_000, ou: 0, ends: T0 + 600_000, ph: 1, h: 900, m: 1000, su: 0, rem: { x: SD_REM_START[0], z: SD_REM_START[1], yw: Math.PI, mv: null, atk: null }, ...o });
const blowAt = (A, at, extra = {}) => ({ a: A.id, at, x: 0, z: 8, yw: Math.PI, i: 6, ...extra });
const echoes = (o0 = {}, o1 = {}) => [{ x: -9, z: 2, yw: Math.PI, mv: null, atk: null, h: 100, m: 100, up: T0 - 5000, dn: 0, ...o0 }, { x: 9, z: 2, yw: Math.PI, mv: null, atk: null, h: 100, m: 100, up: T0 - 5000, dn: 0, ...o1 }];
const fakeRenderer = (up = []) => ({ createMesh: (m) => ({ m }), destroyMesh() {}, uploadTexture: (a, r, img) => up.push(['t', a, r, img]), uploadEmissionTexture: (a, r, img, o) => up.push(['e', a, r, img, o]) });
/** A set standing a fight `S` at the clock `t` (both read through the link each frame). */
function set(state, ending = null) {
  const L = { S: state, t: T0, state: () => L.S, now: () => L.t, inDue: () => false, sentIn() {}, joined: () => false };
  const rem = createSdRemnant({ renderer: fakeRenderer(), link: () => L, ending });
  const draws = [];
  rem.stand({ dynamicDraws: draws });
  const H = 3 + SD_HEARTS[1], P = SD_RIG_PARTS.length, D = H + 3 * P + SD_GEAR_DRAWS;
  const parts = (b) => draws.slice(H + b * P, H + (b + 1) * P);
  const decor = (name, b = 0) => draws[D + (name === 'lamps' ? 6 : name === 'torn' ? 7 : 2 * b + (name === 'hand' ? 1 : 0))];
  return { L, rem, draws, parts, decor, at: (t, S = L.S) => { L.t = t; L.S = S; rem.frame(1 / 60, null); } };
}
const key = (a, r) => `${a}_${r}`;

// ── the tell atlas ─────────────────────────────────────────────────────────────────────────────────────────────────

test('SD-LOOK S8 THE TELL ATLAS (world/sdRemnantArt.js): one a metal a heat, in the Remnant\'s own archive (never the Hour\'s 38151, whose records section 7 names); its four regions apart and inside it; cold it is the metal its neighbours wear - the Hour\'s brass texel for texel off its features, an Echo\'s gilt or silver - with no light past theirs; mid lights each region\'s features in its OWN blow\'s colour (SD_BLOW_COLOR, handed in), the blade\'s ROOT half alone, its front dithered; hot the whole region, its features the core at full colour; nothing outside a region ever lit (mutants: the blade heating from its tip; mid lighting the whole region; a region in another blow\'s colour; the cold atlas lit)', () => {
  assert.notEqual(SD_REMNANT_ARCHIVE, SD_REALM_ARCHIVE);
  const S = SD_TELL_ART_SIZE, R = Object.values(SD_TELL_REGION);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) assert.ok(R.filter((r) => inRegion(r, x, y)).length <= 1, 'the regions apart');
  assert.ok(R.every((r) => r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= S && r[1] + r[3] <= S), 'inside the atlas');
  assert.deepEqual(SD_TELL_BLOW, { sole: 'stomp', fist: 'volley', blade: 'hand', rib: 'pulse' });
  for (const metal of ['brass', 'gold', 'silver']) {
    const base = metal === 'brass' ? realmBrassArt() : echoMetalArt(metal);
    const [off, mid, hot] = [0, 1, 2].map((h) => remnantTellArt(metal, h, SD_BLOW_COLOR));
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      assert.ok(same(texel(off.emission, x, y), texel(base.emission, x, y)), `${metal} cold at ${x},${y}: the metal's own light, no more`);
      if (!R.some((r) => inRegion(r, x, y))) for (const a of [mid, hot]) assert.ok(same(texel(a.emission, x, y), texel(base.emission, x, y)) && same(texel(a.albedo, x, y), texel(off.albedo, x, y)), `${metal}: nothing outside a region lit`);
    }
    // off its features the cold atlas is its metal, texel for texel
    const [bx, by] = [SD_TELL_REGION.sole[0] + 3, SD_TELL_REGION.sole[1] + 3];
    assert.ok(same(texel(off.albedo, bx, by), texel(base.albedo, bx, by)), `${metal}: the metal it is painted over`);
    for (const [k, r] of Object.entries(SD_TELL_REGION)) {
      const hue = SD_BLOW_COLOR[SD_TELL_BLOW[k]].map((v) => Math.round(v * 255));
      let litMid = 0, darkMid = 0;
      for (let ly = 0; ly < r[3]; ly++) for (let lx = 0; lx < r[2]; lx++) {
        const e = texel(mid.emission, r[0] + lx, r[1] + ly), lit = tellLit(k, 1, lx, ly);
        if (lit) { litMid++; assert.ok(e.every((v, i) => Math.abs(v - Math.round(hue[i] * SD_TELL_GLOW[1] * 0.7)) <= 1), `${metal} ${k}: mid in the ${SD_TELL_BLOW[k]}'s colour (${e} for ${hue})`); }
        else { darkMid++; assert.ok(same(e, texel(base.emission, r[0] + lx, r[1] + ly)), `${metal} ${k}: mid lights its features alone`); }
        const h = texel(hot.emission, r[0] + lx, r[1] + ly), core = tellLit(k, 2, lx, ly) === 2;
        assert.ok(h.every((v, i) => Math.abs(v - Math.round(hue[i] * (core ? 1 : 0.7))) <= 1), `${metal} ${k}: hot the whole region (${h})`);
      }
      assert.ok(litMid > 0 && darkMid > 0, `${k}: mid a part of the region`);
    }
  }
  // the blade's mid: its root half (the region's right) lit, its tip half dark
  const [x0, y0, w, h] = SD_TELL_REGION.blade, root = [], tip = [];
  for (let ly = 0; ly < h; ly++) for (let lx = 0; lx < w; lx++) ((lx + 0.5) / w >= 1 - SD_BLADE_MID ? root : tip).push(tellLit('blade', 1, lx, ly));
  assert.ok(root.every((v) => v === 1), 'the root half heated');
  assert.ok(tip.filter((v) => v === 0).length > tip.length * 0.8 && tip.slice(0, w * 2).every((v, i) => (i % w) / w > 0.3 || v === 0), 'the tip cold, the front dithered');
  assert.equal(x0 + y0 >= 0, true);
});

test('SD-LOOK S8 THE TELLS\' FACES (world/sdRemnantModel.js): the sabaton\'s UNDERSIDE samples the sole\'s region, the Hour-Hand\'s blade the blade\'s - root at its right, tip at its left, whichever face - the fist and its knuckles the fist\'s, the eight ribs the ribs\'; nothing else of the body samples the atlas; each metal its own atlas; a record from 100 the Remnant\'s archive, the rest the Hour\'s (mutants: the blade mapped tip to root; the sole on the sabaton\'s top)', () => {
  for (const metal of ['brass', 'gold', 'silver']) {
    const P = buildRemnantParts(metal), tell = SD_REMNANT_TELL_RECORD[metal][0];
    const by = Object.fromEntries(SD_REMNANT_PARTS.map((n, i) => [n, P[i]]));
    for (const m of P) for (const sm of m.subMeshes) assert.equal(sm.textureArchive, sm.textureRecord >= 100 ? SD_REMNANT_ARCHIVE : SD_REALM_ARCHIVE, `${metal}: record ${sm.textureRecord}'s archive`);
    assert.equal(subOf(by.pelvis, SD_REMNANT_ARCHIVE, tell), null, 'the pelvis tells nothing');
    assert.equal(subOf(by.head, SD_REMNANT_ARCHIVE, tell), null, 'the head tells nothing');
    const region = (part, R) => {
      const sm = subOf(by[part], SD_REMNANT_ARCHIVE, tell);
      assert.ok(sm, `${metal} ${part}: its tell`);
      const C = cornersOf(by[part], sm);
      for (const c of C) { const [x, y] = uvTexel(c.uv); assert.ok(inRegion(R, x, y), `${metal} ${part}: texel ${x},${y} in its region`); }
      return C;
    };
    for (const leg of ['legR', 'legL']) for (const c of region(leg, SD_TELL_REGION.sole)) assert.ok(near(c.p[1], 0) && near(c.n[1], -1), `${leg}: its sole - the underside`);
    const blade = region('armR', SD_TELL_REGION.blade), lo = Math.min(...blade.map((c) => c.p[1])), hi = Math.max(...blade.map((c) => c.p[1]));
    const [bx, , bw] = SD_TELL_REGION.blade;
    for (const c of blade) {
      const u = (uvTexel(c.uv)[0] - bx) / (bw - 1), along = (c.p[1] - lo) / (hi - lo);
      assert.ok(Math.abs(u - along) < 0.04, `the blade's u its length from the tip (${u.toFixed(3)} at ${along.toFixed(3)})`);
    }
    assert.ok(near(lo, SD_REMNANT_BODY.armBot) && near(hi, SD_REMNANT_KIT.blade.root), 'the blade, tip to root');
    region('armL', SD_TELL_REGION.fist);
    for (const c of region('torso', SD_TELL_REGION.rib)) assert.ok(c.p[1] > SD_REMNANT_BODY.legH + SD_REMNANT_BODY.hipH && Math.hypot(c.p[0] / SD_REMNANT_BODY.cageRX, c.p[2] / SD_REMNANT_BODY.cageRZ) > 0.3, 'the ribs');
  }
});

// ── the tells' law ─────────────────────────────────────────────────────────────────────────────────────────────────

test('SD-LOOK S8 EVERY BLOW TELLS ON THE BODY FIRST (sdTellsAt): heating off, mid from a tenth of its wind-up, hot from three fifths - the Stomp\'s sole (hot through its landing\'s first 0.3 s), the Hour-Hand\'s blade (hot through its sweep - the beam leaves its tip), the Volley\'s fist only while it gathers, the Pulse\'s ribs on every body standing, the Reset\'s heart; an Echo\'s by its own quicker wind-up; none stunned, fallen, outside time or broken (mutants: hot at nine tenths; the stun ignored; the fist lit past its gears\' leaving; an Echo on the Remnant\'s wind-up)', () => {
  assert.deepEqual([...SD_TELLS], ['stomp', 'hand', 'volley', 'pulse', 'reset']);
  assert.deepEqual([...SD_TELL_HEAT], [0.1, 0.6]);
  const at = T0 + 10_000, tells = (s, t, who = -1) => [...sdTellsAt(s, who, t)];
  const share = (A, k, w = A.windup) => at - w + k * w;
  // the heats' edges, on the Reset's long wind-up
  const edge = fight({ ph: 3, rem: { ...fight().rem, atk: blowAt(SD_BLOWS.reset, at, { i: 8 }) } });
  assert.deepEqual([0.099, 0.101, 0.599, 0.601].map((k) => tells(edge, share(SD_BLOWS.reset, k))[4]), [0, 1, 1, 2], 'mid from a tenth, hot from three fifths');
  // the Stomp: the lab's ?fight=stomp&wt=0.8 - its sole hot
  const st = fight({ rem: { ...fight().rem, atk: blowAt(SD_BLOWS.stomp, at) } });
  assert.deepEqual([0.05, 0.3, 0.8].map((k) => tells(st, share(SD_BLOWS.stomp, k))[0]), [0, 1, 2]);
  assert.deepEqual([at + SD_TELL_AFTER_MS.stomp - 1, at + SD_TELL_AFTER_MS.stomp].map((t) => tells(st, t)[0]), [2, 0], 'hot through its landing\'s first moment');
  assert.deepEqual(tells(st, share(SD_BLOWS.stomp, 0.8)), [2, 0, 0, 0, 0], 'the sole alone');
  assert.deepEqual(tells(st, at - SD_BLOWS.stomp.windup - 1), [0, 0, 0, 0, 0], 'nothing before its wind-up');
  // the Hour-Hand: the lab's ?fight=hand&wt=0.5 - half heated; hot through its sweep
  const hd = fight({ rem: { ...fight().rem, atk: blowAt(SD_BLOWS.hand, at, { sw: 1 }) } });
  assert.deepEqual([0.5, 0.95].map((k) => tells(hd, share(SD_BLOWS.hand, k))[1]), [1, 2]);
  assert.deepEqual([at + SD_BLOWS.hand.active - 1, at + SD_BLOWS.hand.active].map((t) => tells(hd, t)[1]), [2, 0], 'through its sweep, then cold');
  // the Volley: its fist while it gathers, cold as its gears leave its hands
  const vw = SD_BLOWS.volley.windup, go = at - gearFlightOf(vw), vo = fight({ rem: { ...fight().rem, atk: blowAt(SD_BLOWS.volley, at, { tg: [[1, 1]] }) } });
  assert.deepEqual([at - vw + 0.5 * (go - (at - vw)), go - 1, go].map((t) => tells(vo, t)[2]), [1, 2, 0]);
  // the Pulse: the clock's, on every body standing - the Remnant's ribs, and an Echo's in the Break
  const pu = (o) => fight({ clk: { a: SD_BLOWS.pulse.id, at, i: 7 }, ...o });
  assert.deepEqual([0.3, 0.9].map((k) => tells(pu(), share(SD_BLOWS.pulse, k))[3]), [1, 2]);
  assert.deepEqual([at + SD_TELL_AFTER_MS.pulse - 1, at + SD_TELL_AFTER_MS.pulse].map((t) => tells(pu(), t)[3]), [2, 0]);
  const brk = pu({ ph: 2, ec: echoes() });
  assert.deepEqual([tells(brk, at - 100, 0)[3], tells(brk, at - 100, 1)[3], tells(brk, at - 100, -1)[3]], [2, 2, 0], 'the Echoes\' ribs; none outside time');
  assert.equal(tells(pu({ ph: 2, ec: echoes({ h: 0, dn: T0 }) }), at - 100, 0)[3], 0, 'none on a broken Echo');
  // the Reset: its heart; none stunned - the blow broken
  const rs = fight({ ph: 3, rem: { ...fight().rem, atk: blowAt(SD_BLOWS.reset, at, { i: 8 }) } });
  assert.deepEqual([0.3, 0.7].map((k) => tells(rs, share(SD_BLOWS.reset, k))[4]), [1, 2]);
  assert.deepEqual(tells({ ...rs, su: at + 1 }, share(SD_BLOWS.reset, 0.7)), [0, 0, 0, 0, 0], 'stunned: nothing');
  assert.deepEqual(tells({ ...st, fell: { at: T0, top: [], n: 0 } }, share(SD_BLOWS.stomp, 0.8)), [0, 0, 0, 0, 0], 'fallen: nothing');
  // an Echo's Stomp on its own wind-up (the Echoes' quicker - SD_FAST)
  const ew = windupFor(SD_BLOWS.stomp, 2, SD_BODY.gold);
  assert.ok(ew < SD_BLOWS.stomp.windup);
  const es = fight({ ph: 2, ec: echoes({ atk: blowAt(SD_BLOWS.stomp, at) }) });
  assert.deepEqual([0.05, 0.55, 0.65].map((k) => tells(es, share(SD_BLOWS.stomp, k, ew), 0)[0]), [0, 1, 2], 'its heats by its own wind-up');
});

test('SD-LOOK S8 ONLY THE PART THAT TELLS LIGHTS (the scene): each telling part drawn with a remap of its metal\'s cold atlas to its heat - the right leg (the one the Stomp raises), the blade\'s arm, the fist\'s arm, the torso (its ribs by the Pulse, its heart white by the Reset - mid the Reset\'s soul-white, hot the moment\'s white-gold - and the husk once torn out); every other part the dungeon\'s (no remap); an Echo\'s in its own metal (mutants: the left leg remapped; the torso\'s two tells one; the husk never shown)', () => {
  const at = T0 + 10_000, w = SD_BLOWS.stomp.windup, ending = SD_ENDINGS[1].id, hr = heartRecordOf(ending);
  const st = fight({ rem: { ...fight().rem, atk: blowAt(SD_BLOWS.stomp, at) } });
  const s = set(st, ending), B = SD_REMNANT_TELL_RECORD.brass, cold = key(SD_REMNANT_ARCHIVE, B[0]);
  s.at(at - 0.2 * w);
  const remaps = () => s.parts(0).map((d) => (d.texRemap ? [...d.texRemap] : null));
  assert.deepEqual(remaps(), [[[cold, key(SD_REMNANT_ARCHIVE, B[2])]], null, null, null, null, null], 'the Stomp: its right leg hot, nothing else');
  s.at(at - 0.7 * w);
  assert.deepEqual(remaps(), [[[cold, key(SD_REMNANT_ARCHIVE, B[1])]], null, null, null, null, null], 'mid earlier');
  s.at(at - 0.5 * SD_BLOWS.hand.windup, fight({ rem: { ...fight().rem, atk: blowAt(SD_BLOWS.hand, at, { sw: 1 }) } }));
  assert.deepEqual(remaps(), [null, null, null, null, [[cold, key(SD_REMNANT_ARCHIVE, B[1])]], null], 'the Hour-Hand: its blade\'s arm, mid');
  s.at(at - gearFlightOf(SD_BLOWS.volley.windup) - 10, fight({ rem: { ...fight().rem, atk: blowAt(SD_BLOWS.volley, at, { tg: [[1, 1]] }) } }));
  assert.deepEqual(remaps(), [null, null, null, null, null, [[cold, key(SD_REMNANT_ARCHIVE, B[2])]]], 'the Volley: its fist\'s arm');
  // the torso: the Pulse's ribs and the Reset's heart at once
  const both = (kp, kr) => fight({ ph: 3, clk: { a: SD_BLOWS.pulse.id, at: at + (1 - kp) * SD_BLOWS.pulse.windup, i: 7 }, rem: { ...fight().rem, atk: blowAt(SD_BLOWS.reset, at + (1 - kr) * SD_BLOWS.reset.windup, { i: 8 }) } });
  s.at(at, both(0.9, 0.3));
  assert.deepEqual(remaps()[2], [[cold, key(SD_REMNANT_ARCHIVE, B[2])], [key(SD_REALM_ARCHIVE, hr), key(SD_REMNANT_ARCHIVE, SD_REMNANT_WHITE_RECORD[0])]], 'ribs hot, heart soul-white');
  s.at(at, both(0.3, 0.9));
  assert.deepEqual(remaps()[2], [[cold, key(SD_REMNANT_ARCHIVE, B[1])], [key(SD_REALM_ARCHIVE, hr), key(SD_REMNANT_ARCHIVE, SD_REMNANT_WHITE_RECORD[1])]], 'ribs mid, heart white-gold');
  s.at(at, both(0.05, 0.05));
  assert.deepEqual(remaps(), [null, null, null, null, null, null], 'cold');
  s.at(at + 400, fight({ fell: { at, top: [], n: 0 } }));
  assert.deepEqual(remaps()[2], [[key(SD_REALM_ARCHIVE, hr), key(SD_REMNANT_ARCHIVE, SD_REMNANT_HUSK_RECORD)]], 'torn out: the husk');
  // an Echo's in its own metal
  const G = SD_REMNANT_TELL_RECORD.gold;
  s.at(at - 0.2 * windupFor(SD_BLOWS.stomp, 2, SD_BODY.gold), fight({ ph: 2, ec: echoes({ atk: blowAt(SD_BLOWS.stomp, at) }) }));
  assert.deepEqual(s.parts(1)[0].texRemap ? [...s.parts(1)[0].texRemap] : null, [[key(SD_REMNANT_ARCHIVE, G[0]), key(SD_REMNANT_ARCHIVE, G[2])]], 'gold\'s own atlas');
  assert.equal(s.parts(2)[0].texRemap, null, 'silver\'s still');
});

test('SD-LOOK S8 THE VOLLEY\'S GEARS FORM IN ITS HANDS (sdGatherGearsAt; the stretch tell): through its gather a gear grows in each hand, spinning, whole as they leave it - none before its wind-up, none from the moment they fly (the flight\'s own), an Echo\'s by its own wind-up, none stunned, outside time or broken; the scene stands each at its body\'s DRAWN hand, at its size, hot in the Volley\'s colour (its own record), and the gears in flight cold (mutants: the gears whole at once; forming past their leaving; forming cold; each at the other hand)', () => {
  const at = T0 + 10_000, w = SD_BLOWS.volley.windup, go = at - gearFlightOf(w), t0 = at - w;
  const vo = fight({ rem: { ...fight().rem, atk: blowAt(SD_BLOWS.volley, at, { tg: [[3, 3], [-4, 2]] }) } });
  const mid = t0 + (go - t0) / 2;
  assert.deepEqual(sdGatherGearsAt(vo, t0 - 1), [], 'nothing before its wind-up');
  const g = sdGatherGearsAt(vo, mid);
  assert.deepEqual(g.map((q) => [q.who, q.h, +q.k.toFixed(6)]), [[-1, 0, 0.5], [-1, 1, 0.5]], 'one in each hand, half grown');
  assert.ok(sdGatherGearsAt(vo, go - 1).every((q) => q.k > 0.99), 'whole as they leave');
  assert.deepEqual([sdGatherGearsAt(vo, go).length, sdGatherGearsAt({ ...vo, su: at + 5000 }, mid).length, sdGatherGearsAt({ ...vo, ph: 2 }, mid).length], [0, 0, 0], 'none flying, stunned or outside time');
  const ew = windupFor(SD_BLOWS.volley, 2, SD_BODY.gold), ego = at - gearFlightOf(ew), ev = fight({ ph: 2, ec: echoes({ atk: blowAt(SD_BLOWS.volley, at, { tg: [[1, 1]] }) }) });
  assert.deepEqual(sdGatherGearsAt(ev, (at - ew + ego) / 2).map((q) => [q.who, +q.k.toFixed(6)]), [[0, 0.5], [0, 0.5]], 'an Echo\'s by its own wind-up');
  assert.equal(sdGatherGearsAt(fight({ ph: 2, ec: echoes({ atk: blowAt(SD_BLOWS.volley, at), h: 0, dn: T0 }) }), (at - ew + ego) / 2).length, 0, 'none on a broken Echo');
  // the scene: after the flying ones, at the drawn hands
  const s = set(vo), H = 3 + SD_HEARTS[1], gears = s.draws.slice(H + 3 * SD_RIG_PARTS.length, H + 3 * SD_RIG_PARTS.length + SD_GEAR_DRAWS);
  s.at(mid);
  const shown = gears.filter((d) => !d.hidden);
  assert.equal(shown.length, 2);
  shown.forEach((d, h) => {
    const arm = s.parts(0)[4 + h].object.matrix, p = SD_REM_HAND[h], want = [0, 1, 2].map((k) => arm[k] * p[0] + arm[4 + k] * p[1] + arm[8 + k] * p[2] + arm[12 + k]);
    assert.ok([12, 13, 14].every((i, k) => near(d.object.matrix[i], want[k], 1e-4)), `gear ${h} at its drawn hand`);
    assert.ok(near(Math.hypot(d.object.matrix[0], d.object.matrix[1], d.object.matrix[2]), 0.5, 1e-5), 'at its size');
    assert.deepEqual([...d.texRemap], [[key(SD_REALM_ARCHIVE, SD_REALM_BRASS_RECORD), key(SD_REMNANT_ARCHIVE, SD_REMNANT_GATHER_RECORD)]], 'hot in the Volley\'s colour');
  });
  s.at(go + 10);
  assert.ok(gears.filter((d) => !d.hidden).length === 2 && gears.filter((d) => !d.hidden).every((d) => d.texRemap === null), 'in flight: cold');
  const art = remnantLookArt(SD_BLOW_COLOR).find(([r]) => r === SD_REMNANT_GATHER_RECORD)[1], e = texel(art.emission, 3, 1);
  assert.ok(e.every((v, i) => Math.abs(v - Math.round(Math.round(SD_BLOW_COLOR.volley[i] * 255) * SD_GATHER_GLOW * 0.8)) <= 1), 'the Volley\'s colour');
});

// ── the back-dial ──────────────────────────────────────────────────────────────────────────────────────────────────

test('SD-LOOK S8 THE BACK-DIAL (world/sdRemnantModel.js): behind the shoulders, clear of the body\'s back, its teeth\'s tips at the law\'s radius, wholly above 2 m (nothing under 2 m past the law), its hours on its back face (facing -z) - u once round CLOCKWISE from XII as that face is seen, +x the screen\'s right from behind through the camera\'s one mirror (world/mat4.js); the hours the sky\'s own glyphs, tops outward; its teeth\'s fronts the rim line (the ambient rung) so from the front its rim haloes the head (mutants: the hours mirrored; the hours inward)', () => {
  const D = SD_REMNANT_DIAL;
  for (const metal of ['brass', 'gold', 'silver']) {
    const m = buildBackDialModel(metal), V = vertsOf(m);
    assert.ok(V.every((v) => v[1] > 2), 'wholly above 2 m');
    assert.ok(near(Math.max(...V.map((v) => Math.hypot(v[0], v[1] - D.y))), D.r, 1e-5), 'its teeth at the law\'s radius');
    const torso = vertsOf(buildRemnantParts(metal)[3]);
    assert.ok(Math.max(...V.map((v) => v[2])) < Math.min(...torso.map((v) => v[2])), 'behind the body\'s back');
    const sm = subOf(m, SD_REMNANT_ARCHIVE, SD_REMNANT_DIAL_RECORD[metal]);
    const C = cornersOf(m, sm);
    for (const c of C) {
      assert.ok(near(c.n[2], -1, 1e-6), 'its hours face -z');
      const r = Math.hypot(c.p[0], c.p[1] - D.y), a = Math.atan2(c.p[0], c.p[1] - D.y) / TAU, u = ((a % 1) + 1) % 1;
      assert.ok(near(c.uv[0] % 1, u, 1e-5) || near(c.uv[0], 1, 1e-5) && near(u, 0, 1e-5), `u clockwise from XII (${c.uv[0]} at ${u})`);
      assert.ok(near(c.uv[1], (r - D.ring) / (D.rim - D.ring), 1e-5), 'v outward');
    }
    assert.ok(subOf(m, SD_REMNANT_ARCHIVE, SD_REMNANT_RIM_RECORD[metal]), 'its rim line');
  }
  // the hours: each numeral's glyph centred on its hour, its top row outward (the strip's high rows)
  const art = remnantDialArt('brass'), { w: W, h: H } = SD_DIAL_ART, lit = (x, y) => { const c = texel(art.albedo, ((x % W) + W) % W, y); return c[0] > 150; };
  SD_HOUR_NUMERALS.forEach((s, k) => {
    const left = Math.round((k / 12) * W) - Math.floor(numeralWidth(s) / 2);
    for (let cy = 0; cy < 7; cy++) for (let c = 0; c < numeralWidth(s); c++) assert.equal(lit(left + c, H - 6 - cy), numeralCell(s, c, cy), `${s}'s cell ${c},${cy}`);
  });
  const rim = remnantLookArt(SD_BLOW_COLOR).find(([r]) => r === SD_REMNANT_RIM_RECORD.brass)[1];
  const e = texel(rim.emission, 0, 0), a = texel(rim.albedo, 0, 0);
  assert.ok(e.every((v, i) => Math.abs(v - Math.round(a[i] * SD_DIAL_RIM_GLOW)) <= 1) && SD_DIAL_RIM_GLOW <= 0.45, 'the ambient rung');
  // through the camera's one mirror: from behind the Remnant (stood facing the way in), III stands on the screen's right
  const base = remnantMatrix(SD_REALM_ORIGIN[0] + SD_ARENA.x, 0, SD_REALM_ORIGIN[2] + SD_ARENA.z + 8, Math.PI);
  const world = (m, p) => [0, 1, 2].map((k) => m[k] * p[0] + m[4 + k] * p[1] + m[8 + k] * p[2] + m[12 + k]);
  const centre = world(base, [0, D.y, D.z]), eye = [centre[0], centre[1], centre[2] + 12];
  const view = lookAt(eye, centre, [0, 1, 0]), proj = mirrorProjectionX(perspective(1.1, 16 / 9, 0.1, 100)), VP = mul4(new Float64Array(16), proj, view);
  const screenX = (p) => { const c = [0, 1, 3].map((k) => VP[k] * p[0] + VP[4 + k] * p[1] + VP[8 + k] * p[2] + VP[12 + k]); return c[0] / c[2]; };
  const at = (turn) => world(base, [Math.sin(turn) * D.ring, D.y + Math.cos(turn) * D.ring, D.z]);
  assert.ok(screenX(at(Math.PI / 2)) > 0.1 && screenX(at(-Math.PI / 2)) < -0.1, 'III on the right, IX on the left, seen from behind');
});

test('SD-LOOK S8 THE DIAL\'S HAND (sdDialHandAt, dialHandMatrix): the Hour\'s hands run BACK - at rest it ticks back a minute each second on the escapement and holds; stunned an EMBER hand runs the stun\'s 8 s back to XII (the lab\'s ?fight=stun&st=4: at VI); the Reset spins it back three turns to XII as it lands, white; in the Break the living Echo\'s runs its fallen partner\'s window back to XII in the partner\'s metal (the Blades\' 10 s); the Hour-Hand spins it up whole turns, so it ends on its tick; past the fall it stands; the matrix turns it clockwise for a turn growing, as seen from behind (mutants: the tick forward; the stun\'s hand forward; the window\'s metals crossed; the marks\' window unread; the spin-up not whole turns; the matrix\'s turn reversed)', () => {
  const hand = (s, t, who = -1) => [...sdDialHandAt(s, who, t)];
  const s0 = fight(), t1 = T0 + 7000;
  const wrap = (a) => ((a % TAU) + TAU + Math.PI) % TAU - Math.PI;
  assert.ok(near(wrap(hand(s0, t1 + 1000)[0] - hand(s0, t1)[0]), -TAU / 60, 1e-9), 'a minute back each second');
  assert.ok(near(hand(s0, t1 + 400)[0], hand(s0, t1 + 990)[0], 1e-12) && near(hand(s0, t1 + 100)[0], (-TAU / 60) * (sdTick((t1 + 100) / 1000) % 60), 1e-12), 'held between ticks, on the escapement');
  assert.equal(hand(s0, t1)[1], SD_DIAL_LOOK.indexOf('cold'));
  // stunned: the ember hand halfway (VI) at 4 s of its 8, at XII as it ends
  const su = t1 + 4000, sd = fight({ ph: 3, su });
  assert.deepEqual(hand(sd, t1).map((v) => +v.toFixed(9)), [+Math.PI.toFixed(9), SD_DIAL_LOOK.indexOf('ember')]);
  assert.ok(near(hand(sd, su - SD_STUN_MS + 1)[0], TAU, 1e-3) && near(hand(sd, su - 1)[0], 0, 1e-3), 'a turn back to XII over its 8 s');
  assert.equal(hand(sd, su)[1], 0, 'cold again as it rises');
  // the Reset: three turns back to XII, white
  const rw = SD_BLOWS.reset.windup, ra = t1 + 3000, rs = fight({ ph: 3, rem: { ...fight().rem, atk: blowAt(SD_BLOWS.reset, ra, { i: 8 }) } });
  assert.ok(near(hand(rs, ra - rw)[0], TAU * SD_DIAL_TURNS.reset, 1e-9) && near(hand(rs, ra - rw / 2)[0], TAU * SD_DIAL_TURNS.reset / 2, 1e-9) && near(hand(rs, ra - 1)[0], 0, 1e-2), 'spun back to XII as it lands');
  assert.equal(hand(rs, ra - 1)[1], SD_DIAL_LOOK.indexOf('white'));
  assert.equal(hand({ ...rs, su: ra + 1000 }, ra - 1)[1], SD_DIAL_LOOK.indexOf('ember'), 'a stun breaks it');
  // the Break: silver fallen 5 s ago - gold's hand on silver's window, silver's own ticking
  const dn = t1 - 5000, br = fight({ ph: 2, ec: echoes({}, { h: 0, dn }) });
  assert.ok(near(hand(br, t1, 0)[0], (TAU * (SD_ECHO_PAIR_MS - 5000)) / SD_ECHO_PAIR_MS, 1e-9) && hand(br, t1, 0)[1] === SD_DIAL_LOOK.indexOf('silver'), 'gold runs silver\'s window, in silver');
  assert.equal(hand(br, t1, 1)[1], 0, 'the fallen\'s own cold');
  assert.equal(hand(fight({ ph: 2, ec: echoes({ h: 0, dn }) }), t1, 1)[1], SD_DIAL_LOOK.indexOf('gold'), 'silver runs gold\'s, in gold');
  assert.equal(hand(br, dn + SD_ECHO_PAIR_MS, 0)[1], 0, 'at XII it rises: cold again');
  const blades = { ...br, mk: ['blades', 'twin', 'short'] };
  assert.ok(near(hand(blades, t1, 0)[0], (TAU * 5000) / 10_000, 1e-9), 'the Blades\' 10 s');
  // the Hour-Hand: spun up, behind its tick, ending on it
  const hw = SD_BLOWS.hand.windup, ha = t1 + 2000, hs = fight({ rem: { ...fight().rem, atk: blowAt(SD_BLOWS.hand, ha, { sw: 1 }) } }), end = ha + SD_BLOWS.hand.active;
  assert.ok(hand(hs, ha)[0] < hand(s0, ha)[0] - 1, 'spun up');
  assert.ok(near(((hand(hs, end - 1)[0] - hand(s0, end - 1)[0]) % TAU + TAU) % TAU, 0, 1e-2) || near(((hand(hs, end - 1)[0] - hand(s0, end - 1)[0]) % TAU + TAU) % TAU, TAU, 1e-2), 'whole turns: it ends on its tick');
  assert.ok(near(hand(hs, ha - hw)[0], hand(s0, ha - hw)[0], 1e-9), 'and begins on it');
  // past the fall it stands
  const fl = fight({ fell: { at: t1, top: [], n: 0 } });
  assert.ok(near(hand(fl, t1 + 3000)[0], hand(s0, t1)[0], 1e-12), 'stood as it fell');
  // the matrix: a turn growing goes clockwise as the dial's back is seen (+x the screen's right from behind)
  const I = new Float32Array(16); I[0] = I[5] = I[10] = I[15] = 1;
  const tip = (turn) => { const m = dialHandMatrix(I, Float64Array.of(turn, 0), new Float32Array(16)), p = [0, SD_REMNANT_DIAL.y + 1, 0]; return [m[0] * p[0] + m[4] * p[1] + m[12], m[1] * p[0] + m[5] * p[1] + m[13]]; };
  assert.ok(near(tip(0)[0], 0, 1e-6) && near(tip(0)[1], SD_REMNANT_DIAL.y + 1, 1e-6), 'XII up');
  assert.ok(near(tip(Math.PI / 2)[0], 1, 1e-6) && near(tip(Math.PI / 2)[1], SD_REMNANT_DIAL.y, 1e-6), 'III at +x');
});

// ── the rib lamps ──────────────────────────────────────────────────────────────────────────────────────────────────

test('SD-LOOK S8 THE RIB LAMPS COUNT THE HEARTS (sdRibLampsLit): one lit for each Heart standing while the Reset winds up - out as each breaks, none past its landing, none with no Reset or past the fall; eight lamps at the ribs\' front ends from the bottom up, lamp n sampling cell n of a strip whose n-lit picture lights the lowest n (the lab\'s ?fight=reset&hearts=5: five) - drawn with that remap (mutants: a broken Heart counted; the strip lit from the top; the count unread)', () => {
  const ra = T0 + 6000, cx = (n, broke = 0) => ({ i: 8, m: 60, c: Array.from({ length: n }, (_, k) => [k, 10, k < broke ? 0 : 60]) });
  const rs = (n, broke) => fight({ ph: 3, cx: cx(n, broke), rem: { ...fight().rem, atk: blowAt(SD_BLOWS.reset, ra, { i: 8 }) } });
  assert.deepEqual([sdRibLampsLit(rs(5, 0), ra - 4000), sdRibLampsLit(rs(5, 2), ra - 4000), sdRibLampsLit(rs(8, 0), ra - 1), sdRibLampsLit(rs(5, 0), ra)], [5, 3, 8, 0]);
  assert.equal(sdRibLampsLit(fight(), ra - 4000), 0, 'no Reset');
  assert.equal(sdRibLampsLit({ ...rs(5, 0), fell: { at: T0, top: [], n: 0 } }, ra - 4000), 0, 'past the fall');
  const at = Array.from({ length: 8 }, (_, n) => ribLampAt(n));
  for (let n = 0; n < 8; n++) {
    assert.equal(Math.sign(at[n][0]), n % 2 ? 1 : -1, 'each row its left then its right');
    if (n >= 2) assert.ok(at[n][1] > at[n - 2][1], 'from the bottom up');
  }
  const m = buildRibLampsModel(), C = cornersOf(m, m.subMeshes[0]), { w: W, h: H } = SD_LAMP_ART;
  assert.equal(m.subMeshes.length, 1);
  for (const c of C) {
    const n = at.findIndex((p) => Math.hypot(p[0] - c.p[0], p[1] - c.p[1], p[2] - c.p[2]) < 0.2), cell = Math.floor(c.uv[0] * W / (W / 8));
    assert.equal(cell, n, 'lamp n samples cell n');
    assert.ok(c.uv[1] > 0 && c.uv[1] < 1);
  }
  for (let n = 0; n <= 8; n++) {
    const art = remnantLampArt(n);
    for (let x = 0; x < W; x++) assert.equal(texel(art.emission, x, 2).some((v) => v > 0), Math.floor(x / (W / 8)) < n, `${n} lit: cell ${Math.floor(x / (W / 8))}`);
    assert.equal(art.albedo.height, H);
  }
  const s = set(rs(5, 1)), lamps = s.decor('lamps');
  s.at(ra - 4000);
  assert.deepEqual(lamps.hidden ? null : [...lamps.texRemap], [[key(SD_REMNANT_ARCHIVE, SD_REMNANT_LAMP_RECORD[0]), key(SD_REMNANT_ARCHIVE, SD_REMNANT_LAMP_RECORD[4])]], 'four lit');
  assert.deepEqual([...lamps.object.matrix], [...s.parts(0)[2].object.matrix], 'on its torso');
  s.at(ra + 100);
  assert.equal(lamps.texRemap, null, 'all out');
});

// ── the fall ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('SD-LOOK S8 THE FALL (dialFallMatrix, heartFallMatrix): the back-dial breaks free where it stood - drops to its rim, ROLLS (never slides: the rim\'s point on the floor stands still) toward the body\'s right, stops at 2 s three metres on, topples onto its back (the hours up) and sinks away by 4 s; the heart torn out rises 3 m over 1.2 s, spinning, and is gone (mutants: the dial sliding; the topple the other way; the heart never gone)', () => {
  const D = SD_REMNANT_DIAL, F = SD_FALL_DECOR, base = remnantMatrix(10, 0, -4, 0.7), out = new Float32Array(16), dial = vertsOf(buildBackDialModel('brass'));
  const world = (m, p) => [0, 1, 2].map((k) => m[k] * p[0] + m[4 + k] * p[1] + m[8 + k] * p[2] + m[12 + k]);
  const FELL = { at: T0, top: [], n: 0 };
  const local = (sec, p) => { const m = dialFallMatrix(remnantMatrix(0, 0, 0, 0), FELL, T0 + sec * 1000, new Float32Array(16)); return m ? world(m, p) : null; };
  // at its breaking free: where it stood
  dialFallMatrix(base, FELL, T0, out);
  assert.ok(world(out, [0, D.y, D.z]).every((v, k) => near(v, world(base, [0, D.y, D.z])[k], 1e-4)), 'where it stood');
  // rolling on its rim by 1.5 s: its lowest point on the floor, its plane upright, its rim's floor point still
  const lowAt = (age) => dial.reduce((o, p) => { const w = local(age, p); return w[1] < o.w[1] ? { p, w } : o; }, { p: null, w: [0, Infinity, 0] });
  const lo = lowAt(1.5);
  assert.ok(near(lo.w[1], 0, 0.02), `on its rim: ${lo.w[1]}`);
  const e = 0.004, a = local(1.5 - e, lo.p), b = local(1.5 + e, lo.p), c = local(1.5 + e, [0, D.y, D.z]), c0 = local(1.5 - e, [0, D.y, D.z]);
  assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.2 * Math.hypot(c[0] - c0[0], c[1] - c0[1]), 'rolling, never sliding');
  assert.ok(c[0] - c0[0] > 0, 'toward its right (+x)');
  // stopped at 2 s, three metres on; toppled onto its back by 2.5 s - the hours face up
  assert.ok(near(local(F.rollS, [0, D.y, D.z])[0], F.roll, 1e-4) && near(local(F.rollS + 0.2, [0, D.y, D.z])[0], F.roll, 1e-4), 'stopped three metres on');
  const n = (age) => { const p0 = local(age, [0, D.y, D.z - 1]), p1 = local(age, [0, D.y, D.z]); return [p0[0] - p1[0], p0[1] - p1[1], p0[2] - p1[2]]; };
  assert.ok(near(n(F.rollS + F.toppleS)[1], 1, 1e-4), 'the hours up');
  assert.ok(local(F.rollS + F.toppleS + 0.2, [0, D.y, D.z])[1] < local(F.rollS + F.toppleS, [0, D.y, D.z])[1], 'sinking');
  assert.equal(dialFallMatrix(base, FELL, T0 + F.sinkS * 1000, out), null, 'gone by 4 s');
  // the heart: out of the cage, 3 m up over 1.2 s, spinning, gone
  const h = (age) => heartFallMatrix(remnantMatrix(0, 0, 0, 0), FELL, T0 + age, new Float32Array(16));
  assert.ok(near(h(0)[13], SD_REMNANT_BODY.heartY) && near(h(F.riseS * 1000 - 1)[13], SD_REMNANT_BODY.heartY + F.rise, 1e-3), 'risen 3 m');
  assert.ok(Math.abs(Math.atan2(h(600)[8], h(600)[0])) > 0.1, 'spinning');
  assert.equal(h(F.riseS * 1000), null, 'gone into the way home');
  assert.ok(buildTornHeartModel().subMeshes.every((sm) => sm.textureRecord === heartRecordOf(null)) && buildTornHeartModel('sentinel').subMeshes[0].textureRecord === heartRecordOf('sentinel'), 'in its Ending\'s light');
});

test('SD-LOOK S8 THE FALL ON THE PAGE, AND A LATE PAGE: at `fell.at` the heart torn out stands over the cage (its light with it, then out), the cage\'s heart the husk, the dial free and rolling - every one a pure function of the fight, so a page that first frames it 1.6 s into the fall shows what a page that framed it through shows; the Remnant\'s decor hidden with it outside time (mutants: the light left in the fallen cage; the decor kept outside time)', () => {
  const at = T0 + 20_000, fl = fight({ fell: { at, top: [], n: 0 } });
  const a = set(fight()), b = set(fl);
  for (let t = at - 200; t <= at + 1600; t += 100) a.at(t, t >= at ? fl : fight());
  b.at(at + 1600);
  for (const name of ['dial', 'hand', 'torn']) assert.deepEqual([a.decor(name).hidden, [...a.decor(name).object.matrix]], [b.decor(name).hidden, [...b.decor(name).object.matrix]], `${name}: the same late`);
  assert.equal(a.decor('torn').hidden, true, 'the heart gone past 1.2 s');
  const want = dialFallMatrix(remnantMatrix(SD_REALM_ORIGIN[0] + SD_ARENA.x + SD_REM_START[0], 0, SD_REALM_ORIGIN[2] + SD_ARENA.z + SD_REM_START[1], Math.PI), fl.fell, at + 1600, new Float32Array(16));
  assert.ok([...b.decor('dial').object.matrix].every((v, i) => near(v, want[i], 1e-4)), 'the dial where the law of its roll has it');
  // the heart torn out and its light
  const c = set(fl);
  c.at(at + 600);
  const torn = c.decor('torn'), L = c.rem.lights();
  assert.equal(torn.hidden, false);
  assert.equal(L.length, 1);
  assert.ok(near(L[0].y, torn.object.matrix[13], 1e-4) && L[0].y > SD_REMNANT_BODY.heartY, 'its light rising with it');
  c.at(at + 1300);
  assert.equal(c.rem.lights().length, 0, 'and out');
  // outside time: hidden with its body
  const d = set(fight());
  d.at(T0);
  assert.ok(!d.decor('dial').hidden && !d.decor('hand').hidden && !d.decor('lamps').hidden && d.decor('torn').hidden, 'standing: its dial, hand and lamps');
  d.at(T0 + 100, fight({ ph: 2, ec: echoes() }));
  for (const name of ['dial', 'hand', 'lamps']) assert.ok(d.decor(name).hidden && d.decor(name).object.matrix.every((v) => v === 0), `${name} gone outside time`);
  assert.ok(!d.decor('dial', 1).hidden && !d.decor('hand', 2).hidden, 'the Echoes\' own');
});

test('SD-LOOK S8 NOTHING THAT TURNS CASTS: every decor draw (the dials, their hands, the lamps, the heart torn out) is drawn noShadow; the bodies\' parts keep their shadow; every mesh the decor made is freed with the set; the Remnant\'s own archive uploaded once, every picture white (its own light) (mutants: a dial casting; the archive uploaded as a window\'s)', () => {
  const up = [], made = [], freed = [];
  const r = { createMesh: (m) => { made.push(m); return { id: made.length }; }, destroyMesh: (m) => freed.push(m), uploadTexture: (a, rec) => up.push(['t', a, rec]), uploadEmissionTexture: (a, rec, img, o) => up.push(['e', a, rec, o]) };
  const rem = createSdRemnant({ renderer: r }), draws = [];
  rem.stand({ dynamicDraws: draws });
  const D = 3 + SD_HEARTS[1] + 3 * SD_RIG_PARTS.length + SD_GEAR_DRAWS;
  assert.equal(draws.length, D + SD_DECOR_DRAWS.length);
  assert.ok(draws.slice(D).every((d) => d.noShadow === true), 'the decor casts nothing');
  assert.ok(draws.slice(0, D).every((d) => !d.noShadow), 'the bodies cast');
  rem.clear();
  assert.equal(freed.length, made.length, 'every mesh freed');
  const mine = up.filter((u) => u[1] === SD_REMNANT_ARCHIVE);
  const recs = remnantLookArt(SD_BLOW_COLOR).map(([rec]) => rec);
  assert.deepEqual(mine.filter((u) => u[0] === 't').map((u) => u[2]), recs, 'every picture of its archive');
  assert.ok(mine.filter((u) => u[0] === 'e').every((u) => u[3]?.white === true) && mine.filter((u) => u[0] === 'e').length === recs.length, 'each its own light');
  assert.ok(recs.every((rec) => rec >= 100) && new Set(recs).size === recs.length, 'records from 100, each once');
  assert.ok(remnantArt().every(([rec]) => rec < 100) && realmArt().every(([rec]) => rec < 100), 'the Hour\'s archive\'s below');
  const n = up.length;
  ensureSdRemnantArt(r);
  assert.equal(up.length, n, 'once a renderer');
  assert.deepEqual(Object.values(SD_REMNANT_HAND_RECORD).length, SD_DIAL_LOOK.length);
  assert.equal(SD_REMNANT_TELL_RECORD.brass.length, 3);
  assert.equal(new Set([...Object.values(SD_REMNANT_TELL_RECORD).flat(), ...SD_REMNANT_WHITE_RECORD, SD_REMNANT_HUSK_RECORD, ...Object.values(SD_REMNANT_DIAL_RECORD), ...Object.values(SD_REMNANT_HAND_RECORD), ...SD_REMNANT_LAMP_RECORD, ...Object.values(SD_REMNANT_RIM_RECORD), SD_REMNANT_GATHER_RECORD]).size, recs.length);
  assert.notEqual(SD_REALM_BRASS_RECORD, SD_REMNANT_TELL_RECORD.brass[0]);
  assert.ok(buildDialHandModel().subMeshes.every((sm) => sm.textureArchive === SD_REMNANT_ARCHIVE && sm.textureRecord === SD_REMNANT_HAND_RECORD.cold));
});

test('SD-LOOK S8 THE FIGHT\'S FRAME MAKES NOTHING (AUDIT SD II L2 F9\'s measure): through a Stomp winding up, the Hour-Hand\'s sweep, a Pulse, a stun, a Reset with its Hearts, the Break\'s window, an Echo\'s Stomp and the fall, each body\'s tells, its dial\'s hand, the lamps\' count and the decor\'s matrices; the heart\'s light in each (its list filled in place - a list set to nought let its store go, 280 bytes a frame); the whole frame stunned and in the window - none past 2 bytes a frame against a control that must show (mutants: the tells\' scratch given up for a fresh one; the light\'s list emptied and pushed)', () => {
  const url = (p) => JSON.stringify(pathToFileURL(join(ROOT, p)).href);
  const script = `
    const { createSdRemnant, sdTellsAt, sdDialHandAt, sdRibLampsLit } = await import(${url('src/scenes/sdRemnant.js')});
    const { dialHandMatrix, dialFallMatrix, heartFallMatrix } = await import(${url('src/scenes/sdRemnantRig.js')});
    const { remnantMatrix } = await import(${url('src/world/sdRemnantModel.js')});
    const { SD_FIGHT_EMPTY } = await import(${url('src/net/sdFightLink.js')});
    const { SD_BLOWS } = await import(${url('src/net/sdRemnant.js')});
    const renderer = { createMesh: () => ({}), destroyMesh() {}, uploadTexture() {}, uploadEmissionTexture() {} };
    const T0 = ${T0}, clock = Array.from({ length: 4096 }, (_, k) => T0 + 2000 + k * 0.5); clock.push('tagged');
    let k = 0;
    const tick = () => clock[(k = (k + 1) & 4095)];
    const bytes = (fn) => {
      for (let f = 0; f < 20000; f++) fn();
      let least = Infinity;
      for (let w = 0; w < 6; w++) {
        globalThis.gc(); globalThis.gc();
        const h0 = process.memoryUsage().heapUsed;
        for (let f = 0; f < 5000; f++) fn();
        least = Math.min(least, (process.memoryUsage().heapUsed - h0) / 5000);
      }
      return least;
    };
    const rem0 = { x: 0, z: 8, yw: Math.PI, mv: null, atk: null };
    const base = { ...SD_FIGHT_EMPTY, fi: 1, op: T0 - 300000, ou: 0, ends: T0 + 600000, ph: 1, h: 900, m: 1000, su: 0, rem: rem0 };
    const at = T0 + 3000, blow = (A, extra) => ({ a: A.id, at, x: 0, z: 8, yw: Math.PI, i: 8, ...extra });
    const ec = (o0, o1) => [{ x: -9, z: 2, yw: Math.PI, mv: null, atk: null, h: 100, m: 100, up: T0 - 5000, dn: 0, ...o0 }, { x: 9, z: 2, yw: Math.PI, mv: null, atk: null, h: 100, m: 100, up: T0 - 5000, dn: 0, ...o1 }];
    const fights = {
      stomp: { ...base, rem: { ...rem0, atk: blow(SD_BLOWS.stomp) } },
      hand: { ...base, rem: { ...rem0, atk: blow(SD_BLOWS.hand, { sw: 1, at: T0 + 1000 }) } },
      pulse: { ...base, clk: { a: SD_BLOWS.pulse.id, at, i: 7 } },
      stun: { ...base, ph: 3, su: T0 + 6000 },
      reset: { ...base, ph: 3, cx: { i: 8, m: 60, c: [[1, 10, 60], [2, 10, 0], [3, 10, 60]] }, rem: { ...rem0, atk: blow(SD_BLOWS.reset) } },
      window: { ...base, ph: 2, ec: ec({}, { h: 0, dn: T0 }) },
      echo: { ...base, ph: 2, ec: ec({ atk: blow(SD_BLOWS.stomp) }, {}) },
      fall: { ...base, fell: { at: T0 + 1500, top: [], n: 0 } },
    };
    const out = {}, sink = [], tells = new Uint8Array(5), hand = new Float64Array(2), lit = new Float64Array(1), M = remnantMatrix(1, 0, 2, 0.4), o = new Float32Array(16);
    out.control = bytes(() => { sink[0] = [k, k + 1, k + 2]; });
    for (const [name, S] of Object.entries(fights)) {
      if (name !== process.env.SD_FIGHT) continue;   // one fight a process: a page's fight keeps one shape, so its laws stay as compiled
      out[name + ' laws'] = bytes(() => {
        const t = tick();
        for (let who = -1; who < 2; who++) { sdTellsAt(S, who, t, tells); sdDialHandAt(S, who, t, hand); }
        lit[0] = sdRibLampsLit(S, t);
        dialHandMatrix(M, hand, o);
        if (S.fell) { dialFallMatrix(M, S.fell, t, o); heartFallMatrix(M, S.fell, t, o); }
      });
      const L = { state: () => S, now: tick, inDue: () => false, sentIn() {}, joined: () => false };
      const rem = createSdRemnant({ renderer, link: () => L });
      rem.stand({ dynamicDraws: [] });
      rem.frame(1 / 60, null);
      if (name !== 'pulse') out[name + ' light'] = bytes(() => rem.lights());   // the Pulse's own once (its landing kept)
      if (name === 'stun' || name === 'window') out[name + ' frame'] = bytes(() => rem.frame(1 / 60, null));
    }
    console.log(JSON.stringify(out));
  `;
  let paths = 0;
  for (const name of ['stomp', 'hand', 'pulse', 'stun', 'reset', 'window', 'echo', 'fall']) {
    const run = spawnSync(process.execPath, ['--expose-gc', '--min-semi-space-size=64', '--max-semi-space-size=64', '--input-type=module', '-e', script], { encoding: 'utf8', env: { ...process.env, SD_FIGHT: name } });
    assert.equal(run.status, 0, run.stderr);
    const m = JSON.parse(run.stdout.trim().split('\n').pop());
    assert.ok(m.control >= 40, `the control made ${m.control.toFixed(2)} bytes a frame - the measure is blind`);
    for (const [path, b] of Object.entries(m)) if (path !== 'control') { paths++; assert.ok(b < 2, `${path}: ${b.toFixed(2)} bytes a frame (the control ${m.control.toFixed(2)})`); }
  }
  assert.equal(paths, 8 + 7 + 2, 'every path measured');
});
