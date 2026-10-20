# Builds vendor/pixelify-glyphs/pixelify-glyphs.woff2: the enhanced skin's own 2 and Z (see that folder's README).
# Run: python3 tools/pixelifyGlyphs.py   (needs fontTools and brotli)
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

# Pixelify Sans's grid at 1000 units, at weight 500 (the weight the skin reads in): five columns, seven rows (row 6
# is the top). Its own 4 and N step on these same lines, so the 2's steps fall where theirs do.
COLS = [(60, 150), (150, 240), (240, 331), (331, 440), (440, 531)]
ROWS = [(-12, 77), (77, 166), (166, 255), (255, 344), (344, 432), (432, 544), (544, 633)]
# The 2: a rounded top, the right side down, a diagonal stepping two cells wide, a full base.
TWO = {6: [1, 2, 3], 5: [0, 4], 4: [3, 4], 3: [2, 3], 2: [1, 2], 1: [0, 1], 0: [0, 1, 2, 3, 4]}
# The Z: a flat top and base and one straight diagonal from the top right (x, y) to the bottom left (x, y), 150 units
# across. Stepped, the Z read as a 2 again; straight, it is plainly a Z.
ZED = {6: [0, 1, 2, 3, 4], 0: [0, 1, 2, 3, 4]}
ZED_DIAGONAL = ((531, 544), (60, 77))
STROKE = 150


def runs(cells):
    out = []
    for c in sorted(cells):
        if out and out[-1][1] == c - 1:
            out[-1][1] = c
        else:
            out.append([c, c])
    return out


def draw(rows, diagonal=None):
    pen = TTGlyphPen(None)
    if diagonal:
        (xt, yt), (xb, yb) = diagonal
        pen.moveTo((xb, yb)); pen.lineTo((xt - STROKE, yt)); pen.lineTo((xt, yt)); pen.lineTo((xb + STROKE, yb)); pen.closePath()
    for r, cells in rows.items():
        y0, y1 = ROWS[r]
        for a, b in runs(cells):
            x0, x1 = COLS[a][0], COLS[b][1]
            pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
    return pen.glyph()


fb = FontBuilder(1000, isTTF=True)
fb.setupGlyphOrder(['.notdef', 'two', 'Z'])
fb.setupCharacterMap({0x32: 'two', 0x5A: 'Z'})
fb.setupGlyf({'.notdef': TTGlyphPen(None).glyph(), 'two': draw(TWO), 'Z': draw(ZED, ZED_DIAGONAL)})
fb.setupHorizontalMetrics({'.notdef': (500, 0), 'two': (592, 60), 'Z': (592, 60)})
fb.setupHorizontalHeader(ascent=920, descent=-280)
fb.setupNameTable({'familyName': 'DFO Glyphs', 'styleName': 'Regular'})
fb.setupOS2(sTypoAscender=920, sTypoDescender=-280, usWinAscent=922, usWinDescent=289, sCapHeight=631, sxHeight=450)
fb.setupPost()
# fixed dates, so the build gives the same bytes every time
fb.font['head'].created = fb.font['head'].modified = 3876000000
fb.font.flavor = 'woff2'
fb.save('vendor/pixelify-glyphs/pixelify-glyphs.woff2')
