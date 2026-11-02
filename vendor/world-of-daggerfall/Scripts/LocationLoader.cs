using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using System.IO;
using DaggerfallWorkshop.Game.Utility.ModSupport;
using DaggerfallWorkshop.Game;

namespace DaggerfallWorkshop.Loc
{
    public class LocationLoader : MonoBehaviour
    {
        List<LocationInstance> locationInstance = new List<LocationInstance>();

        const float TERRAIN_SIZE = 128;
        static float unscaledTerrainHeightMax = DaggerfallUnity.Instance.TerrainSampler.MaxTerrainHeight;
        static float terrainScale = Game.GameManager.Instance.StreamingWorld.TerrainScale;
        float terrainHeightMax = unscaledTerrainHeightMax * terrainScale;
        //const float TERRAIN_HEIGHT_MAX = 1923.75f;
        const float TERRAINPIXELSIZE = 819.2f;
        const float OCEAN_SURFACE = 0.018f;
        const float TERRAIN_SIZE_MULTI = TERRAINPIXELSIZE / TERRAIN_SIZE;

        static byte pathsDataPoint;

        const string locations = "/Locations/";
        private int regionIndex;

        void Awake()
        {

            ////Original
            //if (!Directory.Exists(Application.dataPath + LocationHelper.locationInstanceFolder))
            //{
            //    Debug.Log("LOCATION LOADER: Location folder not found");
            //    return;
            //}

            //foreach (string file in Directory.GetFiles(Application.dataPath + LocationHelper.locationInstanceFolder))
            //{
            //    if (file.EndsWith(".txt"))
            //    {
            //        locationInstance.AddRange(LocationHelper.LoadLocationInstance(file));
            //    }

            //}

            //load daggerfall
            if (!Directory.Exists(Application.dataPath + LocationHelper.locationInstanceFolder))
            {
                Debug.Log("LOCATION LOADER: Location folder not found");
                return;
            }
                foreach (string file in Directory.GetFiles(Application.dataPath + LocationHelper.locationInstanceFolder + "/" + "17" + "/"))
                {
                    if (file.EndsWith(".txt"))
                    {
                        locationInstance.AddRange(LocationHelper.LoadLocationInstance(file));
                    }
                }

            DaggerfallTerrain.OnPromoteTerrainData += AddLocation;
            PlayerGPS.OnRegionIndexChanged += OnRegionChanged;
            regionIndex = GameManager.Instance.PlayerGPS.CurrentRegionIndex;
        }


        void OnRegionChanged(int regionIndex)
        {

            if (!Directory.Exists(Application.dataPath + LocationHelper.locationInstanceFolder))
            {
                Debug.Log("LOCATION LOADER: Location folder not found");
                return;
            }

            if (regionIndex == 31)
            {
                Debug.Log("LOCATION LOADER: Ocean Region Detected! Unsupported!");
                return;
            }
            else
            foreach (string file in Directory.GetFiles(Application.dataPath + LocationHelper.locationInstanceFolder + "/" + regionIndex + "/"))
            { 
                if (file.EndsWith(".txt"))
                {
                    locationInstance.AddRange(LocationHelper.LoadLocationInstance(file));
                }
            }
        }
        
