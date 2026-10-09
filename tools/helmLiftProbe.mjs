// THE HELM LIFT, RE-READ - the evidence for tools/bakeSteelPlate.mjs HELM_LIFT, as a probe anyone can run.
//
//     node tools/helmLiftProbe.mjs
//         for each height of eye, the scalp-over-helm ratio at each raise of the head, and the raise that gives the
//         ratio Mac's screenshot shows
//
// MW-STEEL5 (2026-10-09, Mac: "Theres also an issue where the helmet isnt positioned properly on the head but only for
// the new integrated model", with a screenshot of the set worn, from behind: the scalp standing up through the closed
// helm's crown). AUDIT MW-STEEL5: the probe that read HELM_LIFT ran off the tree, so the number could not be re-run;
// this is it. It draws no game data: the set is the port's own (the shipped NIFs), the skeleton the vendored retail
// hierarchy (RETAIL_SKELETON), and the head a STAND-IN - SCENE_BODY's box as an ellipsoid, the bounds of the Breton head
// Mac's scene fitted the helms on, carried by the head bone as a rigid head is. The screenshot itself is the game's
// head drawn, a render of the player's own data, and is not committed: what is kept of it is one number,
// SCREENSHOT_SCALP_RATIO.
//
// HOW IT READS. The set is worn on the retail skeleton in its idle (its rest) through the binder the game uses. The
// closed helm is put back where the screenshot drew it - MW-STEEL1's fit, the shipped helm lowered HELM_LIFT up the head
// bone (Mac's new export raised it 1 and the bake HELM_LIFT - 1). The stand-in head is raised `raise` up the head bone
// over where the scene put it, and the pair is drawn from behind (an id per pixel, perspective, depth-tested). Down the
// column through the helm, beside the plume: the rows of head above the shell's first row, over the rows of shell under
// it - the ratio the screenshot measures. Mac's camera's height is not known, so three heights of eye are read; each
// gives the raise at which the ratio crosses the screenshot's, and HELM_LIFT is held inside their span
// (test/mwsteel5.test.js).
//
// WHAT IT DOES NOT RULE OUT. A head bigger than the scene's Breton (the screenshot's race is not recorded) would show
// the same scalp at a smaller raise, and a shot from behind sees nothing of an offset front to back.
import { readFileSync } from 'node:fs';
import { assembleFirstPersonArm } from '../src/formats/mwFirstPerson.js';
import { composeWornArmor } from '../src/formats/mwItemMap.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { HELM_LIFT, SCENE_BODY, RETAIL_SKELETON, plateBind } from './bakeSteelPlate.mjs';
import { isMain } from './lib/isMain.mjs';

/** Mac's screenshot (968x2376), the column through the helm's centre: skin from row 521 to 575, the helm under it to
 *  its rim at 713 - 54 rows of scalp over 138 of helm. */
export const SCREENSHOT_SCALP_RATIO = 0.39;
/** The heights of eye read (scene units; the shoulders stand at ~117, the helm's crown at ~132), and the raises. */
export const EYE_HEIGHTS = Object.freeze([118, 130, 145]);
export const RAISES = Object.freeze([2, 3, 4, 5, 6]);
const VIEW = Object.freeze({ back: 75, target: [0, 0, 112], width: 400, height: 560, fov: 55, column: 210 });
const ID = Object.freeze({ none: 0, shell: 1, visor: 2, body: 3, head: 4 });

