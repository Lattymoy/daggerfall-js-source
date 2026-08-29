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
    make_weaponmesh()
    make_esm()
    make_bsa()
