# Basic Roads data - Hazelnut

The four files beside this note are the path data of **Basic Roads**
for Daggerfall Unity, by Hazelnut (Nexus mod 134, source at
github.com/ajrb/dfunity-mods, BasicRoads/). Each is 500,000 bytes: one
byte per map pixel of the 1000x500 Iliac Bay, an 8-direction compass
mask of the edges a path leaves through (N=128, NE=64, E=32, SE=16,
S=8, SW=4, W=2, NW=1).

- `roadData.bytes` - roads, 21,554 pixels
- `trackData.bytes` - tracks, 30,472 pixels
- `riverData.bytes` - rivers, 973 pixels
- `streamData.bytes` - streams, 2,203 pixels

The mod's CODE is MIT (Copyright (C) 2020 Hazelnut). The DATA is
hand-authored by Hazelnut and contributors and carries no license text
of its own; it is included here BY PERMISSION, granted by Hazelnut to
Mac (Lattymoy) on 2026-09-02. Record of the permission:

> [Mac: paste the text of the permission, or the link to it, here.]

The port's painter is a port of the mod's (`src/world/roadPainter.js`,
tables and geometry read from `BasicRoadsTexturing.cs`), credited in
`bible/03-World/Roads.md`. Thank you, Hazelnut.
