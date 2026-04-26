import { useState, useCallback } from 'react';
import type { Word } from '../types/word';
import { isWordMastered } from '../utils/reviewSchedule';
import { getAllStations } from '../utils/stationProgress';

type Props = {
  words: Word[];
  onSkip: (id: string) => void;
  onUnskip: (id: string) => void;
  onComplete: () => void;
  canSkipAll?: boolean;
  onBack?: () => void;
  currentStation?: number;
  tutorialHintWordId?: string; // ⑤ チュートリアル中に指定単語をハイライト
};

type Petal = { id: number; x: number; y: number; angle: number; scale: number; dx: number; dy: number };

let petalId = 0;

export default function SetupPage({ words, onSkip, onUnskip, onComplete, onBack, currentStation = 1, tutorialHintWordId }: Props) {
  const okCount = words.filter(w => isWordMastered(w)).length;

  // 単元ごとにグループ化
  const wordsByStation = new Map<number, Word[]>();
  for (const w of words) {
    if (!wordsByStation.has(w.station)) wordsByStation.set(w.station, []);
    wordsByStation.get(w.station)!.push(w);
  }
  const allStations = getAllStations(words);
  const [petals, setPetals] = useState<Petal[]>([]);
  const [greatPos, setGreatPos] = useState<{ x: number; y: number } | null>(null);
  const [previewWord, setPreviewWord] = useState<Word | null>(null);
  // 完了単元のアコーディオン開閉状態（デフォルト閉じ）
  const [openStations, setOpenStations] = useState<Set<number>>(new Set());
  function toggleStation(s: number) {
    setOpenStations(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }
  const longPressTimer = useState<{ current: ReturnType<typeof setTimeout> | null }>(() => ({ current: null }))[0];

  const spawnPetals = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const newPetals: Petal[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * 360;
      const dist = 40 + Math.random() * 80;
      const rad = (angle * Math.PI) / 180;
      newPetals.push({
        id: ++petalId,
        x: cx,
        y: cy,
        angle: Math.random() * 360,
        scale: 0.6 + Math.random() * 0.6,
        dx: Math.cos(rad) * dist,
        dy: Math.sin(rad) * dist - 30,
      });
    }
    setPetals(prev => [...prev, ...newPetals]);
    setTimeout(() => {
      setPetals(prev => prev.filter(p => !newPetals.includes(p)));
    }, 800);
  }, []);

  function handleOK(e: React.MouseEvent | React.TouchEvent, id: string) {
    spawnPetals(e);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setGreatPos({ x: rect.left + rect.width / 2, y: rect.top });
    setTimeout(() => setGreatPos(null), 700);
    onSkip(id);
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#FFF9F0' }}>
      {/* グレート演出 */}
      {greatPos && (
        <div
          className="fixed pointer-events-none"
          style={{
            zIndex: 60,
            left: greatPos.x,
            top: greatPos.y - 40,
            transform: 'translateX(-50%)',
          }}
        >
          <div
            className="text-2xl font-black"
            style={{
              color: '#FFB600',
              textShadow: '0 2px 4px rgba(0,0,0,0.7), 0 4px 12px rgba(0,0,0,0.4), 0 0 20px rgba(255,182,0,0.3)',
              animation: 'great-pop 0.7s ease-out forwards',
            }}
          >
            🌟 Great! 🌟
          </div>
        </div>
      )}

      {/* 花びらパーティクル */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 50 }}>
        {petals.map(p => (
          <div
            key={p.id}
            className="absolute"
            style={{
              left: p.x,
              top: p.y,
              fontSize: `${14 * p.scale}px`,
              transform: `translate(-50%, -50%) rotate(${p.angle}deg)`,
              filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))',
              animation: 'petal-burst 0.8s ease-out forwards',
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
            } as React.CSSProperties}
          >
            🌟
          </div>
        ))}
      </div>

      {/* ヘッダー */}
      <div className="px-4 pt-8 pb-2">
        <div className="flex items-center justify-between mb-3">
          {onBack ? (
            <button onClick={onBack} className="text-sm" style={{ color: '#888' }}>← 戻る</button>
          ) : (
            <div className="w-12" />
          )}
          <h1 className="text-xl font-bold" style={{ color: '#333' }}>🥚 いっかつ せってい</h1>
          <div className="w-12" />
        </div>
        {/* モンスター吹き出し */}
        <div className="flex items-start gap-2 mt-1">
          <div
            aria-label="モンスター"
            style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, backgroundColor: '#FFF9F0' }}
          >
            🥚
          </div>
          {/* 吹き出し */}
          <div className="relative flex-1">
            {/* 左の三角 */}
            <div style={{
              position: 'absolute', left: -7, top: 14,
              width: 0, height: 0,
              borderTop: '6px solid transparent',
              borderBottom: '6px solid transparent',
              borderRight: '7px solid #FF8A80',
            }} />
            <div className="rounded-2xl p-3" style={{ border: '2px solid #FF8A80', backgroundColor: '#FFF' }}>
              <p className="text-sm" style={{ color: '#555' }}>
                この がめんは もう よめる かんじを まとめて スキップする ための がめんだよ。
              </p>
              <p className="text-xs mt-1" style={{ color: '#E05050' }}>
                スキップすると ふくしゅうしないので、ふつうの がくしゅうでは つかわないでね
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 単語グリッド（単元ごと） */}
      <div className="flex-1 px-2 py-2 flex flex-col gap-4">
        {allStations.map(s => {
          const ws = wordsByStation.get(s);
          if (!ws || ws.length === 0) return null;
          // 一度でも学習が始まった単元（learnedAt あり）は再ロックしない
          const neverStarted = ws.every(w => w.learnedAt === null);
          const isLocked = neverStarted && s > currentStation;
          const isCurrent = s === currentStation;
          const isComplete = ws.every(w => isWordMastered(w));
          const isOpen = !isComplete || openStations.has(s);

          return (
            <div key={s}>
              {/* 単元ヘッダー */}
              <div
                className="flex items-center gap-2 px-1 mb-2"
                style={{ cursor: isComplete ? 'pointer' : 'default' }}
                onClick={() => isComplete && toggleStation(s)}
              >
                <span className="text-xs font-bold" style={{ color: isCurrent ? '#D32F2F' : isLocked ? '#CCC' : '#AAA' }}>
                  ステージ{s}
                </span>
                {isLocked && <span style={{ fontSize: 12 }}>🔒</span>}
                {isComplete && <span style={{ fontSize: 12 }}>🌟</span>}
                {isComplete && (
                  <span style={{ fontSize: 11, color: '#AAA', marginLeft: 'auto' }}>
                    {isOpen ? '▲' : '▼'}
                  </span>
                )}
              </div>

              {/* ロック単元：単語非表示 / 完了単元：アコーディオン */}
              {isLocked ? (
                <div
                  className="rounded-xl p-4 text-center"
                  style={{ backgroundColor: '#F5F5F5', border: '1px solid #EEE' }}
                >
                  <p style={{ fontSize: 12, color: '#BBB' }}>
                    🔒 まえの 単元を すべて クリアすると あけますよ
                  </p>
                </div>
              ) : !isOpen ? null : (
                <div className="grid grid-cols-3 gap-1.5" style={{ overflow: 'visible' }}>
                  {ws.map(w => {
                    const isOK = isWordMastered(w);
                    const isHinted = !isOK && w.id === tutorialHintWordId;

                    function startLongPress(e: React.TouchEvent | React.PointerEvent) {
                      e.preventDefault();
                      longPressTimer.current = setTimeout(() => {
                        setPreviewWord(w);
                        longPressTimer.current = null;
                      }, 500);
                    }
                    function cancelLongPress() {
                      if (longPressTimer.current) {
                        clearTimeout(longPressTimer.current);
                        longPressTimer.current = null;
                      }
                    }
                    function handleClick(e?: React.MouseEvent) {
                      if (previewWord) return;
                      if (isOK) {
                        onUnskip(w.id);
                      } else if (e) {
                        handleOK(e, w.id);
                      }
                    }

                    return isOK ? (
                      <button
                        key={w.id}
                        onClick={() => handleClick()}
                        onTouchStart={startLongPress}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                        onContextMenu={e => e.preventDefault()}
                        className="rounded-lg px-2 py-3 text-center active:scale-95 transition-all"
                        style={{ backgroundColor: '#F0FAF0', border: '2px solid #A0CA5A', WebkitTouchCallout: 'none', userSelect: 'none' }}
                      >
                        <div className="font-bold text-sm truncate" style={{ color: '#4CAF50' }}>
                          🌟 {w.back}
                        </div>
                      </button>
                    ) : (
                      <div key={w.id} className="relative" style={{ overflow: 'visible' }}>
                        {/* ⑤ チュートリアルヒント */}
                        {isHinted && (
                          <div
                            className="absolute animate-bounce pointer-events-none"
                            style={{ bottom: '105%', left: '50%', transform: 'translateX(-50%)', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#D32F2F', lineHeight: 1, whiteSpace: 'nowrap' }}
                          >
                            <span style={{ fontSize: 9, fontWeight: 700 }}>ここをタップ</span>
                            <span style={{ fontSize: 12 }}>↓</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => handleClick(e)}
                          onTouchStart={startLongPress}
                          onTouchEnd={cancelLongPress}
                          onTouchMove={cancelLongPress}
                          onContextMenu={e => e.preventDefault()}
                          className="w-full rounded-lg px-2 py-3 text-center active:scale-95 transition-all"
                          style={{ backgroundColor: '#FFF', border: `2px solid ${isHinted ? '#D32F2F' : '#FF8A80'}`, WebkitTouchCallout: 'none', userSelect: 'none' }}
                        >
                          <div className="font-bold text-sm truncate" style={{ color: '#333' }}>
                            {(() => {
                              if (w.status === 'overdue') return '💔 ';
                              if (w.status === 'learning') {
                                return (w.sm2Repetition ?? 0) === 0 ? '❌ ' : '🌱 ';
                              }
                              return '';
                            })()}{w.front}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 長押しプレビュー */}
      {previewWord && (
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{ zIndex: 100, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setPreviewWord(null)}
        >
          <div
            className="w-full rounded-3xl shadow-lg p-6 text-center"
            style={{ backgroundColor: '#FFF', maxWidth: 300 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-2xl font-bold mb-1" style={{ color: '#333' }}>
              {previewWord.front}
            </div>
            <div className="text-xl font-bold mb-1" style={{ color: '#E55757' }}>
              {previewWord.back}
            </div>
            <div className="text-base mb-3" style={{ color: '#888' }}>
              ステージ{previewWord.station}
            </div>
            <button
              onClick={() => setPreviewWord(null)}
              className="px-6 py-2 rounded-2xl font-medium text-sm active:scale-95 transition-all"
              style={{ backgroundColor: '#FF8A80', color: '#FFF' }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 完了ボタン */}
      <div className="px-4 pb-24 pt-3 sticky bottom-0" style={{ backgroundColor: '#FFF9F0' }}>
        <p className="text-xs text-center mb-2" style={{ color: '#BBB' }}>💡 ながおしで こたえを みる</p>
        <button
          onClick={onComplete}
          className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-md active:scale-95 transition-all"
          style={{ backgroundColor: '#FF8A80' }}
        >
          {okCount > 0 ? `せってい かんりょう（${okCount}もじ OK）→ ホームへ` : 'せってい かんりょう → ホームへ'}
        </button>
      </div>
    </div>
  );
}
