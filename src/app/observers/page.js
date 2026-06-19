import { getObservers, getCurrentObserver, isAdmin, giveGachaTicketToObserver } from '@/app/actions';
import Link from 'next/link';
import { titlesData } from '@/lib/titles';
import ActionForm from '@/components/ActionForm';
import SubmitButton from '@/components/SubmitButton';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString.replace(' ', 'T') + 'Z');
  return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default async function ObserversPage() {
  const currentObserver = await getCurrentObserver();
  const observers = await getObservers();
  const admin = await isAdmin();

  return (
    <main>
      <div className="mb-8 text-xs flex justify-between">
        <Link href="/" className="text-[#888] hover:text-[#aaa] border-none tracking-widest">{'< 戻る'}</Link>
        <Link href="/gacha" className="text-[#888] hover:text-[#aaa] border-none tracking-widest">[ 観測ガチャ ]</Link>
      </div>

      <div className="section">
        <h2 className="section-title mb-6">観測者名簿</h2>
        <div className="flex flex-col gap-4">
          {observers.map(obs => {
            const isPointTitle = ['見習い観測者', '漂流者', '観測者', '監視員', '干渉者', '世界改変者'].includes(obs.favorite_title);
            const gachaTitle = titlesData.find(t => t.name === obs.favorite_title);
            const isRare = gachaTitle && gachaTitle.rarity !== 'N';
            
            const titleColor = !obs.favorite_title ? 'text-[#555]' : 
                               isPointTitle ? 'text-[#58a]' : 
                               isRare ? 'text-[#a66]' : 'text-[#ccc]';

            return (
              <div key={obs.id} className="block p-4 border border-[#222] hover:border-[#444] transition-colors border-none-hover">
                <Link href={`/observers/${obs.id}`} className="no-underline block">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-lg font-bold">
                      {obs.name}
                      {currentObserver?.id === obs.id && <span className="ml-2 text-xs text-[#888] font-normal">(あなた)</span>}
                    </div>
                    <div className="text-xs text-[#666]">登録: {formatDate(obs.created_at)}</div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className={titleColor}>{obs.favorite_title ? `【${obs.favorite_title}】${isRare ? ' ★' : ''}` : '【称号未設定】'}</span>
                    <span className="font-mono text-[#888]">{obs.points} pt</span>
                  </div>
                </Link>
                {admin && (
                  <div className="mt-4 pt-4 border-t border-[#222] flex justify-end">
                    <ActionForm action={giveGachaTicketToObserver.bind(null, obs.id)}>
                      <SubmitButton className="text-[10px] px-3 py-1 bg-[#111] hover:bg-[#222] border border-[#333]">
                        ガチャ券を1枚配る
                      </SubmitButton>
                    </ActionForm>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
