"""The fighter's fitted proportions: each part scaled about its own axis or centre, and the whole body's size on screen.
fit.py fits them over every frame; forge.py lays them on the meshes it renders, and fit.py on its points, by the
same `transform`, so what is fitted is what is drawn. Kept beside the spec as <spec>-shape.json."""
import json
import os

import numpy as np

from rig import rest

DEFAULT = {
    'scale': 1.0,       # the whole body's pixels a metre, past stage.PX_PER_M
    'torso_w': 1.0, 'torso_d': 1.0, 'arm_r': 1.0, 'leg_r': 1.0, 'head': 1.0, 'hand': 1.0, 'boot_r': 1.0,
    'paul_s': 1.0, 'paul_dx': 0.0, 'paul_dz': 0.0, 'loin_w': 1.0, 'axe': 1.0,
    'helm_s': 1.0, 'helm_dy': 0.0, 'helm_dz': 0.0, 'paul_sz': 1.0,
    'waist_w': 1.0, 'chest_w': 1.0,   # the torso's width below the ribs and across the chest, past torso_w
}
SHAPE = dict(DEFAULT)
HEAD_PARTS = ('face', 'coif', 'helm', 'nasal', 'cheek_L', 'cheek_R')
HELM_PARTS = ('helm', 'nasal', 'cheek_L', 'cheek_R')


def load_shape(path):
    SHAPE.clear()
    SHAPE.update(DEFAULT)
    if os.path.exists(path):
        SHAPE.update(json.load(open(path)))


def write_shape(path, shape):
    with open(path, 'w') as fh:
        fh.write(json.dumps({k: round(float(v), 4) for k, v in shape.items()}, indent=1) + '\n')


def _radial(p, cx, cy, s):
    out = p.copy()
    out[:, 0] = cx + (p[:, 0] - cx) * s
    out[:, 1] = cy + (p[:, 1] - cy) * s
    return out


def _chain_xy(points, z):
    pts = sorted(points, key=lambda v: v.z)
    zs = [p.z for p in pts]
    return np.interp(z, zs, [p.x for p in pts]), np.interp(z, zs, [p.y for p in pts])


def transform(name, p, S=None):
    """Part `name`'s points `p` (its mesh space: rest space for a skinned part, its joint's space for a rigid one,
    the weapon's for the axe) under the proportions `S`."""
    S = S or SHAPE
    base = name.split('.')[0]
    if base == 'torso':
        from model import TORSO_LEAN
        cy = np.interp(p[:, 2], *TORSO_LEAN)
        out = p.copy()
        t = np.clip((p[:, 2] - 1.12) / 0.16, 0.0, 1.0)
        t = t * t * (3 - 2 * t)
        out[:, 0] *= S['torso_w'] * (S.get('waist_w', 1.0) * (1 - t) + S.get('chest_w', 1.0) * t)
        out[:, 1] = cy + (p[:, 1] - cy) * S['torso_d']
        return out
    if base.startswith('arm_') or base.startswith('leg_'):
        s = base[-1]
        chain = ([rest(f'uarm_{s}'), rest(f'farm_{s}'), rest(f'hand_{s}')] if base.startswith('arm_')
                 else [rest(f'thigh_{s}'), rest(f'shin_{s}'), rest(f'foot_{s}')])
        cx, cy = _chain_xy(chain, p[:, 2])
        return _radial(p, cx, cy, S['arm_r' if base.startswith('arm_') else 'leg_r'])
    if base in HEAD_PARTS:
        out = p * S.get('head', 1.0)
        if base in HELM_PARTS:   # the helm and its guards about the head's centre, then moved
            c = np.array([0.0, 0.005, 0.09])
            out = c + (out - c) * S.get('helm_s', 1.0)
            out[:, 1] += S.get('helm_dy', 0.0)
            out[:, 2] += S.get('helm_dz', 0.0)
        return out
    if base.startswith('hand_'):
        return p * S['hand']
    side = 1.0 if base.endswith('_L') else -1.0
    if base.startswith(('cuff_', 'boot_')):
        return _radial(p, 0.002 * side, 0.002, S['boot_r'])
    if base.startswith('foot_'):
        out = p.copy()
        out[:, 0] = 0.003 * side + (p[:, 0] - 0.003 * side) * S['boot_r']
        return out
    if base.startswith('pauldron_'):
        c = np.array([0.14 * side, 0.0, -0.01])   # the pauldron's centre in its clavicle's space
        out = c + (p - c) * S['paul_s']
        out[:, 2] = c[2] + (out[:, 2] - c[2]) * S.get('paul_sz', 1.0)
        out[:, 0] += S['paul_dx'] * side
        out[:, 2] += S['paul_dz']
        return out
    if base.startswith('loin_'):
        out = p.copy()
        out[:, 0] *= S['loin_w']
        return out
    if base.startswith('axe_'):
        return p * S['axe']
    return p
