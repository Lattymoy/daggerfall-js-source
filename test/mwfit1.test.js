// MW-FIT1 (2026-10-09, a player's report Mac passed on, over the paperdoll in both sets: "the upper arm is still
// visible with the steel armor", "the ebony armor gets the same issue", "the helmet elevation is too much", "the coif
// has to cover the neck"): WHAT THE PLATE COVERS.
//
// A pauldron of either set is a sleeve - it closes round the upper arm from the shoulder to the elbow, where the
// gauntlet's cuff takes over - so it hides the upper arm's skin, as a gauntlet hides the forearm's; and only in the
// third person, because the first person draws no pauldron and would show a hole. A closed helm is the head, as
// retail's closed helmets are: the steel plate's closed helm and the ebony helm hide it and stand where Mac fitted them
// on the body, the coif hung to the collar; the open helm shows the face and keeps it. These pins hold the sleeve on
// the meshes, the shadows in both persons, the head under each helm, and the neck under the coif in retail's idle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { assembleFirstPersonArm } from '../src/formats/mwFirstPerson.js';
import { composeWornArmor, fpWornAdds } from '../src/formats/mwItemMap.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { CLASSIC_ARMOR_TEMPLATE, ownArmorModelFor, ownArmorParts, STEEL_HELM_STYLES } from '../src/characters/ownArmorModels.js';
import { HELM_LIFT, SCENE_BODY, RETAIL_SKELETON, plateBind } from '../tools/bakeSteelPlate.mjs';

const raw = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const sourceText = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SKELETON = new Uint8Array(raw(RETAIL_SKELETON));
const BIND = plateBind(SKELETON);
const nif = (file) => flattenNif(parseNif(new Uint8Array(raw(`src/assets/mw/meshes/${file}`))));
const T = CLASSIC_ARMOR_TEMPLATE;
const piece = (templateIndex, metal) => ({ templateIndex, material: ARMOR_MATERIAL[metal] });
const compose = (pieces, helmStyle) => composeWornArmor({ pieces, armors: [], bodyPool: [], helmStyle });

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
/** Every triangle of a set of batches (positions as flattened, the file's own bind - the scene's placement). */
const triangles = (batches) => batches.flatMap((b) => Array.from({ length: b.indices.length / 3 }, (_, t) => [0, 1, 2].map((k) => {
  const v = b.indices[t * 3 + k];
  return [b.positions[v * 3], b.positions[v * 3 + 1], b.positions[v * 3 + 2]];
})));
/** Does a ray from `o` along `d` meet any of `tris` within `reach`? (Moller-Trumbore, both faces.) */
const meets = (o, d, tris, reach) => tris.some(([a, b, c]) => {
  const e1 = sub(b, a); const e2 = sub(c, a); const p = cross(d, e2); const det = dot(e1, p);
  if (Math.abs(det) < 1e-9) return false;
  const s = sub(o, a); const u = dot(s, p) / det; if (u < 0 || u > 1) return false;
  const q = cross(s, e1); const v = dot(d, q) / det; if (v < 0 || u + v > 1) return false;
  const t = dot(e2, q) / det;
  return t > 0 && t < reach;
});
/** How many of `n` rays square to the axis `ax`, out of `o`, meet `tris`. */
const ring = (o, ax, tris, n = 36, reach = 15) => {
  const u = unit(cross(ax, Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])); const w = cross(ax, u);
  let hit = 0;
  for (let k = 0; k < n; k++) {
    const th = (2 * Math.PI * k) / n;
    if (meets(o, u.map((x, i) => x * Math.cos(th) + w[i] * Math.sin(th)), tris, reach)) hit++;
  }
  return hit;
};

