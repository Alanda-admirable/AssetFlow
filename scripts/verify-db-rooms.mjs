import { createClient } from "@libsql/client/http";

const client = createClient({
  url: "https://assetflow-alanda-admirable.aws-ap-northeast-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcxMDg0OTksImlkIjoiMDFhMDE3ZjctOWUwMS03ZTkxLThmMGUtNmIzZTZiMGE4MWVjIiwia2lkIjoiMzRqbVdvVlhXUXFsMG9ra0tlY0dUc3plNHlCQXZzcjRrOHE4MmVQNUJpcyIsInJpZCI6ImQ5NzZhYjIxLWQyY2EtNDNmNi05YzU2LWM3Nzc1MDU3MzNiZCJ9._n_fU1s2UGQ5WDtpQCkzm_5k2b1HS8rDAv2q-r6OI_ygmrr63ARcuU4nPuXgz1VrLVtEMfstotURajxTlISDDQ"
});

const res = await client.execute("SELECT COUNT(*) as count FROM assets");
console.log("Database total assets count:", res.rows[0].count);

const byLoc = await client.execute("SELECT l.room, COUNT(a.id) as total FROM assets a JOIN locations l ON a.location_id = l.id GROUP BY l.room ORDER BY total DESC");
console.log("\n=== จำนวนครุภัณฑ์ใน Database แยกตามห้อง/กลุ่มงาน ===");
byLoc.rows.forEach(r => {
  console.log(`- ${r.room}: ${r.total} รายการ`);
});
