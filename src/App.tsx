import { useState, useEffect, useRef } from 'react';
import { useWordStore } from './store/wordStore';
import { getDueReviewWords, isWordMastered } from './utils/reviewSchedule';
import { getCurrentStation, getAllStations } from './utils/stationProgress';
import { STATION_TIPS } from './data/stationTips';
import SetupPage from './pages/SetupPage';
import HomePage from './pages/HomePage';
import ReviewPage from './pages/ReviewPage';
import WordListPage from './pages/WordListPage';
import TutorialPage, { TUTORIAL_DONE_KEY } from './pages/TutorialPage';
import GradeSelectPage from './pages/GradeSelectPage';
import QuestPage from './pages/QuestPage';
import { WordModal } from './components/WordModal';
import { SettingsModal } from './components/SettingsModal';
import { AppInfoModal } from './components/AppInfoModal';
import { AddWordModal } from './components/AddWordModal';
import { TabBtn } from './components/TabBtn';
import { StationClearModal } from './components/StationClearModal';

const SETUP_DONE_KEY = 'kanji-tamago-setup-done';
const TIP_INDEX_KEY = 'kanji-tamago-tip-index';

type Screen = 'main' | 'setup' | 'review' | 'quest';
type Tab = 'home' | 'list';

export default function App() {
  const [, setTutorialDone] = useState(() => localStorage.getItem(TUTORIAL_DONE_KEY) === 'true');
  const [showTutorial, setShowTutorial] = useState(() => localStorage.getItem(TUTORIAL_DONE_KEY) !== 'true');
  const [tutorialInitialStep, setTutorialInitialStep] = useState(0);
  const [showSetupHint, setShowSetupHint] = useState(false);        // 一括タブへの▼ガイド
  const [setupFromTutorial, setSetupFromTutorial] = useState(false); // 一括をチュートリアルから開いた
  const [showSetupBubble, setShowSetupBubble] = useState(false);     // 一括ページ上のモンスター吹き出し
  const tutorialSetupSkipCount = useRef(0); // チュートリアル中のスキップ数
  const [showSetupEarlyPrompt, setShowSetupEarlyPrompt] = useState(false); // 3語スキップ後の促しポップアップ
  const [showSetupWordHint, setShowSetupWordHint] = useState(false);       // ⑤ 一括: 最初の未設定単語にヒント
  const [showSetupAfterSkipBubble, setShowSetupAfterSkipBubble] = useState(false); // ⑤ スキップ後のモンスター吹き出し
  const [showHomeHint, setShowHomeHint] = useState(false);                 // ⑦ 一覧後: ホームにここをタップ
  const [showListHint, setShowListHint] = useState(false);           // 一覧タブへの▼ガイド
  const [listFromTutorial, setListFromTutorial] = useState(false);   // 一覧をチュートリアルから開いた
  const [showListBubble, setShowListBubble] = useState(false);       // 一覧ページ上のモンスター吹き出し
  const [listBubblePage, setListBubblePage] = useState(0);           // 吹き出しのページ
  const [setupDone, setSetupDone] = useState(() => localStorage.getItem(SETUP_DONE_KEY) === 'true');
  const [screen, setScreen] = useState<Screen>(() => localStorage.getItem(SETUP_DONE_KEY) === 'true' ? 'main' : 'setup');
  const [tab, setTab] = useState<Tab>('home');
  const [showSettings, setShowSettings] = useState(false);
  const [showAppInfo, setShowAppInfo] = useState(false);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [navWordIds, setNavWordIds] = useState<string[]>([]);
  const [showStationClear, setShowStationClear] = useState(false);
  const [clearedStation, setClearedStation] = useState<{ num: number; name: string } | null>(null);
  const prevCompleteStations = useRef<Set<number> | null>(null);
  const [showStationTip, setShowStationTip] = useState(false);
  const [stationTipPages, setStationTipPages] = useState<string[]>([]);
  const [stationTipPageIdx, setStationTipPageIdx] = useState(0);
  const [isEndingTip, setIsEndingTip] = useState(false);
  const [isReviewingTip, setIsReviewingTip] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showConversationList, setShowConversationList] = useState(false);
  const [, setTick] = useState(0);
  const { words, grade, setGrade, monsterState, questState, feedMonster, feedAdult, graduateMonster, finishBattle, hatchMermaidEgg, skipWord, unskipWord, answerWord, toggleStar, updateMemo, updateCustomFront, addCustomWord, deleteCustomWord, exportProgress, importProgress } = useWordStore();
  const [showGradeChange, setShowGradeChange] = useState(false);
  const [showAddWord, setShowAddWord] = useState(false);
  const [showGradePromotion, setShowGradePromotion] = useState(false);

  // ロック画面の残り時間更新（30秒ごと）
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // 現在の学年の単語を全部「おぼえた」にしたら次学年への昇格を促す
  useEffect(() => {
    if (grade === null || grade >= 6) return;
    const gradeWords = words.filter(w => !w.isCustom && w.level === grade);
    if (gradeWords.length === 0) return;
    const allLearned = gradeWords.every(w => (w.sm2Repetition ?? 0) >= 1);
    if (!allLearned) return;
    const promoKey = `kanji-tamago-grade-promo-${grade}`;
    if (localStorage.getItem(promoKey) === 'true') return; // 1学年につき1回だけ
    localStorage.setItem(promoKey, 'true');
    // ステージクリア演出と被らないよう少しだけ遅延
    const t = setTimeout(() => setShowGradePromotion(true), 800);
    return () => clearTimeout(t);
  }, [words, grade]);

  // 単元クリア検知（初回クリア時のみ演出を表示）
  useEffect(() => {
    const byStation = new Map<number, typeof words>();
    for (const w of words) {
      if (!byStation.has(w.station)) byStation.set(w.station, []);
      byStation.get(w.station)!.push(w);
    }
    const completeNow = new Set<number>();
    for (const [s, ws] of byStation) {
      // 1回でも全単語を「おぼえた」回答済み → ステージクリア（getCurrentStation の判定と同じ）
      if (ws.length > 0 && ws.every(w => (w.sm2Repetition ?? 0) >= 1)) {
        completeNow.add(s);
      }
    }

    // 過去に一度でもクリアした単元をlocalStorageから読み込む
    const everClearedRaw = localStorage.getItem('kanji-tamago-cleared-stations');
    const everCleared = new Set<number>(everClearedRaw ? JSON.parse(everClearedRaw) : []);

    if (prevCompleteStations.current === null) {
      prevCompleteStations.current = completeNow;
      // 起動時点で完了している単元はすでにクリア済みとして記録（演出は出さない）
      for (const s of completeNow) everCleared.add(s);
      localStorage.setItem('kanji-tamago-cleared-stations', JSON.stringify([...everCleared]));
      return;
    }
    for (const s of completeNow) {
      if (!prevCompleteStations.current.has(s) && !everCleared.has(s)) {
        // 初回クリアのみ演出を表示
        const ws = byStation.get(s)!;
        setClearedStation({ num: s, name: ws[0]?.station_name ?? '' });
        setShowStationClear(true);
        everCleared.add(s);
        localStorage.setItem('kanji-tamago-cleared-stations', JSON.stringify([...everCleared]));
        break;
      }
    }
    prevCompleteStations.current = completeNow;
  }, [words]);

  function completeTutorial() {
    localStorage.setItem(TUTORIAL_DONE_KEY, 'true');
    localStorage.setItem(SETUP_DONE_KEY, 'true');
    setTutorialDone(true);
    setSetupDone(true);
    setShowTutorial(false);
    setScreen('main');
  }

  function restartTutorial() {
    localStorage.removeItem(TUTORIAL_DONE_KEY);
    setTutorialDone(false);
    setTutorialInitialStep(0);
    setShowTutorial(true);
    setShowSettings(false);
  }

  // step2（一括）の台詞が終わったらホーム画面に誘導
  function handleNeedSetupHint() {
    // setupDone を true にしてフッター付きレイアウトで一括ページを開けるようにする
    localStorage.setItem(SETUP_DONE_KEY, 'true');
    setSetupDone(true);
    setShowTutorial(false);
    setShowSetupHint(true);
    setTutorialInitialStep(3);
    setScreen('main');
    setTab('home');
  }

  // 桜グリッドステップ終了：チュートリアルを中断して一覧タブに誘導
  function handleNeedListHint() {
    setShowTutorial(false);
    setShowListHint(true);
    setTutorialInitialStep(5);   // 一覧から戻ったらStep5（締め）を再開
    setScreen('main');
    setTab('home');
  }

  // 一括ページの完了 → ホームに戻り、チュートリアルから来た場合はStep3を再開
  function handleSetupComplete() {
    setSetupFromTutorial(false);
    setShowSetupBubble(false);
    setShowSetupEarlyPrompt(false);
    setShowSetupWordHint(false);
    setShowSetupAfterSkipBubble(false);
    tutorialSetupSkipCount.current = 0;
    setScreen('main');
    if (setupFromTutorial) {
      setShowTutorial(true);
    }
  }

  // チュートリアル中の一括スキップ
  function handleSetupSkip(id: string) {
    skipWord(id);
    if (setupFromTutorial) {
      // ⑤ ワードヒント中の最初のスキップ → 「想像と違ったら」吹き出しへ
      if (showSetupWordHint) {
        setShowSetupWordHint(false);
        setShowSetupAfterSkipBubble(true);
        return;
      }
      tutorialSetupSkipCount.current += 1;
      if (tutorialSetupSkipCount.current >= 3) setShowSetupEarlyPrompt(true);
    }
  }

  // 学年未選択（初回起動）→ 学年選択画面を最優先で表示
  if (grade === null) {
    return (
      <GradeSelectPage
        onSelect={(g) => setGrade(g)}
      />
    );
  }

  // チュートリアル表示中
  if (showTutorial) {
    return (
      <TutorialPage
        words={words}
        onAnswer={answerWord}
        onSkip={skipWord}
        onUnskip={unskipWord}
        onComplete={completeTutorial}
        initialStep={tutorialInitialStep}
        onNeedSetupHint={handleNeedSetupHint}
        onNeedListHint={handleNeedListHint}
        grade={grade}
      />
    );
  }

  const dueCount = getDueReviewWords(words).length;
  const selectedWord = selectedWordId ? words.find(w => w.id === selectedWordId) : null;
  const navIdx = selectedWordId ? navWordIds.indexOf(selectedWordId) : -1;
  const navPrevId = navIdx > 0 ? navWordIds[navIdx - 1] : null;
  const navNextId = navIdx >= 0 && navIdx < navWordIds.length - 1 ? navWordIds[navIdx + 1] : null;

  const currentStation = getCurrentStation(words);

  function completeSetup() {
    localStorage.setItem(SETUP_DONE_KEY, 'true');
    setSetupDone(true);
    setScreen('main');
  }

  // 初回セットアップはフッターなし・全画面
  if (screen === 'setup' && !setupDone) {
    return (
      <div>
        <SetupPage
          words={words}
          onSkip={skipWord}
          onUnskip={unskipWord}
          onComplete={completeSetup}
          canSkipAll={false}
          currentStation={currentStation}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100svh', position: 'relative' }}>
      <div style={{ paddingBottom: 80 }}>
        {screen === 'setup' && (
          <SetupPage
            words={words}
            onSkip={setupFromTutorial ? handleSetupSkip : skipWord}
            onUnskip={unskipWord}
            onComplete={handleSetupComplete}
            canSkipAll={true}
            onBack={setupFromTutorial ? handleSetupComplete : undefined}
            currentStation={currentStation}
            tutorialHintWordId={showSetupWordHint ? words.find(w => w.status === 'unlearned' && w.station <= currentStation)?.id : undefined}
          />
        )}
        {screen === 'quest' && (
          <QuestPage
            monsterState={monsterState}
            questState={questState}
            onClose={() => setScreen('main')}
            onFinishBattle={finishBattle}
            onHatchMermaidEgg={hatchMermaidEgg}
          />
        )}
        {screen === 'review' && (
          <ReviewPage
            words={words}
            onAnswer={answerWord}
            onDone={() => setScreen('main')}
            onChangeGrade={() => { setScreen('main'); setShowGradeChange(true); }}
            onToggleStar={toggleStar}
            onUpdateMemo={updateMemo}
            onUpdateCustomFront={updateCustomFront}
            foodInventory={monsterState.foodInventory}
          />
        )}
        {screen === 'main' && tab === 'home' && grade !== null && (
          <HomePage
            words={words}
            onSelectWord={id => setSelectedWordId(id)}
            monsterState={monsterState}
            feedMonster={feedMonster}
            feedAdult={feedAdult}
            graduateMonster={graduateMonster}
            onRequestReview={() => setScreen('review')}
          />
        )}
        {screen === 'main' && tab === 'list' && (
          <WordListPage
            words={words}
            onSelectWord={(id, navIds) => { setSelectedWordId(id); setNavWordIds(navIds); }}
            onOpenAddWord={() => setShowAddWord(true)}
          />
        )}
      </div>

      {/* 単語詳細モーダル */}
      {selectedWord && (
        <WordModal
          word={selectedWord}
          onClose={() => setSelectedWordId(null)}
          onToggleStar={toggleStar}
          onDelete={deleteCustomWord}
          prevId={navPrevId}
          nextId={navNextId}
          onNavigate={id => setSelectedWordId(id)}
        />
      )}

      {/* 単元クリア演出（クリア時のヒントモーダルは内容がステージと合わないため非表示） */}
      {showStationClear && clearedStation && (
        <StationClearModal
          station={clearedStation}
          onClose={() => setShowStationClear(false)}
        />
      )}

      {/* モンスターのヒントモーダル */}
      {showStationTip && (
        <div
          className="fixed inset-0 flex items-center justify-center px-4"
          style={{ zIndex: 250, backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="w-full rounded-2xl p-4"
            style={{ backgroundColor: '#FFF', border: '2px solid #FF8A80', maxWidth: 390 }}
          >
            <div className="flex gap-3 items-start mb-3">
              <div
                aria-label="モンスター"
                style={{ width: 100, height: 100, borderRadius: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, backgroundColor: '#FFF9F0' }}
              >
                🥚
              </div>
              <p
                className="leading-relaxed whitespace-pre-line flex-1"
                style={{ fontSize: 13, color: '#333', paddingTop: 4 }}
              >
                {stationTipPages[stationTipPageIdx]}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {stationTipPages.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === stationTipPageIdx ? 12 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: i <= stationTipPageIdx ? '#FF8A80' : '#EED5DC',
                      transition: 'all 0.2s',
                    }}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  if (stationTipPageIdx < stationTipPages.length - 1) {
                    setStationTipPageIdx(i => i + 1);
                  } else {
                    setShowStationTip(false);
                    if (isEndingTip && !isReviewingTip) setShowComplete(true);
                  }
                }}
                className="px-5 py-2.5 rounded-2xl text-white font-bold shadow-md active:scale-95 transition-all"
                style={{ backgroundColor: '#FF8A80', fontSize: 14 }}
              >
                {stationTipPageIdx < stationTipPages.length - 1 ? '次へ →' : 'とじる'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE 画面 */}
      {showComplete && (() => {
        const masteredCount = words.filter(w => isWordMastered(w)).length;
        const fallingPetals = Array.from({ length: 60 }, (_, i) => ({
          key: i,
          left: Math.random() * 100,
          size: 16 + Math.random() * 24,
          duration: 3 + Math.random() * 4,
          delay: Math.random() * 4,
          drift: (Math.random() - 0.5) * 150,
        }));
        return (
          <div
            className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
            style={{ backgroundColor: '#FFF9F0', zIndex: 300 }}
            onClick={() => setShowComplete(false)}
          >
            {/* 落下花びら */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 310 }}>
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
                  🌟
                </div>
              ))}
            </div>
            <div className="relative flex flex-col items-center px-6 text-center" style={{ zIndex: 320 }}>
              <div
                className="font-black mb-2"
                style={{
                  fontSize: 56,
                  color: '#D32F2F',
                  textShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  animation: 'great-pop 0.8s ease-out forwards',
                  letterSpacing: '-1px',
                  lineHeight: 1,
                }}
              >
                COMPLETE
              </div>
              <div className="text-4xl mb-6">🌟🌟🌟</div>
              <div
                className="rounded-2xl px-8 py-5 mb-6"
                style={{ backgroundColor: 'rgba(255,255,255,0.85)', border: '2px solid #FF8A80' }}
              >
                <p className="text-sm mb-3" style={{ color: '#888' }}>ぜんぶの たんげんを クリアしました！</p>
                <p style={{ fontSize: 40, fontWeight: 'bold', color: '#D32F2F', lineHeight: 1 }}>
                  {masteredCount}
                </p>
                <p className="text-sm mt-1" style={{ color: '#AAA' }}>びきの モンスターが そだちました 🌟</p>
              </div>
              <p style={{ fontSize: 12, color: '#BBB' }}>タップして閉じる</p>
            </div>
          </div>
        );
      })()}

      {/* モンスターとの会話一覧 */}
      {showConversationList && (() => {
        const tipIndex = parseInt(localStorage.getItem(TIP_INDEX_KEY) ?? '0', 10);
        const stageCount = getAllStations(words).length;
        const allEntries = STATION_TIPS.slice(0, Math.max(stageCount, 1));
        return (
          <div
            className="fixed inset-0 flex flex-col"
            style={{ zIndex: 200, backgroundColor: '#FFF9F0' }}
          >
            <div className="flex items-center px-4 pt-8 pb-3 flex-shrink-0">
              <button
                onClick={() => setShowConversationList(false)}
                className="text-sm mr-3"
                style={{ color: '#888' }}
              >
                ← 戻る
              </button>
              <h2 className="text-base font-bold" style={{ color: '#333' }}>📖 モンスターとの会話</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-8" style={{ minHeight: 0 }}>
              <div className="flex flex-col gap-2">
                {allEntries.map((entry, i) => {
                  const unlocked = i < tipIndex;
                  return (
                    <button
                      key={i}
                      disabled={!unlocked}
                      onClick={() => {
                        if (!unlocked) return;
                        setStationTipPages(entry.pages);
                        setStationTipPageIdx(0);
                        setIsEndingTip(false);
                        setIsReviewingTip(true);
                        setShowConversationList(false);
                        setShowStationTip(true);
                      }}
                      className="w-full rounded-2xl px-4 py-3 text-left active:scale-95 transition-all"
                      style={{
                        backgroundColor: unlocked ? '#FFF' : '#F5F5F5',
                        border: `1px solid ${unlocked ? '#FF8A80' : '#EEE'}`,
                        cursor: unlocked ? 'pointer' : 'default',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 16 }}>{unlocked ? '🌟' : '🔒'}</span>
                        <span
                          className="text-sm font-medium"
                          style={{ color: unlocked ? '#D32F2F' : '#BBB' }}
                        >
                          {unlocked ? entry.title : `第${i + 1}話 🔒`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 設定モーダル */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onExport={exportProgress}
          onImport={importProgress}
          onRestartTutorial={restartTutorial}
          onOpenConversationList={() => { setShowSettings(false); setShowConversationList(true); }}
          onOpenAppInfo={() => { setShowSettings(false); setShowAppInfo(true); }}
          onChangeGrade={() => { setShowSettings(false); setShowGradeChange(true); }}
          grade={grade}
        />
      )}

      {/* マイかんじ追加モーダル */}
      {showAddWord && (
        <AddWordModal
          onClose={() => setShowAddWord(false)}
          onAdd={addCustomWord}
        />
      )}

      {/* 学年クリア → 次学年への昇格を促すモーダル */}
      {showGradePromotion && grade !== null && grade < 6 && (
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{ zIndex: 250, backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={() => setShowGradePromotion(false)}
        >
          <div
            className="w-full rounded-3xl shadow-2xl p-7 text-center"
            style={{ backgroundColor: '#FFF', maxWidth: 340 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>🎉</div>
            <h2 className="text-xl font-black mb-2" style={{ color: '#D32F2F' }}>
              しょうがく{grade}ねんせいの<br />かんじ ぜんぶ おぼえたよ！
            </h2>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: '#666' }}>
              すごい！がんばったね 🌟<br />
              つぎの がくねんに すすんでみる？
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowGradePromotion(false);
                  setShowGradeChange(true);
                }}
                className="w-full py-3 rounded-2xl text-white font-bold shadow-md active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #FF8A80 0%, #D32F2F 100%)', fontSize: 16 }}
              >
                🎒 つぎの がくねんに すすむ
              </button>
              <button
                onClick={() => setShowGradePromotion(false)}
                className="w-full py-2.5 rounded-2xl font-medium text-sm active:scale-95 transition-all"
                style={{ backgroundColor: '#F0F0F0', color: '#888' }}
              >
                あとで
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 学年変更画面（設定から呼ばれる） */}
      {showGradeChange && (
        <div className="fixed inset-0" style={{ zIndex: 200 }}>
          <GradeSelectPage
            current={grade}
            title="がくねんを えらびなおす"
            onSelect={(g) => {
              if (g !== grade) {
                // 学年が変わると ステージ構成が変わるため、クリア済みステージ情報とTip進捗をリセット
                localStorage.removeItem('kanji-tamago-cleared-stations');
                localStorage.removeItem(TIP_INDEX_KEY);
                prevCompleteStations.current = null;
              }
              setGrade(g);
              setShowGradeChange(false);
            }}
            onBack={() => setShowGradeChange(false)}
          />
        </div>
      )}

      {showAppInfo && (
        <AppInfoModal onClose={() => setShowAppInfo(false)} />
      )}

      {/* 一覧タブへの▼ガイド（チュートリアルStep4後） */}
      {showListHint && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: 'calc(30% + 10px)',
            transform: 'translateX(-50%)',
            zIndex: 50,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 'bold', color: '#D32F2F', marginBottom: 2, whiteSpace: 'nowrap' }}>
            ここをタップ！
          </p>
          <div
            style={{
              fontSize: 28,
              color: '#D32F2F',
              animation: 'tutorial-bounce 0.7s ease-in-out infinite',
              display: 'inline-block',
            }}
          >
            ▼
          </div>
        </div>
      )}

      {/* 一括タブへの▼ガイド（チュートリアルStep2後） */}
      {showSetupHint && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: 'calc(70% + 10px)',
            transform: 'translateX(-50%)',
            zIndex: 50,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 'bold', color: '#D32F2F', marginBottom: 2, whiteSpace: 'nowrap' }}>
            ここをタップ！
          </p>
          <div
            style={{
              fontSize: 28,
              color: '#D32F2F',
              animation: 'tutorial-bounce 0.7s ease-in-out infinite',
              display: 'inline-block',
              transformOrigin: 'center top',
            }}
          >
            ▼
          </div>
        </div>
      )}

      {/* 一覧ページ：モンスターのミニ吹き出し（Step4台詞） */}
      {showListBubble && screen === 'main' && tab === 'list' && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: 0,
            right: 0,
            zIndex: 60,
            padding: '0 16px',
          }}
        >
          <div
            className="rounded-2xl p-3 shadow-lg"
            style={{ backgroundColor: '#FFF', border: '2px solid #FF8A80', maxWidth: 390, margin: '0 auto' }}
          >
            <div className="flex gap-3 items-start mb-2">
              <div
                aria-label="モンスター"
                style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, backgroundColor: '#FFF9F0' }}
              >
                🥚
              </div>
              <p style={{ fontSize: 13, color: '#333', lineHeight: 1.6, whiteSpace: 'pre-line', flex: 1, paddingTop: 2 }}>
                {listBubblePage === 0
                  ? `この一覧には 小${grade}で ならう かんじが\n${words.filter(w => !w.isCustom).length}字 あつまっていますよ。`
                  : `毎日 すこしずつ おぼえていけば\nモンスターが どんどん そだちます！`}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {[0, 1].map(i => (
                  <div
                    key={i}
                    style={{
                      width: i === listBubblePage ? 12 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: i <= listBubblePage ? '#FF8A80' : '#EED5DC',
                      transition: 'all 0.2s',
                    }}
                  />
                ))}
              </div>
              {listBubblePage === 0 ? (
                <button
                  onClick={() => setListBubblePage(1)}
                  className="px-4 py-1.5 rounded-2xl font-medium text-sm active:scale-95 transition-all"
                  style={{ backgroundColor: '#FF8A80', color: '#FFF' }}
                >
                  次へ →
                </button>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex flex-col items-center animate-bounce" style={{ color: '#FF8A80', lineHeight: 1 }}>
                    <span style={{ fontSize: 10, fontWeight: 700 }}>ここをタップ</span>
                    <span style={{ fontSize: 14 }}>↓</span>
                  </div>
                  <button
                    onClick={() => { setShowListBubble(false); setShowHomeHint(true); }}
                    className="px-4 py-1.5 rounded-2xl font-medium text-sm active:scale-95 transition-all"
                    style={{ backgroundColor: '#FF8A80', color: '#FFF' }}
                  >
                    閉じる
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 一括ページ：モンスターのミニ吹き出し */}
      {showSetupBubble && screen === 'setup' && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: 0,
            right: 0,
            zIndex: 60,
            padding: '0 16px',
          }}
        >
          <div
            className="flex gap-3 items-end rounded-2xl p-3 shadow-lg"
            style={{ backgroundColor: '#FFF', border: '2px solid #FF8A80', maxWidth: 390, margin: '0 auto' }}
          >
            <div
              aria-label="モンスター"
              style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, backgroundColor: '#FFF9F0' }}
            >
              🥚
            </div>
            <div className="flex-1">
              <p style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>
                この がめんでは もう よめる かんじを{'\n'}まとめて OKに できるよ。{'\n'}まだ よめない かんじだけに しゅうちゅう できて{'\n'}とっても らくだよ。
              </p>
            </div>
            <button
              onClick={() => {
                setShowSetupBubble(false);
                if (setupFromTutorial) setShowSetupWordHint(true); // ⑤
              }}
              style={{ fontSize: 18, color: '#CCC', alignSelf: 'flex-start', lineHeight: 1, padding: '0 4px' }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ⑤ 一括ページ：スキップ後のモンスター吹き出し（違ったら） */}
      {showSetupAfterSkipBubble && screen === 'setup' && (
        <div
          style={{ position: 'fixed', bottom: 80, left: 0, right: 0, zIndex: 65, padding: '0 16px' }}
        >
          <div
            className="flex gap-3 items-end rounded-2xl p-3 shadow-lg"
            style={{ backgroundColor: '#FFF', border: '2px solid #FF8A80', maxWidth: 390, margin: '0 auto' }}
          >
            <div
              aria-label="モンスター"
              style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, backgroundColor: '#FFF9F0' }}
            >
              🥚
            </div>
            <div className="flex-1">
              <p style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>
                もし よめなかったら{'\n'}もう一度 タップして がくしゅうちゅうに もどしてね
              </p>
            </div>
            <button
              onClick={() => setShowSetupAfterSkipBubble(false)}
              style={{ fontSize: 18, color: '#CCC', alignSelf: 'flex-start', lineHeight: 1, padding: '0 4px' }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ⑦ 一覧チュートリアル後：ホームタブにここをタップ */}
      {showHomeHint && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: 'calc(10% + 10px)',
            transform: 'translateX(-50%)',
            zIndex: 50,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 'bold', color: '#D32F2F', marginBottom: 2, whiteSpace: 'nowrap' }}>
            ここをタップ！
          </p>
          <div
            style={{
              fontSize: 28,
              color: '#D32F2F',
              animation: 'tutorial-bounce 0.7s ease-in-out infinite',
              display: 'inline-block',
            }}
          >
            ▼
          </div>
        </div>
      )}

      {/* 一括ページ：3語スキップ後の促しポップアップ */}
      {showSetupEarlyPrompt && screen === 'setup' && (
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{ zIndex: 90, backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <div
            className="w-full rounded-3xl shadow-xl p-7 text-center"
            style={{ backgroundColor: '#FFF', maxWidth: 340 }}
          >
            <div
              aria-label="モンスター"
              style={{ width: 80, height: 80, margin: '0 auto 16px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, backgroundColor: '#FFF9F0' }}
            >
              🥚
            </div>
            <p className="font-bold mb-3" style={{ fontSize: 17, color: '#333' }}>
              その ちょうしだよ！
            </p>
            <p className="text-sm mb-7 leading-relaxed" style={{ color: '#666' }}>
              この いっかつせっていは あとからでも できるから{'\n'}まずは つぎに すすもう
            </p>
            <button
              onClick={handleSetupComplete}
              className="w-full py-3.5 rounded-2xl text-white font-bold shadow-md active:scale-95 transition-all"
              style={{ backgroundColor: '#FF8A80', fontSize: 15 }}
            >
              次へ →
            </button>
          </div>
        </div>
      )}

      {/* フッター（5タブ） */}
      <nav
        className="flex items-center border-t"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFF',
          borderColor: '#FFCDD2',
          height: 80,
          zIndex: 40,
        }}
      >
        <TabBtn
          icon="🏠"
          label="ホーム"
          active={screen === 'main' && tab === 'home'}
          onClick={() => {
            setScreen('main');
            setTab('home');
            setShowHomeHint(false);
            if (listFromTutorial) {
              setListFromTutorial(false);
              setShowTutorial(true);
            }
          }}
        />
        <TabBtn
          icon="📝"
          label="リスト"
          active={screen === 'main' && tab === 'list'}
          onClick={() => {
            setScreen('main');
            setTab('list');
            if (showListHint) {
              setShowListHint(false);
              setListFromTutorial(true);
              setShowListBubble(true);
              setListBubblePage(0);
            }
          }}
        />
        {/* 学習タブ：主要アクション。円形のFAB風で一番目立つボタン */}
        <div className="flex-1 flex items-end justify-center relative" style={{ height: '100%' }}>
          <button
            onClick={() => setScreen('review')}
            aria-label="がくしゅう"
            className="flex flex-col items-center justify-center active:scale-95 transition-all relative"
            style={{
              width: 78,
              height: 78,
              borderRadius: '50%',
              background: screen === 'review'
                ? 'linear-gradient(135deg, #FF8A80 0%, #D32F2F 100%)'
                : 'linear-gradient(135deg, #FFB0AB 0%, #D63838 100%)',
              boxShadow: screen === 'review'
                ? '0 6px 18px rgba(212,83,126,0.55), 0 0 0 4px #FFF, 0 0 0 6px #FF8A80'
                : '0 4px 14px rgba(212,83,126,0.4), 0 0 0 4px #FFF, 0 0 0 6px #FFCDD2',
              transform: 'translateY(-22px)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span style={{ fontSize: 34, lineHeight: 1, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))' }}>🥚</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#FFF', marginTop: 2, textShadow: '0 1px 2px rgba(0,0,0,0.25)' }}>がくしゅう</span>
            {dueCount > 0 && (
              <div
                className="absolute flex items-center justify-center rounded-full font-bold text-white"
                style={{
                  top: -4, right: -4,
                  minWidth: 24, height: 24,
                  fontSize: 12, backgroundColor: '#A32D2D',
                  padding: '0 5px',
                  border: '2px solid #FFF',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                }}
              >
                {dueCount}
              </div>
            )}
          </button>
          {/* 次回 要復習までのカウントダウン（円の上） */}
          <NextReviewCountdown words={words} />
        </div>
        {/* 一括タブ：子供の学習には不要なため非表示。機能本体・ロジックは残しているので
            将来復活させたい場合は false を true（または条件式）に変えるだけで再表示可能 */}
        {false && (
          <TabBtn
            icon="✨"
            label="一括"
            active={screen === 'setup'}
            onClick={() => {
              setScreen('setup');
              if (showSetupHint) {
                setShowSetupHint(false);
                setSetupFromTutorial(true);
                setShowSetupBubble(true);
                tutorialSetupSkipCount.current = 0;
                setShowSetupEarlyPrompt(false);
              }
            }}
          />
        )}
        {/* slot 5：クエストボタン（学習センターとせっていの間） */}
        <TabBtn
          icon="⚔️"
          label="クエスト"
          active={screen === 'quest'}
          onClick={() => setScreen('quest')}
        />
        <TabBtn
          icon="⚙️"
          label="せってい"
          active={showSettings}
          onClick={() => setShowSettings(true)}
        />
      </nav>
    </div>
  );
}

