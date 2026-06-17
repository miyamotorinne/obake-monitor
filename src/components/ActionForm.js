'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function ActionForm({ action, children, className }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function clientAction(formData) {
    // サーバーアクションの実行
    await action(formData);
    // 実行完了後にクライアントサイドルーターを強制リフレッシュし、最新データを取得
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form action={clientAction} className={className}>
      {children}
    </form>
  );
}
