'use client';

import { useState } from 'react';
import { createObserverRecoveryCode } from '@/app/actions';

export default function RecoveryLinkButton({ observerId }) {
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);

  async function createLink() {
    setPending(true);
    setStatus('');
    try {
      const result = await createObserverRecoveryCode(observerId);
      setLink(`${window.location.origin}/recover/${result.code}`);
    } catch {
      setStatus('復旧リンクを発行できませんでした');
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setStatus('コピーしました（30分間・1回のみ有効）');
    } catch {
      setStatus('下のリンクを手動でコピーしてください');
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={createLink}
        disabled={pending}
        className="text-[10px] px-3 py-1 bg-[#111] hover:bg-[#222] border border-[#333]"
      >
        {pending ? '発行中...' : '復旧リンクを発行'}
      </button>
      {link && (
        <div className="flex max-w-full gap-2">
          <input
            type="text"
            readOnly
            value={link}
            aria-label="復旧リンク"
            className="max-w-[280px] text-[10px]"
          />
          <button type="button" onClick={copyLink} className="text-[10px] px-2 py-1">
            コピー
          </button>
        </div>
      )}
      {status && <div className="text-[10px] text-[#888]">{status}</div>}
    </div>
  );
}
