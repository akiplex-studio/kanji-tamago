// ステージ単位の進捗（エサ在庫 / モンスターに与えた数）をlocalStorageで管理
// key: `${grade}-${station}` → { food, fed }

export type StageProgress = { food: number; fed: number };
export type StageProgressMap = Record<string, StageProgress>;

const KEY = 'kanji-tamago-stage-progress';

export function stageKey(grade: number, station: number): string {
  return `${grade}-${station}`;
}

export function loadStageProgressMap(): StageProgressMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as StageProgressMap;
  } catch { /* ignore */ }
  return {};
}

export function saveStageProgressMap(m: StageProgressMap): void {
  localStorage.setItem(KEY, JSON.stringify(m));
}

export function getStageProgress(m: StageProgressMap, grade: number, station: number): StageProgress {
  return m[stageKey(grade, station)] ?? { food: 0, fed: 0 };
}

export function setStageProgress(
  m: StageProgressMap,
  grade: number,
  station: number,
  patch: Partial<StageProgress>,
): StageProgressMap {
  const k = stageKey(grade, station);
  const cur = m[k] ?? { food: 0, fed: 0 };
  return { ...m, [k]: { ...cur, ...patch } };
}
