"""The medium fighter: an organic body (body.py) in a silver helm and pauldrons over a mail coif, a muscled cuirass,
mail legs, a loincloth, cuffed boots and bracers, with a double-bit war axe and a long bow.

`build_body` answers the rigid parts as (object, joint), the skinned parts (body.Skinned), and each hand's open and
closed meshes. Weapons are built in their own frame: the grip at the origin, the haft (or the bow's riser) along +Z."""
import numpy as np
from mathutils import Matrix, Vector

from body import Skinned, blob, blob_mesh, chain_centre, coords, face_materials, ramp, rest_attr, seg, vloft
from rig import rest
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


# Sections are (z, half width, front depth, back depth[, pecs, abs]) in metres, measured off the classic medium
# fighter's front and side frames at 62 px a metre. The torso and legs are their armour's outer surface.
TORSO = [
    (0.84, 0.15, 0.10, 0.11), (0.92, 0.185, 0.11, 0.14), (1.00, 0.185, 0.115, 0.13),
    (1.08, 0.172, 0.118, 0.11, 0.0, 0.012), (1.16, 0.175, 0.122, 0.108, 0.0, 0.016),
    (1.25, 0.19, 0.126, 0.118, 0.012, 0.008), (1.33, 0.205, 0.13, 0.124, 0.03), (1.40, 0.21, 0.124, 0.12, 0.024),
    (1.46, 0.19, 0.098, 0.11), (1.50, 0.12, 0.072, 0.085), (1.535, 0.068, 0.062, 0.064), (1.62, 0.058, 0.055, 0.056),
]
TORSO_CENTRE = lambda z: (0.0, float(np.interp(z, [1.40, 1.62], [0.0, -0.035])))
ARM = [
    (1.50, 0.05, 0.05, 0.05), (1.45, 0.082, 0.08, 0.078), (1.38, 0.08, 0.08, 0.078),
    (1.31, 0.075, 0.082, 0.076), (1.25, 0.066, 0.068, 0.068), (1.205, 0.056, 0.054, 0.06), (1.17, 0.064, 0.062, 0.062),
    (1.16, 0.078, 0.076, 0.074), (1.148, 0.074, 0.072, 0.07), (1.10, 0.07, 0.066, 0.066), (1.03, 0.062, 0.057, 0.059),
    (0.978, 0.052, 0.047, 0.048), (0.97, 0.042, 0.036, 0.037), (0.962, 0.04, 0.034, 0.035),
]
BRACER = (0.972, 1.163)   # the arm's faces between these heights are its bracer
LEG = [
    (1.00, 0.118, 0.118, 0.12), (0.90, 0.12, 0.12, 0.125), (0.80, 0.112, 0.11, 0.112), (0.70, 0.102, 0.098, 0.10),
    (0.62, 0.092, 0.09, 0.092), (0.555, 0.086, 0.09, 0.084), (0.49, 0.084, 0.078, 0.092), (0.42, 0.08, 0.072, 0.094),
]


def _hand(x, closed):
    if closed:
        return [blob((0.262 * x, -0.008, 0.905), (0.036, 0.05, 0.047)),
                seg((0.25 * x, -0.048, 0.94), (0.25 * x, -0.064, 0.905), 0.015)]
    return [blob((0.263 * x, -0.008, 0.915), (0.022, 0.048, 0.052)),
            seg((0.264 * x, -0.01, 0.885), (0.268 * x, -0.014, 0.79), 0.018, 0.043),
            seg((0.254 * x, -0.048, 0.94), (0.248 * x, -0.07, 0.872), 0.015)]


def _torso_weights(p):
    z, ax = p[:, 2], np.abs(p[:, 0])
    neck = ramp(z, 1.47, 1.53) * (1 - ramp(ax, 0.06, 0.11))
    chest = np.clip(ramp(z, 1.20, 1.30) - neck, 0, 1)
    spine = np.clip(ramp(z, 1.0, 1.08) - ramp(z, 1.20, 1.30), 0, 1)
    pelvis = 1 - ramp(z, 1.0, 1.08)
    return np.stack([pelvis, spine, chest, neck], axis=1)


def _arm_weights(p):
    z = p[:, 2]
    clav = 0.6 * ramp(z, 1.40, 1.48)
    farm = 1 - ramp(z, 1.17, 1.23)
    uarm = np.clip(1 - clav - farm, 0, 1)
    return np.stack([clav, uarm, farm], axis=1)


def _leg_weights(p):
    z = p[:, 2]
    pelvis = 0.5 * ramp(z, 0.88, 0.98)
    shin = 1 - ramp(z, 0.50, 0.60)
    thigh = np.clip(1 - pelvis - shin, 0, 1)
    return np.stack([pelvis, thigh, shin], axis=1)


