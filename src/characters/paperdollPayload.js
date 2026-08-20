// ═══════════════════════════════════════════════════════════════════
// THE PAPERDOLL PAYLOAD
//
// Everything the voxel editor needs to draw, built from three ARENA2
// files: the palette, the body sprite the skin and boot ramps are read
// out of, and the face.
//
// IT LIVES HERE BECAUSE IT HAS TWO CALLERS. tools/neutral/build-viewer.mjs
// reads those three off disk and bakes the result into a standalone
// file; the deployed editor gets the same three through dataSource at
// RUNTIME and calls this with them. One source, so the local tool and
// the published page cannot drift into building different figures.
//
// AND BECAUSE OF THE DOCTRINE. "A RENDER OF GAME DATA IS GAME DATA" —
// the ramps come out of BODY00I0.IMG and the face out of FACE00I0.CIF,
// so this payload IS game data and may never be committed or bundled.
// AUDIT 21 caught exactly that being published once already.
//
// So nothing here touches the filesystem. It takes readers that are
// ALREADY LOADED and hands back an object, which leaves the question of
// where the bytes came from to the caller — and for the deployed editor
// the answer is: from the user, at runtime, same as the game.
//
// Pure and browser-safe by design. No node imports.
// ═══════════════════════════════════════════════════════════════════

import { buildNeutralBody, WRIST_JUNCTION_Y, ARM_X, NECK_PIVOT_Y } from './neutralBody.js';
import { ATTACKS_1H, ATTACKS_2H, ATTACKS_RANGED, ATTACKS_FP, REACTIONS, DIRECTION_TO_STRIKE, STRIKES } from './anims.js';
import { buildCuirass, STEEL_RAMP } from './pieces/cuirass.js';
import { buildGreaves } from './pieces/greaves.js';
import { CLOTH_RAMP, MAIL_RAMP, LEATHER_RAMP } from './pieces/pieceLoft.js';
import { clothingZones } from './clothing.js';
import { armorZones } from './armorSet.js';
import { buildPauldrons } from './pieces/pauldrons.js';
import { buildHelm } from './pieces/helm.js';
import { buildHair, HAIR_RAMPS } from './pieces/hair.js';
import { buildTail } from './pieces/tail.js';
import { buildBodyScales, buildBodyFur, KHAJIIT_FUR, KHAJIIT_BELLY, ARGONIAN_HIDE } from './pieces/bodyScales.js';
import { PALETTES } from './palettes.js';
import { drapedPiece, drapedGrid, DRAPED_NAMES, BODY_CORE, DRAPE_MATERIAL } from './pieces/draped.js';
import { POSES } from './poses.js';
import { buildSword } from './pieces/sword.js';
import { WEAPON_MATERIALS, weaponMaterialRamp, buildWeapon, WEAPONS } from './weapons.js';
import { buildClaymore } from './pieces/claymore.js';
import { buildLongBow, buildShortBow, buildNockedArrow } from './pieces/bow.js';
import { buildBladeWeapon, BLADE_SPECS } from './pieces/blades.js';
import { buildHaftedWeapon, HAFTED_SPECS } from './pieces/hafted.js';
import { VILLAGER_DESIGNS, designOpts, designDrape, villagerDelta, RACE_TONE } from './villagerDesigns.js';
import { ORC_DESIGNS, orcOpts } from './orcBody.js';
import { UNDEAD_DESIGNS, undeadOpts } from './undeadBody.js';
import { CLASS_DESIGNS, classOpts } from './humanClasses.js';
import { ATRONACH_DESIGNS, atronachOpts } from './atronachs.js';
import { BEAST_DESIGNS, beastOpts, ALL_GROUPS } from './beasts.js';
import { buildBeastBody, buildBeastTail } from './pieces/beastBody.js';
import { buildBeastHead, WOLF_RAMP } from './pieces/beastHead.js';
import { buildArachnid } from './pieces/arachnid.js';
import { buildWings } from './pieces/wings.js';
import { buildFishBody } from './pieces/fishBody.js';
import { DAEDRA_DESIGNS, daedraOpts } from './daedra.js';
import { buildHorns } from './pieces/beastHead.js';
import { buildRibcage, buildPelvis, BONE_RAMP } from './pieces/skeletonBones.js';
import { buildHorseBody, BAY_RAMP } from './pieces/centaurBody.js';
import { buildTusks, buildBrow, IVORY_RAMP } from './pieces/orcHead.js';

