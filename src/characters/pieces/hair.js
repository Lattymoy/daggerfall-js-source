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
  for (const f of faces) { const it = Math.min(1, Math.max(0.1, (f.n[0]*Lx + f.n[1]*Ly + f.n[2]*Lz) / Ln * 0.9 + 0.2)); f._i = it; f.c = snap(it); }
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
    // Muzzle: a ROUNDED mound (loft, not a box) - wide whisker-pad base
    // embedded in the face, tapering forward+down to a small nose. Each
    // ring is an ellipse (wider than tall) so it reads as a cat snout.
    const fZ = 0.176;
    const mring = (y, z, rx, ry, embedFix) => {
      const r = []; const N = 10;
      for (let k = 0; k < N; k++) { const a = k/N*2*Math.PI; r.push([Math.cos(a)*rx, y + Math.sin(a)*ry, z]); }
      return r;
    };
    const mrows = [
      mring(1.826, 0.096, 0.078, 0.044),  // base - WIDE whisker pads (barely protruding)
      mring(1.820, 0.114, 0.066, 0.038),
      mring(1.814, 0.126, 0.050, 0.030),
      mring(1.808, 0.134, 0.030, 0.021),  // nose shelf
      mring(1.803, 0.138, 0.014, 0.011),  // tip
    ];
    for (let i = 0; i + 1 < mrows.length; i++) for (let k = 0; k < 10; k++) { const j = (k+1)%10; quad(mrows[i][k], mrows[i][j], mrows[i+1][j], mrows[i+1][k]); }
    // cap the tip
    const tipC = [0, 1.806, 0.184]; for (let k = 0; k < 10; k++) { const j=(k+1)%10; quad(tipC, mrows[4][j], mrows[4][k], mrows[4][k]); }
    // nose: a small dark heart/triangle on the upper front of the snout.
    const ny = 1.826, nz = 0.134, nw = 0.016;
    const nL=[-nw,ny,nz], nR=[nw,ny,nz], nB=[0,ny-0.020,nz+0.008];
    quad(nL, nR, nB, nB);
    // High-set pointed ears: broad triangular, cupped forward. Bases sit
    // ON the upper skull (maxX ~0.075 there) and dip INTO it, so they're
    // welded to the head - not floating beside it.
    const kear = (sx) => {
      // large cat ear set WIDE on the skull corner, splayed outward: the
      // tip sits further out than the base (like the reference).
      const fb   = [sx*0.042, 1.972, 0.034];   // front base, on the corner
      const bb   = [sx*0.086, 1.958, -0.058];  // back base, at the skull edge
      const midb = [sx*0.060, 1.950, -0.012];  // base centre, dipped IN (cup)
      const tip  = [sx*0.108, 2.088, -0.030];  // point splayed OUT and up
      quad(fb, tip, midb, midb);          // front face
      quad(midb, tip, bb, bb);            // outer face
      quad(bb, tip, fb, fb);              // back face (wraps)
      quad(fb, midb, bb, bb);             // base floor (cup, embedded)
    };
    kear(-1); kear(1);
    // heavy brow ridge over the eyes.
    { const by = 1.898, bz = 0.126, bw = 0.086;
      quad([-bw,by,bz],[bw,by,bz],[bw*0.86,by-0.020,bz+0.020],[-bw*0.86,by-0.020,bz+0.020]);
      quad([-bw*0.86,by-0.020,bz+0.020],[bw*0.86,by-0.020,bz+0.020],[bw*0.7,by-0.030,bz-0.02],[-bw*0.7,by-0.030,bz-0.02]); }
    // cheek + neck ruff: fur flaring out and down, framing the face.
    const ruff = (sx, i) => {
      const y0 = 1.770 - i*0.028, rx = sx*(0.086 - i*0.004), z0 = 0.052 - i*0.014;
      const tip = [sx*(0.128 + i*0.006), y0 - 0.034, z0 - 0.030];
      quad([rx, y0 + 0.018, z0], tip, [rx, y0 - 0.018, z0 - 0.006], [rx, y0 - 0.018, z0 - 0.006]);
    };
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) ruff(sx, i);
    // whiskers: thin tapered strands from the muzzle sides, swept out and
    // slightly back+down (not square tufts). Three per side.
    const whisker = (sx, i) => {
      const y0 = 1.822 - i*0.016, th = 0.0022;
      const root = [sx*0.052, y0, fZ - 0.030];
      const tip  = [sx*(0.150 + i*0.024), y0 - 0.006 - i*0.010, fZ - 0.070 - i*0.026];
      quad([root[0], root[1]+th, root[2]], [tip[0], tip[1], tip[2]], [tip[0], tip[1], tip[2]], [root[0], root[1]-th, root[2]]);
    };
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) whisker(sx, i);
  } else if (race === 'Argonian') {
    // reptilian head: overlapping SCALE PLATES over the whole head, a
    // reptilian SNOUT, clustered HORNS, a tall CREST, spiky BROW, and a
    // neck FRILL.
    // ---- SCALE PLATES: raised overlapping tiles across the head ----
    const prof = [[1.820,0.045,0.046],[1.780,0.082,0.090],[1.720,0.100,0.115],[1.660,0.108,0.125],[1.620,0.102,0.125],[1.560,0.082,0.110]];
    const interp = (cy) => { for (let i=0;i+1<prof.length;i++){ const a=prof[i],b=prof[i+1]; if (cy<=a[0]&&cy>=b[0]){ const t=(cy-a[0])/(b[0]-a[0]); return [a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; } } return cy>prof[0][0]?[prof[0][1],prof[0][2]]:[prof[5][1],prof[5][2]]; };
    // one scale: a small raised pyramid (4 tris to an apex lifted off the
    // surface) -> a discrete bump. Placed with GAPS so they don't merge.
    const scale = (x, cy, z, nx, nz, r) => {
      const py = cy/0.9;
      const tx = nz, tz = -nx;                 // sideways tangent (xz)
      const B = (dt, dv) => [x + tx*dt, py + dv, z + tz*dt]; // base ring point
      const apex = [x + nx*0.016, py, z + nz*0.016];         // lifted centre
      const a1=B(-r,-r), a2=B(r,-r), a3=B(r,r), a4=B(-r,r);
      quad(a1, a2, apex, apex); quad(a2, a3, apex, apex); quad(a3, a4, apex, apex); quad(a4, a1, apex, apex);
    };
    let rowi = 0;
    for (let cy=1.590; cy<=1.795; cy+=0.032, rowi++) {
      const [rx,fz]=interp(cy);
      const off = (rowi%2)*0.5;
      for (let step=-3+off; step<=3; step+=1.0) {
        const a = step*0.40;
        if (Math.abs(a) > 1.30) continue;
        const sxx=Math.sin(a), x=rx*sxx*0.97, z=fz*Math.cos(a)*0.98;
        const nl=Math.hypot(sxx,Math.cos(a))||1;
        scale(x, cy, z, sxx/nl, Math.cos(a)/nl, 0.013);
      }
    }
    // ---- SNOUT: a reptilian snout projecting from the lower face ----
    const snring = (y,z,rx2,ry2)=>{ const r=[]; for(let k=0;k<8;k++){const ang=k/8*2*Math.PI; r.push([Math.cos(ang)*rx2, y+Math.sin(ang)*ry2, z]);} return r; };
    const sn = [ snring(1.816,0.104,0.066,0.048), snring(1.808,0.124,0.054,0.038), snring(1.800,0.138,0.042,0.028), snring(1.794,0.148,0.028,0.018), snring(1.790,0.152,0.014,0.010) ];
    for(let i=0;i+1<sn.length;i++) for(let k=0;k<8;k++){const j=(k+1)%8; quad(sn[i][k],sn[i][j],sn[i+1][j],sn[i+1][k]);}
    { const tc=[0,1.790,0.154]; for(let k=0;k<8;k++){const j=(k+1)%8; quad(tc,sn[4][j],sn[4][k],sn[4][k]);} }
    // nostrils: two small dark dents near the snout tip
    for (const sxn of [-1,1]) { const nx2=sxn*0.016; quad([nx2-0.006,1.812,0.146],[nx2+0.006,1.812,0.146],[nx2+0.004,1.800,0.150],[nx2-0.004,1.800,0.150]); }
    // horns: from the top-sides, curving up then back to a point.
    const horn = (sx) => tube([
      { x: sx*0.066, y: 1.892, z:  0.000, r: 0.036 }, // base on the temple (skull maxX~0.10 here)
      { x: sx*0.088, y: 1.922, z: -0.058, r: 0.029 }, // rising slightly, curving back
      { x: sx*0.092, y: 1.930, z: -0.124, r: 0.021 }, // hugging the skull side, back
      { x: sx*0.080, y: 1.918, z: -0.186, r: 0.012 }, // sweeping past the back of the head
      { x: sx*0.062, y: 1.894, z: -0.238, r: 0.005 }, // tip
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
      // inner edge sits ON the head (within maxX at each height); outer
      // edge fans out a modest amount - a connected membrane, not flaps.
      const inner = [[sx*0.092, 1.836, -0.044], [sx*0.086, 1.768, -0.082], [sx*0.074, 1.704, -0.104]];
      const outer = [[sx*0.118, 1.844, -0.108], [sx*0.126, 1.768, -0.140], [sx*0.114, 1.704, -0.166]];
      for (let i = 0; i + 1 < inner.length; i++) quad(inner[i], outer[i], outer[i+1], inner[i+1]);
    };
    frill(-1); frill(1);
  }
  if (flesh.length) {
    const Lx=0.5,Ly=0.55,Lz=0.67,Ln=Math.hypot(Lx,Ly,Lz);
    const sr = skin || ramp;
    const snap=(t)=>sr[Math.max(0,Math.min(sr.length-1,Math.round(t*(sr.length-1))))];
    for (const f of flesh) { const it=Math.min(1,Math.max(0.1,(f.n[0]*Lx+f.n[1]*Ly+f.n[2]*Lz)/Ln*0.9+0.2)); f._i=it; f.c=snap(it); }
    faces.push(...flesh);
  }

  compress(faces);
  return faces;
}
