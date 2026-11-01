"""The medium fighter: an organic body (body.py) in a silver helm and pauldrons over a mail coif, a muscled cuirass,
mail legs, a loincloth, cuffed boots and bracers, with a double-bit war axe and a long bow.

`build_body` answers the rigid parts as (object, joint), the skinned parts (body.Skinned), and each hand's open and
closed meshes. Weapons are built in their own frame: the grip at the origin, the haft (or the bow's riser) along +Z."""
import numpy as np
from mathutils import Matrix, Vector

import anatomy
from body import blob, face_materials, rest_attr, seg
from rig import arm_z, rest
from shapes import ellipsoid, loft, plate, sheet, tube_path


def _hang(parts, ob, joint):
    ob.data.transform(Matrix.Translation(-rest(joint)))
    rest_attr(ob.data)
    parts.append((ob, joint))


def _mirror(fn):
    for s, x in (('L', 1.0), ('R', -1.0)):
        fn(s, x)


def _rigid(name, me, mat):
    import bpy
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat)
    return ob


BRACER = (arm_z(0.972), arm_z(1.163))   # the arm's faces between these heights are its bracer


HAND_DESIGN = 0.965   # the hand joint's height the hands below were designed at

def _hand(x, closed):
    """A hand's blobs, designed round a hand joint at (0.26x, -0.005, HAND_DESIGN), moved to where the joint is. The
    palm faces the thigh (its thickness across X, its width front to back); four fingers lie front to back, the index
    foremost, and the thumb comes off the palm's front."""
    d = rest('hand_L' if x > 0 else 'hand_R') - Vector((0.26 * x, -0.005, HAND_DESIGN))
    inward = -x   # toward the body

    def at(px, py, pz):
        return tuple(Vector((0.262 * x + px * inward, py, pz)) + d)
    rows = (-0.034, -0.012, 0.01, 0.03)   # each finger's place, front to back
    if closed:   # the fist: knuckles in a row, the fingers curled under against the palm, the thumb over them
        parts = [blob(at(0.0, -0.004, 0.912), (0.03, 0.05, 0.038))]
        for i, fy in enumerate(rows):
            parts.append(blob(at(-0.012, fy, 0.874), (0.014, 0.012, 0.014)))
            parts.append(seg(at(-0.008, fy, 0.874), at(0.02, fy, 0.872), 0.011 - 0.001 * i))
        parts.append(seg(at(0.012, -0.05, 0.93), at(0.022, -0.045, 0.88), 0.013))
        return parts
    parts = [blob(at(0.0, -0.004, 0.918), (0.02, 0.048, 0.046))]
    for i, fy in enumerate(rows):
        length = (0.072, 0.08, 0.076, 0.062)[i]
        parts.append(seg(at(-0.002, fy, 0.882), at(0.012, fy * 1.05, 0.882 - length), 0.0105 - 0.0008 * i))
    parts.append(seg(at(0.008, -0.048, 0.932), at(0.02, -0.066, 0.872), 0.013))
    return parts


# the armour over the naked body: each layer the body's own surface over a region, pushed out this far (metres)
CUIRASS = 0.018
COIF = 0.008
MAIL_HIPS, MAIL_LEGS = 0.015, 0.024   # the mail hangs looser round the legs
BRACER_PUSH = 0.007
FACE_Z = 1.55   # the head's skin above this is the face's material, shadowed under the helm
# the heights at rest where the layers end: the cuirass's top and bottom, the coif's foot, the mail's waist and the
# boot's cuff, each with a ring of overlap, and the bracer's band
CUIRASS_Z, COIF_Z, MAIL_Z, CUFF_Z = (1.09, 1.475), 1.465, 1.105, (0.39, 0.40, 0.41)


OUTFITS = ('medium', 'naked')


