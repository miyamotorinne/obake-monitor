import { getCurrentObserver, getGachaHistory } from '@/app/actions';
import Link from 'next/link';
import GachaClient from './GachaClient';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString.replace(' ', 'T') + 'Z');
  return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default async function GachaPage() {
  const currentObserver = await getCurrentObserver();
  const history = await getGachaHistory();

  return (
    <main>
      <div className="mb-8 text-xs">
        <Link href="/" className="text-[#888] hover:text-[#aaa] border-none tracking-widest">{'< 戻る'}</Link>
      </div>

      <div className="section text-center mb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 text-[10px] text-[#222] font-mono select-none">
          GACHA_SYSTEM_ACTIVE
        </div>

        <h2 className="section-title mb-8 border-none tracking-[0.3em]">観測ガチャ</h2>
        
        {currentObserver ? (
          <div className="mb-8">
            <div className="text-sm text-[#888] mb-2">ガチャ券</div>
            <div className="text-3xl font-mono mb-8">{currentObserver.gacha_tickets} <span className="text-sm">枚</span></div>
            <GachaClient hasTickets={currentObserver.gacha_tickets > 0} />
          </div>
        ) : (
          <div className="text-sm text-[#888] mb-8">
            ガチャを引くには観測者として登録してください。<br />
            （トップページから登録可能です）
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="text-sm text-[#666] mb-4 border-b border-[#222] pb-2">最近の獲得履歴</h3>
        <div className="flex flex-col gap-2 text-xs">
          {history.length === 0 ? (
            <div className="text-[#444] italic">記録がありません</div>
          ) : (
            history.map(h => (
              <div key={h.id} className="flex justify-between p-2 border-b border-[#111]">
                <div>
                  <span className="text-[#888]">{h.observer_name}</span> が <span className="text-[#aaa]">【{h.title_name}】</span> を発見
                </div>
                <div className="text-[#555] font-mono">{formatDate(h.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
