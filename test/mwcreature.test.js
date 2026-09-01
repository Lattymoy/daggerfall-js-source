// NPC2b: MATCHED BEASTS WEAR MORROWIND CREATURES.
//
// A creature is not an NPC body: it is one file carrying its own
// skeleton, its own geometry and its own animations, which is why the
// reference gives it a different animation class entirely
// (CreatureAnimation vs NpcAnimation). These are that path's laws -
// the map's honesty, the reference's own load order, and the
// measured claim that a self-contained nif needs no new assembly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { f } from './mwFixtures.mjs';
import { assembleFirstPersonArm } from '../src/formats/mwFirstPerson.js';
import { creatureRecords, CREATURE_FLAGS, creatureIsBipedal, creatureHasWeapon } from '../src/formats/mwEsmFile.js';
import {
  pickMwCreature, MW_CREATURE_FOR, NO_MW_CREATURE, MAPPED_BEASTS,
} from '../src/characters/mwCreatureMap.js';
import { isMwHumanoid } from '../src/characters/enemyMwBody.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

test('NPC2b: a self-contained creature nif binds through the ONE assembly door', async () => {
  // THE MEASURED CLAIM this slice rests on, and the reason it adds no
  // assembly code: a creature is skeleton AND geometry in one file,
  // and bindPartsInto iterates [null] for an empty bone list - skinned
  // batches find their own bones, rigid ones land at the root.
  const bytes = f('animated.nif');
  const asm = await assembleFirstPersonArm({
    skeletonBytes: bytes, parts: [{ slot: 'creature', bones: [], bytes }],
  });
  assert.equal(asm.ok, true, `a self-animated nif must assemble (${asm.error})`);
  assert.ok(asm.pieces.length >= 1, 'nothing bound');
  assert.deepEqual(asm.notes, [], 'a clean creature must produce no complaints');
  // ...and a skeleton-only file still refuses, in words.
  const skel = f('armskel.nif');
  const empty = await assembleFirstPersonArm({
    skeletonBytes: skel, parts: [{ slot: 'creature', bones: [], bytes: skel }],
  });
  assert.equal(empty.ok, false, 'a file with no geometry must not pass as a creature');
  assert.match(empty.notes.join(' '), /no geometry to bind/);
});

test('NPC2b: the CREA reader takes the flags and the scale the reference branches on', () => {
  // loadcrea.cpp: FLAG is an int32 masked to its LOW BYTE, XSCL is the
  // creature's own size. Hand-laid, so no writer shares the reader's
  // guess - and the high bits are planted to prove the mask.
  const sub = (name, data) => {
    const b = new Uint8Array(8 + data.length);
    b.set([...name].map((c) => c.charCodeAt(0)), 0);
    new DataView(b.buffer).setUint32(4, data.length, true);
    b.set(data, 8);
    return b;
  };
  const z = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)).concat(0));
  const u32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
  const f32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, n, true); return b; };
  const rec = (subs) => {
    const size = subs.reduce((a, x) => a + x.length, 0);
    const r = new Uint8Array(16 + size);
    r.set([...'CREA'].map((c) => c.charCodeAt(0)), 0);
    new DataView(r.buffer).setUint32(4, size, true);
    let o = 16; for (const x of subs) { r.set(x, o); o += x.length; }
    return r;
  };
  // Bipedal|Weapon = 0x05, with 0xFF00 planted above the mask.
  const bytes = rec([
    sub('NAME', z('MyCreature')), sub('FNAM', z('A Beast')),
    sub('MODL', z('r\\Rat.NIF')), sub('FLAG', u32(0xFF05)), sub('XSCL', f32(1.5)),
  ]);
  const [c] = creatureRecords(bytes);
  assert.equal(c.id, 'mycreature', 'the id is lowercased for matching');
  assert.equal(c.model, 'r/rat.nif', 'the backslash path is normalised');
  assert.equal(c.flags, 0x05, 'the FLAG word must be masked to its low byte');
  assert.equal(c.scale, 1.5);
  assert.equal(creatureIsBipedal(c), true);
  assert.equal(creatureHasWeapon(c), true);
  assert.equal(CREATURE_FLAGS.Bipedal, 0x01);
  assert.equal(CREATURE_FLAGS.Weapon, 0x04);
  // A record with no model cannot be drawn and is not a candidate.
  assert.deepEqual(creatureRecords(rec([sub('NAME', z('x'))])), []);
});

