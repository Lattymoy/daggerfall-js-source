using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using DaggerfallConnect;
using DaggerfallConnect.Arena2;
using DaggerfallConnect.Utility;
using UnityEngine;

public static partial class Dump2 { }

public static class DumpBlocksMapsMisc
{
    // ---------------- 6. BLOCKS ----------------
    public static void DumpBlocks()
    {
        BlocksFile bf = new BlocksFile();
        if (!bf.Load(Path.Combine(Dump.Arena2, "BLOCKS.BSA"), FileUsage.UseMemory, true))
        { Dump.Out("blocks.load", "FAIL"); return; }
        bf.AutoDiscard = true;
        Dump.Out("blocks.count", bf.Count);
        for (int i = 0; i < bf.Count; i++)
        {
            string name = bf.GetBlockName(i);
            string p = string.Format("blk.{0:D5}.", i);
            Dump.Out(p + "name", Dump.S(name));
            Dump.Out(p + "type", (int)bf.GetBlockType(i));
            DFBlock b = bf.GetBlock(i);
            Dump.Out(p + "index", b.Index);
            Dump.Out(p + "bname", Dump.S(b.Name));
            Dump.Out(p + "btype", (int)b.Type);
            if (b.Type == DFBlock.BlockTypes.Rmb) DumpRmb(p, ref b);
            else if (b.Type == DFBlock.BlockTypes.Rdb) DumpRdb(p, ref b);
            else if (b.Type == DFBlock.BlockTypes.Rdi)
                Dump.Out(p + "rdi.sha", Dump.Sha1(b.RdiBlock.Data));
        }
    }

    static void DumpRmb(string p, ref DFBlock b)
    {
        DFBlock.RmbBlockFld f = b.RmbBlock.FldHeader;
        Dump.Out(p + "rmb.numBlockData", f.NumBlockDataRecords);
        Dump.Out(p + "rmb.numMisc3d", f.NumMisc3dObjectRecords);
        Dump.Out(p + "rmb.numMiscFlat", f.NumMiscFlatObjectRecords);
        Dump.Out(p + "rmb.fldName", Dump.S(f.Name));
        Dump.Out(p + "rmb.otherNames", f.OtherNames == null ? "-1" : f.OtherNames.Length.ToString(CultureInfo.InvariantCulture));
        if (f.OtherNames != null)
            for (int i = 0; i < f.OtherNames.Length; i++)
                Dump.Out(string.Format("{0}rmb.otherName.{1:D2}", p, i), Dump.S(f.OtherNames[i]));
        Dump.Out(p + "rmb.autoMap.sha", Dump.Sha1(f.AutoMapData));
        for (int i = 0; f.BlockPositions != null && i < f.BlockPositions.Length; i++)
        {
            string q = string.Format("{0}rmb.pos.{1:D2}.", p, i);
            Dump.Out(q + "x", f.BlockPositions[i].XPos);
            Dump.Out(q + "z", f.BlockPositions[i].ZPos);
            Dump.Out(q + "yr", f.BlockPositions[i].YRotation);
        }
        for (int i = 0; f.BuildingDataList != null && i < f.BuildingDataList.Length; i++)
        {
            DFLocation.BuildingData bd = f.BuildingDataList[i];
            string q = string.Format("{0}rmb.bld.{1:D2}.", p, i);
            Dump.Out(q + "nameSeed", bd.NameSeed);
            Dump.Out(q + "factionId", bd.FactionId);
            Dump.Out(q + "sector", bd.Sector);
            Dump.Out(q + "locationId", bd.LocationId);
            Dump.Out(q + "buildingType", (int)bd.BuildingType);
            Dump.Out(q + "quality", bd.Quality);
        }
        for (int i = 0; f.BlockDataSizes != null && i < f.BlockDataSizes.Length; i++)
            Dump.Out(string.Format("{0}rmb.dataSize.{1:D2}", p, i), f.BlockDataSizes[i]);
        // Ground data
        Dump.Out(p + "rmb.gnd.header.sha", Dump.Sha1(f.GroundData.Header));
        if (f.GroundData.GroundTiles != null)
        {
            MemoryStream ms = new MemoryStream();
            BinaryWriter bw = new BinaryWriter(ms);
            int d0 = f.GroundData.GroundTiles.GetLength(0), d1 = f.GroundData.GroundTiles.GetLength(1);
            Dump.Out(p + "rmb.gnd.tiles.dim", d0 + "x" + d1);
            for (int y = 0; y < d1; y++)
                for (int x = 0; x < d0; x++)
                {
                    DFBlock.RmbGroundTiles t = f.GroundData.GroundTiles[x, y];
                    bw.Write(t.TileBitfield); bw.Write(t.TextureRecord);
                    bw.Write(t.IsRotated); bw.Write(t.IsFlipped);
                }
            bw.Flush();
            Dump.Out(p + "rmb.gnd.tiles.sha", Dump.Sha1(ms.ToArray()));
        }
        if (f.GroundData.GroundScenery != null)
        {
            MemoryStream ms = new MemoryStream();
            BinaryWriter bw = new BinaryWriter(ms);
            int d0 = f.GroundData.GroundScenery.GetLength(0), d1 = f.GroundData.GroundScenery.GetLength(1);
            Dump.Out(p + "rmb.gnd.scen.dim", d0 + "x" + d1);
            for (int y = 0; y < d1; y++)
                for (int x = 0; x < d0; x++)
                    bw.Write(f.GroundData.GroundScenery[x, y].TextureRecord);
            bw.Flush();
            Dump.Out(p + "rmb.gnd.scen.sha", Dump.Sha1(ms.ToArray()));
        }
        // Sub records
        DFBlock.RmbSubRecord[] subs = b.RmbBlock.SubRecords;
        Dump.Out(p + "rmb.subRecords", subs == null ? -1 : subs.Length);
        for (int i = 0; subs != null && i < subs.Length; i++)
        {
            string q = string.Format("{0}rmb.sub.{1:D2}.", p, i);
            Dump.Out(q + "x", subs[i].XPos);
            Dump.Out(q + "z", subs[i].ZPos);
            Dump.Out(q + "yr", subs[i].YRotation);
            DumpRmbBlockData(q + "ext.", subs[i].Exterior);
            DumpRmbBlockData(q + "int.", subs[i].Interior);
        }
        DumpMisc3d(p + "rmb.misc3d.", b.RmbBlock.Misc3dObjectRecords);
        DumpMiscFlat(p + "rmb.miscFlat.", b.RmbBlock.MiscFlatObjectRecords);
    }

