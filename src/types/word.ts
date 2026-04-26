export type WordStatus = 'unlearned' | 'learning' | 'overdue' | 'mastered';

export type Word = {
  id: string;
  back: string;          // 読み方（ひらがな）
  front: string;         // 漢字
  example_en: string;    // 例文（読み方側・将来拡張用）
  example_ja: string;    // 例文（漢字側・将来拡張用）
  level: number;         // 学年（1=小1 〜 6=小6）。カスタム単語は 3（デフォルト）
  station: number;       // 学年ごとのステージ番号（1〜）
  station_name: string;  // ステージ名（例: "ステージ3"）
  sfi_rank: number;      // NGSLの頻度順位
  note?: string;         // 使い分け補足
  customFront?: string;  // ユーザーが書き換えた問題文（未設定時は front を使用）
  isCustom?: boolean;    // ユーザーが自分で登録したカスタム単語
  // 学習状態（SRS）
  status: WordStatus;
  learnedAt: number | null;
  nextReviewAt: number | null;
  reviewStage: number;
  sm2Repetition: number;
  sm2Interval: number;
  sm2Efactor: number;
  starred?: boolean;
  memo?: string;
  // ステージのモンスターにあげたエサの数（「おぼえた」と答えた回数）
  correctCount?: number;
};

