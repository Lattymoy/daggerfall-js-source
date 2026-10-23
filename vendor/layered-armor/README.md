# Layered Gearing - the worn-armor art

The art of the **Layered Gearing** look (`src/player/eyeOfTheBeholder/layeredArmor.js`): a body on foot drawn in the
helmet, chest and leg armor it wears - leather, chain, and plate in seven metals (iron, steel, mithril, adamantium,
ebony, orcish, daedric) - and in a worn cloak's hood and cape, dyed, for a female and a male body, in every frame of
the on-foot tables (walk, attack, hurt, idle, bow and cast: 80 frames an outfit).

- `male/` and `female/`: the strips an outfit is composed from, per helmet/chest/legs combination; `manifest.json`
  names the tiles, the metals and each outfit's frames.
- `cloak/`: the hood and cape layer, per body (its own `manifest.json`).
- `hoodfix/`: the few pixels a hooded frame needs beyond body plus cloak, per outfit and frame.

**Author.** DFO - made for the game (the owner's call, 2026-10-19: credited as DFO's own). Built with the scripts in
`tools/layered-armor/` from hand-cleaned frame packages (`plate_materials_fixed`, `worn_armour_all_frames`), whose
shapes come from Daggerfall's own class sprites (TEXTURE 1540, 1541) and enemy frames (TEXTURE.475-490).

**Permission.** Because its pixels are drawn from Daggerfall's own sprites, this art is a render of game data under
`bible/01-Overview/Port-Doctrine.md`. The owner approved carrying it as a named exception (2026-10-19, "Approve as an
exception"), as for Vanilla Enhanced and the desert's and winter's ground; the doctrine records it and
`test/tooling/doctrine.test.js` holds this folder to it.

**Rebuilding.** `bible/04-Characters/Layered-Gearing.md` says how the strips, the cloak layer and the hood fixes are
built again after another cleanup round.
