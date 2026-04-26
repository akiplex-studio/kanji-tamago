import { useRef, useEffect, useMemo, useState } from 'react';
import type { Word } from '../types/word';
import { getGrowthIcon } from '../utils/wordIcon';
import { getCurrentStation, getAllStations } from '../utils/stationProgress';
import { getMonsterDisplay, stageFaceEmoji } from '../utils/monster';
import { getMonsterImage, getMonsterFinalImage } from '../utils/monsterImages';
import { MAX_FED, getCurrentStageIndex, getLevelProgress, xpToNextLevel, MAX_LEVEL } from '../utils/monsterState';
import type { MonsterState } from '../utils/monsterState';
import { getRemainingRecoveryCount } from '../utils/dailyLimit';
import monsterBg01 from '../assets/backgrounds/01L.png';
import smokeImg from '../assets/monster/smoke.png';
import { playMunch, playFanfare } from '../utils/sound';

type Props = {
  words: Word[];
  onSelectWord: (id: string) => void;
  monsterState: MonsterState;
  feedMonster: () => 'ok' | 'no-food' | 'full';
  feedAdult: (id: string) => 'ok' | 'no-food' | 'not-found' | 'maxed';
  graduateMonster: () => void;
  onRequestReview: () => void;
};

type FlyApple = { id: number; x: number; y: number; dx: number; dy: number };

// 背景モンスターのレイアウト情報（位置・サイズ等は固定）。レベル・経験値は別途
// monsterState.collection から都度ルックアップ（メモ化されたレイアウトに引きずられて
// stale 表示にならないよう分離）
type BgMonster = {
  id: string;
  species: string;
  leftPct: number;
  topPct: number;
  size: number;
  flipped: boolean;
  swayDur: number;
  swayDelay: number;
};

type SmokePuff = { id: number; dx: number; dy: number; scale: number; delay: number };

let flyAppleIdSeq = 0;
let smokeIdSeq = 0;