test('MW-FIT1: a pauldron is a sleeve - in both sets every ray out of the upper arm\'s bone line meets it from the shoulder to the elbow, where the gauntlet\'s cuff closes round the arm', () => {
  for (const metal of ['steel', 'ebony']) {
    for (const [side, S] of [['right', 'R'], ['left', 'L']]) {
      const pauldron = triangles(nif(`${metal}_plate_pauldron_${side}.nif`));
      const gauntlet = triangles(nif(`${metal}_plate_gauntlet_${side}.nif`));
      const shoulder = BIND.get(`Bip01 ${S} UpperArm`).t; const elbow = BIND.get(`Bip01 ${S} Forearm`).t;
      const ax = unit(sub(elbow, shoulder));
      for (let f = 0; f <= 1.0001; f += 0.1) {
        const o = shoulder.map((x, i) => x + (elbow[i] - x) * f);
        assert.equal(ring(o, ax, pauldron), 36, `${metal} ${side}: the pauldron round the upper arm ${(f * 100).toFixed(0)}% of the way to the elbow`);
      }
      assert.equal(ring(elbow, ax, gauntlet), 36, `${metal} ${side}: the gauntlet's cuff round the elbow`);
    }
  }
});

test('MW-FIT1: so each pauldron hides its upper arm in the third person - and not in the first, which draws no pauldron; what the first person does draw (a gauntlet) hides there too, and a robe\'s reserve is both persons\'', () => {
  for (const metal of ['Steel', 'Ebony']) {
    const left = compose([piece(T.Left_Pauldron, metal)]);
    const right = compose([piece(T.Right_Pauldron, metal)]);
    assert.deepEqual([left.shadows, right.shadows], [['upperarm:left'], ['upperarm:right']], `${metal}: each pauldron its own side's upper arm`);
    assert.deepEqual([left.fpShadows, right.fpShadows], [[], []], `${metal}: the first person keeps the upper arm`);
    assert.deepEqual(fpWornAdds([...left.adds, ...right.adds]), [], 'the first person draws no pauldron');
    // a gauntlet is drawn in the first person, so what it hides is hidden there as well
    const hands = compose([piece(T.Gauntlets, metal)]);
    assert.deepEqual(hands.fpShadows, hands.shadows);
    assert.deepEqual(hands.shadows, ['hand:right', 'hand:left', 'wrist:right', 'wrist:left', 'forearm:right', 'forearm:left']);
  }
  // a reserve with nothing over it is the first person's too: a robe takes the arms in both (Morrowind-Rules.md, "In
  // first person a robe leaves hands and wrists but deletes the forearms and upper arms")
  const robe = composeWornArmor({ pieces: [{ kind: 'record', record: { id: 'robe', parts: [] }, reserve: 'robe' }, piece(T.Left_Pauldron, 'Steel')], armors: [], bodyPool: [] });
  assert.ok(robe.fpShadows.includes('upperarm:left') && robe.fpShadows.includes('upperarm:right'), 'the robe\'s upper arms, over the pauldron\'s');
  // the first person's skin reads its own shadows; the third person's the third person's
  const fp = sourceText('src/combat/fpArm.js');
  assert.match(fp, /const fpRows = shadowSkinRows\([\s\S]{0,200}?worn\.fpShadows \?\? worn\.shadows\);/);
  assert.match(fp, /let skinRows = shadowSkinRows\([\s\S]{0,200}?worn\.shadows\);/);
});

test('MW-FIT1: a closed helm is the head - the steel plate\'s closed helm and the ebony helm hide it, as retail\'s closed helmets fill its slot; the open helm shows the face and keeps it; each takes the hair', () => {
  const steelHelm = [piece(T.Helm, 'Steel')];
  assert.deepEqual(STEEL_HELM_STYLES, ['closed', 'open']);
  assert.deepEqual(compose(steelHelm).shadows, ['head', 'hair'], 'the closed steel helm, the default');
  assert.deepEqual(compose(steelHelm, 'closed').shadows, ['head', 'hair']);
  assert.deepEqual(compose(steelHelm, 'open').shadows, ['hair'], 'the open helm leaves the head');
  assert.deepEqual(compose([piece(T.Helm, 'Ebony')]).shadows, ['head', 'hair'], 'the ebony helm is closed');
  // the helm's own mesh stays in the hair slot (its shapes are named for it - rule 15); the head is occupied with none
  for (const [metal, style] of [['Steel', 'closed'], ['Steel', 'open'], ['Ebony', undefined]]) {
    const worn = compose([piece(T.Helm, metal)], style);
    assert.deepEqual(worn.adds.map((a) => a.partName), ['hair'], `${metal} ${style ?? ''}: one add, the hair's`);
    assert.deepEqual(ownArmorParts(ownArmorModelFor(piece(T.Helm, metal)), { helmStyle: style }).map((p) => p.hides ?? []), [style === 'open' ? [] : ['head']]);
  }
});

