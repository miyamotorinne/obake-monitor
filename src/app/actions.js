'use server';

import db, { withTransaction } from '@/lib/db';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { titlesData } from '@/lib/titles';
import {
  ADMIN_COOKIE_NAME,
  OBSERVER_COOKIE_NAME,
  adminCookieOptions,
  observerCookieOptions,
} from '@/lib/cookie-options';
import { createAdminSession, passwordsMatch, verifyAdminSession } from '@/lib/admin-session';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_ATTEMPT_LIMIT = 5;

const pointTitleThresholds = [
  { pt: 10, title: '見習い観測者' },
  { pt: 30, title: '漂流者' },
  { pt: 50, title: '観測者' },
  { pt: 100, title: '監視員' },
  { pt: 200, title: '干渉者' },
  { pt: 500, title: '世界改変者' },
];

function normalizeText(value, maxLength, label) {
  if (typeof value !== 'string') throw new Error(`${label}が必要です`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label}が必要です`);
  if (normalized.length > maxLength) throw new Error(`${label}は${maxLength}文字以内にしてください`);
  return normalized;
}

function recoveryCodeHash(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function getLoginActorHash() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim();
  const actor = forwardedFor || requestHeaders.get('x-real-ip') || requestHeaders.get('user-agent') || 'unknown';
  return crypto.createHash('sha256').update(actor).digest('hex');
}

export async function isAdmin() {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export async function login(password) {
  if (!ADMIN_PASSWORD) {
    return { success: false, error: '管理者パスワードが設定されていません' };
  }

  const actorHash = await getLoginActorHash();
  let attemptResult;
  try {
    await db.execute(`DELETE FROM admin_login_attempts WHERE attempted_at <= datetime('now', '-${LOGIN_WINDOW_MINUTES} minutes')`);
    attemptResult = await db.execute({
      sql: `SELECT COUNT(*) AS count FROM admin_login_attempts WHERE actor_hash = ? AND attempted_at > datetime('now', '-${LOGIN_WINDOW_MINUTES} minutes')`,
      args: [actorHash],
    });
  } catch (error) {
    console.error('Admin login database migration is missing:', error);
    return { success: false, error: 'データベースの更新が未完了です。管理者に連絡してください' };
  }

  if (Number(attemptResult.rows[0].count) >= LOGIN_ATTEMPT_LIMIT) {
    return { success: false, error: 'ログイン試行が多すぎます。15分後に再試行してください' };
  }

  if (passwordsMatch(password, ADMIN_PASSWORD)) {
    await db.execute({ sql: 'DELETE FROM admin_login_attempts WHERE actor_hash = ?', args: [actorHash] });
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, createAdminSession(), adminCookieOptions());
    return { success: true };
  }

  await db.execute({
    sql: 'INSERT INTO admin_login_attempts (actor_hash) VALUES (?)',
    args: [actorHash],
  });
  return { success: false, error: 'パスワードが違います' };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
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

  await withTransaction(async (transaction) => {
    const inserted = await transaction.execute(`
      INSERT INTO events (type)
      SELECT 'bath'
      WHERE NOT EXISTS (
        SELECT 1 FROM events
        WHERE type = 'bath' AND created_at > datetime('now', '-30 seconds')
      )
      RETURNING id
    `);

    if (inserted.rows.length === 0) return;
    await transaction.execute('DELETE FROM reactions');
    await transaction.execute('UPDATE observers SET gacha_tickets = gacha_tickets + 1');
  });
  
  revalidatePath('/');
}

export async function recordOut() {
  if (!(await isAdmin())) throw new Error('Unauthorized');

  await db.execute(`
    INSERT INTO events (type)
    SELECT 'out'
    WHERE NOT EXISTS (
      SELECT 1 FROM events
      WHERE type = 'out' AND created_at > datetime('now', '-30 seconds')
    )
  `);
  
  revalidatePath('/');
}

export async function addReaction(type) {
  if (!['monitor', 'survival', 'bath'].includes(type)) throw new Error('Invalid reaction type');

  const observer = await getCurrentObserver();
  if (!observer) throw new Error('Unauthorized');

  await db.execute({
    sql: `
      INSERT INTO reactions (type, observer_id)
      SELECT ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM reactions
        WHERE observer_id = ? AND type = ? AND created_at > datetime('now', '-3 seconds')
      )
    `,
    args: [type, observer.id, observer.id, type],
  });
  
  revalidatePath('/');
}

export async function addQuest(content, authorName) {
  const normalizedContent = normalizeText(content, 100, '内容');
  const normalizedAuthor = normalizeText(authorName, 20, '作成者名');
  const observer = await getCurrentObserver();
  if (!observer) throw new Error('Unauthorized');

  const inserted = await db.execute({
    sql: `
      INSERT INTO quests (content, author_name, observer_id)
      SELECT ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM quests
        WHERE observer_id = ? AND created_at > datetime('now', '-5 seconds')
      )
      RETURNING id
    `,
    args: [normalizedContent, normalizedAuthor, observer.id, observer.id],
  });
  if (inserted.rows.length === 0) throw new Error('連続投稿は少し待ってから行ってください');
  
  revalidatePath('/');
}

export async function completeQuest(id) {
  if (!(await isAdmin())) throw new Error('Unauthorized');

  await withTransaction(async (transaction) => {
    const completed = await transaction.execute({
      sql: `UPDATE quests SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending' RETURNING observer_id`,
      args: [id],
    });
    if (completed.rows.length === 0) throw new Error('Quest not found or already completed');

    const observerId = completed.rows[0].observer_id;
    if (!observerId) return;

    const pointResult = await transaction.execute({
      sql: 'UPDATE observers SET points = points + 10 WHERE id = ? RETURNING points',
      args: [observerId],
    });
    if (pointResult.rows.length === 0) return;

    const newPoints = Number(pointResult.rows[0].points);
    for (const threshold of pointTitleThresholds) {
      if (newPoints >= threshold.pt) {
        await transaction.execute({
          sql: `INSERT INTO observer_titles (observer_id, name, is_rare) VALUES (?, ?, 0) ON CONFLICT(observer_id, name) DO NOTHING`,
          args: [observerId, threshold.title],
        });
      }
    }
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

