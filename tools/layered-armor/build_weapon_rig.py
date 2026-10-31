"""LAYERED-WEAPONS: the weapon rig of the layered bodies - where the art's own warhammer is, so the body can hold
another weapon, or none. Writes vendor/layered-armor/weapon/manifest.json and weapon/<body>/<record>-<frame>.png.

The strips draw a warhammer into every walk, attack, hurt and idle frame (records 0-19), the same in all 27 outfits
of a chest-armour family but moved a pixel or two between families. Per frame and family this finds:
  - the hammer's pixels: stable across the family's nine outfits, grey (or the shaft's wood), on the line from the
    grip to the head (the grips are read by eye - GRIPS, +-3 px - and snapped to where the shaft meets the fist);
  - the grip `q`, the head's centre `t`, the head's radius `hr` and the side its face is on (`side`, +-1);
  - the depth along the shaft (`d`: from 16 px behind the grip to 70 px past it, f where the hammer was in front of the
    body, b where the body hid it, ? where it crossed open air);
  - the fill: the shift or mirror that best continues the body round the hole the head leaves (`fill`), or 0;
  - in a walk or idle frame whose hammer hides its shaft, the line the weapon is drawn on (`w`: SHAFT, Daggerfall's own
    sword), and in each walk and idle frame the free hand a bow is held in (`bow`).
The PNG is three tiles (leather, chain, plate chest), alpha 255 where the hammer is. The manifest also carries each
metal's colour ramp (16 steps by brightness, from the strips' own metal tiles) for the weapons drawn in its place,
the hammer's length (`len`), the body's own bow (`bow`) and its px a centimetre (`cm`: the idle's height is 1.8 m).

usage: python -I build_weapon_rig.py <repo>/vendor/layered-armor [male:0-0 ...]   (needs numpy, scipy, pillow; frames named
  are rebuilt alone, the rest kept)
"""
import sys, os, json, math
from collections import deque
import numpy as np
from scipy import ndimage as nd
from PIL import Image

V = sys.argv[1]
MAN = json.load(open(f'{V}/manifest.json')); NT = len(MAN['tiles'])
FAMS = ('leather', 'chain', 'plate')
K8 = np.ones((3, 3), bool)
LO, HI = -16, 70   # the depth string's span along the shaft, px from the grip

# The grip (where the shaft leaves the fist, read by eye) and, where the head is not the hammer-grey blob nearest the
# grip's line, its centre (a grip with a third entry is where the shaft leaves the fist already, not snapped); EXTRA:
# shaft pieces past the fist the trace cannot reach (x0, y0, x1, y1, half-width) or boxes; CUT: boxes it took that are
# the body.
GRIPS = {
    'male': {
        '0-0': (12, 47), '0-1': (11, 43), '0-2': (14, 49), '0-3': (10, 44),
        '1-0': (36, 63), '1-1': (34, 59), '1-2': (39, 64), '1-3': (35, 61),
        '2-0': (46, 61), '2-1': (45, 57), '2-2': (41, 58), '2-3': (45, 60),
        '3-0': (47, 56), '3-1': (50, 57), '3-2': (60, 58), '3-3': (48, 56),
        '4-0': (45, 53), '4-1': (53, 52), '4-2': (58, 53), '4-3': (55, 55),
        '5-0': (56, 26), '5-1': (52, 32), '5-2': (45, 65), '5-3': (91, 79), '5-4': (110, 76), '5-5': (102, 31),
        '6-0': (54, 27), '6-1': (55, 31), '6-2': (41, 63), '6-3': (58, 83), '6-4': (104, 84), '6-5': (90, 29),
        '7-0': (74, 28), '7-1': (63, 30), '7-2': (42, 61), '7-3': (47, 81), '7-4': (70, 69), '7-5': (65, 22),
        '8-0': (76, 25), '8-1': (66, 28), '8-2': (78, 53), '8-3': (38, 84), '8-4': (46, 74), '8-5': (42, 26),
        '9-0': (61, 27), '9-1': (74, 30), '9-2': (76, 72), '9-3': (32, 81), '9-4': (16, 76), '9-5': (29, 29),
        '10-0': (18, 44), '11-0': (24, 50), '12-0': (55, 47), '13-0': (86, 40), '14-0': (84, 46),
        '15-0': (9, 58), '16-0': (29, 51), '17-0': (40.5, 55.5, 1), '18-0': (27, 48), '19-0': (44, 49),
    },
    'female': {
        '0-0': (52, 88), '0-1': (54, 79), '0-2': (50, 66), '0-3': (55, 72),
        '1-0': (73, 89), '1-1': (64, 85), '1-2': (61, 87), '1-3': (60, 82),
        '2-0': (75, 89), '2-1': (70, 87), '2-2': (68, 88), '2-3': (67, 86),
        '3-0': (89, 86), '3-1': (88, 86), '3-2': (65, 76), '3-3': (87, 87),
        '4-0': (82, 86), '4-1': (82, 86), '4-2': (78, 86), '4-3': (81, 86),
        '5-0': (66, 26), '5-1': (60, 32), '5-2': (61, 40), '5-3': (93, 66), '5-4': (118, 73), '5-5': (100, 30),
        '6-0': (58, 28), '6-1': (47, 34), '6-2': (38, 68), '6-3': (57, 79), '6-4': (94, 74), '6-5': (73, 28),
        '7-0': (74, 31), '7-1': (72, 30), '7-2': (53, 63), '7-3': (48, 77), '7-4': (84, 70), '7-5': (66, 26),
        '8-0': (90, 31), '8-1': (87, 32), '8-2': (70, 74), '8-3': (48, 82), '8-4': (56, 70), '8-5': (52, 27),
        '9-0': (65, 28), '9-1': (70, 39), '9-2': (67, 68), '9-3': (32, 64), '9-4': (15, 80), '9-5': (29, 35),
        '10-0': (24, 48), '11-0': (42, 46), '12-0': (68, 44), '13-0': (94, 42), '14-0': (92, 46),
        '15-0': (51, 73), '16-0': (57, 77), '17-0': (60, 82), '18-0': (64, 79), '19-0': (73, 78),
    },
}
HEADS = {
    'male': {'5-0': (77, 12), '6-0': (88, 12), '3-3': (55, 62), '7-5': (93, 8), '8-4': (53, 56), '9-3': (33, 87),
             '15-0': (26, 48), '19-0': (55, 61)},
    'female': {'6-0': (82, 16), '8-2': (65, 71), '15-0': (40, 88)},
}
# Hole px that are open air whatever their edge says (x0, y0, x1, y1 inclusive): a head out past the hand, over a dark
# lining the fill would carry up into it. The tile's blue is 64 there, and the runtime clears them.
AIR = {('female', '4-0'): [(76, 79, 93, 101)]}
# Boxes where the trace left the hammer's haft: every px there that each outfit draws the same, skin aside, is the
# hammer's - the body's own differs by outfit (2026-10-31, the shields' survey: male 5-3's butt below the fists).
STEADY = {('male', '5-3'): [(86, 62, 95, 74), (83, 87, 93, 99)]}
CUT = {('female', '1-1'): [(76, 83, 81, 90)], ('female', '5-1'): [(57, 34, 63, 41)]}
EXTRA = {('male', '1-0'): [(36, 64, 41, 66)], ('male', '1-1'): [(33, 60, 41, 62), (42, 62, 46, 64)],
         ('male', '1-2'): [(48, 64, 49, 66)], ('male', '1-3'): [(36, 61, 41, 63), (42, 61, 42, 61)],
         ('female', '1-1'): [(66, 88, 75, 92.5, 1.3), (68, 88, 75, 93)], ('female', '1-3'): [(66, 87.5, 72, 91, 1.2)],
         ('female', '17-0'): [(63, 84, 70, 85), (59, 86, 64, 90)], ('female', '5-1'): [(59, 32, 62, 33)],
         ('female', '7-4'): [(95, 26, 100, 43)], ('female', '10-0'): [(25, 50, 32, 58)],
         ('male', '6-5'): [(89, 19, 74, 27, 2.0)], ('male', '16-0'): [(27, 57, 24, 66, 3.0), (27, 58, 34, 64, 2.5)],
         ('male', '7-5'): [(59, 19, 66, 22), (42, 25, 52, 34)], ('male', '0-0'): [(2, 64, 11, 73)], ('male', '15-0'): [(1, 61, 11, 70)]}
