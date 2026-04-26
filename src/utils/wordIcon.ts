import type { Word } from '../types/word';
import { isWordMastered } from './reviewSchedule';

// 単語ごとのアイコン（5段階＋期限切れ＋未学習）
//   空白   : 未学習
//   ❌     : 直近の回答が「わからない」（rep=0、学習開始済み、まだ期限内）
//   🌱     : 1回目「おぼえた」(rep=1) — 翌日に復習
//   🌳     : 2回目「おぼえた」(rep=2) — 3日後に復習
//   🌷     : 3回目「おぼえた」(rep=3) — 7日後に復習
//   🌟     : 4回目「おぼえた」(rep>=4) — 永久マスター
//   💔     : 復習期限切れ（overdue）
//
// w.status は wordStore の 60秒インターバルで遅延更新されるため、
// nextReviewAt を直接見てリアルタイムに ❌→💔 を切り替える。
export function getGrowthIcon(w: Word): string {
  if (w.status === 'unlearned') return '';
  if (w.status === 'mastered' || isWordMastered(w)) return '🌟';
  const now = Date.now();
  const dynamicallyOverdue =
    w.status === 'overdue' ||
    (w.nextReviewAt !== null &&
      w.nextReviewAt !== Number.MAX_SAFE_INTEGER &&
      w.nextReviewAt <= now);
  if (dynamicallyOverdue) return '💔';
  // learning
  const rep = w.sm2Repetition ?? 0;
  if (rep === 0) return '❌';
  if (rep === 1) return '🌱';
  if (rep === 2) return '🌳';
  if (rep === 3) return '🌷';
  return '🌟';
}
