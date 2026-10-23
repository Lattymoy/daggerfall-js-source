// PISTOL-STANCE SHEETS (bible/05-Combat/Dwarven-Pistolet.md PISTOL-STANCE): the vendored retail biped
// (test/fixtures/mw/retailRig.mjs - no Morrowind data in hand) in the port's steel plate, holding the shipped Dwarven Pistolet
// (and a pair's second), posed through poseAssembly's own `hold` slot by the stance the arm uses (combat/gun/gunHold.js),
// rasterised flat-shaded with a depth buffer and written as PNG pictures - so the stance can be SEEN, as the owner picked
// it, not trusted. The arms the plate leaves bare are drawn as rods.
//
//   pistol-stance.png  one row each - one pistol idle, one pistol aimed, a pair idle, a pair aimed; columns the three-quarter
//                      front, the right side, the three-quarter back (the body's left), and the first person through the
//                      game's lens from a camera at the eye (the MW-STEEL4 stand-in), the crosshair at its middle
//   pistol-grip.png    the right hand on the pistol, close, idle and aimed, from the gun's right and left: the retail fist's
//                      finger bones in red over the plate, so where the fist closes on the grip reads
//
// Usage: node tools/pistolStanceSheet.mjs [outDir]   (outDir defaults to scratch/pistol-stance, which git ignores)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { retailSkeleton } from '../test/fixtures/mw/retailRig.mjs';
import { OWN_MW_MODELS } from '../src/characters/ownModels/ownWeaponModels.js';
import { PISTOLET_TEMPLATE } from '../src/characters/thunderlockIds.js';
import { assembleFirstPersonArm, poseAssembly } from '../src/formats/morrowind/mwFirstPerson.js';
import { composeWornArmor } from '../src/formats/morrowind/mwItemMap.js';
import { resolveWeaponParts, resolveOffWeaponParts, archiveHas, FP_FIELD_OF_VIEW } from '../src/combat/fpArm.js';
import { applyGunStance } from '../src/combat/gun/gunHold.js';
import { writePng } from './pngIO.mjs';

const ROOT = new URL('../', import.meta.url);
const onDisk = (p) => new Uint8Array(readFileSync(new URL(p, ROOT)));
const GUN = { templateIndex: PISTOLET_TEMPLATE, group: 'Weapons', material: 4 };
/** The first person's stand-in: a camera node at retail's eye (test/combat/riflestance.test.js's). */
const EYE = [0, 6, 123];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };

/** The body: the plate, the pistol in the right hand and (a pair) its second on the Weapon Bone Left. */
async function body({ pair = false, first = false } = {}) {
  const skeletonBytes = retailSkeleton(first ? { extra: ['Camera'] } : {});
  const files = new Map([[`meshes/${OWN_MW_MODELS[PISTOLET_TEMPLATE].model}`, onDisk('src/assets/mw/meshes/pistolet.nif')]]);
  const arc = { has: (p) => files.has(p), get: (p) => files.get(p) };
  const find = (p) => (arc.has(p) ? arc : null), has = archiveHas([arc]);
  const res = resolveWeaponParts({ weapon: GUN, hasAmmo: true, allWeapons: [], find, skeletonBytes, has });
  const off = pair ? resolveOffWeaponParts({ weapon: GUN, allWeapons: [], find, skeletonBytes, has, hasBone: () => true }) : { parts: [] };
  const worn = composeWornArmor({ pieces: [102, 103, 104, 105, 106, 107, 108].map((t) => ({ templateIndex: t, material: 0x201 })), armors: [], bodyPool: [] });
  const parts = [...worn.adds.map((a) => ({ slot: a.slot, partName: a.partName, bones: a.bones, bytes: onDisk(`src/assets/mw/meshes/${a.model}`) })), ...res.parts, ...off.parts];
  const asm = await assembleFirstPersonArm({ skeletonBytes, parts, offWeaponBone: true });
  if (!asm.ok) throw new Error(asm.error);
  const cam = first ? asm.skeleton.byName.get('camera') : null;
  if (first) asm.skeleton.nodes.get(cam).rest.translation = EYE;
  return { asm, info: res.weaponInfo, cam, pair, view: first ? 'first' : 'third' };
}

/** Posed in the stance at `ready` (0 the idle, 1 the aim); answers the solver's fit. */
function pose(b, ready) {
  poseAssembly(b.asm, { hold: (sk, p, root, sm) => applyGunStance(b.info.holdAs, sk, p, root, sm, { w: 1, ready, view: b.view, eyeRef: b.cam, attitude: b.info.attitude, pair: b.pair }) });
  return b.asm.holdFit;
}

