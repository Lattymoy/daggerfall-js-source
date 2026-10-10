// MWNPC14 (2026-10-10, the MW-NPC arc's fourteenth slice - bible/04-Characters/Morrowind-NPCs.md section 19): THE
// VAMPIRES, AS MORROWIND'S ARE - PEOPLE WITH A VAMPIRE'S FACE. A BODY record's second BYDT byte marks a vampire's part;
// OpenMW's getVampireHead (npcanimation.cpp, 0.48.0) takes the last such head of the race and sex, NotPlayable or not,
// and the NPC wears it over its own (its hair its own). The port now reads that byte, finds that head
// (formats/mwFirstPerson.js vampireHeadRecord) and builds it for a look that says `vampire`; a vampire foe stands as
// a person of the Bay in its clothes with that face. Pinned on parsed records, on a real fixture build, on the peer
// layer's key and options, and on the foes'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodyParts, vampireHeadRecord, playerBodyRows, extractArmRecords, isArmRecords, ARM_RECORDS_VERSION } from '../src/formats/mwFirstPerson.js';
import { buildFpArm } from '../src/combat/fpArm.js';
import { peerBuildOpts, peerBodyKey } from '../src/net/peerBodies.js';
import { foeActor, isPersonFoe, rosterLook, VAMPIRE_MOBILES } from '../src/characters/foeBodies.js';
import { residentLook } from '../src/characters/rosterBodies.js';
import { CREATURE_MATCH } from '../src/characters/creatureBodies.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { createEquipTable } from '../src/characters/equipTable.js';
import { bodyRec, fixtureFile, fixtureBodyDeps } from './fixtures/mw/bodyRig.mjs';
import { fpSkeletonPath, FP_CLIP_PATH } from '../src/combat/fpArm.js';

const cat = (...a) => { const out = new Uint8Array(a.reduce((n, b) => n + b.length, 0)); let o = 0; for (const b of a) { out.set(b, o); o += b.length; } return out; };
const HEAD = 0, HAIR = 1;

test('MWNPC14-1 the records: BYDT\'s second byte read as the vampire flag; the vampire head is the last of the race and sex (NotPlayable no bar), none for a race without; the walk never offers one; a vampire\'s rows swap the head and keep the hair', () => {
  const parts = bodyParts(cat(
    bodyRec('b_n_fprace_m_head_01', 'fixture\\h1.nif', 'FpRace', HEAD),
    bodyRec('b_n_fprace_m_hair_01', 'fixture\\r1.nif', 'FpRace', HAIR),
    bodyRec('b_v_fprace_m_head_01', 'fixture\\v1.nif', 'FpRace', HEAD, { vampire: true, notPlayable: true }),
    bodyRec('b_v_fprace_m_head_02', 'fixture\\v2.nif', 'FpRace', HEAD, { vampire: true, notPlayable: true }),
    bodyRec('b_v_fprace_f_head_01', 'fixture\\vf.nif', 'FpRace', HEAD, { vampire: true, notPlayable: true, female: true }),
    bodyRec('b_n_fprace_m_head_09', 'fixture\\h9.nif', 'FpRace', HEAD, { notPlayable: true }),   // a living head after them, NotPlayable too
  ));
  assert.deepEqual(parts.map((p) => p.vampire), [false, false, true, true, true, false]);
  assert.equal(vampireHeadRecord(parts, 'FPRACE', false).id, 'b_v_fprace_m_head_02', 'the last of the race and sex, the race by any case');
  assert.equal(vampireHeadRecord(parts, 'fprace', true).id, 'b_v_fprace_f_head_01');
  assert.equal(vampireHeadRecord(parts, 'otherrace', false), null);
  // the stored record sets carry the flag now - one from before it (v5) is re-extracted, never read without it
  const set = extractArmRecords(cat(bodyRec('b_v_fprace_m_head_01', 'fixture\\v1.nif', 'FpRace', HEAD, { vampire: true, notPlayable: true })));
  assert.equal(set.parts[0].vampire, true);
  assert.equal(ARM_RECORDS_VERSION, 6);
  assert.equal(isArmRecords(set), true);
  assert.equal(isArmRecords({ ...set, version: 5 }), false, 'a set from before the vampire flag is refused');
  for (let i = 0; i < 4; i++) {
    const rows = playerBodyRows(parts, 'fprace', false, { faceIndex: i });
    assert.equal(rows.find((r) => r.slot === 'head').record.id, 'b_n_fprace_m_head_01', 'the living walk: never a vampire\'s head');
  }
  const v = playerBodyRows(parts, 'fprace', false, { vampire: true });
  assert.equal(v.find((r) => r.slot === 'head').record.id, 'b_v_fprace_m_head_02');
  assert.match(v.find((r) => r.slot === 'head').verdict, /vampire/);
  assert.equal(v.find((r) => r.slot === 'hair').record.id, 'b_n_fprace_m_hair_01', 'the hair its own');
  const none = playerBodyRows(parts, 'otherrace', false, { vampire: true });
  assert.deepEqual(none, playerBodyRows(parts, 'otherrace', false), 'a race with no vampire head: the face stands');
});

