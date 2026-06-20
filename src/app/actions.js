'use server';

import db from '@/lib/db';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { titlesData } from '@/lib/titles';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'obake';

export async function isAdmin() {
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
  
  // Distribute Gacha Tickets
  await db.execute(`UPDATE observers SET gacha_tickets = gacha_tickets + 1`);
  
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
  
  let observerId = null;
  try {
    const observer = await getCurrentObserver();
    if (observer && observer.id) {
      observerId = observer.id;
    }
  } catch (err) {
    console.error("Failed to get current observer in addQuest:", err);
  }
  
  try {
    if (observerId) {
      await db.execute({
        sql: `INSERT INTO quests (content, author_name, observer_id) VALUES (?, ?, ?)`,
        args: [content, authorName, observerId]
      });
    } else {
      await db.execute({
        sql: `INSERT INTO quests (content, author_name) VALUES (?, ?)`,
        args: [content, authorName]
      });
    }
  } catch (err) {
    console.error("addQuest DB error:", err);
    // Fallback in case observer_id column does not exist in production
    await db.execute({
      sql: `INSERT INTO quests (content, author_name) VALUES (?, ?)`,
      args: [content, authorName]
    });
  }
  
  revalidatePath('/');
}

export async function completeQuest(id) {
  if (!(await isAdmin())) throw new Error('Unauthorized');
  
  const questRes = await db.execute({
    sql: `SELECT * FROM quests WHERE id = ?`,
    args: [id]
  });
  const quest = questRes.rows[0];
  if (!quest) throw new Error('Quest not found');

  await db.execute({
    sql: `UPDATE quests SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [id]
  });

  if (quest.observer_id) {
    const obsRes = await db.execute({
      sql: `SELECT points FROM observers WHERE id = ?`,
      args: [quest.observer_id]
    });
    const observer = obsRes.rows[0];
    if (observer) {
      const newPoints = observer.points + 10;
      await db.execute({
        sql: `UPDATE observers SET points = ? WHERE id = ?`,
        args: [newPoints, quest.observer_id]
      });

      const thresholds = [
        { pt: 10, title: '見習い観測者' },
        { pt: 30, title: '漂流者' },
        { pt: 50, title: '観測者' },
        { pt: 100, title: '監視員' },
        { pt: 200, title: '干渉者' },
        { pt: 500, title: '世界改変者' }
      ];

      for (const th of thresholds) {
        if (newPoints >= th.pt) {
          const ownsRes = await db.execute({
            sql: `SELECT id FROM observer_titles WHERE observer_id = ? AND name = ?`,
            args: [quest.observer_id, th.title]
          });
          if (ownsRes.rows.length === 0) {
            await db.execute({
              sql: `INSERT INTO observer_titles (observer_id, name, is_rare) VALUES (?, ?, 0)`,
              args: [quest.observer_id, th.title]
            });
          }
        }
      }
    }
  }
  
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

// 観測者システム関連のアクション

export async function getCurrentObserver() {
  const cookieStore = await cookies();
  const token = cookieStore.get('observer_token')?.value;
  if (!token) return null;
  
  const res = await db.execute({
    sql: `SELECT id, name, points, favorite_title, gacha_tickets, created_at FROM observers WHERE token = ?`,
    args: [token]
  });
  return res.rows[0] || null;
}

export async function registerObserver(name) {
  if (!name || name.trim() === '') throw new Error('観測者名が必要です');
  
  const token = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO observers (token, name) VALUES (?, ?)`,
    args: [token, name.trim()]
  });
  
  const cookieStore = await cookies();
  cookieStore.set('observer_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  });
  
  revalidatePath('/');
}

export async function getObservers() {
  const res = await db.execute(`SELECT id, name, points, favorite_title, created_at FROM observers ORDER BY created_at ASC`);
  return res.rows;
}

export async function getObserverById(id) {
  const res = await db.execute({
    sql: `SELECT id, name, points, favorite_title, created_at FROM observers WHERE id = ?`,
    args: [id]
  });
  return res.rows[0] || null;
}

export async function getObserverTitles(observerId) {
  const res = await db.execute({
    sql: `SELECT * FROM observer_titles WHERE observer_id = ? ORDER BY acquired_at DESC`,
    args: [observerId]
  });
  return res.rows;
}

export async function setFavoriteTitle(titleName) {
  const observer = await getCurrentObserver();
  if (!observer) throw new Error('Unauthorized');

  // Verify they own the title
  const ownsTitle = await db.execute({
    sql: `SELECT id FROM observer_titles WHERE observer_id = ? AND name = ?`,
    args: [observer.id, titleName]
  });
  
  if (ownsTitle.rows.length === 0) throw new Error('You do not own this title');

  await db.execute({
    sql: `UPDATE observers SET favorite_title = ? WHERE id = ?`,
    args: [titleName, observer.id]
  });

  revalidatePath('/observers');
  revalidatePath(`/observers/${observer.id}`);
}


export async function rollGacha() {
  const observer = await getCurrentObserver();
  if (!observer) throw new Error('Unauthorized');
  if (observer.gacha_tickets <= 0) throw new Error('No tickets');

  // Deduct ticket
  await db.execute({
    sql: `UPDATE observers SET gacha_tickets = gacha_tickets - 1 WHERE id = ?`,
    args: [observer.id]
  });

  // Roll
  const rand = Math.random();
  let selectedRarity = 'N';
  if (rand < 0.05) selectedRarity = 'SSR';
  else if (rand < 0.25) selectedRarity = 'R';

  const possibleTitles = titlesData.filter(t => t.rarity === selectedRarity);
  const title = possibleTitles[Math.floor(Math.random() * possibleTitles.length)];

  // Check duplicate
  const ownsRes = await db.execute({
    sql: `SELECT id FROM observer_titles WHERE observer_id = ? AND name = ?`,
    args: [observer.id, title.name]
  });

  let isDuplicate = ownsRes.rows.length > 0;
  let pointsGained = 0;

  if (isDuplicate) {
    if (title.rarity === 'N') pointsGained = 1;
    else if (title.rarity === 'R') pointsGained = 3;
    else if (title.rarity === 'SSR') pointsGained = 10;

    await db.execute({
      sql: `UPDATE observers SET points = points + ? WHERE id = ?`,
      args: [pointsGained, observer.id]
    });
  } else {
    await db.execute({
      sql: `INSERT INTO observer_titles (observer_id, name, is_rare) VALUES (?, ?, ?)`,
      args: [observer.id, title.name, title.rarity !== 'N' ? 1 : 0]
    });
  }

  // Log history
  await db.execute({
    sql: `INSERT INTO gacha_history (observer_name, title_name) VALUES (?, ?)`,
    args: [observer.name, title.name]
  });

  revalidatePath('/gacha');
  revalidatePath(`/observers/${observer.id}`);

  return { title, isDuplicate, pointsGained };
}

export async function getGachaHistory() {
  const res = await db.execute(`SELECT * FROM gacha_history ORDER BY created_at DESC LIMIT 20`);
  return res.rows;
}

export async function giveGachaTicketToObserver(observerId) {
  if (!(await isAdmin())) throw new Error('Unauthorized');
  
  await db.execute({
    sql: `UPDATE observers SET gacha_tickets = gacha_tickets + 1 WHERE id = ?`,
    args: [observerId]
  });
  
  revalidatePath('/observers');
  revalidatePath(`/observers/${observerId}`);
}
