// HITFLASH1 (2026-09-26): a struck body flashes red (foes, peers, Morrowind bodies), and a puppet foe's hurt is held
// until its sprite can take it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  HIT_FLASH_S, HIT_FLASH_HOLD_S, HIT_FLASH_PEAK, PUPPET_HURT_HOLD_S,
  hitFlashStrength, foeHitFlash, setBatchHitFlash, puppetHurtStep,
} from '../src/systems/hitFlash.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('HITFLASH1 curve: held at the peak, then fades to nothing - and long enough to see (the old one was 0.12 s)', () => {
  assert.ok(HIT_FLASH_S >= 0.25, 'about a quarter second or more');
  assert.equal(hitFlashStrength(0), HIT_FLASH_PEAK);
  assert.equal(hitFlashStrength(HIT_FLASH_HOLD_S), HIT_FLASH_PEAK);
  const mid = hitFlashStrength((HIT_FLASH_HOLD_S + HIT_FLASH_S) / 2);
  assert.ok(mid > 0 && mid < HIT_FLASH_PEAK);
  assert.equal(hitFlashStrength(HIT_FLASH_S), 0);
  assert.equal(hitFlashStrength(-1), 0);
  assert.equal(hitFlashStrength(Infinity), 0, 'never struck');
});

test('HITFLASH1 foes: a health drop flashes, a heal does not, the first sight does not, a long-unseen foe resyncs silently', () => {
  const f = { entity: { health: 20 } };
  assert.equal(foeHitFlash(f, 1), 0, 'first sight: no old wound flashes');
  f.entity.health = 15;
  assert.equal(foeHitFlash(f, 1.02), HIT_FLASH_PEAK, 'a blow landed');
  assert.ok(foeHitFlash(f, 1.2) > 0);
  assert.equal(foeHitFlash(f, 1.02 + HIT_FLASH_S + 0.01), 0, 'over');
  f.entity.health = 18;
  assert.equal(foeHitFlash(f, 1.4), 0, 'a heal is no blow');
  f.entity.health = 5;
  assert.equal(foeHitFlash(f, 3), 0, 'unseen for over half a second: resynced, no flash for a wound taken out of sight');
  f.entity.health = 4;
  assert.equal(foeHitFlash(f, 3.05), HIT_FLASH_PEAK, 'and the next blow flashes again');
});

test('HITFLASH1 batch: written only on change, 0 clears', () => {
  const b = { hitFlash: undefined };
  setBatchHitFlash(b, 0); assert.equal(b.hitFlash, undefined, 'no write for nothing');
  setBatchHitFlash(b, 0.5); assert.equal(b.hitFlash, 0.5);
  setBatchHitFlash(b, -1); assert.equal(b.hitFlash, 0);
  setBatchHitFlash(null, 1);   // no batch: no throw
});

test('HITFLASH1 puppet hurt: a drop that lands mid-swing is held until the sprite can hurt, then spent once', () => {
  const p = { hurt: true, hurtUntil: 0 };
  const mob = { state: 'attack' };
  assert.equal(puppetHurtStep(p, mob, 10), true, 'the drop');
  assert.equal(puppetHurtStep(p, mob, 10.1), true, 'still swinging: held (the old one frame was eaten here)');
  mob.state = 'idle';
  assert.equal(puppetHurtStep(p, mob, 10.15), true, 'the swing ended: the sprite takes it this frame');
  mob.state = 'hurt';
  assert.equal(puppetHurtStep(p, mob, 10.16), false, 'hurting: spent');
  mob.state = 'idle';
  assert.equal(puppetHurtStep(p, mob, 10.2), false, 'never replayed');
  const q = { hurt: true, hurtUntil: 0 };
  puppetHurtStep(q, { state: 'attack' }, 0);
  assert.equal(puppetHurtStep(q, { state: 'attack' }, PUPPET_HURT_HOLD_S + 0.01), false, 'a long swing: the hold runs out, as a knockback decays');
  assert.equal(puppetHurtStep(null, null, 0), false);
});

test('HITFLASH1 wiring: both billboard shaders and the sprite quad read the flash; every foe pool and every puppet step use it; the peers ride it', () => {
  const r = read('src/render/renderer.js'), el = read('src/render/enhancedLighting.js');
  assert.match(r, /uniform float uHitFlash;/);
  assert.match(r, /lit = hitFlashLit\(lit, albedo \+ emission, uHitFlash\);/);
  assert.match(r, /gl\.uniform1f\(this\.bbUHitFlash, hf\)/);
  assert.match(r, /hitFlash: undefined/, 'minted with the batch (PERF-EXT10)');
  assert.match(r, /gl\.uniform1f\(c\.hitFlash, /, 'the Morrowind body\'s sprite quad');
  assert.match(el, /lit = hitFlashLit\(lit, albedo \+ emission, uHitFlash\);/, 'the Enhanced Lighting lane, which never drew mode 5');
  for (const [file, v] of [['src/scenes/dungeonContext.js', 'f'], ['src/scenes/exteriorFoes.js', 'f'], ['src/scenes/cityGuards.js', 'g']]) {
    assert.match(read(file), new RegExp(`setBatchHitFlash\\(${v}\\.batch, foeHitFlash\\(${v}, `), file);
  }
  for (const file of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js']) {
    assert.match(read(file), /f\.ai\.hurtKnock = puppetHurtStep\(p, f\.mobile, /, file);
    assert.doesNotMatch(read(file), /f\.ai\.hurtKnock = p\.hurt; p\.hurt = false;/, file);
  }
  const w = read('src/scenes/world.js');
  assert.match(w, /setBatchHitFlash\(layer\?\.batchOf\?\.\(id\), k\)/);
  assert.doesNotMatch(w, /conceal = k > 0 \? \{ mode: 5/, 'the peers no longer borrow the concealed phase');
  assert.match(w, /peerBodies\.draw\(canvas, \{ proj, view, eye, flashOf: peerFlashOf \}\)/);
  assert.match(read('src/net/peerBodies.js'), /hitFlash: flashOf \? flashOf\(b\.id\) : 0/);
});
