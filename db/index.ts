import { createClient, Client } from "@libsql/client";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

let client: Client | null = null;
let dbInstance: LibSQLDatabase<typeof schema> | null = null;

export function getDb() {
  if (!client) {
    const dbPath = path.join(process.cwd(), "assetflow.db");
    client = createClient({
      url: `file:${dbPath.replace(/\\/g, "/")}`,
    });
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance!;
}

export function getRawClient() {
  if (!client) {
    getDb();
  }
  return client!;
}
