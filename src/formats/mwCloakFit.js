// MW-CLOAK1: THE CLOAK AND WHAT HANGS AROUND IT (2026-10-09, Mac: "The new cloak will need bones to animate with the
// character movement. Ensure theres no clipping with weapons that are stowed"; asked, stowed gear is worn over it).
//
// The cloak is one sheet hung down the back (characters/ownClothingModels.js), fitted on the steel plate's body - and a
// body wears whatever its owner put on it: the ebony pauldrons stand 2.5 units further back than the steel ones, a
// retail robe flares, and the Weapon Sheathing addon slings a greatsword across the very back the cloak covers. So once
// a body is assembled, two fits, measured in the REST pose (the skeleton's own, t = 0 with no tracks - the pose the
// cloak's bind was taken in) and kept for every pose after, because each moves the geometry where it is AUTHORED:
//
//   1. THE CLOAK OVER WHAT IT COVERS (fitCloakOver). Every vertex of the body and its clothes that stands behind the
//      cloak's sheet - through it - eases the sheet back past it by CLOAK_CLEARANCE: the triangle over it moves back,
//      its three corners, a welded seam as one. The push is the rest pose's, carried into the bind the cloak is skinned
//      from (the inverse of each vertex's own skin blend), so it rides the bones as the cloak does.
//
//   2. STOWED GEAR AGAINST THE CLOAK (fitStowedGear), a holster bone's pieces as one - the scabbard, the weapon in it,
//      the quiver's arrows:
//        SLUNG on the back (a bone under the spine - the greatsword, the bow): it is WORN OVER the cloak, moved back
//          until every piece of it clears the sheet's back by CLOAK_CLEARANCE.
//        HUNG at the hip (a bone under the pelvis - the sword, the dagger, the crossbow): it stays UNDER the cloak, at
//          its hilt, PITCHED forward about its bone the least whole degree that keeps every piece in front of the
//          sheet - the addon hangs a longsword forty degrees back, its tip a hand's breadth through a cloak's side; it
//          hangs nearer plumb under one. Pushed back over the cloak instead it would hang thirty units off the hip.
//      A group the sheet does not reach, or already clear of it, is not touched.
//
// Rest pose, not every frame: the cloak below the waist swings with the thighs (tools/bakeCloak.mjs), and gear at the
// hip rides the pelvis, so in a full stride a hip-hung tip and the hem can still meet - the rest fit keeps the
// standing body and the walk's middle clean, as a skinned cloak with no cloth law can.
//
// Pure over an assembly (formats/mwFirstPerson.js): the cloak's batch and the gear's sources are REPLACED, never
// written into (a source may be its parsed batch's own array), and the live pose's positions are re-placed at once.
import { GRAPH_ROOT } from './mwSkin.js';
import { placeAtBone, placeNormalsAtBone } from './mwFirstPerson.js';

/** Units the cloak keeps behind what it covers, and gear keeps from the cloak. */
export const CLOAK_CLEARANCE = 1;
/** The furthest a cloak vertex is eased back - past it, what is under the cloak is not a body. */
export const CLOAK_PUSH_LIMIT = 10;
/** The furthest hip-hung gear is pitched, in degrees. */
export const HIP_PITCH_LIMIT = 60;
/** The furthest slung gear is pitched to lie along the cloak's fall, either way, in degrees. */
export const SLUNG_PITCH_LIMIT = 15;
/** The spacing gear and what the cloak covers are sampled at along their edges - a long edge between two vertices
 *  clear of the sheet can still cross it where the sheet bows. */
export const SAMPLE_STEP = 1;
/** The bone a slung holster hangs under - the spine's first above the pelvis; a hip holster is under the pelvis alone. */
export const SLUNG_UNDER = 'bip01 spine1';

const cellKey = (x, z) => `${Math.round(x)},${Math.round(z)}`;

/** A piece's placed surface as points: its vertices, and its edges' interiors every `step` units. */
export function surfaceSamples(positions, indices, step = SAMPLE_STEP) {
  const out = Array.from(positions);
  const seen = new Set();
  for (let t = 0; t < indices.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = indices[t + e], b = indices[t + (e + 1) % 3];
      const k = a < b ? a * 1048576 + b : b * 1048576 + a;
      if (seen.has(k)) continue;
      seen.add(k);
      const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
      const dx = positions[b * 3] - ax, dy = positions[b * 3 + 1] - ay, dz = positions[b * 3 + 2] - az;
      const n = Math.floor(Math.hypot(dx, dy, dz) / step);
      for (let i = 1; i <= n; i++) { const f = i / (n + 1); out.push(ax + dx * f, ay + dy * f, az + dz * f); }
    }
  }
  return out;
}

