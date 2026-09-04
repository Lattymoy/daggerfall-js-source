// FE1 - THE HUD ESCORTING NPC FACES (2026-08-28). Port of
// HUDEscortingNPCFaces.cs (EscortingNPCFacePanel, MIT, Daggerfall
// Workshop) - the portrait column quest escorts pin to the top-left
// of the screen. The quest actions (AddFace/DropFace, actions.js) have
// carried machine hooks since Q4 into a world ctx that never mounted
// them; this is the mount.
//
// ONE panel for the whole game, like the damage flash and the spell
// blink clock: DFU has one HUD (DaggerfallHUD.cs:42 constructs one
// EscortingNPCFacePanel), so the state is module-level and drawHud is
// the one host-agnostic call that draws it. The probe hosts carry no
// quest machine, so their faces list is simply empty.
//
// DFU's class header, kept: "Unlike Daggerfall will try to remove
// face when related quest ends, even if quest script forgets to drop
// face" - the OnQuestEnded sweep (machine.js tombstoneQuest raises it,
// QuestMachine.cs:1047's own order).
//
// QUIRK KEPT (DaggerfallHUD.cs:207): `escortingFaces.EnableBorder =
// ShowEscortingFaces` - the visibility SETTING is wired to the
// panel's border flag, not its Enabled, and the panel never sets
// border textures, so the setting does nothing and the faces are
// unconditional. The port draws them unconditionally too.
//
// RECORDED DEPARTURE (async art), which Ledger A carries as ART LANDS
// ASYNC, AND A MISSING RECORD COSTS THE PICTURE RATHER THAN THE
// SESSION (AUDIT 58, seams lane) - by name, because a line number
// rots: DFU loads each face texture
// synchronously inside RefreshFaces and THROWS when one is missing.
// The port is data-gated like the rest of the HUD - textures load
// async, a face draws from the frame its art lands, and a missing
// record costs that face (warned once), never the session.

import { CifRciFile } from '../formats/cifRciFile.js';
import { GENDERS } from '../characters/nameHelper.js';
import { RACES, raceArt } from '../systems/races.js';
import { bitmapToColor32 } from './hud.js';
import { nativeMetrics } from './nativePanel.js';
// FactionFile.FactionIDs.Children (514) - the one faction whose
// Persons portrait as children; ONE home, characters/staticNpc.js.
import { CHILDREN_FACTION_ID } from '../characters/staticNpc.js';

// EscortingNPCFacePanel's own constants (HUDEscortingNPCFaces.cs:31-35)
export const ESCORT_FACE_COUNT = 10;              // faceCount - the foe portrait roll's range
export const ESCORT_MAX_FACES = 3;                // maxFaces
export const FACTION_FACE_FILE = 'FACES.CIF';     // factionFaceFile
export const FACTION_CHILDREN_FACE_FILE = 'KIDS00I0.CIF';   // factionChildrenFaceFile
export const FACTION_EXTRA_FACE_FILE = 'TFAC00I0.RCI';      // factionExtraFaceFile
// Update()'s layout constants (:60-63)
export const ESCORT_START_X = 8;
export const ESCORT_START_Y = 36;
export const ESCORT_SPACE_Y = 40;
export const ESCORT_SPACE_Y_SPECIAL = 50;
// RefreshFaces' special-panel size (:200-201) - the 64x64 RCI record
// is STRETCHED into a 48x48 panel, DFU's own BackgroundTexture fit.
export const ESCORT_SPECIAL_FACE_SIZE = 48;
export { CHILDREN_FACTION_ID };

/** CreateFaceDetails(Person) (:139-169), verbatim. FaceDetails is the
 *  serializable struct - symbols travel as their ORIGINAL strings so
 *  the array rides the save envelope as plain JSON.
 *
 *  The child-variant pick is a UnityEngine.Random draw (:163-164 -
 *  InitState(Time.frameCount) then Range(0,2)); the ENGINE-PRNG RULE
 *  applies: it rides an injectable uniform roll and the frame-count
 *  seeding is the engine stream's own business. "there are only 2
 *  variants of each gender indexed 0-3": offset 0 or 2, plus the
 *  gender (Male 0 / Female 1). */
