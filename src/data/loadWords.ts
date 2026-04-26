import type { Word } from '../types/word';
import { INITIAL_WORDS } from './initialWords';

// 生成済みのallWords.jsonがあればそちらを使い、なければ初期10語にフォールバック
let cachedWords: Word[] | null = null;

export async function loadAllWords(): Promise<Word[]> {
  if (cachedWords) return cachedWords;
  try {
    const mod = await import('./preset/allWords.json');
    cachedWords = mod.default as Word[];
    return cachedWords;
  } catch {
    cachedWords = INITIAL_WORDS;
    return cachedWords;
  }
}

export function loadAllWordsSync(): Word[] {
  // 同期版: Viteのstatic importが必要なため、ビルド時にallWords.jsonが存在する場合のみ使用
  // 存在しない場合はINITIAL_WORDSを返す
  return INITIAL_WORDS;
}