    static void DumpMisc3d(string p, DFBlock.RmbBlock3dObjectRecord[] arr)
    {
        Dump.Out(p + "count", arr == null ? -1 : arr.Length);
        for (int i = 0; arr != null && i < arr.Length; i++)
        {
            string q = string.Format("{0}{1:D3}.", p, i);
            Dump.Out(q + "modelId", Dump.S(arr[i].ModelId));
            Dump.Out(q + "modelIdNum", arr[i].ModelIdNum);
            Dump.Out(q + "objectType", arr[i].ObjectType);
            Dump.Out(q + "x", arr[i].XPos); Dump.Out(q + "y", arr[i].YPos); Dump.Out(q + "z", arr[i].ZPos);
            // XScale/YScale/ZScale are never written by the reader (mod world-data only) - omitted.
            Dump.Out(q + "xr", arr[i].XRotation); Dump.Out(q + "yr", arr[i].YRotation); Dump.Out(q + "zr", arr[i].ZRotation);
        }
    }
    static void DumpMiscFlat(string p, DFBlock.RmbBlockFlatObjectRecord[] arr)
    {
        Dump.Out(p + "count", arr == null ? -1 : arr.Length);
        for (int i = 0; arr != null && i < arr.Length; i++)
        {
            string q = string.Format("{0}{1:D3}.", p, i);
            Dump.Out(q + "x", arr[i].XPos); Dump.Out(q + "y", arr[i].YPos); Dump.Out(q + "z", arr[i].ZPos);
            Dump.Out(q + "arch", arr[i].TextureArchive); Dump.Out(q + "rec", arr[i].TextureRecord);
            Dump.Out(q + "faction", arr[i].FactionID); Dump.Out(q + "flags", arr[i].Flags);
        }
    }