export function createFaceDetailsPerson(person, { getFactionData = null, roll = Math.random } = {}) {
  const face = {
    questUID: person.parentQuest.uid,
    targetPerson: person.symbol?.original ?? null,
    targetFoe: null,
    targetRace: person.race,
    gender: person.gender,
    isChild: (person.factionData?.id ?? 0) === CHILDREN_FACTION_ID,
    faceIndex: person.faceIndex,
    factionFaceIndex: -1,
  };
  // Read faction face index for fixed NPCs (:151-158)
  if (person.isIndividualNPC) {
    const fd = getFactionData?.(person.factionData?.id ?? 0);
    if (fd) face.factionFaceIndex = fd.face;
  }
  if (face.isChild) {
    const variantOffset = Math.floor(roll() * 2) === 0 ? 0 : 2;
    face.faceIndex = variantOffset + face.gender;
  }
  return face;
}

/** CreateFaceDetails(Foe) (:171-184), verbatim - "Foe faces should
 *  always be humanoid... Always creates a Breton face for now", and
 *  the portrait is Range(0, faceCount) on the engine stream (the
 *  injectable roll again). */
export function createFaceDetailsFoe(foe, roll = Math.random) {
  return {
    questUID: foe.parentQuest.uid,
    targetPerson: null,
    targetFoe: foe.symbol?.original ?? null,
    targetRace: RACES.Breton,
    gender: foe.gender,
    isChild: false,
    faceIndex: Math.floor(roll() * ESCORT_FACE_COUNT),
    factionFaceIndex: -1,
  };
}

/** RefreshFaces' per-face resolution (:209-262): which file, which
 *  record, and whether the panel is the fixed 48x48 special. Pure.
 *  - factionFaceIndex 0..60   -> FACES.CIF (the fixed-NPC set)
 *  - factionFaceIndex 61..502 -> TFAC00I0.RCI ("set by a mod")
 *  - else child -> KIDS00I0.CIF, adult -> the race template's
 *    PaperDollHeads by gender - and "Only Redguard and Breton
 *    supported for now" (:207): the race switch defaults everything
 *    that is not Redguard to Breton. */
export function resolveFaceImage(face) {
  if (face.factionFaceIndex >= 0 && face.factionFaceIndex <= 60) {
    return { file: FACTION_FACE_FILE, record: face.factionFaceIndex, special: true };
  }
  if (face.factionFaceIndex > 60 && face.factionFaceIndex <= 502) {
    return { file: FACTION_EXTRA_FACE_FILE, record: face.factionFaceIndex, special: true };
  }
  const raceKey = face.targetRace === RACES.Redguard ? 'Redguard' : 'Breton';
  const file = face.isChild
    ? FACTION_CHILDREN_FACE_FILE
    : raceArt(raceKey, face.gender === GENDERS.Male ? 'male' : 'female').heads;
  return { file, record: face.faceIndex, special: false };
}

/** Update()'s alignment law (:56-87), pure: sizes in, placements out.
 *  Faces past maxFaces are disabled where they stand; each face
 *  advances the column by spaceY, or spaceYSpecial when the panel is
 *  taller than spaceY (`if (spaceY < facePanel.Size.y)`). A face whose
 *  art has not landed yet has no height and advances by spaceY. */
export function layoutEscortFaces(sizes) {
  const placed = [];
  let count = 0;
  let y = ESCORT_START_Y;
  for (const size of sizes) {
    if (count++ >= ESCORT_MAX_FACES) { placed.push({ x: 0, y: 0, enabled: false }); continue; }
    placed.push({ x: ESCORT_START_X, y, enabled: true });
    y += ESCORT_SPACE_Y < (size?.h ?? 0) ? ESCORT_SPACE_Y_SPECIAL : ESCORT_SPACE_Y;
  }
  return placed;
}

// ---- the one panel's state ----
let _deps = null;     // { fetchBytes, palette, renderer, getFactionData }
let _faces = [];      // FaceDetails[] - the serializable truth
let _panels = [];     // parallel to _faces: { special, img: {tex,w,h}|null }
const _files = new Map();     // file -> Promise<CifRciFile>
const _textures = new Map();  // `${file}#${record}` -> {tex,w,h}
let _warned = false;

function _loadFile(file) {
  let p = _files.get(file);
  if (!p) {
    p = (async () => {
      const cif = new CifRciFile();
      cif.load(await _deps.fetchBytes(file), file, _deps.palette);
      return cif;
    })();
    _files.set(file, p);
  }
  return p;
}

/** RefreshFaces (:198-273) - rebuild the panel list from the faces
 *  list and make sure every face's texture is loading. */
