import { createClient } from "@libsql/client/http";
import { createPasswordRecord } from "../db/security.ts";

const client = createClient({
  url: "https://assetflow-alanda-admirable.aws-ap-northeast-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcxMDg0OTksImlkIjoiMDFhMDE3ZjctOWUwMS03ZTkxLThmMGUtNmIzZTZiMGE4MWVjIiwia2lkIjoiMzRqbVdvVlhXUXFsMG9ra0tlY0dUc3plNHlCQXZzcjRrOHE4MmVQNUJpcyIsInJpZCI6ImQ5NzZhYjIxLWQyY2EtNDNmNi05YzU2LWM3Nzc1MDU3MzNiZCJ9._n_fU1s2UGQ5WDtpQCkzm_5k2b1HS8rDAv2q-r6OI_ygmrr63ARcuU4nPuXgz1VrLVtEMfstotURajxTlISDDQ"
});

async function updatePasswords() {
  const usersToUpdate = [
    { username: "admin", pass: "AssetFlow@2569!" },
    { username: "supplies", pass: "Supplies@2569!" },
    { username: "approver", pass: "Approver@2569!" },
    { username: "user.demo", pass: "User@2569!" }
  ];

  for (const u of usersToUpdate) {
    const record = await createPasswordRecord(u.pass, 100_000);
    await client.execute({
      sql: `UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = 100000 WHERE username = ?`,
      args: [record.hash, record.salt, u.username]
    });
    console.log(`Updated password for ${u.username}`);
  }
  console.log("All passwords updated to 100,000 iterations!");
}

updatePasswords().catch(console.error);
