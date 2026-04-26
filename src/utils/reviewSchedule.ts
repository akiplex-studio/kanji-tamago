import type { Word, WordStatus } from '../types/word';
import { sm2 } from '../lib/sm2';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const SEC = 1000;

// 1セッションに新しく出題する未学習語の上限。
// ステージキャップ（❌/💔 が残るステージ以下に限定）で自然にブレーキがかかるため、
// 既定は実質無制限。互換のため定数自体は残し、必要時のみ opts.maxNew で絞れる。
export const MAX_NEW_PER_SESSION = Number.POSITIVE_INFINITY;

// SM-2 の結果から WordStatus を導出
function deriveStatus(word: Word): WordStatus {
  if (word.learnedAt === null) return 'unlearned';
  if (word.nextReviewAt === null) return 'learning';
  const now = Date.now();
  if (now > word.nextReviewAt) return 'overdue';
  // 4回連続「おぼえた」で永久マスター（rep>=4）
  if ((word.sm2Repetition ?? 0) >= 4) return 'mastered';
  return 'learning';
}

export function getWordStatus(word: Word): WordStatus {
  return deriveStatus(word);
}

// 「覚えた」判定：mastered、または rep>=4
export function isWordMastered(word: Word): boolean {
  if (word.status === 'mastered') return true;
  return (word.sm2Repetition ?? 0) >= 4;
}

// SM-2ベースの回答処理（quality: 4=おぼえた, 1=わからなかった）
// 子供向け5段階スケジュール（リンゴ獲得機会を増やす設計）:
//   わからない              → 15秒後（同セッション内ですぐ復習）
//   1回目「おぼえた」(rep=0) → 翌日（🌱 芽）
//   2回目「おぼえた」(rep=1) → 3日後（🌳 木）
//   3回目「おぼえた」(rep=2) → 7日後（🌷 チューリップ）
//   4回目「おぼえた」(rep=3) → 永久マスター（🌟）
//
// limitMode 引数は旧 DAILY_WRONG_LIMIT 系の名残。現在は無視され常に15秒。
// 互換のため引数は残すが、使わない。
export function markAnswered(word: Word, quality: number, _limitMode = false): Word {
  void _limitMode;
  const now = Date.now();
  const card = sm2(
    { repetition: word.sm2Repetition, interval: word.sm2Interval, efactor: word.sm2Efactor, nextReview: word.nextReviewAt ?? now },
    quality,
    now,
  );

  const rep = word.sm2Repetition;
  let nextReviewAt: number;
  if (quality < 3) {
    // 間違い：常に15秒後に再出題
    nextReviewAt = now + 15 * SEC;
  } else if (rep === 0) {
    nextReviewAt = now + DAY;                          // 1回目「おぼえた」→ 翌日（🌱）
  } else if (rep === 1) {
    nextReviewAt = now + 3 * DAY;                      // 2回目「おぼえた」→ 3日後（🌳）
  } else if (rep === 2) {
    nextReviewAt = now + 7 * DAY;                      // 3回目「おぼえた」→ 7日後（🌷）
  } else {
    nextReviewAt = Number.MAX_SAFE_INTEGER;            // 4回目以降「おぼえた」→ 永久マスター（🌟）
  }

  const updated: Word = {
    ...word,
    sm2Repetition: card.repetition,
    sm2Interval: card.interval,
    sm2Efactor: card.efactor,
    reviewStage: card.repetition,
    learnedAt: word.learnedAt ?? now,
    nextReviewAt,
  };
  // 不正解は一旦「学習中」にする（期限後にoverdueに自動遷移）
  updated.status = quality < 3 ? 'learning' : deriveStatus(updated);
  return updated;
}

// 後方互換（既存コードからの呼び出し用）
export function markRemembered(word: Word): Word {
  return markAnswered(word, 4);
}

export function markForgotten(word: Word): Word {
  return markAnswered(word, 1);
}

