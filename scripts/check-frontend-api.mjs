async function checkApi() {
  const url = "https://assetflow.pathumthani.workers.dev";
  
  // Login
  const loginRes = await fetch(`${url}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "admin",
      password: "AssetFlow@2569!"
    })
  });
  const cookie = loginRes.headers.get("set-cookie");
  const authHeader = { "Cookie": cookie ? cookie.split(";")[0] : "" };

  // 1. Check /api/bootstrap
  const bootRes = await fetch(`${url}/api/bootstrap`, { headers: authHeader });
  const bootData = await bootRes.json();
  console.log("Bootstrap assets length:", bootData.assets?.length);
  if (bootData.assets && bootData.assets.length > 0) {
    console.log("Bootstrap sample asset:", bootData.assets[0]);
  }

  // 2. Check /api/assets
  const assetsRes = await fetch(`${url}/api/assets`, { headers: authHeader });
  const assetsData = await assetsRes.json();
  console.log("API /api/assets length:", assetsData.length || assetsData.assets?.length);
  console.log("API /api/assets sample:", (assetsData.assets || assetsData)[0]);
}

checkApi().catch(console.error);
