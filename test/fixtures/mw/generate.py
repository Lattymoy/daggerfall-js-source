# Generates the Morrowind-format fixtures in this directory.
#
#   python3 generate.py
#
# NIF fixtures are authored with pyffi (niftools, BSD) - an independent
# implementation of the NIF spec - so the JS reader in
# src/formats/mwNifFile.js is tested against a writer that shares none of
# its assumptions. Requires pyffi patched for py3.12 (time.clock ->
# time.perf_counter) AND one fix to its nifxml/nif.xml: delete the
# duplicate `<add name="Num UV Sets" type="byte" vercond="Version >=
# 10.0.1.0">` element (2 lines) from NiGeometryData. pyffi wrongly picks
# that byte-typed duplicate when writing 4.0.0.2, where the field is a
# ushort (nifxml ver2=4.2.2.0 entry; confirmed by OpenMW, which reads u16
# against all retail Morrowind meshes). The BSA fixture is written by the
# plain struct code below, straight from the documented v0x100 layout.
#
# Committed outputs: mesh.nif, skinned.nif, fixture.bsa. Regenerate only
# when the fixture *content* needs to change, and re-pin the tests.

import math
import struct
from pathlib import Path

from pyffi.formats.nif import NifFormat

HERE = Path(__file__).parent
MW_VERSION = 0x04000002


def ident(m):
    m.set_identity()


def write_nif(path, roots):
    data = NifFormat.Data(version=MW_VERSION)
    data.roots = roots
    with open(path, "wb") as f:
        data.write(f)
    print("wrote", path)


def make_mesh():
    root = NifFormat.NiNode()
    root.name = b"Root"
    ident(root.rotation)
    root.scale = 1.0

    tri = NifFormat.NiTriShape()
    tri.name = b"Quad"
    ident(tri.rotation)
    tri.scale = 1.0
    tri.translation.x, tri.translation.y, tri.translation.z = 1.0, 2.0, 3.0
    root.add_child(tri)

    d = NifFormat.NiTriShapeData()
    tri.data = d
    d.num_vertices = 4
    d.has_vertices = True
    d.vertices.update_size()
    verts = [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)]
    for v, (x, y, z) in zip(d.vertices, verts):
        v.x, v.y, v.z = x, y, z
    d.has_normals = True
    d.normals.update_size()
    for n in d.normals:
        n.x, n.y, n.z = 0.0, 0.0, 1.0
    d.has_vertex_colors = True
    d.vertex_colors.update_size()
    cols = [(1, 0, 0, 1), (0, 1, 0, 1), (0, 0, 1, 1), (1, 1, 1, 0.5)]
    for c, (r, g, b, a) in zip(d.vertex_colors, cols):
        c.r, c.g, c.b, c.a = r, g, b, a
    d.num_uv_sets = 1
    d.has_uv = True
    d.uv_sets.update_size()
    uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
    for uv, (u, v) in zip(d.uv_sets[0], uvs):
        uv.u, uv.v = u, v
    d.num_triangles = 2
    d.num_triangle_points = 6
    d.triangles.update_size()
    for t, (a, b, c) in zip(d.triangles, [(0, 1, 2), (0, 2, 3)]):
        t.v_1, t.v_2, t.v_3 = a, b, c
    d.update_center_radius()

    mat = NifFormat.NiMaterialProperty()
    mat.name = b"Mat"
    mat.ambient_color.r, mat.ambient_color.g, mat.ambient_color.b = 0.1, 0.2, 0.3
    mat.diffuse_color.r, mat.diffuse_color.g, mat.diffuse_color.b = 1.0, 0.5, 0.25
    mat.specular_color.r, mat.specular_color.g, mat.specular_color.b = 0.0, 0.0, 0.0
    mat.emissive_color.r, mat.emissive_color.g, mat.emissive_color.b = 0.0, 0.0, 0.0
    mat.glossiness = 10.0
    mat.alpha = 0.8

    src = NifFormat.NiSourceTexture()
    src.name = b"Tex"
    src.use_external = 1
    src.file_name = b"textures\\fixture.dds"
    src.pixel_layout = 5
    src.use_mipmaps = 2
    src.alpha_format = 3
    src.is_static = 1

    texp = NifFormat.NiTexturingProperty()
    texp.apply_mode = 2
    texp.texture_count = 7
    texp.has_base_texture = True
    texp.base_texture.source = src
    texp.base_texture.clamp_mode = 3
    texp.base_texture.filter_mode = 2
    texp.base_texture.uv_set = 0

    tri.num_properties = 2
    tri.properties.update_size()
    tri.properties[0] = mat
    tri.properties[1] = texp

    write_nif(HERE / "mesh.nif", [root])


def build_skinned_rig():
    # Shared by skinned.nif and animated.nif: root, two bones (Bone1 at
    # z=1), a 4-vert strip skinned to them. The per-bone NiSkinData
    # transform is the INVERSE BIND (mesh space -> bone space), so Bone_i
    # carries translation z = -i; at rest the skinning identity
    # world(bone) o invBind collapses to I and the authored verts come
    # back exactly - the round-trip test/mwanim.test.js pins.
    root = NifFormat.NiNode()
    root.name = b"SkinRoot"
    ident(root.rotation)
    root.scale = 1.0

    bones = []
    for i in range(2):
        b = NifFormat.NiNode()
        b.name = f"Bone{i}".encode()
        ident(b.rotation)
        b.scale = 1.0
        b.translation.z = float(i)
        root.add_child(b)
        bones.append(b)

    tri = NifFormat.NiTriShape()
    tri.name = b"Skinned"
    ident(tri.rotation)
    tri.scale = 1.0
    root.add_child(tri)

    d = NifFormat.NiTriShapeData()
    tri.data = d
    d.num_vertices = 4
    d.has_vertices = True
    d.vertices.update_size()
    for v, (x, y, z) in zip(d.vertices, [(0, 0, 0), (1, 0, 0), (0, 0, 1), (1, 0, 1)]):
        v.x, v.y, v.z = x, y, z
    d.num_triangles = 2
    d.num_triangle_points = 6
    d.triangles.update_size()
    for t, (a, b, c) in zip(d.triangles, [(0, 1, 2), (1, 3, 2)]):
        t.v_1, t.v_2, t.v_3 = a, b, c
    d.update_center_radius()

    si = NifFormat.NiSkinInstance()
    sd = NifFormat.NiSkinData()
    si.data = sd
    si.skeleton_root = root
    si.num_bones = 2
    si.bones.update_size()
    si.bones[0], si.bones[1] = bones[0], bones[1]

    sd.num_bones = 2
    ident(sd.skin_transform.rotation)
    sd.skin_transform.scale = 1.0
    sd.bone_list.update_size()
    weights = [
        [(0, 1.0), (1, 1.0), (2, 0.4)],   # Bone0
        [(2, 0.6), (3, 1.0)],             # Bone1
    ]
    for i, (bl, wl) in enumerate(zip(sd.bone_list, weights)):
        ident(bl.skin_transform.rotation)
        bl.skin_transform.scale = 1.0
        bl.skin_transform.translation.z = -float(i)  # inverse bind
        bl.bounding_sphere_radius = 1.0
        bl.num_vertices = len(wl)
        bl.vertex_weights.update_size()
        for vw, (idx, w) in zip(bl.vertex_weights, wl):
            vw.index = idx
            vw.weight = w
    tri.skin_instance = si
    return root, bones


def make_skinned():
    root, _bones = build_skinned_rig()
    write_nif(HERE / "skinned.nif", [root])


def make_keyframe_data(rot_keys=None, trans_keys=None):
    kd = NifFormat.NiKeyframeData()
    if rot_keys:
        kd.num_rotation_keys = len(rot_keys)
        kd.rotation_type = 1  # linear quaternions
        kd.quaternion_keys.update_size()
        for k, (t, (w, x, y, z)) in zip(kd.quaternion_keys, rot_keys):
            k.time = t
            k.value.w, k.value.x, k.value.y, k.value.z = w, x, y, z
    if trans_keys:
        kd.translations.num_keys = len(trans_keys)
        kd.translations.interpolation = 1  # linear
        kd.translations.keys.update_size()
        for k, (t, (x, y, z)) in zip(kd.translations.keys, trans_keys):
            k.time = t
            k.value.x, k.value.y, k.value.z = x, y, z
    return kd


def make_keyframe_controller(target, kd, start, stop):
    kc = NifFormat.NiKeyframeController()
    kc.flags = 8  # active
    kc.frequency = 1.0
    kc.phase = 0.0
    kc.start_time = start
    kc.stop_time = stop
    kc.target = target
    kc.data = kd
    return kc


ROT90Z = (0.7071067811865476, 0.0, 0.0, 0.7071067811865476)  # w,x,y,z


def make_animated():
    # skinned rig + inline controllers + text-key groups, the way retail
    # base_anim.nif carries its animations. Two groups: Idle holds still,
    # Move slides Bone1 up one unit while Bone0 turns 90 deg about Z.
    # Since slice 6 this rig doubles as the fixture BASE SKELETON for
    # NPC assembly, so it carries two RETAIL-NAMED attach bones - Head
    # under Bone1, Chest under Bone0 - that the ESM part slots target.
    root, bones = build_skinned_rig()

    for parent, name, dz in ((bones[1], b"Head", 0.3), (bones[0], b"Chest", 0.2)):
        att = NifFormat.NiNode()
        att.name = name
        ident(att.rotation)
        att.scale = 1.0
        att.translation.z = dz
        parent.add_child(att)

    tke = NifFormat.NiTextKeyExtraData()
    tke.num_text_keys = 4
    tke.text_keys.update_size()
    for k, (t, txt) in zip(
        tke.text_keys,
        [(0.0, b"Idle: Start"), (0.5, b"Idle: Stop"), (0.5, b"Move: Start"), (1.5, b"Move: Stop")],
    ):
        k.time = t
        k.value = txt
    root.extra_data = tke

    kd0 = make_keyframe_data(rot_keys=[(0.5, (1.0, 0.0, 0.0, 0.0)), (1.5, ROT90Z)])
    bones[0].controller = make_keyframe_controller(bones[0], kd0, 0.0, 1.5)
    kd1 = make_keyframe_data(trans_keys=[(0.5, (0.0, 0.0, 1.0)), (1.5, (0.0, 0.0, 2.0))])
    bones[1].controller = make_keyframe_controller(bones[1], kd1, 0.0, 1.5)

    write_nif(HERE / "animated.nif", [root])


def make_kf():
    # External keyframes, the xbase_anim.kf shape: NiSequenceStreamHelper
    # whose extra chain is [text keys, one NiStringExtraData per
    # controller naming its bone] and whose controller chain pairs with
    # those names in order.
    helper = NifFormat.NiSequenceStreamHelper()
    helper.name = b"xfixture"

    tke = NifFormat.NiTextKeyExtraData()
    tke.num_text_keys = 2
    tke.text_keys.update_size()
    for k, (t, txt) in zip(tke.text_keys, [(0.0, b"Move: Start"), (1.0, b"Move: Stop")]):
        k.time = t
        k.value = txt

    sed = NifFormat.NiStringExtraData()
    sed.string_data = b"Bone1"
    sed.bytes_remaining = 4 + len(b"Bone1")

    helper.extra_data = tke
    tke.next_extra_data = sed

    kd = make_keyframe_data(trans_keys=[(0.0, (0.0, 0.0, 1.0)), (1.0, (0.0, 0.0, 3.0))])
    helper.controller = make_keyframe_controller(None, kd, 0.0, 1.0)

    write_nif(HERE / "xfixture.kf", [helper])