// 観測者システム関連のアクション

export async function getCurrentObserver() {
  const cookieStore = await cookies();
  const token = cookieStore.get(OBSERVER_COOKIE_NAME)?.value;
  if (!token) return null;
  
  const res = await db.execute({
    sql: `SELECT id, name, points, favorite_title, gacha_tickets, created_at FROM observers WHERE token = ?`,
    args: [token]
  });
  return res.rows[0] || null;
}

export async function registerObserver(name) {
  const normalizedName = normalizeText(name, 20, '観測者名');

  const cookieStore = await cookies();
  const existingToken = cookieStore.get(OBSERVER_COOKIE_NAME)?.value;
  if (existingToken) {
    const existingObserver = await getCurrentObserver();
    if (existingObserver) return;
    throw new Error('以前の観測者情報を復旧してください');
  }
  
  const token = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO observers (token, name) VALUES (?, ?)`,
    args: [token, normalizedName]
  });
  
  cookieStore.set(OBSERVER_COOKIE_NAME, token, observerCookieOptions());
  
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

  const rand = Math.random();
  let selectedRarity = 'N';
  if (rand < 0.05) selectedRarity = 'SSR';
  else if (rand < 0.25) selectedRarity = 'R';

  const possibleTitles = titlesData.filter(t => t.rarity === selectedRarity);
  const title = possibleTitles[Math.floor(Math.random() * possibleTitles.length)];

  const result = await withTransaction(async (transaction) => {
    const ticketResult = await transaction.execute({
      sql: `UPDATE observers SET gacha_tickets = gacha_tickets - 1 WHERE id = ? AND gacha_tickets > 0 RETURNING name`,
      args: [observer.id],
    });
    if (ticketResult.rows.length === 0) throw new Error('No tickets');

    const titleResult = await transaction.execute({
      sql: `INSERT INTO observer_titles (observer_id, name, is_rare) VALUES (?, ?, ?) ON CONFLICT(observer_id, name) DO NOTHING RETURNING id`,
      args: [observer.id, title.name, title.rarity !== 'N' ? 1 : 0],
    });

    const isDuplicate = titleResult.rows.length === 0;
    let pointsGained = 0;
    if (isDuplicate) {
      if (title.rarity === 'N') pointsGained = 1;
      else if (title.rarity === 'R') pointsGained = 3;
      else pointsGained = 10;

      await transaction.execute({
        sql: `UPDATE observers SET points = points + ? WHERE id = ?`,
        args: [pointsGained, observer.id],
      });
    }

    await transaction.execute({
      sql: `INSERT INTO gacha_history (observer_name, title_name) VALUES (?, ?)`,
      args: [ticketResult.rows[0].name, title.name],
    });

    return { title, isDuplicate, pointsGained };
  });

  revalidatePath('/gacha');
  revalidatePath(`/observers/${observer.id}`);

  return result;
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

export async function createObserverRecoveryCode(observerId) {
  if (!(await isAdmin())) throw new Error('Unauthorized');

  const observerResult = await db.execute({
    sql: 'SELECT id, name FROM observers WHERE id = ?',
    args: [observerId],
  });
  const observer = observerResult.rows[0];
  if (!observer) throw new Error('Observer not found');

  const code = crypto.randomBytes(32).toString('base64url');
  const codeHash = recoveryCodeHash(code);

  await withTransaction(async (transaction) => {
    await transaction.execute({
      sql: `UPDATE observer_recovery_codes SET used_at = CURRENT_TIMESTAMP WHERE observer_id = ? AND used_at IS NULL`,
      args: [observer.id],
    });
    await transaction.execute({
      sql: `INSERT INTO observer_recovery_codes (observer_id, code_hash, expires_at) VALUES (?, ?, datetime('now', '+30 minutes'))`,
      args: [observer.id, codeHash],
    });
  });

  return { code, observerName: observer.name };
}

export async function getRecoveryCodeInfo(code) {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{40,64}$/.test(code)) return null;

  const result = await db.execute({
    sql: `
      SELECT o.id AS observer_id, o.name
      FROM observer_recovery_codes r
      JOIN observers o ON o.id = r.observer_id
      WHERE r.code_hash = ? AND r.used_at IS NULL AND r.expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `,
    args: [recoveryCodeHash(code)],
  });
  return result.rows[0] || null;
}

export async function recoverObserver(code) {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{40,64}$/.test(code)) {
    throw new Error('Invalid recovery code');
  }

  const currentObserver = await getCurrentObserver();

  const observer = await withTransaction(async (transaction) => {
    const recoveryResult = await transaction.execute({
      sql: `
        SELECT observer_id
        FROM observer_recovery_codes
        WHERE code_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
        LIMIT 1
      `,
      args: [recoveryCodeHash(code)],
    });
    if (recoveryResult.rows.length === 0) throw new Error('Recovery code is invalid or expired');

    const observerId = recoveryResult.rows[0].observer_id;
    if (currentObserver && currentObserver.id !== observerId) {
      throw new Error('Another observer is already registered in this browser');
    }

    const claimed = await transaction.execute({
      sql: `
        UPDATE observer_recovery_codes
        SET used_at = CURRENT_TIMESTAMP
        WHERE code_hash = ? AND observer_id = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
        RETURNING observer_id
      `,
      args: [recoveryCodeHash(code), observerId],
    });
    if (claimed.rows.length === 0) throw new Error('Recovery code is invalid or expired');

    const result = await transaction.execute({
      sql: 'SELECT token FROM observers WHERE id = ?',
      args: [observerId],
    });
    if (result.rows.length === 0) throw new Error('Observer not found');
    return result.rows[0];
  });

  const cookieStore = await cookies();
  cookieStore.set(OBSERVER_COOKIE_NAME, observer.token, observerCookieOptions());
  redirect('/');
}
