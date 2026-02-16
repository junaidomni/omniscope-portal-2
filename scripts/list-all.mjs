import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
dotenv.config();

const db = drizzle(process.env.DATABASE_URL);
const rows = await db.execute(sql`SELECT id, primaryLead, LEFT(executiveSummary, 80) as summary, sourceType FROM meetings ORDER BY id`);
console.table(rows[0]);
process.exit(0);
