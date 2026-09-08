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

Integrity (sha256, verified against github.com/ajrb/dfunity-mods master
on 2026-09-08 and pinned by `test/vendorIntegrity.test.js`):

- `roadData.bytes` 249ee50c54c564b9f89e3cf0cb28f87e0ab1c5603cdd4f794afc4e96a6b6af8a
- `trackData.bytes` dce018b03bee20f846bfca0854ae38cf737b8a684e92bf95cd7468df403385a6
- `riverData.bytes` 6b867c189be672874334557573d8c40598beb050277dd18f81a2c33b9b9ac8ab
- `streamData.bytes` 567ebda53a121435f5c26c12c6141d2d596c54af82fe3a08109f25544cef349f

The port's painter is a port of the mod's (`src/world/roadPainter.js`,
tables and geometry read from `BasicRoadsTexturing.cs`), credited in
`bible/03-World/Roads.md`. Thank you, Hazelnut.
