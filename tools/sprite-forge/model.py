"""The medium fighter: a body in a silver helm and pauldrons, a lamellar cuirass, mail legs, a loincloth, cuffed boots
and bracers, with a double-bit war axe and a long bow. Each part is built in world rest space and hung on one joint.

A part is a tuple (object, joint). Weapons are built in their own frame: the right-hand grip at the origin, the
haft (or the bow's riser) along +Z."""
from mathutils import Matrix, Vector

from rig import rest
from shapes import ellipsoid, loft, plate, sheet, tube_path


def _hang(parts, ob, joint):
    ob.data.transform(Matrix.Translation(-rest(joint)))
    parts.append((ob, joint))


def _mirror(fn):
    for s, x in (('L', 1.0), ('R', -1.0)):
        fn(s, x)


def build_body(M):
    parts = []

    # head: face, mail coif behind and around it, the silver helm over both
    _hang(parts, ellipsoid('face', (0, -0.012, 1.655), (0.083, 0.098, 0.115), M['face'], subsurf=1), 'head')
    _hang(parts, ellipsoid('chin', (0, -0.07, 1.575), (0.05, 0.04, 0.035), M['skin'], subsurf=1), 'head')
    _hang(parts, loft('coif', (0, 0, 1.72), (0, 0, 1.45), [
        (0.0, 0.10, 0.10, 0, 0.018), (0.25, 0.108, 0.112, 0, 0.022), (0.55, 0.10, 0.10, 0, 0.03),
        (0.75, 0.092, 0.092, 0, 0.026), (0.92, 0.13, 0.11, 0, 0.02), (1.0, 0.155, 0.12, 0, 0.02)],
        M['coif'], cap=(True, False)), 'head')
    _hang(parts, ellipsoid('helm', (0, -0.006, 1.65), (0.116, 0.136, 0.172), M['silver'], z_cut=1.66,
                           subsurf=2, tilt_x=-14), 'head')
    _hang(parts, plate('nasal', [(-0.014, 1.70), (0.014, 1.70), (0.01, 1.60), (-0.01, 1.60)], 0.012,
                       M['silver'], 'XZ', (0, -0.122, 0)), 'head')
    _mirror(lambda s, x: _hang(parts, plate(f'cheek_{s}', [(-0.108, 1.675), (-0.02, 1.675), (-0.03, 1.59),
                                                          (-0.075, 1.565), (-0.098, 1.605)], 0.012,
                                            M['silver'], 'YZ', (0.10 * x, 0, 0)), 'head'))
    _hang(parts, loft('neck', (0, 0, 1.46), (0, 0, 1.60), [(0, 0.06, 0.06), (1, 0.052, 0.052)], M['skin']), 'neck')

    # torso: a sculpted shell in two pieces so the chest can turn on the waist; a silver rim under the collar
    _hang(parts, loft('cuirass_lo', (0, 0, 1.04), (0, 0, 1.32), [
        (0.0, 0.175, 0.13), (0.4, 0.17, 0.128), (1.0, 0.20, 0.145, 0, -0.008)], M['cuirass']), 'spine')
    _hang(parts, loft('cuirass_hi', (0, 0, 1.27), (0, 0, 1.53), [
        (0.0, 0.20, 0.145, 0, -0.008), (0.25, 0.215, 0.152, 0, -0.014), (0.45, 0.228, 0.16, 0, -0.02),
        (0.7, 0.22, 0.152, 0, -0.012), (0.9, 0.17, 0.12), (1.0, 0.10, 0.08)], M['cuirass']), 'chest')
    _mirror(lambda s, x: _hang(parts, ellipsoid(f'pec_{s}', (0.09 * x, -0.115, 1.385), (0.10, 0.06, 0.075),
                                                M['cuirass'], subsurf=1), 'chest'))
    _hang(parts, loft('collar', (0, 0, 1.43), (0, 0, 1.455), [(0, 0.224, 0.158, 0, -0.016),
                                                            (1, 0.22, 0.155, 0, -0.015)],
                      M['silver'], subsurf=1), 'chest')
    _mirror(lambda s, x: _hang(parts, ellipsoid(f'pauldron_{s}', (0.20 * x, 0.01, 1.415), (0.15, 0.145, 0.14),
                                                M['silver'], z_cut=1.445, subsurf=2, tilt_y=16 * x, tilt_x=25),
                               f'clav_{s}'))

    # hips: mail under a belt, the loincloth hung front and back
    _hang(parts, loft('hips', (0, 0, 0.84), (0, 0, 1.12), [
        (0.0, 0.15, 0.11), (0.3, 0.19, 0.13), (1.0, 0.178, 0.13)], M['mail']), 'pelvis')
    _hang(parts, loft('belt', (0, 0, 1.10), (0, 0, 1.15), [(0, 0.192, 0.141), (1, 0.19, 0.139)],
                      M['leather'], subsurf=1), 'pelvis')
    for side, y in (('front', -1.0), ('back', 1.0)):
        rows = []
        for z, half, depth in ((1.135, 0.12, 0.147), (1.0, 0.11, 0.146), (0.86, 0.10, 0.136),
                               (0.74, 0.092, 0.122)):
            rows.append([(-half, depth * y, z), (0, (depth + 0.008) * y, z), (half, depth * y, z)])
        _hang(parts, sheet(f'loin_{side}', rows, M['cloth'], thickness=0.008), 'pelvis')

    # legs: mail to the boot, the boot's cuff turned down, the foot
    def leg(s, x):
        _hang(parts, loft(f'thigh_{s}', (0.10 * x, 0, 0.99), (0.105 * x, 0, 0.55), [
            (0.0, 0.118, 0.122), (0.45, 0.108, 0.11), (1.0, 0.092, 0.095)], M['mail']), f'thigh_{s}')
        _hang(parts, loft(f'shin_{s}', (0.105 * x, 0, 0.59), (0.11 * x, 0, 0.38), [
            (0.0, 0.092, 0.095), (0.5, 0.09, 0.094), (1.0, 0.078, 0.082)], M['mail']), f'shin_{s}')
        _hang(parts, loft(f'boot_{s}', (0.106 * x, 0.0, 0.44), (0.11 * x, 0.015, 0.05), [
            (0.0, 0.115, 0.118), (0.09, 0.11, 0.112), (0.17, 0.088, 0.09), (0.45, 0.085, 0.088),
            (0.85, 0.068, 0.072), (1.0, 0.068, 0.072)], M['boot']), f'shin_{s}')
        _hang(parts, loft(f'foot_{s}', (0.11 * x, 0.055, 0.055), (0.115 * x, -0.19, 0.035), [
            (0.0, 0.064, 0.058), (0.3, 0.07, 0.062), (0.8, 0.062, 0.042), (1.0, 0.04, 0.026)], M['boot']),
            f'foot_{s}')
    _mirror(leg)

    # arms: bare skin, bracers from below the elbow to the wrist, long open hands
    def arm(s, x):
        _hang(parts, loft(f'uarm_{s}', (0.215 * x, 0, 1.47), (0.245 * x, 0.01, 1.20), [
            (-0.05, 0.07, 0.07), (0.22, 0.076, 0.072), (0.55, 0.066, 0.068), (1.0, 0.052, 0.055)],
            M['skin']), f'uarm_{s}')
        _hang(parts, loft(f'farm_{s}', (0.245 * x, 0.01, 1.215), (0.26 * x, -0.005, 0.965), [
            (0.0, 0.055, 0.058), (0.3, 0.06, 0.062), (1.0, 0.04, 0.044)], M['skin']), f'farm_{s}')
        _hang(parts, loft(f'bracer_{s}', (0.245 * x, 0.01, 1.215), (0.26 * x, -0.005, 0.965), [
            (0.2, 0.074, 0.076), (0.26, 0.069, 0.071), (0.6, 0.062, 0.064), (1.02, 0.05, 0.055)],
            M['bracer'], subsurf=1), f'farm_{s}')
        _hang(parts, loft(f'hand_{s}', (0.26 * x, -0.005, 0.975), (0.265 * x, -0.01, 0.80), [
            (0.0, 0.034, 0.045), (0.3, 0.038, 0.062), (0.75, 0.036, 0.058), (1.0, 0.024, 0.036)],
            M['skin']), f'hand_{s}')
    _mirror(arm)
    return parts


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

