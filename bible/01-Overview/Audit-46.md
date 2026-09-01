# AUDIT 46 - THE BLACK WORLD, AND THE GATE THAT COULD NOT SEE IT (2026-09-01)

Mac: the ground is just an empty void - and then, audit everything.

## The finding I am most sure of

**F1 - THE TILE ARRAY WAS ALLOCATED WITH AN UNSIZED FORMAT.**
generateMipmap requires a colour-renderable, filterable texture, and
`gl.RGBA` on a 2D array is not guaranteed to be one; RGBA8 is. If the
call fails, no mip chain exists, EE3's LINEAR_MIPMAP_LINEAR leaves the
sampler MIPMAP-INCOMPLETE, and an incomplete sampler returns BLACK for
every tile. The allocation had been unsized for years and it never
mattered, because NEAREST needs no mips - the fault only exists once
something asks for them. Fixed in EE8, with a soft fallback to NEAREST
if the chain still cannot be built, because a ground that looks
classic is a disappointment and a ground that is a void is a broken
game.

## The finding that matters more

**F2 - EVERY GATE PASSED ON THE BLACK WORLD, AND THE NEW ONE DOES
TOO.** eslint, the node suite and a vite build have no GL context
between them. The lab's render gate loads grass-proto.html, which
needs no game data; the GAME page needs ARENA2 and was never gated at
all. So I built tools/glGate.mjs, which runs the renderer's real
upload path against a real WebGL2 context in both ground modes and
fails on a GL error or an incomplete mip chain.

AND THEN I REINTRODUCED THE BUG, and the new gate PASSED. SwiftShader
accepts unsized RGBA with generateMipmap; a real driver may not. So
the gate is worth keeping - it will catch the next format fault that
is unconditional - and it CANNOT confirm this one, and saying
otherwise would be the same overclaim that put a black world on the
site.

## What that leaves

I cannot reproduce the void, and I have now guessed at its cause three
times. So the ground's three states are a URL door instead:

    ?ground=classic   the original tiles, NEAREST      (pre-EE3)
    ?ground=tiles     the original tiles, mipmapped    (EE3)
    ?ground=drawn     our surfaces, mipmapped          (EE7)

Whichever of those is black names the slice that broke it, in the time
it takes to reload, and the cache key follows the mode so a bisect
cannot be answered by the array built for the previous one. That is
worth more than a fourth guess.

## Verified in passing

- The builder runs against the REAL archive: 56 records at 64x64 from
  TEXTURE.302 build in 720ms at 128px, and the grass tile's mean is
  85.2 rather than 0 - so the tiles themselves are not black. Whatever
  the void is, it is not the surfaces coming out empty.
- The game's layers are `{colors: Uint8ClampedArray, width, height}`
  from getColor32, which the builder reads correctly.
- Both ground modes upload with no GL error under SwiftShader.
