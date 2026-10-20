// @ts-check
// PORTRAIT3D (2026-10-15, the owner: "can we do the other races with 3d portraits also?", then "#2 is exactly I wanted.
// Which also affects the talk window for npcs"): WHO WEARS A MORROWIND HEAD AS THEIR FACE, AND THE PICTURE OF IT.
//
// combat/fpArm.js headPortrait takes the picture; this is the doors' side of it - who is asked, by which gate:
//   THE PLAYER (and anyone shaped like one: a save's identity, the chargen grid's ten portraits) - whenever Morrowind's
//     data is attached, the same switch the player's own body stands on (MWA4: the data, in either skin).
//   AN NPC - by its look (characters/peopleBodies.js personLook, folkBodies.js folkLook, rosterBodies.js
//     residentLook): wherever the people around you stand in Morrowind bodies (npcBodies.js npcBodiesOn - the
//     enhanced skin, the data, Morrowind People not Off), so the face in the talk window is the head on the body that
//     stood there. The look is read through peerBuildOpts, the door every body's build takes - the same race, sex,
//     face, walk and vampire's head. A creature's look and a wolf's have no face here.
//   A FACE OF THE RECORD (poseHeadImage: the party's plate, the family's and the succession's cards) - a member's, a
//     player's, as the player's; a townsperson wed in, the head they walked the street with.
// Every caller keeps its classic portrait until a picture lands, or for good when none does (no data, a race with no
// head, a mesh not in hand).
import { portraitRenderer } from '../render/portraitRenderer.js';
import { EQUIP_SLOTS, equipTableOf } from '../systems/equip.js';
import { getPref } from '../systems/uiPrefs.js';

/** The shape a door that draws a head at its record's own size draws it at (the party's plate, the family's and the
 *  succession's cards, the escorts' column): the widest of FACE##I0.CIF's heads is 31 x 32 (ui/partyPanel.js
 *  FACE_BOX_W, the plate measured round it) - the picture taken `scale` times over, so it is drawn smooth, not stretched. */
export const HEAD_RECORD = Object.freeze({ w: 32, h: 34, scale: 3 });

/** The data store, behind a door: read only once it has loaded (a static import pulls it in ahead of the module graph's
 *  own order, and a host's - its network door is bound at its load). */
let _data = null;
/** The tests' window: a store to read the data's stamp off (null - the real one, behind its door again). */
export function _setHeadDataForTests(ds) { _data = ds; }
/** The data's generation while Morrowind's data is attached, else 0 - read at once, for a face's key (0 until the store
 *  has loaded: the key moves when it has). */
export function headDataStamp() {
  if (!_data) {
    import('../scenes/dataSource.js').then((m) => { _data = m; }).catch(() => {});
    return 0;
  }
  return _data.morrowindDataCount() > 0 ? _data.morrowindDataGeneration() : 0;
}
/** A live character's Morrowind head, as a key: the data and the helm worn (its item, and the steel helm's style,
 *  MW-STEEL1) - '0' with no data. The curse's state is the caller's (its override art, which changes with it).
 *  @param {any} entity */
export function playerHeadKey(entity) {
  const stamp = headDataStamp();
  if (!stamp) return '0';
  const helm = entity?.equip ? equipTableOf(entity)?.[EQUIP_SLOTS.Head] ?? null : null;
  return `${stamp}|${helm ? `${helm.templateIndex}/${helm.material ?? 0}/${getPref('mwSteelHelm')}` : '-'}`;
}

/** The data gate the player's face reads - the same count the player's body stands on. */
async function dataAttached() {
  const { morrowindDataCount } = _data ?? await import('../scenes/dataSource.js');
  return morrowindDataCount() > 0;
}

/** The player's face (or a save's, a portrait's) as a Morrowind head: `{ width, height, data }` or null, `px` x `ph`.
 *  A LIVE character (one with its equipment - the player's entity) is drawn as its body is built (combat/weapon/weaponRig.js
 *  armBuildOptsOf, the build's own door): its helm and hood, the vampire's head, the transformed werewolf's in its skin;
 *  the transformed wereboar keeps Daggerfall's picture, as its body does (Morrowind has no wereboar). An identity alone (a
 *  save's envelope, a chargen portrait) is its bare face. A player's face wears the port's own heads where the race has
 *  them, as the player's body does (MW-HEADS2); `npc` - a portrait's face that is an NPC's (an escort) - the data's.
 *  @param {{ race?: string, gender?: string, faceIndex?: number, equip?: any, npc?: boolean }} who  Daggerfall's race key ('DarkElf'), 'female'/'male'
 *  @param {{ px?: number, ph?: number, renderer?: any }} [opts] */
