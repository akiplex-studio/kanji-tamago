export type WordProgress = {
  learnedAt: number | null;
  nextReviewAt: number | null;
  reviewStage: number;
  sm2Repetition: number;
  sm2Interval: number;
  sm2Efactor: number;
  memo?: string;
};

// wordId → progress（未学習単語は含まない）
export type ProgressMap = Record<string, WordProgress>;

export type ProgressSnapshot = {
  version: 1;
  exportedAt: number;  // Unix ms
  wordCount: number;   // 学習済み単語数
  progress: ProgressMap;
};
