import { createClient } from "@libsql/client/http";

const TURSO_URL = "https://assetflow-alanda-admirable.aws-ap-northeast-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcxMDg0OTksImlkIjoiMDFhMDE3ZjctOWUwMS03ZTkxLThmMGUtNmIzZTZiMGE4MWVjIiwia2lkIjoiMzRqbVdvVlhXUXFsMG9ra0tlY0dUc3plNHlCQXZzcjRrOHE4MmVQNUJpcyIsInJpZCI6ImQ5NzZhYjIxLWQyY2EtNDNmNi05YzU2LWM3Nzc1MDU3MzNiZCJ9._n_fU1s2UGQ5WDtpQCkzm_5k2b1HS8rDAv2q-r6OI_ygmrr63ARcuU4nPuXgz1VrLVtEMfstotURajxTlISDDQ";

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN
});

async function fix() {
  await client.execute({
    sql: "DELETE FROM locations WHERE id = 15"
  });
  await client.execute({
    sql: "UPDATE locations SET room = 'ห้องรองผู้ว่าฯ 2 (ห้องอาคารหลังเก่า 2 ชั้น)', building = 'ศาลากลางจังหวัดปทุมธานี', code = 'LOC-014' WHERE id = 1"
  });

  const counts = await client.execute(`
    SELECT l.id, l.room, COUNT(a.id) as count
    FROM locations l
    LEFT JOIN assets a ON a.location_id = l.id
    GROUP BY l.id
    ORDER BY count DESC
  `);
  console.log("Updated location counts in DB:");
  console.table(counts.rows);
}

fix().catch(console.error);
