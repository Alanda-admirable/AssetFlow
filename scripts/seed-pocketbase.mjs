import PocketBase from "pocketbase";
import fs from "fs";
import path from "path";

const pb = new PocketBase("http://127.0.0.1:8090");

async function seed() {
  console.log("Connecting to PocketBase...");
  await pb.collection("_superusers").authWithPassword("admin@assetflow.local", "AssetFlow@2569!");
  console.log("Authenticated as superuser!");

  // 1. Create or Update Collections
  const collectionsToCreate = [
    {
      name: "locations",
      type: "base",
      schema: [
        { name: "code", type: "text", required: true },
        { name: "building", type: "text", required: true },
        { name: "floor", type: "text" },
        { name: "room", type: "text", required: true },
        { name: "isActive", type: "bool" },
      ],
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
    },
    {
      name: "asset_categories",
      type: "base",
      schema: [
        { name: "code", type: "text", required: true },
        { name: "name", type: "text", required: true },
        { name: "usefulLifeYears", type: "number" },
        { name: "depreciationRate", type: "number" },
      ],
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
    },
    {
      name: "asset_statuses",
      type: "base",
      schema: [
        { name: "code", type: "text", required: true },
        { name: "name", type: "text", required: true },
        { name: "color", type: "text" },
        { name: "deployable", type: "bool" },
        { name: "sortOrder", type: "number" },
      ],
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
    },
    {
      name: "suppliers",
      type: "base",
      schema: [
        { name: "name", type: "text", required: true },
        { name: "taxId", type: "text" },
        { name: "contactName", type: "text" },
        { name: "email", type: "text" },
        { name: "phone", type: "text" },
      ],
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
    },
    {
      name: "assets",
      type: "base",
      schema: [
        { name: "assetCode", type: "text", required: true },
        { name: "serialNumber", type: "text" },
        { name: "name", type: "text", required: true },
        { name: "description", type: "text" },
        { name: "category", type: "text" },
        { name: "location", type: "text" },
        { name: "room", type: "text" },
        { name: "building", type: "text" },
        { name: "purchasePrice", type: "number" },
        { name: "purchaseDate", type: "text" },
        { name: "condition", type: "text" },
        { name: "imageUrl", type: "text" },
        { name: "qrToken", type: "text" },
        { name: "status", type: "text" },
      ],
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
    },
  ];

  const existingCollections = await pb.collections.getFullList();
  const existingNames = new Set(existingCollections.map((c) => c.name));

  for (const colDef of collectionsToCreate) {
    if (!existingNames.has(colDef.name)) {
      console.log(`Creating collection: ${colDef.name}`);
      await pb.collections.create(colDef);
    } else {
      console.log(`Collection ${colDef.name} already exists, updating rules...`);
      const existing = existingCollections.find((c) => c.name === colDef.name);
      await pb.collections.update(existing.id, {
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
      });
    }
  }

  // 2. Seed Locations
  const locList = await pb.collection("locations").getFullList();
  if (locList.length === 0) {
    console.log("Seeding locations...");
    const sampleLocations = [
      { code: "JW-BUD", building: "จวนผู้ว่าราชการจังหวัด", floor: "1", room: "หอกลอง/หอบูชา", isActive: true },
      { code: "JW-REC", building: "จวนผู้ว่าราชการจังหวัด", floor: "1", room: "ห้องรับรอง", isActive: true },
      { code: "JW-OUT", building: "จวนผู้ว่าราชการจังหวัด", floor: "1", room: "บริเวณหน้าบ้าน", isActive: true },
      { code: "HQ-IT-301", building: "อาคารสำนักงานกลาง", floor: "3", room: "ห้อง IT 301", isActive: true },
      { code: "HQ-ADM-201", building: "อาคารสำนักงานกลาง", floor: "2", room: "ห้องพัสดุ 201", isActive: true },
    ];
    for (const loc of sampleLocations) {
      await pb.collection("locations").create(loc);
    }
  }

  // 3. Seed Categories
  const catList = await pb.collection("asset_categories").getFullList();
  if (catList.length === 0) {
    console.log("Seeding categories...");
    const sampleCategories = [
      { code: "BUD", name: "พระพุทธรูป", usefulLifeYears: 50, depreciationRate: 0 },
      { code: "SAC", name: "ของที่ระลึก", usefulLifeYears: 50, depreciationRate: 0 },
      { code: "OUT", name: "หน้าบ้าน", usefulLifeYears: 10, depreciationRate: 10 },
      { code: "ART", name: "ศิลปวัตถุประจำสำนักงาน", usefulLifeYears: 20, depreciationRate: 5 },
      { code: "OFF", name: "ครุภัณฑ์สำนักงาน", usefulLifeYears: 5, depreciationRate: 20 },
    ];
    for (const cat of sampleCategories) {
      await pb.collection("asset_categories").create(cat);
    }
  }

  // 4. Seed Statuses
  const statusList = await pb.collection("asset_statuses").getFullList();
  if (statusList.length === 0) {
    console.log("Seeding statuses...");
    const sampleStatuses = [
      { code: "available", name: "พร้อมใช้งาน", color: "green", deployable: true, sortOrder: 1 },
      { code: "assigned", name: "มีผู้รับผิดชอบ", color: "blue", deployable: true, sortOrder: 2 },
      { code: "borrowed", name: "ถูกยืมใช้งาน", color: "violet", deployable: true, sortOrder: 3 },
      { code: "maintenance", name: "อยู่ระหว่างซ่อม", color: "orange", deployable: false, sortOrder: 4 },
      { code: "damaged", name: "ชำรุด", color: "red", deployable: false, sortOrder: 5 },
    ];
    for (const st of sampleStatuses) {
      await pb.collection("asset_statuses").create(st);
    }
  }

  // 5. Seed Real Assets (93 items)
  const assetsCount = await pb.collection("assets").getList(1, 1);
  if (assetsCount.totalItems === 0) {
    console.log("Reading real-assets-seed.ts...");
    const seedFilePath = path.join(process.cwd(), "db", "real-assets-seed.ts");
    const seedContent = fs.readFileSync(seedFilePath, "utf-8");
    const match = seedContent.match(/export const realAssetsList: RealAssetSeed\[\] = (\[[\s\S]*?\]);/);
    const realAssetsList = eval(match[1]);

    console.log(`Seeding ${realAssetsList.length} assets to PocketBase...`);
    for (const item of realAssetsList) {
      const roomName = item.location.split(/\s*>\s*/).pop();
      await pb.collection("assets").create({
        assetCode: item.assetCode,
        serialNumber: item.serialNumber,
        name: item.name,
        description: item.description,
        category: item.category,
        location: item.location,
        room: roomName,
        building: "จวนผู้ว่าราชการจังหวัด",
        purchasePrice: item.purchasePrice || 0,
        purchaseDate: "2026-08-07",
        condition: "excellent",
        imageUrl: item.imageUrl,
        qrToken: item.assetCode,
        status: "available",
      });
    }
    console.log(`Successfully seeded ${realAssetsList.length} items to PocketBase!`);
  } else {
    console.log(`PocketBase already has ${assetsCount.totalItems} assets.`);
  }

  console.log("PocketBase initialization complete!");
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