    static void DumpRmbBlockData(string p, DFBlock.RmbBlockData d)
    {
        Dump.Out(p + "n3d", d.Header.Num3dObjectRecords);
        Dump.Out(p + "nflat", d.Header.NumFlatObjectRecords);
        Dump.Out(p + "ns3", d.Header.NumSection3Records);
        Dump.Out(p + "nppl", d.Header.NumPeopleRecords);
        Dump.Out(p + "ndoor", d.Header.NumDoorRecords);
        DumpMisc3d(p + "m3d.", d.Block3dObjectRecords);
        DumpMiscFlat(p + "flat.", d.BlockFlatObjectRecords);
        Dump.Out(p + "s3.count", d.BlockSection3Records == null ? -1 : d.BlockSection3Records.Length);
        for (int i = 0; d.BlockSection3Records != null && i < d.BlockSection3Records.Length; i++)
        {
            string q = string.Format("{0}s3.{1:D3}.", p, i);
            Dump.Out(q + "x", d.BlockSection3Records[i].XPos);
            Dump.Out(q + "y", d.BlockSection3Records[i].YPos);
            Dump.Out(q + "z", d.BlockSection3Records[i].ZPos);
        }
        Dump.Out(p + "ppl.count", d.BlockPeopleRecords == null ? -1 : d.BlockPeopleRecords.Length);
        for (int i = 0; d.BlockPeopleRecords != null && i < d.BlockPeopleRecords.Length; i++)
        {
            string q = string.Format("{0}ppl.{1:D3}.", p, i);
            Dump.Out(q + "x", d.BlockPeopleRecords[i].XPos);
            Dump.Out(q + "y", d.BlockPeopleRecords[i].YPos);
            Dump.Out(q + "z", d.BlockPeopleRecords[i].ZPos);
            Dump.Out(q + "arch", d.BlockPeopleRecords[i].TextureArchive);
            Dump.Out(q + "rec", d.BlockPeopleRecords[i].TextureRecord);
            Dump.Out(q + "faction", d.BlockPeopleRecords[i].FactionID);
            Dump.Out(q + "flags", d.BlockPeopleRecords[i].Flags);
        }
        Dump.Out(p + "door.count", d.BlockDoorRecords == null ? -1 : d.BlockDoorRecords.Length);
        for (int i = 0; d.BlockDoorRecords != null && i < d.BlockDoorRecords.Length; i++)
        {
            string q = string.Format("{0}door.{1:D3}.", p, i);
            Dump.Out(q + "x", d.BlockDoorRecords[i].XPos);
            Dump.Out(q + "y", d.BlockDoorRecords[i].YPos);
            Dump.Out(q + "z", d.BlockDoorRecords[i].ZPos);
            Dump.Out(q + "yr", d.BlockDoorRecords[i].YRotation);
            Dump.Out(q + "openr", d.BlockDoorRecords[i].OpenRotation);
            Dump.Out(q + "modelIndex", d.BlockDoorRecords[i].DoorModelIndex);
        }
    }

    static void DumpRdb(string p, ref DFBlock b)
    {
        DFBlock.RdbModelReference[] mrl = b.RdbBlock.ModelReferenceList;
        Dump.Out(p + "rdb.models", mrl == null ? -1 : mrl.Length);
        for (int i = 0; mrl != null && i < mrl.Length; i++)
        {
            string q = string.Format("{0}rdb.mdl.{1:D3}.", p, i);
            Dump.Out(q + "id", Dump.S(mrl[i].ModelId));
            Dump.Out(q + "idNum", mrl[i].ModelIdNum);
            Dump.Out(q + "desc", Dump.S(mrl[i].Description));
        }
        DFBlock.RdbObjectRoot[] roots = b.RdbBlock.ObjectRootList;
        Dump.Out(p + "rdb.roots", roots == null ? -1 : roots.Length);
        for (int r = 0; roots != null && r < roots.Length; r++)
        {
            DFBlock.RdbObject[] objs = roots[r].RdbObjects;
            Dump.Out(string.Format("{0}rdb.root.{1:D2}.count", p, r), objs == null ? -1 : objs.Length);
            for (int i = 0; objs != null && i < objs.Length; i++)
            {
                string q = string.Format("{0}rdb.root.{1:D2}.{2:D3}.", p, r, i);
                Dump.Out(q + "index", objs[i].Index);
                Dump.Out(q + "x", objs[i].XPos); Dump.Out(q + "y", objs[i].YPos); Dump.Out(q + "z", objs[i].ZPos);
                Dump.Out(q + "type", (int)objs[i].Type);
                if (objs[i].Type == DFBlock.RdbResourceTypes.Model)
                {
                    DFBlock.RdbModelResource m = objs[i].Resources.ModelResource;
                    Dump.Out(q + "m.xr", m.XRotation); Dump.Out(q + "m.yr", m.YRotation); Dump.Out(q + "m.zr", m.ZRotation);
                    Dump.Out(q + "m.modelIndex", m.ModelIndex);
                    Dump.Out(q + "m.trigLock", m.TriggerFlag_StartingLock);
                    Dump.Out(q + "m.sound", m.SoundIndex);
                    DumpAction(q + "m.act.", m.ActionResource);
                }
                else if (objs[i].Type == DFBlock.RdbResourceTypes.Light)
                {
                    DFBlock.RdbLightResource l = objs[i].Resources.LightResource;
                    Dump.Out(q + "l.u1", l.Unknown1); Dump.Out(q + "l.u2", l.Unknown2); Dump.Out(q + "l.radius", l.Radius);
                }
                else if (objs[i].Type == DFBlock.RdbResourceTypes.Flat)
                {
                    DFBlock.RdbFlatResource fl = objs[i].Resources.FlatResource;
                    Dump.Out(q + "f.arch", fl.TextureArchive); Dump.Out(q + "f.rec", fl.TextureRecord);
                    Dump.Out(q + "f.flags", fl.Flags); Dump.Out(q + "f.magnitude", fl.Magnitude);
                    Dump.Out(q + "f.sound", fl.SoundIndex); Dump.Out(q + "f.factionOrMobile", fl.FactionOrMobileId);
                    Dump.Out(q + "f.nextOffset", fl.NextObjectOffset); Dump.Out(q + "f.action", fl.Action);
                    // IsCustomData is never written by the reader (mod world-data only) - omitted.
                }
            }
        }
    }
    static void DumpAction(string q, DFBlock.RdbActionResource a)
    {
        Dump.Out(q + "axis", a.Axis);
        Dump.Out(q + "duration", a.Duration);
        Dump.Out(q + "magnitude", a.Magnitude);
        Dump.Out(q + "nextOffset", a.NextObjectOffset);
        Dump.Out(q + "prevOffset", a.PreviousObjectOffset);
        Dump.Out(q + "nextIndex", a.NextObjectIndex);
        Dump.Out(q + "flags", a.Flags);
    }

