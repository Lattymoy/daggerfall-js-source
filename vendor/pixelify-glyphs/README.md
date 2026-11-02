# The 2 and the Z for the enhanced skin - two glyphs

`pixelify-glyphs.woff2` (416 bytes) holds two drawn glyphs, the digit TWO (U+0032) and the capital Z (U+005A), made
for DFO with fontTools by `tools/pixelifyGlyphs.py`. They are our own drawing, not a subset of another font.

Why: the enhanced skin is set in Pixelify Sans, and its 2 is the same shape as its Z (one corner apart), so numbers
read as Z's and Z's as 2's - Dudey, 2026-10-18: "the number 2 looks like a Z". The new 2 has a rounded top and a
diagonal that steps down to a full base, on the same lines Pixelify's own 4 and N step on. The new Z has a flat top
and base and one straight diagonal, so it cannot be taken for the 2. They sit on Pixelify's own grid (at weight 500: columns 60-531,
base -12, top 633, advance 592), so they stand with the other letters and digits at both weights the skin uses.

They are served as a data URI from `src/ui/pixelifyFive.js` as a second face of the family `Pixelify Five` with
`unicode-range: U+0032, U+005A`, beside Silkscreen's five (`vendor/silkscreen-five/`). Pixelify Sans keeps every other
glyph, the small z included.
