import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Word } from '../types/word';
import { getTodayReviewWords, STATUS_COLORS, STATUS_LABELS, markAnswered, formatNextReviewShort } from '../utils/reviewSchedule';
import { playPirorin, playBuzzer, speakJa } from '../utils/sound';
import { getReviewBacklogCount, isBacklogLimitReached, REVIEW_BACKLOG_LIMIT } from '../utils/dailyLimit';

type Props = {
  words: Word[];
  onAnswer: (id: string, quality: number) => void;
  onDone: () => void;
  onChangeGrade: () => void;
  onToggleStar: (id: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
  onUpdateCustomFront: (id: string, customFront: string) => void;
  foodInventory: number;
};

type Petal = { id: number; x: number; y: number; angle: number; scale: number; dx: number; dy: number };
type FallingPetal = { key: number; left: number; size: number; duration: number; delay: number; drift: number };

let petalId = 0;

export default function ReviewPage({ words, onAnswer, onDone, onChangeGrade, onToggleStar, onUpdateMemo, onUpdateCustomFront, foodInventory }: Props) {
  // ❌+💔 が 20 件以上なら新規語を追加しない
  const initLimitActive = isBacklogLimitReached(words);
  const [queue, setQueue] = useState<Word[]>(() => getTodayReviewWords(words, { excludeUnlearned: initLimitActive }));
  const queueRef = useRef<Word[]>(queue);
  queueRef.current = queue;
  const [dueCount] = useState(() => {
    const now = Date.now();
    return queue.filter(w =>
      w.status === 'overdue' || (w.nextReviewAt !== null && w.nextReviewAt <= now)
    ).length;
  });
  // 初期 overdue の id 集合（GREATスクリーン発火判定用）
  const initialOverdueIds = useMemo<Set<string>>(
    () => new Set(queue.slice(0, dueCount).map(w => w.id)),
    // queue/dueCount は init 時の値で固定
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // 当セッションで「初期overdue」を q>=3 で正解した id（重複カウント防止）
  const overdueClearedRef = useRef<Set<string>>(new Set());
  // GREAT「ふくしゅう コンプリート」を一度だけ出すためのフラグ
  const reviewCompleteFiredRef = useRef(false);
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const limitPopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showMemoEdit, setShowMemoEdit] = useState(false);
  const [memoText, setMemoText] = useState('');
  const [showFrontEdit, setShowFrontEdit] = useState(false);
  const [frontText, setFrontText] = useState('');
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [reviewComplete, setReviewComplete] = useState(false);
  const [petals, setPetals] = useState<Petal[]>([]);
  const [showGreat, setShowGreat] = useState(false);
  const [showTiredAlert, setShowTiredAlert] = useState(false);
  // つかれたねモーダル発火後の同セッション内抑止（連打で何度も出ないように）
  const tiredAlertSuppressedRef = useRef(false);
  // pending 全部が15秒クールダウン中の時の待機画面のターゲット時刻（null=非表示）
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  // クールダウンの理由:
  //   'pending' = pending 再投入待ち → 経過後に advance() 必要
  //   'current' = 現在の語自体が cooldown 中（再マウント直後など）→ 経過後は再描画のみ
  const cooldownReasonRef = useRef<'pending' | 'current' | null>(null);
  // セッション内再出題対象: わからないと答えた単語 id（おぼえたで取り除かれる）
  const [pendingReReview, setPendingReReview] = useState<string[]>([]);
  const pendingRef = useRef<string[]>([]);
  pendingRef.current = pendingReReview;
  // つかれたねモーダルの「ふくしゅうだけ つづける」で立てる新規語ロック
  const [newWordsLocked, setNewWordsLocked] = useState(false);
  const newWordsLockedRef = useRef(false);
  newWordsLockedRef.current = newWordsLocked;
  const [feedToast, setFeedToast] = useState<{ amount: number; id: number } | null>(null);
  const [collectApples, setCollectApples] = useState<{ id: number; angle: number; dist: number; dx: number; dy: number }[]>([]);
  // 連打対策：ref で同期的にロック（stateだとバッチ中のタップを防げない）
  const answeringRef = useRef(false);
  const [isAnswering, setIsAnswering] = useState(false);

  // 復習コンプリート演出用の落下花びら（一度だけ生成）
  const fallingPetals = useMemo<FallingPetal[]>(() =>
    Array.from({ length: 40 }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      size: 16 + Math.random() * 20,
      duration: 3 + Math.random() * 3,
      delay: Math.random() * 3,
      drift: (Math.random() - 0.5) * 120,
    }))
  , []);

  const current = queue[index];
  // words は毎レンダーで最新状態なので starred の表示に使う
  const currentWord = words.find(w => w.id === current?.id) ?? current;

  const spawnPetals = useCallback(() => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const newPetals: Petal[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * 360;
      const dist = 60 + Math.random() * 120;
      const rad = (angle * Math.PI) / 180;
      newPetals.push({
        id: ++petalId,
        x: cx + (Math.random() - 0.5) * 100,
        y: cy + (Math.random() - 0.5) * 100,
        angle: Math.random() * 360,
        scale: 0.8 + Math.random() * 0.8,
        dx: Math.cos(rad) * dist,
        dy: Math.sin(rad) * dist - 40,
      });
    }
    setPetals(prev => [...prev, ...newPetals]);
    setTimeout(() => {
      setPetals(prev => prev.filter(p => !newPetals.includes(p)));
    }, 1000);
  }, []);

  // クールダウン経過後の処理: reason='pending' の時のみ advance() を呼ぶ
  // ※ 早期 return より前に置く（hooks 規則違反防止）。advance は関数宣言なので巻き上げにより参照可能
  useEffect(() => {
    if (cooldownUntil === null) return;
    const remaining = Math.max(0, cooldownUntil - Date.now());
    const t = setTimeout(() => {
      const reason = cooldownReasonRef.current;
      cooldownReasonRef.current = null;
      setCooldownUntil(null);
      if (reason === 'pending') {
        advance();
      }
      // 'current' の場合は cooldownUntil をクリアするだけで再レンダーされ、
      // current word の nextReviewAt が過去になったので通常のカードが描画される
    }, remaining + 100);
    return () => clearTimeout(t);
    // advance はレンダーごとに再生成されるが、ref ベースで状態を読むので closure 経由でもOK
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooldownUntil]);

  // queue 内で「現在 index 以降」をスキャンし、cooldown 中の ❌ をスキップして
  // 次の eligible な位置に index を進める。全て cooldown なら最早期限まで待機。
  // これにより、わからない を連打しても 1 回のタップで余計に待たされない（cascade 防止）。
  useEffect(() => {
    if (cooldownUntil !== null) return; // 既に待機中
    if (!currentWord) return;
    const now = Date.now();
    const queueNow = queueRef.current;
    let scanIdx = index;
    let earliestCooldown: number | null = null;
    while (scanIdx < queueNow.length) {
      const w = queueNow[scanIdx];
      const latest = words.find(x => x.id === w.id) ?? w;
      const inCooldown =
        latest.nextReviewAt !== null &&
        latest.nextReviewAt > now &&
        latest.status === 'learning' &&
        (latest.sm2Repetition ?? 0) === 0;
      if (!inCooldown) break;
      if (
        latest.nextReviewAt !== null &&
        (earliestCooldown === null || latest.nextReviewAt < earliestCooldown)
      ) {
        earliestCooldown = latest.nextReviewAt;
      }
      scanIdx++;
    }
    if (scanIdx < queueNow.length) {
      // eligible な語が見つかったので index を進める
      if (scanIdx !== index) setIndex(scanIdx);
    } else if (earliestCooldown !== null) {
      // 残り全て cooldown → 最早期限まで待機（'current' 理由なので経過後は再描画のみ）
      cooldownReasonRef.current = 'current';
      setCooldownUntil(earliestCooldown);
    }
    // index と currentWord の更新で再走査
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord?.id, currentWord?.nextReviewAt, cooldownUntil, index]);

  // pending 全部がクールダウン中 → 待機画面
  if (cooldownUntil !== null && !finished) {
    return (
      <CooldownWaitScreen
        targetTime={cooldownUntil}
        pendingCount={pendingReReview.length}
        onSkipWait={onDone}
      />
    );
  }

  // 要復習をすべて消化 → 復習コンプリート演出
  if (reviewComplete && !finished) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
        style={{ backgroundColor: '#FFF9F0', zIndex: 10 }}
      >
        {/* 全画面落下花びら */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 20 }}>
          {fallingPetals.map(p => (
            <div
              key={p.key}
              className="absolute"
              style={{
                left: `${p.left}%`,
                top: -40,
                fontSize: p.size,
                animation: `petal-fall ${p.duration}s ease-in ${p.delay}s forwards`,
                '--drift': `${p.drift}px`,
              } as React.CSSProperties}
            >
              🍎
            </div>
          ))}
        </div>

        {/* GREAT!! + コンプリートメッセージ */}
        <div className="relative flex flex-col items-center px-6 text-center" style={{ zIndex: 30 }}>
          <div
            className="font-black mb-3"
            style={{
              fontSize: 72,
              color: '#FFB600',
              textShadow: '0 4px 12px rgba(0,0,0,0.25), 0 0 40px rgba(255,182,0,0.5)',
              animation: 'great-pop 0.8s ease-out forwards',
              letterSpacing: '-2px',
              lineHeight: 1,
            }}
          >
            GREAT!!
          </div>
          <div className="text-4xl mb-4">🍎🍎🍎</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#333' }}>ふくしゅう コンプリート！</h2>
          <p className="text-sm mb-8" style={{ color: '#888' }}>ふくしゅうが ひつような ことばを ぜんぶ おぼえたよ</p>
          <button
            onClick={onDone}
            className="px-10 py-3 rounded-2xl text-white font-bold shadow-md active:scale-95 transition-all mb-3"
            style={{ backgroundColor: '#FF8A80' }}
          >
            ホームへ戻る
          </button>
          {dueCount < queue.length && (
            <button
              onClick={() => setReviewComplete(false)}
              className="px-8 py-3 rounded-2xl font-bold shadow-md active:scale-95 transition-all"
              style={{ backgroundColor: '#FFF', border: '2px solid #FF8A80', color: '#FF8A80' }}
            >
              まだの ことばも つづける
            </button>
          )}
        </div>
      </div>
    );
  }

  if (queue.length === 0 || finished) {
    // 学年内のすべての語が一度でも「おぼえた」(rep>=1) を満たしているか
    const gradeWords = words.filter(w => !w.isCustom);
    const isGradeComplete =
      gradeWords.length > 0 && gradeWords.every(w => (w.sm2Repetition ?? 0) >= 1);
    return (
      <div
        className="flex flex-col items-center justify-center px-4 text-center"
        style={{ minHeight: '100svh', backgroundColor: '#FFF9F0' }}
      >
        <div className="text-6xl mb-4">🍎</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#333' }}>がくしゅう かんりょう！</h2>
        <p className="text-sm mb-8" style={{ color: '#888' }}>
          {isGradeComplete ? 'ぜんぶの ことばを おぼえたよ' : 'おつかれさま！'}
        </p>
        <div className="flex flex-col gap-3 w-full" style={{ maxWidth: 280 }}>
          {isGradeComplete && (
            <button
              onClick={onChangeGrade}
              className="w-full py-3.5 rounded-2xl text-white font-bold shadow-md active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #FF8A80 0%, #D32F2F 100%)', fontSize: 16 }}
            >
              🎒 つぎの がくねんへ
            </button>
          )}
          <button
            onClick={onDone}
            className="w-full py-2.5 rounded-2xl font-bold active:scale-95 transition-all"
            style={{ backgroundColor: '#F0F0F0', color: '#888', fontSize: 14 }}
          >
            ホームへ もどる
          </button>
        </div>
      </div>
    );
  }

  function spawnCollectApples(count: number) {
    // 画面中央から上方向に広がって右上🍎チップ（top:8, right:8）へ吸い込まれる演出
    const arr: { id: number; angle: number; dist: number; dx: number; dy: number }[] = [];
    for (let i = 0; i < count; i++) {
      const angle = -90 + (Math.random() - 0.5) * 60; // 上方向中心に広がり
      const rad = (angle * Math.PI) / 180;
      const dist = 40 + Math.random() * 60;
      // 最終目的地: 右上🍎チップの中心（画面右端から約30px、上端から約24px）
      const targetDX = window.innerWidth / 2 - 30;
      const targetDY = -(window.innerHeight / 2 - 24);
      arr.push({
        id: ++petalId,
        angle,
        dist,
        dx: targetDX + (Math.random() - 0.5) * 20,
        dy: targetDY + (Math.random() - 0.5) * 16,
      });
      void rad;
    }
    setCollectApples(prev => [...prev, ...arr]);
    setTimeout(() => {
      setCollectApples(prev => prev.filter(a => !arr.some(x => x.id === a.id)));
    }, 1500);
  }

  function handleAnswer(quality: number) {
    // 連打でエサを多重取得しないよう同期ロック
    if (answeringRef.current) return;
    answeringRef.current = true;
    setIsAnswering(true);

    // エサ獲得数（wordStore のルールと一致させる）: おぼえた → +2、わからない → 0
    const earnAmount = quality >= 3 ? 2 : 0;

    // セッション内再出題: わからないなら追加、おぼえたなら除去
    if (quality < 3) {
      if (!pendingRef.current.includes(current.id)) {
        const next = [...pendingRef.current, current.id];
        pendingRef.current = next;
        setPendingReReview(next);
      }
    } else {
      if (pendingRef.current.includes(current.id)) {
        const next = pendingRef.current.filter(x => x !== current.id);
        pendingRef.current = next;
        setPendingReReview(next);
      }
    }

    // 初期 overdue の正答記録（GREAT発火判定用）
    if (quality >= 3 && initialOverdueIds.has(current.id)) {
      overdueClearedRef.current.add(current.id);
    }

    if (quality >= 4) {
      spawnPetals();
      setShowGreat(true);
      spawnCollectApples(earnAmount);
      setFeedToast({ amount: earnAmount, id: Date.now() });
      setTimeout(() => setFeedToast(null), 1400);
      playPirorin();
    } else if (quality >= 3) {
      spawnCollectApples(earnAmount);
      setFeedToast({ amount: earnAmount, id: Date.now() });
      setTimeout(() => setFeedToast(null), 1400);
      playPirorin();
    } else {
      // わからない: エサ 0 のためアニメ・トーストは出さない（音のみ）
      playBuzzer();
      // ❌+💔 が REVIEW_BACKLOG_LIMIT(20) 以上に達するならアラートで新規語ロック
      // （words の status は次レンダーで更新されるため、この語が新規に backlog 入りするかを推測して +1 補正）
      const wasInBacklog =
        current.status === 'overdue' ||
        (current.status === 'learning' && (current.sm2Repetition ?? 0) === 0);
      const backlogAfter = getReviewBacklogCount(words) + (wasInBacklog ? 0 : 1);
      if (backlogAfter >= REVIEW_BACKLOG_LIMIT && !tiredAlertSuppressedRef.current) {
        tiredAlertSuppressedRef.current = true;
        setShowTiredAlert(true);
        onAnswer(current.id, quality);
        return;
      }
    }
    onAnswer(current.id, quality);

    // わからないで backlog 上限到達したら、トーストでも知らせる（2.5秒で自動消去）
    if (quality < 3 && getReviewBacklogCount(words) >= REVIEW_BACKLOG_LIMIT) {
      setShowLimitPopup(true);
      if (limitPopupTimer.current) clearTimeout(limitPopupTimer.current);
      limitPopupTimer.current = setTimeout(() => setShowLimitPopup(false), 2500);
    }

    if (quality >= 3) {
      setTimeout(() => {
        setShowGreat(false);
        advance();
        answeringRef.current = false;
        setIsAnswering(false);
      }, 700);
    } else {
      // わからない時も少し遅延を入れ、連打で次の単語を即ミスタップしないように
      setTimeout(() => {
        advance();
        answeringRef.current = false;
        setIsAnswering(false);
      }, 350);
    }
  }

  /** pending を「クールダウン経過済」「まだ待機中」に分類して、Word オブジェクト/最早期限を返す */
  function partitionPendingByCooldown(): {
    ready: Word[];
    cooling: string[];
    nextEligibleAt: number | null;
  } {
    const now = Date.now();
    const ready: Word[] = [];
    const cooling: string[] = [];
    let nextEligibleAt: number | null = null;
    for (const id of pendingRef.current) {
      const w = words.find(w => w.id === id);
      if (!w) continue;
      const eligible = w.nextReviewAt === null || w.nextReviewAt <= now;
      if (eligible) {
        ready.push(w);
      } else {
        cooling.push(id);
        if (nextEligibleAt === null || (w.nextReviewAt as number) < nextEligibleAt) {
          nextEligibleAt = w.nextReviewAt as number;
        }
      }
    }
    return { ready, cooling, nextEligibleAt };
  }

  function advance() {
    setRevealed(false);
    const nextIndex = index + 1;
    const queueNow = queueRef.current;

    // GREAT「ふくしゅう コンプリート」演出: 初期 overdue を全て q>=3 で正解した瞬間に1回だけ
    if (
      initialOverdueIds.size > 0 &&
      overdueClearedRef.current.size >= initialOverdueIds.size &&
      !reviewCompleteFiredRef.current
    ) {
      reviewCompleteFiredRef.current = true;
      setIndex(nextIndex);
      setReviewComplete(true);
      return;
    }

    // 境界: 初期 overdue ブロックを終え unlearned に入る前に pending を再投入する
    // ただし「クールダウン経過済」のものだけ。まだ待機中のものは pending に残し、unlearned へは進まずに待機画面へ
    if (
      dueCount > 0 &&
      nextIndex === dueCount &&
      pendingRef.current.length > 0
    ) {
      const { ready, cooling, nextEligibleAt } = partitionPendingByCooldown();
      if (ready.length > 0) {
        pendingRef.current = cooling;
        setPendingReReview(cooling);
        // dueCount の位置に挿入し、unlearned を後ろにずらす
        const newQueue = [...queueNow.slice(0, dueCount), ...ready, ...queueNow.slice(dueCount)];
        queueRef.current = newQueue;
        setQueue(newQueue);
        setIndex(nextIndex); // 挿入した先頭
        return;
      }
      if (cooling.length > 0 && nextEligibleAt !== null) {
        // 全部クールダウン中 → 待機画面へ（経過後は advance で再投入）
        cooldownReasonRef.current = 'pending';
        setCooldownUntil(nextEligibleAt);
        return;
      }
    }

    // 末尾到達: pending（再出題待ち）を queue に追加して継続
    if (nextIndex >= queueNow.length) {
      const latestPending = pendingRef.current;
      if (latestPending.length > 0) {
        const { ready, cooling, nextEligibleAt } = partitionPendingByCooldown();
        if (ready.length > 0) {
          pendingRef.current = cooling;
          setPendingReReview(cooling);
          const newQueue = [...queueNow, ...ready];
          queueRef.current = newQueue;
          setQueue(newQueue);
          setIndex(nextIndex); // 元末尾 = 追加分の先頭
          return;
        }
        if (cooling.length > 0 && nextEligibleAt !== null) {
          // 全部クールダウン中 → 待機画面へ
          setCooldownUntil(nextEligibleAt);
          return;
        }
      }
      setFinished(true);
      return;
    }

    // 新規語ロック中: 次の unlearned は飛ばす（再復習のみ進める）
    if (newWordsLockedRef.current) {
      let skipIdx = nextIndex;
      while (skipIdx < queueNow.length && queueNow[skipIdx].status === 'unlearned') {
        skipIdx++;
      }
      if (skipIdx >= queueNow.length) {
        // 残りが全て unlearned だった → pending（クールダウン経過済のみ）を再投入
        const latestPending = pendingRef.current;
        if (latestPending.length > 0) {
          const { ready, cooling, nextEligibleAt } = partitionPendingByCooldown();
          if (ready.length > 0) {
            pendingRef.current = cooling;
            setPendingReReview(cooling);
            const newQueue = [...queueNow, ...ready];
            queueRef.current = newQueue;
            setQueue(newQueue);
            setIndex(skipIdx); // === queueNow.length, append 先頭
            return;
          }
          if (cooling.length > 0 && nextEligibleAt !== null) {
            cooldownReasonRef.current = 'pending';
            setCooldownUntil(nextEligibleAt);
            return;
          }
        }
        setFinished(true);
        return;
      }
      setIndex(skipIdx);
      return;
    }

    setIndex(nextIndex);
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100svh', backgroundColor: '#FFF9F0' }}>
      {/* もちエサ表示（右上・固定） */}
      <div style={{
        position: 'fixed',
        top: 8,
        right: 8,
        padding: '4px 12px',
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.92)',
        pointerEvents: 'none',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>🍎</span>
        <span style={{ fontSize: 18, color: '#D32F2F', fontWeight: 'bold' }}>
          {foodInventory}
        </span>
      </div>
      {/* メモ編集モーダル（ボトムシート） */}
      {showMemoEdit && (
        <div
          className="fixed inset-0 flex items-end justify-center"
          style={{ zIndex: 90, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowMemoEdit(false)}
        >
          <div
            className="w-full rounded-t-3xl p-6 pb-10"
            style={{ backgroundColor: '#FFF', maxWidth: 480 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold mb-3" style={{ color: '#333' }}>メモを へんしゅう</h3>
            <textarea
              value={memoText}
              onChange={e => setMemoText(e.target.value)}
              className="w-full rounded-xl p-3 text-sm"
              style={{ border: '1px solid #FFD8D8', minHeight: 120, resize: 'none',
                       backgroundColor: '#FFF9F0', outline: 'none', display: 'block' }}
              placeholder="覚え方、例文、関連語など自由に…"
              autoFocus
            />
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => setShowMemoEdit(false)}
                className="flex-1 py-3 rounded-2xl font-medium text-sm active:scale-95 transition-all"
                style={{ backgroundColor: '#F0F0F0', color: '#888' }}
              >
                キャンセル
              </button>
              <button
                onClick={() => { onUpdateMemo(current.id, memoText); setShowMemoEdit(false); }}
                className="flex-1 py-3 rounded-2xl font-medium text-sm text-white active:scale-95 transition-all"
                style={{ backgroundColor: '#FF8A80' }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 問題文編集モーダル */}
      {showFrontEdit && (
        <div
          className="fixed inset-0 flex items-end justify-center"
          style={{ zIndex: 90, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowFrontEdit(false)}
        >
          <div
            className="w-full rounded-t-3xl p-6 pb-10"
            style={{ backgroundColor: '#FFF', maxWidth: 480 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold mb-1" style={{ color: '#333' }}>もんだいを へんしゅう</h3>
            <p className="text-xs mb-3" style={{ color: '#AAA' }}>元の意味: {current.front}</p>
            <textarea
              value={frontText}
              onChange={e => setFrontText(e.target.value)}
              className="w-full rounded-xl p-3 text-sm"
              style={{ border: '1px solid #FFD8D8', minHeight: 80, resize: 'none',
                       backgroundColor: '#FFF9F0', outline: 'none', display: 'block' }}
              placeholder={current.front}
              autoFocus
            />
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => setShowFrontEdit(false)}
                className="flex-1 py-3 rounded-2xl font-medium text-sm active:scale-95 transition-all"
                style={{ backgroundColor: '#F0F0F0', color: '#888' }}
              >
                キャンセル
              </button>
              {currentWord.customFront && (
                <button
                  onClick={() => { onUpdateCustomFront(current.id, ''); setShowFrontEdit(false); }}
                  className="py-3 px-4 rounded-2xl font-medium text-sm active:scale-95 transition-all"
                  style={{ backgroundColor: '#FFF0F0', color: '#E88' }}
                >
                  元に戻す
                </button>
              )}
              <button
                onClick={() => { onUpdateCustomFront(current.id, frontText); setShowFrontEdit(false); }}
                className="flex-1 py-3 rounded-2xl font-medium text-sm text-white active:scale-95 transition-all"
                style={{ backgroundColor: '#FF8A80' }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* お疲れ様ポップアップ */}
      {showTiredAlert && (
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{ zIndex: 80, backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <div
            className="w-full rounded-3xl shadow-xl p-7 text-center"
            style={{ backgroundColor: '#FFF', maxWidth: 340 }}
          >
            <div className="text-4xl mb-3">🍎</div>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#333' }}>
              そんなに たくさん おぼえれないでしょ！
            </h2>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: '#666' }}>
              わからない（❌）と ふくしゅう（💔）が{'\n'}あわせて {REVIEW_BACKLOG_LIMIT}こ あると{'\n'}あたらしい ことばは おぼえれないよ。
              <br /><br />
              まずは わからなかった ことばを おぼえなおそう！
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={onDone}
                className="w-full py-3.5 rounded-2xl text-white font-bold shadow-md active:scale-95 transition-all"
                style={{ backgroundColor: '#FF8A80' }}
              >
                きょうは おしまい
              </button>
              <button
                onClick={() => {
                  newWordsLockedRef.current = true;
                  setNewWordsLocked(true);
                  setShowTiredAlert(false);
                  advance();
                }}
                className="w-full py-3.5 rounded-2xl font-bold active:scale-95 transition-all"
                style={{ backgroundColor: '#FFF', border: '2px solid #CCC', color: '#888' }}
              >
                ふくしゅうだけ つづける
              </button>
            </div>
          </div>
        </div>
      )}

      {/* バックログ上限トースト（❌+💔 ≥ 20） */}
      {showLimitPopup && (() => {
        const backlog = getReviewBacklogCount(words);
        return (
          <div
            className="fixed left-4 right-4 rounded-2xl px-5 py-4 shadow-xl"
            style={{ top: 24, zIndex: 70, backgroundColor: '#FFF3CD', border: '1px solid #FFB600' }}
          >
            <p className="font-bold text-sm mb-0.5" style={{ color: '#8B6000' }}>
              ⚠️ ❌と💔 が あわせて {REVIEW_BACKLOG_LIMIT}こ いじょう
            </p>
            <p className="text-xs" style={{ color: '#8B6000' }}>
              いま {backlog}こ あるよ。{REVIEW_BACKLOG_LIMIT - 1}こ いかに へらすと、あたらしい ことばを はじめられるよ。
            </p>
          </div>
        );
      })()}

      {/* 花びらパーティクル */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 50 }}>
        {petals.map(p => (
          <div
            key={p.id}
            className="absolute"
            style={{
              left: p.x,
              top: p.y,
              fontSize: `${18 * p.scale}px`,
              transform: `translate(-50%, -50%) rotate(${p.angle}deg)`,
              filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))',
              animation: 'petal-burst 1s ease-out forwards',
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
            } as React.CSSProperties}
          >
            🍎
          </div>
        ))}
      </div>

      {/* グレート演出 */}
      {showGreat && (
        <div
          className="fixed inset-x-0 flex justify-center pointer-events-none"
          style={{ zIndex: 60, top: '30%' }}
        >
          <div
            className="text-4xl font-black"
            style={{
              color: '#FFB600',
              textShadow: '0 2px 4px rgba(0,0,0,0.7), 0 4px 12px rgba(0,0,0,0.4), 0 0 20px rgba(255,182,0,0.3)',
              animation: 'great-pop 0.7s ease-out forwards',
            }}
          >
            🍎 Great! 🍎
          </div>
        </div>
      )}

      {/* エサ獲得トースト（右上🍎チップのすぐ左） */}
      {feedToast && (
        <div
          className="fixed pointer-events-none"
          style={{ zIndex: 65, top: 12, right: 88, animation: 'great-pop 1.3s ease-out forwards' }}
        >
          <div
            className="rounded-full px-2.5 py-0.5 shadow-md font-bold"
            style={{ backgroundColor: '#FFEBEE', border: '2px solid #FF8A80', color: '#D32F2F', fontSize: 16 }}
          >
            +{feedToast.amount}
          </div>
        </div>
      )}

      {/* エサ獲得時のりんごアニメ（画面中央→右上チップ） */}
      {collectApples.length > 0 && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 55 }}>
          {collectApples.map(a => (
            <div
              key={a.id}
              className="absolute"
              style={{
                left: '50%',
                top: '50%',
                fontSize: 28,
                animation: 'apple-collect 1.4s cubic-bezier(0.55,0,0.35,1) forwards',
                ['--dx' as string]: `${a.dx}px`,
                ['--dy' as string]: `${a.dy}px`,
              } as React.CSSProperties}
            >
              🍎
            </div>
          ))}
        </div>
      )}

      {/* カード */}
      <div className="flex-1 flex flex-col items-center justify-start px-2 pb-4" style={{ paddingTop: 50 }}>
        <div className="w-full flex items-center gap-1 mb-0 relative">
          {/* 前へボタン */}
          <button
            onClick={() => { if (index > 0) { setIndex(i => i - 1); setRevealed(false); } }}
            disabled={index === 0}
            className="flex-shrink-0 flex items-center justify-center rounded-2xl active:scale-95 transition-all"
            style={{
              width: 28, height: 48,
              backgroundColor: index === 0 ? 'transparent' : '#FFF',
              border: `1px solid ${index === 0 ? 'transparent' : '#FFC8C8'}`,
              color: index === 0 ? '#DDD' : '#FF8A80',
              fontSize: 22,
            }}
          >
            ‹
          </button>
          <div
            className="flex-1 rounded-3xl shadow-md p-8 text-center flex flex-col items-center relative"
            style={{ backgroundColor: '#FFF', border: '1px solid #FF8A80', minHeight: 220 }}
          >
          {/* ステータス + ID - 上部固定 */}
          <div className="w-full flex items-center justify-between">
            <span className="text-xs" style={{ color: '#CCC' }}>No.{current.id}</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[current.status] }} />
              <span className="text-xs font-medium" style={{ color: STATUS_COLORS[current.status] }}>
                {STATUS_LABELS[current.status]}
              </span>
            </div>
            <span className="w-8" />
          </div>

          {/* 日本語 */}
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <div className="text-4xl font-bold" style={{ color: '#333' }}>
                {currentWord.customFront ?? current.front}
              </div>
              <button
                onClick={() => { setFrontText(currentWord.customFront ?? current.front); setShowFrontEdit(true); }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full active:scale-95 transition-all"
                style={{
                  backgroundColor: currentWord.customFront ? '#FFF3F6' : 'transparent',
                  border: `1px solid ${currentWord.customFront ? '#FF8A80' : 'transparent'}`,
                }}
              >
                <span className="text-xs" style={{ color: currentWord.customFront ? '#FF8A80' : '#CCC' }}>
                  ✏️ {currentWord.customFront ? 'もんだいを へんしゅうちゅう' : 'もんだいを へんしゅう'}
                </span>
              </button>
            </div>
          </div>


          {!revealed ? null : (
            <div className="w-full">
              {/* 読み方表示 */}
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="text-3xl font-bold" style={{ color: '#E55757' }}>
                  {current.back}
                </div>
              </div>
              {/* メモ */}
              {currentWord.memo && (
                <div
                  className="rounded-xl p-3 text-left mt-3"
                  style={{ backgroundColor: '#F0F8FF', border: '1px solid #B0D4F0' }}
                >
                  <p className="text-xs font-medium mb-0.5" style={{ color: '#5B9BD5' }}>メモ</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: '#555' }}>{currentWord.memo}</p>
                </div>
              )}
              {/* メモボタン */}
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => { setMemoText(currentWord.memo ?? ''); setShowMemoEdit(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full active:scale-95 transition-all"
                  style={{
                    backgroundColor: currentWord.memo ? '#F0F8FF' : '#F5F5F5',
                    border: `1px solid ${currentWord.memo ? '#B0D4F0' : '#DDD'}`,
                  }}
                >
                  <span className="text-base" style={{ color: currentWord.memo ? '#5B9BD5' : '#CCC' }}>✏️</span>
                  <span className="text-xs font-medium" style={{ color: currentWord.memo ? '#5B9BD5' : '#AAA' }}>
                    {currentWord.memo ? 'メモを へんしゅうする' : 'メモを ついかする'}
                  </span>
                </button>
              </div>
            </div>
          )}
          </div>
          {/* 次へボタン */}
          <button
            onClick={() => { if (index < queue.length - 1) { setIndex(i => i + 1); setRevealed(false); } }}
            disabled={index >= queue.length - 1}
            className="flex-shrink-0 flex items-center justify-center rounded-2xl active:scale-95 transition-all"
            style={{
              width: 28, height: 48,
              backgroundColor: index >= queue.length - 1 ? 'transparent' : '#FFF',
              border: `1px solid ${index >= queue.length - 1 ? 'transparent' : '#FFC8C8'}`,
              color: index >= queue.length - 1 ? '#DDD' : '#FF8A80',
              fontSize: 22,
            }}
          >
            ›
          </button>
          {/* ★ お気に入りボタン（カード右上外側） */}
          {revealed && (
            <button
              onClick={() => onToggleStar(current.id)}
              className="absolute flex items-center gap-1 px-2 py-1 rounded-full active:scale-95 transition-all"
              style={{
                top: -14,
                right: 36,
                backgroundColor: currentWord.starred ? '#FFF8E0' : '#F5F5F5',
                border: `1px solid ${currentWord.starred ? '#FFB600' : '#DDD'}`,
                zIndex: 10,
              }}
            >
              <span className="text-base" style={{ color: currentWord.starred ? '#FFB600' : '#CCC' }}>
                {currentWord.starred ? '★' : '☆'}
              </span>
              <span className="text-xs font-medium" style={{ color: currentWord.starred ? '#FFB600' : '#AAA' }}>
                {currentWord.starred ? 'おきにいり ずみ' : 'おきにいりに する'}
              </span>
            </button>
          )}
        </div>

        {/* 回答ボタン + 正解を見る - カードの外、画面下部 */}
        <div className="w-full mt-4 px-1">
          <div style={{ pointerEvents: isAnswering ? 'none' : 'auto', opacity: isAnswering ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            <AnswerButtons onAnswer={handleAnswer} currentWord={current} />
          </div>
          {!revealed && (
            <button
              onClick={() => { setRevealed(true); speakJa(current.back); }}
              className="w-full rounded-2xl font-bold shadow-md transition-all active:scale-95 mt-3"
              style={{
                backgroundColor: '#f09090',
                color: '#fff',
                paddingTop: '1.2rem',
                paddingBottom: '1.2rem',
                fontSize: 16,
              }}
            >
              せいかいを みる
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// pending が全部クールダウン中（直近の「わからない」から15秒以内）の時の待機画面
function CooldownWaitScreen({
  targetTime, pendingCount, onSkipWait,
}: {
  targetTime: number;
  pendingCount: number;
  onSkipWait: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const remainingSec = Math.max(0, Math.ceil((targetTime - now) / 1000));
  return (
    <div
      className="flex flex-col items-center justify-center px-6 text-center"
      style={{ minHeight: '100svh', backgroundColor: '#FFF9F0' }}
    >
      <div style={{ fontSize: 80, lineHeight: 1, marginBottom: 12 }}>⏰</div>
      <h2 className="text-xl font-bold mb-3" style={{ color: '#333' }}>
        ちょっと まってね…
      </h2>
      <p className="text-sm mb-6 leading-relaxed" style={{ color: '#666' }}>
        さっきの ❌ ことばを、{'\n'}あたまの 中で おもいだしてみよう！
      </p>
      <div
        className="rounded-2xl px-8 py-5 mb-6"
        style={{ backgroundColor: '#FFF', border: '2px solid #FFB600' }}
      >
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>のこり</div>
        <div style={{ fontSize: 48, fontWeight: 'bold', color: '#D32F2F', lineHeight: 1 }}>
          {remainingSec}<span style={{ fontSize: 18, marginLeft: 4 }}>びょう</span>
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
          まだ {pendingCount}こ あるよ
        </div>
      </div>
      <button
        onClick={onSkipWait}
        className="px-8 py-3 rounded-2xl font-bold active:scale-95 transition-all"
        style={{ backgroundColor: '#F0F0F0', color: '#888', fontSize: 13 }}
      >
        ホームへ もどる
      </button>
    </div>
  );
}

function AnswerButtons({ onAnswer, currentWord }: { onAnswer: (quality: number) => void; currentWord: Word }) {
  const next = (q: number) => formatNextReviewShort(markAnswered(currentWord, q).nextReviewAt);

  const btnStyle = (bg: string): React.CSSProperties => ({
    backgroundColor: bg,
    fontSize: 16,
    paddingTop: '1.2rem',
    paddingBottom: '1.2rem',
  });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col items-center gap-1">
        <button onClick={() => onAnswer(1)} className="w-full rounded-2xl font-bold shadow-md active:scale-95 transition-all" style={{ ...btnStyle('#a8a7a0'), color: '#fff' }}>
          💭 おぼえてない
        </button>
        <span style={{ fontSize: 11, color: '#BBB' }}>{next(1)}</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <button onClick={() => onAnswer(4)} className="w-full rounded-2xl font-bold shadow-md active:scale-95 transition-all" style={{ ...btnStyle('#f09090'), color: '#fff' }}>
          🌟 おぼえた
        </button>
        <span style={{ fontSize: 11, color: '#BBB' }}>{next(4)}</span>
      </div>
    </div>
  );
}
