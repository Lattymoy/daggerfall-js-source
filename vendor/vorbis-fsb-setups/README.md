# Vorbis setup headers for FSB5 (vgmstream's table; libvorbis's codebooks)

Two Vorbis setup headers (Vorbis I, section 4.2.4: the packet of type 5
that carries a stream's codebooks, floors, residues, mappings and modes),
each named for its CRC32. They are carried for one job: turning a Unity
audio clip back into an Ogg file (`tools/lib/fsb5Vorbis.mjs`, CSA-A).

Unity stores an imported clip as an FMOD sound bank (FSB5). FMOD keeps the
Vorbis audio packets whole but drops the stream's headers, and in place of
the setup header - several KB of codebooks - it writes only that header's
CRC32 (the sample's VORBISDATA chunk), because FMOD's encoder only ever
emits a small family of them. A decoder has to be handed the header whose
CRC32 the bank names. These are the two Come Sail Away's played clips name.

| file | CRC32 | bytes | the clips that name it |
|---|---|---|---|
| `setup_d6e0bbd4.bin` | `0xd6e0bbd4` | 3,771 | SmallShipAmbience (mono, 32 kHz), ShipExteriorAmbience2 (mono, 44.1 kHz) |
| `setup_8d00698d.bin` | `0x8d00698d` | 4,020 | Oars_In, Oars_Sweep, Oars_Out (mono, 22.05 kHz) |

The mod ships three clips it never plays (All_Together, which names
`0x8d00698d`, and oars_cut_1 and oars_cut_2, stereo 44.1 kHz, which name
`0x6d39bf3e`); the port carries none of them, so the third header is not
here either.

## Where they come from

- **vgmstream's table.** Both are entries of vgmstream's
  `src/coding/libs/vorbis_codebooks_fsb.h` (master, read 2026-09-27),
  byte for byte - the table's own note says its packets were extracted
  from FMOD by python-fsb5. vgmstream's licence travels with them:
  `COPYING.vgmstream`, verbatim.
- **libvorbis's own output.** `0xd6e0bbd4` is what the reference encoder
  writes: libvorbisenc 1.3.7, `vorbis_encode_init_vbr`, emits it for a
  mono stream at 44.1 kHz and quality 0.56 (and at 32 kHz and 0.55) -
  regenerated and compared on 2026-09-26. `0x8d00698d` (mono, 22.05 kHz)
  comes out of no quality libvorbisenc 1.3.7 offers, which is why the
  table is the source. libvorbis's
  licence (the Xiph.org Foundation's BSD-3-Clause, from the Debian
  package's copyright file) travels with them too: `COPYING.libvorbis`.

Nothing here is Daggerfall's or Come Sail Away's: a setup header is the
encoder's tables, the same for every stream encoded at that mode.
`test/tooling/csa_audio.test.js` holds each file to its CRC32 and parses it to
its mode table.
