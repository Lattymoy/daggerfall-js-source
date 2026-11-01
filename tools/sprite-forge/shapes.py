"""Mesh builders for the forge: lofts of elliptical rings, shells, flat cut plates. Every builder makes its mesh in
world rest space and returns the object; `model.py` hangs each on its joint."""
import math
import bmesh
import bpy
from mathutils import Vector


def _frame(axis):
    axis = axis.normalized()
    ref = Vector((0, 1, 0)) if abs(axis.y) < 0.9 else Vector((0, 0, 1))
    u = ref.cross(axis).normalized()   # across: +X for a downward axis
    v = axis.cross(u).normalized()     # depth: +Y (back) for a downward axis
    if axis.z < 0:
        u, v = -u, v
    return u, v


def _link(name, bm, mat, smooth=True, subsurf=2):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if mat:
        me.materials.append(mat)
    if subsurf:
        m = ob.modifiers.new('sub', 'SUBSURF')
        m.levels = subsurf
        m.render_levels = subsurf
    return ob


def loft(name, p0, p1, rings, mat, n=16, cap=(True, True), subsurf=2, axis_u=None):
    """A tube from p0 to p1. `rings` are (t, ru, rv[, ou, ov]): place along the axis (0..1), radius across (u) and
    in depth (v), and an offset of the ring's centre. A negative t or t > 1 extends past the ends."""
    p0, p1 = Vector(p0), Vector(p1)
    axis = p1 - p0
    u, v = _frame(axis)
    if axis_u is not None:
        u = Vector(axis_u).normalized()
        v = axis.normalized().cross(u).normalized()
    bm = bmesh.new()
    loops = []
    for r in rings:
        t, ru, rv = r[0], r[1], r[2]
        ou, ov = (r[3], r[4]) if len(r) > 3 else (0.0, 0.0)
        c = p0 + axis * t + u * ou + v * ov
        loops.append([bm.verts.new(c + u * (ru * math.cos(a)) + v * (rv * math.sin(a)))
                      for a in (2 * math.pi * i / n for i in range(n))])
    for a, b in zip(loops, loops[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if cap[0]:
        bm.faces.new(list(reversed(loops[0])))
    if cap[1]:
        bm.faces.new(loops[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _link(name, bm, mat, subsurf=subsurf)


def ellipsoid(name, centre, radii, mat, z_cut=None, segs=24, rings=16, subsurf=1, keep_below=False, tilt_y=0.0,
              squash=None, tilt_x=0.0):
    """An ellipsoid, or the part of it above (or below) the plane z = z_cut (cut before tilting), left open at the
    cut, then tilted `tilt_x` degrees about X and `tilt_y` about Y through its centre. `squash(v)` may reshape the unit sphere first."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    c, r = Vector(centre), Vector(radii)
    if squash:
        for vtx in bm.verts:
            vtx.co = squash(vtx.co.copy())
    for vtx in bm.verts:
        vtx.co = Vector((vtx.co.x * r.x, vtx.co.y * r.y, vtx.co.z * r.z))
    if z_cut is not None:
        zc = z_cut - c.z
        gone = [vtx for vtx in bm.verts if (vtx.co.z > zc + 1e-6 if keep_below else vtx.co.z < zc - 1e-6)]
        bmesh.ops.delete(bm, geom=gone, context='VERTS')
    t, tx = math.radians(tilt_y), math.radians(tilt_x)
    for vtx in bm.verts:
        x, y, z = vtx.co
        y, z = y * math.cos(tx) - z * math.sin(tx), y * math.sin(tx) + z * math.cos(tx)
        vtx.co = Vector((x * math.cos(t) + z * math.sin(t), y, -x * math.sin(t) + z * math.cos(t))) + c
    return _link(name, bm, mat, subsurf=subsurf)


def plate(name, outline, thickness, mat, plane='XZ', at=(0, 0, 0), subsurf=0, bevel=0.0):
    """A flat cut-out: `outline` is a polygon in the plane's two axes, extruded `thickness` along the third."""
    bm = bmesh.new()
    at = Vector(at)
    def put(a, b, d):
        if plane == 'XZ':
            return at + Vector((a, d, b))
        if plane == 'YZ':
            return at + Vector((d, a, b))
        return at + Vector((a, b, d))
    front = [bm.verts.new(put(a, b, -thickness / 2)) for a, b in outline]
    back = [bm.verts.new(put(a, b, thickness / 2)) for a, b in outline]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    k = len(outline)
    for i in range(k):
        bm.faces.new((front[i], back[i], back[(i + 1) % k], front[(i + 1) % k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _link(name, bm, mat, smooth=False, subsurf=subsurf)
    if bevel:
        m = ob.modifiers.new('bev', 'BEVEL')
        m.width = bevel
        m.segments = 1
    return ob


def sheet(name, rows, mat, thickness=0.006, subsurf=1):
    """A cloth panel from rows of points (each row left to right), thickened."""
    bm = bmesh.new()
    grid = [[bm.verts.new(Vector(p)) for p in row] for row in rows]
    for a, b in zip(grid, grid[1:]):
        for i in range(len(a) - 1):
            bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
    ob = _link(name, bm, mat, subsurf=subsurf)
    s = ob.modifiers.new('thick', 'SOLIDIFY')
    s.thickness = thickness
    ob.modifiers.move(len(ob.modifiers) - 1, 0)
    return ob


def tube_path(name, pts, radius, mat, n=8, subsurf=1):
    """A thin tube along a polyline (a haft, a bowstring, a limb of a bow)."""
    bm = bmesh.new()
    loops = []
    pts = [Vector(p) for p in pts]
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        u, v = _frame(d)
        r = radius(i / (len(pts) - 1)) if callable(radius) else radius
        loops.append([bm.verts.new(p + u * (r * math.cos(a)) + v * (r * math.sin(a)))
                      for a in (2 * math.pi * k / n for k in range(n))])
    for a, b in zip(loops, loops[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bm.faces.new(list(reversed(loops[0])))
    bm.faces.new(loops[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _link(name, bm, mat, subsurf=subsurf)
