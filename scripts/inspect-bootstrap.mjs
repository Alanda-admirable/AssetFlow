async function inspectBootstrap() {
  const url = "https://assetflow.pathumthani.workers.dev";
  const loginRes = await fetch(`${url}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "AssetFlow@2569!" })
  });
  const cookie = loginRes.headers.get("set-cookie");
  const bootRes = await fetch(`${url}/api/bootstrap`, {
    headers: { "Cookie": cookie ? cookie.split(";")[0] : "" }
  });
  const data = await bootRes.json();
  console.log("=== meta.locations ===");
  console.log(data.meta?.locations);
  console.log("\n=== meta.departments ===");
  console.log(data.meta?.departments);
  console.log("\n=== Sample 5 Assets ===");
  console.log(data.assets?.slice(0, 5).map(a => ({
    id: a.id,
    code: a.assetCode,
    name: a.name,
    location: a.location,
    building: a.building,
    department: a.department,
    category: a.category
  })));
}

inspectBootstrap();
