// THE ART FOLLOWS THE ENTITY (Mac, 2026-09-16: "Characters face and
// gender completely changed after a few hours of playtime").
//
// The doll's art set - BODY, FACE, SCBG - is decoded ONCE per identity
// and kept in ui/paperDoll.js's module state. Every host warms it at
// boot with the PRE-CHARGEN stand-in (Breton, male, face 0) and the
// three chargen completions reload it on the wizard's answers; NOTHING
// reloaded it for a character who arrived through systems/save.js
// restorePlayer. `?load` is what the front door produces for Continue,
// Load Game AND Online alike (main.js:183), so every session after the
// first composed the player's own items onto the stand-in's body and
// face: a different face, and the other gender.
//
// The pin drives the real modules - the real snapshot/restore round
// trip, the real IMG and CIF readers, the real compositor - over a
// SYNTHETIC art set, so it runs with no ARENA2 on the machine. Every
// file is one flat palette index, so a colour in the finished composite
// names the file and the record it came from.
import test from 'node:test';
import assert from 'node:assert/strict';

import { DFPalette } from '../src/formats/dfPalette.js';
import { RACES } from '../src/systems/races.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { playerEntity } from '../src/characters/playerEntity.js';
import {
  preloadPaperDollArt, refreshPaperDoll, paperDollPixels, paperDollIdentityDrift,
  PAPERDOLL_W, PAPERDOLL_H,
} from '../src/ui/paperDoll.js';

// ── the synthetic art set ────────────────────────────────────────────
// One palette index per file (per RECORD for the face CIFs), so the
// composite's colours say which art was decoded. Index 0 is
// transparent to `blit` and 0xFF is the classic mask, so neither is used.
const INDEX = {
  'SCBG00I0.IMG': 10, 'SCBG01I0.IMG': 11,          // Breton / Redguard backdrops
  'BODY00I0.IMG': 20, 'BODY00I1.IMG': 21,          // Breton MALE body, unclothed / clothed
  'BODY11I0.IMG': 30, 'BODY11I1.IMG': 31,          // Redguard FEMALE body
};
const FACE_BASE = { 'FACE00I0.CIF': 40, 'FACE11I0.CIF': 60 };   // record r -> base + r

/** An IMG with a real 12-byte header (xOffset, yOffset, width, height,
 *  compression, recordSize), filled with one palette index. Sized off
 *  the headerless dimension table on purpose, so imgFile.js reads the
 *  header rather than guessing. */
function img(w, h, ox, oy, index) {
  const bytes = new Uint8Array(12 + w * h);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, ox, true); v.setInt16(2, oy, true);
  v.setInt16(4, w, true); v.setInt16(6, h, true);
  v.setUint16(8, 0, true);            // COMPRESSION_FORMATS.Uncompressed
  v.setUint16(10, w * h, true);       // pixelDataLength
  bytes.fill(index, 12);
  return bytes;
}

/** A plain CIF: contiguous single-frame IMG records, which is exactly
 *  what cifRciFile.js's _readRecords walks for FACE*.CIF. */
