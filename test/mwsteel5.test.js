// MW-STEEL5 (2026-10-09, Mac: "Heres an updated fix for the integrated steel armor for the morrowind model. Theres also
// an issue where the helmet isnt positioned properly on the head but only for the new integrated model", with
// steel_armor.fbx and a screenshot of the set worn from behind, the scalp standing up through the closed helm's crown):
// MAC'S UPDATE, AND THE HELM ON THE GAME'S HEAD.
//
// One export now - the set with the closed helm, committed as it came - and the open helm MW-STEEL1's, alone. The
// breastplate's shoulders widened and its waist band an object of its own (the cuirass two shapes), the pauldrons
// remade, the closed helm a unit higher; and the helms raised HELM_LIFT up the head bone, where the game's head stands
// over the scene's. These pins hold the sources and the import, the cuirass's two shapes and the pauldrons' sides, and
// the lift: the open helm's alone, the crown over the lifted head by the clearance Mac fitted it with. (MW-FIT1: the
// closed helm hides the head now, as retail's closed helmets do, and stands where Mac's export puts it - a player's
// "the helmet elevation is too much" and "the coif has to cover the neck"; test/mwfit1.test.js.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { readFbx } from '../tools/fbxRead.mjs';
import { stripFbx, meshModelNames } from '../tools/fbxStrip.mjs';
import {
  SOURCE, PIECES, HELM_LIFT, SCENE_BODY, importSteelPlate, openHelmSource, bakeObject, liftMesh, pieceMeshes, meshFile,
} from '../tools/bakeSteelPlate.mjs';
import { readLift, wornSet, scalpRatio, overFit, EYE_HEIGHTS, SCREENSHOT_SCALP_RATIO } from '../tools/helmLiftProbe.mjs';

const raw = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const nifBatches = (id) => flattenNif(parseNif(new Uint8Array(raw(meshFile(id)))));
const trees = { set: readFbx(raw(SOURCE.set)), openHelm: readFbx(raw(SOURCE.openHelm)) };
const piece = (id) => PIECES.find((p) => p.id === id);
const zRange = (positions) => {
  let lo = Infinity; let hi = -Infinity;
  for (let i = 2; i < positions.length; i += 3) { lo = Math.min(lo, positions[i]); hi = Math.max(hi, positions[i]); }
  return [lo, hi];
};

test('MW-STEEL5: the set\'s source is Mac\'s export as it came - the closed helm its helm, no Morrowind body to strip; the open helm is MW-STEEL1\'s, alone', () => {
  const set = raw(SOURCE.set);
  assert.deepEqual(meshModelNames(set), ['Breton_Male.001', 'Breton_Male.007', 'Breton_Male.009 Remeshed.001', 'Breton_Male.009 Remeshed.003', 'Cube.019', 'Cube.024',
    'Imperial_Silver_Cuirass_67_Male.011', 'Imperial_Silver_Cuirass_67_Male.012', 'Imperial_Silver_Cuirass_67_Male.013',
    'Imperial_Steel_Left_Gauntlet_20_Male', 'Imperial_Steel_Left_Gauntlet_20_Male.001', 'Sphere', 'Sphere.001 Remeshed Remeshed']);
  // an export with no Morrowind head or neck is committed byte for byte, and nothing measured
  const imported = importSteelPlate(set);
  assert.equal(Buffer.compare(imported.set, set), 0, 'the import is the export');
  assert.equal(imported.reference, null);
  // the open helm's source is that helm alone - taking it out again changes nothing
  assert.equal(Buffer.compare(openHelmSource(raw(SOURCE.openHelm)), raw(SOURCE.openHelm)), 0);
  assert.deepEqual(PIECES.filter((p) => p.file === 'openHelm').map((p) => p.id), ['helm_open']);
  // the wrong file, or one short a piece, is refused by name
  assert.throws(() => openHelmSource(set), /this export carries no open helm \("Sphere\.002"\)/);
  assert.throws(() => importSteelPlate(raw(SOURCE.openHelm)), /not the steel-plate export - it carries no "Imperial_Silver_Cuirass_67_Male\.013"/);
  assert.throws(() => importSteelPlate(stripFbx(set, { drop: ['Imperial_Silver_Cuirass_67_Male.012'] }).bytes), /carries no "Imperial_Silver_Cuirass_67_Male\.012"$/);
  // a piece standing past its read box is refused before anything is written
  const moved = PIECES.map((p) => (p.id !== 'boot_right' ? p : { ...p, shapes: [{ ...p.shapes[0], box: [p.shapes[0].box[0], [11.33, 14.61, 48.2]] }] }));
  assert.throws(() => importSteelPlate(set, { pieces: moved }), /"Cube\.024" stands at .* not where its piece was read/);
  // an export carrying the body it was fitted on loses it, measured first, and keeps the rest byte for byte - aimed
  // here at an object this export does carry, the closed helm's shell standing in for the Breton's head
  const withBody = importSteelPlate(set, { pieces: PIECES.filter((p) => p.id !== 'helm_closed'), reference: { head: 'Sphere', neck: 'Breton_Male.006' } });
  assert.deepEqual(withBody.reference, { head: bakeObject(trees.set, 'Sphere').bounds }, 'the part it carries measured, the one it does not left out');
  assert.equal(meshModelNames(withBody.set).includes('Sphere'), false);
  assert.equal(Buffer.compare(withBody.set, stripFbx(set, { drop: ['Sphere'] }).bytes), 0);
  // what no piece reads rides along, said: the committed export has nothing unread; the closed helm unread when no piece
  // reads it
  assert.deepEqual(imported.unread, []);
  assert.deepEqual(importSteelPlate(set, { pieces: PIECES.filter((p) => p.id !== 'helm_closed') }).unread, ['Sphere', 'Sphere.001 Remeshed Remeshed']);
  // the open helm's strip keeps that one object and every record of it byte for byte - aimed at the set's closed shell,
  // since the committed open-helm source is that helm alone already
  const aimed = [{ id: 'helm_open', file: 'openHelm', shapes: [{ object: 'Sphere' }] }];
  const shell = openHelmSource(set, { pieces: aimed });
  assert.deepEqual(meshModelNames(shell), ['Sphere']);
  assert.equal(Buffer.compare(shell, stripFbx(set, { drop: meshModelNames(set).filter((x) => x !== 'Sphere') }).bytes), 0);
});

