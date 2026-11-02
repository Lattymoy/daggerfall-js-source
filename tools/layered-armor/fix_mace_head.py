"""WORN-ARMOUR: the female side walk 2-2 carries a mace head lit pale on top and black below, unlike every other frame of
the walk (a dark iron head). The head of 2-3, the next frame, is copied over it (base tile, every outfit), 3 px to the
left so it meets 2-2's own shaft - in every tile, so the slot map and the metals are 2-3's too (with plate legs the old
head's right edge sat in the legs' slot and took their metal).
usage: python -I fix_mace_head.py <repo>/vendor/layered-armor"""
import os, sys, numpy as np
from PIL import Image
V = sys.argv[1]
X0, X1, Y0, Y1, DX = 28, 53, 60, 90, -3   # 2-2's head box; 2-3's head sits DX px to the right of it
n = 0
for combo in sorted(os.listdir(f'{V}/female')):
    p = f'{V}/female/{combo}/2-2.png'
    S = np.array(Image.open(p).convert('RGBA')); R = np.array(Image.open(f'{V}/female/{combo}/2-3.png').convert('RGBA'))
    for k in range(S.shape[1] // 130):
        S[Y0:Y1, k * 130 + X0:k * 130 + X1] = R[Y0:Y1, k * 130 + X0 - DX:k * 130 + X1 - DX]
    Image.fromarray(S).save(p); n += 1
print('mace head copied in', n, 'strips')
