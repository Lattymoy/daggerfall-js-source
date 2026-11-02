"""Motion capture onto the forge's body: read a captured skeleton, turn each frame into the forge's own joint angles,
and render it on the bare body (the mannequin) from the sprites' views.

    python -I tools/sprite-forge/mocap.py --asf <subject.asf> --amc <trial.amc> --frames 1,40,80 --out <sheet.png>
    python -I tools/sprite-forge/mocap.py --fbx <clip.fbx> --frames 1,10 --out <sheet.png>

CMU's motion capture library gives ASF/AMC; Mixamo gives FBX (download it "Without Skin"). The captures are read
from outside the repo and never enter it. A pose is carried by the directions of the captured bones, never their
lengths, so the forge's own proportions stay: each trunk and leg joint is turned until its bone points as the
captured one does, and each arm is solved to the captured wrist by the forge's IK (`rig.solve_arm`)."""
import argparse
import math
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402

# the landmarks a frame gives, each a point in the forge's axes (+X the body's left, +Y back, +Z up)
LANDMARKS = ('pelvis', 'spine', 'chest', 'neck', 'head', 'head_top') + tuple(
    f'{n}_{s}' for s in 'LR' for n in ('hip', 'knee', 'ankle', 'toe', 'shoulder', 'elbow', 'wrist', 'hand', 'thumb'))


# ---- reading captures ----

def _euler(deg, order='XYZ'):
    """CMU's rotation: its axes applied in `order`, each about the fixed frame (the first applied rightmost)."""
    m = np.eye(3)
    for ax, a in zip(order, np.radians(deg)):
        c, s = math.cos(a), math.sin(a)
        r = {'X': [[1, 0, 0], [0, c, -s], [0, s, c]], 'Y': [[c, 0, s], [0, 1, 0], [-s, 0, c]],
             'Z': [[c, -s, 0], [s, c, 0], [0, 0, 1]]}[ax]
        m = np.array(r) @ m
    return m


def read_asf(path):
    bones, hier, sec, cur = {}, {}, None, None
    for raw in open(path):
        line = raw.split('#')[0].strip()
        if not line:
            continue
        if line.startswith(':'):
            sec = line.split()[0]
            continue
        w = line.split()
        if sec == ':bonedata':
            if w[0] == 'begin':
                cur = {'dof': []}
            elif w[0] == 'end':
                bones[cur['name']] = cur
            elif w[0] in ('name', 'direction', 'length', 'axis', 'dof'):
                cur[w[0]] = (w[1] if w[0] == 'name' else [float(v) for v in w[1:4]] if w[0] in ('direction', 'axis')
                             else float(w[1]) if w[0] == 'length' else w[1:])
        elif sec == ':hierarchy' and w[0] not in ('begin', 'end'):
            for child in w[1:]:
                hier[child] = w[0]
    for b in bones.values():
        b['C'] = _euler(b['axis'])
    return bones, hier


def read_amc(path):
    frames, cur = [], None
    for raw in open(path):
        line = raw.strip()
        if not line or line.startswith(('#', ':')):
            continue
        w = line.split()
        if len(w) == 1 and w[0].isdigit():
            cur = {}
            frames.append(cur)
        elif cur is not None:
            cur[w[0]] = [float(v) for v in w[1:]]
    return frames


# CMU's bones whose far ends are the landmarks
CMU_ENDS = {'spine': 'lowerback', 'chest': 'upperback', 'neck': 'thorax', 'head': 'upperneck', 'head_top': 'head',
            **{f'{n}_{s}': f'{s.lower()}{b}' for s in 'LR' for n, b in (
                ('hip', 'hipjoint'), ('knee', 'femur'), ('ankle', 'tibia'), ('toe', 'foot'), ('shoulder', 'clavicle'),
                ('elbow', 'humerus'), ('wrist', 'radius'), ('hand', 'hand'), ('thumb', 'thumb'))}}