/** The Steel set worn on the retail skeleton at rest, through the binder; `helm` its closed helm's two shapes. */
export async function wornSet() {
  const steel = [102, 103, 104, 105, 106, 107, 108].map((templateIndex) => ({ templateIndex, material: ARMOR_MATERIAL.Steel }));
  const worn = composeWornArmor({ pieces: steel, armors: [], bodyPool: [], helmStyle: 'closed' });
  const skeletonBytes = new Uint8Array(readFileSync(new URL(`../${RETAIL_SKELETON}`, import.meta.url)));
  // no attach bones: the plate ships skinned, rebound by its own bones' names (rule 12), and the vendored hierarchy
  // carries none of base_anim's part nodes to attach at
  const parts = worn.adds.map((a) => ({ slot: a.slot, partName: a.partName, bones: [],
    bytes: new Uint8Array(readFileSync(new URL(`../src/assets/mw/meshes/${a.model}`, import.meta.url))) }));
  const asm = await assembleFirstPersonArm({ skeletonBytes, parts });
  if (!asm.ok) throw new Error(asm.error);
  return { asm, bind: plateBind(skeletonBytes).get('Bip01 Head'), head: asm.mats.get(asm.skeleton.byName.get('bip01 head')) };
}

const unbind = (m, p) => { const d = [p[0] - m.t[0], p[1] - m.t[1], p[2] - m.t[2]]; return [0, 1, 2].map((c) => m.a[c] * d[0] + m.a[3 + c] * d[1] + m.a[6 + c] * d[2]); };
const place = (m, p) => [0, 1, 2].map((r) => m.a[r * 3] * p[0] + m.a[r * 3 + 1] * p[1] + m.a[r * 3 + 2] * p[2] + m.t[r]);

/** The stand-in head raised `raise` up the head bone: SCENE_BODY's box as an ellipsoid in the scene, carried from the
 *  bind to the head bone's pose. */
export function standInHead({ bind, head }, raise) {
  const b = SCENE_BODY.head;
  const c = [0, 1, 2].map((k) => (b.min[k] + b.max[k]) / 2 + (k === 2 ? raise : 0));
  const r = [0, 1, 2].map((k) => (b.max[k] - b.min[k]) / 2);
  const positions = []; const indices = [];
  const nu = 24; const nv = 16;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const th = (j / nv) * Math.PI; const ph = (i / nu) * 2 * Math.PI;
      const s = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
      positions.push(...place(head, unbind(bind, [0, 1, 2].map((k) => c[k] + s[k] * r[k]))));
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i; const d = a + nu + 1; indices.push(a, d, a + 1, a + 1, d, d + 1); }
  return { positions, indices };
}

/** An id per pixel: each mesh's triangles, perspective, depth-tested - no culling, as drawCharacter culls nothing. */
function idBuffer(meshes, eye) {
  const { width: W, height: H, fov, target } = VIEW;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const nrm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const f = nrm(sub(target, eye)); const rt = nrm(cross(f, [0, 0, 1])); const up = cross(rt, f);
  const fl = (H / 2) / Math.tan((fov * Math.PI) / 360);
  const ids = new Uint8Array(W * H); const depth = new Float32Array(W * H).fill(Infinity);
  for (const { positions: P, indices: I, id, shift } of meshes) {
    const proj = (i) => {
      const p = sub([P[i * 3] - (shift ? shift[0] : 0), P[i * 3 + 1] - (shift ? shift[1] : 0), P[i * 3 + 2] - (shift ? shift[2] : 0)], eye);
      const z = dot(p, f);
      return [W / 2 + (dot(p, rt) / z) * fl, H / 2 - (dot(p, up) / z) * fl, z];
    };
    for (let t = 0; t < I.length; t += 3) {
      const s = [proj(I[t]), proj(I[t + 1]), proj(I[t + 2])];
      const area = (s[1][0] - s[0][0]) * (s[2][1] - s[0][1]) - (s[2][0] - s[0][0]) * (s[1][1] - s[0][1]);
      if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(s[0][0], s[1][0], s[2][0]))); const x1 = Math.min(W - 1, Math.ceil(Math.max(s[0][0], s[1][0], s[2][0])));
      const y0 = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1]))); const y1 = Math.min(H - 1, Math.ceil(Math.max(s[0][1], s[1][1], s[2][1])));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5; const py = y + 0.5;
          const w0 = ((s[1][0] - px) * (s[2][1] - py) - (s[2][0] - px) * (s[1][1] - py)) / area;
          const w1 = ((s[2][0] - px) * (s[0][1] - py) - (s[0][0] - px) * (s[2][1] - py)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * s[0][2] + w1 * s[1][2] + w2 * s[2][2];
          if (z >= depth[y * W + x]) continue;
          depth[y * W + x] = z; ids[y * W + x] = id;
        }
      }
    }
  }
  return ids;
}

