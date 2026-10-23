// PORTRAIT3D (2026-10-15, the owner: "can we do the other races with 3d portraits also?", then "#2 is exactly I wanted.
// Which also affects the talk window for npcs", and of what the first cut left out: "Stop half assing this"): THE FACE
// AS A PICTURE OF THE MORROWIND HEAD, AS THE BODY WEARS IT. With Morrowind's data attached, a face Daggerfall paints is
// the head, the hair and what is worn on them, assembled on the body's own skeleton through the body's own doors
// (combat/fpArm.js headPortrait): the face (faceMatchOf - the build's face door; an NPC's walked off its seed), the
// curse (the vampire's head, the werewolf's), the helm and the hood (composeWornArmor, its shadows, HEAD-HELD), framed
// face-on round the head, mirrored as the inventory's figure is, read back. Pinned on the port's own Breton heads and
// steel and ebony helms (src/assets/mw) on the vendored retail skeleton with its part nodes (fixtures/mw/retailRig.mjs),
// read off the disk as the page serves them, under a counting renderer - no game data, no GL; the real renderer's
// pictures are tools/headPortraitProbe.mjs's. And the doors: the talk window, the faces' one home (ui/facePortrait.js),
// the large HUD's head, the classic chargen's ten, the party and family faces, the escorts', the tab dial's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { headPortrait, headFrame, headPortraitModel, headBounds, NIF_TO_PASS, tpSkeletonPath } from '../../src/combat/fpArm.js';
import { armBuildOptsOf, armIdentityOf } from '../../src/combat/weapon/weaponRig.js';
import { facePools, bodyParts, MW_UNITS_PER_METER } from '../../src/formats/morrowind/mwFirstPerson.js';
import { bodyRec } from '../fixtures/mw/bodyRec.mjs';
import { makeVendoredArchive } from '../../src/systems/urlArchive.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { CLASSIC_ARMOR_TEMPLATE } from '../../src/characters/ownModels/ownArmorModels.js';
import { playerHeadImage, npcHeadImage, playerHeadKey, poseHeadImage, residentHeadLook, HEAD_RECORD, _setHeadDataForTests } from '../../src/characters/headPortraits.js';
import { createPartyPanel, createFaceLoader, headSuffix } from '../../src/ui/partyPanel.js';
import { SocialState } from '../../src/net/social.js';
import { facePose } from '../../src/systems/legacy/facePose.js';
import { residentLook } from '../../src/characters/rosterBodies.js';
import { npcHint, npcHintOf, npcFaceOf } from '../../src/characters/wardrobe.js';
import { textSeed } from '../../src/systems/livingWorld/seed.js';
import { escortHeadKey } from '../../src/ui/hud/hudEscortFaces.js';
import { RACES } from '../../src/systems/races.js';
import { GENDERS } from '../../src/characters/nameHelper.js';
import { headDialPicture, alphaBox, wearClassicDial, HEAD_DIAL_PX, CLASSIC_FACE_MAX } from '../../src/ui/dialClassicArt.js';
import { setPortraitRenderer, portraitRenderer } from '../../src/render/portraitRenderer.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { preloadTalkArt, setNpcPortrait, clearNpcPortrait, npcPortraitKey, npcPortraitPixels } from '../../src/ui/native/nativeTalk.js';
import { multiply, transformPoint, trs } from '../../src/world/mat4.js';
import { retailSkeleton } from '../fixtures/mw/retailRig.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const SKELETON = retailSkeleton();
/** The port's own Data Files tree, served from the disk as the page serves it, and retail's skeleton (with its part
 *  nodes) at every third-person skeleton's path; `extra` more files, `loads` every path asked. */
function ownArchive({ extra = {}, loads = null } = {}) {
  const urls = {};
  for (const dir of ['meshes', 'textures']) for (const f of readdirSync(new URL(`../../src/assets/mw/${dir}`, import.meta.url))) urls[`${dir}/${f.toLowerCase()}`] = `src/assets/mw/${dir}/${f}`;
  for (const o of [{}, { female: true }, { beast: true }, { werewolf: true }]) urls[tpSkeletonPath(o)] = '#skeleton';
  for (const k of Object.keys(extra)) urls[k] = `#${k}`;
  const arc = makeVendoredArchive(urls, async (p) => (p === '#skeleton' ? SKELETON : p.startsWith('#') ? extra[p.slice(1)] : new Uint8Array(readFileSync(new URL(`../../${p}`, import.meta.url)))));
  if (!loads) return arc;
  return { ...arc, load: (p) => { loads.push(p); return arc.load(p); } };
}
/** A renderer that counts: meshes made and let go, textures held and let go, and each picture asked. */
function countingRenderer({ answer = true } = {}) {
  const c = { meshes: 0, vaosFreed: 0, textures: 0, texturesFreed: 0, shots: [] };
  return {
    c,
    gl: { deleteVertexArray: () => { c.vaosFreed++; }, deleteBuffer: () => {}, deleteTexture: () => { c.texturesFreed++; } },
    createCharacterMesh: () => { c.meshes++; return { vao: {}, buffers: [{}] }; },
    createCharacterTexture: () => { c.textures++; return {}; },
    renderCharacterSpriteImage(mesh, model, proj, view, w, h) {
      c.shots.push({
        slots: [...new Set(mesh.ranges.map((r) => r.piece.slot))].sort(),
        textures: [...new Set(mesh.ranges.map((r) => r.textureFile).filter(Boolean))].sort(),
        textured: mesh.ranges.filter((r) => r.textureFile).every((r) => !!r.tex), model, proj, view, w, h,
      });
      return answer ? { width: w, height: h, data: new Uint8Array(w * h * 4) } : null;
    },
  };
}
let gen = 100;
const depsOf = (archive, g = gen, parts = []) => ({
  morrowindDataGeneration: () => g,
  loadMorrowindArchives: async () => (archive ? [archive] : []),
  storedMorrowindNames: async () => ['Morrowind.esm'],
  loadMorrowindArmRecords: async () => ({ parts, armors: [], races: [] }),
});
const HELM = (material) => [{ kind: 'armor', templateIndex: CLASSIC_ARMOR_TEMPLATE.Helm, material }];