# Back views, whose glove is as dark as the hammer's iron (and male 8-4, the head before a dark hood): the hammer is the
# light px in the `lit` boxes, every px but skin in the `all` boxes (x0, y0, x1, y1 inclusive) and in the `seg` shaft
# segments (x0, y0, x1, y1, half-width), round a grip and head read by eye.
HAND = {
    ('male', '3-0'): dict(q=(49, 61), t=(55.5, 64), lit=[(43, 59, 52, 69)], all=[(52, 60, 59, 68), (7, 49, 14, 54)]),   # and a metal tip at the free wrist (2026-10-31)
    ('male', '3-1'): dict(q=(52.5, 59), t=(57.5, 61.5), lit=[(47, 56, 55, 60)], all=[(54, 58, 61, 65)]),
    ('male', '3-2'): dict(q=(62.5, 64), t=(67, 65), lit=[], all=[(63, 63, 71, 68)]),
    ('male', '3-3'): dict(q=(57.5, 60), t=(62, 62.5), lit=[], all=[(58, 59, 67, 66)]),
    ('male', '4-0'): dict(q=(51.5, 59), t=(56.5, 64.5), lit=[(44, 53, 56, 62)], all=[(52, 62, 61, 68)]),
    ('male', '4-1'): dict(q=(57.5, 56.5), t=(61, 61.5), lit=[(47, 38, 52, 44), (54, 47, 59, 57)], all=[(58, 57, 64, 66)]),
    ('male', '4-2'): dict(q=(65, 59.5), t=(64.5, 64), lit=[(61, 42, 70, 49), (63, 55, 67, 61)], all=[(60, 61, 70, 68)]),
    ('male', '4-3'): dict(q=(56.5, 57), t=(60, 61.5), lit=[(46, 39, 51, 45), (52, 48, 58, 57)], all=[(56, 57, 64, 66)]),
    ('male', '9-4'): dict(q=(16, 76), t=(12, 57.5), lit=[], all=[(0, 48, 23, 66)], seg=[(14.5, 66, 16, 73.5, 1.3)]),
    ('female', '9-4'): dict(q=(17, 80), t=(12.5, 62), lit=[], all=[(2, 53, 23, 70)], seg=[(14, 70, 16.5, 77.5, 1.3)]),
    ('male', '11-0'): dict(q=(34.5, 42), t=(51.3, 20.3), lit=[(26, 46, 30, 50)], all=[(40, 10, 61, 32), (20, 49, 28, 56)],
                           seg=[(34.5, 41.5, 46, 28, 2.0)]),
    ('female', '5-2'): dict(q=(61, 63), t=(31, 54), lit=[], all=[(20, 44, 42, 63)], seg=[(41, 57, 60, 63.5, 1.6)]),
    ('male', '8-4'): dict(q=(44.5, 74), t=(52, 52.5), lit=[(46, 44, 58, 61)], all=[], seg=[(45.5, 71, 50, 60, 1.2)]),
    ('female', '3-0'): dict(q=(90, 94.5), t=(94, 96), lit=[(86, 93, 91, 97)], all=[(91, 93, 98, 100), (86, 96, 90, 96)]),
    ('female', '3-1'): dict(q=(86.5, 90.5), t=(89.5, 93), lit=[], all=[(85, 89, 94, 97), (50, 76, 56, 81)]),   # and the wrist's tip
    ('female', '3-3'): dict(q=(86, 90), t=(88.5, 93), lit=[], all=[(85, 88, 92, 97)]),
    ('female', '4-0'): dict(q=(81.5, 91), t=(86, 86.5), lit=[(73, 93, 80, 97), (82, 88, 83, 93)],
                            all=[(81, 80, 91, 87), (83, 87, 91, 93), (74, 94, 89, 101)]),
    ('female', '4-1'): dict(q=(82, 88.5), t=(84, 92.5), lit=[], all=[(80, 89, 88, 96)]),
    ('female', '4-2'): dict(q=(79, 90.5), t=(81, 95), lit=[(76, 88, 81, 92)], all=[(77, 92, 85, 99)]),
    ('female', '4-3'): dict(q=(81.5, 88.5), t=(83, 93.5), lit=[(79, 82, 84, 90)], all=[(79, 90, 86, 97)]),
}
# Walk and idle frames whose hammer hides its shaft - a front view's points at the camera, a back view's is behind the
# body with its butt out - and a swing's whose grip the trace missed draw the weapon on Daggerfall's own sword
# (TEXTURE.482, .481: the Archer, one render with the strips) instead: (grip, the head's place at the hammer's length, and
# the blade's side: f before the body, b behind it, x hidden - a back view's, behind the arm: the pommel shows where the
# butt was, as Daggerfall's back views show it - None as the art's hammer is). The grip is the fist's blade side (a front view's: the hand its fill
# leaves). The sword's own length is twice the hammer's, so the head's place is half way to its tip.
SHAFT = {
    ('male', '0-0'): (7, 66, 11.7, 58.6, 'f'), ('male', '0-1'): (6.5, 63, 9.7, 52.7, 'f'),
    ('male', '0-3'): (5, 63, 7.7, 52.7, 'f'), ('male', '2-2'): (37.5, 56.5, 11.2, 50.6, None),
    ('male', '3-0'): (46.1, 60.1, 20.3, 52.4, 'b'), ('male', '3-1'): (49.7, 57.8, 26.5, 47.9, 'b'),
    ('male', '3-2'): (59.9, 62.6, 43.5, 53.7, 'b'), ('male', '3-3'): (54.7, 58.9, 33.1, 50.5, 'b'),
    ('male', '4-0'): (51.5, 59, 38.9, 45.2, 'x'), ('male', '4-1'): (57.5, 56.5, 46.8, 41.2, 'x'),
    ('male', '4-2'): (65, 59.5, 67.1, 40.9, 'x'), ('male', '4-3'): (56.5, 57, 45.0, 42.2, 'x'),
    ('male', '15-0'): (10.5, 58.5, 18.6, 50.9, 'f'), ('male', '16-0'): (28, 54, 18.9, 44.1, 'f'),
    ('male', '18-0'): (26.9, 50.5, 8.3, 41.7, None),
    ('female', '0-0'): (50, 88, 44.2, 86.8, 'f'), ('female', '0-1'): (51, 82, 52.9, 71.3, 'f'),
    ('female', '0-2'): (52, 85, 54.1, 74.7, 'f'), ('female', '0-3'): (48.5, 84, 49.4, 74.2, 'f'), ('female', '3-0'): (87.2, 93.3, 73.1, 87.3, 'b'),
    ('female', '3-1'): (83.7, 89.4, 60.7, 80.3, 'b'), ('female', '3-2'): (64.5, 78.5, 48.3, 71.1, None),
    ('female', '3-3'): (83.4, 88.5, 63.8, 76.8, 'b'), ('female', '4-0'): (81.5, 91, 92.6, 79.9, 'x'), ('female', '4-1'): (82, 88.5, 75.0, 74.5, 'x'),
    ('female', '4-2'): (79, 90.5, 72.6, 76.2, 'x'), ('female', '4-3'): (81.5, 88.5, 77.0, 73.5, 'x'),
    ('female', '15-0'): (49, 85.5, 53, 78.3, 'f'), ('female', '16-0'): (54, 78, 47, 69.4, 'f'),
    ('female', '18-0'): (59.7, 77.7, 43.4, 69.8, None),
    ('female', '8-2'): (63, 68, 87.4, 69.4, 'b'),   # a swing's: the fist is out at the left, the hammer behind the body
}
# The free (left) hand that carries a bow in the walk and the idle - the shot's own bow hand: (x, y, in front of the
# body). Read from the bard sprites' gloves (TEXTURE.484, .483 - one render with the strips) and the hand's skin.
BOW_HAND = {
    'male': {'0-0': (64.3, 65.3, 1), '0-1': (66.0, 60.0, 1), '0-2': (68.4, 62.9, 1), '0-3': (64.4, 61.7, 1),
             '1-0': (83.3, 65.4, 1), '1-1': (76.2, 59.9, 1), '1-2': (65.4, 62.1, 1), '1-3': (77.3, 60.8, 1),
             '3-0': (13.9, 62.6, 1), '3-1': (8.9, 56.4, 1), '3-2': (9.4, 56.4, 1), '3-3': (13.8, 57.6, 1),
             '4-0': (1.7, 58.7, 0), '4-1': (4.0, 53.0, 0), '4-2': (14.0, 61.2, 0), '4-3': (3.0, 55.5, 0),
             '15-0': (53.8, 61.0, 1), '16-0': (79.7, 60.6, 1),
             '19-0': (8.2, 59.5, 0)},
    'female': {'0-0': (89.2, 90.3, 1), '0-1': (91.8, 87.1, 1), '0-2': (88.4, 91.9, 1), '0-3': (92.2, 87.3, 1),
               '1-0': (90.5, 87.5, 1), '1-1': (99.0, 87.0, 1), '1-2': (102.0, 92.0, 1), '1-3': (99.5, 86.0, 1),
               '3-0': (48.8, 88.4, 1), '3-1': (54.0, 87.6, 1), '3-3': (54.7, 87.8, 1),
               '4-0': (44.0, 91.0, 0), '4-1': (39.8, 86.8, 0), '4-2': (43.4, 91.8, 0), '4-3': (39.2, 86.2, 0),
               '15-0': (88.7, 90.5, 1), '16-0': (98.1, 90.3, 1),
               '19-0': (40.0, 89.5, 0)},
}
# LAYERED-SHIELD: a shield-bearer swings one-handed. The free arm's outline in each swing frame it shows in, read by eye
# on every chest ([(x, y), ...] each), taken out and filled at runtime (`sa`); a view plays only the frames whose sword
# arm swings on its own side (layeredShield.js SHIELD_CUTS). From aside, the far hand where it shows behind the back: the
# shield is before the body there.
SHIELD_ARM = {
    ('male', '5-0'): [[(54.5, 30.5), (56, 26), (59.5, 25.5), (62, 29), (66, 35), (70, 41), (73, 44.5), (84, 46), (93, 48.5), (94, 53.5), (78, 54), (68, 53), (63, 48), (60, 43), (57, 37)]],
    ('male', '5-1'): [[(55, 36), (60, 34.5), (64, 38), (68, 43), (72, 47.5), (81, 46.5), (85, 45.8), (90, 46.5), (93, 48.5), (94, 50), (95, 57), (80, 57.5), (72, 56), (66, 52), (62, 47), (58, 42)]],
    ('male', '5-2'): [[(99, 57), (99, 66), (90, 67.5), (81, 70.5), (73, 74), (62, 75), (51, 74.5), (50, 70.5), (57, 69.5), (63, 67), (70, 66), (78, 64.5), (85, 62), (88, 58)]],
    ('male', '6-0'): [[(52, 24.5), (60, 24.5), (60.5, 29), (62.5, 34), (65.5, 39.5), (68.5, 44), (80, 45.5), (83, 47.5), (82, 51.5), (72, 51.5), (66, 50), (62, 45.5), (58.5, 41), (55, 36), (51.5, 31)]],
    ('male', '6-1'): [[(52, 32), (56, 33), (60, 37), (64, 41.5), (68, 45), (78, 45.5), (88, 47), (89, 53), (75, 53.5), (66, 51), (61, 47), (56, 43), (51.5, 39.5), (50, 36)]],
    ('male', '6-2'): [[(97, 53), (97, 63.5), (76, 64.2), (60, 64.2), (47, 65), (40, 67.5), (33, 66.5), (33, 61), (41, 59), (50, 56.5), (60, 56), (76, 55.5), (86, 54)]],
    ('male', '6-3'): [[(97, 62), (97, 70), (89, 78), (81, 88), (79, 93), (69, 93), (69, 86), (77, 78), (85, 67), (91, 62)]],
    ('male', '7-3'): [[(57, 60.5), (64.5, 59.5), (67.5, 63), (64.5, 70.5), (59, 75.5), (53, 80), (50, 85.5), (44, 85), (41.5, 81), (45.5, 76.5), (51.5, 71.5), (55.5, 65.5)]],
    ('male', '2-2'): [[(68, 61.5), (76, 61.5), (76, 68.5), (68, 68.5)]],
    ('male', '17-0'): [[(67, 56), (77, 55), (81.5, 58), (81.5, 66), (80, 72), (75, 73), (70, 72), (66, 66)]],
    ('female', '2-0'): [[(97, 94), (106, 94), (106, 100), (97, 100)]],
    ('female', '17-0'): [[(87, 85), (95, 84), (99.5, 88), (100.5, 95), (97.5, 102), (91, 102), (87, 96)]],
    ('female', '5-0'): [[(64.5, 31.5), (68, 28), (71, 30), (75, 35), (79, 40), (81, 43.5), (90, 44), (96, 44), (102.5, 44.5), (102.5, 52), (95, 52), (94.5, 51), (85, 51.5), (79, 49), (75, 46.5), (70, 42), (66, 37.5)]],
    ('female', '5-1'): [[(58, 34), (61, 32.5), (67, 33), (69, 37), (72, 40), (78, 43), (85, 45), (95, 45.5), (104, 46), (104, 53), (96, 53), (95, 51), (85, 51), (79, 49), (73, 47), (66, 44.5), (61, 41), (57.5, 38)]],
    ('female', '5-2'): [[(64, 59.5), (72, 57.5), (82, 55.5), (88, 53.8), (100, 54.6), (102, 56), (102, 58.5), (94, 60), (85, 62.5), (76, 64.5), (68, 64.5), (64, 63.5)]],
    ('female', '6-0'): [[(53, 32), (55, 30.5), (57.5, 33), (59.5, 37), (61.5, 41), (64, 43.5), (72, 44), (76, 46.5), (75, 50), (65, 50.5), (60, 48), (57, 44.5), (55, 40), (53.5, 36)]],
    ('female', '6-1'): [[(47, 38), (51, 37.5), (55, 40.5), (59, 44), (63, 46.5), (72, 47), (75, 49.5), (73, 53), (62, 53), (57, 50.5), (53, 47), (49, 43.5), (46.5, 41)]],
    ('female', '6-2'): [[(38, 61), (45, 58.6), (55, 56.4), (65, 55.8), (74, 56), (74, 59.5), (73, 61), (65, 62), (55, 63.5), (45, 65), (39, 66)]],
    ('female', '6-3'): [[(68, 70), (74, 66), (80, 63.5), (82, 68), (78, 74), (73, 80), (66, 85), (61.5, 85), (62, 80)]],
    ('female', '7-3'): [[(57.5, 85.5), (61.5, 81.5), (65.5, 78.5), (69.5, 75.5), (73.5, 71.5), (80, 67.5), (84.5, 69.5), (80.5, 75.5), (74.5, 80.5), (68.5, 85.5), (64.5, 90.5), (60, 93.5), (55.5, 91.5)]],
}
# The idle's free arm, which a front swing takes back (`sp`): its outline from under the shoulder to the hand.
SHIELD_ARM_OF_IDLE = {
    ('male', '15-0'): [[(46.5, 24), (53, 22.5), (55.5, 30), (57, 40), (57.5, 50), (57.5, 58), (57, 66), (55, 69.5), (51.5, 69.5), (50.5, 60), (48.5, 52), (47, 44), (45.5, 34)]],
    ('male', '16-0'): [[(71.5, 24), (78, 21.5), (80.5, 30), (81.5, 42), (83.5, 52), (84.5, 62), (83, 68.5), (77, 69), (75, 60), (74, 50), (72.5, 40), (71, 32)]],
    ('female', '15-0'): [[(82, 62.5), (87.5, 60), (89.5, 70), (88.5, 80), (90.5, 88), (90.5, 97), (86.5, 97.5), (85, 90), (83, 80), (81, 70)]],
    ('female', '16-0'): [[(89, 64.5), (95.5, 61), (97.5, 70), (97.5, 80), (99.5, 88), (100.5, 97.5), (95, 99.5), (92, 92), (91, 82), (89, 72)]],
}
# The idle's shoulder over that arm (`ss`: the pauldron, or the hood's fall, and the arm under it), laid back where the
# swing raised its own.
SHIELD_SHOULDER_OF_IDLE = {
    ('male', '15-0'): [[(42.5, 14.5), (47, 14.5), (51, 15.5), (53.5, 18.5), (53.5, 23), (46.5, 24), (42.5, 23.5)]],
    ('female', '15-0'): [[(76.5, 48.5), (82, 48.5), (88.5, 49.5), (89.5, 51.5), (88, 54), (86.5, 56), (86.5, 62.2), (82, 62.5), (79.5, 62), (79.5, 56), (76.5, 56)]],
}
# From before, the swing's free arm comes out and the idle's goes back in its place, the shield in its hand (`sg`): the
# idle, and the shift its arm hangs from this frame's shoulder by (the idle's px less this frame's); a fourth entry 1 lays
# the idle's shoulder too (`ss`), where the swing's own went up with the arm and out with it. The shield's grip follows
# the arm. The hole the swing's arm leaves is filled from the frame's own body (arm_sources, the hammer's inpaint).
SHIELD_GRAFT = {
    ('male', '5-0'): ('15-0', -38, -28), ('male', '5-1'): ('15-0', -39, -30, 1), ('male', '5-2'): ('15-0', -48, -35),
    ('male', '6-0'): ('16-0', -11, -24), ('male', '6-1'): ('16-0', -11, -25), ('male', '6-2'): ('16-0', -17, -31),
    ('male', '6-3'): ('16-0', -24, -37),
    ('female', '5-0'): ('15-0', -8, 5, 1), ('female', '5-1'): ('15-0', -9, 4, 1), ('female', '5-2'): ('15-0', -14, 1),
    ('female', '6-0'): ('16-0', 12, 10), ('female', '6-1'): ('16-0', 12, 8), ('female', '6-2'): ('16-0', 9, 3),
    ('female', '6-3'): ('16-0', 4, -1),
}
SHIELD_ARM_FRAMES = {b: [rf for (bb, rf) in SHIELD_ARM if bb == b] for b in ('male', 'female')}
# Where the shield's grip goes (`sh`): the free hand where BOW_HAND has it, or the grafted arm's; else read by eye - from
# aside before the waist as the side walk holds it (the far arm's, behind the body), from behind at the body's left edge,
# the hand flung out in a flinch. A third entry is the width share where the frame turns it otherwise.
SHIELD_GRIP = {
    'male': {'2-0': (45, 58), '2-1': (44, 56), '2-2': (43, 57), '2-3': (44, 56), '17-0': (49, 58), '18-0': (26, 62),
             '10-0': (100, 64), '11-0': (62, 62), '12-0': (40, 66), '13-0': (14, 67), '14-0': (16, 65),
             '7-0': (69, 69), '7-1': (68, 68), '7-2': (68, 72), '7-3': (60, 79), '7-4': (64, 74), '7-5': (68, 69),
             '8-0': (55, 64), '8-1': (55, 64), '8-2': (50, 64), '9-0': (40, 64), '9-1': (40, 64), '9-2': (38, 66)},
    'female': {'2-0': (71, 86), '2-1': (72, 84), '2-2': (71, 86), '2-3': (72, 84), '17-0': (69, 82), '18-0': (62, 90),
               '3-2': (60, 92), '10-0': (98, 66), '11-0': (88, 58), '12-0': (48, 66), '13-0': (24, 63), '14-0': (28, 62),
               '7-0': (72, 84), '7-1': (71, 84), '7-2': (72, 86), '7-3': (67, 90), '7-4': (71, 88), '7-5': (72, 86),
               '8-0': (66, 78), '8-1': (66, 78), '8-2': (61, 80), '9-0': (38, 80), '9-1': (37, 80), '9-2': (34, 80)},
}
# The bow is in the left hand. Where the art hides the free hand and holds the hammer in the near one - the side views -
# the near hand is the left: the bow is there. The back-3/4 idle and the female's 3-2 press that hand flat to the body
# in profile, where a bow lies across the arm: the body hides it, and none is drawn, flipped or not (the owner,
# 2026-10-30: "Bow is wonky on these frames still").
BOW_NEAR = {(b, rf) for b in ('male', 'female') for rf in ('2-0', '2-1', '2-2', '2-3', '17-0')}
# Records 1-3 and 16-18 are also drawn flipped (eotbBillboard.js MIRRORED), and the flip swaps the hands: there the left
# hand is the art's other one, the hammer's fist, on the far side - the bow at that fist (`bowM`), behind the body, which
# may hide it (the owner, 2026-10-30: "Its okay if the body hides it"), turned to that hand's side.
# LAYERED-DUAL: a pair's second weapon is in the free hand where the art draws it. Where both fists hold the haft (a
# swing, a flinch) or the body hides the free hand (aside), the hand that holds it is not in the art, so neither is it:
# fanned off the first fist it read as two blades in one hand, and behind the body it stuck out past the head (the owner,
# 2026-10-31, of the sheets: "Fix all the minor issues and the attached innormalities").
# The body's own bow (the loose's art, records 20-24), tip to tip, px: the long bow; the short bow is three quarters.
BOW_PX = {'male': 75, 'female': 78}
# Front views whose hole is the body's other side, mirrored: the fill copies it, alpha and all.
MIRROR = {('male', '0-0'), ('male', '0-1'), ('male', '0-3'), ('male', '15-0')} | {('female', f'0-{i}') for i in range(4)} | {('female', '15-0')}


