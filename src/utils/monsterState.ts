// 全体のモンスター育成状態（ステージと独立した連続育成モデル）
// - foodInventory: ユーザーが貯めたエサの総数
// - currentMonster: いま育てているモンスター（種別 + 食べた数）
// - collection: これまで大人になった（=完成した）モンスター（個別にレベル・経験値を持つ）
// - feedTargetId: Lv5+モンスター育成時のエサ振分先（ホームでタップ選択）

// レベル間の必要エサ数（Lv1→Lv2、Lv2→Lv3、Lv3→Lv4、Lv4→Lv5）
// 序盤は少なめ、終盤に向けて多めの曲線
export const STAGE_THRESHOLDS: readonly number[] = [10, 20, 35, 55];
export const GROWTH_STAGES = STAGE_THRESHOLDS.length + 1;  // 5 段階（Lv1〜Lv5）
export const MAX_FED = STAGE_THRESHOLDS.reduce((a, b) => a + b, 0); // 120 で大人
export const MAX_COLLECTION = 100;         // コレクションの上限（localStorage肥大防止）
export const MAX_LEVEL = 99;               // Lv5 卒業後の最大レベル

/** 大人になった個別モンスターのレコード */
export type AdultMonster = {
  id: string;            // 一意ID（生成時に作成）
  species: string;       // 'S01'..'S11', 'M01'..'M05'（クエスト報酬マーメイド）, 'S12'（旧プレースホルダ・互換）
  graduatedAt: number;   // Date.now()
  level: number;         // 5..99
  exp: number;           // 現在Lv内の経験値（食べたエサ数）
};

export type MonsterState = {
  schemaVersion: 2;
  foodInventory: number;
  currentMonster: { species: string; fed: number };
  collection: AdultMonster[];   // クリア順
  feedTargetId: string | null;  // Lv5+ への追加エサの振分先（タップで指定）
};

// 利用可能な種別
export const SPECIES_POOL: string[] = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11'];

export function pickNextSpecies(collection: AdultMonster[]): string {
  // 今後、未獲得の種を優先して出すなどの工夫が可能。
  // 今はプールからローテーション：collection.length でループ。
  return SPECIES_POOL[collection.length % SPECIES_POOL.length];
}

const KEY = 'kanji-tamago-monster-state';

// crypto.randomUUID が使えない環境用のフォールバック
function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultState(): MonsterState {
  return {
    schemaVersion: 2,
    foodInventory: 0,
    currentMonster: { species: SPECIES_POOL[0], fed: 0 },
    collection: [],
    feedTargetId: null,
  };
}

// 旧形式（schemaVersion なし、collection: string[]）から新形式へマイグレーション
function migrate(parsed: unknown): MonsterState {
  if (!parsed || typeof parsed !== 'object') return defaultState();
  const raw = parsed as Record<string, unknown>;

  const foodInventory = typeof raw.foodInventory === 'number' ? raw.foodInventory : 0;
  const currentMonster = (raw.currentMonster && typeof raw.currentMonster === 'object')
    ? raw.currentMonster as { species: string; fed: number }
    : { species: SPECIES_POOL[0], fed: 0 };

  // collection マイグレーション
  let collection: AdultMonster[] = [];
  if (Array.isArray(raw.collection)) {
    collection = raw.collection.map((entry: unknown): AdultMonster => {
      if (typeof entry === 'string') {
        // 旧形式：species名のみの文字列
        return {
          id: uid(),
          species: entry,
          graduatedAt: 0,
          level: 5,
          exp: 0,
        };
      }
      // 既に新形式の場合
      const e = entry as Partial<AdultMonster>;
      return {
        id: e.id ?? uid(),
        species: e.species ?? SPECIES_POOL[0],
        graduatedAt: e.graduatedAt ?? 0,
        level: typeof e.level === 'number' ? Math.min(MAX_LEVEL, Math.max(5, e.level)) : 5,
        exp: typeof e.exp === 'number' ? Math.max(0, e.exp) : 0,
      };
    });
  }

  const feedTargetId = typeof raw.feedTargetId === 'string' ? raw.feedTargetId : null;

  return {
    schemaVersion: 2,
    foodInventory,
    currentMonster: {
      species: currentMonster.species ?? SPECIES_POOL[0],
      fed: typeof currentMonster.fed === 'number' ? currentMonster.fed : 0,
    },
    collection,
    feedTargetId,
  };
}