/**
 * @param {object} pal a loaded DFPalette
 * @param {object} img a loaded ImgFile    — BODY00I0.IMG
 * @param {object} cif a loaded CifRciFile — FACE00I0.CIF
 * @returns {object} the editor's payload, as an OBJECT
 */
/**
 * OUR OWN COLOURS, so the editor never needs the game to open.
 *
 * The rig's GEOMETRY is ours — every loft row, every weapon, every pose.
 * The only things that ever came out of ARENA2 were three colour
 * lookups: the skin and boot ramps read off BODY00I0's sprite, the face
 * bitmap, and pal.get() for the metal ramps. So they get defaults that
 * are ours to ship, and the editor opens on a link with nothing asked
 * of anybody.
 *
 * With real data present it still uses it — authentic palette,
 * sprite-read ramps, the face. Without, it draws the same figure in our
 * own tones and skips the face. Nothing is missing but the licence.
 */
const OUR_BOOT = [
  [34, 26, 20],
  [56, 42, 32],
  [78, 60, 46],
  [100, 78, 60],
  [122, 96, 74],
];

/**
 * A STAND-IN FOR ART_PAL, WITH THE ART'S OWN COLOURS IN IT.
 *
 * The orc line, the villagers and the weapon materials do not carry
 * colours — they carry ART_PAL INDEX RANGES. `hideGreen: [160, 172]`
 * is "block 10, pale green to deep green", and it only becomes green
 * when a palette resolves it. A flat grey ramp made every orc in the
 * editor grey, which is what Mac was looking at.
 *
 * Daggerfall's palette is sixteen blocks of sixteen, each block a ramp
 * within one hue, and the art documents which is which in its own
 * comments — block 10 moss, block 12 sage, block 15 blood, block 5
 * crude iron, and so on. So this reproduces that structure: the same
 * blocks, the same light-to-dark direction, in our own approximations
 * of those hues.
 *
 * OURS TO SHIP. These are colours we picked to match descriptions the
 * art already carries in plain English; no ARENA2 byte is involved. Real
 * data still overrides it whenever it is present.
 */
const BLOCKS = [
  [200, 200, 200], // 0  greys
  [186, 176, 160], // 1  bone
  [178, 132, 84], // 2  tan -> brown
  [214, 158, 170], // 3  pink -> mauve
  [206, 176, 128], // 4  cream -> tan -> dark brown
  [150, 148, 172], // 5  lavender grey -> slate (crude iron)
  [120, 160, 214], // 6  light blue -> deep blue
  [236, 236, 232], // 7  white -> charcoal
  [140, 200, 200], // 8  pale cyan
  [206, 194, 96], // 9  yellow -> olive
  [150, 196, 120], // 10 pale green -> deep green (moss: the orc hide)
  [176, 108, 66], // 11 rust -> dark brown
  [190, 202, 110], // 12 pale yellow-green -> green (sage)
  [170, 150, 200], // 13 violet
  [236, 206, 140], // 14 cream -> orange (brass)
  [222, 108, 66], // 15 orange-red -> dark red (blood)
];

function ourPalette() {
  return {
    get(i) {
      const idx = Math.max(0, Math.min(255, i | 0));
      const [r, g, b] = BLOCKS[(idx >> 4) & 15];
      // Within a block the ramp runs light to dark, as ART_PAL's do.
      const k = 1 - (idx & 15) / 15;
      const f = 0.24 + k * 0.86;
      return {
        r: Math.min(255, Math.round(r * f)),
        g: Math.min(255, Math.round(g * f)),
        b: Math.min(255, Math.round(b * f)),
      };
    },
  };
}

/**
 * @param {object|null} pal a loaded DFPalette, or null for ours
 * @param {object|null} img BODY00I0.IMG, or null to use our ramps
 * @param {object|null} cif FACE00I0.CIF, or null for no face
 */
