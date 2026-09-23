using System.Collections.Generic;
using UnityEngine;

namespace DaggerfallWorkshop.Loc
{
    /// <summary>
    /// Holds data locationPrefab
    /// </summary>
    public class LocationPrefab
    {
        public int height = 8;
        public int width = 8;
        public List<LocationObject> obj = new List<LocationObject>();

        public void AddObject(int objType, string id, Vector3 pos, Quaternion rot, Vector3 scale)
        {
            obj.Add(new LocationObject(objType, id, pos, rot, scale));
        }
        //Location objects
        public class LocationObject
        {
            public int type = 0; //0 == Mesh, 1 == Billbord
            public string name = ""; 
            public int objectID = 0;
            public Vector3 pos = Vector3.zero;
            public Quaternion rot = Quaternion.Euler(0, 0, 0);
            public Vector3 scale = new Vector3(1,1,1);

            public LocationObject()
            {

            }

            public LocationObject(int type, string name, Vector3 pos, Quaternion rot, Vector3 scale)
            {
                this.type = type;
                this.name = name;
                this.pos = pos;
                this.rot = rot;
                this.scale = scale;
            }
        }
    }
    /// <summary>
    /// Holds data for locationInstances
    /// </summary>
    /// 


    public class LocationInstance
    {
        public int locationID;
        public string name = "DF_Rocks";
        public int type;
        public string prefab = "";
        public int worldX = 0;
        public int worldY = 0;
        public static int worldX_count = 100; //Change value to First Digit X
        public static int worldY_count = 245; //Change value to First Digit X
        public int terrainX = 0;
        public int terrainY = 0;

        public LocationInstance()
        {

        }

        public LocationInstance(string name, int type, string prefab, int worldX, int worldY, int terrainX, int terrainY)
        {
            this.type = type;
            this.name = name;
            this.prefab = prefab;
            this.worldX = worldX;
            this.worldY = worldY;
            this.terrainX = terrainX;
            this.terrainY = terrainY;
        }

        public void UpdateLocationID()
        {
            string[] BanditCamp ={"WA_BanditCamp_01",
                "WA_BanditCamp_02",
                "WA_BanditCamp_03",
                "WA_BanditCamp_04",
                "WA_BanditCamp_05",
                "WA_BanditCamp_06",
                "WA_Daggerfall_BanditCamp_01",
                "WA_Daggerfall_BanditCamp_02",
                "WA_Daggerfall_BanditCamp_03",
                "WA_Daggerfall_BanditCamp_03"}; 
            string randomCampString = BanditCamp[UnityEngine.Random.Range(0, BanditCamp.Length)];

            string[] BanditFort ={"WA_BanditFort_01",
                "WA_BanditFort_02",
                "WA_BanditFort_03"};
            string randomFortString = BanditFort[UnityEngine.Random.Range(0, BanditFort.Length)];

            string[] Rocks ={"DF_Rocks_Small_01",
                "DF_Rocks_Small_02",
                "DF_Rocks_Small_03",
                "DF_Rocks_Small_04",
                "DF_Rocks_Small_05",
                "DF_Rocks_Small_05"};
            string randomRockString = Rocks[UnityEngine.Random.Range(0, Rocks.Length)];

            string[] Ruins ={"WA_Ruins_01",
                "WA_Ruins_02",
                "WA_Ruins_03",
                "WA_Ruins_04",
                "WA_Daggerfall_Ruins_00",
                "WA_Daggerfall_Ruins_01",
                "WA_Daggerfall_Ruins_01"};
            string randomRuinString = Ruins[UnityEngine.Random.Range(0, Ruins.Length)];


            locationID = Random.Range(0, 99999999);
            type = 0;
            name = "Rocks";
            prefab = randomRockString;// + Random.Range(1, 3); // "WA_BanditCamp_06";//

            //WA_Shrine_01

            ///Use these for rnaomd placement in area
            worldX = Random.Range(145, 270); //145, 270
            worldY = Random.Range(131, 160); //131 ,160

            ///Use these for placement pixel by pixel
            //worldX += worldX_count + 1;
            //worldY += worldY_count;

            ///Random location in pixel
            terrainX = Random.Range(10, 92);
            terrainY = Random.Range(10, 92);

            ////Cycle Through X and Y Coordinates
            //if (worldX_count++ >= 134) //Change value to Last Digit X
            //{
            //    worldX_count = 100; //Change value to First Digit X
            //    worldY_count += 1;
            //}

        }
    }

}