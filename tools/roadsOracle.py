#!/usr/bin/env python3
"""AUDIT 51: THE ORACLE. BasicRoadsTexturing.cs's PaintPath, PaintPathTile,
PaintPathWithSubPathJoins and the job's paint order, transliterated line
for line from the MIT source (Copyright (C) 2020 Hazelnut). It emits the
tilemap the MOD would paint for each case; test/roadsParity.test.js runs
our painter on the same cases and compares byte for byte. A difference
is a parity bug by definition, not a matter of reading.

Regenerate:  python3 tools/roadsOracle.py > test/fixtures/roads-oracle.json
"""
import json, random

N, NE, E, SE, S, SW, W, NW = 128, 64, 32, 16, 8, 4, 2, 1
tDim = 128; tdDim = 129
midLo, midHi = 63, 64
water, dirt, grass, stone = 0, 1, 2, 3
road = 46; water_temp = 255; no_change = 99
CardInn, CardOut, DiagInn, DiagOut, DiagGap, ICorner = 0, 1, 2, 3, 4, 5

roadTiles   = [[46,46,46,46], None, [46,46,46,46], [47,47,55,55], None, None]
trackTiles  = [[0,99,11,26], None, [0,99,51,52], [0,99,12,27], None, [0,99,10,25]]
streamTiles = [[0,6,21,31], None, [0,48,49,50], [0,7,22,32], None, [0,5,20,30]]
riverTiles  = [[0,0,0,0], [0,6,21,31], [0,0,0,0], [0,5,20,30], [0,7,22,32], [0,5,20,30]]