/** The rest pose (t = 0, no tracks) and a placer for any piece in it - fresh arrays; the assembly is not touched. */
function restPose(assembly) {
  const { fns, skeleton } = assembly;
  const pose = fns.poseSkeleton(skeleton, null, null, 0, { accumRoot: null });
  const mats = fns.skelMats(skeleton, pose, GRAPH_ROOT);
  const place = (p, batch = p.batch, source = p.source) => {
    if (p.kind === 'skinned') {
      const out = new Float32Array(batch.positions.length);
      fns.skinBatch(batch, skeleton, pose, mats, out, null);
      return out;
    }
    return placeAtBone(source, fns.attachmentTransform(mats, p.attachRef), p.mirrored, new Float32Array(source.length), p.boneOffset);
  };
  return { pose, mats, place };
}

/**
 * The cloak as a height field over the rig's (x, z): for each unit cell its triangles cover, the sheet's FRONT (the
 * largest y, the layer nearest the body where it folds) and BACK, and the triangle each came from.
 */
export function cloakSheet(positions, indices) {
  const cells = new Map();
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
    const d = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
    if (Math.abs(d) < 1e-9) continue;   // edge-on in (x, z): its neighbours carry the sheet
    for (let i = Math.ceil(Math.min(ax, bx, cx) - 0.5); i <= Math.floor(Math.max(ax, bx, cx) + 0.5); i++) {
      for (let j = Math.ceil(Math.min(az, bz, cz) - 0.5); j <= Math.floor(Math.max(az, bz, cz) + 0.5); j++) {
        const wa = ((bx - i) * (cz - j) - (cx - i) * (bz - j)) / d;
        const wb = ((cx - i) * (az - j) - (ax - i) * (cz - j)) / d;
        const wc = 1 - wa - wb;
        if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
        const y = wa * ay + wb * by + wc * cy;
        const k = `${i},${j}`;
        const cell = cells.get(k);
        if (!cell) { cells.set(k, { front: y, frontTri: t, back: y, backTri: t }); continue; }
        if (y > cell.front) { cell.front = y; cell.frontTri = t; }
        if (y < cell.back) { cell.back = y; cell.backTri = t; }
      }
    }
  }
  return cells;
}

/** Each vertex's welded group (one position, split by a seam), so a seam moves as one. */
function weldOf(positions) {
  const first = new Map();
  const rep = new Int32Array(positions.length / 3);
  for (let v = 0; v < rep.length; v++) {
    const k = `${positions[v * 3].toFixed(4)},${positions[v * 3 + 1].toFixed(4)},${positions[v * 3 + 2].toFixed(4)}`;
    if (!first.has(k)) first.set(k, v);
    rep[v] = first.get(k);
  }
  return rep;
}

const det3 = (m) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
/** m^-1 v for a row-major 3x3, or null where it is singular. */
function solve3(m, v) {
  const d = det3(m);
  if (Math.abs(d) < 1e-9) return null;
  const col = (k) => { const c = m.slice(); c[k] = v[0]; c[3 + k] = v[1]; c[6 + k] = v[2]; return det3(c) / d; };
  return [col(0), col(1), col(2)];
}

/**
 * FIT 1: the cloak eased back over every piece `isUnder` names. Returns `{ pushed, most }` - how many of the cloak's
 * vertices moved and the furthest, in the rest pose's units - or null when the body wears no cloak.
 */
