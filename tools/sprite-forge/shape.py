"""The fighter's fitted proportions: each part scaled about its own axis or centre, and the whole body's size on screen.
fit.py fits them over every frame; forge.py lays them on the meshes it renders, and fit.py on its points, by the
same `transform`, so what is fitted is what is drawn. Kept beside the spec as <spec>-shape.json."""
import json
import os

import numpy as np

from anatomy import ARM, LEG, PIECES, TORSO, TORSO_LEAN
from rig import rest

DEFAULT = {
    'scale': 1.0,       # the whole body's pixels a metre, past stage.PX_PER_M
    'torso_w': 1.0, 'torso_d': 1.0, 'arm_r': 1.0, 'leg_r': 1.0, 'head': 1.0, 'hand': 1.0, 'boot_r': 1.0,
    'paul_s': 1.0, 'paul_dx': 0.0, 'paul_dz': 0.0, 'loin_w': 1.0, 'axe': 1.0,
    'helm_s': 1.0, 'helm_dy': 0.0, 'helm_dz': 0.0, 'paul_sz': 1.0,
    'waist_w': 1.0, 'chest_w': 1.0,   # the torso's width below the ribs and across the chest, past torso_w
    'head_dy': 0.0, 'head_dz': 0.0,   # the whole head moved back (+y) or forward, up (+z) or down, on its neck
    'bow_len': 1.0, 'bow_bend': 1.0, 'bow_w': 1.0,   # the bow's length, its braced curve, its limbs' girth
    'bow_flex': 0.0,   # radians more each limb's tip turns a metre the string is drawn
    # a factor a cross-section of the body (anatomy.py's rows), eased between: the torso's width and depth, the arms'
    # and the legs' girth
    'torso_pw': [1.0] * len(TORSO), 'torso_pd': [1.0] * len(TORSO), 'arm_p': [1.0] * len(ARM), 'leg_p': [1.0] * len(LEG),
}
SHAPE = dict(DEFAULT)
HEAD_PARTS = ('coif', 'helm', 'nasal', 'cheek_L', 'cheek_R')
HELM_PARTS = ('helm', 'nasal', 'cheek_L', 'cheek_R')


def load_shape(path):
    SHAPE.clear()
    SHAPE.update(DEFAULT)
    if os.path.exists(path):
        SHAPE.update(json.load(open(path)))


def write_shape(path, shape):
    def r(v):
        return [round(float(x), 4) for x in v] if isinstance(v, (list, tuple, np.ndarray)) else round(float(v), 4)
    with open(path, 'w') as fh:
        fh.write(json.dumps({k: r(v) for k, v in shape.items()}, indent=1) + '\n')


def _radial(p, cx, cy, s):
    out = p.copy()
    out[:, 0] = cx + (p[:, 0] - cx) * s
    out[:, 1] = cy + (p[:, 1] - cy) * s
    return out


def _chain_xy(points, z):
    pts = sorted(points, key=lambda v: v.z)
    zs = [p.z for p in pts]
    return np.interp(z, zs, [p.x for p in pts]), np.interp(z, zs, [p.y for p in pts])


def _bow(p, S, draw=0.0):
    """The straight bow bent. Each limb is a circular arc that keeps its length: braced, its tip turns `bow_bend`
    times BOW_ARC from straight, and `bow_flex` more a metre of `draw`. So a drawn bow's tips come back and in."""
    from model import BOW_ARC, BOW_HALF
    n, w = S.get('bow_len', 1.0), S.get('bow_w', 1.0)
    k = max(BOW_ARC * S.get('bow_bend', 1.0) + S.get('bow_flex', 0.0) * draw, 1e-6) / (BOW_HALF * n)
    a = k * p[:, 2] * n   # the turn at each point's length along its limb
    off = p[:, 1] * w   # across the limb, toward the string (+Y)
    return np.stack([p[:, 0] * w, (1 - np.cos(a)) / k + off * np.cos(a), np.sin(a) / k - off * np.sin(a)], axis=1)


def bow_point(p, S=None, draw=0.0):
    """A point of the straight bow's frame (a tip, the grip) bent and sized as the bow is."""
    return _bow(np.array([p], dtype=np.float64), S or SHAPE, draw)[0]


def transform(name, p, S=None, alpha=None, draw=0.0):
    """Part `name`'s points `p` (its mesh space: rest space for a skinned part, its joint's space for a rigid one,
    the weapon's for the axe) under the proportions `S`. The fused body and its layers give `alpha`, each point's
    share of each of anatomy's PIECES: a point moves as each piece would move it, by its shares. The bow bends as
    far as its string is drawn back (`draw`, metres)."""
    S = S or SHAPE
    if alpha is not None:
        return sum(alpha[:, k:k + 1] * transform(piece, p, S) for k, piece in enumerate(PIECES) if alpha[:, k].any())
    base = name.split('.')[0]
    if base == 'skull':   # the body's own head, in rest space: sized about the head joint, then moved
        c = np.array(rest('head'))
        out = c + (p - c) * S.get('head', 1.0)
        out[:, 1] += S.get('head_dy', 0.0)
        out[:, 2] += S.get('head_dz', 0.0)
        return out
    if base == 'torso':
        cy = np.interp(p[:, 2], *TORSO_LEAN)
        out = p.copy()
        t = np.clip((p[:, 2] - 1.12) / 0.16, 0.0, 1.0)
        t = t * t * (3 - 2 * t)
        out[:, 0] *= S['torso_w'] * (S.get('waist_w', 1.0) * (1 - t) + S.get('chest_w', 1.0) * t)
        zs = [row[0] for row in TORSO]
        out[:, 0] *= np.interp(p[:, 2], zs, S.get('torso_pw', [1.0] * len(zs)))
        out[:, 1] = cy + (p[:, 1] - cy) * S['torso_d'] * np.interp(p[:, 2], zs, S.get('torso_pd', [1.0] * len(zs)))
        return out
    if base.startswith('arm_') or base.startswith('leg_'):
        s = base[-1]
        chain = ([rest(f'uarm_{s}'), rest(f'farm_{s}'), rest(f'hand_{s}')] if base.startswith('arm_')
                 else [rest(f'thigh_{s}'), rest(f'shin_{s}'), rest(f'foot_{s}')])
        cx, cy = _chain_xy(chain, p[:, 2])
        rows, key = (ARM, 'arm_p') if base.startswith('arm_') else (LEG, 'leg_p')
        zs = [row[0] for row in rows][::-1]   # the rows run down the limb; np.interp wants them rising
        prof = np.interp(p[:, 2], zs, list(S.get(key, [1.0] * len(rows)))[::-1])
        out = p.copy()
        k = S['arm_r' if base.startswith('arm_') else 'leg_r'] * prof
        out[:, 0] = cx + (p[:, 0] - cx) * k
        out[:, 1] = cy + (p[:, 1] - cy) * k
        return out
    if base in HEAD_PARTS:
        out = p * S.get('head', 1.0)
        out[:, 1] += S.get('head_dy', 0.0)
        out[:, 2] += S.get('head_dz', 0.0)
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
    if base == 'bow':
        return _bow(p, S, draw)
    return p
