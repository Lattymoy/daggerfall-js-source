// AUDIT 68 (2026-09-24), the whole-tree sweep - cluster chars_bc
// (src/characters from equipRules to pieceFromSprite, the pieces and
// the rewrite rig). The behavioural fixes: the Khajiit tail's twisted
// frame and inside-out tube, the drapes' group tag, the arachnid's
// point-symmetric legs, the Seducer's partial save rewind, the stale
// sprite record on a one-shot's last tick, and the paperdoll's
// shadow template table. Every pin here failed on the base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTail } from '../src/characters/pieces/tail.js';
import { drapedPiece, DRAPED_NAMES } from '../src/characters/pieces/draped.js';
import { CLOTH_RAMP } from '../src/characters/pieces/pieceLoft.js';
import { KHAJIIT_FUR, KHAJIIT_BELLY, ARGONIAN_HIDE } from '../src/characters/pieces/bodyScales.js';
import { KHAJIIT_FURS, ARGONIAN_HIDES } from '../src/characters/palettes.js';
import { buildArachnid } from '../src/characters/pieces/arachnid.js';
import { BEAST_DESIGNS } from '../src/characters/beasts.js';
import {
  MobileUnit, SeducerTransformBehaviour, SECONDS_TO_TRANSFORM, MOBILE_DAEDRA_SEDUCER,
  IDLE_ANIMS, SEDUCER_IDLE_MOVE_ANIMS,
} from '../src/characters/mobileUnit.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { makeEnemyEntity } from '../src/characters/enemyEntity.js';
import { getTemplate } from '../src/characters/paperdoll.js';
import { registerTemplateOverrides, templateByIndex } from '../src/systems/itemTemplates.js';