def make_dds():
    # 8x8 DXT1, four solid 4x4 quadrant blocks: red, green, blue, white.
    # Each block: c0 = the color, c1 = 0, all indices 0 -> decodes to c0
    # exactly (bit-replicated 565). Hand-packed straight from the spec so
    # the decoder, the BSA path, and the viewer all answer to known pixels.
    def block(c565):
        return struct.pack("<HHI", c565, 0x0000, 0x00000000)

    header = struct.pack("<4sII", b"DDS ", 124, 0x1 | 0x2 | 0x4 | 0x1000)
    header += struct.pack("<III", 8, 8, 0)  # height, width, pitch
    header += b"\x00" * (11 * 4 + 8)  # depth, mips, reserved[11]
    header += struct.pack("<II4s", 32, 0x4, b"DXT1")  # pf: size, FOURCC flag
    header += b"\x00" * 20  # bitcount + masks
    header += struct.pack("<I", 0x1000) + b"\x00" * 16  # caps, caps2-4, reserved2
    assert len(header) == 128, len(header)
    # Block order is row-major: (0,0) (1,0) then (0,1) (1,1).
    payload = block(0xF800) + block(0x07E0) + block(0x001F) + block(0xFFFF)
    (HERE / "fixture.dds").write_bytes(header + payload)
    print("wrote", HERE / "fixture.dds", 128 + len(payload), "bytes")