def combos(body): return sorted(os.listdir(f'{V}/{body}'))
def strip_base(body, combo, rf):
    S = np.array(Image.open(f'{V}/{body}/{combo}/{rf}.png').convert('RGBA'))
    w = S.shape[1] // NT if MAN[body]['outfits'][combo]['plate'] else S.shape[1]
    return S[:, :w]
def hsv(img):
    c = img[..., :3].astype(np.float32) / 255; mx = c.max(-1); mn = c.min(-1)
    return np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0), mx
def skin(L):
    c = L[..., :3].astype(np.float32) / 255; r, g, b = c[..., 0], c[..., 1], c[..., 2]
    mx = c.max(-1); mn = c.min(-1); d = mx - mn
    h = np.where(mx == r, (60 * (g - b) / np.maximum(d, 1e-6)) % 360, 0)
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    return (L[..., 3] > 0) & (mx == r) & (h >= 12) & (h <= 45) & (s >= 0.3) & (mx >= 0.45)
def stable(body, rf, fam, tol=45):
    """Px the family's nine outfits draw alike (summed RGB within tol), and the family's leather-helmet-and-legs picture."""
    cs = [c for c in combos(body) if c.split('_')[1] == fam]
    st = np.stack([strip_base(body, c, rf) for c in cs]); ref = strip_base(body, f'leather_{fam}_leather', rf)
    d = np.abs(st[..., :3].astype(np.int32) - ref[None, ..., :3].astype(np.int32)).sum(-1)
    return ((d <= tol) & (st[..., 3] > 0)).all(axis=0), ref, st