export function fitCloakOver(assembly, { isCloak, isUnder, clearance = CLOAK_CLEARANCE, limit = CLOAK_PUSH_LIMIT }) {
  const cloaks = assembly.pieces.filter((p) => p.kind === 'skinned' && isCloak(p));
  if (!cloaks.length) return null;
  const rest = restPose(assembly);
  const under = assembly.pieces.filter((p) => !cloaks.includes(p) && isUnder(p)).map((p) => surfaceSamples(rest.place(p), p.indices));
  let pushed = 0; let most = 0;
  for (const cloak of cloaks) {
    const bind = Float32Array.from(cloak.batch.positions);
    const n = bind.length / 3;
    const rep = weldOf(bind);
    const total = new Float64Array(n);
    // how a bind-space step moves each vertex in the rest pose: the skin blend's own linear part, measured
    const posedOf = (pos) => rest.place(cloak, { ...cloak.batch, positions: pos });
    // a pass per fold uncovered: pushing the front layer back can leave a second layer in front
    for (let pass = 0; pass < 4; pass++) {
      const posed = posedOf(bind);
      const sheet = cloakSheet(posed, cloak.indices);
      const need = new Float64Array(n);
      for (const u of under) {
        for (let v = 0; v < u.length; v += 3) {
          const cell = sheet.get(cellKey(u[v], u[v + 2]));
          if (!cell) continue;
          const over = cell.front - (u[v + 1] - clearance);
          if (over <= 1e-4) continue;
          for (let k = 0; k < 3; k++) { const w = rep[cloak.indices[cell.frontTri + k]]; if (over > need[w]) need[w] = over; }
        }
      }
      let any = false;
      for (let v = 0; v < n; v++) { const w = rep[v]; if (need[w] > 0 && total[w] + need[w] <= limit) any = true; }
      if (!any) break;
      const axes = [0, 1, 2].map((k) => { const p = Float32Array.from(bind); for (let v = 0; v < n; v++) p[v * 3 + k] += 1; return posedOf(p); });
      for (let v = 0; v < n; v++) {
        const step = Math.min(need[rep[v]], limit - total[rep[v]]);
        if (step <= 0) continue;
        const m = [0, 1, 2].flatMap((r) => [0, 1, 2].map((k) => axes[k][v * 3 + r] - posed[v * 3 + r]));
        const d = solve3(m, [0, -step, 0]);
        if (!d) continue;
        bind[v * 3] += d[0]; bind[v * 3 + 1] += d[1]; bind[v * 3 + 2] += d[2];
      }
      for (let v = 0; v < n; v++) if (rep[v] === v) total[v] += Math.min(need[v], Math.max(0, limit - total[v]));
    }
    for (let v = 0; v < n; v++) if (rep[v] === v && total[v] > 0) { pushed += 1; most = Math.max(most, total[v]); }
    if (total.some((t) => t > 0)) {
      cloak.batch = { ...cloak.batch, positions: bind };
      if (assembly.pose && assembly.mats) assembly.fns.skinBatch(cloak.batch, assembly.skeleton, assembly.pose, assembly.mats, cloak.positions, cloak.normals ?? null);
    }
  }
  return { pushed, most };
}

/** Is `ref` under the node named `name` (lower case) in this skeleton? */
function under(skeleton, ref, name) {
  for (let at = skeleton.nodes.get(ref)?.parent; at != null && at >= 0; at = skeleton.nodes.get(at)?.parent) {
    if (String(skeleton.nodes.get(at)?.name ?? '').toLowerCase() === name) return true;
  }
  return false;
}

/** The rotation about the rig's x axis by `deg`: a down-pointing arm swings forward (+y) for a positive angle. */
function pitch(deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
const mul3v = (m, x, y, z) => [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
const mul33 = (p, q) => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => p[r * 3] * q[c] + p[r * 3 + 1] * q[3 + c] + p[r * 3 + 2] * q[6 + c]));
function inv3(m) {
  const d = det3(m);
  return [
    (m[4] * m[8] - m[5] * m[7]) / d, (m[2] * m[7] - m[1] * m[8]) / d, (m[1] * m[5] - m[2] * m[4]) / d,
    (m[5] * m[6] - m[3] * m[8]) / d, (m[0] * m[8] - m[2] * m[6]) / d, (m[2] * m[3] - m[0] * m[5]) / d,
    (m[3] * m[7] - m[4] * m[6]) / d, (m[1] * m[6] - m[0] * m[7]) / d, (m[0] * m[4] - m[1] * m[3]) / d,
  ];
}

/**
 * FIT 2: every stowed piece `isGear` names, a bone's pieces as one, against the cloak. Returns one row per holster bone
 * the cloak reaches - `{ bone, slung, how, by }`, `how` one of 'clear' (nothing to do), 'over' (moved back `by` units
 * over the cloak), 'pitched' (`by` degrees forward under it) or 'unresolved' (no pitch within HIP_PITCH_LIMIT clears
 * it: left as it hangs) - or null when the body wears no cloak.
 */
