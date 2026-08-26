from pathlib import Path

# The source trace is measured in pixels and the voxel mesh in world units. End
# orientation therefore compares WHICH end is wider, never their raw magnitudes.
wt = Path('src/tools/paperdoll/weaponTexture.js')
w = wt.read_text()
old_axis = """  const defaultCost=Math.abs(top-ends.max)+Math.abs(bottom-ends.min);\n  const flippedCost=Math.abs(top-ends.min)+Math.abs(bottom-ends.max);\n  if(flippedCost+1e-6<defaultCost){axis=mul(axis,-1);basis=radialBasis(axis);ends=meshEndWidths(pts,center,axis,basis.right);}\n"""
new_axis = """  const sourceBias=top-bottom, meshBias=ends.max-ends.min;\n  // Source spans are pixels; mesh spans are world units. Only the wider-end sign\n  // is comparable across those spaces. If the source's broad end and the mesh's\n  // broad end disagree, reverse the length axis.\n  if(Math.abs(sourceBias)>0.5 && Math.abs(meshBias)>1e-4 && sourceBias*meshBias<0){axis=mul(axis,-1);basis=radialBasis(axis);ends=meshEndWidths(pts,center,axis,basis.right);}\n"""
if old_axis not in w:
    raise SystemExit('weaponTexture: orientation anchor missing')
wt.write_text(w.replace(old_axis, new_axis, 1))

src = Path('tools/patch_weapon_shield_textures.py').read_text()
start = src.index('# Weapon material toggle keeps procedural ramp as fallback')
end = src.index('# Populate/select the four shields alongside the complete weapon registry.')
fixed = r'''# Weapon material toggle keeps procedural ramp as fallback, then asynchronously
# replaces it with the traced classic source texture when ARENA2 is available.
rep(
    'src/tools/paperdollViewer.js',
    "  document.getElementById('sword').textContent = 'sword: ' + (on ? name : 'off');",
    "  document.getElementById('sword').textContent = 'weapon: ' + (on ? name : 'off');",
)
rep(
    'src/tools/paperdollViewer.js',
    "  } else swordInfo.textContent = '';\n};",
    "    syncActiveWeaponTexture();\n  } else { clearWeaponTexture(); swordInfo.textContent = ''; }\n};",
)

'''
exec(compile(src[:start] + fixed + src[end:], 'weapon-shield-patch-v2', 'exec'))