def head_guess(body, rf):
    """The hammer's head when no HEADS entry names it: the thickest grey blob all 27 outfits draw alike."""
    cs = combos(body); st = np.stack([strip_base(body, c, rf) for c in cs]); ref = st[cs.index('leather_leather_leather')]
    d = np.abs(st[..., :3].astype(np.int32) - ref[None, ..., :3].astype(np.int32)).sum(-1)
    agree = ((d <= 45) & (st[..., 3] > 0) & (ref[None, ..., 3] > 0)).mean(axis=0)
    s, v = hsv(ref)
    cand = (agree >= 0.8) & (s < 0.3) & (ref[..., 3] > 0)
    g = nd.binary_closing(cand & (s < 0.2) & (v >= 0.12), K8, iterations=1) & cand
    lab, k = nd.label(g, structure=K8)
    sizes = nd.sum(g, lab, range(1, k + 1)); thick = nd.maximum(nd.distance_transform_edt(g), lab, range(1, k + 1))
    i = int(np.argmax(sizes * np.minimum(thick, 4))) + 1
    ys, xs = np.nonzero(lab == i)
    return float(xs.mean()), float(ys.mean())


def trace(body, rf, fam, cap=16):
    gx, gy = GRIPS[body][rf][:2]; fixed = len(GRIPS[body][rf]) > 2
    tx, ty = HEADS[body].get(rf) or head_guess(body, rf)
    stab, L, st = stable(body, rf, fam); H, W = L.shape[:2]; opq = L[..., 3] > 0; sk = skin(L)
    s, _ = hsv(L)
    grey = stab & (s < 0.3) & opq & ~sk
    yy, xx = np.mgrid[0:H, 0:W]
    near = (xx - tx) ** 2 + (yy - ty) ** 2 <= cap ** 2
    lab, _ = nd.label(grey & near, structure=K8)
    cy, cx = np.nonzero(grey & near)
    j = np.argmin((cx - tx) ** 2 + (cy - ty) ** 2); head = lab == lab[cy[j], cx[j]]
    hy, hx = np.nonzero(head); T = (hx.mean(), hy.mean())
    # the shaft: near the grip->head line, the line through the most grey px
    a0 = math.atan2(T[1] - gy, T[0] - gx); D = math.hypot(T[0] - gx, T[1] - gy)
    ys, xs = np.nonzero(grey & ~head); xs = xs.astype(float); ys = ys.astype(float)
    best = (0.0, a0, 0.0)
    for da in np.arange(-25, 25.5, 1.0):
        a = a0 + math.radians(da); ux, uy = math.cos(a), math.sin(a); nx, ny = -uy, ux
        for o in np.arange(-3, 3.5, 0.5):
            px, py = gx + nx * o, gy + ny * o
            t = (xs - px) * ux + (ys - py) * uy; e = np.abs((xs - px) * nx + (ys - py) * ny)
            sc = int(((e <= 0.75) & (t > -2) & (t < D)).sum()) - abs(da) * 0.12 - abs(o) * 0.3
            if sc > best[0]: best = (sc, a, o)
    sc, a, o = best
    if sc < 4: a, o = a0, 0.0
    ux, uy = math.cos(a), math.sin(a); nx, ny = -uy, ux
    px, py = gx + nx * o, gy + ny * o
    shaft = stab & ~sk
    Q = 0.0
    for tt in np.arange(6, -10, -0.5) if not fixed else ():   # walking from the head side: where the shaft meets the fist
        ix, iy = int(round(px + ux * tt)), int(round(py + uy * tt)); jx, jy = int(round(px + ux * (tt - 0.5))), int(round(py + uy * (tt - 0.5)))
        if not (0 <= ix < W and 0 <= iy < H and 0 <= jx < W and 0 <= jy < H): continue
        if shaft[iy, ix] and not shaft[jy, jx] and opq[jy, jx]: Q = tt - 0.5; break
    t = (xx - px) * ux + (yy - py) * uy; e = np.abs((xx - px) * nx + (yy - py) * ny)
    corridor = (e <= 2.1) & (t >= Q - 16) & (t <= D + 2)
    wood = stab & (e <= 1.6) & (t > Q + 1) & (t <= D)
    butt = grey & (e <= 3.2) & (t < Q - 3) & (t >= Q - 16)
    hr = float(np.hypot(hx - T[0], hy - T[1]).max())
    disc = (xx - T[0]) ** 2 + (yy - T[1]) ** 2 <= min(hr + 1.5, cap) ** 2
    pick = grey | wood
    lab2, k2 = nd.label(pick & (disc | corridor | butt), structure=K8)
    core = head | ((e <= 1.0) & (t >= Q - 16) & (t <= D)) | butt
    m = np.zeros((H, W), bool)
    for i in range(1, k2 + 1):
        p = lab2 == i
        if (p & core).any(): m |= p
    edge_ok = stab & ~sk & (((t > Q + 1) & (e <= 3.2)) | disc)   # the hammer's own shaded edge
    for _ in range(2): m |= nd.binary_dilation(m, K8, 1) & edge_ok
    m &= ~((t >= Q - 6) & (t <= Q + 0.5) & (e <= 3.5))            # the fist round the grip is never the weapon
    m |= stab & ~sk & (t > Q + 0.5) & (t <= Q + 4) & (e <= 1.3)   # and the shaft just out of it always is
    for ex in EXTRA.get((body, rf), []):   # a segment (x0, y0, x1, y1, half-width), or a box (x0, y0, x1, y1)
        sx0, sy0, sx1, sy1 = ex[:4]
        if len(ex) == 4: m |= opq & ~sk & (xx >= sx0) & (xx <= sx1) & (yy >= sy0) & (yy <= sy1); continue
        vx, vy = sx1 - sx0, sy1 - sy0; ln = math.hypot(vx, vy); vx, vy = vx / ln, vy / ln
        tt = (xx - sx0) * vx + (yy - sy0) * vy; ee = np.abs((xx - sx0) * -vy + (yy - sy0) * vx)
        m |= opq & ~sk & (tt >= -1) & (tt <= ln + 1) & (ee <= ex[4])
    for x0, y0, x1, y1 in STEADY.get((body, rf), []): m |= stab & ~sk & (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)
    for x0, y0, x1, y1 in CUT.get((body, rf), []): m &= ~((xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1))
    rest = opq & ~m                                               # a piece left floating is the hammer's too
    lab3, k3 = nd.label(rest, structure=K8)
    if k3 > 1:
        sizes = nd.sum(rest, lab3, range(1, k3 + 1)); big = int(np.argmax(sizes)) + 1
        for i in range(1, k3 + 1):
            if i != big and sizes[i - 1] <= 30 and (nd.binary_dilation(m, K8, 3) & (lab3 == i)).any(): m |= lab3 == i
    # each outfit cleaned the head's rim on its own (a plate helmet's frames draw it a px wider, with gaps): the head's
    # px take two more round them, and the holes inside it
    anyop = (st[..., 3] > 0).any(axis=0)
    for _ in range(2): m |= nd.binary_dilation(m, K8, 1) & disc & anyop & ~sk
    m |= nd.binary_fill_holes(m) & disc
    q = (px + ux * Q, py + uy * Q)
    # the face: the head reaches further on the spike's side
    vv = (hx - T[0]) * nx + (hy - T[1]) * ny
    side = 1 if abs(vv.min()) >= abs(vv.max()) else -1
    return dict(m=m, L=L, st=st, q=q, t=T, hr=hr, side=side)


