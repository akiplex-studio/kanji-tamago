import type { Word } from '../types/word';
import type { ProgressMap, ProgressSnapshot, WordProgress } from '../types/progress';
import { getWordStatus } from './reviewSchedule';

// 学習済み or メモありの単語を ProgressMap に変換
export function extractProgress(words: Word[]): ProgressMap {
  const map: ProgressMap = {};
  for (const w of words) {
    if (w.learnedAt === null && !w.memo) continue;
    map[w.id] = {
      learnedAt: w.learnedAt,
      nextReviewAt: w.nextReviewAt,
      reviewStage: w.reviewStage,
      sm2Repetition: w.sm2Repetition,
      sm2Interval: w.sm2Interval,
      sm2Efactor: w.sm2Efactor,
      memo: w.memo,
    };
  }
  return map;
}

// Word[] に ProgressMap を上書き適用し、status を再計算して返す
export function applyProgress(words: Word[], progress: ProgressMap): Word[] {
  return words.map(w => {
    const p = progress[w.id];
    if (!p) return w;
    const updated: Word = {
      ...w,
      learnedAt: p.learnedAt,
      nextReviewAt: p.nextReviewAt,
      reviewStage: p.reviewStage,
      sm2Repetition: p.sm2Repetition,
      sm2Interval: p.sm2Interval,
      sm2Efactor: p.sm2Efactor,
      memo: p.memo,
      status: 'learning', // 後で再計算
    };
    updated.status = getWordStatus(updated);
    return updated;
  });
}

// フィールドごとに「より多く学習した方」を優先してマージ
export function mergeProgress(local: ProgressMap, remote: ProgressMap): ProgressMap {
  const merged: ProgressMap = { ...local };
  for (const [id, rp] of Object.entries(remote)) {
    const lp = local[id];
    if (!lp) {
      merged[id] = rp;
      continue;
    }
    const mergedEntry: WordProgress = {
      learnedAt: mergeMin(lp.learnedAt, rp.learnedAt),        // 古い方（最初に学習した日）
      nextReviewAt: mergeMax(lp.nextReviewAt, rp.nextReviewAt), // 遠い方（最近正解した端末を優先）
      reviewStage: Math.max(lp.reviewStage, rp.reviewStage),
      sm2Repetition: Math.max(lp.sm2Repetition, rp.sm2Repetition),
      sm2Interval: Math.max(lp.sm2Interval, rp.sm2Interval),
      sm2Efactor: Math.max(lp.sm2Efactor, rp.sm2Efactor),
      memo: rp.memo || lp.memo, // インポート元を優先、なければローカル
    };
    merged[id] = mergedEntry;
  }
  return merged;
}

// ProgressSnapshot を検証して ProgressMap を返す。失敗時は null
export function parseSnapshot(jsonText: string): ProgressMap | null {
  try {
    const obj = JSON.parse(jsonText) as unknown;
    if (
      typeof obj !== 'object' || obj === null ||
      (obj as Record<string, unknown>).version !== 1 ||
      typeof (obj as Record<string, unknown>).progress !== 'object'
    ) return null;
    return (obj as ProgressSnapshot).progress;
  } catch {
    return null;
  }
}

function mergeMin(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function mergeMax(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}
