#!/usr/bin/env python3
"""EOTB-IL: dump every method body of a .NET assembly as CIL.

    pip install dnfile dncil
    python3 tools/ilDump.py "vendor/eye-of-the-beholder/Eye Of The Beholder.dll" \
        > vendor/eye-of-the-beholder/il/Eye_Of_The_Beholder.il.txt

Optional trailing arguments filter by type name substring
(`EyeOfTheBeholder PlayerBillboard`). `monodis` segfaults on this
assembly, which is why the recipe is these two wheels; both install
through the proxy.

Offsets are the method's own IL offsets (`IL_xxxx`, hex) and BRANCH
TARGETS ARE PRINTED AS dncil GIVES THEM - decimal, absolute within the
method - so `brfalse.s 8471` means "IL_" + hex(8471) = IL_2117. The
port's `[IL]` citations use the hex offsets.

Tokens are resolved through the metadata tables: MemberRef and
MethodDef to `Owner::Name`, Field to `Owner::Name`, TypeDef/TypeRef to
the type, MethodSpec through its method, user strings quoted.
"""
import sys

import dnfile
from dncil.cil.body import CilMethodBody
from dncil.cil.body.reader import CilMethodBodyReaderBase
from dncil.clr.token import StringToken, Token


class Reader(CilMethodBodyReaderBase):
    def __init__(self, pe, row):
        self.pe = pe
        self.offset = pe.get_offset_from_rva(row.Rva)

    def read(self, n):
        d = self.pe.get_data(self.pe.get_rva_from_offset(self.offset), n)
        self.offset += n
        return d

    def tell(self):
        return self.offset

    def seek(self, o):
        self.offset = o
        return o


def main(path, want):
    pe = dnfile.dnPE(path)
    md = pe.net.mdtables

    def tname(row):
        ns = str(getattr(row, 'TypeNamespace', '') or '')
        n = str(getattr(row, 'TypeName', '') or getattr(row, 'Name', '') or '')
        return (ns + '.' if ns else '') + n

    owner_m, owner_f = {}, {}
    for t in md.TypeDef.rows:
        for m in t.MethodList:
            owner_m[id(m.row)] = str(t.TypeName)
        for f in t.FieldList:
            owner_f[id(f.row)] = str(t.TypeName)

    def resolve(tok):
        if isinstance(tok, StringToken):
            return '"' + pe.net.user_strings.get(tok.rid).value + '"'
        n, rid = tok.table, tok.rid
        try:
            if n == 0x0a:
                row = md.MemberRef.rows[rid - 1]
                return f'{tname(row.Class.row)}::{row.Name}'
            if n == 0x06:
                row = md.MethodDef.rows[rid - 1]
                return f'{owner_m.get(id(row), "?")}::{row.Name}'
            if n == 0x04:
                row = md.Field.rows[rid - 1]
                return f'{owner_f.get(id(row), "?")}::{row.Name}'
            if n == 0x02:
                return 'typedef:' + tname(md.TypeDef.rows[rid - 1])
            if n == 0x01:
                return 'typeref:' + tname(md.TypeRef.rows[rid - 1])
            if n == 0x2b:
                row = md.MethodSpec.rows[rid - 1]
                if hasattr(row.Method, 'table'):
                    return 'methodspec:' + resolve(Token((row.Method.table.number << 24) | row.Method.row_index))
                return f'methodspec:{tok.value:08x}'
            if n == 0x1b:
                return f'typespec:{tok.value:08x}'
        except Exception as e:  # noqa: BLE001 - a token that will not resolve is still worth printing
            return f'tok:{tok.value:08x}({e})'
        return f'tok:{tok.value:08x}'

    for t in md.TypeDef.rows:
        if want and not any(w in str(t.TypeName) for w in want):
            continue
        fields = [str(f.row.Name) for f in t.FieldList]
        print(f'==== TYPE {t.TypeNamespace}.{t.TypeName} (fields: {fields})')
        for m in t.MethodList:
            r = m.row
            if r.Rva == 0:
                continue
            print(f'\n---- {t.TypeName}::{r.Name} rva={r.Rva:x}')
            try:
                body = CilMethodBody(Reader(pe, r))
            except Exception as e:  # noqa: BLE001
                print('  parse error', e)
                continue
            print(f'  maxstack={body.max_stack} locals_sig={body.local_var_sig_tok} size={body.code_size}')
            for ins in body.instructions:
                op = ins.operand
                if isinstance(op, Token):
                    op = resolve(op)
                print(f'  IL_{ins.offset:04x}: {ins.opcode.name:<14} {op if op is not None else ""}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    main(sys.argv[1], sys.argv[2:])