def hand(body, rf, fam):
    """A HAND frame's hammer: its boxes over the family's reference picture."""
    h = HAND[(body, rf)]
    _, L, st = stable(body, rf, fam); H, W = L.shape[:2]; opq = L[..., 3] > 0; sk = skin(L); s, v = hsv(L)
    yy, xx = np.mgrid[0:H, 0:W]
    def boxes(bs, ox=0, oy=0):
        b = np.zeros((H, W), bool)
        for x0, y0, x1, y1 in bs: b |= (xx >= x0 + ox) & (xx <= x1 + ox) & (yy >= y0 + oy) & (yy <= y1 + oy)
        return b
    # the boxes are read on the leather chest's picture: another family's hammer can sit a px or two off it
    R0 = strip_base(body, 'leather_leather_leather', rf); at = np.nonzero(boxes(h['all'] or h['lit']) & (R0[..., 3] > 0))
    best = (float('inf'), 0, 0)
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            Y, X = np.clip(at[0] + dy, 0, H - 1), np.clip(at[1] + dx, 0, W - 1)
            c = (np.abs(L[Y, X, :3].astype(np.int32) - R0[at][:, :3].astype(np.int32)).sum(-1) + 765 * (L[Y, X, 3] == 0)).mean()
            c += 2 * (abs(dx) + abs(dy))
            if c < best[0]: best = (c, dx, dy)
    _, ox, oy = best
    head = opq & ~sk & boxes(h['all'], ox, oy)
    for x0, y0, x1, y1, hw in h.get('seg', []):
        x0, y0, x1, y1 = x0 + ox, y0 + oy, x1 + ox, y1 + oy
        vx, vy = x1 - x0, y1 - y0; ln = math.hypot(vx, vy); vx, vy = vx / ln, vy / ln
        tt = (xx - x0) * vx + (yy - y0) * vy; head |= opq & ~sk & (tt >= 0) & (tt <= ln) & (np.abs((xx - x0) * -vy + (yy - y0) * vx) <= hw)
    # in a walk, a lit px is the hammer's only where the leather chest draws it too (a px either way): a plate or chain
    # sleeve is not (an attack's hammer passes before the helmet, which each outfit draws its own way)
    same = np.ones((H, W), bool)
    for f in FAMS[:1] if int(rf.split('-')[0]) <= 4 else ():
        R = strip_base(body, f'leather_{f}_leather', rf); near = np.zeros((H, W), bool)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                Rs = np.roll(R, (dy, dx), (0, 1))
                near |= (np.abs(L[..., :3].astype(np.int32) - Rs[..., :3].astype(np.int32)).sum(-1) <= 45) & (Rs[..., 3] > 0)
        same &= near
    m = head | (opq & ~sk & same & boxes(h['lit'], ox, oy) & (s < 0.3) & (v >= 0.2))
    lab, k = nd.label(opq & ~m, structure=K8)                    # a speck the hammer leaves floating is its own
    if k > 1:
        sizes = nd.sum(opq & ~m, lab, range(1, k + 1)); big = int(np.argmax(sizes)) + 1
        for i in range(1, k + 1):
            if i != big and sizes[i - 1] <= 6 and (nd.binary_dilation(m, K8, 1) & (lab == i)).any(): m |= lab == i
    (qx, qy), T = (h['q'][0] + ox, h['q'][1] + oy), (h['t'][0] + ox, h['t'][1] + oy)
    hy, hx = np.nonzero(m & ((xx - T[0]) ** 2 + (yy - T[1]) ** 2 <= 144)); hr = float(np.hypot(hx - T[0], hy - T[1]).max()) if len(hx) else 2.0
    D = math.hypot(T[0] - qx, T[1] - qy) or 1.0; nx, ny = -(T[1] - qy) / D, (T[0] - qx) / D
    vv = (hx - T[0]) * nx + (hy - T[1]) * ny
    side = 1 if not len(vv) or abs(vv.min()) >= abs(vv.max()) else -1
    if ox or oy: print(' ', body, rf, fam, 'offset', ox, oy)
    return dict(m=m, L=L, st=st, q=(float(qx), float(qy)), t=(float(T[0]), float(T[1])), hr=hr, side=side)