// 次の「要復習」が出るまでの残り時間を学習ボタンの上に表示する
// 15秒以内の cooldown も含めて秒単位で更新（残り時間に応じて tick 間隔を可変）
function NextReviewCountdown({ words }: { words: Array<{
  status: string;
  nextReviewAt: number | null;
}> }) {
  const [now, setNow] = useState(Date.now());

  // 未来の最早 nextReviewAt（mastered と未学習は除外）
  const nextAt = (() => {
    let earliest: number | null = null;
    const t = Date.now();
    for (const w of words) {
      if (w.status === 'mastered') continue;
      if (w.nextReviewAt === null) continue;
      if (w.nextReviewAt === Number.MAX_SAFE_INTEGER) continue;
      if (w.nextReviewAt <= t) continue; // 既に出ている分は除外
      if (earliest === null || w.nextReviewAt < earliest) earliest = w.nextReviewAt;
    }
    return earliest;
  })();

  useEffect(() => {
    if (nextAt === null) return;
    const remaining = nextAt - Date.now();
    // 1分以内は0.5秒刻みで秒表示を更新、それ以外は15秒刻み
    const intervalMs = remaining < 60_000 ? 500 : 15_000;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [nextAt]);

  if (nextAt === null) return null;
  const diffMs = nextAt - now;
  if (diffMs <= 0) return null;
  // 20時間以上先（=翌日や数日後の復習）は表示しない
  if (diffMs > 20 * 60 * 60_000) return null;

  let text: string;
  if (diffMs < 60_000) {
    const sec = Math.max(1, Math.ceil(diffMs / 1000));
    text = `つぎ ${sec}びょう`;
  } else if (diffMs < 60 * 60_000) {
    const min = Math.ceil(diffMs / 60_000);
    text = `つぎ ${min}ぷん`;
  } else if (diffMs < 24 * 60 * 60_000) {
    const h = Math.floor(diffMs / (60 * 60_000));
    text = `つぎ ${h}じかん`;
  } else {
    const d = Math.floor(diffMs / (24 * 60 * 60_000));
    text = `つぎ ${d}にち`;
  }

  return (
    <span style={{
      position: 'absolute',
      bottom: 'calc(100% + 22px)', // 学習ボタンの円より上に表示
      left: '50%',
      transform: 'translateX(-50%)',
      fontSize: 10,
      color: '#D32F2F',
      fontWeight: 700,
      whiteSpace: 'nowrap',
      backgroundColor: 'rgba(255,255,255,0.95)',
      padding: '2px 8px',
      borderRadius: 8,
      boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
      border: '1px solid #FFCDD2',
      pointerEvents: 'none',
    }}>
      {text}
    </span>
  );
}