/** The body's frame off the posed skeleton - right shoulder to shoulder, up the spine - and its pelvis. */
function bodyAxes(asm) {
  const at = (n) => asm.mats.get(asm.skeleton.byName.get(n)).t;
  const right = norm(sub(at('bip01 r upperarm'), at('bip01 l upperarm')));
  let up = norm(sub(at('bip01 neck'), at('bip01 spine')));
  up = norm(sub(up, right.map((v) => v * dot(up, right))));
  return { right, up, fwd: cross(up, right), pelvis: at('bip01 pelvis') };
}

function canvas(W, H, bg) {
  const data = new Uint8Array(W * H * 4), z = new Float32Array(W * H).fill(Infinity);
  for (let i = 0; i < W * H; i++) data.set([bg[0], bg[1], bg[2], 255], i * 4);
  return { W, H, data, z };
}
function plot(c, x, y, zz, rgb) {
  if (x < 0 || y < 0 || x >= c.W || y >= c.H) return;
  const i = y * c.W + x;
  if (zz >= c.z[i]) return;
  c.z[i] = zz; c.data[i * 4] = rgb[0]; c.data[i * 4 + 1] = rgb[1]; c.data[i * 4 + 2] = rgb[2];
}
function tri(c, a, b, d, rgb) {
  const area = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
  if (Math.abs(area) < 1e-9) return;
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], d[0]))), x1 = Math.min(c.W - 1, Math.ceil(Math.max(a[0], b[0], d[0])));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], d[1]))), y1 = Math.min(c.H - 1, Math.ceil(Math.max(a[1], b[1], d[1])));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w0 = ((b[0] - px) * (d[1] - py) - (b[1] - py) * (d[0] - px)) / area, w1 = ((d[0] - px) * (a[1] - py) - (d[1] - py) * (a[0] - px)) / area, w2 = 1 - w0 - w1;
    if (w0 >= 0 && w1 >= 0 && w2 >= 0) plot(c, x, y, w0 * a[2] + w1 * b[2] + w2 * d[2], rgb);
  }
}
function rod(c, a, b, rgb, r, over = false) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])) + 1;
  for (let s = 0; s <= n; s++) {
    const t = s / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, zz = over ? -Infinity : a[2] + (b[2] - a[2]) * t - 0.5;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) plot(c, Math.round(x + dx), Math.round(y + dy), zz, rgb);
  }
}
const GOLD = [212, 170, 80], PLATE = [150, 158, 172], SKIN = [200, 160, 130], RED = [230, 60, 60];
const ARMS = [['bip01 r clavicle', 'bip01 r upperarm', 'bip01 r forearm', 'bip01 r hand'], ['bip01 l clavicle', 'bip01 l upperarm', 'bip01 l forearm', 'bip01 l hand']];
/** The posed assembly through `project(p) -> [x, y, depth]` (null behind the eye), flat-shaded. */
function draw(c, asm, project, { slots = null, fingers = null } = {}) {
  const light = norm([0.4, -0.6, 0.7]);
  for (const p of asm.pieces) {
    if ((slots && !slots.test(p.slot)) || !p.positions || !p.indices) continue;
    const v = p.positions, idx = p.indices, base = /weapon/.test(p.slot) ? GOLD : PLATE;
    for (let i = 0; i < idx.length; i += 3) {
      const A = [v[idx[i] * 3], v[idx[i] * 3 + 1], v[idx[i] * 3 + 2]], B = [v[idx[i + 1] * 3], v[idx[i + 1] * 3 + 1], v[idx[i + 1] * 3 + 2]], D = [v[idx[i + 2] * 3], v[idx[i + 2] * 3 + 1], v[idx[i + 2] * 3 + 2]];
      const pa = project(A), pb = project(B), pd = project(D);
      if (!pa || !pb || !pd) continue;
      const k = 0.35 + 0.65 * Math.abs(dot(norm(cross(sub(B, A), sub(D, A))), light));
      tri(c, pa, pb, pd, base.map((x) => Math.min(255, x * k)));
    }
  }
  const at = (n) => { const r = asm.skeleton.byName.get(n); return r == null ? null : asm.mats.get(r)?.t ?? null; };
  for (const chain of ARMS) {
    const pts = chain.map(at).filter(Boolean).map(project);
    for (let i = 0; i + 1 < pts.length; i++) if (pts[i] && pts[i + 1]) rod(c, pts[i], pts[i + 1], SKIN, Math.max(2, Math.round(c.W / 90)));
  }
  if (fingers) {
    for (const [n, ref] of asm.skeleton.byName) {
      if (!fingers.test(n)) continue;
      const parent = asm.skeleton.nodes.get(ref).parent, a = asm.mats.get(parent)?.t, b = asm.mats.get(ref)?.t;
      if (a && b) rod(c, project(a), project(b), RED, 2, true);
    }
  }
}
/** An orthographic view looking along `-dir`, `span` units tall about `centre`. */
function ortho(asm, dir, upHint, centre, { W, H, span, fingers = null }) {
  const c = canvas(W, H, [34, 36, 42]);
  const d = norm(dir), right = norm(cross(upHint, d)), up = cross(d, right), s = H / span;
  draw(c, asm, (p) => { const q = sub(p, centre); return [W / 2 + dot(q, right) * s, H / 2 - dot(q, up) * s, -dot(q, d)]; }, { fingers });
  return c;
}
/** The first person: the camera node's eye, the lens down the rig's +Y with +Z up, FP_FIELD_OF_VIEW tall, the crosshair. */
function lens(b, { W = 400, H = 300 } = {}) {
  const c = canvas(W, H, [52, 60, 70]);
  const eye = b.asm.mats.get(b.cam).t, half = Math.tan(FP_FIELD_OF_VIEW / 2);
  draw(c, b.asm, (p) => { const q = sub(p, eye); return q[1] < 1 ? null : [W / 2 + (q[0] / q[1]) / (half * W / H) * (W / 2), H / 2 - (q[2] / q[1]) / half * (H / 2), q[1]]; }, { slots: /weapon|hand/ });
  for (let i = -6; i <= 6; i++) { plot(c, W / 2 + i, H / 2, -Infinity, [255, 255, 255]); plot(c, W / 2, H / 2 + i, -Infinity, [255, 255, 255]); }
  return c;
}
/** Canvases laid out in rows, written as one PNG. */
function sheet(file, rows, gap = 6) {
  const W = Math.max(...rows.map((r) => r.reduce((n, c) => n + c.W + gap, gap))), H = rows.reduce((n, r) => n + Math.max(...r.map((c) => c.H)) + gap, gap);
  const out = canvas(W, H, [16, 16, 20]);
  let y = gap;
  for (const r of rows) {
    let x = gap;
    for (const c of r) {
      for (let j = 0; j < c.H; j++) out.data.set(c.data.subarray(j * c.W * 4, (j + 1) * c.W * 4), ((y + j) * W + x) * 4);
      x += c.W + gap;
    }
    y += Math.max(...r.map((c) => c.H)) + gap;
  }
  writeFileSync(file, writePng({ width: W, height: H, data: out.data }));
}

