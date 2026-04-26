import { useState, useEffect } from 'react';
import type { Word } from '../types/word';
import { formatNextReview } from '../utils/reviewSchedule';
import { getGrowthIcon } from '../utils/wordIcon';

type Filter = 'all' | 'starred' | 'learning';
type SortKey = 'default' | 'nextReview' | 'learnedAt';

type Props = {
  words: Word[];
  onSelectWord: (id: string, navIds: string[]) => void;
  onOpenAddWord: () => void;
};

export default function WordListPage({ words, onSelectWord, onOpenAddWord }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortKey>('default');

  const hasLearning = words.some(w => w.status === 'learning');
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!hasLearning) return;
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [hasLearning]);

  const filtered = words.filter(w => {
    if (filter === 'starred') return !!w.starred;
    if (filter === 'learning') return w.status === 'learning' || w.status === 'overdue';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'nextReview') {
      const at = a.nextReviewAt ?? Infinity;
      const bt = b.nextReviewAt ?? Infinity;
      return at - bt;
    }
    if (sort === 'learnedAt') {
      const al = a.learnedAt ?? 0;
      const bl = b.learnedAt ?? 0;
      return al - bl;
    }
    return 0;
  });

  // 単元ごとにグループ化（ソート後の順序を維持）
  const byStation = new Map<number, Word[]>();
  for (const w of sorted) {
    if (!byStation.has(w.station)) byStation.set(w.station, []);
    byStation.get(w.station)!.push(w);
  }
  const stationNums = Array.from(byStation.keys()).sort((a, b) => a - b);

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#FFF9F0' }}>
      {/* ヘッダー */}
      <div className="px-4 pt-8 pb-3">
        <h1 className="text-xl font-bold" style={{ color: '#333' }}>かんじリスト</h1>
        <p className="text-sm mt-0.5" style={{ color: '#888' }}>{sorted.length} / {words.length}もじ</p>
      </div>

      {/* フィルター */}
      <div className="px-4 pb-2 flex gap-2">
        {(['all', 'starred', 'learning'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-95"
            style={{
              backgroundColor: filter === f ? '#FF8A80' : '#F0F0F0',
              color: filter === f ? '#FFF' : '#888',
            }}
          >
            {f === 'all' ? 'ぜんぶ' : f === 'starred' ? '⭐ おきにいり' : 'がくしゅうちゅう'}
          </button>
        ))}
      </div>

      {/* ソート */}
      <div className="px-4 pb-3 flex gap-2 items-center">
        <span className="text-xs" style={{ color: '#AAA' }}>ならびかえ:</span>
        {([
          ['default', 'デフォルト'],
          ['nextReview', 'つぎの ふくしゅうじゅん'],
          ['learnedAt', 'がくしゅうび じゅん'],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-95"
            style={{
              backgroundColor: sort === key ? '#A0CA5A' : '#F0F0F0',
              color: sort === key ? '#FFF' : '#888',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* リスト */}
      <div className="flex-1 px-3 pb-8 flex flex-col gap-4">
        {/* マイかんじを追加ボタン（常時表示） */}
        <button
          onClick={onOpenAddWord}
          className="w-full rounded-2xl font-medium active:scale-95 transition-all"
          style={{
            padding: '10px',
            backgroundColor: '#FFF',
            border: '2px dashed #FF8A80',
            color: '#FF8A80',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ＋ マイかんじを ついか
        </button>

        {sorted.length === 0 && (
          <div className="text-center py-12" style={{ color: '#BBB' }}>
            <div className="text-4xl mb-2">🥚</div>
            <p className="text-sm">あてはまる かんじが ありません</p>
          </div>
        )}
        {stationNums.map(s => {
          const ws = byStation.get(s)!;
          const stationName = ws[0]?.station_name ?? '';
          const isCustomSection = s === 0;
          return (
            <div key={s}>
              {/* 単元ヘッダー */}
              <div className="flex items-center gap-1 mb-1.5 px-1">
                <span className="text-xs font-bold" style={{ color: isCustomSection ? '#FF8A80' : '#AAA' }}>
                  {isCustomSection ? `✏️ ${stationName}` : `ステージ${s}`}
                </span>
              </div>
              {/* 3列グリッド */}
              <div className="grid grid-cols-3 gap-1.5">
                {ws.map(w => {
                  const icon = getGrowthIcon(w);
                  const isUnlearned = w.status === 'unlearned';
                  return (
                    <button
                      key={w.id}
                      onClick={() => onSelectWord(w.id, sorted.map(x => x.id))}
                      className="rounded-xl px-2 py-1.5 text-left active:scale-95 transition-all"
                      style={{
                        backgroundColor: '#FFF',
                        border: `1px solid ${w.starred ? '#FFD700' : w.isCustom ? '#FFB0B0' : isUnlearned ? '#EEE' : '#FFD8D8'}`,
                      }}
                    >
                      {/* 日本語 + アイコン */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium truncate" style={{ fontSize: 13, color: '#333' }}>
                          {w.starred ? '★ ' : ''}{w.customFront ?? w.front}
                        </span>
                        <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                      </div>
                      {/* 英語 + 次の復習 */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate" style={{ fontSize: 11, color: '#E55757' }}>{w.back}</span>
                        {!isUnlearned && (
                          <span style={{ fontSize: 10, color: '#CCC', flexShrink: 0 }}>
                            {formatNextReview(w.nextReviewAt)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