test('MW-STEEL5: the cuirass is the breastplate and its waist band - two shapes in the breastplate\'s painting, both the chest\'s; the pauldrons Mac\'s new pair, each on its own side', () => {
  assert.deepEqual(piece('cuirass').shapes.map((s) => [s.object, s.texture]), [['Imperial_Silver_Cuirass_67_Male.013', 'cuirass'], ['Imperial_Silver_Cuirass_67_Male.012', 'cuirass']]);
  const cuirass = nifBatches('cuirass');
  assert.deepEqual(cuirass.map((b) => [b.name, b.material.textureFile, b.positions.length / 3]), [['Tri Chest 0', 'steel_plate_cuirass.dds', 301], ['Tri Chest 1', 'steel_plate_cuirass.dds', 56]]);
  // the band rides the waist - the pelvis and the spine over it - where the breastplate's own waist does
  assert.deepEqual(cuirass[1].skin.bones.map((b) => b.name), ['bip01 pelvis', 'bip01 spine', 'bip01 spine1']);
  const [bandLo, bandHi] = zRange(cuirass[1].positions);
  const [plateLo] = zRange(cuirass[0].positions);
  assert.ok(bandLo > plateLo && bandHi < 90, `the band at the waist (${bandLo.toFixed(2)} to ${bandHi.toFixed(2)})`);
  // the pauldrons traded names: the `.003` stands at +X, the right
  assert.deepEqual([piece('pauldron_right').shapes[0].object, piece('pauldron_left').shapes[0].object], ['Breton_Male.009 Remeshed.003', 'Breton_Male.009 Remeshed.001']);
  for (const [id, sign] of [['pauldron_right', 1], ['pauldron_left', -1]]) {
    const [b] = nifBatches(id);
    let x = 0; for (let i = 0; i < b.positions.length; i += 3) x += b.positions[i];
    assert.equal(Math.sign(x), sign, `${id} on its own side`);
  }
});

