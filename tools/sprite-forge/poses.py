"""The medium fighter's keyed poses: walk (4), attack (6), hurt (1), idle (1) and bow (4) frames, as the classic
class sprites' records hold them. One animation serves all five views; the view only turns the body.

Rotations are degrees about the joint's rest axes (+X left, +Y back, +Z up): a thigh or arm swings forward on -X,
a knee bends on +X, an elbow on -X, the trunk leans forward on +X; a left limb spreads out on -Y, a right on +Y.
Points given in body space are in the root's frame: the ground under the body, facing -Y."""
import json
import math
import os

from mathutils import Matrix, Vector

import shape
from model import bow_tips
from rig import Pose, reach, solve_arm

# A frame's fitted adjustment (fit.py): joint rotations added to its keys ('rot'), the body's turn ('turn'), the axe
# grip and haft ('grip', 'haft', body space), the attack's fist and axe head on screen ('fist', 'head'), the axe's
# roll about its haft in degrees ('roll'), the fist's place along it ('slide', metres), and each solved elbow's
# swivel ('elbow_L', 'elbow_R', degrees). Keyed '<anim>:<view>:<frame>'.
FIT = {}
_adj = {}
_gap = [0.0]   # metres the second hand on the axe falls short of the haft, this frame (pose_for gives it as 'gap')


def load_fit(path):
    FIT.clear()
    if os.path.exists(path):
        FIT.update(json.load(open(path)))


def _plus(a, key):
    d = _adj.get(key)
    return Vector(a) + Vector(d) if d else Vector(a)

SOLE = [Vector((0, 0.04, -0.085)), Vector((0, -0.13, -0.08)), Vector((0, -0.19, -0.075))]
FIST = 0.075   # wrist to the middle of a closed fist


def frame_matrix(origin, z_dir, x_dir):
    z = Vector(z_dir).normalized()
    x = Vector(x_dir)
    x = (x - x.project(z)).normalized()
    y = z.cross(x)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = Vector(origin)
    return m


def root_matrix(pose):
    return pose.world()['root']


def grounded(pose):
    """Lower or lift the root so the lowest sole point touches the ground."""
    W = pose.world()
    low = min((W[f'foot_{s}'] @ p).z for s in 'LR' for p in SOLE)
    pose.root_loc.z -= low
    return pose


def grip(pose, side, at, haft, pole, knuckles=None):
    """Close the `side` fist around a haft at body-space point `at` running along `haft`: the arm solved to it, the
    elbow toward `pole`. The fist's long axis is the forearm's line squared to the haft, or `knuckles` if given.
    Gives the grip as held (world), the haft's direction and how far short of `at` the fist fell: a grip past the
    arm's reach is held where the straight arm puts the fist, so what it holds never floats off the hand."""
    R = root_matrix(pose)
    rot = R.to_3x3()
    at_w = R @ Vector(at)
    haft_w = (rot @ Vector(haft)).normalized()
    W = pose.world()
    shoulder = W[f'uarm_{side}'].translation
    k = (rot @ Vector(knuckles)) if knuckles is not None else (at_w - shoulder)
    k = (k - k.project(haft_w)).normalized()
    wrist = at_w - k * FIST
    short = max(0.0, (wrist - shoulder).length - reach(side))
    if short:
        wrist = shoulder + (wrist - shoulder).normalized() * reach(side)
        at_w = wrist + k * FIST
    pole_w = rot @ Vector(pole)
    swivel = _adj.get(f'elbow_{side}')
    if swivel:   # the elbow turned about the shoulder-to-wrist line
        pole_w = Matrix.Rotation(math.radians(swivel), 3, (wrist - shoulder).normalized()) @ pole_w
    solve_arm(pose, side, wrist, pole_w, hand_dir=k, hand_up=haft_w.cross(k))
    return at_w, haft_w, short


def axe_at(pose, grip_at, haft, blade_up, left_at=None, pole_r=(-1, 0.3, -0.5), pole_l=(1, 0.3, -0.5),
           knuckles_r=None, knuckles_l=None):
    """The axe held by its haft at `grip_at` (right fist), the head along `haft`, blades along `blade_up`; with
    `left_at` (a distance up the haft) the left fist holds it too."""
    grip_at, haft = _plus(grip_at, 'grip'), _plus(haft, 'haft')
    at_w, haft_w, _ = grip(pose, 'R', grip_at, haft, pole_r, knuckles_r)
    if left_at is not None:   # up the haft from where the right fist holds it
        _, _, short = grip(pose, 'L', root_matrix(pose).inverted() @ (at_w + haft_w * left_at), haft, pole_l, knuckles_l)
        _gap[0] += short
    rot = root_matrix(pose).to_3x3()
    blade = rot @ Vector(blade_up)
    if _adj.get('roll'):
        blade = Matrix.Rotation(math.radians(_adj['roll']), 3, haft_w) @ blade
    # 'slide': the fist further down the haft (+) or up it, so the axe reaches further or less
    return frame_matrix(at_w - haft_w * _adj.get('slide', 0.0), haft_w, blade)


