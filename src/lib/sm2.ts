/**
 * SM-2 (SuperMemo 2) アルゴリズム実装（カスタム版）
 * 微妙(q=3)の場合は早めに復習する独自拡張あり
 */

export type SM2Card = {
  repetition: number;   // 連続正解回数
  interval: number;     // 次の復習まで何日後か（小数可）
  efactor: number;      // 記憶の容易さ（≥ 1.3）
  nextReview: number;   // 次の復習日（Unix ms）
};

export function createCard(): SM2Card {
  return {
    repetition: 0,
    interval: 0,
    efactor: 2.5,
    nextReview: Date.now(),
  };
}

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// 微妙(q=3)の場合の早期復習間隔
const UNSURE_INTERVALS: Record<number, number> = {
  0: 3 * HOUR,    // 初回微妙 → 3時間後
  1: 2 * DAY,     // 2回目微妙 → 2日後
};

/**
 * SM-2 で単語カードを更新する
 * @param card 現在のカード状態
 * @param quality 回答の質 (0-5)。3以上が正解扱い
 * @param now 現在時刻（テスト用に注入可能）
 */
export function sm2(card: SM2Card, quality: number, now = Date.now()): SM2Card {
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  let { repetition, interval, efactor } = card;

  if (q >= 4) {
    // 自信あり
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * efactor);
    }
    repetition += 1;
  } else if (q === 3) {
    // 微妙 → 早めの復習間隔（ミリ秒をDAYに変換して格納）
    const unsureMs = UNSURE_INTERVALS[repetition] ?? Math.round(interval * efactor * 0.5) * DAY;
    if (repetition <= 1) {
      interval = unsureMs / DAY; // 小数の日数
    } else {
      interval = Math.round(interval * efactor * 0.5); // 通常の半分
    }
    repetition += 1;
  } else {
    // 不正解 → リセット
    repetition = 0;
    interval = 0;
  }

  // efactor 更新（正解・不正解問わず）
  efactor = efactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (efactor < 1.3) efactor = 1.3;

  const nextReview = now + interval * DAY;

  return { repetition, interval, efactor, nextReview };
}
