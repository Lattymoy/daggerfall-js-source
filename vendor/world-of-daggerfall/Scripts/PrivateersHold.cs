using DaggerfallConnect;
using DaggerfallWorkshop;
using DaggerfallWorkshop.Game;
using DaggerfallWorkshop.Game.Entity;
using DaggerfallWorkshop.Game.Items;
using DaggerfallWorkshop.Game.Utility;
using DaggerfallWorkshop.Utility;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PrivateersHold : MonoBehaviour
{
    private static GameObject ExtraDetail;
    private GameObject AreaDetail;
    private GameObject BillboardDetail;
    private static GameObject chunkstart;
    private DaggerfallLocation DungeonSummary;

    // Start is called before the first frame update
    void Start()
    {



        //DungeonSummary = gameObject.GetComponentInParent<DaggerfallLocation>();

        //if (DungeonSummary != null)
        //{
        //    if (DungeonSummary.Summary.HasDungeon)
        //    {
        //        DaggerfallUI.AddHUDText("Has a Dungeon");
        //        if (DungeonSummary.Summary.DungeonType == DFRegion.DungeonTypes.HumanStronghold)
        //        {
        //            DaggerfallUI.AddHUDText("Human Stronghold");
        //        }
        //        else
        //        if (DungeonSummary.Summary.DungeonType == DFRegion.DungeonTypes.NaturalCave)
        //        {
        //            DaggerfallUI.AddHUDText("Natrual Cave Stronghold");
        //        }
        //    }
        //}
        //else
        //{
        //    DaggerfallUI.AddHUDText("Failed");
        //}






        ExtraDetail = new GameObject("Extra_Detail");
        ExtraDetail.transform.parent = gameObject.transform;
        ExtraDetail.transform.localPosition = new Vector3(0f, 0f, 0f);

        //chunkstart = new GameObject("Start");
        //chunkstart.transform.position = new Vector3(ExtraDetail.transform.position.x, ExtraDetail.transform.position.y, ExtraDetail.transform.position.z);
        //chunkstart.transform.parent = ExtraDetail.transform;

        //GameObject ruler = new GameObject("Ruler");
        //ruler.transform.position = chunkstart.transform.position;
        //ruler.transform.SetParent(chunkstart.transform);




        //Ruins
        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(43508, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(95.87001f, 0.8100098f, 5.839978f);
        AreaDetail.transform.Rotate(0, 104.997f, 0);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(43509, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(45.55f, 4.71f, 5.41f);
        AreaDetail.transform.Rotate(0, -210, 0);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(43506, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(66.7f, 1.6f, 21.5f);
        AreaDetail.transform.Rotate(0f, -89.99001f, 0f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(43506, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(98.47f, 1.61f, 14.74f);
        AreaDetail.transform.Rotate(0f, -89.978f, 0f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(43502, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(80.03f, 2.75f, 9.24f);
        AreaDetail.transform.Rotate(0f, -89.96201f, 0f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(43506, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(55.12f, 1.609995f, 5.689998f);
        //AreaDetail.transform.Rotate(23.026f, -70.353f, 49.323f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(43513, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(74.6f, 1.1f, 64.1f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(43512, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(65.7f, 1.1f, 82.1f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(43509, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(91.8f, 4.699997f, 84.99999f);


        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(43509, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(45.8f, 4.7f, 84.2f);
        AreaDetail.transform.Rotate(0f, -95.994f, 0f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(43514, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(49.16428f, 1.339999f, 67.65283f);
        AreaDetail.transform.Rotate(0f, -90.00001f, 0f);




        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(43506, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(42.5f, 1.6f, 49.6f);
        AreaDetail.transform.Rotate(0f, -89.978f, 0f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(43506, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(85.8f, 1.599994f, 51.77939f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(43506, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(66.97934f, 1.599994f, 87f);
        AreaDetail.transform.Rotate(0f, -179.99f, 0f);





        //Pillars

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41731, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(66.1f, 3.099442e-06f, 34.2f);
        AreaDetail.transform.Rotate(0f, -179.99f, 0f);
        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41732, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(75.95f, 0f, 47.85f);
        AreaDetail.transform.Rotate(0f, -179.99f, 0f);


        //Rocks
        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41717, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(54.4f, 0f, 44.3f);
        AreaDetail.transform.Rotate(0f, -179.99f, 0f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41716, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(79.8f, -0.1f, 26.2f);
        AreaDetail.transform.Rotate(0f, -179.99f, 0f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41713, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(95.8f, -0.1f, 65.8f);
        AreaDetail.transform.Rotate(0f, -179.99f, 0f);

        //Daggerfall Flag
        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(42560, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(77.89f, 3.41f, 10.95f);
        AreaDetail.transform.Rotate(0f, -89.99001f, 0f);

        //Tents
        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41606, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(49.26f, 0.7300018f, 23.581f);
        AreaDetail.transform.Rotate(0f, 31.751f, 0);
        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41606, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(81.16119f, 0.7300018f, 70.47822f);
        AreaDetail.transform.Rotate(0, -43.755f, 0);
        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41606, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(82.32f, 0.73f, 35.23f);
        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41606, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(82.56f, 0.73f, 45.26f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41607, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(84.37f, 1.33f, 58.86f);
        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41607, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(50.84f, 1.329993f, 13.68979f);
        AreaDetail.transform.Rotate(0, -30.578f, 0);
        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41610, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(89.94f, 2.45f, 41.31f);
        AreaDetail.transform.Rotate(0, 90.00001f, 0);


        //AreaDetail.transform.localPosition = new Vector3();
        //AreaDetail.transform.Rotate();

        //Boxes
        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41834, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(45.12f, 0.7999939f, 4.83f);
        AreaDetail.transform.Rotate(0, 39.961f, 0);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41834, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(90.05f, 0.8f, 37.8f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41834, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(92.65f, 0.8f, 62.82f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41832, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(89.9f, 2.1f, 37.84f);

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41832, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(92.26f, 0.8f, 37.14f);



        //Wagon

        AreaDetail = GameObjectHelper.CreateDaggerfallMeshGameObject(41214, ExtraDetail.transform);
        AreaDetail.transform.localPosition = new Vector3(90.97985f, 1.010001f, 32.9853f);
        AreaDetail.transform.Rotate(0, -49.868f, 0);





        /// Billboards
        ///         BillboardDetail.transform.localPosition = new Vector3(f, f, f);

        //Horses
        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(201, 0, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(52.6f, 1.309998f, 23.8f);
        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(201, 0, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(87.98f, 1.309998f, 45.02f);
        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(201, 1, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(90.46f, 1.309998f, 45.43f);
        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(201, 1, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(86.12f, 1.309998f, 47.58f);


        //Misc
        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(205, 0, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(80.4f, 0.61f, 33.67f);
        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(205, 0, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(91.12f, 0.6f, 68.49f);
        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(205, 0, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(91.95f, 0.6f, 67.45999f);
        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(205, 0, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(92.07f, 0.5999908f, 68.26999f);
        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(211, 20, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(95.33f, 1.309998f, 15.51f);
        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(211, 20, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(95.38f, 1.309998f, 19.10001f);

        //armor
        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(207, 14, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(82.25f, 0.51f, 43.41f);
        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(207, 15, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(84.24f, 0.25f, 43.77f);

        //Light
        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(210, 1, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(84.04f, 0.76f, 40.92f);
        GameObject lightObject = new GameObject("FireLight");
        lightObject.transform.parent = BillboardDetail.transform;
        lightObject.transform.localPosition = new Vector3(0f, 1f, 0);

        Light light = lightObject.AddComponent<Light>();
        light.range = 20.0f;
        light.intensity = 1f;
        light.color = new Color(0.95f, 0.91f, 0.63f);

        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(210, 17, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(50.57f, 2.044f, 67.112f);
        lightObject = new GameObject("FireLight");
        lightObject.transform.parent = BillboardDetail.transform;
        lightObject.transform.localPosition = new Vector3(0f, 1f, 0);

        light = lightObject.AddComponent<Light>();
        light.range = 20.0f;
        light.intensity = 1f;
        light.color = new Color(0.95f, 0.91f, 0.63f);

        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(210, 17, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(77.889f, 2.88f, 8.46f);
        lightObject = new GameObject("FireLight");
        lightObject.transform.parent = BillboardDetail.transform;
        lightObject.transform.localPosition = new Vector3(0f, 1f, 0);

        light = lightObject.AddComponent<Light>();
        light.range = 20.0f;
        light.intensity = 1f;
        light.color = new Color(0.95f, 0.91f, 0.63f);

        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(210, 1, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(84.04f, 0.76f, 65.5f);
        lightObject = new GameObject("FireLight");
        lightObject.transform.parent = BillboardDetail.transform;
        lightObject.transform.localPosition = new Vector3(0f, 1f, 0);

        light = lightObject.AddComponent<Light>();
        light.range = 20.0f;
        light.intensity = 1f;
        light.color = new Color(0.95f, 0.91f, 0.63f);

        BillboardDetail = GameObjectHelper.CreateDaggerfallBillboardGameObject(210, 1, ExtraDetail.transform);
        BillboardDetail.transform.localPosition = new Vector3(47.3f, 0.76f, 18.84f);
        lightObject = new GameObject("FireLight");
        lightObject.transform.parent = BillboardDetail.transform;
        lightObject.transform.localPosition = new Vector3(0f, 1f, 0);

        light = lightObject.AddComponent<Light>();
        light.range = 20.0f;
        light.intensity = 1f;
        light.color = new Color(0.95f, 0.91f, 0.63f);



        ///Enemies
        ///

        var enemyChance = UnityEngine.Random.Range(0, 30);

        if (enemyChance > 20)
        {
            GameObject[] enemy = GameObjectHelper.CreateFoeGameObjects(ExtraDetail.transform.position, MobileTypes.Thief, 1, MobileReactions.Hostile, null, false);
            enemy[0].transform.parent = ExtraDetail.transform;
            enemy[0].transform.localPosition = new Vector3(83.2f, 1, 38f);
            enemy[0].transform.Rotate(0, UnityEngine.Random.Range(0, 180), 0);
            enemy[0].SetActive(true);
        }

        enemyChance = UnityEngine.Random.Range(0, 30);

        if (enemyChance > 20)
        {
            GameObject[] enemy = GameObjectHelper.CreateFoeGameObjects(ExtraDetail.transform.position, MobileTypes.Assassin, 1, MobileReactions.Hostile, null, false);
            enemy[0].transform.parent = ExtraDetail.transform;
            enemy[0].transform.localPosition = new Vector3(81.2f, 1, 43f);
            enemy[0].transform.Rotate(0, UnityEngine.Random.Range(0, 180), 0);
            enemy[0].SetActive(true);
        }

        enemyChance = UnityEngine.Random.Range(0, 30);

        if (enemyChance > 20)
        {
            GameObject[] enemy = GameObjectHelper.CreateFoeGameObjects(ExtraDetail.transform.position, MobileTypes.Thief, 1, MobileReactions.Hostile, null, false);
            enemy[0].transform.parent = ExtraDetail.transform;
            enemy[0].transform.localPosition = new Vector3(90.2f, 1, 67f);
            enemy[0].transform.Rotate(0, UnityEngine.Random.Range(0, 180), 0);
            enemy[0].SetActive(true);
        }


        enemyChance = UnityEngine.Random.Range(0, 30);

        if (enemyChance > 20)
        {
            GameObject[] enemy = GameObjectHelper.CreateFoeGameObjects(ExtraDetail.transform.position, MobileTypes.Thief, 1, MobileReactions.Hostile, null, false);
            enemy[0].transform.parent = ExtraDetail.transform;
            enemy[0].transform.localPosition = new Vector3(45.2f, 1, 18f);
            enemy[0].transform.Rotate(0, UnityEngine.Random.Range(0, 180), 0);
            enemy[0].SetActive(true);
        }



        enemyChance = UnityEngine.Random.Range(0, 30);

        if (enemyChance > 20)
        {
            GameObject[] enemy = GameObjectHelper.CreateFoeGameObjects(ExtraDetail.transform.position, MobileTypes.Rogue, 1, MobileReactions.Hostile, null, false);
            enemy[0].transform.parent = ExtraDetail.transform;
            enemy[0].transform.localPosition = new Vector3(49.2f, 1, 21f);
            enemy[0].transform.Rotate(0, UnityEngine.Random.Range(0, 180), 0);
            enemy[0].SetActive(true);
        }



        enemyChance = UnityEngine.Random.Range(0, 30);

        if (enemyChance > 20)
        {
            GameObject[] enemy = GameObjectHelper.CreateFoeGameObjects(ExtraDetail.transform.position, MobileTypes.Thief, 1, MobileReactions.Hostile, null, false);
            enemy[0].transform.parent = ExtraDetail.transform;
            enemy[0].transform.localPosition = new Vector3(85.2f, 1, 15f);
            enemy[0].transform.Rotate(0, UnityEngine.Random.Range(0, 180), 0);
            enemy[0].SetActive(true);
        }



        enemyChance = UnityEngine.Random.Range(0, 30);

        if (enemyChance > 20)
        {
            GameObject[] enemy = GameObjectHelper.CreateFoeGameObjects(ExtraDetail.transform.position, MobileTypes.Rogue, 1, MobileReactions.Hostile, null, false);
            enemy[0].transform.parent = ExtraDetail.transform;
            enemy[0].transform.localPosition = new Vector3(88.2f, 1, 35f);
            enemy[0].transform.Rotate(0, UnityEngine.Random.Range(0, 180), 0);
            enemy[0].SetActive(true);
        }




        ///Items
        ///

        //var lootChance = UnityEngine.Random.Range(0, 30);

        //if (lootChance > 20)
        //{
        //    KamerCreateLootContainer(1, 10, 216, 31, GameManager.Instance.StreamingTarget.transform);
        //}

        //lootChance = UnityEngine.Random.Range(0, 30);

        //if (lootChance > 20)
        //{
        //    KamerCreateLootContainer(1, 10, 216, 31, GameManager.Instance.StreamingTarget.transform);
        //}

        //lootChance = UnityEngine.Random.Range(0, 30);

        //if (lootChance > 20)
        //{
        //    KamerCreateLootContainer(1, 10, 216, 31, GameManager.Instance.StreamingTarget.transform);
        //}
        //lootChance = UnityEngine.Random.Range(0, 30);

        //if (lootChance > 20)
        //{
        //    KamerCreateLootContainer(1, 10, 216, 31, GameManager.Instance.StreamingTarget.transform);
        //}

        //lootChance = UnityEngine.Random.Range(0, 30);

        //if (lootChance > 20)
        //{
        //    KamerCreateLootContainer(1, 10, 216, 31, GameManager.Instance.StreamingTarget.transform);
        //}
        //}

    }

    private static void KamerCreateLootContainer(int locationID, int objID, int textureArchive, int textureRecord, Transform parent)
    {
        GameObject go = GameObject.Instantiate(DaggerfallUnity.Instance.Option_LootContainerPrefab.gameObject);

        // Setup DaggerfallLoot component to make lootable
        DaggerfallLoot loot = go.GetComponent<DaggerfallLoot>();
        if (loot)
        {
            loot.LoadID = ((ulong)locationID * 10000) + (ulong)objID;
            loot.ContainerType = LootContainerTypes.RandomTreasure;
            loot.ContainerImage = InventoryContainerImages.Chest;
            loot.TextureArchive = 216;
            loot.TextureRecord = 31;
        }

        go.transform.parent = ExtraDetail.transform;

        var whereAbouts = UnityEngine.Random.Range(0, 20);

        switch (whereAbouts)
        {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
                go.transform.localPosition = new Vector3(UnityEngine.Random.Range(52, 64), 0.5f, UnityEngine.Random.Range(17, 32));
                return;
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
                go.transform.localPosition = new Vector3(UnityEngine.Random.Range(79, 96), 0.5f, UnityEngine.Random.Range(12, 21));
                return;
            case 11:
            case 12:
            case 13:
            case 14:
            case 15:
                go.transform.localPosition = new Vector3(UnityEngine.Random.Range(69, 86), 0.5f, UnityEngine.Random.Range(75, 86));
                return;
            case 16:
            case 17:
            case 18:
            case 19:
            case 20:
                go.transform.localPosition = new Vector3(UnityEngine.Random.Range(50, 64), 0.5f, UnityEngine.Random.Range(76, 86));
                return;

        }

    }


}
