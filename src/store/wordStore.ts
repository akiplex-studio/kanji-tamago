import { useState, useEffect } from 'react';
import type { Word } from '../types/word';
import type { ProgressSnapshot } from '../types/progress';
import { getWordStatus, markAnswered } from '../utils/reviewSchedule';
import { extractProgress, applyProgress, mergeProgress, parseSnapshot } from '../utils/progressUtils';
import { addDailyWrongId, getDailyWrongIds, DAILY_WRONG_LIMIT } from '../utils/dailyLimit';
import {
  loadMonsterState, saveMonsterState, isAdult, pickNextSpecies, MAX_COLLECTION, MAX_FED,
  makeAdult, addExpTo, MAX_LEVEL,
  type MonsterState, type AdultMonster,
} from '../utils/monsterState';
import {
  loadQuestState, saveQuestState, advanceTier, TOTAL_STAGES, MERMAID_BY_TIER,
  type DifficultyTier, type QuestState,
} from '../utils/questState';

const MAX_FED_EXPORT = MAX_FED;

const STORAGE_KEY = 'kanji-tamago-words';
const MASTER_VERSION_KEY = 'kanji-tamago-master-version';
const DATA_VERSION_KEY = 'kanji-tamago-data-version';
const CURRENT_DATA_VERSION = 'kanji-v13-g3-meanings';
export const GRADE_KEY = 'kanji-tamago-grade';
export type Grade = 1 | 2 | 3 | 4 | 5 | 6;
export const DEFAULT_GRADE: Grade = 1;

export function loadGrade(): Grade | null {
  const raw = localStorage.getItem(GRADE_KEY);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (n >= 1 && n <= 6) return n as Grade;
  return null;
}

export function saveGrade(grade: Grade) {
  localStorage.setItem(GRADE_KEY, String(grade));
}

// 単語データが切り替わった場合に学習データをリセット
function resetIfNeeded() {
  if (localStorage.getItem(DATA_VERSION_KEY) !== CURRENT_DATA_VERSION) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MASTER_VERSION_KEY);
    localStorage.removeItem('kanji-tamago-setup-done');
    localStorage.removeItem('kanji-tamago-daily-wrong');
    localStorage.removeItem('kanji-tamago-stage-progress');
    localStorage.removeItem('kanji-tamago-monster-state');
    localStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
    console.log('🥚 漢字データが更新されたため、学習データをリセットしました');
  }
}

function loadWords(): Word[] {
  resetIfNeeded();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as Word[];
  } catch { /* ignore */ }
  return [];
}