test('MW-FIT1: the closed helms stand where Mac fitted them on the body - in retail\'s idle the ebony coif closes round the neck from the collar up, and the steel visor round most of it; raised as they were (HELM_LIFT), a band of neck shows under both', async () => {
  const worn = (metal) => compose([T.Cuirass, T.Greaves, T.Left_Pauldron, T.Right_Pauldron, T.Helm].map((t) => piece(t, metal)));
  const nb = SCENE_BODY.neck; const cx = (nb.min[0] + nb.max[0]) / 2; const cy = (nb.min[1] + nb.max[1]) / 2;
  const unbind = (m, p) => { const d = sub(p, m.t); return [0, 1, 2].map((c) => m.a[c] * d[0] + m.a[3 + c] * d[1] + m.a[6 + c] * d[2]); };
  const place = (m, p) => [0, 1, 2].map((r) => m.a[r * 3] * p[0] + m.a[r * 3 + 1] * p[1] + m.a[r * 3 + 2] * p[2] + m.t[r]);
  const covered = {};
  for (const metal of ['Ebony', 'Steel']) {
    const parts = worn(metal).adds.map((a) => ({ slot: a.slot, partName: a.partName, bones: [], bytes: new Uint8Array(raw(`src/assets/mw/meshes/${a.model}`)) }));
    const asm = await assembleFirstPersonArm({ skeletonBytes: SKELETON, parts });
    assert.ok(asm.ok, asm.error);
    const neckBind = BIND.get('Bip01 Neck'); const neck = asm.mats.get(asm.skeleton.byName.get('bip01 neck'));
    const head = asm.mats.get(asm.skeleton.byName.get('bip01 head'));
    const up = [head.a[0], head.a[3], head.a[6]];   // the head bone's own X - the way MW-STEEL5 raised the helms
    for (const lift of [0, HELM_LIFT]) {
      const tris = asm.pieces.flatMap((p) => {
        const helm = p.slot.startsWith('hair');
        return Array.from({ length: p.indices.length / 3 }, (_, t) => [0, 1, 2].map((k) => {
          const v = p.indices[t * 3 + k];
          return [0, 1, 2].map((c) => p.positions[v * 3 + c] + (helm ? up[c] * lift : 0));
        }));
      });
      // the scene's neck, carried on the neck bone into the idle: rays square to it, from the collar to the jaw
      covered[`${metal} ${lift}`] = [110, 111, 112, 113, 114, 115, 116, 117].map((z) => {
        const o = place(neck, unbind(neckBind, [cx, cy, z]));
        return ring(o, unit(sub(place(neck, unbind(neckBind, [cx, cy, z + 1])), o)), tris, 36, 20);
      });
    }
  }
  assert.ok(covered['Ebony 0'].slice(0, 6).every((n) => n === 36), `the ebony coif round the neck from 110 to 115: ${covered['Ebony 0']}`);
  assert.ok(covered['Steel 0'].every((n) => n >= 26), `the steel visor and breastplate round most of the neck at every height: ${covered['Steel 0']}`);
  assert.ok(covered[`Ebony ${HELM_LIFT}`].some((n) => n < 30), `raised, the ebony coif leaves the neck bare: ${covered[`Ebony ${HELM_LIFT}`]}`);
  assert.ok(covered[`Steel ${HELM_LIFT}`].some((n) => n < 10), `raised, the steel helm leaves a band of neck: ${covered[`Steel ${HELM_LIFT}`]}`);
});
