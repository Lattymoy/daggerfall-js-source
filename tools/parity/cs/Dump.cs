// Differential parity harness - C# ground-truth driver (AUDIT 18).
// Runs the real DaggerfallConnect readers under plain Mono and emits
// deterministic key<TAB>value lines.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using DaggerfallConnect;
using DaggerfallConnect.Arena2;
using DaggerfallConnect.Utility;
using UnityEngine;

public static class Dump
{
    public static string Arena2;
    static TextWriter W;

    public static void Out(string key, string val)
    {
        W.Write(key); W.Write('\t'); W.Write(val); W.Write('\n');
    }
    public static void Out(string key, int val) { Out(key, val.ToString(CultureInfo.InvariantCulture)); }
    public static void Out(string key, long val) { Out(key, val.ToString(CultureInfo.InvariantCulture)); }
    public static void Out(string key, uint val) { Out(key, val.ToString(CultureInfo.InvariantCulture)); }
    public static void Out(string key, bool val) { Out(key, val ? "1" : "0"); }

    // Exact bit patterns: avoids all float formatting ambiguity between C# and JS.
    public static string F(float f)
    {
        byte[] b = BitConverter.GetBytes(f);
        if (!BitConverter.IsLittleEndian) Array.Reverse(b);
        return string.Format("f{0:x2}{1:x2}{2:x2}{3:x2}", b[3], b[2], b[1], b[0]);
    }
    public static string D(double d)
    {
        long bits = BitConverter.DoubleToInt64Bits(d);
        return "d" + bits.ToString("x16");
    }
    public static string Sha1(byte[] data)
    {
        if (data == null) return "null";
        using (SHA1 sha = SHA1.Create())
        {
            byte[] h = sha.ComputeHash(data);
            StringBuilder sb = new StringBuilder(40);
            foreach (byte b in h) sb.Append(b.ToString("x2"));
            return sb.ToString();
        }
    }
    public static string Sha1(Color32[] colors)
    {
        if (colors == null) return "null";
        byte[] buf = new byte[colors.Length * 4];
        for (int i = 0; i < colors.Length; i++)
        {
            buf[i * 4 + 0] = colors[i].r;
            buf[i * 4 + 1] = colors[i].g;
            buf[i * 4 + 2] = colors[i].b;
            buf[i * 4 + 3] = colors[i].a;
        }
        return Sha1(buf);
    }
    // Escape a string so it can never contain tab/newline.
    public static string S(string s)
    {
        if (s == null) return "<null>";
        StringBuilder sb = new StringBuilder();
        foreach (char c in s)
        {
            if (c == '\t') sb.Append("\\t");
            else if (c == '\n') sb.Append("\\n");
            else if (c == '\r') sb.Append("\\r");
            else if (c == '\\') sb.Append("\\\\");
            else if (c < 32 || c > 126) sb.Append("\\x" + ((int)c).ToString("x4"));
            else sb.Append(c);
        }
        return sb.ToString();
    }

    public static List<string> Files(string pattern)
    {
        List<string> r = new List<string>(Directory.GetFiles(Arena2, pattern));
        List<string> names = new List<string>();
        foreach (string f in r) names.Add(Path.GetFileName(f));
        names.Sort(StringComparer.Ordinal);
        return names;
    }

    public static int Main(string[] args)
    {
        Arena2 = Environment.GetEnvironmentVariable("ARENA2_PATH");
        if (string.IsNullOrEmpty(Arena2)) throw new Exception("set ARENA2_PATH");
        string cmd = args.Length > 0 ? args[0] : "all";
        string outPath = args.Length > 1 ? args[1] : null;
        Stream os = outPath != null ? (Stream)File.Create(outPath) : Console.OpenStandardOutput();
        W = new StreamWriter(os, new UTF8Encoding(false));
        try
        {
            switch (cmd)
            {
                case "bsa": DumpBsa(); break;
                case "texture": DumpTexture(); break;
                case "texparams": DumpTexParams(); break;
                case "texspectral": DumpTexSpectral(); break;
                case "tables": DumpTables(); break;
                case "img": DumpImg(); break;
                case "cifrci": DumpCifRci(); break;
                case "arch3d": DumpArch3d(); break;
                case "arch3ddetail": DumpArch3dDetail(); break;
                case "blocks": DumpBlocksMapsMisc.DumpBlocks(); break;
                case "maps": DumpBlocksMapsMisc.DumpMaps(); break;
                case "woods": DumpWoods(); break;
                case "misc": DumpBlocksMapsMisc.DumpMisc(); break;
                case "dfrandom": DumpDFRandom(); break;
                case "faceuv": DumpFaceUV(); break;
                case "class": DumpClass(); break;
                case "biog": DumpBiog(); break;
                case "spells": DumpSpells(); break;
                case "magic": DumpMagic(); break;
                case "faceuvcorpus": GenFaceUVCorpus(); break;
                default: Console.Error.WriteLine("unknown cmd " + cmd); return 2;
            }
        }
        finally { W.Flush(); W.Close(); }
        return 0;
    }