def stance(rot, yaw):
    rot = dict(rot)
    for j, d in _adj.get('rot', {}).items():
        rot[j] = tuple(a + b for a, b in zip(rot.get(j, (0, 0, 0)), d))
    p = Pose(rot, yaw=yaw + _adj.get('turn', 0.0))
    grounded(p)
    return p


def idle(frame, view, yaw):
    p = stance({
        'pelvis': (0, 0, 10), 'spine': (4, 0, -4), 'chest': (2, 0, -4), 'neck': (6, 0, 0), 'head': (-8, 0, 0),
        'thigh_R': (-15, 14, 14), 'shin_R': (8, 0, 0), 'foot_R': (8, 0, -8),
        'thigh_L': (25, -2, -10), 'shin_L': (16, 0, 0), 'foot_L': (4, 0, 8),
        'clav_L': (0, -6, 0), 'uarm_L': (4, -12, 0), 'farm_L': (-12, 0, 8),
        'clav_R': (0, 6, 0),
    }, yaw)
    grip_at, haft = IDLE_AXE.get(view, IDLE_AXE[None])
    axe = axe_at(p, grip_at, haft, (-0.7, 0.1, 0.7), pole_r=(-1, 0.6, -0.3))
    return p, {'axe': axe}


# the idle's axe, by view: carried forward and level, but in the front view the classic frame lets it hang down and
# out to the ground, which no single carry shows from every side
IDLE_AXE = {None: ((-0.26, -0.22, 0.86), (-0.18, -1.0, 0.13)),
            0: ((-0.26, -0.16, 0.84), (-0.5, -0.45, -0.75))}


# walk: contact, passing, contact, passing - the left leg leads on frame 0
WALK_LEGS = [
    {'thigh_L': (-24, -5, -6), 'shin_L': (6, 0, 0), 'foot_L': (-6, 0, 6),
     'thigh_R': (20, 5, 6), 'shin_R': (22, 0, 0), 'foot_R': (10, 0, -6)},
    {'thigh_L': (-4, -5, -6), 'shin_L': (4, 0, 0), 'foot_L': (2, 0, 6),
     'thigh_R': (-14, 5, 6), 'shin_R': (48, 0, 0), 'foot_R': (-6, 0, -6)},
]


def _mirror_legs(legs):
    out = {}
    for j, (x, y, z) in legs.items():
        out[j.replace('_L', '_X').replace('_R', '_L').replace('_X', '_R')] = (x, -y, -z)
    return out


def walk(frame, view, yaw):
    legs = WALK_LEGS[frame % 2] if frame < 2 else _mirror_legs(WALK_LEGS[frame % 2])
    lead_left = frame in (0, 1)
    swing = (16 if frame == 0 else -16 if frame == 2 else 0)
    p = stance({
        'pelvis': (0, 0, -5 if lead_left else 5), 'spine': (8, 0, 0), 'chest': (3, 0, 3 if lead_left else -3),
        'neck': (6, 0, 0), 'head': (-8, 0, 0),
        'clav_L': (0, -6, 0), 'uarm_L': (swing, -15, 0), 'farm_L': (-16, 0, 8), 'clav_R': (0, 6, 0),
        **legs}, yaw)
    bob = (0.0, 0.015, 0.0, 0.015)[frame]
    axe = axe_at(p, (-0.31, -0.10, 0.86 + bob), (-0.10, -1.0, 0.02), (-0.7, 0.1, 0.7))
    return p, {'axe': axe}