export function buildPaperdollPayload(pal, img, cif) {
  const haveData = !!(pal && img);
  if (!pal) pal = ourPalette();
  const { width: W, data } = haveData ? img.getDFBitmap() : { width: 0, data: [] };
  const lum = (i) => { const c = pal.get(i); return 0.299*c.r + 0.587*c.g + 0.114*c.b; };
  const rampOf = (r0, r1, keep) => { const m = new Map(); for (let y=r0;y<=r1;y++) for (let x=0;x<W;x++){ const i=data[y*W+x]; if(i&&(!keep||keep(x,y))) m.set(i,lum(i)); } return [...m.entries()].sort((a,b)=>a[1]-b[1]).map(e=>{const c=pal.get(e[0]);return [c.r,c.g,c.b];}); };
  const ramps = haveData
    ? { skin: rampOf(40, 60, (x) => Math.abs(x - 34) < 14), boot: rampOf(132, 144) }
    : { skin: PALETTES.human[1].ramp, boot: OUR_BOOT };
  // Character FACE sprite (FACE00I0 record 0) projected onto the head front.
  // The face is the one thing with no substitute of ours: it is a
  // sprite, not a colour, so without ARENA2 the head simply has none.
  // Everything else about the figure is unaffected.
  let face = null;
  if (cif) {
    const fb = cif.getDFBitmap(0, 0);
    const faceRgb = [];
    for (let i2 = 0; i2 < fb.data.length; i2++) {
      const idx = fb.data[i2];
      if (idx) { const c = pal.get(idx); faceRgb.push([c.r, c.g, c.b]); } else faceRgb.push(null);
    }
    face = { w: fb.width, h: fb.height, rgb: faceRgb };
  }

  // (The old `outfit`/`armor`/`mats` sample zones were built and never
  // passed to anything - the cloth path had no consumer until the
  // villager designs below became its first.)
  const faces = buildNeutralBody(ramps, { face });

  // ═════════════════════════════════════════════════════════════════
  // HOW WIDE A GARMENT HAS TO BE, MEASURED RATHER THAN GUESSED
  //
  // The fit was `torso * 0.75 + shoulder * 0.25`, times a margin. That
  // is a guess from two build keys, and it ignores the thing that
  // actually decides the answer: ARMS HANG OUTSIDE THE TORSO. Measured
  // across every drape-wearing design, 669 rows were clipping and every
  // one of them was an arm — a lich's stuck 111% beyond its own robe.
  //
  // A garment is an ellipse of rx by rz at each of its rows. A body
  // point at (x, z) is inside it when (x/rx)^2 + (z/rz)^2 < 1. So the
  // scale a design needs is simply the largest that ratio ever reaches
  // over the rows the garment actually covers — computed here, where the
  // built body and the garment grid are both in hand, and shipped with
  // the design so the viewer does no arithmetic at all.
  //
  // It is done once per design at build time rather than per frame.
  const drapeRowsOf = (name) => {
    const g = drapedGrid(name);
    if (!g) return null;
    const rows = [];
    for (let r = 0; r < g.rows; r++) {
      let y = 0, rx = 0, rz = 0;
      for (let c = 0; c < g.cols; c++) {
        const i = (r * g.cols + c) * 3;
        y = g.pos[i + 1];
        rx = Math.max(rx, Math.abs(g.pos[i]));
        rz = Math.max(rz, Math.abs(g.pos[i + 2]));
      }
      if (rx > 1e-6 && rz > 1e-6) rows.push({ y, rx, rz });
    }
    return rows;
  };

  /**
   * The scale each ROW needs, not one scale for the garment.
   *
   * A single number is set by the widest thing the cloth must clear —
   * the arms, always — and then applied to the hem and the collar too,
   * which turns a robe into a cone. Measured per row, the garment widens
   * where the arms are and is left alone everywhere else.
   *
   * Returned as an array the length of the grid's rows, so the viewer
   * moves vertices rather than scaling a mesh. Y is still never touched:
   * only the x and z of each ring move.
   */
  const measureDrapeFit = (bodyFaces, drapeName) => {
    const rows = drapeRowsOf(drapeName);
    if (!rows || !rows.length) return null;
    const BAND = 0.05; // how far a row reaches for body it must clear
    const MARGIN = 1.05; // cloth hangs off a body, it does not paint it
    const per = rows.map((r) => {
      let worst = 0;
      for (const f of bodyFaces) {
        for (let i = 0; i < 4; i++) {
          if (Math.abs(f.p[i * 3 + 1] - r.y) > BAND) continue;
          const nx = Math.abs(f.p[i * 3]) / r.rx;
          const nz = Math.abs(f.p[i * 3 + 2]) / r.rz;
          const need = Math.hypot(nx, nz);
          if (need > worst) worst = need;
        }
      }
      return Math.max(1, worst * MARGIN);
    });
    // SMOOTH IT. A row that jumps from 1.0 to 1.4 and back puts a step in
    // the cloth — real fabric spans a bulge rather than wrapping it. Two
    // passes of a three-tap max-then-average, so a row is never narrower
    // than the body it is next to.
    for (let pass = 0; pass < 2; pass++) {
      const src = per.slice();
      for (let i = 0; i < per.length; i++) {
        const a = src[Math.max(0, i - 1)];
        const b = src[i];
        const c = src[Math.min(src.length - 1, i + 1)];
        per[i] = Math.max(b, (a + b + c) / 3);
      }
    }
    return per;
  };

  /** Attach the measured fit to a drape, or pass a missing one through. */
  const withFit = (drape, bodyFaces) =>
    drape ? { ...drape, fit: measureDrapeFit(bodyFaces, drape.name) } : null;

  let minY = 1e9, maxY = -1e9;
  for (const f of faces) for (let i=0;i<4;i++){ const y=f.p[i*3+1]; if(y<minY)minY=y; if(y>maxY)maxY=y; }
  const GI = { body:0, head:1, armL:2, armR:3, legL:4, legR:5 };
  const P=[], N=[], C=[], G=[], Ib=[];
  for (const f of faces) {
    for (let i=0;i<4;i++) P.push(Math.round(f.p[i*3]*1000), Math.round(f.p[i*3+1]*1000), Math.round(f.p[i*3+2]*1000));
    N.push(Math.round(f.n[0]*127), Math.round(f.n[1]*127), Math.round(f.n[2]*127));
    C.push(f.c[0], f.c[1], f.c[2]);
    Ib.push(Math.round((f._i ?? 0.6) * 255));
    G.push(GI[f.g] ?? 0);
  }
  // ── the VILLAGER DESIGNS (editor only - nothing here touches a game
  // host). A design's zones DISPLACE the body's own faces and recolour
  // them; they never add geometry, so all 25 share the base body's face
  // list and only ~11% of it differs. Shipping 25 whole bodies would be
  // megabytes of payload for one standalone file, so each villager is a
  // DELTA: the indices that changed, their new corners, their new
  // colour. Normals are untouched (displace moves corners radially and
  // leaves f.n alone), so the delta carries none.
  const villagerPacks = VILLAGER_DESIGNS.map((d) => {
    const vf = buildNeutralBody(ramps, { face, ...designOpts(d, pal) });
    return {
      archive: d.archive, race: d.race, gender: d.gender, name: d.name, build: d.build,
      hair: d.hair, tone: RACE_TONE[d.race],
      drape: withFit(designDrape(d, pal), vf),
      ...villagerDelta(faces, vf),
    };
  });

  // armor pieces (separate meshes in the viewer, toggleable).
  const packPiece = (pf) => { const pP=[], pN=[], pC=[], pG=[], pI=[]; for (const f of pf) { for (let i=0;i<4;i++) pP.push(Math.round(f.p[i*3]*1000), Math.round(f.p[i*3+1]*1000), Math.round(f.p[i*3+2]*1000)); pN.push(Math.round(f.n[0]*127), Math.round(f.n[1]*127), Math.round(f.n[2]*127)); pC.push(f.c[0], f.c[1], f.c[2]); pI.push(Math.round((f._i ?? 0.6) * 255)); pG.push(GI[f.g] ?? 0); } return { P: pP, N: pN, C: pC, G: pG, I: pI }; };

  // ── the ORC LINE (editor only - nothing here touches a game host).
  // Same DELTA mechanism as the villagers, and for the same reason: a
  // build spec scales the rig's loft rows but adds and drops NO faces
  // (asserted in test/orcbody.test.js), so all four orcs ride the base
  // face list and ship only what moved. The tusks and the brow ARE new
  // geometry, so those go as their own packs - one pair per design,
  // because a warlord's tusk is not a baseline orc's scaled up in the
  // shader, it is a different root anchor and a different length.
  const orcPacks = ORC_DESIGNS.map((d) => {
    const { ramps: oramps, opts, hide } = orcOpts(d, pal);
    const of = buildNeutralBody(oramps, { face, ...opts });
    return {
      id: d.id, name: d.name, level: d.level, damage: d.damage, weaponTier: d.weaponTier,
      build: d.build, hide,
      tusks: packPiece(buildTusks(IVORY_RAMP, { jaw: d.build.jaw, size: d.tusk.size })),
      brow: packPiece(buildBrow(hide, { skull: d.build.skull, jut: d.brow.jut })),
      ...villagerDelta(faces, of),
    };
  });

  // ── THE UNDEAD LINE (editor only, same as the orcs above) ──────
  // Zombie and Mummy on the SAME delta mechanism: their build specs
  // scale the rig's loft rows and add no faces, so both ride the base
  // face list and ship only what moved. No tusks, no brow — they carry
  // no geometry of their own, which is exactly why this line was the
  // right one to take next and the skeleton was not.
  // COLLAPSING A LIMB THE DESIGN DOES NOT USE.
  //
  // A centaur's human legs cannot simply be scaled away: buildNeutralBody
  // clamps girth at 0.6 and has no way to drop a group, because the face
  // list is fixed and every delta in this file depends on that. Burying
  // them inside the barrel only worked sideways — a human leg runs from
  // the hip to the FLOOR and the horse's belly is well above it, so two
  // shins came out underneath the animal.
  //
  // So the faces stay in the list and lose their AREA: every corner of a
  // collapsed group is moved to one point inside the barrel. The count
  // is untouched, the delta still packs, and a zero-area quad draws
  // nothing. It costs 0 faces and 0 changes to the shared rig.
  const collapseGroups = (fs, groups, at) => {
    for (const f of fs) {
      if (!groups.includes(f.g)) continue;
      for (let i = 0; i < f.p.length; i += 3) {
        f.p[i] = at[0];
        f.p[i + 1] = at[1];
        f.p[i + 2] = at[2];
      }
    }
    return fs;
  };

  const undeadPacks = UNDEAD_DESIGNS.map((d) => {
    const { ramps: uramps, opts, hide, drape } = undeadOpts(d, pal);
    let uf = buildNeutralBody(uramps, { face, ...opts });
    // A design with a body of its own has no use for the rig's legs.
    if (d.collapse) uf = collapseGroups(uf, d.collapse, [0, 0.8, -0.2]);
    return {
      id: d.id, name: d.name, level: d.level, damage: d.damage, weaponTier: d.weaponTier,
      build: d.build, zones: d.zones, hide, spectral: d.spectral || null,
      // GEOMETRY OF ITS OWN, where a design has any. The zombie and the
      // mummy have none — they are the loft and nothing else — and the
      // skeleton is the first in this file that needs a piece to carry
      // its silhouette rather than decorate it. Packed exactly as the
      // orc tusks are, so the viewer's one piece path serves both.
      ribcage: d.bones ? packPiece(buildRibcage(BONE_RAMP, { torso: d.build.torso, ...d.bones })) : null,
      pelvis: d.bones ? packPiece(buildPelvis(BONE_RAMP, { torso: d.build.torso })) : null,
      horse: d.horse ? packPiece(buildHorseBody(BAY_RAMP, d.horse)) : null,
      // A LICH IS A SKELETON IN ROBES: bones AND a drape, from two
      // systems that had never shared a figure. It rides the villagers'
      // own drape field, so the viewer dresses it with the code that
      // already dresses a gown.
      drape: withFit(drape, uf),
      ...villagerDelta(faces, uf),
    };
  });

  // ── THE HUMAN CLASS ENEMIES ────────────────────────────────────
  // Mage, Sorcerer, Battlemage, Bard, Thief — collectively the commonest
  // thing in a dungeon, and the last large group with no rig. They are
  // just PEOPLE: no geometry, no mechanism, a human build barely touched
  // and everything said with clothing. After orcs, bone, a horse body
  // and a composition test, the most-met enemies in the game cost a data
  // file, which is the return on all of it.
  const classPacks = CLASS_DESIGNS.map((d) => {
    const { ramps: cramps, opts, hide, drape } = classOpts(d, pal);
    const cf = buildNeutralBody(cramps, { face, ...opts });
    return {
      id: d.id, name: d.name, level: d.level, damage: d.damage, weaponTier: d.weaponTier,
      build: d.build, zones: d.zones, hide, drape: withFit(drape, cf),
      ...villagerDelta(faces, cf),
    };
  });

  // ── THE ATRONACHS ──────────────────────────────────────────────
  // The only group in ENEMY_BASICS whose members are statistically
  // IDENTICAL — all four level 16, 5-15 damage, armour 6 — so the whole
  // job is making four things that fight the same look nothing alike.
  // Three render modes between them: additive for fire, transparent for
  // ice, solid for iron and flesh.
  const atronachPacks = ATRONACH_DESIGNS.map((d) => {
    const { ramps: aramps, opts, hide } = atronachOpts(d, pal);
    const af = buildNeutralBody(aramps, { face, ...opts });
    return {
      id: d.id, name: d.name, level: d.level, damage: d.damage, weaponTier: d.weaponTier,
      build: d.build, zones: d.zones, hide, spectral: d.spectral || null,
      ...villagerDelta(faces, af),
    };
  });

  // ── THE BEASTS ─────────────────────────────────────────────────
  // The first enemies here with no human in them at all. Every other
  // design is a person underneath — scaled, stripped, robed, or with a
  // horse hung off him. These collapse the rig's WHOLE body, all six
  // groups, using the mechanism the centaur needed for two, and what the
  // player sees is entirely the piece.
  //
  // The rig still earns its keep: it holds the face list at 2136 so they
  // ship as deltas like everything else, and an animal animates through
  // the same path a man does.
  const beastPacks = BEAST_DESIGNS.map((d) => {
    const { ramps: bramps, opts, hide, pelt, drape } = beastOpts(d, pal);
    let bf = buildNeutralBody(bramps, { face, ...opts });
    // TWO KINDS OF DESIGN IN ONE LINE. A full beast collapses ALL six
    // groups and its piece is the whole animal. A werebeast collapses
    // only the HEAD and keeps the man's body — it is a man with the
    // wrong head, not a wolf on four legs, and that is the difference
    // between the two halves of this file.
    bf = collapseGroups(bf, d.collapse || ALL_GROUPS, [0, 1.5, 0]);
    return {
      id: d.id, name: d.name, level: d.level, damage: d.damage, weaponTier: d.weaponTier,
      build: d.build || {}, zones: d.zones || [], hide,
      beast: d.beast ? packPiece(buildBeastBody(pelt, d.beast)) : null,
      beastHead: d.beastHead ? packPiece(buildBeastHead(pelt, d.beastHead)) : null,
      // NO SPINE: an arachnid gets its own builder rather than more
      // parameters on the quadruped's. See pieces/arachnid.js.
      arachnid: d.arachnid ? packPiece(buildArachnid(pelt, d.arachnid)) : null,
      // FLYING: the one behaviour that is neither foot nor fin. A wing
      // is a membrane on fingers, so it is panels rather than boxes —
      // see pieces/wings.js.
      wings: d.wings ? packPiece(buildWings(pelt, d.wings)) : null,
      // A FISH STANDS ON NOTHING, which is not a leg length of zero.
      // The same builder gives a whole slaughterfish and a lamia's tail
      // — see pieces/fishBody.js and its `from`.
      fish: d.fish ? packPiece(buildFishBody(pelt, d.fish)) : null,
      // The scorpion's claws, built for a body with no spine and working
      // just as well on a dreugh that has one.
      claws: d.claws ? packPiece(buildArachnid(pelt, d.claws)) : null,
      // A gargoyle borrows the daedra lord's horns, and a spriggan's
      // canopy is a drape: the last five designs in the game add no
      // geometry at all.
      horns: d.horns ? packPiece(buildHorns(pelt, d.horns)) : null,
      drape: withFit(drape, bf),
      // A werebeast keeps a tail, which the human rig has no concept of.
      beastTail: d.tail ? packPiece(buildBeastTail(pelt, d.tail)) : null,
      ...villagerDelta(faces, bf),
    };
  });

  // ── THE DAEDRA ─────────────────────────────────────────────────
  // Five enemies, and the only new geometry between them is a pair of
  // horns. A Daedroth is the werewolf's design exactly — collapse the
  // skull, put a beast head on it; a Fire Daedra is the fire atronach's
  // additive blend; a Frost Daedra is the ice atronach's transparency at
  // a different density.
  //
  // Which is what a mechanism is for after enough of it exists: the
  // twentieth enemy cost a file and the forty-sixth costs a line.
  const daedraPacks = DAEDRA_DESIGNS.map((d) => {
    const { ramps: dramps, opts, hide, drape } = daedraOpts(d, pal);
    let df = buildNeutralBody(dramps, { face, ...opts });
    if (d.collapse) df = collapseGroups(df, d.collapse, [0, 1.5, 0]);
    return {
      id: d.id, name: d.name, level: d.level, damage: d.damage, weaponTier: d.weaponTier,
      build: d.build, zones: d.zones, hide, drape: withFit(drape, df), spectral: d.spectral || null,
      beastHead: d.beastHead ? packPiece(buildBeastHead(hide, d.beastHead)) : null,
      beastTail: d.tail ? packPiece(buildBeastTail(hide, d.tail)) : null,
      horns: d.horns ? packPiece(buildHorns(hide, d.horns)) : null,
      ...villagerDelta(faces, df),
    };
  });

  // Per-race hairstyle packs (haired races get multiple styles).
  const HAIRSTYLES = { Human: ['short','buzz','medium','long','ponytail','topknot','mohawk','bald'], Elf: ['short','medium','long','ponytail','mohawk','bald'] };
  const hairPacks = {};
  for (const [race, styles] of Object.entries(HAIRSTYLES)) { hairPacks[race] = {}; for (const st of styles) hairPacks[race][st] = packPiece(buildHair(HAIR_RAMPS.brown, race, ramps.skin, st)); }
  hairPacks.Khajiit = { default: packPiece(buildHair(KHAJIIT_FUR, 'Khajiit', KHAJIIT_FUR)) };
  hairPacks.Argonian = { default: packPiece(buildHair(HAIR_RAMPS.brown, 'Argonian', ramps.skin)) };
  // Per-race body colours: same geometry, re-shaded with the race hide/fur.
  const colorsOf = (fs) => { const c=[]; for (const f of fs) c.push(f.c[0], f.c[1], f.c[2]); return c; };
  const Ck = colorsOf(buildNeutralBody({ skin: KHAJIIT_FUR, boot: ramps.boot }, { face }));
  const Ca = colorsOf(buildNeutralBody({ skin: ARGONIAN_HIDE, boot: ramps.boot }, { face }));
  const CLOTH_D = [[58,48,38],[86,72,54],[118,100,74],[150,128,96],[180,158,122],[206,186,150]];
  const drapeGridsOut = {}, drapedPacks = {};
  for (const nm of DRAPED_NAMES) { const g = drapedGrid(nm);
    if (g) drapeGridsOut[nm] = { rows: g.rows, cols: g.cols, wrap: g.wrap, pos: Array.from(g.pos), faces: g.faces };
    else drapedPacks[nm] = packPiece(drapedPiece(nm, CLOTH_D)); }
  const payload = ({ n: faces.length, Ck, Ca, Ib, PALETTES, draped: drapedPacks, drapeGrids: drapeGridsOut, drapeMaterials: DRAPE_MATERIAL, bodyCore: BODY_CORE, poses: POSES, wristY: WRIST_JUNCTION_Y * 0.9, armX: ARM_X, neckY: NECK_PIVOT_Y * 0.9, attacks: ATTACKS_1H, attacks2H: ATTACKS_2H, attacksRanged: ATTACKS_RANGED, attacksFP: ATTACKS_FP, reactions: REACTIONS, strikes: STRIKES, dirToStrike: DIRECTION_TO_STRIKE,
    // WEAPON REGISTRY: [{name, hands, pack, items}] - the viewer's
    // weapon list is data. Steel display mesh; per-material items.
    arrow: packPiece(buildNockedArrow(weaponMaterialRamp(WEAPON_MATERIALS.Steel, (i) => pal.get(i)))),
    weaponPacks: (() => {
      const steel = weaponMaterialRamp(WEAPON_MATERIALS.Steel, (i) => pal.get(i));
      const items = (id) => Object.fromEntries(Object.entries(WEAPON_MATERIALS).filter(([, v]) => v >= 0).map(([n, v]) => [n, buildWeapon(id, v)]));
      const list = [
        { name: 'Longsword', hands: '1h', pack: packPiece(buildSword(steel)), items: items(WEAPONS.Longsword) },
        { name: 'Claymore', hands: '2h', pack: packPiece(buildClaymore(steel)), items: items(WEAPONS.Claymore) },
        { name: 'Long Bow', hands: 'bow', pack: packPiece(buildLongBow(steel)), items: items(WEAPONS.Long_Bow) },
        { name: 'Short Bow', hands: 'bow', pack: packPiece(buildShortBow(steel)), items: items(WEAPONS.Short_Bow) },
      ];
      for (const nm of Object.keys(BLADE_SPECS)) {
        list.push({ name: nm.replace('_', '-'), hands: BLADE_SPECS[nm].twoHand ? '2h' : '1h', pack: packPiece(buildBladeWeapon(steel, nm)), items: items(WEAPONS[nm]) });
      }
      for (const nm of Object.keys(HAFTED_SPECS)) {
        list.push({ name: nm.replace('_', ' '), hands: HAFTED_SPECS[nm].twoHand ? '2h' : '1h', pack: packPiece(buildHaftedWeapon(steel, nm)), items: items(WEAPONS[nm]) });
      }
      return list;
    })(),
    swordRamps: Object.fromEntries(Object.entries(WEAPON_MATERIALS).filter(([, v]) => v >= 0).map(([n, v]) => [n, weaponMaterialRamp(v, (i) => pal.get(i))])),
    swordItems: Object.fromEntries(Object.entries(WEAPON_MATERIALS).filter(([, v]) => v >= 0).map(([n, v]) => [n, buildWeapon(WEAPONS.Longsword, v)])), cloth: CLOTH_D, drapedNames: DRAPED_NAMES, villagers: villagerPacks, orcs: orcPacks, undead: undeadPacks, classes: classPacks, atronachs: atronachPacks, beasts: beastPacks, daedra: daedraPacks, hairRamps: HAIR_RAMPS, cy:(minY+maxY)/2, h:maxY-minY, P, N, C, G, pauldrons: packPiece(buildPauldrons(STEEL_RAMP)), helm: packPiece(buildHelm(STEEL_RAMP)), hair: hairPacks, tail: packPiece(buildTail(ramps.skin,'argonian')), tailCat: packPiece(buildTail(KHAJIIT_FUR,'khajiit')), bodyScales: packPiece(buildBodyScales(faces, ramps.skin)), bodyFurCoat: packPiece(buildBodyFur(faces, KHAJIIT_FUR, KHAJIIT_BELLY, 'coat')), bodyFurBelly: packPiece(buildBodyFur(faces, KHAJIIT_FUR, KHAJIIT_BELLY, 'belly')) });

  return payload;
}
