async function testFullFlow() {
  const url = "https://pathumthani-assetflow.pichet-mekim.workers.dev";
  
  console.log("=== 1. Logging in as admin ===");
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
  console.log("Session cookie set:", cookie ? "Yes" : "No");

  console.log("\n=== 2. Fetching /api/bootstrap with session cookie ===");
  const bootstrapRes = await fetch(`${url}/api/bootstrap`, {
    headers: { "Cookie": cookie ? cookie.split(";")[0] : "" }
  });
  const bootstrapData = await bootstrapRes.json();
  console.log("Bootstrap HTTP status:", bootstrapRes.status);
  console.log("Total assets returned from live Cloudflare Worker:", bootstrapData.assets?.length);
  console.log("Total locations:", bootstrapData.meta?.locations?.length);
  console.log("Sample asset 1:", bootstrapData.assets?.[0]?.name, `(${bootstrapData.assets?.[0]?.assetCode})`);
  console.log("Sample asset 2:", bootstrapData.assets?.[1]?.name, `(${bootstrapData.assets?.[1]?.assetCode})`);
}

testFullFlow().catch(console.error);
