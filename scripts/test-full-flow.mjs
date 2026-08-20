async function testFullFlow() {
  const url = "https://assetflow.pathumthani.workers.dev";
  
  console.log("=== 1. Logging in as admin on https://assetflow.pathumthani.workers.dev ===");
  const loginRes = await fetch(`${url}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "admin",
      password: "AssetFlow@2569!"
    })
  });
  
  const cookie = loginRes.headers.get("set-cookie");
  const loginData = await loginRes.json();
  console.log("Login HTTP status:", loginRes.status);
  console.log("Login user:", loginData.user);

  console.log("\n=== 2. Fetching /api/bootstrap from Live Cloudflare Worker ===");
  const bootstrapRes = await fetch(`${url}/api/bootstrap`, {
    headers: { "Cookie": cookie ? cookie.split(";")[0] : "" }
  });
  const bootstrapData = await bootstrapRes.json();
  console.log("Bootstrap HTTP status:", bootstrapRes.status);
  console.log("Total assets in live DB:", bootstrapData.assets?.length);
  console.log("Total locations in live DB:", bootstrapData.meta?.locations?.length);
  console.log("Total departments in live DB:", bootstrapData.meta?.departments?.length);
  console.log("Total categories in live DB:", bootstrapData.meta?.categories?.length);
  
  console.log("\nตัวอย่าง 3 รายการแรก:");
  for (let i = 0; i < Math.min(3, bootstrapData.assets?.length || 0); i++) {
    const a = bootstrapData.assets[i];
    console.log(`- [${a.assetCode}] ${a.name} (หมวด: ${a.category} | สถานที่: ${a.location})`);
  }
}

testFullFlow().catch(console.error);
