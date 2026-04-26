import type { Word } from '../types/word';

export function getCurrentStation(words: Word[]): number {
  // カスタム単語（station=0）は除外して、プリセット単語のみから判定
  const preset = words.filter(w => !w.isCustom && w.station > 0);
  if (preset.length === 0) return 1;
  const byStation = new Map<number, Word[]>();
  for (const w of preset) {
    if (!byStation.has(w.station)) byStation.set(w.station, []);
    byStation.get(w.station)!.push(w);
  }
  const maxStation = Math.max(...Array.from(byStation.keys()));
  // 一度も「おぼえた」と答えていない単語（sm2Repetition === 0）が1つでもあれば、そのステージが現在地
  // 完全マスターでなくても、一度正解したステージは通過扱いで、次のステージに進める
  for (let s = 1; s <= maxStation; s++) {
    const ws = byStation.get(s) ?? [];
    if (ws.length === 0) continue;
    if (ws.some(w => (w.sm2Repetition ?? 0) === 0)) return s;
  }
  return maxStation;
}

export function getAllStations(words: Word[]): number[] {
  const set = new Set<number>();
  for (const w of words) {
    if (w.isCustom) continue;
    if (w.station > 0) set.add(w.station);
  }
  return Array.from(set).sort((a, b) => a - b);
}