    // ---------------- 7. MAPS ----------------
    public static void DumpMaps()
    {
        MapsFile mf = new MapsFile();
        if (!mf.Load(Path.Combine(Dump.Arena2, "MAPS.BSA"), FileUsage.UseMemory, true))
        { Dump.Out("maps.load", "FAIL"); return; }
        mf.AutoDiscard = true;
        Dump.Out("maps.regionCount", mf.RegionCount);
        for (int r = 0; r < mf.RegionCount; r++)
        {
            string pr = string.Format("maps.r{0:D2}.", r);
            Dump.Out(pr + "name", Dump.S(mf.GetRegionName(r)));
            DFRegion region = mf.GetRegion(r);
            Dump.Out(pr + "locationCount", region.LocationCount);
            Dump.Out(pr + "regionName", Dump.S(region.Name));
            Dump.Out(pr + "mapNames", region.MapNames == null ? -1 : region.MapNames.Length);
            Dump.Out(pr + "mapTable", region.MapTable == null ? -1 : region.MapTable.Length);
            for (int i = 0; region.MapNames != null && i < region.MapNames.Length; i++)
                Dump.Out(string.Format("{0}mn.{1:D4}", pr, i), Dump.S(region.MapNames[i]));
            for (int i = 0; region.MapTable != null && i < region.MapTable.Length; i++)
            {
                DFRegion.RegionMapTable t = region.MapTable[i];
                string q = string.Format("{0}mt.{1:D4}.", pr, i);
                Dump.Out(q + "mapId", t.MapId);
                Dump.Out(q + "lat", t.Latitude);
                Dump.Out(q + "lon", t.Longitude);
                Dump.Out(q + "locType", (int)t.LocationType);
                Dump.Out(q + "dunType", (int)t.DungeonType);
                Dump.Out(q + "discovered", t.Discovered);
                Dump.Out(q + "key", t.Key);
            }
            for (int i = 0; i < region.LocationCount; i++)
            {
                DFLocation loc = mf.GetLocation(r, i);
                string q = string.Format("{0}loc.{1:D4}.", pr, i);
                Dump.Out(q + "loaded", loc.Loaded);
                if (!loc.Loaded) continue;
                Dump.Out(q + "name", Dump.S(loc.Name));
                Dump.Out(q + "regionName", Dump.S(loc.RegionName));
                Dump.Out(q + "hasDungeon", loc.HasDungeon);
                Dump.Out(q + "politic", loc.Politic);
                Dump.Out(q + "regionIndex", loc.RegionIndex);
                Dump.Out(q + "locationIndex", loc.LocationIndex);
                Dump.Out(q + "climate.worldClimate", loc.Climate.WorldClimate);
                Dump.Out(q + "climate.type", (int)loc.Climate.ClimateType);
                Dump.Out(q + "climate.natureSet", (int)loc.Climate.NatureSet);
                Dump.Out(q + "climate.groundArchive", loc.Climate.GroundArchive);
                Dump.Out(q + "climate.natureArchive", loc.Climate.NatureArchive);
                Dump.Out(q + "climate.skyBase", loc.Climate.SkyBase);
                Dump.Out(q + "climate.people", (int)loc.Climate.People);
                Dump.Out(q + "climate.names", (int)loc.Climate.Names);
                Dump.Out(q + "mt.mapId", loc.MapTableData.MapId);
                Dump.Out(q + "mt.lat", loc.MapTableData.Latitude);
                Dump.Out(q + "mt.lon", loc.MapTableData.Longitude);
                Dump.Out(q + "mt.locType", (int)loc.MapTableData.LocationType);
                Dump.Out(q + "mt.dunType", (int)loc.MapTableData.DungeonType);
                Dump.Out(q + "mt.key", loc.MapTableData.Key);
                // Exterior
                DFLocation.LocationRecordElementHeader eh = loc.Exterior.RecordElement.Header;
                Dump.Out(q + "ext.x", eh.X); Dump.Out(q + "ext.y", eh.Y);
                Dump.Out(q + "ext.isExterior", eh.IsExterior);
                Dump.Out(q + "ext.locationId", eh.LocationId);
                Dump.Out(q + "ext.isInterior", eh.IsInterior);
                Dump.Out(q + "ext.exteriorLocationId", eh.ExteriorLocationId);
                Dump.Out(q + "ext.locationName", Dump.S(eh.LocationName));
                Dump.Out(q + "ext.buildingCount", loc.Exterior.BuildingCount);
                for (int bI = 0; loc.Exterior.Buildings != null && bI < loc.Exterior.Buildings.Length; bI++)
                {
                    DFLocation.BuildingData bd = loc.Exterior.Buildings[bI];
                    string qb = string.Format("{0}ext.bld.{1:D3}.", q, bI);
                    Dump.Out(qb + "nameSeed", bd.NameSeed);
                    Dump.Out(qb + "factionId", bd.FactionId);
                    Dump.Out(qb + "sector", bd.Sector);
                    Dump.Out(qb + "locationId", bd.LocationId);
                    Dump.Out(qb + "buildingType", (int)bd.BuildingType);
                    Dump.Out(qb + "quality", bd.Quality);
                }
                DFLocation.ExteriorData ed = loc.Exterior.ExteriorData;
                Dump.Out(q + "ed.anotherName", Dump.S(ed.AnotherName));
                Dump.Out(q + "ed.mapId", ed.MapId);
                Dump.Out(q + "ed.locationId", ed.LocationId);
                Dump.Out(q + "ed.width", ed.Width);
                Dump.Out(q + "ed.height", ed.Height);
                Dump.Out(q + "ed.portTown", ed.PortTownAndUnknown);
                Dump.Out(q + "ed.blockNames", ed.BlockNames == null ? -1 : ed.BlockNames.Length);
                for (int bI = 0; ed.BlockNames != null && bI < ed.BlockNames.Length; bI++)
                    Dump.Out(string.Format("{0}ed.bn.{1:D3}", q, bI), Dump.S(ed.BlockNames[bI]));
                // Resolved RMB block names over the exterior grid
                for (int yy = 0; yy < ed.Height; yy++)
                    for (int xx = 0; xx < ed.Width; xx++)
                        Dump.Out(string.Format("{0}rmbName.{1:D2}.{2:D2}", q, xx, yy), Dump.S(mf.GetRmbBlockName(loc, xx, yy)));
                // Dungeon
                if (loc.HasDungeon)
                {
                    DFLocation.LocationRecordElementHeader dh = loc.Dungeon.RecordElement.Header;
                    Dump.Out(q + "dun.x", dh.X); Dump.Out(q + "dun.y", dh.Y);
                    Dump.Out(q + "dun.locationId", dh.LocationId);
                    Dump.Out(q + "dun.exteriorLocationId", dh.ExteriorLocationId);
                    Dump.Out(q + "dun.locationName", Dump.S(dh.LocationName));
                    Dump.Out(q + "dun.blockCount", loc.Dungeon.Header.BlockCount);
                    for (int bI = 0; loc.Dungeon.Blocks != null && bI < loc.Dungeon.Blocks.Length; bI++)
                    {
                        DFLocation.DungeonBlock db = loc.Dungeon.Blocks[bI];
                        string qd = string.Format("{0}dun.blk.{1:D3}.", q, bI);
                        Dump.Out(qd + "x", db.X); Dump.Out(qd + "z", db.Z);
                        Dump.Out(qd + "start", db.IsStartingBlock);
                        Dump.Out(qd + "name", Dump.S(db.BlockName));
                        Dump.Out(qd + "water", db.WaterLevel);
                        Dump.Out(qd + "castle", db.CastleBlock);
                    }
                }
            }
            mf.DiscardRegion(r);
        }
        // Climate / politic index sweep + coordinate conversions
        byte[] climate = new byte[1000 * 500];
        byte[] politic = new byte[1000 * 500];
        int k = 0;
        for (int y = 0; y < 500; y++)
            for (int x = 0; x < 1000; x++)
            { climate[k] = (byte)mf.GetClimateIndex(x, y); politic[k] = (byte)mf.GetPoliticIndex(x, y); k++; }
        Dump.Out("maps.climateIndex.sha", Dump.Sha1(climate));
        Dump.Out("maps.politicIndex.sha", Dump.Sha1(politic));
        for (int wc = 0; wc <= 512; wc++)
        {
            DFLocation.ClimateSettings cs = MapsFile.GetWorldClimateSettings(wc);
            string q = string.Format("maps.wcs.{0:D3}.", wc);
            Dump.Out(q + "worldClimate", cs.WorldClimate);
            Dump.Out(q + "type", (int)cs.ClimateType);
            Dump.Out(q + "natureSet", (int)cs.NatureSet);
            Dump.Out(q + "groundArchive", cs.GroundArchive);
            Dump.Out(q + "natureArchive", cs.NatureArchive);
            Dump.Out(q + "skyBase", cs.SkyBase);
            Dump.Out(q + "people", (int)cs.People);
            Dump.Out(q + "names", (int)cs.Names);
        }
        for (int y = 0; y < 500; y += 17)
            for (int x = 0; x < 1000; x += 19)
            {
                DFPosition ll = MapsFile.MapPixelToLongitudeLatitude(x, y);
                DFPosition back = MapsFile.LongitudeLatitudeToMapPixel(ll.X, ll.Y);
                DFPosition wc = MapsFile.MapPixelToWorldCoord(x, y);
                DFPosition mp = MapsFile.WorldCoordToMapPixel(wc.X, wc.Y);
                string q = string.Format("maps.conv.{0:D4}.{1:D4}.", x, y);
                Dump.Out(q + "lon", ll.X); Dump.Out(q + "lat", ll.Y);
                Dump.Out(q + "backX", back.X); Dump.Out(q + "backY", back.Y);
                Dump.Out(q + "wx", wc.X); Dump.Out(q + "wz", wc.Y);
                Dump.Out(q + "mx", mp.X); Dump.Out(q + "my", mp.Y);
                Dump.Out(q + "pixelId", MapsFile.GetMapPixelID(x, y));
            }
    }