        void AddLocation(DaggerfallTerrain daggerTerrain, TerrainData terrainData)
        {
            //Destroy old locations by going through all the child objects, but 
            //don't delete the billboard batch (The surrounding vegettion)
            foreach (Transform child in daggerTerrain.gameObject.transform)
            {
                if (!child.GetComponent<DaggerfallBillboardBatch>())
                    Destroy(child.gameObject);
            }

            foreach (LocationInstance loc in locationInstance)
            {
                if (daggerTerrain.MapData.hasLocation)
                {
                    if (loc.type == 0)
                    {
                        Debug.LogWarning("Location Already Present " + daggerTerrain.MapPixelX + " : " + daggerTerrain.MapPixelY);
                        return;
                    }
                    else
                    if (loc.type == 2)
                    {
                        continue;
                    }
                }

                if ( (daggerTerrain.MapData.mapRegionIndex == 31 ||
                    daggerTerrain.MapData.mapRegionIndex == 3 ||
                    daggerTerrain.MapData.mapRegionIndex ==  29 ||
                    daggerTerrain.MapData.mapRegionIndex == 28 ||
                    daggerTerrain.MapData.mapRegionIndex == 30) && daggerTerrain.MapData.worldHeight <= 2)
                {
                    if (loc.type == 0)
                    {
                        Debug.LogWarning("Location is in Ocean " + daggerTerrain.MapPixelX + " : " + daggerTerrain.MapPixelY);
                        return;
                    }
                    else
                    if (loc.type == 2)
                    {
                        continue;
                    }

                }

                if (daggerTerrain.MapPixelX != loc.worldX || daggerTerrain.MapPixelY != loc.worldY)
                   continue;

                if (loc.terrainX <= 0 || loc.terrainY <= 0 || (loc.terrainX > 128 || loc.terrainY > 128))
                {
                    Debug.LogWarning("Invalid Location at " + daggerTerrain.MapPixelX + " : " + daggerTerrain.MapPixelY + " : The location pixelX + or/and pixelY must be higher than 0 and lower than 128");
                    continue;
                }

                // Was trying to do it here but as I said, I'm not experienced with this stuff
                Vector2Int coords = new Vector2Int(loc.worldX, loc.worldY);
                ModManager.Instance.SendModMessage("BasicRoads", "getPathsPoint", coords, 
                    (string message, object data) => { pathsDataPoint = (byte) data; });

                if (pathsDataPoint != 0)
                    continue;

                //Now that we ensured that it is a valid location, then load the locationpreset
                LocationPrefab locationPrefab = LocationHelper.LoadLocationPrefab(Application.dataPath + LocationHelper.locationPrefabFolder + loc.prefab + ".txt");

                if (locationPrefab == null)
                {
                    Debug.LogWarning("Can't find location Preset: " + loc.prefab);
                    continue;
                }

                if ((loc.terrainX + locationPrefab.height > 128 || loc.terrainY + locationPrefab.width > 128))
                {
                    Debug.LogWarning("Invalid Location at " + daggerTerrain.MapPixelX + " : " + daggerTerrain.MapPixelY + " : The locationpreset exist outside the terrain");
                    continue;
                }

                if ((loc.terrainX + locationPrefab.height > 127 || loc.terrainY + locationPrefab.width > 127))
                {
                    Debug.LogWarning("Invalid Location at " + daggerTerrain.MapPixelX + " : " + daggerTerrain.MapPixelY + " : The locationpreset must be 1 pixel away (both X and Y) from the terrainBorder");
                    continue;
                }

                //Smooth the terrain
                    if (loc.type == 0)
                {
                    daggerTerrain.MapData.hasLocation = true;
                    daggerTerrain.MapData.locationName = loc.name;//
                    daggerTerrain.MapData.locationRect = new Rect(loc.terrainX, loc.terrainY, locationPrefab.width, locationPrefab.height);

                    int count = 0;
                    float tmpAverageHeight = 0;

                    for (int x = loc.terrainX; x <= loc.terrainX + locationPrefab.width; x++)
                    {
                        for (int y = loc.terrainY; y <= loc.terrainY + locationPrefab.height; y++)
                        {
                            tmpAverageHeight += daggerTerrain.MapData.heightmapSamples[y, x];
                            count++;
                        }
                    }

                    daggerTerrain.MapData.averageHeight = tmpAverageHeight /= count;
                    //TerrainHelper.BlendLocationTerrain(ref daggerTerrain.MapData); //orginal alternative
                    
                    for (int x = 1; x <= 127; x++)
                        for (int y = 1; y <= 127; y++)
                            daggerTerrain.MapData.heightmapSamples[y, x] = Mathf.Lerp(daggerTerrain.MapData.heightmapSamples[y, x], daggerTerrain.MapData.averageHeight, 1 / (GetDistanceFromRect(daggerTerrain.MapData.locationRect, new Vector2(x, y)) + 1));
                    
                    terrainData.SetHeights(0, 0, daggerTerrain.MapData.heightmapSamples);
                }

                //Smooth the terrain Override
                if (loc.type == 2)
                {
                    daggerTerrain.MapData.hasLocation = true;
                    daggerTerrain.MapData.locationName = loc.name;//
                    daggerTerrain.MapData.locationRect = new Rect(loc.terrainX, loc.terrainY, locationPrefab.width, locationPrefab.height);

                    int count = 0;
                    float tmpAverageHeight = 0;

                    for (int x = loc.terrainX; x <= loc.terrainX + locationPrefab.width; x++)
                    {
                        for (int y = loc.terrainY; y <= loc.terrainY + locationPrefab.height; y++)
                        {
                            tmpAverageHeight += daggerTerrain.MapData.heightmapSamples[y, x];
                            count++;
                        }
                    }

                    daggerTerrain.MapData.averageHeight = tmpAverageHeight /= count;
                    //TerrainHelper.BlendLocationTerrain(ref daggerTerrain.MapData); //orginal alternative

                    for (int x = 1; x <= 127; x++)
                        for (int y = 1; y <= 127; y++)
                            daggerTerrain.MapData.heightmapSamples[y, x] = Mathf.Lerp(daggerTerrain.MapData.heightmapSamples[y, x], daggerTerrain.MapData.averageHeight, 1 / (GetDistanceFromRect(daggerTerrain.MapData.locationRect, new Vector2(x, y)) + 1));

                    terrainData.SetHeights(0, 0, daggerTerrain.MapData.heightmapSamples);
                }

                foreach (LocationPrefab.LocationObject obj in locationPrefab.obj)
                {
                    if (!LocationHelper.ValidateValue(obj.type, obj.name))
                        continue;

                    GameObject go = LocationHelper.LoadObject(obj.type, obj.name, daggerTerrain.gameObject.transform,
                    new Vector3((loc.terrainX * TERRAIN_SIZE_MULTI) + obj.pos.x, (daggerTerrain.MapData.averageHeight * terrainHeightMax) + obj.pos.y, (loc.terrainY * TERRAIN_SIZE_MULTI) + obj.pos.z),
                                 obj.rot,
                                 new Vector3(obj.scale.x, obj.scale.y, obj.scale.z), loc.locationID, obj.objectID
                        );

                    if (go.GetComponent<DaggerfallBillboard>())
                    {
                        float tempY = go.transform.position.y;
                        go.GetComponent<DaggerfallBillboard>().AlignToBase();
                        go.transform.position = new Vector3(go.transform.position.x, tempY + ((go.transform.position.y - tempY) * go.transform.localScale.y), go.transform.position.z);
                    }

                    if (!go.GetComponent<DaggerfallLoot>())
                        go.isStatic = true;
                }

                continue;
            }
        }

        private float GetDistanceFromRect(Rect rect, Vector2 point)
        {
            float squared_dist = 0.0f;

            if (point.x > rect.xMax)
                squared_dist += (point.x - rect.xMax) * (point.x - rect.xMax);
            else if (point.x < rect.xMin)
                squared_dist += (rect.xMin - point.x) * (rect.xMin - point.x);

            if (point.y > rect.yMax)
                squared_dist += (point.y - rect.yMax) * (point.y - rect.yMax);
            else if (point.y < rect.yMin)
                squared_dist += (rect.yMin - point.y) * (rect.yMin - point.y);

            return Mathf.Sqrt(squared_dist);
        }

    }
}