def cmu_frames(asf, amc):
    """Each AMC frame's landmarks: CMU's forward kinematics (a bone turns by its axis, its dofs, its axis undone)."""
    bones, hier = read_asf(asf)
    order = []

    def visit(name):
        order.append(name)
        for c, p in hier.items():
            if p == name:
                visit(c)
    visit('root')
    out = []
    for fr in read_amc(amc):
        r = fr['root']
        M = {'root': _euler(r[3:6])}
        P = {'root': np.array(r[:3])}
        for name in order[1:]:
            b = bones[name]
            v = dict(zip([d.upper() for d in b['dof']], fr.get(name, [])))
            L = _euler([v.get('RX', 0.0), v.get('RY', 0.0), v.get('RZ', 0.0)])
            M[name] = M[hier[name]] @ b['C'] @ L @ b['C'].T
            P[name] = P[hier[name]] + b['length'] * (M[name] @ np.array(b['direction']))
        pts = {k: P[v] for k, v in CMU_ENDS.items()}
        pts['pelvis'] = P['root']
        out.append({k: np.array([p[0], -p[2], p[1]]) for k, p in pts.items()})   # Y up -> Z up
    return out


# Mixamo's bones (and most FBX humanoids) whose heads are the landmarks; the tips stand in where no child names them
MIXAMO = {'pelvis': 'Hips', 'spine': 'Spine1', 'chest': 'Spine2', 'neck': 'Neck', 'head': 'Head',
          **{f'{n}_{s}': f'{side}{b}' for s, side in (('L', 'Left'), ('R', 'Right')) for n, b in (
              ('hip', 'UpLeg'), ('knee', 'Leg'), ('ankle', 'Foot'), ('toe', 'ToeBase'), ('shoulder', 'Arm'),
              ('elbow', 'ForeArm'), ('wrist', 'Hand'), ('hand', 'HandMiddle1'), ('thumb', 'HandThumb2'))}}


def armature_frames(path, frames):
    """The landmarks of an FBX or BVH armature at `frames`, read through Blender: a bone's head, or the head's tip."""
    import bpy
    import addon_utils   # Blender's own, importable once bpy is
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if path.lower().endswith('.bvh'):
        addon_utils.enable('io_anim_bvh', default_set=True)
        bpy.ops.import_anim.bvh(filepath=path)
    else:
        addon_utils.enable('io_scene_fbx', default_set=True)
        bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=True)
    arm = next(ob for ob in bpy.context.scene.objects if ob.type == 'ARMATURE')

    def bone(name):
        for b in arm.pose.bones:
            if b.name.split(':')[-1] == name:
                return b
        return None
    out = []
    for f in frames:
        bpy.context.scene.frame_set(f)
        pts = {}
        for k, name in MIXAMO.items():
            b = bone(name)
            if b is not None:
                pts[k] = np.array((arm.matrix_world @ b.head)[:])
        top = bone('HeadTop_End')   # Mixamo's; else the head bone's tip, which the importer may lengthen
        pts['head_top'] = np.array((arm.matrix_world @ (top.head if top else bone('Head').tail))[:])
        for s in 'LR':   # a rig without fingers: the hand bone's tip is the hand
            if f'hand_{s}' not in pts:
                pts[f'hand_{s}'] = np.array((arm.matrix_world @ bone(MIXAMO[f'wrist_{s}']).tail)[:])
            pts.setdefault(f'thumb_{s}', pts[f'hand_{s}'])
        out.append(pts)
    return out


def face_front(pts):
    """Turn a frame about the vertical so its hips run along X, its left on +X: the body faces -Y, as the forge's does."""
    side = pts['hip_L'] - pts['hip_R']
    a = -math.atan2(side[1], side[0])
    R = np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]])
    o = pts['pelvis'] * np.array([1, 1, 0])
    return {k: R @ (p - o) for k, p in pts.items()}


# ---- onto the forge's skeleton ----

def _unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v


def _frame(a, b):
    """An orthonormal frame (as columns) whose first axis is `a` and whose second lies toward `b`."""
    a = _unit(a)
    b = _unit(b - a * (b @ a))
    return np.stack([a, b, np.cross(a, b)], axis=1)


