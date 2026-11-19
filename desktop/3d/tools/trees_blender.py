# Ink Nine trees: grows four game-ready tree species in Blender, bakes soft shading (ambient occlusion)
# into vertex colours, and exports each as a small GLB for the 3D prototype.
# Units: a tree's crown is about 1 unit in radius; the game scales each one by its size in yards.
import bpy, bmesh, math, random, os
import numpy as np
from mathutils import Vector, Matrix

OUT = OUT_DIR  # set by the caller
SCN = bpy.data.scenes['Ink Nine trees']
os.makedirs(OUT, exist_ok=True)

def coll(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name); SCN.collection.children.link(c)
    for o in list(c.objects): bpy.data.objects.remove(o, do_unlink=True)
    return c

# ---------------- leaf atlas: 2x2 cells, drawn with numpy ----------------
def leaf_atlas(path, size=1024):
    rng = np.random.default_rng(5)
    img = np.zeros((size, size, 4), np.float32)
    cs = size // 2
    yy, xx = np.mgrid[0:cs, 0:cs].astype(np.float32)
    def draw_leaf(cell, cx, cy, ang, ln, wd, col, lobes=0, serr=0.0):
        ox, oy = (cell % 2) * cs, (cell // 2) * cs
        c, s = math.cos(ang), math.sin(ang)
        u = (xx - cx) * c + (yy - cy) * s          # along the leaf, 0 at the stem end
        v = -(xx - cx) * s + (yy - cy) * c
        t = np.clip(u / ln, 0, 1)
        half = wd * np.sin(np.pi * np.clip(t, 0, 1)) ** .8
        if lobes: half = half * (1 + .22 * np.sin(t * np.pi * lobes * 2) ** 2)
        if serr: half = half * (1 + serr * np.sin(t * 60))
        m = (u >= 0) & (u <= ln) & (np.abs(v) <= half)
        shade = (.82 + .3 * t - .25 * np.abs(v) / (wd + 1e-3))[..., None]
        rib = (np.abs(v) < 1.2) & m
        rgb = np.array(col, np.float32)[None, None, :] * shade
        tile = img[oy:oy + cs, ox:ox + cs]
        tile[m, :3] = rgb[m]; tile[m, 3] = 1
        tile[rib, :3] = tile[rib, :3] * .7
    def stem(cell, pts, w, col):
        ox, oy = (cell % 2) * cs, (cell // 2) * cs
        tile = img[oy:oy + cs, ox:ox + cs]
        for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
            dx, dy = x1 - x0, y1 - y0; L2 = dx * dx + dy * dy or 1
            t = np.clip(((xx - x0) * dx + (yy - y0) * dy) / L2, 0, 1)
            d = np.hypot(xx - x0 - t * dx, yy - y0 - t * dy); m = d < w
            tile[m, :3] = col; tile[m, 3] = 1
    # cells 0 and 1: oak sprigs (lobed leaves); cell 2: birch (small serrated); cell 3: pine needle tuft
    for cell, lobes, base in ((0, 3, (.16, .30, .08)), (1, 3, (.20, .33, .10))):
        stem(cell, [(cs / 2, cs - 6), (cs / 2 + 8, cs * .55), (cs / 2, 20)], 3, (.22, .17, .1))
        for i in range(11):
            t = .12 + i / 11 * .82; y = cs - 6 - t * (cs - 30); side = 1 if i % 2 else -1
            g = rng.uniform(.85, 1.15); col = (base[0] * g, base[1] * g, base[2] * g)
            draw_leaf(cell, cs / 2 + 6 * math.sin(t * 3), y, -math.pi / 2 + side * rng.uniform(.6, 1.1), rng.uniform(80, 115), rng.uniform(22, 30), col, lobes=lobes)
    stem(2, [(cs / 2, cs - 6), (cs / 2 - 10, 30)], 2, (.25, .2, .15))
    for i in range(16):
        t = .08 + i / 16 * .9; y = cs - 6 - t * (cs - 40); side = 1 if i % 2 else -1; g = rng.uniform(.85, 1.2)
        draw_leaf(2, cs / 2 - 10 * t, y, -math.pi / 2 + side * rng.uniform(.7, 1.2), rng.uniform(48, 64), rng.uniform(16, 21), (.30 * g, .42 * g, .12 * g), serr=.06)
    for i in range(140):   # pine: needles fanning out from a twig
        a = -math.pi / 2 + rng.uniform(-1.3, 1.3); r0 = rng.uniform(0, cs * .3); x0 = cs / 2 + math.cos(a) * r0 * .2; y0 = cs - 30 - r0
        g = rng.uniform(.8, 1.2); draw_leaf(3, x0, y0, a + rng.uniform(-.5, .5), rng.uniform(90, 150), 3.2, (.13 * g, .27 * g, .12 * g))
    stem(3, [(cs / 2, cs - 6), (cs / 2, cs * .3)], 4, (.2, .14, .1))
    for mname in ('ink9_tree_bark', 'ink9_tree_leaves'):   # previews are rebuilt with the fresh atlas
        if mname in bpy.data.materials: bpy.data.materials.remove(bpy.data.materials[mname])
    name = 'ink9_leaf_atlas'
    if name in bpy.data.images: bpy.data.images.remove(bpy.data.images[name])
    im = bpy.data.images.new(name, size, size, alpha=True)
    im.pixels.foreach_set(img[::-1].ravel())     # Blender images start at the bottom row
    im.filepath_raw = path; im.file_format = 'PNG'; im.save()
    return im

# ---------------- branches: tapered tubes, grown recursively ----------------
class Tree:
    def __init__(s, seed):
        s.r = random.Random(seed); s.limbs = []; s.leaves = []   # limbs: list of point lists [(pos, radius)]
def limb_points(r, a, d, length, r0, r1, bend):
    pts = []; p = a.copy(); dd = d.copy(); n = 4
    for i in range(n + 1):
        t = i / n; pts.append((p.copy(), r0 + (r1 - r0) * t))
        dd = (dd + Vector((r.uniform(-bend, bend), r.uniform(-bend, bend), r.uniform(-bend, bend * .5)))).normalized(); p = p + dd * (length / n)
    return pts, dd
def rot_toward(d, ang, az):
    # a direction tilted ang radians away from d, spun az around d
    up = Vector((0, 0, 1)) if abs(d.z) < .99 else Vector((1, 0, 0))
    a = d.cross(up).normalized(); b = d.cross(a).normalized()
    side = a * math.cos(az) + b * math.sin(az)
    return (d * math.cos(ang) + side * math.sin(ang)).normalized()

def grow_broadleaf(T, depth, a, d, length, rad, spec):
    r = T.r
    pts, end_dir = limb_points(r, a, d, length, rad, rad * .66, spec['bend'])
    T.limbs.append(pts); end = pts[-1][0]
    if depth == 0:
        T.leaves.append((end, spec['cluster'] * r.uniform(.85, 1.15), spec['per_cluster'], spec['cell'](r))); return
    n = r.choice(spec['splits'][min(depth, len(spec['splits']) - 1)])
    for k in range(n):
        ang = r.uniform(*spec['spread']); az = k / n * math.tau + r.uniform(0, 1.2)
        nd = rot_toward(end_dir, ang, az); nd.z += spec['lift']; nd.normalize()
        grow_broadleaf(T, depth - 1, end, nd, length * r.uniform(*spec['shrink']), rad * .64, spec)
    if depth <= 3:   # leaves along the inner twigs too, so the crown is full from above, not a ring
        mid = pts[len(pts) // 2][0]; T.leaves.append((mid, spec['cluster'] * .8, spec['per_cluster'] // 2, spec['cell'](r)))

def grow_pine(T):
    r = T.r; H = 2.7
    trunk = [(Vector((0, 0, z)), .1 * (1 - z / H) + .012) for z in np.linspace(0, H, 12)]
    T.limbs.append(trunk)
    z = .45
    while z < H - .1:
        k = 1 - (z - .45) / (H - .45); n = r.choice([5, 6, 7]); L = .15 + .95 * k
        for i in range(n):
            az = i / n * math.tau + r.uniform(0, .6) + z * 3
            d = Vector((math.cos(az), math.sin(az), r.uniform(-.25, -.05))).normalized()
            a = Vector((0, 0, z)); pts, _ = limb_points(r, a, d, L, .03 * k + .008, .006, .08); T.limbs.append(pts)
            for p, _r in pts[1:]:      # needle tufts along each branch, mostly lying flat
                T.leaves.append((p, .18 + .1 * k, 8, 3))
            T.leaves.append((pts[-1][0], .18, 6, 3))
        z += r.uniform(.14, .2)
    T.leaves.append((Vector((0, 0, H)), .22, 10, 3))

SPECIES = {
    'oak_a': dict(kind='broad', seed=11, trunk=(1.0, .12), depth=4, splits=[[2, 3], [2, 3], [3], [3, 4], [3, 4]], spread=(.45, .8), lift=.32, shrink=(.6, .72), bend=.14, cluster=.34, per_cluster=30, cell=lambda r: r.choice([0, 1])),
    'oak_b': dict(kind='broad', seed=34, trunk=(1.05, .11), depth=4, splits=[[2, 3], [2, 3], [3], [3], [3, 4]], spread=(.45, .8), lift=.3, shrink=(.62, .76), bend=.2, cluster=.32, per_cluster=32, cell=lambda r: r.choice([0, 1])),
    'birch': dict(kind='broad', seed=47, trunk=(1.15, .065), depth=4, splits=[[2, 3], [3], [2, 3], [2, 3], [3]], spread=(.35, .6), lift=.3, shrink=(.62, .74), bend=.12, cluster=.28, per_cluster=34, cell=lambda r: 2),
    'pine': dict(kind='pine', seed=63),
}

def build(name, spec, atlas):
    T = Tree(spec['seed'])
    if spec['kind'] == 'pine': grow_pine(T)
    else:
        h, rad = spec['trunk']; grow_broadleaf(T, spec['depth'], Vector((0, 0, 0)), Vector((T.r.uniform(-.05, .05), T.r.uniform(-.05, .05), 1)).normalized(), h, rad, spec)
    c = coll('Tree ' + name)
    # bark: one curve, a tapered spline per limb, converted to a mesh
    cu = bpy.data.curves.new(name + '_bark', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1; cu.bevel_resolution = 1; cu.use_fill_caps = True
    for pts in T.limbs:
        sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
        for i, (p, rr) in enumerate(pts): sp.points[i].co = (p.x, p.y, p.z, 1); sp.points[i].radius = max(rr, .004)
    co = bpy.data.objects.new(name + '_bark', cu); c.objects.link(co)
    dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(co.evaluated_get(dg)); bpy.data.objects.remove(co); bpy.data.curves.remove(cu)
    me.name = 'bark'; bark = bpy.data.objects.new(name + '_bark', me); c.objects.link(bark)
    # bark UVs: around the limb and along it (a simple cylinder-ish projection is enough at game distance)
    bm = bmesh.new(); bm.from_mesh(me); uvl = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for l in f.loops: p = l.vert.co; l[uvl].uv = (math.atan2(p.y, p.x) / math.tau * 2 + p.x * .5, p.z * 2.2)
    bm.to_mesh(me); bm.free()
    # leaves: cards in clusters, UVs into the atlas cell, normals pointing out of the crown (light like a canopy)
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); r = T.r; normals = []
    zs = [p.z for p, *_ in T.leaves] or [1]; centre = Vector((0, 0, (min(zs) + max(zs)) / 2))
    for (cp, rad, count, cell) in T.leaves:
        for k in range(count):
            q = Vector((r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(-1, 1)))
            if q.length > 1: continue
            p = cp + q * rad; sz = (.2 + r.random() * .12) if cell != 3 else (.17 + r.random() * .08)
            out = (p - centre); out.z *= .6; out = (out.normalized() + Vector((0, 0, .5 if cell != 3 else 1.2))).normalized()
            ax = Vector((r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(-.3, .3))).normalized()
            if cell == 3: ax.z *= .2; ax.normalize()   # pine tufts lie roughly flat: a star from above
            ay = out.cross(ax).normalized()
            if cell == 3: ay = (ay + Vector((0, 0, -.2))).normalized()
            vs = [bm.verts.new(p + ax * sz * i + ay * sz * j) for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            f = bm.faces.new(vs); u0, v0 = (cell % 2) * .5, 1 - (cell // 2) * .5 - .5
            for l, (i, j) in zip(f.loops, ((-1, -1), (1, -1), (1, 1), (-1, 1))): l[uvl].uv = (u0 + (i + 1) * .25, v0 + (j + 1) * .25)
            normals += [out] * 4
    lm = bpy.data.meshes.new('leaves'); bm.to_mesh(lm); bm.free()
    lm.normals_split_custom_set_from_vertices([tuple(n) for n in normals])
    leaves = bpy.data.objects.new(name + '_leaves', lm); c.objects.link(leaves)
    # preview materials (the game uses its own): bark texture, leaf atlas with cut-out, both darkened by the baked shading
    for ob, kind in ((bark, 'bark'), (leaves, 'leaves')):
        m = bpy.data.materials.get('ink9_tree_' + kind) or make_mat(kind, atlas); ob.data.materials.clear(); ob.data.materials.append(m)
        ob.data.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER'); ob.data.color_attributes.active_color = ob.data.color_attributes['AO']
    return bark, leaves, len(lm.polygons), len(me.polygons)

def make_mat(kind, atlas):
    m = bpy.data.materials.new('ink9_tree_' + kind); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage'); attr = nt.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'AO'; mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
    if kind == 'bark':
        tex.image = bpy.data.images.load(BARK, check_existing=True)
    else:
        tex.image = atlas
        nt.links.new(tex.outputs['Alpha'], b.inputs['Alpha']); b.inputs['Roughness'].default_value = .7
    nt.links.new(tex.outputs['Color'], mul.inputs['A']); nt.links.new(attr.outputs['Color'], mul.inputs['B']); nt.links.new(mul.outputs['Result'], b.inputs['Base Color'])
    return m

def ground():
    g = bpy.data.objects.get('Bake ground')
    if g is None:
        me = bpy.data.meshes.new('bake_ground'); bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=6); bm.to_mesh(me); bm.free()
        g = bpy.data.objects.new('Bake ground', me); SCN.collection.objects.link(g)
    return g

def bake_ao(objs):
    SCN.render.engine = 'CYCLES'; SCN.cycles.samples = 48; SCN.cycles.device = 'CPU'
    bpy.context.window.scene = SCN
    for o in objs:
        for x in SCN.objects: x.select_set(False)
        o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', margin=0)

def export(name, objs):
    for x in SCN.objects: x.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + '.glb'), export_format='GLB', use_selection=True, export_materials='NONE',
                              export_vertex_color='ACTIVE', export_normals=True, export_apply=True)
    return os.path.getsize(os.path.join(OUT, name + '.glb'))
