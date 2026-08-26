from pathlib import Path

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