function faceCif(base, count = 10) {
  const parts = [];
  for (let r = 0; r < count; r++) parts.push(img(20, 20, 200 + 40, 8 + 12, base + r));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

const palette = new DFPalette();
{
  // index i -> (i, i, i): a colour in the composite IS its palette index
  const raw = new Uint8Array(768);
  for (let i = 0; i < 256; i++) { raw[i * 3] = i; raw[i * 3 + 1] = i; raw[i * 3 + 2] = i; }
  palette.load(raw);
}

const fetchBytes = async (name) => {
  if (name in INDEX) {
    // the backdrop is read through a (8,7,110,184) subrect, the body
    // stands inside the panel so the backdrop shows around it
    return name.startsWith('SCBG')
      ? img(320, 200, 0, 0, INDEX[name])
      : img(60, 150, 200 + 25, 8 + 20, INDEX[name]);
  }
  if (name in FACE_BASE) return faceCif(FACE_BASE[name]);
  throw new Error(`no such art: ${name}`);
};

const renderer = { uploadTexture: (kind, key) => ({ kind, key }), releaseTexture: () => {} };
const deps = { renderer, palette, fetchBytes, getTexture: async () => null };

/** Which palette indices the finished composite actually shows. */
function indicesDrawn() {
  const px = paperDollPixels();
  assert.ok(px, 'no composite');
  assert.equal(px.width, PAPERDOLL_W);
  assert.equal(px.height, PAPERDOLL_H);
  const seen = new Set();
  for (let i = 0; i < px.rgba.length; i += 4) if (px.rgba[i + 3]) seen.add(px.rgba[i]);
  return seen;
}

test('THE ART FOLLOWS THE ENTITY: a character restored by restorePlayer draws HER OWN body, face and backdrop, not the boot stand-in\'s (mutant: drop the drift check in refreshPaperDoll and the doll is Breton, male, face 0 for the rest of the session)', async () => {
  // A made character - Redguard, female, face 4 - takes a save, exactly
  // as the world host's quicksave does.
  Object.assign(playerEntity, {
    name: 'Sera', race: 'Redguard', raceId: RACES.Redguard, gender: 'female', faceIndex: 4, chargenDone: true,
  });
  const snap = snapshotPlayer(playerEntity, {});
  assert.equal(snap.gender, 'female');
  assert.equal(snap.faceIndex, 4);

  // A FRESH PAGE: the entity is characters/playerEntity.js's pre-chargen
  // stand-in again, and the host warms the doll with it (world.js:3490,
  // exterior.js:1272 - the boot warm names no identity at all).
  Object.assign(playerEntity, { name: undefined, race: 'Breton', raceId: RACES.Breton, gender: 'male', faceIndex: 0, chargenDone: false });
  await preloadPaperDollArt(deps, {});
  await refreshPaperDoll(playerEntity);
  const stand = indicesDrawn();
  assert.ok(stand.has(INDEX['SCBG00I0.IMG']), 'the stand-in backdrop');
  assert.ok(stand.has(FACE_BASE['FACE00I0.CIF'] + 0), 'the stand-in face');

  // ...and then `?load` restores the character (main.js:183 - Continue,
  // Load Game and Online all produce it).
  assert.ok(restorePlayer(playerEntity, snap), 'the restore refused the envelope');
  assert.equal(playerEntity.gender, 'female');
  assert.equal(playerEntity.race, 'Redguard');
  assert.equal(playerEntity.faceIndex, 4);

  // The inventory opens (nativeInventory.js:451 - refreshPaperDoll on
  // every open) and the doll is HERS.
  await refreshPaperDoll(playerEntity);
  const drawn = indicesDrawn();
  assert.ok(drawn.has(FACE_BASE['FACE11I0.CIF'] + 4), 'the head is not her FACE11I0 record 4');
  assert.ok(!drawn.has(FACE_BASE['FACE00I0.CIF'] + 0), 'the Breton male face 0 is still on the doll');
  assert.ok(drawn.has(INDEX['BODY11I0.IMG']) || drawn.has(INDEX['BODY11I1.IMG']), 'the body is not the female Redguard sheet');
  assert.ok(!drawn.has(INDEX['BODY00I0.IMG']) && !drawn.has(INDEX['BODY00I1.IMG']), 'the male Breton body is still on the doll');
  assert.ok(drawn.has(INDEX['SCBG01I0.IMG']), 'the backdrop is not the Redguard one');
  assert.ok(!drawn.has(INDEX['SCBG00I0.IMG']), 'the Breton backdrop is still behind her');

  // And it does not reload again for the identity it now holds.
  assert.equal(paperDollIdentityDrift(playerEntity), null);
});

test('THE ART FOLLOWS THE ENTITY, the law alone: the drift keeps WHERE the doll is and moves only WHO it is (mutant: drop any of the three identity fields and a change of it draws the last character)', () => {
  const loaded = { race: 'Breton', gender: 'male', faceIndex: 0, context: 'dungeon', where: { region: 17 } };
  assert.equal(paperDollIdentityDrift({ race: 'Breton', gender: 'male', faceIndex: 0 }, loaded), null);
  // an entity with no identity at all IS the stand-in (the defaults the
  // key itself carries), so it must not ask for a reload either
  assert.equal(paperDollIdentityDrift({}, loaded), null);
  assert.equal(paperDollIdentityDrift(null, loaded), null);
  for (const [field, value] of [['race', 'Khajiit'], ['gender', 'female'], ['faceIndex', 7]]) {
    const drift = paperDollIdentityDrift({ ...loaded, [field]: value }, loaded);
    assert.ok(drift, `a change of ${field} does not reload the art`);
    assert.equal(drift[field], value);
    assert.equal(drift.context, 'dungeon', 'the reload moved the doll out of its context');
    assert.equal(drift.where.region, 17, 'the reload lost the region backdrop');
  }
  // nothing loaded, nothing to drift from
  assert.equal(paperDollIdentityDrift({ race: 'Khajiit' }, null), null);
});