test('PORTRAIT3D: headFrame looks the face full on - the eye before it on +Z, where the body at rest faces as the inventory\'s figure sees it - upright, the window the head\'s projected box with air, as wide as the asked shape; the model figure()\'s own, x negated', () => {
  const b = { minX: -0.1, maxX: 0.1, minY: 1.5, maxY: 1.8, minZ: -0.12, maxZ: 0.1 };
  const { view, proj, eye } = headFrame(b);
  assert.ok(eye[2] > b.maxZ && Math.abs(eye[0]) < 1e-9 && Math.abs(eye[1] - 1.65) < 1e-9, `the eye before the face (${eye})`);
  const [hx, hy] = [1 / proj[0], 1 / proj[5]];   // an ortho's half-extents (a Float32 matrix: to a millionth)
  assert.ok(Math.abs(hx - hy) < 1e-6, 'square by default');
  for (const x of [b.minX, b.maxX]) for (const y of [b.minY, b.maxY]) for (const z of [b.minZ, b.maxZ]) {
    const p = transformPoint(view, x, y, z);
    assert.ok(Math.abs(p[0]) <= hx && Math.abs(p[1]) <= hy, 'every corner in the window');
  }
  assert.ok(Math.abs(hy - 0.15 * 1.08) < 1e-6, 'the window the box\'s height and a little air');
  const wide = headFrame(b, { aspect: 33 / 30 });
  assert.ok(Math.abs((1 / wide.proj[0]) / (1 / wide.proj[5]) - 33 / 30) < 1e-6, 'the HUD\'s 33 x 30');
  const u = 1 / MW_UNITS_PER_METER;
  // PIN MOVED (PORTRAIT3D-FACE - a player's screenshot: a Nord's card showing only his hair): figure()'s model at yaw 0
  // IS turned 180 (drawThird's +180 stands the body's front toward its eye on +Z); this pinned the transform without the
  // turn, and every portrait was the back of a head
  assert.deepEqual(Array.from(headPortraitModel()), Array.from(multiply(trs(0, 0, 0, 0, 180, 0, -u, u, u), NIF_TO_PASS)), 'figure()\'s model at yaw 0, its turn and all: the portrait the body, not its mirror');
  assert.match(src('src/combat/fpArm.js'), /const yawDeg = \(yaw \* 180 \/ Math\.PI\) \+ 180;\n\s*const model = multiply\(trs\(0, 0, 0, 0, yawDeg, 0, -u \* rs\.weight, u \* rs\.height, u \* rs\.weight\), NIF_TO_PASS\)/, 'the figure it matches - its +180');
  // the body's front (Morrowind's forward, +Y - the steel plate's bake, the rigs' walk) lands nearer the eye than its back
  const front = transformPoint(headPortraitModel(), 0, 20, 100), back = transformPoint(headPortraitModel(), 0, -20, 100);
  assert.ok(front[2] > back[2], `the face toward the eye on +Z (front z ${front[2].toFixed(3)}, back z ${back[2].toFixed(3)})`);
  assert.ok(Math.abs(front[1] - back[1]) < 1e-9 && front[1] > 0, 'upright: the crown up, front and back at one height');
});

test('PORTRAIT3D: headBounds frames the head\'s own pieces, and of a hood that hangs from more than the head, only what lies round the head', () => {
  const I = trs(0, 0, 0, 0, 0, 0, 1, 1, 1);
  const head = { slot: 'head', positions: [-1, 9, -1, 1, 11, 1] };
  const hood = { slot: 'outfit', positions: [-1.2, 11.5, 0, 0, -30, 0] };   // a hood's point over the crown, and the hem far below
  const b = headBounds([head, hood], I, new Set(['head']), new Set(['outfit']));
  assert.deepEqual([b.minY, b.maxY], [9, 11.5], 'the hood round the head in, its hem out');
  assert.equal(b.minX, -1.2);
  assert.equal(headBounds([hood], I, new Set(['head']), new Set(['outfit'])), null, 'no head, no frame');
});

test('PORTRAIT3D: headPortrait draws the head and hair the body wears, assembled on its skeleton - a Breton man\'s portrait 6 the eyepatch the curated table names, every range textured, the asked pixels; every mesh and texture let go', async () => {
  const archive = ownArchive();
  const r = countingRenderer();
  const img = await headPortrait({ renderer: r, race: 'breton', ownHeads: true, female: false, faceIndex: 6, px: 132, ph: 120, deps: depsOf(archive, ++gen) });
  assert.deepEqual([img.width, img.height], [132, 120]);
  assert.equal(r.c.shots.length, 1);
  const shot = r.c.shots[0];
  assert.deepEqual(shot.slots, ['hair', 'head'], 'the head and its hair, nothing else');
  assert.deepEqual(shot.textures, ['breton_m_hair_01.dds', 'breton_m_head_h0411.dds'], 'portrait 6\'s pair, the eyepatch (MW-HEADS3)');
  assert.ok(shot.textured, 'every textured range held its texture for the picture');
  assert.deepEqual([shot.w, shot.h], [132, 120]);
  assert.deepEqual(Array.from(shot.model), Array.from(headPortraitModel()));
  assert.ok(Math.abs((1 / shot.proj[0]) / (1 / shot.proj[5]) - 132 / 120) < 1e-6, 'the window as wide as the picture');
  assert.equal(r.c.vaosFreed, r.c.meshes, 'the mesh let go');
  assert.equal(r.c.texturesFreed, r.c.textures, 'and every texture it held');
  const pools = facePools([], 'breton', false, { has: archive.has, own: true });
  assert.ok(pools.heads.some((h) => h.id === 'breton_m_head_h0423'));
});