def make_plain():
    # The same textured quad WITHOUT vertex colors or material - the pure
    # texture path. mesh.nif deliberately carries vertex colors, and MW's
    # apply mode 2 is MODULATE, so its on-screen quadrants are texture x
    # color products; this one shows the texture straight, which is what
    # the viewer probe pins pixels against.
    root = NifFormat.NiNode()
    root.name = b"PlainRoot"
    ident(root.rotation)
    root.scale = 1.0

    tri = NifFormat.NiTriShape()
    tri.name = b"PlainQuad"
    ident(tri.rotation)
    tri.scale = 1.0
    root.add_child(tri)

    d = NifFormat.NiTriShapeData()
    tri.data = d
    d.num_vertices = 4
    d.has_vertices = True
    d.vertices.update_size()
    for v, (x, y, z) in zip(d.vertices, [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)]):
        v.x, v.y, v.z = x, y, z
    d.has_normals = True
    d.normals.update_size()
    for n in d.normals:
        n.x, n.y, n.z = 0.0, 0.0, 1.0
    d.num_uv_sets = 1
    d.has_uv = True
    d.uv_sets.update_size()
    for uv, (u, v) in zip(d.uv_sets[0], [(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.u, uv.v = u, v
    d.num_triangles = 2
    d.num_triangle_points = 6
    d.triangles.update_size()
    for t, (a, b, c) in zip(d.triangles, [(0, 1, 2), (0, 2, 3)]):
        t.v_1, t.v_2, t.v_3 = a, b, c
    d.update_center_radius()

    src = NifFormat.NiSourceTexture()
    src.name = b"Tex"
    src.use_external = 1
    src.file_name = b"textures\\fixture.dds"
    src.pixel_layout = 5
    src.use_mipmaps = 2
    src.alpha_format = 3
    src.is_static = 1

    texp = NifFormat.NiTexturingProperty()
    texp.apply_mode = 2
    texp.texture_count = 7
    texp.has_base_texture = True
    texp.base_texture.source = src
    texp.base_texture.clamp_mode = 3
    texp.base_texture.filter_mode = 2
    texp.base_texture.uv_set = 0

    tri.num_properties = 1
    tri.properties.update_size()
    tri.properties[0] = texp

    write_nif(HERE / "plain.nif", [root])


def make_flight_kf():
    # Root-motion fixture: Bone0's translation channel carries a 300-unit
    # flight along Y, the way retail movement groups carry the actor's
    # path in the accumulation root. Posing WITHOUT extraction must send
    # the mesh flying; WITH it, the body stays put and only Z animates.
    helper = NifFormat.NiSequenceStreamHelper()
    helper.name = b"xflight"
    sed = NifFormat.NiStringExtraData()
    sed.string_data = b"Bone0"
    sed.bytes_remaining = 4 + len(b"Bone0")
    helper.extra_data = sed
    kd = make_keyframe_data(trans_keys=[(0.0, (0.0, 0.0, 0.0)), (1.0, (0.0, 300.0, 0.0))])
    helper.controller = make_keyframe_controller(None, kd, 0.0, 1.0)
    write_nif(HERE / "xflight.kf", [helper])


def make_part():
    # A body-part file the retail way: its OWN copies of the bones it
    # needs (matching names, matching rest pose), a skinned shape weighted
    # to them, and an unskinned shape ("Hat") that assembly attaches to a
    # bone. The assembler rebinds everything onto the BASE skeleton by
    # bone name - these local nodes only carry the names across.
    root = NifFormat.NiNode()
    root.name = b"PartRoot"
    ident(root.rotation)
    root.scale = 1.0

    bones = []
    for i in range(2):
        b = NifFormat.NiNode()
        b.name = f"Bone{i}".encode()
        ident(b.rotation)
        b.scale = 1.0
        b.translation.z = float(i)
        root.add_child(b)
        bones.append(b)

    tri = NifFormat.NiTriShape()
    tri.name = b"PartSkin"
    ident(tri.rotation)
    tri.scale = 1.0
    root.add_child(tri)

    d = NifFormat.NiTriShapeData()
    tri.data = d
    d.num_vertices = 3
    d.has_vertices = True
    d.vertices.update_size()
    for v, (x, y, z) in zip(d.vertices, [(0.5, 0, 0), (1.5, 0, 0), (0.5, 0, 1)]):
        v.x, v.y, v.z = x, y, z
    d.num_triangles = 1
    d.num_triangle_points = 3
    d.triangles.update_size()
    d.triangles[0].v_1, d.triangles[0].v_2, d.triangles[0].v_3 = 0, 1, 2
    d.update_center_radius()

    si = NifFormat.NiSkinInstance()
    sd = NifFormat.NiSkinData()
    si.data = sd
    si.skeleton_root = root
    si.num_bones = 2
    si.bones.update_size()
    si.bones[0], si.bones[1] = bones[0], bones[1]
    sd.num_bones = 2
    ident(sd.skin_transform.rotation)
    sd.skin_transform.scale = 1.0
    sd.bone_list.update_size()
    weights = [[(0, 1.0), (1, 1.0)], [(2, 1.0)]]
    for i, (bl, wl) in enumerate(zip(sd.bone_list, weights)):
        ident(bl.skin_transform.rotation)
        bl.skin_transform.scale = 1.0
        bl.skin_transform.translation.z = -float(i)
        bl.bounding_sphere_radius = 1.0
        bl.num_vertices = len(wl)
        bl.vertex_weights.update_size()
        for vw, (idx, w) in zip(bl.vertex_weights, wl):
            vw.index = idx
            vw.weight = w
    tri.skin_instance = si

    hat = NifFormat.NiTriShape()
    hat.name = b"Hat"
    ident(hat.rotation)
    hat.scale = 1.0
    hat.translation.z = 0.2
    root.add_child(hat)
    hd = NifFormat.NiTriShapeData()
    hat.data = hd
    hd.num_vertices = 3
    hd.has_vertices = True
    hd.vertices.update_size()
    for v, (x, y, z) in zip(hd.vertices, [(0, 0, 0), (0.3, 0, 0), (0, 0.3, 0)]):
        v.x, v.y, v.z = x, y, z
    hd.num_triangles = 1
    hd.num_triangle_points = 3
    hd.triangles.update_size()
    hd.triangles[0].v_1, hd.triangles[0].v_2, hd.triangles[0].v_3 = 0, 1, 2
    hd.update_center_radius()

    write_nif(HERE / "part.nif", [root])


def make_rotbind():
    # ORDER-DISTINGUISHING skin fixture. The main rig's translation-only
    # inverse binds commute, so BoneSkel(InvBind(v)) and the REVERSE both
    # round-trip at rest - the composition order was untestable there
    # (and retail, whose binds rotate, is exactly where a reversed order
    # would explode). Here the bone RESTS rotated 90deg about Z with the
    # matching inverse bind Rz(-90), plus a translation on each side:
    # rest round-trips ONLY in the reference order.
    root = NifFormat.NiNode()
    root.name = b"RotRoot"
    ident(root.rotation)
    root.scale = 1.0

    b = NifFormat.NiNode()
    b.name = b"RotBone"
    b.scale = 1.0
    # rest: Rz(90) then translate (2, 0, 0). PYFFI TRAP: its m_RC names
    # are COLUMN-major against the NIF wire (proved by byte-walk when
    # this fixture first round-trip-failed) - wire position 1 receives
    # m_21, not m_12 - so authoring wire-row-major means assigning the
    # TRANSPOSE of what the name suggests.
    b.rotation.m_11, b.rotation.m_21, b.rotation.m_31 = 0.0, -1.0, 0.0
    b.rotation.m_12, b.rotation.m_22, b.rotation.m_32 = 1.0, 0.0, 0.0
    b.rotation.m_13, b.rotation.m_23, b.rotation.m_33 = 0.0, 0.0, 1.0
    b.translation.x = 2.0
    root.add_child(b)

    tri = NifFormat.NiTriShape()
    tri.name = b"RotSkin"
    ident(tri.rotation)
    tri.scale = 1.0
    root.add_child(tri)

    d = NifFormat.NiTriShapeData()
    tri.data = d
    d.num_vertices = 3
    d.has_vertices = True
    d.vertices.update_size()
    for v, (x, y, z) in zip(d.vertices, [(1, 0, 0), (2, 0, 0), (1, 1, 0)]):
        v.x, v.y, v.z = x, y, z
    d.num_triangles = 1
    d.num_triangle_points = 3
    d.triangles.update_size()
    d.triangles[0].v_1, d.triangles[0].v_2, d.triangles[0].v_3 = 0, 1, 2
    d.update_center_radius()

    si = NifFormat.NiSkinInstance()
    sd = NifFormat.NiSkinData()
    si.data = sd
    si.skeleton_root = root
    si.num_bones = 1
    si.bones.update_size()
    si.bones[0] = b
    sd.num_bones = 1
    ident(sd.skin_transform.rotation)
    sd.skin_transform.scale = 1.0
    sd.bone_list.update_size()
    bl = sd.bone_list[0]
    # inverse bind = inverse of the rest: Rz(-90) o translate(-2,0,0)
    # as one affine: A = Rz(-90), t = A*(-2,0,0) = (0, 2, 0).
    # Same pyffi transpose trap as above: assign column-wise.
    bl.skin_transform.rotation.m_11, bl.skin_transform.rotation.m_21 = 0.0, 1.0
    bl.skin_transform.rotation.m_12, bl.skin_transform.rotation.m_22 = -1.0, 0.0
    bl.skin_transform.rotation.m_33 = 1.0
    bl.skin_transform.rotation.m_31 = bl.skin_transform.rotation.m_32 = 0.0
    bl.skin_transform.rotation.m_13 = bl.skin_transform.rotation.m_23 = 0.0
    bl.skin_transform.translation.y = 2.0
    bl.skin_transform.scale = 1.0
    bl.bounding_sphere_radius = 1.0
    bl.num_vertices = 3
    bl.vertex_weights.update_size()
    for i, vw in enumerate(bl.vertex_weights):
        vw.index = i
        vw.weight = 1.0
    tri.skin_instance = si

    write_nif(HERE / "rotbind.nif", [root])


def make_esm():
    # Independent TES3 writer, struct-level like the BSA one: header,
    # a race, skin/head/hair BODY records over the fixture meshes, a
    # male and a female NPC, and one JUNK record the parser must skip
    # by size and census. Every string zero-terminated the retail way.
    def sub(tag, data):
        return tag + struct.pack("<I", len(data)) + data

    def rec(tag, subs, flags=0):
        data = b"".join(subs)
        return tag + struct.pack("<III", len(data), 0, flags) + data

    z = lambda s: s.encode() + b"\x00"

    hedr = struct.pack("<fI", 1.3, 1)
    hedr += b"fixture".ljust(32, b"\x00")
    hedr += b"generated by test/fixtures/mw/generate.py".ljust(256, b"\x00")
    hedr += struct.pack("<I", 9)
    out = rec(b"TES3", [sub(b"HEDR", hedr)])

    radt = b"\x00" * 120 + struct.pack("<ffffI", 1.0, 0.95, 1.0, 0.9, 1)
    out += rec(b"RACE", [sub(b"NAME", z("TestRace")), sub(b"FNAM", z("Test Race")),
                         sub(b"RADT", radt)])

    def body(bid, model, part, female=0, kind=0):
        bydt = bytes([part, 0, 1 if female else 0, kind])
        return rec(b"BODY", [sub(b"NAME", z(bid)), sub(b"MODL", z(model)),
                             sub(b"FNAM", z("TestRace")), sub(b"BYDT", bydt)])

    out += body("b_test_head", "fixture\\mesh.nif", 0)
    out += body("b_test_hair", "fixture\\plain.nif", 1)
    out += body("b_test_chest", "fixture\\part.nif", 3)
    out += body("b_test_chest_f", "fixture\\part.nif", 3, female=1)

    npdt = struct.pack("<hBBB3xI", 1, 50, 0, 0, 0)
    def npc(nid, name, flag):
        return rec(b"NPC_", [sub(b"NAME", z(nid)), sub(b"FNAM", z(name)),
                             sub(b"RNAM", z("TestRace")), sub(b"CNAM", z("Commoner")),
                             sub(b"BNAM", z("b_test_head")), sub(b"KNAM", z("b_test_hair")),
                             sub(b"NPDT", npdt), sub(b"FLAG", struct.pack("<I", flag))])

    out += npc("test npc", "Test NPC", 0x10)
    out += npc("test npc f", "Test NPC F", 0x11)
    out += rec(b"JUNK", [sub(b"DATA", b"\x01\x02\x03\x04\x05\x06")])

    (HERE / "fixture.esm").write_bytes(out)
    print("wrote", HERE / "fixture.esm", len(out), "bytes")


def make_bsa():
    # Independent Morrowind BSA v0x100 writer, straight from the layout doc
    # in src/formats/mwBsaFile.js. Hash table intentionally zeroed - names
    # are authoritative and both OpenMW and our reader ignore hashes.
    files = [
        (b"meshes\\fixture\\Mesh.NIF", (HERE / "mesh.nif").read_bytes()),
        (b"meshes\\fixture\\skinned.nif", (HERE / "skinned.nif").read_bytes()),
        (b"meshes\\fixture\\plain.nif", (HERE / "plain.nif").read_bytes()),
        (b"meshes\\fixture\\animated.nif", (HERE / "animated.nif").read_bytes()),
        (b"meshes\\fixture\\xfixture.kf", (HERE / "xfixture.kf").read_bytes()),
        (b"meshes\\fixture\\part.nif", (HERE / "part.nif").read_bytes()),
        (b"meshes\\base_anim.nif", (HERE / "animated.nif").read_bytes()),
        (b"textures\\fixture.dds", (HERE / "fixture.dds").read_bytes()),
    ]
    name_buf = b""
    name_offsets = []
    for name, _ in files:
        name_offsets.append(len(name_buf))
        name_buf += name + b"\x00"
    dir_size = 12 * len(files) + len(name_buf)

    out = struct.pack("<III", 0x100, dir_size, len(files))
    offset = 0
    for _, content in files:
        out += struct.pack("<II", len(content), offset)
        offset += len(content)
    for off in name_offsets:
        out += struct.pack("<I", off)
    out += name_buf
    out += b"\x00" * (8 * len(files))  # hash table
    for _, content in files:
        out += content
    (HERE / "fixture.bsa").write_bytes(out)
    print("wrote", HERE / "fixture.bsa", len(out), "bytes")


# ---------------------------------------------------------------------
# MW-D6: the ARM fixtures.
#
# Every fixture above speaks the vocabulary SkinRoot/Bone0/Bone1/Head/
# Chest and names its shapes "Skinned"/"PartSkin"/"Hat". That vocabulary
# cannot exercise two of the attachment rules AT ALL, which is exactly
# what MW-D5 recorded and what let three mutants survive a full sweep:
#
#   rule 15 (the bone name is a geometry filter) - its ACCEPT branch
#     needs a shape NAMED after a bone the skeleton carries;
#   rule 13 (a rigid part on a "left" bone is drawn x-negated) - needs a
#     bone whose name contains "left".
#
# These four give both a home. The names are Morrowind's, from rule 5's
# sPartList table, so the assembly runs the real PART_BONES path with no
# test-only override.
#
# DELIBERATELY ABSENT: "Weapon Bone", "Weapon Bone Left", "Bip01 Spine1".
# MW-D4's report asserts that a skeleton lacking them SAYS so, and that
# half must stay exercised.


def _bone(parent, name, t=(0.0, 0.0, 0.0)):
    b = NifFormat.NiNode()
    b.name = name.encode()
    ident(b.rotation)
    b.scale = 1.0
    b.translation.x, b.translation.y, b.translation.z = t
    parent.add_child(b)
    return b


def _tri(parent, name, verts, tris=((0, 1, 2),)):
    tri = NifFormat.NiTriShape()
    tri.name = name.encode()
    ident(tri.rotation)
    tri.scale = 1.0
    parent.add_child(tri)
    d = NifFormat.NiTriShapeData()
    tri.data = d
    d.num_vertices = len(verts)
    d.has_vertices = True
    d.vertices.update_size()
    for v, (x, y, z) in zip(d.vertices, verts):
        v.x, v.y, v.z = x, y, z
    d.num_triangles = len(tris)
    d.num_triangle_points = 3 * len(tris)
    d.triangles.update_size()
    for t, (a, b, c) in zip(d.triangles, tris):
        t.v_1, t.v_2, t.v_3 = a, b, c
    d.update_center_radius()
    return tri


def _skin_to(tri, root, bones_and_weights):
    """One NiSkinInstance over (bone node, invBind translation, [(vert, w)])."""
    si = NifFormat.NiSkinInstance()
    sd = NifFormat.NiSkinData()
    si.data = sd
    si.skeleton_root = root
    si.num_bones = len(bones_and_weights)
    si.bones.update_size()
    sd.num_bones = len(bones_and_weights)
    ident(sd.skin_transform.rotation)
    sd.skin_transform.scale = 1.0
    sd.bone_list.update_size()
    for i, (node, inv_t, wl) in enumerate(bones_and_weights):
        si.bones[i] = node
        bl = sd.bone_list[i]
        ident(bl.skin_transform.rotation)
        bl.skin_transform.scale = 1.0
        # THE INVERSE BIND: minus the bone's skeleton-space translation, so
        # at rest world(bone) o invBind collapses to I and the authored
        # verts come back exactly - the same round trip build_skinned_rig
        # relies on, stated per bone because these bones are not on an axis.
        (bl.skin_transform.translation.x,
         bl.skin_transform.translation.y,
         bl.skin_transform.translation.z) = inv_t
        bl.bounding_sphere_radius = 1.0
        bl.num_vertices = len(wl)
        bl.vertex_weights.update_size()
        for vw, (idx, w) in zip(bl.vertex_weights, wl):
            vw.index = idx
            vw.weight = w
    tri.skin_instance = si


# Skeleton-space rest of the arm chain, both sides. Kept here because the
# fixtures below and the tests both need the same numbers.
ARM_REST = {
    "Right Upper Arm": (1.0, 0.0, 3.0), "Left Upper Arm": (-1.0, 0.0, 3.0),
    "Right Forearm": (1.0, 0.0, 2.0), "Left Forearm": (-1.0, 0.0, 2.0),
    "Right Hand": (1.0, 0.0, 1.0), "Left Hand": (-1.0, 0.0, 1.0),
}


def make_armskel():
    # A CHAIN, not a flat list: upper arm -> forearm -> hand, each child a
    # further -1 in z. A flat list would let a "parent chain ignored"
    # mutant survive, because every bone would already be in skeleton
    # space.
    root = NifFormat.NiNode()
    root.name = b"Bip01"
    ident(root.rotation)
    root.scale = 1.0
    for side, sx in (("Right", 1.0), ("Left", -1.0)):
        up = _bone(root, f"{side} Upper Arm", (sx, 0.0, 3.0))
        fore = _bone(up, f"{side} Forearm", (0.0, 0.0, -1.0))
        _bone(fore, f"{side} Hand", (0.0, 0.0, -1.0))
    write_nif(HERE / "armskel.nif", [root])


def make_armhand():
    # ONE part file carrying BOTH sides as separately named shapes - which
    # is the retail shape rule 15 exists for, and the only way its ACCEPT
    # branch can be driven end to end.
    root = NifFormat.NiNode()
    root.name = b"Bip01"          # matches armskel's root, so skinToSkel is I
    ident(root.rotation)
    root.scale = 1.0
    for side in ("Right", "Left"):
        bone_name = f"{side} Hand"
        rest = ARM_REST[bone_name]
        node = _bone(root, bone_name, rest)
        sx = 1.0 if side == "Right" else -1.0
        verts = [(0.8 * sx, 0.0, 0.6), (1.6 * sx, 0.0, 0.6), (1.2 * sx, 0.0, 1.4)]
        tri = _tri(root, f"Tri {side} Hand", verts)
        _skin_to(tri, root, [(node, (-rest[0], -rest[1], -rest[2]),
                             [(0, 1.0), (1, 1.0), (2, 1.0)])])
    write_nif(HERE / "armhand.nif", [root])


def make_armcuff():
    # A RIGID part - no skin instance - and ASYMMETRIC in x, which is what
    # makes rule 13's mirror measurable rather than invisible.
    root = NifFormat.NiNode()
    root.name = b"CuffRoot"
    ident(root.rotation)
    root.scale = 1.0
    _tri(root, "Cuff", [(0.1, 0.0, -0.3), (0.9, 0.0, -0.3), (0.5, 0.0, 0.3)])
    write_nif(HERE / "armcuff.nif", [root])


def make_armnameless():
    # A skinned shape with an EMPTY name. The port EXTENDS rule 15 here -
    # OpenMW's ciStartsWith("", "right hand") is false, so the engine would
    # drop this shape - and the extension has a consequence the engine does
    # not: a nameless shape passes the filter at EVERY bone, so without a
    # latch one part binds once per side and the duplicate lands in the
    # same place. This fixture is the only thing that can enter that
    # branch.
    root = NifFormat.NiNode()
    root.name = b"Bip01"
    ident(root.rotation)
    root.scale = 1.0
    rest = ARM_REST["Right Hand"]
    node = _bone(root, "Right Hand", rest)
    tri = _tri(root, "", [(0.8, 0.0, 0.6), (1.6, 0.0, 0.6), (1.2, 0.0, 1.4)])
    _skin_to(tri, root, [(node, (-rest[0], -rest[1], -rest[2]),
                         [(0, 1.0), (1, 1.0), (2, 1.0)])])
    write_nif(HERE / "armnameless.nif", [root])


def make_arm_idle_kf():
    # MW-D7: THE IDLE CLIP. The first fixture in this tree that a first-
    # person arm can actually be posed by, and every one of its eleven text
    # keys is a rule under test rather than decoration.
    #
    # WHAT THIS FILE IS NOT. No observation of a retail xbase_anim.1st.kf
    # exists anywhere in this repository - Part VI of the rules doc records
    # four skeletons and 1,125 body records, and says nothing about the KF.
    # So the SHAPE here is read off OpenMW (rule 6's NiSequenceStreamHelper,
    # rules 21/22/44 for the keys); the CONTENT is an assumption about what
    # retail idle data contains. Where the two could differ, this file
    # errs toward exercising the rule.
    #
    #   t=0.0 Idle: Start        block A - the decoy. A forward scan for the
    #   t=0.5 Idle: Stop         group takes this range and looks right.
    #   t=0.6 Idle1h: Start      a second group whose name STARTS WITH the
    #   t=0.9 Idle1h: Stop       first - "idle" must not swallow "idle1h".
    #   t=1.0 Idle: Start        block B - the real one. Rule 22 walks
    #                            BACKWARDS from the group's last key.
    #   t=1.5 SoundGen: Left     packed with a LONE \r, so only rule 44's
    #         Idle: Loop Start   character-set split reaches the loop key.
    #   t=2.0 Idle: Chop Hit     rule 24's vocabulary: crossed, logged,
    #                            and deliberately NOT dispatched.
    #   t=2.5 Idle: Loop Stop    rules 23/49 - the window narrows by being
    #                            CROSSED, not by being read at load.
    #   t=3.0 Idle: Stop.        the Scrib's trailing period; rule 22's
    #                            length-truncated stop compare.
    #   t=3.2 Sneak:Start        colon with NO space: rule 21 registers no
    #   t=3.4 Sneak:Stop         group, so a ':'-instead-of-': ' mutant
    #                            gains a plausible clip and dies here.
    #
    # THE TRACKS mirror: the left upper arm's rotation is the right's
    # negated about Y, which is what R_y(theta) conjugated by the x-mirror
    # is - so the assembly stays exactly x-symmetric at every time, and
    # MW-D6's symmetry measurement becomes a per-frame invariant instead of
    # a one-shot. The forearms translate identically on both sides (a
    # z-only translation is mirror-safe) and carry NO rotation keys, which
    # is the only way to observe that a missing channel is rewritten from
    # the node's own rest every frame rather than held from the last one.
    #
    # Bip01 is keyed too, and reaches no geometry by construction: bindPart
    # sets skeletonRoot == rootBone, skeletonSpaceMatrices makes that node
    # identity, and skinToSkelMatrix returns identity when they are equal.
    # It is here so accumRootRef resolves unambiguously and the accumRoot
    # branch of poseSkeleton RUNS - pinned at the pose, where it is real,
    # never at the pixels, where it cannot be.
    helper = NifFormat.NiSequenceStreamHelper()
    helper.name = b"armidle"

    text_keys = [
        (0.0, b"Idle: Start"),
        (0.5, b"Idle: Stop"),
        (0.6, b"Idle1h: Start"),
        (0.9, b"Idle1h: Stop"),
        (1.0, b"Idle: Start"),
        (1.5, b"SoundGen: Left\rIdle: Loop Start"),
        (2.0, b"Idle: Chop Hit"),
        (2.5, b"Idle: Loop Stop"),
        (3.0, b"Idle: Stop."),
        (3.2, b"Sneak:Start"),
        (3.4, b"Sneak:Stop"),
    ]
    tke = NifFormat.NiTextKeyExtraData()
    tke.num_text_keys = len(text_keys)
    tke.text_keys.update_size()
    for k, (t, txt) in zip(tke.text_keys, text_keys):
        k.time = t
        k.value = txt

    # Rotation about Y by the given angles, right side; the left is negated.
    #
    # Y IS CORRECT HERE and the axis note that belongs beside make_armfp_kf
    # does not belong here. armidle.kf is MW-D7's CLIP-LAW fixture: what it
    # has to produce is a big, unambiguous rotation whose samples a reader
    # error would visibly miss, and +Y - Morrowind's forward - gives one.
    # The first-person fixture needs the opposite thing (an angle that
    # changes the arm's on-screen WIDTH, which a roll about forward cannot),
    # which is why make_armfp_kf swings about Z instead. MW-D10 moved that
    # reasoning here by mistake along with a rename this function's two call
    # sites never took, leaving generate.py unable to run at all; the
    # committed armidle.kf is and stays the Y version its pins measure.
    def rot_y(deg):
        a = math.radians(deg) / 2.0
        return (math.cos(a), 0.0, math.sin(a), 0.0)  # w,x,y,z

    arm_angles = [(0.0, 90.0), (0.5, 90.0), (1.0, 60.0), (1.5, 0.0),
                  (2.0, -20.0), (2.5, 0.0), (3.0, -60.0)]
    fore_trans = [(0.0, (0.0, 0.0, -1.0)), (1.0, (0.0, 0.0, -1.0)),
                  (2.0, (0.0, 0.0, -1.4)), (3.0, (0.0, 0.0, -1.0))]

    tracks = [
        ("Bip01", make_keyframe_data(trans_keys=[
            (0.0, (0.0, 0.0, 0.0)), (3.0, (1.0, 0.0, 0.0))])),
        ("Right Upper Arm", make_keyframe_data(
            rot_keys=[(t, rot_y(d)) for t, d in arm_angles])),
        ("Left Upper Arm", make_keyframe_data(
            rot_keys=[(t, rot_y(-d)) for t, d in arm_angles])),
        ("Right Forearm", make_keyframe_data(trans_keys=fore_trans)),
        ("Left Forearm", make_keyframe_data(trans_keys=fore_trans)),
    ]

    # The extra chain is [text keys, one NiStringExtraData per controller]
    # and the controller chain pairs with those names BY INDEX - five names,
    # five controllers, in the same order.
    helper.extra_data = tke
    prev_extra = tke
    prev_ctrl = None
    for name, kd in tracks:
        sed = NifFormat.NiStringExtraData()
        sed.string_data = name.encode()
        sed.bytes_remaining = 4 + len(name)
        prev_extra.next_extra_data = sed
        prev_extra = sed
        kc = make_keyframe_controller(None, kd, 0.0, 3.0)
        if prev_ctrl is None:
            helper.controller = kc
        else:
            prev_ctrl.next_controller = kc
        prev_ctrl = kc

    write_nif(HERE / "armidle.kf", [helper])


def make_armskel_weapon():
    # MW-D9: THE SAME ARM CHAIN, PLUS THE WEAPON BONES.
    #
    # A SECOND skeleton rather than an edit to armskel.nif, on purpose.
    # armskel DELIBERATELY omits Weapon Bone, Weapon Bone Left, the spine
    # and the clavicles, and MW-D4's report asserts that a skeleton
    # lacking them SAYS so - that half must stay exercised. This one adds
    # exactly the two the weapon needs, so both halves of rule 8's
    # attach-bone column are reachable: the bone that is present and the
    # bone that is not.
    #
    # The two bones are at DIFFERENT places (right hand vs left hand) so a
    # port that puts the bow on Weapon Bone instead of Weapon Bone Left
    # draws it in the wrong hand and the pixels say so.
    root = NifFormat.NiNode()
    root.name = b"Bip01"
    ident(root.rotation)
    root.scale = 1.0
    for side, sx in (("Right", 1.0), ("Left", -1.0)):
        up = _bone(root, f"{side} Upper Arm", (sx, 0.0, 3.0))
        fore = _bone(up, f"{side} Forearm", (0.0, 0.0, -1.0))
        hand = _bone(fore, f"{side} Hand", (0.0, 0.0, -1.0))
        # Rule 8: the generic bone hangs off the RIGHT hand; the bow's own
        # bone hangs off the LEFT. Rule 17 replaces one with the other at
        # attach time when the actor has the node.
        _bone(hand, "Weapon Bone" if side == "Right" else "Weapon Bone Left",
              (0.0, 0.0, -0.5))
    write_nif(HERE / "armskelw.nif", [root])


# MW-D10: THE FIRST-PERSON-SHAPED FIXTURE, skeleton and parts together.
#
# Every arm fixture before this one hangs straight DOWN from the shoulder
# (armskel: upper arm z=3, forearm z=2, hand z=1, all at y=0) - a T-pose
# arm, authored to prove SKINNING, and it cannot show where an arm lands
# on screen. armskelcam has a Camera bone but the same flat geometry.
#
# Rule 54 places the eye INSIDE the rig, so the only thing that decides
# what the player sees is where the arms sit relative to that node. To
# measure that at all, a fixture needs arms FORWARD of and BELOW an eye,
# which is what these numbers are: Morrowind's axes (x right, +y forward,
# z up), the eye at the top, the hands about 0.9 forward and 0.4 down.
#
# Bone names are armskel's, so armidle.kf binds to this rig unchanged.
ARM_FP_REST = {
    "Bip01 Neck": (0.0, 0.0, 3.0),
    "Camera": (0.0, 0.10, 0.45),          # under the neck: world z 3.45
    "Right Upper Arm": (0.40, 0.45, 0.20), "Left Upper Arm": (-0.40, 0.45, 0.20),
    "Right Forearm": (-0.14, 0.75, -0.05), "Left Forearm": (0.14, 0.75, -0.05),
    "Right Hand": (-0.05, 0.45, 0.00), "Left Hand": (0.05, 0.45, 0.00),
}

# THE NECK IS SQUARE, and that is a DECISION with a cost, recorded here.
#
# Rule 54's controller conjugates the pitch into the node's own frame
# (`worldOrient * mRotate * worldOrientInverse * localRot`,
# rotatecontroller.cpp:57), and with an axis-aligned neck that
# conjugation is the identity - so a port that drops it behaves
# identically here and the mutant survives the picture. A yawed neck
# WOULD catch it, and was tried: it also makes the rig asymmetric, which
# breaks the x-symmetry and per-side layers MW-D6 built to catch a
# one-handed arm. A rotation that preserves those (about X) commutes with
# the pitch and catches nothing.
#
# So the rig stays square and the conjugation is pinned on the SOURCE
# instead (test/fparm.test.js, MW-D10) - the same trade MW-D8 recorded
# for the once-solved framing, and it is written down rather than
# discovered later as a hole.
ARM_FP_NECK_YAW_DEG = 0.0


def _rot_z(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return ((c, -s, 0.0), (s, c, 0.0), (0.0, 0.0, 1.0))


def _apply(m, v):
    return tuple(sum(m[r][k] * v[k] for k in range(3)) for r in range(3))


def _fp_world():
    """Skeleton-space rest of every first-person bone, composed rather
    than restated - the neck's rotation propagates to its descendants and
    a second hand-written table would drift from it on the first edit."""
    R = _rot_z(ARM_FP_NECK_YAW_DEG)
    neck = ARM_FP_REST["Bip01 Neck"]
    out = {"Bip01 Neck": neck}
    chains = [["Camera"]]
    for side in ("Right", "Left"):
        chains.append([f"{side} Upper Arm", f"{side} Forearm", f"{side} Hand"])
    for chain in chains:
        acc = (0.0, 0.0, 0.0)
        for name in chain:
            local = ARM_FP_REST[name]
            acc = tuple(acc[i] + local[i] for i in range(3))
            turned = _apply(R, acc)
            out[name] = tuple(neck[i] + turned[i] for i in range(3))
    return out


ARM_FP_WORLD = _fp_world()


def _texture_shape(tri, uvs, file_name="tx_fixture.tga", clamp=3):
    # MW-D11: name a texture the way a retail mesh does - a .TGA
    # reference that only exists in the archive as .DDS, which is the
    # whole reason rule 36's path law has an extension swap in it.
    d = tri.data
    d.num_uv_sets = 1
    d.has_uv = True
    d.uv_sets.update_size()
    for uv, (u, v) in zip(d.uv_sets[0], uvs):
        uv.u, uv.v = u, v
    src = NifFormat.NiSourceTexture()
    src.use_external = 1
    src.file_name = file_name.encode()
    src.pixel_layout = 5
    src.use_mipmaps = 2
    src.alpha_format = 3
    src.is_static = 1
    texp = NifFormat.NiTexturingProperty()
    texp.apply_mode = 2
    texp.texture_count = 7
    texp.has_base_texture = True
    texp.base_texture.source = src
    texp.base_texture.clamp_mode = clamp
    texp.base_texture.filter_mode = 2
    texp.base_texture.uv_set = 0
    tri.num_properties = 1
    tri.properties.update_size()
    tri.properties[0] = texp


def make_armfp():
    root = NifFormat.NiNode()
    root.name = b"Bip01"
    ident(root.rotation)
    root.scale = 1.0
    neck = _bone(root, "Bip01 Neck", ARM_FP_REST["Bip01 Neck"])
    # The turn that makes rule 54's conjugation observable.
    R = _rot_z(ARM_FP_NECK_YAW_DEG)
    (neck.rotation.m_11, neck.rotation.m_12, neck.rotation.m_13) = R[0]
    (neck.rotation.m_21, neck.rotation.m_22, neck.rotation.m_23) = R[1]
    (neck.rotation.m_31, neck.rotation.m_32, neck.rotation.m_33) = R[2]
    _bone(neck, "Camera", ARM_FP_REST["Camera"])
    for side in ("Right", "Left"):
        up = _bone(neck, f"{side} Upper Arm", ARM_FP_REST[f"{side} Upper Arm"])
        fore = _bone(up, f"{side} Forearm", ARM_FP_REST[f"{side} Forearm"])
        hand = _bone(fore, f"{side} Hand", ARM_FP_REST[f"{side} Hand"])
        _bone(hand, "Weapon Bone" if side == "Right" else "Weapon Bone Left",
              (0.0, 0.18, 0.0))
    write_nif(HERE / "armfp.nif", [root])


def make_armfp_noweapon():
    # armfp WITHOUT the two weapon bones. Rule 8's attach-bone column has
    # a present half and an absent half, and MW-D4's report asserts that a
    # skeleton lacking a bone SAYS so - but rule 54 now refuses any rig
    # with no Camera node, so the absent half needs a rig that HAS an eye
    # and LACKS the weapon bones. armskel cannot serve both any more.
    root = NifFormat.NiNode()
    root.name = b"Bip01"
    ident(root.rotation)
    root.scale = 1.0
    neck = _bone(root, "Bip01 Neck", ARM_FP_REST["Bip01 Neck"])
    R = _rot_z(ARM_FP_NECK_YAW_DEG)
    (neck.rotation.m_11, neck.rotation.m_12, neck.rotation.m_13) = R[0]
    (neck.rotation.m_21, neck.rotation.m_22, neck.rotation.m_23) = R[1]
    (neck.rotation.m_31, neck.rotation.m_32, neck.rotation.m_33) = R[2]
    _bone(neck, "Camera", ARM_FP_REST["Camera"])
    for side in ("Right", "Left"):
        up = _bone(neck, f"{side} Upper Arm", ARM_FP_REST[f"{side} Upper Arm"])
        fore = _bone(up, f"{side} Forearm", ARM_FP_REST[f"{side} Forearm"])
        _bone(fore, f"{side} Hand", ARM_FP_REST[f"{side} Hand"])
    write_nif(HERE / "armfpnoweapon.nif", [root])


def make_armfp_hand():
    # Skinned, one shape per side, authored AT the skeleton-space bone and
    # cancelled by an inverse bind of minus that position - the same round
    # trip make_armhand relies on, at the first-person rest instead.
    root = NifFormat.NiNode()
    root.name = b"Bip01"
    ident(root.rotation)
    root.scale = 1.0
    for side in ("Right", "Left"):
        bone_name = f"{side} Hand"
        rest = ARM_FP_WORLD[bone_name]
        node = _bone(root, bone_name, rest)
        sx = 1.0 if side == "Right" else -1.0
        # A palm-sized triangle pair, wider across x than deep in y.
        verts = [
            (rest[0] - 0.10 * sx, rest[1] - 0.10, rest[2] - 0.06),
            (rest[0] + 0.10 * sx, rest[1] - 0.10, rest[2] - 0.06),
            (rest[0] + 0.08 * sx, rest[1] + 0.12, rest[2] + 0.02),
            (rest[0] - 0.08 * sx, rest[1] + 0.12, rest[2] + 0.02),
        ]
        tri = _tri(root, f"Tri {side} Hand", verts, tris=((0, 1, 2), (0, 2, 3)))
        # The quad spans the whole texture, so all four of fixture.dds's
        # solid quadrants (red, green, blue, white) reach the screen -
        # colours a flat skin tone can never produce.
        _texture_shape(tri, [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)])
        _skin_to(tri, root, [(node, (-rest[0], -rest[1], -rest[2]),
                             [(0, 1.0), (1, 1.0), (2, 1.0), (3, 1.0)])])
    write_nif(HERE / "armfphand.nif", [root])


def make_armfp_arm():
    # RIGID, like armcuff and for the same reason: rule 12's rigid half
    # and rule 13's mirror only run on a part with no skin instance, and
    # the mirror is only measurable on a shape that is ASYMMETRIC in x.
    # Sized and placed for the first-person rest, so it lands on the
    # forearm rather than wherever armcuff's numbers happen to fall.
    root = NifFormat.NiNode()
    root.name = b"FpSleeveRoot"
    ident(root.rotation)
    root.scale = 1.0
    sleeve = _tri(root, "Sleeve", [
        (0.02, -0.28, -0.04),
        (0.16, -0.24, -0.02),
        (0.09, 0.26, 0.03),
    ])
    # The RIGID path carries a texture too - the piece that keeps only its
    # positions is exactly the one whose material used to be dropped.
    _texture_shape(sleeve, [(0.0, 0.0), (1.0, 0.0), (0.5, 1.0)])
    write_nif(HERE / "armfparm.nif", [root])


def make_armfp_kf():
    # MW-D10: THE FIRST-PERSON IDLE - armidle's clip LAW with a first
    # person's motion.
    #
    # armidle.kf is MW-D7's clip-law fixture and its eleven text keys are
    # each a rule; its ROTATIONS reach 90 degrees, because a big swing is
    # what makes a sampling error visible, and applied to a first-person
    # rest pose they fling the arms out of frame. This file keeps the
    # eleven keys VERBATIM - so every clip law stays exercised - and
    # replaces the motion with a sway a first-person arm could actually
    # make: the forearms swing out in y and lift in x, which moves the
    # picture both across and down the frame. Both are needed: the width
    # layer catches a framing that renormalises per frame, and the
    # distinct-pictures layer catches a page frozen on frame one.
    text_keys = [
        (0.0, b"Idle: Start"),
        (0.5, b"Idle: Stop"),
        (0.6, b"Idle1h: Start"),
        (0.9, b"Idle1h: Stop"),
        (1.0, b"Idle: Start"),
        (1.5, b"SoundGen: Left\rIdle: Loop Start"),
        (2.0, b"Idle: Chop Hit"),
        (2.5, b"Idle: Loop Stop"),
        (3.0, b"Idle: Stop."),
        (3.2, b"Sneak:Start"),
        (3.4, b"Sneak:Stop"),
    ]
    tke = NifFormat.NiTextKeyExtraData()
    tke.num_text_keys = len(text_keys)
    tke.text_keys.update_size()
    for k, (t, txt) in zip(tke.text_keys, text_keys):
        k.time = t
        k.value = txt

    # Z, not Y: in Morrowind's axes +Y is FORWARD, so a rotation about it
    # is a ROLL and moves nothing across the frame. The swing that opens
    # the arms out - and makes the on-screen WIDTH vary, which is the
    # measurement that catches a per-frame renormalising framing - is
    # about Z.
    def rot_z(deg):
        a = math.radians(deg) / 2.0
        return (math.cos(a), 0.0, 0.0, math.sin(a))

    def rot_x(deg):
        a = math.radians(deg) / 2.0
        return (math.cos(a), math.sin(a), 0.0, 0.0)

    swing = [(0.0, 0.0), (1.0, 6.0), (1.5, 14.0), (2.0, 20.0), (2.5, 10.0), (3.0, 0.0)]
    lift = [(0.0, 0.0), (1.0, 8.0), (2.0, 18.0), (3.0, 4.0)]
    tracks = [
        ("Right Upper Arm", make_keyframe_data(rot_keys=[(t, rot_z(-d)) for t, d in swing])),
        ("Left Upper Arm", make_keyframe_data(rot_keys=[(t, rot_z(d)) for t, d in swing])),
        ("Right Forearm", make_keyframe_data(rot_keys=[(t, rot_x(d)) for t, d in lift])),
        ("Left Forearm", make_keyframe_data(rot_keys=[(t, rot_x(d)) for t, d in lift])),
    ]

    helper = NifFormat.NiSequenceStreamHelper()
    helper.name = b"ArmFpIdle"
    helper.extra_data = tke
    prev_extra = tke
    prev_ctrl = None
    for name, kd in tracks:
        sed = NifFormat.NiStringExtraData()
        sed.string_data = name.encode()
        sed.bytes_remaining = 4 + len(name)
        prev_extra.next_extra_data = sed
        prev_extra = sed
        kc = make_keyframe_controller(None, kd, 0.0, 3.4)
        if prev_ctrl is None:
            helper.controller = kc
        else:
            prev_ctrl.next_controller = kc
        prev_ctrl = kc
    write_nif(HERE / "armfpidle.kf", [helper])


def make_armfp_esm():
    # Two slots over the two meshes above, ids ending "1st" (rule 1).
    def sub(tag, data):
        return tag + struct.pack("<I", len(data)) + data

    def rec(tag, subs):
        data = b"".join(subs)
        return tag + struct.pack("<III", len(data), 0, 0) + data

    z = lambda t: t.encode() + b"\x00"

    def body(bid, model, part):
        return rec(b"BODY", [sub(b"NAME", z(bid)), sub(b"MODL", z(model)),
                             sub(b"FNAM", z("FpRace")),
                             sub(b"BYDT", bytes([part, 0, 0, 0]))])

    hedr = struct.pack("<fI", 1.3, 1)
    hedr += b"fixture".ljust(32, b"\x00")
    hedr += b"first-person arm parts".ljust(256, b"\x00")
    hedr += struct.pack("<I", 3)
    out = rec(b"TES3", [sub(b"HEDR", hedr)])
    out += body("b_fp_hand_1st", "fixture\\armfphand.nif", 5)      # hand
    out += body("b_fp_forearm_1st", "fixture\\armfparm.nif", 7)    # forearm
    (HERE / "armfp.esm").write_bytes(out)
    print(f"wrote {HERE / 'armfp.esm'} {len(out)} bytes")


def make_armskel_camera():
    # MW-D9d: the skeleton WITH a NiCamera, which retail first-person
    # skeletons carry (rule 54: the FP camera tracks a bone named
    # "Camera"). An unimplemented record type is FATAL to a 4.0.0.2 NIF -
    # there are no per-record sizes, so nothing can be skipped - so this
    # fixture exists to prove the reader eats one and stays in sync with
    # every record after it. The camera is NOT last, deliberately: a
    # wrong field count would desync the records that follow, and a
    # trailing record would hide that.
    root = NifFormat.NiNode()
    root.name = b"Bip01"
    ident(root.rotation)
    root.scale = 1.0
    for side, sx in (("Right", 1.0), ("Left", -1.0)):
        up = _bone(root, f"{side} Upper Arm", (sx, 0.0, 3.0))
        fore = _bone(up, f"{side} Forearm", (0.0, 0.0, -1.0))
        hand = _bone(fore, f"{side} Hand", (0.0, 0.0, -1.0))
        _bone(hand, "Weapon Bone" if side == "Right" else "Weapon Bone Left",
              (0.0, 0.0, -0.5))
    cam = NifFormat.NiCamera()
    cam.name = b"Camera"
    ident(cam.rotation)
    cam.scale = 1.0
    cam.translation.z = 4.0
    cam.frustum_left = -0.5
    cam.frustum_right = 0.5
    cam.frustum_top = 0.4
    cam.frustum_bottom = -0.4
    cam.frustum_near = 0.1
    cam.frustum_far = 1000.0
    cam.viewport_left = 0.0
    cam.viewport_right = 1.0
    cam.viewport_top = 1.0
    cam.viewport_bottom = 0.0
    cam.lod_adjust = 1.0
    root.add_child(cam)
    # AFTER the camera in the file, so a desync is visible as a bad bone.
    _bone(root, "Bip01 Spine1", (0.0, 0.0, 2.0))
    write_nif(HERE / "armskelcam.nif", [root])


def make_weaponmesh():
    # A rigid weapon: ONE unskinned shape, asymmetric in every axis so
    # that a wrong bone, a wrong mirror and a wrong rotation are three
    # different pictures rather than one. Deliberately NOT skinned - a
    # Morrowind weapon is a rigid part attached at a bone (rule 12's
    # rigid path), which is the path armcuff already proves for the
    # upper arm and which the weapon reuses rather than inventing.
    root = NifFormat.NiNode()
    root.name = b"WeaponRoot"
    ident(root.rotation)
    root.scale = 1.0
    # a blade: long in z, thin in x, thinner in y, and OFF-CENTRE in x so
    # a lost mirror is visible
    _tri(root, "Tri Blade",
         [(0.0, 0.0, 0.0), (0.30, 0.0, 0.0), (0.15, 0.0, 2.0), (0.15, 0.10, 1.0)],
         tris=((0, 1, 2), (0, 2, 3)))
    write_nif(HERE / "weapon.nif", [root])


def make_armparts_esm():
    # MW-D9f: THE .ESM THAT LETS A WHOLE ARM BE BUILT IN NODE.
    #
    # fixture.esm carries head/hair/chest records and is pinned by name
    # and census in several tests, so the arm records live in their own
    # file rather than perturbing it. Two slots only - hand and upper arm,
    # over the MW-D6 arm meshes - because armReport's "NOTHING for this
    # slot" arm has to stay exercised too, and wrist/forearm being absent
    # is what exercises it.
    #
    # Written struct-level, like make_esm and the BSA: header, one race,
    # two skin BODY records whose ids END IN "1st" (rule 1: a
    # first-person part is a RECORD id, not a mangled filename).
    def sub(tag, data):
        return tag + struct.pack("<I", len(data)) + data

    def rec(tag, subs):
        data = b"".join(subs)
        return tag + struct.pack("<III", len(data), 0, 0) + data

    z = lambda t: t.encode() + b"\x00"

    def body(bid, model, part):
        # BYDT: part index, vampire, flags (0 = male + playable), type
        # (0 = skin).
        return rec(b"BODY", [sub(b"NAME", z(bid)), sub(b"MODL", z(model)),
                             sub(b"FNAM", z("ArmRace")),
                             sub(b"BYDT", bytes([part, 0, 0, 0]))])

    hedr = struct.pack("<fI", 1.3, 1)
    hedr += b"fixture".ljust(32, b"\x00")
    hedr += b"arm parts for the first-person build".ljust(256, b"\x00")
    hedr += struct.pack("<I", 3)
    out = rec(b"TES3", [sub(b"HEDR", hedr)])
    out += body("b_arm_hand_1st", "fixture\\armhand.nif", 5)      # MeshPart hand
    out += body("b_arm_upperarm_1st", "fixture\\armcuff.nif", 8)  # MeshPart upper arm
    (HERE / "armparts.esm").write_bytes(out)
    print(f"wrote {HERE / 'armparts.esm'} {len(out)} bytes")


def make_collswitch():
    # MW-D9e: NiCollisionSwitch, which pyffi's nif.xml does not know.
    #
    # Its payload IS a NiNode's, byte for byte (nif.xml gives it no fields
    # of its own), so the fixture is a pyffi-authored three-node file with
    # ONE type name substituted in the record list. Nothing else moves: a
    # record's type is a sized string, so a longer name just shifts the
    # bytes after it, and the payload the reader then parses is the one
    # pyffi wrote. The count assert below is the guard - if a future pyffi
    # writes a different number of NiNode records, this refuses rather
    # than patching the wrong one.
    root = NifFormat.NiNode()
    root.name = b"Root"
    ident(root.rotation)
    root.scale = 1.0
    switcher = _bone(root, "Switcher", (0.0, 0.0, 1.0))
    # AFTER the switch in the file, so a desync shows up as a bad bone.
    _bone(switcher, "Marker", (4.0, 5.0, 6.0))
    path = HERE / "collswitch.nif"
    write_nif(path, [root])
    raw = path.read_bytes()
    old = b"\x06\x00\x00\x00NiNode"
    new = b"\x11\x00\x00\x00NiCollisionSwitch"
    assert raw.count(old) == 3, raw.count(old)
    head, sep, tail = raw.partition(old)          # root
    body, sep2, rest = tail.partition(old)        # switcher
    path.write_bytes(head + old + body + new + rest)


def make_extras():
    # MW-D9e: THE FIVE EXTRA-DATA RECORDS PYFFI CANNOT WRITE.
    #
    # Every other NIF fixture here is pyffi-authored on purpose - an
    # independent implementation. This one is not, because pyffi's nif.xml
    # is WRONG for these five at 4.0.0.2: it omits NiExtraData's `Num
    # Bytes` (nif.xml: ver1 4.0.0.0, ver2 4.2.2.0) from NiBinaryExtraData,
    # NiBooleanExtraData, NiIntegerExtraData, NiVectorExtraData,
    # NiStringsExtraData and the bare NiExtraData, so what it writes is
    # four bytes short of the format. The two authorities that agree -
    # niftools nif.xml and OpenMW, whose Extra::read reads next + record
    # size for every extra record at 4.2.2.0 and below - are what this
    # file is written from, straight out of the documented layout, the way
    # fixture.bsa is.
    #
    # The bare NiExtraData carries a payload of `Num Bytes` opaque bytes
    # (OpenMW reads them; nif.xml stops at the count). NiLightRadiusController
    # rides along for the same reason - pyffi has no such record. The
    # marker node last says whether the reader stayed in step throughout.
    import struct

    def sstr(text):
        raw = text.encode("ascii")
        return struct.pack("<I", len(raw)) + raw

    def extra(next_ref, payload):
        return struct.pack("<iI", next_ref, len(payload)) + payload

    def node(name, extra_ref, children, translation, controller_ref=-1):
        out = sstr(name)
        out += struct.pack("<ii", extra_ref, controller_ref)
        out += struct.pack("<H", 0)                          # flags
        out += struct.pack("<3f", *translation)
        out += struct.pack("<9f", 1, 0, 0, 0, 1, 0, 0, 0, 1)  # rotation
        out += struct.pack("<f", 1.0)                        # scale
        out += struct.pack("<3f", 0, 0, 0)                   # velocity
        out += struct.pack("<I", 0)                          # properties
        out += struct.pack("<I", 0)                          # has bounding volume
        out += struct.pack("<I", len(children))
        for c in children:
            out += struct.pack("<i", c)
        out += struct.pack("<I", 0)                          # effects
        return out

    records = [
        ("NiNode", node("Root", 1, [10], (0.0, 0.0, 0.0), controller_ref=7)),
        ("NiBinaryExtraData", extra(2, struct.pack("<I", 3) + bytes((1, 2, 3)))),
        ("NiBooleanExtraData", extra(3, bytes((1,)))),
        ("NiIntegerExtraData", extra(4, struct.pack("<I", 4242))),
        ("NiVectorExtraData", extra(5, struct.pack("<4f", 1.0, 2.0, 3.0, 4.0))),
        ("NiStringsExtraData",
         extra(6, struct.pack("<I", 2) + sstr("first") + sstr("second"))),
        ("NiExtraData", extra(-1, bytes((7, 8, 9)))),
        # NiLightRadiusController is a NiTimeController with NO tail at
        # all, and pyffi's nif.xml does not know the type, so it lands
        # here too: next, flags, frequency, phase, start, stop, target.
        ("NiLightRadiusController",
         struct.pack("<iH4fi", -1, 12, 1.0, 0.25, 0.5, 2.0, 0)),
        # A palette whose count is neither 16 nor 256. pyffi always writes
        # 256 entries whatever the count says; OpenMW reads the count, and
        # so does the port.
        ("NiPalette",
         struct.pack("<BI", 1, 4) + bytes((1, 2, 3, 4, 5, 6, 7, 8,
                                           9, 10, 11, 12, 13, 14, 15, 16))),
        # NiBoolData: a KeyGroup whose values are single bytes. Nothing in
        # a 4.0.0.2 file REFERENCES one (its readers are interpolators,
        # ver1 10.1.0.106), so it is written standalone - the reader walks
        # the record list in order and does not care who points at what.
        ("NiBoolData",
         struct.pack("<II", 2, 1) + struct.pack("<fB", 0.0, 1)
         + struct.pack("<fB", 1.5, 0)),
        ("NiNode", node("Marker", -1, [], (7.0, 8.0, 9.0))),
    ]
    out = b"NetImmerse File Format, Version 4.0.0.2\n"
    out += struct.pack("<II", 0x04000002, len(records))
    for name, payload in records:
        out += sstr(name) + payload
    out += struct.pack("<Ii", 1, 0)                          # one root: record 0
    (HERE / "extras.nif").write_bytes(out)
    print(f"wrote {HERE / 'extras.nif'}")


def make_zoo():
    # MW-D9e: ONE FILE CARRYING EVERY RECORD TYPE THE REGISTRY GREW.
    #
    # A 4.0.0.2 record has no size field, so an unimplemented type does
    # not degrade the file - it ends it. Before this slice a mesh with a
    # particle emitter, a light or a texture effect took the whole model
    # down, which is how a NiCamera in a first-person skeleton killed the
    # arms. Every type below is one that a Morrowind-era file can hold.
    #
    # The marker bone is written LAST on purpose: parseNif refuses
    # trailing bytes, so a reader that over- or under-reads ANY record
    # here fails the file rather than quietly returning a short graph, and
    # the marker's own translation says the record stream stayed in step.
    #
    # pyffi's ancient nif.xml disagrees with nifxml/OpenMW on the INSIDE
    # of three records - NiSphericalCollider, NiPixelData's header and
    # NiParticleSystemController's spawn block - while agreeing on their
    # WIDTH. Those three are pinned for width and sync only; their field
    # values are left at zero rather than pinned to a layout the port
    # does not follow.
    root = NifFormat.NiNode()
    root.name = b"Zoo"
    ident(root.rotation)
    root.scale = 1.0

    # --- extra data. Only the kinds pyffi writes CORRECTLY at 4.0.0.2 are
    # here: its nif.xml omits NiExtraData's `Num Bytes` from five of the
    # subclasses (see make_extras, which authors those by hand).
    vw = NifFormat.NiVertWeightsExtraData()
    vw.num_vertices = 2
    vw.weight.update_size()
    vw.weight[0] = 0.25
    vw.weight[1] = 0.75
    named = NifFormat.NiStringExtraData()
    named.string_data = b"zoo extra"
    vw.next_extra_data = named
    root.extra_data = vw

    # --- controller chain on the root.
    float_data = NifFormat.NiFloatData()
    float_data.data.num_keys = 1
    float_data.data.interpolation = 1
    float_data.data.keys.update_size()
    float_data.data.keys[0].time = 0.5
    float_data.data.keys[0].value = 1.5
    pos_data = NifFormat.NiPosData()
    pos_data.data.num_keys = 1
    pos_data.data.interpolation = 1
    pos_data.data.keys.update_size()
    pos_data.data.keys[0].time = 0.25
    pos_data.data.keys[0].value.x = 7.0
    color_data = NifFormat.NiColorData()
    color_data.data.num_keys = 1
    color_data.data.interpolation = 1
    color_data.data.keys.update_size()
    color_data.data.keys[0].time = 0.125
    color_data.data.keys[0].value.r = 1.0
    color_data.data.keys[0].value.a = 0.5
    uv_data = NifFormat.NiUVData()
    uv_data.uv_groups[0].num_keys = 1
    uv_data.uv_groups[0].interpolation = 1
    uv_data.uv_groups[0].keys.update_size()
    uv_data.uv_groups[0].keys[0].time = 1.0
    uv_data.uv_groups[0].keys[0].value = 2.0
    vis_data = NifFormat.NiVisData()
    vis_data.num_keys = 2
    vis_data.keys.update_size()
    vis_data.keys[0].time = 0.0
    vis_data.keys[0].value = 1
    vis_data.keys[1].time = 1.0
    vis_data.keys[1].value = 0
    morph_data = NifFormat.NiMorphData()
    morph_data.num_morphs = 2
    morph_data.num_vertices = 2
    morph_data.relative_targets = 1
    morph_data.morphs.update_size()
    m0 = morph_data.morphs[0]
    m0.arg = morph_data.num_vertices     # pyffi resolves Morph's #ARG# from this
    m0.num_keys = 1
    m0.interpolation = 1
    m0.keys.update_size()
    m0.keys[0].time = 0.75
    m0.keys[0].value = 0.5
    m0.vectors.update_size()
    m0.vectors[1].z = 3.0
    # THE SECOND MORPH HAS NO KEYS, and still writes its interpolation
    # word - that is exactly where Morph differs from KeyGroup, and a
    # reader that treats it as a KeyGroup desyncs by four bytes here.
    m1 = morph_data.morphs[1]
    m1.arg = morph_data.num_vertices
    m1.num_keys = 0
    m1.interpolation = 2
    m1.vectors.update_size()
    m1.vectors[0].x = 5.0

    bone_lod = NifFormat.NiBoneLODController()
    bone_lod.unknown_int_1 = 1
    # The two counts DIFFER on purpose: the node-group array is sized by
    # the FIRST (Num LODs), and a reader that picks the second runs off
    # the end of the record.
    bone_lod.num_node_groups = 1
    bone_lod.num_node_groups_2 = 3
    bone_lod.node_groups.update_size()
    bone_lod.node_groups[0].num_nodes = 1
    bone_lod.node_groups[0].nodes.update_size()
    bone_lod.node_groups[0].nodes[0] = root
    bs_bone_lod = NifFormat.NiBSBoneLODController()
    bs_bone_lod.num_node_groups = 0
    bs_bone_lod.num_node_groups_2 = 0
    look_at = NifFormat.NiLookAtController()
    look_at.look_at_node = root
    path_ctrl = NifFormat.NiPathController()
    # pyffi types bank dir unsigned; nif.xml types it `int`. Writing the
    # two's-complement bit pattern pins the port's SIGNED read.
    path_ctrl.unknown_int_1 = 0xFFFFFFFD          # -3
    path_ctrl.unknown_float_2 = 1.25
    path_ctrl.unknown_float_3 = 2.5
    path_ctrl.unknown_short = 2
    path_ctrl.pos_data = pos_data
    path_ctrl.float_data = float_data
    uv_ctrl = NifFormat.NiUVController()
    uv_ctrl.unknown_short = 1
    uv_ctrl.data = uv_data
    vis_ctrl = NifFormat.NiVisController()
    vis_ctrl.data = vis_data
    tex_a = NifFormat.NiSourceTexture()
    tex_a.use_external = 1
    tex_a.file_name = b"flip0.dds"
    tex_b = NifFormat.NiSourceTexture()
    tex_b.use_external = 1
    tex_b.file_name = b"flip1.dds"
    flip = NifFormat.NiFlipController()
    flip.texture_slot = 4
    # pyffi types accum time as a uint; nif.xml types it float. The bit
    # pattern of 0.5f pins the port's FLOAT read.
    flip.unknown_int_2 = 0x3F000000
    flip.delta = 0.5
    flip.num_sources = 2
    flip.sources.update_size()
    flip.sources[0] = tex_a
    flip.sources[1] = tex_b
    alpha_ctrl = NifFormat.NiAlphaController()
    alpha_ctrl.data = float_data
    matcolor = NifFormat.NiMaterialColorController()
    matcolor.data = pos_data
    roll = NifFormat.NiRollController()
    roll.data = float_data
    morpher = NifFormat.NiGeomMorpherController()
    morpher.data = morph_data
    morpher.always_update = 1
    chain = [bone_lod, bs_bone_lod, look_at, path_ctrl, uv_ctrl, vis_ctrl,
             flip, alpha_ctrl, matcolor, roll, morpher]
    for a, b in zip(chain, chain[1:]):
        a.next_controller = b
    for c in chain:
        c.frequency = 1.0
        c.stop_time = 1.0
    root.controller = chain[0]

    # --- node kinds.
    switch = NifFormat.NiSwitchNode()
    switch.name = b"Switch"
    ident(switch.rotation)
    switch.scale = 1.0
    root.add_child(switch)
    lod = NifFormat.NiLODNode()
    lod.name = b"LOD"
    ident(lod.rotation)
    lod.scale = 1.0
    lod.lod_center.z = 5.0
    lod.num_lod_levels = 2
    lod.lod_levels.update_size()
    lod.lod_levels[0].near_extent = 0.0
    lod.lod_levels[0].far_extent = 10.0
    lod.lod_levels[1].near_extent = 10.0
    lod.lod_levels[1].far_extent = 99.0
    root.add_child(lod)
    sort = NifFormat.NiSortAdjustNode()
    sort.name = b"Sort"
    ident(sort.rotation)
    sort.scale = 1.0
    sort.sorting_mode = 1
    root.add_child(sort)

    # --- geometry kinds.
    strips = NifFormat.NiTriStrips()
    strips.name = b"Strips"
    ident(strips.rotation)
    strips.scale = 1.0
    sd = NifFormat.NiTriStripsData()
    sd.num_vertices = 4
    sd.has_vertices = True
    sd.vertices.update_size()
    for v, (x, y, z) in zip(sd.vertices, ((0, 0, 0), (1, 0, 0), (0, 1, 0), (1, 1, 0))):
        v.x, v.y, v.z = float(x), float(y), float(z)
    # TWO strips of DIFFERENT lengths: with one strip, or two of equal
    # length, a reader that sizes every strip from the first length reads
    # the same bytes.
    sd.num_triangles = 3
    sd.num_strips = 2
    sd.strip_lengths.update_size()
    sd.strip_lengths[0] = 4
    sd.strip_lengths[1] = 3
    sd.points.update_size()
    for i in range(4):
        sd.points[0][i] = i
    for i in range(3):
        sd.points[1][i] = 3 - i
    strips.data = sd
    root.add_child(strips)

    lines = NifFormat.NiLines()
    lines.name = b"Lines"
    ident(lines.rotation)
    lines.scale = 1.0
    ld = NifFormat.NiLinesData()
    ld.num_vertices = 3
    ld.has_vertices = True
    ld.vertices.update_size()
    ld.vertices[1].x = 1.0
    ld.vertices[2].y = 1.0
    ld.lines.update_size()
    ld.lines[0] = 1
    ld.lines[1] = 1
    ld.lines[2] = 0
    lines.data = ld
    root.add_child(lines)

    # --- particles: all three geometry flavours, the controller, the whole
    # modifier chain and both colliders.
    def particle_node(cls, datacls, name, radius):
        node = cls()
        node.name = name.encode()
        ident(node.rotation)
        node.scale = 1.0
        d = datacls()
        d.num_vertices = 2
        d.has_vertices = True
        d.vertices.update_size()
        d.vertices[1].z = 1.0
        d.num_particles = 2
        d.particle_radius = radius
        d.num_active = 1
        d.has_sizes = True
        d.sizes.update_size()
        d.sizes[0] = 0.25
        d.sizes[1] = 0.75
        node.data = d
        root.add_child(node)
        return node, d

    particle_node(NifFormat.NiParticles, NifFormat.NiParticlesData, "Parts", 0.5)
    emitter, _ = particle_node(NifFormat.NiAutoNormalParticles,
                               NifFormat.NiAutoNormalParticlesData, "AutoParts", 1.5)
    _, rot_data = particle_node(NifFormat.NiRotatingParticles,
                                NifFormat.NiRotatingParticlesData, "RotParts", 2.5)
    rot_data.has_rotations_2 = True
    rot_data.rotations_2.update_size()
    rot_data.rotations_2[0].w = 1.0
    rot_data.rotations_2[1].x = 1.0
    # A SECOND one with the quaternion array switched OFF. Without it the
    # has-rotations bool is a constant in the fixture, and a reader that
    # ignores it entirely reads the same bytes.
    _, plain_rot = particle_node(NifFormat.NiRotatingParticles,
                                 NifFormat.NiRotatingParticlesData, "RotPlain", 3.5)
    plain_rot.has_rotations_2 = False

    gravity = NifFormat.NiGravity()
    gravity.unknown_float_1 = 0.5          # decay
    gravity.force = 9.8
    gravity.type = 1
    gravity.position.x = 1.0
    gravity.direction.z = -1.0
    bomb = NifFormat.NiParticleBomb()
    bomb.decay = 1.0
    bomb.duration = 2.0
    bomb.delta_v = 3.0
    bomb.start = 4.0
    bomb.decay_type = 2
    bomb.position.y = 5.0
    bomb.direction.x = 6.0
    colormod = NifFormat.NiParticleColorModifier()
    colormod.color_data = color_data
    growfade = NifFormat.NiParticleGrowFade()
    growfade.grow = 0.1
    growfade.fade = 0.2
    prot = NifFormat.NiParticleRotation()
    prot.random_initial_axis = 1
    prot.initial_axis.y = 1.0
    prot.rotation_speed = 2.5
    mods = [gravity, bomb, colormod, growfade, prot]
    for a, b in zip(mods, mods[1:]):
        a.next_modifier = b
    # 16 floats, in the port's order: bounce, height, width, position,
    # x vector, y vector, plane normal, plane constant.
    planar = NifFormat.NiPlanarCollider()
    for i, v in enumerate((0.3, 2.0, 3.0,
                           1.0, 0.0, 0.0,
                           0.0, 1.0, 0.0,
                           0.0, 0.0, 1.0,
                           0.0, 0.0, 1.0, 4.0)):
        setattr(planar, f"unknown_float_{i + 1}", v)
    spherical = NifFormat.NiSphericalCollider()
    spherical.unknown_float_1 = 0.4        # bounce - the one field pyffi
    planar.next_modifier = spherical       # and nifxml agree on here
    psys = NifFormat.NiParticleSystemController()
    psys.speed = 1.0
    psys.speed_random = 0.25
    psys.size = 0.75
    psys.emit_start_time = 0.1
    psys.emit_stop_time = 0.9
    psys.unknown_byte = 1                  # reset particle system
    psys.emit_rate = 3.0                   # birth rate
    psys.lifetime = 2.0
    psys.lifetime_random = 0.5
    # THE TEN BYTES pyffi and nif.xml disagree about. pyffi calls them
    # uint/uint/ushort; nif.xml and OpenMW call them spawn multiplier
    # (ushort) + two floats. Writing this pattern makes the port's split
    # read 9, 0.5 and 1.5 - a reader that takes pyffi's split cannot.
    psys.unknown_int_1 = 9              # 09 00 | 00 00
    psys.unknown_int_2 = 0x00003F00     # 00 3F | 00 00
    psys.unknown_short_3 = 0x3FC0       # C0 3F
    psys.num_particles = 1
    psys.num_valid = 1
    psys.particles.update_size()
    psys.particles[0].velocity.x = 2.0
    psys.particles[0].unknown_vector.z = 3.0
    psys.particles[0].lifetime = 0.5
    psys.particles[0].lifespan = 1.5
    psys.particles[0].timestamp = 4.0
    psys.particles[0].vertex_id = 7
    psys.particle_extra = gravity
    psys.unknown_link_2 = planar
    psys.trailer = 1                       # static target bound
    emitter.controller = psys
    bsp = NifFormat.NiBSPArrayController()
    bsp.speed = 5.0
    bsp.lifetime = 6.0
    psys.next_controller = bsp

    # --- lights, one of each, and the colour controller on the last.
    for cls, name in ((NifFormat.NiAmbientLight, "Ambient"),
                      (NifFormat.NiDirectionalLight, "Directional"),
                      (NifFormat.NiPointLight, "Point"),
                      (NifFormat.NiSpotLight, "Spot")):
        light = cls()
        light.name = name.encode()
        ident(light.rotation)
        light.scale = 1.0
        light.dimmer = 0.5
        light.ambient_color.r = 0.1
        light.diffuse_color.g = 0.2
        light.specular_color.b = 0.3
        if cls in (NifFormat.NiPointLight, NifFormat.NiSpotLight):
            light.constant_attenuation = 1.0
            light.linear_attenuation = 2.0
            light.quadratic_attenuation = 3.0
        if cls is NifFormat.NiSpotLight:
            light.cutoff_angle = 45.0
            light.exponent = 8.0
            lightctrl = NifFormat.NiLightColorController()
            lightctrl.data = pos_data     # pyffi types this ref NiPosData
            lightctrl.frequency = 1.0
            lightctrl.stop_time = 1.0
            light.controller = lightctrl
        root.add_child(light)

    # --- a texture effect over an INTERNAL texture, which is the only way
    # NiPixelData and NiPalette reach a file.
    palette = NifFormat.NiPalette()
    palette.unknown_byte = 1
    palette.num_entries = 256
    palette.palette.update_size()
    palette.palette[1].r = 255
    pixels = NifFormat.NiPixelData()
    pixels.pixel_format = 0
    pixels.red_mask = 0x000000ff
    pixels.green_mask = 0x0000ff00
    pixels.blue_mask = 0x00ff0000
    pixels.alpha_mask = 0xff000000
    pixels.bits_per_pixel = 32
    pixels.palette = palette
    pixels.num_mipmaps = 1
    pixels.bytes_per_pixel = 4
    pixels.mipmaps.update_size()
    pixels.mipmaps[0].width = 1
    pixels.mipmaps[0].height = 1
    pixels.mipmaps[0].offset = 0
    pixels.num_pixels = 4
    pixels.pixel_data.update_size()
    for i, b in enumerate((9, 8, 7, 6)):
        pixels.pixel_data[0][i] = b     # pyffi shapes this [faces][pixels]
    internal = NifFormat.NiSourceTexture()
    internal.use_external = 0
    internal.unknown_byte = 1
    internal.pixel_data = pixels
    # A short palette is NOT authored here: pyffi writes 256 entries
    # whatever the count says. extras.nif carries that case by hand.
    effect = NifFormat.NiTextureEffect()
    effect.name = b"Effect"
    ident(effect.rotation)
    effect.scale = 1.0
    ident(effect.model_projection_matrix)
    effect.model_projection_transform.z = 2.0
    effect.texture_filtering = 2
    effect.texture_clamping = 3
    effect.texture_type = 3
    effect.coordinate_generation_type = 2
    effect.source_texture = internal
    effect.clipping_plane = 1
    effect.unknown_vector.y = 1.0
    effect.unknown_float = 0.25
    effect.ps_2_l = 3
    effect.ps_2_k = -4
    effect.unknown_short = 5
    root.add_child(effect)

    # --- a fog property, the one property kind the registry was missing.
    fogged = _tri(root, "Fogged", [(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)])
    fog = NifFormat.NiFogProperty()
    fog.name = b"Fog"
    fog.flags = 1
    fog.fog_depth = 0.75
    fog.fog_color.r = 0.5
    fog.fog_color.g = 0.25
    fog.fog_color.b = 0.125
    fogged.num_properties = 1
    fogged.properties.update_size()
    fogged.properties[0] = fog

    # LAST: the record that says the whole stream stayed in step.
    _bone(root, "Marker", (11.0, 22.0, 33.0))

    # A NiSequence as a second root - it has no parent in a 4.0.0.2 file.
    seq = NifFormat.NiSequence()
    seq.name = b"ZooSeq"
    seq.text_keys_name = b"Accum"
    seq.num_controlled_blocks = 1
    seq.controlled_blocks.update_size()
    seq.controlled_blocks[0].target_name = b"Marker"
    write_nif(HERE / "zoo.nif", [root, seq])


def make_armfp_weapon_kf():
    # MW-D12: THE WEAPON GROUPS, which armfpidle.kf has none of.
    #
    # armfpidle.kf carries MW-D7's eleven clip-law keys verbatim and must
    # keep carrying them, so the attack machine gets its own file. Every
    # key here is one branch of rules 8/9/10/11, and the ABSENCES are as
    # deliberate as the presences:
    #
    #   idle1h   present, with a loop window   - rule 10's dice roll
    #   idle2c   present, idle2b ABSENT        - rule 9's two-handed ladder
    #   idlehh   ABSENT                        - rule 9's one-handed ladder
    #   idlebow  present                       - the asked group, no fallback
    #   idle     present                       - the bare-base tail, and the
    #                                            sheathed stance (rule 8)
    #   weapononehand  has "equip attach" and "unequip detach"
    #   bowandarrow    has NEITHER             - showWeapons by hand
    #   blunttwohand   ABSENT, weapontwohand present - the LONG ladder
    #
    # The three follow strengths are all present for chop, because which
    # one a blow ends on is the only visible consequence of the wind-up
    # strength and a fixture with one of them cannot tell them apart.
    text_keys = [
        (0.0, b"Idle: Start"),
        (0.5, b"Idle: Stop"),
        (0.6, b"Idle1h: Start"),
        (0.8, b"Idle1h: Loop Start"),
        (1.4, b"Idle1h: Loop Stop"),
        (1.6, b"Idle1h: Stop"),
        (1.7, b"Idle2c: Start"),
        (1.9, b"Idle2c: Stop"),
        (2.0, b"WeaponOneHand: Equip Start"),
        (2.2, b"WeaponOneHand: Equip Attach"),
        (2.4, b"WeaponOneHand: Equip Stop"),
        (2.5, b"WeaponOneHand: Chop Start"),
        (2.7, b"WeaponOneHand: Chop Min Attack"),
        (2.9, b"WeaponOneHand: Chop Max Attack"),
        (3.1, b"WeaponOneHand: Chop Min Hit"),
        (3.3, b"WeaponOneHand: Chop Hit"),
        (3.4, b"WeaponOneHand: Chop Small Follow Start"),
        (3.5, b"WeaponOneHand: Chop Small Follow Stop"),
        (3.6, b"WeaponOneHand: Chop Medium Follow Start"),
        (3.7, b"WeaponOneHand: Chop Medium Follow Stop"),
        (3.8, b"WeaponOneHand: Chop Large Follow Start"),
        (4.0, b"WeaponOneHand: Chop Large Follow Stop"),
        (4.1, b"WeaponOneHand: Slash Start"),
        (4.2, b"WeaponOneHand: Slash Max Attack"),
        (4.3, b"WeaponOneHand: Slash Hit"),
        (4.4, b"WeaponOneHand: Slash Large Follow Start"),
        (4.5, b"WeaponOneHand: Slash Large Follow Stop"),
        (4.6, b"WeaponOneHand: Thrust Start"),
        (4.7, b"WeaponOneHand: Thrust Max Attack"),
        (4.8, b"WeaponOneHand: Thrust Hit"),
        (4.9, b"WeaponOneHand: Thrust Large Follow Start"),
        (5.0, b"WeaponOneHand: Thrust Large Follow Stop"),
        (5.1, b"WeaponOneHand: Unequip Start"),
        (5.2, b"WeaponOneHand: Unequip Detach"),
        (5.4, b"WeaponOneHand: Unequip Stop"),
        (5.5, b"BowAndArrow: Equip Start"),
        (5.7, b"BowAndArrow: Equip Stop"),
        (5.8, b"BowAndArrow: Shoot Start"),
        (6.0, b"BowAndArrow: Shoot Min Attack"),
        (6.2, b"BowAndArrow: Shoot Max Attack"),
        (6.4, b"BowAndArrow: Shoot Release"),
        (6.5, b"BowAndArrow: Shoot Follow Start"),
        (6.7, b"BowAndArrow: Shoot Follow Stop"),
        (6.8, b"BowAndArrow: Unequip Start"),
        (7.0, b"BowAndArrow: Unequip Stop"),
        (7.1, b"IdleBow: Start"),
        (7.3, b"IdleBow: Stop"),
        (7.4, b"WeaponTwoHand: Equip Start"),
        (7.6, b"WeaponTwoHand: Equip Stop"),
        (7.7, b"WeaponTwoHand: Chop Start"),
        (7.8, b"WeaponTwoHand: Chop Max Attack"),
        (7.9, b"WeaponTwoHand: Chop Hit"),
        (8.0, b"WeaponTwoHand: Chop Large Follow Start"),
        (8.1, b"WeaponTwoHand: Chop Large Follow Stop"),
        (8.2, b"WeaponTwoHand: Unequip Start"),
        (8.3, b"WeaponTwoHand: Unequip Stop"),
    ]
    tke = NifFormat.NiTextKeyExtraData()
    tke.num_text_keys = len(text_keys)
    tke.text_keys.update_size()
    for k, (t, txt) in zip(tke.text_keys, text_keys):
        k.time = t
        k.value = txt

    def rot_z(deg):
        a = math.radians(deg) / 2.0
        return (math.cos(a), 0.0, 0.0, math.sin(a))

    def rot_x(deg):
        a = math.radians(deg) / 2.0
        return (math.cos(a), math.sin(a), 0.0, 0.0)

    # A key at EVERY window boundary that matters, so two different
    # sections of this file pose the arm differently - a pin that says
    # "the release plays" has to be able to fail when the release does not.
    swing = [(0.0, 0.0), (0.6, 4.0), (1.6, 10.0), (2.0, 2.0), (2.5, 6.0),
             (2.9, 18.0), (3.3, 26.0), (4.0, 8.0), (5.4, 0.0), (5.8, 5.0),
             (6.2, 16.0), (6.7, 3.0), (8.3, 0.0)]
    lift = [(0.0, 0.0), (0.8, 5.0), (1.4, 9.0), (2.4, 3.0), (2.9, 12.0),
            (3.3, 20.0), (4.0, 6.0), (6.2, 14.0), (8.3, 0.0)]
    tracks = [
        ("Right Upper Arm", make_keyframe_data(rot_keys=[(t, rot_z(-d)) for t, d in swing])),
        ("Left Upper Arm", make_keyframe_data(rot_keys=[(t, rot_z(d)) for t, d in swing])),
        ("Right Forearm", make_keyframe_data(rot_keys=[(t, rot_x(d)) for t, d in lift])),
        ("Left Forearm", make_keyframe_data(rot_keys=[(t, rot_x(d)) for t, d in lift])),
    ]

    helper = NifFormat.NiSequenceStreamHelper()
    helper.name = b"ArmFpWeapon"
    helper.extra_data = tke
    prev_extra = tke
    prev_ctrl = None
    for name, kd in tracks:
        sed = NifFormat.NiStringExtraData()
        sed.string_data = name.encode()
        sed.bytes_remaining = 4 + len(name)
        prev_extra.next_extra_data = sed
        prev_extra = sed
        kc = make_keyframe_controller(None, kd, 0.0, 8.3)
        if prev_ctrl is None:
            helper.controller = kc
        else:
            prev_ctrl.next_controller = kc
        prev_ctrl = kc
    write_nif(HERE / "armfpweapon.kf", [helper])


if __name__ == "__main__":
    make_mesh()
    make_dds()
    make_skinned()
    make_plain()
    make_animated()
    make_kf()
    make_flight_kf()
    make_part()
    make_rotbind()
    make_armskel()
    make_armhand()
    make_armcuff()
    make_armnameless()
    make_arm_idle_kf()
    make_armskel_weapon()
    make_armskel_camera()
    make_armfp()
    make_armfp_noweapon()
    make_armfp_hand()
    make_armfp_arm()
    make_armfp_kf()
    make_armfp_weapon_kf()
    make_armfp_esm()
    make_weaponmesh()
    make_armparts_esm()
    make_collswitch()
    make_extras()
    make_zoo()
    make_esm()
    make_bsa()