function refreshFaces() {
  if (!_deps) { _panels = _faces.map(() => null); return; }
  _panels = _faces.map((face) => {
    const { file, record, special } = resolveFaceImage(face);
    const panel = { special, img: _textures.get(`${file}#${record}`) ?? null };
    if (!panel.img) {
      _loadFile(file).then((cif) => {
        const key = `${file}#${record}`;
        if (!_textures.has(key)) {
          const bmp = cif.getDFBitmap(record, 0);
          _textures.set(key, {
            tex: _deps.renderer.uploadTexture('cif', key, bitmapToColor32(bmp, _deps.palette)),
            w: bmp.width, h: bmp.height,
          });
        }
        panel.img = _textures.get(key);
      }).catch((e) => {
        if (!_warned) { _warned = true; console.warn('[escortFaces] face art unavailable:', e?.message ?? e); }
      });
    }
    return panel;
  });
}

/** The port's constructor arm: the world host mounts the data deps
 *  once per session. A fresh session starts with no faces - DFU's
 *  OnNewGame and OnStartLoad handlers both Clear() (:306-316), and a
 *  load's restore refills through restoreEscortFacesSaveData. The
 *  texture caches drop with the old renderer. */
export function initEscortFaces(deps) {
  _deps = deps;
  _faces = [];
  _panels = [];
  _files.clear();
  _textures.clear();
  _warned = false;
}

/** AddFace(Person) / AddFace(Foe) (:97-113) - one door because the
 *  quest actions hand whichever resource the symbol named; the foe
 *  marker dispatches the overload. */
export function addEscortFace(resource, roll = Math.random) {
  _faces.push(resource.isFoe
    ? createFaceDetailsFoe(resource, roll)
    : createFaceDetailsPerson(resource, { getFactionData: _deps?.getFactionData, roll }));
  refreshFaces();
}

/** DropFace(Person) / DropFace(Foe) (:119-133): remove by quest UID
 *  and symbol - the Person overload matches targetPerson, the Foe
 *  overload targetFoe. */
export function dropEscortFace(resource) {
  const uid = resource.parentQuest.uid;
  const sym = resource.symbol?.original ?? null;
  _faces = _faces.filter((face) => !(face.questUID === uid
    && (resource.isFoe ? face.targetFoe === sym : face.targetPerson === sym)));
  refreshFaces();
}

/** ClearFaces (:186-196). */
export function clearEscortFaces() {
  _faces = [];
  _panels = [];
}

/** QuestMachine_OnQuestEnded (:295-304): "Remove any faces belonging
 *  to this quest" - the unlike-Daggerfall sweep. */
export function escortQuestEnded(quest) {
  if (!quest) return;
  _faces = _faces.filter((face) => face.questUID !== quest.uid);
  refreshFaces();
}

/** GetSaveData (:279-282) - the envelope's FaceDetails[]. */
export function getEscortFacesSaveData() {
  return _faces.map((f) => ({ ...f }));
}

/** RestoreSaveData (:284-289) with SaveLoadManager's own null arm
 *  (RestoreEscortingFacesData, SaveLoadManager.cs:1071-1079: a save
 *  without the block clears the panel). */
export function restoreEscortFacesSaveData(faces) {
  if (!faces) { clearEscortFaces(); return; }
  _faces = faces.map((f) => ({ ...f }));
  refreshFaces();
}

/** The faces column, in native 320x200 units on the fitted virtual
 *  screen (DaggerfallHUD.cs:183-185 gives the panel NativePanel.Size
 *  and ScaleToFit; the port's native windows all ride the integer
 *  nativeMetrics fit, the recorded convention). Special panels draw
 *  at the fixed 48x48; racial and child heads at their art's size. */
export function drawEscortFaces(renderer, canvas) {
  if (!_panels.length) return;
  const m = nativeMetrics(canvas);
  const sizes = _panels.map((p) => (p?.special
    ? { w: ESCORT_SPECIAL_FACE_SIZE, h: ESCORT_SPECIAL_FACE_SIZE }
    : (p?.img ? { w: p.img.w, h: p.img.h } : null)));
  const placed = layoutEscortFaces(sizes);
  for (let i = 0; i < _panels.length; i++) {
    const p = _panels[i];
    if (!p?.img || !placed[i].enabled || !sizes[i]) continue;
    renderer.drawScreenQuad(p.img.tex, {
      x: m.ox + placed[i].x * m.s, y: m.oy + placed[i].y * m.s,
      w: sizes[i].w * m.s, h: sizes[i].h * m.s,
    });
  }
}

/** The tests' window into the live list. */
export const _escortFaces = () => _faces;
