'use server';

import db from '@/lib/db';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'obake';

async function isAdmin() {
  const cookieStore = await cookies();
  return cookieStore.get('obake_auth')?.value === 'true';
}

export async function login(password) {
  if (password === ADMIN_PASSWORD) {
    const cookieStore = await cookies();
    cookieStore.set('obake_auth', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });
    return { success: true };
  }
  return { success: false, error: 'パスワードが違います' };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('obake_auth');
  revalidatePath('/');
}

export async function getDashboardData() {
  const admin = await isAdmin();

  // Get last bath
  const lastBathRes = await db.execute(`SELECT created_at FROM events WHERE type = 'bath' ORDER BY id DESC LIMIT 1`);
  const lastBathEvent = lastBathRes.rows[0];
  // Get last out
  const lastOutRes = await db.execute(`SELECT created_at FROM events WHERE type = 'out' ORDER BY id DESC LIMIT 1`);
  const lastOutEvent = lastOutRes.rows[0];

  // Calculate state based on last bath
  let state = '人間';
  let daysSinceBath = 0;
  if (lastBathEvent) {
    const bathDate = new Date(lastBathEvent.created_at + 'Z'); // SQLite CURRENT_TIMESTAMP is UTC
    const now = new Date();
    daysSinceBath = Math.floor((now - bathDate) / (1000 * 60 * 60 * 24));
    
    if (daysSinceBath >= 14) state = '都市伝説';
    else if (daysSinceBath >= 7) state = '怪異';
    else if (daysSinceBath >= 4) state = '漂流者';
    else if (daysSinceBath >= 2) state = '在宅';
  }

  // Get reactions count
  const reactionsRows = await db.execute(`SELECT type, COUNT(*) as count FROM reactions GROUP BY type`);
  const reactions = { monitor: 0, survival: 0, bath: 0 };
  reactionsRows.rows.forEach(r => { reactions[r.type] = Number(r.count); });

  // Get pending quests
  const pendingQuestsRes = await db.execute(`SELECT * FROM quests WHERE status = 'pending' ORDER BY id DESC`);
  const pendingQuests = pendingQuestsRes.rows;
  
  // Get completed quests
  const completedQuestsRes = await db.execute(`SELECT * FROM quests WHERE status = 'completed' ORDER BY completed_at DESC`);
  const completedQuests = completedQuestsRes.rows;

  return {
    admin,
    lastBath: lastBathEvent?.created_at,
    lastOut: lastOutEvent?.created_at,
    state,
    daysSinceBath,
    reactions,
    pendingQuests,
    completedQuests
  };
}

export async function recordBath() {
  if (!(await isAdmin())) throw new Error('Unauthorized');
  
  await db.execute(`INSERT INTO events (type) VALUES ('bath')`);
  
  // Reset reactions
  await db.execute(`DELETE FROM reactions`);
  
  revalidatePath('/');
}

export async function recordOut() {
  if (!(await isAdmin())) throw new Error('Unauthorized');
  
  await db.execute(`INSERT INTO events (type) VALUES ('out')`);
  
  revalidatePath('/');
}

export async function addReaction(type) {
  if (!['monitor', 'survival', 'bath'].includes(type)) throw new Error('Invalid reaction type');
  
  await db.execute({
    sql: `INSERT INTO reactions (type) VALUES (?)`,
    args: [type]
  });
  
  revalidatePath('/');
}

export async function addQuest(content, authorName) {
  if (!content || !authorName) throw new Error('Missing fields');
  
  await db.execute({
    sql: `INSERT INTO quests (content, author_name) VALUES (?, ?)`,
    args: [content, authorName]
  });
  
  revalidatePath('/');
}

export async function completeQuest(id) {
  if (!(await isAdmin())) throw new Error('Unauthorized');
  
  await db.execute({
    sql: `UPDATE quests SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [id]
  });
  
  revalidatePath('/');
}

export async function deleteQuest(id) {
  if (!(await isAdmin())) throw new Error('Unauthorized');
  
  await db.execute({
    sql: `DELETE FROM quests WHERE id = ?`,
    args: [id]
  });
  
  revalidatePath('/');
}