test('PORTRAIT3D: the helm worn is on the portrait - composed as the body composes it: the steel helm closed hides the hair and the head it covers, open it shows the face; the ebony helm its own; a cuirass or a cloak is no head\'s', async () => {
  const archive = ownArchive();
  const r = countingRenderer();
  const deps = depsOf(archive, ++gen);
  await headPortrait({ renderer: r, race: 'breton', ownHeads: true, faceIndex: 0, armor: HELM(ARMOR_MATERIAL.Steel), deps });
  const closed = r.c.shots.at(-1);
  assert.ok(closed.slots.some((s) => /steel_helm/.test(s)), `the helm drawn (${closed.slots})`);
  assert.ok(!closed.slots.includes('hair') && !closed.slots.includes('head'), 'the closed helm - its visor - hides the hair and the face');
  setPref('mwSteelHelm', 'open');
  try {
    await headPortrait({ renderer: r, race: 'breton', ownHeads: true, faceIndex: 0, armor: HELM(ARMOR_MATERIAL.Steel), deps });
    const open = r.c.shots.at(-1);
    assert.ok(open.slots.some((s) => /steel_helm/.test(s)) && open.slots.includes('head'), `the open helm shows the face (${open.slots})`);
    assert.notDeepEqual(open.textures, closed.textures);
  } finally { setPref('mwSteelHelm', 'closed'); }
  let drawn = r.c.shots.length;
  await headPortrait({ renderer: r, race: 'breton', ownHeads: true, faceIndex: 0, armor: HELM(ARMOR_MATERIAL.Ebony), deps });
  assert.equal(r.c.shots.length, drawn + 1, 'the ebony helm a picture of its own - never another helm\'s, nor the bare face\'s');
  const ebony = r.c.shots.at(-1);
  assert.ok(ebony.slots.some((s) => /ebony/.test(s)), `the ebony helm drawn (${ebony.slots})`);
  assert.notDeepEqual(ebony.textures, closed.textures, 'the ebony helm its own');
  drawn = r.c.shots.length;
  await headPortrait({ renderer: r, race: 'breton', ownHeads: true, faceIndex: 0, armor: [{ kind: 'armor', templateIndex: CLASSIC_ARMOR_TEMPLATE.Cuirass, material: ARMOR_MATERIAL.Steel }, { kind: 'clothing', templateIndex: 154, name: 'Casual Cloak', dye: 2 }], deps });
  assert.equal(r.c.shots.length, drawn + 1, 'the bare face a picture of its own - never a helm\'s that hides nothing');
  assert.deepEqual(r.c.shots.at(-1).slots, ['hair', 'head'], 'a cuirass and a cloak are no head\'s: the bare face');
  const bare = r.c.shots.length;
  await headPortrait({ renderer: r, race: 'breton', ownHeads: true, faceIndex: 0, deps });
  assert.equal(r.c.shots.length, bare, 'the bare face drawn once, whatever else is worn');
});

test('PORTRAIT3D: the curse\'s face - a vampire wears the race\'s vampire head (getVampireHead), the transformed werewolf Bloodmoon\'s head on the wolf\'s skeleton; the player\'s build is asked for the vampire\'s head too, and rebuilt when the curse comes', async () => {
  const loads = [];
  const archive = ownArchive({ loads });
  const vamp = { id: 'b_v_breton_m_head_01', slot: 'head', vampire: true, skin: true, female: false, race: 'breton', model: 'breton_m_head_h04.nif', firstPerson: false };
  const wolf = [{ id: 'WerewolfHead', slot: 'head', model: 'breton_m_head_h0411.nif' }, { id: 'WerewolfHair', slot: 'hair', model: 'breton_m_hair_widow.nif' }];
  const r = countingRenderer();
  const deps = depsOf(archive, ++gen, [vamp, ...wolf]);
  await headPortrait({ renderer: r, race: 'breton', ownHeads: true, faceIndex: 6, vampire: true, deps });
  assert.ok(r.c.shots.at(-1).textures.includes('breton_m_head_h04.dds'), 'the vampire\'s head over the eyepatch the portrait names');
  assert.ok(r.c.shots.at(-1).textures.includes('breton_m_hair_01.dds'), 'the hair the face\'s own');
  await headPortrait({ renderer: r, race: 'breton', ownHeads: true, faceIndex: 6, werewolf: true, armor: HELM(ARMOR_MATERIAL.Steel), deps });
  const w = r.c.shots.at(-1);
  assert.deepEqual(w.textures, ['breton_m_hair_widow.dds', 'breton_m_head_h0411.dds'], 'the wolf\'s head and hair, and no helm (WEREWOLF1: the wolf wears nothing)');
  assert.ok(loads.includes('meshes/wolf/skin.nif'), 'on the wolf\'s skeleton');
  const ent = { race: 'Breton', gender: 'male', faceIndex: 3, equip: { slots: [] }, activeEffects: [{ kind: 'racialOverride', racial: 'vampirism' }] };
  assert.equal(armBuildOptsOf(ent).vampire, true, 'the body built with the vampire\'s head');
  assert.equal(armIdentityOf(ent).vampire, true, 'and rebuilt when the curse comes or goes');
  assert.equal(armBuildOptsOf({ ...ent, activeEffects: [] }).vampire, false);
});