    // ---------------- 1. BSA directories ----------------
    static void DumpBsa()
    {
        List<string> names = new List<string>();
        names.AddRange(Files("*.BSA"));
        names.AddRange(Files("*.SND"));
        names.Sort(StringComparer.Ordinal);
        foreach (string name in names)
        {
            BsaFile bsa = new BsaFile();
            if (!bsa.Load(Path.Combine(Arena2, name), FileUsage.UseMemory, true))
            {
                Out("bsa." + name + ".load", "FAIL");
                continue;
            }
            Out("bsa." + name + ".count", bsa.Count);
            Out("bsa." + name + ".dirType", (int)bsa.DirectoryType);
            for (int i = 0; i < bsa.Count; i++)
            {
                string p = string.Format("bsa.{0}.{1:D5}.", name, i);
                Out(p + "name", S(bsa.GetRecordName(i)));
                Out(p + "id", bsa.GetRecordId(i));
                Out(p + "size", bsa.GetRecordLength(i));
                Out(p + "pos", bsa.GetRecordPosition(i));
            }
        }
    }

    // ---------------- 2. TEXTURE.* ----------------
    static void DumpTexture()
    {
        DFPalette pal = new DFPalette(Path.Combine(Arena2, "ART_PAL.COL"));
        List<string> names = Files("TEXTURE.*");
        foreach (string name in names)
        {
            TextureFile tf = new TextureFile();
            tf.Palette = pal;
            bool ok = tf.Load(Path.Combine(Arena2, name), FileUsage.UseMemory, true);
            string p0 = "tex." + name + ".";
            Out(p0 + "load", ok);
            if (!ok) continue;
            Out(p0 + "recordCount", tf.RecordCount);
            Out(p0 + "description", S(tf.Description));
            Out(p0 + "paletteName", S(tf.PaletteName));
            for (int r = 0; r < tf.RecordCount; r++)
            {
                string p = string.Format("{0}{1:D4}.", p0, r);
                DFSize sz = tf.GetSize(r);
                DFSize sc = tf.GetScale(r);
                DFPosition off = tf.GetOffset(r);
                int fc = tf.GetFrameCount(r);
                Out(p + "frames", fc);
                Out(p + "w", sz.Width);
                Out(p + "h", sz.Height);
                Out(p + "scaleX", sc.Width);
                Out(p + "scaleY", sc.Height);
                Out(p + "offX", off.X);
                Out(p + "offY", off.Y);
                for (int f = 0; f < fc; f++)
                {
                    DFBitmap bm = tf.GetDFBitmap(r, f);
                    string pf = string.Format("{0}f{1:D3}.", p, f);
                    Out(pf + "bw", bm.Width);
                    Out(pf + "bh", bm.Height);
                    Out(pf + "idx", Sha1(bm.Data));
                    DFSize so;
                    Color32[] c = tf.GetColor32(bm, -1, 0, out so);
                    Out(pf + "rgba", Sha1(c));
                }
            }
        }
    }

    // GetColor32 exercised across its FULL parameter surface + GetWindowColors32,
    // over a deterministic slice of TEXTURE archives.
    static void DumpTexParams()
    {
        DFPalette pal = new DFPalette(Path.Combine(Arena2, "ART_PAL.COL"));
        foreach (string name in Files("TEXTURE.*"))
        {
            TextureFile tf = new TextureFile();
            tf.Palette = pal;
            if (!tf.Load(Path.Combine(Arena2, name), FileUsage.UseMemory, true)) continue;
            for (int r = 0; r < tf.RecordCount; r++)
            {
                int fc = tf.GetFrameCount(r);
                for (int f = 0; f < fc; f++)
                {
                    DFBitmap bm = tf.GetDFBitmap(r, f);
                    string p = string.Format("tp.{0}.{1:D4}.f{2:D3}.", name, r, f);
                    DFSize so;
                    Color32[] c;
                    c = tf.GetColor32(bm, 0, 0, out so);
                    Out(p + "a0b0", Sha1(c));
                    c = tf.GetColor32(bm, 0, 2, out so);
                    Out(p + "a0b2.w", so.Width); Out(p + "a0b2.h", so.Height); Out(p + "a0b2", Sha1(c));
                    c = tf.GetColor32(bm, 0, 3, out so, 255, 128);
                    Out(p + "a0b3e255c128", Sha1(c));
                    c = tf.GetColor32(bm, -1, 1, out so, 0, 64);
                    Out(p + "am1b1e0c64", Sha1(c));
                    Out(p + "win", Sha1(tf.GetWindowColors32(bm)));
                    Out(p + "win12", Sha1(tf.GetWindowColors32(bm, 12)));
                }
            }
        }
    }

