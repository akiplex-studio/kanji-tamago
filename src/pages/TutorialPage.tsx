import { useState, useEffect } from 'react';
import type { Word } from '../types/word';
import type { Grade } from '../store/wordStore';

export const TUTORIAL_DONE_KEY = 'kanji-tamago-tutorial-done';

type Props = {
  words: Word[];
  onAnswer: (id: string, quality: number) => void;
  onSkip: (id: string) => void;
  onUnskip: (id: string) => void;
  onComplete: () => void;
  initialStep?: number;
  onNeedSetupHint?: () => void;
  onNeedListHint?: () => void;
  grade?: Grade;
};

// モンスター成長段階（絵文字プレースホルダ）
const MONSTER_FACES = ['🥚', '🐣', '🐥', '🐤', '🌟', '🌟'];

// 各ステップのページを手動で定義（改ページ位置を明示）
// {grade} {count} は動的に置換される
const STEP_PAGE_TEMPLATES: string[][] = [
  // Step 0: アプリの説明
  [
    `ようこそ かんじタマゴへ！\nきみの あいぼうの タマゴが\nここに いるよ 🥚`,
    `このアプリは しょうがく{grade}ねんせいで ならう\nかんじを おぼえるアプリだよ。\nかんじを おぼえると エサが もらえて\nモンスターに あげると そだつよ！\n🥚→🐣→🐥→🐤→🌟`,
    `かしこい しくみで ふくしゅうする じかんを\nじどうで おしえてくれるから\nあんしんしてね。`,
  ],
  // Step 1: フラッシュカード体験
  [
    `まずは ためしに かんじを よんでみよう！\nかんじが でてきたら\nよみかたを こえに だしてみてね。\nよめなくても だいじょうぶだよ。`,
    `さいしょは みんな そうだからね。\nかんじが でるから\nよみかたを かんがえてみてね。\nかんがえたら「こたえを みる」を おしてね。`,
  ],
  // Step 2: 一括モード → 最終ページで一括タブに誘導
  [
    `もう よめる かんじが たくさんある ときは\n「いっかつ」を つかってみてね。`,
  ],
  // Step 3: 単語グリッド → 最終ページで一覧タブに誘導
  [
    `「おぼえた」と こたえたら 🌱 マーク。\n「わからない」と こたえたら ❌ マーク。\nふくしゅうの じかんが きたら\n💔 マークに かわるよ。`,
    `💔が のこらないように\nまいにち すこしずつ ふくしゅう しようね。\n1しゅうかんごも おぼえていたら\n🌟 マークに なるよ！`,
    `ステージを ぜんぶ おぼえたら\nモンスター かんせい！ 🌟`,
  ],
  // Step 4: 単語リスト（一覧ページの吹き出しで表示するため本体では使わない）
  [
    `ここには しょうがく{grade}ねんせいで ならう\nかんじが {count}じ あつまっているよ。`,
    `まいにち すこしずつ おぼえて\nすべての モンスターを かんせい させよう！`,
  ],
  // Step 5: 締めの言葉
  [
    `じゅんびは できたかな？`,
    `かんじを おぼえるたびに タマゴが そだって\nモンスターに しんかするよ 🥚→🐣→🌟`,
    `それじゃあ はじめよう！`,
  ],
];

const LEGEND = [
  { icon: '　', label: 'みがくしゅう' },
  { icon: '🌱', label: 'おぼえた（がくしゅうちゅう）' },
  { icon: '❌', label: 'わからなかった' },
  { icon: '💔', label: 'ふくしゅうが ひつよう' },
  { icon: '🌟', label: '1しゅうかん ごも おぼえた！' },
];