test('PORTRAIT3D: one picture per head, hair, worn part and form - asked again it is the same picture, unrendered; another size is another picture; a new data generation draws anew; a miss is not kept', async () => {
  const archive = ownArchive();
  const r = countingRenderer();
  const deps = depsOf(archive, ++gen);
  const a = await headPortrait({ renderer: r, race: 'breton', ownHeads: true, faceIndex: 0, deps });
  const b = await headPortrait({ renderer: r, race: 'breton', ownHeads: true, faceIndex: 0, deps });
  assert.equal(a, b);
  assert.equal(r.c.shots.length, 1, 'asked twice, drawn once');
  await headPortrait({ renderer: r, race: 'breton', ownHeads: true, faceIndex: 0, px: 64, deps });
  assert.equal(r.c.shots.length, 2, 'another size, another picture');
  await headPortrait({ renderer: r, race: 'breton', ownHeads: true, faceIndex: 0, deps: depsOf(archive, ++gen) });
  assert.equal(r.c.shots.length, 3, 'another generation, drawn anew');
  const miss = countingRenderer({ answer: false });
  const d2 = depsOf(archive, ++gen);
  assert.equal(await headPortrait({ renderer: miss, race: 'breton', ownHeads: true, faceIndex: 2, deps: d2 }), null);
  await headPortrait({ renderer: miss, race: 'breton', ownHeads: true, faceIndex: 2, deps: d2 });
  assert.equal(miss.c.shots.length, 2, 'a miss is asked again (AUDIT 32 F3)');
});

/** The data's own Breton men's heads and hairs (MW-HEADS2: an NPC's), as BODY records read by the reader - their meshes
 *  the port's own bytes at the data's paths. */
const DATA_FACES = (() => {
  const heads = ['breton_m_head_h04', 'breton_m_head_h0411', 'breton_m_head_h0423', 'breton_m_head_h04'], hairs = ['breton_m_hair_01', 'breton_m_hair_0111', 'breton_m_hair_widow', 'breton_m_hair_01'];
  const recs = [], extra = {};
  for (let i = 0; i < 4; i++) {
    for (const [slot, part, own] of [['head', 0, heads[i]], ['hair', 1, hairs[i]]]) {
      recs.push(bodyRec(`b_n_breton_m_${slot}_0${i}`, `b\\b_n_breton_m_${slot}_0${i}.nif`, 'Breton', part));
      extra[`meshes/b/b_n_breton_m_${slot}_0${i}.nif`] = new Uint8Array(readFileSync(new URL(`../../src/assets/mw/meshes/${own}.nif`, import.meta.url)));
    }
  }
  const bytes = new Uint8Array(recs.reduce((n, b) => n + b.length, 0)); let o = 0; for (const b of recs) { bytes.set(b, o); o += b.length; }
  return { parts: bodyParts(bytes), extra };
})();

test('PORTRAIT3D: an NPC\'s face is walked off its seed over the same pools in the same order - the data\'s, never the port\'s own (MW-HEADS2), and an escort\'s portrait face the data\'s too; no renderer, no race, no data, no race\'s head - no picture', async () => {
  const loads = [];
  const archive = ownArchive({ extra: DATA_FACES.extra, loads });
  const r = countingRenderer();
  const deps = depsOf(archive, ++gen, DATA_FACES.parts);
  const pools = facePools(DATA_FACES.parts, 'breton', false, { has: archive.has });
  assert.deepEqual(pools.heads.map((h) => h.id), ['b_n_breton_m_head_00', 'b_n_breton_m_head_01', 'b_n_breton_m_head_02', 'b_n_breton_m_head_03'], 'the data\'s');
  const heads = await Promise.all([0, 1, 2].map((i) => headPortrait({ renderer: r, race: 'breton', npcFace: { head: 1 + 4 * i, hair: 2 }, deps })));
  assert.ok(heads[0] && heads.every((h) => h === heads[0]), `head ${1 % pools.heads.length} of ${pools.heads.length} however far the seed walks round`);
  const walked = await Promise.all(pools.heads.map((_, i) => headPortrait({ renderer: r, race: 'breton', npcFace: { head: i, hair: 0 }, deps })));
  assert.equal(new Set(walked).size, pools.heads.length, 'each step of the walk its own head');
  const meshes = () => loads.filter((p) => /^meshes\/.*_(head|hair)_/.test(p));
  assert.ok(meshes().length && meshes().every((p) => p.startsWith('meshes/b/b_n_breton_m_')), `the data's heads and hairs, never the port's own (${meshes()})`);
  // a portrait's face that is an NPC's (an escort's - not asked as a player's): the data's; a player's: the port's own
  const asked = async (ownHeads) => {
    const seen = [];
    await headPortrait({ renderer: r, race: 'breton', ownHeads, faceIndex: 6, deps: depsOf(ownArchive({ extra: DATA_FACES.extra, loads: seen }), ++gen, DATA_FACES.parts) });
    return seen.filter((p) => /^meshes\/.*_(head|hair)_/.test(p));
  };
  const escort = await asked(false);
  assert.ok(escort.length && escort.every((p) => p.startsWith('meshes/b/b_n_breton_m_')), `an escort's face the data's (${escort})`);
  const player = await asked(true);
  assert.deepEqual(player.filter((p) => !p.startsWith('meshes/b/')), ['meshes/breton_m_head_h0411.nif', 'meshes/breton_m_hair_01.nif'], 'a player\'s the port\'s own, portrait 6 the eyepatch');
  assert.equal(await headPortrait({ renderer: null, race: 'breton', ownHeads: true, deps }), null);
  assert.equal(await headPortrait({ renderer: r, race: null, deps }), null);
  assert.equal(await headPortrait({ renderer: r, race: 'breton', ownHeads: true, deps: depsOf(null, ++gen) }), null, 'no archive attached');
  assert.equal(await headPortrait({ renderer: r, race: 'argonian', deps }), null, 'no head in hand for the race');
});