test('NPC2b: EVERY enemy is humanoid, mapped, or a DECLARED miss - no silent gaps', () => {
  // Totality is a pin (MW-D28's law). A beast that is neither mapped
  // nor declared missing is a hole the card cannot explain.
  const all = Object.entries(MOBILE_TYPES)
    .filter(([k, v]) => v !== MOBILE_TYPES.None && k !== 'Horse_Invalid');
  const gaps = all.filter(([, v]) => !isMwHumanoid(v) && !MW_CREATURE_FOR[v] && !NO_MW_CREATURE[v]);
  assert.deepEqual(gaps.map(([k]) => k), [], 'these enemies have no verdict at all');
  assert.equal(all.length, 61, 'the roster changed - the count is the claim');
  assert.equal(MAPPED_BEASTS.length, 23);
  assert.equal(Object.keys(NO_MW_CREATURE).length, 15);
  // The misses are REASONS, not blanks.
  for (const [t, why] of Object.entries(NO_MW_CREATURE)) {
    assert.ok(why && why.length > 8, `enemy ${t} has no reason worth printing`);
  }
});

test('NPC2b: a row resolves against the player’s OWN data, id-sorted, and says when it substitutes', () => {
  const C = (id, model = 'r/x.nif') => ({ id, model, name: id, flags: 0, scale: 1 });
  // The first token wins, and among its matches the ID SORT decides -
  // never the archive's listing order (AUDIT 29 F3's law).
  const pool = [C('zz_rat_special'), C('rat'), C('aa_rat_diseased')];
  assert.equal(pickMwCreature(MOBILE_TYPES.Rat, pool).record.id, 'aa_rat_diseased');
  // A substitution names itself so the card can never be silent.
  const imp = pickMwCreature(MOBILE_TYPES.Imp, [C('scamp')]);
  assert.equal(imp.record.id, 'scamp');
  assert.match(imp.why, /scamp stands in for the imp/);
  // An exact match substitutes nothing.
  assert.equal(pickMwCreature(MOBILE_TYPES.Rat, [C('rat')]).why, null);
  // Token ORDER is preference: a werewolf prefers the werewolf.
  const wolves = [C('wolf'), C('werewolf')];
  assert.equal(pickMwCreature(MOBILE_TYPES.Werewolf, wolves).record.id, 'werewolf');
  // Data that carries nothing gives a REASON, never a null alone...
  const missing = pickMwCreature(MOBILE_TYPES.Daedroth, [C('rat')]);
  assert.equal(missing.record, null);
  assert.match(missing.reason, /carries no creature matching "daedroth"/);
  // ...and a Bloodmoon-only row says which expansion it wants.
  assert.match(pickMwCreature(MOBILE_TYPES.GrizzlyBear, [C('rat')]).reason, /ships with Bloodmoon/);
  // A declared miss carries ITS reason, not a lookup failure.
  assert.match(pickMwCreature(MOBILE_TYPES.Spider, [C('rat')]).reason, /ships no spider/);
  // A record with no model is not a candidate at all.
  assert.equal(pickMwCreature(MOBILE_TYPES.Rat, [{ id: 'rat', model: '' }]).record, null);
});

test('NPC2b: the builder follows the reference’s own creature load order', () => {
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  const b = arm.slice(arm.indexOf('export async function buildMwCreature'), arm.indexOf('export function uploadMwBodyMesh'));
  // objects.cpp:99-103 - the x-form decides `animated`, not a flag.
  assert.match(b, /const animPath = correctActorModelPath\(modelPath, exists\);/);
  assert.match(b, /const animated = animPath !== modelPath;/, 'the animated test is not the reference’s');
  // creatureanimation.cpp:30-31 - a BIPEDAL creature also takes the
  // human base set, and it is added FIRST.
  assert.match(b, /if \(creatureIsBipedal\(record\)\) \{/);
  const biped = b.indexOf('creatureIsBipedal(record)');
  const own = b.indexOf('if (animated) {');
  assert.ok(biped > 0 && own > biped, 'the creature’s own animations must come after the base set');
  // One file, both roles - the measured claim, in the code.
  assert.match(b, /parts: \[\{ slot: 'creature', bones: \[\], bytes \}\]/);
  // A creature's size is its OWN, and it rides the same field the
  // race scale does so one draw law serves both.
  assert.match(b, /raceScale: \{ weight: record\.scale \?\? 1, height: record\.scale \?\? 1 \}/);
});