    // Spectral archives: SetSpectral remap + the spectral albedo GetColor32 call
    // exactly as TextureReader.cs:237-238 makes it.
    static void DumpTexSpectral()
    {
        DFPalette pal = new DFPalette(Path.Combine(Arena2, "ART_PAL.COL"));
        foreach (int archive in new int[] { 273, 278, 473 })
        {
            string name = TextureFile.IndexToFileName(archive);
            TextureFile tf = new TextureFile();
            tf.Palette = pal;
            if (!tf.Load(Path.Combine(Arena2, name), FileUsage.UseMemory, true)) { Out("spec." + name + ".load", 0); continue; }
            Out("spec." + name + ".isSpectral", TextureFile.IsSpectralArchive(archive));
            for (int r = 0; r < tf.RecordCount; r++)
            {
                for (int f = 0; f < tf.GetFrameCount(r); f++)
                {
                    DFBitmap bm = tf.GetDFBitmap(r, f);
                    // GetDFBitmap caches, and SetSpectral mutates in place - copy first,
                    // exactly as our JS side does, so repeated frames are not double-remapped.
                    DFBitmap copy = new DFBitmap(bm.Width, bm.Height);
                    Array.Copy(bm.Data, copy.Data, bm.Data.Length);
                    SpectralShim.SetSpectral(ref copy);
                    string p = string.Format("spec.{0}.{1:D3}.f{2:D3}.", name, r, f);
                    Out(p + "idx", Sha1(copy.Data));
                    DFSize sz;
                    Out(p + "albedo", Sha1(tf.GetColor32(copy, 0, 0, out sz, 247, 180)));
                    Out(p + "albedoB2", Sha1(tf.GetColor32(copy, 0, 2, out sz, 247, 180)));
                }
            }
        }
    }

    // Static tables that never touch a file: RegionNames/Races/Temples,
    // RMB block prefixes, RDB block letters, PatchRegionIndex.
    static void DumpTables()
    {
        string[] rn = MapsFile.RegionNames;
        Out("tbl.regionNames.count", rn.Length);
        for (int i = 0; i < rn.Length; i++) Out(string.Format("tbl.regionNames.{0:D2}", i), S(rn[i]));
        byte[] rr = MapsFile.RegionRaces;
        Out("tbl.regionRaces.count", rr.Length);
        for (int i = 0; i < rr.Length; i++) Out(string.Format("tbl.regionRaces.{0:D2}", i), rr[i]);
        int[] rt = MapsFile.RegionTemples;
        Out("tbl.regionTemples.count", rt.Length);
        for (int i = 0; i < rt.Length; i++) Out(string.Format("tbl.regionTemples.{0:D2}", i), rt[i]);
        // rmbBlockPrefixes / rdbBlockLetters are private; exercise them through
        // ResolveRmbBlockName + the dungeon block names (already covered by the maps
        // corpus), and through PatchRegionIndex here.
        for (int i = -1; i < rn.Length; i++)
        {
            string canonical = (i >= 0 && i < rn.Length) ? rn[i] : "Daggerfall";
            Out(string.Format("tbl.patchRegion.{0:D2}.same", i), MapsFile.PatchRegionIndex(i, canonical));
            Out(string.Format("tbl.patchRegion.{0:D2}.wayrest", i), MapsFile.PatchRegionIndex(i, "Wayrest"));
            Out(string.Format("tbl.patchRegion.{0:D2}.bogus", i), MapsFile.PatchRegionIndex(i, "NotARegion"));
        }
        for (int i = 0; i < rn.Length; i++)
            Out(string.Format("tbl.nameBank.{0:D2}", i), (int)MapsFile.GetNameBankOfRegion(i));
        Out("tbl.nameBank.minus1", (int)MapsFile.GetNameBankOfRegion(-1));
    }