def body_side(img, m):
    """Which mask px the body was behind (nearest outside px opaque, most of them at the edge) - the runtime's own rule
    (layeredWeapon.js)."""
    H, W = m.shape; src = -np.ones((H, W), np.int8); q = deque()
    for y, x in zip(*np.nonzero(m)):
        body = air = 0
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                Y, X = y + dy, x + dx
                if 0 <= Y < H and 0 <= X < W and not m[Y, X]:
                    if img[Y, X, 3]: body += 1
                    else: air += 1
        if body + air: src[y, x] = 1 if body > air else 0; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            Y, X = y + dy, x + dx
            if 0 <= Y < H and 0 <= X < W and m[Y, X] and src[Y, X] < 0: src[Y, X] = src[y, x]; q.append((Y, X))
    return m & (src == 1)
def exemplar(imgs, m, R=16, worst=220, mirror=False):
    """The copy that best continues the body round the hole, over the family's outfits: [0, dx, dy] a shift - or 0 when
    none continues it well enough (the runtime then smooths the hole). `mirror` (MIRROR's front views): [1, c, dy], the
    body's other side about x = c, whatever it costs."""
    H, W = m.shape
    bp = body_side(imgs[0], m)
    if bp.sum() < 6 and not mirror: return 0
    if mirror: bp = m
    ring = nd.binary_dilation(bp, K8, 2) & ~m
    ys, xs = np.nonzero(ring); hy, hx = np.nonzero(bp)
    opq = [im[..., 3] > 0 for im in imgs]
    cx0 = int(np.nonzero(opq[0])[1].mean())
    cands = [] if mirror else [(0, dx, dy) for dx in range(-R, R + 1) for dy in range(-R, R + 1) if abs(dx) + abs(dy) >= 3]
    if mirror: cands = [(1, c, dy) for c in range(cx0 - 12, cx0 + 13) for dy in range(-4, 5)]
    best = None
    for mode, a, dy in cands:
        if mode == 0: sx, sy, tx, ty = xs + a, ys + dy, hx + a, hy + dy
        else: sx, sy, tx, ty = 2 * a - xs, ys + dy, 2 * a - hx, hy + dy
        okr = (sx >= 0) & (sx < W) & (sy >= 0) & (sy < H)
        inside = (tx >= 0) & (tx < W) & (ty >= 0) & (ty < H)
        if not mirror and (not inside.all() or m[ty, tx].any()): continue
        if mirror and (inside.mean() < 0.6 or m[ty[inside], tx[inside]].mean() > 0.25): continue
        cost = 0.0; bad = 0
        for im, o in zip(imgs, opq):
            if not mirror: bad += int((~o[ty, tx]).sum())
            d = np.abs(im[ys[okr], xs[okr], :3].astype(np.int32) - im[sy[okr], sx[okr], :3].astype(np.int32)).sum(-1)
            cost += d.mean() + 400 * (1 - okr.mean())
        cost = cost / len(imgs) + bad * 6
        if best is None or cost < best[0]: best = (cost, mode, a, dy)
    return [best[1], best[2], best[3]] if best and (mirror or best[0] <= worst) else 0