test('PORTRAIT3D: the gates - the player\'s face needs Morrowind\'s data attached (the body\'s switch), an NPC\'s the people standing in Morrowind bodies (npcBodiesOn); a creature has none; the menu\'s renderer is the one the entry hands in', async () => {
  const r = countingRenderer();
  setPortraitRenderer(r);
  assert.equal(portraitRenderer(), r);
  assert.equal(await playerHeadImage({ race: 'Breton', gender: 'male', faceIndex: 0 }), null, 'no data attached in this process');
  assert.equal(await npcHeadImage({ race: 'Breton', gender: 'male', faceIndex: 0 }), null, 'no Morrowind people without the data and the enhanced skin');
  assert.equal(await npcHeadImage({ creature: 'rat' }), null);
  assert.equal(r.c.shots.length, 0);
  setPortraitRenderer(null);
  const heads = src('src/characters/headPortraits.js');
  assert.match(heads, /return morrowindDataCount\(\) > 0;/);
  assert.match(heads, /if \(!npcBodiesOn\(\)\) return null;/);
  assert.match(heads, /const o = \/\*\* @type \{any\} \*\/ \(peerBuildOpts\(look\)\);/, 'the look read through the door every body\'s build takes');
  assert.match(src('src/main.js'), /import\('\.\/render\/portraitRenderer\.js'\)\.then\(\(\{ setPortraitRenderer \}\) => setPortraitRenderer\(renderer\)\)/);
});