const OUT = process.argv[2] || 'scratch/pistol-stance';
mkdirSync(OUT, { recursive: true });
const rows = [];
for (const pair of [false, true]) {
  const third = await body({ pair }), first = await body({ pair, first: true });
  for (const ready of [0, 1]) {
    const fit = pose(third, ready), fitF = pose(first, ready);
    const B = bodyAxes(third.asm), o = { W: 230, H: 300, span: 150 }, mid = B.pelvis;
    rows.push([ortho(third.asm, add(B.fwd, B.right, 0.8), B.up, mid, o), ortho(third.asm, B.right, B.up, mid, o), ortho(third.asm, add(B.right.map((v) => -v), B.fwd, 0.6), B.up, mid, o), lens(first)]);
    console.log(`${pair ? 'a pair' : 'one pistol'}, ${ready ? 'aimed' : 'idle'}: the wrists' reach misses - third R ${fit?.reach?.R?.toFixed(3)} L ${fit?.reach?.L?.toFixed(3)}, first R ${fitF?.reach?.R?.toFixed(3)} L ${fitF?.reach?.L?.toFixed(3)}`);
  }
}
sheet(`${OUT}/pistol-stance.png`, rows);
const hand = await body(), grips = [];
for (const ready of [0, 1]) {
  pose(hand, ready);
  const B = bodyAxes(hand.asm), wb = hand.asm.mats.get(hand.asm.skeleton.byName.get('weapon bone')).t, o = { W: 360, H: 360, span: 40, fingers: /^bip01 r (finger\d+|hand)$/ };
  grips.push(ortho(hand.asm, B.right, B.up, wb, o), ortho(hand.asm, B.right.map((v) => -v), B.up, wb, o));
}
sheet(`${OUT}/pistol-grip.png`, [grips.slice(0, 2), grips.slice(2)]);
console.log(`${OUT}/pistol-stance.png, ${OUT}/pistol-grip.png`);