def inpaint(imgs, m, bp, R=11, P=2):
    """Each body px of the hole, the px to copy it from (dx, dy): from the hole's edge in, the source whose neighbourhood
    best matches what is known round it over the family's outfits - a neighbour's own source kept where it is nearly as
    good, so a patch carries on whole. Only a px every outfit draws, off the hole, is a source."""
    H, W = m.shape
    A = np.stack([im[..., :3].astype(np.float32) for im in imgs])
    src_ok = np.all([im[..., 3] > 0 for im in imgs], axis=0) & ~m
    known = src_ok.copy(); C = A.copy()
    off = np.zeros((H, W, 2), np.int16); has = np.zeros((H, W), bool)
    cy, cx = np.mgrid[-R:R + 1, -R:R + 1]; cdx, cdy = cx.ravel(), cy.ravel(); keep = (cdx != 0) | (cdy != 0); cdx, cdy = cdx[keep], cdy[keep]
    wy, wx = np.mgrid[-P:P + 1, -P:P + 1]; wy, wx = wy.ravel(), wx.ravel()
    dist = nd.distance_transform_cdt(m, metric='chessboard')
    order = sorted(zip(*np.nonzero(bp)), key=lambda p: (dist[p], p))
    for y, x in order:
        sx, sy = x + cdx, y + cdy
        ci = np.nonzero((sx >= 0) & (sx < W) & (sy >= 0) & (sy < H))[0]
        ci = ci[src_ok[sy[ci], sx[ci]]]
        if not len(ci): continue
        ys, xs = y + wy, x + wx; inb = (ys >= 0) & (ys < H) & (xs >= 0) & (xs < W); ys, xs = ys[inb], xs[inb]
        kn = known[ys, xs]; ys, xs = ys[kn], xs[kn]
        if len(ys):
            WY, WX = ys[None, :] + cdy[ci, None], xs[None, :] + cdx[ci, None]
            ok = (WY >= 0) & (WY < H) & (WX >= 0) & (WX < W); WY, WX = np.clip(WY, 0, H - 1), np.clip(WX, 0, W - 1)
            ok &= src_ok[WY, WX]
            d = np.abs(C[:, ys, xs][:, None, :, :] - A[:, WY, WX]).sum(-1).mean(0)
            cost = np.where(ok, d, 240.0).mean(1)
        else:
            cost = np.abs(cdx[ci]) + np.abs(cdy[ci]) + 0.0
        for dy in (-1, 0, 1):                                    # a neighbour's source, nearly as good, carries on
            for dx in (-1, 0, 1):
                Y, X = y + dy, x + dx
                if 0 <= Y < H and 0 <= X < W and has[Y, X]:
                    k = np.nonzero((cdx[ci] == off[Y, X, 0]) & (cdy[ci] == off[Y, X, 1]))[0]
                    cost[k] *= 0.85
        b = ci[int(np.argmin(cost))]
        off[y, x] = (cdx[b], cdy[b]); has[y, x] = True; known[y, x] = True; C[:, y, x] = A[:, y + cdy[b], x + cdx[b]]
    return off, has



def poly_mask(shape, polys):
    """The px whose middles lie inside any of the outlines (even-odd), as the runtime's (layeredShield.js outlineMask)."""
    H, W = shape; yy, xx = np.mgrid[0:H, 0:W]; px, py = xx + 0.5, yy + 0.5; m = np.zeros((H, W), bool)
    for P in polys:
        c = np.zeros((H, W), bool)
        for i in range(len(P)):
            (xi, yi), (xj, yj) = P[i], P[i - 1]
            if yi == yj: continue
            c ^= ((yi > py) != (yj > py)) & (px < (xj - xi) * (py - yi) / (yj - yi) + xi)
        m |= c
    return m
def arm_sources(body, rf):
    """LAYERED-SHIELD: the hole the free arm leaves (SHIELD_ARM), each body px's own source in the frame (inpaint over
    the family's outfits, the hammer's hole no source), as the weapon strip's tiles: (dx, dy) + 128, blue 255."""
    tiles = []; ham_all = np.array(Image.open(f'{V}/weapon/{body}/{rf}.png').convert('RGBA')); tw = ham_all.shape[1] // len(FAMS)
    for k, fam in enumerate(FAMS):
        _, L, st = stable(body, rf, fam); imgs = [st[i] for i in range(st.shape[0])]
        ham = ham_all[:, k * tw:(k + 1) * tw, 3] > 0
        arm = poly_mask(ham.shape, SHIELD_ARM[(body, rf)]) & np.any([im[..., 3] > 0 for im in imgs], axis=0)
        off, has = inpaint(imgs, arm | ham, body_side(L, arm) & ~ham)
        tile = np.zeros(ham.shape + (4,), np.uint8)
        tile[has, 0] = off[has, 0] + 128; tile[has, 1] = off[has, 1] + 128; tile[has, 2] = 255; tile[has, 3] = 255
        tiles.append(tile)
    return np.concatenate(tiles, axis=1)


def depth(g, lo=LO, hi=HI):
    (qx, qy), (tx, ty), m, L = g['q'], g['t'], g['m'], g['L']; H, W = m.shape
    D = math.hypot(tx - qx, ty - qy) or 1.0; ux, uy = (tx - qx) / D, (ty - qy) / D; nx, ny = -uy, ux
    out = []
    for t in range(lo, hi + 1):
        k = '?'
        for s in (0, -1, 1):
            x, y = int(round(qx + ux * t + nx * s)), int(round(qy + uy * t + ny * s))
            if 0 <= x < W and 0 <= y < H:
                if m[y, x]: k = 'f'; break
                if L[y, x, 3] and k == '?': k = 'b'
        out.append(k)
    return ''.join(out)


def ramps():
    """Each plate metal's colours by brightness, 16 steps: the mean colour of the strips' metal px in each band."""
    out = {}
    sample = [c for c in combos('male') if c.startswith('plate_plate')][:1] + [c for c in combos('female') if c.startswith('plate_plate')][:1]
    for metal in MAN['metals']:
        tile = 2 + MAN['metals'].index(metal); px = []
        for body, combo in (('male', sample[0]), ('female', sample[1])):
            for rf in ('2-0', '7-2', '15-0', '0-1'):
                S = np.array(Image.open(f'{V}/{body}/{combo}/{rf}.png').convert('RGBA')); w = S.shape[1] // NT
                T = S[:, tile * w:(tile + 1) * w]; px.append(T[T[..., 3] > 0][:, :3])
        px = np.concatenate(px).astype(np.float32)
        lum = px @ np.array([0.299, 0.587, 0.114], np.float32)
        lo, hi = np.percentile(lum, 2), np.percentile(lum, 98)
        steps = []
        for i in range(16):
            a = lo + (hi - lo) * i / 16; b = lo + (hi - lo) * (i + 1) / 16
            sel = px[(lum >= a) & (lum <= b)]
            steps.append([int(round(v)) for v in (sel.mean(0) if len(sel) else (steps[-1] if steps else [a, a, a]))])
        out[metal] = steps
    return out