    // ---------------- 3. IMG ----------------
    static void DumpImg()
    {
        List<string> names = Files("*.IMG");
        foreach (string name in names)
        {
            // Fresh palette per file: palettized IMGs overwrite their palette in place.
            DFPalette pal = new DFPalette(Path.Combine(Arena2, "ART_PAL.COL"));
            ImgFile im = new ImgFile();
            im.Palette = pal;
            bool ok = im.Load(Path.Combine(Arena2, name), FileUsage.UseMemory, true);
            string p0 = "img." + name + ".";
            Out(p0 + "load", ok);
            if (!ok) continue;
            Out(p0 + "paletteName", S(im.PaletteName));
            Out(p0 + "recordCount", im.RecordCount);
            Out(p0 + "frames", im.GetFrameCount(0));
            DFSize sz = im.GetSize(0);
            Out(p0 + "w", sz.Width);
            Out(p0 + "h", sz.Height);
            Out(p0 + "isPalettized", im.IsPalettized);
            Out(p0 + "offX", im.ImageOffset.X);
            Out(p0 + "offY", im.ImageOffset.Y);
            DFBitmap bm = im.GetDFBitmap(0, 0);
            Out(p0 + "bw", bm.Width);
            Out(p0 + "bh", bm.Height);
            Out(p0 + "idx", Sha1(bm.Data));
            DFSize so;
            Out(p0 + "rgba", Sha1(im.GetColor32(bm, -1, 0, out so)));
        }
    }

    // ---------------- 4. CIF / RCI ----------------
    static void DumpCifRci()
    {
        DFPalette pal = new DFPalette(Path.Combine(Arena2, "ART_PAL.COL"));
        List<string> names = new List<string>();
        names.AddRange(Files("*.CIF"));
        names.AddRange(Files("*.RCI"));
        names.Sort(StringComparer.Ordinal);
        foreach (string name in names)
        {
            CifRciFile cf = new CifRciFile();
            cf.Palette = pal;
            bool ok = cf.Load(Path.Combine(Arena2, name), FileUsage.UseMemory, true);
            string p0 = "cif." + name + ".";
            Out(p0 + "load", ok);
            if (!ok) continue;
            Out(p0 + "recordCount", cf.RecordCount);
            Out(p0 + "paletteName", S(cf.PaletteName));
            for (int r = 0; r < cf.RecordCount; r++)
            {
                string p = string.Format("{0}{1:D3}.", p0, r);
                DFSize sz = cf.GetSize(r);
                DFPosition off = cf.GetOffset(r);
                int fc = cf.GetFrameCount(r);
                Out(p + "frames", fc);
                Out(p + "w", sz.Width);
                Out(p + "h", sz.Height);
                Out(p + "offX", off.X);
                Out(p + "offY", off.Y);
                for (int f = 0; f < fc; f++)
                {
                    DFBitmap bm = cf.GetDFBitmap(r, f);
                    string pf = string.Format("{0}f{1:D3}.", p, f);
                    Out(pf + "bw", bm.Width);
                    Out(pf + "bh", bm.Height);
                    Out(pf + "idx", Sha1(bm.Data));
                    DFSize so;
                    Out(pf + "rgba", Sha1(cf.GetColor32(bm, -1, 0, out so)));
                }
            }
        }
    }