# The attack, keyed per view as the classic records draw it: the body turns differently in each view (its back to
# the viewer at the wind-up from the side), so one motion turned five ways cannot match them. A key is
# (turn, fist, axe head, depth, crouch, lean, blades): the turn in degrees past the view's angle; the right fist and
# the axe head's centre as the viewer sees them (metres right and up from the ground under the body); how far the
# head sits away from the viewer (+) or toward them (-) when the axe is foreshortened; and blades 'face' (seen flat)
# or 'edge'.
AXE_REACH = 0.62   # grip to the axe head's centre
ATTACK = {
    0: [(0, (-0.22, 1.70), (0.05, 2.02), 1, 0.0, -4, 'face'),
        (0, (-0.12, 1.76), (-0.05, 2.14), 1, 0.0, -4, 'face'),
        (-15, (-0.30, 1.10), (-0.95, 1.42), 0, 0.04, 8, 'face'),
        (-30, (0.05, 1.08), (0.05, 0.55), -1, 0.12, 20, 'edge'),
        (-20, (0.50, 0.84), (0.56, 1.32), -1, 0.08, 14, 'face'),
        (0, (0.18, 1.66), (0.36, 2.02), 1, 0.0, -4, 'face')],
    1: [(0, (-0.50, 1.80), (0.14, 2.06), 0, 0.0, -4, 'face'),
        (0, (-0.58, 1.66), (-0.14, 2.12), 1, 0.0, -4, 'face'),
        (0, (-0.60, 1.18), (-1.04, 1.40), -1, 0.04, 8, 'face'),
        (0, (-0.20, 0.82), (-0.69, 1.18), -1, 0.12, 18, 'edge'),
        (20, (0.34, 0.92), (0.66, 1.30), -1, 0.08, 12, 'face'),
        (0, (-0.06, 1.74), (0.34, 2.08), 1, 0.0, -4, 'face')],
    2: [(-90, (-0.26, 1.74), (0.30, 2.00), 0, 0.0, -4, 'face'),
        (-90, (-0.32, 1.62), (0.18, 2.02), 0, 0.0, -4, 'face'),
        (0, (-0.56, 1.28), (-0.80, 1.36), -1, 0.04, 8, 'face'),
        (30, (-0.42, 0.88), (-0.86, 1.18), 0, 0.12, 18, 'edge'),
        (80, (-0.18, 0.76), (0.40, 1.28), -1, 0.08, 12, 'face'),
        (-60, (-0.26, 1.70), (0.24, 1.98), 0, 0.0, -4, 'face')],
    3: [(-45, (0.16, 1.72), (0.21, 2.0), 1, 0.0, -4, 'face'),
        (-45, (0.13, 1.68), (0.30, 1.98), 1, 0.0, -4, 'face'),
        (45, (0.10, 1.36), (0.167, 0.739), 1, 0.04, 8, 'edge'),
        (45, (-0.34, 0.86), (-0.68, 1.20), -1, 0.12, 14, 'face'),
        (45, (-0.55, 0.86), (-0.037, 0.353), 1, 0.12, 18, 'edge'),
        (0, (-0.40, 1.68), (-0.19, 1.98), 1, 0.0, -4, 'face')],
    4: [(0, (0.24, 1.66), (-0.08, 2.03), 1, 0.0, -4, 'face'),
        (0, (0.34, 1.74), (0.30, 2.08), 1, 0.0, -4, 'face'),
        (0, (0.21, 1.28), (0.84, 1.48), 1, 0.04, 8, 'edge'),
        (0, (0.0, 0.92), (0.05, 0.85), 1, 0.12, 20, 'edge'),
        (20, (-0.44, 0.88), (-0.60, 1.22), 1, 0.08, 12, 'face'),
        (0, (-0.32, 1.80), (-0.44, 2.06), 1, 0.0, -4, 'face')],
}


def attack(frame, view, yaw):
    turn, fist, head, depth, crouch, lean, blades = ATTACK[view][frame]
    fist, head = tuple(_plus(fist, 'fist')), tuple(_plus(head, 'head'))
    bend = crouch * 220
    p = stance({
        'pelvis': (0, 0, 0), 'spine': (lean * 0.5, 0, 0), 'chest': (lean * 0.5, 0, 0), 'neck': (4, 0, 0),
        'head': (-6 - lean * 0.4, 0, 0),
        'thigh_L': (-14 - bend * 0.5, -14, -14), 'shin_L': (10 + bend, 0, 0), 'foot_L': (4 - bend * 0.5, 0, 10),
        'thigh_R': (16 - bend * 0.5, 14, 12), 'shin_R': (12 + bend, 0, 0), 'foot_R': (2 - bend * 0.5, 0, -8),
    }, yaw + turn)
    # screen to body space: the root turned by the yaw; the fist sits a little in front of the trunk
    R = root_matrix(p)
    to_body = R.inverted().to_3x3()
    fwd = R.to_3x3() @ Vector((0, -1, 0))
    fist_w = Vector((fist[0], 0, fist[1])) + Vector((fwd.x, fwd.y, 0)) * 0.28
    span = Vector((head[0] - fist[0], 0, head[1] - fist[1]))
    lift = max(AXE_REACH ** 2 - span.length_squared, 0.0) ** 0.5
    haft_w = (span + Vector((0, lift * depth, 0))).normalized()
    if blades == 'face':
        blade_w = haft_w.cross(Vector((0, 1, 0)))
        if blade_w.length < 1e-3:
            blade_w = Vector((1, 0, 0))
    else:
        blade_w = Vector((0, 1, 0))
    axe = axe_at(p, R.inverted() @ fist_w, to_body @ haft_w, to_body @ blade_w, left_at=0.20)
    return p, {'axe': axe}