def _turn(rest_a, rest_b, a, b):
    """The rotation taking the rest pair onto the captured pair: `rest_a` onto `a` exactly, `rest_b` toward `b`."""
    return _frame(np.asarray(a, float), np.asarray(b, float)) @ _frame(np.asarray(rest_a, float),
                                                                     np.asarray(rest_b, float)).T


def retarget(pts, yaw=0.0):
    """A forge Pose (rig.Pose) holding the captured frame `pts` (face_front's): trunk and legs turned bone by bone,
    the arms solved to the captured wrists, the hands along the captured hands, the feet on the ground."""
    from mathutils import Matrix, Vector

    import poses
    from rig import JOINTS, Pose, rest, solve_arm
    P = pts
    up = np.array([0.0, 0.0, 1.0])
    left = np.array([1.0, 0.0, 0.0])
    fwd = np.array([0.0, -1.0, 0.0])
    hips = P['hip_L'] - P['hip_R']
    shoulders = P['shoulder_L'] - P['shoulder_R']
    world = {
        'pelvis': _turn(up, left, P['spine'] - P['pelvis'], hips),
        'spine': _turn(up, left, P['chest'] - P['spine'], hips + shoulders),
        'chest': _turn(up, left, P['neck'] - P['chest'], shoulders),
        'neck': _turn(up, left, P['head'] - P['neck'], shoulders),
        'head': _turn(up, left, P['head_top'] - P['head'], shoulders),
    }
    for s in 'LR':
        world[f'clav_{s}'] = _turn(rest(f'uarm_{s}') - rest(f'clav_{s}'), up, P[f'shoulder_{s}'] - P['neck'],
                                   P['neck'] - P['chest'])
        thigh, shin = P[f'knee_{s}'] - P[f'hip_{s}'], P[f'ankle_{s}'] - P[f'knee_{s}']
        foot = P[f'toe_{s}'] - P[f'ankle_{s}']
        # the knee's front: away from the way the shin folds back; a straight leg takes the foot's forward
        bend = shin - _unit(thigh) * (shin @ _unit(thigh))
        front = -bend if np.linalg.norm(bend) > 0.15 * np.linalg.norm(shin) else foot
        world[f'thigh_{s}'] = _turn(rest(f'shin_{s}') - rest(f'thigh_{s}'), fwd, thigh, front)
        world[f'shin_{s}'] = _turn(rest(f'foot_{s}') - rest(f'shin_{s}'), fwd, shin, front)
        world[f'foot_{s}'] = _turn(np.array([0.0, -0.93, -0.37]), up, foot, -shin)
    pose = Pose(yaw=yaw)
    for j, R in world.items():   # rest frames are the world's: a joint's local turn is its parent's undone
        parent = JOINTS[j][0]
        Rp = world.get(parent, np.eye(3))
        pose.quat[j] = Matrix((Rp.T @ R).tolist()).to_quaternion()
    W = pose.world()
    for s in 'LR':   # the arm solved to the captured wrist, its length the forge's own
        sh, el, wr = P[f'shoulder_{s}'], P[f'elbow_{s}'], P[f'wrist_{s}']
        full = np.linalg.norm(el - sh) + np.linalg.norm(wr - el)
        shoulder = np.array(W[f'uarm_{s}'].translation[:])
        reach = (rest(f'farm_{s}') - rest(f'uarm_{s}')).length + (rest(f'hand_{s}') - rest(f'farm_{s}')).length
        R0 = np.array(W['root'].to_3x3())
        target = shoulder + R0 @ ((wr - sh) * reach / full)
        line = _unit(wr - sh)
        pole = (el - sh) - line * ((el - sh) @ line)
        hand = _unit(P[f'hand_{s}'] - wr)
        thumb = P[f'thumb_{s}'] - wr
        thumb = thumb - hand * (thumb @ hand)
        back = np.cross(thumb, hand) if s == 'L' else np.cross(hand, thumb)
        solve_arm(pose, s, Vector(target), Vector(R0 @ pole if np.linalg.norm(pole) > 1e-4 else R0 @ np.array([0, 1, 0])),
                  hand_dir=Vector(R0 @ hand), hand_up=Vector(R0 @ back) if np.linalg.norm(back) > 1e-6 else None)
    poses.grounded(pose)
    return pose


