import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT id, meetingTitle, LEFT(intelligenceData, 200) as idata, LEFT(executiveSummary, 80) as summary FROM meetings ORDER BY id');
for (const r of rows) {
  console.log(`ID: ${r.id} | Title: ${r.meetingTitle || 'NULL'} | Summary: ${r.summary}`);
  if (r.idata) {
    try {
      const d = JSON.parse(r.idata + '...');
    } catch(e) {
      console.log(`  idata preview: ${r.idata}`);
    }
  }
}
await conn.end();
