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
  // curved tube along a 3D spine [{x,y,z,r}] - shared by horns/muzzle.
  const tube = (spine, N = 6) => {
    const rings = spine.map((pp, i) => {
      const a = spine[Math.max(0, i-1)], b = spine[Math.min(spine.length-1, i+1)];
      let tx=b.x-a.x, ty=b.y-a.y, tz=b.z-a.z; const tl=Math.hypot(tx,ty,tz)||1; tx/=tl;ty/=tl;tz/=tl;
      let ux=0, uy=1, uz=0; const d=ux*tx+uy*ty+uz*tz; ux-=d*tx; uy-=d*ty; uz-=d*tz; const ul=Math.hypot(ux,uy,uz)||1; ux/=ul;uy/=ul;uz/=ul;
      const bx=ty*uz-tz*uy, by=tz*ux-tx*uz, bz=tx*uy-ty*ux;
      const ring = [];
      for (let k=0;k<N;k++){ const ang=k/N*2*Math.PI, c=Math.cos(ang)*pp.r, sn=Math.sin(ang)*pp.r; ring.push([pp.x+c*ux+sn*bx, pp.y+c*uy+sn*by, pp.z+c*uz+sn*bz]); }
      return ring;
    });
    for (let i=0;i+1<rings.length;i++) for (let k=0;k<N;k++){ const j=(k+1)%N; quad(rings[i][k], rings[i][j], rings[i+1][j], rings[i+1][k]); }
  };
  if (race === 'Elf') {
    // Detailed pointed ear: a curled pinna lofted from the lobe up to a
    // back-swept point. Each cross-section is a shallow C (the ear
    // curl) - outer edge = helix rim, inner = concha hollow. Attaches
    // to the head at the canal.
    const ear = (sx) => {
      // spine: [x-out, y, z] from lobe (front-low) to tip (back-high)
      const spine = [
        { o: 0.086, y: 1.836, z:  0.006, w: 0.028 }, // lobe - ON the head side
        { o: 0.116, y: 1.874, z: -0.010, w: 0.034 }, // lower pinna (leaving surface)
        { o: 0.150, y: 1.912, z: -0.030, w: 0.036 }, // mid
        { o: 0.170, y: 1.950, z: -0.058, w: 0.030 }, // upper
        { o: 0.178, y: 1.984, z: -0.088, w: 0.018 }, // near tip
        { o: 0.176, y: 2.008, z: -0.112, w: 0.006 }, // point
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
      const b = S[0];
      quad([sx*0.070, 1.858, 0.030], b[0], b[3], [sx*0.070, 1.820, -0.030]); // weld lobe into the head
    };
    ear(-1); ear(1);
  } else if (race === 'Khajiit') {
    // FELINE head: a pronounced muzzle with a nose, and high-set upright
    // pointed ears cupped forward. (feline eyes/whiskers are texture.)
    // Muzzle: SHORT + WIDE + rounded, emerging from the face (back face
    // embedded in the head so there's no gap). Cat, not Squidward.
    const bZ = 0.088, fZ = 0.150, hw = 0.062, fhw = 0.044, top = 1.872, bot = 1.798;
    const bTL=[-hw,top,bZ], bTR=[hw,top,bZ], bBL=[-hw,bot,bZ], bBR=[hw,bot,bZ];
    const fTL=[-fhw,top-0.008,fZ], fTR=[fhw,top-0.008,fZ], fBL=[-fhw*0.82,bot+0.010,fZ], fBR=[fhw*0.82,bot+0.010,fZ];
    quad(fTL,fTR,fBR,fBL);         // rounded front
    quad(bTL,fTL,fBL,bBL);         // left cheek
    quad(bTR,bBR,fBR,fTR);         // right cheek
    quad(bTL,bTR,fTR,fTL);         // bridge (top)
    quad(bBL,fBL,fBR,bBR);         // jaw (bottom)
    // nose pad: a small dark wedge on the upper-front of the muzzle.
    const nhw = 0.018, nz = fZ;
    quad([-nhw,top-0.002,nz-0.004],[nhw,top-0.002,nz-0.004],[nhw*0.6,top-0.020,nz+0.010],[-nhw*0.6,top-0.020,nz+0.010]);
    // High-set pointed ears: broad triangular, cupped forward. Bases sit
    // ON the upper skull (maxX ~0.075 there) and dip INTO it, so they're
    // welded to the head - not floating beside it.
    const kear = (sx) => {
      // broad triangular cat ear: wide base on the skull, tip a modest
      // rise above the crown, cupped (centre dipped in).
      const fb   = [sx*0.014, 1.978, 0.040];   // front-inner base
      const bb   = [sx*0.080, 1.970, -0.056];  // back-outer base (at skull edge)
      const midb = [sx*0.044, 1.962, -0.010];  // base centre, dipped IN (cup)
      const tip  = [sx*0.052, 2.070, -0.030];  // point, ~0.06 above crown
      quad(fb, tip, midb, midb);          // front-inner face
      quad(midb, tip, bb, bb);            // front-outer face
      quad(bb, tip, fb, fb);              // back face (wraps around)
      quad(fb, midb, bb, bb);             // base floor (cup, embedded)
    };
    kear(-1); kear(1);
    // cheek fur tufts: small angular tufts, rooted at the cheek surface
    // (maxX ~0.100 at that height) and swept out+down.
    const tuft = (sx) => {
      const rx = sx*0.092, y = 1.815, z = 0.078;  // root on the cheek
      quad([rx,y+0.024,z],[rx+sx*0.052,y+0.004,z-0.028],[rx+sx*0.046,y-0.030,z-0.018],[rx,y-0.022,z]);
    };
    tuft(-1); tuft(1);
  } else if (race === 'Argonian') {
    // reptilian head: curved swept-back HORNS, a tall spinal CREST, a
    // brow-SCALE ridge, snout NOSE-SPIKES and a fanned neck FRILL.
    // horns: from the top-sides, curving up then back to a point.
    const horn = (sx) => tube([
      { x: sx*0.070, y: 1.940, z: -0.005, r: 0.034 }, // rooted INTO the skull
      { x: sx*0.116, y: 2.005, z: -0.055, r: 0.026 },
      { x: sx*0.128, y: 2.030, z: -0.115, r: 0.019 },
      { x: sx*0.126, y: 2.032, z: -0.180, r: 0.011 },
      { x: sx*0.116, y: 2.018, z: -0.235, r: 0.004 }, // tip
    ]);
    horn(-1); horn(1);
    // tall spinal crest: 7 back-swept spines, bigger than before.
    for (let i = 0; i < 7; i++) {
      const t = i/6, y = 2.035 - t*0.34, z = 0.0 - t*0.14, h = 0.075 - t*0.03, w = 0.020 - t*0.008;
      quad([-w,y,z],[w,y,z],[0,y+h,z-0.055],[0,y+h,z-0.055]);
      quad([w,y,z],[0,y+h,z-0.055],[-w,y,z],[-w,y,z]);
    }
    // brow scales: a row of raised angular plates across the brow.
    for (let i = 0; i < 5; i++) {
      const sx = (i-2)/2 * 0.096, y = 1.878, z = 0.126, w = 0.022, h = 0.018;
      quad([sx-w,y-h*0.5,z-0.01],[sx+w,y-h*0.5,z-0.01],[sx+w*0.5,y+h*0.5,z+0.02],[sx-w*0.5,y+h*0.5,z+0.02]); // plate
      quad([sx-w*0.5,y+h*0.5,z+0.02],[sx+w*0.5,y+h*0.5,z+0.02],[sx,y+h,z-0.005],[sx,y+h,z-0.005]);              // ridge
    }
    // nose-ridge spikes: small spikes down the centre of the snout.
    for (let i = 0; i < 3; i++) {
      const y = 1.858 - i*0.026, z = 0.116 + i*0.012, w = 0.012, h = 0.020;
      quad([-w,y,z],[w,y,z],[0,y+h*0.4,z+0.03],[0,y+h*0.4,z+0.03]);
    }
    // neck frill: a fan of membrane spikes sweeping out+back from behind
    // the jaw on each side (frilled-lizard silhouette).
    const frill = (sx) => {
      const root = [sx*0.086, 1.815, -0.030];
      for (let i = 0; i < 4; i++) {
        const t0 = i/4, t1 = (i+1)/4, sp = 0.130;
        const outer = (t) => [sx*(0.120 + t*sp), 1.845 - t*0.075, -0.055 - t*0.120];
        quad(root, outer(t0), outer(t1), root);
      }
    };
    frill(-1); frill(1);
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