    // ---------------- 5. ARCH3D ----------------
    static void DumpArch3d()
    {
        Arch3dFile a3d = new Arch3dFile();
        if (!a3d.Load(Path.Combine(Arena2, "ARCH3D.BSA"), FileUsage.UseMemory, true))
        { Out("arch3d.load", "FAIL"); return; }
        a3d.AutoDiscard = true;
        Out("arch3d.count", a3d.Count);
        for (int i = 0; i < a3d.Count; i++)
        {
            string p = string.Format("arch3d.{0:D5}.", i);
            Out(p + "id", a3d.GetRecordId(i));
            DFMesh m = a3d.GetMesh(i);
            Out(p + "objectId", m.ObjectId);
            Out(p + "radius", F(m.Radius));
            Out(p + "sizeX", F(m.Size.X)); Out(p + "sizeY", F(m.Size.Y)); Out(p + "sizeZ", F(m.Size.Z));
            Out(p + "centreX", F(m.Centre.X)); Out(p + "centreY", F(m.Centre.Y)); Out(p + "centreZ", F(m.Centre.Z));
            Out(p + "totalVertices", m.TotalVertices);
            Out(p + "totalTriangles", m.TotalTriangles);
            Out(p + "subMeshes", m.SubMeshes == null ? -1 : m.SubMeshes.Length);
            if (m.SubMeshes == null) continue;
            // Checksum over the full point stream, exactly ordered.
            MemoryStream ms = new MemoryStream();
            BinaryWriter bw = new BinaryWriter(ms);
            for (int s = 0; s < m.SubMeshes.Length; s++)
            {
                DFMesh.DFSubMesh sm = m.SubMeshes[s];
                string ps = string.Format("{0}sm{1:D3}.", p, s);
                Out(ps + "archive", sm.TextureArchive);
                Out(ps + "record", sm.TextureRecord);
                Out(ps + "tris", sm.TotalTriangles);
                Out(ps + "planes", sm.Planes == null ? -1 : sm.Planes.Length);
                bw.Write(sm.TextureArchive); bw.Write(sm.TextureRecord); bw.Write(sm.TotalTriangles);
                if (sm.Planes == null) continue;
                for (int pl = 0; pl < sm.Planes.Length; pl++)
                {
                    DFMesh.DFPlane plane = sm.Planes[pl];
                    bw.Write((int)plane.UVGenerationMethod);
                    bw.Write(plane.Points == null ? -1 : plane.Points.Length);
                    if (plane.Points == null) continue;
                    for (int q = 0; q < plane.Points.Length; q++)
                    {
                        DFMesh.DFPoint pt = plane.Points[q];
                        bw.Write(pt.X); bw.Write(pt.Y); bw.Write(pt.Z);
                        bw.Write(pt.NX); bw.Write(pt.NY); bw.Write(pt.NZ);
                        bw.Write(pt.U); bw.Write(pt.V);
                    }
                }
            }
            bw.Flush();
            Out(p + "meshSha", Sha1(ms.ToArray()));
        }
    }

    // Full per-point detail for a bounded record range (localises mesh mismatches).
    static void DumpArch3dDetail()
    {
        Arch3dFile a3d = new Arch3dFile();
        a3d.Load(Path.Combine(Arena2, "ARCH3D.BSA"), FileUsage.UseMemory, true);
        a3d.AutoDiscard = true;
        string lo = Environment.GetEnvironmentVariable("A3D_LO"), hi = Environment.GetEnvironmentVariable("A3D_HI");
        int i0 = lo == null ? 0 : int.Parse(lo), i1 = hi == null ? 30 : int.Parse(hi);
        for (int i = i0; i < i1 && i < a3d.Count; i++)
        {
            string p = string.Format("a3d.{0:D5}.", i);
            DFMesh m = a3d.GetMesh(i);
            if (m.SubMeshes == null) { Out(p + "subMeshes", -1); continue; }
            for (int s = 0; s < m.SubMeshes.Length; s++)
            {
                DFMesh.DFSubMesh sm = m.SubMeshes[s];
                for (int pl = 0; pl < sm.Planes.Length; pl++)
                {
                    DFMesh.DFPlane plane = sm.Planes[pl];
                    string pp = string.Format("{0}{1:D3}.{2:D3}.", p, s, pl);
                    Out(pp + "uvgen", (int)plane.UVGenerationMethod);
                    Out(pp + "pts", plane.Points.Length);
                    for (int q = 0; q < plane.Points.Length; q++)
                    {
                        DFMesh.DFPoint pt = plane.Points[q];
                        string pq = string.Format("{0}{1:D2}.", pp, q);
                        Out(pq + "x", F(pt.X)); Out(pq + "y", F(pt.Y)); Out(pq + "z", F(pt.Z));
                        Out(pq + "nx", F(pt.NX)); Out(pq + "ny", F(pt.NY)); Out(pq + "nz", F(pt.NZ));
                        Out(pq + "u", F(pt.U)); Out(pq + "v", F(pt.V));
                    }
                }
            }
        }
    }

