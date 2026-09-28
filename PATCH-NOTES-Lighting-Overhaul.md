# Patch Notes: Enhanced Lighting, steadier and faster

## Shadows
- **Sun shadows are much steadier.** Their edges barely creep as the sun moves, and no longer jump at 11:28 and 12:32.
- **No ring of popping shadows around you.** Shadow detail now blends with distance, and faraway shadows fade out instead of stopping at a hard edge.
- **Every dungeon torch casts shadows.** Only the eight nearest did, so the rest lit through walls and rooms brightened or darkened as you walked.

## Lights and glow
- **Distant lights fade in and out** instead of popping: in big towns at night (World of Daggerfall's too) and in dungeons.
- **Each lantern keeps its own flicker.** Leaving part of a town behind no longer makes many lanterns jump at once.
- **Flames glow steadily** wherever they sit on screen, at any window size.
- **Lamp glare no longer blinks** with the flicker or your head bob. It is a little brighter on average.
- **Smoother halos** in the dark on most graphics cards, with no hard ring at their edge.
- **Your eyes adjust smoothly** to dark and bright places, high refresh rate screens and phones included.
- **No swimming stripes** of ambient shadow on distant ground.
- **Fewer shadow flashes** near pillars, people and doorways, after a door or a teleport, and at the edge of a lantern's reach.

## Faster
- Entering a big dungeon no longer stalls the graphics card: each torch's shadow draws only the part of the level near it.
- Dungeon torch shadows are no longer redrawn every time a torch flickers.
- Sprites, blood marks and characters send far less to the graphics card, and sorting sprites is several times faster.
- Trees and other sprites work out their sun shadow at their corners, not at every pixel.
- The automap and other 3D previews do less work each frame.

## Fixed
- Buildings now get the underwater fog, not only the ground.
