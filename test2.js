require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { createClient } = require('@libsql/client');
const url = process.env.TURSO_DATABASE_URL || 'file:obake.db';
const authToken = process.env.TURSO_AUTH_TOKEN;
console.log('Connecting to', url);
const db = createClient({ url, authToken });
async function test() {
  const r = await db.execute("SELECT * FROM quests ORDER BY id DESC LIMIT 1");
  console.log(r.rows);
}
test().catch(console.error);