    // ---------------- CLASS*.CFG / ENEMY*.CFG ----------------
    static void DumpClass()
    {
        List<string> names = Files("*.CFG");
        foreach (string name in names)
        {
            if (!name.StartsWith("CLASS", StringComparison.Ordinal)) continue;
            ClassFile cf = new ClassFile();
            bool ok = cf.Load(Path.Combine(Arena2, name), FileUsage.UseMemory, true);
            string p = "class." + name + ".";
            Out(p + "load", ok);
            if (!ok) continue;
            DFCareer c = cf.Career;
            Out(p + "name", S(c.Name));
            Out(p + "hpPerLevel", c.HitPointsPerLevel);
            Out(p + "advMultiplier", F(c.AdvancementMultiplier));
            Out(p + "strength", c.Strength); Out(p + "intelligence", c.Intelligence);
            Out(p + "willpower", c.Willpower); Out(p + "agility", c.Agility);
            Out(p + "endurance", c.Endurance); Out(p + "personality", c.Personality);
            Out(p + "speed", c.Speed); Out(p + "luck", c.Luck);
            Out(p + "primary", (int)c.PrimarySkill1 + "," + (int)c.PrimarySkill2 + "," + (int)c.PrimarySkill3);
            Out(p + "major", (int)c.MajorSkill1 + "," + (int)c.MajorSkill2 + "," + (int)c.MajorSkill3);
            Out(p + "minor", (int)c.MinorSkill1 + "," + (int)c.MinorSkill2 + "," + (int)c.MinorSkill3 + ","
                + (int)c.MinorSkill4 + "," + (int)c.MinorSkill5 + "," + (int)c.MinorSkill6);
        }
    }

    // ---------------- BIOG*.TXT ----------------
    static void DumpBiog()
    {
        foreach (string name in Files("BIOG*.TXT"))
        {
            // BIOG<class:D2>T<set>.TXT
            int classIndex = int.Parse(name.Substring(4, 2), CultureInfo.InvariantCulture);
            string text = System.Text.Encoding.UTF8.GetString(File.ReadAllBytes(Path.Combine(Arena2, name)));
            string p0 = "biog." + name + ".";
            BiogParse bp;
            try { bp = new BiogParse(text, name, classIndex); }
            catch (Exception e) { Out(p0 + "error", S(e.GetType().Name)); continue; }
            Out(p0 + "backstoryId", bp.backstoryId);
            for (int q = 0; q < bp.questions.Length; q++)
            {
                string p = string.Format("{0}q{1:D2}.", p0, q);
                if (bp.questions[q] == null) { Out(p + "null", 1); continue; }
                Out(p + "text0", S(bp.questions[q].Text[0]));
                Out(p + "text1", S(bp.questions[q].Text[1]));
                Out(p + "answers", bp.questions[q].Answers.Count);
                for (int a = 0; a < bp.questions[q].Answers.Count; a++)
                {
                    string pa = string.Format("{0}a{1:D2}.", p, a);
                    Out(pa + "text", S(bp.questions[q].Answers[a].Text));
                    Out(pa + "effects", bp.questions[q].Answers[a].Effects.Count);
                    for (int e = 0; e < bp.questions[q].Answers[a].Effects.Count; e++)
                        Out(string.Format("{0}e{1:D2}", pa, e), S(bp.questions[q].Answers[a].Effects[e]));
                }
            }
        }
    }

    // ---------------- SPELLS.STD ----------------
    static void DumpSpells()
    {
        var spells = DaggerfallWorkshop.Utility.DaggerfallSpellReader.ReadSpellsFile(Path.Combine(Arena2, "SPELLS.STD"));
        Out("spells.count", spells == null ? -1 : spells.Count);
        if (spells == null) return;
        for (int i = 0; i < spells.Count; i++)
        {
            var sp = spells[i];
            string p = string.Format("spells.{0:D4}.", i);
            Out(p + "name", S(sp.spellName));
            Out(p + "element", sp.element);
            Out(p + "rangeType", sp.rangeType);
            Out(p + "cost", sp.cost);
            Out(p + "index", sp.index);
            Out(p + "icon", sp.icon);
            for (int e = 0; e < sp.effects.Length; e++)
            {
                var ef = sp.effects[e];
                string q = string.Format("{0}e{1}.", p, e);
                Out(q + "type", ef.type);
                Out(q + "subType", ef.subType);
                Out(q + "durationBase", ef.durationBase);
                Out(q + "durationMod", ef.durationMod);
                Out(q + "durationPerLevel", ef.durationPerLevel);
                Out(q + "chanceBase", ef.chanceBase);
                Out(q + "chanceMod", ef.chanceMod);
                Out(q + "chancePerLevel", ef.chancePerLevel);
                Out(q + "magnitudeBaseLow", ef.magnitudeBaseLow);
                Out(q + "magnitudeBaseHigh", ef.magnitudeBaseHigh);
                Out(q + "magnitudeLevelBase", ef.magnitudeLevelBase);
                Out(q + "magnitudeLevelHigh", ef.magnitudeLevelHigh);
                Out(q + "magnitudePerLevel", ef.magnitudePerLevel);
            }
        }
    }