def build_body(M, outfit='medium'):
    """The fighter: (rigid parts, skinned parts, hands {side: {'open': ob, 'fist': ob}}). The skinned parts are the
    naked body (anatomy.py) and, in the medium outfit, the armour laid over it as layers of its own surface."""
    cuts = (*CUIRASS_Z, COIF_Z, MAIL_Z, *CUFF_Z, *BRACER, BRACER[0] + 0.01, BRACER[1] - 0.01)
    body, parts, hands = anatomy.build(M, _hand, _rigid, _hang, () if outfit == 'naked' else cuts)
    if outfit == 'naked':
        return parts, [body], hands
    body.me.materials.append(M['face'])
    face_materials(body.me, lambda c: 1 if c[2] > FACE_Z else 0)
    skins = [body]
    piece = np.array(anatomy.PIECES)[np.argmax(body.alpha, axis=1)]
    z = body.rest[:, 2]
    torso, leg = piece == 'torso', np.char.startswith(piece, 'leg_')
    arm = np.char.startswith(piece, 'arm_')

    def layer(name, mat, mask, push):
        sub = body.alpha[mask]

        def axis(p):   # the limb's own axis under the mail's lattice, blended where pieces meet
            return sum((sub[:, k:k + 1] * ax(p) for k, ax in enumerate(body.axes) if ax is not None), 0.0 * p)
        skins.append(body.shell(name, mat, mask, push, axis=axis))
    # the layers overlap a ring where they meet, so no skin shows between them
    def band(lo, hi):   # the vertices on the cuts count as inside
        return (z > lo - 1e-5) & (z < hi + 1e-5)
    layer('cuirass', M['cuirass'], torso & band(*CUIRASS_Z), CUIRASS)
    layer('coif_neck', M['coif'], torso & band(COIF_Z, 9), COIF)
    layer('mail', M['mail'], (torso & band(0, MAIL_Z)) | (leg & band(CUFF_Z[1], 9)), np.where(leg, MAIL_LEGS, MAIL_HIPS))
    layer('bracers', M['bracer'], arm & band(*BRACER), BRACER_PUSH)
    # the skin under the layers and the boots goes; a margin of it stays under each layer's edge
    under = torso | (leg & ~band(*CUFF_Z[::2])) | np.char.startswith(piece, 'barefoot_')
    under |= arm & band(BRACER[0] + 0.01, BRACER[1] - 0.01) & ~band(BRACER[0] + 0.01, BRACER[0] + 0.01) \
        & ~band(BRACER[1] - 0.01, BRACER[1] - 0.01)
    body.cut(~under)

    def limb(s, x):
        # the boot: its turned-down cuff, a shaft to the ankle, the foot
        _hang(parts, loft(f'cuff_{s}', (0.106 * x, 0.0, 0.47), (0.107 * x, 0.002, 0.40), [
            (0.0, 0.098, 0.1), (0.4, 0.104, 0.106), (1.0, 0.088, 0.09)], M['boot'], subsurf=1), f'shin_{s}')
        _hang(parts, loft(f'boot_{s}', (0.107 * x, 0.002, 0.42), (0.11 * x, 0.012, 0.06), [
            (0.0, 0.08, 0.084), (0.3, 0.076, 0.082), (0.7, 0.064, 0.068), (1.0, 0.06, 0.064)], M['boot']),
            f'shin_{s}')
        _hang(parts, loft(f'foot_{s}', (0.11 * x, 0.06, 0.055), (0.115 * x, -0.20, 0.036), [
            (0.0, 0.056, 0.054), (0.3, 0.064, 0.058), (0.8, 0.058, 0.04), (1.0, 0.038, 0.026)], M['boot']),
            f'foot_{s}')
    _mirror(limb)

    # head: the mail coif over the body's own head, the silver helm with its nasal and cheek guards over both
    _hang(parts, loft('coif', (0, -0.025, 1.72), (0, -0.02, 1.47), [
        (0.0, 0.10, 0.10, 0, 0.018), (0.25, 0.108, 0.112, 0, 0.022), (0.55, 0.10, 0.10, 0, 0.03),
        (0.8, 0.088, 0.088, 0, 0.026), (1.0, 0.075, 0.075, 0, 0.02)],
        M['coif'], cap=(True, False)), 'head')
    # the helm's dome draws in toward its crown, the classic fighter's pointed cap
    _hang(parts, ellipsoid('helm', (0, -0.04, 1.645), (0.108, 0.13, 0.188), M['silver'], z_cut=1.66,
                           subsurf=2, tilt_x=-14, squash=lambda v: Vector((v.x * (1 - 0.32 * max(v.z, 0) ** 2),
                                                                          v.y * (1 - 0.32 * max(v.z, 0) ** 2), v.z))),
          'head')
    _hang(parts, plate('nasal', [(-0.013, 1.71), (0.013, 1.71), (0.009, 1.625), (-0.009, 1.625)], 0.01,
                       M['silver'], 'XZ', (0, -0.165, 0)), 'head')
    _mirror(lambda s, x: _hang(parts, plate(f'cheek_{s}', [(-0.108, 1.668), (-0.04, 1.668), (-0.045, 1.608),
                                                          (-0.078, 1.59), (-0.1, 1.615)], 0.008,
                                            M['silver'], 'YZ', (0.094 * x, 0, 0)), 'head'))

    # shoulders and waist: the pauldrons hugging the shoulder, a silver rim under the collar, belt and loincloth
    _hang(parts, loft('collar', (0, 0, 1.415), (0, 0, 1.44), [(0, 0.215, 0.13, 0, -0.002),
                                                            (1, 0.212, 0.128, 0, -0.004)],
                      M['silver'], subsurf=1, cap=(False, False)), 'chest')
    _mirror(lambda s, x: _hang(parts, ellipsoid(f'pauldron_{s}', (0.19 * x, 0.0, 1.46), (0.14, 0.135, 0.105),
                                                M['silver'], z_cut=1.45, subsurf=2, tilt_y=28 * x, tilt_x=8),
                               f'clav_{s}'))
    _hang(parts, loft('belt', (0, 0, 1.10), (0, 0, 1.15), [(0, 0.182, 0.125, 0, 0.0), (1, 0.18, 0.124, 0, 0.0)],
                      M['leather'], subsurf=1, cap=(False, False)), 'pelvis')
    # the loincloth wraps the hips: each row an arc, its edges drawn in toward the body
    for side, y in (('front', -1.0), ('back', 1.0)):
        rows = []
        for z, half, depth in ((1.135, 0.085, 0.128), (0.99, 0.075, 0.122), (0.84, 0.07, 0.126), (0.69, 0.064, 0.134)):
            d = depth if y < 0 else depth + 0.04
            rows.append([(u * half, (d + 0.004 - 0.04 * u * u) * y, z) for u in (-1.0, -0.5, 0.0, 0.5, 1.0)])
        _hang(parts, sheet(f'loin_{side}', rows, M['cloth'], thickness=0.006), 'pelvis')
    return parts, skins, hands