export default function HomePage({ words, onSelectWord, monsterState, feedMonster, feedAdult, graduateMonster, onRequestReview }: Props) {
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const gridCurrentRef = useRef<HTMLDivElement>(null);
  const monsterRef = useRef<HTMLButtonElement>(null);
  const [monsterPulse, setMonsterPulse] = useState(0);
  const [flyApples, setFlyApples] = useState<FlyApple[]>([]);
  const [showNoFood, setShowNoFood] = useState(false);
  const [hop, setHop] = useState<{ dir: 'left' | 'right'; id: number } | null>(null);
  const [smokePuffs, setSmokePuffs] = useState<SmokePuff[]>([]);
  const prevMonsterKey = useRef<string | null>(null);
  const [showGraduation, setShowGraduation] = useState(false);
  const adultAckedRef = useRef(false);
  // 餌やり前ゲート: 当日の「わからない」が未復習のとき表示
  const [showReviewGate, setShowReviewGate] = useState(false);
  // ❌→💔 アイコン切替をリアルタイムに反映するための再描画用 tick
  const [, setIconTick] = useState(0);
  // レベルアップ演出
  const [levelUp, setLevelUp] = useState<{ level: number; id: number } | null>(null);
  const prevStageRef = useRef<{ species: string; stage: number } | null>(null);
  // ポストLv5：コレクション内モンスターのレベル変化を追跡
  const prevCollectionLevelsRef = useRef<Map<string, number> | null>(null);
  // 背景モンスターのドラッグ位置オフセット（重なり解消用）
  const [bgOffsets, setBgOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const dragRef = useRef<{ id: string; startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);
  // 中央（育成中）モンスターのドラッグ位置オフセット
  const [centerOffset, setCenterOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const centerDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);

  // りんごが指定要素に吸い込まれる演出を発動
  function spawnFlyApple(targetEl: HTMLElement | null) {
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height * 0.5;
    const startX = targetX - 80 + Math.random() * 160;
    const startY = targetY + 100;
    const id = ++flyAppleIdSeq;
    setFlyApples(prev => [...prev, { id, x: startX, y: startY, dx: targetX - startX, dy: targetY - startY }]);
    setTimeout(() => setFlyApples(prev => prev.filter(a => a.id !== id)), 600);
  }
  // モンスター見た目切り替わり時のカバー煙（毎回 id を更新してアニメーションを再実行）
  const [coverSmokeId, setCoverSmokeId] = useState(0);

  // ❌（cooldown 中）が 💔（overdue）に変わるタイミングで再描画させる。
  // 最早 cooldown 期限に setTimeout を仕掛け、発火後に tick を進めて再走査する。
  useEffect(() => {
    const now = Date.now();
    let earliest: number | null = null;
    for (const w of words) {
      if (
        w.status === 'learning' &&
        (w.sm2Repetition ?? 0) === 0 &&
        w.nextReviewAt !== null &&
        w.nextReviewAt > now &&
        w.nextReviewAt !== Number.MAX_SAFE_INTEGER
      ) {
        if (earliest === null || w.nextReviewAt < earliest) earliest = w.nextReviewAt;
      }
    }
    if (earliest === null) return;
    const delay = Math.max(50, earliest - now + 100);
    const t = setTimeout(() => setIconTick(n => n + 1), delay);
    return () => clearTimeout(t);
  }, [words]);

  // 数秒おきにランダム方向へジャンプ移動
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function scheduleNext() {
      const delay = 4000 + Math.random() * 5000; // 4〜9秒
      timer = setTimeout(() => {
        if (cancelled) return;
        const dir: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';
        setHop({ dir, id: Date.now() });
        setTimeout(() => {
          if (!cancelled) setHop(null);
        }, 1200);
        scheduleNext();
      }, delay);
    }
    scheduleNext();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // 単元ごとに単語をグループ化
  const wordsByStation = new Map<number, Word[]>();
  for (const w of words) {
    if (!wordsByStation.has(w.station)) wordsByStation.set(w.station, []);
    wordsByStation.get(w.station)!.push(w);
  }

  // 現在の単元：最初の未完了単元
  const currentStation = getCurrentStation(words);

  // 表示する全単元（選択学年の単語から動的に算出）
  const visibleStations = getAllStations(words);

  const [selectedStation, setSelectedStation] = useState(currentStation);

  // currentStation が変わったら selectedStation もリセット
  useEffect(() => {
    setSelectedStation(currentStation);
  }, [currentStation]);

  // グリッドの現在単元へ自動スクロール
  useEffect(() => {
    const el = gridCurrentRef.current;
    const container = gridScrollRef.current;
    if (!el || !container) return;
    container.scrollTop = el.offsetTop - 8;
  }, [currentStation, words.length]);

  const customWords = words.filter(w => w.isCustom);

  // モンスタータップ: グローバル在庫から1個消費して現モンスターに与える
  function handleMonsterTap() {
    // 餌やり前ゲート: 当日「わからない」のうち復習期限到来済みが残っていれば誘導
    const fed = monsterState.currentMonster.fed;
    const isAdultNow = fed >= MAX_FED;
    const pending = getRemainingRecoveryCount(words);
    if (pending > 0 && monsterState.foodInventory > 0 && !isAdultNow) {
      setShowReviewGate(true);
      return;
    }
    setMonsterPulse(p => p + 1);
    const result = feedMonster();
    if (result === 'no-food') {
      setShowNoFood(true);
      setTimeout(() => setShowNoFood(false), 1200);
      return;
    }
    if (result === 'full') {
      // モンスターが大人に到達済み（卒業待ち）。エサがないわけではないので何も警告しない
      return;
    }
    playMunch();
    // りんごがモンスターの口に吸い込まれる演出
    spawnFlyApple(monsterRef.current);
  }

  // graduateMonster の参照を安定化（ref経由）することで、effect再実行でタイマーがキャンセルされないようにする
  const graduateRef = useRef(graduateMonster);
  useEffect(() => { graduateRef.current = graduateMonster; }, [graduateMonster]);

  // モンスターが大人に到達（fed === MAX_FED）した瞬間に「完成」演出を発動し、
  // 約3秒後に自動卒業（コレクションへ追加 & 次のタマゴへ）を実行。
  // 大人の姿をきちんと見せてから次に進む。
  useEffect(() => {
    const fed = monsterState.currentMonster.fed;
    if (fed >= MAX_FED && !adultAckedRef.current) {
      adultAckedRef.current = true;
      setShowGraduation(true);
      const hideT = setTimeout(() => setShowGraduation(false), 2800);
      const gradT = setTimeout(() => {
        graduateRef.current();
      }, 3200);
      return () => { clearTimeout(hideT); clearTimeout(gradT); };
    }
    // 次のタマゴに戻ったらフラグをリセット（fed < MAX_FED）
    if (fed < MAX_FED && adultAckedRef.current) {
      adultAckedRef.current = false;
    }
  }, [monsterState.currentMonster.fed]);

  // ポストLv5レベルアップ検知：コレクション内モンスターのレベル増加を検出してファンファーレ＋演出
  useEffect(() => {
    const current = new Map<string, number>();
    let leveledUp: { level: number } | null = null;
    for (const m of monsterState.collection) {
      current.set(m.id, m.level);
      const prevLevel = prevCollectionLevelsRef.current?.get(m.id);
      if (prevLevel !== undefined && m.level > prevLevel) {
        leveledUp = { level: m.level };
      }
    }
    // 初回はベースライン記録のみ
    if (prevCollectionLevelsRef.current !== null && leveledUp) {
      setLevelUp({ level: leveledUp.level, id: Date.now() });
      playFanfare();
      setTimeout(() => setLevelUp(null), 1900);
    }
    prevCollectionLevelsRef.current = current;
  }, [monsterState.collection]);

  // モンスターの見た目（species + stageIndex）が変わったら煙パフを発動
  // 同じ種で stageIndex が増えた時はレベルアップ演出も同時発動
  useEffect(() => {
    const { species, fed } = monsterState.currentMonster;
    const stageIndex = getCurrentStageIndex(fed);
    const key = `${species}-${stageIndex}`;

    // レベルアップ判定（同じ種でステージが上がった、かつ最終段階＝かんせいではない）
    const prev = prevStageRef.current;
    if (prev && prev.species === species && stageIndex > prev.stage && stageIndex < 4) {
      setLevelUp({ level: stageIndex + 1, id: Date.now() });
      playFanfare();
      setTimeout(() => setLevelUp(null), 1900);
    }
    prevStageRef.current = { species, stage: stageIndex };

    if (prevMonsterKey.current === null) {
      prevMonsterKey.current = key;
      return;
    }
    if (prevMonsterKey.current !== key) {
      prevMonsterKey.current = key;
      // モンスターの見た目が変わった瞬間、煙で覆って切り替わりを隠す
      setCoverSmokeId(id => id + 1);
      // 中心から 10 粒 放射状にパフ
      const puffs: SmokePuff[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * 2 * Math.PI + Math.random() * 0.3;
        const dist = 60 + Math.random() * 50;
        puffs.push({
          id: ++smokeIdSeq,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist - 10,
          scale: 1 + Math.random() * 0.8,
          delay: Math.random() * 80,
        });
      }
      setSmokePuffs(prev => [...prev, ...puffs]);
      setTimeout(() => {
        setSmokePuffs(prev => prev.filter(p => !puffs.some(x => x.id === p.id)));
      }, 900);
    }
  }, [monsterState.currentMonster]);

  // 背景に配置するコレクション（最大20体、位置・反転はマウント時に決定）
  const collectionKey = monsterState.collection.map(m => m.id).join(',');
  const bgMonsters = useMemo<BgMonster[]>(() => {
    const col = monsterState.collection;
    if (col.length === 0) return [];
    const MAX_BG = 20;
    const n = Math.min(MAX_BG, col.length);
    // col からランダムに n 体を選ぶ
    const pool = [...col];
    const chosen: typeof col = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      chosen.push(pool[idx]);
      pool.splice(idx, 1);
    }
    // 4列 × 5行 の基本グリッドにランダムジッタを乗せた20スロット
    const COLS = 4;
    const ROWS = 5;
    const X_MIN = 8, X_MAX = 92;
    const Y_MIN = 56, Y_MAX = 94; // 主役モンスターより上の領域〜足元
    const slots: { leftPct: number; topPct: number }[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // 行ごとに半列ずれ（ジグザグで自然な配置）
        const xOffset = (r % 2) * ((X_MAX - X_MIN) / COLS / 2);
        const x = X_MIN + xOffset + c * ((X_MAX - X_MIN) / COLS);
        const y = Y_MIN + r * ((Y_MAX - Y_MIN) / (ROWS - 1));
        slots.push({ leftPct: x, topPct: y });
      }
    }
    // スロットをシャッフルして先頭 n 件を使う
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    return chosen.map((adult, i) => {
      const slot = slots[i];
      return {
        id: adult.id,
        species: adult.species,
        leftPct: slot.leftPct + (Math.random() - 0.5) * 4,
        topPct: slot.topPct + (Math.random() - 0.5) * 3,
        size: 64 + Math.floor(Math.random() * 22),  // 64〜86px（やや小さめで20体に対応）
        flipped: Math.random() < 0.5,
        swayDur: 3 + Math.random() * 3,      // 3〜6秒
        swayDelay: Math.random() * 2.5,      // 0〜2.5秒
      };
    });
    // コレクションの並びが変わるまでは位置を固定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionKey]);

  return (
    <div className="flex flex-col" style={{ backgroundColor: '#FFF9F0', height: '100svh' }}>
      {/* 選択中単元のモンスターエリア */}
      <div className="flex-shrink-0">
        <div
          style={{
            width: '100%',
            height: 460,
            overflow: 'hidden',
            borderBottom: '3px solid #FF8A80',
            position: 'relative',
            backgroundImage: `url(${monsterBg01})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* 背景に滞在するコレクション（小さめ、ゆっくり左右にゆれる）。
              タップでえさやり／スワイプで好きな場所へ移動（重なり解消用）
              ※ レベル・経験値は monsterState.collection から都度ルックアップ */}
          {bgMonsters.map((m) => {
            const adult = monsterState.collection.find(c => c.id === m.id);
            if (!adult) return null;  // コレクションから消えた（卒業し直しなど）
            const img = getMonsterFinalImage(m.species);
            const xpNeeded = xpToNextLevel(adult.level);
            const isMaxed = adult.level >= MAX_LEVEL;
            const xpPct = isMaxed ? 100 : Math.min(100, (adult.exp / xpNeeded) * 100);
            const offset = bgOffsets[m.id] ?? { x: 0, y: 0 };
            const isDragging = dragRef.current?.id === m.id && dragRef.current?.moved;
            return (
              <button
                key={`bg-${m.id}`}
                onPointerDown={(e) => {
                  // ポインタ捕獲：要素外に出ても move/up を拾う
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const base = bgOffsets[m.id] ?? { x: 0, y: 0 };
                  dragRef.current = {
                    id: m.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    baseX: base.x,
                    baseY: base.y,
                    moved: false,
                  };
                }}
                onPointerMove={(e) => {
                  const d = dragRef.current;
                  if (!d || d.id !== m.id) return;
                  const dx = e.clientX - d.startX;
                  const dy = e.clientY - d.startY;
                  if (!d.moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
                    d.moved = true;
                  }
                  if (d.moved) {
                    setBgOffsets(prev => ({ ...prev, [m.id]: { x: d.baseX + dx, y: d.baseY + dy } }));
                  }
                }}
                onPointerUp={(e) => {
                  const d = dragRef.current;
                  if (!d || d.id !== m.id) { dragRef.current = null; return; }
                  const targetEl = e.currentTarget;
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  const moved = d.moved;
                  dragRef.current = null;
                  if (moved) {
                    // ドラッグ完了：位置を確定（既に setBgOffsets で更新済み）
                    return;
                  }
                  // タップ判定：給餌
                  const r = feedAdult(m.id);
                  if (r === 'ok') {
                    playMunch();
                    // 中央モンスターと同様、リンゴが吸い込まれる演出
                    spawnFlyApple(targetEl);
                  } else if (r === 'no-food') {
                    setShowNoFood(true);
                    setTimeout(() => setShowNoFood(false), 1200);
                  }
                }}
                onPointerCancel={() => { dragRef.current = null; }}
                aria-label={`${m.species} Lv${adult.level} に エサを あげる`}
                style={{
                  position: 'absolute',
                  left: `${m.leftPct}%`,
                  top: `${m.topPct}%`,
                  marginLeft: offset.x,
                  marginTop: offset.y,
                  width: m.size,
                  height: m.size,
                  filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.2))',
                  opacity: isDragging ? 0.7 : 0.95,
                  zIndex: isDragging ? 6 : 2,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: isDragging ? 'grabbing' : 'pointer',
                  touchAction: 'none', // ブラウザのデフォルトタッチ操作（スクロールなど）を抑制
                  // ドラッグ中はゆれアニメーションを止める（位置のジャンプを防ぐ）
                  animation: isDragging
                    ? undefined
                    : `monster-bg-sway ${m.swayDur}s ease-in-out ${m.swayDelay}s infinite`,
                  transition: 'opacity 0.15s ease-out',
                }}
              >
                {img ? (
                  <img
                    src={img}
                    alt=""
                    style={{
                      width: '100%', height: '100%', objectFit: 'contain',
                      // 反転は img 側だけで実施 → 親が反転しないので Lv 文字も反転しない
                      transform: `scale(1.4)${m.flipped ? ' scaleX(-1)' : ''}`,
                      transformOrigin: 'center 60%',
                      pointerEvents: 'none',
                    }}
                    draggable={false}
                  />
                ) : (
                  <span style={{ fontSize: m.size * 0.7, display: 'block', textAlign: 'center', pointerEvents: 'none' }}>🌟</span>
                )}
                {/* Lv＋XPバー（モンスターの下に1行で。背景なし、シンプル） */}
                <div style={{
                  position: 'absolute',
                  bottom: -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 3,
                }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 'bold',
                    color: '#FFF',
                    textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
                    lineHeight: 1,
                  }}>Lv{adult.level}</span>
                  <div style={{
                    width: 36,
                    height: 6,
                    backgroundColor: '#000',
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: '1px solid rgba(0,0,0,0.5)',
                  }}>
                    <div style={{
                      width: `${xpPct}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #7ED957 0%, #2EA043 100%)',
                      transition: 'width 0.4s ease-out',
                    }} />
                  </div>
                </div>
              </button>
            );
          })}
          {/* 現在育成中のモンスター タップで給餌 */}
          {(() => {
            const { species, fed } = monsterState.currentMonster;
            const md = getMonsterDisplay(fed);
            const imgUrl = getMonsterImage(species, md.stageIndex);
            return (
              <button
                ref={monsterRef}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  centerDragRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    baseX: centerOffset.x,
                    baseY: centerOffset.y,
                    moved: false,
                  };
                }}
                onPointerMove={(e) => {
                  const d = centerDragRef.current;
                  if (!d) return;
                  const dx = e.clientX - d.startX;
                  const dy = e.clientY - d.startY;
                  if (!d.moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
                    d.moved = true;
                  }
                  if (d.moved) {
                    setCenterOffset({ x: d.baseX + dx, y: d.baseY + dy });
                  }
                }}
                onPointerUp={(e) => {
                  const d = centerDragRef.current;
                  if (!d) return;
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  const moved = d.moved;
                  centerDragRef.current = null;
                  if (moved) return; // ドラッグ完了：位置確定
                  // タップ：給餌
                  handleMonsterTap();
                }}
                onPointerCancel={() => { centerDragRef.current = null; }}
                aria-label="モンスターに エサを あげる"
                style={{
                  position: 'absolute',
                  top: '62%',
                  left: '50%',
                  marginLeft: centerOffset.x,
                  marginTop: centerOffset.y,
                  transform: 'translate(-50%, -50%)',
                  transformOrigin: 'center 90%',
                  lineHeight: 1,
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  touchAction: 'none',
                  animation: monsterPulse > 0
                    ? 'monster-eat 0.5s ease-out, monster-idle 3.6s ease-in-out 0.5s infinite'
                    : 'monster-idle 3.6s ease-in-out infinite',
                  width: 190,
                  height: 190,
                  overflow: 'visible',
                  zIndex: 4,
                }}
                key={`monster-${monsterPulse}`}
              >
                <div
                  key={hop ? `hop-${hop.id}` : 'no-hop'}
                  style={{
                    width: '100%',
                    height: '100%',
                    animation: hop ? `monster-hop-${hop.dir} 1.2s ease-in-out` : undefined,
                  }}
                >
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt="モンスター"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                        pointerEvents: 'none',
                        transform: 'scale(1.6)',
                        transformOrigin: 'center 60%',
                      }}
                      draggable={false}
                    />
                  ) : (
                    <span style={{ fontSize: 108 }}>{stageFaceEmoji(md.stageIndex)}</span>
                  )}
                </div>
              </button>
            );
          })()}
          {/* エサ切れメッセージ */}
          {showNoFood && (
            <div style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '6px 12px',
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.95)',
              color: '#888',
              fontSize: 12,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              zIndex: 8,
              pointerEvents: 'none',
            }}>
              エサが ないよ！ 🍂
            </div>
          )}
          {/* ステージ／コレクション数（左上） */}
          <div style={{
            position: 'absolute',
            top: 8,
            left: 8,
            padding: '4px 10px',
            borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.85)',
            color: '#9B2A2A',
            fontSize: 14,
            fontWeight: 'bold',
            pointerEvents: 'none',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            zIndex: 5,
          }}>
            ステージ{selectedStation} / 🏆 {monsterState.collection.length}
          </div>
          {/* もちエサ表示（右上） */}
          <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '4px 12px',
            borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.88)',
            pointerEvents: 'none',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>🍎</span>
            <span style={{ fontSize: 18, color: '#D32F2F', fontWeight: 'bold' }}>
              {monsterState.foodInventory}
            </span>
          </div>
          {/* レベルゲージ（モンスター下・横いっぱい） */}
          {(() => {
            const fed = monsterState.currentMonster.fed;
            const lp = getLevelProgress(fed);
            const pct = lp.isMax ? 100 : Math.min(100, (lp.current / lp.needed) * 100);
            return (
              <div style={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                right: 8,
                padding: '6px 12px',
                borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.92)',
                pointerEvents: 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.18)',
                zIndex: 5,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold', color: '#D32F2F' }}>
                    Lv {lp.level} / {lp.maxLevel}
                  </div>
                  <div style={{ fontSize: 11, color: '#9B2A2A', fontWeight: 'bold' }}>
                    {lp.isMax ? 'かんせい！🌟' : `${lp.current} / ${lp.needed}`}
                  </div>
                </div>
                <div style={{ width: '100%', height: 14, backgroundColor: '#F5D0D0', borderRadius: 7, overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.12)' }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #FF8A80 0%, #D32F2F 100%)',
                    transition: 'width 0.4s ease-out',
                  }} />
                </div>
              </div>
            );
          })()}
          {/* レベルアップ演出（煙テクスチャ＋テキスト） */}
          {levelUp && (
            <div
              key={`lvup-${levelUp.id}`}
              className="pointer-events-none"
              style={{
                position: 'absolute',
                top: '52%',
                left: '50%',
                zIndex: 18,
                whiteSpace: 'nowrap',
              }}
            >
              {/* 背景の煙テクスチャ */}
              <img
                src={smokeImg}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: 280,
                  height: 280,
                  objectFit: 'contain',
                  animation: 'levelup-smoke 1.8s ease-out forwards',
                  filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25)) brightness(1.05)',
                }}
              />
              {/* テキスト本体 */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  animation: 'levelup-title 1.8s ease-out forwards',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 42,
                    fontWeight: 900,
                    color: '#FFB600',
                    textShadow: '0 0 8px #fff, 0 0 18px #FFB600, 3px 3px 0 #D32F2F, -3px -3px 0 #D32F2F, 3px -3px 0 #D32F2F, -3px 3px 0 #D32F2F',
                    letterSpacing: '-1px',
                    lineHeight: 1.05,
                  }}
                >
                  レベルアップ！
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 22,
                    fontWeight: 900,
                    color: '#FFF',
                    textShadow: '2px 2px 0 #D32F2F, -2px -2px 0 #D32F2F, 2px -2px 0 #D32F2F, -2px 2px 0 #D32F2F',
                  }}
                >
                  Lv {levelUp.level} / 5
                </div>
              </div>
            </div>
          )}
          {/* モンスター完成演出（テキスト＋きらめき） */}
          {showGraduation && (
            <>
              <div
                className="pointer-events-none"
                style={{
                  position: 'absolute',
                  top: '42%',
                  left: '50%',
                  zIndex: 20,
                  animation: 'graduation-title 2.6s ease-out forwards',
                  whiteSpace: 'nowrap',
                }}
              >
                <div
                  style={{
                    fontSize: 44,
                    fontWeight: 900,
                    color: '#FFB600',
                    textShadow: '0 0 8px #fff, 0 0 18px #FFB600, 3px 3px 0 #D32F2F, -3px -3px 0 #D32F2F, 3px -3px 0 #D32F2F, -3px 3px 0 #D32F2F',
                    letterSpacing: '-1px',
                    lineHeight: 1.1,
                    textAlign: 'center',
                  }}
                >
                  🌟 かんせい！ 🌟
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 16,
                    fontWeight: 'bold',
                    color: '#fff',
                    textShadow: '0 0 4px #D32F2F, 2px 2px 0 #D32F2F, -2px -2px 0 #D32F2F, 2px -2px 0 #D32F2F, -2px 2px 0 #D32F2F',
                    textAlign: 'center',
                  }}>
                  モンスターを ゲットしたよ！
                </div>
              </div>
              {/* きらめき粒子 */}
              {Array.from({ length: 14 }, (_, i) => {
                const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
                const dist = 90 + Math.random() * 80;
                const dx = Math.cos(angle) * dist;
                const dy = Math.sin(angle) * dist - 20;
                const delay = Math.random() * 200;
                return (
                  <div
                    key={`sparkle-${i}`}
                    className="pointer-events-none"
                    style={{
                      position: 'absolute',
                      top: '42%',
                      left: '50%',
                      fontSize: 28 + Math.random() * 14,
                      zIndex: 19,
                      animation: `graduation-sparkle 1.6s ease-out ${delay}ms forwards`,
                      ['--dx' as string]: `${dx}px`,
                      ['--dy' as string]: `${dy}px`,
                    } as React.CSSProperties}
                  >
                    {['✨', '🌟', '🎉', '💫'][i % 4]}
                  </div>
                );
              })}
            </>
          )}
          {/* モンスター見た目切り替わり時のカバー煙（中央でモンスターを覆って切り替わりを隠す） */}
          {coverSmokeId > 0 && (
            <img
              key={`cover-${coverSmokeId}`}
              src={smokeImg}
              alt=""
              draggable={false}
              className="pointer-events-none"
              style={{
                position: 'absolute',
                top: '62%',
                left: '50%',
                width: 240,
                height: 240,
                objectFit: 'contain',
                animation: 'smoke-cover 0.9s ease-out forwards',
                zIndex: 7,
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))',
              }}
            />
          )}
          {/* 進化時の煙パフ */}
          {smokePuffs.length > 0 && (
            <div
              className="pointer-events-none"
              style={{
                position: 'absolute',
                top: '62%',
                left: '50%',
                width: 0,
                height: 0,
                zIndex: 6,
              }}
            >
              {smokePuffs.map(p => {
                const size = 60 * p.scale;
                return (
                  <img
                    key={p.id}
                    src={smokeImg}
                    alt=""
                    draggable={false}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: size,
                      height: size,
                      objectFit: 'contain',
                      animation: `smoke-burst 0.85s ease-out ${p.delay}ms forwards`,
                      ['--dx' as string]: `${p.dx}px`,
                      ['--dy' as string]: `${p.dy}px`,
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
                    } as React.CSSProperties}
                  />
                );
              })}
            </div>
          )}
          {/* 吸い込まれるりんご */}
          {flyApples.map(a => (
            <div
              key={a.id}
              className="fixed pointer-events-none"
              style={{
                left: a.x,
                top: a.y,
                fontSize: 28,
                zIndex: 70,
                animation: 'apple-fly 0.55s cubic-bezier(0.55,0,0.35,1) forwards',
                ['--dx' as string]: `${a.dx}px`,
                ['--dy' as string]: `${a.dy}px`,
              } as React.CSSProperties}
            >
              🍎
            </div>
          ))}
        </div>
        <div style={{ height: 12 }} />
      </div>

      {/* 単語グリッド（独立スクロール） */}
      <div
        ref={gridScrollRef}
        className="flex-1 overflow-y-auto px-3 pb-24 flex flex-col"
        style={{ gap: 3, minHeight: 0 }}
      >
        {/* マイ単語セクション */}
        {customWords.length > 0 && (
          <div
            className="rounded-lg"
            style={{
              padding: '6px 6px',
              border: '1px solid rgba(255,183,197,0.5)',
              backgroundColor: 'rgba(255,183,197,0.08)',
            }}
          >
            <div className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: '#FF8A80' }}>
              ✏️ マイかんじ
            </div>
            <div className="flex flex-wrap" style={{ gap: 3 }}>
              {customWords.map(w => {
                const isUnlearned = w.status === 'unlearned';
                const gridIcon = getGrowthIcon(w);
                return (
                  <button
                    key={w.id}
                    onClick={() => onSelectWord(w.id)}
                    title={`${w.front} / ${w.back}`}
                    className="flex items-center justify-center"
                    style={{
                      width: 20, height: 20,
                      borderRadius: 3,
                      flexShrink: 0,
                      padding: 0,
                      cursor: 'pointer',
                      backgroundColor: isUnlearned ? '#FFF' : 'transparent',
                      border: isUnlearned ? '1px solid rgba(255,183,197,0.5)' : 'none',
                      fontSize: isUnlearned ? 10 : 14,
                      lineHeight: 1,
                    }}
                  >
                    {gridIcon}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {visibleStations.map(s => {
          const ws = wordsByStation.get(s);
          if (!ws || ws.length === 0) return null;
          const isCurrent = s === currentStation;
          // 一度でも学習が始まった単元（learnedAt あり）は再ロックしない
          const neverStarted = (wordsByStation.get(s) ?? []).every(w => w.learnedAt === null);
          const isLocked = neverStarted && s > currentStation;
          if (isLocked && s !== currentStation + 1) return null;
          return (
            <div
              key={s}
              ref={isCurrent ? gridCurrentRef : undefined}
              className="rounded-lg"
              style={{
                padding: '6px 6px',
                border: isCurrent
                  ? '1px solid rgba(212,83,126,0.25)'
                  : '1px solid transparent',
                backgroundColor: isCurrent
                  ? 'rgba(212,83,126,0.06)'
                  : 'transparent',
              }}
            >
              <div className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: isCurrent ? '#D32F2F' : '#888' }}>
                ステージ{s}
                {isLocked && <span style={{ fontSize: 11 }}>🔒</span>}
              </div>
              {!isLocked && (
                <div className="flex flex-wrap" style={{ gap: 3 }}>
                  {ws.map(w => {
                    const isUnlearned = w.status === 'unlearned';
                    const gridIcon = getGrowthIcon(w);
                    return (
                      <button
                        key={w.id}
                        onClick={() => onSelectWord(w.id)}
                        title={`${w.front} / ${w.back}`}
                        className="flex items-center justify-center"
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 3,
                          flexShrink: 0,
                          padding: 0,
                          cursor: 'pointer',
                          backgroundColor: isUnlearned ? '#FFF' : 'transparent',
                          border: isUnlearned ? '1px solid rgba(0,0,0,0.1)' : 'none',
                          fontSize: isUnlearned ? 10 : 14,
                          lineHeight: 1,
                        }}
                      >
                        {gridIcon}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 餌やり前ゲートモーダル: 当日「わからない」が未復習のとき表示 */}
      {showReviewGate && (
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{ zIndex: 200, backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setShowReviewGate(false)}
        >
          <div
            className="w-full rounded-3xl shadow-xl p-7 text-center"
            style={{ backgroundColor: '#FFF', maxWidth: 340 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>📚</div>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#333' }}>
              まずは ふくしゅう しよう！
            </h2>
            <p className="text-sm mb-6 leading-relaxed whitespace-pre-line" style={{ color: '#666' }}>
              {`きょう わからなかった ことばが ${getRemainingRecoveryCount(words)}こ あるよ。\nおぼえなおしてから モンスターに ごはんを あげよう！`}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowReviewGate(false); onRequestReview(); }}
                className="w-full py-3.5 rounded-2xl text-white font-bold shadow-md active:scale-95 transition-all"
                style={{ backgroundColor: '#FF8A80' }}
              >
                ふくしゅうする
              </button>
              <button
                onClick={() => setShowReviewGate(false)}
                className="w-full py-3 rounded-2xl font-bold active:scale-95 transition-all"
                style={{ backgroundColor: '#FFF', border: '2px solid #CCC', color: '#888' }}
              >
                あとで
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
