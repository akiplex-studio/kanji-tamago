// クエストモード（バトル）の状態
// - currentTier: 現在挑戦可能な最高難度（自動進行）
// - clearedTiers: クリア済み履歴
// - mermaidEggsByTier: 各難度の初クリア報酬卵を未孵化のまま所持しているか（true=所持中）
// - lastBattle: 直近のバトル結果（UI表示用）

export type DifficultyTier = 'beginner' | 'intermediate' | 'advanced' | 'super';

export const TIER_ORDER: DifficultyTier[] = ['beginner', 'intermediate', 'advanced', 'super'];

export const TIER_LABELS: Record<DifficultyTier, string> = {
  beginner: 'しょきゅう',
  intermediate: 'ちゅうきゅう',
  advanced: 'じょうきゅう',
  super: 'ちょうじょうきゅう',
};

export const TIER_TARGET_LEVEL: Record<DifficultyTier, number> = {
  beginner: 6,
  intermediate: 8,
  advanced: 10,
  super: 12,
};

// 各難度の初クリア報酬で得られるマーメイドの species。
// M05 は将来追加する5つ目の難度用に予約。
export const MERMAID_BY_TIER: Record<DifficultyTier, string> = {
  beginner: 'M01',
  intermediate: 'M02',
  advanced: 'M03',
  super: 'M04',
};

export type QuestState = {
  schemaVersion: 2;
  currentTier: DifficultyTier;
  clearedTiers: DifficultyTier[];
  mermaidEggsByTier: Record<DifficultyTier, boolean>;
  lastBattle: null | {
    tier: DifficultyTier;
    stagesCleared: number;
    victory: boolean;
  };
};

const KEY = 'kanji-tamago-quest-state';

function emptyEggsByTier(): Record<DifficultyTier, boolean> {
  return { beginner: false, intermediate: false, advanced: false, super: false };
}

function defaultState(): QuestState {
  return {
    schemaVersion: 2,
    currentTier: 'beginner',
    clearedTiers: [],
    mermaidEggsByTier: emptyEggsByTier(),
    lastBattle: null,
  };
}

export function loadQuestState(): QuestState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const currentTier: DifficultyTier =
      (typeof parsed.currentTier === 'string' && TIER_ORDER.includes(parsed.currentTier as DifficultyTier))
        ? parsed.currentTier as DifficultyTier
        : 'beginner';
    const clearedTiers: DifficultyTier[] = Array.isArray(parsed.clearedTiers)
      ? (parsed.clearedTiers as DifficultyTier[]).filter(t => TIER_ORDER.includes(t))
      : [];
    const lastBattle = (parsed.lastBattle && typeof parsed.lastBattle === 'object')
      ? parsed.lastBattle as QuestState['lastBattle']
      : null;

    // schemaVersion 2: そのまま読み込み
    if (parsed.schemaVersion === 2 && parsed.mermaidEggsByTier && typeof parsed.mermaidEggsByTier === 'object') {
      const raw = parsed.mermaidEggsByTier as Record<string, unknown>;
      const eggs = emptyEggsByTier();
      for (const t of TIER_ORDER) {
        eggs[t] = raw[t] === true;
      }
      return { schemaVersion: 2, currentTier, clearedTiers, mermaidEggsByTier: eggs, lastBattle };
    }

    // schemaVersion 1（または無印）からのマイグレーション:
    //   旧 mermaidEggs（数値）の内訳が残っていないため、clearedTiers に含まれる難度を
    //   未孵化扱いで一律付与する。既に S12（旧プレースホルダ）を孵化済みのユーザーには
    //   重複付与となる可能性があるが、過去データはテスト用と割り切る。
    const eggs = emptyEggsByTier();
    for (const t of clearedTiers) eggs[t] = true;
    return { schemaVersion: 2, currentTier, clearedTiers, mermaidEggsByTier: eggs, lastBattle };
  } catch {
    return defaultState();
  }
}

/** 所持中のマーメイドのたまご数（true 個数） */
export function countOwnedMermaidEggs(state: QuestState): number {
  return TIER_ORDER.reduce((n, t) => n + (state.mermaidEggsByTier[t] ? 1 : 0), 0);
}

/** 所持中のたまごの tier 一覧（TIER_ORDER 順） */
export function listOwnedMermaidEggTiers(state: QuestState): DifficultyTier[] {
  return TIER_ORDER.filter(t => state.mermaidEggsByTier[t]);
}

export function saveQuestState(state: QuestState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

/** 難度を1段階進める。最終難度（super）クリア時はそのまま super のまま */
export function advanceTier(current: DifficultyTier): DifficultyTier {
  const idx = TIER_ORDER.indexOf(current);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return current;
  return TIER_ORDER[idx + 1];
}

// ============================================================
// デーモンステータス
// ============================================================

const TIER_INDEX: Record<DifficultyTier, number> = {
  beginner: 1, intermediate: 2, advanced: 3, super: 4,
};

/** デーモンの戦闘ステータス（tier × stage で算出）
 *  - HP   = (80 + 75*stage) * (1 + 0.6*(tierIndex-1))
 *  - atk  = (15 + 5*stage)  * (1 + 0.4*(tierIndex-1))
 *  ※ 全員攻撃ターン制（味方5体なら1ターン5回攻撃）に合わせて HP/atk を強化。
 *  例：
 *    初級 wave 1: HP 155, atk 20
 *    初級 wave 5: HP 455, atk 40
 *    中級 wave 5: HP 728, atk 56
 *    超上級 wave 5: HP 1183, atk 88
 */
export function getDemonStats(tier: DifficultyTier, stage: number): { maxHp: number; atk: number; level: number } {
  const t = TIER_INDEX[tier];
  const maxHp = Math.round((80 + 75 * stage) * (1 + 0.6 * (t - 1)));
  const atk = Math.round((15 + 5 * stage) * (1 + 0.4 * (t - 1)));
  // デーモン表示用レベル（プレイヤーへの参考値）
  const level = TIER_TARGET_LEVEL[tier] + (stage - 1);
  return { maxHp, atk, level };
}

export const TOTAL_STAGES = 5;
export const PARTY_SIZE_MAX = 5;  // 連れていける上限
export const PARTY_SIZE_MIN = 1;  // 1体だけでもOK
