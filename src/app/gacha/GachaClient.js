'use client';

import { useState } from 'react';
import { rollGacha } from '@/app/actions';

export default function GachaClient({ hasTickets }) {
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleRoll() {
    setRolling(true);
    setResult(null);
    setError(null);

    // Wait ~1s for animation
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      const res = await rollGacha();
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setRolling(false);
    }
  }

  return (
    <div className="flex flex-col items-center min-h-[150px]">
      {!rolling && !result && (
        <button 
          onClick={handleRoll} 
          disabled={!hasTickets}
          className={`px-8 py-3 rounded text-sm tracking-widest transition-all ${
            hasTickets 
              ? 'bg-[#111] hover:bg-[#222] border border-[#444] text-[#eee] active:scale-95' 
              : 'bg-transparent border border-[#222] text-[#444] cursor-not-allowed'
          }`}
        >
          回す
        </button>
      )}

      {rolling && (
        <div className="text-sm tracking-widest text-[#888] animate-pulse my-auto">
          観測中...
        </div>
      )}

      {error && (
        <div className="text-sm text-[#a55] mt-4">
          エラー: {error}
        </div>
      )}

      {result && !rolling && (
        <div className="p-6 border border-[#333] bg-[#0a0a0a] min-w-[250px] text-center transition-opacity duration-500 opacity-100">
          <div className="text-xs text-[#666] mb-4">結果</div>
          
          {result.title.rarity === 'SSR' && (
            <div className="text-xs text-[#a55] font-mono mb-4 animate-pulse">
              ■■■異常観測■■■
            </div>
          )}

          <div className={`text-xl font-bold mb-4 ${
            result.title.rarity === 'SSR' ? 'text-[#a55]' : 
            result.title.rarity === 'R' ? 'text-[#88a]' : 'text-[#eee]'
          }`}>
            {result.title.name}
          </div>

          {result.isDuplicate ? (
            <div className="text-xs text-[#888]">
              所持済みのため <span className="text-[#aaa]">+{result.pointsGained}pt</span> に変換されました
            </div>
          ) : (
            <div className="text-xs text-[#aaa]">
              新しい称号を獲得しました！
            </div>
          )}

          <button 
            onClick={() => setResult(null)} 
            className="mt-6 px-4 py-2 border border-[#222] rounded text-xs text-[#888] hover:bg-[#111] hover:text-[#aaa] transition-all"
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}
