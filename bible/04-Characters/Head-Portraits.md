# Head Portraits - the face as a picture of the Morrowind head

`src/combat/fpArm.js` (headPortrait, renderHeadAssembly, headFrame, headBounds, faceMatchOf - the picture and the one
face door) + `src/characters/headPortraits.js` (who is asked, by which gate, under which key) +
`src/render/portraitRenderer.js` (the renderer the menu's wells borrow) + the doors: `src/ui/facePortrait.js`,
`src/ui/native/nativeTalk.js` (setNpcPortrait), `src/scenes/townTalk.js` and `src/scenes/worldModes.js` (the talk doors),
`src/ui/hud/hudLarge.js`, `src/ui/chargenArt.js`, `src/ui/partyPanel.js` (createFaceLoader - the party's, the family's and
the succession's faces), `src/ui/hud/hudEscortFaces.js`, `src/ui/dialClassicArt.js` (PORTRAIT3D, the owner, 2026-10-15)

> "Btw I know I dont have the rest of the races faces, but can we do the other races with 3d portraits also?"

Asked which of two things that meant - hand-picked heads per portrait for the other races, or the portraits themselves
drawn as the 3D head - the owner: "#2 is exactly I wanted. Which also affects the talk window for npcs". Of the first
cut's five gaps (the curse's heads, the helm, the head alone, a face shown twice, the faces still Daggerfall's): "1. Do
this 2. Do this 3. That's okay 4. That's fine 5. Do this - Stop half assing this".

## What it is

With Morrowind's data attached, a face Daggerfall paints is drawn as the head the body wears - its face and hair, the
helm or hood on it, the curse's head - every race:

- **The player's face** - the save tiles and the realm's, the profile mark at the door and at pause, the account card,
  the enhanced chargen's grid and review (all through `ui/facePortrait.js`, the faces' one home, TILE1), the large
  HUD's head, the classic chargen's face picker and summary, and the tab dial's SKILLS door. Gate: Morrowind's data
  attached, the switch the player's own body stands on (MWA4, either skin).
- **An NPC's face in the talk window** - the classic window's 64 x 64 PORTRAIT_RECT and the enhanced panel's face. Gate:
  the people standing in Morrowind bodies (`npcBodiesOn` - the enhanced skin, the data, Morrowind People not Off), so
  the face is the head on the body that stood there, in the hood or helm it wears.
- **The faces of the record** - the party's plate (a seat's pose), the Family tab's cards and the Succession's (a member
  of the blood, another player's character, a townsperson wed in): one loader, `createFaceLoader`.
- **The escorts' column** - an adult's face of the race's heads.

Every door keeps its classic record until the picture lands, and for good where none is drawn: no data, no renderer
yet, a race with no head in hand, a mesh or a texture that did not come. Nothing about a face is stored.

## The one face

The head and hair are the body's own, chosen by the same code: `faceMatchOf` is the build's face door moved out of
`buildFpArm` whole (the curated table, the measured match kept per data set, the walk), and `playerBodyRows` picks the
rows. A player's portrait `faceIndex` is the portrait's head (a Breton man's portrait 6 the eyepatch); an NPC's head and
hair are walked off its seed (`npcFaceOf`, MWNPC17), read from the look its body is built from through `peerBuildOpts` -
a walker's (`person._mwFolk` / `person._mwRes`, folkBodies.js and rosterBodies.js), a static NPC's (`personLook`, the
click's NPCData mapped to its person), a kin's own. A creature's look and a wolf's have no face here, and a child, a
daedra or an editor flat - who stand in no body - keep their record.

- **A townsperson wed in** (`facePose`'s `common`, their census face) wears the head their body walks the street with:
  the pose carries their census id (`resident`), and `residentHeadLook` walks the head off its seed as `residentLook`
  does - bare, behind the people's gate.
- **An escort** is the race's head at the face, as a chargen portrait's, among the data's heads - their own race (the
  classic drew every race but the Redguard as a Breton, its art's limit, not the quest's). A child's face (Morrowind has no children) and a
  fixed NPC's painted one (FACES.CIF, the mod's) keep theirs.
- **A live character** (the player's entity) is drawn as its body is built: `armBuildOptsOf`, the build's own door -
  the armour worn, the vampire's head (`vampire`, now read by the build too), the transformed werewolf's in its skin.
  The body follows the curse as the wolf's form does: fpArm `setVampire`, asked by the rig each frame beside
  `setWerewolf` (one boolean compare; a change one build; asked mid-build, it waits for the build), and the standing
  arm counts as the entity's only with its curse (`armIdentityOf`, `builtFor`, `armsStandFor`).
- **The port's own heads are a player's alone** (MW-HEADS2, `04-Characters/Own-Heads.md` - the owner: "only the player
  Britons should recieve the new heads, not npcs"): a player's face asks for them (`ownHeads` - the live player, a save,
  a chargen portrait, a party seat, the one played and another player's character on the Family tab); an NPC's in the
  talk window, an escort's (`npc`) and a member of the line not played (`kin`, one of the people as their body is) wear
  the data's, as their bodies do.

## The picture

`headPortrait` reads its own catalogue - the archives and every `.esm`'s BODY, ARMO and RACE records by the derived door
the build takes, one per data generation - so it stands before any body is built: at character creation and on the
title screen's saves. `renderHeadAssembly` assembles the head as the body is assembled: the third-person skeleton
(`tpSkeletonPath`: the sex, the beast's, the wolf's), the skin's head and hair rows, and what is worn on the head -
`composeWornArmor` over the build's own list, clothes left out (a cloak's, a robe's dyes are measured for the body
alone), the adds that cap the head or bind its bone kept - with their shadows (`shadowSkinRows`: the closed steel helm's
visor hides the face and the hair, MW-STEEL1's open one shows the face), HEAD-HELD's bare rows where a helm bound
nothing, posed at rest. A vampire wears the race's vampire head; the transformed werewolf Bloodmoon's head on the wolf's
skeleton, in its skin, wearing nothing (WEREWOLF1). The wereboar keeps Daggerfall's picture, as its body does.

`headBounds` frames the head's pieces - the head, the hair, a helm's - and of a part that hides the head and hangs from
more than it (a townsperson's hooded outfit) only what lies within three quarters of the head's diagonal. `headFrame`
stands the eye before the face (+Z, where the body at rest faces as the inventory's figure sees it), the orthographic
window the projected box with 8% air and as wide as the picture asked; the model is `figure()`'s own at yaw 0, x
negated, in metres - **its +180 and all**, which turns the body's front (Morrowind's +Y) to the eye on +Z.
PORTRAIT3D-FACE (2026-10-15, a player's screenshot via the owner: a Nord's card on the online characters page, all hair
- "Why is his portrait showing the back of the head"): the first cut copied the transform and left the turn, and its
pin compared against the same mistake, so every portrait was of the back of a head; the probe's closed steel helm
showed its mail aventail, now its visor. It is lit as the inventory's figure is (`renderCharacterSpriteImage`, the studio light), on a transparent
ground, and read back once: one picture per skeleton, skin rows, worn parts, form, skin and size, the data generation
first (NPCs who wear one head share one picture, and the talk window one texture). A miss is not kept (AUDIT 32 F3's
law).

The menu's wells hold no renderer, so the entry hands its one Renderer to `render/portraitRenderer.js` at boot, behind a
door (BOOT2's ceiling).

## The keys

`headDataStamp` is the data's generation while Morrowind's data is attached, else 0 - read at once, the store behind a
door (a static import of `scenes/dataSource.js` binds its network door ahead of a host's: UI2's sheet cutter hung on
it). `playerHeadKey(entity)` adds the helm worn - its item and the steel helm's style. The large HUD's head and the tab
dial's are keyed on their record (the curse's override art among it) and on it, so a helm put on, a visor raised, a
curse come or the data attached draws the head again. The party's plate keys a seat's face on its stamp
(`headSuffix`), the escorts' column resolves its faces again when the stamp moves.

## The doors

- `ui/facePortrait.js`: `loadFace` and `loadFaceCanvases` draw each face as its head on a canvas the record's own size;
  a face is drawn alone (a save tile renders one, not ten). The classic set still addresses every index (AUDIT-312 F5).
- `ui/native/nativeTalk.js` `setNpcPortrait(archive, record, { picture })`: the record first, then the head under a key of its
  own (`<file>#<record>#mwhead<n>`) once it lands - the enhanced panel repaints on the key - and only for the session it
  was asked for. The classic window draws it in PORTRAIT_RECT at its own resolution, as a mod's portrait (DFMOD1).
- `scenes/townTalk.js` `portraitOf` carries the walker's look; `scenes/worldModes.js` `staticNpcPortrait` the static
  NPC's (`talkedTo`, the click's NPCData to its person).
- `ui/hud/hudLarge.js` `loadHudLargeHead`: the Morrowind head first - the curse's too (the owner: "Do this") - then
  Daggerfall's override heads, then the race's record, at four times the head rect.
- `ui/chargenArt.js` `loadFaceSet`: the ten records first, each upgraded in place as its head lands.
- `ui/partyPanel.js` `createFaceLoader`: `poseHeadImage` first, at `HEAD_RECORD` (32 x 34, the widest head record's
  plate) three times over; the answer says `scale`, and the plate, the family's cards and the succession's draw it that
  many times smaller and smooth - the record's size, where a record is drawn at whole pixels.
- `ui/hud/hudEscortFaces.js`: the head at `HEAD_RECORD`'s size, its picture four times over, uploaded once a key; a record
  that lands after it is not drawn over it.
- `ui/dialClassicArt.js` `readHeadDial`: the head at twice CLASSIC_FACE_MAX, trimmed to its painted pixels and drawn at
  half (`headDialPicture`) - its longer side the rose's limit; the root's `data-grim-dial-face="head"` lifts the dial's
  square pixels off that door alone (`ui/grimoireDress.js`).

## What it does not do

- The head stands alone, no neck or shoulders, on a transparent ground; the classic window shows its own art round it
  (the owner: "That's okay").
- Where the curated table or the walk gives two portraits one head and hair, the chargen grid shows the same head twice
  (the owner: "That's fine").
- A seat in the party, a member of the blood and an escort wear their bare face: no pose or record carries what they
  wear. A fixed NPC escorted keeps the painted face the quest gave them; a child keeps theirs.
- Not seen on retail Morrowind data here: the container holds none. The port's own Breton heads and steel and ebony
  helms were rendered through the real renderer in a real browser on the vendored retail skeleton
  (`tools/headPortraitProbe.mjs`): the helms upright and face-on, filling the frame. The fixture skeleton's part nodes
  stand at no rotation, so a rigid head lies turned on its side there; retail's base_anim.nif turns the head bone as
  it turns the body's.

## How it was proven

`test/ui/portrait3d.test.js` (15), on the port's own Breton heads and helms read off the disk on the vendored retail
skeleton under a counting renderer: the frame face-on, every corner in the window with air, as wide as asked; the hood
framed only round the head; the portrait the head and hair the curated table names for portrait 6, every range
textured, the mesh and every texture let go; the steel helm closed hiding the face and hair, open showing the face, the
ebony helm its own picture, a cuirass and a cloak no head's; the vampire's head and the wolf's; one picture per head and
what it wears, another size another, another generation anew, a miss asked again; an NPC's head walked off its seed; no
renderer, race, data or head - no picture; the gates; the talk window's key, its one texture a picture, a late head
landing on no one; the head key (the data, the helm, the visor); the party's plate drawing a head at the record's size
smooth and a record at whole pixels, the stamp on its key, a townsperson wed in walked as their street body; the
escorts' key (their own race, no child, no painted face, no data); the dial's trim, its scale and its smooth root; and
the doors by source; the rig following the curse (setVampire once a change, waiting out a build, the standing arm the
entity's only with its curse, the frame asking). `tools/mutants/portrait3d.json` (36, all dead).