export async function playerHeadImage(who, { px = 128, ph = px, renderer = portraitRenderer() } = {}) {
  if (!who || !renderer || !(await dataAttached())) return null;
  const [{ headPortrait }, { mwRaceId }] = await Promise.all([import('../combat/fpArm.js'), import('../formats/morrowind/mwNpc.js')]);
  if (who.equip) {
    const [{ armBuildOptsOf }, { liveLycanthropy }] = await Promise.all([import('../combat/weapon/weaponRig.js'), import('../systems/lycanthropy.js')]);
    if (liveLycanthropy(who)?.isTransformed && !armBuildOptsOf(who).werewolf) return null;   // the wereboar: no Morrowind boar
    const o = armBuildOptsOf(who);
    return headPortrait({ renderer, race: o.race, female: o.female, faceIndex: o.faceIndex, armor: o.armor, vampire: o.vampire, werewolf: o.werewolf, skin: o.skin, ownHeads: o.ownHeads, px, ph });
  }
  return headPortrait({
    renderer, race: mwRaceId(who.race ?? 'Breton'), female: who.gender === 'female',
    faceIndex: Number.isInteger(who.faceIndex) ? who.faceIndex : 0, ownHeads: !who.npc, px, ph,
  });
}

/** An NPC's face as the Morrowind head its body wears: `{ width, height, data }` or null, `px` x `ph`.
 *  @param {any} look  the look its body is built from
 *  @param {{ px?: number, ph?: number, renderer?: any }} [opts] */
export async function npcHeadImage(look, { px = 128, ph = px, renderer = portraitRenderer() } = {}) {
  if (!look || look.creature || !renderer) return null;
  const { npcBodiesOn } = await import('./npcBodies.js');
  if (!npcBodiesOn()) return null;
  const [{ headPortrait }, { peerBuildOpts }] = await Promise.all([import('../combat/fpArm.js'), import('../net/peer/peerBodies.js')]);
  const o = /** @type {any} */ (peerBuildOpts(look));
  if (!o || o.creature || o.werewolf || !o.race) return null;
  return headPortrait({ renderer, race: o.race, female: !!o.female, faceIndex: o.faceIndex | 0, npcFace: o.npcFace ?? null, vampire: !!o.vampire, armor: o.armor ?? null, px, ph });   // its helm and hood too
}

/** A face of the record (systems/legacy/facePose.js facePose - a member, a player's character; ui/partyPanel.js a
 *  seat's pose) as a Morrowind head: the race's head at the face, as the player's (a member of the line not played -
 *  `kin` - as one of the people: the data's heads, MW-HEADS2); a townsperson wed in (`common`, their
 *  census face) the head their body walks the street with - walked off their census id (`resident`) as their body's is
 *  (rosterBodies.js residentLook: the id's seed), behind the people's gate. `{ width, height, data }` or null.
 *  @param {{ race?: string, gender?: string, face?: number, common?: number, resident?: string, kin?: boolean }} pose
 *  @param {{ px?: number, ph?: number, renderer?: any }} [opts] */
export async function poseHeadImage(pose, opts = {}) {
  if (!pose) return null;
  if (Number.isInteger(pose.common) && /** @type {number} */ (pose.common) >= 0) {
    if (!pose.resident) return null;
    const [{ npcHint }, { textSeed }] = await Promise.all([import('./wardrobe.js'), import('../systems/livingWorld/seed.js')]);
    return npcHeadImage(residentHeadLook(pose, npcHint, textSeed), opts);
  }
  return playerHeadImage({ race: pose.race, gender: pose.gender, faceIndex: pose.face, npc: !!pose.kin }, opts);
}
/** A townsperson wed in, as a look that wears their street body's head and hair and nothing else: their race and sex,
 *  and the hint their head is walked off - their census id's seed (rosterBodies.js residentLook's).
 *  @param {{ race?: string, gender?: string, resident?: string }} pose @param {(seed: number, tier: number) => any} npcHint
 *  @param {(s: string) => number} textSeed */
export const residentHeadLook = (pose, npcHint, textSeed) => ({
  race: pose.race ?? 'Breton', gender: pose.gender === 'female' ? 'female' : 'male', faceIndex: 0, items: [],
  npc: npcHint(textSeed(String(pose.resident)), 0),
});

/** A picture as a canvas `w` x `h` (the classic portrait's own size, so no well stretches it), the head fitted and
 *  centred in it; a square of the picture's own size when no size is given. Null without a document.
 *  @param {{ width: number, height: number, data: Uint8Array|Uint8ClampedArray }} img
 *  @param {{ w?: number, h?: number, doc?: Document }} [opts] */
export function headCanvas(img, { w = 0, h = 0, doc = globalThis.document } = {}) {
  if (!img || !doc) return null;
  const src = doc.createElement('canvas');
  src.width = img.width; src.height = img.height;
  const sctx = src.getContext('2d');
  if (!sctx) return null;
  const rgba = new Uint8ClampedArray(img.width * img.height * 4);
  rgba.set(img.data);
  sctx.putImageData(new ImageData(rgba, img.width, img.height), 0, 0);
  if (!(w > 0 && h > 0)) return src;
  const out = doc.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) return src;
  const s = Math.min(w / img.width, h / img.height);
  const dw = Math.round(img.width * s), dh = Math.round(img.height * s);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
  return out;
}