/** The screenshot's measure, read off the probe's picture: down the column, the rows of head above the shell's first
 *  row over the rows of shell under it (0 when no head shows above it). `helm`: 'scene' - MW-STEEL1's fit, where the
 *  screenshot drew it - or 'shipped', where the bake stands it now. */
export function scalpRatio(set, { raise, eyeZ, helm: at = 'scene' }) {
  const { asm, head } = set;
  const up = [head.a[0], head.a[3], head.a[6]];   // the head bone's own X - the way the bake lifted the helm
  const back = at === 'scene' ? up.map((x) => x * HELM_LIFT) : null;
  const meshes = asm.pieces.map((p) => {
    const helm = p.slot.startsWith('hair');
    return { positions: p.positions, indices: p.indices, id: helm ? (/visor/.test(p.material?.textureFile ?? '') ? ID.visor : ID.shell) : ID.body, shift: helm ? back : null };
  });
  meshes.push({ ...standInHead(set, raise), id: ID.head, shift: null });
  const ids = idBuffer(meshes, [0, -VIEW.back, eyeZ]);
  const col = (y) => ids[y * VIEW.width + VIEW.column];
  let shellTop = -1;
  for (let y = 0; y < VIEW.height; y++) if (col(y) === ID.shell) { shellTop = y; break; }
  if (shellTop < 0) throw new Error('the column misses the helm');
  let shellEnd = shellTop;
  while (shellEnd < VIEW.height && col(shellEnd) === ID.shell) shellEnd++;
  let headTop = shellTop;
  for (let y = shellTop - 1; y >= 0 && col(y) === ID.head; y--) headTop = y;
  return (shellTop - headTop) / (shellEnd - shellTop);
}

/** For each height of eye, the ratio at each raise and the raise (interpolated) that gives the screenshot's ratio. */
export async function readLift({ eyes = EYE_HEIGHTS, raises = RAISES, target = SCREENSHOT_SCALP_RATIO } = {}) {
  const set = await wornSet();
  const rows = eyes.map((eyeZ) => {
    const ratios = raises.map((raise) => scalpRatio(set, { raise, eyeZ }));
    let raise = null;
    for (let i = 1; i < raises.length; i++) {
      if (ratios[i - 1] <= target && ratios[i] >= target && ratios[i] > ratios[i - 1]) {
        raise = raises[i - 1] + ((target - ratios[i - 1]) / (ratios[i] - ratios[i - 1])) * (raises[i] - raises[i - 1]);
        break;
      }
    }
    return { eyeZ, ratios, raise };
  });
  const found = rows.map((r) => r.raise).filter((r) => r != null);
  return { rows, lo: Math.min(...found), hi: Math.max(...found) };
}

if (isMain(import.meta.url)) {
  const r = await readLift();
  console.log(`scalp over helm, the column through the helm (the screenshot's: ${SCREENSHOT_SCALP_RATIO})`);
  console.log(`  eye   ${RAISES.map((x) => `raise ${x}`.padStart(9)).join('')}   -> the screenshot's at`);
  for (const row of r.rows) console.log(`  ${String(row.eyeZ).padEnd(5)} ${row.ratios.map((x) => x.toFixed(2).padStart(9)).join('')}   -> ${row.raise == null ? 'outside the raises' : row.raise.toFixed(2)}`);
  console.log(`  the head stands ${r.lo.toFixed(2)} to ${r.hi.toFixed(2)} up its bone over the scene's; HELM_LIFT is ${HELM_LIFT}`);
}
