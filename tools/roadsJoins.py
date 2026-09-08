#!/usr/bin/env python3
"""MODS AUDIT (2026-09-08): THE JOIN GENERATOR. BasicRoadsTexturing.cs's
PaintPathWithSubPathJoins carries seventy-six centre-join statements
(MIT, Copyright (C) 2020 Hazelnut) in nested `if` / `else` / `else if`
chains; the port and the oracle used to carry four of them, hand
transliterated, and shared the omission. This script parses the C#
block by indentation into a tree and emits it twice - as JS for
src/world/roadPainter.js (paintPathWithSubPathJoins' centre-join body)
and as Python for tools/roadsOracle.py - so the two are one reading of
the source and cannot drift from each other by hand.

    python3 tools/roadsJoins.py BasicRoadsTexturing.cs joins.js joins.py

The C# is not vendored (the port cites it; the arrays are what is
carried). Fetch it from github.com/ajrb/dfunity-mods, BasicRoads/Scripts/.
The block is located by its comments, "// N-S path" through the close
of the `if (pathTiles[CardOut] != null)` block. Paste the outputs over
the bodies they replace; test/roadsParity.test.js is the check.
"""
import re, sys
CS, OUT_JS, OUT_PY = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(CS).read().split('\n')
start = next(i for i, l in enumerate(text) if l.strip() == '// N-S path')
# the block ends at the line closing the CardOut `if` at the same indent as "// N-S path"
depth = 0; end = None
for i in range(start, len(text)):
    s = text[i].strip()
    if s == '{': depth += 1
    elif s == '}':
        depth -= 1
        if depth == 0: end = i; break
lines = [l.rstrip() for l in text[start:end + 1]]
def ind(l): return len(l) - len(l.lstrip())
def cond_js(c):
    c = re.sub(r'\(pathDataPt & (\w+)\) != 0', r'(m & DIR.\1)', c)
    c = re.sub(r'\(subPathDataPt & (\w+)\) != 0', r'(sub & DIR.\1)', c)
    c = re.sub(r'\(pathDataPt & (\w+)\) == 0', r'!(m & DIR.\1)', c)
    c = re.sub(r'\(subPathDataPt & (\w+)\) == 0', r'!(sub & DIR.\1)', c)
    c = c.replace('midLo', 'MID_LO').replace('midHi', 'MID_HI').replace('offset', 'o').replace('==', '===').replace('!==', '!==')
    c = c.replace('&&', '&&')
    return c
def stmt_js(s):
    m = re.match(r'PaintPathTile\(x, y, index, pathTiles\[(\w+)\], (\w+), (\w+)\);', s)
    if m:
        slot = {'ICorner': 'ic', 'CardOut': 'co'}[m.group(1)]
        return f'{slot}({m.group(2)}, {m.group(3)});'
    if s == 'SetPathTile(index, water, false, false);': return 'water();'
    raise Exception(s)
def cond_py(c):
    c = c.replace('&&', 'and').replace('||', 'or')
    return c
def stmt_py(s):
    m = re.match(r'PaintPathTile\(x, y, index, pathTiles\[(\w+)\], (\w+), (\w+)\);', s)
    if m:
        return f'self.PaintPathTile(x, y, index, pathTiles[{m.group(1)}], {m.group(2).capitalize()}, {m.group(3).capitalize()})'
    if s == 'SetPathTile(index, water, false, false);': return 'self.SetPathTile(index, water, False, False)'
    raise Exception(s)

# Simpler: hand-structured emitter using the recursion with explicit handling.
def parse2(lines, i, base):
    """Parse statements at indentation == base until a line with indentation < base."""
    out = []
    while i < len(lines):
        l = lines[i]
        if not l.strip(): out.append(('blank',)); i += 1; continue
        if ind(l) < base: break
        assert ind(l) == base, (l, base)
        s = l.strip()
        if s.startswith('//'): out.append(('comment', s)); i += 1; continue
        if s == '{':
            body, i = parse2(lines, i + 1, base + 4)
            assert lines[i].strip() == '}'; i += 1
            out.append(('block', body)); continue
        m = re.match(r'if \((.*)\)$', s)
        if m:
            node, i = parse_if(lines, i, base)
            out.append(node); continue
        out.append(('stmt', s)); i += 1
    return out, i
