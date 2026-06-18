import { getDashboardData, recordBath, recordOut, addReaction, addQuest, completeQuest, deleteQuest, logout } from './actions';
import Link from 'next/link';
import ActionForm from '@/components/ActionForm';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

function getRelativeTime(dateString) {
  if (!dateString) return '記録なし';
  const date = new Date(dateString.replace(' ', 'T') + 'Z');
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}日前`;
  if (diffHours > 0) return `${diffHours}時間前`;
  if (diffMins > 0) return `${diffMins}分前`;
  return 'たった今';
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString.replace(' ', 'T') + 'Z');
  return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default async function Home() {
  const data = await getDashboardData();

  async function handleAddQuest(formData) {
    'use server';
    const content = formData.get('content');
    const authorName = formData.get('author_name');
    if (content && authorName) {
      await addQuest(content, authorName);
    }
  }

  return (
    <main>
      <div className="status-box">
        <div className="status-title">現在の状態</div>
        <div className="status-value">{data.state}</div>
      </div>

      <div className="section text-sm text-[#888] mb-8">
        <div>最終入浴: {getRelativeTime(data.lastBath)}</div>
        <div>最終外出: {getRelativeTime(data.lastOut)}</div>
      </div>

      <div className="section flex gap-4">
        <ActionForm action={addReaction.bind(null, 'monitor')}>
          <button type="submit" className="reaction-btn">
            <span className="reaction-emoji">👁️</span>
            <span className="reaction-count">監視中 {data.reactions.monitor}</span>
          </button>
        </ActionForm>
        <ActionForm action={addReaction.bind(null, 'survival')}>
          <button type="submit" className="reaction-btn">
            <span className="reaction-emoji">👍</span>
            <span className="reaction-count">生存確認 {data.reactions.survival}</span>
          </button>
        </ActionForm>
        <ActionForm action={addReaction.bind(null, 'bath')}>
          <button type="submit" className="reaction-btn">
            <span className="reaction-emoji">🧼</span>
            <span className="reaction-count">風呂入れ {data.reactions.bath}</span>
          </button>
        </ActionForm>
      </div>

      <div className="section">
        <h2 className="section-title">未達成クエスト</h2>
        {data.pendingQuests.length === 0 && <p className="text-[#666] text-sm">現在クエストはありません</p>}
        {data.pendingQuests.map(q => (
          <div key={q.id} className="quest-item">
            <div>{q.content}</div>
            <div className="quest-meta flex justify-between">
              <span>by {q.author_name} ({formatDate(q.created_at)})</span>
              {data.admin && (
                <div className="flex gap-2">
                  <ActionForm action={completeQuest.bind(null, q.id)}>
                    <button type="submit" className="text-xs">達成</button>
                  </ActionForm>
                  <ActionForm action={deleteQuest.bind(null, q.id)}>
                    <button type="submit" className="text-xs text-[#844]">削除</button>
                  </ActionForm>
                </div>
              )}
            </div>
          </div>
        ))}

        <ActionForm action={handleAddQuest} className="mt-6 flex flex-col gap-2 p-4 border border-[#222]">
          <div className="text-sm text-[#888]">クエストを追加</div>
          <input type="text" name="content" placeholder="内容 (例: 散歩しろ)" required maxLength={100} />
          <input type="text" name="author_name" placeholder="作成者名" required maxLength={20} />
          <button type="submit" className="w-fit">送信</button>
        </ActionForm>
      </div>

      {data.completedQuests.length > 0 && (
        <details className="section">
          <summary className="section-title border-none mb-0 inline-block">達成済みクエスト ({data.completedQuests.length})</summary>
          <div className="mt-4 opacity-50">
            {data.completedQuests.map(q => (
              <div key={q.id} className="quest-item border-[#222]">
                <div className="line-through">{q.content}</div>
                <div className="quest-meta">
                  by {q.author_name} (達成: {formatDate(q.completed_at)})
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {data.admin ? (
        <div className="admin-controls">
          <div className="text-sm text-[#888] mb-4">管理者メニュー</div>
          <div className="flex gap-4 mb-4">
            <ActionForm action={recordBath}>
              <button type="submit">風呂入った</button>
            </ActionForm>
            <ActionForm action={recordOut}>
              <button type="submit">外出した</button>
            </ActionForm>
          </div>
          <ActionForm action={logout}>
            <button type="submit" className="text-xs">ログアウト</button>
          </ActionForm>
        </div>
      ) : (
        <div className="mt-12 text-center text-xs">
          <Link href="/login" className="text-[#333] hover:text-[#666] border-none">π</Link>
        </div>
      )}
    </main>
  );
}
