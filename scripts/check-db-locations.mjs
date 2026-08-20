import { createClient } from "@libsql/client/http";

const TURSO_URL = "https://assetflow-alanda-admirable.aws-ap-northeast-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcxMDg0OTksImlkIjoiMDFhMDE3ZjctOWUwMS03ZTkxLThmMGUtNmIzZTZiMGE4MWVjIiwia2lkIjoiMzRqbVdvVlhXUXFsMG9ra0tlY0dUc3plNHlCQXZzcjRrOHE4MmVQNUJpcyIsInJpZCI6ImQ5NzZhYjIxLWQyY2EtNDNmNi05YzU2LWM3Nzc1MDU3MzNiZCJ9._n_fU1s2UGQ5WDtpQCkzm_5k2b1HS8rDAv2q-r6OI_ygmrr63ARcuU4nPuXgz1VrLVtEMfstotURajxTlISDDQ";

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN
});

async function checkLocations() {
  const locs = await client.execute("SELECT id, code, room, building FROM locations");
  console.log("Locations in DB:", locs.rows);

  const counts = await client.execute(`
    SELECT l.room, COUNT(a.id) as count
    FROM locations l
    LEFT JOIN assets a ON a.location_id = l.id
    GROUP BY l.id
    ORDER BY count DESC
  `);
  console.log("\nAssets count per location in DB:");
  console.table(counts.rows);
}

checkLocations().catch(console.error);
