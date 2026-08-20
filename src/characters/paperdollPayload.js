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

/** A stand-in for ART_PAL: a smooth grey ramp with a warm cast. */
function ourPalette() {
  return {
    get(i) {
      const v = Math.max(0, Math.min(255, i));
      return { r: v, g: Math.round(v * 0.97), b: Math.round(v * 0.9) };
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
      hair: d.hair, tone: RACE_TONE[d.race], drape: designDrape(d, pal), ...villagerDelta(faces, vf),
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
    swordItems: Object.fromEntries(Object.entries(WEAPON_MATERIALS).filter(([, v]) => v >= 0).map(([n, v]) => [n, buildWeapon(WEAPONS.Longsword, v)])), cloth: CLOTH_D, drapedNames: DRAPED_NAMES, villagers: villagerPacks, orcs: orcPacks, hairRamps: HAIR_RAMPS, cy:(minY+maxY)/2, h:maxY-minY, P, N, C, G, pauldrons: packPiece(buildPauldrons(STEEL_RAMP)), helm: packPiece(buildHelm(STEEL_RAMP)), hair: hairPacks, tail: packPiece(buildTail(ramps.skin,'argonian')), tailCat: packPiece(buildTail(KHAJIIT_FUR,'khajiit')), bodyScales: packPiece(buildBodyScales(faces, ramps.skin)), bodyFurCoat: packPiece(buildBodyFur(faces, KHAJIIT_FUR, KHAJIIT_BELLY, 'coat')), bodyFurBelly: packPiece(buildBodyFur(faces, KHAJIIT_FUR, KHAJIIT_BELLY, 'belly')) });

  return payload;
}