def parse_if(lines, i, base):
    s = lines[i].strip()
    m = re.match(r'(?:else )?if \((.*)\)$', s); cond = m.group(1)
    i += 1
    while not lines[i].strip(): i += 1
    if lines[i].strip() == '{' and ind(lines[i]) == base:
        body, i = parse2(lines, i + 1, base + 4); assert lines[i].strip() == '}'; i += 1
        return ('block', body), i
    # then: one statement (possibly a nested if/else) at base+4
    then, i = parse_one(lines, i, base + 4)
    els = None
    if i < len(lines) and lines[i].strip().startswith('else') and ind(lines[i]) == base:
        e = lines[i].strip()
        if e == 'else':
            els, i = parse_one(lines, i + 1, base + 4)
        else:
            node, i = parse_if(lines, i, base); els = node
    return ('if', cond, then, els), i
def parse_one(lines, i, base):
    while not lines[i].strip(): i += 1
    l = lines[i]; s = l.strip(); assert ind(l) == base, (l, base)
    if s == '{':
        body, i = parse2(lines, i + 1, base + 4); assert lines[i].strip() == '}'; return ('block', body), i + 1
    if s.startswith('if ('):
        return parse_if(lines, i, base)
    return ('stmt', s), i + 1

tree, _ = parse2(lines, 0, ind(lines[0]))

def emit_js(nodes, pad):
    o = []
    for n in nodes:
        if n[0] == 'blank': o.append('')
        elif n[0] == 'comment': o.append(pad + n[1])
        elif n[0] == 'stmt': o.append(pad + stmt_js(n[1]))
        elif n[0] == 'block':
            o.append(pad + 'if (T[CARD_OUT]) {'); o += emit_js(n[1], pad + '  '); o.append(pad + '}')
        elif n[0] == 'if': o += emit_js_if(n, pad)
    return o
def emit_js_if(n, pad, lead='if'):
    _, cond, then, els = n
    o = []
    simple = then[0] == 'stmt' and els is None
    if simple:
        o.append(f'{pad}{lead} ({cond_js(cond)}) {stmt_js(then[1])}'); return o
    o.append(f'{pad}{lead} ({cond_js(cond)}) {{')
    o += emit_js([then], pad + '  ') if then[0] != 'if' else emit_js_if(then, pad + '  ')
    if els is None: o.append(pad + '}')
    elif els[0] == 'if':
        o[-1:] = o[-1:]  # keep
        o.append(pad + '} else ' + emit_js_if(els, pad)[0].lstrip()); 
        rest = emit_js_if(els, pad)[1:]; o += rest
    else:
        o.append(pad + '} else {'); o += emit_js([els], pad + '  '); o.append(pad + '}')
    return o

def emit_py(nodes, pad):
    o = []
    for n in nodes:
        if n[0] == 'blank': o.append('')
        elif n[0] == 'comment': o.append(pad + '# ' + n[1][3:])
        elif n[0] == 'stmt': o.append(pad + stmt_py(n[1]))
        elif n[0] == 'block':
            o.append(pad + 'if pathTiles[CardOut] is not None:'); o += emit_py(n[1], pad + '    ')
        elif n[0] == 'if': o += emit_py_if(n, pad)
    return o
def emit_py_if(n, pad, lead='if'):
    _, cond, then, els = n
    o = []
    if then[0] == 'stmt' and els is None:
        o.append(f'{pad}{lead} {cond_py(cond)}: {stmt_py(then[1])}'); return o
    o.append(f'{pad}{lead} {cond_py(cond)}:')
    o += emit_py([then], pad + '    ') if then[0] != 'if' else emit_py_if(then, pad + '    ')
    if els is None: pass
    elif els[0] == 'if': o += emit_py_if(els, pad, 'elif')
    else: o.append(pad + 'else:'); o += emit_py([els], pad + '    ')
    return o

open(OUT_JS, 'w').write('\n'.join(emit_js(tree, '    ')) + '\n')
open(OUT_PY, 'w').write('\n'.join(emit_py(tree, '            ')) + '\n')