/** the fixture body rig's deps, with a head that is a vampire's and no other */
function vampireDeps() {
  const base = fixtureBodyDeps();
  const f = fixtureFile;
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')], [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')], ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/xbase_anim.nif', f('armfp.nif')], ['meshes/xbase_anim.kf', f('armfpidle.kf')],
  ]);
  return {
    ...base,
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    loadMorrowindFile: async () => cat(await base.loadMorrowindFile(), bodyRec('b_v_fprace_m_head_01', 'fixture\\armfphand.nif', 'fprace', HEAD, { vampire: true, notPlayable: true })),
  };
}
test('MWNPC14-2 a real build: the fixture race\'s only head a vampire\'s - a vampire\'s body reaches for it (the head row its record, the piece placed or refused at the skeleton), a living body has no head to wear', async () => {
  const rowOf = async (o) => { const res = await buildFpArm({ race: 'fprace', deps: vampireDeps(), reachSweep: false, ...o }); assert.equal(res.third?.ok, true); return { head: res.third.rows.find((r) => r.slot === 'head'), notes: res.third.notes }; };
  const living = await rowOf({}), vampire = await rowOf({ vampire: true });
  assert.equal(living.head.record, null, 'the living walk offers no vampire\'s head');
  assert.ok(living.notes.includes('head: no third-person record for this actor'));
  assert.equal(vampire.head.record?.id, 'b_v_fprace_m_head_01', 'the vampire\'s, through the real record walk');
  assert.match(vampire.head.verdict, /getVampireHead/);
  assert.ok(!vampire.notes.includes('head: no third-person record for this actor'), 'built to its bone (the fixture\'s arm skeleton has none - its note says so)');
});

test('MWNPC14-3 the peer layer: a vampire look builds with its face and is a body of its own (never a living look\'s spare); the wolf none', () => {
  const look = { race: 'Breton', gender: 'male', faceIndex: 2, items: [] };
  assert.equal(peerBuildOpts({ ...look, vampire: true }).vampire, true);
  assert.equal(peerBuildOpts(look).vampire, undefined);
  assert.notEqual(peerBodyKey({ ...look, vampire: true }), peerBodyKey(look));
  assert.match(peerBodyKey({ ...look, vampire: true }), /^vamp\|/);
  assert.equal(peerBuildOpts({ ...look, vampire: true }, { wb: 1 }).vampire, undefined, 'a werewolf is no vampire');
});

test('MWNPC14-4 the vampire foes are people: of the Bay, in their clothes, with a vampire\'s face, bare-handed - never creatures; a roster\'s or a road\'s the same', () => {
  assert.deepEqual([...VAMPIRE_MOBILES].sort((a, b) => a - b), [M.Vampire, M.VampireAncient].sort((a, b) => a - b));
  for (const t of VAMPIRE_MOBILES) {
    const f = { mobileType: t, marker: [2, 0, 5], gender: 'male', entity: { isClass: false, equip: createEquipTable(), items: [] }, ai: { feet: [0, 0, 0], yaw: 0, moving: false, giveUpTimer: 0 } };
    assert.equal(isPersonFoe(f), true);
    const look = foeActor(f).look;
    assert.equal(look.vampire, true);
    assert.notEqual(look.race, 'Orc');
    assert.ok(look.items.some((it) => it.group === 'MensClothing'), 'in its clothes');
    assert.ok(CREATURE_MATCH[t].miss, 'never a creature');
    const r = rosterLook({}, { mobileType: t, seed: 4 });
    assert.equal(r.vampire, true);
    assert.equal(r.items.filter((it) => it.group === 'Weapons').length, 0, 'its claws its own');
  }
  assert.equal(residentLook({}, { id: 'enc:1', cls: M.VampireAncient, sex: 'male', name: '' })?.vampire, true, 'a road\'s vampire');
  assert.equal(foeActor({ mobileType: M.Thief, marker: [0, 0, 0], gender: 'male', entity: { isClass: true, equip: createEquipTable(), items: [] }, ai: { feet: [0, 0, 0], yaw: 0, moving: false, giveUpTimer: 0 } }).look.vampire, undefined, 'the living none');
});
