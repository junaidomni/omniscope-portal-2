import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT id, primaryLead, sourceType, sourceId, LEFT(executiveSummary, 80) as summary, meetingDate FROM meetings ORDER BY id ASC');
console.table(rows);
await conn.end();