class Job:
    def __init__(self, tileData, locationRect):
        self.tileData = tileData          # 129x129 corner grounds
        self.tilemapData = [0] * (tDim * tDim)
        self.rect = locationRect          # (xMin, xMax, yMin, yMax) or None

    def RotateFlipTile(self, index, rotate, flip):
        if rotate: self.tilemapData[index] += 64
        if flip: self.tilemapData[index] += 128

    def PaintPathTile(self, x, y, index, pathTile, rotate, flip, overwrite=True):
        if overwrite or self.tilemapData[index] == 0:
            tile = self.tileData[y * tdDim + x]
            if tile > stone: tile = grass
            if pathTile[tile] != no_change:
                self.tilemapData[index] = pathTile[tile]
                self.RotateFlipTile(index, rotate, flip)
                if self.tilemapData[index] == 0: self.tilemapData[index] = water_temp
                return True
        return False

    def SetPathTile(self, index, pathTile, rotate, flip):
        self.tilemapData[index] = pathTile
        self.RotateFlipTile(index, rotate, flip)
        if self.tilemapData[index] == 0: self.tilemapData[index] = water_temp

    def PaintPath(self, x, y, index, pathTiles, pathDataPt, pathCorners):
        hasPath = False
        if pathDataPt != 0:
            # N-S
            if (((pathDataPt & N) != 0 and (x == midLo or x == midHi) and y > midLo) or ((pathDataPt & S) != 0 and (x == midLo or x == midHi) and y < midHi)) and pathTiles[CardInn] is not None:
                hasPath |= self.PaintPathTile(x, y, index, pathTiles[CardInn], False, x == midHi)
            if (((pathDataPt & N) != 0 and (x == midLo or x == midHi) and y == midLo) or ((pathDataPt & S) != 0 and (x == midLo or x == midHi) and y == midHi)) and pathTiles[DiagOut] is not None:
                hasPath |= self.PaintPathTile(x, y, index, pathTiles[DiagOut], x == y, x == midHi, False)
            # E-W
            if (((pathDataPt & E) != 0 and (y == midLo or y == midHi) and x > midLo) or ((pathDataPt & W) != 0 and (y == midLo or y == midHi) and x < midHi)) and pathTiles[CardInn] is not None:
                hasPath |= self.PaintPathTile(x, y, index, pathTiles[CardInn], True, y == midHi)
            if (((pathDataPt & E) != 0 and (y == midLo or y == midHi) and x == midLo) or ((pathDataPt & W) != 0 and (y == midLo or y == midHi) and x == midHi)) and pathTiles[DiagOut] is not None:
                hasPath |= self.PaintPathTile(x, y, index, pathTiles[DiagOut], x == y, x == midHi, False)
            # NE-SW
            if (((pathDataPt & NE) != 0 and x == y and x > midLo) or ((pathDataPt & SW) != 0 and x == y and x < midHi)) and pathTiles[DiagInn] is not None:
                hasPath |= self.PaintPathTile(x, y, index, pathTiles[DiagInn], False, False)
            if (((pathDataPt & NE) != 0 and ((x == y + 1 and x > midLo) or (x + 1 == y and y > midLo))) or ((pathDataPt & SW) != 0 and ((x == y + 1 and x <= midHi) or (x + 1 == y and y <= midHi)))) and pathTiles[DiagOut] is not None and not hasPath:
                hasPath |= self.PaintPathTile(x, y, index, pathTiles[DiagOut], False, (x == y + 1))
            # NW-SE
            _x = tDim - 1 - x
            if (((pathDataPt & NW) != 0 and _x == y and x < midHi) or ((pathDataPt & SE) != 0 and _x == y and x > midLo)) and pathTiles[DiagInn] is not None:
                hasPath |= self.PaintPathTile(x, y, index, pathTiles[DiagInn], True, False)
            if (((pathDataPt & NW) != 0 and ((_x == y + 1 and x < midHi) or (_x + 1 == y and y > midLo))) or ((pathDataPt & SE) != 0 and ((_x == y + 1 and x >= midLo) or (_x + 1 == y and y <= midHi)))) and pathTiles[DiagOut] is not None and not hasPath:
                hasPath |= self.PaintPathTile(x, y, index, pathTiles[DiagOut], True, (_x != y + 1))
            # Cardinal - Outer
            if pathTiles[CardOut] is not None and not hasPath:
                if (((pathDataPt & N) != 0 and (x == midLo - 1 or x == midHi + 1) and y > midLo) or ((pathDataPt & S) != 0 and (x == midLo - 1 or x == midHi + 1) and y < midHi)):
                    hasPath |= self.PaintPathTile(x, y, index, pathTiles[CardOut], False, x == midHi + 1, False)
                if (((pathDataPt & E) != 0 and (y == midLo - 1 or y == midHi + 1) and x > midLo) or ((pathDataPt & W) != 0 and (y == midLo - 1 or y == midHi + 1) and x < midHi)):
                    hasPath |= self.PaintPathTile(x, y, index, pathTiles[CardOut], True, y == midHi + 1)
            # Diagonal - Gaps
            if pathTiles[DiagGap] is not None and not hasPath:
                if (((pathDataPt & NE) != 0 and ((x - 1 == y + 1 and x > midLo) or (x + 1 == y - 1 and y > midLo))) or ((pathDataPt & SW) != 0 and ((x - 1 == y + 1 and x <= midHi) or (x + 1 == y - 1 and y <= midHi)))):
                    hasPath |= self.PaintPathTile(x, y, index, pathTiles[DiagGap], False, (x - 1 == y + 1))
                if (((pathDataPt & NW) != 0 and ((_x - 1 == y + 1 and x < midHi) or (_x + 1 == y - 1 and y > midLo))) or ((pathDataPt & SE) != 0 and ((_x - 1 == y + 1 and x >= midLo) or (_x + 1 == y - 1 and y <= midHi)))):
                    hasPath |= self.PaintPathTile(x, y, index, pathTiles[DiagGap], True, (_x - 1 != y + 1))
            # Inside 90deg cardinal corners
            if pathTiles[ICorner] is not None:
                offset = 0 if pathTiles[CardOut] is None else 1
                if (pathDataPt & N) != 0 and (pathDataPt & W) != 0 and x == midLo - offset and y == midHi + offset: self.PaintPathTile(x, y, index, pathTiles[ICorner], False, False)
                if (pathDataPt & N) != 0 and (pathDataPt & E) != 0 and x == midHi + offset and y == midHi + offset: self.PaintPathTile(x, y, index, pathTiles[ICorner], True, True)
                if (pathDataPt & S) != 0 and (pathDataPt & W) != 0 and x == midLo - offset and y == midLo - offset: self.PaintPathTile(x, y, index, pathTiles[ICorner], True, False)
                if (pathDataPt & S) != 0 and (pathDataPt & E) != 0 and x == midHi + offset and y == midLo - offset: self.PaintPathTile(x, y, index, pathTiles[ICorner], False, True)
            # Paint roads around locations
            if self.rect is not None and x > self.rect[0] and x < self.rect[1] and y > self.rect[2] and y < self.rect[3] and pathTiles is roadTiles:
                self.tilemapData[index] = road
                return True
        # Paint map pixel corners in adjacent pixels
        if pathCorners != 0:
            if (pathCorners & NW) != 0 and x == tDim - 1 and y == tDim - 1: hasPath |= self.PaintPathTile(x, y, index, pathTiles[DiagOut], True, False)
            if (pathCorners & SW) != 0 and x == tDim - 1 and y == 0: hasPath |= self.PaintPathTile(x, y, index, pathTiles[DiagOut], False, False)
            if (pathCorners & SE) != 0 and x == 0 and y == 0: hasPath |= self.PaintPathTile(x, y, index, pathTiles[DiagOut], True, True)
            if (pathCorners & NE) != 0 and x == 0 and y == tDim - 1: hasPath |= self.PaintPathTile(x, y, index, pathTiles[DiagOut], False, True)
        return hasPath

    def PaintPathWithSubPathJoins(self, x, y, index, pathTiles, pathDataPt, pathCorners, subPathDataPt):
        hasPath = self.PaintPath(x, y, index, pathTiles, pathDataPt, pathCorners)
        if pathCorners != 0:
            if (((pathCorners & NW) != 0 and (subPathDataPt & NE) != 0 and x == tDim - 1 and y == tDim - 1) or
                ((pathCorners & SW) != 0 and (subPathDataPt & SE) != 0 and x == tDim - 1 and y == 0) or
                ((pathCorners & SE) != 0 and (subPathDataPt & SW) != 0 and x == 0 and y == 0) or
                ((pathCorners & NE) != 0 and (subPathDataPt & NW) != 0 and x == 0 and y == tDim - 1)):
                self.SetPathTile(index, water, False, False)
        if subPathDataPt != 0 and pathTiles[ICorner] is not None:
            offset = 0 if pathTiles[CardOut] is None else 1
            if (pathDataPt & N) != 0 and (subPathDataPt & W) != 0 and x == midLo - offset and y == midHi and (pathDataPt & W) == 0: self.PaintPathTile(x, y, index, pathTiles[ICorner], False, False)
            if (pathDataPt & N) != 0 and (subPathDataPt & E) != 0 and x == midHi + offset and y == midHi and (pathDataPt & E) == 0: self.PaintPathTile(x, y, index, pathTiles[ICorner], True, True)
            if (pathDataPt & S) != 0 and (subPathDataPt & W) != 0 and x == midLo - offset and y == midLo and (pathDataPt & W) == 0: self.PaintPathTile(x, y, index, pathTiles[ICorner], True, False)
            if (pathDataPt & S) != 0 and (subPathDataPt & E) != 0 and x == midHi + offset and y == midLo and (pathDataPt & E) == 0: self.PaintPathTile(x, y, index, pathTiles[ICorner], False, True)
        return hasPath

    def run(self, roadPt, roadCorners, trackPt, trackCorners, riverPt, riverCorners, streamPt, streamCorners, renderWater):
        for index in range(tDim * tDim):
            x = index % tDim; y = index // tDim
            if self.tilemapData[index] != 0: continue
            if (self.PaintPath(x, y, index, roadTiles, roadPt, roadCorners) or
                (renderWater and self.PaintPathWithSubPathJoins(x, y, index, riverTiles, riverPt, riverCorners, streamPt)) or
                (renderWater and self.PaintPath(x, y, index, streamTiles, streamPt, streamCorners)) or
                self.PaintPath(x, y, index, trackTiles, trackPt, trackCorners)):
                continue
        return self.tilemapData