test('PORTRAIT3D: the talk window - the NPC\'s head takes the record\'s place under a key of its own once it lands (the enhanced panel repaints on the key), one texture a picture; a picture for an earlier NPC lands on no one', async () => {
  const uploads = [];
  await preloadTalkArt({ renderer: { uploadTexture: (kind, key) => { uploads.push(key); return { key }; } }, fetchBytes: async () => { throw new Error('no data'); }, palette: null });
  const pic = { width: 8, height: 8, data: new Uint8Array(8 * 8 * 4).fill(200) };
  let release;
  const late = new Promise((res) => { release = res; });
  setNpcPortrait('CommonFaces', 7, { picture: () => late });
  setNpcPortrait('CommonFaces', 9, { picture: async () => pic });
  await new Promise((res) => setTimeout(res, 5));
  assert.match(npcPortraitKey(), /^TFAC00I0\.RCI#9#mwhead\d+$/, 'the second NPC\'s head');
  assert.deepEqual([npcPortraitPixels().w, npcPortraitPixels().h], [8, 8]);
  const key = npcPortraitKey();
  release({ width: 4, height: 4, data: new Uint8Array(64) });
  await new Promise((res) => setTimeout(res, 5));
  assert.equal(npcPortraitKey(), key, 'the first NPC\'s late head lands on no one');
  setNpcPortrait('CommonFaces', 11, { picture: async () => pic });
  await new Promise((res) => setTimeout(res, 5));
  assert.equal(uploads.filter((k) => k.startsWith('mwhead#')).length, 1, 'one texture for one picture, whoever wears it');
  clearNpcPortrait();
  assert.equal(npcPortraitKey(), null);
  // the doors that hand the look in
  const town = src('src/scenes/townTalk.js');
  assert.match(town, /if \(portrait\) setNpcPortrait\(portrait\.archive, portrait\.record, \{ picture: portrait\.head \? \(renderer\) => npcHeadImage\(portrait\.head, \{ renderer \}\) : null \}\);/);
  const modes = src('src/scenes/worldModes.js');
  assert.match(modes, /const npcData = clicked \?\? questBridge\?\.clickNpc\(pn, npcSceneCtx\) \?\? staticNpcData\(pn, npcSceneCtx\);\n\s*talkedTo\.set\(npcData, pn\);/);   // PIN MOVED (QUEST-WORDS-FIRST): a door reopened after the quest's words lends the record its click derived
  assert.match(modes, /return pn && portrait \? \{ \.\.\.portrait, head: standingLook\(pn\) \} : portrait;/);
});

test('PORTRAIT3D: the player\'s faces - the one home (ui/facePortrait.js) draws each face as its head, the record\'s own shape, the record where none is drawn; the large HUD\'s Morrowind head first, the curse\'s too, reloaded as the data and the helm change; the classic chargen\'s ten, upgraded in place', () => {
  const face = src('src/ui/facePortrait.js');
  assert.match(face, /if \(!\(morrowindDataCount\(\) > 0\) \|\| !portraitRenderer\(\) \|\| !globalThis\.document\) return classic;/);
  assert.match(face, /const img = await playerHeadImage\(\{ race: raceKey, gender, faceIndex: i \}, \{ px: w \* 2, ph: h \* 2 \}\);/);
  assert.match(face, /if \(canvas\) heads\.set\(key, \{ canvas \}\); else heads\.delete\(key\);/, 'a face with no head is not kept');
  assert.match(face, /const face = await headFace\(raceKey, gender, scale, set\[i\] \? i : 0, art\);/);
  const hud = src('src/ui/hud/hudLarge.js');
  const head = hud.slice(hud.indexOf('export async function loadHudLargeHead('));
  assert.ok(head.indexOf('playerHeadImage(entity') < head.indexOf('racialOverrideHeadArt(entity)'), 'the Morrowind head first - the curse\'s too (the owner: "Do this") - Daggerfall\'s override where none is drawn');
  assert.match(hud, /\|mw\$\{playerHeadKey\(entity\)\}`;/, 'the key: the data, and the helm worn (characters/headPortraits.js playerHeadKey)');
  assert.doesNotMatch(hud, /^import .*scenes\/dataSource\.js/m, 'the data store behind a door (its network door binds at its load)');
  assert.doesNotMatch(src('src/characters/headPortraits.js'), /^import .*scenes\/dataSource\.js/m, 'and in the heads\' module too');
  const art = src('src/ui/chargenArt.js');
  assert.match(art, /_faces = set;\n\s*headFaces\(set, wantRace, wantGender\);/);
  assert.match(art, /if \(img && _faces === set\) set\.tex\[i\] = _deps\.renderer\.uploadTexture\('img', `face:mw:\$\{set\.key\}:\$\{i\}`, toScreenOrder\(img\)\);/);
});

const STORE = (generation, count = 1) => ({ morrowindDataCount: () => count, morrowindDataGeneration: () => generation });
const tick = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((res) => setTimeout(res, 0)); };

test('PORTRAIT3D: a live character\'s head key - the data\'s stamp and the helm worn, its item and the steel helm\'s style; \'0\' with no data - the one key the large HUD and the tab dial reload on', () => {
  _setHeadDataForTests(STORE(7, 0));
  try {
    assert.equal(playerHeadKey({ equip: { slots: [] } }), '0', 'no data: no Morrowind head to key');
    _setHeadDataForTests(STORE(7));
    assert.equal(playerHeadKey({}), '7|-', 'an identity: no helm');
    const slots = [];
    slots[12] = { templateIndex: CLASSIC_ARMOR_TEMPLATE.Helm, material: ARMOR_MATERIAL.Steel };
    assert.equal(playerHeadKey({ equip: { slots } }), `7|${CLASSIC_ARMOR_TEMPLATE.Helm}/${ARMOR_MATERIAL.Steel}/closed`);
    setPref('mwSteelHelm', 'open');
    try { assert.equal(playerHeadKey({ equip: { slots } }), `7|${CLASSIC_ARMOR_TEMPLATE.Helm}/${ARMOR_MATERIAL.Steel}/open`, 'the visor raised, another head'); }
    finally { setPref('mwSteelHelm', 'closed'); }
    _setHeadDataForTests(STORE(8));
    assert.equal(playerHeadKey({}), '8|-', 'another generation, another key');
  } finally { _setHeadDataForTests(null); }
  assert.match(src('src/ui/dialClassicArt.js'), /return `\$\{f\.file\}#\$\{f\.record\}\|mw\$\{playerHeadKey\(entity\)\}`; \};/, 'the dial\'s key: its record\'s and the head\'s');
});

/** A document enough for the party's plate (test/net/soc4_partyhud.test.js's shape, cut down). */
function plateDoc() {
  const node = (tag) => {
    const n = { tagName: tag.toUpperCase(), children: [], className: '', textContent: '', id: '', attrs: {}, style: {}, width: 0, height: 0,
      append(...cs) { n.children.push(...cs); }, replaceChildren(...cs) { n.children = [...cs]; }, setAttribute(k, v) { n.attrs[k] = v; },
      addEventListener() {}, removeEventListener() {}, remove() {} };
    if (n.tagName === 'CANVAS') {
      n.puts = [];
      const ctx = { createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData: (img) => n.puts.push(img) };
      n.getContext = (k) => (k === '2d' ? ctx : null);
    }
    return n;
  };
  const doc = { createElement: node, head: node('head'), body: node('body'), getElementById: () => null };
  return doc;
}

test('PORTRAIT3D: the faces of the record - the party\'s plate, the family\'s cards, the succession\'s - one loader, the Morrowind head first: a member\'s and a player\'s as the player\'s, a townsperson wed in the head their body walks the street with; drawn at the record\'s size, smooth; the plate\'s key carries the data\'s stamp', async () => {
  // a townsperson wed in: their census id rides the pose, and their head is the one their street body is walked off
  const pose = facePose({ kind: 'resident', race: 'Breton', gender: 'female', face: 0, residentFace: 20, residentId: 'L120.9' });
  assert.deepEqual(pose, { race: 'Breton', gender: 'female', face: 0, common: 20, resident: 'L120.9' });
  const street = residentLook({}, { id: 'L120.9', race: 'Breton', sex: 'female', gender: 1, face: 20, archive: 357 });
  const theirs = residentHeadLook(pose, npcHint, textSeed);
  assert.deepEqual(npcFaceOf(npcHintOf(theirs)), npcFaceOf(npcHintOf(street)), 'the head and hair their body walks the street with');
  assert.deepEqual([theirs.race, theirs.gender, theirs.items], ['Breton', 'female', []], 'and nothing worn');
  assert.equal(await poseHeadImage({ race: 'Breton', gender: 'male', face: 0, common: 4 }), null, 'a census face with no census id: the record');
  // MW-HEADS2: a member of the line not played is one of the people - the data's heads, as their body in the world
  const kin = { kind: 'member', id: 3, race: 'Breton', gender: 'male', face: 6 };
  assert.equal(facePose(kin, { currentId: 3 }).kin, undefined, 'the one played: a player\'s');
  assert.equal(facePose(kin, { currentId: 2 }).kin, true, 'another of the line: one of the people');
  assert.equal(facePose({ ...kin, kind: 'player' }, { currentId: 2 }).kin, undefined, 'another player\'s character: a player\'s');
  assert.equal(facePose(kin).kin, undefined, 'the one played not named (the Succession\'s heirs, to be played): a player\'s');
  assert.match(src('src/characters/headPortraits.js'), /faceIndex: pose\.face, npc: !!pose\.kin \}, opts\);/);
  // no renderer: the record, as before
  const asked = [];
  const load = createFaceLoader({ fetchBytes: async (n) => { asked.push(n); throw new Error('no data here'); }, palette: {} });
  await load({ race: 'Breton', gender: 'male', face: 3 }).catch(() => null);
  assert.match(asked[0], /^FACE\d\dI0\.CIF$/);
  const party = src('src/ui/partyPanel.js');
  const loader = party.slice(party.indexOf('export function createFaceLoader('));
  assert.ok(loader.indexOf('await morrowindFaceOf(pose)') < loader.indexOf('if (!fetchBytes || !palette) return null;'), 'the head first, before the record\'s data is asked');
  assert.match(party, /poseHeadImage\(pose, \{ px: HEAD_RECORD\.w \* HEAD_RECORD\.scale, ph: HEAD_RECORD\.h \* HEAD_RECORD\.scale \}\)/);
  // the plate: a head is drawn its picture's scale smaller, smooth; a record at whole pixels, square
  const social = new SocialState({ now: () => 1e12 });
  const m = (n) => ({ acct: `acct-${n}`, name: n, online: true, seen: 1e12, peers: [`peer-${n}`], p: null });
  social.apply({ t: 'social', k: 'state', acct: 'acct-me', name: 'Mac', friends: [], in: [], out: [], invites: [], party: { id: 'q1', leader: 'acct-me', members: [{ ...m('me'), acct: 'acct-me' }, m('Bran'), m('Cyl')] } });
  const [W, H, S] = [HEAD_RECORD.w * HEAD_RECORD.scale, HEAD_RECORD.h * HEAD_RECORD.scale, HEAD_RECORD.scale];
  const panel = createPartyPanel({ social, doc: plateDoc(), touch: false, faceLoader: async (p) => (p.race === 'Nord'
    ? { width: W, height: H, colors: new Uint8ClampedArray(W * H * 4), scale: S }
    : { width: 4, height: 5, colors: new Uint8ClampedArray(80) }) });
  const P = { px: 1, py: 2, loc: 'Daggerfall', in: 0, h: 5, hm: 6, f: 1, fm: 2, m: 1, mm: 2, gender: 'male', face: 2 };
  social.applyParty('acct-Bran', { ...P, race: 'Nord' });
  social.applyParty('acct-Cyl', { ...P, race: 'Redguard' });
  panel.render({});
  await tick();
  panel.render({});
  const bran = panel.cardFor('acct-Bran'), cyl = panel.cardFor('acct-Cyl');
  assert.deepEqual([bran.pix.width, bran.pix.height, bran.pix.style.width, bran.pix.style.height, bran.pix.style.imageRendering],
    [W, H, `${HEAD_RECORD.w}px`, `${HEAD_RECORD.h}px`, 'auto'], 'the head at the record\'s size, its pixels smooth');
  assert.deepEqual([cyl.pix.style.width, cyl.pix.style.height, cyl.pix.style.imageRendering], ['24px', '30px', ''], 'the record at whole pixels, as before');
  panel.destroy();
  // the stamp: none without a renderer; with one, the data's generation once the heads' module is in
  _setHeadDataForTests(STORE(9));
  try {
    assert.equal(headSuffix(), '', 'no renderer: no head, no stamp');
    setPortraitRenderer(countingRenderer());
    headSuffix();
    await tick();
    assert.equal(headSuffix(), '|mw9');
    _setHeadDataForTests(STORE(9, 0));
    assert.equal(headSuffix(), '', 'the data gone: the record\'s key again');
  } finally { _setHeadDataForTests(null); setPortraitRenderer(null); }
  assert.match(party, /const key = p \? `\$\{faceKeyOf\(p\)\}\$\{headSuffix\(\)\}` : null;/);
  for (const page of ['src/ui/familyPages.js', 'src/ui/legacy/legacySuccession.js']) {
    assert.match(src(page), /if \(img\.scale > 0\) Object\.assign\(cv\.style, \{ width: `\$\{img\.width \/ img\.scale\}px`, height: `\$\{img\.height \/ img\.scale\}px`, imageRendering: 'auto' \}\);/, `${page}: the head at the record's size, smooth`);
  }
});

