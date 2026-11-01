"""The forge's materials. Patterns read each mesh's rest position, so a scale or a lamella rides its part and never
swims. `TINT` holds the fitted colour of each (fit.py --colour): a factor a channel, laid on every colour it holds."""
import json
import os

import bpy

TINT = {}


def load_tint(path):
    TINT.clear()
    if os.path.exists(path):
        TINT.update(json.load(open(path)))


def tint(m, f):
    """Multiply every colour material `m` holds (its base colour, its ramps' stops) by the factors `f`."""
    def mul(c):
        return (c[0] * f[0], c[1] * f[1], c[2] * f[2], c[3])
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED' and not n.inputs['Base Color'].is_linked:
            n.inputs['Base Color'].default_value = mul(n.inputs['Base Color'].default_value)
        if n.type == 'VALTORGB':
            for e in n.color_ramp.elements:
                e.color = mul(e.color)


def _principled(name, rgb, metal=0.0, rough=0.5, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    b.inputs['Specular IOR Level'].default_value = spec
    return m, b


def plain(name, rgb, metal=0.0, rough=0.5, spec=0.5):
    return _principled(name, rgb, metal, rough, spec)[0]


def _rest(nt):
    """The mesh's rest position (body.py): a pattern read from it stays put however the mesh is posed."""
    at = nt.nodes.new('ShaderNodeAttribute')
    at.attribute_type = 'GEOMETRY'
    at.attribute_name = 'rest'
    return at.outputs['Vector']


def _coords(m, scale):
    nt = m.node_tree
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = scale
    nt.links.new(_rest(nt), mp.inputs['Vector'])
    return mp.outputs['Vector']


def chain(name, dark, light, around=11.0, rows=95.0, rough=0.45):
    """Mail: a regular diamond lattice wrapped round the part's own axis (object Z), bright rings on dark gaps.
    `around` is diamonds round the limb, `rows` the lattice's frequency up it (radians a metre)."""
    m, b = _principled(name, light, metal=0.55, rough=rough)
    nt = m.node_tree
    L = nt.links
    xyz = nt.nodes.new('ShaderNodeSeparateXYZ')
    L.new(_rest(nt), xyz.inputs[0])

    def op(kind, a, b_=None, val=None):
        n = nt.nodes.new('ShaderNodeMath')
        n.operation = kind
        L.new(a, n.inputs[0]) if not isinstance(a, float) else n.inputs[0].__setattr__('default_value', a)
        if b_ is not None:
            L.new(b_, n.inputs[1]) if not isinstance(b_, float) else n.inputs[1].__setattr__('default_value', b_)
        return n.outputs[0]
    ang = op('ARCTAN2', xyz.outputs['Y'], xyz.outputs['X'])
    u = op('MULTIPLY', ang, float(around))
    v = op('MULTIPLY', xyz.outputs['Z'], float(rows))
    p1 = op('ABSOLUTE', op('SINE', op('ADD', u, v)))
    p2 = op('ABSOLUTE', op('SINE', op('SUBTRACT', u, v)))
    f = op('MULTIPLY', p1, p2)
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.12
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[1].color = (*light, 1)
    L.new(f, ramp.inputs['Fac'])
    L.new(ramp.outputs['Color'], b.inputs['Base Color'])
    return m


def lamellar(name, dark, light, bands=36.0, rough=0.35):
    """Plates in rows: horizontal bands with bright upper rims."""
    m, b = _principled(name, dark, metal=0.9, rough=rough)
    nt = m.node_tree
    vec = _coords(m, (1.0, 1.0, 1.0))
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'Z'
    wave.wave_profile = 'SAW'
    wave.inputs['Scale'].default_value = bands / 6.0
    wave.inputs['Distortion'].default_value = 0.0
    nt.links.new(vec, wave.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.55
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].position = 0.95
    ramp.color_ramp.elements[1].color = (*light, 1)
    nt.links.new(wave.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.5
    bump.inputs['Distance'].default_value = 0.01
    nt.links.new(wave.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m


def speckle(name, dark, light, scale=30.0, at=0.5, rough=0.4):
    """Dark worked plate with soft lighter patches: the cuirass's metal."""
    m, b = _principled(name, dark, metal=0.6, rough=rough)
    nt = m.node_tree
    vec = _coords(m, (scale, scale, scale))
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 1.0
    nz.inputs['Detail'].default_value = 1.0
    nt.links.new(vec, nz.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = at
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].position = at + 0.15
    ramp.color_ramp.elements[1].color = (*light, 1)
    nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    return m


def palette():
    """Every material the medium fighter wears, by role, in its fitted colour."""
    mats = _palette()
    for name, f in TINT.items():
        if name in mats:
            tint(mats[name], f)
    return mats


def _palette():
    return {
        'skin': plain('skin', (0.42, 0.13, 0.03), rough=0.5, spec=0.4),
        'silver': plain('silver', (0.62, 0.62, 0.64), metal=0.55, rough=0.32),
        'cuirass': speckle('cuirass', (0.03, 0.03, 0.035), (0.16, 0.16, 0.18), scale=70.0, at=0.52),
        'mail': chain('mail', (0.015, 0.015, 0.02), (0.30, 0.30, 0.33)),
        'coif': chain('coif', (0.02, 0.02, 0.025), (0.22, 0.22, 0.24), around=14.0, rows=120.0),
        'leather': plain('leather', (0.16, 0.07, 0.025), rough=0.6),
        'cloth': plain('cloth', (0.045, 0.14, 0.015), rough=0.75, spec=0.25),
        'boot': plain('boot', (0.012, 0.17, 0.18), rough=0.4, spec=0.45),
        'bracer': plain('bracer', (0.42, 0.42, 0.45), metal=1.0, rough=0.3),
        'blade': plain('blade', (0.025, 0.025, 0.028), metal=0.3, rough=0.5),
        'edge': plain('edge', (0.75, 0.75, 0.78), metal=1.0, rough=0.2),
        'haft': plain('haft', (0.07, 0.05, 0.04), rough=0.5),
        'wood': plain('wood', (0.35, 0.17, 0.06), rough=0.5),
        'string': plain('string', (0.75, 0.70, 0.60), rough=0.8),
        'face': plain('face', (0.22, 0.07, 0.02), rough=0.6, spec=0.3),
    }
