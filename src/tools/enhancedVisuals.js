// ═══════════════════════════════════════════════════════════════════
// THE VISUALS: A VOXEL FIGURE AND CLASSIC SPRITES
//
// The first prototype drew an abstract slot map — twenty-eight nodes on
// a schematic — because it was clever and because it worked with no
// assets at all. It was a diagram standing in for an asset the project
// already has.
//
// So: the voxel paperdoll IS the figure now, and item rows carry the
// game's own inventory sprites. Both come from work that already exists
// rather than from anything invented here:
//
//   - characters/paperdollPayload.js builds the body, and it takes null
//     for the palette, so a figure renders with NO ARENA2 at all — the
//     rig is ours, only the authentic colours are Bethesda's.
//
//   - systems/itemTemplates.js already carries all 288 templates with
//     their texture archive and record, and exports inventoryItemImage.
//     Classic sprites were never a problem to solve, only a door to
//     open.
//
// ── WHAT THE SLOT MAP DID THAT A FIGURE CANNOT ───────────────────
//
// A figure tells you how you look. It does not tell you that your
// SECOND amulet slot is empty, and with twenty-eight of them that is a
// real question the screen has to answer. So the slot readout stays,
// demoted from the hero to a strip beside the figure: the figure is the
// picture, the strip is the inventory of what is on it.
//
// ── DEGRADING HONESTLY ───────────────────────────────────────────
//
// Without the user's ARENA2 the sprites cannot exist and the figure
// still can. So the figure never asks for anything, and an item without
// its sprite shows a typographic tile rather than a broken image or an
// apology. The screen says what it has; it does not pretend, and it does
// not nag.

import { ITEM_TEMPLATES } from '../systems/itemTemplates.js';
import { buildNeutralBody, NECK_PIVOT_Y } from '../characters/neutralBody.js';

/** Our own palette, the same one paperdollPayload falls back to. */
const BLOCKS = [
  [200, 200, 200], [186, 176, 160], [178, 132, 84], [214, 158, 170],
  [206, 176, 128], [150, 148, 172], [120, 160, 214], [236, 236, 232],
  [140, 200, 200], [206, 194, 96], [150, 196, 120], [176, 108, 66],
  [190, 202, 110], [170, 150, 200], [236, 206, 140], [222, 108, 66],
];
const OUR_PAL = {
  get(i) {
    const idx = Math.max(0, Math.min(255, i | 0));
    const [r, g, b] = BLOCKS[(idx >> 4) & 15];
    const k = 1 - (idx & 15) / 15;
    const f = 0.24 + k * 0.86;
    return { r: Math.min(255, Math.round(r * f)), g: Math.min(255, Math.round(g * f)), b: Math.min(255, Math.round(b * f)) };
  },
};

/** Rebuild the body with equipment zones on it, packed like the payload. */
function buildDressed(zones, matSpans) {
  const ramp = ([a, b]) => {
    const out = [];
    for (let i = b; i >= a; i--) {
      const c = OUR_PAL.get(i);
      out.push([c.r, c.g, c.b]);
    }
    return out;
  };
  const mats = {};
  for (const [k, span] of Object.entries(matSpans)) mats[k] = ramp(span);
  const faces = buildNeutralBody(
    { skin: ramp([64, 76]), boot: ramp([70, 79]) },
    { build: {}, clothZones: zones, armorZones: [], mats },
  );
  const P = [];
  const C = [];
  for (const f of faces) {
    for (let i = 0; i < 4; i++) {
      P.push(Math.round(f.p[i * 3] * 1000), Math.round(f.p[i * 3 + 1] * 1000), Math.round(f.p[i * 3 + 2] * 1000));
    }
    C.push(f.c[0], f.c[1], f.c[2]);
  }
  return { P, C, n: faces.length };
}

/* global THREE */

// The engine's own constant, imported rather than copied: the day
// CHAR_PIXEL moves, this moves with it. It has moved once already —
// 9 to 7 in 2026, then 7 to 12.
import { CHAR_PIXEL } from '../render/renderer.js';

/** Real item templates, by name, so the prototype's bag is the game's. */
const BY_NAME = new Map(ITEM_TEMPLATES.map((t) => [t.name.toLowerCase(), t]));

export function templateFor(item) {
  // A design may name its own template outright — which is better than
  // guessing from a display name, and the reason every row in the bag
  // carries a `base`.
  if (item && typeof item === 'object' && item.base) {
    const direct = BY_NAME.get(item.base.toLowerCase());
    if (direct) return direct;
  }
  const name = typeof item === 'string' ? item : item.name;
  const n = name.toLowerCase();
  if (BY_NAME.has(n)) return BY_NAME.get(n);
  // "Silver Longsword" -> Longsword; "Steel Greaves" -> Greaves.
  const words = n.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const tail = words.slice(i).join(' ');
    if (BY_NAME.has(tail)) return BY_NAME.get(tail);
  }
  return null;
}

/**
 * THE FIGURE.
 *
 * A small three.js scene with the paperdoll body in it, turning slowly.
 * Deliberately not the weapon bench: no orbit controls, no tuners, no
 * pickers. It is a portrait, and a portrait that invites fiddling stops
 * being one.
 *
 * @param {HTMLElement} mount
 * @param {{onReady?:Function}} opts
 */
