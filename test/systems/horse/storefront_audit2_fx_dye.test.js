// AUDIT-STOREFRONT II, lane C (2026-10-29): two dyes that leaned on what came before them. The riders' masks were
// memoised as their import's promise, so one failed load failed every mounted sprite for the session (C3). The 3D
// horse's mane and tail never set the shared pixel record's seed, so its fire's flicker was whichever horse the last
// dye was for (C4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

import { ridersReady } from '../../../src/player/eyeOfTheBeholder/eotbSprite.js';
import { recolorHorse, dyeHorseHairRows, withMountLook, horseLookCode, HORSE_MOUNTS } from '../../../src/systems/horse/horseCoats.js';
import { VIEW_SIDE } from '../../../src/systems/horse/mountPaint.js';
import { MOUNT_PREVIEW_FILE } from '../../../src/ui/mountPreview.js';

test('AUDIT-STOREFRONT II C3 the riders\' masks: a load that fails answers none for the picture that asked, and is forgotten - the next asks again and keeps what it loads (mutants: the failure thrown at the picture; the failure kept for the session)', async () => {
  let asked = 0;
  const offline = () => { asked++; return Promise.reject(new Error('offline')); };
  assert.equal(await ridersReady(offline), null, 'none: that picture dyed with no rider spared, as before the masks');
  const masks = await ridersReady();
  assert.ok(masks && Object.keys(masks).length > 100, 'asked again: the masks');
  assert.equal(await ridersReady(offline), masks, 'loaded once: kept');
  assert.equal(asked, 1);
});

test('AUDIT-STOREFRONT II C4 the 3D horse\'s mane and tail in a mount look: one picture for every horse in the look, whichever horse\'s coat was dyed last (mutants: the hair\'s seed left to the last dye)', () => {
  const raw = PNG.sync.read(readFileSync(new URL(`../../../vendor/horse-cart-and-cargo/Textures/${MOUNT_PREVIEW_FILE}`, import.meta.url)));
  const w = 24, h = 6, hair = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const v = 8 + ((i * 37) % 70); hair.set([v, Math.max(0, v - 3), v, 255], i * 4); }   // a strand's near-black, lit unevenly
  const fire = HORSE_MOUNTS.indexOf('warhorse');
  const shadeAfter = (/** @type {number} */ seed) => {
    recolorHorse({ width: raw.width, height: raw.height, colors: new Uint8Array(raw.data) }, withMountLook(horseLookCode({ coat: 1, pattern: 0, legs: 0, seed }), 'warhorse'), { bottomFirst: false, view: VIEW_SIDE });
    const out = new Uint8Array(hair);
    dyeHorseHairRows(hair, out, w, fire, 0, h);
    return out;
  };
  const a = shadeAfter(7);
  assert.ok(a.some((x, i) => x !== hair[i]), 'the hair shaded');
  assert.deepEqual(shadeAfter(300), a, 'after another horse: the same picture');
  assert.deepEqual(shadeAfter(0), a, 'and the seed it is drawn in is 0');
});
