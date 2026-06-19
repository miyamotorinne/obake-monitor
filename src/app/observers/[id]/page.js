import { getObserverById, getCurrentObserver, getObserverTitles, setFavoriteTitle } from '@/app/actions';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ActionForm from '@/components/ActionForm';
import SubmitButton from '@/components/SubmitButton';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString.replace(' ', 'T') + 'Z');
  return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default async function ObserverProfilePage({ params }) {
  const { id } = await params;
  const currentObserver = await getCurrentObserver();
  const observer = await getObserverById(id);

  if (!observer) {
    notFound();
  }

  const titles = await getObserverTitles(id);
  const isOwner = currentObserver?.id === observer.id;
  const rareTitleCount = titles.filter(t => t.is_rare).length;

  return (
    <main>
      <div className="mb-8 text-xs">
        <Link href="/observers" className="text-[#888] hover:text-[#aaa] border-none tracking-widest">{'< 名簿に戻る'}</Link>
      </div>

      <div className="section border border-[#333] p-6 relative overflow-hidden">
        {/* 背景の装飾 */}
        <div className="absolute top-0 right-0 p-4 text-[10px] text-[#222] font-mono select-none">
          OBSERVER_PROFILE_DATA
        </div>
        
        <h2 className="text-2xl font-bold mb-2">{observer.name}</h2>
        <div className="text-sm text-[#aaa] mb-8 border-b border-[#333] pb-4">
          {observer.favorite_title ? `【${observer.favorite_title}】` : '【称号未設定】'}
        </div>
        
        <div className="flex flex-col gap-6 text-sm">
          <div className="flex justify-between border-b border-[#222] pb-2">
            <span className="text-[#888]">観測ポイント</span>
            <span className="font-mono">{observer.points} pt</span>
          </div>
          
          <div className="flex flex-col gap-3 border-b border-[#222] pb-4">
            <div className="flex justify-between">
              <span className="text-[#888]">称号一覧 ({titles.length})</span>
            </div>
            
            {titles.length === 0 ? (
              <span className="text-[#555] italic">現在なし</span>
            ) : (
              <div className="flex flex-col gap-2">
                {titles.map(title => {
                  const isPointTitle = ['見習い観測者', '漂流者', '観測者', '監視員', '干渉者', '世界改変者'].includes(title.name);
                  const titleColor = isPointTitle ? 'text-[#58a]' : (title.is_rare ? 'text-[#a66]' : 'text-[#ccc]');
                  
                  return (
                    <div key={title.id} className="flex justify-between items-center bg-[#0a0a0a] p-2 border border-[#111]">
                      <span className={titleColor}>
                        {title.name} {title.is_rare ? '★' : ''}
                      </span>
                    {isOwner && observer.favorite_title !== title.name && (
                      <ActionForm action={setFavoriteTitle.bind(null, title.name)}>
                        <SubmitButton className="text-[10px] px-2 py-1 bg-transparent border border-[#333] hover:border-[#666]">
                          お気に入りにする
                        </SubmitButton>
                      </ActionForm>
                    )}
                    {isOwner && observer.favorite_title === title.name && (
                      <span className="text-[10px] text-[#666] px-2">お気に入り</span>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
            

          </div>
          
          <div className="flex justify-between border-b border-[#222] pb-2">
            <span className="text-[#888]">レア称号数</span>
            <span className="font-mono">{rareTitleCount}</span>
          </div>

          <div className="flex justify-between border-b border-[#222] pb-2">
            <span className="text-[#888]">観測開始日</span>
            <span className="font-mono">{formatDate(observer.created_at)}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