export function mountFigure(mount, opts = {}) {
  if (typeof THREE === 'undefined') return null;

  const W = mount.clientWidth || 260;
  const H = mount.clientHeight || 400;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(28, W / H, 0.1, 40);
  // ── CHAR_PIXEL: TWELVE ──────────────────────────────────────────
  // The engine renders its character pass at screen size / CHAR_PIXEL
  // with NEAREST, and the weapon bench's default matches. A portrait of
  // the same figure that renders smooth is a portrait of a different
  // game, so this draws at a TWELFTH and is scaled back up by the
  // browser with pixelated filtering — which is the same operation and
  // costs a hundred and forty-fourth of the fragments.
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(Math.max(1, Math.round(W / CHAR_PIXEL)), Math.max(1, Math.round(H / CHAR_PIXEL)), false);
  renderer.domElement.style.cssText =
    'width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges';
  mount.append(renderer.domElement);

  // ── ONE BODY, NOT THE WHOLE ROSTER ──────────────────────────────
  // This called buildPaperdollPayload, which builds EVERY design in the
  // project — 25 villagers, 4 orcs, 11 undead, 19 classes, 4 atronachs,
  // 18 beasts, 5 daedra — plus every weapon, hairstyle and drape. That
  // is 26.6 SECONDS and 10.6 MB to draw one figure that costs 261 ms on
  // its own. A hundredfold waste, and the load Mac was waiting on.
  //
  // The payload exists so the weapon bench can switch between designs
  // without rebuilding. This screen shows one character. It calls
  // buildNeutralBody directly, which is what buildDressed was already
  // doing two lines further down — I had the cheap path in hand and
  // called the expensive one anyway.
  const worn = opts.equipped || {};
  const zones = [];
  const mats = {};
  const put = (mat, span, z) => {
    mats[mat] = span;
    zones.push({ ...z, mat });
  };
  const B = 'body', AL = 'armL', AR = 'armR', LL = 'legL', LR = 'legR';
  // Only the slots that CHANGE a silhouette: a ring does not alter how a
  // figure reads at portrait size, and pretending otherwise is decoration.
  if (worn.ChestArmor) put('plate', [86, 93], { groups: [B], yLo: 1.1, yHi: 1.58, th: 0.03 });
  else if (worn.ChestClothes) put('cloth', [34, 44], { groups: [B], yLo: 1.12, yHi: 1.56, th: 0.016 });
  if (worn.Gloves) put('leather', [70, 79], { groups: [AL, AR], yLo: 0.6, yHi: 0.86, th: 0.018, arm: true });
  if (worn.RightArm || worn.LeftArm) put('plate', [86, 93], { groups: [AL, AR], yLo: 1.12, yHi: 1.46, th: 0.022, arm: true });
  if (worn.LegsArmor) put('plate', [86, 93], { groups: [LL, LR], yLo: 0.4, yHi: 0.96, th: 0.024, leg: true });
  else if (worn.LegsClothes) put('cloth', [34, 44], { groups: [LL, LR], yLo: 0.44, yHi: 0.96, th: 0.014, leg: true });
  if (worn.Feet) put('leather', [70, 79], { groups: [LL, LR], yLo: 0, yHi: 0.22, th: 0.02, leg: true });
  if (worn.Head) put('plate', [86, 93], { groups: ['head'], yLo: 1.62, yHi: 1.9, th: 0.02 });

  const src = buildDressed(zones, mats);
  const cy = NECK_PIVOT_Y * 0.5;

  const geo = new THREE.BufferGeometry();
  const pos = [];
  const col = [];
  const TRI = [0, 1, 2, 0, 2, 3];
  for (let f = 0; f < src.n; f++) {
    const pb = f * 12;
    const cb = f * 3;
    for (const vi of TRI) {
      pos.push(src.P[pb + vi * 3] / 1000, src.P[pb + vi * 3 + 1] / 1000, src.P[pb + vi * 3 + 2] / 1000);
      col.push(src.C[cb] / 255, src.C[cb + 1] / 255, src.C[cb + 2] / 255);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );

  const pivot = new THREE.Group();
  pivot.add(mesh);
  mesh.position.y = -cy;
  scene.add(pivot);

  cam.position.set(0, 0, 3.15);
  cam.lookAt(0, 0, 0);

  // THREE QUARTERS, NOT DEAD ON. The neutral rig stands with its arms at
  // its sides, and dead on that reads as a post — which cost me an hour
  // once already, mistaking a working figure for a broken one.
  pivot.rotation.y = -0.55;

  let raf = 0;
  let last = performance.now();
  const spin = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (spin) pivot.rotation.y += dt * 0.16;
    renderer.render(scene, cam);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const resize = () => {
    const w = mount.clientWidth || W;
    const h = mount.clientHeight || H;
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    renderer.setSize(Math.max(1, Math.round(w / CHAR_PIXEL)), Math.max(1, Math.round(h / CHAR_PIXEL)), false);
  };
  window.addEventListener('resize', resize);

  if (opts.onReady) opts.onReady({ faces: src.n });

  return {
    faces: src.n,
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      geo.dispose();
    },
  };
}

/**
 * A CLASSIC SPRITE, OR AN HONEST SUBSTITUTE.
 *
 * The templates carry the archive and record; the bytes come from the
 * user's own ARENA2 through the same door the game uses. Without it
 * there is no sprite, and the tile says what the item is rather than
 * showing a broken image or an apology.
 */
export function itemTile(item) {
  const t = templateFor(item);
  const tile = document.createElement('div');
  tile.className = 'tile';
  // Initials from the item's real name: two letters, which is enough to
  // tell a Longsword from a Lockpick in a list you are scanning.
  const initials = item.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  tile.textContent = initials;
  if (t) {
    const archive = t.playerTextureArchive ?? t.worldTextureArchive;
    const record = t.playerTextureRecord ?? t.worldTextureRecord;
    tile.title = `${t.name} — TEXTURE.${archive} record ${record}`;
    tile.dataset.archive = String(archive);
    tile.dataset.record = String(record);
    tile.classList.add('known');
  } else {
    tile.title = `${item.name} — no template match`;
  }
  return tile;
}