export default function TutorialPage({ words, onAnswer, onSkip: _onSkip, onUnskip: _onUnskip, onComplete, initialStep = 0, onNeedSetupHint, onNeedListHint, grade = 1 }: Props) {
  const [step, setStep] = useState(initialStep);
  const [pageIdx, setPageIdx] = useState(0);

  const wordCount = words.filter(w => !w.isCustom).length;
  const STEP_PAGES: string[][] = STEP_PAGE_TEMPLATES.map(pages =>
    pages.map(p => p.replaceAll('{grade}', String(grade)).replaceAll('{count}', String(wordCount))),
  );

  // Step 1: flashcard
  const [flashWordIds, setFlashWordIds] = useState<string[]>([]);
  const [flashIdx, setFlashIdx] = useState(0);
  const [flashRevealed, setFlashRevealed] = useState(false);
  const [flashDone, setFlashDone] = useState(false);
  // ③ step1 最終ページで「次へ」を押したらセリフを非表示にする
  const [flashSpeechDismissed, setFlashSpeechDismissed] = useState(false);

  useEffect(() => {
    if (words.length === 0) return;
    if (flashWordIds.length === 0) {
      setFlashWordIds(words.filter(w => w.status === 'unlearned').slice(0, 3).map(w => w.id));
    }
  }, [words, flashWordIds.length]);

  // flashDone になったら step2 へ自動進行（step1 のセリフを再表示しない）
  useEffect(() => {
    if (flashDone) {
      setFlashSpeechDismissed(false);
      setStep(2);
      setPageIdx(0);
      setFlashRevealed(false);
    }
  }, [flashDone]);

  const pages = STEP_PAGES[step] ?? [''];
  const isLastPage = pageIdx >= pages.length - 1;
  const isLastStep = step === 5;
  const canProceed = !isLastPage || step !== 1 || flashDone;

  // step1: dismiss後 & 未完了 → セリフを隠して単語画面のみ表示
  const speechHidden = step === 1 && flashSpeechDismissed && !flashDone;
  // インタラクティブコンテンツを持つステップ
  const hasInteractive = step === 1 || step === 3;

  function handleNext() {
    if (!isLastPage) {
      setPageIdx(p => p + 1);
    } else if (step === 2 && onNeedSetupHint) {
      onNeedSetupHint();
    } else if (step === 3 && onNeedListHint) {
      onNeedListHint();
    } else if (!isLastStep) {
      setStep(s => s + 1);
      setPageIdx(0);
      setFlashRevealed(false);
    } else {
      onComplete();
    }
  }

  function handleFlashAnswer(quality: number) {
    const id = flashWordIds[flashIdx];
    if (id) onAnswer(id, quality);
    if (flashIdx >= flashWordIds.length - 1) {
      setFlashDone(true);
    } else {
      setFlashIdx(i => i + 1);
      setFlashRevealed(false);
    }
  }

  const monsterFace = MONSTER_FACES[step] ?? '🥚';

  // ---- sub-renders ----

  function renderFlashcard() {
    if (flashWordIds.length === 0) {
      return (
        <div className="flex items-center justify-center py-8">
          <p style={{ color: '#AAA', fontSize: 14 }}>かんじを よみこみちゅう...</p>
        </div>
      );
    }
    if (flashDone) {
      return (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div style={{ fontSize: 40 }}>🌟</div>
          <p className="font-bold" style={{ color: '#D32F2F' }}>たいけん かんりょう！</p>
          <p style={{ fontSize: 13, color: '#888' }}>3もじの かんじを たいけん しました</p>
        </div>
      );
    }
    const currentId = flashWordIds[flashIdx];
    const current = words.find(w => w.id === currentId);
    if (!current) return null;
    return (
      <div className="flex flex-col gap-3 px-1">
        <p style={{ fontSize: 12, color: '#BBB', textAlign: 'center' }}>
          {flashIdx + 1} / {flashWordIds.length}
        </p>
        <div
          className="rounded-3xl p-6 text-center"
          style={{ backgroundColor: '#FFF', border: '1px solid #FF8A80' }}
        >
          <div className="text-5xl font-bold mb-2" style={{ color: '#333' }}>
            {current.front}
          </div>
          <p style={{ fontSize: 13, color: '#AAA' }}>{current.example_ja}</p>
          {flashRevealed && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #FFD8D8' }}>
              <div className="text-2xl font-bold" style={{ color: '#E55757' }}>
                {current.back}
              </div>
            </div>
          )}
        </div>
        {!flashRevealed ? (
          <div className="flex flex-col items-center gap-1 w-full">
            {/* ③ セリフ非表示後のみ「ここをタップ」を強調 */}
            {speechHidden && (
              <div className="flex flex-col items-center animate-bounce" style={{ color: '#FF8A80', lineHeight: 1 }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>ここをタップ</span>
                <span style={{ fontSize: 16 }}>↓</span>
              </div>
            )}
            <button
              onClick={() => setFlashRevealed(true)}
              className="w-full py-4 rounded-2xl font-medium active:scale-95 transition-all"
              style={{ backgroundColor: '#FFF9F0', border: '2px solid #FF8A80', color: '#FF8A80', fontSize: 15 }}
            >
              こたえを みる
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleFlashAnswer(1)}
              className="py-3 rounded-2xl font-bold active:scale-95 transition-all"
              style={{ backgroundColor: '#a8a7a0', fontSize: 14, color: '#fff' }}
            >
              💭 おぼえてない
            </button>
            <button
              onClick={() => handleFlashAnswer(4)}
              className="py-3 rounded-2xl font-bold active:scale-95 transition-all"
              style={{ backgroundColor: '#f09090', fontSize: 14, color: '#fff' }}
            >
              🌟 おぼえた
            </button>
          </div>
          {/* 回答ボタン直下のモンスター吹き出し */}
          <div
            className="flex gap-2 items-start rounded-2xl p-3"
            style={{ backgroundColor: '#FFF', border: '2px solid #FF8A80' }}
          >
            <div
              aria-label="モンスター"
              style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, backgroundColor: '#FFF9F0' }}
            >
              🥚
            </div>
            <p style={{ fontSize: 12, color: '#333', lineHeight: 1.6, flex: 1 }}>
              よめたら「🌟 おぼえた」を おしてね。{'\n'}「おぼえた」と こたえると モンスターに\nエサが 1こ もらえるよ！🍎
            </p>
          </div>
          </div>
        )}
      </div>
    );
  }

  function renderGrid() {
    const station1Words = words.filter(w => w.station === 1).slice(0, 30);
    return (
      <div className="flex flex-col gap-4 px-1">
        <div className="rounded-2xl p-4" style={{ backgroundColor: '#FFF', border: '1px solid #FFD8D8' }}>
          <p className="font-medium mb-3" style={{ fontSize: 13, color: '#555' }}>アイコンの いみ</p>
          <div className="flex flex-col gap-2">
            {LEGEND.map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  style={{
                    width: 20, height: 20, borderRadius: 3, flexShrink: 0,
                    backgroundColor: icon === '　' ? '#FFF' : 'transparent',
                    border: icon === '　' ? '1px solid rgba(0,0,0,0.12)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, lineHeight: 1,
                  }}
                >
                  {icon}
                </div>
                <span style={{ fontSize: 12, color: '#555' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        {station1Words.length > 0 && (
          <div>
            <p style={{ fontSize: 11, color: '#AAA', marginBottom: 6 }}>
              ステージ1
            </p>
            <div className="flex flex-wrap" style={{ gap: 3 }}>
              {station1Words.map(w => (
                <div
                  key={w.id}
                  style={{
                    width: 20, height: 20, borderRadius: 3,
                    backgroundColor: w.status === 'unlearned' ? '#FFF' : 'transparent',
                    border: w.status === 'unlearned' ? '1px solid rgba(0,0,0,0.1)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, lineHeight: 1,
                  }}
                >
                  {(() => {
                    if (w.status === 'unlearned') return '';
                    if (w.status === 'mastered') return '🌟';
                    if (w.status === 'overdue') return '💔';
                    const rep = w.sm2Repetition ?? 0;
                    if (rep === 0) return '❌';
                    return '🌱';
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ① ① 共通のセリフバブル（全幅、パディングなし）
  const speechBubble = (
    <div
      className="w-full rounded-2xl p-4"
      style={{ backgroundColor: '#FFF', border: '2px solid #FF8A80' }}
    >
      {/* 顔＋台詞テキスト 横並び */}
      <div className="flex gap-3 items-start mb-3">
        <div
          aria-label="モンスター"
          style={{ width: 144, height: 144, flexShrink: 0, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 96, backgroundColor: '#FFF9F0' }}
        >
          {monsterFace}
        </div>
        <p
          className="leading-relaxed whitespace-pre-line flex-1"
          style={{ fontSize: 13, color: '#333', paddingTop: 4 }}
        >
          {pages[pageIdx] ?? ''}
        </p>
      </div>

      {/* ページドット＋ボタン行 */}
      <div className="flex items-center justify-between">
        {pages.length > 1 ? (
          <div className="flex gap-1">
            {pages.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === pageIdx ? 12 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i <= pageIdx ? '#FF8A80' : '#EED5DC',
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
        ) : <div />}
        <div className="flex flex-col items-center gap-1">
          {canProceed ? (
            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-2xl text-white font-bold shadow-md active:scale-95 transition-all"
              style={{
                backgroundColor: isLastStep && isLastPage ? '#D32F2F' : '#FF8A80',
                fontSize: 14,
              }}
            >
              {isLastStep && isLastPage ? 'はじめる 🥚' : 'つぎへ →'}
            </button>
          ) : step === 1 && isLastPage && !flashDone ? (
            /* ③ まずはやってみよう！の次へ → セリフを消して単語画面へ */
            <button
              onClick={() => setFlashSpeechDismissed(true)}
              className="px-5 py-2.5 rounded-2xl text-white font-bold shadow-md active:scale-95 transition-all"
              style={{ backgroundColor: '#FF8A80', fontSize: 14 }}
            >
              つぎへ →
            </button>
          ) : (
            <p style={{ fontSize: 11, color: '#CCC' }}>3もじ ぜんぶ たいけんしてね</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ backgroundColor: '#FFF9F0', zIndex: 200 }}
    >
      {/* Progress dots（常に最前面） */}
      <div
        className="flex-shrink-0 flex justify-center gap-1.5 pt-8 pb-3 px-4"
        style={{ position: 'relative', zIndex: 30 }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            style={{
              width: i === step ? 20 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i <= step ? '#D32F2F' : '#EECDD6',
              transition: 'all 0.3s',
            }}
          />
        ))}
        {step === 0 && (
          <button
            onClick={() => {
              if (window.confirm('チュートリアルを スキップしますか？\nあとから「せってい」で みなおせますよ。')) {
                onComplete();
              }
            }}
            className="absolute active:scale-95 transition-all"
            style={{
              top: 24, right: 12,
              padding: '4px 10px',
              borderRadius: 12,
              backgroundColor: '#FFF',
              border: '1px solid #EED5DC',
              color: '#AAA',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            スキップ
          </button>
        )}
      </div>

      {/* インタラクティブコンテンツ（step1: フラッシュカード、step3: グリッド） */}
      {hasInteractive && (
        <div className="flex-1 overflow-y-auto px-4 py-2" style={{ minHeight: 0 }}>
          {step === 1 && renderFlashcard()}
          {step === 3 && renderGrid()}
        </div>
      )}

      {/* ① 非インタラクティブ：全幅でセリフを中央表示 */}
      {!hasInteractive && !speechHidden && (
        <div className="flex-1 flex items-center pb-8">
          {speechBubble}
        </div>
      )}

      {/* ② インタラクティブ：暗幕＋中央オーバーレイでセリフ表示 */}
      {hasInteractive && !speechHidden && (
        <>
          {/* 暗幕（プログレスドットの下から） */}
          <div
            className="absolute left-0 right-0 bottom-0"
            style={{ top: 60, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 10 }}
            onClick={e => e.stopPropagation()}
          />
          {/* セリフバブルを画面中央に配置 */}
          <div
            className="absolute inset-x-0"
            style={{ top: '50%', transform: 'translateY(-50%)', zIndex: 20 }}
          >
            {speechBubble}
          </div>
        </>
      )}
    </div>
  );
}
