#!/usr/bin/env python3
"""HAZE1 / WINDFALL1 / SNOWFALL1: a Unity bundle's compiled shaders, read back as GLSL.

    pip install UnityPy lz4
    apt install vkd3d-compiler spirv-cross
    python3 -I tools/dxbcGlsl.py "<path-to>/windfall.dfmod" vendor/windfall/shaders

A `.dfmod` built for Windows carries its shaders as DXBC only (Direct3D 11
bytecode; the platform list is `[4]`), and a DXBC program has its reflection
stripped by Unity - the constant buffers are `cb0`..`cbN` with no member
names. So the recipe is three steps:

  1. the serialized blob (LZ4, one entry per sub-program: offset, length,
     segment - twelve bytes a row after the count) gives each program's DXBC
     container, found by its magic and its own size field;
  2. `vkd3d-compiler -x dxbc-tpf -b spirv-binary` and
     `spirv-cross --version 450` turn it into GLSL. Desktop GLSL 450 on
     purpose: GLSL ES 3.0 has no fma(), and spirv-cross's read-modify-write
     shortening then prints DXBC's `mad r, a, b, c` as `r *= b + c` - a
     different expression. 450 prints `fma(a, b, c)`;
  3. the parsed form's own bindings (`m_ConstantBuffers`,
     `m_ConstantBufferBindings`, `m_TextureParams`, the pass's
     `m_NameIndices`) name every slot: a header above each listing says
     which `cbN._m0[i].c` is which property (`_WindfallSwayAmplitude` at
     `[9].y`, Unity's `_Time` at `UnityPerCamera[0]`).

Only the variants a port reads are written: each pass's program with the
fewest keywords (the plain DIRECTIONAL forward base, a shadow caster's
SHADOWS_DEPTH, an unlit pass's none). The listings are read beside the port
(render/heatHaze.js, render/renderer.js, render/snowSurface.js cite them by
file); nothing compiles them.
"""
import os
import re
import struct
import subprocess
import sys

import lz4.block
import UnityPy

WANTED_MODES = ('FORWARDBASE', 'SHADOWCASTER', '')


def flat(x):
    return [v for s in x for v in (s if isinstance(s, list) else [s])]


def header_for(pf_pass, names, sp, stage):
    out = []
    for cb in sp['m_ConstantBuffers']:
        slot = [b['m_Index'] for b in sp['m_ConstantBufferBindings'] if b['m_NameIndex'] == cb['m_NameIndex']]
        out.append(f'// cbuffer {names.get(cb["m_NameIndex"])} -> cb{slot} size={cb["m_Size"]}')
        for v in cb['m_VectorParams']:
            out.append(f'//   [{v["m_Index"] // 16}].{"xyzw"[(v["m_Index"] % 16) // 4]} {names.get(v["m_NameIndex"])} dim={v["m_Dim"]}')
        for m in cb['m_MatrixParams']:
            out.append(f'//   [{m["m_Index"] // 16}..] MATRIX {names.get(m["m_NameIndex"])} rows={m["m_RowCount"]}')
    for t in sp['m_TextureParams']:
        out.append(f'// texture t{t["m_Index"]} s{t["m_SamplerIndex"]} {names.get(t["m_NameIndex"])}')
    return out


def main(src, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    env = UnityPy.load(src)
    for obj in env.objects:
        if obj.type.name != 'Shader':
            continue
        tree = obj.read_typetree()
        pf = tree['m_ParsedForm']
        name = pf['m_Name']
        if name.startswith('Legacy Shaders/'):
            continue   # Unity's own built-in shaders, carried in the bundle as dependencies - not the mod's
        o = flat(tree['offsets'])[0]
        c = flat(tree['compressedLengths'])[0]
        u = flat(tree['decompressedLengths'])[0]
        raw = lz4.block.decompress(bytes(tree['compressedBlob'])[o:o + c], uncompressed_size=u)
        count = struct.unpack_from('<i', raw, 0)[0]
        entries = [struct.unpack_from('<ii', raw, 4 + 12 * i) for i in range(count)]
        lines = [f'// {name} - read back from the DXBC by tools/dxbcGlsl.py (GLSL 450: DXBC mad is fma)', '']
        for pi, p in enumerate(pf['m_SubShaders'][0]['m_Passes']):
            tags = {t[0]: t[1] for t in p['m_State']['m_Tags']['tags']}
            mode = tags.get('LIGHTMODE', '')
            if mode not in WANTED_MODES or (not p['progVertex']['m_SubPrograms']):
                continue
            names = {idx: nm for nm, idx in p['m_NameIndices']}
            for stage in ('progVertex', 'progFragment'):
                best = None
                for sp in p[stage]['m_SubPrograms']:
                    eo, el = entries[sp['m_BlobIndex']]
                    ent = raw[eo:eo + el]
                    di = ent.find(b'DXBC')
                    kws = [m.decode() for m in re.findall(rb'[A-Z_][A-Z0-9_]{3,}', ent[:di])]
                    if best is None or len(kws) < len(best[1]):
                        best = (sp, kws, ent[di:di + struct.unpack_from('<I', ent, di + 24)[0]])
                if best is None:
                    continue
                sp, kws, dxbc = best
                tmp = os.path.join(out_dir, '.tmp.dxbc')
                spv = os.path.join(out_dir, '.tmp.spv')
                with open(tmp, 'wb') as f:
                    f.write(dxbc)
                subprocess.run(['vkd3d-compiler', '-x', 'dxbc-tpf', '-b', 'spirv-binary', '-o', spv, tmp], check=True, capture_output=True)
                glsl = subprocess.run(['spirv-cross', spv, '--version', '450'], check=True, capture_output=True, text=True).stdout
                os.remove(tmp)
                os.remove(spv)
                lines.append(f'// ==== pass {pi} "{p["m_State"]["m_Name"]}" LIGHTMODE={mode or "-"} {stage[4:].lower()} keywords={kws}')
                lines += header_for(p, names, sp, stage)
                lines.append(glsl.rstrip())
                lines.append('')
        file = re.sub(r'[^A-Za-z0-9]+', '_', name.split('/')[-1]).strip('_') + '.glsl'
        with open(os.path.join(out_dir, file), 'w') as f:
            f.write('\n'.join(lines) + '\n')
        print(name, '->', file)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