function saveWords(words: Word[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

// マスターデータ（allWords.json）を動的に読み込んでマージする
async function mergeWithMaster(current: Word[]): Promise<Word[] | null> {
  try {
    const mod = await import('../data/preset/allWords.json');
    const master = mod.default as Omit<Word, 'status' | 'learnedAt' | 'nextReviewAt' | 'reviewStage' | 'sm2Repetition' | 'sm2Interval' | 'sm2Efactor'>[];
    const masterVersion = `${master.length}-ngsl`;
    const savedVersion = localStorage.getItem(MASTER_VERSION_KEY);

    // すでに同じバージョンをマージ済みならスキップ
    if (savedVersion === masterVersion) return null;

    const currentMap = new Map(current.map(w => [w.id, w]));

    // 新規単語を追加
    const newWords: Word[] = master
      .filter(w => !currentMap.has(w.id))
      .map(w => ({
        ...w,
        status: 'unlearned' as const,
        learnedAt: null,
        nextReviewAt: null,
        reviewStage: 0,
        sm2Repetition: 0,
        sm2Interval: 0,
        sm2Efactor: 2.5,
        correctCount: 0,
      }));

    // 既存単語のマスターフィールド（note等）を更新（ユーザーの学習データは保持）
    const updated: Word[] = current.map(w => {
      if (w.isCustom) return w; // カスタム単語はマスターデータで上書きしない
      const m = master.find(mw => mw.id === w.id);
      if (!m) return w;
      // customFront はユーザーが編集した問題文なので上書きしない
      return { ...w, back: m.back, front: m.front, example_en: m.example_en, example_ja: m.example_ja, level: m.level, station: m.station, station_name: m.station_name, sfi_rank: m.sfi_rank, note: m.note, customFront: w.customFront };
    });

    const merged = [...updated, ...newWords];
    localStorage.setItem(MASTER_VERSION_KEY, masterVersion);
    saveWords(merged);
    if (newWords.length > 0) {
      console.log(`🌸 ${newWords.length}語の新しい単語を追加しました（合計${merged.length}語）`);
    }
    return merged;
  } catch {
    return null;
  }
}

export function useWordStore() {
  const [words, setWords] = useState<Word[]>(() => loadWords());
  const [grade, setGradeState] = useState<Grade | null>(() => loadGrade());
  const [monsterState, setMonsterStateRaw] = useState<MonsterState>(() => loadMonsterState());
  const [questState, setQuestStateRaw] = useState<QuestState>(() => loadQuestState());
  // 直近のエサ獲得イベント（UIアニメーション用）
  const [lastEarn, setLastEarn] = useState<{ amount: number; id: number } | null>(null);
  // 直近のモンスター卒業イベント（UIアニメーション用）
  const [lastGraduation, setLastGraduation] = useState<{ species: string; id: number } | null>(null);

  function setGrade(g: Grade) {
    saveGrade(g);
    setGradeState(g);
  }

  function updateMonsterState(fn: (s: MonsterState) => MonsterState) {
    setMonsterStateRaw(prev => {
      const next = fn(prev);
      saveMonsterState(next);
      return next;
    });
  }

  function updateQuestState(fn: (s: QuestState) => QuestState) {
    setQuestStateRaw(prev => {
      const next = fn(prev);
      saveQuestState(next);
      return next;
    });
  }

  /** バトル結果を記録。勝利時は次の難度へ進行＋初クリアならその難度のマーメイド卵を付与（一度きり） */
  function finishBattle(victory: boolean, stagesCleared: number) {
    updateQuestState(prev => {
      const tierJustCleared = victory && stagesCleared >= TOTAL_STAGES;
      const isFirstClear = tierJustCleared && !prev.clearedTiers.includes(prev.currentTier);
      const nextEggs = { ...prev.mermaidEggsByTier };
      if (isFirstClear) {
        nextEggs[prev.currentTier] = true;
      }
      return {
        ...prev,
        currentTier: tierJustCleared ? advanceTier(prev.currentTier) : prev.currentTier,
        clearedTiers: isFirstClear
          ? [...prev.clearedTiers, prev.currentTier]
          : prev.clearedTiers,
        mermaidEggsByTier: nextEggs,
        lastBattle: { tier: prev.currentTier, stagesCleared, victory },
      };
    });
  }

  /** 指定 tier のマーメイド卵を1個消費して、currentMonster をその tier の M0X にセット
   *  currentMonster がタマゴ状態（fed=0）の時のみ実行可。 */
  function hatchMermaidEgg(tier: DifficultyTier): boolean {
    if (!questState.mermaidEggsByTier[tier]) return false;
    if (monsterState.currentMonster.fed > 0) return false;
    let hatched = false;
    updateQuestState(prev => {
      if (!prev.mermaidEggsByTier[tier]) return prev;
      hatched = true;
      return {
        ...prev,
        mermaidEggsByTier: { ...prev.mermaidEggsByTier, [tier]: false },
      };
    });
    if (hatched) {
      const species = MERMAID_BY_TIER[tier];
      updateMonsterState(prev => ({
        ...prev,
        currentMonster: { species, fed: 0 },
      }));
    }
    return hatched;
  }


  function earnFood(amount: number) {
    if (amount <= 0) return;
    updateMonsterState(s => ({ ...s, foodInventory: s.foodInventory + amount }));
    setLastEarn({ amount, id: Date.now() });
  }

  /** 現モンスター（中央のタマゴ／成長中）にエサ1個を与える。
   *  返り値：'ok' = 食べた、'no-food' = 在庫切れ、'full' = もうおなかいっぱい（大人）
   *  大人に到達しても、このタイミングでは卒業させずモンスターは残す。
   *  ※ ポストLv5の大人モンスターへの給餌は feedAdult(id) を使うこと。 */
  function feedMonster(): 'ok' | 'no-food' | 'full' {
    let result: 'ok' | 'no-food' | 'full' = 'ok';
    updateMonsterState(prev => {
      if (prev.foodInventory <= 0) { result = 'no-food'; return prev; }
      if (isAdult(prev.currentMonster.fed)) { result = 'full'; return prev; }
      result = 'ok';
      const nextFed = Math.min(prev.currentMonster.fed + 1, MAX_FED_EXPORT);
      return {
        ...prev,
        foodInventory: prev.foodInventory - 1,
        currentMonster: { ...prev.currentMonster, fed: nextFed },
      };
    });
    return result;
  }

  /** えさやり対象（Lv5+ コレクションモンスター）を指定する。null で解除 */
  function setFeedTarget(id: string | null) {
    updateMonsterState(prev => ({ ...prev, feedTargetId: id }));
  }

  /** コレクション内の特定モンスターに直接エサを1個与える（タップで給餌）。
   *  食べたら同時に feedTargetId にもセットする（次回の学習エサもこの子に流れる）。
   *  返り値：'ok' = 食べた、'no-food' = 在庫なし、'not-found' = 対象不明、'maxed' = カンスト */
  function feedAdult(id: string): 'ok' | 'no-food' | 'not-found' | 'maxed' {
    let result: 'ok' | 'no-food' | 'not-found' | 'maxed' = 'ok';
    updateMonsterState(prev => {
      const target = prev.collection.find(m => m.id === id);
      if (!target) { result = 'not-found'; return prev; }
      if (target.level >= MAX_LEVEL) {
        result = 'maxed';
        // カンストでもターゲット指定は更新しておく
        return { ...prev, feedTargetId: id };
      }
      if (prev.foodInventory <= 0) {
        result = 'no-food';
        // エサ無しでもターゲット指定はできる
        return { ...prev, feedTargetId: id };
      }
      const { updated } = addExpTo(target, 1);
      result = 'ok';
      return {
        ...prev,
        foodInventory: prev.foodInventory - 1,
        feedTargetId: id,
        collection: prev.collection.map(m => m.id === id ? updated : m),
      };
    });
    return result;
  }

  /** 現モンスターを卒業させコレクションへ追加、次のタマゴを生成する。
   *  大人に到達していない場合は no-op。 */
  function graduateMonster() {
    let graduatedSpecies: string | null = null;
    updateMonsterState(prev => {
      if (!isAdult(prev.currentMonster.fed)) return prev;
      const adult = makeAdult(prev.currentMonster.species);
      const newCollection: AdultMonster[] = [...prev.collection, adult];
      if (newCollection.length > MAX_COLLECTION) newCollection.splice(0, newCollection.length - MAX_COLLECTION);
      graduatedSpecies = prev.currentMonster.species;
      return {
        ...prev,
        currentMonster: { species: pickNextSpecies(newCollection), fed: 0 },
        collection: newCollection,
      };
    });
    if (graduatedSpecies) {
      setLastGraduation({ species: graduatedSpecies, id: Date.now() });
    }
  }

  // 起動時: statusを再計算 + マスターデータとのマージ
  useEffect(() => {
    // SM-2フィールドのマイグレーション + status再計算
    setWords(prev => {
      const updated = prev.map(w => {
        let sm2Rep = w.sm2Repetition ?? 0;
        let sm2Int = w.sm2Interval ?? 0;
        const sm2Ef = w.sm2Efactor ?? 2.5;
        if (w.reviewStage >= 5 && sm2Int < 30) {
          sm2Rep = w.reviewStage;
          sm2Int = 30;
        } else if (w.reviewStage > 0 && sm2Rep === 0 && sm2Int === 0) {
          sm2Rep = w.reviewStage;
          sm2Int = w.reviewStage >= 2 ? 6 : 1;
        }
        return { ...w, sm2Repetition: sm2Rep, sm2Interval: sm2Int, sm2Efactor: sm2Ef };
      }).map(w => ({ ...w, status: getWordStatus(w) }));
      saveWords(updated);
      return updated;
    });

    mergeWithMaster(loadWords()).then(merged => {
      if (!merged) return;
      const withStatus = merged.map(w => ({ ...w, status: getWordStatus(w) }));
      setWords(withStatus);
      saveWords(withStatus);
    });

    // 1分ごとにステータスを再計算（overdue への切り替えをリアルタイム反映）
    const timer = setInterval(() => {
      setWords(prev => {
        const updated = prev.map(w => ({ ...w, status: getWordStatus(w) }));
        saveWords(updated);
        return updated;
      });
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  function skipWord(id: string) {
    setWords(prev => {
      const now = Date.now();
      const next = prev.map(w =>
        w.id === id
          ? { ...w, status: 'mastered' as const, learnedAt: now, reviewStage: 6, nextReviewAt: Number.MAX_SAFE_INTEGER, sm2Repetition: 6, sm2Interval: 30, sm2Efactor: 2.5 }
          : w
      );
      saveWords(next);
      return next;
    });
  }

  function answerWord(id: string, quality: number) {
    let earnAmount = 0;

    setWords(prev => {
      const word = prev.find(w => w.id === id);
      if (!word) return prev;

      if (quality < 3) addDailyWrongId(id);

      const dailyIds = getDailyWrongIds();
      const limitActive = dailyIds.length >= DAILY_WRONG_LIMIT;
      const limitMode = limitActive && dailyIds.includes(id);

      const next = prev.map(w => {
        if (w.id !== id) return w;
        const answered = markAnswered(w, quality, limitMode);
        // エサ獲得ルール:
        //   わからない (q<3)  → 0（連打で育成が進まないように）
        //   おぼえた (q>=3)   → +2
        earnAmount = quality < 3 ? 0 : 2;
        return { ...answered, correctCount: quality >= 3 ? (w.correctCount ?? 0) + 1 : (w.correctCount ?? 0) };
      });
      saveWords(next);
      return next;
    });

    if (earnAmount > 0) earnFood(earnAmount);
  }

  function updateMemo(id: string, memo: string) {
    setWords(prev => {
      const next = prev.map(w => w.id === id ? { ...w, memo: memo || undefined } : w);
      saveWords(next);
      return next;
    });
  }

  function updateCustomFront(id: string, customFront: string) {
    setWords(prev => {
      const next = prev.map(w => w.id === id ? { ...w, customFront: customFront || undefined } : w);
      saveWords(next);
      return next;
    });
  }

  function addCustomWord({ back, front, example_en, example_ja }: {
    back: string; front: string; example_en?: string; example_ja?: string;
  }) {
    const id = `custom-${Date.now()}`;
    const newWord: Word = {
      id,
      back,
      front,
      example_en: example_en ?? '',
      example_ja: example_ja ?? '',
      level: 3,
      station: 0,
      station_name: 'マイ単語',
      sfi_rank: 0,
      isCustom: true,
      status: 'unlearned',
      learnedAt: null,
      nextReviewAt: null,
      reviewStage: 0,
      sm2Repetition: 0,
      sm2Interval: 0,
      sm2Efactor: 2.5,
      correctCount: 0,
    };
    setWords(prev => {
      const next = [...prev, newWord];
      saveWords(next);
      return next;
    });
  }

  function deleteCustomWord(id: string) {
    setWords(prev => {
      const next = prev.filter(w => w.id !== id);
      saveWords(next);
      return next;
    });
  }

  function toggleStar(id: string) {
    setWords(prev => {
      const next = prev.map(w => w.id === id ? { ...w, starred: !w.starred } : w);
      saveWords(next);
      return next;
    });
  }

  function unskipWord(id: string) {
    setWords(prev => {
      const next = prev.map(w =>
        w.id === id
          ? { ...w, status: 'learning' as const, learnedAt: w.learnedAt ?? Date.now(), reviewStage: 0, nextReviewAt: Date.now() + 3 * 60 * 1000, sm2Repetition: 0, sm2Interval: 0, sm2Efactor: 2.5 }
          : w
      );
      saveWords(next);
      return next;
    });
  }

  function exportProgress(): string {
    const progress = extractProgress(words);
    const snapshot: ProgressSnapshot = {
      version: 1,
      exportedAt: Date.now(),
      wordCount: Object.keys(progress).length,
      progress,
    };
    return JSON.stringify(snapshot, null, 2);
  }

  function importProgress(jsonText: string): { imported: number; error?: string } {
    const remote = parseSnapshot(jsonText);
    if (!remote) return { imported: 0, error: 'ファイル形式が正しくありません' };

    const local = extractProgress(words);
    const merged = mergeProgress(local, remote);
    const next = applyProgress(words, merged).map(w => ({ ...w, status: getWordStatus(w) }));
    saveWords(next);
    setWords(next);

    const importedCount = Object.keys(remote).length;
    return { imported: importedCount };
  }

  // 選択学年に絞った単語のみ公開（カスタム単語はすべての学年で共通表示）
  const effectiveGrade: Grade = grade ?? DEFAULT_GRADE;
  const visibleWords = words.filter(w => w.isCustom || w.level === effectiveGrade);

  return {
    words: visibleWords,
    allWords: words,
    grade,
    setGrade,
    monsterState,
    questState,
    feedMonster,
    feedAdult,
    graduateMonster,
    setFeedTarget,
    finishBattle,
    hatchMermaidEgg,
    lastEarn,
    lastGraduation,
    skipWord,
    unskipWord,
    answerWord,
    toggleStar,
    updateMemo,
    updateCustomFront,
    addCustomWord,
    deleteCustomWord,
    exportProgress,
    importProgress,
  };
}