test('MW-STEEL5: the open helm stands HELM_LIFT up the head bone over where Mac fitted it, the crown over the game\'s head by the clearance Mac gave the scene\'s; the closed helm where Mac\'s export puts it (MW-FIT1); nothing else moves', () => {
  assert.equal(HELM_LIFT, 4);
  assert.deepEqual(PIECES.map((p) => [p.id, p.lift ?? 0]).filter(([, l]) => l), [['helm_open', 4]], 'the open helm alone - the closed one hides the head (MW-FIT1)');
  // MW-STEEL1's fit: both shells from 112.88 to 131.82, the scene's head crowned at 129.20 under them; Mac's export a
  // unit higher for the closed one
  assert.deepEqual(piece('helm_open').shapes[0].box.map((c) => c[2]), [112.88, 131.82]);
  assert.deepEqual(piece('helm_closed').shapes[0].box.map((c) => c[2]), [113.88, 132.82]);
  assert.deepEqual([overFit('open'), overFit('closed')], [HELM_LIFT, 1], 'each shipped helm over MW-STEEL1\'s fit: the open its lift, the closed its export\'s unit');
  // the clearance Mac fitted over the scene's head, kept over the game's head by raising the shell with it: so the
  // crown stands at MW-STEEL1's 131.82 plus the lift - which is what is checked, said as what it is
  const fitted = 131.82 - SCENE_BODY.head.max[2];
  assert.ok(Math.abs(fitted - 2.62) < 0.01, `Mac's clearance over the scene's crown, ${fitted.toFixed(2)}`);
  const [lo, hi] = zRange(nifBatches('helm_open')[0].positions);
  assert.ok(Math.abs(hi - 131.82 - HELM_LIFT) < 0.01, `the open crown at ${hi.toFixed(2)}, MW-STEEL1's 131.82 raised ${HELM_LIFT}`);
  assert.ok(Math.abs(lo - 112.88 - HELM_LIFT) < 0.01, `the rim lifted with it (${lo.toFixed(2)})`);
  const [closedLo, closedHi] = zRange(nifBatches('helm_closed')[0].positions);
  assert.ok(Math.abs(closedLo - 113.88) < 0.01 && Math.abs(closedHi - 132.82) < 0.01, `the closed shell where Mac's export stands it (${closedLo.toFixed(2)} to ${closedHi.toFixed(2)})`);
  // the head, lifted, inside the open shell across and front to back as in the scene
  const shell = nifBatches('helm_open')[0].positions;
  for (const k of [0, 1]) {
    let lo = Infinity; let hi = -Infinity;
    for (let i = k; i < shell.length; i += 3) { lo = Math.min(lo, shell[i]); hi = Math.max(hi, shell[i]); }
    assert.ok(lo < SCENE_BODY.head.min[k] && (k === 1 || hi > SCENE_BODY.head.max[k]), `the head inside the shell on ${'xy'[k]}`);
  }
  // every NIF is its objects in the scene's placement - the helms lifted, nothing else
  for (const p of PIECES) {
    const scene = p.shapes.map((s) => bakeObject(trees[p.file], s.object, s.box));
    nifBatches(p.id).forEach((b, i) => {
      let worst = 0;
      for (let k = 0; k < b.positions.length; k++) worst = Math.max(worst, Math.abs(b.positions[k] - scene[i].positions[k] - (k % 3 === 2 ? p.lift ?? 0 : 0)));
      assert.ok(worst < 1e-4, `${p.id} shape ${i}: the scene's${p.lift ? `, ${p.lift} up` : ''} (worst ${worst})`);
    });
  }
  // the lift moves height alone, bounds with it, and no lift is the mesh itself
  const m = { positions: [1, 2, 3, 4, 5, 6], bounds: { min: [1, 2, 3], max: [4, 5, 6] }, indices: [0] };
  assert.equal(liftMesh(m, 0), m);
  assert.deepEqual(liftMesh(m, 1.5), { positions: [1, 2, 4.5, 4, 5, 7.5], bounds: { min: [1, 2, 4.5], max: [4, 5, 7.5] }, indices: [0] });
  assert.deepEqual(pieceMeshes(trees, piece('helm_open'))[0].bounds.max[2], +(bakeObject(trees.openHelm, 'Sphere.002').bounds.max[2] + HELM_LIFT).toFixed(6));
});

test('MW-STEEL5: the evidence, re-run (tools/helmLiftProbe.mjs) - the screenshot\'s scalp is the head standing 3.2 to 4.3 up its bone over the scene\'s, HELM_LIFT stands in that span, and the shipped open helm shows no scalp across it', async () => {
  assert.equal(SCREENSHOT_SCALP_RATIO, 0.39);
  const { rows, lo, hi } = await readLift();
  assert.deepEqual(rows.map((r) => r.eyeZ), [118, 130, 145]);
  for (const r of rows) {
    assert.ok(r.raise != null && r.raise > 2.5 && r.raise < 5.5, `eye ${r.eyeZ}: the screenshot's scalp at a raise of ${r.raise}`);
    assert.ok(r.ratios.every((x, i) => i === 0 || x >= r.ratios[i - 1]), `eye ${r.eyeZ}: the higher the head, the more scalp`);
  }
  assert.ok(lo <= HELM_LIFT && HELM_LIFT <= hi, `HELM_LIFT ${HELM_LIFT} within the probe's ${lo.toFixed(2)} to ${hi.toFixed(2)}`);
  // the head where the scene put it shows no scalp in MW-STEEL1's helm - and the game's, raised across the whole span
  // and a unit past it, none in the shipped open helm, the one helm with a head under it since MW-FIT1
  const set = await wornSet();
  const open = await wornSet('open');
  for (const eyeZ of EYE_HEIGHTS) {
    assert.equal(scalpRatio(set, { raise: 0, eyeZ }), 0, `eye ${eyeZ}: the scene's head inside the scene's helm`);
    assert.equal(scalpRatio(open, { raise: 0, eyeZ }), 0, `eye ${eyeZ}: the scene's head inside the scene's open helm`);
    assert.equal(scalpRatio(open, { raise: hi + 0.75, eyeZ, helm: 'shipped' }), 0, `eye ${eyeZ}: the game's head inside the shipped open helm`);
  }
  // and lowered to where the closed helm ships, that helm would show it - which is why it hides the head (MW-FIT1)
  assert.ok(EYE_HEIGHTS.some((eyeZ) => scalpRatio(set, { raise: lo, eyeZ, helm: 'shipped' }) > 0), 'the closed helm, unlifted, is no hat for the game\'s head');
});

