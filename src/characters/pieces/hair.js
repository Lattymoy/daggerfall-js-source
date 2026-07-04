// Head details (hair + race features) on the neutral rig, geometric.
// Sits just outside the head, front left open (the face). Race-keyed;
// this is the human base + hooks for elf ears etc. Separate mesh,
// tagged 'head' so it bobs with the head.
import { loftPiece, compress } from './pieceLoft.js';

// Hair ramps by broad colour; race/character will pick one later.
export const HAIR_RAMPS = {
  brown: [[22, 15, 10], [40, 28, 18], [60, 44, 28], [84, 62, 42]],
  black: [[12, 10, 12], [24, 20, 24], [38, 33, 40], [54, 48, 56]],
  blonde:[[70, 54, 28], [104, 82, 44], [140, 114, 66], [178, 150, 96]],
};

function shadeHair(faces, ramp) {
  const Lx = 0.5, Ly = 0.55, Lz = 0.67, Ln = Math.hypot(Lx, Ly, Lz);
  const snap = (t) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))))];
  for (const f of faces) { const it = Math.max(0.1, (f.n[0]*Lx + f.n[1]*Ly + f.n[2]*Lz) / Ln * 0.9 + 0.2); f.c = snap(Math.min(1, it)); }
  return faces;
}

// race: 'Human' | 'Elf' | 'Khajiit' | 'Argonian' (morphology groups).
export function buildHair(ramp = HAIR_RAMPS.brown, race = 'Human', skin = null) {
  const faces = [];
  const P = 0.8;
  const hasHair = race !== 'Argonian'; // reptilian: crest instead of hair
  if (hasHair) {
  // Top cap: full over the crown down to the hairline band.
  loftPiece(faces, [
    { y: 2.055, rx: 0.058, rz: 0.064, p: P, cz: -0.012 }, // crown
    { y: 2.000, rx: 0.114, rz: 0.128, p: P, cz: -0.018 }, // upper
    { y: 1.945, rx: 0.146, rz: 0.158, p: P, cz: -0.018 }, // widest
    { y: 1.910, rx: 0.148, rz: 0.160, p: P, cz: -0.014 }, // hairline band
  ], { group: 'head', seg: 26, capBottom: false });
  // Back + sides drop: continue down the nape/sides, front (face) open.
  const drop = [
    { y: 1.910, rx: 0.148, rz: 0.160, p: P, cz: -0.014 },
    { y: 1.820, rx: 0.146, rz: 0.156, p: P, cz: -0.020 },
    { y: 1.740, rx: 0.132, rz: 0.146, p: P, cz: -0.026 }, // nape
  ];
  // cover from PI/2+GAP round to PI/2-GAP (skip the front face arc)
  const GAP = 1.0;
  loftPiece(faces, drop, { group: 'head', seg: 22, arc: [Math.PI/2 + GAP, Math.PI/2 - GAP + Math.PI*2] });
  }

  shadeHair(faces, ramp);

  // ── RACE FEATURES ── flesh-coloured geometry (own ramp), shaded like
  // the hair bands. skin ramp passed so ears/muzzle match the head.
  const flesh = [];
  const quad = (a, b, c, d) => {
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2], vx=d[0]-a[0],vy=d[1]-a[1],vz=d[2]-a[2];
    let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx; const L=Math.hypot(nx,ny,nz)||1;
    flesh.push({ p:[...a,...b,...c,...d], n:[nx/L,ny/L,nz/L], g:'head' });
  };
  if (race === 'Elf') {
    // Detailed pointed ear: a curled pinna lofted from the lobe up to a
    // back-swept point. Each cross-section is a shallow C (the ear
    // curl) - outer edge = helix rim, inner = concha hollow. Attaches
    // to the head at the canal.
    const ear = (sx) => {
      // spine: [x-out, y, z] from lobe (front-low) to tip (back-high)
      const spine = [
        { o: 0.128, y: 1.842, z:  0.010, w: 0.026 }, // lobe
        { o: 0.150, y: 1.876, z: -0.006, w: 0.034 }, // lower pinna
        { o: 0.168, y: 1.912, z: -0.028, w: 0.036 }, // mid
        { o: 0.176, y: 1.948, z: -0.055, w: 0.030 }, // upper
        { o: 0.180, y: 1.982, z: -0.086, w: 0.018 }, // near tip
        { o: 0.178, y: 2.006, z: -0.110, w: 0.006 }, // point
      ];
      // each cross-section: a C-curl of 4 points (front-rim -> concha ->
      // back-rim), the rim standing OUT (+x*sx), concha pulled IN.
      const sect = (r) => {
        const X = sx * r.o, cIn = sx * (r.o - 0.028);
        return [
          [X,           r.y, r.z + r.w],       // front helix rim
          [cIn,         r.y, r.z + r.w*0.45],  // front concha
          [cIn,         r.y, r.z - r.w*0.45],  // back concha
          [X,           r.y, r.z - r.w],       // back helix rim
        ];
      };
      const S = spine.map(sect);
      // loft the four edge-strips between sections
      for (let k = 0; k + 1 < S.length; k++) for (let j = 0; j < 3; j++) {
        quad(S[k][j], S[k][j+1], S[k+1][j+1], S[k+1][j]);
      }
      // outer surface (back of the ear): rim-front to rim-back across
      for (let k = 0; k + 1 < S.length; k++) quad(S[k][0], S[k][3], S[k+1][3], S[k+1][0]);
      // attach the lobe/base to the head side
      const b = S[0], hz = 0.0, hy = 1.842;
      quad([sx*0.118, hy+0.02, hz+0.03], b[0], b[3], [sx*0.118, hy-0.01, hz-0.03]);
    };
    ear(-1); ear(1);
  } else if (race === 'Khajiit') {
    // feline ears on TOP of the head + a short muzzle.
    const kear = (sx) => {
      const bx=sx*0.070, bz=-0.02, base=1.985, tip=[sx*0.085,2.075,-0.03];
      quad([bx-0.02,base,bz+0.03],[bx+0.03,base,bz+0.03],tip,tip);
      quad([bx-0.02,base,bz-0.03],[bx-0.02,base,bz+0.03],tip,tip);
      quad([bx+0.03,base,bz-0.03],[bx+0.03,base,bz+0.03],tip,tip);
    };
    kear(-1); kear(1);
    // muzzle: a short snout off the front-lower face.
    const mz=0.150, ml=-0.045, mr=0.045, mT=1.845, mB=1.780;
    quad([ml,mT,mz],[mr,mT,mz],[mr,mB,mz+0.03],[ml,mB,mz+0.03]);     // top
    quad([ml,mB,mz+0.03],[mr,mB,mz+0.03],[mr,mB-0.01,mz-0.02],[ml,mB-0.01,mz-0.02]); // underside
    quad([ml,mT,mz],[ml,mB,mz+0.03],[ml-0.01,mB,mz-0.02],[ml-0.01,mT,mz-0.02]);      // L
    quad([mr,mT,mz],[mr+0.01,mT,mz-0.02],[mr+0.01,mB,mz-0.02],[mr,mB,mz+0.03]);      // R
  } else if (race === 'Argonian') {
    // spinal crest: a row of back-swept spines along the top midline.
    for (let i = 0; i < 4; i++) {
      const y = 2.02 - i*0.075, z = -0.02 - i*0.045, h = 0.05 - i*0.006, w = 0.014;
      quad([-w,y,z],[w,y,z],[0,y+h,z-0.05],[0,y+h,z-0.05]);
      quad([-w,y,z],[0,y+h,z-0.05],[w,y,z],[w,y,z]);
    }
  }
  if (flesh.length) {
    const Lx=0.5,Ly=0.55,Lz=0.67,Ln=Math.hypot(Lx,Ly,Lz);
    const sr = skin || ramp;
    const snap=(t)=>sr[Math.max(0,Math.min(sr.length-1,Math.round(t*(sr.length-1))))];
    for (const f of flesh) { const it=Math.max(0.1,(f.n[0]*Lx+f.n[1]*Ly+f.n[2]*Lz)/Ln*0.9+0.2); f.c=snap(Math.min(1,it)); }
    faces.push(...flesh);
  }

  compress(faces);
  return faces;
}