test('PORTRAIT3D: the escorts\' faces - an adult\'s face of the race\'s heads is the Morrowind head of their own race and sex at that face, at a record\'s size; a child\'s, a fixed NPC\'s painted face and no data keep theirs; resolved again as the data comes and goes, the record never drawn over a head', () => {
  const face = (o = {}) => ({ targetRace: RACES.DarkElf, gender: GENDERS.Female, faceIndex: 3, isChild: false, factionFaceIndex: -1, ...o });
  _setHeadDataForTests(STORE(7));
  try {
    assert.equal(escortHeadKey(face()), 'mwhead#escort#DarkElf|female|3|7', 'their own race - the classic drew a Dark Elf as a Breton');
    assert.equal(escortHeadKey(face({ gender: GENDERS.Male, targetRace: RACES.Redguard, faceIndex: 0 })), 'mwhead#escort#Redguard|male|0|7');
    assert.equal(escortHeadKey(face({ isChild: true })), null, 'Morrowind has no children');
    assert.equal(escortHeadKey(face({ factionFaceIndex: 12 })), null, 'a fixed NPC\'s painted face is theirs');
    _setHeadDataForTests(STORE(7, 0));
    assert.equal(escortHeadKey(face()), null, 'no data');
  } finally { _setHeadDataForTests(null); }
  const esc = src('src/ui/hud/hudEscortFaces.js');
  assert.match(esc, /const panel = \{ special, img: \(head && _textures\.get\(head\)\) \|\| \(_textures\.get\(`\$\{file\}#\$\{record\}`\) \?\? null\) \};/);
  assert.match(esc, /if \(!\(head && _textures\.has\(head\)\)\) panel\.img = _textures\.get\(key\);/, 'a record landing late is not drawn over the head');
  assert.match(esc, /if \(headDataStamp\(\) !== _headStamp\) refreshFaces\(\);/);
  assert.match(esc, /tex: _deps\.renderer\.uploadTexture\('img', key, toScreenOrder\(img\)\), w: HEAD_RECORD\.w, h: HEAD_RECORD\.h/, 'drawn at a record\'s size');
});

