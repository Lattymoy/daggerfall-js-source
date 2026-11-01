"""The forge's skeleton: rigid segments on a joint tree, posed by forward kinematics with two-bone IK for the arms.

Axes: +X is the body's left, +Y its back, +Z up; the body faces -Y. Every joint's rest frame is the world's, so a
segment is modelled in world rest space and posed by its joint's matrix alone. No Blender armature is used: a rigid
part follows one joint exactly, which keeps every frame's silhouette crisp.
"""
import math
from mathutils import Euler, Matrix, Vector

# joint -> (parent, rest head in metres)
JOINTS = {
    'root': (None, (0.0, 0.0, 0.0)),
    'pelvis': ('root', (0.0, 0.0, 0.97)),
    'spine': ('pelvis', (0.0, 0.0, 1.10)),
    'chest': ('spine', (0.0, 0.0, 1.28)),
    'neck': ('chest', (0.0, -0.03, 1.50)),
    'head': ('neck', (0.0, -0.045, 1.57)),
}
for s, x in (('L', 1.0), ('R', -1.0)):
    JOINTS.update({
        f'clav_{s}': ('chest', (0.05 * x, 0.0, 1.47)),
        f'uarm_{s}': (f'clav_{s}', (0.215 * x, 0.0, 1.45)),
        f'farm_{s}': (f'uarm_{s}', (0.245 * x, 0.01, 1.20)),
        f'hand_{s}': (f'farm_{s}', (0.26 * x, -0.005, 0.965)),
        f'thigh_{s}': ('pelvis', (0.10 * x, 0.0, 0.95)),
        f'shin_{s}': (f'thigh_{s}', (0.105 * x, 0.0, 0.55)),
        f'foot_{s}': (f'shin_{s}', (0.11 * x, 0.015, 0.09)),
    })

ORDER = list(JOINTS)  # parents precede children


def rest(j):
    return Vector(JOINTS[j][1])


def offset(j):
    p = JOINTS[j][0]
    return rest(j) - (rest(p) if p else Vector((0, 0, 0)))


def euler(deg):
    return Euler([math.radians(a) for a in deg], 'XYZ')


class Pose:
    """Local rotations (degrees, XYZ) per joint, plus the root's place. `world` gives each joint's matrix."""

    def __init__(self, rot=None, root_loc=(0, 0, 0), yaw=0.0):
        self.rot = dict(rot or {})
        self.root_loc = Vector(root_loc)
        self.yaw = yaw
        self.quat = {}   # joint -> local Quaternion set by IK (overrides rot)

    def local(self, j):
        if j in self.quat:
            return self.quat[j].to_matrix().to_4x4()
        return euler(self.rot.get(j, (0, 0, 0))).to_matrix().to_4x4()

    def world(self):
        m = {}
        for j in ORDER:
            p = JOINTS[j][0]
            if p is None:
                base = Matrix.Translation(self.root_loc) @ Matrix.Rotation(math.radians(self.yaw), 4, 'Z')
                m[j] = base @ self.local(j)
            else:
                m[j] = m[p] @ Matrix.Translation(offset(j)) @ self.local(j)
        return m


def solve_arm(pose, side, wrist_target, pole, hand_dir=None, hand_up=None):
    """Two-bone IK: put the wrist of arm `side` on `wrist_target` (world), the elbow bent toward `pole` (world
    direction). With `hand_dir` the hand's long axis points there (world), rolled so its back faces `hand_up`."""
    W = pose.world()
    clav = W[f'clav_{side}']
    shoulder = (clav @ Matrix.Translation(offset(f'uarm_{side}'))).translation
    a = offset(f'farm_{side}').length
    b = offset(f'hand_{side}').length
    t = Vector(wrist_target)
    d = t - shoulder
    dist = min(d.length, (a + b) * 0.999)
    d.normalize()
    # elbow position in the plane of d and pole
    cos_s = (a * a + dist * dist - b * b) / (2 * a * dist)
    cos_s = max(-1.0, min(1.0, cos_s))
    sin_s = math.sqrt(1 - cos_s * cos_s)
    pv = Vector(pole) - Vector(pole).project(d)
    if pv.length < 1e-6:
        pv = Vector((0, -1, 0)) - Vector((0, -1, 0)).project(d)
    pv.normalize()
    elbow = shoulder + d * (cos_s * a) + pv * (sin_s * a)
    wrist = shoulder + d * dist
    clav_rot = clav.to_quaternion()
    # upper arm: rest direction -> elbow direction, in the clavicle's frame
    r_u = offset(f'farm_{side}').normalized()
    want_u = clav_rot.inverted() @ (elbow - shoulder).normalized()
    q_u = r_u.rotation_difference(want_u)
    pose.quat[f'uarm_{side}'] = q_u
    W = pose.world()
    ua = W[f'uarm_{side}'].to_quaternion()
    r_f = offset(f'hand_{side}').normalized()
    want_f = ua.inverted() @ (wrist - elbow).normalized()
    pose.quat[f'farm_{side}'] = r_f.rotation_difference(want_f)
    if hand_dir is not None:
        W = pose.world()
        fa = W[f'farm_{side}'].to_quaternion()
        # the hand's rest long axis is down (-Z); its back faces outward (+X on the left, -X on the right)
        rest_dir = Vector((0, 0, -1))
        rest_up = Vector((1 if side == 'L' else -1, 0, 0))
        want_dir = Vector(hand_dir).normalized()
        want_up = Vector(hand_up if hand_up is not None else rest_up)
        want_up = (want_up - want_up.project(want_dir)).normalized()
        rest_m = Matrix((rest_dir, rest_up, rest_dir.cross(rest_up))).transposed()
        want_m = Matrix((want_dir, want_up, want_dir.cross(want_up))).transposed()
        q_world = (want_m @ rest_m.inverted()).to_quaternion()
        pose.quat[f'hand_{side}'] = fa.inverted() @ q_world
    return elbow
