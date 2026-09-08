# Silkscreen's five - one glyph, for the enhanced skin's digits

`pixelify-five.woff2` (520 bytes) is the digit FIVE of **Silkscreen**
(Copyright 2001 The Silkscreen Project Authors,
github.com/googlefonts/silkscreen), licensed under the SIL Open Font
License 1.1 (`OFL.txt` beside it), subset to the single code point
U+0035 with fontTools:

    pyftsubset Silkscreen-Regular.woff2 --unicodes=U+0035 --flavor=woff2 --no-hinting --output-file=pixelify-five.woff2

Why: the enhanced skin is set in Pixelify Sans, whose 5 is drawn with a
cut top-left corner and reads as an 8 (or an S) at every size and
weight - Mac, 2026-09-08: "the enhanced font number 5 looks like an 8".
The face ships no alternate (GSUB: ccmp, frac, liga, locl only), so the
digit comes from a second pixel face that matches Pixelify's height and
stroke: Silkscreen's. It is served as a data URI from
`src/ui/pixelifyFive.js` under the family name `Pixelify Five` with
`unicode-range: U+0035`, placed ahead of Pixelify Sans in every stack -
so only the 5 is Silkscreen's and no request is made for it. The OFL
permits this (a subset is a Modified Version; the Reserved Font Name
"Silkscreen" is not used as the family name).
