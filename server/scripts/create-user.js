// Usage: npm run create-user -- <role> <username> "<Full Name>" <password> [linkedId]
// Example: npm run create-user -- Admin principal "School Admin" "S0me-Strong-Pass"
import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { pool } from "../src/db.js";

const [role, username, name, password, linkedId] = process.argv.slice(2);
if (!["Admin", "Teacher", "Student", "Parent"].includes(role) || !username || !name || !password) {
  console.error('Usage: npm run create-user -- <Admin|Teacher|Student|Parent> <username> "<Full Name>" <password> [linkedId]');
  process.exit(1);
}
if (password.length < 8) { console.error("Password must be at least 8 characters."); process.exit(1); }
const id = "usr-" + crypto.randomBytes(5).toString("hex");
try {
  await pool.query("INSERT INTO users (id, username, role, name, linked_id, password_hash) VALUES ($1,$2,$3,$4,$5,$6)",
    [id, username.toLowerCase(), role, name, role === "Admin" ? null : linkedId || null, await bcrypt.hash(password, 10)]);
  console.log(`Created ${role} account "${username.toLowerCase()}".`);
} catch (e) {
  console.error(e.code === "23505" ? "That username already exists." : e.message);
  process.exitCode = 1;
}
await pool.end();
