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
    root, bones = build_skinned_rig()

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


if __name__ == "__main__":
    make_mesh()
    make_dds()
    make_skinned()
    make_plain()
    make_animated()
    make_kf()
    make_bsa()