export function loadMonsterState(): MonsterState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveMonsterState(state: MonsterState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

/** 現在のモンスターの成長段階インデックス（0〜4） */
export function getCurrentStageIndex(fed: number): 0 | 1 | 2 | 3 | 4 {
  let cum = 0;
  for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
    cum += STAGE_THRESHOLDS[i];
    if (fed < cum) return i as 0 | 1 | 2 | 3 | 4;
  }
  return (GROWTH_STAGES - 1) as 4;
}

/** 大人（完成）に到達しているか */
export function isAdult(fed: number): boolean {
  return fed >= MAX_FED;
}

/** 現在レベル内の進捗（次レベルまでのゲージ表示用）
 *  level: 1〜5、current: 現在レベル内で食べた数、needed: 次レベルへ必要な数 */
export function getLevelProgress(fed: number): {
  level: number;
  maxLevel: number;
  current: number;
  needed: number;
  isMax: boolean;
} {
  const idx = getCurrentStageIndex(fed);
  const isMax = idx === GROWTH_STAGES - 1;
  if (isMax) {
    const last = STAGE_THRESHOLDS[STAGE_THRESHOLDS.length - 1];
    return { level: GROWTH_STAGES, maxLevel: GROWTH_STAGES, current: last, needed: last, isMax: true };
  }
  let cum = 0;
  for (let i = 0; i < idx; i++) cum += STAGE_THRESHOLDS[i];
  return {
    level: idx + 1,
    maxLevel: GROWTH_STAGES,
    current: fed - cum,
    needed: STAGE_THRESHOLDS[idx],
    isMax: false,
  };
}

// ============================================================
// ポストLv5レベリング（Lv5 → Lv99）
// ============================================================

/** Lv n から Lv n+1 へ上がるのに必要な経験値 */
export function xpToNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  if (level < 5) return 0;
  // Lv5→6: 20 / Lv10→11: ~76 / Lv30→31: ~596 / Lv98→99: ~4598
  return Math.round(20 + 5 * Math.pow(level - 5, 1.5));
}

/** 大人モンスターに経験値を与える（必要に応じてレベルアップ）
 *  返り値：レベルが上がった回数（0なら昇格なし） */
export function addExpTo(monster: AdultMonster, amount: number): { updated: AdultMonster; levelsGained: number } {
  if (monster.level >= MAX_LEVEL) {
    return { updated: monster, levelsGained: 0 };
  }
  let level = monster.level;
  let exp = monster.exp + amount;
  let levelsGained = 0;
  while (level < MAX_LEVEL) {
    const need = xpToNextLevel(level);
    if (exp < need) break;
    exp -= need;
    level += 1;
    levelsGained += 1;
  }
  if (level >= MAX_LEVEL) {
    exp = 0; // カンスト到達
  }
  return {
    updated: { ...monster, level, exp },
    levelsGained,
  };
}

// ============================================================
// 戦闘ステータス（クエストモード用）
// ============================================================

/** 戦闘ステータス：HP と 強さ（atk）を level から算出
 *  Lv差をはっきりさせるため傾きを大きく：
 *  Lv1:  HP 20  / atk 3
 *  Lv2:  HP 32  / atk 6
 *  Lv3:  HP 44  / atk 9
 *  Lv5:  HP 68  / atk 15
 *  Lv10: HP 128 / atk 30
 *  Lv50: HP 608 / atk 150
 *  Lv99: HP 1196 / atk 297
 */
export function getMonsterCombatStats(level: number): { maxHp: number; atk: number } {
  return {
    maxHp: 20 + 12 * (level - 1),
    atk:   3 + 3 * (level - 1),
  };
}

/** 新規 AdultMonster を生成（卒業時に呼ぶ） */
export function makeAdult(species: string): AdultMonster {
  return {
    id: uid(),
    species,
    graduatedAt: Date.now(),
    level: 5,
    exp: 0,
  };
}