def _limb_axis(x):
    return lambda p: np.stack([np.full(len(p), x), np.zeros(len(p)), np.zeros(len(p))], axis=1)


def build_body(M):
    """The fighter: (rigid parts, skinned parts, hands {side: {'open': ob, 'fist': ob}})."""
    parts, skins, hands = [], [], {}

    # torso: the cuirass above the belt, mail below it, the coif's mail over the neck
    me = vloft('torso', TORSO, TORSO_CENTRE)
    face_materials(me, lambda c: 0 if c[2] > 1.095 and c[2] < 1.5 else 1 if c[2] <= 1.095 else 2)
    skins.append(Skinned('torso', me, [M['cuirass'], M['mail'], M['coif']], ['pelvis', 'spine', 'chest', 'neck'],
                         _torso_weights(coords(me))))

    def limb(s, x):
        arm_pts = [rest(f'uarm_{s}') + Vector((0, 0, 0.06)), rest(f'uarm_{s}'), rest(f'farm_{s}'), rest(f'hand_{s}')]
        me = vloft(f'arm_{s}', ARM, chain_centre(arm_pts), n=28)
        face_materials(me, lambda c: 1 if BRACER[0] < c[2] < BRACER[1] else 0)
        skins.append(Skinned(f'arm_{s}', me, [M['skin'], M['bracer']], [f'clav_{s}', f'uarm_{s}', f'farm_{s}'],
                             _arm_weights(coords(me))))
        leg_pts = [rest(f'thigh_{s}') + Vector((0, 0, 0.06)), rest(f'thigh_{s}'), rest(f'shin_{s}'), rest(f'foot_{s}')]
        me = vloft(f'leg_{s}', LEG, chain_centre(leg_pts), n=32)
        skins.append(Skinned(f'leg_{s}', me, M['mail'], ['pelvis', f'thigh_{s}', f'shin_{s}'], _leg_weights(coords(me)),
                             axis=_limb_axis(0.105 * x)))
        hands[s] = {}
        for kind, closed in (('open', False), ('fist', True)):
            ob = _rigid(f'hand_{s}_{kind}', blob_mesh(f'hand_{s}_{kind}', _hand(x, closed), res=0.005), M['skin'])
            _hang(parts, ob, f'hand_{s}')
            hands[s][kind] = ob
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

    # head: face and jaw under a mail coif, the silver helm with its nasal and cheek guards over both
    _hang(parts, _rigid('face', blob_mesh('face', [
        blob((0, -0.035, 1.665), (0.085, 0.098, 0.11)), blob((0, -0.085, 1.585), (0.058, 0.055, 0.045)),
        blob((0, -0.136, 1.645), (0.014, 0.022, 0.026)), blob((0, -0.12, 1.69), (0.066, 0.025, 0.02))],
        res=0.005), M['face']), 'head')
    _hang(parts, loft('coif', (0, -0.025, 1.72), (0, -0.02, 1.47), [
        (0.0, 0.10, 0.10, 0, 0.018), (0.25, 0.108, 0.112, 0, 0.022), (0.55, 0.10, 0.10, 0, 0.03),
        (0.8, 0.088, 0.088, 0, 0.026), (1.0, 0.075, 0.075, 0, 0.02)],
        M['coif'], cap=(True, False)), 'head')
    _hang(parts, ellipsoid('helm', (0, -0.04, 1.65), (0.114, 0.134, 0.17), M['silver'], z_cut=1.665,
                           subsurf=2, tilt_x=-14), 'head')
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
        for z, half, depth in ((1.135, 0.10, 0.128), (1.0, 0.095, 0.122), (0.86, 0.088, 0.124), (0.74, 0.08, 0.13)):
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


def build_bow(M):
    """The long bow in its own frame: the left-hand grip at the origin, limbs along +-Z, its back toward -Y."""
    pts = [(0, 0.11 * (z / 0.66) ** 2, z) for z in [i * 0.66 / 8 for i in range(-8, 9)]]
    return [tube_path('bow', pts, lambda t: 0.011 + 0.007 * (1 - abs(2 * t - 1)), M['wood'], n=6)]


def bow_tips():
    return Vector((0, 0.11, 0.66)), Vector((0, 0.11, -0.66))


def string_mesh(M, a, nock, b):
    return tube_path('bowstring', [a, nock, b], 0.003, M['string'], n=4, subsurf=0)


def arrow_mesh(M, nock, tip):
    return tube_path('arrow', [nock, tip], 0.005, M['wood'], n=4, subsurf=0)