# ---- seeing it ----

def stick(pts, w=120, h=150, side=False):
    """The captured frame as lines, seen from the front (the sprites' view 0) or from its right (`side`)."""
    from PIL import Image, ImageDraw
    img = Image.new('RGBA', (w, h), (40, 40, 40, 255))
    d = ImageDraw.Draw(img)
    lo = min(p[2] for p in pts.values())
    hi = max(p[2] for p in pts.values())
    k = (h - 10) / max(hi - lo, 1e-6)

    def at(n):
        p = pts[n]
        return (w / 2 + (-p[1] if side else p[0]) * k, h - 5 - (p[2] - lo) * k)
    bones = [('pelvis', 'spine'), ('spine', 'chest'), ('chest', 'neck'), ('neck', 'head'), ('head', 'head_top')]
    for s in 'LR':
        bones += [('pelvis', f'hip_{s}'), (f'hip_{s}', f'knee_{s}'), (f'knee_{s}', f'ankle_{s}'),
                  (f'ankle_{s}', f'toe_{s}'), ('neck', f'shoulder_{s}'), (f'shoulder_{s}', f'elbow_{s}'),
                  (f'elbow_{s}', f'wrist_{s}'), (f'wrist_{s}', f'hand_{s}')]
    for a, b in bones:
        col = (230, 120, 80) if a.endswith('_L') or b.endswith('_L') else (110, 170, 230) if (
            a.endswith('_R') or b.endswith('_R')) else (220, 220, 220)
        d.line([at(a), at(b)], fill=col, width=2)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--asf', default='')
    ap.add_argument('--amc', default='')
    ap.add_argument('--fbx', default='', help='an FBX or BVH armature (Mixamo: "Without Skin")')
    ap.add_argument('--frames', default='1', help='frame numbers, comma-separated (AMC frames count from 1)')
    ap.add_argument('--views', default='0,1,2', help="the sprites' views to render (0 front .. 4 back)")
    ap.add_argument('--out', required=True, help='a contact sheet (PNG): a row a frame')
    args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
    frames = [int(f) for f in args.frames.split(',')]
    if args.amc:
        every = cmu_frames(args.asf, args.amc)
        caught = [every[min(f, len(every)) - 1] for f in frames]
    else:
        caught = armature_frames(args.fbx, frames)
    caught = [face_front(p) for p in caught]

    import bpy
    from PIL import Image

    import forge
    import stage
    bpy.ops.wm.read_factory_settings(use_empty=True)
    stage.setup(16)
    fighter = forge.Fighter('naked')
    tmp = os.path.join(tempfile.mkdtemp(), 'm.png')
    views = [int(v) for v in args.views.split(',')]
    rows = []
    for pts in caught:
        cells = [stick(pts), stick(pts, side=True)]
        for v in views:
            fighter.place(retarget(pts, forge.VIEW_YAW[v]), {'fist': {}})
            work = stage.render_rgba(tmp)
            cut = Image.fromarray(work)
            box = cut.getbbox() or (0, 0, 1, 1)
            bg = Image.new('RGBA', cut.size, (40, 40, 40, 255))
            bg.alpha_composite(cut)
            cells.append(bg.crop((max(box[0] - 4, 0), max(box[1] - 4, 0), box[2] + 4, box[3] + 4)))
        h = max(c.size[1] for c in cells)
        row = Image.new('RGBA', (sum(c.size[0] + 6 for c in cells), h), (25, 25, 25, 255))
        x = 0
        for c in cells:
            row.paste(c, (x, h - c.size[1]))
            x += c.size[0] + 6
        rows.append(row)
    sheet = Image.new('RGBA', (max(r.size[0] for r in rows), sum(r.size[1] + 6 for r in rows)), (25, 25, 25, 255))
    y = 0
    for r in rows:
        sheet.paste(r, (0, y))
        y += r.size[1] + 6
    sheet = sheet.resize((sheet.size[0] * 2, sheet.size[1] * 2), Image.NEAREST)
    sheet.save(args.out)
    print(f'{len(rows)} frames -> {args.out}')


if __name__ == '__main__':
    main()