def main(only=None):
    """Every frame, or (`only`: ['male:0-0', ...]) those alone, the rest kept from the manifest on disk."""
    os.makedirs(f'{V}/weapon/male', exist_ok=True); os.makedirs(f'{V}/weapon/female', exist_ok=True)
    had = json.load(open(f'{V}/weapon/manifest.json')) if only else None
    rig = {'span': [LO, HI], 'families': list(FAMS), 'ramps': ramps()}
    for body in ('male', 'female'):
        frames = {}; lengths = []
        for rf in sorted(GRIPS[body], key=lambda k: tuple(map(int, k.split('-')))):
            if only and f'{body}:{rf}' not in only:
                frames[rf] = had[body]['frames'][rf]
                lengths += [math.hypot(p['t'][0] - p['q'][0], p['t'][1] - p['q'][1]) for p in frames[rf]]
                continue
            per = []; tiles = []
            for fam in FAMS:
                g = hand(body, rf, fam) if (body, rf) in HAND else trace(body, rf, fam)
                fam_imgs = [g['st'][i] for i in range(g['st'].shape[0])]
                per.append({'q': [round(g['q'][0], 1), round(g['q'][1], 1)], 't': [round(g['t'][0], 1), round(g['t'][1], 1)],
                            'hr': round(g['hr'], 1), 'side': g['side'], 'd': depth(g), 'fill': exemplar(fam_imgs, g['m'], mirror=(body, rf) in MIRROR)})
                lengths.append(math.hypot(g['t'][0] - g['q'][0], g['t'][1] - g['q'][1]))
                tile = np.zeros(g['m'].shape + (4,), np.uint8); tile[g['m']] = (128, 128, 0, 255)
                yy, xx = np.mgrid[0:g['m'].shape[0], 0:g['m'].shape[1]]; air = np.zeros(g['m'].shape, bool)
                for x0, y0, x1, y1 in AIR.get((body, rf), []): air |= (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)
                air &= g['m']
                if (body, rf) not in MIRROR:   # the px each body px of the hole copies: (dx, dy) + 128, and 255 where one is
                    off, has = inpaint(fam_imgs, g['m'], body_side(g['L'], g['m']) & ~air)
                    tile[has, 0] = off[has, 0] + 128; tile[has, 1] = off[has, 1] + 128; tile[has, 2] = 255
                tile[air, 2] = 64
                tiles.append(tile)
            Image.fromarray(np.concatenate(tiles, axis=1)).save(f'{V}/weapon/{body}/{rf}.png', optimize=True)
            frames[rf] = per
            print(body, rf, [p['fill'] for p in per])
        ln = round(float(np.percentile(lengths, 95)), 1)
        for rf, per in frames.items():   # Daggerfall's sword, where the hammer hides its shaft
            for fam, p in zip(FAMS, per):
                p.pop('carry', None); p.pop('hang', None); p.pop('w', None)
                if (body, rf) not in SHAFT: continue
                gx, gy, ex, ey, blade = SHAFT[(body, rf)]
                ox, oy = (p['q'][0] - HAND[(body, rf)]['q'][0], p['q'][1] - HAND[(body, rf)]['q'][1]) if (body, rf) in HAND else (0, 0)
                p['w'] = [round(gx + ox, 1), round(gy + oy, 1), round(ex + ox, 1), round(ey + oy, 1)]
                tiles = np.array(Image.open(f'{V}/weapon/{body}/{rf}.png').convert('RGBA')); tw = tiles.shape[1] // len(FAMS)
                m = tiles[:, FAMS.index(fam) * tw:(FAMS.index(fam) + 1) * tw, 3] > 0
                d = depth({'q': p['w'][:2], 't': p['w'][2:], 'm': m, 'L': stable(body, rf, fam)[1]})
                d = d[:-LO - 3] + 'b' * 3 + d[-LO:]   # the fist closes over the handle
                p['d'] = d if blade is None else d[:-LO] + blade * (HI + 1)
        for rf, per in frames.items():   # the bow's hand, where a frame carries one
            for p in per:
                p.pop('bow', None); p.pop('bowM', None)
                if rf in BOW_HAND[body]: p['bow'] = list(BOW_HAND[body][rf])
                gx, gy, ex, ey = p.get('w') or (p['q'] + p['t']); D = math.hypot(ex - gx, ey - gy) or 1.0
                fist = [round(gx - 2 * (ex - gx) / D, 1), round(gy - 2 * (ey - gy) / D, 1)]   # the fist, half its width back from the grip
                if (body, rf) in BOW_NEAR: p['bow'] = fist + [1]
                rec = int(rf.split('-')[0])
                if rec in (1, 2, 3, 16, 17, 18) and 'bow' in p: p['bowM'] = fist + [0, -1]
                if 10 <= rec <= 14:   # a flinch: the art's free hand is flung out of reach - the bow in the hammer's fist
                    front = 1 if p.get('d', '')[-LO:-LO + 1] == 'f' else 0
                    p['bow'] = fist + [front, -1]; p['bowM'] = fist + [front, -1]
        for rf, per in frames.items():   # LAYERED-DUAL: a pair's other weapon (`off`: grip, the head's place, the blade's side)
            rec = int(rf.split('-')[0])
            for p in per:
                p.pop('off', None)
                gx, gy, ex, ey = p.get('w') or (p['q'] + p['t']); D = math.hypot(ex - gx, ey - gy) or 1.0
                ux, uy = (ex - gx) / D, (ey - gy) / D
                free = BOW_HAND[body].get(rf) if rec <= 4 or 15 <= rec <= 19 else None
                if free:   # the walk and the idle: in the free hand, as the other is held - mirrored in a front or back view
                    hx, hy, front = free; vx, vy = (-ux, uy) if rec % 5 in (0, 4) else (ux, uy)
                    blade = 'x' if rec % 5 == 4 else 'f' if front else 'b'
                    p['off'] = [hx, hy, round(hx + vx * D, 1), round(hy + vy * D, 1), blade]
        for rf in SHIELD_ARM_FRAMES[body]:   # LAYERED-SHIELD: the hole the free arm leaves, filled from the frame's own body
            out = f'{V}/weapon/{body}/{rf}-arm.png'
            if only is None or f'{body}:{rf}' in only or f'{body}:{rf}-arm' in only or not os.path.exists(out):
                Image.fromarray(arm_sources(body, rf)).save(out, optimize=True); print(body, rf, 'arm sources')
        for rf, per in frames.items():   # LAYERED-SHIELD: the free arm out of a swing (`sa`), the shield's grip (`sh`)
            g = SHIELD_GRIP[body].get(rf) or BOW_HAND[body].get(rf, ())[:2]
            gr = SHIELD_GRAFT.get((body, rf))
            if gr:   # the grafted arm's hand
                hx, hy = BOW_HAND[body][gr[0]][:2]; g = (round(hx - gr[1], 1), round(hy - gr[2], 1))
            for p in per:
                p.pop('sa', None); p.pop('sh', None); p.pop('sg', None); p.pop('sp', None); p.pop('ss', None)
                if g: p['sh'] = [float(v) for v in g]
                if (body, rf) in SHIELD_ARM: p['sa'] = [[[float(x), float(y)] for x, y in P] for P in SHIELD_ARM[(body, rf)]]
                if gr: p['sg'] = [gr[0]] + [float(v) for v in gr[1:]]
                if (body, rf) in SHIELD_ARM_OF_IDLE: p['sp'] = [[[float(x), float(y)] for x, y in P] for P in SHIELD_ARM_OF_IDLE[(body, rf)]]
                if (body, rf) in SHIELD_SHOULDER_OF_IDLE: p['ss'] = [[[float(x), float(y)] for x, y in P] for P in SHIELD_SHOULDER_OF_IDLE[(body, rf)]]
        for rf, per in frames.items():   # a flail's chain lags the hand: the head's move since the frame before (`cv`, px)
            rec, i = map(int, rf.split('-')); n = sum(1 for k in frames if k.startswith(f'{rec}-'))
            prev = f'{rec}-{(i - 1) % n}' if rec <= 4 else f'{rec}-{i - 1}' if i > 0 else None   # a walk loops, a swing starts at rest
            for k, p in enumerate(per):
                p.pop('cv', None)
                if not prev or prev == rf: continue
                q = frames[prev][k]; a, b = (p.get('w') or p['q'] + p['t'])[2:], (q.get('w') or q['q'] + q['t'])[2:]
                if math.hypot(a[0] - b[0], a[1] - b[1]) >= 0.5: p['cv'] = [round(a[0] - b[0], 1), round(a[1] - b[1], 1)]
        fig = np.nonzero(strip_base(body, 'leather_leather_leather', '15-0')[..., 3] > 0)[0]   # the idle's height is 1.8 m
        rig[body] = {'len': ln, 'bow': BOW_PX[body], 'cm': round(float(np.ptp(fig) + 1) / 180, 4), 'frames': frames}
    with open(f'{V}/weapon/manifest.json', 'w') as f: json.dump(rig, f, separators=(',', ':'))
    print('weapon rig written')


if __name__ == '__main__':
    main(sys.argv[2:] or None)
