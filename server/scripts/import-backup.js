// Usage: npm run import-backup -- path/to/school-erp-backup.json
// Imports records from a backup downloaded from the old (localStorage) version
// or from the Data page. Accounts are NOT imported — create them with `create-user`
// or from the Users page, because the old password hashes cannot be reused.
import "dotenv/config";
import fs from "node:fs";
import { pool, tx } from "../src/db.js";
import { COLLECTIONS } from "../src/rules.js";

const file = process.argv[2];
if (!file) { console.error("Usage: npm run import-backup -- <backup.json>"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));

let total = 0;
await tx(async (c) => {
  for (const name of COLLECTIONS) {
    for (const rec of Array.isArray(data[name]) ? data[name] : []) {
      if (!rec?.id) continue;
      await c.query("INSERT INTO records (collection, id, data) VALUES ($1,$2,$3) ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()", [name, rec.id, rec]);
      total++;
    }
  }
});
console.log(`Imported ${total} records.`);
await pool.end();
