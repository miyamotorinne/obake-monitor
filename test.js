const { createClient } = require('@libsql/client');
const db = createClient({ url: 'file:obake.db' });
async function test() {
  await db.execute("INSERT INTO quests (content, author_name) VALUES ('test', 'system')");
  const r = await db.execute("SELECT * FROM quests ORDER BY id DESC LIMIT 1");
  console.log(r.rows);
}
test().catch(console.error);
