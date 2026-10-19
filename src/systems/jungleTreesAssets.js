// @ts-check
// BANTHA1 (bible/03-World/Bantha-Jungle.md): THE JUNGLE'S TREES IN THE GAME - the owner's five trees through Low Poly
// Trees' own door (systems/lowPolyTreesAssets.js createLowPolyTrees), so a jungle tree is held, drawn near as its 3D
// tree and far as its own far picture, swayed, felled and given back exactly as a low-poly tree is - one door's code,
// never a second (THE ONE CONSTRUCTION SEAM). What is the jungle's own:
//   - ITS DATA: the owner's OBJs, MTLs and pictures (src/assets/jungle/source/, ~0.24 MB), fetched the first time a
//     pixel stands a jungle tree and read by world/jungle/jungleModels.js readJungleTrees - none of the player's
//     ARENA2 is read: the pictures are the owner's, decoded, never painted from a record;
//   - ITS SLOT: the renderer's tree slot 1 (render/renderer.js setLowPolyTrees), Low Poly Trees' beside it on 0;
//   - ITS SIZES: a tree is drawn up to JUNGLE_SCALE_MAX of the owner's (the emergents - world/terrain/jungleNature.js
//     JUNGLE.emergentScale), so its far pictures' batch is sized for that.
// No season re-skins it (Seasons of the Iliac Bay leaves the rainforest's archive alone, and so does the jungle).
import { createLowPolyTrees } from './lowPolyTreesAssets.js';
import { decodePng } from './textureReplacement.js';
import { readJungleTrees, JUNGLE_SPECIES, JUNGLE_ARCHIVE, jungleRecord } from '../world/jungle/jungleModels.js';
import { JUNGLE } from '../world/terrain/jungleNature.js';

/** The largest a jungle tree is drawn, a share of the owner's (the emergents' top). */
export const JUNGLE_SCALE_MAX = JUNGLE.emergentScale[1];
/** AUDIT BANTHA1 TREE-2: a jungle tree reads its sun this far up its own height - its crown, near and far - never at its
 *  root, which a closed canopy shades for every tree in it. */
export const JUNGLE_SUN_LIFT = 0.6;

/** The owner's files, by name - each species' OBJ and MTL, and the pictures its MTL names (src/assets/jungle/source/). */
export const JUNGLE_URLS = Object.freeze({
  'jungle_tree.obj': new URL('../assets/jungle/source/jungle_tree.obj', import.meta.url).href,
  'jungle_tree.mtl': new URL('../assets/jungle/source/jungle_tree.mtl', import.meta.url).href,
  'jungle_tree_252w.png': new URL('../assets/jungle/source/jungle_tree_252w.png', import.meta.url).href,
  'jungle_tree2.obj': new URL('../assets/jungle/source/jungle_tree2.obj', import.meta.url).href,
  'jungle_tree2.mtl': new URL('../assets/jungle/source/jungle_tree2.mtl', import.meta.url).href,
  'jungle_tree2_252w.png': new URL('../assets/jungle/source/jungle_tree2_252w.png', import.meta.url).href,
  'jungle_tree3.obj': new URL('../assets/jungle/source/jungle_tree3.obj', import.meta.url).href,
  'jungle_tree3.mtl': new URL('../assets/jungle/source/jungle_tree3.mtl', import.meta.url).href,
  'jungle_tree3_252w.png': new URL('../assets/jungle/source/jungle_tree3_252w.png', import.meta.url).href,
  'jungle_tree4.obj': new URL('../assets/jungle/source/jungle_tree4.obj', import.meta.url).href,
  'jungle_tree4.mtl': new URL('../assets/jungle/source/jungle_tree4.mtl', import.meta.url).href,
  'jungle_tree4_252w.png': new URL('../assets/jungle/source/jungle_tree4_252w.png', import.meta.url).href,
  'jungle_tree5.obj': new URL('../assets/jungle/source/jungle_tree5.obj', import.meta.url).href,
  'jungle_tree5.mtl': new URL('../assets/jungle/source/jungle_tree5.mtl', import.meta.url).href,
  'jungle_tree5_252w.png': new URL('../assets/jungle/source/jungle_tree5_252w.png', import.meta.url).href,
});

const defaultFetch = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
};

/** A picture's bytes decoded top-down, its alpha cut to 0 or 255 as a flat's (the owner's pictures are cut already -
 *  every texel 0 or 255, but for a stray 1). */
async function cutPicture(bytes, decode) {
  const pic = await decode(bytes);
  const data = new Uint8Array(pic.data);
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 128 ? 255 : 0;
  return { width: pic.width, height: pic.height, data };
}

/**
 * THE JUNGLE'S DOOR: Low Poly Trees' door over the owner's trees. `proto(species)` the prototype a species stands as
 * (JUNGLE_SPECIES's index), and the door's own `load`, `farPicture`, `acquire`, `release`, `frame` and `destroy`.
 * @param {{ renderer: any, breathe?: () => Promise<void>, fetchBytes?: (url: string) => Promise<Uint8Array>,
 *   decode?: (bytes: Uint8Array) => Promise<{width:number,height:number,data:Uint8Array}>, warn?: (m: string) => void, now?: () => number }} deps
 */
export function createJungleTrees({ renderer, breathe, fetchBytes = defaultFetch, decode = decodePng, warn, now }) {
  /** the owner's pictures' bytes, by name - kept for the session (0.18 MB), decoded again whenever the door lets a picture go */
  const pictures = new Map();
  let trees = null;
  const text = (bytes) => new TextDecoder().decode(bytes);
  const fetchFile = (name) => {
    const url = JUNGLE_URLS[name];
    if (!url) throw new Error(`the jungle names a file it does not carry: ${name}`);
    return fetchBytes(url);
  };
  const door = createLowPolyTrees({
    renderer, breathe, warn, now, slot: 1, scaleMax: JUNGLE_SCALE_MAX, label: 'bantha-jungle', sunLift: JUNGLE_SUN_LIFT,
    treeSet: {
      async load() {
        const sources = await Promise.all(JUNGLE_SPECIES.map(async (s) => {
          const [obj, mtl] = await Promise.all([fetchFile(`${s.file}.obj`), fetchFile(`${s.file}.mtl`)]);
          return { obj: text(obj), mtl: text(mtl) };
        }));
        trees = readJungleTrees(sources);
        await Promise.all(trees.pictures.map(async (name) => { pictures.set(name, await fetchFile(name)); }));
        return trees;
      },
      async picture(atlas) {
        const name = trees?.atlases[atlas]?.picture;
        const bytes = name ? pictures.get(name) : null;
        return bytes ? cutPicture(bytes, decode) : null;
      },
    },
  });
  // the door itself, its getters live (a prototype, not a copy), and `proto` asked by species
  const api = Object.create(door);
  /** The prototype a species stands as, or null (the door not loaded). */
  api.proto = (species) => door.proto(JUNGLE_ARCHIVE, jungleRecord(JUNGLE_SPECIES[species]));
  return api;
}
