// Neutral-pose paperdoll geometry (redesign, not sprite-constrained).
// Pure + browser-safe: buildNeutralBody(ramps) returns faces
// [{ p:[12], n:[3], c:[r,g,b] }] with AO + snapped-ramp palette shading
// baked in. `ramps` = { skin:[[r,g,b]...], boot:[[r,g,b]...] } supplied
// by the caller (engine passes ramps from the loaded ART_PAL; the
// viewer tool passes them from the sprite). Geometry is authored as
// loft profiles - see tools/neutral for the viewer.

export function buildNeutralBody(ramps, opts = {}) {
  const SEG = 28;
  const SKIN = [196, 154, 116], BOOT = [92, 74, 58], HAIR = [64, 54, 44];
  const faces = [];
  let grp = 'body'; // limb tag for animation (body/head/armL/armR/legL/legR)
  const sq = (u, p) => Math.sign(u) * Math.pow(Math.abs(u), p);
  const ring = (cx, y, cz, rx, rz, i, p = 1) => { const a = (i / SEG) * Math.PI * 2; return [cx + rx * sq(Math.cos(a), p), y, cz + rz * sq(Math.sin(a), p)]; };
  function loft(rows, col, cxOf, czOf) {
    const R = rows.slice().sort((a, b) => a.y - b.y);
    for (let k = 0; k + 1 < R.length; k++) {
      const a = R[k], b = R[k + 1];
      if (Math.abs(a.y - b.y) < 1e-6) continue;
      const ax = cxOf ? cxOf(a) : (a.cx ?? 0), bx = cxOf ? cxOf(b) : (b.cx ?? 0);
      const az = czOf ? czOf(a) : (a.cz ?? 0), bz = czOf ? czOf(b) : (b.cz ?? 0);
      const pa = a.p ?? 1, pb2 = b.p ?? 1;
      for (let i = 0; i < SEG; i++) {
        const p0 = ring(ax, a.y, az, a.rx, a.rz, i, pa), p1 = ring(ax, a.y, az, a.rx, a.rz, i + 1, pa);
        const p2 = ring(bx, b.y, bz, b.rx, b.rz, i + 1, pb2), p3 = ring(bx, b.y, bz, b.rx, b.rz, i, pb2);
        const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
        const vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
        // outward: flip if pointing toward the tube centre
        const mx = (p0[0] + p2[0]) / 2 - ax, mz = (p0[2] + p2[2]) / 2 - az;
        if (nx * mx + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        faces.push({ p: [...p0, ...p1, ...p2, ...p3], n: [nx, ny, nz], c: col, g: grp });
      }
    }
  }

  // TORSO: designed, not the sprite barrel. V-taper from broad
  // shoulders to a narrow waist with a slight hip flare, and a
  // FLATTENED squarish cross-section (p 0.72) so the chest reads broad
  // and flat, not as a round egg. Widths are half-extents.
  const TP = 0.58; // low power = squarish, flat-faced chest (not an egg)
  const torso = [
    { y: 1.66, rx: 0.205, rz: 0.090, p: TP }, // clavicle / trap line
    { y: 1.57, rx: 0.215, rz: 0.096, p: TP }, // upper chest / pecs
    { y: 1.46, rx: 0.208, rz: 0.098, p: TP }, // chest
    { y: 1.33, rx: 0.182, rz: 0.092, p: TP }, // lower ribs
    { y: 1.19, rx: 0.160, rz: 0.082, p: TP }, // waist (narrowest)
    { y: 1.09, rx: 0.162, rz: 0.084, p: TP }, // upper hip (holds waist width)
    { y: 1.04, rx: 0.168, rz: 0.088, p: TP }, // pelvis
    { y: 0.99, rx: 0.170, rz: 0.090, p: TP }, // pelvis floor (caps the thigh tops)
  ];
  loft(torso, SKIN);

  // DELTOID shoulder caps: connect the torso top out to each arm so the
  // shoulders are a distinct broad line, and the arm reads as separate
  // below - not fused into one oval. Small rounded mass over each joint.
  // TRAPEZIUS yoke: slopes from the neck base DOWN and OUT to each
  // shoulder, giving the shoulder LINE (not a flat lid). Flat-ish top
  // (low p) so it reads as a plane, not a dome.
  const TRAP = [
    { y: 1.66, rx: 0.086, rz: 0.058, p: 0.5, cx: 0.00 }, // at the neck
    { y: 1.64, rx: 0.150, rz: 0.070, p: 0.5, cx: 0.00 }, // sloping out
    { y: 1.61, rx: 0.215, rz: 0.082, p: 0.5, cx: 0.00 }, // shoulder shelf
  ];
  loft(TRAP, SKIN);
  // DELTOID: an angular capped wedge over the joint (low p = planar
  // facets, flatter than deep), defined edge into the arm - not a ball.
  const DELT = [
    { y: 1.64, rx: 0.070, rz: 0.072, p: 0.55 }, // top, tucks under the trap shelf
    { y: 1.60, rx: 0.090, rz: 0.082, p: 0.55 }, // deltoid belly (planar)
    { y: 1.55, rx: 0.082, rz: 0.076, p: 0.55 }, // mid deltoid
    { y: 1.50, rx: 0.066, rz: 0.068, p: 0.6 },  // defined edge into the arm
  ];
  loft(DELT, SKIN, () => -0.240, () => 0);
  loft(DELT, SKIN, () => 0.240, () => 0);
  // NECK: narrow column from the shoulders up into the head base.
  loft([
    { y: 1.63, rx: 0.078, rz: 0.078, p: 0.8 },
    { y: 1.68, rx: 0.070, rz: 0.072, p: 0.8 },
    { y: 1.73, rx: 0.072, rz: 0.074, p: 0.8 },
  ], SKIN, () => 0, () => -0.01);
  // HEAD: a proper head (the sprite hair-blob was rx 0.35, wider than
  // the shoulders - a mushroom). Rounded, sized like a head, sits on
  // the neck. cz back a touch so the face plane faces forward.
  grp = 'head';
  // Egg-shaped: DEEPER than wide (face-to-skull longer than ear-to-ear),
  // tapered jaw/chin at the bottom, widest at the temples, rounded
  // crown. Skull sits back a touch (neck is forward), face plane fwd.
  loft([
    { y: 1.70, rx: 0.052, rz: 0.070, cz: 0.010 }, // chin (narrow, forward)
    { y: 1.74, rx: 0.082, rz: 0.105, cz: 0.005 }, // jaw
    { y: 1.79, rx: 0.102, rz: 0.130, cz: -0.005 }, // cheek
    { y: 1.85, rx: 0.108, rz: 0.140, cz: -0.015 }, // temple (widest, deepest)
    { y: 1.92, rx: 0.100, rz: 0.135, cz: -0.020 }, // upper skull (back-heavy)
    { y: 1.98, rx: 0.082, rz: 0.108, cz: -0.018 }, // crown curve
    { y: 2.03, rx: 0.045, rz: 0.058, cz: -0.012 }, // crown top
  ], SKIN, () => 0, (r) => r.cz);
  grp = 'body';

  // ARMS: straight down at the sides. Measured arm radius profile, cx
  // pinned just outside the torso, cz centred. Symmetric L/R.
  const armProf = [
    { y: 1.61, rx: 0.072, rz: 0.075 }, // deltoid / shoulder
    { y: 1.50, rx: 0.065, rz: 0.068 }, // bicep (swell)
    { y: 1.42, rx: 0.058, rz: 0.060 }, // lower bicep
    { y: 1.35, rx: 0.050, rz: 0.056, cz: -0.006 }, // elbow crease (pinch, point back)
    { y: 1.30, rx: 0.056, rz: 0.062, cz: -0.008 }, // olecranon / elbow tip
    { y: 1.22, rx: 0.056, rz: 0.058 }, // forearm belly (swell)
    { y: 1.16, rx: 0.050, rz: 0.052 }, // mid forearm
    { y: 1.06, rx: 0.044, rz: 0.046 }, // lower forearm
    { y: 0.99, rx: 0.036, rz: 0.038 }, // wrist
  ];
  const ARM_X = 0.235;
  grp = 'armL'; loft(armProf, SKIN, () => -ARM_X, () => 0);
  grp = 'armR'; loft(armProf, SKIN, () => ARM_X, () => 0);
  grp = 'body';
  // HAND: small block at the wrist
  function hand(sign) {
    const cx = sign * ARM_X;
    // MITTEN: flat palm + fused fingers, hanging down. Flat = rx > rz.
    loft([
      { y: 0.985, rx: 0.036, rz: 0.038 }, // wrist
      { y: 0.950, rx: 0.052, rz: 0.030 }, // palm (wide, flat)
      { y: 0.905, rx: 0.054, rz: 0.030 }, // knuckles
      { y: 0.860, rx: 0.048, rz: 0.026 }, // fingers
      { y: 0.820, rx: 0.036, rz: 0.020 }, // fingertips (rounded)
    ], SKIN, () => cx, () => 0);
    // THUMB: short nub off the INNER side (toward the body), upper palm,
    // angled slightly forward.
    const tside = -sign; // inner
    loft([
      { y: 0.955, rx: 0.016, rz: 0.020, cz: 0.010 },
      { y: 0.935, rx: 0.020, rz: 0.024, cz: 0.018 },
      { y: 0.912, rx: 0.014, rz: 0.018, cz: 0.014 },
    ], SKIN, () => cx + tside * 0.052, (r) => r.cz);
  }
  grp = 'armL'; hand(-1); grp = 'armR'; hand(1); grp = 'body';

  // LEGS: full measured taper down to a THIN ankle (my earlier clip at
  // y0.14 kept the calf width -> fat ankle circles). Plus upper-thigh
  // connector rows that ramp UP into the pelvis and toward centre, so
  // the thighs merge with the waist instead of the waist sitting on
  // top of two poles. Parallel, cx constant, cz centred.
  const ANKLE_Y = 0.10;
  const legProf = [
    { y: 0.10, rx: 0.048, rz: 0.048 }, // ankle (thin)
    { y: 0.22, rx: 0.060, rz: 0.063 }, // lower calf (slim)
    { y: 0.34, rx: 0.084, rz: 0.088 }, // calf belly (swell)
    { y: 0.44, rx: 0.070, rz: 0.072 }, // below knee (taper in)
    { y: 0.50, rx: 0.076, rz: 0.088, cz: 0.010 }, // kneecap (bulge forward)
    { y: 0.55, rx: 0.072, rz: 0.080 }, // knee joint line (pinch)
    { y: 0.62, rx: 0.086, rz: 0.090 }, // lower thigh (swell)
    { y: 0.72, rx: 0.096, rz: 0.100 }, // thigh
    { y: 0.82, rx: 0.112, rz: 0.114 }, // mid thigh
    { y: 0.95, rx: 0.120, rz: 0.120 }, // upper thigh (thickest, slim)
  ];
  const LEG_X = 0.082; // thighs gathered toward the narrow waist-width pelvis
  // connector: from the measured thigh top (y1.034) up into the pelvis,
  // widening and pulling toward centre so it fuses with the hip.
  const CONNECT = [
    { y: 0.90, rx: legProf[legProf.length - 1].rx, rz: legProf[legProf.length - 1].rz, dx: 0 },
    { y: 0.96, rx: 0.120, rz: 0.112, dx: 0.006 },
    { y: 1.00, rx: 0.108, rz: 0.100, dx: 0.012 }, // meets the pelvis floor - does NOT rise past it
  ];
  function leg(sign) {
    loft(legProf, SKIN, () => sign * LEG_X, () => 0);
    loft(CONNECT, SKIN, (r) => sign * (LEG_X - r.dx), () => 0); // dx pulls the top toward centre
  }
  grp = 'legL'; leg(-1); grp = 'legR'; leg(1); grp = 'body';

  // FEET: forward, from the TRUE thin ankle (rx ~0.066).
  // Slim ankle: taper the bottom rows in (the measured 0.066 still read
  // as a fat joint against the foot).
  const ANK = 0.045;
  legProf[0] = { y: ANKLE_Y, rx: ANK, rz: ANK };
  if (legProf[1]) legProf[1] = { y: legProf[1].y, rx: (ANK + legProf[1].rx) / 2, rz: (ANK + legProf[1].rz) / 2 };
  // FOOT: an explicit FLAT-SOLED volume extruded forward (a box, not a
  // stack of ellipse rings - rings around a short span make a ball).
  // Cross-sections are taken along Z (heel->toe), each a small vertical
  // rounded rect, so the sole stays flat on the ground.
  const quad = (a, b, c, d, col) => {
    const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
    const vx = d[0]-a[0], vy = d[1]-a[1], vz = d[2]-a[2];
    let nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
    const L = Math.hypot(nx,ny,nz)||1; nx/=L; ny/=L; nz/=L;
    faces.push({ p: [...a, ...b, ...c, ...d], n: [nx,ny,nz], c: col, g: grp });
  };
  function foot(cx) {
    const SOLE = 0.005;      // sole height off the ground
    // profile along the foot length: [z, topY, halfWidth]
    const prof = [
      [-0.062, 0.082, 0.052], // heel back
      [-0.025, 0.090, 0.055], // heel
      [ 0.06,  0.074, 0.058], // arch/mid
      [ 0.155, 0.056, 0.058], // ball
      [ 0.235, 0.036, 0.044], // toe
    ];
    for (let k = 0; k + 1 < prof.length; k++) {
      const [z0, t0, w0] = prof[k], [z1, t1, w1] = prof[k+1];
      const L0 = [cx-w0, SOLE, z0], R0 = [cx+w0, SOLE, z0], TL0 = [cx-w0, t0, z0], TR0 = [cx+w0, t0, z0];
      const L1 = [cx-w1, SOLE, z1], R1 = [cx+w1, SOLE, z1], TL1 = [cx-w1, t1, z1], TR1 = [cx+w1, t1, z1];
      quad(L0, R0, R1, L1, BOOT);       // sole (bottom)
      quad(TL0, TL1, TR1, TR0, BOOT);   // top
      quad(L0, L1, TL1, TL0, BOOT);     // left side
      quad(R0, TR0, TR1, R1, BOOT);     // right side
    }
    // cap heel and toe
    const h = prof[0], t = prof[prof.length-1];
    quad([cx-h[2],SOLE,h[0]], [cx-h[2],h[1],h[0]], [cx+h[2],h[1],h[0]], [cx+h[2],SOLE,h[0]], BOOT);
    quad([cx-t[2],SOLE,t[0]], [cx+t[2],SOLE,t[0]], [cx+t[2],t[1],t[0]], [cx-t[2],t[1],t[0]], BOOT);
    // ankle stump: connect leg bottom (ANK ring) down to the foot top at the ankle z
    loft([
      { y: ANKLE_Y, rx: ANK, rz: ANK, cz: 0 },
      { y: 0.085, rx: 0.046, rz: 0.05, cz: 0 },
    ], BOOT, () => cx, () => 0);
  }
  grp = 'legL'; foot(-LEG_X); grp = 'legR'; foot(LEG_X); grp = 'body';

  // SHADING: bake ART_PAL palette ramps per face by lighting intensity
  // (upper-right key, like the game) - the retro banded skin/boot look,
  // not smooth material lighting. Continuous lerp between ramp steps so
  // it isn't blocky. Colour tag on each face selects the ramp.

  const Lx = 0.5, Ly = 0.55, Lz = 0.67, Ln = Math.hypot(Lx, Ly, Lz);
  const lerp = (a, b, t) => [Math.round(a[0]+(b[0]-a[0])*t), Math.round(a[1]+(b[1]-a[1])*t), Math.round(a[2]+(b[2]-a[2])*t)];
  const shade = (ramp, it) => ramp[Math.max(0, Math.min(ramp.length-1, Math.round(it*(ramp.length-1))))]; // SNAP to a ramp step: hard palette bands (blocky shader look), no lerp
  // AMBIENT OCCLUSION (geometry-derived): a face is occluded when other
  // faces sit IN FRONT of it (its normal hemisphere) within a short
  // radius - flat surfaces see none, crevice walls (armpit, crotch,
  // neck, behind knee/elbow, under pec/delt) face a close opposing wall
  // and darken. No hardcoded positions.

  // ARMOR-AS-BODY (prototype): instead of a separate mesh, thicken the
  // rig's own surface where a piece sits and recolour it. No gaps, and
  // it animates with the body for free. Cuirass = the torso ('body')
  // faces in the chest->waist band pushed radially out + tagged steel.
  const displace = (groups, yLo, yHi, th, cxFor, zScale = 1) => {
    for (const f of faces) {
      if (!groups.includes(f.g)) continue;
      let cy = 0; for (let i = 0; i < 4; i++) cy += f.p[i*3+1]; cy /= 4;
      if (cy < yLo || cy > yHi) continue;
      const cx = cxFor ? cxFor(f.g) : 0;
      for (let i = 0; i < 4; i++) {
        const x = f.p[i*3] - cx, z = f.p[i*3+2], r = Math.hypot(x, z) || 1;
        f.p[i*3] = cx + x + (x/r)*th; f.p[i*3+2] = z + (z/r)*th*zScale;
      }
      f._armor = 'steel';
    }
  };
  const legCx = (g) => g === 'legL' ? -LEG_X : g === 'legR' ? LEG_X : 0;
  const armCx = (g) => g === 'armL' ? -ARM_X : g === 'armR' ? ARM_X : 0;
  // cuirass = torso chest->waist; greaves = legs + hip fauld; boots =
  // feet/ankle; gauntlets = forearm+hand. Each thickens the rig's own
  // surface and recolours steel (no separate mesh, animates for free).
  if (opts.cuirass) displace(['body'], 1.12, 1.62, 0.022);
  if (opts.greaves) { displace(["legL","legR"], 0.22, 1.00, 0.020, legCx, 0.28); displace(['body'], 0.90, 1.14, 0.020); }
  if (opts.boots) displace(['legL','legR'], 0.00, 0.12, 0.016, legCx);
  if (opts.gauntlets) displace(['armL','armR'], 0.83, 1.22, 0.016, armCx);

  // HEIGHT: vertical compress for a shorter, stockier (Daggerfall)
  // build. Applied before AO so crevice distances stay consistent.
  const HSCALE = 0.9;
  for (const f of faces) for (let i = 0; i < 4; i++) f.p[i*3+1] *= HSCALE;

  const cen = faces.map((f) => {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < 4; i++) { x += f.p[i*3]; y += f.p[i*3+1]; z += f.p[i*3+2]; }
    return [x/4, y/4, z/4];
  });
  const AO_R = 0.11, AO_K = 0.55; // radius, strength
  const ao = new Array(faces.length).fill(1);
  for (let i = 0; i < faces.length; i++) {
    const c = cen[i], n = faces[i].n; let occ = 0;
    for (let j = 0; j < faces.length; j++) {
      if (j === i) continue;
      const dx = cen[j][0]-c[0], dy = cen[j][1]-c[1], dz = cen[j][2]-c[2];
      const d = Math.hypot(dx, dy, dz);
      if (d < 1e-4 || d > AO_R) continue;
      const facing = (dx*n[0] + dy*n[1] + dz*n[2]) / d; // >0 = other is in front
      if (facing > 0.25) occ += (1 - d/AO_R) * facing;
    }
    ao[i] = Math.max(0.45, 1 - Math.min(1, occ * AO_K * 0.12));
  }
  for (let i = 0; i < faces.length; i++) {
    const fc = faces[i];
    let it = Math.max(0.08, (fc.n[0]*Lx + fc.n[1]*Ly + fc.n[2]*Lz) / Ln * 0.9 + 0.15);
    it *= ao[i]; // crevices darken
    const ramp = fc._armor === 'steel' ? (opts.steel || ramps.steel || ramps.skin) : (fc.c === BOOT ? ramps.boot : ramps.skin);
    fc.c = shade(ramp, Math.min(1, Math.max(0.04, it)));
  }

  // Payload (quantized, same format as the viewer expects).


  return faces;
}
