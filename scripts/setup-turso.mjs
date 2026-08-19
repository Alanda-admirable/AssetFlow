const token = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJ2c1VjZHB0NUVmR2d5RFlQRWRBS3NRIiwib3JnX2lkIjoxMDAwMjI0NDA0fQ.aEHWJzymg9EUWmO7F8u8JMpJKTaoWWATkYPhlfFJJgt-Ff4uYXgBTbsVoCHdbYsL98mqX0WdiTJHLbCSKizpAw";
const orgSlug = "alanda-admirable";

async function main() {
  const locRes = await fetch(`https://api.turso.tech/v1/locations`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const locs = await locRes.json();
  console.log("Locations:", locs);

  // Pick Tokyo (nrt), Singapore (sin), Hong Kong (hkg), or Sydney (syd) or closest
  const locKey = Object.keys(locs.locations || {})[0] || "nrt";
  console.log("Using location:", locKey);

  const createGroupRes = await fetch(`https://api.turso.tech/v1/organizations/${orgSlug}/groups`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "default",
      location: locKey
    })
  });
  const createdGroup = await createGroupRes.json();
  console.log("Created group response:", createdGroup);

  // Create database
  console.log("Creating database 'assetflow'...");
  const createRes = await fetch(`https://api.turso.tech/v1/organizations/${orgSlug}/databases`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "assetflow",
      group: "default"
    })
  });
  const created = await createRes.json();
  console.log("Created DB response:", created);

  if (created.database) {
    const dbHostname = created.database.Hostname || created.database.hostname;
    const dbUrl = `libsql://${dbHostname}`;
    
    // Create database auth token
    const dbTokenRes = await fetch(`https://api.turso.tech/v1/organizations/${orgSlug}/databases/assetflow/auth/tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const dbTokenData = await dbTokenRes.json();
    
    console.log("\n================================================");
    console.log("TURSO_DATABASE_URL=" + dbUrl);
    console.log("TURSO_AUTH_TOKEN=" + dbTokenData.jwt);
    console.log("================================================\n");
  }
}

main().catch(console.error);