    // ---------------- MAGIC.DEF ----------------
    static void DumpMagic()
    {
        MagicItemsFile mf = new MagicItemsFile(Path.Combine(Arena2, "MAGIC.DEF"), FileUsage.UseMemory, true);
        var items = mf.MagicItemsList;
        Out("magic.count", items.Count);
        for (int i = 0; i < items.Count; i++)
        {
            var it = items[i];
            string p = string.Format("magic.{0:D4}.", i);
            Out(p + "index", it.index);
            Out(p + "name", S(it.name));
            Out(p + "type", (int)it.type);
            Out(p + "group", it.group);
            Out(p + "groupIndex", it.groupIndex);
            Out(p + "uses", it.uses);
            Out(p + "value", it.value);
            Out(p + "material", it.material);
            for (int e = 0; e < it.enchantments.Length; e++)
                Out(string.Format("{0}ench{1:D2}", p, e), (int)it.enchantments[e].type + "," + it.enchantments[e].param);
        }
    }

    // ---------------- 8. WOODS ----------------
    static void DumpWoods()
    {
        WoodsFile w = new WoodsFile();
        if (!w.Load(Path.Combine(Arena2, "WOODS.WLD"), FileUsage.UseMemory, true))
        { Out("woods.load", "FAIL"); return; }
        Out("woods.mapWidth", WoodsFile.MapWidth);
        Out("woods.mapHeight", WoodsFile.MapHeight);
        DFBitmap hm = w.GetHeightMapDFBitmap();
        Out("woods.heightMap.w", hm.Width);
        Out("woods.heightMap.h", hm.Height);
        Out("woods.heightMap.sha", Sha1(hm.Data));
        // Deterministic sample of map pixels: full 1000x500 sweep of GetHeightMapValue,
        // checksummed, plus explicit values at a coarse grid.
        byte[] all = new byte[1000 * 500];
        int k = 0;
        for (int y = 0; y < 500; y++)
            for (int x = 0; x < 1000; x++)
                all[k++] = w.GetHeightMapValue(x, y);
        Out("woods.getHeightMapValue.sha", Sha1(all));
        for (int y = 0; y < 500; y += 37)
            for (int x = 0; x < 1000; x += 53)
                Out(string.Format("woods.hv.{0:D4}.{1:D4}", x, y), w.GetHeightMapValue(x, y));
        // GetLargeHeightMapValuesRange over a deterministic sample.
        for (int y = 3; y < 500; y += 61)
        {
            for (int x = 7; x < 1000; x += 71)
            {
                byte[,] rng = w.GetLargeHeightMapValuesRange(x, y, 4);
                int d0 = rng.GetLength(0), d1 = rng.GetLength(1);
                byte[] flat = new byte[d0 * d1];
                int j = 0;
                for (int a = 0; a < d0; a++) for (int b = 0; b < d1; b++) flat[j++] = rng[a, b];
                Out(string.Format("woods.lhr.{0:D4}.{1:D4}.dim", x, y), d0 + "x" + d1);
                Out(string.Format("woods.lhr.{0:D4}.{1:D4}.sha", x, y), Sha1(flat));
            }
        }
        // GetHeightMapValuesRange (small) sample
        for (int y = 11; y < 500; y += 83)
        {
            for (int x = 13; x < 1000; x += 97)
            {
                byte[] flat = w.GetHeightMapValuesRange1Dim(x, y, 5);
                Out(string.Format("woods.hr.{0:D4}.{1:D4}.sha", x, y), Sha1(flat));
            }
        }
        // Large map data sample
        for (int y = 5; y < 500; y += 113)
        {
            for (int x = 9; x < 1000; x += 131)
            {
                byte[,] rng = w.GetLargeMapData(x, y);
                int d0 = rng.GetLength(0), d1 = rng.GetLength(1);
                byte[] flat = new byte[d0 * d1];
                int j = 0;
                for (int a = 0; a < d0; a++) for (int b = 0; b < d1; b++) flat[j++] = rng[a, b];
                Out(string.Format("woods.lmd.{0:D4}.{1:D4}.dim", x, y), d0 + "x" + d1);
                Out(string.Format("woods.lmd.{0:D4}.{1:D4}.sha", x, y), Sha1(flat));
            }
        }
    }

