# The studio: DFO Online's own art

This folder is where the game's artists put their pictures. Drop a PNG in your folder, named for the picture it
replaces, and the game wears it: on the next load of the dev server, and on the site and the desktop app after the
next deploy. There is no list to edit and no tool you have to run.

The design record is `bible/07-Rendering/Studio-Art.md`.

## Your folder

```
public/art/studio/
  README.md          this page
  artists.json       the roster: whose folders the game wears
  trashBattery/      trashBattery's pictures
  Redclaw/           Redclaw's pictures
  maya/              maya's pictures
```

Your folder is made by your first picture. On GitHub's upload page, open `public/art/studio/`, drag in a folder named
exactly as the roster spells you (`trashBattery`, `Redclaw`, `maya`) with your pictures in it, or type `trashBattery/` in
front of the file's name. Make folders inside yours however you like (`trashBattery/wagons/...`). A folder whose name
is not on the roster is not worn: a new artist is added to `artists.json` first.

## Naming a picture

A picture is named for the texture it replaces, the way every Daggerfall texture pack names one:

```
<archive>_<record>-<frame>.png
```

You can add a label after two dashes, so the name says what it is:

```
38181_1-0--cart-side-boards-weathered-oak.png
```

Everything after `--` is for people; the game reads the part before it. Every name - your folders and your files - is
letters, digits and `_ . -` only: no spaces, no accents, no `#` or `?`.

**Finding the numbers.** There are two places:

- **The studio page** (`studio.html` on the site or the dev server, or `node tools/studioArt.mjs`) lists the pictures of
  the eight models the game paints itself: the wagons, carts and caravan, the three ships, the towns' hangings, the
  yards, the shipyard and lighthouse, and the LeFay monument. Each one has a download button, and its template is
  already named correctly: repaint it and drop it in your folder. These are painted from numbers, and the wagons' are
  recoloured for each paint, which is why they look the way they do.
- **Daggerfall's own textures** use the same names, `<archive>_<record>-<frame>.png`, the ground's tiles included.
  The archive sheet (`archive-sheet.html`) shows every record of a `TEXTURE.nnn` from your own copy of the game,
  numbered.

**Paints are separate pictures.** Each paint a wagon can wear is its own record: the cart's side boards are
`38181_1-0` as built (weathered oak), `38181_101-0` red, `38181_201-0` blue, and so on. A paint with no picture of
yours keeps its painted one.

**Dyes.** A picture for one metal or colour of an item carries it after the number, spelled as the game asks for it:
`233_5-0_Iron.png`, `233_5-0_Daedric.png`. Silver is the plain name, never `_Silver`.

## The rules

- **Only your own drawing.** No pixel may come from Daggerfall's ARENA2: no tracing, repainting, upscaling or
  screenshotting a classic texture. Everything in `public/` is published with the game, and the game's data may not
  be. Committing a picture to your folder is your word that it is yours.
- **PNG only, the picture itself.** Keep working files (.psd, .aseprite, .kra) outside `public/`. A shortcut or link to
  a picture is not one.
- **At most 2048 pixels a side and 4 MB a file.**
- **One picture a slot.** Two pictures for one name (yours and another artist's) fail the check. Agree on whose
  picture it is first.
- **Any size, the slot's shape.** A face stretches the picture to its slot, so keep the template's proportions. A
  64 x 64 slot takes 64 x 64, 128 x 128 or 256 x 256 equally well, and a billboard or an icon stands as big as the one
  it replaces, whatever your picture's size. A ground tile set is drawn at the size of its largest tile.
- **Clear is a hole only where the template has one.** On a caravan's window glass, a ship's stern windows by day and
  the beacon's flame, a pixel under half opaque is cut away (no soft edges). Everywhere else the game draws every pixel
  solid, and a clear one comes out black, so paint the whole picture. The studio page marks the cut-out slots "glass".
- **A ship's night window.** By day a stern window is cut where it is clear; its night picture (`.. - at night`) is
  drawn whole and lit. The light falls where the painted glass was, unless you paint the light too: a picture named
  for the night record with `_Emission` (`38131_106-0_Emission.png`), black where nothing glows.
- **Worn as drawn.** The painted pictures are grained and snapped to Daggerfall's palette when they load. Yours are
  not: your picture is the look.

## What wins

A studio picture is the game's own art, so it is always worn. It is drawn over the painted one, over Vanilla Enhanced
and every texture mod (shipped, or one a player attaches), with "Replace Game Artwork" off and on Classic alike. A
player's own loose texture pack (a folder of pictures, with Replace Game Artwork on) is still drawn over it. The ghosts'
and wraiths' see-through pictures take no replacement.

## Before you push

```
node tools/studioArt.mjs check
```

This names anything the game would refuse: a name that is no texture's at all, a name of one of the eight models that
is none of its slots (a digit dropped, the frame mistyped), a file that is not a PNG, an oversized picture, a name with
a space or an accent, a folder git would never commit, or a slot painted twice. It notes a picture whose shape is not
its slot's and clear pixels on a slot drawn solid. A mistyped number of one of Daggerfall's own textures cannot be
caught here (they are the player's data): compare yours with the archive sheet. The suite runs the same check on every
pull request, so a problem never ships.