def build_axe(M):
    """The war axe in its own frame: grip at the origin, haft up +Z, blades in the XZ plane."""
    obs = [tube_path('axe_haft', [(0, 0, -0.12), (0, 0, 0.4), (0, 0, 0.80)], 0.019, M['haft'])]
    obs.append(loft('axe_socket', (0, 0, 0.48), (0, 0, 0.77), [(0, 0.03, 0.03), (1, 0.03, 0.03)],
                    M['blade'], subsurf=0))
    for x in (1.0, -1.0):
        pts = [(0.025, 0.51), (0.07, 0.54), (0.135, 0.475), (0.195, 0.495), (0.215, 0.62), (0.195, 0.745),
               (0.135, 0.765), (0.07, 0.70), (0.025, 0.73)]
        obs.append(plate('axe_blade', [(a * x, b) for a, b in pts], 0.02, M['blade'], 'XZ'))
        obs.append(plate('axe_edge', [(a * x, b) for a, b in
                                      ((0.19, 0.492), (0.222, 0.62), (0.19, 0.748), (0.205, 0.62))],
                         0.022, M['edge'], 'XZ'))
    obs.append(plate('axe_spike', [(-0.022, 0.77), (0.022, 0.77), (0.0, 0.92)], 0.02, M['blade'], 'XZ'))
    return obs


BOW_HALF, BOW_SAG = 0.66, 0.11   # the bow's half length, and how far behind the grip its tips sit


def build_bow(M):
    """The long bow in its own frame: the left-hand grip at the origin, limbs along +-Z, its back toward -Y. Its
    fitted length, bend and thickness are laid on by shape.py."""
    pts = [(0, BOW_SAG * (z / BOW_HALF) ** 2, z) for z in [i * BOW_HALF / 8 for i in range(-8, 9)]]
    return [tube_path('bow', pts, lambda t: 0.011 + 0.007 * (1 - abs(2 * t - 1)), M['wood'], n=6)]


def bow_tips():
    import shape
    return tuple(Vector(shape.bow_point((0, BOW_SAG, z))) for z in (BOW_HALF, -BOW_HALF))


def string_mesh(M, a, nock, b):
    return tube_path('bowstring', [a, nock, b], 0.003, M['string'], n=4, subsurf=0)


def arrow_mesh(M, nock, tip):
    return tube_path('arrow', [nock, tip], 0.005, M['wood'], n=4, subsurf=0)