const RAMP = [[0, 0, 0], [60, 60, 60], [120, 120, 120], [180, 180, 180], [255, 255, 255]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const verts = (f) => [0, 1, 2, 3].map((k) => f.p.slice(k * 3, k * 3 + 3));

// The tube is the first (nodes - 1) x 10 faces buildTail emits: the
// Argonian spine has 13 nodes, the Khajiit's 15.
const TUBES = [['argonian', 12], ['khajiit', 14]];

test('AUDIT 68 S06-khajiit-tail-frame-flip: no tube quad is a bow-tie where the Khajiit tip curls forward', () => {
  for (const [kind, segs] of TUBES) {
    const f = buildTail(RAMP, kind);
    const folded = [];
    for (let i = 0; i < segs * 10; i++) {
      const v = verts(f[i]);
      // a bow-tie quad's two triangles face opposite ways
      if (dot(cross(sub(v[1], v[0]), sub(v[2], v[0])), cross(sub(v[2], v[0]), sub(v[3], v[0]))) <= 0) folded.push(i);
    }
    assert.deepEqual(folded, [], `${kind}: the ring frame reversed mid-tube`);
  }
});

test('AUDIT 68 S06-khajiit-tail-frame-flip: the tube\'s normals face out of the tube, both tails', () => {
  for (const [kind, segs] of TUBES) {
    const f = buildTail(RAMP, kind);
    const inward = [];
    for (let s = 0; s < segs; s++) {
      const seg = f.slice(s * 10, s * 10 + 10);
      const mid = [0, 0, 0];
      for (const q of seg) for (const v of verts(q)) for (let a = 0; a < 3; a++) mid[a] += v[a] / 40;
      seg.forEach((q, k) => {
        const c = [0, 1, 2].map((a) => verts(q).reduce((t, v) => t + v[a], 0) / 4);
        if (dot(q.n, sub(c, mid)) <= 0) inward.push(s * 10 + k);
      });
    }
    assert.deepEqual(inward, [], `${kind}: the key light bakes an inside-out tube`);
  }
});

test('AUDIT 68 S06-draped-group-tag: every drape face carries the rig group \'body\'', () => {
  for (const nm of DRAPED_NAMES) {
    const f = drapedPiece(nm, CLOTH_RAMP);
    assert.ok(f.length > 0, nm);
    assert.ok(f.every((q) => q.g === 'body'), `${nm}: g is the rig group every packer keys on`);
  }
});

test('AUDIT 68 S06-race-ramp-table-dup: the payload\'s race ramps ARE the palette table\'s first swatches', () => {
  assert.equal(KHAJIIT_FUR, KHAJIIT_FURS[0].coat);
  assert.equal(KHAJIIT_BELLY, KHAJIIT_FURS[0].belly);
  assert.equal(ARGONIAN_HIDE, ARGONIAN_HIDES[0].ramp);
});

test('AUDIT 68 S06-arachnid-legs-point-symmetric: the legs mirror left/right, each foot on its own side', () => {
  for (const name of ['Giant Spider', 'Giant Scorpion']) {
    const d = BEAST_DESIGNS.find((x) => x.name === name);
    const f = buildArachnid(undefined, d.arachnid);
    const key = (x, y, z) => [x, y, z].map((v) => v.toFixed(4)).join();
    const S = new Set();
    for (const q of f) for (const v of verts(q)) S.add(key(...v));
    let unmirrored = 0;
    for (const q of f) for (const v of verts(q)) if (!S.has(key(-v[0] + 0, v[1], v[2]))) unmirrored++;
    assert.equal(unmirrored, 0, `${name}: the legs are a 180deg turn, not a mirror`);
    // Body = two boxes (12 faces), then 8 faces per leg: the left four,
    // then the right four. Each leg's lower limb ends at the foot.
    for (let L = 0; L < 8; L++) {
      const side = L < 4 ? -1 : 1;
      const lower = f[12 + L * 8 + 4].p;
      const footX = (lower[6] + lower[9]) / 2;
      assert.ok(footX * side > 0, `${name}: leg ${L} crosses the body (foot x ${footX.toFixed(3)})`);
    }
  }
});

// The Seducer - a real mobile and the entity the hosts mint for it.
const SEDUCER = ENEMY_BASICS[MOBILE_DAEDRA_SEDUCER];
const seducer = () => {
  const m = new MobileUnit(MOBILE_DAEDRA_SEDUCER, SEDUCER, () => 10, () => 0.5, 'female');
  const e = makeEnemyEntity(MOBILE_DAEDRA_SEDUCER, SEDUCER, null, 1, () => 0.5);
  return { m, e, b: new SeducerTransformBehaviour(m, e) };
};
const tick = (m, n) => { let r; for (let i = 0; i < n; i++) r = m.update(0.1, {}, 0, [0, 0, 0], [0, 0, 5]); return r; };

test('AUDIT 68 S05-seducer-rewind-incomplete: a pre-transform save lowers the infighting latch and refills the clock', () => {
  const { m, e, b } = seducer();
  e.health = e.maxHealth - 1;          // wounded: transforms at once
  b.update(0.1, true);
  tick(m, 80);
  assert.equal(m.specialTransformationCompleted, true);
  b.update(0.1, true);
  assert.equal(e.suppressInfighting, true);
  b.rewind();
  assert.equal(m.specialTransformationCompleted, false);
  assert.equal(m.basics, SEDUCER, 'the shared row is back');
  assert.equal(e.suppressInfighting, false, 'nothing else ever lowers it');
  assert.equal(b.transformStarted, false);
  assert.equal(b.transformCountdown, SECONDS_TO_TRANSFORM);
});

test('AUDIT 68 S05-seducer-rewind-incomplete: a transform in PROGRESS predates the save too', () => {
  const { m, e, b } = seducer();
  e.health = e.maxHealth - 1;
  b.update(0.1, true);
  assert.equal(m.state, 'transform1');
  assert.equal(m.basics.behaviour, 'Flying', 'transform1 owns the basics');
  m.clearSpecialTransformationCompleted();
  assert.equal(m.state, 'idle', 'a rebuilt mobile is not crouched mid-wing');
  b.rewind();
  assert.equal(m.basics, SEDUCER);
  assert.equal(m.basics.behaviour, 'General');
  // not targeting the player and healed: an untouched Seducer never transforms
  e.health = e.maxHealth;
  for (let i = 0; i < 200; i++) { b.update(0.1, false); tick(m, 1); }
  assert.equal(m.specialTransformationCompleted, false);
  assert.equal(m.state, 'idle');
});

test('AUDIT 68 S05-seducer-rewind-incomplete: the dungeon\'s in-place restore rewinds every Seducer, flag up or not', () => {
  const DC = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  const pf = DC.slice(DC.indexOf('function patchFoe(f, sf, wire = false)'), DC.indexOf('if (sf.dead && !f.dead) setFoeDead(f, true);'));
  assert.match(pf, /else if \(sf\.specialTransformationCompleted === false && f\.seducer\) \{[^}]*f\.seducer\.rewind\(\);/);
});

test('AUDIT 68 S05-mobileunit-stale-record: the tick a one-shot ends returns the NEXT state\'s record', () => {
  const F = [0, 0, 0], C = [0, 0, 10];
  // Orc: hurt -> idle, and attack -> idle
  for (const intent of [{ hurting: true }, { striking: true }]) {
    const u = new MobileUnit(7, ENEMY_BASICS[7], () => 5, () => 0.99);
    u.update(0.001, intent, 0, F, C);
    const first = u.state;
    let r;
    for (let i = 0; i < 80 && u.state === first; i++) r = u.update(0.05, {}, 0, F, C);
    assert.equal(u.state, 'idle', first);
    assert.equal(r.record, IDLE_ANIMS[u.orientation].record, `${first} -> idle drew the ${first} record`);
    assert.equal(r.frame, u.frame);
  }
  // Seducer: the tick transform2 ends draws the winged form, not the crouch
  const { m, e, b } = seducer();
  e.health = e.maxHealth - 1;
  b.update(0.1, true);
  let r;
  for (let i = 0; i < 200 && !m.specialTransformationCompleted; i++) r = m.update(0.1, {}, 0, F, C);
  assert.equal(m.specialTransformationCompleted, true);
  assert.equal(r.record, SEDUCER_IDLE_MOVE_ANIMS[0].record);
});

test('AUDIT 68 S05-paperdoll-template-copy: the doll reads a mod-patched classic row, not a stale copy', () => {
  registerTemplateOverrides([{ index: 120, playerTextureRecord: 99 }]);
  try {
    assert.equal(getTemplate(120).playerTextureRecord, 99);
    assert.equal(getTemplate(120), templateByIndex(120));
  } finally {
    registerTemplateOverrides([]);
  }
  assert.equal(getTemplate(120), templateByIndex(120));
});
