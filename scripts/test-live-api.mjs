async function testLiveApi() {
  const url = "https://pathumthani-assetflow.pichet-mekim.workers.dev";
  
  // 1. Test Bootstrap API
  console.log("1. Testing /api/bootstrap...");
  const bootstrapRes = await fetch(`${url}/api/bootstrap`);
  const bootstrapData = await bootstrapRes.json();
  console.log("Bootstrap status:", bootstrapRes.status, "Assets in live DB:", bootstrapData.assets?.length);
  console.log("Locations in live DB:", bootstrapData.locations?.map(l => l.building));

  // 2. Test Login API
  console.log("2. Testing /api/auth/login...");
  const loginRes = await fetch(`${url}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "admin",
      password: "AssetFlow@2569!"
    })
  });
  const loginData = await loginRes.json();
  console.log("Login status:", loginRes.status, "Success:", loginData.success, "User:", loginData.user?.name);
}

testLiveApi().catch(console.error);
