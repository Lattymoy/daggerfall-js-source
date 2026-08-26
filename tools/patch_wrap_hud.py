from pathlib import Path

p = Path('src/tools/paperdollViewer.js')
s = p.read_text()
old = """      if (hud) hud.textContent = c
        ? c.name + ' · classic template ' + c.index + ' · ' + c.kind + (meta ? ' · ' + meta.source + ' record ' + meta.record + ' · source pixels' : ' · procedural fallback (ARENA2 texture unavailable)')
        : 'NEUTRAL POSE prototype · drag to rotate · pinch to zoom';
"""
new = """      if (hud) hud.textContent = c
        ? c.name + ' · classic template ' + c.index + ' · ' + c.kind + (meta
          ? ' · ' + meta.source + ' record ' + meta.record + (meta.wrapMode === 'generated-8-way' ? ' · 8-way generated wrap' : ' · source pixels')
          : ' · procedural fallback (ARENA2 texture unavailable)')
        : 'NEUTRAL POSE prototype · drag to rotate · pinch to zoom';
"""
assert s.count(old) == 1, 'classic clothing HUD anchor drifted'
p.write_text(s.replace(old, new, 1))