    // ---------------- MISC: SND / PAK / FNT / GFX / SKY / CLASS / FACTION / TEXT.RSC ----------------
    public static void DumpMisc()
    {
        // ---- SND ----
        foreach (string name in Dump.Files("*.SND"))
        {
            SndFile sf = new SndFile();
            bool ok = sf.Load(Path.Combine(Dump.Arena2, name), FileUsage.UseMemory, true);
            string p0 = "snd." + name + ".";
            Dump.Out(p0 + "load", ok);
            if (!ok) continue;
            Dump.Out(p0 + "count", sf.Count);
            for (int i = 0; i < sf.Count; i++)
            {
                DFSound s;
                bool got = sf.GetSound(i, out s);
                string p = string.Format("{0}{1:D4}.", p0, i);
                Dump.Out(p + "ok", got);
                if (!got) continue;
                Dump.Out(p + "name", Dump.S(s.Name));
                Dump.Out(p + "len", s.WaveData == null ? -1 : s.WaveData.Length);
                Dump.Out(p + "sha", Dump.Sha1(s.WaveData));
                Dump.Out(p + "hdr", Dump.Sha1(s.WaveHeader));
                sf.DiscardSound(i);
            }
        }
        // ---- PAK ----
        foreach (string name in Dump.Files("*.PAK"))
        {
            PakFile pf = new PakFile();
            bool ok = pf.Load(Path.Combine(Dump.Arena2, name));
            string p0 = "pak." + name + ".";
            Dump.Out(p0 + "load", ok);
            if (!ok) continue;
            byte[] vals = new byte[1001 * 500];
            int k = 0;
            for (int y = 0; y < 500; y++)
                for (int x = 0; x < 1001; x++)
                    vals[k++] = (byte)pf.GetValue(x, y);
            Dump.Out(p0 + "values.sha", Dump.Sha1(vals));
            DFBitmap bm = pf.GetDFBitmap();
            Dump.Out(p0 + "bmp.w", bm.Width);
            Dump.Out(p0 + "bmp.h", bm.Height);
            Dump.Out(p0 + "bmp.sha", Dump.Sha1(bm.Data));
            for (int y = 0; y < 500; y += 41)
                for (int x = 0; x < 1001; x += 43)
                    Dump.Out(string.Format("{0}v.{1:D4}.{2:D4}", p0, x, y), pf.GetValue(x, y));
        }
        // ---- FNT ----
        foreach (string name in Dump.Files("FONT*.FNT"))
        {
            FntFile ff = new FntFile();
            bool ok = ff.Load(Path.Combine(Dump.Arena2, name), FileUsage.UseMemory, true);
            string p0 = "fnt." + name + ".";
            Dump.Out(p0 + "load", ok);
            if (!ok) continue;
            for (int i = 0; i < FntFile.MaxGlyphCount; i++)
            {
                string p = string.Format("{0}{1:D3}.", p0, i);
                Dump.Out(p + "width", ff.GetGlyphWidth(i));
                Dump.Out(p + "bytes", Dump.Sha1(ff.GetGlyphBytes(i)));
                Dump.Out(p + "pixels", Dump.Sha1(ff.GetGlyphPixels(i)));
            }
        }
        // ---- GFX ----
        DFPalette pal = new DFPalette(Path.Combine(Dump.Arena2, "ART_PAL.COL"));
        foreach (string name in Dump.Files("*.GFX"))
        {
            GfxFile gf = new GfxFile();
            gf.Palette = pal;
            bool ok = gf.Load(Path.Combine(Dump.Arena2, name), FileUsage.UseMemory, true);
            string p0 = "gfx." + name + ".";
            Dump.Out(p0 + "load", ok);
            if (!ok) continue;
            Dump.Out(p0 + "recordCount", gf.RecordCount);
            for (int r = 0; r < gf.RecordCount; r++)
            {
                string p = string.Format("{0}{1:D3}.", p0, r);
                DFSize sz = gf.GetSize(r);
                Dump.Out(p + "w", sz.Width); Dump.Out(p + "h", sz.Height);
                int gfc = gf.GetFrameCount(r);
                Dump.Out(p + "frames", gfc);
                for (int f = 0; f < gfc; f++)
                {
                    DFBitmap bm = gf.GetDFBitmap(r, f);
                    Dump.Out(string.Format("{0}f{1:D2}.bw", p, f), bm.Width);
                    Dump.Out(string.Format("{0}f{1:D2}.bh", p, f), bm.Height);
                    Dump.Out(string.Format("{0}f{1:D2}.idx", p, f), Dump.Sha1(bm.Data));
                }
            }
        }
        // ---- SKY ----
        for (int i = 0; i < 32; i++)
        {
            string name = SkyFile.IndexToFileName(i);
            if (!File.Exists(Path.Combine(Dump.Arena2, name))) continue;
            SkyFile sk = new SkyFile();
            bool ok = sk.Load(Path.Combine(Dump.Arena2, name), FileUsage.UseMemory, true);
            string p0 = "sky." + name + ".";
            Dump.Out(p0 + "load", ok);
            if (!ok) continue;
            Dump.Out(p0 + "recordCount", sk.RecordCount);
            Dump.Out(p0 + "frameCount", sk.GetFrameCount(0));
            DFSize sz = sk.GetSize(0);
            Dump.Out(p0 + "w", sz.Width); Dump.Out(p0 + "h", sz.Height);
            for (int f = 0; f < sk.GetFrameCount(0); f++)
            {
                string p = string.Format("{0}f{1:D2}.", p0, f);
                DFPalette dp = sk.GetDFPalette(f);
                Dump.Out(p + "pal", Dump.Sha1(dp.PaletteBuffer));
                DFBitmap bm = sk.GetDFBitmap(0, f);
                Dump.Out(p + "bw", bm.Width); Dump.Out(p + "bh", bm.Height);
                Dump.Out(p + "idx", Dump.Sha1(bm.Data));
            }
        }
        // ---- PALETTES ----
        foreach (string name in Dump.Files("*.COL"))
        {
            DFPalette dp = new DFPalette();
            bool ok = dp.Load(Path.Combine(Dump.Arena2, name));
            string p0 = "pal." + name + ".";
            Dump.Out(p0 + "load", ok);
            if (!ok) continue;
            Dump.Out(p0 + "headerLength", dp.HeaderLength);
            Dump.Out(p0 + "sha", Dump.Sha1(dp.PaletteBuffer));
            for (int i = 0; i < 256; i++)
                Dump.Out(string.Format("{0}{1:D3}", p0, i),
                    dp.GetRed(i) + "," + dp.GetGreen(i) + "," + dp.GetBlue(i));
        }
        foreach (string name in Dump.Files("*.PAL"))
        {
            DFPalette dp = new DFPalette();
            bool ok = dp.Load(Path.Combine(Dump.Arena2, name));
            string p0 = "pal." + name + ".";
            Dump.Out(p0 + "load", ok);
            if (!ok) continue;
            Dump.Out(p0 + "headerLength", dp.HeaderLength);
            Dump.Out(p0 + "sha", Dump.Sha1(dp.PaletteBuffer));
        }
        // ---- CLASSES.DAT ----
        {
            // ClassFile reads a single class record from a stream.
            string path = Path.Combine(Dump.Arena2, "CLASSES.DAT");
            if (File.Exists(path))
            {
                byte[] data = File.ReadAllBytes(path);
                Dump.Out("class.CLASSES.DAT.length", data.Length);
            }
        }
        // ---- FACTION.TXT ----
        {
            FactionFile ff = new FactionFile(Path.Combine(Dump.Arena2, "FACTION.TXT"), FileUsage.UseMemory, true);
            List<int> ids = new List<int>(ff.FactionDict.Keys);
            ids.Sort();
            Dump.Out("faction.count", ids.Count);
            foreach (int id in ids)
            {
                FactionFile.FactionData fd = ff.FactionDict[id];
                string p = string.Format("faction.{0:D6}.", id);
                Dump.Out(p + "id", fd.id);
                Dump.Out(p + "parent", fd.parent);
                Dump.Out(p + "type", fd.type);
                Dump.Out(p + "name", Dump.S(fd.name));
                Dump.Out(p + "rep", fd.rep);
                Dump.Out(p + "summon", fd.summon);
                Dump.Out(p + "region", fd.region);
                Dump.Out(p + "power", fd.power);
                Dump.Out(p + "face", fd.face);
                Dump.Out(p + "race", fd.race);
                Dump.Out(p + "flat1", fd.flat1);
                Dump.Out(p + "flat2", fd.flat2);
                Dump.Out(p + "sgroup", fd.sgroup);
                Dump.Out(p + "ggroup", fd.ggroup);
                Dump.Out(p + "vam", fd.vam);
                Dump.Out(p + "children", fd.children == null ? "-1" : string.Join(",", fd.children.ConvertAll<string>(delegate(int v) { return v.ToString(CultureInfo.InvariantCulture); }).ToArray()));
                Dump.Out(p + "ally", fd.ally1 + "," + fd.ally2 + "," + fd.ally3);
                Dump.Out(p + "enemy", fd.enemy1 + "," + fd.enemy2 + "," + fd.enemy3);
                Dump.Out(p + "flags", fd.flags);
                Dump.Out(p + "ruler", fd.ruler);
                Dump.Out(p + "minf", fd.minf);
                Dump.Out(p + "maxf", fd.maxf);
                Dump.Out(p + "rank", fd.rank);
                Dump.Out(p + "rulerNameSeed", fd.rulerNameSeed);
                Dump.Out(p + "rulerPowerBonus", fd.rulerPowerBonus);
                // ptrTo* fields are only written by classic-save import - omitted.
            }
            Dump.Out("faction.nameDict.count", ff.FactionNameToIDDict.Count);
        }
        // ---- TEXT.RSC ----
        {
            TextFile tf = new TextFile(Dump.Arena2, "TEXT.RSC");
            Dump.Out("textrsc.recordCount", tf.RecordCount);
            for (int i = 0; i < tf.RecordCount; i++)
            {
                string p = string.Format("textrsc.{0:D4}.", i);
                int id = tf.IndexToId(i);
                Dump.Out(p + "id", id);
                Dump.Out(p + "idToIndex", tf.IdToIndex(id));
                byte[] bytes = tf.GetBytesByIndex(i);
                Dump.Out(p + "len", bytes == null ? -1 : bytes.Length);
                Dump.Out(p + "sha", Dump.Sha1(bytes));
                Dump.Out(p + "byIdLen", tf.GetBytesById(id) == null ? -1 : tf.GetBytesById(id).Length);
                Dump.Out(p + "byIdSha", Dump.Sha1(tf.GetBytesById(id)));
                TextFile.Token[] toks = TextFile.ReadTokens(ref bytes, 0, TextFile.Formatting.EndOfRecord);
                Dump.Out(p + "tokens", toks == null ? -1 : toks.Length);
                StringBuilder textcat = new StringBuilder();
                for (int t = 0; toks != null && t < toks.Length; t++)
                    if (toks[t].formatting == TextFile.Formatting.Text) textcat.Append(toks[t].text);
                Dump.Out(p + "textcat", Dump.S(textcat.ToString()));
                for (int t = 0; toks != null && t < toks.Length; t++)
                {
                    string q = string.Format("{0}t{1:D3}.", p, t);
                    Dump.Out(q + "fmt", (int)toks[t].formatting);
                    Dump.Out(q + "text", Dump.S(toks[t].text));
                    Dump.Out(q + "x", toks[t].x);
                    Dump.Out(q + "y", toks[t].y);
                }
            }
        }
    }
}
