import Link from 'next/link';
import SubmitButton from '@/components/SubmitButton';
import { getCurrentObserver, getRecoveryCodeInfo, recoverObserver } from '@/app/actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

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
          <p className="text-sm text-[#888] mb-8 leading-relaxed">
            このブラウザには観測者「{currentObserver.name}」のデータが登録済みです。<br />
            既存データを守るため、別の観測者で上書きすることはできません。
          </p>
          <Link href="/">トップへ戻る</Link>
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