def quadrants():
    td = [0] * (tdDim * tdDim)
    for y in range(tdDim):
        for x in range(tdDim):
            td[y * tdDim + x] = (dirt if x < 64 else grass) if y < 64 else (stone if x < 64 else water)
    return td

def rle(t):
    out = []; last = t[0]; n = 0
    for v in t:
        if v == last: n += 1
        else: out.append([last, n]); last = v; n = 1
    out.append([last, n]); return out

cases = []
rnd = random.Random(51)
for m in range(256): cases.append(dict(road=m))
for m in range(256): cases.append(dict(track=m))
for c in range(16): cases.append(dict(roadCorners=((c & 3) | ((c >> 2) << 4)) & 0x55))
for i in range(48): cases.append(dict(road=rnd.randrange(256), roadCorners=rnd.randrange(256) & 0x55, track=rnd.randrange(256), trackCorners=rnd.randrange(256) & 0x55))
for i in range(48): cases.append(dict(river=rnd.randrange(256), riverCorners=rnd.randrange(256) & 0x55, stream=rnd.randrange(256), streamCorners=rnd.randrange(256) & 0x55, water=True))
for i in range(16): cases.append(dict(road=rnd.randrange(256), river=rnd.randrange(256), stream=rnd.randrange(256), track=rnd.randrange(256), water=True))
for m in (N, N | S, E | W, NE, N | E, S | W): cases.append(dict(road=m, rect=[48, 79, 48, 79]))
for m in (N, N | S, NE): cases.append(dict(track=m, rect=[48, 79, 48, 79]))
for m in (N | S, E): cases.append(dict(river=m, water=True, rect=[48, 79, 48, 79]))

out = []
for c in cases:
    j = Job(quadrants(), c.get('rect'))
    t = j.run(c.get('road', 0), c.get('roadCorners', 0), c.get('track', 0), c.get('trackCorners', 0), c.get('river', 0), c.get('riverCorners', 0), c.get('stream', 0), c.get('streamCorners', 0), c.get('water', False))
    out.append(dict(case=c, tilemap=rle(t)))
print(json.dumps(dict(ground='quadrants: dirt NW, grass NE, stone SW, water SE (tile y up)', cases=out)))