    // ---------------- 9. DFRandom ----------------
    static void DumpDFRandom()
    {
        uint[] seeds = new uint[] { 0u, 1u, 12345u, 0xDEADBEEFu, 987654321u };
        foreach (uint s in seeds)
        {
            DaggerfallWorkshop.DFRandom.srand(s);
            for (int i = 0; i < 10000; i++)
                Out(string.Format("dfrandom.rand.{0}.{1:D5}", s, i), DaggerfallWorkshop.DFRandom.rand());
        }
        DaggerfallWorkshop.DFRandom.srand(42u);
        for (int i = 0; i < 5000; i++)
            Out(string.Format("dfrandom.rr.{0:D5}", i), DaggerfallWorkshop.DFRandom.random_range(0, 100));
        DaggerfallWorkshop.DFRandom.srand(42u);
        for (int i = 0; i < 5000; i++)
            Out(string.Format("dfrandom.rri.{0:D5}", i), DaggerfallWorkshop.DFRandom.random_range_inclusive(-50, 50));
        DaggerfallWorkshop.DFRandom.srand(7u);
        for (int i = 0; i < 5000; i++)
            Out(string.Format("dfrandom.rr1.{0:D5}", i), DaggerfallWorkshop.DFRandom.random_range(1000));
    }

    // Generates the FaceUVTool input corpus straight out of ARCH3D.BSA.
    static void GenFaceUVCorpus()
    {
        string corpusFile = Environment.GetEnvironmentVariable("FACEUV_CORPUS");
        using (StreamWriter sw = new StreamWriter(File.Create(corpusFile), new UTF8Encoding(false)))
        {
            HarnessCorpus.FaceUVWriter = sw;
            Arch3dFile a3d = new Arch3dFile();
            a3d.Load(Path.Combine(Arena2, "ARCH3D.BSA"), FileUsage.UseMemory, true);
            a3d.AutoDiscard = true;
            using (StreamWriter iw = new StreamWriter(File.Create(corpusFile + ".index"), new UTF8Encoding(false)))
            {
                HarnessCorpus.FaceUVIndexWriter = iw;
                for (int i = 0; i < a3d.Count; i++) { HarnessCorpus.CurrentRecord = i; a3d.GetMesh(i); }
                HarnessCorpus.FaceUVIndexWriter = null;
            }
            HarnessCorpus.FaceUVWriter = null;
        }
        Out("faceuvcorpus.done", 1);
    }

    // ---------------- 10. FaceUVTool ----------------
    static void DumpFaceUV()
    {
        // Deterministic corpus: read raw plane point data straight out of ARCH3D and
        // feed the same DFPurePoint sets into FaceUVTool on both sides.
        // The corpus itself is emitted so the JS side consumes identical inputs.
        string corpus = Path.Combine(Path.GetDirectoryName(Environment.GetEnvironmentVariable("HARNESS_DIR") ?? "."), "");
        string corpusFile = Environment.GetEnvironmentVariable("FACEUV_CORPUS");
        if (corpusFile == null) { Out("faceuv.error", "FACEUV_CORPUS not set"); return; }
        FaceUVTool tool = new FaceUVTool();
        string[] lines = File.ReadAllLines(corpusFile);
        int caseIndex = 0;
        foreach (string line in lines)
        {
            if (line.Length == 0) continue;
            string[] parts = line.Split(' ');
            int n = int.Parse(parts[0], CultureInfo.InvariantCulture);
            FaceUVTool.DFPurePoint[] pin = new FaceUVTool.DFPurePoint[n];
            int idx = 1;
            for (int i = 0; i < n; i++)
            {
                pin[i].x = int.Parse(parts[idx++], CultureInfo.InvariantCulture);
                pin[i].y = int.Parse(parts[idx++], CultureInfo.InvariantCulture);
                pin[i].z = int.Parse(parts[idx++], CultureInfo.InvariantCulture);
                pin[i].nx = int.Parse(parts[idx++], CultureInfo.InvariantCulture);
                pin[i].ny = int.Parse(parts[idx++], CultureInfo.InvariantCulture);
                pin[i].nz = int.Parse(parts[idx++], CultureInfo.InvariantCulture);
                pin[i].u = int.Parse(parts[idx++], CultureInfo.InvariantCulture);
                pin[i].v = int.Parse(parts[idx++], CultureInfo.InvariantCulture);
            }
            FaceUVTool.DFPurePoint[] pout = new FaceUVTool.DFPurePoint[n];
            bool ok = tool.ComputeFaceUVCoordinates(ref pin, ref pout);
            string p = string.Format("faceuv.{0:D5}.", caseIndex);
            Out(p + "ok", ok);
            for (int i = 0; i < n; i++)
            {
                Out(string.Format("{0}{1:D2}.u", p, i), pout[i].u);
                Out(string.Format("{0}{1:D2}.v", p, i), pout[i].v);
            }
            caseIndex++;
        }
        Out("faceuv.cases", caseIndex);
    }
}
