import Link from 'next/link';
import SubmitButton from '@/components/SubmitButton';
import {
  getCurrentObserver,
  getRecoveryCodeInfo,
  recoverObserver,
  switchObserverWithRecovery,
} from '@/app/actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function formatRegistrationDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString.replace(' ', 'T') + 'Z');
  return date.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default async function RecoverObserverPage({ params }) {
  const { code } = await params;
  const [recovery, currentObserver] = await Promise.all([
    getRecoveryCodeInfo(code),
    getCurrentObserver(),
  ]);

  if (!recovery) {
    return (
      <main className="mt-20">
        <div className="section text-center">
          <h1 className="section-title">観測者データの復旧</h1>
          <p className="text-sm text-[#888] mb-8">
            この復旧リンクは無効、使用済み、または期限切れです。
          </p>
          <Link href="/">トップへ戻る</Link>
        </div>
      </main>
    );
  }

  if (currentObserver && currentObserver.id !== recovery.observer_id) {
    return (
      <main className="mt-20">
        <div className="section text-center">
          <h1 className="section-title">観測者データの復旧</h1>
          <div className="text-sm text-left border border-[#222] p-4 mb-6 leading-relaxed">
            <div className="mb-3">
              <span className="text-[#666]">現在の観測者：</span>
              {currentObserver.name}（登録: {formatRegistrationDate(currentObserver.created_at)}）
            </div>
            <div>
              <span className="text-[#666]">復旧する観測者：</span>
              {recovery.name}（登録: {formatRegistrationDate(recovery.created_at)}）
            </div>
          </div>
          <p className="text-xs text-[#888] mb-6 leading-relaxed">
            このブラウザの接続先だけを復旧する観測者へ切り替えます。<br />
            現在の観測者や、ほかの観測者のDBデータは削除されません。
          </p>
          <form action={switchObserverWithRecovery.bind(null, code)}>
            <SubmitButton pendingText="切り替え中...">現在の登録を解除して復旧する</SubmitButton>
          </form>
          <div className="mt-8 text-xs">
            <Link href="/">キャンセルしてトップへ戻る</Link>
          </div>
          <p className="text-[10px] text-[#555] mt-6">リンクは30分間・1回のみ有効です。</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mt-20">
      <div className="section text-center">
        <h1 className="section-title">観測者データの復旧</h1>
        <p className="text-sm text-[#888] mb-8 leading-relaxed">
          観測者「{recovery.name}」の既存データを<br />
          このブラウザで使えるようにします。
        </p>
        <form action={recoverObserver.bind(null, code)}>
          <SubmitButton pendingText="復旧中...">この観測者データを復旧する</SubmitButton>
        </form>
        <p className="text-[10px] text-[#555] mt-6">リンクは30分間・1回のみ有効です。</p>
      </div>
    </main>
  );
}