def hurt(frame, view, yaw):
    """Knocked back: thrown onto the left leg, the right knee kicked up, the free arm flung straight out to the side,
    the axe raised high and back over the right shoulder."""
    p = stance({
        'pelvis': (-12, 0, 0), 'spine': (-16, 0, 4), 'chest': (-14, 0, 4), 'neck': (-8, 0, 0), 'head': (-20, 0, 0),
        'thigh_R': (-62, 12, 12), 'shin_R': (72, 0, 0), 'foot_R': (-10, 0, -6),
        'thigh_L': (12, -6, -8), 'shin_L': (10, 0, 0), 'foot_L': (2, 0, 6),
        'clav_L': (0, -14, 0), 'uarm_L': (-12, -82, 0), 'farm_L': (-6, 0, 0),
        'clav_R': (0, 16, 0),
    }, yaw)
    axe = axe_at(p, (-0.36, 0.04, 1.44), (-0.8, 0.22, 0.8), (1, 0, 0.8), pole_r=(-1, 0.3, -0.5))
    return p, {'axe': axe}


# The bow: full draw, held, loose, lowered. The archer stands side-on to the shot, the bow arm out along the body's
# left (+X) toward the target, in every view; drawn, that arm is straight. Keys: (left fist, bow's up direction, draw
# in metres, arrow nocked)
BOW_KEYS = [
    ((0.86, -0.04, 1.47), (0.0, 0.0, 1.0), 0.58, True),
    ((0.86, -0.04, 1.48), (0.04, 0.0, 1.0), 0.60, True),
    ((0.60, -0.10, 1.34), (0.35, 0.0, 1.0), 0.02, False),
    ((0.36, -0.22, 1.02), (0.8, 0.0, 0.6), 0.0, False),
]
BOW_TURN = -90   # the body's front a quarter turn right of the shot


def bow(frame, view, yaw):
    at, up, draw, nocked = BOW_KEYS[frame]
    at, up = _plus(at, 'grip'), _plus(up, 'haft')
    p = stance({
        'pelvis': (0, 0, 0), 'spine': (2, 0, 0), 'chest': (0, 0, 0),
        'neck': (4, 0, 30), 'head': (-6, 0, 30),
        'thigh_L': (-16, -12, -10), 'shin_L': (8, 0, 0), 'foot_L': (6, 0, 14),
        'thigh_R': (18, 12, 8), 'shin_R': (12, 0, 0), 'foot_R': (2, 0, -8),
        'clav_R': (0, 4, 0),
    }, yaw + BOW_TURN)
    R = root_matrix(p)
    rot = R.to_3x3()
    at_w, up_w, _ = grip(p, 'L', at, up, (0.2, 1, -0.6), knuckles=(1, 0, 0))
    bow_m = frame_matrix(at_w, up_w, rot @ Vector((0, 1, 0)))
    string_rest = bow_m @ (sum(bow_tips(), Vector()) / 2)   # the braced string's middle
    back = (rot @ Vector((-1, 0, 0))).normalized()
    held, _, _ = grip(p, 'R', R.inverted() @ (string_rest + back * (draw + 0.03)), (0, 0, 1), (-1, 0.4, 0.5),
                      knuckles=(1, 0, 0))
    # nocked, the string is where the fist holds it; loosed, the fist has let it go
    nock = held - back * 0.03 if nocked else string_rest + back * draw
    # the limbs bend as far as the string is drawn back from its rest
    gear = {'bow': bow_m, 'nock': nock, 'draw': max(0.0, (nock - string_rest).dot(back))}
    if nocked:
        gear['arrow'] = nock - back * 0.80
    return p, gear


ANIMS = {'idle': idle, 'walk': walk, 'attack': attack, 'hurt': hurt, 'bow': bow}


# which fists close round a grip: the axe's right hand (both hands in the attack), the bow's and the string's
FISTS = {'idle': 'R', 'walk': 'R', 'hurt': 'R', 'attack': 'LR', 'bow': 'LR'}


def pose_for(anim, frame, view, yaw, adj=None):
    global _adj
    _adj = adj if adj is not None else FIT.get(f'{anim}:{view}:{frame}', {})
    _gap[0] = 0.0
    pose, gear = ANIMS[anim](frame, view, yaw)
    _adj = {}
    gear['gap'] = _gap[0]
    gear['fist'] = {s: s in FISTS[anim] for s in 'LR'}
    return pose, gear