// 今日復習すべき単語（要復習を先、未学習を後に）
// opts.excludeUnlearned=true のとき未学習を追加しない（バックログ上限到達時）
// opts.maxNew で未学習語の出題上限を制限（既定 MAX_NEW_PER_SESSION）
// マイ単語（isCustom）は station 制限の対象外（常に含める）
//
// ステージ単位の集中復習:
//   未消化（❌=learning&&rep=0、または 💔=overdue）が残る最低ステージを検出し、
//   それより上のステージの単語（未学習・要復習問わず）はキューに入れない。
//   これにより、ステージ1に×が大量にある状態でステージ2の新規語が出ない。
export function getTodayReviewWords(
  words: Word[],
  opts: { excludeUnlearned?: boolean; maxNew?: number } = {},
): Word[] {
  const { excludeUnlearned = false, maxNew = MAX_NEW_PER_SESSION } = opts;
  const now = Date.now();

  // 未消化（❌ または 💔）の最低ステージを stationCap として算出（カスタム単語は対象外）
  let stationCap: number | null = null;
  for (const w of words) {
    if (w.status === 'mastered' || w.isCustom) continue;
    const isOverdue = w.status === 'overdue' || (w.nextReviewAt !== null && w.nextReviewAt <= now);
    const isWrongLearning = w.status === 'learning' && (w.sm2Repetition ?? 0) === 0;
    if (!isOverdue && !isWrongLearning) continue;
    if (stationCap === null || w.station < stationCap) stationCap = w.station;
  }

  const overdueCustom: Word[] = [];
  const overdueNormal: Word[] = [];
  const unlearnedCustom: Word[] = [];
  const unlearnedNormal: Word[] = [];
  for (const w of words) {
    if (w.status === 'mastered') continue;
    // stationCap より上のステージの通常語は除外（マイ単語は常に許可）
    if (stationCap !== null && !w.isCustom && w.station > stationCap) continue;
    const isUnlearned = w.status === 'unlearned' || (w.learnedAt === null && w.nextReviewAt === null);
    // ❌（learning && rep=0、わからない直後でまだ15秒経過していない）もキューに含める。
    // これがないと、わからない直後にホーム→学習に戻ると「がくしゅうかんりょう」と誤表示される。
    const isWrongLearning = w.status === 'learning' && (w.sm2Repetition ?? 0) === 0;
    const isOverdue =
      w.status === 'overdue' ||
      (w.nextReviewAt !== null && w.nextReviewAt <= now) ||
      isWrongLearning;
    if (isUnlearned) { (w.isCustom ? unlearnedCustom : unlearnedNormal).push(w); continue; }
    if (isOverdue)   { (w.isCustom ? overdueCustom  : overdueNormal).push(w);  continue; }
  }
  // 期限切れは古い順（最も遅れているものから）
  const sortByAge = (a: Word, b: Word) => (a.nextReviewAt ?? 0) - (b.nextReviewAt ?? 0);
  overdueCustom.sort(sortByAge);
  overdueNormal.sort(sortByAge);
  const overdue = [...overdueCustom, ...overdueNormal];
  if (excludeUnlearned) return overdue;
  // 未学習を maxNew で打ち切る（カスタムを優先して残す）
  const unlearned = [...unlearnedCustom, ...unlearnedNormal].slice(0, Math.max(0, maxNew));
  return [...overdue, ...unlearned];
}

// 復習が必要な単語（未学習を除く：一度学習したが忘れた or 期限切れ or わからない直後）
export function getDueReviewWords(words: Word[]): Word[] {
  const now = Date.now();
  return words.filter(w => {
    if (w.status === 'mastered') return false;
    if (w.status === 'unlearned') return false;
    if (w.status === 'overdue') return true;
    if (w.nextReviewAt !== null && w.nextReviewAt <= now) return true;
    // ❌（learning && rep=0）も「すぐ復習が必要」として扱う
    if (w.status === 'learning' && (w.sm2Repetition ?? 0) === 0) return true;
    return false;
  });
}

// 次の復習日を表示用にフォーマット
export function formatNextReview(nextReviewAt: number | null): string {
  if (nextReviewAt === null) return '未学習';
  if (nextReviewAt === Number.MAX_SAFE_INTEGER) return '永久定着';
  const diff = nextReviewAt - Date.now();
  if (diff <= 0) return '今すぐ復習';
  const days = Math.floor(diff / DAY);
  const hours = Math.floor(diff / HOUR);
  const mins = Math.floor(diff / MIN);
  if (days >= 1) return `${days}日後`;
  if (hours >= 1) return `${hours}時間後`;
  if (mins >= 1) return `${mins}分後`;
  return 'まもなく';
}

export const STATUS_COLORS: Record<string, string> = {
  unlearned: '#ECECEC',
  learning:  '#A0CA5A',
  overdue:   '#E05050',
  mastered:  '#FFB600',
};

export function formatNextReviewShort(nextAt: number | null | undefined): string {
  if (!nextAt) return '';
  if (nextAt === Number.MAX_SAFE_INTEGER) return '永久マスター！';
  const diffMs = nextAt - Date.now();
  if (diffMs <= 0) return 'すぐに復習';
  const diffSec = Math.ceil(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}秒後に復習`;
  const diffMin = Math.ceil(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}分後に復習`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}時間後に復習`;
  return `${Math.floor(diffH / 24)}日後に復習`;
}

export const STATUS_LABELS: Record<string, string> = {
  unlearned: '未学習',
  learning:  '学習中',
  overdue:   '要復習',
  mastered:  'おぼえた',
};
