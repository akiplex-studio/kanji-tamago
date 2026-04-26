import { getCurrentStageIndex, MAX_FED, STAGE_THRESHOLDS } from './monsterState';

export type MonsterDisplay = {
  stageIndex: 0 | 1 | 2 | 3 | 4;
  fed: number;
  progressPct: number;        // 0..100（大人までの進捗）
  nextMilestone: number;      // 次の進化までに必要なトータル fed
};

export function getMonsterDisplay(fed: number): MonsterDisplay {
  const stageIndex = getCurrentStageIndex(fed);
  const progressPct = Math.min(100, Math.round((fed / MAX_FED) * 100));
  let cum = 0;
  for (let i = 0; i <= stageIndex; i++) cum += STAGE_THRESHOLDS[i] ?? 0;
  const nextMilestone = Math.min(MAX_FED, cum);
  return { stageIndex, fed, progressPct, nextMilestone };
}

/** 絵文字フォールバック（画像が未登録の species 用） */
export function stageFaceEmoji(stageIndex: 0 | 1 | 2 | 3 | 4): string {
  return ['🥚', '🐣', '🐥', '🐤', '🌟'][stageIndex];
}