test('PORTRAIT3D: the tab dial\'s face - the player\'s Morrowind head first, trimmed to its painted pixels, drawn at CLASSIC_FACE_MAX at most and smooth (the root says so, and its rule lifts the pixels\' squaring off that door alone); the record where none is drawn', () => {
  const W = 10, H = 12;
  const data = new Uint8Array(W * H * 4);
  for (let y = 3; y <= 8; y++) for (let x = 2; x <= 5; x++) data.set([x, y, 9, 255], (y * W + x) * 4);
  assert.deepEqual(alphaBox({ width: W, height: H, data }), [2, 3, 4, 6]);
  const pic = headDialPicture({ width: W, height: H, data });
  assert.deepEqual([pic.width, pic.height, pic.scale, pic.smooth], [4, 6, CLASSIC_FACE_MAX / HEAD_DIAL_PX, true]);
  assert.deepEqual([...pic.rgba.slice(0, 4)], [2, 3, 9, 255], 'its first pixel the box\'s corner');
  assert.deepEqual([...pic.rgba.slice(-4)], [5, 8, 9, 255], 'its last the far one');
  assert.ok(HEAD_DIAL_PX * pic.scale <= CLASSIC_FACE_MAX, 'no head outgrows the rose');
  assert.equal(headDialPicture({ width: 2, height: 2, data: new Uint8Array(16) }), null, 'an empty picture: none');
  assert.equal(headDialPicture(null), null);
  // the root: the face door smooth for a head, square again for a record
  const props = new Map();
  const root = { dataset: {}, style: { setProperty: (k, v) => props.set(k, v) } };
  const doc = { documentElement: root, createElement: () => ({ getContext: () => ({ putImageData() {} }), toDataURL: () => 'data:image/png;base64,' }) };
  const had = globalThis.ImageData;
  globalThis.ImageData = class { constructor(d, w, h) { Object.assign(this, { data: d, width: w, height: h }); } };
  try {
    assert.equal(wearClassicDial(doc, { skills: pic }), 1);
    assert.equal(root.dataset.grimDialFace, 'head');
    assert.equal(props.get('--dial-classic-w-skills'), `${Math.round(4 * pic.scale)}px`);
    wearClassicDial(doc, { skills: { width: 2, height: 2, rgba: new Uint8ClampedArray(16), scale: 3 } });
    assert.equal(root.dataset.grimDialFace, undefined, 'a record: square pixels');
  } finally { if (had === undefined) delete globalThis.ImageData; else globalThis.ImageData = had; }
  const dial = src('src/ui/dialClassicArt.js');
  const read = dial.slice(dial.indexOf('export async function readClassicDial('));
  assert.ok(read.indexOf('await readHeadDial(entity)') < read.indexOf('const f = faceSourceOf(entity);'), 'the head first, the record where none is drawn');
  assert.match(src('src/ui/grimoireDress.js'), /\[data-grim-dial-art="classic"\]\[data-grim-dial-face="head"\] \.px-dial \.px-arm\[data-grim-icon="skills"\] \.px-c \{ image-rendering: auto; \}/);
});

test('PORTRAIT3D: the rig follows the curse - setVampire rebuilds the body with the vampire\'s head and back, one build a change and a boolean compare otherwise; asked mid-build it waits for the build; the standing arm counts as the entity\'s only with the curse matching, and the frame asks', async () => {
  const { createFpArm } = await import('../../src/combat/fpArm.js');
  const { retailBodyDeps, countingRenderer: bodyRenderer } = await import('../fixtures/mw/bodyRig.mjs');
  const { armsStandFor } = await import('../../src/combat/weapon/weaponRig.js');
  const base = retailBodyDeps({});
  let opened = 0;
  const deps = { ...base, loadMorrowindArchives: async () => { opened++; return base.loadMorrowindArchives(); } };
  const arm = createFpArm();
  arm.attach(bodyRenderer(), () => null);
  const first = await arm.build({ race: 'fprace', reachSweep: false, deps });
  assert.equal(first.ok, true, `${first.stage}: ${first.error}`);
  assert.equal(arm.builtFor().vampire, false);
  const n = opened;
  assert.equal(arm.setVampire(false), false, 'no change, no build');
  const turned = await arm.setVampire(true);
  assert.equal(turned.ok, true, `${turned.stage}: ${turned.error}`);
  assert.deepEqual([arm.builtFor().vampire, opened], [true, n + 1], 'one build, and the vampire stands');
  assert.equal(arm.setVampire(true), false, 'the fast path');
  // asked while a build runs: it waits, and the build after it takes it
  const running = arm.build({ race: 'fprace', reachSweep: false, vampire: true, deps });
  assert.equal(arm.setVampire(false), false, 'mid-build: queued, not built');
  await running;
  for (let i = 0; i < 50 && arm.builtFor()?.vampire !== false; i++) await new Promise((res) => setTimeout(res, 10));
  assert.equal(arm.builtFor().vampire, false, 'the cure, built once the build in flight stood');
  // the standing arm is the entity's only with its curse
  const ent = { race: 'Breton', gender: 'male', faceIndex: 0, activeEffects: [{ kind: 'racialOverride', racial: 'vampirism' }] };
  const stood = { race: 'breton', female: false, faceIndex: 0, werewolf: false };
  assert.equal(armsStandFor(ent, { ready: () => true, builtFor: () => ({ ...stood, vampire: true }) }), true);
  assert.equal(armsStandFor(ent, { ready: () => true, builtFor: () => ({ ...stood, vampire: false }) }), false, 'the living face is not the vampire\'s');
  assert.match(src('src/combat/weapon/weaponRig.js'), /fpArm\.setWerewolf\(wolf, \{ skin: wolfSkin \}\);\n\s*fpArm\.setVampire\?\.\(!!liveVampirism\(entity\)\);/, 'the frame asks, beside the wolf');
});