export function fitStowedGear(assembly, { isCloak, isGear, clearance = CLOAK_CLEARANCE, pitchLimit = HIP_PITCH_LIMIT, slungLimit = SLUNG_PITCH_LIMIT }) {
  const cloaks = assembly.pieces.filter((p) => p.kind === 'skinned' && isCloak(p));
  if (!cloaks.length) return null;
  const rest = restPose(assembly);
  const sheets = cloaks.map((c) => cloakSheet(rest.place(c), c.indices));
  const front = (x, z) => { let y = null; for (const s of sheets) { const c = s.get(cellKey(x, z)); if (c && (y == null || c.front > y)) y = c.front; } return y; };
  const back = (x, z) => { let y = null; for (const s of sheets) { const c = s.get(cellKey(x, z)); if (c && (y == null || c.back < y)) y = c.back; } return y; };
  const groups = new Map();
  for (const p of assembly.pieces) {
    if (p.kind !== 'rigid' || p.mirrored || p.hang || !isGear(p)) continue;
    if (!groups.has(p.attachRef)) groups.set(p.attachRef, []);
    groups.get(p.attachRef).push(p);
  }
  const rows = [];
  for (const [ref, pieces] of groups) {
    const at = assembly.fns.attachmentTransform(rest.mats, ref);
    const posed = pieces.map((p) => surfaceSamples(rest.place(p), p.indices));
    const slung = under(assembly.skeleton, ref, SLUNG_UNDER);
    const bone = pieces[0].bone;
    const t = at.t;
    let reached = false;
    /** Every sample turned about the bone by `deg` - `visit(x, y, z)` answers false to stop. */
    const each = (deg, visit) => {
      const r = deg ? pitch(deg) : null;
      for (const q of posed) for (let v = 0; v < q.length; v += 3) {
        const [x, y, z] = r ? mul3v(r, q[v] - t[0], q[v + 1] - t[1], q[v + 2] - t[2]).map((c, k) => c + t[k]) : [q[v], q[v + 1], q[v + 2]];
        if (visit(x, y, z) === false) return false;
      }
      return true;
    };
    let move = null;
    if (slung) {
      // over the cloak: back until the whole of it is behind the sheet's back - turned about the bone first, within
      // SLUNG_PITCH_LIMIT, to lie along the cloak's fall, the turn that needs the least move back (the smaller turn
      // on a tie), so a greatsword rides the cloak rather than standing off the shoulders by the hem's flare
      let best = null;
      for (let k = 0; k <= 2 * slungLimit; k++) {
        const deg = k % 2 ? (k + 1) / 2 : -k / 2;   // 0, 1, -1, 2, -2 ...
        let need = 0; let here = false;
        each(deg, (x, y, z) => { const s = back(x, z); if (s == null) return; here = true; need = Math.max(need, y - (s - clearance)); });
        if (!here) continue;
        reached = true;
        if (!best || need < best.need - 1e-4) best = { deg, need };
      }
      if (!reached) continue;
      if (best.need > 1e-4 || best.deg) move = { rot: best.deg ? pitch(best.deg) : null, d: [0, -best.need, 0], how: 'over', by: best.need, deg: best.deg };
    } else {
      // under it: the least whole degree forward that keeps every piece in front of the sheet's front
      const clearAt = (deg) => each(deg, (x, y, z) => { const s = front(x, z); if (s == null) return; reached = true; if (y < s + clearance) return false; });
      if (clearAt(0)) { if (reached) rows.push({ bone, slung, how: 'clear', by: 0 }); continue; }
      let deg = 1;
      while (deg <= pitchLimit && !clearAt(deg)) deg++;
      if (deg > pitchLimit) { rows.push({ bone, slung, how: 'unresolved', by: 0 }); continue; }
      move = { rot: pitch(deg), d: [0, 0, 0], how: 'pitched', by: deg };
    }
    if (!move) { rows.push({ bone, slung, how: 'clear', by: 0 }); continue; }
    // the rig-space move about the bone, T(x) = R (x - t) + t + d, carried into each piece's own frame: placeAtBone
    // puts w = source + offset at a w + t, so the source becomes a^-1 (R a w + d) - offset
    const ai = inv3(at.a);
    const lin = move.rot ? mul33(ai, mul33(move.rot, at.a)) : null;
    const dl = mul3v(ai, ...move.d);
    for (const p of pieces) {
      const o = p.boneOffset ?? [0, 0, 0];
      const src = new Float32Array(p.source.length);
      for (let v = 0; v < src.length; v += 3) {
        const w = [p.source[v] + o[0], p.source[v + 1] + o[1], p.source[v + 2] + o[2]];
        const r = lin ? mul3v(lin, ...w) : w;
        src[v] = r[0] + dl[0] - o[0]; src[v + 1] = r[1] + dl[1] - o[1]; src[v + 2] = r[2] + dl[2] - o[2];
      }
      p.source = src;
      if (lin && p.sourceNormals) {
        const nrm = new Float32Array(p.sourceNormals.length);
        for (let v = 0; v < nrm.length; v += 3) {
          const r = mul3v(lin, p.sourceNormals[v], p.sourceNormals[v + 1], p.sourceNormals[v + 2]);
          const l = Math.hypot(r[0], r[1], r[2]) || 1;
          nrm[v] = r[0] / l; nrm[v + 1] = r[1] / l; nrm[v + 2] = r[2] / l;
        }
        p.sourceNormals = nrm;
      }
      if (assembly.mats) {
        const live = assembly.fns.attachmentTransform(assembly.mats, p.attachRef);
        placeAtBone(p.source, live, p.mirrored, p.positions, p.boneOffset);
        if (p.normals && p.sourceNormals) placeNormalsAtBone(p.sourceNormals, live, p.mirrored, p.normals);
      }
    }
    rows.push({ bone, slung, how: move.how, by: move.by, ...(move.how === 'over' ? { deg: move.deg } : {}) });
  }
  return rows;
}
