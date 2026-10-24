// @ts-check
// ═══════════════════════════════════════════════════════════════════
// JUNGLE-ROADSIDE (bible/03-World/Bantha-Jungle.md, The roadside pairs): A PIXEL'S ROADSIDE PAIRS STOOD - a module the
// pixel's build wires (scenes/pixelBuild.js; HOST-SPLIT, bible/01-Overview/Host-Split.md). The layout stood the pairs
// beside the flats (world/terrain/jungleNature.js jungleLayout, world/jungle/jungleRoadside.js standPairs); here a pair
// stands whole or not at all (keptPairs), and never as Logging's - whatever the jungle's door did, so every peer's trees
// are the same (AUDIT JUNGLE-ROADSIDE GAME-2: a peer whose door had not loaded felled them). Each of its trees:
//   - NEAR THE EYE is its HALF of the owner's file - the tree as they drew it and the lianas on its side - one instance
//     of that half's near-only prototype in the jungle door's near set, at the tree's own root, turned across its road
//     and at the pair's scale (world/lowPolyTrees.js buildTreeSet `turn`, `own`): it hands over where its far picture
//     does (AUDIT JUNGLE-ROADSIDE GAME-1);
//   - FAR OFF AND AS A THING is its species' own: it joins the species' group (`J<species>`), so its far picture is the
//     species' batch's - which gives way to the halves as to the species' trees (`lptProto` the handles of both: AUDIT
//     JUNGLE-ROADSIDE PERF-1, a batch of 2 to 10 pictures a pair's tree each) - and its trunk's body and cover are the
//     species' measures; but the species' near set leaves it to its half.
// A pair whose halves or trees' far pictures cannot all stand stands its two trees as the canopy stands its own (but
// never Logging's).
// ═══════════════════════════════════════════════════════════════════
import { pairPicture } from '../world/naturePicture.js';   // THE ONE CONSTRUCTION SEAM: the one file that asks a door for a picture

/**
 * The pairs that stand: a pair whose trees both `keep(x, z)` - the build would stand a flat at each - or none of it (a
 * felled or a lone tree would leave lianas strung to nothing).
 * @param {any[]} pairs the kernel's `roadside` @param {(x: number, z: number) => boolean} keep
 */
export const keptPairs = (pairs, keep) => pairs.filter((p) => p.trees.every((t) => keep(t.x, t.z)));

/**
 * The pairs stood by the jungle's door, loaded.
 * @param {{ door: any, pairs: any[], speciesPic: (species: number) => Promise<any>, groups: Map<string, any>,
 *   handles: any[], set: any[], sway: (proto: any, record: number) => void }} deps
 *   `door` the jungle's (systems/jungleTreesAssets.js - asked through world/naturePicture.js pairPicture, and acquire);
 *   `pairs` keptPairs'; `speciesPic(species)` the build's own far picture of a species (junglePicture's, asked once a
 *   pixel - null where it would not stand); `groups` the build's jungle groups (each pair tree joins its species', with
 *   `spanned` - the centres its half draws near - and `spans` - those halves' handles); `handles` and `set` the pixel's
 *   jungle handles and near set (each half's added, its handle held as the species' are); `sway(proto, record)` the
 *   build's wind maps written for a half's prototype by its tree's record.
 * Answers how many pairs stood as the owner drew them.
 */
export async function standRoadside({ door, pairs, speciesPic, groups, handles, set, sway }) {
  const halves = new Map();   // `${kind}.${side}` -> its picture (with its handle's index and near set entry once held), or null
  const half = async (kind, side) => {
    const key = `${kind}.${side}`;
    if (!halves.has(key)) halves.set(key, await pairPicture(door, kind, side));
    return halves.get(key);
  };
  let drawn = 0;
  for (const p of pairs) {
    const pics = [];
    for (const [side, t] of p.trees.entries()) pics.push((await speciesPic(t.species)) ? await half(p.kind, side) : null);
    const whole = pics.every(Boolean);   // both halves, and both trees' far pictures to hand over to
    if (whole) drawn++;
    p.trees.forEach((t, side) => {
      const gk = `J${t.species}`, c = [t.x, t.y, t.z];
      let g = groups.get(gk);
      if (!g) groups.set(gk, (g = { species: t.species, young: false, centers: [], own: [] }));
      g.centers.push(c); g.own.push(p.js);
      if (!whole) return;
      const pic = pics[side];
      if (pic.h == null) {   // held until the pixel goes - once a half
        door.acquire(pic.far);
        handles.push(pic.far);
        pic.h = handles.length - 1;
        pic.entry = { h: pic.h, centers: [], wild: null, own: [], fit: null, turn: [] };
        set.push(pic.entry);
        sway(pic.proto, t.record);
      }
      pic.entry.centers.push([t.x, p.y, t.z]); pic.entry.own.push(p.js); pic.entry.turn.push(p.turn);
      (g.spanned ??= new Set()).add(c);
      (g.spans ??= new Set()).add(pic.far);
    });
  }
  for (const pic of halves.values()) if (pic?.entry) { pic.entry.own = Float32Array.from(pic.entry.own); pic.entry.turn = Float32Array.from(pic.entry.turn); }
  return drawn;
}
