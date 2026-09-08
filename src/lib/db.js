import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:obake.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function withTransaction(callback) {
  const transaction = await db.transaction('write');

  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {
      // The transaction may already be closed after a failed statement.
    }
    throw error;
  } finally {
    transaction.close();
  }
}

export default db;
