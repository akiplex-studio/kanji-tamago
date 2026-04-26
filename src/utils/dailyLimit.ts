import type { Word } from '../types/word';

export const DAILY_WRONG_LIMIT = 20;
// ❌（learning && rep=0）+ 💔（overdue）の合計上限。これを超えると新出題ロック
export const REVIEW_BACKLOG_LIMIT = 20;
const STORAGE_KEY = 'kanji-tamago-daily-wrong';

type DailyData = { date: string; ids: string[] };

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function load(): DailyData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as DailyData;
      if (data.date === today()) return data;
    }
  } catch { /* ignore */ }
  return { date: today(), ids: [] };
}

function save(data: DailyData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// 今日の「わからない」単語IDリストを取得
export function getDailyWrongIds(): string[] {
  return load().ids;
}

// IDを追加して更新済みリストを返す
export function addDailyWrongId(id: string): string[] {
  const data = load();
  if (!data.ids.includes(id)) {
    data.ids.push(id);
    save(data);
  }
  return data.ids;
}

// 今日のわからない件数
export function getDailyWrongCount(): number {
  return load().ids.length;
}

// 当日の「わからない」累計が上限に達しているか
export function isLimitReached(): boolean {
  return getDailyWrongCount() >= DAILY_WRONG_LIMIT;
}

// 上限に達したが、復習が全て完了（nextReviewAt > now）しているか
export function isLimitCleared(words: Word[]): boolean {
  if (!isLimitReached()) return true;
  const ids = getDailyWrongIds();
  const now = Date.now();
  return ids.every(id => {
    const w = words.find(w => w.id === id);
    if (!w) return true;
    return w.nextReviewAt !== null && w.nextReviewAt > now;
  });
}

// 復習がまだ残っている単語数
export function getRemainingRecoveryCount(words: Word[]): number {
  const ids = getDailyWrongIds();
  const now = Date.now();
  return ids.filter(id => {
    const w = words.find(w => w.id === id);
    return w && (w.nextReviewAt === null || w.nextReviewAt <= now);
  }).length;
}

/** ❌（learning && rep=0）+ 💔（overdue）の合計件数 */
export function getReviewBacklogCount(words: Word[]): number {
  const now = Date.now();
  let count = 0;
  for (const w of words) {
    if (w.status === 'mastered') continue;
    const isOverdue = w.status === 'overdue' || (w.nextReviewAt !== null && w.nextReviewAt <= now);
    if (isOverdue) { count++; continue; }
    if (w.status === 'learning' && (w.sm2Repetition ?? 0) === 0) count++;
  }
  return count;
}

/** バックログ（❌+💔）が上限に達しているか */
export function isBacklogLimitReached(words: Word[]): boolean {
  return getReviewBacklogCount(words) >= REVIEW_BACKLOG_LIMIT;
}
